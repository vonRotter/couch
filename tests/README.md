# Tests

Browser tests for the game, run with headless Chromium through playwright against the Vite dev server.
They are plain Node scripts (no test framework) and are not part of the Vite build.

## Run them

1. Start the dev server from the repo root: `npx vite --port 5173 --strictPort`
2. In another terminal, run a file: `node tests/smoke.mjs`, or one part of the solo island:
   `node tests/lively/today.test.mjs`. All of the solo island's "livelier island" tests:
   `for f in tests/lively/*.test.mjs; do node "$f" || break; done`; the classic games: `for f in tests/arcade/*.test.mjs; do node "$f" || break; done`

Each file prints `PASS name` / `FAIL name: why` per test and exits with 1 if any failed.

- `ISLAND_URL` sets another address (default `http://localhost:5173/`).
- `SHOTS_DIR=/some/folder` saves screenshots (named `lively-*.png`) there.
- playwright is taken from `require('playwright')` (a global install), else the repo's `playwright-core`.

## What is where

- `tests/smoke.mjs`: the start screen, the shared island, a few games and a solo island open with no console errors.
- `tests/lively/helper.mjs`: the shared helper. `open()` a page, `startIsland(page, { time, save, raw })` makes
  a new profile and opens its solo island at a date (the island clock is moved with `window.__islandTimeOffset`;
  `save` is a function run on a fresh island save first, `raw` is a whole save, an old one say),
  `setTime(page, ms)`, `sim(page, seconds, dt)` (runs `window.game.simulate()`: game time without rendering),
  `island(page, (I, S, G, arg) => ...)` reads or changes the island scene `I`, its save `S` and the game `G`,
  `at(y, m, d, h)` makes a local date, plus a tiny `test` / `assert` / `done` runner.
- `tests/arcade/*.test.mjs`: the classic games round: `games` (each of the Game Hall's nine games starts, its
  controls work, it scores or reaches its goal, its card retries at once, the high score is saved for the profile,
  its assists), `puzzles` (the puzzle locks' pace over 8 simulated weeks, one at a time, solve and skip rewards,
  the trophy, old saves), `hall` (the cabinets, Coach's lines, the board and the passport, the hall's low camera)
  and `fixes` (Rock Patrol's clipped wrap-around edge, Echo Bells' first tune and its tutorial, and a fake
  gamepad's Start pausing a hall game, a puzzle lock, a hop trail's run, fishing and the dive); `arcade.mjs` is
  their helper (startArcade, R: the runner and its game, setAssist, answerOffer, screenOf for mouse clicks).
- `tests/lively/*.test.mjs`: the "livelier island" round (Today board and tomorrow hooks, villagers' own lives,
  rare events and the mystery, music and ambience, Pip's robot, old saves, and the density budget).
