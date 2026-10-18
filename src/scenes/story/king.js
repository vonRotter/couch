import * as THREE from 'three';
import { makeGrumble } from '../../core/critters.js';
import { makeHat } from '../../core/character.js';
import { COLORS, toon, sharedGeo } from '../../core/palette.js';
import { makeStar } from '../../core/world.js';

// The Grumble King: a big grumble with a crown, a red royal collar and a face that can change
// mood (grumpy, sad, happy). Grumpy but never scary, and never hurt: at worst he gets dizzy.

export const KING_COLOR = 0x8a63f0;

/**
 * Returns { group, body, setMood(mood), update(dt, { dizzy, bounce }) }.
 * group sits at his feet and faces +z. `size` is the overall scale (1 = a normal grumble).
 */
export function makeKing(size = 2.4) {
  const group = new THREE.Group();
  const inner = new THREE.Group(); // squash/wobble pivot
  group.add(inner);
  const g = makeGrumble(KING_COLOR);
  inner.add(g);

  // The grumble's eyebrows are its only boxes: flip them to change mood.
  const brows = g.children.filter((c) => c.geometry?.type === 'BoxGeometry');

  const crown = makeHat(6);
  crown.scale.setScalar(1.25);
  crown.position.set(0, 0.86, 0);
  crown.rotation.z = 0.12;
  g.add(crown);

  const collar = new THREE.Mesh(sharedGeo('kingCollar', () => new THREE.TorusGeometry(0.33, 0.07, 8, 20)), toon(0xe63950));
  collar.rotation.x = Math.PI / 2;
  collar.position.y = 0.2;
  g.add(collar);

  // Mouth: half a torus, flipped for a smile or a frown.
  const mouth = new THREE.Mesh(sharedGeo('kingMouth', () => new THREE.TorusGeometry(0.09, 0.022, 6, 12, Math.PI)), toon(COLORS.ink));
  mouth.position.set(0, 0.38, 0.43);
  g.add(mouth);

  // Rosy cheeks for the happy ending.
  const cheeks = [];
  for (const s of [-1, 1]) {
    const c = new THREE.Mesh(sharedGeo('kingCheek', () => new THREE.SphereGeometry(0.06, 8, 6)), toon(COLORS.blush));
    c.position.set(s * 0.27, 0.42, 0.36);
    c.scale.set(1, 0.6, 0.4);
    c.visible = false;
    g.add(c);
    cheeks.push(c);
  }

  // A tear for the lonely moment.
  const tear = new THREE.Mesh(sharedGeo('kingTear', () => new THREE.SphereGeometry(0.045, 8, 6)), toon(0x7fd3ff));
  tear.position.set(0.17, 0.46, 0.44);
  tear.scale.y = 1.4;
  tear.visible = false;
  g.add(tear);

  // Dizzy stars that circle his head.
  const dizzy = new THREE.Group();
  dizzy.position.y = 1.2;
  for (let i = 0; i < 4; i++) {
    const s = makeStar(i % 2 ? COLORS.gold : 0xff9fd0);
    s.scale.setScalar(0.28);
    const a = (i / 4) * Math.PI * 2;
    s.position.set(Math.cos(a) * 0.5, 0, Math.sin(a) * 0.5);
    dizzy.add(s);
  }
  dizzy.visible = false;
  g.add(dizzy);

  group.scale.setScalar(size);
  let mood = 'grumpy';
  let t = 0;
  let sq = 1, sqVel = 0;

  const king = {
    group, inner, body: g.userData.body, crown, dizzyStars: dizzy, size,
    /** Head-top height in world units (for bouncing on him). */
    get headY() { return 0.9 * group.scale.y * inner.scale.y; },
    setMood(m) {
      mood = m;
      const happy = m === 'happy' || m === 'laugh' || m === 'hopeful';
      brows.forEach((b) => {
        const s = Math.sign(b.position.x);
        b.rotation.z = m === 'grumpy' ? s * 0.35 : s * -0.3; // grumpy: inner ends down
        b.position.y = m === 'sad' || m === 'hopeful' ? 0.66 : 0.69;
      });
      mouth.rotation.z = happy ? Math.PI : 0;
      mouth.position.y = happy ? 0.36 : 0.33;
      mouth.scale.set(m === 'laugh' ? 1.5 : 1, m === 'laugh' ? 1.6 : 1, 1);
      cheeks.forEach((c) => { c.visible = happy && m !== 'hopeful'; });
      if (m === 'hopeful') mouth.scale.set(0.7, 0.6, 1);
      tear.visible = m === 'sad';
    },
    get mood() { return mood; },
    /** Kick the squash spring: <1 squashes, >1 stretches. */
    squash(v) { sq = v; sqVel = 0; },
    update(dt, { dizzy: dz = false, hop = 0 } = {}) {
      t += dt;
      dizzy.visible = dz;
      dizzy.rotation.y += dt * 5;
      const acc = (1 - sq) * 260 - sqVel * 14;
      sqVel += acc * dt;
      sq += sqVel * dt;
      const s = THREE.MathUtils.clamp(sq, 0.6, 1.5);
      inner.scale.set(1 / Math.sqrt(s), s, 1 / Math.sqrt(s));
      inner.position.y = hop ? Math.abs(Math.sin(t * hop)) * 0.12 : 0;
      inner.rotation.z = dz ? Math.sin(t * 6) * 0.18 : mood === 'laugh' ? Math.sin(t * 14) * 0.06 : 0;
      if (tear.visible) tear.position.y = 0.46 - ((t * 0.3) % 0.18);
    },
  };
  king.setMood('grumpy');
  return king;
}

/** A sack bulging with Party Stars (the King carries it in the story). */
export function makeStarSack() {
  const g = new THREE.Group();
  const sack = new THREE.Mesh(sharedGeo('sack', () => new THREE.SphereGeometry(0.5, 16, 12)), toon(0xc99a5b));
  sack.scale.set(1, 0.9, 1);
  sack.position.y = 0.45;
  sack.castShadow = true;
  const tie = new THREE.Mesh(sharedGeo('sackTie', () => new THREE.CylinderGeometry(0.12, 0.2, 0.25, 10)), toon(0xa87a45));
  tie.position.y = 0.95;
  g.add(sack, tie);
  for (let i = 0; i < 3; i++) {
    const s = makeStar();
    s.scale.setScalar(0.45);
    s.position.set((i - 1) * 0.22, 1.12 + (i % 2) * 0.1, 0.05);
    s.rotation.z = (i - 1) * 0.4;
    g.add(s);
  }
  return g;
}
