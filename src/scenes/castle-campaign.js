import * as THREE from 'three';
import { MiniGame } from '../core/minigame.js';
import { Character } from '../core/character.js';
import { COLORS, toon, basic, sharedGeo } from '../core/palette.js';
import { addLights, skyTexture, makeCloud, makeTree, makeBush, makeStar, seeded } from '../core/world.js';
import { moveBody, platformerControl, approach } from '../core/physics2d.js';
import { t } from '../core/i18n.js';
import { esc } from '../core/ui.js';
import { TileMap, ROWS, EMPTY, DIRT, STONE, CASTLE, WOOD, DOOR, LADDER, PAD, BEDROCK, WATER, GATE, DIG_TIME, KNIGHT_HP, REFUND, STICKY } from './castle/tilemap.js';
import { LEVELS, parseLevel, troopersNeeded } from './castle/levels.js';
import { Troopers } from './castle/troopers.js';
import { Grumbles } from './castle/grumbles.js';
import { Siege } from './castle/siege.js';
import { makeTent, makeGoalFlag, makeHintGhost, mesh, GOLD } from './castle/props.js';
import { CampaignMap, loadProgress, saveProgress } from './castle/map.js';
import './castle/text.js';
import './castle.js'; // Versus strings (castle.cls.*, castle.piece.*, ...) shared with the campaign

// Knights & Builders: the Campaign. Co-op story mode: everyone plays on the bean team and helps the
// marching bean troopers past grumble castles to the Golden Bean Princess. Without opts.level this
// scene is the level map (castle/map.js); with opts.level it plays that level.
//
// Hero code (building, foam swords, suction-cup arrows, bubbles) is adapted from castle.js (Versus),
// on a map of any width with a camera that follows the group.

const BW = 0.78, BH = 1.35;
const BEAN_SCALE = 1.15;
const MAX_HITS = 3;
const HIT_RESET = 5;
const BUBBLE_TIME = 3;
const CHARGE_FULL = 0.75;
const DRAW_FULL = 0.7;
const WOOD_START = 30, WOOD_MAX = 40;
const ARROWS_START = 10, ARROWS_MAX = 14;
const VIEW_W = 40;
const STRAY_TIME = 2.5;
const BONUS_TIME = 30;
const PHYS = { speed: 6.2, accel: 60, airAccel: 40, jump: 14.5, jump2: 0, doubleJump: false, gravity: 38, fallMul: 1.6, coyote: 0.1, buffer: 0.14, maxFall: -20 };
const PHYS_SLOW = { ...PHYS, speed: 3.4 };
const PIECES = [
  { key: 'block', tile: WOOD, cost: 1 },
  { key: 'ladder', tile: LADDER, cost: 1 },
  { key: 'door', tile: DOOR, cost: 2 },
  { key: 'pad', tile: PAD, cost: 2 },
];
const CLASSES = ['builder', 'knight', 'archer'];
const GLYPH = { builder: '⚒', knight: '⚔', archer: '➶' };
const NO_INPUT = { x: 0, y: 0, a: false, b: false, c: false, aPressed: false, bPressed: false, cPressed: false, stepX: 0, stepY: 0 };
const clamp = THREE.MathUtils.clamp;
const clock = (s) => {
  const secs = Math.max(0, Math.ceil(s));
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
};

injectStyle();

/** Difficulty for level L (0..6) and n players. */
export function makeDiff(L, n) {
  return {
    L, n,
    gSpeed: 3.3 + 0.12 * L + 0.05 * n,
    leash: 11,
    aggro: 7.5 + 0.3 * L,
    swingGap: Math.max(0.45, 0.95 - 0.06 * L - 0.04 * n),
    shield: 0.2 + 0.05 * L,
    dizzy: 1.2 + 0.05 * L,
    reserves: 1 + Math.floor(L / 2) + Math.floor((n - 1) / 2),
    respawn: Math.max(6, 14 - L - 0.5 * n),
    archerRate: Math.max(1.6, 3.4 - 0.18 * L - 0.12 * n),
    archerRange: 15 + L,
    archerSpread: Math.max(0.6, 2.2 - 0.2 * L),
    repair: Math.max(1.0, 2.0 - 0.1 * L - 0.05 * n),
    catRate: Math.max(3, 6.5 - 0.35 * L - 0.25 * n),
    catSpread: Math.max(0.8, 2.4 - 0.2 * L),
    cageHp: 3 + Math.floor(n / 2),
    catHp: 4 + Math.floor(n / 2),
    princessHp: 8 + n,
  };
}

/** Class picker for the co-op team (everyone on the bean team). */
class ClassPicker {
  constructor(scene, heroes, onDone) {
    this.scene = scene;
    this.heroes = heroes;
    this.onDone = onDone;
    this.time = 0;
    this.locked = new Map(heroes.map((e) => [e, false]));
    this.el = scene.game.ui.panel('', 'panel picker');
    this.render();
  }

  render() {
    const cols = CLASSES.map((cls) => {
      const chips = this.heroes.filter((e) => e.cls === cls).map((e) => {
        const ok = this.locked.get(e);
        return `<div class="ball-pick ${ok ? 'done' : ''}" style="--c:${e.css}">${esc(e.name)}${ok ? ' ✓' : ''}</div>`;
      }).join('');
      return `<div class="vote-opt" style="width:clamp(140px,22vw,280px)"><div class="vote-label">${GLYPH[cls]} ${esc(t(`castle.cls.${cls}`))}</div>
        <div style="font-size:clamp(11px,1vw,16px);font-weight:600;text-align:center;opacity:.75;margin-bottom:6px">${esc(t(`kc.desc.${cls}`))}</div>${chips}</div>`;
    }).join('');
    this.el.innerHTML = `<div class="results-title">${esc(this.scene.levelTitle())}</div>
      <div class="results-sub">${esc(t('castle.pick'))}</div>
      <div class="vote-row">${cols}</div>
      <div class="results-footer">${esc(t('castle.pickHint'))}<br>${esc(t('kc.pickTent'))}</div>`;
  }

  update(dt) {
    if (this.done) return;
    const { scene } = this;
    this.time += dt;
    let changed = false;
    for (const e of this.heroes) {
      const d = scene.input(e.p);
      if (!d) continue;
      const ok = this.locked.get(e);
      if (!ok && d.stepX) {
        const i = clamp(CLASSES.indexOf(e.cls) + d.stepX, 0, 2);
        if (CLASSES[i] !== e.cls) { scene.setClass(e, CLASSES[i]); scene.game.audio.play('select'); changed = true; }
      }
      if (d.aPressed) { this.locked.set(e, !ok); scene.game.audio.play(ok ? 'select' : 'join'); changed = true; }
    }
    if (changed) this.render();
    if ([...this.locked.values()].every(Boolean) || this.time > 40) {
      this.done = true;
      this.el.remove();
      this.onDone();
    }
  }
}

export class CastleCampaignScene extends MiniGame {
  constructor(game, opts = {}) {
    super(game, { ...opts, key: opts.key || 'castle' });
    this.opts = opts;
    this.prog = loadProgress(game);
    this.floaters = [];
    if (opts.level === undefined || opts.level === null) {
      this.mode = 'map';
      this.state = 'map';
      this.mapView = new CampaignMap(this, opts, (i) => this.startLevel(i));
      return;
    }
    this.mode = 'level';
    this.levelIndex = clamp(opts.level | 0, 0, LEVELS.length - 1);
    this.level = LEVELS[this.levelIndex];
    this.buildLevel();
  }

  /** Leave the map for a level (behind the circle wipe). */
  startLevel(i) {
    const game = this.game;
    game.transition(() => new CastleCampaignScene(game, { key: 'castle', mode: 'campaign', level: i }));
  }

  backToMap(result = null) {
    const game = this.game;
    game.transition(() => new CastleCampaignScene(game, { key: 'castle', mode: 'campaign', result }));
  }

  retryOptions() {
    if (this.mode === 'map') return { key: 'castle', mode: 'campaign' };
    const classes = {};
    for (const e of this.heroes) classes[e.p.deviceId] = e.cls;
    return { key: 'castle', mode: 'campaign', level: this.levelIndex, classes };
  }

  levelTitle() {
    return `${t('kc.levelN', { n: this.levelIndex + 1 })}: ${t(`kc.level.${this.level.id}`)}`;
  }

  onLanguage() {
    this.picker?.render();
    this.mapView?.onLanguage();
  }

  // ---------- building the level ----------

