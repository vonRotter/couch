import * as THREE from 'three';
import { M, BOX, SPH, CONE, CYL, TOR, eyes, glow } from './games/util.js';

// A little toon emblem per classic game (the cabinets' marquees in the Game Hall, the puzzle locks): about one
// unit across, standing on y = 0, facing +z.
export function makeArcadeEmblem(key) {
  const g = new THREE.Group();
  switch (key) {
    case 'snake': {
      for (let i = 0; i < 3; i++) g.add(M(SPH(0.2 - i * 0.02, 10, 8), i % 2 ? 0x6aa82a : 0x8ac926, -0.25 - i * 0.28, 0.22, 0));
      const h = M(SPH(0.26, 12, 10), 0xa8e04a, 0.1, 0.26, 0);
      const e = eyes(0.8, 0.15);
      e.position.set(0.1, 0.38, 0.2);
      g.add(h, e, M(SPH(0.15, 10, 8), 0xff3b5c, 0.5, 0.16, 0));
      break;
    }
    case 'blocks': {
      for (const [x, y, c] of [[-0.25, 0.15, 0xff9f1c], [0.05, 0.15, 0xff9f1c], [0.35, 0.15, 0xff9f1c], [0.35, 0.45, 0xff9f1c], [-0.25, 0.45, 0x4cc9f0]]) g.add(M(BOX(0.28, 0.28, 0.28), c, x, y, 0));
      break;
    }
    case 'maze': {
      g.add(M(BOX(0.9, 0.12, 0.12), 0x9a6440, 0, 0.06, -0.3), M(BOX(0.12, 0.12, 0.6), 0x9a6440, -0.39, 0.06, 0), M(BOX(0.5, 0.12, 0.12), 0x9a6440, 0.2, 0.06, 0.1));
      g.add(M(CYL(0.03, 0.03, 0.4, 6), 0x5a4a3a, 0.3, 0.2, 0.3), M(BOX(0.18, 0.2, 0.18), glow(0xffd23f, 0x806000), 0.3, 0.45, 0.3));
      break;
    }
    case 'crates': {
      g.add(M(BOX(0.42, 0.42, 0.42), 0xc68a52, -0.15, 0.21, 0), M(BOX(0.46, 0.06, 0.08), 0x8a5a32, -0.15, 0.3, 0.22));
      g.add(M(CYL(0.24, 0.24, 0.04, 16), glow(0x3ddc97, 0x0e5a38), 0.32, 0.02, 0.1));
      break;
    }
    case 'simon': {
      const cols = [0xffc93c, 0x3ddc97, 0x4cc9f0, 0xff5d73];
      cols.forEach((c, i) => { const a = (i / 4) * Math.PI * 2; const b = M(SPH(0.17, 12, 8), c, Math.cos(a) * 0.28, 0.2 + Math.sin(a) * 0.28, 0); b.scale.z = 0.6; g.add(b); });
      break;
    }
    case 'lights': {
      g.add(M(CYL(0.15, 0.15, 0.36, 12), glow(0xffd23f, 0x806000), -0.22, 0.2, 0), M(CONE(0.2, 0.14, 12), 0x5a4a3a, -0.22, 0.45, 0));
      g.add(M(CYL(0.15, 0.15, 0.36, 12), 0x2b3a70, 0.22, 0.2, 0), M(CONE(0.2, 0.14, 12), 0x5a4a3a, 0.22, 0.45, 0), M(SPH(0.07, 8, 6), 0xdfe6ff, 0.22, 0.24, 0.15));
      break;
    }
    case 'bonk': {
      [0xff5d73, 0xffd23f, 0x3ddc97].forEach((c, i) => g.add(M(BOX(0.26, 0.14, 0.1), c, -0.3 + i * 0.3, 0.55, 0)));
      g.add(M(SPH(0.08, 8, 6), 0xffffff, 0.1, 0.32, 0.05), M(BOX(0.5, 0.1, 0.12), 0x8a5a32, 0, 0.06, 0));
      break;
    }
    case 'pong': {
      g.add(M(BOX(0.08, 0.4, 0.1), 0xff5d73, -0.4, 0.25, 0), M(BOX(0.08, 0.4, 0.1), 0x5b4fd8, 0.4, 0.25, 0), M(SPH(0.08, 8, 6), 0xffffff, 0.05, 0.35, 0));
      g.add(M(BOX(0.02, 0.5, 0.02), 0xffffff, 0, 0.25, -0.05));
      break;
    }
    case 'rocks': {
      const s = M(CONE(0.16, 0.42, 3), 0xffffff, -0.18, 0.25, 0);
      s.rotation.z = -Math.PI / 2;
      g.add(s, M(SPH(0.18, 6, 4), 0x9a8fc0, 0.3, 0.32, 0), M(SPH(0.1, 6, 4), 0xb39ad8, 0.2, 0.08, 0.1), M(SPH(0.04, 6, 4), 0xfff07a, 0.08, 0.25, 0));
      break;
    }
    default: g.add(M(TOR(0.3, 0.06), 0xffd23f, 0, 0.3, 0));
  }
  return g;
}
