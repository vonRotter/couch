import { SHIP, GRAV, ZERO } from './config.js';
import { makeShip, makeAmmoRack } from './models.js';
import { angleDiff, clamp, damp, rand } from './util.js';
import { t } from '../../core/i18n.js';

// A pilot's ship (ported from Spacefall's Ship). Gravity maps: run along floors, thrust up on a
// recharging tank, stomp from above. Zero-g maps: drift with inertia, bounce off walls, boost.
// Controls per step: { x, y, analog, aimX, aimY, aimActive, thrust, fire, dash } where fire and
// dash are "pressed this step".

const IDLE = { x: 0, y: 0, aimX: 0, aimY: 0, aimActive: false, analog: false, thrust: false, fire: false, dash: false };
const OCT = Math.PI / 4;

export class Ship {
  constructor(match, pl) {
    this.match = match;
    this.pl = pl;
    this.color = pl.hex;
    this.hw = SHIP.halfW;
    this.hh = SHIP.halfH;
    this.mesh = makeShip({ color: pl.hex, hat: pl.hat, grumble: pl.grumble, wing: pl.wing });
    this.rack = makeAmmoRack(pl.hex, SHIP.maxAmmo);
    this.alive = false;
    this.x = 0; this.y = 0; this.vx = 0; this.vy = 0;
    this.prevY = 0;
    this.side = 1;
    this.turnY = 0;
    this.thrusting = 0;
    this.ammo = 0;
  }

  spawn(pos) {
    const m = this.match;
    this.x = pos.x; this.y = pos.y;
    this.vx = 0; this.vy = 0;
    this.prevY = this.y;
    this.alive = true;
    this.ammo = SHIP.startAmmo;
    this.fuel = 1;
    this.facing = pos.x < m.world.w / 2 ? 1 : -1;
    this.aim = this.facing > 0 ? 0 : Math.PI;
    this.side = this.facing;
    this.turnY = this.side > 0 ? 0 : Math.PI;
    this.dashT = 0;
    this.dashCd = 0;
    this.dashGrace = 0;
    this.fireCd = 0.25;
    this.emptyT = 0;
    this.invuln = m.mode === 'versus' ? 0.4 : SHIP.respawnInvuln;
    this.shield = false;
    this.spread = 0;
    this.grounded = false;
    this.thrusting = 0;
    m.ents.add(this.mesh, this.rack);
    m.sparks.burst(this.x, this.y, this.color, 30, 5, 0.6, 0.35);
    m.puff(this.x, this.y, this.color, 10);
    this.sync(0);
  }

  get invulnerable() { return this.invuln > 0 || this.dashT > 0 || this.dashGrace > 0; }
  get dashing() { return this.dashT > 0 || this.dashGrace > 0; }

  update(dt, ctl) {
    if (!this.alive) return;
    const m = this.match;
    const s = m.controlsLocked || !ctl ? IDLE : ctl;

    this.invuln = Math.max(0, this.invuln - dt);
    this.dashCd = Math.max(0, this.dashCd - dt);
    this.fireCd = Math.max(0, this.fireCd - dt);
    this.dashGrace = Math.max(0, this.dashGrace - dt);
    this.prevY = this.y;
    // Nobody stays stuck without missiles: an empty rack slowly reloads one.
    if (this.ammo === 0 && !m.controlsLocked) {
      this.emptyT += dt;
      if (this.emptyT > SHIP.emptyRefill) { this.ammo = 1; this.emptyT = 0; m.addText(this.x, this.y + 0.8, '+1', this.pl.css, 0.8); }
    } else this.emptyT = 0;

    this.updateAim(s);
    if (s.dash && this.dashCd <= 0) this.startDash(s);

    if (this.dashT > 0) {
      this.dashT -= dt;
      if (Math.random() < 0.9) m.sparks.emit(this.x, this.y, 0, 0, 0, 0.25, 0.6, 0.1, this.color, { alpha: 0.6 });
      if (this.dashT <= 0) this.endDash();
    } else if (m.world.gravity) {
      this.moveGravity(dt, s);
    } else {
      this.moveZeroG(dt, s);
    }

    const dropThrough = m.world.gravity && s.y < -0.6;
    const res = m.world.move(this, this.vx * dt, this.vy * dt, m.world.gravity, dropThrough);
    if (m.world.gravity) {
      const was = this.grounded;
      this.grounded = res.down && this.vy <= 0;
      if (this.grounded && !was && this.vy < -6) m.puff(this.x, this.y - this.hh, 0xffffff, 4);
      if (res.down && this.vy < 0) this.vy = 0;
      if (res.up && this.vy > 0) this.vy = 0;
      if (res.left || res.right) this.vx = 0;
    } else {
      if (res.left || res.right) this.vx = -this.vx * ZERO.restitution;
      if (res.up || res.down) this.vy = -this.vy * ZERO.restitution;
    }

    if (s.fire && this.fireCd <= 0) this.fire();
    this.sync(dt);
  }

