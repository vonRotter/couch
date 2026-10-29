import * as THREE from 'three';
import { COLORS, toon, sharedGeo } from '../../core/palette.js';
import { ITEMS } from './items.js';
import { now } from './save.js';
import { seasonOf } from './calendar.js';
import { mesh, box, cyl, sph, cone, ico } from './models.js';

// The sea side of the island (milestone B1): fish for the rod, critters and finds from diving,
// treasure, and the Driftwood Café's dishes. All with small toon models (also used for thumbnails).

/**
 * Fish: where (river, pier = the sea from the shore or pier, boat = the dive-spot boat, reef = diving only),
 * when (hours [from, to), wrapping past midnight), how rare, and how hard the reel game is.
 * shape: fish, flat, puffer, squid, octopus, round, lantern.
 */
export const FISH = {
  minnow: { where: 'river', hours: [0, 24], rare: 0, sell: 15, color: 0x9ad0c8, color2: 0xd8f0e8, shape: 'fish', size: 0.5, speed: 0.9, zone: 0.3, hits: 2 },
  trout: { where: 'river', hours: [5, 12], rare: 0, sell: 35, color: 0x8fa86a, color2: 0xff9fb0, shape: 'fish', size: 0.8, speed: 1.2, zone: 0.24, hits: 3 },
  carp: { where: 'river', hours: [0, 24], rare: 1, sell: 40, color: 0xc89a4a, color2: 0xf0d090, shape: 'fish', size: 0.9, speed: 1.1, zone: 0.24, hits: 3 },
  catfish: { where: 'river', hours: [19, 5], rare: 1, sell: 60, color: 0x6a6a7a, color2: 0xb0b0c0, shape: 'fish', size: 1.0, speed: 1.3, zone: 0.2, hits: 3, whiskers: true },
  koi: { where: 'river', hours: [16, 20], rare: 2, sell: 150, color: 0xffffff, color2: 0xff6a3a, shape: 'fish', size: 0.9, speed: 1.6, zone: 0.16, hits: 4, spots: true },
  sardine: { where: 'pier', hours: [6, 18], rare: 0, sell: 15, color: 0x8fb8d8, color2: 0xe8f4ff, shape: 'fish', size: 0.5, speed: 1.0, zone: 0.3, hits: 2 },
  mackerel: { where: 'pier', hours: [0, 24], rare: 0, sell: 25, color: 0x3f7fa8, color2: 0xd8e8f0, shape: 'fish', size: 0.7, speed: 1.2, zone: 0.26, hits: 2, stripes: true },
  puffer: { where: 'pier', hours: [9, 17], rare: 1, sell: 55, color: 0xffd23f, color2: 0xfff3c0, shape: 'puffer', size: 0.7, speed: 1.4, zone: 0.22, hits: 3 },
  squid: { where: 'pier', hours: [18, 6], rare: 1, sell: 50, color: 0xffb0c0, color2: 0xff8aa0, shape: 'squid', size: 0.8, speed: 1.3, zone: 0.22, hits: 3 },
  flounder: { where: 'pier', hours: [0, 24], rare: 1, sell: 45, color: 0xb89a7a, color2: 0xe0d0b8, shape: 'flat', size: 0.9, speed: 1.0, zone: 0.24, hits: 3 },
  tuna: { where: 'boat', hours: [6, 19], rare: 1, sell: 90, color: 0x2f4f8f, color2: 0xc0d0e0, shape: 'fish', size: 1.3, speed: 1.6, zone: 0.18, hits: 4 },
  octopus: { where: 'boat', hours: [19, 6], rare: 1, sell: 80, color: 0xff7a5a, color2: 0xffb09a, shape: 'octopus', size: 0.9, speed: 1.4, zone: 0.2, hits: 3 },
  sunfish: { where: 'boat', hours: [10, 15], rare: 2, sell: 200, color: 0xb0b8c8, color2: 0xe0e8f0, shape: 'round', size: 1.3, speed: 1.2, zone: 0.16, hits: 4 },
  lanternfish: { where: 'boat', hours: [20, 4], rare: 2, sell: 180, color: 0x2b2a5a, color2: 0x8ff0ff, shape: 'lantern', size: 0.8, speed: 1.8, zone: 0.15, hits: 4 },
  moonfish: { where: 'boat', hours: [22, 2], rare: 2, sell: 300, color: 0xe9e2ff, color2: 0xffe14a, shape: 'round', size: 1.1, speed: 2.0, zone: 0.13, hits: 5, glow: true },
  bream: { where: 'reef', hours: [0, 24], rare: 0, sell: 45, color: 0xff8a8a, color2: 0xffd0d0, shape: 'fish', size: 0.8, speed: 1.2, zone: 0.24, hits: 3 },
  // milestone B3: seasonal fish (only in their season) and the fish of Shell Isle's hidden cove
  rainbowTrout: { where: 'river', hours: [5, 19], rare: 1, sell: 70, color: 0x8fc0a0, color2: 0xff8fb8, shape: 'fish', size: 0.85, speed: 1.3, zone: 0.22, hits: 3, seasons: ['spring'], stripes: true },
  flyingfish: { where: 'pier', hours: [7, 18], rare: 1, sell: 65, color: 0x4c8fd8, color2: 0xd8f0ff, shape: 'fish', size: 0.7, speed: 1.5, zone: 0.22, hits: 3, seasons: ['summer'], wings: true },
  salmon: { where: 'river', hours: [0, 24], rare: 1, sell: 75, color: 0xd86a5a, color2: 0xffc0a8, shape: 'fish', size: 1.0, speed: 1.4, zone: 0.2, hits: 3, seasons: ['autumn'] },
  icefish: { where: 'pier', hours: [0, 24], rare: 1, sell: 70, color: 0xdff4ff, color2: 0x9fd8ff, shape: 'fish', size: 0.7, speed: 1.3, zone: 0.22, hits: 3, seasons: ['winter'], glow: true },
  parrotfish: { where: 'cove', hours: [0, 24], rare: 0, sell: 50, color: 0x3ddcb0, color2: 0xff7eb6, shape: 'fish', size: 0.9, speed: 1.2, zone: 0.24, hits: 3, spots: true },
  rainbowfish: { where: 'cove', hours: [9, 17], rare: 2, sell: 220, color: 0xff5d73, color2: 0xffd23f, shape: 'fish', size: 0.8, speed: 1.8, zone: 0.15, hits: 4, stripes: true },
};
export const FISH_IDS = Object.keys(FISH);
export const isRiverFish = (id) => FISH[id]?.where === 'river';

