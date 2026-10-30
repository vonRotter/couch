import { rng } from './common.js';

// Random dungeon floors for Pillow Keep, Diablo style: rooms on a loose grid joined by
// two-tile-wide corridors, locked doors with their keys always on the near side, nests,
// chests, elite packs and the stairs in the farthest room. Floors 3 and 5 end in a big
// boss bedroom (the "arena") behind a locked door.
//
// The output is the same text map the scene builds from:
//   #  wall          .  floor        (space) nothing
//   S  start         >  stairs (a 2x2 block)
//   K  key           D  locked door (touching D tiles form one door)
//   N  grumble nest  C  treasure chest
//   E  elite pack    g  a few idle grumbles
//   r  rug (decor)   B  boss
//
// How "always solvable" is guaranteed: the rooms form a spanning tree, every lock sits on a
// tree edge of the path from the start to the goal, and the key for lock k is placed in the
// zone between lock k-1 and lock k. Extra loop corridors only join rooms of the same zone,
// and corridors run on fixed lanes (the macro-cell borders) so they can never cross each other.
// verifyFloor() replays the keys-and-doors walk on the finished map as a final check.

export const FLOOR_PLAN = [
  { mx: 3, my: 3, locks: 1, nests: 3, chests: 2, elites: 1, packs: 4 },
  { mx: 4, my: 3, locks: 1, nests: 5, chests: 3, elites: 2, packs: 6 },
  { mx: 3, my: 2, locks: 1, nests: 3, chests: 2, elites: 1, packs: 4, arena: 'teddy' },
  { mx: 4, my: 3, locks: 2, nests: 6, chests: 3, elites: 3, packs: 8 },
  { mx: 3, my: 2, locks: 2, nests: 4, chests: 2, elites: 2, packs: 5, arena: 'sheep' },
];

const SX = 13, SY = 11; // macro cell size in tiles
const AH = 15; // rows taken by the boss arena on arena floors

/**
 * Builds floor `depth` (0-based) from a seed. Retries with the next seed until the check passes.
 * `plan` defaults to the co-op FLOOR_PLAN entry; Pillow Keep Solo passes its own plans.
 */
export function generateFloor(depth, seed, plan = FLOOR_PLAN[depth]) {
  for (let k = 0; k < 40; k++) {
    const f = tryGenerate(plan, (seed + k * 7919) >>> 0);
    if (f && verifyFloor(f.map).ok) return f;
  }
  throw new Error('keep: no solvable floor');
}

