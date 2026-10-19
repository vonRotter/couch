import { HZ } from './maps.js';

// Helper bots for Snowball Fort. They understand each mode at a basic level:
//   Snow Targets      stand in their half, lob at the other team's targets (gold ones first), wall up
//                     their own targets now and then, splat players who come close.
//   King of the Hill  walk to the ring, throw at whoever is in it, build a wall inside it.
//   Capture the Flag  one bot attacks (grab their flag, run it home), one defends (guard, chase the
//                     carrier, return a dropped flag). Everybody chases a nearby flag thief.
// Bots walk with the terrain's path finder, scoop when empty and pick up gifts that are close.

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

/** Called every frame for a bot; returns the stick and whether it scoops. Throws and builds directly. */
export function botBrain(S, e, dt) {
  const out = { ix: 0, iz: 0, scoop: false };
  e.think -= dt;
  e.buildTimer -= dt;
  if (e.power) e.powerHeld += dt;
  if (e.think <= 0) {
    e.think = 0.25 + Math.random() * 0.2;
    plan(S, e);
  }

  // Walk toward the goal along the path finder's waypoints.
  const g = e.goal;
  let moving = false;
  if (g) {
    const d = dist(e, g);
    if (d > g.tol) {
      if (!e.wp || dist(e, e.wp) < 0.35 || e.wpT <= 0) {
        e.wp = S.terrain.waypoint(e.x, e.z, g.x, g.z);
        e.wpT = 0.5;
      }
      e.wpT -= dt;
      let tx = e.wp.x - e.x, tz = e.wp.z - e.z;
      if (e.detour > 0) { tx = e.detX; tz = e.detZ; e.detour -= dt; }
      const l = Math.hypot(tx, tz) || 1;
      out.ix = tx / l; out.iz = tz / l;
      if (d < 1) { out.ix *= Math.max(0.4, d); out.iz *= Math.max(0.4, d); }
      e.dirX = out.ix / (Math.hypot(out.ix, out.iz) || 1);
      e.dirZ = out.iz / (Math.hypot(out.ix, out.iz) || 1);
      moving = true;
    } else if (e.task === 'scoop') {
      out.scoop = true;
    }
  }

  // Stuck against a snow wall or a crowd: sidestep for a moment.
  e.stuckT -= dt;
  if (e.stuckT <= 0) {
    const moved = Math.hypot(e.x - e.lastX, e.z - e.lastZ);
    if (moving && moved < 0.35 && e.slip <= 0) {
      const side = Math.random() < 0.5 ? 1 : -1;
      e.detX = -out.iz * side + out.ix * 0.3;
      e.detZ = out.ix * side + out.iz * 0.3;
      e.detour = 0.7;
      e.wp = null;
    }
    e.lastX = e.x; e.lastZ = e.z;
    e.stuckT = 1;
  }

  // Throw at the best thing in range.
  const tgt = pickTarget(S, e);
  if (tgt && !moving) faceTo(e, tgt);
  if (tgt && e.throwCd <= 0 && e.snow >= 1 && !S.terrain.inTunnel(e.x, e.z)) {
    faceTo(e, tgt);
    S.throwBall(e, lead(S, e, tgt));
    e.throwCd = S.mode === 'targets' ? 1.6 + Math.random() * 1.4 : 1.7 + Math.random() * 1.3;
  }

  // Gifts.
  if (e.power) usePowerMaybe(S, e, tgt);
  return out;
}

function faceTo(e, tgt) {
  const dx = tgt.x - e.x, dz = tgt.z - e.z, l = Math.hypot(dx, dz) || 1;
  e.dirX = dx / l; e.dirZ = dz / l;
}

/** Aim point with a little lead on moving players. */
function lead(S, e, tgt) {
  if (!tgt.ent) return tgt;
  const p = tgt.ent;
  const T = 0.35 + dist(e, p) / 32;
  return { x: p.x + p.vx * T * 0.35, y: p.y + 0.7, z: p.z + p.vz * T * 0.35 };
}

