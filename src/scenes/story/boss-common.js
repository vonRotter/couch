import * as THREE from 'three';
import { MiniGame } from '../../core/minigame.js';
import { Character } from '../../core/character.js';
import { PLAYER_COLORS, COLORS, toon, basic, sharedGeo } from '../../core/palette.js';
import { t, addStrings } from '../../core/i18n.js';
import { makeKing } from './king.js';
import { BOSS_GOALS, BOSS_TIME } from './stages.js';

// Shared flow for the four Grumble King encounters: a co-op goal counter, a time limit and a
// happy ending either way (he ends up dizzy and giggling, never hurt).
//
// Opposition toolkit shared by the bosses (all harmless):
// - lob(): a telegraphed throw. A purple ring on the ground shows where it lands and fills up
//   as it falls, so you can always see it coming and step (or hop) out of the way.
// - slip(): what a hit does. The bean spins and slides for a moment without control and drops
//   whatever it carries (onSlip hook), then blinks for a short grace time. Nobody is knocked out.
// - phases: the fight gets livelier at 1/3 and 2/3 of the goal (onPhase hook: helpers arrive,
//   throws come faster). Throw volleys and helper counts scale with the number of players, so
//   every bean faces about the same pressure whether 1 or 6 are playing.

addStrings({
  en: {
    'boss.0': 'Dizzy King', 'boss.1': 'Bell Fort', 'boss.2': 'Cake Feast', 'boss.3': 'Bubble Rings',
    'boss.win': 'He is giggling!', 'boss.winSub': 'The Grumble King is too dizzy to be grumpy',
    'boss.time': 'Time!', 'boss.timeSub': 'He had fun anyway. Shh, don\'t tell him!',
    'boss.title': 'The Grumble King is giggling!',
    'boss.titleTime': 'What a game!',
    'boss.sub': '{n} of {m} together',
    'boss.n': '{n}',
    'boss.unit.0': 'head bounces', 'boss.unit.1': 'bells rung', 'boss.unit.2': 'cakes served', 'boss.unit.3': 'rings',
  },
  no: {
    'boss.0': 'Svimle-kongen', 'boss.1': 'Bjellefestningen', 'boss.2': 'Kakefesten', 'boss.3': 'Bobleringene',
    'boss.win': 'Han fniser!', 'boss.winSub': 'Grumle-kongen er for svimmel til å være sur',
    'boss.time': 'Tiden er ute!', 'boss.timeSub': 'Han hadde det gøy likevel. Hysj, ikke si det til ham!',
    'boss.title': 'Grumle-kongen fniser!',
    'boss.titleTime': 'For et spill!',
    'boss.sub': '{n} av {m} sammen',
    'boss.n': '{n}',
    'boss.unit.0': 'hopp på hodet', 'boss.unit.1': 'bjelleklang', 'boss.unit.2': 'kaker servert', 'boss.unit.3': 'ringer',
  },
});

export const PR = 0.42; // bean radius
const SPEED = 7;
const JUMP = 11.5;
const GRAVITY = 30;
export const SLIP_TIME = 1.1; // seconds a hit bean spins without control
const SAFE_TIME = 1.0; // blinking grace after a slip, so hits never chain
const MARK_COLOR = 0x8a63f0; // the King's purple: every "something lands here" ring uses it

/** Volley size for throws: about one throw per two beans, a little more in later phases. */
export function volley(n, phase) {
  return Math.min(5, Math.ceil(n / 2) + (phase >= 2 ? 1 : 0));
}

export class BossScene extends MiniGame {
  /**
   * cfg: { chapter, kingSize }. Subclasses build their arena, then call this.start().
   */
  constructor(game, opts, { chapter, kingSize = 2.4 }) {
    super(game, opts);
    this.chapter = chapter;
    this.n = Math.max(1, this.players.length);
    this.goal = BOSS_GOALS[chapter](this.n);
    this.count = 0;
    this.timeLimit = BOSS_TIME;
    this.timeLeft = BOSS_TIME;
    this.won = false;
    this.over = false;
    this.winTime = null;
    this.king = makeKing(kingSize);
    this.scene.add(this.king.group);
    this.ents = [];
    this.lobs = [];
    this.phase = 0;
  }

  // ---------- phases ----------

  /** 0, 1 or 2: the fight steps up at a third and two thirds of the goal. */
  phaseFor(count) {
    return count * 3 >= this.goal * 2 ? 2 : count * 3 >= this.goal ? 1 : 0;
  }

  checkPhase() {
    const p = this.phaseFor(this.count);
    if (p > this.phase && !this.finished) {
      this.phase = p;
      this.onPhase?.(p);
    }
  }

