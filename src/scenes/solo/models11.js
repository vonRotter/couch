import * as THREE from 'three';
import { basic } from '../../core/palette.js';
import { mesh, box, sph, cyl, cone } from './models.js';

// Keepsakes of the odd-adventure round (yard pieces or small things for inside: build.js ANYWHERE):
// the tiny bells (the magic ball's bell trio), a gear clock (Tinka's old storeroom behind the switch door), a spore
// lamp (the mushroom merchant), a moss charm (the shy moss creature), a tea set (the tiny elephants), a pebble tower
// (the new folk's Pebble Day), a wizard hat on a stand (the wizard school) and a cloud-whale kite (the cloud whale).

export const DECO11 = new Set(['tinyBells', 'gearClock', 'sporeLamp', 'mossCharm', 'teaSet', 'pebbleTower', 'wizardHat', 'whaleKite', 'clubPin', 'ballotBox']);

export function makeDeco11(id) {
  const g = new THREE.Group();
  switch (id) {
    case 'tinyBells': {
      g.add(mesh(box(0.08, 0.9, 0.08), 0x8a5a32, -0.3, 0.45, 0), mesh(box(0.08, 0.9, 0.08), 0x8a5a32, 0.3, 0.45, 0), mesh(box(0.7, 0.06, 0.08), 0x8a5a32, 0, 0.88, 0));
      [-0.18, 0, 0.18].forEach((x, i) => g.add(mesh(cone(0.08, 0.14, 10), 0xffc93c, x, 0.7 - i * 0.03, 0)));
      break;
    }
    case 'gearClock': {
      g.add(mesh(box(0.5, 0.9, 0.3), 0x8a5a32, 0, 0.45, 0), mesh(cyl(0.2, 0.2, 0.05, 16), 0xfff6e0, 0, 0.7, 0.16));
      g.children[1].rotation.x = Math.PI / 2;
      for (const [x, y, r] of [[-0.22, 0.95, 0.12], [0.2, 1.0, 0.09]]) { const k = mesh(cyl(r, r, 0.05, 8), 0xb8860b, x, y, 0); k.rotation.x = Math.PI / 2; g.add(k); }
      break;
    }
    case 'sporeLamp': {
      g.add(mesh(cyl(0.05, 0.07, 0.5, 8), 0xf3ead2, 0, 0.25, 0), mesh(sph(0.22, 12, 8), basic(0x9fffd0), 0, 0.55, 0, false));
      g.children[1].scale.set(1, 0.6, 1);
      break;
    }
    case 'mossCharm': {
      g.add(mesh(sph(0.22, 12, 8), 0x5aa83a, 0, 0.2, 0), mesh(sph(0.05, 8, 6), 0x2b2340, -0.07, 0.27, 0.18), mesh(sph(0.05, 8, 6), 0x2b2340, 0.07, 0.27, 0.18));
      g.add(mesh(sph(0.06, 8, 6), 0xff9fd0, 0, 0.42, 0));
      break;
    }
    case 'teaSet': {
      g.add(mesh(box(0.7, 0.05, 0.45), 0xc68a52, 0, 0.3, 0), mesh(box(0.06, 0.3, 0.06), 0x8a5a32, -0.3, 0.15, -0.18), mesh(box(0.06, 0.3, 0.06), 0x8a5a32, 0.3, 0.15, 0.18));
      g.add(mesh(sph(0.12, 12, 8), 0xffffff, -0.12, 0.42, 0), mesh(cyl(0.05, 0.04, 0.07, 10), 0xffffff, 0.15, 0.37, 0.08), mesh(cyl(0.05, 0.04, 0.07, 10), 0xffffff, 0.2, 0.37, -0.1));
      break;
    }
    case 'pebbleTower': {
      const cols = [0xff9f40, 0x4cc9f0, 0xff7eb6, 0xffd23f, 0x3ddc97];
      for (let i = 0; i < 5; i++) { const p = mesh(sph(0.2 - i * 0.025, 10, 8), cols[i], 0, 0.12 + i * 0.2, 0); p.scale.set(1, 0.6, 1); g.add(p); }
      break;
    }
    case 'wizardHat': {
      g.add(mesh(cyl(0.05, 0.06, 0.8, 8), 0x8a5a32, 0, 0.4, 0), mesh(cyl(0.32, 0.32, 0.04, 16), 0x4a3fc0, 0, 0.82, 0), mesh(cone(0.2, 0.55, 14), 0x4a3fc0, 0, 1.1, 0));
      g.add(mesh(sph(0.05, 8, 6), basic(0xffd23f), 0.08, 1.12, 0.12, false));
      break;
    }
    case 'whaleKite': {
      g.add(mesh(cyl(0.03, 0.03, 1.6, 6), 0x8a5a32, 0, 0.8, 0));
      const w = mesh(sph(0.3, 12, 8), 0xdfe9ff, 0, 1.6, 0);
      w.scale.set(1.6, 0.7, 0.8);
      g.add(w, mesh(cone(0.15, 0.3, 8), 0xdfe9ff, -0.55, 1.65, 0));
      g.children[2].rotation.z = Math.PI / 2;
      break;
    }
    case 'clubPin': {
      g.add(mesh(cyl(0.2, 0.2, 0.06, 16), 0x2e3b6b, 0, 0.3, 0), mesh(sph(0.07, 8, 6), basic(0xffd23f), 0, 0.35, 0, false), mesh(box(0.05, 0.3, 0.05), 0x8a5a32, 0, 0.15, 0));
      g.children[0].rotation.x = Math.PI / 2;
      break;
    }
    case 'ballotBox': {
      g.add(mesh(box(0.5, 0.5, 0.4), 0x4a6fd8, 0, 0.25, 0), mesh(box(0.25, 0.03, 0.05), 0x2b2340, 0, 0.51, 0));
      break;
    }
    default: g.add(mesh(sph(0.2), 0xffd23f, 0, 0.2, 0));
  }
  return g;
}

