import { ROWS } from './tilemap.js';

// Hand-drawn campaign levels for Knights & Builders. A level is a row of ASCII chunks placed side
// by side. A chunk lists rows from the top down; its last row is row `bottom` (6 = the usual ground,
// so beans stand at y = 7). Below that every column keeps going: water stays water down to row 2,
// anything else turns into dirt. Row 0 is always bedrock and the map edges are walls.
//
// Tiles:   . air   # dirt   S stone   C castle stone (grumble builders repair it)   B bedrock
//          w wood  H ladder   D grumble door   G castle gate   ~ water   : air in front of a castle wall
// Markers (the cell itself is air; beans/props stand in it):
//          T trooper camp   P player start + class tent   t checkpoint tent   F the Golden Bean flag
//          L gate lever   c cage (2 x 2)   Q the princess's golden cage (2 x 2)   K pillow catapult
//          k grumble knight   a grumble archer   b grumble builder
//          n knight (3+ players)   m knight (5+ players)   v builder (3+ players)   e archer (4+ players)
//          h / l   tutorial ghosts: "build a block here" / "build a ladder here"

const ch = (rows, bottom = 6) => ({ rows, bottom });
const flat = (w, marks = '') => ch([marks.padEnd(w, '.'), '#'.repeat(w)]);
/** A water gap `w` wide between two dirt edges (beans stand at y = 7 on both sides). */
const pit = (w, hint = false) => ch(['.'.repeat(w + 2), `#${(hint ? 'h' : '.').repeat(w)}#`, `#${'~'.repeat(w)}#`], 5);
const CAMP = ch(['.T..P.....', '##########']);

// Little hill with 1-tile steps: troopers hop up and down on their own.
const BUMP = ch([
  '...##...',
  '..####..',
  '########',
]);
const HILL = ch([
  '....######....',
  '...########...',
  '..##########..',
  '##############',
]);

// A tower over the path: walk through below, climb the inside ladder, and the catapult waits on top.
const TOWER = (top = '.') => ch([
  `C${top}K.C`,
  'CCHCC',
  'CCHCC',
  'CCHCC',
  'CCHCC',
  'CCHCC',
  '::H::',
  '::H::',
  'CCCCC',
]);

// Gatehouse castle (level 3): a gate with the lever just inside, archers up top, a grumble door out back.
const GATEHOUSE = ch([
  'CaC................',
  'CCC.............CaC',
  'CCC.............CCC',
  'CCC:::::::::::::CCC',
  'CCC:::::::::::::CCC',
  'G:::::::::::::::CCC',
  'G:L:::::::::::::::D',
  'G::::::k:::c::n:::D',
  'CCCCCCCCCCCCCCCCCCC',
]);

// Builder castle (level 5): no way in but over or through, and grumble builders fix every hole.
// The way out is a gate; its lever hangs high on the inside, next to a ladder.
const WORKSHOP = ch([
  'C.............Ca.C',
  'CC............CCCC',
  'CC..........HLCCCC',
  'CC::::::::::H:CCCC',
  'CC::::::::::H::::G',
  'CC::::::::::H::::G',
  'CC:b:vc:k:b:H::::G',
  'CCCCCCCCCCCCCCCCCC',
]);

// Grand castle (level 6): gatehouse, a courtyard of builders, a catapult tower with a grumble door.
const FORTRESS = ch([
  'CaC........................',
  'CCC............C.K.C.......',
  'CCC............CCHCC.......',
  'CCC::::::::::::CCHCC::::::C',
  'CCC::::::::::::CCHCC::::::C',
  'G::::::::::::::CCHCC::::::C',
  'G:L::::::::::::::H:D:::::::',
  'G::::b:k::c:v:m::H:D:n:c:::',
  'CCCCCCCCCCCCCCCCCCCCCCCCCCC',
]);

// The finale keep: break the door, climb to the top room, free the princess and pull the lever.
const KEEP = ch([
  'C..a...C',
  'CCCCCCCC',
  'C::::::C',
  'C::Q::LC',
  'CHCCCCCC',
  'CHCCCCCC',
  'CHCCCCCC',
  'CHCCCCCC',
  'CHCCCCCC',
  'CHCCCCCC',
  'CH:::::G',
  'DH:::::G',
  'DH::k::G',
  'CCCCCCCC',
]);

