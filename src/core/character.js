import * as THREE from 'three';
import { COLORS, toon, sharedGeo } from './palette.js';

const BODY_R = 0.42;
const BODY_LEN = 0.36;
export const CHAR_HEIGHT = BODY_LEN + BODY_R * 2;

const sphere = (r, w = 16, h = 12) => sharedGeo(`sph${r}|${w}|${h}`, () => new THREE.SphereGeometry(r, w, h));

function mesh(geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
}

/** Builds a hat by index (see HATS in roster.js). */
export function makeHat(index) {
  const g = new THREE.Group();
  switch (index) {
    case 1: { // party cone
      const cone = mesh(sharedGeo('hatCone', () => new THREE.ConeGeometry(0.2, 0.5, 18)), toon(COLORS.candyPink), 0, 0.22, 0);
      const pom = mesh(sphere(0.08), toon(COLORS.candyYellow), 0, 0.5, 0);
      const band = mesh(sharedGeo('hatBand', () => new THREE.TorusGeometry(0.15, 0.035, 8, 18)), toon(COLORS.candyBlue), 0, 0.12, 0);
      band.rotation.x = Math.PI / 2;
      g.add(cone, pom, band);
      g.rotation.z = -0.25;
      g.position.x = 0.06;
      break;
    }
    case 2: { // flower
      const center = mesh(sphere(0.08), toon(COLORS.candyYellow), 0, 0, 0);
      g.add(center);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const p = mesh(sphere(0.075), toon(COLORS.white), Math.cos(a) * 0.12, Math.sin(a) * 0.12, -0.02);
        p.scale.set(1, 1, 0.5);
        g.add(p);
      }
      g.position.set(0.2, -0.02, 0.18);
      g.rotation.set(-0.3, 0.5, 0);
      break;
    }
    case 3: { // bunny ears
      for (const s of [-1, 1]) {
        const ear = mesh(sphere(0.1), toon(COLORS.white), s * 0.14, 0.24, 0);
        ear.scale.set(0.8, 2.6, 0.5);
        ear.rotation.z = -s * 0.2;
        const inner = mesh(sphere(0.06), toon(COLORS.candyPink), s * 0.14, 0.24, 0.035);
        inner.scale.set(0.7, 2.6, 0.4);
        inner.rotation.z = -s * 0.2;
        g.add(ear, inner);
      }
      break;
    }
    case 4: { // propeller cap
      const cap = mesh(sharedGeo('capDome', () => new THREE.SphereGeometry(0.3, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2)), toon(COLORS.candyBlue), 0, -0.08, 0);
      const stem = mesh(sharedGeo('propStem', () => new THREE.CylinderGeometry(0.025, 0.025, 0.14, 8)), toon(COLORS.ink), 0, 0.27, 0);
      const prop = new THREE.Group();
      prop.position.y = 0.34;
      for (const s of [-1, 1]) {
        const blade = mesh(sharedGeo('propBlade', () => new THREE.BoxGeometry(0.26, 0.02, 0.08)), toon(s > 0 ? COLORS.candyYellow : 0xff5d73), s * 0.13, 0, 0);
        prop.add(blade);
      }
      g.userData.spin = prop;
      g.add(cap, stem, prop);
      break;
    }
    case 5: { // top hat
      const brim = mesh(sharedGeo('brim', () => new THREE.CylinderGeometry(0.3, 0.3, 0.04, 20)), toon(COLORS.ink), 0, 0.0, 0);
      const top = mesh(sharedGeo('tophat', () => new THREE.CylinderGeometry(0.19, 0.2, 0.38, 20)), toon(COLORS.ink), 0, 0.2, 0);
      const band = mesh(sharedGeo('tophatBand', () => new THREE.CylinderGeometry(0.205, 0.205, 0.07, 20)), toon(0xff5d73), 0, 0.06, 0);
      g.add(brim, top, band);
      g.rotation.z = 0.12;
      break;
    }
    case 6: { // crown
      const ring = mesh(sharedGeo('crownRing', () => new THREE.CylinderGeometry(0.22, 0.2, 0.14, 16)), toon(COLORS.gold), 0, 0.05, 0);
      g.add(ring);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const spike = mesh(sharedGeo('crownSpike', () => new THREE.ConeGeometry(0.06, 0.14, 8)), toon(COLORS.gold), Math.cos(a) * 0.2, 0.18, Math.sin(a) * 0.2);
        const gem = mesh(sphere(0.035, 8, 6), toon(i % 2 ? 0x4cc9f0 : 0xff5d73), Math.cos(a) * 0.215, 0.05, Math.sin(a) * 0.215);
        g.add(spike, gem);
      }
      break;
    }
    default:
      break;
  }
  return g;
}

/**
 * The shared bean-shaped buddy used in every game.
 * group sits at the feet; front faces +z.
 */
