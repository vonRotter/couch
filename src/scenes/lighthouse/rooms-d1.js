// Dungeon 1: the Lantern Cellar under the lighthouse (13 rooms). Treasure: the Lantern.
//
//            x=1          x=2           x=3
//   y=0                   BOSS
//   y=1      LANTERN ---- DARK          TORCH (big key)
//   y=2      MINIBOSS --- CENTER (save) BRIDGE
//   y=3      PIT (key) -- KEYHALL ----- SWITCH (compass)
//   y=4      BLOBS (key)- ENTRANCE ---- MAP
//
// First half (sword): fight, push a block onto a plate, small keys, holes, a crystal switch hit with
// a thrown pot, a block maze that opens the mini-boss. Second half (lantern): burn thorns, light a
// dark room, the timed four-torch room for the big key, and the boss who loves flames.
//
// Doors are written once, in one of the two rooms they join: 'open', 'key' (small key), 'boss'
// (big key) or 'shut' (opens when the room that lists it is solved). Missing sides are walls.
// solve: 'clear' | 'plates' | 'torches' | 'boss'; trap: doors close until the room is solved.

export const D1_ROOMS = {
  d1_ent: {
    gx: 2, gy: 4,
    doors: { n: 'open', w: 'open', e: 'open' },
    map: [
      '#################',
      '#L.............L#',
      '#...............#',
      '#..P.........P..#',
      '#...............#',
      '#.......2.......#',
      '#...............#',
      '#..P.........P..#',
      '#.......1.......#',
      '#L.............L#',
      '#################',
    ],
    at: {
      1: { t: 'warp', to: 'h_light', at: [5, 6], face: 's', look: 'stairsUp' },
      2: { t: 'sign', text: 'lh.sign.d1ent' },
    },
  },

  d1_blobs: {
    gx: 1, gy: 4, trap: true, solve: 'clear',
    reward: { t: 'item', item: 'key', id: 'd1.k1', at: [8, 5] },
    map: [
      '#################',
      '#...............#',
      '#..e.........e..#',
      '#....##...##....#',
      '#....##...##....#',
      '#...............#',
      '#....##...##....#',
      '#....##...##....#',
      '#..e.........e..#',
      '#...............#',
      '#################',
    ],
  },

  d1_map: {
    gx: 3, gy: 4, solve: 'plates',
    reward: { t: 'chest', item: 'map', id: 'd1.map', at: [13, 3] },
    map: [
      '#################',
      '#...............#',
      '#.#####.........#',
      '#.#._.#.........#',
      '#.#...#.........#',
      '#.#...#.........#',
      '#.##.##.........#',
      '#...............#',
      '#.......B.......#',
      '#...............#',
      '#################',
    ],
  },

  d1_keyhall: {
    gx: 2, gy: 3,
    doors: { s: 'open', n: 'key', w: 'open', e: 'open' },
    map: [
      '#################',
      '#...............#',
      '#.P..#.....#..P.#',
      '#....#..q..#....#',
      '#...............#',
      '#.......2.......#',
      '#...............#',
      '#....#..q..#....#',
      '#.P..#.....#..P.#',
      '#...............#',
      '#################',
    ],
    at: { 2: { t: 'sign', text: 'lh.sign.keys' } },
  },

  d1_pit: {
    gx: 1, gy: 3,
    doors: { e: 'open' },
    map: [
      '#################',
      '#ooooooooooooooo#',
      '#o1.oooooooooooo#',
      '#oo.ooo.....oooo#',
      '#oo.ooo.ooo.oooo#',
      '#oo.ooo.ooo.....#',
      '#oo.ooo.oooooooo#',
      '#oo.....oooooooo#',
      '#oooooooooooooou#',
      '#ooooooooooooooo#',
      '#################',
    ],
    at: { 1: { t: 'chest', item: 'key', id: 'd1.k2' } },
    extra: [{ t: 'enemy', kind: 'blob', c: 9, r: 3 }, { t: 'enemy', kind: 'blob', c: 5, r: 7 }],
  },

  d1_switch: {
    gx: 3, gy: 3,
    doors: { w: 'open' },
    map: [
      '#################',
      '#...........###.#',
      '#.P.........#1#.#',
      '#...........#x#.#',
      '#......ooo......#',
      '#......oSo......#',
      '#......ooo......#',
      '#...............#',
      '#.P.P.......P...#',
      '#...............#',
      '#################',
    ],
    at: { 1: { t: 'chest', item: 'compass', id: 'd1.compass' } },
  },

  d1_center: {
    gx: 2, gy: 2, solve: 'plates',
    doors: { w: 'shut', e: 'key' },
    map: [
      '#################',
      '#...............#',
      '#.###...........#',
      '#.#_#...1.......#',
      '#.#.#...........#',
      '#...............#',
      '#.....B.........#',
      '#...............#',
      '#.....##...##...#',
      '#...............#',
      '#################',
    ],
    at: { 1: { t: 'save' } },
  },

  d1_mini: {
    gx: 1, gy: 2, trap: true, solve: 'boss',
    doors: { n: 'shut' },
    map: [
      '#################',
      '#...............#',
      '#.#...........#.#',
      '#...............#',
      '#...............#',
      '#.......1.......#',
      '#...............#',
      '#...............#',
      '#.#...........#.#',
      '#...............#',
      '#################',
    ],
    at: { 1: { t: 'boss', kind: 'bigblob' } },
  },

  d1_lantern: {
    gx: 1, gy: 1, solve: 'torches',
    doors: { e: 'open' },
    reward: { t: 'chest', item: 'shells20', id: 'd1.lsh', at: [8, 6] },
    map: [
      '#################',
      '#...............#',
      '#...............#',
      '#.....t.1.t.....#',
      '#...........2####',
      '#............*..#',
      '#............####',
      '#...............#',
      '#...............#',
      '#...............#',
      '#################',
    ],
    at: {
      1: { t: 'chest', item: 'lantern', id: 'd1.lantern', big: true },
      2: { t: 'sign', text: 'lh.sign.lantern' },
    },
  },

  d1_dark: {
    gx: 2, gy: 1, dark: true, solve: 'torches', lightOnSolve: true,
    doors: { n: 'boss' },
    map: [
      '#################',
      '#t.....o.o.....t#',
      '#..o...o.o...o..#',
      '#..o...o.o...o..#',
      '#..o.ooo.ooo.o..#',
      '#..o.........o..#',
      '#..ooooo.ooooo..#',
      '#...............#',
      '#...............#',
      '#t.............t#',
      '#################',
    ],
    extra: [{ t: 'enemy', kind: 'bat', c: 5, r: 2 }, { t: 'enemy', kind: 'bat', c: 12, r: 8 }, { t: 'enemy', kind: 'bat', c: 3, r: 8 }],
  },

  d1_bridge: {
    gx: 3, gy: 2,
    doors: { n: 'open' },
    map: [
      '#################',
      '#ooooooo.ooooooo#',
      '#oooouoo.....ooo#',
      '#ooooooooooo.ooo#',
      '#..ooooooooo.ooo#',
      '#............ooo#',
      '#..ooooooooooooo#',
      '#ooooooooooooooo#',
      '#oooooooouoooooo#',
      '#ooooooooooooooo#',
      '#################',
    ],
  },

  d1_torch: {
    gx: 3, gy: 1, solve: 'torches', torchTime: 20,
    reward: { t: 'chest', item: 'bigkey', id: 'd1.big', at: [8, 1], big: true },
    map: [
      '#################',
      '#t.....#.#.....t#',
      '#......#.#......#',
      '#..##.......##..#',
      '#..##.......##..#',
      '#...............#',
      '#..##...1...##..#',
      '#..##.......##..#',
      '#...............#',
      '#t.............t#',
      '#################',
    ],
    at: { 1: { t: 'sign', text: 'lh.sign.torches' } },
  },

  d1_boss: {
    gx: 2, gy: 0, trap: true, solve: 'boss', dark: true, boss: true,
    map: [
      '#################',
      '#...............#',
      '#..t.........t..#',
      '#...............#',
      '#...............#',
      '#.......1.......#',
      '#...............#',
      '#...............#',
      '#..t.........t..#',
      '#...............#',
      '#################',
    ],
    at: { 1: { t: 'boss', kind: 'moth' } },
    victory: { crystal: 1, warp: { to: 'h_light', at: [8, 5], face: 'n' } },
  },
};
