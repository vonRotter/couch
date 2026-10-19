import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { COLORS, PLAYER_COLORS, toon, sharedGeo } from '../../core/palette.js';
import { Character, darken } from '../../core/character.js';
import { makeGrumble } from '../../core/critters.js';
import { makeTree, makeCloud, makeRock, seeded } from '../../core/world.js';

// Paint Pilots models: toon biplanes and triplanes, grumble blimps, parachutes and the airfield.
// Planes are built with the nose on +x, up on +y and the wings spanning z (toward the camera).

export const XW = 44; // half width of the flying area (soft walls beyond)
export const SEA_X = -31; // left of this is the sea
export const RUNWAY = 20; // runway half length

const rbox = (key, w, h, d, r = 0.05) => sharedGeo(`df-${key}`, () => new RoundedBoxGeometry(w, h, d, 2, r));
const cyl = (key, rt, rb, h, seg = 14) => sharedGeo(`df-${key}`, () => new THREE.CylinderGeometry(rt, rb, h, seg));
const sph = (r, w = 14, h = 10) => sharedGeo(`df-sph${r}|${w}`, () => new THREE.SphereGeometry(r, w, h));

function mesh(geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

/** Mixes a color toward white (f = 0..1). */
export function tint(hex, f) {
  const c = new THREE.Color(hex);
  c.lerp(new THREE.Color(0xffffff), f);
  return c.getHex();
}

/**
 * A cute vintage plane. kind 'bi' or 'tri'. pilot: { color, hat } for a bean, or { grumble: color }.
 * Returns { group, body, prop, ch, pilot, splats, wings[] }; body gets the flight rotation.
 */
export function makePlane({ color, wing = tint(color, 0.45), kind = 'bi', pilot = {}, trim = COLORS.cream }) {
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);
  const main = toon(color);
  const wingMat = toon(wing);
  const ink = toon(COLORS.ink);

  // Fuselage: fat at the nose, thin at the tail.
  const fus = mesh(cyl('fus', 0.46, 0.24, 2.0, 16), main);
  fus.rotation.z = -Math.PI / 2;
  body.add(fus);
  const tail = mesh(cyl('tail', 0.24, 0.07, 0.75, 12), main, -1.37, 0, 0);
  tail.rotation.z = -Math.PI / 2;
  body.add(tail);
  const band = mesh(cyl('band', 0.33, 0.33, 0.14, 16), toon(trim), -0.72, 0, 0);
  band.rotation.z = -Math.PI / 2;
  body.add(band);
  // Engine cowl, spinner and propeller.
  const cowl = mesh(cyl('cowl', 0.44, 0.5, 0.34, 16), toon(trim), 1.12, 0, 0);
  cowl.rotation.z = -Math.PI / 2;
  body.add(cowl);
  const prop = new THREE.Group();
  prop.position.x = 1.36;
  const spinner = mesh(sharedGeo('df-spinner', () => new THREE.ConeGeometry(0.17, 0.32, 12)), toon(COLORS.gold), 0.12, 0, 0);
  spinner.rotation.z = -Math.PI / 2;
  prop.add(spinner);
  for (const s of [-1, 1]) {
    const blade = mesh(rbox('blade', 0.05, 0.62, 0.15, 0.02), toon(0xa0704a), 0.02, s * 0.33, 0);
    prop.add(blade);
    const tip = mesh(rbox('bladeTip', 0.06, 0.12, 0.16, 0.02), toon(0xff5d73), 0.02, s * 0.6, 0);
    prop.add(tip);
  }
  body.add(prop);

  // Wings and struts.
  const wings = [];
  const levels = kind === 'tri' ? [[-0.32, 2.2], [0.3, 2.2], [0.92, 2.2]] : [[-0.3, 2.4], [0.88, 2.6]];
  for (const [y, span] of levels) {
    const w = mesh(rbox(`wing${span}`, kind === 'tri' ? 0.78 : 0.95, 0.1, span, 0.04), wingMat, 0.28, y, 0);
    body.add(w);
    wings.push(w);
    // Little colored tips.
    for (const s of [-1, 1]) body.add(mesh(rbox('wingTip', 0.8, 0.12, 0.3, 0.04), main, 0.28, y, s * (span / 2 - 0.12)));
  }
  const top = levels[levels.length - 1][0], bot = levels[0][0];
  for (const z of [-0.85, 0.85, -0.4, 0.4]) {
    const strut = mesh(cyl('strut', 0.035, 0.035, top - bot, 6), ink, 0.28, (top + bot) / 2, z);
    body.add(strut);
  }
  // Tail fin and stabilizer.
  body.add(mesh(rbox('fin', 0.55, 0.62, 0.07, 0.03), wingMat, -1.55, 0.36, 0));
  body.add(mesh(rbox('stab', 0.48, 0.07, 1.1, 0.03), wingMat, -1.55, 0.04, 0));
  // Wheels.
  for (const z of [-0.42, 0.42]) {
    const leg = mesh(cyl('leg', 0.03, 0.03, 0.5, 6), ink, 0.48, -0.48, z * 0.85);
    leg.rotation.x = z > 0 ? -0.25 : 0.25;
    body.add(leg);
    const wheel = mesh(cyl('wheel', 0.22, 0.22, 0.12, 14), ink, 0.48, -0.72, z);
    wheel.rotation.x = Math.PI / 2;
    body.add(wheel);
    const hub = mesh(cyl('hub', 0.08, 0.08, 0.14, 8), toon(COLORS.gold), 0.48, -0.72, z);
    hub.rotation.x = Math.PI / 2;
    body.add(hub);
  }
  body.add(mesh(cyl('tailWheel', 0.08, 0.08, 0.08, 8), ink, -1.55, -0.3, 0));
  // Windscreen.
  const glass = mesh(rbox('glass', 0.08, 0.22, 0.42, 0.03), toon(0xbfe9ff, { transparent: true, opacity: 0.6 }), 0.05, 0.5, 0);
  glass.rotation.z = -0.4;
  body.add(glass);

  // Pilot: a bean with a scarf, or a grumble.
  const pilotSlot = new THREE.Group();
  pilotSlot.position.set(-0.32, 0.02, 0);
  body.add(pilotSlot);
  let ch = null;
  if (pilot.grumble !== undefined) {
    const gr = makeGrumble(pilot.grumble);
    gr.scale.setScalar(0.8);
    gr.position.y = 0.06;
    gr.rotation.y = Math.PI / 2 - 0.5;
    pilotSlot.add(gr);
  } else {
    ch = new Character(pilot.color ?? color, { hat: pilot.hat ?? 0 });
    ch.group.scale.setScalar(0.55);
    pilotSlot.add(ch.group);
  }
  const scarf = mesh(rbox('scarf', 0.55, 0.08, 0.13, 0.03), toon(pilot.grumble !== undefined ? 0xffffff : tint(pilot.color ?? color, 0.25)), -0.62, 0.42, 0.18);
  body.add(scarf);

  const splats = new THREE.Group();
  body.add(splats);
  return { group, body, prop, ch, pilotSlot, scarf, splats, wings };
}

