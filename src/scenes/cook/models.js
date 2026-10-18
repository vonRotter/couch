import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { COLORS, toon, sharedGeo, faceted } from '../../core/palette.js';
import { ING } from './data.js';

// Cook-Off models: toon-primitive ingredients (raw / chopped / fried), plates, soups and the
// little station props, plus an icon renderer that turns any of them into a picture for the
// recipe cards (so the cards show exactly what the players see in the kitchen).

export const H = 0.72; // counter height (items rest on top)

// ---------- shared geometry helpers ----------
export const sph = (r, w = 14, h = 10) => sharedGeo(`ck-sph${r}|${w}`, () => new THREE.SphereGeometry(r, w, h));
export const ico = (r) => sharedGeo(`ck-ico${r}`, () => faceted(new THREE.IcosahedronGeometry(r, 1)));
export const cyl = (key, rt, rb, h, seg = 16) => sharedGeo(`ck-${key}`, () => new THREE.CylinderGeometry(rt, rb, h, seg));
export const rbox = (key, w, h, d, r = 0.05) => sharedGeo(`ck-${key}`, () => new RoundedBoxGeometry(w, h, d, 2, r));
export const dome = (key, r) => sharedGeo(`ck-${key}`, () => new THREE.SphereGeometry(r, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2));
const torus = (key, r, t, arc = Math.PI * 2) => sharedGeo(`ck-${key}`, () => new THREE.TorusGeometry(r, t, 8, 20, arc));
const cone = (key, r, h, seg = 12) => sharedGeo(`ck-${key}`, () => new THREE.ConeGeometry(r, h, seg));

