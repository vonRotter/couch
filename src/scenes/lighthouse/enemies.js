import * as THREE from 'three';
import { COLORS, toon, sharedGeo } from '../../core/palette.js';
import { makeGrumble } from '../../core/critters.js';
import { box, cyl, sph, cone, mesh } from './models.js';

// Enemies and bosses of Lighthouse Caves. Every one has a simple pattern you can read:
//   blob      hops toward you; squashes before every hop
//   crab      scuttles in straight lines, pauses, turns
//   brute     shows "!" and crouches when you line up with it, then charges until it hits a wall
//             (and gets dizzy: free hits)
//   spitter   turns to you, puffs up, spits a pebble straight ahead (your sword knocks pebbles away)
//   bat       sleeps until you come close, then flutters at you for a while
//   shellback carries a shell shield in front: hit it from the side or the back (the rope stuns it)
// Bosses: bigblob (splits in two, twice), moth (only lands on lit torches: hit it there), bigshell
// (charges, gets stuck in the wall, hit its back), crab king (claws slam where their shadow is;
// then it hides in its shell: rope its face out and hit it).
//
// Positions are room-local tiles (x, z). Meshes live in the room's group.

const shadowGeo = () => sharedGeo('lh-shadow', () => new THREE.CircleGeometry(0.5, 20));
export const shadowMat = () => toon(0x000000, { transparent: true, opacity: 0.28 });
export const markGeo = () => sharedGeo('lh-mark', () => new THREE.RingGeometry(0.35, 0.5, 24));
export const markMat = () => toon(0xff3b5c, { transparent: true, opacity: 0.75 });

export function makeShadow(s = 1) {
  const m = new THREE.Mesh(shadowGeo(), shadowMat());
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.02;
  m.scale.setScalar(s);
  return m;
}

/** A red "!" that pops up over an enemy that is about to attack. */
export function makeAlert() {
  const g = new THREE.Group();
  g.add(mesh(box(0.13, 0.38, 0.13), toon(0xff3b5c, { emissive: 0x551122 }), 0, 0.26, 0, false));
  g.add(mesh(sph(0.08, 8, 6), toon(0xff3b5c, { emissive: 0x551122 }), 0, -0.05, 0, false));
  g.visible = false;
  return g;
}

export function makeDizzy() {
  const g = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const s = mesh(sph(0.07, 8, 6), toon(COLORS.gold, { emissive: 0x554400 }), Math.cos(i * 2.1) * 0.35, 0, Math.sin(i * 2.1) * 0.35, false);
    g.add(s);
  }
  g.visible = false;
  return g;
}

export const DIR_V = { n: [0, -1], s: [0, 1], w: [-1, 0], e: [1, 0] };
const YAW = { s: 0, e: Math.PI / 2, n: Math.PI, w: -Math.PI / 2 };
export const cardinal = (dx, dz) => (Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? 'e' : 'w') : dz > 0 ? 's' : 'n');

export class Enemy {
  constructor(eng, x, z) {
    this.eng = eng;
    this.x = x;
    this.z = z;
    this.y = 0;
    this.r = 0.36;
    this.hp = 1;
    this.dmg = 1;
    this.face = 's';
    this.t = 0;
    this.state = 'idle';
    this.kb = { x: 0, z: 0, t: 0 };
    this.flash = 0;
    this.stun = 0;
    this.dead = false;
    this.fly = false;
    this.boss = false;
    this.bossPart = false;
    this.touch = true;
    this.pullable = false;
    this.group = new THREE.Group();
    this.body = new THREE.Group();
    this.group.add(this.body);
    this.dizzy = makeDizzy();
    this.dizzy.position.y = 0.95;
    this.group.add(this.dizzy);
  }

  get hero() { return this.eng.hero; }
  toHero() { return { dx: this.hero.x - this.x, dz: this.hero.z - this.z, d: Math.hypot(this.hero.x - this.x, this.hero.z - this.z) }; }

  /** Hit circles for the sword / rope: [{ x, z, r, part }]. */
  parts() { return [{ x: this.x, z: this.z, r: this.r, part: 'body' }]; }

  update(dt) {
    this.t += dt;
    if (this.flash > 0) this.flash -= dt;
    if (this.kb.t > 0) {
      this.kb.t -= dt;
      this.eng.moveBody(this, this.kb.x * dt, this.kb.z * dt);
    } else if (this.stun > 0) {
      this.stun -= dt;
      this.dizzy.visible = true;
      this.dizzy.rotation.y += dt * 6;
    } else {
      this.dizzy.visible = false;
      this.think(dt);
    }
    if (!this.fly && !this.dead && this.eng.overHole(this.x, this.z)) this.fallIn();
    this.sync(dt);
  }

  think() {}

  sync() {
    this.group.position.set(this.x, this.y, this.z);
    this.body.rotation.y += ((YAW[this.face] - this.body.rotation.y + Math.PI * 3) % (Math.PI * 2) - Math.PI) * 0.25;
    this.group.visible = this.flash > 0 ? Math.floor(this.flash * 20) % 2 === 0 : true;
  }

  /** Returns 'hit', 'clang' or 'none'. src: sword | spin | pot | rock | flame | rope. */
  hurt(dmg, sx, sz, src) {
    if (this.dead || this.flash > 0) return 'none';
    if (src === 'rope') {
      if (this.pullable) { this.hp -= 1; } else { this.stun = 2.2; this.flash = 0.2; this.eng.sfx('hit'); return 'hit'; }
    } else {
      this.hp -= dmg;
    }
    this.flash = 0.35;
    const d = Math.hypot(this.x - sx, this.z - sz) || 1;
    this.kb = { x: ((this.x - sx) / d) * 9, z: ((this.z - sz) / d) * 9, t: 0.16 };
    this.eng.sfx('hit');
    if (this.hp <= 0) this.die();
    return 'hit';
  }

