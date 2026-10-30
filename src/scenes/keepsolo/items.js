import { t } from '../../core/i18n.js';

// Pillow Keep Solo gear, Diablo style: four rarities (common white, magic blue, rare yellow,
// legendary orange), random stats ("affixes") that grow with the item level, names built from the
// base item, its rarity and its affixes, smith upgrades (+1 to +5) and salvage into fluff.
// Magic and better items drop unidentified (the sage or an Identify scroll shows their stats),
// items need some Strength / Dexterity / Magic to wear, and every item has a size in the bag grid.
//
// An item is plain data (it is saved as JSON):
//   { id, slot, cls (weapon/off-hand only), rarity 0-3, ilvl, tier 0-2, stats: { key: value },
//     order: [affix keys, for the name], rare: [word a, word b], leg (legendary name index),
//     power (legendary power key), plus (smith upgrades 0-5), unid (not identified yet),
//     diff (difficulty it dropped in: 0 Normal, 1 Nightmare, 2 Hell) }
// Potions and scrolls are items too: { id, slot: 'use', use: 'hp' | 'mp' | 'tp' | 'id', rarity: 0, ilvl: 0 }.
// stats are the item's own numbers before upgrades; statsOf(item) adds the upgrades.

export const SLOTS = ['weapon', 'offhand', 'helmet', 'armor', 'gloves', 'belt', 'boots', 'charm'];
export const CLASS_SLOTS = new Set(['weapon', 'offhand']); // only for one class
export const BAG_W = 10, BAG_H = 4; // the bag grid
export const STASH_W = 14, STASH_H = 10; // the stash chest grid (shared by the three heroes)
export const MAX_PLUS = 5;
export const USES = ['hp', 'mp', 'tp', 'id']; // red potion, blue potion, Town Portal scroll, Identify scroll

export const RARITY = ['common', 'magic', 'rare', 'legendary'];
// Bright colors for the world (with a dark outline) and darker ones for text on light panels.
export const RARITY_CSS = ['#f4f1ea', '#5a9bff', '#ffd23f', '#ff9a2e'];
export const RARITY_TEXT = ['#6b6380', '#2f6fe0', '#b88a00', '#e06a00'];
export const RARITY_HEX = [0xf4f1ea, 0x4c8dff, 0xffd23f, 0xff8c1a];
// Difficulty marks on item names (Nightmare, Hell).
export const DIFF_MARK = ['', '☾', '✹'];

// Stats: flat ones grow with the item level, percent ones a little.
//   dmg (weapon damage) · hp (max health) · armor · might (+% damage) · rate (+% attack speed)
//   speed (+% walk speed) · cdr (+% faster skill recharge) · luck (% chance for a lucky double hit)
//   mana (max mana) · light (+light radius in the dark keep) · str / dex / mag / vit (+hero stats)
export const STATS = ['dmg', 'might', 'hp', 'mana', 'armor', 'rate', 'speed', 'cdr', 'luck', 'light', 'str', 'dex', 'mag', 'vit'];
export const PCT = new Set(['might', 'rate', 'speed', 'cdr', 'luck']);
const GROW = 1.15; // flat stats per item level
const IMPLICIT = { weapon: 'dmg', helmet: 'hp', armor: 'armor', gloves: 'rate', belt: 'hp', boots: 'speed', charm: 'luck' };
const OFFHAND = { knight: 'armor', archer: 'rate', wizard: 'cdr' };
const AFFIXES = ['might', 'hp', 'mana', 'armor', 'rate', 'speed', 'cdr', 'luck', 'light', 'str', 'dex', 'mag', 'vit'];
const RARITY_MULT = [1, 1.12, 1.25, 1.4];
export const POWERS = ['wave', 'thorns', 'heal', 'potion', 'coins', 'bubble'];
const RARE_A = 8, RARE_B = 8, LEG_N = 3;

