import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { COLORS, toon } from '../../core/palette.js';
import { mesh, box, cyl, sph, cone, ico, WOOD, WOOD_DARK, makeSign, makeBunting } from './models.js';

// Crab friends (the owner's crab update): cute toon crabs that are always friendly (red beach crabs, snow
// crabs, lobsters, babies and hermit crabs), the shells hermit crabs wear (found and crafted ones), the
// seaweed and old nets a crab can get tangled in, the glowing spot where a baby crab's family waits, and the
// pieces of Crab Cove (houses, flags, the dance ring, lanterns, the shell palace). All faces +z.

const INK = COLORS.ink;
const tor = (r, t, a = Math.PI * 2, rs = 8, ts = 18) => new THREE.TorusGeometry(r, t, rs, ts, a);
const _torCache = new Map();
const torus = (r, t, a) => { const k = `${r}|${t}|${a}`; if (!_torCache.has(k)) _torCache.set(k, tor(r, t, a)); return _torCache.get(k); };

export const CRAB_COLORS = { red: 0xff6a4a, snow: 0xe8f4ff, lobster: 0xd94a3a, baby: 0xff9a7a, hermit: 0xff8a5a };

// ---------- merging (few draw calls: a crab is about 13 meshes, a cove full of crabs stays cheap) ----------

const _merged = new Map();
/**
 * Build some meshes once (build(g) adds them to a group), merge them per material and cache the result by key;
 * returns a group with one mesh per material that shares the cached geometry.
 */
function mergedPart(key, build) {
  if (!_merged.has(key)) {
    const g = new THREE.Group();
    build(g);
    g.updateMatrixWorld(true);
    const by = new Map();
    g.traverse((o) => {
      if (!o.isMesh) return;
      let geo = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      for (const n of Object.keys(geo.attributes)) if (n !== 'position' && n !== 'normal') geo.deleteAttribute(n);
      geo.applyMatrix4(o.matrixWorld);
      if (!by.has(o.material)) by.set(o.material, { geos: [], shadow: false });
      const e = by.get(o.material);
      e.geos.push(geo);
      e.shadow ||= o.castShadow;
    });
    _merged.set(key, [...by.entries()].map(([mat, e]) => ({ mat, geo: mergeGeometries(e.geos, false), shadow: e.shadow })));
  }
  const out = new THREE.Group();
  for (const { mat, geo, shadow } of _merged.get(key)) {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = shadow;
    m.receiveShadow = true;
    out.add(m);
  }
  return out;
}

/**
 * A crab (faces +z, walks sideways along x). kind: red, snow, lobster, baby, hermit.
 * userData: body (bobs, flips), clawL / clawR (wave), legs (wiggle), shellSlot (hermit shells), eyes.
 */
