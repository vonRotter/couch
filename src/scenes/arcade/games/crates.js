import * as THREE from 'three';
import { t } from '../../../core/i18n.js';
import { Character } from '../../../core/character.js';
import { markA11y } from '../../../core/outline.js';
import { PLAYER_COLORS } from '../../../core/palette.js';
import { M, BOX, CYL, CONE, glow, cx, cz } from './util.js';

// Crate Shove (box pushing): push every crate onto a glowing spot on the dock. Crates can only be pushed, never
// pulled, so a crate in a corner is stuck: think first, then push. [A] takes a move back (as often as you like),
// [B] twice starts the level again. Teaches planning ahead, and that undo is a tool, not a failure. The levels
// were made for this game and checked with a solver (tests/arcade); a level done counts, best = levels cleared.
// Puzzle: one level of its own (puzzles.js).

// '#' wall, ' ' floor, '.' spot, '$' crate, '*' crate on a spot, '@' you, '+' you on a spot
export const CRATE_LEVELS = [
  ['#######', '#     #', '# @$ .#', '#     #', '#######'],
  ['######', '#    #', '# $  #', '#@ # #', '#  #.#', '######'],
  ['  ######', '  #    #', '### $$ #', '#  .#. #', '# @    #', '#####  #', '    ####'],
  ['#######', '#.   .#', '#  $  #', '#  $@ #', '#     #', '#######'],
  ['########', '#   #  #', '# $   .#', '#  ##$ #', '#.  @  #', '########'],
  ['#######', '##  . #', '#  $# #', '# #@$ #', '# .   #', '###   #', '  #####'],
  ['########', '#  .#  #', '# #$$  #', '#   .# #', '## @   #', ' #  ####', ' ####'],
  ['########', '#  .   #', '# $##$ #', '#  @   #', '# $##$ #', '#  .  .#', '###  . #', '  ######'],
  [' ######', ' #    #', '## ## #', '#  $  #', '# .#$.#', '# @   #', '#######'],
  ['#########', '#   #   #', '# $ . $ #', '#  ###  #', '#.  @  .#', '#  ###  #', '# $   $ #', '#   .   #', '#########'],
];

export function parseCrates(lines) {
  const H = lines.length, W = Math.max(...lines.map((l) => l.length));
  const wall = [], goals = [], boxes = [];
  let p = null;
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
    const ch = lines[r][c] || ' ';
    if (ch === '#') wall.push([c, r]);
    if ('.*+'.includes(ch)) goals.push([c, r]);
    if ('$*'.includes(ch)) boxes.push([c, r]);
    if ('@+'.includes(ch)) p = [c, r];
  }
  // floor: what you can reach from the start (outside the walls stays empty)
  const floor = new Set();
  const isWall = new Set(wall.map(([c, r]) => r * W + c));
  const q = [p];
  floor.add(p[1] * W + p[0]);
  while (q.length) {
    const [c, r] = q.pop();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const n = (r + dy) * W + c + dx;
      if (c + dx < 0 || r + dy < 0 || c + dx >= W || r + dy >= H || isWall.has(n) || floor.has(n)) continue;
      floor.add(n);
      q.push([c + dx, r + dy]);
    }
  }
  return { W, H, wall, goals, boxes, p, floor, isWall };
}

export class CratesGame {
  constructor(kit) {
    this.kit = kit;
    const P = kit.puzzle;
    this.level = Math.min(kit.level || 0, CRATE_LEVELS.length - 1);
    this.levelCount = CRATE_LEVELS.length;
    this.L = parseCrates(P?.crates || CRATE_LEVELS[this.level]);
    const L = this.L;
    this.w = L.W; this.h = L.H;
    const root = kit.root;
    const X = (c) => cx(c, L.W), Z = (r) => cz(r, L.H);
    for (const n of L.floor) root.add(M(BOX(0.98, 0.1, 0.98), (n % L.W + Math.floor(n / L.W)) % 2 ? 0xd8a874 : 0xcf9d68, X(n % L.W), -0.02, Z(Math.floor(n / L.W))));
    for (const [c, r] of L.wall) {
      const g = new THREE.Group();
      g.add(M(BOX(1, 0.8, 1), 0x8a8fa8), M(BOX(0.7, 0.12, 0.7), 0x9fa5c0, 0, 0.44, 0));
      g.position.set(X(c), 0.4, Z(r));
      root.add(g);
    }
    this.spots = L.goals.map(([c, r]) => {
      const s = new THREE.Group();
      s.add(M(CYL(0.4, 0.4, 0.06, 20), glow(0x3ddc97, 0x0e5a38)), M(CYL(0.22, 0.22, 0.08, 16), 0xffffff, 0, 0.01, 0));
      s.position.set(X(c), 0.05, Z(r));
      root.add(s);
      return s;
    });
    this.crateM = L.boxes.map(() => {
      const g = new THREE.Group();
      const body = M(BOX(0.82, 0.78, 0.82), 0xc68a52);
      g.add(body);
      for (const s of [-1, 1]) { const b = M(BOX(0.95, 0.1, 0.12), 0x8a5a32); b.rotation.y = s * Math.PI / 4; b.position.y = 0.4; g.add(b); }
      const star = M(CONE(0.22, 0.14, 5), glow(0xffd23f, 0x6a5000), 0, 0.5, 0); // on a spot: a star on top (not colour only)
      g.add(star);
      g.userData = { body, star };
      markA11y(g, 'item', [body]);
      root.add(g);
      return g;
    });
    const p = kit.p;
    this.bean = new Character(p?.color ?? PLAYER_COLORS[0].hex, { hat: p?.hat ?? 0 });
    this.bean.group.scale.setScalar(0.62);
    root.add(this.bean.group);
    this.reset();
  }

