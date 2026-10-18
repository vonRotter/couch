import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { MiniGame } from '../core/minigame.js';
import { t, addStrings } from '../core/i18n.js';
import { makeGrumble } from '../core/critters.js';
import { COLORS, toon, basic, sharedGeo, faceted } from '../core/palette.js';
import { addLights, skyTexture, makeCloud, makeTree, makeFlower, makeBush, makeMushroom, makeGem, seeded } from '../core/world.js';
import { esc } from '../core/ui.js';

// Grumble Guides: co-op Lemmings. Grumbles march out of a hatch and turn at walls; every player
// steers a cursor ring and hands out jobs (A), switches job (C) and fast-forwards (hold B).
// Grumbles never get hurt: a big fall bounces them back up dizzy, water or a hole floats them back
// to the hatch in a bubble, and grumbles stuck in a tiny space float back too.

addStrings({
  en: {
    'game.guides': 'Grumble Guides',
    'guides.intro': 'Move your ring with the stick. [A] gives a grumble your job, [C] picks another job, hold [B] to go fast.',
    'guides.pick': 'Pick a level',
    'guides.locked': 'Locked',
    'guides.unlock': 'Reach the goal to open the next level · [A] to play',
    'guides.level': 'Level {n}',
    'guides.goal': 'Get {goal} of {total} grumbles home!',
    'guides.home': 'Home',
    'guides.fast': 'Fast!',
    'guides.help': '[A]: give job · [C]: switch · hold [B]: fast',
    'guides.job.stopper': 'Stopper',
    'guides.job.bridge': 'Bridge',
    'guides.job.stairs': 'Stairs',
    'guides.job.digger': 'Dig down',
    'guides.job.tunnel': 'Tunnel',
    'guides.job.umbrella': 'Umbrella',
    'guides.l0': 'Wrong Way!',
    'guides.l1': 'Pond Hop',
    'guides.l2': 'Hilltop House',
    'guides.l3': 'Mole Tunnels',
    'guides.l4': 'Grand Tour',
    'guides.tip0': 'The grumbles walk the wrong way! Point at one and press [A] to make it a Stopper.',
    'guides.tip1': 'Water ahead! A Bridge grumble lays planks over the hole.',
    'guides.tip2': 'Too high! A Stairs grumble builds steps up. Start a few steps before the wall.',
    'guides.tip3': 'Dig down digs straight down. Tunnel digs through a dirt wall. Grey stone is too hard!',
    'guides.tip4': 'Big drop! A grumble with an Umbrella floats down softly. Then use everything you know!',
    'guides.new': 'New job: {job}',
    'guides.goalReached': 'Goal reached!',
    'guides.allHome': 'Everyone is home!',
    'guides.timeUp': 'Time is up!',
    'guides.release': 'Tap a Stopper again to let it walk home!',
    'guides.win': 'Welcome home!',
    'guides.lose': 'So close!',
    'guides.sub': '{name} · {home} of {total} home (goal {goal})',
    'guides.jobs': '{n} jobs',
    'guides.jobs1': '1 job',
    'guides.cheer': 'cheered them on',
    'guides.next': '[A]: next level · [B]: island',
    'guides.retry': '[A]: try again · [B]: island',
    'guides.again': '[A]: play again · [B]: island',
  },
  no: {
    'game.guides': 'Krypeførerne',
    'guides.intro': 'Flytt ringen med spaken. [A] gir et kryp jobben din, [C] bytter jobb, hold [B] for å spole fort.',
    'guides.pick': 'Velg et brett',
    'guides.locked': 'Låst',
    'guides.unlock': 'Nå målet for å åpne neste brett · [A] for å spille',
    'guides.level': 'Brett {n}',
    'guides.goal': 'Få {goal} av {total} kryp hjem!',
    'guides.home': 'Hjemme',
    'guides.fast': 'Fort!',
    'guides.help': '[A]: gi jobb · [C]: bytt · hold [B]: fort',
    'guides.job.stopper': 'Stopper',
    'guides.job.bridge': 'Bro',
    'guides.job.stairs': 'Trapp',
    'guides.job.digger': 'Grav ned',
    'guides.job.tunnel': 'Tunnel',
    'guides.job.umbrella': 'Paraply',
    'guides.l0': 'Feil vei!',
    'guides.l1': 'Dammhopp',
    'guides.l2': 'Huset på toppen',
    'guides.l3': 'Moldvarpgangene',
    'guides.l4': 'Den store turen',
    'guides.tip0': 'Krypene går feil vei! Pek på ett og trykk [A], så blir det en Stopper.',
    'guides.tip1': 'Vann foran! Et Bro-kryp legger planker over hullet.',
    'guides.tip2': 'For høyt! Et Trapp-kryp bygger trinn oppover. Start noen skritt før veggen.',
    'guides.tip3': 'Grav ned graver rett ned. Tunnel graver gjennom en jordvegg. Grå stein er for hard!',
    'guides.tip4': 'Stort fall! Et kryp med paraply svever rolig ned. Så bruker dere alt dere kan!',
    'guides.new': 'Ny jobb: {job}',
    'guides.goalReached': 'Målet er nådd!',
    'guides.allHome': 'Alle er hjemme!',
    'guides.timeUp': 'Tiden er ute!',
    'guides.release': 'Trykk på en Stopper igjen, så går den hjem!',
    'guides.win': 'Velkommen hjem!',
    'guides.lose': 'Nesten!',
    'guides.sub': '{name} · {home} av {total} hjemme (mål {goal})',
    'guides.jobs': '{n} jobber',
    'guides.jobs1': '1 jobb',
    'guides.cheer': 'heiet på dem',
    'guides.next': '[A]: neste brett · [B]: øya',
    'guides.retry': '[A]: prøv igjen · [B]: øya',
    'guides.again': '[A]: spill igjen · [B]: øya',
  },
});

// ---------- grid ----------
const S = 0.5; // world size of one terrain cell
const COLS = 40;
const ROWS = 22;
const DEPTH = 1.1;
const GZ = 0.4; // grumbles walk near the front of the slice so tunnels never hide them
const AIR = 0, DIRT = 1, STONE = 2, PLANK = 3, WATER = 4;

// ---------- timing (seconds of game time per step) ----------
const WALK = 0.3;
const FALL = 0.06;
const FLOAT = 0.2;
const BUILD = 0.4;
const DIG = 0.42;
const BASH = 0.4;
const MAX_FALL = 8; // rows; further than this and a grumble bounces back up dizzy
const STAIR_PLANKS = 8;
const BRIDGE_PLANKS = 8;
const STUCK_TIME = 6; // pacing in a tiny space this long floats a grumble back to the hatch
const FAST = 3;
const CURSOR_SPEED = 10;
const PICK_R = 0.85;

// Order = teaching order; also the job bar order.
const JOBS = ['stopper', 'bridge', 'stairs', 'digger', 'tunnel', 'umbrella'];
const JOB_COLOR = { stopper: 0xff5d73, bridge: 0x3ddc97, stairs: 0xffc93c, digger: 0xff8c42, tunnel: 0x4cc9f0, umbrella: 0xff6fae };
const JOB_CSS = { stopper: '#ff5d73', bridge: '#2fbf80', stairs: '#e0a100', digger: '#f26b1d', tunnel: '#1aa7d8', umbrella: '#ff4f9a' };

const svg = (body) => `<svg viewBox="0 0 24 24" width="1.4em" height="1.4em" style="display:block">${body}</svg>`;
const ICONS = {
  stopper: svg('<polygon points="7,1 17,1 23,7 23,17 17,23 7,23 1,17 1,7" fill="#ff5d73" stroke="#fff" stroke-width="1.5"/><rect x="5" y="10" width="14" height="4" rx="1" fill="#fff"/>'),
  bridge: svg('<rect x="0" y="12" width="6" height="11" rx="1.5" fill="#7ad65a"/><rect x="18" y="12" width="6" height="11" rx="1.5" fill="#7ad65a"/><path d="M6 23 Q12 17 18 23 Z" fill="#56c6f0"/><rect x="2" y="8.5" width="20" height="4" rx="1.5" fill="#e0a86a" stroke="#8a5a32" stroke-width="1.2"/>'),
  stairs: svg('<path d="M2 22 V17 H8 V12 H14 V7 H20 V2 H22 V22 Z" fill="#e0a86a" stroke="#8a5a32" stroke-width="1.5" stroke-linejoin="round"/>'),
  digger: svg('<rect x="1" y="13" width="22" height="10" rx="2" fill="#b87a48"/><path d="M12 2 V15 M6.5 10 L12 15.5 L17.5 10" stroke="#2b2340" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'),
  tunnel: svg('<rect x="12" y="2" width="11" height="20" rx="2" fill="#b87a48"/><path d="M2 12 H17 M12 6.5 L17.5 12 L12 17.5" stroke="#2b2340" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'),
  umbrella: svg('<path d="M2 12 A10 10 0 0 1 22 12 Z" fill="#ff6fae" stroke="#c2185b" stroke-width="1.2"/><path d="M12 12 V20 A2 2 0 0 1 8 20" stroke="#2b2340" stroke-width="2" fill="none" stroke-linecap="round"/>'),
};
const HOUSE_ICON = svg('<path d="M3 11 L12 3 L21 11 Z" fill="#ff7a7a"/><rect x="5" y="11" width="14" height="11" rx="1.5" fill="#fff3dc" stroke="#b87a48" stroke-width="1.2"/><rect x="10" y="15" width="4" height="7" rx="1" fill="#8a5a32"/>');

