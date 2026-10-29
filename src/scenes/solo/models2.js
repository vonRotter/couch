import * as THREE from 'three';
import { COLORS, toon } from '../../core/palette.js';
import { mesh, box, cyl, sph, cone, ico, WOOD, WOOD_DARK, makeLamp, makeBench, makeFencePost } from './models.js';

// Milestone B2 models: farm animals, crafted yard pieces, furniture, new decorations and festival props.

const INK = COLORS.ink;

// ---------- animals (face +z) ----------

export function makeChicken(color = 0xffffff) {
  const g = new THREE.Group();
  const body = mesh(sph(0.26, 10, 8), color, 0, 0.3, 0);
  body.scale.set(0.9, 0.9, 1.2);
  g.add(body, mesh(sph(0.16, 10, 8), color, 0, 0.55, 0.2));
  g.add(mesh(box(0.05, 0.12, 0.12), 0xff5d73, 0, 0.72, 0.2, false), mesh(cone(0.05, 0.13, 5), 0xffb020, 0, 0.53, 0.37, false).rotateX(Math.PI / 2));
  for (const s of [-1, 1]) {
    g.add(mesh(sph(0.03, 6, 4), INK, s * 0.08, 0.6, 0.32, false));
    const w = mesh(sph(0.14, 8, 6), color, s * 0.22, 0.32, -0.02);
    w.scale.set(0.35, 0.7, 1);
    g.add(w, mesh(cyl(0.02, 0.02, 0.18, 4), 0xffb020, s * 0.08, 0.08, 0, false));
  }
  g.add(mesh(cone(0.12, 0.2, 5), color, 0, 0.42, -0.3).rotateX(-0.9));
  return g;
}

export function makeCow(goat = false) {
  const g = new THREE.Group();
  const col = goat ? 0xe8e0d0 : 0xffffff;
  const s = goat ? 0.7 : 1;
  const body = mesh(box(0.9, 0.7, 1.5), col, 0, 0.95, 0);
  g.add(body);
  if (!goat) for (const [x, y, z] of [[0.46, 1.0, 0.2], [-0.46, 0.9, -0.3], [0.2, 1.31, -0.4], [-0.3, 1.1, 0.5]]) g.add(mesh(box(0.06, 0.35, 0.4), INK, x, y, z, false));
  for (const [x, z] of [[-0.3, 0.55], [0.3, 0.55], [-0.3, -0.55], [0.3, -0.55]]) g.add(mesh(cyl(0.1, 0.09, 0.6, 6), col, x, 0.3, z), mesh(cyl(0.11, 0.11, 0.1, 6), INK, x, 0.04, z, false));
  const head = new THREE.Group();
  head.add(mesh(box(0.55, 0.5, 0.55), col, 0, 0, 0), mesh(box(0.45, 0.28, 0.2), goat ? 0xd8c8b0 : 0xffb8c8, 0, -0.1, 0.32));
  for (const sx of [-1, 1]) {
    head.add(mesh(sph(0.05, 6, 5), INK, sx * 0.15, 0.08, 0.28, false));
    head.add(mesh(cone(0.05, goat ? 0.3 : 0.18, 5), 0xf3e8d0, sx * 0.18, 0.33, -0.05).rotateZ(-sx * (goat ? 0.5 : 0.3)));
    const ear = mesh(box(0.22, 0.06, 0.12), col, sx * 0.36, 0.1, 0);
    ear.rotation.z = sx * 0.3;
    head.add(ear);
  }
  if (goat) head.add(mesh(cone(0.07, 0.2, 5), 0xd8c8b0, 0, -0.32, 0.2).rotateX(Math.PI));
  else head.add(mesh(cyl(0.08, 0.08, 0.08, 8), COLORS.gold, 0, -0.38, 0.12, false));
  head.position.set(0, 1.25, 0.9);
  g.add(head, mesh(cyl(0.03, 0.02, 0.5, 4), col, 0, 0.95, -0.8, false).rotateX(0.4));
  g.userData.head = head;
  g.scale.setScalar(s);
  return g;
}

// ---------- crafted yard pieces ----------

