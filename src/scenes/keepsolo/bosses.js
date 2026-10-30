import * as THREE from 'three';
import { COLORS, toon } from '../../core/palette.js';
import { t } from '../../core/i18n.js';
import { Boss } from '../keep/bosses.js';
import { clamp, mesh, sph, cyl, cone, bx } from '../keep/common.js';

// The two new act bosses of Pillow Keep Solo (Big Teddy and the Sleepy Sheep come from the co-op
// keep, keep/bosses.js). Like them, every attack is painted on the floor first (keep/hazards.js).
//   Honk the Goose (Act 2, Feather Forest): honk waves with safe gaps, fans of flying feathers,
//     a dive onto your spot; when grumpy also a wing gust and goslings.
//   Captain Quack (Act 3, Bubble Bath Grotto): three belly slides in a row, falling sponges all
//     around you; later spinning water jets, squeak rings and ducklings.

// ---------------------------------------------------------------- Honk the Goose

export class GooseBoss extends Boss {
  constructor(s, x, z) {
    super(s, x, z, { hp: 400, r: 1.35, phases: [0.5] });
    this.nameKey = 'ks.goose';
    this.subKey = 'ks.goose.sub';
    this.yaw = 0;
    this.home = { x, z };
    this.build();
  }

  build() {
    const white = toon(0xffffff), orange = toon(0xff9a2e), ink = toon(COLORS.ink);
    const g = new THREE.Group();
    this.body = g;
    this.g.add(g);
    const belly = mesh(sph(0.95, 18, 14), white, 0, 0.95, 0);
    belly.scale.set(1, 0.85, 1.25);
    const tail = mesh(cone('ksGooseTail', 0.35, 0.6, 8), white, 0, 1.15, -1.15, false);
    tail.rotation.x = -2.2;
    g.add(belly, tail);
    this.neck = new THREE.Group();
    this.neck.position.set(0, 1.4, 0.75);
    const neckM = mesh(cyl('ksGooseNeck', 0.22, 0.3, 1.1, 12), white, 0, 0.5, 0);
    this.neck.add(neckM);
    const head = new THREE.Group();
    head.position.set(0, 1.15, 0.12);
    head.add(mesh(sph(0.38, 16, 12), white, 0, 0, 0));
    this.beak = mesh(cone('ksGooseBeak', 0.16, 0.5, 8), orange, 0, -0.05, 0.5, false);
    this.beak.rotation.x = Math.PI / 2;
    head.add(this.beak);
    for (const sx of [-1, 1]) {
      head.add(mesh(sph(0.08), toon(0xffffff), sx * 0.2, 0.1, 0.28, false));
      head.add(mesh(sph(0.05), ink, sx * 0.21, 0.1, 0.34, false));
      this.brow = mesh(bx('ksGooseBrow', 0.18, 0.05, 0.05), ink, sx * 0.2, 0.24, 0.32, false);
      this.brow.rotation.z = sx * -0.35;
      head.add(this.brow);
    }
    this.neck.add(head);
    this.head = head;
    g.add(this.neck);
    // a blue ribbon bow on the neck
    for (const sx of [-1, 1]) {
      const b = mesh(cone('ksGooseBow', 0.18, 0.32, 4), toon(0x4cc9f0), sx * 0.18, 1.55, 0.95, false);
      b.rotation.z = sx * Math.PI / 2;
      g.add(b);
    }
    this.wings = [-1, 1].map((sx) => {
      const w = new THREE.Group();
      w.position.set(sx * 0.85, 1.1, 0);
      const f = mesh(sph(0.55, 14, 10), toon(0xf1ecf8), sx * 0.3, 0, -0.1);
      f.scale.set(0.4, 0.75, 1.2);
      w.add(f);
      g.add(w);
      return { w, sx };
    });
    for (const sx of [-1, 1]) {
      const foot = mesh(sph(0.22, 10, 8), orange, sx * 0.4, 0.06, 0.3, false);
      foot.scale.set(1, 0.3, 1.5);
      g.add(foot, mesh(cyl('ksGooseLeg', 0.06, 0.06, 0.25, 6), orange, sx * 0.4, 0.2, 0.15, false));
    }
    this.shadow = mesh(sph(1, 16, 8), toon(0x000000, { transparent: true, opacity: 0.2 }), 0, 0.03, 0, false);
    this.shadow.scale.set(1.5, 0.02, 1.5);
    this.s.level.add(this.shadow);
    this.g.position.set(this.x, 0, this.z);
  }