/** A blob of paint stuck to a plane (or blimp), mirrored on both sides so it shows after a flip. */
export function addSplat(target, color, rand = Math.random, spots = null) {
  const geo = sharedGeo('df-splat', () => new THREE.SphereGeometry(0.2, 10, 6));
  const spot = spots ? spots[Math.floor(rand() * spots.length)] : [-1 + rand() * 1.8, (rand() - 0.5) * 0.3, 0.38];
  const [x, y, z] = spot;
  for (const s of [-1, 1]) {
    const m = new THREE.Mesh(geo, toon(color));
    m.position.set(x, y, z * s);
    m.scale.set(1.3 + rand() * 0.6, 1 + rand() * 0.6, 0.35);
    m.rotation.z = rand() * 3;
    target.add(m);
  }
}

/** Grumble blimp. size 1 for normal, ~2 for the boss. Faces +x; mirror with scale.x = -1. */
export function makeBlimp(size = 1, color = 0x9b5de5, boss = false) {
  const group = new THREE.Group();
  const inner = new THREE.Group();
  inner.scale.setScalar(size);
  group.add(inner);
  const env = mesh(sph(1, 24, 16), toon(color));
  env.scale.set(3.1, 1.3, 1.3);
  inner.add(env);
  const band = mesh(cyl('bBand', 1.0, 1.0, 0.36, 24), toon(boss ? COLORS.gold : COLORS.cream));
  band.rotation.z = Math.PI / 2;
  band.scale.set(1.33, 1, 1.33);
  inner.add(band);
  for (const x of [-1.6, 1.6]) {
    const b2 = mesh(cyl('bBand2', 1.0, 1.0, 0.22, 24), toon(tint(color, 0.4)), x, 0, 0);
    b2.rotation.z = Math.PI / 2;
    b2.scale.set(1.05, 1, 1.05);
    inner.add(b2);
  }
  // Tail fins.
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const fin = mesh(rbox('bFin', 0.9, 0.08, 0.9, 0.04), toon(tint(color, 0.5)), -2.7, Math.sin(a) * 0.55, Math.cos(a) * 0.55);
    fin.rotation.x = -a;
    inner.add(fin);
  }
  // Gondola with a grumble pilot.
  inner.add(mesh(rbox('bGond', 1.3, 0.45, 0.7, 0.12), toon(0xa0704a), 0.2, -1.45, 0));
  for (const x of [-0.3, 0.7]) inner.add(mesh(cyl('bRope', 0.03, 0.03, 0.5, 5), toon(COLORS.ink), x, -1.15, 0));
  const gr = makeGrumble(0x7b6cf6);
  gr.scale.setScalar(0.7);
  gr.position.set(0.25, -1.55, 0.1);
  gr.rotation.y = 0.5;
  inner.add(gr);
  // Big grumpy face on the front of the envelope, on both sides.
  for (const s of [-1, 1]) {
    for (const e of [-1, 1]) {
      const white = mesh(sph(0.28), toon(COLORS.white), 2.15 + e * 0.32, 0.25, s * 0.85);
      white.scale.z = 0.5;
      const pupil = mesh(sph(0.13), toon(COLORS.ink), 2.25 + e * 0.32, 0.22, s * 0.98);
      const brow = mesh(rbox('bBrow', 0.4, 0.1, 0.08, 0.03), toon(COLORS.ink), 2.15 + e * 0.32, 0.6, s * 0.92);
      brow.rotation.z = e * 0.4;
      inner.add(white, pupil, brow);
    }
  }
  if (boss) {
    const ring = mesh(cyl('bCrown', 0.55, 0.5, 0.35, 16), toon(COLORS.gold), 0.6, 1.35, 0);
    inner.add(ring);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      inner.add(mesh(sharedGeo('df-crownSpike', () => new THREE.ConeGeometry(0.13, 0.35, 8)), toon(COLORS.gold), 0.6 + Math.cos(a) * 0.48, 1.65, Math.sin(a) * 0.48));
    }
  }
  const prop = new THREE.Group();
  prop.position.set(-0.6, -1.45, 0);
  for (const s of [-1, 1]) prop.add(mesh(rbox('bBlade', 0.05, 0.5, 0.1, 0.02), toon(COLORS.ink), -0.1, s * 0.25, 0));
  inner.add(prop);
  const splats = new THREE.Group();
  inner.add(splats);
  return { group, inner, prop, splats, env };
}

