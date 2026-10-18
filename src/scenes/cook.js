import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { MiniGame } from '../core/minigame.js';
import { t, addStrings } from '../core/i18n.js';
import { Character } from '../core/character.js';
import { makeGrumble } from '../core/critters.js';
import { COLORS, PLAYER_COLORS, toon, basic, sharedGeo, faceted } from '../core/palette.js';
import { addLights, skyTexture, makeTree, makeBush, makeFlower, seeded } from '../core/world.js';

// Cook-Off: a forgiving co-op kitchen. Grab ingredients, chop them on boards, cook soup in
// pots, plate it up and serve it at the hatch before the customer gets bored. Nothing burns,
// expired orders just leave, and the team shares one coin score.

addStrings({
  en: {
    'game.cook': 'Cook-Off',
    'cook.intro': '[A] picks up and puts down. Hold [B] at a board to chop. Cook soup in the pots and serve at the hatch!',
    'cook.r.salad': 'Salad', 'cook.r.soupT': 'Tomato Soup', 'cook.r.soupM': 'Mushroom Soup',
    'cook.served': '{n} served',
    'cook.detail': '{c} chopped · {k} into pots',
    'cook.ready': 'Ready!',
    'cook.left': 'Oh no, the {r} customer left',
    'cook.ten': '10 seconds left!',
    'cook.hint.chop': 'Chop it first! Hold [B] at a board',
    'cook.hint.plate': 'Bring a plate!',
    'cook.hint.notPot': 'Salad stuff goes on a plate',
    'cook.hint.same': 'One kind per pot',
    'cook.hint.order': 'Nobody ordered that',
    'cook.hint.pot': 'That goes in a pot',
    'cook.hint.busy': 'Wait for the soup',
    'cook.t3': 'Master chefs!', 'cook.t2': 'Yummy work!', 'cook.t1': 'Nice cooking!', 'cook.t0': 'Kitchen practice!',
    'cook.sub': '{coins} coins from {n} orders · stars at {a} / {b} / {c}',
  },
  no: {
    'game.cook': 'Kokkekamp',
    'cook.intro': '[A] tar opp og setter fra deg. Hold [B] ved en fjøl for å kutte. Kok suppe i grytene og server i luka!',
    'cook.r.salad': 'Salat', 'cook.r.soupT': 'Tomatsuppe', 'cook.r.soupM': 'Soppsuppe',
    'cook.served': '{n} servert',
    'cook.detail': '{c} kuttet · {k} i gryta',
    'cook.ready': 'Ferdig!',
    'cook.left': 'Å nei, gjesten med {r} gikk',
    'cook.ten': '10 sekunder igjen!',
    'cook.hint.chop': 'Kutt den først! Hold [B] ved fjøla',
    'cook.hint.plate': 'Hent en tallerken!',
    'cook.hint.notPot': 'Salat skal på tallerken',
    'cook.hint.same': 'Bare én sort i gryta',
    'cook.hint.order': 'Ingen har bestilt det',
    'cook.hint.pot': 'Den skal i gryta',
    'cook.hint.busy': 'Vent på suppa',
    'cook.t3': 'Mesterkokker!', 'cook.t2': 'Nam, godt jobbet!', 'cook.t1': 'Fin matlaging!', 'cook.t0': 'Kjøkkentrening!',
    'cook.sub': '{coins} mynter fra {n} bestillinger · stjerner ved {a} / {b} / {c}',
  },
});

const CELL = 1.4;      // grid cell size
const H = 0.72;        // counter height (items rest on top)
const PR = 0.38;       // player radius
const SPEED = 5.4;
const ROUND_TIME = 180;
const POT_NEED = 3;    // chopped ingredients per soup

// Kitchens by player count. . floor, C counter, B chopping board, P pot on a stove,
// S plate stack, H serving hatch, X compost bin, T/L/M tomato/lettuce/mushroom crates.
const LAYOUTS = [
  [ // 1–2 players
    'CCTLMCPPC',
    'B.......C',
    'B.......H',
    'C..CCC..H',
    'C.......C',
    'X.......S',
    'CCBCCCCCC',
  ],
  [ // 3–4 players
    'CCTLMCCPPPC',
    'B.........C',
    'B.........H',
    'C..CBBC...H',
    'C..CCCC...C',
    'X.........S',
    'C.........S',
    'CCBBCTLMCCC',
  ],
  [ // 5–6 players
    'CCTLMCCCPPPPC',
    'B...........C',
    'B...........H',
    'C...CBBBC...H',
    'C...CCCCC...C',
    'X...........S',
    'B...........S',
    'C...........C',
    'CCBBCTLMCCBCC',
  ],
];
const TYPES = { C: 'counter', B: 'board', P: 'pot', S: 'plates', H: 'hatch', X: 'bin', T: 'crate', L: 'crate', M: 'crate' };
const CRATE_ING = { T: 'tomato', L: 'lettuce', M: 'mushroom' };

const ING = {
  tomato: { color: 0xff4f4f, css: '#ff4f4f', soup: 0xff6a3d, soupCss: '#ff6a3d' },
  lettuce: { color: 0x6cc94a, css: '#6cc94a' },
  mushroom: { color: 0xc8865a, css: '#c8865a', soup: 0xdcae7c, soupCss: '#dcae7c' },
};
const RECIPES = {
  salad: { coins: 15, time: 65, needs: ['lettuce', 'tomato'] },
  soupT: { coins: 20, time: 85, soup: 'tomato' },
  soupM: { coins: 20, time: 85, soup: 'mushroom' },
};
const CUSTOMER_COLORS = [0x7b6cf6, 0xff8fc8, 0x4cc9f0, 0xffb347, 0x3ddc97, 0xb08bff];
const CUSTOMER_CSS = ['#7b6cf6', '#ff8fc8', '#4cc9f0', '#ffb347', '#3ddc97', '#b08bff'];

const clamp = THREE.MathUtils.clamp;
/** Pale version of a color for counter tops. */
const tint = (hex) => new THREE.Color(hex).lerp(new THREE.Color(0xffffff), 0.72).getHex();

// ---------- shared geometry helpers ----------
const sph = (r, w = 14, h = 10) => sharedGeo(`ck-sph${r}|${w}`, () => new THREE.SphereGeometry(r, w, h));
const ico = (r) => sharedGeo(`ck-ico${r}`, () => faceted(new THREE.IcosahedronGeometry(r, 1)));
const cyl = (key, rt, rb, h, seg = 16) => sharedGeo(`ck-${key}`, () => new THREE.CylinderGeometry(rt, rb, h, seg));
const rbox = (key, w, h, d, r = 0.05) => sharedGeo(`ck-${key}`, () => new RoundedBoxGeometry(w, h, d, 2, r));
const dome = (key, r) => sharedGeo(`ck-${key}`, () => new THREE.SphereGeometry(r, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2));

