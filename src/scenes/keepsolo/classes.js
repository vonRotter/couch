import { SLOTS, STATS, statsOf, implicitOf } from './items.js';

// The three heroes of Pillow Keep Solo, their base numbers, the skills they learn, and how a
// hero's stats come together from class, level and gear.
//
//   Pillow Knight  [A] pillow swing · hold [B] block (most of a hit is soaked up, walk slowly)
//   Feather Archer [A] feather arrow · [B] dodge roll (a short dash you cannot be hit in)
//   Bubble Wizard  [A] bubble (traps a grumble, hit it again for a big pop) · [B] bubble hop (a short blink)
//
// Each class has four [C] skills that unlock at levels 1, 3, 6 and 10 (skills.js does them).
// Tap [C] uses the chosen skill; hold [C] for the menu to choose another, drink a potion, open a
// town portal or the bag.

export const CLASS_IDS = ['knight', 'archer', 'wizard'];
export const GLYPH = { knight: '♜', archer: '➶', wizard: '✦' };
export const CLASS_COLOR = { knight: '#ff5d73', archer: '#3ddc97', wizard: '#4cc9f0' };

// hp: health at level 1 · dmg: hit strength per weapon damage · armor: built-in armor ·
// cdA: seconds between [A] attacks · cdB: [B] recharge · reach: how the class fights.
export const CLASSES = {
  knight: { hp: 64, dmgK: 1.25, armor: 6, cdA: 0.46, cdB: 0, color: 0xff5d73, hat: 5 },
  archer: { hp: 48, dmgK: 0.9, armor: 0, cdA: 0.33, cdB: 1.1, color: 0x3ddc97, hat: 1 },
  wizard: { hp: 46, dmgK: 1.0, armor: 0, cdA: 0.52, cdB: 2.2, color: 0x4cc9f0, hat: 4 },
};

// [C] skills: id, level, recharge seconds.
export const SKILLS = {
  knight: [{ id: 'spin', lv: 1, cd: 4 }, { id: 'rush', lv: 3, cd: 6 }, { id: 'quake', lv: 6, cd: 9 }, { id: 'cheer', lv: 10, cd: 18 }],
  archer: [{ id: 'fan', lv: 1, cd: 4 }, { id: 'pierce', lv: 3, cd: 5 }, { id: 'rain', lv: 6, cd: 9 }, { id: 'owl', lv: 10, cd: 20 }],
  wizard: [{ id: 'ring', lv: 1, cd: 4 }, { id: 'bomb', lv: 3, cd: 5 }, { id: 'cloud', lv: 6, cd: 10 }, { id: 'storm', lv: 10, cd: 16 }],
};
export const B_MOVE = { knight: 'block', archer: 'roll', wizard: 'hop' };
export const MAX_LEVEL = 60;

/** XP from level L to L+1. */
export const xpNeed = (L) => Math.round(45 * 1.2 ** (L - 1) + 15 * L);

export function skillsFor(cls, level) {
  return SKILLS[cls].filter((s) => level >= s.lv);
}

/** Hero stats from class, level and worn gear. `D` (difficulty) only matters for armor. */
export function heroStats(cls, level, gear) {
  const C = CLASSES[cls], L = level - 1;
  const g = Object.fromEntries(STATS.map((k) => [k, 0]));
  const powers = new Set();
  for (const slot of SLOTS) {
    const it = gear[slot];
    if (!it) continue;
    const s = statsOf(it);
    for (const k in s) g[k] += s[k];
    if (it.power) powers.add(it.power);
  }
  const weapon = g.dmg || 4;
  return {
    dmg: weapon * C.dmgK * (1 + 0.05 * L) * (1 + g.might),
    maxHp: Math.round(C.hp * (1 + 0.1 * L) + g.hp),
    armor: C.armor * (1 + 0.15 * L) + g.armor,
    rate: Math.min(1.8, 1 + g.rate),
    speed: Math.min(1.4, 1 + g.speed),
    cdr: Math.min(0.5, g.cdr),
    luck: Math.min(0.5, g.luck),
    powers,
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
export function heroPower(cls, level, gear, D) {
  const s = heroStats(cls, level, gear);
  const off = s.dmg * s.rate * (1 + s.luck);
  const def = s.maxHp / (1 - armorCut(s.armor, D));
  return Math.log(off) + Math.log(def) + 0.6 * (s.speed - 1) + 0.5 * s.cdr + 0.04 * s.powers.size;
}

/** How much better (positive) or worse an item would make the hero if worn in its slot. */
export function compareItem(cls, level, gear, item, D) {
  if (item.cls && item.cls !== cls) return null; // for another class
  const now = heroPower(cls, level, gear, D);
  const next = heroPower(cls, level, { ...gear, [item.slot]: item }, D);
  return next - now;
}

/** Is it noticeably better? (a little margin so swapping back and forth never flips) */
export const isBetter = (delta) => delta !== null && delta > 0.005;

/** The main number of an item, e.g. for sorting. */
export function mainValue(item) {
  const k = implicitOf(item.slot, item.cls);
  return statsOf(item)[k] || 0;
}
