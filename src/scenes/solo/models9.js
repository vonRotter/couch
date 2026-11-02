import * as THREE from 'three';
import { toon, sharedGeo, faceted } from '../../core/palette.js';
import { mesh, box, cyl, sph, cone, ico, WOOD, WOOD_DARK, makeCrate, makeBarrel, makeSign } from './models.js';
import { makePalm } from './models3.js';
import { ownToon, glowMat } from './models8.js';

// The jumping round (the owner's "Jumping" and "More fun" lists): things to hop on (stepping stones, lily
// pads, ledge rocks, stumps, logs, planks, crates and barrels, the lookout deck), the hollow tree, the tiny
// islet, treasure chests, trail bells and signs, autumn leaf piles, winter snow forts, the kite, falling star
// bits, the traveling merchant's cart, the visitor's balloon, the bottle with a map, and the new yard
// decorations. Every hop-on model has its standable top at local y = h (the ground or water below at 0).

const lowCyl = (rt, rb, h, seg) => sharedGeo(`j9-lcyl${rt}|${rb}|${h}|${seg}`, () => faceted(new THREE.CylinderGeometry(rt, rb, h, seg)));
const dodeca = (r) => sharedGeo(`j9-dode${r}`, () => faceted(new THREE.DodecahedronGeometry(r, 0)));
const hemi = (r, w = 14, h = 8) => sharedGeo(`j9-hemi${r}|${w}|${h}`, () => new THREE.SphereGeometry(r, w, h, 0, Math.PI * 2, 0, Math.PI / 2));
const gore = (r, i, n) => sharedGeo(`j9-gore${r}|${i}|${n}`, () => new THREE.SphereGeometry(r, 6, 12, (i / n) * Math.PI * 2, (Math.PI * 2) / n));
const halfCyl = (r, len) => sharedGeo(`j9-hcyl${r}|${len}`, () => new THREE.CylinderGeometry(r, r, len, 12, 1, false, 0, Math.PI));
const STONE = 0xb9b3c9, STONE_D = 0x948eaa, MOSS = 0x7fbf5a;

/** A round stepping stone: its flat top at h (a water line ring when it stands in water). */
export function makeStepStone(r, h, wet = true) {
  const g = new THREE.Group();
  const deep = Math.max(0.6, h + 0.8);
  g.add(mesh(lowCyl(r, r * 1.15, deep, 9), STONE, 0, h - deep / 2, 0));
  g.add(mesh(lowCyl(r * 0.92, r, 0.08, 9), 0xd2cde0, 0, h - 0.02, 0, false));
  const moss = mesh(sph(r * 0.35, 8, 6), MOSS, r * 0.35, h, -r * 0.3, false);
  moss.scale.set(1, 0.25, 0.8);
  g.add(moss);
  if (wet) g.add(mesh(lowCyl(r * 1.22, r * 1.22, 0.04, 12), toon(0xffffff, { transparent: true, opacity: 0.55 }), 0, 0.02, 0, false));
  return g;
}

/** A lily pad with a flower (floats; the bean can stand on it for a moment of fun). */
export function makeLilyPad(r) {
  const g = new THREE.Group();
  const pad = mesh(cyl(r, r, 0.06, 18), 0x5fbf4a, 0, 0, 0, false);
  g.add(pad);
  g.add(mesh(box(r * 0.9, 0.07, 0.12), 0x4aa63c, r * 0.45, 0.01, 0, false));
  const fl = new THREE.Group();
  for (let i = 0; i < 6; i++) { const p = mesh(cone(0.07, 0.22, 5), 0xff9fd0, Math.cos(i) * 0.08, 0.1, Math.sin(i) * 0.08, false); p.rotation.set(Math.sin(i) * 0.6, 0, Math.cos(i) * 0.6); fl.add(p); }
  fl.add(mesh(sph(0.05, 6, 4), 0xffd23f, 0, 0.12, 0, false));
  fl.position.set(-r * 0.4, 0.02, r * 0.3);
  g.add(fl);
  return g;
}

/** A lumpy ledge rock with a flattish top at h. */
export function makeLedgeRock(r, h, seed = 0) {
  const g = new THREE.Group();
  const deep = Math.max(0.8, h + 0.9);
  const body = mesh(lowCyl(r * 0.95, r * 1.3, deep, 7), seed % 2 ? STONE : STONE_D, 0, h - deep / 2, 0);
  body.rotation.y = seed * 0.7;
  g.add(body);
  const top = mesh(lowCyl(r, r * 0.98, 0.14, 7), 0xcfc9dc, 0, h - 0.06, 0, false);
  top.rotation.y = seed * 0.7;
  g.add(top);
  for (let i = 0; i < 2; i++) { const b = mesh(dodeca(r * 0.45), STONE_D, Math.cos(seed + i * 3) * r * 0.9, h * 0.35 * (i + 1) - 0.2, Math.sin(seed + i * 3) * r * 0.9); g.add(b); }
  const moss = mesh(sph(r * 0.4, 8, 6), MOSS, -r * 0.3, h + 0.01, r * 0.2, false);
  moss.scale.set(1, 0.2, 0.7);
  g.add(moss);
  return g;
}

