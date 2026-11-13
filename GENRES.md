# Genres and skills (the genre passport)

Generated from the data table in `src/core/passport.js` (`GENRES`, `SKILLS`, `GAMES`, `TRIALS`, `PATH`); change the
table there, then this file. The passport is explained in the README (Solo island, *Genre passport*).

## Skills (badges: bronze, silver, gold)

| Skill | What it means |
| --- | --- |
| ⏱️ Timing | Pressing at just the right moment: a jump, a catch, a beat. |
| 🎯 Aiming | Pointing at what you want to hit, and leading things that move. |
| 🕹️ Moving and steering | Keeping a bean, a kart or a kite where you want it. |
| 🧭 Exploring | Looking around, finding secrets and remembering the way. |
| 🧩 Puzzles | Working out how something works, then trying an idea. |
| ♟️ Thinking ahead | Choosing what to do first, and what happens next. |
| 🧱 Building | Making things with blocks and pieces, and making them hold. |
| 👀 Reading the enemy | Watching what the other side is about to do, and getting out of the way. |
| 🤝 Teamwork | Playing together: helping, sharing jobs, waiting for each other. |

- **Bronze:** play a game that uses the skill *properly* (see the table below).
- **Silver:** 3 mastery points in the skill, or a silver trial.
- **Gold:** 8 mastery points from at least 2 different games, or a gold trial.
- A **mastery point** is one thing done well, counted once: a Sky Hop level cleared, a Grumble Guides level with 2+
  stars, a Golden Bean level won, a Bean Brigade battle won, a lamp crystal or a boss in Lighthouse Caves, two heart
  pieces, a Laser Ducks round reached (2, 4, 6, 8), a Pillow Keep Solo act or hero level (5, 10, 15), a Pudding Island
  scene, a learning game on Middels or harder, a fish species, a hop trail (and one without falling off), a hidden
  chest, 10 / 50 / 200 crops harvested, 3 / 6 / 10 / 15 yard pieces, 5 / 20 dives, 10 / 50 dishes served, a
  5+ skip with stones, a 20+ kite flight, hide-and-seek and snowball wins with villagers, and every different game
  finished together on the shared island (teamwork).

## Genres (a stamp each)

| Genre | Famous example | Games here |
| --- | --- | --- |
| 🦘 Platformer | Super Mario Bros. | Sky Hop, Hop trails, Bubble Buddies, Rooftop Rush, Grumble King (meadow) |
| 🗡️ Adventure | The Legend of Zelda | Lighthouse Caves, Starhop |
| 🔍 Point and click | The Secret of Monkey Island | Pudding Island |
| 🧩 Puzzle game | Tetris, Lemmings | Grumble Guides, Portal Pals |
| ♟️ Tactics | Into the Breach | Bean Brigade, Starlite, Foothold, Splash Squad |
| 🛡️ Role-playing game | Pokémon, Diablo | Pillow Keep Solo, Pillow Keep |
| 💎 Roguelite | Spelunky | Crystal Caves |
| 🎯 Aim and shoot | Duck Hunt, Splatoon | Laser Ducks, Tachyon, Spacefall, Paint Pilots, Snowball Fort, Grumble King (snow fort) |
| 🏁 Racing | Mario Kart | Kart Party, Snow Slalom, Space Race, Grumble King (space) |
| ⚽ Sports | Rocket League, FIFA | Mega Ball, Ice Hockey, Bean Golf |
| 🧱 Building game | Minecraft | Knights & Builders (Versus and the Golden Bean), Building in your yard |
| 🎉 Party game | Mario Party | Skipping stones, Kite flying, Games with villagers, Party Mix, Bonk Brawl, Paint Party, Garden Hide & Seek, Cook-Off, Grumble King (kitchen) |
| 🌱 Life sim | Animal Crossing, Stardew Valley | Farming, Fishing, Diving, The café |
| 📚 Learning game | Big Brain Academy | The School House, Bokstavballonger, Mattejakt, Læringsmiks |

Each genre has a read-aloud card in the passport (English and Norwegian, `pp.card.<genre>` in
`src/core/passport-strings.js`): what kind of game it is, what you practise, a famous example and the games here.

## Every game

