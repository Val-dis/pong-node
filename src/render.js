'use strict';
/** turns game state into a string of ANSI-colored text. no side effects. */
const { W, H, PADDLE_H, PADDLE_X, WIN_SCORE, paddleTop } = require('./game');

const ESC = '\x1b[';
const RESET = `${ESC}0m`;
const fg = (n) => `${ESC}38;5;${n}m`;
const bg = (n) => `${ESC}48;5;${n}m`;

// 256-color palette
const BONE = 253;
const BONE_DIM = 245;
const BLOOD = 124;
const BLOOD_BRIGHT = 160;
const WINE = 88;
const ASH = 240;
const SOOT = 236;
const FIELD_BG = 233;
const TRAIL = [160, 124, 124, 88, 88, 52, 52, 52, 52]; // newest to oldest

const FRAME_ROWS = H + 4; // header + top border + field + bottom border + footer
const FRAME_COLS = W + 2;

function makeGrid() {
  return Array.from({ length: H }, () => Array.from({ length: W }, () => ({ ch: ' ', c: BONE })));
}

function put(grid, x, y, ch, c) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  grid[y][x] = { ch, c };
}

function putText(grid, row, text, c) {
  const start = Math.floor((W - text.length) / 2);
  for (let i = 0; i < text.length; i++) put(grid, start + i, row, text[i], c);
}

function gridToLines(grid) {
  return grid.map((row) => {
    let out = bg(FIELD_BG);
    let current = null;
    for (const cell of row) {
      if (cell.c !== current) {
        out += fg(cell.c);
        current = cell.c;
      }
      out += cell.ch;
    }
    return out + RESET;
  });
}

function messages(g, grid) {
  const mid = Math.floor(H / 2);
  if (g.status === 'serving') {
    putText(grid, mid + 3, 'space to serve', BONE_DIM);
    if (g.scores[0] + g.scores[1] === 0) putText(grid, mid + 5, `first to ${WIN_SCORE}`, ASH);
  } else if (g.status === 'paused') {
    putText(grid, mid - 1, 'paused', BONE);
    putText(grid, mid + 1, 'p to continue', ASH);
  } else if (g.status === 'over') {
    let line;
    if (g.mode === 'ai') line = g.winner === 0 ? 'you rose with the sun.' : 'the dark wins this round.';
    else line = `player ${g.winner + 1} wins.`;
    putText(grid, mid - 1, line, BLOOD_BRIGHT);
    putText(grid, mid + 1, 'r to go again    m for menu', ASH);
  }
}

function fieldLines(g) {
  const grid = makeGrid();

  // center line
  for (let y = 0; y < H; y += 2) put(grid, W / 2, y, '│', SOOT);

  if (g.status !== 'over') {
    // blood-red trail, fading with age
    const n = g.trail.length;
    for (let i = 0; i < n; i++) {
      const p = g.trail[n - 1 - i];
      put(grid, Math.floor(p.x), Math.floor(p.y), i < 3 ? '•' : '·', TRAIL[i]);
    }
    put(grid, Math.floor(g.ball.x), Math.floor(g.ball.y), '●', 255);
  }

  // paddles glow white when they hit the ball
  for (let side = 0; side < 2; side++) {
    const top = paddleTop(g, side);
    const color = g.flash[side] > 0.35 ? 231 : side === 0 ? BONE : BLOOD_BRIGHT;
    for (let r = 0; r < PADDLE_H; r++) put(grid, PADDLE_X[side], top + r, '█', color);
  }

  messages(g, grid);
  return gridToLines(grid);
}