function tryGenerate(plan, seed) {
  const R = rng(seed);
  const ri = (a, b) => a + Math.floor(R() * (b - a + 1)); // inclusive
  const pick = (arr) => arr[Math.floor(R() * arr.length)];
  const { mx, my } = plan;
  const top = plan.arena ? AH : 0;
  const W = mx * SX + 2, H = top + my * SY + 2;
  const T = Array.from({ length: H }, () => new Array(W).fill(' '));
  const carve = (c0, r0, c1, r1) => {
    for (let r = Math.min(r0, r1); r <= Math.max(r0, r1); r++) for (let c = Math.min(c0, c1); c <= Math.max(c0, c1); c++) T[r][c] = '.';
  };

  // 1) Which macro cells hold a room (a couple may be missing on big floors for an irregular shape).
  const has = Array.from({ length: my }, () => new Array(mx).fill(true));
  const startI = ri(0, mx - 1), startJ = my - 1;
  if (mx * my >= 9) {
    const drops = ri(0, 2);
    for (let d = 0; d < drops; d++) {
      const i = ri(0, mx - 1), j = ri(0, my - 1);
      if ((i === startI && j === startJ) || (plan.arena && j === 0)) continue;
      has[j][i] = false;
      if (!connected(has, mx, my)) has[j][i] = true;
    }
  }

  // 2) Rooms inside their cells (start and goal rooms are roomier).
  const rooms = [];
  const at = Array.from({ length: my }, () => new Array(mx).fill(null));
  for (let j = 0; j < my; j++) {
    for (let i = 0; i < mx; i++) {
      if (!has[j][i]) continue;
      const x0 = 1 + i * SX, y0 = 1 + top + j * SY;
      const big = i === startI && j === startJ;
      const w = ri(big ? 7 : 5, SX - 4), h = ri(big ? 5 : 4, SY - 4);
      const rx0 = ri(x0 + 2, x0 + SX - 2 - w), ry0 = ri(y0 + 2, y0 + SY - 2 - h);
      const room = { i, j, rx0, ry0, rx1: rx0 + w - 1, ry1: ry0 + h - 1, w, h, links: [], id: rooms.length, topEntry: [] };
      rooms.push(room);
      at[j][i] = room;
    }
  }
  const start = at[startJ][startI];

  // 3) Spanning tree (randomized Prim from the start room).
  const nbrs = (r) => [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([di, dj]) => at[r.j + dj]?.[r.i + di]).filter(Boolean);
  const inTree = new Set([start]);
  const edges = [];
  const frontier = nbrs(start).map((b) => [start, b]);
  while (frontier.length) {
    const [a, b] = frontier.splice(Math.floor(R() * frontier.length), 1)[0];
    if (inTree.has(b)) continue;
    inTree.add(b);
    edges.push({ a, b, tree: true });
    for (const c of nbrs(b)) if (!inTree.has(c)) frontier.push([b, c]);
  }
  for (const e of edges) { e.a.links.push(e); e.b.links.push(e); }
  const other = (e, r) => (e.a === r ? e.b : e.a);

  // Tree distances / parents from the start.
  const dist = new Map([[start, 0]]), parent = new Map();
  const q = [start];
  for (let h = 0; h < q.length; h++) {
    for (const e of q[h].links) {
      const o = other(e, q[h]);
      if (!dist.has(o)) { dist.set(o, dist.get(q[h]) + 1); parent.set(o, { room: q[h], edge: e }); q.push(o); }
    }
  }

  // 4) The goal: the farthest room, or (arena floors) the top-row room nearest the middle.
  let goal;
  if (plan.arena) {
    const row0 = rooms.filter((r) => r.j === 0);
    goal = row0.sort((a, b) => Math.abs(a.i - (mx - 1) / 2) - Math.abs(b.i - (mx - 1) / 2) || dist.get(b) - dist.get(a))[0];
  } else {
    const far = Math.max(...rooms.map((r) => dist.get(r)));
    goal = pick(rooms.filter((r) => dist.get(r) === far));
  }
  const path = [goal];
  while (path[0] !== start) path.unshift(parent.get(path[0]).room);
  const pathEdges = path.slice(1).map((r) => parent.get(r).edge);

  // 5) Locks on the path. On arena floors the last lock is the boss door (added below).
  const lockEdges = [];
  const nLocks = plan.arena ? plan.locks - 1 : plan.locks;
  if (nLocks > 0 && pathEdges.length) {
    const want = Math.min(nLocks, pathEdges.length);
    for (let m = 0; m < want; m++) {
      // Spread the locks along the path, the last one as far along as possible.
      const idx = m === want - 1 ? pathEdges.length - 1 : Math.floor(((m + 1) / want) * (pathEdges.length - 1));
      const e = pathEdges[Math.max(m, Math.min(pathEdges.length - 1, idx))];
      if (!lockEdges.includes(e)) lockEdges.push(e);
    }
  }
  lockEdges.forEach((e) => { e.locked = true; });

  // Zones: 0 before the first lock, k after lock k.
  const zone = new Map();
  const flood = (from, z) => {
    const st = [from];
    zone.set(from, z);
    while (st.length) {
      const r = st.pop();
      for (const e of r.links) {
        const o = other(e, r);
        if (e.locked || zone.has(o)) continue;
        zone.set(o, z);
        st.push(o);
      }
    }
  };
  flood(start, 0);
  lockEdges.forEach((e, k) => {
    const far = dist.get(e.a) > dist.get(e.b) ? e.a : e.b;
    e.inner = far; // the door sits on this room's wall
    flood(far, k + 1);
  });

  // 6) Extra loop corridors inside a zone make the layout less linear.
  for (const a of rooms) {
    for (const b of nbrs(a)) {
      if (a.id > b.id || zone.get(a) !== zone.get(b) || a.links.some((e) => other(e, a) === b)) continue;
      if (R() < 0.3) { const e = { a, b, tree: false }; edges.push(e); a.links.push(e); b.links.push(e); }
    }
  }

  // 7) Carve rooms, then corridors on the cell-border lanes.
  for (const r of rooms) carve(r.rx0, r.ry0, r.rx1, r.ry1);
  const doors = [];
  for (const e of edges) {
    let { a, b } = e;
    if (a.i > b.i || a.j > b.j) [a, b] = [b, a];
    if (a.j === b.j) {
      // a left of b; the vertical lane is the border column X-1..X.
      const X = 1 + b.i * SX;
      const ov0 = Math.max(a.ry0, b.ry0), ov1 = Math.min(a.ry1, b.ry1) - 1;
      let ra = ri(a.ry0, a.ry1 - 1), rb = ri(b.ry0, b.ry1 - 1);
      if (ov1 >= ov0 && R() < 0.7) ra = rb = ri(ov0, ov1);
      carve(a.rx1 + 1, ra, X, ra + 1);
      carve(X - 1, Math.min(ra, rb), X, Math.max(ra, rb) + 1);
      carve(X - 1, rb, b.rx0 - 1, rb + 1);
      if (e.locked) doors.push(e.inner === b ? [[b.rx0 - 1, rb], [b.rx0 - 1, rb + 1]] : [[a.rx1 + 1, ra], [a.rx1 + 1, ra + 1]]);
    } else {
      // a above b; the horizontal lane is the border row Y-1..Y.
      const Y = 1 + top + b.j * SY;
      const ov0 = Math.max(a.rx0, b.rx0), ov1 = Math.min(a.rx1, b.rx1) - 1;
      let ca = ri(a.rx0, a.rx1 - 1), cb = ri(b.rx0, b.rx1 - 1);
      if (ov1 >= ov0 && R() < 0.7) ca = cb = ri(ov0, ov1);
      carve(ca, a.ry1 + 1, ca + 1, Y);
      carve(Math.min(ca, cb), Y - 1, Math.max(ca, cb) + 1, Y);
      carve(cb, Y - 1, cb + 1, b.ry0 - 1);
      b.topEntry.push(cb, cb + 1);
      if (e.locked) doors.push(e.inner === b ? [[cb, b.ry0 - 1], [cb + 1, b.ry0 - 1]] : [[ca, a.ry1 + 1], [ca + 1, a.ry1 + 1]]);
    }
  }

  // 8) The boss arena on top, behind the boss door.
  let arena = null;
  if (plan.arena) {
    const aw = Math.min(W - 6, 24);
    const ax0 = Math.floor((W - aw) / 2), ax1 = ax0 + aw - 1, ay0 = 2, ay1 = AH - 3;
    carve(ax0, ay0, ax1, ay1);
    // Straight up from the goal room to the boss door.
    const c = Math.max(ax0 + 1, Math.min(ax1 - 2, ri(goal.rx0, goal.rx1 - 1)));
    carve(c, ay1 + 1, c + 1, goal.ry0 - 1);
    goal.topEntry.push(c, c + 1);
    doors.push([[c, ay1 + 1], [c + 1, ay1 + 1]]);
    arena = { ax0, ax1, ay0, ay1 };
    // A few cushy pillars in the corners of the bedroom.
    for (const [px, py] of [[ax0 + 2, ay0 + 2], [ax1 - 2, ay0 + 2], [ax0 + 2, ay1 - 2], [ax1 - 2, ay1 - 2]]) T[py][px] = '#';
  }

  // 9) Walls around everything carved.
  for (let r = 0; r < H; r++) {
    for (let c = 0; c < W; c++) {
      if (T[r][c] !== ' ') continue;
      let near = false;
      for (let dr = -1; dr <= 1 && !near; dr++) for (let dc = -1; dc <= 1; dc++) if (T[r + dr]?.[c + dc] === '.') { near = true; break; }
      if (near) T[r][c] = '#';
    }
  }
  for (const d of doors) for (const [c, r] of d) T[r][c] = 'D';

  // 10) Furnish the rooms.
  const free3 = (c, r) => {
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) if (T[r + dr]?.[c + dc] !== '.') return false;
    return true;
  };
  const spotIn = (room, margin = 1) => {
    for (let k = 0; k < 30; k++) {
      const c = ri(room.rx0 + margin, room.rx1 - margin), r = ri(room.ry0 + margin, room.ry1 - margin);
      if (free3(c, r)) return [c, r];
    }
    return null;
  };
  // Start: a 2x2 block in the middle of the start room.
  const sc = Math.floor((start.rx0 + start.rx1) / 2), sr = Math.floor((start.ry0 + start.ry1) / 2);
  for (const [dc, dr] of [[0, 0], [1, 0], [0, 1], [1, 1]]) T[sr + dr][sc + dc - 1] = 'S';

  if (arena) {
    const mc = Math.floor((arena.ax0 + arena.ax1) / 2);
    for (const [dc, dr] of [[0, 0], [1, 0], [0, 1], [1, 1]]) T[arena.ay0 + 1 + dr][mc - 1 + dc] = '>';
    T[Math.floor((arena.ay0 + arena.ay1) / 2) + 1][mc] = 'B';
  } else {
    // Stairs against the top wall of the goal room, away from corridors coming in from above.
    let best = null;
    for (let c = goal.rx0 + 1; c <= goal.rx1 - 2; c++) {
      if (goal.topEntry.includes(c) || goal.topEntry.includes(c + 1)) continue;
      const score = Math.abs(c + 0.5 - (goal.rx0 + goal.rx1) / 2);
      if (!best || score < best.score) best = { c, score };
    }
    const r0 = best ? goal.ry0 + 1 : Math.floor((goal.ry0 + goal.ry1) / 2) - 1;
    const c0 = best ? best.c : Math.floor((goal.rx0 + goal.rx1) / 2) - 1;
    for (const [dc, dr] of [[0, 0], [1, 0], [0, 1], [1, 1]]) T[r0 + dr][c0 + dc] = '>';
  }

  // Pillars in some big rooms (not start/goal).
  for (const r of rooms) {
    if (r === start || r === goal || r.w < 8 || r.h < 6 || R() > 0.45) continue;
    for (const [px, py] of [[r.rx0 + 2, r.ry0 + 2], [r.rx1 - 2, r.ry0 + 2], [r.rx0 + 2, r.ry1 - 2], [r.rx1 - 2, r.ry1 - 2]]) if (T[py][px] === '.') T[py][px] = '#';
    r.pillars = true;
  }

  // Keys: the key for lock k goes in zone k, in a side room if there is one, as far as possible.
  const allLocks = lockEdges.length + (plan.arena ? 1 : 0);
  for (let k = 0; k < allLocks; k++) {
    const zr = rooms.filter((r) => zone.get(r) === k);
    const side = zr.filter((r) => !path.includes(r));
    const pool = (side.length ? side : zr.filter((r) => r !== start).length ? zr.filter((r) => r !== start) : zr)
      .sort((a, b) => dist.get(b) - dist.get(a));
    let placed = false;
    for (const room of pool) {
      const s = spotIn(room);
      if (s) { T[s[1]][s[0]] = 'K'; room.key = true; placed = true; break; }
    }
    if (!placed) return null;
  }

  // Nests, chests, elites, idle packs and rugs, weighted toward rooms far from the start.
  const fill = rooms.filter((r) => r !== start);
  const weighted = () => {
    const tot = fill.reduce((a, r) => a + 1 + dist.get(r), 0);
    let x = R() * tot;
    for (const r of fill) { x -= 1 + dist.get(r); if (x <= 0) return r; }
    return fill[fill.length - 1];
  };
  const place = (ch, count, choose) => {
    for (let n = 0, tries = 0; n < count && tries < count * 12; tries++) {
      const room = choose();
      if (!room) break;
      const s = spotIn(room);
      if (s) { T[s[1]][s[0]] = ch; n++; }
    }
  };
  // Chests like dead ends (rooms with a single corridor), Diablo style.
  const deadEnds = fill.filter((r) => r.links.length === 1 && r !== goal);
  place('C', plan.chests, () => (deadEnds.length && R() < 0.7 ? pick(deadEnds) : pick(fill)));
  place('N', plan.nests, weighted);
  const late = fill.filter((r) => dist.get(r) >= Math.max(1, Math.floor(dist.get(goal) / 2)));
  place('E', plan.elites, () => pick(late.length ? late : fill));
  place('g', plan.packs, weighted);
  for (const r of rooms) {
    if (r.w < 7 || r.h < 5 || r.pillars || R() > 0.5) continue;
    const c = Math.floor((r.rx0 + r.rx1) / 2), rr = Math.floor((r.ry0 + r.ry1) / 2);
    if (T[rr][c] === '.') T[rr][c] = 'r';
  }

  // Crop to the used area (one empty border is not needed: walls already ring everything).
  let rows = T.map((row) => row.join('').replace(/\s+$/, ''));
  let r0 = 0;
  while (!rows[r0].trim()) r0++;
  rows = rows.slice(r0);
  while (!rows[rows.length - 1].trim()) rows.pop();
  const c0 = Math.min(...rows.filter((r) => r.trim()).map((r) => r.search(/\S/)));
  const map = rows.map((r) => r.slice(c0));
  return { map, seed, arenaRow: arena ? arena.ay1 + 1 - r0 : null, boss: plan.arena || null, rooms: rooms.length, zones: allLocks + 1 };
}