/** A tree stump (rings on top, a little sprout). */
export function makeStump(r, h) {
  const g = new THREE.Group();
  g.add(mesh(cyl(r, r * 1.15, h, 12), 0x8a5a32, 0, h / 2, 0));
  g.add(mesh(cyl(r * 0.96, r * 0.96, 0.04, 14), 0xe8c38a, 0, h + 0.005, 0, false));
  g.add(mesh(cyl(r * 0.6, r * 0.6, 0.045, 14), 0xd2a66a, 0, h + 0.01, 0, false));
  g.add(mesh(cyl(r * 0.25, r * 0.25, 0.05, 10), 0xe8c38a, 0, h + 0.015, 0, false));
  for (let i = 0; i < 3; i++) { const root = mesh(box(0.18, 0.14, r * 0.9), 0x7a4a2a, Math.cos(i * 2.1) * r, 0.06, Math.sin(i * 2.1) * r); root.rotation.y = -i * 2.1 + Math.PI / 2; g.add(root); }
  const leaf = mesh(sph(0.08, 6, 4), 0x6fcf4a, r * 0.7, h + 0.12, 0.1, false);
  leaf.scale.set(1, 0.4, 0.6);
  g.add(leaf);
  return g;
}

/** A log lying along x (half length hw), its top at h. */
export function makeLog(hw, hd, h) {
  const g = new THREE.Group();
  const r = h / 2;
  const log = mesh(cyl(r, r, hw * 2, 12), 0x8a5a32, 0, r, 0);
  log.rotation.z = Math.PI / 2;
  g.add(log);
  for (const s of [-1, 1]) { const end = mesh(cyl(r * 0.92, r * 0.92, 0.04, 12), 0xe8c38a, s * hw, r, 0, false); end.rotation.z = Math.PI / 2; g.add(end); }
  g.add(mesh(box(hw * 1.6, 0.03, hd * 0.7), 0x9a6a3e, 0, h + 0.005, 0, false));
  return g;
}

/** A narrow plank on two trestles (a balance beam), top at h. */
export function makePlank(hw, hd, h) {
  const g = new THREE.Group();
  g.add(mesh(box(hw * 2, 0.12, hd * 2), WOOD, 0, h - 0.06, 0));
  for (const s of [-1, 1]) {
    g.add(mesh(box(0.12, h - 0.1, 0.5), WOOD_DARK, s * (hw - 0.25), (h - 0.1) / 2, 0));
    g.add(mesh(box(0.12, 0.1, 0.7), WOOD_DARK, s * (hw - 0.25), 0.05, 0));
  }
  return g;
}

/** Crates stacked up to h (one crate is 0.7 high; the top one takes the rest). */
export function makeCrateStack(h) {
  const g = new THREE.Group();
  let y = 0, i = 0;
  while (h - y > 0.05) {
    const s = Math.min(1.25, (h - y) / 0.7);
    const c = makeCrate();
    c.scale.set(1.25, s, 1.25);
    c.position.y = y;
    c.rotation.y = (i % 2) * 0.12;
    g.add(c);
    y += 0.7 * s;
    i++;
  }
  return g;
}

/** A barrel as tall as h. */
export function makeTallBarrel(h, color) {
  const b = makeBarrel(color);
  b.scale.set(1.08, h / 0.9, 1.08);
  return b;
}

/** The lookout deck on the cliff top: a wooden platform (top at h) with a railing at the back and a flag. */
export function makeDeck(hw, hd, h) {
  const g = new THREE.Group();
  g.add(mesh(box(hw * 2, 0.16, hd * 2), WOOD, 0, h - 0.08, 0));
  for (let i = 0; i < Math.round(hw * 2 / 0.4); i++) g.add(mesh(box(0.03, 0.02, hd * 2), WOOD_DARK, -hw + 0.2 + i * 0.4, h + 0.005, 0, false));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(mesh(box(0.14, h + 0.6, 0.14), WOOD_DARK, sx * (hw - 0.1), (h - 0.6) / 2, sz * (hd - 0.1)));
  // railing at the back (north) and the sides: the front stays open toward the view
  g.add(mesh(box(hw * 2, 0.08, 0.08), WOOD_DARK, 0, h + 0.75, -hd + 0.1));
  for (const sx of [-1, 1]) g.add(mesh(box(0.08, 0.08, hd * 2), WOOD_DARK, sx * (hw - 0.1), h + 0.75, 0));
  for (let i = 0; i <= 6; i++) g.add(mesh(box(0.06, 0.75, 0.06), WOOD, -hw + 0.1 + i * (hw * 2 - 0.2) / 6, h + 0.38, -hd + 0.1));
  const pole = mesh(cyl(0.05, 0.05, 2.4, 6), 0xffffff, hw - 0.1, h + 1.2, -hd + 0.1);
  const flag = mesh(box(0.9, 0.5, 0.03), 0xff5d73, hw - 0.1 + 0.45, h + 2.1, -hd + 0.1, false);
  g.add(pole, flag);
  g.userData.flag = flag;
  return g;
}

/** A treasure chest. userData.lid opens (rotation.x), userData.glow shines while it is full. */
export function makeTreasure(color = 0xc68a52) {
  const g = new THREE.Group();
  g.add(mesh(box(0.8, 0.45, 0.55), color, 0, 0.225, 0));
  g.add(mesh(box(0.84, 0.08, 0.59), 0xffd23f, 0, 0.12, 0, false));
  const lid = new THREE.Group();
  const top = mesh(halfCyl(0.275, 0.8), color, 0, 0, 0.275);
  top.rotation.z = Math.PI / 2;
  lid.add(top);
  lid.add(mesh(box(0.84, 0.06, 0.08), 0xffd23f, 0, 0.12, 0.27, false));
  lid.add(mesh(box(0.14, 0.18, 0.06), 0xffd23f, 0, 0.05, 0.56, false));
  lid.position.set(0, 0.45, -0.275);
  g.add(lid);
  g.userData.lid = lid;
  const glow = new THREE.Mesh(sph(0.55, 12, 8), glowMat(0xffe27a, 0.22));
  glow.position.y = 0.4;
  g.add(glow);
  g.userData.glow = glow;
  return g;
}