function mesh(geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

/** A whole (raw) ingredient, sitting on y = 0. */
function wholeMesh(kind) {
  const g = new THREE.Group();
  if (kind === 'tomato') {
    const b = mesh(sph(0.24), toon(ING.tomato.color), 0, 0.21, 0);
    b.scale.y = 0.85;
    g.add(b, mesh(cyl('tleaf', 0.13, 0.13, 0.03, 5), toon(COLORS.leaf), 0, 0.41, 0), mesh(cyl('tstem', 0.025, 0.03, 0.1, 6), toon(COLORS.grassDark), 0, 0.45, 0));
  } else if (kind === 'lettuce') {
    g.add(mesh(ico(0.26), toon(ING.lettuce.color, { flat: true }), 0, 0.24, 0));
    g.add(mesh(ico(0.17), toon(0x9be27a, { flat: true }), 0.1, 0.36, 0.08));
    g.add(mesh(ico(0.15), toon(0x9be27a, { flat: true }), -0.12, 0.33, -0.04));
  } else {
    g.add(mesh(cyl('mstem', 0.09, 0.12, 0.24, 10), toon(COLORS.icing), 0, 0.12, 0));
    const cap = mesh(dome('mcap', 0.25), toon(ING.mushroom.color), 0, 0.2, 0);
    cap.scale.y = 0.8;
    g.add(cap);
    for (let i = 0; i < 3; i++) {
      const a = i * 2.1;
      const d = mesh(sph(0.045, 8, 6), toon(COLORS.white), Math.cos(a) * 0.14, 0.36, Math.sin(a) * 0.14);
      d.scale.y = 0.5;
      g.add(d);
    }
  }
  return g;
}

/** A small pile of chopped pieces. */
function choppedMesh(kind) {
  const g = new THREE.Group();
  const n = kind === 'lettuce' ? 4 : 3;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + 0.4;
    const x = Math.cos(a) * 0.13, z = Math.sin(a) * 0.13;
    if (kind === 'tomato') {
      const s = mesh(cyl('tslice', 0.12, 0.12, 0.06, 14), toon(ING.tomato.color), x, 0.03, z);
      s.add(mesh(cyl('tslicein', 0.09, 0.09, 0.07, 14), toon(0xff9a8a)));
      s.rotation.set(0.25, a, 0.2);
      g.add(s);
    } else if (kind === 'lettuce') {
      const l = mesh(ico(0.12), toon(i % 2 ? 0x9be27a : ING.lettuce.color, { flat: true }), x, 0.05, z);
      l.scale.y = 0.45;
      g.add(l);
    } else {
      const c = mesh(dome('mslice', 0.11), toon(ING.mushroom.color), x, 0.04, z);
      c.scale.y = 0.55;
      c.add(mesh(rbox('mbit', 0.07, 0.1, 0.07, 0.02), toon(COLORS.icing), 0, -0.04, 0));
      g.add(c);
    }
  }
  return g;
}

/** Plate with whatever is on it (soup bowl or salad bits). */
function plateMesh(item) {
  const g = new THREE.Group();
  g.add(mesh(cyl('plate', 0.42, 0.34, 0.07, 24), toon(COLORS.white), 0, 0.035, 0));
  g.add(mesh(cyl('plateIn', 0.3, 0.3, 0.075, 24), toon(0xe9f4ff), 0, 0.036, 0));
  if (item.soup) {
    g.add(mesh(cyl('bowl', 0.3, 0.2, 0.24, 20), toon(COLORS.cream), 0, 0.19, 0));
    g.add(mesh(cyl('soupTop', 0.26, 0.26, 0.03, 20), toon(ING[item.soup].soup), 0, 0.3, 0));
    g.add(mesh(sph(0.05, 8, 6), toon(COLORS.leaf), 0.07, 0.32, -0.04));
  }
  item.contents.forEach((k, i) => {
    const c = choppedMesh(k);
    c.scale.setScalar(0.85);
    c.position.set(item.contents.length > 1 ? (i ? 0.12 : -0.12) : 0, 0.06, 0);
    g.add(c);
  });
  return g;
}

function itemMesh(item) {
  if (item.kind === 'plate') return plateMesh(item);
  return item.chopped ? choppedMesh(item.kind) : wholeMesh(item.kind);
}

/** Small inline-styled icons for the order cards (no extra CSS needed). */
const dot = (css) => `<span style="display:inline-block;width:.85em;height:.85em;border-radius:50%;background:${css};border:2px solid #fff;box-shadow:0 0 0 1px rgba(43,35,64,.25)"></span>`;
const bowl = (css) => `<span style="display:inline-block;width:1.5em;height:.8em;border-radius:0 0 .8em .8em;background:${css};border-top:.22em solid #fff3dc;box-shadow:0 0 0 2px #fff,0 0 0 3px rgba(43,35,64,.25)"></span>`;
const coin = '<span style="display:inline-block;width:1em;height:1em;border-radius:50%;background:#ffd23f;border:3px solid #f0a020;box-sizing:border-box"></span>';

function recipeIcons(key) {
  const r = RECIPES[key];
  if (r.soup) return `${bowl(ING[r.soup].soupCss)} <span style="font-size:.8em">3×</span>${dot(ING[r.soup].css)}`;
  return r.needs.map((k) => dot(ING[k].css)).join('');
}

export class CookScene extends MiniGame {
  constructor(game, opts) {
    super(game, opts);
    this.camera.fov = 38;
    this.scene.background = skyTexture('#bfe8ff', '#fff1d6');
    const n = Math.max(1, this.players.length);
    this.solo = n === 1;
    this.layout = LAYOUTS[n <= 2 ? 0 : n <= 4 ? 1 : 2];
    this.D = this.layout.length;
    this.W = this.layout[0].length;
    addLights(this.scene, { size: this.W * CELL * 0.7, dir: new THREE.Vector3(-0.35, 1, 0.55) });

    // Tuning: solo play is a bit faster and calmer, bigger teams get more orders at once.
    this.chopTime = this.solo ? 1.2 : 1.6;
    this.cookTime = this.solo ? 5 : 7;
    this.orderTimeScale = this.solo ? 1.25 : 1;
    this.orderCap = [2, 3, 3, 3, 4, 4][n - 1] || 4;
    const scale = [1, 1.4, 1.7, 2, 2.2, 2.4][n - 1] || 2.4;
    this.spawnGap = [9, 7, 6, 5, 4.5, 4][n - 1] || 4; // seconds between new orders while below the cap
    this.thresholds = [25, 70, 135].map((v) => Math.round((v * scale) / 5) * 5);

    this.timeLeft = ROUND_TIME;
    this.coins = 0;
    this.servedCount = 0;
    this.orders = [];
    this.orderId = 0;
    this.spawnT = 1;
    this.customers = [];
    this.floats = [];
    this.lastBeep = 99;

    this.buildKitchen();
    this.buildSurroundings();
    this.spawnPlayers();

    this.frame();
    game.audio.playMusic('party');
    this.intro(t('game.cook'), t('cook.intro'));
  }

  // ---------- layout helpers ----------
  cx(c) { return (c - (this.W - 1) / 2) * CELL; }
  cz(r) { return (r - (this.D - 1) / 2) * CELL; }
  cellAt(x, z) {
    const c = Math.round(x / CELL + (this.W - 1) / 2), r = Math.round(z / CELL + (this.D - 1) / 2);
    return { r, c };
  }
  station(r, c) {
    if (r < 0 || c < 0 || r >= this.D || c >= this.W) return null;
    return this.grid[r][c];
  }