export function makeCraft(id, M) {
  const g = new THREE.Group();
  switch (id) {
    case 'fence': {
      for (const x of [-0.5, 0.5]) { const p = makeFencePost(); p.position.x = x; g.add(p); }
      for (const y of [0.35, 0.7]) g.add(mesh(box(1.0, 0.1, 0.06), 0xe2b06a, 0, y, 0));
      break;
    }
    case 'pathStone':
      for (const [x, z, r] of [[-0.22, -0.2, 0.28], [0.22, 0.05, 0.3], [-0.12, 0.28, 0.22]]) g.add(mesh(cyl(r, r + 0.02, 0.06, 7), 0xd9cbb2, x, 0.04, z, false));
      break;
    case 'yardLamp': { const l = makeLamp(M); l.scale.setScalar(0.8); g.add(l); break; }
    case 'flowerBed':
      g.add(mesh(cyl(0.45, 0.5, 0.25, 10), 0x9a6440, 0, 0.12, 0), mesh(cyl(0.42, 0.42, 0.04, 10), 0x6b4a3a, 0, 0.26, 0, false));
      for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; g.add(mesh(ico(0.1, 0), [0xff7eb6, 0xffd23f, 0xffffff, 0xb08bff, 0xff8c42][i], Math.cos(a) * 0.22, 0.4, Math.sin(a) * 0.22, false), mesh(cyl(0.02, 0.02, 0.15, 4), 0x58b947, Math.cos(a) * 0.22, 0.3, Math.sin(a) * 0.22, false)); }
      break;
    case 'yardBench': { const b = makeBench(); b.scale.setScalar(0.6); g.add(b); break; }
    case 'hedge':
      for (const x of [-0.25, 0.25]) g.add(mesh(ico(0.38, 1), 0x3fae4a, x, 0.38, 0));
      break;
    // furniture (for inside the cottage, but they can go anywhere)
    case 'bed':
      g.add(mesh(box(0.9, 0.35, 1.6), WOOD, 0, 0.18, 0), mesh(box(0.86, 0.14, 1.5), 0xfff3dc, 0, 0.42, 0), mesh(box(0.88, 0.16, 1.0), 0x4c8bd6, 0, 0.47, 0.25), mesh(box(0.6, 0.14, 0.3), 0xffffff, 0, 0.53, -0.55), mesh(box(0.95, 0.7, 0.1), WOOD_DARK, 0, 0.35, -0.8));
      break;
    case 'table':
      g.add(mesh(box(0.9, 0.08, 0.9), WOOD, 0, 0.7, 0));
      for (const [x, z] of [[-0.38, -0.38], [0.38, -0.38], [-0.38, 0.38], [0.38, 0.38]]) g.add(mesh(box(0.07, 0.7, 0.07), WOOD_DARK, x, 0.35, z));
      g.add(mesh(cyl(0.08, 0.06, 0.18, 8), 0xffffff, 0.15, 0.82, 0.1), mesh(sph(0.08, 8, 6), 0xff7eb6, 0.15, 0.95, 0.1, false));
      break;
    case 'chair':
      g.add(mesh(box(0.5, 0.06, 0.5), WOOD, 0, 0.45, 0), mesh(box(0.5, 0.55, 0.06), WOOD, 0, 0.72, -0.22));
      for (const [x, z] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) g.add(mesh(box(0.05, 0.45, 0.05), WOOD_DARK, x, 0.22, z));
      break;
    case 'rug':
      g.add(mesh(box(1.0, 0.03, 1.0), 0xff9fd0, 0, 0.02, 0, false), mesh(box(0.7, 0.035, 0.7), 0xfff3dc, 0, 0.025, 0, false), mesh(box(0.35, 0.04, 0.35), 0x9b5de5, 0, 0.03, 0, false));
      break;
    case 'plant':
      g.add(mesh(cyl(0.18, 0.14, 0.3, 10), 0xd9776a, 0, 0.15, 0));
      for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; const l = mesh(sph(0.14, 8, 6), 0x3fae4a, Math.cos(a) * 0.12, 0.45 + (i % 2) * 0.15, Math.sin(a) * 0.12, false); l.scale.set(0.6, 1.4, 0.6); g.add(l); }
      break;
    case 'shelf':
      g.add(mesh(box(0.9, 1.4, 0.35), WOOD, 0, 0.7, 0));
      for (let i = 0; i < 3; i++) for (let k = 0; k < 4; k++) g.add(mesh(box(0.12, 0.3, 0.25), [0xff5d73, 0x4cc9f0, 0xffc93c, 0x3ddc97][(i + k) % 4], -0.3 + k * 0.17, 0.32 + i * 0.42, 0.04, false));
      break;
    default:
      g.add(mesh(ico(0.3, 0), 0xc9a8ff, 0, 0.3, 0));
  }
  return g;
}

