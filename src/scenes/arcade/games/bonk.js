import * as THREE from 'three';
import { t } from '../../../core/i18n.js';
import { markA11y } from '../../../core/outline.js';
import { homeToward } from '../../../core/assist.js';
import { M, SPH, BOX, CYL, Dots, eyes, toon, checker } from './util.js';

// Brick Bonk (a breakout game): keep the ball bouncing with your paddle and bonk every brick out of the wall.
// Where the ball hits the paddle decides where it goes: the middle sends it straight up, the edges send it off
// at an angle. Teaches timing and angles. Stick, arrow keys or the mouse move the paddle; [A] (or a click)
// launches the ball. Three balls; a cleared wall brings the next one, a little faster.
// Help me play: game speed; forgiving timing catches balls a little past the paddle's ends; aim help shows the
// ball's path ahead (a lot: further, and the ball leans toward the bricks). Puzzle: a small wall, no game over
// (a lost ball is just another try).

const W = 13, H = 17;
const PZ = 7.4; // the paddle's line
const BR = 0.24; // ball radius
const ROW_COLORS = [0xff5d73, 0xff9f1c, 0xffd23f, 0x3ddc97, 0x4cc9f0, 0x9b5de5];

export function bonkWall(n, small = false) {
  const out = [];
  const cols = small ? 6 : 10, rows = small ? 3 : 5;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const k = n % 3;
    if (!small && k === 1 && (r + c) % 2) continue; // a checkerboard
    if (!small && k === 2 && Math.abs(c - 4.5) > 4.6 - r) continue; // a pyramid
    out.push({ c, r, x: (c - (cols - 1) / 2) * 1.2, z: -7 + r * 0.7, hp: 1 });
  }
  return out;
}

export class BonkGame {
  constructor(kit) {
    this.kit = kit;
    this.puzzle = !!kit.puzzle;
    this.w = W; this.h = H;
    const root = kit.root;
    const floor = checker(13, 17, '#ffe7c4', '#fbdcb2');
    floor.position.y = -0.05;
    root.add(floor);
    this.paddle = new THREE.Group();
    const plank = M(BOX(1, 0.4, 0.5), 0x8a5a32);
    this.plank = plank;
    this.paddle.add(plank);
    const nose = M(SPH(0.28, 12, 8), 0xffd23f, 0, 0.35, 0);
    const e = eyes(0.9, 0.14);
    e.position.set(0, 0.42, 0.2);
    this.paddle.add(nose, e);
    markA11y(this.paddle, 'player', [plank]);
    root.add(this.paddle);
    this.ballM = M(SPH(BR, 14, 10), 0xffffff);
    this.ballM.add(M(SPH(BR * 0.45, 8, 6), 0xff5d73, 0, 0, BR * 0.75));
    markA11y(this.ballM, 'item');
    root.add(this.ballM);
    this.dots = new Dots(root, 0xffffff, 30, 0.07);
    this.brickG = new THREE.Group();
    root.add(this.brickG);
    this.livesM = [];
    for (let i = 0; i < 3; i++) { const s = M(SPH(0.18, 10, 8), 0xffffff, -5.9 + i * 0.5, 0.2, 8.1); this.livesM.push(s); root.add(s); }
    this.reset();
  }

  reset() {
    this.score = 0;
    this.walls = 0;
    this.lives = 3;
    this.state = 'play';
    this.px = 0;
    this.hw = 1.25;
    this.speed = 8;
    this.lost = 0;
    this.buildWall();
    this.serve();
  }

  buildWall() {
    this.brickG.clear();
    this.bricks = bonkWall(this.walls, this.puzzle).map((b) => {
      const m = new THREE.Group();
      m.add(M(BOX(1.08, 0.45, 0.58), ROW_COLORS[b.r % ROW_COLORS.length]), M(BOX(0.8, 0.06, 0.3), 0xffffff, 0, 0.25, 0));
      m.position.set(b.x, 0.22, b.z);
      markA11y(m, 'target', [m.children[0]]);
      this.brickG.add(m);
      return { ...b, m };
    });
  }

  serve() {
    this.held = true;
    this.ball = { x: this.px, z: PZ - 0.55, vx: 0, vz: 0 };
  }

  launch() {
    if (!this.held) return;
    this.held = false;
    const a = (this.kit.rng() - 0.5) * 0.6;
    this.ball.vx = Math.sin(a) * this.speed;
    this.ball.vz = -Math.cos(a) * this.speed;
    this.kit.sfx('jump');
    this.kit.did('launch');
  }

  update(dt, I) {
    // the paddle: the mouse (when it moved lately), else the stick
    const lim = W / 2 - this.hw - 0.05;
    const m = I.mouse;
    if (m?.fresh) this.px += (Math.max(-lim, Math.min(lim, m.x)) - this.px) * Math.min(1, dt * 20);
    else this.px = Math.max(-lim, Math.min(lim, this.px + I.x * 15 * dt));
    if (Math.abs(I.x) > 0.3 || (m?.fresh && m.down)) this.kit.did('move');
    if (I.aPressed || m?.pressed) this.launch();
    if (this.held) { this.ball.x = this.px; this.ball.z = PZ - 0.55; }
    else for (let i = 0; i < 4; i++) { this.physics(dt / 4); if (this.state !== 'play' || this.held) break; }
    this.draw(dt);
  }