export function mesh(geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

const GOLD = 0xf2b33d;     // fried golden
const GOLD_D = 0xd98f26;

/** A whole (raw) ingredient, sitting on y = 0. */
export function wholeMesh(kind) {
  const g = new THREE.Group();
  const col = ING[kind].color;
  switch (kind) {
    case 'tomato': {
      const b = mesh(sph(0.24), toon(col), 0, 0.21, 0);
      b.scale.y = 0.85;
      g.add(b, mesh(cyl('tleaf', 0.13, 0.13, 0.03, 5), toon(COLORS.leaf), 0, 0.41, 0), mesh(cyl('tstem', 0.025, 0.03, 0.1, 6), toon(COLORS.grassDark), 0, 0.45, 0));
      break;
    }
    case 'lettuce':
      g.add(mesh(ico(0.26), toon(col, { flat: true }), 0, 0.24, 0));
      g.add(mesh(ico(0.17), toon(0x9be27a, { flat: true }), 0.1, 0.36, 0.08));
      g.add(mesh(ico(0.15), toon(0x9be27a, { flat: true }), -0.12, 0.33, -0.04));
      break;
    case 'mushroom': {
      g.add(mesh(cyl('mstem', 0.09, 0.12, 0.24, 10), toon(COLORS.icing), 0, 0.12, 0));
      const cap = mesh(dome('mcap', 0.25), toon(col), 0, 0.2, 0);
      cap.scale.y = 0.8;
      g.add(cap);
      for (let i = 0; i < 3; i++) {
        const a = i * 2.1;
        const d = mesh(sph(0.045, 8, 6), toon(COLORS.white), Math.cos(a) * 0.14, 0.36, Math.sin(a) * 0.14);
        d.scale.y = 0.5;
        g.add(d);
      }
      break;
    }
    case 'onion': {
      const b = mesh(sph(0.23), toon(col), 0, 0.22, 0);
      b.scale.set(1, 0.9, 1);
      g.add(b);
      g.add(mesh(cone('otip', 0.11, 0.2, 10), toon(col), 0, 0.46, 0));
      g.add(mesh(cyl('osprout', 0.02, 0.03, 0.14, 6), toon(COLORS.leafLight), 0, 0.6, 0));
      // Pale stripes so it reads as an onion, not a plum.
      for (let i = 0; i < 3; i++) {
        const s = mesh(torus('ostripe', 0.2, 0.012, Math.PI), toon(0xe7c2f2), 0, 0.22, 0);
        s.rotation.set(0, i * 1.05, Math.PI / 2);
        g.add(s);
      }
      break;
    }
    case 'cheese': {
      // A wedge: a 3-sided cylinder lying on its side.
      const w = mesh(cyl('cwedge', 0.34, 0.34, 0.26, 3), toon(col), 0, 0.17, 0);
      w.rotation.set(Math.PI / 2, 0, 0);
      w.scale.set(1, 1, 0.75);
      g.add(w);
      for (const [x, y, z] of [[-0.08, 0.2, 0.135], [0.07, 0.12, 0.135], [0.02, 0.27, -0.135]]) {
        const h = mesh(sph(0.045, 8, 6), toon(0xe0a800), x, y, z);
        h.scale.z = 0.35;
        g.add(h);
      }
      break;
    }
    case 'bread': {
      g.add(mesh(rbox('loaf', 0.56, 0.3, 0.34, 0.14), toon(col), 0, 0.16, 0));
      const top = mesh(rbox('loafTop', 0.5, 0.12, 0.3, 0.06), toon(0xc9843f), 0, 0.29, 0);
      g.add(top);
      for (const x of [-0.14, 0, 0.14]) {
        const cut = mesh(rbox('loafCut', 0.04, 0.03, 0.26, 0.01), toon(0xffe0b0), x, 0.355, 0);
        cut.rotation.y = 0.4;
        g.add(cut);
      }
      break;
    }
    case 'fish': {
      const body = mesh(sph(0.22), toon(col), 0, 0.17, 0);
      body.scale.set(1.35, 0.7, 0.55);
      g.add(body);
      const belly = mesh(sph(0.16), toon(0xdff1ff), 0.02, 0.12, 0);
      belly.scale.set(1.5, 0.5, 0.62);
      g.add(belly);
      const tail = mesh(cone('ftail', 0.15, 0.2, 4), toon(0x3d86c8), -0.36, 0.17, 0);
      tail.rotation.z = -Math.PI / 2;
      tail.scale.z = 0.35;
      g.add(tail);
      for (const sd of [-1, 1]) {
        g.add(mesh(sph(0.04, 8, 6), toon(COLORS.white), 0.18, 0.21, sd * 0.1));
        g.add(mesh(sph(0.022, 6, 5), toon(COLORS.ink), 0.2, 0.21, sd * 0.12));
      }
      break;
    }
    case 'carrot': {
      const c = mesh(cone('carrot', 0.13, 0.5, 12), toon(col), 0.04, 0.13, 0);
      c.rotation.z = Math.PI / 2;
      g.add(c);
      for (const a of [-0.5, 0, 0.5]) {
        const l = mesh(cone('cleaf', 0.05, 0.22, 5), toon(COLORS.leaf), -0.27, 0.16 + Math.cos(a) * 0.04, a * 0.12);
        l.rotation.set(a, 0, Math.PI / 2 + 0.5);
        g.add(l);
      }
      break;
    }
    case 'potato': {
      const p = mesh(ico(0.22), toon(col, { flat: true }), 0, 0.17, 0);
      p.scale.set(1.25, 0.78, 0.95);
      g.add(p);
      for (const [x, z] of [[0.12, 0.12], [-0.1, 0.15], [0.02, -0.17]]) g.add(mesh(sph(0.03, 6, 5), toon(0x9b7440), x, 0.24, z));
      break;
    }
    case 'egg': {
      for (const [x, z, r] of [[-0.12, 0.02, 0.2], [0.14, -0.05, -0.3]]) {
        const e = mesh(sph(0.15), toon(col), x, 0.17, z);
        e.scale.set(0.85, 1.15, 0.85);
        e.rotation.z = r;
        g.add(e);
      }
      break;
    }
    case 'berries': {
      // A little basket of blueberries with two pink raspberries.
      g.add(mesh(cyl('bbask', 0.28, 0.22, 0.16, 14), toon(0xd7a46b), 0, 0.08, 0));
      const pos = [[0, 0.22, 0], [0.13, 0.19, 0.06], [-0.12, 0.19, 0.08], [0.05, 0.19, -0.13], [-0.08, 0.2, -0.1], [0.14, 0.2, -0.08]];
      pos.forEach(([x, y, z], i) => g.add(mesh(sph(0.075, 10, 8), toon(i === 2 || i === 5 ? 0xff5d9e : ING.berries.color), x, y, z)));
      break;
    }
    case 'banana': {
      // A smiling arc with brown tips, tilted a little so it reads from above.
      const arc = 2.1, mid = -Math.PI / 2, y0 = 0.315;
      const bn = new THREE.Group();
      const b = mesh(torus('banana', 0.24, 0.075, arc), toon(col), 0, y0, 0);
      b.rotation.z = mid - arc / 2;
      bn.add(b);
      for (const a of [mid - arc / 2, mid + arc / 2]) bn.add(mesh(sph(0.045, 8, 6), toon(0x7a5230), Math.cos(a) * 0.24, y0 + Math.sin(a) * 0.24, 0));
      bn.rotation.set(-0.5, 0.3, 0);
      bn.position.z = 0.1;
      g.add(bn);
      break;
    }
    default:
      g.add(mesh(sph(0.2), toon(col), 0, 0.2, 0));
  }
  return g;
}

/** A small pile of chopped pieces. */
export function choppedMesh(kind) {
  const g = new THREE.Group();
  const col = ING[kind].color;
  const ring = (n, rad, fn) => { for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + 0.4; fn(Math.cos(a) * rad, Math.sin(a) * rad, a, i); } };
  switch (kind) {
    case 'tomato':
      ring(3, 0.13, (x, z, a) => {
        const s = mesh(cyl('tslice', 0.12, 0.12, 0.06, 14), toon(col), x, 0.03, z);
        s.add(mesh(cyl('tslicein', 0.09, 0.09, 0.07, 14), toon(0xff9a8a)));
        s.rotation.set(0.25, a, 0.2);
        g.add(s);
      });
      break;
    case 'lettuce':
      ring(4, 0.13, (x, z, a, i) => {
        const l = mesh(ico(0.12), toon(i % 2 ? 0x9be27a : col, { flat: true }), x, 0.05, z);
        l.scale.y = 0.45;
        g.add(l);
      });
      break;
    case 'mushroom':
      ring(3, 0.13, (x, z) => {
        const c = mesh(dome('mslice', 0.11), toon(col), x, 0.04, z);
        c.scale.y = 0.55;
        c.add(mesh(rbox('mbit', 0.07, 0.1, 0.07, 0.02), toon(COLORS.icing), 0, -0.04, 0));
        g.add(c);
      });
      break;
    case 'onion':
      ring(3, 0.12, (x, z, a, i) => {
        const r = mesh(torus('oring', 0.09, 0.03), toon(i % 2 ? 0xe7c2f2 : col), x, 0.03 + i * 0.02, z);
        r.rotation.x = Math.PI / 2;
        g.add(r);
      });
      break;
    case 'cheese':
      ring(4, 0.12, (x, z, a) => {
        const c = mesh(rbox('ccube', 0.13, 0.13, 0.13, 0.02), toon(col), x, 0.065, z);
        c.rotation.y = a;
        g.add(c);
      });
      break;
    case 'bread':
      for (let i = 0; i < 2; i++) {
        const s = mesh(rbox('bslice', 0.36, 0.07, 0.32, 0.03), toon(0x9e6330), i * 0.05, 0.04 + i * 0.075, i * 0.03);
        s.add(mesh(rbox('bsliceIn', 0.3, 0.075, 0.26, 0.03), toon(0xffe0b0)));
        s.rotation.y = i * 0.35;
        g.add(s);
      }
      break;
    case 'fish':
      ring(3, 0.12, (x, z, a) => {
        const f = mesh(rbox('fpiece', 0.18, 0.08, 0.12, 0.03), toon(0xffb8a8), x, 0.04, z);
        f.rotation.y = a;
        f.add(mesh(rbox('fskin', 0.18, 0.03, 0.125, 0.012), toon(col), 0, -0.035, 0));
        g.add(f);
      });
      break;
    case 'carrot':
      ring(4, 0.12, (x, z, a, i) => {
        const c = mesh(cyl('ccoin', 0.08, 0.08, 0.05, 12), toon(col), x, 0.025 + (i % 2) * 0.03, z);
        c.add(mesh(cyl('ccoinIn', 0.04, 0.04, 0.055, 10), toon(0xffb066)));
        c.rotation.z = 0.15;
        g.add(c);
      });
      break;
    case 'potato':
      ring(5, 0.08, (x, z, a, i) => {
        const s = mesh(rbox('pstick', 0.06, 0.06, 0.28, 0.015), toon(0xfbe7a8), x, 0.03 + (i % 2) * 0.05, z);
        s.rotation.y = a;
        g.add(s);
      });
      break;
    case 'banana':
      ring(4, 0.12, (x, z, a, i) => {
        const c = mesh(cyl('bcoin', 0.08, 0.08, 0.05, 12), toon(0xfff2b8), x, 0.025 + (i % 2) * 0.03, z);
        c.add(mesh(torus('bcoinRim', 0.08, 0.012), toon(col)).rotateX(Math.PI / 2));
        g.add(c);
      });
      break;
    default:
      return wholeMesh(kind);
  }
  return g;
}

