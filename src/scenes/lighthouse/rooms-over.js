// Lighthouse Island: the overworld (3 x 3 screens), the little interiors and the Gloomy Cave.
// See tiles.js for the map legend. Digits are entities from each room's `at` table.
//
//   o00 Old Shrine      o10 Lighthouse Point   o20 North Cove (Gloomy Cave)
//   o01 West Woods      o11 Shell Village      o21 East Beach (mooring posts)
//   o02 Driftwood Cove  o12 Keeper's Beach     o22 Tidepools
//
// Gates: bushes north of the start need the sword, thorns in the West Woods and the dark cave need
// the lantern, the heart piece island needs the rope. Boulders, the cracked shrine stone and the
// deep sea are teasers for later chapters.

export const OVER_ROOMS = {
  o12: {
    gx: 1, gy: 2, name: 'lh.place.beach',
    map: [
      'TTTTTTTbbbTTTTTTT',
      'TT..f..,,,....fTT',
      'T..HHH.,,,......T',
      'T..HHH.,,,..g...T',
      '...,1,.,,,.....g.',
      ',,,,,,,,,,,,,,,,,',
      '..g.....r....f...',
      'sssssssssssssssss',
      'ssss2ssssssssssss',
      '~~~~~~~~~~~~~~~~~',
      '~~~~~~~~~~~~~~~~~',
    ],
    at: {
      1: { t: 'warp', to: 'h_keeper', at: [8, 6], face: 'n', look: 'door' },
      2: { t: 'sign', text: 'lh.sign.beach' },
    },
    props: [{ kind: 'house', c: 4, r: 2.5, roof: 0x4c8bd6 }],
  },

  o02: {
    gx: 0, gy: 2, name: 'lh.place.cove',
    map: [
      '#################',
      '###TTTT###TTTT###',
      '##T....g......TT#',
      '#T....@.1.@....T#',
      '#T...............',
      '#..q....,,,,,,,,,',
      '#T.....g,........',
      '#ssssssssssssssss',
      '#ss2sssss.sssssss',
      '~~~~~~~~~~~~~~~~~',
      '~~~~~~~~~~~~~~~~~',
    ],
    at: {
      1: { t: 'chest', item: 'sword', id: 'c.sword', big: true },
      2: { t: 'sign', text: 'lh.sign.cove' },
    },
  },

  o11: {
    gx: 1, gy: 1, name: 'lh.place.village',
    map: [
      'TTTTTTT,,,TTTTTTT',
      'T.HHH..,,,..HHH.T',
      'T.HHH..,,,..HHH.T',
      'T..1...,,,...2..T',
      '...f...,,,..f....',
      ',,,,,,,,@,,,,,,,,',
      '..g.3..,,,.......',
      'T.FFFF.,,,..4...T',
      'T......,,,.56.7.T',
      'T..g...,,,.....gT',
      'TTTTTTT,,,TTTTTTT',
    ],
    at: {
      1: { t: 'npc', id: 'olga' },
      2: { t: 'npc', id: 'tobi' },
      3: { t: 'save' },
      4: { t: 'npc', id: 'mira' },
      5: { t: 'shop', item: 'heartpiece', price: 60, id: 'hp.shop' },
      6: { t: 'shop', item: 'potion', price: 30 },
      7: { t: 'sign', text: 'lh.sign.shop' },
    },
    props: [
      { kind: 'house', c: 3, r: 1.5, roof: 0xe0564f },
      { kind: 'house', c: 13, r: 1.5, roof: 0x8e5bd6 },
      { kind: 'well', c: 8, r: 5 },
      { kind: 'stall', c: 11.5, r: 6.5 },
    ],
  },

  o10: {
    gx: 1, gy: 0, name: 'lh.place.point',
    map: [
      '~~~~~~~~~~~~~~~~~',
      '~~~sssssssssss~~~',
      '~~ss...HHH....s~~',
      '~ss..g.HHH..r..s~',
      'Tss....HHH.......',
      'TT..2...1....f...',
      'TT.....,,,.......',
      'TTT....,,,....TTT',
      'TTTT...,,,...TTTT',
      'TTTTT..,,,..TTTTT',
      'TTTTTTT,,,TTTTTTT',
    ],
    at: {
      1: { t: 'warp', to: 'h_light', at: [8, 6], face: 'n', look: 'door' },
      2: { t: 'sign', text: 'lh.sign.point' },
    },
    props: [{ kind: 'lighthouse', c: 8, r: 3 }],
  },

  o20: {
    gx: 2, gy: 0, name: 'lh.place.north',
    map: [
      '#################',
      '#################',
      '#######.1.#######',
      '####....,....####',
      '........,..2..##~',
      ',,,,,,,,,......s~',
      '....n...,...f.ss~',
      'TT......,....sss~',
      'TTT.....,....ss~~',
      'TTTT...,,,..ss~~~',
      'TTTTTTT,,,TTTT~~~',
    ],
    at: {
      1: { t: 'warp', to: 'cave1', at: [2, 5], face: 'e', look: 'cave', need: 'lantern' },
      2: { t: 'sign', text: 'lh.sign.cave' },
    },
  },

  o21: {
    gx: 2, gy: 1, name: 'lh.place.east',
    map: [
      'TTTTTTT,,,TTTT~~~',
      'TT.....,,,...ss~~',
      'T..g...,,,...ss~~',
      'T......,,,..~~~~~',
      '...q...,,|s~~sss~',
      ',,,,,,,,,,s~~ss|~',
      '..f....,,,2~~s1s~',
      'T......,,,..~~~~~',
      'TT.....,,,.~~~~~~',
      'TTT....,,,..~~~~~',
      'TTTTTTT,,,TTT~~~~',
    ],
    at: {
      1: { t: 'item', item: 'heartpiece', id: 'hp.islet' },
      2: { t: 'sign', text: 'lh.sign.posts' },
    },
  },

  o22: {
    gx: 2, gy: 2, name: 'lh.place.pools',
    map: [
      'TTTTTTT,,,TTT~~~~',
      'TT.....,,,...~~~~',
      'T..www.,,,..ww~~~',
      'T.wwww.,,,.www~~~',
      '..www..,,,......~',
      ',,,,,,,,,,,,,,..~',
      '......q.....1...~',
      'sssss....#R#s~~~~',
      'ssss2....#3#s~~~~',
      '~~~~~~~~~~~~~~~~~',
      '~~~~~~~~~~~~~~~~~',
    ],
    at: {
      1: { t: 'npc', id: 'pell' },
      2: { t: 'sign', text: 'lh.sign.pools' },
      3: { t: 'chest', item: 'shells50', id: 'c.future1', future: true },
    },
  },

  o01: {
    gx: 0, gy: 1, name: 'lh.place.woods',
    map: [
      'TTTTTTT***TTTTTTT',
      'TT.....,,,....TTT',
      'T.T.ff.,,,..T..TT',
      'T.f1f..,,,.....TT',
      'TT.ff..,,,..e....',
      'T......,,,,,,,,,,',
      'T.TT..e.......g..',
      'T.TT.....n...TT.T',
      'T....g.......TTTT',
      'TTT....TT.....TTT',
      'TTTTTTTTTTTTTTTTT',
    ],
    at: {
      1: { t: 'warp', to: 'h_secret', at: [8, 6], face: 'n', look: 'stairsDown', under: 'b' },
    },
  },

  o00: {
    gx: 0, gy: 0, name: 'lh.place.shrine',
    map: [
      '#################',
      '######.....######',
      '####...@C@...####',
      '###...........###',
      '##..u.......u..##',
      '#.......2.......#',
      '#..T.........T..#',
      '#..............1#',
      '#..T..ff.ff..T..#',
      '##.....,,,.....##',
      'TTTTTTT,,,TTTTTTT',
    ],
    at: {
      1: { t: 'item', item: 'heartpiece', id: 'hp.shrine' },
      2: { t: 'sign', text: 'lh.sign.shrine' },
    },
  },
};

