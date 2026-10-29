import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { COLORS, toon, basic, sharedGeo, faceted } from '../../core/palette.js';
import { Character } from '../../core/character.js';

// Bean Brigade models, all from primitives: toy mechs with a bean pilot in a glass dome, goofy
// bug-grumbles, and the board tiles (ground, houses, mountains, water, forest, sand, ice, rubble)
// with their overlays (fire, smoke, bubble shields, crates, spawn mounds).

const INK = COLORS.ink;
const geo = {
  sph: (r, w = 14, h = 10) => sharedGeo(`br-sph${r}|${w}|${h}`, () => new THREE.SphereGeometry(r, w, h)),
  box: (x, y, z) => sharedGeo(`br-box${x}|${y}|${z}`, () => new THREE.BoxGeometry(x, y, z)),
  rbox: (x, y, z, r) => sharedGeo(`br-rbox${x}|${y}|${z}|${r}`, () => new RoundedBoxGeometry(x, y, z, 3, r)),
  cyl: (a, b, h, n = 12) => sharedGeo(`br-cyl${a}|${b}|${h}|${n}`, () => new THREE.CylinderGeometry(a, b, h, n)),
  cone: (r, h, n = 10) => sharedGeo(`br-cone${r}|${h}|${n}`, () => new THREE.ConeGeometry(r, h, n)),
  tor: (r, t, arc = Math.PI * 2) => sharedGeo(`br-tor${r}|${t}|${arc}`, () => new THREE.TorusGeometry(r, t, 8, 18, arc)),
  ico: (r, d = 0) => sharedGeo(`br-ico${r}|${d}`, () => faceted(new THREE.IcosahedronGeometry(r, d))),
};
export { geo };

export function mesh(g, color, x = 0, y = 0, z = 0, shadow = true) {
  const m = new THREE.Mesh(g, typeof color === 'number' ? toon(color) : color);
  m.position.set(x, y, z);
  m.castShadow = shadow;
  return m;
}

/** A see-through material of our own (the shared toon materials must never change). */
export function glassMat(color, opacity = 0.35) {
  const m = new THREE.MeshToonMaterial({ color, transparent: true, opacity, gradientMap: toon(0xffffff).gradientMap, depthWrite: false });
  m.userData = {};
  return m;
}

function eyes(g, y, z, spread = 0.13, r = 0.085, angry = true) {
  for (const s of [-1, 1]) {
    const w = mesh(geo.sph(r, 10, 8), COLORS.white, s * spread, y, z, false);
    w.scale.set(1, 1.15, 0.7);
    const p = mesh(geo.sph(r * 0.55, 8, 6), INK, s * spread, y - 0.01, z + r * 0.6, false);
    g.add(w, p);
    if (angry) {
      const b = mesh(geo.box(r * 1.7, 0.035, 0.03), INK, s * spread, y + r * 1.25, z + 0.02, false);
      b.rotation.z = s * -0.4;
      g.add(b);
    }
  }
}

// ---------- mechs ----------

/**
 * A toy mech: chunky body on two stubby legs, a glass dome with a bean pilot (pilot: { color, hat })
 * and the weapon of its type. The group stands at its feet and faces +z.
 * userData: { body, legs, pilot (Character), spin (propeller), arm }
 */
