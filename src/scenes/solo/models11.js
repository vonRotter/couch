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
