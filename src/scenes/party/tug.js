import * as THREE from 'three';
import { Round, clock } from './common.js';
import { makeGrumble } from '../../core/critters.js';
import { COLORS, toon, sharedGeo } from '../../core/palette.js';
import { makeTree, makeFlower, seeded } from '../../core/world.js';
import { TEAM_COLORS, TEAM_CSS } from '../../core/teams.js';
import { t } from '../../core/i18n.js';

// Tug of War: two teams mash jump; pull the other team into the paint pool.
const TIME = 22;
const WIN = 3.2;
const POOL = 1.3;

export class TugRound extends Round {
  static key = 'tug';

  constructor(party) {
    super(party);
    this.offset = 0;
    this.vel = 0;
    this.t = 0;
    this.winner = -1;
    this.build();
    this.ents = this.players.map((p, i) => ({ p, team: i % 2, ch: this.bean(p), power: 0, presses: 0 }));
    if (this.players.length === 1) {
      const g = makeGrumble(TEAM_COLORS[1]);
      g.scale.setScalar(1.4);
      this.group.add(g);
      this.ents.push({ p: null, team: 1, ch: { group: g, pivot: g, update() {}, squash() {}, faceSide() {} }, power: 0, presses: 0, bot: true, nextPress: 0 });
    }
    for (const team of [0, 1]) {
      const members = this.ents.filter((e) => e.team === team);
      members.forEach((e, k) => {
        e.slot = k;
        const ring = new THREE.Mesh(sharedGeo('teamRing', () => new THREE.RingGeometry(0.55, 0.78, 24)), toon(TEAM_COLORS[team]));
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0.03;
        e.ring = ring;
        this.group.add(ring);
      });
    }
  }

  get title() { return t('tug.title'); }
  get hint() { return t('tug.hint'); }

