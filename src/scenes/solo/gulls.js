import * as THREE from 'three';
import { COLORS, toon } from '../../core/palette.js';
import { mesh, box, cyl, sph, cone } from './models.js';

// Seagulls that really fly (milestone C). The old gulls were the adventure game's standing gull swung around
// in a circle with its folded wings wobbling. These have spread wings in two parts (arm and tip) that flap
// with a proper up-down stroke, glide with now and then a few flaps, bank into their turns, and sometimes
// land on a perch (pier, posts, barrels, the sand) to stand with folded wings, look around, peck and take
// off again (also when you walk up to them). At night most of them sit and sleep.
//
// A gull faces +x. Its group uses Euler order 'YXZ': rotation.y = heading, rotation.x = bank (roll),
// rotation.z = pitch (nose up/down).

const FLY_SPEED = 4.2;
const TURN = 1.3; // radians per second, at most
const FLAP_HZ = 3.4;

/** A seagull with wings that flap (shoulder) and bend (elbow), legs, and a head that turns. */
export function makeGull() {
  const g = new THREE.Group();
  g.rotation.order = 'YXZ';
  const white = toon(0xffffff), grey = toon(0xaab3c6), ink = toon(COLORS.ink), beakC = toon(0xffc93c), leg = toon(0xffa23a);
  const body = mesh(sph(0.22, 12, 8), white, 0, 0.32, 0);
  body.scale.set(1.5, 0.95, 0.95);
  const tail = mesh(cone(0.13, 0.32, 4), grey, -0.38, 0.33, 0);
  tail.rotation.z = Math.PI / 2;
  tail.scale.set(1, 1, 0.35);
  g.add(body, tail);
  const head = new THREE.Group();
  head.position.set(0.28, 0.48, 0);
  head.add(mesh(sph(0.14, 10, 8), white, 0, 0, 0));
  const beak = mesh(cone(0.05, 0.2, 6), beakC, 0.19, -0.02, 0, false);
  beak.rotation.z = -Math.PI / 2;
  head.add(beak, mesh(sph(0.022, 6, 4), toon(0xe0364f), 0.2, -0.05, 0, false));
  for (const s of [-1, 1]) head.add(mesh(sph(0.025, 6, 4), ink, 0.08, 0.04, s * 0.11, false));
  g.add(head);
  // wings: shoulder pivot at the body's side, the arm spans along +-z, then an elbow and the black-tipped hand
  const wings = [];
  for (const s of [1, -1]) {
    const sh = new THREE.Group();
    sh.position.set(0.0, 0.42, s * 0.16);
    sh.rotation.order = 'YXZ';
    const arm = mesh(box(0.3, 0.035, 0.42), grey, 0, 0, s * 0.21);
    const elbow = new THREE.Group();
    elbow.position.set(0, 0, s * 0.42);
    elbow.rotation.order = 'YXZ';
    const hand = mesh(box(0.24, 0.03, 0.34), grey, -0.03, 0, s * 0.17);
    const tip = mesh(box(0.16, 0.032, 0.14), ink, -0.06, 0, s * 0.38, false);
    elbow.add(hand, tip);
    sh.add(arm, elbow);
    g.add(sh);
    wings.push({ sh, elbow, s });
  }
  const legs = new THREE.Group();
  for (const s of [-1, 1]) legs.add(mesh(cyl(0.018, 0.018, 0.2, 4), leg, 0.02, 0.1, s * 0.07, false), mesh(box(0.1, 0.015, 0.06), leg, 0.06, 0.005, s * 0.07, false));
  g.add(legs);
  g.userData = { wings, head, legs, body };
  return g;
}

/**
 * One gull. opts: { area: { x, z, r }, alt: [lo, hi], perches: [{ x, y, z }], follow: () => {x,y,z} | null }.
 * With follow, it flies around a moving point (the boat on the trip) and never lands: its position is then
 * kept relative to that point (area x/z are offsets), so it keeps up with a fast boat.
 */
