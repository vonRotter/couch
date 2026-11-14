# Onboarding audit: "teach one action at a time before combining them"

Development step 3, point 5: an audit (no game was changed for the audit itself). Every game's first
minutes are checked against one rule: a new player should meet one action at a time, use it on its own
until it works, and only then combine it with the next one.

**Fixed since (the owner's choices):** Sky Hop level 1 now teaches one thing at a time with a double-jump
wall on its own; Crystal Caves, Pillow Keep and Pillow Keep Solo introduce their controls step by step; and
every tutorial can be skipped ("I know how to play", remembered per profile, never forced) and turned back
on in Help me play. Marked **Fixed** below; see *Skipping tutorials* at the end for the list. Not chosen
for now: co-op first cards and team-game practice moments (findings 1 and 5 stay open).

**Method.** For each game: the intro card and its read-aloud text (`<game>.intro`), the first level, room or
battle as data (Sky Hop's level chunks, Grumble Guides' job lists, Portal Pals' rooms, the Golden Bean's level
list), tutorials and first-time tips in the code (the island's `isl.tut.*`, Bean Brigade's first battle,
Pillow Keep Solo's `ks.tip*`, Crystal Caves' `cave.tip`, Pudding Island's `adv.help`, Lighthouse Caves' signs),
the README and short headless runs. The four Game Hall guest games live in other repositories and are not
covered. Verdicts: **good** (one thing at a time already), **mixed** (a good start, then too much at once),
**all at once** (every action on the first card).

## Top findings

1. **The intro card is the whole manual in most co-op games.** Most of the shared island's games show
   every button on one card before play (Bonk Brawl, Snowball Fort, Paint Pilots, Splash Squad, Spacefall,
   Rooftop Rush, Crystal Caves, Knights & Builders, Pillow Keep, Kart Party, Snow Slalom...). Nothing in the
   first minute asks for one action alone. *Suggestion:* a shared "first 30 seconds" pattern in `MiniGame`:
   the card names only the main action, and each other action gets a one-line prompt the first time it is
   useful (Rooftop Rush's signs already do exactly this and are the model to copy).
2. **The best onboarding is already in the house:** the island's farming tutorial (till, plant, water, wait,
   harvest, ship: one step per prompt), Grumble Guides (one new job per level: stopper, then bridge, then
   stairs, then digging), the Golden Bean campaign (each level adds one thing), Rooftop Rush (a sign names each
   move the first time it is needed), Bean Brigade's read-aloud first battle and Laser Ducks (one action).
   These are the templates for the rest.
3. **Fixed.** **Sky Hop's first level stacked four new things in its first 40 metres** (jump-through clouds, then a spring,
   a grumble and two pits in the second chunk, a moving platform in the third), and the double jump is never
   asked for on its own. As the game the passport and Coach suggest first for timing, it should teach slowest.
4. **Fixed (step-by-step controls; the first cave and dungeon floor stay random).** **Big solo games opened with a full control set:** Pillow Keep Solo's first dungeon tip lists attack, class
   move, skill and the hold-menu at once; Crystal Caves' card lists jump, climb, rope, bomb and hearts, and the
   first cave is random. A fixed, gentle first room per game would fix both.
5. **Team games start with a picker, then everything.** Mega Ball, Ice Hockey, Snowball Fort and Knights &
   Builders put team choice, class choice and three or four actions in front of a child before the first
   touch of the ball. A practice moment (a goal to score alone before kickoff, a target to hit before the
   match clock starts) would separate "learn" from "play".

## Summary