  build() {
    const g = this.group;
    const ground = new THREE.Mesh(new THREE.BoxGeometry(60, 1, 16), toon(COLORS.grass));
    ground.position.set(0, -0.5, -3);
    ground.receiveShadow = true;
    g.add(ground);
    const pool = new THREE.Mesh(new THREE.CylinderGeometry(POOL, POOL, 0.12, 32), toon(0xff7eb6));
    pool.scale.set(1, 1, 1.6);
    pool.position.y = 0.02;
    g.add(pool);
    this.bubbles = [];
    for (let i = 0; i < 6; i++) {
      const b = new THREE.Mesh(sharedGeo('tugBubble', () => new THREE.SphereGeometry(0.12, 8, 6)), toon(0xffb3d6));
      b.position.set((Math.random() - 0.5) * POOL, 0.1, (Math.random() - 0.5) * POOL * 1.4);
      b.userData.phase = Math.random() * 6;
      g.add(b);
      this.bubbles.push(b);
    }
    this.rope = new THREE.Group();
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 16, 8), toon(0xe8c690));
    rope.rotation.z = Math.PI / 2;
    rope.position.y = 0.95;
    const flag = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.6, 0.2), toon(0xff3b5c));
    flag.position.y = 0.7;
    this.rope.add(rope, flag);
    g.add(this.rope);
    for (const side of [-1, 1]) {
      const line = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 3), toon(TEAM_COLORS[side < 0 ? 0 : 1]));
      line.rotation.x = -Math.PI / 2;
      line.position.set(side * WIN, 0.02, 0);
      g.add(line);
    }
    const rand = seeded(5);
    for (let i = 0; i < 10; i++) {
      const tr = makeTree(rand, 1.4 + rand() * 0.5);
      tr.position.set(-20 + i * 4.4, 0, -6 - rand() * 3);
      g.add(tr);
    }
    for (let i = 0; i < 30; i++) {
      const f = makeFlower(rand);
      f.position.set((rand() - 0.5) * 30, 0, 1.5 + rand() * 3);
      g.add(f);
    }
  }

  frame() {
    const n = Math.max(2, Math.ceil(this.ents?.length / 2 || 1));
    const d = this.party.fitDistance(10 + n * 3, 8);
    this.camera.position.set(0, 5, d);
    this.camera.lookAt(0, 1, 0);
  }

  teamPower(team) {
    const m = this.ents.filter((e) => e.team === team);
    return m.reduce((s, e) => s + e.power, 0) / Math.max(1, m.length);
  }

  update(dt, playing) {
    this.time += dt;
    this.bubbles.forEach((b) => { b.position.y = 0.1 + Math.abs(Math.sin(this.time * 2 + b.userData.phase)) * 0.12; });
    for (const e of this.ents) {
      e.power *= Math.exp(-dt * 2);
      if (playing && this.winner < 0) {
        let press = false;
        if (e.bot) {
          e.nextPress -= dt;
          if (e.nextPress <= 0) { press = true; e.nextPress = 1 / (4.5 + Math.random() * 2); }
        } else {
          const d = this.input(e.p);
          press = d.aPressed || d.bPressed;
        }
        if (press) { e.power += 1; e.presses++; e.ch.squash(0.85); }
      }
    }
    if (playing && this.winner < 0) {
      this.t += dt;
      const pull = this.teamPower(1) - this.teamPower(0);
      this.vel += (pull * 0.55 - this.vel) * Math.min(1, dt * 4);
      this.offset += this.vel * dt;
      if (Math.abs(this.offset) >= WIN || this.t >= TIME) this.finishPull();
    }
    if (this.winner >= 0) {
      // The losing team slides into the paint.
      const dir = this.winner === 0 ? -1 : 1;
      this.offset += dir * dt * 1.5;
      this.offset = THREE.MathUtils.clamp(this.offset, -WIN - 2.5, WIN + 2.5);
    }
    this.rope.position.x = this.offset;
    for (const e of this.ents) {
      const side = e.team ? 1 : -1;
      const x = this.offset + side * (2.2 + e.slot * 1.3);
      const inPool = Math.abs(x) < POOL;
      e.ch.group.position.set(x, inPool ? -0.15 : 0, 0);
      e.ch.faceSide(-side);
      if (e.ch.pivot) e.ch.pivot.rotation.z = side * -0.3 * (this.winner >= 0 && e.team !== this.winner ? -1 : 1);
      e.ring.position.x = x;
      e.ch.update(dt, { moving: 0 });
    }
  }

  finishPull() {
    this.winner = this.offset === 0 ? (Math.random() < 0.5 ? 0 : 1) : this.offset < 0 ? 0 : 1;
    this.game.audio.play('splat');
    this.party.puffs.burst(new THREE.Vector3(0, 0.5, 0), 0xff7eb6, { count: 24, size: 0.45, life: 0.8 });
    this.party.confetti.burst(new THREE.Vector3(this.winner ? 4 : -4, 2.5, 0), 0, { count: 40, speed: 7, colors: [TEAM_COLORS[this.winner], COLORS.white] });
    this.game.ui.banner(t('ball.winTitle', { team: t(`ball.team.${this.winner}`) }), '', 1800);
    this.later(2.6, () => { this.done = true; });
  }

  hud() {
    const pct = THREE.MathUtils.clamp(50 - (this.offset / WIN) * 50, 0, 100);
    return `<div class="pill"><span style="color:${TEAM_CSS[0]}">${t('ball.team.0')}</span> <span class="tug-bar"><span style="width:${pct.toFixed(0)}%"></span></span> <span style="color:${TEAM_CSS[1]}">${t('ball.team.1')}</span></div>${clock(TIME - this.t)}`;
  }

  score(p) {
    const e = this.ents.find((x) => x.p === p);
    return e.team === this.winner ? 1 : 0;
  }

  detail(p) {
    const e = this.ents.find((x) => x.p === p);
    return t(`ball.team.${e.team}`);
  }
}