  buildLevel() {
    const n = Math.max(1, this.players.length);
    this.diff = makeDiff(this.levelIndex, n);
    this.scene.background = skyTexture(this.level.finale ? '#ffb8d9' : '#7fcfff', '#fff3d9');
    this.lights = addLights(this.scene, { size: 30, target: new THREE.Vector3(0, 10, 0), dir: new THREE.Vector3(-0.45, 0.85, 1) });
    const grid = parseLevel(this.level);
    this.grid = grid;
    this.map = new TileMap(this.scene, grid);
    this.cols = grid.cols;
    this.arrows = [];
    this.clouds = [];
    this.shake = 0;
    this.timeLeft = this.level.time;
    this.goalTime = null;
    this.bonusT = null;
    this.homeCount = 0;
    const need = troopersNeeded(this.level, this.levelIndex, n);
    this.need = need.need;

    const M = (ch) => grid.markers.filter((m) => m.ch === ch);
    const camp = M('T')[0], start = M('P')[0], flag = M('F')[0];
    this.flagPos = { x: flag.c + 0.5, y: flag.r };
    this.tents = [start, ...M('t')].map((m) => ({ x: m.c + 0.5, y: m.r, reached: false }));
    this.tents.sort((a, b) => a.x - b.x);
    this.tents[0].reached = true;
    this.checkpoint = 0;
    for (const tn of this.tents) {
      const g = makeTent(tn === this.tents[0] ? 0xff5d73 : 0x4cc9f0);
      g.position.set(tn.x, tn.y, 0);
      this.scene.add(g);
      tn.mesh = g;
      tn.label = this.game.ui.label('label kc-tent');
    }
    this.flag = makeGoalFlag();
    this.flag.position.set(this.flagPos.x, this.flagPos.y, 0);
    this.scene.add(this.flag);

    this.troopers = new Troopers(this, { camp: { x: camp.c + 0.5, y: camp.r }, flag: this.flagPos, count: this.level.troopers });
    this.siege = new Siege(this, grid.markers, this.diff, this.level);
    this.grumbles = new Grumbles(this, this.diff);
    const extra = { n: n >= 3, m: n >= 5, v: n >= 3, e: n >= 4 };
    const TYPE = { k: 'knight', n: 'knight', m: 'knight', a: 'archer', e: 'archer', b: 'builder', v: 'builder' };
    for (const mk of grid.markers) {
      if (!TYPE[mk.ch] || extra[mk.ch] === false) continue;
      this.grumbles.add(TYPE[mk.ch], mk.c, mk.r);
    }
    // Tutorial ghosts.
    this.ghostMat = new THREE.MeshToonMaterial({ color: 0xfff3a0, gradientMap: toon(0xffffff).gradientMap, transparent: true, opacity: 0.45 });
    this.hints = [];
    for (const mk of grid.markers) {
      if (mk.ch !== 'h' && mk.ch !== 'l') continue;
      const g = makeHintGhost(mk.ch === 'l', this.ghostMat);
      g.position.set(mk.c + 0.5, mk.r + 0.5, 0);
      this.scene.add(g);
      this.hints.push({ c: mk.c, r: mk.r, g });
    }

    this.heroes = this.players.map((p, i) => this.makeHero(p, i));
    this.defaultClasses();
    this.placeHeroes();
    this.buildScenery();
    this.camX = this.tents[0].x + 12;
    this.frame();
    this.map.rebuild();
    this.game.audio.playMusic(this.level.finale ? 'party' : 'platformer');

    this.state = 'classes';
    const go = () => {
      this.picker = null;
      this.intro(this.levelTitle(), this.goalLine());
    };
    if (this.opts.classes) {
      for (const e of this.heroes) if (this.opts.classes[e.p.deviceId]) this.setClass(e, this.opts.classes[e.p.deviceId]);
      this.later(0.05, go); // after setScene, so intro() sees this as the current scene
    } else {
      this.picker = new ClassPicker(this, this.heroes, go);
    }
  }

  goalLine() {
    return this.goals().map((g) => g.text).join(' · ');
  }

