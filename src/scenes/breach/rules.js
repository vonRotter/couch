// Bean Brigade: the pure game rules (no three.js, no DOM, no text). A battle is one plain object
// (structuredClone-able) holding the 8x8 board, the units, the bug intents, the spawn markers and the
// counters for the bonus objectives. Every action mutates the state and returns a list of events
// that the view animates. The weapon preview runs the very same code on a copy and compares.
//
// Turn order (Into the Breach style):
//   player turn: every mech may move once, then act once (attack or repair). Moves can be undone.
//   enemy phase: burning bugs take 1 → bugs attack in order (with their current position; a pushed
//   bug's attack moves with it) → smoke clears → (last turn: win) → new bugs emerge from the spawn
//   markers (a unit standing on one blocks it and takes 1) → every bug moves and shows its next
//   attack → new spawn markers → burning mechs take 1 → player turn.

export const W = 8, H = 8;
export const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // 0 up (away from the camera), 1 right, 2 down, 3 left
export const inside = (x, y) => x >= 0 && y >= 0 && x < W && y < H;

// ---------- the cast ----------

/** The nine bean mechs. pow upgrades: see the weapon functions below. */
export const MECHS = {
  punch: { hp: 3, move: 3, weapon: 'punch', color: 0xff5d73, trim: 0xffc93c },
  cannon: { hp: 3, move: 3, weapon: 'cannon', color: 0x4cc9f0, trim: 0xffffff },
  lob: { hp: 2, move: 3, weapon: 'lob', color: 0x3ddc97, trim: 0xffe47a },
  hook: { hp: 3, move: 3, weapon: 'hook', color: 0xff8c42, trim: 0x2b2340 },
  swap: { hp: 2, move: 4, weapon: 'swap', color: 0x9b5de5, trim: 0x8fd8ff },
  laser: { hp: 3, move: 3, weapon: 'laser', color: 0xffc93c, trim: 0xff5d73 },
  bubble: { hp: 3, move: 3, weapon: 'bubble', color: 0x8fd8ff, trim: 0xff9fd0 },
  puff: { hp: 2, move: 4, weapon: 'puff', color: 0xfffaf2, trim: 0x9b5de5, flying: true },
  boulder: { hp: 3, move: 3, weapon: 'boulder', color: 0xb87a48, trim: 0x9ff0c8 },
};

/** Three starter squads: push and punch, pull and swap, shields and smoke. */
export const SQUADS = {
  bonk: ['punch', 'cannon', 'lob'],
  twist: ['hook', 'swap', 'laser'],
  bubble: ['bubble', 'puff', 'boulder'],
};
export const SQUAD_IDS = Object.keys(SQUADS);

/** Bug-grumbles. atk: how they attack (see attackTiles). */
export const BUGS = {
  beetle: { hp: 2, move: 3, atk: 'melee', dmg: 1 },
  spitter: { hp: 2, move: 2, atk: 'spit', dmg: 1 },
  burrower: { hp: 3, move: 3, atk: 'sweep', dmg: 1, burrow: true },
  firefly: { hp: 2, move: 4, atk: 'flame', dmg: 1, flying: true },
  boomer: { hp: 1, move: 3, atk: 'boom', dmg: 1 },
  queen: { hp: 8, move: 2, atk: 'royal', dmg: 2, heavy: true, boss: true },
};

// ---------- small helpers ----------

export const idx = (x, y) => y * W + x;
export const tileAt = (s, x, y) => (inside(x, y) ? s.tiles[idx(x, y)] : null);
export const unitAt = (s, x, y) => s.units.find((u) => !u.dead && u.x === x && u.y === y) || null;
export const unitById = (s, id) => s.units.find((u) => u.id === id) || null;
export const solid = (t) => !!t && (t.t === 'building' || t.t === 'mountain');
export const mechs = (s) => s.units.filter((u) => u.side === 'mech');
export const bugs = (s) => s.units.filter((u) => u.side === 'bug' && !u.dead);
const opposite = (d) => (d + 2) % 4;

/** Seeded random 0..1 kept in the state, so a rewind or a test replays the same bugs. */
export function rand(s) {
  s.seed = (s.seed + 0x6d2b79f5) | 0;
  let t = s.seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// ---------- building a battle ----------

const LEGEND = {
  '.': { t: 'ground' }, B: { t: 'building', hp: 1 }, D: { t: 'building', hp: 2 }, O: { t: 'building', hp: 2, obj: true },
  P: { t: 'building', hp: 1, obj: true, battery: true }, M: { t: 'mountain', hp: 2 }, '~': { t: 'water' }, F: { t: 'forest' },
  S: { t: 'sand' }, I: { t: 'ice', hp: 2 }, C: { t: 'ground', crate: true }, R: { t: 'ground', rock: true }, X: { t: 'ground', fire: true },
};

/**
 * A fresh battle from a level definition (levels.js) and the run (squad, upgrades, power).
 * mechs: [{ type, hp, move, pow }] with upgrades already added.
 */
export function makeBattle(def, { mechs: team, power, diff = 'easy', seed = 1 }) {
  const s = {
    def: def.id, turn: 1, maxTurns: def.turns, phase: 'player', diff, seed: seed | 0,
    power, powerStart: power, powerMax: 8,
    tiles: [], units: [], spawns: [], nextId: 1,
    kills: 0, drowned: 0, objHit: false, crateGot: false, crateLost: false, bossDead: false,
    waves: def.waves || [], pool: def.pool || ['beetle'], zone: def.zone || [0, 3], fixed: def.fixed || null,
    alphaChance: def.alphaChance || 0, finale: !!def.finale, eggs: !!def.eggs,
  };
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const c = def.map[y][x];
      const base = LEGEND[c] || LEGEND['.'];
      const tile = { t: base.t, hp: base.hp || 0, max: base.hp || 0, obj: !!base.obj, battery: !!base.battery, fire: !!base.fire, smoke: false, shield: false, crate: !!base.crate };
      s.tiles.push(tile);
      if (base.rock) addUnit(s, { side: 'rock', type: 'rock', x, y, hp: 1 });
    }
  }
  team.forEach((m, i) => {
    const [x, y] = def.start[i];
    const d = MECHS[m.type];
    addUnit(s, { side: 'mech', type: m.type, x, y, hp: d.hp + (m.hp || 0), move: d.move + (m.move || 0), pow: m.pow || 0, flying: !!d.flying, slot: i });
  });
  for (const b of def.bugs || []) spawnBug(s, b.type, b.x, b.y, b.alpha);
  // the bugs already on the board choose their first attacks, then the first spawn markers appear
  const ev = [];
  planBugs(s, ev);
  placeSpawns(s);
  return s;
}