/** A bell on a post: ring it at the end of a hop trail. userData.bell swings. */
export function makeBellPost(color = 0xffc93c) {
  const g = new THREE.Group();
  g.add(mesh(box(0.12, 1.5, 0.12), WOOD_DARK, 0, 0.75, 0));
  g.add(mesh(box(0.7, 0.1, 0.12), WOOD_DARK, 0.25, 1.48, 0));
  const bell = new THREE.Group();
  bell.add(mesh(cone(0.2, 0.32, 12), color, 0, -0.18, 0));
  bell.add(mesh(sph(0.06, 8, 6), 0x8a5a32, 0, -0.36, 0, false));
  bell.position.set(0.48, 1.43, 0);
  g.add(bell);
  g.userData.bell = bell;
  return g;
}

/** The sign at the start of a hop trail: a board and a little checkered flag. */
export function makeTrailSign(color) {
  const g = makeSign(color, 1.3);
  const pole = mesh(cyl(0.035, 0.035, 1.9, 6), 0xffffff, 0.85, 0.95, 0);
  g.add(pole);
  for (let i = 0; i < 6; i++) g.add(mesh(box(0.16, 0.16, 0.02), i % 2 ? 0x2b2340 : 0xffffff, 0.85 + 0.09 + (i % 3) * 0.16, 1.78 - Math.floor(i / 3) * 0.16, 0, false));
  return g;
}

/**
 * The hollow tree: a huge old trunk, open at the top (you hop up into the hollow), roots, a mushroom shelf,
 * a branch and leafy side boughs that leave the hollow open to the sky. Top of the rim at h.
 */
export function makeHollowTree(r, h) {
  const g = new THREE.Group();
  const bark = 0x8a5a32;
  const n = 14;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const hh = h + (i % 3 === 0 ? 0.35 : i % 2 ? 0.1 : 0.2);
    const st = mesh(box(r * 0.5, hh, 0.42), i % 2 ? bark : 0x7a4a2a, Math.cos(a) * (r - 0.2), hh / 2, Math.sin(a) * (r - 0.2));
    st.rotation.y = -a + Math.PI / 2;
    g.add(st);
  }
  g.add(mesh(cyl(r - 0.35, r - 0.35, 0.1, 16), 0x5a3a20, 0, h - 0.55, 0, false)); // the floor of the hollow
  g.add(mesh(cyl(r - 0.38, r - 0.38, h - 0.6, 16), 0x3a2414, 0, (h - 0.6) / 2, 0, false));
  // a dark doorway-shaped knot hole at the front
  g.add(mesh(box(0.55, 0.75, 0.1), 0x2b1a10, 0.2, 0.9, r - 0.02, false));
  for (let i = 0; i < 5; i++) { const a = i * 1.3 + 0.4; const root = mesh(box(0.35, 0.3, 1.2), 0x7a4a2a, Math.cos(a) * (r + 0.3), 0.12, Math.sin(a) * (r + 0.3)); root.rotation.y = -a + Math.PI / 2; g.add(root); }
  // side boughs with leaves (to the back and the sides, so the hollow stays open)
  for (const [a, y, L] of [[Math.PI * 1.15, h - 0.4, 2.2], [Math.PI * 1.65, h - 0.1, 2.0], [Math.PI * 0.05, h - 0.7, 1.6], [Math.PI * 1.4, h + 0.4, 1.6]]) {
    const b = mesh(cyl(0.16, 0.22, L, 7), bark, Math.cos(a) * (r + L / 2 - 0.4), y + 0.4, Math.sin(a) * (r + L / 2 - 0.4));
    b.rotation.z = Math.PI / 2 - 0.35;
    b.rotation.y = -a;
    g.add(b);
    for (let k = 0; k < 3; k++) {
      const lf = mesh(ico(0.9 - k * 0.15, 1), toon(k ? 0x6fcf4a : 0x4cb84a, { flat: true }), Math.cos(a) * (r + L - 0.2) + (k - 1) * 0.4, y + 1.0 + k * 0.25, Math.sin(a) * (r + L - 0.2) + (k % 2) * 0.3);
      g.add(lf);
    }
  }
  // the mushroom shelf on the trunk (a step up) is placed by hops.js; a bird on the rim
  const bird = new THREE.Group();
  bird.add(mesh(sph(0.13, 8, 6), 0x4cc9f0, 0, 0.12, 0, false), mesh(sph(0.08, 8, 6), 0x4cc9f0, 0.1, 0.24, 0, false), mesh(cone(0.03, 0.08, 4), 0xffb020, 0.19, 0.24, 0, false).rotateZ(-Math.PI / 2));
  bird.position.set(-(r - 0.2), h + 0.35, -0.3);
  g.add(bird);
  return g;
}

/** A mushroom shelf growing out of a trunk (a step), its top at h. */
export function makeShelf(r, h) {
  const g = new THREE.Group();
  g.add(mesh(cyl(0.08, 0.1, h, 6), 0xf3e8d2, 0, h / 2, 0, false));
  const cap = mesh(hemi(r, 14, 8), 0xff8c42, 0, h - 0.18, 0);
  cap.scale.y = 0.45;
  g.add(cap);
  for (let i = 0; i < 4; i++) g.add(mesh(sph(0.06, 6, 4), 0xffffff, Math.cos(i * 1.7) * r * 0.55, h - 0.02, Math.sin(i * 1.7) * r * 0.55, false));
  return g;
}

