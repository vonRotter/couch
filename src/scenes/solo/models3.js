import * as THREE from 'three';
import { COLORS, toon, sharedGeo } from '../../core/palette.js';
import { mesh, box, cyl, sph, cone, ico, WOOD, WOOD_DARK } from './models.js';

// Milestone B3 models: seasonal props (sled, snowmen, festival stands), new decorations, the museum, the
// greenhouse, sprinklers and scarecrows, Shell Isle's palms, pools and hut, and the two new villagers.

const INK = COLORS.ink;
const tor = (r, t, arc = Math.PI * 2) => sharedGeo(`isl3-tor${r}|${t}|${arc}`, () => new THREE.TorusGeometry(r, t, 6, 16, arc));

// ---------- winter fun ----------

/** A little wooden sled (faces +x). */
export function makeSled() {
  const g = new THREE.Group();
  g.add(mesh(box(1.2, 0.08, 0.6), 0xff5d73, 0, 0.22, 0));
  for (const z of [-0.26, 0.26]) {
    g.add(mesh(box(1.3, 0.05, 0.05), 0xbdb8cf, -0.02, 0.04, z));
    const tip = mesh(tor(0.12, 0.025, Math.PI), 0xbdb8cf, 0.62, 0.14, z, false);
    tip.rotation.z = -Math.PI / 2;
    g.add(tip);
    for (const x of [-0.35, 0.3]) g.add(mesh(box(0.05, 0.18, 0.05), WOOD_DARK, x, 0.12, z, false));
  }
  g.add(mesh(cyl(0.015, 0.015, 0.7, 4), 0xffd23f, 0.62, 0.26, 0, false).rotateX(Math.PI / 2));
  return g;
}

/** A friendly snowman. */
export function makeSnowman() {
  const g = new THREE.Group();
  g.add(mesh(sph(0.5, 12, 10), 0xffffff, 0, 0.45, 0), mesh(sph(0.36, 12, 10), 0xffffff, 0, 1.12, 0), mesh(sph(0.26, 12, 10), 0xffffff, 0, 1.6, 0));
  g.add(mesh(cone(0.06, 0.3, 6), 0xff8c2a, 0, 1.6, 0.36, false).rotateX(Math.PI / 2));
  for (const s of [-1, 1]) g.add(mesh(sph(0.035, 6, 4), INK, s * 0.09, 1.68, 0.23, false));
  g.add(mesh(cyl(0.38, 0.38, 0.1, 14), 0xff5d73, 0, 1.38, 0, false), mesh(cyl(0.2, 0.22, 0.24, 12), 0x4c8bd6, 0, 1.84, 0), mesh(cyl(0.3, 0.3, 0.04, 12), 0x4c8bd6, 0, 1.73, 0, false));
  for (const s of [-1, 1]) { const arm = mesh(cyl(0.025, 0.02, 0.6, 4), WOOD_DARK, s * 0.48, 1.2, 0, false); arm.rotation.z = s * 1.0; g.add(arm); }
  return g;
}

/** A snowy wooden start ramp for the sled run (goes down toward +x, `len` long, starting `h` high). */
export function makeSledRamp(len, h) {
  const g = new THREE.Group();
  const L = Math.hypot(len, h);
  const deck = mesh(box(L, 0.16, 1.9), 0xf2f7ff, len / 2, h / 2, 0);
  deck.rotation.z = -Math.atan2(h, len);
  g.add(deck);
  for (const z of [-1, 1]) {
    const rail = mesh(box(L, 0.22, 0.12), 0x9a6440, len / 2, h / 2 + 0.16, z * 0.98);
    rail.rotation.z = deck.rotation.z;
    g.add(rail);
  }
  for (let i = 0; i < 3; i++) {
    const x = i * len * 0.3 + 0.2, y = h * (1 - x / len);
    for (const z of [-0.9, 0.9]) g.add(mesh(box(0.14, y + 0.1, 0.14), WOOD_DARK, x, y / 2, z));
  }
  g.add(mesh(box(1.2, 0.18, 2.1), 0x9a6440, -0.5, h - 0.05, 0));
  for (const z of [-0.9, 0.9]) g.add(mesh(box(0.14, h + 0.6, 0.14), WOOD_DARK, -0.9, (h + 0.6) / 2, z));
  return g;
}

/** A sparkly snowflake to collect on the sled run. */
export function makeSnowflake() {
  const g = new THREE.Group();
  const m = toon(0xbff6ff, { emissive: 0x335566 });
  for (let i = 0; i < 3; i++) { const b = mesh(box(0.7, 0.08, 0.08), m, 0, 0, 0, false); b.rotation.z = (i / 3) * Math.PI; g.add(b); }
  g.add(mesh(sph(0.12, 8, 6), m, 0, 0, 0, false));
  return g;
}