export function makeMech(type, def, pilot) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const c = def.color, tr = def.trim;
  const legs = [];
  if (!def.flying) {
    for (const s of [-1, 1]) {
      const leg = new THREE.Group();
      leg.position.set(s * 0.17, 0.24, 0);
      leg.add(mesh(geo.cyl(0.08, 0.09, 0.2, 10), 0x5a5470, 0, -0.06, 0));
      leg.add(mesh(geo.rbox(0.2, 0.1, 0.26, 0.04), tr, 0, -0.18, 0.03));
      g.add(leg);
      legs.push(leg);
    }
  } else {
    // a hover fan instead of legs
    body.add(mesh(geo.cyl(0.26, 0.3, 0.12, 14), 0x5a5470, 0, 0.16, 0));
    body.add(mesh(geo.tor(0.3, 0.04), tr, 0, 0.16, 0).rotateX(Math.PI / 2));
  }
  body.add(mesh(geo.rbox(0.62, 0.38, 0.5, 0.1), c, 0, 0.47, 0));
  body.add(mesh(geo.box(0.64, 0.07, 0.52), tr, 0, 0.36, 0, false));
  // a round "headlight" badge on the chest
  body.add(mesh(geo.cyl(0.08, 0.08, 0.03, 12), tr, 0, 0.5, 0.26, false).rotateX(Math.PI / 2));
  // the glass dome and its pilot
  const p = new Character(pilot.color, { hat: pilot.hat ?? 0 });
  p.group.scale.setScalar(0.36);
  p.group.position.set(0, 0.62, 0.02);
  body.add(p.group);
  const dome = new THREE.Mesh(geo.sph(0.24, 16, 10), glassMat(0xbff6ff, 0.28));
  dome.position.set(0, 0.72, 0.02);
  dome.scale.set(1, 0.95, 1);
  body.add(dome);
  // shoulders
  for (const s of [-1, 1]) body.add(mesh(geo.sph(0.11, 10, 8), tr, s * 0.34, 0.55, 0));
  const arm = new THREE.Group();
  arm.position.set(0.36, 0.5, 0.06);
  body.add(arm);
  switch (def.weapon) {
    case 'punch': {
      arm.add(mesh(geo.cyl(0.05, 0.05, 0.2, 8), 0x5a5470, 0.04, -0.06, 0.04).rotateX(0.6));
      const glove = mesh(geo.sph(0.15, 12, 10), 0xff3b54, 0.06, -0.12, 0.16);
      glove.scale.set(1, 0.9, 1.1);
      arm.add(glove, mesh(geo.cyl(0.13, 0.13, 0.06, 12), 0xffffff, 0.06, -0.12, 0.04).rotateX(Math.PI / 2));
      const l = mesh(geo.sph(0.12, 10, 8), 0xff3b54, -0.72, -0.12, 0.12);
      arm.add(l);
      break;
    }
    case 'cannon':
      arm.add(mesh(geo.cyl(0.07, 0.09, 0.42, 12), 0x5a5470, 0.02, 0.06, 0.12).rotateX(Math.PI / 2));
      arm.add(mesh(geo.tor(0.075, 0.025), tr, 0.02, 0.06, 0.34, false));
      break;
    case 'lob':
      body.add(mesh(geo.cyl(0.1, 0.12, 0.34, 12), 0x5a5470, -0.12, 0.78, -0.16).rotateX(-0.5));
      body.add(mesh(geo.tor(0.1, 0.03), tr, -0.12, 0.92, -0.08, false).rotateX(Math.PI / 2 - 0.5));
      break;
    case 'hook':
      arm.add(mesh(geo.cyl(0.04, 0.04, 0.34, 8), 0x9a94b2, 0.02, 0.02, 0.12).rotateX(Math.PI / 2));
      arm.add(mesh(geo.tor(0.08, 0.025, Math.PI * 1.3), 0xd0d0e0, 0.02, -0.03, 0.3, false).rotateY(Math.PI / 2));
      break;
    case 'swap': {
      const ant = new THREE.Group();
      ant.position.set(-0.2, 0.86, -0.1);
      ant.add(mesh(geo.cyl(0.02, 0.02, 0.26, 6), INK, 0, 0.1, 0));
      for (const s of [-1, 1]) ant.add(mesh(geo.sph(0.06, 10, 8), toon(s > 0 ? 0x8fd8ff : 0xff9fd0, { emissive: 0x332244 }), s * 0.1, 0.24, 0, false));
      body.add(ant);
      g.userData.spin = ant;
      break;
    }
    case 'laser':
      arm.add(mesh(geo.cyl(0.12, 0.08, 0.14, 14), 0x5a5470, 0.02, 0, 0.12).rotateX(Math.PI / 2));
      arm.add(mesh(geo.cyl(0.09, 0.09, 0.02, 14), toon(0xff9fd0, { emissive: 0x662244 }), 0.02, 0, 0.2, false).rotateX(Math.PI / 2));
      break;
    case 'bubble':
      arm.add(mesh(geo.cyl(0.03, 0.03, 0.3, 6), 0x5a5470, 0.02, 0.1, 0.06));
      arm.add(mesh(geo.tor(0.1, 0.025), 0xff9fd0, 0.02, 0.32, 0.06, false));
      break;
    case 'puff': {
      const prop = new THREE.Group();
      prop.position.set(0, 0.98, 0);
      prop.add(mesh(geo.cyl(0.02, 0.02, 0.1, 6), INK, 0, -0.04, 0));
      for (let i = 0; i < 3; i++) prop.add(mesh(geo.box(0.42, 0.02, 0.08), i % 2 ? 0xffc93c : 0x9b5de5, 0, 0, 0).rotateY((i * Math.PI) / 3));
      body.add(prop);
      g.userData.spin = prop;
      for (const s of [-1, 1]) body.add(mesh(geo.cyl(0.07, 0.04, 0.12, 8), 0xdddddd, s * 0.2, 0.3, -0.22).rotateX(Math.PI / 2));
      break;
    }
    case 'boulder':
      body.add(mesh(geo.cyl(0.18, 0.14, 0.14, 12), 0x8a5a32, -0.12, 0.74, -0.18));
      body.add(mesh(geo.ico(0.13, 0), 0xbdb8cf, -0.12, 0.86, -0.18));
      arm.add(mesh(geo.sph(0.11, 10, 8), 0x8a5a32, 0.02, -0.08, 0.1));
      break;
    default:
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  g.userData.body = body;
  g.userData.legs = legs;
  g.userData.pilot = p;
  g.userData.arm = arm;
  return g;
}

