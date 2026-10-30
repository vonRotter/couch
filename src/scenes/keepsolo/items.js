import { t } from '../../core/i18n.js';

// Pillow Keep Solo gear, Diablo style: four rarities (common white, magic blue, rare yellow,
// legendary orange), random stats ("affixes") that grow with the item level, names built from the
// base item, its rarity and its affixes, smith upgrades (+1 to +5) and salvage into fluff.
//
// An item is plain data (it is saved as JSON):
//   { id, slot, cls (weapon/off-hand only), rarity 0-3, ilvl, tier 0-2, stats: { key: value },
//     order: [affix keys, for the name], rare: [word a, word b], leg (legendary name index),
//     power (legendary power key), plus (smith upgrades 0-5) }
// stats are the item's own numbers before upgrades; statsOf(item) adds the upgrades.

export const SLOTS = ['weapon', 'offhand', 'helmet', 'armor', 'gloves', 'boots', 'charm'];
export const CLASS_SLOTS = new Set(['weapon', 'offhand']); // only for one class
export const BAG_W = 8, BAG_H = 4, BAG_N = BAG_W * BAG_H; // 32 bag cells
export const STASH_W = 8, STASH_H = 6, STASH_N = STASH_W * STASH_H; // 48 stash cells (shared by the classes)
export const MAX_PLUS = 5;

export const RARITY = ['common', 'magic', 'rare', 'legendary'];
// Bright colors for the world (with a dark outline) and darker ones for text on light panels.
export const RARITY_CSS = ['#f4f1ea', '#5a9bff', '#ffd23f', '#ff9a2e'];
export const RARITY_TEXT = ['#6b6380', '#2f6fe0', '#b88a00', '#e06a00'];
export const RARITY_HEX = [0xf4f1ea, 0x4c8dff, 0xffd23f, 0xff8c1a];

// Stats: flat ones grow with the item level, percent ones a little.
//   dmg (weapon damage) · hp (max health) · armor · might (+% damage) · rate (+% attack speed)
//   speed (+% walk speed) · cdr (+% skill recharge) · luck (% chance for a lucky double hit)
export const STATS = ['dmg', 'might', 'hp', 'armor', 'rate', 'speed', 'cdr', 'luck'];
export const PCT = new Set(['might', 'rate', 'speed', 'cdr', 'luck']);
const GROW = 1.15; // flat stats per item level
const IMPLICIT = { weapon: 'dmg', helmet: 'hp', armor: 'armor', gloves: 'rate', boots: 'speed', charm: 'luck' };
const OFFHAND = { knight: 'armor', archer: 'rate', wizard: 'cdr' };
const AFFIXES = ['might', 'hp', 'armor', 'rate', 'speed', 'cdr', 'luck'];
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
    case 'armor': return (implicit ? 8 : 4.5) * g * k;
    case 'might': return 0.06 * p * k;
    case 'rate': return (implicit ? 0.07 : 0.05) * p * k;
    case 'speed': return (implicit ? 0.06 : 0.04) * p * k;
    case 'cdr': return (implicit ? 0.09 : 0.06) * p * k;
    case 'luck': return (implicit ? 0.06 : 0.04) * p * k;
    default: return 0;
  }
}

/** Which stat a slot always has. */
export function implicitOf(slot, cls) {
  return slot === 'offhand' ? OFFHAND[cls] : IMPLICIT[slot];
}

/** Rarity roll by source ('foe' | 'nest' | 'chest' | 'elite' | 'boss' | 'quest' | 'box') and difficulty D. */
export function rollRarity(source, D, rand = Math.random) {
  const W = { foe: [70, 25, 4.5, 0.5], nest: [50, 38, 10, 2], chest: [30, 46, 20, 4], elite: [10, 50, 33, 7], boss: [0, 30, 54, 16], quest: [0, 55, 40, 5], box: [0, 62, 32, 6] }[source] || [70, 25, 4.5, 0.5];
  const w = [W[0], W[1] + D * 0.8, W[2] + D * 0.55, W[3] + D * 0.16];
  let x = rand() * (w[0] + w[1] + w[2] + w[3]);
  for (let r = 0; r < 4; r++) { x -= w[r]; if (x <= 0) return r; }
  return 0;
}

/** A fresh item. cls: the class it is for (weapon/off-hand). */
export function rollItem({ ilvl, rarity, slot, cls, rand = Math.random }) {
  const stats = {};
  const imp = implicitOf(slot, cls);
  stats[imp] = rollStat(imp, ilvl, true, rand) * RARITY_MULT[rarity];
  const nAff = [0, 1 + (rand() < 0.5 ? 1 : 0), 3 + (rand() < 0.4 ? 1 : 0), 3][rarity];
  const pool = AFFIXES.filter((a) => a !== imp);
  const order = [];
  for (let i = 0; i < nAff && pool.length; i++) {
    const a = pool.splice(Math.floor(rand() * pool.length), 1)[0];
    stats[a] = rollStat(a, ilvl, false, rand) * (rarity === 3 ? 1.25 : 1);
    order.push(a);
  }
  const item = {
    id: newId(), slot, cls: CLASS_SLOTS.has(slot) ? cls : null, rarity, ilvl, tier: Math.min(2, Math.floor(ilvl / 5)),
    stats, order, plus: 0,
  };
  if (rarity === 2) item.rare = [Math.floor(rand() * RARE_A), Math.floor(rand() * RARE_B)];
  if (rarity === 3) { item.leg = Math.floor(rand() * LEG_N); item.power = POWERS[Math.floor(rand() * POWERS.length)]; }
  return item;
}

