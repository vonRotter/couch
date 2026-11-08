# Couch Party Island

A game that teaches children to play video games, built with three.js: platformers, adventures,
tactics, action RPGs, racing, puzzles, party games and more, each a small game of its genre with
real challenges. Accessible, not necessarily easy: everything is forgiving (nobody is ever knocked
out), but there are learning curves and opposition to beat.

- **Your own island is the main game.** Each child has a profile and an island of their own (a
  small farming town where every game is a place you walk into, see Solo island). Progress, coins,
  rewards and read-aloud settings are saved per profile in this browser.
- **Play together is the extra.** The Party Pier ferry (or *Play together* in the menu) goes to the
  shared island, where 1–6 players on one screen join with their own controllers or keyboards, roam
  a little island, collect stars for hats, and walk onto a game pad together to start a game. Players
  who join as their profile get rewards back on their own island.

### How it starts

Opening the game shows **Who is playing?**: the player picker, with the last player already chosen.
Any keyboard or gamepad steers it: [A] on a player goes straight to that player's own island, **New
player** makes a profile (name on a letter grid with the stick, then a color), [C] switches a
profile's read-aloud (on, babble, off). **Play together** goes straight to the shared island for a
group, without a profile: the device that chose it picks who it is there (a profile or Guest).
Links: `#solo` (the guest games link back with it) opens the picker with that profile chosen;
`#together` opens the shared island directly.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # static site in dist/
```

### Deploy to GitHub Pages

`.github/workflows/pages.yml` builds and deploys on every push to `main`.
Enable it once under **Settings → Pages → Source: GitHub Actions**. The `github-pages`
environment only accepts deploys from allowed branches, so `main` must be the default
branch (Settings → General) or be listed under Settings → Environments → github-pages.
The Vite `base` is relative, so the site works from any sub-path.

## Controls

Every player has a stick and three buttons: **A** (jump, confirm), **B** (the "use" button) and
**C** (the third button: switch tool, next piece, rope and the like). No key counts as two buttons.
On-screen text always names the buttons the current players actually press: keyboard keys,
Xbox letters (A, B, X), PlayStation symbols (✕, ○, □) or Nintendo letters.
Each game shows its own controls before it starts.

| Device | Move | A (jump) | B (use) | C (third) |
| --- | --- | --- | --- | --- |
| Gamepad 1–4 | Left stick / D-pad | A / Y (✕ / △) | B, RB, RT (○) | X, LB, LT (□) |
| Keyboard 1 | W A S D | Space | E | Q |
| Keyboard 2 | Arrow keys | Enter | Right Shift | Right Ctrl |
| Keyboard 3 | I J K L | U | O | P |
| Keyboard 4 | Numpad 8 4 5 6 | Numpad 0 | Numpad . | Numpad Enter |

**Menus (every game):** A picks, B goes back. A gamepad's B never picks anything: not in the pause
menu, the shared island's menu, the player picker, the join card, the School House, shops, questions in dialogs, item and skill panels, quest
boards, the gate, map, level, squad and difficulty pickers, votes or result screens (it closes or goes
back, or does nothing where there is nowhere to go back to). Start opens and closes the pause menu.
Keyboards pick as before: the jump key, and in most menus also the use key (E), which is how the pause
menu picks; `Esc` closes it. The solo island has its own gamepad layout (A jump, X use, B back,
D-pad for the hotbar, bag and journal, Start for the menu): see Solo island, Controls. Hints name
the buttons of every kind of pad (Xbox A/B/X/Y, LB/RB, Start; PlayStation ✕/○/□/△, L1/R1, Options;
Nintendo B/A/Y/X, L/R, +).

| Menu | Gamepad | Keyboard 1 |
| --- | --- | --- |
| move | stick or D-pad | W A S D |
| pick | A (✕) | Space, or E where it picked before (pause menu, the shared island's menu) |
| back / close | B (○) | the menu's back key (E in game menus that already went back with E, Q on the solo island, `Esc` for the pause menu) |
| pause menu | Start (Options / +) | `Esc` |

- On the shared island, press A on any device to join (up to 6 players). With profiles in this
  browser a small card asks **Who are you?** next to the others: a profile (each profile only once at a
  time; taken ones are marked *playing*) or **Guest**; A picks, B goes back. Profiles bring their name,
  hat and color (if nobody has that color yet, else a free one); guests get a free color. Without any
  profiles, A joins as a guest right away. Color pots, swap pads and the hat stand work for everyone and
  last for the visit (a profile's own look is kept on its island). Press C for the menu: **Keep
  playing**, **Story** or **Home** (the ferry home, below).

**Paint Pilots** (side-view biplane dogfight, inspired by Triplane Turmoil and Luftrausers). Vote
on Free for all, Teams or Co-op against waves of grumble planes and blimps ending with the King Blimp.
The stick points the nose, A boosts, B fires paint pellets and C does a barrel roll that dodges
paint. Climb too steeply or too slowly and you stall: the engine sputters and the nose drops until
you pick up speed again. Three paint hits and you parachute down in confetti and are back in the air
3 seconds later; crashing is just a puff. Land gently on the runway to wash the paint off.

**Laser Ducks** (classic Duck Hunt with laser guns; on both islands). Vote Game A (one duck), Game B
(two ducks) or Clay Shooting, and with 2+ players Team or Versus. Every player has a crosshair in
their color (stick, with a little aim assist) and fires a laser with A; on a computer the mouse aims
and clicks for player 1, like a light gun. Three shots per flight, ten ducks per round, and each round
needs a rising number of hits (6, then 7, 8 and 9); miss it and the game is over. The dog fetches
what you hit and laughs when everyone misses. The best score is saved (per profile on the solo island).

**The Secret of Pudding Island** (solo island; a Monkey Island-style point-and-click adventure, two
scenes so far). Pip, a small bean with a wooden spoon and a lot of confidence, wants to be a pirate.
Scene 1, The Dock: a seagull for a hat and pet, and Tickle Fencing against Harbor Master Grumbleton.
Scene 2, All Hands on Deck: raise the half-sunk ship, find a sail and recruit a crew, in any order;
lose to Granny Grumbleton, learn her comebacks from her giggly pupil, then beat her. Move the pointer
with the stick (or the mouse): A does the obvious thing (talk, take, use, walk), B looks, and C opens
the inventory to use an item on something. Dialog choices, speech bubbles read aloud, progress saved
per profile; the title card offers Continue or New game. Rooms, characters, items and dialog are data
in `scenes/adventure/`, so more islands can be added without changing the engine.

**Lighthouse Caves** (solo island; a top-down Zelda-style adventure with metroidvania structure, the
whole first act). The old keeper's lighthouse went dark and its three lamp crystals were taken into
the caves. Explore the island (13 screens, a village with a shop, caves and side quests), then the
Lantern Cellar (Lantern), the Tidepool Grotto (Grapple Rope), the Old Well (Strong Gloves) and the
Stormcliff Ruins (Wind Bow, with fire arrows through lit torches), plus Bombs and Swim Fins from the
island. Each dungeon has keys, a map, a compass, a big key, a mini-boss and a boss with telegraphed
phases; the finale is a fight against the Gloom at the top of the lighthouse, then an ending and
credits, and the island stays open: 12 heart pieces and 10 golden shells to find. Stick to walk, A
sword (hold for a spin), B talk/lift/throw/open, C use the item (hold C for the item and map screen,
with "restart room"). Beacon stones save; fainting sends you back to the last one with your items.
Progress is saved per profile (part-1 saves carry over).

**Bean Brigade** (solo island; an Into the Breach-style tactics game, the mech garage on the east hill).
Three toy bean mechs keep island villages safe from big goofy bug-grumbles on an 8x8 board. The bugs
move first and show exactly what they will hit next turn (red marks and arrows); your turn comes
before their attacks, so push them off their mark, into water (they sink), into each other (bonk!),
block a spitter's goo, smoke them, or stand on a dirt mound to stop a new bug from coming up. Every
weapon shows a full preview first: damage, push arrows, what pops and where the bugs will attack
afterwards. Houses that get hit cost grid power, shared over the whole campaign. Pick Easy (every
bug plan shown, unlimited move undo, one rewind per battle, +2 grid power for every battle won, a lost
battle is just tried again) or Hard (one undo per turn, no rewind, +1 grid power for every battle won,
an empty grid restarts the campaign); on both, clearing an island gives +2 grid power and a battery
kept safe gives +1. Then pick one of three squads: the Bonk Squad (punch, cannon, mortar), the Twisty
Squad (hook, swap, laser; the Grabby Mech has 4 hearts and the Switcheroo Mech's first upgrade swaps
3 tiles away) or the Bubble Squad (bubble shields, smoke dash, boulders). Clover Isle, Sandy Isle and Frosty Isle have 3 or 4 battles
each (sand makes smoke, ice cracks into water, forests burn), then the Grumble Queen waits at the
Grumble Hive. Six bug types: beetles, goo spitters, diggers, fire flies, boom bugs and the queen.
Stars from battles and bonus objectives buy upgrades between islands (+hearts, +steps, better
weapons). Before every battle except the first (First Day keeps fixed tiles) comes a deploy step:
the bugs already show their first attacks and the spawn mounds are out, and you land each mech on a
glowing tile of the map's landing zone (6-8 tiles; stick moves the cursor, A lands the next mech or
picks a landed one up again, B takes the last one back, then A on Start! or hold C). The suggested
tiles are the old fixed ones (a retry suggests last time's), so A three times and Start! always
works. Stick moves the cursor, A picks, walks, aims and confirms, B goes back or undoes a move,
tap C for the battle menu (rewind, a helper-bean hint, tips), hold C to end the turn. The first
battle has a short read-aloud tutorial, and the first deploy step is explained aloud once. Progress
is saved per profile between battles: leaving in the middle of a battle (pause menu, End game)
starts that same battle again next time, with the grid power you had before it.

**Pillow Keep Solo** (solo island; a single-player Diablo-like, the keep tower on the west bank). Pick
a hero, each with its own save: the **Pillow Knight** (melee, lots of health; main stat Strength), the
**Feather Archer** (arrows from afar; Dexterity) or the **Bubble Wizard** (bubbles that trap, spells,
lots of mana; Magic). It plays with mouse and keyboard like Diablo (the gamepad still works):

| Mouse and keyboard | |
|---|---|
| Left click the floor (hold to keep walking) | walk there, on a path around walls |
| Left click a grumble, nest or boss (hold to keep going) | walk up and attack it; held, it stays your target even when the pointer slides off it (the whole grumble and a little around it is clickable) |
| Left click an item name, chest, locked door, portal, person or shop | walk there and use it |
| Shift + left click | attack in place toward the pointer (at the grumble under it) |
| Right click | the skill on the right button, cast at the pointer (at the grumble under it; shots lead a walking grumble) |
| 1 2 3 4 | the four hotbar skills, cast at the pointer |
| Walking with the keys and clicking a grumble | it stays your target: the attack comes as soon as it is in reach |
| 5 6 7 8 | drink / read from the belt column (a belt worn gives a second row) |
| Alt (hold) | names of everything on the floor (rare and better always show) |
| I / C / T | bag / hero page (stat points) / skill tree; Esc closes |
| Mouse wheel | zoom out a little (never closer than the normal view) |
| The keyboard player's own keys (WASD, Space, E, Q) | still walk, attack, class move and skill like the gamepad; with the mouse in use, Space attacks toward the grumble under the pointer |

| Gamepad | |
|---|---|
| Stick | walk (aim help on attacks) |
| A | attack (talk and use in town) |
| B | the class move: block (hold), dodge roll, bubble hop |
| tap C / hold C | the skill on C (picks up gear you stand on) / menu: skills (choosing one puts it on C and the right button), potions, Town Portal, bag, hero page, skill tree |
| In panels | the stick moves a hand pointer, A clicks, C right-clicks, B closes |

The HUD has a red health orb and a blue mana orb with the belt, the mouse buttons and keys 1-4
between them, and badges for unspent points. Skills cost mana (it comes back slowly; blue potions
refill it) and big ones have a short recharge. Every level gives 5 stat points (Strength, Dexterity,
Magic, Vitality: +1% damage per point of the main stat, +2 health per Vitality, mana from Magic,
attack speed from Dexterity, armor from Strength) and a skill point; each class has a tree of ten
skills with ranks 1-5 (Knight: Cushion Block, Big Bonk, Pillow Spin, Pillow Rush, Thick Stuffing,
Feather Quake, Pillow Leap, Pillow Power, Brave Cheer, Pillow Avalanche; Archer: Dodge Roll, Snooze
Arrow, Feather Fan, Big Arrow, Sharp Eye, Feather Rain, Feather Trap, Light Feet, Owl Friend, Star
Arrow; Wizard: Bubble Hop, Soap Bolt, Bubble Ring, Bubble Bomb, Deep Thoughts, Snooze Cloud, Bubble
Shield, Soapy Power, Bubble Storm, Big Splash). Gear can need stats ("Needs 25 Strength", red when not
met). The bag is a Diablo grid (10x4; charms and potions 1x1, helmets, gloves, boots and orbs 2x2,
belts 2x1, armor, bows, quivers, big pillows, staves and big shields 2x3, pillows and wands 1x3):
drag and drop or click to pick up and put down (swapping with the item under it), right click to
wear or drink, Ctrl+click to the stash or to sell at a shop, and a tooltip that compares with what you
wear (green ▲ = better). Gold is just a number (walk over coins). Magic and better items drop
unidentified: Old Snorewell the sage identifies them for coins (and resets stat and skill points for
coins), or read an Identify scroll and click the item. Town Portal scrolls (Auntie Fizz sells them,
grumbles and chests drop them) open the portal home and back to the same spot.

Pillowby has Bolster's forge (upgrade gear up to +5 with coins and fluff, salvage into fluff), Auntie
Fizz's shop (red and blue potions, scrolls, a potion belt, mystery boxes; sell here), the 14x10 stash
shared by the profile's three heroes, the quest board, the sage and four more townsfolk with jokes;
everything they say is read aloud. The gate leads to any floor reached: four acts of three random
floors (Pillow Fort Cellars, Feather Forest, Bubble Bath Grotto, the Dream Keep) ending in Big Teddy,
Honk the Goose, Captain Quack and the Sleepy Sheep (every boss attack is painted on the floor first),
then the endless Deep Keep. Dungeons are dark with a warm light circle around the hero (bigger with
"+light radius" gear and next to torches); town stays bright. Champion packs (blue names, shared
modifiers, a sure item from the last one), unique grumbles (gold names, followers, 1-2 better items)
and twelve hand-made named uniques (three per act, such as Sir Snorts-a-Lot and Admiral Rubberducky)
have modifiers: fast, extra tough, jelly trail, bubble shield, blinking, sleepy aura, splitter. Gear is
rarer than in co-op (about 3-4 items per floor: most drops are coins, potions and scrolls). Beating the
Sleepy Sheep opens **Nightmare**, and on Nightmare **Hell**: all four acts again (and their own Deep
Keep) with stronger grumbles, more modifiers and higher item levels (marked ☾ and ✹). At zero health
you faint and wake up in town; your bag (not what you wear, not the belt, never the stash) waits where
you fainted until you walk over it, and only the newest dropped bag is kept. Old saves load into the
new bag (what does not fit goes to the stash, then a lost-and-found chest in town) with their points
to spend. Progress is saved per profile.

**Story** (the co-op campaign): the big book on the meadow south-west of the playground on the shared
island (or Story in the C menu); leaving the Story returns to the shared island at the book.
- On the island: tap B next to a ball to pick it up; hold B and let go to throw (longer hold, further throw). Hold B when you are not carrying anything to leave.
- In a game, `Esc` (or Start on a gamepad) opens the menu: Resume, Retry (same game, same Sky Hop level) or End game (back to the island). Pick with A (on a keyboard also E); a gamepad's B, `Esc` or Start closes it. On the island `Esc` shows help. `M` toggles sound.
- `N` switches between English and Norwegian (bokmål), or jump on the flag on the island. The choice is saved.
- `G` shows or hides the learning games, or jump on the green book button.

### Colors

Walk into (or jump into) a paint pot near the plaza to take that color, if nobody has it.
To trade colors with someone, each of you stands on one of the two swap pads and both tap B.

Chromium-based browsers report at most 4 gamepads, so 5–6 players need at least one
keyboard scheme. Two keyboard players fit comfortably on one keyboard. The schemes use
different keys, so a second USB keyboard spreads players out. Some keyboards drop key
presses when many keys are held at once (ghosting).

## The games

**Island hub** (the shared island). The game pads sit in a ring along the shore, each with a floating 3D icon
of its game. A game starts when at least half the players stand on its pad. Two more pads stand
off the ring: the **Story** (a golden book pad on the meadow) and the **Ferry home** on the south
beach, with the Party Pier ferry waiting at its dock: it takes player 1 (who joined first) home to
their own island, landing at the Party Pier, or back to the player picker when player 1 is a guest.
Arriving by ferry, you appear just up the beach from it. The middle of the island is a playground:

- four throwable balls, a basketball hoop (baskets are counted and saved) and a bowling lane
  with six pins (knock them all down within 3 seconds for a strike);
- a trampoline, a bouncy mushroom, a stump staircase and two swings (walk onto a seat to
  ride, A to let go and fly);
- a kickable beach ball and 16 stars to hunt. Each island star can be collected once; collected
  stars are saved and never come back (more stars come from finishing games).

The settings corner south of the plaza has the paint pots, the color swap pads, the hat
stand, the learning-games button and the language flag. Stars (from the island and from
finishing games) unlock hats: party hat, flower, bunny ears, propeller cap, top hat and
crown. Stand by the hat stand and press B to try on the next unlocked hat (bumping into it also
changes hat once).

**Votes before a game.** Several games start with a quick vote: everyone moves to an option
with the stick and taps jump. Most votes wins; a tie, or a winning "Random", picks at random.
Space Race and Kart Party vote on laps (1, 2, 3 or 5), Mega Ball, Ice Hockey and Snowball Fort
on match length (1:30, 2:30 or 4:00), Party Mix on rounds (3, 5 or 7) and Bean Golf on holes
(3 or 6). Retry from the pause menu keeps the choice.

**Bubble Buddies** (co-op arena, Bubble Bobble style). Blow bubbles (B) to trap the
grumbles, then pop the bubbles for fruit. Jump on empty bubbles to bounce higher. Popping
trapped bubbles near each other sets off a chain. If a grumble touches you, you float in
a bubble for a moment. Mash buttons to escape, or a friend can touch you to free you.
The gap in the floor wraps you to the top. 3 waves; if a wave drags on, the last grumbles
fall asleep.

**Sky Hop** (co-op platformer, 4 levels). Sunny Meadow, Candy Clouds, Autumn Woods and
Sunset Castle, picked from a level select (finish one to unlock the next). Double jump,
springy mushrooms, moving platforms, lifts, crumbling blocks and clouds you can jump up
through (down + A drops through). Stand on friends' heads. If you fall or get left behind,
you float back to the group in a bubble. Bump into a grumble and you are only pushed back;
stomp it for gems. Once someone reaches the flag, everyone else has 12 seconds. After a
level: A for the next level, B for the island.

**Paint Party** (free-for-all, 60 seconds). Walk to paint the floor. A dashes (and shoves),
B lobs a paint bomb. Grab the golden paint can for a Mega Brush. Most floor wins. Grumble painters smear grey mud over the floor (yours too), and mud has to be painted over again. Dash into a grumble or hit it with a paint bomb to make it dizzy and drop its brush. There are more grumbles with more players, and more join during the match.

**Spacefall** (TowerFall-style arena shooter with tiny spaceships; it replaces Balloon Archers and
the separate Spacefall repo). Vote a mode: Last ship standing (first to 3, 5 or 7 round wins),
Free-for-all frenzy (1:30, 2:30 or 4:00 with quick respawns) or Co-op vs aliens (7 waves ending with
the Hive Queen). Then vote one of seven maps: three single-screen arenas whose edges wrap (Derelict
Hub, Ice Drift, Treetop Grove) and four big stations in split screen (Cargo Bay 7, Kessler Belt, Hive
Hulk, Gravity Failure: halves for 2, quarters for 3–4, a 3x2 grid for 5–6, with a map overview in a
spare cell). The stick flies and aims (a gamepad's right stick can aim freely), A thrusts on gravity
maps and boosts in zero-g, B fires a missile and C dashes, which makes you untouchable for a moment
and catches missiles out of the air. Missiles stick in walls: fly over them to pick them up (an empty
rack reloads one after 5 seconds). On gravity maps you can stomp ships and aliens by landing on them.
Crates hold missiles, a shield or triple shots. Popped ships burst into a cartoon explosion and the
pilot floats away in an escape bubble. In co-op, a teammate out of lives floats in a bubble until
someone flies into it. One or two players get grumble bot pilots; a solo co-op pilot gets a Grumble
Buddy.

**Bonk Brawl** (free-for-all, Smash style). Tap B to punch, up+B for an uppercut, down+B to
spin, hold B to charge a big punch. Damage % makes you fly further. Everyone has 3 lives;
fall off the island and you lose one. You get 3 jumps and holding A while falling floats
you down slowly. Players who are out become bubble ghosts that can still give small pushes.
Playing alone adds a Bonk Bot.

**Kart Party** (split-screen racing, laps by vote). Each player gets their own chase camera
(up to a 3x2 grid). The kart drives forward on its own: steer with the stick, stick down to
brake, A to hop, and hold A while steering to drift for a mini boost. Drive through rainbow
boxes for items (B): Zoom boost, Banana, or a Bubble that floats a rival for a moment.
Players further back get more boosts and a little extra speed, and the track edges steer
you back on course.

**Mega Ball** (team football, Rocket League spirit). A giant ball and two teams, Team Sun
and Team Sea. Players are split automatically; before kickoff anyone can switch side with the
stick, and everyone taps jump when ready. B kicks the ball when you are close (otherwise it
is a dash), A jumps so you can head it. If the teams are uneven, the smaller side gets a helper
keeper, a friendly one that reacts late and leaves the corners open. The ball is a big striped
play ball. Match length by vote; a draw goes to "next goal wins".

**Ice Hockey** (team hockey on a rounded rink). Same team picker as Mega Ball. Skate into
the puck and it sticks to your stick. Hold B to wind up and let go to shoot; shots aimed
roughly at the goal get a little help. A dashes, and dashing into the puck carrier steals
the puck (a fresh carrier is safe for half a second). Without the puck, B pokes it away from
someone close by. The puck bounces off the boards, and you can skate behind the goals. An
uneven or solo team gets a Goalie Bot that saves about half the hard shots. Match length by vote,
with golden-goal overtime.

**Snow Slalom** (race, shared camera). Everyone skis down the same steep hill at once; the camera
looks down the fall line into a valley with mountains. Steer
between the red and blue gates: each gate you pass is a point, and finishing earns a bonus
(1st place most). Missing a gate only costs that point. Stick up to tuck (faster), stick down
to brake, A to jump (snow ramps with orange bars launch you), B to push off for a short boost. Snowmen bump you
aside. Anyone who falls far behind floats back to the pack in a bubble.

**Portal Pals** (co-op puzzle, 4 rooms). Top-down rooms. A and B shoot your two portals onto
white walls; walk into one to come out of the other. Anyone can use anyone's portals.
Buttons open doors while someone (or a box) stands on them. Push boxes, even through
portals. Everyone has to reach the gold exit. Hold A+B to reset a room. Each player's portal pair has its own symbol as well as a color (star, heart, moon, drop, lightning bolt, diamond), also drawn on the floor in front of the portal; standing next to a portal shows a trail of symbols to its partner.

**Space Race** (split-screen 3D, laps by vote, 14 rings per lap). Every rocket has its pilot bean in a
glass dome. The flight model borrows the feel of Tachyon-style arcade flight: turn rates ease in
and out with a little inertia, the velocity chases the nose, and holding **B** slides, which keeps
your momentum while the nose swings freely (handy for lining up the next ring). Hold **A** to boost
from a tank that refills on its own; flying cleanly through a ring tops it up.
Pitch is limited and the ship never rolls upside down, so nobody gets lost. A small arrow
(only on your own screen) points to your next ring. Asteroids bounce you off gently, and if you
drift too far from the course you float back to the last ring in a bubble. Players further back
get slightly more top speed.

**Rooftop Rush** (side-scrolling speedrun race, shared camera). Race over the rooftops to the
flag. **A** jumps, and also kicks off walls (wall jump). Stick **down** slides, which keeps your speed
and gets you under billboards. **B** dashes (once per jump in the air). **C** near a balloon hook
grabs it: hold C to swing, let go (or press A) to fly off. Signs name each move the first time it is needed: slide tunnel, wall-jump chimney, hook
gap, dash gap, then a spring to a high road or a slide through the low road, and a final hook and
chimney. Speed pads push you to 18 m/s. The camera follows the leader; anyone who falls or drops
off the left edge floats forward in a bubble to just behind the leader (it takes at least 1.5 s),
so nobody gets stuck. After the first finisher, the others have 12 seconds, and the race ends
after 150 seconds regardless.

**Cook-Off** (co-op kitchen, 3 minutes, Overcooked style but forgiving). Every match picks 3–4 random
ingredients (from 12) and a menu of 2–4 dishes made from them (from 36), in a random kitchen. A recipe
card at the start shows each dish and its steps as pictures: raw, chopping board, frying pan or pot.
A picks up, puts down and serves; hold B at a board to chop. You start with the easiest dish and
the others unlock during the match. Pots and pans never burn, and an expired order just walks
away. Order speed and dish difficulty grow with the number of players.

**Bean Golf** (mini golf, 3 or 6 holes by vote). Everyone putts on the same hole at once: the stick
aims, hold B for fine aim, hold A to charge and let go to putt. Six candy holes: warm-up, bumper
bend, windmill, big jump, sliding blocks and a loop. Falling off costs a stroke, 8 strokes puts the
ball in for you, and once the first ball drops the others get 25 seconds. Obstacles such as the windmill turn see-through when a ball is behind them, and balls show through walls as an outline.

**Snowball Fort** (two teams; vote on mode, map and length). Modes: Snow Targets (hit the other
team's bells, flags and snowman heads; a gold target is worth 3), King of the Hill (score while only
your team stands in the ring; on some maps the hill moves) and Capture the Flag (carry their flag
to your home pad; first to 3). Maps: Fort Meadow (a gentle hill, rocks and ice blocks), Frosty Creek
(a creek with two bridges and a see-through ice tunnel) and Glacier Peaks (a central peak, ice walls
and slippery lanes). Tap B to throw (gentle auto-aim), hold B to scoop snow, A builds a snow wall,
and C uses a gift: giant snowball, triple throw, speed boots, instant fort or freeze bomb. A hit
makes a player slip for a moment and drop a flag they carry; nobody is knocked out. Helper bots
even out the teams and play each objective.

**Garden Hide & Seek** (one seeker per round). While the seeker looks away from the screen for
9 seconds, everyone else turns into a garden prop (gnome, pumpkin, bush, flower pot, watering can)
next to identical decoys. Then the seeker has 45 seconds to check props with A; a decoy just
says boing. Hidden players wobble when they move, and now and then one giggles. Everyone seeks
once (up to 4 rounds); with 5–6 players the final score evens out who got to seek. Solo play is
you seeking grumble bots.

**Knights & Builders** (two teams, match length by vote; a kid-friendly take on King Arthur's
Gold). A side-view map with terrain you can dig and build, and a stone fort with a flag for each team.
After the team pick, everyone chooses a class: Builder (B builds wood blocks, doors, ladders and
bounce pads where you aim, hold B to take a block down, C picks the next piece), Knight (B swings a
foam sword, hold for a big slash, C raises a shield that also glides) or Archer (hold B to draw
suction-cup arrows, C shoots a rope arrow to climb). The first 45 seconds are a build phase behind a
magic wall. Then grab the other team's flag and carry it to yours. Foam hits only push and wobble;
three hits (or one big slash) floats you home in a bubble for 3 seconds. Helper bots even out the
teams. A builder sees a preview of the piece in their color where it will go; name tags show each player's own keys until they get the hang of it.
**Playing alone** (one player and bots) there is no class to pick: you are the **Knight-Builder** and fight
and build at the same time: B swings the foam sword (hold for a big slash), C builds where you aim (hold C to
keep building, or on a block to take it down), stick down + B picks the next piece (no shield). With two or
more players the classes stay as above.

**Knights & Builders: The Golden Bean** (co-op campaign; vote Campaign on the Knights & Builders pad).
All players on one team, each with a class. Bean troopers march toward the Golden Bean Princess on
their own: build bridges and ladders, pull gate levers, break cages to free captured troopers, stop
pillow catapults and bonk the grumble knights, archers and builders (builders repair their walls and
take your ladders apart). Enough troopers must get home, more with more players. Seven levels on a
level map, each introducing something new: Bridge Meadow, Ladder Cliffs, The Gatehouse, Pillow
Towers, Busy Builders, The Grand Siege and Castle Grumblegrump, where the princess waits. Up to 3
stars per level (goal, every trooper home, within par time); progress is saved. Bonked grumbles
float home and, after a few times, turn friendly; in the end everyone goes to the princess's party.
Alone you are the Knight-Builder here too (B sword, C build, stick down + B next piece; no class pick, the
sword smashes grumble doors and the hammer still bonks); a tent turns you into the archer and back.

**Pillow Keep** (co-op dungeon crawl on the shared island, Gauntlet and Diablo style, five random
floors; the solo island's keep tower starts Pillow Keep Solo instead). Everyone picks
a class: Knight, Archer, Wizard or Bard. Every run builds new floors with rooms, keys and doors,
pillow nests, chests and elite grumbles: Cushion Hall, Blanket Vaults, Toy Attic (Big Teddy guards
the stairs), Moonlit Library and the Sheep's Bedroom (Sleepy Sheep). Loot (weapon, hat, slippers,
cape; white, blue or gold) is put on automatically, and only when it is better. The team shares XP,
levels up together and learns skills at levels 3, 5 and 8. Grumbles come as chargers, throwers,
shields and named elites. Every boss attack is drawn on the floor in pink before it lands, so it can
be dodged. A grumble touch fills your yawn meter; a full meter means a nap until a teammate taps you
(C) or a few seconds pass.

**Grumble Guides** (co-op puzzle, Lemmings style, 5 levels). Grumbles pop out of a hot-air balloon
and march along; guide enough of them home. Every player has a cursor ring: A gives the grumble under
it the current job, C switches job, and holding B runs the game at triple speed. Jobs: Stopper (A
again lets it go), Bridge, Stairs, Dig down, Tunnel and Umbrella; the job bar shows what is left.
Grumbles never get hurt: a long fall bounces them back up dizzy, and water floats them back to the
start in a bubble. 1 to 3 stars per level (goal, halfway to everyone, everyone home); levels unlock in
order and progress is saved.

**Splash Squad** (two teams, turn based, Worms style). Beans on a cookie-and-cake island over the
sea take turns: 20 seconds to walk (stick), jump (A), pick a tool (C) and hold B to charge a throw.
Tools: water balloon (blown by the wind, which changes every turn), bouncy ball (three bounces), candy
plank (build a bridge or a wall) and big bubble (floats a bean gently away). Splashes bite craters
out of the island and push beans; the wetter a bean, the further it slides. A bean that falls in
the sea gives the other team 2 points and floats straight back home in a bubble, and walking never
takes you into the water. Grumble bots even out the teams; solo is you against two bots. Walking climbs small steps on its own and hops onto low walls; jump goes forward when you hold a direction. The active bean glows and the top bar shows that player's keys.

**Crystal Caves** (co-op cave run, Spelunky style, three depths). Every run is a new cave stitched
from hand-made rooms, and each one is checked to be passable without ropes or bombs before you see it.
Run, jump (A) and climb ladders, vines and ropes. B shoots a rope up (down+B hangs it over a ledge),
and C drops a pop bomb that breaks dirt and only bounces players. Collect gold and gems, and carry
the lost puppy on your head to the exit for a team bonus. Hazards are soft: bouncy mushrooms, mud,
sticky honey and rolling snowballs; a long fall only makes you dizzy. Stragglers float to the leader
in a bubble, sparkles show the way after a while, and nobody is ever out. Dangers: spikes, hot goo (icy water in the frost cave), crumbly floors, falling stalactites (they shake first), swooping bats, patrolling grumbles, pea plants and rolling boulders. Each player has 3 hearts; jumping on a bat or grumble makes it dizzy instead. At zero hearts you become a ghost who floats along with the others until the next depth, where you come back with 3 hearts. If everyone becomes a ghost, the depth restarts with a new layout.

**Story** (co-op campaign, a place on the shared island: the golden book pad). A map of four floating lands
(Sunny Meadow, Frosty Peaks, Castle Kitchen and Starry Space). Each land has three stages built from
the island games with a co-op goal (for example "together, paint a share of the floor" or "everyone reaches the flag") and
one to three stars, then a Grumble King boss: bounce on him when he is dizzy, ring the bells on his
snow fort, serve him the right cakes, and fly through his bubble rings. He always ends up dizzy and
giggling, never hurt. Stick left/right picks any unlocked node, A starts it, and hold B to go back
to the island. Progress is saved; retry from the pause menu keeps the stage settings.

**Party Mix** (3, 5 or 7 short rounds by vote, from a pool of 20). A running scoreboard follows
each round. Before each round a card explains it and everyone taps jump when ready.
Each round gives placement points (4, 3, 2, then 1 for everyone else, ties share the higher
number). Nobody is ever knocked out of a round.

- **Count the Critters**: grumbles run past; count only the color on the sign, then dial in
  your guess with the stick. Closest wins.
- **Statue Stop**: walk toward the owl while it looks away and freeze when it turns. Moving
  while it watches only hops you back a few steps.
- **Musical Cushions**: dance while the music plays; when it stops, cushions pop up at new spots
  (one fewer than players). Five songs, a point per cushion.
- **Fruit Catch**: catch falling fruit in the basket on your head (golden fruit is worth 3);
  rotten apples slow you down for a moment.
- **Copy Dance**: watch the teacher's arrow dance, then repeat it with the stick. Four dances,
  3 to 6 moves long.
- **Tug of War**: two auto-split teams mash jump to pull the rope; the losing team slides into
  the paint pool. Team pull is averaged, so uneven teams are fair. Solo play adds a Tug Bot.
- **Bean Tower**: take turns dropping a sliding block onto the tower. Overhangs are trimmed off,
  a perfect drop snaps into place and widens the block a little, and a miss only costs the turn.
- **Hot Potato Picnic**: pass the ticking cream pie by bumping into someone; when it goes off,
  everyone else gets a point.
- **Lily Pad Hop**: hop across a pond on logs and lily pads (some sink for a moment); a splash
  just sends you back to the bank.
- **Bumper Boats**: bump each other out of a shrinking pool; falling out costs a point, bumping
  someone out earns one.
- **Keepy-Uppy**: co-op, keep the balloons in the air by jumping into them.
- **Treasure Dig**: hold A to dig; sparkles get warmer near buried treasure (chest 3, coin 1, boot 0).
- **Rhythm Drums**: hit A and B notes on the beat in your own lane.
- **Balloon Pump**: pump with A, bank with B; every balloon pops at a secret size.
- **Mirror Maze**: race to the star; colored floors flip your controls while you stand on them.
- **Spot the Difference**: two dioramas side by side; mark the differences with your cursor.
- **Paint by Numbers**: calm co-op, load a numbered paint and paint the matching cells. A wrong color sticks (with a red frame) until someone paints the right one over it, and costs a point.
- **Follow the Leader**: stay on the leader's glowing trail; everyone leads in turn.
- **Quiz Run**: run to the right answer zone. Players first vote on the kind of quiz: Pictures (49
  picture puzzles for small children, read aloud; B repeats the question), Mixed, Classic (kids'
  and grown-up questions) or Grown-up.
- **Paint Trails**: steer a paint roller that never stops; its wet stripe fades after a few
  seconds. Bumping into a stripe or the wall is a splat and a short respawn; points for time on
  the road and for others splatting into your stripe.

## Learning games (LÆRING)

Three educational games in Norwegian (bokmål), marked with a green **LÆRING** badge on the
shared island, and all of them (plus the quiz) in the **School House** on every child's own island
(see Solo island), where each child keeps their own level and progress. Jump on the green book button in the settings corner (or press `G`) to show or hide them;
the choice is saved. Before each round every player picks their own level (Lett, Middels,
Vanskelig), so younger and older kids can play together. Mistakes never cost anything.

**Bokstavballonger** (spelling). Letter balloons drift slowly across the sky in four lanes,
coming in from the sides, so every letter can be read before anyone reaches it. Each player has
their own word with blanks and a clue at the bottom of the screen; jump up to the balloon with the
next missing letter. The lowest lane is above head height, so nothing pops by accident. Lett: 3-letter words, one blank. Middels: 4-5 letters, two blanks. Vanskelig: longer
words, only the first letter shown. The letter you need always floats by. Finished words are
read aloud if the device has a Norwegian voice.

**Mattejakt** (math). Number coins lie on a field. Each player's problem floats above their
head; run to the coin with the answer. Lett: adding within 10. Middels: adding and
subtracting within 20. Vanskelig: times tables and adding/subtracting within 100. Every
player's answer is always somewhere on the field. Word lists live in
`src/scenes/edu-words.js`.

**Læringsmiks** (three rounds in a row). *Klokka*: read the clock floating over you and walk to the
right time ("kl. 3", "halv fire", "kvart over to", "ti på halv fem"). *Pengebutikken*: pay the exact
price with real Norwegian coins (a coin that would overshoot just hops away): Lett uses 1 and 5 kr
(prices 2–10), Middels adds 10 kr (5–20), Vanskelig adds 20 kr (10–50). *Rimord*:
walk to the word that rhymes with yours. Each player picks their own level first. In all the
learning games the right answer is usually already on the field among other choices, so it is not
simply the newest thing to appear.

## Solo island

The main game: every child's own island, opened by choosing their profile in the player picker (see
How it starts; *Change player* in the island's menu switches). Each child picks or creates a
**profile** (name typed with the stick on a letter grid, and a color); everything on the solo island
is saved per profile in this browser.

**Play together: the Party Pier.** A short jetty off the east side of the pier, near the beach, with a
red-and-white party ferry at its end (the dive boat, Grumbleton's sailboat to Shell Isle and the pirate
ship keep their places). On the jetty, [B] (X on a gamepad) asks *Go now?* and the ferry takes you to
the shared island, already joined as player 1 with your name, color and hat; friends join there with
their own devices. *Play together* in the island's menu ([MENU]) does the same. The shared island uses
the shared saves; the solo games there are the co-op versions (Pillow Keep, Knights & Builders, Crystal
Caves, Grumble Guides): the versions on your own island stay the main ones, with your own saves and
progress, and the co-op versions never write to them. The ferry home lands you back on the jetty.

**Rewards for playing together.** Every player who joined the shared island as a profile (not guests)
gets something back on their own island when a co-op game is finished (its results screen; ending a
game from the pause menu does not count): 15 coins for each game, once per game per real day, and the
first time a game is finished together a **badge** for it. Badges show as discs in the game's color on
the **badge board** on the beach by the Party Pier ([B] reads it: the list of games); at 3 badges the
mail brings **party pennants** and at 10 a **play-together trophy** for the yard. A toast on the results
screen says who gets a gift. Gifts arrive as one letter a day from Grumbleton (the harbor master) in
the mailbox, the next time that child is on their island; reading it pays the coins. They are written
to each profile's own save (`progress.coop`) without switching to it.

**School House** (the white schoolhouse with the bell tower on the meadow south-west of the square, by
the path to the beach). Its door opens a picker of the learning games: Bokstavballonger, Mattejakt,
Klokka, Pengebutikken, Rimord (each round on its own), Læringsmiks (all three) and Quizløpet (the quiz,
with its picture mode). Stick up/down picks a game, left/right sets its level (Lett, Middels,
Vanskelig), [B] or A plays and [C] or B closes. Each game's level, times played and best score are
saved per profile (`progress.school`); the game's own level card starts on that level, and the sign
says how many of the games you have played. The highlighted game is read aloud when read-aloud is on,
and the learning games keep reading their words and puzzles (they rely on it). The learning games
stay on the shared island too, unchanged (levels for that visit only).

The solo island is a small farming town (inspired by Stardew Valley and Dave the Diver) and also the
menu to the solo games: every game is a place you walk into. Time follows the real clock, so day and
night match yours and crops grow while you are away.

- **Places:** the School House (learning games), the Party Pier (the ferry to play together), Lighthouse Caves (the lighthouse), The Secret of Pudding Island (the pirate ship at
  the dock), Laser Ducks (the fairground tent), Bean Brigade (the mech garage on the east hill),
  Sky Hop (the hot-air balloon on kite hill) and the
  Game Hall with cabinets for the guest games (Tachyon, Starlite, Foothold, Starhop). Repair the
  bridge with 10 wood to reach Knights & Builders: The Golden Bean and Pillow Keep Solo (the keep
  tower; its sign shows the best hero or the deepest Deep Keep floor); trade Keeper Bram
  a carrot for the Zip-Zap's rock buster and clear the rockfall to open Crystal Caves; give Mumble the grumble three
  radishes to find the burrow to Grumble Guides.
- **Pip's Zip-Zap:** one sci-fi gadget instead of a hoe, a watering can, a scythe and a pickaxe (in the
  spirit of a sonic screwdriver). On a new island Aunt Hazel and Pip pop in together: Pip has built the
  Zip-Zap from spare rocket parts and gives it to you, then Hazel gives seeds and her farming tutorial
  teaches it (zap the soil, plant, zap the seeds with water, harvest, ship). It works by what it points
  at, with [B]; a small icon floats over the target, every action has its own beam color and sound, the
  tip glows in that color and the gadget hums softly in the bean's hand (a slim wand about half the bean's
  height):

  | Target | Action | Needs |
  | --- | --- | --- |
  | untilled field soil | till | – |
  | tilled dry soil, or a thirsty crop | water (a blue water beam) | – |
  | weeds on the field, tall grass | cut (tall grass: hay and fiber) | – |
  | sparkly ore rock (stone) and the Crystal Caves rockfall | break | the rock buster (Keeper Bram's carrot trade) |
  | big purple ore boulder | break (6 stone, every third has a crystal) | the rock buster and Pip's Mega Buster |
  | choppable tree (a round oak with a light bark band and apples) | chop: 3 wood; a stump with a sprout grows back in 30 minutes | – |
  | ripe crop | harvest (with any item in hand; a harvest beam with the Zip-Zap) | – |
  | buried treasure on Shell Isle | dig | – |

  Things to break, cut or chop look different from the scenery: ore rocks are round warm sandstone
  chunks with dark cracks and glowing colored ore gems (the scenery rocks are flat grey ones), big
  boulders are purple with big crystals, and the rockfall has the same cracks and gems. While you hold
  the Zip-Zap, everything it can break, cut or chop within about 11 m glows faintly (a soft colored ring
  and dome at a quarter of the first version's strength: pink rocks, green grass, yellow trees). There are 12 ore rocks, 14 tall grass spots, 3 big
  boulders and 8 choppable trees on the main island, and 3 ore rocks, 3 tall grass spots and a big
  boulder on Shell Isle; branches still give wood too. **Pip's gadget bench** stands by the path below
  her rocket: Fast Zap (150 coins, 5 wood, 5 stone: fewer zaps for rocks, boulders, trees and the
  rockfall), Wide Beam (200 coins, 10 wood, 5 fiber: till and water three tiles in a row), Big Beam (500
  coins, 15 wood, 15 stone, after the Wide Beam: 3 × 3), Long Reach (250 coins, 5 stone, 10 fiber: the
  beam reaches a tile two steps away when the near one has nothing to do) and Mega Buster (400 coins, 15
  stone, 5 wood, after the rock buster: big boulders). Aunt Hazel's 4-heart gift, her mother's magic
  spout, now makes the water beam three tiles wide. Old saves: the hoe, can, scythe and pickaxe become one
  Zip-Zap (an old pickaxe, or Bram's trade already done, switches on the rock buster) and Pip writes a
  letter about it.
- **Farming:** till, plant, water with the Zip-Zap (one
  watering lasts six hours of daytime; dry crops wait and never die), harvest and sell in the shipping bin
  or at Rosa's store. Fourteen crops, from radishes (4 minutes) to star fruit (8 hours), by season.
  **At night (21:00 to 6:00) outdoor crops grow very slowly** (a tenth of the speed; the soil does not dry
  at night, so a crop watered in the evening is still wet in the morning). The greenhouse has grow lamps
  that glow after dark and keeps full speed day and night. Growth is worked out over the real time that
  passed, also while the game is closed (a star fruit watered at 20:00 has 114 of its 480 minutes at
  6:00; in the greenhouse it is ripe). Sprinklers and rain water the same way.
- **Villagers:** Aunt Hazel, Rosa, Keeper Bram, Grumbleton, Pip the astronaut and Mumble walk their
  own daily routines, talk (read aloud), react to your progress in their games, like some gifts more
  than others, and have friendship hearts, heart events and small quests. Name tags show only the name.
- **Homes at night:** everyone has a home: Aunt Hazel her cottage, Rosa upstairs in the store, Keeper
  Bram a keeper's door on the lighthouse, Grumbleton a cabin hatch on his ship (top of the gangplank), Pip
  the rocket, Mumble a little den at the meadow, Curator Hoot the museum and Shelby her shell house on
  Shell Isle. At bedtime they walk home and go in (the door swings open and shut), and come out in the
  morning. Windows are lit while they are up and dark, with a "zzz" over the roof, while they sleep.
  At home but still up (about an hour before bed): Hazel 21-22, Rosa 20-21, Bram 1-2, Grumbleton
  22:30-23, Pip 22-23, Mumble 20:30-21, Hoot 21-22, Shelby 19-20; asleep: Hazel 22-6, Rosa 21-7, Bram
  2-6, Grumbleton 23-8, Pip 23-8, Mumble 21-7, Hoot 22-7, Shelby 20-7 (on Lantern Night Bram stays in
  the square until midnight). A sleeping villager's door is locked: B knocks and they answer with a
  sleepy line through the door (read aloud, two per villager, no hearts lost); knock while they are up
  and they come to the door to chat. The store and the museum are closed with a sign while their owner
  is home. Quests and story steps say who is asleep and until when; friends come to the café only while
  they are up during opening hours; story scenes and the Lamp Festival bring everyone out.
- **The journal** (F on a keyboard, the D-pad down on a gamepad) is one book with tabs: **Friends**,
  **Tasks** (everything on your list, not just the first five), **Calendar** (the calendar board opens it
  here), **Fish log** (the fish log book opens it here) and **Museum** (the collection to look at; you
  still donate at Curator Hoot's board). LB/RB (L1/R1, L/R) or the keys 1–5 (also `[` and `]`) switch
  tabs, the stick looks through a page, B or Q (also F, Tab) closes it; the mouse can click a tab.
- **Friends book** (the journal's first tab): a page per villager: picture, hearts, birthday, the
  gifts they love, like and dislike (filled in when you give that gift, or when a friend mentions a
  favorite while chatting, one per heart), where they are right now and what comes next with them
  (quest, story, heart event or request). The stick or the arrow keys turn the pages, each page is read
  aloud, and the last page shows the farm animals' hearts.
- **Fishing:** Grumbleton gives you a rod. Cast with B, wait for the bite (B), then reel in by
  pressing B in the green zone (C lets go); 16 fish by place and real time of day (river, pier, shore and the dive boat),
  with a fish log of pictures.
- **Diving:** from the dive boat, swim a side-view sea: pick kelp and clams, open treasure chests and
  catch sea critters with a bubble net. Air never punishes; running out just pulls you up with your
  haul. Flippers and a big tank open the coral reef and the deep trench; a sea lamp opens a dark
  glow cave, and a scooter swims faster.
- **Night dives:** the sea follows the island's clock. From 17:00 it gets dim, from 21:00 to 4:36 it is
  dark, and it is light again at 7:30. In the dark you see a circle of light around you: a small free
  headlight, or a big circle with Rosa's sea lamp (the glow cave still needs the lamp). Glowing critters
  only come out at night (20:00 to 5:00): lanternfish in the open sea, glowing jellies, sparkling plankton,
  and two night finds, the **moon jelly** and the **glow shrimp** (in the fish log and the museum with a 🌙
  "only at night"; the night fish in the log have the moon too).
- **The Driftwood Café:** repair it with wood and coins, cook 12 dishes from crops and fish, and serve
  guests at the counter (8:00 to 22:00): the right dish in time gives coins, tips and friendship.
  **Seaweed cakes** (2 seaweed and a carrot) replace the old crab cake, and the seafood platter is clam,
  shrimp and squid (no lobster).
- **Animals:** Aunt Hazel's barn quest (15 wood and 10 stone) brings two chickens; Rosa then sells
  more chickens, a goat and a cow. Zap tall grass for hay and put it in the trough; each real day an
  animal with hay lays an egg or can be milked (no hay just skips the day, nothing gets sick). Pet each
  animal once a day for up to 5 animal hearts. Eggs and milk add four café dishes (16 in total).
- **Building and decorating:** zap ore rocks for stone, trees for wood and tall grass for hay and fiber. The
  workbench by the cottage crafts 12 yard pieces and furniture, upgrades the cottage (porch and a
  second room) and has a decorate mode: the stick moves a cursor over the grid, B places or picks
  up, A turns (hold A for the next thing), C ends. Game trophies are movable pieces too. The front door leads into the cottage,
  which you decorate the same way.
- **Island life:** friendship goes to 10 hearts with new heart events at 6 and 8 (Pip's rocket
  launch among them). A calendar board in the square shows birthdays (gifts count double),
  rainy days (about one in five; rain waters the crops) and the festivals (see Seasons below).
  Friends send letters with small gifts and come to the café as regulars with double tips.
- **Rewards from games** arrive as letters in the mailbox: decorations, seeds, trophies and a pirate
  flag for the house (Bean Brigade sends a bug plushie for Clover Isle and a mech statue for the
  whole campaign; Pillow Keep Solo sends a pillow fort for Big Teddy and a golden feather for the
  Sleepy Sheep).
- **Seasons (one per real week):** spring, summer, autumn and winter take turns week by week (weeks
  start on Monday). Each season has its own look (blossoms, bright summer, orange leaves, snow on the
  ground, roofs and trees and an icy river rim), its own crops (14 crops; radishes and carrots grow all
  year, the rest only in their season outdoors; planted crops never wither) and some seasonal fish and
  dive critters (the fish log shows when). Every season has a festival from Friday to Sunday of its
  week: the Spring Planting Fair (plant 5 seeds for Rosa), the Summer Beach Day (find 4 shells for
  Pip), the Harvest Fair and Lantern Night; the Fishing Derby keeps the first Saturday of each month and the Sunday after.
  In winter you can ride a sled down kite hill (hot cocoa for the first ride each winter week), and
  snowy days water the crops like rain. The calendar board colors the weeks by season.
- **The island grows:** the museum east of the square (donate fish, sea finds and crystals to Curator
  Hoot; 46 pieces: 22 fish, 13 sea finds and treasures, 6 crystals and a **Crab friends** wall of 5 that
  fills itself as you help crabs; prizes at 5, 10, 20, 30 and all 46; crystals come from Lighthouse Caves and Crystal
  Caves letters, the glow cave and Shell Isle), the greenhouse (Aunt Hazel's fourth quest; anything
  grows inside in any season), sprinklers (water their 8 neighbours) and scarecrows (sometimes an
  extra crop) from the workbench, and Shell Isle: a sea chart in the glow cave lets Grumbleton sail
  you there from the end of the pier. It has tide pools, palms, wild berries, treasure to dig, a
  hidden cove with its own fish, and Shelby the hermit crab, who visits Crab Cove on weekends (10 to 18).
- **Crab friends:** crabs, snow crabs and lobsters are never caught, sold or cooked: they are friends who
  sometimes need a hand (they never pinch, never get hurt). Each real day, on the main island's beach and
  pier, on Shell Isle and in the dive: a crab flipped on its back (B turns it over), a crab tangled in
  seaweed or an old net (B three times; in the dive a crab or lobster in a net), a family of three lost baby
  crabs who follow you in a little parade to the glowing ring where their family waits, and (on land) a
  hermit crab who has outgrown its shell and a couple of shells to find. Helped crabs say thank you with a
  shell, a piece of sea glass, a pearl or a big shell. **Hermit crabs** (Pebble, Biscuit, Noodle, Dot,
  Bubbles, Sandy, Coco and Wiggle, one or two waiting each day) want a big shell: a spiral shell or a conch
  (on the sand, in the dive, as thanks from crab families) or one crafted at the workbench (castle shell,
  teapot shell, lantern shell, flower shell, each from a sea shell and a few things); they wear it and show
  it off, and move to the cove. **Crab Cove** on the east beach grows with the crabs you help: a sign and a
  pool (0), a sandcastle crab house and a crab family (1 crab, +30 coins), shell houses and flags where the
  hermit crabs live (5, +50 coins and a spiral shell), a dance ring and shell lanterns (12, +80 coins and a
  golden crab statue for the yard) and a shell palace with a crab band (25, +150 coins and a big crab
  plushie). From level 3 the crabs dance on weekend evenings (17 to 20) and on full moon nights (19 to 23):
  B joins the dance (25 coins and a shell once a day). **Crab friends** (Ruby the red crab, Frost the snow
  crab, Captain the lobster, Tiny the baby crab and every hermit crab you helped) can follow you, one at a
  time, chosen at the cove's sign: they scuttle behind you, keep clear of doors, dance when you jump, wave
  when you stand still, dig up a little treasure on the sand (three times a day) and wait at your cottage at
  night (21 to 6). The Friends book has a Crab friends page (how many you helped and how, the cove's level,
  the museum wall, the hermit crabs and their shells, who comes along), and Shelby talks about your crabs.
  Old saves: crabs in the bag go home to the sea with a thank-you letter from Shelby that brings the coins
  they were worth and a big shell; crab cakes become seaweed cakes; crabs given to the museum stay on the
  Crab friends wall.
- **Polish:** Pip's camera (photos become postcards in the mailbox and an album of the newest 12),
  a three-minute fishing tournament against Grumbleton (Wednesdays, or any day at 5 hearts), a
  specials board in the café (up to 4 dishes that sell for more and are ordered more often), and baby
  animals (happy hens hatch chicks, happy cows and goats have a baby; babies grow up in 3 days).
  Pop-up messages wait in a queue (at most two at a time, paused under panels), and decorate mode has
  a free cursor that the stick moves.
- **The lighthouse story, "Why did the lamp go dark?":** after the tutorial, once Keeper Bram has two
  hearts or you have visited Lighthouse Caves, Bram writes that his lamp went dark (from then on it stays
  dark at night until the story ends). Six chapters, each with a short read-aloud opening scene (friends
  pop in next to you, the view slides to them or tilts up to the lamp), a small quest, and a closing scene
  with a reward; a letter then says who to see next. The task list shows the next step (📖) and the
  calendar board shows the chapter. 1 *The lamp went dark*: ask Hazel, Rosa and Grumbleton about that
  night. 2 *Down in the caves*: find a crystal in Lighthouse Caves. 3 *The moon lens*: Hoot's book sends
  you to Shelby on Shell Isle (Grumbleton learns the way if you have no sea chart yet), who trades her
  window lens for two coconuts. 4 *The pudding gear*: finish the first part of The Secret of Pudding
  Island to get back the gear Grumbleton traded for a pudding. 5 *The green glow*: fly one Sky Hop level
  with Pip, follow the glowing crumbs to the meadow and find out who borrowed the old crystal (Mumble, who
  was scared of the dark; he keeps it as a nightlight). 6 *The Lamp Festival*: wood and stone for the
  stairs, invite four friends, then a night festival with everyone (lanterns, music, fireworks, the lamp
  lights up) and a mini lighthouse for the yard. Game steps read the games' saves and count at once if you
  already got there earlier. Afterwards a long beam sweeps every night, with a path of light on the
  ground and the water.
- **The lighthouse top:** after the festival the little door on the side of the tower leads up. The view
  is your own (the stick walks around the lamp, names float over the places), and Bram's telescope shows
  a night sky (Pip's star filter makes it work in the daytime too) with eight star pictures: center one
  in the ring, look closer and pick its name from three funny ideas. Each gives coins, all eight a star
  globe.
- **B4 polish:** the boat trip to Shell Isle swings the view from the island you leave to the one you
  sail to, with lighter fog, buoys, gulls, a waving seal and the dolphin (the gulls flap and glide with
  spread wings, bank into turns and land on posts, barrels and the sand with folded wings; at night they
  sleep perched); in winter the paths and the
  field turn snowy and every roof has snow (Shell Isle stays warm and sunny); Shelby comes to the café as
  a regular at 3 hearts (seaweed salad) and writes letters like the other friends.
- **Jumping:** [A] (Space) jumps about a meter high and three meters far, and the island has height now:
  you stand on stumps, crates, barrels, logs, rocks, ledges, the lookout deck and the game hall roof, walk off
  edges and fall down (never any damage; the camera follows the height smoothly at the same distance as
  before). On foot you never walk into water or up a steep bank; jumping over water is fine, and landing in
  it (or falling off a hop trail) is a little splash and puts you back where that hop started. Forgiving: a
  jump still works a moment after walking off an edge, and a press just before landing jumps again. Up on a
  roof or a ledge only what is up there answers [B] (a chest, a bell), not the doors and villagers below.
  **No invisible walls:** whatever stops the bean is drawn (the cliffs have a rocky face and no foothold: land
  on it and you slide down, so no hopping or creeping up them; benches, boards and posts block exactly where
  they stand; water edges; the boulders at the plunge pool and the spring). Up on the cliff tops there are only
  the grove (by the hidden steps behind the waterfall) and the lookout (by the Cliff Climb), each closed in by
  walls of tall boulders, twice a bean's height and taller than any jump, that come up the cliff face and run
  along the top (`CLIFF_WALLS` in `hopdata.js`): the grove between the upper river's bank and a wall out to the
  sea, the lookout in a U behind the deck. You get down by walking off the edge. **Never
  stuck:** gaps between props are either a bean wide or closed, and if the bean ever ends up wedged somewhere
  anyway, pushing the stick for a moment pops it out to the nearest free spot. **See-through:** tall things
  between the camera and the bean (a balloon, a house, a tree, the lighthouse, the waterfall) thin out around
  the bean while they hide it. Nothing that spawns (a visitor's balloon, the merchant's cart, a dig spot, a leaf
  pile) lands on a door, a path, a trail or a thing you use (`spotClear()` in `map.js`).
  - **Stepping stones:** across the river south of the bridge (they appear once the old bridge is fixed, as a
    shortcut to the west bank), and across the new pond south of the square (stones and lily
    pads).
  - **Hidden areas,** each with a treasure chest (the first find has a yard decoration, coins and seeds; the
    chest is saved as found). **The secret grove** behind the waterfall: the upper river runs from a spring of
    boulders on the cliff top, arcs over the lip and falls into the plunge pool; hop over the pool, through the
    falling water into the slot behind it, up the wet rocks in there and out onto the cliff top, to a glade with
    glowing mushrooms (walk off the cliff edge to get down). **Gull Rock** off the beach (east of the dock): small rocks in the sea up to a ledge,
    the precise one. **The game hall roof:** a stair of crates by the east wall (Pip's lost toolbox, found
    once). **The hollow tree** between the barn and the café: a root, a mushroom shelf and a branch up into the
    hollow. **The tiny islet** west of the dock: stepping stones out into the sea, a palm and a chest. The
    grove, Gull Rock, the hollow tree and the islet chests fill up again every Monday (coins and seeds of the
    season); friends drop hints in their chats about spots you have not found.
  - **Hop trails with a timer:** the **Stump Hop** (easy, the meadow east of the launch pad), the **Barrel
    Run** (crates, barrels and a wobbly plank by the dock; its start flag stands beside the beach road) and the **Cliff Climb** (tricky: rock by rock up
    the cliff north of kite hill to the **lookout** deck). [B] at the start sign: 3, 2, 1, go; land on the
    last top to ring the bell. Best times are saved; falling off puts you back on the top you jumped from
    while the clock runs on. **Pip races you on the Stump Hop and Grumbleton on the Barrel Run** (when they are
    up and about): they hop the trail beside you, and every time you beat them they get a little faster.
    Ringing all three bells brings a golden bell for the yard.
- **Daily surprises** (by date, the same for everyone; about two days in three have one): a **meteor
  shower** at night (20-24, not on rainy days): star bits fall near you, catch them, two at once if you
  jump and catch one in the air; **Marlo the traveling merchant** by the square (9-18) with three odd
  things a day (mystery seeds, a single sock, a golden acorn, moon cheese, a rubber duck pond, a cloud in a
  jar, a music box, a jar of star bits); a **hot-air balloon** lands on the open meadow south-east of the
  square (10-17) with **Skye the explorer**, whose goggles blew somewhere you have to hop to (a little balloon
  for the yard the first time); at five Skye climbs in and it lifts off and drifts away (it is never there at
  night); a **bottle on the beach** (6-21) with a **treasure map**: the X shows where to dig. `surpriseOn(date)`
  in `src/scenes/solo/surprise.js` says which.
- **Island mini-games:** **skipping stones** at the pile of flat stones on the beach (press [B] when the bar
  is in the green: up to 7 skips, a record brings coins; the view follows the stone out over the water, every
  skip leaves a ripple ring and its number, and the last skip plays in slow motion); **kite flying** at the kite stand on kite hill
  (the stick keeps the kite in the sparkly wind for 30 seconds); **hide-and-seek with Mumble** (he asks when
  you talk to him, once a day from four hearts on: count to five, then find the giggling bush at the meadow within a minute); a **snowball
  fight with Pip** in winter weeks behind two snow forts south of the square ([B] throws, with only a little
  aim help, so lead her; she ducks now and then; jump over her snowballs); **leaf piles** in autumn weeks: jump into one and it bursts, some hide coins, a golden acorn,
  seeds or a striped sock.
- **Little spots everywhere** (the emptier parts of the island got something too): a picnic with a bench by the
  pond, a wildflower meadow south-west of the square with a **wild berry bush** ([B]: two wild berries, once a
  day), a fairy ring of standing stones and mushrooms, a bench with a sea view by Crab Cove, a birdbath by the
  garage path, a woodpile under the cliffs north-east of the store and a sandcastle on the beach (`SPREAD` in
  `map.js`).
- **Villagers play with you:** they **wave** when you jump near them; **Pip plays tag** (from four hearts on she asks once a day; catch her, then
  she chases you; up on a stump she cannot get you); stand still at a view spot (the lookout, the bench on
  kite hill, the bench by the lighthouse, the end of the pier, the islet) **at sunset** (17:30-20:30) or **on a
  clear night** and a friend comes over to watch with you (once a day each); and every day one villager asks
  for help with **a small fun task**, always up somewhere you hop to: Aunt Hazel's hen on the Stump Hop,
  Mitten on the Barrel Run, Pip's model rocket on the game hall roof, Grumbleton's hat on Gull Rock, Keeper
  Bram's glass float on the cliff path, Curator Hoot's book on the hollow tree's branch. Pick it up with [B]
  and bring it back.
- **Controls (solo island only).** A gamepad uses the island layout (the dive too): **A jumps**, **X is
  the one use button** (the held tool or seeds, talking, picking up, shipping, mail, doors, shops and
  knocking; a villager you face wins over the field), **B is back** (it closes panels and never uses or
  picks anything; out in the world it does nothing), the **D-pad picks the hotbar slot (left/right)**,
  **opens the bag (up)** and **the journal (down)** (it does not walk), **Start opens the menu**, and Y
  is free. The keyboard stays Space / E / Q: Space jumps, E uses, Q opens the menu (and is back in
  panels), Tab the bag, F the journal, 1–9 the hotbar, `Esc` help. A new controller pressing jump takes
  over. The menu has Keep playing, Play together (the shared island, like the ferry), Change player (the profile picker), Read aloud
  on/off, Characters (speak or babble), Language and Help, so a gamepad reaches every setting. The
  Friends book is in the journal now, not in the menu.

  | Solo island | Gamepad (Xbox / PlayStation) | Keyboard 1 |
  | --- | --- | --- |
  | walk | left stick | W A S D |
  | jump | A / ✕ | Space |
  | use, talk, pick up, go in, knock | X / □ | E |
  | back, close a panel | B / ○ | Q |
  | hotbar slot | D-pad ← → | 1–9 |
  | bag | D-pad ↑ | Tab |
  | journal | D-pad ↓ | F |
  | journal tabs | LB / RB (L1 / R1) | 1–5, `[` `]` |
  | menu | Start (Options) | Q |
  | help | the menu's Help | `Esc` |
  | (free) | Y / △ | – |

- **The bag, the hotbar and the cottage chest** (like Stardew Valley): the 9-slot hotbar at the bottom is
  what you hold (keys 1–9 or the D-pad left/right; an empty slot means empty hands). The bag panel shows the bag rows (9 wide)
  above the hotbar; it starts with the hotbar and 2 bag rows (27 slots), and Rosa sells a Bigger backpack
  (250 coins, a 3rd row) and then a Huge backpack (750 coins, a 4th row). New things go onto the same thing
  already in the bag, else into the first free slot (hotbar first); a full bag sends them to the cottage
  chest with a toast, so nothing is ever lost. The **storage chest** stands in the back right corner of
  the cottage (36 slots, it grows a row if it ever overflows): use it to open the same panel with
  the chest above the bag. The name and sell price of the thing under the cursor or mouse is shown.
  Shops, the shipping bin, gifts, the café, the museum, crafting and quests use what is in
  the bag (not the chest). Old saves: the old list fills the hotbar, then the bag rows, the rest goes
  into the cottage chest.

  | Bag panel | Mouse | Keyboard | Gamepad |
  | --- | --- | --- | --- |
  | open / close | – | Tab / Tab or Q | D-pad ↑ / B |
  | move a stack (empty slot: move, same thing: merge, other thing: swap) | drag it | WASD or arrows move the cursor, E picks up, E puts down | stick or D-pad moves the cursor, X picks up, X puts down |
  | move across at once (bag ↔ hotbar, or bag ↔ chest) | right click or shift+click | Space ([A]) | A |
  | pick what you hold | click a hotbar slot | 1–9, or the cursor on the hotbar | the cursor on the hotbar |

  In panels the island's use button does the thing and its back button closes; on a gamepad A also
  does the thing (so A picks and B goes back everywhere). Below, "use" is E / X and "back" is Q / B.

  | Mode | jump (Space / A) | use (E / X) | back (Q / B) |
  | --- | --- | --- | --- |
  | Walking | jump | use, talk, go in, knock | keyboard: the menu (gamepad: Start) |
  | Dialog | next / pick the highlighted answer | next / pick the highlighted answer | keyboard: answer "no"; gamepad: next on a plain line, nothing on a question |
  | Bag (see the table above) | move across | pick up / put down | close |
  | Journal | – | keyboard: close | close |
  | Letters, album, treasure map | close | close | close |
  | Menu | pick (left/right switches a setting) | pick | close (Start too) |
  | Pip's gadget bench | gamepad: build | build the upgrade | close |
  | Shop | gamepad: buy or sell one | buy or sell one | leave |
  | Fishing | gamepad: as use | cast, hook, reel in the green | let go / close the result |
  | Café stove, specials board, workbench, museum, Crab Cove sign | gamepad: as use | cook / special on-off / make / donate / choose a crab friend | close |
  | Café service | gamepad: serve | serve | close the café |
  | Decorate | turn (hold: next thing) | place or pick up | done |
  | Photo mode | gamepad: click | click | back |
  | Lighthouse top and telescope | gamepad: as use | telescope / look closer | climb down / back |
  | Sled | – (stick steers) | – | close the result |
  | Diving | kick (swim faster for a moment) | pick up, open, help or wave to a crab, climb out, or the bubble net | swim up to the boat |
  | Hop trail | jump | (at the sign: start, race) | keyboard: the menu |
  | Skipping stones | – | throw (when the bar is green) | stop |
  | Kite flying | – (stick steers the kite) | – | stop |
  | Snowball fight | jump (over snowballs) | throw | keyboard: the menu |
  | Hide-and-seek | jump | look in a bush | keyboard: the menu |

**Playtest time machine.** Open the site once with `?dev` in the address (for example
`https://vonrotter.github.io/couch/?dev`) and press F9 on the solo island: a small panel moves the island clock
forward to the next 06:00, 18:00 and so on, skips hours, days or a week, or jumps to the next new season, festival or
rainy day. Time only moves forward (crops and animals grow as if the time had passed), the shift is remembered in that
browser, "Real time" goes back, and `?dev=0` turns the panel off. It changes nothing else.

