import * as THREE from 'three';
import { COLORS, toon, basic, sharedGeo } from '../../core/palette.js';
import { box, cyl, sph, cone, tor, mesh } from './models.js';
import { Enemy, makeShadow, makeAlert, markGeo, markMat, DIR_V, cardinal } from './enemies.js';
import { colOf, rowOf, inGrid, TALL } from './tiles.js';

// Part 2 enemies and bosses. Every one shows what it is about to do:
//   beetle    a hard shell: swords bounce off. A bomb, or a thrown pot / boulder, flips it over.
//   wisp      a little gloom flame: swords pass through it. Fire, arrows, bombs or the rope pop it.
//   gull      circles high, screeches and shows its dive line, then swoops down.
// Bosses:
//   mole      Digger (Old Well): a mound shakes, the mole peeks out and throws a rock. Hit it while it
//             peeks, or rope it out of the ground for free hits.
//   golem     Stone Guardian (Stormcliff Ruins): rises for a stomp (red ring); swords bounce off until a
//             bomb cracks it; later it charges and cracks itself on the walls.
//   beak      Stormbeak: dives along a red line, then hovers (arrow it down); later it fans a gale from
//             its nest (arrows blow back: throw a boulder) and calls lightning (rings on the floor).
//   murk      The Gloom (the lamp room): only solid in light (lantern), then splits into wisps (rope
//             them), then grows huge and high (fire arrows through the braziers).

const SOFT = new Set(['bomb', 'pot', 'rock', 'boulder']);
const YAWS = { s: 0, e: Math.PI / 2, n: Math.PI, w: -Math.PI / 2 };

function ringMark(eng, s = 1) {
  const m = new THREE.Mesh(markGeo(), markMat());
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.03;
  m.scale.setScalar(s);
  m.visible = false;
  eng.room.group.add(m);
  return m;
}

/** A red strip on the floor: where a dive will go. */
function lineMark(eng) {
  const m = mesh(box(1, 0.02, 0.32), toon(0xff3b5c, { transparent: true, opacity: 0.55 }), 0, 0.03, 0, false);
  m.visible = false;
  eng.room.group.add(m);
  return m;
}

function setLine(m, x0, z0, x1, z1) {
  const d = Math.hypot(x1 - x0, z1 - z0) || 0.01;
  m.position.set((x0 + x1) / 2, 0.03, (z0 + z1) / 2);
  m.scale.set(d, 1, 1);
  m.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
  m.visible = true;
}

// ---------- regular enemies ----------

class Beetle extends Enemy {
  constructor(eng, x, z) {
    super(eng, x, z);
    this.hp = 2;
    this.r = 0.4;
    this.shell = new THREE.Group();
    const dome = mesh(sph(0.42, 16, 10, 0), 0x3b5f8f, 0, 0.3, 0);
    dome.scale.set(1, 0.7, 1.15);
    this.shell.add(dome);
    this.shell.add(mesh(box(0.04, 0.3, 0.9), 0x7fa6d8, 0, 0.55, 0, false));
    this.shell.add(mesh(sph(0.2, 12, 8), 0x2b2340, 0, 0.26, 0.42));
    for (const s of [-1, 1]) {
      this.shell.add(mesh(sph(0.06, 8, 6), toon(0xfff27a, { emissive: 0x665500 }), s * 0.09, 0.32, 0.58, false));
      this.shell.add(mesh(cone(0.04, 0.22, 5), 0x2b2340, s * 0.12, 0.42, 0.62, false));
    }
    this.legs = [];
    for (const s of [-1, 1]) for (const lz of [-0.22, 0, 0.22]) {
      const l = mesh(box(0.28, 0.05, 0.06), 0x2b2340, s * 0.42, 0.12, lz, false);
      this.shell.add(l);
      this.legs.push(l);
    }
    this.body.add(this.shell);
    this.state = 'walk';
    this.st = 1;
    this.face = 's';
  }

  think(dt) {
    if (this.state === 'flipped') {
      this.st -= dt;
      this.touch = false;
      this.shell.rotation.z += (Math.PI - this.shell.rotation.z) * Math.min(1, dt * 12);
      this.shell.position.y += (0.62 - this.shell.position.y) * Math.min(1, dt * 12);
      this.legs.forEach((l, i) => { l.rotation.x = Math.sin(this.t * 22 + i) * 0.6; });
      if (this.st <= 0) { this.state = 'walk'; this.st = 0.6; this.eng.sfx('boing'); }
      return;
    }
    this.touch = true;
    this.shell.rotation.z += (0 - this.shell.rotation.z) * Math.min(1, dt * 12);
    this.shell.position.y += (0 - this.shell.position.y) * Math.min(1, dt * 12);
    this.st -= dt;
    if (this.st <= 0) {
      const { dx, dz } = this.toHero();
      this.face = Math.random() < 0.6 ? cardinal(dx, dz) : ['n', 's', 'e', 'w'][Math.floor(Math.random() * 4)];
      this.st = 1.2 + Math.random();
    }
    const [vx, vz] = DIR_V[this.face];
    const hit = this.move(vx * 1.25 * dt, vz * 1.25 * dt);
    if (hit.x || hit.z) this.st = Math.min(this.st, 0.2);
    this.legs.forEach((l, i) => { l.rotation.y = Math.sin(this.t * 16 + i * 2) * 0.4; });
  }

  hurt(dmg, sx, sz, src) {
    if (this.dead || this.flash > 0) return 'none';
    if (this.state === 'flipped') {
      if (src === 'rope') return 'none';
      return super.hurt(Math.min(dmg, 2), sx, sz, src);
    }
    if (SOFT.has(src)) {
      this.state = 'flipped';
      this.st = 3.6;
      this.flash = 0.2;
      this.eng.sfx('flip');
      this.eng.hintOnce('lh.beetle.hint2');
      return 'hit';
    }
    this.eng.sfx('clang');
    const d = Math.hypot(this.x - sx, this.z - sz) || 1;
    this.kb = { x: ((this.x - sx) / d) * 4, z: ((this.z - sz) / d) * 4, t: 0.12 };
    this.eng.hintOnce('lh.beetle.hint');
    return src === 'sword' || src === 'spin' ? 'clang' : 'none';
  }
}

class Wisp extends Enemy {
  constructor(eng, x, z) {
    super(eng, x, z);
    this.fly = true;
    this.hp = 1;
    this.r = 0.32;
    this.y = 0.75;
    this.light = true;
    this.lightC = 0xb79bff;
    this.lightI = 3;
    this.flame = new THREE.Group();
    this.flame.add(mesh(sph(0.26, 12, 10), toon(0x5a3f9a, { emissive: 0x2a1650 }), 0, 0, 0, false));
    const tip = mesh(cone(0.22, 0.5, 10), toon(0x6b4fb5, { emissive: 0x2a1650 }), 0, 0.3, 0, false);
    this.flame.add(tip);
    for (const s of [-1, 1]) {
      this.flame.add(mesh(sph(0.07, 8, 6), toon(0xffffff, { emissive: 0x777777 }), s * 0.09, 0.04, 0.2, false));
      this.flame.add(mesh(sph(0.035, 6, 5), COLORS.ink, s * 0.09, 0.04, 0.26, false));
    }
    this.body.add(this.flame);
    this.shadow = makeShadow(0.5);
    this.group.add(this.shadow);
    this.phase = Math.random() * 6;
  }