function connected(has, mx, my) {
  let first = null, total = 0;
  for (let j = 0; j < my; j++) for (let i = 0; i < mx; i++) if (has[j][i]) { total++; first ||= [i, j]; }
  const seen = new Set([first.join()]);
  const st = [first];
  while (st.length) {
    const [i, j] = st.pop();
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ni = i + di, nj = j + dj, k = `${ni},${nj}`;
      if (ni < 0 || nj < 0 || ni >= mx || nj >= my || !has[nj][ni] || seen.has(k)) continue;
      seen.add(k);
      st.push([ni, nj]);
    }
  }
  return seen.size === total;
}

/**
 * Plays the floor like a careful team: walk everywhere reachable, pick up every key you can
 * reach, open one door per key, repeat. Solvable = stairs, boss and every tile reached.
 */
export function verifyFloor(map) {
  const H = map.length, W = Math.max(...map.map((r) => r.length));
  const ch = (c, r) => map[r]?.[c] || ' ';
  const seen = new Uint8Array(W * H);
  const openDoors = new Set();
  let keys = 0, keysTotal = 0, doorsTotal = 0, starts = 0;
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) { const k = ch(c, r); if (k === 'K') keysTotal++; if (k === 'D') doorsTotal++; if (k === 'S') starts++; }
  const st = [];
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) if (ch(c, r) === 'S' && !seen[r * W + c]) { seen[r * W + c] = 1; st.push([c, r]); }
  // Door tiles that touch form one door.
  const doorId = new Map();
  let nd = 0;
  for (let r = 0; r < H; r++) {
    for (let c = 0; c < W; c++) {
      if (ch(c, r) !== 'D' || doorId.has(r * W + c)) continue;
      const s2 = [[c, r]];
      doorId.set(r * W + c, nd);
      while (s2.length) {
        const [x, y] = s2.pop();
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const k = (y + dy) * W + x + dx;
          if (ch(x + dx, y + dy) === 'D' && !doorId.has(k)) { doorId.set(k, nd); s2.push([x + dx, y + dy]); }
        }
      }
      nd++;
    }
  }
  const blocked = [];
  for (;;) {
    while (st.length) {
      const [c, r] = st.pop();
      if (ch(c, r) === 'K') keys++;
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nc = c + dc, nr = r + dr, k = nr * W + nc;
        if (nc < 0 || nr < 0 || nc >= W || nr >= H || seen[k]) continue;
        const t = ch(nc, nr);
        if (t === '#' || t === ' ') continue;
        if (t === 'D' && !openDoors.has(doorId.get(k))) { blocked.push([nc, nr]); continue; }
        seen[k] = 1;
        st.push([nc, nr]);
      }
    }
    // Spend a key on a door we are standing next to.
    const next = blocked.find(([c, r]) => !openDoors.has(doorId.get(r * W + c)));
    if (!next || keys <= openDoors.size) break;
    const id = doorId.get(next[1] * W + next[0]);
    openDoors.add(id);
    for (const [k, v] of doorId) if (v === id && !seen[k]) { seen[k] = 1; st.push([k % W, Math.floor(k / W)]); }
  }
  let unreached = 0, stairs = false, boss = true;
  for (let r = 0; r < H; r++) {
    for (let c = 0; c < W; c++) {
      const t = ch(c, r);
      if (t === '#' || t === ' ') continue;
      if (!seen[r * W + c]) { unreached++; if (t === 'B') boss = false; }
      else if (t === '>') stairs = true;
    }
  }
  return { ok: stairs && boss && unreached === 0 && starts > 0 && keysTotal >= nd, unreached, doors: nd, keys: keysTotal, doorsTotal };
}
