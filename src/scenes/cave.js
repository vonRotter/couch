import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { MiniGame } from '../core/minigame.js';
import { t, addStrings } from '../core/i18n.js';
import { Character } from '../core/character.js';
import { COLORS, PLAYER_COLORS, toon, basic, sharedGeo, faceted } from '../core/palette.js';
import { addLights, skyTexture, makeGem, makeMushroom, makeStar, seeded } from '../core/world.js';
import { moveBody, platformerControl } from '../core/physics2d.js';
import { esc } from '../core/ui.js';

addStrings({
  en: {
    'game.cave': 'Crystal Caves',
    'cave.intro': 'Dig down to the glowing door together! [A] jump · up/down climb · [B] rope · [C] pop bomb',
    'cave.d0': 'Mossy Mine', 'cave.d1': 'Frosty Hollow', 'cave.d2': 'Crystal Heart',
    'cave.depth': 'Depth {n} of {total}',
    'cave.team': 'Team gems',
    'cave.exitOpen': '{name} found the exit!', 'cave.everyone': 'Everyone to the glowing door!',
    'cave.closes': 'Next cave in',
    'cave.puppyFound': '{name} found the lost puppy! Carry it to the exit.',
    'cave.puppySaved': 'Puppy rescued! +{n} gems',
    'cave.puppyHud': 'Puppy with {name}',
    'cave.crate': '{name}: +2 ropes, +2 bombs',
    'cave.noRopes': 'No ropes left', 'cave.noBombs': 'No bombs left',
    'cave.hint': 'Follow the sparkles to the exit!',
    'cave.rescue': 'The cave fairies carry everyone to the exit!',
    'cave.done': 'Cave explorers!',
    'cave.sub': 'Team gems: {gems} · Depth reached: {depth} of {total} · Puppies rescued: {pups}',
    'cave.gems': '{n} gems',
    'cave.ropesUsed': '{n} ropes used',
    'cave.pup1': 'rescued a puppy', 'cave.pupN': 'rescued {n} puppies',
  },
  no: {
    'game.cave': 'Krystallgrottene',
    'cave.intro': 'Grav dere ned til den lysende døra sammen! [A] hopp · opp/ned klatre · [B] tau · [C] poppbombe',
    'cave.d0': 'Mosegruva', 'cave.d1': 'Frosthulen', 'cave.d2': 'Krystallhjertet',
    'cave.depth': 'Dybde {n} av {total}',
    'cave.team': 'Lagets edelsteiner',
    'cave.exitOpen': '{name} fant utgangen!', 'cave.everyone': 'Alle mann til den lysende døra!',
    'cave.closes': 'Neste grotte om',
    'cave.puppyFound': '{name} fant den bortkomne valpen! Bær den til utgangen.',
    'cave.puppySaved': 'Valpen er reddet! +{n} edelsteiner',
    'cave.puppyHud': 'Valpen er med {name}',
    'cave.crate': '{name}: +2 tau, +2 bomber',
    'cave.noRopes': 'Tomt for tau', 'cave.noBombs': 'Tomt for bomber',
    'cave.hint': 'Følg glitteret til utgangen!',
    'cave.rescue': 'Grottefeene bærer alle til utgangen!',
    'cave.done': 'Grotteforskere!',
    'cave.sub': 'Lagets edelsteiner: {gems} · Dybde nådd: {depth} av {total} · Valper reddet: {pups}',
    'cave.gems': '{n} edelsteiner',
    'cave.ropesUsed': '{n} tau brukt',
    'cave.pup1': 'reddet en valp', 'cave.pupN': 'reddet {n} valper',
  },
});

// Crystal Caves: co-op Spelunky. Each depth is stitched together from hand-made 10x8 room
// chunks on a room grid with a guaranteed path from the top entrance to the exit at the bottom.
// Every generated cave is checked with a movement model (walk, jump 3 tiles, climb, fall) and
// re-rolled if the exit can't be reached, or if any reachable spot could trap you without a rope.

// ---------- tiles and rooms ----------

const RW = 10, RH = 8; // room size in tiles
export const DEPTHS = [{ cols: 4, rows: 4 }, { cols: 4, rows: 5 }, { cols: 5, rows: 5 }];
export const TL = { EMPTY: 0, DIRT: 1, ROCK: 2, LADDER: 3, VINE: 4, PLAT: 5, GOLD: 6, MUD: 7, HONEY: 8, MUSH: 9 };
const SOLID = [false, true, true, false, false, false, true, false, false, true];
const CLIMBY = [false, false, false, true, true, false, false, false, false, false];
const BREAKABLE = [false, true, false, false, false, false, true, false, false, false];

// Legend: # dirt, g dirt with gold inside, ? maybe dirt, H ladder, V vine, = wooden ledge,
// m bouncy mushroom, u mud, h honey, * gem, $ gold, C crate, o snowball.
// Path rooms keep the left/right edges open on rows 5-6 (floor on row 7). U rooms have row 0
// open in columns 3-6; D rooms have a hole in row 7 inside columns 3-6.
const ROOMS = {
  LR: [
    ['##########', '###....###', '#.$..*...#', '#.####.$.#', '..........', '..........', '....m.....', '##########'],
    ['##########', '##......##', '#...**...#', '....##....', '...####...', '..######..', '.########.', '##########'],
    ['##########', '#..$..$..#', '#.======.#', '#........#', '..#....#..', '..#hhhh#..', '..######..', '##########'],
    ['##########', '#..*.$*..#', '#H######H#', '#H......H#', '.H......H.', '.H......H.', '.H..o...H.', '##########'],
    ['##########', '####..####', '##......##', '#...$*...#', '..........', '...#..#...', 'uu.#..#.uu', '##########'],
    ['##########', '#V......V#', '#V..**..V#', '#V.====.V#', '..........', '..........', '....??....', '##########'],
    ['##########', '#.C....###', '#####H.$.#', '#....H...#', '.....H....', '...#.H.#..', '...#.H.#..', '##########'],
  ],
  LRD: [
    ['##########', '#.$....$.#', '#.##..##.#', '#........#', '..........', '..........', '..........', '###....###'],
    ['##########', '##..*...##', '#...##...#', '#.......$#', '...====...', '..........', '..........', '##......##'],
    ['##########', '#$......$#', '##..**..##', '#........#', '..........', '..#....#..', '..##..##..', '###....###'],
    ['##########', '#*..##..*#', '#..####..#', '#........#', '..........', '....H.....', '....H.....', '###.H..###'],
    ['##########', '#..#..#..#', '#$.#..#.$#', '#..#..#..#', '#=.#..#.=#', '..........', '..o....o..', '#####..###'],
  ],
  LRU: [
    ['###....###', '#........#', '#.$....*.#', '#..####..#', '..........', '..........', '..........', '##########'],
    ['###....###', '##......##', '#...==...#', '#........#', '..*....*..', '...#..#...', '...#uu#...', '##########'],
    ['###....###', '#........#', '#..V..V..#', '#..V..V..#', '...V..V...', '..........', '.$..oo..$.', '##########'],
    ['###....###', '#........#', '#........#', '#.##..##.#', '..#....#..', '..........', '.m......m.', '##########'],
    ['###....###', '#g......g#', '##......##', '#...##...#', '...####...', '..........', '.hh....hh.', '##########'],
  ],
  LRUD: [
    ['###....###', '#........#', '#.##..##.#', '#........#', '..........', '...=..=...', '..........', '###....###'],
    ['###....###', '#..#..#..#', '#.*#..#*.#', '#.##..##.#', '....==....', '..........', '..........', '##......##'],
    ['###....###', '#........#', '#.$.##.$.#', '#..####..#', '..........', '.==....==.', '..........', '####..####'],
  ],
  SIDE: [
    ['##########', '#gg####gg#', '##########', '####gg####', '##########', '#g######g#', '##########', '##########'],
    ['##########', '##..*...##', '#..####..#', '#$......$#', '...####...', '..........', '..C....*..', '##########'],
    ['##########', '#...##...#', '#.$....$.#', '#..====..#', '?........?', '?........?', '#hh.**.hh#', '##########'],
    ['##########', '#..*..*..#', '#H######H#', '#H......H#', '#H..C...H#', '.H......H.', '.H.uuuu.H.', '##########'],
    ['##########', '#**....**#', '#==....==#', '#........#', '#........#', '..........', '...m..m...', '##########'],
    ['##########', '##########', '###....###', '##..**..##', '#........#', '..........', '..o....o..', '##########'],
    ['##########', '#V.V..V.V#', '#V.V..V.V#', '#..V..V..#', '..........', '...$..$...', '....CC....', '##########'],
    ['####..####', '#........#', '#.*....*.#', '#...##...#', '..........', '..........', '...g##g...', '##########'],
  ],
};

function poolFor(nd) {
  if (nd.U && nd.D) return ROOMS.LRUD;
  if (nd.D) return [...ROOMS.LRD, ...ROOMS.LRUD];
  if (nd.U) return [...ROOMS.LRU, ...ROOMS.LRUD];
  return [...ROOMS.LR, ...ROOMS.LRU];
}

const pick = (rand, list) => list[Math.floor(rand() * list.length)];

/** Room grid + tiles for one attempt (Spelunky-style path walk through the room grid). */
function layoutCave(rand, cols, rows, depth, forceSimple = false) {
  const need = Array.from({ length: rows }, () => Array(cols).fill(null)); // null = side room
  let c = Math.floor(rand() * cols), r = 0;
  const startRoom = { c, r };
  need[0][c] = { U: false, D: false };
  const path = [{ c, r }];
  let dir = c === 0 ? 1 : c === cols - 1 ? -1 : rand() < 0.5 ? -1 : 1;
  for (let guard = 0; guard < 200; guard++) {
    const atEdge = (dir < 0 && c === 0) || (dir > 0 && c === cols - 1);
    if (atEdge || rand() < 0.3) {
      if (r === rows - 1) break; // this room holds the exit
      need[r][c].D = true;
      r++;
      need[r][c] = { U: true, D: false };
      dir = c === 0 ? 1 : c === cols - 1 ? -1 : rand() < 0.5 ? -1 : 1;
    } else {
      c += dir;
      need[r][c] = { U: false, D: false };
    }
    path.push({ c, r });
  }
  const exitRoom = { c, r };

  const W = cols * RW + 2, H = rows * RH + 2;
  const grid = new Uint8Array(W * H).fill(TL.ROCK);
  const marks = [];
  const snowChance = [0.35, 0.55, 0.75][depth] ?? 0.6;
  for (let ry = 0; ry < rows; ry++) {
    for (let rx = 0; rx < cols; rx++) {
      const nd = need[ry][rx];
      let tpl = forceSimple && nd ? ROOMS.LRUD[0] : pick(rand, nd ? poolFor(nd) : ROOMS.SIDE);
      if (rand() < 0.5) tpl = tpl.map((row) => row.split('').reverse().join(''));
      for (let y = 0; y < RH; y++) {
        for (let x = 0; x < RW; x++) {
          const ch = tpl[y][x];
          const gc = 1 + rx * RW + x, gr = 1 + ry * RH + y;
          let tile = TL.EMPTY;
          if (ch === '#') tile = TL.DIRT;
          else if (ch === 'g') tile = TL.GOLD;
          else if (ch === '?') tile = rand() < 0.5 ? TL.DIRT : TL.EMPTY;
          else if (ch === 'H') tile = TL.LADDER;
          else if (ch === 'V') tile = TL.VINE;
          else if (ch === '=') tile = TL.PLAT;
          else if (ch === 'u') tile = TL.MUD;
          else if (ch === 'h') tile = TL.HONEY;
          else if (ch === 'm') tile = TL.MUSH;
          else if (ch === '*' && rand() < 0.6) marks.push({ c: gc, r: gr, kind: 'gem' });
          else if (ch === '$' && rand() < 0.75) marks.push({ c: gc, r: gr, kind: 'gold' });
          else if (ch === 'C' && rand() < 0.55) marks.push({ c: gc, r: gr, kind: 'crate' });
          else if (ch === 'o' && rand() < snowChance) marks.push({ c: gc, r: gr, kind: 'snow' });
          grid[gr * W + gc] = tile;
        }
      }
    }
  }
  // A little gold glitters in exposed dirt everywhere.
  for (let r2 = 1; r2 < H - 1; r2++) {
    for (let c2 = 1; c2 < W - 1; c2++) {
      const i = r2 * W + c2;
      if (grid[i] !== TL.DIRT) continue;
      const open = !SOLID[grid[i - 1]] || !SOLID[grid[i + 1]] || !SOLID[grid[i - W]] || !SOLID[grid[i + W]];
      if (open && rand() < 0.05) grid[i] = TL.GOLD;
    }
  }
  return { W, H, grid, cols, rows, need, path, startRoom, exitRoom, marks, depth };
}

