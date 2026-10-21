import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { COLORS, toon, basic, sharedGeo, faceted } from '../../core/palette.js';
import { Character, darken } from '../../core/character.js';

// Toon models for Spacefall, built from primitives in the Couch palette. Every geometry is shared
// (sharedGeo) and every material comes from the toon()/basic() caches, so spawning an entity only
// allocates a few Mesh/Group objects. Effects that change over time (windup glows, flames, ring
// pulses) animate scale, never material opacity, so the shared materials stay untouched.
// Models face +x (the nose / the alien's front), +y is up and the camera looks down -z.

const G = {
  hull: () => sharedGeo('sfHull', () => { const g = new THREE.CapsuleGeometry(0.21, 0.5, 6, 14); g.rotateZ(Math.PI / 2); return g; }),
  nose: () => sharedGeo('sfNose', () => new THREE.SphereGeometry(0.19, 14, 10)),
  band: () => sharedGeo('sfBand', () => { const g = new THREE.TorusGeometry(0.205, 0.045, 6, 16); g.rotateY(Math.PI / 2); return g; }),
  wing: () => sharedGeo('sfWing', () => new RoundedBoxGeometry(0.36, 0.07, 0.62, 2, 0.03)),
  fin: () => sharedGeo('sfFin', () => new RoundedBoxGeometry(0.24, 0.24, 0.05, 2, 0.02)),
  nozzle: () => sharedGeo('sfNozzle', () => { const g = new THREE.CylinderGeometry(0.11, 0.15, 0.14, 12); g.rotateZ(Math.PI / 2); return g; }),
  flame: () => sharedGeo('sfFlame', () => { const g = new THREE.ConeGeometry(0.12, 0.5, 10); g.rotateZ(Math.PI / 2); g.translate(-0.25, 0, 0); return g; }),
  flameCore: () => sharedGeo('sfFlameCore', () => { const g = new THREE.ConeGeometry(0.06, 0.3, 8); g.rotateZ(Math.PI / 2); g.translate(-0.15, 0, 0); return g; }),
  dome: () => sharedGeo('sfDome', () => new THREE.SphereGeometry(0.22, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55)),
  halo: () => sharedGeo('sfHalo', () => new THREE.CircleGeometry(0.66, 24)),
  shield: () => sharedGeo('sfShield', () => new THREE.IcosahedronGeometry(0.66, 2)),
  pip: () => sharedGeo('sfPip', () => new THREE.ConeGeometry(0.06, 0.2, 6)),
  ball: (r) => sharedGeo(`sfBall${r}`, () => new THREE.SphereGeometry(r, 14, 10)),
};

/** A pair of cartoon eyes (white, pupil, brow) on the camera side of a creature. */
function addEyes(g, { x = 0.2, y = 0.12, gap = 0.12, r = 0.09, z = 0.3, brow = true, angry = 1 } = {}) {
  const eyes = new THREE.Group();
  for (const s of [-1, 1]) {
    const white = new THREE.Mesh(G.ball(r), toon(COLORS.white));
    white.position.set(x + s * gap, y, z);
    white.scale.set(1, 1.15, 0.6);
    const pupil = new THREE.Mesh(G.ball(+(r * 0.55).toFixed(3)), toon(COLORS.ink));
    pupil.position.set(x + s * gap + r * 0.25, y - r * 0.1, z + r * 0.45);
    eyes.add(white, pupil);
    if (brow) {
      const b = new THREE.Mesh(sharedGeo(`sfBrow${r}`, () => new THREE.BoxGeometry(r * 1.8, r * 0.4, r * 0.4)), toon(COLORS.ink));
      b.position.set(x + s * gap, y + r * 1.25, z + r * 0.3);
      b.rotation.z = s * -0.4 * angry;
      eyes.add(b);
    }
  }
  g.add(eyes);
  return eyes;
}

// ---------------------------------------------------------------------------
// Ships

/**
 * A tiny toon spaceship with the player's bean in a glass cockpit.
 * root: position + aim angle; turn: flips 180 degrees around y when the ship faces left, so the
 * cockpit stays on top; engine/flame scale with thrust.
 */
