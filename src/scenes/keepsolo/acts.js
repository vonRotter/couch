// The four acts of Pillow Keep Solo and the endless Deep Keep below them.
//
// A place in the keep is one number, the global floor g:
//   g 0-11   act floors (act = floor(g / 3), floor = g % 3; the third floor of each act is the boss's)
//   g 12+    the Deep Keep, depth g - 11 (a boss waits on every fifth depth)
// g is also the difficulty D: grumble health and hits, item levels and rewards all grow with it.

export const ACT_FLOORS = 3;
export const ACT_COUNT = 4;
export const DEEP_START = ACT_COUNT * ACT_FLOORS; // g of Deep Keep depth 1
export const DEEP_BOSS_EVERY = 5;

// Dungeon looks: floor checker, walls, rugs, the color of plain grumbles, the sky gradient.
export const ACTS = [
  {
    id: 'cellars', boss: 'teddy', mix: 0,
    theme: { floorA: 0xf2d2a4, floorB: 0xe6c291, wall: 0xb79fd6, cap: 0xd3c3ea, rug: 0xe0566f, rugIn: 0xff8fa8, grumble: 0x7b6cf6, sky: ['#2a1d45', '#6b4a7e'], props: 'cellars' },
  },
  {
    id: 'forest', boss: 'goose', mix: 1,
    theme: { floorA: 0xcfe8b8, floorB: 0xbddca6, wall: 0x5fa86a, cap: 0x8fd08a, rug: 0xe0a24a, rugIn: 0xffd27a, grumble: 0x8a6cf0, sky: ['#183a2a', '#4a7e5a'], props: 'forest' },
  },
  {
    id: 'grotto', boss: 'duck', mix: 2,
    theme: { floorA: 0xdcf2f8, floorB: 0xc6e6f0, wall: 0x6fb0d8, cap: 0xb8e0f4, rug: 0xff8fb8, rugIn: 0xffd0e4, grumble: 0x6c7bf6, sky: ['#14304a', '#3e6b8e'], props: 'grotto' },
  },
  {
    id: 'dream', boss: 'sheep', mix: 3,
    theme: { floorA: 0xd6c6ec, floorB: 0xc8b5e2, wall: 0x8a76c4, cap: 0xb3a5e0, rug: 0x8a45e0, rugIn: 0xc9a8ff, grumble: 0xd9549a, sky: ['#2a1d45', '#6b4a7e'], props: 'dream' },
  },
];
export const DEEP_THEME = { floorA: 0xcdc4e0, floorB: 0xbdb2d4, wall: 0x5a4a8a, cap: 0x8a7ab8, rug: 0xffb400, rugIn: 0xffe27a, grumble: 0xff5d9a, sky: ['#0e0a24', '#3a2a5e'], props: 'dream' };
const DEEP_BOSSES = ['teddy', 'goose', 'duck', 'sheep'];

// Difficulty tiers: Nightmare and Hell replay the acts (and their own Deep Keep) with the
// difficulty number D pushed up by this much (D drives grumble health and hits, item levels, XP).
export const DIFF_OFFSET = [0, 12, 24];
export const diffOffset = (diff) => DIFF_OFFSET[diff] || 0;

export const isDeep = (g) => g >= DEEP_START;
export const deepDepth = (g) => g - DEEP_START + 1;
export const actOf = (g) => Math.min(ACT_COUNT - 1, Math.floor(g / ACT_FLOORS));