  // ---------- telegraphed throws ----------

  /** The purple landing ring: an outline plus a disc that fills up as the throw falls. */
  makeMarker(x, z, r, y = 0) {
    const g = new THREE.Group();
    const ring = new THREE.Mesh(sharedGeo('bossMarkRing', () => new THREE.RingGeometry(0.84, 1, 36)), basic(MARK_COLOR));
    const fill = new THREE.Mesh(sharedGeo('bossMarkFill', () => new THREE.CircleGeometry(1, 36)), basic(MARK_COLOR, { transparent: true, opacity: 0.32, depthWrite: false }));
    ring.rotation.x = fill.rotation.x = -Math.PI / 2;
    fill.position.y = -0.005;
    fill.scale.setScalar(0.05);
    g.add(ring, fill);
    g.position.set(x, y + 0.05, z);
    g.scale.setScalar(r);
    g.userData.fill = fill;
    this.scene.add(g);
    return g;
  }

  /**
   * Throw `mesh` in a high arc from `from` (Vector3) to the ground spot (x, z) in `time` seconds.
   * Beans on the ground within `r` slip when it lands. onLand(lob) runs after the splat.
   */
  lob({ from, x, z, time = 1.2, r = 1.05, mesh, groundY = 0, color = 0xffffff, onLand = null, arc = 6 }) {
    this.scene.add(mesh);
    mesh.position.copy(from);
    const marker = this.makeMarker(x, z, r, groundY);
    const l = { from: from.clone(), x, z, y: groundY, T: time, t: 0, r, mesh, marker, color, onLand, arc };
    this.lobs.push(l);
    return l;
  }

  updateLobs(dt) {
    for (const l of this.lobs) {
      l.t += dt;
      const u = Math.min(1, l.t / l.T);
      // Straight line from start to target plus a parabola bump on top.
      l.mesh.position.set(
        THREE.MathUtils.lerp(l.from.x, l.x, u),
        THREE.MathUtils.lerp(l.from.y, l.y + 0.2, u) + 4 * l.arc * u * (1 - u),
        THREE.MathUtils.lerp(l.from.z, l.z, u),
      );
      l.mesh.rotation.x += dt * 6;
      l.marker.userData.fill.scale.setScalar(0.05 + 0.95 * u);
      if (l.t < l.T) continue;
      l.done = true;
      this.scene.remove(l.mesh, l.marker);
      const at = new THREE.Vector3(l.x, l.y + 0.3, l.z);
      this.puffs.burst(at, l.color, { count: 14, speed: 4.5, size: 0.35 });
      this.game.audio.play('splat');
      if (!this.finished && this.state === 'play') {
        for (const e of this.ents) {
          if (e.y < 0.6 && Math.hypot(e.x - l.x, e.z - l.z) < l.r + PR * 0.5) this.slip(e, l.x, l.z);
        }
      }
      l.onLand?.(l);
    }
    this.lobs = this.lobs.filter((l) => !l.done);
  }

  /** Drop every throw in flight (used when the fight ends). */
  clearLobs() {
    for (const l of this.lobs) this.scene.remove(l.mesh, l.marker);
    this.lobs = [];
  }

  /** A harmless hit: spin, slide and drop what you carry. Returns false while still blinking. */
  slip(e, fromX, fromZ, power = 5) {
    if (e.slip > 0 || e.safe > 0 || this.finished) return false;
    e.slip = SLIP_TIME;
    e.safe = SLIP_TIME + SAFE_TIME;
    const dx = e.x - fromX, dz = e.z - fromZ, d = Math.hypot(dx, dz);
    const nx = d > 0.05 ? dx / d : 0, nz = d > 0.05 ? dz / d : 1;
    e.vx = nx * power; e.vz = nz * power;
    e.ch.squash(0.7);
    e.slips = (e.slips || 0) + 1;
    this.puffs.burst(new THREE.Vector3(e.x, 0.6, e.z), 0xffffff, { count: 8, speed: 3, size: 0.25 });
    this.game.audio.play('bump');
    this.onSlip?.(e);
    return true;
  }

  /** Spin while slipping, blink while safe. Call once per frame for each bean. */
  updateSlip(e, dt) {
    if (e.slip > 0) {
      e.slip -= dt;
      e.ch.spin += dt * 13;
      if (e.slip <= 0) e.ch.spin %= Math.PI * 2;
    } else if (e.ch.spin) {
      const target = e.ch.spin > Math.PI ? Math.PI * 2 : 0;
      e.ch.spin += (target - e.ch.spin) * Math.min(1, dt * 12);
      if (Math.abs(target - e.ch.spin) < 0.02) e.ch.spin = 0;
    }
    if (e.safe > 0) e.safe -= dt;
    e.ch.group.visible = !(e.safe > 0 && e.slip <= 0 && Math.floor(e.safe * 12) % 2 === 0);
  }