export function makeShip({ color, hat = 0, grumble = null, wing = null }) {
  const root = new THREE.Group();
  const turn = new THREE.Group();
  root.add(turn);
  const hull = new THREE.Mesh(G.hull(), toon(color));
  hull.scale.set(1, 0.92, 0.92);
  hull.castShadow = true;
  const nose = new THREE.Mesh(G.nose(), toon(COLORS.white));
  nose.position.x = 0.36;
  nose.scale.set(1.25, 0.95, 0.95);
  const band = new THREE.Mesh(G.band(), toon(COLORS.white));
  band.position.x = -0.18;
  const wingMat = toon(wing ?? COLORS.white);
  const wingL = new THREE.Mesh(G.wing(), wingMat);
  wingL.position.set(-0.1, -0.1, 0);
  wingL.rotation.z = 0.22;
  const fin = new THREE.Mesh(G.fin(), toon(color));
  fin.position.set(-0.32, 0.2, 0);
  fin.rotation.z = -0.5;
  const nozzle = new THREE.Mesh(G.nozzle(), toon(COLORS.ink));
  nozzle.position.x = -0.5;
  const flame = new THREE.Group();
  flame.position.x = -0.56;
  flame.add(new THREE.Mesh(G.flame(), basic(0xffa63c)), new THREE.Mesh(G.flameCore(), basic(0xfff3c4)));
  // Pilot: the player's own bean (or a grumble for the bot pilots) under a glass dome.
  let pilot = null;
  const seat = new THREE.Group();
  seat.position.set(0.02, 0.1, 0);
  if (grumble) {
    const gr = makeGrumbleHead(grumble);
    gr.scale.setScalar(0.42);
    gr.position.y = -0.04;
    seat.add(gr);
  } else {
    pilot = new Character(color, { hat });
    pilot.group.scale.setScalar(0.25);
    pilot.group.position.y = -0.03;
    seat.add(pilot.group);
  }
  const dome = new THREE.Mesh(G.dome(), toon(0xbfe9ff, { transparent: true, opacity: 0.38 }));
  dome.position.set(0.02, 0.12, 0);
  dome.scale.set(1.1, 1, 1);
  turn.add(hull, nose, band, wingL, fin, nozzle, flame, seat, dome);
  // Soft colored disc behind the ship: the main way to spot your own ship in a busy arena.
  const halo = new THREE.Mesh(G.halo(), basic(color, { transparent: true, opacity: 0.3 }));
  halo.scale.setScalar(1.1);
  halo.position.z = -0.45;
  root.add(halo);
  const shield = new THREE.Mesh(G.shield(), basic(0x8fd8ff, { transparent: true, opacity: 0.3 }));
  shield.visible = false;
  root.add(shield);
  turn.scale.setScalar(1.2); // drawn a bit bigger than the hitbox so ships read on a shared screen
  root.userData = { turn, flame, shield, halo, pilot, seat };
  return root;
}

/** Just a grumble's head and eyes, small enough to sit in a cockpit. */
function makeGrumbleHead(color) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(sharedGeo('sfGrHead', () => faceted(new THREE.IcosahedronGeometry(0.45, 1))), toon(color));
  body.position.y = 0.45;
  g.add(body);
  addEyes(g, { x: 0, y: 0.55, gap: 0.16, r: 0.11, z: 0.36 });
  return g;
}

/** Missile pips that float above a ship (how many it carries). */
export function makeAmmoRack(color, max) {
  const g = new THREE.Group();
  for (let k = 0; k < max; k++) {
    const pip = new THREE.Mesh(G.pip(), toon(color));
    const tip = new THREE.Mesh(G.ball(0.035), toon(COLORS.white));
    tip.position.y = 0.1;
    pip.add(tip);
    g.add(pip);
  }
  return g;
}

