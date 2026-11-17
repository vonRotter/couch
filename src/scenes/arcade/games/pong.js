import * as THREE from 'three';
import { t } from '../../../core/i18n.js';
import { markA11y } from '../../../core/outline.js';
import { M, SPH, BOX, CYL, TOR, eyes, checker } from './util.js';

// Paddle Pals (a bat-and-ball game): bat the ball back past the other side's paddle. Where the ball meets your
// paddle sends it up or down (the edges at a sharp angle), and it gets a little faster with every hit. Teaches
// timing and angles. Against Pip (a gentle computer player who goes easier when you are behind), or a friend:
// another controller (a second gamepad, or Enter on the arrow keys) presses [A] to take Pip's paddle. First to
// 7 points. The high score is your longest rally (hits back and forth).
// Help me play: game speed; forgiving timing catches balls a little past the paddle's ends; aim help marks where
// the ball will reach your side. Puzzle: bat the ball back N times in a row.

const W = 18, H = 11;
const PX = 8.0; // the paddles' x (left -PX, right +PX)
const HH = 1.3; // half a paddle
const BR = 0.26;
export const PONG_TO = 7;

export class PongGame {
  constructor(kit) {
    this.kit = kit;
    this.goal = kit.puzzle?.goal?.rally || 0;
    this.w = W; this.h = H;
    const root = kit.root;
    const floor = checker(18, 11, '#5fc77a', '#56bd70');
    floor.position.y = -0.05;
    root.add(floor);
    root.add(M(BOX(0.12, 0.04, H), 0xffffff, 0, 0.0, 0));
    root.add(M(TOR(1.4, 0.06), 0xffffff, 0, 0.0, 0).rotateX(Math.PI / 2));
    const pad = (color, face) => {
      const g = new THREE.Group();
      const body = M(BOX(0.5, 0.5, 1), color);
      g.add(body);
      const e = eyes(0.9, 0.14);
      e.position.set(face * 0.28, 0.32, 0);
      e.rotation.y = face * Math.PI / 2;
      g.add(e);
      g.userData.body = body;
      markA11y(g, 'player', [body]);
      root.add(g);
      return g;
    };
    this.me = pad(kit.p?.color ?? 0xff5d73, 1);
    this.them = pad(0x5b4fd8, -1);
    this.ballM = M(SPH(BR, 14, 10), 0xffffff);
    markA11y(this.ballM, 'item');
    root.add(this.ballM);
    this.mark = M(TOR(0.42, 0.06), 0xffd23f);
    this.mark.rotation.x = Math.PI / 2;
    root.add(this.mark);
    this.two = false;
    this.reset();
  }

  reset() {
    this.mine = 0; this.theirs = 0;
    this.rally = 0;
    this.score = 0; // the longest rally
    this.y1 = 0; this.y2 = 0;
    this.state = 'play';
    this.speed = 7;
    this.server = 1;
    this.aiErr = 0;
    this.serve(1);
  }

  serve(who) {
    this.server = who;
    this.waitT = who === 2 && !this.two ? 1.0 : 0;
    this.held = true;
    this.rally = 0;
    this.myHits = 0;
    this.speed = 7;
  }

  launch() {
    this.held = false;
    const dir = this.server === 1 ? 1 : -1;
    const a = (this.kit.rng() - 0.5) * 0.7;
    this.ball = { x: dir * (PX - 0.6), z: (this.server === 1 ? this.y1 : this.y2), vx: Math.cos(a) * this.speed * dir, vz: Math.sin(a) * this.speed };
    this.kit.sfx('jump');
    this.kit.did('serve');
  }

  update(dt, I) {
    // a friend takes Pip's paddle
    if (!this.two && !this.goal) {
      const d = this.kit.join2?.();
      if (d) { this.two = d; this.kit.sfx('join'); this.kit.toast?.(t('arc.pong.joined')); if (d.id === 'kb1') this.kit.takeArrows?.(); }
    }
    const sp = 9;
    this.y1 = Math.max(-H / 2 + HH, Math.min(H / 2 - HH, this.y1 - I.y * sp * dt));
    if (Math.abs(I.y) > 0.3) this.kit.did('move');
    if (this.two) {
      const d = this.two;
      this.y2 = Math.max(-H / 2 + HH, Math.min(H / 2 - HH, this.y2 - d.y * sp * dt));
    } else this.ai(dt);
    if (this.held) {
      const y = this.server === 1 ? this.y1 : this.y2;
      this.ball = { x: (this.server === 1 ? -1 : 1) * (PX - 0.6), z: y, vx: 0, vz: 0 };
      if (this.server === 1 && I.aPressed) this.launch();
      else if (this.server === 2 && (this.two ? this.two.aPressed : (this.waitT -= dt) <= 0)) this.launch();
    } else for (let i = 0; i < 4; i++) { this.physics(dt / 4); if (this.held || this.state !== 'play') break; }
    this.draw(dt);
  }

  /** Pip: follows where the ball will come, a bit slowly, a bit off, and easier on you when you are behind. */
  ai(dt) {
    const b = this.ball;
    let target = 0;
    if (b && !this.held && b.vx > 0) target = this.predict(PX) + this.aiErr;
    const behind = this.theirs - this.mine;
    const max = Math.max(3.2, 5.6 + this.rally * 0.05 - Math.max(0, behind) * 0.7);
    const d = target - this.y2;
    this.y2 += Math.max(-max * dt, Math.min(max * dt, d * Math.min(1, dt * 6)));
    this.y2 = Math.max(-H / 2 + HH, Math.min(H / 2 - HH, this.y2));
  }

