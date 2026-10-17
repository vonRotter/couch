import * as THREE from 'three';
import { Round, clock } from './common.js';
import { COLORS, toon, sharedGeo } from '../../core/palette.js';
import { makeTree, makeCloud, makeFlower, seeded } from '../../core/world.js';
import { t } from '../../core/i18n.js';

// Fruit Catch: side view, catch falling fruit in the basket on your head.
const HALF = 12;
const TIME = 35;
const SPEED = 7;
const KINDS = [
  { key: 'apple', color: 0xff3b5c, points: 1, w: 30 },
  { key: 'orange', color: 0xff8c42, points: 1, w: 24 },
  { key: 'pear', color: 0xb5e061, points: 1, w: 20 },
  { key: 'gold', color: 0xffd23f, points: 3, w: 8 },
  { key: 'rotten', color: 0x7d6b3a, points: 0, w: 16 },
];
const TOTAL_W = KINDS.reduce((s, k) => s + k.w, 0);

function pickKind() {
  let r = Math.random() * TOTAL_W;
  for (const k of KINDS) { if ((r -= k.w) < 0) return k; }
  return KINDS[0];
}

export class FruitRound extends Round {
  static key = 'fruit';

  constructor(party) {
    super(party);
    this.build();
    this.t = 0;
    this.spawnT = 0;
    this.fruits = [];
    const bowlMat = toon(0xd99a62).clone();
    bowlMat.side = THREE.DoubleSide;
    bowlMat.userData = {};
    this.ents = this.players.map((p, i) => {
      const ch = this.bean(p);
      const basket = new THREE.Group();
      const bowl = new THREE.Mesh(sharedGeo('basket', () => new THREE.CylinderGeometry(0.55, 0.38, 0.4, 14, 1, true)), bowlMat);
      const rim = new THREE.Mesh(sharedGeo('basketRim', () => new THREE.TorusGeometry(0.55, 0.06, 6, 20)), toon(0xb87a48));
      rim.rotation.x = Math.PI / 2;
      rim.position.y = 0.2;
      basket.add(bowl, rim);
      basket.position.y = 1.55;
      ch.group.add(basket);
      const n = this.players.length;
      return { p, ch, x: (i - (n - 1) / 2) * 2.2, y: 0, vy: 0, grounded: true, slow: 0, points: 0, caught: 0, dir: 1 };
    });
  }

  get title() { return t('fruit.title'); }
  get hint() { return t('fruit.hint'); }

  build() {
    const g = this.group;
    const ground = new THREE.Mesh(new THREE.BoxGeometry(HALF * 2 + 30, 1, 14), toon(COLORS.grass));
    ground.position.set(0, -0.5, -3);
    ground.receiveShadow = true;
    g.add(ground);
    const rand = seeded(44);
    this.trees = [];
    for (let i = 0; i < 7; i++) {
      const tr = makeTree(rand, 2.4);
      tr.position.set(-HALF + (i * HALF * 2) / 6, 0, -4.5);
      g.add(tr);
    }
    for (let i = 0; i < 30; i++) {
      const f = makeFlower(rand);
      f.position.set((rand() - 0.5) * HALF * 2.4, 0, -1 + rand() * 3);
      g.add(f);
    }
    for (let i = 0; i < 4; i++) {
      const c = makeCloud(rand, 2);
      c.position.set(-18 + i * 12, 15 + rand() * 3, -14);
      g.add(c);
    }
  }

  frame() {
    const d = this.party.fitDistance(HALF * 2 + 3, 14);
    this.camera.position.set(0, 6, d + 1);
    this.camera.lookAt(0, 5.5, 0);
  }