/** The best thing to throw at, or null. Returns { x, y, z, ent?, target? }. */
function pickTarget(S, e) {
  const range = 9 + (e.y > 0.5 ? 3 : 0);
  let best = null, bestScore = Infinity;
  for (const o of S.ents) {
    if (o.team === e.team || o.immune > 0 || S.terrain.inTunnel(o.x, o.z)) continue;
    const d = dist(e, o);
    if (d > range) continue;
    let sc = d;
    if (o.carry) sc -= 6; // the flag carrier first
    if (S.mode === 'koth' && S.inZone(o)) sc -= 4;
    if (S.mode === 'targets') sc += d < 5 ? 1 : 6; // in Snow Targets only close players are worth it
    if (sc < bestScore) { bestScore = sc; best = { x: o.x, y: o.y + 0.7, z: o.z, ent: o }; }
  }
  if (S.mode === 'targets') {
    for (const tg of S.targets) {
      if (tg.team === e.team || !tg.alive) continue;
      const d = Math.hypot(tg.hx - e.x, tg.hz - e.z);
      if (d > 15) continue;
      let sc = d * 0.5 - (tg.gold > 0 ? 6 : 0) - (tg === e.aimT ? 3 : 0);
      if (sc < bestScore) { bestScore = sc; best = { x: tg.hx, y: tg.hy, z: tg.hz, target: tg }; }
    }
  }
  return best;
}

function usePowerMaybe(S, e, tgt) {
  if (e.powerHeld < 0.6) return;
  const p = e.power;
  if (p === 'boots' || (p === 'triple' && e.snow >= 2)) { S.usePower(e); return; }
  if (p === 'giant' || p === 'freeze') {
    if (tgt && dist(e, tgt) < 9) { faceTo(e, tgt); S.usePower(e); }
    else if (e.powerHeld > 15 && tgt) { faceTo(e, tgt); S.usePower(e); }
    return;
  }
  if (p === 'fort') {
    const s = e.team ? 1 : -1;
    let good = false;
    if (S.mode === 'koth') good = S.inZone(e);
    else if (S.mode === 'ctf') good = !e.carry && dist(e, S.flags[e.team].home) < 4.5;
    else good = e.x * s > 4;
    if (good || e.powerHeld > 14) {
      e.dirX = -s; e.dirZ = 0;
      S.usePower(e);
    }
  }
}

/** Decide where to go and what to do (a few times a second). */
function plan(S, e) {
  const s = e.team ? 1 : -1;
  const carrying = !!e.carry;
  const set = (x, z, tol = 0.4) => { e.goal = { x, z, tol }; };

  // Out of snow: scoop (at the big pile if it is near).
  if (!carrying) {
    // The objective comes first: hill bots scoop inside the ring, flag attackers run without snow.
    const objective = (S.mode === 'koth' && !S.inZone(e)) || (S.mode === 'ctf' && (e.role === 'att' || S.flags[e.team].state !== 'home'));
    if (e.task === 'scoop' && e.snow < e.wantSnow && !objective) return;
    if (e.snow < 1 && !objective) {
      e.task = 'scoop';
      e.wantSnow = 3 + Math.floor(Math.random() * 3);
      const pile = S.piles[e.team];
      if (dist(e, pile) < 6 || S.mode === 'targets') {
        const p = S.terrain.findFree(pile.x - s * 0.9, pile.z + (e.slot ? 0.9 : -0.9), 0.45);
        set(p.x, p.z, 0.5);
      } else {
        set(e.x, e.z, 99);
      }
      return;
    }
  }
  e.task = 'move';

  // A gift close by.
  if (!e.power && !carrying) {
    let spot = null, sd = 6;
    for (const sp of S.spots) {
      if (!sp.item) continue;
      if (S.mode === 'targets' && sp.x * s < -0.5) continue;
      const d = dist(e, sp);
      if (d < sd) { sd = d; spot = sp; }
    }
    if (spot) {
      const x = S.mode === 'targets' ? s * Math.max(0.8, spot.x * s) : spot.x;
      set(x, spot.z, 0.25);
      return;
    }
  }

  if (S.mode === 'targets') planTargets(S, e, s, set);
  else if (S.mode === 'koth') planHill(S, e, s, set);
  else planFlag(S, e, s, set);
}

