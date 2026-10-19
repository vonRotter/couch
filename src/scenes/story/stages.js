import { t, addStrings } from '../../core/i18n.js';

// Story campaign data: four lands, each with three game stages and a Grumble King boss.
// A stage runs an existing game with campaign opts (no votes) and turns the game's
// campaignStats() into 1-3 stars. Every stage gives at least 1 star, so the story never blocks.
//
// Opposition and scaling with the number of players n (stats.n), stage by stage:
//   m1 Sky Hop 1      grumbles walk the level; EVERYONE must reach the flag (harder with more
//                     beans); 3 stars also needs a share of the gems that grows with n.
//   m2 Paint Party    grumble painters smear mud you must repaint (paint.js scales them by n,
//                     opts.grumbles: true); thresholds measured with grumbles on (see PAINT).
//   m3 Bubble Bobble  grumble waves of 3 + n (+2 per wave); the 3-star time drops a little for
//                     big teams since more beans bubble faster.
//   f1 Slalom         bumpers and ramps; the gate goal is per bean (60% / 85% of 20 each).
//   f2 Snowball       all beans vs Snow Bots that wall up and hit your targets; the bots are
//                     capped at 2, so the target goal is per bean (8 + 9n / 14 + 13n), and
//                     3 stars also needs a win over the bots.
//   f3 Hockey         all beans vs goalie grumbles (capped at 2): the goal grows with n.
//   fb..sb bosses     see BOSS_GOALS and the boss files: telegraphed throws, helpers per phase,
//                     all scaled by n.
//   c1 Cooking        orders expire; cook.js already scales order rate by n, goals by COOK.
//   c2 Portal         everyone must reach the exit, two rooms (more beans = more to coordinate).
//   c3 Party rounds   team score; the bar rises a little with n (more hands help in two rounds).
//   s1 Space Race     asteroids; rings per bean (10 each, all 15 each for 3 stars).
//   s2 Rooftop Rush   shared camera; half / all of the team must reach the flag.
//   s3 Bean Golf      strokes per bean against par.