const THEMES = {
  garden: {
    sky: ['#8fdcff', '#fff1d6'], dirt: [0xd99a62, 0xcf8f58], deep: 0xa86d42, stone: [0xbdb8cf, 0xb0aac6],
    cap: 0x7ad65a, capStone: true, hole: 0x6e4a2e, hills: [0x9be07f, 0x7ccf6a], music: 'platformer',
  },
  sunset: {
    sky: ['#ff9fb2', '#ffe2a8'], dirt: [0xd99a62, 0xcf8f58], deep: 0xa0603e, stone: [0xc2b2d6, 0xb4a4ca],
    cap: 0x86d45e, capStone: true, hole: 0x6e4a2e, hills: [0xd59bd6, 0xb98ad0], music: 'platformer',
  },
  cave: {
    sky: ['#2f2550', '#6a4f86'], dirt: [0xb98060, 0xad7556], deep: 0x8a5a48, stone: [0x8f87ad, 0x847ca3],
    cap: 0x6fdca8, capStone: false, hole: 0x3b2840, back: 0x55426f, music: 'bubble',
  },
};

// Hand-made levels, top row first. '#' dirt (diggable)  'S' stone  '~' water  '.' air
// 'H' hatch (where grumbles drop out)  'E' the house door (the cell a grumble walks into).
const LEVELS = [
  {
    theme: 'garden', total: 10, goal: 6, time: 150, interval: 1.7, dir: 1, jobs: { stopper: 2 },
    map: [
      '........................................',
      '........................................',
      '........................................',
      '........................................',
      '........................................',
      '........................................',
      '........................................',
      '........................................',
      '........................................',
      '........................................',
      '......................H.................',
      '........................................',
      'S......................................S',
      'S...E......#####....................###S',
      '##############################~~~~~~####',
      '##############################~~~~~~####',
      '##############################~~~~~~####',
      '##############################~~~~~~####',
      '########################################',
      '########################################',
      'SSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSS',
      'SSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSS',
    ],
  },
  {
    theme: 'garden', total: 12, goal: 8, time: 180, interval: 1.7, dir: 1, jobs: { bridge: 3, stopper: 1 },
    map: [
      '........................................',
      '........................................',
      '........................................',
      '........................................',
      '........................................',
      '........................................',
      '........................................',
      '........................................',
      '........................................',
      '...H....................................',
      '........................................',
      'S......................................S',
      'S......###.........................E...S',
      '#############......######....###########',
      '#############......######....###########',
      '#############~~~~~~######~~~~###########',
      '#############~~~~~~######~~~~###########',
      '#############~~~~~~######~~~~###########',
      '#############~~~~~~######~~~~###########',
      '########################################',
      'SSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSS',
      'SSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSS',
    ],
  },
  {
    theme: 'garden', total: 12, goal: 8, time: 210, interval: 1.7, dir: 1, jobs: { stairs: 3, bridge: 2 },
    map: [
      '........................................',
      '........................................',
      '........................................',
      '........................................',
      '........................................',
      '........................................',
      '........................................',
      '........................................',
      '........................................',
      '.......................................S',
      '...................................E...S',
      '....................#######....########S',
      '....................#######....########S',
      '...H................SSSSSSS....SSSSSSSSS',
      '....................SSSSSSS....SSSSSSSSS',
      'S...................SSSSSSS~~~~SSSSSSSSS',
      'S...................SSSSSSS~~~~SSSSSSSSS',
      '####################SSSSSSSSSSSSSSSSSSSS',
      '####################SSSSSSSSSSSSSSSSSSSS',
      '####################SSSSSSSSSSSSSSSSSSSS',
      '####################SSSSSSSSSSSSSSSSSSSS',
      'SSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSS',
    ],
  },
  {
    theme: 'cave', total: 14, goal: 10, time: 240, interval: 1.6, dir: 1, jobs: { digger: 2, tunnel: 2 },
    map: [
      'SSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSS',
      'SSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSS',
      'SSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSS',
      'S.............SSSS.............SSSSSSSSS',
      'S.............SSSS.............SSSSSSSSS',
      'S.............SSSS.............SSSSSSSSS',
      'S..H..........SSSS.............SSSSSSSSS',
      'S.............####.............SSSSSSSSS',
      'S.............####.............SSSSSSSSS',
      'S.............####.............SSSSSSSSS',
      '###############################SSSSSSSSS',
      '###############################SSSSSSSSS',
      '###############################SSSSSSSSS',
      'SSSSSSSSSSSSSSSSSS.....................S',
      'SSSSSSSSSSSSSSSSSS.....................S',
      'SSSSSSSSSSSSSSSSSS.....................S',
      'SSSSSSSSSSSSSSSSSS................E....S',
      'SSSSSSSSSSSSSSSSSS#####################S',
      'SSSSSSSSSSSSSSSSSS#####################S',
      'SSSSSSSSSSSSSSSSSS#####################S',
      'SSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSS',
      'SSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSS',
    ],
  },
  {
    theme: 'sunset', total: 15, goal: 10, time: 300, interval: 2.0, dir: 1,
    jobs: { stopper: 2, bridge: 2, stairs: 2, digger: 2, tunnel: 2, umbrella: 15 },
    map: [
      '........................................',
      '........................................',
      '........................................',
      'S..H....................................',
      'S.......................................',
      'SSSSSSSSSS..............................',
      'SSSSSSSSSS..............................',
      'SSSSSSSSSS..............................',
      'SSSSSSSSSS..............................',
      'SSSSSSSSSS.............................S',
      'SSSSSSSSSS.................####........S',
      'SSSSSSSSSS.................####........S',
      'SSSSSSSSSS.................####........S',
      'SSSSSSSSSS.................####........S',
      'SSSSSSSSSS########.....################S',
      'SSSSSSSSSS########~~~~~################S',
      'SSSSSSSSSS########~~~~~########........S',
      'SSSSSSSSSS########~~~~~########........S',
      'SSSSSSSSSS########~~~~~########........S',
      'SSSSSSSSSS#####################....E...S',
      'SSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSS',
      'SSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSS',
    ],
  },
];