/** Golden fried food (or a fried egg). */
export function friedMesh(kind) {
  const g = new THREE.Group();
  switch (kind) {
    case 'egg': {
      const w = mesh(cyl('eggW', 0.26, 0.28, 0.04, 18), toon(COLORS.white), 0, 0.02, 0);
      w.scale.set(1.1, 1, 0.9);
      g.add(w);
      const y = mesh(dome('eggY', 0.1), toon(0xffb81f), 0.03, 0.04, -0.02);
      y.scale.y = 0.75;
      g.add(y);
      break;
    }
    case 'fish': {
      const f = mesh(rbox('ffillet', 0.46, 0.13, 0.24, 0.06), toon(GOLD), 0, 0.07, 0);
      f.rotation.y = 0.3;
      g.add(f);
      for (const [x, z] of [[-0.1, 0.05], [0.08, -0.04], [0.14, 0.07]]) g.add(mesh(sph(0.03, 6, 5), toon(GOLD_D), x, 0.14, z));
      break;
    }
    case 'potato':
      for (let i = 0; i < 6; i++) {
        const s = mesh(rbox('chip', 0.065, 0.065, 0.32, 0.02), toon(i % 2 ? GOLD : 0xf7c95a), (i % 3 - 1) * 0.08, 0.035 + Math.floor(i / 3) * 0.06, (i % 2) * 0.04);
        s.rotation.y = (i - 2.5) * 0.35;
        g.add(s);
      }
      break;
    case 'onion':
      for (let i = 0; i < 3; i++) {
        const r = mesh(torus('oringF', 0.11, 0.045), toon(i % 2 ? GOLD_D : GOLD), (i - 1) * 0.12, 0.045 + (i === 1 ? 0.05 : 0), (i - 1) * 0.04);
        r.rotation.x = Math.PI / 2 + (i - 1) * 0.3;
        g.add(r);
      }
      break;
    case 'mushroom':
      for (let i = 0; i < 3; i++) {
        const a = i * 2.1 + 0.4;
        const c = mesh(dome('mslice', 0.11), toon(0x8a5532), Math.cos(a) * 0.12, 0.04, Math.sin(a) * 0.12);
        c.scale.y = 0.55;
        c.add(mesh(rbox('mbitF', 0.07, 0.1, 0.07, 0.02), toon(0xf0c890), 0, -0.04, 0));
        g.add(c);
      }
      break;
    default: {
      const c = choppedMesh(kind);
      g.add(c);
    }
  }
  return g;
}