/** Sea things from diving (ingredients) and treasure (to sell). */
export const SEA = {
  seaweed: { sell: 8, color: 0x3fae6a }, clam: { sell: 12, color: 0xe8d8c8 }, shrimp: { sell: 20, color: 0xff9a7a },
  crab: { sell: 35, color: 0xff6a4a }, lobster: { sell: 90, color: 0xd94a3a },
  // milestone B3: seasonal dive critters and Shell Isle's beach finds
  seahorse: { sell: 45, color: 0xffb03a, seasons: ['spring', 'summer'] }, snowCrab: { sell: 50, color: 0xe8f4ff, seasons: ['winter'] },
  starfish: { sell: 20, color: 0xff8c42 }, seaGlass: { sell: 25, color: 0x8fe0c0 }, seaShell: { sell: 10, color: 0xffd8c8 },
};
export const TREASURE = { oldcoin: { sell: 40 }, pearl: { sell: 90 }, goldcup: { sell: 220 }, crystalShell: { sell: 400 } };

/** The café's recipe book. need: [[item or tag, n]]; tags: fish (any), seafish (not from the river). */
export const RECIPES = {
  radishSalad: { need: [['radish', 1], ['lettuce', 1]], price: 60, colors: [0xff4f6d, 0x9be05a] },
  carrotSoup: { need: [['carrot', 2]], price: 70, colors: [0xff8c2a], soup: true },
  grilledFish: { need: [['fish', 1]], price: 55, colors: [0xc89a4a, 0xffd23f] },
  fishStew: { need: [['fish', 1], ['tomato', 1]], price: 90, colors: [0xf2402e, 0xe8d8c8], soup: true },
  sushi: { need: [['seafish', 1], ['seaweed', 1]], price: 100, colors: [0xffffff, 0x2f5f3f, 0xff8a6a], sushi: true },
  seaweedSalad: { need: [['seaweed', 1], ['lettuce', 1]], price: 65, colors: [0x3fae6a, 0x9be05a] },
  tempura: { need: [['shrimp', 1], ['corn', 1]], price: 110, colors: [0xffd27a, 0xff9a7a] },
  crabCake: { need: [['crab', 1], ['carrot', 1]], price: 110, colors: [0xe0a060, 0xff6a4a] },
  clamChowder: { need: [['clam', 2], ['corn', 1]], price: 120, colors: [0xfff3dc, 0xffd23f], soup: true },
  strawberryShake: { need: [['strawberry', 2]], price: 70, colors: [0xff9fd0, 0xff3b5c], drink: true },
  pumpkinPie: { need: [['pumpkin', 1]], price: 200, colors: [0xff9f1c, 0xe2b06a], pie: true },
  seafoodPlatter: { need: [['lobster', 1], ['squid', 1], ['seaweed', 1]], price: 300, colors: [0xd94a3a, 0xffb0c0, 0x3fae6a] },
  // with eggs and milk from the barn (milestone B2)
  omelette: { need: [['egg', 2]], price: 80, colors: [0xffd23f, 0xfff3a8], pie: true },
  pancakes: { need: [['egg', 1], ['milk', 1]], price: 120, colors: [0xffd27a, 0xe2b06a, 0xff3b5c], pie: true },
  milkshake: { need: [['milk', 1], ['strawberry', 1]], price: 110, colors: [0xfff3f8, 0xff3b5c], drink: true },
  custardPie: { need: [['egg', 1], ['milk', 1], ['pumpkin', 1]], price: 360, colors: [0xffc070, 0xe2b06a], pie: true },
};
export const RECIPE_IDS = Object.keys(RECIPES);

