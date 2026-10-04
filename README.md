# pong-node

gothic pong for the terminal. blood and bone on black. node only, zero dependencies.

btw this is one of the first things i made with node, its like 30% skidded (i think? this was from a while ago) so theres that

```
†═════════════════════════ p o n g ══════════════════════════†
║                              │                             ║
║  █               ·           │                          █  ║
║  █        ●••····                                       █  ║
║  █                           │                          █  ║
†════════════════════════════════════════════════════════════†
```

## run it

needs node 18 or newer and a terminal at least 64x30.

```
node index.js
```

or `npm start`. no install step, there's nothing to install.

## controls

| key | does |
|---|---|
| `1` | you vs valerie (menu) |
| `2` | two players (menu) |
| `w` / `s` | move left paddle |
| `up` / `down` | move left paddle (vs valerie), or right paddle (two players) |
| `space` | serve |
| `p` | pause |
| `r` | go again, after a game ends |
| `m` | back to the menu |
| `q` | leave |

first to 7. the ball gets faster on every hit. where it hits the paddle changes the angle, so the edge sends it steep.

## how it looks

- the ball leaves a blood-red trail that fades with age
- paddles flash white when they hit
- the opponent is valerie, a nod to the bot
- the game draws in a separate screen, and your terminal is restored when you quit

## how it's built

```
index.js        input, the game loop, and terminal setup/cleanup
src/game.js     all the rules. no input or output, so it's testable
src/render.js   turns game state into colored text
test/           node's built-in test runner
```

the game logic doesn't print or read keys, which is why the tests can play a whole match between two ai players in a few milliseconds.

## tweak it

everything that affects feel is at the top of `src/game.js`: field size, paddle height, ball speed and acceleration, how hard valerie is (`AI_SPEED` and `AI_ERROR`), and the winning score.

## test

```
npm test
```

## one limitation

terminals only report key presses, never key releases. so each press moves the paddle two rows, and holding a key works through your keyboard's repeat rate instead of true held movement. that's a terminal thing, not something the game can fix.