// ---------- bugs ----------

const BUG_COLORS = {
  beetle: { body: 0x7b6cf6, belly: 0xc9a8ff, leg: INK },
  spitter: { body: 0x58b947, belly: 0x9ff0c8, leg: 0x2f6b2a },
  burrower: { body: 0xd9873a, belly: 0xffcf8a, leg: 0x7a4a22 },
  firefly: { body: 0xffd23f, belly: 0xfff3a0, leg: INK },
  boomer: { body: 0xff6b4a, belly: 0xffb7a0, leg: INK },
  queen: { body: 0x9b5de5, belly: 0xff9fd0, leg: INK },
};

/** A goofy bug-grumble. userData: { body, legs, wings, glow, drill }. Faces +z. */
export function makeBug(type, alpha = false) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const col = BUG_COLORS[type] || BUG_COLORS.beetle;
  const legs = [];
  const addLegs = (n, y, rz, len = 0.18) => {
    for (let i = 0; i < n; i++) {
      for (const s of [-1, 1]) {
        const l = mesh(geo.cyl(0.025, 0.02, len, 5), col.leg, s * rz, y - 0.06, (i - (n - 1) / 2) * 0.16, false);
        l.rotation.z = s * 0.9;
        body.add(l);
        legs.push(l);
      }
    }
  };
  switch (type) {
    case 'beetle': {
      const shell = mesh(geo.sph(0.34, 16, 12), col.body, 0, 0.32, -0.04);
      shell.scale.set(1, 0.8, 1.1);
      body.add(shell);
      body.add(mesh(geo.box(0.02, 0.2, 0.62), INK, 0, 0.5, -0.04, false));
      for (const [x, z] of [[-0.16, -0.12], [0.18, 0.02], [-0.1, 0.14]]) body.add(mesh(geo.sph(0.06, 8, 6), col.belly, x, 0.52, z, false));
      body.add(mesh(geo.sph(0.2, 12, 10), col.belly, 0, 0.3, 0.3));
      body.add(mesh(geo.cone(0.05, 0.2, 8), 0xfff3dc, 0, 0.48, 0.42).rotateX(0.7));
      eyes(body, 0.38, 0.44, 0.1, 0.07);
      addLegs(3, 0.22, 0.3);
      break;
    }
    case 'spitter': {
      const b = mesh(geo.sph(0.3, 16, 12), col.body, 0, 0.34, 0);
      body.add(b);
      const sac = mesh(geo.sph(0.2, 12, 10), toon(0xb7ff6a, { emissive: 0x224400 }), 0, 0.52, -0.2);
      body.add(sac);
      body.add(mesh(geo.cyl(0.06, 0.09, 0.26, 10), col.belly, 0, 0.3, 0.36).rotateX(Math.PI / 2));
      body.add(mesh(geo.tor(0.06, 0.02), 0x2f6b2a, 0, 0.3, 0.49, false));
      eyes(body, 0.5, 0.24, 0.12, 0.08);
      addLegs(2, 0.18, 0.26);
      g.userData.sac = sac;
      break;
    }
    case 'burrower': {
      const b = mesh(geo.sph(0.32, 14, 10), col.body, 0, 0.32, -0.04);
      b.scale.set(1.05, 0.85, 1.15);
      body.add(b);
      for (let i = 0; i < 3; i++) body.add(mesh(geo.box(0.6, 0.03, 0.05), col.leg, 0, 0.52 - i * 0.02, -0.2 + i * 0.12, false));
      const drill = mesh(geo.cone(0.13, 0.32, 8), 0xbdb8cf, 0, 0.3, 0.44);
      drill.rotation.x = Math.PI / 2;
      body.add(drill);
      for (const s of [-1, 1]) body.add(mesh(geo.sph(0.08, 8, 6), col.belly, s * 0.3, 0.22, 0.24));
      eyes(body, 0.48, 0.24, 0.12, 0.07);
      addLegs(2, 0.2, 0.28);
      g.userData.drill = drill;
      break;
    }
    case 'firefly': {
      const b = mesh(geo.sph(0.2, 14, 10), col.body, 0, 0.62, 0.06);
      body.add(b);
      const glow = mesh(geo.sph(0.18, 12, 10), toon(0xfff27a, { emissive: 0xffa000 }), 0, 0.58, -0.2, false);
      glow.scale.set(1, 0.9, 1.2);
      body.add(glow);
      const wings = [];
      for (const s of [-1, 1]) {
        const w = new THREE.Mesh(geo.sph(0.18, 10, 6), glassMat(0xffffff, 0.55));
        w.scale.set(1.2, 0.12, 0.6);
        w.position.set(s * 0.22, 0.78, -0.02);
        body.add(w);
        wings.push(w);
      }
      for (const s of [-1, 1]) body.add(mesh(geo.cyl(0.012, 0.012, 0.2, 4), INK, s * 0.06, 0.86, 0.14, false).rotateZ(s * -0.4));
      eyes(body, 0.66, 0.22, 0.09, 0.065);
      g.userData.wings = wings;
      g.userData.glow = glow;
      g.userData.hover = true;
      break;
    }
    case 'boomer': {
      const b = mesh(geo.sph(0.3, 16, 12), col.body, 0, 0.32, 0);
      body.add(b);
      for (let i = 0; i < 3; i++) body.add(mesh(geo.tor(0.3, 0.02), col.belly, 0, 0.24 + i * 0.1, 0, false).rotateX(Math.PI / 2));
      body.add(mesh(geo.cyl(0.03, 0.03, 0.16, 6), INK, 0, 0.66, 0));
      const spark = mesh(geo.ico(0.06, 0), basic(0xffe14a), 0, 0.76, 0, false);
      body.add(spark);
      eyes(body, 0.38, 0.26, 0.1, 0.075, false);
      addLegs(2, 0.16, 0.24, 0.14);
      g.userData.spark = spark;
      break;
    }
    case 'queen': {
      const b = mesh(geo.sph(0.4, 18, 14), col.body, 0, 0.5, -0.1);
      b.scale.set(1.1, 0.95, 1.25);
      body.add(b);
      body.add(mesh(geo.sph(0.26, 14, 10), col.belly, 0, 0.5, 0.32));
      const crown = new THREE.Group();
      crown.position.set(0, 0.9, 0.12);
      crown.add(mesh(geo.cyl(0.16, 0.14, 0.1, 12), COLORS.gold, 0, 0, 0));
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        crown.add(mesh(geo.cone(0.04, 0.12, 6), COLORS.gold, Math.cos(a) * 0.14, 0.1, Math.sin(a) * 0.14));
      }
      body.add(crown);
      for (const s of [-1, 1]) {
        const w = new THREE.Mesh(geo.sph(0.26, 10, 6), glassMat(0xffd6f5, 0.55));
        w.scale.set(1.2, 0.1, 0.6);
        w.position.set(s * 0.36, 0.78, -0.3);
        w.rotation.z = s * 0.4;
        body.add(w);
      }
      eyes(body, 0.62, 0.52, 0.12, 0.09);
      addLegs(3, 0.3, 0.4, 0.28);
      break;
    }
    default:
  }
  if (alpha) {
    g.scale.setScalar(1.18);
    const horn = new THREE.Group();
    horn.position.set(0, type === 'firefly' ? 0.9 : 0.66, 0.1);
    for (let i = 0; i < 3; i++) horn.add(mesh(geo.cone(0.045, 0.14, 6), COLORS.gold, (i - 1) * 0.08, 0.06, 0));
    body.add(horn);
  }
  if (type === 'queen') g.scale.setScalar(1.35);
  g.userData.body = body;
  g.userData.legs = legs;
  return g;
}

