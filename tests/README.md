# Tests

Browser tests for the game, run with headless Chromium through playwright against the Vite dev server.
They are plain Node scripts (no test framework) and are not part of the Vite build.

## Run them

1. Start the dev server from the repo root: `npx vite --port 5173 --strictPort`
2. In another terminal, run a file: `node tests/smoke.mjs`, or one part of the solo island:
   `node tests/lively/today.test.mjs`. All of the solo island's "livelier island" tests:
   `for f in tests/lively/*.test.mjs; do node "$f" || break; done`; the classic games: `for f in tests/arcade/*.test.mjs; do node "$f" || break; done`.
   The same for each suite folder: `tests/island`, `tests/keepsolo`, `tests/games`, `tests/pad`; and the missing-string
   check: `node tests/strings.mjs`. Everything (about 25 minutes):
   `node tests/smoke.mjs; node tests/strings.mjs; for f in tests/{island,keepsolo,games,pad,lively,arcade}/*.test.mjs; do node "$f"; done`
3. Run tests on a tree nobody edits meanwhile: the dev server reloads a page when a source file changes, and the test
   in that page then fails for no reason. (After a source file changed, a test's own `import('/src/...')` can get a
   second copy of a module, without the game's state: read state through `window.game`, the scene, or behaviour.)

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
- `tests/island/*.test.mjs`: the solo island core (the safety round), with `isl.mjs` (hold, tp: stand somewhere,
  toWalk: close what is open, useText / use: what [E] does, rawKeys: raw text keys on screen). `core`: a new
  profile's welcome with real key presses, walking, a hop, a wall, the cottage door, and a 2 m grid over the whole
  island (new and with everything unlocked) where the bean must walk away from every free spot and get out of every
  prop it is put inside. `farm`: the welcome's farming steps (till, plant, water, ripe, harvest, ship), growth over
  a night and days and dry soil, weeds, the bag (move, stack, quick move, hotbar keys), a full bag into the cottage
  chest, Rosa's shop (buy, sell, too few coins), the workbench (craft, missing materials, a sprinkler on the field)
  and decorating (place, turn, take back; furniture only inside). `life`: villagers asleep at home at night,
  knocking, the closed store, a locked game door, mornings, friendship (a chat an hour, a loved gift, a heart), the
  journal's eight tabs and the map (no raw keys), fishing, the café (cook, serve, the summary), a hop trail (the
  countdown, a fall, the bell), the museum, the trophy shelf, a winter week and the sled. `save`: the round trip over
  a page reload, a minimal old save, a profile with no island yet, and every panel in English and Norwegian with no
  raw text keys.
- `tests/keepsolo/keepsolo.test.mjs`: Pillow Keep Solo from the island's keep door: the hero picker and the starting
  kit, the gate and the first floor, the tutorial's card and all five steps each at its moment, a fight, the bag
  (pick up, wear, drag and drop with the mouse, a potion onto the belt, drinking), a locked door and its key,
  fainting (the bag drops and comes back), Bolster's forge, save and resume over a page reload, and End back to the
  island at the keep door.
- `tests/games/*.test.mjs` (with `games.mjs`): every game in main.js `GAMES`, one file per family (`coop1`-`coop4`,
  `learning`, `story`, `solo`): from the shared island with one and two keyboard players (the games that only live
  on a profile's island from there, one player), 20 s of random-ish keys with no console errors (tutorial cards
  answered "I know how to play", the tutorial then off), and the pause menu (Esc opens and closes it, Retry restarts,
  End goes back). Titles and countdowns run on the real clock, so each game takes a few real seconds.
- `tests/pad/gamepad.test.mjs`: a fake standard gamepad: Start pauses, A picks and B never picks in the pause menu of
  a co-op game, a Game Hall game, a puzzle lock, a hop trail's run, the dive and Pillow Keep Solo; on the island
  Start opens its own menu (B closes it), View opens the map and closes it again.
- `tests/strings.mjs`: every text key written out in the code has English and Norwegian, and both languages have the
  same keys (from `window.game.stringKeys()`).
- `tests/lba2/*.test.mjs` (with `lba2.mjs`: hold a key, stand somewhere, talk a dialog through, answer a tutorial's card):
  the odd-adventure round (`solo/odd.js` and its parts): `modes` (Coach's Sporty and Mumble's Sneaky mode, [MODE] on a
  keyboard and a gamepad, the badge, the tutorials, the modes' effects), `ball` (the magic ball: the letter, the
  tutorial, bounces and returns, the aim line by aim help, the switch door, the bells and the one-throw trial, apples,
  the lost things it knocks down), `wizard` (Wendeline's lessons, the rune, the rain and sun spells and their daily
  limits), `inventor` (Tinka's chats, the teleport booths and their misfire spots, the joke robot, the talking lighthouse).
- `tests/lively/*.test.mjs`: the "livelier island" round (Today board and tomorrow hooks, villagers' own lives,
  rare events and the mystery, music and ambience, Pip's robot, old saves, and the density budget).

## KNOWN

Tests that fail on purpose because what they test is not fixed yet (never skipped or weakened; fix the code, then
the test passes). None right now.
