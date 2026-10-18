import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { MiniGame } from '../core/minigame.js';
import { Character } from '../core/character.js';
import { makeGrumble } from '../core/critters.js';
import { COLORS, PLAYER_COLORS, toon, basic, sharedGeo } from '../core/palette.js';
import { addLights, skyTexture, makeStar } from '../core/world.js';
import { t, addStrings } from '../core/i18n.js';
import { esc } from '../core/ui.js';

addStrings({
  en: {
    'game.keep': 'Pillow Keep',
    'keep.intro': 'Fluff the grumble nests, find the keys and reach the stairs together! [A]: action · [B]: special · [C]: open / use key',
    'keep.pick': 'Pick a class',
    'keep.pickHint': 'Stick left/right to choose · [A] to lock in (the same class twice is fine!)',
    'keep.buttons': '[A]: action · [B]: special (recharges) · [C]: open chests and doors, wake friends',
    'keep.cls.knight': 'Knight', 'keep.cls.archer': 'Archer', 'keep.cls.wizard': 'Wizard', 'keep.cls.bard': 'Bard',
    'keep.desc.knight': '[A]: wide pillow swing · [B]: pillow spin · gets sleepy slowly',
    'keep.desc.archer': '[A]: foam dart where you aim · [B]: fan of darts',
    'keep.desc.wizard': '[A]: bubble spell traps grumbles, pop them later · [B]: bubble ring',
    'keep.desc.bard': '[A]: bonk note · [B]: lullaby puts grumbles to sleep and speeds up friends',
    'keep.floor': 'Floor {n}/{total}',
    'keep.floorTitle': 'Floor {n}',
    'keep.name.0': 'The Cushion Hall', 'keep.name.1': 'The Blanket Vaults', 'keep.name.2': "The Sheep's Bedroom",
    'keep.coins': '{n} coins', 'keep.coin1': '1 coin',
    'keep.goal.key': 'Find a key for the locked door',
    'keep.goal.door': 'Unlock the door ([C])',
    'keep.goal.stairs': 'Everyone to the stairs!',
    'keep.goal.sheep': 'Something sleepy waits upstairs...',
    'keep.waiting': 'At the stairs: {n}/{total}',
    'keep.float': 'Floating everyone to the stairs!',
    'keep.gotKey': '{name} found a key!',
    'keep.unlock': 'Unlocked!',
    'keep.needKey': 'Locked! Find a key',
    'keep.chest': 'Treasure!',
    'keep.snack': 'Yum!',
    'keep.nest': 'Nest fluffed!',
    'keep.woke': '{name} woke up {other}!',
    'keep.c.open': '[C]: open', 'keep.c.unlock': '[C]: unlock', 'keep.c.wake': '[C]: wake up',
    'keep.boss': 'Sleepy Sheep',
    'keep.bossWake': 'The Sleepy Sheep woke up!',
    'keep.bossSub': 'Bonk its glowing spots!',
    'keep.bossDone': 'The Sleepy Sheep fell asleep!',
    'keep.fog': 'The sheep is guarding the stairs',
    'keep.yawn': 'Baa-yawn!',
    'keep.title': 'The keep is cozy again!',
    'keep.sub': 'Team coins: {coins} · Time {time}',
    'keep.detail': '{cls} · nests: {nests} · woke: {woken}',
  },
  no: {
    'game.keep': 'Puteborgen',
    'keep.intro': 'Rusk opp grumlereirene, finn nøklene og nå trappa sammen! [A]: handling · [B]: spesial · [C]: åpne / bruk nøkkel',
    'keep.pick': 'Velg klasse',
    'keep.pickHint': 'Pinnen venstre/høyre for å velge · [A] for å låse (flere kan velge det samme!)',
    'keep.buttons': '[A]: handling · [B]: spesial (lades opp) · [C]: åpne kister og dører, vekk venner',
    'keep.cls.knight': 'Ridder', 'keep.cls.archer': 'Bueskytter', 'keep.cls.wizard': 'Trollmann', 'keep.cls.bard': 'Spillemann',
    'keep.desc.knight': '[A]: bredt putesving · [B]: putevirvel · blir sakte trøtt',
    'keep.desc.archer': '[A]: skumpil dit du sikter · [B]: vifte av piler',
    'keep.desc.wizard': '[A]: bobletrylling fanger grumlinger, sprett dem etterpå · [B]: boblering',
    'keep.desc.bard': '[A]: bonke-tone · [B]: vuggesang får grumlinger til å sovne og gjør venner raske',
    'keep.floor': 'Etasje {n}/{total}',
    'keep.floorTitle': 'Etasje {n}',
    'keep.name.0': 'Putesalen', 'keep.name.1': 'Dynekjelleren', 'keep.name.2': 'Sauens soverom',
    'keep.coins': '{n} mynter', 'keep.coin1': '1 mynt',
    'keep.goal.key': 'Finn en nøkkel til den låste døra',
    'keep.goal.door': 'Lås opp døra ([C])',
    'keep.goal.stairs': 'Alle til trappa!',
    'keep.goal.sheep': 'Noe søvnig venter der oppe ...',
    'keep.waiting': 'Ved trappa: {n}/{total}',
    'keep.float': 'Alle svever bort til trappa!',
    'keep.gotKey': '{name} fant en nøkkel!',
    'keep.unlock': 'Låst opp!',
    'keep.needKey': 'Låst! Finn en nøkkel',
    'keep.chest': 'Skatt!',
    'keep.snack': 'Nam!',
    'keep.nest': 'Reiret er rusket opp!',
    'keep.woke': '{name} vekket {other}!',
    'keep.c.open': '[C]: åpne', 'keep.c.unlock': '[C]: lås opp', 'keep.c.wake': '[C]: vekk',
    'keep.boss': 'Søvnige Sau',
    'keep.bossWake': 'Søvnige Sau har våknet!',
    'keep.bossSub': 'Bonk de lysende flekkene!',
    'keep.bossDone': 'Søvnige Sau sovnet!',
    'keep.fog': 'Sauen passer på trappa',
    'keep.yawn': 'Bææ-gjesp!',
    'keep.title': 'Puteborgen er koselig igjen!',
    'keep.sub': 'Lagets mynter: {coins} · Tid {time}',
    'keep.detail': '{cls} · reir: {nests} · vekket: {woken}',
  },
});

// Pillow Keep: a co-op, non-violent take on Gauntlet. 1-6 players crawl through three cozy
// castle floors on one shared, angled top-down camera. Grumbles pour out of pillow-pile nests
// until the nest is fluffed apart; a grumble that touches you makes you yawn, and a fully sleepy
// player naps until a teammate taps them (or wakes up on their own). Keys open locked doors,
// chests spill coins and snacks, and each floor ends when everyone stands on the stairs.
// The last floor has the Sleepy Sheep, a friendly ghost put to sleep by bonking its glowing spots.

