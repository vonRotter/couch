// Reachability checker for Lighthouse Caves (pure data, runs in Node or the browser).
//
// It walks the tile grid of every room with the abilities found so far, collects every chest and
// item it can reach, solves rooms, opens doors and plays the townsfolk quests, until the finale is
// beaten. Abilities: the sword cuts bushes, the lantern burns thorns and lights torches, the rope
// hooks posts and chests and pulls items, crystal switches flip pegs (sword, thrown things, rope,
// arrows), the gloves lift boulders, bombs break cracked rock and cracked walls (also thrown over
// chasms), fins swim deep water, and the bow hits stone eyes and makes fire arrows that light
// torches across chasms.
//
// Because small keys can be spent in any order, it checks every order of opening key doors in each
// dungeon (the other dungeons follow one known-good order meanwhile) and makes sure every one still
// reaches the end (no key softlocks). It also lists "traps": tiles you can reach but not walk back
// from (only the room reset or a fall would get you out).
//
// Block / plate puzzles, timed torches and fights are assumed doable once the room is reached with
// the right items (they reset when you leave the room; the browser playthrough does them for real).
// Nodes are numbers: ((room * H + r) * W + c) * 8 + switch bits (one bit per dungeon).

import { W, H, DIRS, DOOR_TILES, TALL, FLOORISH, pegUp, parseMap, ROPE_RANGE, THROW_RANGE, ARROW_RANGE } from './tiles.js';
import { ROOMS, AREAS, DOORS, neighbor, START, QUESTS, GOLD_SHELLS } from './rooms.js';

const SOLID_ENTS = new Set(['chest', 'npc', 'sign', 'save', 'shop', 'decor', 'switch', 'lamp', 'well', 'eye']);
// What each boss fight needs besides the sword (an inner list means any one of them).
const BOSS_NEEDS = {
  moth: ['lantern'], crab: ['grapple'], bigblob: [], bigshell: [], mole: [], golem: ['bombs'],
  beak: ['bow', ['glove', 'bombs']], murk: ['lantern', 'grapple', 'bow'],
};
const TOOLS = new Set(['sword', 'lantern', 'grapple', 'glove', 'bombs', 'fins', 'bow']);
const T = W * H;
const DV = Object.values(DIRS);

// ---------- static room data ----------

const IDS = Object.keys(ROOMS);
const IDX = Object.fromEntries(IDS.map((id, i) => [id, i]));
const P = IDS.map((id) => {
  const def = ROOMS[id];
  const { grid, ents } = parseMap(def);
  for (const e of def.extra || []) ents.push({ ...e });
  const at = new Array(T).fill(null);
  for (const e of ents) at[e.r * W + e.c] = e;
  const doorAt = new Array(T).fill(null);
  for (const [d, [c, r]] of Object.entries(DOOR_TILES)) if (DOORS[id]?.[d]) doorAt[r * W + c] = DOORS[id][d];
  const kinds = new Set(ents.filter((e) => e.t === 'enemy').map((e) => e.kind));
  const has = (ch) => grid.some((row) => row.includes(ch));
  const nb = {};
  for (const d of Object.keys(DIRS)) nb[d] = neighbor(id, d);
  const swBit = { d1: 1, d2: 2, d3: 4 }[def.area] || 0;
  return {
    id, def, grid, ents, at, doorAt, kinds, nb, swBit, scroll: !!AREAS[def.area].scroll,
    pots: ents.some((e) => e.t === 'pot' || e.t === 'rock'), boulders: has('R'), cracks: has('C'),
    torches: [...grid.flatMap((row, r) => row.map((ch, c) => (ch === 't' ? [c, r] : null)))].filter(Boolean),
  };
});

const swOf = (R, mask) => ((mask & R.swBit) ? 1 : 0);
const node = (ri, c, r, sw) => ((ri * H + r) * W + c) * 8 + sw;
const unnode = (n) => { const sw = n & 7; let t = n >> 3; const c = t % W; t = (t - c) / W; const r = t % H; return [(t - r) / H, c, r, sw]; };