let nextId = 1;
const newId = () => `${Date.now().toString(36)}${(nextId++).toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;

/** Value of one stat roll; implicit = the item's main stat (a bit bigger). */
function rollStat(key, ilvl, implicit, rand) {
  const g = GROW ** ilvl, k = 0.85 + rand() * 0.3, p = 1 + Math.min(1.2, ilvl * 0.035);
  switch (key) {
    case 'dmg': return 5 * g * k;
    case 'hp': return (implicit ? 11 : 7) * g * k;
    case 'mana': return 6 * GROW ** (ilvl * 0.6) * k;
    case 'armor': return (implicit ? 8 : 4.5) * g * k;
    case 'might': return 0.06 * p * k;
    case 'rate': return (implicit ? 0.07 : 0.05) * p * k;
    case 'speed': return (implicit ? 0.06 : 0.04) * p * k;
    case 'cdr': return (implicit ? 0.09 : 0.06) * p * k;
    case 'luck': return (implicit ? 0.06 : 0.04) * p * k;
    case 'light': return 1 + Math.floor(rand() * 2);
    case 'str': case 'dex': case 'mag': case 'vit': return Math.max(1, Math.round((2 + ilvl * 0.45) * k));
    default: return 0;
  }
}

/** Which stat a slot always has. */
export function implicitOf(slot, cls) {
  return slot === 'offhand' ? OFFHAND[cls] : IMPLICIT[slot];
}

// ---------------------------------------------------------------- sizes and requirements

/**
 * Bag grid size [w, h]: charms 1x1, gloves / boots / helmets 2x2, belts 2x1, armor 2x3,
 * pillows and wands 1x3 (the biggest pillow and the staff 2x3), bows 2x3, shields 2x2 (bigger
 * ones 2x3), quivers 2x3, orbs 2x2, potions and scrolls 1x1.
 */
export function sizeOf(item) {
  switch (item.slot) {
    case 'use': case 'charm': return [1, 1];
    case 'helmet': case 'gloves': case 'boots': return [2, 2];
    case 'belt': return [2, 1];
    case 'armor': return [2, 3];
    case 'weapon': return item.cls === 'archer' || item.tier >= 2 ? [2, 3] : [1, 3];
    case 'offhand': return item.cls === 'archer' || (item.cls === 'knight' && item.tier >= 1) ? [2, 3] : [2, 2];
    default: return [1, 1];
  }
}

// What each slot needs: [stat, base, per item level] (the weapon and off-hand by class).
const REQ = {
  'weapon.knight': ['str', 15, 2.2], 'weapon.archer': ['dex', 15, 2.2], 'weapon.wizard': ['mag', 15, 2.2],
  'offhand.knight': ['str', 12, 2], 'offhand.archer': ['dex', 10, 1.8], 'offhand.wizard': ['mag', 10, 1.8],
  armor: ['str', 12, 2.4], helmet: ['str', 8, 1.6], gloves: ['dex', 8, 1.5], boots: ['dex', 6, 1.2], belt: ['str', 6, 1.2],
};

/** Stats an item needs, e.g. { str: 25 } (starter gear and charms need nothing). */
export function reqOf(item) {
  if (!item || item.slot === 'use' || item.starter || item.slot === 'charm') return {};
  const r = REQ[CLASS_SLOTS.has(item.slot) ? `${item.slot}.${item.cls}` : item.slot];
  if (!r) return {};
  const v = Math.round(r[1] + r[2] * item.ilvl + (item.rarity >= 2 ? 3 : 0));
  return item.ilvl === 0 && item.rarity === 0 ? {} : { [r[0]]: v };
}

/** Does a hero with these stats { str, dex, mag, vit } meet the item's needs? */
export function meetsReq(item, stats) {
  const r = reqOf(item);
  for (const k in r) if ((stats[k] || 0) < r[k]) return false;
  return true;
}

// ---------------------------------------------------------------- rolling items

/** Rarity roll by source ('foe' | 'nest' | 'chest' | 'elite' | 'champ' | 'unique' | 'boss' | 'quest' | 'box') and difficulty D. */
export function rollRarity(source, D, rand = Math.random) {
  const W = {
    foe: [70, 25, 4.5, 0.5], nest: [50, 38, 10, 2], chest: [30, 46, 20, 4], elite: [10, 50, 33, 7], champ: [5, 55, 33, 7],
    unique: [0, 30, 55, 15], boss: [0, 30, 54, 16], quest: [0, 55, 40, 5], box: [0, 62, 32, 6],
  }[source] || [70, 25, 4.5, 0.5];
  const w = [W[0], W[1] + D * 0.8, W[2] + D * 0.55, W[3] + D * 0.16];
  let x = rand() * (w[0] + w[1] + w[2] + w[3]);
  for (let r = 0; r < 4; r++) { x -= w[r]; if (x <= 0) return r; }
  return 0;
}

/** A fresh item. cls: the class it is for (weapon/off-hand). Magic and better drop unidentified. */
export function rollItem({ ilvl, rarity, slot, cls, rand = Math.random, diff = 0, identified = false }) {
  const stats = {};
  const imp = implicitOf(slot, cls);
  stats[imp] = rollStat(imp, ilvl, true, rand) * RARITY_MULT[rarity];
  const nAff = [0, 1 + (rand() < 0.5 ? 1 : 0), 3 + (rand() < 0.4 ? 1 : 0), 3][rarity];
  const pool = AFFIXES.filter((a) => a !== imp);
  const order = [];
  for (let i = 0; i < nAff && pool.length; i++) {
    const a = pool.splice(Math.floor(rand() * pool.length), 1)[0];
    stats[a] = rollStat(a, ilvl, false, rand) * (rarity === 3 && a !== 'light' ? 1.25 : 1);
    if (a === 'light' || a === 'str' || a === 'dex' || a === 'mag' || a === 'vit') stats[a] = Math.round(stats[a]);
    order.push(a);
  }
  const item = {
    id: newId(), slot, cls: CLASS_SLOTS.has(slot) ? cls : null, rarity, ilvl, tier: Math.min(2, Math.floor(ilvl / 5)),
    stats, order, plus: 0,
  };
  if (rarity === 2) item.rare = [Math.floor(rand() * RARE_A), Math.floor(rand() * RARE_B)];
  if (rarity === 3) { item.leg = Math.floor(rand() * LEG_N); item.power = POWERS[Math.floor(rand() * POWERS.length)]; }
  if (rarity >= 1 && !identified) item.unid = true;
  if (diff) item.diff = diff;
  return item;
}

/** The class's starting weapon (common, item level 0). */
export function starterItem(cls, slot = 'weapon') {
  const stats = { [implicitOf(slot, cls)]: rollStat(implicitOf(slot, cls), 0, true, () => 0.5) };
  return { id: newId(), slot, cls: CLASS_SLOTS.has(slot) ? cls : null, rarity: 0, ilvl: 0, tier: 0, stats, order: [], plus: 0, starter: true };
}

/** A potion or scroll ('hp' red potion, 'mp' blue potion, 'tp' Town Portal scroll, 'id' Identify scroll). */
export function useItem(use) {
  return { id: newId(), slot: 'use', use, rarity: 0, ilvl: 0, tier: 0, stats: {}, order: [], plus: 0 };
}

/** A plain belt for the shop (more potion slots). */
export function shopBelt(ilvl) {
  const it = rollItem({ ilvl, rarity: 0, slot: 'belt', cls: null, identified: true });
  return it;
}

/** Stats including smith upgrades (+10% flat, +5% of percent stats per level; hero stats and light do not grow). */
export function statsOf(item) {
  const out = {};
  const p = item.plus || 0;
  for (const k in item.stats) out[k] = item.stats[k] * (PCT.has(k) ? 1 + 0.05 * p : k === 'light' || k === 'str' || k === 'dex' || k === 'mag' || k === 'vit' ? 1 : 1 + 0.1 * p);
  return out;
}

/** Make sure a loaded item has every field (old or broken saves). Old items stay identified. */
export function fixItem(it) {
  if (!it || typeof it !== 'object') return null;
  if (it.slot === 'use') return USES.includes(it.use) ? { ...useItem(it.use), id: String(it.id || newId()) } : null;
  if (!SLOTS.includes(it.slot)) return null;
  const stats = {};
  for (const k of STATS) if (Number.isFinite(it.stats?.[k]) && it.stats[k] > 0) stats[k] = it.stats[k];
  return {
    id: String(it.id || newId()), slot: it.slot, cls: CLASS_SLOTS.has(it.slot) ? (['knight', 'archer', 'wizard'].includes(it.cls) ? it.cls : 'knight') : null,
    rarity: Math.max(0, Math.min(3, it.rarity | 0)), ilvl: Math.max(0, it.ilvl | 0), tier: Math.max(0, Math.min(2, it.tier | 0)),
    stats, order: Array.isArray(it.order) ? it.order.filter((k) => STATS.includes(k)) : [], plus: Math.max(0, Math.min(MAX_PLUS, it.plus | 0)),
    ...(Array.isArray(it.rare) ? { rare: [it.rare[0] | 0, it.rare[1] | 0] } : {}),
    ...(it.rarity === 3 ? { leg: (it.leg | 0) % LEG_N, power: POWERS.includes(it.power) ? it.power : 'heal' } : {}),
    ...(it.starter ? { starter: true } : {}),
    ...(it.unid && (it.rarity | 0) >= 1 ? { unid: true } : {}),
    ...((it.diff | 0) > 0 ? { diff: Math.min(2, it.diff | 0) } : {}),
  };
}

// ---------------------------------------------------------------- names and text

export function baseName(item) {
  if (item.slot === 'use') return t(`ks.use.${item.use}`);
  const key = CLASS_SLOTS.has(item.slot) ? `ks.base.${item.slot}.${item.cls}.${item.tier}` : `ks.base.${item.slot}.${item.tier}`;
  return t(key);
}

/** Full display name, e.g. "Sturdy Nightcap of Zooming +2" or "Moonlit Hug" (rare), or "Unidentified Nightcap". */
export function itemName(item) {
  const base = baseName(item);
  if (item.slot === 'use') return base;
  const plus = item.plus ? ` +${item.plus}` : '';
  const mark = item.diff ? ` ${DIFF_MARK[item.diff]}` : '';
  if (item.unid) return t('ks.unidName', { base }) + plus + mark;
  if (item.rarity === 3) return t(`ks.leg.${item.slot}.${item.leg}`) + plus + mark;
  if (item.rarity === 2) return t('ks.rareName', { a: t(`ks.rareA.${item.rare[0]}`), b: t(`ks.rareB.${item.rare[1]}`) }) + plus + mark;
  if (item.rarity === 1) {
    const [a, b] = item.order;
    const pre = a ? t(`ks.pre.${a}`) : '', suf = b ? t(`ks.suf.${b}`) : '';
    return t('ks.magicName', { pre, base, suf }).replace(/\s+/g, ' ').trim() + plus + mark;
  }
  return base + plus + mark;
}

/** One stat as text, e.g. "+12 health" or "+8% attack speed". */
export function statText(k, v) {
  if (PCT.has(k)) return t('ks.statPct', { v: Math.max(1, Math.round(v * 100)), s: t(`ks.stat.${k}`) });
  return t('ks.statFlat', { v: Math.max(1, Math.round(v)), s: t(`ks.stat.${k}`) });
}

/** Every stat line of an item (main stat first). Unidentified items only show the main stat. */
export function statLines(item) {
  if (item.slot === 'use') return [];
  const s = statsOf(item);
  const imp = implicitOf(item.slot, item.cls);
  const keys = item.unid ? [imp] : [imp, ...STATS.filter((k) => k !== imp)];
  return keys.filter((k) => s[k]).map((k) => ({ k, v: s[k], text: statText(k, s[k]) }));
}

// ---------------------------------------------------------------- smith, shop and sage prices

export function upgradeCost(item) {
  const p = item.plus || 0;
  return { coins: Math.round((20 + item.ilvl * 6) * (p + 1) * (1 + item.rarity * 0.5)), fluff: (p + 1) * (1 + item.rarity) };
}

export function salvageValue(item) {
  if (item.slot === 'use') return { coins: 2, fluff: 0 };
  return { coins: 2 + Math.round(item.ilvl * 1.5) + item.rarity * 6, fluff: [1, 2, 4, 8][item.rarity] + Math.floor(item.ilvl / 4) + (item.plus || 0) };
}

/** Coins the shops pay for an item (Ctrl+click to sell). */
export function sellValue(item) {
  if (item.slot === 'use') return 4;
  return Math.round((4 + item.ilvl * 2.5) * [1, 2, 3.5, 6][item.rarity] * (1 + 0.2 * (item.plus || 0)) * (item.unid ? 0.6 : 1));
}

/** What the sage asks to identify an item. */
export const identifyCost = (item) => 10 + Math.round(item.ilvl * 2) + item.rarity * 5;

export const USE_PRICE = { hp: 20, mp: 20, tp: 30, id: 25 };
