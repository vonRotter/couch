import { makeCrawler, makeSpore, makeWisp, makeSpitter, makeBrute, makeQueen } from './models.js';
import { damp, rand } from './util.js';
import { PLATFORM } from './world.js';

// Alien types (ported from Spacefall, plus the Hive Queen for the co-op finale).
//   crawler  walks along floors and hops between decks (gravity maps only)
//   spore    slow drifting spiky blob (the zero-g stand-in for the crawler)
//   wisp     fast flying drone that weaves toward you
//   spitter  keeps its distance and lobs goo bolts when it can see you
//   brute    tough; winds up and charges in a straight line
//   queen    the last co-op wave: lots of hits, goo fans and calls in helpers

export const ALIEN_TYPES = {
  crawler: { hp: 1, hw: 0.34, hh: 0.24, speed: 2.6, score: 100, make: makeCrawler, color: 0x6fd86a },
  spore: { hp: 1, hw: 0.3, hh: 0.3, speed: 2.3, score: 100, make: makeSpore, color: 0x9ae65a },
  wisp: { hp: 1, hw: 0.28, hh: 0.28, speed: 3.9, score: 100, make: makeWisp, color: 0xb455ff },
  spitter: { hp: 2, hw: 0.38, hh: 0.36, speed: 2.5, score: 200, make: makeSpitter, color: 0xf2d64b },
  brute: { hp: 4, hw: 0.45, hh: 0.45, speed: 2.1, score: 400, make: makeBrute, color: 0xe0525a },
  queen: { hp: 30, hw: 0.85, hh: 0.8, speed: 1.5, score: 2000, make: makeQueen, color: 0xff6fae },
};

export class Alien {
  constructor(match, type, x, y) {
    const T = ALIEN_TYPES[type];
    this.match = match;
    this.type = type;
    this.T = T;
    this.x = x; this.y = y; this.vx = 0; this.vy = 0;
    this.hw = T.hw; this.hh = T.hh;
    this.hp = type === 'queen' ? match.queenHp() : T.hp;
    this.maxHp = this.hp;
    this.speed = T.speed * match.alienSpeedScale;
    this.dead = false;
    this.t = rand(0, 10);
    this.flash = 0;
    this.dir = Math.random() < 0.5 ? -1 : 1;
    this.grounded = false;
    this.hopCd = 1;
    this.losT = 0;
    this.los = false;
    this.target = null;
    this.idleT = 0;
    this.shootCd = rand(1.2, 2.4);
    this.summonCd = 5;
    this.windup = 0;
    this.state = 'move';
    this.stateT = 0;
    this.chargeCd = 2;
    this.mesh = T.make();
    match.ents.add(this.mesh);
  }

  get flying() { return this.type !== 'crawler'; }
  get boss() { return this.type === 'queen'; }

  update(dt) {
    const m = this.match;
    this.t += dt;
    this.flash = Math.max(0, this.flash - dt);
    this.findTarget(dt);
    if (this.type === 'crawler') this.updateCrawler(dt);
    else this.updateFlyer(dt);
    this.sync(dt);
    // Aliens that never find anyone get re-rifted closer to the action.
    if (this.target && m.world.dist(this, this.target) < 13) this.idleT = 0;
    else this.idleT += dt;
    if (this.idleT > 12 && !this.boss) {
      this.idleT = 0;
      m.relocateAlien(this);
    }
  }

  findTarget(dt) {
    const m = this.match;
    let best = null, bestD = Infinity;
    for (const s of m.ships()) {
      if (!s.alive) continue;
      const d = m.world.dist(this, s);
      if (d < bestD) { bestD = d; best = s; }
    }
    this.target = best;
    this.targetDist = bestD;
    this.losT -= dt;
    if (this.losT <= 0) {
      this.losT = 0.2;
      this.los = !!best && bestD < 16 && m.world.lineOfSight(this.x, this.y, best.x, best.y);
    }
  }