/** A tile changed: the event carries a copy so the view can show it at the right moment. */
function tileEv(s, x, y, ev) {
  ev.push({ k: 'tile', x, y, tile: { ...tileAt(s, x, y) } });
}

function addUnit(s, u) {
  const unit = { id: s.nextId++, dead: false, ko: false, fire: false, shield: false, wet: false, moved: false, acted: false, maxHp: u.hp, intent: null, ...u };
  s.units.push(unit);
  return unit;
}

function spawnBug(s, type, x, y, alpha = false) {
  const d = BUGS[type];
  const hp = d.hp + (alpha ? 2 : 0);
  return addUnit(s, { side: 'bug', type, x, y, hp, move: d.move, dmg: d.dmg + (alpha ? 1 : 0), alpha: !!alpha, flying: !!d.flying, burrow: !!d.burrow, heavy: !!d.heavy, boss: !!d.boss || !!alpha });
}

// ---------- movement ----------

/** Can unit u walk/fly through (x, y) on the way somewhere? */
function passable(s, u, x, y) {
  if (!inside(x, y)) return false;
  const t = tileAt(s, x, y);
  const o = unitAt(s, x, y);
  if (u.flying || u.burrow) return true;
  if (solid(t) || t.t === 'water') return false;
  if (o && o.side !== u.side) return false; // friends can be walked through, foes and rocks block
  return true;
}

/** Can unit u stop at (x, y)? */
export function standable(s, u, x, y) {
  if (!inside(x, y)) return false;
  const t = tileAt(s, x, y);
  if (solid(t)) return false;
  if (t.t === 'water' && !u.flying) return false;
  const o = unitAt(s, x, y);
  return !o || o === u;
}

/** Tiles unit u can move to: Map key -> path [[x, y], ...] (start excluded). */
export function reach(s, u, maxMove = u.move) {
  const out = new Map();
  const seen = new Map([[idx(u.x, u.y), []]]);
  let frontier = [[u.x, u.y]];
  for (let step = 0; step < maxMove && frontier.length; step++) {
    const next = [];
    for (const [x, y] of frontier) {
      const path = seen.get(idx(x, y));
      for (const [dx, dy] of DIRS) {
        const nx = x + dx, ny = y + dy;
        if (seen.has(idx(nx, ny)) || !passable(s, u, nx, ny)) continue;
        const np = [...path, [nx, ny]];
        seen.set(idx(nx, ny), np);
        next.push([nx, ny]);
        if (standable(s, u, nx, ny)) out.set(idx(nx, ny), np);
      }
    }
    frontier = next;
  }
  return out;
}

/** Move a mech (player turn). Returns events or null if not allowed. */
export function mechMove(s, id, x, y) {
  const u = unitById(s, id);
  if (!u || u.side !== 'mech' || u.ko || u.moved || u.acted || s.phase !== 'player') return null;
  const path = reach(s, u).get(idx(x, y));
  if (!path) return null;
  const ev = [{ k: 'move', id, path: [[u.x, u.y], ...path] }];
  u.x = x; u.y = y; u.moved = true;
  enterTile(s, u, ev);
  checkEnd(s, ev);
  return ev;
}

// ---------- damage, pushes and tiles ----------

/** Unit u takes n damage (shields pop instead). */
function hurt(s, u, n, ev, opt = {}) {
  if (!u || u.dead || u.ko) return;
  if (opt.safe && u.side === 'mech') return;
  if (n <= 0) {
    if (opt.fire) setFire(u, ev);
    return;
  }
  if (u.shield) { u.shield = false; ev.push({ k: 'shieldPop', id: u.id }); return; }
  u.hp -= n;
  ev.push({ k: 'hurt', id: u.id, n, hp: Math.max(0, u.hp) });
  if (u.hp <= 0) kill(s, u, ev, 'poof');
  else if (opt.fire) setFire(u, ev);
}

function setFire(u, ev) {
  if (u.wet || u.fire || u.shield || u.side === 'rock') return;
  u.fire = true;
  ev.push({ k: 'burn', id: u.id });
}