/** A big branch sticking out (a box platform along x), top at h, on a slanted support. */
export function makeBranchStep(hw, hd, h) {
  const g = new THREE.Group();
  g.add(mesh(box(hw * 2, 0.26, hd * 2), 0x8a5a32, 0, h - 0.13, 0));
  const prop = mesh(cyl(0.12, 0.16, h, 6), 0x7a4a2a, -hw * 0.4, h / 2 - 0.1, 0);
  prop.rotation.z = -0.25;
  g.add(prop);
  const lf = mesh(ico(0.45, 1), toon(0x6fcf4a, { flat: true }), hw, h + 0.15, 0);
  g.add(lf);
  return g;
}

/** The tiny islet: a sandy mound (top at h above the water), a palm, shells and rocks. */
export function makeIslet(r, h) {
  const g = new THREE.Group();
  const sand = mesh(hemi(r, 18, 10), 0xf7e1a6, 0, h - 0.5, 0);
  sand.scale.y = 0.5 / r + 0.02;
  g.add(sand);
  g.add(mesh(cyl(r * 1.05, r * 1.25, 1.6, 18), 0xe8cf8f, 0, h - 1.3, 0, false));
  const palm = makePalm(() => 0.4);
  palm.position.set(r * 0.45, h - 0.05, -r * 0.35);
  palm.scale.setScalar(0.8);
  g.add(palm);
  for (const [x, z, s] of [[-r * 0.7, r * 0.3, 0.35], [r * 0.6, r * 0.55, 0.25]]) g.add(mesh(dodeca(s), STONE, x, h - 0.1, z));
  g.add(mesh(cone(0.12, 0.2, 6), 0xff9fc0, -0.3, h + 0.02, r * 0.6, false));
  return g;
}

/** A small glade on the grove: glowing mushrooms, flowers and a moss carpet (decoration only). */
export function makeGroveBits(w, d) {
  const g = new THREE.Group();
  const moss = mesh(cyl(1, 1, 0.04, 20), 0x6db34a, 0, 0.02, 0, false);
  moss.scale.set(w / 2, 1, d / 2);
  g.add(moss);
  const glowCap = ownToon(0x9ff0ff, 0x2a8aa0);
  for (let i = 0; i < 9; i++) {
    const a = i * 2.39, rr = 0.6 + (i % 4) * 0.55;
    const x = Math.cos(a) * rr * (w / 4), z = Math.sin(a) * rr * (d / 4);
    const m = new THREE.Group();
    m.add(mesh(cyl(0.05, 0.07, 0.3, 6), 0xf3e8d2, 0, 0.15, 0, false));
    const cap = new THREE.Mesh(hemi(0.16, 10, 6), glowCap);
    cap.position.y = 0.28;
    m.add(cap);
    m.position.set(x, 0, z);
    m.scale.setScalar(0.8 + (i % 3) * 0.35);
    g.add(m);
  }
  for (let i = 0; i < 14; i++) {
    const a = i * 1.7, rr = (i % 5) * 0.45 + 0.4;
    g.add(mesh(sph(0.09, 6, 4), [0xff7eb6, 0xffd23f, 0xffffff, 0xb08bff][i % 4], Math.cos(a) * rr * (w / 5), 0.18, Math.sin(a) * rr * (d / 5), false));
    g.add(mesh(cyl(0.015, 0.015, 0.18, 3), 0x5fae3a, Math.cos(a) * rr * (w / 5), 0.09, Math.sin(a) * rr * (d / 5), false));
  }
  g.userData.glowCap = glowCap;
  return g;
}

/** A grove tree (a round tree with a few glowing fruit). */
export function makeGroveTree(s = 1) {
  const g = new THREE.Group();
  g.add(mesh(cyl(0.22, 0.32, 1.6, 8), 0x8a5a32, 0, 0.8, 0));
  for (const [x, y, z, r] of [[0, 2.1, 0, 1.1], [0.55, 1.75, 0.2, 0.75], [-0.5, 1.8, -0.15, 0.8], [0.05, 2.75, 0.05, 0.7]]) g.add(mesh(ico(r, 1), toon(0x3fae6a, { flat: true }), x, y, z));
  for (let i = 0; i < 4; i++) g.add(mesh(sph(0.1, 8, 6), toon(0xfff1a8, { emissive: 0x806020 }), Math.cos(i * 1.6) * 0.9, 1.9 + (i % 2) * 0.4, Math.sin(i * 1.6) * 0.9, false));
  g.scale.setScalar(s);
  return g;
}

// ---------- the "More fun" bits ----------

/** An autumn leaf pile (jump into it!). userData.leaves are the top blobs (they burst and grow back). */
export function makeLeafPile() {
  const g = new THREE.Group();
  const cols = [0xff8c42, 0xffb020, 0xd9583a, 0xffd23f];
  const leaves = [];
  for (let i = 0; i < 9; i++) {
    const a = i * 2.1, r = i ? 0.35 + (i % 3) * 0.18 : 0;
    const b = mesh(ico(0.42 - (i % 3) * 0.06, 0), toon(cols[i % 4], { flat: true }), Math.cos(a) * r, 0.22 + (i ? 0 : 0.18), Math.sin(a) * r);
    b.scale.y = 0.6;
    g.add(b);
    leaves.push(b);
  }
  g.userData.leaves = leaves;
  return g;
}