// ---------- festivals ----------

/** Spring Planting Fair: flower pots and seed stands around the fountain. */
export function makePlantFair() {
  const g = new THREE.Group();
  const pot = (x, z, c) => {
    const p = new THREE.Group();
    p.add(mesh(cyl(0.3, 0.22, 0.4, 10), 0xd9776a, 0, 0.2, 0));
    for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2; p.add(mesh(cyl(0.02, 0.02, 0.4, 4), 0x58b947, Math.cos(a) * 0.1, 0.55, Math.sin(a) * 0.1, false), mesh(ico(0.1, 0), c, Math.cos(a) * 0.1, 0.78, Math.sin(a) * 0.1, false)); }
    p.position.set(x, 0, z);
    g.add(p);
  };
  const cols = [0xff7eb6, 0xffd23f, 0xb08bff, 0xff5d73, 0xffffff];
  for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; pot(Math.cos(a) * 3.0, Math.sin(a) * 3.0, cols[i % cols.length]); }
  // a seed stand with packets
  const st = new THREE.Group();
  st.add(mesh(box(1.8, 0.8, 0.7), WOOD, 0, 0.4, 0), mesh(cone(1.3, 0.7, 4), 0x8ac926, 0, 2.3, 0).rotateY(Math.PI / 4));
  for (const sx of [-1, 1]) st.add(mesh(box(0.08, 1.9, 0.08), 0xffffff, sx * 0.85, 1.0, 0.3, false));
  for (let i = 0; i < 5; i++) st.add(mesh(box(0.26, 0.34, 0.04), [0xf3d9a4, 0xffe0f0, 0xe0f0ff][i % 3], -0.6 + i * 0.3, 0.95, 0.3, false));
  st.position.set(-4.6, 0, 3.4);
  g.add(st);
  return g;
}

/** Summer Beach Day: parasols, towels and beach balls. */
export function makeBeachDay() {
  const g = new THREE.Group();
  for (const [x, z, c] of [[0, 0, 0xff5d73], [5, 1, 0xffc93c], [9.5, -0.5, 0x9b5de5]]) {
    g.add(mesh(cyl(0.04, 0.04, 2.2, 5), 0xffffff, x, 1.1, z), mesh(cone(1.3, 0.55, 10), c, x, 2.25, z));
    g.add(mesh(box(1.0, 0.03, 1.8), [0x4cc9f0, 0xffe47a, 0x3ddc97][Math.abs(x) % 3], x + 1.0, 0.03, z + 0.4, false));
  }
  for (const [x, z] of [[2.6, 2.2], [7.4, 2.6]]) {
    const b = new THREE.Group();
    b.add(mesh(sph(0.3, 12, 8), 0xffffff, 0, 0, 0), mesh(tor(0.3, 0.06), 0xff5d73, 0, 0, 0, false), mesh(tor(0.3, 0.06), 0x4cc9f0, 0, 0, 0, false).rotateY(Math.PI / 2));
    b.position.set(x, 0.3, z);
    g.add(b);
  }
  return g;
}

/** A glinting sea shell on the sand (Beach Day hunt). */
export function makeBeachShell() {
  const g = new THREE.Group();
  for (let i = 0; i < 5; i++) { const a = -0.8 + (i / 4) * 1.6; const r = mesh(cyl(0.03, 0.05, 0.32, 5), i % 2 ? 0xffd8c8 : 0xffb8a8, Math.sin(a) * 0.12, 0.05, Math.cos(a) * 0.12 - 0.1); r.rotation.set(Math.PI / 2, 0, -a); g.add(r); }
  return g;
}

// ---------- new decorations ----------

