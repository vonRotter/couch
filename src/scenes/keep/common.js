import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { sharedGeo } from '../../core/palette.js';

// Shared constants and little mesh helpers for Pillow Keep (keep.js and keep/*.js).

export const CELL = 2; // world size of one map tile
export const WALL_H = 1.5;
export const PR = 0.42; // player radius
export const GR = 0.4; // grumble radius (times its size)
export const SPEED = 6;
export const CLASSES = ['knight', 'archer', 'wizard', 'bard'];
export const GLYPH = { knight: '♜', archer: '➶', wizard: '✦', bard: '♪' };
// Diablo-style rarity colors: white (cozy), blue (magic), gold (legendary).
export const RARITY_CSS = ['#f4f1ea', '#4c8dff', '#ffb400'];
export const RARITY_HEX = [0xf4f1ea, 0x4c8dff, 0xffb400];

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const angDiff = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
export const clock = (s) => {
  const secs = Math.max(0, Math.floor(s));
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
};

/** Small seeded random generator (mulberry32): the same seed always builds the same dungeon. */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const sph = (r, w = 14, h = 10) => sharedGeo(`kSph${r}|${w}`, () => new THREE.SphereGeometry(r, w, h));
export const rbox = (key, w, h, d, r = 0.08) => sharedGeo(`k-${key}`, () => new RoundedBoxGeometry(w, h, d, 2, r));
export const bx = (key, w, h, d) => sharedGeo(`kb-${key}`, () => new THREE.BoxGeometry(w, h, d));
export const cyl = (key, rt, rb, h, seg = 14) => sharedGeo(`kc-${key}`, () => new THREE.CylinderGeometry(rt, rb, h, seg));
export const cone = (key, r, h, seg = 12) => sharedGeo(`kco-${key}`, () => new THREE.ConeGeometry(r, h, seg));

export function mesh(geo, mat, x = 0, y = 0, z = 0, shadow = true) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = shadow;
  return m;
}

/** A fresh (unshared) see-through material for effects that fade out. */
export function fadeMat(color, opacity = 0.6) {
  return new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide });
}

export function disposeTree(obj) {
  obj.traverse((o) => {
    if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose();
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of mats) if (!m.userData.shared) m.dispose();
  });
}
