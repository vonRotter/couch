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

Every player has a stick and two buttons: **A** (jump/action) and **B** (secondary).
Each game shows its own controls before it starts.

| Device | Move | A | B |
| --- | --- | --- | --- |
| Gamepad 1–4 | Left stick / D-pad | A | B / X |
| Keyboard 1 | W A S D | Space | Left Shift / E |
| Keyboard 2 | Arrow keys | Enter | Right Shift / Right Ctrl |
| Keyboard 3 | I J K L | U | O |
| Keyboard 4 | Numpad 8 4 5 6 | Numpad 0 | Numpad . / Numpad Enter |

- Press A on any device to join (up to 6 players).
- On the island: tap B next to a ball to pick it up; hold B and let go to throw (longer hold, further throw). Hold B when you are not carrying anything to leave.
- In a game, `Esc` (or Start on a gamepad) opens the menu: Resume, Retry (same game, same Sky Hop level) or End game (back to the island). On the island `Esc` shows help. `M` toggles sound.
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
- a kickable beach ball and stars to hunt.

The settings corner south of the plaza has the paint pots, the color swap pads, the hat
stand, the learning-games button and the language flag. Stars (from the island and from
finishing games) unlock hats: party hat, flower, bunny ears, propeller cap, top hat and
crown. Walk into the hat stand to try on the next unlocked hat.

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
B lobs a paint bomb. Grab the golden paint can for a Mega Brush. Most floor wins.

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

**Kart Party** (split-screen racing, 3 laps). Each player gets their own chase camera
(up to a 3x2 grid). The kart drives forward on its own: steer with the stick, stick down to
brake, A to hop, and hold A while steering to drift for a mini boost. Drive through rainbow
boxes for items (B): Zoom boost, Banana, or a Bubble that floats a rival for a moment.
Players further back get more boosts and a little extra speed, and the track edges steer
you back on course.

**Mega Ball** (team football, Rocket League spirit). A giant ball and two teams, Team Sun
and Team Sea. Players are split automatically; before kickoff anyone can switch side with the
stick, and everyone taps jump when ready. B kicks the ball when you are close (otherwise it
is a dash), A jumps so you can head it. If the teams are uneven, the smaller side gets a helper
keeper. 2.5 minutes; a draw goes to "next goal wins".

**Ice Hockey** (team hockey on a rounded rink). Same team picker as Mega Ball. Skate into
the puck and it sticks to your stick. Hold B to wind up and let go to shoot; shots aimed
roughly at the goal get a little help. A dashes, and dashing into the puck carrier steals
the puck (a fresh carrier is safe for half a second). Without the puck, B pokes it away from
someone close by. The puck bounces off the boards, and you can skate behind the goals. An
uneven or solo team gets a Goalie Bot that saves about half the hard shots. 2.5 minutes with
golden-goal overtime.

**Snow Slalom** (race, shared camera). Everyone skis down the same slope at once. Steer
between the red and blue gates: each gate you pass is a point, and finishing earns a bonus
(1st place most). Missing a gate only costs that point. Stick up to tuck (faster), stick down
to brake, A to jump (ramps launch you), B to push off for a short boost. Snowmen bump you
aside. Anyone who falls far behind floats back to the pack in a bubble.

**Portal Pals** (co-op puzzle, 4 rooms). Top-down rooms. A and B shoot your two portals onto
white walls; walk into one to come out of the other. Anyone can use anyone's portals.
Buttons open doors while someone (or a box) stands on them. Push boxes, even through
portals. Everyone has to reach the gold exit. Hold A+B to reset a room.

**Space Race** (split-screen 3D, 3 laps through 14 rings). Every rocket has its pilot bean in a
glass dome. The flight model borrows the feel of Tachyon-style arcade flight: turn rates ease in
and out with a little inertia, the velocity chases the nose, and holding **B** slides, which keeps
your momentum while the nose swings freely (handy for lining up the next ring). Hold **A** to boost
from a tank that refills on its own; flying through a ring, or a mint boost ring, tops it up.
Pitch is limited and the ship never rolls upside down, so nobody gets lost. A small arrow
(only on your own screen) points to your next ring. Asteroids bounce you off gently, and if you
drift too far from the course you float back to the last ring in a bubble. Players further back
get slightly more top speed.

