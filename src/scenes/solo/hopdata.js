// Where the jumping content sits on the solo island (pure data: map.js reads the zones while it builds the
// terrain, hops.js builds the stones, ledges, trails and chests from these numbers).
//
// Heights: `top` is the standable top above the ground at that spot (hops.js adds the terrain height), or
// `abs` an absolute height (for things in the sea, in the gorge or on the cliff path).

/** A small pond south of the square with stepping stones across (map.js digs it into the terrain). */
export const POND = { x: 14.5, z: 25, r: 3.4 };

// Up on the cliff tops there are only two places: the grove (by the hidden steps behind the waterfall) and
// the lookout (by the Cliff Climb). Rock walls you can see close them in (the owner's call: no invisible walls,
// and nothing else up there to wander off to). The cliff faces are steep: no foothold, you slide down them
// (island.js), so walking off the edge always takes you back down.

/**
 * The rock walls on the cliff tops (map.js builds them): lines of boulders twice a bean's height, taller than any
 * jump, that block along the whole line at any height. Each line starts at the foot of the cliff and climbs the
 * face, so there is no way round its end. The grove: the upper river's bank (to the spring's boulders) in the
 * west, a wall out to the sea in the east, the sea in the north. The lookout: a U from the cliff edge round
 * behind the deck and back to the edge.
 */
export const CLIFF_WALLS = [
  { id: 'groveW', pts: [[-20.45, -33.75], [-20.2, -36.7], [-20.0, -39.6]] }, // along the bank, into the spring's boulders
  { id: 'groveE', pts: [[-9.2, -31.05], [-9.0, -36.5], [-9.3, -41.75], [-9.3, -42.45]], sea: 1 }, // the last 0.7 out over the sea
  { id: 'lookout', pts: [[11.2, -34.2], [11.0, -41.3], [16.8, -41.7], [22.4, -41.3], [22.4, -34.3]] },
];
export const WALL_R = 0.62; // the walls block this far either side of their line (the boulders are wider)

/** How far (x, z) is from the nearest cliff wall's line. */
export function cliffWallDist(x, z) {
  let best = Infinity;
  for (const w of CLIFF_WALLS) {
    for (let i = 1; i < w.pts.length; i++) {
      const [ax, az] = w.pts[i - 1], [bx, bz] = w.pts[i];
      const dx = bx - ax, dz = bz - az, L = dx * dx + dz * dz || 1;
      const k = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L));
      best = Math.min(best, Math.hypot(x - ax - dx * k, z - az - dz * k));
    }
  }
  return best;
}

/** Spots kept free of the random trees, bushes and flowers (the random sequence itself is kept). */
export const KEEP_CLEAR = [
  { x0: -19.6, x1: -10, z0: -42, z1: -32 }, // the grove
  { x0: 11, x1: 22.5, z0: -41, z1: -33.4 }, // the lookout
  { x: POND.x, z: POND.z, r: POND.r + 1.6 },
  { x: -12, z: 27, r: 3.6 }, // the hollow tree
  { x0: 40, x1: 52.5, z0: -6.4, z1: -2 }, // the Stump Hop
  { x0: -8.4, x1: 4.2, z0: 32, z1: 35.6 }, // the Barrel Run
  { x0: 12.6, x1: 20, z0: -34, z1: -30.5 }, // the foot of the cliff path
  { x0: 33.2, x1: 36.2, z0: -18.4, z1: -12.4 }, // the crates up to the game hall roof
  { x0: -29.6, x1: -20.6, z0: 0.4, z1: 3.8 }, // the river stepping stones
];

export const inKeepClear = (x, z) => KEEP_CLEAR.some((k) => (k.r !== undefined ? Math.hypot(x - k.x, z - k.z) < k.r : x > k.x0 && x < k.x1 && z > k.z0 && z < k.z1)) || cliffWallDist(x, z) < 3;