export class Gull {
  constructor(scene, opts) {
    this.g = makeGull();
    this.g.scale.setScalar(opts.scale || 0.95);
    scene.add(this.g);
    this.o = opts;
    const a = Math.random() * Math.PI * 2;
    const A = opts.area;
    this.pos = new THREE.Vector3(A.x + Math.cos(a) * A.r * 0.6, opts.alt[0] + Math.random() * (opts.alt[1] - opts.alt[0]), A.z + Math.sin(a) * A.r * 0.6);
    this.yaw = Math.random() * Math.PI * 2;
    this.bank = 0;
    this.pitch = 0;
    this.state = 'fly';
    this.t = 0;
    this.flapPh = Math.random() * 6;
    this.flapping = true;
    this.cycle = 1 + Math.random() * 2; // seconds left in this flap / glide spell
    this.landIn = 8 + Math.random() * 14;
    this.target = this.pickTarget();
    this.fold = 0; // 0 spread .. 1 folded
    this.wingAmp = 0;
    this.vy = 0;
  }

  pickTarget() {
    const A = this.o.area, a = Math.random() * Math.PI * 2, r = A.r * Math.sqrt(Math.random());
    return new THREE.Vector3(A.x + Math.cos(a) * r, this.o.alt[0] + Math.random() * (this.o.alt[1] - this.o.alt[0]), A.z + Math.sin(a) * r);
  }

  /** Steer toward a point: turn at most TURN rad/s, bank into the turn, climb or sink gently. */
  steer(to, dt, speed, climb = 1.4) {
    const dx = to.x - this.pos.x, dz = to.z - this.pos.z;
    const want = Math.atan2(-dz, dx);
    let d = want - this.yaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    const turn = THREE.MathUtils.clamp(d, -TURN * dt, TURN * dt);
    this.yaw += turn;
    const rate = turn / Math.max(dt, 1e-3);
    this.bank += (THREE.MathUtils.clamp(-rate * 0.55, -0.75, 0.75) - this.bank) * Math.min(1, dt * 4);
    this.pos.x += Math.cos(this.yaw) * speed * dt;
    this.pos.z -= Math.sin(this.yaw) * speed * dt;
    const dy = THREE.MathUtils.clamp(to.y - this.pos.y, -climb, climb);
    this.pos.y += dy * dt;
    this.pitch += (THREE.MathUtils.clamp(dy * 0.25, -0.35, 0.4) - this.pitch) * Math.min(1, dt * 3);
    return Math.hypot(dx, dz);
  }

  update(dt, ctx = {}) {
    this.t += dt;
    const o = this.o, night = ctx.night || 0, P = ctx.player;
    const scared = P && Math.hypot(P.x - this.pos.x, P.z - this.pos.z) < 2.6 && (P.y ?? 0) + 2 > this.pos.y;
    if (this.state === 'fly') {
      const d = this.steer(this.target, dt, FLY_SPEED);
      if (d < 1.5) this.target = this.pickTarget();
      // flap a while, then glide a while (more flapping when climbing)
      this.cycle -= dt;
      if (this.cycle <= 0) { this.flapping = !this.flapping; this.cycle = this.flapping ? 0.8 + Math.random() * 1.2 : 1.4 + Math.random() * 2.2; }
      if (this.target.y - this.pos.y > 1.2) this.flapping = true;
      this.landIn -= dt * (night > 0.6 ? 4 : 1);
      if (!o.follow && o.perches?.length && this.landIn <= 0) {
        const free = o.perches.filter((p) => !p.taken && !(P && Math.hypot(P.x - p.x, P.z - p.z) < 4));
        if (free.length) { this.perch = free[Math.floor(Math.random() * free.length)]; this.perch.taken = true; this.state = 'land'; }
        else this.landIn = 4;
      }
    } else if (this.state === 'land') {
      const p = this.perch;
      const d = Math.hypot(p.x - this.pos.x, p.z - this.pos.z);
      const near = THREE.MathUtils.clamp(d / 5, 0, 1);
      const to = new THREE.Vector3(p.x, p.y + Math.min(3, d * 0.45), p.z);
      this.steer(to, dt, FLY_SPEED * (0.35 + 0.65 * near), 2.4);
      this.flapping = d < 3; // flutter down at the end
      if (d < 0.35 && this.pos.y - p.y < 0.4) {
        this.pos.set(p.x, p.y, p.z);
        this.state = 'stand';
        this.standT = night > 0.6 ? 9999 : 5 + Math.random() * 9;
        this.pitch = 0;
        this.bank = 0;
        this.peck = 0;
        this.lookT = 1;
      } else if (d < 0.6) this.pos.y += (p.y - this.pos.y) * Math.min(1, dt * 6);
    } else if (this.state === 'stand') {
      this.standT -= dt;
      if (night < 0.5 && this.standT > 20) this.standT = 2 + Math.random() * 4; // morning: off it goes
      this.lookT -= dt;
      const ud = this.g.userData;
      if (this.lookT <= 0) { this.lookT = 0.8 + Math.random() * 2; this.lookYaw = (Math.random() - 0.5) * 1.6; if (Math.random() < 0.3) this.peck = 1; if (Math.random() < 0.25) this.yaw += (Math.random() - 0.5) * 1.2; }
      ud.head.rotation.y += ((this.lookYaw || 0) - ud.head.rotation.y) * Math.min(1, dt * 6);
      this.peck = Math.max(0, (this.peck || 0) - dt * 2.5);
      ud.head.rotation.z = -Math.sin(this.peck * Math.PI) * 0.9;
      if (this.standT <= 0 || scared) {
        this.state = 'fly';
        this.perch.taken = false;
        this.perch = null;
        this.flapping = true;
        this.cycle = 1.2;
        this.landIn = 10 + Math.random() * 16;
        this.target = this.pickTarget();
        this.target.y = Math.max(this.target.y, this.pos.y + 2.5);
        ud.head.rotation.set(0, 0, 0);
      }
    }
    this.pose(dt);
  }

