import * as THREE from 'three';
import { Round, clock } from './common.js';
import { makeGrumble } from '../../core/critters.js';
import { COLORS, toon, sharedGeo } from '../../core/palette.js';
import { makeTree, makeFlower, makeBush, seeded } from '../../core/world.js';
import { t, addStrings } from '../../core/i18n.js';

addStrings({
  en: {
    'boats.title': 'Bumper Boats',
    'boats.hint': 'Steer with the stick, press A for a little dash. Bump other boats out of the buoy ring for a point. Floating out costs a point, then you drift right back in. The ring keeps shrinking!',
    'boats.stay': 'Stay in the ring!', 'boats.oops': 'oops!', 'boats.n': '{n} points · {b} bumps out',
  },
  no: {
    'boats.title': 'Dulteboter',
    'boats.hint': 'Styr med spaken, trykk A for et lite byks. Dult andre båter ut av bøyeringen for å få poeng. Flyter du ut, mister du ett poeng, men du driver rett inn igjen. Ringen blir stadig mindre!',
    'boats.stay': 'Hold deg i ringen!', 'boats.oops': 'oi!', 'boats.n': '{n} poeng · {b} dulta ut',
  },
});

// Bumper Boats: bump the others out of a slowly shrinking ring of buoys.
const TIME = 45;
const R0 = 8.2; // ring radius at the start
const R1 = 4.4; // ...and at the end
const POOL = 12.5;
const BR = 0.8; // boat radius
const ACCEL = 10;
const DRAG = 1.3;
const MAX = 5.2;
const DASH = 7.5;
const DASH_CD = 1.1;
const OUT_TIME = 1.5;
const SAFE = 0.9;
const CREDIT = 2.5; // seconds a bump counts toward pushing someone out
const BUOYS = 36;
const BOT_COLORS = [0x7b6cf6, 0x55b8a0];

const hex = (c) => '#' + c.toString(16).padStart(6, '0');

/** Round inflatable bumper boat with a seat, a wheel and a little flag. */
function makeBoat(color) {
  const g = new THREE.Group();
  const hull = new THREE.Mesh(sharedGeo('bbHull', () => new THREE.CylinderGeometry(0.66, 0.55, 0.4, 24)), toon(COLORS.white));
  hull.position.y = 0.12;
  hull.castShadow = true;
  const bumper = new THREE.Mesh(sharedGeo('bbBumper', () => new THREE.TorusGeometry(0.66, 0.2, 10, 28)), toon(color));
  bumper.rotation.x = Math.PI / 2;
  bumper.position.y = 0.2;
  bumper.castShadow = true;
  g.add(hull, bumper);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const stripe = new THREE.Mesh(sharedGeo('bbStripe', () => new THREE.SphereGeometry(0.21, 10, 8)), toon(COLORS.white));
    stripe.scale.set(0.5, 1.02, 1.02);
    stripe.position.set(Math.sin(a) * 0.66, 0.2, Math.cos(a) * 0.66);
    stripe.rotation.y = a;
    g.add(stripe);
  }
  const wheel = new THREE.Mesh(sharedGeo('bbWheel', () => new THREE.TorusGeometry(0.15, 0.035, 6, 14)), toon(COLORS.ink));
  wheel.position.set(0, 0.62, 0.42);
  wheel.rotation.x = -0.5;
  const post = new THREE.Mesh(sharedGeo('bbPost', () => new THREE.CylinderGeometry(0.03, 0.03, 0.35, 6)), toon(COLORS.ink));
  post.position.set(0, 0.45, 0.45);
  const pole = new THREE.Mesh(sharedGeo('bbPole', () => new THREE.CylinderGeometry(0.025, 0.025, 1.1, 6)), toon(COLORS.white));
  pole.position.set(0, 0.8, -0.55);
  const flag = new THREE.Mesh(sharedGeo('bbFlag', () => new THREE.BoxGeometry(0.03, 0.22, 0.34)), toon(color));
  flag.position.set(0, 1.22, -0.72);
  g.add(wheel, post, pole, flag);
  return g;
}

export class BoatsRound extends Round {
  static key = 'boats';

