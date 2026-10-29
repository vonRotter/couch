import { MIN, HOUR, now } from './save.js';
import { seasonOf } from './calendar.js';

const ALL = ['spring', 'summer', 'autumn', 'winter'];

// Items on the solo island: tools, seeds, crops, materials, gifts and quest finds.
// Crops grow in REAL time while their soil is wet (see farm.js). Fast crops ripen in one sitting,
// pumpkins and star fruit are the slow "come back later" crops.

export const CROPS = {
  radish: { grow: 4 * MIN, seed: 5, sell: 12, color: 0xff4f6d, leaf: 0x58b947, seasons: ALL },
  carrot: { grow: 8 * MIN, seed: 8, sell: 20, color: 0xff8c2a, leaf: 0x4cc46a, seasons: ALL },
  lettuce: { grow: 12 * MIN, seed: 10, sell: 26, color: 0x9be05a, leaf: 0x6fcf4a, seasons: ['spring', 'winter'] },
  strawberry: { grow: 20 * MIN, regrow: 10 * MIN, seed: 20, sell: 18, color: 0xff3b5c, leaf: 0x3fae4a, seasons: ['spring'] },
  tomato: { grow: 25 * MIN, regrow: 12 * MIN, seed: 15, sell: 30, color: 0xf2402e, leaf: 0x3f9a32, seasons: ['summer'] },
  corn: { grow: 30 * MIN, seed: 20, sell: 45, color: 0xffd23f, leaf: 0x7ac943, seasons: ['summer', 'autumn'] },
  pumpkin: { grow: 2 * HOUR, seed: 40, sell: 120, color: 0xff9f1c, leaf: 0x58b947, seasons: ['autumn'] },
  starfruit: { grow: 8 * HOUR, seed: 80, sell: 300, color: 0xffe14a, leaf: 0x6a8fd8, glow: true, seasons: ['summer'] },
  // milestone B3: new seasonal crops (one quick crop in every season)
  pea: { grow: 6 * MIN, regrow: 4 * MIN, seed: 10, sell: 10, color: 0x7ad04a, leaf: 0x4cb84a, seasons: ['spring'] },
  blueberry: { grow: 5 * MIN, regrow: 4 * MIN, seed: 10, sell: 9, color: 0x4a6fd8, leaf: 0x3f9a4a, seasons: ['summer'] },
  beet: { grow: 5 * MIN, seed: 6, sell: 14, color: 0xa8204f, leaf: 0x58b947, seasons: ['autumn'] },
  sunflower: { grow: 40 * MIN, seed: 25, sell: 60, color: 0xffc93c, leaf: 0x4cb84a, seasons: ['autumn'] },
  cabbage: { grow: 20 * MIN, seed: 15, sell: 40, color: 0xa8dc8a, leaf: 0x6fbf6a, seasons: ['winter'] },
  snowberry: { grow: 6 * MIN, regrow: 4 * MIN, seed: 12, sell: 11, color: 0xf4f8ff, leaf: 0x3f8a6a, seasons: ['winter'] },
};
export const CROP_IDS = Object.keys(CROPS);

/** Can this crop be planted outside in this season? (Radishes and carrots are hardy: every season.) */
export const inSeason = (crop, season = seasonOf(now())) => CROPS[crop].seasons.includes(season);
export const isHardy = (crop) => CROPS[crop].seasons.length === 4;

/** How long one watering keeps the soil wet (growth only counts while wet). */
export const WET_MS = 6 * HOUR;

// kind: tool, seed (plants `crop`), crop, wood, gift, find (quest item), key (special)
export const ITEMS = {
  hoe: { kind: 'tool' },
  can: { kind: 'tool' },
  scythe: { kind: 'tool' },
  pickaxe: { kind: 'tool' },
  wood: { kind: 'wood', buy: 5, sell: 2 },
  bouquet: { kind: 'gift', buy: 15 },
  feather: { kind: 'find' },
  starmap: { kind: 'find' },
  lens: { kind: 'find' },
  cocoa: { kind: 'gift', sell: 20 }, // hot cocoa after the first winter sled ride of the week
};
for (const c of CROP_IDS) {
  ITEMS[`${c}Seed`] = { kind: 'seed', crop: c, buy: CROPS[c].seed };
  ITEMS[c] = { kind: 'crop', crop: c, sell: CROPS[c].sell };
}