// Map legend: #  wall          .  floor        (space) nothing
//             S  start         >  stairs (a 2x2 block)
//             K  key           D  locked door (touching D tiles form one door)
//             N  grumble nest  C  treasure chest
//             r  rug (decor)   B  Sleepy Sheep
const FLOORS = [
  {
    map: [
      '##########################',
      '#.........#####..........#',
      '#...N.....#####...>>.....#',
      '#.........#####...>>.....#',
      '#....r........D..........#',
      '#.............D....N.....#',
      '#..K......#####..........#',
      '####..#########......C...#',
      '   #..#      #############',
      '   #..#',
      '####..##########',
      '#..............#',
      '#.SS...........#',
      '#.SS....r...C..#',
      '#..............#',
      '################',
    ],
  },
  {
    map: [
      '##############################',
      '#........#####...............#',
      '#..>>....#####...N...........#',
      '#..>>....#####.........r.....#',
      '#............D...............#',
      '#............D.......C.......#',
      '#........#####...........N...#',
      '#........#####...............#',
      '################..#######..###',
      '               #DD#     #..#',
      '############   #..#  ####..###',
      '#..........#####..####.......#',
      '#...N......#.........#...K...#',
      '#..........#.SS..r...#.......#',
      '#..K.................#...N...#',
      '#....................#.......#',
      '#..........#.SS...C..#.......#',
      '#..........#.........#########',
      '######################',
    ],
  },
  {
    arenaRow: 10, // rows above this are the Sleepy Sheep's bedroom
    map: [
      '############################',
      '#########..........#########',
      '#########....>>....#########',
      '#########....>>....#########',
      '#####..................#####',
      '#####..................#####',
      '#####.........B........#####',
      '#####.......r..........#####',
      '#####..................#####',
      '#####..................#####',
      '############DDDD############',
      '      #..............#',
      '#######..N.......N...#######',
      '#..........................#',
      '#..K....#..........#....C..#',
      '#.......#####..#####.......#',
      '#..N....#   #..#   #...N...#',
      '#.......#   #..#   #.......#',
      '#########   #..#   #########',
      '        ####....####',
      '        #..SS..SS..#',
      '        #....C.....#',
      '        ############',
    ],
  },
];

// Per-floor colors: warm wood hall, blue stone vaults, lavender bedroom.
const THEMES = [
  { floorA: 0xf2d2a4, floorB: 0xe6c291, wall: 0xb79fd6, cap: 0xd3c3ea, rug: 0xe0566f, rugIn: 0xff8fa8, grumble: 0x7b6cf6 },
  { floorA: 0xe4dccb, floorB: 0xd6ccb8, wall: 0x8faed8, cap: 0xbcd0ec, rug: 0x3f8fd6, rugIn: 0x8fd8ff, grumble: 0x3fae9a },
  { floorA: 0xd6c6ec, floorB: 0xc8b5e2, wall: 0x8a76c4, cap: 0xb3a5e0, rug: 0x8a45e0, rugIn: 0xc9a8ff, grumble: 0xd9549a },
];

const CELL = 2;
const WALL_H = 1.5;
const PR = 0.42; // player radius
const GR = 0.4; // grumble radius
const SPEED = 6;
const TILT = 1.0; // camera pitch (radians above the floor)
const CLASSES = ['knight', 'archer', 'wizard', 'bard'];
const GLYPH = { knight: '♜', archer: '➶', wizard: '✦', bard: '♪' };
const CD_A = { knight: 0.42, archer: 0.3, wizard: 0.5, bard: 0.4 };
const CD_B = { knight: 3.5, archer: 3, wizard: 5, bard: 6 };
const SHOTS = { dart: { speed: 18, life: 0.7 }, bubble: { speed: 10, life: 1.1 }, note: { speed: 13, life: 0.55 } };
const NAP_SOLO = 3; // nap length when nobody can tap you awake
const NAP_MAX = 6; // with teammates: a tap wakes you sooner
const STRAY_X = 12, STRAY_Z = 8; // how far from the others before the bubble pulls you along
const STAIRS_WAIT = 8; // once half the team is on the stairs, the rest float over after this
const SHEEP_SCALE = 1.3;
const SNACK_COLORS = [0xd9a066, 0xffffff];
const NO_INPUT = { x: 0, y: 0, a: false, b: false, c: false, aPressed: false, bPressed: false, cPressed: false, stepX: 0, stepY: 0 };
const COIN = '<span style="display:inline-block;width:.85em;height:.85em;border-radius:50%;background:#ffd23f;box-shadow:inset 0 0 0 .14em #e0a100;vertical-align:-.08em"></span>';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const clock = (s) => {
  const secs = Math.max(0, Math.floor(s));
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
};
const angDiff = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

const sph = (r, w = 14, h = 10) => sharedGeo(`kSph${r}|${w}`, () => new THREE.SphereGeometry(r, w, h));
const rbox = (key, w, h, d, r = 0.08) => sharedGeo(`k-${key}`, () => new RoundedBoxGeometry(w, h, d, 2, r));
const bx = (key, w, h, d) => sharedGeo(`kb-${key}`, () => new THREE.BoxGeometry(w, h, d));
const cyl = (key, rt, rb, h, seg = 14) => sharedGeo(`kc-${key}`, () => new THREE.CylinderGeometry(rt, rb, h, seg));

function mesh(geo, mat, x = 0, y = 0, z = 0, shadow = true) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = shadow;
  return m;
}

/** A fresh (unshared) see-through material for effects that fade out. */
function fadeMat(color, opacity = 0.6) {
  return new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide });
}

