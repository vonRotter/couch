import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { COLORS, toon, sharedGeo, faceted } from '../../core/palette.js';
import { seeded } from '../../core/world.js';
import { wedgeGeometry } from './props.js';

// Snowball Fort maps: a flat snow field (2*HX by 2*HZ) with tactical features on top.
// Team Sun plays on the left (x < 0), Team Sea on the right. Features are written for the right
// half and mirrored to the left, unless marked `c: 1` (centered, symmetric on its own).
//
//   mound  round hill you can walk up from every side (high ground)
//   plat   raised platform (bridge deck, peak, perch); only reachable by ramps
//   ramp   slope up to a platform; `dir` is the direction it rises toward
//   water  icy creek you cannot walk into (bridges and tunnels cross it)
//   tunnel ice tunnel along x: safe from snowballs inside, but no room to throw
//   block  solid ice wall (choke points); stops movement and snowballs
//   rock   round boulder, low cover
//   cover  ice block that breaks after a few hits and grows back
//   ice    slippery patch
export const HX = 13, HZ = 7.5;
export const STEP = 0.3; // highest step you can walk up
export const TUNNEL_H = 1.7;
export const COVER_R = 0.55, COVER_H = 1.2, COVER_HP = 4, COVER_REGROW = 18;
const CELL = 0.5;
const NX = Math.round((HX * 2) / CELL), NZ = Math.round((HZ * 2) / CELL);
const NAV_R = 0.3; // bots plan with a slim body and let the physics slide them along walls
const TUNNEL_WALL = 0.25;

export const MAP_KEYS = ['meadow', 'creek', 'peaks'];

export const MAPS = {
  // Simple and open: one gentle hill in the middle, a few rocks and ice blocks to hide behind.
  meadow: {
    pile: [8.2, -4.8],
    power: [[0, 0]],
    zones: [[0, 0]],
    tips: ['snowball.tip.high', 'snowball.tip.ice'],
    features: [
      { t: 'mound', x: 0, z: 0, r: 3.2, h: 0.9, c: 1 },
      { t: 'ice', x: 0, z: -5.7, r: 1.6, c: 1 },
      { t: 'ice', x: 0, z: 5.7, r: 1.6, c: 1 },
      { t: 'rock', x: 4.6, z: -4.2, r: 0.75, h: 0.95 },
      { t: 'rock', x: 5.6, z: 4.0, r: 0.65, h: 0.85 },
      { t: 'cover', x: 4.4, z: 0.2 },
      { t: 'cover', x: 7.6, z: 2.4 },
    ],
  },
  // An icy creek splits the field: two high bridges (choke points) and a safe ice tunnel.
  creek: {
    pile: [8.6, -5.0],
    power: [[0, -4.7], [0, 4.7]],
    zones: [[0, -4.7], [0, 4.7]],
    tips: ['snowball.tip.tunnel', 'snowball.tip.high'],
    features: [
      { t: 'water', x0: -1.2, x1: 1.2, z0: -HZ - 0.6, z1: HZ + 0.6, c: 1 },
      { t: 'plat', x0: -1.5, x1: 1.5, z0: -5.7, z1: -3.7, h: 0.6, kind: 'bridge', c: 1 },
      { t: 'plat', x0: -1.5, x1: 1.5, z0: 3.7, z1: 5.7, h: 0.6, kind: 'bridge', c: 1 },
      { t: 'ramp', x0: 1.5, x1: 3.0, z0: -5.7, z1: -3.7, h: 0.6, dir: '-x', wood: 1 },
      { t: 'ramp', x0: 1.5, x1: 3.0, z0: 3.7, z1: 5.7, h: 0.6, dir: '-x', wood: 1 },
      { t: 'tunnel', x0: -2.8, x1: 2.8, z0: -1.0, z1: 1.0, c: 1 },
      { t: 'ice', x0: 2.9, x1: 4.6, z0: -1.7, z1: 1.7 },
      { t: 'cover', x: 4.5, z: -3.0 },
      { t: 'cover', x: 4.5, z: 3.0 },
      { t: 'cover', x: 7.7, z: 0 },
      { t: 'rock', x: 8.4, z: 5.3, r: 0.7, h: 0.9 },
    ],
  },
  // High ground and choke points: a central peak reached by ramps front and back, ice walls with
  // one gap, a sniper perch for each team and slippery ice lanes along the edges.
  peaks: {
    pile: [9.9, -4.6],
    power: [[0, -6.2], [0, 6.2]],
    zones: [[0, 0], [0, 6.2], [0, -6.2]],
    tips: ['snowball.tip.ramps', 'snowball.tip.ice'],
    features: [
      { t: 'plat', x0: -2.2, x1: 2.2, z0: -1.5, z1: 1.5, h: 1.1, kind: 'peak', c: 1 },
      { t: 'ramp', x0: -1.1, x1: 1.1, z0: 1.5, z1: 3.7, h: 1.1, dir: '-z', c: 1 },
      { t: 'ramp', x0: -1.1, x1: 1.1, z0: -3.7, z1: -1.5, h: 1.1, dir: '+z', c: 1 },
      { t: 'plat', x0: 6.8, x1: 8.8, z0: 3.5, z1: 5.7, h: 0.9, kind: 'perch' },
      { t: 'ramp', x0: 6.8, x1: 8.8, z0: 1.7, z1: 3.5, h: 0.9, dir: '+z' },
      { t: 'block', x0: 4.6, x1: 5.3, z0: -3.3, z1: -0.95, h: 1.4 },
      { t: 'block', x0: 4.6, x1: 5.3, z0: 0.95, z1: 3.3, h: 1.4 },
      { t: 'ice', x0: -4.2, x1: 4.2, z0: 5.0, z1: 7.3, c: 1 },
      { t: 'ice', x0: -4.2, x1: 4.2, z0: -7.3, z1: -5.0, c: 1 },
      { t: 'cover', x: 3.2, z: -4.3 },
      { t: 'cover', x: 3.2, z: 4.3 },
      { t: 'cover', x: 7.8, z: -2.4 },
    ],
  },
};