**Read-aloud.** V turns read-aloud on or off (on by default for new solo profiles, off on the shared
island; each profile remembers its choice). It uses the browser's own voices in English or Norwegian;
if the device has no voice for the language it stays quiet.

- **One narrator, only for story and help.** A calm narrator reads intro and how-to cards, story,
  campaign and cut-scene text, letters, signs, notes and books you open (the journal's Friends pages
  and Tasks), tutorial steps and hints shown once, always in the device's best voice (natural or
  online voices such as Microsoft "Natural" and Google first, then the rest; novelty voices never).
  It does not read toasts, HUD hints, menu items, item names, tile, unit or foe info, score pop-ups,
  banners (floor names, "Your turn!"), quest board, shop and gate rows, objectives, result screens or
  game messages. In Bean Brigade it reads the title, each battle's story on the map, the tutorial,
  the first deploy tip and the ending; in the Lighthouse Caves signs, notes, what you find and hints
  shown once (not bumps, save stones or the lamp); in Pillow Keep Solo the welcome, tips shown once and
  a newly opened act. Characters still speak (or babble) their own lines.
- **Voice types for characters.** Every speaking character has a voice type: child, grandma, gruff
  sailor, cheerful shopkeeper, owl sage, sleepy old man, villain, tiny creature, crab, bird, robot or
  friendly grown-up. Each type gets its own voice where the device has several for the language
  (picked by the voice name: Female/Male, known names like Zira, David, Samantha, Daniel, Iselin, Finn
  or Nora), plus its own pitch and rate, and every character a small offset of its own, so two
  grandmas still differ (Keeper Bram sounds the same on the island and in the Lighthouse Caves).
  Norwegian devices often have one or two voices: then the types differ by pitch and rate only. On
  story and campaign cards, quoted lines are said by the speaker and the rest by the narrator.
