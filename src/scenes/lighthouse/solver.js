// Reachability checker for Lighthouse Caves (pure data, runs in Node or the browser).
//
// It walks the tile grid of every room with the abilities found so far (sword cuts bushes, lantern
// burns thorns and lights torches, rope hooks posts and chests and pulls items, crystal switches
// flip pegs), collects every chest and item it can reach, solves rooms, and opens small key doors.
// Because keys can be spent in any order, it tries every order of opening key doors and checks
// that each one still reaches the ending (no key softlocks). It also lists "traps": tiles you can
// reach but not walk back from (only the room reset or a fall would get you out).
//
// Block and plate puzzles are assumed solvable once the room is reached (they reset when you leave
// the room, and the browser test pushes the blocks for real).

import { W, H, DIRS, DOOR_TILES, TALL, FLOORISH, pegUp, parseMap, ROPE_RANGE, THROW_RANGE } from './tiles.js';
import { ROOMS, AREAS, DOORS, neighbor, START } from './rooms.js';

const SOLID_ENTS = new Set(['chest', 'npc', 'sign', 'save', 'shop', 'decor', 'switch', 'lamp']);
const BOSS_NEEDS = { moth: 'lantern', crab: 'grapple', bigblob: null, bigshell: null };

const P = {};
for (const def of Object.values(ROOMS)) {
  const { grid, ents } = parseMap(def);
  for (const e of def.extra || []) ents.push({ ...e });
  const at = {};
  for (const e of ents) at[`${e.c},${e.r}`] = e;
  const doorAt = {};
  for (const [d, [c, r]] of Object.entries(DOOR_TILES)) if (DOORS[def.id]?.[d]) doorAt[`${c},${r}`] = d;
  P[def.id] = { def, grid, ents, at, doorAt, pots: ents.some((e) => e.t === 'pot' || e.t === 'rock') };
}

function doorOpen(room, d, st) {
  const door = DOORS[room][d];
  if (door.type === 'open') return true;
  if (door.type === 'shut') return st.solved.has(door.owner);
  return st.doors.has(door.id); // key / boss doors once opened
}

/** A puzzle's reward chest stands here (it appears once the room is solved). */
function rewardChestAt(room, c, r, st) {
  const rw = P[room].def.reward;
  return !!rw && rw.t === 'chest' && rw.at[0] === c && rw.at[1] === r && st.solved.has(room);
}

function passable(room, c, r, sw, st) {
  if (c < 0 || r < 0 || c >= W || r >= H) return false;
  const R = P[room];
  const d = R.doorAt[`${c},${r}`];
  if (d) return doorOpen(room, d, st);
  const e = R.at[`${c},${r}`];
  if (e && SOLID_ENTS.has(e.t)) return false;
  if (e && e.t === 'gate') return st.solved.has(room);
  if (rewardChestAt(room, c, r, st)) return false;
  const ch = R.grid[r][c];
  if (ch === 'b') return st.items.has('sword');
  if (ch === '*') return st.items.has('lantern');
  if (ch === 'x' || ch === 'y') return !pegUp(ch, swOf(room, sw));
  return FLOORISH.has(ch) || ch === 'v';
}
const standable = (room, c, r, sw, st) => passable(room, c, r, sw, st) && !['o', '~'].includes(P[room].grid[r][c]);

const key = (room, c, r, sw) => `${room}:${c}:${r}:${sw}`;

// Crystal switch state is kept per dungeon, like the game: node "sw" is a bit mask (bit 0 = d1, bit 1 = d2).
const SW_BIT = { d1: 1, d2: 2 };
const swOf = (room, mask) => ((mask & (SW_BIT[ROOMS[room].area] || 0)) ? 1 : 0);
const flip = (room, mask) => mask ^ (SW_BIT[ROOMS[room].area] || 0);