function headerLine(g) {
  const names = g.mode === 'ai' ? ['you', 'valerie'] : ['p1', 'p2'];
  const left = `${names[0]}  ${g.scores[0]}`;
  const right = `${g.scores[1]}  ${names[1]}`;
  const mid = g.status === 'playing' && g.rally > 1 ? `rally ${g.rally}` : '';
  const gap = FRAME_COLS - left.length - right.length;
  const gapL = Math.floor((gap - mid.length) / 2);
  const gapR = gap - mid.length - gapL;

  const colorize = (s, nameLen, onLeft) => {
    // names dim, score bright
    const name = onLeft ? s.slice(0, nameLen) : s.slice(s.length - nameLen);
    const score = onLeft ? s.slice(nameLen) : s.slice(0, s.length - nameLen);
    return onLeft ? `${fg(ASH)}${name}${fg(BONE)}${score}` : `${fg(BONE)}${score}${fg(ASH)}${name}`;
  };
  return (
    colorize(left, names[0].length, true) +
    fg(SOOT) + ' '.repeat(gapL) + mid + ' '.repeat(gapR) +
    colorize(right, names[1].length, false) + RESET
  );
}

function borderLine(top) {
  const label = ' p o n g ';
  const l = top ? Math.floor((W - label.length) / 2) : 0;
  const bar = top
    ? '═'.repeat(l) + label + '═'.repeat(W - l - label.length)
    : '═'.repeat(W);
  const body = top
    ? fg(WINE) + '═'.repeat(l) + fg(BLOOD) + label + fg(WINE) + '═'.repeat(W - l - label.length)
    : fg(WINE) + bar;
  return `${fg(BLOOD_BRIGHT)}†${body}${fg(BLOOD_BRIGHT)}†${RESET}`;
}

function footerLine(g) {
  let text;
  if (g.mode === 'ai') text = 'w/s or arrows move  -  p pause  -  m menu  -  q leave';
  else text = 'p1 w/s  -  p2 up/down  -  p pause  -  q leave';
  return `${fg(ASH)}${text}${RESET}`;
}

function place(lines, cols, rows) {
  const left = Math.max(0, Math.floor((cols - FRAME_COLS) / 2));
  const top = Math.max(0, Math.floor((rows - lines.length) / 2));
  return lines
    .map((line, i) => `${ESC}${top + i + 1};${left + 1}H${line}${RESET}${ESC}K`)
    .join('');
}

function tooSmall(cols, rows) {
  const msg = `need a ${FRAME_COLS + 2}x${FRAME_ROWS + 2} terminal (this one is ${cols}x${rows})`;
  return `${ESC}2J${ESC}1;1H${fg(BLOOD_BRIGHT)}${msg}${RESET}`;
}

function renderGame(g, cols, rows) {
  if (cols < FRAME_COLS || rows < FRAME_ROWS) return tooSmall(cols, rows);
  const side = `${fg(WINE)}║${RESET}`;
  const lines = [
    headerLine(g),
    borderLine(true),
    ...fieldLines(g).map((l) => side + l + side),
    borderLine(false),
    footerLine(g),
  ];
  return place(lines, cols, rows);
}

function renderMenu(cols, rows) {
  const items = [
    ['┌─┐┌─┐┌┐┌┌─┐', BLOOD_BRIGHT],
    ['├─┘│ │││││ ┬', BLOOD_BRIGHT],
    ['┴  └─┘┘└┘└─┘', BLOOD_BRIGHT],
    ['', 0],
    ['i build things in the dark. they work.', ASH],
    ['', 0],
    ['[1]  you vs valerie', BONE],
    ['[2]  two players', BONE],
    ['[q]  leave', BONE_DIM],
    ['', 0],
    [`first to ${WIN_SCORE}. the ball only gets faster.`, ASH],
    ['even the longest night ends.', SOOT],
  ];
  const top = Math.max(0, Math.floor((rows - items.length) / 2));
  return items
    .map(([text, color], i) => {
      const left = Math.max(0, Math.floor((cols - text.length) / 2));
      return `${ESC}${top + i + 1};${left + 1}H${fg(color)}${text}${RESET}${ESC}K`;
    })
    .join('');
}

module.exports = { renderGame, renderMenu, FRAME_COLS, FRAME_ROWS };
