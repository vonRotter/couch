import { SLOTS, BAG_W, BAG_H, STASH_W, STASH_H, fixItem, starterItem, useItem, reqOf, shopBelt } from './items.js';
import { CLASS_IDS, MAX_LEVEL, TREE, B_MOVE, OLD_SKILLS, STAT_IDS, BASE_STATS, STAT_POINTS, SKILL_POINTS, MAX_RANK } from './classes.js';
import { ACT_COUNT, makeQuest } from './acts.js';
import { Grid, packInto } from './grid.js';

// Pillow Keep Solo progress, per solo profile in roster.progress.keepSolo:
//   { v: 2, last (class picked last time), stash: [{ it, x, y }] (14x10 grid, shared by the heroes),
//     lost: [items] (the lost-and-found chest in town: old items that did not fit anywhere), zoom,
//     classes: { knight, archer, wizard } }
// One save per class:
//   { level, xp, coins, fluff, attrs: { str, dex, mag, vit } (spent stat points), statPts, skillPts,
//     ranks: { skill: rank }, bar: { rmb, k: [4 skills] } (right mouse button and keys 1-4),
//     gear: { slot: item }, bag: [{ it, x, y }] (10x4 grid), belt: [8 potions / scrolls] (4 columns,
//     keys 5-8; index = row * 4 + column, row 0 is the bottom one),
//     diff (difficulty: 0 Normal, 1 Nightmare, 2 Hell), tiers: [{ reached, bosses, deepBest }] per difficulty,
//     reached / bosses / deepBest (the same for the current difficulty), quests: [3],
//     stats: { fluffed, elites, nests, rares, deaths, found, bosses, champs, uniques },
//     drop: null | { g, diff, seed, x, z, items: [...] }  the bag that fell where the hero fainted (only the latest one),
//     tips: { seen tip keys }, started }
// Old saves (v1: 32-cell bag lists, potions as a number, skills by level) are moved over in
// migrateHero(): nothing is ever thrown away.

export const BELT_SLOTS = 8;
export const DIFF_COUNT = 3;

const tierRec = () => ({ reached: 0, bosses: new Array(ACT_COUNT).fill(false), deepBest: 0 });

function newHero(cls) {
  const bm = B_MOVE[cls];
  const belt = new Array(BELT_SLOTS).fill(null);
  belt[0] = useItem('hp'); belt[1] = useItem('hp'); belt[2] = useItem('mp'); belt[3] = useItem('tp');
  return {
    level: 1, xp: 0, coins: 0, fluff: 0,
    attrs: { str: 0, dex: 0, mag: 0, vit: 0 }, statPts: 0, skillPts: SKILL_POINTS, ranks: { [bm]: 1 }, bar: { rmb: null, k: [bm, null, null, null] },
    gear: { weapon: starterItem(cls, 'weapon') }, bag: [], belt,
    diff: 0, tiers: [tierRec(), tierRec(), tierRec()], reached: 0, bosses: new Array(ACT_COUNT).fill(false), deepBest: 0,
    quests: [], stats: { fluffed: 0, elites: 0, nests: 0, rares: 0, deaths: 0, found: 0, bosses: 0, champs: 0, uniques: 0 },
    drop: null, tips: {}, started: false,
  };
}

const num = (v, d = 0, max = Infinity) => (Number.isFinite(v) ? Math.max(0, Math.min(max, v)) : d);

/** Load a list of grid entries (dropping overlaps and broken items into `spill`). */
function loadGrid(list, w, h, spill) {
  const out = [];
  const g = new Grid(out, w, h);
  if (!Array.isArray(list)) return out;
  for (const e of list) {
    const it = fixItem(e?.it);
    if (!it) continue;
    if (Number.isInteger(e.x) && Number.isInteger(e.y) && g.fits(it, e.x, e.y)) g.place(it, e.x, e.y);
    else spill.push(it);
  }
  return out;
}

function fixTier(t) {
  return { reached: num(t?.reached | 0), bosses: Array.from({ length: ACT_COUNT }, (_, i) => !!t?.bosses?.[i]), deepBest: num(t?.deepBest | 0) };
}

/**
 * A hero save of either version, made whole. `ctx` = { stash: Grid, lost: [] } for items that do not
 * fit (v1 bags were 32 one-cell slots; the new bag is a 10x4 grid of different item sizes).
 */
