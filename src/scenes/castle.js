import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { MiniGame } from '../core/minigame.js';
import { Character } from '../core/character.js';
import { makeGrumble } from '../core/critters.js';
import { COLORS, toon, basic, sharedGeo } from '../core/palette.js';
import { addLights, skyTexture, makeCloud, makeTree, makeBush, makeStar, seeded } from '../core/world.js';
import { moveBody, platformerControl, approach } from '../core/physics2d.js';
import { t, addStrings } from '../core/i18n.js';
import { esc } from '../core/ui.js';
import { TeamPicker, TEAM_COLORS, TEAM_CSS, helpersNeeded } from '../core/teams.js';
import { voteLength } from '../core/vote.js';

addStrings({
  en: {
    'game.castle': 'Knights & Builders',
    'castle.intro': "Grab the other team's flag and carry it to yours! A: jump and climb · B: class action · C: next piece / shield / rope arrow",
    'castle.bot': 'Grumble Guard',
    'castle.pick': 'Pick a class',
    'castle.pickHint': 'Stick left/right to choose · jump when ready',
    'castle.cls.builder': 'Builder', 'castle.cls.knight': 'Knight', 'castle.cls.archer': 'Archer',
    'castle.desc.builder': 'B: build where you aim · hold B on a block to take it down · C: next piece',
    'castle.desc.knight': 'B: foam sword, hold for a big slash · C: shield (glides in the air)',
    'castle.desc.archer': 'Hold B to draw, let go to shoot · C: rope arrow to climb up',
    'castle.build': 'Build', 'castle.battle': 'Battle',
    'castle.buildGo': 'Build time! Everyone can build',
    'castle.battleGo': 'The wall is gone. Grab their flag!',
    'castle.took': '{name} has the flag!',
    'castle.capture': '{name} scored for {team}!',
    'castle.dropped': 'The flag fell!',
    'castle.returned': 'The {team} flag is home',
    'castle.bonk': 'BONK!', 'castle.blocked': 'BLOCK!',
    'castle.piece.block': 'Wood block', 'castle.piece.door': 'Team door', 'castle.piece.ladder': 'Ladder', 'castle.piece.pad': 'Bounce pad',
    'castle.wood': '{n} wood', 'castle.arrows': '{n} arrows',
    'castle.caps': '{n} captures', 'castle.cap1': '1 capture',
    'castle.bonks': '{n} bonks', 'castle.bonk1': '1 bonk',
    'castle.built': '{n} built',
    'castle.noWood': 'Out of wood!', 'castle.noArrows': 'No arrows!',
  },
  no: {
    'game.castle': 'Riddere og byggere',
    'castle.intro': 'Ta flagget til det andre laget og bær det til deres eget! A: hopp og klatre · B: klassehandling · C: neste brikke / skjold / taupil',
    'castle.bot': 'Grumlevakt',
    'castle.pick': 'Velg klasse',
    'castle.pickHint': 'Pinnen venstre/høyre for å velge · hopp når du er klar',
    'castle.cls.builder': 'Bygger', 'castle.cls.knight': 'Ridder', 'castle.cls.archer': 'Bueskytter',
    'castle.desc.builder': 'B: bygg der du sikter · hold B på en kloss for å ta den ned · C: neste brikke',
    'castle.desc.knight': 'B: skumsverd, hold for et stort slag · C: skjold (svever i lufta)',
    'castle.desc.archer': 'Hold B for å spenne, slipp for å skyte · C: taupil å klatre opp i',
    'castle.build': 'Bygg', 'castle.battle': 'Kamp',
    'castle.buildGo': 'Byggetid! Alle kan bygge',
    'castle.battleGo': 'Muren er borte. Ta flagget deres!',
    'castle.took': '{name} har flagget!',
    'castle.capture': '{name} scoret for {team}!',
    'castle.dropped': 'Flagget falt!',
    'castle.returned': 'Flagget til {team} er hjemme',
    'castle.bonk': 'BONK!', 'castle.blocked': 'BLOKKERT!',
    'castle.piece.block': 'Trekloss', 'castle.piece.door': 'Lagdør', 'castle.piece.ladder': 'Stige', 'castle.piece.pad': 'Sprettpute',
    'castle.wood': '{n} planker', 'castle.arrows': '{n} piler',
    'castle.caps': '{n} flagg tatt', 'castle.cap1': '1 flagg tatt',
    'castle.bonks': '{n} bonk', 'castle.bonk1': '1 bonk',
    'castle.built': '{n} bygget',
    'castle.noWood': 'Tom for planker!', 'castle.noArrows': 'Ingen piler!',
  },
});

// Knights & Builders: a couch take on King Arthur's Gold, kid-friendly and non-violent.
// Side view of a 56 x 24 tile map with destructible terrain. Each team starts in a small stone
// fort with its flag. First a 45 s build phase behind a magic wall, then the battle: walk into
// the other flag and carry it to your own to score. Foam swords and suction-cup arrows only push
// and wobble; three hits (or one big slash) and you float home in a bubble for a moment.

const COLS = 56, ROWS = 24;
const X0 = -COLS / 2; // world x of column 0
const G = 7; // ground level at the forts (players stand at y = 7)
const MID = [27, 28]; // columns of the build-phase wall
const BUILD_TIME = 45;
const BUBBLE_TIME = 3;
const FLAG_RETURN = 10;
const MAX_HITS = 3;
const HIT_RESET = 5; // hits are forgotten after this long without a new one
const CHARGE_FULL = 0.75;
const DRAW_FULL = 0.7;
const BW = 0.78, BH = 1.35; // body size: two tiles of headroom needed
const BEAN_SCALE = 1.15;
const WOOD_START = 20, WOOD_MAX = 30;
const ARROWS_START = 8, ARROWS_MAX = 12;
const FLAG_COL = 4;
const SPAWN_COLS = [2, 3, 5, 6, 7];

const PHYS = { speed: 6.2, accel: 60, airAccel: 40, jump: 14.5, jump2: 0, doubleJump: false, gravity: 38, fallMul: 1.6, coyote: 0.1, buffer: 0.14, maxFall: -20 };
const PHYS_SLOW = { ...PHYS, speed: 3.4 };
const PHYS_CARRY = { ...PHYS, speed: 5.5 };
const PHYS_BOT = { ...PHYS, speed: 4.4 };

// Tile types.
const EMPTY = 0, DIRT = 1, STONE = 2, CASTLE = 3, WOOD = 4, DOOR = 5, LADDER = 6, PAD = 7, BEDROCK = 8, BARRIER = 9, BASE = 10;
const BLOCKY = new Set([DIRT, STONE, CASTLE, WOOD, BEDROCK, BASE]);
const DIG_TIME = { [DIRT]: 0.45, [STONE]: 1.6, [CASTLE]: 2.2, [WOOD]: 0.4, [DOOR]: 0.55, [LADDER]: 0.25, [PAD]: 0.4 };
const KNIGHT_HP = { [WOOD]: 3, [DOOR]: 4, [LADDER]: 1, [PAD]: 2 }; // sword hits to break enemy pieces
const REFUND = { [WOOD]: 1, [DOOR]: 2, [LADDER]: 1, [PAD]: 2 };
const STICKY = new Set([DIRT, WOOD, DOOR, PAD]); // arrows stick here and bounce off stone
const TILE_COLOR = { [DIRT]: 0xd99a62, [STONE]: 0xaaa4c6, [CASTLE]: 0xd6cfe6, [WOOD]: 0xe2a96b, [BEDROCK]: 0x6f6789, [BASE]: 0xffd23f };
const PIECES = [
  { key: 'block', tile: WOOD, cost: 1 },
  { key: 'door', tile: DOOR, cost: 2 },
  { key: 'ladder', tile: LADDER, cost: 1 },
  { key: 'pad', tile: PAD, cost: 2 },
];
const CLASSES = ['builder', 'knight', 'archer'];
const BLADE = [0xffe47a, 0x8fd8ff]; // foam sword colors per team
const GLYPH = { builder: '⚒', knight: '⚔', archer: '➶' };

const idx = (c, r) => c * ROWS + r;
const colOf = (x) => Math.floor(x - X0);
const cellX = (c) => c + X0;
const clamp = THREE.MathUtils.clamp;
const mirror = (c) => COLS - 1 - c;
const NO_INPUT = { x: 0, y: 0, a: false, b: false, c: false, aPressed: false, bPressed: false, cPressed: false };

function mesh(geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
}

function box(w, h, d, x = 0, y = 0, z = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  return g;
}

const clock = (s) => {
  const secs = Math.max(0, Math.ceil(s));
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
};

/** Second picker after the teams: every player picks Builder, Knight or Archer. */
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
        return `<div class="ball-pick ${ok ? 'done' : ''}" style="--c:${e.css}"><span style="color:${ok ? '#fff' : TEAM_CSS[e.team]}">●</span> ${esc(e.name)}${ok ? ' ✓' : ''}</div>`;
      }).join('');
      return `<div class="vote-opt" style="width:clamp(140px,22vw,280px)"><div class="vote-label">${GLYPH[cls]} ${esc(t(`castle.cls.${cls}`))}</div>
        <div style="font-size:clamp(11px,1vw,16px);font-weight:600;text-align:center;opacity:.75;margin-bottom:6px">${esc(t(`castle.desc.${cls}`))}</div>${chips}</div>`;
    }).join('');
    this.el.innerHTML = `<div class="results-title">${esc(t('game.castle'))}</div>
      <div class="results-sub">${esc(t('castle.pick'))}</div>
      <div class="vote-row">${cols}</div>
      <div class="results-footer">${esc(t('castle.pickHint'))}</div>`;
  }

  update(dt = 1 / 60) {
    if (this.done) return;
    const { scene } = this;
    this.time += dt;
    let changed = false;
    for (const e of this.ents) {
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
    if ([...this.locked.values()].every(Boolean) || this.time > 30) {
      this.done = true;
      this.el.remove();
      this.onDone();
    }
  }
}