function disposeTree(obj) {
  obj.traverse((o) => {
    if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose();
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of mats) if (!m.userData.shared) m.dispose();
  });
}

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
      return `<div class="vote-opt" style="width:clamp(130px,19vw,250px)"><div class="vote-label">${GLYPH[cls]} ${esc(t(`keep.cls.${cls}`))}</div>
        <div style="font-size:clamp(11px,1vw,16px);font-weight:600;text-align:center;opacity:.75;margin-bottom:6px">${esc(t(`keep.desc.${cls}`))}</div>${chips}</div>`;
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
  constructor(game, opts) {
    super(game, opts);
    this.camera.fov = 40;
    this.scene.background = skyTexture('#2a1d45', '#6b4a7e');
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

    this.floorIndex = 0;
    this.floorT = 0;
    this.floorTimes = [];
    this.floaters = [];
    this.flowT = 0;
    this.toastCd = 0;
    this.camCenter = new THREE.Vector3();
    this.camDist = 20;

    this.ents = this.players.map((p, i) => this.makeEnt(p, i));
    this.loadFloor(opts.floor || 0);
    game.audio.playMusic('bubble');

    this.state = 'pick';
    this.picker = new ClassPicker(this, this.ents, () => {
      this.picker = null;
      this.intro(t('game.keep'), t('keep.intro'));
    });
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
      p, i, ch, hand, bubble, keyMesh, ring, aimPivot, label, labelHtml: '',
      cls: CLASSES[i % CLASSES.length],
      x: 0, y: 0, z: 0, vx: 0, vz: 0, fx: 0, fz: -1,
      state: 'walk', yawn: 0, napT: 0, inv: 0, calm: 0, boost: 0, cdA: 0, cdB: 0,
      hasKey: false, swingT: 0, swingDir: 1, spinT: 0, bubbleTo: null, bubbleCd: 0,
      coins: 0, nests: 0, woken: 0,
    };
    this.setClass(e, e.cls);
    return e;
  }

  /** Swap the prop in the bean's hand: pillow, dart blaster, wand or lute. */
  setClass(e, cls) {
    e.cls = cls;
    e.hand.clear();
    const h = e.hand;
    if (cls === 'knight') {
      const pillow = mesh(rbox('pillow', 0.85, 0.26, 0.58, 0.12), toon(0xfff3f8), 0.42, 0.05, 0.42);
      pillow.add(mesh(bx('pillowStripe', 0.87, 0.06, 0.6), toon(0xff9fd0), 0, 0, 0, false));
      pillow.rotation.y = 0.5;
      h.add(pillow);
    } else if (cls === 'archer') {
      const tube = mesh(cyl('blaster', 0.1, 0.1, 0.62), toon(0xff8c42), 0.42, 0, 0.3);
      tube.rotation.x = Math.PI / 2;
      h.add(tube, mesh(sph(0.12), toon(0x4cc9f0), 0.42, 0, 0.64), mesh(bx('grip', 0.1, 0.24, 0.12), toon(0x9b5de5), 0.42, -0.14, 0.12));
    } else if (cls === 'wizard') {
      const wand = mesh(cyl('wand', 0.03, 0.035, 0.75, 8), toon(0x8a5a3a), 0.45, 0.15, 0.25);
      wand.rotation.x = 0.7;
      const tip = mesh(sharedGeo('kWandTip', () => new THREE.OctahedronGeometry(0.13)), toon(COLORS.gold, { emissive: 0x664400 }), 0.45, 0.45, 0.5);
      h.add(wand, tip);
      // Little starry cape.
      const cape = mesh(rbox('cape', 0.7, 0.75, 0.08, 0.04), toon(0x5a3fd0), 0, 0.2, -0.42);
      h.add(cape, mesh(sph(0.06), toon(COLORS.gold), 0.15, 0.35, -0.47, false));
    } else {
      const body = mesh(sph(0.27), toon(0xd9955a), 0.15, -0.05, 0.42);
      body.scale.set(1, 1.2, 0.45);
      const hole = mesh(sph(0.08), toon(COLORS.ink), 0.15, 0.0, 0.53, false);
      hole.scale.z = 0.3;
      const neck = mesh(bx('luteNeck', 0.08, 0.55, 0.06), toon(0x8a5a3a), 0.33, 0.3, 0.44);
      neck.rotation.z = -0.6;
      h.add(body, hole, neck);
    }
  }

  // ---------- floor building ----------

  loadFloor(index) {
    if (this.level) {
      this.scene.remove(this.level);
      disposeTree(this.level);
    }
    this.floorIndex = index;
    this.floorDef = FLOORS[index];
    this.theme = THEMES[index];
    this.level = new THREE.Group();
    this.scene.add(this.level);
    this.grumbles = [];
    this.items = [];
    this.shots = [];
    this.fx = [];
    this.nests = [];
    this.chests = [];
    this.doors = [];
    this.torches = [];
    this.sheep = null;
    this.fog = null;
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
    this.flow = new Int16Array(W * H);
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
        if ('KNCrB'.includes(ch)) marks.push([ch, c, r]);
      }
    }
    this.buildTiles();
    this.buildDoors();
    this.buildStairs();
    this.buildDecor(marks);

    const n = this.ents.length;
    for (const [ch, c, r] of marks) {
      const x = this.cx(c), z = this.cz(r);
      if (ch === 'K') this.spawnItem('key', x, z);
      else if (ch === 'N') this.makeNest(x, z, n);
      else if (ch === 'C') this.makeChest(x, z);
      else if (ch === 'B') this.makeSheep(x, z);
    }
    for (const nest of this.nests) this.spawnGrumble(nest.x, nest.z, nest);

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
    this.updateCamera(0, true);
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
        // Only walls that touch a walkable tile are drawn.
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

    const walls = new THREE.InstancedMesh(rbox('wall', CELL, WALL_H, CELL, 0.07), toon(theme.wall), wallTiles.length);
    const caps = new THREE.InstancedMesh(rbox('wallCap', CELL * 0.86, 0.14, CELL * 0.86, 0.05), toon(theme.cap), wallTiles.length);
    wallTiles.forEach(([c, r], i) => {
      m.makeTranslation(this.cx(c), WALL_H / 2 - 0.05, this.cz(r));
      walls.setMatrixAt(i, m);
      m.makeTranslation(this.cx(c), WALL_H - 0.02, this.cz(r));
      caps.setMatrixAt(i, m);
    });
    walls.castShadow = walls.receiveShadow = true;
    this.level.add(walls, caps);
    this.wallTiles = wallTiles;
  }

  buildDoors() {
    const { W } = this;
    const seen = new Set();
    for (let i = 0; i < this.cells.length; i++) {
      if (this.cells[i] !== 3 || seen.has(i)) continue;
      // Flood-fill touching door tiles into one door.
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
    const c0 = Math.min(...tiles.map((t) => t[0])), c1 = Math.max(...tiles.map((t) => t[0]));
    const r0 = Math.min(...tiles.map((t) => t[1])), r1 = Math.max(...tiles.map((t) => t[1]));
    const x0 = (c0 - this.W / 2) * CELL, x1 = (c1 + 1 - this.W / 2) * CELL;
    const z0 = (r0 - this.H / 2) * CELL, z1 = (r1 + 1 - this.H / 2) * CELL;
    this.stairs = { x0, x1, z0, z1, x: (x0 + x1) / 2, z: (z0 + z1) / 2 };
    const g = new THREE.Group();
    const w = x1 - x0, d = z1 - z0;
    // Pit walls (the near side is hidden from the camera anyway).
    const pit = toon(0x5a4a7a);
    g.add(mesh(new THREE.BoxGeometry(w, 1.4, 0.12), pit, this.stairs.x, -0.7, z0 + 0.06, false));
    for (const x of [x0 + 0.06, x1 - 0.06]) g.add(mesh(new THREE.BoxGeometry(0.12, 1.4, d), pit, x, -0.7, this.stairs.z, false));
    // Four steps going down toward the far wall, with a red runner.
    for (let k = 0; k < 4; k++) {
      const zs = z1 - (k + 0.5) * (d / 4), top = -0.18 - 0.2 * k, h = 1.4 + top;
      g.add(mesh(new THREE.BoxGeometry(w - 0.24, h, d / 4), toon(k % 2 ? 0xd8c4a8 : 0xeedcc0), this.stairs.x, top - h / 2, zs, false));
      g.add(mesh(new THREE.BoxGeometry(w * 0.4, 0.04, d / 4 * 0.98), toon(0xd94f6b), this.stairs.x, top + 0.02, zs, false));
    }
    // Golden arrow bobbing over the stairs.
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
        if (!side || this.cell(c - side, r) !== 2) continue;
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

  makeNest(x, z, players) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    const cols = [COLORS.candyPink, COLORS.candyBlue, COLORS.candyYellow, COLORS.candyLilac, COLORS.candyMint, COLORS.cream];
    const pillows = [
      [-0.5, 0.2, 0.0, 0.3], [0.5, 0.2, -0.1, -0.4], [0.0, 0.2, -0.55, 1.4], [0.05, 0.2, 0.45, 0.1],
      [-0.25, 0.55, -0.15, 0.9], [0.3, 0.55, 0.05, -0.2], [0.0, 0.88, -0.05, 0.5],
    ];
    const pieces = pillows.map(([px, py, pz, ry], i) => {
      const p = mesh(rbox('nestPillow', 0.95, 0.38, 0.68, 0.17), toon(cols[i % cols.length]), px, py, pz);
      p.rotation.set((i % 3 - 1) * 0.12, ry, (i % 2 ? 0.1 : -0.12));
      g.add(p);
      return p;
    });
    // A dark doorway with grumpy eyes peeking out says "grumbles live here".
    const hole = mesh(sph(0.3), toon(0x2b2340), 0, 0.32, 0.72, false);
    hole.scale.set(1.1, 0.8, 0.35);
    g.add(hole);
    for (const s of [-1, 1]) g.add(mesh(sph(0.06, 8, 6), toon(0xfff1a8, { emissive: 0x665500 }), s * 0.1, 0.34, 0.82, false));
    this.level.add(g);
    const hp = 10 + 2 * players;
    this.nests.push({ x, z, g, pieces, hp, max: hp, done: false, alive: 0, spawnT: 1.5, wob: 0, r: 1.15 });
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

  // ---------- Sleepy Sheep (mini-boss) ----------

  makeSheep(x, z) {
    const g = new THREE.Group();
    const wool = toon(0xffffff, { transparent: true, opacity: 0.9 });
    const puffs = [[0, 0, 0, 0.75], [0.55, 0.1, 0.1, 0.55], [-0.55, 0.1, 0.1, 0.55], [0.3, 0.4, -0.3, 0.55], [-0.3, 0.4, -0.3, 0.55],
      [0, 0.5, 0.2, 0.55], [0.4, -0.2, -0.4, 0.5], [-0.4, -0.2, -0.4, 0.5], [0, 0.1, -0.6, 0.55]];
    for (const [px, py, pz, r] of puffs) g.add(mesh(sph(r, 14, 10), wool, px, py, pz));
    // Ghostly wisps instead of legs.
    for (const [px, pz] of [[-0.35, -0.2], [0.35, -0.2], [0, -0.5]]) {
      const w = mesh(sharedGeo('kWisp', () => new THREE.ConeGeometry(0.22, 0.7, 10)), wool, px, -0.75, pz, false);
      w.rotation.x = Math.PI;
      g.add(w);
    }
    const head = new THREE.Group();
    head.position.set(0, 0.25, 0.85);
    const face = mesh(sph(0.42), toon(0x8c79b8), 0, 0, 0);
    face.scale.set(0.95, 0.9, 0.9);
    head.add(face);
    for (const s of [-1, 1]) {
      const ear = mesh(sph(0.16), toon(0x8c79b8), s * 0.45, 0.1, -0.05);
      ear.scale.set(1.6, 0.5, 0.8);
      ear.rotation.z = s * -0.4;
      // Sleepy closed eyes: little curved lids.
      const lid = mesh(sharedGeo('kLid', () => new THREE.TorusGeometry(0.09, 0.025, 6, 12, Math.PI)), toon(0x2b2340), s * 0.16, 0.05, 0.36, false);
      lid.rotation.z = Math.PI;
      const blush = mesh(sph(0.07), toon(COLORS.blush), s * 0.26, -0.08, 0.32, false);
      blush.scale.set(1, 0.6, 0.4);
      head.add(ear, lid, blush);
    }
    head.add(mesh(sph(0.05), toon(0x2b2340), 0, -0.14, 0.38, false));
    // Striped nightcap with a pom-pom.
    const cap = mesh(sharedGeo('kNightcap', () => new THREE.ConeGeometry(0.34, 0.9, 14)), toon(0x4cc9f0), 0.1, 0.55, -0.05);
    cap.rotation.z = -0.5;
    const capBand = mesh(cyl('capBand', 0.36, 0.36, 0.1, 14), toon(COLORS.white), 0.0, 0.32, -0.05, false);
    capBand.rotation.z = -0.5;
    const pom = mesh(sph(0.12), toon(COLORS.white), 0.48, 0.85, -0.05, false);
    head.add(cap, capBand, pom);
    g.add(head);
    // Glowing spots circle the sheep; bonk them to make it sleepier.
    const ring = new THREE.Group();
    g.add(ring);
    const n = this.ents.length;
    const count = n <= 2 ? 4 : n <= 4 ? 5 : 6;
    const spots = [];
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      const m = mesh(sph(0.22), toon(0xffd23f, { emissive: 0xffa000 }), Math.sin(a) * 1.15, 0.05, Math.cos(a) * 1.15, false);
      ring.add(m);
      spots.push({ mesh: m, a, dim: 0 });
    }
    g.scale.setScalar(SHEEP_SCALE);
    this.level.add(g);
    const wave = mesh(sharedGeo('kRing', () => new THREE.RingGeometry(0.85, 1, 48)), fadeMat(0xc9a8ff, 0.55), x, 0.1, z, false);
    wave.rotation.x = -Math.PI / 2;
    wave.visible = false;
    this.level.add(wave);
    this.sheep = {
      x, z, y: 1.2, g, ring, spots, head, wave, sleep: 0, need: 10 + 3 * n, state: 'idle',
      t: 0, t2: 0, spin: 0, yawnT: 5, summonT: 7, retarget: 0, tx: x, tz: z, waveR: 0, waveHit: new Set(), gone: false,
    };
    // Dreamy clouds sit on the stairs until the sheep is asleep.
    const fog = new THREE.Group();
    const cloud = toon(0xf4eaff, { transparent: true, opacity: 0.92 });
    for (let i = 0; i < 9; i++) {
      const a = i * 2.4;
      fog.add(mesh(sph(0.75 + (i % 3) * 0.2, 14, 10), cloud, this.stairs.x + Math.cos(a) * (0.4 + (i % 4) * 0.4), 0.4 + (i % 2) * 0.35, this.stairs.z + Math.sin(a) * (0.3 + (i % 3) * 0.35), false));
    }
    this.level.add(fog);
    this.fog = fog;
  }

  wakeSheep() {
    const s = this.sheep;
    s.state = 'awake';
    s.yawnT = 5;
    s.summonT = 6;
    this.game.ui.banner(t('keep.bossWake'), t('keep.bossSub'), 1800);
    this.game.audio.play('boing');
    this.game.audio.playMusic('space');
  }

  spotPos(s, spot) {
    const a = spot.a + s.spin, R = 1.15 * SHEEP_SCALE;
    return { x: s.x + Math.sin(a) * R, z: s.z + Math.cos(a) * R };
  }

  sheepAwake() {
    const s = this.sheep;
    return s && (s.state === 'awake' || s.state === 'yawn');
  }

  /** Bonk a lit spot (spot = null for the Bard's lullaby). */
  bonkSheep(amount, by, spot) {
    const s = this.sheep;
    if (!this.sheepAwake()) return false;
    if (spot) {
      if (spot.dim > 0) return false;
      spot.dim = 4;
      spot.mesh.material = toon(0x9aa0c8);
      const p = this.spotPos(s, spot);
      this.confetti.burst(new THREE.Vector3(p.x, s.y, p.z), 0, { count: 14, speed: 5, colors: [COLORS.gold, 0xffffff], life: 0.7, size: 0.14 });
    }
    s.sleep = Math.min(s.need, s.sleep + amount);
    s.hit = 0.25;
    this.game.audio.play('boing');
    this.floater('Zz', new THREE.Vector3(s.x, s.y + 2.2, s.z), '#9b5de5', 0.9);
    if (s.sleep >= s.need) {
      s.state = 'asleep';
      s.t2 = 0;
      s.wave.visible = false;
      this.game.ui.banner(t('keep.bossDone'), '', 1600);
      this.game.audio.play('dizzy');
    }
    return true;
  }

  updateSheep(dt, active) {
    const s = this.sheep;
    if (!s || s.gone) return;
    s.t += dt;
    s.spin += dt * 0.7;
    s.hit = Math.max(0, (s.hit || 0) - dt);
    let y = 1.2 + Math.sin(s.t * 1.6) * 0.22;
    let scale = SHEEP_SCALE * (1 + s.hit * 0.6);
    if (s.state === 'idle') {
      if (active && this.ents.some((e) => e.state !== 'bubble' && this.tileR(e.z) < this.floorDef.arenaRow)) this.wakeSheep();
    } else if (s.state === 'awake' && active) {
      s.retarget -= dt;
      if (s.retarget <= 0) {
        s.retarget = 2.5 + Math.random() * 1.5;
        const awake = this.ents.filter((e) => e.state === 'walk');
        if (awake.length && Math.random() < 0.6) {
          const e = awake[Math.floor(Math.random() * awake.length)];
          s.tx = e.x; s.tz = e.z;
        } else {
          s.tx = this.cx(7 + Math.random() * 14); s.tz = this.cz(4.5 + Math.random() * 4.5);
        }
      }
      // Keep it in its bedroom.
      s.tx = clamp(s.tx, this.cx(6), this.cx(21)); s.tz = clamp(s.tz, this.cz(4.5), this.cz(8.5));
      const sp = 2.1 * (1 - 0.35 * s.sleep / s.need);
      const dx = s.tx - s.x, dz = s.tz - s.z, d = Math.hypot(dx, dz);
      if (d > 0.1) { s.x += dx / d * Math.min(d, sp * dt); s.z += dz / d * Math.min(d, sp * dt); }
      s.yawnT -= dt;
      if (s.yawnT <= 0) {
        s.state = 'yawn';
        s.t2 = 0;
        s.waveHit.clear();
        this.floater(t('keep.yawn'), new THREE.Vector3(s.x, s.y + 2.6, s.z), '#8a45e0', 1.3);
      }
      s.summonT -= dt;
      if (s.summonT <= 0) {
        s.summonT = 9;
        const cap = 2 + this.ents.length;
        for (let i = 0; i < 2 && this.grumbles.length < cap; i++) this.spawnGrumble(s.x + (i ? 1.2 : -1.2), s.z + 0.8, null);
      }
    } else if (s.state === 'yawn' && active) {
      s.t2 += dt;
      if (s.t2 < 1.1) {
        // Wind-up: the sheep puffs up before the big yawn.
        scale *= 1 + Math.sin(s.t2 / 1.1 * Math.PI) * 0.18;
        s.head.rotation.x = -s.t2 * 0.4;
      } else {
        s.head.rotation.x *= 0.9;
        s.waveR = (s.t2 - 1.1) * 5.5;
        s.wave.visible = true;
        s.wave.position.set(s.x, 0.12, s.z);
        s.wave.scale.setScalar(Math.max(0.01, s.waveR));
        s.wave.material.opacity = 0.55 * (1 - s.waveR / 7);
        for (const e of this.ents) {
          if (e.state !== 'walk' || s.waveHit.has(e)) continue;
          const d = Math.hypot(e.x - s.x, e.z - s.z);
          if (Math.abs(d - s.waveR) < 0.7) { s.waveHit.add(e); this.addYawn(e, 0.22); }
        }
        if (s.waveR > 6.5) { s.wave.visible = false; s.state = 'awake'; s.yawnT = 6 + Math.random() * 2; }
      }
    } else if (s.state === 'asleep') {
      s.t2 += dt;
      y = 1.2 - Math.min(1, s.t2 / 1.5) * 0.6;
      s.g.rotation.z = Math.min(1, s.t2) * 0.35;
      if (Math.random() < dt * 4) this.puffs.burst(new THREE.Vector3(s.x + 0.6, y + 1.6, s.z), 0xc9a8ff, { count: 1, size: 0.3, life: 1.2, speed: 0.5 });
      if (s.t2 > 2.2) this.poofSheep();
    }
    // Touching the ghost is a little sleepy too.
    if (this.sheepAwake() && active) {
      for (const e of this.ents) if (e.state === 'walk' && Math.hypot(e.x - s.x, e.z - s.z) < 1.5) this.addYawn(e, 0.18);
    }
    for (const spot of s.spots) {
      if (spot.dim > 0) {
        spot.dim -= dt;
        if (spot.dim <= 0) spot.mesh.material = toon(0xffd23f, { emissive: 0xffa000 });
      }
      spot.mesh.scale.setScalar(spot.dim > 0 ? 0.7 : 1 + Math.sin(s.t * 6 + spot.a) * 0.12);
    }
    s.y = y;
    if (!s.gone) {
      s.g.position.set(s.x, y, s.z);
      s.g.scale.setScalar(scale);
      s.ring.rotation.y = s.spin;
    }
  }

  poofSheep() {
    const s = this.sheep;
    s.gone = true;
    this.level.remove(s.g);
    const at = new THREE.Vector3(s.x, 1.2, s.z);
    this.confetti.burst(at, 0, { count: 120, speed: 10, up: 6, colors: PLAYER_COLORS.map((c) => c.hex).concat(COLORS.gold), life: 1.8, gravity: -8, size: 0.2 });
    this.puffs.burst(at, 0xffffff, { count: 20, size: 0.9, life: 1.2, speed: 4 });
    for (let i = 0; i < 6; i++) this.spawnStarFx(s.x, 1.5, s.z);
    for (let i = 0; i < 12; i++) this.spawnItem('coin', s.x, s.z, true);
    for (let i = 0; i < 2; i++) this.spawnItem('snack', s.x, s.z, true);
    // Every leftover grumble drifts off to sleep too.
    for (const g of [...this.grumbles]) this.fluffGrumble(g, null);
    if (this.fog) {
      for (const c of this.fog.children) this.puffs.burst(c.getWorldPosition(new THREE.Vector3()), 0xf4eaff, { count: 4, size: 0.8, life: 1, speed: 2 });
      this.level.remove(this.fog);
      this.fog = null;
    }
    this.game.audio.play('star');
    this.game.audio.playMusic('bubble');
  }

  // ---------- items: coins, snacks, keys ----------

  spawnItem(kind, x, z, pop = false) {
    let m;
    if (kind === 'coin') {
      m = new THREE.Group();
      const disc = mesh(cyl('coin', 0.24, 0.24, 0.07, 16), toon(COLORS.gold, { emissive: 0x4a3000 }), 0, 0, 0, true);
      disc.rotation.x = Math.PI / 2;
      m.add(disc, mesh(bx('coinMark', 0.06, 0.22, 0.08), toon(0xe0a100), 0, 0, 0, false));
    } else if (kind === 'snack') {
      m = new THREE.Group();
      if (Math.random() < 0.5) {
        // Cookie with chocolate chips.
        m.add(mesh(cyl('cookie', 0.3, 0.3, 0.1, 16), toon(SNACK_COLORS[0]), 0, 0, 0));
        for (const [cx, cz] of [[0.1, 0.08], [-0.12, 0.02], [0.02, -0.13]]) m.add(mesh(sph(0.045, 6, 4), toon(0x6b3f22), cx, 0.06, cz, false));
        m.rotation.x = 0.6;
      } else {
        // Mug of warm milk.
        m.add(mesh(cyl('mug', 0.2, 0.18, 0.38, 14), toon(0x4cc9f0), 0, 0, 0));
        m.add(mesh(cyl('milk', 0.17, 0.17, 0.02, 14), toon(SNACK_COLORS[1]), 0, 0.19, 0, false));
        const handle = mesh(sharedGeo('kHandle', () => new THREE.TorusGeometry(0.1, 0.035, 6, 12)), toon(0x4cc9f0), 0.22, 0, 0, false);
        m.add(handle);
      }
    } else {
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
      if (active && it.t > 0.4) {
        // Find the closest player who can take it.
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
            // Coins drift toward nearby players.
            const k = Math.min(1, dt * 9 / bd);
            it.x += (best.x - it.x) * k; it.z += (best.z - it.z) * k;
          } else {
            this.pickItem(it, best);
          }
        }
      }
      const bob = it.kind === 'coin' ? 0 : Math.sin(this.time * 3 + it.phase) * 0.12;
      it.mesh.position.set(it.x, it.y + bob + (it.kind === 'key' ? 0.3 : 0), it.z);
      it.mesh.rotation.y += dt * (it.kind === 'key' ? 2 : 4);
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

  // ---------- grumbles and nests ----------

  spawnGrumble(x, z, nest) {
    const big = this.floorIndex >= 1 && Math.random() < 0.15 + this.floorIndex * 0.1;
    const g = makeGrumble(big ? 0xff8c42 : this.theme.grumble);
    const bubble = mesh(sph(0.72, 18, 12), toon(0xbfe9ff, { transparent: true, opacity: 0.45 }), 0, 0.45, 0, false);
    bubble.add(mesh(sph(0.12), toon(COLORS.white), -0.3, 0.3, 0.45, false));
    bubble.visible = false;
    g.add(bubble);
    // Step out of the pile toward an open neighbor tile.
    let sx = x, sz = z;
    for (let tries = 0; tries < 8; tries++) {
      const a = Math.random() * Math.PI * 2;
      const px = x + Math.sin(a) * 1.3, pz = z + Math.cos(a) * 1.3;
      if (this.walkableAt(px, pz)) { sx = px; sz = pz; break; }
    }
    this.level.add(g);
    const gr = {
      g, bubble, x: sx, z: sz, vx: 0, vz: 0, kx: 0, kz: 0, state: 'pop', t: 0, hp: big ? 2 : 1, size: big ? 1.3 : 1,
      nest, hitCd: 0.6, wx: sx, wz: sz, wanderT: 0, y: 0, phase: Math.random() * 6,
    };
    g.position.set(sx, 0, sz);
    g.scale.setScalar(0.01);
    this.grumbles.push(gr);
    if (nest) nest.alive++;
    this.puffs.burst(new THREE.Vector3(sx, 0.5, sz), 0xffffff, { count: 6, size: 0.35, life: 0.5, speed: 2 });
    return gr;
  }

  updateNests(dt, active) {
    const n = this.ents.length;
    const interval = Math.max(2.4, 3.6 - 0.25 * (n - 1));
    const perNest = 2 + Math.floor((n + 1) / 2);
    const cap = 6 + 2 * n;
    for (const nest of this.nests) {
      if (nest.done) continue;
      nest.wob = Math.max(0, nest.wob - dt * 3);
      const s = 1.25 * (0.6 + 0.4 * nest.hp / nest.max);
      nest.g.scale.set(s * (1 + Math.sin(this.time * 30) * nest.wob * 0.15), s * (1 - nest.wob * 0.2), s);
      if (!active) continue;
      const near = this.ents.some((e) => e.state === 'walk' && Math.hypot(e.x - nest.x, e.z - nest.z) < 18);
      if (!near) continue;
      nest.spawnT -= dt;
      if (nest.spawnT <= 0) {
        nest.spawnT = interval * (0.8 + Math.random() * 0.4);
        if (nest.alive < perNest && this.grumbles.length < cap) this.spawnGrumble(nest.x, nest.z, nest);
      }
    }
  }

  damageNest(nest, dmg, by) {
    if (nest.done) return;
    nest.hp -= dmg;
    nest.wob = 1;
    this.puffs.burst(new THREE.Vector3(nest.x, 0.9, nest.z), 0xffffff, { count: 5, size: 0.25, life: 0.6, speed: 3 });
    this.game.audio.play('bump');
    if (nest.hp > 0) return;
    nest.done = true;
    if (by) by.nests++;
    this.level.remove(nest.g);
    // The pillows tumble apart in a burst of feathers, confetti and stars.
    for (const p of nest.pieces) {
      const wp = p.getWorldPosition(new THREE.Vector3());
      const piece = mesh(p.geometry, p.material, wp.x, wp.y, wp.z);
      piece.rotation.copy(p.rotation);
      this.level.add(piece);
      const a = Math.random() * Math.PI * 2;
      this.fx.push({ kind: 'piece', obj: piece, life: 1.1, max: 1.1, vx: Math.cos(a) * 4, vy: 5 + Math.random() * 3, vz: Math.sin(a) * 4, spin: (Math.random() - 0.5) * 10 });
    }
    const at = new THREE.Vector3(nest.x, 1, nest.z);
    this.confetti.burst(at, 0, { count: 50, speed: 8, up: 5, colors: [COLORS.candyPink, COLORS.candyBlue, COLORS.candyYellow, COLORS.white], life: 1.3, gravity: -9, size: 0.18 });
    this.puffs.burst(at, 0xffffff, { count: 14, size: 0.5, life: 1, speed: 4 });
    for (let i = 0; i < 3; i++) this.spawnStarFx(nest.x, 1, nest.z);
    for (let i = 0; i < 5; i++) this.spawnItem('coin', nest.x, nest.z, true);
    if (Math.random() < 0.5) this.spawnItem('snack', nest.x, nest.z, true);
    this.floater(t('keep.nest'), new THREE.Vector3(nest.x, 2.2, nest.z), by ? by.p.css : '#ff4f9a', 1.2);
    this.game.audio.play('star');
  }

  hitGrumble(g, dmg, by, kx = 0, kz = 0) {
    if (g.dead) return;
    if (g.state === 'bubble') { this.fluffGrumble(g, by); return; }
    g.hp -= dmg;
    g.kx += kx; g.kz += kz;
    if (g.hp <= 0) this.fluffGrumble(g, by);
    else { this.game.audio.play('bump'); g.flash = 0.2; }
  }

  trapGrumble(g) {
    if (g.dead) return;
    if (g.state === 'bubble') { this.fluffGrumble(g, null); return; }
    g.state = 'bubble';
    g.t = 6;
    g.bubble.visible = true;
    this.game.audio.play('trap');
  }

  /** A fluffed grumble poofs into confetti and stars and leaves a coin. */
  fluffGrumble(g, by) {
    if (g.dead) return;
    g.dead = true;
    this.level.remove(g.g);
    if (g.nest) g.nest.alive--;
    const at = new THREE.Vector3(g.x, 0.6 + g.y, g.z);
    this.confetti.burst(at, 0, { count: 18, speed: 6, up: 3, colors: [this.theme.grumble, COLORS.gold, COLORS.white, COLORS.candyPink], life: 0.9, size: 0.14 });
    this.puffs.burst(at, 0xffffff, { count: 5, size: 0.35, life: 0.5 });
    this.spawnStarFx(g.x, 0.8, g.z);
    this.game.audio.play('pop');
    if (by !== undefined) {
      const coins = Math.random() < 0.5 ? 2 : 1;
      for (let i = 0; i < coins; i++) this.spawnItem('coin', g.x, g.z, true);
    }
  }

  updateFlow() {
    // Multi-source BFS from every awake player: grumbles walk downhill on this field.
    const { W, flow } = this;
    flow.fill(-1);
    const q = [];
    for (const e of this.ents) {
      if (e.state !== 'walk') continue;
      const c = this.tileC(e.x), r = this.tileR(e.z), i = r * W + c;
      if (this.walkable(c, r) && flow[i] < 0) { flow[i] = 0; q.push(i); }
    }
    for (let h = 0; h < q.length; h++) {
      const i = q[h], c = i % W, r = (i - c) / W, d = flow[i];
      if (d >= 14) continue;
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nc = c + dc, nr = r + dr, j = nr * W + nc;
        if (this.walkable(nc, nr) && flow[j] < 0) { flow[j] = d + 1; q.push(j); }
      }
    }
  }

  flowAt(c, r) { return this.walkable(c, r) ? this.flow[r * this.W + c] : -1; }

  updateGrumbles(dt, active) {
    const speed = 2.5 + this.floorIndex * 0.25;
    for (const g of this.grumbles) {
      if (g.dead) continue;
      g.hitCd -= dt;
      g.flash = Math.max(0, (g.flash || 0) - dt);
      let mvx = 0, mvz = 0;
      if (g.state === 'pop') {
        g.t += dt;
        if (g.t > 0.35) g.state = 'walk';
      } else if (g.state === 'bubble') {
        g.t -= dt;
        g.y += (0.7 - g.y) * Math.min(1, dt * 4);
        if (g.t <= 0) { g.state = 'walk'; g.bubble.visible = false; }
        // Walking into a trapped grumble pops it.
        for (const e of this.ents) {
          if (e.state === 'walk' && Math.hypot(e.x - g.x, e.z - g.z) < PR + 0.75) { this.fluffGrumble(g, e); break; }
        }
      } else if (g.state === 'sleep') {
        g.t -= dt;
        if (Math.random() < dt * 1.5) this.puffs.burst(new THREE.Vector3(g.x + 0.2, 1.3, g.z), 0xc9a8ff, { count: 1, size: 0.2, life: 1, speed: 0.4 });
        if (g.t <= 0) g.state = 'walk';
      } else if (g.state === 'walk' && active) {
        const c = this.tileC(g.x), r = this.tileR(g.z), here = this.flowAt(c, r);
        let tx = null, tz = null;
        if (here >= 0 && here <= 1) {
          let bd = Infinity;
          for (const e of this.ents) {
            if (e.state !== 'walk') continue;
            const d = Math.hypot(e.x - g.x, e.z - g.z);
            if (d < bd) { bd = d; tx = e.x; tz = e.z; }
          }
        } else if (here > 1 && here <= 9) {
          let best = here;
          for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
            if (dc && dr && (!this.walkable(c + dc, r) || !this.walkable(c, r + dr))) continue;
            const f = this.flowAt(c + dc, r + dr);
            if (f >= 0 && f < best) { best = f; tx = this.cx(c + dc); tz = this.cz(r + dr); }
          }
        }
        let sp = speed / (g.size > 1 ? 1.15 : 1);
        if (tx === null) {
          // Nobody close: potter around the nest.
          g.wanderT -= dt;
          if (g.wanderT <= 0) {
            g.wanderT = 2 + Math.random() * 2;
            const hx = g.nest ? g.nest.x : g.x, hz = g.nest ? g.nest.z : g.z;
            const px = hx + (Math.random() - 0.5) * 6, pz = hz + (Math.random() - 0.5) * 6;
            if (this.walkableAt(px, pz)) { g.wx = px; g.wz = pz; }
          }
          tx = g.wx; tz = g.wz; sp *= 0.4;
        }
        const dx = tx - g.x, dz = tz - g.z, d = Math.hypot(dx, dz);
        if (d > 0.05) { mvx = dx / d * sp; mvz = dz / d * sp; }
        // Touching a player makes them yawn; the grumble bounces off.
        for (const e of this.ents) {
          if (e.state !== 'walk' || g.hitCd > 0) continue;
          const ex = g.x - e.x, ez = g.z - e.z, ed = Math.hypot(ex, ez);
          if (ed < PR + GR * g.size) {
            g.hitCd = 1.2;
            g.kx += ex / (ed || 1) * 7; g.kz += ez / (ed || 1) * 7;
            this.addYawn(e, g.size > 1 ? 0.3 : 0.24);
          }
        }
      }
      g.vx += (mvx - g.vx) * Math.min(1, dt * 8);
      g.vz += (mvz - g.vz) * Math.min(1, dt * 8);
      const decay = Math.max(0, 1 - dt * 6);
      g.kx *= decay; g.kz *= decay;
      if (g.state !== 'bubble') {
        this.moveCircle(g, (g.vx + g.kx) * dt, (g.vz + g.kz) * dt, GR * g.size);
        if (g.state !== 'walk') g.vx = g.vz = 0;
      }
    }
    // Keep grumbles from piling into one spot.
    const L = this.grumbles;
    for (let i = 0; i < L.length; i++) {
      for (let j = i + 1; j < L.length; j++) {
        const a = L[i], b = L[j];
        if (a.dead || b.dead || a.state === 'bubble' || b.state === 'bubble') continue;
        const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz), min = 0.8;
        if (d < min && d > 0.001) {
          const push = (min - d) / 2;
          a.x -= dx / d * push; a.z -= dz / d * push;
          b.x += dx / d * push; b.z += dz / d * push;
        }
      }
    }
    this.grumbles = this.grumbles.filter((g) => !g.dead);
    for (const g of this.grumbles) {
      const grow = g.state === 'pop' ? Math.min(1, g.t / 0.35) : 1;
      const breathe = g.state === 'sleep' ? 1 + Math.sin(this.time * 3 + g.phase) * 0.06 : 1;
      g.g.scale.set(g.size * grow, g.size * grow * breathe * (g.flash > 0 ? 0.7 : 1), g.size * grow);
      g.g.position.set(g.x, g.state === 'bubble' ? g.y + Math.sin(this.time * 3 + g.phase) * 0.08 : (g.y = Math.max(0, g.y - dt * 3)), g.z);
      g.g.rotation.z = g.state === 'sleep' ? 0.35 : 0;
      if (g.state === 'walk' && Math.abs(g.vx) + Math.abs(g.vz) > 0.1) {
        g.g.rotation.y = Math.atan2(g.vx, g.vz);
        g.g.position.y = Math.abs(Math.sin(this.time * 12 + g.phase)) * 0.12;
      }
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
          // Center inside the tile: leave by the nearest side.
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
    e.yawn = Math.min(1, e.yawn + amount * (e.cls === 'knight' ? 0.6 : 1));
    e.inv = 0.9;
    e.calm = 0;
    e.ch.squash(0.72);
    this.game.audio.play('bump');
    this.puffs.burst(new THREE.Vector3(e.x, 1.2, e.z), 0xc9a8ff, { count: 4, size: 0.3, life: 0.6, speed: 1.5 });
    if (e.yawn >= 1) this.nap(e);
    return true;
  }

  nap(e) {
    e.state = 'nap';
    e.napT = 0;
    e.vx = e.vz = 0;
    this.game.audio.play('dizzy');
  }

  wake(e, by) {
    if (e.state !== 'nap') return;
    e.state = 'walk';
    e.yawn = 0.3;
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
    e.cdA = CD_A[e.cls];
    e.swingT = 0.22;
    e.swingDir = -e.swingDir;
    if (e.cls === 'knight') {
      this.swing(e, 2.4, 1.25, 2);
      this.game.audio.play('whoosh');
    } else if (e.cls === 'archer') {
      this.shoot(e, 'dart', 0);
      this.game.audio.play('dash');
    } else if (e.cls === 'wizard') {
      this.shoot(e, 'bubble', 0);
      this.game.audio.play('bubble');
    } else {
      this.shoot(e, 'note', 0);
      this.game.audio.play('select');
    }
  }

  special(e) {
    e.cdB = CD_B[e.cls];
    if (e.cls === 'knight') {
      e.spinT = 0.4;
      this.swing(e, 3.2, Math.PI, 2, 9);
      this.game.audio.play('whoosh');
    } else if (e.cls === 'archer') {
      for (let k = -2; k <= 2; k++) this.shoot(e, 'dart', k * 0.22);
      this.game.audio.play('dash');
    } else if (e.cls === 'wizard') {
      for (let k = 0; k < 8; k++) this.shoot(e, 'bubble', (k / 8) * Math.PI * 2, 0.5);
      this.game.audio.play('trap');
    } else {
      // Lullaby: nearby grumbles nod off, teammates get a speed boost.
      const R = 5.5;
      for (const g of this.grumbles) {
        if (g.state !== 'bubble' && Math.hypot(g.x - e.x, g.z - e.z) < R) { g.state = 'sleep'; g.t = 5; g.vx = g.vz = 0; }
      }
      for (const o of this.ents) if (o.state === 'walk' && Math.hypot(o.x - e.x, o.z - e.z) < R) o.boost = 4;
      if (this.sheep && Math.hypot(this.sheep.x - e.x, this.sheep.z - e.z) < R + 1.5) this.bonkSheep(3, e, null);
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
  swing(e, rad, half, nestDmg, push = 5) {
    for (const g of [...this.grumbles]) {
      if (!this.inArc(e, g.x, g.z, rad + GR, half)) continue;
      const dx = g.x - e.x, dz = g.z - e.z, d = Math.hypot(dx, dz) || 1;
      this.hitGrumble(g, 1, e, dx / d * push, dz / d * push);
    }
    for (const n of this.nests) if (!n.done && this.inArc(e, n.x, n.z, rad + n.r, half)) this.damageNest(n, nestDmg, e);
    const s = this.sheep;
    if (this.sheepAwake()) {
      for (const spot of s.spots) {
        const p = this.spotPos(s, spot);
        if (this.inArc(e, p.x, p.z, rad + 0.5, half)) { this.bonkSheep(1, e, spot); break; }
      }
    }
    this.addFx('arc', e.x, e.z, { yaw: Math.atan2(e.fx, e.fz), half, rad, life: 0.2 });
  }

  shoot(e, kind, angOff, lifeScale = 1) {
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
    } else {
      m = new THREE.Group();
      const head = mesh(sph(0.14, 10, 8), toon(0x9b5de5), 0, 0, 0, false);
      head.scale.set(1.2, 0.85, 1);
      m.add(head, mesh(bx('noteStem', 0.05, 0.4, 0.05), toon(0x9b5de5), 0.14, 0.2, 0, false));
    }
    this.level.add(m);
    this.shots.push({ kind, x: e.x + dx * 0.5, z: e.z + dz * 0.5, vx: dx * S.speed, vz: dz * S.speed, life: S.life * lifeScale, owner: e, mesh: m, t: 0 });
  }

  updateShots(dt) {
    const s = this.sheep;
    for (const sh of this.shots) {
      sh.life -= dt;
      sh.t += dt;
      sh.x += sh.vx * dt;
      sh.z += sh.vz * dt;
      let hit = sh.life <= 0 || !this.walkableAt(sh.x, sh.z);
      if (!hit) {
        for (const n of this.nests) {
          if (!n.done && Math.hypot(n.x - sh.x, n.z - sh.z) < n.r + 0.15) { this.damageNest(n, 1, sh.owner); hit = true; break; }
        }
      }
      if (!hit) {
        for (const g of this.grumbles) {
          if (g.dead || Math.hypot(g.x - sh.x, g.z - sh.z) > 0.55 + 0.25 * g.size) continue;
          if (sh.kind === 'bubble') this.trapGrumble(g);
          else this.hitGrumble(g, 1, sh.owner, sh.vx * 0.3, sh.vz * 0.3);
          hit = true;
          break;
        }
      }
      if (!hit && this.sheepAwake()) {
        for (const spot of s.spots) {
          const p = this.spotPos(s, spot);
          if (Math.hypot(p.x - sh.x, p.z - sh.z) < 0.75 && spot.dim <= 0) { this.bonkSheep(1, sh.owner, spot); hit = true; break; }
        }
        if (!hit && Math.hypot(s.x - sh.x, s.z - sh.z) < 1.1) hit = true; // fizzles on the fluffy body
      }
      if (hit) {
        sh.dead = true;
        this.level.remove(sh.mesh);
        disposeTree(sh.mesh);
        this.puffs.burst(new THREE.Vector3(sh.x, 0.8, sh.z), sh.kind === 'bubble' ? 0xbfe9ff : 0xffffff, { count: 3, size: 0.2, life: 0.3, speed: 1.5 });
        continue;
      }
      const y = 0.8 + (sh.kind === 'note' ? Math.sin(sh.t * 20) * 0.15 : 0);
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
  }

  openChest(chest, e) {
    chest.open = true;
    this.game.audio.play('star');
    this.floater(t('keep.chest'), new THREE.Vector3(chest.x, 2.2, chest.z), e.p.css, 1.2);
    this.confetti.burst(new THREE.Vector3(chest.x, 1, chest.z), COLORS.gold, { count: 24, speed: 5, up: 5, life: 0.9, size: 0.14 });
    const n = this.ents.length;
    for (let i = 0; i < 6 + n; i++) this.spawnItem('coin', chest.x, chest.z + 0.5, true);
    for (let i = 0; i < (n >= 3 ? 2 : 1); i++) this.spawnItem('snack', chest.x, chest.z + 0.5, true);
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

  floater(text, pos, css, life) {
    const el = this.game.ui.label('label');
    el.textContent = text;
    el.style.color = css;
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
        e.yawn = Math.min(e.yawn, 0.5);
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
        // A teammate bumping into a napper wakes them up.
        const friend = this.ents.find((o) => o !== e && o.state === 'walk' && Math.hypot(o.x - e.x, o.z - e.z) < 1.1);
        if (friend) this.wake(e, friend);
      }
    } else {
      let mx = inp.x, mz = -inp.y;
      const len = Math.hypot(mx, mz);
      if (len > 1) { mx /= len; mz /= len; }
      if (len > 0.25) { const l = Math.hypot(mx, mz); e.fx = mx / l; e.fz = mz / l; }
      const sp = SPEED * (e.boost > 0 ? 1.45 : 1) * (e.yawn > 0.66 ? 0.85 : 1);
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
    // Pose.
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
      // Moving away from the group counts a bit extra, so the one who wandered off is the one pulled.
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
    // If someone wandered off again after the float, give it another go a bit later.
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
    if (this.floorIndex >= FLOORS.length - 1) {
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
    this.confettiOrigin = this.camCenter.clone().setY(2);
    this.finish({
      title: t('keep.title'),
      subtitle: `${t('keep.sub', { coins, time: clock(total) })} · ${this.floorTimes.map((s, i) => `${i + 1}: ${clock(s)}`).join(' · ')}`,
      rows: ranked.map((e) => ({
        css: e.p.css,
        name: e.p.name,
        value: e.coins === 1 ? t('keep.coin1') : t('keep.coins', { n: e.coins }),
        detail: t('keep.detail', { cls: t(`keep.cls.${e.cls}`), nests: e.nests, woken: e.woken }),
        crown: top > 0 && e.coins === top,
      })),
      stars: total < 420 ? 3 : 2,
    });
  }

  // ---------- camera, lights, HUD ----------

  updateCamera(dt, snap = false) {
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    const pts = this.ents.map((e) => [e.x, e.z]);
    if (this.sheepAwake()) pts.push([this.sheep.x, this.sheep.z]);
    for (const [x, z] of pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const d = clamp(this.fitDistance(x1 - x0 + 14, (z1 - z0 + 10) * Math.sin(TILT)), 23, 40);
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
          const n = Math.min(5, Math.ceil(e.yawn * 5 - 0.001));
          html += `<span style="color:#9b5de5">${'●'.repeat(n)}</span><span style="color:#d6cfe6">${'●'.repeat(5 - n)}</span>`;
        }
      }
      if (html !== e.labelHtml) { e.label.innerHTML = html; e.labelHtml = html; }
      if (!html) { e.label.style.display = 'none'; continue; }
      v.set(e.x, e.y + (e.state === 'nap' ? 1.0 : e.hasKey ? 2.65 : 1.95), e.z);
      this.game.ui.place(e.label, v, this.camera);
    }
  }

  goalText() {
    const s = this.sheep;
    if (s && !s.gone && s.state !== 'idle') {
      const pct = Math.round(s.sleep / s.need * 100);
      return `<b>${esc(t('keep.boss'))}</b><span style="display:inline-block;width:7em;height:.7em;border-radius:1em;background:#e6defa;overflow:hidden"><span style="display:block;height:100%;width:${pct}%;background:#9b5de5"></span></span>`;
    }
    if (this.onStairs > 0) return esc(t('keep.waiting', { n: this.onStairs, total: this.ents.length }));
    const closed = this.doors.some((d) => !d.open);
    if (closed) {
      if (this.ents.some((e) => e.hasKey)) return esc(t('keep.goal.door'));
      return esc(t('keep.goal.key'));
    }
    if (this.fog) return esc(t('keep.goal.sheep'));
    return esc(t('keep.goal.stairs'));
  }

  updateHud() {
    if (this.state !== 'play' && this.state !== 'intro') return;
    const coins = this.ents.reduce((a, e) => a + e.coins, 0);
    this.game.ui.setTop(`<div class="pill"><b>${esc(t('keep.floor', { n: this.floorIndex + 1, total: FLOORS.length }))}</b></div>`
      + `<div class="pill">${COIN} <b>${coins}</b></div><div class="pill">${clock(this.floorT)}</div><div class="pill">${this.goalText()}</div>`);
    this.game.ui.bar(this.players, (p) => {
      const e = this.ents.find((x) => x.p === p);
      return e ? `${GLYPH[e.cls]} ${COIN} ${e.coins}` : '';
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
    this.updateSheep(dt, active);
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