function doorOpen(door, st) {
  if (door.type === 'open') return true;
  if (door.type === 'shut') return st.solved.has(door.owner);
  return st.doors.has(door.id); // key / boss / bomb doors once opened
}

/** A puzzle's reward chest stands here (it appears once the room is solved). */
function rewardChestAt(R, c, r, st) {
  const rw = R.def.reward;
  return !!rw && rw.t === 'chest' && rw.at[0] === c && rw.at[1] === r && st.solved.has(R.id);
}

/** Tall things that stop the rope, arrows and throws (boulders you can lift, blown cracks and burnable thorns don't). */
function blocksLine(R, c, r, sw, st) {
  const ch = R.grid[r][c];
  if (ch === 'R' && st.items.has('glove')) return false;
  if (ch === 'C' && st.blown.has(`${R.id}:${c},${r}`)) return false;
  if (ch === '*' && st.items.has('lantern')) return false;
  return TALL.has(ch) || ((ch === 'x' || ch === 'y') && pegUp(ch, swOf(R, sw)));
}

function passable(R, c, r, sw, st) {
  if (c < 0 || r < 0 || c >= W || r >= H) return false;
  const i = r * W + c;
  const door = R.doorAt[i];
  if (door) return doorOpen(door, st);
  const e = R.at[i];
  if (e && SOLID_ENTS.has(e.t)) return false;
  if (e && e.t === 'gate') return st.solved.has(R.id);
  if (rewardChestAt(R, c, r, st)) return false;
  const ch = R.grid[r][c];
  if (ch === 'b') return st.items.has('sword');
  if (ch === '*') return st.items.has('lantern');
  if (ch === 'R') return st.items.has('glove');
  if (ch === 'C') return st.blown.has(`${R.id}:${c},${r}`);
  if (ch === '~') return st.items.has('fins');
  if (ch === 'x' || ch === 'y') return !pegUp(ch, swOf(R, sw));
  return FLOORISH.has(ch) || ch === 'v';
}
const standable = (R, c, r, sw, st) => passable(R, c, r, sw, st) && R.grid[r][c] !== 'o' && R.grid[r][c] !== '~';

/** Walk a straight line from (c, r) in direction v; calls visit(cc, rr, k) until it returns true or something tall stops it. */
function line(R, c, r, v, range, sw, st, visit) {
  for (let k = 1; k <= range; k++) {
    const cc = c + v.dx * k, rr = r + v.dz * k;
    if (cc < 0 || rr < 0 || cc >= W || rr >= H) return;
    if (visit(cc, rr, k)) return;
    const i = rr * W + cc;
    const e = R.at[i];
    if (e && SOLID_ENTS.has(e.t)) return;
    if (R.doorAt[i] && !doorOpen(R.doorAt[i], st)) return;
    if (blocksLine(R, cc, rr, sw, st)) return;
  }
}