  frame() {
    const tilt = THREE.MathUtils.degToRad(57);
    const w = this.W * CELL + 4.5, d = this.D * CELL + 1.5;
    const dist = this.fitDistance(w, d * Math.sin(tilt) + 2.6 * Math.cos(tilt) + 2.6);
    const lookZ = 0.5;
    this.camera.position.set(0, Math.sin(tilt) * dist, Math.cos(tilt) * dist + lookZ);
    this.camera.lookAt(0, 0, lookZ);
    this.confettiOrigin = new THREE.Vector3(0, 3, 0);
  }

  resize(w, h) {
    super.resize(w, h);
    this.frame();
  }

  counterColor(r, c) {
    if (r === 0) return COLORS.candyBlue;
    if (r === this.D - 1) return COLORS.candyYellow;
    if (c === 0) return COLORS.candyPink;
    if (c === this.W - 1) return COLORS.candyMint;
    return COLORS.candyLilac;
  }

  buildKitchen() {
    const s = this.scene;
    const kw = this.W * CELL, kd = this.D * CELL;

    // Checkered tile floor (two tiles per cell), drawn into a tiny canvas.
    const cv = document.createElement('canvas');
    cv.width = this.W * 2; cv.height = this.D * 2;
    const g2 = cv.getContext('2d');
    for (let j = 0; j < cv.height; j++) {
      for (let i = 0; i < cv.width; i++) {
        g2.fillStyle = (i + j) % 2 ? '#ffe3c2' : '#fff7ea';
        g2.fillRect(i, j, 1, 1);
      }
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(kw, kd), new THREE.MeshToonMaterial({ map: tex, gradientMap: toon(0xffffff).gradientMap }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0.002;
    floor.receiveShadow = true;
    s.add(floor);
    // Kitchen base slab under the floor.
    const base = new THREE.Mesh(new RoundedBoxGeometry(kw + 0.8, 0.5, kd + 0.8, 2, 0.2), toon(0xd9c3a5));
    base.position.y = -0.25;
    base.receiveShadow = true;
    s.add(base);

    // Back wall with windows and a tiled band.
    const wallZ = this.cz(0) - CELL / 2 - 0.2;
    const wall = mesh(new RoundedBoxGeometry(kw + 0.8, 2.8, 0.4, 2, 0.12), toon(0xfff3dc), 0, 1.4, wallZ);
    wall.receiveShadow = true;
    s.add(wall);
    s.add(mesh(new THREE.BoxGeometry(kw + 0.82, 0.5, 0.42), toon(COLORS.candyBlue), 0, 1.15, wallZ));
    s.add(mesh(new THREE.BoxGeometry(kw + 0.84, 0.18, 0.44), toon(COLORS.candyPink), 0, 2.7, wallZ));
    for (let i = 0; i < 3; i++) {
      const x = (i - 1) * kw * 0.3;
      const frame = mesh(rbox('win', 1.7, 1.0, 0.1, 0.06), toon(COLORS.white), x, 2.05, wallZ + 0.22);
      frame.add(mesh(new THREE.PlaneGeometry(1.45, 0.78), toon(0x9fe0ff), 0, 0, 0.06));
      frame.add(mesh(new THREE.BoxGeometry(0.08, 0.8, 0.04), toon(COLORS.white), 0, 0, 0.07));
      s.add(frame);
    }
    // Low side walls.
    for (const sd of [-1, 1]) {
      s.add(mesh(new RoundedBoxGeometry(0.4, 0.55, kd + 0.8, 2, 0.12), toon(0xfff3dc), sd * (kw / 2 + 0.2), 0.27, 0));
    }

    this.grid = [];
    this.stations = [];
    this.pots = [];
    this.hatches = [];
    for (let r = 0; r < this.D; r++) {
      const row = [];
      for (let c = 0; c < this.W; c++) {
        const ch = this.layout[r][c];
        if (ch === '.') { row.push(null); continue; }
        const st = { r, c, x: this.cx(c), z: this.cz(r), type: TYPES[ch], item: null, surf: H, chopping: false };
        if (CRATE_ING[ch]) st.ing = CRATE_ING[ch];
        this.buildStation(st);
        row.push(st);
        this.stations.push(st);
      }
      this.grid.push(row);
    }
    // One awning over each run of hatch cells, and a bell on the first one.
    const hz = this.hatches.map((h) => h.z);
    const hx = this.hatches[0].x;
    const zMin = Math.min(...hz) - CELL / 2, zMax = Math.max(...hz) + CELL / 2;
    const stripes = Math.round((zMax - zMin) / 0.4);
    for (let i = 0; i < stripes; i++) {
      const st = mesh(new THREE.BoxGeometry(0.85, 0.08, (zMax - zMin) / stripes), toon(i % 2 ? COLORS.white : 0xff5d73), hx + 0.3, 1.85, zMin + (i + 0.5) * ((zMax - zMin) / stripes));
      st.rotation.z = -0.35;
      this.scene.add(st);
    }
    for (const z of [zMin + 0.08, zMax - 0.08]) this.scene.add(mesh(cyl('post', 0.06, 0.06, 1.8, 8), toon(COLORS.white), hx + 0.68, 0.9, z));
    this.hatchZ = (zMin + zMax) / 2;
    // Wooden deck outside the hatch where the customers queue.
    const deck = mesh(new RoundedBoxGeometry(3.6, 0.3, zMax - zMin + 4.2, 2, 0.1), toon(0xd9a066), kw / 2 + 2.2, -0.15, this.hatchZ + 1.4);
    deck.receiveShadow = true;
    this.scene.add(deck);
    for (let i = 1; i < 6; i++) this.scene.add(mesh(new THREE.BoxGeometry(0.04, 0.02, zMax - zMin + 4), toon(0xb87a48), kw / 2 + 0.4 + i * 0.6, 0.005, this.hatchZ + 1.4));
  }

  /** Counter body + top slab in the given colors. */
  counter(st, body, top = tint(body)) {
    const g = new THREE.Group();
    const b = mesh(rbox('body', CELL - 0.08, H - 0.1, CELL - 0.08, 0.08), toon(body), 0, (H - 0.1) / 2, 0);
    b.receiveShadow = true;
    const tp = mesh(rbox('top', CELL - 0.02, 0.12, CELL - 0.02, 0.05), toon(top), 0, H - 0.06, 0);
    tp.receiveShadow = true;
    g.add(b, tp);
    g.position.set(st.x, 0, st.z);
    this.scene.add(g);
    return g;
  }

  buildStation(st) {
    const col = this.counterColor(st.r, st.c);
    switch (st.type) {
      case 'counter':
        this.counter(st, col);
        break;
      case 'board': {
        const g = this.counter(st, col);
        g.add(mesh(rbox('board', 1.0, 0.07, 0.8, 0.03), toon(0xf3d39b), 0, H + 0.035, 0));
        g.add(mesh(rbox('boardGroove', 0.85, 0.075, 0.03, 0.01), toon(0xd9ae6c), 0, H + 0.036, 0.32));
        st.surf = H + 0.07;
        break;
      }
      case 'crate': {
        const g = new THREE.Group();
        g.position.set(st.x, 0, st.z);
        const box = mesh(rbox('crate', CELL - 0.1, H, CELL - 0.1, 0.06), toon(0xd29a5f), 0, H / 2, 0);
        box.receiveShadow = true;
        g.add(box);
        for (const y of [0.18, 0.46]) g.add(mesh(rbox('slat', CELL - 0.06, 0.1, CELL - 0.06, 0.03), toon(0xb87a48), 0, y, 0));
        g.add(mesh(new THREE.BoxGeometry(CELL - 0.3, 0.02, CELL - 0.3), toon(0x8a5a3a), 0, H + 0.005, 0));
        // A heap of the ingredient on top and a round sign on the front.
        [[-0.25, -0.2], [0.25, -0.15], [0, 0.22], [-0.05, -0.02]].forEach(([x, z], i) => {
          const w = wholeMesh(st.ing);
          w.position.set(x, H + (i === 3 ? 0.12 : 0), z);
          w.rotation.y = i * 1.7;
          g.add(w);
        });
        const sign = mesh(cyl('sign', 0.22, 0.22, 0.04, 20), toon(COLORS.white), 0, H * 0.55, (CELL - 0.1) / 2 + 0.02);
        sign.rotation.x = Math.PI / 2;
        sign.add(mesh(cyl('signIn', 0.15, 0.15, 0.05, 20), toon(ING[st.ing].color)));
        g.add(sign);
        this.scene.add(g);
        break;
      }
      case 'pot': {
        const g = this.counter(st, 0x5d5778, 0x8d88a6);
        g.add(mesh(new THREE.TorusGeometry(0.42, 0.05, 8, 24).rotateX(Math.PI / 2), toon(0x3d3852), 0, H + 0.02, 0));
        const glow = mesh(new THREE.TorusGeometry(0.34, 0.05, 8, 24).rotateX(Math.PI / 2), toon(0xff8c42, { emissive: 0xff5a1f }), 0, H + 0.03, 0);
        glow.visible = false;
        g.add(glow);
        const potMat = new THREE.MeshToonMaterial({ color: 0xb9c3d6, gradientMap: toon(0xffffff).gradientMap, side: THREE.DoubleSide });
        const pot = mesh(new THREE.CylinderGeometry(0.46, 0.4, 0.46, 24, 1, true), potMat, 0, H + 0.27, 0);
        g.add(pot);
        g.add(mesh(cyl('potBottom', 0.4, 0.4, 0.04, 24), toon(0x6d7488), 0, H + 0.06, 0));
        g.add(mesh(new THREE.TorusGeometry(0.46, 0.04, 8, 28).rotateX(Math.PI / 2), toon(0xdfe6f2), 0, H + 0.5, 0));
        for (const sd of [-1, 1]) g.add(mesh(rbox('handle', 0.18, 0.06, 0.16, 0.03), toon(0x3d3852), sd * 0.55, H + 0.42, 0));
        const fill = mesh(cyl('fill', 0.42, 0.42, 0.05, 24), toon(ING.tomato.soup), 0, H + 0.1, 0);
        fill.visible = false;
        g.add(fill);
        // Floating chopped bits so you can see what is in the pot.
        const bits = new THREE.Group();
        g.add(bits);
        st.pot = { kind: null, count: 0, cook: 0, ready: false, glow, fill, bits, steamT: 0, g };
        this.pots.push(st);
        break;
      }
      case 'plates': {
        const g = this.counter(st, col);
        for (let i = 0; i < 4; i++) g.add(mesh(cyl('plate', 0.42, 0.34, 0.07, 24), toon(i % 2 ? COLORS.white : 0xeaf6ff), (i % 2) * 0.03, H + 0.035 + i * 0.075, 0));
        break;
      }
      case 'hatch': {
        const g = this.counter(st, COLORS.gold, 0x8a5a3a);
        g.add(mesh(new THREE.BoxGeometry(0.9, 0.02, CELL - 0.3), toon(0xa86c45), 0, H + 0.005, 0));
        if (!this.hatches.length) {
          const bell = mesh(dome('bell', 0.17), toon(COLORS.gold, { emissive: 0x332200 }), 0.4, H, -0.45);
          bell.add(mesh(sph(0.04, 8, 6), toon(COLORS.ink), 0, 0.19, 0));
          g.add(bell);
        }
        this.hatches.push(st);
        break;
      }
      case 'bin': {
        const g = new THREE.Group();
        g.position.set(st.x, 0, st.z);
        g.add(mesh(cyl('bin', 0.5, 0.42, H - 0.05, 20), toon(COLORS.leaf), 0, (H - 0.05) / 2, 0));
        g.add(mesh(cyl('binLid', 0.55, 0.55, 0.08, 20), toon(COLORS.grassDark), 0, H - 0.02, 0));
        g.add(mesh(new THREE.TorusGeometry(0.2, 0.04, 6, 16).rotateX(Math.PI / 2), toon(COLORS.white), 0, H + 0.04, 0));
        this.scene.add(g);
        break;
      }
      default: break;
    }
  }

  buildSurroundings() {
    const s = this.scene;
    const ground = new THREE.Mesh(new THREE.CircleGeometry(70, 40), toon(COLORS.grass));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.4;
    ground.receiveShadow = true;
    s.add(ground);
    const rand = seeded(77);
    const kw = this.W * CELL, kd = this.D * CELL;
    for (let i = 0; i < 22; i++) {
      const x = (rand() - 0.5) * (kw + 26);
      const z = -kd / 2 - 2 - rand() * 14;
      const tr = makeTree(rand, 1 + rand() * 0.6);
      tr.position.set(x, -0.4, z);
      s.add(tr);
    }
    for (let i = 0; i < 10; i++) {
      const sd = i % 2 ? 1 : -1;
      const b = makeBush(rand, 0.9 + rand() * 0.5);
      b.position.set(sd * (kw / 2 + 4 + rand() * 6), -0.4, (rand() - 0.5) * kd);
      s.add(b);
    }
    for (let i = 0; i < 40; i++) {
      const f = makeFlower(rand);
      const sd = rand() < 0.5 ? 1 : -1;
      f.position.set(sd * (kw / 2 + 1.2 + rand() * 8), -0.4, (rand() - 0.5) * (kd + 6));
      if (sd > 0 && Math.abs(f.position.z - 0) < 4 && f.position.x < kw / 2 + 3) continue; // keep the customer queue clear
      s.add(f);
    }
  }

  spawnPlayers() {
    // Floor cells nearest the middle, spread apart.
    const floors = [];
    for (let r = 0; r < this.D; r++) for (let c = 0; c < this.W; c++) if (!this.grid[r][c]) floors.push({ r, c });
    const midR = (this.D - 1) / 2, midC = (this.W - 1) / 2;
    floors.sort((a, b) => Math.hypot(a.r - midR, (a.c - midC) * 0.6) - Math.hypot(b.r - midR, (b.c - midC) * 0.6));
    const picks = [];
    for (const f of floors) {
      if (picks.length >= this.players.length) break;
      if (picks.every((p) => Math.abs(p.r - f.r) + Math.abs(p.c - f.c) >= 2)) picks.push(f);
    }
    while (picks.length < this.players.length) picks.push(floors[picks.length % floors.length]);

    this.ents = this.players.map((p, i) => {
      const ch = new Character(p.color, { hat: p.hat });
      this.scene.add(ch.group);
      const x = this.cx(picks[i].c), z = this.cz(picks[i].r);
      ch.group.position.set(x, 0, z);
      ch.face(0, 1);
      ch.yaw = ch.targetYaw;
      // Carried item floats above the head, held up by two little hands.
      const carry = new THREE.Group();
      carry.position.set(0, 1.62, 0.05);
      ch.pivot.add(carry);
      const hands = new THREE.Group();
      for (const sd of [-1, 1]) hands.add(mesh(sph(0.1), toon(p.color), sd * 0.36, 1.48, 0.05));
      hands.visible = false;
      ch.pivot.add(hands);
      const knife = new THREE.Group();
      knife.add(mesh(rbox('kHandle', 0.07, 0.07, 0.2, 0.02), toon(COLORS.trunk), 0, 0, 0));
      knife.add(mesh(rbox('kBlade', 0.03, 0.12, 0.3, 0.015), toon(0xdfe6f2), 0, -0.02, 0.24));
      knife.position.set(0.32, 0.75, 0.38);
      knife.visible = false;
      ch.pivot.add(knife);
      const ring = new THREE.Mesh(sharedGeo('ck-ring', () => new THREE.RingGeometry(0.48, 0.6, 24)), toon(p.color, { transparent: true, opacity: 0.85 }));
      ring.rotation.x = -Math.PI / 2;
      this.scene.add(ring);
      // Square outline on the station this player would use.
      const hl = new THREE.Mesh(sharedGeo('ck-hl', () => new THREE.RingGeometry(0.78, 0.92, 4, 1)), basic(p.color));
      hl.rotation.set(-Math.PI / 2, 0, Math.PI / 4);
      hl.visible = false;
      this.scene.add(hl);
      const hint = this.game.ui.label('label player-tag');
      hint.style.display = 'none';
      return {
        p, ch, carry, hands, knife, ring, hl, hint, hintT: 0,
        x, z, vx: 0, vz: 0, fx: 0, fz: 1,
        held: null, target: null, chopping: false, chopSfx: 0,
        served: 0, chopped: 0, potted: 0,
      };
    });
  }

  // ---------- items ----------
  newItem(kind) {
    const item = { kind, chopped: false, chop: 0, contents: [], soup: null, mesh: null };
    item.mesh = itemMesh(item);
    return item;
  }

  /** Rebuild an item's mesh after it changed, keeping it where it was. */
  refresh(item) {
    const old = item.mesh;
    item.mesh = itemMesh(item);
    item.mesh.position.copy(old.position);
    old.parent?.add(item.mesh);
    old.parent?.remove(old);
  }

  give(e, item) {
    e.held = item;
    item.mesh.position.set(0, 0, 0);
    item.mesh.scale.setScalar(1.1);
    e.carry.add(item.mesh);
    e.ch.squash(1.15);
  }

  place(st, item) {
    st.item = item;
    item.mesh.scale.setScalar(1);
    item.mesh.position.set(st.x, st.surf, st.z);
    this.scene.add(item.mesh);
  }

  drop(item) {
    item.mesh.parent?.remove(item.mesh);
  }

  /** Which finished recipe is on this plate, if any. */
  dishOf(item) {
    if (!item || item.kind !== 'plate') return null;
    if (item.soup === 'tomato') return 'soupT';
    if (item.soup === 'mushroom') return 'soupM';
    if (item.contents.length === 2) return 'salad';
    return null;
  }

  canPlate(plate, ing) {
    return !plate.soup && ing.chopped && (ing.kind === 'lettuce' || ing.kind === 'tomato') && !plate.contents.includes(ing.kind);
  }

  hint(e, key) {
    this.game.audio.play('bump');
    e.ch.squash(0.85);
    if (e.hintT > 0 && e.hintKey === key) return;
    e.hintKey = key;
    e.hintT = 1.8;
    e.hint.textContent = t(key);
  }

  // ---------- interaction ----------
  findTarget(e) {
    const { r, c } = this.cellAt(e.x, e.z);
    const px = e.x + e.fx * 0.8, pz = e.z + e.fz * 0.8;
    let best = null, bestD = Infinity;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const st = this.station(r + dr, c + dc);
        if (!st) continue;
        // Reach: distance from the bean to the edge of the station's cell.
        const ex = Math.max(0, Math.abs(e.x - st.x) - CELL / 2), ez = Math.max(0, Math.abs(e.z - st.z) - CELL / 2);
        if (Math.hypot(ex, ez) > PR + 0.45) continue;
        const d = Math.hypot(px - st.x, pz - st.z);
        if (d < bestD) { bestD = d; best = st; }
      }
    }
    return best;
  }

