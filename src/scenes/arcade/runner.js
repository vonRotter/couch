import * as THREE from 'three';
import { t, tFor } from '../../core/i18n.js';
import { esc } from '../../core/ui.js';
import { timingScale, aimLevel, calmOn, shakeScale, struggle, overcame, markSkipped, screenSettings } from '../../core/assist.js';
import { StepTeacher } from '../../core/tutorial.js';
import { report as passportReport } from '../../core/passport.js';
import { say } from '../../core/voice.js';
import { seeded } from '../../core/world.js';
import { Particles } from '../../core/particles.js';
import { refreshOutlines } from '../../core/outline.js';
import { arcadeDef } from './defs.js';
import { recordScore, bestOf, familyBests, arcadeOf } from './scores.js';
import { GAME_CLASSES } from './games/index.js';
import './strings.js';

// Runs one classic arcade game (games/*.js) for one player: the board in its own little 3D view, the HUD, the
// tutorial's steps, "Help me play", the high score and the passport. Used by the Game Hall's cabinets
// (ArcadeScene, scene.js: a whole scene) and by the island's puzzle chests and doors (solo/puzzles.js: drawn over
// the island, `embedded`).
//
// Flow: the tutorial's first card the first time ("Show me how" / "I know how to play", core/tutorial.js), a short
// "Ready... go!", then play. Game over (score games) or a level done (level games): a card with the score, the
// best of every child on this device and [A] again / next, [C] back. Instant retry: [A] starts again at once.
// Puzzles (opts.puzzle): one screen with a set goal; solved or skipped, the island hands out the reward.
//
// Controls (input.js 'arcade' layout): stick, D-pad, WASD or the arrow keys; [A] (A / Space) the main button,
// [B] (X / E) the second one; [C] (B / Q) is back: the pause menu while playing (or leave a puzzle), back to the
// hall on a card. Start / Esc is the pause menu (main.js). The mouse plays where it is natural.

const TILT = 0.42; // the camera looks down at the board this far from straight down (radians)
const READY = 0.9;
const _ray = new THREE.Raycaster();
const _v2 = new THREE.Vector2();
const _plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const _hit = new THREE.Vector3();

const CSS = `
.arc-hud { position: absolute; left: 50%; top: 1.2vh; transform: translateX(-50%); display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; pointer-events: none; z-index: 2; max-width: 96vw; }
.arc-hud .pill { font-size: clamp(14px, 1.45vw, 22px); }
.arc-hud .pill.goal { background: #fff3c4; }
.arc-hud .pill.name { background: var(--c); color: #fff; }
.arc-keys { position: absolute; left: 50%; bottom: 1.2vh; transform: translateX(-50%); pointer-events: none; z-index: 2; background: rgba(255,255,255,.88);
  border-radius: 999px; padding: 3px 14px; font-weight: 700; font-size: clamp(12px, 1.1vw, 17px); color: #2b2340; white-space: nowrap; }
.a11y-text .arc-hud, .a11y-text .arc-keys { zoom: var(--ts); }
.arc-on .teach-box { bottom: 5.6vh; }
.panel.arc-panel { pointer-events: auto; min-width: min(460px, 90vw); }
.arc-panel .pause-item { cursor: pointer; }
.arc-panel .arc-score { font-size: clamp(30px, 4vw, 60px); font-weight: 800; color: var(--c, #8a45e0); line-height: 1.1; }
.arc-panel .arc-new { display: inline-block; background: #ffd23f; border-radius: 999px; padding: 1px 12px; font-weight: 800; margin: 4px 0; }
.arc-panel .arc-family { display: flex; gap: 6px; flex-wrap: wrap; justify-content: center; margin: 6px 0 2px; font-size: clamp(13px, 1.3vw, 19px); }
.arc-panel .arc-family span { background: #f3eeff; border-radius: 999px; padding: 1px 10px; }
.arc-panel .arc-family span.me { background: #ffe3f0; font-weight: 800; }
`;
let cssDone = false;
function addCss() {
  if (cssDone) return;
  cssDone = true;
  const el = document.createElement('style');
  el.id = 'arc-style';
  el.textContent = CSS;
  document.head.appendChild(el);
}