/** A boulder from the Boulder Mech. */
export function makeRock() {
  const g = new THREE.Group();
  const r = mesh(geo.ico(0.36, 0), 0xa9a4bf, 0, 0.32, 0);
  r.rotation.set(0.4, 0.8, 0.2);
  g.add(r, mesh(geo.ico(0.16, 0), 0x9a94b2, 0.22, 0.14, 0.18));
  g.userData.body = g;
  g.userData.legs = [];
  return g;
}

// ---------- board tiles ----------

export const THEMES = {
  meadow: { ground: [0x8ad65a, 0x7cc94f], side: 0x9a6a44, cliff: 0xb87a48, sea: 0x56c6f0, sky: ['#7fd3ff', '#fff1d6'], roof: [0xff5d73, 0x4c8bd6, 0xffa630], wall: 0xfff3dc, leaf: [0x3fae4a, 0x58c46a], snow: false, deco: 0x4cc46a },
  desert: { ground: [0xf3d48a, 0xe9c877], side: 0xc98e4e, cliff: 0xd9a066, sea: 0x4cc9f0, sky: ['#7fd3ff', '#ffe6b8'], roof: [0x3ddc97, 0xff8c42, 0x9b5de5], wall: 0xffe9c2, leaf: [0x6aa312, 0x8ac926], snow: false, deco: 0x8ac926 },
  snow: { ground: [0xf2f7ff, 0xe4eefb], side: 0x8a9ab8, cliff: 0xb8c4dc, sea: 0x6ab8e8, sky: ['#a8d8ff', '#f4f8ff'], roof: [0xff5d73, 0x4cc9f0, 0x9b5de5], wall: 0xfff3dc, leaf: [0x2f8f5a, 0x3fa46a], snow: true, deco: 0x2f8f5a },
  hive: { ground: [0xc6a3e8, 0xb791df], side: 0x6a4a8a, cliff: 0x7a5a9a, sea: 0xff9fd0, sky: ['#ff9fd0', '#ffe0b0'], roof: [0xffc93c, 0x4cc9f0, 0x3ddc97], wall: 0xfff3dc, leaf: [0xff5d73, 0xff8c42], snow: false, deco: 0xff8c42 },
};