// Register everything as island items.
for (const [id, f] of Object.entries(FISH)) ITEMS[id] = { kind: 'fish', sell: f.sell };
for (const [id, s] of Object.entries(SEA)) ITEMS[id] = { kind: 'sea', sell: s.sell };
for (const [id, s] of Object.entries(TREASURE)) ITEMS[id] = { kind: 'treasure', sell: s.sell };
for (const [id, r] of Object.entries(RECIPES)) ITEMS[id] = { kind: 'dish', sell: Math.round(r.price * 0.6) };
Object.assign(ITEMS, {
  rod: { kind: 'tool' },
  fishlog: { kind: 'book' },
  recipes: { kind: 'book' },
  flippers: { kind: 'gear', buy: 80 },
  tank: { kind: 'gear', buy: 150 },
  seaLamp: { kind: 'gear', buy: 250 },
  scooter: { kind: 'gear', buy: 350 },
  egg: { kind: 'produce', sell: 25 },
  milk: { kind: 'produce', sell: 60 },
  chicken: { kind: 'animal', buy: 80 },
  goat: { kind: 'animal', buy: 300 },
  cow: { kind: 'animal', buy: 400 },
});

/** Is the fish biting at this hour? */
export function inHours(f, h) {
  const [a, b] = f.hours;
  return a <= b ? h >= a && h < b : h >= a || h < b;
}

/** Is a fish (or sea critter) around in this season? */
export const inSeasonFish = (def, season = seasonOf(now())) => !def.seasons || def.seasons.includes(season);

/** Choose a fish for a place, hour and season (rare ones are rare). */
export function pickFish(where, hour, rand = Math.random, season = seasonOf(now())) {
  const list = FISH_IDS.filter((id) => FISH[id].where === where && inHours(FISH[id], hour) && inSeasonFish(FISH[id], season));
  const w = list.map((id) => [10, 5, 1.6][FISH[id].rare]);
  let r = rand() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < list.length; i++) if ((r -= w[i]) <= 0) return list[i];
  return list[0];
}

/** Does an item count for a recipe need (tags fish / seafish)? */
export function matches(need, id) {
  if (need === 'fish') return !!FISH[id];
  if (need === 'seafish') return !!FISH[id] && !isRiverFish(id);
  return need === id;
}

// ---------- models ----------

const INK = COLORS.ink;
const scaled = (m, x, y, z) => { m.scale.set(x, y, z); return m; };

