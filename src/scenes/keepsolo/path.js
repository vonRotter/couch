// Pathfinding for click-to-move: A* over the floor tiles (8 directions, no cutting past wall
// corners), then the path is pulled tight (a waypoint is skipped when the hero can walk straight
// past it without touching a wall). Works on any world with the keep tile API (the town too):
// s.W, s.H, s.walkable(c, r), s.walkableAt(x, z), s.tileC(x), s.tileR(z), s.cx(c), s.cz(r).

const DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.4142], [1, -1, 1.4142], [-1, 1, 1.4142], [-1, -1, 1.4142]];

/** Nearest walkable tile to (c, r) within `max` rings (for clicks on walls), or null. */
export function nearestWalkable(s, c, r, max = 3) {
  if (s.walkable(c, r)) return [c, r];
  for (let k = 1; k <= max; k++) {
    let best = null, bd = Infinity;
    for (let dr = -k; dr <= k; dr++) {
      for (let dc = -k; dc <= k; dc++) {
        if (Math.max(Math.abs(dc), Math.abs(dr)) !== k || !s.walkable(c + dc, r + dr)) continue;
        const d = dc * dc + dr * dr;
        if (d < bd) { bd = d; best = [c + dc, r + dr]; }
      }
    }
    if (best) return best;
  }
  return null;
}

/** Can a circle of radius `rad` go straight from (x0, z0) to (x1, z1)? */
export function clearWalk(s, x0, z0, x1, z1, rad = 0.45) {
  const dx = x1 - x0, dz = z1 - z0, d = Math.hypot(dx, dz);
  if (d < 1e-4) return true;
  const px = -dz / d * rad, pz = dx / d * rad;
  const n = Math.ceil(d / 0.3);
  for (let i = 0; i <= n; i++) {
    const x = x0 + dx * i / n, z = z0 + dz * i / n;
    if (!s.walkableAt(x, z) || !s.walkableAt(x + px, z + pz) || !s.walkableAt(x - px, z - pz)) return false;
  }
  return true;
}

/**
 * Path from (x0, z0) to (x1, z1) as a list of points (the start is not included).
 * Returns null when there is no way (closed doors count as walls). A goal inside a wall is moved
 * to the nearest floor tile; `near` > 0 stops that far from the goal (walking up to a chest).
 */
export function findPath(s, x0, z0, x1, z1, { maxNodes = 6000 } = {}) {
  const W = s.W, H = s.H;
  const sc0 = s.tileC(x0), sr0 = s.tileR(z0);
  const start = nearestWalkable(s, sc0, sr0, 1);
  const goalT = nearestWalkable(s, s.tileC(x1), s.tileR(z1), 3);
  if (!start || !goalT) return null;
  const goalIn = goalT[0] === s.tileC(x1) && goalT[1] === s.tileR(z1);
  const gx = goalIn ? x1 : s.cx(goalT[0]), gz = goalIn ? z1 : s.cz(goalT[1]);
  if (clearWalk(s, x0, z0, gx, gz)) return [{ x: gx, z: gz }];
  const si = start[1] * W + start[0], gi = goalT[1] * W + goalT[0];
  const g = new Float32Array(W * H).fill(Infinity);
  const prev = new Int32Array(W * H).fill(-1);
  const closed = new Uint8Array(W * H);
  const heap = new Heap();
  const h = (c, r) => { const dc = Math.abs(c - goalT[0]), dr = Math.abs(r - goalT[1]); return Math.max(dc, dr) + 0.4142 * Math.min(dc, dr); };
  g[si] = 0;
  heap.push(si, h(start[0], start[1]));
  let found = false, n = 0;
  while (heap.size && n++ < maxNodes) {
    const i = heap.pop();
    if (closed[i]) continue;
    closed[i] = 1;
    if (i === gi) { found = true; break; }
    const c = i % W, r = (i - c) / W;
    for (const [dc, dr, cost] of DIRS) {
      const nc = c + dc, nr = r + dr;
      if (nc < 0 || nr < 0 || nc >= W || nr >= H || !s.walkable(nc, nr)) continue;
      if (dc && dr && (!s.walkable(c + dc, r) || !s.walkable(c, r + dr))) continue;
      const j = nr * W + nc;
      if (closed[j]) continue;
      const ng = g[i] + cost;
      if (ng < g[j]) { g[j] = ng; prev[j] = i; heap.push(j, ng + h(nc, nr)); }
    }
  }
  if (!found) return null;
  const tiles = [];
  for (let i = gi; i !== -1 && i !== si; i = prev[i]) tiles.push(i);
  tiles.reverse();
  const pts = tiles.map((i) => ({ x: s.cx(i % W), z: s.cz(Math.floor(i / W)) }));
  if (pts.length) pts[pts.length - 1] = { x: gx, z: gz };
  else pts.push({ x: gx, z: gz });
  // Pull the path tight: from each point, jump to the farthest point still in straight sight.
  const out = [];
  let ax = x0, az = z0, k = 0;
  while (k < pts.length) {
    let far = k;
    for (let j = pts.length - 1; j > k; j--) if (clearWalk(s, ax, az, pts[j].x, pts[j].z)) { far = j; break; }
    out.push(pts[far]);
    ax = pts[far].x; az = pts[far].z;
    k = far + 1;
  }
  return out;
}

/** Small binary min-heap of (index, priority). */
class Heap {
  constructor() { this.i = []; this.p = []; }
  get size() { return this.i.length; }
  push(i, p) {
    const I = this.i, P = this.p;
    I.push(i); P.push(p);
    let k = I.length - 1;
    while (k > 0) {
      const up = (k - 1) >> 1;
      if (P[up] <= P[k]) break;
      [I[up], I[k]] = [I[k], I[up]]; [P[up], P[k]] = [P[k], P[up]];
      k = up;
    }
  }
  pop() {
    const I = this.i, P = this.p;
    const top = I[0];
    const li = I.pop(), lp = P.pop();
    if (I.length) {
      I[0] = li; P[0] = lp;
      let k = 0;
      for (;;) {
        const a = 2 * k + 1, b = a + 1;
        let m = k;
        if (a < I.length && P[a] < P[m]) m = a;
        if (b < I.length && P[b] < P[m]) m = b;
        if (m === k) break;
        [I[m], I[k]] = [I[k], I[m]]; [P[m], P[k]] = [P[k], P[m]];
        k = m;
      }
    }
    return top;
  }
}