// ---------- stepping stones and ledges (not timed) ----------
// kind: stone (round, flat top), rock (a lumpy ledge rock), stump, crate, barrel, log, plank, pad (lily pad)
// r: radius (round things), hw/hd: half sizes (boxes)

/** Across the river south of the bridge: a shortcut to the west bank. */
export const RIVER_STONES = [[-22.9, 2.1], [-24.7, 2.5], [-26.5, 1.8]].map(([x, z]) => ({ kind: 'stone', x, z, r: 0.62, abs: 0.05 }));

/** Across the pond (west to east), with lily pads. */
export const POND_STONES = [
  { kind: 'stone', x: 12.1, z: 25.2, r: 0.6, abs: 0.05 },
  { kind: 'pad', x: 13.8, z: 24.5, r: 0.62, abs: -0.4 },
  { kind: 'stone', x: 15.4, z: 25.4, r: 0.6, abs: 0.05 },
  { kind: 'pad', x: 16.9, z: 24.4, r: 0.55, abs: -0.4 },
];

/** Hidden areas. Each has a chest (hops.js); the path there is its list of ledges. */
export const SECRETS = {
  // behind the waterfall: hop over the plunge pool, through the falling water into the slot behind it, up the
  // wet rocks in there and out onto the cliff top (map.js: FALL, UPPER)
  grove: {
    chest: { x: -14.4, z: -37.6 }, area: { x: -14.6, z: -36.8 },
    path: [
      { kind: 'stone', x: -20.3, z: -29.9, r: 0.55, abs: 0.1 },
      { kind: 'stone', x: -21.9, z: -30.4, r: 0.55, abs: 0.3 },
      { kind: 'rock', x: -23.2, z: -31.95, r: 0.55, abs: 1.0 },
      { kind: 'rock', x: -21.95, z: -32.0, r: 0.55, abs: 1.8 },
      { kind: 'rock', x: -20.7, z: -31.95, r: 0.55, abs: 2.6 },
      { kind: 'rock', x: -19.55, z: -32.75, r: 0.85, abs: 3.6 },
    ],
  },
  // Gull Rock off the beach: small rocks in the sea up to a ledge (the precise one)
  ledge: {
    chest: { x: 18.5, z: 48.1 }, area: { x: 18.5, z: 48.1 },
    path: [
      { kind: 'rock', x: 16.4, z: 43.9, r: 0.55, abs: 0.6 },
      { kind: 'rock', x: 17.8, z: 45.4, r: 0.45, abs: 1.35 },
      { kind: 'rock', x: 16.5, z: 46.9, r: 0.45, abs: 2.1 },
      { kind: 'ledge', x: 18.5, z: 48.1, r: 1.0, abs: 2.8 },
    ],
  },
  // the game hall roof: a stair of crates by its east wall, then the roof (hops.js adds the roof itself)
  roof: {
    chest: { x: 27, z: -15 }, area: { x: 27, z: -15 },
    path: [
      { kind: 'crate', x: 34.2, z: -13.2, hw: 0.45, hd: 0.45, top: 0.75 },
      { kind: 'crate', x: 35.3, z: -14.5, hw: 0.45, hd: 0.45, top: 1.5 },
      { kind: 'crate', x: 34.3, z: -15.8, hw: 0.45, hd: 0.45, top: 2.25 },
      { kind: 'crate', x: 35.4, z: -16.9, hw: 0.45, hd: 0.45, top: 3.0 },
      { kind: 'crate', x: 34.0, z: -17.5, hw: 0.45, hd: 0.45, top: 3.7 },
    ],
  },
  // the hollow tree: roots, a mushroom shelf and a branch up to the hollow at the top of the trunk
  hollow: {
    chest: { x: -12, z: 27 }, area: { x: -12, z: 27 }, tree: { x: -12, z: 27, r: 1.5, top: 3.1 },
    path: [
      { kind: 'root', x: -9.9, z: 28.2, r: 0.5, top: 0.6 },
      { kind: 'shelf', x: -9.5, z: 26.7, r: 0.55, top: 1.35 },
      { kind: 'branch', x: -10.4, z: 24.9, hw: 0.75, hd: 0.3, top: 2.15 },
    ],
  },
  // a tiny islet west of the dock: stepping stones out into the sea
  islet: {
    chest: { x: -15.4, z: 52.7 }, area: { x: -15.2, z: 52.4 }, island: { x: -15.2, z: 52.4, r: 2.3, abs: 0.25 },
    path: [
      { kind: 'stone', x: -12.9, z: 44.6, r: 0.6, abs: 0.05 },
      { kind: 'stone', x: -13.5, z: 46.7, r: 0.6, abs: 0.05 },
      { kind: 'stone', x: -14.6, z: 48.6, r: 0.55, abs: 0.05 },
    ],
  },
};
export const SECRET_IDS = Object.keys(SECRETS);

