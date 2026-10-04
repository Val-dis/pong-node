'use strict';
/**
 * pong logic. no printing, no input, no timers, so it can be tested on its own.
 * positions are in terminal cells: x runs across (0..W), y runs down (0..H).
 */

// ---- tweak these ----
const W = 60;
const H = 24;
const PADDLE_H = 5;
const PADDLE_X = [2, W - 3]; // columns for the left and right paddles
const WIN_SCORE = 7;

const START_SPEED = 26; // cols per second
const MAX_SPEED = 62;
const SPEED_UP = 1.07; // ball gets faster on every paddle hit
const MAX_ANGLE = 0.95; // radians off flat when hitting the edge of a paddle
const ASPECT = 0.5; // cells are about twice as tall as wide, so vertical speed is halved
const PADDLE_STEP = 2; // rows moved per key press
const AI_SPEED = 15; // rows per second
const AI_ERROR = 1.6; // how many rows the AI can aim off by
// ---------------------

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function createGame({ mode = 'ai', rng = Math.random } = {}) {
  const g = {
    w: W,
    h: H,
    mode, // 'ai' or 'two'
    rng,
    paddles: [{ y: (H - PADDLE_H) / 2 }, { y: (H - PADDLE_H) / 2 }],
    ball: { x: W / 2, y: H / 2, vx: 0, vy: 0, speed: START_SPEED },
    scores: [0, 0],
    status: 'serving', // serving | playing | paused | over
    serveDir: rng() < 0.5 ? -1 : 1,
    winner: null,
    rally: 0,
    flash: [0, 0], // paddle hit glow, fades to 0
    trail: [], // recent ball positions, oldest first
    aiError: [0, 0],
  };
  resetBall(g);
  return g;
}

function resetBall(g) {
  g.ball = { x: W / 2, y: H / 2, vx: 0, vy: 0, speed: START_SPEED };
  g.trail = [];
  g.rally = 0;
  g.aiError = [rollError(g), rollError(g)];
}

function rollError(g) {
  return (g.rng() - 0.5) * 2 * AI_ERROR;
}

function serve(g) {
  if (g.status !== 'serving') return;
  const angle = (g.rng() - 0.5) * 0.8;
  g.ball.vx = g.serveDir * g.ball.speed * Math.cos(angle);
  g.ball.vy = g.ball.speed * Math.sin(angle) * ASPECT;
  g.status = 'playing';
}

function movePaddle(g, side, rows) {
  if (g.status === 'paused' || g.status === 'over') return;
  g.paddles[side].y = clamp(g.paddles[side].y + rows, 0, H - PADDLE_H);
}

function togglePause(g) {
  if (g.status === 'playing') g.status = 'paused';
  else if (g.status === 'paused') g.status = 'playing';
}

function paddleTop(g, side) {
  return Math.round(g.paddles[side].y);
}

function hitsPaddle(g, side, y) {
  const top = paddleTop(g, side);
  return y >= top - 0.5 && y < top + PADDLE_H + 0.5;
}

function bounce(g, side, dir) {
  const b = g.ball;
  const top = paddleTop(g, side);
  const offset = clamp((b.y - (top + PADDLE_H / 2)) / (PADDLE_H / 2), -1, 1);
  const angle = offset * MAX_ANGLE;

  b.speed = Math.min(MAX_SPEED, b.speed * SPEED_UP);
  b.vx = dir * b.speed * Math.cos(angle);
  b.vy = b.speed * Math.sin(angle) * ASPECT;
  b.x = side === 0 ? PADDLE_X[0] + 1 : PADDLE_X[1];

  g.flash[side] = 1;
  g.rally += 1;
  g.aiError[1 - side] = rollError(g);
}

function point(g, scorer) {
  g.scores[scorer] += 1;
  if (g.scores[scorer] >= WIN_SCORE) {
    g.status = 'over';
    g.winner = scorer;
  } else {
    g.status = 'serving';
  }
  g.serveDir = scorer === 0 ? 1 : -1; // the ball goes toward whoever just lost
  resetBall(g);
}

function update(g, dt) {
  g.flash[0] = Math.max(0, g.flash[0] - dt * 4);
  g.flash[1] = Math.max(0, g.flash[1] - dt * 4);
  if (g.status !== 'playing') return;

  const b = g.ball;
  const prevX = b.x;
  g.trail.push({ x: b.x, y: b.y });
  if (g.trail.length > 9) g.trail.shift();

  b.x += b.vx * dt;
  b.y += b.vy * dt;

  // top and bottom walls
  const maxY = H - 0.001;
  if (b.y < 0) {
    b.y = -b.y;
    b.vy = Math.abs(b.vy);
  } else if (b.y > maxY) {
    b.y = 2 * maxY - b.y;
    b.vy = -Math.abs(b.vy);
  }

  // paddles: check that the ball crossed the paddle's face this step
  const leftFace = PADDLE_X[0] + 1;
  const rightFace = PADDLE_X[1];
  if (b.vx < 0 && prevX >= leftFace && b.x < leftFace && hitsPaddle(g, 0, b.y)) {
    bounce(g, 0, 1);
  } else if (b.vx > 0 && prevX <= rightFace && b.x > rightFace && hitsPaddle(g, 1, b.y)) {
    bounce(g, 1, -1);
  }

  // someone missed
  if (b.x < 0) point(g, 1);
  else if (b.x >= W) point(g, 0);
}

/** moves a paddle on its own: toward the ball when it's coming, back to center otherwise. */
function aiStep(g, side, dt) {
  const p = g.paddles[side];
  const incoming = side === 1 ? g.ball.vx > 0 : g.ball.vx < 0;
  let target = (H - PADDLE_H) / 2;
  if (g.status === 'playing' && incoming) {
    target = g.ball.y - PADDLE_H / 2 + g.aiError[side];
  }
  const maxMove = AI_SPEED * dt;
  p.y = clamp(p.y + clamp(target - p.y, -maxMove, maxMove), 0, H - PADDLE_H);
}

module.exports = {
  W, H, PADDLE_H, PADDLE_X, WIN_SCORE, PADDLE_STEP,
  createGame, serve, movePaddle, togglePause, update, aiStep, paddleTop,
};