  interact(e, st) {
    const audio = this.game.audio;
    const h = e.held;
    switch (st.type) {
      case 'crate':
        if (!h) { this.give(e, this.newItem(st.ing)); audio.play('pop'); }
        else if (h.kind === st.ing && !h.chopped) { this.drop(h); e.held = null; audio.play('select'); }
        else this.hint(e, 'cook.hint.order');
        break;
      case 'plates':
        if (!h) { this.give(e, this.newItem('plate')); audio.play('select'); }
        else if (h.kind === 'plate' && !h.soup && !h.contents.length) { this.drop(h); e.held = null; audio.play('select'); }
        else audio.play('bump');
        break;
      case 'bin':
        if (!h) break;
        this.puffs.burst(new THREE.Vector3(st.x, H + 0.3, st.z), COLORS.leaf, { count: 8, size: 0.25, speed: 2, life: 0.5 });
        audio.play('splat');
        if (h.kind === 'plate') { h.soup = null; h.contents = []; this.refresh(h); }
        else { this.drop(h); e.held = null; }
        break;
      case 'hatch':
        if (h && this.dishOf(h)) this.serve(e, st);
        else this.hint(e, 'cook.hint.order');
        break;
      case 'pot': this.usePot(e, st); break;
      default: // counter or board
        if (!h) {
          if (st.item) { const it = st.item; st.item = null; this.drop(it); this.give(e, it); audio.play('select'); }
        } else if (!st.item) {
          this.drop(h); e.held = null; this.place(st, h); audio.play('land');
        } else if (h.kind === 'plate' && st.item.kind !== 'plate') {
          // Scoop the chopped thing on the counter onto the held plate.
          if (this.canPlate(h, st.item)) { h.contents.push(st.item.kind); this.drop(st.item); st.item = null; this.refresh(h); audio.play('pop'); }
          else this.hint(e, st.item.chopped ? 'cook.hint.pot' : 'cook.hint.chop');
        } else if (h.kind !== 'plate' && st.item.kind === 'plate') {
          if (this.canPlate(st.item, h)) { st.item.contents.push(h.kind); this.drop(h); e.held = null; this.refresh(st.item); audio.play('pop'); }
          else this.hint(e, !h.chopped ? 'cook.hint.chop' : h.kind === 'mushroom' ? 'cook.hint.pot' : 'cook.hint.order');
        } else audio.play('bump');
    }
  }