const TILE_H = 0.5;

function tree(theme, rnd, x, z, s = 1) {
  const g = new THREE.Group();
  g.add(mesh(geo.cyl(0.04, 0.05, 0.16, 6), 0x8a5a32, 0, 0.08, 0));
  const c = theme.leaf[Math.floor(rnd() * theme.leaf.length)];
  g.add(mesh(geo.cone(0.2, 0.36, 7), c, 0, 0.32, 0));
  g.add(mesh(geo.cone(0.15, 0.28, 7), c, 0, 0.48, 0));
  if (theme.snow) g.add(mesh(geo.cone(0.09, 0.12, 7), 0xffffff, 0, 0.6, 0, false));
  g.position.set(x, 0, z);
  g.scale.setScalar(s);
  return g;
}

function house(theme, floors, roofColor, broken) {
  const g = new THREE.Group();
  const h = 0.32 * floors + 0.06;
  g.add(mesh(geo.rbox(0.64, h, 0.62, 0.05), theme.wall, 0, h / 2, 0));
  const roof = mesh(geo.cone(0.52, 0.34, 4), roofColor, 0, h + 0.17, 0);
  roof.rotation.y = Math.PI / 4;
  g.add(roof);
  if (theme.snow) { const sn = mesh(geo.cone(0.4, 0.14, 4), 0xffffff, 0, h + 0.29, 0, false); sn.rotation.y = Math.PI / 4; g.add(sn); }
  g.add(mesh(geo.box(0.14, 0.2, 0.02), 0x8a5a32, 0, 0.1, 0.315, false));
  for (let f = 0; f < floors; f++) {
    for (const s of [-1, 1]) {
      const lit = f < floors - broken;
      g.add(mesh(geo.box(0.11, 0.1, 0.02), lit ? toon(0xffe47a, { emissive: 0x554400 }) : toon(0x55507a), s * 0.17, 0.2 + f * 0.32, 0.315, false));
    }
  }
  g.add(mesh(geo.box(0.08, 0.16, 0.08), 0xb05a4a, 0.18, h + 0.2, -0.1));
  return g;
}