/** Neighbors of a node: walking, edges, warps, rope pulls and switch flips. Also records rope-pulled items. */
function edges(room, c, r, sw, st, pulled, flips) {
  const out = [];
  const R = P[room];
  const area = R.def.area;
  for (const [d, v] of Object.entries(DIRS)) {
    const nc = c + v.dx, nr = r + v.dz;
    const here = R.grid[r][c];
    if (here === 'v' && d !== 's') continue;
    if (nc < 0 || nr < 0 || nc >= W || nr >= H) {
      if (!AREAS[area].scroll) continue;
      const nb = neighbor(room, d);
      if (!nb) continue;
      const tc = nc < 0 ? W - 1 : nc >= W ? 0 : nc;
      const tr = nr < 0 ? H - 1 : nr >= H ? 0 : nr;
      if (passable(nb, tc, tr, sw, st)) out.push([nb, tc, tr, sw]);
      continue;
    }
    if (P[room].grid[nr][nc] === 'v' && d !== 's') continue;
    if (!passable(room, nc, nr, sw, st)) continue;
    const e = R.at[`${nc},${nr}`];
    if (e && e.t === 'warp') {
      if (e.need && !st.items.has(e.need)) continue;
      out.push([e.to, e.at[0], e.at[1], sw]);
      continue;
    }
    out.push([room, nc, nr, sw]);
  }
  // Swing at an adjacent crystal switch
  for (const v of Object.values(DIRS)) {
    const e = R.at[`${c + v.dx},${r + v.dz}`];
    if (e && e.t === 'switch' && st.items.has('sword')) { out.push([room, c, r, flip(room, sw)]); flips.add(`${room}:sword`); }
  }
  // Throw a pot at a switch (rooms that have pots)
  if (R.pots) {
    for (const v of Object.values(DIRS)) {
      for (let k = 1; k <= THROW_RANGE; k++) {
        const cc = c + v.dx * k, rr = r + v.dz * k;
        if (cc < 0 || rr < 0 || cc >= W || rr >= H) break;
        const e = R.at[`${cc},${rr}`];
        if (e && e.t === 'switch') { out.push([room, c, r, flip(room, sw)]); flips.add(`${room}:throw`); break; }
        if (e && SOLID_ENTS.has(e.t)) break;
        const ch = R.grid[rr][cc];
        if (TALL.has(ch) || pegUp(ch, swOf(room, sw)) || R.doorAt[`${cc},${rr}`]) break;
      }
    }
  }
  // Rope
  if (st.items.has('grapple')) {
    for (const v of Object.values(DIRS)) {
      for (let k = 1; k <= ROPE_RANGE; k++) {
        const cc = c + v.dx * k, rr = r + v.dz * k;
        if (cc < 0 || rr < 0 || cc >= W || rr >= H || R.doorAt[`${cc},${rr}`]) break;
        const e = R.at[`${cc},${rr}`];
        const ch = R.grid[rr][cc];
        const hook = ch === '|' || (e && e.t === 'chest') || rewardChestAt(room, cc, rr, st);
        if (hook) {
          const ac = c + v.dx * (k - 1), ar = r + v.dz * (k - 1);
          if (k >= 2 && standable(room, ac, ar, sw, st)) out.push([room, ac, ar, sw]);
          break;
        }
        if (e && e.t === 'switch') { out.push([room, c, r, flip(room, sw)]); flips.add(`${room}:rope`); break; }
        if (e && e.t === 'item' && e.id) pulled.add(e.id);
        if (e && SOLID_ENTS.has(e.t)) break;
        if (TALL.has(ch) || pegUp(ch, swOf(room, sw))) break;
      }
    }
  }
  return out;
}

function reach(st, from) {
  const seen = new Set();
  const pulled = new Set();
  const flips = new Set();
  const stack = [from];
  seen.add(key(...from));
  const graph = new Map();
  while (stack.length) {
    const n = stack.pop();
    const outs = edges(...n, st, pulled, flips);
    graph.set(key(...n), outs.map((o) => key(...o)));
    for (const o of outs) {
      const k = key(...o);
      if (!seen.has(k)) { seen.add(k); stack.push(o); }
    }
  }
  return { seen, pulled, flips, graph };
}

function newState() {
  return { items: new Set(), keys: {}, used: {}, big: {}, doors: new Set(), solved: new Set(), got: new Set(), crystals: 0, pieces: 0, log: [] };
}
function cloneState(s) {
  return { items: new Set(s.items), keys: { ...s.keys }, used: { ...s.used }, big: { ...s.big }, doors: new Set(s.doors), solved: new Set(s.solved), got: new Set(s.got), crystals: s.crystals, pieces: s.pieces, log: [...s.log] };
}

function give(st, item, area) {
  if (['sword', 'lantern', 'grapple'].includes(item)) st.items.add(item);
  else if (item === 'key') st.keys[area] = (st.keys[area] || 0) + 1;
  else if (item === 'bigkey') st.big[area] = true;
  else if (item === 'heartpiece') st.pieces++;
}

