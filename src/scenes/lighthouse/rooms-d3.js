// Dungeon 3: the Stormcliff Ruins, high on the cliffs north of the shrine (16 rooms).
// Treasure: the Wind Bow. Arrows hit stone eyes and switches from afar, and an arrow that flies
// through a lit torch becomes a fire arrow that lights torches across chasms.
//
//            x=0          x=1           x=2           x=3            x=4
//   y=0                                 BOSS
//   y=1      BOW -------- GALLERY ----- STORM HALL -- BIG KEY
//   y=2      GOLEM ------ CROSSING ---- CENTER (save)- BOULDERS ---- DARK (key)
//   y=3                   BEETLES (key)- LOWER HALL -- SWITCH (compass)
//   y=4                   SECRET ~~~~~ ENTRANCE ---- MAP
//
// First half (bombs + gloves + rope + lantern): crack walls and blocks, flip shell beetles with
// bombs, throw a bomb over a chasm, lift boulders, rope across a windy chasm, burn thorns in the
// dark, and beat the stone golem (bombs crack it). Second half (bow): stone eyes, fire arrows
// across a chasm, and a timed big-key room that needs every item. The boss is Stormbeak.
//
// Doors: 'open', 'key', 'boss', 'shut' (opens when the room that lists it is solved) and 'bomb'
// (a cracked wall: a bomb opens it for good). solve 'eyes': hit every stone eye with an arrow.

const INDOOR_WIND = (dir) => ({ dir, calm: 2.8, warn: 1.0, gust: 1.4, power: 3.1 });

