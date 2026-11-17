import * as THREE from 'three';
import { t } from '../../../core/i18n.js';
import { M, BOX, SPH, CONE, CYL, toon, cx, cz, checker } from './util.js';

// Block Drop (falling blocks): pieces of four blocks fall into a well; move and turn them so they fill whole rows,
// and full rows clear. The well filling to the top ends the game. Teaches seeing shapes and where they fit
// (spatial reasoning). The ghost (where the piece will land) is always shown; every kind of piece has its own
// colour and its own little sticker shape (never colour alone). Help me play: game speed slows the fall;
// forgiving timing gives a longer moment on the ground before a piece locks. Puzzle: clear N rows (a few rows
// with gaps are there already).

const SHAPES = {
  I: { cells: [[0, 1], [1, 1], [2, 1], [3, 1]], color: 0x4cc9f0, mark: 'bar' },
  O: { cells: [[1, 0], [2, 0], [1, 1], [2, 1]], color: 0xffd23f, mark: 'dot' },
  T: { cells: [[1, 0], [0, 1], [1, 1], [2, 1]], color: 0x9b5de5, mark: 'tri' },
  S: { cells: [[1, 0], [2, 0], [0, 1], [1, 1]], color: 0x3ddc97, mark: 'leaf' },
  Z: { cells: [[0, 0], [1, 0], [1, 1], [2, 1]], color: 0xff5d73, mark: 'heart' },
  J: { cells: [[0, 0], [0, 1], [1, 1], [2, 1]], color: 0x5b6cf0, mark: 'ring' },
  L: { cells: [[2, 0], [0, 1], [1, 1], [2, 1]], color: 0xff9f1c, mark: 'star' },
};
const KINDS = Object.keys(SHAPES);
const SCORE = [0, 10, 30, 50, 80];

function rotate(cells, kind, times) {
  let out = cells.map(([x, y]) => [x, y]);
  if (kind === 'O') return out;
  const n = kind === 'I' ? 4 : 3;
  for (let i = 0; i < ((times % 4) + 4) % 4; i++) out = out.map(([x, y]) => [n - 1 - y, x]);
  return out;
}

function markMesh(mark) {
  switch (mark) {
    case 'bar': return M(BOX(0.5, 0.06, 0.14), 0xffffff);
    case 'dot': return M(SPH(0.14, 10, 6), 0xffffff);
    case 'tri': { const m = M(CONE(0.17, 0.08, 3), 0xffffff); return m; }
    case 'leaf': { const m = M(SPH(0.15, 8, 6), 0xffffff); m.scale.set(1.4, 0.4, 0.7); return m; }
    case 'heart': { const g = new THREE.Group(); g.add(M(SPH(0.09, 8, 6), 0xffffff, -0.07, 0, 0), M(SPH(0.09, 8, 6), 0xffffff, 0.07, 0, 0), M(CONE(0.12, 0.06, 4), 0xffffff, 0, 0, 0.1)); return g; }
    case 'ring': { const m = M(CYL(0.16, 0.16, 0.05, 12), 0xffffff); return m; }
    default: { const m = M(CONE(0.17, 0.06, 5), 0xffffff); return m; }
  }
}

export class BlocksGame {
  constructor(kit) {
    this.kit = kit;
    const P = kit.puzzle;
    this.cols = 10;
    this.rows = P?.rows || 18;
    this.goal = P?.goal?.lines || 0;
    this.w = this.cols + 5; // the well and the "next" box
    this.h = this.rows;
    this.ox = -2.5; // the well's centre (x), the next box to its right
    const floor = checker(this.cols, this.rows, '#3a3160', '#342b58');
    floor.position.set(this.ox, -0.02, 0);
    kit.root.add(floor);
    const nb = M(BOX(4, 0.1, 4), 0x3a3160, this.ox + this.cols / 2 + 2.6, -0.05, cz(2, this.rows));
    kit.root.add(nb);
    this.pool = [];
    this.used = 0;
    this.reset();
  }

