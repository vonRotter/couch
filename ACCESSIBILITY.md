# Accessibility: Help me play, and the audit

Couch Party Island teaches children to play video games: accessible, not necessarily easy. The assists
("Help me play", see README, Controls) widen access and leave each game's challenge and difficulty alone.
This file lists which game supports which assist, how the game offers help, and the audit against the
[Game Accessibility Guidelines](https://gameaccessibilityguidelines.com) and the
[Xbox Accessibility Guidelines](https://learn.microsoft.com/gaming/accessibility/guidelines) (XAG):
the small things fixed now and the big findings for the owner to decide.

## Which game supports which assist

Everywhere (core, every scene): **button remapping** (keyboard keys per scheme, pad buttons; every on-screen
button name follows), **text size**, **strong outlines** on players (and on grumbles, the "enemies" of most
games), **game speed** in every game (MiniGame) and in the island's activities, **instant retry** from the
pause menu (Retry restarts the same game or level with a quick title and countdown), **reduce flashing and
shake** (every fast blink: a soft glow on beans, a pulse under 3 Hz elsewhere; no camera shake), **symbols
for players and teams** (a shape next to every colour: chips, results, name tags, pickers, scoreboards,
Paint Party's bars), the **Help me play** page in every pause menu and both islands' menus.

| Game | Timing | Aim help | Hold to toggle | Offers after tries | Skip | Checkpoint / retry near the failure |
|---|---|---|---|---|---|---|
| Sky Hop | coyote time, jump buffer | – | – | falls: timing, speed, skip | level | bubble back, never behind the last of 3 checkpoints |
| Your island: hop trails | coyote time, jump buffer | – | – | put-backs: timing, speed | – (optional) | back on the top you jumped from; every top reached is a checkpoint |
| Your island: fishing | wider zone, longer bite | – | – | misses: timing, speed | – | cast again |
| Your island: skipping stones | wider green part | – | – | misses: timing, speed | – | next throw |
| Snowball Fort | – | auto-aim cone and scatter (default "a little", the old half-help) | scoop (double tap) | misses: aim, speed | – | (no knock-outs) |
| Laser Ducks | – | crosshair pull, hit size | – | misses: aim, speed | – | (rounds) |
| Spacefall | – | aim snap, curving missiles | thrust | – | – | respawns |
| Paint Pilots | – | pellets bend further | – | – | – | respawns |
| Pillow Keep / Pillow Keep Solo | longer floor warnings | shots curve | Keep Solo: block, menu (double tap) | Keep Solo: faints at an act boss: speed (2), skip (3) | Keep Solo act bosses (it gives up, loot and act kept) | Keep Solo: faint to town (unchanged by decision) |
| Lighthouse Caves | longer slime wind-ups | arrows curve, hit wider (never toward switches) | spin attack, item screen / map (double tap) | faints, restart room, torches out: timing, speed, skip | puzzle and boss rooms (it solves itself / the boss gives up; doors, chest, heart, crystal given) | faint: back at the last beacon stone, hearts full (by decision); menu: restart room (replays a skipped room) |
| Grumble Guides | – | – | fast-forward | lost levels: speed (2), skip (3) | level | try the level again |
| Golden Bean campaign | – | – | big slash, bow, dig, shield (double tap) | lost levels: speed (2), skip (3) | level | [C] tries the level again |
| Bean Brigade | (turn-based) | – | end turn is also in the battle menu | Easy: lost battles: skip (3) | battle (not the Queen) | Easy: try the battle again, rewind, undo |
| Space Race | – | – | boost, slide | – | – | – |
| Knights & Builders (Castle versus) | – | – | big slash, bow, take down, shield (double tap) | – | – | – |
| Golf, Splash, Portal Pals | – | – | power and fine aim; throw; reset (hold C) | – | – | Portal: reset room |
| Story (map and bosses) | – | – | map: back, leave; frost boss: snowball (double tap) | boss time-ups: speed (2), skip (3) | Grumble King fights (he gives up, one star) | stages |
| The Secret of Pudding Island | – | – | – | useless item uses, wrong comebacks: skip (7) | puzzles (Pip does it himself) and duels (she gives up) | – |
| Your island | – | – | hold B to leave, decorating's next thing (double tap) | – | – | – |
| Ice Hockey | – | – | charge a shot | – | – | – |
| Rooftop Rush | – | – | balloon swing | – | – | – |
| Kitchen (cook) | – | – | chopping | – | – | – |
| Mattejakt, Bokstavballonger, learning rounds | more time to answer | – | – | – | – | – |
| Party Mix: quiz, Spot the Difference | more time | – | – | – | – | – |
| Party Mix: Count the Critters | – | – | – | – | – | – (now shapes as well as colours) |
| Other games (Bubble Buddies, Paint Party, Bonk Brawl, Kart, Mega Ball, Slalom, Hide & Seek, Cave, other Party Mix rounds; Dig and Paint by Numbers: hold to toggle) | – | – | – | – | – | pause menu Retry; the games' own (Cave: fresh cave) |

## How help is offered

Off by default. Games report a failed try with `struggle(scene, player, kind, part)` and a success with
`overcame(scene, part)` (`src/core/assist.js`). Tries count per part (a level, a trail, a room) across a
level's restarts and reset when you leave the game.

- 3 tries in a row at one part: the matching assist, if it is off: **forgiving timing** (kind 'timing':
  falls, missed windows) or **aim help** (kind 'aim': missed throws and shots; a little, then a lot).
- 5 tries: a **slower game** (75 %), if the game runs at full speed.
- 7 tries: **skip this part**, where the game can skip it.
- At least 2 tries between two offers; each offer once per game visit (a skip once per part). Games where
  one try is long ask sooner (Grumble Guides, the Golden Bean campaign: speed at 2, skip at 3; Bean
  Brigade Easy: skip at 3, no speed offer in a turn-based game).
- Story games skip with a short "solved" moment and still give what gates the story: Lighthouse Caves
  rooms (you are back at the door and watch the puzzle solve itself or the boss give up: doors, chest,
  heart and lamp crystal as if solved; "Restart room" plays it again), the Story's Grumble King (he gives
  up: one star, ↷ on the map until beaten), Pillow Keep Solo's act bosses (you wake up, the boss gives up
  with its loot, the act is cleared) and Pudding Island (Pip does the right thing himself, an item he needs
  turns up in his pocket; a duel opponent giggles until she gives up). Story bosses and Keep Solo bosses
  ask sooner (speed at 2, skip at 3); the Story map and its stages share one count (`scene.struggleKey`).
- The offer is a small card over the frozen game, read aloud. It listens only after a moment (a child still
  mashing jump does not answer by accident). "Yes please" (one tap: it is the first item) turns the assist
  on for that player's profile (or the device default for a guest) and says so; "No thanks" or Back closes
  it; "Don't ask again" is saved for that kind. "Offer help when it is hard" in the page turns all offers
  off; turning it on again brings back every "don't ask again".

## Audit: small things fixed now

- **Colour-only cue:** Count the Critters asked you to count one colour; each colour now has its own shape
  on top (ball, horn, cube) and the text names it ("purple (ball on top)").
- **Unread text:** votes (question and choices, and each choice as you move), the team picker, every
  game's results (title and how it went), Sky Hop's level picker and the Help me play page are read aloud
  (when read-aloud is on).
- **Time limits:** votes wait longer with forgiving timing (25 s becomes 44 s).
- **Small text:** nothing in the shared style sheet is smaller than 12 px any more (result details, the
  learning cards' clues, player tags, join hints).
- **Menus:** with strong outlines, the picked item is marked with an arrow and a dashed ring as well as its
  colour (pause menus, votes, profile cards, level cards).
- **Retry:** the pause menu's Retry starts with a short title and a fast countdown. (Lighthouse Caves
  briefly put you back at the room you fainted in; by the owner's decision fainting goes back to the last
  beacon stone again, and the menu's "restart room" tries a room again from its door.)

## Audit: big findings for the owner to decide

1. **Flashing and motion.** *Done (owner's decision): "Reduce flashing and shake" in Help me play.* About 20 games blink a character at 7-10 Hz while it cannot be hit (Sky Hop,
   Bonk Brawl, Pillow Keep, Lighthouse, Spacefall, Castle, Cave...) and many shake the camera on big hits.
   The objects are small, so this is not a seizure risk on the WCAG scale, but GAG and XAG ask for a
   "reduce flashing / screen shake / motion" option. Suggestion: one more row in Help me play that turns
   blinking into a steady glow and switches shakes off.
2. **Sound without a picture.** Read-aloud covers text, but some cues are sound only (countdown beeps are
   also on screen; but e.g. hidden things in Hide & Seek, alien warnings, a duck flying away behind you).
   XAG 104 / GAG "provide visual means of communicating in-game sound": needs a per-game pass, or a generic
   "sound cues" indicator at the screen edge.
3. **Volume.** *Not chosen for now (owner's decision).* Only mute (M) and read-aloud on/off. XAG asks for separate music / effects / voice volumes.
4. **Colour as identity.** *Done (owner's decision): a symbol per player and team, always shown.* Players are told apart by colour plus name tags and hats; teams (Sun / Sea) by
   colour rings plus team names; Paint Party scores painted floor by colour. Suggestion: a symbol per
   player and team (like Portal Pals' portal symbols) on rings and paint, shown with strong outlines on.
5. **Hold to toggle where a button is both tapped and held.** *Done (owner's decision): a quick double tap
   holds such a button (the taps stay), the next tap lets go; Portal Pals also resets with hold C.* Snowball Fort (tap throw / hold scoop), the
   Castle knight and archer (tap / hold to charge), Lighthouse's spin attack and "hold C for the map", the
   shared island's "hold B to leave", Portal Pals' "hold both to reset", the island's decorating "hold A".
   A plain latch would break the taps; each needs its own alternative (a menu item, a second button, or
   "double tap to hold"). Bean Brigade already has one (end turn in the battle menu).
6. **Skipping in story games.** *Done (owner's decision): skips with a short "solved" moment, see above.*
   Lighthouse Caves puzzles and bosses, the Story's bosses, the Adventure's
   puzzles and Pillow Keep Solo's acts are not skippable: their items and keys gate what comes next. A skip
   would need a "the puzzle solves itself" or "the boss lets you pass" moment in each. The Story already lets
   a stage end early.
7. **Time pressure in party games.** Most Party Mix rounds and co-op games are 30-60 s timed and Sky Hop
   closes the flag 12 s after the first player. Game speed stretches them, but a "no timer" or "longer
   rounds" choice per game would help the youngest.
8. **Movement remapping and one hand.** Remapping covers the three buttons, not the stick keys, and there is
   no mouse-only or one-switch mode (Laser Ducks and Pillow Keep Solo have mouse aiming).
9. **Game-specific text in canvases and game style sheets** (some HUDs set their own pixel sizes) grows with
   the overlay zoom only where it sits in the shared overlay; a pass per game is needed for "huge".
10. **Outlines per game.** Strong outlines cover players, grumbles, ducks and Spacefall's aliens. Other
    games' own enemies, targets, interactables and platform edges need `markA11y()` calls one by one
    (Lighthouse's own monsters, Keep Solo's bosses, the Adventure's interactables, Sky Hop's edges).
11. **Pillow Keep Solo fainting** still sends you to town (by decision, with the dropped bag); with offers
    on, a "timing" or "speed" offer there would need a struggle report per floor.
12. **Shared screen settings.** *Kept (owner's decision): the most help anyone playing asked for.* On the shared island the screen-wide assists take the most help anyone
    playing asked for (one child at 50 % slows everyone). The alternative is the device default only.