export const TOOLS = ['hoe', 'can', 'scythe', 'pickaxe'];
export const isGift = (id) => ['crop', 'gift', 'fish', 'dish', 'produce'].includes(ITEMS[id]?.kind);

/** The store's shelf: seeds of the season, wood and flowers. Star fruit seeds appear once Pip has shown you the stars. */
export function shopStock(save, season = seasonOf(now())) {
  const list = CROP_IDS.filter((c) => inSeason(c, season) && (c !== 'starfruit' || save.unlocks.starfruit)).map((c) => `${c}Seed`);
  list.push('wood', 'bouquet');
  if (save.sea?.suit) for (const g of ['flippers', 'tank']) if (!save.sea[g]) list.push(g);
  if (save.sea?.flippers && save.sea?.tank) for (const g of ['seaLamp', 'scooter']) if (!save.sea[g]) list.push(g);
  if (save.unlocks?.barn) {
    const n = (k) => (save.ranch?.animals || []).filter((a) => a.kind === k).length;
    for (const [k, max] of [['chicken', 4], ['goat', 1], ['cow', 1]]) if (n(k) < max) list.push(k);
  }
  return list;
}

// ---------- icons (small inline SVGs for the hotbar, shop and letters) ----------

const hex = (n) => `#${n.toString(16).padStart(6, '0')}`;
const INK = '#2b2340';