export function makeDeco3(id, M) {
  const g = new THREE.Group();
  switch (id) {
    case 'tulips': // a tub of spring tulips
      g.add(mesh(box(0.9, 0.4, 0.5), WOOD, 0, 0.2, 0));
      for (let i = 0; i < 5; i++) {
        g.add(mesh(cyl(0.02, 0.02, 0.45, 4), 0x58b947, -0.32 + i * 0.16, 0.6, 0, false));
        const f = mesh(sph(0.09, 8, 6), [0xff5d73, 0xffd23f, 0xff7eb6, 0xb08bff, 0xff8c42][i], -0.32 + i * 0.16, 0.86, 0, false);
        f.scale.y = 1.4;
        g.add(f);
      }
      break;
    case 'sandcastle':
      g.add(mesh(box(0.9, 0.35, 0.9), 0xf0d48a, 0, 0.17, 0));
      for (const [x, z] of [[-0.35, -0.35], [0.35, -0.35], [-0.35, 0.35], [0.35, 0.35]]) g.add(mesh(cyl(0.14, 0.16, 0.6, 8), 0xf0d48a, x, 0.5, z), mesh(cone(0.16, 0.22, 8), 0xe8c070, x, 0.9, z));
      g.add(mesh(cyl(0.2, 0.24, 0.5, 8), 0xf0d48a, 0, 0.6, 0), mesh(cyl(0.01, 0.01, 0.4, 4), WOOD_DARK, 0, 1.05, 0, false), mesh(box(0.2, 0.12, 0.02), 0xff5d73, 0.1, 1.18, 0, false));
      break;
    case 'fishTrophy': case 'fishStatue': {
      const gold = id === 'fishTrophy';
      g.add(mesh(box(0.7, 0.5, 0.7), gold ? 0x5a4d7a : 0xbdb8cf, 0, 0.25, 0), mesh(cyl(0.08, 0.12, 0.35, 8), gold ? COLORS.gold : 0xa8a2bf, 0, 0.67, 0));
      const f = new THREE.Group();
      const body = mesh(sph(0.3, 12, 8), gold ? COLORS.gold : 0x8fd8ff, 0, 0, 0);
      body.scale.set(1.3, 0.75, 0.45);
      const tail = mesh(cone(0.2, 0.3, 4), gold ? COLORS.gold : 0x8fd8ff, -0.45, 0, 0);
      tail.rotation.z = Math.PI / 2;
      tail.scale.z = 0.3;
      f.add(body, tail, mesh(sph(0.05, 6, 4), INK, 0.25, 0.07, 0.12, false));
      f.position.y = 1.15;
      f.rotation.z = 0.5;
      g.add(f);
      if (gold) g.userData.spin = f;
      break;
    }
    case 'crystalLamp':
      g.add(mesh(cyl(0.3, 0.38, 0.3, 8), 0x5a4d7a, 0, 0.15, 0));
      for (let i = 0; i < 5; i++) {
        const c = mesh(ico(0.18, 0), toon([0x8ff0ff, 0xc9a8ff, 0xff9fd0][i % 3], { emissive: 0x334455 }), Math.cos(i * 1.26) * 0.14, 0.5 + (i % 2) * 0.25, Math.sin(i * 1.26) * 0.14, false);
        c.scale.y = 1.8;
        g.add(c);
      }
      break;
    case 'goldShell': {
      g.add(mesh(cyl(0.35, 0.4, 0.3, 10), 0x5a4d7a, 0, 0.15, 0));
      const s = new THREE.Group();
      for (let i = 0; i < 7; i++) { const a = -0.9 + (i / 6) * 1.8; const r = mesh(cyl(0.05, 0.09, 0.62, 5), COLORS.gold, Math.sin(a) * 0.26, 0, Math.cos(a) * 0.26 - 0.18); r.rotation.set(Math.PI / 2, 0, -a); s.add(r); }
      s.rotation.x = -1.1;
      s.position.y = 0.6;
      g.add(s);
      break;
    }
    case 'shellChime':
      g.add(mesh(box(0.08, 1.6, 0.08), WOOD_DARK, 0, 0.8, 0), mesh(box(0.8, 0.08, 0.08), WOOD_DARK, 0.3, 1.6, 0));
      for (let i = 0; i < 4; i++) g.add(mesh(cyl(0.006, 0.006, 0.4, 3), 0xffffff, 0.06 + i * 0.16, 1.4, 0, false), mesh(sph(0.07, 8, 6), [0xffd8c8, 0x8fe0c0, 0xff9fd0, 0xbff6ff][i], 0.06 + i * 0.16, 1.18, 0, false));
      break;
    case 'snowGlobe':
      g.add(mesh(cyl(0.3, 0.35, 0.25, 12), WOOD, 0, 0.12, 0), mesh(sph(0.36, 14, 10), toon(0xdff4ff, { transparent: true, opacity: 0.45 }), 0, 0.55, 0, false), mesh(cone(0.14, 0.32, 6), 0x3fae4a, 0, 0.5, 0, false), mesh(sph(0.05, 6, 4), 0xffffff, 0.1, 0.72, 0.1, false));
      break;
    default:
      g.add(mesh(ico(0.3, 0), 0xc9a8ff, 0, 0.3, 0));
  }
  return g;
}

export const DECO3 = new Set(['tulips', 'sandcastle', 'fishTrophy', 'fishStatue', 'crystalLamp', 'goldShell', 'shellChime', 'snowGlobe']);