  think(dt) {
    const { dx, dz, d } = this.toHero();
    const wob = Math.sin(this.t * 2.4 + this.phase) * 1.4;
    const sp = 1.25;
    this.move(((dx / (d || 1)) * sp - (dz / (d || 1)) * wob) * dt, ((dz / (d || 1)) * sp + (dx / (d || 1)) * wob) * dt);
    this.y = 0.7 + Math.sin(this.t * 3 + this.phase) * 0.12;
    this.flame.scale.set(1 + Math.sin(this.t * 9) * 0.06, 1 + Math.sin(this.t * 11) * 0.1, 1);
    this.face = cardinal(dx, dz);
    this.shadow.position.y = 0.02 - this.y;
  }

  hurt(dmg, sx, sz, src) {
    if (this.dead) return 'none';
    if (src === 'sword' || src === 'spin') {
      this.eng.sparkAt(this.x, this.z);
      this.eng.hintOnce('lh.wisp.hint');
      return 'none';
    }
    this.die();
    return 'hit';
  }

  die() {
    this.dead = true;
    this.eng.puffAt(this.x, this.z, 0xb79bff, 14, this.y);
    this.eng.sfx('poof');
    this.eng.dropLoot(this.x, this.z, this);
  }
}

class Gull extends Enemy {
  constructor(eng, x, z) {
    super(eng, x, z);
    this.fly = true;
    this.hp = 1;
    this.r = 0.35;
    this.y = 2.2;
    this.home = { x, z };
    const white = 0xffffff;
    const b = mesh(sph(0.24, 12, 8), white, 0, 0, 0);
    b.scale.set(0.9, 0.8, 1.4);
    this.body.add(b);
    this.body.add(mesh(sph(0.15, 10, 8), white, 0, 0.12, 0.3));
    const beak = mesh(cone(0.06, 0.2, 6), 0xffb02e, 0, 0.1, 0.48);
    beak.rotation.x = Math.PI / 2;
    this.body.add(beak);
    for (const s of [-1, 1]) this.body.add(mesh(sph(0.035, 6, 5), COLORS.ink, s * 0.08, 0.18, 0.4, false));
    this.wings = [];
    for (const s of [-1, 1]) {
      const w = new THREE.Group();
      w.position.x = s * 0.15;
      w.add(mesh(box(0.55, 0.03, 0.26), 0xdfe6f5, s * 0.28, 0, 0));
      w.add(mesh(box(0.2, 0.035, 0.2), 0x6b7b8f, s * 0.5, 0.01, 0));
      this.body.add(w);
      this.wings.push(w);
    }
    this.shadow = makeShadow(0.7);
    this.group.add(this.shadow);
    this.line = lineMark(eng);
    this.state = 'circle';
    this.st = 1.5 + Math.random() * 2;
    this.ang = Math.random() * 6;
  }

  think(dt) {
    const flap = this.state === 'swoop' ? 4 : 13;
    this.wings.forEach((w, i) => { w.rotation.z = Math.sin(this.t * flap) * 0.6 * (i ? -1 : 1); });
    const { dx, dz, d } = this.toHero();
    if (this.state === 'circle') {
      this.ang += dt * 1.2;
      const tx = this.home.x + Math.cos(this.ang) * 2, tz = this.home.z + Math.sin(this.ang) * 1.2;
      this.x += (tx - this.x) * Math.min(1, dt * 2);
      this.z += (tz - this.z) * Math.min(1, dt * 2);
      this.y += (2.2 - this.y) * Math.min(1, dt * 3);
      this.face = cardinal(-Math.sin(this.ang), Math.cos(this.ang));
      this.st -= dt;
      if (this.st <= 0 && d < 7) {
        this.state = 'aim';
        this.st = 0.75;
        const k = 1 + 2.5 / (d || 1);
        this.target = { x: this.x + dx * k, z: this.z + dz * k };
        this.eng.sfx('screech');
      }
    } else if (this.state === 'aim') {
      this.st -= dt;
      this.face = cardinal(this.target.x - this.x, this.target.z - this.z);
      setLine(this.line, this.x, this.z, this.target.x, this.target.z);
      if (this.st <= 0) { this.state = 'swoop'; this.from = { x: this.x, z: this.z }; this.st = 0; this.eng.sfx('dash'); }
    } else if (this.state === 'swoop') {
      this.st += dt;
      const p = Math.min(1, this.st / 0.7);
      const nx = this.from.x + (this.target.x - this.from.x) * p, nz = this.from.z + (this.target.z - this.from.z) * p;
      const hit = this.move(nx - this.x, nz - this.z);
      this.y = 2.2 - Math.sin(p * Math.PI) * 1.75;
      if (p >= 1 || ((hit.x || hit.z) && p > 0.3)) { this.state = 'circle'; this.st = 2 + Math.random() * 1.5; this.line.visible = false; this.home = { x: Math.max(-6, Math.min(6, this.x)), z: Math.max(-3.5, Math.min(3.5, this.z)) }; }
    }
    if (this.state !== 'aim' && this.state !== 'swoop') this.line.visible = false;
    this.touch = this.y < 0.95;
    this.shadow.position.y = 0.02 - this.y;
  }

  die() {
    this.line.parent?.remove(this.line);
    super.die();
  }
}

// ---------- mini bosses ----------

/** Digger the mole: peeks out of one mound after another. */
class Mole extends Enemy {
  constructor(eng, x, z) {
    super(eng, x, z);
    this.boss = true;
    this.hp = 6;
    this.max = 6;
    this.r = 0.55;
    this.dmg = 1;
    const fur = 0x7a5a48;
    this.bodyG = new THREE.Group();
    const b = mesh(sph(0.5, 14, 10), fur, 0, 0.45, 0);
    b.scale.set(1, 1.15, 0.95);
    this.bodyG.add(b);
    this.bodyG.add(mesh(sph(0.2, 10, 8), 0xffb3c7, 0, 0.55, 0.45));
    this.bodyG.add(mesh(sph(0.08, 8, 6), 0xff5d73, 0, 0.6, 0.62, false));
    for (const s of [-1, 1]) {
      this.bodyG.add(mesh(sph(0.06, 8, 6), COLORS.ink, s * 0.17, 0.78, 0.4, false));
      const paw = mesh(sph(0.16, 10, 8), 0xffc9a8, s * 0.36, 0.3, 0.35);
      paw.scale.set(1.2, 0.5, 1);
      this.bodyG.add(paw);
    }
    // a miner's helmet with a little lamp
    this.bodyG.add(mesh(sph(0.36, 14, 8), 0xffd23f, 0, 0.92, 0));
    this.bodyG.children[this.bodyG.children.length - 1].scale.set(1, 0.55, 1);
    this.bodyG.add(mesh(cyl(0.08, 0.08, 0.08, 10), toon(0xfff6c8, { emissive: 0xaa8800 }), 0, 0.98, 0.3, false));
    this.body.add(this.bodyG);
    this.mounds = (eng.room.def.mounds || [[8, 5]]).map(([c, r]) => {
      const m = new THREE.Group();
      const dirt = mesh(sph(0.55, 12, 8), 0x8a6a50, 0, 0, 0);
      dirt.scale.set(1, 0.32, 1);
      m.add(dirt);
      m.add(mesh(cyl(0.3, 0.3, 0.02, 12), 0x2b1f18, 0, 0.17, 0, false));
      m.position.set(c - 8, 0, r - 5);
      eng.room.group.add(m);
      return { m, x: c - 8, z: r - 5 };
    });
    this.state = 'under';
    this.st = 1.2;
    this.at = 2;
    this.phase = 1;
    this.light = true;
    this.lightC = 0xfff1a8;
  }