/** New decorations from heart events, festivals and friends. */
export function makeDeco2(id, M) {
  const g = new THREE.Group();
  switch (id) {
    case 'quilt': g.add(mesh(box(1.0, 0.03, 1.0), 0x8ac926, 0, 0.02, 0, false)); for (let i = 0; i < 4; i++) g.add(mesh(box(0.3, 0.035, 0.3), [0xff7eb6, 0xffd23f, 0x4cc9f0, 0xffffff][i], (i % 2 - 0.5) * 0.45, 0.025, (Math.floor(i / 2) - 0.5) * 0.45, false)); break;
    case 'gardenArch':
      for (const x of [-0.5, 0.5]) g.add(mesh(box(0.1, 1.8, 0.1), 0xffffff, x, 0.9, 0));
      g.add(mesh(sharedTorus(), 0xffffff, 0, 1.8, 0));
      for (let i = 0; i < 8; i++) { const a = (i / 7) * Math.PI; g.add(mesh(ico(0.12, 0), i % 2 ? 0xff7eb6 : 0x58b947, Math.cos(a) * 0.5, 1.8 + Math.sin(a) * 0.5, 0.05, false)); }
      break;
    case 'portrait': case 'photo':
      g.add(mesh(box(0.08, 1.0, 0.08), WOOD_DARK, 0, 0.5, 0), mesh(box(0.8, 0.6, 0.06), COLORS.gold, 0, 1.2, 0), mesh(box(0.66, 0.46, 0.07), id === 'photo' ? 0x2e3b6b : 0xffe0f0, 0, 1.2, 0.01, false));
      g.add(mesh(sph(0.12, 8, 6), id === 'photo' ? 0xffffff : 0xff9fd0, -0.12, 1.2, 0.05, false), mesh(sph(0.1, 8, 6), id === 'photo' ? 0xffc93c : 0x8ac926, 0.14, 1.18, 0.05, false));
      break;
    case 'shipWheel': {
      g.add(mesh(box(0.1, 0.8, 0.1), WOOD_DARK, 0, 0.4, 0));
      const w = new THREE.Group();
      w.add(mesh(sharedTorus(0.35, 0.05), WOOD, 0, 0, 0), mesh(cyl(0.08, 0.08, 0.1, 8), COLORS.gold, 0, 0, 0).rotateX(Math.PI / 2));
      for (let i = 0; i < 8; i++) { const sp = mesh(cyl(0.025, 0.025, 0.9, 4), WOOD, 0, 0, 0); sp.rotation.z = (i / 8) * Math.PI; w.add(sp); }
      w.position.set(0, 1.0, 0.1);
      g.add(w);
      g.userData.spin = w;
      break;
    }
    case 'scope': {
      for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2; const l = mesh(cyl(0.03, 0.03, 1.2, 4), WOOD_DARK, Math.sin(a) * 0.25, 0.55, Math.cos(a) * 0.25, false); l.rotation.set(Math.cos(a) * 0.35, 0, -Math.sin(a) * 0.35); g.add(l); }
      const tube = mesh(cyl(0.1, 0.14, 1.0, 10), COLORS.gold, 0, 1.25, 0);
      tube.rotation.x = -0.9;
      g.add(tube);
      break;
    }
    case 'anchor':
      g.add(mesh(box(0.12, 1.2, 0.12), 0x5a5a6a, 0, 0.7, 0), mesh(sharedTorus(0.16, 0.04), 0x5a5a6a, 0, 1.4, 0), mesh(box(0.7, 0.1, 0.12), 0x5a5a6a, 0, 1.1, 0));
      g.add(mesh(sharedTorus(0.4, 0.06, Math.PI), 0x5a5a6a, 0, 0.5, 0).rotateZ(Math.PI));
      break;
    case 'starLamp':
      g.add(mesh(cyl(0.05, 0.05, 1.4, 6), INK, 0, 0.7, 0));
      g.add(mesh(ico(0.25, 0), M.lamp, 0, 1.55, 0, false));
      break;
    case 'derbyTrophy': case 'ribbon': {
      if (id === 'ribbon') {
        g.add(mesh(box(0.08, 1.0, 0.08), WOOD_DARK, 0, 0.5, 0), mesh(cyl(0.22, 0.22, 0.05, 14), 0x4c8bd6, 0, 1.1, 0.05).rotateX(Math.PI / 2), mesh(cyl(0.12, 0.12, 0.06, 12), COLORS.gold, 0, 1.1, 0.08).rotateX(Math.PI / 2));
        for (const s of [-1, 1]) g.add(mesh(box(0.1, 0.35, 0.03), 0x4c8bd6, s * 0.08, 0.85, 0.05, false).rotateZ(s * 0.2));
      } else {
        g.add(mesh(box(0.7, 0.5, 0.7), 0x2f6f9f, 0, 0.25, 0), mesh(cyl(0.25, 0.12, 0.4, 12), COLORS.gold, 0, 0.75, 0));
        const f = mesh(sph(0.16, 10, 8), 0xffd23f, 0, 1.1, 0);
        f.scale.set(1.6, 0.8, 0.5);
        g.add(f, mesh(cone(0.1, 0.18, 4), 0xffd23f, -0.3, 1.1, 0).rotateZ(Math.PI / 2));
      }
      break;
    }
    case 'paperLantern':
      g.add(mesh(cyl(0.04, 0.04, 1.6, 5), WOOD_DARK, 0, 0.8, 0), mesh(box(0.5, 0.05, 0.05), WOOD_DARK, 0.2, 1.6, 0, false));
      g.add(mesh(sph(0.22, 10, 8), toon(0xff7a59, { emissive: 0x662200 }), 0.42, 1.35, 0, false));
      break;
    default:
      g.add(mesh(ico(0.3, 0), 0xc9a8ff, 0, 0.4, 0));
  }
  return g;
}

