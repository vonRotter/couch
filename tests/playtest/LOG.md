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
- Later on day 1 (crab family, Pip's Beach Day shells, the first radish to Aunt Hazel, Rosa's store, the first
  letter, everyone met once, a second field row):
  - With one toast at a time, a burst (a crab family home: shell, coins, the cove, the museum wall, a crab friend,
    the passport) trailed on for half a minute: now each toast is shorter while others wait.
  - Coming back to the island (from a game, a new page) said "Today: Beach Day!" again every time.
  - The Journal's Tasks tab said "A quiet day: nothing new yet." on Beach Day (a new island's board is made before
    the welcome, empty).
  - "Hold your Zip-Zap to till here (Tab)": Tab opens the bag, but the Zip-Zap sits in hotbar slot 1.
  - Aunt Hazel's second quest wants a lettuce in a summer week, when lettuce does not grow (spring and winter):
    the task gave no hint why it could not be done.
- Fixed:
  - Toasts: shorter while more wait (`toasts.js`).
  - The day's news toast (festival, rain, birthday) once a day (`seasons.js`, `S.newsDay`).
  - The Today items of a new island's first day are worked out once the welcome is done (journal and map).
  - Zip-Zap hints name its hotbar key (1-9, or the pad's hotbar buttons) when it is on the hotbar (`zapKey`).
  - A quest's crop that does not grow this season (no greenhouse yet) gets "(lettuce grows in spring or winter.)".

## Day 2 (Sun 22 Nov, Beach Day again)

- Did: the Today board (Beach Day, Bram's planks rumor, the speckled egg), everyone with a "!" (Grumbleton's lost
  feather, Pip's rocket on the hall roof, Hoot's torn page: the seasonal mystery), harvest and replant, ship,
  fishing on the pier (three fish, a trial and gold in timing), Echo Bells in the Game Hall (card, play, pause),
  the menu, the bag, the help card and the emote wheel.
- Saw:
  - In the Game Hall the cabinet's name tag sits exactly where toasts show, and Coach's line about the game comes
    the moment you walk up to it: the tag was hidden behind the toast (known issue).
  - Esc on Echo Bells' result card: the pause menu ("Resume, Retry, ...") and the result card ("Play again, Back
    to the Game Hall") on screen together, one over the other.
  - Day 2 of a new island brings five new things: Beach Day, Pip's daily task, Grumbleton's feather quest,
    Hoot's torn page (the season's mystery) and the speckled egg. Owner decision (see the end).
- Fixed:
  - In the hall (its low camera) toasts go up under the clock pills, clear of the cabinet tag (`island.js`,
    `hud.js`).
  - The pause menu hides any other card while it is open and puts it back after (`main.js`).