// ---------- movement model (used for the solvability check, the hint trail and test bots) ----------

/** Tile queries for a level; `ropes` is an optional Set of cell indices with hanging ropes. */
export function caveQuery(lv, ropes = null) {
  const { W, H, grid } = lv;
  const at = (c, r) => (c < 0 || r < 0 || c >= W || r >= H ? TL.ROCK : grid[r * W + c]);
  const pass = (c, r) => !SOLID[at(c, r)];
  const climb = (c, r) => CLIMBY[at(c, r)] || !!(ropes && c >= 0 && c < W && ropes.has(r * W + c));
  // Something to stand on: solid ground, a wooden ledge or the top of a ladder/vine.
  const support = (c, r) => {
    const b = at(c, r + 1);
    return SOLID[b] || b === TL.PLAT || (CLIMBY[b] && !CLIMBY[at(c, r)]);
  };
  const stand = (c, r) => pass(c, r) && (climb(c, r) || support(c, r));
  return { W, H, at, pass, climb, support, stand };
}

/**
 * Every move from a standing (or hanging) cell. emit(c, r, act) is called for each landing cell.
 * Jumps reach 3 tiles up (4 from a mushroom), need head room, and move at most 1-2 tiles sideways
 * at the top; falls go straight down and may grab a ladder on the way. This is deliberately a bit
 * weaker than the real controls, so anything it can do, players can do.
 */
export function caveMoves(q, c, r, emit) {
  const fallFrom = (c2, r2, act) => {
    for (let rr = r2; rr < q.H; rr++) {
      if (!q.pass(c2, rr)) return;
      if (q.climb(c2, rr) || q.support(c2, rr)) emit(c2, rr, act);
      if (q.support(c2, rr)) return;
    }
  };
  const hanging = q.climb(c, r);
  const below = q.at(c, r + 1);
  const K = below === TL.MUSH && !hanging ? 4 : 3;
  if (hanging) {
    if (q.pass(c, r - 1) && (q.climb(c, r - 1) || q.support(c, r - 1))) emit(c, r - 1, { kind: 'up' });
    if (q.pass(c, r + 1)) {
      if (q.stand(c, r + 1)) emit(c, r + 1, { kind: 'down' });
      else fallFrom(c, r + 1, { kind: 'down' });
    }
  } else if (q.climb(c, r + 1)) {
    emit(c, r + 1, { kind: 'down' });
  }
  if (below === TL.PLAT) fallFrom(c, r + 1, { kind: 'drop' });
  for (let k = 0; k <= K; k++) {
    if (k > 0 && !q.pass(c, r - k)) break;
    if (k > 0 && q.climb(c, r - k)) emit(c, r - k, { kind: 'jump', k, dir: 0, i: 0 });
    if (k > 0 && !q.pass(c, r - k - 1)) continue; // need head room to hop onto a ledge at this height
    if (k > 0 && q.at(c, r - k + 1) === TL.PLAT) emit(c, r - k, { kind: 'jump', k, dir: 0, i: 0 });
    const maxI = k === 0 ? (q.pass(c, r - 1) ? 3 : 1) : k >= K ? 1 : 2;
    for (const dir of [-1, 1]) {
      for (let i = 1; i <= maxI; i++) {
        const cx = c + dir * i, ry = r - k;
        if (!q.pass(cx, ry)) break;
        if (i >= 2 && (!q.pass(cx, ry - 1) || !q.pass(cx - dir, ry - 1))) break; // long hops need head room all the way
        const act = { kind: k === 0 && i === 1 ? 'walk' : 'jump', k, dir, i };
        if (q.stand(cx, ry)) emit(cx, ry, act);
        else fallFrom(cx, ry, act);
      }
    }
  }
}

/** Breadth-first search over the movement model. Returns { prev, act, seen }. */
function caveSearch(q, from, stopAt = -1) {
  const n = q.W * q.H;
  const seen = new Uint8Array(n);
  const prev = new Int32Array(n).fill(-1);
  const act = new Array(n);
  const edges = new Map();
  const queue = [from];
  seen[from] = 1;
  for (let h = 0; h < queue.length; h++) {
    const cur = queue[h];
    if (cur === stopAt) break;
    const out = [];
    caveMoves(q, cur % q.W, Math.floor(cur / q.W), (c, r, a) => {
      const i = r * q.W + c;
      out.push(i);
      if (seen[i]) return;
      seen[i] = 1;
      prev[i] = cur;
      act[i] = a;
      queue.push(i);
    });
    edges.set(cur, out);
  }
  return { seen, prev, act, edges, order: queue };
}

/**
 * Checks a level: can the exit be reached from the entrance, and can the exit still be reached
 * from every spot you can get to (no pits that need a rope)? Picks the exit if none is set.
 */
export function analyseCave(lv) {
  const q = caveQuery(lv);
  const { W } = lv;
  const start = lv.entrance.r * W + lv.entrance.c;
  const s = caveSearch(q, start);
  if (!lv.exit) {
    // Exit: the lowest reachable flat spot with room for a door in the exit room.
    const er = lv.exitRoom;
    let best = [], bestScore = -1;
    for (let r = 1 + er.r * RH; r < 1 + (er.r + 1) * RH; r++) {
      for (let c = 1 + er.c * RW; c < 1 + (er.c + 1) * RW; c++) {
        const i = r * W + c;
        if (!s.seen[i] || q.climb(c, r) || !q.pass(c, r - 1) || !SOLID[q.at(c, r + 1)] || q.at(c, r + 1) === TL.MUSH) continue;
        if (q.at(c, r) !== TL.EMPTY) continue;
        const flat = (q.stand(c - 1, r) ? 1 : 0) + (q.stand(c + 1, r) ? 1 : 0);
        const score = r * 4 + flat;
        if (score > bestScore) { bestScore = score; best = [i]; } else if (score === bestScore) best.push(i);
      }
    }
    if (!best.length) return { ok: false, reach: s.order.length, trapped: -1 };
    const ei = best[Math.floor(lv.rand() * best.length)];
    lv.exit = { c: ei % W, r: Math.floor(ei / W) };
  }
  const exitIdx = lv.exit.r * W + lv.exit.c;
  if (!s.seen[exitIdx]) return { ok: false, reach: s.order.length, trapped: -1 };
  // Reverse search from the exit over the edges we found.
  const back = new Map();
  for (const [from, outs] of s.edges) for (const to of outs) { if (!back.has(to)) back.set(to, []); back.get(to).push(from); }
  const co = new Uint8Array(W * lv.H);
  const queue = [exitIdx];
  co[exitIdx] = 1;
  for (let h = 0; h < queue.length; h++) for (const f of back.get(queue[h]) || []) if (!co[f]) { co[f] = 1; queue.push(f); }
  let trapped = 0;
  for (const i of s.order) if (!co[i]) trapped++;
  return { ok: true, reach: s.order.length, trapped, seen: s.seen, pathLen: pathLength(s.prev, exitIdx, start) };
}

function pathLength(prev, to, from) {
  let n = 0;
  for (let i = to; i !== from && i >= 0; i = prev[i]) n++;
  return n;
}

/** Shortest list of moves [{ idx, act }] from a cell to the exit (empty if unreachable). */
export function routeToExit(lv, fromIdx, ropes = null) {
  const q = caveQuery(lv, ropes);
  const exitIdx = lv.exit.r * lv.W + lv.exit.c;
  if (!q.stand(fromIdx % lv.W, Math.floor(fromIdx / lv.W))) return [];
  const s = caveSearch(q, fromIdx, exitIdx);
  if (!s.seen[exitIdx]) return [];
  const out = [];
  for (let i = exitIdx; i !== fromIdx; i = s.prev[i]) out.push({ idx: i, act: s.act[i] });
  return out.reverse();
}

/** Builds a checked cave for one depth. Same seed, same cave. */
export function generateCave(seed, depth = 0) {
  const rand = seeded((seed * 7919 + depth * 104729 + 12345) >>> 0);
  const { cols, rows } = DEPTHS[depth];
  let best = null;
  for (let attempt = 1; attempt <= 80; attempt++) {
    const lv = layoutCave(rand, cols, rows, depth, attempt === 80);
    lv.rand = rand;
    if (!placeEntrance(lv)) continue;
    const res = analyseCave(lv);
    lv.attempts = attempt;
    if (!res.ok) continue;
    lv.reach = res.reach;
    lv.trapped = res.trapped;
    lv.pathLen = res.pathLen;
    if (res.trapped === 0) { decorate(lv, res.seen); return lv; }
    if (!best || res.trapped < best.trapped) { best = lv; best.seen = res.seen; }
  }
  decorate(best, best.seen);
  return best;
}

function placeEntrance(lv) {
  const q = caveQuery(lv);
  const sr = lv.startRoom;
  let best = [], bestR = Infinity;
  for (let r = 1 + sr.r * RH; r < 1 + (sr.r + 1) * RH; r++) {
    for (let c = 1 + sr.c * RW; c < 1 + (sr.c + 1) * RW; c++) {
      if (q.at(c, r) !== TL.EMPTY || !q.pass(c, r - 1) || !SOLID[q.at(c, r + 1)] || q.at(c, r + 1) === TL.MUSH) continue;
      if (!q.stand(c - 1, r) || !q.stand(c + 1, r)) continue;
      if (r < bestR) { bestR = r; best = [c]; } else if (r === bestR) best.push(c);
    }
  }
  if (!best.length) return false;
  lv.entrance = { c: best[Math.floor(lv.rand() * best.length)], r: bestR };
  lv.exit = null;
  return true;
}