function sharedTorus(r = 0.5, t = 0.06, arc = Math.PI) {
  return new THREE.TorusGeometry(r, t, 6, 16, arc);
}

// ---------- the cottage interior (built off the island; the door teleports you) ----------

/** A cozy room: floor, back and side walls, a low front wall with a door gap. w x d units. */
export function makeRoom(M, w, d, upgraded) {
  const g = new THREE.Group();
  // dark "outside" so the sea never shows around the room
  g.add(mesh(box(80, 0.1, 80), 0x2b2340, 0, -0.08, 0, false));
  g.add(mesh(box(w, 0.1, d), 0xc68a52, 0, 0, 0, false));
  for (let i = 0; i < w; i++) g.add(mesh(box(0.04, 0.11, d), 0xa8703f, -w / 2 + i + 0.5, 0.005, 0, false));
  const wall = upgraded ? 0xfff0e0 : 0xfff3dc;
  g.add(mesh(box(w + 0.4, 3.2, 0.3), wall, 0, 1.6, -d / 2 - 0.15));
  for (const sx of [-1, 1]) g.add(mesh(box(0.3, 3.2, d + 0.3), wall, sx * (w / 2 + 0.15), 1.6, 0));
  // wallpaper stripes and a window on the back wall
  for (let i = 0; i < w; i += 1) g.add(mesh(box(0.08, 3.0, 0.02), 0xffd6c8, -w / 2 + i + 0.5, 1.6, -d / 2 + 0.01, false));
  for (const x of [-w / 4, w / 4]) {
    g.add(mesh(box(1.1, 1.0, 0.04), M.win, x, 1.9, -d / 2 + 0.03, false));
    g.add(mesh(box(1.25, 0.08, 0.06), 0xffffff, x, 1.4, -d / 2 + 0.05, false));
  }
  // low front wall with the door gap in the middle
  const half = (w - 1.6) / 2;
  for (const sx of [-1, 1]) g.add(mesh(box(half, 0.6, 0.25), wall, sx * (0.8 + half / 2), 0.3, d / 2 + 0.12));
  g.add(mesh(box(1.4, 0.04, 0.6), 0x9a6440, 0, 0.02, d / 2 + 0.4, false));
  // a fireplace on the left wall and a ceiling lamp
  g.add(mesh(box(0.5, 1.4, 1.4), 0xb0675a, -w / 2 + 0.25, 0.7, -d / 2 + 1.2), mesh(box(0.1, 0.6, 0.8), toon(0xff8c42, { emissive: 0x883300 }), -w / 2 + 0.52, 0.45, -d / 2 + 1.2, false));
  g.add(mesh(sph(0.25, 10, 8), M.lamp, 0, 2.9, 0, false));
  if (upgraded) {
    // the extra room: an inner wall with a wide doorway
    g.add(mesh(box(0.25, 3.0, d * 0.35), wall, w / 2 - 4, 1.5, -d / 2 + d * 0.175), mesh(box(0.25, 3.0, d * 0.35), wall, w / 2 - 4, 1.5, d / 2 - d * 0.175));
  }
  return g;
}