  updateAim(s) {
    let raw = null;
    let snapped = false;
    if (s.aimActive) {
      raw = Math.atan2(s.aimY, s.aimX);
    } else if (Math.hypot(s.x, s.y) > 0.3) {
      raw = Math.atan2(s.y, s.x);
      snapped = !s.analog;
    }
    if (s.x > 0.25) this.facing = 1;
    else if (s.x < -0.25) this.facing = -1;
    if (raw === null) raw = this.match.world.gravity ? (this.facing > 0 ? 0 : Math.PI) : this.aim;
    // Keyboards aim in 8 directions, with a little more help.
    if (snapped) raw = Math.round(raw / OCT) * OCT;
    this.aim = this.assist(raw, snapped ? 13 : SHIP.aimAssistDeg);
  }

  /** Nudge the aim onto a nearby target that is almost lined up. */
  assist(angle, deg) {
    const m = this.match;
    const limit = (deg * Math.PI) / 180;
    let best = angle, bestErr = limit;
    for (const tg of m.aimTargets(this)) {
      const [dx, dy] = m.world.delta(this.x, this.y, tg.x, tg.y);
      const d = Math.hypot(dx, dy);
      if (d > SHIP.aimAssistRange || d < 0.5) continue;
      const a = Math.atan2(dy, dx);
      const err = Math.abs(angleDiff(angle, a));
      if (err < bestErr && m.world.lineOfSight(this.x, this.y, tg.x, tg.y)) { best = a; bestErr = err; }
    }
    return best;
  }

  startDash(s) {
    let dx = s.x, dy = s.y;
    const mag = Math.hypot(dx, dy);
    if (mag < 0.3) { dx = Math.cos(this.aim); dy = Math.sin(this.aim); } else { dx /= mag; dy /= mag; }
    this.vx = dx * SHIP.dashSpeed;
    this.vy = dy * SHIP.dashSpeed;
    this.dashT = SHIP.dashTime;
    this.dashCd = SHIP.dashCooldown;
    this.dashGrace = SHIP.dashInvuln;
    this.fuel = Math.min(1, this.fuel + 0.15);
    this.match.sfx('dash');
    this.match.sparks.burst(this.x, this.y, 0xffffff, 10, 4, 0.3, 0.3);
  }

  endDash() {
    this.dashT = 0;
    if (this.match.world.gravity) {
      this.vx = clamp(this.vx, -GRAV.maxRun * 1.3, GRAV.maxRun * 1.3);
      this.vy = clamp(this.vy * 0.45, -GRAV.maxFall, GRAV.maxRise);
    } else {
      const sp = Math.hypot(this.vx, this.vy), cap = ZERO.maxSpeed * 1.1;
      if (sp > cap) { this.vx *= cap / sp; this.vy *= cap / sp; }
    }
  }