/** Treasure, crates, snowballs and the lost puppy, placed only where players can get. */
function decorate(lv, seen) {
  const q = caveQuery(lv);
  const { W, rand } = lv;
  const ent = lv.entrance, ex = lv.exit;
  const nearDoor = (c, r) => (Math.abs(c - ent.c) <= 2 && Math.abs(r - ent.r) <= 1) || (Math.abs(c - ex.c) <= 1 && Math.abs(r - ex.r) <= 1);
  const used = new Set();
  lv.gems = [];
  lv.crates = [];
  lv.snowballs = [];
  for (const m of lv.marks) {
    const i = m.r * W + m.c;
    if (q.at(m.c, m.r) !== TL.EMPTY || nearDoor(m.c, m.r) || used.has(i)) continue;
    used.add(i);
    if (m.kind === 'crate') { if (q.support(m.c, m.r)) lv.crates.push({ c: m.c, r: m.r }); } else if (m.kind === 'snow') lv.snowballs.push({ c: m.c, r: m.r });
    else lv.gems.push({ c: m.c, r: m.r, kind: m.kind });
  }
  // Spots on solid ground that players can reach.
  const floor = [];
  for (let i = 0; i < seen.length; i++) {
    if (!seen[i]) continue;
    const c = i % W, r = Math.floor(i / W);
    if (q.at(c, r) !== TL.EMPTY || !SOLID[q.at(c, r + 1)] || q.at(c, r + 1) === TL.MUSH || nearDoor(c, r) || used.has(i)) continue;
    floor.push(i);
  }
  for (const i of floor) if (rand() < 0.06) { used.add(i); lv.gems.push({ c: i % W, r: Math.floor(i / W), kind: 'gold' }); }
  const free = floor.filter((i) => !used.has(i));
  const take = (list) => {
    for (let tries = 0; tries < 40 && list.length; tries++) {
      const k = Math.floor(rand() * list.length);
      const i = list[k];
      list.splice(k, 1);
      if (!used.has(i)) { used.add(i); return { c: i % W, r: Math.floor(i / W) }; }
    }
    return null;
  };
  while (lv.crates.length < 2) {
    const s = take(free);
    if (!s) break;
    lv.crates.push(s);
  }
  // The puppy hides away from the doors, preferably in a side room.
  const far = free.filter((i) => {
    const c = i % W, r = Math.floor(i / W);
    return Math.abs(c - ent.c) + Math.abs(r - ent.r) > 12 && Math.abs(c - ex.c) + Math.abs(r - ex.r) > 6;
  });
  const roomOf = (i) => lv.need[Math.floor((Math.floor(i / W) - 1) / RH)]?.[Math.floor(((i % W) - 1) / RW)];
  const side = far.filter((i) => roomOf(i) === null);
  lv.puppy = take(side.length && rand() < 0.7 ? side : far.length ? far : free);
}

// ---------- look and feel ----------

const THEMES = [
  { name: 'cave.d0', sky: ['#2c2350', '#5b3f78'], dirt: [0xc98a5a, 0xbb7c4e], rock: 0x6f6488, top: 0x7ad65a, wall: 0x5e4a7c, crystal: [0x4cc9f0, 0x9ff0c8, 0xffe47a], mush: 0xff5d73, glow: 0x9ff0c8 },
  { name: 'cave.d1', sky: ['#1f2f5c', '#4f6fa8'], dirt: [0x9cc3ec, 0x8bb3e0], rock: 0x5d6f9a, top: 0xffffff, wall: 0x435c92, crystal: [0xbfe9ff, 0xffffff, 0x8fd8ff], mush: 0x4cc9f0, glow: 0xbfe9ff },
  { name: 'cave.d2', sky: ['#2a1746', '#6a3d8a'], dirt: [0xb592e0, 0xa580d2], rock: 0x6a4f8c, top: 0xff9fd0, wall: 0x553a7a, crystal: [0xff7eb6, 0xffd23f, 0xc9a8ff], mush: 0xffc93c, glow: 0xff9fd0 },
];

const PHYS = {
  speed: 6.2, accel: 60, airAccel: 38, jump: 15.6, gravity: 36, fallMul: 1.5,
  coyote: 0.12, buffer: 0.15, maxFall: -19, doubleJump: false,
};
const BODY_W = 0.6, BODY_H = 0.85;
const BEAN_SCALE = 0.78;
const CLIMB_SPEED = 4.6;
const SPRING = 20;
const DIZZY_FALL = 6.5; // tiles
const ROPES = 4, BOMBS = 3, MAX_ITEMS = 9;
const ROPE_LEN = 7;
const BOMB_FUSE = 1.6, BOMB_R = 1.65;
const HONEY_TIME = 1.5;
const EXIT_WAIT = 12;
const HINT_TIME = 75; // seconds into a depth before the sparkle trail shows the way
const RESCUE_TIME = 180; // seconds into a depth before everyone floats to the exit
const PUPPY_BONUS = 15;
const GEM_COLORS = PLAYER_COLORS.map((c) => c.hex);
const NO_INPUT = { x: 0, y: 0, a: false, b: false, c: false, aPressed: false, bPressed: false, cPressed: false };

const geo = {
  box: () => sharedGeo('caveBox', () => new THREE.BoxGeometry(1, 1, 2)),
  top: () => sharedGeo('caveTop', () => new RoundedBoxGeometry(1.04, 0.24, 2.08, 2, 0.08)),
  nugget: () => sharedGeo('caveNugget', () => faceted(new THREE.IcosahedronGeometry(0.13, 0))),
  sph: (r, w = 14, h = 10) => sharedGeo(`caveSph${r}|${w}`, () => new THREE.SphereGeometry(r, w, h)),
  cyl: (key, rt, rb, h, s = 10) => sharedGeo(`cave-${key}`, () => new THREE.CylinderGeometry(rt, rb, h, s)),
  rbox: (key, w, h, d, r = 0.06) => sharedGeo(`cave-${key}`, () => new RoundedBoxGeometry(w, h, d, 2, r)),
  cone: (key, r, h, s = 6) => sharedGeo(`cave-${key}`, () => new THREE.ConeGeometry(r, h, s)),
};

function part(g, geometry, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geometry, mat);
  m.position.set(x, y, z);
  g.add(m);
  return m;
}

function makePuppy() {
  const g = new THREE.Group();
  const fur = toon(0xf4d6a8), dark = toon(0x9a6440), ink = toon(COLORS.ink);
  const body = part(g, geo.sph(0.3), fur, 0, 0.3, 0);
  body.scale.set(1.35, 0.9, 0.95);
  body.castShadow = true;
  const head = part(g, geo.sph(0.25), fur, 0.36, 0.58, 0);
  head.castShadow = true;
  part(g, geo.sph(0.12), toon(0xfff3dc), 0.56, 0.52, 0).scale.set(1.1, 0.8, 0.9);
  part(g, geo.sph(0.055), ink, 0.67, 0.56, 0);
  for (const s of [-1, 1]) {
    const ear = part(g, geo.sph(0.12), dark, 0.3, 0.6, s * 0.21);
    ear.scale.set(0.7, 1.4, 0.45);
    ear.rotation.x = s * 0.4;
    part(g, geo.sph(0.045), ink, 0.52, 0.66, s * 0.11);
    for (const fx of [-0.22, 0.22]) part(g, geo.cyl('pupLeg', 0.07, 0.07, 0.22, 8), fur, fx, 0.1, s * 0.15);
  }
  const collar = part(g, sharedGeo('cavePupCollar', () => new THREE.TorusGeometry(0.17, 0.035, 6, 16)), toon(0xff5d73), 0.3, 0.42, 0);
  collar.rotation.y = Math.PI / 2;
  collar.rotation.x = 0.5;
  part(g, geo.sph(0.05), toon(COLORS.gold), 0.36, 0.33, 0);
  const tail = new THREE.Group();
  tail.position.set(-0.36, 0.42, 0);
  part(tail, geo.cyl('pupTail', 0.035, 0.05, 0.3, 6), dark, 0, 0.14, 0);
  tail.rotation.z = 0.6;
  g.add(tail);
  g.userData.tail = tail;
  return g;
}

function makeHeart() {
  const g = new THREE.Group();
  const m = toon(0xff5d73, { emissive: 0x330011 });
  part(g, geo.sph(0.13), m, -0.09, 0.05, 0);
  part(g, geo.sph(0.13), m, 0.09, 0.05, 0);
  const tip = part(g, geo.cone('heartTip', 0.17, 0.22, 12), m, 0, -0.1, 0);
  tip.rotation.z = Math.PI;
  return g;
}

export class CaveScene extends MiniGame {
  constructor(game, opts = {}) {
    super(game, opts);
    this.seed = opts.seed ?? Math.floor(Math.random() * 1e9);
    this.depth = 0;
    this.depthsDone = 0;
    this.teamGems = 0;
    this.puppiesSaved = 0;
    this.hintTime = HINT_TIME;
    this.rescueTime = RESCUE_TIME;
    this.camX = 0;
    this.camY = 0;
    this.camDist = 20;
    this._near = [];
    const lights = addLights(this.scene, { size: 22 });
    this.sun = lights.sun;
    this.ents = this.players.map((p, i) => this.makeExplorer(p, i));
    this.buildDepth(0);
    this.updateCamera(1, true);
    game.audio.playMusic('platformer');
    this.intro(t('game.cave'), t('cave.intro'));
  }

  retryOptions() {
    return { key: this.key };
  }

  // ---------- grid helpers ----------

  rowAt(y) { return this.lv.H - 1 - Math.floor(y); }
  bottomOf(r) { return this.lv.H - 1 - r; }
  tile(c, r) {
    const lv = this.lv;
    return c < 0 || r < 0 || c >= lv.W || r >= lv.H ? TL.ROCK : lv.grid[r * lv.W + c];
  }
  tileAtXY(x, y) { return this.tile(Math.floor(x), this.rowAt(y)); }
  climbAt(x, y) {
    const c = Math.floor(x), r = this.rowAt(y);
    return CLIMBY[this.tile(c, r)] || this.ropeCells.has(r * this.lv.W + c);
  }
  passable(c, r) { return !SOLID[this.tile(c, r)]; }

  /** Collision box for a cell (null when there is nothing to bump into). */
  makeRect(c, r) {
    const tl = this.tile(c, r), y = this.bottomOf(r);
    if (tl === TL.DIRT || tl === TL.ROCK || tl === TL.GOLD) return { x: c, y, w: 1, h: 1, cell: r * this.lv.W + c };
    if (tl === TL.PLAT) return { x: c, y: y + 0.75, w: 1, h: 0.25, oneWay: true };
    if (tl === TL.MUSH) return { x: c + 0.08, y, w: 0.84, h: 0.55, spring: true, cell: r * this.lv.W + c };
    if (CLIMBY[tl] && !CLIMBY[this.tile(c, r - 1)] && this.passable(c, r - 1)) return { x: c, y: y + 0.85, w: 1, h: 0.15, oneWay: true, ladderTop: true };
    return null;
  }