/** A toon fish (or squid, octopus...) facing +x, about `size` long. */
export function makeFish(id) {
  const f = FISH[id];
  const g = new THREE.Group();
  const s = f.size;
  const body = toon(f.color), belly = toon(f.color2);
  const eye = (x, y, z, r = 0.07) => {
    g.add(mesh(sph(r, 8, 6), 0xffffff, x, y, z, false), mesh(sph(r * 0.55, 6, 5), INK, x + r * 0.3, y, z + (z > 0 ? r * 0.5 : -r * 0.5), false));
  };
  switch (f.shape) {
    case 'puffer': {
      g.add(mesh(sph(0.4, 12, 10), body, 0, 0, 0));
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2, b = (i % 3) * 0.6 - 0.6;
        const sp = mesh(cone(0.05, 0.16, 4), belly, Math.cos(a) * 0.38 * Math.cos(b), Math.sin(b) * 0.38, Math.sin(a) * 0.38 * Math.cos(b), false);
        sp.lookAt(sp.position.clone().multiplyScalar(3));
        sp.rotateX(Math.PI / 2);
        g.add(sp);
      }
      g.add(mesh(cone(0.14, 0.2, 6), body, -0.45, 0, 0).rotateZ(Math.PI / 2));
      eye(0.25, 0.12, 0.25, 0.09); eye(0.25, 0.12, -0.25, 0.09);
      break;
    }
    case 'squid': {
      const m = mesh(cone(0.22, 0.8, 10), body, 0.15, 0, 0);
      m.rotation.z = -Math.PI / 2;
      g.add(m, mesh(cone(0.3, 0.16, 4), body, 0.55, 0, 0).rotateZ(-Math.PI / 2));
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const t = mesh(cyl(0.03, 0.02, 0.5, 5), belly, -0.45, Math.cos(a) * 0.1, Math.sin(a) * 0.1, false);
        t.rotation.z = Math.PI / 2 + Math.cos(a) * 0.2;
        g.add(t);
      }
      eye(-0.15, 0.06, 0.17, 0.07); eye(-0.15, 0.06, -0.17, 0.07);
      break;
    }
    case 'octopus': {
      const head = mesh(sph(0.36, 12, 10), body, 0, 0.25, 0);
      head.scale.set(1, 1.15, 1);
      g.add(head);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const t = mesh(cyl(0.06, 0.03, 0.5, 5), body, Math.cos(a) * 0.25, -0.12, Math.sin(a) * 0.25);
        t.rotation.set(Math.sin(a) * 0.8, 0, -Math.cos(a) * 0.8);
        g.add(t);
      }
      eye(0.22, 0.3, 0.16, 0.08); eye(0.22, 0.3, -0.16, 0.08);
      break;
    }
    case 'flat': {
      const b = mesh(sph(0.45, 14, 8), body, 0, 0, 0);
      b.scale.set(1.2, 0.25, 0.9);
      g.add(b, scaled(mesh(sph(0.42, 14, 8), belly, 0, -0.04, 0), 1.1, 0.18, 0.8));
      const tail = mesh(cone(0.18, 0.3, 4), body, -0.6, 0, 0);
      tail.rotation.z = Math.PI / 2;
      tail.scale.set(1, 1, 0.3);
      g.add(tail);
      eye(0.25, 0.12, 0.08, 0.06); eye(0.3, 0.12, -0.1, 0.06);
      break;
    }
    case 'round': {
      const b = mesh(sph(0.5, 14, 10), body, 0, 0, 0);
      b.scale.set(0.9, 1.0, 0.35);
      g.add(b);
      for (const sy of [1, -1]) {
        const fin = mesh(cone(0.18, 0.6, 4), belly, -0.2, sy * 0.6, 0);
        fin.rotation.z = sy > 0 ? 0.3 : Math.PI - 0.3;
        fin.scale.set(1, 1, 0.3);
        g.add(fin);
      }
      g.add(mesh(box(0.12, 0.6, 0.12), belly, -0.45, 0, 0));
      if (f.glow) g.add(mesh(sph(0.2, 10, 8), toon(0xffe14a, { emissive: 0x665500 }), 0.05, 0, 0.17, false));
      eye(0.28, 0.12, 0.17, 0.08); eye(0.28, 0.12, -0.17, 0.08);
      break;
    }
    default: {
      const b = mesh(sph(0.4, 14, 10), body, 0, 0, 0);
      b.scale.set(1.25, 0.65, 0.45);
      g.add(b);
      const bl = mesh(sph(0.36, 12, 8), belly, 0.05, -0.08, 0);
      bl.scale.set(1.15, 0.45, 0.42);
      g.add(bl);
      const tail = mesh(cone(0.22, 0.32, 4), f.spots ? toon(f.color2) : body, -0.58, 0, 0);
      tail.rotation.z = Math.PI / 2;
      tail.scale.set(1, 1, 0.25);
      g.add(tail);
      const fin = mesh(cone(0.12, 0.25, 4), f.spots ? toon(f.color2) : body, 0, 0.27, 0);
      fin.scale.set(1.5, 1, 0.25);
      g.add(fin);
      if (f.stripes) for (let i = 0; i < 3; i++) g.add(mesh(box(0.05, 0.25, 0.4), INK, -0.15 + i * 0.15, 0.08, 0, false));
      if (f.spots) for (const [x, y] of [[0.1, 0.12], [-0.2, 0.05], [0.25, -0.02]]) g.add(scaled(mesh(sph(0.1, 8, 6), toon(f.color2), x, y, 0.13, false), 1, 1, 0.4));
      if (f.wings) for (const s2 of [-1, 1]) { const w = mesh(cone(0.18, 0.55, 4), belly, 0.05, 0.05, s2 * 0.22, false); w.rotation.set(s2 * 1.2, 0, Math.PI / 2 + 0.4); w.scale.set(1, 1, 0.25); g.add(w); }
      if (f.glow && f.shape === 'fish') g.add(scaled(mesh(sph(0.28, 10, 8), toon(f.color2, { transparent: true, opacity: 0.45, emissive: 0x224455 }), 0, 0, 0, false), 1.3, 0.75, 0.55));
      if (f.whiskers) for (const s2 of [-1, 1]) g.add(mesh(cyl(0.012, 0.012, 0.35, 4), INK, 0.6, -0.05, s2 * 0.1, false).rotateZ(Math.PI / 2 + s2 * 0.3));
      eye(0.3, 0.08, 0.15); eye(0.3, 0.08, -0.15);
      if (f.shape === 'lantern') {
        const st = mesh(cyl(0.015, 0.015, 0.45, 4), INK, 0.3, 0.42, 0, false);
        st.rotation.z = -0.6;
        g.add(st, mesh(sph(0.08, 8, 6), toon(0x8ff0ff, { emissive: 0x226677 }), 0.48, 0.58, 0, false));
      }
    }
  }
  g.scale.setScalar(s);
  return g;
}