/** Any loose ingredient item. */
export function partMesh(kind, state) {
  if (state === 'fried') return friedMesh(kind);
  if (state === 'chopped') return choppedMesh(kind);
  return wholeMesh(kind);
}

/** Bowl of soup (sits on y = 0). */
export function soupMesh(kind, withPlate = true) {
  const g = new THREE.Group();
  if (withPlate) g.add(mesh(cyl('plate', 0.42, 0.34, 0.07, 24), toon(COLORS.white), 0, 0.035, 0));
  g.add(mesh(cyl('bowl', 0.3, 0.2, 0.24, 20), toon(COLORS.cream), 0, 0.19, 0));
  g.add(mesh(cyl('soupTop', 0.26, 0.26, 0.03, 20), toon(ING[kind].soup), 0, 0.3, 0));
  const bit = choppedMesh(kind);
  bit.scale.setScalar(0.45);
  bit.position.set(0.02, 0.31, 0);
  g.add(bit);
  g.add(mesh(sph(0.04, 8, 6), toon(COLORS.leaf), 0.1, 0.32, -0.08));
  return g;
}

// Where parts sit on a plate, by how many there are.
const SPOTS = [[[0, 0]], [[-0.14, 0.02], [0.14, -0.02]], [[-0.15, 0.08], [0.15, 0.08], [0, -0.14]]];