/** Neighbors of a node: walking, edges, warps, rope pulls and switch flips. Also records rope-pulled items. */
function edges(ri, c, r, sw, st, pulled, flips, out) {
  const R = P[ri];
  const here = R.grid[r][c];
  for (const [d, v] of Object.entries(DIRS)) {
    if (here === 'v' && d !== 's') continue;
    const nc = c + v.dx, nr = r + v.dz;
    if (nc < 0 || nr < 0 || nc >= W || nr >= H) {
      if (!R.scroll || !R.nb[d]) continue;
      const N = P[IDX[R.nb[d]]];
      const tc = nc < 0 ? W - 1 : nc >= W ? 0 : nc;
      const tr = nr < 0 ? H - 1 : nr >= H ? 0 : nr;
      if (passable(N, tc, tr, sw, st)) out.push(node(IDX[N.id], tc, tr, sw));
      continue;
    }
    if (R.grid[nr][nc] === 'v' && d !== 's') continue;
    const e = R.at[nr * W + nc];
    // [B] on the well climbs down
    if (e && e.t === 'well') { out.push(node(IDX[e.to], e.at[0], e.at[1], sw)); continue; }
    if (!passable(R, nc, nr, sw, st)) continue;
    if (e && e.t === 'warp' && !(e.placed && st.crystals < e.placed)) {
      if (e.need && !st.items.has(e.need)) continue;
      out.push(node(IDX[e.to], e.at[0], e.at[1], sw));
      continue;
    }
    out.push(node(ri, nc, nr, sw));
  }
  const flipTo = (how) => { out.push(node(ri, c, r, sw ^ R.swBit)); flips.add(`${R.id}:${how}`); };
  const isSwitch = (cc, rr) => R.at[rr * W + cc]?.t === 'switch';
  if (R.swBit) {
    // Swing at an adjacent crystal switch
    if (st.items.has('sword')) for (const v of DV) if (isSwitch(c + v.dx, r + v.dz)) flipTo('sword');
    // Throw a pot, a boulder or a bomb at it, or shoot it
    const canThrow = R.pots || (R.boulders && st.items.has('glove')) || st.items.has('bombs');
    for (const v of DV) {
      if (canThrow) line(R, c, r, v, THROW_RANGE, sw, st, (cc, rr) => { if (isSwitch(cc, rr)) { flipTo('throw'); return true; } return false; });
      if (st.items.has('bow')) line(R, c, r, v, ARROW_RANGE, sw, st, (cc, rr) => { if (isSwitch(cc, rr)) { flipTo('bow'); return true; } return false; });
    }
  }
  // Rope
  if (st.items.has('grapple')) {
    for (const v of DV) {
      line(R, c, r, v, ROPE_RANGE, sw, st, (cc, rr, k) => {
        const i = rr * W + cc;
        if (R.doorAt[i]) return true;
        const e = R.at[i];
        const ch = R.grid[rr][cc];
        if (ch === '|' || (e && e.t === 'chest') || rewardChestAt(R, cc, rr, st)) {
          const ac = c + v.dx * (k - 1), ar = r + v.dz * (k - 1);
          if (k >= 2 && standable(R, ac, ar, sw, st)) out.push(node(ri, ac, ar, sw));
          return true;
        }
        if (e && e.t === 'switch') { if (R.swBit) flipTo('rope'); return true; }
        if (e && e.t === 'item' && e.id) pulled.add(e.id);
        return false;
      });
    }
  }
}

function reach(st, from, withGraph = false) {
  const seen = new Uint8Array(IDS.length * T * 8);
  const tiles = new Uint8Array(IDS.length * T);
  const rooms = new Uint8Array(IDS.length);
  const pulled = new Set();
  const flips = new Set();
  const stack = [from];
  seen[from] = 1;
  const graph = withGraph ? new Map() : null;
  const out = [];
  let count = 0;
  while (stack.length) {
    const n = stack.pop();
    count++;
    const [ri, c, r, sw] = unnode(n);
    tiles[ri * T + r * W + c] = 1;
    rooms[ri] = 1;
    out.length = 0;
    edges(ri, c, r, sw, st, pulled, flips, out);
    if (graph) graph.set(n, [...out]);
    for (const o of out) if (!seen[o]) { seen[o] = 1; stack.push(o); }
  }
  return { seen, tiles, rooms, pulled, flips, graph, count };
}

function newState() {
  return { items: new Set(), keys: {}, used: {}, big: {}, doors: new Set(), solved: new Set(), got: new Set(), blown: new Set(), lit: new Set(), flags: new Set(), crystals: 0, pieces: 0, gshells: 0, log: [], keyLog: [] };
}
function cloneState(s) {
  return {
    items: new Set(s.items), keys: { ...s.keys }, used: { ...s.used }, big: { ...s.big }, doors: new Set(s.doors), solved: new Set(s.solved), got: new Set(s.got),
    blown: new Set(s.blown), lit: new Set(s.lit), flags: new Set(s.flags), crystals: s.crystals, pieces: s.pieces, gshells: s.gshells, log: [...s.log], keyLog: [...s.keyLog],
  };
}

function give(st, item, area) {
  if (TOOLS.has(item)) st.items.add(item);
  else if (item === 'key') st.keys[area] = (st.keys[area] || 0) + 1;
  else if (item === 'bigkey') st.big[area] = true;
  else if (item === 'heartpiece') st.pieces++;
  else if (item === 'gshell') st.gshells++;
}

