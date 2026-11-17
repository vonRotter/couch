import * as THREE from 'three';
import { t } from '../../../core/i18n.js';
import { markA11y } from '../../../core/outline.js';
import { seeded } from '../../../core/world.js';
import { M, SPH, CYL, CONE, BOX, TOR, toon, glow, cx, cz } from './util.js';

// Sleepy Lanterns (a "lights out" puzzle): the lanterns on the square are wide awake; put every one to sleep.
// Tapping a lantern turns it and its four neighbours over (awake <-> asleep). Teaches logic: what does one
// tap change, and which order helps? Awake lanterns glow with a sun on top, sleeping ones are dark with a moon
// (never colour alone). Stick (or arrow keys) and [A], or click a lantern; [B] takes the last tap back.
// Levels grow from 3x3 to 5x5 and are the same every time; each can be done in "par" taps or fewer (Coach's
// trial: a 5x5 square in par). Puzzle: a square of its own.

export const LIGHT_LEVELS = 12;

/** A level: { n, on: [bool], par } made from taps on a sleeping square (so it can always be solved). */
export function lightsLevel(level, seed = 900) {
  const n = level < 3 ? 3 : level < 6 ? 4 : 5;
  const taps = Math.min(n * n - 2, 2 + level);
  const rnd = seeded(seed + level * 31);
  const cells = [...Array(n * n).keys()];
  for (let i = cells.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [cells[i], cells[j]] = [cells[j], cells[i]]; }
  const on = Array(n * n).fill(false);
  for (const c of cells.slice(0, taps)) flip(on, n, c % n, Math.floor(c / n));
  if (on.every((x) => !x)) flip(on, n, 0, 0);
  return { n, on, par: taps };
}

export function flip(on, n, c, r) {
  for (const [dc, dr] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const x = c + dc, y = r + dr;
    if (x >= 0 && y >= 0 && x < n && y < n) on[y * n + x] = !on[y * n + x];
  }
}

