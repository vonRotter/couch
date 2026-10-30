import * as THREE from 'three';
import { COLORS, toon, basic, sharedGeo } from '../../core/palette.js';
import { makeStar } from '../../core/world.js';
import { t } from '../../core/i18n.js';
import { GR, mesh, sph, cyl, cone, rbox, fadeMat } from '../keep/common.js';
import { CLASSES, B_MOVE, skillDef, manaCost, rankK } from './classes.js';
import { findPath } from './path.js';

// What the hero does (mixed into the scene): the [A] attack, the [B] move and the four [C] skills
// of each class, plus the skill effects that last a while (feather rain, owl friend, bubble bomb,
// snooze cloud, bubble storm). Shots use the co-op Pillow Keep's shot logic (keep.js updateShots).

const SHOT = { arrow: 19, big: 22, bubble: 11, storm: 9, feather: 13, bolt: 16 };

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
  shoot(e, kind, angOff, dmg, { pierce = 0, life = 1, homing = false, snooze = 0 } = {}) {
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
    } else if (kind === 'storm' || kind === 'bolt') {
      // Storm bubbles and soap bolts bonk instead of trapping ("note" shots in keep.js deal damage).
      const bolt = kind === 'bolt';
      m = mesh(sph(bolt ? 0.32 : 0.26, 14, 10), toon(bolt ? 0x7fd8ff : 0x9ff0ff, { transparent: true, opacity: bolt ? 0.8 : 0.6 }), 0, 0, 0, false);
      if (bolt) m.add(mesh(sph(0.09), toon(COLORS.white), -0.1, 0.12, 0.2, false));
      shotKind = 'note';
      range = bolt ? 12 : 9;
    } else {
      m = new THREE.Mesh(sharedGeo('kFeatherArc', () => new THREE.RingGeometry(0.6, 1.0, 16, 1, -Math.PI / 2 - 0.8, 1.6)), basic(0xffffff, { transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide }));
      m.rotation.order = 'YXZ';
      m.rotation.set(-Math.PI / 2, a, 0);
      shotKind = 'feather';
      range = 6;
    }
    this.level.add(m);
    // a Snooze Arrow's owner carries the snooze time (hitGrumble in world.js reads it)
    const owner = snooze ? Object.assign(Object.create(e), { snooze }) : e;
    this.shots.push({ kind: shotKind, x: e.x + dx * 0.5, z: e.z + dz * 0.5, vx: dx * speed, vz: dz * speed, life: (range / speed) * life, owner, mesh: m, t: 0, dmg, pierce, hits: new Set(), homing });
  },

  // ---------------------------------------------------------------- casting

  /** Rank of a skill (0 = not learned). */
  rank(id) {
    return this.hs.ranks[id] || 0;
  },

  skillCd(e, id) {
    return e.cd[id] || 0;
  },

  /**
   * Cast a skill from the hotbar, the right mouse button, the gamepad or the menu.
   * at: the floor point under the mouse pointer (null = aim like the gamepad does: at the grumble
   * in front, or a few steps ahead). Returns true when it was cast.
   */
  castSkill(id, at = null, quiet = false) {
    const e = this.hero, def = skillDef(this.cls, id);
    if (!def || def.kind === 'passive' || e.state !== 'walk' || this.kind !== 'dungeon') return false;
    const r = this.rank(id);
    if (!r) return false;
    if (def.kind === 'hold') return false; // block is held (see the hero update)
    if (e.gcd > 0) return false;
    if (this.skillCd(e, id) > 0) { if (!quiet) this.game.audio.play('bump'); return false; }
    const cost = manaCost(def, r);
    if (e.mana < cost) {
      if (!quiet && this.toastCd <= 0) { this.toastCd = 1.2; this.floater(t('ks.noMana'), new THREE.Vector3(e.x, 2.4, e.z), '#2f6fe0', 0.8, true); this.game.audio.play('bump'); }
      return false;
    }
    // where it goes
    let p = at;
    if (def.target === 'ground' || def.target === 'blink') {
      p = at ? this.clampTarget(e, at, def.range || 8) : this.aimSpot(e, (def.range || 8) * 0.6);
      if (!p) return false;
    }
    if (p && (def.target === 'dir' || def.target === 'ground' || def.target === 'blink')) {
      const dx = p.x - e.x, dz = p.z - e.z, d = Math.hypot(dx, dz);
      if (d > 0.1) { e.fx = dx / d; e.fz = dz / d; }
    }
    this.aimAt = def.target === 'dir' && at ? { x: at.x, z: at.z } : null;
    const ok = this.useSkill(e, id, p, r);
    this.aimAt = null;
    if (ok === false) return false;
    e.mana -= cost;
    e.cd[id] = def.cd * (1 - e.st.cdr);
    e.gcd = 0.3;
    e.castFx = 0.2;
    return true;
  },

  /** A floor point at most `range` from the hero, pulled back out of walls. */
  clampTarget(e, at, range) {
    let dx = at.x - e.x, dz = at.z - e.z;
    const d = Math.hypot(dx, dz);
    if (d > range) { dx *= range / d; dz *= range / d; }
    for (let k = 1; k >= 0; k -= 0.05) {
      const x = e.x + dx * k, z = e.z + dz * k;
      if (this.walkableAt(x, z)) return { x, z };
    }
    return { x: e.x, z: e.z };
  },

  /** The knight's block (held) or a jump / roll toward a direction. */
  bMove(e, inp, at = null) {
    if (this.cls === 'knight') return;
    const id = B_MOVE[this.cls];
    if (at) { this.castSkill(id, at); return; }
    let dx = inp.x, dz = -inp.y;
    const len = Math.hypot(dx, dz);
    if (len > 0.3) { dx /= len; dz /= len; } else { dx = e.fx; dz = e.fz; }
    this.castSkill(id, { x: e.x + dx * 4.5, z: e.z + dz * 4.5 });
  },

  /** Do the skill (mana and recharge are handled by castSkill). p = target point. Returns false if nothing happened. */
  useSkill(e, id, p = null, r = this.rank(id) || 1) {
    const k = rankK(r);
    const spell = this.cls === 'wizard' ? e.st.spell : 1;
    switch (id) {
      case 'roll': {
        const dx = p ? p.x - e.x : e.fx, dz = p ? p.z - e.z : e.fz, d = Math.hypot(dx, dz) || 1;
        e.fx = dx / d; e.fz = dz / d;
        e.rollT = 0.3;
        e.rollX = e.fx; e.rollZ = e.fz;
        e.inv = Math.max(e.inv, 0.36);
        this.game.audio.play('dash');
        this.puffs.burst(new THREE.Vector3(e.x, 0.3, e.z), 0xffffff, { count: 5, size: 0.35, life: 0.4, speed: 2 });
        break;
      }
      case 'hop': {
        // Bubble hop: blink to the pointer (only where you could walk to: no hopping past locked doors)
        const to = p || { x: e.x + e.fx * 4.5, z: e.z + e.fz * 4.5 };
        const path = findPath(this, e.x, e.z, to.x, to.z);
        const len = path ? path.reduce((a, q, i) => a + Math.hypot(q.x - (i ? path[i - 1].x : e.x), q.z - (i ? path[i - 1].z : e.z)), 0) : Infinity;
        if (!path || len > 14) { this.game.audio.play('bump'); return false; }
        const last = path[path.length - 1];
        this.puffs.burst(new THREE.Vector3(e.x, 0.8, e.z), 0xbfe9ff, { count: 8, size: 0.4, life: 0.5, speed: 2 });
        e.x = last.x; e.z = last.z;
        this.pushOut(e, 0.42);
        e.inv = Math.max(e.inv, 0.3);
        e.ch.squash(1.4);
        this.puffs.burst(new THREE.Vector3(e.x, 0.8, e.z), 0xbfe9ff, { count: 8, size: 0.4, life: 0.5, speed: 2 });
        this.game.audio.play('pop');
        this.ctlCancel?.();
        break;
      }
      case 'bash': {
        // one big bonk on the grumble in front; it gets dizzy
        const tg = this.faceTarget(e, 3, 0.9);
        e.swingT = 0.22; e.swingDir = -e.swingDir;
        const dmg = this.rollDmg(e, 2.2 * k);
        let hit = false;
        for (const g of [...this.grumbles]) {
          if (g.dead || !this.inArc(e, g.x, g.z, 2.6 + GR * g.size, 0.7)) continue;
          if (this.hitGrumble(g, dmg, e, e.fx * 9, e.fz * 9, e) && !g.dead && g.state !== 'bubble') { g.state = 'dizzy'; g.t = 1.2; }
          hit = true;
          break;
        }
        if (!hit) for (const n of this.nests) if (!n.done && this.inArc(e, n.x, n.z, 2.6 + n.r, 0.7)) { this.damageNest(n, dmg * 1.6, e); hit = true; break; }
        const b = this.boss;
        if (!hit && b?.awake && b.y < 2.5 && this.inArc(e, b.x, b.z, 2.6 + b.r, 0.7)) b.damage(dmg, e);
        this.addFx('arc', e.x, e.z, { yaw: Math.atan2(e.fx, e.fz), half: 0.7, rad: 2.6, life: 0.25 });
        this.game.audio.play('boing');
        void tg;
        break;
      }
      case 'spin':
        e.spinT = 0.4;
        this.swing(e, 3.4 + 0.1 * r, Math.PI, this.rollDmg(e, 1.6 * k), 9);
        this.game.audio.play('whoosh');
        break;
      case 'rush': {
        const tg = this.faceTarget(e, 8, 0.6);
        e.rushT = 0.36;
        e.rushHits = new Set();
        e.rushDmg = this.rollDmg(e, 1.5 * k);
        e.inv = Math.max(e.inv, 0.45);
        if (tg) e.rushT = Math.min(0.36, (tg.d + 1) / 18);
        this.game.audio.play('dash');
        break;
      }
      case 'quake': {
        const R = 5 + 0.2 * r, dmg = this.rollDmg(e, 2 * k);
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
        e.hp = Math.min(e.st.maxHp, e.hp + e.st.maxHp * (0.3 + 0.05 * r));
        e.cheerT = 5 + r;
        this.confetti.burst(new THREE.Vector3(e.x, 1.4, e.z), 0, { count: 40, speed: 6, up: 6, colors: [COLORS.gold, 0xff5d73, 0xffffff], life: 1.1, size: 0.15 });
        this.floater(t('ks.cheer'), new THREE.Vector3(e.x, 2.6, e.z), '#ffd23f', 1.4, true);
        this.game.audio.play('fanfare');
        break;
      case 'leap': {
        // jump to the pointer and bonk everything where you land
        const to = p || { x: e.x + e.fx * 5, z: e.z + e.fz * 5 };
        e.leap = { x0: e.x, z0: e.z, x1: to.x, z1: to.z, t: 0, dur: 0.42, dmg: this.rollDmg(e, 1.7 * k) };
        e.inv = Math.max(e.inv, 0.5);
        this.game.audio.play('boing');
        this.ctlCancel?.();
        break;
      }
      case 'avalanche':
        this.addZone({ kind: 'avalanche', x: p.x, z: p.z, r: 3.2, life: 1.4, tick: 0.16, dmg: this.rollDmg(e, 1.1 * k) });
        this.game.audio.play('whoosh');
        break;
      case 'snooze':
        this.faceTarget(e, 12, 0.5);
        this.shoot(e, 'arrow', 0, this.rollDmg(e, 1.2 * k), { snooze: 1.5 + 0.3 * r });
        this.game.audio.play('dash');
        break;
      case 'fan':
        this.faceTarget(e, 10, 0.8);
        for (let i = -3; i <= 3; i++) this.shoot(e, 'arrow', i * 0.14, this.rollDmg(e, 0.8 * k));
        this.game.audio.play('dash');
        break;
      case 'pierce':
        this.faceTarget(e, 16, 0.5);
        this.shoot(e, 'big', 0, this.rollDmg(e, 3 * k), { pierce: 99 });
        this.game.audio.play('whoosh');
        break;
      case 'rain': {
        const q = p || this.aimSpot(e, 6);
        this.addZone({ kind: 'rain', x: q.x, z: q.z, r: 3.2, life: 2.1, tick: 0.33, dmg: this.rollDmg(e, 0.8 * k) });
        this.game.audio.play('whoosh');
        break;
      }
      case 'trap':
        this.addZone({ kind: 'trap', x: p.x, z: p.z, r: 2.6, life: 12, tick: 0.1, dmg: this.rollDmg(e, 2.4 * k), sleep: 1.5 + 0.3 * r });
        this.game.audio.play('select');
        break;
      case 'owl':
        this.addZone({ kind: 'owl', x: e.x, z: e.z, life: 7 + r, tick: 0.45, dmg: e.st.dmg * 0.75 * k });
        this.game.audio.play('star');
        break;
      case 'star':
        this.addZone({ kind: 'star', x: e.x, z: e.z, x0: e.x, z0: e.z, x1: p.x, z1: p.z, r: 3, life: Math.max(0.25, Math.hypot(p.x - e.x, p.z - e.z) / 20), dmg: this.rollDmg(e, 2.6 * k) });
        this.game.audio.play('whoosh');
        break;
      case 'bolt':
        this.faceTarget(e, 12, 0.5);
        this.shoot(e, 'bolt', 0, this.rollDmg(e, 1.15 * k * spell));
        this.game.audio.play('pop');
        break;
      case 'ring':
        for (let i = 0; i < 10; i++) this.shoot(e, 'bubble', (i / 10) * Math.PI * 2, 0, { life: 0.55 + 0.05 * r });
        this.game.audio.play('trap');
        break;
      case 'bomb': {
        const q = p || this.aimSpot(e, 6);
        this.addZone({ kind: 'bomb', x: q.x, z: q.z, r: 3, life: 0.75, dmg: this.rollDmg(e, 2.5 * k * spell) });
        this.game.audio.play('bubble');
        break;
      }
      case 'cloud': {
        const q = p || this.aimSpot(e, 5);
        this.addZone({ kind: 'cloud', x: q.x, z: q.z, r: 3.5, life: 4 + 0.3 * r, tick: 0.5, dmg: this.rollDmg(e, 0.35 * k * spell) });
        this.game.audio.play('trap');
        break;
      }
      case 'shield':
        e.shieldHp = e.st.maxHp * (0.25 + 0.05 * r);
        e.shieldT = 10;
        this.game.audio.play('bubble');
        this.floater(t('ks.skill.shield'), new THREE.Vector3(e.x, 2.6, e.z), '#4cc9f0', 1, true);
        break;
      case 'storm':
        this.addZone({ kind: 'storm', x: e.x, z: e.z, life: 4, tick: 0.25, dmg: e.st.dmg * k * spell });
        this.game.audio.play('trap');
        break;
      case 'splash':
        this.addZone({ kind: 'bomb', x: p.x, z: p.z, r: 4.6, life: 0.9, dmg: this.rollDmg(e, 4 * k * spell), big: true });
        this.game.audio.play('bubble');
        break;
      default: return false;
    }
    return true;
  },

  /** Knight leap: fly in an arc to the spot, then bonk around the landing. */
  updateLeap(e, dt) {
    const L = e.leap;
    L.t += dt;
    const k = Math.min(1, L.t / L.dur);
    const nx = L.x0 + (L.x1 - L.x0) * k, nz = L.z0 + (L.z1 - L.z0) * k;
    e.x = nx; e.z = nz;
    e.leapY = Math.sin(k * Math.PI) * 2.2;
    if (k >= 1) {
      e.leap = null;
      e.leapY = 0;
      this.pushOut(e, 0.42);
      this.hitArea(e.x, e.z, 2.8, L.dmg, e, (g) => { if (g.state !== 'bubble') { g.state = 'dizzy'; g.t = 1.4; } });
      this.addFx('ring', e.x, e.z, { color: 0xffe9a8, from: 0.4, to: 2.8, life: 0.4 });
      this.puffs.burst(new THREE.Vector3(e.x, 0.3, e.z), 0xffffff, { count: 14, size: 0.55, life: 0.6, speed: 5 });
      e.ch.squash(0.6);
      this.game.audio.play('splat');
    }
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
    } else if (z.kind === 'trap') {
      // a little bundle of feathers on the floor
      for (let i = 0; i < 5; i++) {
        const f = mesh(cone('ksFeather', 0.12, 0.8, 6), toon(i % 2 ? 0xffffff : 0x3ddc97), 0, 0.15, 0, false);
        f.rotation.set(Math.PI / 2, 0, (i / 5) * Math.PI * 2);
        f.scale.z = 0.35;
        g.add(f);
      }
      z.mat = fadeMat(0x3ddc97, 0.18);
      const disc = new THREE.Mesh(sharedGeo('ksZoneDisc', () => new THREE.CircleGeometry(1, 32)), z.mat);
      disc.rotation.x = -Math.PI / 2; disc.position.y = 0.05; disc.scale.setScalar(z.r);
      g.add(disc);
    } else if (z.kind === 'star') {
      z.ball = makeStar(COLORS.gold);
      z.ball.scale.setScalar(0.45);
      z.ball.position.y = 1;
      g.add(z.ball);
    } else if (z.kind === 'avalanche') {
      z.mat = fadeMat(0xffd0e4, 0.3);
      const disc = new THREE.Mesh(sharedGeo('ksZoneDisc', () => new THREE.CircleGeometry(1, 32)), z.mat);
      disc.rotation.x = -Math.PI / 2; disc.position.y = 0.06; disc.scale.setScalar(z.r);
      g.add(disc);
      z.drops = [];
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
        z.ball.scale.setScalar((1 + k * 2.2) * (z.big ? 1.5 : 1));
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
      } else if (z.kind === 'trap') {
        // waits for a grumble to step close, then pops: everything near falls asleep
        if (!z.boom && this.grumbles.some((g) => !g.dead && g.state !== 'idle' && Math.hypot(g.x - z.x, g.z - z.z) < 1.4)) {
          z.boom = true;
          this.hitArea(z.x, z.z, z.r, z.dmg, e, (g) => { if (g.state !== 'bubble') { g.state = 'sleep'; g.t = z.sleep; g.vx = g.vz = 0; } });
          this.addFx('ring', z.x, z.z, { color: 0x3ddc97, from: 0.4, to: z.r, life: 0.4 });
          this.puffs.burst(new THREE.Vector3(z.x, 0.6, z.z), 0xffffff, { count: 16, size: 0.4, life: 0.7, speed: 5 });
          this.game.audio.play('pop');
          z.life = z.t;
        }
        z.g.rotation.y += dt;
      } else if (z.kind === 'star') {
        // a big star flies to the spot and bursts
        const k2 = Math.min(1, z.t / z.life);
        z.x = z.x0 + (z.x1 - z.x0) * k2; z.z = z.z0 + (z.z1 - z.z0) * k2;
        z.g.position.set(z.x, 0, z.z);
        z.ball.rotation.y += dt * 12;
        if (k2 >= 1 && !z.boom) {
          z.boom = true;
          this.hitArea(z.x, z.z, z.r, z.dmg, e);
          this.addFx('ring', z.x, z.z, { color: COLORS.gold, from: 0.4, to: z.r, life: 0.45 });
          for (let i = 0; i < 4; i++) this.spawnStarFx(z.x, 1, z.z);
          this.game.audio.play('star');
        }
      } else if (z.kind === 'avalanche') {
        // pillows fall on random spots inside the circle
        if (z.next <= 0 && z.t < z.life - 0.4) {
          z.next = z.tick;
          const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * z.r * 0.8;
          const pm = mesh(rbox('ksAvaPillow', 1.1, 0.45, 0.8, 0.18), toon([0xffd0e4, 0xbfe0ff, 0xfff3a0][Math.floor(Math.random() * 3)]), Math.cos(a) * d, 6, Math.sin(a) * d);
          pm.rotation.y = Math.random() * 3;
          z.g.add(pm);
          z.drops.push({ m: pm, vy: 0 });
        }
        for (const dp of z.drops) {
          if (dp.done) continue;
          dp.vy -= 40 * dt;
          dp.m.position.y += dp.vy * dt;
          if (dp.m.position.y <= 0.25) {
            dp.done = true;
            dp.m.position.y = 0.25;
            const wx = z.x + dp.m.position.x, wz = z.z + dp.m.position.z;
            this.hitArea(wx, wz, 1.7, z.dmg, e, (g) => { if (g.state !== 'bubble') { g.state = 'dizzy'; g.t = 0.8; } });
            this.puffs.burst(new THREE.Vector3(wx, 0.4, wz), 0xffffff, { count: 6, size: 0.45, life: 0.5, speed: 4 });
            this.game.audio.play('bump');
          }
        }
        z.mat.opacity = 0.3 * (1 - k * 0.6);
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