  constructor(party) {
    super(party);
    this.t = 0;
    this.R = R0;
    this.build();
    const roster = this.players.map((p) => ({ p, color: p.color, css: p.css }));
    if (this.players.length === 1) for (const c of BOT_COLORS) roster.push({ p: null, color: c, css: hex(c) });
    const n = roster.length;
    this.ents = roster.map((r, i) => {
      const boat = makeBoat(r.color);
      let rider;
      if (r.p) {
        rider = this.bean(r.p);
        rider.group.scale.setScalar(0.85);
        rider.group.position.y = 0.12;
      } else {
        const gr = makeGrumble(r.color);
        rider = { group: gr, update() {}, squash() {}, pivot: gr };
        gr.scale.setScalar(1.05);
        gr.position.y = 0.2;
      }
      boat.add(rider.group);
      this.group.add(boat);
      const a = (i / n) * Math.PI * 2;
      const e = {
        p: r.p, bot: !r.p, css: r.css, color: r.color, boat, rider, x: Math.sin(a) * R0 * 0.55, z: Math.cos(a) * R0 * 0.55, vx: 0, vz: 0,
        yaw: a + Math.PI, dashCd: 0, dashT: 0, out: 0, safe: 0, from: null, to: null, lastBy: null, lastT: -99,
        points: 0, outs: 0, falls: 0, think: 0, ax: 0, az: 0, wantDash: false, tag: this.label('label'), shout: 0,
      };
      rider.face?.(0, 1);
      return e;
    });
  }

  get title() { return t('boats.title'); }
  get hint() { return t('boats.hint'); }