export function makeCrab(kind = 'red', { shell = null } = {}) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const c = CRAB_COLORS[kind] ?? CRAB_COLORS.red;
  const lob = kind === 'lobster', hermit = kind === 'hermit';
  const dark = kind === 'snow' ? 0xb8d8f0 : lob ? 0xb83a2e : 0xe0543a;
  const ex = hermit ? 0.1 : 0.12, ez = hermit ? 0.2 : lob ? 0.3 : 0.2;
  // the body (one merged piece): a round, flat dome with eye stalks, cheeks and a smile
  body.add(mergedPart(`crab:${kind}:body`, (b) => {
    const shellBody = mesh(sph(0.32, 12, 8), c, 0, 0.26, 0);
    shellBody.scale.set(hermit ? 0.85 : lob ? 0.9 : 1.25, hermit ? 0.8 : 0.62, hermit ? 0.85 : lob ? 1.25 : 0.95);
    b.add(shellBody);
    if (kind === 'snow') for (const [x, z] of [[-0.18, 0.05], [0.16, -0.08], [0.02, 0.14]]) b.add(mesh(sph(0.06, 6, 4), 0x9fd0ff, x, 0.44, z, false));
    if (lob) {
      // a lobster's tail curls out behind it
      for (let i = 1; i < 4; i++) b.add(mesh(sph(0.2 - i * 0.03, 8, 6), c, 0, 0.24 - i * 0.02, -0.3 - i * 0.17));
      const fan = mesh(cone(0.16, 0.22, 5), dark, 0, 0.2, -0.95, false);
      fan.rotation.x = -Math.PI / 2;
      fan.scale.set(1.4, 1, 0.4);
      b.add(fan);
      for (const s of [-1, 1]) { const a = mesh(cyl(0.012, 0.012, 0.6, 4), dark, s * 0.08, 0.5, 0.42, false); a.rotation.set(0.9, 0, s * 0.4); b.add(a); }
    }
    for (const s of [-1, 1]) {
      b.add(mesh(cyl(0.025, 0.03, 0.18, 5), c, s * ex, 0.46, ez, false));
      if (!lob) { const ch = mesh(sph(0.05, 6, 4), 0xff9fb8, s * 0.2, 0.3, ez + 0.08, false); ch.scale.set(1.2, 0.6, 0.4); b.add(ch); }
    }
    b.add(mesh(torus(0.05, 0.012, Math.PI), INK, 0, 0.27, lob ? 0.38 : 0.29, false).rotateZ(Math.PI));
  }));
  // eyes on the stalks, with a shine (they blink)
  const eyes = [];
  for (const s of [-1, 1]) {
    const e = mergedPart(`crab:eye:${s}`, (b) => b.add(mesh(sph(0.075, 10, 8), 0xffffff, 0, 0, 0, false), mesh(sph(0.045, 8, 6), INK, 0, 0, 0.045, false), mesh(sph(0.016, 5, 4), 0xffffff, s * 0.012, 0.022, 0.085, false)));
    e.position.set(s * ex, 0.58, ez);
    body.add(e);
    eyes.push(e);
  }
  // claws: an arm and a round two-part pincer on a shoulder pivot (they wave)
  const claws = [];
  const big = lob ? 1.3 : 1;
  for (const s of [-1, 1]) {
    const sh = mergedPart(`crab:${kind}:claw:${s}`, (b) => {
      const arm = mesh(cyl(0.035, 0.04, 0.22, 5), c, 0, 0.06, 0.06, false);
      arm.rotation.x = 0.9;
      const p1 = mesh(sph(0.1 * big, 8, 6), dark, s * 0.04, 0.12, 0.18, false);
      p1.scale.set(0.8, 0.7, 1.15);
      const p2 = mesh(sph(0.06 * big, 6, 5), dark, s * 0.04, 0.12 + 0.07 * big, 0.24, false);
      p2.scale.set(0.7, 0.6, 1.3);
      b.add(arm, p1, p2);
    });
    sh.position.set(s * (hermit ? 0.22 : 0.3), 0.24, lob ? 0.3 : 0.2);
    body.add(sh);
    claws.push(sh);
  }
  // legs: three a side on one hinge per side (the sides wiggle in turn when the crab walks)
  const legs = [];
  for (const s of [-1, 1]) {
    const l = mergedPart(`crab:${kind}:legs:${s}`, (b) => {
      for (let i = 0; i < 3; i++) { const m = mesh(cyl(0.022, 0.016, 0.26, 4), c, s * 0.08, -0.06, 0.08 - i * 0.14, false); m.rotation.z = s * 1.0; b.add(m); }
    });
    l.position.set(s * (hermit ? 0.2 : 0.3), 0.18, 0);
    l.userData.s = s;
    l.userData.i = 0;
    body.add(l);
    legs.push(l);
  }
  // a hermit crab's shell sits on its back
  const shellSlot = new THREE.Group();
  shellSlot.position.set(0, 0.2, -0.16);
  body.add(shellSlot);
  if (kind === 'baby') g.scale.setScalar(0.48);
  g.userData = { body, clawL: claws[0], clawR: claws[1], legs, eyes, shellSlot, kind, t: Math.random() * 6 };
  if (hermit && shell) setHermitShell(g, shell);
  return g;
}

