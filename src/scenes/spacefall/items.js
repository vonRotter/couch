import { MISSILE } from './config.js';
import { makeMissile, makeCrate, makeBolt, makeRift } from './models.js';
import { rand } from './util.js';

// Missiles (flying, stuck in a wall, or dropped), supply crates, alien goo bolts and the rifts
// aliens arrive through. Ported from Spacefall.

export class Missile {
  constructor(match, owner, x, y, vx, vy, color, state = 'fly') {
    this.match = match;
    this.owner = owner;
    this.x = x; this.y = y; this.vx = vx; this.vy = vy;
    this.hw = 0.12; this.hh = 0.12;
    this.color = color;
    this.state = state;
    this.age = 0;
    this.angle = Math.atan2(vy, vx);
    this.spin = rand(-12, 12);
    this.dead = false;
    this.mesh = makeMissile(color);
    match.ents.add(this.mesh);
    this.sync();
  }

  get pickable() { return this.state !== 'fly' && this.age > 0.3; }

  update(dt) {
    this.age += dt;
    if (this.state === 'fly') this.updateFly(dt);
    else if (this.state === 'drop') this.updateDrop(dt);
    this.sync();
    // With respawns (frenzy, co-op) fresh missiles keep coming, so old ones fade away after a while,
    // like Balloon Archers' arrows. Versus rounds start clean anyway.
    if (this.state === 'stuck' && this.match.mode !== 'versus' && this.age > 20) {
      this.mesh.scale.setScalar(Math.max(0.01, 1.2 * (21 - this.age)));
      if (this.age > 21) this.remove();
    }
  }

  updateFly(dt) {
    const m = this.match, world = m.world;
    if (world.gravity) this.vy -= MISSILE.gravity * dt;
    const speed = Math.hypot(this.vx, this.vy);
    const steps = Math.max(1, Math.ceil((speed * dt) / 0.12));
    const sx = (this.vx * dt) / steps, sy = (this.vy * dt) / steps;
    this.angle = Math.atan2(this.vy, this.vx);
    const cx = Math.cos(this.angle), cy = Math.sin(this.angle);
    for (let i = 0; i < steps; i++) {
      const nx = this.x + sx, ny = this.y + sy;
      // Test the nose so missiles bury their tip in the wall.
      if (world.solidAt(nx + cx * 0.22, ny + cy * 0.22)) {
        this.x = nx; this.y = ny;
        this.stick();
        return;
      }
      this.x = nx; this.y = ny;
      world.wrapBody(this);
      if (m.missileHits(this)) return;
    }
    if (Math.random() < 0.8) {
      m.sparks.emit(this.x - cx * 0.35, this.y - cy * 0.35, 0, -cx * 2 + rand(-0.5, 0.5), -cy * 2 + rand(-0.5, 0.5), 0.3, 0.3, 0.05, this.color, { drag: 4 });
    }
  }

  stick() {
    this.state = 'stuck';
    this.vx = this.vy = 0;
    this.age = 0;
    this.match.sfx('stick');
    const cx = Math.cos(this.angle), cy = Math.sin(this.angle);
    this.match.sparks.burst(this.x + cx * 0.25, this.y + cy * 0.25, 0xffe0a0, 8, 4, 0.25, 0.18, { drag: 5 });
  }

  /** Turn a flying missile into a loose pickup (after it hits something). */
  drop(vx = rand(-2, 2), vy = rand(2, 4)) {
    this.state = 'drop';
    this.vx = vx; this.vy = vy;
    this.age = 0;
  }

  updateDrop(dt) {
    const world = this.match.world;
    if (world.gravity) {
      this.vy -= MISSILE.dropGravity * dt;
    } else {
      const k = Math.exp(-1.6 * dt);
      this.vx *= k; this.vy *= k;
    }
    const res = world.move(this, this.vx * dt, this.vy * dt, world.gravity);
    if (res.left || res.right) this.vx *= -0.3;
    if (res.up) this.vy *= -0.3;
    this.angle += this.spin * dt;
    if (world.gravity) {
      if (res.down) {
        this.vy = 0;
        this.vx *= 0.5;
        if (Math.abs(this.vx) < 0.3) this.rest();
      }
    } else {
      if (res.down) this.vy *= -0.3;
      if (Math.hypot(this.vx, this.vy) < 0.25) this.rest();
    }
  }

  rest() {
    this.state = 'stuck';
    this.vx = this.vy = 0;
    if (this.match.world.gravity) this.angle = Math.cos(this.angle) >= 0 ? 0.1 : Math.PI - 0.1;
  }