  die() {
    this.dead = true;
    this.eng.poof(this.x, this.z, this.y);
    this.eng.dropLoot(this.x, this.z, this);
  }

  fallIn() {
    this.dead = true;
    this.eng.sfx('fall');
    this.eng.poof(this.x, this.z, -0.3);
  }

  move(dx, dz) { return this.eng.moveBody(this, dx, dz); }
}

// ---------- regular enemies ----------

class Blob extends Enemy {
  constructor(eng, x, z, size = 1) {
    super(eng, x, z);
    this.size = size;
    this.hp = size === 1 ? 1 : size === 2 ? 2 : 6;
    this.r = 0.32 * size;
    this.dmg = size === 3 ? 2 : 1;
    const col = size === 3 ? 0x3fbf6a : 0x5ee07a;
    this.jelly = mesh(sph(0.4, 16, 12), toon(col, { transparent: true, opacity: 0.85 }), 0, 0.34, 0);
    this.body.add(this.jelly);
    this.body.add(mesh(sph(0.16, 10, 8), toon(0x2f8f4a), 0, 0.25, 0));
    for (const s of [-1, 1]) this.body.add(mesh(sph(0.07, 8, 6), toon(COLORS.ink), s * 0.13, 0.45, 0.33));
    this.body.scale.setScalar(size === 3 ? 2.2 : size === 2 ? 1.45 : 1);
    this.wait = 0.6 + Math.random() * 0.8;
    this.state = 'wait';
    if (size === 3) {
      this.mark = new THREE.Mesh(markGeo(), markMat());
      this.mark.rotation.x = -Math.PI / 2;
      this.mark.position.y = 0.03;
      this.mark.visible = false;
      eng.room.group.add(this.mark);
    }
  }

  think(dt) {
    if (this.state === 'wait') {
      this.wait -= dt;
      const telegraph = this.size === 3 ? 0.55 : 0.3;
      const sq = this.wait < telegraph ? 1 - 0.35 * (1 - this.wait / telegraph) : 1;
      this.body.scale.y = this.body.scale.x * sq;
      if (this.wait < telegraph && this.mark && !this.mark.visible) {
        const { dx, dz, d } = this.toHero();
        const hop = Math.min(d, 2.6);
        this.target = { x: this.x + (dx / (d || 1)) * hop, z: this.z + (dz / (d || 1)) * hop };
        this.mark.visible = true;
        this.mark.position.set(this.target.x, 0.03, this.target.z);
        this.mark.scale.setScalar(2.2);
      }
      if (this.wait <= 0) {
        const { dx, dz, d } = this.toHero();
        const hop = this.size === 3 ? Math.min(d, 2.6) : 1.25;
        if (!this.target) this.target = { x: this.x + (dx / (d || 1)) * hop, z: this.z + (dz / (d || 1)) * hop };
        this.from = { x: this.x, z: this.z };
        this.face = cardinal(dx, dz);
        this.state = 'hop';
        this.hopT = 0;
        this.body.scale.y = this.body.scale.x;
      }
    } else if (this.state === 'hop') {
      const dur = this.size === 3 ? 0.55 : 0.35;
      this.hopT += dt;
      const p = Math.min(1, this.hopT / dur);
      const nx = this.from.x + (this.target.x - this.from.x) * p;
      const nz = this.from.z + (this.target.z - this.from.z) * p;
      this.move(nx - this.x, nz - this.z);
      this.y = Math.sin(p * Math.PI) * (this.size === 3 ? 1.2 : 0.45);
      if (p >= 1) {
        this.y = 0;
        this.state = 'wait';
        this.target = null;
        this.wait = (this.size === 3 ? 1.1 : 0.7) + Math.random() * 0.7;
        if (this.mark) {
          this.mark.visible = false;
          this.eng.sfx('slam');
          this.eng.shake(0.2);
          this.eng.puffAt(this.x, this.z, 0x9ff0c8, 10);
          if (this.toHero().d < 1.6) this.eng.hurtHero(1, this.x, this.z);
        }
      }
    }
    if (this.mark?.visible) this.mark.scale.setScalar(Math.max(1, this.mark.scale.x - dt * 2));
  }

  die() {
    super.die();
    this.mark?.parent?.remove(this.mark);
    if (this.size > 1) {
      for (const s of [-1, 1]) {
        const b = new Blob(this.eng, this.x + s * 0.5, this.z, this.size - 1);
        b.bossPart = this.bossPart;
        b.flash = 0.5;
        this.eng.addEnemy(b);
      }
    }
  }
}

class Crab extends Enemy {
  constructor(eng, x, z) {
    super(eng, x, z);
    this.hp = eng.area === 'd2' ? 3 : 2;
    const red = 0xff6b5c;
    const shell = mesh(sph(0.36, 14, 10), toon(red), 0, 0.3, 0);
    shell.scale.set(1.2, 0.65, 0.9);
    this.body.add(shell);
    for (const s of [-1, 1]) {
      this.body.add(mesh(sph(0.15, 10, 8), toon(0xff8f80), s * 0.48, 0.28, 0.18));
      this.body.add(mesh(cyl(0.03, 0.03, 0.22, 6), toon(red), s * 0.12, 0.5, 0.2));
      this.body.add(mesh(sph(0.07, 8, 6), toon(COLORS.white), s * 0.12, 0.63, 0.2));
      this.body.add(mesh(sph(0.035, 6, 5), toon(COLORS.ink), s * 0.12, 0.64, 0.26));
      for (let i = 0; i < 3; i++) this.body.add(mesh(box(0.22, 0.04, 0.05), toon(0xd94a3c), s * 0.4, 0.12, -0.15 + i * 0.12));
    }
    this.pick();
  }