function mirror(f) {
  const m = { ...f };
  if ('x0' in f) { m.x0 = -f.x1; m.x1 = -f.x0; }
  if ('x' in f) m.x = -f.x;
  if (f.dir === '+x') m.dir = '-x';
  else if (f.dir === '-x') m.dir = '+x';
  return m;
}

const inRect = (f, x, z, pad = 0) => x > f.x0 - pad && x < f.x1 + pad && z > f.z0 - pad && z < f.z1 + pad;

/** Tiny binary min-heap of (key, value) for the bots' path search. */
class Heap {
  constructor() { this.k = []; this.v = []; }
  get size() { return this.k.length; }
  push(key, val) {
    const { k, v } = this;
    let i = k.length;
    k.push(key); v.push(val);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (k[p] <= key) break;
      k[i] = k[p]; v[i] = v[p]; i = p;
    }
    k[i] = key; v[i] = val;
  }
  pop() {
    const { k, v } = this;
    const top = v[0];
    const lk = k.pop(), lv = v.pop();
    if (k.length) {
      let i = 0;
      for (;;) {
        let c = i * 2 + 1;
        if (c >= k.length) break;
        if (c + 1 < k.length && k[c + 1] < k[c]) c++;
        if (k[c] >= lk) break;
        k[i] = k[c]; v[i] = v[c]; i = c;
      }
      k[i] = lk; v[i] = lv;
    }
    return top;
  }
}

const DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];

/** One map's features: ground height, collisions, snowball hits, bot navigation and meshes. */
export class Terrain {
  constructor(key) {
    this.key = key;
    this.def = MAPS[key];
    const all = [];
    for (const f of this.def.features) {
      all.push({ ...f });
      if (!f.c) all.push(mirror(f));
    }
    const of = (type) => all.filter((f) => f.t === type);
    this.plats = of('plat');
    this.ramps = of('ramp');
    this.mounds = of('mound');
    this.waters = of('water');
    this.rocks = of('rock');
    this.ices = of('ice');
    this.tunnels = of('tunnel');
    this.blocks = of('block');
    // A tunnel's two side walls are solid; the inside is a walkway.
    for (const tn of this.tunnels) {
      this.blocks.push({ t: 'block', x0: tn.x0, x1: tn.x1, z0: tn.z0, z1: tn.z0 + TUNNEL_WALL, h: TUNNEL_H, hidden: true });
      this.blocks.push({ t: 'block', x0: tn.x0, x1: tn.x1, z0: tn.z1 - TUNNEL_WALL, z1: tn.z1, h: TUNNEL_H, hidden: true });
    }
    this.covers = of('cover').map((c) => ({ ...c, hp: COVER_HP, alive: true, regrow: 0, k: 1, wobble: 0 }));
    this.fields = new Map();
    this.buildNav();
  }