export const D3_ROOMS = {
  d3_ent: {
    gx: 2, gy: 4,
    doors: { n: 'open', e: 'open', w: 'bomb' },
    map: [
      '#################',
      '#L.............L#',
      '#...............#',
      '#..@.........@..#',
      '#...............#',
      '#.......2.......#',
      '#...............#',
      '#..P..3.....P...#',
      '#...............#',
      '#L......1......L#',
      '#################',
    ],
    at: {
      1: { t: 'warp', to: 'oN1', at: [8, 3], face: 's', look: 'stairsUp' },
      2: { t: 'sign', text: 'lh.sign.d3ent' },
      3: { t: 'save' },
    },
  },

  // Behind the cracked wall: a chest on an island. Rope the chest to get pulled over.
  d3_secret: {
    gx: 1, gy: 4,
    map: [
      '#################',
      '#...............#',
      '#.ooooooooooooo.#',
      '#.ooooooooooooo.#',
      '#.ooo..1ooooooo.#',
      '#.ooooooooooooo..',
      '#.ooooooooooooo.#',
      '#.ooooooooooooo.#',
      '#...............#',
      '#.....|.........#',
      '#################',
    ],
    at: { 1: { t: 'chest', item: 'heartpiece', id: 'hp.d3' } },
  },

  // Throw a bomb over the chasm to crack the block, then rope the map chest.
  d3_map: {
    gx: 3, gy: 4,
    map: [
      '#################',
      '#........oo.....#',
      '#..K.....oo.....#',
      '#........oo.....#',
      '#..P.....oo.....#',
      '.......|.oo.C1..#',
      '#........oo.....#',
      '#..P.....oo.....#',
      '#..K.....oo.....#',
      '#........oo.....#',
      '#################',
    ],
    at: { 1: { t: 'chest', item: 'map', id: 'd3.map' } },
  },

  d3_hall: {
    gx: 2, gy: 3,
    doors: { s: 'open', w: 'open', e: 'open', n: 'key' },
    map: [
      '#################',
      '#P..............#',
      '#..##.......##..#',
      '#..##..K....##..#',
      '#...............#',
      '#.......u.......#',
      '#...............#',
      '#..##....K..##..#',
      '#..##.......##..#',
      '#..............P#',
      '#################',
    ],
  },

  d3_beetles: {
    gx: 1, gy: 3, trap: true, solve: 'clear',
    reward: { t: 'item', item: 'key', id: 'd3.k1', at: [8, 5] },
    map: [
      '#################',
      '#...............#',
      '#.P...........P.#',
      '#....K.....W....#',
      '#...##.....##...#',
      '#...............#',
      '#...##.....##...#',
      '#....W.....K....#',
      '#.P...........P.#',
      '#...............#',
      '#################',
    ],
  },

  // The crystal switch sits in a pit: throw something at it (or rope it) to lower the orange pegs.
  d3_switch: {
    gx: 3, gy: 3,
    doors: { n: 'open' },
    map: [
      '#################',
      '#R.....#x#...#1##',
      '#.............x.#',
      '#.....ooooo.....#',
      '#.....ooooo.....#',
      '......ooSoo.....#',
      '#.....ooooo.....#',
      '#.....ooooo.....#',
      '#.R...........R.#',
      '#...............#',
      '#################',
    ],
    at: { 1: { t: 'chest', item: 'compass', id: 'd3.compass' } },
  },

  d3_boulder: {
    gx: 3, gy: 2,
    doors: { w: 'open', e: 'key' },
    map: [
      '#################',
      '#.........R.....#',
      '#..K......R..1..#',
      '#.........R.....#',
      '#...##....R..K..#',
      '..........C......',
      '#...##....R.....#',
      '#.........R.....#',
      '#..P......R.....#',
      '#.........R.....#',
      '#################',
    ],
    at: { 1: { t: 'chest', item: 'key', id: 'd3.k2' } },
  },

  d3_dark: {
    gx: 4, gy: 2, dark: true, solve: 'torches', lightOnSolve: true,
    reward: { t: 'chest', item: 'key', id: 'd3.k3', at: [8, 2] },
    map: [
      '#################',
      '#t....#...#....t#',
      '#.....*...*.....#',
      '#..W..#...#..W..#',
      '#######...#######',
      '.........z......#',
      '#######...#######',
      '#..W..#...#.....#',
      '#..1..*...*.....#',
      '#t....#...#....t#',
      '#################',
    ],
    at: { 1: { t: 'item', item: 'gshell', id: 'gs.d3' } },
  },

  // Two stone eyes stare down at the north door: they only open for arrows.
  d3_center: {
    gx: 2, gy: 2, solve: 'eyes',
    doors: { w: 'open', e: 'open', n: 'shut' },
    map: [
      '######1###2######',
      '#...............#',
      '#.@...........@.#',
      '#...............#',
      '#.......3.......#',
      '#...............#',
      '#...##.....##...#',
      '#...............#',
      '#..P.........P..#',
      '#...............#',
      '#################',
    ],
    at: {
      1: { t: 'eye', under: '#', face: 's' },
      2: { t: 'eye', under: '#', face: 's' },
      3: { t: 'save' },
    },
  },

  // Rope from post to post over the chasm while the gusts from the broken roof push you south.
  d3_crossing: {
    gx: 1, gy: 2, wind: INDOOR_WIND('s'), rain: true,
    doors: { w: 'key' },
    map: [
      '#################',
      '#ooooooooooooooo#',
      '#ooooooooooooooo#',
      '#..ooooooooooo..#',
      '#|.oooo.|.oooo..#',
      '...oooo...oooo...',
      '#..oooo.|.oooo.|#',
      '#..ooooooooooo..#',
      '#ooooooooooooooo#',
      '#ooooooooooooooo#',
      '#################',
    ],
  },

  d3_golem: {
    gx: 0, gy: 2, trap: true, solve: 'boss',
    doors: { n: 'shut' },
    map: [
      '#################',
      '#...............#',
      '#.@...........@.#',
      '#...............#',
      '#...............#',
      '#.......1.......#',
      '#...............#',
      '#...............#',
      '#.@...........@.#',
      '#...............#',
      '#################',
    ],
    at: { 1: { t: 'boss', kind: 'golem' } },
  },

  d3_bow: {
    gx: 0, gy: 1, solve: 'eyes',
    doors: { e: 'shut' },
    map: [
      '#################',
      '#...............#',
      '#.............oo#',
      '#.............oo1',
      '#.......2.....oo#',
      '#...............#',
      '#...........3...#',
      '#...............#',
      '#...............#',
      '#...............#',
      '#################',
    ],
    at: {
      1: { t: 'eye', under: '#', face: 'w' },
      2: { t: 'chest', item: 'bow', id: 'd3.bow', big: true },
      3: { t: 'sign', text: 'lh.sign.bow' },
    },
  },

  // Shoot through the lit torches: fire arrows light the torches across the chasm.
  d3_gallery: {
    gx: 1, gy: 1, solve: 'torches',
    doors: { e: 'open' },
    reward: { t: 'item', item: 'key', id: 'd3.k4', at: [8, 8] },
    map: [
      '#################',
      '#...t.......t...#',
      '#ooooooooooooooo#',
      '#ooooooooooooooo#',
      '#ooooooooooooooo#',
      '.................',
      '#...L.......L...#',
      '#...............#',
      '#...............#',
      '#...............#',
      '#################',
    ],
    extra: [{ t: 'enemy', kind: 'wisp', c: 8, r: 3 }, { t: 'enemy', kind: 'wisp', c: 3, r: 8 }],
  },

  d3_storm: {
    gx: 2, gy: 1, wind: INDOOR_WIND('w'), rain: true,
    doors: { e: 'key', n: 'boss' },
    map: [
      '#################',
      '#.......u.......#',
      '#..ooo.....ooo..#',
      '#..ooo..@..ooo..#',
      '#...............#',
      '.................',
      '#...............#',
      '#..ooo..@..ooo..#',
      '#..ooo.....ooo..#',
      '#...............#',
      '########.########',
    ],
    extra: [{ t: 'enemy', kind: 'gull', c: 13, r: 5 }],
  },

  // Everything at once: crack the block, clear a boulder, then light three torches before the first
  // one goes out (lantern here, a fire arrow over the chasm, and one on the island by rope).
  d3_bigkey: {
    gx: 3, gy: 1, solve: 'torches', torchTime: 14,
    reward: { t: 'chest', item: 'bigkey', id: 'd3.big', at: [3, 8], big: true },
    map: [
      '#################',
      '#.t..LCoooo...t.#',
      '#......oooo.....#',
      '#......oooo.....#',
      '#......ooooooooo#',
      '.......ooooooooo#',
      '#......ooooooooo#',
      '#....|.oooo.R...#',
      '#......oooo.|.t.#',
      '#......oooo.R...#',
      '#################',
    ],
  },

  d3_boss: {
    gx: 2, gy: 0, trap: true, solve: 'boss', boss: true, rain: true, regrow: true,
    map: [
      '#################',
      '#...............#',
      '#..R.........R..#',
      '#...............#',
      '#...............#',
      '#.......1.......#',
      '#...............#',
      '#..R.........R..#',
      '#...............#',
      '#ooo.........ooo#',
      '#################',
    ],
    at: { 1: { t: 'boss', kind: 'beak' } },
    victory: { crystal: 3, warp: { to: 'h_light', at: [8, 5], face: 'n' } },
  },
};
