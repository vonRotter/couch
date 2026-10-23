// Lighthouse Caves: tile legend and grid helpers. Pure data (no three.js), so the room files and the
// reachability checker (solver.js) can also run in Node.
//
// Every room is a 17 x 11 grid of one-unit tiles. Tile (c, r) has its center at local x = c - 8,
// z = r - 5 (z grows toward the camera, so row 0 is the top / north wall).
// Dungeon doors sit in the middle of each wall: N (8, 0), S (8, 10), W (0, 5), E (16, 5).

export const W = 17;
export const H = 11;
export const HALF_W = (W - 1) / 2; // 8
export const HALF_H = (H - 1) / 2; // 5

export const DIRS = {
  n: { dx: 0, dz: -1, opp: 's' },
  s: { dx: 0, dz: 1, opp: 'n' },
  w: { dx: -1, dz: 0, opp: 'e' },
  e: { dx: 1, dz: 0, opp: 'w' },
};
export const DOOR_TILES = { n: [8, 0], s: [8, 10], w: [0, 5], e: [16, 5] };

// How far the grapple rope reaches, how far a thrown pot flies and how far an arrow flies (tiles).
export const ROPE_RANGE = 7;
export const THROW_RANGE = 4;
export const ARROW_RANGE = 13;
// A bomb breaks cracked rock, cracked walls and hurts things within this distance (tiles).
export const BLAST = 1.55;

// Terrain characters. Entities (blocks, pots, enemies...) are listed in ENTITY_CHARS, digits are
// per-room entities defined in the room's `at` table.
//   #  wall / cliff           .  floor            ,  path            s  sand          f  flowers
//   w  shallow water          ~  deep water (swim fins swim it; rope, arrows and throws fly over)
//   o  hole (you fall in)     =  bridge           v  ledge (hop down = south only)
//   T  tree                   b  bush (sword)     *  thorn bush (lantern)               g  tall grass
//   R  heavy boulder (the Strong Gloves lift it)     C  cracked rock (a bomb breaks it)
//   F  fence                  H  building (prop draws it)
//   @  statue                 |  post (rope hooks it)   t  torch (unlit)   L  torch (always lit)
//   x  orange peg (up while the crystal switch is orange)   y  blue peg (up while it is blue)
//   _  pressure plate         (space)  nothing (outside an interior room)
export const SOLID = new Set(['#', 'T', 'b', '*', 'R', 'C', 'F', 'H', '@', '|', 't', 'L', '~', ' ']);
// Things a thrown pot, a pebble or the rope cannot pass (water and holes are low, so they can).
export const TALL = new Set(['#', 'T', 'b', '*', 'R', 'C', 'F', 'H', '@', '|', 't', 'L', ' ']);
export const FLOORISH = new Set(['.', ',', 's', 'f', 'w', '=', '_', 'g']);

export const ENTITY_CHARS = {
  B: { t: 'block' },
  P: { t: 'pot' },
  r: { t: 'rock' },
  S: { t: 'switch' },
  e: { t: 'enemy', kind: 'blob' },
  q: { t: 'enemy', kind: 'crab' },
  n: { t: 'enemy', kind: 'brute' },
  u: { t: 'enemy', kind: 'spitter' },
  z: { t: 'enemy', kind: 'bat' },
  Z: { t: 'enemy', kind: 'shellback' },
  K: { t: 'enemy', kind: 'beetle' },
  W: { t: 'enemy', kind: 'wisp' },
  G: { t: 'enemy', kind: 'gull' },
};

export const tileX = (c) => c - HALF_W;
export const tileZ = (r) => r - HALF_H;
export const colOf = (x) => Math.round(x + HALF_W);
export const rowOf = (z) => Math.round(z + HALF_H);
export const inGrid = (c, r) => c >= 0 && c < W && r >= 0 && r < H;

/** Is a peg tile raised for this crystal switch state (0 = orange up, 1 = blue up)? */
export const pegUp = (ch, sw) => (ch === 'x' && sw === 0) || (ch === 'y' && sw === 1);

const GROUNDS = ['.', ',', 's', 'w'];
/** The ground most of a tile's neighbors stand on (what to paint under a sign, a statue, a pot...). */
export function groundOf(lines, c, r, fallback = '.') {
  const count = {};
  for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const ch = lines[r + dr]?.[c + dc];
    if (GROUNDS.includes(ch)) count[ch] = (count[ch] || 0) + 1;
  }
  let best = fallback, n = 0;
  for (const [ch, k] of Object.entries(count)) if (k > n || (k === n && ch === fallback)) { best = ch; n = k; }
  return best;
}

/** Parse a room's map into a mutable grid plus the entity list found in it. */
export function parseMap(def) {
  const grid = [];
  const ents = [];
  for (let r = 0; r < H; r++) {
    const row = [];
    const line = def.map[r] || '';
    for (let c = 0; c < W; c++) {
      let ch = line[c] ?? '#';
      if (ENTITY_CHARS[ch]) {
        ents.push({ ...ENTITY_CHARS[ch], c, r, ch });
        ch = groundOf(def.map, c, r, def.floor || '.');
      } else if (ch >= '0' && ch <= '9') {
        const spec = def.at?.[ch];
        if (spec) ents.push({ ...spec, c, r, ch });
        ch = spec?.under || groundOf(def.map, c, r, def.floor || '.');
      }
      row.push(ch);
    }
    grid.push(row);
  }
  return { grid, ents };
}