function kill(s, u, ev, how) {
  if (u.side === 'mech') {
    u.hp = 0; u.ko = true; u.fire = false; u.shield = false;
    ev.push({ k: 'ko', id: u.id });
    return;
  }
  u.dead = true;
  u.intent = null;
  ev.push({ k: 'die', id: u.id, how, x: u.x, y: u.y });
  if (u.side !== 'bug') return;
  s.kills++;
  if (how === 'drown') s.drowned++;
  if (u.boss) s.bossDead = true;
  if (u.type === 'queen') s.queenDead = true;
  // a boom bug pops in a goo splash that hits its four neighbours
  if (u.type === 'boomer' && !u.exploded) {
    u.exploded = true;
    ev.push({ k: 'boom', x: u.x, y: u.y });
    for (const [dx, dy] of DIRS) hitTile(s, u.x + dx, u.y + dy, u.dmg, ev);
  }
}

/** What happens to the ground itself when damage lands on it. */
function tileDamage(s, x, y, n, ev, opt = {}) {
  const t = tileAt(s, x, y);
  if (!t) return;
  if (opt.fire && t.t !== 'water' && !solid(t)) { if (!t.fire) { t.fire = true; tileEv(s, x, y, ev); } }
  if (n <= 0) return;
  if (t.crate) { t.crate = false; s.crateLost = true; tileEv(s, x, y, ev); }
  switch (t.t) {
    case 'building': {
      if (opt.safe) return;
      if (t.shield) { t.shield = false; ev.push({ k: 'shieldPop', x, y }); return; }
      const lost = Math.min(n, t.hp);
      t.hp -= lost;
      s.power = Math.max(0, s.power - lost);
      if (t.obj) s.objHit = true;
      if (t.hp <= 0) { t.t = 'rubble'; t.wasObj = t.obj; }
      ev.push({ k: 'power', x, y, n: lost, power: s.power });
      tileEv(s, x, y, ev);
      break;
    }
    case 'mountain':
      t.hp -= 1;
      if (t.hp <= 0) t.t = 'rubble';
      tileEv(s, x, y, ev);
      break;
    case 'forest':
      if (!t.fire) { t.fire = true; tileEv(s, x, y, ev); }
      break;
    case 'sand':
      t.t = 'ground';
      t.smoke = true;
      tileEv(s, x, y, ev);
      break;
    case 'ice': {
      t.hp -= 1;
      if (t.hp <= 0) { t.t = 'water'; t.fire = false; }
      tileEv(s, x, y, ev);
      const u = unitAt(s, x, y);
      if (u && t.t === 'water') enterTile(s, u, ev);
      break;
    }
    default:
  }
}

/** Damage everything on a tile: the unit standing there and the ground. */
export function hitTile(s, x, y, n, ev, opt = {}) {
  if (!inside(x, y)) return;
  const u = unitAt(s, x, y);
  ev.push({ k: 'hit', x, y, n });
  if (u) hurt(s, u, n, ev, opt);
  tileDamage(s, x, y, n, ev, opt);
}

/** Damage a tile, then push whoever was standing there (if they are still around). */
function strike(s, x, y, n, dir, ev, opt = {}) {
  const u = unitAt(s, x, y);
  hitTile(s, x, y, n, ev, opt);
  if (u && !u.dead && dir !== null && dir !== undefined) push(s, u, dir, ev);
}

/** Push a unit one tile. Into something solid: a bump (1 damage to both). Off the edge: nothing. */
export function push(s, u, d, ev) {
  if (!u || u.dead || u.heavy) return;
  const nx = u.x + DIRS[d][0], ny = u.y + DIRS[d][1];
  if (!inside(nx, ny)) return;
  const b = unitAt(s, nx, ny);
  const t = tileAt(s, nx, ny);
  if (b || solid(t)) {
    ev.push({ k: 'bump', id: u.id, x: nx, y: ny });
    hurt(s, u, 1, ev);
    if (b) hurt(s, b, 1, ev);
    else tileDamage(s, nx, ny, 1, ev);
    return;
  }
  u.x = nx; u.y = ny;
  ev.push({ k: 'push', id: u.id, x: nx, y: ny });
  enterTile(s, u, ev);
}

/** Water, fire and crates when a unit arrives on a tile. */
function enterTile(s, u, ev) {
  if (u.dead) return;
  const t = tileAt(s, u.x, u.y);
  if (t.t === 'water' && !u.flying) {
    if (u.side === 'bug') { kill(s, u, ev, 'drown'); return; }
    if (u.side === 'rock') { u.dead = true; ev.push({ k: 'die', id: u.id, how: 'drown', x: u.x, y: u.y }); return; }
    if (!u.wet) { u.wet = true; ev.push({ k: 'splash', id: u.id }); }
    if (u.fire) { u.fire = false; ev.push({ k: 'douse', id: u.id }); }
    return;
  }
  u.wet = false;
  if (t.fire && !u.flying) setFire(u, ev);
  if (t.crate && u.side === 'mech' && !u.ko) {
    t.crate = false;
    s.crateGot = true;
    ev.push({ k: 'crate', id: u.id, x: u.x, y: u.y });
    tileEv(s, u.x, u.y, ev);
  }
}

function moveUnit(s, u, x, y, ev, kind = 'jump') {
  ev.push({ k: kind, id: u.id, path: [[u.x, u.y], [x, y]] });
  u.x = x; u.y = y;
  enterTile(s, u, ev);
}

/** First tile with a unit or something solid along a line (or the last tile before the edge). */
function firstHit(s, x, y, d, skip = null) {
  let cx = x, cy = y, last = null;
  for (;;) {
    cx += DIRS[d][0]; cy += DIRS[d][1];
    if (!inside(cx, cy)) return last;
    last = [cx, cy];
    const o = unitAt(s, cx, cy);
    if ((o && o !== skip) || solid(tileAt(s, cx, cy))) return last;
  }
}

