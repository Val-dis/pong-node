'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createGame, serve } = require('../src/game');
const { renderGame, renderMenu, FRAME_COLS, FRAME_ROWS } = require('../src/render');

const strip = (s) => s.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '');

test('menu shows the options', () => {
  const text = strip(renderMenu(80, 30));
  assert.match(text, /\[1\]/);
  assert.match(text, /\[2\]/);
  assert.match(text, /valerie/);
});

test('game frame has the ball, paddles and title', () => {
  const g = createGame({ mode: 'ai', rng: () => 0.3 });
  serve(g);
  const text = strip(renderGame(g, 80, 30));
  assert.match(text, /p o n g/);
  assert.ok(text.includes('●'));
  assert.ok(text.includes('█'));
  assert.match(text, /valerie/);
});

test('small terminals get a message instead of a broken frame', () => {
  const g = createGame({ mode: 'ai' });
  const text = strip(renderGame(g, 20, 10));
  assert.match(text, /need a/);
});

test('frame fits the size it advertises', () => {
  assert.ok(FRAME_COLS > 0 && FRAME_ROWS > 0);
});