/** Run collect / solve to a fixpoint. Returns the last reach() result. */
function settle(st, start) {
  for (let guard = 0; guard < 200; guard++) {
    const res = reach(st, start);
    const tileReached = (room, c, r) => [0, 1, 2, 3].some((m) => res.seen.has(key(room, c, r, m)));
    const adj = (room, c, r) => Object.values(DIRS).some((v) => tileReached(room, c + v.dx, r + v.dz));
    const roomReached = (room) => {
      for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) if (tileReached(room, c, r)) return true;
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
    for (const [room, R] of Object.entries(P)) {
      const area = R.def.area;
      if (!roomReached(room)) continue;
      for (const e of R.ents) {
        if (e.future) continue;
        if (e.t === 'chest' && adj(room, e.c, e.r)) take(e.id || `${room}:${e.c},${e.r}`, e.item, area, room);
        if (e.t === 'item' && (tileReached(room, e.c, e.r) || res.pulled.has(e.id))) take(e.id, e.item, area, room);
      }
      // Solve the room
      const s = R.def.solve;
      if (s && !st.solved.has(room)) {
        let ok = false;
        if (s === 'clear') ok = st.items.has('sword');
        else if (s === 'plates') ok = true;
        else if (s === 'torches') {
          const torches = [];
          for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) if (R.grid[r][c] === 't') torches.push([c, r]);
          ok = st.items.has('lantern') && torches.every(([c, r]) => adj(room, c, r));
        } else if (s === 'boss') {
          const b = R.ents.find((e) => e.t === 'boss');
          const need = BOSS_NEEDS[b.kind];
          ok = st.items.has('sword') && (!need || st.items.has(need));
        }
        if (ok) { st.solved.add(room); st.log.push(`solved ${room}`); changed = true; }
      }
      if (st.solved.has(room)) {
        const rw = R.def.reward;
        if (rw && !st.got.has(rw.id)) {
          const [c, r] = rw.at;
          if (rw.t === 'chest' ? adj(room, c, r) : tileReached(room, c, r)) take(rw.id, rw.item, area, `${room} reward`);
        }
        const v = R.def.victory;
        if (v && !st.got.has(`crystal${v.crystal}`)) { st.got.add(`crystal${v.crystal}`); st.crystals++; st.log.push(`crystal ${v.crystal}`); changed = true; }
      }
    }
    // Boss doors open as soon as you stand next to one with the big key
    for (const [room, doors] of Object.entries(DOORS)) {
      for (const [d, door] of Object.entries(doors)) {
        if (door.type !== 'boss' || st.doors.has(door.id) || !st.big[P[room].def.area]) continue;
        const [c, r] = DOOR_TILES[d];
        if (adj(room, c, r)) { st.doors.add(door.id); st.log.push(`boss door ${door.id}`); changed = true; }
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
      if (adj(room, c, r)) out.set(door.id, P[room].def.area);
    }
  }
  return out;
}

/**
 * Check the whole delivery. Returns { ok, branches, failures, unreached, traps, log, flips }.
 * goalCrystals: how many crystals must be reachable (2 in this delivery).
 */
export function checkWorld({ goalCrystals = 2 } = {}) {
  const start = [START.room, START.at[0], START.at[1], 0];
  const failures = [];
  let branches = 0;
  let best = null;
  const memo = new Set();
  const explore = (st) => {
    const sig = [...st.doors].sort().join(',');
    if (memo.has(sig)) return;
    memo.add(sig);
    const { res, adj } = settle(st, start);
    if (st.crystals >= goalCrystals) {
      branches++;
      if (!best) best = { st, res };
      return;
    }
    const doors = keyDoorsInReach(st, adj);
    let any = false;
    for (const [id, area] of doors) {
      if ((st.keys[area] || 0) - (st.used[area] || 0) <= 0) continue;
      any = true;
      const nx = cloneState(st);
      nx.doors.add(id);
      nx.used[area] = (nx.used[area] || 0) + 1;
      nx.log.push(`key door ${id}`);
      explore(nx);
    }
    if (!any) failures.push({ log: st.log, keys: st.keys, used: st.used, crystals: st.crystals, doorsInReach: [...doors.keys()] });
  };
  explore(newState());

  const unreached = [];
  let traps = [];
  const flips = best ? [...best.res.flips] : [];
  if (best) {
    for (const [room, R] of Object.entries(P)) {
      for (const e of R.ents) {
        if ((e.t === 'chest' || e.t === 'item') && !e.future && !best.st.got.has(e.id || `${room}:${e.c},${e.r}`)) unreached.push(`${room} ${e.t} ${e.item} ${e.id || ''}`);
      }
      const rw = R.def.reward;
      if (rw && !best.st.got.has(rw.id)) unreached.push(`${room} reward ${rw.item}`);
    }
    // Traps: reachable nodes with no way back to the start (final abilities).
    const g = best.res.graph;
    const rev = new Map();
    for (const [a, outs] of g) for (const b of outs) { if (!rev.has(b)) rev.set(b, []); rev.get(b).push(a); }
    const back = new Set([key(...start)]);
    const stack = [key(...start)];
    while (stack.length) {
      const n = stack.pop();
      for (const p of rev.get(n) || []) if (!back.has(p)) { back.add(p); stack.push(p); }
    }
    const byRoom = {};
    for (const n of best.res.seen) if (!back.has(n)) { const room = n.split(':')[0]; byRoom[room] = (byRoom[room] || 0) + 1; }
    traps = Object.entries(byRoom).map(([room, n]) => `${room}: ${n} tile states`);
  }
  return { ok: failures.length === 0 && branches > 0, branches, failures, unreached, traps, flips, log: best?.st.log || [], pieces: best?.st.pieces || 0 };
}
