import * as THREE from 'three';
import { COLORS, PLAYER_COLORS, toon } from '../../core/palette.js';
import { makeStar } from '../../core/world.js';
import { t } from '../../core/i18n.js';
import { PR, clamp, mesh, sph, cyl, cone, bx } from './common.js';

// The two bosses of Pillow Keep. Both fight only with telegraphed floor attacks (see hazards.js),
// so every hit can be dodged: watch the pink shapes, step out, then bonk the boss.
//   Big Teddy (floor 3): charges along a line, belly-flops onto a circle, tosses pillows.
//   Sleepy Sheep (floor 5): pillow rain, yawn cones, dream waves with safe gaps, moonbeams.
// HP scales with the number of players. Phases are shown on the HUD bar (notches) with a banner.

const HURT_FLASH = 0.15;

class Boss {
  constructor(s, x, z, { hp, r, phases }) {
    this.s = s;
    this.x = x; this.z = z; this.y = 0;
    const n = s.ents.length;
    this.max = Math.round(hp * (1 + 0.7 * (n - 1)));
    this.hp = this.max;
    this.r = r;
    this.phases = phases; // hp fractions where a new phase starts, e.g. [0.5]
    this.phase = 0;
    this.state = 'idle'; // idle -> fight -> (phase change) -> asleep -> gone
    this.next = 2.2;
    this.act = null;
    this.flash = 0;
    this.drowsy = 0;
    this.last = '';
    this.g = new THREE.Group();
    s.level.add(this.g);
  }

  get awake() { return this.state === 'fight' || this.state === 'phase'; }
  get pct() { return this.hp / this.max; }

  wake() {
    this.state = 'fight';
    this.next = 1.6;
    this.s.game.ui.banner(t(this.nameKey), t(this.subKey), 1900);
    this.s.game.audio.play('boing');
    this.s.game.audio.playMusic('space');
  }

  /** A player bonk. Returns true if it landed. */
  damage(amount, by) {
    if (this.state !== 'fight') return this.state === 'phase';
    this.hp = Math.max(0, this.hp - amount * (this.dizzy > 0 ? 1.5 : 1));
    this.flash = HURT_FLASH;
    if (by) by.dealt = (by.dealt || 0) + amount;
    if (this.hp <= 0) { this.fallAsleep(); return true; }
    const p = this.phases[this.phase];
    if (p !== undefined && this.pct <= p) this.nextPhase();
    return true;
  }

  nextPhase() {
    this.phase++;
    this.state = 'phase';
    this.act = null;
    this.s.hazards.clear();
    this.phaseT = 0;
    this.s.game.ui.banner(t(`${this.nameKey}.p${this.phase + 1}`), t(`${this.nameKey}.p${this.phase + 1}sub`), 1700);
    this.s.game.audio.play('dizzy');
    this.s.puffs.burst(new THREE.Vector3(this.x, 1.5, this.z), 0xffe9a8, { count: 16, size: 0.7, life: 0.9, speed: 4 });
  }

  fallAsleep() {
    this.state = 'asleep';
    this.sleepT = 0;
    this.act = null;
    this.s.hazards.clear();
    this.s.game.ui.banner(t(`${this.nameKey}.done`), '', 1700);
    this.s.game.audio.play('dizzy');
  }

  /** Living players, preferring ones that are awake. */
  targets() {
    const w = this.s.ents.filter((e) => e.state === 'walk');
    return w.length ? w : this.s.ents;
  }

  pickTarget() {
    const L = this.targets();
    return L[Math.floor(Math.random() * L.length)];
  }

  choose(options) {
    const pool = options.filter((o) => o !== this.last);
    const pick = pool[Math.floor(Math.random() * pool.length)] || options[0];
    this.last = pick;
    return pick;
  }

  /** How far a charge can go from (x, z) along yaw before hitting a wall. */
  reach(x, z, yaw, max) {
    const dx = Math.sin(yaw), dz = Math.cos(yaw);
    let d = 0;
    while (d < max) {
      const nx = x + dx * (d + 0.25 + this.r * 0.8), nz = z + dz * (d + 0.25 + this.r * 0.8);
      if (!this.s.walkableAt(nx, nz) || !this.inArena(nx, nz)) break;
      d += 0.25;
    }
    return d;
  }

  inArena(x, z) {
    const A = this.s.arena;
    return x > A.x0 && x < A.x1 && z > A.z0 && z < A.z1;
  }

