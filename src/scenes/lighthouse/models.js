import * as THREE from 'three';
import { COLORS, toon, sharedGeo, faceted } from '../../core/palette.js';
import { Character } from '../../core/character.js';

// Mesh factories for Lighthouse Caves: items, props, puzzle pieces and townsfolk.
// Everything is built from primitives with the shared toon materials (never mutated).

export const box = (w, h, d) => sharedGeo(`lh-box${w}|${h}|${d}`, () => new THREE.BoxGeometry(w, h, d));
export const cyl = (rt, rb, h, seg = 14) => sharedGeo(`lh-cyl${rt}|${rb}|${h}|${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg));
export const sph = (r, w = 14, h = 10) => sharedGeo(`lh-sph${r}|${w}|${h}`, () => new THREE.SphereGeometry(r, w, h));
export const cone = (r, h, seg = 12) => sharedGeo(`lh-cone${r}|${h}|${seg}`, () => new THREE.ConeGeometry(r, h, seg));
export const ico = (r, d = 0) => sharedGeo(`lh-ico${r}|${d}`, () => faceted(new THREE.IcosahedronGeometry(r, d)));
export const tor = (r, t, a = 8, b = 16) => sharedGeo(`lh-tor${r}|${t}|${a}|${b}`, () => new THREE.TorusGeometry(r, t, a, b));
export const oct = (r) => sharedGeo(`lh-oct${r}`, () => new THREE.OctahedronGeometry(r, 0));

export function mesh(geo, mat, x = 0, y = 0, z = 0, shadow = true) {
  const m = new THREE.Mesh(geo, typeof mat === 'number' ? toon(mat) : mat);
  m.position.set(x, y, z);
  m.castShadow = shadow;
  return m;
}

export const C = {
  wood: 0xb5835a, woodDark: 0x8a5a3a, gold: 0xffd23f, steel: 0xdfe6f5, stone: 0xbdb8cf, stoneDark: 0x8f89a8,
  red: 0xff5d73, blue: 0x4cc9f0, orange: 0xff9f2e, crystal: 0x8ff0ff, shell: 0xffb3c7, flame: 0xffa726, flameCore: 0xfff3a0,
};

// ---------- items ----------

export function makeSword() {
  const g = new THREE.Group();
  g.add(mesh(box(0.09, 0.05, 0.62), C.steel, 0, 0, 0.42));
  g.add(mesh(cone(0.055, 0.12, 4), C.steel, 0, 0, 0.79));
  g.children[1].rotation.x = Math.PI / 2;
  g.add(mesh(box(0.3, 0.07, 0.07), C.gold, 0, 0, 0.1));
  g.add(mesh(cyl(0.035, 0.035, 0.16, 8), C.woodDark, 0, 0, 0));
  g.children[3].rotation.x = Math.PI / 2;
  g.add(mesh(sph(0.05), C.gold, 0, 0, -0.09));
  return g;
}

export function makeHeart(color = C.red, s = 1) {
  const g = new THREE.Group();
  for (const sx of [-1, 1]) g.add(mesh(sph(0.15), color, sx * 0.1, 0.06, 0));
  const tip = mesh(cone(0.19, 0.28, 12), color, 0, -0.12, 0);
  tip.rotation.z = Math.PI;
  g.add(tip);
  g.scale.setScalar(s);
  return g;
}

export function makeHeartPiece() {
  const g = makeHeart(C.red, 1.1);
  g.add(mesh(box(0.02, 0.5, 0.32), COLORS.white, 0, 0, 0));
  g.add(mesh(box(0.5, 0.02, 0.32), COLORS.white, 0, 0.03, 0));
  return g;
}

export function makeShell(color = C.shell, s = 1) {
  const g = new THREE.Group();
  const body = mesh(sharedGeo('lh-shellFan', () => new THREE.SphereGeometry(0.2, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2)), color, 0, 0, 0);
  body.scale.set(1, 0.55, 0.8);
  g.add(body);
  for (let i = -2; i <= 2; i++) {
    const rib = mesh(box(0.025, 0.04, 0.2), 0xffffff, i * 0.065, 0.08, 0.02);
    rib.rotation.y = i * 0.25;
    g.add(rib);
  }
  g.add(mesh(box(0.12, 0.06, 0.06), color, 0, 0.02, -0.17));
  g.scale.setScalar(s);
  return g;
}

export function makeKey(color = C.gold, s = 1) {
  const g = new THREE.Group();
  const ring = mesh(tor(0.1, 0.035), color, 0, 0.18, 0);
  g.add(ring);
  g.add(mesh(box(0.06, 0.3, 0.06), color, 0, -0.04, 0));
  g.add(mesh(box(0.12, 0.05, 0.06), color, 0.05, -0.14, 0));
  g.add(mesh(box(0.09, 0.05, 0.06), color, 0.04, -0.04, 0));
  g.scale.setScalar(s);
  return g;
}

export function makeBigKey() {
  const g = makeKey(0xff7a2e, 1.5);
  g.add(mesh(sph(0.06), C.red, 0, 0.27, 0.05));
  return g;
}

export function makeLantern() {
  const g = new THREE.Group();
  g.add(mesh(cyl(0.14, 0.16, 0.06), C.woodDark, 0, -0.18, 0));
  g.add(mesh(cyl(0.12, 0.12, 0.26, 10), toon(0xfff1a8, { emissive: 0x996600 }), 0, 0, 0));
  g.add(mesh(cone(0.17, 0.12, 10), C.woodDark, 0, 0.19, 0));
  g.add(mesh(tor(0.07, 0.015), C.steel, 0, 0.3, 0));
  for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) g.add(mesh(box(0.025, 0.28, 0.025), C.woodDark, Math.cos(a) * 0.13, 0, Math.sin(a) * 0.13));
  return g;
}

export function makeRope() {
  const g = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const t = mesh(tor(0.16 - i * 0.02, 0.035), 0xd8b27a, 0, i * 0.05 - 0.05, 0);
    t.rotation.x = Math.PI / 2;
    g.add(t);
  }
  const hook = mesh(cone(0.06, 0.16, 6), C.steel, 0.16, 0.12, 0);
  hook.rotation.z = -0.6;
  g.add(hook);
  return g;
}

export function makeMapItem() {
  const g = new THREE.Group();
  g.add(mesh(box(0.42, 0.02, 0.32), 0xf6e2b8, 0, 0, 0));
  g.add(mesh(cyl(0.04, 0.04, 0.34, 8), 0xe8c48e, -0.22, 0, 0));
  g.add(mesh(cyl(0.04, 0.04, 0.34, 8), 0xe8c48e, 0.22, 0, 0));
  g.children[1].rotation.x = Math.PI / 2;
  g.children[2].rotation.x = Math.PI / 2;
  g.add(mesh(box(0.08, 0.025, 0.08), C.red, 0.05, 0.01, 0.03));
  g.rotation.x = 0.6;
  return g;
}

export function makeCompass() {
  const g = new THREE.Group();
  const b = mesh(cyl(0.18, 0.18, 0.06, 18), C.gold, 0, 0, 0);
  b.rotation.x = Math.PI / 2;
  g.add(b);
  const face = mesh(cyl(0.14, 0.14, 0.07, 18), COLORS.white, 0, 0, 0.005);
  face.rotation.x = Math.PI / 2;
  g.add(face);
  const n = mesh(cone(0.04, 0.2, 4), C.red, 0, 0.05, 0.05);
  g.add(n);
  return g;
}

export function makeCrystal(s = 1) {
  const g = new THREE.Group();
  const c = mesh(oct(0.26), toon(C.crystal, { emissive: 0x226677 }), 0, 0, 0);
  c.scale.set(0.8, 1.4, 0.8);
  g.add(c);
  g.scale.setScalar(s);
  return g;
}

export function makePotion() {
  const g = new THREE.Group();
  g.add(mesh(sph(0.16), toon(0x5ee0b0, { emissive: 0x114433 }), 0, 0, 0));
  g.add(mesh(cyl(0.06, 0.07, 0.12, 8), 0xe8f6ff, 0, 0.17, 0));
  g.add(mesh(cyl(0.07, 0.07, 0.05, 8), C.woodDark, 0, 0.25, 0));
  return g;
}

export function makeGlove() {
  const g = new THREE.Group();
  const palm = mesh(sph(0.2, 12, 10), 0xc9873f, 0, 0, 0);
  palm.scale.set(1, 1.1, 0.7);
  g.add(palm);
  for (let i = 0; i < 4; i++) g.add(mesh(cyl(0.045, 0.05, 0.18, 8), 0xc9873f, -0.11 + i * 0.075, 0.2, 0));
  const thumb = mesh(cyl(0.05, 0.055, 0.16, 8), 0xc9873f, -0.2, 0.02, 0);
  thumb.rotation.z = 0.9;
  g.add(thumb);
  g.add(mesh(cyl(0.2, 0.2, 0.1, 12), C.red, 0, -0.2, 0));
  g.add(mesh(sph(0.05), C.gold, 0, -0.2, 0.18));
  return g;
}

/** A round bomb with a short fuse (also the bomb bag item). */
export function makeBomb(s = 1) {
  const g = new THREE.Group();
  g.add(mesh(sph(0.27, 14, 10), 0x34406a, 0, 0.27, 0));
  g.add(mesh(sph(0.08, 8, 6), 0x8ea0d8, -0.1, 0.38, 0.17, false));
  g.add(mesh(cyl(0.08, 0.1, 0.08, 10), 0x5b5470, 0, 0.55, 0));
  const fuse = mesh(cyl(0.025, 0.025, 0.16, 6), 0xd8b27a, 0.03, 0.66, 0);
  fuse.rotation.z = -0.4;
  g.add(fuse);
  const spark = mesh(sph(0.07, 8, 6), toon(0xffd23f, { emissive: 0xcc6600 }), 0.07, 0.75, 0, false);
  g.add(spark);
  g.userData.spark = spark;
  g.userData.ball = g.children[0];
  g.scale.setScalar(s);
  return g;
}

export function makeBow() {
  const g = new THREE.Group();
  const arc = mesh(sharedGeo('lh-bowArc', () => new THREE.TorusGeometry(0.32, 0.035, 6, 18, Math.PI)), 0xb5835a, 0, 0, 0);
  arc.rotation.z = -Math.PI / 2;
  g.add(arc);
  g.add(mesh(box(0.012, 0.64, 0.012), COLORS.white, -0.02, 0, 0, false));
  g.add(mesh(box(0.08, 0.14, 0.08), C.red, 0.3, 0, 0));
  for (const y of [-0.3, 0.3]) g.add(mesh(sph(0.045), C.gold, 0.02, y, 0));
  return g;
}

/** An arrow pointing along +z (fire arrows get a flame on the tip). */
export function makeArrow() {
  const g = new THREE.Group();
  const shaft = mesh(cyl(0.025, 0.025, 0.7, 6), 0xd8b27a, 0, 0, 0, false);
  shaft.rotation.x = Math.PI / 2;
  g.add(shaft);
  const tip = mesh(cone(0.06, 0.16, 6), C.steel, 0, 0, 0.42, false);
  tip.rotation.x = Math.PI / 2;
  g.add(tip);
  for (const a of [0, Math.PI / 2]) {
    const f = mesh(box(0.14, 0.01, 0.16), 0xffffff, 0, 0, -0.3, false);
    f.rotation.z = a;
    g.add(f);
  }
  const flame = new THREE.Group();
  flame.position.z = 0.45;
  flame.add(mesh(sph(0.14, 8, 6), toon(C.flame, { emissive: 0xcc5500 }), 0, 0, 0, false));
  flame.add(mesh(sph(0.08, 8, 6), toon(C.flameCore, { emissive: 0xddaa00 }), 0, 0.03, 0.05, false));
  flame.visible = false;
  g.add(flame);
  g.userData.flame = flame;
  return g;
}

export function makeFins() {
  const g = new THREE.Group();
  for (const s of [-1, 1]) {
    const f = mesh(sharedGeo('lh-fin', () => new THREE.CylinderGeometry(0.2, 0.08, 0.05, 3)), 0x3ddc97, s * 0.14, 0, 0);
    f.rotation.y = Math.PI / 2;
    f.scale.set(1, 1, 1.6);
    g.add(f);
    g.add(mesh(box(0.1, 0.08, 0.12), 0x1f9e6e, s * 0.14, 0.04, 0.14));
  }
  return g;
}

export function makeGoldShell() {
  const g = makeShell(0xffd23f, 1.35);
  g.add(mesh(sph(0.07, 8, 6), toon(0xfff6c8, { emissive: 0xaa8800 }), 0, 0.12, 0, false));
  return g;
}

export function makeItem(item) {
  switch (item) {
    case 'glove': return makeGlove();
    case 'bombs': return makeBomb(0.9);
    case 'bow': return makeBow();
    case 'fins': return makeFins();
    case 'gshell': return makeGoldShell();
    case 'sword': return makeSword();
    case 'heart': return makeHeart(C.red, 0.8);
    case 'heartpiece': return makeHeartPiece();
    case 'container': { const g = makeHeart(C.red, 1.4); g.add(mesh(tor(0.32, 0.03), C.gold, 0, 0, 0)); return g; }
    case 'shell': return makeShell(C.shell, 0.9);
    case 'shell5': return makeShell(0x7fd8ff, 1.05);
    case 'shells20': case 'shells50': return makeShell(0xffd23f, 1.25);
    case 'key': return makeKey();
    case 'bigkey': return makeBigKey();
    case 'lantern': return makeLantern();
    case 'grapple': return makeRope();
    case 'map': return makeMapItem();
    case 'compass': return makeCompass();
    case 'crystal': return makeCrystal();
    case 'potion': return makePotion();
    default: return makeShell();
  }
}

// ---------- puzzle pieces and props ----------

export function makeBlock(theme) {
  const g = new THREE.Group();
  const col = theme === 'grotto' ? 0x7fb6c9 : 0xc9a27a;
  g.add(mesh(box(0.94, 0.86, 0.94), col, 0, 0.43, 0));
  g.add(mesh(box(0.7, 0.05, 0.7), theme === 'grotto' ? 0xa8d8e6 : 0xe0c098, 0, 0.88, 0));
  for (const [x, z] of [[-0.47, 0], [0.47, 0]]) g.add(mesh(box(0.02, 0.5, 0.5), 0x6b4a3a, x, 0.43, z, false));
  return g;
}

export function makePot() {
  const g = new THREE.Group();
  const body = mesh(sph(0.36, 14, 10), 0xd9805a, 0, 0.34, 0);
  body.scale.set(1, 0.95, 1);
  g.add(body);
  g.add(mesh(cyl(0.2, 0.24, 0.14, 12), 0xb8603e, 0, 0.7, 0));
  g.add(mesh(tor(0.33, 0.035), 0xfff3dc, 0, 0.38, 0));
  g.children[2].rotation.x = Math.PI / 2;
  return g;
}

/** A heavy boulder (the Strong Gloves lift it). */
export function makeBoulder() {
  const g = new THREE.Group();
  g.add(mesh(ico(0.5, 1), COLORS.rockDark, 0, 0.42, 0));
  g.children[0].scale.set(1.1, 0.85, 1.05);
  g.add(mesh(ico(0.24, 0), COLORS.rock, -0.18, 0.75, 0.18));
  g.add(mesh(ico(0.16, 0), 0x8f89a8, 0.24, 0.62, 0.22));
  return g;
}

const CRACK_COLORS = { over: C.stone, cliff: 0xa9a3b8, cave: 0x7d6a5a, ruins: 0x8f9aa0, cellar: 0x9a8db5, grotto: 0x7fb6c9, tower: C.stone, house: C.stone };

/** A cracked rock or cracked block (a bomb breaks it). */
export function makeCracked(theme = 'over') {
  const g = new THREE.Group();
  const col = CRACK_COLORS[theme] || C.stone;
  g.add(mesh(box(0.96, 0.95, 0.96), col, 0, 0.47, 0));
  g.add(mesh(box(1.0, 0.08, 1.0), new THREE.Color(col).multiplyScalar(1.12).getHex(), 0, 0.96, 0));
  const ink = 0x2b2340;
  const crack = (x, y, rz, l) => { const m = mesh(box(0.06, l, 0.03), ink, x, y, 0.49, false); m.rotation.z = rz; g.add(m); };
  crack(-0.1, 0.52, 0.5, 0.55); crack(0.14, 0.58, -0.6, 0.4); crack(0.04, 0.32, 0.2, 0.3); crack(-0.26, 0.7, -0.3, 0.25);
  return g;
}

/** A stone eye set into a wall: shut until an arrow hits its middle. */
export function makeEye() {
  const g = new THREE.Group();
  g.add(mesh(cyl(0.38, 0.4, 0.14, 16), 0x6d6084, 0, 0, 0));
  g.children[0].rotation.x = Math.PI / 2;
  const white = mesh(sph(0.27, 14, 10), 0xfff6e0, 0, 0, 0.06, false);
  white.scale.set(1, 0.8, 0.45);
  g.add(white);
  const pupil = mesh(sph(0.12, 10, 8), toon(0xffd23f, { emissive: 0x996600 }), 0, 0, 0.16, false);
  g.add(pupil);
  const lid = mesh(sph(0.3, 14, 10), 0x8f89a8, 0, 0, 0.05, false);
  lid.scale.set(1, 0.85, 0.55);
  g.add(lid);
  g.userData.lid = lid;
  g.userData.pupil = pupil;
  return g;
}

export function makeLiftRock() {
  const g = new THREE.Group();
  const m = mesh(ico(0.4, 0), COLORS.rockDark, 0, 0.32, 0);
  m.scale.set(1, 0.8, 1);
  g.add(m);
  return g;
}

export function makeChest(big = false) {
  const g = new THREE.Group();
  const s = big ? 1.15 : 0.85;
  const base = new THREE.Group();
  base.add(mesh(box(0.9, 0.5, 0.65), big ? 0x8a4fd6 : C.wood, 0, 0.25, 0));
  base.add(mesh(box(0.94, 0.08, 0.69), C.gold, 0, 0.47, 0));
  base.add(mesh(box(0.14, 0.18, 0.04), C.gold, 0, 0.32, 0.34));
  g.add(base);
  const lid = new THREE.Group();
  lid.position.set(0, 0.5, -0.32);
  const top = mesh(sharedGeo('lh-lid', () => new THREE.CylinderGeometry(0.33, 0.33, 0.9, 12, 1, false, 0, Math.PI)), big ? 0x9b63e8 : C.woodDark, 0, 0, 0.32);
  top.rotation.z = Math.PI / 2;
  top.scale.set(0.6, 1, 1);
  lid.add(top);
  lid.add(mesh(box(0.08, 0.2, 0.68), C.gold, 0, 0.08, 0.32));
  g.add(lid);
  g.scale.setScalar(s);
  g.userData.lid = lid;
  return g;
}

export function makeSign() {
  const g = new THREE.Group();
  g.add(mesh(box(0.1, 0.6, 0.1), C.woodDark, 0, 0.3, 0));
  g.add(mesh(box(0.8, 0.5, 0.08), 0xe8c48e, 0, 0.75, 0));
  g.add(mesh(box(0.6, 0.05, 0.02), 0x8a5a3a, 0, 0.82, 0.05, false));
  g.add(mesh(box(0.5, 0.05, 0.02), 0x8a5a3a, 0, 0.7, 0.05, false));
  return g;
}

/** Beacon stone: the save point (a little lighthouse statue with a warm light). */
export function makeSaveStone() {
  const g = new THREE.Group();
  g.add(mesh(cyl(0.42, 0.48, 0.2, 10), C.stoneDark, 0, 0.1, 0));
  g.add(mesh(cyl(0.22, 0.32, 0.8, 10), COLORS.white, 0, 0.6, 0));
  g.add(mesh(cyl(0.235, 0.27, 0.16, 10), C.red, 0, 0.45, 0));
  g.add(mesh(cyl(0.21, 0.225, 0.14, 10), C.red, 0, 0.8, 0));
  const lamp = mesh(sph(0.17), toon(0xffe27a, { emissive: 0xaa7700 }), 0, 1.13, 0);
  g.add(lamp);
  g.add(mesh(cone(0.24, 0.2, 10), C.red, 0, 1.36, 0));
  g.userData.lamp = lamp;
  return g;
}

export function makeTorch() {
  const g = new THREE.Group();
  g.add(mesh(cyl(0.22, 0.3, 0.6, 8), C.stoneDark, 0, 0.3, 0));
  g.add(mesh(cyl(0.34, 0.24, 0.2, 10), 0x5b5470, 0, 0.7, 0));
  const flame = new THREE.Group();
  flame.position.y = 0.95;
  flame.add(mesh(sph(0.26, 10, 8), toon(C.flame, { emissive: 0xcc5500 }), 0, 0.02, 0, false));
  flame.add(mesh(cone(0.24, 0.7, 8), toon(C.flame, { emissive: 0xcc5500 }), 0, 0.3, 0, false));
  flame.add(mesh(sph(0.15, 8, 6), toon(C.flameCore, { emissive: 0xddaa00 }), 0, 0.05, 0.12, false));
  flame.add(mesh(cone(0.12, 0.4, 8), toon(C.flameCore, { emissive: 0xddaa00 }), 0, 0.22, 0.1, false));
  flame.visible = false;
  g.add(flame);
  g.userData.flame = flame;
  return g;
}

export function makeSwitch() {
  const g = new THREE.Group();
  g.add(mesh(cyl(0.3, 0.38, 0.3, 10), C.stoneDark, 0, 0.15, 0));
  const orbO = mesh(sph(0.3), toon(C.orange, { emissive: 0x663300 }), 0, 0.62, 0);
  const orbB = mesh(sph(0.3), toon(C.blue, { emissive: 0x113355 }), 0, 0.62, 0);
  g.add(orbO, orbB);
  g.userData.orbs = [orbO, orbB];
  return g;
}

export function makePeg(ch) {
  const g = new THREE.Group();
  const col = ch === 'x' ? C.orange : C.blue;
  const top = mesh(box(0.9, 0.7, 0.9), col, 0, 0.35, 0);
  g.add(top);
  g.add(mesh(box(0.6, 0.04, 0.6), ch === 'x' ? 0xffc27a : 0x9fe4ff, 0, 0.72, 0));
  g.userData.top = top;
  return g;
}

export function makePlate() {
  const g = new THREE.Group();
  g.add(mesh(box(0.86, 0.06, 0.86), 0x6b6480, 0, 0.03, 0, false));
  const top = mesh(box(0.66, 0.08, 0.66), 0xffd23f, 0, 0.08, 0, false);
  g.add(top);
  g.userData.top = top;
  return g;
}

export function makeBush(thorn = false) {
  const g = new THREE.Group();
  if (thorn) {
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const b = mesh(ico(0.28, 0), 0x6d4a7a, Math.cos(a) * 0.2, 0.3, Math.sin(a) * 0.2);
      g.add(b);
    }
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const sp = mesh(cone(0.06, 0.32, 5), 0xd2c0ff, Math.cos(a) * 0.36, 0.35 + (i % 2) * 0.15, Math.sin(a) * 0.36);
      sp.rotation.z = -Math.cos(a) * 1.2;
      sp.rotation.x = Math.sin(a) * 1.2;
      g.add(sp);
    }
  } else {
    g.add(mesh(ico(0.42, 1), COLORS.leaf, 0, 0.36, 0));
    g.add(mesh(ico(0.26, 1), COLORS.leafLight, 0.18, 0.55, 0.12));
    g.add(mesh(ico(0.22, 1), COLORS.leafLight, -0.2, 0.48, -0.1));
  }
  return g;
}

export function makeGrass() {
  const g = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const b = mesh(cone(0.08, 0.42, 4), i % 2 ? COLORS.grassDark : 0x4fae3e, Math.cos(a) * 0.16, 0.2, Math.sin(a) * 0.16, false);
    b.rotation.z = Math.cos(a) * 0.3;
    b.rotation.x = -Math.sin(a) * 0.3;
    g.add(b);
  }
  return g;
}

export function makeGate() {
  const g = new THREE.Group();
  for (let i = -1; i <= 1; i++) g.add(mesh(box(0.12, 1.1, 0.12), 0x5b5470, i * 0.3, 0.55, 0));
  g.add(mesh(box(0.9, 0.1, 0.16), 0x5b5470, 0, 1.0, 0));
  return g;
}

/** A dungeon door leaf: 'key' (wooden with a lock), 'boss' (big, gold), 'shut' (bars). */
export function makeDoorLeaf(type, theme) {
  const g = new THREE.Group();
  if (type === 'key') {
    g.add(mesh(box(1.0, 1.05, 0.25), C.woodDark, 0, 0.52, 0));
    g.add(mesh(box(0.34, 0.36, 0.1), C.gold, 0, 0.55, 0.14));
    g.add(mesh(box(0.08, 0.16, 0.04), COLORS.ink, 0, 0.53, 0.2));
  } else if (type === 'bomb') {
    const col = CRACK_COLORS[theme] || C.stone;
    g.add(mesh(box(1.0, 1.2, 0.5), col, 0, 0.6, 0));
    const crack = (x, y, rz, l) => { const m = mesh(box(0.06, l, 0.03), 0x2b2340, x, y, 0.26, false); m.rotation.z = rz; g.add(m); };
    crack(-0.12, 0.6, 0.5, 0.6); crack(0.15, 0.7, -0.6, 0.45); crack(0.02, 0.35, 0.2, 0.35);
  } else if (type === 'boss') {
    g.add(mesh(box(1.0, 1.15, 0.28), 0x6a3fa0, 0, 0.57, 0));
    g.add(mesh(box(0.5, 0.5, 0.12), 0xff7a2e, 0, 0.6, 0.15));
    g.add(mesh(sph(0.1), C.red, 0, 0.62, 0.22));
  } else {
    for (let i = -1; i <= 1; i++) g.add(mesh(box(0.14, 1.05, 0.14), theme === 'grotto' ? 0x2c6f82 : 0x4a4560, i * 0.3, 0.52, 0));
    g.add(mesh(box(1.0, 0.12, 0.18), theme === 'grotto' ? 0x2c6f82 : 0x4a4560, 0, 0.75, 0));
  }
  return g;
}

// ---------- people ----------

const NPC_LOOKS = {
  keeper: { color: 0x9aa7c7, hat: 0, beard: true, scale: 0.68 },
  olga: { color: 0xc9a8ff, hat: 2, scale: 0.6 },
  tobi: { color: 0xffc93c, hat: 4, scale: 0.5 },
  mira: { color: 0x3ddc97, hat: 1, scale: 0.62 },
  pell: { color: 0xff8c42, hat: 5, scale: 0.64 },
};

/** Animal townsfolk (Mitten the cat, Sela the seal) and Murky: same little API as Character. */
class Critter {
  constructor(id) {
    this.group = new THREE.Group();
    this.pivot = new THREE.Group();
    this.group.add(this.pivot);
    this.yaw = 0;
    this.targetYaw = 0;
    this.t = Math.random() * 6;
    this.id = id;
    this.spin = 0;
    const P = this.pivot;
    if (id === 'mitten') {
      const fur = 0xff9f2e, light = 0xffe0b0;
      const body = mesh(sph(0.26, 12, 10), fur, 0, 0.24, -0.05);
      body.scale.set(0.9, 0.8, 1.2);
      P.add(body);
      P.add(mesh(sph(0.2, 12, 10), fur, 0, 0.5, 0.2));
      P.add(mesh(sph(0.1, 8, 6), light, 0, 0.44, 0.36));
      for (const s of [-1, 1]) {
        const ear = mesh(cone(0.07, 0.14, 4), fur, s * 0.11, 0.68, 0.18);
        ear.rotation.z = -s * 0.25;
        P.add(ear);
        P.add(mesh(sph(0.04, 6, 5), COLORS.ink, s * 0.08, 0.53, 0.37, false));
      }
      this.tail = mesh(cyl(0.035, 0.05, 0.42, 6), fur, 0, 0.36, -0.36);
      this.tail.rotation.x = -0.7;
      P.add(this.tail);
      this.scale = 0.95;
    } else if (id === 'sela') {
      const skin = 0x8fa3b8;
      const body = mesh(sph(0.36, 14, 10), skin, 0, 0.3, -0.05);
      body.scale.set(0.9, 0.8, 1.35);
      P.add(body);
      P.add(mesh(sph(0.26, 12, 10), skin, 0, 0.62, 0.22));
      P.add(mesh(sph(0.1, 8, 6), 0xc9d6e3, 0, 0.56, 0.44));
      P.add(mesh(sph(0.05, 6, 5), COLORS.ink, 0, 0.6, 0.53, false));
      for (const s of [-1, 1]) {
        P.add(mesh(sph(0.045, 6, 5), COLORS.ink, s * 0.1, 0.72, 0.42, false));
        const flip = mesh(box(0.28, 0.05, 0.14), 0x7a8ea3, s * 0.32, 0.12, 0.12);
        flip.rotation.z = s * 0.4;
        P.add(flip);
      }
      this.scale = 1;
    } else {
      // Murky: a small soft gloom puff with big kind eyes
      const puff = 0x5a4d7a;
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        P.add(mesh(sph(0.16, 10, 8), puff, Math.cos(a) * 0.17, 0.42 + Math.sin(a * 2) * 0.04, Math.sin(a) * 0.12));
      }
      P.add(mesh(sph(0.24, 12, 10), 0x6b5d8f, 0, 0.45, 0.05));
      for (const s of [-1, 1]) {
        P.add(mesh(sph(0.07, 8, 6), 0xfff6c8, s * 0.09, 0.5, 0.24, false));
        P.add(mesh(sph(0.035, 6, 5), COLORS.ink, s * 0.09, 0.5, 0.3, false));
      }
      this.float = true;
      this.scale = 1;
    }
    this.group.scale.setScalar(this.scale);
  }

  face(dx, dz) { if (dx || dz) this.targetYaw = Math.atan2(dx, dz); }

  update(dt, { moving = 0 } = {}) {
    this.t += dt;
    let d = this.targetYaw - this.yaw;
    d = ((d + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    this.yaw += d * Math.min(1, dt * 10);
    this.pivot.rotation.y = this.yaw + this.spin;
    if (this.tail) this.tail.rotation.z = Math.sin(this.t * 3) * 0.5;
    if (this.float) this.pivot.position.y = 0.15 + Math.sin(this.t * 2.5) * 0.08;
    else this.pivot.position.y = moving ? Math.abs(Math.sin(this.t * 14)) * 0.08 : Math.sin(this.t * 2) * 0.01;
    this.pivot.scale.y = 1 + Math.sin(this.t * 2.2) * 0.03;
  }
}

export function makeNpc(id) {
  if (id === 'mitten' || id === 'sela' || id === 'murky') return new Critter(id);
  const look = NPC_LOOKS[id] || NPC_LOOKS.mira;
  const ch = new Character(look.color, { hat: look.hat });
  ch.group.scale.setScalar(look.scale);
  if (look.beard) {
    const beard = mesh(sph(0.26), COLORS.white, 0, 0.55, 0.28);
    beard.scale.set(1.1, 0.9, 0.6);
    ch.pivot.add(beard);
    const brows = mesh(box(0.4, 0.06, 0.06), COLORS.white, 0, 0.98, 0.34);
    ch.pivot.add(brows);
  }
  if (id === 'pell') {
    const rod = mesh(cyl(0.025, 0.025, 1.6, 6), C.woodDark, 0.45, 0.9, 0.2);
    rod.rotation.z = -0.5;
    ch.pivot.add(rod);
  }
  return ch;
}

export function makeDecor(kind) {
  const g = new THREE.Group();
  if (kind === 'bed') {
    g.add(mesh(box(0.9, 0.35, 1.0), C.wood, 0, 0.18, 0));
    g.add(mesh(box(0.86, 0.12, 0.96), 0xfff3dc, 0, 0.4, 0));
    g.add(mesh(box(0.86, 0.14, 0.6), 0x4c8bd6, 0, 0.45, 0.18));
    g.add(mesh(box(0.5, 0.14, 0.24), COLORS.white, 0, 0.5, -0.3));
  } else if (kind === 'table') {
    g.add(mesh(cyl(0.42, 0.42, 0.08, 14), C.wood, 0, 0.55, 0));
    g.add(mesh(cyl(0.07, 0.1, 0.55, 8), C.woodDark, 0, 0.27, 0));
    g.add(mesh(cyl(0.08, 0.06, 0.16, 8), 0xffffff, 0.12, 0.66, 0.05));
  }
  return g;
}

/** The great lamp in the lighthouse: three crystal sockets. */
export function makeLamp() {
  const g = new THREE.Group();
  g.add(mesh(cyl(0.5, 0.6, 0.4, 12), C.stoneDark, 0, 0.2, 0));
  g.add(mesh(cyl(0.32, 0.4, 0.5, 12), C.gold, 0, 0.65, 0));
  g.add(mesh(cyl(0.55, 0.45, 0.12, 14), C.gold, 0, 0.95, 0));
  const glow = mesh(sph(0.3), toon(0xfff1a8, { emissive: 0x332200 }), 0, 1.25, 0);
  g.add(glow);
  const sockets = [];
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + Math.PI / 2;
    const s = makeCrystal(0.6);
    s.position.set(Math.cos(a) * 0.42, 1.2, Math.sin(a) * 0.42);
    s.visible = false;
    g.add(s);
    sockets.push(s);
  }
  g.userData.sockets = sockets;
  g.userData.glow = glow;
  return g;
}

export function makeShopItem(item) {
  const g = new THREE.Group();
  g.add(mesh(box(0.86, 0.5, 0.7), 0xe8c48e, 0, 0.25, 0));
  g.add(mesh(box(0.92, 0.06, 0.76), C.woodDark, 0, 0.52, 0));
  const it = makeItem(item);
  it.position.y = 0.85;
  g.add(it);
  g.userData.item = it;
  return g;
}
