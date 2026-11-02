import * as THREE from 'three';
import { toon, sharedGeo, faceted } from '../../core/palette.js';
import { mesh, box, cyl, sph, cone, ico, WOOD, WOOD_DARK } from './models.js';

// The Zip-Zap update (the owner's playtest): Pip's gadget in the bean's hand, the things it works on that
// must look different from the island's plain scenery (breakable ore rocks with cracks and sparkly ore,
// big ore boulders, choppable trees and their stumps), the soft "scan" glow those get while you hold the
// Zip-Zap, Pip's gadget bench by the rocket and the storage chest in the cottage. All built from
// primitives with toon() materials; anything that glows or fades gets its own material.

const gm = () => toon(0xffffff).gradientMap;
/** A fresh (not shared) toon material, for parts that change color or glow. */
export const ownToon = (color, emissive = 0x000000) => {
  const m = new THREE.MeshToonMaterial({ color, emissive, gradientMap: gm() });
  m.userData = {};
  return m;
};
/** A fresh additive glow material. */
export const glowMat = (color, opacity = 0.5) => {
  const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending });
  m.userData = {};
  return m;
};
const lowSph = (r, w, h) => sharedGeo(`zz-lsph${r}|${w}|${h}`, () => faceted(new THREE.SphereGeometry(r, w, h)));
const octa = (r) => sharedGeo(`zz-octa${r}`, () => faceted(new THREE.OctahedronGeometry(r, 0)));
const dodeca = (r) => sharedGeo(`zz-dode${r}`, () => faceted(new THREE.DodecahedronGeometry(r, 0)));

// ---------- the Zip-Zap ----------

/**
 * Pip's Zip-Zap: a slim silver wand with a purple grip, a little ring and a glowing tip (in the spirit of a
 * sonic screwdriver). userData.tip / halo have their own materials: the tip takes the color of what it is
 * about to do and pulses (zipzap.js). Points along +y, like the old tools.
 */
export function makeZipZap() {
  const g = new THREE.Group();
  g.add(mesh(cyl(0.065, 0.075, 0.34, 10), 0x6a4fc0, 0, 0.17, 0, false)); // grip
  for (const y of [0.07, 0.15, 0.23]) g.add(mesh(cyl(0.08, 0.08, 0.025, 10), 0x9b82ff, 0, y, 0, false)); // ribs
  g.add(mesh(cyl(0.09, 0.07, 0.06, 10), 0xd9d4ee, 0, 0.37, 0, false)); // collar
  g.add(mesh(cyl(0.05, 0.06, 0.28, 10), 0xd9d4ee, 0, 0.53, 0, false)); // shaft
  const fin = mesh(box(0.2, 0.06, 0.03), 0xff5d73, 0, 0.42, 0, false); // two little fins
  g.add(fin, mesh(box(0.03, 0.06, 0.2), 0xff5d73, 0, 0.42, 0, false));
  g.add(mesh(new THREE.TorusGeometry(0.085, 0.018, 6, 16), 0xffd23f, 0, 0.62, 0, false).rotateX(Math.PI / 2)); // ring
  const tip = new THREE.Mesh(sph(0.075, 12, 8), ownToon(0x7ff0ff, 0x2a8a99));
  tip.position.y = 0.72;
  const halo = new THREE.Mesh(sph(0.15, 12, 8), glowMat(0x7ff0ff, 0.35));
  halo.position.y = 0.72;
  g.add(tip, halo);
  g.userData.tip = tip;
  g.userData.halo = halo;
  return g;
}

// ---------- things to break, cut and chop ----------

export const ORE = [0x5ff2ff, 0xff6fd0, 0xffd23f, 0x8dff7a];
const ROCK_BODY = 0xd0935a, ROCK_TOP = 0xe8b07a, CRACK = 0x4a2c1c;

/** Dark crack lines on a rock face: zigzags of thin boxes, as a group to put on the surface. */
function cracks(w, seed) {
  const g = new THREE.Group();
  let x = -w * 0.35, y = 0;
  for (let i = 0; i < 4; i++) {
    const dx = w * 0.2, dy = ((i + seed) % 2 ? 1 : -1) * w * 0.14;
    const len = Math.hypot(dx, dy);
    const c = mesh(box(len, 0.035, 0.035), CRACK, x + dx / 2, y + dy / 2, 0, false);
    c.rotation.z = Math.atan2(dy, dx);
    g.add(c);
    x += dx; y += dy;
  }
  return g;
}

/** A sparkly ore spot: a little glowing gem. */
function oreSpot(color, s = 1) {
  const m = mesh(octa(0.09 * s), toon(color, { emissive: color === 0xffd23f ? 0x664400 : 0x225566 }), 0, 0, 0, false);
  m.scale.set(1, 1.4, 1);
  return m;
}

/**
 * A breakable ore rock (stone): a warm sandstone chunk, round and lumpy (the scenery rocks are flat grey
 * ones), with dark cracks and colored ore gems. userData.sparkles twinkle (zipzap.js).
 */