| Game | Where | Verdict | The main issue |
| --- | --- | --- | --- |
| The island (farming) | solo | good | – (step-by-step tutorial; the bag and hotbar come later as tasks) |
| Fishing | solo | good | the reel's green zone and "3 misses" are explained only by trying |
| Skipping stones, kite | solo | good | one action each |
| Hop trails | solo | good | jumping is already learned on the island; the timer is clear |
| Diving | solo | mixed | swimming, picking, chests and the night sea can arrive together on the first dive |
| Café | solo | mixed | cooking and serving are taught by one card |
| Sky Hop | solo + co-op | good (fixed) | was: four new things in the first 40 m of level 1; now one per stretch, the double jump alone |
| Lighthouse Caves | solo | good | items gate new actions one at a time (Zelda structure); signs name what is needed |
| Pudding Island | solo | good | point and click with one help line; looking and using items come naturally |
| Laser Ducks | solo + co-op | good | one action |
| Bean Brigade | solo | good | a read-aloud first battle and a one-time deploy explanation; the battle menu has many options |
| Grumble Guides | solo + co-op | good | one job per level |
| Golden Bean campaign | solo + co-op | good | one new thing per level; solo players get the Knight-Builder's two jobs at once |
| Crystal Caves | solo + co-op | good (fixed) | was: five actions and hearts on the card; now one button at a time (the first cave is still random) |
| Pillow Keep Solo | solo | good (fixed) | was: four controls in the first tip; now one at a time for the input in use (the class pick stays first) |
| School House games | solo + co-op | good | one action (run or jump to the answer) and a level picker |
| Bubble Buddies | co-op | mixed | blowing bubbles and popping trapped ones are both on the card; bouncing on bubbles is never taught |
| Paint Party | co-op | mixed | walk-to-paint is perfect; dash and bomb arrive at once with grumble mud |
| Spacefall | co-op | all at once | thrust, missile, dash, wrap-around and picking missiles out of walls |
| Bonk Brawl | co-op | all at once | four attacks and the float on one card |
| Kart Party | co-op | mixed | steering is automatic-friendly; hop, drift and items arrive together |
| Mega Ball | co-op | mixed | team pick, then kick, dash and header at once |
| Ice Hockey | co-op | mixed | grab, shoot (hold), dash-steal and poke at once |
| Snow Slalom | co-op | mixed | steering is enough at first; tuck, brake, jump and push-off are all on the card |
| Portal Pals | co-op | mixed | room 1 needs two portals right away; one portal colour first would help |
| Space Race | co-op | good | steer and boost; the slide is optional |
| Rooftop Rush | co-op | good | signs teach slide, wall jump, hook and dash one at a time |
| Cook-Off | co-op | good | starts with the easiest dish; the others unlock during the match |
| Bean Golf | co-op | good | a warm-up hole; fine aim is optional |
| Snowball Fort | co-op | all at once | throw, scoop, wall, gifts and a mode vote |
| Garden Hide & Seek | co-op | good | hide or seek, one action |
| Knights & Builders | co-op | all at once | team, class, build phase and three buttons per class |
| Pillow Keep | co-op | good (fixed) | was: three buttons per class at once; now [A], [B], [C] one at a time per player after the class pick |
| Grumble Guides, Sky Hop, Laser Ducks, Golden Bean (co-op) | co-op | as above | – |
| Splash Squad | co-op | all at once | walk, aim, jump, tool change and a held throw on the first turn |
| Paint Pilots | co-op | all at once | nose, boost, paint, roll and stalling |
| Party Mix | co-op | good | each round has its own ready card with one or two actions |
| Story stages and bosses | co-op | good | built from games already played, with one co-op goal each |

## Per game: findings and suggestions

### Solo island

- **The island itself.** Aunt Hazel's tutorial is the model: one prompt per step (`isl.tut.1`–`7`: till, plant,
  water, wait, harvest, show or ship, visit Rosa). Jumping, the bag and the journal come later, each as a task.
  *Suggestion:* the hotbar's number keys and the D-pad slots could get their own one-time prompt the first time
  a second item is in the hotbar.
- **Fishing.** Cast, wait, hook, reel: introduced by doing. The reel bar's rules (press in the green, three
  misses lose the fish) are learned by losing a fish. *Suggestion:* the first reel ever could pause on the bar
  with one line ("press when the mark is in the green") before it starts moving.
- **Skipping stones and the kite.** One action each, explained by a toast. Good.
- **Hop trails.** They build on the island's jump, which the island teaches with low steps first. Good.
- **Diving.** The first dive can meet swimming, picking kelp, opening chests and (at night) the dark sea
  together. *Suggestion:* a first dive in the shallows with only kelp to pick, chests from the second
  dive on.
- **The café.** One card explains cooking and serving. *Suggestion:* the first evening only one guest, with
  the dish already cooked, so serving is learned before cooking.
- **Sky Hop.** Level 1 (Sunny Meadow) meets jump-through clouds in the first chunk, then a spring, a grumble and
  two pits in the second, a moving platform in the third; the double jump is never asked for alone.
  *Suggestion:* reorder level 1's chunks: flat ground with one-tile gaps (jump), a wall that needs the double
  jump, then the spring alone, then a single sleeping grumble on flat ground (stomp), clouds and moving
  platforms in level 2.
  **Fixed:** level 1 is now: a low block and a two-tile gap (jump), a wall 4 tiles high that only a double
  jump climbs (a single held jump reaches ~3.2), a 6-high wall with the spring alone (out of double-jump
  reach), one grumble in a little pen (stomp or hop over), pits, then a pit, a double-jump wall and a grumble
  together, and clouds last (level 2 opens with clouds). No moving platforms or crumbly blocks. A sign names
  each new thing (shown as you come near, read aloud once; skippable). Same three checkpoints; levels 2-4
  unchanged. A simple bot clears it.
