import * as THREE from 'three';
import { Round, clock } from './common.js';
import { makeGrumble } from '../../core/critters.js';
import { COLORS, toon } from '../../core/palette.js';
import { makeTree, makeBush, makeFlower, seeded } from '../../core/world.js';
import { t } from '../../core/i18n.js';

// Count the Critters: grumbles scurry past; count only one color, then guess.
const COLORS3 = [0x9b5de5, 0xff8c42, 0x3ddc97];
const WATCH = 14;
const GUESS = 15;

export class CountRound extends Round {
  static key = 'count';

  constructor(party) {
    super(party);
    this.target = Math.floor(Math.random() * 3);
    this.answer = 7 + Math.floor(Math.random() * 7);
    this.phase = 'watch';
    this.t = 0;
    this.critters = [];
    this.build();

    // Spawn plan: target critters plus decoys, sometimes in little bunches.
    const plan = [];
    const decoys = 4 + Math.floor(Math.random() * 5);
    const add = (color, n) => {
      for (let i = 0; i < n;) {
        const bunch = Math.min(n - i, Math.random() < 0.3 ? 2 + Math.floor(Math.random() * 2) : 1);
        const at = 0.6 + Math.random() * (WATCH - 3.5);
        const dir = Math.random() < 0.5 ? 1 : -1;
        const speed = 5 + Math.random() * 4;
        for (let k = 0; k < bunch; k++) plan.push({ at: at + k * 0.35, color, dir, speed, hop: Math.random() < 0.5 });
        i += bunch;
      }
    };
    add(COLORS3[this.target], this.answer);
    for (let i = 0; i < decoys; i++) add(COLORS3[(this.target + 1 + (i % 2)) % 3], 1);
    this.plan = plan.sort((a, b) => a.at - b.at);

    this.ents = this.players.map((p, i) => {
      const ch = this.bean(p);
      const n = this.players.length;
      ch.group.position.set((i - (n - 1) / 2) * 1.6, 0, 6.5);
      ch.yaw = ch.targetYaw = Math.PI; // watching the meadow
      return { p, ch, guess: 10, locked: false, tag: this.label('label party-num') };
    });
  }

  get title() { return t('count.title'); }
  get hint() { return t('count.hint', { c: t(`count.c.${this.target}`) }); }