  /** Wings, legs and the body's tilt from the state. */
  pose(dt) {
    const ud = this.g.userData, standing = this.state === 'stand';
    this.fold += ((standing ? 1 : 0) - this.fold) * Math.min(1, dt * (standing ? 6 : 10));
    const flap = !standing && this.flapping;
    this.wingAmp += ((flap ? 1 : 0) - this.wingAmp) * Math.min(1, dt * 5);
    const hz = this.state === 'land' ? FLAP_HZ * 1.6 : FLAP_HZ;
    this.flapPh += dt * hz * Math.PI * 2 * (0.35 + 0.65 * this.wingAmp);
    const stroke = Math.sin(this.flapPh); // +1 up, -1 down
    const glideUp = 0.12 + Math.sin(this.t * 1.7) * 0.04; // a soft V while gliding
    const lift = (stroke * 0.95 + 0.15) * this.wingAmp + glideUp * (1 - this.wingAmp);
    for (const w of ud.wings) {
      const up = lift * (1 - this.fold);
      w.sh.rotation.x = -w.s * up; // left wing (+z) lifts with -x, right wing with +x
      w.sh.rotation.y = -w.s * this.fold * 1.45; // folded back along the body
      w.sh.rotation.z = -this.fold * 0.15;
      // the hand trails the arm: bent down on the upstroke, straight on the downstroke; tucked when folded
      w.elbow.rotation.x = w.s * (Math.cos(this.flapPh) * 0.45 * this.wingAmp * (1 - this.fold));
      w.elbow.rotation.y = -w.s * this.fold * 2.6;
    }
    ud.legs.visible = this.fold > 0.5 || this.state === 'land';
    const bob = standing ? 0 : -stroke * 0.05 * this.wingAmp;
    const c = this.o.follow?.() || { x: 0, y: 0, z: 0 };
    this.g.position.set(c.x + this.pos.x, c.y + this.pos.y + bob, c.z + this.pos.z);
    let yaw = this.yaw;
    if (this.o.follow) {
      // over a fast boat: face the way it really flies over the water (the boat's speed plus its own)
      const L = this.lastWorld || (this.lastWorld = this.g.position.clone());
      const dx = this.g.position.x - L.x, dz = this.g.position.z - L.z;
      if (Math.hypot(dx, dz) > dt * 0.8) this.showYaw = Math.atan2(-dz, dx);
      L.copy(this.g.position);
      if (this.showYaw !== undefined) yaw = this.showYaw;
    }
    this.g.rotation.set(standing ? 0 : this.bank, yaw, standing ? 0.12 : this.pitch);
  }

  set visible(v) { this.g.visible = v; }
  get visible() { return this.g.visible; }
}

/** Gull positions over time, for the test page: { y, wingX } of each. */
export function gullDebug(gulls) {
  return gulls.map((g) => ({ state: g.state, y: +g.pos.y.toFixed(2), wing: +g.g.userData.wings[0].sh.rotation.x.toFixed(3), fold: +g.fold.toFixed(2) }));
}