function planTargets(S, e, s, set) {
  if (e.buildTarget) {
    const tg = e.buildTarget;
    const gx = tg.x - s * 1.15, gz = tg.z;
    if (e.snow < 3) e.buildTarget = null;
    else if (Math.hypot(gx - e.x, gz - e.z) < 0.4) {
      e.dirX = -s; e.dirZ = 0;
      S.tryBuild(e);
      e.buildTarget = null;
    } else { set(gx, gz, 0.3); return; }
  }
  if (!e.station || e.stationT <= 0 || (e.aimT && !e.aimT.alive)) {
    const live = S.targets.filter((tg) => tg.team !== e.team && tg.alive);
    const gold = live.filter((tg) => tg.gold > 0);
    e.aimT = (gold.length ? gold : live)[Math.floor(Math.random() * (gold.length || live.length))] || null;
    e.stationT = 4 + Math.random() * 4;
    const p = S.terrain.findFree(s * (1.6 + Math.random() * 3.6), clamp((e.aimT ? e.aimT.z * 0.5 : 0) + (Math.random() - 0.5) * 4, -HZ + 1, HZ - 1), 0.45);
    e.station = p;
  }
  e.stationT -= 0.35;
  set(e.station.x, e.station.z, 0.5);
  // Now and then shield one of our own targets that has no wall yet.
  if (e.buildTimer <= 0) {
    e.buildTimer = 14 + Math.random() * 12;
    const mine = S.walls.filter((w) => w.team === e.team).length;
    const open = S.targets.filter((tg) => tg.team === e.team && !S.walls.some((w) => w.team === e.team && Math.hypot(w.x - tg.x, w.z - tg.z) < 3));
    if (e.snow >= 3 && mine < 4 && open.length) e.buildTarget = open[Math.floor(Math.random() * open.length)];
  }
}

function planHill(S, e, s, set) {
  const z = S.zone;
  const a = e.slot * 2.2 + e.team * 1.1 + (e.p ? 0.5 : 0);
  const rad = z.r ? z.r * 0.45 : 0.5;
  set(z.x + Math.cos(a) * rad, z.z + Math.sin(a) * rad * 0.8, 0.45);
  // Inside the ring with spare snow: put up a wall facing the other team.
  if (S.inZone(e) && e.buildTimer <= 0 && e.snow >= 4) {
    e.buildTimer = 12 + Math.random() * 10;
    e.dirX = -s; e.dirZ = 0;
    S.tryBuild(e);
  }
}

function planFlag(S, e, s, set) {
  const mine = S.flags[e.team], theirs = S.flags[1 - e.team];
  if (e.carry) { set(mine.home.x, mine.home.z, 0.3); return; }
  if (mine.state === 'dropped') { set(mine.x, mine.z, 0.2); return; }
  if (mine.state === 'carried' && (e.role === 'def' || dist(e, mine.carrier) < 9)) {
    set(mine.carrier.x, mine.carrier.z, 1.2);
    return;
  }
  if (e.role === 'att') {
    if (theirs.state === 'carried') {
      // Escort our carrier: walk a little ahead of them toward home.
      const c = theirs.carrier;
      set(c.x + s * 1.5, clamp(c.z + (e.slot ? 1.4 : -1.4), -HZ + 1, HZ - 1), 0.8);
    } else {
      set(theirs.x, theirs.z, 0.2);
    }
    return;
  }
  // Defender: stand between our flag and the middle, drift toward the nearest attacker.
  let threat = null, td = 10;
  for (const o of S.ents) {
    if (o.team === e.team) continue;
    const d = dist(o, mine.home);
    if (d < td) { td = d; threat = o; }
  }
  const gz = threat ? clamp(threat.z * 0.6, -3, 3) : 0;
  const p = S.terrain.findFree(mine.home.x - s * 3.2, gz, 0.45);
  set(p.x, p.z, 0.6);
  if (e.buildTimer <= 0 && e.snow >= 4 && dist(e, mine.home) < 4.5) {
    e.buildTimer = 15 + Math.random() * 10;
    e.dirX = -s; e.dirZ = 0;
    S.tryBuild(e);
  }
}