// ---------- mech weapons ----------
// Each weapon lists target tiles (with the direction and distance they mean) and resolves an attack.
// lv = pow upgrades (0, 1 or 2).

function lineTiles(u, d, from, to) {
  const out = [];
  for (let k = from; k <= to; k++) {
    const x = u.x + DIRS[d][0] * k, y = u.y + DIRS[d][1] * k;
    if (!inside(x, y)) break;
    out.push({ x, y, d, k });
  }
  return out;
}

export const WEAPONS = {
  // Bonk Glove: punch a neighbour for 2 and push it away. +1: 3 damage. +2: dash up to the first thing in a line.
  punch: {
    dmg: (lv) => (lv >= 1 ? 3 : 2),
    targets(s, u) {
      const out = [];
      for (let d = 0; d < 4; d++) {
        if (u.pow < 2) { out.push(...lineTiles(u, d, 1, 1)); continue; }
        for (const tl of lineTiles(u, d, 1, 7)) {
          out.push(tl);
          if (unitAt(s, tl.x, tl.y) || solid(tileAt(s, tl.x, tl.y)) || tileAt(s, tl.x, tl.y).t === 'water') break;
        }
      }
      return out;
    },
    fire(s, u, tg, ev) {
      if (tg.k > 1) moveUnit(s, u, tg.x - DIRS[tg.d][0], tg.y - DIRS[tg.d][1], ev, 'dash');
      ev.push({ k: 'swing', id: u.id, x: tg.x, y: tg.y });
      strike(s, tg.x, tg.y, this.dmg(u.pow), tg.d, ev);
    },
  },
  // Pop Cannon: a shot that hits the first thing in a line for 1 and pushes it. +1: 2 damage. +2: 3 damage.
  cannon: {
    dmg: (lv) => 1 + lv,
    line: true,
    targets: (s, u) => [0, 1, 2, 3].flatMap((d) => lineTiles(u, d, 1, 7)),
    fire(s, u, tg, ev) {
      const [x, y] = firstHit(s, u.x, u.y, tg.d);
      ev.push({ k: 'shot', id: u.id, style: 'cannon', from: [u.x, u.y], to: [x, y] });
      strike(s, x, y, this.dmg(u.pow), tg.d, ev);
    },
  },
  // Lob Mortar: lob over anything (2+ tiles away): 1 damage in the middle, pushes the four neighbours away.
  lob: {
    dmg: (lv) => 1 + lv,
    targets: (s, u) => [0, 1, 2, 3].flatMap((d) => lineTiles(u, d, 2, 7)),
    fire(s, u, tg, ev) {
      ev.push({ k: 'shot', id: u.id, style: 'lob', from: [u.x, u.y], to: [tg.x, tg.y] });
      strike(s, tg.x, tg.y, this.dmg(u.pow), null, ev);
      for (let d = 0; d < 4; d++) strike(s, tg.x + DIRS[d][0], tg.y + DIRS[d][1], 0, d, ev);
    },
  },
  // Grab Hook: hooks the first thing in a line and pulls it next to you; hooked on a rock or a house, you fly to it.
  hook: {
    dmg: (lv) => lv,
    line: true,
    targets: (s, u) => [0, 1, 2, 3].flatMap((d) => lineTiles(u, d, 1, 7)),
    fire(s, u, tg, ev) {
      const [x, y] = firstHit(s, u.x, u.y, tg.d);
      const o = unitAt(s, x, y);
      ev.push({ k: 'shot', id: u.id, style: 'hook', from: [u.x, u.y], to: [x, y] });
      const back = opposite(tg.d);
      if (o && !o.heavy) {
        if (this.dmg(u.pow)) hitTile(s, x, y, this.dmg(u.pow), ev);
        // pull step by step until it is next to the mech
        while (!o.dead && Math.abs(o.x - u.x) + Math.abs(o.y - u.y) > 1) {
          const nx = o.x + DIRS[back][0], ny = o.y + DIRS[back][1];
          if (unitAt(s, nx, ny) || solid(tileAt(s, nx, ny))) break;
          o.x = nx; o.y = ny;
          ev.push({ k: 'pull', id: o.id, x: nx, y: ny });
          enterTile(s, o, ev);
        }
      } else if (o || solid(tileAt(s, x, y))) {
        if (o && this.dmg(u.pow)) hitTile(s, x, y, this.dmg(u.pow), ev);
        // yank the mech itself up to the obstacle
        const tx = x + DIRS[back][0], ty = y + DIRS[back][1];
        if (tx !== u.x || ty !== u.y) moveUnit(s, u, tx, ty, ev, 'dash');
      }
    },
  },
  // Swap Beam: trade places with whatever stands up to 2 tiles away in a line (or just teleport). +1: 3 tiles. +2: the swapped bug takes 1.
  swap: {
    range: (lv) => (lv >= 1 ? 3 : 2),
    targets(s, u) {
      return [0, 1, 2, 3].flatMap((d) => lineTiles(u, d, 1, this.range(u.pow))).filter((tl) => {
        const t = tileAt(s, tl.x, tl.y);
        const o = unitAt(s, tl.x, tl.y);
        return !solid(t) && t.t !== 'water' && !(o && o.heavy);
      });
    },
    fire(s, u, tg, ev) {
      const o = unitAt(s, tg.x, tg.y);
      const fx = u.x, fy = u.y;
      ev.push({ k: 'swap', id: u.id, other: o ? o.id : null, a: [fx, fy], b: [tg.x, tg.y] });
      u.x = tg.x; u.y = tg.y;
      if (o) { o.x = fx; o.y = fy; }
      enterTile(s, u, ev);
      if (o) {
        enterTile(s, o, ev);
        if (u.pow >= 2 && !o.dead && o.side === 'bug') hitTile(s, o.x, o.y, 1, ev);
      }
    },
  },
  // Zap Laser: a beam through a whole line: 2 damage to the first tile, then 1 to every tile behind it. +1: 3 first. +2: mechs and houses are safe.
  laser: {
    dmg: (lv) => (lv >= 1 ? 3 : 2),
    line: true,
    targets: (s, u) => [0, 1, 2, 3].flatMap((d) => lineTiles(u, d, 1, 7)),
    fire(s, u, tg, ev) {
      const d = tg.d;
      let x = u.x, y = u.y, n = this.dmg(u.pow);
      const tiles = [];
      for (;;) {
        x += DIRS[d][0]; y += DIRS[d][1];
        if (!inside(x, y)) break;
        tiles.push([x, y]);
        if (solid(tileAt(s, x, y))) break;
      }
      ev.push({ k: 'shot', id: u.id, style: 'laser', from: [u.x, u.y], to: tiles[tiles.length - 1] || [u.x, u.y] });
      const opt = u.pow >= 2 ? { safe: true } : {};
      for (const [tx, ty] of tiles) { hitTile(s, tx, ty, n, ev, opt); n = Math.max(1, n - 1); }
    },
  },
  // Bubble Shield: bubbles up to 3 tiles away in a line: the tile and the two beside it. Bubbles keep mechs and houses safe from one hit.
  bubble: {
    range: (lv) => (lv >= 1 ? 5 : 3),
    targets(s, u) { return [0, 1, 2, 3].flatMap((d) => lineTiles(u, d, 1, this.range(u.pow))); },
    area(u, tg) {
      const out = [[tg.x, tg.y]];
      const side = [(tg.d + 1) % 4, (tg.d + 3) % 4];
      for (const d of side) out.push([tg.x + DIRS[d][0], tg.y + DIRS[d][1]]);
      if (u.pow >= 2) for (const d of [tg.d, opposite(tg.d)]) out.push([tg.x + DIRS[d][0], tg.y + DIRS[d][1]]);
      return out.filter(([x, y]) => inside(x, y));
    },
    fire(s, u, tg, ev) {
      ev.push({ k: 'shot', id: u.id, style: 'bubble', from: [u.x, u.y], to: [tg.x, tg.y] });
      for (const [x, y] of this.area(u, tg)) {
        const o = unitAt(s, x, y);
        const t = tileAt(s, x, y);
        if (o && (o.side === 'mech' && !o.ko || o.side === 'rock')) { if (!o.shield) { o.shield = true; o.fire = false; ev.push({ k: 'shield', id: o.id }); } }
        else if (!o && t.t === 'building' && !t.shield) { t.shield = true; ev.push({ k: 'shield', x, y }); tileEv(s, x, y, ev); }
      }
    },
  },
  // Puff Dash: fly 2 tiles in a line; the tile you fly over takes 1 and fills with smoke (bugs in smoke can't attack). +1: up to 3 tiles. +2: 2 damage.
  puff: {
    dmg: (lv) => (lv >= 2 ? 2 : 1),
    targets(s, u) {
      const far = u.pow >= 1 ? 3 : 2;
      return [0, 1, 2, 3].flatMap((d) => lineTiles(u, d, 2, far)).filter((tl) => standable(s, u, tl.x, tl.y));
    },
    fire(s, u, tg, ev) {
      const over = [];
      for (let k = 1; k < tg.k; k++) over.push([u.x + DIRS[tg.d][0] * k, u.y + DIRS[tg.d][1] * k]);
      moveUnit(s, u, tg.x, tg.y, ev, 'dash');
      for (const [x, y] of over) {
        hitTile(s, x, y, this.dmg(u.pow), ev);
        const t = tileAt(s, x, y);
        if (!t.smoke) { t.smoke = true; tileEv(s, x, y, ev); }
      }
    },
  },
  // Boulder Toss: throw a boulder 2+ tiles away: on a bug it does 2, on empty ground it stays as a rock wall. Neighbours are pushed away.
  boulder: {
    dmg: (lv) => (lv >= 1 ? 3 : 2),
    targets: (s, u) => [0, 1, 2, 3].flatMap((d) => lineTiles(u, d, 2, 7)),
    fire(s, u, tg, ev) {
      ev.push({ k: 'shot', id: u.id, style: 'boulder', from: [u.x, u.y], to: [tg.x, tg.y] });
      const o = unitAt(s, tg.x, tg.y);
      const t = tileAt(s, tg.x, tg.y);
      if (o || solid(t)) strike(s, tg.x, tg.y, this.dmg(u.pow), null, ev);
      else if (t.t === 'water') ev.push({ k: 'hit', x: tg.x, y: tg.y, n: 0 });
      else {
        const r = addUnit(s, { side: 'rock', type: 'rock', x: tg.x, y: tg.y, hp: u.pow >= 2 ? 2 : 1 });
        ev.push({ k: 'rock', id: r.id, x: tg.x, y: tg.y, hp: r.hp });
        if (t.crate) { t.crate = false; s.crateLost = true; tileEv(s, tg.x, tg.y, ev); }
      }
      for (let d = 0; d < 4; d++) strike(s, tg.x + DIRS[d][0], tg.y + DIRS[d][1], 0, d, ev);
    },
  },
};