  parts() { return this.state === 'under' || this.state === 'rumble' ? [] : [{ x: this.x, z: this.z, r: this.r, part: 'body' }]; }

  think(dt) {
    if (this.phase === 1 && this.hp <= 3) { this.phase = 2; this.eng.sfx('roar'); }
    const fast = this.phase === 2;
    const mound = this.mounds[this.at];
    for (const md of this.mounds) md.m.position.y = 0;
    this.touch = this.state === 'peek' || this.state === 'out';
    switch (this.state) {
      case 'under':
        this.bodyG.position.y = -1.2;
        this.st -= dt;
        if (this.st <= 0) {
          // pick a mound, preferring ones near the hero
          const h = this.hero;
          const order = this.mounds.map((md, i) => ({ i, d: Math.hypot(md.x - h.x, md.z - h.z) + Math.random() * 3 })).filter((o) => o.i !== this.at && o.d > 1.2).sort((a, b) => a.d - b.d);
          this.at = order.length ? order[0].i : (this.at + 1) % this.mounds.length;
          this.x = this.mounds[this.at].x; this.z = this.mounds[this.at].z;
          this.state = 'rumble';
          this.st = fast ? 0.6 : 0.85;
          this.eng.sfx('rumble');
        }
        break;
      case 'rumble':
        this.st -= dt;
        mound.m.position.y = Math.abs(Math.sin(this.t * 40)) * 0.08;
        if (Math.random() < dt * 12) this.eng.puffAt(mound.x + (Math.random() - 0.5) * 0.6, mound.z + (Math.random() - 0.5) * 0.6, 0x8a6a50, 2, 0.2);
        if (this.st <= 0) { this.state = 'peek'; this.st = fast ? 1.5 : 2.0; this.thrown = false; this.eng.sfx('pop'); }
        break;
      case 'peek': {
        this.st -= dt;
        this.bodyG.position.y += (-0.35 - this.bodyG.position.y) * Math.min(1, dt * 12);
        const { dx, dz } = this.toHero();
        this.face = cardinal(dx, dz);
        const total = fast ? 1.5 : 2.0;
        // rears back, then throws a rock (or three)
        if (!this.thrown && this.st < total - 0.75) {
          this.thrown = true;
          const d = Math.hypot(dx, dz) || 1;
          const spreads = fast ? [-0.35, 0, 0.35] : [0];
          for (const a of spreads) {
            const ca = Math.cos(a), sa = Math.sin(a);
            const vx = ((dx * ca - dz * sa) / d) * 5.5, vz = ((dx * sa + dz * ca) / d) * 5.5;
            this.eng.addProjectile(new Rock(this.eng, this.x + vx * 0.1, this.z + vz * 0.1, vx, vz));
          }
          this.eng.sfx('shoot');
        } else if (!this.thrown) this.bodyG.rotation.x = -0.4 * (1 - (this.st - (total - 0.75)) / 0.75);
        else this.bodyG.rotation.x *= 0.8;
        if (this.st <= 0) this.dive();
        break;
      }
      case 'out':
        this.st -= dt;
        this.bodyG.position.y += (0 - this.bodyG.position.y) * Math.min(1, dt * 12);
        this.bodyG.rotation.x = 0;
        this.dizzy.visible = true;
        this.dizzy.position.y = 1.4;
        this.dizzy.rotation.y += dt * 6;
        if (this.st <= 0) { this.dizzy.visible = false; this.dive(); }
        break;
      case 'dive':
        this.st -= dt;
        this.bodyG.position.y -= dt * 5;
        if (this.st <= 0) { this.state = 'under'; this.st = fast ? 0.5 : 0.9; }
        break;
      default: break;
    }
  }

  dive() {
    this.state = 'dive';
    this.st = 0.3;
    this.dizzy.visible = false;
    this.eng.sfx('dig');
    this.eng.puffAt(this.x, this.z, 0x8a6a50, 10);
  }

  hurt(dmg, sx, sz, src) {
    if (this.dead || this.flash > 0) return 'none';
    if (this.state === 'peek') {
      if (src === 'rope') {
        this.state = 'out';
        this.st = 2.8;
        this.hits = 0;
        this.eng.sfx('hook');
        return 'hit';
      }
      this.hp -= 1;
      this.flash = 0.4;
      this.eng.sfx('hit');
      if (this.hp <= 0) { this.die(); return 'hit'; }
      this.dive();
      this.eng.later(1.5, () => this.eng.hintOnce('lh.mole.hint'));
      return 'hit';
    }
    if (this.state === 'out') {
      this.hp -= Math.min(dmg, 2);
      this.flash = 0.35;
      this.hits = (this.hits || 0) + 1;
      this.eng.sfx('hit');
      if (this.hp <= 0) { this.die(); return 'hit'; }
      if (this.hits >= 3) this.dive();
      return 'hit';
    }
    return 'none';
  }

  die() {
    this.dead = true;
    for (const md of this.mounds) md.m.parent?.remove(md.m);
    this.eng.bossDown(this);
  }
}

/** A thrown rock (the mole) or a gloom orb (Murk): flies straight, hurts on touch. */
class Rock {
  constructor(eng, x, z, vx, vz, gloom = false) {
    this.eng = eng;
    this.x = x; this.z = z; this.vx = vx; this.vz = vz;
    this.r = gloom ? 0.26 : 0.2;
    this.dmg = gloom ? 2 : 1;
    this.life = 3.5;
    this.gloom = gloom;
    this.mesh = gloom
      ? mesh(sph(0.26, 12, 10), toon(0x3d2a66, { emissive: 0x24104a }), x, 0.5, z, false)
      : mesh(sph(0.2, 8, 6), 0x9a8a7a, x, 0.45, z);
    eng.room.group.add(this.mesh);
  }

  update(dt) {
    this.x += this.vx * dt;
    this.z += this.vz * dt;
    this.life -= dt;
    this.mesh.position.set(this.x, this.gloom ? 0.5 + Math.sin(this.life * 12) * 0.05 : 0.45, this.z);
    this.mesh.rotation.x += dt * 6;
    if (this.life <= 0 || this.eng.projectileBlocked(this.x, this.z)) this.dead = true;
  }