  moveGravity(dt, s) {
    const g = GRAV;
    const accel = this.grounded ? g.accelGround : g.accelAir;
    if (Math.abs(s.x) > 0.1) {
      this.vx += s.x * accel * dt;
    } else if (this.grounded) {
      const f = g.frictionGround * dt;
      this.vx = Math.abs(this.vx) <= f ? 0 : this.vx - Math.sign(this.vx) * f;
    } else {
      this.vx *= Math.exp(-g.dragAir * dt);
    }
    if (Math.abs(this.vx) > g.maxRun) this.vx = damp(this.vx, Math.sign(this.vx) * g.maxRun, 10, dt);

    this.vy -= g.gravity * dt;
    const thrust = s.thrust && this.fuel > 0;
    if (thrust) {
      this.vy += g.thrust * dt;
      this.fuel = Math.max(0, this.fuel - g.fuelUse * dt);
      this.thrusting = 1;
      this.emitExhaust(0, -1, 0xffb050);
    } else {
      this.thrusting = Math.max(0, this.thrusting - dt * 6);
      this.fuel = Math.min(g.fuelMax, this.fuel + (this.grounded ? g.fuelRegenGround : g.fuelRegenAir) * dt);
    }
    if (this.vy > g.maxRise) this.vy = damp(this.vy, g.maxRise, 12, dt);
    if (this.vy < -g.maxFall) this.vy = -g.maxFall;
    if (Math.abs(s.x) > 0.1 && this.grounded && Math.random() < 0.3) {
      this.match.sparks.emit(this.x - this.facing * 0.3, this.y - this.hh, 0, -this.facing * 1.5, 0.5, 0.3, 0.2, 0.05, 0xc8c0e8, { alpha: 0.5 });
    }
  }

  moveZeroG(dt, s) {
    const z = ZERO;
    const mag = Math.hypot(s.x, s.y);
    // [A] boosts in zero-g (it is its own button now, so keyboards get the boost too).
    const boost = s.thrust && this.fuel > 0 && mag > 0.2;
    const a = z.accel * (boost ? 1.9 : 1);
    this.vx += s.x * a * dt;
    this.vy += s.y * a * dt;
    const drag = mag > 0.1 ? z.drag : z.drag * 2;
    const k = Math.exp(-drag * dt);
    this.vx *= k; this.vy *= k;
    const cap = z.maxSpeed * (boost ? 1.35 : 1);
    const sp = Math.hypot(this.vx, this.vy);
    if (sp > cap) {
      const f = damp(sp, cap, 8, dt) / sp;
      this.vx *= f; this.vy *= f;
    }
    if (boost) {
      this.fuel = Math.max(0, this.fuel - GRAV.fuelUse * dt);
      this.thrusting = 1;
    } else {
      this.thrusting = Math.max(0, this.thrusting - dt * 6);
      this.fuel = Math.min(1, this.fuel + GRAV.fuelRegenAir * 2 * dt);
    }
    if (mag > 0.2) this.emitExhaust(s.x / mag, s.y / mag, boost ? 0xffd080 : 0x80c8ff, boost);
  }

  emitExhaust(ax, ay, color, strong = true) {
    const p = this.match.sparks;
    const n = strong ? 2 : 1;
    for (let i = 0; i < n; i++) {
      p.emit(
        this.x - ax * 0.4 + rand(-0.08, 0.08), this.y - ay * 0.4 + rand(-0.08, 0.08), rand(-0.1, 0.1),
        -ax * rand(4, 7) + this.vx * 0.3, -ay * rand(4, 7) + this.vy * 0.3,
        rand(0.15, 0.3), strong ? 0.45 : 0.32, 0.05, color, { drag: 3 },
      );
    }
  }

