import * as THREE from 'three';
import { t } from '../../../core/i18n.js';
import { Character } from '../../../core/character.js';
import { markA11y } from '../../../core/outline.js';
import { seeded } from '../../../core/world.js';
import { PLAYER_COLORS } from '../../../core/palette.js';
import { M, BOX, SPH, CYL, CONE, glow, cx, cz } from './util.js';

// Tunnel Trek (a maze): walk your own bean through dark tunnels to the lantern at the far end. Only what your
// little light shows can be seen, but tunnels you have walked stay drawn (a map in your head, and on the
// screen); [B] lights up the whole map for a moment (three peeks a level). Teaches finding a way and reading a
// map. The mazes are the same every time (made from the level number), so a hard one can be learned. No timer,
// nothing to lose; bumping into a wall only counts a bump (a maze without a bump is Coach's trial).
// Puzzle: one maze of its own.

export const MAZE_LEVELS = 12;
const LIGHT = 2.6;
const PEEK = 2.5;

/** Rooms (w x h) for a level: 4x4, 5x4, 5x5, 6x5 ... up to 10x8. */
export function mazeSize(n) { return { w: Math.min(10, 4 + Math.ceil(n / 2)), h: Math.min(8, 4 + Math.floor(n / 2)) }; }

/** A maze as tiles (1 wall, 0 tunnel) of (2w+1) x (2h+1): a backtracker on rooms, seeded. Start top-left, end bottom-right. */
export function makeMaze(w, h, seed) {
  const rnd = seeded(seed);
  const W = w * 2 + 1, H = h * 2 + 1;
  const g = Array.from({ length: H }, () => Array(W).fill(1));
  const seen = new Set();
  const stack = [[0, 0]];
  seen.add('0,0');
  g[1][1] = 0;
  while (stack.length) {
    const [x, y] = stack[stack.length - 1];
    const next = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [x + dx, y + dy, dx, dy]).filter(([nx, ny]) => nx >= 0 && ny >= 0 && nx < w && ny < h && !seen.has(`${nx},${ny}`));
    if (!next.length) { stack.pop(); continue; }
    const [nx, ny, dx, dy] = next[Math.floor(rnd() * next.length)];
    g[y * 2 + 1 + dy][x * 2 + 1 + dx] = 0;
    g[ny * 2 + 1][nx * 2 + 1] = 0;
    seen.add(`${nx},${ny}`);
    stack.push([nx, ny]);
  }
  return { g, W, H, start: { c: 1, r: 1 }, end: { c: W - 2, r: H - 2 } };
}

export class MazeGame {
  constructor(kit) {
    this.kit = kit;
    const P = kit.puzzle;
    this.level = kit.level || 0;
    this.levelCount = MAZE_LEVELS;
    const size = P?.maze || mazeSize(this.level);
    const mz = makeMaze(size.w, size.h, P ? (P.seed || 77) : 4100 + this.level * 13);
    Object.assign(this, mz);
    this.w = this.W; this.h = this.H;
    const root = kit.root;
    root.add(M(BOX(this.W, 0.1, this.H), 0x1f1830, 0, -0.06, 0));
    this.tiles = [];
    for (let r = 0; r < this.H; r++) for (let c = 0; c < this.W; c++) {
      const wall = this.g[r][c] === 1;
      const m = wall ? M(BOX(1, 0.9, 1), (r + c) % 3 ? 0x9a6440 : 0x8a5a32, cx(c, this.W), 0.45, cz(r, this.H)) : M(BOX(0.98, 0.06, 0.98), (r + c) % 2 ? 0xe8c99a : 0xdcb987, cx(c, this.W), 0.0, cz(r, this.H));
      m.visible = false;
      root.add(m);
      this.tiles.push({ c, r, m, wall, seen: false });
    }
    // the lantern at the end
    const L = new THREE.Group();
    L.add(M(CYL(0.08, 0.1, 0.9, 8), 0x5a4a3a, 0, 0.45, 0), M(BOX(0.4, 0.45, 0.4), glow(0xffd23f, 0x806000), 0, 1.05, 0), M(CONE(0.3, 0.22, 4), 0x2b2340, 0, 1.38, 0));
    L.position.set(cx(this.end.c, this.W), 0, cz(this.end.r, this.H));
    markA11y(L, 'target');
    root.add(L);
    this.lantern = L;
    const p = kit.p;
    this.bean = new Character(p?.color ?? PLAYER_COLORS[0].hex, { hat: p?.hat ?? 0 });
    this.bean.group.scale.setScalar(0.62);
    root.add(this.bean.group);
    this.light = new THREE.PointLight(0xffe8b0, 1.2, 6);
    root.add(this.light);
    this.reset();
  }