/** Plate with whatever is on it: { parts: ['kind:state'], soup }. */
export function plateMesh(plate) {
  if (plate.soup) return soupMesh(plate.soup);
  const g = new THREE.Group();
  g.add(mesh(cyl('plate', 0.42, 0.34, 0.07, 24), toon(COLORS.white), 0, 0.035, 0));
  g.add(mesh(cyl('plateIn', 0.3, 0.3, 0.075, 24), toon(0xe9f4ff), 0, 0.036, 0));
  const n = plate.parts.length;
  plate.parts.forEach((p, i) => {
    const [k, s] = p.split(':');
    const m = partMesh(k, s);
    m.scale.setScalar(n === 1 ? 0.9 : n === 2 ? 0.72 : 0.62);
    const [x, z] = SPOTS[Math.min(n, 3) - 1][i] || [0, 0];
    m.position.set(x, 0.07, z);
    g.add(m);
  });
  return g;
}

// ---------- station props (also used for icons) ----------
export function boardProp() {
  const g = new THREE.Group();
  g.add(mesh(rbox('board', 1.0, 0.07, 0.8, 0.03), toon(0xf3d39b), 0, 0.035, 0));
  g.add(mesh(rbox('boardGroove', 0.85, 0.075, 0.03, 0.01), toon(0xd9ae6c), 0, 0.036, 0.32));
  return g;
}

export function knifeProp() {
  const k = new THREE.Group();
  k.add(mesh(rbox('kHandle', 0.07, 0.07, 0.2, 0.02), toon(COLORS.trunk), 0, 0, 0));
  k.add(mesh(rbox('kBlade', 0.03, 0.12, 0.3, 0.015), toon(0xdfe6f2), 0, -0.02, 0.24));
  return k;
}

/** Frying pan (sits on y = 0; the food goes at y ≈ 0.07). */
export function panProp() {
  const g = new THREE.Group();
  g.add(mesh(cyl('panB', 0.4, 0.34, 0.1, 22), toon(0x3d3852), 0, 0.05, 0));
  g.add(mesh(cyl('panIn', 0.35, 0.35, 0.105, 22), toon(0x5d5778), 0, 0.052, 0));
  const h = mesh(rbox('panH', 0.5, 0.06, 0.09, 0.03), toon(COLORS.trunk), 0.62, 0.09, 0);
  g.add(h);
  return g;
}

export function potProp() {
  const g = new THREE.Group();
  const potMat = new THREE.MeshToonMaterial({ color: 0xb9c3d6, gradientMap: toon(0xffffff).gradientMap, side: THREE.DoubleSide });
  g.add(mesh(new THREE.CylinderGeometry(0.46, 0.4, 0.46, 24, 1, true), potMat, 0, 0.27, 0));
  g.add(mesh(cyl('potBottom', 0.4, 0.4, 0.04, 24), toon(0x6d7488), 0, 0.06, 0));
  g.add(mesh(new THREE.TorusGeometry(0.46, 0.04, 8, 28).rotateX(Math.PI / 2), toon(0xdfe6f2), 0, 0.5, 0));
  for (const sd of [-1, 1]) g.add(mesh(rbox('handle', 0.18, 0.06, 0.16, 0.03), toon(0x3d3852), sd * 0.55, 0.42, 0));
  return g;
}

// ---------- icons ----------
const ICONS = new Map();
let iconRig = null;