function cropSvg(id) {
  const c = CROPS[id];
  const col = hex(c.color), leaf = hex(c.leaf);
  const leaves = `<path d="M12 9 C9 3 5 4 6 8 C8 8 10 9 12 9Z M12 9 C15 3 19 4 18 8 C16 8 14 9 12 9Z" fill="${leaf}" stroke="${INK}" stroke-width="1"/>`;
  switch (id) {
    case 'carrot': return `<path d="M8 10 L16 10 L12 22 Z" fill="${col}" stroke="${INK}" stroke-width="1.2" stroke-linejoin="round"/>${leaves}`;
    case 'lettuce': return `<circle cx="12" cy="14" r="7" fill="${col}" stroke="${INK}" stroke-width="1.2"/><path d="M7 13 Q12 9 17 13" fill="none" stroke="#5fae3a" stroke-width="1.2"/>`;
    case 'strawberry': return `<path d="M6 10 Q12 7 18 10 Q17 18 12 21 Q7 18 6 10Z" fill="${col}" stroke="${INK}" stroke-width="1.2"/><circle cx="10" cy="13" r=".8" fill="#fff6a8"/><circle cx="14" cy="14" r=".8" fill="#fff6a8"/><circle cx="12" cy="17" r=".8" fill="#fff6a8"/><path d="M8 9 L12 6 L16 9 Z" fill="${leaf}" stroke="${INK}" stroke-width="1"/>`;
    case 'corn': return `<ellipse cx="12" cy="13" rx="4" ry="8" fill="${col}" stroke="${INK}" stroke-width="1.2"/><path d="M8 20 Q5 12 7 6 M16 20 Q19 12 17 6" fill="none" stroke="${leaf}" stroke-width="2.2"/>`;
    case 'pumpkin': return `<ellipse cx="12" cy="14" rx="9" ry="7" fill="${col}" stroke="${INK}" stroke-width="1.2"/><path d="M12 7 V21 M7 9 Q5 14 7 19 M17 9 Q19 14 17 19" fill="none" stroke="#d9780a" stroke-width="1"/><rect x="11" y="4" width="2" height="4" rx="1" fill="#7a4a2e"/>`;
    case 'starfruit': return `<path d="M12 3 L14.6 9.2 L21 9.6 L16 13.8 L17.6 20.4 L12 16.8 L6.4 20.4 L8 13.8 L3 9.6 L9.4 9.2 Z" fill="${col}" stroke="${INK}" stroke-width="1.2" stroke-linejoin="round"/>`;
    case 'pea': return `<path d="M5 15 Q12 5 19 9 Q14 18 5 15Z" fill="${col}" stroke="${INK}" stroke-width="1.2"/><circle cx="9" cy="13" r="1.6" fill="#b8f08a"/><circle cx="12.5" cy="11.5" r="1.6" fill="#b8f08a"/><circle cx="16" cy="10.5" r="1.4" fill="#b8f08a"/>`;
    case 'blueberry': case 'snowberry': return `<circle cx="9" cy="15" r="4" fill="${col}" stroke="${INK}" stroke-width="1.1"/><circle cx="15" cy="15" r="4" fill="${col}" stroke="${INK}" stroke-width="1.1"/><circle cx="12" cy="10" r="4" fill="${col}" stroke="${INK}" stroke-width="1.1"/><path d="M10 6 L12 8 L14 6" fill="none" stroke="${leaf}" stroke-width="1.6"/>`;
    case 'sunflower': return `<path d="M12 22 V12" stroke="${leaf}" stroke-width="2"/>${[0, 45, 90, 135, 180, 225, 270, 315].map((a) => `<ellipse cx="12" cy="5.5" rx="2" ry="3.4" fill="${col}" stroke="${INK}" stroke-width=".7" transform="rotate(${a} 12 10)"/>`).join('')}<circle cx="12" cy="10" r="3.4" fill="#7a4a2e" stroke="${INK}" stroke-width="1"/>`;
    case 'cabbage': return `<circle cx="12" cy="14" r="8" fill="${col}" stroke="${INK}" stroke-width="1.2"/><path d="M12 6 Q8 14 12 22 M12 6 Q16 14 12 22 M5 12 Q12 16 19 12" fill="none" stroke="#6fa85a" stroke-width="1"/>`;
    case 'beet': return `<path d="M12 21 Q5 17 7 12 Q12 9 17 12 Q19 17 12 21Z" fill="${col}" stroke="${INK}" stroke-width="1.2"/><path d="M12 21 v2" stroke="${INK}"/>${leaves}`;
    case 'tomato': return `<circle cx="12" cy="14" r="7" fill="${col}" stroke="${INK}" stroke-width="1.2"/><path d="M8 8 L12 10 L16 8 L12 7Z" fill="${leaf}" stroke="${INK}" stroke-width="1"/><ellipse cx="9.5" cy="12" rx="1.6" ry="1" fill="#fff" opacity=".6"/>`;
    default: return `<circle cx="12" cy="15" r="6" fill="${col}" stroke="${INK}" stroke-width="1.2"/><path d="M12 21 v2" stroke="${INK}"/>${leaves}<ellipse cx="10" cy="13.5" rx="1.5" ry="1" fill="#fff" opacity=".6"/>`;
  }
}