function fixHero(cls, h, ctx) {
  const d = newHero(cls);
  if (!h || typeof h !== 'object') return d;
  const old = !(h.v >= 2);
  const gear = {};
  const spill = [];
  for (const slot of SLOTS) {
    const it = fixItem(h.gear?.[slot]);
    if (it && it.slot === slot && (!it.cls || it.cls === cls)) gear[slot] = it;
  }
  if (!gear.weapon) gear.weapon = starterItem(cls, 'weapon');
  const level = Math.max(1, Math.min(MAX_LEVEL, h.level | 0 || 1));
  const stats = { ...d.stats };
  for (const k in stats) stats[k] = num(h.stats?.[k] | 0);
  let drop = null;
  if (h.drop && Number.isFinite(h.drop.g) && Array.isArray(h.drop.items)) {
    const items = h.drop.items.map(fixItem).filter(Boolean);
    if (items.length) drop = { g: h.drop.g | 0, diff: Math.min(2, h.drop.diff | 0), seed: h.drop.seed >>> 0, x: +h.drop.x || 0, z: +h.drop.z || 0, items };
  }
  const out = {
    v: 2, level, xp: num(h.xp), coins: num(h.coins | 0), fluff: num(h.fluff | 0),
    attrs: { str: 0, dex: 0, mag: 0, vit: 0 }, statPts: 0, skillPts: 0, ranks: {}, bar: { rmb: null, k: [null, null, null, null] },
    gear, bag: [], belt: new Array(BELT_SLOTS).fill(null),
    diff: Math.max(0, Math.min(2, h.diff | 0)), tiers: [0, 1, 2].map((i) => fixTier(h.tiers?.[i])),
    reached: num(h.reached | 0), bosses: Array.from({ length: ACT_COUNT }, (_, i) => !!h.bosses?.[i]), deepBest: num(h.deepBest | 0),
    quests: Array.isArray(h.quests) ? h.quests.filter((q) => q && typeof q.kind === 'string' && q.reward).slice(0, 3) : [],
    stats, drop, tips: h.tips && typeof h.tips === 'object' ? { ...h.tips } : {}, started: !!h.started,
  };
  if (old) migrateHero(cls, h, out, spill);
  else {
    for (const k of STAT_IDS) out.attrs[k] = num(h.attrs?.[k] | 0);
    out.statPts = num(h.statPts | 0);
    out.skillPts = num(h.skillPts | 0);
    for (const s of TREE[cls]) { const r = h.ranks?.[s.id] | 0; if (r > 0) out.ranks[s.id] = Math.min(MAX_RANK, r); }
    const known = (id) => (typeof id === 'string' && out.ranks[id] ? id : null);
    out.bar.rmb = known(h.bar?.rmb);
    for (let i = 0; i < 4; i++) out.bar.k[i] = known(h.bar?.k?.[i]);
    out.bag = loadGrid(h.bag, BAG_W, BAG_H, spill);
    if (Array.isArray(h.belt)) for (let i = 0; i < BELT_SLOTS; i++) { const it = fixItem(h.belt[i]); if (it?.slot === 'use') out.belt[i] = it; }
    // the points a hero should have at this level (fixes saves that missed some)
    const spentS = STAT_IDS.reduce((a, k) => a + out.attrs[k], 0);
    out.statPts = Math.max(out.statPts, STAT_POINTS * (level - 1) - spentS);
    const spentK = Object.entries(out.ranks).reduce((a, [id, r]) => a + r - (TREE[cls].find((s) => s.id === id)?.free ? 1 : 0), 0);
    out.skillPts = Math.max(out.skillPts, SKILL_POINTS * level - spentK);
  }
  const bm = B_MOVE[cls];
  if (!out.ranks[bm]) out.ranks[bm] = 1;
  // the current difficulty's progress lives in reached / bosses / deepBest
  if (old) out.tiers[0] = { reached: out.reached, bosses: [...out.bosses], deepBest: out.deepBest };
  // things that did not fit: the stash, then the lost-and-found chest
  for (const it of spill) if (!ctx.stash.add(it)) ctx.lost.push(it);
  return out;
}

/**
 * v1 → v2: bag list → bag grid (what does not fit goes to the stash or the lost-and-found chest),
 * potions → red potions on the new belt (a belt to wear when the old belt held more than 4),
 * the level's stat and skill points (spent first on what worn gear needs, then on the skills the
 * hero already knew at rank 1; the rest is left to spend), and the old chosen skill on the right button.
 */
