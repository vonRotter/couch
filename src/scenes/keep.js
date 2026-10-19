import * as THREE from 'three';
import { MiniGame } from '../core/minigame.js';
import { Character } from '../core/character.js';
import { COLORS, PLAYER_COLORS, toon, basic, sharedGeo } from '../core/palette.js';
import { addLights, skyTexture, makeStar } from '../core/world.js';
import { t } from '../core/i18n.js';
import { esc } from '../core/ui.js';
import './keep/strings.js';
import { CELL, WALL_H, PR, GR, SPEED, CLASSES, GLYPH, clamp, angDiff, clock, mesh, sph, rbox, bx, cyl, fadeMat, disposeTree } from './keep/common.js';
import { generateFloor, FLOOR_PLAN } from './keep/dungeon.js';
import { Hazards } from './keep/hazards.js';
import { TeddyBoss, SheepBoss } from './keep/bosses.js';
import { FoeMixin } from './keep/foes.js';
import { LootMixin, BASE, starterWeapon, itemName } from './keep/loot.js';

// Pillow Keep: a co-op, non-violent dungeon crawl (Gauntlet meets a cozy Diablo). 1-6 players go
// five random floors deep on one shared, angled top-down camera. Grumbles of several kinds pour
// out of pillow-pile nests and snooze in rooms; a grumble touch fills your yawn meter, and a full
// meter means a nap until a teammate taps you (or you wake on your own). Keys open locked doors,
// chests and elites drop gear that is put on automatically when it is better, the team levels up
// together and every class learns new skills. Big Teddy guards floor 3, the Sleepy Sheep floor 5;
// both attack only with pink floor telegraphs that can be dodged.
//
// Code: keep/dungeon.js (random floors), keep/foes.js (grumbles and nests), keep/loot.js (gear),
// keep/hazards.js (floor telegraphs), keep/bosses.js (Big Teddy, Sleepy Sheep), keep/strings.js.

const FLOORS = FLOOR_PLAN.length;
// Per-floor colors: warm wood hall, blue vaults, peach toy attic, mint library, lavender bedroom.
const THEMES = [
  { floorA: 0xf2d2a4, floorB: 0xe6c291, wall: 0xb79fd6, cap: 0xd3c3ea, rug: 0xe0566f, rugIn: 0xff8fa8, grumble: 0x7b6cf6, sky: ['#2a1d45', '#6b4a7e'] },
  { floorA: 0xe4dccb, floorB: 0xd6ccb8, wall: 0x8faed8, cap: 0xbcd0ec, rug: 0x3f8fd6, rugIn: 0x8fd8ff, grumble: 0x8a6cf0, sky: ['#1d2a45', '#4a6b7e'] },
  { floorA: 0xf6d8c4, floorB: 0xecc8b0, wall: 0xe59a7a, cap: 0xf5c4a8, rug: 0x3fae9a, rugIn: 0x9ff0c8, grumble: 0xb05ad9, sky: ['#3a1d35', '#7e4a6b'] },
  { floorA: 0xd8ead8, floorB: 0xc8dcc6, wall: 0x6fae9a, cap: 0xa8d8c4, rug: 0x7a5ad0, rugIn: 0xc9a8ff, grumble: 0x6c7bf6, sky: ['#14303a', '#3e6b6b'] },
  { floorA: 0xd6c6ec, floorB: 0xc8b5e2, wall: 0x8a76c4, cap: 0xb3a5e0, rug: 0x8a45e0, rugIn: 0xc9a8ff, grumble: 0xd9549a, sky: ['#2a1d45', '#6b4a7e'] },
];

// Skills each class learns automatically: [level, key].
const SKILLS = {
  knight: [[3, 'bigSpin'], [5, 'wave'], [8, 'armor']],
  archer: [[3, 'wideFan'], [5, 'pierce'], [8, 'double']],
  wizard: [[3, 'storm'], [5, 'splash'], [8, 'homing']],
  bard: [[3, 'longSong'], [5, 'wakeTune'], [8, 'echo']],
};
const SHOTS = { dart: { speed: 18, life: 0.7 }, bubble: { speed: 10, life: 1.1 }, note: { speed: 13, life: 0.55 }, feather: { speed: 13, life: 0.38 } };
const TILT = 1.0; // camera pitch (radians above the floor)
const NAP_SOLO = 3; // nap length when nobody can tap you awake
const NAP_MAX = 6; // with teammates: a tap wakes you sooner
const STRAY_X = 12, STRAY_Z = 8; // how far from the others before the bubble pulls you along
const STAIRS_WAIT = 8; // once half the team is on the stairs, the rest float over after this
const SNACK_COLORS = [0xd9a066, 0xffffff];
const NO_INPUT = { x: 0, y: 0, a: false, b: false, c: false, aPressed: false, bPressed: false, cPressed: false, stepX: 0, stepY: 0 };
const COIN = '<span style="display:inline-block;width:.85em;height:.85em;border-radius:50%;background:#ffd23f;box-shadow:inset 0 0 0 .14em #e0a100;vertical-align:-.08em"></span>';

/** XP needed to go from level L to L+1. */
const xpNeed = (L) => 30 + 25 * (L - 1);

function makeKey() {
  const g = new THREE.Group();
  const mat = toon(COLORS.gold, { emissive: 0x5a3c00 });
  g.add(mesh(sharedGeo('kKeyRing', () => new THREE.TorusGeometry(0.2, 0.07, 8, 18)), mat, 0, 0.25, 0));
  g.add(mesh(bx('keyShaft', 0.09, 0.5, 0.09), mat, 0, -0.15, 0));
  g.add(mesh(bx('keyTooth', 0.17, 0.08, 0.09), mat, 0.1, -0.34, 0));
  g.add(mesh(bx('keyTooth', 0.17, 0.08, 0.09), mat, 0.1, -0.2, 0));
  return g;
}

/** Everyone picks a class before the first floor (duplicates allowed). */
class ClassPicker {
  constructor(scene, ents, onDone) {
    this.scene = scene;
    this.ents = ents;
    this.onDone = onDone;
    this.time = 0;
    this.locked = new Map(ents.map((e) => [e, false]));
    this.el = scene.game.ui.panel('', 'panel picker');
    this.render();
  }

  render() {
    const cols = CLASSES.map((cls) => {
      const chips = this.ents.filter((e) => e.cls === cls).map((e) => {
        const ok = this.locked.get(e);
        return `<div class="ball-pick ${ok ? 'done' : ''}" style="--c:${e.p.css}">${esc(e.p.name)}${ok ? ' ✓' : ''}</div>`;
      }).join('');
      const learns = t('keep.learns', { list: SKILLS[cls].map(([lv, k]) => `${t(`keep.skill.${k}`)} (${lv})`).join(', ') });
      return `<div class="vote-opt" style="width:clamp(130px,19vw,250px)"><div class="vote-label">${GLYPH[cls]} ${esc(t(`keep.cls.${cls}`))}</div>
        <div style="font-size:clamp(11px,1vw,16px);font-weight:600;text-align:center;opacity:.75;margin-bottom:4px">${esc(t(`keep.desc.${cls}`))}</div>
        <div style="font-size:clamp(10px,.85vw,14px);font-weight:600;text-align:center;opacity:.6;margin-bottom:6px">${esc(learns)}</div>${chips}</div>`;
    }).join('');
    this.el.innerHTML = `<div class="results-title">${esc(t('game.keep'))}</div>
      <div class="results-sub">${esc(t('keep.pick'))}</div>
      <div class="vote-row">${cols}</div>
      <div class="results-footer">${esc(t('keep.buttons'))}<br>${esc(t('keep.pickHint'))}</div>`;
  }

  update(dt) {
    if (this.done) return;
    const { scene } = this;
    this.time += dt;
    let changed = false;
    for (const e of this.ents) {
      const d = scene.input(e.p);
      if (!d) continue;
      const ok = this.locked.get(e);
      if (!ok && d.stepX) {
        const i = (CLASSES.indexOf(e.cls) + d.stepX + CLASSES.length) % CLASSES.length;
        scene.setClass(e, CLASSES[i]);
        scene.game.audio.play('select');
        changed = true;
      }
      if (d.aPressed) {
        this.locked.set(e, !ok);
        scene.game.audio.play(ok ? 'select' : 'join');
        if (!ok) e.ch.squash(1.4);
        changed = true;
      }
    }
    if (changed) this.render();
    if ([...this.locked.values()].every(Boolean) || this.time > 45) {
      this.done = true;
      this.el.remove();
      this.onDone();
    }
  }
}

export class KeepScene extends MiniGame {
  constructor(game, opts = {}) {
    super(game, opts);
    this.camera.fov = 40;
    const L = addLights(this.scene, { size: 24, dir: new THREE.Vector3(-0.35, 1, 0.55) });
    this.sun = L.sun;
    this.sunDir = new THREE.Vector3(-0.35, 1, 0.55).normalize().multiplyScalar(40);
    L.hemi.color.set(0xfff4e6);
    L.hemi.groundColor.set(0xffcf9e);
    L.hemi.intensity = 1.35;
    this.sun.intensity = 1.55;
    // A small pool of warm lamps that hop to the torches nearest the camera (constant light count).
    this.lamps = [];
    for (let i = 0; i < 4; i++) {
      const pl = new THREE.PointLight(0xff9a3c, 0, 10, 1.6);
      this.scene.add(pl);
      this.lamps.push(pl);
    }
    this.lampT = 0;

    // Each run is a new dungeon (opts.seed makes it repeatable for tests).
    this.seed = (opts.seed ?? Math.floor(Math.random() * 1e9)) >>> 0;
    this.floorIndex = 0;
    this.floorT = 0;
    this.floorTimes = [];
    this.floaters = [];
    this.flowT = 0;
    this.toastCd = 0;
    this.camCenter = new THREE.Vector3();
    this.camDist = 20;
    this.teamLevel = 1;
    this.xp = 0;
    this.naps = 0;

    this.ents = this.players.map((p, i) => this.makeEnt(p, i));
    this.loadFloor(opts.floor || 0);
    game.audio.playMusic('bubble');

    if (this.campaign) {
      this.intro(t('game.keep'), t('keep.intro'));
    } else {
      this.state = 'pick';
      this.picker = new ClassPicker(this, this.ents, () => {
        this.picker = null;
        this.intro(t('game.keep'), t('keep.intro'));
      });
    }
  }