  remove() { this.mesh.parent?.remove(this.mesh); }
}

/** The Stone Guardian: only a bomb (or a hard knock) cracks its stone skin. */
class Golem extends Enemy {
  constructor(eng, x, z) {
    super(eng, x, z);
    this.boss = true;
    this.hp = 8;
    this.max = 8;
    this.r = 0.85;
    this.dmg = 2;
    const stone = 0x8f9aa0, dark = 0x5d6a72;
    const g = new THREE.Group();
    g.add(mesh(box(1.2, 1.1, 0.9), stone, 0, 0.75, 0));
    g.add(mesh(box(1.3, 0.2, 1.0), dark, 0, 1.35, 0));
    g.add(mesh(box(0.8, 0.6, 0.7), stone, 0, 1.75, 0.05));
    for (const s of [-1, 1]) {
      g.add(mesh(box(0.14, 0.12, 0.05), toon(0xff7a2e, { emissive: 0x883300 }), s * 0.2, 1.8, 0.42, false));
      g.add(mesh(box(0.34, 0.9, 0.36), dark, s * 0.82, 0.75, 0.05));
      g.add(mesh(box(0.42, 0.36, 0.44), stone, s * 0.82, 0.25, 0.1));
      g.add(mesh(box(0.36, 0.3, 0.42), stone, s * 0.35, 0.15, 0));
    }
    g.add(mesh(ico(0.18), 0x6fae5f, -0.35, 2.1, 0));
    this.core = mesh(sph(0.2, 12, 10), toon(0x8ff0ff, { emissive: 0x226677 }), 0, 0.85, 0.46, false);
    this.core.visible = false;
    g.add(this.core);
    this.cracks = new THREE.Group();
    for (const [x, y, rz] of [[-0.3, 0.9, 0.5], [0.25, 0.6, -0.7], [0.1, 1.05, 0.2]]) {
      const c = mesh(box(0.05, 0.5, 0.03), COLORS.ink, x, y, 0.46, false);
      c.rotation.z = rz;
      this.cracks.add(c);
    }
    this.cracks.visible = false;
    g.add(this.cracks);
    this.stoneG = g;
    this.body.add(g);
    this.ring = ringMark(eng, 4.6);
    this.wave = mesh(tor(1, 0.08, 6, 30), toon(0xffe0a0, { transparent: true, opacity: 0.8 }), 0, 0.15, 0, false);
    this.wave.rotation.x = Math.PI / 2;
    this.wave.visible = false;
    eng.room.group.add(this.wave);
    this.alert = makeAlert();
    this.alert.position.y = 2.6;
    this.group.add(this.alert);
    this.dizzy.position.y = 2.4;
    this.state = 'wake';
    this.st = 1.2;
    this.phase = 1;
    this.moves = 0;
  }

  think(dt) {
    if (this.phase === 1 && this.hp <= 4) { this.phase = 2; this.eng.sfx('roar'); }
    const { dx, dz, d } = this.toHero();
    this.alert.visible = this.state === 'aim';
    this.touch = this.state !== 'cracked';
    if (this.waveT > 0) {
      this.waveT -= dt;
      const p = 1 - this.waveT / 0.35;
      this.wave.scale.setScalar(0.5 + p * 2.0);
      this.wave.position.set(this.x, 0.15, this.z);
      this.wave.visible = this.waveT > 0;
    }
    switch (this.state) {
      case 'wake':
        this.st -= dt;
        this.stoneG.position.y = Math.max(0, Math.sin(this.st * 20) * 0.04);
        if (this.st <= 0) { this.state = 'walk'; this.st = 2.2; this.eng.sfx('roar'); }
        break;
      case 'walk': {
        this.st -= dt;
        const sp = this.phase === 2 ? 1.7 : 1.25;
        this.face = cardinal(dx, dz);
        this.move((dx / (d || 1)) * sp * dt, (dz / (d || 1)) * sp * dt);
        this.stoneG.rotation.z = Math.sin(this.t * 6) * 0.06;
        if (this.st <= 0 || d < 1.8) {
          this.moves++;
          const lined = Math.abs(dx) < 0.6 || Math.abs(dz) < 0.6;
          if (this.phase === 2 && this.moves % 2 === 0 && lined) { this.state = 'aim'; this.st = 0.7; this.face = cardinal(dx, dz); this.eng.sfx('beep'); } else { this.state = 'raise'; this.st = 0.85; this.ring.visible = true; this.eng.sfx('charged'); }
        }
        break;
      }
      case 'raise':
        this.st -= dt;
        this.stoneG.position.y = (1 - this.st / 0.85) * 0.7;
        this.ring.position.set(this.x, 0.03, this.z);
        this.ring.scale.setScalar(4.6 + Math.sin(this.t * 20) * 0.15);
        if (this.st <= 0) {
          this.ring.visible = false;
          this.stoneG.position.y = 0;
          this.eng.sfx('slam');
          this.eng.shake(0.35);
          this.eng.puffAt(this.x, this.z, 0xbdb8cf, 18);
          this.waveT = 0.35;
          if (d < 2.3) this.eng.hurtHero(2, this.x, this.z, 10);
          this.state = 'rest';
          this.st = 0.7;
          if (this.phase === 2 && !this.double) { this.double = true; this.state = 'raise'; this.st = 0.55; this.ring.visible = true; } else this.double = false;
        }
        break;
      case 'rest':
        this.st -= dt;
        if (this.st <= 0) { this.state = 'walk'; this.st = 2 + Math.random(); }
        break;
      case 'aim':
        this.st -= dt;
        this.stoneG.position.y = Math.abs(Math.sin(this.t * 30)) * 0.05;
        if (this.st <= 0) { this.state = 'charge'; this.eng.sfx('dash'); }
        break;
      case 'charge': {
        const [vx, vz] = DIR_V[this.face];
        const hit = this.move(vx * 6.5 * dt, vz * 6.5 * dt);
        if (hit.x || hit.z) {
          this.eng.sfx('slam');
          this.eng.shake(0.3);
          this.crack(0, 2.6);
        }
        break;
      }
      case 'cracked':
        this.st -= dt;
        this.dizzy.visible = true;
        this.dizzy.rotation.y += dt * 6;
        this.core.scale.setScalar(1 + Math.sin(this.t * 10) * 0.15);
        if (this.st <= 0) {
          this.state = 'walk';
          this.st = 1.5;
          this.dizzy.visible = false;
          this.core.visible = false;
          this.cracks.visible = false;
        }
        break;
      default: break;
    }
  }

  crack(dmg, time = 3.2) {
    this.state = 'cracked';
    this.st = time;
    this.hits = 0;
    this.core.visible = true;
    this.cracks.visible = true;
    this.ring.visible = false;
    this.stoneG.position.y = 0;
    if (dmg) { this.hp -= dmg; this.flash = 0.4; }
    this.eng.sfx('crack');
    if (this.hp <= 0) this.die();
  }