const SVG = {
  hoe: `<path d="M5 20 L16 6" stroke="#a0704a" stroke-width="2.6" stroke-linecap="round"/><path d="M13 4 L20 4 L20 8 L15 8 Z" fill="#bdb8cf" stroke="${INK}" stroke-width="1.2" stroke-linejoin="round"/>`,
  can: `<path d="M5 9 H15 V19 Q15 21 13 21 H7 Q5 21 5 19Z" fill="#4cc9f0" stroke="${INK}" stroke-width="1.2"/><path d="M15 12 L21 7" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/><path d="M7 9 Q10 4 13 9" fill="none" stroke="${INK}" stroke-width="1.4"/><circle cx="21" cy="12" r="1" fill="#4cc9f0"/><circle cx="20" cy="15" r="1" fill="#4cc9f0"/>`,
  scythe: `<path d="M8 21 L12 5" stroke="#a0704a" stroke-width="2.6" stroke-linecap="round"/><path d="M12 5 Q20 4 21 11 Q17 7 12 8 Z" fill="#e8e8f2" stroke="${INK}" stroke-width="1.2" stroke-linejoin="round"/>`,
  pickaxe: `<path d="M12 9 L7 21" stroke="#a0704a" stroke-width="2.6" stroke-linecap="round"/><path d="M3 9 Q12 1 21 9 Q12 5 3 9Z" fill="#9a94b2" stroke="${INK}" stroke-width="1.2" stroke-linejoin="round"/>`,
  wood: `<rect x="3" y="9" width="18" height="7" rx="3.5" fill="#c68a52" stroke="${INK}" stroke-width="1.2"/><ellipse cx="19" cy="12.5" rx="2.4" ry="3.2" fill="#f0c890" stroke="${INK}" stroke-width="1"/><path d="M8 10 v5 M12 10 v5" stroke="#9a6440" stroke-width="1"/>`,
  bouquet: `<path d="M9 13 L12 22 L15 13Z" fill="#8ac926" stroke="${INK}" stroke-width="1"/><circle cx="9" cy="9" r="3" fill="#ff7eb6" stroke="${INK}" stroke-width="1"/><circle cx="15" cy="9" r="3" fill="#ffd23f" stroke="${INK}" stroke-width="1"/><circle cx="12" cy="6" r="3" fill="#b08bff" stroke="${INK}" stroke-width="1"/>`,
  feather: `<path d="M6 20 Q8 8 19 4 Q16 14 6 20Z" fill="#ff9fd0" stroke="${INK}" stroke-width="1.2"/><path d="M6 20 L16 8" stroke="#ff6fae" stroke-width="1.2"/>`,
  starmap: `<rect x="4" y="5" width="16" height="14" rx="2" fill="#2e3b6b" stroke="${INK}" stroke-width="1.2"/><circle cx="8" cy="9" r="1" fill="#ffe14a"/><circle cx="14" cy="8" r="1.2" fill="#ffe14a"/><circle cx="16" cy="14" r="1" fill="#ffe14a"/><circle cx="9" cy="15" r="1.3" fill="#ffe14a"/><path d="M8 9 L14 8 L16 14 L9 15Z" fill="none" stroke="#8fd8ff" stroke-width=".7"/>`,
  lens: `<circle cx="12" cy="12" r="8" fill="#bff6ff" stroke="#ffd23f" stroke-width="2.4"/><ellipse cx="9.5" cy="9.5" rx="2.5" ry="1.6" fill="#fff"/>`,
  cocoa: `<path d="M5 8 H17 V18 Q17 21 14 21 H8 Q5 21 5 18Z" fill="#ff7a59" stroke="${INK}" stroke-width="1.2"/><path d="M17 11 Q21 11 21 14 Q21 17 17 17" fill="none" stroke="${INK}" stroke-width="1.4"/><ellipse cx="11" cy="8.5" rx="5.5" ry="1.6" fill="#7a4a2e"/><circle cx="9" cy="7.5" r="1.2" fill="#fff"/><circle cx="12.5" cy="7" r="1.2" fill="#fff"/><path d="M9 5 Q8 3 9.5 1.5 M13 5 Q12 3 13.5 1.5" fill="none" stroke="#bdb8cf" stroke-width="1"/>`,
  coin: `<circle cx="12" cy="12" r="8" fill="#ffd23f" stroke="${INK}" stroke-width="1.4"/><circle cx="12" cy="12" r="5" fill="none" stroke="#e0a400" stroke-width="1.2"/>`,
  heart: `<path d="M12 21s-7.5-4.6-9.6-9.2C1 8.6 3 5 6.5 5c2.1 0 3.5 1.2 5.5 3.2C14 6.2 15.4 5 17.5 5 21 5 23 8.6 21.6 11.8 19.5 16.4 12 21 12 21z" fill="#ff5d73" stroke="${INK}" stroke-width="1.4"/>`,
  heartEmpty: `<path d="M12 21s-7.5-4.6-9.6-9.2C1 8.6 3 5 6.5 5c2.1 0 3.5 1.2 5.5 3.2C14 6.2 15.4 5 17.5 5 21 5 23 8.6 21.6 11.8 19.5 16.4 12 21 12 21z" fill="rgba(255,255,255,.55)" stroke="${INK}" stroke-width="1.4"/>`,
  letter: `<rect x="3" y="6" width="18" height="13" rx="2" fill="#fff8e8" stroke="${INK}" stroke-width="1.3"/><path d="M3 7 L12 14 L21 7" fill="none" stroke="${INK}" stroke-width="1.3"/><circle cx="12" cy="14" r="2" fill="#ff5d73"/>`,
  rod: `<path d="M4 21 L19 4" stroke="#a0704a" stroke-width="2.4" stroke-linecap="round"/><path d="M19 4 Q22 12 18 16" fill="none" stroke="${INK}" stroke-width="1"/><circle cx="18" cy="17" r="1.8" fill="#ff5d73" stroke="${INK}" stroke-width=".8"/><circle cx="7" cy="18" r="2.2" fill="#9a94b2" stroke="${INK}" stroke-width="1"/>`,
  fishlog: `<rect x="4" y="3" width="16" height="18" rx="2" fill="#4cc9f0" stroke="${INK}" stroke-width="1.3"/><rect x="6" y="3" width="2" height="18" fill="#2f8fc0"/><ellipse cx="14" cy="12" rx="4" ry="2.4" fill="#ffd23f" stroke="${INK}" stroke-width="1"/><path d="M10 12 L8 10 L8 14Z" fill="#ffd23f" stroke="${INK}" stroke-width=".8"/>`,
  recipes: `<rect x="4" y="3" width="16" height="18" rx="2" fill="#ff7a59" stroke="${INK}" stroke-width="1.3"/><rect x="6" y="3" width="2" height="18" fill="#d9583a"/><ellipse cx="14" cy="14" rx="4.5" ry="2" fill="#fff" stroke="${INK}" stroke-width="1"/><path d="M11 12 Q14 7 17 12" fill="#fff3dc" stroke="${INK}" stroke-width="1"/>`,
  flippers: `<path d="M6 4 L10 4 L12 20 Q8 22 4 20Z" fill="#3ddc97" stroke="${INK}" stroke-width="1.2" stroke-linejoin="round"/><path d="M14 4 L18 4 L20 20 Q16 22 12.5 20Z" fill="#3ddc97" stroke="${INK}" stroke-width="1.2" stroke-linejoin="round"/>`,
  tank: `<rect x="7" y="5" width="10" height="16" rx="5" fill="#ffc93c" stroke="${INK}" stroke-width="1.3"/><rect x="10" y="2" width="4" height="4" fill="#9a94b2" stroke="${INK}" stroke-width="1"/><path d="M7 11 H17" stroke="${INK}" stroke-width="1"/>`,
  seaLamp: `<path d="M8 9 H16 V18 Q12 21 8 18Z" fill="#ffd84a" stroke="${INK}" stroke-width="1.2"/><circle cx="12" cy="13" r="2.6" fill="#fff8c0"/><path d="M10 9 V6 H14 V9" fill="none" stroke="${INK}" stroke-width="1.2"/>`,
  scooter: `<ellipse cx="11" cy="13" rx="8" ry="4.5" fill="#ffc93c" stroke="${INK}" stroke-width="1.2"/><circle cx="19" cy="13" r="2.5" fill="#9a94b2" stroke="${INK}" stroke-width="1"/><path d="M5 9 L9 9" stroke="${INK}" stroke-width="1.6"/>`,
  chicken: `<ellipse cx="12" cy="14" rx="6" ry="5" fill="#fff" stroke="${INK}" stroke-width="1.2"/><circle cx="16" cy="9" r="3" fill="#fff" stroke="${INK}" stroke-width="1.2"/><path d="M15 6 L16 4 L17 6" fill="#ff5d73"/><path d="M19 9 L21 10 L19 11Z" fill="#ffb020"/>`,
  cow: `<rect x="4" y="8" width="15" height="9" rx="3" fill="#fff" stroke="${INK}" stroke-width="1.2"/><circle cx="8" cy="11" r="2" fill="${INK}"/><rect x="16" y="6" width="6" height="6" rx="2" fill="#fff" stroke="${INK}" stroke-width="1.2"/><rect x="17" y="10" width="5" height="3" rx="1" fill="#ffb8c8"/><path d="M6 17 V20 M16 17 V20" stroke="${INK}" stroke-width="1.6"/>`,
  goat: `<rect x="5" y="9" width="12" height="7" rx="3" fill="#e8e0d0" stroke="${INK}" stroke-width="1.2"/><rect x="15" y="6" width="5" height="5" rx="2" fill="#e8e0d0" stroke="${INK}" stroke-width="1.2"/><path d="M16 6 L15 3 M19 6 L20 3" stroke="${INK}" stroke-width="1.4"/><path d="M7 16 V20 M15 16 V20" stroke="${INK}" stroke-width="1.6"/>`,
  stone: `<path d="M4 17 L7 9 L13 6 L19 9 L21 16 L15 20 L8 20Z" fill="#a8a2bf" stroke="${INK}" stroke-width="1.2" stroke-linejoin="round"/><path d="M9 11 L13 10" stroke="#fff" stroke-width="1"/>`,
  fiber: `<path d="M6 21 Q8 12 6 4 M12 21 Q12 12 12 3 M18 21 Q16 12 18 4" fill="none" stroke="#6fbf4a" stroke-width="2"/><path d="M5 15 H19" stroke="#c68a52" stroke-width="2"/>`,
  hay: `<rect x="3" y="8" width="18" height="11" rx="2" fill="#f0d060" stroke="${INK}" stroke-width="1.2"/><path d="M3 12 H21 M3 15 H21" stroke="#c8a830" stroke-width="1"/><path d="M8 8 V19 M16 8 V19" stroke="#c68a52" stroke-width="1.6"/>`,
  suit: `<path d="M8 3 H16 L18 8 L16 21 H8 L6 8Z" fill="#2f4f8f" stroke="${INK}" stroke-width="1.3" stroke-linejoin="round"/><circle cx="12" cy="9" r="2.5" fill="#bff6ff" stroke="${INK}" stroke-width="1"/>`,
  deco: `<path d="M12 3 L14.6 9.2 L21 9.6 L16 13.8 L17.6 20.4 L12 16.8 L6.4 20.4 L8 13.8 L3 9.6 L9.4 9.2 Z" fill="#c9a8ff" stroke="${INK}" stroke-width="1.2" stroke-linejoin="round"/>`,
};