/** Fired missile: a white body with a colored nose and fins. The ring pulses while it waits for pickup. */
export function makeMissile(color) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(sharedGeo('sfMBody', () => { const c = new THREE.CylinderGeometry(0.06, 0.06, 0.42, 8); c.rotateZ(Math.PI / 2); return c; }), toon(COLORS.icing));
  const tip = new THREE.Mesh(sharedGeo('sfMTip', () => { const c = new THREE.ConeGeometry(0.075, 0.18, 8); c.rotateZ(-Math.PI / 2); c.translate(0.3, 0, 0); return c; }), toon(color));
  const fins = new THREE.Mesh(sharedGeo('sfMFin', () => { const b = new THREE.BoxGeometry(0.12, 0.22, 0.04); b.translate(-0.19, 0, 0); return b; }), toon(color));
  const fins2 = new THREE.Mesh(sharedGeo('sfMFin2', () => { const b = new THREE.BoxGeometry(0.12, 0.04, 0.22); b.translate(-0.19, 0, 0); return b; }), toon(color));
  const ring = new THREE.Mesh(sharedGeo('sfMRing', () => new THREE.TorusGeometry(0.34, 0.035, 6, 20)), basic(color));
  ring.visible = false;
  g.add(body, tip, fins, fins2, ring);
  g.scale.setScalar(1.2);
  g.userData = { ring };
  return g;
}

// ---------------------------------------------------------------------------
// Escape bubble: the pilot always gets out safe and floats in a bubble.

export function makePod(color, hat, grumble = null) {
  const g = new THREE.Group();
  let pilot = null;
  if (grumble) {
    const gr = makeGrumbleHead(grumble);
    gr.scale.setScalar(0.8);
    gr.position.y = -0.38;
    g.add(gr);
  } else {
    pilot = new Character(color, { hat });
    pilot.group.scale.setScalar(0.48);
    pilot.group.position.y = -0.3;
    g.add(pilot.group);
  }
  const bubble = new THREE.Mesh(G.ball(0.55), toon(color, { transparent: true, opacity: 0.3 }));
  const shine = new THREE.Mesh(G.ball(0.09), toon(COLORS.white));
  shine.position.set(-0.24, 0.26, 0.4);
  g.add(bubble, shine);
  g.userData = { pilot, bubble };
  return g;
}

// ---------------------------------------------------------------------------
// Aliens (cute but grumpy)

export function makeCrawler() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(G.ball(0.36), toon(0x6fd86a));
  body.scale.set(1.1, 0.72, 0.9);
  body.position.y = 0.04;
  body.castShadow = true;
  g.add(body);
  const spots = new THREE.Mesh(G.ball(0.09), toon(0x3fae4a));
  spots.position.set(-0.12, 0.22, 0.18);
  g.add(spots);
  const legGeo = sharedGeo('sfLeg', () => { const l = new THREE.CylinderGeometry(0.035, 0.025, 0.36, 5); l.translate(0, -0.18, 0); return l; });
  const legs = [];
  for (let i = 0; i < 6; i++) {
    const leg = new THREE.Mesh(legGeo, toon(0x2f8a3a));
    const side = i % 2 ? 1 : -1;
    leg.position.set(-0.2 + Math.floor(i / 2) * 0.2, -0.02, side * 0.2);
    leg.rotation.x = side * 0.7;
    g.add(leg);
    legs.push(leg);
  }
  addEyes(g, { x: 0.2, y: 0.18, gap: 0.1, r: 0.08, z: 0.24 });
  g.userData = { legs, body };
  return g;
}

export function makeSpore() {
  const g = new THREE.Group();
  const core = new THREE.Mesh(sharedGeo('sfSpore', () => faceted(new THREE.IcosahedronGeometry(0.3, 1))), toon(0x9ae65a));
  g.add(core);
  const spikeGeo = sharedGeo('sfSpike', () => { const c = new THREE.ConeGeometry(0.06, 0.22, 5); c.translate(0, 0.38, 0); return c; });
  for (let i = 0; i < 8; i++) {
    const s = new THREE.Mesh(spikeGeo, toon(COLORS.candyYellow));
    s.rotation.z = (i / 8) * Math.PI * 2;
    s.rotation.x = (i % 2) * 0.6 - 0.3;
    g.add(s);
  }
  const face = new THREE.Group();
  addEyes(face, { x: 0, y: 0.06, gap: 0.1, r: 0.075, z: 0.26 });
  g.add(face);
  g.userData = { core, face };
  return g;
}