/** A guest's hat (a group for the bean's hat slot). */
export function makeGuestHat(kind) {
  const g = new THREE.Group();
  if (kind === 'goggles') { // Tinka: goggles on a leather cap
    g.add(mesh(new THREE.SphereGeometry(0.3, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), 0x8a5a32, 0, -0.08, 0));
    for (const s of [-1, 1]) g.add(mesh(cyl(0.09, 0.09, 0.08, 12), 0x7ff0ff, s * 0.13, 0.04, 0.24));
    g.children[1].rotation.x = g.children[2].rotation.x = Math.PI / 2;
    g.add(mesh(box(0.42, 0.04, 0.04), 0x2b2340, 0, 0.04, 0.26));
  } else if (kind === 'wizard') { // Wendeline: a tall starry hat
    g.add(mesh(cyl(0.34, 0.34, 0.04, 18), 0x4a3fc0, 0, 0, 0), mesh(cone(0.22, 0.7, 16), 0x4a3fc0, 0, 0.36, 0));
    g.add(mesh(sph(0.05, 8, 6), basic(0xffd23f), 0.1, 0.3, 0.16, false), mesh(sph(0.04, 8, 6), basic(0xffd23f), -0.08, 0.5, 0.1, false));
    g.rotation.z = -0.15;
  } else if (kind === 'mushroom') { // Old Morel: a big spotted cap
    const cap = mesh(new THREE.SphereGeometry(0.48, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), 0xd9583a, 0, -0.12, 0);
    cap.scale.set(1, 0.7, 1);
    g.add(cap);
    for (const [x, z] of [[0.2, 0.2], [-0.2, 0.1], [0.05, -0.25], [-0.15, -0.2]]) g.add(mesh(sph(0.07, 8, 6), 0xffffff, x, 0.12, z, false));
  } else if (kind === 'bells') { // the new folk: a tall knitted hat with a bell
    g.add(mesh(cone(0.27, 0.62, 14), 0x3ddc97, 0, 0.26, 0), mesh(cyl(0.28, 0.28, 0.1, 14), 0xff9f40, 0, 0, 0), mesh(sph(0.07, 8, 6), 0xffd23f, 0, 0.6, 0));
  } else if (kind === 'bellsRed') {
    g.add(mesh(cone(0.27, 0.62, 14), 0xff5d73, 0, 0.26, 0), mesh(cyl(0.28, 0.28, 0.1, 14), 0x4cc9f0, 0, 0, 0), mesh(sph(0.07, 8, 6), 0xffd23f, 0, 0.6, 0));
  } else if (kind === 'bellsBlue') {
    g.add(mesh(cone(0.27, 0.62, 14), 0x4a6fd8, 0, 0.26, 0), mesh(cyl(0.28, 0.28, 0.1, 14), 0xffd23f, 0, 0, 0), mesh(sph(0.07, 8, 6), 0xffffff, 0, 0.6, 0));
  }
  return g;
}

// ---------- part 2: the wizard school, Tinka's workshop and her machines ----------

/** The little wizard school: a round stone tower with a pointed roof, a star flag and a door facing east. */
export function makeWizardTower(M) {
  const g = new THREE.Group();
  g.add(mesh(cyl(1.5, 1.65, 3.2, 14), 0xd8d0e8, 0, 1.6, 0), mesh(cyl(1.75, 1.75, 0.25, 14), 0xb0a8c8, 0, 0.12, 0));
  g.add(mesh(cone(1.95, 2.4, 14), 0x4a3fc0, 0, 4.4, 0));
  for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; g.add(mesh(sph(0.08, 6, 4), basic(0xffd23f), Math.cos(a) * 1.25, 4.0 + (i % 3) * 0.4, Math.sin(a) * 1.25, false)); }
  g.add(mesh(cyl(0.03, 0.03, 1.1, 6), 0x8a5a32, 0, 6.1, 0), mesh(box(0.55, 0.32, 0.03), 0xffd23f, 0.28, 6.45, 0));
  g.add(mesh(box(0.12, 1.5, 0.95), 0x5a3a8a, 1.55, 0.85, 0), mesh(sph(0.06, 6, 4), 0xffd23f, 1.63, 0.85, 0.3, false)); // the door (east)
  for (const [y, a] of [[2.3, 0.8], [2.3, -0.8], [1.4, 2.4]]) { const w = mesh(box(0.1, 0.5, 0.36), M?.win || 0x9fdcff, Math.cos(a) * 1.55, y, -Math.sin(a) * 1.55); w.rotation.y = a; g.add(w); }
  // a little yard sign: a moon and a star
  g.add(mesh(box(0.08, 0.9, 0.08), 0x8a5a32, 2.4, 0.45, 1.5), mesh(box(0.8, 0.45, 0.06), 0x2e3b6b, 2.4, 0.95, 1.5), mesh(sph(0.1, 8, 6), basic(0xfff3b0), 2.25, 0.98, 1.54, false), mesh(sph(0.06, 6, 4), basic(0xffd23f), 2.6, 0.92, 1.54, false));
  return g;
}