  hurt(dmg, sx, sz, src) {
    if (this.dead) return 'none';
    if (src === 'bomb') { if (this.flash <= 0) this.crack(2); return 'hit'; }
    if (src === 'boulder' || src === 'rock') { if (this.state !== 'cracked') this.crack(0, 2.4); return 'hit'; }
    if (this.state === 'cracked' && src !== 'rope') {
      if (this.flash > 0) return 'none';
      this.hp -= Math.min(dmg, 2);
      this.flash = 0.3;
      this.hits++;
      this.eng.sfx('hit');
      if (this.hp <= 0) { this.die(); return 'hit'; }
      if (this.hits >= 3) this.st = Math.min(this.st, 0.3);
      return 'hit';
    }
    this.eng.sfx('clang');
    this.eng.hintOnce('lh.golem.hint');
    return src === 'sword' || src === 'spin' ? 'clang' : 'none';
  }

  die() {
    this.dead = true;
    this.ring.parent?.remove(this.ring);
    this.wave.parent?.remove(this.wave);
    this.eng.bossDown(this);
  }
}

// ---------- Stormbeak ----------

class Stormbeak extends Enemy {
  constructor(eng, x, z) {
    super(eng, x, z);
    this.boss = true;
    this.fly = true;
    this.hp = 9;
    this.max = 9;
    this.r = 0.95;
    this.dmg = 2;
    this.arrowReach = 3.2;
    this.highCatch = 1.7;
    this.nest = { x: 0, z: -3.4 };
    const white = 0xf4f6ff, grey = 0x6b7b8f;
    const b = mesh(sph(0.55, 16, 12), white, 0, 0, 0);
    b.scale.set(0.95, 0.85, 1.4);
    this.body.add(b);
    this.body.add(mesh(sph(0.36, 14, 10), white, 0, 0.3, 0.6));
    const beak = mesh(cone(0.13, 0.45, 8), 0xffb02e, 0, 0.22, 1.05);
    beak.rotation.x = Math.PI / 2;
    this.body.add(beak);
    this.body.add(mesh(box(0.5, 0.08, 0.2), 0x2b2340, 0, 0.5, 0.75, false));
    for (const s of [-1, 1]) {
      this.body.add(mesh(sph(0.09, 8, 6), toon(0xfff27a, { emissive: 0x998800 }), s * 0.17, 0.4, 0.88, false));
      const crest = mesh(cone(0.08, 0.4, 5), grey, s * 0.06, 0.72, 0.45);
      crest.rotation.x = -0.6;
      this.body.add(crest);
    }
    const tail = mesh(box(0.5, 0.06, 0.5), grey, 0, 0.05, -0.85);
    this.body.add(tail);
    this.wings = [];
    for (const s of [-1, 1]) {
      const w = new THREE.Group();
      w.position.set(s * 0.4, 0.15, 0);
      const m = mesh(box(1.4, 0.06, 0.6), 0xdfe6f5, s * 0.7, 0, 0);
      w.add(m);
      w.add(mesh(box(0.5, 0.07, 0.62), grey, s * 1.25, 0.01, 0));
      this.body.add(w);
      this.wings.push({ g: w, s });
    }
    this.body.scale.setScalar(1.15);
    this.shadow = makeShadow(2);
    this.group.add(this.shadow);
    this.line = lineMark(eng);
    this.marks = [0, 1, 2].map(() => ringMark(eng, 2.2));
    // the nest at the top of the room
    this.nestM = new THREE.Group();
    for (let i = 0; i < 10; i++) {
      const tw = mesh(cyl(0.05, 0.05, 1.6, 5), 0x8a5a3a, 0, 0.25, 0, true);
      tw.rotation.set(Math.PI / 2, 0, (i / 10) * Math.PI);
      tw.position.y = 0.2 + (i % 3) * 0.08;
      this.nestM.add(tw);
    }
    this.nestM.add(mesh(cyl(0.7, 0.55, 0.3, 14), 0x6b4a3a, 0, 0.15, 0));
    this.nestM.position.set(this.nest.x, 0, this.nest.z);
    eng.room.group.add(this.nestM);
    this.x = this.nest.x; this.z = this.nest.z;
    this.y = 0.6;
    this.state = 'intro';
    this.st = 1.6;
    this.ang = Math.PI / 2;
    this.phase = 1;
    this.cycle = 0;
    this.hovers = 0;
  }

  setPhase() {
    const p = this.hp <= 3 ? 3 : this.hp <= 6 ? 2 : 1;
    if (p > this.phase) {
      this.phase = p;
      // the new attack comes first: a gale in phase 2, lightning in phase 3
      this.cycle = p === 3 ? 2 : 1;
      this.eng.sfx('roar');
      this.eng.shake(0.3);
    }
  }

  nextAttack() {
    this.cycle++;
    if (this.phase >= 3 && this.cycle % 3 === 0) return this.go('stormUp', 0.8);
    if (this.phase >= 2 && this.cycle % 2 === 0) return this.go('galeUp', 0.9);
    return this.go('circle', this.phase === 3 ? 1.3 : 1.9);
  }

  go(state, st) { this.state = state; this.st = st; }

