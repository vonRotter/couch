// Where the jumping content sits on the solo island (pure data: map.js reads the zones while it builds the
// terrain, hops.js builds the stones, ledges, trails and chests from these numbers).
//
// Heights: `top` is the standable top above the ground at that spot (hops.js adds the terrain height), or
// `abs` an absolute height (for things in the sea, in the gorge or on the cliff path).

/** A small pond south of the square with stepping stones across (map.js digs it into the terrain). */
export const POND = { x: 14.5, z: 25, r: 3.4 };

/**
 * Cliff tops you can walk on once you get up there (everywhere else the cliffs stay a wall): the secret
 * grove beside the waterfall gorge and the lookout above kite hill. Inside these boxes the terrain itself
 * decides: you cannot walk up a steep face, but you can jump onto it from a ledge.
 */
export const CLIFF_OPEN = [
  { x0: -26, x1: -10, z0: -42, z1: -29.6 }, // the waterfall gorge and the grove
  { x0: 11, x1: 22.5, z0: -41, z1: -33.2 }, // the cliff path and the lookout
];

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

export const inKeepClear = (x, z) => KEEP_CLEAR.some((k) => (k.r !== undefined ? Math.hypot(x - k.x, z - k.z) < k.r : x > k.x0 && x < k.x1 && z > k.z0 && z < k.z1));
export const inCliffOpen = (x, z) => CLIFF_OPEN.some((k) => x > k.x0 && x < k.x1 && z > k.z0 && z < k.z1);

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
  // behind the waterfall: hop over the plunge pool, through the falling water and up the gorge wall
  grove: {
    chest: { x: -14.4, z: -37.6 }, area: { x: -14.6, z: -36.8 },
    path: [
      { kind: 'stone', x: -20.3, z: -29.9, r: 0.55, abs: 0.1 },
      { kind: 'stone', x: -21.4, z: -32.1, r: 0.6, abs: 0.45 },
      { kind: 'rock', x: -21.9, z: -34.3, r: 0.62, abs: 1.25 },
      { kind: 'rock', x: -20.6, z: -36.1, r: 0.6, abs: 2.1 },
      { kind: 'rock', x: -21.5, z: -38.0, r: 0.6, abs: 2.95 },
      { kind: 'rock', x: -20.2, z: -39.7, r: 0.62, abs: 3.8 },
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
      { kind: 'shelf', x: -9.6, z: 26.4, r: 0.55, top: 1.35 },
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
    racer: 'grumbleton', start: { x: 3.6, z: 34.2 }, sign: { x: 4.2, z: 35.6 }, level: 2,
    path: [
      { kind: 'barrel', x: 2.0, z: 33.4, r: 0.42, top: 0.9 },
      { kind: 'crate2', x: 0.2, z: 34.2, hw: 0.45, hd: 0.45, top: 1.4 },
      { kind: 'plank', x: -1.9, z: 33.5, hw: 1.0, hd: 0.2, top: 1.3 },
      { kind: 'barrel', x: -3.9, z: 34.2, r: 0.42, top: 0.95 },
      { kind: 'crate', x: -5.7, z: 33.1, hw: 0.45, hd: 0.45, top: 0.75 },
      { kind: 'crate2', x: -7.3, z: 34.3, hw: 0.45, hd: 0.45, top: 1.45, bell: true },
    ],
  },
  cliff: {
    racer: null, start: { x: 14.6, z: -30.6 }, sign: { x: 13.4, z: -30.0 }, level: 3,
    path: [
      { kind: 'rock', x: 14.0, z: -32.6, r: 0.6, abs: 0.85 },
      { kind: 'rock', x: 15.9, z: -33.5, r: 0.55, abs: 1.65 },
      { kind: 'rock', x: 17.9, z: -32.9, r: 0.55, abs: 2.45 },
      { kind: 'rock', x: 19.6, z: -33.8, r: 0.55, abs: 3.25 },
      { kind: 'rock', x: 18.0, z: -34.7, r: 0.6, abs: 4.0 },
      { kind: 'deck', x: 16.8, z: -37.4, hw: 1.6, hd: 1.2, abs: 4.85, bell: true },
    ],
  },
};
export const TRAIL_IDS = Object.keys(TRAILS);
