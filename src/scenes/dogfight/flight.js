// Paint Pilots flight model (side view, x right, y up).
// The stick points the nose (turn rate limited), the engine pulls along the nose, gravity pulls
// down and the wings carry the plane only when it is fast enough. Climb too steeply and the
// speed bleeds away: below the stall speed the wings stop lifting, the engine sputters and the
// nose drops until the dive has built up speed again. Same physics for players and bots.

export const FLY = {
  gravity: 12,
  thrust: 12,          // cruise engine (always on); equal to gravity, so straight up only coasts
  boostThrust: 22,     // [A] held
  drag: 0.04,          // quadratic drag: level cruise ~17, boost ~23
  grip: 4.5,           // how fast the velocity swings to follow the nose at full lift (momentum)
  liftZero: 3,         // below this speed the wings carry nothing
  liftFull: 10,        // at and above this the wings carry the whole weight
  stallSpeed: 6,        // slower than this for a moment: stall
  recoverSpeed: 11,    // diving faster than this ends the stall
  turn: 3.6,           // rad/s at full authority
  ceiling: 38,         // the air thins above here: less engine
  ceilingTop: 47,      // no engine at all up here
  groundY: 0.75,       // plane center height when the wheels touch the ground
  takeoff: 9,
  maxSpeed: 30,
  boostTime: 2.6,      // seconds of boost in a full tank
  boostRegen: 0.3,     // tank per second
};

const TAU = Math.PI * 2;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

/** Fresh flight state. dir: +1 faces right, -1 faces left. */
export function makeFlight(x, y, dir, speed = 0, grounded = false) {
  const ang = dir > 0 ? 0 : Math.PI;
  return {
    x, y, ang, vx: Math.cos(ang) * speed, vy: 0, grounded,
    facing: dir, stalled: false, stallT: 0, lowT: 0,
    boost: 1, boosting: false, boostLock: 0,
    rollT: 0, rollCd: 0, engine: true, dead: false,
    turnMul: 1, thin: 1, airT: 0,
  };
}

/** Airspeed along the nose. */
export function noseSpeed(f) {
  return f.vx * Math.cos(f.ang) + f.vy * Math.sin(f.ang);
}

/** Speed the wings feel: mostly along the nose, but a quick pull-up keeps most of the momentum. */
export function wingSpeed(f) {
  return Math.max(noseSpeed(f), Math.hypot(f.vx, f.vy) * 0.85);
}

/** Nose pitch relative to the way the plane faces (+ is nose up), -PI..PI. */
export function pitchOf(f) {
  return f.facing > 0 ? wrapAngle(f.ang) : wrapAngle(Math.PI - f.ang);
}

/**
 * One flight step. ctl = { x, y, boost, rollPressed }. Returns an event string or ''.
 * Events: 'stall', 'recover', 'roll', 'boost', 'liftoff'.
 */