  /** Call at the end of the subclass constructor. */
  start(music) {
    this.frame();
    if (music) this.game.audio.playMusic(music);
    this.intro(t(`boss.${this.chapter}`), t(`story.goal.boss${this.chapter}`, { n: this.goal }));
  }

  frame() {}

  resize(w, h) {
    super.resize(w, h);
    this.frame();
  }

  /** A top-down bean with a colored ring under it. */
  makeBean(p, x, z) {
    const ch = new Character(p.color, { hat: p.hat });
    this.scene.add(ch.group);
    const ring = new THREE.Mesh(sharedGeo('bossRing', () => new THREE.RingGeometry(0.5, 0.66, 24)), toon(p.color, { transparent: true, opacity: 0.8 }));
    ring.rotation.x = -Math.PI / 2;
    this.scene.add(ring);
    const e = { p, ch, ring, x, y: 0, z, vx: 0, vy: 0, vz: 0, grounded: true, score: 0, dirX: 0, dirZ: -1, push: 0, slip: 0, safe: 0, slips: 0 };
    ch.face(0, -1);
    ch.yaw = ch.targetYaw;
    this.ents.push(e);
    return e;
  }

  /** Stick movement on the ground plane, A to jump. bounds: { x0, x1, z0, z1 } or { r }. */
  moveBean(e, dt, bounds, { jump = true, speed = SPEED } = {}) {
    this.updateSlip(e, dt);
    const slipping = e.slip > 0;
    const inp = this.state === 'play' && !slipping ? this.input(e.p) : null;
    const ix = inp ? inp.x : 0, iz = inp ? -inp.y : 0;
    const len = Math.hypot(ix, iz);
    if (len > 0.2) { e.dirX = ix / len; e.dirZ = iz / len; }
    const acc = (e.grounded ? 45 : 22) * dt;
    if (e.push > 0) e.push -= dt;
    else if (slipping) {
      // Sliding on the spot: no control, just friction.
      const f = Math.max(0, 1 - dt * 2.5);
      e.vx *= f; e.vz *= f;
    } else {
      e.vx += THREE.MathUtils.clamp(ix * speed - e.vx, -acc, acc);
      e.vz += THREE.MathUtils.clamp(iz * speed - e.vz, -acc, acc);
    }
    if (jump && inp?.aPressed && e.grounded) {
      e.vy = JUMP;
      e.grounded = false;
      e.ch.squash(1.3);
      this.game.audio.play('jump');
    }
    e.vy -= GRAVITY * dt;
    e.x += e.vx * dt; e.z += e.vz * dt; e.y += e.vy * dt;
    if (e.y <= 0) {
      if (!e.grounded && e.vy < -4) { e.ch.squash(0.75); }
      e.y = 0; e.vy = 0; e.grounded = true;
    }
    if (bounds.r) {
      const d = Math.hypot(e.x, e.z);
      if (d > bounds.r - PR) { e.x *= (bounds.r - PR) / d; e.z *= (bounds.r - PR) / d; }
    } else {
      e.x = THREE.MathUtils.clamp(e.x, bounds.x0 + PR, bounds.x1 - PR);
      e.z = THREE.MathUtils.clamp(e.z, bounds.z0 + PR, bounds.z1 - PR);
    }
    this.placeBean(e, dt, len);
  }

  placeBean(e, dt, moving = 0) {
    e.ch.face(e.dirX, e.dirZ);
    e.ch.group.position.set(e.x, e.y, e.z);
    e.ch.update(dt, { moving: e.grounded ? Math.min(1, moving) : 0, grounded: e.grounded, vy: e.vy });
    e.ring.position.set(e.x, 0.03, e.z);
    e.ring.scale.setScalar(1 / (1 + e.y * 0.25));
  }

