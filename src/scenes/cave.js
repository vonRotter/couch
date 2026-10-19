import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { MiniGame } from '../core/minigame.js';
import { t, addStrings } from '../core/i18n.js';
import { Character } from '../core/character.js';
import { COLORS, PLAYER_COLORS, toon, basic, sharedGeo, faceted } from '../core/palette.js';
import { addLights, skyTexture, makeGem, makeMushroom, makeStar, seeded } from '../core/world.js';
import { moveBody, platformerControl } from '../core/physics2d.js';
import { esc } from '../core/ui.js';
import { makeGrumble } from '../core/critters.js';

addStrings({
  en: {
    'game.cave': 'Crystal Caves',
    'cave.intro': 'Dig down to the glowing door together! [A] jump · up/down climb · [B] rope · [C] pop bomb · 3 hearts each: mind the spikes!',
    'cave.tip': 'Spikes, goo, critters and long falls cost a heart. Hop on critters to make them dizzy, and use ropes to climb down!',
    'cave.ghost': '{name} is a ghost until the next cave!',
    'cave.allGhosts': 'Everyone is a ghost!', 'cave.tryAgain': 'A fresh cave and full hearts. Try again!',
    'cave.revive': 'The ghosts are back with full hearts!',
    'cave.heart': '{name}: +1 heart',
    'cave.crateHeart': '{name}: +2 ropes, +2 bombs, +1 heart',
    'cave.ghosted': 'ghost {n}×',
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
    'cave.hint': 'Follow the sparkles: they show a safe way to the exit!',
    'cave.rescue': 'The cave fairies carry everyone to the exit!',
    'cave.done': 'Cave explorers!',
    'cave.sub': 'Team gems: {gems} · Depth reached: {depth} of {total} · Puppies rescued: {pups}',
    'cave.gems': '{n} gems',
    'cave.ropesUsed': '{n} ropes used',
    'cave.pup1': 'rescued a puppy', 'cave.pupN': 'rescued {n} puppies',
  },
  no: {
    'game.cave': 'Krystallgrottene',
    'cave.intro': 'Grav dere ned til den lysende døra sammen! [A] hopp · opp/ned klatre · [B] tau · [C] poppbombe · 3 hjerter hver: pass dere for piggene!',
    'cave.tip': 'Pigger, slim, kryp og lange fall koster et hjerte. Hopp på krypene så blir de svimle, og bruk tau for å klatre ned!',
    'cave.ghost': '{name} er et spøkelse til neste grotte!',
    'cave.allGhosts': 'Alle er spøkelser!', 'cave.tryAgain': 'Ny grotte og fulle hjerter. Prøv igjen!',
    'cave.revive': 'Spøkelsene er tilbake med fulle hjerter!',
    'cave.heart': '{name}: +1 hjerte',
    'cave.crateHeart': '{name}: +2 tau, +2 bomber, +1 hjerte',
    'cave.ghosted': 'spøkelse {n}×',
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
    'cave.hint': 'Følg glitteret: det viser en trygg vei til utgangen!',
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
// Dangers (spikes, hot goo, crumbly floors) are then added one at a time, and each one is kept
// only if the model still finds a route to the exit that never touches a danger or falls too far.
// Moving dangers (stalactites, bats, grumbles, pea plants, boulders) are placed so you can always
// dodge them: hop over, wait for them or stomp them.

// ---------- tiles and rooms ----------

const RW = 10, RH = 8; // room size in tiles
export const DEPTHS = [{ cols: 4, rows: 4 }, { cols: 4, rows: 5 }, { cols: 5, rows: 5 }];
export const TL = { EMPTY: 0, DIRT: 1, ROCK: 2, LADDER: 3, VINE: 4, PLAT: 5, GOLD: 6, MUD: 7, HONEY: 8, MUSH: 9, SPIKE: 10, CSPIKE: 11, GOO: 12, CRUMB: 13 };
const SOLID = [false, true, true, false, false, false, true, false, false, true, false, false, false, true];
const CLIMBY = [false, false, false, true, true, false, false, false, false, false, false, false, false, false];
const BREAKABLE = [false, true, false, false, false, false, true, false, false, false, true, true, false, true];
// Cells that cost a heart: floor spikes, ceiling spikes and hot goo / icy water.
const HAZ = [false, false, false, false, false, false, false, false, false, false, true, true, true, false];
const SAFE_DROP = 8; // longest fall (in rows) the solvability model may use; real falls hurt above HURT_FALL

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
    ['###.H..###', '#...H..*.#', '#.$.H....#', '#.##H###.#', '....H.....', '....H.....', '....H.....', '###.H..###'],
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
      // Last-resort layout: plain path rooms where every drop has a ladder.
      const simple = nd && (nd.U && nd.D ? ROOMS.LRUD[3] : nd.D ? ROOMS.LRD[3] : nd.U ? ROOMS.LRU[0] : ROOMS.LR[0]);
      let tpl = forceSimple && nd ? simple : pick(rand, nd ? poolFor(nd) : ROOMS.SIDE);
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

/**
 * Tile queries for a level; `ropes` is an optional Set of cell indices with hanging ropes.
 * mode.safe (default true): danger cells count as walls and long falls are not allowed, so every
 * route found never costs a heart. mode.open: crumbly floors are treated as already crumbled.
 */
export function caveQuery(lv, ropes = null, mode = {}) {
  const { W, H, grid } = lv;
  const safe = mode.safe !== false, open = !!mode.open;
  const at = (c, r) => {
    const tl = c < 0 || r < 0 || c >= W || r >= H ? TL.ROCK : grid[r * W + c];
    return open && tl === TL.CRUMB ? TL.EMPTY : tl;
  };
  const pass = (c, r) => { const tl = at(c, r); return !SOLID[tl] && !(safe && HAZ[tl]); };
  const climb = (c, r) => CLIMBY[at(c, r)] || !!(ropes && c >= 0 && c < W && ropes.has(r * W + c));
  // Something to stand on: solid ground, a wooden ledge or the top of a ladder/vine.
  const support = (c, r) => {
    const b = at(c, r + 1);
    return SOLID[b] || b === TL.PLAT || (CLIMBY[b] && !CLIMBY[at(c, r)]);
  };
  const stand = (c, r) => pass(c, r) && (climb(c, r) || support(c, r));
  // Landing here doesn't hurt, however far you fell.
  const soft = (c, r) => { const tl = at(c, r); return tl === TL.MUD || tl === TL.HONEY || at(c, r + 1) === TL.MUSH; };
  return { W, H, at, pass, climb, support, stand, soft, safe };
}

/**
 * Every move from a standing (or hanging) cell. emit(c, r, act) is called for each landing cell.
 * Jumps reach 3 tiles up (4 from a mushroom), need head room, and move at most 1-3 tiles sideways
 * at the top; falls go straight down and may grab a ladder on the way. This is deliberately a bit
 * weaker than the real controls, so anything it can do, players can do. In safe mode a fall may
 * be at most SAFE_DROP rows (from the top of the jump) unless it ends somewhere soft.
 */
export function caveMoves(q, c, r, emit) {
  const fallFrom = (c2, r2, act, fromRow) => {
    for (let rr = r2; rr < q.H; rr++) {
      if (!q.pass(c2, rr)) return;
      const sup = q.support(c2, rr);
      if (q.climb(c2, rr)) emit(c2, rr, act);
      else if (sup && (!q.safe || rr - fromRow <= SAFE_DROP || q.soft(c2, rr))) emit(c2, rr, act);
      if (sup) return;
    }
  };
  const hanging = q.climb(c, r);
  const below = q.at(c, r + 1);
  const K = below === TL.MUSH && !hanging ? 4 : 3;
  if (hanging) {
    if (q.pass(c, r - 1) && (q.climb(c, r - 1) || q.support(c, r - 1))) emit(c, r - 1, { kind: 'up' });
    if (q.pass(c, r + 1)) {
      if (q.stand(c, r + 1)) emit(c, r + 1, { kind: 'down' });
      else fallFrom(c, r + 1, { kind: 'down' }, r);
    }
  } else if (q.climb(c, r + 1)) {
    emit(c, r + 1, { kind: 'down' });
  }
  if (below === TL.PLAT) fallFrom(c, r + 1, { kind: 'drop' }, r);
  for (let k = 0; k <= K; k++) {
    if (k > 0 && !q.pass(c, r - k)) break;
    if (k > 0 && q.climb(c, r - k)) emit(c, r - k, { kind: 'jump', k, dir: 0, i: 0 });
    if (k > 0 && !q.pass(c, r - k - 1)) continue; // need head room to hop onto a ledge at this height
    if (k > 0 && q.at(c, r - k + 1) === TL.PLAT) emit(c, r - k, { kind: 'jump', k, dir: 0, i: 0 });
    // A one-tile hop can carry you three tiles sideways (over a small pit or a patch of spikes).
    const maxI = k === 0 ? (q.pass(c, r - 1) ? 3 : 1) : k >= K ? 1 : k === 1 ? 3 : 2;
    for (const dir of [-1, 1]) {
      for (let i = 1; i <= maxI; i++) {
        const cx = c + dir * i, ry = r - k;
        if (!q.pass(cx, ry)) break;
        if (i >= 2 && (!q.pass(cx, ry - 1) || !q.pass(cx - dir, ry - 1))) break; // long hops need head room all the way
        const act = { kind: k === 0 && i === 1 ? 'walk' : 'jump', k, dir, i };
        if (q.stand(cx, ry)) emit(cx, ry, act);
        else fallFrom(cx, ry, act, ry);
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
export function analyseCave(lv, mode = { safe: false }) {
  const q = caveQuery(lv, null, mode);
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

/**
 * Shortest list of moves [{ idx, act }] from a cell to the exit (empty if unreachable).
 * Prefers a route that never touches a danger; falls back to any route.
 */
export function routeToExit(lv, fromIdx, ropes = null, safeOnly = false) {
  for (const safe of safeOnly ? [true] : [true, false]) {
    const q = caveQuery(lv, ropes, { safe });
    const exitIdx = lv.exit.r * lv.W + lv.exit.c;
    if (!q.stand(fromIdx % lv.W, Math.floor(fromIdx / lv.W))) continue;
    const s = caveSearch(q, fromIdx, exitIdx);
    if (!s.seen[exitIdx]) continue;
    const out = [];
    for (let i = exitIdx; i !== fromIdx; i = s.prev[i]) out.push({ idx: i, act: s.act[i] });
    return out.reverse();
  }
  return [];
}

/**
 * The full danger check for a level with its exit set. It must hold in every "world":
 * - safe, crumbly floors intact and safe, crumbly floors gone: the exit is reachable without
 *   touching a danger or falling too far, and from every spot you can reach that way too
 *   (so no danger is ever forced on you);
 * - unsafe with crumbly floors gone: nowhere you could tumble into is a dead end.
 */
export function checkCave(lv) {
  const hasCrumb = lv.grid.includes(TL.CRUMB);
  const a = analyseCave(lv, { safe: true });
  if (!a.ok || a.trapped) return { ok: false, seen: a.seen };
  if (hasCrumb) {
    const b = analyseCave(lv, { safe: true, open: true });
    if (!b.ok || b.trapped) return { ok: false, seen: a.seen };
    const c = analyseCave(lv, { safe: false, open: true });
    if (!c.ok || c.trapped) return { ok: false, seen: a.seen };
  }
  return { ok: true, seen: a.seen, reach: a.reach, pathLen: a.pathLen };
}

/** How many of each danger a depth gets: more further down and with more players. */
export function dangerBudget(depth, players = 1) {
  const f = 1 + (Math.max(1, players) - 1) * 0.12;
  const n = (list) => Math.round(list[depth] * f);
  return {
    spikes: n([3, 5, 7]), goo: n([1, 2, 3]), ceiling: n([1, 2, 3]), crumbs: n([2, 3, 4]),
    stalactites: n([2, 4, 6]), bats: [1, 2, 3][depth] + Math.floor((players - 1) / 2),
    grumbles: [1, 2, 3][depth] + Math.floor((players - 1) / 3), plants: [1, 2, 3][depth] + Math.floor((players - 1) / 4),
    hearts: [1, 2, 2][depth] + Math.floor((players - 1) / 2),
  };
}

/** Builds a checked cave for one depth. Same seed (and player count), same cave. */
export function generateCave(seed, depth = 0, players = 1) {
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
    if (res.trapped === 0) {
      // Also needs a route to the exit (and back from anywhere) without long falls.
      const safe = checkCave(lv);
      if (safe.ok) {
        lv.safe = true;
        placeDangers(lv, players);
        const fin = checkCave(lv);
        decorate(lv, fin.seen, players);
        return lv;
      }
    }
    if (!best || res.trapped < best.trapped) { best = lv; best.seen = res.seen; }
  }
  // Very rare: no fully safe layout. Use the best one, without fixed dangers.
  best.safe = false;
  decorate(best, best.seen, players);
  return best;
}

/** Tries spots for spikes, goo and crumbly floors, keeping each only if checkCave still passes. */
function placeDangers(lv, players) {
  const { W, H, grid, rand, depth } = lv;
  const budget = dangerBudget(depth, players);
  const ent = lv.entrance, ex = lv.exit;
  const q = caveQuery(lv, null, { safe: false });
  const seen = analyseCave(lv, { safe: true }).seen;
  const nearDoor = (c, r) => (Math.abs(c - ent.c) <= 3 && Math.abs(r - ent.r) <= 2) || (Math.abs(c - ex.c) <= 2 && Math.abs(r - ex.r) <= 2);
  const floorTile = (tl) => tl === TL.DIRT || tl === TL.ROCK || tl === TL.GOLD;
  // A cell on plain solid floor with open space above, where players actually walk.
  const floorSpot = (c, r) => grid[r * W + c] === TL.EMPTY && floorTile(q.at(c, r + 1)) && q.at(c, r - 1) === TL.EMPTY && seen[r * W + c] && !nearDoor(c, r);
  const shuffled = (list) => { for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; } return list; };
  const all = shuffled(Array.from({ length: W * H }, (_, i) => i));
  lv.dangers = { spikes: 0, goo: 0, ceiling: 0, crumbs: 0 };
  // Put a run of `tile` on cells, keep it if the cave still checks out.
  const tryRun = (cells, tile, key) => {
    const old = cells.map((i) => grid[i]);
    for (const i of cells) grid[i] = tile;
    if (checkCave(lv).ok) { lv.dangers[key]++; return true; }
    cells.forEach((i, k) => { grid[i] = old[k]; });
    return false;
  };
  const runFrom = (i, len, ok) => {
    const cells = [];
    for (let k = 0; k < len; k++) { const j = i + k; if (Math.floor(j / W) !== Math.floor(i / W) || !ok(j % W, Math.floor(j / W))) break; cells.push(j); }
    return cells;
  };
  const spread = (i, list, d) => list.every((j) => Math.abs((j % W) - (i % W)) + Math.abs(Math.floor(j / W) - Math.floor(i / W)) >= d);
  const placed = [];
  // Crumbly floors: dirt you walk on with a short drop below it.
  let left = budget.crumbs;
  for (const i of all) {
    if (left <= 0) break;
    const c = i % W, r = Math.floor(i / W);
    const crumbOk = (c2, r2) => {
      if (grid[r2 * W + c2] !== TL.DIRT || r2 >= H - 2 || nearDoor(c2, r2 - 1) || !seen[(r2 - 1) * W + c2] || q.at(c2, r2 - 1) !== TL.EMPTY) return false;
      if (Math.abs(c2 - ex.c) <= 1 && r2 - ex.r >= 1 && r2 - ex.r <= 2) return false; // the floor by the door
      // Something to land on 1-4 rows below.
      for (let k = 1; k <= 4; k++) { if (SOLID[q.at(c2, r2 + k)]) return k > 1; if (!q.pass(c2, r2 + k) || HAZ[q.at(c2, r2 + k)]) return false; }
      return false;
    };
    if (!crumbOk(c, r) || !spread(i, placed, 5)) continue;
    const cells = runFrom(i, 1 + Math.floor(rand() * 3), crumbOk);
    if (tryRun(cells, TL.CRUMB, 'crumbs')) { left--; placed.push(i); }
  }
  // Hot goo / icy water pools (2-3 wide), then spike patches (1-2 wide).
  for (const [key, tile, minLen, maxLen] of [['goo', TL.GOO, 2, depth >= 2 ? 3 : 2], ['spikes', TL.SPIKE, 1, 2]]) {
    left = budget[key];
    for (const i of all) {
      if (left <= 0) break;
      if (!floorSpot(i % W, Math.floor(i / W)) || !spread(i, placed, 4)) continue;
      const cells = runFrom(i, minLen + Math.floor(rand() * (maxLen - minLen + 1)), floorSpot);
      if (cells.length < minLen) continue;
      if (tryRun(cells, tile, key)) { left--; placed.push(i); }
    }
  }
  // Ceiling spikes: under solid rock, with at least two open rows below (so walking under is fine).
  left = budget.ceiling;
  const ceilOk = (c, r) => grid[r * W + c] === TL.EMPTY && floorTile(q.at(c, r - 1)) && q.at(c, r + 1) === TL.EMPTY && q.at(c, r + 2) === TL.EMPTY &&
    (seen[(r + 2) * W + c] || seen[(r + 3) * W + c] || seen[(r + 1) * W + c]) && !nearDoor(c, r) && !nearDoor(c, r + 2);
  for (const i of all) {
    if (left <= 0) break;
    if (!ceilOk(i % W, Math.floor(i / W)) || !spread(i, placed, 4)) continue;
    if (tryRun(runFrom(i, 1 + Math.floor(rand() * 3), ceilOk), TL.CSPIKE, 'ceiling')) { left--; placed.push(i); }
  }
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

/** Treasure, crates, boulders, the lost puppy, hearts and critters, placed only where players can get. */
function decorate(lv, seen, players = 1) {
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
  placeCritters(lv, seen, players, used, free, take);
}

/** Hearts to pick up and the moving dangers: stalactites, bats, grumbles and pea plants. */
function placeCritters(lv, seen, players, used, free, take) {
  const { W, H, rand, depth } = lv;
  const q = caveQuery(lv, null, { safe: false });
  const budget = dangerBudget(depth, players);
  const ent = lv.entrance, ex = lv.exit;
  const nearEnt = (c, r, d) => Math.abs(c - ent.c) <= d && Math.abs(r - ent.r) <= d;
  const nearExit = (c, r, d) => Math.abs(c - ex.c) <= d && Math.abs(r - ex.r) <= d;
  const rock = (c, r) => { const tl = q.at(c, r); return tl === TL.DIRT || tl === TL.ROCK || tl === TL.GOLD; };
  const open = (c, r) => q.at(c, r) === TL.EMPTY;
  const seenBelow = (c, r, n) => { for (let k = 0; k <= n; k++) if (r + k < H && seen[(r + k) * W + c]) return true; return false; };
  const cells = [];
  for (let r = 1; r < H - 1; r++) for (let c = 1; c < W - 1; c++) cells.push(r * W + c);
  const shuffled = (list) => { for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; } return list; };
  const far = (i, list, d) => list.every((o) => Math.abs(o.c - (i % W)) + Math.abs(o.r - Math.floor(i / W)) >= d);

  // Hearts lie on safe floor away from the entrance.
  lv.hearts = [];
  const heartSpots = free.filter((i) => !used.has(i) && !nearEnt(i % W, Math.floor(i / W), 6));
  for (let k = 0; k < budget.hearts; k++) { const s = take(heartSpots); if (s) lv.hearts.push(s); }

  // Stalactites: under rock, above a clear drop with no ladders, over places people walk.
  lv.stalactites = [];
  for (const i of shuffled(cells.slice())) {
    if (lv.stalactites.length >= budget.stalactites) break;
    const c = i % W, r = Math.floor(i / W);
    if (!open(c, r) || !rock(c, r - 1) || !open(c, r + 1) || nearEnt(c, r, 3) || nearExit(c, r, 2)) continue;
    let ok = false;
    for (let k = 1; k <= 8; k++) {
      const tl = q.at(c, r + k);
      if (CLIMBY[tl] || HAZ[tl] || tl === TL.PLAT) break;
      if (SOLID[tl]) { ok = k >= 3 && seen[(r + k - 1) * W + c]; break; }
    }
    if (ok && far(i, lv.stalactites, 3)) lv.stalactites.push({ c, r });
  }

  // Bats roost under rock with room to swoop below.
  lv.bats = [];
  for (const i of shuffled(cells.slice())) {
    if (lv.bats.length >= budget.bats) break;
    const c = i % W, r = Math.floor(i / W);
    if (!rock(c, r - 1) || nearEnt(c, r, 5) || nearExit(c, r, 2)) continue;
    let roomy = true;
    for (let dr = 0; dr <= 2 && roomy; dr++) for (let dc = -1; dc <= 1; dc++) if (!q.pass(c + dc, r + dr) || HAZ[q.at(c + dc, r + dr)]) roomy = false;
    if (roomy && seenBelow(c, r + 1, 5) && far(i, lv.bats, 8)) lv.bats.push({ c, r });
  }

  // Grumbles patrol flat floors with room to jump over them (two open rows above the floor).
  lv.grumbles = [];
  const walkable = (c, r) => open(c, r) && rock(c, r + 1) && q.pass(c, r - 1) && q.pass(c, r - 2) && !HAZ[q.at(c, r - 1)] && !HAZ[q.at(c, r - 2)] && seen[r * W + c];
  const runs = [];
  for (let r = 1; r < H - 1; r++) {
    for (let c = 1; c < W - 1; c++) {
      if (!walkable(c, r) || walkable(c - 1, r)) continue;
      let c1 = c;
      while (walkable(c1 + 1, r)) c1++;
      if (c1 - c + 1 >= 4 && !(r === ent.r && ent.c >= c - 5 && ent.c <= c1 + 5) && !nearEnt(c, r, 5) && !nearEnt(c1, r, 5)) runs.push({ c0: c, c1, r });
    }
  }
  for (const run of shuffled(runs)) {
    if (lv.grumbles.length >= budget.grumbles) break;
    if (lv.grumbles.some((g) => Math.abs(g.r - run.r) < 3 && Math.abs((g.c0 + g.c1) / 2 - (run.c0 + run.c1) / 2) < 8)) continue;
    lv.grumbles.push({ c0: run.c0, c1: run.c1, r: run.r });
  }

  // Pea plants grow out of a wall and spit along a floor lane you can hop over.
  lv.plants = [];
  for (const i of shuffled(cells.slice())) {
    if (lv.plants.length >= budget.plants) break;
    const c = i % W, r = Math.floor(i / W);
    if (!rock(c, r) || c <= 1 || c >= W - 2) continue;
    for (const dir of [-1, 1]) {
      const fc = c + dir;
      if (!open(fc, r) || !rock(fc, r + 1) || !seen[r * W + fc] || !q.pass(fc, r - 1)) continue;
      let len = 0;
      for (let k = 1; k <= 9; k++) {
        const lc = c + dir * k;
        if (!q.pass(lc, r) || HAZ[q.at(lc, r)] || CLIMBY[q.at(lc, r)]) break;
        if (q.support(lc, r) && !q.pass(lc, r - 1)) break; // needs room to hop over the peas
        if (nearEnt(lc, r, 2)) { len = 0; break; }
        if (nearExit(lc, r, 2)) break; // no peas flying around the door
        len = k;
      }
      if (len >= 4 && !nearExit(fc, r, 2) && lv.plants.every((p) => p.r !== r || Math.abs(p.c - c) > 6) && far(i, lv.plants, 6)) { lv.plants.push({ c, r, dir, len }); break; }
    }
  }
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
// Dangers. Everything is a little faster and meaner in each deeper cave.
const MAX_HEARTS = 3;
const HURT_FALL = 11.5; // tiles: falls this long cost a heart (the model only uses falls of SAFE_DROP + jump height)
const HURT_INVULN = 1.6; // seconds of blinking after a hit
const CRUMB_TIME = 0.55, CRUMB_BACK = 4.5;
const STAL_WARN = [0.8, 0.7, 0.6];
const BAT_SPEED = [5, 5.8, 6.6];
const GRUMBLE_SPEED = [1.6, 2.1, 2.6];
const PLANT_PERIOD = [3.4, 2.9, 2.4], PEA_SPEED = [4.5, 5.2, 6];
const BOULDER_SPEED = [3.4, 3.9, 4.4];
const GOO_COLORS = [0xff7a3d, 0x4fb6ff, 0xff4f9a]; // hot goo, icy water, hot pink goo
const PEA_COLORS = [0x7ad65a, 0xffffff, 0xff7eb6];
const GRUMBLE_COLORS = [0x7b6cf6, 0x4f7bd8, 0xd64f9a];
const STAL_COLORS = [0x9d93b5, 0xd8f0ff, 0xe0a8ff];
const HEART_PATH = 'M5 8.6C2 6.4 0.4 4.8 0.4 3A2.3 2.3 0 0 1 5 1.9A2.3 2.3 0 0 1 9.6 3C9.6 4.8 8 6.4 5 8.6Z';
const heartSvg = (fill) => `<svg viewBox="0 0 10 9" style="width:0.82em;height:0.74em;vertical-align:-0.04em;margin-right:0.06em"><path d="${HEART_PATH}" fill="${fill}"/></svg>`;
const GHOST_SVG = '<svg viewBox="0 0 10 10" style="width:1em;height:1em;vertical-align:-0.12em;margin-right:0.15em"><path d="M1.5 9.5V4.6a3.5 3.5 0 0 1 7 0v4.9l-1.15-.9-1.15.9-1.2-.9-1.2.9-1.15-.9z" fill="#d9d4f0" stroke="#8a82b0" stroke-width="0.6"/><circle cx="3.9" cy="4.7" r="0.75" fill="#2b2140"/><circle cx="6.1" cy="4.7" r="0.75" fill="#2b2140"/></svg>';

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

function makeHeart(color = 0xff5d73, emissive = 0x330011) {
  const g = new THREE.Group();
  const m = toon(color, { emissive });
  part(g, geo.sph(0.13), m, -0.09, 0.05, 0);
  part(g, geo.sph(0.13), m, 0.09, 0.05, 0);
  const tip = part(g, geo.cone('heartTip', 0.17, 0.22, 12), m, 0, -0.1, 0);
  tip.rotation.z = Math.PI;
  return g;
}

/** A player who ran out of hearts: see-through bean under a little white sheet. */
function makeGhost(color) {
  const g = new THREE.Group();
  const inner = new THREE.Group();
  g.add(inner);
  part(inner, sharedGeo('beanBody', () => new THREE.CapsuleGeometry(0.42, 0.36, 8, 18)), toon(color, { transparent: true, opacity: 0.45 }), 0, 0.6, 0);
  const sheet = toon(0xffffff, { transparent: true, opacity: 0.62 });
  part(inner, sharedGeo('caveGhostDome', () => new THREE.SphereGeometry(0.5, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2)), sheet, 0, 0.84, 0);
  part(inner, sharedGeo('caveGhostSkirt', () => new THREE.CylinderGeometry(0.5, 0.54, 0.44, 18, 1, true)), sheet, 0, 0.62, 0);
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    part(inner, geo.sph(0.1, 8, 6), sheet, Math.sin(a) * 0.5, 0.4, Math.cos(a) * 0.5);
  }
  for (const s of [-1, 1]) {
    const eye = part(inner, geo.sph(0.085, 10, 8), toon(COLORS.ink), s * 0.16, 0.95, 0.47);
    eye.scale.set(0.8, 1.25, 0.5);
    const arm = part(inner, geo.sph(0.12, 8, 6), sheet, s * 0.56, 0.7, 0.05);
    arm.scale.set(0.7, 1.2, 0.7);
  }
  part(inner, geo.sph(0.055, 8, 6), toon(COLORS.ink), 0, 0.78, 0.53).scale.set(1, 0.7, 0.5);
  g.userData.inner = inner;
  g.scale.setScalar(BEAN_SCALE);
  return g;
}

/** A small cave bat (harmless looking until it swoops). */
function makeBat() {
  const g = new THREE.Group();
  const fur = toon(0x5b3f8c), wingM = toon(0x7a5aa8);
  part(g, geo.sph(0.24), fur, 0, 0, 0).castShadow = true;
  part(g, geo.sph(0.15), toon(0x8f73c4), 0, -0.06, 0.12).scale.set(1, 0.9, 0.6);
  for (const s of [-1, 1]) {
    const ear = part(g, geo.cone('batEar', 0.08, 0.2, 5), fur, s * 0.12, 0.24, 0);
    ear.rotation.z = -s * 0.3;
    part(g, geo.sph(0.06, 8, 6), toon(COLORS.white), s * 0.08, 0.05, 0.2);
    part(g, geo.sph(0.03, 6, 4), toon(COLORS.ink), s * 0.08, 0.05, 0.25);
    const wing = new THREE.Group();
    wing.position.set(s * 0.18, 0.03, 0);
    const w = part(wing, geo.sph(0.2, 10, 6), wingM, s * 0.22, 0, 0);
    w.scale.set(1.3, 0.55, 0.15);
    g.add(wing);
    g.userData[s < 0 ? 'wl' : 'wr'] = wing;
  }
  return g;
}

/** A pea plant growing out of a wall, facing dir. */
function makePlant(dir, color, peaColor) {
  const g = new THREE.Group();
  const leaf = toon(0x3f9a32);
  part(g, geo.cyl('plantStem', 0.07, 0.09, 0.3, 6), leaf, -dir * 0.05, 0, 0).rotation.z = Math.PI / 2;
  const head = new THREE.Group();
  head.position.x = dir * 0.22;
  part(head, geo.sph(0.27), toon(color), 0, 0, 0).castShadow = true;
  const mouth = part(head, geo.cyl('plantMouth', 0.13, 0.1, 0.26, 10), toon(color), dir * 0.27, 0, 0);
  mouth.rotation.z = Math.PI / 2;
  part(head, geo.sph(0.085, 10, 8), toon(COLORS.ink), dir * 0.4, 0, 0).scale.set(0.4, 1, 1);
  part(head, geo.sph(0.07, 8, 6), toon(peaColor), dir * 0.36, 0, 0.02);
  for (const s of [-1, 1]) {
    part(head, geo.sph(0.06, 8, 6), toon(COLORS.white), dir * 0.08, 0.18, s * 0.12);
    part(head, geo.sph(0.03, 6, 4), toon(COLORS.ink), dir * 0.11, 0.2, s * 0.12 + 0.03);
    const lf = part(g, geo.sph(0.14), leaf, -dir * 0.02, -0.2, s * 0.18);
    lf.scale.set(1.4, 0.45, 0.7);
    lf.rotation.y = s * 0.5;
  }
  g.add(head);
  g.userData.head = head;
  return g;
}

/** A patch of cartoon spikes (pointing up, or down when hanging from a ceiling). */
function makeSpikes(down) {
  const g = new THREE.Group();
  part(g, geo.rbox('spikeBase', 1.0, 0.08, 1.6, 0.03), toon(0x6d6a80), 0, 0.04, 0);
  for (const z of [-0.4, 0.4]) {
    for (const x of [-0.3, 0, 0.3]) {
      const sp = part(g, geo.cone('spike', 0.14, 0.42, 7), toon(0xe6eaf5), x, 0.27, z + (x === 0 ? 0.08 : 0));
      sp.castShadow = true;
    }
  }
  if (down) g.rotation.z = Math.PI;
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
    this.restarts = 0; // all-ghost restarts (each one rolls a fresh layout)
    this.restarting = false;
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

  onStart() {
    this.later(0.6, () => { if (this.state === 'play') this.game.ui.toast(t('cave.tip'), 4200); });
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
    if (tl === TL.DIRT || tl === TL.ROCK || tl === TL.GOLD || tl === TL.CRUMB) return { x: c, y, w: 1, h: 1, cell: r * this.lv.W + c };
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
    const ghost = makeGhost(p.color);
    ghost.visible = false;
    this.scene.add(ghost);
    // Hearts that pop up over your head when you get hurt or heal.
    const heartRow = new THREE.Group();
    const heartSlots = [];
    for (let k = 0; k < MAX_HEARTS; k++) {
      const full = makeHeart(), empty = makeHeart(0x6d6a80, 0x000000);
      for (const h of [full, empty]) { h.position.x = (k - (MAX_HEARTS - 1) / 2) * 0.36; heartRow.add(h); }
      heartSlots.push({ full, empty });
    }
    heartRow.visible = false;
    this.scene.add(heartRow);
    return {
      p, ch, bubble, stars, honey, ghost, heartRow, heartSlots,
      body: { x: 0, y: 0, w: BODY_W, h: BODY_H, vx: 0, vy: 0, grounded: true },
      facing: 1, state: 'play', t: 0, climbing: false, climbCol: 0, regrab: 0,
      dizzy: 0, stun: 0, invuln: 0, sticky: 0, knock: 0, peakY: 0, lastSafe: { x: 0, y: 0 },
      hearts: MAX_HEARTS, heartShow: 0, hits: 0, ghosts: 0,
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
    // After an all-ghost restart the same depth gets a brand new layout.
    this.lv = generateCave(this.seed + this.restarts * 7777, d, this.players.length);
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
    this.hazMeshes = new Map(); // cell -> mesh for spikes and goo
    this.crumbs = new Map(); // cell -> crumbly floor
    this.gooBubbles = [];
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
    this.buildDangers();
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
      e.dizzy = e.stun = e.sticky = e.knock = 0;
      e.invuln = 0;
      // Everyone (ghosts too) starts each cave alive with full hearts.
      e.hearts = MAX_HEARTS;
      e.heartShow = 0;
      e.ghost.visible = false;
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
        } else if (tl === TL.SPIKE || tl === TL.CSPIKE) {
          const sp = makeSpikes(tl === TL.CSPIKE);
          sp.position.set(x, tl === TL.CSPIKE ? y + 1 : y, 0);
          g.add(sp);
          this.hazMeshes.set(r * W + c, sp);
        } else if (tl === TL.GOO) {
          const gc = GOO_COLORS[this.depth];
          const pool = new THREE.Group();
          pool.position.set(x, y, 0);
          part(pool, geo.rbox('goo', 1.0, 0.4, 1.8, 0.1), toon(gc, { emissive: this.depth === 1 ? 0x0a2040 : 0x401000 }), 0, 0.19, 0);
          for (let k = 0; k < 2; k++) {
            const bub = part(pool, geo.sph(0.09, 8, 6), toon(new THREE.Color(gc).lerp(new THREE.Color(0xffffff), 0.45).getHex()), (k - 0.5) * 0.45, 0.38, 0.6 - k * 0.5);
            this.gooBubbles.push({ mesh: bub, phase: (c * 1.7 + k * 2.3) % 3 });
          }
          g.add(pool);
          this.hazMeshes.set(r * W + c, pool);
        } else if (tl === TL.CRUMB) {
          const cm = new THREE.Group();
          cm.position.set(x, y + 0.5, 0);
          const crumbColor = new THREE.Color(th.dirt[0]).lerp(new THREE.Color(0x8a8aa0), 0.4).getHex();
          const block = part(cm, geo.rbox('crumb', 0.96, 0.96, 1.92, 0.1), toon(crumbColor), 0, 0, 0);
          block.castShadow = block.receiveShadow = true;
          const crack = toon(0x4a3a4a);
          for (const [cx, cy, rz, w] of [[-0.15, 0.1, 0.7, 0.45], [0.18, -0.05, -0.5, 0.4], [0.02, -0.28, 0.2, 0.3]]) {
            const cr = part(cm, geo.rbox('crack', 1, 0.05, 0.04, 0.01), crack, cx, cy, 0.97);
            cr.scale.x = w;
            cr.rotation.z = rz;
          }
          part(cm, geo.rbox('crumbTop', 1.0, 0.14, 1.96, 0.05), toon(th.top), 0, 0.45, 0);
          g.add(cm);
          this.crumbs.set(r * W + c, { i: r * W + c, c, r, x, mesh: cm, state: 'solid', t: 0 });
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
      // Rolling boulders (big snowballs in the frosty cave).
      const mesh = new THREE.Group();
      if (this.depth === 1) {
        const ball = part(mesh, geo.sph(0.42, 16, 12), toon(COLORS.white), 0, 0, 0);
        ball.castShadow = true;
        for (const [x, y, z] of [[0.25, 0.2, 0.25], [-0.2, -0.1, 0.32], [0.05, 0.3, -0.25]]) part(mesh, geo.sph(0.12), toon(0xe6f4ff), x, y, z);
      } else {
        const rockM = toon(this.depth === 0 ? 0x9c8f84 : 0x9a86b8, { flat: true });
        const ball = part(mesh, sharedGeo('caveBoulder', () => faceted(new THREE.IcosahedronGeometry(0.43, 1))), rockM, 0, 0, 0);
        ball.castShadow = true;
        for (const [x, y, z] of [[0.22, 0.24, 0.26], [-0.26, -0.08, 0.28]]) part(mesh, geo.nugget(), toon(this.theme.crystal[0], { emissive: 0x111133 }), x, y, z).scale.setScalar(1.3);
      }
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

  /** Hearts to find and the moving dangers. */
  buildDangers() {
    const lv = this.lv, g = this.levelGroup, d = this.depth;
    for (const s of lv.hearts || []) {
      const x = s.c + 0.5, y = this.bottomOf(s.r) + 0.5;
      const mesh = makeHeart();
      mesh.scale.setScalar(1.7);
      mesh.position.set(x, y, 0);
      g.add(mesh);
      this.pickups.push({ x, y, baseY: y, mesh, value: 0, heart: true, gem: false, taken: false, body: null });
    }
    this.stals = (lv.stalactites || []).map((s) => {
      const top = this.bottomOf(s.r) + 1;
      const mesh = new THREE.Group();
      const cone = part(mesh, geo.cone('stalHaz', 0.24, 0.85, 7), toon(STAL_COLORS[d], { emissive: 0x111122 }), 0, -0.425, 0);
      cone.rotation.z = Math.PI;
      cone.castShadow = true;
      mesh.position.set(s.c + 0.5, top, 0);
      g.add(mesh);
      return { c: s.c, r: s.r, x: s.c + 0.5, top, y: top, vy: 0, state: 'hang', t: 0, mesh };
    });
    this.bats = (lv.bats || []).map((s) => {
      const mesh = makeBat();
      const hx = s.c + 0.5, hy = this.bottomOf(s.r) + 0.68;
      mesh.position.set(hx, hy, 0.2);
      g.add(mesh);
      return { hx, hy, x: hx, y: hy, state: 'perch', t: 0, cd: 1 + Math.random(), tx: 0, ty: 0, mesh };
    });
    this.grumbles = (lv.grumbles || []).map((s) => {
      const mesh = makeGrumble(GRUMBLE_COLORS[d]);
      mesh.scale.setScalar(0.78);
      g.add(mesh);
      const x0 = s.c0 + 0.45, x1 = s.c1 + 0.55;
      return { x: x0 + Math.random() * (x1 - x0), y: this.bottomOf(s.r), x0, x1, r: s.r, dir: Math.random() < 0.5 ? -1 : 1, state: 'walk', t: 0, mesh };
    });
    this.plants = (lv.plants || []).map((s, k) => {
      const y = this.bottomOf(s.r) + 0.42;
      const fx = s.c + 0.5 + s.dir * 0.5; // the face of the wall it grows from
      const mesh = makePlant(s.dir, d === 1 ? 0x8fc8e8 : 0x5fbf4a, PEA_COLORS[d]);
      mesh.position.set(fx, y, 0);
      g.add(mesh);
      return { c: s.c, r: s.r, dir: s.dir, x: fx, y, maxX: s.c + 0.5 + s.dir * (s.len + 0.5), t: 1.2 + k * 0.9, mesh, alive: true };
    });
    this.shots = [];
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
    if (e.state === 'done' || e.state === 'ghost') return; // ghosts are never rescued
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
      e.heartShow -= dt;
      if (e.state === 'bubble') this.updateBubble(e, dt, lead);
      else if (e.state === 'ghost') this.updateGhost(e, dt, inp, lead);
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
      else if (e.state === 'ghost') e.ch.group.visible = false;
      e.heartRow.visible = e.heartShow > 0 && e.state === 'play';
      if (e.heartRow.visible) {
        e.heartRow.position.set(b.x, b.y + 1.38, 0.6);
        e.heartSlots.forEach((h, k) => { h.full.visible = k < e.hearts; h.empty.visible = k >= e.hearts; });
        const pop = Math.min(1, (2.2 - e.heartShow) * 6);
        e.heartRow.scale.setScalar(0.8 * Math.max(0.01, pop));
      }
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
    e.knock -= dt;
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
      const keepVx = b.vx;
      const j = platformerControl(b, { x: ctrl.x * slow, y: ctrl.y, a: ctrl.a, aPressed: ctrl.aPressed }, dt, PHYS);
      if (e.knock > 0) b.vx = keepVx; // a knockback push carries you for a moment
      if (j) { e.ch.squash(1.3); this.game.audio.play('jump'); }
      moveBody(b, dt, this.solidsNear(b));
      if (!b.grounded) e.peakY = Math.max(e.peakY, b.y);
      if (b.justLanded) {
        const drop = e.peakY - b.y;
        const soft = b.ground?.spring || feet === TL.MUD || feet === TL.HONEY || this.tileAtXY(b.x, b.y + 0.2) === TL.HONEY || this.tileAtXY(b.x, b.y + 0.2) === TL.MUD;
        if (drop > DIZZY_FALL && !soft) {
          // Long falls make you dizzy; really long ones (no rope!) also cost a heart.
          if (drop > HURT_FALL) this.hurt(e, 0, 3, 0);
          e.dizzy = e.state === 'play' ? 1.3 : 0;
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
        } else if (g && !g.oneWay && e.sticky <= 0 && this.safeSpot(b, g)) {
          e.lastSafe = { x: b.x, y: b.y };
        }
      }
    }
    if (free && e.state === 'play') {
      if (ctrl.cPressed) this.throwBomb(e, ctrl);
      else if (ctrl.bPressed) this.throwRope(e, ctrl);
    }
    if (!playing || e.state !== 'play') return;
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
    // Critters get dizzy, peas pop and nearby stalactites shatter harmlessly.
    for (const g of this.grumbles) if (Math.hypot(g.x - cx, g.y + 0.4 - cy) < 2.4) { g.state = 'dizzy'; g.t = 0; }
    for (const bat of this.bats) if (bat.state !== 'dizzy' && Math.hypot(bat.x - cx, bat.y - cy) < 2.4) this.dizzyBat(bat);
    for (const sh of this.shots) if (Math.hypot(sh.x - cx, sh.y - cy) < 2.2) this.popShot(sh);
    for (const st of this.stals) if ((st.state === 'hang' || st.state === 'shake' || st.state === 'fall') && Math.hypot(st.x - cx, st.y - 0.4 - cy) < 2.2) this.shatterStalactite(st);
    for (const cr of this.crates) if (!cr.open && Math.hypot(cr.x - cx, cr.y + 0.35 - cy) < 2) this.openCrate(cr, bomb.owner);
  }

  breakTile(i, owner) {
    const { W } = this.lv;
    const c = i % W, r = Math.floor(i / W);
    const wasGold = this.lv.grid[i] === TL.GOLD;
    this.lv.grid[i] = TL.EMPTY;
    this.rects[i] = null;
    this.removeHazard(i);
    const cr = this.crumbs.get(i);
    if (cr) { this.levelGroup.remove(cr.mesh); this.crumbs.delete(i); }
    // Spikes and goo resting on this tile (or ceiling spikes hanging from it) go too.
    if (r > 0 && (this.lv.grid[i - W] === TL.SPIKE || this.lv.grid[i - W] === TL.GOO)) { this.lv.grid[i - W] = TL.EMPTY; this.removeHazard(i - W); }
    if (this.lv.grid[i + W] === TL.CSPIKE) { this.lv.grid[i + W] = TL.EMPTY; this.removeHazard(i + W); }
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    if (this.tileInst[i] >= 0) { this.tileMesh.setMatrixAt(this.tileInst[i], zero); this.tileMesh.instanceMatrix.needsUpdate = true; this.tileInst[i] = -1; }
    if (this.topInst[i] >= 0) { this.topMesh.setMatrixAt(this.topInst[i], zero); this.topMesh.instanceMatrix.needsUpdate = true; this.topInst[i] = -1; }
    // The tile below now has an open top.
    const below = i + W;
    if (SOLID[this.lv.grid[below]] && this.lv.grid[below] !== TL.MUSH && this.lv.grid[below] !== TL.CRUMB) this.addTop(below);
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

  removeHazard(i) {
    const m = this.hazMeshes.get(i);
    if (!m) return;
    this.levelGroup.remove(m);
    this.hazMeshes.delete(i);
    this.gooBubbles = this.gooBubbles.filter((gb) => gb.mesh.parent !== m);
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
          if (pk.heart) {
            // Hearts are only picked up by someone who is missing one.
            if (e.hearts >= MAX_HEARTS) continue;
            pk.taken = true;
            this.levelGroup.remove(pk.mesh);
            e.hearts++;
            e.heartShow = 2.2;
            this.game.audio.play('rescue');
            this.confetti.burst(new THREE.Vector3(pk.x, pk.y, 0.4), 0, { count: 12, speed: 4, size: 0.12, colors: [0xff5d73, 0xff9fd0, COLORS.white] });
            this.game.ui.toast(t('cave.heart', { name: e.p.name }), 1200);
            break;
          }
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
    const heal = e.state === 'play' && e.hearts < MAX_HEARTS;
    if (heal) { e.hearts++; e.heartShow = 2.2; }
    this.game.audio.play('star');
    this.puffs.burst(new THREE.Vector3(cr.x, cr.y + 0.4, 0.4), 0xc98a4a, { count: 10, size: 0.35 });
    this.confetti.burst(new THREE.Vector3(cr.x, cr.y + 0.6, 0.4), 0, { count: 18, speed: 5, colors: [0xe8c07a, 0xff7eb6, COLORS.gold] });
    this.game.ui.toast(t(heal ? 'cave.crateHeart' : 'cave.crate', { name: e.p.name }), 1300);
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
            sb.state = 'wobble'; // a little rumble first, then it rolls
            sb.dir = Math.sign(dx) || 1;
            sb.t = 0;
            sb.bounces = 0;
            break;
          }
        }
      }
      if (sb.state === 'wobble') {
        sb.t += dt;
        sb.mesh.rotation.z = Math.sin(sb.t * 40) * 0.12;
        if (sb.t > 0.55) { sb.state = 'roll'; sb.t = 0; this.game.audio.play('whoosh'); }
      }
      if (sb.state === 'roll') {
        sb.t += dt;
        b.vx = sb.dir * BOULDER_SPEED[this.depth];
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
          this.hurt(e, sb.dir, 7, 7);
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

  // ---------- hearts, ghosts and dangers ----------

  /** Somewhere a bubble may drop you back: not on crumbly floor, not by spikes or goo. */
  safeSpot(b, g) {
    if (g.cell !== undefined && this.lv.grid[g.cell] === TL.CRUMB) return false;
    const r = this.rowAt(b.y + 0.1);
    for (const dx of [-0.6, 0, 0.6]) if (HAZ[this.tile(Math.floor(b.x + dx), r)] || HAZ[this.tile(Math.floor(b.x + dx), r - 1)]) return false;
    return true;
  }

  /** Costs a heart (unless still blinking from the last hit) and pushes you away in direction dir. */
  hurt(e, dir, vy = 9, push = 5.5) {
    if (e.state !== 'play' || e.invuln > 0 || this.state !== 'play') return false;
    const b = e.body;
    e.hearts = Math.max(0, e.hearts - 1);
    e.hits++;
    e.invuln = HURT_INVULN;
    e.climbing = false;
    e.regrab = 0.3;
    e.sticky = 0;
    e.knock = 0.3;
    e.stun = 0.3;
    b.vx = dir * push;
    b.vy = vy;
    b.grounded = false;
    e.peakY = b.y;
    e.heartShow = 2.2;
    e.ch.squash(0.6);
    this.game.audio.play('bump');
    this.puffs.burst(new THREE.Vector3(b.x, b.y + 0.5, 0.5), 0xffffff, { count: 8, size: 0.3 });
    if (e.hearts <= 0) this.becomeGhost(e);
    return true;
  }

  becomeGhost(e) {
    const b = e.body;
    e.state = 'ghost';
    e.ghosts++;
    e.t = 0;
    e.climbing = false;
    e.dizzy = e.sticky = e.stun = e.knock = 0;
    e.bubble.visible = false;
    e.ch.group.visible = false;
    e.ghost.visible = true;
    b.vx = 0;
    b.vy = 2.5;
    // A ghost can't carry the puppy: it waits where its carrier last stood safely.
    const pup = this.puppy;
    if (pup && pup.carrier === e && !pup.saved) {
      pup.carrier = null;
      pup.x = e.lastSafe.x;
      pup.y = e.lastSafe.y;
      pup.heart.visible = true;
    }
    this.puffs.burst(new THREE.Vector3(b.x, b.y + 0.5, 0.6), 0xffffff, { count: 14, size: 0.4 });
    this.game.audio.play('whoosh');
    if (this.ents.some((x) => x.state !== 'ghost')) this.game.ui.toast(t('cave.ghost', { name: e.p.name }), 2000);
  }

  /** Ghosts float freely (through walls), get nudged after the living players and stay on screen. */
  updateGhost(e, dt, inp, lead) {
    const b = e.body;
    e.t += dt;
    const ctrl = this.state === 'play' ? inp : NO_INPUT;
    b.vx += ctrl.x * 26 * dt;
    b.vy += ctrl.y * 26 * dt;
    // Where the group is heading: the camera centre, pushed a little ahead of the leader.
    const tx = this.camX + (lead ? THREE.MathUtils.clamp(lead.body.vx * 0.4, -2, 2) : 0);
    const ty = this.camY + 0.8 + (lead ? THREE.MathUtils.clamp(lead.body.vy * 0.15, -2, 1) : 0);
    const dx = tx - b.x, dy = ty - b.y, d = Math.hypot(dx, dy);
    if (d > 2.5) {
      const pull = Math.min(14, (d - 2.5) * 2.6);
      b.vx += (dx / d) * pull * dt;
      b.vy += (dy / d) * pull * dt;
    }
    const damp = Math.exp(-dt * 2.2);
    b.vx *= damp;
    b.vy *= damp;
    const sp = Math.hypot(b.vx, b.vy);
    if (sp > 6.5) { b.vx *= 6.5 / sp; b.vy *= 6.5 / sp; }
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    const half = this.viewHalfSize(this.camDist);
    b.x = THREE.MathUtils.clamp(b.x, this.camX - half.w + 0.8, this.camX + half.w - 0.8);
    b.y = THREE.MathUtils.clamp(b.y, this.camY - half.h + 0.4, this.camY + half.h - 1.6);
    if (Math.abs(ctrl.x) > 0.2) e.facing = Math.sign(ctrl.x);
    const gh = e.ghost;
    gh.position.set(b.x, b.y + Math.sin(e.t * 3) * 0.12, 1.15); // in front of the rock, so it never hides
    gh.rotation.y += ((e.facing > 0 ? 0.45 : -0.45) - gh.rotation.y) * Math.min(1, dt * 8);
    gh.userData.inner.rotation.z = THREE.MathUtils.clamp(-b.vx * 0.05, -0.3, 0.3) + Math.sin(e.t * 2.3) * 0.06;
  }

  /** Which way to bounce out of a spike/goo patch: toward its nearer safe edge. */
  escapeDir(c, r, b) {
    let L = 0, R = 0;
    while (L < 4 && HAZ[this.tile(c - L - 1, r)]) L++;
    while (R < 4 && HAZ[this.tile(c + R + 1, r)]) R++;
    const lOk = this.passable(c - L - 1, r), rOk = this.passable(c + R + 1, r);
    if (lOk && rOk && L === R) return Math.abs(b.vx) > 0.3 ? -Math.sign(b.vx) : b.x < c + 0.5 ? -1 : 1;
    if (lOk && (!rOk || L < R)) return -1;
    return rOk ? 1 : 0;
  }

  /** Spikes, ceiling spikes and goo under/over a player. */
  touchTiles(e) {
    const b = e.body;
    for (const dx of [-0.22, 0.22]) {
      const c = Math.floor(b.x + dx);
      const rf = this.rowAt(b.y + 0.1);
      const tf = this.tile(c, rf);
      if ((tf === TL.SPIKE || tf === TL.GOO) && b.y - this.bottomOf(rf) < 0.42) {
        if (tf === TL.GOO) this.puffs.burst(new THREE.Vector3(b.x, b.y + 0.2, 0.6), GOO_COLORS[this.depth], { count: 8, size: 0.3 });
        this.hurt(e, this.escapeDir(c, rf, b), 10.5, 5);
        return;
      }
      const rh = this.rowAt(b.y + b.h);
      if (this.tile(c, rh) === TL.CSPIKE && b.y + b.h - this.bottomOf(rh) > 0.55) { this.hurt(e, 0, -4, 0); return; }
    }
  }

  updateCrumbs(dt) {
    for (const cr of this.crumbs.values()) {
      if (cr.state === 'solid') {
        if (this.ents.some((e) => e.state === 'play' && e.body.grounded && e.body.ground?.cell === cr.i)) {
          cr.state = 'shake';
          cr.t = 0;
          this.game.audio.play('trap');
        }
      } else if (cr.state === 'shake') {
        cr.t += dt;
        cr.mesh.position.x = cr.x + Math.sin(cr.t * 70) * 0.05;
        if (cr.t >= CRUMB_TIME) this.crumble(cr);
      } else if (cr.state === 'gone') {
        cr.t += dt;
        const y0 = this.bottomOf(cr.r);
        const blocked = this.ents.some((e) => e.state !== 'ghost' && e.state !== 'done' && Math.abs(e.body.x - cr.x) < 0.85 && e.body.y < y0 + 1.1 && e.body.y + e.body.h > y0 - 0.1) ||
          this.snowballs.some((sb) => sb.state !== 'gone' && Math.abs(sb.body.x - cr.x) < 1 && Math.abs(sb.body.y - y0) < 1);
        if (cr.t > CRUMB_BACK && !blocked) {
          // It grows back, so nobody is ever cut off for good.
          cr.state = 'solid';
          this.lv.grid[cr.i] = TL.CRUMB;
          this.rects[cr.i] = this.makeRect(cr.c, cr.r);
          if (cr.r > 0) this.rects[cr.i - this.lv.W] = this.makeRect(cr.c, cr.r - 1);
          cr.mesh.visible = true;
          cr.mesh.scale.setScalar(0.2);
          this.puffs.burst(new THREE.Vector3(cr.x, y0 + 0.5, 0.6), this.theme.dirt[1], { count: 4, size: 0.3 });
        }
      }
      if (cr.state === 'solid' && cr.mesh.scale.x < 1) cr.mesh.scale.setScalar(Math.min(1, cr.mesh.scale.x + dt * 3));
    }
  }

  crumble(cr) {
    cr.state = 'gone';
    cr.t = 0;
    this.lv.grid[cr.i] = TL.EMPTY;
    this.rects[cr.i] = null;
    if (cr.r > 0) this.rects[cr.i - this.lv.W] = this.makeRect(cr.c, cr.r - 1);
    cr.mesh.visible = false;
    cr.mesh.position.x = cr.x;
    const pos = new THREE.Vector3(cr.x, this.bottomOf(cr.r) + 0.5, 0.6);
    this.puffs.burst(pos, this.theme.dirt[1], { count: 8, size: 0.4, life: 0.6 });
    this.confetti.burst(pos, 0, { count: 10, speed: 3, colors: [this.theme.dirt[0], this.theme.dirt[1]], size: 0.18, life: 0.8 });
    this.game.audio.play('pop');
  }

  /** Is the straight line between two points clear of rock? */
  clearLine(x0, y0, x1, y1) {
    const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 0.3);
    for (let k = 1; k < n; k++) if (!this.passable(Math.floor(x0 + ((x1 - x0) * k) / n), this.rowAt(y0 + ((y1 - y0) * k) / n))) return false;
    return true;
  }

  updateStalactites(dt) {
    for (const st of this.stals) {
      const ceiling = SOLID[this.tile(st.c, st.r - 1)];
      if (st.state === 'hang' || st.state === 'grow') {
        if (st.state === 'grow') {
          st.t += dt;
          st.mesh.scale.setScalar(Math.min(1, st.t));
          if (st.t >= 1) st.state = 'hang';
          continue;
        }
        if (!ceiling) { st.state = 'shake'; st.t = STAL_WARN[this.depth]; continue; }
        // Shakes when someone walks underneath, then drops.
        for (const e of this.ents) {
          if (e.state !== 'play') continue;
          const b = e.body;
          if (Math.abs(b.x - st.x) < 1.1 && b.y < st.top - 0.5 && b.y > st.top - 9 && this.clearLine(st.x, st.top - 0.5, st.x, b.y + 0.5)) {
            st.state = 'shake';
            st.t = 0;
            this.game.audio.play('trap');
            this.puffs.burst(new THREE.Vector3(st.x, st.top - 0.1, 0.4), this.theme.dirt[1], { count: 3, size: 0.2, life: 0.5 });
            break;
          }
        }
      } else if (st.state === 'shake') {
        st.t += dt;
        st.mesh.position.x = st.x + Math.sin(st.t * 60) * 0.06;
        if (st.t >= STAL_WARN[this.depth]) { st.state = 'fall'; st.vy = 0; st.mesh.position.x = st.x; }
      } else if (st.state === 'fall') {
        st.vy -= 30 * dt;
        st.y += st.vy * dt;
        st.mesh.position.y = st.y;
        const tip = st.y - 0.85;
        for (const e of this.ents) {
          const b = e.body;
          if (e.state === 'play' && Math.abs(b.x - st.x) < 0.5 && tip < b.y + b.h && st.y > b.y) this.hurt(e, b.x >= st.x ? 1 : -1, 6);
        }
        if (SOLID[this.tile(st.c, this.rowAt(tip))] || tip < 0) this.shatterStalactite(st);
      } else if (st.state === 'gone') {
        st.t += dt;
        if (st.t > 9 && ceiling) {
          st.state = 'grow';
          st.t = 0;
          st.y = st.top;
          st.mesh.position.set(st.x, st.top, 0);
          st.mesh.scale.setScalar(0.01);
          st.mesh.visible = true;
        }
      }
    }
  }

  shatterStalactite(st) {
    st.state = 'gone';
    st.t = 0;
    st.mesh.visible = false;
    const pos = new THREE.Vector3(st.x, st.y - 0.6, 0.5);
    this.confetti.burst(pos, 0, { count: 12, speed: 4, colors: [STAL_COLORS[this.depth], COLORS.white], size: 0.14, life: 0.7 });
    this.puffs.burst(pos, 0xffffff, { count: 5, size: 0.3 });
    this.game.audio.play('splat');
  }

  /** Stomping (falling onto it from above) beats a critter; any other touch costs a heart. */
  critterTouch(e, x, y, w, h, onStomp) {
    const b = e.body;
    if (e.state !== 'play' || Math.abs(b.x - x) > (w + b.w) / 2 || b.y > y + h || b.y + b.h < y) return false;
    if (b.vy < 0 && b.y > y + h * 0.45) {
      b.vy = 11;
      b.grounded = false;
      e.ch.squash(1.35);
      this.game.audio.play('boing');
      onStomp();
      return true;
    }
    this.hurt(e, b.x >= x ? 1 : -1, 8);
    return true;
  }

  updateBats(dt) {
    const sp = BAT_SPEED[this.depth];
    for (const bat of this.bats) {
      bat.t += dt;
      bat.cd -= dt;
      const flap = bat.state === 'perch' ? 0.2 : bat.state === 'dizzy' ? 0.5 : 1;
      const wa = Math.sin(this.time * (bat.state === 'perch' ? 3 : 22)) * 0.7 * flap;
      bat.mesh.userData.wl.rotation.z = wa;
      bat.mesh.userData.wr.rotation.z = -wa;
      const moveTo = (tx, ty, v) => {
        const dx = tx - bat.x, dy = ty - bat.y, d = Math.hypot(dx, dy);
        if (d < v * dt || d < 0.05) { bat.x = tx; bat.y = ty; return true; }
        bat.x += (dx / d) * v * dt;
        bat.y += (dy / d) * v * dt;
        return false;
      };
      if (bat.state === 'perch') {
        bat.mesh.rotation.z = Math.PI; // sleeps upside down
        if (bat.cd <= 0) {
          for (const e of this.ents) {
            if (e.state !== 'play') continue;
            const b = e.body;
            if (Math.hypot(b.x - bat.hx, b.y - bat.hy) < 6 && b.y < bat.hy - 0.5 && this.clearLine(bat.hx, bat.hy, b.x, b.y + 0.45)) {
              bat.state = 'warn';
              bat.t = 0;
              bat.prey = e;
              this.game.audio.play('beep');
              break;
            }
          }
        }
      } else if (bat.state === 'warn') {
        bat.mesh.rotation.z = Math.PI * Math.max(0, 1 - bat.t * 3);
        bat.y = bat.hy - Math.min(0.25, bat.t);
        if (bat.t > 0.5) {
          const b = bat.prey.body;
          if (bat.prey.state === 'play' && this.clearLine(bat.x, bat.y, b.x, b.y + 0.45)) {
            bat.state = 'swoop';
            bat.t = 0;
            bat.tx = b.x;
            bat.ty = b.y + 0.45;
            this.game.audio.play('whoosh');
          } else { bat.state = 'back'; bat.t = 0; }
        }
      } else if (bat.state === 'swoop') {
        bat.mesh.rotation.z = 0;
        if (moveTo(bat.tx, bat.ty, sp) || bat.t > 2) { bat.state = 'back'; bat.t = 0; }
      } else if (bat.state === 'back' || bat.state === 'dizzy') {
        bat.mesh.rotation.z = bat.state === 'dizzy' ? Math.sin(this.time * 9) * 0.5 : 0;
        if (moveTo(bat.hx, bat.hy, bat.state === 'dizzy' ? 1.8 : 3.6) && bat.t > (bat.state === 'dizzy' ? 3 : 0)) {
          bat.state = 'perch';
          bat.cd = 2.5;
        }
      }
      if (bat.state === 'swoop' || bat.state === 'back') {
        for (const e of this.ents) {
          if (this.critterTouch(e, bat.x, bat.y - 0.25, 0.5, 0.5, () => this.dizzyBat(bat))) break;
        }
      }
      bat.mesh.position.set(bat.x, bat.y, 0.2);
    }
  }

  dizzyBat(bat) {
    bat.state = 'dizzy';
    bat.t = 0;
    this.puffs.burst(new THREE.Vector3(bat.x, bat.y, 0.5), 0x8f73c4, { count: 6, size: 0.25 });
  }

  updateGrumbles(dt) {
    const sp = GRUMBLE_SPEED[this.depth];
    for (const g of this.grumbles) {
      g.t += dt;
      const body = g.mesh.userData.body;
      if (g.state === 'dizzy') {
        body.scale.set(1.25, 0.55, 1.25);
        g.mesh.rotation.y = Math.sin(this.time * 8) * 0.4;
        if (g.t > 3.5) { g.state = 'walk'; g.t = 0; body.scale.set(1, 1, 1); }
      } else {
        g.x += g.dir * sp * dt;
        // Turn at the ends of its floor (or where a bomb took the floor away).
        const ahead = g.x + g.dir * 0.45;
        if (g.x > g.x1 || g.x < g.x0 || !SOLID[this.tile(Math.floor(ahead), g.r + 1)] || HAZ[this.tile(Math.floor(ahead), g.r)]) {
          g.x = THREE.MathUtils.clamp(g.x - g.dir * sp * dt, g.x0, g.x1);
          g.dir = -g.dir;
        }
        g.mesh.rotation.y = g.dir * 0.8;
        body.scale.set(1, 1 + Math.sin(g.t * 12) * 0.05, 1);
        for (const e of this.ents) {
          if (this.critterTouch(e, g.x, g.y, 0.7, 0.75, () => { g.state = 'dizzy'; g.t = 0; this.puffs.burst(new THREE.Vector3(g.x, g.y + 0.4, 0.5), GRUMBLE_COLORS[this.depth], { count: 6, size: 0.3 }); })) break;
        }
      }
      if (!SOLID[this.tile(Math.floor(g.x), g.r + 1)]) { g.y -= 6 * dt; if (g.y < this.bottomOf(g.r) - 1) { g.y = this.bottomOf(g.r); g.x = (g.x0 + g.x1) / 2; } }
      g.mesh.position.set(g.x, g.y, 0);
    }
  }

  updatePlants(dt) {
    const d = this.depth;
    for (const pl of this.plants) {
      if (!pl.alive) continue;
      if (!SOLID[this.tile(pl.c, pl.r)]) { // its wall was popped away
        pl.alive = false;
        this.levelGroup.remove(pl.mesh);
        this.puffs.burst(new THREE.Vector3(pl.x, pl.y, 0.5), 0x5fbf4a, { count: 8, size: 0.3 });
        continue;
      }
      const near = this.ents.some((e) => e.state === 'play' && Math.abs(e.body.x - pl.x) < 12 && Math.abs(e.body.y - pl.y) < 5);
      pl.t -= dt;
      if (!near) pl.t = Math.max(pl.t, 0.8);
      const head = pl.mesh.userData.head;
      // It puffs up just before it spits: that's your cue to hop.
      const swell = pl.t < 0.6 ? 1 + (0.6 - pl.t) * 0.5 : 1;
      head.scale.set(swell, swell, swell);
      if (pl.t <= 0) {
        pl.t = PLANT_PERIOD[d];
        const mesh = new THREE.Mesh(geo.sph(0.16, 10, 8), toon(PEA_COLORS[d]));
        mesh.castShadow = true;
        this.levelGroup.add(mesh);
        this.shots.push({ x: pl.x + pl.dir * 0.6, y: pl.y, vx: pl.dir * PEA_SPEED[d], maxX: pl.maxX, mesh, alive: true });
        this.game.audio.play('pop');
      }
    }
    for (const sh of this.shots) {
      sh.x += sh.vx * dt;
      sh.mesh.position.set(sh.x, sh.y + Math.sin(this.time * 20) * 0.02, 0);
      if ((sh.vx > 0 ? sh.x > sh.maxX : sh.x < sh.maxX) || SOLID[this.tileAtXY(sh.x, sh.y)]) { this.popShot(sh); continue; }
      for (const e of this.ents) {
        const b = e.body;
        if (e.state === 'play' && Math.abs(b.x - sh.x) < 0.42 && sh.y > b.y - 0.1 && sh.y < b.y + b.h + 0.1) {
          this.hurt(e, Math.sign(sh.vx), 7);
          this.popShot(sh);
          break;
        }
      }
    }
    this.shots = this.shots.filter((sh) => sh.alive);
  }

  popShot(sh) {
    if (!sh.alive) return;
    sh.alive = false;
    this.levelGroup.remove(sh.mesh);
    this.puffs.burst(new THREE.Vector3(sh.x, sh.y, 0.4), PEA_COLORS[this.depth], { count: 4, size: 0.2, life: 0.4 });
  }

  updateDangers(dt) {
    for (const e of this.ents) if (e.state === 'play' && e.invuln <= 0) this.touchTiles(e);
    this.updateCrumbs(dt);
    this.updateStalactites(dt);
    this.updateBats(dt);
    this.updateGrumbles(dt);
    this.updatePlants(dt);
  }

  /** Everyone is a ghost: same depth again with a new layout and full hearts. */
  restartDepth() {
    if (this.restarting || this.cleared) return;
    this.restarting = true;
    this.game.audio.play('dizzy');
    this.game.ui.banner(t('cave.allGhosts'), t('cave.tryAgain'), 1700);
    this.later(1.7, () => {
      if (this.state === 'results') return;
      this.state = 'between';
      this.game.ui.wipe();
      this.later(0.45, () => {
        this.restarts++;
        this.buildDepth(this.depth);
        this.updateCamera(1, true);
        this.state = 'play';
        this.restarting = false;
        this.game.audio.play('go');
      });
    });
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
    this.checkDepthEnd();
  }

  /** Cleared when every living player is through the door; restart when everyone is a ghost. */
  checkDepthEnd() {
    if (this.cleared || this.restarting) return;
    if (this.ents.every((x) => x.state === 'ghost')) this.restartDepth();
    else if (this.ents.some((x) => x.state === 'done') && this.ents.every((x) => x.state === 'done' || x.state === 'ghost')) this.depthCleared();
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
        const hadGhosts = this.ents.some((e) => e.state === 'ghost');
        this.restarts = 0;
        this.buildDepth(this.depth + 1);
        this.updateCamera(1, true);
        this.state = 'play';
        this.game.audio.play('go');
        this.game.ui.banner(`${t('cave.depth', { n: this.depth + 1, total: DEPTHS.length })}`, t(this.theme.name), 1600);
        if (hadGhosts) this.later(1.8, () => this.game.ui.toast(t('cave.revive'), 2000));
      });
    });
  }

  updateFlow(dt) {
    this.checkDepthEnd();
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
      // Nobody walking (all bubbles, ghosts or through the door): hold still, or follow the bubbles.
      const bub = this.ents.filter((e) => e.state === 'bubble');
      if (bub.length) {
        minX = Math.min(...bub.map((e) => e.body.x)); maxX = Math.max(...bub.map((e) => e.body.x));
        minY = Math.min(...bub.map((e) => e.body.y)); maxY = Math.max(...bub.map((e) => e.body.y));
      } else {
        minX = maxX = this.camX; minY = maxY = this.camY + 1.2;
      }
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
    for (const gb of this.gooBubbles) {
      const k = ((this.time + gb.phase) % 1.6) / 1.6; // grow, then pop
      gb.mesh.scale.setScalar(k < 0.85 ? 0.4 + k * 1.2 : 0.01);
      gb.mesh.position.y = 0.36 + k * 0.12;
    }
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
    const life = e.state === 'ghost' ? GHOST_SVG : Array.from({ length: MAX_HEARTS }, (_, k) => heartSvg(k < e.hearts ? '#ff5d73' : 'rgba(0,0,0,0.22)')).join('');
    return `${life} ${e.gems}${rope}${e.ropes}${bomb}${e.bombs}`;
  }

  end() {
    if (this.state === 'results') return;
    const ranked = [...this.ents].sort((a, b) => b.gems - a.gems);
    this.finish({
      title: t('cave.done'),
      subtitle: t('cave.sub', { gems: this.teamGems, depth: Math.max(1, this.depthsDone), total: DEPTHS.length, pups: this.puppiesSaved }),
      rows: ranked.map((e, i) => ({
        css: e.p.css, name: e.p.name, value: t('cave.gems', { n: e.gems }),
        detail: t('cave.ropesUsed', { n: e.ropesUsed }) + (e.pups ? ` · ${e.pups === 1 ? t('cave.pup1') : t('cave.pupN', { n: e.pups })}` : '') + (e.ghosts ? ` · ${t('cave.ghosted', { n: e.ghosts })}` : ''),
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
      this.updateDangers(dt);
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