  onLanguage() {
    this.picker?.render();
  }

  onStart() {
    this.floorT = 0;
    this.game.ui.toast(t(`keep.name.${this.floorIndex}`), 2200);
  }

  // ---------- players ----------

  makeEnt(p, i) {
    const ch = new Character(p.color, { hat: p.hat });
    this.scene.add(ch.group);
    const hand = new THREE.Group();
    hand.position.set(0, 0.5, 0);
    ch.pivot.add(hand);
    const capeSlot = new THREE.Group();
    capeSlot.position.set(0, 0.5, 0);
    ch.pivot.add(capeSlot);
    const bubble = mesh(sph(0.95, 20, 14), toon(p.color, { transparent: true, opacity: 0.35 }), 0, 0, 0, false);
    bubble.visible = false;
    this.scene.add(bubble);
    const keyMesh = makeKey();
    keyMesh.scale.setScalar(0.8);
    keyMesh.visible = false;
    this.scene.add(keyMesh);
    // Colored ring and aim arrow on the floor so everyone can find themselves in the crowd.
    const ring = mesh(sharedGeo('kPRing', () => new THREE.RingGeometry(0.5, 0.64, 28)), basic(p.color), 0, 0, 0, false);
    ring.rotation.x = -Math.PI / 2;
    this.scene.add(ring);
    const aim = mesh(sharedGeo('kAim', () => new THREE.ConeGeometry(0.16, 0.38, 3)), basic(p.color), 0, 0, 0, false);
    aim.rotation.x = Math.PI / 2;
    const aimPivot = new THREE.Group();
    aimPivot.add(aim);
    aim.position.z = 0.95;
    this.scene.add(aimPivot);
    const label = this.game.ui.label('label player-tag');
    const e = {
      p, i, ch, hand, capeSlot, bubble, keyMesh, ring, aimPivot, label, labelHtml: '',
      cls: CLASSES[i % CLASSES.length], level: 1, gear: {}, st: null, best: null, found: 0,
      x: 0, y: 0, z: 0, vx: 0, vz: 0, fx: 0, fz: -1,
      state: 'walk', yawn: 0, napT: 0, inv: 0, calm: 0, boost: 0, cdA: 0, cdB: 0, shotN: 0,
      hasKey: false, swingT: 0, swingDir: 1, spinT: 0, bubbleTo: null, bubbleCd: 0,
      coins: 0, nests: 0, woken: 0, fluffed: 0, naps: 0,
    };
    this.setClass(e, e.cls);
    return e;
  }

  /** Changing class (in the picker) swaps in that class's starter weapon. */
  setClass(e, cls) {
    e.cls = cls;
    e.gear.weapon = starterWeapon(cls);
    this.recomputeStats(e);
    this.applyLook(e);
  }

  hasSkill(e, key) {
    const s = SKILLS[e.cls].find(([, k]) => k === key);
    return !!s && e.level >= s[0];
  }

  /** Team XP: everyone shares it, so the whole team levels up together. */
  gainXp(amount, x, z) {
    const n = this.ents.length;
    this.xp += amount / (1 + 0.25 * (n - 1));
    while (this.xp >= xpNeed(this.teamLevel)) {
      this.xp -= xpNeed(this.teamLevel);
      this.levelUp();
    }
  }

  levelUp() {
    this.teamLevel++;
    this.game.audio.play('fanfare');
    this.game.ui.toast(`${t('keep.level', { n: this.teamLevel })} ${t('keep.skillUp')}`, 2000);
    for (const e of this.ents) {
      e.level = this.teamLevel;
      this.recomputeStats(e);
      // A level-up is a fresh start: the yawn meter empties (Diablo refills your health).
      if (e.state === 'nap') this.wake(e, null);
      e.yawn *= 0.5;
      const learned = SKILLS[e.cls].find(([lv]) => lv === this.teamLevel);
      const at = new THREE.Vector3(e.x, 2.4, e.z);
      this.floater(learned ? t('keep.newSkill', { skill: t(`keep.skill.${learned[1]}`) }) : t('keep.level', { n: this.teamLevel }), at, learned ? '#ffb400' : e.p.css, learned ? 2.4 : 1.4, true);
      this.confetti.burst(new THREE.Vector3(e.x, 0.3, e.z), 0, { count: 24, speed: 3, up: 7, colors: [COLORS.gold, 0xffffff, e.p.color], life: 1, gravity: -4, size: 0.13 });
      this.addFx('ring', e.x, e.z, { color: COLORS.gold, from: 0.4, to: 2.4, life: 0.6 });
    }
  }

  // ---------- floor building ----------

  loadFloor(index) {
    if (this.level) {
      for (const it of this.items) it.label?.remove();
      for (const g of this.grumbles) g.label?.remove();
      this.scene.remove(this.level);
      disposeTree(this.level);
    }
    this.floorIndex = index;
    this.floorDef = generateFloor(index, (this.seed + index * 1013) >>> 0);
    this.theme = THEMES[index];
    this.scene.background?.dispose?.();
    this.scene.background = skyTexture(...this.theme.sky);
    this.level = new THREE.Group();
    this.scene.add(this.level);
    this.hazards = new Hazards(this, this.level);
    this.grumbles = [];
    this.items = [];
    this.shots = [];
    this.fx = [];
    this.nests = [];
    this.chests = [];
    this.doors = [];
    this.torches = [];
    this.boss = null;
    this.fog = null;
    this.arena = null;
    this.stairsT = 0;
    this.floatingAll = false;
    this.onStairs = 0;
    this.floorT = 0;

    const map = this.floorDef.map;
    this.H = map.length;
    this.W = Math.max(...map.map((r) => r.length));
    const W = this.W, H = this.H;
    // Cell kinds: 0 nothing, 1 wall, 2 floor, 3 door, 4 stairs.
    this.cells = new Uint8Array(W * H);
    this.doorAt = new Map();
    this.flow = new Int16Array(W * H).fill(-1);
    const starts = [], marks = [];
    for (let r = 0; r < H; r++) {
      for (let c = 0; c < W; c++) {
        const ch = map[r][c] || ' ';
        let k = 2;
        if (ch === ' ') k = 0;
        else if (ch === '#') k = 1;
        else if (ch === 'D') k = 3;
        else if (ch === '>') k = 4;
        this.cells[r * W + c] = k;
        if (ch === 'S') starts.push([c, r]);
        if ('KNCrBEg'.includes(ch)) marks.push([ch, c, r]);
      }
    }
    // The boss bedroom: every walkable tile above the arena row.
    if (this.floorDef.arenaRow) {
      let c0 = W, c1 = 0, r0 = H, r1 = 0;
      for (let r = 0; r < this.floorDef.arenaRow; r++) for (let c = 0; c < W; c++) if (this.cells[r * W + c] >= 2) { c0 = Math.min(c0, c); c1 = Math.max(c1, c); r0 = Math.min(r0, r); r1 = Math.max(r1, r); }
      this.arena = { x0: (c0 - W / 2) * CELL, x1: (c1 + 1 - W / 2) * CELL, z0: (r0 - H / 2) * CELL, z1: (r1 + 1 - H / 2) * CELL };
    }
    this.buildTiles();
    this.buildDoors();
    this.buildStairs();
    this.buildDecor(marks);

    for (const [ch, c, r] of marks) {
      const x = this.cx(c), z = this.cz(r);
      if (ch === 'K') this.spawnItem('key', x, z);
      else if (ch === 'N') this.makeNest(x, z);
      else if (ch === 'C') this.makeChest(x, z);
      else if (ch === 'E') this.spawnPack(x, z, true);
      else if (ch === 'g') this.spawnPack(x, z, false);
      else if (ch === 'B') this.makeBoss(x, z);
    }
    for (const nest of this.nests) this.spawnGrumble(nest.x, nest.z, nest, 'basic');

    // Place everyone on the start tiles (two per tile when there are more players than tiles).
    this.ents.forEach((e, i) => {
      const [c, r] = starts[i % starts.length];
      const extra = Math.floor(i / starts.length);
      e.x = this.cx(c) + (extra ? 0.55 : 0);
      e.z = this.cz(r) + (extra ? 0.55 : 0);
      e.vx = e.vz = 0;
      e.fx = 0; e.fz = -1;
      e.state = 'walk';
      e.yawn = 0;
      e.inv = 0;
      e.hasKey = false;
      e.bubble.visible = false;
      e.ch.pivot.rotation.x = 0;
    });
    this.updateFlow();
    this.updateCamera(0, true);
  }

  makeBoss(x, z) {
    this.boss = this.floorDef.boss === 'teddy' ? new TeddyBoss(this, x, z) : new SheepBoss(this, x, z);
    // Dreamy clouds sit on the stairs until the boss is asleep.
    const fog = new THREE.Group();
    const cloud = toon(0xf4eaff, { transparent: true, opacity: 0.92 });
    for (let i = 0; i < 9; i++) {
      const a = i * 2.4;
      fog.add(mesh(sph(0.75 + (i % 3) * 0.2, 14, 10), cloud, this.stairs.x + Math.cos(a) * (0.4 + (i % 4) * 0.4), 0.4 + (i % 2) * 0.35, this.stairs.z + Math.sin(a) * (0.3 + (i % 3) * 0.35), false));
    }
    this.level.add(fog);
    this.fog = fog;
  }