  pick() {
    const dirs = ['n', 's', 'e', 'w'];
    const { dx, dz } = this.toHero();
    this.face = Math.random() < 0.4 ? cardinal(dx, dz) : dirs[Math.floor(Math.random() * 4)];
    this.walk = 1 + Math.random() * 1.5;
    this.state = 'walk';
  }

  think(dt) {
    if (this.state === 'walk') {
      const [vx, vz] = DIR_V[this.face];
      const sp = 2.1;
      const hit = this.move(vx * sp * dt, vz * sp * dt);
      this.walk -= dt;
      this.body.position.y = Math.abs(Math.sin(this.t * 14)) * 0.05;
      if (this.walk <= 0 || hit.x || hit.z) { this.state = 'pause'; this.walk = 0.5 + Math.random() * 0.4; }
    } else {
      this.walk -= dt;
      if (this.walk <= 0) this.pick();
    }
  }
}

class Brute extends Enemy {
  constructor(eng, x, z) {
    super(eng, x, z);
    this.hp = 3;
    this.dmg = 2;
    this.r = 0.42;
    const g = makeGrumble(0xd2557a);
    g.scale.setScalar(1.25);
    this.body.add(g);
    this.club = mesh(cyl(0.07, 0.12, 0.7, 7), toon(0x8a5a3a), 0.55, 0.55, 0.1);
    this.club.rotation.z = -0.5;
    this.body.add(this.club);
    this.alert = makeAlert();
    this.alert.position.y = 1.6;
    this.group.add(this.alert);
    this.state = 'wander';
    this.wt = 1;
  }

  think(dt) {
    const { dx, dz, d } = this.toHero();
    this.alert.visible = this.state === 'alert';
    if (this.state === 'wander') {
      this.wt -= dt;
      if (this.wt <= 0) { this.face = ['n', 's', 'e', 'w'][Math.floor(Math.random() * 4)]; this.wt = 1 + Math.random(); }
      const [vx, vz] = DIR_V[this.face];
      this.move(vx * 1.1 * dt, vz * 1.1 * dt);
      const lined = (Math.abs(dx) < 0.45 || Math.abs(dz) < 0.45) && d < 7.5 && this.eng.lineClear(this.x, this.z, this.hero.x, this.hero.z);
      if (lined && this.t > 0.8) { this.face = cardinal(dx, dz); this.state = 'alert'; this.st = 0.6; this.eng.sfx('beep'); }
    } else if (this.state === 'alert') {
      this.st -= dt;
      this.body.scale.y = 0.8;
      if (this.st <= 0) { this.state = 'charge'; this.body.scale.y = 1; this.eng.sfx('dash'); }
    } else if (this.state === 'charge') {
      const [vx, vz] = DIR_V[this.face];
      const hit = this.move(vx * 7 * dt, vz * 7 * dt);
      if (hit.x || hit.z) {
        this.state = 'wander';
        this.stun = 1.6;
        this.eng.sfx('bump');
        this.eng.shake(0.12);
        this.t = 0;
      }
    }
  }
}

class Spitter extends Enemy {
  constructor(eng, x, z) {
    super(eng, x, z);
    this.hp = 2;
    const col = 0x4cc9f0;
    this.ball = mesh(sph(0.36, 14, 10), toon(col), 0, 0.36, 0);
    this.body.add(this.ball);
    const snout = mesh(cyl(0.12, 0.15, 0.3, 10), toon(0x2fa6d8), 0, 0.34, 0.38);
    snout.rotation.x = Math.PI / 2;
    this.body.add(snout);
    this.body.add(mesh(cyl(0.08, 0.08, 0.02, 10), toon(COLORS.ink), 0, 0.34, 0.54));
    this.body.children[2].rotation.x = Math.PI / 2;
    for (const s of [-1, 1]) this.body.add(mesh(sph(0.08, 8, 6), toon(COLORS.white), s * 0.16, 0.55, 0.22), mesh(sph(0.04, 6, 5), toon(COLORS.ink), s * 0.16, 0.56, 0.29));
    this.state = 'walk';
    this.st = 1;
    this.cool = 1 + Math.random();
  }

  think(dt) {
    const { dx, dz } = this.toHero();
    this.cool -= dt;
    if (this.state === 'walk') {
      this.st -= dt;
      const [vx, vz] = DIR_V[this.face];
      const hit = this.move(vx * 1.2 * dt, vz * 1.2 * dt);
      if (hit.x || hit.z || this.st <= 0) {
        const lined = Math.abs(dx) < 0.6 || Math.abs(dz) < 0.6;
        if (this.cool <= 0 && (lined || Math.random() < 0.4)) {
          this.face = cardinal(dx, dz);
          this.state = 'aim';
          this.st = 0.7;
        } else {
          this.face = ['n', 's', 'e', 'w'][Math.floor(Math.random() * 4)];
          this.st = 0.6 + Math.random();
        }
      }
    } else if (this.state === 'aim') {
      this.st -= dt;
      const p = 1 - this.st / 0.7;
      this.ball.scale.setScalar(1 + p * 0.35 + Math.sin(this.t * 40) * 0.03 * p);
      if (this.st <= 0) {
        this.ball.scale.setScalar(1);
        const [vx, vz] = DIR_V[this.face];
        this.eng.addProjectile(new Pebble(this.eng, this.x + vx * 0.5, this.z + vz * 0.5, vx * 6, vz * 6));
        this.eng.sfx('shoot');
        this.state = 'walk';
        this.st = 0.8 + Math.random();
        this.cool = 1.5;
      }
    }
  }
}