  usePot(e, st) {
    const pot = st.pot, h = e.held, audio = this.game.audio;
    if (!h) { if (pot.ready) this.hint(e, 'cook.hint.plate'); return; }
    if (h.kind === 'plate') {
      if (pot.ready && !h.soup && !h.contents.length) {
        h.soup = pot.kind;
        this.refresh(h);
        pot.kind = null; pot.count = 0; pot.cook = 0; pot.ready = false;
        this.updatePotLook(st);
        audio.play('pop');
        this.puffs.burst(new THREE.Vector3(st.x, H + 0.7, st.z), COLORS.white, { count: 10, size: 0.3, speed: 1.5, up: 2, gravity: 2, life: 0.8 });
      } else if (pot.ready) this.hint(e, 'cook.hint.order');
      else if (pot.count) this.hint(e, 'cook.hint.busy');
      else audio.play('bump');
      return;
    }
    if (!h.chopped) return this.hint(e, 'cook.hint.chop');
    if (h.kind === 'lettuce') return this.hint(e, 'cook.hint.notPot');
    if (pot.count >= POT_NEED) return this.hint(e, 'cook.hint.busy');
    if (pot.kind && pot.kind !== h.kind) return this.hint(e, 'cook.hint.same');
    pot.kind = h.kind;
    pot.count++;
    this.drop(h);
    e.held = null;
    e.potted++;
    audio.play('bubble');
    this.puffs.burst(new THREE.Vector3(st.x, H + 0.55, st.z), ING[pot.kind].color, { count: 6, size: 0.18, speed: 2, up: 3, life: 0.5 });
    this.updatePotLook(st);
  }