export function makeWisp() {
  const g = new THREE.Group();
  const core = new THREE.Mesh(sharedGeo('sfWisp', () => faceted(new THREE.IcosahedronGeometry(0.25, 0))), toon(0xb455ff, { emissive: 0x3a0f6a }));
  g.add(core);
  const ring = new THREE.Mesh(sharedGeo('sfWispRing', () => new THREE.TorusGeometry(0.38, 0.045, 6, 18)), basic(COLORS.candyLilac));
  g.add(ring);
  const eye = new THREE.Mesh(G.ball(0.11), toon(COLORS.white));
  eye.position.set(0.05, 0.02, 0.2);
  const pupil = new THREE.Mesh(G.ball(0.06), toon(COLORS.ink));
  pupil.position.set(0.08, 0.01, 0.29);
  g.add(eye, pupil);
  g.userData = { core, ring };
  return g;
}

export function makeSpitter() {
  const g = new THREE.Group();
  const sac = new THREE.Mesh(G.ball(0.42), toon(0xf2d64b));
  sac.scale.set(1, 0.9, 0.9);
  sac.castShadow = true;
  g.add(sac);
  const mouth = new THREE.Mesh(G.ball(0.14), toon(0x7ad65a));
  mouth.position.set(0.34, -0.06, 0.12);
  g.add(mouth);
  const tentGeo = sharedGeo('sfTent', () => { const c = new THREE.CylinderGeometry(0.05, 0.018, 0.5, 5); c.translate(0, -0.25, 0); return c; });
  const tentacles = [];
  for (let i = 0; i < 5; i++) {
    const t = new THREE.Mesh(tentGeo, toon(0xc9a83a));
    t.position.set(-0.24 + i * 0.12, -0.28, 0);
    g.add(t);
    tentacles.push(t);
  }
  addEyes(g, { x: 0.12, y: 0.18, gap: 0.12, r: 0.09, z: 0.32 });
  const glow = new THREE.Mesh(G.ball(0.24), basic(0xc6ff4a, { transparent: true, opacity: 0.6 }));
  glow.position.copy(mouth.position);
  glow.scale.setScalar(0.01);
  g.add(glow);
  g.userData = { sac, tentacles, glow };
  return g;
}

export function makeBrute() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(sharedGeo('sfBrute', () => faceted(new THREE.DodecahedronGeometry(0.6, 0))), toon(0xe0525a));
  body.scale.set(1.15, 0.95, 0.9);
  body.castShadow = true;
  g.add(body);
  for (const s of [-1, 1]) {
    const h = new THREE.Mesh(sharedGeo('sfHorn', () => new THREE.ConeGeometry(0.1, 0.42, 6)), toon(COLORS.cream));
    h.position.set(0.25, 0.48, s * 0.25);
    h.rotation.z = -0.5;
    g.add(h);
  }
  addEyes(g, { x: 0.32, y: 0.14, gap: 0.14, r: 0.12, z: 0.42, angry: 1.3 });
  const glow = new THREE.Mesh(G.ball(0.85), basic(0xff7b54, { transparent: true, opacity: 0.35 }));
  glow.scale.setScalar(0.01);
  g.add(glow);
  g.userData = { body, glow };
  return g;
}

