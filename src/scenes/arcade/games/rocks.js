import * as THREE from 'three';
import { t } from '../../../core/i18n.js';
import { markA11y } from '../../../core/outline.js';
import { aimAt, homeToward } from '../../../core/assist.js';
import { faceted } from '../../../core/palette.js';
import { M, SPH, CONE, CYL, BOX, toon, basic } from './util.js';

// Rock Patrol (a space-rock shooter): Pip's little three-cornered rocket keeps the space lanes clear of drifting
// rocks. Big rocks break into two smaller ones when zapped, the small ones into dust. The field wraps around:
// fly off one side and you come back on the other. The rocket drifts on after you stop pushing (momentum), so
// steering is turning, then a push, then letting it glide. Teaches aiming and steering with momentum.
// Stick left/right (or arrows) turns, [A] or stick up pushes (a held button: hold to toggle works), [B] zaps.
// Three rockets; after a bump a bubble keeps you safe for a moment.
// Help me play: game speed; forgiving timing makes the rocket's bump smaller and the bubble longer; aim help
// bends zaps toward rocks in front (a lot: the zaps curve too). Puzzle: clear the rocks (no game over).

const W = 24, H = 15;
const SIZES = { 3: { r: 1.25, pts: 20, sp: 1.6 }, 2: { r: 0.78, pts: 50, sp: 2.3 }, 1: { r: 0.45, pts: 100, sp: 3.0 } };
const ROCK_GEO = {};
const rockGeo = (s) => (ROCK_GEO[s] ||= (() => { const g = faceted(new THREE.IcosahedronGeometry(SIZES[s].r, 0)); g.userData.shared = true; return g; })());
const wrap = (v, L) => ((v + L / 2) % L + L) % L - L / 2;

export class RocksGame {
  constructor(kit) {
    this.kit = kit;
    this.puzzle = kit.puzzle;
    this.w = W; this.h = H;
    const root = kit.root;
    root.add(M(BOX(W, 0.1, H), 0x1b1640, 0, -0.1, 0));
    const r = kit.rng;
    for (let i = 0; i < 70; i++) root.add(M(SPH(0.04 + r() * 0.05, 6, 4), basic(0xfff4b8), (r() - 0.5) * W, 0, (r() - 0.5) * H));
    // the rocket: a flat three-cornered ship with a window and a flame
    const ship = new THREE.Group();
    const hull = M(CONE(0.5, 1.3, 3), kit.p?.color ?? 0xffffff);
    hull.rotation.x = Math.PI / 2;
    hull.rotation.y = Math.PI;
    hull.scale.set(1, 1, 0.45);
    ship.add(hull, M(SPH(0.18, 10, 8), 0x8fd8ff, 0, 0.18, 0.05));
    this.flame = M(CONE(0.22, 0.6, 8), toon(0xff9f1c, { emissive: 0x804000 }), 0, 0, -0.85);
    this.flame.rotation.x = -Math.PI / 2;
    ship.add(this.flame);
    this.bubble = new THREE.Mesh(new THREE.SphereGeometry(1.0, 16, 12), new THREE.MeshBasicMaterial({ color: 0x8fd8ff, transparent: true, opacity: 0.25, depthWrite: false }));
    ship.add(this.bubble);
    markA11y(ship, 'player', [hull]);
    ship.scale.setScalar(1.3);
    root.add(ship);
    this.ship = ship;
    this.rockG = new THREE.Group();
    root.add(this.rockG);
    this.shotG = new THREE.Group();
    root.add(this.shotG);
    this.livesM = [];
    for (let i = 0; i < 3; i++) { const l = M(CONE(0.2, 0.45, 3), kit.p?.color ?? 0xffffff, -W / 2 + 0.6 + i * 0.6, 0.1, -H / 2 + 0.6); l.rotation.x = -Math.PI / 2; this.livesM.push(l); root.add(l); }
    this.reset();
  }

  get holdButtons() { return ['a']; }