export const LEVELS = [
  {
    id: 'bridges', mech: 'bridges', time: 480, par: 180, troopers: 8, cages: [],
    goals: ['home'],
    chunks: [
      CAMP, flat(6), BUMP, flat(5), pit(3, true), flat(8, '...t'), pit(4), HILL, flat(4), pit(6),
      flat(16, '..t...k.....n'), pit(3), flat(15, '...m......F'),
    ],
  },
  {
    id: 'ladders', mech: 'ladders', time: 540, par: 240, troopers: 10, cages: [2, 2],
    goals: ['cages', 'home'],
    chunks: [
      CAMP, flat(5),
      ch([
        '...l######',
        '...l######',
        '...l######',
        '##########',
      ]),
      ch([
        '######....',
        '######....',
        '######....',
        '##########',
      ]),
      flat(4), pit(4),
      ch([
        '.......######',
        '.......######',
        '.......######',
        '....#########',
        '....#########',
        '#############',
      ]),
      ch([
        '..c.....n...',
        '############',
        '############',
        '############',
        '############',
        '############',
        '############',
      ]),
      ch([
        '######..........',
        '######..........',
        '######..........',
        '######..........',
        '######...t......',
        '################',
      ]),
      ch([
        '....c.......',
        '...wwww.....',
        '............',
        '......k.....',
        '############',
      ]),
      ch([
        '.....m...F....',
        '....##########',
        '....##########',
        '....##########',
        '....##########',
        '##############',
      ]),
    ],
  },
  {
    id: 'gates', mech: 'gates', time: 540, par: 240, troopers: 10, cages: [2],
    goals: ['gate', 'cages', 'home'],
    chunks: [
      CAMP, flat(6), pit(3), flat(8, '...t'),
      ch([
        '.....SS.....',
        '.....SS.....',
        '############',
      ]),
      flat(6, '....k'),
      ch(['....', '#...', '#~~~'], 5),
      GATEHOUSE, flat(6, '..m'), pit(4), flat(14, '...t.....F'),
    ],
  },
  {
    id: 'catapults', mech: 'catapults', time: 600, par: 270, troopers: 10, cages: [2, 2],
    goals: ['catapults', 'cages', 'home'],
    chunks: [
      CAMP, flat(6), pit(4), flat(8, '...t'), TOWER(), flat(6, '...k'),
      ch([
        '.........',
        '...c.....',
        '..wwww...',
        '#.......#',
        '#~~~~~~~#',
      ], 5),
      BUMP, flat(6, '..n'), pit(5), flat(6, '..t'), TOWER('a'),
      flat(13, '..c....k..m'),
      ch([
        '.....SS.....',
        '.....SS..F..',
        '############',
      ]),
      flat(4),
    ],
  },
  {
    id: 'builders', mech: 'builders', time: 600, par: 300, troopers: 12, cages: [3],
    goals: ['cages', 'home'],
    chunks: [
      CAMP, flat(6), pit(4), HILL, flat(8, '...t'), flat(8, '.....k'), WORKSHOP, flat(6, '..n'),
      pit(3), flat(14, '...t.....F'),
    ],
  },
  {
    id: 'siege', mech: 'siege', time: 660, par: 360, troopers: 12, cages: [2, 2],
    goals: ['gate', 'cages', 'home'],
    chunks: [
      CAMP, flat(6), pit(4), HILL, flat(8, '...t'), TOWER(), flat(8, '..k...n'),
      ch(['.....', '#....', '#~~~~'], 5),
      FORTRESS, flat(6, '..m'), pit(3), flat(14, '...t.....F'),
    ],
  },
  {
    id: 'finale', mech: 'finale', time: 720, par: 420, troopers: 12, cages: [2, 2],
    goals: ['princess', 'cages', 'home'], finale: true,
    chunks: [
      CAMP, flat(6), pit(5), flat(8, '...t'), TOWER(), flat(8, '..k...n'),
      ch(['.....', '#....', '#~~~~'], 5),
      GATEHOUSE, flat(4), TOWER('a'), flat(10, '.c..t..v.e'), KEEP, flat(12, '...m....F'),
    ],
  },
];

const MARKERS = new Set([...'TPtFLcQKkabnmvehl']);
const SOLIDISH = new Set([...'#SCBwDG']);

/**
 * Turn a level's chunks into a grid: { cols, chars[c][r], back[c][r], markers: [{ ch, c, r }] }.
 * back: 0 none, 1 dirt, 2 castle wall, 3 water.
 */
export function parseLevel(level) {
  const cols = [];
  for (const chunk of level.chunks) {
    const w = chunk.rows[0].length;
    for (const row of chunk.rows) {
      if (row.length !== w) throw new Error(`castle level ${level.id}: chunk row "${row}" should be ${w} wide`);
    }
    const H = chunk.rows.length;
    for (let j = 0; j < w; j++) {
      const col = new Array(ROWS).fill('.');
      col[0] = 'B';
      for (let i = 0; i < H; i++) {
        const r = chunk.bottom + (H - 1 - i);
        if (r < ROWS) col[r] = chunk.rows[i][j];
      }
      const below = col[chunk.bottom];
      for (let r = 1; r < chunk.bottom; r++) col[r] = below === '~' && r >= 2 ? '~' : '#';
      cols.push(col);
    }
  }
  const markers = [];
  const back = cols.map(() => new Array(ROWS).fill(0));
  for (let c = 0; c < cols.length; c++) {
    for (let r = 0; r < ROWS; r++) {
      const k = cols[c][r];
      if (MARKERS.has(k)) {
        markers.push({ ch: k, c, r });
        const near = [cols[c - 1]?.[r], cols[c + 1]?.[r], cols[c][r - 1]];
        cols[c][r] = near.includes(':') ? ':' : '.';
      }
    }
  }
  for (let c = 0; c < cols.length; c++) {
    for (let r = 0; r < ROWS; r++) {
      const k = cols[c][r];
      if (k === '#' || k === 'S') back[c][r] = 1;
      else if (k === '~') back[c][r] = 3;
      else if (k === ':' || k === 'C' || k === 'D' || k === 'G') back[c][r] = 2;
      else if (SOLIDISH.has(k)) back[c][r] = 1;
    }
  }
  return { cols: cols.length, chars: cols, back, markers };
}

/** How many troopers must get home: a bigger share with more players and in later levels. */
export function troopersNeeded(level, index, players) {
  const total = level.troopers + level.cages.reduce((s, n) => s + n, 0);
  const share = Math.min(0.8, 0.45 + 0.05 * (players - 1) + 0.02 * index);
  return { total, need: Math.ceil(total * share) };
}