export class CastleScene extends MiniGame {
  constructor(game, opts) {
    super(game, opts);
    this.scene.background = skyTexture('#7fcfff', '#fff3d9');
    addLights(this.scene, { size: 34, target: new THREE.Vector3(0, 10, 0), dir: new THREE.Vector3(-0.45, 0.85, 1) });

    this.score = [0, 0];
    this.phase = 'build';
    this.buildLeft = BUILD_TIME;
    this.timeLeft = 150;
    this.arrows = [];
    this.floaters = [];
    this.clouds = [];
    this.shake = 0;
    this.tilesDirty = true;
    this.doorKey = '';

    this.buildMap();
    this.buildLayers();
    this.buildScenery();
    this.flags = [0, 1].map((team) => this.makeFlag(team));

    this.ents = this.players.map((p, i) => this.makeEnt(p, i % 2));
    this.defaultClasses();
    this.frame();
    this.rebuildTiles();
    game.audio.playMusic('platformer');

    this.state = 'teams';
    const teams = () => { this.picker = new TeamPicker(this, {
      title: () => t('game.castle'),
      ents: this.ents,
      setTeam: (e, team) => this.setTeam(e, team),
      onChange: () => { this.defaultClasses(); this.placeEnts(); },
      onDone: () => {
        helpersNeeded(this.ents).forEach((need, team) => {
          for (let i = 0; i < need; i++) this.ents.push(this.makeEnt(null, team, i));
        });
        this.placeEnts();
        this.picker = new ClassPicker(this, this.ents.filter((e) => !e.bot), () => {
          this.picker = null;
          this.intro(t('game.castle'), t('castle.intro'));
        });
      },
    }); };
    voteLength(this, opts, () => t('game.castle'), teams);
    this.placeEnts();
  }

  retryOptions() {
    return { key: this.key, length: this.matchTime };
  }

  onLanguage() {
    this.picker?.render();
  }

  onStart() {
    this.phase = 'build';
    this.buildLeft = BUILD_TIME;
    this.game.ui.toast(t('castle.buildGo'), 2400);
  }

  frame() {
    const d = this.fitDistance(COLS + 1.2, ROWS + 5);
    this.camBase = new THREE.Vector3(0, ROWS / 2 + 0.2, d);
    this.camera.position.copy(this.camBase);
    this.camera.lookAt(0, ROWS / 2 + 0.2, 0);
    this.confettiOrigin = new THREE.Vector3(0, 14, 0);
  }

  resize(w, h) {
    super.resize(w, h);
    this.frame();
  }

  // ---------- the tile map ----------

  tileAt(c, r) {
    if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return BEDROCK;
    return this.tile[idx(c, r)];
  }

  /** Is this cell solid for a body (or arrow) of `team`? Doors only let their own team through. */
  solidFor(c, r, team) {
    const ty = this.tileAt(c, r);
    if (ty === EMPTY || ty === LADDER) return false;
    if (ty === DOOR) return this.owner[idx(c, r)] !== team;
    return true;
  }

  isSolidAt(x, y, team = -2) {
    return this.solidFor(colOf(x), Math.floor(y), team);
  }

  setTile(c, r, ty, team = -1) {
    if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return;
    const i = idx(c, r);
    this.tile[i] = ty;
    this.owner[i] = team;
    this.dmg[i] = 0;
    this.tilesDirty = true;
  }

  /** Set a cell for team 0 and its mirror image for team 1. */
  setBoth(c, r, ty) {
    this.setTile(c, r, ty, 0);
    this.setTile(mirror(c), r, ty, 1);
  }

  buildMap() {
    const N = COLS * ROWS;
    this.tile = new Uint8Array(N);
    this.owner = new Int8Array(N).fill(-1);
    this.dmg = new Float32Array(N);
    this.shade = new Float32Array(N);
    const rand = seeded(57);
    for (let i = 0; i < N; i++) this.shade[i] = 0.93 + rand() * 0.1;

    // Rolling hills between the forts (left half; the right half mirrors it).
    const HILL = [7, 7, 7, 8, 8, 9, 9, 9, 8, 8, 7, 7, 8, 8, 9, 9, 10, 10];
    this.surface = new Array(COLS).fill(G);
    for (let c = 0; c < COLS / 2; c++) {
      const h = c < 10 ? G : HILL[c - 10];
      this.surface[c] = h;
      this.surface[mirror(c)] = h;
    }
    for (let c = 0; c < COLS / 2; c++) {
      const h = this.surface[c];
      for (let r = 0; r < h; r++) {
        let ty = r === 0 ? BEDROCK : DIRT;
        // Stone veins underground, and a few boulders near the surface.
        if (ty === DIRT && r >= 2 && r <= h - 3 && (c * 7 + r * 13) % 11 === 0) ty = STONE;
        if (ty === DIRT && r >= 2 && r <= h - 3 && (c * 5 + r * 3) % 17 === 0) ty = STONE;
        this.setBoth(c, r, ty);
        this.owner[idx(c, r)] = -1;
        this.owner[idx(mirror(c), r)] = -1;
      }
    }
    // A little stone rock on each hilltop.
    for (const [c, r] of [[16, 9], [17, 9], [24, 9]]) {
      this.setBoth(c, r, STONE);
      this.owner[idx(c, r)] = -1;
      this.owner[idx(mirror(c), r)] = -1;
    }

    // The forts: stone floor, two walls, a roof with a ladder hatch and battlements.
    for (let c = 0; c <= 9; c++) this.setBoth(c, G - 1, CASTLE);
    this.setBoth(FLAG_COL, G - 1, BASE);
    for (let r = G; r <= G + 5; r++) {
      this.setBoth(0, r, CASTLE);
      this.setBoth(9, r, CASTLE);
    }
    this.setBoth(9, G, DOOR);
    this.setBoth(9, G + 1, DOOR);
    this.setBoth(9, G + 3, EMPTY); // archer window
    for (let c = 0; c <= 9; c++) this.setBoth(c, G + 6, CASTLE);
    for (let r = G; r <= G + 6; r++) this.setBoth(1, r, LADDER);
    for (const c of [0, 3, 6, 9]) this.setBoth(c, G + 7, CASTLE);

    // The build-phase wall reaches from the bedrock to the sky.
    for (const c of MID) for (let r = 1; r < ROWS; r++) this.setTile(c, r, BARRIER, -1);
    this.flagCells = new Set();
    for (const team of [0, 1]) {
      const c = team ? mirror(FLAG_COL) : FLAG_COL;
      this.flagCells.add(idx(c, G));
      this.flagCells.add(idx(c, G + 1));
    }
  }

  /** Remove the magic wall: dirt below the hill line, air above. */
  openWall() {
    for (const c of MID) {
      for (let r = 1; r < ROWS; r++) this.setTile(c, r, r < this.surface[c] ? DIRT : EMPTY, -1);
    }
    this.barrier.visible = false;
    for (let y = 1; y < ROWS; y += 1.5) this.puffs.burst(new THREE.Vector3(0, y, 0.5), 0xc9a8ff, { count: 4, size: 0.5, life: 0.7 });
  }

  // ---------- tile rendering (instanced) ----------