**Rooftop Rush** (side-scrolling speedrun race, shared camera). Race over the rooftops to the
flag. **A** jumps, and also kicks off walls (wall jump). **B** on the ground slides (so does stick
down while running), which keeps your speed and gets you under billboards. **B** in the air near a
balloon hook grabs it: hold B to swing, let go (or press A) to fly off. Otherwise **B** in the air is
a dash. Signs name each move the first time it is needed: slide tunnel, wall-jump chimney, hook
gap, dash gap, then a spring to a high road or a slide through the low road, and a final hook and
chimney. Speed pads push you to 18 m/s. The camera follows the leader; anyone who falls or drops
off the left edge floats forward in a bubble to just behind the leader (it takes at least 1.5 s),
so nobody gets stuck. After the first finisher, the others have 12 seconds, and the race ends
after 150 seconds regardless.

**Party Mix** (5 short rounds in a row). One pad plays five random rounds out of seven, with
a running scoreboard. Before each round a card explains it and everyone taps jump when ready.
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

## Learning games (LÆRING)

Two educational games in Norwegian (bokmål), marked with a green **LÆRING** badge on the
island. Jump on the green book button in the settings corner (or press `G`) to show or hide them;
the choice is saved. Before each round every player picks their own level (Lett, Middels,
Vanskelig), so younger and older kids can play together. Mistakes never cost anything.

**Bokstavballonger** (spelling). Letter balloons float up. Each player has their own word
with blanks and a clue at the bottom of the screen; touch the balloon with the next missing
letter. Lett: 3-letter words, one blank. Middels: 4-5 letters, two blanks. Vanskelig: longer
words, only the first letter shown. The letter you need always floats by. Finished words are
read aloud if the device has a Norwegian voice.

**Mattejakt** (math). Number coins lie on a field. Each player's problem floats above their
head; run to the coin with the answer. Lett: adding within 10. Middels: adding and
subtracting within 20. Vanskelig: times tables and adding/subtracting within 100. Every
player's answer is always somewhere on the field. Word lists live in
`src/scenes/edu-words.js`.

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
    teams.js         two-team picker and helper-bot balancing (Mega Ball, Ice Hockey, Tug of War colors)
    minigame.js      shared intro -> countdown -> results -> back flow
  scenes/
    hub.js  hub-icons.js  bubble.js  platformer.js  skyhop-levels.js  paint.js
    archers.js  brawl.js  kart.js  portal.js  football.js  hockey.js  slalom.js
    space.js  runner.js
    spelling.js  math.js  edu-words.js   (learning games; shared helpers in core/edu.js)
    party.js         Party Mix flow: how-to cards, countdown, scoreboard
    party/           one file per round (count, statue, cushions, fruit, dance, tug, tower)
```

To add a Party Mix round: subclass `Round` from `scenes/party/common.js` (set `done` when it
ends, return a higher-is-better `score(p)`), and add it to `ROUNDS` in `scenes/party.js`.

To add a game: subclass `MiniGame`, register it in `GAMES` in `main.js`, and add a pad in
`PADS` in `scenes/hub.js` and an icon in `scenes/hub-icons.js`.

`window.game.simulate(seconds)` advances the game in fixed steps without rendering.
It exists for automated tests.

## Assets and licenses

- All 3D art is built in code from three.js primitives, so every game shares one look.
- All sound and music is synthesized at runtime with the Web Audio API.
- Font: [Fredoka](https://github.com/hafontia/Fredoka-One) via `@fontsource/fredoka`, SIL Open Font License 1.1.
- [three.js](https://threejs.org), MIT License.