  idleMove(dt) {
    let best = null, bd = Infinity;
    for (const e of this.targets()) { const d = Math.hypot(e.x - this.x, e.z - this.z); if (d < bd) { bd = d; best = e; } }
    if (best && bd > 4) this.walkToward(best.x, best.z, 2.4 + this.phase * 0.6, dt);
    else if (best) this.yaw = Math.atan2(best.x - this.x, best.z - this.z);
  }

  startAct() {
    const s = this.s, H = s.hazards, P = this.phase;
    const opts = ['honk', 'volley', 'dive'];
    if (P >= 1) opts.push('gust', 'volley');
    if (P >= 1 && s.grumbles.length < 3) opts.push('summon');
    const name = this.choose(opts);
    const tg = this.pickTarget();
    this.act = { name, t: 0, dur: 2 };
    if (name === 'honk') {
      const gapsN = P === 0 ? 3 : 2;
      const base = Math.random() * Math.PI * 2;
      const gaps = Array.from({ length: gapsN }, (_, i) => base + (i / gapsN) * Math.PI * 2 + (Math.random() - 0.5) * 0.4);
      H.add({ shape: 'wave', x: this.x, z: this.z, gaps, gapHalf: P ? 0.38 : 0.46, speed: 7, rMax: 18, warn: 1.4, yawn: 0.34 });
      this.act.dur = 3.6;
      s.floater(t('ks.honk'), new THREE.Vector3(this.x, 3.8, this.z), '#ff9a2e', 1.2, true);
      s.game.audio.play('boing');
    } else if (name === 'volley') {
      // A fan of flying feathers: lines from the goose toward you, with gaps between them.
      const n = P ? 7 : 5;
      const yaw0 = Math.atan2(tg.x - this.x, tg.z - this.z);
      this.yaw = yaw0;
      for (let i = 0; i < n; i++) {
        const yaw = yaw0 + (i - (n - 1) / 2) * (P ? 0.24 : 0.3);
        const len = this.reach(this.x, this.z, yaw, 16) + this.r;
        H.add({ shape: 'rect', x: this.x, z: this.z, yaw, len, width: 0.85, warn: P ? 0.95 : 1.15, yawn: 0.3 });
      }
      this.act.dur = 1.8;
      s.game.audio.play('whoosh');
    } else if (name === 'dive') {
      this.act.from = { x: this.x, z: this.z };
      this.act.to = { x: clamp(tg.x, s.arena.x0 + 1.5, s.arena.x1 - 1.5), z: clamp(tg.z, s.arena.z0 + 1.5, s.arena.z1 - 1.5) };
      this.act.hz = H.add({ shape: 'circle', x: this.act.to.x, z: this.act.to.z, r: 2.5 + P * 0.3, warn: P ? 1.1 : 1.35, yawn: 0.45 });
      this.act.dur = 99;
      s.game.audio.play('jump');
    } else if (name === 'gust') {
      const yaw = Math.atan2(tg.x - this.x, tg.z - this.z);
      this.yaw = yaw;
      H.add({ shape: 'cone', x: this.x, z: this.z, yaw, r: 8.5, half: 0.5, warn: 1.05, yawn: 0.3, onFire: (h) => this.gustFx(h) });
      this.act.dur = 1.7;
    } else {
      for (let i = 0; i < 3; i++) s.spawnGrumble(this.x + Math.cos(i * 2.1) * 2.2, this.z + Math.sin(i * 2.1) * 2.2, null, i === 2 ? 'charger' : 'basic', 0xfff07a);
      s.game.audio.play('boing');
      this.act.dur = 1;
    }
  }

  gustFx(h) {
    for (let i = 0; i < 12; i++) {
      const a = h.yaw + (Math.random() - 0.5) * h.half * 2, d = 1.5 + Math.random() * (h.r - 1.5);
      this.s.puffs.burst(new THREE.Vector3(h.x + Math.sin(a) * d, 0.8, h.z + Math.cos(a) * d), 0xffffff, { count: 1, size: 0.5, life: 0.6, speed: 3 });
    }
  }