/** Why a mech can't act right now (or null). */
export function cantAct(s, u) {
  if (!u || u.side !== 'mech' || u.ko) return 'ko';
  if (u.acted) return 'done';
  if (s.phase !== 'player') return 'wait';
  if (tileAt(s, u.x, u.y).smoke) return 'smoke';
  return null;
}

/** All target tiles for a mech: weapon targets plus its own tile for a repair. Each: { x, y, d, k, repair? } */
export function mechTargets(s, u) {
  if (cantAct(s, u)) return [];
  const out = u.wet ? [] : WEAPONS[MECHS[u.type].weapon].targets(s, u);
  if (u.hp < u.maxHp || u.fire) out.push({ x: u.x, y: u.y, d: -1, k: 0, repair: true });
  return out;
}

/** The target at (x, y) for a mech, or null. */
export function targetAt(s, u, x, y) {
  return mechTargets(s, u).find((tg) => tg.x === x && tg.y === y) || null;
}

/** The mech attacks (or repairs) at (x, y). Returns events or null. */
export function mechAct(s, id, x, y) {
  const u = unitById(s, id);
  if (cantAct(s, u)) return null;
  const tg = targetAt(s, u, x, y);
  if (!tg) return null;
  const ev = [];
  u.acted = true;
  u.moved = true;
  if (tg.repair) {
    u.hp = Math.min(u.maxHp, u.hp + 1);
    u.fire = false;
    ev.push({ k: 'repair', id: u.id, hp: u.hp });
  } else WEAPONS[MECHS[u.type].weapon].fire(s, u, tg, ev);
  cleanup(s);
  checkEnd(s, ev);
  return ev;
}