  fire() {
    const m = this.match;
    this.fireCd = SHIP.fireCooldown;
    if (this.ammo <= 0) {
      m.addText(this.x, this.y + 0.8, t('sf.empty'), '#ff5d73', 0.7);
      m.sfx('empty');
      return;
    }
    this.ammo--;
    const angles = [this.aim];
    if (this.spread > 0) {
      this.spread--;
      angles.push(this.aim + 0.2, this.aim - 0.2);
    }
    for (const a of angles) m.spawnMissile(this, a);
    m.sfx('shoot');
    const cx = Math.cos(this.aim), cy = Math.sin(this.aim);
    if (!m.world.gravity) { this.vx -= cx * 2; this.vy -= cy * 2; } // a little recoil in zero-g
    m.sparks.burst(this.x + cx * 0.6, this.y + cy * 0.6, 0xfff0c0, 6, 3, 0.15, 0.3);
  }

  /** Returns 'immune', 'shield' or 'dead'. */
  hit(killer, cause, dirX = 0, dirY = 0) {
    if (!this.alive || this.invulnerable) return 'immune';
    if (this.shield) {
      this.shield = false;
      this.invuln = 1.0;
      this.vx += dirX * 8; this.vy += dirY * 8;
      this.match.sfx('shieldBreak');
      this.match.sparks.burst(this.x, this.y, 0x8fd8ff, 30, 6, 0.5, 0.3);
      this.match.rumble(this.pl, 0.4, 120);
      return 'shield';
    }
    this.kill(killer, cause);
    return 'dead';
  }

  kill(killer, cause) {
    if (!this.alive) return;
    const m = this.match;
    this.alive = false;
    m.ents.remove(this.mesh, this.rack);
    m.boom(this.x, this.y, this.color, false);
    m.rumble(this.pl, 1, 300);
    // The missiles it carried spill out for anyone to grab.
    for (let i = 0; i < this.ammo; i++) {
      const a = rand(0.3, Math.PI - 0.3);
      m.dropMissile(this.x, this.y, Math.cos(a) * rand(2, 5), Math.sin(a) * rand(3, 7), this.color);
    }
    this.ammo = 0;
    m.onShipKilled(this, killer, cause);
  }

  sync(dt) {
    const mesh = this.mesh, u = mesh.userData;
    mesh.position.set(this.x, this.y, 0);
    // Face left or right by turning the whole ship around (cockpit stays on top), then tilt to the aim.
    const c = Math.cos(this.aim);
    if (c > 0.05) this.side = 1; else if (c < -0.05) this.side = -1;
    const turnTarget = this.side > 0 ? 0 : Math.PI;
    this.turnY = dt ? damp(this.turnY, turnTarget, 16, dt) : turnTarget;
    let rel = this.side > 0 ? this.aim : this.aim - Math.PI;
    rel = Math.atan2(Math.sin(rel), Math.cos(rel));
    mesh.rotation.z = rel;
    const bank = this.match.world.gravity ? clamp(this.vy * 0.04, -0.3, 0.3) : 0;
    u.turn.rotation.set(bank, this.turnY, 0);
    if (u.pilot) {
      u.pilot.targetYaw = this.side > 0 ? 0.6 : Math.PI - 0.6;
      u.pilot.update(dt, { moving: 0, grounded: true });
    }
    const f = 0.35 + this.thrusting * 0.9 + Math.random() * 0.12;
    u.flame.scale.set(f, 0.6 + this.thrusting * 0.5, 0.6 + this.thrusting * 0.5);
    u.shield.visible = this.shield;
    if (this.shield) { u.shield.rotation.y += 0.05; u.shield.rotation.x += 0.03; }
    u.halo.scale.setScalar(this.dashing ? 1.5 : 1.1);
    mesh.visible = this.invuln <= 0 || Math.floor(this.match.time * 14) % 2 === 0;
    // Missile pips float above the ship.
    const r = this.rack;
    r.position.set(this.x, this.y + 0.72, 0.3);
    r.visible = mesh.visible;
    const n = this.ammo, gap = 0.15;
    r.children.forEach((pip, k) => {
      pip.visible = k < n;
      pip.position.x = (k - (n - 1) / 2) * gap;
    });
  }
}
