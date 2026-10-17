import * as THREE from 'three';
import { COLORS, toon, sharedGeo, faceted } from './palette.js';

/** Grumbles: grumpy-but-harmless fuzzballs used as the "enemies" in the games. */
export function makeGrumble(color = 0x7b6cf6) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(sharedGeo('grumbleBody', () => faceted(new THREE.IcosahedronGeometry(0.45, 1))), toon(color, { flat: true }));
  body.position.y = 0.45;
  body.castShadow = true;
  g.add(body);
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(sharedGeo('gEye', () => new THREE.SphereGeometry(0.1, 10, 8)), toon(COLORS.white));
    eye.position.set(s * 0.15, 0.55, 0.37);
    const pupil = new THREE.Mesh(sharedGeo('gPupil', () => new THREE.SphereGeometry(0.055, 8, 6)), toon(COLORS.ink));
    pupil.position.set(s * 0.15, 0.53, 0.45);
    const brow = new THREE.Mesh(sharedGeo('gBrow', () => new THREE.BoxGeometry(0.16, 0.04, 0.04)), toon(COLORS.ink));
    brow.position.set(s * 0.15, 0.69, 0.42);
    brow.rotation.z = s * -0.35;
    const foot = new THREE.Mesh(sharedGeo('gFoot', () => new THREE.SphereGeometry(0.11, 8, 6)), toon(0xffb347));
    foot.position.set(s * 0.18, 0.06, 0.08);
    foot.scale.set(1, 0.6, 1.3);
    g.add(eye, pupil, brow, foot);
  }
  g.userData.body = body;
  return g;
}