  think(dt) {
    const eng = this.eng;
    const room = eng.room;
    const h = this.hero;
    const flap = this.state === 'hover' || this.state === 'gale' ? 22 : this.state === 'dive' ? 3 : this.state === 'down' ? 0 : 10;
    for (const w of this.wings) w.g.rotation.z = (this.state === 'galeUp' ? 0.9 : Math.sin(this.t * flap) * 0.55) * w.s;
    this.touch = this.y < 1.0 && this.state !== 'down';
    this.dizzy.visible = this.state === 'down';
    if (this.state !== 'gale') room.gale = null;
    if (this.state !== 'aim') this.line.visible = false;
    switch (this.state) {
      case 'intro':
        this.st -= dt;
        this.y += (2.6 - this.y) * Math.min(1, dt * 2);
        if (this.st <= 0) { eng.sfx('screech'); this.go('circle', 1.5); }
        break;
      case 'circle': {
        this.ang += dt * (this.phase === 3 ? 1.5 : 1.1);
        const tx = Math.cos(this.ang) * 5.2, tz = Math.sin(this.ang) * 2.6 - 0.4;
        this.x += (tx - this.x) * Math.min(1, dt * 2.5);
        this.z += (tz - this.z) * Math.min(1, dt * 2.5);
        this.y += (2.6 - this.y) * Math.min(1, dt * 3);
        this.face = cardinal(tx - this.x, tz - this.z);
        this.st -= dt;
        if (this.st <= 0) {
          // aim a dive through the hero, all the way to the far side
          const dx = h.x - this.x, dz = h.z - this.z, d = Math.hypot(dx, dz) || 1;
          let ex = h.x + (dx / d) * 2.5, ez = h.z + (dz / d) * 2.5;
          ex = Math.max(-6.6, Math.min(6.6, ex)); ez = Math.max(-3.8, Math.min(3.4, ez));
          this.target = { x: ex, z: ez };
          this.go('aim', this.phase === 3 ? 0.7 : 0.95);
          eng.sfx('screech');
        }
        break;
      }
      case 'aim':
        this.st -= dt;
        this.face = cardinal(this.target.x - this.x, this.target.z - this.z);
        this.y += (2.0 - this.y) * Math.min(1, dt * 4);
        setLine(this.line, this.x, this.z, this.target.x, this.target.z);
        this.line.visible = Math.floor(this.st * 12) % 2 === 0 || this.st > 0.4;
        if (this.st <= 0) { this.from = { x: this.x, z: this.z, y: this.y }; this.go('dive', 0); eng.sfx('dash'); }
        break;
      case 'dive': {
        this.st += dt;
        const dist = Math.hypot(this.target.x - this.from.x, this.target.z - this.from.z);
        const p = Math.min(1, this.st / Math.max(0.35, dist / 12));
        this.x = this.from.x + (this.target.x - this.from.x) * p;
        this.z = this.from.z + (this.target.z - this.from.z) * p;
        this.y = this.from.y + (0.7 - this.from.y) * Math.min(1, p * 2.5);
        if (Math.random() < dt * 30) eng.windAt(this.x, this.z, 0, 0);
        if (p >= 1) { this.go('hover', this.phase === 3 ? 1.4 : 1.9); this.hovers++; }
        break;
      }
      case 'hover':
        this.st -= dt;
        this.y += (1.6 - this.y) * Math.min(1, dt * 4);
        this.face = cardinal(h.x - this.x, h.z - this.z);
        if (this.hovers >= 2) eng.hintOnce('lh.beak.hint1');
        if (this.st <= 0) this.nextAttack();
        break;
      case 'fall':
        this.st -= dt;
        this.y = Math.max(0.35, this.y - dt * 8);
        if (this.y <= 0.36) { this.go('down', 3.0); this.hits = 0; eng.sfx('slam'); eng.shake(0.25); eng.puffAt(this.x, this.z, 0xffffff, 16); }
        break;
      case 'down':
        this.st -= dt;
        this.dizzy.position.y = 1.5;
        this.dizzy.rotation.y += dt * 6;
        if (this.st <= 0) { this.go('rise', 0.6); eng.sfx('screech'); }
        break;
      case 'rise':
        this.st -= dt;
        this.y += (2.4 - this.y) * Math.min(1, dt * 4);
        if (this.st <= 0) this.nextAttack();
        break;
      case 'galeUp': {
        // to the nest, wings up: a gale is coming
        this.st -= dt;
        this.x += (this.nest.x - this.x) * Math.min(1, dt * 5);
        this.z += (this.nest.z - this.z) * Math.min(1, dt * 5);
        this.y += (1.3 - this.y) * Math.min(1, dt * 5);
        this.face = 's';
        if (this.st <= 0) { this.go('gale', 3.6); eng.sfx('gust'); }
        break;
      }
      case 'gale': {
        this.st -= dt;
        room.gale = { dx: 0, dz: 1 };
        this.x = this.nest.x; this.z = this.nest.z;
        this.y = 1.3 + Math.sin(this.t * 8) * 0.05;
        if (Math.random() < dt * 30) eng.windAt((Math.random() - 0.5) * 12, -3 + Math.random() * 6, 0, 1);
        // the gale pushes everything south, unless you shelter behind a boulder
        if (h.mode !== 'rope') {
          const c = colOf(h.x), r = rowOf(h.z) - 1;
          const ch = inGrid(c, r) ? room.grid[r][c] : '#';
          if (!TALL.has(ch)) eng.pushHero(0, 2.7);
        }
        if (this.st > 2.5 && this.st - dt <= 2.5 && this.cycle >= 2) eng.hintOnce('lh.beak.hint2');
        if (this.st <= 0) this.go('circle', 1.2);
        break;
      }
      case 'stormUp':
        this.st -= dt;
        this.x += (this.nest.x - this.x) * Math.min(1, dt * 4);
        this.z += (this.nest.z - this.z) * Math.min(1, dt * 4);
        this.y += (2.6 - this.y) * Math.min(1, dt * 4);
        if (this.st <= 0) { this.go('storm', 0); this.strikes = 0; this.markT = 0; eng.sfx('thunder'); }
        break;
      case 'storm': {
        // three lightning strikes follow you: a ring shows where each will land
        this.markT -= dt;
        if (this.markT <= 0 && this.strikes < 3) {
          const m = this.marks[this.strikes];
          m.position.set(h.x, 0.03, h.z);
          m.visible = true;
          m.userData.t = 0.9;
          this.strikes++;
          this.markT = 0.55;
          eng.sfx('charged');
        }
        let busy = false;
        for (const m of this.marks) {
          if (!m.visible) continue;
          busy = true;
          m.userData.t -= dt;
          m.scale.setScalar(2.2 + m.userData.t * 1.5);
          if (m.userData.t <= 0) {
            m.visible = false;
            eng.hud.flash(0.45);
            eng.sfx('thunder');
            eng.shake(0.25);
            eng.puffAt(m.position.x, m.position.z, 0xfff27a, 16, 0.3);
            if (Math.hypot(h.x - m.position.x, h.z - m.position.z) < 0.95) eng.hurtHero(2, m.position.x, m.position.z, 7);
          }
        }
        if (!busy && this.strikes >= 3) { this.go('rest', 2.2); eng.sfx('dizzy'); }
        break;
      }
      case 'rest':
        // tired after the storm: sits low on the nest
        this.st -= dt;
        this.y += (1.4 - this.y) * Math.min(1, dt * 4);
        if (this.st <= 0) this.go('circle', 1.2);
        break;
      default: break;
    }
    this.shadow.position.y = 0.02 - this.y;
    this.shadow.scale.setScalar(2.2 - Math.min(1, this.y / 3) * 0.8);
  }

  hurt(dmg, sx, sz, src) {
    if (this.dead || this.flash > 0) return 'none';
    const knock = () => { this.go('fall', 1); this.flash = 0.3; this.eng.sfx('hit'); this.eng.sfx('screech'); this.line.visible = false; this.eng.room.gale = null; return 'hit'; };
    if (this.state === 'down') {
      if (src === 'rope') return 'none';
      this.hp -= Math.min(dmg, 2);
      this.flash = 0.35;
      this.hits++;
      this.eng.sfx('hit');
      if (this.hp <= 0) { this.die(); return 'hit'; }
      const was = this.phase;
      this.setPhase();
      // two hits per fall, and a new phase always starts in the air
      if (this.hits >= 2 || this.phase !== was) { this.go('rise', 0.6); this.eng.sfx('screech'); }
      return 'hit';
    }
    if ((this.state === 'hover' || this.state === 'rest') && (src === 'arrow' || src === 'fire')) return knock();
    if (this.state === 'gale' && (src === 'boulder' || src === 'rock' || src === 'pot' || src === 'bomb')) return knock();
    if (this.y < 1.25 && (src === 'sword' || src === 'spin')) { this.eng.sfx('clang'); return 'clang'; }
    return 'none';
  }

  die() {
    this.dead = true;
    this.eng.room.gale = null;
    this.line.parent?.remove(this.line);
    for (const m of this.marks) m.parent?.remove(m);
    this.eng.bossDown(this);
  }
}