  clampArena() {
    const A = this.s.arena, m = this.r;
    this.x = clamp(this.x, A.x0 + m, A.x1 - m);
    this.z = clamp(this.z, A.z0 + m, A.z1 - m);
  }

  walkToward(tx, tz, speed, dt) {
    const dx = tx - this.x, dz = tz - this.z, d = Math.hypot(dx, dz);
    if (d > 0.1) {
      this.x += dx / d * Math.min(d, speed * dt);
      this.z += dz / d * Math.min(d, speed * dt);
      this.yaw = Math.atan2(dx, dz);
    }
    this.clampArena();
    return d;
  }

  /** Bumping into the boss body is a little sleepy too. */
  touch(amount) {
    for (const e of this.s.ents) {
      if (e.state !== 'walk') continue;
      const dx = e.x - this.x, dz = e.z - this.z, d = Math.hypot(dx, dz);
      if (d < this.r + PR) {
        const nx = dx / (d || 1), nz = dz / (d || 1);
        e.x = this.x + nx * (this.r + PR); e.z = this.z + nz * (this.r + PR);
        this.s.pushOut(e, PR);
        if (this.s.addYawn(e, amount)) { e.vx += nx * 8; e.vz += nz * 8; }
      }
    }
  }

  update(dt, active) {
    this.flash = Math.max(0, this.flash - dt);
    this.drowsy = Math.max(0, this.drowsy - dt);
    if (this.state === 'idle') {
      if (active && this.s.ents.some((e) => e.state === 'walk' && this.inArena(e.x, e.z) && Math.hypot(e.x - this.x, e.z - this.z) < 16)) this.wake();
    } else if (this.state === 'phase') {
      this.phaseT += dt;
      if (this.phaseT > 1.6) { this.state = 'fight'; this.next = 0.6; }
    } else if (this.state === 'fight' && active) {
      // A lullaby makes the boss slow and drowsy for a moment.
      const k = this.drowsy > 0 ? 0.55 : 1;
      if (this.act) this.runAct(dt * k);
      else {
        this.next -= dt * k;
        this.idleMove(dt * k);
        if (this.next <= 0) this.startAct();
      }
      this.touch(0.2);
    } else if (this.state === 'asleep') {
      this.sleepT += dt;
      if (this.sleepT > 2.4 && !this.gone) this.poof();
    }
    this.pose(dt);
  }

  poof() {
    this.gone = true;
    this.s.level.remove(this.g);
    const at = new THREE.Vector3(this.x, 1.4, this.z);
    this.s.confetti.burst(at, 0, { count: 120, speed: 10, up: 6, colors: PLAYER_COLORS.map((c) => c.hex).concat(COLORS.gold), life: 1.8, gravity: -8, size: 0.2 });
    this.s.puffs.burst(at, 0xffffff, { count: 20, size: 0.9, life: 1.2, speed: 4 });
    for (let i = 0; i < 6; i++) this.s.spawnStarFx(this.x, 1.5, this.z);
    this.s.game.audio.play('star');
    this.s.game.audio.playMusic('bubble');
    this.s.onBossDefeated(this);
  }

  /** Little sleepy "Zz" and dizzy stars use one shared helper. */
  stars(on, y) {
    if (!this.starRing) {
      this.starRing = new THREE.Group();
      for (let i = 0; i < 4; i++) {
        const st = makeStar(COLORS.gold);
        st.scale.setScalar(0.35);
        const a = (i / 4) * Math.PI * 2;
        st.position.set(Math.cos(a) * 0.9, 0, Math.sin(a) * 0.9);
        this.starRing.add(st);
      }
      this.s.level.add(this.starRing);
    }
    this.starRing.visible = on;
    if (on) {
      this.starRing.position.set(this.x, y, this.z);
      this.starRing.rotation.y += 0.08;
    }
  }
}

// ---------------------------------------------------------------- Big Teddy

export class TeddyBoss extends Boss {
  constructor(s, x, z) {
    super(s, x, z, { hp: 230, r: 1.45, phases: [0.5] });
    this.nameKey = 'keep.teddy';
    this.subKey = 'keep.teddy.sub';
    this.yaw = 0;
    this.dizzy = 0;
    this.build();
  }