  runAct(dt) {
    const a = this.act;
    a.t += dt;
    if (a.name === 'dive') {
      const k = clamp(a.t / a.hz.warn, 0, 1);
      this.x = a.from.x + (a.to.x - a.from.x) * k;
      this.z = a.from.z + (a.to.z - a.from.z) * k;
      this.y = Math.sin(k * Math.PI) * 6;
      if (a.hz.fired) {
        this.y = 0;
        this.clampArena();
        this.s.puffs.burst(new THREE.Vector3(this.x, 0.3, this.z), 0xffffff, { count: 16, size: 0.6, life: 0.8, speed: 5 });
        this.act = null;
        this.next = 1.4 * (this.phase ? 0.75 : 1);
      }
      return;
    }
    if (a.t > a.dur) { this.act = null; this.next = this.phase ? 0.9 : 1.3; }
  }

  pose(dt) {
    if (this.gone) return;
    const time = this.s.time, a = this.act;
    const asleep = this.state === 'asleep';
    this.g.position.set(this.x, this.y, this.z);
    this.g.rotation.y += (this.yaw - this.g.rotation.y) * Math.min(1, dt * 6);
    this.g.rotation.z = asleep ? Math.min(1, this.sleepT) * 0.6 : 0;
    const sq = 1 + this.flash * 1.2;
    this.body.scale.set(1.4 * sq, 1.4 / sq, 1.4 * sq);
    const flap = a?.name === 'dive' || a?.name === 'gust' ? Math.sin(time * 22) * 0.9 : this.state === 'fight' ? Math.sin(time * 4) * 0.15 : 0;
    for (const { w, sx } of this.wings) w.rotation.z = sx * (0.2 + flap);
    const honk = a?.name === 'honk' && a.t < 0.8;
    this.neck.rotation.x = asleep ? 1.2 : honk ? -0.4 : Math.sin(time * 3) * 0.08;
    this.beak.scale.set(1, honk ? 1.4 : 1, 1);
    this.shadow.position.set(this.x, 0.03, this.z);
    this.shadow.scale.set(1.5 * (1 - this.y / 10), 0.02, 1.5 * (1 - this.y / 10));
    this.stars(asleep, this.y + 4.2);
  }

  poof() {
    this.s.level.remove(this.shadow);
    if (this.starRing) this.s.level.remove(this.starRing);
    super.poof();
  }
}

// ---------------------------------------------------------------- Captain Quack

export class DuckBoss extends Boss {
  constructor(s, x, z) {
    super(s, x, z, { hp: 450, r: 1.6, phases: [0.6, 0.3] });
    this.nameKey = 'ks.duck';
    this.subKey = 'ks.duck.sub';
    this.yaw = 0;
    this.dizzy = 0;
    this.home = { x, z };
    this.build();
  }

  build() {
    const yellow = toon(0xffd23f), orange = toon(0xff8c42), ink = toon(COLORS.ink);
    const g = new THREE.Group();
    this.body = g;
    this.g.add(g);
    const body = mesh(sph(1.1, 20, 14), yellow, 0, 0.9, 0);
    body.scale.set(1.05, 0.75, 1.3);
    const tail = mesh(cone('ksDuckTail', 0.4, 0.7, 10), yellow, 0, 1.3, -1.35, false);
    tail.rotation.x = -2.0;
    g.add(body, tail);
    const head = new THREE.Group();
    head.position.set(0, 1.85, 0.75);
    head.add(mesh(sph(0.7, 18, 14), yellow, 0, 0, 0));
    const beak = mesh(sph(0.36, 14, 10), orange, 0, -0.15, 0.65, false);
    beak.scale.set(1.2, 0.45, 1);
    this.beak = beak;
    head.add(beak);
    for (const sx of [-1, 1]) {
      head.add(mesh(sph(0.15), toon(0xffffff), sx * 0.3, 0.15, 0.5, false));
      head.add(mesh(sph(0.08), ink, sx * 0.32, 0.15, 0.62, false));
      const blush = mesh(sph(0.1), toon(COLORS.blush), sx * 0.45, -0.1, 0.45, false);
      blush.scale.set(1, 0.6, 0.4);
      head.add(blush);
    }
    // a captain's sailor cap
    const cap = mesh(cyl('ksDuckCap', 0.5, 0.55, 0.28, 18), toon(0x2f4f9a), 0, 0.62, -0.05);
    const capTop = mesh(cyl('ksDuckCapTop', 0.62, 0.6, 0.08, 18), toon(0xffffff), 0, 0.8, -0.05, false);
    const brim = mesh(bx('ksDuckBrim', 0.6, 0.06, 0.3), toon(COLORS.ink), 0, 0.5, 0.42, false);
    const badge = mesh(sph(0.09), toon(COLORS.gold, { emissive: 0x4a3000 }), 0, 0.64, 0.5, false);
    head.add(cap, capTop, brim, badge);
    g.add(head);
    this.head = head;
    this.wings = [-1, 1].map((sx) => {
      const w = mesh(sph(0.5, 14, 10), toon(0xffc21a), sx * 1.0, 1.0, -0.1);
      w.scale.set(0.35, 0.6, 1.0);
      g.add(w);
      return w;
    });
    // bath water ring around the duck
    const ring = mesh(new THREE.TorusGeometry(1.5, 0.12, 6, 28), toon(0xbfe9ff, { transparent: true, opacity: 0.7 }), 0, 0.15, 0, false);
    ring.rotation.x = Math.PI / 2;
    g.add(ring);
    this.shadow = mesh(sph(1, 16, 8), toon(0x000000, { transparent: true, opacity: 0.18 }), 0, 0.03, 0, false);
    this.shadow.scale.set(1.7, 0.02, 1.7);
    this.s.level.add(this.shadow);
    this.g.position.set(this.x, 0, this.z);
  }

