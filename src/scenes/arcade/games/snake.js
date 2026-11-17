import * as THREE from 'three';
import { t } from '../../../core/i18n.js';
import { markA11y } from '../../../core/outline.js';
import { M, SPH, CONE, BOX, checker, eyes, cx, cz } from './util.js';

// Wiggle Worm (the snake game): steer a worm round the garden bed, eat berries, grow longer; bump into the fence
// or your own tail and the game is over. Teaches reacting in time and planning ahead (where will my tail be?).
// Help me play: game speed slows the steps; forgiving timing gives a moment's grace before a bump (the worm stops,
// wobbles, and waits for a turn); turns are buffered (two ahead). Puzzle: eat N berries.

const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const BODY = 0x8ac926, BODY2 = 0x6aa82a, HEAD = 0xa8e04a;

export class SnakeGame {
  constructor(kit) {
    this.kit = kit;
    const P = kit.puzzle;
    this.cols = P?.cols || 15;
    this.rows = P?.rows || 13;
    this.w = this.cols; this.h = this.rows;
    this.goal = P?.goal?.eat || 0;
    this.base = P ? 0.24 : 0.2;
    const root = kit.root;
    const floor = checker(this.cols, this.rows, '#9fdc6a', '#8fd05a');
    floor.position.y = -0.02;
    root.add(floor);
    this.segs = [];
    this.headM = new THREE.Group();
    this.headM.add(M(SPH(0.48), HEAD));
    const e = eyes(1.4, 0.17);
    e.position.set(0, 0.22, 0.3);
    this.headM.add(e);
    this.headM.add(M(SPH(0.07, 8, 6), 0xff7eb6, -0.28, 0.02, 0.33), M(SPH(0.07, 8, 6), 0xff7eb6, 0.28, 0.02, 0.33));
    markA11y(this.headM, 'player');
    root.add(this.headM);
    this.berry = new THREE.Group();
    this.berry.add(M(SPH(0.34), 0xff3b5c), M(CONE(0.12, 0.2, 5), 0x3a9a3a, 0, 0.36, 0), M(SPH(0.06, 6, 4), 0xffffff, 0.12, 0.16, 0.22));
    markA11y(this.berry, 'target');
    root.add(this.berry);
    this.bump = M(BOX(0.18, 0.7, 0.18), 0xffd23f);
    this.bump.visible = false;
    root.add(this.bump);
    this.reset();
  }

  reset() {
    const r = Math.floor(this.rows / 2), c = Math.floor(this.cols / 2) - 2;
    this.body = [{ c, r }, { c: c - 1, r }, { c: c - 2, r }];
    this.prev = this.body.map((s) => ({ ...s }));
    this.dir = [1, 0];
    this.queue = [];
    this.timer = 0;
    this.score = 0;
    this.state = 'play';
    this.grace = 0;
    this.graceUsed = false;
    this.wob = 0;
    this.placeBerry();
    this.draw(1);
  }

  get interval() { return Math.max(0.11, this.base - this.score * 0.004); }