  build() {
    const fur = toon(0xc98b5a), light = toon(0xf1d3a8), dark = toon(0x6b3f22);
    const body = new THREE.Group();
    this.body = body;
    this.g.add(body);
    const belly = mesh(sph(1.05, 20, 14), fur, 0, 1.05, 0);
    belly.scale.set(1.05, 1, 0.95);
    const patch = mesh(sph(0.62, 16, 12), light, 0, 0.95, 0.55, false);
    patch.scale.set(1, 1.1, 0.5);
    body.add(belly, patch);
    const head = new THREE.Group();
    head.position.set(0, 2.25, 0.1);
    head.add(mesh(sph(0.72, 18, 14), fur, 0, 0, 0));
    for (const sx of [-1, 1]) {
      head.add(mesh(sph(0.27), fur, sx * 0.58, 0.5, -0.05));
      head.add(mesh(sph(0.15), light, sx * 0.58, 0.5, 0.08, false));
      head.add(mesh(sph(0.11), dark, sx * 0.26, 0.12, 0.62, false)); // button eyes
      head.add(mesh(sph(0.04, 8, 6), toon(COLORS.white), sx * 0.26 + 0.04, 0.16, 0.71, false));
    }
    const snout = mesh(sph(0.3), light, 0, -0.15, 0.6, false);
    snout.scale.set(1.2, 0.85, 0.8);
    head.add(snout, mesh(sph(0.1), dark, 0, -0.05, 0.85, false));
    // Brows that tilt angry during wind-ups.
    this.brows = [-1, 1].map((sx) => {
      const b = mesh(bx('tedBrow', 0.26, 0.06, 0.06), dark, sx * 0.26, 0.32, 0.64, false);
      head.add(b);
      return b;
    });
    // A red bow tie, like a proper teddy.
    for (const sx of [-1, 1]) {
      const bow = mesh(cone('tedBow', 0.22, 0.4, 4), toon(0xe0566f), sx * 0.2, 1.72, 0.62, false);
      bow.rotation.z = sx * Math.PI / 2;
      body.add(bow);
    }
    body.add(mesh(sph(0.1), toon(0xe0566f), 0, 1.72, 0.66, false));
    this.head = head;
    body.add(head);
    this.arms = [-1, 1].map((sx) => {
      const a = mesh(sph(0.36), fur, sx * 1.05, 1.25, 0.15);
      a.scale.set(0.8, 1.3, 0.8);
      body.add(a);
      return a;
    });
    for (const sx of [-1, 1]) {
      const leg = mesh(sph(0.42), fur, sx * 0.55, 0.3, 0.3);
      leg.add(mesh(sph(0.26), light, 0, 0, 0.3, false));
      body.add(leg);
    }
    // Ground shadow that stays on the floor while he jumps.
    this.shadow = mesh(sph(1, 16, 8), toon(0x000000, { transparent: true, opacity: 0.2 }), 0, 0.03, 0, false);
    this.shadow.scale.set(1.5, 0.02, 1.5);
    this.s.level.add(this.shadow);
    this.g.position.set(this.x, 0, this.z);
  }

  idleMove(dt) {
    let best = null, bd = Infinity;
    for (const e of this.targets()) { const d = Math.hypot(e.x - this.x, e.z - this.z); if (d < bd) { bd = d; best = e; } }
    if (best && bd > this.r + 1.5) this.walkToward(best.x, best.z, 2.0 + this.phase * 0.6, dt);
  }

  startAct() {
    const opts = ['charge', 'flop', 'toss'];
    if (this.phase >= 1) opts.push('charge', 'summon');
    const name = this.choose(opts);
    const tg = this.pickTarget();
    this.act = { name, t: 0, n: 0, tg };
    const s = this.s, H = s.hazards, fast = this.phase >= 1;
    if (name === 'charge') this.aimCharge(tg);
    else if (name === 'flop') {
      // Jump onto a player: the landing circle grows while he is in the air.
      const r = 2.6 + this.phase * 0.4;
      this.act.from = { x: this.x, z: this.z };
      this.act.to = { x: tg.x, z: tg.z };
      this.act.hz = H.add({ shape: 'circle', x: tg.x, z: tg.z, r, warn: fast ? 1.05 : 1.3, yawn: 0.34 });
      s.game.audio.play('jump');
    } else if (name === 'toss') {
      const n = 3 + this.phase * 2 + Math.floor(s.ents.length / 2);
      const L = this.targets();
      for (let i = 0; i < n; i++) {
        const e = L[i % L.length];
        const off = i < L.length ? 0 : 2.5;
        const a = Math.random() * Math.PI * 2;
        const x = clamp(e.x + Math.cos(a) * off * Math.random(), s.arena.x0 + 1, s.arena.x1 - 1);
        const z = clamp(e.z + Math.sin(a) * off * Math.random(), s.arena.z0 + 1, s.arena.z1 - 1);
        s.later(i * 0.18, () => { if (this.state === 'fight') H.add({ shape: 'circle', x, z, r: 1.35, warn: 1.3, drop: true, dropColor: [COLORS.candyPink, COLORS.candyBlue, COLORS.candyYellow][i % 3], yawn: 0.26 }); });
      }
      s.game.audio.play('whoosh');
    } else if (name === 'summon') {
      for (let i = 0; i < 2; i++) s.spawnGrumble(this.x + (i ? 2 : -2), this.z + 1.5, null, i ? 'charger' : 'basic');
      s.game.audio.play('boing');
    }
  }

