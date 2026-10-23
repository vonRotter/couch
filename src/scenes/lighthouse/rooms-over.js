// Lighthouse Island: the overworld screens, the little interiors and the Gloomy Cave.
// See tiles.js for the map legend. Digits are entities from each room's `at` table.
//
//   oN0 Stormcliff Path  oN1 Ruins Gate        oN2 Gull Peak             (north of the shrine, part 2)
//   o00 Old Shrine       o10 Lighthouse Point  o20 North Cove (Gloomy Cave)
//   o01 West Woods       o11 Shell Village     o21 East Beach (mooring posts)
//   o02 Driftwood Cove   o12 Keeper's Beach    o22 Tidepools              o32 Seal Rock (swim)
//
// Gates: bushes north of the start need the sword, thorns and the dark cave need the lantern, the
// heart piece islet needs the rope (or fins). Part 2: the village well (rope + lantern) hides the
// Strong Gloves, which lift Pell's boulder at the Tidepools (the bomb bag), and bombs break the
// cracked stone at the shrine: the Stormcliffs lie beyond. Olga's cat on Gull Peak earns the swim
// fins, and fins reach Seal Rock. Boulders, cracks, thorns and water hide heart pieces and golden
// shells all over the island.

// Wind on the cliffs: calm for a while, a whistle and streaks (the warning), then a gust that pushes
// you toward the drop. Standing right behind something tall (upwind) keeps you safe.
const CLIFF_WIND = (dir) => ({ dir, calm: 3.0, warn: 1.0, gust: 1.5, power: 3.3 });

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
      '###TTTT#3#TTTT###',
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
      // a cracked rock in the cliff: a bomb opens a little cave
      3: { t: 'warp', to: 'h_cove', at: [8, 6], face: 'n', look: 'cave', under: 'C' },
    },
  },

  o11: {
    gx: 1, gy: 1, name: 'lh.place.village',
    map: [
      'TTTTTTT,,,TTTTTTT',
      'T.HHH..,,,..HHH.T',
      'T.HHH..,,,..HHH.T',
      'T..1...,,,...2..T',
      '..9f...,,,..f....',
      ',,,,,,,,8,,,,,,,,',
      '..g.3..,,,.......',
      'T.FFFF.,,,..4...T',
      'TR.....,,,.56.7.T',
      'T0Rg...,,,.....gT',
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
      // the old well: [B] climbs down (the prop draws it)
      8: { t: 'well', to: 'well_ent', at: [2, 3], face: 's', under: ',' },
      9: { t: 'npc', id: 'mitten', when: 'catFound' },
      0: { t: 'item', item: 'gshell', id: 'gs.village' },
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
      '~~~3Rsssssssss~~~',
      '~~sR...HHH....s~~',
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
      3: { t: 'item', item: 'heartpiece', id: 'hp.point' },
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
      'TTT.....,....ss~3',
      'TTTT...,,,..ss~~s',
      'TTTTTTT,,,TTTT~~~',
    ],
    at: {
      1: { t: 'warp', to: 'cave1', at: [2, 5], face: 'e', look: 'cave', need: 'lantern' },
      2: { t: 'sign', text: 'lh.sign.cave' },
      3: { t: 'chest', item: 'gshell', id: 'gs.north' },
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
      3: { t: 'chest', item: 'bombs', id: 'c.bombs', big: true },
    },
  },

  o32: {
    gx: 3, gy: 2, name: 'lh.place.seal',
    map: [
      '~~~~~~~~~~~~~~~~~',
      '~~~~~~~~~##1##~~~',
      '~~~~~~~~#s...s#~~',
      '~~ss~~~~ss.....s~',
      '~ss2s~~~~sss.ss~~',
      '~~ss~~~~~~sss~~~~',
      '~~~~~~~~~~~~~~~~~',
      '~~~~~~#~~~~~~ss~~',
      '~~~~~~~~~~~~s3s~~',
      '~~~~~#~~~~~~~ss~~',
      '~~~~~~~~~~~~~~~~~',
    ],
    at: {
      1: { t: 'warp', to: 'h_seal', at: [8, 6], face: 'n', look: 'cave' },
      2: { t: 'npc', id: 'sela' },
      3: { t: 'item', item: 'gshell', id: 'gs.seal' },
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
      'T.TT.....n...TTTT',
      'T....g......R.2TT',
      'TTT....TT....TTTT',
      'TTTTTTTTTTTTTTTTT',
    ],
    at: {
      1: { t: 'warp', to: 'h_secret', at: [8, 6], face: 'n', look: 'stairsDown', under: 'b' },
      2: { t: 'item', item: 'gshell', id: 'gs.woods' },
    },
  },

  o00: {
    gx: 0, gy: 0, name: 'lh.place.shrine',
    map: [
      '########.########',
      '########.########',
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

  // ---------- the Stormcliffs (north of the shrine, behind the cracked stone) ----------

  oN0: {
    gx: 0, gy: -1, name: 'lh.place.cliff', theme: 'cliff', rain: true, wind: CLIFF_WIND('w'),
    map: [
      '#################',
      '#ooooooo####.1###',
      '#oooooooo...R####',
      '#ooooooo........#',
      '#oooooo..@...G...',
      '#ooooo.......,,,,',
      '#o2....,,,,,,,..#',
      '#ooooo..,..R....#',
      '#oooooo.,.....G.#',
      '#ooooooo,...@..##',
      '#######.,.#######',
    ],
    at: {
      1: { t: 'item', item: 'gshell', id: 'gs.cliff' },
      // a heart piece at the tip of a narrow ledge: the gusts blow toward the drop
      2: { t: 'item', item: 'heartpiece', id: 'hp.cliff' },
    },
  },

  oN1: {
    gx: 1, gy: -1, name: 'lh.place.gate', theme: 'cliff', rain: true,
    map: [
      '#################',
      '###..HHHHHHH..###',
      '##..|.HH1HH.|..##',
      '##.............##',
      '..#ooooooooooo#..',
      '..#ooooooooooo#..',
      '.............G...',
      '....|...2...|....',
      ',,,,,,,,,,,,,,,,,',
      'TT.....n.......TT',
      'TTTTTTTTTTTTTTTTT',
    ],
    at: {
      1: { t: 'warp', to: 'd3_ent', at: [8, 8], face: 'n', look: 'door' },
      2: { t: 'sign', text: 'lh.sign.ruins' },
    },
    props: [{ kind: 'ruins', c: 8, r: 1.4 }],
  },

  oN2: {
    gx: 2, gy: -1, name: 'lh.place.peak', theme: 'cliff', rain: true, wind: CLIFF_WIND('e'),
    map: [
      '#################',
      '####1###....oo.3#',
      '##.......|.ooo.|#',
      '#............ooo#',
      '...........@..ooo',
      '...G........oooo#',
      '.........R...ooo#',
      '....,,,,,.....oo#',
      '.T.,,..........o#',
      'T4*,.....2.....##',
      'TTTTTTTTTTTTTTTTT',
    ],
    at: {
      1: { t: 'warp', to: 'h_peak', at: [8, 6], face: 'n', look: 'cave', under: 'C' },
      2: { t: 'sign', text: 'lh.sign.peak' },
      3: { t: 'npc', id: 'mitten', unless: 'catFound' },
      4: { t: 'item', item: 'gshell', id: 'gs.peak' },
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
      '   #..7.1.5.6#   ',
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
      // the stairs up to the lamp room appear once all three crystals shine
      6: { t: 'warp', to: 'h_top', at: [8, 8], face: 'n', look: 'stairsUp', placed: 3 },
      7: { t: 'npc', id: 'murky', when: 'beaten' },
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
  h_cove: {
    gx: 30, gy: 0, name: 'lh.place.coveCave', theme: 'cave',
    map: [
      '                 ',
      '                 ',
      '   ###########   ',
      '   #1.R...*.2#   ',
      '   ###.....###   ',
      '   #...P.P...#   ',
      '   #.........#   ',
      '   #####3#####   ',
      '                 ',
      '                 ',
      '                 ',
    ],
    at: {
      1: { t: 'item', item: 'heartpiece', id: 'hp.cove' },
      2: { t: 'item', item: 'gshell', id: 'gs.cove' },
      3: { t: 'warp', to: 'o02', at: [8, 2], face: 's', look: 'exit' },
    },
  },
  h_peak: {
    gx: 40, gy: 0, name: 'lh.place.peakCave', theme: 'cave',
    map: [
      '                 ',
      '                 ',
      '   ###########   ',
      '   #.o.....C.#   ',
      '   #1o..z..C2#   ',
      '   #.o.....C.#   ',
      '   #.o.....C.#   ',
      '   #####3#####   ',
      '                 ',
      '                 ',
      '                 ',
    ],
    at: {
      1: { t: 'item', item: 'heartpiece', id: 'hp.peak' },
      2: { t: 'chest', item: 'shells50', id: 'c.peak' },
      3: { t: 'warp', to: 'oN2', at: [4, 2], face: 's', look: 'exit' },
    },
  },
  h_seal: {
    gx: 50, gy: 0, name: 'lh.place.sealCave', theme: 'cave',
    map: [
      '                 ',
      '                 ',
      '   ###########   ',
      '   #ss~~~~~ss#   ',
      '   #s1~~~~~2s#   ',
      '   #ss~~~~~ss#   ',
      '   #~~~~s~~~~#   ',
      '   #####3#####   ',
      '                 ',
      '                 ',
      '                 ',
    ],
    at: {
      1: { t: 'item', item: 'heartpiece', id: 'hp.seal' },
      2: { t: 'chest', item: 'shells50', id: 'c.seal' },
      3: { t: 'warp', to: 'o32', at: [11, 2], face: 's', look: 'exit' },
    },
  },
  // The lamp room at the top of the lighthouse: the final encounter (night, four braziers).
  h_top: {
    gx: 60, gy: 0, name: 'lh.place.top', theme: 'tower', dark: true, solve: 'boss', boss: true, night: true,
    map: [
      '                 ',
      ' ############### ',
      ' #.............# ',
      ' #..t.......t..# ',
      ' #.............# ',
      ' #......1......# ',
      ' #.............# ',
      ' #..t.......t..# ',
      ' #.............# ',
      ' #######2####### ',
      '                 ',
    ],
    at: {
      1: { t: 'boss', kind: 'murk' },
      2: { t: 'warp', to: 'h_light', at: [12, 4], face: 's', look: 'stairsDown', lockBoss: true },
    },
    victory: { finale: true },
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