/** A low snow wall to hide behind in the snowball fight. */
export function makeSnowFort(w = 1.8) {
  const g = new THREE.Group();
  for (let i = 0; i < 4; i++) { const b = mesh(sph(0.42, 10, 8), 0xf4f8ff, -w / 2 + 0.25 + i * (w - 0.5) / 3, 0.3, 0); b.scale.set(1.1, 0.8, 0.9); g.add(b); }
  g.add(mesh(box(w, 0.35, 0.6), 0xe6eef8, 0, 0.17, 0));
  return g;
}

/** A snowball. */
export function makeSnowball() { return mesh(sph(0.16, 10, 8), 0xffffff, 0, 0, 0, false); }

/** A flat skipping stone. */
export function makeFlatStone() { const m = mesh(sph(0.14, 10, 6), 0xa8a2bf, 0, 0, 0, false); m.scale.set(1.2, 0.35, 1); return m; }

/** A pile of flat stones by the water (where you skip stones). */
export function makeStonePile() {
  const g = new THREE.Group();
  for (let i = 0; i < 6; i++) { const s = makeFlatStone(); s.position.set(Math.cos(i * 2.3) * 0.25 * (i % 3), 0.05 + Math.floor(i / 3) * 0.08, Math.sin(i * 2.3) * 0.25 * (i % 3)); s.rotation.y = i; g.add(s); }
  return g;
}

const kiteMat = (color) => { const m = ownToon(color); m.side = THREE.DoubleSide; return m; };
/** A kite (a diamond with a bow tail); userData.tail bits wave. */
export function makeKite(color = 0xff5d73) {
  const g = new THREE.Group();
  const d = mesh(sharedGeo('j9-kite', () => {
    const s = new THREE.Shape();
    s.moveTo(0, 0.7); s.lineTo(0.45, 0.1); s.lineTo(0, -0.6); s.lineTo(-0.45, 0.1); s.closePath();
    return new THREE.ShapeGeometry(s);
  }), kiteMat(color), 0, 0, 0, false);
  g.add(d);
  g.add(mesh(box(0.9, 0.03, 0.03), 0xffffff, 0, 0.1, 0.01, false), mesh(box(0.03, 1.3, 0.03), 0xffffff, 0, 0.05, 0.01, false));
  const tail = [];
  for (let i = 0; i < 4; i++) { const b = mesh(box(0.16, 0.08, 0.02), [0xffd23f, 0x4cc9f0][i % 2], 0, -0.75 - i * 0.22, 0, false); g.add(b); tail.push(b); }
  g.userData.tail = tail;
  return g;
}

/** A kite stand on the hill (where you borrow the kite). */
export function makeKiteStand() {
  const g = new THREE.Group();
  g.add(mesh(box(0.1, 1.3, 0.1), WOOD_DARK, -0.35, 0.65, 0), mesh(box(0.1, 1.3, 0.1), WOOD_DARK, 0.35, 0.65, 0), mesh(box(0.9, 0.1, 0.1), WOOD, 0, 1.25, 0));
  const k = makeKite(0x9b5de5);
  k.scale.setScalar(0.6);
  k.position.set(0, 1.0, 0.08);
  g.add(k);
  g.userData.kite = k;
  return g;
}

/** A falling star bit (glowing; catch it). */
export function makeStarBit(color = 0xfff27a) {
  const g = new THREE.Group();
  const core = new THREE.Mesh(sharedGeo('j9-star', () => faceted(new THREE.OctahedronGeometry(0.18, 0))), ownToon(color, color));
  g.add(core);
  const halo = new THREE.Mesh(sph(0.36, 10, 8), glowMat(color, 0.35));
  g.add(halo);
  g.userData.core = core;
  return g;
}

/** The traveling merchant's cart: a wagon with a striped canopy and odd things on display. */
export function makeMerchantCart() {
  const g = new THREE.Group();
  g.add(mesh(box(2.4, 0.9, 1.3), 0x9b5de5, 0, 0.85, 0));
  g.add(mesh(box(2.5, 0.1, 1.4), 0xffd23f, 0, 1.33, 0, false));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const w = mesh(cyl(0.38, 0.38, 0.12, 12), 0x8a5a32, sx * 0.8, 0.38, sz * 0.72); w.rotation.x = Math.PI / 2; g.add(w); }
  for (const sx of [-1, 1]) g.add(mesh(box(0.08, 1.4, 0.08), WOOD_DARK, sx * 1.15, 2.0, 0.6));
  for (let i = 0; i < 6; i++) g.add(mesh(box(0.42, 0.06, 1.5), i % 2 ? 0xffffff : 0x4cc9f0, -1.05 + i * 0.42, 2.72, 0.1, false));
  // odd things: a jar, a sock, a duck, a little box
  g.add(mesh(cyl(0.14, 0.14, 0.3, 10), toon(0xbff6ff, { transparent: true, opacity: 0.6 }), -0.8, 1.53, 0.4, false));
  g.add(mesh(box(0.12, 0.3, 0.1), 0xff5d73, -0.3, 1.53, 0.45, false));
  g.add(mesh(sph(0.15, 10, 8), 0xffd23f, 0.25, 1.5, 0.45, false), mesh(sph(0.1, 10, 8), 0xffd23f, 0.35, 1.68, 0.45, false));
  g.add(mesh(box(0.3, 0.22, 0.22), 0x3ddc97, 0.85, 1.5, 0.4, false));
  g.add(mesh(box(1.4, 0.4, 0.06), 0xfff3dc, 0, 2.25, 0.62, false));
  return g;
}