class Bat extends Enemy {
  constructor(eng, x, z) {
    super(eng, x, z);
    this.hp = 1;
    this.fly = true;
    this.pullable = true;
    this.r = 0.3;
    this.body.add(mesh(sph(0.22, 12, 8), toon(0x5a3f7a), 0, 0, 0));
    for (const s of [-1, 1]) {
      this.body.add(mesh(sph(0.06, 8, 6), toon(0xffe27a, { emissive: 0x886600 }), s * 0.08, 0.06, 0.18, false));
      this.body.add(mesh(cone(0.06, 0.14, 4), toon(0x5a3f7a), s * 0.12, 0.22, 0));
    }
    this.wings = [];
    for (const s of [-1, 1]) {
      const w = new THREE.Group();
      w.position.x = s * 0.18;
      const m = mesh(box(0.45, 0.03, 0.3), toon(0x7b5aa6), s * 0.22, 0, 0);
      w.add(m);
      this.body.add(w);
      this.wings.push(w);
    }
    this.shadow = makeShadow(0.6);
    this.group.add(this.shadow);
    this.state = 'perch';
    this.y = 1.2;
    this.st = 0;
  }

  think(dt) {
    const { dx, dz, d } = this.toHero();
    const flap = this.state === 'perch' ? 2 : 18;
    this.wings.forEach((w, i) => { w.rotation.z = Math.sin(this.t * flap) * 0.7 * (i ? -1 : 1); });
    if (this.state === 'perch') {
      this.y = 1.2;
      if (d < 4.5 && this.t > 0.4) { this.state = 'flutter'; this.st = 3; this.eng.sfx('whoosh'); }
    } else if (this.state === 'flutter') {
      this.st -= dt;
      const sp = 3.3;
      const wob = Math.sin(this.t * 5) * 1.6;
      const vx = (dx / (d || 1)) * sp + (-dz / (d || 1)) * wob;
      const vz = (dz / (d || 1)) * sp + (dx / (d || 1)) * wob;
      this.move(vx * dt, vz * dt);
      this.y = 0.55 + Math.sin(this.t * 6) * 0.15;
      if (this.st <= 0) { this.state = 'rest'; this.st = 1.1; this.dir = Math.random() * 6.28; }
    } else {
      this.st -= dt;
      this.move(Math.cos(this.dir) * 1.2 * dt, Math.sin(this.dir) * 1.2 * dt);
      this.y = Math.min(1.2, this.y + dt);
      if (this.st <= 0) { this.state = 'flutter'; this.st = 2.6; }
    }
    this.touch = this.y < 0.9;
    this.shadow.position.y = 0.02 - this.y;
  }
}

class Shellback extends Enemy {
  constructor(eng, x, z, big = false) {
    super(eng, x, z);
    this.big = big;
    this.hp = big ? 4 : 3;
    this.dmg = 2;
    this.r = big ? 0.8 : 0.4;
    const s = big ? 2.0 : 1;
    const g = new THREE.Group();
    g.add(mesh(sph(0.34, 14, 10), toon(0x6fbf73), 0, 0.42, 0));
    for (const sx of [-1, 1]) g.add(mesh(sph(0.08, 8, 6), toon(COLORS.white), sx * 0.13, 0.62, 0.24), mesh(sph(0.04, 6, 5), toon(COLORS.ink), sx * 0.13, 0.63, 0.3));
    const back = mesh(sph(0.38, 14, 10), toon(0xd9a877), 0, 0.45, -0.14);
    back.scale.set(1, 1, 0.8);
    g.add(back);
    // the big shell shield in front
    this.shield = mesh(cyl(0.42, 0.42, 0.1, 16), toon(0xffb3c7), 0, 0.38, 0.36);
    this.shield.rotation.x = Math.PI / 2;
    g.add(this.shield);
    for (let i = -2; i <= 2; i++) {
      const rib = mesh(box(0.04, 0.6, 0.03), toon(COLORS.white), i * 0.13, 0.38, 0.42, false);
      rib.rotation.z = i * 0.2;
      g.add(rib);
    }
    g.scale.setScalar(s);
    this.body.add(g);
    this.dizzy.position.y = big ? 2 : 1;
    this.alert = makeAlert();
    this.alert.position.y = big ? 2.3 : 1.3;
    this.group.add(this.alert);
    this.state = 'turn';
    this.st = 0.8;
    this.boss = big;
  }

  think(dt) {
    const { dx, dz, d } = this.toHero();
    this.alert.visible = this.state === 'alert';
    this.shield.visible = true;
    if (this.state === 'turn') {
      this.st -= dt;
      if (this.st <= 0) {
        this.face = cardinal(dx, dz);
        this.st = this.big ? 0.9 : 0.8;
        if (this.big) { this.state = 'alert'; this.st = d < 4 ? 0.6 : 0.8; this.eng.sfx('roar'); }
      }
      if (!this.big) {
        const [vx, vz] = DIR_V[this.face];
        this.move(vx * 1.4 * dt, vz * 1.4 * dt);
      }
    } else if (this.state === 'alert') {
      this.st -= dt;
      this.body.position.y = Math.abs(Math.sin(this.t * 30)) * 0.08;
      if (this.st <= 0) { this.state = 'charge'; this.body.position.y = 0; this.eng.sfx('dash'); }
    } else if (this.state === 'charge') {
      const [vx, vz] = DIR_V[this.face];
      const hit = this.move(vx * 6.5 * dt, vz * 6.5 * dt);
      if (hit.x || hit.z) {
        this.state = 'turn';
        this.st = 0.3;
        this.stun = 2.4;
        this.eng.sfx('slam');
        this.eng.shake(0.25);
      }
    }
  }