// ---------- hop trails (timed; ring the bell at the end) ----------
// racer: who can race you (hops.js). The first entry is the start (on the ground), the last holds the bell.

export const TRAILS = {
  stumps: {
    racer: 'pip', start: { x: 40.8, z: -4.2 }, sign: { x: 40.4, z: -2.6 }, level: 1,
    path: [
      { kind: 'stump', x: 42.6, z: -4.6, r: 0.5, top: 0.45 },
      { kind: 'stump', x: 44.4, z: -3.8, r: 0.5, top: 0.7 },
      { kind: 'log', x: 46.3, z: -4.5, hw: 0.95, hd: 0.36, top: 0.55 },
      { kind: 'stump', x: 48.2, z: -3.7, r: 0.5, top: 0.95 },
      { kind: 'crate', x: 49.8, z: -4.7, hw: 0.45, hd: 0.45, top: 0.75 },
      { kind: 'stump', x: 51.3, z: -3.9, r: 0.6, top: 1.15, bell: true },
    ],
  },
  barrels: {
    racer: 'grumbleton', start: { x: 2.9, z: 35.2 }, sign: { x: 2.0, z: 36.6 }, level: 2, // (start and flag beside the beach road, not on it)
    path: [
      { kind: 'barrel', x: 2.0, z: 33.4, r: 0.42, top: 0.9 },
      { kind: 'crate2', x: 0.2, z: 34.2, hw: 0.45, hd: 0.45, top: 1.4 },
      { kind: 'plank', x: -1.9, z: 33.5, hw: 1.0, hd: 0.2, top: 1.3 },
      { kind: 'barrel', x: -3.9, z: 34.2, r: 0.42, top: 0.95 },
      { kind: 'crate', x: -5.7, z: 33.1, hw: 0.45, hd: 0.45, top: 0.75 },
      { kind: 'crate2', x: -7.3, z: 33.6, hw: 0.45, hd: 0.45, top: 1.45, bell: true }, // (a wide gap to the café: nobody gets stuck between)
    ],
  },
  cliff: {
    racer: null, start: { x: 14.6, z: -30.6 }, sign: { x: 13.4, z: -30.0 }, level: 3,
    path: [
      { kind: 'rock', x: 14.0, z: -32.6, r: 0.6, abs: 0.85 },
      { kind: 'rock', x: 15.9, z: -33.5, r: 0.55, abs: 1.65 },
      { kind: 'rock', x: 17.75, z: -32.8, r: 0.55, abs: 2.45 },
      { kind: 'rock', x: 19.6, z: -33.8, r: 0.45, abs: 3.25 }, // (a bean's width and more from the one before: no pocket under the trail)
      { kind: 'rock', x: 18.0, z: -34.7, r: 0.6, abs: 4.0 },
      { kind: 'deck', x: 16.8, z: -37.4, hw: 1.6, hd: 1.2, abs: 4.85, bell: true },
    ],
  },
};
export const TRAIL_IDS = Object.keys(TRAILS);