  idleMove(dt) {
    let best = null, bd = Infinity;
    for (const e of this.targets()) { const d = Math.hypot(e.x - this.x, e.z - this.z); if (d < bd) { bd = d; best = e; } }
    const tx = best ? (best.x + this.home.x) / 2 : this.home.x, tz = best ? (best.z + this.home.z) / 2 : this.home.z;
    this.walkToward(tx, tz, 1.8 + this.phase * 0.5, dt);
  }

  startAct() {
    const s = this.s, H = s.hazards, P = this.phase;
    const opts = ['slide', 'sponges'];
    if (P >= 1) opts.push('jets', 'squeak');
    if (P >= 1 && s.grumbles.length < 3) opts.push('summon');
    const name = this.choose(opts);
    this.act = { name, t: 0, dur: 2, n: 0 };
    if (name === 'slide') {
      this.act.count = P >= 2 ? 4 : 3;
      this.aimSlide();
    } else if (name === 'sponges') {
      // Sponges fall on you and in a ring around you: step through a gap.
      const tg = this.pickTarget();
      const n = 6 + P * 2;
      const pts = [[tg.x, tg.z]];
      const a0 = Math.random() * Math.PI * 2;
      for (let i = 0; i < n; i++) { const a = a0 + (i / n) * Math.PI * 2; pts.push([tg.x + Math.cos(a) * 3.2, tg.z + Math.sin(a) * 3.2]); }
      pts.forEach(([x, z], i) => {
        const cx = clamp(x, s.arena.x0 + 1, s.arena.x1 - 1), cz = clamp(z, s.arena.z0 + 1, s.arena.z1 - 1);
        s.later(i === 0 ? 0 : 0.5 + i * 0.07, () => { if (this.state === 'fight') H.add({ shape: 'circle', x: cx, z: cz, r: 1.3, warn: 1.3, drop: true, dropColor: [0x8fd8ff, 0xff9fd0, 0x9ff0c8][i % 3], yawn: 0.32 }); });
      });
      this.act.dur = 2.6;
      s.game.audio.play('whoosh');
    } else if (name === 'jets') {
      const count = P >= 2 ? 4 : 3;
      const tg = this.pickTarget();
      const yaw = Math.atan2(tg.x - this.x, tg.z - this.z) + Math.PI / count;
      H.add({ shape: 'beam', follow: () => ({ x: this.x, z: this.z }), yaw, spin: (Math.random() < 0.5 ? -1 : 1) * (0.55 + 0.1 * P), len: 11, width: 1.1, count, warn: 1.5, life: 4, yawn: 0.32 });
      this.act.dur = 5.8;
      this.act.still = true;
    } else if (name === 'squeak') {
      const base = Math.random() * Math.PI * 2;
      const gaps = [base, base + Math.PI];
      H.add({ shape: 'wave', x: this.x, z: this.z, gaps, gapHalf: P >= 2 ? 0.36 : 0.42, speed: 6.5, rMax: 18, warn: 1.4, yawn: 0.34 });
      if (P >= 2) s.later(1.5, () => { if (this.state === 'fight') H.add({ shape: 'wave', x: this.x, z: this.z, gaps: gaps.map((g) => g + Math.PI / 2), gapHalf: 0.4, speed: 6.5, rMax: 18, warn: 1.3, yawn: 0.34 }); });
      this.act.dur = P >= 2 ? 5 : 3.6;
      s.floater(t('ks.squeak'), new THREE.Vector3(this.x, 4, this.z), '#ff8c42', 1.2, true);
    } else {
      for (let i = 0; i < 3; i++) s.spawnGrumble(this.x + Math.cos(i * 2.1) * 2.4, this.z + Math.sin(i * 2.1) * 2.4, null, i === 2 ? 'thrower' : 'basic', 0xffe27a);
      s.game.audio.play('boing');
      this.act.dur = 1;
    }
  }