  // ---------- queries ----------

  groundY(x, z) {
    let y = 0;
    for (const p of this.plats) if (inRect(p, x, z)) y = Math.max(y, p.h);
    for (const r of this.ramps) {
      if (!inRect(r, x, z)) continue;
      const f = r.dir === '+x' ? (x - r.x0) / (r.x1 - r.x0) : r.dir === '-x' ? (r.x1 - x) / (r.x1 - r.x0)
        : r.dir === '+z' ? (z - r.z0) / (r.z1 - r.z0) : (r.z1 - z) / (r.z1 - r.z0);
      y = Math.max(y, r.h * f);
    }
    for (const m of this.mounds) {
      const d = Math.hypot(x - m.x, z - m.z);
      if (d < m.r) y = Math.max(y, m.h * (Math.cos((Math.PI * d) / m.r) + 1) / 2);
    }
    return y;
  }

  /** Highest ground under a body of radius r (center plus four points around it). */
  maxGround(x, z, r) {
    return Math.max(this.groundY(x, z), this.groundY(x + r, z), this.groundY(x - r, z), this.groundY(x, z + r), this.groundY(x, z - r));
  }

  inTunnel(x, z) {
    for (const tn of this.tunnels) if (x > tn.x0 && x < tn.x1 && z > tn.z0 + TUNNEL_WALL && z < tn.z1 - TUNNEL_WALL) return tn;
    return null;
  }

  isWater(x, z, pad = 0) {
    for (const w of this.waters) {
      if (inRect(w, x, z, pad) && this.groundY(x, z) < 0.05 && !this.inTunnel(x, z)) return true;
    }
    return false;
  }

  isIce(x, z) {
    for (const f of this.ices) {
      if ('r' in f ? Math.hypot(x - f.x, z - f.z) < f.r : inRect(f, x, z)) return true;
    }
    return false;
  }

  /** Can a body of radius r stand here? `circles` also counts rocks and ice blocks. */
  solidAt(x, z, r, circles = true) {
    for (const b of this.blocks) if (inRect(b, x, z, r)) return true;
    if (this.isWater(x, z, r * 0.5)) return true;
    if (!circles) return false;
    for (const k of this.rocks) if (Math.hypot(x - k.x, z - k.z) < k.r + r) return true;
    for (const c of this.covers) if (c.alive && Math.hypot(x - c.x, z - c.z) < COVER_R + r) return true;
    return false;
  }

  /** What a snowball of radius r at (x, y, z) runs into: null, or { kind, cover }. */
  ballHit(x, y, z, r) {
    if (y - r < this.groundY(x, z)) return { kind: 'ground' };
    for (const b of this.blocks) if (y - r < b.h && inRect(b, x, z, r)) return { kind: 'block' };
    for (const tn of this.tunnels) if (y < TUNNEL_H + r && inRect(tn, x, z, r)) return { kind: 'roof' };
    for (const k of this.rocks) if (y < k.h && Math.hypot(x - k.x, z - k.z) < k.r + r) return { kind: 'block' };
    for (const c of this.covers) if (c.alive && y < COVER_H * c.k + r && Math.hypot(x - c.x, z - c.z) < COVER_R + r) return { kind: 'cover', cover: c };
    return null;
  }

  /** Pushes a body out of rocks and ice blocks (smooth sliding around round things). */
  pushOutCircles(o, r) {
    const push = (cx, cz, min) => {
      const dx = o.x - cx, dz = o.z - cz, d = Math.hypot(dx, dz);
      if (d < min && d > 1e-5) { o.x = cx + (dx / d) * min; o.z = cz + (dz / d) * min; }
    };
    for (const k of this.rocks) push(k.x, k.z, k.r + r);
    for (const c of this.covers) if (c.alive) push(c.x, c.z, COVER_R + r);
  }

