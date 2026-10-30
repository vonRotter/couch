import { SLOTS, STATS, statsOf, implicitOf, meetsReq } from './items.js';

// The three heroes of Pillow Keep Solo: base numbers, the four hero stats (Strength, Dexterity,
// Magic, Vitality), the skill trees, and how a hero's numbers come together from class, level,
// stat points, skill ranks and gear.
//
//   Pillow Knight   melee, lots of health, little mana (main stat: Strength)
//   Feather Archer  arrows from afar (main stat: Dexterity)
//   Bubble Wizard   bubbles and spells, lots of mana (main stat: Magic)
//
// Formulas (kept simple on purpose):
//   damage        = weapon damage x class factor x (0.7 + main stat / 100) x (1 + gear % + passive %)
//                   (so every point of the main stat is +1% damage; 30 points = x1.0)
//   health        = class base + 2 per Vitality + per level (knight 3, archer 2, wizard 1.5) + gear
//   mana          = class base + per Magic (knight 1, archer 1.5, wizard 2) + per level + gear
//   mana regen    = 0.6 + 2.5% of max mana per second (blue potions refill 60% at once)
//   attack speed  = (1 + gear %) x (1 + 0.4% per Dexterity above 20), at most x1.8
//   armor         = class armor x (1 + 15% per level) + 1 per 4 Strength + gear
// Each level gives 5 stat points and 1 skill point. Gear can need Strength, Dexterity or Magic:
// worn gear whose needs are not met gives nothing (and is shown in red).

export const CLASS_IDS = ['knight', 'archer', 'wizard'];
export const GLYPH = { knight: '♜', archer: '➶', wizard: '✦' };
export const CLASS_COLOR = { knight: '#ff5d73', archer: '#3ddc97', wizard: '#4cc9f0' };
export const STAT_IDS = ['str', 'dex', 'mag', 'vit'];
export const BASE_STATS = {
  knight: { str: 30, dex: 20, mag: 10, vit: 25 },
  archer: { str: 20, dex: 30, mag: 15, vit: 20 },
  wizard: { str: 15, dex: 20, mag: 30, vit: 20 },
};
export const MAIN_STAT = { knight: 'str', archer: 'dex', wizard: 'mag' };
export const STAT_POINTS = 5, SKILL_POINTS = 1; // per level

// hp / hpLv: health base and per level · mana / manaLv / manaMag: mana base, per level, per Magic ·
// dmgK: hit strength per weapon damage · armor: built-in armor · cdA: seconds between basic attacks
export const CLASSES = {
  knight: { hp: 14, hpLv: 3, mana: 5, manaLv: 1, manaMag: 1, dmgK: 1.25, armor: 4, cdA: 0.46, color: 0xff5d73, hat: 5 },
  archer: { hp: 8, hpLv: 2, mana: 8, manaLv: 1.5, manaMag: 1.5, dmgK: 0.9, armor: 0, cdA: 0.33, color: 0x3ddc97, hat: 1 },
  wizard: { hp: 6, hpLv: 1.5, mana: 10, manaLv: 2, manaMag: 2, dmgK: 1.0, armor: 0, cdA: 0.52, color: 0x4cc9f0, hat: 4 },
};