const NO_INPUT = Object.freeze({ x: 0, y: 0, stepX: 0, stepY: 0, repX: 0, repY: 0, a: false, aPressed: false, b: false, bPressed: false, c: false, cPressed: false, mouse: null });

export const hexCss = (c) => `#${c.toString(16).padStart(6, '0')}`;

export class ArcadeRunner {
  /**
   * host: { game, key?, players } (a scene, or the island's stand-in for a puzzle). opts: key, puzzle (a puzzle's
   * set goal: solo/puzzles.js), scene and camera to fill (else its own), embedded (drawn over the island),
   * onExit(result) where to go when done: result { solved, skipped } for a puzzle, or {} for "back".
   */
  constructor(host, { key, puzzle = null, scene = null, camera = null, embedded = false, onExit = null, seed = null }) {
    addCss();
    this.host = host;
    this.game = host.game;
    this.key = key;
    this.def = arcadeDef(key);
    this.puzzle = puzzle;
    this.embedded = embedded;
    this.onExit = onExit;
    this.p = host.players[0];
    this.scene = scene || new THREE.Scene();
    this.camera = camera || new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 400);
    this.t = 0;
    this.shakeT = 0;
    this.tries = 0;
    this.state = 'tut';
    this.seed = seed ?? ((Date.now() / 1000) | 0);
    this.rng = seeded(this.seed);
    this.mouse = { x: 0, z: 0, active: false, down: false, pressed: false, moved: 0 };
    this.root = new THREE.Group();
    this.scene.add(this.root);
    this.build();
    this.hudEl = this.el('arc-hud');
    this.keysEl = this.el('arc-keys');
    this.panelEl = null;
    this.game.ui.root.classList.add('arc-on');
    this.listen();
    // levels games start at the first level not cleared yet (a puzzle has its own)
    const A = arcadeOf(this.game.roster.progress);
    this.startLevel = this.def.kind === 'levels' && !puzzle ? A.best[key] || 0 : 0;
    this.makeGame();
  }

  el(cls) {
    const el = document.createElement('div');
    el.className = cls;
    this.game.ui.root.appendChild(el);
    return el;
  }

  get name() { return t(`game.${this.key}`); }
  get css() { return hexCss(this.def.color); }

  // ---------- the look ----------

  build() {
    const sc = this.scene;
    this.lights = new THREE.Group();
    const hemi = new THREE.HemisphereLight(0xffffff, 0x8a7ab8, 1.6);
    const sun = new THREE.DirectionalLight(0xfff2dd, 1.6);
    sun.position.set(-6, 14, 8);
    this.lights.add(hemi, sun);
    sc.add(this.lights);
    this.puffs = new Particles(sc, { max: 300, shape: 'puff' });
    this.confetti = new Particles(sc, { max: 400, shape: 'box' });
    if (this.embedded) {
      // the island dims behind the puzzle (a big see-through sheet under the board)
      const dim = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshBasicMaterial({ color: 0x1b1530, transparent: true, opacity: 0.72, depthWrite: false }));
      dim.rotation.x = -Math.PI / 2;
      dim.position.y = -0.8;
      dim.renderOrder = -2;
      sc.add(dim);
    } else {
      const c = document.createElement('canvas');
      c.width = 4; c.height = 256;
      const g = c.getContext('2d');
      const gr = g.createLinearGradient(0, 0, 0, 256);
      gr.addColorStop(0, '#2b2340');
      gr.addColorStop(1, hexCss(this.def.color).replace(/^#/, '#'));
      g.fillStyle = gr;
      g.fillRect(0, 0, 4, 256);
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      sc.background = tex;
      // little twinkles far behind (still: no blinking)
      const geo = new THREE.SphereGeometry(0.12, 6, 4);
      const mat = new THREE.MeshBasicMaterial({ color: 0xfff4b8 });
      const r = seeded(7);
      for (let i = 0; i < 60; i++) {
        const s = new THREE.Mesh(geo, mat);
        s.position.set((r() - 0.5) * 90, -12 - r() * 4, (r() - 0.5) * 70);
        sc.add(s);
      }
    }
  }

  /** A frame around the board (a cabinet bezel: the game's colour, toon). */
  frame(w, h) {
    if (this.frameG) this.root.remove(this.frameG);
    const g = new THREE.Group();
    const col = new THREE.MeshToonMaterial({ color: this.def.color });
    const dark = new THREE.MeshToonMaterial({ color: 0x2b2340 });
    const b = 0.45, y = -0.35;
    const add = (geo, m, x, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); g.add(o); return o; };
    add(new THREE.BoxGeometry(w + b * 2, 0.5, b), col, 0, -h / 2 - b / 2);
    add(new THREE.BoxGeometry(w + b * 2, 0.5, b), col, 0, h / 2 + b / 2);
    add(new THREE.BoxGeometry(b, 0.5, h), col, -w / 2 - b / 2, 0);
    add(new THREE.BoxGeometry(b, 0.5, h), col, w / 2 + b / 2, 0);
    const floor = add(new THREE.BoxGeometry(w + b * 2, 0.2, h + b * 2), dark, 0, 0);
    floor.position.y = -0.62;
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const bolt = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), new THREE.MeshToonMaterial({ color: this.def.accent }));
      bolt.position.set(sx * (w / 2 + b / 2), -0.05, sz * (h / 2 + b / 2));
      g.add(bolt);
    }
    this.frameG = g;
    this.root.add(g);
  }

  /** Fit the camera to the board (room for the HUD on top and the keys line below). */
  fit() {
    const G = this.g;
    if (!G) return;
    const w = G.w + 1.6, h = G.h + 1.6;
    const cam = this.camera;
    cam.aspect = window.innerWidth / window.innerHeight;
    cam.fov = 40;
    const tan = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    const H = h * Math.cos(TILT * 0.6) + 4.2; // seen a little tilted; a band below for the tutorial's tips
    const dist = Math.max(H / 2 / tan, w / 2 / (tan * cam.aspect)) * (this.embedded ? 1.12 : 1.04);
    this.look = new THREE.Vector3(0, 0, 1.1); // (the board sits a little high: the tips go below it)
    this.camBase = new THREE.Vector3(0, Math.cos(TILT) * dist, Math.sin(TILT) * dist + 1.1);
    cam.position.copy(this.camBase);
    cam.lookAt(this.look);
    cam.updateProjectionMatrix();
  }

  resize() { this.fit(); }

  // ---------- the game ----------

  makeGame(level = this.startLevel) {
    if (this.g) { this.g.dispose?.(); this.root.remove(this.g.root); }
    const root = new THREE.Group();
    this.root.add(root);
    const host = this;
    const kit = {
      root, rng: this.rng, p: this.p, puzzle: this.puzzle, level, game: this.game,
      timing: () => timingScale(this.p),
      aim: () => aimLevel(this.p, this.game),
      calm: () => calmOn(),
      contrast: () => !!screenSettings(this.game).contrast,
      sfx: (n) => this.game.audio.play(n),
      tone: (midi, dur = 0.3, o = {}) => this.game.audio.tone(440 * Math.pow(2, (midi - 69) / 12), dur, { type: 'triangle', vol: 0.12, ...o }),
      did: (ev) => this.teach?.did(this.p, ev),
      fail: (kind, part) => host.fail(kind, part),
      puff: (x, z, color = 0xffffff, o = {}) => this.puffs.burst(new THREE.Vector3(x, o.y ?? 0.5, z), color, { count: 12, speed: 3, up: 2, size: 0.3, life: 0.6, ...o }),
      confetti: (x, z, o = {}) => this.confetti.burst(new THREE.Vector3(x, 1, z), 0, { count: 40, speed: 6, up: 5, life: 1.3, gravity: -9, colors: [0xffd23f, 0xff5d73, 0x4cc9f0, 0x3ddc97, 0xffffff], ...o }),
      shake: (a) => { this.shakeT = Math.max(this.shakeT, a); },
      toast: (msg) => this.game.ui.toast(msg, 2200),
      join2: () => this.secondPlayer(),
      takeArrows: () => { this.arrowsTaken = true; },
      get time() { return host.t; },
    };
    const G = new GAME_CLASSES[this.key](kit);
    G.root = root;
    this.g = G;
    this.frame(G.w, G.h);
    this.fit();
    if (this.game.contrastOn) refreshOutlines(this.scene, true);
    this.levelT = 0;
  }

  /** Go: the tutorial's first card (the first time), then Ready... go! */
  async start() {
    this.state = 'tut';
    const ans = await this.game.askTutorial({ id: `arc.${this.key}`, title: this.name, players: [this.p] });
    if (this.disposed) return;
    if (ans === 'show' && this.g.steps) {
      this.teach = new StepTeacher(this.host, { id: `arc.${this.key}`, players: [this.p], steps: () => this.g.steps() });
    }
    this.ready();
  }

  ready() {
    this.closePanel();
    this.state = 'ready';
    this.readyT = READY;
    this.game.input.clearLatches?.();
  }

  get tutorialActive() { return !!this.teach?.active; }
  skipTutorial() { this.teach?.skip(); }

  // ---------- input ----------

  listen() {
    const dom = this.game.renderer.domElement;
    const pos = (e) => {
      const r = dom.getBoundingClientRect();
      _v2.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      _ray.setFromCamera(_v2, this.camera);
      if (_ray.ray.intersectPlane(_plane, _hit)) { this.mouse.x = _hit.x; this.mouse.z = _hit.z; }
    };
    this.onMove = (e) => { if (e.target.closest?.('.arc-panel')) return; pos(e); this.mouse.active = true; this.mouse.moved = 0; };
    this.onDown = (e) => {
      if (e.target.closest?.('.panel')) return;
      pos(e);
      this.mouse.active = true;
      this.mouse.moved = 0;
      this.mouse.down = true;
      this.mouse.pressed = true;
    };
    this.onUp = () => { this.mouse.down = false; };
    window.addEventListener('pointermove', this.onMove);
    window.addEventListener('pointerdown', this.onDown);
    window.addEventListener('pointerup', this.onUp);
  }

  /** The device the player plays with, and the arrow keys on a keyboard (both WASD and the arrows steer). */
  frameInput(dt) {
    const d = this.game.input.get(this.p?.deviceId);
    if (!d) return NO_INPUT;
    const inp = this.game.input;
    let x = d.x, y = d.y, sx = d.stepX || 0, sy = d.stepY || 0;
    if (d.type === 'keyboard' && !this.arrowsTaken) {
      const dn = (c) => inp.down.has(c), pr = (c) => inp.pressed.has(c);
      if (dn('ArrowLeft') || dn('ArrowRight')) x = (dn('ArrowRight') ? 1 : 0) - (dn('ArrowLeft') ? 1 : 0);
      if (dn('ArrowUp') || dn('ArrowDown')) y = (dn('ArrowUp') ? 1 : 0) - (dn('ArrowDown') ? 1 : 0);
      if (!sx) sx = (pr('ArrowRight') ? 1 : 0) - (pr('ArrowLeft') ? 1 : 0);
      if (!sy) sy = (pr('ArrowUp') ? 1 : 0) - (pr('ArrowDown') ? 1 : 0);
    }
    // a held direction repeats (moving a block along, walking down a tunnel): first at once, then every 0.1 s
    const R = (this.rep ||= { x: 0, y: 0, tx: 0, ty: 0 });
    const dirX = x > 0.5 ? 1 : x < -0.5 ? -1 : 0, dirY = y > 0.5 ? 1 : y < -0.5 ? -1 : 0;
    const rep = (ax, dir, step) => {
      const k = `t${ax}`;
      if (step) { R[ax] = step; R[k] = 0.24; return step; }
      if (dir !== R[ax]) { R[ax] = dir; R[k] = 0.24; return 0; }
      if (!dir) return 0;
      R[k] -= dt;
      if (R[k] <= 0) { R[k] = 0.1; return dir; }
      return 0;
    };
    const repX = rep('x', dirX, sx), repY = rep('y', dirY, sy);
    const m = this.mouse;
    m.moved += dt;
    const mouse = m.active ? { x: m.x, z: m.z, down: m.down, pressed: m.pressed, fresh: m.moved < 1.5 } : null;
    m.pressed = false;
    return {
      x, y, dirX, dirY, stepX: sx, stepY: sy, repX, repY,
      a: d.a, aPressed: d.aPressed, b: d.b, bPressed: d.bPressed, c: d.c, cPressed: d.cPressed, ok: d.okPressed, dev: d, mouse,
    };
  }

  /** Another controller (a second gamepad, or the arrow keys' scheme) presses A: a second player (Paddle Pals). */
  secondPlayer() {
    const mine = this.p?.deviceId;
    for (const d of this.game.input.devices.values()) {
      if (d.id === mine || !d.connected || !d.aPressed) continue;
      if (d.type === 'keyboard' && d.id !== 'kb1') continue; // (Enter on the arrows' scheme)
      return d;
    }
    return null;
  }

  // ---------- trouble, help offers and skips ----------

  get part() { return this.puzzle ? `puzzle.${this.puzzle.id}` : this.def.kind === 'levels' ? `${this.key}.${this.g?.level ?? 0}` : this.key; }

  fail(kind = 'timing', part = this.part) {
    this.tries++;
    const skip = this.puzzle ? () => this.finishPuzzle(false, true) : this.def.kind === 'levels' ? () => this.skipLevel() : null;
    const at = this.puzzle ? { assist: 2, speed: 3, skip: 4, gap: 1 } : this.def.kind === 'levels' ? { assist: 3, speed: 4, skip: 5 } : null;
    struggle(this.host, this.p, kind, part, { skip, at, speed: !this.def.calm }); // (no slower game where nothing moves by itself)
  }

  skipLevel() {
    const G = this.g;
    markSkipped(this.game.roster.progress, this.key, `lv${G.level}`);
    const A = arcadeOf(this.game.roster.progress);
    A.best[this.key] = Math.max(A.best[this.key] || 0, G.level + 1);
    this.game.roster.save();
    this.makeGame(G.level + 1);
    this.ready();
  }

  // ---------- every frame ----------

  update(dt) {
    this.t += dt;
    // strong outlines on what spawned since (split rocks, new bricks: main.js does this only for the scene on screen)
    if (this.game.contrastOn && (this.outT = (this.outT || 0) + dt) > 0.5) { this.outT = 0; refreshOutlines(this.scene, true); }
    this.puffs.update(dt);
    this.confetti.update(dt);
    const G = this.g;
    const I = this.frameInput(dt);
    // camera shake (none with "Reduce flashing and shake")
    if (this.shakeT > 0) this.shakeT = Math.max(0, this.shakeT - dt * 2.5);
    const s = this.shakeT * 0.35 * shakeScale();
    this.camera.position.set(this.camBase.x + (s ? (Math.random() - 0.5) * s : 0), this.camBase.y, this.camBase.z + (s ? (Math.random() - 0.5) * s : 0));
    this.camera.lookAt(this.look);
    if (this.state === 'tut') { G.idle?.(dt); this.renderHud(); return; }
    if (this.state === 'ready') {
      this.readyT -= dt;
      G.idle?.(dt);
      if (this.readyT <= 0) { this.state = 'play'; this.game.audio.play('go'); }
      this.renderHud();
      return;
    }
    if (this.state === 'play') {
      if (I.cPressed) { this.back(); return; }
      G.update(dt, I);
      this.teach?.update(dt);
      if (this.teach) this.teach.hidden = false;
      if (G.state === 'won') this.solved();
      else if (G.state === 'over') this.over();
      else if (G.state === 'level') this.levelDone();
      this.renderHud();
      return;
    }
    // a card is up: [A] / [OK] picks, the stick moves, [C] backs out
    G.idle?.(dt);
    if (this.teach) { this.teach.hidden = true; this.teach.update(0); }
    this.updatePanel(I, dt);
    this.renderHud();
  }

  /** [C] while playing: the pause menu in the hall's games; a puzzle is left (come back any time). */
  back() {
    if (this.embedded) { this.leave({}); return; }
    this.game.openPause();
  }

  leave(result) {
    if (this.left) return;
    this.left = true;
    this.closePanel();
    this.onExit?.(result);
  }

  // ---------- the HUD ----------

  renderHud() {
    const G = this.g;
    const pills = [`<div class="pill name" style="--c:${this.css}">${esc(this.puzzle ? `🧩 ${this.name}` : this.name)}</div>`];
    for (const [label, value] of G.hud?.() || []) pills.push(`<div class="pill">${esc(label)} <b>${esc(String(value))}</b></div>`);
    if (!this.puzzle && this.def.kind === 'score') pills.push(`<div class="pill">${esc(t('arc.best'))} <b>${bestOf(this.game.roster.progress, this.key)}</b></div>`);
    const goal = this.puzzle ? G.goalText?.() : null;
    if (goal) pills.push(`<div class="pill goal">🎯 ${esc(goal)}</div>`);
    if (this.state === 'ready') pills.push(`<div class="pill goal">${esc(this.readyT > 0.35 ? t('arc.ready') : t('go'))}</div>`);
    const html = pills.join('');
    if (html !== this.hudHtml) { this.hudHtml = html; this.hudEl.innerHTML = html; }
    const keys = this.state === 'play' || this.state === 'ready' ? `${tFor(this.p, G.keys?.() || 'arc.keys')} · ${tFor(this.p, this.embedded ? 'arc.keys.leave' : 'arc.keys.menu')}` : '';
    if (keys !== this.keysHtml) { this.keysHtml = keys; this.keysEl.innerHTML = esc(keys); this.keysEl.style.display = keys ? '' : 'none'; }
  }

  // ---------- the end of a game, a level, a puzzle ----------

  report(stats) {
    passportReport(this.host, 'finish', { key: this.key, n: 1, ...stats });
  }

  over() {
    const G = this.g;
    if (this.puzzle) {
      // a puzzle's try ended without the goal: try again at once (tries count toward a skip offer)
      this.fail(G.failKind || 'timing');
      this.panel({ title: t('arc.again.title'), sub: G.overText?.() || t('arc.again.sub'), items: ['retry', 'leave'] });
      return;
    }
    const st = G.stats?.() || {};
    const score = G.score || 0;
    const rec = recordScore(this.game, this.key, score);
    this.report({ proper: G.proper ? G.proper() : score > 0, mastery: st.mastery || [], trials: st.trials || [] });
    if (G.poorGame ? G.poorGame() : score < 3) this.fail(G.failKind || 'timing');
    else overcame(this.host, this.part);
    this.game.roster.addStars(score > 0 ? 1 : 0);
    this.panel({ title: G.overTitle?.() || t('arc.over'), score, best: rec, items: ['again', 'back'] });
  }

  levelDone() {
    const G = this.g;
    const st = G.stats?.() || {};
    overcame(this.host, this.part);
    const rec = recordScore(this.game, this.key, G.level + 1);
    this.report({ proper: true, mastery: st.mastery || [], trials: st.trials || [] });
    this.game.roster.addStars(1);
    this.confettiBurst();
    const last = G.level + 1 >= (G.levelCount ?? Infinity);
    this.panel({ title: t('arc.levelDone', { n: G.level + 1 }), sub: G.levelText?.() || '', best: rec, items: last ? ['replay', 'back'] : ['next', 'replay', 'back'] });
  }

  solved() {
    const G = this.g;
    const st = G.stats?.() || {};
    this.report({ proper: true, mastery: st.mastery || [], trials: st.trials || [] });
    overcame(this.host, this.part);
    this.confettiBurst();
    this.panel({ title: t('arc.solved'), sub: this.puzzle.rewardText || '', items: ['collect'] });
  }

  confettiBurst() {
    const G = this.g;
    for (let i = 0; i < 3; i++) this.confetti.burst(new THREE.Vector3((i - 1) * G.w * 0.3, 1.5, 0), 0, { count: 45, speed: 7, up: 6, life: 1.6, gravity: -8, colors: [0xffd23f, 0xff5d73, 0x4cc9f0, 0x3ddc97, 0xffffff] });
    this.game.audio.play('fanfare');
  }

  finishPuzzle(solved, skipped = false) {
    this.leave({ solved, skipped });
  }

  // ---------- the cards ----------

  panel({ title, sub = '', score = null, best = null, items }) {
    this.closePanel();
    this.state = 'card';
    this.items = items;
    this.sel = 0;
    this.cardT = 0;
    this.card = { title, sub, score, best };
    this.panelEl = this.game.ui.panel('', 'panel pause arc-panel');
    this.panelEl.style.setProperty('--c', this.css);
    this.panelEl.addEventListener('click', (e) => {
      const i = [...this.panelEl.querySelectorAll('.pause-item')].indexOf(e.target.closest('.pause-item'));
      if (i >= 0 && this.cardT > 0.4) { this.sel = i; this.pick(this.items[i]); }
    });
    this.renderPanel();
    const parts = [title, sub, score !== null ? t('arc.say.score', { n: score }) : '', best?.isNew ? t('arc.newBest') : ''].filter(Boolean);
    say(parts.join('. '), 'narrator');
  }

  renderPanel() {
    if (!this.panelEl) return;
    const c = this.card;
    let mid = '';
    if (c.score !== null) mid += `<div class="arc-score">${esc(String(c.score))}</div>`;
    if (c.best?.isNew) mid += `<div class="arc-new">⭐ ${esc(t('arc.newBest'))}</div>`;
    if (c.best && !this.puzzle) {
      const fam = familyBests(this.game, this.key).slice(0, 6);
      const unit = this.def.kind === 'levels' ? t('arc.levelsShort') : '';
      if (fam.length) mid += `<div class="arc-family">🏆 ${fam.map((f) => `<span class="${f.me ? 'me' : ''}">${esc(f.name)}: ${f.best}${unit}</span>`).join('')}</div>`;
    }
    const items = this.items.map((k, i) => `<div class="pause-item ${i === this.sel ? 'on' : ''}">${esc(t(`arc.i.${k}`))}</div>`).join('');
    this.panelEl.innerHTML = `<div class="results-title">${esc(c.title)}</div>${c.sub ? `<div class="results-sub">${esc(c.sub)}</div>` : ''}${mid}
      <div class="pause-list">${items}</div><div class="results-footer">${esc(tFor(this.p, 'arc.cardKeys'))}</div>`;
  }

  updatePanel(I, dt) {
    this.cardT += dt;
    if (I.stepY) { this.sel = (this.sel - I.stepY + this.items.length) % this.items.length; this.game.audio.play('select'); this.renderPanel(); }
    if (this.cardT < 0.35) return; // (a child still mashing [A] does not pick by accident)
    if (I.cPressed) { const k = this.items.find((x) => ['back', 'leave', 'collect'].includes(x)); if (k) this.pick(k); return; }
    if (I.aPressed || I.ok) this.pick(this.items[this.sel]);
  }

  pick(k) {
    this.game.audio.play('select');
    if (k === 'again') { this.makeGame(); this.ready(); return; }
    if (k === 'retry' || k === 'replay') { this.makeGame(this.g.level ?? this.startLevel); this.ready(); return; }
    if (k === 'next') { this.makeGame(this.g.level + 1); this.ready(); return; }
    if (k === 'collect') { this.finishPuzzle(true); return; }
    if (k === 'leave' || k === 'back') { this.leave({}); }
  }

  closePanel() {
    this.panelEl?.remove();
    this.panelEl = null;
  }

  /** (tests) Answer the card in front: 'again', 'next', 'back'... */
  choose(k) { if (this.items?.includes(k)) this.pick(k); }

  render(renderer) {
    renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.disposed = true;
    this.game.ui.root.classList.remove('arc-on');
    this.closePanel();
    this.hudEl.remove();
    this.keysEl.remove();
    this.teach?.dispose();
    this.g?.dispose?.();
    window.removeEventListener('pointermove', this.onMove);
    window.removeEventListener('pointerdown', this.onDown);
    window.removeEventListener('pointerup', this.onUp);
  }
}