  physics(dt) {
    const b = this.ball;
    if (this.kit.aim() >= 2 && b.vz < 0) {
      const v = { x: b.vx, y: b.vz };
      homeToward({ x: b.x, y: b.z }, v, this.bricks.map((k) => ({ x: k.x, y: k.z })), 1, dt, { range: 4 });
      b.vx = v.x; b.vz = v.y;
    }
    b.x += b.vx * dt;
    b.z += b.vz * dt;
    if (b.x < -W / 2 + BR) { b.x = -W / 2 + BR; b.vx = Math.abs(b.vx); this.kit.sfx('land'); }
    if (b.x > W / 2 - BR) { b.x = W / 2 - BR; b.vx = -Math.abs(b.vx); this.kit.sfx('land'); }
    if (b.z < -H / 2 + BR) { b.z = -H / 2 + BR; b.vz = Math.abs(b.vz); this.kit.sfx('land'); }
    // the paddle (forgiving timing: a little past its ends still counts)
    const extra = this.kit.timing() > 1 ? 0.4 : 0;
    if (b.vz > 0 && b.z > PZ - 0.25 - BR && b.z < PZ + 0.3 && Math.abs(b.x - this.px) < this.hw + BR + extra) {
      const off = Math.max(-1, Math.min(1, (b.x - this.px) / this.hw));
      const a = off * 1.05; // up to 60 degrees
      const sp = Math.hypot(b.vx, b.vz);
      b.vx = Math.sin(a) * sp;
      b.vz = -Math.cos(a) * sp;
      b.z = PZ - 0.25 - BR;
      this.kit.tone(64 + Math.round(off * 5), 0.1, { type: 'square', vol: 0.07 });
      this.kit.did(Math.abs(off) > 0.45 ? 'edge' : 'hit');
      this.paddle.scale.y = 0.6;
    }
    // bricks
    for (const k of this.bricks) {
      if (k.hp <= 0) continue;
      const dx = b.x - k.x, dz = b.z - k.z;
      const ox = 0.54 + BR - Math.abs(dx), oz = 0.29 + BR - Math.abs(dz);
      if (ox <= 0 || oz <= 0) continue;
      if (ox < oz) b.vx = Math.sign(dx) * Math.abs(b.vx); else b.vz = Math.sign(dz) * Math.abs(b.vz);
      k.hp = 0;
      k.m.visible = false;
      this.score += 10 * (5 - Math.min(4, k.r));
      this.kit.puff(k.x, k.z, ROW_COLORS[k.r % ROW_COLORS.length], { count: 10 });
      this.kit.tone(72 + (k.r % 5) * 2, 0.08, { type: 'square', vol: 0.06 });
      this.kit.did('brick');
      if (this.bricks.every((x) => x.hp <= 0)) this.cleared();
      break;
    }
    if (b.z > H / 2 + 0.5) this.lose();
  }

  cleared() {
    if (this.puzzle) { this.state = 'won'; return; }
    this.walls++;
    this.score += 100;
    this.kit.confetti(0, -4);
    this.kit.sfx('fanfare');
    this.speed = Math.min(13, this.speed + 1);
    this.buildWall();
    this.serve();
  }

  lose() {
    this.kit.sfx('bump');
    this.kit.shake(0.4);
    this.kit.fail('timing');
    if (this.puzzle) { this.serve(); return; }
    this.lives--;
    if (this.lives <= 0) { this.state = 'over'; return; }
    this.serve();
  }

  /** The ball's path ahead (aim help): along its way, off the walls, until the paddle line or a brick. */
  path() {
    const b = this.ball;
    let x = b.x, z = b.z, vx = b.vx, vz = b.vz;
    if (this.held) { vx = 0; vz = -1; }
    const pts = [{ x, z }];
    const len = this.kit.aim() >= 2 ? 26 : 12;
    let left = len;
    const sp = Math.hypot(vx, vz) || 1;
    vx /= sp; vz /= sp;
    for (let i = 0; i < 400 && left > 0; i++) {
      x += vx * 0.1; z += vz * 0.1; left -= 0.1;
      if (x < -W / 2 + BR) { vx = Math.abs(vx); pts.push({ x, z }); }
      if (x > W / 2 - BR) { vx = -Math.abs(vx); pts.push({ x, z }); }
      if (z < -H / 2 + BR) { vz = Math.abs(vz); pts.push({ x, z }); }
      if (vz > 0 && z > PZ - 0.5) break;
      if (this.bricks.some((k) => k.hp > 0 && Math.abs(x - k.x) < 0.54 + BR && Math.abs(z - k.z) < 0.29 + BR)) break;
    }
    pts.push({ x, z });
    return pts;
  }

  draw(dt) {
    this.paddle.position.set(this.px, 0.2, PZ);
    this.plank.scale.x = this.hw * 2;
    this.paddle.scale.y += (1 - this.paddle.scale.y) * Math.min(1, dt * 10);
    this.ballM.position.set(this.ball.x, 0.3, this.ball.z);
    this.ballM.rotation.y += dt * 6;
    if (this.kit.aim() > 0 && this.state === 'play') this.dots.set(this.path(), 0.5, 0.25); else this.dots.hide();
    this.livesM.forEach((s, i) => { s.visible = !this.puzzle && i < this.lives; });
  }

  idle(dt) { this.draw(dt); }

  hud() { return this.puzzle ? [[t('arc.bonk.left'), this.bricks.filter((k) => k.hp > 0).length]] : [[t('arc.score'), this.score], [t('arc.bonk.walls'), this.walls]]; }
  goalText() { return t('arc.bonk.goal'); }
  keys() { return 'arc.bonk.keys'; }
  poorGame() { return this.score < 60; }

  steps() {
    return [
      { key: 'arc.bonk.t1', on: 'move' },
      { key: 'arc.bonk.t2', on: 'launch' },
      { key: 'arc.bonk.t3', on: 'edge' },
    ];
  }

  stats() {
    const w = this.walls;
    return { mastery: [1, 2, 3].filter((n) => w >= n).map((n) => `wall${n}`), trials: w >= 1 ? ['bonk.wall'] : [] };
  }
}