export function makeOreRock() {
  const g = new THREE.Group();
  const body = mesh(lowSph(0.62, 7, 5), ROCK_BODY, 0, 0.36, 0);
  body.scale.set(1, 0.72, 0.9);
  const top = mesh(lowSph(0.4, 6, 4), ROCK_TOP, -0.12, 0.66, -0.05);
  top.scale.set(1, 0.7, 1);
  const side = mesh(lowSph(0.3, 6, 4), ROCK_BODY, 0.55, 0.2, 0.15);
  side.scale.set(1, 0.75, 1);
  g.add(body, top, side);
  const c1 = cracks(0.9, 0); c1.position.set(-0.02, 0.38, 0.55); c1.rotation.y = 0.05;
  const c2 = cracks(0.6, 1); c2.position.set(-0.45, 0.4, 0.3); c2.rotation.y = -0.9;
  const c3 = cracks(0.4, 1); c3.position.set(0.6, 0.25, 0.42); c3.rotation.y = 0.5;
  g.add(c1, c2, c3);
  const sparkles = [];
  for (const [x, y, z, k] of [[0.25, 0.55, 0.45, 0], [-0.3, 0.3, 0.5, 1], [0.6, 0.38, 0.3, 2], [-0.1, 0.8, 0.2, 3], [0.05, 0.2, 0.62, 1]]) {
    const o = oreSpot(ORE[k]);
    o.position.set(x, y, z);
    o.rotation.set(x * 3, y * 5, z);
    g.add(o);
    sparkles.push(o);
  }
  g.userData.sparkles = sparkles;
  return g;
}

/** A big ore boulder (needs the Zip-Zap's mega buster): taller and deep purple, with big crystals. */
export function makeBigOre() {
  const g = new THREE.Group();
  const body = mesh(dodeca(0.95), 0x8a63c9, 0, 0.8, 0);
  body.scale.set(1.15, 0.95, 1);
  const top = mesh(lowSph(0.6, 7, 5), 0xa883e0, 0.2, 1.45, 0.05);
  top.scale.set(1, 0.7, 1);
  const side = mesh(lowSph(0.5, 6, 4), 0x7a55b8, -0.85, 0.35, 0.3);
  g.add(body, top, side);
  const c1 = cracks(1.2, 0); c1.position.set(0, 0.85, 0.9);
  const c2 = cracks(0.8, 1); c2.position.set(-0.7, 0.9, 0.55); c2.rotation.y = -0.8;
  g.add(c1, c2);
  const sparkles = [];
  for (const [x, y, z, k, s] of [[0.35, 1.0, 0.85, 0, 2], [-0.4, 0.55, 0.85, 2, 1.6], [0.8, 0.6, 0.55, 1, 1.8], [-0.1, 1.55, 0.4, 3, 1.4], [-0.9, 0.5, 0.65, 0, 1.2]]) {
    const o = oreSpot(ORE[k], s);
    o.position.set(x, y, z);
    o.rotation.set(x, y * 3, 0.3);
    g.add(o);
    sparkles.push(o);
  }
  g.userData.sparkles = sparkles;
  return g;
}

/**
 * A choppable tree: a sturdy round oak with a bright trunk ring (a band of lighter bark) so it reads as
 * "this one", and a few apples. userData.top is the crown (it shakes when the beam hits).
 */
export function makeChopTree() {
  const g = new THREE.Group();
  g.add(mesh(cyl(0.26, 0.36, 1.4, 9), 0x9a6440, 0, 0.7, 0));
  g.add(mesh(cyl(0.29, 0.31, 0.16, 9), 0xe2b06a, 0, 0.55, 0, false)); // the light band
  const top = new THREE.Group();
  top.position.y = 1.4;
  for (const [x, y, z, r, c] of [[0, 0.75, 0, 1.0, 0x48b04a], [0.6, 0.45, 0.15, 0.65, 0x5cc45a], [-0.55, 0.5, -0.1, 0.7, 0x3f9a42], [0.05, 1.3, 0.05, 0.6, 0x5cc45a]]) {
    const b = mesh(ico(1, 1), toon(c, { flat: true }), x, y, z);
    b.scale.setScalar(r);
    top.add(b);
  }
  for (const [x, y, z] of [[0.55, 0.55, 0.6], [-0.5, 0.75, 0.55], [0.15, 1.05, 0.75]]) top.add(mesh(sph(0.12, 8, 6), 0xff5d73, x, y, z, false));
  g.add(top);
  g.userData.top = top;
  return g;
}

