import { COLORS } from '../../core/palette.js';

// Cook-Off kitchen generator. The kitchen is a grid: a ring of counters around the edge
// (with the serving hatch in one side wall), a random island shape in the middle, and the
// stations (crates, boards, pans, pots, plates, bin) spread over the counters by simple
// scoring rules. Every station always faces a reachable floor cell. It grows with players.

const SIZES = [[9, 7], [11, 8], [13, 9]]; // [width, depth] for 1–2, 3–4, 5–6 players

/** Color themes: counter colors for back / front / left / right walls and islands, plus floor tiles. */
const THEMES = [
  { back: COLORS.candyBlue, front: COLORS.candyYellow, left: COLORS.candyPink, right: COLORS.candyMint, island: COLORS.candyLilac, floor: ['#ffe3c2', '#fff7ea'], wall: 0xfff3dc, band: COLORS.candyBlue },
  { back: 0x9ff0c8, front: 0xffc9a8, left: 0x8fd8ff, right: 0xffe47a, island: 0xff9fd0, floor: ['#d9f2ff', '#f4fbff'], wall: 0xfff8ee, band: 0x3ddc97 },
  { back: 0xffb3c7, front: 0xc9a8ff, left: 0xffe47a, right: 0x8fd8ff, island: 0x9ff0c8, floor: ['#ffe0ec', '#fff6fa'], wall: 0xfff1f6, band: 0xff8fc8 },
  { back: 0xffd27a, front: 0x8fd8ff, left: 0x9ff0c8, right: 0xff9fd0, island: 0xffb36b, floor: ['#e9f7d9', '#fbfff4'], wall: 0xfffbe8, band: 0xffb347 },
];

const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/** Island shapes, as lists of [r, c]. Interior rows run 2..D-3, columns 2..W-3. */
const ISLANDS = {
  open: () => [],
  bar(W, D, rand) {
    const r = Math.floor(D / 2) - (rand() < 0.5 ? 1 : 0) + (D >= 9 && rand() < 0.4 ? 1 : 0);
    const len = Math.max(3, Math.round((W - 5) * (0.6 + rand() * 0.4)));
    const c0 = 2 + Math.floor(rand() * (W - 4 - len + 1));
    const thick = D >= 8 && rand() < 0.5 ? 2 : 1;
    const out = [];
    for (let t = 0; t < thick; t++) for (let c = c0; c < c0 + len; c++) out.push([r + t, c]);
    return out;
  },
  split(W, D, rand) {
    // Two bars with a 1- or 3-cell gap in the middle (W is always odd).
    const r = Math.floor(D / 2) - (rand() < 0.5 ? 1 : 0);
    const gap = W >= 11 && rand() < 0.5 ? 3 : 1;
    const mid = (W - 1) / 2, half = (gap + 1) / 2;
    const len = Math.floor((W - 4 - gap) / 2) - (rand() < 0.4 ? 1 : 0);
    const out = [];
    for (let i = 0; i < len; i++) out.push([r, mid - half - i], [r, mid + half + i]);
    return out.filter(([, c]) => c >= 2 && c <= W - 3);
  },
  column(W, D, rand) {
    const c = Math.floor(W / 2) + Math.floor(rand() * 3) - 1;
    const len = Math.max(2, D - 5 + (rand() < 0.5 ? 0 : 1));
    const r0 = 2 + Math.floor(rand() * (D - 4 - len + 1));
    const out = [];
    for (let r = r0; r < r0 + len; r++) out.push([r, c]);
    if (W >= 11 && rand() < 0.5) for (let r = r0; r < r0 + len; r++) out.push([r, c + 1]);
    return out;
  },
  twinCols(W, D, rand) {
    const len = Math.max(2, D - 5 + (rand() < 0.4 ? 1 : 0));
    const r0 = 2 + Math.floor(rand() * (D - 4 - len + 1));
    const a = Math.round((W - 1) / 3), b = W - 1 - a;
    const out = [];
    for (let r = r0; r < r0 + len; r++) out.push([r, a], [r, b]);
    return out;
  },
  ell(W, D, rand) {
    const out = ISLANDS.bar(W, D, rand).filter(([r], i, arr) => r === arr[0][0]);
    const r = out[0][0];
    const end = rand() < 0.5 ? out[0] : out[out.length - 1];
    const dir = r - 2 >= D - 3 - r ? -1 : 1; // arm toward the bigger gap
    for (let i = 1; i <= Math.max(1, Math.floor((D - 5) / 2)); i++) out.push([r + dir * i, end[1]]);
    return out;
  },
  pillars(W, D, rand) {
    const out = [];
    const want = 2 + Math.floor(rand() * (W >= 11 ? 3 : 2));
    for (let tries = 0; tries < 60 && out.length < want * 2; tries++) {
      const vert = rand() < 0.4;
      const r = 2 + Math.floor(rand() * (D - 4 - (vert ? 1 : 0)));
      const c = 2 + Math.floor(rand() * (W - 4 - (vert ? 0 : 1)));
      const cells = vert ? [[r, c], [r + 1, c]] : [[r, c], [r, c + 1]];
      // Keep a free cell around every pillar so the floor stays roomy.
      const clash = cells.some(([rr, cc]) => out.some(([or, oc]) => Math.abs(or - rr) <= 1 && Math.abs(oc - cc) <= 1));
      if (!clash) out.push(...cells);
    }
    return out;
  },
};