// ---------- Murk, the gloom that stole the crystals ----------

class MurkWisp extends Wisp {
  constructor(eng, x, z, boss, i) {
    super(eng, x, z);
    this.bossRef = boss;
    this.i = i;
    this.pullable = true;
    this.state = 'orbit';
    this.st = 0;
    this.flame.scale.setScalar(1.2);
  }

  think(dt) {
    const h = this.hero;
    const b = this.bossRef;
    if (this.state === 'orbit') {
      const a = b.orbit + (this.i / 3) * Math.PI * 2;
      const tx = h.x + Math.cos(a) * 3.2, tz = h.z + Math.sin(a) * 2.4;
      this.move((tx - this.x) * Math.min(1, dt * 3), (tz - this.z) * Math.min(1, dt * 3));
      this.y = 0.8 + Math.sin(this.t * 4 + this.i) * 0.12;
      if (b.dashNext === this.i && b.dashT <= 0) { this.state = 'warn'; this.st = 0.6; b.dashNext = (this.i + 1) % 3; b.dashT = 1.7; this.eng.sfx('beep'); }
    } else if (this.state === 'warn') {
      this.st -= dt;
      this.flame.scale.setScalar(1.2 + Math.sin(this.t * 40) * 0.15);
      if (this.st <= 0) {
        const d = Math.hypot(h.x - this.x, h.z - this.z) || 1;
        this.v = { x: ((h.x - this.x) / d) * 8, z: ((h.z - this.z) / d) * 8 };
        this.state = 'dash';
        this.st = 0.55;
        this.eng.sfx('dash');
      }
    } else if (this.state === 'dash') {
      this.st -= dt;
      this.move(this.v.x * dt, this.v.z * dt);
      if (this.st <= 0) { this.state = 'orbit'; this.flame.scale.setScalar(1.2); }
    }
    this.shadow.position.y = 0.02 - this.y;
  }

  hurt(dmg, sx, sz, src) {
    if (this.dead) return 'none';
    if (src === 'sword' || src === 'spin') {
      this.eng.sparkAt(this.x, this.z);
      this.eng.hintOnce('lh.murk.hint2');
      return 'none';
    }
    this.dead = true;
    this.eng.puffAt(this.x, this.z, 0xb79bff, 16, this.y);
    this.eng.sfx('poof');
    return 'hit';
  }
}

class Murk extends Enemy {
  constructor(eng, x, z) {
    super(eng, x, z);
    this.boss = true;
    this.fly = true;
    this.hp = 9;
    this.max = 9;
    this.r = 1.0;
    this.dmg = 2;
    this.y = 1.1;
    this.arrowReach = 3.4;
    this.flameReach = 1.6;
    this.light = true;
    this.lightC = 0xb79bff;
    this.lightI = 4;
    this.lightD = 5;
    this.cloud = new THREE.Group();
    const puffs = [[0, 0, 0, 0.62], [0.5, 0.1, -0.1, 0.42], [-0.5, 0.1, -0.1, 0.44], [0.3, 0.45, -0.2, 0.36], [-0.32, 0.42, -0.2, 0.36], [0, -0.35, 0, 0.4]];
    this.puffMats = [toon(0x2b1f45), toon(0x3d2a66)];
    this.puffMeshes = puffs.map(([px, py, pz, r], i) => {
      const m = mesh(sph(r, 14, 10), this.puffMats[i % 2], px, py, pz, false);
      this.cloud.add(m);
      return m;
    });
    this.eyes = [];
    for (const s of [-1, 1]) {
      const e = mesh(sph(0.15, 10, 8), toon(0xfff27a, { emissive: 0xaa9900 }), s * 0.22, 0.12, 0.52, false);
      e.scale.set(1, 1.3, 0.6);
      this.cloud.add(e);
      this.eyes.push(e);
    }
    this.mouth = mesh(box(0.3, 0.05, 0.05), 0xfff27a, 0, -0.16, 0.58, false);
    this.cloud.add(this.mouth);
    this.cloud.scale.setScalar(1.5);
    this.body.add(this.cloud);
    this.shadow = makeShadow(1.8);
    this.group.add(this.shadow);
    this.orbMarks = [0, 1].map(() => ringMark(eng, 2));
    this.state = 'float';
    this.st = 0;
    this.attackT = 2.5;
    this.phase = 1;
    this.orbit = 0;
    this.wisps = [];
  }

  parts() { return this.state === 'split' ? [] : [{ x: this.x, z: this.z, r: this.r, part: 'body' }]; }

  setLook(solid) {
    // in the light it turns pale and soft: hit it now
    const mats = solid ? [toon(0xb9a6e0), toon(0xd2c4f2)] : this.puffMats;
    this.puffMeshes.forEach((m, i) => { m.material = mats[i % 2]; });
  }