/** Floor plan for the dungeon generator (keep/dungeon.js), plus the boss key if there is one. */
export function floorPlan(g) {
  if (!isDeep(g)) {
    const act = actOf(g), f = g % ACT_FLOORS;
    const boss = f === ACT_FLOORS - 1 ? ACTS[act].boss : null;
    if (boss) return { mx: 3, my: 2, locks: act >= 2 ? 2 : 1, nests: 2 + (act >= 2 ? 1 : 0), chests: 1 + (act >= 1 ? 1 : 0), elites: 1 + (act >= 3 ? 1 : 0), packs: 3 + act, arena: boss };
    return [
      { mx: 3, my: 2, locks: 1, nests: 2 + Math.min(1, act), chests: 2, elites: 1, packs: 3 + act },
      { mx: 3, my: 3, locks: act >= 2 ? 2 : 1, nests: 3 + Math.min(2, act), chests: 2, elites: 1 + (act >= 2 ? 1 : 0), packs: 4 + act },
    ][f];
  }
  const d = deepDepth(g);
  const boss = d % DEEP_BOSS_EVERY === 0 ? DEEP_BOSSES[(d / DEEP_BOSS_EVERY - 1) % DEEP_BOSSES.length] : null;
  if (boss) return { mx: 3, my: 2, locks: 2, nests: 3, chests: 2, elites: 2, packs: 5, arena: boss };
  return { mx: 3 + (d % 2), my: 3, locks: 1 + (d % 3 === 0 ? 1 : 0), nests: 3 + Math.min(3, Math.floor(d / 4)), chests: 2, elites: 1 + Math.min(3, Math.floor(d / 3)), packs: 4 + Math.min(4, Math.floor(d / 3)) };
}

export function themeOf(g) {
  return isDeep(g) ? DEEP_THEME : ACTS[actOf(g)].theme;
}

/** Which grumble kinds show up (keep/foes.js MIX row). */
export function mixOf(g) {
  return isDeep(g) ? 4 : ACTS[actOf(g)].mix;
}

// ---------------------------------------------------------------- difficulty numbers

/** Health of a plain grumble at difficulty D. */
export const foeHpAt = (D) => 15 * 1.2 ** D;
/** Damage for one "unit" of a grumble or boss hit (keep/foes.js and the bosses give 0.2-0.45 units). */
export const foeHitAt = (D) => 34 * 1.16 ** D;
/** XP for one unit of grumble XP. */
export const xpAt = (D) => 1.6 * 1.17 ** D;
/** Boss health (a boss is worth this many plain grumbles). */
export const bossHpAt = (D, boss, deep = false) => foeHpAt(D) * ({ teddy: 26, goose: 32, duck: 36, sheep: 46 }[boss] || 32) * (deep ? 1.25 : 1);

// ---------------------------------------------------------------- quests

// Quest board: three quests at a time; a claimed one is replaced by a new kind.
//   fluff N grumbles · fluff N named (elite) grumbles · fluff N nests · reach floor g · find N rare items
export const QUEST_KINDS = ['fluff', 'elite', 'nest', 'floor', 'find'];

/** A new quest for a hero save (counters come from save.stats). */
export function makeQuest(save, avoid = [], rand = Math.random) {
  const kinds = QUEST_KINDS.filter((k) => !avoid.includes(k));
  const kind = kinds[Math.floor(rand() * kinds.length)];
  const st = save.stats;
  const lv = save.level;
  const reward = { coins: Math.round(30 + lv * 12 + rand() * 20), xp: Math.round(30 * 1.2 ** Math.min(40, lv)) };
  let q;
  if (kind === 'fluff') q = { kind, n: 20 + 5 * Math.floor(rand() * 5) + Math.min(40, lv * 2), base: st.fluffed };
  else if (kind === 'elite') q = { kind, n: 2 + Math.floor(rand() * 3), base: st.elites };
  else if (kind === 'nest') q = { kind, n: 3 + Math.floor(rand() * 4), base: st.nests };
  else if (kind === 'find') q = { kind, n: 2, base: st.rares };
  else q = { kind: 'floor', n: Math.min(save.reached + 1 + Math.floor(rand() * 2), isDeep(save.reached) ? save.reached + 3 : DEEP_START + 2), base: 0 };
  q.reward = reward;
  if (kind === 'elite' || kind === 'find') q.reward.item = true; // a magic-or-better item too
  return q;
}

/** Progress of a quest: [have, need]. */
export function questProgress(save, q) {
  const st = save.stats;
  if (q.kind === 'floor') return [Math.min(q.n, save.reached) >= q.n ? 1 : 0, 1];
  const have = { fluff: st.fluffed, elite: st.elites, nest: st.nests, find: st.rares }[q.kind] - q.base;
  return [Math.max(0, Math.min(q.n, have)), q.n];
}

export const questDone = (save, q) => { const [a, b] = questProgress(save, q); return a >= b; };