- **Lighthouse Caves.** Good: the Zelda structure gates every new action behind an item (lantern, grapple
  rope, gloves, bow, bombs, fins), and signs say what is needed ("Bring a light!", "A bomb would break it!").
  The sword's spin (hold) is mentioned on the card with the item screen (hold [C]). *Suggestion:* leave the spin
  and the item screen out of the first card; show each the first time it matters (the first bush field, the
  first item).
- **The Secret of Pudding Island.** Good: one help line (`adv.help`) and the first puzzle is "talk and take".
  Using an item on something (the inventory, [C]) is needed only later. *Suggestion:* show the [C] line again,
  alone, the first time an item is picked up.
- **Laser Ducks.** One action (aim and fire). Good.
- **Bean Brigade.** Good: the first battle is a read-aloud tutorial with fixed tiles, the deploy step is
  explained once. The battle menu (rewind, hint, tips) and "hold [C] to end the turn" come with the first
  battle too. *Suggestion:* introduce the rewind in the second battle, when there is a mistake to undo.
- **Grumble Guides.** The best one-at-a-time design here: level 1 has only stoppers, level 2 adds bridges,
  level 3 stairs, level 4 digging and tunnels, level 5 everything. Fast-forward ([B]) is on the card from the
  start; it could wait until level 2.
- **Knights & Builders: The Golden Bean.** Each level adds one thing (bridges, ladders, gates, catapults,
  builders...). Alone you are the Knight-Builder with sword and building at once. *Suggestion:* level 1 alone
  could lock the sword until the first grumble appears.
- **Crystal Caves.** All at once: the card lists jump, climb, rope, pop bomb and hearts; the hazards tip
  follows as a toast; the first cave is random. *Suggestion:* a fixed first room on depth 1 (a ladder, then a
  ledge that needs the rope, then a dirt wall that needs a bomb), each with a one-line prompt.
  **Fixed (step by step):** the card names only the goal; each player then gets one prompt above their bean
  (jump, throw a rope, climb it, a pop bomb, then the hearts), each moving on when they do it; the practice
  rope and bomb are free. The first cave is still random (a fixed first room was not chosen).
- **Pillow Keep Solo.** All at once: class pick, then the first dungeon tip lists attack, class move, skill and
  the hold menu. *Suggestion:* the first floor's tip
  names attack only; the class move when the first charger appears; the skill when the first skill point is
  spent; potions when health first drops below half.
  **Fixed (step by step):** on the first floor ever, one control at a time in a box above the HUD for the
  input in use: gamepad or keys ([A] attack, [B] your move, hold [C] the menu, tap [C] your skill) or the
  mouse once it is used (click a grumble, 1 or [B] your move, I the bag, keys 5-8 the belt). Each moves on
  when it is used (the last one also after a while). Event-timed prompts (a charger, half health) were not
  chosen: the steps come in order.
- **The School House.** One action per game (run or jump to the right answer) and a level picker. Good.

### Shared island (co-op)

- **Bubble Buddies.** Blow bubbles, pop trapped grumbles, bounce on empty bubbles, escape a bubble, free a
  friend: the card names two, the rest are discovered. *Suggestion:* wave 1 with one slow grumble and the hint
  "blow a bubble at it", the pop hint when the first one is trapped.
- **Paint Party.** Walking paints, which is a perfect first action. The dash, the bomb and the grumble mud
  start at the same moment. *Suggestion:* grumble painters from 20 seconds in.
- **Spacefall.** All at once: thrust, aim, missile, dash, wrapping edges and picking missiles out of walls.
  *Suggestion:* the co-op mode's first wave with slow aliens and only the missile named; the dash prompt the
  first time an alien shoots.
- **Bonk Brawl.** Four attacks and the float on one card. *Suggestion:* name only the punch; uppercut and spin
  as on-screen prompts after the first knock.
- **Kart Party.** Steering plus automatic speed is a good first action; hop, drift and items all start with the
  first lap. *Suggestion:* items from lap 2 (or after the first box with a prompt).
- **Mega Ball and Ice Hockey.** A team picker, then three or four actions at kickoff. *Suggestion:* the first
  kickoff ever with an empty net and the kick named alone.
- **Snow Slalom.** Steering through gates is enough at first; tuck, brake, jump and push-off are on the card.
  *Suggestion:* name steering only; the ramp's orange bars could carry the "[A] jump" prompt.