  think(dt) {
    const eng = this.eng;
    const room = eng.room;
    const h = this.hero;
    const { dx, dz, d } = this.toHero();
    this.cloud.rotation.y = Math.sin(this.t * 1.3) * 0.15;
    this.puffMeshes.forEach((m, i) => m.scale.setScalar(1 + Math.sin(this.t * 3 + i) * 0.06));
    this.touch = this.state === 'float' || this.state === 'puff';
    this.dizzy.visible = this.state === 'solid' || this.state === 'dazed';
    if (this.dizzy.visible) { this.dizzy.position.y = this.y + 1.2; this.dizzy.rotation.y += dt * 6; }
    switch (this.state) {
      case 'float': {
        this.face = cardinal(dx, dz);
        const sp = 1.1;
        if (d > 1.6) this.move((dx / d) * sp * dt, (dz / d) * sp * dt);
        this.y += (1.1 + Math.sin(this.t * 2) * 0.15 - this.y) * Math.min(1, dt * 3);
        this.attackT -= dt;
        if (this.attackT <= 0) { this.go('puff', 0.8); eng.sfx('charged'); }
        break;
      }
      case 'puff':
        // swells up, then spits three gloom orbs
        this.st -= dt;
        this.cloud.scale.setScalar(1.5 + (0.8 - this.st) * 0.5);
        if (this.st <= 0) {
          this.cloud.scale.setScalar(1.5);
          for (const a of [-0.4, 0, 0.4]) {
            const ca = Math.cos(a), sa = Math.sin(a);
            const vx = ((dx * ca - dz * sa) / (d || 1)) * 4.2, vz = ((dx * sa + dz * ca) / (d || 1)) * 4.2;
            eng.addProjectile(new Rock(eng, this.x, this.z, vx, vz, true));
          }
          eng.sfx('shoot');
          this.go('float', 0);
          this.attackT = 2.6;
        }
        break;
      case 'solid':
      case 'dazed':
        this.st -= dt;
        this.y += (0.55 - this.y) * Math.min(1, dt * 6);
        if (this.st <= 0) this.recover();
        break;
      case 'split': {
        // three wisps circle you and dash in turn
        this.orbit += dt * 0.9;
        this.dashT -= dt;
        this.group.visible = false;
        this.wisps = this.wisps.filter((w) => !w.dead);
        if (!this.wisps.length) {
          this.group.visible = true;
          this.x = 0; this.z = -1;
          this.setLook(true);
          this.go('dazed', 3.6);
          this.hits = 0;
          eng.poof(this.x, this.z, 0.8);
          eng.sfx('dizzy');
        }
        break;
      }
      case 'grow':
        this.st -= dt;
        this.cloud.scale.setScalar(1.5 + (1 - this.st / 1.5) * 1.0);
        this.y += (2.5 - this.y) * Math.min(1, dt * 2);
        this.x += (0 - this.x) * Math.min(1, dt * 2);
        this.z += (-2.6 - this.z) * Math.min(1, dt * 2);
        if (this.st <= 0) { this.go('drift', 0); this.driftTo = -4; this.attackT = 1.5; }
        break;
      case 'drift': {
        // drifts over the room's far side, pausing above the braziers' lines
        this.y = 2.5 + Math.sin(this.t * 1.5) * 0.1;
        this.z += (-2.6 - this.z) * Math.min(1, dt * 2);
        const tx = this.driftTo;
        if (Math.abs(this.x - tx) > 0.05) this.x += Math.sign(tx - this.x) * Math.min(Math.abs(tx - this.x), dt * 2.2);
        else {
          this.pause = (this.pause || 0) + dt;
          if (this.pause > 3.2) { this.pause = 0; this.driftTo = tx < 0 ? 4 : -4; }
        }
        this.face = 's';
        this.attackT -= dt;
        if (this.attackT <= 0) {
          this.attackT = 2.2;
          const m = this.orbMarks.find((x) => !x.visible);
          if (m) { m.position.set(h.x, 0.03, h.z); m.visible = true; m.userData.t = 1.0; eng.sfx('charged'); }
        }
        break;
      }
      default: break;
    }
    // gloom orbs falling from above
    for (const m of this.orbMarks) {
      if (!m.visible) continue;
      m.userData.t -= dt;
      m.scale.setScalar(2 + m.userData.t * 1.6);
      if (m.userData.t <= 0) {
        m.visible = false;
        eng.puffAt(m.position.x, m.position.z, 0x3d2a66, 18, 0.3);
        eng.sfx('slam');
        if (Math.hypot(h.x - m.position.x, h.z - m.position.z) < 0.95) eng.hurtHero(2, m.position.x, m.position.z, 7);
      }
    }
    this.shadow.position.y = 0.02 - this.y;
    this.shadow.scale.setScalar(this.state === 'drift' || this.state === 'grow' ? 2.6 : 1.8);
    // the dark eats light: the braziers dim when it is huge and near
    if (room && this.state === 'drift') for (const e of this.eyes) e.scale.y = 1.3 + Math.sin(this.t * 4) * 0.2;
  }

  go(state, st) { this.state = state; this.st = st; }

  recover() {
    this.setLook(false);
    if (this.phase === 1 && this.hp <= 6) this.phase = 2;
    if (this.phase === 2 && this.hp <= 3) this.phase = 3;
    if (this.phase === 2) return this.splitUp();
    if (this.phase === 3) { this.go('grow', 1.5); this.eng.sfx('roar'); this.eng.shake(0.4); this.eng.later(5, () => { if (!this.dead) this.eng.hintOnce('lh.murk.hint3'); }); return; }
    this.go('float', 0);
    this.attackT = 1.6;
  }

  splitUp() {
    this.go('split', 0);
    this.dashNext = 0;
    this.dashT = 1.6;
    this.eng.sfx('poof');
    this.eng.poof(this.x, this.z, this.y);
    this.wisps = [0, 1, 2].map((i) => {
      const w = new MurkWisp(this.eng, this.x + Math.cos(i * 2.1), this.z + Math.sin(i * 2.1), this, i);
      this.eng.addEnemy(w);
      return w;
    });
  }

  hurt(dmg, sx, sz, src) {
    if (this.dead) return 'none';
    if (this.state === 'split' || this.state === 'grow') return 'none';
    if (this.state === 'drift') {
      if (src !== 'fire') {
        if (src === 'arrow') { this.eng.sparkAt(this.x, this.z); this.eng.hintOnce('lh.murk.hint3'); }
        return 'none';
      }
      if (this.flash > 0) return 'none';
      this.hp -= 1;
      this.flash = 0.6;
      this.eng.sfx('roar');
      this.eng.shake(0.25);
      // it blows out the brightest brazier it can reach
      const lit = this.eng.room.torches.filter((tc) => tc.lit);
      if (lit.length && this.hp > 0) this.eng.extinguish(lit.sort((a, b) => Math.hypot(a.x - this.x, a.z - this.z) - Math.hypot(b.x - this.x, b.z - this.z))[0]);
      if (this.hp <= 0) this.die();
      return 'hit';
    }
    if (this.state === 'solid' || this.state === 'dazed') {
      if (src === 'rope' || this.flash > 0) return 'none';
      this.hp -= Math.min(dmg, 2);
      this.flash = 0.35;
      this.hits = (this.hits || 0) + 1;
      this.eng.sfx('hit');
      if (this.hp <= 0) { this.die(); return 'hit'; }
      const end = this.phase === 1 ? this.hp <= 6 : this.hp <= 3;
      if (this.hits >= 3 || end) this.st = Math.min(this.st, 0.4);
      return 'hit';
    }
    // floating: only light makes it solid
    if (src === 'flame' || src === 'fire') {
      this.setLook(true);
      this.go('solid', 2.8);
      this.hits = 0;
      this.eng.sfx('dizzy');
      return 'hit';
    }
    if (src === 'sword' || src === 'spin') this.eng.sparkAt(this.x, this.z);
    return 'none';
  }

  die() {
    this.dead = true;
    for (const w of this.wisps) if (!w.dead) { w.dead = true; this.eng.poof(w.x, w.z, w.y); }
    for (const m of this.orbMarks) m.parent?.remove(m);
    this.eng.bossDown(this);
    for (let i = 0; i < 6; i++) this.eng.later(0.2 + i * 0.12, () => this.eng.puffAt((Math.random() - 0.5) * 3, -1.5 + (Math.random() - 0.5) * 2, 0xfff6c8, 10, 1));
  }
}

function ico(r) { return sharedGeo(`lh-e2ico${r}`, () => new THREE.IcosahedronGeometry(r, 0)); }

// ---------- factory ----------

export function makeEnemy2(eng, kind, x, z) {
  switch (kind) {
    case 'beetle': return new Beetle(eng, x, z);
    case 'wisp': return new Wisp(eng, x, z);
    case 'gull': return new Gull(eng, x, z);
    default: return null;
  }
}

export function makeBoss2(eng, kind, x, z) {
  let b = null;
  if (kind === 'mole') b = new Mole(eng, x, z);
  else if (kind === 'golem') b = new Golem(eng, x, z);
  else if (kind === 'beak') b = new Stormbeak(eng, x, z);
  else if (kind === 'murk') b = new Murk(eng, x, z);
  if (b) b.bossPart = true;
  return b;
}

export { YAWS, basic };