  updateCrawler(dt) {
    const world = this.match.world;
    const tgt = this.target;
    let speed = this.speed;
    let dropThrough = false;
    this.hopCd -= dt;
    // The flow field ignores gravity, but its horizontal hint plus hops and drops gets crawlers between decks.
    const flow = world.flowDir(this.x, this.y);
    if (this.grounded) {
      let chasing = false;
      if (tgt) {
        const [dx, dy] = world.delta(this.x, this.y, tgt.x, tgt.y);
        if (Math.abs(dy) < 1.6 && Math.abs(dx) < 9 && this.los) {
          this.dir = Math.sign(dx) || this.dir;
          speed *= 1.6;
          chasing = true;
        }
        if (dy > 1.4 && Math.abs(dx) < 3.5 && this.hopCd <= 0) {
          this.vy = 12.5; this.hopCd = 1.6;
          this.dir = Math.sign(dx) || this.dir;
        }
      }
      if (!chasing && flow) {
        if (Math.abs(flow[0]) > 0.3) this.dir = Math.sign(flow[0]);
        if (flow[1] > 0.6 && this.hopCd <= 0) { this.vy = 12.5; this.hopCd = 1.4; }
        if (flow[1] < -0.6) dropThrough = true;
      }
      // Turn around at ledges unless the path leads down.
      const ax = Math.floor(this.x + this.dir * (this.hw + 0.15));
      const by = Math.floor(this.y - this.hh - 0.2);
      const floorAhead = world.solid(ax, by) || world.tile(ax, by) === PLATFORM;
      const wantDown = (flow && flow[1] < -0.3) || (tgt && tgt.y < this.y - 1);
      if (!floorAhead && !wantDown && Math.random() < 0.94) this.dir = -this.dir;
    }
    this.vx = damp(this.vx, this.dir * speed, 10, dt);
    this.vy = Math.max(-12, this.vy - 18 * dt);
    const res = world.move(this, this.vx * dt, this.vy * dt, true, dropThrough);
    if (res.left || res.right) {
      // Hop over low obstacles before turning around.
      if (this.grounded && this.hopCd <= 0 && !world.solid(Math.floor(this.x + this.dir), Math.floor(this.y + 1))) {
        this.vy = 9; this.hopCd = 0.8;
      } else {
        this.dir = -this.dir;
      }
      this.vx = 0;
    }
    this.grounded = res.down;
    if (res.down || (res.up && this.vy > 0)) this.vy = 0;
  }

  updateFlyer(dt) {
    const m = this.match, world = m.world;
    const tgt = this.target;
    let dx = 0, dy = 0;
    let toT = null;
    if (tgt) {
      const [ddx, ddy] = world.delta(this.x, this.y, tgt.x, tgt.y);
      const d = Math.hypot(ddx, ddy) || 1;
      toT = [ddx / d, ddy / d, d];
    }
    if (toT && this.los && toT[2] < 12) { dx = toT[0]; dy = toT[1]; }
    else {
      const f = world.flowDir(this.x, this.y);
      if (f) { dx = f[0]; dy = f[1]; }
      else if (toT) { dx = toT[0]; dy = toT[1]; }
    }
    let speed = this.speed;
    let rate = 3;

    if (this.type === 'wisp') {
      const w = Math.sin(this.t * 4) * 0.8;
      dx += -dy * w; dy += dx * w;
    } else if (this.type === 'spitter' || this.type === 'queen') {
      const boss = this.boss;
      if (toT && this.los) {
        const d = toT[2];
        // Keep a comfortable distance and circle the target.
        if (d < (boss ? 5 : 4.5)) { dx = -toT[0]; dy = -toT[1]; }
        else if (d < (boss ? 8 : 7.5)) {
          const side = Math.sin(this.t * 0.7) > 0 ? 1 : -1;
          dx = -toT[1] * side * 0.7; dy = toT[0] * side * 0.7;
        }
        this.shootCd -= dt;
        if (this.shootCd <= 0 && d < 13 && this.windup <= 0) this.windup = boss ? 0.8 : 0.5;
      }
      if (boss) {
        // Calls a pair of helpers through rifts now and then.
        this.summonCd -= dt;
        if (this.summonCd <= 0) { this.summonCd = rand(8, 10) * (this.hp > this.maxHp / 2 ? 1 : 0.8); m.queenSummon(this); }
      }
      if (this.windup > 0) {
        this.windup -= dt;
        speed *= 0.2;
        if (this.windup <= 0 && tgt) {
          this.shootCd = (boss ? rand(3, 4) * (this.hp > this.maxHp / 2 ? 1 : 0.8) : rand(1.8, 2.8)) / m.alienSpeedScale;
          const [ex, ey] = world.delta(this.x, this.y, tgt.x + tgt.vx * 0.3, tgt.y + tgt.vy * 0.2);
          const base = Math.atan2(ey, ex);
          const spread = boss ? [-0.3, 0, 0.3] : [0];
          for (const off of spread) {
            const a = base + off;
            const sp = boss ? 6 : 7.5;
            m.spawnBolt(this.x + Math.cos(a) * (this.hw + 0.2), this.y + Math.sin(a) * (this.hh + 0.2), Math.cos(a) * sp, Math.sin(a) * sp);
          }
          m.sfx('spit');
        }
      }
    } else if (this.type === 'brute') {
      this.stateT -= dt;
      this.chargeCd -= dt;
      if (this.state === 'move' && toT && this.los && toT[2] < 8.5 && this.chargeCd <= 0) {
        this.state = 'windup';
        this.stateT = 0.65;
        this.chargeDir = [toT[0], toT[1]];
        m.sfx('charge');
      }
      if (this.state === 'windup') {
        speed = 0; rate = 8;
        if (this.stateT <= 0) { this.state = 'charge'; this.stateT = 0.75; }
      } else if (this.state === 'charge') {
        dx = this.chargeDir[0]; dy = this.chargeDir[1];
        speed = 11.5; rate = 20;
        if (Math.random() < 0.8) m.sparks.emit(this.x, this.y, 0, 0, 0, 0.35, 0.9, 0.1, 0xff7b54, { alpha: 0.4 });
        if (this.stateT <= 0) { this.state = 'move'; this.chargeCd = rand(2.2, 3.2); }
      } else if (this.state === 'stun') {
        speed = 0; rate = 4;
        if (this.stateT <= 0) this.state = 'move';
      }
    } else {
      const w = Math.sin(this.t * 2) * 0.3;
      dx += -dy * w; dy += dx * w;
    }

    const mag = Math.hypot(dx, dy) || 1;
    this.vx = damp(this.vx, (dx / mag) * speed, rate, dt);
    this.vy = damp(this.vy, (dy / mag) * speed, rate, dt);
    const res = world.move(this, this.vx * dt, this.vy * dt, false);
    const hitWall = res.left || res.right || res.up || res.down;
    if (res.left || res.right) this.vx *= -0.4;
    if (res.up || res.down) this.vy *= -0.4;
    if (hitWall && this.state === 'charge') {
      this.state = 'stun';
      this.stateT = 0.7;
      this.chargeCd = rand(2.2, 3.2);
      m.shake(0.4, this.x, this.y);
      m.puff(this.x, this.y, 0xddd0c0, 8);
    }
  }