  updatePotLook(st) {
    const pot = st.pot;
    pot.fill.visible = pot.count > 0;
    if (pot.kind) pot.fill.material = toon(ING[pot.kind].soup);
    pot.fill.position.y = H + 0.12 + pot.count * 0.09;
    pot.bits.clear();
    if (pot.kind && !pot.ready) {
      for (let i = 0; i < pot.count; i++) {
        const b = choppedMesh(pot.kind);
        b.scale.setScalar(0.6);
        const a = i * 2.1;
        b.position.set(Math.cos(a) * 0.18, pot.fill.position.y, Math.sin(a) * 0.18);
        pot.bits.add(b);
      }
    }
  }

  serve(e, st) {
    const dish = this.dishOf(e.held);
    // Most urgent matching order gets it.
    const matches = this.orders.filter((o) => o.recipe === dish).sort((a, b) => a.time - b.time);
    if (!matches.length) return this.hint(e, 'cook.hint.order');
    const o = matches[0];
    const tip = Math.round(8 * clamp(o.time / o.total, 0, 1));
    const gain = RECIPES[dish].coins + tip;
    this.coins += gain;
    this.servedCount++;
    e.served++;
    this.orders = this.orders.filter((x) => x !== o);
    this.drop(e.held);
    e.held = null;
    const audio = this.game.audio;
    audio.play('coin');
    if (tip >= 6) this.later(0.12, () => audio.play('star'));
    const pos = new THREE.Vector3(st.x, H + 0.6, st.z);
    this.confetti.burst(pos, 0, { count: 26, speed: 6, up: 5, colors: [COLORS.gold, 0xff5d73, 0x4cc9f0, 0x3ddc97], life: 1.1, size: 0.14 });
    this.floatText(`+${gain}`, pos);
    const cu = this.customers.find((c) => c.order === o);
    if (cu) { cu.state = 'happy'; cu.t = 0; }
    if (!this.orders.length) this.spawnT = Math.min(this.spawnT, 1.2);
  }

  floatText(text, pos) {
    const el = this.game.ui.label('label');
    el.innerHTML = `<span style="color:#f0a020">${text}</span>`;
    this.floats.push({ el, pos: pos.clone(), t: 0 });
  }

  // ---------- orders ----------
  maxOrders() {
    const el = ROUND_TIME - this.timeLeft;
    const want = el < 25 && this.servedCount < 1 ? 1 : el < 75 ? 2 : el < 120 ? 3 : 4;
    return Math.min(this.orderCap, want);
  }

  spawnOrder() {
    let recipe;
    if (this.orderId === 0) recipe = 'salad';
    else if (this.orderId === 1) recipe = 'soupT';
    else {
      const keys = Object.keys(RECIPES);
      // Avoid three of the same at once.
      const ok = keys.filter((k) => this.orders.filter((o) => o.recipe === k).length < 2);
      recipe = ok[Math.floor(Math.random() * ok.length)] || 'salad';
    }
    const total = RECIPES[recipe].time * this.orderTimeScale;
    const used = new Set(this.orders.map((o) => o.colorIndex));
    let colorIndex = this.orderId % CUSTOMER_COLORS.length;
    while (used.has(colorIndex) && used.size < CUSTOMER_COLORS.length) colorIndex = (colorIndex + 1) % CUSTOMER_COLORS.length;
    const o = { id: this.orderId++, recipe, time: total, total, colorIndex };
    this.orders.push(o);
    this.game.audio.play('join');

    // A customer walks up to the hatch window.
    const g = makeGrumble(CUSTOMER_COLORS[colorIndex]);
    g.scale.setScalar(1.3);
    const x0 = this.hatches[0].x + 3;
    g.position.set(x0, 0, this.hatchZ + 4.5);
    this.scene.add(g);
    this.customers.push({ g, order: o, state: 'come', t: 0, x: x0, z: this.hatchZ + 4.5 });
  }

  updateOrders(dt) {
    for (const o of this.orders) o.time -= dt;
    const expired = this.orders.filter((o) => o.time <= 0);
    if (expired.length) {
      this.orders = this.orders.filter((o) => o.time > 0);
      for (const o of expired) {
        this.game.audio.play('leave');
        this.game.ui.toast(t('cook.left', { r: t(`cook.r.${o.recipe}`) }));
        const cu = this.customers.find((c) => c.order === o);
        if (cu) { cu.state = 'sad'; cu.t = 0; }
      }
      this.spawnT = Math.min(this.spawnT, 2);
    }
    if (this.orders.length < this.maxOrders()) {
      this.spawnT -= dt;
      if (this.spawnT <= 0) {
        this.spawnOrder();
        this.spawnT = this.spawnGap;
      }
    }
  }