  sync() {
    const mesh = this.mesh;
    mesh.position.set(this.x, this.y, 0.1);
    mesh.rotation.z = this.angle;
    // A pulsing ring marks missiles waiting to be picked up.
    const ring = mesh.userData.ring;
    ring.visible = this.pickable;
    if (ring.visible) ring.scale.setScalar(0.85 + 0.25 * Math.sin(this.match.time * 6 + this.x));
  }

  remove() {
    this.dead = true;
    this.match.ents.remove(this.mesh);
  }
}

export class Crate {
  constructor(match, x, y) {
    this.match = match;
    this.x = x; this.y = y; this.vx = 0; this.vy = 0;
    this.hw = 0.32; this.hh = 0.27;
    this.age = 0;
    this.dead = false;
    this.mesh = makeCrate();
    match.ents.add(this.mesh);
    match.sparks.burst(x, y, 0xffd36a, 20, 4, 0.5, 0.3);
  }
  update(dt) {
    const world = this.match.world;
    this.age += dt;
    if (world.gravity) {
      this.vy = Math.max(-8, this.vy - 15 * dt);
      const res = world.move(this, 0, this.vy * dt, true);
      if (res.down) this.vy = 0;
    }
    const bob = world.gravity ? 0 : Math.sin(this.age * 2) * 0.1;
    this.mesh.position.set(this.x, this.y + bob, 0);
    this.mesh.rotation.y = Math.sin(this.age * 1.5) * 0.5;
    this.mesh.scale.setScalar(Math.min(1, this.age * 4));
  }
  remove() {
    this.dead = true;
    this.match.ents.remove(this.mesh);
  }
}

/** Goo bolt lobbed by spitters and the Hive Queen. */
export class Bolt {
  constructor(match, x, y, vx, vy) {
    this.match = match;
    this.x = x; this.y = y; this.vx = vx; this.vy = vy;
    this.hw = 0.14; this.hh = 0.14;
    this.life = 4;
    this.dead = false;
    this.mesh = makeBolt();
    match.ents.add(this.mesh);
  }
  update(dt) {
    const m = this.match;
    this.life -= dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    m.world.wrapBody(this);
    if (this.life <= 0 || m.world.solidAt(this.x, this.y)) {
      m.sparks.burst(this.x, this.y, 0x9cff2e, 12, 3, 0.4, 0.25);
      m.puff(this.x, this.y, 0x9ae65a, 3);
      this.remove();
      return;
    }
    if (Math.random() < 0.6) m.sparks.emit(this.x, this.y, 0, 0, 0, 0.3, 0.3, 0, 0x9cff2e, { alpha: 0.6 });
    this.mesh.position.set(this.x, this.y, 0.1);
  }
  remove() {
    this.dead = true;
    this.match.ents.remove(this.mesh);
  }
}

/** A swirling portal: after `duration` an alien of `type` pops out. */
export class Rift {
  constructor(match, x, y, type, duration = 1.1) {
    this.match = match;
    this.x = x; this.y = y;
    this.type = type;
    this.t = 0;
    this.duration = duration;
    this.dead = false;
    this.mesh = makeRift();
    this.mesh.position.set(x, y, 0.2);
    if (type === 'queen') this.mesh.scale.setScalar(2.2);
    match.ents.add(this.mesh);
    match.sfx('rift');
  }
  update(dt) {
    this.t += dt;
    const k = Math.min(1, this.t / this.duration);
    const u = this.mesh.userData;
    u.ring.rotation.z += dt * 6;
    u.ring2.rotation.z -= dt * 9;
    const s = 0.3 + k * 0.9;
    u.ring.scale.setScalar(s);
    u.ring2.scale.setScalar(s);
    u.inner.scale.setScalar(0.2 + k);
    if (Math.random() < 0.7) {
      const a = Math.random() * Math.PI * 2;
      this.match.sparks.emit(this.x + Math.cos(a) * 1.2, this.y + Math.sin(a) * 1.2, 0, -Math.cos(a) * 3, -Math.sin(a) * 3, 0.35, 0.25, 0.05, 0xc04dff, { drag: 0 });
    }
    if (this.t >= this.duration) {
      this.match.spawnAlien(this.type, this.x, this.y);
      this.match.sparks.burst(this.x, this.y, 0xc04dff, 26, 6, 0.5, 0.35);
      this.remove();
    }
  }
  remove() {
    this.dead = true;
    this.match.ents.remove(this.mesh);
  }
}
