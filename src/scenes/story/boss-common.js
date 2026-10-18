import * as THREE from 'three';
import { MiniGame } from '../../core/minigame.js';
import { Character } from '../../core/character.js';
import { PLAYER_COLORS, COLORS, toon, sharedGeo } from '../../core/palette.js';
import { t, addStrings } from '../../core/i18n.js';
import { makeKing } from './king.js';
import { BOSS_GOALS, BOSS_TIME } from './stages.js';

// Shared flow for the four Grumble King encounters: a co-op goal counter, a time limit and a
// happy ending either way (he ends up dizzy and giggling, never hurt).

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
    const e = { p, ch, ring, x, y: 0, z, vx: 0, vy: 0, vz: 0, grounded: true, score: 0, dirX: 0, dirZ: -1, push: 0 };
    ch.face(0, -1);
    ch.yaw = ch.targetYaw;
    this.ents.push(e);
    return e;
  }

  /** Stick movement on the ground plane, A to jump. bounds: { x0, x1, z0, z1 } or { r }. */
  moveBean(e, dt, bounds, { jump = true, speed = SPEED } = {}) {
    const inp = this.state === 'play' ? this.input(e.p) : null;
    const ix = inp ? inp.x : 0, iz = inp ? -inp.y : 0;
    const len = Math.hypot(ix, iz);
    if (len > 0.2) { e.dirX = ix / len; e.dirZ = iz / len; }
    const acc = (e.grounded ? 45 : 22) * dt;
    if (e.push > 0) e.push -= dt;
    else {
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
  }

  win() {
    this.won = true;
    this.winTime = this.time - (this.playStart ?? 0);
    this.king.setMood('laugh');
    this.game.audio.play('dizzy');
    this.game.ui.banner(t('boss.win'), t('boss.winSub'), 2200);
    this.celebrateKing();
    this.later(3.4, () => this.end());
  }

  timeUp() {
    this.over = true;
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
    for (const e of this.ents) e.ring.visible = false;
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
    return { done: this.won, progress: Math.min(1, this.count / this.goal), count: this.count, goal: this.goal, time: this.winTime ?? this.timeLimit };
  }

  hud() {
    const pct = Math.min(100, (this.count / this.goal) * 100);
    const secs = Math.max(0, Math.ceil(this.timeLeft));
    const clock = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
    return `<div class="pill hud-title">${t(`boss.${this.chapter}`)}</div>
      <div class="pill"><b>${Math.min(this.count, this.goal)} / ${this.goal}</b>
        <span style="display:inline-block;width:clamp(80px,12vw,200px);height:14px;border-radius:999px;background:#ece6f5;overflow:hidden">
        <span style="display:block;height:100%;width:${pct}%;background:#ffc93c"></span></span></div>
      <div class="pill"><b>${clock}</b></div>`;
  }

  /** Subclasses: per-frame game logic. */
  updateBoss() {}

  update(dt) {
    this.updateBoss(dt);
    if (this.updateResults(dt)) return;
    if (this.state === 'play' && !this.finished) {
      this.timeLeft -= dt;
      if (this.timeLeft <= 0) { this.timeLeft = 0; this.timeUp(); }
    }
    if (this.state !== 'intro') this.game.ui.setTop(this.hud());
    this.game.ui.bar(this.players, (p) => String(this.ents.find((e) => e.p === p)?.score ?? 0));
  }
}