  damage(n, by, dirX = 0, dirY = 0) {
    if (this.dead) return false;
    this.hp -= n;
    this.flash = 0.15;
    const kb = this.type === 'brute' ? 3 : this.boss ? 1.2 : 6;
    this.vx += dirX * kb; this.vy += dirY * kb;
    if (this.state === 'charge') { this.state = 'stun'; this.stateT = 0.4; }
    this.match.sfx('hit');
    this.match.sparks.burst(this.x, this.y, this.T.color, 10, 4, 0.35, 0.3);
    if (this.hp <= 0) { this.die(by); return true; }
    return false;
  }

  die(by) {
    if (this.dead) return;
    const m = this.match;
    this.remove();
    m.boom(this.x, this.y, this.T.color, this.type === 'brute' || this.boss, true);
    if (this.boss) for (let i = 0; i < 4; i++) m.later(0.15 * (i + 1), () => m.boom(this.x + rand(-1.2, 1.2), this.y + rand(-1, 1), this.T.color, true, true));
    m.onAlienKilled(this, by);
  }

  remove() {
    this.dead = true;
    this.match.ents.remove(this.mesh);
  }

  sync() {
    const mesh = this.mesh, u = mesh.userData;
    mesh.position.set(this.x, this.y, 0);
    const pulse = 1 + this.flash * 2;
    mesh.scale.setScalar(pulse);
    if (this.type === 'crawler') {
      mesh.rotation.y = this.dir > 0 ? -0.35 : Math.PI + 0.35;
      u.legs.forEach((l, i) => { l.rotation.z = Math.sin(this.t * 16 + i * 1.7) * 0.45; });
      u.body.scale.y = 0.72 + Math.sin(this.t * 8) * 0.04;
    } else if (this.type === 'wisp') {
      u.ring.rotation.x = this.t * 3;
      u.ring.rotation.y = this.t * 2;
      u.core.rotation.z = this.t * 2;
    } else if (this.type === 'spore') {
      u.core.rotation.z = this.t * 0.8;
      mesh.rotation.z = Math.sin(this.t * 1.3) * 0.3;
    } else if (this.type === 'spitter') {
      mesh.rotation.y = this.target && this.target.x < this.x ? Math.PI : 0;
      u.tentacles.forEach((tt, i) => { tt.rotation.z = Math.sin(this.t * 4 + i) * 0.35; });
      const w = this.windup > 0 ? 1 - this.windup / 0.5 : 0;
      u.glow.scale.setScalar(0.01 + w * 1.4);
      u.sac.scale.set(1 + w * 0.15, 0.9 + w * 0.15, 0.9);
    } else if (this.type === 'brute') {
      const facing = this.state === 'charge' && this.chargeDir ? this.chargeDir[0] : (this.target ? this.target.x - this.x : 1);
      mesh.rotation.y = facing < 0 ? Math.PI : 0;
      const wind = this.state === 'windup';
      u.glow.scale.setScalar(wind ? 0.8 + Math.sin(this.t * 40) * 0.2 : this.state === 'charge' ? 1 : 0.01);
      if (wind) mesh.position.x += Math.sin(this.t * 60) * 0.05;
      u.body.rotation.z = this.state === 'stun' ? Math.sin(this.t * 20) * 0.2 : 0;
    } else if (this.type === 'queen') {
      mesh.rotation.y = this.target && this.target.x < this.x ? Math.PI : 0;
      u.body.scale.set(1 + Math.sin(this.t * 3) * 0.05, 1 - Math.sin(this.t * 3) * 0.05, 1);
      u.pods.rotation.z = this.t * 1.2;
      const w = this.windup > 0 ? 1 - this.windup / 0.8 : 0;
      u.glow.scale.setScalar(0.01 + w);
    }
  }
}