  /** Nearest free spot to (x, z), searching outward. */
  findFree(x, z, r = 0.5) {
    if (!this.solidAt(x, z, r)) return { x, z };
    for (let rad = 0.4; rad < 6; rad += 0.4) {
      for (let a = 0; a < 16; a++) {
        const px = x + Math.cos((a / 16) * Math.PI * 2) * rad, pz = z + Math.sin((a / 16) * Math.PI * 2) * rad;
        if (Math.abs(px) < HX - 0.6 && Math.abs(pz) < HZ - 0.6 && !this.solidAt(px, pz, r)) return { x: px, z: pz };
      }
    }
    return { x, z };
  }

  // ---------- bot navigation ----------

  buildNav() {
    this.navOk = new Uint8Array(NX * NZ);
    this.navH = new Float32Array(NX * NZ);
    for (let j = 0; j < NZ; j++) {
      for (let i = 0; i < NX; i++) {
        const x = -HX + (i + 0.5) * CELL, z = -HZ + (j + 0.5) * CELL;
        const k = j * NX + i;
        this.navOk[k] = this.solidAt(x, z, NAV_R) ? 0 : 1;
        this.navH[k] = this.groundY(x, z);
      }
    }
    this.fields.clear();
  }

  cellOf(x, z) {
    const i = THREE.MathUtils.clamp(Math.floor((x + HX) / CELL), 0, NX - 1);
    const j = THREE.MathUtils.clamp(Math.floor((z + HZ) / CELL), 0, NZ - 1);
    return j * NX + i;
  }

  cellPos(k) {
    return { x: -HX + ((k % NX) + 0.5) * CELL, z: -HZ + (Math.floor(k / NX) + 0.5) * CELL };
  }

  /** Can you walk from cell a to its neighbor b? */
  edge(a, b, di, dj) {
    const { navOk, navH } = this;
    if (!navOk[b]) return false;
    if (di && dj) {
      const a1 = a + di, a2 = a + dj * NX;
      if (!navOk[a1] || !navOk[a2]) return false;
      return Math.abs(navH[a] - navH[b]) <= STEP * 1.45;
    }
    return Math.abs(navH[a] - navH[b]) <= STEP;
  }

  /** Distance-to-goal field (Dijkstra over the grid), cached per goal cell. */
  field(gx, gz) {
    let goal = this.cellOf(gx, gz);
    if (!this.navOk[goal]) {
      const p = this.findFree(gx, gz, NAV_R + 0.05);
      goal = this.cellOf(p.x, p.z);
    }
    let f = this.fields.get(goal);
    if (f) return f;
    if (this.fields.size > 48) this.fields.clear();
    f = new Float32Array(NX * NZ).fill(1e9);
    f[goal] = 0;
    const heap = new Heap();
    heap.push(0, goal);
    while (heap.size) {
      const a = heap.pop();
      const ai = a % NX, aj = (a / NX) | 0;
      for (const [di, dj, cost] of DIRS) {
        const bi = ai + di, bj = aj + dj;
        if (bi < 0 || bj < 0 || bi >= NX || bj >= NZ) continue;
        const b = bj * NX + bi;
        const nd = f[a] + cost;
        if (nd < f[b] && this.edge(b, a, -di, -dj)) { f[b] = nd; heap.push(nd, b); }
      }
    }
    this.fields.set(goal, f);
    return f;
  }

  /** Straight walk possible? Samples the segment for walls, water and steps that are too high. */
  lineClear(x0, z0, x1, z1, r = 0.38) {
    const d = Math.hypot(x1 - x0, z1 - z0);
    const n = Math.max(1, Math.ceil(d / 0.25));
    let prev = this.groundY(x0, z0);
    for (let s = 1; s <= n; s++) {
      const x = x0 + ((x1 - x0) * s) / n, z = z0 + ((z1 - z0) * s) / n;
      if (this.solidAt(x, z, r)) return false;
      const h = this.groundY(x, z);
      if (Math.abs(h - prev) > STEP * 0.9) return false;
      prev = h;
    }
    return true;
  }