  reset() {
    this.s = { x: 0, z: 0, vx: 0, vz: 0, a: Math.PI };
    this.lives = 3;
    this.score = 0;
    this.wave = 0;
    this.waves = 0;
    this.state = 'play';
    this.safe = 2;
    this.misses = 0;
    this.shots = [];
    this.rockG.clear();
    this.rocks = [];
    this.fireT = 0;
    this.nextWave();
  }

  nextWave() {
    this.wave++;
    const n = this.puzzle ? (this.puzzle.goal?.rocks || 3) : 2 + this.wave;
    for (let i = 0; i < n; i++) {
      let x, z;
      do { x = (this.kit.rng() - 0.5) * W; z = (this.kit.rng() - 0.5) * H; } while (Math.hypot(x - this.s.x, z - this.s.z) < 6);
      this.addRock(3, x, z, this.kit.rng() * Math.PI * 2);
    }
  }

  addRock(size, x, z, ang) {
    const S = SIZES[size];
    const sp = S.sp * (0.8 + this.kit.rng() * 0.4) * (1 + Math.min(0.5, (this.wave - 1) * 0.08));
    const m = new THREE.Mesh(rockGeo(size), toon([0x9a8fc0, 0xb39ad8, 0x8a7ab8][size - 1]));
    markA11y(m, 'target');
    this.rockG.add(m);
    this.rocks.push({ size, x, z, vx: Math.cos(ang) * sp, vz: Math.sin(ang) * sp, r: S.r, m, spin: (this.kit.rng() - 0.5) * 2 });
  }

  update(dt, I) {
    const s = this.s;
    // turning, pushing, zapping
    if (Math.abs(I.x) > 0.25) { s.a -= I.x * 3.6 * dt; this.kit.did('turn'); }
    const push = I.a || I.y > 0.5;
    if (push) { s.vx += Math.sin(s.a) * 11 * dt; s.vz += Math.cos(s.a) * 11 * dt; this.kit.did('push'); }
    const sp = Math.hypot(s.vx, s.vz);
    if (sp > 9) { s.vx *= 9 / sp; s.vz *= 9 / sp; }
    const drag = Math.exp(-0.55 * dt);
    s.vx *= drag; s.vz *= drag;
    s.x = wrap(s.x + s.vx * dt, W);
    s.z = wrap(s.z + s.vz * dt, H);
    this.fireT -= dt;
    if (I.bPressed || (I.b && this.fireT <= -0.2)) this.fire();
    if (this.safe > 0) this.safe -= dt;
    // zaps
    const lv = this.kit.aim();
    for (const b of this.shots) {
      if (lv >= 2) { const v = { x: b.vx, y: b.vz }; homeToward({ x: b.x, y: b.z }, v, this.rocks.map((r) => ({ x: r.x, y: r.z })), lv, dt, { range: 6 }); b.vx = v.x; b.vz = v.y; }
      b.x = wrap(b.x + b.vx * dt, W);
      b.z = wrap(b.z + b.vz * dt, H);
      b.life -= dt;
      for (const r of this.rocks) {
        if (r.dead || Math.hypot(b.x - r.x, b.z - r.z) > r.r + 0.15) continue;
        b.life = 0;
        b.hit = true;
        this.breakRock(r);
        break;
      }
      if (b.life <= 0) { b.m.removeFromParent(); if (!b.hit) this.miss(); }
    }
    this.shots = this.shots.filter((b) => b.life > 0);
    // rocks
    for (const r of this.rocks) {
      r.x = wrap(r.x + r.vx * dt, W);
      r.z = wrap(r.z + r.vz * dt, H);
      r.m.rotation.x += r.spin * dt;
      r.m.rotation.y += r.spin * 0.7 * dt;
      const hitR = 0.5 * (this.kit.timing() > 1 ? 0.7 : 1);
      if (this.safe <= 0 && Math.hypot(s.x - r.x, s.z - r.z) < r.r + hitR) this.bumped();
    }
    this.rocks = this.rocks.filter((r) => !r.dead);
    if (!this.rocks.length && this.state === 'play') {
      this.waves++;
      this.kit.did('wave');
      if (this.puzzle) { this.state = 'won'; return; }
      this.kit.sfx('fanfare');
      this.score += 200;
      this.nextWave();
    }
    this.draw(dt, push);
  }