addStrings({
  en: {
    'story.land.0': 'Sunny Meadow', 'story.land.1': 'Frosty Peaks', 'story.land.2': 'Castle Kitchen', 'story.land.3': 'Starry Space',
    'story.tier.play': 'play the stage',
    'story.goal.flag': 'Everyone reaches the flag together!',
    'story.tier.flag': 'everyone reaches the flag',
    'story.tier.gems': 'everyone reaches the flag and the team grabs {n}% of the gems',
    'story.goal.paint': 'Together, paint {n}% of the floor!',
    'story.tier.paint': 'paint {n}% of the floor together',
    'story.goal.bubble': 'Clear all 3 bubble waves together!',
    'story.tier.bubble': 'clear all 3 waves',
    'story.tier.bubbleFast': 'clear all 3 waves within {s} seconds',
    'story.goal.slalom': 'Together, pass {n} gates!',
    'story.tier.gates': 'pass {n} gates together',
    'story.goal.snowball': 'All on one team: hit {n} targets on the Grumble side!',
    'story.tier.targets': 'hit {n} targets together',
    'story.tier.targetsWin': 'hit {n} targets and beat the Snow Bots',
    'story.goal.hockey': 'All on one team: score {n} goals past the Goalie Grumbles!',
    'story.tier.goals': 'score {n} goals together',
    'story.goal.cook': 'Serve {n} orders together!',
    'story.tier.orders': 'serve {n} orders',
    'story.goal.portal': 'Everyone reaches the gold exit, two rooms in a row!',
    'story.tier.rooms': 'clear both rooms',
    'story.tier.roomsFast': 'clear both rooms within {m} minutes',
    'story.goal.party': 'Three team rounds: {a}, {b} and {c}!',
    'story.tier.team': 'good teamwork ({n}% team score)',
    'story.goal.space': 'Fly one lap and pass {n} rings together!',
    'story.tier.rings': 'pass {n} rings together',
    'story.tier.allLap': 'everyone finishes the lap',
    'story.goal.runner': 'Everyone races over the rooftops to the flag!',
    'story.tier.half': 'half the team reaches the flag',
    'story.tier.all': 'everyone reaches the flag',
    'story.goal.golf': 'Three holes: {n} strokes or fewer for the whole team!',
    'story.tier.strokes': '{n} strokes or fewer together',
    'story.goal.boss0': 'Bounce on his head {n} times while he is dizzy!',
    'story.goal.boss1': 'Ring the bells on his snow fort {n} times!',
    'story.goal.boss2': 'Bring him {n} cakes, just the ones he asks for!',
    'story.goal.boss3': 'Fly through {n} of his bubble rings!',
    'story.tier.boss': 'cheer him up before the time runs out',
    'story.tier.bossFast': 'cheer him up within {s} seconds',
    'story.val.flag': '{a} of {b} reached the flag',
    'story.val.paint': '{n}% painted',
    'story.val.bubbleDone': 'All waves cleared in {s} s',
    'story.val.bubble': 'Reached wave {n} of 3',
    'story.val.gates': '{n} gates',
    'story.val.targets': '{n} targets hit',
    'story.val.goals': '{n} goals',
    'story.val.orders': '{n} orders served',
    'story.val.rooms': '{n} of {m} rooms',
    'story.val.team': '{n}% team score',
    'story.val.rings': '{n} rings',
    'story.val.strokes': '{n} strokes',
    'story.val.bossDone': 'Cheered up in {s} s',
    'story.val.boss': '{n} of {m}, so close!',
  },
  no: {
    'story.land.0': 'Solengen', 'story.land.1': 'Frosttoppene', 'story.land.2': 'Slottskjøkkenet', 'story.land.3': 'Stjernerommet',
    'story.tier.play': 'spill banen',
    'story.goal.flag': 'Alle kommer til flagget sammen!',
    'story.tier.flag': 'alle kommer til flagget',
    'story.tier.gems': 'alle kommer til flagget, og laget tar {n} % av diamantene',
    'story.goal.paint': 'Mal {n} % av gulvet sammen!',
    'story.tier.paint': 'mal {n} % av gulvet sammen',
    'story.goal.bubble': 'Klar alle 3 boblebølgene sammen!',
    'story.tier.bubble': 'klar alle 3 bølgene',
    'story.tier.bubbleFast': 'klar alle 3 bølgene på {s} sekunder',
    'story.goal.slalom': 'Kjør gjennom {n} porter sammen!',
    'story.tier.gates': 'kjør gjennom {n} porter sammen',
    'story.goal.snowball': 'Alle på samme lag: treff {n} blinker på Grumle-siden!',
    'story.tier.targets': 'treff {n} blinker sammen',
    'story.tier.targetsWin': 'treff {n} blinker og slå Snøbotene',
    'story.goal.hockey': 'Alle på samme lag: skår {n} mål forbi Grumle-keeperne!',
    'story.tier.goals': 'skår {n} mål sammen',
    'story.goal.cook': 'Server {n} bestillinger sammen!',
    'story.tier.orders': 'server {n} bestillinger',
    'story.goal.portal': 'Alle kommer til gullutgangen, to rom på rad!',
    'story.tier.rooms': 'klar begge rommene',
    'story.tier.roomsFast': 'klar begge rommene på {m} minutter',
    'story.goal.party': 'Tre lagrunder: {a}, {b} og {c}!',
    'story.tier.team': 'godt samarbeid ({n} % lagpoeng)',
    'story.goal.space': 'Fly én runde og kom gjennom {n} ringer sammen!',
    'story.tier.rings': 'kom gjennom {n} ringer sammen',
    'story.tier.allLap': 'alle fullfører runden',
    'story.goal.runner': 'Alle løper over takene til flagget!',
    'story.tier.half': 'halve laget kommer til flagget',
    'story.tier.all': 'alle kommer til flagget',
    'story.goal.golf': 'Tre hull: {n} slag eller færre for hele laget!',
    'story.tier.strokes': '{n} slag eller færre sammen',
    'story.goal.boss0': 'Hopp på hodet hans {n} ganger mens han er svimmel!',
    'story.goal.boss1': 'Ring i bjellene på snøfestningen hans {n} ganger!',
    'story.goal.boss2': 'Kom med {n} kaker, akkurat de han ønsker seg!',
    'story.goal.boss3': 'Fly gjennom {n} av bobleringene hans!',
    'story.tier.boss': 'muntre ham opp før tiden er ute',
    'story.tier.bossFast': 'muntre ham opp på {s} sekunder',
    'story.val.flag': '{a} av {b} kom til flagget',
    'story.val.paint': '{n} % malt',
    'story.val.bubbleDone': 'Alle bølgene klart på {s} s',
    'story.val.bubble': 'Kom til bølge {n} av 3',
    'story.val.gates': '{n} porter',
    'story.val.targets': '{n} blinker truffet',
    'story.val.goals': '{n} mål',
    'story.val.orders': '{n} bestillinger servert',
    'story.val.rooms': '{n} av {m} rom',
    'story.val.team': '{n} % lagpoeng',
    'story.val.rings': '{n} ringer',
    'story.val.strokes': '{n} slag',
    'story.val.bossDone': 'Muntret opp på {s} s',
    'story.val.boss': '{n} av {m}, så nære!',
  },
});