  spawn() {
    const kind = pickKind();
    const mat = toon(kind.color);
    const m = new THREE.Group();
    const body = new THREE.Mesh(sharedGeo('fruitBody', () => new THREE.SphereGeometry(0.32, 16, 12)), mat);
    body.castShadow = true;
    if (kind.key === 'pear') body.scale.set(0.9, 1.2, 0.9);
    const stem = new THREE.Mesh(sharedGeo('fruitStem', () => new THREE.CylinderGeometry(0.03, 0.03, 0.18, 5)), toon(COLORS.trunk));
    stem.position.y = 0.36;
    const leaf = new THREE.Mesh(sharedGeo('fruitLeaf', () => new THREE.SphereGeometry(0.1, 8, 6)), toon(kind.key === 'rotten' ? 0x6b6b3a : COLORS.leaf));
    leaf.scale.set(1.4, 0.4, 0.8);
    leaf.position.set(0.1, 0.4, 0);
    m.add(body, stem, leaf);
    if (kind.key === 'gold') {
      const glow = new THREE.Mesh(sharedGeo('fruitGlow', () => new THREE.SphereGeometry(0.5, 12, 10)), toon(COLORS.gold, { transparent: true, opacity: 0.3 }));
      m.add(glow);
    }
    if (kind.key === 'rotten') {
      for (let i = 0; i < 3; i++) {
        const spot = new THREE.Mesh(sharedGeo('rotSpot', () => new THREE.SphereGeometry(0.08, 6, 5)), toon(0x4a3b20));
        const a = i * 2.1;
        spot.position.set(Math.cos(a) * 0.27, (i - 1) * 0.12, Math.sin(a) * 0.27);
        m.add(spot);
      }
    }
    const x = (Math.random() - 0.5) * (HALF * 2 - 2);
    m.position.set(x, 12, 0);
    this.group.add(m);
    this.fruits.push({ m, kind, x, y: 12, vy: -(2.5 + Math.random() * 1.5), spin: (Math.random() - 0.5) * 4 });
  }

  update(dt, playing) {
    this.time += dt;
    if (playing) {
      this.t += dt;
      this.spawnT -= dt;
      const rate = 1.1 + this.players.length * 0.45 + this.t * 0.02;
      if (this.spawnT <= 0 && this.t < TIME - 1) { this.spawn(); this.spawnT = 1 / rate; }
    }
    for (const e of this.ents) {
      const d = playing ? this.input(e.p) : { x: 0, aPressed: false };
      e.slow -= dt;
      const sp = SPEED * (e.slow > 0 ? 0.45 : 1);
      const ix = Math.abs(d.x) > 0.2 ? d.x : 0;
      e.x = THREE.MathUtils.clamp(e.x + ix * sp * dt, -HALF, HALF);
      if (ix) e.dir = Math.sign(ix);
      if (d.aPressed && e.grounded) { e.vy = 10.5; e.grounded = false; e.ch.squash(1.3); this.game.audio.play('jump'); }
      e.vy -= 30 * dt;
      e.y += e.vy * dt;
      if (e.y <= 0) { if (!e.grounded) e.ch.squash(0.8); e.y = 0; e.vy = 0; e.grounded = true; }
      e.ch.faceSide(e.dir);
      e.ch.spin = e.slow > 0 ? Math.sin(this.time * 20) * 0.3 : 0;
      e.ch.group.position.set(e.x, e.y, 0);
      e.ch.update(dt, { moving: ix ? 1 : 0, grounded: e.grounded, vy: e.vy });
    }
    for (const f of this.fruits) {
      f.vy -= 6 * dt;
      f.y += f.vy * dt;
      f.m.position.y = f.y;
      f.m.rotation.z += f.spin * dt;
      for (const e of this.ents) {
        const top = e.y + 1.75;
        if (Math.abs(f.x - e.x) < 0.75 && f.y < top + 0.35 && f.y > top - 0.45) {
          f.gone = true;
          if (f.kind.key === 'rotten') {
            e.slow = 1.5;
            this.game.audio.play('splat');
            this.party.puffs.burst(new THREE.Vector3(f.x, f.y, 0.3), 0x9a8a50, { count: 10, size: 0.3, life: 0.5 });
          } else {
            e.points += f.kind.points;
            e.caught++;
            e.ch.squash(1.2);
            this.game.audio.play(f.kind.points > 1 ? 'star' : 'coin');
            this.party.confetti.burst(new THREE.Vector3(f.x, f.y, 0.3), 0, { count: f.kind.points > 1 ? 24 : 8, speed: 4, colors: [f.kind.color, COLORS.white], life: 0.8 });
          }
          break;
        }
      }
      if (!f.gone && f.y < 0.3) {
        f.gone = true;
        this.party.puffs.burst(new THREE.Vector3(f.x, 0.3, 0), f.kind.color, { count: 6, size: 0.25, life: 0.4 });
      }
    }
    this.fruits = this.fruits.filter((f) => {
      if (f.gone) this.group.remove(f.m);
      return !f.gone;
    });
    if (playing && this.t >= TIME && !this.fruits.length) this.done = true;
  }

  hud() {
    return clock(TIME - this.t);
  }

  score(p) {
    return this.ents.find((x) => x.p === p).points;
  }

  detail(p) {
    return t('fruit.n', { n: this.score(p) });
  }
}