| Game | Where | Genre | Skills | Played properly (the stamp and bronze) |
| --- | --- | --- | --- | --- |
| Sky Hop (`platformer`) | solo island place | Platformer | Timing, Moving and steering | a level cleared (someone reached the flag) |
| Lighthouse Caves (`lighthouse`) | solo island place | Adventure | Exploring, Puzzles, Reading the enemy | the first item, puzzle or crystal (from its save) |
| Pudding Island (`adventure`) | solo island place | Point and click | Puzzles, Exploring | scene 1 finished (from its save) or its results |
| Laser Ducks (`duckhunt`) | solo island place | Aim and shoot | Aiming, Timing | a game finished |
| Crystal Caves (`cave`) | solo island place | Roguelite | Exploring, Timing, Thinking ahead | a run finished |
| Grumble Guides (`guides`) | solo island place | Puzzle game | Puzzles, Thinking ahead | a level won (1+ star) |
| Bean Brigade (`breach`) | solo island place | Tactics | Thinking ahead, Reading the enemy | a battle won |
| Knights & Builders (Versus and the Golden Bean) (`castle`) | solo island place | Building game | Building, Thinking ahead, Teamwork | a level won (campaign) or a match finished (Versus) |
| Pillow Keep Solo (`keepsolo`) | solo island place | Role-playing game | Reading the enemy, Thinking ahead | hero level 2 or a boss asleep (from its save), or a part overcome |
| The School House (`school`) | School House | Learning game | Puzzles | a learning game finished from the School House |
| Tachyon (`tachyon`) | Game Hall (guest) | Aim and shoot | Aiming, Moving and steering | launched (only the launch is seen) |
| Starlite (`starlite`) | Game Hall (guest) | Tactics | Thinking ahead, Building | launched (only the launch is seen) |
| Foothold (`foothold`) | Game Hall (guest) | Tactics | Thinking ahead, Reading the enemy | launched (only the launch is seen) |
| Starhop (`starhop`) | Game Hall (guest) | Adventure | Exploring, Moving and steering | launched (only the launch is seen) |
| Farming (`farm`) | island activity | Life sim | Thinking ahead | the first harvest |
| Fishing (`fishing`) | island activity | Life sim | Timing | a fish caught |
| Diving (`dive`) | island activity | Life sim | Exploring | a dive |
| The café (`cafe`) | island activity | Life sim | Thinking ahead, Timing | a dish served |
| Building in your yard (`build`) | island activity | Building game | Building | a yard piece built |
| Hop trails (`hops`) | island activity | Platformer | Timing, Moving and steering | a hop trail finished |
| Skipping stones (`stones`) | island activity | Party game | Timing | a throw in the green |
| Kite flying (`kite`) | island activity | Party game | Moving and steering | a kite flight finished |
| Games with villagers (`islplay`) | island activity | Party game | Exploring, Aiming | hide-and-seek or a snowball fight with a villager |
| Bubble Buddies (`bubble`) | shared island | Platformer | Timing, Teamwork, Reading the enemy | a game finished (its results screen) |
| Rooftop Rush (`runner`) | shared island | Platformer | Timing, Moving and steering | a game finished (its results screen) |
| Portal Pals (`portal`) | shared island | Puzzle game | Puzzles, Teamwork | a game finished (its results screen) |
| Splash Squad (`splash`) | shared island | Tactics | Aiming, Thinking ahead | a game finished (its results screen) |
| Pillow Keep (`keep`) | shared island | Role-playing game | Reading the enemy, Teamwork | a game finished (its results screen) |
| Spacefall (`spacefall`) | shared island | Aim and shoot | Aiming, Moving and steering | a game finished (its results screen) |
| Paint Pilots (`dogfight`) | shared island | Aim and shoot | Aiming, Moving and steering | a game finished (its results screen) |
| Snowball Fort (`snowball`) | shared island | Aim and shoot | Aiming, Teamwork | a game finished (its results screen) |
| Kart Party (`kart`) | shared island | Racing | Moving and steering, Timing | a game finished (its results screen) |
| Snow Slalom (`slalom`) | shared island | Racing | Moving and steering, Timing | a game finished (its results screen) |
| Space Race (`space`) | shared island | Racing | Moving and steering | a game finished (its results screen) |
| Mega Ball (`football`) | shared island | Sports | Teamwork, Moving and steering | a game finished (its results screen) |
| Ice Hockey (`hockey`) | shared island | Sports | Teamwork, Aiming | a game finished (its results screen) |
| Bean Golf (`golf`) | shared island | Sports | Aiming, Thinking ahead | a game finished (its results screen) |
| Party Mix (`party`) | shared island | Party game | Timing, Reading the enemy | a game finished (its results screen) |
| Bonk Brawl (`brawl`) | shared island | Party game | Reading the enemy, Timing | a game finished (its results screen) |
| Paint Party (`paint`) | shared island | Party game | Moving and steering, Aiming | a game finished (its results screen) |
| Garden Hide & Seek (`hideseek`) | shared island | Party game | Exploring, Reading the enemy | a game finished (its results screen) |
| Cook-Off (`cook`) | shared island | Party game | Teamwork, Thinking ahead | a game finished (its results screen) |
| Grumble King (meadow) (`boss0`) | shared island | Platformer | Timing, Teamwork | a game finished (its results screen) |
| Grumble King (snow fort) (`boss1`) | shared island | Aim and shoot | Aiming, Teamwork | a game finished (its results screen) |
| Grumble King (kitchen) (`boss2`) | shared island | Party game | Teamwork, Thinking ahead | a game finished (its results screen) |
| Grumble King (space) (`boss3`) | shared island | Racing | Moving and steering, Teamwork | a game finished (its results screen) |
| Bokstavballonger (`spelling`) | shared island | Learning game | Puzzles | a game finished (its results screen) |
| Mattejakt (`math`) | shared island | Learning game | Puzzles | a game finished (its results screen) |
| Læringsmiks (`learnmix`) | shared island | Learning game | Puzzles | a game finished (its results screen) |