export function flightStep(f, ctl, dt) {
  let ev = '';
  const s = wingSpeed(f);
  const mag = Math.hypot(ctl.x, ctl.y);
  f.rollCd -= dt;
  f.boostLock -= dt;
  if (f.rollT > 0) f.rollT -= dt;

  // ---- steering ----
  if (f.dead) {
    f.ang += dt * 3.5 * f.facing; // tumbling wreck
  } else if (f.stalled) {
    // The nose falls toward straight down with a wobbly spin; the stick only helps a little.
    f.stallT += dt;
    const d = wrapAngle(-Math.PI / 2 - f.ang);
    f.ang += clamp(d, -2.6 * dt, 2.6 * dt) + Math.sin(f.stallT * 9) * 1.4 * dt;
    if (mag > 0.35) {
      const dd = wrapAngle(Math.atan2(ctl.y, ctl.x) - f.ang);
      f.ang += clamp(dd, -1, 1) * FLY.turn * 0.25 * dt;
    }
  } else if (mag > 0.35) {
    let d = wrapAngle(Math.atan2(ctl.y, ctl.x) - f.ang);
    // Turning all the way around: high up, dive around (keeps speed); low down, go up and over.
    if (Math.abs(d) > 2.5) {
      const upDir = Math.cos(f.ang) >= 0 ? 1 : -1;
      const way = f.y > 16 ? -upDir : upDir;
      if (Math.sign(d) !== way) d += way * TAU;
    }
    const auth = clamp(0.35 + 0.65 * s / 12, 0.35, 1) * f.turnMul;
    f.ang += clamp(d, -FLY.turn * auth * dt, FLY.turn * auth * dt);
  }
  f.ang = wrapAngle(f.ang);
  if (Math.cos(f.ang) > 0.2) f.facing = 1;
  else if (Math.cos(f.ang) < -0.2) f.facing = -1;

  // ---- on the ground: pitch limited, auto rotate for takeoff, slow U-turns ----
  if (f.grounded) {
    let p = pitchOf(f);
    if (ctl.y < -0.5) p -= dt * 2;
    else if (s > FLY.takeoff + 1 && mag < 0.35) p += dt * 0.6; // rotates by itself once fast enough
    if (s < 4 && mag > 0.5 && Math.sign(ctl.x) === -f.facing && Math.abs(ctl.x) > 0.6) {
      f.facing = -f.facing; // taxi U-turn
      f.vx *= -0.3;
      p = 0;
    }
    p = clamp(p, 0, 0.42);
    f.ang = f.facing > 0 ? p : Math.PI - p;
  }

  // ---- boost and barrel roll ----
  f.boosting = false;
  if (ctl.boost && f.boost > 0 && f.boostLock <= 0 && f.engine && !f.stalled && !f.dead) {
    if (!f.wasBoosting) ev = 'boost';
    f.boosting = true;
    f.boost = Math.max(0, f.boost - dt / FLY.boostTime);
    if (f.boost <= 0) f.boostLock = 0.6;
  } else if (!ctl.boost) {
    f.boost = Math.min(1, f.boost + dt * FLY.boostRegen);
  }
  f.wasBoosting = f.boosting;
  if (ctl.rollPressed && f.rollCd <= 0 && !f.stalled && !f.grounded && !f.dead) {
    f.rollT = 0.55;
    f.rollCd = 2.4;
    f.vx += Math.cos(f.ang) * 4;
    f.vy += Math.sin(f.ang) * 4;
    ev = 'roll';
  }

  // ---- forces ----
  const fx = Math.cos(f.ang), fy = Math.sin(f.ang);
  f.thin = clamp(1 - (f.y - FLY.ceiling) / (FLY.ceilingTop - FLY.ceiling), 0, 1);
  let thrust = f.engine && !f.dead ? (f.boosting ? FLY.boostThrust : FLY.thrust) : 0;
  thrust *= f.thin * (f.stalled ? 0.4 : 1);
  f.vx += fx * thrust * dt;
  f.vy += fy * thrust * dt;

  const sp = f.vx * fx + f.vy * fy;
  let lift = clamp((wingSpeed(f) - FLY.liftZero) / (FLY.liftFull - FLY.liftZero), 0, 1);
  if (f.stalled) lift *= 0.25;
  if (f.dead) lift *= 0.2;
  // Gravity along the nose always counts; across the nose the wings carry `lift` of it.
  const g = -FLY.gravity;
  const gPar = g * fy;
  const gx = gPar * fx, gy = gPar * fy;
  f.vx += (gx + (1 - lift) * (0 - gx)) * dt;
  f.vy += (gy + (1 - lift) * (g - gy)) * dt;
  // Wings swing the velocity toward the nose, keeping most of the speed (a little is lost
  // in hard turns). Flying tail first, they only damp the sideways slide.
  const v = Math.hypot(f.vx, f.vy);
  if (v > 0.01) {
    const aoa = wrapAngle(f.ang - Math.atan2(f.vy, f.vx));
    const k = Math.min(1, FLY.grip * lift * dt);
    if (Math.abs(aoa) < Math.PI / 2) {
      const a = Math.atan2(f.vy, f.vx) + aoa * k;
      const keep = v * (1 - 0.25 * Math.abs(aoa) * k);
      f.vx = Math.cos(a) * keep;
      f.vy = Math.sin(a) * keep;
    } else {
      const px = f.vx - fx * sp, py = f.vy - fy * sp;
      f.vx -= px * k;
      f.vy -= py * k;
    }
  }
  const speed = Math.hypot(f.vx, f.vy);
  const dk = Math.max(0, 1 - FLY.drag * speed * dt);
  f.vx *= dk; f.vy *= dk;
  if (f.grounded) f.vx *= Math.max(0, 1 - 0.35 * dt);
  const sp2 = Math.hypot(f.vx, f.vy);
  if (sp2 > FLY.maxSpeed) { f.vx *= FLY.maxSpeed / sp2; f.vy *= FLY.maxSpeed / sp2; }

  f.x += f.vx * dt;
  f.y += f.vy * dt;

  if (f.grounded) {
    if (f.vy > 0.6 && f.y > FLY.groundY + 0.05) {
      f.grounded = false;
      f.airT = 0;
      ev = 'liftoff';
    } else {
      f.y = FLY.groundY;
      f.vy = Math.max(0, f.vy);
    }
  } else {
    f.airT += dt;
  }

  // ---- stall ----
  if (!f.grounded && !f.dead) {
    const s3 = wingSpeed(f);
    if (!f.stalled) {
      const slow = s3 < FLY.stallSpeed || (f.thin < 0.4 && s3 < 10);
      f.lowT = slow ? f.lowT + dt : 0;
      if (f.lowT > 0.25) {
        f.stalled = true;
        f.stallT = 0;
        ev = 'stall';
      }
    } else if ((s3 > FLY.recoverSpeed && Math.sin(f.ang) < -0.15) || f.stallT > 4) {
      f.stalled = false;
      f.lowT = 0;
      ev = 'recover';
    }
  } else if (f.grounded) {
    f.stalled = false;
    f.lowT = 0;
  }
  return ev;
}