/** The class's starting weapon (common, item level 0). */
export function starterItem(cls, slot = 'weapon') {
  const stats = { [implicitOf(slot, cls)]: rollStat(implicitOf(slot, cls), 0, true, () => 0.5) };
  return { id: newId(), slot, cls: CLASS_SLOTS.has(slot) ? cls : null, rarity: 0, ilvl: 0, tier: 0, stats, order: [], plus: 0, starter: true };
}

/** Stats including smith upgrades (+10% flat, +5% of percent stats per level). */
export function statsOf(item) {
  const out = {};
  const p = item.plus || 0;
  for (const k in item.stats) out[k] = item.stats[k] * (PCT.has(k) ? 1 + 0.05 * p : 1 + 0.1 * p);
  return out;
}

/** Make sure a loaded item has every field (old or broken saves). */
export function fixItem(it) {
  if (!it || typeof it !== 'object' || !SLOTS.includes(it.slot)) return null;
  const stats = {};
  for (const k of STATS) if (Number.isFinite(it.stats?.[k]) && it.stats[k] > 0) stats[k] = it.stats[k];
  return {
    id: String(it.id || newId()), slot: it.slot, cls: CLASS_SLOTS.has(it.slot) ? (['knight', 'archer', 'wizard'].includes(it.cls) ? it.cls : 'knight') : null,
    rarity: Math.max(0, Math.min(3, it.rarity | 0)), ilvl: Math.max(0, it.ilvl | 0), tier: Math.max(0, Math.min(2, it.tier | 0)),
    stats, order: Array.isArray(it.order) ? it.order.filter((k) => STATS.includes(k)) : [], plus: Math.max(0, Math.min(MAX_PLUS, it.plus | 0)),
    ...(Array.isArray(it.rare) ? { rare: [it.rare[0] | 0, it.rare[1] | 0] } : {}),
    ...(it.rarity === 3 ? { leg: (it.leg | 0) % LEG_N, power: POWERS.includes(it.power) ? it.power : 'heal' } : {}),
    ...(it.starter ? { starter: true } : {}),
  };
}

// ---------------------------------------------------------------- names and text

export function baseName(item) {
  const key = CLASS_SLOTS.has(item.slot) ? `ks.base.${item.slot}.${item.cls}.${item.tier}` : `ks.base.${item.slot}.${item.tier}`;
  return t(key);
}

/** Full display name, e.g. "Sturdy Nightcap of Zooming +2" or "Moonlit Hug" (rare). */
export function itemName(item) {
  const base = baseName(item);
  const plus = item.plus ? ` +${item.plus}` : '';
  if (item.rarity === 3) return t(`ks.leg.${item.slot}.${item.leg}`) + plus;
  if (item.rarity === 2) return t('ks.rareName', { a: t(`ks.rareA.${item.rare[0]}`), b: t(`ks.rareB.${item.rare[1]}`) }) + plus;
  if (item.rarity === 1) {
    const [a, b] = item.order;
    const pre = a ? t(`ks.pre.${a}`) : '', suf = b ? t(`ks.suf.${b}`) : '';
    return t('ks.magicName', { pre, base, suf }).replace(/\s+/g, ' ').trim() + plus;
  }
  return base + plus;
}

/** One stat as text, e.g. "+12 health" or "+8% attack speed". */
export function statText(k, v) {
  if (PCT.has(k)) return t('ks.statPct', { v: Math.max(1, Math.round(v * 100)), s: t(`ks.stat.${k}`) });
  return t('ks.statFlat', { v: Math.max(1, Math.round(v)), s: t(`ks.stat.${k}`) });
}

/** Every stat line of an item (main stat first). */
export function statLines(item) {
  const s = statsOf(item);
  const imp = implicitOf(item.slot, item.cls);
  return [imp, ...STATS.filter((k) => k !== imp)].filter((k) => s[k]).map((k) => ({ k, v: s[k], text: statText(k, s[k]) }));
}

// ---------------------------------------------------------------- smith

export function upgradeCost(item) {
  const p = item.plus || 0;
  return { coins: Math.round((20 + item.ilvl * 6) * (p + 1) * (1 + item.rarity * 0.5)), fluff: (p + 1) * (1 + item.rarity) };
}

export function salvageValue(item) {
  return { coins: 2 + Math.round(item.ilvl * 1.5) + item.rarity * 6, fluff: [1, 2, 4, 8][item.rarity] + Math.floor(item.ilvl / 4) + (item.plus || 0) };
}

// ---------------------------------------------------------------- bag helpers

export function freeCell(list) {
  return list.findIndex((x) => !x);
}

/** Put an item in the first free cell; returns the index or -1 when full. */
export function addToList(list, item) {
  const i = freeCell(list);
  if (i >= 0) list[i] = item;
  return i;
}
