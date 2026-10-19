# Couch Party Island

Couch co-op party games for 1–6 players on one screen, built with three.js.
Players roam a little island, collect stars to unlock hats, and walk onto a game
pad together to start a game. Everything is forgiving: nobody is ever knocked out.

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

- Press A on any device to join (up to 6 players). The first player picks a mode in the start
  menu: **Island** (roam and pick games on the pads) or **Paint Pilots** (side-view biplane dogfight, inspired by Triplane Turmoil and Luftrausers). Vote
on Free for all, Teams or Co-op against waves of grumble planes and blimps ending with the King Blimp.
The stick points the nose, A boosts, B fires paint pellets and C does a barrel roll that dodges
paint. Climb too steeply or too slowly and you stall: the engine sputters and the nose drops until
you pick up speed again. Three paint hits and you parachute down in confetti and are back in the air
3 seconds later; crashing is just a puff. Land gently on the runway to wash the paint off.

**Story** (the co-op campaign). Press C on
  the island to open the start menu again; leaving the Story also returns to it.
- On the island: tap B next to a ball to pick it up; hold B and let go to throw (longer hold, further throw). Hold B when you are not carrying anything to leave.
- In a game, `Esc` (or Start on a gamepad) opens the menu: Resume, Retry (same game, same Sky Hop level) or End game (back to the island). Pick with B (use) or A; `Esc` or Start closes it. On the island `Esc` shows help. `M` toggles sound.
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

**Island hub.** The game pads sit in a ring along the shore, each with a floating 3D icon
of its game. A game starts when at least half the players stand on its pad. The middle of
the island is a playground:

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

**Balloon Archers** (free-for-all, TowerFall style, 90 seconds). Aim with the stick, B shoots a
suction-cup arrow. Pop other players' balloons or jump on their heads. Arrows stick in walls,
so walk over them to pick them up; your quiver also refills to 3 on its own. Popped players
float in a bubble for 2 seconds and respawn. The arena wraps around at the edges. Playing
alone gives you floating balloon targets.

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

**Pillow Keep** (co-op dungeon crawl, Gauntlet and Diablo style, five random floors). Everyone picks
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

**Story** (co-op campaign, chosen in the start menu instead of the island). A map of four floating lands
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
island. Jump on the green book button in the settings corner (or press `G`) to show or hide them;
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

## Code layout

```
src/
  main.js            renderer, game loop, scene switching
  core/
    input.js         keyboard schemes + gamepads -> one controller shape
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
    hub.js  hub-icons.js  bubble.js  platformer.js  skyhop-levels.js  paint.js
    archers.js  brawl.js  kart.js  portal.js  football.js  hockey.js  slalom.js
    space.js  runner.js  cook.js  golf.js  snowball.js  hideseek.js  castle.js  keep.js
    guides.js  splash.js  cave.js  dogfight.js
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