export class LightsGame {
  constructor(kit) {
    this.kit = kit;
    const P = kit.puzzle;
    this.level = kit.level || 0;
    this.levelCount = LIGHT_LEVELS;
    const L = P?.lights ? (() => { const on = Array(P.lights.n * P.lights.n).fill(false); for (const [c, r] of P.lights.taps) flip(on, P.lights.n, c, r); return { n: P.lights.n, on, par: P.lights.taps.length }; })() : lightsLevel(this.level);
    this.L = L;
    this.n = L.n;
    const S = 1.25; // spacing
    this.S = S;
    this.w = this.n * S + 0.4; this.h = this.n * S + 0.4;
    const root = kit.root;
    root.add(M(BOX(this.w, 0.12, this.h), 0x3a3160, 0, -0.08, 0));
    this.lamps = [];
    for (let r = 0; r < this.n; r++) for (let c = 0; c < this.n; c++) {
      const g = new THREE.Group();
      g.add(M(CYL(0.42, 0.48, 0.12, 18), 0x2b2340, 0, 0.0, 0));
      const mat = toon(0xffd23f, { emissive: 0x000000 }).clone();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.62, 16), mat);
      body.position.y = 0.4;
      g.add(body, M(CONE(0.42, 0.3, 16), 0x5a4a3a, 0, 0.86, 0), M(TOR(0.12, 0.03), 0x5a4a3a, 0, 1.06, 0));
      const sun = new THREE.Group();
      sun.add(M(SPH(0.13, 10, 8), 0xffffff));
      for (let i = 0; i < 6; i++) sun.add(M(SPH(0.05, 6, 4), 0xffffff, Math.cos(i * 1.05) * 0.21, 0, Math.sin(i * 1.05) * 0.21));
      sun.position.set(0, 0.42, 0.36);
      sun.rotation.x = Math.PI / 2;
      const moon = new THREE.Group();
      moon.add(M(SPH(0.13, 10, 8), 0xdfe6ff), M(SPH(0.11, 10, 8), 0x2b3a70, 0.07, 0.02, 0));
      moon.position.set(0, 0.42, 0.36);
      moon.rotation.x = Math.PI / 2;
      g.add(sun, moon);
      g.position.set((c - (this.n - 1) / 2) * S, 0, (r - (this.n - 1) / 2) * S);
      markA11y(g, 'target', [body]);
      root.add(g);
      this.lamps.push({ g, mat, body, sun, moon, glow: 0 });
    }
    this.cursor = new THREE.Group();
    this.cursor.add(M(TOR(0.58, 0.07), 0xffffff).rotateX(Math.PI / 2));
    this.cursor.add(M(CONE(0.16, 0.3, 4), 0xff5d73, 0, 1.5, 0).rotateX(Math.PI));
    root.add(this.cursor);
    this.reset();
  }

  reset() {
    this.on = [...this.L.on];
    this.cur = { c: Math.floor(this.n / 2), r: Math.floor(this.n / 2) };
    this.moves = 0;
    this.hist = [];
    this.state = 'play';
    this.tryT = 0;
    this.nextFail = this.L.par * 3;
    for (const [i, l] of this.lamps.entries()) l.glow = this.on[i] ? 1 : 0;
  }

  tap(c, r, { undo = false } = {}) {
    flip(this.on, this.n, c, r);
    if (!undo) { this.hist.push([c, r]); this.moves++; } else this.moves = Math.max(0, this.moves - 1);
    this.kit.tone(undo ? 67 : 72 + ((c + r) % 4) * 2, 0.16, { type: 'sine', vol: 0.12 });
    this.kit.did(undo ? 'undo' : 'flip');
    if (this.moves >= this.nextFail) { this.nextFail += this.L.par * 2; this.kit.fail('any'); }
    if (this.on.every((x) => !x)) { this.state = this.kit.puzzle ? 'won' : 'level'; this.kit.sfx('star'); }
  }

  update(dt, I) {
    this.tryT += dt;
    if (this.tryT > (this.kit.puzzle ? 30 : 60)) { this.tryT = 0; this.kit.fail('any'); }
    if (I.repX) { this.cur.c = Math.max(0, Math.min(this.n - 1, this.cur.c + I.repX)); this.kit.sfx('select'); this.kit.did('move'); }
    if (I.repY) { this.cur.r = Math.max(0, Math.min(this.n - 1, this.cur.r - I.repY)); this.kit.sfx('select'); this.kit.did('move'); }
    const m = I.mouse;
    if (m?.fresh) {
      const c = Math.round(m.x / this.S + (this.n - 1) / 2), r = Math.round(m.z / this.S + (this.n - 1) / 2);
      if (c >= 0 && r >= 0 && c < this.n && r < this.n && Math.hypot(m.x - (c - (this.n - 1) / 2) * this.S, m.z - (r - (this.n - 1) / 2) * this.S) < 0.6) {
        if (c !== this.cur.c || r !== this.cur.r) this.kit.did('move');
        this.cur = { c, r };
        if (m.pressed) this.tap(c, r);
      }
    }
    if (I.aPressed) this.tap(this.cur.c, this.cur.r);
    if (I.bPressed) { const h = this.hist.pop(); if (h) this.tap(h[0], h[1], { undo: true }); else this.kit.sfx('bump'); }
    this.draw(dt);
  }

  draw(dt) {
    const calm = this.kit.calm();
    this.lamps.forEach((l, i) => {
      l.glow += ((this.on[i] ? 1 : 0) - l.glow) * Math.min(1, dt * (calm ? 4 : 10));
      l.mat.color.setHex(0x2b3a70).lerp(new THREE.Color(0xffd23f), l.glow);
      l.mat.emissive.setHex(0x8a6a00).multiplyScalar(l.glow * 0.9);
      l.sun.visible = this.on[i];
      l.moon.visible = !this.on[i];
    });
    const S = this.S;
    this.cursor.position.set((this.cur.c - (this.n - 1) / 2) * S, 0.08, (this.cur.r - (this.n - 1) / 2) * S);
    this.cursor.children[1].position.y = 1.5 + Math.sin((this.kit.time || 0) * 4) * 0.08;
  }

  idle(dt) { this.draw(dt); }

  hud() {
    const h = [[t('arc.lights.taps'), this.moves], [t('arc.lights.par'), this.L.par], [t('arc.lights.awake'), this.on.filter(Boolean).length]];
    if (!this.kit.puzzle) h.unshift([t('arc.level'), this.level + 1]);
    return h;
  }
  goalText() { return t('arc.lights.goal'); }
  keys() { return 'arc.lights.keys'; }
  levelText() { return this.moves <= this.L.par ? t('arc.lights.donePar', { n: this.moves }) : t('arc.lights.done', { n: this.moves, par: this.L.par }); }

  steps() {
    return [
      { key: 'arc.lights.t1', on: 'move' },
      { key: 'arc.lights.t2', on: 'flip' },
      { key: 'arc.lights.t3', time: 5 },
    ];
  }

  stats() {
    return { mastery: [2, 5, 8].filter((n) => this.level >= n).map((n) => `lv${n + 1}`), trials: this.n === 5 && this.moves <= this.L.par && !this.kit.puzzle ? ['lights.par'] : [] };
  }

  dispose() { for (const l of this.lamps) { l.mat.dispose(); l.body.geometry.dispose(); } }
}