/** Put a shell on a hermit crab (or swap it): id of a shell, or 'tiny' for the outgrown one. */
export function setHermitShell(crab, id) {
  const slot = crab.userData.shellSlot;
  slot.clear();
  if (!id) return;
  const s = mergedPart(`shell:${id}`, (g) => g.add(makeShell(id)));
  const tiny = id === 'tiny';
  s.scale.setScalar(tiny ? 0.55 : 0.95);
  s.rotation.x = -0.35;
  s.position.set(0, tiny ? 0.12 : -0.04, tiny ? -0.02 : -0.12);
  slot.add(s);
  crab.userData.shellId = id;
}

/**
 * Animate a crab: walk (0..1 leg wiggle), wave (0..1 one claw up), dance (both claws up, a hop and a spin),
 * happy (a little hop). Call every frame.
 */
export function animateCrab(crab, dt, { walk = 0, wave = 0, dance = 0, wiggle = 0 } = {}) {
  const u = crab.userData;
  u.t += dt;
  const t = u.t;
  for (const l of u.legs) l.rotation.x = Math.sin(t * (walk ? 18 : 8 + wiggle * 16) + l.userData.i * 1.4 + (l.userData.s > 0 ? 0 : 1.6)) * (walk ? 0.55 : wiggle ? 0.7 : 0.08);
  const up = Math.max(wave, dance);
  u.clawR.rotation.z = -up * (1.2 + Math.sin(t * 10) * 0.35 * up);
  u.clawL.rotation.z = dance * (1.2 + Math.sin(t * 10 + 1) * 0.35);
  u.clawL.rotation.x = u.clawR.rotation.x = -0.1 + Math.sin(t * 3) * 0.06;
  u.body.position.y = dance ? Math.abs(Math.sin(t * 7)) * 0.18 * dance : walk ? Math.abs(Math.sin(t * 18)) * 0.03 : Math.sin(t * 2) * 0.01;
  // blink now and then
  const blink = (t % 3.7) < 0.12 ? 0.15 : 1;
  for (const e of u.eyes) e.scale.y = blink;
}

// ---------- shells ----------