/**
 * Grumble pilot brain. Picks the nearest foe, leads the shot, keeps clear of the ground,
 * the ceiling and the walls, and avoids slow steep climbs. Returns a control object.
 * skill: { turn, cone, react, jitter, lead, dodge }.
 */
export function botControl(me, foes, time, dt, skill, xw, pelletSpeed, dodgeThreat) {
  const f = me.fl;
  const out = { x: 0, y: 0, boost: false, fire: false, rollPressed: false };
  const s = wingSpeed(f);
  me.brain = me.brain || { aimT: 0, wander: Math.random() * 10, fireHold: 0 };
  const br = me.brain;

  if (f.grounded) {
    // Roll down the runway, then pull up once fast enough.
    out.x = f.facing;
    out.y = s > FLY.takeoff ? 0.5 : 0;
    out.boost = true;
    return out;
  }

  let target = null, best = Infinity;
  for (const o of foes) {
    const d = Math.hypot(o.x - f.x, o.y - f.y) * (o.big ? 1.3 : 1);
    if (d < best) { best = d; target = o; }
  }
  let want;
  if (target) {
    const t = Math.min(1.2, best / pelletSpeed) * skill.lead;
    const ax = target.x + target.vx * t - f.x;
    const ay = target.y + target.vy * t - f.y;
    want = Math.atan2(ay, ax) + Math.sin(time * 0.9 + br.wander) * skill.jitter;
  } else {
    want = f.facing > 0 ? Math.sin(time * 0.4 + br.wander) * 0.3 : Math.PI - Math.sin(time * 0.4 + br.wander) * 0.3;
  }

  // Don't climb steeply when slow: that is how you stall.
  const pitchWant = f.facing > 0 ? wrapAngle(want) : wrapAngle(Math.PI - want);
  if (s < 12 && pitchWant > 0.55 && Math.abs(pitchWant) < Math.PI - 0.55) {
    const lim = s < 9 ? 0.15 : 0.55;
    want = f.facing > 0 ? lim : Math.PI - lim;
  }
  // Safety: ground, ceiling, walls.
  const alt = f.y - FLY.groundY;
  const sink = Math.max(0, -f.vy);
  if (alt < 5 + sink * 0.7) want = f.facing > 0 ? 0.8 : Math.PI - 0.8;
  else if (f.y > FLY.ceiling - 3) want = f.facing > 0 ? -0.35 : Math.PI + 0.35;
  if (f.x > xw - 7 && Math.cos(f.ang) > -0.3) want = Math.PI - 0.6;
  else if (f.x < -xw + 7 && Math.cos(f.ang) < 0.3) want = 0.6;

  out.x = Math.cos(want);
  out.y = Math.sin(want);

  // Fire when the nose has been on target for a moment.
  if (target) {
    const toT = Math.atan2(target.y - f.y, target.x - f.x);
    const err = Math.abs(wrapAngle(toT - f.ang));
    const cone = skill.cone * (target.big ? 2.2 : 1);
    if (err < cone && best < 26) br.aimT += dt; else br.aimT = Math.max(0, br.aimT - dt * 3);
    out.fire = br.aimT > skill.react;
    out.boost = best > 28 && f.boost > 0.5 && Math.abs(pitchWant) < 0.6;
  }
  if (dodgeThreat && f.rollCd <= 0 && Math.random() < skill.dodge) out.rollPressed = true;
  return out;
}
