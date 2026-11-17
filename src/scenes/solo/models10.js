import * as THREE from 'three';
import { toon, sharedGeo, faceted } from '../../core/palette.js';
import { mesh, box, cyl, sph, cone, ico, WOOD_DARK } from './models.js';
import { makeArcadeEmblem } from '../arcade/emblems.js';

// The classic games round's world models (solo/puzzles.js): the three puzzle doors (one in the cliff behind Aunt
// Hazel's, one in a mossy boulder on the east shore, one in a giant old stump in the west wood), the puzzle lock
// that floats over a chest or a door while its puzzle waits, the prizes behind them (yard keepsakes) and the
// puzzle trophy for the shelf. Doors face +z; their standing spot is about 1.4 in front.

const STONE = 0xb9b3c9, STONE_D = 0x948eaa, MOSS = 0x7fbf5a;
const tor = (r, t) => sharedGeo(`p10-tor${r}|${t}`, () => new THREE.TorusGeometry(r, t, 8, 20));
const half = (r) => sharedGeo(`p10-half${r}`, () => new THREE.CylinderGeometry(r, r, 0.14, 18, 1, false, 0, Math.PI));

/** The door leaf: a wooden round-topped door on a hinge (userData.leaf swings open on y). */
function doorLeaf(w = 1.1, h = 1.6, color = 0x9a6440) {
  const hinge = new THREE.Group();
  const leaf = new THREE.Group();
  leaf.add(mesh(box(w, h - w / 2, 0.14), color, w / 2, (h - w / 2) / 2, 0));
  const top = mesh(half(w / 2), color, w / 2, h - w / 2, 0);
  top.rotation.x = Math.PI / 2;
  top.rotation.y = Math.PI / 2;
  leaf.add(top);
  for (const y of [0.35, h - w / 2 - 0.2]) leaf.add(mesh(box(w * 0.92, 0.08, 0.18), 0x5a4a3a, w / 2, y, 0, false));
  leaf.add(mesh(sph(0.06, 8, 6), 0xffd23f, w * 0.85, (h - w / 2) * 0.55, 0.1, false));
  hinge.add(leaf);
  hinge.position.x = -w / 2;
  return hinge;
}

/** What is behind a door: a little lit nook with a pedestal (the prize stands on it until it is taken). */
function nook(w, h) {
  const g = new THREE.Group();
  g.add(mesh(box(w + 0.1, h + 0.1, 0.8), 0x2b2340, 0, h / 2, -0.45, false));
  const lightM = toon(0xffe9a8, { emissive: 0x7a5a10 });
  g.add(mesh(box(w * 0.8, 0.06, 0.6), lightM, 0, h - 0.15, -0.45, false));
  g.add(mesh(cyl(0.22, 0.26, 0.4, 10), STONE, 0, 0.2, -0.45));
  return g;
}

