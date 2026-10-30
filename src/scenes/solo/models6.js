import * as THREE from 'three';
import { COLORS, toon } from '../../core/palette.js';
import { mesh, box, cyl, sph, cone } from './models.js';

// Pillow Keep Solo's two yard decorations, sent by mail: a little pillow fort (for beating Big Teddy,
// the Act 1 boss) and a golden feather trophy on a cushion (for putting the Sleepy Sheep to sleep).

export const DECO6 = new Set(['pillowFort', 'featherTrophy']);

export function makeDeco6(id) {
  const g = new THREE.Group();
  if (id === 'pillowFort') {
    // a ring of stacked pillows with a blanket roof and a tiny flag
    const cols = [0xff9fd0, 0x8fd8ff, 0xffe47a, 0xc9a8ff, 0x9ff0c8];
    for (let i = 0; i < 7; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.4;
      for (let k = 0; k < 2; k++) {
        const p = mesh(box(0.55, 0.22, 0.36), cols[(i + k) % cols.length], Math.cos(a) * 0.62, 0.12 + k * 0.23, Math.sin(a) * 0.62);
        p.rotation.y = -a + (k ? 0.2 : 0);
        g.add(p);
      }
    }
    const roof = mesh(cone(0.85, 0.5, 8), 0xff5d73, 0, 0.75, 0);
    g.add(roof);
    g.add(mesh(cyl(0.02, 0.02, 0.5, 5), COLORS.ink, 0, 1.2, 0, false), mesh(box(0.26, 0.16, 0.02), 0xffd23f, 0.13, 1.36, 0, false));
  } else {
    // a golden feather standing on a purple cushion with tassels
    g.add(mesh(box(0.9, 0.24, 0.9), 0x9b5de5, 0, 0.12, 0));
    for (const [x, z] of [[-0.45, -0.45], [0.45, -0.45], [-0.45, 0.45], [0.45, 0.45]]) g.add(mesh(sph(0.07, 8, 6), COLORS.gold, x, 0.12, z, false));
    const f = mesh(cone(0.18, 1.1, 8), toon(COLORS.gold, { emissive: 0x443300 }), 0, 0.85, 0);
    f.scale.z = 0.35;
    f.rotation.z = 0.2;
    g.add(f, mesh(cyl(0.025, 0.025, 0.35, 5), 0xd8c4a8, -0.05, 0.3, 0, false));
    g.userData.spin = f;
  }
  return g;
}
