'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  W, H, PADDLE_H, PADDLE_X, WIN_SCORE,
  createGame, serve, movePaddle, togglePause, update, aiStep,
} = require('../src/game');

// small seeded rng so every run is identical
function seeded(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const fresh = (mode = 'ai') => createGame({ mode, rng: seeded(7) });

test('paddles stay inside the field', () => {
  const g = fresh();
  movePaddle(g, 0, -100);
  assert.equal(g.paddles[0].y, 0);
  movePaddle(g, 0, 100);
  assert.equal(g.paddles[0].y, H - PADDLE_H);
});

test('game starts waiting to serve, and serve launches the ball', () => {
  const g = fresh();
  assert.equal(g.status, 'serving');
  serve(g);
  assert.equal(g.status, 'playing');
  assert.ok(Math.abs(g.ball.vx) > 0);
});

test('pause toggles only while playing', () => {
  const g = fresh();
  togglePause(g);
  assert.equal(g.status, 'serving');
  serve(g);
  togglePause(g);
  assert.equal(g.status, 'paused');
  togglePause(g);
  assert.equal(g.status, 'playing');
});

test('ball bounces off the top and bottom walls', () => {
  const g = fresh();
  serve(g);
  Object.assign(g.ball, { x: W / 2, y: 0.2, vx: 0, vy: -10 });
  update(g, 0.1);
  assert.ok(g.ball.vy > 0);
  assert.ok(g.ball.y >= 0);

  Object.assign(g.ball, { x: W / 2, y: H - 0.2, vx: 0, vy: 10 });
  update(g, 0.1);
  assert.ok(g.ball.vy < 0);
  assert.ok(g.ball.y < H);
});

test('left paddle returns the ball and the ball speeds up', () => {
  const g = fresh();
  serve(g);
  const top = Math.round(g.paddles[0].y);
  const before = 30;
  Object.assign(g.ball, { x: PADDLE_X[0] + 1.2, y: top + PADDLE_H / 2, vx: -before, vy: 0, speed: before });
  update(g, 0.05);
  assert.ok(g.ball.vx > 0, 'ball should now travel right');
  assert.ok(g.ball.speed > before, 'ball should be faster');
  assert.equal(g.rally, 1);
  assert.equal(g.scores[0] + g.scores[1], 0);
});

test('right paddle returns the ball', () => {
  const g = fresh();
  serve(g);
  const top = Math.round(g.paddles[1].y);
  Object.assign(g.ball, { x: PADDLE_X[1] - 0.2, y: top + 1, vx: 30, vy: 0, speed: 30 });
  update(g, 0.05);
  assert.ok(g.ball.vx < 0);
});

test('hitting the edge of a paddle sends the ball at a steeper angle than the center', () => {
  const center = fresh();
  serve(center);
  const t1 = Math.round(center.paddles[0].y);
  Object.assign(center.ball, { x: PADDLE_X[0] + 1.1, y: t1 + 2.5, vx: -30, vy: 0, speed: 30 });
  update(center, 0.05);

  const edge = fresh();
  serve(edge);
  const t2 = Math.round(edge.paddles[0].y);
  Object.assign(edge.ball, { x: PADDLE_X[0] + 1.1, y: t2 + 4.8, vx: -30, vy: 0, speed: 30 });
  update(edge, 0.05);

  assert.ok(Math.abs(edge.ball.vy) > Math.abs(center.ball.vy));
});

test('a missed ball scores for the other side and goes back to serving', () => {
  const g = fresh();
  serve(g);
  g.paddles[0].y = 0; // keep the paddle far from the ball
  Object.assign(g.ball, { x: 1, y: H - 2, vx: -40, vy: 0, speed: 40 });
  update(g, 0.1);
  assert.deepEqual(g.scores, [0, 1]);
  assert.equal(g.status, 'serving');
  assert.equal(g.serveDir, -1); // goes toward the player who lost the point
  assert.equal(g.ball.x, W / 2);
});

test('first to the winning score ends the game', () => {
  const g = fresh();
  g.scores = [WIN_SCORE - 1, 0];
  serve(g);
  g.paddles[1].y = 0;
  Object.assign(g.ball, { x: W - 2, y: H - 2, vx: 40, vy: 0, speed: 40 });
  update(g, 0.1);
  assert.equal(g.status, 'over');
  assert.equal(g.winner, 0);
});

test('nothing moves while paused', () => {
  const g = fresh();
  serve(g);
  togglePause(g);
  const { x, y } = g.ball;
  update(g, 0.1);
  assert.equal(g.ball.x, x);
  assert.equal(g.ball.y, y);
});

test('ai paddle follows an incoming ball and respects its speed limit', () => {
  const g = fresh();
  serve(g);
  g.serveDir = 1;
  Object.assign(g.ball, { x: 30, y: 2, vx: 30, vy: 0 });
  g.aiError = [0, 0];
  g.paddles[1].y = 18;
  const before = g.paddles[1].y;
  aiStep(g, 1, 0.1);
  assert.ok(g.paddles[1].y < before, 'moved toward the ball');
  assert.ok(before - g.paddles[1].y <= 1.5 + 1e-9, 'did not teleport');
});

test('a full match between two ai players finishes with sane numbers', () => {
  const g = fresh('two');
  const dt = 1 / 30;
  let steps = 0;
  while (g.status !== 'over' && steps < 30 * 60 * 20) {
    if (g.status === 'serving') serve(g);
    aiStep(g, 0, dt);
    aiStep(g, 1, dt);
    update(g, dt);
    assert.ok(Number.isFinite(g.ball.x) && Number.isFinite(g.ball.y), 'ball position stays finite');
    assert.ok(g.ball.y >= 0 && g.ball.y < H, 'ball stays between the walls');
    steps++;
  }
  assert.equal(g.status, 'over', 'match should end');
  assert.ok(g.scores.includes(WIN_SCORE));
});