  /** Where the ball will cross x (bouncing off the top and bottom). */
  predict(x) {
    const b = this.ball;
    if (!b || !b.vx) return 0;
    const tt = (x - b.x) / b.vx;
    if (tt < 0) return b.z;
    let z = b.z + b.vz * tt;
    const lo = -H / 2 + BR, hi = H / 2 - BR, span = hi - lo;
    z = ((z - lo) % (2 * span) + 2 * span) % (2 * span);
    return z > span ? lo + 2 * span - z : lo + z;
  }

  physics(dt) {
    const b = this.ball;
    b.x += b.vx * dt;
    b.z += b.vz * dt;
    if (b.z < -H / 2 + BR) { b.z = -H / 2 + BR; b.vz = Math.abs(b.vz); this.kit.sfx('land'); }
    if (b.z > H / 2 - BR) { b.z = H / 2 - BR; b.vz = -Math.abs(b.vz); this.kit.sfx('land'); }
    const extra = this.kit.timing() > 1 ? 0.35 : 0;
    // my paddle (left)
    if (b.vx < 0 && b.x < -PX + 0.25 + BR && b.x > -PX - 0.4 && Math.abs(b.z - this.y1) < HH + BR + extra) this.hit(1, (b.z - this.y1) / HH);
    // theirs (right): a friend gets forgiving timing from their own settings only through the screen (kept plain)
    if (b.vx > 0 && b.x > PX - 0.25 - BR && b.x < PX + 0.4 && Math.abs(b.z - this.y2) < HH + BR) this.hit(2, (b.z - this.y2) / HH);
    if (b.x < -W / 2 - 0.5) this.point(2);
    if (b.x > W / 2 + 0.5) this.point(1);
  }

  hit(who, off) {
    const b = this.ball;
    off = Math.max(-1, Math.min(1, off));
    this.speed = Math.min(14, this.speed + 0.35);
    const a = off * 0.95;
    const dir = who === 1 ? 1 : -1;
    b.vx = Math.cos(a) * this.speed * dir;
    b.vz = Math.sin(a) * this.speed;
    b.x = who === 1 ? -PX + 0.25 + BR : PX - 0.25 - BR;
    this.rally++;
    this.score = Math.max(this.score, this.rally);
    (who === 1 ? this.me : this.them).scale.x = 1.5;
    this.kit.tone(who === 1 ? 72 : 67, 0.1, { type: 'square', vol: 0.07 });
    if (who === 1) {
      this.myHits++;
      this.kit.did(Math.abs(off) > 0.45 ? 'edge' : 'hit');
      if (this.goal && this.myHits >= this.goal) { this.state = 'won'; return; }
    } else this.aiErr = (this.kit.rng() - 0.5) * 1.6;
  }

  point(who) {
    if (who === 1) this.mine++; else this.theirs++;
    this.kit.sfx(who === 1 ? 'coin' : 'bump');
    if (who === 2) { this.kit.fail('timing'); this.kit.shake(0.3); }
    if (!this.goal && (this.mine >= PONG_TO || this.theirs >= PONG_TO)) { this.state = 'over'; this.held = true; return; }
    this.serve(who === 1 ? 2 : 1);
  }

  draw(dt) {
    this.me.position.set(-PX, 0.25, this.y1);
    this.them.position.set(PX, 0.25, this.y2);
    for (const p of [this.me, this.them]) { p.userData.body.scale.z = HH * 2; p.scale.x += (1 - p.scale.x) * Math.min(1, dt * 10); }
    const b = this.ball || { x: -PX + 0.6, z: 0 };
    this.ballM.position.set(b.x, 0.3, b.z);
    const lv = this.kit.aim();
    const show = lv > 0 && this.ball && !this.held && this.ball.vx < 0 && (lv >= 2 || this.ball.x < 0);
    this.mark.visible = !!show;
    if (show) this.mark.position.set(-PX + 0.45, 0.05, this.predict(-PX + 0.25 + BR));
  }

  idle(dt) { this.draw(dt); }

  hud() {
    if (this.goal) return [[t('arc.pong.inRow'), this.myHits]];
    const them = this.two ? t('arc.pong.p2') : t('isl.npc.pip');
    const h = [[this.kit.p?.name || t('arc.you'), this.mine], [them, this.theirs], [t('arc.pong.rally'), this.rally]];
    if (!this.two && this.mine + this.theirs === 0 && this.held) h.push([t('arc.pong.join'), '']);
    return h;
  }
  goalText() { return t('arc.pong.goal', { n: this.goal }); }
  keys() { return 'arc.pong.keys'; }
  overTitle() {
    if (this.two) return t(this.mine > this.theirs ? 'arc.pong.p1wins' : 'arc.pong.p2wins');
    return t(this.mine > this.theirs ? 'arc.pong.youWin' : 'arc.pong.pipWins');
  }
  poorGame() { return this.mine < 2; }

  steps() {
    return [
      { key: 'arc.pong.t1', on: 'move' },
      { key: 'arc.pong.t2', on: 'serve' },
      { key: 'arc.pong.t3', on: 'edge' },
    ];
  }

  stats() {
    const r = this.score;
    const mastery = [5, 10, 20].filter((n) => r >= n).map((n) => `rally${n}`);
    const won = !this.two && this.mine >= PONG_TO;
    if (won) mastery.push('win');
    return { mastery, trials: won ? ['pong.win'] : [] };
  }
}