// Pictures of 3D models for sea things and dishes (set by the island scene: see thumbs.js).
let pictureFn = null;
export function setPictures(fn) { pictureFn = fn; }
const PICTURED = new Set(['fish', 'sea', 'treasure', 'dish', 'produce']);

/** Inline SVG icon for an item id (seed packets get a little crop picture on a paper bag). */
export function icon(id) {
  let body;
  const it = ITEMS[id];
  if (pictureFn && (PICTURED.has(it?.kind) || it?.kind === 'craft' || (!it && !SVG[id]))) {
    const url = pictureFn(id);
    if (url) return `<img class="isl-ico" src="${url}" alt="">`;
  }
  if (SVG[id]) body = SVG[id];
  else if (it?.kind === 'crop') body = cropSvg(id);
  else if (it?.kind === 'seed') {
    body = `<path d="M5 5 H19 L18 21 H6 Z" fill="#f3d9a4" stroke="${INK}" stroke-width="1.2" stroke-linejoin="round"/><path d="M5 5 L7 3 H17 L19 5" fill="#e2b06a" stroke="${INK}" stroke-width="1"/><g transform="translate(6 7) scale(.5)">${cropSvg(it.crop)}</g>`;
  } else body = SVG.deco;
  return `<svg viewBox="0 0 24 24" class="isl-ico">${body}</svg>`;
}