// Interiors: single rooms (far apart on the grid, so they never scroll into each other).
export const INSIDE_ROOMS = {
  h_keeper: {
    gx: 0, gy: 0, name: 'lh.place.house', theme: 'house',
    map: [
      '                 ',
      '                 ',
      '    #########    ',
      '    #2.....3#    ',
      '    #.......#    ',
      '    #..1....#    ',
      '    #4......#    ',
      '    ####5####    ',
      '                 ',
      '                 ',
      '                 ',
    ],
    at: {
      1: { t: 'npc', id: 'keeper', unless: 'intro' },
      2: { t: 'decor', kind: 'bed' },
      3: { t: 'save' },
      4: { t: 'decor', kind: 'table' },
      5: { t: 'warp', to: 'o12', at: [4, 5], face: 's', look: 'exit' },
    },
  },
  h_light: {
    gx: 10, gy: 0, name: 'lh.place.lighthouse', theme: 'tower',
    map: [
      '                 ',
      '   ###########   ',
      '   #.........#   ',
      '   #....1.5..#   ',
      '   #.........#   ',
      '   #.2.....3.#   ',
      '   #.........#   ',
      '   #####4#####   ',
      '                 ',
      '                 ',
      '                 ',
    ],
    at: {
      1: { t: 'lamp' },
      2: { t: 'warp', to: 'd1_ent', at: [8, 7], face: 'n', look: 'stairsDown' },
      3: { t: 'sign', text: 'lh.sign.lamp' },
      4: { t: 'warp', to: 'o10', at: [8, 6], face: 's', look: 'exit' },
      5: { t: 'npc', id: 'keeper', when: 'intro' },
    },
  },
  h_secret: {
    gx: 20, gy: 0, name: 'lh.place.secret', theme: 'cave',
    map: [
      '                 ',
      '                 ',
      '   ###########   ',
      '   #.........#   ',
      '   #.1.....2.#   ',
      '   #.........#   ',
      '   #...P.P...#   ',
      '   #####3#####   ',
      '                 ',
      '                 ',
      '                 ',
    ],
    at: {
      1: { t: 'item', item: 'heartpiece', id: 'hp.secret' },
      2: { t: 'chest', item: 'shells20', id: 'c.secret' },
      3: { t: 'warp', to: 'o01', at: [3, 4], face: 's', look: 'exit' },
    },
  },
};

// The Gloomy Cave between the north cove and the Tidepool Grotto: dark, thorny, two screens.
export const CAVE_ROOMS = {
  cave1: {
    gx: 0, gy: 0, name: 'lh.place.gloomy', dark: true,
    map: [
      '#################',
      '####.......######',
      '###...z...*....##',
      '##....##..*..z..#',
      '#1...###..*......',
      '#....###..*......',
      '##........*......',
      '###...z...*...###',
      '####......#######',
      '#################',
      '#################',
    ],
    at: {
      1: { t: 'warp', to: 'o20', at: [8, 3], face: 's', look: 'caveOut' },
    },
  },
  cave2: {
    gx: 1, gy: 0, name: 'lh.place.gloomy', dark: true, solve: 'torches',
    map: [
      '#################',
      '#################',
      '#######.1.#######',
      '#####t##2##t#####',
      '....z...........#',
      '................#',
      '......z.........#',
      '##.............##',
      '####.........####',
      '#################',
      '#################',
    ],
    at: {
      1: { t: 'warp', to: 'd2_ent', at: [8, 7], face: 'n', look: 'stairsDown' },
      2: { t: 'gate' },
    },
  },
};