  buildScenery() {
    const s = this.scene;
    const rand = seeded(91 + this.levelIndex * 13);
    const W = this.cols;
    s.add(mesh(new THREE.BoxGeometry(W + 60, 8, 3), toon(0x8a5a3a), W / 2, -4, -0.2));
    for (const sx of [-1, 1]) {
      const x = sx < 0 ? -10 : W + 10;
      s.add(mesh(new THREE.BoxGeometry(20, 7, 1.6), toon(COLORS.dirt), x, 3.5, 0));
      s.add(mesh(new THREE.BoxGeometry(20, 0.26, 1.72), toon(COLORS.grass), x, 6.9, 0));
    }
    const cone = sharedGeo('kbMount', () => new THREE.ConeGeometry(1, 1, 7));
    for (let x = -40; x < W + 40; x += 15 + rand() * 6) {
      const h = 14 + rand() * 10;
      const m = mesh(cone, toon(rand() < 0.5 ? 0xa9b8e8 : 0x9aaee0), x, 2 + h / 2, -70);
      m.scale.set(12 + rand() * 6, h, 8);
      const cap = mesh(cone, toon(COLORS.white), x, 2 + h - h * 0.15, -69.5);
      cap.scale.set((12 + rand() * 6) * 0.3, h * 0.3, 3);
      s.add(m, cap);
    }
    const hillGeo = sharedGeo('kbHill', () => new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2));
    for (let x = -30; x < W + 30; x += 10 + rand() * 4) {
      const hill = mesh(hillGeo, toon(rand() < 0.5 ? 0x8fdc6a : 0x6fcb57), x, 5.5, -30 - rand() * 12);
      const r = 9 + rand() * 7;
      hill.scale.set(r, r * (0.45 + rand() * 0.3), 6);
      s.add(hill);
    }
    for (let x = -20; x < W + 20; x += 6 + rand() * 3) {
      const tr = makeTree(rand, 1.6 + rand(), [0x58b947, 0x4cc46a, 0x7ad65a]);
      tr.position.set(x, 8 + rand() * 2, -24 - rand() * 4);
      s.add(tr);
    }
    // Trees and bushes just behind the path, only on open grass.
    const top = (c) => { for (let r = ROWS - 1; r > 0; r--) if (this.map.at(c, r) !== EMPTY) return r; return 0; };
    for (let c = 3; c < W - 3; c += 5 + Math.floor(rand() * 5)) {
      const r = top(c);
      if (this.map.at(c, r) !== DIRT || this.grid.back[c][r + 1] === 2) continue;
      if (rand() < 0.45) {
        const tr = makeTree(rand, 0.9 + rand() * 0.3, [0x58b947, 0x4cc46a, 0x7ad65a]);
        tr.position.set(c + 0.5, r + 1, -1.7);
        s.add(tr);
      } else {
        const b = makeBush(rand, 0.8 + rand() * 0.3);
        b.position.set(c + 0.5, r + 1, -1.1);
        s.add(b);
      }
    }
    for (let x = -20; x < W + 20; x += 12 + rand() * 6) {
      const cl = makeCloud(rand, 1.6 + rand() * 1.2);
      cl.position.set(x, 19 + rand() * 5, -16 - rand() * 6);
      s.add(cl);
      this.clouds.push(cl);
    }
  }

  frame() {
    if (this.mode !== 'level') { this.mapView?.frame(); return; }
    this.camDist = this.fitDistance(VIEW_W, ROWS - 1);
    this.halfW = this.viewHalfSize(this.camDist).w;
    this.camY = ROWS / 2 - 0.6;
    this.placeCamera();
  }

  resize(w, h) {
    super.resize(w, h);
    this.frame();
  }

  placeCamera() {
    const hw = this.halfW;
    const lo = hw - 1, hi = this.cols - hw + 1;
    const x = lo > hi ? this.cols / 2 : clamp(this.camX, lo, hi);
    this.camX = x;
    this.camera.position.set(x, this.camY, this.camDist);
    this.camera.lookAt(x, this.camY, 0);
    this.confettiOrigin = new THREE.Vector3(x, 14, 0);
    const sun = this.lights.sun;
    sun.position.set(x - 18, 10 + 34, 40);
    sun.target.position.set(x, 10, 0);
  }

  // ---------- heroes ----------

  makeHero(p, i) {
    const ch = new Character(p.color, { hat: p.hat });
    ch.group.scale.setScalar(BEAN_SCALE);
    this.scene.add(ch.group);
    const bubble = mesh(sharedGeo('kbBubble', () => new THREE.SphereGeometry(0.95, 22, 16)), toon(p.color, { transparent: true, opacity: 0.35 }));
    bubble.visible = false;
    this.scene.add(bubble);
    const e = {
      p, kind: 'hero', team: 0, ch, bubble, cls: 'knight', slot: i,
      css: p.css,
      get name() { return p.name; },
      body: { x: 0, y: 7, w: BW, h: BH, vx: 0, vy: 0, grounded: true },
      facing: 1, aimX: 1, aimY: 0,
      state: 'play', bub: null, invuln: 0, hits: 0, hitT: 0, wobble: 0,
      wood: WOOD_START, arrows: ARROWS_START, refill: 0, piece: 0,
      holdMode: null, buildCd: 0, holdT: 0, cursor: null, work: 0, hammerCd: 0,
      charging: false, charge: 0, swingT: 0, swingBig: false, swingCd: 0, shield: false, slide: 0,
      drawing: false, draw: 0, ropeCd: 0, zip: null, climbing: false, bounced: false,
      bonks: 0, built: 0, freed: 0, levers: 0, cats: 0, lastSafe: { x: 0, y: 7 }, strayT: 0,
    };
    this.makeGear(e);
    e.label = this.game.ui.label('label player-tag');
    e.labelHtml = '';
    const frame = new THREE.Group();
    const bar = sharedGeo('kbCurBar', () => new THREE.BoxGeometry(1, 0.08, 0.08));
    for (const [x, y, rz] of [[0, 0.48, 0], [0, -0.48, 0], [-0.48, 0, Math.PI / 2], [0.48, 0, Math.PI / 2]]) {
      const m = mesh(bar, basic(p.color), x, y, 0);
      m.rotation.z = rz;
      frame.add(m);
    }
    frame.userData.bars = frame.children;
    frame.visible = false;
    this.scene.add(frame);
    e.cursorMesh = frame;
    e.ghosts = PIECES.map((pc) => this.makeGhost(pc.key));
    e.ghosts.forEach((g) => { g.visible = false; this.scene.add(g); });
    return e;
  }

  makeGhost(key) {
    if (!this.pieceGhostMat) {
      this.pieceGhostMat = new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: toon(0xffffff).gradientMap, transparent: true, opacity: 0.5 });
    }
    const g = new THREE.Group();
    const add = (geo, x = 0, y = 0) => { const m = mesh(geo, this.pieceGhostMat, x, y, 0.85); g.add(m); return m; };
    if (key === 'block') add(new THREE.BoxGeometry(0.8, 0.8, 0.1));
    if (key === 'door') { add(new THREE.BoxGeometry(0.62, 0.86, 0.1)); add(new THREE.BoxGeometry(0.12, 0.12, 0.12), 0.18, 0); }
    if (key === 'ladder') { add(new THREE.BoxGeometry(0.08, 0.86, 0.1), -0.28); add(new THREE.BoxGeometry(0.08, 0.86, 0.1), 0.28); add(new THREE.BoxGeometry(0.6, 0.08, 0.1), 0, -0.2); add(new THREE.BoxGeometry(0.6, 0.08, 0.1), 0, 0.2); }
    if (key === 'pad') { add(new THREE.BoxGeometry(0.8, 0.3, 0.1), 0, -0.25); add(new THREE.BoxGeometry(0.7, 0.2, 0.1), 0, 0.05); }
    return g;
  }

  /** Foam sword, shield, hammer and bow, drawn in front of the bean (as in castle.js). */
  makeGear(e) {
    const g = new THREE.Group();
    const team = 0xffc93c;
    const sword = new THREE.Group();
    sword.position.set(0.3, 0.55, 0.05);
    const blade = mesh(sharedGeo('kbBlade', () => new THREE.BoxGeometry(0.17, 0.95, 0.1)), toon(0xffe47a), 0, 0.68, 0);
    const guard = mesh(sharedGeo('kcGuard', () => new THREE.BoxGeometry(0.42, 0.09, 0.14)), toon(team), 0, 0.17, 0);
    const grip = mesh(sharedGeo('kbGrip', () => new THREE.CylinderGeometry(0.045, 0.045, 0.26, 6)), toon(COLORS.trunk), 0, 0.03, 0);
    sword.add(blade, guard, grip);
    const shield = new THREE.Group();
    const disc = mesh(sharedGeo('kbShield', () => new THREE.CylinderGeometry(0.36, 0.36, 0.08, 20)), toon(team));
    disc.rotation.x = Math.PI / 2;
    const rim = mesh(sharedGeo('kbRim', () => new THREE.TorusGeometry(0.36, 0.045, 6, 20)), toon(COLORS.white));
    const boss = mesh(sharedGeo('kbBoss', () => new THREE.SphereGeometry(0.1, 10, 8)), toon(COLORS.gold), 0, 0, 0.05);
    shield.add(disc, rim, boss);
    const hammer = new THREE.Group();
    hammer.position.set(0.3, 0.5, 0.05);
    hammer.add(mesh(sharedGeo('kbHandle', () => new THREE.CylinderGeometry(0.04, 0.04, 0.55, 6)), toon(COLORS.trunk), 0, 0.27, 0));
    hammer.add(mesh(sharedGeo('kcHHead', () => new THREE.BoxGeometry(0.34, 0.17, 0.17)), toon(0xb8b4cc), 0, 0.56, 0));
    hammer.add(mesh(sharedGeo('kbBand', () => new THREE.BoxGeometry(0.08, 0.19, 0.19)), toon(team), 0, 0.56, 0));
    const bow = new THREE.Group();
    bow.position.set(0.22, 0.68, 0.08);
    const arc = mesh(sharedGeo('kbBow', () => new THREE.TorusGeometry(0.4, 0.045, 6, 14, Math.PI)), toon(0xc98b5a));
    arc.rotation.z = -Math.PI / 2;
    const string = mesh(sharedGeo('kbString', () => new THREE.CylinderGeometry(0.012, 0.012, 0.8, 4)), toon(COLORS.icing));
    const nock = new THREE.Group();
    const shaft = mesh(sharedGeo('kbNock', () => new THREE.CylinderGeometry(0.03, 0.03, 0.75, 5)), toon(COLORS.icing), 0.3, 0, 0);
    shaft.rotation.z = Math.PI / 2;
    const cup = mesh(sharedGeo('kbNockCup', () => new THREE.SphereGeometry(0.09, 8, 6)), toon(team), 0.7, 0, 0);
    nock.add(shaft, cup);
    bow.add(arc, string, nock);
    const quiver = mesh(sharedGeo('kbQuiver', () => new THREE.CylinderGeometry(0.11, 0.09, 0.5, 8)), toon(0xa0704a), -0.36, 0.85, -0.25);
    quiver.rotation.z = -0.4;
    g.add(sword, shield, hammer, bow, quiver);
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.scene.add(g);
    const rope = mesh(sharedGeo('kbRope', () => new THREE.CylinderGeometry(0.03, 0.03, 1, 5)), toon(0xf7e1a6));
    rope.visible = false;
    this.scene.add(rope);
    e.gear = { g, sword, blade, shield, hammer, bow, nock, quiver, rope };
    this.setClass(e, e.cls);
  }

  setClass(e, cls) {
    e.cls = cls;
    const G2 = e.gear;
    G2.sword.visible = G2.shield.visible = cls === 'knight';
    G2.hammer.visible = cls === 'builder';
    G2.bow.visible = G2.quiver.visible = cls === 'archer';
    e.holdMode = null;
    e.charging = e.drawing = e.shield = false;
  }

  /** Builder first (so bridges can always be built), then knight, archer. */
  defaultClasses() {
    this.heroes.forEach((e, k) => this.setClass(e, ['builder', 'knight', 'archer'][k % 3]));
  }

  /** A free standing spot near the current checkpoint tent. */
  spawnPoint(e, k = e.slot) {
    const tn = this.tents[this.checkpoint];
    const offs = [0, -0.9, 0.9, -1.8, 1.8, 0.45];
    for (let tries = 0; tries < offs.length; tries++) {
      const x = tn.x + offs[(k + tries) % offs.length];
      const c = Math.floor(x);
      for (let r = Math.max(1, tn.y - 1); r < ROWS - 2; r++) {
        if (!this.map.solidFor(c, r, 0) && !this.map.solidFor(c, r + 1, 0) && this.map.solidFor(c, r - 1, 0)) return { x: c + 0.5, y: r };
      }
    }
    return { x: tn.x, y: tn.y + 1 };
  }

  placeHeroes() {
    this.heroes.forEach((e, k) => {
      const sp = this.spawnPoint(e, k);
      e.body.x = sp.x; e.body.y = sp.y; e.body.vx = e.body.vy = 0;
      e.lastSafe = { ...sp };
      e.facing = 1;
    });
  }

  // ---------- physics helpers ----------

  solidsAround(b, team) {
    const out = [];
    const m = this.map;
    const c0 = Math.floor(b.x - b.w / 2) - 1, c1 = Math.floor(b.x + b.w / 2) + 1;
    const r0 = Math.floor(b.y) - 2, r1 = Math.floor(b.y + b.h) + 2;
    for (let c = c0; c <= c1; c++) {
      for (let r = r0; r <= r1; r++) {
        if (m.solidFor(c, r, team)) {
          out.push({ x: c, y: r, w: 1, h: 1, pad: m.at(c, r) === PAD });
        } else if (m.at(c, r) === LADDER && m.at(c, r + 1) !== LADDER) {
          out.push({ x: c, y: r + 0.7, w: 1, h: 0.3, oneWay: true, ladderTop: true });
        }
      }
    }
    return out;
  }

  onLadder(b) {
    const c = Math.floor(b.x);
    for (let r = Math.floor(b.y + 0.05); r <= Math.floor(b.y + b.h - 0.3); r++) if (this.map.at(c, r) === LADDER) return true;
    return false;
  }

  inWater(b) {
    return this.map.at(Math.floor(b.x), Math.floor(b.y + 0.3)) === WATER;
  }

  cellHitsBody(c, r, b, pad = 0.02) {
    return b.x + b.w / 2 > c + pad && b.x - b.w / 2 < c + 1 - pad && b.y + b.h > r + pad && b.y < r + 1 - pad;
  }

  /** Anyone (bean, trooper, grumble) standing in this cell? */
  cellOccupied(c, r) {
    for (const e of this.heroes) if (e.state === 'play' && this.cellHitsBody(c, r, e.body)) return true;
    for (const tr of this.troopers.list) if (tr.state !== 'home' && tr.state !== 'caged' && tr.state !== 'bubble' && this.cellHitsBody(c, r, tr.body)) return true;
    for (const g of this.grumbles.list) if ((g.state === 'play' || g.state === 'friendly') && this.cellHitsBody(c, r, g.body)) return true;
    return false;
  }

  /** No solid tiles on the straight line between two points. */
  lineClear(x0, y0, x1, y1) {
    const d = Math.hypot(x1 - x0, y1 - y0);
    const n = Math.ceil(d / 0.4);
    for (let i = 1; i < n; i++) {
      const k = i / n;
      if (this.map.solid(Math.floor(x0 + (x1 - x0) * k), Math.floor(y0 + (y1 - y0) * k))) return false;
    }
    return true;
  }

  // ---------- building ----------

  aimCell(e, inp) {
    const b = e.body;
    let ax = Math.abs(inp.x) > 0.35 ? Math.sign(inp.x) : 0;
    const ay = Math.abs(inp.y) > 0.35 ? Math.sign(inp.y) : 0;
    if (!ax && !ay) ax = e.facing;
    let c, r;
    // Ladder aimed straight up: grow the ladder you stand in (starting at your feet).
    if (PIECES[e.piece].tile === LADDER && ay > 0 && !ax) {
      c = Math.floor(b.x);
      r = Math.floor(b.y + 0.05);
      while (this.map.at(c, r) === LADDER && r < ROWS) r++;
      return { c, r: Math.min(r, Math.floor(b.y + b.h) + 1), grow: true };
    }
    if (ax) {
      c = Math.floor(b.x + ax * 0.9);
      r = Math.floor(b.y + 0.05) + ay;
      if (this.cellHitsBody(c, r, b) && this.map.at(c, r) === EMPTY) c += ax;
    } else {
      c = Math.floor(b.x);
      r = ay > 0 ? Math.floor(b.y + b.h + 0.05) : Math.floor(b.y - 0.05);
      if (this.cellHitsBody(c, r, b) && this.map.at(c, r) === EMPTY) r += ay;
    }
    return { c, r };
  }

  canPlace(e, c, r) {
    const m = this.map;
    if (c < 0 || c >= m.cols || r < 1 || r >= ROWS) return false;
    if (m.at(c, r) !== EMPTY) return false;
    // Ladders and bean doors can go right where beans stand (beans pass through them).
    const see = PIECES[e.piece].tile === WOOD || PIECES[e.piece].tile === PAD;
    if (see) {
      for (const o of this.heroes) if (o.state === 'play' && this.cellHitsBody(c, r, o.body)) return false;
      for (const tr of this.troopers.list) if (this.troopers.active(tr) && this.cellHitsBody(c, r, tr.body)) return false;
    }
    return [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dc, dr]) => m.at(c + dc, r + dr) !== EMPTY);
  }

  canDig(c, r) {
    const m = this.map;
    if (c < 0 || c >= m.cols || r < 1 || r >= ROWS) return false;
    return DIG_TIME[m.at(c, r)] !== undefined;
  }

  placePiece(e, c, r) {
    const pc = PIECES[e.piece];
    if (e.wood < pc.cost) {
      this.floater(t('castle.noWood'), new THREE.Vector3(e.body.x, e.body.y + 2, 0.5), e.css, 0.9);
      this.game.audio.play('bump');
      return false;
    }
    e.wood -= pc.cost;
    this.map.set(c, r, pc.tile, 0);
    e.built++;
    e.work = 0.2;
    this.puffs.burst(new THREE.Vector3(c + 0.5, r + 0.5, 0.8), 0xfff3dc, { count: 4, size: 0.25, life: 0.35 });
    this.game.audio.play('land');
    // A tutorial ghost is done once something is built in its cell.
    for (const h of this.hints) if (h.c === c && h.r === r) h.g.visible = false;
    return true;
  }

  breakTile(c, r, by = null) {
    const m = this.map;
    const ty = m.at(c, r);
    if (by && by.cls === 'builder' && REFUND[ty] && m.ownerAt(c, r) === 0) by.wood = Math.min(WOOD_MAX, by.wood + REFUND[ty]);
    const col = ty === WOOD || ty === DOOR || ty === LADDER ? 0xe2a96b : ty === PAD ? 0xff7eb6 : ty === CASTLE ? 0xc9c0dd : ty === STONE ? 0xaaa4c6 : 0xd99a62;
    this.puffs.burst(new THREE.Vector3(c + 0.5, r + 0.5, 0.8), col, { count: 8, size: 0.35, life: 0.5 });
    m.set(c, r, EMPTY, -1);
    this.game.audio.play('pop');
  }

  damageTile(c, r, amount, by) {
    const m = this.map;
    if (!m.inside(c, r)) return;
    const i = m.idx(c, r);
    m.dmg[i] += amount;
    m.dirty = true;
    if (m.dmg[i] >= 0.999) this.breakTile(c, r, by);
  }

  /** The hammer also bonks grumbles and hits cages, levers and catapults right in front. */
  hammerHit(e) {
    const b = e.body;
    const box = { x0: Math.min(b.x, b.x + e.facing * 1.5), x1: Math.max(b.x, b.x + e.facing * 1.5), y0: b.y - 0.2, y1: b.y + 1.7 };
    let any = this.siege.hitBox(box, e, 1);
    for (const g of this.grumbles.list) {
      if (g.state !== 'play') continue;
      const dx = (g.body.x - b.x) * e.facing;
      if (dx > -0.3 && dx < 1.4 && Math.abs(g.body.y - b.y) < 1.3) { this.grumbles.hit(g, e, { dir: e.facing, melee: true }); any = true; }
    }
    if (any) {
      e.work = 0.25;
      e.hammerCd = 0.35;
      this.game.audio.play('whoosh');
    }
    return any;
  }

  updateBuilder(e, inp, bHeld, bPress, dt) {
    if (inp.cPressed) {
      e.piece = (e.piece + 1) % PIECES.length;
      this.floater(t(`castle.piece.${PIECES[e.piece].key}`), new THREE.Vector3(e.body.x, e.body.y + 2.1, 0.5), e.css, 1);
      this.game.audio.play('select');
    }
    e.hammerCd -= dt;
    const { c, r, grow } = this.aimCell(e, inp);
    const ty = this.map.at(c, r);
    const mode = ty === EMPTY ? (this.canPlace(e, c, r) ? 'place' : 'bad') : this.canDig(c, r) && !grow ? 'dig' : 'bad';
    e.cursor = { c, r, mode };
    e.buildCd -= dt;
    if (bPress && e.hammerCd <= 0 && this.hammerHit(e)) { e.holdMode = 'hammer'; return; }
    if (bPress) { e.holdMode = mode === 'dig' ? 'dig' : 'place'; e.holdT = 0; }
    if (!bHeld) { e.holdMode = null; return; }
    e.holdT += dt;
    if (e.holdMode === 'place' && mode === 'place' && (bPress || (e.holdT > 0.3 && e.buildCd <= 0))) {
      if (this.placePiece(e, c, r)) e.buildCd = 0.2; else e.buildCd = 0.6;
    } else if (e.holdMode === 'dig' && mode === 'dig') {
      e.work = 0.15;
      if (Math.random() < dt * 8) this.puffs.burst(new THREE.Vector3(c + 0.5, r + 0.5, 0.85), 0xffffff, { count: 1, size: 0.2, life: 0.3 });
      this.damageTile(c, r, dt / DIG_TIME[ty], e);
    }
  }

  // ---------- knights ----------

  swing(e, big) {
    if (e.swingCd > 0) return;
    e.swingT = big ? 0.3 : 0.2;
    e.swingBig = big;
    e.swingCd = big ? 0.5 : 0.34;
    e.ch.squash(big ? 1.3 : 1.12);
    const b = e.body;
    if (big) { b.vx = e.facing * 13; this.game.audio.play('dash'); } else this.game.audio.play('whoosh');
    const reach = big ? 2.0 : 1.5;
    for (const g of this.grumbles.list) {
      if (g.state !== 'play') continue;
      const dx = (g.body.x - b.x) * e.facing, dy = g.body.y - b.y;
      if (dx > -0.3 && dx < reach && Math.abs(dy) < 1.3) this.grumbles.hit(g, e, { dir: e.facing, big, melee: true });
    }
    this.siege.hitBox({ x0: Math.min(b.x, b.x + e.facing * reach), x1: Math.max(b.x, b.x + e.facing * reach), y0: b.y - 0.3, y1: b.y + 1.8 }, e, big ? 2 : 1);
    // Swords knock grumble doors (and other enemy pieces) apart.
    const cols = big ? [Math.floor(b.x + e.facing * 0.9), Math.floor(b.x + e.facing * 1.9)] : [Math.floor(b.x + e.facing * 0.9)];
    const r0 = Math.floor(b.y + 0.1);
    for (const c of [...new Set(cols)]) {
      for (const r of [r0, r0 + 1]) {
        const ty = this.map.at(c, r);
        if (!KNIGHT_HP[ty] || !this.map.inside(c, r) || this.map.ownerAt(c, r) === 0) continue;
        this.damageTile(c, r, big ? 1 : 1 / KNIGHT_HP[ty] + 0.001, e);
        this.game.audio.play('bump');
      }
    }
    this.puffs.burst(new THREE.Vector3(b.x + e.facing, b.y + 0.8, 0.6), big ? COLORS.gold : 0xffffff, { count: big ? 10 : 4, size: big ? 0.4 : 0.25, life: 0.3, speed: 3 });
  }

  updateKnight(e, inp, bHeld, bPress, dt) {
    e.shield = !!inp.c && e.swingT <= 0;
    if (e.shield) { e.charging = false; e.charge = 0; return; }
    if (bPress) { e.charging = true; e.charge = 0; }
    if (e.charging && bHeld) {
      const was = e.charge;
      e.charge += dt;
      if (was < CHARGE_FULL && e.charge >= CHARGE_FULL) {
        this.game.audio.play('star');
        this.puffs.burst(new THREE.Vector3(e.body.x, e.body.y + 1.6, 0.6), COLORS.gold, { count: 6, size: 0.3, life: 0.4 });
      }
    }
    if (e.charging && !bHeld) {
      e.charging = false;
      this.swing(e, e.charge >= CHARGE_FULL);
      e.charge = 0;
    }
  }

  // ---------- archers ----------

  makeArrow(color, rope = false) {
    const g = new THREE.Group();
    const shaft = mesh(sharedGeo('kbShaft', () => new THREE.CylinderGeometry(0.035, 0.035, 0.85, 6)), toon(rope ? 0xf7e1a6 : COLORS.icing));
    shaft.rotation.z = Math.PI / 2;
    const cup = mesh(sharedGeo('kbCup', () => new THREE.SphereGeometry(0.12, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2)), toon(rope ? 0xff8c42 : color), 0.45, 0, 0);
    cup.rotation.z = -Math.PI / 2;
    const fl = mesh(sharedGeo('kbFletch', () => new THREE.ConeGeometry(0.12, 0.24, 3)), toon(color), -0.4, 0, 0);
    fl.rotation.z = Math.PI / 2;
    g.add(shaft, cup, fl);
    this.scene.add(g);
    return g;
  }

  aimOf(e, inp) {
    const m = Math.hypot(inp.x, inp.y);
    if (m < 0.3) return { x: e.facing, y: 0 };
    return { x: inp.x / m, y: inp.y / m };
  }

  shoot(e, power) {
    if (e.arrows <= 0) {
      this.floater(t('castle.noArrows'), new THREE.Vector3(e.body.x, e.body.y + 2, 0.5), e.css, 0.9);
      this.game.audio.play('bump');
      return;
    }
    e.arrows--;
    const speed = 13 + 13 * clamp(power / DRAW_FULL, 0, 1);
    const sx = e.body.x + e.aimX * 0.5, sy = e.body.y + 0.8 + e.aimY * 0.5;
    this.arrows.push({ owner: e, team: 0, mesh: this.makeArrow(e.p.color), state: 'fly', rope: false, t: 0, x: sx, y: sy, vx: e.aimX * speed, vy: e.aimY * speed + 1 });
    e.ch.squash(0.85);
    this.game.audio.play('dash');
  }

  shootRope(e) {
    e.ropeCd = 1.2;
    const sx = e.body.x + e.aimX * 0.5, sy = e.body.y + 0.8 + e.aimY * 0.5;
    let ax = e.aimX, ay = e.aimY;
    if (Math.abs(ay) < 0.3) { ax = e.facing * 0.5; ay = 0.87; }
    const a = { owner: e, team: 0, mesh: this.makeArrow(e.p.color, true), state: 'fly', rope: true, t: 0, x: sx, y: sy, vx: ax * 24, vy: ay * 24 };
    this.arrows.push(a);
    e.ropeArrow = a;
    this.game.audio.play('whoosh');
  }

  updateArcher(e, inp, bHeld, bPress, dt) {
    const aim = this.aimOf(e, inp);
    e.aimX = aim.x; e.aimY = aim.y;
    if (Math.abs(aim.x) > 0.2) e.facing = Math.sign(aim.x);
    if (inp.cPressed && e.ropeCd <= 0 && !e.zip) this.shootRope(e);
    if (bPress) { e.drawing = true; e.draw = 0; }
    if (e.drawing && bHeld) e.draw = Math.min(DRAW_FULL, e.draw + dt);
    if (e.drawing && !bHeld) {
      e.drawing = false;
      this.shoot(e, e.draw);
      e.draw = 0;
    }
  }

  updateArrows(dt) {
    const m = this.map;
    for (const a of this.arrows) {
      a.t += dt;
      if (a.state === 'fly' || a.state === 'drop') {
        const steps = 4, h = dt / steps;
        for (let i = 0; i < steps && (a.state === 'fly' || a.state === 'drop'); i++) {
          a.vy -= (a.state === 'drop' ? 30 : a.rope ? 9 : 8) * h;
          a.x += a.vx * h;
          a.y += a.vy * h;
          const ang = Math.atan2(a.vy, a.vx);
          const tx = a.x + Math.cos(ang) * 0.42, ty = a.y + Math.sin(ang) * 0.42;
          const c = Math.floor(tx), r = Math.floor(ty);
          if (c < 0 || c >= m.cols || ty < 0 || ty >= ROWS + 3) { a.state = 'gone'; break; }
          if (a.state === 'drop') {
            if (m.solid(Math.floor(a.x), Math.floor(a.y - 0.08))) { a.state = 'stuck'; a.stuckT = 0; a.mesh.rotation.z = a.vx >= 0 ? 0 : Math.PI; a.cell = m.idx(Math.floor(a.x), Math.floor(a.y - 0.08)); }
            continue;
          }
          if (r < ROWS && m.solidFor(c, r, a.team)) {
            const ty2 = m.at(c, r);
            if (a.rope ? ty2 !== BEDROCK && ty2 !== GATE : STICKY.has(ty2)) {
              a.state = 'stuck';
              a.stuckT = 0;
              a.cell = m.idx(c, r);
              this.puffs.burst(new THREE.Vector3(tx, ty, 0.4), 0xffffff, { count: 3, size: 0.15, life: 0.3 });
              this.game.audio.play('bump');
              if (a.rope && a.owner.ropeArrow === a && a.owner.state === 'play') this.startZip(a.owner, a);
            } else {
              a.state = 'drop';
              a.vx *= -0.25;
              a.vy = 2;
            }
            break;
          }
          if (!a.rope) this.arrowHits(a, tx, ty);
        }
        if (a.state === 'fly' || a.state === 'drop') a.mesh.rotation.z = Math.atan2(a.vy, a.vx);
        if (a.rope && a.state === 'fly' && a.t > 0.7) a.state = 'gone';
      } else if (a.state === 'stuck') {
        a.stuckT += dt;
        if (m.tile[a.cell] === EMPTY || m.tile[a.cell] === LADDER) { a.state = 'drop'; a.vx = 0; a.vy = 0; }
        if (a.rope) { if (!a.owner.zip || a.owner.zip.arrow !== a) a.state = 'gone'; } else {
          if (a.stuckT > 9) a.mesh.scale.setScalar(Math.max(0.01, 1 - (a.stuckT - 9)));
          if (a.stuckT > 10) a.state = 'gone';
          for (const e of this.heroes) {
            if (e.state !== 'play' || e.cls !== 'archer' || e.arrows >= ARROWS_MAX) continue;
            if (Math.abs(e.body.x - a.x) < 0.8 && a.y > e.body.y - 0.6 && a.y < e.body.y + BH + 0.3) {
              e.arrows++;
              a.state = 'gone';
              this.game.audio.play('coin');
              break;
            }
          }
        }
      }
      a.mesh.position.set(a.x, a.y, 0.3);
      if (a.state === 'gone') this.scene.remove(a.mesh);
    }
    this.arrows = this.arrows.filter((a) => a.state !== 'gone');
  }

  arrowHits(a, tx, ty) {
    if (a.state !== 'fly') return;
    const bounce = () => { a.state = 'drop'; a.vx *= -0.2; a.vy = 4; };
    if (a.team === 0) {
      if (this.siege.hitPoint(tx, ty, a.owner)) { bounce(); return; }
      for (const g of this.grumbles.list) {
        if (g.state !== 'play') continue;
        const b = g.body;
        if (Math.abs(tx - b.x) < b.w / 2 + 0.12 && ty > b.y - 0.05 && ty < b.y + b.h + 0.1) {
          if (this.grumbles.hit(g, a.owner, { dir: Math.sign(a.vx) || 1, arrowVx: a.vx })) { bounce(); return; }
        }
      }
    } else {
      for (const e of this.heroes) {
        if (e.state !== 'play') continue;
        const b = e.body;
        if (Math.abs(tx - b.x) < BW / 2 + 0.12 && ty > b.y - 0.05 && ty < b.y + BH + 0.1) {
          if (this.hitHero(e, a.owner, { dir: Math.sign(a.vx) || 1, arrowVx: a.vx })) { bounce(); return; }
        }
      }
      for (const tr of this.troopers.list) {
        if (!this.troopers.active(tr)) continue;
        const b = tr.body;
        if (Math.abs(tx - b.x) < b.w / 2 + 0.1 && ty > b.y && ty < b.y + b.h + 0.1) {
          if (this.troopers.knock(tr, Math.sign(a.vx) || 1, 5, this.diff.dizzy)) { bounce(); return; }
        }
      }
    }
  }

  startZip(e, a) {
    e.zip = { arrow: a, x: a.x, y: a.y, t: 0 };
    e.climbing = false;
  }

  updateZip(e, inp, dt) {
    const z = e.zip, b = e.body;
    z.t += dt;
    const dx = z.x - b.x, dy = z.y - (b.y + 0.9);
    const d = Math.hypot(dx, dy);
    if (d < 0.9 || z.t > 1.6 || z.arrow.state !== 'stuck' || inp.aPressed) {
      b.vy = inp.aPressed ? PHYS.jump : Math.max(b.vy, dy > -0.5 ? 9 : 2);
      b.vx *= 0.5;
      e.zip = null;
      z.arrow.state = 'gone';
      return;
    }
    b.vx = (dx / d) * 15;
    b.vy = (dy / d) * 15;
  }

  // ---------- hits and bubbles ----------

  /** A foam hit on a bean: push and wobble; three (or a pillow plus two) and you float to the tent. */
  hitHero(v, by, { dir, big = false, melee = false, arrowVx = 0 }) {
    if (v.state !== 'play' || v.invuln > 0) return false;
    if (v.cls === 'knight' && v.shield) {
      const fromFront = melee && by ? Math.sign(by.body.x - v.body.x) === v.facing : arrowVx ? Math.sign(-arrowVx) === v.facing : Math.sign(-dir) === v.facing;
      if (fromFront) {
        v.body.vx += dir * (big ? 10 : 4);
        if (melee && by) by.body.vx -= dir * 5;
        v.invuln = 0.2;
        this.floater(t('castle.blocked'), new THREE.Vector3(v.body.x, v.body.y + 1.9, 0.5), '#ffffff', 0.7);
        this.game.audio.play('bump');
        return true;
      }
    }
    v.hits++;
    v.hitT = 0;
    v.invuln = 0.4;
    if (big || v.hits >= MAX_HITS) {
      this.floater(t('castle.bonk'), new THREE.Vector3(v.body.x, v.body.y + 2, 0.5), '#ffffff', 1.1);
      this.confetti.burst(new THREE.Vector3(v.body.x, v.body.y + 1, 0.5), 0, { count: 18, speed: 6, colors: [v.p.color, COLORS.white, COLORS.gold], life: 1 });
      this.game.audio.play('pop');
      this.game.audio.play('dizzy');
      this.shake = 0.2;
      this.toBubble(v, this.spawnPoint(v));
    } else {
      v.body.vx = dir * 10;
      v.body.vy = 7;
      v.wobble = 0.9;
      v.zip = null;
      v.ch.squash(0.7);
      this.puffs.burst(new THREE.Vector3(v.body.x, v.body.y + 0.8, 0.6), 0xffffff, { count: 6, size: 0.3, life: 0.35 });
      this.game.audio.play('boing');
    }
    return true;
  }

  /** Float to `dest` in a bubble (after a bonk, a splash, or straying too far from the group). */
  toBubble(v, dest, time = BUBBLE_TIME) {
    v.state = 'bubble';
    v.zip = null;
    v.charging = v.drawing = v.shield = v.climbing = false;
    v.wobble = 0;
    v.hits = 0;
    v.strayT = 0;
    v.bub = { x0: v.body.x, y0: v.body.y, x1: dest.x, y1: dest.y, t: 0, time };
    v.bubble.visible = true;
  }

  updateBubble(e, dt) {
    const B = e.bub, b = e.body;
    B.t += dt / B.time;
    const k = Math.min(1, B.t), s = k * k * (3 - 2 * k);
    b.x = B.x0 + (B.x1 - B.x0) * s;
    b.y = B.y0 + (B.y1 - B.y0) * s + Math.sin(k * Math.PI) * 3;
    b.vx = b.vy = 0;
    e.bubble.position.set(b.x, b.y + 0.7, 0.2);
    if (B.t >= 1) {
      // Make sure the landing spot is free; otherwise use the tent.
      const c = Math.floor(b.x), r = Math.floor(b.y + 0.05);
      if (this.map.solidFor(c, r, 0) || this.map.solidFor(c, r + 1, 0) || this.map.at(c, r) === WATER) {
        const sp = this.spawnPoint(e);
        b.x = sp.x; b.y = sp.y;
      }
      e.state = 'play';
      e.bubble.visible = false;
      e.invuln = 1.5;
      this.puffs.burst(new THREE.Vector3(b.x, b.y + 0.7, 0.5), e.p.color, { count: 12, size: 0.4 });
      this.game.audio.play('pop');
    }
  }

  // ---------- tents and checkpoints ----------

  updateTents(dt) {
    for (const e of this.heroes) {
      if (e.state !== 'play') continue;
      // Reaching a tent makes it the respawn point.
      for (let i = this.checkpoint + 1; i < this.tents.length; i++) {
        const tn = this.tents[i];
        if (e.body.x > tn.x - 0.8) {
          this.checkpoint = i;
          tn.reached = true;
          this.game.ui.toast(t('kc.checkpoint'), 1600);
          this.game.audio.play('coin');
          this.confetti.burst(new THREE.Vector3(tn.x, tn.y + 2.5, 0), 0, { count: 24, speed: 5, colors: [0x4cc9f0, COLORS.white, COLORS.gold], life: 1 });
        }
      }
    }
    for (const tn of this.tents) {
      const near = this.state === 'play' && this.heroes.some((e) => e.state === 'play' && Math.abs(e.body.x - tn.x) < 1.3 && Math.abs(e.body.y - tn.y) < 1.2);
      tn.near = near;
      if (!near) { tn.label.style.display = 'none'; continue; }
      const txt = t('kc.tent');
      if (tn.label.textContent !== txt) tn.label.textContent = txt;
      this.game.ui.place(tn.label, new THREE.Vector3(tn.x, tn.y + 3.4, 0), this.camera);
    }
  }

  /** Inside a tent, tap down to change class. */
  tentSwap(e, inp) {
    if (inp.stepY !== -1 || !e.body.grounded) return;
    const tn = this.tents.find((x) => Math.abs(e.body.x - x.x) < 1.3 && Math.abs(e.body.y - x.y) < 1.2);
    if (!tn) return;
    const next = CLASSES[(CLASSES.indexOf(e.cls) + 1) % 3];
    this.setClass(e, next);
    this.floater(`${GLYPH[next]} ${t(`castle.cls.${next}`)}`, new THREE.Vector3(e.body.x, e.body.y + 2.2, 0.5), e.css, 1.2);
    this.puffs.burst(new THREE.Vector3(e.body.x, e.body.y + 0.8, 0.5), e.p.color, { count: 10, size: 0.35 });
    this.game.audio.play('select');
  }

  // ---------- the hero update ----------

  updateHero(e, dt, playing) {
    const b = e.body;
    e.invuln = Math.max(0, e.invuln - dt);
    e.wobble = Math.max(0, e.wobble - dt);
    e.hitT += dt;
    if (e.hitT > HIT_RESET) e.hits = 0;
    e.swingT = Math.max(0, e.swingT - dt);
    e.swingCd -= dt;
    e.ropeCd -= dt;
    e.work = Math.max(0, e.work - dt);
    e.cursor = null;
    if (e.state === 'bubble') { this.updateBubble(e, dt); return; }

    const act = e.cls;
    let inp = !playing ? NO_INPUT : (this.input(e.p) || NO_INPUT);
    const bHeld = !!inp.b, bPress = !!inp.bPressed; // A, B and C are separate buttons
    if (playing) this.tentSwap(e, inp);

    e.refill += dt;
    if (act === 'builder' && e.refill > 1) { e.refill = 0; if (e.wood < WOOD_MAX) e.wood++; }
    if (act === 'archer' && e.refill > 2) { e.refill = 0; if (e.arrows < ARROWS_START) e.arrows++; }

    if (e.wobble > 0) inp = { ...inp, x: inp.x * 0.3 };
    const slow = (act === 'knight' && (e.shield || e.charging)) || (act === 'archer' && e.drawing);
    const P = slow ? PHYS_SLOW : PHYS;

    if (e.zip) {
      this.updateZip(e, inp, dt);
    } else {
      const lad = this.onLadder(b);
      if (lad && (inp.y > 0.4 || inp.a || (inp.y < -0.4 && !b.grounded))) e.climbing = true;
      if (!lad || (b.grounded && inp.y <= 0.4 && !inp.a)) e.climbing = false;
      if (b.grounded && b.ground?.ladderTop && inp.y < -0.5) { b.dropTimer = 0.25; e.climbing = true; }
      if (e.climbing) {
        b.vy = inp.y > 0.4 || inp.a ? 5.5 : inp.y < -0.4 ? -5.5 : 0;
        // Without a sideways push, slide to the middle of the ladder so heads don't catch on ledges.
        const center = Math.abs(inp.x) < 0.3 ? (Math.floor(b.x) + 0.5 - b.x) * 6 : 0;
        b.vx = approach(b.vx, inp.x * 3.5 + center, 40 * dt);
        b.grounded = false;
      } else {
        const ctrl = e.bounced && b.vy > 0 ? { ...inp, a: true } : inp;
        if (e.bounced && b.vy <= 0) e.bounced = false;
        const j = platformerControl(b, ctrl, dt, P);
        if (j) { e.ch.squash(1.3); this.game.audio.play('jump'); }
        if (act === 'knight' && e.shield && b.vy < -3.5) b.vy = -3.5;
        if (e.slide > 0) { e.slide -= dt; b.vx = approach(b.vx, 0, 6 * dt); }
      }
    }
    if (Math.abs(inp.x) > 0.2 && act !== 'archer' && !e.charging) e.facing = Math.sign(inp.x);

    const wasAir = !b.grounded;
    const vyBefore = b.vy;
    moveBody(b, dt, this.solidsAround(b, 0));
    if (b.grounded && b.ground?.pad) {
      b.vy = 21;
      b.grounded = false;
      e.bounced = true;
      e.climbing = false;
      e.ch.squash(1.4);
      this.game.audio.play('boing');
    } else if (b.justLanded && wasAir) {
      e.ch.squash(0.75);
      if (act === 'knight' && e.shield && Math.abs(b.vx) > 2) { e.slide = 0.5; b.vx = Math.sign(b.vx) * Math.max(Math.abs(b.vx), 8); }
      if (vyBefore < -12) this.game.audio.play('land');
    }
    // Teammates can bounce off a knight's raised shield.
    if (act === 'knight' && e.shield && inp.y > 0.4) {
      for (const o of this.heroes) {
        if (o === e || o.state !== 'play' || o.body.vy >= 0) continue;
        if (Math.abs(o.body.x - b.x) < 0.7 && o.body.y > b.y + 1.0 && o.body.y < b.y + 1.9) {
          o.body.vy = 18;
          o.bounced = true;
          this.game.audio.play('boing');
        }
      }
    }
    // Splash: float back to the last dry spot.
    if (this.inWater(b)) {
      this.puffs.burst(new THREE.Vector3(b.x, b.y + 0.5, 0.5), 0x8fd8ff, { count: 12, size: 0.4 });
      this.game.audio.play('splat');
      this.toBubble(e, e.lastSafe, 1.5);
      return;
    }
    if (b.grounded && b.ground && !b.ground.pad && this.map.solid(Math.floor(b.x), Math.floor(b.y - 0.5))) e.lastSafe = { x: Math.floor(b.x) + 0.5, y: b.y };

    if (playing) {
      if (act === 'builder') this.updateBuilder(e, inp, bHeld, bPress, dt);
      else if (act === 'knight') this.updateKnight(e, inp, bHeld, bPress, dt);
      else if (act === 'archer') this.updateArcher(e, inp, bHeld, bPress, dt);
    } else {
      e.charging = e.drawing = e.shield = false;
    }
  }

  poseHero(e, dt) {
    const b = e.body;
    const G2 = e.gear;
    const inBubble = e.state === 'bubble';
    e.ch.group.position.set(b.x, b.y, 0);
    e.ch.faceSide(e.facing);
    e.ch.spin = inBubble ? e.ch.spin + dt * 3 : 0;
    e.ch.update(dt, { moving: Math.min(1, Math.abs(b.vx) / PHYS.speed), grounded: b.grounded || inBubble || e.climbing, vy: b.vy });
    e.ch.pivot.rotation.z = Math.sin(this.time * 18) * e.wobble * 0.5;
    e.ch.group.visible = e.invuln <= 0.4 || Math.floor(this.time * 14) % 2 === 0 || e.hits > 0;
    G2.g.visible = !inBubble;
    G2.g.position.set(b.x, b.y, 0.5);
    G2.g.scale.set(e.facing * BEAN_SCALE, BEAN_SCALE, BEAN_SCALE);
    let ang = -0.45;
    if (e.swingT > 0) {
      const dur = e.swingBig ? 0.3 : 0.2;
      const k = 1 - e.swingT / dur;
      ang = 1.4 - k * (e.swingBig ? 3.8 : 3.2);
    } else if (e.charging) {
      const full = e.charge >= CHARGE_FULL;
      ang = 0.7 + Math.min(1, e.charge / CHARGE_FULL) * 0.6 + (full ? Math.sin(this.time * 40) * 0.05 : 0);
    }
    G2.sword.rotation.z = ang;
    G2.blade.material = e.charging && e.charge >= CHARGE_FULL ? toon(COLORS.white, { emissive: 0x665500 }) : toon(0xffe47a);
    if (e.shield) { G2.shield.position.set(0.5, 0.72, 0.12); G2.shield.rotation.y = 1.0; G2.shield.scale.setScalar(1.15); }
    else { G2.shield.position.set(-0.3, 0.55, -0.1); G2.shield.rotation.y = 0.3; G2.shield.scale.setScalar(0.85); }
    G2.hammer.rotation.z = e.work > 0 ? -0.6 + Math.sin(this.time * 30) * 0.8 : -0.3;
    G2.bow.rotation.z = Math.atan2(e.aimY, Math.abs(e.aimX) < 0.01 ? 0.01 : e.aimX * e.facing);
    G2.nock.visible = e.drawing;
    G2.nock.position.x = -Math.min(1, e.draw / DRAW_FULL) * 0.35;
    const ra = e.zip ? e.zip.arrow : e.ropeArrow && e.ropeArrow.state === 'fly' ? e.ropeArrow : null;
    if (ra && !inBubble) {
      const hx = b.x, hy = b.y + 0.8;
      const dx = ra.x - hx, dy = ra.y - hy, len = Math.hypot(dx, dy);
      G2.rope.visible = true;
      G2.rope.position.set(hx + dx / 2, hy + dy / 2, 0.3);
      G2.rope.scale.set(1, len, 1);
      G2.rope.rotation.z = Math.atan2(dy, dx) - Math.PI / 2;
    } else G2.rope.visible = false;
    if (!e.stars) {
      e.stars = new THREE.Group();
      for (let i = 0; i < MAX_HITS - 1; i++) {
        const s = makeStar(COLORS.gold);
        s.scale.setScalar(0.3);
        e.stars.add(s);
      }
      this.scene.add(e.stars);
    }
    e.stars.visible = !inBubble && e.hits > 0;
    e.stars.position.set(b.x, b.y + 1.75, 0.2);
    e.stars.children.forEach((s, i) => {
      const a = this.time * 5 + (i * Math.PI * 2) / (MAX_HITS - 1);
      s.visible = i < e.hits;
      s.position.set(Math.cos(a) * 0.45, Math.sin(a * 2) * 0.05, Math.sin(a) * 0.45);
    });
    const cur = e.cursor;
    const show = !!cur && this.state === 'play';
    e.cursorMesh.visible = show;
    e.ghosts.forEach((g, i) => { g.visible = show && cur.mode === 'place' && i === e.piece; });
    if (show) {
      const x = cur.c + 0.5, y = cur.r + 0.5;
      e.cursorMesh.position.set(x, y, 0.85);
      const pulse = cur.mode === 'dig' ? 1 + Math.sin(this.time * 20) * 0.04 : 1;
      e.cursorMesh.scale.setScalar(cur.mode === 'bad' ? 0.8 : pulse);
      for (const m of e.cursorMesh.userData.bars) m.material = cur.mode === 'bad' ? basic(0x9a94b2) : cur.mode === 'dig' ? basic(COLORS.white) : basic(e.p.color);
      e.ghosts[e.piece].position.set(x, y, 0);
    }
  }

  // ---------- camera ----------

  /** Follow the biggest group of beans that fits on screen; beans left far behind float to the group. */
  updateCamera(dt) {
    const live = this.heroes.filter((e) => e.state === 'play');
    if (live.length && this.state !== 'classes') {
      const xs = live.map((e) => e.body.x).sort((a, b) => a - b);
      const span = this.halfW * 2 - 6;
      // Ties go to the beans closest to the troopers (the ones that need help).
      const focus = this.troopFocus();
      let best = [0, 0], bestScore = -1e9;
      for (let i = 0; i < xs.length; i++) {
        let j = i;
        while (j + 1 < xs.length && xs[j + 1] - xs[i] <= span) j++;
        const mid = (xs[i] + xs[j]) / 2;
        const score = (j - i + 1) * 1000 - Math.max(0, Math.abs(mid - focus) - span / 2);
        if (score > bestScore) { bestScore = score; best = [i, j]; }
      }
      const target = (xs[best[0]] + xs[best[1]]) / 2 + 2;
      this.camX += (target - this.camX) * Math.min(1, dt * 2.5);
    }
    this.placeCamera();
    if (this.shake > 0) {
      this.shake -= dt;
      this.camera.position.x += (Math.random() - 0.5) * this.shake;
      this.camera.position.y += (Math.random() - 0.5) * this.shake;
    }
    // Strays: off screen for a while -> bubble over to the nearest bean on screen.
    if (this.state !== 'play') return;
    const lo = this.camX - this.halfW + 0.3, hi = this.camX + this.halfW - 0.3;
    for (const e of live) {
      const out = e.body.x < lo || e.body.x > hi;
      e.strayT = out ? e.strayT + dt : 0;
      if (e.strayT > STRAY_TIME) {
        const mates = live.filter((o) => o !== e && o.body.x >= lo && o.body.x <= hi);
        const to = mates.sort((a, b) => Math.abs(a.body.x - e.body.x) - Math.abs(b.body.x - e.body.x))[0];
        this.toBubble(e, to ? { x: to.body.x, y: to.body.y } : this.spawnPoint(e), 2);
      }
    }
  }

  /** Where the troopers need the most attention: the first waiting one, or the middle of the march. */
  troopFocus() {
    let front = null, sum = 0, n = 0;
    for (const tr of this.troopers.list) {
      if (!this.troopers.active(tr)) continue;
      sum += tr.body.x; n++;
      if (tr.state === 'wait' && tr.why !== 'friend' && (!front || tr.body.x < front.body.x)) front = tr;
    }
    return front ? front.body.x : n ? sum / n : this.camX;
  }

  // ---------- goals ----------

  goals() {
    const out = [];
    const S = this.siege;
    for (const key of this.level.goals) {
      if (key === 'home') {
        const total = troopersNeeded(this.level, this.levelIndex, Math.max(1, this.players.length)).total;
        out.push({ key, done: this.homeCount >= this.need, text: t('kc.goal.home', { n: this.need, total }), pill: `${this.homeCount}/${this.need}` });
      } else if (key === 'cages') {
        out.push({ key, done: S.cagesOpen >= S.cages.length, text: t('kc.goal.cages', { n: S.cages.length }), pill: `${S.cagesOpen}/${S.cages.length}` });
      } else if (key === 'gate') {
        out.push({ key, done: S.gates.length > 0 && S.gates.every((g) => g.open), text: t('kc.goal.gate'), pill: '' });
      } else if (key === 'catapults') {
        out.push({ key, done: S.catapultsDown >= S.catapults.length, text: t('kc.goal.catapults', { n: S.catapults.length }), pill: `${S.catapultsDown}/${S.catapults.length}` });
      } else if (key === 'princess') {
        out.push({ key, done: !!S.princess?.free, text: t('kc.goal.princess'), pill: '' });
      }
    }
    return out;
  }

  onTrooperHome(tr) {
    this.homeCount++;
    this.floater('+1', new THREE.Vector3(tr.body.x, tr.body.y + 2, 0.5), '#ffc93c', 1);
    this.game.audio.play('coin');
    this.puffs.burst(new THREE.Vector3(tr.body.x, tr.body.y + 1, 0.5), GOLD, { count: 8, size: 0.3 });
  }

  onPrincessHome() {
    this.confetti.burst(new THREE.Vector3(this.flagPos.x, this.flagPos.y + 3, 0.5), 0, { count: 80, speed: 9, up: 5, colors: [GOLD, COLORS.white, 0xff7eb6], life: 2 });
  }

  allHome() {
    return this.troopers.toSpawn === 0 && this.troopers.list.every((tr) => tr.state === 'home');
  }

  checkGoals(dt) {
    const done = this.goals().every((g) => g.done);
    if (done && this.goalTime === null) {
      this.goalTime = this.time - this.playStart;
      this.bonusT = BONUS_TIME;
      for (const e of this.heroes) e.holdMode = null;
      if (!this.allHome()) this.game.ui.toast(t('kc.goalDone'), 2600);
      this.game.audio.play('fanfare');
      this.confetti.burst(new THREE.Vector3(this.flagPos.x, this.flagPos.y + 3, 0.5), 0, { count: 60, speed: 9, up: 5, colors: [GOLD, COLORS.white], life: 1.6 });
    }
    if (this.goalTime !== null) {
      this.bonusT -= dt;
      if (this.allHome() || this.bonusT <= 0) this.end(true);
    }
  }

  // ---------- HUD ----------

  floater(text, pos, css, life) {
    const el = this.game.ui.label('label player-tag');
    el.textContent = text;
    el.style.color = css;
    this.floaters.push({ el, pos, life, max: life });
  }

  updateFloaters(dt) {
    for (const f of this.floaters) {
      f.life -= dt;
      f.pos.y += dt * 1.2;
      this.game.ui.place(f.el, f.pos, this.camera);
      f.el.style.opacity = String(clamp((f.life / f.max) * 2, 0, 1));
      if (f.life <= 0) f.el.remove();
    }
    this.floaters = this.floaters.filter((f) => f.life > 0);
  }

  countText(e) {
    if (e.cls === 'builder') return `${GLYPH.builder} ${e.wood}`;
    if (e.cls === 'archer') return `${GLYPH.archer} ${e.arrows}`;
    return GLYPH.knight;
  }

  updateLabels() {
    const show = this.state === 'play';
    for (const e of this.heroes) {
      const html = show && e.state === 'play' ? `<span style="color:${e.css}">${this.countText(e)}</span>` : '';
      if (html !== e.labelHtml) { e.label.innerHTML = html; e.labelHtml = html; }
      if (html) this.game.ui.place(e.label, new THREE.Vector3(e.body.x, e.body.y + 2.05, 0.3), this.camera);
      else e.label.style.display = 'none';
    }
  }

  chip(e) {
    let txt = esc(t(`castle.cls.${e.cls}`));
    if (e.cls === 'builder') txt += ` · ${esc(t('castle.wood', { n: e.wood }))}`;
    else if (e.cls === 'archer') txt += ` · ${esc(t('castle.arrows', { n: e.arrows }))}`;
    return `${GLYPH[e.cls]} ${txt}`;
  }

  /** A strip map of the level: troopers, beans, cages and the flag. */
  miniMap() {
    const W = this.cols;
    const pct = (x) => (clamp(x / W, 0, 1) * 100).toFixed(1);
    let dots = '';
    const vx0 = this.camX - this.halfW, vx1 = this.camX + this.halfW;
    dots += `<i class="kc-view" style="left:${pct(vx0)}%;width:${(((vx1 - vx0) / W) * 100).toFixed(1)}%"></i>`;
    for (const cg of this.siege.cages) if (!cg.broken) dots += `<i class="kc-cage" style="left:${pct(cg.c + 1)}%"></i>`;
    for (const g of this.siege.gates) if (!g.open) dots += `<i class="kc-gate" style="left:${pct(g.c + 0.5)}%"></i>`;
    if (this.siege.princess && !this.siege.princess.broken) dots += `<i class="kc-cage gold" style="left:${pct(this.siege.princess.c + 1)}%"></i>`;
    dots += `<i class="kc-flag" style="left:${pct(this.flagPos.x)}%"></i>`;
    for (const tr of this.troopers.list) if (this.troopers.active(tr)) dots += `<i class="kc-tr ${tr.state === 'wait' ? 'wait' : ''}" style="left:${pct(Math.round(tr.body.x))}%"></i>`;
    for (const e of this.heroes) dots += `<i class="kc-hero" style="left:${pct(Math.round(e.body.x))}%;background:${e.css}"></i>`;
    return `<div class="kc-mini">${dots}</div>`;
  }

  updateHud() {
    if (this.state === 'classes' || this.state === 'intro') { this.game.ui.setTop(''); return; }
    const goals = this.goals().map((g) => `<div class="pill ${g.done ? 'kc-done' : ''}">${g.done ? '✓ ' : ''}${esc(t(`kc.pill.${g.key}`))}${g.pill ? ` <b>${g.pill}</b>` : ''}</div>`).join('');
    const timer = this.goalTime !== null
      ? `<div class="pill kc-bonus">${esc(t('kc.bonus'))} <b>${clock(this.bonusT)}</b></div>`
      : `<div class="pill ${this.timeLeft < 60 ? 'kc-hurry' : ''}"><b>${clock(this.timeLeft)}</b></div>`;
    this.game.ui.setTop(`<div class="kc-hud"><div class="kc-row"><div class="pill hud-title">${esc(t(`kc.level.${this.level.id}`))}</div>${goals}${timer}</div>${this.miniMap()}</div>`);
    this.game.ui.bar(this.players, (p) => {
      const e = this.heroes.find((x) => x.p === p);
      return e ? this.chip(e) : '';
    });
  }

  // ---------- the end ----------

  end(won) {
    if (this.state === 'results') return;
    for (const e of this.heroes) {
      e.label.style.display = 'none';
      e.cursorMesh.visible = false;
      e.ghosts.forEach((g) => { g.visible = false; });
    }
    for (const tn of this.tents) tn.label.style.display = 'none';
    this.troopers.hideLabels();
    const total = this.troopers.total;
    const home = this.homeCount;
    const all = this.allHome();
    const fast = this.goalTime !== null && this.goalTime <= this.level.par;
    const stars = won ? 1 + (all ? 1 : 0) + (fast ? 1 : 0) : 0;
    this.result = { level: this.levelIndex, won, stars, home, total, all, fast, time: this.goalTime ?? this.time - this.playStart };
    // Save right away (before the results screen), so quitting from the pause menu keeps it.
    const P = this.prog;
    P.stars[this.levelIndex] = Math.max(P.stars[this.levelIndex] || 0, stars);
    if (won) P.won[this.levelIndex] = true;
    saveProgress(this.game, P);
    if (won) {
      for (const g of this.grumbles.list) this.grumbles.befriend(g, true);
      this.later(0.5, () => this.confetti.burst(new THREE.Vector3(this.flagPos.x, this.flagPos.y + 4, 0.5), 0, { count: 90, speed: 10, up: 5, colors: [GOLD, COLORS.white, 0xff7eb6, 0x4cc9f0], life: 2 }));
    }
    this.confettiOrigin = new THREE.Vector3(this.camX, 14, 0);
    const lines = [t('kc.res.home', { n: home, total })];
    if (won) lines.push(t('kc.res.time', { t: clock(this.result.time), par: clock(this.level.par) }));
    const ranked = [...this.heroes].sort((a, b) => (b.freed + b.bonks + b.built / 10) - (a.freed + a.bonks + a.built / 10));
    this.finish({
      title: won ? (this.level.finale ? t('kc.res.finale') : t('kc.res.win')) : t('kc.res.lose'),
      subtitle: lines.join(' · '),
      rows: ranked.map((e) => ({
        css: e.css, name: e.name,
        value: `${GLYPH[e.cls]} ${t(`castle.cls.${e.cls}`)}`,
        detail: `${e.bonks === 1 ? t('castle.bonk1') : t('castle.bonks', { n: e.bonks })} · ${t('castle.built', { n: e.built })}${e.freed ? ` · ${t('kc.res.freed', { n: e.freed })}` : ''}`,
        crown: won,
      })),
      stars,
      action: t('kc.res.hint'),
    });
    // Star tally on the results panel.
    const footer = this.game.ui.center.querySelector('.results .results-footer');
    footer?.insertAdjacentHTML('beforebegin', `<div class="kc-stars">${[0, 1, 2].map((i) => `<span class="${i < stars ? 'on' : ''}" style="animation-delay:${0.4 + i * 0.25}s">★</span>`).join('')}</div>
      <div class="kc-tiers"><span class="${won ? 'on' : ''}">★ ${esc(t('kc.tier.goal'))}</span><span class="${all ? 'on' : ''}">★ ${esc(t('kc.tier.all'))}</span><span class="${fast ? 'on' : ''}">★ ${esc(t('kc.tier.fast', { t: clock(this.level.par) }))}</span></div>`);
  }

  /** Results: [A] back to the campaign map, [B] try the level again. */
  updateResults(dt) {
    if (this.state !== 'results') return false;
    this.resultsDelay -= dt;
    if (this.resultsDelay > 0 || this.leaving) return true;
    for (const p of this.players) {
      const d = this.input(p);
      if (!d) continue;
      if (d.aPressed) { this.leaving = true; this.backToMap(this.result); break; }
      if (d.bPressed) {
        this.leaving = true;
        const opts = this.retryOptions();
        const game = this.game;
        game.transition(() => new CastleCampaignScene(game, opts));
        break;
      }
    }
    return true;
  }

  // ---------- frame ----------

  idle(dt) {
    if (this.mode === 'map') this.mapView.idle(dt);
  }

  update(dt) {
    if (this.mode === 'map') { this.mapView.update(dt); return; }
    for (const cl of this.clouds) { cl.position.x += dt * 0.6; if (cl.position.x > this.cols + 25) cl.position.x = -25; }
    for (const h of this.hints) if (h.g.visible) { h.g.visible = this.map.at(h.c, h.r) === EMPTY; h.g.scale.setScalar(0.9 + Math.sin(this.time * 4) * 0.08); }
    this.flag.userData.cloth.rotation.y = Math.sin(this.time * 2.5) * 0.3;

    if (this.state === 'classes') this.picker?.update(dt);
    const playing = this.state === 'play';
    for (const e of this.heroes) this.updateHero(e, dt, playing);
    this.troopers.update(dt, playing);
    this.grumbles.update(dt, playing);
    this.siege.update(dt, playing);
    this.updateArrows(dt);
    const doorUsers = [...this.heroes.filter((e) => e.state === 'play'), ...this.troopers.activeList];
    this.map.updateDoors([...doorUsers, ...this.grumbles.list.filter((g) => g.state === 'play')]);
    if (this.map.dirty) this.map.rebuild();
    for (const e of this.heroes) this.poseHero(e, dt);
    this.troopers.pose(dt);
    this.grumbles.pose(dt);
    this.updateTents(dt);
    this.updateFloaters(dt);
    this.updateLabels();
    this.updateCamera(dt);

    if (this.updateResults(dt)) return;
    if (playing) {
      this.timeLeft -= dt;
      this.checkGoals(dt);
      if (this.state === 'play' && this.timeLeft <= 0 && this.goalTime === null) { this.timeLeft = 0; this.end(false); return; }
    }
    if (this.state !== 'results') this.updateHud();
  }

  dispose() {
    this.mapView?.dispose();
    super.dispose();
  }
}