  reset() {
    const L = this.L;
    this.pos = [...L.p];
    this.from = [...L.p];
    this.boxes = L.boxes.map((b) => [...b]);
    this.boxFrom = this.boxes.map((b) => [...b]);
    this.hist = [];
    this.moves = 0;
    this.undos = 0;
    this.restarts = this.restarts || 0;
    this.k = 1;
    this.state = 'play';
    this.tryT = 0;
    this.again = 0;
    this.place();
  }

  wall(c, r) { const L = this.L; return c < 0 || r < 0 || c >= L.W || r >= L.H || L.isWall.has(r * L.W + c); }
  boxAt(c, r) { return this.boxes.findIndex(([x, y]) => x === c && y === r); }
  onGoal(c, r) { return this.L.goals.some(([x, y]) => x === c && y === r); }
  get done() { return this.boxes.every(([c, r]) => this.onGoal(c, r)); }

  walk(dx, dy) {
    const [c, r] = this.pos;
    const n = [c + dx, r + dy];
    this.bean.face(dx, dy);
    if (this.wall(...n)) { this.kit.sfx('bump'); return; }
    const bi = this.boxAt(...n);
    this.boxFrom = this.boxes.map((b) => [...b]);
    if (bi >= 0) {
      const b2 = [n[0] + dx, n[1] + dy];
      if (this.wall(...b2) || this.boxAt(...b2) >= 0) { this.kit.sfx('bump'); return; }
      this.hist.push({ p: [c, r], bi, b: [...this.boxes[bi]] });
      this.boxes[bi] = b2;
      this.kit.sfx('dash');
      this.kit.did('push');
      if (this.onGoal(...b2)) { this.kit.tone(79, 0.18); this.kit.puff(cx(b2[0], this.L.W), cz(b2[1], this.L.H), 0x3ddc97); }
    } else this.hist.push({ p: [c, r], bi: -1 });
    this.from = [c, r];
    this.pos = n;
    this.k = 0;
    this.moves++;
    this.kit.did('walk');
    if (this.done) { this.state = this.kit.puzzle ? 'won' : 'level'; this.kit.sfx('star'); }
  }

  undo() {
    const h = this.hist.pop();
    if (!h) { this.kit.sfx('bump'); return; }
    this.boxFrom = this.boxes.map((b) => [...b]);
    this.from = [...this.pos];
    this.pos = h.p;
    if (h.bi >= 0) this.boxes[h.bi] = h.b;
    this.k = 0.4;
    this.moves = Math.max(0, this.moves - 1);
    this.undos++;
    this.kit.sfx('select');
    this.kit.did('undo');
  }

  update(dt, I) {
    this.tryT += dt;
    if (this.tryT > (this.kit.puzzle ? 30 : 60)) { this.tryT = 0; this.kit.fail('any'); }
    if (this.again > 0) this.again -= dt;
    if (I.aPressed) this.undo();
    else if (I.bPressed) {
      if (this.again > 0) { this.restarts++; this.kit.fail('any'); this.reset(); this.kit.sfx('whoosh'); this.kit.did('restart'); return; }
      this.again = 2;
      this.kit.sfx('select');
    } else if (this.k >= 1) {
      if (I.repX) this.walk(I.repX, 0);
      else if (I.repY) this.walk(0, -I.repY);
    }
    this.k = Math.min(1, this.k + dt * 9);
    this.place(dt);
  }

  place(dt = 0) {
    const L = this.L, k = this.k;
    const X = (c) => cx(c, L.W), Z = (r) => cz(r, L.H);
    this.bean.group.position.set(X(this.from[0] + (this.pos[0] - this.from[0]) * k), 0.05, Z(this.from[1] + (this.pos[1] - this.from[1]) * k));
    this.bean.update(dt, { moving: k < 1 ? 1 : 0, grounded: true });
    this.boxes.forEach(([c, r], i) => {
      const f = this.boxFrom[i] || [c, r];
      const g = this.crateM[i];
      g.position.set(X(f[0] + (c - f[0]) * k), 0.4, Z(f[1] + (r - f[1]) * k));
      const on = this.onGoal(c, r);
      g.userData.star.visible = on;
      g.userData.body.material = on ? glow(0x9be36a, 0x204a10) : glow(0xc68a52, 0x000000);
    });
  }

  idle(dt) { this.place(dt); }

  hud() {
    const h = [[t('arc.crates.moves'), this.moves]];
    if (!this.kit.puzzle) h.unshift([t('arc.level'), this.level + 1]);
    if (this.again > 0) h.push([t('arc.crates.again'), '']);
    return h;
  }
  goalText() { const n = this.boxes.filter(([c, r]) => this.onGoal(c, r)).length; return t('arc.crates.goal', { got: n, n: this.boxes.length }); }
  keys() { return 'arc.crates.keys'; }
  levelText() { return this.undos ? t('arc.crates.doneUndo', { n: this.moves }) : t('arc.crates.doneClean', { n: this.moves }); }

  steps() {
    return [
      { key: 'arc.crates.t1', on: 'push' },
      { key: 'arc.crates.t2', on: 'undo' },
      { key: 'arc.crates.t3', time: 5 },
    ];
  }

  stats() {
    const clean = this.undos === 0 && this.restarts === 0;
    return { mastery: [2, 5, 8].filter((n) => this.level >= n).map((n) => `lv${n + 1}`), trials: this.level >= 3 && clean && !this.kit.puzzle ? ['crates.noundo'] : [] };
  }
}