const pick = (list, n) => list[Math.min(list.length, Math.max(1, n)) - 1];
const pct = (v) => Math.round((v || 0) * 100);
const secs = (v) => Math.round(v || 0);

// Slalom has a gate every 22 m over 470 m (see slalom.js): 20 gates.
const SLALOM_GATES = 20;
const GOLF_PAR3 = 8; // par of the first three Bean Golf holes
const SPACE_RINGS = 15; // rings in one Space Race lap, counting the finish ring
const BOSS_TIME = 85; // boss time limit in seconds (see boss-common.js)
const BOSS_FAST = 60;

/** Boss goal counts by player count (shared with the boss scenes). */
export const BOSS_GOALS = [
  (n) => 6 + 2 * n, // meadow: head bounces
  (n) => 6 + 4 * n, // frost: bells rung (10, 14, 18, 22, 26, 30)
  (n) => 6 + 3 * n, // castle: cakes eaten
  (n) => 12 + 4 * n, // space: rings (16, 20, 24, 28, 32, 36; golden rings count 2)
];
export { BOSS_TIME };

/**
 * Each stage: id, game key, opts for the game, goal(n) -> { main, two, three } texts,
 * stars(stats, n) -> 1..3 and value(stats) -> what the team achieved.
 */
function stage(id, key, opts, def) {
  return { id, key, opts, ...def };
}

const flagStage = (id, opts) => stage(id, 'platformer', opts, {
  goal: (n) => ({ main: t('story.goal.flag'), two: t('story.tier.flag'), three: t('story.tier.gems', { n: pick(GEMS, n) }) }),
  stars: (s, n) => (s.finished >= s.players ? (s.gems * 100 >= s.totalGems * pick(GEMS, n) ? 3 : 2) : 1),
  value: (s) => t('story.val.flag', { a: s.finished, b: s.players }),
});

const bossStage = (id, chapter) => stage(id, `boss${chapter}`, {}, {
  boss: true,
  goal: (n) => ({ main: t(`story.goal.boss${chapter}`, { n: BOSS_GOALS[chapter](n) }), two: t('story.tier.boss'), three: t('story.tier.bossFast', { s: BOSS_FAST }) }),
  stars: (s) => (s.done ? (s.time <= BOSS_FAST ? 3 : 2) : s.progress >= 0.6 ? 2 : 1),
  value: (s) => (s.done ? t('story.val.bossDone', { s: secs(s.time) }) : t('story.val.boss', { n: s.count, m: s.goal })),
});

// Paint Party with grumble painters (opts.grumbles: true scales them 2..7 by n, +1 at 20 s and
// 40 s). Measured share painted: random play 1p 35-41%, 2p 46-58%, 4p 67-76%; a skilled bot
// 1p 62-63%, 2p 78-80%, 4p 92-95%. Two stars sits around good random play, three needs skill.
const PAINT = { two: [45, 60, 70, 72, 74, 75], three: [60, 75, 85, 87, 88, 89] };
const COOK = { two: [3, 4, 4, 5, 5, 6], three: [5, 6, 7, 8, 8, 9] };
// Sky Hop 1: share of the gems the team needs for 3 stars (more beans can grab more).
const GEMS = [40, 50, 55, 60, 65, 70];
// Bubble Bobble: seconds to clear all waves for 3 stars (more beans, more bubbles flying).
const BUBBLE_FAST = [120, 110, 100, 95, 90, 90];
// Snowball fight vs the Snow Bots: targets hit by the team. Aim assist is generous: random
// button mashing hit 16-21 (1p), 17-21 (2p) and 42-43 (4p) targets in 90 s, so the bar is per bean.
const SNOW = { two: (n) => 8 + 9 * n, three: (n) => 14 + 13 * n }; // 17/27, 26/40, 35/53, 44/66 ...
// Hockey vs the Goalie Grumbles: goals by the team.
const HOCKEY = { two: [2, 3, 4, 5, 5, 6], three: [4, 5, 6, 8, 8, 9] };
// Party rounds: team score (%) for 2 and 3 stars, a little higher for bigger teams.
const PARTY = { two: (n) => Math.min(55, 43 + 2 * n), three: (n) => Math.min(85, 73 + 2 * n) };

