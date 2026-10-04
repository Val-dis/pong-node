#!/usr/bin/env node
'use strict';
const readline = require('node:readline');
const {
  createGame, serve, update, movePaddle, togglePause, aiStep, PADDLE_STEP,
} = require('./src/game');
const { renderGame, renderMenu } = require('./src/render');

if (!process.stdin.isTTY || !process.stdout.isTTY) {
  console.error('run this in a real terminal.');
  process.exit(1);
}

const out = process.stdout;
const FRAME_MS = 33; // about 30 fps

let scene = 'menu'; // menu | game
let game = null;
let last = Date.now();
let timer = null;
let closed = false;

const clear = () => out.write('\x1b[2J\x1b[H');

function restoreTerminal() {
  if (closed) return;
  closed = true;
  clearInterval(timer);
  try { process.stdin.setRawMode(false); } catch { /* not a tty anymore */ }
  out.write('\x1b[0m\x1b[?25h\x1b[?1049l'); // reset colors, show cursor, leave alt screen
}

function quit(code = 0) {
  restoreTerminal();
  process.exit(code);
}

function startGame(mode) {
  game = createGame({ mode });
  scene = 'game';
  clear();
}

function onKey(str, key = {}) {
  if (key.ctrl && key.name === 'c') return quit();
  const name = key.name || str;

  if (scene === 'menu') {
    if (name === '1') startGame('ai');
    else if (name === '2') startGame('two');
    else if (name === 'q') quit();
    return;
  }

  switch (name) {
    case 'q': quit(); break;
    case 'm': scene = 'menu'; clear(); break;
    case 'p': togglePause(game); break;
    case 'space': serve(game); break;
    case 'r': if (game.status === 'over') startGame(game.mode); break;
    case 'w': movePaddle(game, 0, -PADDLE_STEP); break;
    case 's': movePaddle(game, 0, PADDLE_STEP); break;
    case 'up': movePaddle(game, game.mode === 'two' ? 1 : 0, -PADDLE_STEP); break;
    case 'down': movePaddle(game, game.mode === 'two' ? 1 : 0, PADDLE_STEP); break;
    default: break;
  }
}

function tick() {
  const now = Date.now();
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  const cols = out.columns || 80;
  const rows = out.rows || 24;

  if (scene === 'game') {
    if (game.mode === 'ai') aiStep(game, 1, dt);
    update(game, dt);
    out.write(renderGame(game, cols, rows));
  } else {
    out.write(renderMenu(cols, rows));
  }
}

process.on('uncaughtException', (err) => {
  restoreTerminal(); // put the terminal back first so the error is readable
  console.error(err);
  process.exit(1);
});
process.on('SIGTERM', () => quit());
out.on('resize', clear);

readline.emitKeypressEvents(process.stdin);
process.stdin.setRawMode(true);
process.stdin.resume();
process.stdin.on('keypress', onKey);

out.write('\x1b[?1049h\x1b[?25l'); // alt screen, hide cursor
clear();
timer = setInterval(tick, FRAME_MS);