  /** Gentle bean-to-bean pushing so nobody stands inside anybody. */
  separate() {
    const list = this.ents;
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i], b = list[j];
        const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
        if (d < PR * 2 && d > 1e-4 && Math.abs(a.y - b.y) < 0.8) {
          const push = (PR * 2 - d) / 2;
          a.x -= (dx / d) * push; a.z -= (dz / d) * push;
          b.x += (dx / d) * push; b.z += (dz / d) * push;
        }
      }
    }
  }

  /** Softly shove a bean away from a point (the King bumping into you). Never hurts. */
  shove(e, fromX, fromZ, power = 9) {
    const dx = e.x - fromX, dz = e.z - fromZ, d = Math.hypot(dx, dz) || 1;
    e.vx = (dx / d) * power; e.vz = (dz / d) * power;
    if (e.grounded) { e.vy = 5; e.grounded = false; }
    e.push = 0.3;
    e.ch.squash(0.8);
    this.game.audio.play('bump');
  }

  /** A point for the team. */
  addPoint(e, pos, n = 1) {
    if (this.won || this.over || this.state !== 'play') return;
    this.count += n;
    if (e) e.score += n;
    const colors = e ? [e.p.color, COLORS.gold, COLORS.white] : [COLORS.gold, COLORS.white];
    if (pos) this.confetti.burst(pos, 0, { count: 26, speed: 6, colors, life: 1.1 });
    this.game.audio.play('star');
    if (this.count >= this.goal) this.win();
    else this.checkPhase();
  }

  win() {
    this.won = true;
    this.clearLobs();
    this.winTime = this.time - (this.playStart ?? 0);
    this.king.setMood('laugh');
    this.game.audio.play('dizzy');
    this.game.ui.banner(t('boss.win'), t('boss.winSub'), 2200);
    this.celebrateKing();
    this.later(3.4, () => this.end());
  }

  timeUp() {
    this.over = true;
    this.clearLobs();
    this.king.setMood('laugh');
    this.game.audio.play('dizzy');
    this.game.ui.banner(t('boss.time'), t('boss.timeSub'), 2200);
    this.celebrateKing();
    this.later(3.4, () => this.end());
  }

  /** Confetti around the giggling King. */
  celebrateKing() {
    const colors = PLAYER_COLORS.map((c) => c.hex).concat(COLORS.gold);
    for (let i = 0; i < 5; i++) {
      this.later(i * 0.35, () => {
        const p = this.king.group.position.clone();
        p.y += 3;
        this.confetti.burst(p, 0, { count: 40, speed: 7, up: 5, colors, life: 1.6 });
      });
    }
  }

  get finished() {
    return this.won || this.over;
  }

  end() {
    if (this.state === 'results') return;
    this.clearLobs();
    for (const e of this.ents) { e.ring.visible = false; e.ch.group.visible = true; }
    const ranked = [...this.ents].sort((a, b) => b.score - a.score);
    const top = ranked[0]?.score || 0;
    this.confettiOrigin = this.king.group.position.clone().setY(2);
    this.finish({
      title: this.won ? t('boss.title') : t('boss.titleTime'),
      subtitle: `${t(`boss.${this.chapter}`)} · ${t('boss.sub', { n: this.count, m: this.goal })}`,
      rows: ranked.map((e) => ({
        css: e.p.css, name: e.p.name, value: String(e.score), detail: t(`boss.unit.${this.chapter}`), crown: top > 0 && e.score === top,
      })),
      stars: this.won ? 3 : 2,
    });
  }

  /** Story campaign: did the team cheer him up, and how fast. */
  campaignStats() {
    return { done: this.won, progress: Math.min(1, this.count / this.goal), count: this.count, goal: this.goal, time: this.winTime ?? this.timeLimit, slips: this.ents.reduce((s, e) => s + (e.slips || 0), 0) };
  }

  hud() {
    const pct = Math.min(100, (this.count / this.goal) * 100);
    const secs = Math.max(0, Math.ceil(this.timeLeft));
    const clock = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
    // Little notches at a third and two thirds: that's where the fight steps up.
    const ticks = [1, 2].map((i) => `<span style="position:absolute;top:0;bottom:0;left:${(i * 100) / 3}%;width:3px;background:#fff"></span>`).join('');
    return `<div class="pill hud-title">${t(`boss.${this.chapter}`)}</div>
      <div class="pill"><b>${Math.min(this.count, this.goal)} / ${this.goal}</b>
        <span style="position:relative;display:inline-block;width:clamp(80px,12vw,200px);height:14px;border-radius:999px;background:#ece6f5;overflow:hidden">
        <span style="display:block;height:100%;width:${pct}%;background:#ffc93c"></span>${ticks}</span></div>
      <div class="pill"><b>${clock}</b></div>`;
  }

  /** Subclasses: per-frame game logic. */
  updateBoss() {}

  update(dt) {
    this.updateBoss(dt);
    this.updateLobs(dt);
    if (this.updateResults(dt)) return;
    if (this.state === 'play' && !this.finished) {
      this.timeLeft -= dt;
      if (this.timeLeft <= 0) { this.timeLeft = 0; this.timeUp(); }
    }
    if (this.state !== 'intro') this.game.ui.setTop(this.hud());
    this.game.ui.bar(this.players, (p) => String(this.ents.find((e) => e.p === p)?.score ?? 0));
  }
}