/** Shells for hermit crabs. Found: spiral, conch. Crafted: castle, teapot, lantern, flower. 'tiny' = outgrown. */
export function makeShell(id) {
  const g = new THREE.Group();
  switch (id) {
    case 'tiny': {
      for (let i = 0; i < 3; i++) g.add(mesh(sph(0.2 - i * 0.05, 8, 6), i % 2 ? 0xd8c8b8 : 0xc8b8a8, 0, 0.18 + i * 0.13, -i * 0.03));
      break;
    }
    case 'spiralShell': {
      // a tall cream spiral with orange bands
      for (let i = 0; i < 5; i++) {
        const b = mesh(sph(0.36 - i * 0.065, 12, 8), i % 2 ? 0xff9f5a : 0xfff0d8, Math.sin(i * 1.3) * 0.03, 0.3 + i * 0.17, -i * 0.04);
        b.scale.set(1, 0.75, 1);
        g.add(b);
      }
      g.add(mesh(cone(0.08, 0.22, 8), 0xff9f5a, 0, 1.13, -0.2));
      const lip = mesh(torus(0.18, 0.05), 0xffd8c8, 0, 0.26, 0.3, false);
      lip.scale.set(1, 1.2, 1);
      g.add(lip);
      break;
    }
    case 'conchShell': {
      // a pink conch with little spikes and a flared lip
      const b = mesh(sph(0.36, 12, 10), 0xffb8d0, 0, 0.36, 0);
      b.scale.set(1, 0.95, 1.15);
      g.add(b, mesh(cone(0.22, 0.45, 10), 0xff9fc0, 0, 0.82, -0.08));
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; const sp = mesh(cone(0.05, 0.18, 5), 0xffe0ea, Math.cos(a) * 0.3, 0.62, Math.sin(a) * 0.3 - 0.05, false); sp.rotation.set(Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9); g.add(sp); }
      const lip = mesh(sph(0.26, 10, 8), 0xffe8f0, 0, 0.3, 0.26, false);
      lip.scale.set(1.1, 1.0, 0.35);
      g.add(lip);
      break;
    }
    case 'castleShell': {
      // a little sandcastle tower with a flag
      g.add(mesh(cyl(0.3, 0.34, 0.6, 10), 0xf0d48a, 0, 0.3, 0));
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; g.add(mesh(box(0.12, 0.14, 0.12), 0xf0d48a, Math.cos(a) * 0.26, 0.66, Math.sin(a) * 0.26)); }
      g.add(mesh(box(0.16, 0.22, 0.05), 0x8a5a32, 0, 0.18, 0.32, false));
      g.add(mesh(cyl(0.012, 0.012, 0.4, 4), WOOD_DARK, 0, 0.85, 0, false), mesh(box(0.18, 0.11, 0.02), 0xff5d73, 0.09, 0.98, 0, false));
      for (const [x, y] of [[-0.18, 0.4], [0.2, 0.25]]) g.add(mesh(sph(0.04, 6, 4), 0xffffff, x, y, 0.3, false));
      break;
    }
    case 'teapotShell': {
      // a blue teapot with white dots, a spout and a handle
      const b = mesh(sph(0.34, 14, 10), 0x8fd8ff, 0, 0.32, 0);
      b.scale.set(1, 0.85, 1);
      g.add(b, mesh(cyl(0.18, 0.22, 0.08, 12), 0x8fd8ff, 0, 0.6, 0), mesh(sph(0.06, 8, 6), 0xffffff, 0, 0.68, 0));
      const sp = mesh(cyl(0.04, 0.07, 0.3, 8), 0x8fd8ff, 0.36, 0.38, 0);
      sp.rotation.z = -0.9;
      g.add(sp);
      const h = mesh(torus(0.14, 0.035, Math.PI), 0x8fd8ff, -0.33, 0.36, 0);
      h.rotation.z = Math.PI / 2;
      g.add(h);
      for (const [x, y, z] of [[0.15, 0.4, 0.27], [-0.12, 0.28, 0.29], [0.02, 0.18, 0.3], [-0.2, 0.46, 0.18]]) g.add(mesh(sph(0.035, 6, 4), 0xffffff, x, y, z, false));
      break;
    }
    case 'lanternShell': {
      // a little paper lantern that glows (sea glass windows)
      g.add(mesh(cyl(0.26, 0.26, 0.5, 10), toon(0xffe08a, { emissive: 0x806020 }), 0, 0.34, 0));
      g.add(mesh(cyl(0.3, 0.3, 0.06, 10), 0xff5d73, 0, 0.6, 0), mesh(cyl(0.3, 0.3, 0.06, 10), 0xff5d73, 0, 0.08, 0));
      g.add(mesh(torus(0.12, 0.02, Math.PI), INK, 0, 0.64, 0, false));
      for (const [a, c] of [[0.4, 0x8fe0c0], [-0.6, 0x8fc0ff], [2.4, 0xc0f0a0]]) g.add(mesh(box(0.1, 0.14, 0.03), toon(c, { emissive: 0x224433 }), Math.sin(a) * 0.26, 0.36, Math.cos(a) * 0.26, false).rotateY(a));
      break;
    }
    case 'flowerShell': {
      // a spiral shell with a little garden on top
      for (let i = 0; i < 3; i++) { const b = mesh(sph(0.34 - i * 0.07, 12, 8), i % 2 ? 0xffd27a : 0xfff3dc, 0, 0.28 + i * 0.16, -i * 0.03); b.scale.set(1, 0.75, 1); g.add(b); }
      for (const [x, z, c] of [[0, 0, 0xff7eb6], [0.12, 0.08, 0xffd23f], [-0.12, 0.06, 0xb08bff], [0.05, -0.12, 0xffffff]]) {
        g.add(mesh(cyl(0.012, 0.012, 0.2, 4), 0x58b947, x, 0.72, z, false));
        const f = mesh(ico(0.07, 0), c, x, 0.83, z, false);
        f.scale.y = 0.5;
        g.add(f);
      }
      g.add(mesh(box(0.14, 0.02, 0.06), 0x58b947, 0.06, 0.74, 0.02, false).rotateY(0.6));
      break;
    }
    default:
      g.add(mesh(ico(0.3, 0), 0xffd8c8, 0, 0.3, 0));
  }
  return g;
}