/** Parachute with a hanging pilot (bean or grumble). The canopy top sits at y = 0. */
export function makeChute({ color, hat = 0, grumble }) {
  const group = new THREE.Group();
  const canopy = mesh(sharedGeo('df-canopy', () => new THREE.SphereGeometry(1.25, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2)), toon(color), 0, -0.85, 0);
  canopy.scale.y = 0.7;
  group.add(canopy);
  const stripe = mesh(sharedGeo('df-canopyTop', () => new THREE.SphereGeometry(0.62, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2)), toon(COLORS.white), 0, -0.85 + 0.53, 0);
  stripe.scale.y = 0.58;
  group.add(stripe);
  // Strings from the canopy rim down to the pilot's shoulders.
  const up = new THREE.Vector3(0, 1, 0);
  for (const [x, z] of [[-1.15, 0], [1.15, 0], [0, -1.15], [0, 1.15]]) {
    const a = new THREE.Vector3(x, -0.85, z), b = new THREE.Vector3(x * 0.15, -2.35, z * 0.15);
    const d = b.clone().sub(a);
    const s = mesh(cyl('chuteStr', 0.02, 0.02, 1, 4), toon(COLORS.ink));
    s.scale.y = d.length();
    s.position.copy(a).addScaledVector(d, 0.5);
    s.quaternion.setFromUnitVectors(up, d.normalize());
    group.add(s);
  }
  let ch = null;
  if (grumble !== undefined) {
    const gr = makeGrumble(grumble);
    gr.scale.setScalar(0.85);
    gr.position.y = -2.75;
    group.add(gr);
  } else {
    ch = new Character(color, { hat });
    ch.group.scale.setScalar(0.62);
    ch.group.position.y = -3.0;
    group.add(ch.group);
  }
  group.visible = false;
  return { group, ch };
}

/** Paint pellet. */
export function makePellet(color, r = 0.2) {
  const m = new THREE.Mesh(sharedGeo(`df-pellet${r}`, () => new THREE.SphereGeometry(r, 10, 8)), toon(color));
  return m;
}