export const CHAPTERS = [
  {
    key: 'meadow', color: 0x7ad65a, css: '#3f9a32', sky: 0x9fdcff,
    stages: [
      flagStage('m1', { level: 0 }),
      stage('m2', 'paint', { grumbles: true }, {
        goal: (n) => ({ main: t('story.goal.paint', { n: pick(PAINT.two, n) }), two: t('story.tier.paint', { n: pick(PAINT.two, n) }), three: t('story.tier.paint', { n: pick(PAINT.three, n) }) }),
        stars: (s, n) => (pct(s.painted) >= pick(PAINT.three, n) ? 3 : pct(s.painted) >= pick(PAINT.two, n) ? 2 : 1),
        value: (s) => t('story.val.paint', { n: pct(s.painted) }),
      }),
      stage('m3', 'bubble', {}, {
        goal: (n) => ({ main: t('story.goal.bubble'), two: t('story.tier.bubble'), three: t('story.tier.bubbleFast', { s: pick(BUBBLE_FAST, n) }) }),
        stars: (s, n) => (s.cleared ? (s.time <= pick(BUBBLE_FAST, n) ? 3 : 2) : 1),
        value: (s) => (s.cleared ? t('story.val.bubbleDone', { s: secs(s.time) }) : t('story.val.bubble', { n: Math.max(1, s.waves || 1) })),
      }),
      bossStage('mb', 0),
    ],
  },
  {
    key: 'frost', color: 0xdff3ff, css: '#3d84e8', sky: 0xc9ecff,
    stages: [
      stage('f1', 'slalom', {}, {
        goal: (n) => {
          const [a, b] = [Math.round(SLALOM_GATES * n * 0.6), Math.round(SLALOM_GATES * n * 0.85)];
          return { main: t('story.goal.slalom', { n: a }), two: t('story.tier.gates', { n: a }), three: t('story.tier.gates', { n: b }) };
        },
        stars: (s, n) => (s.gates >= Math.round(SLALOM_GATES * n * 0.85) ? 3 : s.gates >= Math.round(SLALOM_GATES * n * 0.6) ? 2 : 1),
        value: (s) => t('story.val.gates', { n: s.gates }),
      }),
      stage('f2', 'snowball', { coop: true, length: 90 }, {
        goal: (n) => ({ main: t('story.goal.snowball', { n: SNOW.two(n) }), two: t('story.tier.targets', { n: SNOW.two(n) }), three: t('story.tier.targetsWin', { n: SNOW.three(n) }) }),
        stars: (s, n) => (s.team >= SNOW.three(n) && s.team > (s.bots || 0) ? 3 : s.team >= SNOW.two(n) ? 2 : 1),
        value: (s) => t('story.val.targets', { n: s.team }),
      }),
      stage('f3', 'hockey', { coop: true, length: 90 }, {
        goal: (n) => ({ main: t('story.goal.hockey', { n: pick(HOCKEY.two, n) }), two: t('story.tier.goals', { n: pick(HOCKEY.two, n) }), three: t('story.tier.goals', { n: pick(HOCKEY.three, n) }) }),
        stars: (s, n) => (s.team >= pick(HOCKEY.three, n) ? 3 : s.team >= pick(HOCKEY.two, n) ? 2 : 1),
        value: (s) => t('story.val.goals', { n: s.team }),
      }),
      bossStage('fb', 1),
    ],
  },
  {
    key: 'castle', color: 0xffd6a5, css: '#e85a35', sky: 0xffe0c2,
    stages: [
      stage('c1', 'cook', {}, {
        goal: (n) => ({ main: t('story.goal.cook', { n: pick(COOK.two, n) }), two: t('story.tier.orders', { n: pick(COOK.two, n) }), three: t('story.tier.orders', { n: pick(COOK.three, n) }) }),
        stars: (s, n) => (s.served >= pick(COOK.three, n) ? 3 : s.served >= pick(COOK.two, n) ? 2 : 1),
        value: (s) => t('story.val.orders', { n: s.served }),
      }),
      stage('c2', 'portal', { room: 0, rooms: 2 }, {
        goal: () => ({ main: t('story.goal.portal'), two: t('story.tier.rooms'), three: t('story.tier.roomsFast', { m: 3 }) }),
        stars: (s) => (s.rooms >= s.roomCount ? (s.time <= 180 ? 3 : 2) : 1),
        value: (s) => t('story.val.rooms', { n: s.rooms, m: s.roomCount }),
      }),
      stage('c3', 'party', { rounds: ['keepy', 'tower', 'paintnum'] }, {
        goal: (n) => ({ main: t('story.goal.party', { a: t('keepy.title'), b: t('tower.title'), c: t('paintnum.title') }), two: t('story.tier.team', { n: PARTY.two(n) }), three: t('story.tier.team', { n: PARTY.three(n) }) }),
        stars: (s, n) => (pct(s.team) >= PARTY.three(n) ? 3 : pct(s.team) >= PARTY.two(n) ? 2 : 1),
        value: (s) => t('story.val.team', { n: pct(s.team) }),
      }),
      bossStage('cb', 2),
    ],
  },
  {
    key: 'space', color: 0x6a4fd8, css: '#5a3fd0', sky: 0x2a1d66,
    stages: [
      stage('s1', 'space', { laps: 1 }, {
        goal: (n) => ({ main: t('story.goal.space', { n: 10 * n }), two: t('story.tier.rings', { n: 10 * n }), three: t('story.tier.allLap') }),
        stars: (s, n) => (s.finished >= s.players && s.rings >= SPACE_RINGS * s.players ? 3 : s.rings >= 10 * n ? 2 : 1),
        value: (s) => t('story.val.rings', { n: s.rings }),
      }),
      stage('s2', 'runner', {}, {
        goal: () => ({ main: t('story.goal.runner'), two: t('story.tier.half'), three: t('story.tier.all') }),
        stars: (s) => (s.finished >= s.players ? 3 : s.finished * 2 >= s.players ? 2 : 1),
        value: (s) => t('story.val.flag', { a: s.finished, b: s.players }),
      }),
      stage('s3', 'golf', { holes: 3 }, {
        goal: (n) => ({ main: t('story.goal.golf', { n: (GOLF_PAR3 + 4) * n }), two: t('story.tier.strokes', { n: (GOLF_PAR3 + 4) * n }), three: t('story.tier.strokes', { n: (GOLF_PAR3 + 2) * n }) }),
        stars: (s) => (s.strokes <= (s.par + 2) * s.players ? 3 : s.strokes <= (s.par + 4) * s.players ? 2 : 1),
        value: (s) => t('story.val.strokes', { n: s.strokes }),
      }),
      bossStage('sb', 3),
    ],
  },
];

// Flat list of every node in path order, with its chapter and index.
export const NODES = CHAPTERS.flatMap((ch, c) => ch.stages.map((s, i) => ({ ...s, chapter: c, index: i, land: ch })));
export const MAX_STARS = NODES.length * 3;

/** Stars for a finished stage: always 1-3. An early exit from the pause menu counts as 1. */
export function stageStars(node, result) {
  if (!result || result.quit || !result.stats) return 1;
  const s = result.stats;
  const n = s.n || 1;
  let v = 1;
  try { v = node.stars(s, n); } catch { v = 1; }
  return Math.max(1, Math.min(3, Math.round(v) || 1));
}

export function stageValue(node, result) {
  if (!result || result.quit || !result.stats) return '';
  try { return node.value(result.stats); } catch { return ''; }
}

/** Display name for a node, e.g. "Sunny Meadow 2 · Paint Party". */
export function nodeTitle(node) {
  const land = t(`story.land.${node.chapter}`);
  return node.boss ? `${land} · ${t('story.speaker.king')}` : `${land} ${node.index + 1} · ${t(`game.${node.key}`)}`;
}
