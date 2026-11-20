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

## Days 3-5 (Mon 23 - Wed 25 Nov; autumn week)

- Did: the Today boards (the speckled egg wobbling, Pip and Grumbleton's fishing contest starting, autumn, Coach
  stretching by the hall, Bram's gazebo), Rosa's radish soup and Mitten on the Barrel Run, Grumbleton's contest
  (picked his side), the first puzzle lock (Tunnel Trek at the cliff door, card and maze), the Stump Hop (sign,
  3-2-1, a bumpy run), wood from Rosa and the bridge fixed, carrot seeds, more fish, the dive suit and a first
  dive, Coach's Sporty mode (letter, lesson, tutorial card, R), the torn page (dig the key, the old lock, a wrong
  try shows the order), five wood to Bram's gazebo.
- Saw:
  - The speckled egg's basket stands a step from the shipping bin: walking up to the egg from the front said
    "Shipping bin: hold a crop and press E" (the bin was asked first). The egg was then left alone and hatched by
    itself two days later, as designed.
  - The torn page given on a Sunday (the season's last day) was gone on Monday: a new season's chapter started
    with another X and other pictures. As designed ("an unfinished chapter ends with its week"), but harsh on a
    child who got the page late on the last day: owner decision.
  - At the bridge's east end the workbench can answer [B] instead of the bridge (both reach there). Small; the
    bridge answers a step further west. Left as is.
- Fixed:
  - The egg basket (or the mystery pot) is asked before the mailbox and the shipping bin (`island.js`).

## Days 6-11 (Thu 26 Nov - Tue 1 Dec; days 7 and later on a fake Xbox pad at 1920x1080 for day 7)

- Did: a storm morning, Pillow Keep Solo (the keep door, hero picker, town, the first floor, pause, End game back
  to the keep door), the puzzle lock again, the fishing contest's weigh-in, Brick Bonk in the hall on the pad, the
  bottle's treasure map, Hoot's book on the hollow tree, a meteor night, winter's first day with Skye's balloon,
  and the fog night with the ghost ship and Captain Wisp.
- Saw:
  - On the pad every prompt named the pad's buttons (X use, A jump, D-pad, View, Start), the island's menu and
    panels too. Good.
  - The Today board on a day with a warning or a visitor's letter says "[OK]: save it · [BACK]: off we go". The key
    a child presses every day to close the board (E / X: the use key, which picks in panels) saves the event: it
    happened twice without meaning to (Skye's visit, then the fog night). Owner decision (see the end).
  - Right after that save, "You were here for Skye's visit, so your lock is free again." came 2.5 s later, after
    "Saved for you: the foggy night": it read as if nothing were saved.
  - A friend's letter's Today item kept the mailbox glowing on the map after the letter was read.
  - The ghost ship lay straight out from Captain Wisp, toward the camera: walking down to him it sat behind the
    hotbar and the prompt at the bottom of the screen, and with any camera shift its mast covered the bean
    (known issue).
- Fixed:
  - The "lock is free again" note is not said when a new lock was made meanwhile (`lock.js`).
  - A read friend's letter no longer glows on the map (`today.js mapItems`).
  - The ghost ship lies further west, out by the river mouth (`events.js SHIP`): walking up to Wisp it is in view
    beside the bean, clear of the hotbar; his talk still swings the view to it.

## Days 12-13 (Wed 2 - Thu 3 Dec; day 12 in Norwegian, day 13 with Help me play)

- Did: day 12 in Norwegian (N on the island): the Today board, letters, Rosa and her shop, Grumbleton's fishing
  tournament, a crab in seaweed, the menu, the bag, the help card, Echo Bells, the torn page's key and the old
  lock. Day 13 with Help me play from the island's menu: big text (then huge), strong outlines, reduce flashing,
  game speed 60 %, forgiving timing; Hazel's prize pumpkin (watered), fishing, Echo Bells, the puzzle lock.
- Saw:
  - Norwegian reads well and every key was translated (no raw keys on screen). One oddity: a title inside a
    sentence kept its capital: "Gi Tante Hassel 1 gulrot", "Gi Fyrvokter Bram ...", while the rest of the
    Norwegian text writes "tante Hassel" inside sentences.
  - With big text the island's menu (14 rows) ran off the top and bottom of a 1280x720 screen: the title, the
    Tomorrow line, Help and the key hints were cut off. The pause menu fits.
  - With big text the keys hint in the bottom-left corner ran under the hotbar.
  - Strong outlines: the picked menu row gets the arrow and the dashed ring. Forgiving timing widens the fishing
    zone (visible). Nothing flashes with reduce flashing on.
- Fixed:
  - Quest tasks use the in-sentence form of a villager's title (`isl.npcIn.*`: "Gi tante Hassel ..."); name tags and
    dialog names keep the capital.
  - Every centred card (menus, the pause menu, Help me play, offers) is zoomed down to fit the screen when it would
    be taller, never above the chosen text size (`ui.js fitPanels`, called every frame from `main.js`).
  - The keys hint stops short of the hotbar at any text size (`hud.js`).

## Days 14-17 (Fri 4 - Mon 7 Dec; Fishing Derby weekend, then spring)

- Did: each day the Today board, letters, everyone with a "!", today's things on the map one by one (Skye's second
  visit, the Derby, Hazel's prize pumpkin watered daily, a hermit crab's new shell, a flipped crab, the mystery
  pot), Hazel's 4- and 6-heart events, Rosa's secret, farming and shipping.
- Saw:
  - First visit at 19:00 on a balloon day: the board said "Skye the explorer is flying in today. Look up!", two hours
    after her balloon had left (10-17); the map's Today glow pointed at the empty meadow.
  - First visit at 18:00 on the pumpkin weighing's day: "Today: the pumpkin weighing at Aunt Hazel's cottage!", but
    the cast is only there 10-18, so it could not be seen. A child who plays only after dinner misses every drama's
    big moment: owner decision (see the end).
  - The pumpkin's big moment came on a Monday right after the Derby weekend with spring's first day and a new torn
    page rumor: three things on one board, within the budget.
- Fixed:
  - The Today board leaves out a daily surprise that is already over by the first visit (`today.js`), and a drama's
    big moment after 18 (`village.js`); the next day's board still tells how it ended.
  - The map's arrow (a target Coach set two weeks earlier, still pointing at Sky Hop's balloon) sat on the task
    list's text in the top right. Fixed: it goes just below or left of the list (`atlas.js updateCompass`).
