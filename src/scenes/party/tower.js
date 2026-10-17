import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Round, clock } from './common.js';
import { COLORS, toon } from '../../core/palette.js';
import { makeTree, makeCloud, seeded } from '../../core/world.js';
import { t } from '../../core/i18n.js';

// Bean Tower: take turns dropping sliding blocks; neat drops build higher.
const H = 0.5; // block height
const BASE = 3;
const TIME = 45;
const TURN = 5;
const PERFECT = 0.15;

export class TowerRound extends Round {
  static key = 'tower';

  constructor(party) {
    super(party);
    this.t = 0;
    this.turn = 0;
    this.turnT = TURN;
    this.falling = [];
    this.build();
    this.stack = [{ x: 0, z: 0, w: BASE, d: BASE, y: 0 }];
    this.ents = this.players.map((p, i) => {
      const ch = this.bean(p);
      const n = this.players.length;
      const a = Math.PI / 4 - 0.9 + (n === 1 ? 0.9 : (i / (n - 1)) * 1.8);
      const x = Math.sin(a) * 4.2, z = Math.cos(a) * 4.2;
      ch.group.position.set(x, 0, z);
      ch.face(-x, -z);
      ch.yaw = ch.targetYaw;
      return { p, ch, blocks: 0, points: 0, perfects: 0 };
    });
    this.camY = 0;
    this.turnTag = this.label('label');
  }

  get title() { return t('tower.title'); }
  get hint() { return t('tower.hint'); }

  build() {
    const g = this.group;
    const ground = new THREE.Mesh(new THREE.CircleGeometry(60, 40), toon(COLORS.grass));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    g.add(ground);
    const base = new THREE.Mesh(new RoundedBoxGeometry(BASE + 0.6, 0.6, BASE + 0.6, 2, 0.12), toon(COLORS.cream));
    base.position.y = -0.3 + 0.001;
    base.receiveShadow = base.castShadow = true;
    g.add(base);
    const rand = seeded(77);
    for (let i = 0; i < 16; i++) {
      const a = rand() * Math.PI * 2;
      const r = 12 + rand() * 10;
      const tr = makeTree(rand, 1.3 + rand() * 0.6);
      tr.position.set(Math.sin(a) * r, 0, Math.cos(a) * r);
      if (tr.position.x > 3 && tr.position.z > 3) continue;
      g.add(tr);
    }
    for (let i = 0; i < 6; i++) {
      const c = makeCloud(rand, 2);
      c.position.set(-20 + i * 8, 10 + i * 3, -16);
      g.add(c);
    }
  }

  frame() {
    this.camDist = this.party.fitDistance(12, 11);
  }

  get top() { return this.stack[this.stack.length - 1]; }
  get active() { return this.ents[this.turn % this.ents.length]; }

  start() {
    this.newBlock();
  }

  newBlock() {
    const top = this.top;
    const e = this.active;
    const axis = this.stack.length % 2 ? 'x' : 'z';
    const geo = new RoundedBoxGeometry(1, H, 1, 2, 0.06);
    const mesh = new THREE.Mesh(geo, toon(e.p.color));
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.scale.set(top.w, 1, top.d);
    this.group.add(mesh);
    this.cur = { axis, mesh, x: top.x, z: top.z, w: top.w, d: top.d, y: top.y + H, phase: -1, dir: 1, owner: e };
    this.cur[axis] = -5;
    this.turnT = TURN;
  }