  /** Next point to walk toward on the way to (gx, gz). */
  waypoint(x, z, gx, gz) {
    if (this.lineClear(x, z, gx, gz)) return { x: gx, z: gz };
    const f = this.field(gx, gz);
    let c = this.cellOf(x, z);
    const path = [];
    for (let step = 0; step < 10; step++) {
      const ci = c % NX, cj = (c / NX) | 0;
      let best = -1, bestD = f[c];
      for (const [di, dj] of DIRS) {
        const bi = ci + di, bj = cj + dj;
        if (bi < 0 || bj < 0 || bi >= NX || bj >= NZ) continue;
        const b = bj * NX + bi;
        if (f[b] >= bestD) continue;
        // From a cell the planner thinks is blocked (we are rubbing a wall), any free neighbor will do.
        if (this.navOk[c] ? !this.edge(c, b, di, dj) : !this.navOk[b]) continue;
        best = b; bestD = f[b];
      }
      if (best < 0) break;
      c = best;
      path.push(c);
    }
    if (!path.length) return { x: gx, z: gz };
    for (let k = path.length - 1; k > 0; k--) {
      const p = this.cellPos(path[k]);
      if (this.lineClear(x, z, p.x, p.z)) return p;
    }
    return this.cellPos(path[0]);
  }

  // ---------- meshes ----------