  build() {
    const g = this.group;
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 40), toon(COLORS.grass));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    g.add(ground);
    const path = new THREE.Mesh(new THREE.PlaneGeometry(80, 3), toon(COLORS.sand));
    path.rotation.x = -Math.PI / 2;
    path.position.y = 0.01;
    g.add(path);
    const rand = seeded(8);
    for (let i = 0; i < 14; i++) {
      const tr = makeTree(rand, 1.2 + rand() * 0.6);
      tr.position.set(-22 + i * 3.4 + rand(), 0, -5 - rand() * 4);
      g.add(tr);
    }
    for (let i = 0; i < 10; i++) {
      const b = makeBush(rand, 0.9);
      b.position.set(-18 + i * 4 + rand(), 0, -2.6);
      g.add(b);
    }
    for (let i = 0; i < 40; i++) {
      const f = makeFlower(rand);
      f.position.set(-20 + rand() * 40, 0, 2 + rand() * 5);
      g.add(f);
    }
    // A sign showing which color to count.
    const sign = new THREE.Group();
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 2.4, 8), toon(COLORS.trunk));
    post.position.y = 1.2;
    const board = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.1, 0.12), toon(COLORS.cream));
    board.position.y = 2.4;
    const sample = makeGrumble(COLORS3[this.target]);
    sample.scale.setScalar(0.9);
    sample.position.set(0, 1.95, 0.1);
    sign.add(post, board, sample);
    sign.position.set(-8.5, 0, 3.2);
    sign.rotation.y = 0.3;
    g.add(sign);
    this.sample = sample;
  }

  frame() {
    const d = this.party.fitDistance(22, 9);
    this.camera.position.set(0, 4 + d * 0.18, d * 0.92 + 4);
    this.camera.lookAt(0, 1.2, 0);
  }

  spawn(s) {
    const m = makeGrumble(s.color);
    m.position.set(-s.dir * 20, 0, (Math.random() - 0.5) * 1.6);
    m.rotation.y = s.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    this.group.add(m);
    this.critters.push({ m, ...s, phase: Math.random() * 6 });
  }

  update(dt, playing) {
    this.time += dt;
    this.sample.position.y = 1.95 + Math.abs(Math.sin(this.time * 4)) * 0.1;
    for (const e of this.ents) e.ch.update(dt, {});
    if (!playing) return;
    this.t += dt;

    if (this.phase === 'watch') {
      while (this.plan.length && this.plan[0].at <= this.t) this.spawn(this.plan.shift());
      if (this.t >= WATCH && !this.critters.length) { this.phase = 'guess'; this.t = 0; this.game.audio.play('beep'); }
    }
    for (const c of this.critters) {
      c.m.position.x += c.dir * c.speed * dt;
      c.m.position.y = c.hop ? Math.abs(Math.sin(this.time * 7 + c.phase)) * 1.0 : Math.abs(Math.sin(this.time * 14 + c.phase)) * 0.12;
    }
    this.critters = this.critters.filter((c) => {
      if (Math.abs(c.m.position.x) < 21) return true;
      this.group.remove(c.m);
      return false;
    });

    if (this.phase === 'guess') {
      for (const e of this.ents) {
        const d = this.input(e.p);
        const step = d.stepY || d.stepX;
        if (!e.locked && step) {
          e.guess = THREE.MathUtils.clamp(e.guess + step, 0, 40);
          this.game.audio.play('select');
          e.ch.squash(1.1);
        }
        if (d.aPressed) {
          e.locked = !e.locked;
          this.game.audio.play(e.locked ? 'join' : 'select');
          e.ch.yaw = e.ch.targetYaw = 0;
          e.ch.squash(1.25);
        }
      }
      if (this.t >= GUESS || this.ents.every((e) => e.locked)) this.reveal();
    }

    if (this.phase === 'reveal') {
      // March the counted critters in one by one.
      const shown = Math.min(this.answer, Math.floor(this.t / 0.28));
      while (this.revealed.length < shown) {
        const i = this.revealed.length;
        const m = makeGrumble(COLORS3[this.target]);
        const cols = Math.min(this.answer, 10);
        m.position.set((i % cols - (cols - 1) / 2) * 1.2, 0, Math.floor(i / cols) * -1.4);
        this.group.add(m);
        m.scale.setScalar(0.01);
        this.revealed.push(m);
        this.game.audio.play('pop');
      }
      for (const m of this.revealed) m.scale.setScalar(Math.min(1, m.scale.x + dt * 5));
      if (shown === this.answer && !this.announced) {
        this.announced = true;
        this.game.ui.banner(t('count.answer', { n: this.answer }), '', 1800);
        for (const e of this.ents) {
          if (e.guess === this.answer) {
            e.ch.squash(1.4);
            this.party.confetti.burst(e.ch.group.position.clone().setY(2), 0, { count: 30, speed: 6, colors: [e.p.color, COLORS.gold] });
          }
        }
        this.game.audio.play('star');
        this.later(2.6, () => { this.done = true; });
      }
    }

    for (const e of this.ents) {
      const show = this.phase !== 'watch';
      e.tag.style.display = show ? '' : 'none';
      if (show) this.setLabel(e.tag, `${e.guess}${e.locked ? ' ✓' : ''}`, e.ch.group.position.clone().setY(2.3), e.p.css);
    }
  }

  reveal() {
    this.phase = 'reveal';
    this.t = 0;
    this.revealed = [];
    for (const e of this.ents) { e.locked = true; e.ch.yaw = e.ch.targetYaw = Math.PI; }
  }

  hud() {
    if (this.phase === 'watch') return `<div class="pill">${t('count.watch', { c: t(`count.c.${this.target}`) })}</div>`;
    if (this.phase === 'guess') return `<div class="pill">${t('count.ask')}</div>${clock(GUESS - this.t)}`;
    return '';
  }

  score(p) {
    const e = this.ents.find((x) => x.p === p);
    return -Math.abs(e.guess - this.answer);
  }

  detail(p) {
    return t('count.guessed', { g: this.ents.find((x) => x.p === p).guess });
  }
}