  hurt(dmg, sx, sz, src) {
    if (this.dead || this.flash > 0) return 'none';
    if (this.stun <= 0 && (src === 'sword' || src === 'spin' || src === 'flame' || src === 'arrow' || src === 'fire')) {
      // Blocked if the hit comes from in front of the shield.
      const [fx, fz] = DIR_V[this.face];
      const hx = sx - this.x, hz = sz - this.z;
      const hd = Math.hypot(hx, hz) || 1;
      if ((hx * fx + hz * fz) / hd > 0.45) {
        this.eng.sfx('clang');
        this.eng.sparkAt(this.x + fx * this.r, this.z + fz * this.r);
        this.kb = { x: -fx * 3, z: -fz * 3, t: 0.12 };
        return 'clang';
      }
    }
    if (src === 'rope') { this.stun = 2.6; this.flash = 0.2; this.eng.sfx('hit'); return 'hit'; }
    const r = super.hurt(dmg, sx, sz, src);
    if (this.big) this.kb.t = 0.05;
    return r;
  }
}

// ---------- bosses ----------

/** Gloomwing: a big moth that hides in the dark. It cannot resist a lit torch: hit it there. */
class Moth extends Enemy {
  constructor(eng, x, z) {
    super(eng, x, z);
    this.boss = true;
    this.fly = true;
    this.hp = 6;
    this.max = 6;
    this.r = 0.75;
    this.dmg = 2;
    const bodyM = mesh(sph(0.42, 14, 10), toon(0x6b5a8a), 0, 0, 0);
    bodyM.scale.set(0.8, 0.8, 1.4);
    this.body.add(bodyM);
    this.body.add(mesh(sph(0.32, 12, 10), toon(0x7d6aa0), 0, 0.05, 0.55));
    for (const s of [-1, 1]) {
      this.body.add(mesh(sph(0.11, 10, 8), toon(0xfff27a, { emissive: 0xccaa00 }), s * 0.15, 0.15, 0.78, false));
      const ant = mesh(cyl(0.02, 0.02, 0.5, 5), toon(0x4a3f60), s * 0.15, 0.4, 0.75);
      ant.rotation.x = 0.7;
      ant.rotation.z = -s * 0.4;
      this.body.add(ant);
    }
    this.wings = [];
    for (const s of [-1, 1]) {
      for (const fz of [0.25, -0.35]) {
        const w = new THREE.Group();
        w.position.set(s * 0.25, 0.1, fz);
        const m = mesh(sph(0.6, 12, 8), toon(fz > 0 ? 0xb9a6e0 : 0x9a86c6), s * 0.6, 0, 0);
        m.scale.set(1.15, 0.08, fz > 0 ? 0.75 : 0.6);
        w.add(m);
        w.add(mesh(sph(0.14, 8, 6), toon(0xffe27a, { emissive: 0x664400 }), s * 0.75, 0.06, 0, false));
        this.body.add(w);
        this.wings.push({ g: w, s });
      }
    }
    this.shadow = makeShadow(1.6);
    this.group.add(this.shadow);
    this.mark = new THREE.Mesh(markGeo(), markMat());
    this.mark.rotation.x = -Math.PI / 2;
    this.mark.visible = false;
    eng.room.group.add(this.mark);
    this.y = 0.6;
    this.state = 'intro';
    this.st = 1.6;
    this.ang = 0;
    this.attackT = 2.5;
    this.phase = 1;
    this.light = true; // the engine gives it a faint eye glow in the dark
  }

  get vulnerable() { return this.state === 'drawn'; }