function migrateHero(cls, h, out, spill) {
  const level = out.level;
  // items: the old bag list into the new grid
  const items = Array.isArray(h.bag) ? h.bag.map(fixItem).filter(Boolean) : [];
  const bag = new Grid(out.bag, BAG_W, BAG_H);
  for (const it of packInto(bag, items)) spill.push(it);
  // belt: old belts held 3-6 potions; more than 4 needs a belt to wear (8 slots)
  const oldBelt = Math.max(3, Math.min(6, h.belt | 0 || 3));
  if (oldBelt > 4 && !out.gear.belt) out.gear.belt = shopBelt(0);
  const cap = out.gear.belt ? 8 : 4;
  const pots = Math.min(cap, num(h.potions | 0, 2, 99));
  for (let i = 0; i < pots; i++) out.belt[i] = useItem('hp');
  // one Town Portal scroll to start with (the portal used to be a free spell)
  if (pots < cap) out.belt[pots] = useItem('tp'); else if (!bag.add(useItem('tp'))) spill.push(useItem('tp'));
  // stat points: what worn gear needs first
  let pts = STAT_POINTS * (level - 1);
  const base = BASE_STATS[cls];
  for (const slot of SLOTS) {
    const it = out.gear[slot];
    if (!it) continue;
    const r = reqOf(it);
    for (const k in r) {
      const need = r[k] - (base[k] + out.attrs[k]);
      if (need > 0) { const give = Math.min(need, pts); out.attrs[k] += give; pts -= give; }
    }
  }
  out.statPts = pts;
  // skill points: the skills the hero already had (rank 1), the rest to spend
  let sp = SKILL_POINTS * level;
  const learned = [];
  for (const [id, lv] of OLD_SKILLS[cls]) if (level >= lv && sp > 0) { out.ranks[id] = 1; sp--; learned.push(id); }
  out.skillPts = sp;
  const bm = B_MOVE[cls];
  out.ranks[bm] = 1;
  const sel = learned[Math.min(Math.max(0, h.sel | 0), learned.length - 1)] || null;
  out.bar.rmb = sel;
  out.bar.k = [bm, ...learned.filter((x) => x !== sel), null, null, null].slice(0, 4);
  out.tips.migrated = true; // say hello to the new controls once
}

/** Fill the quest board up to three quests of different kinds. */
export function fillQuests(hero) {
  while (hero.quests.length < 3) hero.quests.push(makeQuest(hero, hero.quests.map((q) => q.kind)));
}

export function loadKeepSolo(roster) {
  const p = roster.progress.keepSolo || {};
  const old = !(p.v >= 2);
  const lost = Array.isArray(p.lost) ? p.lost.map(fixItem).filter(Boolean) : [];
  const stashList = [];
  const stash = new Grid(stashList, STASH_W, STASH_H);
  if (old) {
    // v1 stash: 48 one-cell slots
    const items = Array.isArray(p.stash) ? p.stash.map(fixItem).filter(Boolean) : [];
    lost.push(...packInto(stash, items));
  } else {
    const spill = [];
    stashList.push(...loadGrid(p.stash, STASH_W, STASH_H, spill));
    lost.push(...spill);
  }
  const ctx = { stash, lost };
  const classes = {};
  for (const cls of CLASS_IDS) { classes[cls] = fixHero(cls, p.classes?.[cls], ctx); fillQuests(classes[cls]); }
  return { v: 2, last: CLASS_IDS.includes(p.last) ? p.last : 'knight', stash: stashList, lost, zoom: +p.zoom || 1, classes, migrated: old && !!p.classes };
}

/** Normal-difficulty progress of a hero (whatever difficulty it plays now). */
const normal = (h) => (h.diff ? h.tiers[0] : h);

/** Summary numbers the solo island reads (place text and reward letters). */
export function summary(data) {
  const heroes = Object.values(data.classes);
  return {
    best: Math.max(...heroes.map((h) => h.level)),
    act1: heroes.some((h) => normal(h).bosses[0]),
    final: heroes.some((h) => normal(h).bosses[ACT_COUNT - 1]),
    deep: Math.max(...heroes.map((h) => normal(h).deepBest)),
    acts: Math.max(...heroes.map((h) => normal(h).bosses.filter(Boolean).length)),
    tier: Math.max(...heroes.map((h) => (h.tiers[1].bosses[ACT_COUNT - 1] || (h.diff === 1 && h.bosses[ACT_COUNT - 1]) ? 2 : h.tiers[0].bosses[ACT_COUNT - 1] || (h.diff === 0 && h.bosses[ACT_COUNT - 1]) ? 1 : 0))),
  };
}

/** Switch a hero to another difficulty (its progress there comes back). */
export function setDifficulty(hero, diff) {
  hero.tiers[hero.diff] = { reached: hero.reached, bosses: [...hero.bosses], deepBest: hero.deepBest };
  hero.diff = diff;
  const t = hero.tiers[diff];
  hero.reached = t.reached; hero.bosses = [...t.bosses]; hero.deepBest = t.deepBest;
}

/** Has this hero beaten the Sleepy Sheep on difficulty d? */
export function beatTier(hero, d) {
  return hero.diff === d ? hero.bosses[ACT_COUNT - 1] : hero.tiers[d].bosses[ACT_COUNT - 1];
}

export function saveKeepSolo(roster, data) {
  const out = JSON.parse(JSON.stringify(data));
  for (const h of Object.values(out.classes)) h.v = 2;
  delete out.migrated;
  out.summary = summary(data); // for the island (place text and letters)
  roster.progress.keepSolo = out;
  roster.save();
}