/** The cottage porch (upgrade): a deck with posts and a little roof in front of the door. */
export function makePorch() {
  const g = new THREE.Group();
  g.add(mesh(box(5.6, 0.18, 1.8), WOOD, 0, 0.1, 0));
  for (const x of [-2.6, -0.9, 0.9, 2.6]) g.add(mesh(box(0.14, 2.1, 0.14), 0xffffff, x, 1.15, 0.8));
  const roof = mesh(box(6.0, 0.14, 2.2), 0xff7a59, 0, 2.25, 0.2);
  roof.rotation.x = 0.18;
  g.add(roof, mesh(box(5.4, 0.08, 0.08), 0xffffff, 0, 0.75, 0.85));
  // a rocking chair and plants
  g.add(mesh(box(0.5, 0.06, 0.5), WOOD, -2.0, 0.55, 0.1), mesh(box(0.5, 0.6, 0.06), WOOD, -2.0, 0.85, -0.12));
  g.add(mesh(cyl(0.18, 0.14, 0.3, 8), 0xd9776a, 2.1, 0.35, 0.3), mesh(ico(0.25, 1), 0x3fae4a, 2.1, 0.65, 0.3));
  return g;
}

/** A pile of rock to break with the pickaxe (stone). */
export function makeStoneNode() {
  const g = new THREE.Group();
  for (const [x, y, s] of [[0, 0.35, 0.55], [0.4, 0.25, 0.35], [-0.35, 0.2, 0.3]]) {
    const r = mesh(ico(1, 0), 0xa8a2bf, x, y, 0);
    r.scale.set(s, s * 0.8, s);
    r.rotation.set(x, y * 4, 0.3);
    g.add(r);
  }
  g.add(mesh(ico(0.08, 0), 0xffffff, 0.15, 0.55, 0.3, false));
  return g;
}

/** Tall grass to cut with the scythe (hay and fiber). */
export function makeTallGrass() {
  const g = new THREE.Group();
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const b = mesh(cyl(0, 0.07, 0.8 + (i % 3) * 0.15, 3), i % 2 ? 0x8ac926 : 0x6fbf4a, Math.cos(a) * 0.2, 0.4, Math.sin(a) * 0.2, false);
    b.rotation.set(Math.sin(a) * 0.25, 0, -Math.cos(a) * 0.25);
    g.add(b);
  }
  return g;
}

/** A hay trough; userData.hay is the hay inside (scaled by how full it is). */
export function makeTrough() {
  const g = new THREE.Group();
  g.add(mesh(box(1.5, 0.5, 0.7), WOOD, 0, 0.25, 0), mesh(box(1.3, 0.1, 0.5), WOOD_DARK, 0, 0.45, 0, false));
  const hay = mesh(box(1.25, 0.25, 0.45), 0xf0d060, 0, 0.5, 0, false);
  g.add(hay);
  g.userData.hay = hay;
  return g;
}

/** A nest box where the chickens lay eggs; userData.eggs are shown as they are laid. */
export function makeNest() {
  const g = new THREE.Group();
  g.add(mesh(box(1.0, 0.5, 0.6), WOOD, 0, 0.25, 0), mesh(box(0.9, 0.12, 0.5), 0xf0d060, 0, 0.5, 0, false));
  const eggs = [];
  for (let i = 0; i < 4; i++) { const e = mesh(sph(0.09, 8, 6), 0xfff8f0, -0.3 + i * 0.2, 0.6, 0, false); e.scale.y = 1.3; e.visible = false; g.add(e); eggs.push(e); }
  g.userData.eggs = eggs;
  return g;
}

/** Festival props: string of paper lanterns between two points. */
export function makeLanternString(a, b) {
  const g = new THREE.Group();
  const n = Math.max(3, Math.round(Math.hypot(b.x - a.x, b.z - a.z) / 1.4));
  const cols = [0xff7a59, 0xffc93c, 0xff5d73, 0x9b5de5];
  for (let i = 1; i < n; i++) {
    const k = i / n;
    g.add(mesh(sph(0.2, 8, 6), toon(cols[i % 4], { emissive: 0x552200 }), a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k - Math.sin(k * Math.PI) * 0.5, a.z + (b.z - a.z) * k, false));
  }
  return g;
}