  updateCustomers(dt) {
    const waiting = this.customers.filter((c) => c.state === 'come' || c.state === 'wait');
    const baseX = this.hatches[0].x + 2.1;
    for (const cu of this.customers) {
      cu.t += dt;
      const g = cu.g;
      if (cu.state === 'come' || cu.state === 'wait') {
        const i = waiting.indexOf(cu);
        const tx = baseX + (i % 2) * 0.9 + Math.floor(i / 2) * 0.25, tz = this.hatchZ - 0.6 + i * 0.95;
        const dx = tx - cu.x, dz = tz - cu.z, d = Math.hypot(dx, dz);
        const step = Math.min(d, dt * 4);
        if (d > 0.01) { cu.x += (dx / d) * step; cu.z += (dz / d) * step; }
        const moving = d > 0.05;
        g.position.set(cu.x, (moving ? Math.abs(Math.sin(cu.t * 12)) * 0.15 : 0), cu.z);
        g.rotation.y = moving ? Math.atan2(dx, dz) : -Math.PI / 2;
        // Gets a little wobbly when the order is nearly out of time.
        const urgent = cu.order.time / cu.order.total < 0.25;
        g.userData.body.rotation.z = urgent ? Math.sin(cu.t * 14) * 0.15 : Math.sin(cu.t * 2) * 0.05;
      } else if (cu.state === 'happy') {
        // Hop, spin and skip away.
        cu.x += dt * 3; cu.z += dt * 4;
        g.position.set(cu.x, Math.abs(Math.sin(cu.t * 9)) * 0.7, cu.z);
        g.rotation.y += dt * 10;
        if (cu.t > 2.5) cu.gone = true;
      } else {
        cu.x += dt * 1.6; cu.z += dt * 0.6;
        g.position.set(cu.x, 0, cu.z);
        g.rotation.y = Math.atan2(1.6, 0.6);
        g.scale.setScalar(Math.max(0.01, 1.3 - Math.max(0, cu.t - 2) * 0.9));
        if (cu.t > 3.3) cu.gone = true;
      }
    }
    for (const cu of this.customers) if (cu.gone) this.scene.remove(cu.g);
    this.customers = this.customers.filter((c) => !c.gone);
  }

  // ---------- players ----------
  updatePlayers(dt) {
    const playing = this.state === 'play';
    const audio = this.game.audio;
    for (const st of this.stations) st.chopping = false;
    for (const e of this.ents) {
      const inp = (playing && this.input(e.p)) || { x: 0, y: 0, a: false, b: false, aPressed: false, bPressed: false };
      let ix = inp.x, iz = -inp.y;
      const mag = Math.hypot(ix, iz);
      if (mag > 1) { ix /= mag; iz /= mag; }
      if (mag > 0.25) { e.fx = ix / Math.max(mag, 1e-4); e.fz = iz / Math.max(mag, 1e-4); }

      e.target = playing ? this.findTarget(e) : null;
      const st = e.target;

      // Hold B at a board to chop (holding a raw ingredient at an empty board puts it down first).
      e.chopping = false;
      if (st && st.type === 'board' && inp.b) {
        if (!st.item && e.held && e.held.kind !== 'plate' && !e.held.chopped) {
          const it = e.held;
          e.held = null;
          this.drop(it);
          this.place(st, it);
        }
        if (st.item && st.item.kind !== 'plate' && !st.item.chopped) e.chopping = true;
      }
      if (e.chopping) {
        ix = 0; iz = 0;
        st.chopping = true;
        const it = st.item;
        it.chop += dt / this.chopTime;
        e.chopSfx -= dt;
        if (e.chopSfx <= 0) { e.chopSfx = 0.22; audio.play('land'); e.ch.squash(0.88); }
        if (it.chop >= 1) {
          it.chopped = true;
          this.refresh(it);
          audio.play('pop');
          this.puffs.burst(new THREE.Vector3(st.x, st.surf + 0.2, st.z), ING[it.kind].color, { count: 8, size: 0.16, speed: 3, up: 3, life: 0.5 });
          // Everyone chopping this board when it finishes gets the credit.
          for (const o of this.ents) if (o.target === st && o.chopping) o.chopped++;
        }
        e.fx = st.x - e.x; e.fz = st.z - e.z;
        const fl = Math.hypot(e.fx, e.fz) || 1;
        e.fx /= fl; e.fz /= fl;
      } else if (st && inp.aPressed) {
        this.interact(e, st);
      }

      // Movement with a little acceleration, then slide along counters.
      const acc = 40 * dt;
      e.vx += clamp(ix * SPEED - e.vx, -acc, acc);
      e.vz += clamp(iz * SPEED - e.vz, -acc, acc);
      e.x += e.vx * dt;
      e.z += e.vz * dt;
      this.collide(e);
    }
    this.separate();

    for (const e of this.ents) {
      const sp = Math.hypot(e.vx, e.vz);
      e.ch.face(e.fx, e.fz);
      e.ch.group.position.set(e.x, 0, e.z);
      e.ch.update(dt, { moving: Math.min(1, sp / SPEED), grounded: true });
      e.ring.position.set(e.x, 0.02, e.z);
      e.hands.visible = !!e.held;
      e.knife.visible = e.chopping;
      if (e.chopping) e.knife.rotation.x = -0.3 + Math.abs(Math.sin(this.time * 14)) * 0.9;
      if (e.held) e.carry.position.y = 1.62 + Math.sin(this.time * 5 + e.p.color) * 0.03;
      const st = e.target;
      e.hl.visible = !!st && this.state === 'play';
      if (st) e.hl.position.set(st.x, (st.type === 'bin' ? H + 0.06 : st.surf) + 0.02, st.z);
      if (e.hintT > 0) {
        e.hintT -= dt;
        this.game.ui.place(e.hint, new THREE.Vector3(e.x, 2.5, e.z), this.camera);
      } else e.hint.style.display = 'none';
    }
  }