/** Tinka's workshop: a shed with a big gear on the roof, a chimney and a bench full of odd things. */
export function makeWorkshop(M) {
  const g = new THREE.Group();
  g.add(mesh(box(3.0, 2.2, 2.4), 0x8fb0c8, 0, 1.1, 0), mesh(box(3.3, 0.2, 2.7), 0x5a6a8a, 0, 2.3, 0));
  g.add(mesh(box(0.9, 1.5, 0.08), 0x7a4a2e, -0.6, 0.75, 1.22), mesh(box(0.7, 0.6, 0.08), M?.win || 0x9fdcff, 0.75, 1.3, 1.22));
  g.add(mesh(cyl(0.18, 0.2, 1.0, 8), 0x9a94b2, 1.0, 2.9, -0.6), mesh(cyl(0.22, 0.22, 0.1, 8), 0x5a5a6a, 1.0, 3.42, -0.6));
  const gear = new THREE.Group();
  gear.position.set(-0.6, 3.0, 0.2);
  gear.add(mesh(cyl(0.55, 0.55, 0.14, 12), 0xffc93c, 0, 0, 0));
  gear.children[0].rotation.x = Math.PI / 2;
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; gear.add(mesh(box(0.18, 0.18, 0.14), 0xffc93c, Math.cos(a) * 0.62, Math.sin(a) * 0.62, 0)); }
  g.add(gear);
  g.add(mesh(box(1.2, 0.08, 0.6), 0xc68a52, 2.1, 0.8, 0.8), mesh(box(0.08, 0.8, 0.08), 0x8a5a32, 1.6, 0.4, 0.6), mesh(box(0.08, 0.8, 0.08), 0x8a5a32, 2.6, 0.4, 1.0));
  g.add(mesh(sph(0.15, 8, 6), 0x7ff0ff, 1.9, 0.98, 0.8), mesh(box(0.3, 0.2, 0.2), 0xff5d73, 2.35, 0.94, 0.75));
  g.userData.gear = gear;
  return g;
}

/** A teleport booth: a tall round cabin with a glass front and a light on top. */
export function makeBooth() {
  const g = new THREE.Group();
  g.add(mesh(cyl(0.7, 0.75, 0.15, 12), 0x5a5a6a, 0, 0.08, 0), mesh(cyl(0.62, 0.62, 2.1, 12, 1, true), 0xff7eb6, 0, 1.15, 0));
  g.add(mesh(cyl(0.7, 0.7, 0.25, 12), 0xff5d73, 0, 2.3, 0), mesh(sph(0.16, 10, 8), basic(0x8ff0ff), 0, 2.55, 0, false));
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 1.9, 12, 1, true, -0.9, 1.8), new THREE.MeshBasicMaterial({ color: 0xbff6ff, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }));
  glass.position.y = 1.1;
  g.add(glass);
  const swirl = mesh(cyl(0.45, 0.45, 0.04, 12), basic(0x8ff0ff), 0, 0.2, 0, false);
  g.add(swirl);
  g.userData.swirl = swirl;
  return g;
}

/** The joke vending robot: a box on legs with a screen face and a slot. */
export function makeVendor() {
  const g = new THREE.Group();
  g.add(mesh(box(0.9, 1.4, 0.6), 0x4cc9f0, 0, 1.0, 0), mesh(box(0.1, 0.3, 0.1), 0x5a5a6a, -0.3, 0.15, 0), mesh(box(0.1, 0.3, 0.1), 0x5a5a6a, 0.3, 0.15, 0));
  g.add(mesh(box(0.6, 0.4, 0.05), basic(0x2e3b2e), 0, 1.35, 0.31), mesh(box(0.3, 0.06, 0.06), 0x2b2340, 0, 0.6, 0.31));
  const eyes = [mesh(sph(0.05, 6, 4), basic(0x9fff9f), -0.12, 1.4, 0.34, false), mesh(sph(0.05, 6, 4), basic(0x9fff9f), 0.12, 1.4, 0.34, false)];
  g.add(...eyes, mesh(box(0.2, 0.03, 0.02), basic(0x9fff9f), 0, 1.27, 0.34, false));
  g.add(mesh(cyl(0.02, 0.02, 0.35, 6), 0x5a5a6a, 0, 1.85, 0), mesh(sph(0.07, 8, 6), 0xff5d73, 0, 2.05, 0));
  g.userData.eyes = eyes;
  return g;
}