const has = (st, need) => need.every((n) => (Array.isArray(n) ? n.some((x) => st.items.has(x)) : st.items.has(n)));

/** Can the room's enemies be beaten? (shell beetles flip with bombs or a throw; wisps need fire, arrows, bombs or the rope) */
function canClear(R, st) {
  if (!st.items.has('sword')) return false;
  if (R.kinds.has('beetle') && !(st.items.has('bombs') || R.pots || (R.boulders && st.items.has('glove')))) return false;
  if (R.kinds.has('wisp') && !['lantern', 'bombs', 'bow', 'grapple'].some((i) => st.items.has(i))) return false;
  return true;
}

/** Run collect / solve to a fixpoint. Returns the last reach() result. */
function settle(st, start, withGraph = false) {
  for (let guard = 0; guard < 400; guard++) {
    const res = reach(st, start, withGraph);
    const tileReached = (ri, c, r) => c >= 0 && r >= 0 && c < W && r < H && res.tiles[ri * T + r * W + c] === 1;
    const adj = (ri, c, r) => DV.some((v) => tileReached(ri, c + v.dx, r + v.dz));
    /** A reached tile in line with (tc, tr) throws / shoots and the line ends there (fire: passed a lit torch). */
    const lineFrom = (ri, tc, tr, range, ok) => {
      const R = P[ri];
      for (const v of DV) {
        for (let k = 1; k <= range; k++) {
          const c = tc - v.dx * k, r = tr - v.dz * k;
          if (c < 0 || r < 0 || c >= W || r >= H) break;
          if (!tileReached(ri, c, r)) continue;
          let hit = false, fire = false;
          line(R, c, r, v, range, 0, st, (cc, rr) => {
            if (cc === tc && rr === tr) { hit = ok(fire); return true; }
            const ch = R.grid[rr][cc];
            if (ch === 'L' || st.lit.has(`${R.id}:${cc},${rr}`)) { fire = true; return false; }
            return ch === 't';
          });
          if (hit) return true;
        }
      }
      return false;
    };
    let changed = false;
    const take = (id, item, area, why) => {
      if (st.got.has(id)) return;
      st.got.add(id);
      give(st, item, area);
      st.log.push(`${why}: ${item} (${id})`);
      changed = true;
    };
    for (let ri = 0; ri < P.length; ri++) {
      if (!res.rooms[ri]) continue;
      const R = P[ri];
      const room = R.id;
      const area = R.def.area;
      for (const e of R.ents) {
        if (e.future) continue;
        if (e.t === 'chest' && adj(ri, e.c, e.r)) take(e.id || `${room}:${e.c},${e.r}`, e.item, area, room);
        if (e.t === 'item' && (tileReached(ri, e.c, e.r) || res.pulled.has(e.id))) take(e.id, e.item, area, room);
        // townsfolk quests
        if (e.t === 'npc' && adj(ri, e.c, e.r)) {
          for (const q of QUESTS) {
            if (q.npc !== e.id) continue;
            if (q.flag) { if (!st.flags.has(q.flag)) { st.flags.add(q.flag); st.log.push(`quest: ${q.flag}`); changed = true; } continue; }
            if (st.got.has(q.id)) continue;
            if (q.need?.flag && !st.flags.has(q.need.flag)) continue;
            if (q.need?.gshells && st.gshells < q.need.gshells) continue;
            take(q.id, q.item, area, `quest ${e.id}`);
          }
        }
      }
      // Cracked rock: a bomb next to it, or one thrown over a gap
      if (R.cracks && st.items.has('bombs')) {
        for (let r = 0; r < H; r++) {
          for (let c = 0; c < W; c++) {
            if (R.grid[r][c] !== 'C' || st.blown.has(`${room}:${c},${r}`)) continue;
            if (adj(ri, c, r) || lineFrom(ri, c, r, THROW_RANGE, () => true)) { st.blown.add(`${room}:${c},${r}`); st.log.push(`blew ${room} ${c},${r}`); changed = true; }
          }
        }
      }
      // Solve the room
      const s = R.def.solve;
      if (s && !st.solved.has(room)) {
        let ok = false;
        if (s === 'clear') ok = canClear(R, st);
        else if (s === 'plates') ok = true;
        else if (s === 'torches') {
          // lantern torches first, then fire arrows from any lit torch (two passes for chains)
          for (let pass = 0; pass < 2; pass++) {
            for (const [c, r] of R.torches) {
              if (st.lit.has(`${room}:${c},${r}`)) continue;
              if ((st.items.has('lantern') && adj(ri, c, r)) || (st.items.has('bow') && lineFrom(ri, c, r, ARROW_RANGE, (fire) => fire))) st.lit.add(`${room}:${c},${r}`);
            }
          }
          ok = R.torches.every(([c, r]) => st.lit.has(`${room}:${c},${r}`)) && canClear(R, st);
        } else if (s === 'eyes') {
          ok = st.items.has('bow') && R.ents.filter((e) => e.t === 'eye').every((e) => lineFrom(ri, e.c, e.r, ARROW_RANGE, () => true));
        } else if (s === 'boss') {
          const b = R.ents.find((e) => e.t === 'boss');
          ok = st.items.has('sword') && has(st, BOSS_NEEDS[b.kind] || []);
        }
        if (ok) { st.solved.add(room); st.log.push(`solved ${room}`); changed = true; }
      }
      if (st.solved.has(room)) {
        const rw = R.def.reward;
        if (rw && !st.got.has(rw.id)) {
          const [c, r] = rw.at;
          if (rw.t === 'chest' ? adj(ri, c, r) : tileReached(ri, c, r)) take(rw.id, rw.item, area, `${room} reward`);
        }
        const v = R.def.victory;
        if (v?.crystal && !st.got.has(`crystal${v.crystal}`)) { st.got.add(`crystal${v.crystal}`); st.crystals++; st.log.push(`crystal ${v.crystal}`); changed = true; }
        if (v?.finale && !st.got.has('finale')) { st.got.add('finale'); st.log.push('THE END'); changed = true; }
      }
    }
    // Boss doors open as soon as you stand next to one with the big key; cracked walls with a bomb
    for (const [room, doors] of Object.entries(DOORS)) {
      for (const [d, door] of Object.entries(doors)) {
        if (st.doors.has(door.id)) continue;
        const ok = (door.type === 'boss' && st.big[ROOMS[room].area]) || (door.type === 'bomb' && st.items.has('bombs'));
        if (!ok) continue;
        const [c, r] = DOOR_TILES[d];
        if (adj(IDX[room], c, r)) { st.doors.add(door.id); st.log.push(`${door.type} door ${door.id}`); changed = true; }
      }
    }
    if (!changed) return { res, tileReached, adj };
  }
  throw new Error('settle did not converge');
}