  reset() {
    this.pos = { ...this.start };
    this.from = { ...this.start };
    this.k = 1;
    this.bumps = 0;
    this.peeks = 3;
    this.peekT = 0;
    this.time = 0;
    this.tryT = 0;
    this.state = 'play';
    for (const tl of this.tiles) tl.seen = false;
    this.see();
    this.place();
  }

  tile(c, r) { return this.tiles[r * this.W + c]; }
  open(c, r) { return c >= 0 && r >= 0 && c < this.W && r < this.H && this.g[r][c] === 0; }

  see() {
    const { c, r } = this.pos;
    for (const tl of this.tiles) if (Math.hypot(tl.c - c, tl.r - r) <= LIGHT) tl.seen = true;
  }

  walk(dx, dy) {
    const n = { c: this.pos.c + dx, r: this.pos.r + dy };
    this.bean.face(dx, dy);
    if (!this.open(n.c, n.r)) { this.bumps++; this.kit.sfx('bump'); this.bean.squash?.(0.3); this.kit.did('bump'); return; }
    this.from = { ...this.pos };
    this.pos = n;
    this.k = 0;
    this.kit.did('walk');
    this.see();
    if (n.c === this.end.c && n.r === this.end.r) {
      this.state = this.kit.puzzle ? 'won' : 'level';
      this.kit.sfx('star');
      this.kit.did('end');
    }
  }

  update(dt, I) {
    this.time += dt;
    // stuck for a while: counts as a try (a skip is offered after a few: assist.js)
    this.tryT += dt;
    if (this.tryT > (this.kit.puzzle ? 30 : 75)) { this.tryT = 0; this.kit.fail('any'); }
    if (this.k >= 1) {
      if (I.repX) this.walk(I.repX, 0);
      else if (I.repY) this.walk(0, -I.repY);
    }
    if (I.bPressed && this.peeks > 0 && this.peekT <= 0) { this.peeks--; this.peekT = PEEK; this.kit.sfx('select'); this.kit.did('peek'); }
    if (this.peekT > 0) this.peekT -= dt;
    this.k = Math.min(1, this.k + dt * 9);
    this.place(dt);
  }

  place(dt = 0) {
    const x = cx(this.from.c + (this.pos.c - this.from.c) * this.k, this.W);
    const z = cz(this.from.r + (this.pos.r - this.from.r) * this.k, this.H);
    this.bean.group.position.set(x, 0.05, z);
    this.bean.update(dt, { moving: this.k < 1 ? 1 : 0, grounded: true });
    this.light.position.set(x, 1.6, z);
    const peek = this.peekT > 0;
    const { c, r } = this.pos;
    for (const tl of this.tiles) {
      const near = Math.hypot(tl.c - c, tl.r - r) <= LIGHT;
      tl.m.visible = tl.seen || peek;
      tl.m.scale.y = tl.wall && !near && !peek ? 0.45 : 1; // walls further away sink a little: a map
      if (tl.wall) tl.m.position.y = tl.m.scale.y * 0.45;
    }
    this.lantern.visible = true;
    this.lantern.rotation.y += dt;
  }

  idle(dt) { this.place(dt); }

  hud() { return this.kit.puzzle ? [[t('arc.maze.peeks'), this.peeks]] : [[t('arc.level'), this.level + 1], [t('arc.maze.bumps'), this.bumps], [t('arc.maze.peeks'), this.peeks]]; }
  goalText() { return t('arc.maze.goal'); }
  keys() { return 'arc.maze.keys'; }
  levelText() { return this.bumps ? t('arc.maze.doneBumps', { n: this.bumps }) : t('arc.maze.doneClean'); }

  steps() {
    return [
      { key: 'arc.maze.t1', on: 'walk' },
      { key: 'arc.maze.t2', on: 'peek' },
      { key: 'arc.maze.t3', time: 5 },
    ];
  }

  stats() {
    const mastery = [2, 5, 8].filter((n) => this.level >= n).map((n) => `lv${n + 1}`);
    return { mastery, trials: this.level >= 2 && this.bumps === 0 && !this.kit.puzzle ? ['maze.clean'] : [] };
  }

  dispose() { this.light.dispose?.(); }
}