- **Portal Pals.** Room 1 already needs both portals. *Suggestion:* a room before it where one portal colour
  (and a fixed exit portal) is enough.
- **Space Race.** Steer and boost; the slide is optional. Good.
- **Rooftop Rush.** Good: signs name slide, wall jump, hook and dash the first time each is needed, in that
  order.
- **Cook-Off.** Good: the easiest dish first, the others unlock during the match.
- **Bean Golf.** Good: a warm-up hole and fine aim as an option.
- **Snowball Fort.** All at once: tap and hold on one button, a snow wall, gifts, plus a three-way vote.
  *Suggestion:* the first match ever as Snow Targets on Fort Meadow without a vote, gifts from the second
  minute.
- **Garden Hide & Seek.** One action per role. Good.
- **Knights & Builders.** All at once: team, class, a 45 s build phase and three buttons per class. Name tags
  show the keys until they are used, which helps. *Suggestion:* the build phase could name only "build" for
  builders and "practise on the dummy" for knights and archers.
- **Pillow Keep.** All at once: class pick and three buttons per class in a random dungeon. *Suggestion:* as
  Pillow Keep Solo, one action per first floor.
  **Fixed (step by step):** after the class picker each player gets their class's [A], then [B], then [C]
  above their bean, each when the last one was used; the card names only the goal.
- **Splash Squad.** All at once on the first turn. *Suggestion:* the first turn of a match: water balloon only,
  no wind; the tool change from the second turn.
- **Paint Pilots.** All at once: nose, boost, paint, roll and stalling. *Suggestion:* the first 20 seconds with
  no enemy planes and a stall warning the first time the nose climbs too steeply.
- **Party Mix.** Good: each round's ready card names one or two actions and everyone taps when ready.
- **Story stages and bosses.** Good: built from games already played, each with one co-op goal.

### Skipping tutorials

Every tutorial or onboarding part can be skipped and is never forced (`core/tutorial.js`): its first card asks
"Show me how" or "I know how to play" (read aloud; with no answer for 15 s it shows the tutorial), and the
pause menu has "Skip the tutorial" while one runs. Remembered per profile (`profile.assist.tutorials`,
`tutSeen`, `tutSkipped`; guests and the shared island use the device default; old saves get "on, nothing
seen"). **Turning them back on:** Help me play → "Tutorials and tips" (off skips them all; on again shows
every tutorial again). The parent page lists "Tutorials and tips: off" and how many were skipped.

| Tutorial | How it is skipped | What skipping still gives |
| --- | --- | --- |
| Solo island: Hazel's farming steps (`isl.tut.1`-`7`) | Hazel asks after her welcome; the island menu's "Skip the farming steps" while they run; tutorials off: no question, no steps | step 8 (the story, Pip's camera and decorating wait for it); the Zip-Zap, seeds and her radish job as before |
| Sky Hop level 1's signs | the first card; the pause menu | nothing to give (the level is the same) |
| Crystal Caves' step-by-step buttons | the first card; the pause menu | – |
| Pillow Keep's step-by-step buttons | the first card (after the class picker); the pause menu | – |
| Pillow Keep Solo's step-by-step controls | the first card (first floor); the pause menu | – |
| Bean Brigade's first-battle tips | [C] "I know how to play" on the first tip; the pause menu | the battle as before; the deploy explanation is skipped too |
| Lighthouse Caves' welcome (Keeper Bram) | the first card on a new game | the intro is done (`flags.intro`), the keeper says where the sword is and goes to the lighthouse |
| Pudding Island's hello and help line | the first card on a new game | Pip stands on the dock; nothing in the story waits for it |
| Læringsmiks' how-to cards (also the School House's Klokka, Pengebutikken, Rimord) | the first card | quick cards: shown 4 s, any jump starts |
| First-time tips: Grumble Guides' level tips, Spacefall's ship tips, Snowball Fort's tips, Paint Pilots' stall tip, Rooftop Rush's signs | Tutorials and tips off | – |

Not tutorials (not skippable on purpose): Party Mix's ready cards (everyone taps when ready), the learning
games' level pickers, Lighthouse Caves' signs and item texts (world content you read when you want).
Once per save: the farming steps and Bean Brigade's tips follow the game's own save, so turning tutorials
back on does not replay them (Bean Brigade's battle menu has "Tips" any time).

### Not covered

- **Tachyon, Starlite, Foothold and Starhop** (the Game Hall's guest games): other repositories; only their
  launch is seen here.