  drop() {
    const c = this.cur;
    const top = this.top;
    const axis = c.axis;
    const size = axis === 'x' ? 'w' : 'd';
    let delta = c[axis] - top[axis];
    const e = c.owner;
    e.ch.squash(1.35);
    this.cur = null;
    if (Math.abs(delta) < PERFECT) {
      // Perfect: snap into place and grow back a little.
      c[axis] = top[axis];
      delta = 0;
      c[size] = Math.min(BASE, top[size] + 0.12);
      e.points += 2;
      e.perfects++;
      this.game.audio.play('star');
      this.game.ui.toast(t('tower.perfect'), 900);
      this.party.confetti.burst(new THREE.Vector3(c.x, c.y + 0.5, c.z), 0, { count: 20, speed: 4, colors: [e.p.color, COLORS.gold] });
    }
    const overlap = top[size] - Math.abs(delta);
    if (overlap <= 0.05) {
      // Missed: the block tumbles off. No harm done, next player's turn.
      this.falling.push({ mesh: c.mesh, vy: 0, spin: (Math.random() - 0.5) * 4 });
      this.game.audio.play('whoosh');
    } else {
      if (delta !== 0) {
        // Trim the overhang and let the cut piece fall.
        const cut = Math.abs(delta);
        const keepCenter = top[axis] + delta / 2;
        const cutCenter = keepCenter + Math.sign(delta) * (overlap / 2 + cut / 2);
        c[axis] = keepCenter;
        c[size] = overlap;
        const piece = new THREE.Mesh(c.mesh.geometry.clone(), c.mesh.material);
        piece.scale.copy(c.mesh.scale);
        piece.scale[axis] = cut;
        piece.position.set(c.x, c.y, c.z);
        piece.position[axis] = cutCenter;
        this.group.add(piece);
        this.falling.push({ mesh: piece, vy: 0, spin: Math.sign(delta) * 2 });
        e.points += 1;
        this.game.audio.play('land');
      }
      c.mesh.scale.set(c.w, 1, c.d);
      c.mesh.position.set(c.x, c.y, c.z);
      this.stack.push({ x: c.x, z: c.z, w: c.w, d: c.d, y: c.y });
      e.blocks++;
    }
    this.turn++;
    this.newBlock();
  }

  update(dt, playing) {
    this.time += dt;
    const height = this.top.y;
    this.camY += (height - this.camY) * Math.min(1, dt * 2);
    const d = this.camDist;
    this.camera.position.set(d * 0.55, this.camY + d * 0.5, d * 0.65);
    this.camera.lookAt(0, this.camY + 0.8, 0);

    for (const f of this.falling) {
      f.vy -= 20 * dt;
      f.mesh.position.y += f.vy * dt;
      f.mesh.rotation.z += f.spin * dt;
    }
    this.falling = this.falling.filter((f) => {
      if (f.mesh.position.y > -12) return true;
      this.group.remove(f.mesh);
      f.mesh.geometry.dispose();
      return false;
    });

    for (const e of this.ents) {
      const me = this.cur && this.cur.owner === e;
      e.ch.group.position.y = me ? Math.abs(Math.sin(this.time * 6)) * 0.25 : 0;
      e.ch.update(dt, {});
    }

    if (!playing || this.over) return;
    this.t += dt;
    const c = this.cur;
    if (c) {
      const speed = 3.6 + this.stack.length * 0.08;
      c[c.axis] += c.dir * speed * dt;
      if (Math.abs(c[c.axis]) > 5) { c[c.axis] = Math.sign(c[c.axis]) * 5; c.dir *= -1; }
      c.mesh.position.set(c.x, c.y, c.z);
      this.turnT -= dt;
      const d2 = this.input(c.owner.p);
      if (d2.aPressed || this.turnT <= 0) this.drop();
    }
    if (this.cur) {
      this.setLabel(this.turnTag, t('tower.turn', { name: this.cur.owner.p.name }), new THREE.Vector3(this.cur.x, this.cur.y + 1.2, this.cur.z), this.cur.owner.p.css);
    }
    if (this.t >= TIME) {
      this.over = true;
      this.later(2.4, () => { this.done = true; });
      if (this.cur) { this.group.remove(this.cur.mesh); this.cur.mesh.geometry.dispose(); this.cur = null; }
      this.turnTag.style.display = 'none';
      this.game.ui.banner(t('tower.height', { n: this.stack.length - 1 }), '', 1800);
      this.party.confetti.burst(new THREE.Vector3(0, this.top.y + 1, 0), 0, { count: 50, speed: 7, colors: this.players.map((p) => p.color) });
    }
  }

  hud() {
    const who = this.cur ? `<div class="pill" style="color:${this.cur.owner.p.css}"><b>${t('tower.turn', { name: this.cur.owner.p.name })}</b></div>` : '';
    return `<div class="pill"><b>${t('tower.height', { n: this.stack.length - 1 })}</b></div>${who}${clock(TIME - this.t)}`;
  }

  score(p) {
    return this.ents.find((x) => x.p === p).points;
  }

  detail(p) {
    return t('tower.n', { n: this.ents.find((x) => x.p === p).blocks });
  }
}