  aimCharge(tg) {
    const yaw = Math.atan2(tg.x - this.x, tg.z - this.z);
    const len = this.reach(this.x, this.z, yaw, 22);
    this.yaw = yaw;
    this.act.yaw = yaw;
    this.act.len = len;
    this.act.t = 0;
    this.act.phase = 'aim';
    this.act.hz = this.s.hazards.add({ shape: 'rect', x: this.x, z: this.z, yaw, len: len + this.r, width: this.r * 2 + 0.3, warn: this.phase >= 1 ? 0.8 : 1.05, noHit: true });
  }

  runAct(dt) {
    const a = this.act;
    a.t += dt;
    if (a.name === 'charge') {
      if (a.phase === 'aim') {
        if (a.hz.fired) { a.phase = 'run'; a.ran = 0; this.s.game.audio.play('dash'); }
      } else if (a.phase === 'run') {
        const sp = 17 * dt;
        const step = Math.min(sp, a.len - a.ran);
        this.x += Math.sin(a.yaw) * step; this.z += Math.cos(a.yaw) * step;
        a.ran += step;
        // Players in the way get bowled over (a sleepy bump, not a hurt).
        for (const e of this.s.ents) {
          if (e.state !== 'walk') continue;
          if (Math.hypot(e.x - this.x, e.z - this.z) < this.r + PR + 0.2 && this.s.addYawn(e, 0.32)) {
            const side = Math.sign((e.x - this.x) * Math.cos(a.yaw) - (e.z - this.z) * Math.sin(a.yaw)) || 1;
            e.vx += Math.cos(a.yaw) * side * 12; e.vz += -Math.sin(a.yaw) * side * 12;
          }
        }
        if (a.ran >= a.len - 0.01) {
          // Bonk into the wall: dizzy and open for extra bonks.
          this.dizzy = 1.7;
          a.phase = 'dizzy';
          this.s.game.audio.play('bump');
          this.s.puffs.burst(new THREE.Vector3(this.x + Math.sin(a.yaw) * this.r, 1, this.z + Math.cos(a.yaw) * this.r), 0xffffff, { count: 10, size: 0.5, life: 0.6, speed: 3 });
        }
      } else {
        this.dizzy -= dt;
        if (this.dizzy <= 0) {
          // Phase 2 charges twice in a row.
          if (this.phase >= 1 && a.n === 0) { a.n = 1; this.aimCharge(this.pickTarget()); return; }
          this.endAct(1.4);
        }
      }
    } else if (a.name === 'flop') {
      const k = clamp(a.t / a.hz.warn, 0, 1);
      this.x = a.from.x + (a.to.x - a.from.x) * k;
      this.z = a.from.z + (a.to.z - a.from.z) * k;
      this.y = Math.sin(k * Math.PI) * 5;
      if (a.hz.fired) {
        this.y = 0;
        this.clampArena();
        this.s.puffs.burst(new THREE.Vector3(this.x, 0.3, this.z), 0xffffff, { count: 14, size: 0.6, life: 0.7, speed: 5 });
        this.endAct(1.3);
      }
    } else if (a.name === 'toss') {
      if (a.t > 1.9) this.endAct(1.0);
    } else if (a.name === 'summon') {
      if (a.t > 0.8) this.endAct(0.8);
    }
  }

  endAct(pause) {
    this.act = null;
    this.next = pause * (this.phase >= 1 ? 0.7 : 1);
    this.dizzy = 0;
  }