export class Character {
  constructor(color, { hat = 0 } = {}) {
    this.color = color;
    this.group = new THREE.Group();
    this.pivot = new THREE.Group();
    this.group.add(this.pivot);

    const bodyGeo = sharedGeo('beanBody', () => new THREE.CapsuleGeometry(BODY_R, BODY_LEN, 8, 18));
    this.body = mesh(bodyGeo, toon(color), 0, CHAR_HEIGHT / 2, 0);
    this.body.castShadow = true;
    this.pivot.add(this.body);

    const belly = mesh(sphere(0.3), toon(0xffffff, { transparent: true, opacity: 0.35 }), 0, 0.42, 0.2);
    belly.scale.set(1, 0.9, 0.7);
    this.pivot.add(belly);

    this.eyes = new THREE.Group();
    for (const s of [-1, 1]) {
      const white = mesh(sphere(0.13), toon(COLORS.white), s * 0.15, 0, 0);
      white.scale.set(1, 1.15, 0.6);
      const pupil = mesh(sphere(0.07), toon(COLORS.ink), s * 0.15, -0.01, 0.07);
      const shine = mesh(sphere(0.025, 8, 6), toon(COLORS.white), s * 0.15 + 0.025, 0.03, 0.12);
      this.eyes.add(white, pupil, shine);
    }
    this.eyes.position.set(0, 0.83, 0.33);
    this.pivot.add(this.eyes);

    for (const s of [-1, 1]) {
      const cheek = mesh(sphere(0.07), toon(COLORS.blush), s * 0.28, 0.66, 0.29);
      cheek.scale.set(1, 0.6, 0.4);
      this.pivot.add(cheek);
    }

    this.feet = [];
    for (const s of [-1, 1]) {
      const foot = mesh(sphere(0.13), toon(darken(color, 0.65)), s * 0.18, 0.07, 0.04);
      foot.scale.set(1, 0.6, 1.35);
      foot.castShadow = true;
      this.group.add(foot);
      this.feet.push(foot);
    }

    this.hatSlot = new THREE.Group();
    this.hatSlot.position.y = CHAR_HEIGHT - 0.06;
    this.pivot.add(this.hatSlot);
    this.setHat(hat);

    this.walk = 0;
    this.sq = 1;
    this.sqVel = 0;
    this.blink = 2 + Math.random() * 3;
    this.yaw = 0;
    this.targetYaw = 0;
    this.spin = 0;
  }

  setHat(index) {
    this.hatSlot.clear();
    this.hat = makeHat(index);
    this.hatSlot.add(this.hat);
  }

  /** Kick the squash spring: <1 squashes, >1 stretches. */
  squash(amount) {
    this.sq = amount;
    this.sqVel = 0;
  }

  /** Face a direction on the ground plane. */
  face(dx, dz) {
    if (Math.abs(dx) + Math.abs(dz) < 0.01) return;
    this.targetYaw = Math.atan2(dx, dz);
  }

  /** For side-view games: -1 left, +1 right, turned partly toward the camera. */
  faceSide(dir) {
    this.targetYaw = dir >= 0 ? 0.9 : -0.9;
  }

  update(dt, { moving = 0, grounded = true, vy = 0 } = {}) {
    this.walk += dt * (6 + 10 * moving);
    const bob = grounded ? Math.abs(Math.sin(this.walk)) * 0.07 * moving : 0;
    this.pivot.position.y = bob;
    const swing = grounded ? Math.sin(this.walk) * 0.16 * moving : 0.05;
    this.feet[0].position.z = 0.04 + swing;
    this.feet[1].position.z = 0.04 - swing;
    this.feet[0].position.y = 0.07 + Math.max(0, -swing) * 0.4;
    this.feet[1].position.y = 0.07 + Math.max(0, swing) * 0.4;

    const stretch = grounded ? 1 : 1 + THREE.MathUtils.clamp(vy * 0.012, -0.12, 0.18);
    const acc = (stretch - this.sq) * 320 - this.sqVel * 16;
    this.sqVel += acc * dt;
    this.sq += this.sqVel * dt;
    const s = THREE.MathUtils.clamp(this.sq, 0.5, 1.6);
    const w = 1 / Math.sqrt(s);
    this.pivot.scale.set(w, s, w);

    let d = this.targetYaw - this.yaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.yaw += d * Math.min(1, dt * 14);
    this.group.rotation.y = this.yaw + this.spin;

    this.blink -= dt;
    const closed = this.blink < 0;
    this.eyes.scale.y = closed ? 0.12 : 1;
    if (this.blink < -0.12) this.blink = 2 + Math.random() * 3.5;

    if (this.hat.userData.spin) this.hat.userData.spin.rotation.y += dt * (8 + moving * 18);
  }
}

export function darken(hex, f) {
  const c = new THREE.Color(hex);
  c.multiplyScalar(f);
  return c.getHex();
}