// ---------- bug attacks ----------

/**
 * The tiles a bug at (x, y) would hit with an attack in direction d (dist for the queen's lob):
 * [{ x, y, n, fire?, push? }]. Uses the board as it is now (projectiles stop at the first thing).
 */
export function attackTiles(s, b, x, y, d, dist = 0) {
  const kind = BUGS[b.type].atk;
  const n = b.dmg;
  const at = (dx, dy, extra = {}) => (inside(x + dx, y + dy) ? [{ x: x + dx, y: y + dy, n, ...extra }] : []);
  switch (kind) {
    case 'melee': return at(DIRS[d][0], DIRS[d][1]);
    case 'flame': return at(DIRS[d][0], DIRS[d][1], { fire: true });
    case 'spit': {
      const p = firstHit(s, x, y, d, b);
      return p ? [{ x: p[0], y: p[1], n }] : [];
    }
    case 'sweep': {
      const fx = DIRS[d][0], fy = DIRS[d][1];
      const l = DIRS[(d + 3) % 4], r = DIRS[(d + 1) % 4];
      return [...at(fx, fy), ...at(fx + l[0], fy + l[1]), ...at(fx + r[0], fy + r[1])];
    }
    case 'boom': return DIRS.flatMap(([dx, dy]) => at(dx, dy));
    case 'royal': {
      const cx = x + DIRS[d][0] * dist, cy = y + DIRS[d][1] * dist;
      if (!inside(cx, cy)) return [];
      return [{ x: cx, y: cy, n }, ...DIRS.map(([dx, dy], pd) => ({ x: cx + dx, y: cy + dy, n: 0, push: pd })).filter((h) => inside(h.x, h.y))];
    }
    default: return [];
  }
}

/** The tiles a bug's current intent will hit, from where it stands now (empty if it can't attack). */
export function intentTiles(s, b) {
  if (!b.intent || b.dead) return [];
  return attackTiles(s, b, b.x, b.y, b.intent.d, b.intent.dist);
}

/** Bugs that will attack this enemy phase, in order. */
export function attackers(s) {
  return bugs(s).filter((b) => b.intent);
}

function resolveIntent(s, b, ev) {
  if (b.dead || !b.intent) return;
  if (tileAt(s, b.x, b.y).smoke) { ev.push({ k: 'fizzle', id: b.id }); b.intent = null; return; }
  const hits = intentTiles(s, b);
  const kind = BUGS[b.type].atk;
  b.intent = null;
  ev.push({ k: 'attack', id: b.id, kind, tiles: hits.map((h) => [h.x, h.y]) });
  if (kind === 'boom') {
    // the boom bug pops itself to splash its neighbours
    b.exploded = true;
    kill(s, b, ev, 'boom');
    for (const h of hits) hitTile(s, h.x, h.y, h.n, ev);
    return;
  }
  for (const h of hits) {
    if (h.push !== undefined) strike(s, h.x, h.y, 0, h.push, ev);
    else hitTile(s, h.x, h.y, h.n, ev, { fire: !!h.fire });
  }
}

// ---------- bug planning (the "AI") ----------

/** How much a bug likes hitting these tiles. */
function scoreHits(s, b, hits) {
  let sc = 0;
  for (const h of hits) {
    if (h.n <= 0 && !h.fire) continue; // the queen's pushes only shove
    const t = tileAt(s, h.x, h.y);
    const o = unitAt(s, h.x, h.y);
    if (o && o !== b) {
      if (o.side === 'mech' && !o.ko) sc += o.shield ? 1 : 5 + (h.n >= o.hp ? 3 : 0);
      else if (o.side === 'bug') sc -= 6;
      else if (o.side === 'rock') sc += 1;
    } else if (t.t === 'building' && h.n > 0) sc += t.shield ? 1 : 10 * Math.min(h.n, t.hp) + (t.obj ? 6 : 0);
    else if (h.fire && t.t === 'forest') sc += 1;
  }
  return sc;
}