/** A puzzle door: kind 'cliff' | 'rock' | 'tree'. userData: leaf (hinge), lock (where the puzzle lock floats), prize (a spot on the pedestal). */
export function makePuzzleDoor(kind) {
  const g = new THREE.Group();
  const w = 1.1, h = 1.7;
  if (kind === 'cliff') {
    // a stone arch set into the cliff, with a lantern hook
    for (const sx of [-1, 1]) g.add(mesh(box(0.4, h + 0.2, 0.5), STONE_D, sx * (w / 2 + 0.2), (h + 0.2) / 2, 0.05));
    g.add(mesh(box(w + 0.8, 0.45, 0.55), STONE, 0, h + 0.3, 0.05));
    g.add(mesh(box(2.6, 2.8, 0.6), 0xa48d74, 0, 1.4, -0.75));
    g.add(mesh(box(0.08, 0.5, 0.08), 0x5a4a3a, w / 2 + 0.55, 1.6, 0.35, false));
  } else if (kind === 'rock') {
    // a huge mossy boulder with a round door
    const b = mesh(sharedGeo('p10-boulder', () => faceted(new THREE.IcosahedronGeometry(2.0, 1))), STONE, 0, 1.2, -1.75);
    b.scale.set(1.25, 0.95, 0.75);
    g.add(b);
    const moss = mesh(sph(1.2, 10, 8), MOSS, 0.3, 2.6, -1.9, false);
    moss.scale.set(1.2, 0.35, 1);
    g.add(moss);
    g.add(mesh(box(1.5, 2.1, 0.5), STONE_D, 0, 1.05, -0.2));
  } else {
    // a giant old stump with roots and a little door in its side
    g.add(mesh(sharedGeo('p10-stump', () => faceted(new THREE.CylinderGeometry(1.9, 2.3, 2.9, 12))), 0x8a5a32, 0, 1.45, -2.35));
    g.add(mesh(cyl(1.75, 1.75, 0.08, 12), 0xd8a874, 0, 2.92, -2.35, false));
    for (let i = 0; i < 5; i++) { const a = i * 1.25 + 0.3; const r = mesh(box(0.35, 0.3, 1.6), 0x7a4a2a, Math.cos(a) * 2.1, 0.12, -2.35 + Math.sin(a) * 2.1); r.rotation.y = -a; g.add(r); }
    g.add(mesh(sph(0.3, 10, 8), 0xff5d73, 1.0, 3.05, -1.9), mesh(cyl(0.08, 0.1, 0.25, 8), 0xfff3dc, 1.0, 2.95, -1.9));
    g.add(mesh(box(1.5, 2.1, 0.6), 0x7a4a2a, 0, 1.05, -0.25));
  }
  g.add(nook(w, h));
  const leaf = doorLeaf(w, h, kind === 'tree' ? 0x5a8a3a : kind === 'rock' ? 0x4a7ab0 : 0x9a6440);
  leaf.position.z = 0.08;
  g.add(leaf);
  g.userData.leaf = leaf;
  g.userData.lock = new THREE.Vector3(0, h + (kind === 'cliff' ? 0.9 : 0.75), 0.45);
  g.userData.prize = new THREE.Vector3(0, 0.4, -0.45);
  return g;
}

/** The puzzle lock that floats over a chest or a door while its puzzle waits: a ring with the game's emblem. */
export function makePuzzleLock(game) {
  const g = new THREE.Group();
  const ring = mesh(tor(0.42, 0.07), toon(0xffd23f, { emissive: 0x6a5000 }), 0, 0, 0, false);
  g.add(ring);
  g.add(mesh(cyl(0.36, 0.36, 0.06, 20), toon(0x2b2340), 0, 0, -0.02, false).rotateX(Math.PI / 2));
  const em = makeArcadeEmblem(game);
  em.scale.setScalar(0.45);
  em.position.set(0, -0.15, 0.06);
  g.add(em);
  const glow = new THREE.Mesh(sph(0.62, 14, 10), new THREE.MeshBasicMaterial({ color: 0xffe27a, transparent: true, opacity: 0.18, depthWrite: false }));
  g.add(glow);
  g.userData.glow = glow;
  return g;
}

// ---------- the prizes (yard keepsakes, ANYWHERE in build.js) and the trophy ----------

export const DECO10 = new Set(['minerLamp', 'sleepyLantern', 'bellChime', 'shipBottle', 'blockTower', 'acornLamp', 'wormPlush', 'spaceRock', 'puzzleTrophy']);