  placeBerry() {
    const free = [];
    const head = this.body[0];
    for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) {
      if (this.body.some((s) => s.c === c && s.r === r)) continue;
      if (Math.abs(c - head.c) + Math.abs(r - head.r) < 3) continue;
      free.push({ c, r });
    }
    this.food = free[Math.floor(this.kit.rng() * free.length)] || { c: 0, r: 0 };
    this.berry.position.set(cx(this.food.c, this.cols), 0.35, cz(this.food.r, this.rows));
  }

  /** Turn: up/down/left/right (no turning back on yourself). */
  turn(name) {
    const d = DIRS[name];
    const last = this.queue.length ? this.queue[this.queue.length - 1] : this.dir;
    if ((d[0] === -last[0] && d[1] === -last[1]) || (d[0] === last[0] && d[1] === last[1])) return;
    if (this.queue.length < 2) this.queue.push(d);
    this.kit.did('turn');
  }

  crashAt(c, r) {
    if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) return true;
    const growing = c === this.food.c && r === this.food.r;
    const n = this.body.length - (growing ? 0 : 1); // the tail moves away this step
    for (let i = 0; i < n; i++) if (this.body[i].c === c && this.body[i].r === r) return true;
    return false;
  }

  update(dt, I) {
    if (I.stepY > 0 || (I.repY > 0)) this.turn('up');
    else if (I.stepY < 0 || I.repY < 0) this.turn('down');
    else if (I.stepX < 0 || I.repX < 0) this.turn('left');
    else if (I.stepX > 0 || I.repX > 0) this.turn('right');
    if (this.grace > 0) {
      // forgiving timing: stopped at a bump, waiting for a turn
      this.grace -= dt;
      this.wob += dt;
      const d = this.queue[0] || this.dir;
      const h = this.body[0];
      if (!this.crashAt(h.c + d[0], h.r + d[1])) { this.grace = 0; this.timer = this.interval; }
      else if (this.grace <= 0) { this.die(); return; }
      this.draw(1);
      return;
    }
    this.timer += dt;
    if (this.timer >= this.interval) {
      this.timer -= this.interval;
      this.step();
    }
    this.draw(this.timer / this.interval);
  }

  step() {
    if (this.queue.length) this.dir = this.queue.shift();
    const h = this.body[0];
    const n = { c: h.c + this.dir[0], r: h.r + this.dir[1] };
    if (this.crashAt(n.c, n.r)) {
      if (this.kit.timing() > 1 && !this.graceUsed) { this.grace = 0.45 * this.kit.timing(); this.graceUsed = true; this.wob = 0; this.kit.sfx('bump'); return; }
      this.die();
      return;
    }
    this.graceUsed = false;
    this.prev = this.body.map((s) => ({ ...s }));
    this.body.unshift(n);
    if (n.c === this.food.c && n.r === this.food.r) {
      this.score++;
      this.kit.did('eat');
      this.kit.tone(72 + (this.score % 8) * 2, 0.12, { type: 'square', vol: 0.06 });
      this.kit.puff(this.berry.position.x, this.berry.position.z, 0xff3b5c);
      this.prev.push({ ...this.prev[this.prev.length - 1] });
      if (this.goal && this.score >= this.goal) { this.state = 'won'; this.draw(1); return; }
      this.placeBerry();
    } else this.body.pop();
  }

  die() {
    this.state = 'over';
    this.kit.sfx('bump');
    this.kit.shake(0.6);
    const h = this.body[0];
    this.kit.puff(cx(h.c, this.cols), cz(h.r, this.rows), 0xffffff);
  }

  /** Draw the worm between its last step and this one (k 0..1). */
  draw(k) {
    const n = this.body.length;
    while (this.segs.length < n - 1) {
      const s = M(SPH(0.47), this.segs.length % 2 ? BODY2 : BODY);
      this.kit.root.add(s);
      this.segs.push(s);
    }
    for (let i = 0; i < this.segs.length; i++) this.segs[i].visible = i < n - 1;
    const at = (i) => {
      const a = this.prev[i] || this.body[i], b = this.body[i];
      return [cx(a.c + (b.c - a.c) * k, this.cols), cz(a.r + (b.r - a.r) * k, this.rows)];
    };
    const [hx, hz] = at(0);
    const wob = this.grace > 0 ? Math.sin(this.wob * 30) * 0.08 : 0;
    this.headM.position.set(hx + wob, 0.45, hz);
    this.headM.rotation.y = Math.atan2(this.dir[0], this.dir[1]);
    for (let i = 1; i < n; i++) {
      const [x, z] = at(i);
      const s = this.segs[i - 1];
      s.position.set(x, 0.4, z);
      s.scale.set(1 - Math.min(0.35, (i / n) * 0.35), 0.8, 1 - Math.min(0.35, (i / n) * 0.35));
    }
    this.bump.visible = this.grace > 0;
    if (this.grace > 0) this.bump.position.set(hx + this.dir[0] * 0.6, 1.2 + Math.sin(this.wob * 8) * 0.1, hz + this.dir[1] * 0.6);
    this.berry.rotation.y += 0.02;
  }

  idle() { this.berry.rotation.y += 0.01; }

  hud() { return [[t('arc.snake.berries'), this.score]]; }
  goalText() { return t('arc.snake.goal', { n: this.goal, got: this.score }); }
  keys() { return 'arc.snake.keys'; }
  overText() { return t('arc.snake.again', { n: this.goal }); }

  steps() {
    return [
      { key: 'arc.snake.t1', on: 'turn' },
      { key: 'arc.snake.t2', on: 'eat' },
      { key: 'arc.snake.t3', time: 4 },
    ];
  }

  stats() {
    const s = this.score;
    return { mastery: [10, 20, 30].filter((n) => s >= n).map((n) => `b${n}`), trials: s >= 20 ? ['snake.twenty'] : [] };
  }
}