  pose(dt) {
    if (this.gone) return;
    const a = this.act;
    const wind = a && ((a.name === 'charge' && a.phase === 'aim') || (a.name === 'toss' && a.t < 0.5));
    const shake = wind ? Math.sin(this.s.time * 40) * 0.08 : 0;
    this.g.position.set(this.x + shake, this.y, this.z);
    this.g.rotation.y = this.yaw;
    const asleep = this.state === 'asleep';
    this.g.rotation.z = asleep ? Math.min(1, this.sleepT) * -0.5 : 0;
    const sq = 1 + this.flash * 1.2;
    this.body.scale.set(1.35 * sq, 1.35 / sq * (wind ? 0.92 : 1), 1.35 * sq);
    for (const [i, b] of this.brows.entries()) b.rotation.z = (i ? -1 : 1) * (wind || this.phase ? 0.45 : 0.1);
    const walk = this.state === 'fight' && !a ? Math.sin(this.s.time * 8) : 0;
    this.arms[0].rotation.x = walk * 0.4 + (a?.name === 'toss' ? -2.2 : 0);
    this.arms[1].rotation.x = -walk * 0.4 + (a?.name === 'toss' ? -2.2 : 0);
    this.head.rotation.x = asleep ? 0.4 : 0;
    this.shadow.position.set(this.x, 0.03, this.z);
    this.shadow.scale.set(1.5 * (1 - this.y / 8), 0.02, 1.5 * (1 - this.y / 8));
    this.stars(this.dizzy > 0 || asleep, this.y + 3.4);
  }

  poof() {
    this.s.level.remove(this.shadow);
    if (this.starRing) this.s.level.remove(this.starRing);
    super.poof();
  }
}

// ---------------------------------------------------------------- Sleepy Sheep

export class SheepBoss extends Boss {
  constructor(s, x, z) {
    super(s, x, z, { hp: 420, r: 1.6, phases: [0.66, 0.33] });
    this.nameKey = 'keep.sheep';
    this.subKey = 'keep.sheep.sub';
    this.yaw = 0;
    this.home = { x, z };
    this.build();
  }

  build() {
    const g = new THREE.Group();
    this.body = g;
    this.g.add(g);
    const wool = toon(0xffffff, { transparent: true, opacity: 0.94 });
    const puffs = [[0, 0, 0, 0.75], [0.55, 0.1, 0.1, 0.55], [-0.55, 0.1, 0.1, 0.55], [0.3, 0.4, -0.3, 0.55], [-0.3, 0.4, -0.3, 0.55],
      [0, 0.5, 0.2, 0.55], [0.4, -0.2, -0.4, 0.5], [-0.4, -0.2, -0.4, 0.5], [0, 0.1, -0.6, 0.55]];
    for (const [px, py, pz, r] of puffs) g.add(mesh(sph(r, 14, 10), wool, px, py, pz));
    for (const [px, pz] of [[-0.35, -0.2], [0.35, -0.2], [0, -0.5]]) {
      const w = mesh(cone('wisp', 0.22, 0.7, 10), wool, px, -0.75, pz, false);
      w.rotation.x = Math.PI;
      g.add(w);
    }
    const head = new THREE.Group();
    head.position.set(0, 0.25, 0.85);
    const face = mesh(sph(0.42), toon(0x8c79b8), 0, 0, 0);
    face.scale.set(0.95, 0.9, 0.9);
    head.add(face);
    this.lids = [];
    this.eyes = [];
    for (const sx of [-1, 1]) {
      const ear = mesh(sph(0.16), toon(0x8c79b8), sx * 0.45, 0.1, -0.05);
      ear.scale.set(1.6, 0.5, 0.8);
      ear.rotation.z = sx * -0.4;
      const lid = mesh(new THREE.TorusGeometry(0.09, 0.025, 6, 12, Math.PI), toon(0x2b2340), sx * 0.16, 0.05, 0.36, false);
      lid.rotation.z = Math.PI;
      // Open eyes for wind-ups, so you can see it "look" at you before an attack.
      const eye = mesh(sph(0.09), toon(COLORS.white), sx * 0.16, 0.05, 0.34, false);
      eye.add(mesh(sph(0.05), toon(0x2b2340), 0, 0, 0.06, false));
      eye.visible = false;
      const blush = mesh(sph(0.07), toon(COLORS.blush), sx * 0.26, -0.08, 0.32, false);
      blush.scale.set(1, 0.6, 0.4);
      head.add(ear, lid, eye, blush);
      this.lids.push(lid);
      this.eyes.push(eye);
    }
    head.add(mesh(sph(0.05), toon(0x2b2340), 0, -0.14, 0.38, false));
    const cap = mesh(cone('nightcap', 0.34, 0.9, 14), toon(0x4cc9f0), 0.1, 0.55, -0.05);
    cap.rotation.z = -0.5;
    const capBand = mesh(cyl('capBand', 0.36, 0.36, 0.1, 14), toon(COLORS.white), 0.0, 0.32, -0.05, false);
    capBand.rotation.z = -0.5;
    const pom = mesh(sph(0.12), toon(COLORS.white), 0.48, 0.85, -0.05, false);
    head.add(cap, capBand, pom);
    g.add(head);
    this.head = head;
    this.shadow = mesh(sph(1, 16, 8), toon(0x000000, { transparent: true, opacity: 0.18 }), 0, 0.03, 0, false);
    this.shadow.scale.set(1.6, 0.02, 1.6);
    this.s.level.add(this.shadow);
  }