// ---------- helping ----------

/** Seaweed or an old fishing net wrapped around a crab. userData.parts come off one by one. */
export function makeTangle(style = 'weed') {
  const g = new THREE.Group();
  const parts = [];
  if (style === 'net') {
    for (let i = 0; i < 3; i++) {
      const p = new THREE.Group();
      for (let k = 0; k < 3; k++) {
        const r = mesh(cyl(0.012, 0.012, 1.0, 4), 0x9a7a5a, -0.3 + k * 0.3, 0.32, 0, false);
        r.rotation.set(0.4 + i * 0.9, i * 1.1, Math.PI / 2 + (i - 1) * 0.5);
        p.add(r);
      }
      if (i === 0) p.add(mesh(sph(0.08, 8, 6), 0xff8c42, 0.42, 0.5, 0.1, false));
      g.add(p);
      parts.push(p);
    }
  } else {
    for (let i = 0; i < 3; i++) {
      const p = new THREE.Group();
      const r = mesh(torus(0.42 - i * 0.04, 0.035), i % 2 ? 0x3fae6a : 0x58c47a, 0, 0.3 + i * 0.05, 0, false);
      r.rotation.set(Math.PI / 2 + (i - 1) * 0.5, i * 0.8, 0);
      r.scale.set(1.15, 0.9, 1);
      p.add(r);
      const leaf = mesh(box(0.14, 0.32, 0.03), 0x3fae6a, Math.cos(i * 2) * 0.4, 0.5, Math.sin(i * 2) * 0.3, false);
      leaf.rotation.z = 0.4 * (i - 1);
      p.add(leaf);
      g.add(p);
      parts.push(p);
    }
  }
  g.userData.parts = parts;
  return g;
}

let _glowMats = null;
function glowMats() {
  if (!_glowMats) {
    _glowMats = {
      disc: new THREE.MeshBasicMaterial({ color: 0x8ff0ff, transparent: true, opacity: 0.35, depthWrite: false }),
      ring: new THREE.MeshBasicMaterial({ color: 0xbff6ff, transparent: true, opacity: 0.8, depthWrite: false }),
    };
    for (const m of Object.values(_glowMats)) m.userData = {};
  }
  return _glowMats;
}

/** The glowing spot where a baby crab's family waits (a soft ring on the sand). */
export function makeFamilySpot() {
  const g = new THREE.Group();
  const M = glowMats();
  const d = new THREE.Mesh(cyl(1.0, 1.0, 0.02, 24), M.disc);
  d.position.y = 0.05;
  const r = new THREE.Mesh(torus(1.0, 0.05, Math.PI * 2, 6, 32), M.ring);
  r.rotation.x = Math.PI / 2;
  r.position.y = 0.07;
  d.renderOrder = r.renderOrder = 20; // drawn after the night dive's dark veil, so it glows in the dark
  g.add(d, r);
  g.userData.ring = r;
  return g;
}

