// Bean Brigade: the campaign. Three islands of battles plus the finale at the Grumble Hive.
// Maps are 8 rows of 8 characters, row 0 is the far side (bugs come up there), row 7 the near side.
//   .  ground      B  house (1 floor)      D  house (2 floors)     O  star building (protect it)
//   P  battery (protect it: +1 grid power) M  mountain (2 hits)     ~  water   F  forest (burns)
//   S  sand (a hit makes smoke)            I  ice (2 hits: water)  C  supply crate   R  rock
// start: the three mechs' tiles. bugs: bugs already there. waves[i]: bugs that come up after turn
// i + 1 (random tiles in rows zone[0]..zone[1], types from pool); fixed[i]: exact spawns instead.
// objectives: bonus stars (see rules.js objectiveStatus).

export const POWER_START = 7;
export const POWER_MAX = 8;
export const ISLAND_POWER = 2; // grid power back after clearing an island

export const ISLANDS = [
  {
    id: 'clover', theme: 'meadow',
    battles: [
      {
        id: 'c1', tutorial: true, turns: 4,
        map: [
          '~~...F..',
          '~.....F.',
          '..F.....',
          '........',
          '.B..~~.B',
          '...B....',
          '.D...F.B',
          '...B....',
        ],
        start: [[2, 5], [4, 6], [6, 5]],
        bugs: [{ type: 'beetle', x: 3, y: 2 }, { type: 'beetle', x: 5, y: 3 }],
        fixed: [[{ type: 'beetle', x: 1, y: 1 }], [{ type: 'spitter', x: 6, y: 1 }], [{ type: 'beetle', x: 2, y: 0 }]],
        objectives: [{ kind: 'kills', n: 3 }],
      },
      {
        id: 'c2', turns: 4,
        map: [
          'F......F',
          '..M.....',
          '......F.',
          '.B.~~...',
          '...~~.B.',
          '.O....D.',
          '...B....',
          '.F...B.F',
        ],
        start: [[2, 4], [4, 6], [5, 5]],
        bugs: [{ type: 'beetle', x: 3, y: 1 }, { type: 'spitter', x: 6, y: 1 }],
        waves: [2, 2, 1], pool: ['beetle', 'beetle', 'spitter'],
        objectives: [{ kind: 'protect', what: 'windmill' }, { kind: 'kills', n: 4 }],
      },
      {
        id: 'c3', turns: 4,
        map: [
          '..F.....',
          '...~~..F',
          '.~~~~~..',
          '..~~~...',
          'B......B',
          '.D.~~.B.',
          '....F...',
          '.B..D..B',
        ],
        start: [[2, 4], [5, 4], [4, 6]],
        bugs: [{ type: 'beetle', x: 1, y: 0 }, { type: 'beetle', x: 6, y: 3 }, { type: 'spitter', x: 5, y: 0 }],
        waves: [2, 1, 2], pool: ['beetle', 'spitter'],
        objectives: [{ kind: 'drown', n: 2 }, { kind: 'power', n: 1 }],
      },
      {
        id: 'c4', turns: 5,
        map: [
          '....F...',
          '.M....M.',
          '........',
          'F.B..B.F',
          '........',
          '.B.~~.D.',
          '...D....',
          'F..B.B..',
        ],
        start: [[1, 4], [4, 4], [6, 4]],
        bugs: [{ type: 'beetle', x: 3, y: 1, alpha: true }, { type: 'spitter', x: 6, y: 2 }, { type: 'beetle', x: 1, y: 2 }],
        waves: [1, 2, 1, 1], pool: ['beetle', 'spitter'],
        objectives: [{ kind: 'boss' }, { kind: 'noKO' }],
      },
    ],
  },
  {
    id: 'sandy', theme: 'desert',
    battles: [
      {
        id: 's1', turns: 4,
        map: [
          'SS..M..S',
          'S..S....',
          '..S..SS.',
          '.M..~..B',
          'B..S~.S.',
          '..P...B.',
          '.S.D..S.',
          'B...M..B',
        ],
        start: [[2, 4], [5, 4], [4, 6]],
        bugs: [{ type: 'burrower', x: 2, y: 1 }, { type: 'beetle', x: 5, y: 1 }, { type: 'spitter', x: 7, y: 2 }],
        waves: [2, 2, 1], pool: ['beetle', 'burrower', 'spitter'],
        objectives: [{ kind: 'battery' }, { kind: 'kills', n: 4 }],
      },
      {
        id: 's2', turns: 4, zone: [1, 3],
        map: [
          '~~~~~~~~',
          '~SS..SS~',
          '..S...S.',
          '.B..M...',
          '...S..B.',
          '.D....S.',
          'S..B.D..',
          '..S...B.',
        ],
        start: [[2, 4], [4, 5], [6, 3]],
        bugs: [{ type: 'boomer', x: 3, y: 2 }, { type: 'boomer', x: 5, y: 1 }, { type: 'beetle', x: 1, y: 2 }],
        waves: [2, 2, 2], pool: ['boomer', 'boomer', 'beetle', 'spitter'],
        objectives: [{ kind: 'kills', n: 5 }, { kind: 'power', n: 1 }],
      },
      {
        id: 's3', turns: 5,
        map: [
          'M..S..MM',
          'M.S...SM',
          '..M.C...',
          'S...M.S.',
          '.B.S..B.',
          'M..~~..M',
          '.D.~~.D.',
          '..B..B..',
        ],
        start: [[2, 4], [5, 4], [0, 4]],
        bugs: [{ type: 'burrower', x: 6, y: 2 }, { type: 'boomer', x: 1, y: 1 }, { type: 'spitter', x: 5, y: 0 }],
        waves: [1, 2, 2, 1], pool: ['beetle', 'burrower', 'boomer', 'spitter'], alphaChance: 0.15,
        objectives: [{ kind: 'crate' }, { kind: 'noKO' }],
      },
    ],
  },
  {
    id: 'frosty', theme: 'snow',
    battles: [
      {
        id: 'f1', turns: 4,
        map: [
          '..F...F.',
          '.IIII...',
          '.IIIII.F',
          '..III...',
          'B......B',
          '.D..M.D.',
          '...B....',
          'F.B..B.F',
        ],
        start: [[2, 4], [5, 4], [3, 5]],
        bugs: [{ type: 'beetle', x: 2, y: 2 }, { type: 'beetle', x: 5, y: 1 }, { type: 'spitter', x: 6, y: 0 }],
        waves: [2, 2, 1], pool: ['beetle', 'spitter', 'firefly'],
        objectives: [{ kind: 'drown', n: 2 }, { kind: 'power', n: 1 }],
      },
      {
        id: 'f2', turns: 5,
        map: [
          'FF..F.FF',
          'F..F...F',
          '.F..FF..',
          '...F...F',
          'B.F..O..',
          '.D...F.B',
          'F..B....',
          '.B..F.D.',
        ],
        start: [[3, 4], [6, 4], [4, 6]],
        bugs: [{ type: 'firefly', x: 2, y: 1 }, { type: 'firefly', x: 6, y: 2 }, { type: 'beetle', x: 0, y: 2 }],
        waves: [2, 1, 2, 1], pool: ['firefly', 'beetle', 'firefly', 'spitter'],
        objectives: [{ kind: 'protect', what: 'cocoa' }, { kind: 'kills', n: 5 }],
      },
      {
        id: 'f3', turns: 5,
        map: [
          'M..F..M.',
          '..M..M..',
          'I......I',
          'I.B..B.I',
          '~......~',
          '~.D..D.~',
          '..M..M..',
          '.B.DD.B.',
        ],
        start: [[2, 4], [5, 4], [3, 6]],
        bugs: [{ type: 'spitter', x: 4, y: 1, alpha: true }, { type: 'beetle', x: 1, y: 1 }, { type: 'burrower', x: 6, y: 2 }],
        waves: [2, 2, 2, 1], pool: ['beetle', 'spitter', 'firefly', 'burrower'], alphaChance: 0.2,
        objectives: [{ kind: 'boss' }, { kind: 'noKO' }],
      },
    ],
  },
  {
    id: 'hive', theme: 'hive', finale: true,
    battles: [
      {
        id: 'h1', turns: 5, finale: true, eggs: true,
        map: [
          'M.....M.',
          '........',
          '.F....F.',
          '...~~...',
          '.B....B.',
          'D..OO..D',
          '.B....B.',
          'M..DD..M',
        ],
        start: [[2, 4], [5, 4], [3, 6]],
        bugs: [{ type: 'queen', x: 3, y: 1 }, { type: 'beetle', x: 0, y: 2 }, { type: 'boomer', x: 6, y: 1 }],
        waves: [1, 2, 1, 1], pool: ['beetle', 'spitter', 'boomer', 'firefly', 'burrower'],
        objectives: [{ kind: 'protect', what: 'tower' }, { kind: 'boss' }],
      },
    ],
  },
];

/** All battles in play order: [{ island, battle, def }]. */
export const ORDER = ISLANDS.flatMap((isl, i) => isl.battles.map((def, b) => ({ island: i, battle: b, def })));
export const BATTLE_COUNT = ORDER.length;

/** Upgrades per mech: costs in stars. pow2 needs pow1, hp2 needs hp1. */
export const UPGRADES = [
  { id: 'hp1', cost: 1, field: 'hp', need: null },
  { id: 'hp2', cost: 2, field: 'hp', need: 'hp1' },
  { id: 'move', cost: 2, field: 'move', need: null },
  { id: 'pow1', cost: 2, field: 'pow', need: null },
  { id: 'pow2', cost: 3, field: 'pow', need: 'pow1' },
];
