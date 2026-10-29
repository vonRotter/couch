import * as THREE from 'three';
import { COLORS, toon, basic, sharedGeo } from '../../core/palette.js';
import { mesh, box, cyl, sph, cone, ico, WOOD, WOOD_DARK } from './models.js';

// Milestone B4 models: the sea on the way to Shell Isle (a seal on its rock), the lighthouse story (the
// stairs door, glowing crumbs, Mumble's nightlight crystal, sky lanterns) and its decorations (the mini
// lighthouse from the Lamp Festival and the star globe from the telescope).

const INK = COLORS.ink;

/** A round grey seal lying on a rock (faces +x); userData.flip waves, userData.head nods. */
export function makeSeal() {
  const g = new THREE.Group();
  const body = mesh(sph(0.55, 14, 10), 0x9aa7b8, 0, 0, 0);
  body.scale.set(1.5, 0.75, 0.85);
  g.add(body);
  const belly = mesh(sph(0.5, 12, 8), 0xd8dee8, 0.1, -0.12, 0, false);
  belly.scale.set(1.3, 0.5, 0.75);
  g.add(belly);
  const head = new THREE.Group();
  head.position.set(0.8, 0.35, 0);
  head.add(mesh(sph(0.36, 12, 10), 0x9aa7b8, 0, 0, 0));
  const snout = mesh(sph(0.16, 10, 8), 0xd8dee8, 0.3, -0.08, 0, false);
  snout.scale.set(1, 0.7, 1.2);
  head.add(snout, mesh(sph(0.06, 6, 4), INK, 0.44, -0.02, 0, false));
  for (const s of [-1, 1]) {
    head.add(mesh(sph(0.06, 8, 6), INK, 0.24, 0.12, s * 0.17, false));
    for (let k = 0; k < 2; k++) head.add(mesh(box(0.22, 0.012, 0.012), 0xffffff, 0.42, -0.09 + k * 0.05, s * 0.12, false).rotateY(s * 0.4));
  }
  g.add(head);
  // a front flipper that waves, a back flipper (the tail)
  const flip = new THREE.Group();
  flip.position.set(0.35, -0.05, 0.42);
  const f = mesh(sph(0.2, 8, 6), 0x8592a6, 0, 0.18, 0, false);
  f.scale.set(0.5, 1.2, 0.3);
  flip.add(f);
  g.add(flip);
  const tail = mesh(cone(0.28, 0.5, 6), 0x8592a6, -0.95, 0.05, 0);
  tail.rotation.z = Math.PI / 2;
  tail.scale.z = 0.4;
  g.add(tail);
  g.userData = { flip, head };
  return g;
}

/** The little arched door to the lighthouse stairs (faces +z, sits on the tower's side). */
export function makeStairsDoor() {
  const g = new THREE.Group();
  g.add(mesh(box(0.95, 1.5, 0.12), 0x6a4a8a, 0, 0.95, 0));
  g.add(mesh(cyl(0.475, 0.475, 0.12, 14, 1, false), 0x6a4a8a, 0, 1.7, 0).rotateX(Math.PI / 2));
  g.add(mesh(box(1.15, 0.12, 0.25), INK, 0, 0.2, 0.05));
  for (let i = 0; i < 3; i++) g.add(mesh(box(0.06, 1.3, 0.04), 0x8a6aaa, -0.3 + i * 0.3, 0.9, 0.08, false));
  g.add(mesh(sph(0.06, 6, 4), COLORS.gold, 0.32, 0.95, 0.1, false));
  // a star over the door (it shines once the stairs are fixed)
  const star = mesh(sharedGeo('isl4-star', () => new THREE.OctahedronGeometry(0.16, 0)), toon(0xffd23f, { emissive: 0x664400 }), 0, 2.45, 0.08, false);
  g.add(star);
  // planks across it while the stairs are broken
  const planks = new THREE.Group();
  for (const r of [0.5, -0.45]) planks.add(mesh(box(1.25, 0.18, 0.06), WOOD, 0, 1.0 + r * 0.6, 0.14, false).rotateZ(r));
  g.add(planks);
  g.userData = { star, planks };
  return g;
}

