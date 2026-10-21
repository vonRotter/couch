import { rand } from './util.js';

// Grumble bot pilots for Versus and Frenzy when only one or two people play. They path through
// the map with a BFS distance field (from Spacefall's simulation bots), pick missiles back up when
// empty, fire when lined up (with a reaction delay and a wobbly aim so they can be beaten) and
// sometimes dash into incoming missiles to catch them.

const SKILL = { react: 0.35, jitter: 0.12, fireCd: [0.9, 1.9], dodge: 0.35, keepAway: 3.5 };

export class BotBrain {
  constructor(match, pl) {
    this.match = match;
    this.pl = pl;
    this.plan = null;
    this.planT = 0;
    this.seenT = 0;
    this.fireCd = rand(0.8, 1.6);
    this.wobble = 0;
    this.wobbleT = 0;
    this.lastPos = null;
    this.stuckT = 0;
    this.unstick = 0;
    this.unstickDir = [0, 1];
    this.dodgeCd = 0;
    this.ctl = { x: 0, y: 0, analog: true, aimX: 0, aimY: 0, aimActive: false, thrust: false, fire: false, dash: false };
  }

  nearest(list) {
    const ship = this.pl.ship, w = this.match.world;
    let best = null, bd = Infinity;
    for (const tg of list) {
      const d = w.dist(ship, tg);
      if (d < bd) { bd = d; best = tg; }
    }
    return [best, bd];
  }

  /** Controls for this step. */
  control(dt) {
    const c = this.ctl;
    const m = this.match, w = m.world, ship = this.pl.ship;
    c.x = 0; c.y = 0; c.thrust = false; c.fire = false; c.dash = false; c.aimActive = false;
    if (!ship.alive || m.controlsLocked) return c;
    this.fireCd -= dt;
    this.dodgeCd -= dt;
    this.planT -= dt;
    this.wobbleT -= dt;
    if (this.wobbleT <= 0) { this.wobbleT = rand(0.4, 0.9); this.wobble = rand(-1, 1) * SKILL.jitter; }

    const [tg, d] = this.nearest(m.aimTargets(ship));
    let goal = tg;
    const pickups = m.missiles.filter((mi) => mi.pickable);
    if (pickups.length && (ship.ammo === 0 || (ship.ammo < 3 && this.nearest(pickups)[1] < 5))) goal = this.nearest(pickups)[0];
    // Co-op: fly into a teammate's bubble to rescue them, unless an alien is right on us.
    const pod = m.mode === 'coop' && m.pods.find((pd) => pd.kind === 'rescue' && pd.pl !== this.pl);
    if (pod && !(tg && d < 4)) goal = pod;
    if (!goal) goal = m.crates[0] || null;

    let dx = 0, dy = 0;
    if (goal) {
      if (!this.plan || this.plan.goal !== goal || this.planT <= 0) {
        this.plan = { goal, field: w.distanceField(goal.x, goal.y) };
        this.planT = 0.4;
      }
      const seen = w.lineOfSight(ship.x, ship.y, goal.x, goal.y);
      if (seen) [dx, dy] = w.delta(ship.x, ship.y, goal.x, goal.y);
      else {
        const f = w.flowDir(ship.x, ship.y, this.plan.field, true);
        if (f) [dx, dy] = f;
        else [dx, dy] = w.delta(ship.x, ship.y, goal.x, goal.y);
      }
      const mag = Math.hypot(dx, dy) || 1;
      dx /= mag; dy /= mag;
      // Don't hug the target: back off a little when close and in sight.
      if (goal === tg && d < SKILL.keepAway && seen && ship.ammo > 0) { dx = -dx; dy = -dy * 0.5; }
    }

    // Unstick: if we've barely moved for a while, wander off in a random direction.
    if (this.lastPos && Math.hypot(ship.x - this.lastPos.x, ship.y - this.lastPos.y) < 0.02) this.stuckT += dt;
    else this.stuckT = Math.max(0, this.stuckT - dt);
    this.lastPos = { x: ship.x, y: ship.y };
    if (this.stuckT > 1.2) { this.unstick = 0.6; this.stuckT = 0; const a = rand(0, Math.PI * 2); this.unstickDir = [Math.cos(a), Math.abs(Math.sin(a)) + 0.3]; }
    if (this.unstick > 0) { this.unstick -= dt; [dx, dy] = this.unstickDir; }

    c.x = dx;
    c.y = dy;
    if (w.gravity) {
      // Thrust to climb; otherwise only hold "down" when the path really goes down (drop through).
      c.thrust = dy > 0.3 || (ship.fuel > 0.7 && !ship.grounded && dy > -0.2 && Math.random() < 0.3);
      if (dy > -0.6) c.y = Math.max(0, c.y);
    } else {
      c.thrust = ship.fuel > 0.5 && Math.hypot(dx, dy) > 0.5 && Math.random() < 0.2;
    }

    // Aim and fire at the target once it has been in sight for a moment.
    if (tg) {
      const [ax, ay] = w.delta(ship.x, ship.y, tg.x, tg.y);
      const a = Math.atan2(ay, ax) + this.wobble;
      c.aimX = Math.cos(a); c.aimY = Math.sin(a); c.aimActive = true;
      const los = d < 14 && w.lineOfSight(ship.x, ship.y, tg.x, tg.y);
      this.seenT = los ? this.seenT + dt : 0;
      if (los && this.seenT > SKILL.react && ship.ammo > 0 && this.fireCd <= 0) {
        c.fire = true;
        this.fireCd = rand(...SKILL.fireCd);
      }
    }

    // Incoming missile? Sometimes dash into it to catch it.
    if (this.dodgeCd <= 0) {
      for (const mi of [...m.missiles, ...m.bolts]) {
        if ((mi.state && mi.state !== 'fly') || mi.owner === ship || mi.dead) continue;
        const [mx, my] = w.delta(mi.x, mi.y, ship.x, ship.y);
        const md = Math.hypot(mx, my);
        if (md < 2.6 && mx * mi.vx + my * mi.vy > 0) {
          this.dodgeCd = 0.8;
          if (Math.random() < SKILL.dodge) {
            c.dash = true;
            c.x = -mx / md; c.y = -my / md; // dash toward the missile: a catch
          }
          break;
        }
      }
    }
    return c;
  }
}