/**
 * Build a kitchen. needs: Set of station kinds the menu uses ('board', 'pan', 'pot').
 * Returns { W, D, cells, hatchSide, theme } where cells[r][c] is null (floor) or
 * { type: 'counter'|'board'|'pan'|'pot'|'crate'|'plates'|'bin'|'hatch', ing?, island? }.
 */
export function makeKitchen(rand, { n, ings, needs }) {
  for (let attempt = 0; attempt < 80; attempt++) {
    const k = tryKitchen(rand, { n, ings, needs });
    if (k) return k;
  }
  return tryKitchen(rand, { n, ings, needs, shape: 'open' });
}

function tryKitchen(rand, { n, ings, needs, shape }) {
  const [W, D] = SIZES[n <= 2 ? 0 : n <= 4 ? 1 : 2];
  const cells = Array.from({ length: D }, () => Array(W).fill(null));
  const inside = (r, c) => r >= 0 && c >= 0 && r < D && c < W;
  for (let r = 0; r < D; r++) for (let c = 0; c < W; c++) {
    if (r === 0 || c === 0 || r === D - 1 || c === W - 1) cells[r][c] = { type: 'counter' };
  }
  // Serving hatch: two cells in the left or right wall.
  const hatchSide = rand() < 0.5 ? 1 : -1;
  const hc = hatchSide > 0 ? W - 1 : 0;
  const hr = 1 + Math.floor(rand() * (D - 3));
  cells[hr][hc] = { type: 'hatch' };
  cells[hr + 1][hc] = { type: 'hatch' };

  // Island.
  const names = Object.keys(ISLANDS).filter((s) => s !== 'open' || rand() < 0.3);
  const name = shape || names[Math.floor(rand() * names.length)];
  for (const [r, c] of ISLANDS[name](W, D, rand)) {
    if (r >= 2 && c >= 2 && r <= D - 3 && c <= W - 3) cells[r][c] = { type: 'counter', island: true };
  }

  // All floor must be one connected area.
  const floors = [];
  for (let r = 0; r < D; r++) for (let c = 0; c < W; c++) if (!cells[r][c]) floors.push([r, c]);
  const seen = new Set([floors[0][0] * 100 + floors[0][1]]);
  const q = [floors[0]];
  while (q.length) {
    const [r, c] = q.pop();
    for (const [dr, dc] of N4) {
      const rr = r + dr, cc = c + dc;
      if (inside(rr, cc) && !cells[rr][cc] && !seen.has(rr * 100 + cc)) { seen.add(rr * 100 + cc); q.push([rr, cc]); }
    }
  }
  if (seen.size !== floors.length) return null;
  if (floors.length < (W - 2) * (D - 2) * 0.62) return null; // keep enough room to walk

  // Usable slots: counters (not corners, not the hatch) that touch the floor.
  const corner = (r, c) => (r === 0 || r === D - 1) && (c === 0 || c === W - 1);
  const free = new Set();
  for (let r = 0; r < D; r++) for (let c = 0; c < W; c++) {
    const st = cells[r][c];
    if (!st || st.type !== 'counter' || corner(r, c)) continue;
    if (N4.some(([dr, dc]) => inside(r + dr, c + dc) && !cells[r + dr][c + dc])) free.add(r * 100 + c);
  }
  const hatchPos = [hr + 0.5, hc];
  const placed = []; // centers of placed groups, for spreading
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const spread = (p, cap = 6) => (placed.length ? Math.min(cap, ...placed.map((q2) => dist(p, q2))) : cap);

  /** All straight runs of `len` free slots (same row or column). */
  function runs(len) {
    const out = [];
    for (const key of free) {
      const r = Math.floor(key / 100), c = key % 100;
      for (const [dr, dc] of [[0, 1], [1, 0]]) {
        const run = [];
        for (let i = 0; i < len; i++) {
          const rr = r + dr * i, cc = c + dc * i;
          if (!free.has(rr * 100 + cc)) break;
          // A run must sit on one counter line: all on the border or all on the island.
          if (run.length && !!cells[rr][cc].island !== !!cells[r][c].island) break;
          run.push([rr, cc]);
        }
        if (run.length === len) out.push(run);
      }
    }
    return out;
  }

  /** Place a group of stations, as one straight run when possible. */
  function place(len, make, score) {
    let options = runs(len);
    if (!options.length) {
      if (len === 1) return false;
      // Fall back to splitting the group in two.
      const a = Math.ceil(len / 2);
      return place(a, (i) => make(i), score) && place(len - a, (i) => make(i + a), score);
    }
    let best = null, bestS = -Infinity;
    for (const run of options) {
      const center = [run.reduce((s, p) => s + p[0], 0) / len, run.reduce((s, p) => s + p[1], 0) / len];
      const s = score(center) + rand() * 3;
      if (s > bestS) { bestS = s; best = { run, center }; }
    }
    best.run.forEach(([r, c], i) => { cells[r][c] = { ...make(i), island: cells[r][c].island }; free.delete(r * 100 + c); });
    placed.push(best.center);
    return true;
  }

  const crateOrder = [...ings];
  const pick = (arr) => arr[Math.min(arr.length - 1, n - 1)];
  // Crates (a second set for bigger teams, far from the first).
  if (!place(ings.length, (i) => ({ type: 'crate', ing: crateOrder[i] }), (p) => spread(p) * 0.5 + dist(p, hatchPos) * 0.3)) return null;
  const firstCrates = placed[placed.length - 1];
  if (n >= 3) {
    crateOrder.reverse();
    if (!place(ings.length, (i) => ({ type: 'crate', ing: crateOrder[i] }), (p) => dist(p, firstCrates) * 1.2)) return null;
  }
  if (needs.has('pot') && !place(pick([2, 2, 2, 3, 3, 3]), () => ({ type: 'pot' }), (p) => spread(p))) return null;
  if (needs.has('pan') && !place(pick([2, 2, 2, 3, 3, 4]), () => ({ type: 'pan' }), (p) => spread(p))) return null;
  const boards = needs.has('board') ? pick([2, 2, 3, 3, 4, 4]) : 0;
  for (let i = 0; i < boards; i++) {
    const pair = boards - i >= 2 && rand() < 0.4;
    if (!place(pair ? 2 : 1, () => ({ type: 'board' }), (p) => spread(p))) return null;
    if (pair) i++;
  }
  for (let i = 0; i < (n >= 3 ? 2 : 1); i++) {
    if (!place(1, () => ({ type: 'plates' }), (p) => spread(p, 3) * 0.6 - dist(p, hatchPos) * 0.35)) return null;
  }
  if (!place(1, () => ({ type: 'bin' }), (p) => spread(p, 4))) return null;
  // Leave a few plain counters for putting plates and food down.
  if (free.size < 4) return null;

  const theme = THEMES[Math.floor(rand() * THEMES.length)];
  return { W, D, cells, hatchSide, theme, shape: name };
}