// The skill trees: 10 skills per class in four rows (row = when it opens). Every skill has ranks
// 1-5 (one skill point each); `need` must have a rank first. kind: 'hold' (held down), 'move',
// 'active' or 'passive'. target: 'self' (around the hero), 'dir' (toward the pointer), 'ground'
// (lands at the pointer, up to `range` away), 'blink' (jump to the pointer).
// mana: cost at rank 1 (+10% per rank) · cd: short recharge in seconds (big skills only).
export const TREE = {
  knight: [
    { id: 'block', kind: 'hold', row: 0, col: 0, lv: 1, mana: 0, cd: 0, target: 'self', free: true },
    { id: 'bash', kind: 'active', row: 0, col: 1, lv: 1, mana: 3, cd: 0, target: 'dir' },
    { id: 'spin', kind: 'active', row: 0, col: 2, lv: 1, mana: 5, cd: 0.8, target: 'self' },
    { id: 'rush', kind: 'active', row: 1, col: 0, lv: 3, mana: 6, cd: 2, target: 'dir', need: 'bash' },
    { id: 'stuffing', kind: 'passive', row: 1, col: 1, lv: 3 },
    { id: 'quake', kind: 'active', row: 1, col: 2, lv: 6, mana: 9, cd: 4, target: 'self', need: 'spin' },
    { id: 'leap', kind: 'active', row: 2, col: 0, lv: 10, mana: 8, cd: 3, target: 'blink', range: 8, need: 'rush' },
    { id: 'power', kind: 'passive', row: 2, col: 1, lv: 10 },
    { id: 'cheer', kind: 'active', row: 2, col: 2, lv: 12, mana: 12, cd: 15, target: 'self', need: 'quake' },
    { id: 'avalanche', kind: 'active', row: 3, col: 1, lv: 18, mana: 18, cd: 6, target: 'ground', range: 9, need: 'leap' },
  ],
  archer: [
    { id: 'roll', kind: 'move', row: 0, col: 0, lv: 1, mana: 0, cd: 1.1, target: 'dir', free: true },
    { id: 'snooze', kind: 'active', row: 0, col: 1, lv: 1, mana: 3, cd: 0, target: 'dir' },
    { id: 'fan', kind: 'active', row: 0, col: 2, lv: 1, mana: 5, cd: 0.8, target: 'dir' },
    { id: 'pierce', kind: 'active', row: 1, col: 0, lv: 3, mana: 6, cd: 1.5, target: 'dir', need: 'snooze' },
    { id: 'eye', kind: 'passive', row: 1, col: 1, lv: 3 },
    { id: 'rain', kind: 'active', row: 1, col: 2, lv: 6, mana: 10, cd: 4, target: 'ground', range: 10, need: 'fan' },
    { id: 'trap', kind: 'active', row: 2, col: 0, lv: 10, mana: 8, cd: 2, target: 'ground', range: 8, need: 'pierce' },
    { id: 'feet', kind: 'passive', row: 2, col: 1, lv: 10 },
    { id: 'owl', kind: 'active', row: 2, col: 2, lv: 12, mana: 14, cd: 16, target: 'self', need: 'rain' },
    { id: 'star', kind: 'active', row: 3, col: 1, lv: 18, mana: 16, cd: 5, target: 'ground', range: 12, need: 'trap' },
  ],
  wizard: [
    { id: 'hop', kind: 'move', row: 0, col: 0, lv: 1, mana: 3, cd: 1.2, target: 'blink', range: 7, free: true },
    { id: 'bolt', kind: 'active', row: 0, col: 1, lv: 1, mana: 2, cd: 0, target: 'dir' },
    { id: 'ring', kind: 'active', row: 0, col: 2, lv: 1, mana: 6, cd: 0.8, target: 'self' },
    { id: 'bomb', kind: 'active', row: 1, col: 0, lv: 3, mana: 8, cd: 1, target: 'ground', range: 9, need: 'bolt' },
    { id: 'thoughts', kind: 'passive', row: 1, col: 1, lv: 3 },
    { id: 'cloud', kind: 'active', row: 1, col: 2, lv: 6, mana: 12, cd: 4, target: 'ground', range: 8, need: 'ring' },
    { id: 'shield', kind: 'active', row: 2, col: 0, lv: 10, mana: 15, cd: 12, target: 'self', need: 'bomb' },
    { id: 'soapy', kind: 'passive', row: 2, col: 1, lv: 10 },
    { id: 'storm', kind: 'active', row: 2, col: 2, lv: 12, mana: 18, cd: 10, target: 'self', need: 'cloud' },
    { id: 'splash', kind: 'active', row: 3, col: 1, lv: 18, mana: 24, cd: 6, target: 'ground', range: 10, need: 'shield' },
  ],
};
export const MAX_RANK = 5;
// The move each class has from the start (it was the [B] button; the gamepad's [B] still does it).
export const B_MOVE = { knight: 'block', archer: 'roll', wizard: 'hop' };
// Skills a hero had before the skill trees (old saves get these at rank 1, see save.js).
export const OLD_SKILLS = {
  knight: [['spin', 1], ['rush', 3], ['quake', 6], ['cheer', 10]],
  archer: [['fan', 1], ['pierce', 3], ['rain', 6], ['owl', 10]],
  wizard: [['ring', 1], ['bomb', 3], ['cloud', 6], ['storm', 10]],
};
export const MAX_LEVEL = 60;

export const skillDef = (cls, id) => TREE[cls].find((s) => s.id === id) || null;

/** XP from level L to L+1. */
export const xpNeed = (L) => Math.round(45 * 1.2 ** (L - 1) + 15 * L);

/** Mana cost of a skill at a rank. */
export const manaCost = (def, rank) => Math.round(def.mana * (1 + 0.1 * Math.max(0, rank - 1)));

/** Damage (and effect) multiplier of a skill at a rank: +20% per rank after the first. */
export const rankK = (rank) => 1 + 0.2 * Math.max(0, rank - 1);

/**
 * Can this skill get a point now? Returns '' (yes) or the reason key
 * ('max', 'level', 'need', 'points').
 */
export function canRaise(cls, hero, id) {
  const def = skillDef(cls, id);
  const r = hero.ranks[id] || 0;
  if (r >= MAX_RANK) return 'max';
  if (hero.level < def.lv) return 'level';
  if (def.need && !hero.ranks[def.need]) return 'need';
  if (hero.skillPts <= 0) return 'points';
  return '';
}