/** Key doors you can stand next to but have not opened yet. */
function keyDoorsInReach(st, adj) {
  const out = new Map();
  for (const [room, doors] of Object.entries(DOORS)) {
    for (const [d, door] of Object.entries(doors)) {
      if (door.type !== 'key' || st.doors.has(door.id)) continue;
      const [c, r] = DOOR_TILES[d];
      if (adj(IDX[room], c, r)) out.set(door.id, ROOMS[room].area);
    }
  }
  return out;
}

const done = (st, goal) => (goal === 'finale' ? st.got.has('finale') : st.crystals >= goal);
const keyLeft = (st, area) => (st.keys[area] || 0) - (st.used[area] || 0) > 0;

/**
 * Check the whole game. Returns { ok, branches, failures, unreached, traps, log, flips, pieces, gshells }.
 * goal: 'finale' (default) or a number of crystals.
 */
export function checkWorld({ goal = 'finale' } = {}) {
  const start = node(IDX[START.room], START.at[0], START.at[1], 0);
  const failures = [];
  let branches = 0;

  // 1) one good order of key doors (depth first, stops at the first success)
  const memo0 = new Set();
  const find = (st) => {
    const sig = [...st.doors].sort().join(',');
    if (memo0.has(sig)) return null;
    memo0.add(sig);
    const { adj } = settle(st, start);
    if (done(st, goal)) return st;
    for (const [id, area] of keyDoorsInReach(st, adj)) {
      if (!keyLeft(st, area)) continue;
      const nx = cloneState(st);
      nx.doors.add(id);
      nx.used[area] = (nx.used[area] || 0) + 1;
      nx.keyLog.push(id);
      nx.log.push(`key door ${id}`);
      const r = find(nx);
      if (r) return r;
    }
    return null;
  };
  const bestSt = find(newState());
  if (!bestSt) return { ok: false, branches: 0, failures: [{ log: ['no way to the end at all'] }], unreached: [], traps: [], flips: [], log: [], pieces: 0, gshells: 0 };
  const goodOrder = {};
  for (const id of bestSt.keyLog) (goodOrder[ROOMS[id.split('|')[0]].area] ||= []).push(id);

  // 2) every order of key doors in one dungeon at a time (the others follow the good order)
  for (const focus of Object.keys(goodOrder)) {
    const memo = new Set();
    const explore = (st) => {
      const sig = [...st.doors].sort().join(',');
      if (memo.has(sig)) return;
      memo.add(sig);
      let { adj } = settle(st, start);
      for (let more = true; more;) {
        more = false;
        const inReach = keyDoorsInReach(st, adj);
        for (const [area, order] of Object.entries(goodOrder)) {
          if (area === focus) continue;
          const next = order.find((id) => !st.doors.has(id));
          if (next && inReach.has(next) && keyLeft(st, area)) {
            st.doors.add(next);
            st.used[area] = (st.used[area] || 0) + 1;
            st.log.push(`key door ${next}`);
            more = true;
          }
        }
        if (more) ({ adj } = settle(st, start));
      }
      if (done(st, goal)) { branches++; return; }
      let any = false;
      for (const [id, area] of keyDoorsInReach(st, adj)) {
        if (area !== focus || !keyLeft(st, area)) continue;
        any = true;
        const nx = cloneState(st);
        nx.doors.add(id);
        nx.used[area] = (nx.used[area] || 0) + 1;
        nx.log.push(`key door ${id}`);
        explore(nx);
      }
      if (!any) failures.push({ focus, log: st.log.slice(-14), keys: st.keys, used: st.used, crystals: st.crystals, doorsInReach: [...keyDoorsInReach(st, adj).keys()] });
    };
    explore(newState());
  }

  // Unreached things and traps, with the final abilities of the good run
  const fin = settle(bestSt, start, true);
  const unreached = [];
  for (const R of P) {
    for (const e of R.ents) {
      if ((e.t === 'chest' || e.t === 'item') && !e.future && !bestSt.got.has(e.id || `${R.id}:${e.c},${e.r}`)) unreached.push(`${R.id} ${e.t} ${e.item} ${e.id || ''}`);
    }
    const rw = R.def.reward;
    if (rw && !bestSt.got.has(rw.id)) unreached.push(`${R.id} reward ${rw.item}`);
  }
  for (const q of QUESTS) if (q.item && !bestSt.got.has(q.id)) unreached.push(`quest ${q.npc} ${q.item} ${q.id}`);
  const g = fin.res.graph;
  const rev = new Map();
  for (const [a, outs] of g) for (const b of outs) { if (!rev.has(b)) rev.set(b, []); rev.get(b).push(a); }
  const back = new Set([start]);
  const stack = [start];
  while (stack.length) {
    const n = stack.pop();
    for (const p of rev.get(n) || []) if (!back.has(p)) { back.add(p); stack.push(p); }
  }
  const byRoom = {};
  for (const n of g.keys()) if (!back.has(n)) { const room = IDS[unnode(n)[0]]; byRoom[room] = (byRoom[room] || 0) + 1; }
  const traps = Object.entries(byRoom).map(([room, n]) => `${room}: ${n} tile states`);
  return {
    ok: failures.length === 0 && branches > 0, branches, failures, unreached, traps, flips: [...fin.res.flips], log: bestSt.log, keyOrder: goodOrder,
    pieces: bestSt.pieces, gshells: bestSt.gshells, gshellTotal: GOLD_SHELLS.length,
  };
}

// for the test scripts (timing, single runs)
export const _internals = { settle, newState, reach, node, IDX, START };
