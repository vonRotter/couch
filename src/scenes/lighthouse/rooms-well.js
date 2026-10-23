// The Old Well under Shell Village: a small dark cave (4 rooms) with the Strong Gloves.
//
//            x=0              x=1
//   y=0      GLOVES  <-shut-  MOLE (mini-boss)
//   y=1      LADDER  -------  CHASM (rope, torches)
//
// You come down the ladder, rope over the chasm (posts on both sides), beat Digger the mole and
// find the Strong Gloves. A boulder in the glove room is the first thing to lift: behind it waits a
// heart piece, and another boulder blocks the short way back to the ladder.

export const WELL_ROOMS = {
  well_ent: {
    gx: 0, gy: 1, dark: true,
    doors: { n: 'open', e: 'open' },
    map: [
      '#################',
      '#...#...........#',
      '#.1.#...........#',
      '#...#....##.....#',
      '#.......###.....#',
      '#........#......#',
      '#..z...........##',
      '###.........z...#',
      '#...............#',
      '#.....#.....#...#',
      '#################',
    ],
    at: {
      1: { t: 'warp', to: 'o11', at: [8, 6], face: 's', look: 'stairsUp' },
    },
  },

  well_pit: {
    gx: 1, gy: 1, dark: true, solve: 'torches', lightOnSolve: true,
    doors: { n: 'open' },
    map: [
      '#################',
      '#t...........1.t#',
      '#.......|.......#',
      '###ooooo.oooooo##',
      '#..oooooooooooo.#',
      '...oooooooooooo.#',
      '#..oooooooooooo.#',
      '#...............#',
      '#t.............t#',
      '#.......|.......#',
      '#################',
    ],
    at: { 1: { t: 'item', item: 'gshell', id: 'gs.well' } },
    extra: [{ t: 'enemy', kind: 'bat', c: 5, r: 8 }, { t: 'enemy', kind: 'bat', c: 12, r: 1 }],
  },

  well_mole: {
    gx: 1, gy: 0, trap: true, solve: 'boss',
    doors: { s: 'open', w: 'shut' },
    mounds: [[4, 3], [12, 3], [8, 5], [4, 7], [12, 7]],
    map: [
      '#################',
      '#...............#',
      '#..L.........L..#',
      '#...............#',
      '#...............#',
      '#.......1.......#',
      '#...............#',
      '#...............#',
      '#..L.........L..#',
      '#...............#',
      '#################',
    ],
    at: { 1: { t: 'boss', kind: 'mole' } },
  },

  well_glove: {
    gx: 0, gy: 0,
    map: [
      '#################',
      '#1R.............#',
      '#R..............#',
      '#.......2.......#',
      '#...............#',
      '#...............#',
      '#...............#',
      '#...............#',
      '########R########',
      '########.########',
      '#################',
    ],
    at: {
      1: { t: 'item', item: 'heartpiece', id: 'hp.well' },
      2: { t: 'chest', item: 'glove', id: 'well.glove', big: true },
    },
  },
};