/** Build the meshes for an icon key. */
function iconObject(key) {
  const [type, a, b] = key.split(':');
  switch (type) {
    case 'part': return partMesh(a, b);
    case 'plate': return plateMesh({ parts: a ? a.split(',').map((p) => p.replace('.', ':')) : [], soup: null });
    case 'soup': return soupMesh(a);
    case 'board': { const g = boardProp(); const k = knifeProp(); k.position.set(0.05, 0.12, -0.05); k.rotation.set(0, 0.9, 0); g.add(k); return g; }
    case 'pan': { const g = panProp(); const f = friedMesh('egg'); f.position.y = 0.07; g.add(f); return g; }
    case 'pot': { const g = potProp(); const f = mesh(cyl('fill', 0.42, 0.42, 0.05, 24), toon(0xff6a3d), 0, 0.4, 0); g.add(f); return g; }
    default: return new THREE.Group();
  }
}

/** Linear 0..255 to sRGB 0..255 (render targets are linear). */
const LUT = Array.from({ length: 256 }, (_, i) => {
  const c = i / 255;
  return Math.round(255 * (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055));
});

/**
 * Picture (data URL) of a model, rendered once with the game's renderer and cached.
 * Keys: part:kind:state · soup:kind · plate:kind.state,kind.state · board · pan · pot
 */
export function icon(renderer, key) {
  if (ICONS.has(key)) return ICONS.get(key);
  const S = 160;
  if (!iconRig) {
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xffffff, 0xb9a6d8, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 2.2);
    sun.position.set(-1.2, 3, 2);
    scene.add(sun);
    const camera = new THREE.PerspectiveCamera(26, 1, 0.05, 50);
    const target = new THREE.WebGLRenderTarget(S, S);
    const canvas = document.createElement('canvas');
    canvas.width = S; canvas.height = S;
    const small = document.createElement('canvas');
    small.width = S / 2; small.height = S / 2;
    iconRig = { scene, camera, target, canvas, small, pixels: new Uint8Array(S * S * 4) };
  }
  const { scene, camera, target, canvas, small, pixels } = iconRig;
  const obj = iconObject(key);
  scene.add(obj);
  // Frame the object from the same high angle as the game camera.
  const box = new THREE.Box3().setFromObject(obj);
  const sphere = box.getBoundingSphere(new THREE.Sphere());
  const dist = (sphere.radius * 1.08) / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2));
  const dir = new THREE.Vector3(0, Math.sin(0.85), Math.cos(0.85));
  camera.position.copy(sphere.center).addScaledVector(dir, dist);
  camera.lookAt(sphere.center);

  const prevTarget = renderer.getRenderTarget();
  const prevColor = renderer.getClearColor(new THREE.Color());
  const prevAlpha = renderer.getClearAlpha();
  const prevShadow = renderer.shadowMap.enabled;
  renderer.shadowMap.enabled = false;
  renderer.setRenderTarget(target);
  renderer.setClearColor(0x000000, 0);
  renderer.clear();
  renderer.render(scene, camera);
  renderer.readRenderTargetPixels(target, 0, 0, S, S, pixels);
  renderer.setRenderTarget(prevTarget);
  renderer.setClearColor(prevColor, prevAlpha);
  renderer.shadowMap.enabled = prevShadow;
  scene.remove(obj);

  // Flip vertically and convert to sRGB, then shrink by half for smooth edges.
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(S, S);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const si = ((S - 1 - y) * S + x) * 4, di = (y * S + x) * 4;
      const al = pixels[si + 3];
      img.data[di] = LUT[pixels[si]];
      img.data[di + 1] = LUT[pixels[si + 1]];
      img.data[di + 2] = LUT[pixels[si + 2]];
      img.data[di + 3] = al;
    }
  }
  ctx.putImageData(img, 0, 0);
  const sctx = small.getContext('2d');
  sctx.clearRect(0, 0, S / 2, S / 2);
  sctx.imageSmoothingQuality = 'high';
  sctx.drawImage(canvas, 0, 0, S / 2, S / 2);
  const url = small.toDataURL('image/png');
  ICONS.set(key, url);
  return url;
}

/** <img> tag for an icon, sized in em. */
export function iconImg(renderer, key, em = 2, extra = '') {
  return `<img src="${icon(renderer, key)}" style="width:${em}em;height:${em}em;vertical-align:middle;${extra}" alt="">`;
}