  think(dt) {
    const flap = this.state === 'drawn' ? 26 : this.state === 'gustWind' ? 6 : 12;
    for (const w of this.wings) w.g.rotation.z = Math.sin(this.t * flap) * 0.55 * w.s;
    const torches = this.eng.room.torches;
    const lit = torches.filter((tc) => tc.lit);
    this.touch = this.y < 1.1;
    if (this.phase === 1 && this.hp <= this.max / 2) {
      this.phase = 2;
      this.eng.sfx('roar');
      this.eng.addEnemy(makeEnemy(this.eng, 'bat', -3, 0));
      this.eng.addEnemy(makeEnemy(this.eng, 'bat', 3, 0));
    }
    switch (this.state) {
      case 'intro':
        this.st -= dt;
        this.y = Math.min(2.6, this.y + dt * 1.4);
        if (this.st <= 0) { this.state = 'fly'; this.eng.sfx('roar'); }
        break;
      case 'fly': {
        this.ang += dt * (this.phase === 2 ? 0.9 : 0.6);
        const tx = Math.cos(this.ang) * 4.5, tz = Math.sin(this.ang) * 2.2 - 0.5;
        this.x += (tx - this.x) * Math.min(1, dt * 2);
        this.z += (tz - this.z) * Math.min(1, dt * 2);
        this.y += (2.6 - this.y) * Math.min(1, dt * 3);
        this.face = cardinal(tx - this.x, tz - this.z);
        if (lit.length) {
          // the nearest flame pulls it in
          lit.sort((a, b) => Math.hypot(a.x - this.x, a.z - this.z) - Math.hypot(b.x - this.x, b.z - this.z));
          this.torch = lit[0];
          this.state = 'seek';
          this.from = { x: this.x, z: this.z, y: this.y };
          this.st = 0;
          break;
        }
        this.attackT -= dt;
        if (this.attackT <= 0) {
          if (this.phase === 2 && Math.random() < 0.4) { this.state = 'gustUp'; this.st = 0.9; this.eng.sfx('whoosh'); } else {
            this.state = 'mark';
            this.st = this.phase === 2 ? 0.7 : 0.9;
            this.target = { x: this.hero.x, z: this.hero.z };
            this.mark.visible = true;
          }
        }
        break;
      }
      case 'mark':
        this.st -= dt;
        this.mark.position.set(this.target.x, 0.03, this.target.z);
        this.mark.scale.setScalar(1 + this.st * 2.5);
        if (this.st <= 0) { this.state = 'dive'; this.from = { x: this.x, z: this.z, y: this.y }; this.st = 0; this.eng.sfx('dash'); }
        break;
      case 'dive': {
        this.st += dt;
        const p = Math.min(1, this.st / 0.4);
        this.x = this.from.x + (this.target.x - this.from.x) * p;
        this.z = this.from.z + (this.target.z - this.from.z) * p;
        this.y = this.from.y + (0.45 - this.from.y) * p;
        if (p >= 1) { this.mark.visible = false; this.state = 'low'; this.st = 0.5; this.eng.shake(0.1); }
        break;
      }
      case 'low':
        this.st -= dt;
        if (this.st <= 0) { this.state = 'fly'; this.attackT = this.phase === 2 ? 1.8 : 2.8; }
        break;
      case 'seek': {
        this.st += dt;
        const p = Math.min(1, this.st / 1.0);
        const tx = this.torch.x + 0.0, tz = this.torch.z + 0.85;
        this.x = this.from.x + (tx - this.from.x) * p;
        this.z = this.from.z + (tz - this.from.z) * p;
        this.y = this.from.y + (0.75 - this.from.y) * p;
        this.face = 'n';
        if (!this.torch.lit) { this.state = 'fly'; break; }
        if (p >= 1) { this.state = 'drawn'; this.st = this.phase === 2 ? 2.6 : 3.4; this.hits = 0; }
        break;
      }
      case 'drawn':
        this.st -= dt;
        this.x = this.torch.x + Math.sin(this.t * 3) * 0.25;
        if (this.st <= 0 || !this.torch.lit) {
          if (this.torch.lit) this.eng.extinguish(this.torch);
          this.state = 'fly';
          this.attackT = 1.4;
          this.eng.sfx('whoosh');
        }
        break;
      case 'gustUp':
        this.st -= dt;
        for (const w of this.wings) w.g.rotation.z = 0.9 * w.s;
        if (this.st <= 0) { this.state = 'gustWind'; this.st = 1.3; this.eng.sfx('whoosh'); }
        break;
      case 'gustWind': {
        this.st -= dt;
        const { dx, dz, d } = this.toHero();
        this.eng.pushHero((dx / (d || 1)) * 3.4, (dz / (d || 1)) * 3.4);
        if (Math.random() < 0.5) this.eng.windAt(this.x + (Math.random() - 0.5) * 2, this.z + 0.5, dx / (d || 1), dz / (d || 1));
        if (this.st <= 0) { this.state = 'fly'; this.attackT = 2; }
        break;
      }
      default: break;
    }
    this.shadow.position.y = 0.02 - this.y;
    this.shadow.scale.setScalar(1.8 - Math.min(1, this.y / 3) * 0.6);
  }

  hurt(dmg, sx, sz, src) {
    if (this.dead || this.flash > 0) return 'none';
    if (!this.vulnerable) {
      if (this.y < 1.2 && src !== 'rope') { this.eng.sfx('clang'); return 'clang'; }
      return 'none';
    }
    if (src === 'rope') return 'none';
    this.hp -= Math.min(dmg, 2);
    this.flash = 0.45;
    this.eng.sfx('hit');
    this.hits++;
    if (this.hp <= 0) { this.die(); return 'hit'; }
    if (this.hits >= 2) {
      this.eng.extinguish(this.torch);
      this.state = 'fly';
      this.attackT = 1.5;
      this.eng.sfx('roar');
    }
    return 'hit';
  }

  die() {
    this.dead = true;
    this.mark.parent?.remove(this.mark);
    this.eng.bossDown(this);
  }
}