/** Sea critters, finds and treasure. */
export function makeSeaThing(id) {
  const g = new THREE.Group();
  switch (id) {
    case 'seaweed':
      for (let i = 0; i < 3; i++) { const k = mesh(box(0.12, 0.7, 0.04), 0x3fae6a, (i - 1) * 0.14, 0.35, 0); k.rotation.z = (i - 1) * 0.25; g.add(k); }
      break;
    case 'clam': {
      const top = mesh(sph(0.3, 12, 8), 0xe8d8c8, 0, 0.08, 0);
      top.scale.set(1, 0.4, 0.8);
      top.rotation.x = -0.3;
      const bot = mesh(sph(0.3, 12, 8), 0xd8c0a8, 0, 0, 0);
      bot.scale.set(1, 0.3, 0.8);
      g.add(top, bot, mesh(sph(0.08, 8, 6), 0xffffff, 0, 0.06, 0.12, false));
      break;
    }
    case 'shrimp': {
      for (let i = 0; i < 5; i++) g.add(mesh(sph(0.12 - i * 0.015, 8, 6), 0xff9a7a, -i * 0.13, Math.sin(i * 0.6) * 0.08, 0));
      g.add(mesh(cyl(0.01, 0.01, 0.4, 3), 0xff7a5a, 0.2, 0.1, 0.04, false).rotateZ(-0.8), mesh(sph(0.03, 6, 4), INK, 0.08, 0.06, 0.08, false));
      break;
    }
    case 'crab': case 'lobster': case 'snowCrab': {
      const lob = id === 'lobster';
      const c = lob ? 0xd94a3a : id === 'snowCrab' ? 0xe8f4ff : 0xff6a4a;
      const b = mesh(sph(0.3, 12, 8), c, 0, 0.15, 0);
      b.scale.set(lob ? 1.5 : 1.2, 0.6, lob ? 0.7 : 0.9);
      g.add(b);
      if (lob) for (let i = 1; i < 4; i++) g.add(mesh(sph(0.16 - i * 0.02, 8, 6), c, -0.3 - i * 0.16, 0.15, 0));
      for (const s of [-1, 1]) {
        g.add(scaled(mesh(sph(0.12, 8, 6), c, 0.42, 0.2, s * 0.28), 1.3, 0.8, 0.8));
        for (let i = 0; i < 3; i++) { const l = mesh(cyl(0.025, 0.02, 0.28, 4), c, -0.1 + i * 0.12, 0.06, s * 0.3, false); l.rotation.x = s * 1.0; g.add(l); }
        g.add(mesh(sph(0.045, 6, 5), 0xffffff, 0.22, 0.32, s * 0.08, false), mesh(sph(0.025, 6, 4), INK, 0.25, 0.33, s * 0.09, false));
      }
      break;
    }
    case 'seahorse': {
      const c = 0xffb03a;
      const b = mesh(sph(0.16, 10, 8), c, 0, 0.45, 0);
      b.scale.set(0.9, 1.5, 0.8);
      g.add(b, mesh(sph(0.13, 10, 8), c, 0.06, 0.78, 0), mesh(cyl(0.035, 0.05, 0.22, 6), c, 0.2, 0.76, 0).rotateZ(Math.PI / 2));
      for (let i = 0; i < 4; i++) g.add(mesh(sph(0.08 - i * 0.012, 8, 6), c, -0.04 - i * 0.03, 0.22 - i * 0.08, 0));
      g.add(mesh(cone(0.08, 0.14, 4), 0xffd27a, -0.12, 0.5, 0, false).rotateZ(1.2), mesh(sph(0.03, 6, 4), INK, 0.12, 0.82, 0.08, false), mesh(sph(0.03, 6, 4), INK, 0.12, 0.82, -0.08, false));
      break;
    }
    case 'starfish': {
      for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; const arm = mesh(cone(0.11, 0.38, 6), 0xff8c42, Math.cos(a) * 0.17, 0.06, Math.sin(a) * 0.17); arm.rotation.set(0, -a, -Math.PI / 2); arm.rotateZ(0); g.add(arm); }
      g.add(mesh(sph(0.13, 8, 6), 0xff9f5a, 0, 0.06, 0));
      g.children.forEach((m) => m.scale.y *= 0.5);
      break;
    }
    case 'seaGlass':
      for (const [x, z, c] of [[-0.1, 0, 0x8fe0c0], [0.14, 0.06, 0x8fc0ff], [0.02, -0.14, 0xc0f0a0]]) { const p = mesh(ico(0.13, 0), toon(c, { transparent: true, opacity: 0.8, emissive: 0x112222 }), x, 0.08, z); p.scale.y = 0.55; g.add(p); }
      break;
    case 'seaShell': {
      for (let i = 0; i < 7; i++) { const a = -0.9 + (i / 6) * 1.8; const r = mesh(cyl(0.035, 0.06, 0.42, 5), i % 2 ? 0xffd8c8 : 0xffc0b0, Math.sin(a) * 0.18, 0.06, Math.cos(a) * 0.18 - 0.12); r.rotation.set(Math.PI / 2, 0, -a); g.add(r); }
      g.add(mesh(box(0.14, 0.06, 0.1), 0xffc0b0, 0, 0.04, -0.2));
      break;
    }
    case 'oldcoin': {
      const c = mesh(cyl(0.3, 0.3, 0.06, 18), COLORS.gold, 0, 0.3, 0);
      c.rotation.x = Math.PI / 2;
      g.add(c, mesh(box(0.15, 0.15, 0.07), 0xe0a400, 0, 0.3, 0.02, false));
      break;
    }
    case 'pearl':
      g.add(mesh(sph(0.22, 14, 10), toon(0xfff8f0, { emissive: 0x222222 }), 0, 0.22, 0));
      break;
    case 'crystalShell': {
      const sh = mesh(sph(0.35, 12, 8), toon(0xbff6ff, { emissive: 0x2a5a70 }), 0, 0.2, 0);
      sh.scale.set(1, 0.5, 0.8);
      g.add(sh);
      for (let i = 0; i < 5; i++) g.add(mesh(box(0.03, 0.05, 0.5), 0x8ff0ff, -0.2 + i * 0.1, 0.36, 0, false));
      break;
    }
    case 'egg': { const e = mesh(sph(0.2, 12, 10), 0xfff8f0, 0, 0.25, 0); e.scale.y = 1.3; g.add(e); break; }
    case 'milk':
      g.add(mesh(cyl(0.2, 0.22, 0.5, 12), 0xffffff, 0, 0.25, 0), mesh(cyl(0.12, 0.2, 0.2, 12), 0xffffff, 0, 0.6, 0), mesh(cyl(0.1, 0.1, 0.08, 10), 0x4cc9f0, 0, 0.73, 0), mesh(box(0.32, 0.18, 0.02), 0x4cc9f0, 0, 0.3, 0.21, false));
      break;
    case 'goldcup':
      g.add(mesh(cyl(0.25, 0.12, 0.35, 12), COLORS.gold, 0, 0.45, 0), mesh(cyl(0.05, 0.05, 0.2, 6), COLORS.gold, 0, 0.18, 0), mesh(cyl(0.18, 0.2, 0.06, 12), COLORS.gold, 0, 0.05, 0), mesh(sph(0.06, 8, 6), 0xff5d73, 0, 0.45, 0.24, false));
      break;
    default:
      g.add(mesh(ico(0.3, 0), 0xc9a8ff, 0, 0.3, 0));
  }
  return g;
}