/** The special buildings worth a star: windmill, battery, cocoa house, the grid tower. */
function special(theme, what, floors) {
  const g = new THREE.Group();
  if (what === 'battery') {
    g.add(mesh(geo.cyl(0.26, 0.26, 0.62, 16), 0x3ddc97, 0, 0.31, 0));
    g.add(mesh(geo.cyl(0.27, 0.27, 0.08, 16), 0xffffff, 0, 0.46, 0, false));
    g.add(mesh(geo.cyl(0.1, 0.1, 0.1, 10), 0xbdb8cf, 0, 0.67, 0));
    const bolt = mesh(geo.box(0.06, 0.26, 0.02), toon(0xffe14a, { emissive: 0x665500 }), 0, 0.28, 0.27, false);
    bolt.rotation.z = 0.4;
    g.add(bolt);
  } else if (what === 'tower') {
    g.add(mesh(geo.cyl(0.24, 0.32, 0.9, 8), 0xfff3dc, 0, 0.45, 0));
    for (let i = 0; i < 3; i++) g.add(mesh(geo.cyl(0.26 + i * 0.02, 0.26 + i * 0.02, 0.06, 8), 0x9b5de5, 0, 0.2 + i * 0.28, 0, false));
    const orb = mesh(geo.sph(0.18, 14, 10), toon(0xffe14a, { emissive: 0x886600 }), 0, 1.06, 0);
    g.add(orb);
    g.userData.orb = orb;
  } else if (what === 'cocoa') {
    g.add(house(theme, floors, 0x8a5a32, 0));
    const mug = new THREE.Group();
    mug.position.set(0, 0.9, 0.2);
    mug.add(mesh(geo.cyl(0.11, 0.1, 0.18, 12), 0xffffff, 0, 0, 0), mesh(geo.tor(0.06, 0.02), 0xffffff, 0.12, 0, 0, false), mesh(geo.cyl(0.095, 0.095, 0.02, 12), 0x8a5a32, 0, 0.08, 0, false));
    g.add(mug);
  } else {
    // windmill
    g.add(mesh(geo.cyl(0.2, 0.3, 0.8, 8), theme.wall, 0, 0.4, 0));
    const cap = mesh(geo.cone(0.26, 0.26, 8), 0xff5d73, 0, 0.93, 0);
    g.add(cap);
    const blades = new THREE.Group();
    blades.position.set(0, 0.72, 0.3);
    for (let i = 0; i < 4; i++) {
      const b = mesh(geo.box(0.08, 0.5, 0.02), 0xfff3dc, 0, 0.25, 0);
      const arm = new THREE.Group();
      arm.add(b);
      arm.rotation.z = (i * Math.PI) / 2;
      blades.add(arm);
    }
    g.add(blades);
    g.userData.blades = blades;
  }
  // a star sign: this one is worth a bonus star
  const star = mesh(geo.ico(0.08, 0), toon(COLORS.gold, { emissive: 0x443300 }), 0.32, 0.15, 0.32, false);
  g.add(star);
  return g;
}

/**
 * The model for one board tile (tile from rules.js, with x/y for variety). Returns a group whose
 * top surface is at y = 0 (water lower). userData.anim: things to animate (blades, flames, puffs).
 */