  idleMove(dt) {
    // Drift between the middle of the bedroom and the nearest player.
    let best = null, bd = Infinity;
    for (const e of this.targets()) { const d = Math.hypot(e.x - this.x, e.z - this.z); if (d < bd) { bd = d; best = e; } }
    const tx = best ? (best.x + this.home.x) / 2 : this.home.x, tz = best ? (best.z + this.home.z) / 2 : this.home.z;
    this.walkToward(tx, tz, 1.8 + this.phase * 0.4, dt);
  }

  startAct() {
    const s = this.s, H = s.hazards, P = this.phase;
    const opts = ['rain', 'cone', 'wave'];
    if (P >= 1) opts.push('beam', 'beam');
    if (P >= 1 && s.grumbles.length < 2 + s.ents.length) opts.push('summon');
    const name = this.choose(opts);
    this.act = { name, t: 0 };
    let dur = 2;
    if (name === 'rain') {
      // Pillows fall on and around everyone (more in later phases).
      const L = this.targets();
      const n = 4 + P * 2 + L.length + (P >= 2 ? 3 : 0);
      for (let i = 0; i < n; i++) {
        const e = L[i % L.length];
        const near = i < L.length;
        const a = Math.random() * Math.PI * 2, d = near ? 0 : 1.5 + Math.random() * 5;
        const x = clamp(e.x + Math.cos(a) * d, s.arena.x0 + 1, s.arena.x1 - 1), z = clamp(e.z + Math.sin(a) * d, s.arena.z0 + 1, s.arena.z1 - 1);
        s.later(i * 0.14, () => { if (this.state === 'fight') H.add({ shape: 'circle', x, z, r: 1.4, warn: 1.35, drop: true, dropColor: [COLORS.candyLilac, COLORS.candyBlue, COLORS.candyPink][i % 3], yawn: 0.26 }); });
      }
      dur = 1.2 + n * 0.14 + 0.8;
      s.game.audio.play('whoosh');
    } else if (name === 'cone') {
      // A big yawn toward one player (two players in the last phase).
      const L = this.targets();
      const count = P >= 2 && L.length > 1 ? 2 : 1;
      for (let i = 0; i < count; i++) {
        const e = L[Math.floor(Math.random() * L.length)];
        const yaw = Math.atan2(e.x - this.x, e.z - this.z) + (i ? 0.9 : 0);
        H.add({ shape: 'cone', x: this.x, z: this.z, yaw, r: 9, half: 0.42, warn: P >= 2 ? 0.95 : 1.2, yawn: 0.32, onFire: (h) => this.yawnFx(h) });
        if (i === 0) this.yaw = yaw;
      }
      dur = 1.8;
      s.floater(t('keep.yawn'), new THREE.Vector3(this.x, 3.6, this.z), '#8a45e0', 1.2);
    } else if (name === 'wave') {
      // An expanding dream wave: stand in a green gap (fewer and narrower gaps later).
      const gapsN = P === 0 ? 3 : 2;
      const base = Math.random() * Math.PI * 2;
      const gaps = Array.from({ length: gapsN }, (_, i) => base + (i / gapsN) * Math.PI * 2 + (Math.random() - 0.5) * 0.5);
      H.add({ shape: 'wave', x: this.x, z: this.z, gaps, gapHalf: P >= 2 ? 0.36 : 0.44, speed: 6 + P, rMax: 20, warn: 1.5, yawn: 0.3 });
      dur = 4.2;
      if (P >= 2) {
        const gaps2 = gaps.map((g) => g + Math.PI / gapsN);
        s.later(1.6, () => { if (this.state === 'fight') H.add({ shape: 'wave', x: this.x, z: this.z, gaps: gaps2, gapHalf: 0.4, speed: 6.5, rMax: 20, warn: 1.4, yawn: 0.3 }); });
        dur = 5.6;
      }
    } else if (name === 'beam') {
      // Moonbeams sweep around the sheep; walk with them, not into them.
      const count = P >= 2 ? 2 : 1;
      const e = this.pickTarget();
      const yaw = Math.atan2(e.x - this.x, e.z - this.z) + Math.PI * 0.6;
      const spin = (Math.random() < 0.5 ? -1 : 1) * (0.75 + 0.15 * P);
      H.add({ shape: 'beam', follow: () => ({ x: this.x, z: this.z }), yaw, spin, len: 15, width: 1.3, count, warn: 1.5, life: 4.2, yawn: 0.28 });
      if (P >= 2) this.s.later(1.2, () => { if (this.state === 'fight') this.rainLight(); });
      dur = 6;
      this.act.still = true;
    } else if (name === 'summon') {
      for (let i = 0; i < 3; i++) s.spawnGrumble(this.x + Math.cos(i * 2.1) * 2.2, this.z + Math.sin(i * 2.1) * 2.2, null, i === 2 ? 'thrower' : 'basic', 0xf4eaff);
      s.game.audio.play('boing');
      dur = 1;
    }
    this.act.dur = dur;
  }

