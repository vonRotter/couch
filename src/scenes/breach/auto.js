// Bean Brigade: a simple greedy player. Tests use it to prove battles can be won, and the game uses
// it for the hint ("what would a helper bean do?"). For each mech in turn it tries every move and
// every target, plays the enemy phase on a copy and keeps the best-looking result. It also picks
// landing tiles for the deploy step (the suggested tiles, avoiding red marks).

import { mechs, bugs, reach, mechMove, mechTargets, mechAct, endTurn, idx, unitById, objectiveStatus, attackers, intentTiles, canDeploy, deployMech, beginBattle, waiting } from './rules.js';

/** How good a battle state looks after the bugs have attacked. */
function value(s, objectives = []) {
  let bugHp = 0;
  for (const b of bugs(s)) bugHp += b.hp * (b.boss ? 2.5 : 1.5);
  const c = structuredClone(s);
  endTurn(c);
  if (c.phase === 'lost') return -10000;
  let v = c.power * 40 + c.kills * 6 - bugHp;
  for (const m of mechs(c)) v += m.ko ? -25 : m.hp * 4 + (m.shield ? 2 : 0);
  for (const o of objectives) if (objectiveStatus(c, o).done) v += o.kind === 'kills' ? 0 : 12;
  if (c.phase === 'won') v += 50;
  return v;
}

/** The best { move: [x, y] | null, act: [x, y] | null, v } for one mech. */
export function bestFor(s, id, objectives = []) {
  const u = unitById(s, id);
  if (!u || u.ko || u.acted) return null;
  const spots = [null];
  if (!u.moved) for (const k of reach(s, u).keys()) spots.push([k % 8, Math.floor(k / 8)]);
  let best = { move: null, act: null, v: value(s, objectives) - 1 };
  for (const sp of spots) {
    const a = structuredClone(s);
    if (sp && !mechMove(a, id, sp[0], sp[1])) continue;
    const ua = unitById(a, id);
    const base = value(a, objectives);
    if (base > best.v) best = { move: sp, act: null, v: base };
    for (const tg of mechTargets(a, ua)) {
      const b = structuredClone(a);
      if (!mechAct(b, id, tg.x, tg.y)) continue;
      const v = b.phase === 'won' ? 99999 : b.phase === 'lost' ? -99999 : value(b, objectives);
      if (v > best.v) best = { move: sp, act: [tg.x, tg.y], v };
    }
  }
  return best;
}

/** Play a whole player turn greedily (mech by mech). Returns the actions taken. */
export function autoTurn(s, objectives = []) {
  const done = [];
  for (let pass = 0; pass < 3; pass++) {
    for (const m of mechs(s)) {
      if (m.ko || m.acted || s.phase !== 'player') continue;
      const b = bestFor(s, m.id, objectives);
      if (!b) continue;
      if (b.move) mechMove(s, m.id, b.move[0], b.move[1]);
      if (b.act) mechAct(s, m.id, b.act[0], b.act[1]);
      if (b.move || b.act) done.push({ id: m.id, ...b });
    }
  }
  return done;
}

/** Tiles the bugs will hit next (red marks). */
function dangerTiles(s) {
  const out = new Set();
  for (const b of attackers(s)) for (const h of intentTiles(s, b)) if (h.n > 0 || h.fire) out.add(idx(h.x, h.y));
  return out;
}

/**
 * Where a mech should land: its suggested start tile (levels.js) if it is free and not on a red mark,
 * else the free zone tile without a red mark that is nearest to it (else any free zone tile).
 */
export function deploySpot(s, def, id) {
  const m = unitById(s, id);
  if (!m || !s.deploy) return null;
  const [sx, sy] = def.start[m.slot] || s.deploy[0];
  const danger = dangerTiles(s);
  const free = s.deploy.filter(([x, y]) => canDeploy(s, x, y));
  if (!free.length) return null;
  const score = ([x, y]) => (danger.has(idx(x, y)) ? 100 : 0) + Math.abs(x - sx) + Math.abs(y - sy);
  return free.reduce((a, b) => (score(b) < score(a) ? b : a));
}

/** Land every waiting mech (helper choice) and start turn 1. */
export function autoDeploy(s, def) {
  for (const m of waiting(s)) { const p = deploySpot(s, def, m.id); if (p) deployMech(s, m.id, p[0], p[1]); }
  return beginBattle(s);
}

export { idx };