  reset() {
    this.grid = Array.from({ length: this.rows }, () => Array(this.cols).fill(null));
    const P = this.kit.puzzle;
    // a puzzle starts with a few rows already there, one gap each
    for (let i = 0; i < (P?.garbage || 0); i++) {
      const r = this.rows - 1 - i, gap = Math.floor(this.kit.rng() * this.cols);
      for (let c = 0; c < this.cols; c++) if (c !== gap) this.grid[r][c] = 'G';
    }
    this.bag = [];
    this.next = this.draw();
    this.lines = 0;
    this.score = 0;
    this.state = 'play';
    this.fallT = 0;
    this.lockT = 0;
    this.flash = [];
    this.spawn();
  }

  draw() {
    if (!this.bag.length) {
      this.bag = [...KINDS];
      for (let i = this.bag.length - 1; i > 0; i--) { const j = Math.floor(this.kit.rng() * (i + 1)); [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]]; }
    }
    return this.bag.pop();
  }

  spawn() {
    this.kind = this.next;
    this.next = this.draw();
    this.rot = 0;
    this.px = 3;
    this.py = 0;
    this.lockT = 0;
    if (!this.fits(this.px, this.py, this.rot)) { this.state = 'over'; this.kit.sfx('bump'); this.kit.shake(0.5); }
  }

  cells(px = this.px, py = this.py, rot = this.rot, kind = this.kind) {
    return rotate(SHAPES[kind].cells, kind, rot).map(([x, y]) => [px + x, py + y]);
  }

  fits(px, py, rot) {
    return this.cells(px, py, rot).every(([x, y]) => x >= 0 && x < this.cols && y < this.rows && (y < 0 || !this.grid[y][x]));
  }

  get gravity() { return Math.max(0.16, 0.85 - Math.floor(this.lines / 8) * 0.08); }

  move(dx) {
    if (this.fits(this.px + dx, this.py, this.rot)) { this.px += dx; this.lockT = 0; this.kit.sfx('select'); this.kit.did('move'); return true; }
    return false;
  }

  turn(dir) {
    const r = this.rot + dir;
    for (const k of [0, -1, 1, -2, 2]) {
      if (this.fits(this.px + k, this.py, r)) { this.px += k; this.rot = r; this.lockT = 0; this.kit.sfx('pop'); this.kit.did('turn'); return true; }
    }
    return false;
  }

  landY() {
    let y = this.py;
    while (this.fits(this.px, y + 1, this.rot)) y++;
    return y;
  }

  update(dt, I) {
    if (this.clearT > 0) { this.clearT -= dt; if (this.clearT <= 0) this.collapse(); this.render(); return; }
    if (I.repX) this.move(I.repX);
    if (I.aPressed) this.turn(1);
    if (I.bPressed) this.turn(-1);
    if (I.stepY > 0) { // up: drop it all the way
      const y = this.landY();
      this.score += (y - this.py);
      this.py = y;
      this.kit.did('drop');
      this.lock();
      this.render();
      return;
    }
    const soft = I.y < -0.5;
    if (soft) this.kit.did('soft');
    this.fallT += dt * (soft ? 12 : 1);
    if (this.fallT >= this.gravity) {
      this.fallT = 0;
      if (this.fits(this.px, this.py + 1, this.rot)) { this.py++; if (soft) this.score += 1; }
    }
    if (!this.fits(this.px, this.py + 1, this.rot)) {
      this.lockT += dt;
      if (this.lockT >= 0.5 * this.kit.timing()) this.lock();
    }
    this.render();
  }

  lock() {
    for (const [x, y] of this.cells()) {
      if (y < 0) { this.state = 'over'; this.kit.sfx('bump'); return; }
      this.grid[y][x] = this.kind;
    }
    this.kit.sfx('land');
    const full = [];
    for (let r = 0; r < this.rows; r++) if (this.grid[r].every(Boolean)) full.push(r);
    if (full.length) {
      this.flash = full;
      this.clearT = 0.35;
      this.lines += full.length;
      this.score += SCORE[full.length] * (1 + Math.floor(this.lines / 8));
      this.kit.did('line');
      this.kit.tone(76 + full.length * 3, 0.25, { type: 'square', vol: 0.07 });
      for (const r of full) this.kit.puff(this.ox, cz(r, this.rows), 0xffffff, { count: 20, speed: 5 });
      if (this.goal && this.lines >= this.goal) { this.collapse(); this.state = 'won'; return; }
      return;
    }
    this.spawn();
  }

  collapse() {
    for (const r of this.flash) { this.grid.splice(r, 1); this.grid.unshift(Array(this.cols).fill(null)); }
    this.flash = [];
    this.clearT = 0;
    if (this.state === 'play') this.spawn();
  }

  block(color, x, z, y = 0.25, mark = null, ghost = false) {
    let b = this.pool[this.used];
    if (!b) {
      b = new THREE.Group();
      b.add(M(BOX(0.92, 0.5, 0.92), 0xffffff));
      b.userData.mark = null;
      this.kit.root.add(b);
      this.pool.push(b);
    }
    this.used++;
    b.visible = true;
    const body = b.children[0];
    body.material = ghost ? toon(color, { transparent: true, opacity: 0.3 }) : toon(color);
    if (b.userData.markKind !== mark) {
      if (b.userData.mark) b.remove(b.userData.mark);
      b.userData.mark = mark ? markMesh(mark) : null;
      if (b.userData.mark) { b.userData.mark.position.y = 0.27; b.add(b.userData.mark); }
      b.userData.markKind = mark;
    }
    if (b.userData.mark) b.userData.mark.visible = !ghost;
    b.position.set(x, y, z);
    return b;
  }

  render() {
    this.used = 0;
    const X = (c) => this.ox + cx(c, this.cols);
    for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) {
      const k = this.grid[r][c];
      if (!k) continue;
      const lit = this.flash.includes(r);
      const S = SHAPES[k];
      this.block(lit ? 0xffffff : S ? S.color : 0x8a7ab8, X(c), cz(r, this.rows), 0.25, S ? S.mark : null);
    }
    if (this.state === 'play' && !this.clearT) {
      const S = SHAPES[this.kind];
      const gy = this.landY();
      for (const [x, y] of this.cells(this.px, gy)) if (y >= 0) this.block(S.color, X(x), cz(y, this.rows), 0.05, null, true);
      for (const [x, y] of this.cells()) if (y >= 0) this.block(S.color, X(x), cz(y, this.rows), 0.35, S.mark);
    }
    // the next piece
    const N = SHAPES[this.next];
    for (const [x, y] of rotate(N.cells, this.next, 0)) this.block(N.color, this.ox + this.cols / 2 + 1.1 + x * 0.9, cz(1 + y, this.rows), 0.25, N.mark);
    for (let i = this.used; i < this.pool.length; i++) this.pool[i].visible = false;
  }

  idle() { if (this.used === 0) this.render(); }

  hud() { return [[t('arc.blocks.lines'), this.lines], [t('arc.score'), this.score]]; }
  goalText() { return t('arc.blocks.goal', { n: this.goal, got: this.lines }); }
  keys() { return 'arc.blocks.keys'; }
  overText() { return t('arc.blocks.again'); }
  poorGame() { return this.lines < 2; }

  steps() {
    return [
      { key: 'arc.blocks.t1', on: 'move' },
      { key: 'arc.blocks.t2', on: 'turn' },
      { key: 'arc.blocks.t3', on: ['soft', 'drop'] },
      { key: 'arc.blocks.t4', time: 5 },
    ];
  }

  stats() {
    const L = this.lines;
    return { mastery: [10, 25, 50].filter((n) => L >= n).map((n) => `l${n}`), trials: L >= 10 ? ['blocks.ten'] : [] };
  }
}