- (Play runs from here on use a copy of the tree on a second dev server, so editing a fix does not reload the page
  under a running play day; two days had to be played again because of that.)

## Days 18-22 (Tue 8 - Sat 12 Dec; spring)

- Did: Tinka's parcel (the magic ball: letter, its tutorial card, "1/3 throw the ball at a wall", throws and
  catches), Hazel's pumpkin's gold ribbon, the speckled egg (a duckling), Pip's weather gadget warning and the
  rainbow (dug at its end), a crab in a net (Crab Cove's second level, the museum's 5-piece prize), Grumbleton's
  fishing tournament, Pip's star lookout, a hermit crab's shell.
- Saw:
  - The fishing tournament's pill (and a hop trail's) is centred at the very top: with the mode badge (Sporty mode,
    learned on day 4) the top-left row is wider, and the pill covered the badge and half of the coins.
  - The magic ball arrives by letter into the bag when the hotbar is full (slot 17); the letter says "Hold it", but
    not that it is in the bag (Tab).
  - Grumbleton has a "!" every day from 5 hearts (the tournament offer); the line is the same each day.
- Fixed:
  - The tournament's and the hop trail's pills sit under the top-left pills (`contest.js`, `hops.js`).
  - Until the first throw, a task says how to hold the magic ball: its hotbar key, or "it is in your bag: Tab"
    (`magicball.js tasks`, English and Norwegian).

## Days 23-26 (Sun 13 - Wed 16 Dec; summer from Monday)