/** The co-op finale: a big wobbly Hive Queen with a crown and orbiting pods. */
export function makeQueen() {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const blob = new THREE.Mesh(sharedGeo('sfQueen', () => faceted(new THREE.IcosahedronGeometry(1.1, 2))), toon(0xff6fae));
  blob.castShadow = true;
  body.add(blob);
  const belly = new THREE.Mesh(G.ball(0.7), toon(0xffb3d6));
  belly.position.set(0.2, -0.3, 0.55);
  belly.scale.set(1, 0.8, 0.5);
  body.add(belly);
  for (let i = 0; i < 5; i++) {
    const a = -0.9 + i * 0.45;
    const spike = new THREE.Mesh(sharedGeo('sfCrown', () => new THREE.ConeGeometry(0.13, 0.42, 6)), toon(COLORS.gold));
    spike.position.set(Math.sin(a) * 0.7, 1.0 + Math.cos(a) * 0.12, 0.1);
    spike.rotation.z = -a * 0.6;
    body.add(spike);
  }
  addEyes(body, { x: 0.3, y: 0.35, gap: 0.3, r: 0.22, z: 0.92, angry: 1.2 });
  const mouth = new THREE.Mesh(sharedGeo('sfQMouth', () => new THREE.TorusGeometry(0.22, 0.06, 6, 14, Math.PI)), toon(COLORS.ink));
  mouth.position.set(0.32, -0.1, 1.0);
  mouth.rotation.z = Math.PI;
  body.add(mouth);
  const pods = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const p = new THREE.Mesh(G.ball(0.2), toon(COLORS.candyMint, { emissive: 0x1a5a3a }));
    const a = (i / 4) * Math.PI * 2;
    p.position.set(Math.cos(a) * 1.55, Math.sin(a) * 1.55, 0);
    pods.add(p);
  }
  g.add(pods);
  const glow = new THREE.Mesh(G.ball(1.5), basic(0xff9fd0, { transparent: true, opacity: 0.3 }));
  glow.scale.setScalar(0.01);
  g.add(glow);
  g.userData = { body, pods, glow };
  return g;
}

export function makeBolt() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(G.ball(0.15), basic(0xc6ff4a)));
  const shell = new THREE.Mesh(G.ball(0.24), basic(0x7ad65a, { transparent: true, opacity: 0.45 }));
  g.add(shell);
  return g;
}

export function makeRift() {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(sharedGeo('sfRift', () => new THREE.TorusGeometry(0.62, 0.08, 6, 28)), basic(0xc04dff));
  const ring2 = new THREE.Mesh(sharedGeo('sfRift2', () => new THREE.TorusGeometry(0.42, 0.05, 6, 24)), basic(COLORS.candyPink));
  const inner = new THREE.Mesh(sharedGeo('sfRiftIn', () => new THREE.CircleGeometry(0.6, 24)), basic(0x5a1aa0, { transparent: true, opacity: 0.7 }));
  g.add(inner, ring, ring2);
  g.userData = { ring, ring2, inner };
  return g;
}

/** Supply crate: a gift box with a ribbon. */
export function makeCrate() {
  const g = new THREE.Group();
  const box = new THREE.Mesh(sharedGeo('sfCrate', () => new RoundedBoxGeometry(0.62, 0.52, 0.52, 2, 0.06)), toon(COLORS.gold));
  box.castShadow = true;
  const r1 = new THREE.Mesh(sharedGeo('sfRib1', () => new THREE.BoxGeometry(0.64, 0.12, 0.54)), toon(0xff5d73));
  const r2 = new THREE.Mesh(sharedGeo('sfRib2', () => new THREE.BoxGeometry(0.12, 0.54, 0.54)), toon(0xff5d73));
  const bow = new THREE.Group();
  for (const s of [-1, 1]) {
    const loop = new THREE.Mesh(sharedGeo('sfBow', () => new THREE.TorusGeometry(0.09, 0.035, 6, 12)), toon(0xff5d73));
    loop.position.set(s * 0.09, 0.32, 0);
    loop.rotation.z = s * 0.5;
    bow.add(loop);
  }
  g.add(box, r1, r2, bow);
  return g;
}

/** Hull pieces flung out of a popped ship: small chunks in the ship color. */
export function makeDebris(color) {
  const m = new THREE.Mesh(sharedGeo('sfDebris', () => faceted(new THREE.TetrahedronGeometry(0.14, 0))), toon(Math.random() < 0.6 ? color : darken(color, 0.7)));
  m.castShadow = false;
  return m;
}