  fire() {
    if (this.shots.length >= 6) return;
    this.fireT = 0.25;
    const s = this.s;
    let dir = { x: Math.sin(s.a), y: Math.cos(s.a) };
    dir = aimAt({ x: s.x, y: s.z }, dir, this.rocks.map((r) => ({ x: r.x, y: r.z })), this.kit.aim(), { maxDist: 12 });
    const L = Math.hypot(dir.x, dir.y) || 1;
    const m = M(SPH(0.13, 8, 6), basic(0xfff07a));
    this.shotG.add(m);
    this.shots.push({ x: s.x + dir.x / L * 0.7, z: s.z + dir.y / L * 0.7, vx: dir.x / L * 15 + s.vx * 0.3, vz: dir.y / L * 15 + s.vz * 0.3, life: 0.85, m });
    this.kit.tone(88, 0.06, { type: 'square', vol: 0.04, slide: 0.5 });
    this.kit.did('fire');
  }

  miss() {
    this.misses++;
    if (this.misses >= 8) { this.misses = 0; this.kit.fail('aim'); }
  }

  breakRock(r) {
    r.dead = true;
    r.m.removeFromParent();
    this.misses = 0;
    this.score += SIZES[r.size].pts;
    this.kit.puff(r.x, r.z, 0xd8ccf0, { count: 8 + r.size * 4, speed: 3 + r.size, size: 0.25 });
    this.kit.tone(60 - r.size * 5, 0.15, { type: 'triangle', vol: 0.14, slide: 0.6 });
    if (r.size > 1) {
      const base = Math.atan2(r.vz, r.vx);
      for (const k of [-0.7, 0.7]) this.addRock(r.size - 1, r.x, r.z, base + k + (this.kit.rng() - 0.5) * 0.4);
    }
  }

  bumped() {
    this.kit.sfx('bump');
    this.kit.shake(0.7);
    this.kit.puff(this.s.x, this.s.z, 0xffffff, { count: 20, speed: 5 });
    this.kit.fail('timing');
    this.safe = 2.2 * this.kit.timing();
    this.s.vx = 0; this.s.vz = 0;
    this.s.x = 0; this.s.z = 0;
    if (this.puzzle) return;
    this.lives--;
    if (this.lives <= 0) this.state = 'over';
  }

  draw(dt, push = false) {
    const s = this.s;
    this.ship.position.set(s.x, 0.3, s.z);
    this.ship.rotation.y = s.a;
    this.flame.visible = push;
    this.flame.scale.setScalar(0.8 + Math.random() * 0.3);
    this.bubble.visible = this.safe > 0;
    for (const r of this.rocks) r.m.position.set(r.x, 0.3, r.z);
    for (const b of this.shots) b.m.position.set(b.x, 0.3, b.z);
    this.livesM.forEach((l, i) => { l.visible = !this.puzzle && i < this.lives; });
  }

  idle(dt) { this.draw(dt); }

  hud() { return this.puzzle ? [[t('arc.rocks.left'), this.rocks.length]] : [[t('arc.score'), this.score], [t('arc.rocks.wave'), this.wave]]; }
  goalText() { return t('arc.rocks.goal'); }
  keys() { return 'arc.rocks.keys'; }
  poorGame() { return this.waves < 1; }

  steps() {
    return [
      { key: 'arc.rocks.t1', on: 'turn' },
      { key: 'arc.rocks.t2', on: 'push' },
      { key: 'arc.rocks.t3', on: 'fire' },
      { key: 'arc.rocks.t4', time: 5 },
    ];
  }

  stats() {
    const w = this.waves;
    return { mastery: [1, 2, 3].filter((n) => w >= n).map((n) => `wave${n}`), trials: w >= 2 ? ['rocks.wave'] : [] };
  }
}