  solidsNear(b) {
    const out = this._near;
    out.length = 0;
    const c0 = Math.floor(b.x - b.w / 2 - 1), c1 = Math.floor(b.x + b.w / 2 + 1);
    const r0 = Math.max(0, this.rowAt(b.y + b.h + 1.5)), r1 = Math.min(this.lv.H - 1, this.rowAt(b.y - 1.5));
    const W = this.lv.W;
    for (let r = r0; r <= r1; r++) {
      for (let c = Math.max(0, c0); c <= Math.min(W - 1, c1); c++) {
        const s = this.rects[r * W + c];
        if (s) out.push(s);
      }
    }
    return out;
  }

  // ---------- building a depth ----------

  makeExplorer(p, i) {
    const ch = new Character(p.color, { hat: p.hat });
    ch.group.scale.setScalar(BEAN_SCALE);
    this.scene.add(ch.group);
    const bubble = new THREE.Mesh(geo.sph(0.68, 22, 16), toon(p.color, { transparent: true, opacity: 0.35 }));
    bubble.visible = false;
    this.scene.add(bubble);
    const stars = new THREE.Group();
    for (let k = 0; k < 3; k++) {
      const s = makeStar();
      s.scale.setScalar(0.32);
      s.position.set(Math.cos((k / 3) * Math.PI * 2) * 0.35, 0, Math.sin((k / 3) * Math.PI * 2) * 0.35);
      stars.add(s);
    }
    stars.visible = false;
    this.scene.add(stars);
    const honey = new THREE.Group();
    for (const [x, y, s] of [[0, 0, 0.16], [0.13, -0.08, 0.1], [-0.12, -0.05, 0.11]]) part(honey, geo.sph(s), toon(0xffb627), x, y, 0.1);
    honey.visible = false;
    this.scene.add(honey);
    return {
      p, ch, bubble, stars, honey,
      body: { x: 0, y: 0, w: BODY_W, h: BODY_H, vx: 0, vy: 0, grounded: true },
      facing: 1, state: 'play', t: 0, climbing: false, climbCol: 0, regrab: 0,
      dizzy: 0, stun: 0, invuln: 0, sticky: 0, peakY: 0, lastSafe: { x: 0, y: 0 },
      gems: 0, ropes: ROPES, bombs: BOMBS, ropesUsed: 0, bombsUsed: 0, pups: 0, toExit: false, order: i,
    };
  }

  buildDepth(d) {
    if (this.levelGroup) {
      this.scene.remove(this.levelGroup);
      this.levelGroup.traverse((o) => {
        if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose();
        if (o.material && !o.material.userData.shared) o.material.dispose();
      });
    }
    this.depth = d;
    this.theme = THEMES[d];
    this.lv = generateCave(this.seed, d);
    if (this.scene.background?.dispose) this.scene.background.dispose();
    this.scene.background = skyTexture(...this.theme.sky);
    this.levelGroup = new THREE.Group();
    this.scene.add(this.levelGroup);
    this.ropeCells = new Set();
    this.ropes = [];
    this.bombs = [];
    this.pickups = [];
    this.crates = [];
    this.snowballs = [];
    this.mushMeshes = new Map();
    this.nuggetMeshes = new Map();
    this.hint = null;
    this.protect = new Set();
    const { W, H } = this.lv;
    const ex = this.lv.exit;
    for (let dc = -1; dc <= 1; dc++) for (const dr of [1, 2]) this.protect.add((ex.r + dr) * W + ex.c + dc);
    this.rects = new Array(W * H).fill(null);
    for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) this.rects[r * W + c] = this.makeRect(c, r);

    this.buildTiles();
    this.buildDecor();
    this.buildThings();
    this.computeDist();