  /** Push a bean out of any counter cells it overlaps. */
  collide(e) {
    const { r, c } = this.cellAt(e.x, e.z);
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const rr = r + dr, cc = c + dc;
        const blocked = rr < 0 || cc < 0 || rr >= this.D || cc >= this.W || this.grid[rr][cc];
        if (!blocked) continue;
        const bx = this.cx(cc), bz = this.cz(rr), h = CELL / 2;
        const qx = clamp(e.x, bx - h, bx + h), qz = clamp(e.z, bz - h, bz + h);
        const dx = e.x - qx, dz = e.z - qz, d = Math.hypot(dx, dz);
        if (d >= PR) continue;
        if (d < 1e-5) { // center inside the box: push out along the shortest axis
          const ox = h + PR - Math.abs(e.x - bx), oz = h + PR - Math.abs(e.z - bz);
          if (ox < oz) e.x += Math.sign(e.x - bx || 1) * ox; else e.z += Math.sign(e.z - bz || 1) * oz;
          continue;
        }
        e.x = qx + (dx / d) * PR;
        e.z = qz + (dz / d) * PR;
        const vn = e.vx * (dx / d) + e.vz * (dz / d);
        if (vn < 0) { e.vx -= vn * (dx / d); e.vz -= vn * (dz / d); }
      }
    }
  }

  separate() {
    for (let i = 0; i < this.ents.length; i++) {
      for (let j = i + 1; j < this.ents.length; j++) {
        const a = this.ents[i], b = this.ents[j];
        const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
        if (d >= PR * 2 || d < 1e-4) continue;
        const nx = dx / d, nz = dz / d, push = (PR * 2 - d) / 2;
        a.x -= nx * push; a.z -= nz * push;
        b.x += nx * push; b.z += nz * push;
      }
    }
    for (const e of this.ents) this.collide(e);
  }

  // ---------- stations ----------
  updateStations(dt) {
    for (const st of this.pots) {
      const pot = st.pot;
      const cooking = pot.count >= POT_NEED && !pot.ready;
      if (cooking) {
        pot.cook += dt / this.cookTime;
        if (pot.cook >= 1) {
          pot.ready = true;
          this.updatePotLook(st);
          this.game.audio.play('rescue');
          this.puffs.burst(new THREE.Vector3(st.x, H + 0.8, st.z), COLORS.white, { count: 14, size: 0.35, speed: 2, up: 2, gravity: 2, life: 1 });
        }
      }
      pot.glow.visible = cooking;
      if (cooking) pot.glow.scale.setScalar(1 + Math.sin(this.time * 10) * 0.05);
      // Steam: gentle while cooking, puffy when ready (it just waits, nothing burns).
      if (cooking || pot.ready) {
        pot.steamT -= dt;
        if (pot.steamT <= 0) {
          pot.steamT = pot.ready ? 0.12 : 0.22;
          this.puffs.burst(new THREE.Vector3(st.x + (Math.random() - 0.5) * 0.4, H + 0.6, st.z + (Math.random() - 0.5) * 0.4), COLORS.white,
            { count: 1, size: pot.ready ? 0.4 : 0.28, speed: 0.4, up: 1.4, gravity: 1.5, drag: 2, life: 1.2 });
        }
      }
      if (pot.fill.visible) pot.fill.position.y = H + 0.12 + pot.count * 0.09 + (cooking || pot.ready ? Math.sin(this.time * 8) * 0.015 : 0);
      pot.bits.rotation.y += dt * (cooking ? 1.5 : 0.3);
    }
    // Progress labels for boards and pots.
    for (const st of this.stations) {
      let html = '';
      if (st.type === 'board' && st.item && st.item.kind !== 'plate' && !st.item.chopped && st.item.chop > 0) {
        html = this.barHtml(st.item.chop, '#3ddc97');
      } else if (st.type === 'pot' && st.pot.count > 0) {
        const pot = st.pot;
        if (pot.ready) html = `<span style="color:#3ddc97">${t('cook.ready')}</span>`;
        else {
          const dots = Array.from({ length: POT_NEED }, (_, i) => dot(i < pot.count ? ING[pot.kind].css : '#d8d2e6')).join(' ');
          html = `<div style="display:flex;gap:3px;justify-content:center">${dots}</div>${pot.count >= POT_NEED ? this.barHtml(pot.cook, '#ffc93c') : ''}`;
        }
      }
      if (html && this.state === 'play') {
        if (!st.label) st.label = this.game.ui.label('label');
        if (st.labelHtml !== html) { st.label.innerHTML = html; st.labelHtml = html; }
        this.game.ui.place(st.label, new THREE.Vector3(st.x, H + 1.0, st.z), this.camera);
      } else if (st.label) st.label.style.display = 'none';
    }
  }

  barHtml(k, color) {
    const pct = Math.round(clamp(k, 0, 1) * 20) * 5; // 5% steps keep DOM updates cheap
    return `<div style="width:3.4em;height:.7em;margin:2px auto 0;border-radius:.4em;background:#2b2340;border:3px solid #fff;overflow:hidden"><div style="width:${pct}%;height:100%;background:${color}"></div></div>`;
  }

  // ---------- HUD ----------
  stars() {
    return this.thresholds.filter((v) => this.coins >= v).length;
  }

  hud() {
    const secs = Math.max(0, Math.ceil(this.timeLeft));
    const clock = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
    const cards = [...this.orders].sort((a, b) => a.id - b.id).map((o) => {
      const k = clamp(o.time / o.total, 0, 1);
      const pct = Math.round(k * 25) * 4;
      const col = k > 0.5 ? '#3ddc97' : k > 0.25 ? '#ffc93c' : '#ff5d73';
      return `<div class="pill" style="flex-direction:column;align-items:stretch;gap:3px;padding:5px 14px 7px;border:3px solid ${CUSTOMER_CSS[o.colorIndex]}">
        <div style="display:flex;gap:6px;align-items:center;justify-content:center">${recipeIcons(o.recipe)}<b>${t(`cook.r.${o.recipe}`)}</b></div>
        <div style="height:.5em;border-radius:.3em;background:#ece6f5;overflow:hidden"><div style="width:${pct}%;height:100%;background:${col}"></div></div></div>`;
    }).join('');
    const n = this.stars();
    const stars = [0, 1, 2].map((i) => `<span style="color:${i < n ? '#ffc93c' : '#d8d2e6'}">★</span>`).join('');
    return `<div class="pill"><b>${clock}</b></div>${cards}<div class="pill">${coin}<b>${this.coins}</b><span style="letter-spacing:-2px">${stars}</span></div>`;
  }

  /** Story campaign: orders the team served. */
  campaignStats() {
    return { served: this.servedCount, coins: this.coins, stars: this.stars() };
  }

  end() {
    for (const e of this.ents) { e.hl.visible = false; e.ring.visible = false; e.hint.style.display = 'none'; }
    for (const st of this.stations) if (st.label) st.label.style.display = 'none';
    const n = this.stars();
    const work = (e) => e.served * 3 + e.chopped + e.potted;
    const ranked = [...this.ents].sort((a, b) => work(b) - work(a));
    const top = ranked.length ? work(ranked[0]) : 0;
    const [a, b, c] = this.thresholds;
    this.confettiOrigin = new THREE.Vector3(0, 3, 0);
    this.finish({
      title: t(`cook.t${n}`),
      subtitle: t('cook.sub', { coins: this.coins, n: this.servedCount, a, b, c }),
      rows: ranked.map((e) => ({
        css: e.p.css, name: e.p.name, value: t('cook.served', { n: e.served }),
        detail: t('cook.detail', { c: e.chopped, k: e.potted }), crown: top > 0 && work(e) === top,
      })),
      stars: Math.max(1, n),
    });
  }

  update(dt) {
    this.updatePlayers(dt);
    this.updateCustomers(dt);
    for (const f of this.floats) {
      f.t += dt;
      f.pos.y += dt * 1.2;
      this.game.ui.place(f.el, f.pos, this.camera);
      f.el.style.opacity = String(clamp(2 - f.t * 1.4, 0, 1));
      if (f.t > 1.4) { f.el.remove(); f.done = true; }
    }
    this.floats = this.floats.filter((f) => !f.done);
    if (this.updateResults(dt)) return;
    this.updateStations(dt);

    if (this.state === 'play') {
      this.updateOrders(dt);
      this.timeLeft -= dt;
      const sec = Math.ceil(this.timeLeft);
      if (sec <= 5 && sec > 0 && sec !== this.lastBeep) { this.lastBeep = sec; this.game.audio.play('beep'); }
      if (sec === 10 && !this.hurry) { this.hurry = true; this.game.ui.toast(t('cook.ten')); }
      if (this.timeLeft <= 0) {
        this.timeLeft = 0;
        this.game.audio.play('go');
        this.end();
        return;
      }
    }
    if (this.state !== 'intro') this.game.ui.setTop(this.hud());
    this.game.ui.bar(this.players, (p) => {
      const e = this.ents.find((x) => x.p === p);
      return e ? t('cook.served', { n: e.served }) : '';
    });
  }
}