  aimSlide() {
    const tg = this.pickTarget();
    const yaw = Math.atan2(tg.x - this.x, tg.z - this.z);
    const len = this.reach(this.x, this.z, yaw, 20);
    Object.assign(this.act, { phase: 'aim', yaw, len, t: 0 });
    this.yaw = yaw;
    this.act.hz = this.s.hazards.add({ shape: 'rect', x: this.x, z: this.z, yaw, len: len + this.r, width: this.r * 2 + 0.2, warn: this.phase >= 1 ? 0.75 : 0.95, noHit: true });
  }

  runAct(dt) {
    const a = this.act;
    a.t += dt;
    if (a.name !== 'slide') {
      if (a.t > a.dur) { this.act = null; this.next = [1.3, 1.0, 0.8][this.phase]; }
      return;
    }
    if (a.phase === 'aim') {
      if (a.hz.fired) { a.phase = 'run'; a.ran = 0; this.s.game.audio.play('dash'); }
    } else if (a.phase === 'run') {
      const step = Math.min(16 * dt, a.len - a.ran);
      this.x += Math.sin(a.yaw) * step; this.z += Math.cos(a.yaw) * step;
      a.ran += step;
      for (const e of this.s.ents) {
        if (e.state !== 'walk') continue;
        if (Math.hypot(e.x - this.x, e.z - this.z) < this.r + 0.6 && this.s.addYawn(e, 0.38)) {
          const side = Math.sign((e.x - this.x) * Math.cos(a.yaw) - (e.z - this.z) * Math.sin(a.yaw)) || 1;
          e.vx += Math.cos(a.yaw) * side * 12; e.vz += -Math.sin(a.yaw) * side * 12;
        }
      }
      if (Math.random() < dt * 20) this.s.puffs.burst(new THREE.Vector3(this.x, 0.3, this.z), 0xbfe9ff, { count: 1, size: 0.5, life: 0.5, speed: 2 });
      if (a.ran >= a.len - 0.01) {
        a.n++;
        this.s.game.audio.play('bump');
        if (a.n < a.count) this.aimSlide();
        else { a.phase = 'dizzy'; this.dizzy = 1.6; }
      }
    } else {
      // After the last slide the captain is dizzy: bonk time!
      this.dizzy -= dt;
      if (this.dizzy <= 0) { this.act = null; this.dizzy = 0; this.next = [1.2, 0.9, 0.7][this.phase]; }
    }
  }

  pose(dt) {
    if (this.gone) return;
    const time = this.s.time, a = this.act;
    const asleep = this.state === 'asleep';
    const bob = this.state === 'fight' ? Math.sin(time * 2.4) * 0.08 : 0;
    const shake = a?.name === 'slide' && a.phase === 'aim' ? Math.sin(time * 40) * 0.08 : 0;
    this.g.position.set(this.x + shake, bob, this.z);
    this.g.rotation.y += (this.yaw - this.g.rotation.y) * Math.min(1, dt * 6);
    this.g.rotation.z = asleep ? Math.min(1, this.sleepT) * 0.5 : Math.sin(time * 2) * 0.04;
    this.g.rotation.x = a?.name === 'slide' && a.phase === 'run' ? 0.35 : 0;
    const sq = 1 + this.flash * 1.3;
    this.body.scale.set(1.3 * sq, 1.3 / sq, 1.3 * sq);
    for (const [i, w] of this.wings.entries()) w.rotation.z = (i ? -1 : 1) * (a?.name === 'jets' ? 0.6 + Math.sin(time * 18) * 0.3 : 0.1);
    this.beak.scale.y = a?.name === 'squeak' && a.t < 0.7 ? 0.8 : 0.45;
    this.shadow.position.set(this.x, 0.03, this.z);
    this.stars(this.dizzy > 0 || asleep, 4.2);
  }

  poof() {
    this.s.level.remove(this.shadow);
    if (this.starRing) this.s.level.remove(this.starRing);
    super.poof();
  }
}