/** Hero stats (Strength, Dexterity, Magic, Vitality) from class, spent points and gear bonuses. */
export function heroAttrs(cls, hero, gear = hero.gear) {
  const base = BASE_STATS[cls];
  const a = {};
  for (const k of STAT_IDS) a[k] = base[k] + (hero.attrs?.[k] || 0);
  // gear bonuses count only from gear the hero can wear without them (no lifting yourself)
  const plain = { ...a };
  for (const slot of SLOTS) {
    const it = gear[slot];
    if (!it || !meetsReq(it, plain)) continue;
    const s = statsOf(it);
    for (const k of STAT_IDS) if (s[k]) a[k] += Math.round(s[k]);
  }
  return a;
}

/**
 * Everything the hero's numbers need: class, level, spent stat points (hero.attrs), skill ranks
 * (hero.ranks) and worn gear. `hero` is the save record (level, attrs, ranks); gear may be swapped
 * in for "what if I wore this" comparisons.
 */
export function heroStats(cls, hero, gear = hero.gear) {
  const C = CLASSES[cls], L = hero.level - 1;
  const at = heroAttrs(cls, hero, gear);
  const g = Object.fromEntries(STATS.map((k) => [k, 0]));
  const powers = new Set();
  const off = new Set(); // worn but needs not met
  for (const slot of SLOTS) {
    const it = gear[slot];
    if (!it) continue;
    if (!meetsReq(it, at)) { off.add(slot); continue; }
    const s = statsOf(it);
    for (const k in s) g[k] += s[k];
    if (it.power) powers.add(it.power);
  }
  const R = hero.ranks || {};
  const rk = (id) => R[id] || 0;
  const weapon = g.dmg || 4;
  const main = at[MAIN_STAT[cls]];
  const passiveDmg = 0.06 * rk('power');
  const maxHp = Math.round((C.hp + 2 * at.vit + C.hpLv * L + g.hp) * (1 + 0.08 * rk('stuffing')));
  const maxMana = Math.round((C.mana + C.manaMag * at.mag + C.manaLv * L + g.mana) * (1 + 0.1 * rk('thoughts')));
  return {
    attrs: at,
    dmg: weapon * C.dmgK * (0.7 + main / 100) * (1 + g.might + passiveDmg),
    spell: 1 + 0.06 * rk('soapy'), // extra for wizard spells
    maxHp,
    maxMana,
    regen: (0.6 + 0.025 * maxMana) * (1 + 0.1 * rk('thoughts')),
    armor: C.armor * (1 + 0.15 * L) + at.str / 4 + g.armor,
    rate: Math.min(1.8, (1 + g.rate + 0.04 * rk('feet')) * (1 + Math.max(0, at.dex - 20) * 0.004)),
    speed: Math.min(1.45, 1 + g.speed + 0.04 * rk('feet')),
    cdr: Math.min(0.5, g.cdr),
    luck: Math.min(0.6, g.luck + 0.03 * rk('eye')),
    light: g.light,
    powers,
    off,
  };
}

/** Share of a hit that armor soaks up at difficulty D (0..0.75). */
export function armorCut(armor, D) {
  return Math.min(0.75, armor / (armor + 40 * 1.15 ** D));
}

/**
 * One number for "how strong is this hero": damage per second times how much it can take.
 * Used for the "this is better" arrow, so an item is better when the hero gets stronger with it.
 */
export function heroPower(cls, hero, gear, D) {
  const s = heroStats(cls, hero, gear);
  const off = s.dmg * s.rate * (1 + s.luck);
  const def = s.maxHp / (1 - armorCut(s.armor, D));
  return Math.log(off) + Math.log(def) + 0.6 * (s.speed - 1) + 0.5 * s.cdr + 0.04 * s.powers.size + 0.15 * Math.log(1 + s.maxMana / 40) + 0.01 * s.light;
}

/**
 * How much better (positive) or worse an item would make the hero if worn in its slot.
 * null: not for this class (or not gear); undefined: unknown (not identified yet).
 */
export function compareItem(cls, hero, item, D) {
  if (!item || item.slot === 'use') return null;
  if (item.cls && item.cls !== cls) return null; // for another class
  if (item.unid) return undefined;
  const now = heroPower(cls, hero, hero.gear, D);
  const next = heroPower(cls, hero, { ...hero.gear, [item.slot]: item }, D);
  return next - now;
}

/** Is it noticeably better? (a little margin so swapping back and forth never flips) */
export const isBetter = (delta) => typeof delta === 'number' && delta > 0.005;

/** The main number of an item, e.g. for sorting. */
export function mainValue(item) {
  const k = implicitOf(item.slot, item.cls);
  return statsOf(item)[k] || 0;
}