/** What is left after chopping: a stump with rings and a tiny sprout (it grows back). */
export function makeStump() {
  const g = new THREE.Group();
  g.add(mesh(cyl(0.34, 0.4, 0.36, 9), 0x9a6440, 0, 0.18, 0));
  g.add(mesh(cyl(0.3, 0.3, 0.02, 9), 0xf0c890, 0, 0.37, 0, false));
  g.add(mesh(new THREE.TorusGeometry(0.17, 0.015, 4, 14), WOOD_DARK, 0, 0.385, 0, false).rotateX(Math.PI / 2));
  const sprout = new THREE.Group();
  sprout.add(mesh(cyl(0.02, 0.02, 0.25, 4), 0x58b947, 0.18, 0.5, 0.05, false));
  sprout.add(mesh(sph(0.08, 6, 4), 0x6fcf4a, 0.18, 0.64, 0.05, false));
  g.add(sprout);
  g.userData.sprout = sprout;
  return g;
}

/** The Crystal Caves rockfall gets the same breakable look: cracks and ore gems on its stones. */
export function decorateRockfall(g) {
  const sparkles = [];
  for (const [x, y, k] of [[-1.0, 0.8, 0], [0.3, 1.0, 1], [1.2, 0.7, 2], [-0.3, 1.7, 3], [0.8, 1.55, 0], [0.1, 0.45, 2]]) {
    const o = oreSpot(ORE[k], 1.3);
    o.position.set(x, y, 1.75);
    g.add(o);
    sparkles.push(o);
  }
  const c1 = cracks(1.2, 0); c1.position.set(-0.6, 0.9, 1.8);
  const c2 = cracks(1.0, 1); c2.position.set(0.7, 1.2, 1.65);
  g.add(c1, c2);
  g.userData.sparkles = sparkles;
  return g;
}

// ---------- the scan glow ----------

/**
 * The soft glow a breakable thing gets while you hold the Zip-Zap: a ring on the ground and a faint dome.
 * `mats` = { ring, dome } shared per kind (zipzap.js pulses their opacity); r = the thing's size.
 */
export function makeScanGlow(mats, r = 0.8, h = 1) {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(sharedGeo('zz-ring', () => new THREE.RingGeometry(0.82, 1, 32)), mats.ring);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.06;
  ring.scale.setScalar(r * 1.25);
  const dome = new THREE.Mesh(sharedGeo('zz-dome', () => new THREE.SphereGeometry(1, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2)), mats.dome);
  dome.scale.set(r * 1.2, h, r * 1.2);
  g.add(ring, dome);
  g.visible = false;
  return g;
}

// ---------- Pip's gadget bench and the cottage chest ----------

/** Pip's gadget bench by the rocket (Zip-Zap upgrades): a little metal table with a screen and tools. */
export function makeGadgetBench(M) {
  const g = new THREE.Group();
  g.add(mesh(box(1.5, 0.12, 0.8), 0xd9d4ee, 0, 0.82, 0), mesh(box(1.4, 0.76, 0.7), 0x6a7ab0, 0, 0.4, 0));
  g.add(mesh(box(0.06, 0.6, 0.06), 0x9a94b2, -0.55, 1.15, -0.25));
  const screen = mesh(box(0.7, 0.45, 0.05), M?.screen || 0x5ad6ff, -0.15, 1.25, -0.28, false);
  g.add(screen, mesh(box(0.8, 0.55, 0.04), 0x2b2340, -0.15, 1.25, -0.31, false));
  // a spare Zip-Zap on the bench, some bolts and a little antenna
  const zz = makeZipZap();
  zz.rotation.z = Math.PI / 2;
  zz.position.set(0.55, 0.92, 0.15);
  g.add(zz);
  g.userData.tip = zz.userData.tip;
  for (const [x, z, c] of [[0.2, 0.2, 0xffd23f], [0.32, 0.05, 0xff5d73], [0.05, 0.1, 0x3ddc97]]) g.add(mesh(cyl(0.05, 0.05, 0.05, 6), c, x, 0.9, z, false));
  g.add(mesh(cyl(0.015, 0.015, 0.5, 4), 0x2b2340, 0.6, 1.1, -0.3, false), mesh(sph(0.05, 6, 4), 0xff5d73, 0.6, 1.36, -0.3, false));
  return g;
}

/** The storage chest in the cottage. userData.lid opens (rotation.x). */
export function makeChest() {
  const g = new THREE.Group();
  g.add(mesh(box(0.9, 0.5, 0.6), WOOD, 0, 0.25, 0));
  for (const x of [-0.45, 0.45]) g.add(mesh(box(0.06, 0.52, 0.62), 0xb8862e, x, 0.26, 0, false));
  const lid = new THREE.Group();
  lid.position.set(0, 0.5, -0.3);
  const top = mesh(cyl(0.31, 0.31, 0.92, 12), 0xd99a5e, 0, 0.12, 0.3);
  top.rotation.z = Math.PI / 2;
  top.scale.set(0.45, 1, 1.03);
  lid.add(mesh(box(0.94, 0.12, 0.64), WOOD, 0, 0.06, 0.3), top, mesh(box(0.14, 0.18, 0.06), 0xffd23f, 0, 0.02, 0.63, false));
  g.add(lid);
  g.userData.lid = lid;
  return g;
}

export { cone };