/** A dish on a plate (the café). */
export function makeDish(id) {
  const r = RECIPES[id];
  const g = new THREE.Group();
  const [c1, c2 = c1, c3 = c2] = r.colors;
  if (r.drink) {
    g.add(mesh(cyl(0.2, 0.15, 0.6, 12), toon(0xffffff, { transparent: true, opacity: 0.5 }), 0, 0.3, 0, false));
    g.add(mesh(cyl(0.18, 0.14, 0.5, 12), c1, 0, 0.27, 0), mesh(sph(0.1, 8, 6), c2, 0, 0.6, 0), mesh(cyl(0.02, 0.02, 0.5, 4), 0xff5d73, 0.08, 0.7, 0, false).rotateZ(0.3));
    return g;
  }
  g.add(mesh(cyl(0.48, 0.38, 0.08, 18), 0xffffff, 0, 0.04, 0), mesh(cyl(0.5, 0.5, 0.02, 18), 0x8fd8ff, 0, 0.085, 0, false));
  if (r.soup) {
    g.add(mesh(cyl(0.36, 0.26, 0.3, 16), 0xfff3dc, 0, 0.22, 0), mesh(cyl(0.32, 0.32, 0.03, 16), c1, 0, 0.36, 0, false));
    for (let i = 0; i < 3; i++) g.add(mesh(sph(0.05, 6, 5), c2, -0.1 + i * 0.1, 0.38, (i - 1) * 0.06, false));
  } else if (r.pie) {
    g.add(mesh(cyl(0.38, 0.34, 0.16, 16), c2, 0, 0.17, 0), mesh(cyl(0.33, 0.33, 0.03, 16), c1, 0, 0.26, 0, false));
  } else if (r.sushi) {
    for (let i = 0; i < 3; i++) {
      const x = -0.22 + i * 0.22;
      g.add(mesh(cyl(0.1, 0.1, 0.14, 12), c2, x, 0.16, 0), mesh(cyl(0.075, 0.075, 0.15, 12), c1, x, 0.165, 0, false), mesh(sph(0.04, 6, 5), c3, x, 0.24, 0, false));
    }
  } else {
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const b = mesh(ico(0.13, 0), r.colors[i % r.colors.length], Math.cos(a) * 0.17, 0.17, Math.sin(a) * 0.17);
      b.scale.set(1, 0.7, 1);
      g.add(b);
    }
    g.add(mesh(sph(0.08, 6, 5), 0x58b947, 0, 0.25, 0, false));
  }
  return g;
}

/** Model for any sea-side item id (for thumbnails and props). */
export function seaModel(id) {
  if (FISH[id]) return makeFish(id);
  if (RECIPES[id]) return makeDish(id);
  return makeSeaThing(id);
}
export const hasSeaModel = (id) => !!(FISH[id] || RECIPES[id] || SEA[id] || TREASURE[id] || id === 'egg' || id === 'milk');