export function makeDeco10(id) {
  const g = new THREE.Group();
  switch (id) {
    case 'minerLamp': {
      g.add(mesh(cyl(0.22, 0.26, 0.1, 10), 0x5a4a3a, 0, 0.05, 0), mesh(cyl(0.16, 0.16, 0.4, 10), toon(0xffd23f, { emissive: 0x7a5a10 }), 0, 0.3, 0));
      g.add(mesh(cyl(0.2, 0.2, 0.06, 10), 0x5a4a3a, 0, 0.52, 0), mesh(tor(0.14, 0.025), 0x5a4a3a, 0, 0.66, 0));
      break;
    }
    case 'sleepyLantern': {
      g.add(mesh(cyl(0.06, 0.08, 0.9, 8), 0x5a4a3a, 0, 0.45, 0), mesh(cyl(0.2, 0.2, 0.34, 12), 0x2b3a70, 0, 1.05, 0), mesh(cone(0.26, 0.2, 12), 0x5a4a3a, 0, 1.32, 0));
      g.add(mesh(sph(0.08, 8, 6), 0xdfe6ff, 0, 1.06, 0.2));
      break;
    }
    case 'bellChime': {
      g.add(mesh(box(0.08, 1.2, 0.08), WOOD_DARK, 0, 0.6, 0), mesh(box(0.9, 0.08, 0.08), WOOD_DARK, 0, 1.2, 0));
      [0xffc93c, 0x3ddc97, 0x4cc9f0, 0xff5d73].forEach((c, i) => g.add(mesh(cone(0.11, 0.18, 10), c, -0.33 + i * 0.22, 1.02, 0)));
      break;
    }
    case 'shipBottle': {
      const glass = mesh(cyl(0.16, 0.16, 0.55, 12), toon(0xbff6ff, { transparent: true, opacity: 0.55 }), 0, 0.16, 0);
      glass.rotation.z = Math.PI / 2;
      g.add(glass, mesh(cyl(0.06, 0.08, 0.14, 8), 0x8a5a32, 0.34, 0.16, 0).rotateZ(Math.PI / 2));
      g.add(mesh(box(0.28, 0.06, 0.1), 0x9a6440, 0, 0.1, 0), mesh(cone(0.08, 0.16, 3), 0xffffff, 0, 0.21, 0));
      break;
    }
    case 'blockTower': {
      const cols = [0xff9f1c, 0x4cc9f0, 0x9b5de5, 0x3ddc97, 0xffd23f];
      cols.forEach((c, i) => { const b = mesh(box(0.26, 0.26, 0.26), c, (i % 2 ? 0.08 : -0.06), 0.13 + i * 0.26, 0); b.rotation.y = i * 0.3; g.add(b); });
      break;
    }
    case 'acornLamp': {
      g.add(mesh(sph(0.28, 12, 10), toon(0xffc46a, { emissive: 0x6a3a00 }), 0, 0.3, 0));
      g.add(mesh(cyl(0.03, 0.03, 0.14, 6), 0x5a4a3a, 0, 0.72, 0));
      const cap = mesh(sph(0.3, 12, 8), 0x8a5a32, 0, 0.5, 0);
      cap.scale.set(1, 0.55, 1);
      g.add(cap);
      break;
    }
    case 'wormPlush': {
      for (let i = 0; i < 4; i++) g.add(mesh(sph(0.16 - i * 0.015, 10, 8), i % 2 ? 0x6aa82a : 0x8ac926, -0.24 * i, 0.15, Math.sin(i) * 0.08));
      g.add(mesh(sph(0.19, 10, 8), 0xa8e04a, 0.22, 0.2, 0));
      for (const s of [-1, 1]) g.add(mesh(sph(0.045, 6, 4), 0x2b2340, 0.36, 0.26, s * 0.07));
      break;
    }
    case 'spaceRock': {
      const r = mesh(ico(0.3, 0), toon(0xb39ad8, { emissive: 0x3a2060 }), 0, 0.32, 0);
      r.rotation.set(0.4, 0.7, 0.2);
      g.add(mesh(cyl(0.22, 0.28, 0.12, 10), STONE_D, 0, 0.06, 0), r);
      break;
    }
    case 'puzzleTrophy': {
      g.add(mesh(box(0.34, 0.08, 0.26), WOOD_DARK, 0, 0.04, 0), mesh(cyl(0.05, 0.07, 0.18, 8), 0xffd23f, 0, 0.17, 0));
      const pcs = [[0x4cc9f0, -1, -1], [0xff5d73, 1, -1], [0x3ddc97, -1, 1], [0xffd23f, 1, 1]];
      for (const [c, x, y] of pcs) g.add(mesh(box(0.12, 0.12, 0.08), c, x * 0.065, 0.36 + y * 0.065, 0));
      break;
    }
    default: g.add(mesh(sph(0.2, 10, 8), 0xff9fd0, 0, 0.2, 0));
  }
  return g;
}

