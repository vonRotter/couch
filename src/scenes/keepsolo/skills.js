import * as THREE from 'three';
import { COLORS, toon, basic, sharedGeo } from '../../core/palette.js';
import { t } from '../../core/i18n.js';
import { GR, mesh, sph, cyl, cone, fadeMat } from '../keep/common.js';
import { CLASSES, SKILLS } from './classes.js';

// What the hero does (mixed into the scene): the [A] attack, the [B] move and the four [C] skills
// of each class, plus the skill effects that last a while (feather rain, owl friend, bubble bomb,
// snooze cloud, bubble storm). Shots use the co-op Pillow Keep's shot logic (keep.js updateShots).

const SHOT = { arrow: 19, big: 22, bubble: 11, storm: 9, feather: 13 };

export const SkillMixin = {
  /** keep/foes.js asks about co-op skills (Pop Splash); the solo heroes have their own skills. */
  hasSkill() {
    return false;
  },

  /** Damage of one hit (lucky hits count double). */
  rollDmg(e, k = 1) {
    let d = e.st.dmg * k * (e.cheerT > 0 ? 1.5 : 1);
    if (Math.random() < e.st.luck) { d *= 2; e.luckyT = 0.5; }
    return d;
  },

  /** Nearest grumble (or awake boss) roughly in front of the hero, for gentle aim help. */
  aimTarget(e, range = 11, half = 0.65) {
    const fy = Math.atan2(e.fx, e.fz);
    let best = null, bs = Infinity;
    const consider = (x, z, extra = 0) => {
      const dx = x - e.x, dz = z - e.z, d = Math.hypot(dx, dz);
      if (d > range + extra || d < 0.01) return;
      const da = Math.abs(Math.atan2(Math.sin(Math.atan2(dx, dz) - fy), Math.cos(Math.atan2(dx, dz) - fy)));
      if (da > half && d > 1.6) return;
      if (!this.clearLine(e.x, e.z, x, z)) return;
      const score = d + da * 4;
      if (score < bs) { bs = score; best = { x, z, d }; }
    };
    for (const g of this.grumbles) if (!g.dead && g.state !== 'idle') consider(g.x, g.z);
    for (const n of this.nests) if (!n.done) consider(n.x, n.z, n.r);
    const b = this.boss;
    if (b?.awake && b.y < 2.5) consider(b.x, b.z, b.r);
    return best;
  },

  faceTarget(e, range, half) {
    if (this.aimAt) {
      // mouse: aim exactly where the player points
      const a = this.aimAt, dx = a.x - e.x, dz = a.z - e.z, d = Math.hypot(dx, dz) || 1;
      e.fx = dx / d; e.fz = dz / d;
      return { x: a.x, z: a.z, d };
    }
    const tg = this.aimTarget(e, range, half);
    if (!tg) return null;
    const d = Math.hypot(tg.x - e.x, tg.z - e.z) || 1;
    e.fx = (tg.x - e.x) / d; e.fz = (tg.z - e.z) / d;
    return tg;
  },

  /** A spot ahead for area skills: the aimed grumble, or a few steps forward (not through walls). */
  aimSpot(e, dist = 5.5) {
    const tg = this.faceTarget(e, 9, 0.7);
    if (tg && tg.d < dist + 3) return { x: tg.x, z: tg.z };
    let d = 0;
    while (d < dist && this.walkableAt(e.x + e.fx * (d + 0.5), e.z + e.fz * (d + 0.5))) d += 0.5;
    return { x: e.x + e.fx * d, z: e.z + e.fz * d };
  },

  // ---------------------------------------------------------------- [A]

  attack(e) {
    const C = CLASSES[this.cls];
    e.cdA = C.cdA / e.st.rate;
    e.swingT = 0.22;
    e.swingDir = -e.swingDir;
    e.attackN++;
    if (this.cls === 'knight') {
      this.faceTarget(e, 3.2, 1.2);
      this.swing(e, 2.5, 1.25, this.rollDmg(e));
      this.game.audio.play('whoosh');
    } else if (this.cls === 'archer') {
      this.faceTarget(e, 12, 0.6);
      this.shoot(e, 'arrow', 0, this.rollDmg(e));
      this.game.audio.play('dash');
    } else {
      this.faceTarget(e, 10, 0.6);
      this.shoot(e, 'bubble', 0, this.rollDmg(e));
      this.game.audio.play('bubble');
    }
    // Legendary powers that ride on attacks.
    if (e.st.powers.has('wave') && e.attackN % 4 === 0) this.shoot(e, 'feather', 0, this.rollDmg(e, 0.8), { pierce: 4 });
    if (e.st.powers.has('bubble') && this.cls !== 'wizard' && Math.random() < 0.15) this.shoot(e, 'bubble', 0, 0);
  },

  /** Make a shot (keep.js updateShots moves it and hits things). */
  shoot(e, kind, angOff, dmg, { pierce = 0, life = 1, homing = false } = {}) {
    const a = Math.atan2(e.fx, e.fz) + angOff;
    const dx = Math.sin(a), dz = Math.cos(a);
    let m, shotKind = kind, speed = SHOT[kind], range = 13;
    if (kind === 'arrow' || kind === 'big') {
      m = new THREE.Group();
      const big = kind === 'big';
      const shaft = mesh(cyl(big ? 'ksArrowBig' : 'ksArrow', big ? 0.07 : 0.035, big ? 0.07 : 0.035, big ? 1.1 : 0.7, 6), toon(0xc98b5a), 0, 0, 0, false);
      shaft.rotation.x = Math.PI / 2;
      const tip = mesh(cone(big ? 'ksTipBig' : 'ksTip', big ? 0.14 : 0.08, big ? 0.3 : 0.18, 6), toon(big ? COLORS.gold : 0xbdb8cf), 0, 0, big ? 0.65 : 0.42, false);
      tip.rotation.x = Math.PI / 2;
      const fl = mesh(cone('ksFletch', big ? 0.18 : 0.11, big ? 0.36 : 0.24, 4), toon(big ? 0xff5d73 : 0x3ddc97), 0, 0, big ? -0.55 : -0.36, false);
      fl.rotation.x = -Math.PI / 2;
      m.add(shaft, tip, fl);
      m.rotation.y = a;
      shotKind = 'dart';
      range = big ? 18 : 13;
    } else if (kind === 'bubble') {
      m = mesh(sph(0.36, 16, 12), toon(0xbfe9ff, { transparent: true, opacity: 0.55 }), 0, 0, 0, false);
      m.add(mesh(sph(0.08), toon(COLORS.white), -0.14, 0.14, 0.24, false));
      range = 11;
    } else if (kind === 'storm') {
      // Storm bubbles bonk instead of trapping ("note" shots in keep.js deal damage).
      m = mesh(sph(0.26, 14, 10), toon(0x9ff0ff, { transparent: true, opacity: 0.6 }), 0, 0, 0, false);
      shotKind = 'note';
      range = 9;
    } else {
      m = new THREE.Mesh(sharedGeo('kFeatherArc', () => new THREE.RingGeometry(0.6, 1.0, 16, 1, -Math.PI / 2 - 0.8, 1.6)), basic(0xffffff, { transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide }));
      m.rotation.order = 'YXZ';
      m.rotation.set(-Math.PI / 2, a, 0);
      shotKind = 'feather';
      range = 6;
    }
    this.level.add(m);
    this.shots.push({ kind: shotKind, x: e.x + dx * 0.5, z: e.z + dz * 0.5, vx: dx * speed, vz: dz * speed, life: (range / speed) * life, owner: e, mesh: m, t: 0, dmg, pierce, hits: new Set(), homing });
  },

  // ---------------------------------------------------------------- [B]

  /** Archer roll / wizard hop on [B] press (the knight's block is held, see the hero update). */
  bMove(e, inp) {
    if (e.cdB > 0) return;
    const C = CLASSES[this.cls];
    let dx = inp.x, dz = -inp.y;
    const len = Math.hypot(dx, dz);
    if (len > 0.3) { dx /= len; dz /= len; e.fx = dx; e.fz = dz; } else { dx = e.fx; dz = e.fz; }
    e.cdB = C.cdB;
    if (this.cls === 'archer') {
      e.rollT = 0.3;
      e.rollX = dx; e.rollZ = dz;
      e.inv = Math.max(e.inv, 0.36);
      this.game.audio.play('dash');
      this.puffs.burst(new THREE.Vector3(e.x, 0.3, e.z), 0xffffff, { count: 5, size: 0.35, life: 0.4, speed: 2 });
    } else {
      // Bubble hop: blink a few steps (stops at walls).
      let d = 0;
      while (d < 4.5 && this.walkableAt(e.x + dx * (d + 0.5), e.z + dz * (d + 0.5))) d += 0.25;
      this.puffs.burst(new THREE.Vector3(e.x, 0.8, e.z), 0xbfe9ff, { count: 8, size: 0.4, life: 0.5, speed: 2 });
      e.x += dx * d; e.z += dz * d;
      this.pushOut(e, 0.42);
      e.inv = Math.max(e.inv, 0.3);
      e.ch.squash(1.4);
      this.puffs.burst(new THREE.Vector3(e.x, 0.8, e.z), 0xbfe9ff, { count: 8, size: 0.4, life: 0.5, speed: 2 });
      this.game.audio.play('pop');
    }
  },

  // ---------------------------------------------------------------- [C]

  skillCd(e, id) {
    return e.cd[id] || 0;
  },

  /** Use a [C] skill; returns false if it is still recharging. */
  useSkill(e, id) {
    if (this.skillCd(e, id) > 0) { this.game.audio.play('bump'); return false; }
    const def = SKILLS[this.cls].find((s) => s.id === id);
    e.cd[id] = def.cd * (1 - e.st.cdr);
    switch (id) {
      case 'spin':
        e.spinT = 0.4;
        this.swing(e, 3.4, Math.PI, this.rollDmg(e, 1.6), 9);
        this.game.audio.play('whoosh');
        break;
      case 'rush': {
        const tg = this.faceTarget(e, 8, 0.6);
        e.rushT = 0.36;
        e.rushHits = new Set();
        e.rushDmg = this.rollDmg(e, 1.5);
        e.inv = Math.max(e.inv, 0.45);
        if (tg) e.rushT = Math.min(0.36, (tg.d + 1) / 18);
        this.game.audio.play('dash');
        break;
      }
      case 'quake': {
        const R = 5, dmg = this.rollDmg(e, 2);
        for (const g of [...this.grumbles]) {
          if (g.dead || Math.hypot(g.x - e.x, g.z - e.z) > R + GR * g.size) continue;
          const dx = g.x - e.x, dz = g.z - e.z, d = Math.hypot(dx, dz) || 1;
          if (this.hitGrumble(g, dmg, e, dx / d * 6, dz / d * 6, null) && !g.dead && g.state !== 'bubble') { g.state = 'dizzy'; g.t = 2; }
        }
        for (const n of this.nests) if (!n.done && Math.hypot(n.x - e.x, n.z - e.z) < R + n.r) this.damageNest(n, dmg, e);
        const b = this.boss;
        if (b?.awake && b.y < 2.5 && Math.hypot(b.x - e.x, b.z - e.z) < R + b.r) b.damage(dmg, e);
        this.addFx('ring', e.x, e.z, { color: 0xffe9a8, from: 0.5, to: R, life: 0.5 });
        this.puffs.burst(new THREE.Vector3(e.x, 0.3, e.z), 0xffffff, { count: 16, size: 0.6, life: 0.7, speed: 6 });
        e.ch.squash(0.6);
        this.game.audio.play('splat');
        break;
      }
      case 'cheer':
        e.hp = Math.min(e.st.maxHp, e.hp + e.st.maxHp * 0.35);
        e.cheerT = 6;
        this.confetti.burst(new THREE.Vector3(e.x, 1.4, e.z), 0, { count: 40, speed: 6, up: 6, colors: [COLORS.gold, 0xff5d73, 0xffffff], life: 1.1, size: 0.15 });
        this.floater(t('ks.cheer'), new THREE.Vector3(e.x, 2.6, e.z), '#ffd23f', 1.4, true);
        this.game.audio.play('fanfare');
        break;
      case 'fan':
        this.faceTarget(e, 10, 0.8);
        for (let k = -3; k <= 3; k++) this.shoot(e, 'arrow', k * 0.14, this.rollDmg(e, 0.8));
        this.game.audio.play('dash');
        break;
      case 'pierce':
        this.faceTarget(e, 16, 0.5);
        this.shoot(e, 'big', 0, this.rollDmg(e, 3), { pierce: 99 });
        this.game.audio.play('whoosh');
        break;
      case 'rain': {
        const p = this.aimSpot(e, 6);
        this.addZone({ kind: 'rain', x: p.x, z: p.z, r: 3.2, life: 2.1, tick: 0.33, dmg: this.rollDmg(e, 0.8) });
        this.game.audio.play('whoosh');
        break;
      }
      case 'owl':
        this.addZone({ kind: 'owl', x: e.x, z: e.z, life: 8, tick: 0.45, dmg: e.st.dmg * 0.75 });
        this.game.audio.play('star');
        break;
      case 'ring':
        for (let k = 0; k < 10; k++) this.shoot(e, 'bubble', (k / 10) * Math.PI * 2, 0, { life: 0.55 });
        this.game.audio.play('trap');
        break;
      case 'bomb': {
        const p = this.aimSpot(e, 6);
        this.addZone({ kind: 'bomb', x: p.x, z: p.z, r: 3, life: 0.75, dmg: this.rollDmg(e, 2.5) });
        this.game.audio.play('bubble');
        break;
      }
      case 'cloud': {
        const p = this.aimSpot(e, 5);
        this.addZone({ kind: 'cloud', x: p.x, z: p.z, r: 3.5, life: 4, tick: 0.5, dmg: this.rollDmg(e, 0.35) });
        this.game.audio.play('trap');
        break;
      }
      case 'storm':
        this.addZone({ kind: 'storm', x: e.x, z: e.z, life: 4, tick: 0.25, dmg: e.st.dmg });
        this.game.audio.play('trap');
        break;
      default: break;
    }
    return true;
  },

  /** Knight rush: dash forward and bonk everything on the way (once each). */
  updateRush(e, dt) {
    const sp = 18;
    this.moveCircle(e, e.fx * sp * dt, e.fz * sp * dt, 0.42);
    for (const g of [...this.grumbles]) {
      if (g.dead || e.rushHits.has(g) || Math.hypot(g.x - e.x, g.z - e.z) > 1.4 + GR * g.size) continue;
      e.rushHits.add(g);
      const side = Math.sign((g.x - e.x) * e.fz - (g.z - e.z) * e.fx) || 1;
      this.hitGrumble(g, e.rushDmg, e, e.fz * side * 8, -e.fx * side * 8, null);
    }
    const b = this.boss;
    if (b?.awake && !e.rushHits.has(b) && b.y < 2.5 && Math.hypot(b.x - e.x, b.z - e.z) < b.r + 1) { e.rushHits.add(b); b.damage(e.rushDmg, e); }
    if (Math.random() < dt * 30) this.puffs.burst(new THREE.Vector3(e.x, 0.3, e.z), 0xffffff, { count: 1, size: 0.4, life: 0.4, speed: 1 });
  },

  // ---------------------------------------------------------------- lasting skill effects

  addZone(z) {
    z.t = 0;
    z.next = 0;
    const g = new THREE.Group();
    g.position.set(z.x, 0, z.z);
    if (z.kind === 'rain' || z.kind === 'cloud' || z.kind === 'bomb') {
      z.mat = fadeMat(z.kind === 'rain' ? 0xffffff : z.kind === 'cloud' ? 0xc9a8ff : 0x8fd8ff, 0.35);
      const disc = new THREE.Mesh(sharedGeo('ksZoneDisc', () => new THREE.CircleGeometry(1, 32)), z.mat);
      disc.rotation.x = -Math.PI / 2;
      disc.position.y = 0.06;
      disc.scale.setScalar(z.r);
      g.add(disc);
    }
    if (z.kind === 'cloud') {
      const mat = toon(0xe6dcff, { transparent: true, opacity: 0.75 });
      for (let i = 0; i < 7; i++) { const a = i * 0.9; g.add(mesh(sph(0.9 + (i % 3) * 0.2, 12, 8), mat, Math.cos(a) * z.r * 0.55, 1.6 + (i % 2) * 0.3, Math.sin(a) * z.r * 0.55, false)); }
    } else if (z.kind === 'bomb') {
      z.ball = mesh(sph(0.5, 18, 12), toon(0x8fd8ff, { transparent: true, opacity: 0.6 }), 0, 0.6, 0, false);
      g.add(z.ball);
    } else if (z.kind === 'owl') {
      const owl = new THREE.Group();
      owl.add(mesh(sph(0.32, 12, 10), toon(0xb07848), 0, 0, 0));
      owl.add(mesh(sph(0.2, 12, 10), toon(0xf1d3a8), 0, -0.04, 0.17, false));
      for (const s of [-1, 1]) {
        owl.add(mesh(sph(0.1), toon(0xffffff), s * 0.12, 0.12, 0.22, false), mesh(sph(0.05), toon(COLORS.ink), s * 0.12, 0.12, 0.3, false));
        const ear = mesh(cone('ksOwlEar', 0.07, 0.18, 4), toon(0xb07848), s * 0.16, 0.32, 0, false);
        g.userData.wing = g.userData.wing || [];
        const w = mesh(sph(0.2, 10, 8), toon(0x8a5a3a), s * 0.32, 0, 0, false);
        w.scale.set(0.4, 0.8, 1);
        g.userData.wing.push(w);
        owl.add(ear, w);
      }
      owl.add(mesh(cone('ksOwlBeak', 0.05, 0.12, 4), toon(0xffb020), 0, 0.02, 0.33, false).rotateX(Math.PI / 2));
      g.add(owl);
      z.owl = owl;
    }
    this.level.add(g);
    z.g = g;
    this.zones.push(z);
  },

  /** Grumbles (and the boss) inside a circle. */
  hitArea(x, z, r, dmg, by, onHit = null) {
    for (const g of [...this.grumbles]) {
      if (g.dead || Math.hypot(g.x - x, g.z - z) > r + GR * g.size) continue;
      if (this.hitGrumble(g, dmg, by, 0, 0, null) && onHit && !g.dead) onHit(g);
    }
    for (const n of this.nests) if (!n.done && Math.hypot(n.x - x, n.z - z) < r + n.r) this.damageNest(n, dmg, by);
    const b = this.boss;
    if (b?.awake && b.y < 2.5 && Math.hypot(b.x - x, b.z - z) < r + b.r) b.damage(dmg, by);
  },

  updateZones(dt) {
    const e = this.hero;
    for (const z of this.zones) {
      z.t += dt;
      z.next -= dt;
      const k = z.t / z.life;
      if (z.kind === 'rain') {
        if (z.next <= 0) { z.next = z.tick; this.hitArea(z.x, z.z, z.r, z.dmg, e); }
        if (Math.random() < dt * 40) {
          const a = Math.random() * Math.PI * 2, d = Math.random() * z.r;
          this.puffs.burst(new THREE.Vector3(z.x + Math.cos(a) * d, 2 + Math.random() * 2, z.z + Math.sin(a) * d), 0xffffff, { count: 1, size: 0.25, life: 0.5, speed: 6 });
        }
        z.mat.opacity = 0.35 * (1 - k * 0.5);
      } else if (z.kind === 'cloud') {
        if (z.next <= 0) {
          z.next = z.tick;
          this.hitArea(z.x, z.z, z.r, z.dmg, e, (g) => { if (g.state === 'walk' || g.state === 'aim' || g.state === 'dash') { g.state = 'sleep'; g.t = 1.2; g.vx = g.vz = 0; } });
          const b = this.boss;
          if (b?.awake && Math.hypot(b.x - z.x, b.z - z.z) < z.r + b.r) b.drowsy = Math.max(b.drowsy, 0.7);
        }
        z.g.rotation.y += dt * 0.3;
        z.mat.opacity = 0.35 * (1 - Math.max(0, k - 0.8) * 5);
      } else if (z.kind === 'bomb') {
        z.ball.scale.setScalar(1 + k * 2.2);
        z.ball.position.y = 0.6 + Math.sin(k * Math.PI) * 1.5;
        if (z.t >= z.life && !z.boom) {
          z.boom = true;
          this.hitArea(z.x, z.z, z.r, z.dmg, e, (g) => { g.kx += (g.x - z.x) * 3; g.kz += (g.z - z.z) * 3; });
          this.addFx('ring', z.x, z.z, { color: 0x8fd8ff, from: 0.5, to: z.r + 0.5, life: 0.4 });
          this.puffs.burst(new THREE.Vector3(z.x, 0.8, z.z), 0xbfe9ff, { count: 18, size: 0.6, life: 0.6, speed: 6 });
          this.game.audio.play('pop');
        }
      } else if (z.kind === 'owl') {
        // The owl circles the hero and shoots at the nearest grumble.
        const a = z.t * 2.2;
        z.x = e.x + Math.cos(a) * 1.4; z.z = e.z + Math.sin(a) * 1.4;
        z.g.position.set(z.x, 0, z.z);
        z.owl.position.y = 2.1 + Math.sin(z.t * 6) * 0.15;
        z.owl.rotation.y = -a;
        for (const [i, w] of (z.g.userData.wing || []).entries()) w.rotation.z = (i ? -1 : 1) * Math.sin(z.t * 20) * 0.8;
        if (z.next <= 0) {
          z.next = z.tick;
          const tg = this.nearestFoe(z.x, z.z, 10);
          if (tg) {
            const d = Math.hypot(tg.x - z.x, tg.z - z.z) || 1;
            this.shoot({ x: z.x, z: z.z, fx: (tg.x - z.x) / d, fz: (tg.z - z.z) / d, nests: 0, fluffed: 0, st: e.st }, 'arrow', 0, z.dmg);
            this.shots[this.shots.length - 1].owner = e;
          }
        }
      } else if (z.kind === 'storm') {
        z.x = e.x; z.z = e.z;
        if (z.next <= 0) {
          z.next = z.tick;
          for (let i = 0; i < 2; i++) this.shoot(e, 'storm', Math.random() * Math.PI * 2, this.rollDmg(e, 0.9), { homing: true });
        }
      }
      if (z.t >= z.life + (z.kind === 'bomb' ? 0.1 : 0)) z.done = true;
    }
    for (const z of this.zones) if (z.done) { this.level.remove(z.g); z.mat?.dispose(); }
    this.zones = this.zones.filter((z) => !z.done);
  },

  nearestFoe(x, z, max) {
    let best = null, bd = max;
    for (const g of this.grumbles) {
      if (g.dead || g.state === 'idle') continue;
      const d = Math.hypot(g.x - x, g.z - z);
      if (d < bd && this.clearLine(x, z, g.x, g.z)) { bd = d; best = g; }
    }
    const b = this.boss;
    if (b?.awake && Math.hypot(b.x - x, b.z - z) < bd) best = b;
    return best;
  },
};