/** The merchant himself: a round traveler with a big hat and a backpack (a Character-free puppet). */
export function makeMerchant() {
  const g = new THREE.Group();
  const body = mesh(sph(0.48, 14, 10), 0xc9a8ff, 0, 0.6, 0);
  body.scale.set(1, 1.15, 1);
  g.add(body);
  for (const s of [-1, 1]) g.add(mesh(sph(0.07, 8, 6), 0x2b2340, s * 0.16, 0.82, 0.42, false));
  g.add(mesh(cone(0.08, 0.18, 6), 0xff9f6a, 0, 0.72, 0.5, false).rotateX(Math.PI / 2));
  const mus = mesh(box(0.34, 0.06, 0.06), 0x6a4a3a, 0, 0.64, 0.46, false);
  g.add(mus);
  g.add(mesh(cyl(0.62, 0.62, 0.05, 16), 0x5a3fd0, 0, 1.2, 0), mesh(cyl(0.3, 0.38, 0.45, 14), 0x5a3fd0, 0, 1.42, 0), mesh(cyl(0.39, 0.39, 0.08, 14), 0xffd23f, 0, 1.27, 0, false));
  g.add(mesh(box(0.55, 0.6, 0.3), 0x8a5a32, 0, 0.7, -0.5));
  return g;
}

/** A visitor's hot-air balloon (smaller than Sky Hop's; it lands and takes off). userData.top is the envelope. */
export function makeVisitorBalloon() {
  const g = new THREE.Group();
  g.add(mesh(box(1.1, 0.7, 1.1), 0xa0704a, 0, 0.35, 0), mesh(box(1.2, 0.1, 1.2), 0x8a5a32, 0, 0.72, 0, false));
  const top = new THREE.Group();
  const cols = [0x3ddc97, 0xffffff, 0x3ddc97, 0xffd23f];
  for (let i = 0; i < 8; i++) { const s = mesh(gore(1.6, i, 8), cols[i % 4], 0, 0, 0); s.scale.y = 1.2; top.add(s); }
  top.add(mesh(cyl(0.6, 0.35, 0.5, 12), 0x3ddc97, 0, -1.9, 0));
  top.position.y = 3.9;
  g.add(top);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(mesh(cyl(0.015, 0.015, 1.7, 3), 0x5a4a3a, sx * 0.45, 1.55, sz * 0.45, false));
  g.userData.top = top;
  return g;
}

/** The balloon visitor: an explorer bean with goggles and a scarf. */
export function makeExplorer() {
  const g = new THREE.Group();
  const body = mesh(sph(0.42, 14, 10), 0xffb86b, 0, 0.55, 0);
  body.scale.set(1, 1.2, 1);
  g.add(body);
  for (const s of [-1, 1]) { g.add(mesh(cyl(0.12, 0.12, 0.08, 10), 0x4cc9f0, s * 0.15, 0.82, 0.36, false).rotateX(Math.PI / 2)); g.add(mesh(sph(0.04, 6, 4), 0x2b2340, s * 0.15, 0.82, 0.41, false)); }
  g.add(mesh(box(0.5, 0.05, 0.05), 0x5a4a3a, 0, 0.82, 0.32, false));
  g.add(mesh(cyl(0.3, 0.42, 0.14, 12), 0xff5d73, 0, 0.4, 0, false));
  g.add(mesh(box(0.12, 0.35, 0.05), 0xff5d73, 0.22, 0.25, 0.32, false));
  g.add(mesh(cyl(0.44, 0.44, 0.04, 14), 0x8a5a32, 0, 1.08, 0), mesh(cyl(0.26, 0.3, 0.26, 12), 0x8a5a32, 0, 1.22, 0));
  return g;
}

/** A bottle washed up on the beach, with a rolled map inside. */
export function makeBottle() {
  const g = new THREE.Group();
  const glass = mesh(cyl(0.13, 0.13, 0.42, 10), toon(0x8fe0c0, { transparent: true, opacity: 0.6 }), 0, 0.13, 0, false);
  glass.rotation.z = Math.PI / 2;
  g.add(glass);
  const neck = mesh(cyl(0.05, 0.08, 0.16, 8), toon(0x8fe0c0, { transparent: true, opacity: 0.6 }), 0.28, 0.13, 0, false);
  neck.rotation.z = Math.PI / 2;
  g.add(neck, mesh(cyl(0.05, 0.05, 0.06, 6), 0x8a5a32, 0.38, 0.13, 0, false).rotateZ(Math.PI / 2));
  const paper = mesh(cyl(0.06, 0.06, 0.3, 6), 0xf3d9a4, -0.02, 0.13, 0, false);
  paper.rotation.z = Math.PI / 2;
  g.add(paper);
  return g;
}

/** A red X where the map says to dig (a little mound). */
export function makeDigX() {
  const g = new THREE.Group();
  for (const r of [Math.PI / 4, -Math.PI / 4]) { const b = mesh(box(0.9, 0.04, 0.16), 0xd9583a, 0, 0.03, 0, false); b.rotation.y = r; g.add(b); }
  const mound = mesh(sph(0.35, 10, 6), 0xc9a06a, 0, 0, 0, false);
  mound.scale.y = 0.35;
  g.add(mound);
  return g;
}