  /** Called by a boss when it has fallen asleep and poofed. */
  onBossDefeated(boss) {
    const n = this.ents.length;
    for (let i = 0; i < 10 + 2 * n; i++) this.spawnItem('coin', boss.x, boss.z, true);
    for (let i = 0; i < 2; i++) this.spawnItem('snack', boss.x, boss.z, true);
    // Big Teddy leaves one upgrade for every player.
    if (boss instanceof TeddyBoss) for (const e of this.ents) this.dropLoot(boss.x, boss.z, 'boss', 1, e);
    this.gainXp(boss instanceof TeddyBoss ? 120 : 200, boss.x, boss.z);
    for (const g of [...this.grumbles]) this.fluffGrumble(g, undefined);
    if (this.fog) {
      for (const c of this.fog.children) this.puffs.burst(c.getWorldPosition(new THREE.Vector3()), 0xf4eaff, { count: 4, size: 0.8, life: 1, speed: 2 });
      this.level.remove(this.fog);
      this.fog = null;
    }
    this.bossDone = (this.bossDone || 0) + 1;
  }

  cx(c) { return (c + 0.5 - this.W / 2) * CELL; }
  cz(r) { return (r + 0.5 - this.H / 2) * CELL; }
  tileC(x) { return Math.floor(x / CELL + this.W / 2); }
  tileR(z) { return Math.floor(z / CELL + this.H / 2); }
  cell(c, r) { return c < 0 || r < 0 || c >= this.W || r >= this.H ? 0 : this.cells[r * this.W + c]; }
  walkable(c, r) {
    const k = this.cell(c, r);
    return k === 2 || k === 4 || (k === 3 && this.doorAt.get(r * this.W + c).open);
  }
  walkableAt(x, z) { return this.walkable(this.tileC(x), this.tileR(z)); }

  buildTiles() {
    const { W, H, theme } = this;
    const floorTiles = [], wallTiles = [];
    for (let r = 0; r < H; r++) {
      for (let c = 0; c < W; c++) {
        const k = this.cell(c, r);
        if (k === 2 || k === 3) floorTiles.push([c, r]);
        if (k !== 1) continue;
        let near = false;
        for (let dr = -1; dr <= 1 && !near; dr++) for (let dc = -1; dc <= 1; dc++) { const nk = this.cell(c + dc, r + dr); if (nk >= 2) { near = true; break; } }
        if (near) wallTiles.push([c, r]);
      }
    }
    const m = new THREE.Matrix4();
    const col = new THREE.Color();
    const floor = new THREE.InstancedMesh(bx('floorSlab', CELL, 0.3, CELL), toon(0xffffff), floorTiles.length);
    floorTiles.forEach(([c, r], i) => {
      m.makeTranslation(this.cx(c), -0.15, this.cz(r));
      floor.setMatrixAt(i, m);
      floor.setColorAt(i, col.set((c + r) % 2 ? theme.floorA : theme.floorB));
    });
    floor.receiveShadow = true;
    this.level.add(floor);

    // Walls are instanced in chunks so the camera (and the shadow pass) can skip far-away ones.
    const CH = 8, chunks = new Map();
    for (const [c, r] of wallTiles) {
      const k = `${Math.floor(c / CH)},${Math.floor(r / CH)}`;
      if (!chunks.has(k)) chunks.set(k, []);
      chunks.get(k).push([c, r]);
    }
    for (const list of chunks.values()) {
      const walls = new THREE.InstancedMesh(rbox('wall', CELL, WALL_H, CELL, 0.07), toon(theme.wall), list.length);
      const caps = new THREE.InstancedMesh(rbox('wallCap', CELL * 0.86, 0.14, CELL * 0.86, 0.05), toon(theme.cap), list.length);
      list.forEach(([c, r], i) => {
        m.makeTranslation(this.cx(c), WALL_H / 2 - 0.05, this.cz(r));
        walls.setMatrixAt(i, m);
        m.makeTranslation(this.cx(c), WALL_H - 0.02, this.cz(r));
        caps.setMatrixAt(i, m);
      });
      walls.computeBoundingSphere();
      caps.computeBoundingSphere();
      walls.castShadow = walls.receiveShadow = true;
      this.level.add(walls, caps);
    }
    this.wallTiles = wallTiles;
  }