export function makeTile(tile, x, y, theme, objWhat) {
  const g = new THREE.Group();
  const anim = [];
  const rnd = mulberry(x * 31 + y * 17 + 5);
  const checker = (x + y) % 2;
  let top = theme.ground[checker];
  if (tile.t === 'sand') top = 0xf7e1a6;
  if (tile.t === 'ice') top = tile.hp >= 2 ? 0xcff0ff : 0xb3e2f7;
  if (tile.t === 'rubble') top = theme.snow ? 0xd8deea : 0xb9b0a0;
  if (tile.t === 'water') {
    g.add(mesh(geo.box(0.98, TILE_H - 0.2, 0.98), theme.side, 0, -TILE_H / 2 - 0.1, 0, false));
    const w = mesh(geo.box(0.98, 0.04, 0.98), toon(theme.sea === 0xff9fd0 ? 0xff9fd0 : 0x56c6f0, { transparent: true, opacity: 0.85 }), 0, -0.2, 0, false);
    w.receiveShadow = true;
    g.add(w);
    anim.push({ kind: 'wave', obj: w, ph: rnd() * 6 });
  } else {
    const base = mesh(geo.box(0.98, TILE_H, 0.98), theme.side, 0, -TILE_H / 2 - 0.04, 0, false);
    const lid = mesh(geo.box(0.98, 0.08, 0.98), top, 0, -0.04, 0, false);
    base.receiveShadow = lid.receiveShadow = true;
    g.add(base, lid);
  }
  switch (tile.t) {
    case 'building': {
      const floors = tile.max || tile.hp;
      const broken = (tile.max || tile.hp) - tile.hp;
      const roofs = theme.roof;
      const b = tile.obj ? special(theme, objWhat, floors) : house(theme, floors, roofs[(x * 3 + y) % roofs.length], broken);
      if (b.userData.blades) anim.push({ kind: 'blades', obj: b.userData.blades });
      if (b.userData.orb) anim.push({ kind: 'orb', obj: b.userData.orb });
      b.rotation.y = tile.obj ? 0 : (rnd() - 0.5) * 0.3;
      g.add(b);
      if (broken && tile.obj) {
        const crack = mesh(geo.box(0.3, 0.04, 0.02), INK, 0, 0.35, 0.33, false);
        crack.rotation.z = 0.6;
        g.add(crack);
      }
      break;
    }
    case 'mountain': {
      const big = tile.hp >= 2;
      const m1 = mesh(geo.ico(big ? 0.42 : 0.32, 0), theme.snow ? 0xc8d2e6 : 0xa9a4bf, 0, big ? 0.3 : 0.18, 0);
      m1.scale.set(1, big ? 1.25 : 0.9, 1);
      m1.rotation.y = rnd() * 3;
      g.add(m1);
      if (big) g.add(mesh(geo.ico(0.24, 0), theme.snow ? 0xffffff : 0x9a94b2, 0.16, 0.62, -0.08));
      else g.add(mesh(geo.box(0.4, 0.04, 0.03), INK, 0, 0.32, 0.28, false).rotateZ(0.5));
      break;
    }
    case 'forest':
      g.add(tree(theme, rnd, -0.2, -0.15, 1.1), tree(theme, rnd, 0.22, -0.05, 0.9), tree(theme, rnd, -0.02, 0.24, 0.8));
      break;
    case 'sand': {
      const dune = mesh(geo.sph(0.3, 10, 6), 0xf0d48a, (rnd() - 0.5) * 0.3, -0.12, (rnd() - 0.5) * 0.3, false);
      dune.scale.set(1.2, 0.4, 0.9);
      g.add(dune);
      break;
    }
    case 'ice':
      if (tile.hp < 2) for (let i = 0; i < 3; i++) g.add(mesh(geo.box(0.5, 0.01, 0.02), 0x6a9ac0, (rnd() - 0.5) * 0.3, 0.005, (rnd() - 0.5) * 0.4, false).rotateY(rnd() * 3));
      break;
    case 'rubble':
      for (let i = 0; i < 5; i++) {
        const r = mesh(geo.box(0.12 + rnd() * 0.1, 0.08, 0.12), tile.wasObj ? 0xfff3dc : rnd() < 0.5 ? theme.wall : 0x9a94b2, (rnd() - 0.5) * 0.6, 0.04, (rnd() - 0.5) * 0.6, false);
        r.rotation.y = rnd() * 3;
        g.add(r);
      }
      break;
    default:
      if (rnd() < 0.25 && tile.t === 'ground') g.add(mesh(geo.sph(0.05, 6, 4), rnd() < 0.5 ? 0xffffff : 0xffe47a, (rnd() - 0.5) * 0.7, 0.02, (rnd() - 0.5) * 0.7, false));
  }
  if (tile.crate) {
    const c = new THREE.Group();
    c.add(mesh(geo.rbox(0.42, 0.36, 0.42, 0.04), 0xc98e4e, 0, 0.18, 0));
    c.add(mesh(geo.box(0.44, 0.06, 0.06), 0x8a5a32, 0, 0.18, 0.2, false), mesh(geo.box(0.06, 0.38, 0.44), 0x8a5a32, 0, 0.18, 0, false));
    const st = mesh(geo.ico(0.1, 0), toon(COLORS.gold, { emissive: 0x443300 }), 0, 0.5, 0, false);
    c.add(st);
    anim.push({ kind: 'spin', obj: st });
    g.add(c);
  }
  if (tile.fire) {
    const f = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const fl = mesh(geo.cone(0.1 + rnd() * 0.06, 0.32, 6), basic(i % 2 ? 0xff8c42 : 0xffd23f), (rnd() - 0.5) * 0.6, 0.15, (rnd() - 0.5) * 0.6, false);
      f.add(fl);
      anim.push({ kind: 'flame', obj: fl, ph: rnd() * 6 });
    }
    g.add(f);
  }
  if (tile.smoke) {
    const mat = glassMat(0xffffff, 0.75);
    for (let i = 0; i < 5; i++) {
      const p = new THREE.Mesh(geo.sph(0.2 + rnd() * 0.08, 10, 8), mat);
      p.position.set((rnd() - 0.5) * 0.55, 0.25 + rnd() * 0.35, (rnd() - 0.5) * 0.55);
      g.add(p);
      anim.push({ kind: 'puff', obj: p, ph: rnd() * 6, y: p.position.y });
    }
  }
  if (tile.shield && tile.t === 'building') {
    const s = new THREE.Mesh(geo.sph(0.55, 18, 12), glassMat(0x8fd8ff, 0.3));
    s.position.y = 0.4;
    g.add(s);
    anim.push({ kind: 'bubble', obj: s });
  }
  g.userData.anim = anim;
  return g;
}