/** A little sparkle marker for a hidden thing (Mumble's hiding bush, a lost item). */
export function makeLostThing(kind) {
  const g = new THREE.Group();
  if (kind === 'hat') { g.add(mesh(cyl(0.34, 0.34, 0.04, 14), 0x5a4dc0, 0, 0.02, 0), mesh(cyl(0.2, 0.22, 0.22, 12), 0x5a4dc0, 0, 0.14, 0)); }
  else if (kind === 'rocket') { g.add(mesh(cyl(0.1, 0.12, 0.45, 10), 0xffffff, 0, 0.25, 0), mesh(cone(0.1, 0.18, 10), 0xff5d73, 0, 0.56, 0)); }
  else if (kind === 'cat') { g.add(mesh(sph(0.22, 10, 8), 0xffb86b, 0, 0.2, 0), mesh(sph(0.15, 10, 8), 0xffb86b, 0.18, 0.36, 0), mesh(cone(0.05, 0.1, 4), 0xffb86b, 0.14, 0.52, 0.06, false), mesh(cone(0.05, 0.1, 4), 0xffb86b, 0.14, 0.52, -0.06, false)); }
  else if (kind === 'hen') { g.add(mesh(sph(0.22, 10, 8), 0xffffff, 0, 0.25, 0), mesh(sph(0.14, 10, 8), 0xffffff, 0.15, 0.45, 0), mesh(box(0.06, 0.1, 0.04), 0xff5d73, 0.17, 0.6, 0, false)); }
  else if (kind === 'goggles') { for (const s of [-1, 1]) g.add(mesh(cyl(0.11, 0.11, 0.07, 10), 0x4cc9f0, s * 0.13, 0.1, 0, false).rotateX(Math.PI / 2)); g.add(mesh(box(0.5, 0.04, 0.04), 0x5a4a3a, 0, 0.1, -0.03, false)); }
  else { g.add(mesh(sph(0.2, 10, 8), 0xff9fd0, 0, 0.2, 0)); }
  const glint = mesh(box(0.06, 0.4, 0.06), toon(0xffffff), 0, 0.85, 0, false);
  g.add(glint);
  g.userData.glint = glint;
  return g;
}

// ---------- new yard decorations ----------

export const DECO9 = new Set(['glowShroom', 'gullVane', 'robotToy', 'owlHouse', 'shellChime', 'goldBell', 'rubberDuck', 'cloudJar', 'musicBox', 'balloonModel', 'starJar']);