  buildDoors() {
    const { W } = this;
    const seen = new Set();
    for (let i = 0; i < this.cells.length; i++) {
      if (this.cells[i] !== 3 || seen.has(i)) continue;
      const door = { tiles: [], meshes: [], open: false, sink: 0, lean: 0 };
      const stack = [i];
      seen.add(i);
      while (stack.length) {
        const j = stack.pop();
        const c = j % W, r = Math.floor(j / W);
        door.tiles.push([c, r]);
        this.doorAt.set(j, door);
        for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const k = (r + dr) * W + (c + dc);
          if (this.cell(c + dc, r + dr) === 3 && !seen.has(k)) { seen.add(k); stack.push(k); }
        }
      }
      for (const [c, r] of door.tiles) {
        // The passage runs between the two open sides; the gate spans across it.
        const acrossX = this.cell(c - 1, r) !== 2 && this.cell(c + 1, r) !== 2;
        const g = new THREE.Group();
        g.position.set(this.cx(c), 0, this.cz(r));
        if (!acrossX) g.rotation.y = Math.PI / 2;
        g.add(mesh(rbox('gate', CELL * 0.98, 1.6, CELL * 0.6, 0.08), toon(0xb07848), 0, 0.8, 0));
        for (const x of [-0.5, 0, 0.5]) g.add(mesh(bx('plank', 0.06, 1.5, CELL * 0.62), toon(0x8a5a3a), x, 0.8, 0, false));
        for (const y of [0.35, 1.25]) g.add(mesh(bx('gateBand', CELL, 0.12, CELL * 0.64), toon(0x7a6f96), 0, y, 0, false));
        for (const s of [-1, 1]) {
          const lock = mesh(cyl('lock', 0.24, 0.24, 0.08, 18), toon(COLORS.gold, { emissive: 0x4a3000 }), 0, 0.85, s * CELL * 0.31, false);
          lock.rotation.x = Math.PI / 2;
          const hole = mesh(bx('keyhole', 0.08, 0.2, 0.06), toon(COLORS.ink), 0, 0.82, s * CELL * 0.345, false);
          g.add(lock, hole);
        }
        this.level.add(g);
        door.meshes.push(g);
      }
      door.x = door.tiles.reduce((a, [c]) => a + this.cx(c), 0) / door.tiles.length;
      door.z = door.tiles.reduce((a, [, r]) => a + this.cz(r), 0) / door.tiles.length;
      this.doors.push(door);
    }
  }

  buildStairs() {
    const tiles = [];
    for (let i = 0; i < this.cells.length; i++) if (this.cells[i] === 4) tiles.push([i % this.W, Math.floor(i / this.W)]);
    const c0 = Math.min(...tiles.map((q) => q[0])), c1 = Math.max(...tiles.map((q) => q[0]));
    const r0 = Math.min(...tiles.map((q) => q[1])), r1 = Math.max(...tiles.map((q) => q[1]));
    const x0 = (c0 - this.W / 2) * CELL, x1 = (c1 + 1 - this.W / 2) * CELL;
    const z0 = (r0 - this.H / 2) * CELL, z1 = (r1 + 1 - this.H / 2) * CELL;
    this.stairs = { x0, x1, z0, z1, x: (x0 + x1) / 2, z: (z0 + z1) / 2 };
    const g = new THREE.Group();
    const w = x1 - x0, d = z1 - z0;
    const pit = toon(0x5a4a7a);
    g.add(mesh(new THREE.BoxGeometry(w, 1.4, 0.12), pit, this.stairs.x, -0.7, z0 + 0.06, false));
    for (const x of [x0 + 0.06, x1 - 0.06]) g.add(mesh(new THREE.BoxGeometry(0.12, 1.4, d), pit, x, -0.7, this.stairs.z, false));
    for (let k = 0; k < 4; k++) {
      const zs = z1 - (k + 0.5) * (d / 4), top = -0.18 - 0.2 * k, h = 1.4 + top;
      g.add(mesh(new THREE.BoxGeometry(w - 0.24, h, d / 4), toon(k % 2 ? 0xd8c4a8 : 0xeedcc0), this.stairs.x, top - h / 2, zs, false));
      g.add(mesh(new THREE.BoxGeometry(w * 0.4, 0.04, d / 4 * 0.98), toon(0xd94f6b), this.stairs.x, top + 0.02, zs, false));
    }
    const arrow = mesh(sharedGeo('kArrow', () => new THREE.ConeGeometry(0.45, 0.8, 4)), toon(COLORS.gold, { emissive: 0x664400 }), this.stairs.x, 3, this.stairs.z, false);
    arrow.rotation.x = Math.PI;
    g.add(arrow);
    this.stairsArrow = arrow;
    const glow = mesh(sharedGeo('kStairGlow', () => new THREE.CircleGeometry(2.6, 32)), basic(0xffd27a, { transparent: true, opacity: 0.25, depthWrite: false }), this.stairs.x, 0.03, this.stairs.z, false);
    glow.rotation.x = -Math.PI / 2;
    g.add(glow);
    this.level.add(g);
  }

  /** Rugs, torches (warm lamps), banners and cushions. */
  buildDecor(marks) {
    const { theme } = this;
    for (const [ch, c, r] of marks) {
      if (ch !== 'r') continue;
      const x = this.cx(c), z = this.cz(r);
      this.level.add(mesh(bx('rugEdge', 6.2, 0.03, 4.2), toon(COLORS.gold), x, 0.015, z, false));
      this.level.add(mesh(bx('rug', 5.8, 0.04, 3.8), toon(theme.rug), x, 0.025, z, false));
      this.level.add(mesh(bx('rugIn', 3.6, 0.05, 1.8), toon(theme.rugIn), x, 0.03, z, false));
      const dia = mesh(bx('rugDia', 0.9, 0.06, 0.9), toon(COLORS.gold), x, 0.035, z, false);
      dia.rotation.y = Math.PI / 4;
      this.level.add(dia);
    }
    const occupied = new Set(marks.map(([, c, r]) => `${c},${r}`));
    const bannerColors = PLAYER_COLORS.map((p) => p.hex);
    // Torches and banners hang on walls that face the camera (floor just south of them).
    let k = 0;
    for (const [c, r] of this.wallTiles) {
      if (!this.walkable(c, r + 1) || this.cell(c, r + 1) === 4) continue;
      const x = this.cx(c), z = this.cz(r) + CELL / 2;
      const slot = (c * 7 + r * 3) % 5;
      if (slot === 0) {
        const g = new THREE.Group();
        g.position.set(x, 0, z);
        g.add(mesh(bx('torchArm', 0.12, 0.12, 0.35), toon(0x5a4a6a), 0, 1.0, 0.12, false));
        g.add(mesh(cyl('torchCup', 0.17, 0.1, 0.22, 10), toon(0x7a6f96), 0, 1.1, 0.3, false));
        const flame = mesh(sharedGeo('kFlame', () => new THREE.ConeGeometry(0.14, 0.4, 8)), toon(0xffb347, { emissive: 0xff7a00 }), 0, 1.38, 0.3, false);
        const core = mesh(sph(0.09), toon(0xfff1a8, { emissive: 0xffd000 }), 0, 1.28, 0.3, false);
        const halo = mesh(sharedGeo('kHalo', () => new THREE.CircleGeometry(0.55, 20)), basic(0xffc46b, { transparent: true, opacity: 0.35, depthWrite: false }), 0, 1.3, 0.04, false);
        const pool = mesh(sharedGeo('kPool', () => new THREE.CircleGeometry(1.5, 24)), basic(0xffc46b, { transparent: true, opacity: 0.18, depthWrite: false }), 0, 0.04, 1.0, false);
        pool.rotation.x = -Math.PI / 2;
        g.add(flame, core, halo, pool);
        this.level.add(g);
        this.torches.push({ x, z: z + 0.6, flame, phase: k * 1.7 });
      } else if (slot === 3) {
        const color = bannerColors[k % bannerColors.length];
        const g = new THREE.Group();
        g.position.set(x, 0, z + 0.04);
        g.add(mesh(cyl('bannerRod', 0.04, 0.04, 1.1, 6), toon(COLORS.gold), 0, 1.42, 0, false));
        g.children[0].rotation.z = Math.PI / 2;
        g.add(mesh(bx('banner', 0.8, 0.85, 0.04), toon(color), 0, 0.98, 0, false));
        const tip = mesh(sharedGeo('kBannerTip', () => new THREE.ConeGeometry(0.4, 0.35, 3)), toon(color), 0, 0.42, 0, false);
        tip.rotation.z = Math.PI;
        tip.scale.z = 0.1;
        g.add(tip, mesh(sph(0.13), toon(COLORS.cream), 0, 1.0, 0.03, false));
        this.level.add(g);
      }
      k++;
    }
    // Cushions in the far corners of rooms.
    const cushionColors = [COLORS.candyPink, COLORS.candyBlue, COLORS.candyYellow, COLORS.candyMint, COLORS.candyLilac];
    let n = 0;
    for (let r = 0; r < this.H; r++) {
      for (let c = 0; c < this.W; c++) {
        if (this.cell(c, r) !== 2 || occupied.has(`${c},${r}`) || this.cell(c, r - 1) !== 1) continue;
        const side = this.cell(c - 1, r) === 1 ? -1 : this.cell(c + 1, r) === 1 ? 1 : 0;
        if (!side || this.cell(c - side, r) !== 2 || this.cell(c, r + 1) !== 2) continue;
        // Not in corridors (both neighbors across must be open floor for a room corner).
        if (this.cell(c - side * 2, r) !== 2) continue;
        const x = this.cx(c) + side * 0.35, z = this.cz(r) - 0.35;
        const cush = mesh(rbox('cushion', 0.95, 0.32, 0.95, 0.15), toon(cushionColors[n % 5]), x, 0.16, z);
        cush.rotation.y = 0.3 * side;
        const btn = mesh(sph(0.07), toon(COLORS.cream), x, 0.33, z, false);
        this.level.add(cush, btn);
        if (n % 2 === 0) {
          const top = mesh(rbox('cushion', 0.95, 0.32, 0.95, 0.15), toon(cushionColors[(n + 2) % 5]), x + side * 0.05, 0.45, z + 0.05);
          top.rotation.y = -0.4 * side;
          this.level.add(top);
        }
        n++;
      }
    }
  }

  makeChest(x, z) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.add(mesh(rbox('chest', 1.2, 0.6, 0.8, 0.06), toon(0xb87a48), 0, 0.3, 0));
    g.add(mesh(bx('chestBand', 1.24, 0.09, 0.84), toon(COLORS.gold), 0, 0.15, 0, false));
    const lid = new THREE.Group();
    lid.position.set(0, 0.6, -0.4);
    lid.add(mesh(rbox('chestLid', 1.2, 0.3, 0.8, 0.1), toon(0xc98b5a), 0, 0.12, 0.4));
    lid.add(mesh(bx('chestLidBand', 1.24, 0.09, 0.84), toon(COLORS.gold), 0, 0.15, 0.4, false));
    lid.add(mesh(bx('chestLock', 0.2, 0.24, 0.08), toon(COLORS.gold, { emissive: 0x4a3000 }), 0, 0.02, 0.82, false));
    g.add(lid);
    this.level.add(g);
    this.chests.push({ x, z, g, lid, open: false, lean: 0, r: 0.75 });
  }

  // ---------- items: coins, snacks, keys, gear ----------

  spawnItem(kind, x, z, pop = false, custom = null) {
    let m = custom;
    if (kind === 'coin') {
      m = new THREE.Group();
      const disc = mesh(cyl('coin', 0.24, 0.24, 0.07, 16), toon(COLORS.gold, { emissive: 0x4a3000 }), 0, 0, 0, true);
      disc.rotation.x = Math.PI / 2;
      m.add(disc, mesh(bx('coinMark', 0.06, 0.22, 0.08), toon(0xe0a100), 0, 0, 0, false));
    } else if (kind === 'snack') {
      m = new THREE.Group();
      if (Math.random() < 0.5) {
        m.add(mesh(cyl('cookie', 0.3, 0.3, 0.1, 16), toon(SNACK_COLORS[0]), 0, 0, 0));
        for (const [cx, cz] of [[0.1, 0.08], [-0.12, 0.02], [0.02, -0.13]]) m.add(mesh(sph(0.045, 6, 4), toon(0x6b3f22), cx, 0.06, cz, false));
        m.rotation.x = 0.6;
      } else {
        m.add(mesh(cyl('mug', 0.2, 0.18, 0.38, 14), toon(0x4cc9f0), 0, 0, 0));
        m.add(mesh(cyl('milk', 0.17, 0.17, 0.02, 14), toon(SNACK_COLORS[1]), 0, 0.19, 0, false));
        m.add(mesh(sharedGeo('kHandle', () => new THREE.TorusGeometry(0.1, 0.035, 6, 12)), toon(0x4cc9f0), 0.22, 0, 0, false));
      }
    } else if (kind === 'key') {
      m = makeKey();
    }
    this.level.add(m);
    const a = Math.random() * Math.PI * 2, sp = pop ? 2 + Math.random() * 3 : 0;
    const it = { kind, x, z, y: pop ? 0.8 : 0.5, vx: Math.cos(a) * sp, vz: Math.sin(a) * sp, vy: pop ? 5 + Math.random() * 3 : 0, t: 0, mesh: m, phase: Math.random() * 6 };
    this.items.push(it);
    return it;
  }

  updateItems(dt, active) {
    for (const it of this.items) {
      it.t += dt;
      if (it.vy || it.y > 0.5) {
        it.vy -= 20 * dt;
        it.y += it.vy * dt;
        if (it.y < 0.5) { it.y = 0.5; it.vy = Math.abs(it.vy) > 2 ? -it.vy * 0.35 : 0; }
      }
      if (it.vx || it.vz) {
        const o = { x: it.x + it.vx * dt, z: it.z + it.vz * dt };
        if (this.walkableAt(o.x, o.z)) { it.x = o.x; it.z = o.z; } else { it.vx *= -0.5; it.vz *= -0.5; }
        const f = Math.max(0, 1 - dt * 3);
        it.vx *= f; it.vz *= f;
        if (Math.abs(it.vx) + Math.abs(it.vz) < 0.05) it.vx = it.vz = 0;
      }
      if (it.kind === 'gear') {
        this.updateGear(it, dt, active);
      } else if (active && it.t > 0.4) {
        let best = null, bd = it.kind === 'coin' ? 2.2 : 0.9;
        for (const e of this.ents) {
          if (e.state !== 'walk') continue;
          if (it.kind === 'key' && e.hasKey) continue;
          if (it.kind === 'snack' && e.yawn < 0.05) continue;
          const d = Math.hypot(e.x - it.x, e.z - it.z);
          if (d < bd) { bd = d; best = e; }
        }
        if (best) {
          if (it.kind === 'coin' && bd > 0.55) {
            const k = Math.min(1, dt * 9 / bd);
            it.x += (best.x - it.x) * k; it.z += (best.z - it.z) * k;
          } else {
            this.pickItem(it, best);
          }
        }
      }
      if (it.taken) continue;
      const bob = it.kind === 'coin' ? 0 : Math.sin(this.time * 3 + it.phase) * 0.12;
      it.mesh.position.set(it.x, it.y + bob + (it.kind === 'key' ? 0.3 : 0), it.z);
      it.mesh.rotation.y += dt * (it.kind === 'key' ? 2 : it.kind === 'gear' ? 1.5 : 4);
    }
    this.items = this.items.filter((it) => !it.taken);
  }

  pickItem(it, e) {
    it.taken = true;
    this.level.remove(it.mesh);
    const at = new THREE.Vector3(it.x, 0.8, it.z);
    if (it.kind === 'coin') {
      e.coins++;
      this.game.audio.play('coin');
      this.confetti.burst(at, COLORS.gold, { count: 4, speed: 2, life: 0.4, size: 0.1 });
    } else if (it.kind === 'snack') {
      e.yawn = 0;
      e.calm = 0;
      this.game.audio.play('star');
      this.floater(t('keep.snack'), at.setY(2.2), e.p.css, 1);
      this.puffs.burst(new THREE.Vector3(e.x, 1, e.z), 0xfff1a8, { count: 8, size: 0.3, life: 0.6 });
    } else {
      e.hasKey = true;
      this.game.audio.play('rescue');
      this.game.ui.toast(t('keep.gotKey', { name: e.p.name }), 1800);
      this.confetti.burst(at, COLORS.gold, { count: 20, speed: 5, life: 0.8, size: 0.14 });
    }
  }

  // ---------- collision ----------

  /** Move a circle through the tile grid, sliding along walls. */
  moveCircle(o, dx, dz, rad) {
    o.x += dx;
    this.pushOut(o, rad);
    o.z += dz;
    this.pushOut(o, rad);
    for (const n of this.nests) if (!n.done) this.pushRound(o, rad, n);
    for (const c of this.chests) this.pushRound(o, rad, c);
  }

  pushOut(o, rad) {
    const c0 = this.tileC(o.x - rad), c1 = this.tileC(o.x + rad);
    const r0 = this.tileR(o.z - rad), r1 = this.tileR(o.z + rad);
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        if (this.walkable(c, r)) continue;
        const x0 = (c - this.W / 2) * CELL, z0 = (r - this.H / 2) * CELL;
        const px = clamp(o.x, x0, x0 + CELL), pz = clamp(o.z, z0, z0 + CELL);
        const dx = o.x - px, dz = o.z - pz, d2 = dx * dx + dz * dz;
        if (d2 >= rad * rad) continue;
        if (d2 > 1e-8) {
          const d = Math.sqrt(d2);
          o.x += dx / d * (rad - d); o.z += dz / d * (rad - d);
        } else {
          const opts = [[o.x - x0 + rad, -1, 0], [x0 + CELL - o.x + rad, 1, 0], [o.z - z0 + rad, 0, -1], [z0 + CELL - o.z + rad, 0, 1]];
          opts.sort((a, b) => a[0] - b[0]);
          o.x += opts[0][1] * opts[0][0]; o.z += opts[0][2] * opts[0][0];
        }
      }
    }
  }

  pushRound(o, rad, ob) {
    const dx = o.x - ob.x, dz = o.z - ob.z, d = Math.hypot(dx, dz), min = rad + ob.r;
    if (d < min && d > 0.001) { o.x += dx / d * (min - d); o.z += dz / d * (min - d); }
  }

  // ---------- player actions ----------

  addYawn(e, amount) {
    if (e.state !== 'walk' || e.inv > 0) return false;
    e.yawn = Math.min(e.st.maxYawn, e.yawn + amount * (this.hasSkill(e, 'armor') ? 0.7 : 1));
    e.inv = 0.9;
    e.calm = 0;
    e.ch.squash(0.72);
    this.game.audio.play('bump');
    this.puffs.burst(new THREE.Vector3(e.x, 1.2, e.z), 0xc9a8ff, { count: 4, size: 0.3, life: 0.6, speed: 1.5 });
    if (e.yawn >= e.st.maxYawn - 1e-6) this.nap(e);
    return true;
  }

  nap(e) {
    e.state = 'nap';
    e.napT = 0;
    e.vx = e.vz = 0;
    e.naps++;
    this.naps++;
    this.game.audio.play('dizzy');
  }

  wake(e, by) {
    if (e.state !== 'nap') return;
    e.state = 'walk';
    e.yawn = e.st.maxYawn * 0.3;
    e.inv = 1.6;
    e.calm = 0;
    e.ch.squash(1.4);
    this.game.audio.play('rescue');
    this.puffs.burst(new THREE.Vector3(e.x, 1, e.z), 0xfff1a8, { count: 8, size: 0.35, life: 0.6 });
    if (by) {
      by.woken++;
      this.floater(t('keep.woke', { name: by.p.name, other: e.p.name }), new THREE.Vector3(e.x, 2.4, e.z), by.p.css, 1.3);
    }
  }

  mainAction(e) {
    e.cdA = BASE[e.cls].cdA / e.st.rate;
    e.swingT = 0.22;
    e.swingDir = -e.swingDir;
    e.shotN++;
    const dmg = e.st.dmg;
    if (e.cls === 'knight') {
      this.swing(e, 2.4, 1.25, dmg);
      // Feather Wave: every other swing also sends a feather wave forward.
      if (this.hasSkill(e, 'wave') && e.shotN % 2 === 0) this.shoot(e, 'feather', 0, dmg * 0.7, { pierce: 3 });
      this.game.audio.play('whoosh');
    } else if (e.cls === 'archer') {
      const pierce = this.hasSkill(e, 'pierce') ? 2 : 0;
      if (this.hasSkill(e, 'double')) { this.shoot(e, 'dart', -0.07, dmg, { pierce }); this.shoot(e, 'dart', 0.07, dmg, { pierce }); }
      else this.shoot(e, 'dart', 0, dmg, { pierce });
      this.game.audio.play('dash');
    } else if (e.cls === 'wizard') {
      this.shoot(e, 'bubble', 0, dmg);
      this.game.audio.play('bubble');
    } else {
      if (this.hasSkill(e, 'echo')) for (const a of [-0.22, 0, 0.22]) this.shoot(e, 'note', a, dmg * 0.75);
      else this.shoot(e, 'note', 0, dmg);
      this.game.audio.play('select');
    }
  }

  special(e) {
    e.cdB = BASE[e.cls].cdB * (1 - e.st.cdr);
    const dmg = e.st.dmg;
    if (e.cls === 'knight') {
      e.spinT = 0.4;
      this.swing(e, this.hasSkill(e, 'bigSpin') ? 4.2 : 3.2, Math.PI, dmg * 1.5, 9);
      this.game.audio.play('whoosh');
    } else if (e.cls === 'archer') {
      const n = this.hasSkill(e, 'wideFan') ? 4 : 2;
      const pierce = this.hasSkill(e, 'pierce') ? 2 : 0;
      for (let k = -n; k <= n; k++) this.shoot(e, 'dart', k * (n === 2 ? 0.22 : 0.15), dmg, { pierce });
      this.game.audio.play('dash');
    } else if (e.cls === 'wizard') {
      const n = this.hasSkill(e, 'storm') ? 14 : 8;
      for (let k = 0; k < n; k++) this.shoot(e, 'bubble', (k / n) * Math.PI * 2, dmg, { life: this.hasSkill(e, 'storm') ? 0.75 : 0.5 });
      this.game.audio.play('trap');
    } else {
      // Lullaby: nearby grumbles nod off, bosses get drowsy, teammates speed up.
      const long = this.hasSkill(e, 'longSong');
      const R = long ? 7.5 : 5.5, nap = long ? 7 : 5;
      for (const g of this.grumbles) {
        if (g.state === 'bubble' || g.state === 'idle' || Math.hypot(g.x - e.x, g.z - e.z) > R) continue;
        g.state = 'sleep'; g.t = g.elite ? nap * 0.5 : nap; g.vx = g.vz = 0;
      }
      for (const o of this.ents) {
        if (Math.hypot(o.x - e.x, o.z - e.z) > R) continue;
        if (o.state === 'walk') o.boost = 4;
        // Wake-up Tune: friends feel fresh and nappers wake.
        if (this.hasSkill(e, 'wakeTune')) {
          if (o.state === 'nap' && o !== e) this.wake(o, e);
          else if (o.state === 'walk') o.yawn = Math.max(0, o.yawn - 0.4);
        }
      }
      const b = this.boss;
      if (b?.awake && Math.hypot(b.x - e.x, b.z - e.z) < R + b.r) { b.drowsy = long ? 5 : 3.5; b.damage(dmg * 2, e); }
      this.addFx('ring', e.x, e.z, { color: 0xffd23f, from: 0.5, to: R, life: 0.6 });
      this.confetti.burst(new THREE.Vector3(e.x, 1.2, e.z), 0, { count: 24, speed: 6, up: 2, colors: [0xffd23f, 0xc9a8ff, 0xffffff], life: 1, gravity: -2, size: 0.14 });
      this.game.audio.play('star');
    }
  }

  inArc(e, x, z, rad, half) {
    const dx = x - e.x, dz = z - e.z, d = Math.hypot(dx, dz);
    if (d > rad) return false;
    if (d < 0.7) return true;
    return angDiff(Math.atan2(dx, dz), Math.atan2(e.fx, e.fz)) <= half;
  }

  /** Knight pillow swing: everything in the arc gets bonked. */
  swing(e, rad, half, dmg, push = 5) {
    const spin = half >= Math.PI;
    for (const g of [...this.grumbles]) {
      if (!this.inArc(e, g.x, g.z, rad + GR * g.size, half)) continue;
      const dx = g.x - e.x, dz = g.z - e.z, d = Math.hypot(dx, dz) || 1;
      this.hitGrumble(g, dmg, e, dx / d * push, dz / d * push, spin ? null : e);
    }
    for (const n of this.nests) if (!n.done && this.inArc(e, n.x, n.z, rad + n.r, half)) this.damageNest(n, dmg * 1.6, e);
    const b = this.boss;
    if (b?.awake && b.y < 2.5 && this.inArc(e, b.x, b.z, rad + b.r, half)) { b.damage(dmg, e); this.game.audio.play('boing'); }
    this.addFx('arc', e.x, e.z, { yaw: Math.atan2(e.fx, e.fz), half, rad, life: 0.2 });
  }

  shoot(e, kind, angOff, dmg, { pierce = 0, life = 1 } = {}) {
    const a = Math.atan2(e.fx, e.fz) + angOff;
    const dx = Math.sin(a), dz = Math.cos(a);
    const S = SHOTS[kind];
    let m;
    if (kind === 'dart') {
      m = new THREE.Group();
      const shaft = mesh(cyl('dart', 0.06, 0.06, 0.6, 8), toon(0xff8c42), 0, 0, 0, false);
      shaft.rotation.x = Math.PI / 2;
      m.add(shaft, mesh(sph(0.1, 8, 6), toon(0x4cc9f0), 0, 0, 0.32, false));
      m.rotation.y = a;
    } else if (kind === 'bubble') {
      m = mesh(sph(0.36, 16, 12), toon(0xbfe9ff, { transparent: true, opacity: 0.55 }), 0, 0, 0, false);
      m.add(mesh(sph(0.08), toon(COLORS.white), -0.14, 0.14, 0.24, false));
    } else if (kind === 'feather') {
      m = new THREE.Mesh(sharedGeo('kFeatherArc', () => new THREE.RingGeometry(0.6, 1.0, 16, 1, -Math.PI / 2 - 0.8, 1.6)), basic(0xffffff, { transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide }));
      m.rotation.order = 'YXZ';
      m.rotation.set(-Math.PI / 2, a, 0);
    } else {
      m = new THREE.Group();
      const head = mesh(sph(0.14, 10, 8), toon(0x9b5de5), 0, 0, 0, false);
      head.scale.set(1.2, 0.85, 1);
      m.add(head, mesh(bx('noteStem', 0.05, 0.4, 0.05), toon(0x9b5de5), 0.14, 0.2, 0, false));
    }
    this.level.add(m);
    this.shots.push({ kind, x: e.x + dx * 0.5, z: e.z + dz * 0.5, vx: dx * S.speed, vz: dz * S.speed, life: S.life * life, owner: e, mesh: m, t: 0, dmg, pierce, hits: new Set(), homing: kind === 'bubble' && this.hasSkill(e, 'homing') });
  }

  updateShots(dt) {
    const b = this.boss;
    for (const sh of this.shots) {
      sh.life -= dt;
      sh.t += dt;
      if (sh.homing) {
        // Homing Bubbles curve toward the nearest grumble ahead.
        let best = null, bd = 5;
        for (const g of this.grumbles) { if (g.state === 'bubble' || g.dead) continue; const d = Math.hypot(g.x - sh.x, g.z - sh.z); if (d < bd) { bd = d; best = g; } }
        if (best) {
          const sp = Math.hypot(sh.vx, sh.vz), tx = (best.x - sh.x) / bd * sp, tz = (best.z - sh.z) / bd * sp;
          const k = Math.min(1, dt * 5);
          sh.vx += (tx - sh.vx) * k; sh.vz += (tz - sh.vz) * k;
        }
      }
      sh.x += sh.vx * dt;
      sh.z += sh.vz * dt;
      const from = { x: sh.x - sh.vx, z: sh.z - sh.vz };
      let hit = sh.life <= 0 || !this.walkableAt(sh.x, sh.z);
      if (!hit) {
        for (const n of this.nests) {
          if (!n.done && Math.hypot(n.x - sh.x, n.z - sh.z) < n.r + 0.15) { this.damageNest(n, sh.dmg, sh.owner); hit = true; break; }
        }
      }
      if (!hit) {
        for (const g of this.grumbles) {
          if (g.dead || sh.hits.has(g) || Math.hypot(g.x - sh.x, g.z - sh.z) > 0.55 + 0.25 * g.size) continue;
          sh.hits.add(g);
          if (sh.kind === 'bubble') {
            if (this.blocks(g, from.x, from.z)) this.blockFx(g);
            else this.trapGrumble(g, sh.owner);
            hit = true;
          } else {
            const landed = this.hitGrumble(g, sh.dmg, sh.owner, sh.vx * 0.3, sh.vz * 0.3, from);
            if (!landed || sh.pierce-- <= 0) hit = true;
          }
          break;
        }
      }
      if (!hit && b?.awake && b.y < 2.5 && Math.hypot(b.x - sh.x, b.z - sh.z) < b.r + 0.3) {
        b.damage(sh.kind === 'bubble' ? sh.dmg * 1.5 : sh.dmg, sh.owner);
        hit = true;
      }
      if (hit) {
        sh.dead = true;
        this.level.remove(sh.mesh);
        this.puffs.burst(new THREE.Vector3(sh.x, 0.8, sh.z), sh.kind === 'bubble' ? 0xbfe9ff : 0xffffff, { count: 3, size: 0.2, life: 0.3, speed: 1.5 });
        continue;
      }
      const y = sh.kind === 'feather' ? 0.4 : 0.8 + (sh.kind === 'note' ? Math.sin(sh.t * 20) * 0.15 : 0);
      sh.mesh.position.set(sh.x, y, sh.z);
      if (sh.kind === 'bubble') sh.mesh.scale.setScalar(1 + Math.sin(sh.t * 18) * 0.06);
    }
    this.shots = this.shots.filter((sh) => !sh.dead);
  }

  /** C: wake a teammate, unlock a door, or open a chest. */
  interact(e) {
    for (const o of this.ents) {
      if (o !== e && o.state === 'nap' && Math.hypot(o.x - e.x, o.z - e.z) < 2.2) { this.wake(o, e); return; }
    }
    const door = this.doorNear(e, 1.3);
    if (door && e.hasKey) { this.unlock(door, e); return; }
    const chest = this.chestNear(e, 2);
    if (chest) { this.openChest(chest, e); return; }
    if (door && this.toastCd <= 0) {
      this.toastCd = 2;
      this.game.ui.toast(t('keep.needKey'), 1400);
      this.game.audio.play('bump');
    }
  }

  doorNear(e, pad) {
    for (const door of this.doors) {
      if (door.open) continue;
      for (const [c, r] of door.tiles) {
        const x0 = (c - this.W / 2) * CELL, z0 = (r - this.H / 2) * CELL;
        const dx = e.x - clamp(e.x, x0, x0 + CELL), dz = e.z - clamp(e.z, z0, z0 + CELL);
        if (Math.hypot(dx, dz) < pad) return door;
      }
    }
    return null;
  }

  chestNear(e, dist) {
    let best = null, bd = dist;
    for (const c of this.chests) {
      if (c.open) continue;
      const d = Math.hypot(c.x - e.x, c.z - e.z);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }

  unlock(door, e) {
    door.open = true;
    e.hasKey = false;
    this.game.audio.play('fanfare');
    this.game.ui.toast(t('keep.unlock'), 1400);
    this.confetti.burst(new THREE.Vector3(door.x, 1.2, door.z), 0, { count: 40, speed: 7, up: 4, colors: [COLORS.gold, 0xffffff, e.p.color], life: 1.1, size: 0.16 });
    this.updateFlow();
  }

  openChest(chest, e) {
    chest.open = true;
    this.game.audio.play('star');
    this.floater(t('keep.chest'), new THREE.Vector3(chest.x, 2.2, chest.z), e.p.css, 1.2);
    this.confetti.burst(new THREE.Vector3(chest.x, 1, chest.z), COLORS.gold, { count: 24, speed: 5, up: 5, life: 0.9, size: 0.14 });
    const n = this.ents.length;
    for (let i = 0; i < 5 + n; i++) this.spawnItem('coin', chest.x, chest.z + 0.5, true);
    if (Math.random() < 0.7) this.spawnItem('snack', chest.x, chest.z + 0.5, true);
    this.dropLoot(chest.x, chest.z + 0.6, 'chest', 1 + Math.floor(n / 3));
    this.gainXp(5, chest.x, chest.z);
  }

  updateDoorsAndChests(dt, active) {
    for (const door of this.doors) {
      if (door.open) {
        if (door.sink < 1) {
          door.sink = Math.min(1, door.sink + dt * 1.6);
          for (const m of door.meshes) { m.position.y = -door.sink * 1.75; m.visible = door.sink < 1; }
        }
        continue;
      }
      // Leaning on a locked door with a key also opens it.
      const carrier = active && this.ents.find((e) => e.state === 'walk' && e.hasKey && this.doorNear(e, PR + 0.2) === door);
      door.lean = carrier ? door.lean + dt : 0;
      if (carrier && door.lean > 0.5) this.unlock(door, carrier);
    }
    for (const c of this.chests) {
      if (c.open) {
        c.lid.rotation.x += (-1.9 - c.lid.rotation.x) * Math.min(1, dt * 8);
        continue;
      }
      const e = active && this.ents.find((o) => o.state === 'walk' && Math.hypot(o.x - c.x, o.z - c.z) < c.r + PR + 0.25);
      c.lean = e ? c.lean + dt : 0;
      c.lid.rotation.x = e ? -Math.abs(Math.sin(this.time * 20)) * 0.08 : 0;
      if (e && c.lean > 0.7) this.openChest(c, e);
    }
  }

  // ---------- effects ----------

  addFx(kind, x, z, o) {
    if (kind === 'arc') {
      const geo = sharedGeo(`kArc${o.rad}|${o.half}`, () => new THREE.RingGeometry(0.5, o.rad, 28, 1, -Math.PI / 2 - o.half, o.half * 2));
      const g = new THREE.Group();
      g.position.set(x, 0.5, z);
      g.rotation.y = o.yaw;
      const m = new THREE.Mesh(geo, fadeMat(0xffffff, 0.55));
      m.rotation.x = -Math.PI / 2;
      g.add(m);
      this.level.add(g);
      this.fx.push({ kind, obj: g, mat: m.material, life: o.life, max: o.life });
    } else if (kind === 'ring') {
      const m = new THREE.Mesh(sharedGeo('kRing', () => new THREE.RingGeometry(0.85, 1, 48)), fadeMat(o.color, 0.6));
      m.rotation.x = -Math.PI / 2;
      m.position.set(x, 0.15, z);
      this.level.add(m);
      this.fx.push({ kind, obj: m, mat: m.material, life: o.life, max: o.life, from: o.from, to: o.to });
    }
  }

  spawnStarFx(x, y, z) {
    const s = makeStar(COLORS.gold);
    s.scale.setScalar(0.5);
    s.position.set(x, y, z);
    this.level.add(s);
    const a = Math.random() * Math.PI * 2;
    this.fx.push({ kind: 'star', obj: s, life: 0.9, max: 0.9, vx: Math.cos(a) * 1.5, vy: 4 + Math.random() * 2, vz: Math.sin(a) * 1.5, spin: 8 });
  }

  updateFx(dt) {
    for (const f of this.fx) {
      f.life -= dt;
      const k = Math.max(0, f.life / f.max);
      if (f.kind === 'arc') f.mat.opacity = 0.55 * k;
      else if (f.kind === 'ring') { f.obj.scale.setScalar(f.from + (f.to - f.from) * (1 - k)); f.mat.opacity = 0.6 * k; }
      else {
        f.vy -= (f.kind === 'piece' ? 14 : 6) * dt;
        f.obj.position.x += f.vx * dt; f.obj.position.y += f.vy * dt; f.obj.position.z += f.vz * dt;
        f.obj.rotation.y += f.spin * dt;
        f.obj.rotation.x += f.spin * 0.5 * dt;
        f.obj.scale.setScalar((f.kind === 'star' ? 0.5 : 1) * Math.min(1, k * 2.5));
      }
      if (f.life <= 0) {
        this.level.remove(f.obj);
        if (f.mat) f.mat.dispose();
      }
    }
    this.fx = this.fx.filter((f) => f.life > 0);
  }

  /** Floating text; dark = dark outline (for gold/white text that needs contrast). */
  floater(text, pos, css, life, dark = false) {
    const el = this.game.ui.label('label');
    el.textContent = text;
    el.style.color = css;
    if (dark) { el.style.webkitTextStroke = '0.2em #2b2340'; el.style.fontSize = 'clamp(12px, 1.2vw, 20px)'; }
    this.floaters.push({ el, pos: pos.clone(), life, max: life });
  }

  updateFloaters(dt) {
    for (const f of this.floaters) {
      f.life -= dt;
      f.pos.y += dt * 1.2;
      this.game.ui.place(f.el, f.pos, this.camera);
      f.el.style.opacity = String(clamp(f.life / f.max * 2, 0, 1));
      if (f.life <= 0) f.el.remove();
    }
    this.floaters = this.floaters.filter((f) => f.life > 0);
  }

  // ---------- per-frame player update ----------

  updateEnt(e, dt, active) {
    const inp = active ? (this.input(e.p) || NO_INPUT) : NO_INPUT;
    e.cdA -= dt; e.cdB -= dt; e.boost -= dt; e.inv -= dt; e.calm += dt;
    e.swingT -= dt; e.spinT -= dt; e.bubbleCd -= dt;
    let moving = 0;
    if (e.state === 'bubble') {
      const tg = e.bubbleTo();
      const dx = tg.x - e.x, dz = tg.z - e.z, d = Math.hypot(dx, dz);
      if (d > 0.01) { const st = Math.min(d, 10 * dt); e.x += dx / d * st; e.z += dz / d * st; }
      if (d < tg.r && this.walkableAt(e.x, e.z)) {
        e.state = 'walk';
        e.bubble.visible = false;
        e.yawn = Math.min(e.yawn, e.st.maxYawn * 0.5);
        e.inv = 1;
        e.bubbleCd = 2;
        e.ch.squash(0.7);
        this.pushOut(e, PR);
        this.game.audio.play('pop');
      }
    } else if (e.state === 'nap') {
      e.napT += dt;
      if (e.napT >= (this.ents.length === 1 ? NAP_SOLO : NAP_MAX)) this.wake(e, null);
      else if (active) {
        const friend = this.ents.find((o) => o !== e && o.state === 'walk' && Math.hypot(o.x - e.x, o.z - e.z) < 1.1);
        if (friend) this.wake(e, friend);
      }
    } else {
      let mx = inp.x, mz = -inp.y;
      const len = Math.hypot(mx, mz);
      if (len > 1) { mx /= len; mz /= len; }
      if (len > 0.25) { const l = Math.hypot(mx, mz); e.fx = mx / l; e.fz = mz / l; }
      const sp = SPEED * e.st.speed * (e.boost > 0 ? 1.45 : 1) * (e.yawn > e.st.maxYawn * 0.66 ? 0.85 : 1);
      e.vx += (mx * sp - e.vx) * Math.min(1, dt * 14);
      e.vz += (mz * sp - e.vz) * Math.min(1, dt * 14);
      this.moveCircle(e, e.vx * dt, e.vz * dt, PR);
      moving = clamp(Math.hypot(e.vx, e.vz) / SPEED, 0, 1);
      if (active) {
        if (inp.cPressed) this.interact(e);
        else if (inp.bPressed && e.cdB <= 0) this.special(e);
        if (inp.a && e.cdA <= 0) this.mainAction(e);
      }
      if (e.calm > 3) e.yawn = Math.max(0, e.yawn - 0.03 * dt);
      if (e.boost > 0 && Math.random() < dt * 10) this.puffs.burst(new THREE.Vector3(e.x, 0.2, e.z), 0xffd23f, { count: 1, size: 0.18, life: 0.4, speed: 1 });
    }
    const ch = e.ch;
    if (Math.abs(e.fx) + Math.abs(e.fz) > 0.01) ch.face(e.fx, e.fz);
    let y = 0;
    if (e.state === 'bubble') y = 0.6 + Math.sin(this.time * 3 + e.i) * 0.15;
    else if (this.inStairs(e.x, e.z)) {
      const k = clamp(Math.floor((this.stairs.z1 - e.z) / ((this.stairs.z1 - this.stairs.z0) / 4)), 0, 3);
      y = -0.2 * (k + 1);
    }
    e.y += (y - e.y) * Math.min(1, dt * 12);
    ch.group.position.set(e.x, e.y, e.z);
    ch.pivot.rotation.x += ((e.state === 'nap' ? -1.35 : 0) - ch.pivot.rotation.x) * Math.min(1, dt * 8);
    ch.spin = e.spinT > 0 ? (1 - e.spinT / 0.4) * Math.PI * 2 : 0;
    e.hand.rotation.y = e.swingT > 0 ? e.swingDir * Math.sin((e.swingT / 0.22) * Math.PI) * 1.3 : 0;
    ch.group.visible = !(e.inv > 0 && e.state === 'walk' && Math.floor(this.time * 14) % 2 === 0);
    ch.update(dt, { moving });
    e.bubble.visible = e.state === 'bubble';
    if (e.bubble.visible) e.bubble.position.set(e.x, e.y + 0.65, e.z);
    e.keyMesh.visible = e.hasKey;
    if (e.hasKey) { e.keyMesh.position.set(e.x, e.y + 2.15, e.z); e.keyMesh.rotation.y += dt * 2.5; }
    e.ring.position.set(e.x, 0.05 + Math.max(0, e.y < 0 ? e.y : 0), e.z);
    e.ring.visible = e.state !== 'bubble';
    e.aimPivot.position.set(e.x, 0.12 + (e.y < 0 ? e.y : 0), e.z);
    e.aimPivot.rotation.y = Math.atan2(e.fx, e.fz);
    e.aimPivot.visible = e.state === 'walk' && this.state === 'play';
  }

  /** A soft nudge keeps beans from standing inside each other (no hard collisions). */
  separatePlayers() {
    const L = this.ents;
    for (let i = 0; i < L.length; i++) {
      for (let j = i + 1; j < L.length; j++) {
        const a = L[i], b = L[j];
        if (a.state === 'bubble' || b.state === 'bubble') continue;
        const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz), min = 0.8;
        if (d >= min) continue;
        const nx = d > 0.001 ? dx / d : 1, nz = d > 0.001 ? dz / d : 0, push = (min - d) * 0.25;
        a.x -= nx * push; a.z -= nz * push;
        b.x += nx * push; b.z += nz * push;
        this.pushOut(a, PR);
        this.pushOut(b, PR);
      }
    }
  }

  inStairs(x, z) {
    const s = this.stairs;
    return !this.fog && x > s.x0 && x < s.x1 && z > s.z0 && z < s.z1;
  }

  /** Stragglers who fall far behind (or run far ahead) float back to the group in a bubble. */
  updateStray() {
    if (this.ents.length < 2 || this.floatingAll) return;
    let worst = null, wf = 1;
    for (const e of this.ents) {
      if (e.state === 'bubble' || e.bubbleCd > 0) continue;
      const others = this.ents.filter((o) => o !== e && o.state !== 'bubble');
      if (!others.length) continue;
      const mx = others.reduce((a, o) => a + o.x, 0) / others.length;
      const mz = others.reduce((a, o) => a + o.z, 0) / others.length;
      const away = ((e.x - mx) * e.vx + (e.z - mz) * e.vz) > 0 ? 0.15 : 0;
      const f = Math.max(Math.abs(e.x - mx) / STRAY_X, Math.abs(e.z - mz) / STRAY_Z) + away;
      if (f > wf) { wf = f; worst = e; }
    }
    if (!worst) return;
    const e = worst;
    e.state = 'bubble';
    e.vx = e.vz = 0;
    e.bubbleTo = () => {
      let best = null, bd = Infinity;
      for (const o of this.ents) {
        if (o === e || o.state === 'bubble') continue;
        const d = Math.hypot(o.x - e.x, o.z - e.z);
        if (d < bd) { bd = d; best = o; }
      }
      return best ? { x: best.x, z: best.z, r: 1.6 } : { x: e.x, z: e.z, r: 99 };
    };
    this.game.audio.play('bubble');
  }

  /** Floor goal: everyone on the stairs. */
  updateStairs(dt, active) {
    if (!active) return;
    const n = this.ents.length;
    const on = this.ents.filter((e) => e.state !== 'bubble' && this.inStairs(e.x, e.z)).length;
    this.onStairs = on;
    if (on === n) { this.nextFloor(); return; }
    if (this.floatingAll && !this.ents.some((e) => e.state === 'bubble')) { this.floatingAll = false; this.stairsT = STAIRS_WAIT - 3; }
    if (on >= Math.ceil(n / 2) && on > 0) {
      this.stairsT += dt;
      if (this.stairsT > STAIRS_WAIT && !this.floatingAll) {
        this.floatingAll = true;
        this.game.ui.toast(t('keep.float'), 1800);
        this.ents.forEach((e, i) => {
          if (this.inStairs(e.x, e.z) && e.state !== 'nap') return;
          e.state = 'bubble';
          const a = (i / n) * Math.PI * 2;
          const tx = this.stairs.x + Math.sin(a) * 0.8, tz = this.stairs.z + Math.cos(a) * 0.8;
          e.bubbleTo = () => ({ x: tx, z: tz, r: 0.3 });
        });
        this.game.audio.play('bubble');
      }
    } else {
      this.stairsT = 0;
    }
  }

  nextFloor() {
    this.moving = true;
    this.floorTimes.push(this.floorT);
    this.game.audio.play('fanfare');
    this.confetti.burst(new THREE.Vector3(this.stairs.x, 1.5, this.stairs.z), 0, { count: 60, speed: 8, up: 5, colors: PLAYER_COLORS.map((c) => c.hex).concat(COLORS.gold), life: 1.3, size: 0.18 });
    if (this.floorIndex >= FLOORS - 1) {
      this.later(1.0, () => this.end());
      return;
    }
    this.game.ui.wipe();
    this.later(0.45, () => {
      this.loadFloor(this.floorIndex + 1);
      this.game.ui.banner(t('keep.floorTitle', { n: this.floorIndex + 1 }), t(`keep.name.${this.floorIndex}`), 1800);
      this.later(0.6, () => { this.moving = false; });
    });
  }

  end() {
    const total = this.floorTimes.reduce((a, b) => a + b, 0);
    const coins = this.ents.reduce((a, e) => a + e.coins, 0);
    const ranked = [...this.ents].sort((a, b) => b.coins - a.coins);
    const top = ranked[0].coins;
    this.totalTime = total;
    this.confettiOrigin = this.camCenter.clone().setY(2);
    this.finish({
      title: t('keep.title'),
      subtitle: `${t('keep.sub', { coins, time: clock(total), lv: this.teamLevel, naps: this.naps })} · ${this.floorTimes.map((s, i) => `${i + 1}: ${clock(s)}`).join(' · ')}`,
      rows: ranked.map((e) => ({
        css: e.p.css,
        name: e.p.name,
        value: e.coins === 1 ? t('keep.coin1') : t('keep.coins', { n: e.coins }),
        detail: `${t('keep.detail', { cls: `${t(`keep.cls.${e.cls}`)} ${t('keep.lv', { n: e.level })}`, fluffed: e.fluffed, nests: e.nests, woken: e.woken })}${e.best ? ` · ${itemName(e.best)}` : ''}`,
        crown: top > 0 && e.coins === top,
      })),
      stars: this.naps <= 3 + 2 * this.ents.length ? 3 : 2,
    });
  }

  /** Story campaign hook: 1 = the whole keep with hardly any naps, lower the more the team napped. */
  campaignStats() {
    const n = this.ents.length;
    const floors = this.floorTimes.length;
    const nap = clamp(1 - this.naps / (6 + 4 * n), 0.3, 1);
    return { team: (floors / FLOORS) * nap, floors, level: this.teamLevel, naps: this.naps, time: this.totalTime ?? 0, players: n };
  }

  // ---------- camera, lights, HUD ----------

  updateCamera(dt, snap = false) {
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    const pts = this.ents.map((e) => [e.x, e.z]);
    if (this.boss?.awake) pts.push([this.boss.x, this.boss.z]);
    for (const [x, z] of pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const d = clamp(this.fitDistance(x1 - x0 + 14, (z1 - z0 + 10) * Math.sin(TILT)), 23, 42);
    const k = snap ? 1 : Math.min(1, dt * 3);
    this.camCenter.x += (cx - this.camCenter.x) * k;
    this.camCenter.z += (cz - this.camCenter.z) * k;
    this.camDist += (d - this.camDist) * k;
    const c = this.camCenter;
    this.camera.position.set(c.x, Math.sin(TILT) * this.camDist, c.z + Math.cos(TILT) * this.camDist);
    this.camera.lookAt(c.x, 0, c.z - 0.6);
    this.sun.target.position.set(c.x, 0, c.z);
    this.sun.position.copy(this.sun.target.position).add(this.sunDir);
  }

  updateLamps(dt) {
    for (const tc of this.torches) tc.flame.scale.set(1, 1 + Math.sin(this.time * 11 + tc.phase) * 0.15 + Math.sin(this.time * 17 + tc.phase) * 0.08, 1);
    this.lampT -= dt;
    if (this.lampT > 0) return;
    this.lampT = 0.3;
    const c = this.camCenter;
    const near = [...this.torches].sort((a, b) => Math.hypot(a.x - c.x, a.z - c.z) - Math.hypot(b.x - c.x, b.z - c.z));
    this.lamps.forEach((pl, i) => {
      const tc = near[i];
      pl.intensity = tc ? 4 : 0;
      if (tc) pl.position.set(tc.x, 1.6, tc.z);
    });
  }

  promptFor(e) {
    if (e.state !== 'walk' || this.state !== 'play') return '';
    if (this.ents.some((o) => o !== e && o.state === 'nap' && Math.hypot(o.x - e.x, o.z - e.z) < 2.2)) return t('keep.c.wake');
    if (e.hasKey && this.doorNear(e, 1.3)) return t('keep.c.unlock');
    if (this.chestNear(e, 2)) return t('keep.c.open');
    return '';
  }

  updateLabels() {
    const show = this.state === 'play' || this.state === 'intro';
    const v = new THREE.Vector3();
    for (const e of this.ents) {
      let html = '';
      if (show) {
        const prompt = this.promptFor(e);
        if (prompt) html += `<small style="color:#2b2340">${esc(prompt)}</small>`;
        if (e.state === 'nap') html += `<span style="color:#8a45e0">Zzz</span>`;
        else if (e.yawn >= 0.05) {
          const n = Math.min(5, Math.ceil(e.yawn / e.st.maxYawn * 5 - 0.001));
          html += `<span style="color:#9b5de5">${'●'.repeat(n)}</span><span style="color:#d6cfe6">${'●'.repeat(5 - n)}</span>`;
        }
      }
      if (html !== e.labelHtml) { e.label.innerHTML = html; e.labelHtml = html; }
      if (!html) { e.label.style.display = 'none'; continue; }
      v.set(e.x, e.y + (e.state === 'nap' ? 1.0 : e.hasKey ? 2.65 : 1.95), e.z);
      this.game.ui.place(e.label, v, this.camera);
    }
  }

  /** The boss health bar: name, phase and notches where the next phases start. */
  bossBar() {
    const b = this.boss;
    const pct = Math.round(b.pct * 100);
    const notches = b.phases.map((p) => `<span style="position:absolute;left:${p * 100}%;top:-2px;bottom:-2px;width:3px;background:#2b2340"></span>`).join('');
    const phase = b.phases.length ? ` <small style="opacity:.7">${esc(t('keep.phase', { n: b.phase + 1, m: b.phases.length + 1 }))}</small>` : '';
    return `<div class="pill" style="flex-direction:column;gap:3px;padding:6px 22px"><div><b>${esc(t(b.nameKey))}</b>${phase}</div>`
      + `<span style="position:relative;display:block;width:clamp(180px,26vw,420px);height:.8em;border-radius:1em;background:#e6defa;border:2px solid #2b2340"><span style="display:block;height:100%;width:${pct}%;border-radius:1em;background:linear-gradient(#c78bff,#8a45e0)"></span>${notches}</span></div>`;
  }

  goalText() {
    if (this.onStairs > 0) return esc(t('keep.waiting', { n: this.onStairs, total: this.ents.length }));
    const closed = this.doors.some((d) => !d.open);
    if (closed) {
      if (this.ents.some((e) => e.hasKey)) return esc(t('keep.goal.door'));
      return esc(t('keep.goal.key'));
    }
    if (this.fog) return esc(t('keep.goal.boss'));
    return esc(t('keep.goal.stairs'));
  }

  updateHud() {
    if (this.state !== 'play' && this.state !== 'intro') return;
    const coins = this.ents.reduce((a, e) => a + e.coins, 0);
    const xpPct = Math.round(this.xp / xpNeed(this.teamLevel) * 100);
    const lv = `<div class="pill"><b>${esc(t('keep.lv', { n: this.teamLevel }))}</b><span style="display:inline-block;width:4.5em;height:.55em;border-radius:1em;background:#e6defa;overflow:hidden"><span style="display:block;height:100%;width:${xpPct}%;background:#ffb400"></span></span></div>`;
    const b = this.boss;
    const goal = b && b.state !== 'idle' && !b.gone ? this.bossBar() : `<div class="pill">${this.goalText()}</div>`;
    this.game.ui.setTop(`<div class="pill"><b>${esc(t('keep.floor', { n: this.floorIndex + 1, total: FLOORS }))}</b></div>`
      + `${lv}<div class="pill">${COIN} <b>${coins}</b></div><div class="pill">${clock(this.floorT)}</div>${goal}`);
    this.game.ui.bar(this.players, (p) => {
      const e = this.ents.find((x) => x.p === p);
      return e ? `${GLYPH[e.cls]} ${esc(t('keep.lv', { n: e.level }))} · ${COIN} ${e.coins}` : '';
    });
  }

  update(dt) {
    if (this.state === 'pick') this.picker?.update(dt);
    const active = this.state === 'play' && !this.moving;
    this.toastCd -= dt;
    if (active) this.floorT += dt;
    if (active) {
      this.flowT -= dt;
      if (this.flowT <= 0) { this.flowT = 0.25; this.updateFlow(); }
    }
    for (const e of this.ents) this.updateEnt(e, dt, active);
    this.separatePlayers();
    if (active) this.updateStray();
    this.updateNests(dt, active);
    this.updateGrumbles(dt, active);
    this.updateShots(dt);
    this.updateItems(dt, active);
    this.updateDoorsAndChests(dt, active);
    if (this.boss && !this.boss.gone) this.boss.update(dt, active);
    this.hazards.update(dt, active);
    this.updateFx(dt);
    this.updateStairs(dt, active);
    if (this.stairsArrow) {
      this.stairsArrow.visible = !this.fog;
      this.stairsArrow.position.y = 3 + Math.sin(this.time * 3) * 0.3;
      this.stairsArrow.rotation.y += dt * 1.5;
    }
    this.updateCamera(dt);
    this.updateLamps(dt);
    this.updateLabels();
    this.updateFloaters(dt);
    if (this.updateResults(dt)) return;
    this.updateHud();
  }
}

Object.assign(KeepScene.prototype, FoeMixin, LootMixin);