The four Game Hall guest games are other repositories and only their launch can be seen. Foothold is an
XCOM-style tactics game and Starlite a real-time strategy game (both counted as tactics), and Tachyon is space
flight combat (aim and shoot: counted as a shooter); Starhop (space exploring, adventure) is a best guess from its
name.

## Coach's trials

| Trial | Skill | Lifts to | Detected by |
| --- | --- | --- | --- |
| Clear a Sky Hop level without anyone falling | Timing | silver | Sky Hop results (no falls counted) |
| Catch 3 fish in a row, every press in the green | Timing | gold | the fishing reel (no misses), 3 catches in a row |
| Reach round 3 in Laser Ducks | Aiming | silver | Laser Ducks results or its save (best round) |
| Hit all ten ducks in a round of Laser Ducks | Aiming | gold | Laser Ducks: a perfect round |
| Finish a hop trail without falling off | Moving and steering | silver | a hop trail finished with no falls |
| Win a hop trail race against a friend | Moving and steering | gold | a hop race won (or its save) |
| Find a heart piece in Lighthouse Caves | Exploring | silver | Lighthouse Caves save (heart pieces) |
| Find 3 hidden treasure chests on your island | Exploring | gold | the island save (hidden chests found) |
| Get 3 stars on a Grumble Guides level | Puzzles | silver | Grumble Guides results or its save |
| Finish the first scene of Pudding Island without skipping a puzzle | Puzzles | gold | Pudding Island save (scene 1 done, nothing skipped) |
| Win a Bean Brigade battle without a house getting hit | Thinking ahead | silver | Bean Brigade: a battle won with the grid power it started with |
| Clear Clover Isle in Bean Brigade | Thinking ahead | gold | Bean Brigade save (battles won in a run) |
| Get 3 stars on a Golden Bean level | Building | silver | Golden Bean results or its save |
| Build 10 things in your yard | Building | gold | the island save (yard pieces) |
| Put Big Teddy to sleep in Pillow Keep Solo | Reading the enemy | silver | Pillow Keep Solo save (act 1 boss) |
| Bring two lamp crystals back in Lighthouse Caves | Reading the enemy | gold | Lighthouse Caves save (crystals) |
| Finish a game together with a friend (Play together) | Teamwork | silver | a game finished on the shared island with 2+ players |
| Finish 5 different games together with friends | Teamwork | gold | 5 different games finished together |

## Suggested order (Coach and the map, never forced)

Farming → Sky Hop → Fishing → Laser Ducks → The School House → Skipping stones → Pudding Island → Hop trails (after Sky Hop) → Kite flying → Grumble Guides → Crystal Caves (after Sky Hop) → Lighthouse Caves (after Sky Hop) → Bean Brigade (after Grumble Guides) → Building in your yard → Diving → The café → Knights & Builders (Versus and the Golden Bean) (after Grumble Guides) → Pillow Keep Solo (after Lighthouse Caves) → Tachyon (after Laser Ducks) → Starlite (after Bean Brigade) → Foothold (after Bean Brigade) → Starhop (after Lighthouse Caves).

Coach suggests the first thing on this path not played properly yet whose "after" games are played, preferring
places that are open now and games that train the weakest skill; a closed place comes with how to open it. He
says what it builds on ("It builds on timing from Sky Hop."), and the map marks it with a star. When everything
has been played he suggests a trial for the weakest skill instead. Every place stays open as before.