export function makeDeco9(id) {
  const g = new THREE.Group();
  switch (id) {
    case 'glowShroom': {
      g.add(mesh(cyl(0.12, 0.16, 0.7, 8), 0xf3e8d2, 0, 0.35, 0));
      const cap = mesh(hemi(0.45, 14, 8), toon(0x9ff0ff, { emissive: 0x2a8aa0 }), 0, 0.65, 0);
      cap.scale.y = 0.7;
      g.add(cap);
      for (let i = 0; i < 5; i++) g.add(mesh(sph(0.06, 6, 4), 0xffffff, Math.cos(i * 1.3) * 0.3, 0.8, Math.sin(i * 1.3) * 0.3, false));
      g.add(mesh(hemi(0.2, 10, 6), toon(0xff9fd0, { emissive: 0x803050 }), 0.35, 0.25, 0.1));
      break;
    }
    case 'gullVane': {
      g.add(mesh(cyl(0.05, 0.06, 1.6, 6), 0x5a4a3a, 0, 0.8, 0));
      g.add(mesh(box(0.7, 0.04, 0.04), 0x5a4a3a, 0, 1.3, 0, false), mesh(box(0.04, 0.04, 0.7), 0x5a4a3a, 0, 1.3, 0, false));
      const gull = new THREE.Group();
      gull.add(mesh(sph(0.16, 10, 8), 0xffffff, 0, 0, 0), mesh(sph(0.1, 8, 6), 0xffffff, 0.16, 0.08, 0), mesh(cone(0.04, 0.12, 5), 0xffb020, 0.3, 0.07, 0, false).rotateZ(-Math.PI / 2));
      for (const s of [-1, 1]) { const w = mesh(box(0.18, 0.03, 0.4), 0xd9dde8, 0, 0.05, s * 0.25, false); w.rotation.x = s * 0.4; gull.add(w); }
      gull.position.y = 1.72;
      g.add(gull);
      g.userData.spin = gull;
      break;
    }
    case 'robotToy': {
      g.add(mesh(box(0.5, 0.55, 0.4), 0x9a94b2, 0, 0.45, 0), mesh(box(0.38, 0.32, 0.34), 0xbdb8cf, 0, 0.9, 0));
      for (const s of [-1, 1]) { g.add(mesh(sph(0.06, 8, 6), 0x7ff0ff, s * 0.09, 0.92, 0.18, false)); g.add(mesh(box(0.1, 0.36, 0.1), 0x9a94b2, s * 0.32, 0.45, 0)); g.add(mesh(box(0.14, 0.2, 0.16), 0x5b4fd8, s * 0.13, 0.1, 0)); }
      g.add(mesh(cyl(0.015, 0.015, 0.25, 4), 0x2b2340, 0, 1.18, 0, false), mesh(sph(0.05, 6, 4), 0xff5d73, 0, 1.31, 0, false));
      const key = mesh(box(0.04, 0.2, 0.2), 0xffd23f, 0, 0.5, -0.25, false);
      g.add(key);
      g.userData.spin = key;
      break;
    }
    case 'owlHouse': {
      g.add(mesh(box(0.1, 1.3, 0.1), WOOD_DARK, 0, 0.65, 0));
      g.add(mesh(box(0.55, 0.6, 0.5), 0xc68a52, 0, 1.55, 0));
      const roof = mesh(cone(0.5, 0.35, 4), 0xd9583a, 0, 2.02, 0);
      roof.rotation.y = Math.PI / 4;
      g.add(roof);
      g.add(mesh(cyl(0.11, 0.11, 0.05, 10), 0x2b1a10, 0, 1.6, 0.26, false).rotateX(Math.PI / 2));
      g.add(mesh(sph(0.11, 8, 6), 0x8a5a32, 0, 1.6, 0.27, false));
      for (const s of [-1, 1]) g.add(mesh(sph(0.035, 6, 4), 0xffd23f, s * 0.04, 1.63, 0.36, false));
      break;
    }
    case 'shellChime': {
      g.add(mesh(cyl(0.04, 0.05, 1.7, 6), 0xd9c09a, 0, 0.85, 0), mesh(box(0.8, 0.05, 0.05), 0xd9c09a, 0, 1.7, 0, false));
      const shells = new THREE.Group();
      for (let i = 0; i < 4; i++) { shells.add(mesh(cyl(0.006, 0.006, 0.4, 3), 0xffffff, -0.3 + i * 0.2, 1.48, 0, false)); shells.add(mesh(cone(0.07, 0.14, 6), [0xff9fc0, 0xffffff, 0xffd8a8, 0xbff6ff][i], -0.3 + i * 0.2, 1.25, 0, false)); }
      g.add(shells);
      g.userData.wave = shells;
      break;
    }
    case 'goldBell': {
      g.add(mesh(cyl(0.35, 0.45, 0.25, 10), 0x9a94b2, 0, 0.12, 0));
      g.add(mesh(box(0.08, 0.9, 0.08), WOOD_DARK, -0.3, 0.7, 0), mesh(box(0.08, 0.9, 0.08), WOOD_DARK, 0.3, 0.7, 0), mesh(box(0.75, 0.08, 0.1), WOOD_DARK, 0, 1.15, 0));
      const bell = mesh(cone(0.22, 0.38, 14), toon(0xffd23f, { emissive: 0x403000 }), 0, 0.88, 0);
      g.add(bell);
      g.userData.wave = bell;
      break;
    }
    case 'rubberDuck': {
      g.add(mesh(cyl(0.5, 0.5, 0.12, 16), toon(0x8fd8ff, { transparent: true, opacity: 0.8 }), 0, 0.06, 0, false));
      g.add(mesh(sph(0.28, 12, 10), 0xffd23f, 0, 0.3, 0), mesh(sph(0.17, 12, 10), 0xffd23f, 0.17, 0.58, 0), mesh(cone(0.07, 0.14, 6), 0xff8c42, 0.34, 0.56, 0, false).rotateZ(-Math.PI / 2));
      g.add(mesh(sph(0.03, 6, 4), 0x2b2340, 0.27, 0.64, 0.08, false));
      break;
    }
    case 'cloudJar': {
      g.add(mesh(cyl(0.3, 0.3, 0.6, 14), toon(0xdff6ff, { transparent: true, opacity: 0.45 }), 0, 0.42, 0, false));
      g.add(mesh(cyl(0.32, 0.32, 0.08, 14), 0xc68a52, 0, 0.75, 0));
      for (const [x, y] of [[-0.08, 0.4], [0.1, 0.45], [0, 0.55]]) g.add(mesh(sph(0.13, 10, 8), 0xffffff, x, y, 0, false));
      g.add(mesh(box(0.7, 0.1, 0.5), 0x8a5a32, 0, 0.05, 0));
      break;
    }
    case 'musicBox': {
      g.add(mesh(box(0.6, 0.4, 0.45), 0xff9fd0, 0, 0.3, 0), mesh(box(0.64, 0.05, 0.49), 0xffd23f, 0, 0.52, 0, false));
      const dancer = new THREE.Group();
      dancer.add(mesh(cyl(0.02, 0.02, 0.2, 4), 0xffd23f, 0, 0.1, 0, false), mesh(sph(0.08, 8, 6), 0xffffff, 0, 0.26, 0), mesh(cone(0.12, 0.16, 8), 0xff5d73, 0, 0.17, 0));
      dancer.position.y = 0.55;
      g.add(dancer);
      g.userData.spin = dancer;
      break;
    }
    case 'balloonModel': {
      g.add(mesh(box(0.3, 0.25, 0.3), 0xa0704a, 0, 0.13, 0));
      const top = new THREE.Group();
      for (let i = 0; i < 6; i++) top.add(mesh(gore(0.5, i, 6), [0x3ddc97, 0xffffff, 0xffd23f][i % 3], 0, 0, 0));
      top.position.y = 1.1;
      top.scale.y = 1.2;
      g.add(top);
      for (const s of [-1, 1]) g.add(mesh(cyl(0.01, 0.01, 0.6, 3), 0x5a4a3a, s * 0.12, 0.5, 0, false));
      g.userData.spin = top;
      break;
    }
    case 'starJar': {
      g.add(mesh(cyl(0.28, 0.28, 0.55, 14), toon(0xdff6ff, { transparent: true, opacity: 0.4 }), 0, 0.3, 0, false));
      g.add(mesh(cyl(0.3, 0.3, 0.08, 14), 0x5a3fd0, 0, 0.6, 0));
      for (let i = 0; i < 6; i++) g.add(mesh(sph(0.06, 6, 4), toon(0xfff27a, { emissive: 0x806000 }), Math.cos(i * 2) * 0.13, 0.15 + (i % 3) * 0.13, Math.sin(i * 2) * 0.13, false));
      break;
    }
    default: g.add(mesh(sph(0.3), 0xff9fd0, 0, 0.3, 0));
  }
  return g;
}