  /** A few extra pillows during the double moonbeam (last phase). */
  rainLight() {
    const s = this.s;
    for (const [i, e] of this.targets().entries()) s.hazards.add({ shape: 'circle', x: e.x, z: e.z, r: 1.3, warn: 1.4 + i * 0.2, drop: true, yawn: 0.24 });
  }

  yawnFx(h) {
    const s = this.s;
    for (let i = 0; i < 10; i++) {
      const a = h.yaw + (Math.random() - 0.5) * h.half * 2, d = 1.5 + Math.random() * (h.r - 1.5);
      s.puffs.burst(new THREE.Vector3(h.x + Math.sin(a) * d, 0.8, h.z + Math.cos(a) * d), 0xd9c8ff, { count: 1, size: 0.6, life: 0.7, speed: 1 });
    }
  }

  runAct(dt) {
    const a = this.act;
    a.t += dt;
    if (a.t > a.dur) { this.act = null; this.next = [1.3, 1.0, 0.75][this.phase]; }
  }

  pose(dt) {
    if (this.gone) return;
    const t = this.s.time;
    const asleep = this.state === 'asleep';
    let y = asleep ? 1.2 - Math.min(1, this.sleepT / 1.5) * 0.6 : 1.2 + Math.sin(t * 1.6) * 0.22;
    const busy = !!this.act || this.s.hazards.list.some((h) => !h.fired);
    let sc = 1.5 * (1 + this.flash * 1.4);
    if (this.state === 'phase') sc *= 1 + Math.sin(this.phaseT * 12) * 0.06;
    this.g.position.set(this.x, y, this.z);
    this.y = y;
    this.body.scale.setScalar(sc);
    this.body.rotation.z = asleep ? Math.min(1, this.sleepT) * 0.35 : 0;
    this.g.rotation.y += (this.yaw - this.g.rotation.y) * Math.min(1, dt * 4);
    for (const l of this.lids) l.visible = !busy || asleep;
    for (const e of this.eyes) e.visible = busy && !asleep;
    this.shadow.position.set(this.x, 0.03, this.z);
    if (asleep && Math.random() < dt * 4) this.s.puffs.burst(new THREE.Vector3(this.x + 0.6, y + 1.6, this.z), 0xc9a8ff, { count: 1, size: 0.3, life: 1.2, speed: 0.5 });
    if (this.drowsy > 0 && Math.random() < dt * 3) this.s.floater('z', new THREE.Vector3(this.x + 0.8, y + 2.2, this.z), '#9b5de5', 0.8);
  }

  poof() {
    this.s.level.remove(this.shadow);
    super.poof();
  }
}