/** King Krabbit: claws slam on their shadows; without claws it hides and rolls. Rope its face out. */
class KingCrab extends Enemy {
  constructor(eng, x, z) {
    super(eng, x, z);
    this.boss = true;
    this.hp = 6;
    this.max = 6;
    this.r = 1.15;
    this.dmg = 2;
    this.home = { x, z };
    // the shell
    this.shell = new THREE.Group();
    const sh = mesh(sharedGeo('lh-kcShell', () => new THREE.ConeGeometry(1.25, 1.9, 9)), toon(0xc9a8ff), 0, 1.05, -0.15);
    this.shell.add(sh);
    for (let i = 0; i < 3; i++) this.shell.add(mesh(tor(1.0 - i * 0.28, 0.07), toon(0xffb3c7), 0, 0.45 + i * 0.5, -0.15));
    this.shell.children.slice(1).forEach((m) => { m.rotation.x = Math.PI / 2; });
    this.body.add(this.shell);
    // the face (peeks out of the shell)
    this.face3 = new THREE.Group();
    this.face3.add(mesh(sph(0.55, 14, 10), toon(0xff7a5c), 0, 0.45, 0.6));
    for (const s of [-1, 1]) {
      this.face3.add(mesh(cyl(0.05, 0.05, 0.5, 6), toon(0xff7a5c), s * 0.25, 0.95, 0.75));
      this.face3.add(mesh(sph(0.14, 10, 8), toon(COLORS.white), s * 0.25, 1.22, 0.78));
      this.face3.add(mesh(sph(0.07, 8, 6), toon(COLORS.ink), s * 0.25, 1.23, 0.9));
    }
    this.body.add(this.face3);
    this.claws = [-1, 1].map((s) => {
      const g = new THREE.Group();
      const upper = mesh(sph(0.45, 12, 10), toon(0xff6b5c), 0, 0, 0);
      upper.scale.set(1, 0.7, 1.2);
      g.add(upper);
      const pin = mesh(cone(0.25, 0.6, 8), toon(0xff8f80), 0.15 * s, 0, 0.55);
      pin.rotation.x = Math.PI / 2;
      g.add(pin);
      const shadow = makeShadow(1.6);
      eng.room.group.add(shadow);
      eng.room.group.add(g);
      return { s, g, hp: 3, state: 'rest', st: 0, x: x + s * 2, z: z + 1.2, y: 0.4, shadow, flash: 0, dead: false };
    });
    this.state = 'claws';
    this.turn = 0;
    this.attackT = 1.5;
    this.vx = 0;
    this.vz = 0;
    this.face = 's';
  }

  parts() {
    const out = [];
    if (this.state === 'claws') {
      for (const c of this.claws) if (!c.dead) out.push({ x: c.x, z: c.z, r: 0.6, part: c });
    }
    out.push({ x: this.x, z: this.z, r: this.r, part: 'body' });
    return out;
  }

  get exposed() { return this.state === 'out'; }

  think(dt) {
    this.face = 's';
    const live = this.claws.filter((c) => !c.dead);
    if (this.state === 'claws') {
      this.face3.position.y = 0;
      this.face3.visible = true;
      this.attackT -= dt;
      for (const c of live) this.updateClaw(c, dt);
      if (live.length && this.attackT <= 0 && live.every((c) => c.state === 'rest')) {
        const c = live[this.turn++ % live.length];
        c.state = 'raise';
        c.st = 0.95;
        this.attackT = live.length === 2 ? 1.4 : 1.0;
      }
      if (!live.length) { this.state = 'hide'; this.st = 1; this.eng.sfx('roar'); }
    } else if (this.state === 'hide') {
      this.st -= dt;
      this.face3.position.y = -0.8 * (1 - this.st);
      if (this.st <= 0) this.startRoll();
    } else if (this.state === 'roll') {
      this.st -= dt;
      this.face3.visible = false;
      this.shell.rotation.y += dt * 12;
      const hit = this.move(this.vx * dt, this.vz * dt);
      if (hit.x) { this.vx = -this.vx; this.eng.sfx('bump'); this.eng.shake(0.08); }
      if (hit.z) { this.vz = -this.vz; this.eng.sfx('bump'); this.eng.shake(0.08); }
      if (this.hp <= 3 && Math.random() < dt * 0.9) {
        const a = Math.random() * 6.28;
        this.eng.addProjectile(new Pebble(this.eng, this.x, this.z, Math.cos(a) * 4, Math.sin(a) * 4, true));
      }
      if (this.st <= 0) { this.state = 'peek'; this.st = 2.6; this.shell.rotation.y = 0; this.face3.visible = true; this.eng.sfx('dizzy'); }
    } else if (this.state === 'peek') {
      this.st -= dt;
      this.face3.position.y = -0.55 + Math.sin(this.t * 6) * 0.05;
      this.dizzy.visible = true;
      this.dizzy.position.y = 2.2;
      this.dizzy.rotation.y += dt * 5;
      if (this.st <= 0) { this.dizzy.visible = false; this.startRoll(); }
    } else if (this.state === 'pulled') {
      this.st -= dt;
      const p = Math.min(1, (0.5 - this.st) / 0.5);
      this.face3.position.y = -0.55 + p * 0.55;
      this.face3.position.z = p * 0.4;
      if (this.st <= 0) { this.state = 'out'; this.st = 3.2; }
    } else if (this.state === 'out') {
      this.st -= dt;
      this.face3.position.z = 0.4 + Math.sin(this.t * 10) * 0.05;
      if (this.st <= 0) { this.face3.position.z = 0; this.state = 'hide'; this.st = 0.6; }
    }
    this.touch = true;
  }

  startRoll() {
    this.state = 'roll';
    this.st = this.hp <= 3 ? 5 : 4;
    const sp = this.hp <= 3 ? 7.5 : 6;
    const a = Math.atan2(this.hero.z - this.z, this.hero.x - this.x) + (Math.random() - 0.5) * 0.8;
    this.vx = Math.cos(a) * sp;
    this.vz = Math.sin(a) * sp;
    if (Math.abs(this.vx) < 2) this.vx = Math.sign(this.vx || 1) * 2.5;
    if (Math.abs(this.vz) < 2) this.vz = Math.sign(this.vz || 1) * 2.5;
    this.eng.sfx('dash');
  }