- **Babble.** B (or *Characters* in the pause menu, or [C] on a profile card: voice on, babble, off)
  switches characters to babble: Animal Crossing-style syllables made with WebAudio while the line is
  on screen (squeaky for tiny creatures, a low rumble for gruff sailors and villains, beeps for the
  robot, clicks for crabs, chirps for birds). The narrator keeps reading. Each profile remembers it,
  the shared island has its own setting. Babble also needs read-aloud on (V).
- **Hearing the voices.** With `?dev` (see the time machine above), F10 shows a voice panel: the
  device's voices (local or online, guessed gender, quality score), which voice the narrator and every
  type got, the characters of each type, and buttons that play each type read aloud or as babble.
- **Adding a character:** add `'<game>.<id>': '<type>'` to `SPEAKERS` in `src/core/voices.js` and call
  `say(text, '<game>.<id>')` (narration: `say(text, 'narrator')`).

**Guest game contract.** A guest game is opened with
`?profile=<id>&name=<name>&return=<url>&lang=en|no`, and the active profile is also stored in
`localStorage['couch.profile']` (`{ id, name }`). A guest game should put the profile id in front of
its own save keys and show a button back to the `return` link.

## Code layout

```
src/
  main.js            renderer, game loop, scene switching; the start flow (enterSolo, goTogether, goHome,
                     openStart) and co-op rewards (coopFinished)
  core/
    profiles.js      solo profiles (storage, picker incl. the start screen's cards), the shared island's
                     join card (JoinPicker) and the guest-game contract
    coop.js          rewards for playing together: coins, badges, decorations, letters (progress.coop)
    voice.js         read-aloud: say(text, speaker), the narrator, voice types or babble (B)
    voices.js        speaker -> voice type table, types, choosing the device's voices per type
    babble.js        WebAudio babble syllables per voice type
    devvoices.js     ?dev voice panel (F10): the device's voices, play every type
    input.js         keyboard schemes + gamepads -> one controller shape; gamepad layouts ('default',
                     'island'), menu pick/back (okPressed/backPressed), button names per pad kind
    roster.js        joined players, colors, hats, saved star count
    character.js     the shared bean buddy (squash/stretch, blink, hats)
    palette.js       colors, cached toon materials and geometry
    world.js         lights, sky, trees, clouds, flowers, stars, gems
    critters.js      grumbles (the harmless "enemies")
    physics2d.js     side-view AABB physics + forgiving platformer controller
    particles.js     instanced confetti and puffs
    audio.js         synthesized sound effects and music loops
    ui.js            HTML overlay: banners, chips, labels, results, wipe
    i18n.js          English / Norwegian text, t('key')
    scene.js         base scene (camera fitting, game-time timers, disposal)
    teams.js         two-team picker and helper-bot balancing (Mega Ball, Ice Hockey, Snowball Fort)
    vote.js          pre-game vote picker (laps, match length, rounds, holes)
    minigame.js      shared intro -> countdown -> results -> back flow
  scenes/
    start.js         the start screen: Who is playing? over a little island
    ferry-model.js   the Party Pier ferry (shared by both islands)
    solo/            the solo island (island.js, map.js, ...; ferry.js: the Party Pier and badge board;
                     school.js: the School House and its picker)
    hub.js  hub-icons.js  bubble.js  platformer.js  skyhop-levels.js  paint.js
    spacefall.js  spacefall/  brawl.js  kart.js  portal.js  football.js  hockey.js  slalom.js
    space.js  runner.js  cook.js  golf.js  snowball.js  hideseek.js  castle.js
    guides.js  splash.js  cave.js  dogfight.js  duckhunt.js
    lighthouse.js  lighthouse/  top-down adventure: rooms per area, dungeons, softlock checker
    adventure.js  adventure/   point-and-click engine (rooms, dialog, Tickle Fencing) and Pudding Island
    breach.js  breach/   Bean Brigade: pure rules + bug AI (rules.js), levels, board view, models, HUD, helper bean
    keep.js  keep/   co-op Pillow Keep: floor generator, grumbles, boss telegraphs, Big Teddy and the Sleepy Sheep
    keepsolo.js  keepsolo/   Pillow Keep Solo: acts, difficulty and quests (acts.js), heroes, stats and skill
                     trees (classes.js), skills (skills.js), gear (items.js, models.js), the item grid
                     (grid.js), floors and loot (world.js), Pillowby (town.js), bag/stash/shop/forge/sage
                     panels (inventory.js), hero page and skill tree (tree.js), mouse (mouse.js), click to
                     move and A* paths (control.js, path.js), mana, belt and hotbar (hero.js), the dark
                     (light.js), champions and uniques (monsters.js), Goose and Duck bosses, HUD and
                     menus (ui.js), save and old-save migration (save.js), strings.js and strings2.js
    castle-campaign.js  castle/   The Golden Bean campaign (levels, troopers, grumbles, siege props)
    story.js  story/   Story campaign map, stage data and the four Grumble King boss games
    spelling.js  math.js  edu-words.js   (learning games; shared helpers in core/edu.js)
    learnmix.js  learn/  Læringsmiks and its rounds (klokka, penger, rimord)
    party.js         Party Mix flow: vote, how-to cards, countdown, scoreboard
    party/           one file per round (20 rounds)
```

To add a Party Mix round: subclass `Round` from `scenes/party/common.js` (set `done` when it
ends, return a higher-is-better `score(p)`), and add it to `ROUNDS` in `scenes/party.js`.

Modules can bring their own text with `addStrings({ en, no })` from `core/i18n.js`.

To add a game: subclass `MiniGame`, register it in `GAMES` in `main.js`, and add a pad in
`PADS` in `scenes/hub.js` and an icon in `scenes/hub-icons.js`.

`window.game.simulate(seconds)` advances the game in fixed steps without rendering.
It exists for automated tests.

## Assets and licenses

- All 3D art is built in code from three.js primitives, so every game shares one look.
- All sound and music is synthesized at runtime with the Web Audio API.
- Font: [Fredoka](https://github.com/hafontia/Fredoka-One) via `@fontsource/fredoka`, SIL Open Font License 1.1.
- [three.js](https://threejs.org), MIT License.