    const en = this.lv.entrance;
    const sx = en.c + 0.5, sy = this.bottomOf(en.r);
    this.ents.forEach((e, i) => {
      const b = e.body;
      b.x = sx + (i - (this.ents.length - 1) / 2) * 0.28;
      b.y = sy;
      b.vx = b.vy = 0;
      b.grounded = true;
      e.state = 'play';
      e.climbing = false;
      e.dizzy = e.stun = e.sticky = 0;
      e.invuln = 0;
      e.peakY = sy;
      e.lastSafe = { x: sx, y: sy };
      e.toExit = false;
      e.t = 0;
      e.bubble.visible = false;
      e.ch.group.visible = true;
      e.ch.group.scale.setScalar(BEAN_SCALE);
    });
    this.exitTimer = null;
    this.depthTime = 0;
    this.cleared = false;
    this.rescueOn = false;
    this.camX = sx;
    this.camY = sy;
  }

  buildTiles() {
    const { W, H, grid } = this.lv;
    const th = this.theme;
    const g = this.levelGroup;
    const solids = [];
    for (let i = 0; i < W * H; i++) if (grid[i] === TL.DIRT || grid[i] === TL.ROCK || grid[i] === TL.GOLD) solids.push(i);
    const m = new THREE.Matrix4();
    const col = new THREE.Color();
    this.tileMesh = new THREE.InstancedMesh(geo.box(), toon(0xffffff), solids.length);
    this.tileInst = new Int32Array(W * H).fill(-1);
    solids.forEach((i, k) => {
      const c = i % W, r = Math.floor(i / W);
      m.makeTranslation(c + 0.5, this.bottomOf(r) + 0.5, 0);
      this.tileMesh.setMatrixAt(k, m);
      this.tileMesh.setColorAt(k, col.set(grid[i] === TL.ROCK ? th.rock : (c + r) % 2 ? th.dirt[0] : th.dirt[1]));
      this.tileInst[i] = k;
    });
    this.tileMesh.receiveShadow = this.tileMesh.castShadow = true;
    g.add(this.tileMesh);
    // Moss / snow / frosting caps on exposed tops (spare capacity for tops uncovered by bombs).
    this.topMesh = new THREE.InstancedMesh(geo.top(), toon(th.top), solids.length);
    this.topMesh.count = 0;
    this.topInst = new Int32Array(W * H).fill(-1);
    for (const i of solids) if (!SOLID[grid[i - W]] && i >= W) this.addTop(i);
    this.topMesh.receiveShadow = true;
    g.add(this.topMesh);
    // Gold glinting in the dirt.
    for (const i of solids) if (grid[i] === TL.GOLD) this.addNuggets(i);
    // A frame of rock beyond the edges so the camera never sees the void.
    const fw = W + 16, fh = H + 16;
    for (const [x, y, w, h] of [[W / 2, -4, fw, 8], [W / 2, H + 4, fw, 8], [-4, H / 2, 8, fh], [W + 4, H / 2, 8, fh]]) {
      const f = new THREE.Mesh(new THREE.BoxGeometry(w, h, 2), toon(th.rock));
      f.position.set(x, y, 0);
      g.add(f);
    }
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(W, H), toon(th.wall));
    wall.position.set(W / 2, H / 2, -1.02);
    wall.receiveShadow = true;
    g.add(wall);

    for (let r = 0; r < H; r++) {
      for (let c = 0; c < W; c++) {
        const tl = grid[r * W + c];
        const x = c + 0.5, y = this.bottomOf(r);
        if (tl === TL.LADDER) this.addLadder(x, y, !CLIMBY[this.tile(c, r - 1)]);
        else if (tl === TL.VINE) this.addVine(x, y);
        else if (tl === TL.PLAT) {
          const plank = part(g, geo.rbox('plank', 1.02, 0.22, 1.5, 0.05), toon(0xc98a4a), x, y + 0.87, 0);
          plank.castShadow = plank.receiveShadow = true;
          if (c % 2 === 0) part(g, geo.cyl('plankPost', 0.05, 0.05, 0.5, 6), toon(0x9a6440), x, y + 0.55, -0.5);
        } else if (tl === TL.MUD) {
          const mud = part(g, geo.rbox('mud', 1.0, 0.42, 1.8, 0.1), toon(0x7a5236), x, y + 0.18, 0);
          mud.receiveShadow = true;
          for (const bx of [-0.25, 0.2]) part(g, geo.sph(0.07), toon(0x96684a), x + bx, y + 0.4, 0.75);
        } else if (tl === TL.HONEY) {
          part(g, geo.rbox('honey', 1.0, 0.38, 1.8, 0.1), toon(0xffb627), x, y + 0.17, 0);
          const drip = part(g, geo.sph(0.09), toon(0xffc94a), x + (c % 2 ? 0.2 : -0.2), y + 0.33, 0.85);
          drip.scale.y = 1.6;
        } else if (tl === TL.MUSH) {
          const mush = makeMushroom(th.mush);
          mush.scale.setScalar(0.55);
          mush.position.set(x, y, 0);
          g.add(mush);
          this.mushMeshes.set(r * W + c, { mesh: mush, squish: 0 });
        }
      }
    }
  }

  addTop(i) {
    if (this.topInst[i] >= 0) return;
    const W = this.lv.W;
    const k = this.topMesh.count++;
    const m = new THREE.Matrix4().makeTranslation(i % W + 0.5, this.bottomOf(Math.floor(i / W)) + 0.92, 0);
    this.topMesh.setMatrixAt(k, m);
    this.topMesh.instanceMatrix.needsUpdate = true;
    this.topInst[i] = k;
  }

  addNuggets(i) {
    const W = this.lv.W;
    const x = i % W + 0.5, y = this.bottomOf(Math.floor(i / W)) + 0.5;
    const list = [];
    for (const [dx, dy] of [[-0.22, 0.15], [0.2, -0.12], [0.05, 0.28]]) {
      const n = part(this.levelGroup, geo.nugget(), toon(COLORS.gold, { emissive: 0x332200 }), x + dx, y + dy, 1.02);
      n.rotation.set(dx * 5, dy * 7, 0.4);
      list.push(n);
    }
    this.nuggetMeshes.set(i, list);
  }

  addLadder(x, y, top) {
    const g = new THREE.Group();
    g.position.set(x, y, -0.45);
    const wood = toon(0xb07a4a);
    for (const s of [-1, 1]) {
      const rail = part(g, geo.rbox('rail', 0.09, top ? 1.3 : 1.0, 0.09, 0.03), wood, s * 0.32, top ? 0.65 : 0.5, 0);
      rail.castShadow = true;
    }
    for (const ry of [0.18, 0.5, 0.82]) part(g, geo.rbox('rung', 0.64, 0.07, 0.07, 0.02), toon(0xd9a66b), 0, ry, 0);
    this.levelGroup.add(g);
  }

  addVine(x, y) {
    const g = new THREE.Group();
    g.position.set(x, y, -0.35);
    part(g, geo.cyl('vine', 0.06, 0.06, 1.0, 6), toon(0x3f9a32), 0, 0.5, 0);
    for (const [ly, s] of [[0.25, 1], [0.7, -1]]) {
      const leaf = part(g, geo.sph(0.13), toon(COLORS.leafLight), s * 0.14, ly, 0.05);
      leaf.scale.set(1.3, 0.55, 0.6);
      leaf.rotation.z = s * 0.5;
    }
    this.levelGroup.add(g);
  }

  buildDecor() {
    const { W, H } = this.lv;
    const th = this.theme;
    const rand = seeded(this.seed + this.depth * 31 + 7);
    const g = this.levelGroup;
    for (let r = 1; r < H - 1; r++) {
      for (let c = 1; c < W - 1; c++) {
        if (this.tile(c, r) !== TL.EMPTY) continue;
        const x = c + 0.5, y = this.bottomOf(r);
        if (SOLID[this.tile(c, r + 1)] && this.tile(c, r + 1) !== TL.MUSH && rand() < 0.08) {
          // Crystal cluster on the floor, behind the players.
          const cl = new THREE.Group();
          const color = th.crystal[Math.floor(rand() * th.crystal.length)];
          for (let k = 0; k < 3; k++) {
            const h = 0.35 + rand() * 0.45;
            const cr = part(cl, geo.cone(`cry${k}`, 0.1 + k * 0.02, 1, 6), toon(color, { emissive: 0x1a1a33 }), (k - 1) * 0.16, h / 2, 0);
            cr.scale.y = h;
            cr.rotation.z = (k - 1) * 0.35;
          }
          cl.position.set(x + (rand() - 0.5) * 0.4, y, -0.75);
          g.add(cl);
        } else if (SOLID[this.tile(c, r - 1)] && rand() < 0.12) {
          const st = part(g, geo.cone('stal', 0.14, 1, 6), toon(th.rock), x + (rand() - 0.5) * 0.5, y + 0.8, -0.7);
          st.scale.y = 0.3 + rand() * 0.4;
          st.position.y = y + 1 - st.scale.y / 2;
          st.rotation.z = Math.PI;
        }
      }
    }
    // Entrance: a wooden mine frame with a lantern.
    const en = this.lv.entrance;
    const ex = en.c + 0.5, ey = this.bottomOf(en.r);
    for (const s of [-1, 1]) part(g, geo.cyl('post', 0.09, 0.11, 1.9, 8), toon(0x9a6440), ex + s * 0.9, ey + 0.95, -0.7);
    part(g, geo.rbox('lintel', 2.2, 0.24, 0.3, 0.05), toon(0xb07a4a), ex, ey + 1.9, -0.7);
    part(g, geo.sph(0.14), basic(0xffe9a8), ex + 0.9, ey + 1.6, -0.45);
    // Exit: a glowing crystal door.
    const xc = this.lv.exit.c + 0.5, xy = this.bottomOf(this.lv.exit.r);
    const door = new THREE.Group();
    door.position.set(xc, xy, -0.7);
    const frame = toon(th.crystal[0], { emissive: 0x111133 });
    for (const s of [-1, 1]) part(door, geo.rbox('doorPost', 0.3, 1.5, 0.5, 0.08), frame, s * 0.72, 0.75, 0);
    const arch = part(door, sharedGeo('caveArch', () => new THREE.TorusGeometry(0.72, 0.16, 8, 20, Math.PI)), frame, 0, 1.5, 0);
    arch.castShadow = true;
    const glow = new THREE.Group();
    part(glow, sharedGeo('caveDoorGlow', () => new THREE.PlaneGeometry(1.14, 1.5)), basic(0xfff3b0), 0, 0.75, 0.05);
    part(glow, sharedGeo('caveDoorTop', () => new THREE.CircleGeometry(0.57, 20, 0, Math.PI)), basic(0xfff3b0), 0, 1.5, 0.05);
    door.add(glow);
    for (let k = 0; k < 3; k++) {
      const cr = part(door, geo.cone('doorCry', 0.16, 0.7, 6), toon(th.crystal[k % th.crystal.length], { emissive: 0x222244 }), (k - 1) * 0.3, 2.35 + (k === 1 ? 0.15 : 0), 0);
      cr.rotation.z = (1 - k) * 0.35;
    }
    g.add(door);
    this.door = { group: door, glow, x: xc, y: xy };
  }

  buildThings() {
    const lv = this.lv;
    const g = this.levelGroup;
    for (const s of lv.gems) {
      const x = s.c + 0.5, y = this.bottomOf(s.r) + 0.45;
      let mesh, value;
      if (s.kind === 'gem') {
        mesh = makeGem(GEM_COLORS[(s.c * 7 + s.r) % GEM_COLORS.length]);
        value = 3;
      } else {
        mesh = new THREE.Mesh(geo.nugget(), toon(COLORS.gold, { emissive: 0x332200 }));
        mesh.scale.setScalar(1.5);
        value = 1;
      }
      mesh.position.set(x, y, 0);
      g.add(mesh);
      this.pickups.push({ x, y, baseY: y, mesh, value, gem: s.kind === 'gem', taken: false, body: null });
    }
    for (const s of lv.crates) {
      const mesh = new THREE.Group();
      const box = part(mesh, geo.rbox('crate', 0.8, 0.7, 0.8, 0.06), toon(0xc98a4a), 0, 0.35, 0);
      box.castShadow = true;
      for (const by of [0.12, 0.58]) part(mesh, geo.rbox('crateBand', 0.84, 0.08, 0.84, 0.02), toon(0x8a5a34), 0, by, 0);
      const coil = part(mesh, sharedGeo('caveCoil', () => new THREE.TorusGeometry(0.12, 0.04, 6, 14)), toon(0xe8c07a), -0.15, 0.36, 0.42);
      coil.rotation.y = 0.2;
      part(mesh, geo.sph(0.1), toon(0xff7eb6), 0.16, 0.36, 0.42);
      mesh.position.set(s.c + 0.5, this.bottomOf(s.r), 0);
      g.add(mesh);
      this.crates.push({ x: s.c + 0.5, y: this.bottomOf(s.r), mesh, open: false });
    }
    for (const s of lv.snowballs) {
      const mesh = new THREE.Group();
      const ball = part(mesh, geo.sph(0.42, 16, 12), toon(COLORS.white), 0, 0, 0);
      ball.castShadow = true;
      for (const [x, y, z] of [[0.25, 0.2, 0.25], [-0.2, -0.1, 0.32], [0.05, 0.3, -0.25]]) part(mesh, geo.sph(0.12), toon(0xe6f4ff), x, y, z);
      g.add(mesh);
      const home = { x: s.c + 0.5, y: this.bottomOf(s.r) };
      this.snowballs.push({ home, mesh, body: { x: home.x, y: home.y, w: 0.8, h: 0.8, vx: 0, vy: 0 }, state: 'idle', t: 0, dir: 1, bounces: 0 });
    }
    this.puppy = null;
    if (lv.puppy) {
      const mesh = makePuppy();
      mesh.scale.setScalar(0.9);
      const heart = makeHeart();
      g.add(mesh, heart);
      this.puppy = { x: lv.puppy.c + 0.5, y: this.bottomOf(lv.puppy.r), mesh, heart, carrier: null, saved: false, t: 0 };
    }
  }

  /** Distance (in tiles, ignoring jumps) from every open cell to the exit: who is ahead. */
  computeDist() {
    const { W, H } = this.lv;
    const dist = new Int16Array(W * H).fill(-1);
    const start = this.lv.exit.r * W + this.lv.exit.c;
    dist[start] = 0;
    const q = [start];
    for (let h = 0; h < q.length; h++) {
      const i = q[h];
      for (const n of [i - 1, i + 1, i - W, i + W]) {
        if (n < 0 || n >= W * H || dist[n] >= 0 || SOLID[this.lv.grid[n]]) continue;
        dist[n] = dist[i] + 1;
        q.push(n);
      }
    }
    this.dist = dist;
  }

  distOf(b) {
    const c = Math.floor(b.x), r = this.rowAt(b.y + 0.5);
    const d = this.dist[r * this.lv.W + c];
    return d >= 0 ? d : 9999;
  }

  // ---------- players ----------

  leader() {
    let best = null, bd = Infinity;
    for (const e of this.ents) {
      if (e.state !== 'play') continue;
      const d = this.distOf(e.body) - e.body.y * 0.01;
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  bubbleUp(e, toExit = false) {
    if (e.state === 'done') return;
    if (e.state === 'bubble') { e.toExit = e.toExit || toExit; return; }
    e.state = 'bubble';
    e.t = 0;
    e.toExit = toExit;
    e.climbing = false;
    e.dizzy = 0;
    e.body.vx = e.body.vy = 0;
    e.bubble.visible = true;
    this.game.audio.play('bubble');
  }

  updatePlayers(dt) {
    const lead = this.leader();
    for (const e of this.ents) {
      const b = e.body;
      const inp = this.input(e.p) || NO_INPUT;
      e.invuln -= dt;
      if (e.state === 'bubble') this.updateBubble(e, dt, lead);
      else if (e.state === 'done') {
        e.t += dt;
        const k = Math.max(0, 1 - e.t * 2.5);
        b.x += (this.door.x - b.x) * Math.min(1, dt * 8);
        e.ch.group.scale.setScalar(BEAN_SCALE * k);
        e.ch.group.visible = k > 0;
      } else this.updateExplorer(e, dt, inp, lead);

      e.ch.faceSide(e.facing);
      if (e.climbing) e.ch.targetYaw = Math.PI;
      e.ch.group.position.set(b.x, b.y, 0);
      if (e.state === 'play') e.ch.group.visible = e.invuln <= 0 || Math.floor(this.time * 14) % 2 === 0;
      e.ch.pivot.rotation.z = e.dizzy > 0 ? Math.sin(this.time * 9) * 0.25 : 0;
      const moving = e.climbing ? Math.abs(b.vy) / CLIMB_SPEED : Math.min(1, Math.abs(b.vx) / PHYS.speed);
      e.ch.update(dt, { moving, grounded: b.grounded || e.climbing || e.state === 'bubble', vy: b.vy });
      e.stars.visible = e.dizzy > 0 && e.state === 'play';
      if (e.stars.visible) {
        e.stars.position.set(b.x, b.y + 1.15, 0);
        e.stars.rotation.y += dt * 6;
      }
      e.honey.visible = e.sticky > 0 && e.state === 'play';
      if (e.honey.visible) e.honey.position.set(b.x, b.y + 0.95, 0.15);
    }
  }

  updateBubble(e, dt, lead) {
    const b = e.body;
    e.t += dt;
    let tx, ty;
    if (e.toExit) { tx = this.door.x; ty = this.door.y + 0.6; } else if (lead) { tx = lead.lastSafe.x - 0.4 * Math.sign(lead.facing || 1); ty = lead.lastSafe.y + 1.2; } else { tx = e.lastSafe.x; ty = e.lastSafe.y + 1.2; }
    const dx = tx - b.x, dy = ty - b.y, d = Math.hypot(dx, dy);
    const sp = Math.min(d / dt, 7 + d * 2);
    if (d > 0.01) { b.x += (dx / d) * sp * dt; b.y += (dy / d) * sp * dt; }
    e.bubble.position.set(b.x, b.y + 0.45, 0.1);
    e.bubble.scale.setScalar(1 + Math.sin(this.time * 7) * 0.05);
    e.ch.spin += dt * 2;
    if (e.t > 0.8 && d < 0.5) {
      e.ch.spin = 0;
      e.bubble.visible = false;
      if (e.toExit && this.state === 'play') { e.state = 'play'; this.enterExit(e); return; }
      e.state = 'play';
      e.invuln = 1.2;
      b.vx = 0;
      b.vy = 3;
      e.peakY = b.y;
      this.puffs.burst(new THREE.Vector3(b.x, b.y + 0.5, 0.4), e.p.color, { count: 10, size: 0.28 });
      this.game.audio.play('pop');
    }
  }

  updateExplorer(e, dt, inp, lead) {
    const b = e.body;
    const playing = this.state === 'play';
    e.dizzy -= dt;
    e.stun -= dt;
    e.sticky -= dt;
    e.regrab -= dt;
    const free = playing && e.dizzy <= 0 && e.stun <= 0;
    const ctrl = free ? inp : NO_INPUT;
    const feet = this.tileAtXY(b.x, b.y + 0.2);
    if (feet === TL.HONEY) {
      if (e.sticky <= 0) { this.game.audio.play('trap'); this.puffs.burst(new THREE.Vector3(b.x, b.y + 0.3, 0.4), 0xffb627, { count: 6, size: 0.22 }); }
      e.sticky = HONEY_TIME;
    }
    const slow = e.sticky > 0 ? 0.42 : feet === TL.MUD ? 0.5 : 1;
    if (Math.abs(ctrl.x) > 0.2 && !e.climbing) e.facing = Math.sign(ctrl.x);

    // Grab ladders, vines and ropes with up (or down from the top of one).
    if (!e.climbing && free && e.regrab <= 0) {
      if (ctrl.y > 0.5 && this.climbAt(b.x, b.y + b.h * 0.5)) this.startClimb(e);
      else if (ctrl.y < -0.5 && b.grounded && this.climbAt(b.x, b.y - 0.15)) this.startClimb(e);
    }
    if (e.climbing) this.climb(e, dt, ctrl, slow);
    else {
      const j = platformerControl(b, { x: ctrl.x * slow, y: ctrl.y, a: ctrl.a, aPressed: ctrl.aPressed }, dt, PHYS);
      if (j) { e.ch.squash(1.3); this.game.audio.play('jump'); }
      moveBody(b, dt, this.solidsNear(b));
      if (!b.grounded) e.peakY = Math.max(e.peakY, b.y);
      if (b.justLanded) {
        const drop = e.peakY - b.y;
        const soft = b.ground?.spring || feet === TL.MUD || feet === TL.HONEY || this.tileAtXY(b.x, b.y + 0.2) === TL.HONEY || this.tileAtXY(b.x, b.y + 0.2) === TL.MUD;
        if (drop > DIZZY_FALL && !soft) {
          e.dizzy = 1.3;
          e.ch.squash(0.55);
          b.vx = 0;
          this.game.audio.play('dizzy');
          this.puffs.burst(new THREE.Vector3(b.x, b.y + 0.2, 0.4), 0xffffff, { count: 8, size: 0.3 });
        } else {
          e.ch.squash(0.75);
          if (drop > 2.5) this.game.audio.play('land');
        }
      }
      if (b.grounded) {
        e.peakY = b.y;
        const g = b.ground;
        if (g?.spring && ctrl.y > -0.5) {
          // Bouncy mushroom (hold down to land on it softly).
          b.vy = SPRING;
          b.grounded = false;
          e.ch.squash(1.45);
          this.game.audio.play('boing');
          const mm = this.mushMeshes.get(g.cell);
          if (mm) mm.squish = 1;
        } else if (g && !g.oneWay && e.sticky <= 0) {
          e.lastSafe = { x: b.x, y: b.y };
        }
      }
    }
    if (free) {
      if (ctrl.cPressed) this.throwBomb(e, ctrl);
      else if (ctrl.bPressed) this.throwRope(e, ctrl);
    }
    if (!playing) return;
    // Stragglers who drop off the shared screen float back to the group.
    const half = this.viewHalfSize(this.camDist);
    // (The camera always follows whoever is furthest along, so they never bubble.)
    if (e !== lead && (Math.abs(b.x - this.camX) > half.w + 0.6 || Math.abs(b.y + 0.4 - this.camY) > half.h + 0.8)) this.bubbleUp(e);
    else if (Math.abs(b.x - this.door.x) < 0.6 && b.y > this.door.y - 0.3 && b.y < this.door.y + 1.2) this.enterExit(e);
  }

  startClimb(e) {
    e.climbing = true;
    e.climbCol = Math.floor(e.body.x);
    e.body.vx = e.body.vy = 0;
    e.peakY = e.body.y;
  }

  climb(e, dt, ctrl, slow) {
    const b = e.body;
    const c = e.climbCol;
    b.x += (c + 0.5 - b.x) * Math.min(1, dt * 14);
    if (ctrl.aPressed) {
      // Jump off (down + A just lets go).
      e.climbing = false;
      e.regrab = 0.3;
      b.vy = ctrl.y < -0.5 ? 0 : PHYS.jump;
      b.vx = ctrl.x * PHYS.speed;
      b.buffer = 0;
      b.coyote = 0;
      if (b.vy > 0) { e.ch.squash(1.3); this.game.audio.play('jump'); }
      return;
    }
    if (Math.abs(ctrl.x) > 0.5 && Math.abs(ctrl.y) < 0.4) {
      // Step off sideways with a tiny hop.
      e.climbing = false;
      e.regrab = 0.25;
      b.vy = 4;
      b.vx = Math.sign(ctrl.x) * PHYS.speed * 0.8;
      e.facing = Math.sign(ctrl.x);
      return;
    }
    b.vx = 0;
    b.vy = ctrl.y * CLIMB_SPEED * Math.max(0.6, slow);
    b.dropTimer = 0.1; // pass through ladder tops and ledges while climbing
    // Still on it if the middle of the body or the feet touch a climbable cell.
    const onIt = () => this.climbAt(c + 0.5, b.y + b.h * 0.5) || this.climbAt(c + 0.5, b.y - 0.1);
    if (!onIt()) { e.climbing = false; e.regrab = 0.15; return; }
    const rc = this.climbAt(c + 0.5, b.y + b.h * 0.5) ? this.rowAt(b.y + b.h * 0.5) : this.rowAt(b.y - 0.1);
    let rTop = rc;
    while (this.climbAt(c + 0.5, this.bottomOf(rTop - 1) + 0.5)) rTop--;
    const topY = this.bottomOf(rTop) + 1;
    const standTop = CLIMBY[this.tile(c, rTop)] && this.passable(c, rTop - 1);
    const feetMax = standTop ? topY : topY - b.h * 0.5 - 0.02;
    moveBody(b, dt, this.solidsNear(b));
    if (ctrl.y > 0 && b.y >= feetMax) {
      b.y = feetMax;
      b.vy = 0;
      if (standTop) { e.climbing = false; e.regrab = 0.2; b.grounded = true; b.dropTimer = 0; e.lastSafe = { x: b.x, y: b.y }; }
    }
    if (e.climbing && b.grounded && ctrl.y < 0) e.climbing = false;
    if (e.climbing && !onIt()) { e.climbing = false; e.regrab = 0.15; }
  }

  // ---------- ropes and bombs ----------

  throwRope(e, ctrl) {
    if (e.ropes <= 0) { this.game.audio.play('bump'); this.game.ui.toast(t('cave.noRopes'), 900); return; }
    const b = e.body;
    const c = Math.floor(b.x), r = this.rowAt(b.y + 0.4);
    let tc = -1, tr = -1;
    if (ctrl.y < -0.5 && (b.grounded || e.climbing)) {
      // Down + B at a ledge: hang the rope over the edge in front of you.
      const fc = c + e.facing;
      if (this.passable(fc, r) && this.passable(fc, r + 1)) { tc = fc; tr = r; }
    }
    if (tc < 0) {
      tc = c; tr = r;
      for (let i = 0; i < 6 && this.passable(c, tr - 1); i++) tr--;
    }
    let br = tr;
    while (br - tr < ROPE_LEN - 1 && this.passable(tc, br + 1)) br++;
    e.ropes--;
    e.ropesUsed++;
    const len = br - tr + 1;
    const mesh = new THREE.Group();
    const top = this.bottomOf(tr) + 1;
    mesh.position.set(tc + 0.5, top, -0.15);
    const cord = part(mesh, geo.cyl('rope', 0.06, 0.06, 1, 6), toon(0xe8c07a), 0, -0.5, 0);
    const hook = part(mesh, sharedGeo('caveHook', () => new THREE.TorusGeometry(0.13, 0.045, 6, 12)), toon(e.p.color), 0, -0.05, 0);
    hook.rotation.x = Math.PI / 2;
    this.levelGroup.add(mesh);
    const knots = [];
    for (let k = 1; k < len; k++) knots.push(part(mesh, geo.sph(0.09), toon(0xd9a66b), 0, -k, 0));
    const rope = { c: tc, r0: tr, r1: br, len, mesh, cord, knots, t: 0, live: false };
    this.ropes.push(rope);
    this.game.audio.play('whoosh');
    this.puffs.burst(new THREE.Vector3(tc + 0.5, top - 0.2, 0.2), 0xe8c07a, { count: 5, size: 0.2 });
  }

  updateRopes(dt) {
    for (const rope of this.ropes) {
      if (rope.live) continue;
      rope.t += dt;
      const k = Math.min(1, rope.t / 0.3);
      rope.cord.scale.y = rope.len * k;
      rope.cord.position.y = -rope.len * k / 2;
      rope.knots.forEach((kn, i) => { kn.visible = i + 1 <= rope.len * k; });
      if (k >= 1) {
        rope.live = true;
        for (let r = rope.r0; r <= rope.r1; r++) this.ropeCells.add(r * this.lv.W + rope.c);
      }
    }
  }

  throwBomb(e, ctrl) {
    if (e.bombs <= 0) { this.game.audio.play('bump'); this.game.ui.toast(t('cave.noBombs'), 900); return; }
    e.bombs--;
    e.bombsUsed++;
    const b = e.body;
    const up = ctrl.y > 0.5, down = ctrl.y < -0.5;
    const mesh = new THREE.Group();
    const ball = part(mesh, geo.sph(0.25, 16, 12), toon(0xff7eb6), 0, 0, 0);
    ball.castShadow = true;
    part(mesh, geo.sph(0.07), toon(COLORS.white), -0.09, 0.1, 0.18);
    part(mesh, geo.cyl('fuse', 0.03, 0.03, 0.16, 5), toon(COLORS.ink), 0, 0.3, 0);
    const spark = part(mesh, geo.sph(0.07), basic(0xffe14d), 0, 0.4, 0);
    this.levelGroup.add(mesh);
    this.bombs.push({
      owner: e, mesh, ball, spark, fuse: BOMB_FUSE,
      body: { x: b.x + e.facing * 0.25, y: b.y + 0.45, w: 0.4, h: 0.4, vx: down ? 0 : e.facing * (up ? 2.5 : 7) + b.vx * 0.3, vy: up ? 11 : down ? 0 : 5 },
    });
    this.game.audio.play('dash');
  }

  updateBombs(dt) {
    for (const bomb of this.bombs) {
      const b = bomb.body;
      b.vy = Math.max(-18, b.vy - 30 * dt);
      const vxBefore = b.vx, vyBefore = b.vy;
      moveBody(b, dt, this.solidsNear(b));
      if (b.wallHit) b.vx = -vxBefore * 0.6;
      if (b.grounded) {
        if (vyBefore < -4) { b.vy = -vyBefore * 0.4; b.grounded = false; } else b.vx *= Math.max(0, 1 - dt * 6);
      }
      bomb.fuse -= dt;
      const pulse = 1 + Math.sin((BOMB_FUSE - bomb.fuse) * (10 + (BOMB_FUSE - bomb.fuse) * 14)) * 0.08;
      bomb.ball.scale.setScalar(pulse);
      bomb.spark.visible = Math.floor(this.time * 20) % 2 === 0;
      bomb.mesh.position.set(b.x, b.y + 0.22, 0.2);
      if (bomb.fuse <= 0) this.popBomb(bomb);
    }
    this.bombs = this.bombs.filter((bm) => bm.fuse > 0);
  }

  popBomb(bomb) {
    const { W, H } = this.lv;
    const cx = bomb.body.x, cy = bomb.body.y + 0.2;
    this.levelGroup.remove(bomb.mesh);
    let broke = 0;
    for (let r = this.rowAt(cy + 2); r <= this.rowAt(cy - 2); r++) {
      for (let c = Math.floor(cx - 2); c <= Math.floor(cx + 2); c++) {
        if (r <= 0 || c <= 0 || r >= H - 1 || c >= W - 1) continue;
        const i = r * W + c;
        if (!BREAKABLE[this.lv.grid[i]] || this.protect.has(i)) continue;
        if (Math.hypot(c + 0.5 - cx, this.bottomOf(r) + 0.5 - cy) > BOMB_R) continue;
        this.breakTile(i, bomb.owner);
        broke++;
      }
    }
    if (broke) this.computeDist();
    const pos = new THREE.Vector3(cx, cy, 0.5);
    this.puffs.burst(pos, 0xff9fd0, { count: 18, size: 0.5, speed: 4 });
    this.confetti.burst(pos, 0, { count: 22, speed: 6, colors: [0xff7eb6, 0xffffff, this.theme.dirt[0]], size: 0.16, life: 0.9 });
    this.game.audio.play('pop');
    // Harmless: players just get bounced away.
    for (const e of this.ents) {
      if (e.state !== 'play') continue;
      const dx = e.body.x - cx, dy = e.body.y + 0.4 - cy, d = Math.hypot(dx, dy);
      if (d > 2.6) continue;
      e.climbing = false;
      e.body.vx = (dx / (d || 1)) * 7 + (dx >= 0 ? 1 : -1);
      e.body.vy = Math.max(e.body.vy, 8);
      e.body.grounded = false;
      e.stun = 0.25;
      e.ch.squash(1.4);
      this.game.audio.play('boing');
    }
    for (const sb of this.snowballs) if (sb.state !== 'gone' && Math.hypot(sb.body.x - cx, sb.body.y + 0.4 - cy) < 2.2) this.meltSnowball(sb);
    for (const cr of this.crates) if (!cr.open && Math.hypot(cr.x - cx, cr.y + 0.35 - cy) < 2) this.openCrate(cr, bomb.owner);
  }

  breakTile(i, owner) {
    const { W } = this.lv;
    const c = i % W, r = Math.floor(i / W);
    const wasGold = this.lv.grid[i] === TL.GOLD;
    this.lv.grid[i] = TL.EMPTY;
    this.rects[i] = null;
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    if (this.tileInst[i] >= 0) { this.tileMesh.setMatrixAt(this.tileInst[i], zero); this.tileMesh.instanceMatrix.needsUpdate = true; this.tileInst[i] = -1; }
    if (this.topInst[i] >= 0) { this.topMesh.setMatrixAt(this.topInst[i], zero); this.topMesh.instanceMatrix.needsUpdate = true; this.topInst[i] = -1; }
    // The tile below now has an open top.
    const below = i + W;
    if (SOLID[this.lv.grid[below]] && this.lv.grid[below] !== TL.MUSH) this.addTop(below);
    // Ladder/vine tops may have changed.
    if (r > 0) this.rects[i - W] = this.makeRect(c, r - 1);
    this.rects[below] = this.makeRect(c, r + 1);
    const x = c + 0.5, y = this.bottomOf(r) + 0.5;
    this.puffs.burst(new THREE.Vector3(x, y, 0.6), this.theme.dirt[1], { count: 3, size: 0.4, life: 0.5 });
    if (wasGold) {
      for (const n of this.nuggetMeshes.get(i) || []) this.levelGroup.remove(n);
      this.nuggetMeshes.delete(i);
      for (let k = 0; k < 2; k++) {
        const mesh = new THREE.Mesh(geo.nugget(), toon(COLORS.gold, { emissive: 0x332200 }));
        mesh.scale.setScalar(1.5);
        this.levelGroup.add(mesh);
        this.pickups.push({ x, y, baseY: y, mesh, value: 1, gem: false, taken: false, body: { x: x + (k - 0.5) * 0.3, y: y - 0.3, w: 0.3, h: 0.3, vx: (k - 0.5) * 3, vy: 5 } });
      }
    }
  }

  // ---------- things in the cave ----------

  updatePickups(dt) {
    for (const pk of this.pickups) {
      if (pk.taken) continue;
      if (pk.body) {
        const b = pk.body;
        b.vy = Math.max(-15, b.vy - 30 * dt);
        moveBody(b, dt, this.solidsNear(b));
        if (b.grounded) b.vx *= Math.max(0, 1 - dt * 8);
        pk.x = b.x;
        pk.y = b.y + 0.2;
        pk.mesh.position.set(pk.x, pk.y, 0);
      } else {
        pk.mesh.position.y = pk.baseY + Math.sin(this.time * 3 + pk.x) * 0.08;
      }
      pk.mesh.rotation.y += dt * 2.5;
      for (const e of this.ents) {
        if (e.state !== 'play') continue;
        const b = e.body;
        if (Math.abs(b.x - pk.x) < 0.6 && pk.y > b.y - 0.3 && pk.y < b.y + b.h + 0.3) {
          pk.taken = true;
          this.levelGroup.remove(pk.mesh);
          e.gems += pk.value;
          this.teamGems += pk.value;
          this.game.audio.play('coin');
          this.confetti.burst(new THREE.Vector3(pk.x, pk.y, 0.4), 0, { count: pk.gem ? 12 : 6, speed: 4, size: 0.11, colors: pk.gem ? GEM_COLORS : [COLORS.gold, COLORS.white] });
          break;
        }
      }
    }
  }

  openCrate(cr, e) {
    cr.open = true;
    this.levelGroup.remove(cr.mesh);
    e.ropes = Math.min(MAX_ITEMS, e.ropes + 2);
    e.bombs = Math.min(MAX_ITEMS, e.bombs + 2);
    this.game.audio.play('star');
    this.puffs.burst(new THREE.Vector3(cr.x, cr.y + 0.4, 0.4), 0xc98a4a, { count: 10, size: 0.35 });
    this.confetti.burst(new THREE.Vector3(cr.x, cr.y + 0.6, 0.4), 0, { count: 18, speed: 5, colors: [0xe8c07a, 0xff7eb6, COLORS.gold] });
    this.game.ui.toast(t('cave.crate', { name: e.p.name }), 1300);
  }

  updateCrates() {
    for (const cr of this.crates) {
      if (cr.open) continue;
      for (const e of this.ents) {
        if (e.state !== 'play') continue;
        if (Math.abs(e.body.x - cr.x) < 0.7 && e.body.y < cr.y + 0.75 && e.body.y + e.body.h > cr.y) { this.openCrate(cr, e); break; }
      }
    }
  }

  meltSnowball(sb) {
    sb.state = 'gone';
    sb.t = 0;
    sb.mesh.visible = false;
    this.puffs.burst(new THREE.Vector3(sb.body.x, sb.body.y + 0.4, 0.4), 0xffffff, { count: 10, size: 0.35 });
  }

  updateSnowballs(dt) {
    for (const sb of this.snowballs) {
      const b = sb.body;
      if (sb.state === 'gone') {
        sb.t += dt;
        const near = this.ents.some((e) => e.state === 'play' && Math.abs(e.body.x - sb.home.x) < 4 && Math.abs(e.body.y - sb.home.y) < 3);
        if (sb.t > 6 && !near) {
          sb.state = 'idle';
          b.x = sb.home.x; b.y = sb.home.y; b.vx = b.vy = 0;
          sb.mesh.visible = true;
          sb.mesh.scale.setScalar(0.01);
        }
        continue;
      }
      if (sb.mesh.scale.x < 1) sb.mesh.scale.setScalar(Math.min(1, sb.mesh.scale.x + dt * 3));
      if (sb.state === 'idle') {
        for (const e of this.ents) {
          if (e.state !== 'play') continue;
          const dx = e.body.x - b.x;
          if (Math.abs(dx) < 8 && Math.abs(e.body.y - b.y) < 2.5) {
            sb.state = 'roll';
            sb.dir = Math.sign(dx) || 1;
            sb.t = 0;
            sb.bounces = 0;
            break;
          }
        }
      }
      if (sb.state === 'roll') {
        sb.t += dt;
        b.vx = sb.dir * 3.4;
        b.vy = Math.max(-16, b.vy - 30 * dt);
        moveBody(b, dt, this.solidsNear(b));
        if (b.wallHit) { sb.dir = -sb.dir; sb.bounces++; }
        if (sb.t > 9 || sb.bounces >= 3 || this.tileAtXY(b.x, b.y + 0.2) === TL.HONEY || this.tileAtXY(b.x, b.y + 0.2) === TL.MUD) { this.meltSnowball(sb); continue; }
        sb.mesh.rotation.z -= (b.vx * dt) / 0.42;
        for (const e of this.ents) {
          if (e.state !== 'play' || e.invuln > 0) continue;
          const pb = e.body;
          if (Math.abs(pb.x - b.x) > 0.7 || pb.y > b.y + 0.85 || pb.y + pb.h < b.y) continue;
          if (pb.vy < 0 && pb.y > b.y + 0.45) {
            // Stomp: the snowball poofs and you bounce.
            pb.vy = 10;
            e.ch.squash(1.3);
            this.game.audio.play('boing');
            this.meltSnowball(sb);
            break;
          }
          e.climbing = false;
          pb.vx = sb.dir * 8;
          pb.vy = 6;
          e.stun = 0.4;
          e.invuln = 1.0;
          this.game.audio.play('bump');
        }
      }
      sb.mesh.position.set(b.x, b.y + 0.42, 0);
    }
  }

  updatePuppy(dt) {
    const pup = this.puppy;
    if (!pup || pup.saved) return;
    pup.t += dt;
    pup.mesh.userData.tail.rotation.z = 0.6 + Math.sin(this.time * (pup.carrier ? 18 : 10)) * 0.5;
    if (pup.carrier) {
      const e = pup.carrier;
      const b = e.body;
      pup.mesh.visible = e.state !== 'done' || e.t < 0.3;
      pup.mesh.position.set(b.x - e.facing * 0.05, b.y + 0.95 * (e.state === 'done' ? Math.max(0, 1 - e.t * 2.5) : 1), 0.1);
      pup.mesh.rotation.y = e.facing > 0 ? -0.5 : Math.PI + 0.5;
      pup.heart.visible = false;
      return;
    }
    pup.mesh.position.set(pup.x, pup.y + Math.abs(Math.sin(pup.t * 4)) * 0.12, 0);
    pup.mesh.rotation.y = Math.sin(pup.t * 0.7) > 0 ? -0.5 : Math.PI + 0.5;
    pup.heart.position.set(pup.x, pup.y + 1.25 + Math.sin(pup.t * 3) * 0.1, 0.2);
    pup.heart.rotation.y = pup.t * 2;
    for (const e of this.ents) {
      if (e.state !== 'play') continue;
      if (Math.abs(e.body.x - pup.x) < 0.75 && Math.abs(e.body.y - pup.y) < 0.9) {
        pup.carrier = e;
        this.game.audio.play('rescue');
        this.confetti.burst(new THREE.Vector3(pup.x, pup.y + 0.8, 0.4), 0, { count: 16, speed: 4, colors: [0xff5d73, 0xff9fd0, COLORS.white] });
        this.game.ui.toast(t('cave.puppyFound', { name: e.p.name }), 2000);
        break;
      }
    }
  }

  // ---------- exits and depths ----------

  enterExit(e) {
    if (e.state === 'done') return;
    e.state = 'done';
    e.t = 0;
    e.climbing = false;
    e.bubble.visible = false;
    e.body.vx = e.body.vy = 0;
    this.game.audio.play('star');
    this.confetti.burst(new THREE.Vector3(this.door.x, this.door.y + 1.2, 0.3), 0, { count: 24, speed: 6, colors: [e.p.color, COLORS.gold, COLORS.white] });
    const pup = this.puppy;
    if (pup && pup.carrier === e && !pup.saved) {
      pup.saved = true;
      pup.mesh.visible = false;
      e.pups++;
      this.puppiesSaved++;
      this.teamGems += PUPPY_BONUS;
      e.gems += Math.ceil(PUPPY_BONUS / 3);
      this.game.audio.play('rescue');
      this.game.ui.toast(t('cave.puppySaved', { n: PUPPY_BONUS }), 2000);
    }
    if (this.exitTimer === null) {
      this.exitTimer = EXIT_WAIT;
      if (this.ents.length > 1 && this.ents.some((x) => x.state !== 'done')) this.game.ui.banner(t('cave.exitOpen', { name: e.p.name }), t('cave.everyone'), 1500);
    }
    if (this.ents.every((x) => x.state === 'done')) this.depthCleared();
  }

  gatherToExit() {
    for (const e of this.ents) if (e.state !== 'done') this.bubbleUp(e, true);
  }

  depthCleared() {
    if (this.cleared) return;
    this.cleared = true;
    this.depthsDone = this.depth + 1;
    this.exitTimer = null;
    this.later(1.1, () => {
      if (this.state === 'results') return;
      if (this.depth + 1 >= DEPTHS.length) { this.end(); return; }
      this.state = 'between';
      this.game.ui.wipe();
      this.later(0.45, () => {
        this.buildDepth(this.depth + 1);
        this.updateCamera(1, true);
        this.state = 'play';
        this.game.audio.play('go');
        this.game.ui.banner(`${t('cave.depth', { n: this.depth + 1, total: DEPTHS.length })}`, t(this.theme.name), 1600);
      });
    });
  }

  updateFlow(dt) {
    if (this.cleared) return;
    this.depthTime += dt;
    if (this.exitTimer !== null) {
      this.exitTimer -= dt;
      if (this.exitTimer <= 0) { this.exitTimer = 0; this.gatherToExit(); }
    }
    if (this.depthTime > this.hintTime) this.updateHint(dt);
    if (!this.rescueOn && this.depthTime > this.rescueTime) {
      this.rescueOn = true;
      this.game.ui.toast(t('cave.rescue'), 2200);
      this.gatherToExit();
    }
  }

  /** After a while, sparkles show the way from whoever is ahead to the exit. */
  updateHint(dt) {
    if (!this.hint) {
      this.hint = { t: 0, dots: [] };
      this.game.ui.toast(t('cave.hint'), 2200);
    }
    this.hint.t -= dt;
    if (this.hint.t <= 0) {
      this.hint.t = 3;
      for (const d of this.hint.dots) this.levelGroup.remove(d);
      this.hint.dots = [];
      const lead = this.leader();
      if (!lead) return;
      const b = lead.body;
      const from = this.rowAt(b.y + 0.5) * this.lv.W + Math.floor(b.x);
      const route = routeToExit(this.lv, from, this.ropeCells);
      for (const step of route) {
        const c = step.idx % this.lv.W, r = Math.floor(step.idx / this.lv.W);
        const dot = new THREE.Mesh(geo.sph(0.14), basic(0xfff3b0));
        dot.position.set(c + 0.5, this.bottomOf(r) + 0.4, 0.6);
        this.levelGroup.add(dot);
        this.hint.dots.push(dot);
      }
    }
    this.hint.dots.forEach((d, i) => d.scale.setScalar(0.7 + Math.abs(Math.sin(this.time * 4 - i * 0.5)) * 0.8));
  }

  // ---------- camera, world animation, results ----------

  updateCamera(dt, snap = false) {
    const act = this.ents.filter((e) => e.state === 'play');
    const lead = this.leader();
    let minX, maxX, minY, maxY;
    if (act.length) {
      minX = Math.min(...act.map((e) => e.body.x)); maxX = Math.max(...act.map((e) => e.body.x));
      minY = Math.min(...act.map((e) => e.body.y)); maxY = Math.max(...act.map((e) => e.body.y));
    } else {
      minX = maxX = this.door.x; minY = maxY = this.door.y;
    }
    const minDist = this.fitDistance(22, 12.5), maxDist = this.fitDistance(30, 17);
    const want = THREE.MathUtils.clamp(this.fitDistance(maxX - minX + 9, maxY - minY + 7), minDist, maxDist);
    this.camDist = snap ? want : THREE.MathUtils.lerp(this.camDist, want, Math.min(1, dt * 2));
    const half = this.viewHalfSize(this.camDist);
    let cx = (minX + maxX) / 2, cy = (minY + maxY) / 2 - 1.2; // look a little below: we're heading down
    // If the group is too spread out, follow whoever is furthest along.
    if (lead && (maxX - minX > half.w * 2 - 3 || maxY - minY > half.h * 2 - 3)) { cx = lead.body.x; cy = lead.body.y - 1.2; }
    const { W, H } = this.lv;
    cx = W > half.w * 2 ? THREE.MathUtils.clamp(cx, half.w, W - half.w) : W / 2;
    cy = H > half.h * 2 ? THREE.MathUtils.clamp(cy, half.h, H - half.h) : H / 2;
    const k = snap ? 1 : Math.min(1, dt * 3);
    this.camX = THREE.MathUtils.lerp(this.camX, cx, k);
    this.camY = THREE.MathUtils.lerp(this.camY, cy, snap ? 1 : Math.min(1, dt * (cy < this.camY ? 6 : 3)));
    // Never let whoever is in front drop out of the bottom of the screen.
    if (lead) this.camY = Math.min(this.camY, Math.max(lead.body.y + half.h - 2.2, cy));
    this.camera.position.set(this.camX, this.camY + 0.6, this.camDist);
    this.camera.lookAt(this.camX, this.camY, 0);
    this.sun.position.set(this.camX - 12, this.camY + 24, 22);
    this.sun.target.position.set(this.camX, this.camY, 0);
    this.confettiOrigin = new THREE.Vector3(this.camX, this.camY, 0);
  }

  animateWorld(dt) {
    for (const mm of this.mushMeshes.values()) {
      if (mm.squish <= 0) continue;
      mm.squish = Math.max(0, mm.squish - dt * 4);
      const k = 1 - Math.sin(mm.squish * Math.PI) * 0.35;
      mm.mesh.scale.set(0.55 * (2 - k), 0.55 * k, 0.55 * (2 - k));
    }
    if (this.door) {
      const s = 1 + Math.sin(this.time * 3) * 0.04;
      this.door.glow.scale.set(s, s, 1);
      if (Math.random() < dt * 4) this.confetti.burst(new THREE.Vector3(this.door.x + (Math.random() - 0.5) * 1.2, this.door.y + Math.random() * 1.8, 0), 0, { count: 1, speed: 0.6, up: 1, gravity: 0.5, life: 1.2, size: 0.1, colors: [0xfff3b0, this.theme.glow] });
    }
  }

  hudHtml() {
    const parts = [`<div class="pill hud-title">${t('cave.depth', { n: this.depth + 1, total: DEPTHS.length })} · ${esc(t(this.theme.name))}</div>`,
      `<div class="pill">${t('cave.team')} <b>${this.teamGems}</b></div>`];
    if (this.puppy?.carrier && !this.puppy.saved) parts.push(`<div class="pill">${t('cave.puppyHud', { name: esc(this.puppy.carrier.p.name) })}</div>`);
    if (this.exitTimer !== null && !this.cleared && this.ents.length > 1) parts.push(`<div class="pill">${t('cave.closes')} <b class="big-num" style="font-size:1.3em">${Math.ceil(this.exitTimer)}</b></div>`);
    return parts.join('');
  }

  chip(e) {
    const rope = '<span style="display:inline-block;width:0.32em;height:0.95em;border-radius:0.2em;background:#e8c07a;margin:0 0.2em 0 0.5em;vertical-align:-0.1em"></span>';
    const bomb = '<span style="display:inline-block;width:0.75em;height:0.75em;border-radius:50%;background:#ff7eb6;margin:0 0.2em 0 0.5em"></span>';
    return `${e.gems}${rope}${e.ropes}${bomb}${e.bombs}`;
  }

  end() {
    if (this.state === 'results') return;
    const ranked = [...this.ents].sort((a, b) => b.gems - a.gems);
    this.finish({
      title: t('cave.done'),
      subtitle: t('cave.sub', { gems: this.teamGems, depth: Math.max(1, this.depthsDone), total: DEPTHS.length, pups: this.puppiesSaved }),
      rows: ranked.map((e, i) => ({
        css: e.p.css, name: e.p.name, value: t('cave.gems', { n: e.gems }),
        detail: t('cave.ropesUsed', { n: e.ropesUsed }) + (e.pups ? ` · ${e.pups === 1 ? t('cave.pup1') : t('cave.pupN', { n: e.pups })}` : ''),
        crown: i === 0 && e.gems > 0,
      })),
      stars: 3,
    });
  }

  /** Story campaign hook: how the team did. */
  campaignStats() {
    return { gems: this.teamGems, depth: this.depthsDone, depths: DEPTHS.length, players: this.ents.length };
  }

  update(dt) {
    if (this.state === 'leaving') return;
    this.animateWorld(dt);
    if (this.state !== 'between') this.updatePlayers(dt);
    this.updateCamera(dt);
    this.updatePuppy(dt);
    if (this.updateResults(dt)) return;
    if (this.state === 'play') {
      this.updateRopes(dt);
      this.updateBombs(dt);
      this.updateSnowballs(dt);
      this.updatePickups(dt);
      this.updateCrates(dt);
      this.updateFlow(dt);
    }
    if (this.state === 'play' || this.state === 'between') {
      this.game.ui.setTop(this.hudHtml());
      this.game.ui.bar(this.players, (p) => this.chip(this.ents.find((e) => e.p === p)));
    }
  }
}