function attackOptions(b) {
  const kind = BUGS[b.type].atk;
  if (kind === 'boom') return [{ d: 0, dist: 0 }];
  if (kind === 'royal') { const out = []; for (let d = 0; d < 4; d++) for (let k = 2; k < 8; k++) out.push({ d, dist: k }); return out; }
  return [0, 1, 2, 3].map((d) => ({ d, dist: 0 }));
}

/** Distance to the nearest thing worth attacking (for bugs with nothing in reach). */
function goalDist(s, x, y) {
  let best = 99;
  s.tiles.forEach((t, i) => { if (t.t === 'building') best = Math.min(best, Math.abs((i % W) - x) + Math.abs(Math.floor(i / W) - y)); });
  for (const m of mechs(s)) if (!m.ko) best = Math.min(best, Math.abs(m.x - x) + Math.abs(m.y - y) + 1);
  return best;
}

/** One bug moves and picks its next attack. */
function planBug(s, b, ev) {
  const spots = [[b.x, b.y, []], ...[...reach(s, b).entries()].map(([k, p]) => [k % W, Math.floor(k / W), p])];
  const ox = b.x, oy = b.y;
  let best = null;
  for (const [x, y, path] of spots) {
    const t = tileAt(s, x, y);
    let pos = 0;
    if (t.fire && !b.flying) pos -= 4;
    if (t.smoke) pos -= 12;
    if (s.spawns.some((sp) => sp.x === x && sp.y === y)) pos -= 3;
    if (b.type === 'boomer') pos -= 0.2 * path.length; // boom bugs don't wander far
    b.x = x; b.y = y; // look from there
    for (const o of attackOptions(b)) {
      const hits = attackTiles(s, b, x, y, o.d, o.dist);
      if (!hits.length) continue;
      let sc = scoreHits(s, b, hits) + pos + rand(s) * 0.9;
      if (sc < 1) sc = Math.min(sc, 0) - goalDist(s, x, y) * 0.6 + rand(s) * 0.3;
      if (!best || sc > best.sc) best = { sc, x, y, path, ...o };
    }
  }
  b.x = ox; b.y = oy;
  if (!best) { b.intent = null; return; }
  if (best.path.length) {
    ev.push({ k: 'move', id: b.id, path: [[ox, oy], ...best.path] });
    b.x = best.x; b.y = best.y;
    enterTile(s, b, ev);
  }
  if (!b.dead) b.intent = { d: best.d, dist: best.dist };
}

/** Every bug moves and shows its next attack (oldest first, like they attack). */
export function planBugs(s, ev) {
  for (const b of bugs(s)) planBug(s, b, ev);
  // the queen lays an egg next to her each turn
  const q = bugs(s).find((b) => b.type === 'queen');
  if (q && s.eggs && s.turn < s.maxTurns) {
    const free = DIRS.map(([dx, dy]) => [q.x + dx, q.y + dy]).filter(([x, y]) => spawnOk(s, x, y));
    if (free.length) {
      const [x, y] = free[Math.floor(rand(s) * free.length)];
      s.spawns.push({ x, y, type: rand(s) < 0.5 ? 'beetle' : 'boomer', egg: true });
      ev.push({ k: 'egg', x, y });
    }
  }
  cleanup(s);
}

// ---------- spawning ----------

function spawnOk(s, x, y) {
  const t = tileAt(s, x, y);
  return !!t && !solid(t) && t.t !== 'water' && !t.fire && !unitAt(s, x, y) && !s.spawns.some((sp) => sp.x === x && sp.y === y);
}

/** Markers for the bugs that come up after the next player turn. */
export function placeSpawns(s) {
  if (s.turn >= s.maxTurns) return; // nobody comes up after the last turn
  const fixed = s.fixed?.[s.turn - 1];
  if (fixed) {
    for (const f of fixed) if (spawnOk(s, f.x, f.y)) s.spawns.push({ x: f.x, y: f.y, type: f.type, alpha: !!f.alpha });
    return;
  }
  const n = s.waves[s.turn - 1] || 0;
  const cand = [];
  for (let y = s.zone[0]; y <= s.zone[1]; y++) for (let x = 0; x < W; x++) if (spawnOk(s, x, y)) cand.push([x, y]);
  for (let i = 0; i < n && cand.length; i++) {
    const j = Math.floor(rand(s) * cand.length);
    const [x, y] = cand.splice(j, 1)[0];
    const type = s.pool[Math.floor(rand(s) * s.pool.length)];
    s.spawns.push({ x, y, type, alpha: rand(s) < s.alphaChance });
  }
}

function emerge(s, ev) {
  const list = s.spawns;
  s.spawns = [];
  for (const sp of list) {
    const o = unitAt(s, sp.x, sp.y);
    if (o) {
      ev.push({ k: 'blocked', x: sp.x, y: sp.y, id: o.id });
      hurt(s, o, 1, ev);
      continue;
    }
    const b = spawnBug(s, sp.type, sp.x, sp.y, sp.alpha);
    ev.push({ k: 'spawn', id: b.id, x: sp.x, y: sp.y, type: b.type, alpha: b.alpha });
  }
}

// ---------- turns ----------