  build() {
    const g = this.group;
    const ground = new THREE.Mesh(new THREE.RingGeometry(POOL, 60, 64), toon(COLORS.grass));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0.3;
    ground.receiveShadow = true;
    g.add(ground);
    // Round pool: stone rim, deep water, and the lighter play water inside the buoys.
    const deck = new THREE.Mesh(new THREE.RingGeometry(POOL, POOL + 1.6, 64), toon(COLORS.sand));
    deck.rotation.x = -Math.PI / 2;
    deck.position.y = 0.32;
    deck.receiveShadow = true;
    const lip = new THREE.Mesh(new THREE.TorusGeometry(POOL, 0.3, 8, 72), toon(COLORS.white));
    lip.rotation.x = Math.PI / 2;
    lip.position.y = 0.3;
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(POOL, POOL, 0.6, 64, 1, true), toon(0x2f93c9).clone());
    wall.material.side = THREE.BackSide;
    wall.material.userData = {};
    wall.position.y = 0;
    g.add(deck, lip, wall);
    const water = new THREE.Mesh(new THREE.CircleGeometry(POOL, 64), toon(COLORS.waterDeep));
    water.rotation.x = -Math.PI / 2;
    water.position.y = -0.02;
    water.receiveShadow = true;
    g.add(water);
    this.inner = new THREE.Mesh(new THREE.CircleGeometry(1, 64), toon(0x7ad7f5));
    this.inner.rotation.x = -Math.PI / 2;
    this.inner.position.y = -0.01;
    this.inner.receiveShadow = true;
    g.add(this.inner);
    // Buoy ring.
    this.buoys = [];
    for (let i = 0; i < BUOYS; i++) {
      const b = new THREE.Group();
      const ball = new THREE.Mesh(sharedGeo('bbBuoy', () => new THREE.SphereGeometry(0.24, 12, 10)), toon(i % 2 ? COLORS.white : 0xff5d73));
      ball.castShadow = true;
      const band = new THREE.Mesh(sharedGeo('bbBuoyBand', () => new THREE.TorusGeometry(0.22, 0.05, 6, 14)), toon(i % 2 ? 0xff5d73 : COLORS.white));
      band.rotation.x = Math.PI / 2;
      b.add(ball, band);
      g.add(b);
      this.buoys.push(b);
    }
    // Waves drifting over the water.
    this.waves = [];
    const rand = seeded(88);
    for (let i = 0; i < 10; i++) {
      const w = new THREE.Mesh(sharedGeo('bbWave', () => new THREE.TorusGeometry(0.5, 0.05, 4, 16, Math.PI * 0.7)), toon(0xd8f6ff));
      w.rotation.x = -Math.PI / 2;
      const a = rand() * Math.PI * 2, r = 2 + rand() * (POOL - 3);
      w.position.set(Math.sin(a) * r, 0.0, Math.cos(a) * r);
      w.userData.phase = rand() * 6;
      g.add(w);
      this.waves.push(w);
    }
    // Poolside: umbrellas, a lifebuoy, trees.
    const umbrellaColors = [0xff5d73, 0xffc93c, 0x4cc9f0, 0x9b5de5];
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i - 2) * 0.42;
      const u = new THREE.Group();
      const pole = new THREE.Mesh(sharedGeo('bbUPole', () => new THREE.CylinderGeometry(0.06, 0.06, 2.2, 6)), toon(COLORS.white));
      pole.position.y = 1.1;
      const top = new THREE.Mesh(sharedGeo('bbUTop', () => new THREE.ConeGeometry(1.2, 0.6, 8)), toon(umbrellaColors[i % 4]));
      top.position.y = 2.3;
      top.castShadow = true;
      u.add(pole, top);
      u.position.set(Math.cos(a) * (POOL + 2.6), 0.3, Math.sin(a) * (POOL + 2.6));
      g.add(u);
    }
    for (let i = 0; i < 18; i++) {
      const a = rand() * Math.PI * 2;
      const r = POOL + 5 + rand() * 7;
      const tr = makeTree(rand, 1.3 + rand() * 0.6);
      tr.position.set(Math.sin(a) * r * 1.25, 0.3, Math.cos(a) * r);
      if (tr.position.z > 6) continue;
      g.add(tr);
    }
    for (let i = 0; i < 8; i++) {
      const b = makeBush(rand, 0.9 + rand() * 0.4);
      const a = rand() * Math.PI * 2;
      b.position.set(Math.sin(a) * (POOL + 3.5) * 1.2, 0.3, Math.cos(a) * (POOL + 3.5));
      if (b.position.z > 4) continue;
      g.add(b);
    }
    for (let i = 0; i < 30; i++) {
      const f = makeFlower(rand);
      const a = rand() * Math.PI * 2;
      const r = POOL + 2 + rand() * 6;
      f.position.set(Math.sin(a) * r * 1.3, 0.3, Math.cos(a) * r);
      g.add(f);
    }
  }

  /** The camera eases in as the ring shrinks. */
  frame() {
    const d = this.party.fitDistance(this.R * 2 + 4.5, (this.R * 2 + 3.5) * 0.92);
    this.camera.position.set(0, d * 0.78, d * 0.66 + 0.6);
    this.camera.lookAt(0, 0, 0.5);
  }

  start() {}

  /** Bots: line up on the pool side of someone and shove them outward. */
  botBrain(e, dt) {
    e.think -= dt;
    if (e.think > 0) return;
    e.think = 0.18 + Math.random() * 0.12;
    let best = null, bd = 1e9;
    for (const o of this.ents) {
      if (o === e || o.out > 0 || o.safe > 0) continue;
      const d = Math.hypot(o.x - e.x, o.z - e.z) - Math.hypot(o.x, o.z) * 0.4; // prefer boats near the edge
      if (d < bd) { bd = d; best = o; }
    }
    let wx = -e.x * 0.2, wz = -e.z * 0.2;
    e.wantDash = false;
    if (best) {
      const r = Math.max(0.5, Math.hypot(best.x, best.z));
      const ox = best.x / r, oz = best.z / r;
      const behind = (e.x - best.x) * ox + (e.z - best.z) * oz < -0.2;
      const dist = Math.hypot(best.x - e.x, best.z - e.z);
      if (behind) {
        wx = best.x - e.x; wz = best.z - e.z;
        e.wantDash = dist < 2.8 && e.dashCd <= 0 && Math.random() < 0.6;
      } else {
        wx = best.x - ox * 1.6 - e.x; wz = best.z - oz * 1.6 - e.z;
      }
    }
    // Stay well inside the ring.
    const myR = Math.hypot(e.x, e.z);
    if (myR > this.R - 1.6) { wx -= (e.x / myR) * 4; wz -= (e.z / myR) * 4; e.wantDash = false; }
    const m = Math.hypot(wx, wz) || 1;
    e.ax = (wx / m) * 0.78;
    e.az = (wz / m) * 0.78;
  }

  knockOut(e) {
    e.out = OUT_TIME;
    e.falls++;
    e.shout = 1.2;
    e.points = Math.max(0, e.points - 1);
    this.game.audio.play('splat');
    this.party.puffs.burst(new THREE.Vector3(e.x, 0.3, e.z), 0xd8f6ff, { count: 16, size: 0.4, life: 0.6, speed: 4 });
    const by = this.time - e.lastT < CREDIT ? e.lastBy : null;
    if (by && by !== e) {
      by.points++;
      by.outs++;
      this.later(0.15, () => this.game.audio.play('coin'));
      this.party.confetti.burst(new THREE.Vector3(by.x, 1.8, by.z), 0, { count: 18, speed: 5, colors: [by.color, COLORS.gold, COLORS.white] });
    }
    // Pick a calm spot to drift back to.
    let best = null, bestD = -1;
    for (let k = 0; k < 12; k++) {
      const a = Math.random() * Math.PI * 2, r = Math.random() * this.R * 0.5;
      const x = Math.sin(a) * r, z = Math.cos(a) * r;
      const d = Math.min(...this.ents.filter((o) => o !== e).map((o) => Math.hypot(o.x - x, o.z - z)), 99);
      if (d > bestD) { bestD = d; best = { x, z }; }
    }
    e.to = best;
    e.from = { x: e.x, z: e.z };
  }

  update(dt, playing) {
    this.time += dt;
    if (playing) this.t += dt;
    const k = THREE.MathUtils.clamp((this.t - 3) / (TIME - 8), 0, 1);
    this.R = R0 - (R0 - R1) * k;
    this.inner.scale.setScalar(this.R);
    this.frame();
    this.buoys.forEach((b, i) => {
      const a = (i / BUOYS) * Math.PI * 2 + this.time * 0.05;
      b.position.set(Math.sin(a) * this.R, 0.05 + Math.sin(this.time * 2.5 + i) * 0.05, Math.cos(a) * this.R);
    });
    for (const w of this.waves) {
      const u = (this.time * 0.3 + w.userData.phase) % 1;
      w.scale.setScalar(0.6 + u);
      w.visible = u < 0.8;
    }
    const active = playing && this.t < TIME;

    for (const e of this.ents) {
      e.dashCd -= dt;
      e.dashT -= dt;
      e.safe -= dt;
      e.shout -= dt;
      if (e.out > 0) {
        // Bobbing outside the ring, then drifting back in over the buoys.
        e.out -= dt;
        const u = THREE.MathUtils.clamp(1 - e.out / 0.6, 0, 1);
        const s = u * u * (3 - 2 * u);
        e.x = THREE.MathUtils.lerp(e.from.x, e.to.x, s);
        e.z = THREE.MathUtils.lerp(e.from.z, e.to.z, s);
        e.vx = e.vz = 0;
        e.yaw += dt * (u > 0 ? 3 : 9);
        e.boat.position.set(e.x, -0.25 * (1 - u) + Math.sin(u * Math.PI) * 0.8, e.z);
        e.boat.rotation.set(Math.sin(this.time * 12) * 0.25 * (1 - u), e.yaw, 0);
        if (e.out <= 0) { e.safe = SAFE; e.rider.squash(0.7); this.game.audio.play('boing'); }
        continue;
      }
      let ix = 0, iz = 0, dash = false;
      if (active) {
        if (e.bot) { this.botBrain(e, dt); ix = e.ax; iz = e.az; dash = e.wantDash; e.wantDash = false; } else {
          const d = this.input(e.p);
          ix = d.x; iz = -d.y; dash = d.aPressed;
        }
      }
      const im = Math.hypot(ix, iz);
      if (im > 0.15) {
        e.vx += ix * ACCEL * dt; e.vz += iz * ACCEL * dt;
        let dy = Math.atan2(ix, iz) - e.yaw;
        dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        e.yaw += dy * Math.min(1, dt * 7);
      }
      if (dash && e.dashCd <= 0) {
        const fx = im > 0.15 ? ix / im : Math.sin(e.yaw), fz = im > 0.15 ? iz / im : Math.cos(e.yaw);
        e.vx += fx * DASH; e.vz += fz * DASH;
        e.dashCd = DASH_CD;
        e.dashT = 0.35;
        e.rider.squash(1.25);
        this.game.audio.play('dash');
        this.party.puffs.burst(new THREE.Vector3(e.x - fx * 0.8, 0.15, e.z - fz * 0.8), 0xffffff, { count: 6, size: 0.3, life: 0.4 });
      }
      const drag = Math.exp(-DRAG * dt);
      e.vx *= drag; e.vz *= drag;
      const sp = Math.hypot(e.vx, e.vz);
      const cap = e.dashT > 0 ? MAX + DASH : MAX;
      if (sp > cap) { e.vx *= cap / sp; e.vz *= cap / sp; }
      e.x += e.vx * dt; e.z += e.vz * dt;
      // Past the pool wall is never allowed; past the buoys means out.
      const r = Math.hypot(e.x, e.z);
      if (r > POOL - BR) { e.x *= (POOL - BR) / r; e.z *= (POOL - BR) / r; }
      if (playing && r > this.R + 0.15 && e.safe <= 0) { this.knockOut(e); continue; }
      if (r > this.R - 0.2 && e.safe > 0) { e.x *= (this.R - 0.2) / r; e.z *= (this.R - 0.2) / r; }
      const tilt = THREE.MathUtils.clamp(sp / MAX, 0, 1.5);
      e.boat.position.set(e.x, Math.sin(this.time * 3 + e.yaw) * 0.04, e.z);
      e.boat.rotation.set(-tilt * 0.08 + Math.sin(this.time * 2.2 + e.x) * 0.03, e.yaw, Math.sin(this.time * 1.7 + e.z) * 0.04);
      e.boat.visible = e.safe > 0 ? Math.floor(this.time * 14) % 2 === 0 : true;
      if (sp > 2 && Math.random() < dt * 10) this.party.puffs.burst(new THREE.Vector3(e.x - (e.vx / sp) * 0.8, 0.05, e.z - (e.vz / sp) * 0.8), 0xe8fbff, { count: 1, size: 0.2, life: 0.4, speed: 0.5, up: 0.5 });
    }

    // Boat bumps: bouncy, and a dashing boat shoves harder.
    for (let i = 0; i < this.ents.length; i++) {
      for (let j = i + 1; j < this.ents.length; j++) {
        const a = this.ents[i], b = this.ents[j];
        if (a.out > 0 || b.out > 0 || a.safe > 0 || b.safe > 0) continue;
        const dx = b.x - a.x, dz = b.z - a.z, dd = Math.hypot(dx, dz);
        if (dd >= BR * 2 || dd < 1e-4) continue;
        const nx = dx / dd, nz = dz / dd;
        const push = (BR * 2 - dd) / 2;
        a.x -= nx * push; a.z -= nz * push;
        b.x += nx * push; b.z += nz * push;
        const rel = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
        if (rel >= 0) continue;
        const j0 = -rel * 0.95 + 1.5;
        const ka = 1 + (b.dashT > 0 ? 1.2 : 0); // a gets shoved more if b was dashing
        const kb = 1 + (a.dashT > 0 ? 1.2 : 0);
        a.vx -= nx * j0 * ka; a.vz -= nz * j0 * ka;
        b.vx += nx * j0 * kb; b.vz += nz * j0 * kb;
        a.lastBy = b; a.lastT = this.time;
        b.lastBy = a; b.lastT = this.time;
        a.rider.squash(0.75); b.rider.squash(0.75);
        if (playing) this.game.audio.play('bump');
        this.party.puffs.burst(new THREE.Vector3(a.x + nx * BR, 0.35, a.z + nz * BR), 0xffffff, { count: 6, size: 0.28, life: 0.35 });
      }
    }

    for (const e of this.ents) {
      e.rider.update(dt, {});
      const text = e.shout > 0 ? t('boats.oops') : String(e.points);
      this.setLabel(e.tag, text, e.boat.position.clone().setY(e.boat.position.y + 1.9), e.shout > 0 ? '#1a9fd8' : e.css);
    }

    if (playing && this.t >= TIME + 0.6) this.done = true;
  }

  hud() {
    return `<div class="pill"><b>${t('boats.stay')}</b></div>${clock(TIME - this.t)}`;
  }

  score(p) {
    return this.ents.find((x) => x.p === p).points;
  }

  detail(p) {
    const e = this.ents.find((x) => x.p === p);
    return t('boats.n', { n: e.points, b: e.outs });
  }
}