/** A glowing radish crumb (the trail of the green glow). */
export function makeCrumb() {
  const g = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const c = mesh(ico(0.09 + i * 0.02, 0), toon(i ? 0xff4f6d : 0xffffff, { emissive: i ? 0x551122 : 0x333333 }), (i - 1) * 0.16, 0.1, (i % 2) * 0.1, false);
    g.add(c);
  }
  const glow = mesh(sph(0.32, 10, 8), basic(0x9dff7a), 0, 0.15, 0, false);
  glow.material = glow.material.clone();
  glow.material.userData = {};
  glow.material.transparent = true;
  glow.material.opacity = 0.35;
  glow.material.depthWrite = false;
  g.add(glow);
  const glint = mesh(box(0.08, 0.5, 0.08), basic(0xffffff), 0, 0.8, 0, false);
  g.add(glint);
  g.userData = { glow, glint };
  return g;
}

/** Mumble's nightlight: the old lamp crystal, small enough to hug (green glow). */
export function makeNightCrystal() {
  const c = mesh(sharedGeo('isl4-night', () => new THREE.OctahedronGeometry(0.2, 0)), toon(0xb8ffd0, { emissive: 0x2a8a4a }), 0, 0, 0, false);
  c.scale.y = 1.5;
  return c;
}

/** A paper sky lantern (rises at the Lamp Festival). */
export function makeSkyLantern(color = 0xffb347) {
  const g = new THREE.Group();
  const m = new THREE.MeshBasicMaterial({ color });
  const body = new THREE.Mesh(sharedGeo('isl4-lantern', () => new THREE.CylinderGeometry(0.22, 0.16, 0.42, 8)), m);
  g.add(body);
  g.add(mesh(sph(0.08, 6, 4), basic(0xfff3b0), 0, -0.18, 0, false));
  return g;
}

// ---------- decorations ----------

export const DECO4 = new Set(['miniLighthouse', 'starGlobe']);

export function makeDeco4(id, M) {
  const g = new THREE.Group();
  switch (id) {
    case 'miniLighthouse': { // the Lamp Festival's prize: a little lighthouse that shines at night
      g.add(mesh(cyl(0.45, 0.55, 0.25, 10), 0x9a94b2, 0, 0.12, 0));
      for (let i = 0; i < 4; i++) g.add(mesh(cyl(0.26 - i * 0.03, 0.29 - i * 0.03, 0.34, 12), i % 2 ? 0xffffff : 0xff5d73, 0, 0.42 + i * 0.34, 0));
      g.add(mesh(cyl(0.2, 0.2, 0.05, 12), INK, 0, 1.75, 0));
      g.add(mesh(cyl(0.15, 0.15, 0.24, 10), M.lamp, 0, 1.9, 0, false));
      g.add(mesh(cone(0.22, 0.24, 10), 0xff5d73, 0, 2.14, 0));
      g.add(mesh(sph(0.05, 6, 4), COLORS.gold, 0, 2.3, 0, false));
      break;
    }
    case 'starGlobe': { // the telescope's prize: a celestial globe with golden stars
      g.add(mesh(cyl(0.25, 0.35, 0.2, 10), WOOD_DARK, 0, 0.1, 0), mesh(cyl(0.05, 0.05, 0.5, 6), WOOD, 0, 0.45, 0));
      const globe = new THREE.Group();
      globe.add(mesh(sph(0.42, 16, 12), 0x2e3b6b, 0, 0, 0));
      for (let i = 0; i < 9; i++) {
        const a = i * 2.4, b = Math.sin(i * 1.7) * 0.9;
        globe.add(mesh(sph(0.04, 6, 4), basic(0xffe14a), Math.cos(a) * Math.cos(b) * 0.42, Math.sin(b) * 0.42, Math.sin(a) * Math.cos(b) * 0.42, false));
      }
      globe.add(mesh(sharedGeo('isl4-ring', () => new THREE.TorusGeometry(0.5, 0.025, 6, 24)), COLORS.gold, 0, 0, 0, false).rotateX(1.2));
      globe.position.y = 1.1;
      g.add(globe);
      g.userData.spin = globe;
      break;
    }
    default:
      g.add(mesh(ico(0.3, 0), 0xc9a8ff, 0, 0.3, 0));
  }
  return g;
}