- Did: a bottle's treasure map, Rosa's secret cake (asked what goes in it), a flipped crab, Skye's letter (the board
  saved her visit again on the use key), the Stump Hop with no falls (a trial, silver in moving and steering, Pip's
  race), the summer torn page, Pip's star lookout finished, Rosa's 6-heart event, and the lighthouse story's
  chapter 1 starting (Bram's letter, the read-aloud scene in the square with Grumbleton).
- Saw:
  - Name tags of walking villagers sometimes look smudged in screenshots; at rest they are crisp (a capture of the
    motion, not a rendering fault). Left as is.
  - Grumbleton's "!" every day since 5 hearts, always the same tournament offer: owner decision (see the end).
  - Day 26 had no Today board at all (nothing new): fine, the board is never filler.
  - No raw string keys, no console errors in any of these days.

## Days 27-29 (Thu 17 - Sat 19 Dec; day 29 on the fake pad at 1920x1080)

- Did: Grumbleton's storm warning (the board saved it on the use key, a third time), Skye's goggles on the Stump Hop,
  the summer chapter's key and the old lock (now two pictures: forgiving timing is on since day 13), the storm's
  finds and a crab in a net, the lighthouse story's chapter 2 (Lighthouse Caves), Beach Day on the pad, the
  magic ball, a fishing tournament, Paddle Pals in the hall (its tutorial, pause).
- Saw:
  - Paddle Pals paused during its tutorial: the step box ("3/3 Hit the ball with your paddle's edge...") stood
    over the pause menu's last rows.
  - The tournament pill now sits under the top-left pills on the pad's 1920x1080 screen too, and the map's arrow
    stays left of the task list.
  - The cliff door's puzzle lock has waited since day 3 (never solved): by design no other lock comes meanwhile.
  - Sneaky mode had not come by day 29 (the ball came on day 18; days 27-29 were special days).
- Fixed:
  - A tutorial's step box hides while the pause menu is open (`main.js`, `style.css`).

## Day 30 and a jump ahead (Sun 20 Dec, then 30 Dec, 9 Jan, 19-22 Jan)

- Did: Beach Day at 1920x1080 (a record on the Stump Hop: 3.8 s, Coco the hermit crab still waiting for a shell),
  then jumps of ten days to see the later odd adventures: Rosa's bandstand finished, a winter torn page, the
  fence happening (Rosa and Coach Bo: picked the flowers; the next board said "Rosa's flowers won the fence"),
  Marlo's cart (bought the moon cheese and a rubber duck pond), Hoot's bird hide going up, and on Thu 21 Jan
  Mumble's letter and Sneaky mode (his lesson, its tutorial card, "You learned Sneaky mode! R switches.").
- Saw:
  - The odd-adventure pace held: Sporty mode on day 4, the magic ball on day 18, then nothing until the first quiet
    day this child visited (each jump happened to land on a storm, a surprise or a festival), Sneaky mode on day 62.
    One a visit at most, never on a special day. For a child who visits mostly at weekends (festival weekends) the
    gaps grow long; owner decision below.
  - No raw string keys and no console errors on any visited day (the only console lines were the second dev
    server's own 403s for files outside its folder, not the game).

## Owner decisions (not changed: each with a recommendation)

1. **The Today board's [OK] saves an event "for later".** On a day with a warning or a visitor's letter the board
   says "[OK]: save it · [BACK]: off we go". [OK] is E / A, the key a child presses every day to close every
   panel, so the event got saved without meaning to on five of the days played (Skye twice, the fog, the storm,
   the rainbow), followed by "Saved for you: ..." toasts. Recommendation: [OK] (and [B]) close the board as on
   other days, and saving takes its own row on the board ("🔒 Save it for later", picked with the stick), or [C].
2. **A new island's first days are crowded.** Day 1 (a Saturday) had the welcome, the farming steps, Beach Day and
   today's crab; day 2 had five new things (Beach Day again, Pip's little task, Grumbleton's feather quest, Hoot's
   torn page: the season's mystery, the speckled egg). The puzzle lock is now held back (fixed), but the rest is
   calendar and design. Recommendation: for a profile's first three days, no seasonal mystery, no daily little
   task and no tomorrow hook (the calendar's festival and crab stay), so the farming steps and meeting everyone come
   first.
3. **The seasonal mystery ends with its week.** The torn page Hoot gave on a Sunday (the week's last day) was gone
   on Monday with a new season's chapter, before the child could dig. Recommendation: a chapter started on the
   last two days of its week stays open until the next chapter starts, or for three more days.
4. **Dramas' big moments are 10-18 only.** A child who plays after dinner misses every big moment (seen on the
   pumpkin weighing at 18:00). The board no longer announces one that is over (fixed), and the next day's board
   tells how it ended. Recommendation: keep the cast at the place until 20:00 (the villagers' homes from 20-21 on),
   or let the big moment play on the first visit of the day when that visit is after 18.
5. **Grumbleton's tournament "!" every day** from 5 hearts, always the same offer and the same line ("Hee! How about
   a fishing contest?"). Recommendation: the "!" only on Wednesdays (the tournament day) and the first day it is
   offered; the offer stays when you talk to him.
6. **Arrivals of the odd adventures need a quiet day that the child visits.** A weekend or special-day player can
   go weeks without one (here 44 days between the ball and Sneaky mode because every jump landed on a special day).
   Recommendation: keep "never on a special day", but let an overdue arrival (20+ days since the last) come on the
   next visited day that is not a festival.

## Final suite runs

- `tests/lba2/social.test.mjs` failed now and then on the final tree (2 of 3 runs): its own `day()` helper closed
  the Today board after 1.3 s, but the board opens 1.2 to 2.2 s into a new day (the island's once-a-second tick,
  and the game also runs on the real clock between steps), so it sometimes opened in the middle of the next step
  (the surprise party's big moment). The helper now waits twice, like `goTo` in `lba2.mjs`; the club test walks away
  from the sleepy guard before the next day (standing by him in Normal mode woke him again) and sends a passing
  villager along before knocking on the club door. No assertion changed.
- That flake showed a real fault: a villager entry in a save without `pts` (only `met`, as the test makes) gave a chat
  line "isl.mumble.chatundefined", a raw key on screen. Fixed: `npcState` fills missing numbers (`npcs.js`), with a
  test.