  buildLayers() {
    const N = COLS * ROWS;
    this.tileMat = new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: toon(0xffffff).gradientMap });
    const inst = (geo) => {
      const m = new THREE.InstancedMesh(geo, this.tileMat, N);
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(N * 3).fill(1), 3);
      m.count = 0;
      m.castShadow = m.receiveShadow = true;
      m.frustumCulled = false;
      this.scene.add(m);
      return m;
    };
    this.layers = {
      block: inst(new RoundedBoxGeometry(1, 1, 1.6, 2, 0.07)),
      grass: inst(new RoundedBoxGeometry(1.03, 0.26, 1.72, 2, 0.08)),
      plank: inst(mergeGeometries([box(0.88, 0.05, 0.04, 0, 0.17, 0.81), box(0.88, 0.05, 0.04, 0, -0.17, 0.81), box(0.1, 0.1, 0.04, -0.32, 0.33, 0.82), box(0.1, 0.1, 0.04, 0.32, -0.33, 0.82)])),
      doorFrame: inst(mergeGeometries([box(0.13, 1, 0.8, -0.44, 0, 0), box(0.13, 1, 0.8, 0.44, 0, 0)])),
      doorPanel: inst(mergeGeometries([box(0.76, 0.98, 0.34), box(0.8, 0.1, 0.42, 0, 0.22, 0), box(0.8, 0.1, 0.42, 0, -0.22, 0)])),
      ladder: inst(mergeGeometries([box(0.08, 1, 0.08, -0.32, 0, -0.45), box(0.08, 1, 0.08, 0.32, 0, -0.45), box(0.64, 0.07, 0.07, 0, -0.25, -0.45), box(0.64, 0.07, 0.07, 0, 0.25, -0.45)])),
      padBase: inst(mergeGeometries([box(0.96, 0.36, 1.3, 0, -0.32, 0), box(0.12, 0.3, 0.12, -0.3, -0.02, 0.4), box(0.12, 0.3, 0.12, 0.3, -0.02, 0.4)])),
      padTop: inst(new RoundedBoxGeometry(0.94, 0.3, 1.3, 2, 0.12)),
    };

    // Static backdrop behind the terrain: darker dirt underground, castle walls inside the forts.
    const back = [];
    for (let c = 0; c < COLS; c++) {
      for (let r = 0; r < this.surface[c]; r++) back.push([c, r, 0x9c6a43]);
    }
    for (const team of [0, 1]) {
      for (let c = 1; c <= 8; c++) for (let r = G; r <= G + 5; r++) back.push([team ? mirror(c) : c, r, 0xa69fbd]);
    }
    const bm = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), this.tileMat, back.length);
    const m4 = new THREE.Matrix4(), col = new THREE.Color();
    back.forEach(([c, r, hex], i) => {
      m4.makeTranslation(cellX(c) + 0.5, r + 0.5, -0.82);
      bm.setMatrixAt(i, m4);
      bm.setColorAt(i, col.setHex(hex).multiplyScalar(this.shade[idx(c, r)]));
    });
    bm.receiveShadow = true;
    this.scene.add(bm);

    // The magic wall of the build phase.
    const bmat = toon(0xc9a8ff).clone();
    bmat.userData = {};
    bmat.transparent = true;
    bmat.opacity = 0.45;
    this.barrier = mesh(new THREE.BoxGeometry(2, ROWS - 1, 1.9), bmat, cellX(MID[0]) + 1, (ROWS - 1) / 2 + 1, 0);
    this.scene.add(this.barrier);
  }

  rebuildTiles() {
    const L = this.layers;
    for (const k in L) L[k].count = 0;
    const m4 = this._m4 || (this._m4 = new THREE.Matrix4());
    const col = this._col || (this._col = new THREE.Color());
    const put = (layer, x, y, hex, shade = 1, sx = 1, ox = 0) => {
      const n = layer.count++;
      m4.makeScale(sx, 1, 1).setPosition(x + ox, y, 0);
      layer.setMatrixAt(n, m4);
      layer.setColorAt(n, col.setHex(hex).multiplyScalar(shade));
    };
    for (let c = 0; c < COLS; c++) {
      for (let r = 0; r < ROWS; r++) {
        const i = idx(c, r), ty = this.tile[i];
        if (ty === EMPTY || ty === BARRIER) continue;
        const x = cellX(c) + 0.5, y = r + 0.5;
        const shade = this.shade[i] * (1 - 0.45 * this.dmg[i]);
        if (BLOCKY.has(ty)) {
          put(L.block, x, y, TILE_COLOR[ty], shade);
          if (ty === DIRT) {
            const above = this.tileAt(c, r + 1);
            if (!(BLOCKY.has(above) || above === PAD || above === BARRIER) || r + 1 >= ROWS) put(L.grass, x, r + 0.9, 0x7ad65a, shade);
          }
          if (ty === WOOD) put(L.plank, x, y, this.owner[i] === 1 ? 0x2f7fa8 : this.owner[i] === 0 ? 0xb07a12 : 0x9a6a3a, 1);
        } else if (ty === DOOR) {
          const open = this.openDoors?.has(i);
          put(L.doorFrame, x, y, 0x9a6a3a, shade);
          put(L.doorPanel, x, y, TEAM_COLORS[this.owner[i]] ?? 0xe2a96b, shade, open ? 0.18 : 1, open ? -0.33 : 0);
        } else if (ty === LADDER) {
          put(L.ladder, x, y, 0xc98b5a, shade);
        } else if (ty === PAD) {
          put(L.padBase, x, y, 0x9a94b2, shade);
          put(L.padTop, x, y + 0.12, 0xff7eb6, shade);
        }
      }
    }
    for (const k in L) {
      L[k].instanceMatrix.needsUpdate = true;
      L[k].instanceColor.needsUpdate = true;
    }
    this.tilesDirty = false;
  }

  /** Doors swing open while a teammate stands in them. */
  updateDoors() {
    const open = new Set();
    for (const e of this.ents) {
      if (e.state !== 'play') continue;
      const b = e.body;
      for (let c = colOf(b.x - BW / 2); c <= colOf(b.x + BW / 2); c++) {
        for (let r = Math.floor(b.y); r <= Math.floor(b.y + BH); r++) {
          if (this.tileAt(c, r) === DOOR && c >= 0 && c < COLS && r < ROWS) open.add(idx(c, r));
        }
      }
    }
    const key = [...open].sort().join(',');
    if (key !== this.doorKey) {
      this.doorKey = key;
      this.openDoors = open;
      this.tilesDirty = true;
    }
  }

  // ---------- scenery ----------

  buildScenery() {
    const s = this.scene;
    const rand = seeded(91);
    // Bedrock under the map and grassy ground beyond its edges.
    const under = mesh(new THREE.BoxGeometry(COLS + 30, 8, 3), toon(0x8a5a3a), 0, -4, -0.2);
    s.add(under);
    for (const sx of [-1, 1]) {
      const side = mesh(new THREE.BoxGeometry(14, G, 1.6), toon(COLORS.dirt), sx * (COLS / 2 + 7), G / 2, 0);
      const top = mesh(new THREE.BoxGeometry(14, 0.26, 1.72), toon(COLORS.grass), sx * (COLS / 2 + 7), G - 0.1, 0);
      s.add(side, top);
    }
    // Far mountains and soft green hills.
    for (let i = 0; i < 9; i++) {
      const x = -70 + i * 17 + rand() * 6;
      const h = 14 + rand() * 10;
      const m = mesh(sharedGeo('kbMount', () => new THREE.ConeGeometry(1, 1, 7)), toon(i % 2 ? 0xa9b8e8 : 0x9aaee0), x, 2 + h / 2, -70);
      m.scale.set(12 + rand() * 6, h, 8);
      const cap = mesh(sharedGeo('kbMount', () => new THREE.ConeGeometry(1, 1, 7)), toon(COLORS.white), x, 2 + h - h * 0.15, -69.5);
      cap.scale.set((12 + rand() * 6) * 0.3, h * 0.3, 3);
      s.add(m, cap);
    }
    const hillGeo = sharedGeo('kbHill', () => new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2));
    for (let i = 0; i < 12; i++) {
      const hill = mesh(hillGeo, toon(i % 2 ? 0x8fdc6a : 0x6fcb57), -60 + i * 11 + rand() * 5, G - 1.5, -30 - rand() * 12);
      const r = 9 + rand() * 7;
      hill.scale.set(r, r * (0.45 + rand() * 0.3), 6);
      s.add(hill);
    }
    for (let i = 0; i < 16; i++) {
      const tr = makeTree(rand, 1.6 + rand(), [0x58b947, 0x4cc46a, 0x7ad65a]);
      tr.position.set(-44 + i * 6 + rand() * 3, G + 1 + rand() * 2, -24 - rand() * 4);
      s.add(tr);
    }
    // Trees and bushes just behind the battlefield.
    for (const c of [13, 21, 34, 42]) {
      const tr = makeTree(rand, 1 + rand() * 0.25, [0x58b947, 0x4cc46a, 0x7ad65a]);
      tr.position.set(cellX(c) + 0.5, this.surface[c], -1.7);
      s.add(tr);
    }
    for (const c of [11, 18, 24, 31, 37, 44]) {
      const b = makeBush(rand, 0.8 + rand() * 0.3);
      b.position.set(cellX(c) + 0.5, this.surface[c], -1.1);
      s.add(b);
    }
    for (let i = 0; i < 7; i++) {
      const cl = makeCloud(rand, 1.6 + rand() * 1.2);
      cl.position.set(-40 + i * 13 + rand() * 5, 18 + rand() * 5, -16 - rand() * 6);
      s.add(cl);
      this.clouds.push(cl);
    }
    // Fort banners: tall poles behind each fort and hanging cloths inside.
    for (const team of [0, 1]) {
      const col = TEAM_COLORS[team];
      for (const c of [0, 9]) {
        const cc = team ? mirror(c) : c;
        const x = cellX(cc) + 0.5;
        s.add(mesh(sharedGeo('kbBPole', () => new THREE.CylinderGeometry(0.07, 0.07, 4.2, 6)), toon(COLORS.trunk), x, G + 8.6, -1.2));
        const cloth = mesh(sharedGeo('kbBCloth', () => new THREE.BoxGeometry(1.3, 0.75, 0.05)), toon(col), x + (team ? -0.7 : 0.7), G + 10.2, -1.2);
        cloth.userData.wave = rand() * 6;
        s.add(cloth);
        (this.banners ||= []).push(cloth);
      }
      for (const c of [2, 7]) {
        const cc = team ? mirror(c) : c;
        const x = cellX(cc) + 0.5;
        const hang = mesh(sharedGeo('kbHang', () => new THREE.BoxGeometry(0.8, 1.6, 0.04)), toon(col), x, G + 4.2, -0.78);
        const tip = mesh(sharedGeo('kbHangTip', () => new THREE.ConeGeometry(0.4, 0.4, 3)), toon(col), x, G + 3.25, -0.78);
        tip.rotation.z = Math.PI;
        const star = makeStar(COLORS.white);
        star.scale.setScalar(0.55);
        star.position.set(x, G + 4.4, -0.74);
        const rod = mesh(sharedGeo('kbHangRod', () => new THREE.CylinderGeometry(0.04, 0.04, 1.1, 6)), toon(COLORS.gold), x, G + 5.02, -0.76);
        rod.rotation.z = Math.PI / 2;
        s.add(hang, tip, star, rod);
      }
      // Flag pedestal.
      const fx = cellX(team ? mirror(FLAG_COL) : FLAG_COL) + 0.5;
      s.add(mesh(sharedGeo('kbPed', () => new THREE.CylinderGeometry(0.42, 0.5, 0.22, 16)), toon(col), fx, G + 0.11, 0));
    }
  }

  makeFlag(team) {
    const g = new THREE.Group();
    g.add(mesh(sharedGeo('kbFPole', () => new THREE.CylinderGeometry(0.05, 0.05, 2.2, 8)), toon(COLORS.icing), 0, 1.1, 0));
    g.add(mesh(sharedGeo('kbFKnob', () => new THREE.SphereGeometry(0.11, 10, 8)), toon(COLORS.gold), 0, 2.25, 0));
    const cloth = new THREE.Group();
    cloth.position.set(0, 1.85, 0);
    cloth.add(mesh(sharedGeo('kbFCloth', () => new RoundedBoxGeometry(0.95, 0.62, 0.06, 2, 0.03)), toon(TEAM_COLORS[team]), 0.5, 0, 0));
    const star = makeStar(COLORS.white);
    star.scale.setScalar(0.42);
    star.position.set(0.5, 0, 0.05);
    cloth.add(star);
    g.add(cloth);
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.scene.add(g);
    const c = team ? mirror(FLAG_COL) : FLAG_COL;
    const f = { team, group: g, cloth, homeX: cellX(c) + 0.5, homeY: G, x: 0, y: 0, vy: 0, state: 'home', carrier: null, dropT: 0 };
    f.x = f.homeX; f.y = f.homeY;
    return f;
  }

  // ---------- players and helper bots ----------

  makeEnt(p, team, slot = 0) {
    let ch;
    if (p) {
      ch = new Character(p.color, { hat: p.hat });
      ch.group.scale.setScalar(BEAN_SCALE);
    } else {
      const group = new THREE.Group();
      const pivot = new THREE.Group();
      group.add(pivot);
      const critter = makeGrumble(TEAM_COLORS[team]);
      critter.scale.setScalar(1.25);
      pivot.add(critter);
      ch = { group, pivot, critter, sq: 1, squash(a) { this.sq = a; } };
    }
    this.scene.add(ch.group);
    const bubble = mesh(sharedGeo('kbBubble', () => new THREE.SphereGeometry(0.95, 22, 16)), toon(p ? p.color : TEAM_COLORS[team], { transparent: true, opacity: 0.35 }));
    bubble.visible = false;
    this.scene.add(bubble);

    const e = {
      p, bot: !p, ch, bubble, team, slot, cls: 'knight',
      css: p ? p.css : TEAM_CSS[team],
      get name() { return p ? p.name : t('castle.bot'); },
      body: { x: 0, y: G, w: BW, h: BH, vx: 0, vy: 0, grounded: true },
      facing: team ? -1 : 1, aimX: team ? -1 : 1, aimY: 0,
      state: 'play', bub: null, invuln: 0, hits: 0, hitT: 0, wobble: 0,
      wood: WOOD_START, arrows: ARROWS_START, refill: 0, piece: 0,
      holdMode: null, buildCd: 0, holdT: 0, cursor: null, work: 0,
      charging: false, charge: 0, swingT: 0, swingBig: false, swingCd: 0, shield: false, slide: 0,
      drawing: false, draw: 0, ropeCd: 0, zip: null, climbing: false, bounced: false,
      carrying: null,
      caps: 0, bonks: 0, built: 0,
      // bot brain
      think: 0, mode: 'guard', modeT: 6 + Math.random() * 6, goalX: 0, target: null, react: 0.4,
      jumpHold: 0, stuckT: 0, lastX: 0, shieldT: 0, hopCd: 0,
    };
    this.makeGear(e);
    if (p) {
      e.label = this.game.ui.label('label player-tag');
      e.labelHtml = '';
      // The aim cursor for building: a frame in the player's color.
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
    }
    return e;
  }

  /** Translucent preview of a piece, shown inside the build cursor. */
  makeGhost(key) {
    if (!this.ghostMat) {
      this.ghostMat = new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: toon(0xffffff).gradientMap, transparent: true, opacity: 0.5 });
    }
    const g = new THREE.Group();
    const add = (geo, x = 0, y = 0) => { const m = mesh(geo, this.ghostMat, x, y, 0.85); g.add(m); return m; };
    if (key === 'block') add(new THREE.BoxGeometry(0.8, 0.8, 0.1));
    if (key === 'door') { add(new THREE.BoxGeometry(0.62, 0.86, 0.1)); add(new THREE.BoxGeometry(0.12, 0.12, 0.12), 0.18, 0); }
    if (key === 'ladder') { add(new THREE.BoxGeometry(0.08, 0.86, 0.1), -0.28); add(new THREE.BoxGeometry(0.08, 0.86, 0.1), 0.28); add(new THREE.BoxGeometry(0.6, 0.08, 0.1), 0, -0.2); add(new THREE.BoxGeometry(0.6, 0.08, 0.1), 0, 0.2); }
    if (key === 'pad') { add(new THREE.BoxGeometry(0.8, 0.3, 0.1), 0, -0.25); add(new THREE.BoxGeometry(0.7, 0.2, 0.1), 0, 0.05); }
    return g;
  }

  /** Foam sword, shield, hammer, bow and a team pennant, drawn in front of the bean. */
  makeGear(e) {
    const g = new THREE.Group();
    const team = [];
    // Foam sword.
    const sword = new THREE.Group();
    sword.position.set(0.3, 0.55, 0.05);
    const blade = mesh(sharedGeo('kbBlade', () => new RoundedBoxGeometry(0.17, 0.95, 0.1, 2, 0.07)), toon(BLADE[e.team]), 0, 0.68, 0);
    const guard = mesh(sharedGeo('kbGuard', () => new RoundedBoxGeometry(0.42, 0.09, 0.14, 2, 0.04)), toon(TEAM_COLORS[e.team]), 0, 0.17, 0);
    const grip = mesh(sharedGeo('kbGrip', () => new THREE.CylinderGeometry(0.045, 0.045, 0.26, 6)), toon(COLORS.trunk), 0, 0.03, 0);
    sword.add(blade, guard, grip);
    team.push(guard);
    // Round shield.
    const shield = new THREE.Group();
    const disc = mesh(sharedGeo('kbShield', () => new THREE.CylinderGeometry(0.36, 0.36, 0.08, 20)), toon(TEAM_COLORS[e.team]));
    disc.rotation.x = Math.PI / 2;
    const rim = mesh(sharedGeo('kbRim', () => new THREE.TorusGeometry(0.36, 0.045, 6, 20)), toon(COLORS.white));
    const boss = mesh(sharedGeo('kbBoss', () => new THREE.SphereGeometry(0.1, 10, 8)), toon(COLORS.gold), 0, 0, 0.05);
    shield.add(disc, rim, boss);
    team.push(disc);
    // Builder's hammer.
    const hammer = new THREE.Group();
    hammer.position.set(0.3, 0.5, 0.05);
    hammer.add(mesh(sharedGeo('kbHandle', () => new THREE.CylinderGeometry(0.04, 0.04, 0.55, 6)), toon(COLORS.trunk), 0, 0.27, 0));
    hammer.add(mesh(sharedGeo('kbHead', () => new RoundedBoxGeometry(0.34, 0.17, 0.17, 2, 0.04)), toon(0xb8b4cc), 0, 0.56, 0));
    const band = mesh(sharedGeo('kbBand', () => new THREE.BoxGeometry(0.08, 0.19, 0.19)), toon(TEAM_COLORS[e.team]), 0, 0.56, 0);
    hammer.add(band);
    team.push(band);
    // Bow with a string and a nocked arrow.
    const bow = new THREE.Group();
    bow.position.set(0.22, 0.68, 0.08);
    const arc = mesh(sharedGeo('kbBow', () => new THREE.TorusGeometry(0.4, 0.045, 6, 14, Math.PI)), toon(0xc98b5a));
    arc.rotation.z = -Math.PI / 2;
    const string = mesh(sharedGeo('kbString', () => new THREE.CylinderGeometry(0.012, 0.012, 0.8, 4)), toon(COLORS.icing));
    const nock = new THREE.Group();
    const shaft = mesh(sharedGeo('kbNock', () => new THREE.CylinderGeometry(0.03, 0.03, 0.75, 5)), toon(COLORS.icing), 0.3, 0, 0);
    shaft.rotation.z = Math.PI / 2;
    const cup = mesh(sharedGeo('kbNockCup', () => new THREE.SphereGeometry(0.09, 8, 6)), toon(TEAM_COLORS[e.team]), 0.7, 0, 0);
    nock.add(shaft, cup);
    team.push(cup);
    bow.add(arc, string, nock);
    const quiver = mesh(sharedGeo('kbQuiver', () => new THREE.CylinderGeometry(0.11, 0.09, 0.5, 8)), toon(0xa0704a), -0.36, 0.85, -0.25);
    quiver.rotation.z = -0.4;
    // Team pennant on the back.
    const pennant = new THREE.Group();
    pennant.position.set(-0.36, 0.95, -0.15);
    pennant.add(mesh(sharedGeo('kbPenPole', () => new THREE.CylinderGeometry(0.025, 0.025, 0.85, 5)), toon(COLORS.trunk), 0, 0.42, 0));
    const pcloth = mesh(sharedGeo('kbPenCloth', () => new THREE.ConeGeometry(0.16, 0.42, 3)), toon(TEAM_COLORS[e.team]), -0.2, 0.72, 0);
    pcloth.rotation.z = Math.PI / 2;
    pennant.add(pcloth);
    team.push(pcloth);

    g.add(sword, shield, hammer, bow, quiver, pennant);
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.scene.add(g);
    // The rope of the rope arrow.
    const rope = mesh(sharedGeo('kbRope', () => new THREE.CylinderGeometry(0.03, 0.03, 1, 5)), toon(0xf7e1a6));
    rope.visible = false;
    this.scene.add(rope);
    e.gear = { g, sword, blade, shield, hammer, bow, nock, quiver, pennant, team, rope };
    this.setClass(e, e.cls);
  }

  setTeam(e, team) {
    e.team = team;
    for (const m of e.gear.team) m.material = toon(TEAM_COLORS[team]);
    e.gear.blade.material = toon(BLADE[team]);
    if (e.bot) e.ch.critter.userData.body.material = toon(TEAM_COLORS[team], { flat: true });
  }

  setClass(e, cls) {
    e.cls = cls;
    this.showGear(e, cls);
  }

  showGear(e, cls) {
    const G2 = e.gear;
    G2.sword.visible = G2.shield.visible = cls === 'knight';
    G2.hammer.visible = cls === 'builder';
    G2.bow.visible = G2.quiver.visible = cls === 'archer';
    G2.shown = cls;
  }

  /** Before the class pick: knight, builder, archer in turn within each team. */
  defaultClasses() {
    for (const team of [0, 1]) {
      this.ents.filter((e) => e.team === team && !e.bot).forEach((e, k) => this.setClass(e, ['knight', 'builder', 'archer'][k % 3]));
    }
  }

  spawnPoint(e, k = Math.floor(Math.random() * SPAWN_COLS.length)) {
    for (let tries = 0; tries < SPAWN_COLS.length; tries++) {
      const c0 = SPAWN_COLS[(k + tries) % SPAWN_COLS.length];
      const c = e.team ? mirror(c0) : c0;
      // Stand on the first spot with two free tiles of headroom.
      for (let r = G; r < ROWS - 2; r++) {
        if (!this.solidFor(c, r, e.team) && !this.solidFor(c, r + 1, e.team) && this.solidFor(c, r - 1, e.team)) {
          return { x: cellX(c) + 0.5, y: r };
        }
      }
    }
    return { x: cellX(e.team ? mirror(4) : 4) + 0.5, y: G + 8 };
  }

  placeEnts() {
    for (const team of [0, 1]) {
      this.ents.filter((e) => e.team === team).forEach((e, k) => {
        const sp = this.spawnPoint(e, k);
        e.body.x = sp.x;
        e.body.y = sp.y;
        e.body.vx = e.body.vy = 0;
        e.facing = team ? -1 : 1;
      });
    }
  }

  // ---------- physics helpers ----------

  /** Tile solids near a body, as rectangles for moveBody. */
  solidsAround(b, team) {
    const out = [];
    const c0 = colOf(b.x - b.w / 2) - 1, c1 = colOf(b.x + b.w / 2) + 1;
    const r0 = Math.floor(b.y) - 2, r1 = Math.floor(b.y + b.h) + 2;
    for (let c = c0; c <= c1; c++) {
      for (let r = r0; r <= r1; r++) {
        if (this.solidFor(c, r, team)) {
          out.push({ x: cellX(c), y: r, w: 1, h: 1, pad: this.tileAt(c, r) === PAD });
        } else if (this.tileAt(c, r) === LADDER && this.tileAt(c, r + 1) !== LADDER && r >= 0 && r < ROWS) {
          // The top rung of a ladder is a little ledge you can stand on.
          out.push({ x: cellX(c), y: r + 0.7, w: 1, h: 0.3, oneWay: true, ladderTop: true });
        }
      }
    }
    return out;
  }

  onLadder(b) {
    const c = colOf(b.x);
    for (let r = Math.floor(b.y + 0.05); r <= Math.floor(b.y + b.h - 0.3); r++) if (this.tileAt(c, r) === LADDER && r < ROWS) return true;
    return false;
  }

  cellHitsBody(c, r, b, pad = 0.02) {
    const x0 = cellX(c);
    return b.x + b.w / 2 > x0 + pad && b.x - b.w / 2 < x0 + 1 - pad && b.y + b.h > r + pad && b.y < r + 1 - pad;
  }

  // ---------- building ----------

  /** The cell a builder aims at: next to the body in the stick direction. */
  aimCell(e, inp) {
    const b = e.body;
    let ax = Math.abs(inp.x) > 0.35 ? Math.sign(inp.x) : 0;
    const ay = Math.abs(inp.y) > 0.35 ? Math.sign(inp.y) : 0;
    if (!ax && !ay) ax = e.facing;
    let c, r;
    if (ax) {
      c = colOf(b.x + ax * 0.9);
      r = Math.floor(b.y + 0.05) + ay;
      if (this.cellHitsBody(c, r, b) && this.tileAt(c, r) === EMPTY) c += ax;
    } else {
      c = colOf(b.x);
      r = ay > 0 ? Math.floor(b.y + b.h + 0.05) : Math.floor(b.y - 0.05);
      if (this.cellHitsBody(c, r, b) && this.tileAt(c, r) === EMPTY) r += ay;
    }
    return { c, r };
  }

  canPlace(e, c, r) {
    if (c < 0 || c >= COLS || r < 1 || r >= ROWS) return false;
    if (this.tile[idx(c, r)] !== EMPTY || this.flagCells.has(idx(c, r))) return false;
    for (const o of this.ents) if (o.state === 'play' && this.cellHitsBody(c, r, o.body)) return false;
    for (const f of this.flags) if (f.state === 'dropped' && colOf(f.x) === c && Math.floor(f.y + 0.3) === r) return false;
    // Pieces have to touch something: no blocks floating in the sky.
    return [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dc, dr]) => this.tileAt(c + dc, r + dr) !== EMPTY);
  }

  canDig(c, r) {
    if (c < 0 || c >= COLS || r < 1 || r >= ROWS) return false;
    return DIG_TIME[this.tile[idx(c, r)]] !== undefined;
  }

  placePiece(e, c, r) {
    const pc = PIECES[e.piece];
    if (e.wood < pc.cost) {
      this.floater(t('castle.noWood'), new THREE.Vector3(e.body.x, e.body.y + 2, 0.5), e.css, 0.9);
      this.game.audio.play('bump');
      return false;
    }
    e.wood -= pc.cost;
    this.setTile(c, r, pc.tile, e.team);
    e.built++;
    e.work = 0.2;
    this.puffs.burst(new THREE.Vector3(cellX(c) + 0.5, r + 0.5, 0.8), 0xfff3dc, { count: 4, size: 0.25, life: 0.35 });
    this.game.audio.play('land');
    return true;
  }

  /** Take a cell down; builders get the wood of their pieces back. */
  breakTile(c, r, by = null) {
    const i = idx(c, r), ty = this.tile[i];
    if (by && !by.bot && REFUND[ty] && (by.cls === 'builder' || this.phase === 'build')) by.wood = Math.min(WOOD_MAX, by.wood + REFUND[ty]);
    const col = ty === WOOD || ty === DOOR || ty === LADDER ? 0xe2a96b : ty === PAD ? 0xff7eb6 : TILE_COLOR[ty] || 0xffffff;
    this.puffs.burst(new THREE.Vector3(cellX(c) + 0.5, r + 0.5, 0.8), col, { count: 8, size: 0.35, life: 0.5 });
    this.setTile(c, r, EMPTY, -1);
    this.game.audio.play('pop');
  }

  damageTile(c, r, amount, by) {
    if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return;
    const i = idx(c, r);
    this.dmg[i] += amount;
    this.tilesDirty = true;
    if (this.dmg[i] >= 0.999) this.breakTile(c, r, by);
  }

  updateBuilder(e, inp, bHeld, bPress, dt) {
    if (inp.cPressed) {
      e.piece = (e.piece + 1) % PIECES.length;
      this.floater(t(`castle.piece.${PIECES[e.piece].key}`), new THREE.Vector3(e.body.x, e.body.y + 2.1, 0.5), e.css, 1);
      this.game.audio.play('select');
    }
    const { c, r } = this.aimCell(e, inp);
    const ty = this.tileAt(c, r);
    const mode = ty === EMPTY ? (this.canPlace(e, c, r) ? 'place' : 'bad') : this.canDig(c, r) ? 'dig' : 'bad';
    e.cursor = { c, r, mode };
    e.buildCd -= dt;
    if (bPress) { e.holdMode = mode === 'dig' ? 'dig' : 'place'; e.holdT = 0; }
    if (!bHeld) { e.holdMode = null; return; }
    e.holdT += dt;
    if (e.holdMode === 'place' && mode === 'place' && (bPress || (e.holdT > 0.3 && e.buildCd <= 0))) {
      // Holding B keeps placing, so you can draw a wall by sweeping the stick.
      if (this.placePiece(e, c, r)) e.buildCd = 0.2; else e.buildCd = 0.6;
    } else if (e.holdMode === 'dig' && mode === 'dig') {
      e.work = 0.15;
      if (Math.random() < dt * 8) this.puffs.burst(new THREE.Vector3(cellX(c) + 0.5, r + 0.5, 0.85), 0xffffff, { count: 1, size: 0.2, life: 0.3 });
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
    if (big) {
      b.vx = e.facing * 13;
      this.game.audio.play('dash');
    } else {
      this.game.audio.play('whoosh');
    }
    const reach = big ? 2.0 : 1.5;
    for (const o of this.ents) {
      if (o.team === e.team || o.state !== 'play') continue;
      const dx = (o.body.x - b.x) * e.facing, dy = o.body.y - b.y;
      if (dx > -0.3 && dx < reach && Math.abs(dy) < 1.3) this.hit(o, e, { dir: e.facing, big, melee: true });
    }
    // Swords knock enemy pieces apart: a few hits, or one big slash.
    const cols = big ? [colOf(b.x + e.facing * 0.9), colOf(b.x + e.facing * 1.9)] : [colOf(b.x + e.facing * 0.9)];
    const r0 = Math.floor(b.y + 0.1);
    for (const c of [...new Set(cols)]) {
      for (const r of [r0, r0 + 1]) {
        const ty = this.tileAt(c, r);
        if (!KNIGHT_HP[ty] || c < 0 || c >= COLS || r >= ROWS) continue;
        if (this.owner[idx(c, r)] === e.team) continue;
        this.damageTile(c, r, big ? 1 : 1 / KNIGHT_HP[ty] + 0.001, e);
        this.game.audio.play('bump');
      }
    }
    const fx = b.x + e.facing * 1.0, fy = b.y + 0.8;
    this.puffs.burst(new THREE.Vector3(fx, fy, 0.6), big ? COLORS.gold : 0xffffff, { count: big ? 10 : 4, size: big ? 0.4 : 0.25, life: 0.3, speed: 3 });
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
    this.arrows.push({ owner: e, team: e.team, mesh: this.makeArrow(e.p ? e.p.color : TEAM_COLORS[e.team]), state: 'fly', rope: false, t: 0, x: sx, y: sy, vx: e.aimX * speed, vy: e.aimY * speed + 1 });
    e.ch.squash(0.85);
    this.game.audio.play('dash');
  }

  shootRope(e) {
    e.ropeCd = 1.2;
    const sx = e.body.x + e.aimX * 0.5, sy = e.body.y + 0.8 + e.aimY * 0.5;
    // Straight up if you are not aiming: the rope is for climbing.
    let ax = e.aimX, ay = e.aimY;
    if (Math.abs(ay) < 0.3) { ax = e.facing * 0.5; ay = 0.87; }
    const a = { owner: e, team: e.team, mesh: this.makeArrow(e.p ? e.p.color : TEAM_COLORS[e.team], true), state: 'fly', rope: true, t: 0, x: sx, y: sy, vx: ax * 24, vy: ay * 24 };
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
          const c = colOf(tx), r = Math.floor(ty);
          if (c < 0 || c >= COLS || ty < 0 || ty >= ROWS + 3) { a.state = 'gone'; break; }
          if (a.state === 'drop') {
            if (this.isSolidAt(a.x, a.y - 0.08)) { a.state = 'stuck'; a.stuckT = 0; a.mesh.rotation.z = a.vx >= 0 ? 0 : Math.PI; a.cell = idx(colOf(a.x), Math.floor(a.y - 0.08)); }
            continue;
          }
          if (r < ROWS && this.solidFor(c, r, a.team)) {
            const ty2 = this.tileAt(c, r);
            if (a.rope ? ty2 !== BARRIER && ty2 !== BEDROCK : STICKY.has(ty2)) {
              a.state = 'stuck';
              a.stuckT = 0;
              a.cell = idx(c, r);
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
        // Rope arrows that never find a grip fall away.
        if (a.rope && a.state === 'fly' && a.t > 0.7) a.state = 'gone';
      } else if (a.state === 'stuck') {
        a.stuckT += dt;
        // The tile it was stuck in is gone: fall down.
        if (this.tile[a.cell] === EMPTY || this.tile[a.cell] === LADDER) { a.state = 'drop'; a.vx = 0; a.vy = 0; }
        if (a.rope) { if (!a.owner.zip || a.owner.zip.arrow !== a) a.state = 'gone'; } else {
          if (a.stuckT > 9) a.mesh.scale.setScalar(Math.max(0.01, 1 - (a.stuckT - 9)));
          if (a.stuckT > 10) a.state = 'gone';
          // Archers pick arrows back up by walking over them.
          for (const e of this.ents) {
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
    for (const o of this.ents) {
      if (o.team === a.team || o.state !== 'play') continue;
      const b = o.body;
      if (Math.abs(tx - b.x) < BW / 2 + 0.12 && ty > b.y - 0.05 && ty < b.y + BH + 0.1) {
        const res = this.hit(o, a.owner, { dir: Math.sign(a.vx) || 1, big: false, arrowVx: a.vx });
        if (res) {
          a.state = 'drop';
          a.vx *= -0.2;
          a.vy = 4;
          return;
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
      // Let go with a little hop so you can land on the ledge.
      b.vy = inp.aPressed ? PHYS.jump : Math.max(b.vy, dy > -0.5 ? 9 : 2);
      b.vx *= 0.5;
      e.zip = null;
      z.arrow.state = 'gone';
      return;
    }
    b.vx = (dx / d) * 15;
    b.vy = (dy / d) * 15;
  }

  // ---------- hits and bonks ----------

  /** A foam hit: push, wobble, and after three (or one big slash) a bonk. Returns false if it missed. */
  hit(v, by, { dir, big, melee = false, arrowVx = 0 }) {
    if (v.state !== 'play' || v.invuln > 0) return false;
    // A raised shield blocks everything coming from the front.
    if (v.cls === 'knight' && v.shield) {
      const fromFront = melee ? Math.sign(by.body.x - v.body.x) === v.facing : Math.sign(-arrowVx) === v.facing;
      if (fromFront) {
        v.body.vx += dir * (big ? 10 : 4);
        if (melee && by) by.body.vx -= dir * 5;
        v.invuln = 0.2;
        this.floater(t('castle.blocked'), new THREE.Vector3(v.body.x, v.body.y + 1.9, 0.5), '#ffffff', 0.7);
        this.puffs.burst(new THREE.Vector3(v.body.x + v.facing * 0.5, v.body.y + 0.8, 0.7), 0xffffff, { count: 6, size: 0.3, life: 0.3 });
        this.game.audio.play('bump');
        return true;
      }
    }
    v.hits++;
    v.hitT = 0;
    v.invuln = 0.35;
    if (big || v.hits >= MAX_HITS) {
      this.bonk(v, by);
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

  bonk(v, by) {
    if (by && by !== v) by.bonks++;
    this.floater(t('castle.bonk'), new THREE.Vector3(v.body.x, v.body.y + 2, 0.5), by ? by.css : '#ffffff', 1.1);
    this.confetti.burst(new THREE.Vector3(v.body.x, v.body.y + 1, 0.5), 0, { count: 18, speed: 6, colors: [TEAM_COLORS[v.team], COLORS.white, COLORS.gold], life: 1 });
    this.game.audio.play('pop');
    this.game.audio.play('dizzy');
    this.shake = 0.2;
    this.toBubble(v);
  }

  /** Float home in a bubble (after a bonk, or a bot that got stuck). */
  toBubble(v) {
    if (v.carrying) this.dropFlag(v.carrying);
    v.state = 'bubble';
    v.zip = null;
    v.charging = false;
    v.drawing = false;
    v.shield = false;
    v.climbing = false;
    v.wobble = 0;
    v.hits = 0;
    const home = this.spawnPoint(v);
    v.bub = { x0: v.body.x, y0: v.body.y, x1: home.x, y1: home.y, t: 0 };
    v.bubble.visible = true;
  }

  updateBubble(e, dt) {
    const B = e.bub, b = e.body;
    B.t += dt / BUBBLE_TIME;
    const k = Math.min(1, B.t), s = k * k * (3 - 2 * k);
    b.x = B.x0 + (B.x1 - B.x0) * s;
    b.y = B.y0 + (B.y1 - B.y0) * s + Math.sin(k * Math.PI) * 4;
    b.vx = b.vy = 0;
    e.bubble.position.set(b.x, b.y + 0.7, 0.2);
    if (B.t >= 1) {
      const sp = this.spawnPoint(e);
      b.x = sp.x;
      b.y = sp.y;
      e.state = 'play';
      e.bubble.visible = false;
      e.invuln = 1.5;
      e.stuckT = 0;
      this.puffs.burst(new THREE.Vector3(b.x, b.y + 0.7, 0.5), TEAM_COLORS[e.team], { count: 12, size: 0.4 });
      this.game.audio.play('pop');
    }
  }

  // ---------- flags ----------

  dropFlag(f) {
    const c = f.carrier;
    f.state = 'dropped';
    f.carrier = null;
    f.dropT = FLAG_RETURN;
    f.vy = 3;
    if (c) {
      c.carrying = null;
      f.x = c.body.x;
      f.y = c.body.y + 0.5;
    }
    this.game.ui.toast(t('castle.dropped'), 1500);
  }

  returnFlag(f, toast = true) {
    if (f.carrier) f.carrier.carrying = null;
    f.state = 'home';
    f.carrier = null;
    f.x = f.homeX;
    f.y = f.homeY;
    this.puffs.burst(new THREE.Vector3(f.x, f.y + 1.2, 0.4), TEAM_COLORS[f.team], { count: 10, size: 0.4 });
    if (toast) {
      this.game.ui.toast(t('castle.returned', { team: t(`ball.team.${f.team}`) }), 1600);
      this.game.audio.play('coin');
    }
  }

  touchesFlag(e, x, y) {
    const b = e.body;
    return Math.abs(b.x - x) < 0.85 && y > b.y - 1.2 && y < b.y + BH + 0.2;
  }

  updateFlags(dt) {
    const playing = this.state === 'play' && this.phase === 'battle';
    for (const f of this.flags) {
      if (f.state === 'dropped') {
        // Fall onto the ground (and keep falling if someone digs it out).
        f.vy = Math.max(-18, f.vy - 30 * dt);
        const ny = f.y + f.vy * dt;
        if (f.vy <= 0 && this.isSolidAt(f.x, ny)) { f.y = Math.floor(ny) + 1; f.vy = 0; } else f.y = ny;
        if (f.y < 1) f.y = 1;
        if (playing) {
          f.dropT -= dt;
          if (f.dropT <= 0) this.returnFlag(f);
        }
      }
      if (playing && f.state !== 'carried') {
        for (const e of this.ents) {
          if (e.state !== 'play' || !this.touchesFlag(e, f.x, f.y + 0.5)) continue;
          if (e.team === f.team) {
            if (f.state === 'dropped') this.returnFlag(f);
          } else if (!e.carrying) {
            f.state = 'carried';
            f.carrier = e;
            e.carrying = f;
            this.game.ui.toast(t('castle.took', { name: e.name }), 1600);
            this.game.audio.play('star');
            break;
          }
        }
      }
      // Carry it home to your own flag to score.
      if (playing && f.state === 'carried') {
        const e = f.carrier;
        const home = this.flags[e.team];
        if (Math.abs(e.body.x - home.homeX) < 1.0 && Math.abs(e.body.y - home.homeY) < 1.5) this.capture(e, f);
      }
      // Pose.
      const g = f.group;
      if (f.state === 'carried') {
        const b = f.carrier.body;
        g.position.set(b.x - f.carrier.facing * 0.35, b.y + 0.55, -0.25);
        g.scale.set(-f.carrier.facing * 0.7, 0.7, 0.7);
        g.rotation.z = f.carrier.facing * 0.25;
      } else {
        g.position.set(f.x, f.y + (f.state === 'home' ? 0.2 : 0), 0);
        g.scale.set(f.team ? -1 : 1, 1, 1);
        g.rotation.z = f.state === 'dropped' ? 0.35 : 0;
      }
      f.cloth.rotation.y = Math.sin(this.time * 3 + f.team) * 0.3;
      f.cloth.scale.y = f.state === 'dropped' ? 0.9 + Math.sin(this.time * 10) * 0.1 : 1;
    }
  }

  capture(e, f) {
    this.score[e.team]++;
    e.caps++;
    this.returnFlag(f, false);
    const home = this.flags[e.team];
    this.confetti.burst(new THREE.Vector3(home.homeX, home.homeY + 2, 0.5), 0, { count: 60, speed: 9, up: 5, colors: [TEAM_COLORS[e.team], COLORS.white, COLORS.gold], life: 1.6 });
    this.game.ui.toast(t('castle.capture', { name: e.name, team: t(`ball.team.${e.team}`) }), 2200);
    this.game.audio.play('rescue');
    this.game.audio.play('star');
  }

  // ---------- helper bots ----------

  /** Simple knight brain: guard the flag, chase thieves, sometimes raid. */
  botThink(e) {
    const own = this.flags[e.team], foe = this.flags[1 - e.team];
    const b = e.body;
    const towardMid = e.team ? -1 : 1;
    const post = own.homeX + towardMid * (e.slot ? 3.5 : 1.8) + Math.sin(this.time * 0.7 + e.slot * 2) * 1.2;
    e.target = null;
    e.modeT -= 0.3;
    if (e.modeT <= 0) {
      const teamBots = this.ents.filter((o) => o.team === e.team);
      const allBots = teamBots.every((o) => o.bot);
      e.mode = Math.random() < (allBots ? 0.5 : 0.3) ? 'raid' : 'guard';
      e.modeT = 8 + Math.random() * 8;
    }
    const enemies = this.ents.filter((o) => o.team !== e.team && o.state === 'play');
    let threat = null, best = 1e9;
    for (const o of enemies) {
      const d = Math.hypot(o.body.x - b.x, o.body.y - b.y);
      const nearFlag = Math.abs(o.body.x - own.homeX) < 9;
      if ((d < 4.5 || nearFlag) && d < best) { best = d; threat = o; }
    }
    if (e.carrying) e.goalX = own.homeX;
    else if (this.phase === 'build') e.goalX = post;
    else if (own.state === 'carried') { e.target = own.carrier; e.goalX = own.carrier.body.x; }
    else if (own.state === 'dropped') e.goalX = own.x;
    else if (threat && (e.mode === 'guard' || best < 4)) { e.target = threat; e.goalX = threat.body.x; }
    else if (e.mode === 'raid') e.goalX = foe.state === 'carried' ? foe.carrier.body.x : foe.x;
    else e.goalX = post;
  }

  botInput(e, dt) {
    const inp = { x: 0, y: 0, a: false, b: false, c: false, aPressed: false, bPressed: false, cPressed: false };
    const b = e.body;
    e.think -= dt;
    if (e.think <= 0) { e.think = 0.3; this.botThink(e); }
    e.react -= dt;
    e.hopCd -= dt;
    const dx = e.goalX - b.x;
    if (Math.abs(dx) > 0.45) inp.x = Math.sign(dx);
    // Swing at a target in reach.
    const tg = e.target;
    if (tg && tg.state === 'play') {
      const tdx = tg.body.x - b.x;
      if (Math.abs(tdx) < 1.4 && Math.abs(tg.body.y - b.y) < 1.2) {
        e.facing = Math.sign(tdx) || e.facing;
        inp.x = Math.abs(tdx) < 0.8 ? 0 : inp.x;
        if (e.react <= 0 && e.swingCd <= 0) { this.swing(e, false); e.react = 0.5 + Math.random() * 0.5; }
      } else e.react = Math.max(e.react, 0.25);
    }
    // Raise the shield at arrows flying toward the face (sometimes).
    e.shieldT -= dt;
    for (const a of this.arrows) {
      if (a.state !== 'fly' || a.rope || a.team === e.team || a.seen?.has(e)) continue;
      const adx = b.x - a.x;
      if (Math.abs(adx) < 5 && Math.sign(a.vx) === Math.sign(adx) && Math.abs(a.y - b.y - 0.7) < 2) {
        (a.seen ||= new Set()).add(e);
        if (Math.random() < 0.4) { e.shieldT = 0.6; e.facing = -Math.sign(a.vx); }
      }
    }
    if (e.shieldT > 0) { inp.c = true; inp.x = 0; }
    // Walls: jump, then bash enemy wood, then a big grumble hop, then give up and float home.
    e.jumpHold -= dt;
    const wantMove = inp.x !== 0;
    if (wantMove && b.wallHit && b.grounded) { inp.aPressed = true; e.jumpHold = 0.35; }
    inp.a = e.jumpHold > 0;
    const moved = Math.abs(b.x - e.lastX);
    e.lastX = b.x;
    if (wantMove && moved < 0.01) e.stuckT += dt; else e.stuckT = Math.max(0, e.stuckT - dt * 2);
    if (e.stuckT > 0.6 && b.grounded && e.swingCd <= 0) {
      const c = colOf(b.x + inp.x * 0.9), r0 = Math.floor(b.y + 0.1);
      if ([r0, r0 + 1].some((r) => KNIGHT_HP[this.tileAt(c, r)] && this.owner[idx(c, r)] !== e.team)) {
        e.facing = inp.x;
        this.swing(e, false);
      }
    }
    if (e.stuckT > 3.5 && b.grounded && e.hopCd <= 0) { b.vy = 17; e.hopCd = 2.5; this.game.audio.play('boing'); }
    if (e.stuckT > 10) { e.stuckT = 0; this.toBubble(e); }
    return inp;
  }

  // ---------- the main entity update ----------

  updateEnt(e, dt, playing) {
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

    const act = this.phase === 'build' && this.state === 'play' && !e.bot ? 'builder' : e.cls;
    let inp = !playing ? NO_INPUT : e.bot ? this.botInput(e, dt) : (this.input(e.p) || NO_INPUT);
    if (e.state !== 'play') return; // the bot gave up and is floating home
    // C keys also count as B, so B actions only fire while C is up.
    const bHeld = inp.b && !inp.c, bPress = inp.bPressed && !inp.c;

    // Wood and arrows slowly refill.
    e.refill += dt;
    if (act === 'builder' && e.refill > (this.phase === 'build' ? 0.5 : 2)) { e.refill = 0; if (e.wood < WOOD_MAX) e.wood++; }
    if (act === 'archer' && e.refill > 2.5) { e.refill = 0; if (e.arrows < ARROWS_START) e.arrows++; }

    if (e.wobble > 0) inp = { ...inp, x: inp.x * 0.3 };
    const slow = (act === 'knight' && (e.shield || e.charging)) || (act === 'archer' && e.drawing);
    const P = e.bot ? PHYS_BOT : slow ? PHYS_SLOW : e.carrying ? PHYS_CARRY : PHYS;

    if (e.zip) {
      this.updateZip(e, inp, dt);
    } else {
      // Ladders: up or A climbs, down climbs down, nothing holds you in place.
      const lad = this.onLadder(b);
      if (lad && (inp.y > 0.4 || inp.a || (inp.y < -0.4 && !b.grounded))) e.climbing = true;
      if (!lad || (b.grounded && inp.y <= 0.4 && !inp.a)) e.climbing = false;
      if (b.grounded && b.ground?.ladderTop && inp.y < -0.5) { b.dropTimer = 0.25; e.climbing = true; }
      if (e.climbing) {
        b.vy = inp.y > 0.4 || inp.a ? 5.5 : inp.y < -0.4 ? -5.5 : 0;
        b.vx = approach(b.vx, inp.x * 3.5, 40 * dt);
        b.grounded = false;
      } else {
        // Bounce pads launch you high, whether or not you hold jump.
        const ctrl = e.bounced && b.vy > 0 ? { ...inp, a: true } : inp;
        if (e.bounced && b.vy <= 0) e.bounced = false;
        const j = platformerControl(b, ctrl, dt, P);
        if (j) { e.ch.squash(1.3); this.game.audio.play('jump'); }
        // Shield up in the air: glide down slowly.
        if (act === 'knight' && e.shield && b.vy < -3.5) b.vy = -3.5;
        if (e.slide > 0) { e.slide -= dt; b.vx = approach(b.vx, 0, 6 * dt); }
      }
    }
    if (Math.abs(inp.x) > 0.2 && act !== 'archer' && !e.charging) e.facing = Math.sign(inp.x);

    const wasAir = !b.grounded;
    const vyBefore = b.vy;
    moveBody(b, dt, this.solidsAround(b, e.team));
    if (b.grounded && b.ground?.pad) {
      b.vy = 21;
      b.grounded = false;
      e.bounced = true;
      e.climbing = false;
      e.ch.squash(1.4);
      this.game.audio.play('boing');
    } else if (b.justLanded && wasAir) {
      e.ch.squash(0.75);
      // Landing with the shield up turns your speed into a slide.
      if (act === 'knight' && e.shield && Math.abs(b.vx) > 2) { e.slide = 0.5; b.vx = Math.sign(b.vx) * Math.max(Math.abs(b.vx), 8); }
      if (vyBefore < -12) this.game.audio.play('land');
    }
    // Teammates can bounce off a knight's raised shield.
    if (act === 'knight' && e.shield && inp.y > 0.4) {
      for (const o of this.ents) {
        if (o === e || o.team !== e.team || o.state !== 'play' || o.body.vy >= 0) continue;
        if (Math.abs(o.body.x - b.x) < 0.7 && o.body.y > b.y + 1.0 && o.body.y < b.y + 1.9) {
          o.body.vy = 18;
          o.bounced = true;
          this.game.audio.play('boing');
        }
      }
    }

    if (playing) {
      if (act === 'builder') this.updateBuilder(e, inp, bHeld, bPress, dt);
      else if (act === 'knight' && !e.bot) this.updateKnight(e, inp, bHeld, bPress, dt);
      else if (act === 'knight' && e.bot) e.shield = !!inp.c;
      else if (act === 'archer') this.updateArcher(e, inp, bHeld, bPress, dt);
    } else {
      e.charging = e.drawing = e.shield = false;
    }
    e.act = act;
  }

  // ---------- drawing the entities ----------

  poseEnt(e, dt) {
    const b = e.body;
    const G2 = e.gear;
    const inBubble = e.state === 'bubble';
    if (G2.shown !== e.act && e.act) this.showGear(e, e.act);
    if (e.bot) {
      e.ch.group.position.set(b.x, b.y, 0);
      const cr = e.ch.critter;
      cr.rotation.y += ((e.facing * 0.9) - cr.rotation.y) * Math.min(1, dt * 10);
      e.ch.sq += (1 - e.ch.sq) * Math.min(1, dt * 10);
      const hop = b.grounded && Math.abs(b.vx) > 0.5 ? Math.abs(Math.sin(this.time * 12)) * 0.12 : 0;
      e.ch.pivot.position.y = hop;
      e.ch.pivot.scale.set(1 / Math.sqrt(e.ch.sq), e.ch.sq, 1 / Math.sqrt(e.ch.sq));
      e.ch.pivot.rotation.z = Math.sin(this.time * 18) * e.wobble * 0.5 + (inBubble ? this.time * 3 : 0);
    } else {
      e.ch.group.position.set(b.x, b.y, 0);
      e.ch.faceSide(e.facing);
      e.ch.spin = inBubble ? e.ch.spin + dt * 3 : 0;
      e.ch.update(dt, { moving: Math.min(1, Math.abs(b.vx) / PHYS.speed), grounded: b.grounded || inBubble || e.climbing, vy: b.vy });
      e.ch.pivot.rotation.z = Math.sin(this.time * 18) * e.wobble * 0.5;
    }
    e.ch.group.visible = e.invuln <= 0.4 || Math.floor(this.time * 14) % 2 === 0 || e.hits > 0;

    // Gear rides in front of the bean and mirrors with its facing.
    G2.g.visible = !inBubble;
    G2.g.position.set(b.x, b.y, 0.5);
    G2.g.scale.set(e.facing * BEAN_SCALE, BEAN_SCALE, BEAN_SCALE);
    G2.pennant.visible = !e.carrying && !e.bot;
    G2.pennant.rotation.z = Math.sin(this.time * 4 + b.x) * 0.1 - b.vx * 0.02;
    // Sword: rest, wind up while charging, sweep on a swing.
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
    G2.blade.material = e.charging && e.charge >= CHARGE_FULL ? toon(COLORS.white, { emissive: 0x665500 }) : toon(BLADE[e.team]);
    // Shield: on the back arm, or up in front.
    if (e.shield) { G2.shield.position.set(0.5, 0.72, 0.12); G2.shield.rotation.y = 1.0; G2.shield.scale.setScalar(1.15); }
    else { G2.shield.position.set(-0.3, 0.55, -0.1); G2.shield.rotation.y = 0.3; G2.shield.scale.setScalar(0.85); }
    // Hammer bobs while you build.
    G2.hammer.rotation.z = e.work > 0 ? -0.6 + Math.sin(this.time * 30) * 0.8 : -0.3;
    // Bow points along the aim; the arrow shows while drawing.
    G2.bow.rotation.z = Math.atan2(e.aimY, Math.abs(e.aimX) < 0.01 ? 0.01 : e.aimX * e.facing);
    G2.nock.visible = e.drawing;
    G2.nock.position.x = -Math.min(1, e.draw / DRAW_FULL) * 0.35;
    // Rope from the hand to the rope arrow.
    const ra = e.zip ? e.zip.arrow : e.ropeArrow && e.ropeArrow.state === 'fly' ? e.ropeArrow : null;
    if (ra && !inBubble) {
      const hx = b.x, hy = b.y + 0.8;
      const dx = ra.x - hx, dy = ra.y - hy, len = Math.hypot(dx, dy);
      G2.rope.visible = true;
      G2.rope.position.set(hx + dx / 2, hy + dy / 2, 0.3);
      G2.rope.scale.set(1, len, 1);
      G2.rope.rotation.z = Math.atan2(dy, dx) - Math.PI / 2;
    } else G2.rope.visible = false;

    // Dizzy stars count the foam hits you took.
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

    // Build cursor and piece preview.
    if (e.cursorMesh) {
      const cur = e.cursor;
      const show = !!cur && this.state === 'play';
      e.cursorMesh.visible = show;
      e.ghosts.forEach((g, i) => { g.visible = show && cur.mode === 'place' && i === e.piece; });
      if (show) {
        const x = cellX(cur.c) + 0.5, y = cur.r + 0.5;
        e.cursorMesh.position.set(x, y, 0.85);
        const pulse = cur.mode === 'dig' ? 1 + Math.sin(this.time * 20) * 0.04 : 1;
        e.cursorMesh.scale.setScalar(cur.mode === 'bad' ? 0.8 : pulse);
        for (const m of e.cursorMesh.userData.bars) m.material = cur.mode === 'bad' ? basic(0x9a94b2) : cur.mode === 'dig' ? basic(COLORS.white) : basic(e.p.color);
        e.ghosts[e.piece].position.set(x, y, 0);
      }
    }
  }

  // ---------- HUD bits ----------

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
    const act = e.act || e.cls;
    if (act === 'builder') return `${GLYPH.builder} ${e.wood}`;
    if (act === 'archer') return `${GLYPH.archer} ${e.arrows}`;
    return GLYPH.knight;
  }

  updateLabels() {
    const show = this.state === 'play';
    for (const e of this.ents) {
      if (!e.label) continue;
      const html = show && e.state === 'play' ? `<span style="color:${e.css}">${this.countText(e)}</span>` : '';
      if (html !== e.labelHtml) { e.label.innerHTML = html; e.labelHtml = html; }
      if (html) this.game.ui.place(e.label, new THREE.Vector3(e.body.x, e.body.y + 2.05, 0.3), this.camera);
      else e.label.style.display = 'none';
    }
  }

  chip(e) {
    const act = e.act || e.cls;
    let txt = esc(t(`castle.cls.${e.cls}`));
    if (act === 'builder') txt += ` · ${esc(t('castle.wood', { n: e.wood }))}`;
    else if (act === 'archer') txt += ` · ${esc(t('castle.arrows', { n: e.arrows }))}`;
    return `<span style="color:${TEAM_CSS[e.team]}">●</span> ${GLYPH[e.cls]} ${txt}`;
  }

  startBattle() {
    this.phase = 'battle';
    this.openWall();
    this.game.ui.toast(t('castle.battleGo'), 2600);
    this.game.audio.play('go');
    for (const e of this.ents) {
      e.holdMode = null;
      if (e.cls === 'archer') e.arrows = Math.max(e.arrows, ARROWS_START);
    }
  }

  end() {
    if (this.state === 'results') return;
    for (const e of this.ents) {
      if (e.label) e.label.style.display = 'none';
      if (e.cursorMesh) e.cursorMesh.visible = false;
      e.ghosts?.forEach((g) => { g.visible = false; });
    }
    const [a, b] = this.score;
    const winner = a === b ? -1 : a > b ? 0 : 1;
    const ranked = this.ents.filter((e) => !e.bot).sort((x, y) => (y.team === winner) - (x.team === winner) || y.caps - x.caps || y.bonks - x.bonks || y.built - x.built);
    this.finish({
      title: winner < 0 ? t('ball.draw') : t('ball.winTitle', { team: t(`ball.team.${winner}`) }),
      subtitle: `${t('ball.team.0')} ${t('ball.sub', { a, b })} ${t('ball.team.1')}`,
      rows: ranked.map((e) => ({
        css: e.css, name: e.name,
        value: e.caps === 1 ? t('castle.cap1') : t('castle.caps', { n: e.caps }),
        detail: `${t(`castle.cls.${e.cls}`)} · ${e.bonks === 1 ? t('castle.bonk1') : t('castle.bonks', { n: e.bonks })} · ${t('castle.built', { n: e.built })}`,
        crown: e.team === winner,
      })),
      stars: 2,
    });
  }

  update(dt) {
    // Scenery motion.
    for (const cl of this.clouds) { cl.position.x += dt * 0.6; if (cl.position.x > 50) cl.position.x = -50; }
    for (const bn of this.banners || []) bn.rotation.y = Math.sin(this.time * 2.5 + bn.userData.wave) * 0.35;
    if (this.barrier.visible) this.barrier.material.opacity = 0.38 + Math.sin(this.time * 3) * 0.08;

    if (this.state === 'teams') this.picker?.update(dt);
    const playing = this.state === 'play';
    for (const e of this.ents) this.updateEnt(e, dt, playing);
    this.updateArrows(dt);
    this.updateFlags(dt);
    this.updateDoors();
    if (this.tilesDirty) this.rebuildTiles();
    for (const e of this.ents) this.poseEnt(e, dt);
    this.updateFloaters(dt);
    this.updateLabels();

    this.camera.position.copy(this.camBase);
    if (this.shake > 0) {
      this.shake -= dt;
      this.camera.position.x += (Math.random() - 0.5) * this.shake;
      this.camera.position.y += (Math.random() - 0.5) * this.shake;
    }

    if (this.updateResults(dt)) return;
    if (this.state === 'teams') return;
    if (playing) {
      if (this.phase === 'build') {
        this.buildLeft -= dt;
        if (this.buildLeft <= 0) this.startBattle();
      } else {
        this.timeLeft -= dt;
        if (this.timeLeft <= 0) { this.timeLeft = 0; this.end(); return; }
      }
    }
    if (this.state !== 'intro') {
      const phase = this.phase === 'build' ? `${t('castle.build')} ${clock(this.buildLeft)}` : `${t('castle.battle')} ${clock(this.timeLeft)}`;
      this.game.ui.setTop(`<div class="pill ball-score"><span style="color:${TEAM_CSS[0]}">${t('ball.team.0')}</span><span class="big-num">${this.score[0]} - ${this.score[1]}</span><span style="color:${TEAM_CSS[1]}">${t('ball.team.1')}</span></div><div class="pill"><b>${phase}</b></div>`);
    }
    this.game.ui.bar(this.players, (p) => {
      const e = this.ents.find((x) => x.p === p);
      return e ? this.chip(e) : '';
    });
  }
}
