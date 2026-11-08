import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { COLORS, toon, sharedGeo } from '../core/palette.js';

// The Party Pier ferry: a chunky little party boat that carries you between your own island and the
// shared island where everyone plays together. Bow toward +x, about 5 m long and 2.4 m wide; the
// waterline is at y = 0. userData.flags (a pennant line) and userData.funnel can be animated.

const rbox = (w, h, d, r = 0.12) => sharedGeo(`ferry-rb${w}|${h}|${d}|${r}`, () => new RoundedBoxGeometry(w, h, d, 3, r));
const cyl = (rt, rb, h, seg = 14) => sharedGeo(`ferry-cyl${rt}|${rb}|${h}|${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg));
const sph = (r) => sharedGeo(`ferry-sph${r}`, () => new THREE.SphereGeometry(r, 14, 10));
const tor = (r, t) => sharedGeo(`ferry-tor${r}|${t}`, () => new THREE.TorusGeometry(r, t, 8, 20));

function mesh(geo, color, x, y, z, shadow = true) {
  const m = new THREE.Mesh(geo, typeof color === 'number' ? toon(color) : color);
  m.position.set(x, y, z);
  m.castShadow = shadow;
  m.receiveShadow = true;
  return m;
}

export function makeFerry() {
  const g = new THREE.Group();
  // hull: red below, a white band, a rounded bow
  g.add(mesh(rbox(4.4, 0.9, 2.4, 0.3), 0xff5d73, 0, 0.05, 0));
  const bow = mesh(sph(1.2), 0xff5d73, 2.15, 0.05, 0);
  bow.scale.set(1.0, 0.38, 1.0);
  g.add(bow);
  g.add(mesh(rbox(4.5, 0.16, 2.5, 0.06), COLORS.white, 0, 0.42, 0, false));
  g.add(mesh(rbox(4.2, 0.1, 2.2, 0.04), 0xc68a52, 0, 0.52, 0)); // the deck
  // cabin with round windows and a blue roof
  g.add(mesh(rbox(2.0, 1.1, 1.7, 0.12), COLORS.white, -0.5, 1.12, 0));
  g.add(mesh(rbox(2.3, 0.16, 2.0, 0.06), 0x4cc9f0, -0.5, 1.74, 0));
  for (const z of [-0.86, 0.86]) for (const x of [-1.1, -0.5, 0.1]) {
    const w = mesh(cyl(0.17, 0.17, 0.06, 14), 0x9fdcff, x, 1.2, z, false);
    w.rotation.x = Math.PI / 2;
    g.add(w);
  }
  // funnel: yellow with a red band and a gold star
  const funnel = new THREE.Group();
  funnel.add(mesh(cyl(0.26, 0.3, 0.9), 0xffc93c, 0, 0.45, 0), mesh(cyl(0.28, 0.28, 0.16), 0xff5d73, 0, 0.62, 0, false));
  funnel.position.set(-0.9, 1.8, 0);
  g.add(funnel);
  const star = mesh(sharedGeo('ferry-star', () => new THREE.OctahedronGeometry(0.22, 0)), toon(COLORS.gold, { emissive: 0x332200 }), 0.6, 2.25, 0);
  g.add(star);
  g.add(mesh(cyl(0.04, 0.04, 1.2, 6), COLORS.white, 0.6, 1.95, 0, false));
  // life rings on the cabin sides
  for (const z of [-0.88, 0.88]) {
    const r = mesh(tor(0.2, 0.06), 0xff8c42, 0.35, 1.05, z, false);
    g.add(r);
  }
  // a mast at the bow and a string of party pennants down to the stern
  g.add(mesh(cyl(0.05, 0.05, 2.0, 6), COLORS.white, 1.9, 1.5, 0));
  const flags = new THREE.Group();
  const cols = [0xff5d73, 0xffc93c, 0x3ddc97, 0x4cc9f0, 0x9b5de5];
  const a = new THREE.Vector3(1.9, 2.45, 0), b = new THREE.Vector3(-1.95, 1.1, 0);
  for (let i = 1; i < 9; i++) {
    const k = i / 9;
    const f = mesh(sharedGeo('ferry-flag', () => new THREE.ConeGeometry(0.14, 0.3, 3)), cols[i % cols.length], a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k - Math.sin(k * Math.PI) * 0.25 - 0.14, 0, false);
    f.rotation.set(Math.PI, Math.PI / 2, 0);
    f.scale.set(1, 1, 0.25);
    flags.add(f);
  }
  g.add(flags);
  g.add(mesh(cyl(0.04, 0.04, 0.8, 6), COLORS.white, -1.95, 0.9, 0, false));
  g.userData.flags = flags;
  g.userData.funnel = funnel;
  g.userData.star = star;
  return g;
}