  build(parent, mats) {
    const rand = seeded(this.key.length * 17 + 5);
    const add = (m, shadow = true) => {
      if (shadow) { m.castShadow = true; m.receiveShadow = true; }
      parent.add(m);
      return m;
    };

    // Icy creek water with floating ice chunks and foamy banks.
    for (const w of this.waters) {
      const z0 = Math.max(w.z0, -HZ - 0.4), z1 = Math.min(w.z1, HZ + 0.4);
      const water = new THREE.Mesh(new THREE.PlaneGeometry(w.x1 - w.x0, z1 - z0), toon(0x63c2ee));
      water.rotation.x = -Math.PI / 2;
      water.position.set((w.x0 + w.x1) / 2, 0.012, (z0 + z1) / 2);
      add(water, false).receiveShadow = true;
      for (const x of [w.x0, w.x1]) {
        const foam = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, z1 - z0, 4, 8), toon(COLORS.white));
        foam.rotation.x = Math.PI / 2;
        foam.scale.set(1, 1, 0.5);
        foam.position.set(x, 0.03, (z0 + z1) / 2);
        add(foam);
      }
      for (let i = 0; i < 14; i++) {
        const x = w.x0 + 0.3 + rand() * (w.x1 - w.x0 - 0.6), z = z0 + 0.5 + rand() * (z1 - z0 - 1);
        if (this.plats.some((p) => inRect(p, x, z, 0.3)) || this.tunnels.some((tn) => inRect(tn, x, z, 0.3))) continue;
        const chunk = new THREE.Mesh(sharedGeo('sbChunk', () => new THREE.CylinderGeometry(0.28, 0.32, 0.08, 6)), toon(0xe9f7ff));
        chunk.position.set(x, 0.04, z);
        chunk.scale.setScalar(0.6 + rand() * 0.7);
        chunk.rotation.y = rand() * 3;
        add(chunk, false);
      }
    }

    // Ice patches: pale blue with a few shiny streaks.
    for (const f of this.ices) {
      const round = 'r' in f;
      const geo = round ? new THREE.CircleGeometry(f.r, 28) : new THREE.PlaneGeometry(f.x1 - f.x0, f.z1 - f.z0);
      const ice = new THREE.Mesh(geo, toon(0xc9ecff));
      ice.rotation.x = -Math.PI / 2;
      const cx = round ? f.x : (f.x0 + f.x1) / 2, cz = round ? f.z : (f.z0 + f.z1) / 2;
      ice.position.set(cx, 0.018, cz);
      ice.receiveShadow = true;
      parent.add(ice);
      const w = round ? f.r : (f.x1 - f.x0) / 2, h = round ? f.r : (f.z1 - f.z0) / 2;
      for (let i = 0; i < 4; i++) {
        const streak = new THREE.Mesh(sharedGeo('sbStreak', () => new THREE.PlaneGeometry(0.9, 0.08)), toon(COLORS.white));
        streak.rotation.set(-Math.PI / 2, 0, 0.6);
        streak.position.set(cx + (rand() - 0.5) * w * 1.1, 0.024, cz + (rand() - 0.5) * h * 1.1);
        streak.scale.x = 0.5 + rand();
        parent.add(streak);
      }
    }

    // Hills.
    for (const m of this.mounds) {
      const pts = [];
      for (let i = 0; i <= 16; i++) {
        const d = m.r * (1 - i / 16);
        pts.push(new THREE.Vector2(d, m.h * (Math.cos((Math.PI * d) / m.r) + 1) / 2));
      }
      const hill = new THREE.Mesh(new THREE.LatheGeometry(pts, 36), toon(0xf6fbff));
      hill.position.set(m.x, 0.005, m.z);
      add(hill).castShadow = false;
    }

    // Platforms: wooden bridges, or ice cliffs with a snow top and icicles.
    for (const p of this.plats) {
      const w = p.x1 - p.x0, d = p.z1 - p.z0, cx = (p.x0 + p.x1) / 2, cz = (p.z0 + p.z1) / 2;
      if (p.kind === 'bridge') {
        const deck = new THREE.Mesh(new RoundedBoxGeometry(w, 0.2, d, 2, 0.05), toon(COLORS.trunk));
        deck.position.set(cx, p.h - 0.1, cz);
        add(deck);
        for (let k = 0; k < 5; k++) {
          const plank = new THREE.Mesh(sharedGeo('sbPlank', () => new THREE.BoxGeometry(0.06, 0.02, 1)), toon(0x8a5a36));
          plank.scale.z = d - 0.1;
          plank.position.set(p.x0 + ((k + 0.5) * w) / 5, p.h + 0.005, cz);
          parent.add(plank);
        }
        for (const z of [p.z0 + 0.08, p.z1 - 0.08]) {
          const rail = new THREE.Mesh(sharedGeo('sbRail', () => new THREE.CylinderGeometry(0.05, 0.05, 1, 6)), toon(0x8a5a36));
          rail.rotation.z = Math.PI / 2;
          rail.scale.y = w;
          rail.position.set(cx, p.h + 0.5, z);
          add(rail);
          for (const x of [p.x0 + 0.1, cx, p.x1 - 0.1]) {
            const post = new THREE.Mesh(sharedGeo('sbPost', () => new THREE.CylinderGeometry(0.07, 0.07, 1.2, 6)), toon(COLORS.trunk));
            post.position.set(x, p.h - 0.05, z);
            add(post);
            const cap = new THREE.Mesh(sharedGeo('sbPostCap', () => new THREE.SphereGeometry(0.1, 8, 6)), toon(COLORS.white));
            cap.position.set(x, p.h + 0.57, z);
            parent.add(cap);
          }
        }
      } else {
        const cliff = new THREE.Mesh(new RoundedBoxGeometry(w, p.h, d, 2, 0.1), toon(0xcfe7fb));
        cliff.position.set(cx, p.h / 2, cz);
        add(cliff);
        const top = new THREE.Mesh(new RoundedBoxGeometry(w + 0.12, 0.18, d + 0.12, 2, 0.08), toon(COLORS.white));
        top.position.set(cx, p.h, cz);
        add(top);
        for (let x = p.x0 + 0.3; x < p.x1 - 0.1; x += 0.55) {
          if (this.ramps.some((r) => inRect(r, x, p.z1 + 0.2))) continue;
          const icicle = new THREE.Mesh(sharedGeo('sbIcicle', () => new THREE.ConeGeometry(0.07, 0.4, 5)), toon(0xbfe8ff));
          icicle.rotation.x = Math.PI;
          icicle.position.set(x, p.h - 0.25 - rand() * 0.1, p.z1 + 0.04);
          icicle.scale.y = 0.6 + rand() * 0.7;
          parent.add(icicle);
        }
      }
    }

    // Ramps.
    for (const r of this.ramps) {
      const along = r.dir.endsWith('x');
      const len = along ? r.x1 - r.x0 : r.z1 - r.z0, w = along ? r.z1 - r.z0 : r.x1 - r.x0;
      const ramp = new THREE.Mesh(wedgeGeometry(len, w, r.h), toon(r.wood ? COLORS.trunk : 0xeef6ff));
      const cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
      ramp.rotation.y = { '+x': 0, '-x': Math.PI, '+z': -Math.PI / 2, '-z': Math.PI / 2 }[r.dir];
      // The wedge starts at its local origin: shift it so its low end sits at the low side.
      const dx = { '+x': -len / 2, '-x': len / 2, '+z': 0, '-z': 0 }[r.dir];
      const dz = { '+x': 0, '-x': 0, '+z': -len / 2, '-z': len / 2 }[r.dir];
      ramp.position.set(cx + dx, 0.005, cz + dz);
      add(ramp);
    }

    // Ice walls.
    for (const b of this.blocks) {
      if (b.hidden) continue;
      const w = b.x1 - b.x0, d = b.z1 - b.z0;
      const wall = new THREE.Mesh(new RoundedBoxGeometry(w, b.h, d, 2, 0.12), toon(0xa9dcf5));
      wall.position.set((b.x0 + b.x1) / 2, b.h / 2, (b.z0 + b.z1) / 2);
      add(wall);
      const cap = new THREE.Mesh(new RoundedBoxGeometry(w + 0.1, 0.2, d + 0.1, 2, 0.08), toon(COLORS.white));
      cap.position.set((b.x0 + b.x1) / 2, b.h, (b.z0 + b.z1) / 2);
      add(cap);
    }

    // Ice tunnels: a see-through half pipe so you can still spot who is inside.
    for (const tn of this.tunnels) {
      const len = tn.x1 - tn.x0, hw = (tn.z1 - tn.z0) / 2, cx = (tn.x0 + tn.x1) / 2, cz = (tn.z0 + tn.z1) / 2;
      const shell = new THREE.Mesh(new THREE.CylinderGeometry(hw, hw, len, 18, 1, true, 0, Math.PI), mats.tunnel);
      shell.rotation.z = Math.PI / 2;
      shell.scale.x = TUNNEL_H / hw;
      shell.position.set(cx, 0, cz);
      shell.renderOrder = 2;
      parent.add(shell);
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(len, hw * 2), toon(0xdff4ff));
      floor.rotation.x = -Math.PI / 2;
      floor.position.set(cx, 0.03, cz);
      floor.receiveShadow = true;
      parent.add(floor);
      for (const x of [tn.x0, tn.x1]) {
        const rim = new THREE.Mesh(sharedGeo('sbRim', () => new THREE.TorusGeometry(1, 0.13, 6, 18, Math.PI)), toon(COLORS.white));
        rim.rotation.y = Math.PI / 2;
        rim.scale.set(hw, TUNNEL_H, hw);
        rim.position.set(x, 0, cz);
        add(rim);
      }
    }

    // Boulders with snow caps.
    for (const k of this.rocks) {
      const rock = new THREE.Mesh(sharedGeo('sbRock', () => faceted(new THREE.IcosahedronGeometry(1, 0))), toon(COLORS.rock));
      rock.scale.set(k.r, k.h * 0.9, k.r);
      rock.position.set(k.x, k.h * 0.35, k.z);
      rock.rotation.y = rand() * 3;
      add(rock);
      const cap = new THREE.Mesh(sharedGeo('sbRockCap', () => new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2)), toon(COLORS.white));
      cap.scale.set(k.r * 0.75, k.h * 0.35, k.r * 0.75);
      cap.position.set(k.x, k.h * 0.95, k.z);
      add(cap);
    }

    // Breakable ice blocks.
    for (const c of this.covers) {
      const g = new THREE.Group();
      const body = new THREE.Mesh(sharedGeo('sbCover', () => new RoundedBoxGeometry(COVER_R * 1.85, COVER_H, COVER_R * 1.85, 2, 0.12)), toon(0xbfe6ff));
      body.position.y = COVER_H / 2;
      const top = new THREE.Mesh(sharedGeo('sbCoverTop', () => new RoundedBoxGeometry(COVER_R * 1.95, 0.18, COVER_R * 1.95, 2, 0.08)), toon(COLORS.white));
      top.position.y = COVER_H;
      body.castShadow = top.castShadow = true;
      body.receiveShadow = true;
      g.add(body, top);
      g.position.set(c.x, 0, c.z);
      g.rotation.y = rand() * 0.6 - 0.3;
      parent.add(g);
      c.mesh = g;
    }
  }
}
