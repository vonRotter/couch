# Play-test log (solo island, a simulated month)

A child's month on the solo island, played by script in headless Chromium (1280x720 and 1920x1080, keyboard,
then a fake gamepad), with the time machine (`window.__islandTimeOffset`). Screenshots were taken at every new
screen and looked at; they live outside the repo (named `play-*`). Fixes come with a test in
`tests/playtest/playtest.test.mjs` (or the suite they belong to). Owner decisions are collected at the end.

The month starts on Saturday 21 November 2026, 09:30 (a new profile, Mia, from the start screen).

## Day 1 (Sat 21 Nov, Beach Day)

- Did: start screen, New player (name on the letter grid, a color), the welcome (Aunt Hazel and Pip, the
  Zip-Zap, "Yes please" to the farming steps), till, plant, water, a row of radishes.
- Saw:
  - A brand-new island's first day had three new things on top of each other: the welcome, Beach Day (the
    calendar's festival) and a puzzle lock ("Something new on the island: an old door...") a minute in. The
    week's puzzle day had passed before the profile existed, so it caught up on the festival day, which the
    puzzle pace says never happens.
  - Two toasts stacked, and the long puzzle toast ran under the task list (known issue).
  - The task list put Beach Day above the farming step, so a new child's top line was not the step to do.
  - "Plant radish seeds on the tilled soil" was the only step that did not say which button.
  - The held thing's name ("Zip-Zap") peeked out between the dialog box and the hotbar.
  - The bean ends the welcome a step east of the field's gate: walking straight down bumps the fence. The gate
    is in view right beside it, so left as is.
- Fixed:
  - Puzzle locks: a puzzle day that passed while the child was away now only catches up on a quiet day (no
    festival, surprise or rare event), and none comes while the farming steps run (`puzzles.js puzzleDue`, also
    used by `odd.js puzzleComes`).
  - Toasts on the island: one at a time (the queue keeps the rest), wrapped, and narrow enough to stay clear of the
    task list (`toasts.js`, `hud.js`).
  - While the farming steps run, the step is the first task.
  - Step 2 says "with [B]" (English and Norwegian).
  - A dialog hides the held thing's name.