/** The airfield: grass, runway, hangars, tower, sea with a lighthouse, hills, trees and clouds. */
export function buildWorld(scene) {
  const rand = seeded(1942);
  const add = (m) => { scene.add(m); return m; };
  const FAR = XW + 70;

  // Ground strip (right of the sea) with a darker front edge.
  const gw = FAR - SEA_X;
  const ground = add(new THREE.Mesh(new THREE.BoxGeometry(gw, 6, 60), toon(COLORS.grass)));
  ground.position.set(SEA_X + gw / 2, -3, -24);
  ground.receiveShadow = true;
  const lip = add(new THREE.Mesh(new THREE.BoxGeometry(gw, 0.5, 1.2), toon(COLORS.grassDark)));
  lip.position.set(SEA_X + gw / 2, -0.2, 6.2);
  // Beach.
  const beach = add(new THREE.Mesh(new THREE.BoxGeometry(5, 6, 60), toon(COLORS.sand)));
  beach.position.set(SEA_X + 1.5, -3.15, -24);
  beach.receiveShadow = true;
  // Sea.
  const sea = add(new THREE.Mesh(new THREE.BoxGeometry(80, 6, 80), toon(COLORS.water)));
  sea.position.set(SEA_X - 40 + 0.5, -3.35, -30);
  sea.receiveShadow = true;
  const waves = [];
  for (let i = 0; i < 16; i++) {
    const w = add(new THREE.Mesh(sharedGeo('df-wave', () => new THREE.SphereGeometry(0.6, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2)), toon(COLORS.white)));
    w.scale.set(2.2, 0.3, 0.6);
    w.position.set(SEA_X - 3 - rand() * 50, -0.35, 4 - rand() * 30);
    w.userData.phase = rand() * 6;
    waves.push(w);
  }
  // Lighthouse on a rock.
  const rock = add(makeRock(rand, 3));
  rock.position.set(SEA_X - 18, -0.5, -14);
  const lh = new THREE.Group();
  lh.position.set(SEA_X - 18, 1, -14);
  for (let i = 0; i < 4; i++) {
    lh.add(mesh(cyl(`lh${i}`, 1.0 - i * 0.12 - 0.12, 1.0 - i * 0.12, 1.6, 16), toon(i % 2 ? COLORS.white : 0xff5d73), 0, 0.8 + i * 1.6, 0));
  }
  lh.add(mesh(cyl('lhTop', 0.6, 0.6, 0.8, 12), toon(0xfff3a0, { emissive: 0x554400 }), 0, 7.0, 0));
  lh.add(mesh(sharedGeo('df-lhRoof', () => new THREE.ConeGeometry(0.8, 0.9, 12)), toon(0xff5d73), 0, 7.85, 0));
  add(lh);

  // Runway with white dashes.
  const rw = add(new THREE.Mesh(new THREE.BoxGeometry(RUNWAY * 2, 0.1, 4.2), toon(0xb8b2cc)));
  rw.position.set(0, 0.02, 0);
  rw.receiveShadow = true;
  for (let x = -RUNWAY + 2; x <= RUNWAY - 2; x += 4) {
    const d = add(new THREE.Mesh(sharedGeo('df-dash', () => new THREE.BoxGeometry(1.8, 0.04, 0.3)), toon(COLORS.white)));
    d.position.set(x, 0.09, 1.0);
  }
  for (const s of [-1, 1]) {
    for (let k = 0; k < 4; k++) {
      const m = add(new THREE.Mesh(sharedGeo('df-thr', () => new THREE.BoxGeometry(0.3, 0.04, 1.4)), toon(COLORS.white)));
      m.position.set(s * (RUNWAY - 0.8 - k * 0.6), 0.09, 0);
    }
  }

  // Hangars behind the runway.
  const hangarColors = [0xff9fd0, 0x8fd8ff, 0xffe47a];
  [-13, 0, 13].forEach((x, i) => {
    const h = new THREE.Group();
    h.position.set(x, 0, -9);
    // Half cylinder lying along z with the arc on top.
    const roof = mesh(new THREE.CylinderGeometry(3.4, 3.4, 7, 20, 1, false, -Math.PI / 2, Math.PI), toon(hangarColors[i]), 0, 0, 0);
    roof.rotation.x = -Math.PI / 2;
    h.add(roof);
    const door = mesh(new THREE.CircleGeometry(3.0, 20, 0, Math.PI), toon(COLORS.ink), 0, 0.02, 3.52);
    h.add(door);
    const frame = mesh(new THREE.RingGeometry(3.0, 3.42, 20, 1, 0, Math.PI), toon(COLORS.white), 0, 0.02, 3.53);
    h.add(frame);
    const num = mesh(new THREE.CircleGeometry(0.7, 16), toon(COLORS.white), 0, 2.6, 3.56);
    h.add(num);
    const dot = mesh(new THREE.CircleGeometry(0.42, 16), toon(PLAYER_COLORS[i * 2].hex), 0, 2.6, 3.57);
    h.add(dot);
    add(h);
  });
  // Control tower with a windsock.
  const tower = new THREE.Group();
  tower.position.set(24, 0, -7);
  tower.add(mesh(new RoundedBoxGeometry(2.2, 6, 2.2, 2, 0.15), toon(COLORS.cream), 0, 3, 0));
  tower.add(mesh(new RoundedBoxGeometry(3.2, 1.6, 3.2, 2, 0.2), toon(0xbfe9ff), 0, 6.8, 0));
  tower.add(mesh(new RoundedBoxGeometry(3.6, 0.4, 3.6, 2, 0.15), toon(0xff5d73), 0, 7.8, 0));
  tower.add(mesh(cyl('pole', 0.06, 0.06, 2.4, 6), toon(COLORS.ink), 1.2, 9.2, 0));
  const sock = new THREE.Group();
  sock.position.set(1.2, 10.2, 0);
  for (let i = 0; i < 4; i++) {
    const seg = mesh(cyl(`sock${i}`, 0.32 - i * 0.05, 0.27 - i * 0.05, 0.42, 10), toon(i % 2 ? COLORS.white : 0xff8c42), 0.25 + i * 0.4, 0, 0);
    seg.rotation.z = Math.PI / 2;
    sock.add(seg);
  }
  tower.add(sock);
  add(tower);

  // Boundary pylons at the soft walls: striped poles with flags.
  for (const s of [-1, 1]) {
    const x = s * (XW + 2);
    const base = s < 0 ? -0.2 : 0;
    const p = new THREE.Group();
    p.position.set(x, base, -3);
    for (let i = 0; i < 6; i++) p.add(mesh(cyl('pyl', 0.35, 0.35, 1.5, 10), toon(i % 2 ? COLORS.white : 0xff5d73), 0, 0.75 + i * 1.5, 0));
    const flag = mesh(sharedGeo('df-pflag', () => new THREE.ConeGeometry(0.8, 1.8, 3)), toon(COLORS.gold), -s * 0.9, 8.4, 0);
    flag.rotation.z = s * Math.PI / 2;
    p.add(flag);
    if (s < 0) {
      // On the sea side the pylon stands on a buoy.
      p.add(mesh(cyl('buoy', 1.2, 1.4, 1.0, 14), toon(0xff8c42), 0, -0.2, 0));
    }
    add(p);
  }

  // Hills and trees on the right, and behind the airfield.
  for (let i = 0; i < 9; i++) {
    const hill = add(new THREE.Mesh(sharedGeo('df-hill', () => new THREE.SphereGeometry(1, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2)), toon(i % 2 ? COLORS.grassDark : 0x8fdc6a)));
    const r = 8 + rand() * 10;
    hill.scale.set(r * 1.4, r * (0.5 + rand() * 0.4), r);
    hill.position.set(-20 + i * 14 + rand() * 6, -0.5, -32 - rand() * 14);
  }
  for (let i = 0; i < 26; i++) {
    const x = SEA_X + 6 + rand() * (FAR - SEA_X - 10);
    const z = -13 - rand() * 14;
    const tr = add(makeTree(rand, 1.2 + rand() * 1.1));
    tr.position.set(x, 0, z);
  }
  for (let i = 0; i < 10; i++) {
    const tr = add(makeTree(rand, 1.4 + rand() * 0.8));
    tr.position.set(28 + rand() * 30, 0, -3 - rand() * 6);
  }

  // Background clouds (solid) and fly-through clouds in front (see-through).
  for (let i = 0; i < 14; i++) {
    const c = add(makeCloud(rand, 3 + rand() * 3));
    c.position.set(-XW - 30 + rand() * (XW * 2 + 60), 16 + rand() * 30, -40 - rand() * 20);
  }
  const front = [];
  const see = toon(COLORS.white, { transparent: true, opacity: 0.72 });
  const spots = [[-28, 26], [-8, 33], [10, 20], [30, 30], [-34, 12], [22, 12], [0, 40]];
  for (const [x, y] of spots) {
    const c = makeCloud(rand, 2.2 + rand() * 1.2);
    c.traverse((o) => { if (o.isMesh) { o.material = see; o.castShadow = false; o.renderOrder = 2; } });
    c.position.set(x, y, 2.2);
    add(c);
    front.push({ c, x, y, phase: rand() * 6 });
  }
  return { waves, sock, front };
}

export { darken };