function cleanup(s) {
  s.units = s.units.filter((u) => !u.dead);
}

/** Won or lost? (Power 0 or every mech knocked out loses; the queen popping wins the finale.) */
function checkEnd(s, ev) {
  if (s.phase === 'won' || s.phase === 'lost') return;
  if (s.power <= 0 || mechs(s).every((m) => m.ko)) { s.phase = 'lost'; ev.push({ k: 'lost' }); return; }
  if (s.finale && s.queenDead) { s.phase = 'won'; ev.push({ k: 'won', queen: true }); }
}

/** End the player turn: the whole enemy phase, up to the start of the next player turn. */
export function endTurn(s) {
  if (s.phase !== 'player') return null;
  const ev = [{ k: 'phase', phase: 'enemy' }];
  s.phase = 'enemy';
  // burning bugs
  for (const b of bugs(s)) if (b.fire) { ev.push({ k: 'burnTick', id: b.id }); hurt(s, b, 1, ev); }
  cleanup(s);
  // attacks, oldest bug first
  for (const b of bugs(s)) {
    resolveIntent(s, b, ev);
    checkEnd(s, ev);
    if (s.phase === 'lost' || s.phase === 'won') { cleanup(s); return ev; }
  }
  cleanup(s);
  // smoke drifts away
  s.tiles.forEach((t, i) => { if (t.smoke) { t.smoke = false; tileEv(s, i % W, Math.floor(i / W), ev); } });
  if (s.turn >= s.maxTurns) {
    s.phase = 'won';
    ev.push({ k: 'won' });
    return ev;
  }
  emerge(s, ev);
  cleanup(s);
  checkEnd(s, ev);
  if (s.phase === 'lost') return ev;
  s.turn++;
  planBugs(s, ev);
  placeSpawns(s);
  // the player's turn starts: burning mechs take 1, everyone is ready again
  for (const m of mechs(s)) {
    if (m.fire && !m.ko) { ev.push({ k: 'burnTick', id: m.id }); hurt(s, m, 1, ev); }
    m.moved = false; m.acted = false;
  }
  checkEnd(s, ev);
  if (s.phase === 'lost') return ev;
  s.phase = 'player';
  ev.push({ k: 'phase', phase: 'player', turn: s.turn });
  return ev;
}

// ---------- objectives ----------

/**
 * Bonus objective status: { done, failed, n?, of? }. done = earned if the battle ended now.
 * Kinds: protect (the star building takes no damage), kills n, drown n, noKO, crate, power n (lose at most n),
 * boss (pop the big bug), battery (keep the battery safe: +1 grid power).
 */
export function objectiveStatus(s, o) {
  switch (o.kind) {
    case 'protect': case 'battery': return { done: !s.objHit, failed: s.objHit };
    case 'kills': return { done: s.kills >= o.n, n: Math.min(s.kills, o.n), of: o.n };
    case 'drown': return { done: s.drowned >= o.n, n: Math.min(s.drowned, o.n), of: o.n };
    case 'noKO': { const ko = mechs(s).some((m) => m.ko); return { done: !ko, failed: ko }; }
    case 'crate': return { done: s.crateGot, failed: s.crateLost && !s.crateGot };
    case 'power': { const lost = s.powerStart - s.power; return { done: lost <= o.n, failed: lost > o.n }; }
    case 'boss': return { done: s.bossDead };
    default: return { done: false };
  }
}

// ---------- the preview ----------

/**
 * What an action would do, without doing it: runs it on a copy and compares.
 * Returns { ev, after, diff } where diff lists per-unit changes and tile/power changes.
 */
export function preview(s, fn) {
  const copy = structuredClone(s);
  const ev = fn(copy) || [];
  return { ev, after: copy, diff: diffStates(s, copy) };
}

export function diffStates(a, b) {
  const units = [];
  for (const u of a.units) {
    const v = b.units.find((w) => w.id === u.id);
    if (!v) { units.push({ id: u.id, x: u.x, y: u.y, gone: true, hp: u.hp, dmg: u.hp }); continue; }
    const ch = { id: u.id, x: u.x, y: u.y };
    let any = false;
    if (v.x !== u.x || v.y !== u.y) { ch.to = [v.x, v.y]; any = true; }
    if (v.hp !== u.hp) { ch.dmg = u.hp - v.hp; ch.hp = v.hp; any = true; }
    if (v.ko && !u.ko) { ch.ko = true; any = true; }
    if (v.shield !== u.shield) { ch.shield = v.shield; any = true; }
    if (v.fire && !u.fire) { ch.fire = true; any = true; }
    if (v.wet && !u.wet) { ch.wet = true; any = true; }
    if (any) units.push(ch);
  }
  const born = b.units.filter((v) => !a.units.some((u) => u.id === v.id)).map((v) => ({ id: v.id, x: v.x, y: v.y, type: v.type, side: v.side }));
  const tiles = [];
  a.tiles.forEach((t, i) => {
    const v = b.tiles[i];
    if (t.t !== v.t || t.hp !== v.hp || t.fire !== v.fire || t.smoke !== v.smoke || t.shield !== v.shield || t.crate !== v.crate) {
      tiles.push({ x: i % W, y: Math.floor(i / W), from: t, to: v, power: t.t === 'building' ? (t.hp - (v.t === 'building' ? v.hp : 0)) : 0 });
    }
  });
  return { units, born, tiles, power: a.power - b.power, won: b.phase === 'won' && a.phase !== 'won', lost: b.phase === 'lost' && a.phase !== 'lost' };
}