/** A little bubble with "!" (a crab who needs help), or a thought bubble with a shell in it (a hermit crab). */
export function makeHelpBubble(shell = false) {
  const g = new THREE.Group();
  const b = mesh(sph(0.26, 12, 8), 0xffffff, 0, 0, 0, false);
  b.scale.set(1, 0.9, 0.6);
  g.add(b, mesh(sph(0.07, 6, 4), 0xffffff, -0.18, -0.28, 0, false), mesh(sph(0.04, 6, 4), 0xffffff, -0.26, -0.4, 0, false));
  if (shell) {
    const s = makeShell('spiralShell');
    s.scale.setScalar(0.28);
    s.position.set(0, -0.15, 0.1);
    g.add(s);
  } else g.add(mesh(box(0.07, 0.22, 0.05), 0xff5d73, 0, 0.05, 0.14, false), mesh(sph(0.04, 6, 4), 0xff5d73, 0, -0.13, 0.14, false));
  return g;
}

// ---------- Crab Cove ----------

/** The cove's little sign: a wooden board with a crab painted on. */
export function makeCoveSign() {
  const g = makeSign(0xffd8c8, 1.3);
  const c = makeCrab('red');
  c.scale.setScalar(0.42);
  c.position.set(0, 1.0, 0.1);
  g.add(c);
  return g;
}

/** A crab house: a sandcastle with a round door (crabs pop in and out). */
export function makeCrabHouse() {
  const g = new THREE.Group();
  g.add(mesh(cyl(0.55, 0.65, 0.55, 10), 0xf0d48a, 0, 0.27, 0), mesh(cyl(0.38, 0.45, 0.4, 10), 0xf0d48a, 0, 0.75, 0), mesh(cone(0.3, 0.35, 10), 0xe8c878, 0, 1.12, 0));
  for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; g.add(mesh(box(0.14, 0.14, 0.14), 0xf0d48a, Math.cos(a) * 0.5, 0.6, Math.sin(a) * 0.5)); }
  g.add(mesh(cyl(0.16, 0.16, 0.06, 12), 0x5a3a2a, 0, 0.18, 0.58, false).rotateX(Math.PI / 2));
  g.add(mesh(cyl(0.01, 0.01, 0.4, 4), WOOD_DARK, 0, 1.4, 0, false), mesh(box(0.2, 0.12, 0.02), 0xff5d73, 0.1, 1.52, 0, false));
  for (const [x, y, z, c] of [[0.3, 0.35, 0.45, 0xffd8c8], [-0.35, 0.5, 0.38, 0xffffff], [0.1, 0.85, 0.36, 0xff9fc0]]) g.add(mesh(sph(0.05, 6, 4), c, x, y, z, false));
  return g;
}

/** A shell house: a giant shell lying on the sand with a round door. */
export function makeShellHouse(id = 'conchShell') {
  const g = new THREE.Group();
  const s = makeShell(id);
  s.scale.setScalar(1.6);
  s.rotation.y = 0.3;
  g.add(s);
  g.add(mesh(cyl(0.18, 0.18, 0.06, 12), 0x5a3a2a, 0, 0.22, 0.52, false).rotateX(Math.PI / 2));
  g.add(mesh(box(0.22, 0.03, 0.12), 0xff9fc0, 0, 0.03, 0.75, false));
  return g;
}

/** A ring of small shells on the sand: the crabs' dance floor. */
export function makeDanceRing(r = 1.6) {
  const g = new THREE.Group();
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const s = mesh(sph(0.1, 6, 4), [0xffd8c8, 0xffffff, 0xff9fc0, 0xffd27a][i % 4], Math.cos(a) * r, 0.04, Math.sin(a) * r, false);
    s.scale.set(1.3, 0.45, 1);
    g.add(s);
  }
  return g;
}

/** A shell lantern on a driftwood post (glows at night with the island's lamp material). */
export function makeShellLantern(M) {
  const g = new THREE.Group();
  g.add(mesh(cyl(0.05, 0.07, 1.1, 6), WOOD, 0, 0.55, 0));
  const l = mesh(sph(0.16, 10, 8), M.lamp, 0, 1.2, 0, false);
  l.scale.set(1, 1.2, 1);
  g.add(l, mesh(cone(0.2, 0.16, 8), 0xff9fc0, 0, 1.42, 0, false));
  return g;
}

