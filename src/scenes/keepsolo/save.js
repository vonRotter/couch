import { BAG_N, STASH_N, SLOTS, fixItem, starterItem } from './items.js';
import { CLASS_IDS, MAX_LEVEL } from './classes.js';
import { ACT_COUNT, makeQuest } from './acts.js';

// Pillow Keep Solo progress, per solo profile in roster.progress.keepSolo:
//   { v, last (class picked last time), stash: [48 cells, shared by the three classes],
//     classes: { knight, archer, wizard } }
// One save per class:
//   { level, xp, coins, fluff, potions, belt (potion slots), gear: { slot: item }, bag: [32 cells],
//     reached (deepest global floor reached, see acts.js), bosses: [4 act bosses beaten], deepBest,
//     quests: [3], stats: { fluffed, elites, nests, rares, deaths, found, bosses }, sel (chosen [C] skill),
//     drop: null | { g, seed, x, z, items: [...] }   the bag that fell where the hero fainted (only the latest one),
//     tips: { seen tip keys } }
// Missing or broken parts get defaults, so old saves and new profiles both load.

export const BELT_START = 3, BELT_MAX = 6;

function newHero(cls) {
  return {
    level: 1, xp: 0, coins: 0, fluff: 0, potions: 2, belt: BELT_START,
    gear: { weapon: starterItem(cls, 'weapon') },
    bag: new Array(BAG_N).fill(null), reached: 0, bosses: new Array(ACT_COUNT).fill(false), deepBest: 0,
    quests: [], stats: { fluffed: 0, elites: 0, nests: 0, rares: 0, deaths: 0, found: 0, bosses: 0 }, sel: 0, drop: null, tips: {}, started: false,
  };
}

const num = (v, d = 0, max = Infinity) => (Number.isFinite(v) ? Math.max(0, Math.min(max, v)) : d);

function fixHero(cls, h) {
  const d = newHero(cls);
  if (!h || typeof h !== 'object') return d;
  const gear = {};
  for (const slot of SLOTS) {
    const it = fixItem(h.gear?.[slot]);
    if (it && it.slot === slot && (!it.cls || it.cls === cls)) gear[slot] = it;
  }
  if (!gear.weapon) gear.weapon = starterItem(cls, 'weapon');
  const bag = new Array(BAG_N).fill(null);
  if (Array.isArray(h.bag)) h.bag.slice(0, BAG_N).forEach((it, i) => { bag[i] = fixItem(it); });
  const stats = { ...d.stats };
  for (const k in stats) stats[k] = num(h.stats?.[k] | 0);
  let drop = null;
  if (h.drop && Number.isFinite(h.drop.g) && Array.isArray(h.drop.items)) {
    const items = h.drop.items.map(fixItem).filter(Boolean);
    if (items.length) drop = { g: h.drop.g | 0, seed: h.drop.seed >>> 0, x: +h.drop.x || 0, z: +h.drop.z || 0, items };
  }
  const out = {
    level: Math.max(1, Math.min(MAX_LEVEL, h.level | 0 || 1)), xp: num(h.xp), coins: num(h.coins | 0), fluff: num(h.fluff | 0),
    potions: num(h.potions | 0, 2, 99), belt: Math.max(BELT_START, Math.min(BELT_MAX, h.belt | 0)),
    gear, bag, reached: num(h.reached | 0), bosses: Array.from({ length: ACT_COUNT }, (_, i) => !!h.bosses?.[i]), deepBest: num(h.deepBest | 0),
    quests: Array.isArray(h.quests) ? h.quests.filter((q) => q && typeof q.kind === 'string' && q.reward).slice(0, 3) : [],
    stats, sel: Math.max(0, Math.min(4, h.sel | 0)), drop, tips: h.tips && typeof h.tips === 'object' ? { ...h.tips } : {}, started: !!h.started,
  };
  out.potions = Math.min(out.potions, out.belt);
  return out;
}

/** Fill the quest board up to three quests of different kinds. */
export function fillQuests(hero) {
  while (hero.quests.length < 3) hero.quests.push(makeQuest(hero, hero.quests.map((q) => q.kind)));
}

export function loadKeepSolo(roster) {
  const p = roster.progress.keepSolo || {};
  const classes = {};
  for (const cls of CLASS_IDS) { classes[cls] = fixHero(cls, p.classes?.[cls]); fillQuests(classes[cls]); }
  const stash = new Array(STASH_N).fill(null);
  if (Array.isArray(p.stash)) p.stash.slice(0, STASH_N).forEach((it, i) => { stash[i] = fixItem(it); });
  return { v: 1, last: CLASS_IDS.includes(p.last) ? p.last : 'knight', stash, classes };
}

/** Summary numbers the solo island reads (place text and reward letters). */
export function summary(data) {
  const heroes = Object.values(data.classes);
  return {
    best: Math.max(...heroes.map((h) => h.level)),
    act1: heroes.some((h) => h.bosses[0]),
    final: heroes.some((h) => h.bosses[ACT_COUNT - 1]),
    deep: Math.max(...heroes.map((h) => h.deepBest)),
    acts: Math.max(...heroes.map((h) => h.bosses.filter(Boolean).length)),
  };
}

export function saveKeepSolo(roster, data) {
  const out = JSON.parse(JSON.stringify(data));
  out.summary = summary(data); // for the island (place text and letters)
  roster.progress.keepSolo = out;
  roster.save();
}
