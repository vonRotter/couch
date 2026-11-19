import * as THREE from 'three';
import { t } from '../../../core/i18n.js';
import { markA11y } from '../../../core/outline.js';
import { M, SPH, CYL, CONE, BOX, TOR, toon } from './util.js';

// Echo Bells (a "repeat after me" memory game): four bells ring a little tune, then you ring the same bells in
// the same order. Every time you get it right the tune grows by one note. Teaches remembering a sequence. Each
// bell has its own colour, shape on top, place (up, right, down, left) and note, so it can be followed by
// colour, by shape, by place or by ear. Push the stick (or an arrow key) toward a bell, or click it. Three
// hearts: a wrong bell costs one and the tune plays again. Help me play: forgiving timing plays the tune slower
// and waits longer; "Reduce flashing" makes the bells glow softly instead of lighting up. Puzzle: repeat a
// tune of N notes.

export const BELLS = [
  { id: 'up', x: 0, z: -2.3, color: 0xffc93c, emissive: 0x806010, note: 79, mark: 'sun' },
  { id: 'right', x: 2.3, z: 0, color: 0x3ddc97, emissive: 0x106a40, note: 76, mark: 'leaf' },
  { id: 'down', x: 0, z: 2.3, color: 0x4cc9f0, emissive: 0x105a80, note: 67, mark: 'drop' },
  { id: 'left', x: -2.3, z: 0, color: 0xff5d73, emissive: 0x801030, note: 72, mark: 'heart' },
];

function mark(kind) {
  const g = new THREE.Group();
  if (kind === 'sun') { g.add(M(SPH(0.22, 12, 8), 0xffffff)); for (let i = 0; i < 6; i++) { const r = M(CONE(0.07, 0.18, 4), 0xffffff, Math.cos(i * 1.05) * 0.33, 0, Math.sin(i * 1.05) * 0.33); r.rotation.z = -Math.PI / 2; r.rotation.y = -i * 1.05; g.add(r); } }
  else if (kind === 'leaf') { const l = M(CONE(0.3, 0.12, 3), 0xffffff); g.add(l); }
  else if (kind === 'drop') { g.add(M(BOX(0.42, 0.12, 0.42), 0xffffff)); }
  else { g.add(M(SPH(0.15, 10, 8), 0xffffff, -0.12, 0, -0.05), M(SPH(0.15, 10, 8), 0xffffff, 0.12, 0, -0.05), M(CONE(0.24, 0.12, 4), 0xffffff, 0, 0, 0.12)); }
  return g;
}