/**
 * Optional entry for main.js: GAMES.castle can point at this so retry from the pause menu reaches the
 * campaign (opts.mode === 'campaign') or Versus. `new CastleEntryScene(game, opts)` returns the scene.
 */
export function castleEntry(VersusScene) {
  return function CastleEntryScene(game, opts = {}) {
    return opts.mode === 'campaign' ? new CastleCampaignScene(game, opts) : new VersusScene(game, opts);
  };
}

function injectStyle() {
  if (typeof document === 'undefined' || document.getElementById('kc-style')) return;
  const el = document.createElement('style');
  el.id = 'kc-style';
  el.textContent = `
.kc-hud { display: flex; flex-direction: column; align-items: center; gap: 6px; width: min(1100px, 96vw); margin: 0 auto; }
.kc-row { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; }
.kc-done { background: #d9ffe8 !important; color: #2a8a52; }
.kc-bonus { background: #fff1b8 !important; }
.kc-hurry { color: #e63950; animation: kc-pulse 0.8s ease-in-out infinite; }
@keyframes kc-pulse { 50% { transform: scale(1.08); } }
.kc-mini { position: relative; width: min(760px, 80vw); height: 16px; border-radius: 999px; background: rgba(255,255,255,0.75); box-shadow: 0 3px 0 rgba(43,35,64,0.15); }
.kc-mini i { position: absolute; top: 50%; transform: translate(-50%, -50%); border-radius: 50%; display: block; }
.kc-mini .kc-view { top: 1px; bottom: 1px; transform: none; height: auto; border-radius: 999px; background: rgba(138,99,240,0.18); border: 2px solid rgba(138,99,240,0.45); box-sizing: border-box; }
.kc-mini .kc-tr { width: 7px; height: 7px; background: #fff3dc; border: 1.5px solid #b07a12; }
.kc-mini .kc-tr.wait { background: #ff9fd0; }
.kc-mini .kc-hero { width: 10px; height: 10px; border: 2px solid #fff; }
.kc-mini .kc-cage { width: 10px; height: 12px; border-radius: 3px; background: #8a7fa8; }
.kc-mini .kc-cage.gold { background: #ffc93c; }
.kc-mini .kc-gate { width: 6px; height: 14px; border-radius: 2px; background: #7a5a3a; }
.kc-mini .kc-flag { width: 14px; height: 14px; border-radius: 3px; background: #ffd23f; border: 2px solid #fff; }
.kc-help { color: #e85a35; font-size: clamp(12px, 1.3vw, 20px); }
.kc-tent { color: #3d84e8; font-size: clamp(11px, 1.1vw, 18px); }
.kc-stars { font-size: clamp(44px, 6vw, 96px); line-height: 1; margin: 4px 0; }
.kc-stars span { display: inline-block; color: #e4dff0; }
.kc-stars span.on { color: #ffc93c; animation: kc-star 0.5s cubic-bezier(.2,1.6,.4,1) both; -webkit-text-stroke: 0.04em #c98f00; }
@keyframes kc-star { from { transform: scale(0) rotate(-90deg); } to { transform: none; } }
.kc-tiers { display: flex; flex-wrap: wrap; gap: 6px 18px; justify-content: center; font-weight: 600; font-size: clamp(12px, 1.3vw, 20px); margin-bottom: 6px; }
.kc-tiers span { opacity: 0.45; }
.kc-tiers span.on { opacity: 1; color: #c98f00; }
.kc-node { color: #8a45e0; text-align: center; }
.kc-node small { display: block; color: #e0a100; font-size: 0.8em; }
.kc-goal { min-width: min(640px, 92vw); }
.kc-goals { display: flex; flex-direction: column; gap: 4px; align-items: flex-start; width: fit-content; margin: 6px auto 10px; font-size: clamp(16px, 1.8vw, 28px); font-weight: 700; color: #e85a35; text-align: left; }
.kc-card { position: absolute; left: 50%; bottom: 3vh; transform: translateX(-50%); width: min(860px, 92vw); background: rgba(255,255,255,0.95); border-radius: 28px; padding: 16px 28px 12px; box-shadow: 0 8px 0 rgba(43,35,64,0.2); font-size: clamp(16px, 1.9vw, 30px); font-weight: 600; line-height: 1.3; text-align: left; white-space: normal; }
.kc-card .speaker { display: inline-block; color: #fff; border-radius: 999px; padding: 2px 14px; font-size: 0.7em; font-weight: 700; margin-bottom: 6px; }
.kc-card .line.say { font-weight: 700; color: #5a3fd0; }
.kc-card .foot { display: flex; justify-content: space-between; align-items: center; font-size: 0.68em; opacity: 0.85; margin-top: 6px; }
.kc-card .dots { display: flex; gap: 6px; }
.kc-card .dots i { width: 10px; height: 10px; border-radius: 50%; background: #e4dff0; display: inline-block; }
.kc-card .dots i.on { background: #ff6fae; }
.kc-card .foot .blink { margin-left: auto; }
`;
  document.head.appendChild(el);
}