/** A dirt mound with two eyes peeking out: a bug comes up here next turn. */
export function makeMound(egg = false) {
  const g = new THREE.Group();
  const m = mesh(geo.sph(0.3, 12, 8), egg ? 0xffe0f0 : 0x8a5a32, 0, 0, 0);
  m.scale.set(1.2, egg ? 0.9 : 0.45, 1.2);
  g.add(m);
  if (egg) {
    for (let i = 0; i < 4; i++) g.add(mesh(geo.sph(0.05, 6, 4), 0xff9fd0, Math.cos(i * 1.6) * 0.22, 0.12 + (i % 2) * 0.08, Math.sin(i * 1.6) * 0.22, false));
  } else {
    for (let i = 0; i < 5; i++) g.add(mesh(geo.ico(0.06, 0), 0x6a4422, Math.cos(i * 1.3) * 0.3, 0.05, Math.sin(i * 1.3) * 0.3, false));
    eyes(g, 0.12, 0.2, 0.08, 0.05);
  }
  return g;
}

function mulberry(a) {
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A flat arrow on the board from a to b (world xz), e.g. an intent or a push. */
export function makeArrow(color, len, { head = 0.26, width = 0.11, opacity = 0.9 } = {}) {
  const shape = new THREE.Shape();
  const L = Math.max(0.05, len - head);
  shape.moveTo(-width / 2, 0);
  shape.lineTo(width / 2, 0);
  shape.lineTo(width / 2, L);
  shape.lineTo(head * 0.75, L);
  shape.lineTo(0, len);
  shape.lineTo(-head * 0.75, L);
  shape.lineTo(-width / 2, L);
  shape.closePath();
  const g = new THREE.ShapeGeometry(shape);
  g.rotateX(-Math.PI / 2); // lies flat, pointing toward -z
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
  mat.userData = {};
  const m = new THREE.Mesh(g, mat);
  m.renderOrder = 5;
  return m;
}
