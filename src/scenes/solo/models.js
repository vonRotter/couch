import * as THREE from 'three';
import { COLORS, toon, basic, sharedGeo, faceted } from '../../core/palette.js';
import { makeGrumble } from '../../core/critters.js';
import { makeGameIcon } from '../hub-icons.js';
import { CROPS } from './items.js';

// Toon models for the solo island, all built from primitives with the shared toon() materials.
// M is the scene's night material set ({ win, lamp, screen }) so windows and lamps can glow after dark.

export const box = (w, h, d) => sharedGeo(`isl-box${w}|${h}|${d}`, () => new THREE.BoxGeometry(w, h, d));
export const cyl = (rt, rb, h, seg = 14) => sharedGeo(`isl-cyl${rt}|${rb}|${h}|${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg));
export const sph = (r, w = 14, h = 10) => sharedGeo(`isl-sph${r}|${w}|${h}`, () => new THREE.SphereGeometry(r, w, h));
export const cone = (r, h, seg = 12) => sharedGeo(`isl-cone${r}|${h}|${seg}`, () => new THREE.ConeGeometry(r, h, seg));
export const ico = (r, d = 0) => sharedGeo(`isl-ico${r}|${d}`, () => faceted(new THREE.IcosahedronGeometry(r, d)));
const tor = (r, t, a = Math.PI * 2) => sharedGeo(`isl-tor${r}|${t}|${a}`, () => new THREE.TorusGeometry(r, t, 8, 20, a));

export function mesh(geo, mat, x = 0, y = 0, z = 0, shadow = true) {
  const m = new THREE.Mesh(geo, typeof mat === 'number' ? toon(mat) : mat);
  m.position.set(x, y, z);
  m.castShadow = shadow;
  m.receiveShadow = true;
  return m;
}

export const WOOD = 0xc68a52;
export const WOOD_DARK = 0x8a5a32;
const STONE = 0xc9c3d6;
const STONE_DARK = 0x9a94b2;

/** A triangular roof prism: ridge along x, slopes facing front and back. */
function roofGeo(w, d, h) {
  return sharedGeo(`isl-roof${w}|${d}|${h}`, () => {
    const s = new THREE.Shape();
    s.moveTo(-d / 2, 0);
    s.lineTo(d / 2, 0);
    s.lineTo(0, h);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: w, bevelEnabled: false });
    g.translate(0, 0, -w / 2);
    g.rotateY(Math.PI / 2);
    return faceted(g);
  });
}

function windowAt(M, x, y, z, w = 0.7, h = 0.7, rotY = 0) {
  const g = new THREE.Group();
  g.add(mesh(box(w + 0.16, h + 0.16, 0.08), 0xffffff, 0, 0, 0, false));
  g.add(mesh(box(w, h, 0.1), M.win, 0, 0, 0.02, false));
  g.add(mesh(box(0.06, h, 0.12), 0xffffff, 0, 0, 0.04, false));
  g.add(mesh(box(w, 0.06, 0.12), 0xffffff, 0, 0, 0.04, false));
  g.position.set(x, y, z);
  g.rotation.y = rotY;
  return g;
}

function flowerBox(x, y, z, w = 0.8) {
  const g = new THREE.Group();
  g.add(mesh(box(w, 0.18, 0.22), WOOD_DARK, 0, 0, 0));
  const cols = [0xff7eb6, 0xffd23f, 0xffffff, 0xb08bff];
  for (let i = 0; i < 4; i++) g.add(mesh(sph(0.08, 8, 6), cols[i], -w / 2 + 0.12 + i * (w - 0.24) / 3, 0.14, 0, false));
  g.position.set(x, y, z);
  return g;
}

/**
 * A cozy cottage, door facing +z. opts: wall, roof, trim, w, d, h, chimney, windows.
 * userData.door is the local spot in front of the door.
 */
export function makeCottage(M, { wall = 0xfff3dc, roof = 0xff7a59, trim = WOOD, w = 5, d = 4, h = 2.4, chimney = true, door = 0x9a6440, porch = true } = {}) {
  const g = new THREE.Group();
  g.add(mesh(box(w + 0.3, 0.35, d + 0.3), STONE_DARK, 0, 0.17, 0));
  g.add(mesh(box(w, h, d), wall, 0, 0.35 + h / 2, 0));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(mesh(box(0.22, h, 0.22), trim, sx * (w / 2 - 0.05), 0.35 + h / 2, sz * (d / 2 - 0.05)));
  g.add(mesh(box(w + 0.1, 0.18, d + 0.1), trim, 0, 0.35 + h, 0));
  const rh = Math.min(2.4, d * 0.55);
  const r = mesh(roofGeo(w + 0.7, d + 0.9, rh), roof, 0, 0.35 + h + 0.05, 0);
  g.add(r);
  g.add(mesh(box(w + 0.8, 0.14, 0.2), 0xffffff, 0, 0.35 + h + rh + 0.02, 0, false));
  if (chimney) {
    g.add(mesh(box(0.6, 1.6, 0.6), 0xb0675a, w * 0.28, 0.35 + h + rh * 0.6, -d * 0.12));
    g.add(mesh(box(0.72, 0.16, 0.72), STONE_DARK, w * 0.28, 0.35 + h + rh * 0.6 + 0.85, -d * 0.12));
    g.userData.chimney = new THREE.Vector3(w * 0.28, 0.35 + h + rh * 0.6 + 1.1, -d * 0.12);
  }
  // door with a little awning
  const dz = d / 2 + 0.03;
  g.add(mesh(box(0.95, 1.6, 0.1), door, 0, 0.35 + 0.8, dz));
  g.add(mesh(sph(0.06, 8, 6), COLORS.gold, 0.3, 1.1, dz + 0.07, false));
  g.add(mesh(box(1.3, 0.1, 0.6), roof, 0, 2.15, dz + 0.25));
  g.add(windowAt(M, -w * 0.3, 0.35 + h * 0.55, dz));
  g.add(windowAt(M, w * 0.3, 0.35 + h * 0.55, dz));
  g.add(flowerBox(-w * 0.3, 0.35 + h * 0.55 - 0.5, dz + 0.12));
  g.add(flowerBox(w * 0.3, 0.35 + h * 0.55 - 0.5, dz + 0.12));
  for (const sx of [-1, 1]) g.add(windowAt(M, sx * (w / 2 + 0.03), 0.35 + h * 0.55, 0, 0.6, 0.6, sx * Math.PI / 2));
  if (porch) {
    g.add(mesh(box(1.6, 0.12, 0.9), WOOD, 0, 0.06, dz + 0.5));
  }
  g.userData.door = new THREE.Vector3(0, 0, d / 2 + 1.1);
  return g;
}

/** The general store: a wide cottage with a striped awning, crates of produce and a seed-bag sign. */
export function makeStore(M) {
  const g = makeCottage(M, { wall: 0xfff1d6, roof: 0x4cc9f0, w: 7, d: 4.6, h: 2.6, trim: WOOD_DARK });
  const dz = 2.6;
  for (let i = 0; i < 8; i++) {
    const s = mesh(box(0.9, 0.08, 1.2), i % 2 ? 0xffffff : 0xff5d73, -3.15 + i * 0.9, 2.55, dz + 0.45);
    s.rotation.x = 0.35;
    g.add(s);
  }
  for (const sx of [-3.2, 3.2]) g.add(mesh(cyl(0.06, 0.06, 2.4, 6), WOOD_DARK, sx, 1.2, dz + 1.0));
  // produce crates under the awning
  const prod = [0xff4f6d, 0xff8c2a, 0x9be05a, 0xffd23f];
  for (let i = 0; i < 4; i++) {
    const x = (i < 2 ? -2.6 : 1.6) + (i % 2) * 1.0;
    g.add(mesh(box(0.85, 0.5, 0.6), WOOD, x, 0.25, dz + 0.7));
    for (let k = 0; k < 4; k++) g.add(mesh(sph(0.13, 8, 6), prod[i], x - 0.25 + (k % 2) * 0.5, 0.55, dz + 0.55 + Math.floor(k / 2) * 0.28, false));
  }
  // sign: a big seed bag
  const sign = new THREE.Group();
  sign.add(mesh(box(1.8, 0.9, 0.12), 0xfff3dc, 0, 0, 0));
  sign.add(mesh(box(1.9, 0.12, 0.16), WOOD_DARK, 0, 0.5, 0));
  sign.add(mesh(box(0.55, 0.65, 0.1), 0xe2b06a, 0, -0.02, 0.08, false));
  sign.add(mesh(sph(0.14, 8, 6), 0x58b947, 0, 0.05, 0.14, false));
  sign.position.set(0, 3.6, dz + 0.2);
  g.add(sign);
  return g;
}

/** The striped lighthouse on its rocks; userData.beam rotates. */
export function makeLighthouse(M) {
  const g = new THREE.Group();
  g.add(mesh(cyl(3.2, 3.8, 1.0, 10), STONE_DARK, 0, 0.3, 0));
  for (let i = 0; i < 6; i++) g.add(mesh(cyl(1.9 - i * 0.16, 2.05 - i * 0.16, 1.6, 22), i % 2 ? COLORS.white : 0xff5d73, 0, 1.6 + i * 1.6, 0));
  g.add(mesh(cyl(1.6, 1.6, 0.18, 22), COLORS.ink, 0, 10.4, 0));
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    g.add(mesh(cyl(0.04, 0.04, 0.6, 4), COLORS.ink, Math.cos(a) * 1.5, 10.75, Math.sin(a) * 1.5, false));
  }
  g.add(mesh(tor(1.5, 0.05), COLORS.ink, 0, 11.05, 0).rotateX(Math.PI / 2));
  g.add(mesh(cyl(0.95, 0.95, 1.3, 16), M.lamp, 0, 11.1, 0));
  g.add(mesh(cone(1.3, 1.3, 16), 0xff5d73, 0, 12.4, 0));
  g.add(mesh(sph(0.2), COLORS.gold, 0, 13.1, 0));
  // door and little windows
  g.add(mesh(box(1.0, 1.7, 0.2), 0x8a5a3a, 0, 1.65, 1.95));
  g.add(mesh(box(1.25, 0.15, 0.3), COLORS.ink, 0, 2.6, 1.95));
  for (const [y, a] of [[4.6, 0.4], [7.4, -0.5]]) {
    const w = windowAt(M, Math.sin(a) * 1.72, y, Math.cos(a) * 1.72, 0.45, 0.6, a);
    g.add(w);
  }
  const beam = mesh(sharedGeo('isl-beam', () => new THREE.ConeGeometry(1.0, 9, 14, 1, true)), M.beam, 4.6, 0, 0, false);
  beam.rotation.z = Math.PI / 2;
  const pivot = new THREE.Group();
  pivot.position.y = 11.1;
  pivot.add(beam);
  g.add(pivot);
  g.userData.beam = pivot;
  return g;
}

/** Laser Ducks: a red-and-white fairground tent with a duck rail, counter and bunting. */
export function makeTent(M) {
  const g = new THREE.Group();
  const n = 12;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    if (Math.abs(Math.sin(a / 2 - Math.PI / 2)) < 0.25) continue; // open front
    const p = mesh(box(1.25, 2.8, 0.1), i % 2 ? 0xffffff : 0xff5d73, Math.sin(a) * 2.6, 1.4, Math.cos(a) * 2.6);
    p.rotation.y = a;
    g.add(p);
  }
  const roof = new THREE.Group();
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const seg = mesh(sharedGeo('isl-tentseg', () => new THREE.ConeGeometry(3.2, 2.2, 3, 1, true, 0, Math.PI / 6 + 0.02)), i % 2 ? 0xffffff : 0xff5d73, 0, 0, 0);
    seg.rotation.y = a;
    roof.add(seg);
  }
  roof.position.y = 3.9;
  g.add(roof);
  g.add(mesh(sph(0.22), COLORS.gold, 0, 5.1, 0));
  g.add(mesh(cyl(0.03, 0.03, 1.2, 4), WOOD_DARK, 0, 5.6, 0));
  const flag = mesh(box(0.6, 0.35, 0.03), 0x00d4e6, 0.3, 6.0, 0);
  g.add(flag);
  // counter and the duck rail at the back
  g.add(mesh(box(4.0, 0.9, 0.5), 0x00a3b8, 0, 0.45, 2.4));
  g.add(mesh(box(4.2, 0.12, 0.7), 0xffffff, 0, 0.95, 2.4));
  g.add(mesh(box(4.0, 0.12, 0.3), WOOD_DARK, 0, 1.4, -1.6));
  const ducks = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const d = new THREE.Group();
    d.add(mesh(sph(0.22, 10, 8), 0xffd23f, 0, 0.2, 0));
    d.add(mesh(sph(0.14, 10, 8), 0xffd23f, 0.12, 0.42, 0));
    d.add(mesh(cone(0.06, 0.16, 6), 0xff8c42, 0.28, 0.42, 0).rotateZ(-Math.PI / 2));
    d.position.set(-1.6 + i * 0.8, 1.45, -1.6);
    ducks.add(d);
  }
  g.add(ducks);
  g.userData.ducks = ducks;
  // a laser blaster on the counter (just a toy)
  g.add(mesh(box(0.5, 0.18, 0.18), 0x9b5de5, 0.9, 1.1, 2.4));
  g.add(mesh(cyl(0.05, 0.05, 0.3, 6), 0x3ddc97, 1.25, 1.12, 2.4).rotateZ(Math.PI / 2));
  // bulbs around the opening
  for (let i = 0; i < 7; i++) g.add(mesh(sph(0.09, 8, 6), M.lamp, -1.8 + i * 0.6, 2.85, 2.55, false));
  g.userData.door = new THREE.Vector3(0, 0, 3.6);
  return g;
}

/** Sky Hop: a striped hot-air balloon tethered on kite hill. userData.balloon bobs. */
export function makeBalloon() {
  const g = new THREE.Group();
  // basket
  g.add(mesh(cyl(0.75, 0.6, 0.9, 10), 0xc68a52, 0, 0.45, 0));
  g.add(mesh(tor(0.75, 0.07), WOOD_DARK, 0, 0.9, 0).rotateX(Math.PI / 2));
  const up = new THREE.Group();
  const cols = [0xff5d73, 0xffc93c, 0x4cc9f0, 0x3ddc97, 0x9b5de5, 0xff8c42];
  for (let i = 0; i < 12; i++) {
    const seg = mesh(sharedGeo('isl-balseg', () => {
      const geo = new THREE.SphereGeometry(2.0, 4, 14, 0, Math.PI / 6 + 0.01);
      return geo;
    }), cols[i % 6], 0, 0, 0);
    seg.rotation.y = (i / 12) * Math.PI * 2;
    up.add(seg);
  }
  up.scale.set(1, 1.15, 1);
  up.position.y = 4.4;
  up.add(mesh(cyl(0.6, 0.4, 0.5, 10), 0xff5d73, 0, -2.25, 0));
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.78;
    const r = mesh(cyl(0.02, 0.02, 1.7, 4), 0xe8d5a8, Math.cos(a) * 0.62, -2.9, Math.sin(a) * 0.62, false);
    up.add(r);
  }
  g.add(up);
  g.userData.balloon = up;
  // a tether rope and peg
  g.add(mesh(cyl(0.03, 0.03, 1.6, 4), 0xe8d5a8, 1.0, 0.5, 0.4, false).rotateZ(0.9));
  g.add(mesh(cyl(0.08, 0.08, 0.4, 6), WOOD_DARK, 1.6, 0.2, 0.4));
  g.userData.door = new THREE.Vector3(0, 0, 1.8);
  return g;
}

/** A timber mine entrance set into the cliff, with rails coming out. */
export function makeMine() {
  const g = new THREE.Group();
  g.add(mesh(box(3.6, 3.4, 1.4), 0x241b33, 0, 1.7, -0.4, false));
  for (const sx of [-1, 1]) g.add(mesh(box(0.4, 3.6, 0.5), WOOD_DARK, sx * 1.9, 1.8, 0.2));
  g.add(mesh(box(4.6, 0.5, 0.6), WOOD_DARK, 0, 3.65, 0.2));
  g.add(mesh(box(1.4, 0.5, 0.1), 0xfff3dc, 0, 4.2, 0.45));
  g.add(mesh(sharedGeo('isl-crys', () => new THREE.OctahedronGeometry(0.22, 0)), toon(0x8ff0ff, { emissive: 0x226677 }), 0, 4.2, 0.55, false));
  for (const sx of [-0.55, 0.55]) g.add(mesh(box(0.08, 0.06, 5), 0x9a94b2, sx, 0.03, 2.2, false));
  for (let i = 0; i < 6; i++) g.add(mesh(box(1.5, 0.06, 0.2), WOOD, 0, 0.02, 0 + i * 0.9, false));
  // a little mine cart
  const cart = new THREE.Group();
  cart.add(mesh(box(1.0, 0.6, 0.8), 0x7a7fa8, 0, 0.5, 0));
  for (const sx of [-0.35, 0.35]) for (const sz of [-0.3, 0.3]) cart.add(mesh(cyl(0.14, 0.14, 0.08, 10), COLORS.ink, sx, 0.15, sz).rotateZ(Math.PI / 2));
  cart.add(mesh(ico(0.25, 0), toon(0x8ff0ff, { emissive: 0x114455 }), 0, 0.85, 0));
  cart.position.set(2.6, 0, 2.6);
  cart.rotation.y = 0.4;
  g.add(cart);
  g.userData.door = new THREE.Vector3(0, 0, 2.0);
  return g;
}

/** The rockfall that blocks the mine until it is cleared with the pickaxe. */
export function makeRockfall() {
  const g = new THREE.Group();
  const spots = [[-1.1, 0.7, 0.9], [0.2, 0.9, 1.1], [1.2, 0.6, 0.8], [-0.4, 1.6, 0.7], [0.7, 1.5, 0.6], [0.1, 0.4, 0.7]];
  for (const [x, y, s] of spots) {
    const r = mesh(ico(1, 0), STONE_DARK, x, y, 1.0);
    r.scale.set(s, s * 0.85, s);
    r.rotation.set(x, y * 3, 0.4);
    g.add(r);
  }
  return g;
}

/** Pillow Keep: a soft round tower with a cushion roof and pillows piled by the door. */
export function makeKeepTower(M) {
  const g = new THREE.Group();
  g.add(mesh(cyl(2.4, 2.6, 5.2, 18), 0xd9cdf0, 0, 2.6, 0));
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    g.add(mesh(box(0.7, 0.6, 0.5), 0xd9cdf0, Math.sin(a) * 2.3, 5.5, Math.cos(a) * 2.3).rotateY(a));
  }
  g.add(mesh(cone(2.7, 2.6, 18), 0xb79fd6, 0, 7.1, 0));
  g.add(mesh(sph(0.35), 0xffc93c, 0, 8.5, 0));
  g.add(mesh(box(1.3, 2.0, 0.3), 0x8a63c9, 0, 1.0, 2.35));
  g.add(mesh(cyl(0.65, 0.65, 0.3, 14, 1), 0x8a63c9, 0, 2.0, 2.35).rotateX(Math.PI / 2));
  g.add(windowAt(M, 0, 3.8, 2.38, 0.6, 0.8));
  const pil = [0xff9fd0, 0x8fd8ff, 0xffe47a, 0x9ff0c8];
  for (let i = 0; i < 4; i++) {
    const p = mesh(sph(0.45, 12, 8), pil[i], -2.2 + (i % 2) * 0.6, 0.3 + Math.floor(i / 2) * 0.45, 2.3 - (i % 2) * 0.3);
    p.scale.set(1.3, 0.5, 0.9);
    g.add(p);
  }
  g.add(mesh(cyl(0.04, 0.04, 2, 4), WOOD_DARK, 1.6, 7.0, 0));
  g.add(mesh(box(0.9, 0.5, 0.03), 0xff9fd0, 2.05, 7.7, 0));
  g.userData.door = new THREE.Vector3(0, 0, 3.6);
  return g;
}

/** The grumble burrow: a grassy mound with a round door, a grumpy sign and a little grumble guide flag. */
export function makeBurrow() {
  const g = new THREE.Group();
  const mound = mesh(sph(2.2, 16, 10), 0x6fbf4a, 0, 0, 0);
  mound.scale.set(1.2, 0.75, 1);
  g.add(mound);
  g.add(mesh(cyl(0.8, 0.8, 0.2, 18), 0x6b4a3a, 0, 0.75, 2.05).rotateX(Math.PI / 2));
  g.add(mesh(tor(0.82, 0.1), WOOD, 0, 0.75, 2.12).rotateY(0));
  g.add(mesh(sph(0.08, 8, 6), COLORS.gold, 0.4, 0.75, 2.2, false));
  g.add(mesh(cyl(0.04, 0.04, 1.8, 4), WOOD_DARK, 1.6, 1.8, 0.6));
  g.add(mesh(box(0.7, 0.45, 0.03), 0x9a6a44, 1.95, 2.4, 0.6));
  const gr = makeGrumble(0x9a6a44);
  gr.scale.setScalar(0.6);
  gr.position.set(-1.3, 1.3, 1.0);
  g.add(gr);
  g.userData.door = new THREE.Vector3(0, 0, 3.2);
  return g;
}

/** Knights & Builders: a small castle gate with two towers, banners and a golden bean on top. */
export function makeCastleGate() {
  const g = new THREE.Group();
  for (const sx of [-1, 1]) {
    g.add(mesh(box(2.0, 5.0, 2.0), STONE, sx * 2.6, 2.5, 0));
    for (let i = 0; i < 4; i++) g.add(mesh(box(0.45, 0.5, 0.45), STONE, sx * 2.6 + ((i % 2) - 0.5) * 1.5, 5.25, (Math.floor(i / 2) - 0.5) * 1.5));
    g.add(mesh(cone(1.4, 1.6, 4), 0x4c6fd6, sx * 2.6, 6.3, 0).rotateY(Math.PI / 4));
    g.add(mesh(box(0.8, 1.4, 0.06), sx < 0 ? 0xff5d73 : 0x4c6fd6, sx * 2.6, 3.2, 1.04));
    g.add(mesh(box(0.3, 0.4, 0.08), COLORS.gold, sx * 2.6, 3.3, 1.08, false));
  }
  g.add(mesh(box(3.4, 1.3, 1.6), STONE, 0, 4.0, 0));
  for (let i = 0; i < 3; i++) g.add(mesh(box(0.45, 0.45, 0.45), STONE, -1.1 + i * 1.1, 4.9, 0.5));
  g.add(mesh(box(2.4, 3.3, 0.2), 0x7a4a2e, 0, 1.65, 0.6));
  for (let i = 0; i < 4; i++) g.add(mesh(box(0.06, 3.3, 0.24), COLORS.ink, -0.9 + i * 0.6, 1.65, 0.62, false));
  // the golden bean
  const bean = mesh(sharedGeo('isl-bean', () => new THREE.CapsuleGeometry(0.3, 0.3, 6, 12)), toon(COLORS.gold, { emissive: 0x443300 }), 0, 5.5, 0.4);
  g.add(bean);
  g.userData.bean = bean;
  g.userData.door = new THREE.Vector3(0, 0, 2.0);
  return g;
}

/**
 * The game hall: an open-fronted arcade with four cabinets for the guest games.
 * userData.cabinets = [{ key, x, z }] local positions in front of each cabinet.
 */
export function makeHall(M, keys) {
  const g = new THREE.Group();
  const W = 11, D = 5;
  g.add(mesh(box(W + 0.4, 0.3, D + 0.4), STONE_DARK, 0, 0.15, 0));
  g.add(mesh(box(W, 3.4, 0.3), 0x5a3fd0, 0, 2.0, -D / 2));
  for (const sx of [-1, 1]) g.add(mesh(box(0.3, 3.4, D), 0x5a3fd0, sx * W / 2, 2.0, 0));
  g.add(mesh(box(W + 0.8, 0.4, D + 0.8), 0x2b2340, 0, 3.85, 0));
  g.add(mesh(roofGeo(W + 1, D + 1.2, 1.4), 0x9b5de5, 0, 4.0, 0));
  // floor: checkered
  for (let i = 0; i < 10; i++) for (let k = 0; k < 4; k++) g.add(mesh(box(1.05, 0.04, 1.1), (i + k) % 2 ? 0xffffff : 0x2b2340, -W / 2 + 0.6 + i * 1.08, 0.32, -D / 2 + 0.7 + k * 1.15, false));
  // sign with lights
  g.add(mesh(box(5.0, 1.0, 0.2), 0x2b2340, 0, 4.6, D / 2 + 0.3));
  for (let i = 0; i < 9; i++) g.add(mesh(sph(0.1, 8, 6), M.lamp, -2.2 + i * 0.55, 4.6, D / 2 + 0.45, false));
  for (const sx of [-1, 1]) g.add(mesh(cyl(0.15, 0.15, 3.6, 8), 0xffc93c, sx * (W / 2 - 0.2), 1.9, D / 2));
  const cabinets = [];
  keys.forEach((key, i) => {
    const x = -3.9 + i * 2.6;
    const c = new THREE.Group();
    const col = [0xff5d73, 0x4cc9f0, 0x3ddc97, 0xffc93c][i % 4];
    c.add(mesh(box(1.3, 2.2, 1.0), col, 0, 1.1, 0));
    c.add(mesh(box(1.1, 0.8, 0.1), M.screen, 0, 1.6, 0.48, false));
    c.add(mesh(box(1.3, 0.25, 0.6), 0x2b2340, 0, 1.05, 0.55));
    c.add(mesh(cyl(0.05, 0.05, 0.2, 6), COLORS.ink, -0.3, 1.25, 0.6, false));
    c.add(mesh(sph(0.08, 8, 6), 0xff5d73, -0.3, 1.38, 0.6, false));
    c.add(mesh(sph(0.07, 8, 6), 0x3ddc97, 0.15, 1.2, 0.65, false));
    c.add(mesh(sph(0.07, 8, 6), 0xffc93c, 0.38, 1.2, 0.65, false));
    c.add(mesh(box(1.4, 0.4, 1.05), 0x2b2340, 0, 2.35, 0));
    const ic = makeGameIcon(key);
    ic.scale.setScalar(0.42);
    ic.position.set(0, 3.0, 0.1);
    c.add(ic);
    c.userData.icon = ic;
    c.position.set(x, 0.3, -1.2);
    g.add(c);
    cabinets.push({ key, x, z: 0.4, icon: ic });
  });
  g.userData.cabinets = cabinets;
  return g;
}

/** Pip's launch pad: a round pad with a little rocket and a fuel tank. */
export function makeLaunchPad() {
  const g = new THREE.Group();
  g.add(mesh(cyl(2.6, 2.8, 0.3, 24), 0x9a94b2, 0, 0.15, 0));
  g.add(mesh(cyl(1.8, 1.8, 0.05, 24), 0xffc93c, 0, 0.32, 0, false));
  g.add(mesh(cyl(1.5, 1.5, 0.07, 24), 0x9a94b2, 0, 0.33, 0, false));
  const r = new THREE.Group();
  r.add(mesh(cyl(0.7, 0.8, 2.6, 16), 0xffffff, 0, 1.7, 0));
  r.add(mesh(cone(0.7, 1.3, 16), 0xff5d73, 0, 3.65, 0));
  r.add(mesh(cyl(0.32, 0.32, 0.1, 14), 0x8fd8ff, 0, 2.3, 0.72, false).rotateX(Math.PI / 2));
  r.add(mesh(tor(0.33, 0.05), 0x9a94b2, 0, 2.3, 0.74, false));
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const fin = mesh(box(0.1, 0.9, 0.7), 0x5b4fd8, Math.sin(a) * 0.8, 0.75, Math.cos(a) * 0.8);
    fin.rotation.y = a;
    r.add(fin);
  }
  r.add(mesh(cyl(0.45, 0.6, 0.4, 12), 0x2b2340, 0, 0.35, 0));
  r.position.y = 0.3;
  g.add(r);
  g.userData.rocket = r;
  g.add(mesh(cyl(0.5, 0.5, 1.6, 12), 0x3ddc97, 2.6, 0.8, -1.2));
  g.add(mesh(sph(0.5, 12, 8), 0x3ddc97, 2.6, 1.6, -1.2));
  return g;
}

/** The river bridge. broken = middle planks missing, a rope across and a sign. */
export function makeBridge(len, broken) {
  const g = new THREE.Group();
  const n = Math.round(len / 0.55);
  for (let i = 0; i < n; i++) {
    const x = -len / 2 + (i + 0.5) * (len / n);
    if (broken && Math.abs(x) < len * 0.22) continue;
    const p = mesh(box(len / n - 0.06, 0.16, 3.0), i % 3 ? WOOD : 0xb87a48, x, 0.3, 0);
    p.rotation.x = (i % 2 ? 0.02 : -0.02);
    g.add(p);
  }
  for (const sz of [-1.45, 1.45]) {
    for (let i = 0; i <= 4; i++) {
      const x = -len / 2 + (i / 4) * len;
      if (broken && Math.abs(x) < len * 0.2) continue;
      g.add(mesh(cyl(0.1, 0.12, 1.3, 6), WOOD_DARK, x, 0.75, sz));
    }
    if (broken) {
      for (const sx of [-1, 1]) g.add(mesh(box(len * 0.3, 0.1, 0.1), WOOD, sx * len * 0.35, 1.25, sz));
      g.add(mesh(cyl(0.02, 0.02, len * 0.42, 4), 0xe8d5a8, 0, 1.0, sz, false).rotateZ(Math.PI / 2));
    } else g.add(mesh(box(len, 0.12, 0.12), WOOD, 0, 1.3, sz));
  }
  for (const sx of [-1, 1]) g.add(mesh(box(1.4, 0.3, 3.4), STONE_DARK, sx * (len / 2 + 0.4), 0.05, 0));
  return g;
}

export function makeFencePost() {
  const g = new THREE.Group();
  g.add(mesh(box(0.16, 0.9, 0.16), WOOD, 0, 0.45, 0));
  g.add(mesh(cone(0.13, 0.15, 4), WOOD, 0, 0.97, 0).rotateY(Math.PI / 4));
  return g;
}

/** A fence from a to b ({x,z}), with posts every ~1.2 units and two rails. */
export function makeFence(a, b, heightAt) {
  const g = new THREE.Group();
  const len = Math.hypot(b.x - a.x, b.z - a.z);
  const n = Math.max(1, Math.round(len / 1.2));
  const ang = Math.atan2(b.x - a.x, b.z - a.z);
  for (let i = 0; i <= n; i++) {
    const x = a.x + ((b.x - a.x) * i) / n, z = a.z + ((b.z - a.z) * i) / n;
    const p = makeFencePost();
    p.position.set(x, heightAt(x, z), z);
    g.add(p);
  }
  for (const y of [0.35, 0.7]) {
    const r = mesh(box(0.06, 0.1, len), 0xe2b06a, (a.x + b.x) / 2, heightAt((a.x + b.x) / 2, (a.z + b.z) / 2) + y, (a.z + b.z) / 2);
    r.rotation.y = ang;
    g.add(r);
  }
  return g;
}

/** A street lamp; the lantern uses the night lamp material. */
export function makeLamp(M) {
  const g = new THREE.Group();
  g.add(mesh(cyl(0.22, 0.28, 0.25, 8), 0x2b2340, 0, 0.12, 0));
  g.add(mesh(cyl(0.07, 0.09, 2.6, 8), 0x2b2340, 0, 1.4, 0));
  g.add(mesh(box(0.42, 0.06, 0.42), 0x2b2340, 0, 2.75, 0));
  g.add(mesh(box(0.32, 0.4, 0.32), M.lamp, 0, 3.0, 0, false));
  g.add(mesh(cone(0.32, 0.3, 4), 0x2b2340, 0, 3.35, 0).rotateY(Math.PI / 4));
  return g;
}

/** A wooden sign on a post; color is the board. */
export function makeSign(color = 0xf3d9a4, w = 1.2) {
  const g = new THREE.Group();
  g.add(mesh(box(0.12, 1.2, 0.12), WOOD_DARK, 0, 0.6, 0));
  g.add(mesh(box(w, 0.6, 0.1), color, 0, 1.2, 0.05));
  g.add(mesh(box(w + 0.1, 0.08, 0.14), WOOD_DARK, 0, 1.52, 0.05, false));
  return g;
}

export function makeBench() {
  const g = new THREE.Group();
  g.add(mesh(box(1.8, 0.1, 0.5), WOOD, 0, 0.45, 0));
  g.add(mesh(box(1.8, 0.4, 0.08), WOOD, 0, 0.75, -0.24));
  for (const sx of [-0.75, 0.75]) g.add(mesh(box(0.1, 0.45, 0.45), 0x2b2340, sx, 0.22, 0));
  return g;
}

export function makeBarrel(color = WOOD) {
  const g = new THREE.Group();
  g.add(mesh(cyl(0.38, 0.38, 0.9, 12), color, 0, 0.45, 0));
  for (const y of [0.15, 0.75]) g.add(mesh(cyl(0.4, 0.4, 0.07, 12), 0x5a4d7a, 0, y, 0, false));
  return g;
}

export function makeCrate() {
  const g = new THREE.Group();
  g.add(mesh(box(0.7, 0.7, 0.7), WOOD, 0, 0.35, 0));
  g.add(mesh(box(0.74, 0.1, 0.74), WOOD_DARK, 0, 0.66, 0, false));
  return g;
}

/** Mailbox; userData.flag is raised (and userData.letter bobs) when there is mail. */
export function makeMailbox() {
  const g = new THREE.Group();
  g.add(mesh(box(0.14, 1.0, 0.14), WOOD_DARK, 0, 0.5, 0));
  g.add(mesh(box(0.5, 0.42, 0.7), 0x4c8bd6, 0, 1.15, 0));
  g.add(mesh(cyl(0.25, 0.25, 0.7, 12, 1), 0x4c8bd6, 0, 1.36, 0).rotateX(Math.PI / 2));
  const flag = new THREE.Group();
  flag.add(mesh(box(0.04, 0.5, 0.05), 0xff5d73, 0, 0.25, 0, false));
  flag.add(mesh(box(0.04, 0.18, 0.25), 0xff5d73, 0, 0.42, 0.12, false));
  flag.position.set(0.28, 1.1, -0.1);
  g.add(flag);
  const letter = new THREE.Group();
  letter.add(mesh(box(0.5, 0.34, 0.04), 0xfff8e8, 0, 0, 0, false));
  letter.add(mesh(sph(0.06, 8, 6), 0xff5d73, 0, 0, 0.03, false));
  letter.position.set(0, 2.1, 0);
  g.add(letter);
  g.userData = { flag, letter };
  return g;
}

/** The shipping bin: drop crops in for coins. */
export function makeShippingBin() {
  const g = new THREE.Group();
  g.add(mesh(box(1.5, 0.8, 1.0), WOOD, 0, 0.4, 0));
  for (let i = 0; i < 3; i++) g.add(mesh(box(1.52, 0.06, 1.02), WOOD_DARK, 0, 0.15 + i * 0.27, 0, false));
  const lid = mesh(box(1.6, 0.12, 1.1), 0xb87a48, 0, 0.86, 0);
  g.add(lid);
  g.add(mesh(cyl(0.18, 0.18, 0.05, 12), COLORS.gold, 0, 0.5, 0.51, false).rotateX(Math.PI / 2));
  g.userData.lid = lid;
  return g;
}

export function makeWell() {
  const g = new THREE.Group();
  g.add(mesh(cyl(0.9, 1.0, 0.8, 14), STONE, 0, 0.4, 0));
  g.add(mesh(cyl(0.7, 0.7, 0.05, 14), toon(0x3aa6e0), 0, 0.7, 0, false));
  for (const sx of [-0.8, 0.8]) g.add(mesh(box(0.14, 1.6, 0.14), WOOD_DARK, sx, 1.2, 0));
  g.add(mesh(roofGeo(2.1, 1.4, 0.6), 0xff7a59, 0, 2.0, 0));
  g.add(mesh(cyl(0.06, 0.06, 1.6, 6), WOOD, 0, 1.75, 0).rotateZ(Math.PI / 2));
  g.add(mesh(cyl(0.18, 0.15, 0.25, 8), WOOD, 0.2, 1.2, 0));
  return g;
}

export function makeFountain() {
  const g = new THREE.Group();
  g.add(mesh(cyl(2.0, 2.1, 0.6, 20), STONE, 0, 0.3, 0));
  g.add(mesh(cyl(1.75, 1.75, 0.05, 20), toon(0x56c6f0), 0, 0.55, 0, false));
  g.add(mesh(cyl(0.25, 0.3, 1.4, 10), STONE, 0, 1.0, 0));
  g.add(mesh(cyl(0.8, 0.5, 0.25, 14), STONE, 0, 1.75, 0));
  g.add(mesh(cyl(0.6, 0.6, 0.05, 14), toon(0x56c6f0), 0, 1.86, 0, false));
  const spout = mesh(sph(0.22, 10, 8), toon(0xbff0ff), 0, 2.15, 0, false);
  g.add(spout);
  g.userData.spout = spout;
  return g;
}

export function makeNoticeBoard() {
  const g = new THREE.Group();
  for (const sx of [-0.8, 0.8]) g.add(mesh(box(0.14, 2.0, 0.14), WOOD_DARK, sx, 1.0, 0));
  g.add(mesh(box(1.8, 1.1, 0.1), 0xd9a066, 0, 1.4, 0.03));
  g.add(mesh(roofGeo(2.1, 0.6, 0.35), 0xff7a59, 0, 2.0, 0));
  const notes = [[-0.5, 1.55, 0xffffff], [0.1, 1.35, 0xfff3a8], [0.55, 1.6, 0xffd0e0], [-0.2, 1.1, 0xd0f0ff]];
  for (const [x, y, c] of notes) {
    const n = mesh(box(0.42, 0.36, 0.02), c, x, y, 0.1, false);
    n.rotation.z = x * 0.2;
    g.add(n);
  }
  return g;
}

/** A string of colored flags between two points (world coordinates, heights included). */
export function makeBunting(a, b, sag = 0.6) {
  const g = new THREE.Group();
  const n = Math.max(4, Math.round(Math.hypot(b.x - a.x, b.z - a.z) / 0.6));
  const cols = [0xff5d73, 0xffc93c, 0x4cc9f0, 0x3ddc97, 0x9b5de5];
  const ang = Math.atan2(b.x - a.x, b.z - a.z);
  for (let i = 1; i < n; i++) {
    const k = i / n;
    const f = mesh(cone(0.18, 0.4, 3), cols[i % cols.length], a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k - Math.sin(k * Math.PI) * sag - 0.2, a.z + (b.z - a.z) * k, false);
    f.rotation.set(Math.PI, ang + Math.PI / 2, 0);
    f.scale.set(1, 1, 0.2);
    g.add(f);
  }
  return g;
}

/** The Driftwood Café, boarded up for now (a restaurant for later). */
export function makeCafe(M) {
  return makeCottage(M, { wall: 0xe8d5b0, roof: 0x3ddc97, w: 4.6, d: 3.4, h: 2.2, chimney: false, door: 0x7a5a3a });
}

/** Boards nailed over the café's windows and door (until it is fixed). Local to the café. */
export function makeCafeBoards() {
  const g = new THREE.Group();
  for (const sx of [-1.38, 1.38]) for (const r of [-0.4, 0.4]) {
    const b = mesh(box(0.95, 0.14, 0.06), WOOD, sx, 1.55, 1.82, false);
    b.rotation.z = r;
    g.add(b);
  }
  g.add(mesh(box(1.2, 0.14, 0.06), WOOD, 0, 1.3, 1.9, false).rotateZ(0.3));
  return g;
}

/** A round café table with a parasol. */
export function makeCafeTable(color) {
  const g = new THREE.Group();
  g.add(mesh(cyl(0.5, 0.5, 0.06, 12), 0xffffff, 0, 0.75, 0));
  g.add(mesh(cyl(0.06, 0.06, 0.75, 6), 0x2b2340, 0, 0.37, 0));
  g.add(mesh(cyl(0.03, 0.03, 2.0, 4), WOOD_DARK, 0, 1.6, 0, false));
  g.add(mesh(cone(0.9, 0.5, 8), color, 0, 2.5, 0));
  return g;
}

/** The open café: serving counter, menu board, string lights and an outdoor stove. Local to the café. */
export function makeCafeOpen(M) {
  const g = new THREE.Group();
  // counter in front of the café (guests stand behind it, you serve from the beach side)
  g.add(mesh(box(4.2, 0.62, 0.6), 0xfff3dc, 0, 0.31, 3.4));
  g.add(mesh(box(4.4, 0.1, 0.8), WOOD, 0, 0.66, 3.4));
  for (let i = 0; i < 6; i++) g.add(mesh(box(0.66, 0.55, 0.04), i % 2 ? 0x3ddc97 : 0xffffff, -1.75 + i * 0.7, 0.31, 3.71, false));
  // menu board and lights
  g.add(mesh(box(1.0, 0.7, 0.06), 0x2b2340, 0, 1.75, 1.75, false));
  for (let i = 0; i < 3; i++) g.add(mesh(box(0.6, 0.05, 0.02), 0xffffff, 0, 1.95 - i * 0.18, 1.79, false));
  for (let i = 0; i < 9; i++) g.add(mesh(sph(0.08, 8, 6), M.lamp, -2.2 + i * 0.55, 2.62 - Math.sin((i / 8) * Math.PI) * 0.2, 1.85, false));
  // the stove (west side)
  const st = new THREE.Group();
  st.add(mesh(box(1.1, 0.9, 0.8), 0x9a94b2, 0, 0.45, 0), mesh(box(1.15, 0.08, 0.85), 0x2b2340, 0, 0.92, 0));
  st.add(mesh(cyl(0.25, 0.25, 0.08, 12), 0x2b2340, -0.25, 1.0, 0, false), mesh(cyl(0.2, 0.18, 0.2, 12), 0xbdb8cf, 0.25, 1.06, 0));
  st.add(mesh(box(0.5, 0.3, 0.05), toon(0xff8c42, { emissive: 0x662200 }), 0, 0.45, 0.41, false));
  st.add(mesh(cyl(0.08, 0.08, 1.4, 6), 0x5a4d7a, 0.4, 1.6, -0.3));
  st.position.set(-3.3, 0, 2.9);
  g.add(st);
  g.userData.stove = st;
  return g;
}

/** The dive boat: a flat wooden boat with a ladder, air tanks and a diver-down flag. Deck at y ≈ 0.6. */
export function makeDiveBoat() {
  const g = new THREE.Group();
  const hull = mesh(box(5.2, 0.9, 3.6), 0xff7a59, 0, 0, 0);
  g.add(hull, mesh(box(5.4, 0.12, 3.8), 0xffffff, 0, 0.42, 0));
  g.add(mesh(box(5.0, 0.08, 3.4), WOOD, 0, 0.5, 0));
  // ladder on the west side
  for (const z of [-0.35, 0.35]) g.add(mesh(box(0.08, 1.6, 0.08), 0xbdb8cf, -2.7, 0.1, z));
  for (let i = 0; i < 4; i++) g.add(mesh(box(0.08, 0.06, 0.7), 0xbdb8cf, -2.7, -0.5 + i * 0.35, 0, false));
  // tanks and a crate
  for (let i = 0; i < 2; i++) g.add(mesh(cyl(0.18, 0.18, 0.8, 10), 0xffc93c, 1.6 + i * 0.45, 0.95, -1.3));
  g.add(mesh(box(0.7, 0.5, 0.6), WOOD_DARK, -1.4, 0.8, -1.2));
  // flag: red with a white stripe
  g.add(mesh(cyl(0.04, 0.04, 2.6, 6), 0xffffff, 2.2, 1.8, 1.3));
  const flag = mesh(box(0.9, 0.6, 0.03), 0xff3b3b, 2.67, 2.75, 1.3);
  g.add(flag, mesh(box(0.95, 0.1, 0.035), 0xffffff, 2.67, 2.75, 1.3, false).rotateZ(-0.55));
  g.userData.flag = flag;
  return g;
}

/** A small red barn with closed doors (animals come later). */
export function makeBarn(M) {
  const g = new THREE.Group();
  g.add(mesh(box(4.4, 2.8, 3.6), 0xd94a4a, 0, 1.4, 0));
  g.add(mesh(roofGeo(4.9, 4.2, 1.8), 0xfff3dc, 0, 2.8, 0));
  g.add(mesh(box(2.0, 2.0, 0.1), 0xfff3dc, 0, 1.0, 1.82));
  for (const r of [0.78, -0.78]) g.add(mesh(box(0.14, 2.6, 0.08), 0xfff3dc, 0, 1.0, 1.88, false).rotateZ(r));
  g.add(windowAt(M, 0, 2.35, 1.83, 0.5, 0.4));
  return g;
}

/** The pier: planks on posts, starting at z=0 and running toward +z. */
export function makePier(len, w = 3) {
  const g = new THREE.Group();
  const n = Math.round(len / 0.6);
  for (let i = 0; i < n; i++) g.add(mesh(box(w, 0.14, 0.54), i % 4 === 1 ? 0xb87a48 : WOOD, 0, 0, 0.3 + i * 0.6));
  for (let i = 0; i <= Math.floor(len / 3); i++) for (const sx of [-1, 1]) g.add(mesh(cyl(0.14, 0.16, 2.4, 8), WOOD_DARK, sx * (w / 2 - 0.05), -0.9, i * 3 + 0.3));
  return g;
}

export function makeBuoy() {
  const g = new THREE.Group();
  g.add(mesh(cyl(0.4, 0.5, 0.6, 12), 0xff5d73, 0, 0.1, 0));
  g.add(mesh(cyl(0.42, 0.42, 0.15, 12), 0xffffff, 0, 0.3, 0, false));
  g.add(mesh(cone(0.25, 0.6, 8), 0xffc93c, 0, 0.7, 0));
  return g;
}

export function makeRowboat() {
  const g = new THREE.Group();
  const hull = mesh(sph(1, 14, 8), 0x4cc9f0, 0, 0, 0);
  hull.scale.set(0.8, 0.35, 1.7);
  g.add(hull);
  const inner = mesh(sph(0.95, 14, 8), WOOD, 0, 0.08, 0);
  inner.scale.set(0.7, 0.25, 1.55);
  g.add(inner);
  g.add(mesh(box(1.2, 0.08, 0.3), WOOD_DARK, 0, 0.25, 0.3, false));
  return g;
}

export function makeTelescope() {
  const g = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const leg = mesh(cyl(0.03, 0.03, 1.2, 4), WOOD_DARK, Math.sin(a) * 0.25, 0.55, Math.cos(a) * 0.25, false);
    leg.rotation.set(Math.cos(a) * 0.35, 0, -Math.sin(a) * 0.35);
    g.add(leg);
  }
  const tube = mesh(cyl(0.1, 0.14, 1.0, 10), 0x5b4fd8, 0, 1.25, 0);
  tube.rotation.x = -0.9;
  g.add(tube);
  return g;
}

/** A fallen branch to pick up (wood). */
export function makeBranch() {
  const g = new THREE.Group();
  const a = mesh(cyl(0.08, 0.1, 1.2, 6), 0x9a6440, 0, 0.1, 0);
  a.rotation.z = Math.PI / 2;
  g.add(a);
  const b = mesh(cyl(0.05, 0.06, 0.5, 5), 0x9a6440, 0.2, 0.15, 0.18);
  b.rotation.set(0, 0.6, Math.PI / 2 + 0.3);
  g.add(b);
  g.add(mesh(sph(0.12, 6, 5), 0x58b947, 0.55, 0.18, 0.2, false));
  return g;
}

/** Waterfall coming down the cliff into the river. */
export function makeWaterfall(h, w) {
  const g = new THREE.Group();
  g.add(mesh(box(w, h, 0.4), toon(0x9fe4ff, { transparent: true, opacity: 0.85 }), 0, h / 2, 0, false));
  for (let i = 0; i < 4; i++) g.add(mesh(box(0.12, h, 0.42), toon(0xffffff, { transparent: true, opacity: 0.6 }), -w / 2 + 0.4 + i * (w - 0.8) / 3, h / 2, 0.02, false));
  return g;
}

// ---------- the farm ----------

/** A plant at a growth stage: 0 seed, 1 sprout, 2 young, 3 ripe. */
export function makeCrop(id, stage) {
  const c = CROPS[id];
  const g = new THREE.Group();
  const leaf = c.leaf;
  if (stage === 0) {
    const mound = mesh(sph(0.16, 8, 6), 0x7a4a2e, 0, 0.02, 0, false);
    mound.scale.set(1, 0.4, 1);
    g.add(mound);
    for (let i = 0; i < 3; i++) g.add(mesh(sph(0.035, 6, 4), 0xf3d9a4, -0.06 + i * 0.06, 0.07, (i - 1) * 0.04, false));
    return g;
  }
  if (stage === 1) {
    g.add(mesh(cyl(0.02, 0.02, 0.22, 4), leaf, 0, 0.11, 0, false));
    for (const s of [-1, 1]) {
      const l = mesh(sph(0.09, 8, 6), leaf, s * 0.08, 0.22, 0, false);
      l.scale.set(1, 0.4, 0.6);
      l.rotation.z = s * 0.4;
      g.add(l);
    }
    return g;
  }
  const big = stage === 3;
  switch (id) {
    case 'corn': {
      const h = big ? 1.5 : 0.8;
      for (const sx of [-0.12, 0.12]) {
        g.add(mesh(cyl(0.04, 0.05, h, 5), leaf, sx, h / 2, 0));
        const l = mesh(box(0.05, 0.5, 0.14), leaf, sx * 2, h * 0.5, 0.05);
        l.rotation.z = sx * 4;
        g.add(l);
        if (big) g.add(mesh(sharedGeo('isl-cob', () => new THREE.CapsuleGeometry(0.08, 0.22, 4, 8)), c.color, sx + 0.08, h * 0.65, 0.08));
      }
      break;
    }
    case 'tomato':
    case 'strawberry': {
      const tall = id === 'tomato';
      if (tall) g.add(mesh(cyl(0.025, 0.025, 1.1, 4), WOOD, 0.15, 0.55, -0.1, false));
      const r = big ? 0.3 : 0.22;
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        g.add(mesh(ico(r, 1), leaf, Math.cos(a) * 0.12, (tall ? 0.45 : 0.2) + (i % 2) * 0.15, Math.sin(a) * 0.12));
      }
      if (big) for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + 0.3;
        g.add(mesh(sph(tall ? 0.11 : 0.08, 8, 6), c.color, Math.cos(a) * 0.27, (tall ? 0.55 : 0.2) + (i % 3) * 0.12, Math.sin(a) * 0.27, false));
      }
      break;
    }
    case 'pumpkin': {
      for (let i = 0; i < 3; i++) {
        const l = mesh(sph(0.2, 8, 6), leaf, Math.cos(i * 2.1) * 0.3, 0.12, Math.sin(i * 2.1) * 0.3);
        l.scale.set(1.2, 0.35, 1);
        g.add(l);
      }
      if (big) {
        const p = mesh(sph(0.42, 14, 10), c.color, 0, 0.32, 0.05);
        p.scale.set(1.15, 0.8, 1.0);
        g.add(p, mesh(cyl(0.05, 0.06, 0.18, 6), 0x7a4a2e, 0, 0.7, 0.05, false));
      } else g.add(mesh(sph(0.15, 10, 8), 0x9be05a, 0, 0.14, 0.05));
      break;
    }
    case 'starfruit': {
      g.add(mesh(cyl(0.03, 0.04, big ? 0.9 : 0.5, 5), leaf, 0, big ? 0.45 : 0.25, 0));
      for (let i = 0; i < 3; i++) {
        const l = mesh(sph(0.14, 8, 6), leaf, Math.cos(i * 2.1) * 0.15, big ? 0.55 : 0.35, Math.sin(i * 2.1) * 0.15, false);
        l.scale.set(1, 0.35, 0.6);
        g.add(l);
      }
      if (big) {
        const s = mesh(sharedGeo('isl-starfruit', () => {
          const shape = new THREE.Shape();
          for (let i = 0; i < 10; i++) {
            const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
            const r = i % 2 ? 0.12 : 0.28;
            if (i === 0) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r); else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
          }
          const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.12, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 1 });
          geo.translate(0, 0, -0.06);
          return geo;
        }), toon(c.color, { emissive: 0x554400 }), 0, 1.05, 0);
        g.add(s);
        g.userData.spin = s;
      }
      break;
    }
    default: {
      // radish, carrot, lettuce: leafy tops, the crop peeking out when ripe
      const n = id === 'lettuce' ? 6 : 4;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const l = mesh(sph(id === 'lettuce' ? 0.16 : 0.1, 8, 6), id === 'lettuce' ? c.color : leaf, Math.cos(a) * 0.1, (id === 'lettuce' ? 0.15 : 0.3), Math.sin(a) * 0.1, false);
        l.scale.set(id === 'lettuce' ? 1.2 : 0.6, id === 'lettuce' ? 0.8 : 1.6, id === 'lettuce' ? 1.2 : 0.6);
        l.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
        g.add(l);
      }
      if (big) {
        if (id === 'radish') g.add(mesh(sph(0.2, 10, 8), c.color, 0, 0.1, 0));
        else if (id === 'carrot') g.add(mesh(cone(0.16, 0.3, 8), c.color, 0, 0.06, 0).rotateX(Math.PI));
        else { const h = mesh(sph(0.3, 12, 8), c.color, 0, 0.22, 0); h.scale.set(1, 0.8, 1); g.add(h); }
      }
      if (!big) g.scale.setScalar(0.75);
    }
  }
  return g;
}

/** Tools held in the bean's hand. */
export function makeTool(id) {
  const g = new THREE.Group();
  if (id === 'hoe') {
    g.add(mesh(cyl(0.04, 0.04, 1.0, 5), WOOD, 0, 0.5, 0, false));
    g.add(mesh(box(0.3, 0.06, 0.18), 0xbdb8cf, 0, 1.0, 0.08, false));
  } else if (id === 'can') {
    g.add(mesh(cyl(0.18, 0.2, 0.32, 10), 0x4cc9f0, 0, 0.16, 0, false));
    const sp = mesh(cyl(0.03, 0.04, 0.35, 5), 0x4cc9f0, 0, 0.25, 0.22, false);
    sp.rotation.x = 0.9;
    g.add(sp);
    g.add(mesh(tor(0.12, 0.025, Math.PI), 0x2b2340, 0, 0.32, -0.05, false));
  } else if (id === 'scythe') {
    g.add(mesh(cyl(0.035, 0.035, 1.0, 5), WOOD, 0, 0.5, 0, false));
    const b = mesh(tor(0.3, 0.04, Math.PI * 0.7), 0xe8e8f2, 0.0, 0.95, 0.15, false);
    b.rotation.y = Math.PI / 2;
    g.add(b);
  } else if (id === 'pickaxe') {
    g.add(mesh(cyl(0.04, 0.04, 0.9, 5), WOOD, 0, 0.45, 0, false));
    const h = mesh(tor(0.32, 0.05, Math.PI * 0.8), 0x9a94b2, 0, 0.8, 0, false);
    h.rotation.set(Math.PI / 2, 0, Math.PI * 0.1 + Math.PI);
    g.add(h);
  }
  return g;
}

// ---------- decorations (rewards from the games and from friends) ----------

export function makeDeco(id, M) {
  const g = new THREE.Group();
  switch (id) {
    case 'lhLamp': { // a mini lighthouse lamp
      g.add(mesh(cyl(0.3, 0.4, 0.3, 10), STONE_DARK, 0, 0.15, 0));
      for (let i = 0; i < 3; i++) g.add(mesh(cyl(0.22 - i * 0.03, 0.25 - i * 0.03, 0.4, 10), i % 2 ? 0xffffff : 0xff5d73, 0, 0.5 + i * 0.4, 0));
      g.add(mesh(sph(0.18, 10, 8), M.lamp, 0, 1.55, 0, false));
      g.add(mesh(cone(0.22, 0.25, 10), 0xff5d73, 0, 1.8, 0));
      break;
    }
    case 'lhTrophy': case 'duckTrophy': case 'duckGold': case 'hopTrophy': case 'castleTrophy': case 'guidesTrophy': {
      const col = { lhTrophy: 0x8ff0ff, duckTrophy: 0xc0c0d0, duckGold: COLORS.gold, hopTrophy: 0x4cc9f0, castleTrophy: COLORS.gold, guidesTrophy: 0x9a6a44 }[id];
      g.add(mesh(box(0.7, 0.5, 0.7), 0x5a4d7a, 0, 0.25, 0));
      g.add(mesh(cyl(0.08, 0.15, 0.3, 8), COLORS.gold, 0, 0.65, 0));
      g.add(mesh(cyl(0.3, 0.12, 0.45, 12), COLORS.gold, 0, 1.0, 0));
      for (const s of [-1, 1]) g.add(mesh(tor(0.12, 0.03), COLORS.gold, s * 0.32, 1.05, 0, false));
      const top = id === 'duckTrophy' || id === 'duckGold' ? mesh(sph(0.16, 10, 8), 0xffd23f, 0, 1.4, 0) : mesh(sharedGeo('isl-crys', () => new THREE.OctahedronGeometry(0.22, 0)), toon(col, { emissive: 0x222222 }), 0, 1.45, 0);
      g.add(top);
      if (id !== 'duckTrophy' && id !== 'duckGold') g.userData.spin = top;
      break;
    }
    case 'flag': { // pirate flag on a pole (Pudding Island)
      g.add(mesh(cyl(0.05, 0.05, 3.2, 6), WOOD_DARK, 0, 1.6, 0));
      const f = mesh(box(1.1, 0.7, 0.03), 0x2b2340, 0.55, 2.8, 0);
      g.add(f);
      g.add(mesh(sph(0.15, 10, 8), 0xffe0f0, 0.55, 2.85, 0.03, false));
      for (const s of [-1, 1]) g.add(mesh(box(0.4, 0.06, 0.02), 0xffe0f0, 0.55, 2.62, 0.03, false).rotateZ(s * 0.6));
      g.userData.wave = f;
      break;
    }
    case 'bottle': { // ship in a bottle on a little table
      g.add(mesh(cyl(0.4, 0.4, 0.06, 12), WOOD, 0, 0.7, 0));
      g.add(mesh(cyl(0.05, 0.08, 0.7, 6), WOOD_DARK, 0, 0.35, 0));
      const b = mesh(sharedGeo('isl-bottle', () => new THREE.CapsuleGeometry(0.18, 0.5, 6, 12)), toon(0xbff6ff, { transparent: true, opacity: 0.6 }), 0, 0.95, 0, false);
      b.rotation.z = Math.PI / 2;
      g.add(b, mesh(box(0.3, 0.08, 0.1), 0x9a6440, 0, 0.92, 0, false), mesh(box(0.02, 0.2, 0.15), 0xffffff, 0, 1.03, 0, false));
      break;
    }
    case 'kite': { // a kite on a pole (Sky Hop)
      g.add(mesh(cyl(0.04, 0.04, 2.6, 5), WOOD_DARK, 0, 1.3, 0));
      const k = mesh(sharedGeo('isl-kite', () => new THREE.OctahedronGeometry(0.5, 0)), 0x4cc9f0, 0, 2.9, 0);
      k.scale.set(0.8, 1.2, 0.08);
      g.add(k);
      g.userData.wave = k;
      break;
    }
    case 'banner': { // castle banner
      g.add(mesh(cyl(0.05, 0.05, 2.8, 6), 0x9a94b2, 0, 1.4, 0));
      g.add(mesh(box(0.7, 1.1, 0.03), 0x4c6fd6, 0.38, 2.2, 0));
      const bean = mesh(sharedGeo('isl-bean', () => new THREE.CapsuleGeometry(0.3, 0.3, 6, 12)), COLORS.gold, 0.38, 2.25, 0.05, false);
      bean.scale.setScalar(0.4);
      g.add(bean);
      break;
    }
    case 'statue': { // a little grumble statue
      g.add(mesh(box(0.8, 0.4, 0.8), STONE, 0, 0.2, 0));
      const gr = makeGrumble(0xbdb8cf);
      gr.position.y = 0.4;
      g.add(gr);
      break;
    }
    case 'lantern': { // Bram's old ship lantern on a hook
      g.add(mesh(cyl(0.05, 0.05, 2.0, 5), 0x2b2340, 0, 1.0, 0));
      g.add(mesh(box(0.5, 0.06, 0.06), 0x2b2340, 0.22, 2.0, 0, false));
      g.add(mesh(box(0.28, 0.36, 0.28), M.lamp, 0.42, 1.7, 0, false));
      g.add(mesh(cone(0.22, 0.2, 4), 0x2b2340, 0.42, 1.98, 0, false).rotateY(Math.PI / 4));
      break;
    }
    case 'spyglass': {
      g.add(mesh(cyl(0.05, 0.08, 1.0, 6), WOOD_DARK, 0, 0.5, 0));
      const s = mesh(cyl(0.07, 0.11, 0.8, 10), COLORS.gold, 0, 1.1, 0.1);
      s.rotation.x = 1.0;
      g.add(s);
      break;
    }
    case 'rocket': { // toy rocket
      g.add(mesh(cyl(0.18, 0.22, 0.8, 12), 0xffffff, 0, 0.6, 0));
      g.add(mesh(cone(0.18, 0.35, 12), 0xff5d73, 0, 1.17, 0));
      for (let i = 0; i < 3; i++) g.add(mesh(box(0.04, 0.3, 0.2), 0x5b4fd8, Math.sin(i * 2.1) * 0.22, 0.3, Math.cos(i * 2.1) * 0.22).rotateY(i * 2.1));
      break;
    }
    case 'pumpkinLamp': {
      const p = mesh(sph(0.4, 14, 10), 0xff9f1c, 0, 0.32, 0);
      p.scale.set(1.15, 0.8, 1);
      g.add(p);
      g.add(mesh(box(0.1, 0.1, 0.05), M.lamp, -0.14, 0.4, 0.38, false), mesh(box(0.1, 0.1, 0.05), M.lamp, 0.14, 0.4, 0.38, false), mesh(box(0.3, 0.06, 0.05), M.lamp, 0, 0.2, 0.39, false));
      break;
    }
    case 'gnome': {
      g.add(mesh(cyl(0.2, 0.25, 0.4, 10), 0x4c8bd6, 0, 0.2, 0));
      g.add(mesh(sph(0.16, 10, 8), 0xffd6b0, 0, 0.5, 0));
      g.add(mesh(sph(0.14, 10, 8), 0xffffff, 0, 0.4, 0.08));
      g.add(mesh(cone(0.18, 0.45, 10), 0xff5d73, 0, 0.82, 0));
      break;
    }
    default:
      g.add(mesh(ico(0.3, 0), 0xc9a8ff, 0, 0.5, 0));
  }
  return g;
}