  updateClaw(c, dt) {
    c.flash -= dt;
    const restX = this.x + c.s * 2.1, restZ = this.z + 1.1;
    if (c.state === 'rest') {
      c.x += (restX - c.x) * Math.min(1, dt * 4);
      c.z += (restZ - c.z) * Math.min(1, dt * 4);
      c.y = 0.5 + Math.sin(this.t * 3 + c.s) * 0.1;
    } else if (c.state === 'raise') {
      c.st -= dt;
      if (c.st > 0.25) { c.tx = this.hero.x; c.tz = this.hero.z; }
      c.x += (c.tx - c.x) * Math.min(1, dt * 5);
      c.z += (c.tz - c.z) * Math.min(1, dt * 5);
      c.y += (2.6 - c.y) * Math.min(1, dt * 6);
      if (c.st <= 0) { c.state = 'slam'; c.st = 0.12; }
    } else if (c.state === 'slam') {
      c.st -= dt;
      c.y = Math.max(0.3, c.y - dt * 22);
      if (c.st <= 0) {
        c.state = 'stuck';
        c.st = 1.7;
        c.y = 0.3;
        this.eng.sfx('slam');
        this.eng.shake(0.25);
        this.eng.puffAt(c.x, c.z, 0xf5dfa2, 10);
        if (Math.hypot(this.hero.x - c.x, this.hero.z - c.z) < 1.0) this.eng.hurtHero(2, c.x, c.z);
      }
    } else if (c.state === 'stuck') {
      c.st -= dt;
      c.g.rotation.z = Math.sin(this.t * 30) * 0.05;
      if (c.st <= 0) { c.state = 'rest'; c.g.rotation.z = 0; }
    }
    c.g.position.set(c.x, c.y, c.z);
    c.g.visible = c.flash > 0 ? Math.floor(c.flash * 20) % 2 === 0 : true;
    c.shadow.position.set(c.x, 0.03, c.z);
    c.shadow.scale.setScalar(c.state === 'raise' ? 1.5 + (2.6 - c.y) * 0.1 : 1.2);
    c.shadow.material = c.state === 'raise' ? markMat() : shadowMat();
  }

  /** Contact damage also from claws on the ground. */
  touches(hx, hz) {
    for (const c of this.claws) if (!c.dead && c.y < 0.8 && Math.hypot(hx - c.x, hz - c.z) < 0.75) return true;
    return Math.hypot(hx - this.x, hz - this.z) < this.r + 0.25;
  }

  hurt(dmg, sx, sz, src, part) {
    if (this.dead) return 'none';
    if (part && part !== 'body') {
      if (part.state !== 'stuck' || part.flash > 0 || src === 'rope') { this.eng.sfx('clang'); return 'clang'; }
      part.hp -= 1;
      part.flash = 0.4;
      this.eng.sfx('hit');
      if (part.hp <= 0) {
        part.dead = true;
        this.eng.poof(part.x, part.z, part.y);
        part.g.parent?.remove(part.g);
        part.shadow.parent?.remove(part.shadow);
        this.eng.sfx('poof');
      }
      return 'hit';
    }
    if (src === 'rope') {
      if (this.state === 'peek') { this.state = 'pulled'; this.st = 0.5; this.dizzy.visible = false; this.eng.sfx('hook'); return 'hit'; }
      return 'clang';
    }
    if (!this.exposed || this.flash > 0) {
      this.eng.sfx('clang');
      if (this.state === 'peek') this.eng.hintOnce('lh.crab.hint');
      return 'clang';
    }
    this.hp -= 1;
    this.flash = 0.35;
    this.eng.sfx('hit');
    if (this.hp <= 0) this.die();
    return 'hit';
  }

  die() {
    this.dead = true;
    for (const c of this.claws) { c.g.parent?.remove(c.g); c.shadow.parent?.remove(c.shadow); }
    this.eng.bossDown(this);
  }
}

function tor(r, t) { return sharedGeo(`lh-etor${r}|${t}`, () => new THREE.TorusGeometry(r, t, 8, 20)); }

// ---------- projectiles ----------

export class Pebble {
  constructor(eng, x, z, vx, vz, bubble = false) {
    this.eng = eng;
    this.x = x;
    this.z = z;
    this.vx = vx;
    this.vz = vz;
    this.r = 0.18;
    this.dmg = 1;
    this.life = 3;
    this.bubble = bubble;
    this.mesh = mesh(sph(bubble ? 0.22 : 0.17, 10, 8), bubble ? toon(0xbfe9ff, { transparent: true, opacity: 0.75 }) : toon(0xff8f3a, { emissive: 0x552200 }), x, 0.45, z);
    eng.room.group.add(this.mesh);
  }

  update(dt) {
    this.x += this.vx * dt;
    this.z += this.vz * dt;
    this.life -= dt;
    this.mesh.position.set(this.x, 0.45, this.z);
    if (this.life <= 0 || this.eng.projectileBlocked(this.x, this.z)) this.dead = true;
  }

  remove() { this.mesh.parent?.remove(this.mesh); }
}

// ---------- factory ----------

export function makeEnemy(eng, kind, x, z) {
  switch (kind) {
    case 'blob': return new Blob(eng, x, z, 1);
    case 'crab': return new Crab(eng, x, z);
    case 'brute': return new Brute(eng, x, z);
    case 'spitter': return new Spitter(eng, x, z);
    case 'bat': return new Bat(eng, x, z);
    case 'shellback': return new Shellback(eng, x, z);
    case 'bigblob': { const b = new Blob(eng, x, z, 3); b.boss = true; b.bossPart = true; return b; }
    case 'bigshell': { const b = new Shellback(eng, x, z, true); b.bossPart = true; return b; }
    case 'moth': { const b = new Moth(eng, x, z); b.bossPart = true; return b; }
    default: return new Blob(eng, x, z, 1);
  }
}

export function makeBoss(eng, kind, x, z) {
  if (kind === 'crab') { const b = new KingCrab(eng, x, z); b.bossPart = true; return b; }
  return makeEnemy(eng, kind, x, z);
}