/** The shell palace (the cove's last level): a big pink conch with towers and a flag. */
export function makeShellPalace() {
  const g = new THREE.Group();
  const s = makeShell('conchShell');
  s.scale.setScalar(2.6);
  g.add(s);
  for (const x of [-1.1, 1.1]) {
    const tw = makeShell('spiralShell');
    tw.scale.setScalar(1.2);
    tw.position.set(x, 0, -0.2);
    g.add(tw);
  }
  g.add(mesh(cyl(0.3, 0.3, 0.06, 14), 0x5a3a2a, 0, 0.4, 0.86, false).rotateX(Math.PI / 2));
  g.add(mesh(cyl(0.02, 0.02, 0.8, 4), WOOD_DARK, 0, 2.9, -0.2, false), mesh(box(0.4, 0.24, 0.02), 0xffd23f, 0.2, 3.15, -0.2, false));
  return g;
}

/** A tiny crab drum and a starfish stage (the crab band at the shell palace). */
export function makeCrabDrum() {
  const g = new THREE.Group();
  g.add(mesh(cyl(0.22, 0.22, 0.3, 12), 0xff5d73, 0, 0.15, 0), mesh(cyl(0.23, 0.23, 0.02, 12), 0xfff3dc, 0, 0.31, 0, false));
  for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; const arm = mesh(cone(0.14, 0.5, 5), 0xff8c42, Math.cos(a) * 0.3, 0.02, Math.sin(a) * 0.3, false); arm.rotation.set(0, -a, -Math.PI / 2); arm.scale.y = 0.4; g.add(arm); }
  return g;
}

/** A small tide pool with a stone rim (the cove's own). */
export function makeCovePool() {
  const g = new THREE.Group();
  g.add(mesh(cyl(0.85, 0.85, 0.04, 18), toon(0x7fd8e8, { transparent: true, opacity: 0.85 }), 0, 0.04, 0, false));
  for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; const r = mesh(ico(0.2 + (i % 3) * 0.04, 0), 0xb8b2c8, Math.cos(a) * 0.9, 0.06, Math.sin(a) * 0.75, false); r.scale.y = 0.6; g.add(r); }
  return g;
}

/** Flags on two sticks over the cove. */
export function makeCoveFlags(a, b) {
  const g = new THREE.Group();
  for (const p of [a, b]) g.add(mesh(cyl(0.04, 0.05, 2.0, 5), WOOD, p.x, 1.0, p.z));
  g.add(makeBunting({ x: a.x, y: 1.9, z: a.z }, { x: b.x, y: 1.9, z: b.z }, 0.4));
  return g;
}

// ---------- yard decorations (cove rewards) ----------

export const DECO7 = new Set(['crabStatue', 'crabPlush']);

export function makeDeco7(id) {
  const g = new THREE.Group();
  if (id === 'crabStatue') {
    g.add(mesh(cyl(0.45, 0.5, 0.3, 10), 0xd9cbb2, 0, 0.15, 0));
    const c = makeCrab('red');
    c.scale.setScalar(1.2);
    c.position.y = 0.3;
    c.userData.clawR.rotation.z = -1.3;
    c.userData.clawL.rotation.z = 1.3;
    c.traverse((o) => { if (o.isMesh && o.material !== toon(0xffffff) && o.material !== toon(INK)) o.material = toon(0xffd23f); });
    g.add(c);
  } else {
    const c = makeCrab('red');
    c.scale.setScalar(1.6);
    c.userData.clawR.rotation.z = -0.8;
    g.add(c, mesh(sph(0.12, 8, 6), 0xff5d73, 0.35, 0.9, 0.1, false));
  }
  return g;
}