export class SimonGame {
  constructor(kit) {
    this.kit = kit;
    this.goal = kit.puzzle?.goal?.notes || 0;
    this.w = 7.4; this.h = 7.4;
    const root = kit.root;
    root.add(M(CYL(3.6, 3.7, 0.2, 40), 0x3a2f6a, 0, -0.12, 0));
    root.add(M(CYL(0.9, 1.0, 0.5, 24), 0x2b2340, 0, 0.1, 0));
    this.heartsM = [];
    for (let i = 0; i < 3; i++) { const h = M(SPH(0.16, 10, 8), 0xff5d73, -0.35 + i * 0.35, 0.45, 0); this.heartsM.push(h); root.add(h); }
    this.bells = BELLS.map((b) => {
      const g = new THREE.Group();
      g.add(M(CYL(0.95, 1.05, 0.2, 28), 0x2b2340, 0, 0.0, 0));
      const mat = toon(b.color, { emissive: 0x000000 }).clone(); // its own: the glow changes
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.85, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2), mat);
      body.scale.y = 0.8;
      body.position.y = 0.1;
      g.add(body);
      g.add(M(TOR(0.86, 0.06), 0xffffff, 0, 0.12, 0).rotateX(Math.PI / 2));
      const m = mark(b.mark);
      m.position.y = 0.82;
      g.add(m);
      g.position.set(b.x, 0, b.z);
      markA11y(g, 'target', [body]);
      root.add(g);
      return { ...b, g, mat, body, lit: 0 };
    });
    this.reset();
  }

  reset() {
    this.seq = [];
    this.hearts = 3;
    this.score = 0;
    this.state = 'play';
    this.add();
    // the first tune waits for the tutorial's "watch and listen" step (so "Your turn" never shows under it)
    this.phase = 'ready';
    this.pt = 0;
  }

  add() { this.seq.push(Math.floor(this.kit.rng() * 4)); }

  /** The tune plays (after a short pause). */
  listen(delay = 0.6) {
    this.phase = 'listen';
    this.idx = 0;
    this.pt = -delay;
    this.kit.did('listen');
  }

  get slow() { return this.kit.timing() > 1 ? 1.45 : 1; }

  ring(i, { mine = false } = {}) {
    const b = this.bells[i];
    b.lit = 1;
    this.kit.tone(b.note, 0.42 * this.slow, { type: 'triangle', vol: 0.16 });
    this.kit.tone(b.note + 12, 0.25 * this.slow, { type: 'sine', vol: 0.05 });
    if (mine) b.g.position.y = -0.08;
  }

  update(dt, I) {
    if (this.phase === 'ready') {
      this.pt += dt;
      const k = this.kit.stepKey?.();
      if (!this.kit.teaching?.() || k === 'arc.simon.t1' || (k && k !== 'arc.simon.t1') || this.pt > 4) this.listen(k === 'arc.simon.t1' ? 0.6 : 1.0 - Math.min(1, this.pt));
    } else if (this.phase === 'listen') {
      this.pt += dt;
      const step = 0.62 * this.slow;
      if (this.idx < this.seq.length && this.pt >= this.idx * step) { this.ring(this.seq[this.idx]); this.idx++; }
      if (this.idx >= this.seq.length && this.pt > this.seq.length * step + 0.1) { this.phase = 'answer'; this.idx = 0; this.waitT = 0; this.kit.did('heard'); }
    } else if (this.phase === 'answer') {
      this.waitT += dt;
      let pick = -1;
      if (I.stepY > 0) pick = 0; else if (I.stepX > 0) pick = 1; else if (I.stepY < 0) pick = 2; else if (I.stepX < 0) pick = 3;
      if (I.mouse?.pressed) {
        let best = 1.3;
        this.bells.forEach((b, i) => { const d = Math.hypot(I.mouse.x - b.x, I.mouse.z - b.z); if (d < best) { best = d; pick = i; } });
      }
      if (pick >= 0) this.answer(pick);
      else if (this.waitT > 8 * this.kit.timing()) { this.kit.sfx('select'); this.listen(0.4); } // waited long: hear it again
    } else if (this.phase === 'pause') {
      this.pt += dt;
      if (this.pt >= 0) this.listen(0);
    }
    this.draw(dt);
  }

  answer(i) {
    this.ring(i, { mine: true });
    this.kit.did('ring');
    this.waitT = 0;
    if (i !== this.seq[this.idx]) {
      this.hearts--;
      this.kit.sfx('bump');
      this.kit.shake(0.3);
      this.kit.fail('timing');
      if (this.hearts <= 0) { this.state = 'over'; return; }
      this.phase = 'pause';
      this.pt = -1.2;
      return;
    }
    this.idx++;
    if (this.idx >= this.seq.length) {
      this.score = this.seq.length;
      this.kit.did('round');
      if (this.goal && this.score >= this.goal) { this.state = 'won'; return; }
      this.kit.sfx('coin');
      this.add();
      this.phase = 'pause';
      this.pt = -1.0;
    }
  }

  draw(dt) {
    const calm = this.kit.calm();
    for (const b of this.bells) {
      b.lit = Math.max(0, b.lit - dt * (calm ? 1.6 : 3));
      const k = calm ? b.lit * 0.6 : b.lit;
      b.mat.emissive.setHex(b.emissive).multiplyScalar(k * 2.2);
      b.body.scale.set(1 + k * 0.08, 0.8 + k * 0.08, 1 + k * 0.08);
      b.g.position.y += (0 - b.g.position.y) * Math.min(1, dt * 10);
    }
    this.heartsM.forEach((h, i) => { h.visible = i < this.hearts; });
  }

  idle(dt) { this.draw(dt); }

  hud() {
    return [[t('arc.simon.tune'), this.seq.length], ['❤', this.hearts], [this.phase !== 'answer' ? t('arc.simon.listen') : t('arc.simon.yourTurn'), '']];
  }
  goalText() { return t('arc.simon.goal', { n: this.goal }); }
  keys() { return 'arc.simon.keys'; }
  overText() { return t('arc.simon.again'); }
  poorGame() { return this.score < 3; }

  steps() {
    return [
      { key: 'arc.simon.t1', on: 'heard' }, // moves on when the tune has played: then it is your turn
      { key: 'arc.simon.t2', on: 'ring' },
      { key: 'arc.simon.t3', on: 'round' },
    ];
  }

  stats() {
    const s = this.score;
    const trials = [];
    if (s >= 8) trials.push('simon.eight');
    if (s >= 12) trials.push('simon.twelve');
    return { mastery: [5, 8, 12].filter((n) => s >= n).map((n) => `s${n}`), trials };
  }

  dispose() { for (const b of this.bells) { b.mat.dispose(); b.body.geometry.dispose(); } }
}