const wx = (c) => (c + 0.5) * S - (COLS * S) / 2;
const wy = (r) => r * S;
const lerp = THREE.MathUtils.lerp;
const hash = (c, r) => {
  const n = Math.sin(c * 127.1 + r * 311.7) * 43758.5453;
  return n - Math.floor(n);
};
const clock = (sec) => {
  const s = Math.max(0, Math.ceil(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

function mesh(geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
}

const box = (key, w, h, d, r = 0.04, seg = 2) => sharedGeo(`gd-${key}`, () => new RoundedBoxGeometry(w, h, d, seg, r));
const sph = (r, w = 12, h = 8) => sharedGeo(`gd-sph${r}`, () => new THREE.SphereGeometry(r, w, h));
const cyl = (key, rt, rb, h, seg = 12) => sharedGeo(`gd-${key}`, () => new THREE.CylinderGeometry(rt, rb, h, seg));

export class GuidesScene extends MiniGame {
  constructor(game, opts = {}) {
    super(game, opts);
    const saved = game.roster.progress.guides || {};
    this.unlocked = Math.min(LEVELS.length - 1, saved.unlocked || 0);
    this.bestStars = saved.stars || [];
    this.picking = opts.level === undefined;
    this.levelIndex = this.picking ? this.unlocked : Math.max(0, Math.min(LEVELS.length - 1, opts.level));
    this.selection = this.levelIndex;
    this.level = LEVELS[this.levelIndex];
    this.theme = THEMES[this.level.theme];

    this.camera.fov = 40;
    this.scene.background = skyTexture(...this.theme.sky);
    this.sun = addLights(this.scene, { size: 14, target: new THREE.Vector3(0, 5, 0), dir: new THREE.Vector3(-0.45, 0.9, 0.8) }).sun;

    this.simTime = 0;
    this.timeLeft = this.level.time;
    this.home = 0;
    this.released = 0;
    this.spawnT = 0;
    this.hatchOpen = 0;
    this.levelOver = false;
    this.fast = false;
    this.goalToast = false;
    this.releaseToast = false;
    this.barCache = '';
    this.counts = {};
    this.jobList = JOBS.filter((j) => this.level.jobs[j]);
    for (const j of this.jobList) this.counts[j] = this.level.jobs[j];

    this.parseMap();
    this.buildTerrainMeshes();
    this.buildDecor();
    this.buildHatch();
    this.buildHouse();
    this.rebuildTerrain();
    this.buildGrumbles();
    this.buildCursors();
    this.frame();

    game.audio.playMusic(this.theme.music);
    if (this.picking) this.openPicker();
    else this.startIntro();
  }

  levelName(i = this.levelIndex) {
    return t(`guides.l${i}`);
  }

  startIntro() {
    this.intro(`${t('guides.level', { n: this.levelIndex + 1 })}: ${this.levelName()}`, t('guides.goal', { goal: this.level.goal, total: this.level.total }));
  }

  onStart() {
    this.game.ui.toast(t(`guides.tip${this.levelIndex}`), 5500);
    // Point out jobs this level brings that earlier levels didn't have.
    const seen = new Set(LEVELS.slice(0, this.levelIndex).flatMap((lv) => Object.keys(lv.jobs)));
    const fresh = this.jobList.filter((j) => !seen.has(j));
    if (this.levelIndex > 0 && fresh.length) this.game.ui.toast(t('guides.new', { job: fresh.map((j) => t(`guides.job.${j}`)).join(', ') }), 4500);
  }

  retryOptions() {
    return this.state === 'select' ? { key: this.key } : { key: this.key, level: this.levelIndex };
  }

  campaignStats() {
    return { home: this.home, total: this.level.total, goal: this.level.goal, stars: this.starsFor(this.home) };
  }

  // ---------- level data ----------

  parseMap() {
    this.grid = new Uint8Array(COLS * ROWS);
    this.orig = new Uint8Array(COLS * ROWS);
    const map = this.level.map;
    for (let i = 0; i < ROWS; i++) {
      const r = ROWS - 1 - i;
      for (let c = 0; c < COLS; c++) {
        const ch = map[i][c];
        let v = AIR;
        if (ch === '#') v = DIRT;
        else if (ch === 'S') v = STONE;
        else if (ch === '~') v = WATER;
        else if (ch === 'H') this.hatch = { c, r };
        else if (ch === 'E') this.door = { c, r };
        this.grid[r * COLS + c] = v;
      }
    }
    this.orig.set(this.grid);
  }

  cell(c, r) {
    if (c < 0 || c >= COLS) return STONE;
    if (r < 0 || r >= ROWS) return AIR;
    return this.grid[r * COLS + c];
  }

  solid(c, r) {
    const v = this.cell(c, r);
    return v === DIRT || v === STONE || v === PLANK;
  }

  free(c, r) {
    return !this.solid(c, r);
  }

  water(c, r) {
    return this.cell(c, r) === WATER;
  }

  diggable(c, r) {
    const v = this.cell(c, r);
    return v === DIRT || v === PLANK;
  }

  /** Planks can go into air or water inside the level. */
  placeable(c, r) {
    if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return false;
    const v = this.grid[r * COLS + c];
    return v === AIR || v === WATER;
  }

  setCell(c, r, v) {
    if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return;
    this.grid[r * COLS + c] = v;
    this.terrainDirty = true;
  }

  canBash(c, r) {
    if (c < 0 || c >= COLS) return false;
    if (this.cell(c, r) === STONE || this.cell(c, r + 1) === STONE) return false;
    return this.diggable(c, r) || this.diggable(c, r + 1);
  }

  // ---------- terrain visuals ----------

  buildTerrainMeshes() {
    const n = COLS * ROWS;
    const white = toon(0xffffff);
    const make = (geo, mat, shadows = true) => {
      const m = new THREE.InstancedMesh(geo, mat, n);
      m.count = 0;
      m.castShadow = shadows;
      m.receiveShadow = true;
      m.frustumCulled = false;
      this.scene.add(m);
      return m;
    };
    this.instanced = [
      this.dirtMesh = make(box('dirt', S, S, DEPTH, 0.035, 1), white),
      this.stoneMesh = make(box('stone', S * 0.98, S * 0.98, DEPTH, 0.09, 1), white),
      this.capMesh = make(box('cap', S * 1.04, 0.13, DEPTH + 0.06, 0.05, 1), white),
      this.plankMesh = make(box('plank', S * 1.06, 0.22, DEPTH * 0.85, 0.06, 1), white),
      this.waterMesh = make(sharedGeo('gd-water', () => new THREE.BoxGeometry(S, S, DEPTH * 0.96)), toon(COLORS.water, { transparent: true, opacity: 0.72 }), false),
      this.holeMesh = make(sharedGeo('gd-hole', () => new THREE.BoxGeometry(S, S, 0.06)), white, false),
    ];
    // Every instance gets a color slot up front so setColorAt never reallocates.
    const col = new THREE.Color(0xffffff);
    for (const m of this.instanced) m.setColorAt(0, col);
  }

  rebuildTerrain() {
    this.terrainDirty = false;
    const th = this.theme;
    const m4 = new THREE.Matrix4();
    const col = new THREE.Color();
    const tmp = new THREE.Color();
    const counts = [0, 0, 0, 0, 0, 0];
    const meshes = [this.dirtMesh, this.stoneMesh, this.capMesh, this.plankMesh, this.waterMesh, this.holeMesh];
    const add = (k, x, y, z, color) => {
      const i = counts[k]++;
      m4.makeTranslation(x, y, z);
      meshes[k].setMatrixAt(i, m4);
      meshes[k].setColorAt(i, col.set(color));
    };
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const v = this.grid[r * COLS + c];
        const x = wx(c), y = (r + 0.5) * S;
        const h = hash(c, r);
        const open = this.cell(c, r + 1) === AIR;
        if (v === DIRT) {
          // Two warm tones plus a darker band deeper down.
          col.set(th.dirt[h < 0.5 ? 0 : 1]).lerp(tmp.set(th.deep), Math.max(0, 0.55 - r / ROWS) * 0.8);
          add(0, x, y, 0, col.getHex());
          if (open) add(2, x, (r + 1) * S - 0.045, 0, th.cap);
        } else if (v === STONE) {
          add(1, x, y, 0, th.stone[h < 0.5 ? 0 : 1]);
          if (open && th.capStone && r > 2) add(2, x, (r + 1) * S - 0.045, 0, th.cap);
        } else if (v === PLANK) {
          add(3, x, (r + 1) * S - 0.11, 0.05, (c + r) % 2 ? 0xe0a86a : 0xd29858);
        } else if (v === WATER) {
          add(4, x, open ? y - 0.04 : y, 0, open ? COLORS.water : COLORS.waterDeep);
        }
        // Dug-out dirt leaves a dark burrow behind it.
        if (v !== DIRT && this.orig[r * COLS + c] === DIRT) add(5, x, y, -DEPTH / 2 + 0.03, th.hole);
      }
    }
    meshes.forEach((m, k) => {
      m.count = counts[k];
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    });
    // Flowers and mushrooms disappear when the ground under them is dug away.
    for (const d of this.surfaceDecor || []) d.obj.visible = this.solid(d.c, d.r) && this.cell(d.c, d.r + 1) === AIR;
  }

  /** Highest solid row in a column (or -1). */
  topRow(c) {
    for (let r = ROWS - 1; r >= 0; r--) if (this.solid(c, r) || this.water(c, r)) return r;
    return -1;
  }

  buildDecor() {
    const rand = seeded(31 + this.levelIndex * 17);
    this.surfaceDecor = [];
    const W = COLS * S, H = ROWS * S;
    if (this.level.theme === 'cave') {
      // Back wall of the cave, rocky bumps, glowing crystals and mushrooms.
      const wall = mesh(new THREE.PlaneGeometry(W + 30, H + 20), toon(this.theme.back), 0, H / 2, -DEPTH / 2 - 0.05);
      wall.receiveShadow = true;
      this.scene.add(wall);
      for (let i = 0; i < 40; i++) {
        const b = mesh(sharedGeo('gd-bump', () => faceted(new THREE.IcosahedronGeometry(1, 0))), toon(rand() < 0.5 ? 0x4a3a63 : 0x63507e, { flat: true }), (rand() - 0.5) * (W + 10), rand() * H, -DEPTH / 2 - 0.4);
        b.scale.set(0.5 + rand() * 1.2, 0.4 + rand() * 0.9, 0.4);
        b.rotation.set(rand() * 3, rand() * 3, rand() * 3);
        this.scene.add(b);
      }
      const gemColors = [0x4cc9f0, 0xff6fae, 0x9ff0c8, 0xc9a8ff];
      for (let c = 1; c < COLS - 1; c++) {
        const r = this.findFloor(c, rand);
        if (r < 0) continue;
        if (rand() < 0.22) {
          const m = makeMushroom(rand() < 0.5 ? 0x6fdca8 : 0xff9fd0);
          m.scale.setScalar(0.2 + rand() * 0.08);
          m.position.set(wx(c) + (rand() - 0.5) * 0.2, (r + 1) * S, -0.3);
          this.scene.add(m);
          this.surfaceDecor.push({ obj: m, c, r });
        } else if (rand() < 0.22) {
          const gm = makeGem(gemColors[Math.floor(rand() * gemColors.length)]);
          gm.scale.setScalar(0.5 + rand() * 0.3);
          gm.position.set(wx(c), (r + 1) * S + 0.15, -0.35);
          gm.rotation.z = (rand() - 0.5) * 0.6;
          this.scene.add(gm);
          this.surfaceDecor.push({ obj: gm, c, r });
        }
      }
      // Stalactites under ceilings.
      for (let c = 0; c < COLS; c++) {
        for (let r = ROWS - 1; r > 2; r--) {
          if (this.solid(c, r) && this.cell(c, r - 1) === AIR && rand() < 0.3) {
            const st = mesh(sharedGeo('gd-stal', () => new THREE.ConeGeometry(0.12, 0.4, 6)), toon(0x7a6f9c), wx(c) + (rand() - 0.5) * 0.15, r * S - 0.18, -0.35);
            st.rotation.x = Math.PI;
            st.scale.y = 0.6 + rand() * 0.8;
            this.scene.add(st);
          }
        }
      }
    } else {
      // Rolling hills far behind, clouds, then trees and bushes just behind the slice.
      const [h1, h2] = this.theme.hills;
      for (let i = 0; i < 7; i++) {
        const hill = mesh(sph(1, 24, 14), toon(i % 2 ? h1 : h2), (i - 3) * 7 + (rand() - 0.5) * 3, -1.5, -14 - (i % 2) * 4);
        hill.scale.set(6 + rand() * 3, 4 + rand() * 3.5, 2);
        this.scene.add(hill);
      }
      for (let i = 0; i < 7; i++) {
        const cl = makeCloud(rand, 0.9 + rand() * 0.8);
        cl.position.set((rand() - 0.5) * 34, 7 + rand() * 6, -10 - rand() * 6);
        this.scene.add(cl);
      }
      for (let c = 1; c < COLS - 1; c += 1) {
        const r = this.topRow(c);
        if (r < 0 || !this.solid(c, r)) continue;
        if (rand() < 0.12 && c % 3 === 0) {
          const tree = makeTree(rand, 0.45 + rand() * 0.2, this.level.theme === 'sunset' ? [0xffb36b, 0xff8f6b] : null);
          tree.position.set(wx(c), (r + 1) * S - 0.25, -1.5 - rand() * 0.8);
          this.scene.add(tree);
        } else if (rand() < 0.12) {
          const b = makeBush(rand, 0.45);
          b.position.set(wx(c), (r + 1) * S - 0.1, -0.9);
          this.scene.add(b);
        }
        if (rand() < 0.4 && c !== this.door.c && Math.abs(c - this.door.c) > 1) {
          const f = makeFlower(rand);
          f.scale.setScalar(0.5);
          f.position.set(wx(c) + (rand() - 0.5) * 0.2, (r + 1) * S - 0.02, -0.25 - rand() * 0.2);
          this.scene.add(f);
          this.surfaceDecor.push({ obj: f, c, r });
        }
      }
    }
  }

  /** A random floor row in column c (solid with air above), or -1. */
  findFloor(c, rand) {
    const spots = [];
    for (let r = 1; r < ROWS - 1; r++) if (this.solid(c, r) && this.cell(c, r + 1) === AIR) spots.push(r);
    return spots.length ? spots[Math.floor(rand() * spots.length)] : -1;
  }

  buildHatch() {
    const g = new THREE.Group();
    g.position.set(wx(this.hatch.c), (this.hatch.r + 1) * S + 0.05, 0.25);
    const bodyM = mesh(box('hatch', 1.1, 0.55, 0.9, 0.1), toon(0xc98b5a), 0, 0.32, 0);
    const band = mesh(box('hatchBand', 1.14, 0.12, 0.94, 0.04), toon(0x8a5a32), 0, 0.45, 0);
    const roof = mesh(box('hatchRoof', 1.3, 0.14, 1.0, 0.06), toon(0xff7a7a), 0, 0.64, 0);
    bodyM.castShadow = true;
    g.add(bodyM, band, roof);
    // Two trapdoor flaps that swing open.
    this.flaps = [-1, 1].map((s) => {
      const pivot = new THREE.Group();
      pivot.position.set(s * 0.5, 0.04, 0);
      const flap = mesh(box('hatchFlap', 0.5, 0.07, 0.8, 0.03), toon(0x8a5a32), -s * 0.25, 0, 0);
      pivot.add(flap);
      pivot.userData.s = s;
      g.add(pivot);
      return pivot;
    });
    if (this.level.theme === 'cave') {
      for (const s of [-1, 1]) {
        const rope = mesh(cyl('rope', 0.03, 0.03, 4, 6), toon(0xe8d3a6), s * 0.4, 2.7, 0);
        g.add(rope);
      }
    } else {
      // A bunch of balloons keeps the garden hatch floating.
      [[-0.33, 1.2, 0xff5d73], [0.33, 1.25, 0x4cc9f0], [0, 1.45, 0xffc93c]].forEach(([x, y, c]) => {
        const b = mesh(sph(0.23, 16, 12), toon(c), x, y, 0);
        b.scale.y = 1.15;
        const str = mesh(cyl('bstring', 0.012, 0.012, y - 0.65, 4), toon(COLORS.white), x * 0.5, (y + 0.65) / 2 - 0.1, 0);
        str.rotation.z = x * 0.5;
        g.add(b, str);
      });
    }
    this.hatchGroup = g;
    this.scene.add(g);
    this.hatchLabel = this.game.ui.label('label');
  }

  buildHouse() {
    const g = new THREE.Group();
    g.position.set(wx(this.door.c), wy(this.door.r), 0);
    const walls = mesh(box('hWalls', 1.5, 1.1, 0.8, 0.08), toon(COLORS.cream), 0, 0.55, -0.05);
    walls.castShadow = walls.receiveShadow = true;
    const roof = mesh(sharedGeo('gd-roof', () => new THREE.ConeGeometry(1.15, 0.72, 4)), toon(0xff7a7a), 0, 1.45, -0.05);
    roof.rotation.y = Math.PI / 4;
    roof.scale.z = 0.62;
    roof.castShadow = true;
    const chimney = mesh(box('hChim', 0.2, 0.42, 0.2, 0.03), toon(0xb87a48), 0.42, 1.55, -0.1);
    const door = mesh(box('hDoor', 0.44, 0.66, 0.1, 0.06), toon(0x8a5a32), 0, 0.33, 0.38);
    const knob = mesh(sph(0.04), toon(COLORS.gold), 0.13, 0.32, 0.45);
    const mat = mesh(box('hMat', 0.6, 0.04, 0.3, 0.02), toon(0x3ddc97), 0, 0.02, 0.5);
    g.add(walls, roof, chimney, door, knob, mat);
    this.windows = [-1, 1].map((s) => {
      const frame = mesh(box('hWinF', 0.34, 0.34, 0.06, 0.03), toon(COLORS.white), s * 0.48, 0.68, 0.36);
      const pane = mesh(box('hWin', 0.25, 0.25, 0.07, 0.02), toon(0xffe47a, { emissive: 0x553300 }), s * 0.48, 0.68, 0.37);
      g.add(frame, pane);
      return pane;
    });
    for (const s of [-1, 1]) {
      const pot = mesh(cyl('hPot', 0.09, 0.07, 0.14, 10), toon(0xff8c42), s * 0.62, 0.07, 0.42);
      const bloom = mesh(sph(0.08), toon(s < 0 ? 0xff6fae : 0xffc93c), s * 0.62, 0.2, 0.42);
      g.add(pot, bloom);
    }
    this.chimneyTop = new THREE.Vector3(wx(this.door.c) + 0.42, wy(this.door.r) + 1.8, -0.1);
    this.smokeT = 0;
    this.houseGroup = g;
    this.scene.add(g);
    this.houseLabel = this.game.ui.label('label');
  }

  // ---------- grumbles ----------

  buildGrumbles() {
    this.grumbles = [];
    const tones = [0x7b6cf6, 0x8f7cff, 0x6c5ce7, 0x9a86ff];
    const footGeo = sharedGeo('gFoot', () => new THREE.SphereGeometry(0.11, 8, 6));
    for (let i = 0; i < this.level.total; i++) {
      const root = new THREE.Group();
      const body = makeGrumble(tones[i % tones.length]);
      body.scale.setScalar(0.72);
      root.add(body);
      const feet = body.children.filter((ch) => ch.geometry === footGeo);
      const parts = this.makeGear(body, root);
      root.visible = false;
      this.scene.add(root);
      this.grumbles.push({
        id: i, root, body, feet, parts, out: false,
        cx: this.hatch.c, cy: this.hatch.r, px: this.hatch.c, py: this.hatch.r, dir: this.level.dir,
        state: 'wait', t: 0, dur: 1, job: null, activeJob: null, giver: null, phase: null, work: 0, planks: 0,
        umbrella: false, floating: false, fallDist: 0, ground: null, dizzy: 0, yaw: 0, walk: 0, squash: 1,
        anchor: { c: 0, r: 0, t: 0 }, rx: 0, ry: 0, z: GZ + (i % 3) * 0.03,
      });
    }
  }

  /** Hats, tools and props for every job; shown or hidden per state. Coordinates are grumble units. */
  makeGear(body, root) {
    const p = {};
    const hat = new THREE.Group();
    hat.position.y = 0.74;
    p.hatDome = mesh(sharedGeo('gd-hatDome', () => new THREE.SphereGeometry(0.36, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2)), toon(0xffc93c));
    p.hatBrim = mesh(cyl('hatBrim', 0.46, 0.46, 0.05, 18), toon(0xffc93c), 0, 0.02, 0.04);
    p.lamp = mesh(cyl('lamp', 0.08, 0.08, 0.08, 10), toon(0xfff3a0, { emissive: 0x887700 }), 0, 0.18, 0.33);
    p.lamp.rotation.x = Math.PI / 2;
    hat.add(p.hatDome, p.hatBrim, p.lamp);
    p.hat = hat;
    body.add(hat);

    // Stairs: a hammer.
    const hammer = new THREE.Group();
    hammer.position.set(0.48, 0.42, 0.1);
    hammer.add(mesh(cyl('hamStick', 0.035, 0.035, 0.45, 6), toon(COLORS.trunk), 0, 0.2, 0));
    hammer.add(mesh(box('hamHead', 0.24, 0.12, 0.12, 0.03), toon(0x8a94a8), 0, 0.42, 0));
    p.hammer = hammer;
    // Dig down: a shovel held in front.
    const shovel = new THREE.Group();
    shovel.position.set(0.25, 0.3, 0.42);
    shovel.add(mesh(cyl('shovStick', 0.03, 0.03, 0.5, 6), toon(COLORS.trunk), 0, 0.1, 0));
    shovel.add(mesh(box('shovBlade', 0.22, 0.24, 0.04, 0.03), toon(0xb8c0d0), 0, -0.2, 0));
    shovel.rotation.z = 0.3;
    p.shovel = shovel;
    // Tunnel: a spinning drill pointing forward.
    const drill = new THREE.Group();
    drill.position.set(0, 0.38, 0.45);
    p.drillBit = mesh(sharedGeo('gd-drill', () => new THREE.ConeGeometry(0.17, 0.42, 8)), toon(0x8fd8ff, { flat: true }), 0, 0, 0.18);
    p.drillBit.rotation.x = Math.PI / 2;
    drill.add(p.drillBit, mesh(cyl('drillBase', 0.16, 0.16, 0.12, 10), toon(0x4cc9f0), 0, 0, -0.02));
    drill.children[1].rotation.x = Math.PI / 2;
    p.drill = drill;
    // Bridge: a plank balanced on the hat.
    p.plank = mesh(box('carryPlank', 0.95, 0.08, 0.24, 0.03), toon(0xe0a86a), 0, 1.06, 0);
    // Stopper: arms out and a little stop sign.
    const stop = new THREE.Group();
    for (const s of [-1, 1]) {
      stop.add(mesh(cyl('arm', 0.05, 0.05, 0.36, 6), toon(0x7b6cf6), s * 0.55, 0.5, 0.05));
      stop.children[stop.children.length - 1].rotation.z = Math.PI / 2;
      stop.add(mesh(sph(0.1), toon(0xffb347), s * 0.75, 0.5, 0.05));
    }
    stop.add(mesh(cyl('signStick', 0.03, 0.03, 0.6, 6), toon(COLORS.trunk), 0.75, 0.8, 0.05));
    const sign = mesh(cyl('sign', 0.24, 0.24, 0.05, 8), toon(0xff5d73), 0.75, 1.15, 0.08);
    sign.rotation.x = Math.PI / 2;
    sign.rotation.y = Math.PI / 8;
    stop.add(sign, mesh(box('signBar', 0.3, 0.08, 0.02, 0.01), toon(COLORS.white), 0.75, 1.15, 0.12));
    p.stop = stop;
    body.add(hammer, shovel, drill, p.plank, stop);

    // Umbrella: folded on the back while walking, open while floating.
    p.umbClosed = mesh(sharedGeo('gd-umbC', () => new THREE.ConeGeometry(0.08, 0.6, 8)), toon(0xff6fae), -0.32, 0.6, -0.32);
    p.umbClosed.rotation.z = -0.5;
    const umb = new THREE.Group();
    umb.position.y = 0.95;
    const canopy = mesh(sharedGeo('gd-umbO', () => new THREE.ConeGeometry(0.75, 0.38, 10, 1, true)), toon(0xff6fae), 0, 0.75, 0);
    const tip = mesh(sph(0.05), toon(COLORS.white), 0, 0.96, 0);
    const stick = mesh(cyl('umbStick', 0.025, 0.025, 0.75, 6), toon(COLORS.ink), 0, 0.38, 0);
    umb.add(canopy, tip, stick);
    p.umbOpen = umb;
    body.add(p.umbClosed, umb);

    // Dizzy stars and the rescue bubble live on the root so they don't spin with the body.
    const stars = new THREE.Group();
    stars.position.y = 0.78;
    for (let i = 0; i < 3; i++) stars.add(mesh(sharedGeo('gd-dstar', () => new THREE.OctahedronGeometry(0.08)), toon(COLORS.gold, { emissive: 0x443300 })));
    p.stars = stars;
    p.bubble = mesh(sph(0.5, 18, 14), toon(0xbfe9ff, { transparent: true, opacity: 0.42 }), 0, 0.36, 0);
    p.shine = mesh(sph(0.08), toon(COLORS.white), -0.2, 0.6, 0.38);
    root.add(stars, p.bubble, p.shine);
    return p;
  }

  /** The job a grumble is showing: a waiting job while walking, otherwise its active one. */
  shownJob(g) {
    return g.state === 'walk' ? g.job : g.activeJob;
  }

  spawn(g) {
    g.out = true;
    g.root.visible = true;
    g.state = 'fall';
    g.cx = g.px = this.hatch.c;
    g.cy = g.py = this.hatch.r;
    g.dir = this.level.dir;
    g.fallDist = 0;
    g.ground = null;
    g.t = 0;
    g.dur = FALL * 2;
    g.squash = 0.5;
    g.anchor = { c: g.cx, r: g.cy, t: this.simTime };
    g.rx = wx(g.cx);
    g.ry = wy(g.cy);
    this.released++;
    this.game.audio.play('pop');
  }

  // ---------- simulation steps (one grid move per step) ----------

  simulate(dt) {
    this.simTime += dt;
    // Release the next grumble once the hatch is open.
    if (this.released < this.level.total) {
      this.hatchOpen = Math.min(1, this.hatchOpen + dt * 1.5);
      this.spawnT -= dt;
      if (this.hatchOpen >= 1 && this.spawnT <= 0) {
        this.spawn(this.grumbles[this.released]);
        this.spawnT = this.level.interval;
      }
    } else {
      this.hatchOpen = Math.max(0, this.hatchOpen - dt);
    }
    for (const g of this.grumbles) {
      if (!g.out || g.state === 'gone') continue;
      g.dizzy = Math.max(0, g.dizzy - dt);
      g.t += dt;
      for (let guard = 0; guard < 4 && g.t >= g.dur && g.state !== 'gone'; guard++) {
        g.t -= g.dur;
        this.step(g);
      }
    }
    if (this.terrainDirty) this.rebuildTerrain();
  }

  step(g) {
    g.px = g.cx;
    g.py = g.cy;
    // A plank laid right where a grumble stands lifts it on top.
    for (let i = 0; i < 3 && g.state !== 'bubble' && g.state !== 'home' && this.solid(g.cx, g.cy); i++) g.py = ++g.cy;
    if (g.state !== 'walk') g.anchor = { c: g.cx, r: g.cy, t: this.simTime };
    switch (g.state) {
      case 'walk': this.walkStep(g); break;
      case 'fall': this.fallStep(g); break;
      case 'stop': this.stopStep(g); break;
      case 'stairs': this.stairsStep(g); break;
      case 'bridge': this.bridgeStep(g); break;
      case 'dig': this.digStep(g); break;
      case 'bash': this.bashStep(g); break;
      case 'bounce': g.state = 'walk'; g.dur = 0.15; break;
      case 'bubble': this.endBubble(g); break;
      case 'home': g.state = 'gone'; g.root.visible = false; break;
      default: break;
    }
  }

  setGround(g) {
    g.ground = { cx: g.cx, cy: g.cy, dir: g.dir };
  }

  stopperAt(c, r, self) {
    for (const s of this.grumbles) if (s !== self && s.state === 'stop' && s.cx === c && Math.abs(s.cy - r) <= 1) return true;
    return false;
  }

  walkStep(g) {
    g.dur = WALK * (g.dizzy > 0 ? 1.7 : 1);
    if (this.water(g.cx, g.cy)) return this.toBubble(g);
    if (this.atDoor(g)) return this.goHome(g);
    if (!this.solid(g.cx, g.cy - 1)) {
      this.beginFall(g);
      return this.fallStep(g);
    }
    this.setGround(g);
    // Pacing back and forth in a tiny space for a while: float back to the hatch.
    const a = g.anchor;
    if (Math.abs(g.cx - a.c) > 5 || Math.abs(g.cy - a.r) > 3) g.anchor = { c: g.cx, r: g.cy, t: this.simTime };
    else if (g.dizzy <= 0 && this.simTime - a.t > STUCK_TIME) return this.toBubble(g);

    const nx = g.cx + g.dir, cy = g.cy;
    if (this.stopperAt(nx, cy, g)) return this.turn(g);
    if (this.free(nx, cy) && this.free(nx, cy + 1)) {
      if (g.job === 'bridge' && !this.solid(nx, cy - 1) && !this.solid(nx, cy - 2)) return this.startBridge(g);
      g.cx = nx;
      // Small steps down are part of walking; anything deeper is a fall.
      if (!this.solid(nx, cy - 1) && this.solid(nx, cy - 2) && !this.water(nx, cy - 1)) g.cy = cy - 1;
    } else if (this.solid(nx, cy) && this.free(nx, cy + 1) && this.free(nx, cy + 2) && this.free(g.cx, cy + 2)) {
      g.cx = nx;
      g.cy = cy + 1;
    } else if (g.job === 'tunnel' && this.canBash(nx, cy)) {
      return this.startBash(g);
    } else {
      return this.turn(g);
    }
    this.afterMove(g);
  }

  turn(g) {
    g.dir = -g.dir;
    g.dur = WALK * 0.6;
  }

  atDoor(g) {
    return g.cx === this.door.c && Math.abs(g.cy - this.door.r) <= 1;
  }

  afterMove(g) {
    if (g.cy < 0 || this.water(g.cx, g.cy)) return this.toBubble(g);
    if (this.atDoor(g) && (g.state === 'walk' || g.state === 'bash' || g.state === 'bridge')) this.goHome(g);
  }

  beginFall(g) {
    g.state = 'fall';
    g.fallDist = 0;
    g.floating = false;
  }

  fallStep(g) {
    if (this.solid(g.cx, g.cy - 1)) return this.land(g);
    g.cy -= 1;
    g.fallDist++;
    g.floating = g.umbrella && g.fallDist > 1;
    g.dur = g.floating ? FLOAT : FALL;
    if (g.cy < 0 || this.water(g.cx, g.cy)) this.toBubble(g);
  }

  land(g) {
    g.floating = false;
    if (g.fallDist > MAX_FALL && !g.umbrella) return this.bounce(g);
    g.state = 'walk';
    g.dur = 0.12;
    if (g.fallDist >= 3) {
      g.squash = 0.6;
      this.game.audio.play('land');
    }
  }

  /** Too big a fall: boing back up to the last ledge, dizzy, facing away from the drop. */
  bounce(g) {
    const lg = g.ground;
    const ok = lg && this.solid(lg.cx, lg.cy - 1) && this.free(lg.cx, lg.cy) && this.free(lg.cx, lg.cy + 1);
    g.state = 'bounce';
    g.anim = { fx: g.cx, fy: g.cy, peak: ok ? Math.max(lg.cy, g.cy) + 3 : g.cy + 2 };
    if (ok) {
      g.cx = lg.cx;
      g.cy = lg.cy;
      g.dir = -lg.dir;
    }
    g.px = g.anim.fx;
    g.py = g.anim.fy;
    g.dur = ok ? 0.85 : 0.5;
    g.dizzy = 2.4;
    g.squash = 0.45;
    this.puffs.burst(new THREE.Vector3(wx(g.anim.fx), wy(g.anim.fy) + 0.1, GZ), 0xffffff, { count: 6, size: 0.18, life: 0.4, speed: 2 });
    this.game.audio.play('boing');
    this.game.audio.play('dizzy');
  }

  stopStep(g) {
    g.dur = 0.25;
    if (!this.solid(g.cx, g.cy - 1)) {
      // The ground was dug away: the stopper tumbles and walks on afterwards.
      g.activeJob = null;
      this.beginFall(g);
      this.fallStep(g);
    }
  }

  stairsStep(g) {
    if (!this.solid(g.cx, g.cy - 1)) {
      this.endJob(g);
      this.beginFall(g);
      return this.fallStep(g);
    }
    this.setGround(g);
    const nx = g.cx + g.dir, cy = g.cy;
    if (g.phase === 'place') {
      const floorAhead = g.planks > 0 && this.solid(nx, cy - 1);
      if (floorAhead || !this.placeable(nx, cy) || this.solid(nx, cy + 1) || this.solid(nx, cy + 2) || this.stopperAt(nx, cy, g)) {
        this.endJob(g);
        g.dur = 0.1;
        return;
      }
      this.setCell(nx, cy, PLANK);
      g.planks++;
      g.work++;
      g.phase = 'step';
      g.dur = BUILD;
      this.game.audio.play('land');
    } else {
      g.cx = nx;
      g.cy = cy + 1;
      g.phase = 'place';
      g.dur = WALK * 0.8;
      if (g.planks >= STAIR_PLANKS) this.endJob(g);
      this.afterMove(g);
    }
  }

  startBridge(g) {
    g.job = null;
    g.state = 'bridge';
    g.activeJob = 'bridge';
    g.phase = 'place';
    g.planks = 0;
    g.work = 0;
    this.bridgeStep(g);
  }

  bridgeStep(g) {
    if (!this.solid(g.cx, g.cy - 1)) {
      this.endJob(g);
      this.beginFall(g);
      return this.fallStep(g);
    }
    this.setGround(g);
    const nx = g.cx + g.dir, cy = g.cy;
    if (g.phase === 'place') {
      if (this.solid(nx, cy) || this.solid(nx, cy + 1) || (g.planks > 0 && this.solid(nx, cy - 1)) || g.planks >= BRIDGE_PLANKS || !this.placeable(nx, cy - 1)) {
        this.endJob(g);
        g.dur = 0.1;
        return;
      }
      this.setCell(nx, cy - 1, PLANK);
      g.planks++;
      g.work++;
      g.phase = 'step';
      g.dur = BUILD;
      this.game.audio.play('land');
    } else {
      g.cx = nx;
      g.phase = 'place';
      g.dur = WALK;
      this.afterMove(g);
    }
  }

  digStep(g) {
    const below = this.cell(g.cx, g.cy - 1);
    if (below === STONE || g.cy - 1 < 0) {
      this.endJob(g);
      g.dur = 0.15;
      return;
    }
    if (below === AIR || below === WATER) {
      this.endJob(g);
      this.beginFall(g);
      return this.fallStep(g);
    }
    this.setCell(g.cx, g.cy - 1, AIR);
    g.cy -= 1;
    g.work++;
    g.dur = DIG;
    this.dirtPuff(g.cx, g.cy);
  }

  startBash(g) {
    g.job = null;
    g.state = 'bash';
    g.activeJob = 'tunnel';
    g.work = 0;
    g.dur = 0.1;
  }

  bashStep(g) {
    if (!this.solid(g.cx, g.cy - 1)) {
      this.endJob(g);
      this.beginFall(g);
      return this.fallStep(g);
    }
    const nx = g.cx + g.dir, cy = g.cy;
    if (!this.canBash(nx, cy)) {
      this.endJob(g);
      g.dur = 0.1;
      return;
    }
    for (const r of [cy, cy + 1]) if (this.diggable(nx, r)) this.setCell(nx, r, AIR);
    g.cx = nx;
    g.work++;
    g.dur = BASH;
    this.dirtPuff(nx + g.dir * 0.5, cy + 0.5);
    this.setGround(g);
    this.afterMove(g);
    // Keep going only while there is more dirt straight ahead.
    if (g.state === 'bash' && !this.canBash(nx + g.dir, cy)) this.endJob(g);
  }

  dirtPuff(c, r) {
    if (Math.random() < 0.6) this.game.audio.play('dash');
    this.puffs.burst(new THREE.Vector3(wx(c), wy(r) + 0.1, GZ + 0.1), this.theme.dirt[0], { count: 5, size: 0.14, life: 0.45, speed: 2.5, up: 2 });
  }

  /** A job ends; one that did nothing at all goes back into the job bar. */
  endJob(g) {
    if (g.activeJob && g.work === 0) this.refund(g.activeJob, g.giver);
    g.state = 'walk';
    g.activeJob = null;
    g.phase = null;
  }

  refund(job, giver) {
    if (!job || this.counts[job] === undefined) return;
    this.counts[job]++;
    if (giver) {
      giver.jobs[job] = Math.max(0, (giver.jobs[job] || 0) - 1);
      giver.total = Math.max(0, giver.total - 1);
    }
    this.game.audio.play('bump');
  }

  toBubble(g) {
    if (g.state !== 'walk' && g.activeJob && g.activeJob !== 'stopper' && g.work === 0) this.refund(g.activeJob, g.giver);
    if (g.state !== 'walk') g.activeJob = null;
    const from = new THREE.Vector3(g.rx, g.ry, g.z);
    const to = new THREE.Vector3(wx(this.hatch.c), wy(this.hatch.r), g.z);
    g.state = 'bubble';
    g.phase = null;
    g.floating = false;
    g.anim = { from, to };
    g.dur = 1.3 + from.distanceTo(to) * 0.18;
    g.t = 0;
    if (this.water(g.cx, Math.max(0, g.cy))) this.puffs.burst(from.clone().setY(from.y + 0.2), COLORS.water, { count: 10, size: 0.16, life: 0.5, speed: 3, up: 3 });
    this.game.audio.play('bubble');
  }

  endBubble(g) {
    g.cx = g.px = this.hatch.c;
    g.cy = g.py = this.hatch.r;
    g.dir = this.level.dir;
    g.state = 'fall';
    g.fallDist = 0;
    g.ground = null;
    g.dur = FALL;
    g.dizzy = 0;
    g.anchor = { c: g.cx, r: g.cy, t: this.simTime };
    this.puffs.burst(new THREE.Vector3(wx(g.cx), wy(g.cy) + 0.3, GZ), 0xbfe9ff, { count: 8, size: 0.2, life: 0.4, speed: 2.5 });
    this.game.audio.play('pop');
  }

  goHome(g) {
    if (g.job) this.refund(g.job, g.giver);
    g.job = null;
    g.activeJob = null;
    g.state = 'home';
    g.anim = { x: wx(g.cx), y: wy(this.door.r) };
    g.dur = 0.6;
    g.t = 0;
    this.home++;
    this.houseBounce = 1;
    this.game.audio.play('coin');
    const pos = new THREE.Vector3(wx(this.door.c), wy(this.door.r) + 0.6, 0.5);
    this.confetti.burst(pos, 0, { count: 14, speed: 3.5, up: 3, size: 0.1, life: 0.8, colors: [0xff6fae, 0xffc93c, 0x4cc9f0, 0x3ddc97] });
    if (this.home >= this.level.goal && !this.goalToast) {
      this.goalToast = true;
      this.game.ui.toast(t('guides.goalReached'), 2200);
      this.game.audio.play('star');
    }
  }

  // ---------- jobs ----------

  canTake(g, job) {
    if (!g.out || !this.counts[job]) return false;
    const st = g.state;
    if (st === 'gone' || st === 'home' || st === 'bubble' || st === 'bounce' || st === 'wait') return false;
    if (job === 'umbrella') return !g.umbrella && st !== 'stop';
    if (st === 'fall' || st === 'stop') return false;
    return this.shownJob(g) !== job;
  }

  assign(g, job, ent) {
    this.counts[job]--;
    ent.jobs[job] = (ent.jobs[job] || 0) + 1;
    ent.total++;
    if (job === 'umbrella') {
      g.umbrella = true;
    } else {
      // Replacing a job that never got going hands it back.
      if (g.state === 'walk' && g.job) this.refund(g.job, g.giver);
      else if (g.state !== 'walk' && g.activeJob && g.work === 0) this.refund(g.activeJob, g.giver);
      g.job = null;
      g.activeJob = null;
      g.phase = null;
      g.work = 0;
      g.planks = 0;
      g.giver = ent;
      g.dizzy = 0;
      if (job === 'stopper') {
        g.state = 'stop';
        g.activeJob = 'stopper';
        g.stopDir = g.dir;
      } else if (job === 'stairs') {
        g.state = 'stairs';
        g.activeJob = 'stairs';
        g.phase = 'place';
      } else if (job === 'digger') {
        g.state = 'dig';
        g.activeJob = 'digger';
      } else {
        g.state = 'walk';
        g.job = job; // bridge / tunnel wait for a gap / wall
      }
    }
    g.squash = 1.35;
    this.game.audio.play('select');
    this.puffs.burst(new THREE.Vector3(g.rx, g.ry + 0.4, GZ + 0.2), ent.p.color, { count: 7, size: 0.15, life: 0.4, speed: 2.5 });
  }

  /** Tapping a stopper again lets it go: it walks back the way it came from. */
  releaseStopper(g) {
    g.state = 'walk';
    g.activeJob = null;
    g.dir = -(g.stopDir || g.dir);
    g.dur = 0.2;
    g.t = 0;
    g.anchor = { c: g.cx, r: g.cy, t: this.simTime };
    g.squash = 1.3;
    this.game.audio.play('pop');
  }

  nextJob(cur, from = cur.job) {
    const list = this.jobList;
    const i = list.indexOf(from);
    for (let k = 1; k <= list.length; k++) {
      const j = list[(i + k + list.length) % list.length];
      if (this.counts[j] > 0) return j;
    }
    return from;
  }

  // ---------- cursors ----------

  buildCursors() {
    const n = this.players.length;
    this.ents = this.players.map((p, i) => {
      const g = new THREE.Group();
      g.add(mesh(sharedGeo('gd-ring', () => new THREE.TorusGeometry(0.42, 0.07, 10, 32)), basic(p.color)));
      g.add(mesh(sharedGeo('gd-ringIn', () => new THREE.CircleGeometry(0.36, 24)), basic(p.color, { transparent: true, opacity: 0.16 })));
      g.add(mesh(sharedGeo('gd-ringOut', () => new THREE.TorusGeometry(0.5, 0.025, 6, 32)), basic(COLORS.white)));
      g.visible = false;
      this.scene.add(g);
      const arrow = mesh(sharedGeo('gd-arrow', () => new THREE.ConeGeometry(0.13, 0.26, 12)), basic(p.color));
      arrow.rotation.x = Math.PI;
      arrow.visible = false;
      this.scene.add(arrow);
      const label = this.game.ui.label('label');
      // Spread the starting jobs so each player naturally "owns" a different one.
      const job = this.jobList[i % this.jobList.length];
      const x = wx(this.hatch.c) + (i - (n - 1) / 2) * 1.1 + 2.5 * this.level.dir;
      return { p, group: g, arrow, label, labelHtml: '', job, x, y: wy(this.hatch.r) - 0.5, hold: 0, target: null, pulse: 0, jobs: {}, total: 0 };
    });
  }

  pickTarget(e) {
    let best = null, bd = PICK_R;
    for (const g of this.grumbles) {
      if (!this.canTake(g, e.job)) continue;
      const d = Math.hypot(g.rx - e.x, g.ry + 0.3 - e.y);
      if (d < bd) { bd = d; best = g; }
    }
    if (best) return best;
    for (const g of this.grumbles) {
      if (g.state !== 'stop') continue;
      const d = Math.hypot(g.rx - e.x, g.ry + 0.3 - e.y);
      if (d < bd) { bd = d; best = g; }
    }
    return best;
  }

  updateCursors(dt, active) {
    const W = (COLS * S) / 2, H = ROWS * S;
    for (const e of this.ents) {
      const d = active ? this.input(e.p) : null;
      if (d) {
        const mag = Math.hypot(d.x, d.y);
        e.hold = mag > 0.15 ? e.hold + dt : 0;
        const sp = CURSOR_SPEED * Math.min(1, 0.35 + e.hold * 2.2);
        e.x = THREE.MathUtils.clamp(e.x + d.x * sp * dt, -W + 0.2, W - 0.2);
        e.y = THREE.MathUtils.clamp(e.y + d.y * sp * dt, 0.2, H - 0.2);
        if (d.cPressed) {
          const next = this.nextJob(e);
          if (next !== e.job) {
            e.job = next;
            this.game.audio.play('select');
            e.pulse = 1;
          }
        }
      }
      if (!this.counts[e.job]) e.job = this.nextJob(e);
      e.target = active ? this.pickTarget(e) : null;
      if (d && d.aPressed) {
        const g = e.target;
        if (g && g.state === 'stop' && !this.canTake(g, e.job)) this.releaseStopper(g);
        else if (g) this.assign(g, e.job, e);
        else this.game.audio.play('bump');
        e.pulse = 1;
      }
      e.pulse = Math.max(0, e.pulse - dt * 4);
      e.group.position.set(e.x, e.y, 1.0);
      e.group.scale.setScalar(1 + e.pulse * 0.25);
      e.group.rotation.z += dt * 0.8;
      e.group.visible = active;
      if (e.target) {
        e.arrow.visible = true;
        e.arrow.position.set(e.target.rx, e.target.ry + 0.95 + Math.sin(this.time * 8) * 0.06, e.target.z + 0.2);
      } else {
        e.arrow.visible = false;
      }
      const has = this.counts[e.job] > 0;
      const html = `<div style="width:1.9em;height:1.9em;border-radius:50%;background:#fff;border:0.18em solid ${e.p.css};display:flex;align-items:center;justify-content:center;opacity:${has ? 1 : 0.4};-webkit-text-stroke:0">${ICONS[e.job]}</div>`;
      if (html !== e.labelHtml) {
        e.label.innerHTML = html;
        e.labelHtml = html;
      }
      if (active) this.game.ui.place(e.label, new THREE.Vector3(e.x + 0.55, e.y + 0.2, 1.0), this.camera);
      else e.label.style.display = 'none';
    }
  }

  // ---------- rendering ----------

  renderGrumbles(dt, sdt) {
    for (const g of this.grumbles) {
      if (!g.out || g.state === 'gone') continue;
      const k = Math.min(1, g.t / g.dur);
      let x = lerp(wx(g.px), wx(g.cx), k);
      let y = lerp(wy(g.py), wy(g.cy), k);
      const p = g.parts;
      let scale = 1;
      if (g.state === 'bounce') {
        const e = k;
        x = lerp(wx(g.anim.fx), wx(g.cx), e);
        const base = lerp(wy(g.anim.fy), wy(g.cy), e);
        y = base + Math.sin(e * Math.PI) * Math.max(0.3, wy(g.anim.peak) - Math.max(wy(g.anim.fy), wy(g.cy)) + 0.5);
      } else if (g.state === 'bubble') {
        const e = k * k * (3 - 2 * k);
        x = lerp(g.anim.from.x, g.anim.to.x, e);
        y = lerp(g.anim.from.y, g.anim.to.y, e) + Math.sin(e * Math.PI) * 1.6 + Math.sin(this.time * 5 + g.id) * 0.05;
      } else if (g.state === 'home') {
        x = g.anim.x;
        y = g.anim.y;
        scale = Math.max(0.01, 1 - k);
      }
      g.rx = x;
      g.ry = y;
      const z = g.state === 'home' ? g.z - k * 0.4 : g.z;
      g.root.position.set(x, y, z);

      // Face sideways while walking, toward the camera while standing, digging or floating.
      const front = g.state === 'stop' || g.state === 'dig' || g.state === 'bubble' || g.state === 'home' || g.floating;
      const yawTarget = front ? 0 : g.dir * 0.95;
      g.yaw += (yawTarget - g.yaw) * Math.min(1, dt * 12);
      g.body.rotation.y = g.yaw;

      const moving = g.state === 'walk' || g.state === 'bridge' || g.state === 'bash' || (g.state === 'stairs' && g.phase === 'place');
      g.walk += sdt * (moving ? 13 : 3);
      const swing = moving ? Math.sin(g.walk) * 0.13 : 0;
      if (g.feet.length === 2) {
        g.feet[0].position.z = 0.08 + swing;
        g.feet[1].position.z = 0.08 - swing;
        g.feet[0].position.y = 0.06 + Math.max(0, -swing) * 0.5;
        g.feet[1].position.y = 0.06 + Math.max(0, swing) * 0.5;
      }
      // Squash spring for landings and job hand-outs.
      g.squash += (1 - g.squash) * Math.min(1, dt * 10);
      const bob = moving ? Math.abs(Math.sin(g.walk)) * 0.035 : 0;
      const wob = g.dizzy > 0 ? Math.sin(this.time * 9) * 0.18 : 0;
      g.body.position.y = bob;
      g.body.rotation.z = wob;
      const s = 0.72 * scale;
      g.body.scale.set(s / Math.sqrt(g.squash), s * g.squash, s / Math.sqrt(g.squash));

      const job = this.shownJob(g);
      const hatJob = job === 'stairs' || job === 'digger' || job === 'tunnel' || job === 'bridge';
      p.hat.visible = hatJob;
      if (hatJob) {
        p.hatDome.material = toon(JOB_COLOR[job]);
        p.hatBrim.material = toon(JOB_COLOR[job]);
        p.lamp.visible = job === 'digger' || job === 'tunnel';
      }
      p.hammer.visible = job === 'stairs';
      if (job === 'stairs') p.hammer.rotation.x = g.phase === 'step' ? -0.4 + Math.sin(this.time * 18) * 0.9 : -0.3;
      p.shovel.visible = job === 'digger';
      if (job === 'digger') p.shovel.position.y = 0.3 + Math.sin(this.time * 14) * 0.08;
      p.drill.visible = job === 'tunnel';
      if (job === 'tunnel') p.drillBit.rotation.y += sdt * (g.state === 'bash' ? 30 : 4);
      p.plank.visible = job === 'bridge';
      p.stop.visible = g.state === 'stop';
      if (g.state === 'stop') p.stop.rotation.z = Math.sin(this.time * 4 + g.id) * 0.06;
      p.umbOpen.visible = g.umbrella && g.floating;
      p.umbClosed.visible = g.umbrella && !g.floating && g.state !== 'stop';
      const dizzy = g.dizzy > 0 || g.state === 'bounce';
      p.stars.visible = dizzy;
      if (dizzy) {
        p.stars.children.forEach((st, i) => {
          const a = this.time * 6 + (i / 3) * Math.PI * 2;
          st.position.set(Math.cos(a) * 0.32, Math.sin(a * 2) * 0.04, Math.sin(a) * 0.32);
          st.rotation.y += dt * 5;
        });
      }
      p.bubble.visible = p.shine.visible = g.state === 'bubble';
    }
  }

  frame() {
    const w = COLS * S, h = ROWS * S;
    const d = this.fitDistance(w + 0.6, h + 2.3);
    const cy = h / 2 - 0.2;
    this.camera.position.set(0, cy + 1.0, d);
    this.camera.lookAt(0, cy, 0);
    this.camera.updateProjectionMatrix();
    this.confettiOrigin = new THREE.Vector3(0, h * 0.6, 0);
  }

  resize(w, h) {
    super.resize(w, h);
    if (this.grid) this.frame();
  }

  animateWorld(dt, sdt) {
    // Hatch flaps and the house.
    for (const f of this.flaps) f.rotation.z = f.userData.s * -1.35 * this.hatchOpen;
    this.hatchGroup.position.y = (this.hatch.r + 1) * S + 0.05 + Math.sin(this.time * 1.5) * (this.level.theme === 'cave' ? 0 : 0.04);
    this.houseBounce = Math.max(0, (this.houseBounce || 0) - dt * 3);
    const hb = 1 + Math.sin(this.houseBounce * Math.PI) * 0.08;
    this.houseGroup.scale.set(1 / Math.sqrt(hb), hb, 1);
    this.smokeT -= dt;
    if (this.smokeT <= 0) {
      this.smokeT = 0.7;
      this.puffs.burst(this.chimneyTop, 0xffffff, { count: 1, size: 0.22, life: 1.6, speed: 0.3, up: 0.8, gravity: 0.4 });
    }
    // Water shimmer.
    this.waterMesh.position.y = Math.sin(this.time * 2) * 0.015;
    for (const w of this.windows) w.scale.setScalar(1 + (this.home >= this.level.goal ? Math.sin(this.time * 6) * 0.06 : 0));
    // Labels: grumbles still to come over the hatch, home count over the house.
    const left = this.level.total - this.released;
    const hatchHtml = left > 0 && this.state !== 'select' ? `${left}` : '';
    if (this.hatchLabel.innerHTML !== hatchHtml) this.hatchLabel.innerHTML = hatchHtml;
    this.game.ui.place(this.hatchLabel, new THREE.Vector3(wx(this.hatch.c), (this.hatch.r + 1) * S + (this.level.theme === 'cave' ? 1.3 : 2.3), 0.3), this.camera);
    const reached = this.home >= this.level.goal;
    const houseHtml = this.state === 'select' ? '' : `<span style="color:${reached ? '#2fbf80' : '#9b5de5'}">${this.home} / ${this.level.goal}</span>`;
    if (this.houseLabel.innerHTML !== houseHtml) this.houseLabel.innerHTML = houseHtml;
    this.game.ui.place(this.houseLabel, new THREE.Vector3(wx(this.door.c), wy(this.door.r) + 2.0, 0), this.camera);
  }

  // ---------- HUD ----------

  renderHud() {
    const fast = this.fast ? `<div class="pill" style="color:#ff4f9a">» ${t('guides.fast')}</div>` : '';
    this.game.ui.setTop(`<div class="pill hud-title">${this.levelIndex + 1}. ${esc(this.levelName())}</div>`
      + `<div class="pill">${HOUSE_ICON} ${t('guides.home')} <b>${this.home}</b> / ${this.level.goal}</div>`
      + `<div class="pill"><b>${clock(this.timeLeft)}</b></div>${fast}`);
    const chips = this.jobList.map((j) => {
      const n = this.counts[j];
      const dots = this.ents.filter((e) => e.job === j).map((e) => `<span style="width:0.8em;height:0.8em;border-radius:50%;background:${e.p.css};display:inline-block;border:2px solid #fff;box-shadow:0 0 0 1px rgba(43,35,64,.3)"></span>`).join('');
      return `<div class="chip" style="--c:${JOB_CSS[j]};opacity:${n > 0 ? 1 : 0.45}">${ICONS[j]}<span class="chip-name">${t(`guides.job.${j}`)}</span><span class="chip-val">×${n}</span>${dots}</div>`;
    }).join('') + `<div class="chip" style="--c:#ffffff;font-weight:500">${t('guides.help')}</div>`;
    if (chips !== this.barCache) {
      this.game.ui.barEl.innerHTML = chips;
      this.barCache = chips;
    }
  }

  // ---------- level picker ----------

  onLanguage() {
    if (this.state === 'select') this.renderPicker();
    this.barCache = '';
  }

  openPicker() {
    this.state = 'select';
    this.pickerEl = this.game.ui.panel('', 'panel picker');
    this.renderPicker();
  }

  renderPicker() {
    const cards = LEVELS.map((lv, i) => {
      const locked = i > this.unlocked;
      const [top, bottom] = THEMES[lv.theme].sky;
      const stars = [0, 1, 2].map((k) => `<span class="star-icon" style="${k < (this.bestStars[i] || 0) ? '' : 'background:#d8d0e8'}"></span>`).join('');
      const jobs = JOBS.filter((j) => lv.jobs[j]).map((j) => `<span style="font-size:0.7em">${ICONS[j]}</span>`).join('');
      return `<div class="level-card ${i === this.selection ? 'selected' : ''} ${locked ? 'locked' : ''}" style="background:linear-gradient(${top}, ${bottom})">
        <div class="level-num">${i + 1}</div><div class="level-name">${locked ? t('guides.locked') : esc(this.levelName(i))}</div>
        <div style="display:flex;gap:2px">${stars}</div><div style="display:flex;gap:2px">${jobs}</div></div>`;
    }).join('');
    this.pickerEl.innerHTML = `<div class="results-title">${t('game.guides')}</div>
      <div class="results-sub">${t('guides.pick')}</div>
      <div class="level-row">${cards}</div>
      <div class="results-footer">${t('guides.intro')}</div>
      <div class="results-footer" style="opacity:0.7;margin-top:6px">${t('guides.unlock')}</div>`;
  }

  updatePicker() {
    for (const p of this.players) {
      const d = this.input(p);
      if (!d) continue;
      if (d.stepX) {
        const next = THREE.MathUtils.clamp(this.selection + d.stepX, 0, LEVELS.length - 1);
        if (next !== this.selection) {
          this.selection = next;
          this.game.audio.play('select');
          this.renderPicker();
        }
      }
      if (d.aPressed) {
        if (this.selection > this.unlocked) {
          this.game.audio.play('bump');
          continue;
        }
        this.game.audio.play('join');
        if (this.selection === this.levelIndex) {
          this.pickerEl.remove();
          this.startIntro();
        } else {
          const level = this.selection;
          this.state = 'leaving';
          this.game.transition(() => new GuidesScene(this.game, { key: this.key, level }));
        }
        return;
      }
    }
  }

  // ---------- end of level ----------

  starsFor(home) {
    const { goal, total } = this.level;
    if (home >= total) return 3;
    if (home >= goal + Math.ceil((total - goal) / 2)) return 2;
    return home >= goal ? 1 : 0;
  }

  levelDone(reason) {
    if (this.levelOver) return;
    this.levelOver = true;
    this.fast = false;
    this.game.audio.play(reason === 'all' ? 'fanfare' : 'whoosh');
    this.game.ui.banner(reason === 'all' ? t('guides.allHome') : t('guides.timeUp'), '', 1600);
    this.later(1.8, () => this.end());
  }

  end() {
    const stars = this.starsFor(this.home);
    const won = stars > 0;
    const roster = this.game.roster;
    const saved = roster.progress.guides || { unlocked: 0, stars: [] };
    saved.stars = saved.stars || [];
    saved.stars[this.levelIndex] = Math.max(saved.stars[this.levelIndex] || 0, stars);
    if (won) saved.unlocked = Math.max(saved.unlocked || 0, Math.min(LEVELS.length - 1, this.levelIndex + 1));
    roster.progress.guides = saved;
    roster.save();
    this.won = won;
    this.hasNext = !this.campaign && won && this.levelIndex + 1 < LEVELS.length;
    const best = Math.max(...this.ents.map((e) => e.total));
    this.game.ui.barEl.innerHTML = '';
    this.barCache = '';
    const starText = '★'.repeat(stars) + '☆'.repeat(3 - stars);
    this.finish({
      title: `${won ? t('guides.win') : t('guides.lose')} ${starText}`,
      subtitle: t('guides.sub', { name: this.levelName(), home: this.home, total: this.level.total, goal: this.level.goal }),
      rows: this.ents.map((e) => {
        const top = Object.entries(e.jobs).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]).slice(0, 2);
        return {
          css: e.p.css, name: e.p.name, value: e.total === 1 ? t('guides.jobs1') : t('guides.jobs', { n: e.total }),
          detail: top.length ? top.map(([j, n]) => `${t(`guides.job.${j}`)} ×${n}`).join(' · ') : t('guides.cheer'),
          crown: this.ents.length > 1 && e.total === best && best > 0,
        };
      }),
      stars: Math.max(1, stars),
      action: this.campaign ? t('footer.continue') : this.hasNext ? t('guides.next') : won ? t('guides.again') : t('guides.retry'),
    });
  }

  updateResults(dt) {
    if (this.state !== 'results') return false;
    this.resultsDelay -= dt;
    if (this.resultsDelay > 0) return true;
    const inputs = this.players.map((p) => this.input(p)).filter(Boolean);
    if (this.campaign) {
      if (inputs.some((d) => d.aPressed)) {
        this.state = 'leaving';
        this.game.goHub(this.key);
      }
      return true;
    }
    if (inputs.some((d) => d.aPressed)) {
      const level = this.hasNext ? this.levelIndex + 1 : this.levelIndex;
      this.state = 'leaving';
      this.game.transition(() => new GuidesScene(this.game, { key: this.key, level }));
    } else if (inputs.some((d) => d.bPressed)) {
      this.state = 'leaving';
      this.game.goHub(this.key);
    }
    return true;
  }

  // ---------- main loop ----------

  update(dt) {
    if (this.state === 'leaving') return;
    if (this.state === 'select') {
      this.updatePicker();
      this.animateWorld(dt, dt);
      return;
    }
    const playing = this.state === 'play' && !this.levelOver;
    // Fast-forward while anyone holds B (C also counts as B, so ignore it while C is down).
    this.fast = playing && this.players.some((p) => {
      const d = this.input(p);
      return d && d.b && !d.c;
    });
    const sdt = dt * (this.fast ? FAST : 1);
    if (playing) {
      this.simulate(sdt);
      this.timeLeft -= sdt;
      if (this.home >= this.level.total) this.levelDone('all');
      else if (this.timeLeft <= 0) this.levelDone('time');
      else if (!this.releaseToast && this.released === this.level.total) {
        const stoppers = this.grumbles.filter((g) => g.state === 'stop').length;
        if (stoppers > 0 && this.home + stoppers === this.level.total) {
          this.releaseToast = true;
          this.game.ui.toast(t('guides.release'), 3500);
        }
      }
    }
    this.renderGrumbles(dt, playing ? sdt : dt);
    this.animateWorld(dt, sdt);
    if (this.updateResults(dt)) {
      this.updateCursors(dt, false);
      return;
    }
    this.updateCursors(dt, playing);
    this.renderHud();
  }

  dispose() {
    super.dispose();
    for (const m of this.instanced || []) m.dispose();
  }
}
