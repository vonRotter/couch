import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { BaseScene } from '../core/scene.js';
import { Character, makeHat } from '../core/character.js';
import { COLORS, PLAYER_COLORS, toon, basic, sharedGeo } from '../core/palette.js';
import { addLights, skyTexture, makeTree, makeCloud, makeFlower, makeRock, makeBush, makeStar, makeMushroom, seeded } from '../core/world.js';
import { KEYBOARD_SCHEMES } from '../core/input.js';
import { hatName } from '../core/roster.js';
import { t } from '../core/i18n.js';
import { esc } from '../core/ui.js';
import { glyphMaterial } from '../core/edu.js';
import { makeGameIcon } from './hub-icons.js';

const ISLAND_R = 41;
const RING_R = 34;
const PAD_R = 2.6;
const PR = 0.42; // player radius
const SPEED = 7.5;
const GRAVITY = 32;
const JUMP = 11.5;

// Game pads sit in a ring along the shore; angle 0 is north, clockwise.
const PADS = [
  { key: 'platformer', color: 0x4cc9f0, css: '#1aa7d8' },
  { key: 'paint', color: 0xff8c42, css: '#f26b1d' },
  { key: 'brawl', color: 0xff5d73, css: '#f0364f' },
  { key: 'football', color: 0x58b947, css: '#3f9a32' },
  { key: 'hockey', color: 0x5ec8f2, css: '#1f9fd0' },
  { key: 'kart', color: 0x3ddc97, css: '#16b874' },
  { key: 'math', color: 0xff9f1c, css: '#e07f00', edu: true },
  { key: 'spelling', color: 0x2ec4b6, css: '#139e91', edu: true },
  { key: 'learnmix', color: 0x8ac926, css: '#6aa312', edu: true },
  { key: 'portal', color: 0x9b5de5, css: '#8a45e0' },
  { key: 'slalom', color: 0x6aa8ff, css: '#3d84e8' },
  { key: 'archers', color: 0xffc93c, css: '#e0a100' },
  { key: 'bubble', color: 0xff7eb6, css: '#ff4f9a' },
  { key: 'party', color: 0xb5179e, css: '#b5179e' },
  { key: 'space', color: 0x6a4fd8, css: '#5a3fd0' },
  { key: 'runner', color: 0xff7a5c, css: '#f2593a' },
  { key: 'cook', color: 0xff7a59, css: '#e85a35' },
  { key: 'hideseek', color: 0x7ad65a, css: '#3f9a32' },
  { key: 'snowball', color: 0xbfe3ff, css: '#3f8fd6' },
].map((p, i, all) => {
  const a = (i / all.length) * Math.PI * 2;
  return { ...p, angle: a, x: Math.sin(a) * RING_R, z: -Math.cos(a) * RING_R };
});

// The "settings corner": colors, hats, learning switch and language flag together.
const CORNER = { x: 0, z: 13 };
const POT_SPOTS = [-5, -3, -1, 1, 3, 5].map((x) => ({ x, z: CORNER.z - 3 }));
const SWAP_PADS = [{ x: -2.3, z: CORNER.z + 0.6 }, { x: 2.3, z: CORNER.z + 0.6 }];
const HAT_STAND = { x: 0, z: CORNER.z + 3.6 };
const EDU_SWITCH = { x: -6.8, z: CORNER.z + 1.5 };
const LANG_FLAG = { x: 6.8, z: CORNER.z + 1.5 };

// Playground toys.
const TRAMPOLINE = { x: -9.5, z: 2.5 };
const SWINGS = { x: 9.5, z: 2.5 };
const HOOP = { x: 8, z: -9 };
const PINS_AT = { x: -8, z: -9 };
const BALL_SPOTS = [[-3, 4.5, 0xff5d73], [3, 4.5, 0x4cc9f0], [-5, -5, 0xffc93c], [5, -5, 0x9b5de5]];

// Star spots: [x, z, height].
const STAR_SPOTS = [
  [14, -9, 3.7], [-14, -3, 5.6], [-9.5, 2.5, 7.0], [0, -6, 2.4],
  [0, -15, 0.8], [11, 10, 0.8], [-12, 10, 0.8], [17, 4, 0.8],
  [-17, -10, 0.8], [5, -17, 0.8], [-6, -17, 0.8], [17, -15, 0.8],
  [25, 6, 0.8], [-25, 4, 0.8], [21, -24, 0.8], [-20, -24, 0.8],
];

export class HubScene extends BaseScene {
  constructor(game, { fromGame = null } = {}) {
    super(game);
    this.key = null;
    this.camera.fov = 45;
    this.camera.far = 500;
    this.camera.updateProjectionMatrix();
    this.scene.background = skyTexture('#6fd0ff', '#d9f6ff');
    this.scene.fog = new THREE.Fog(0xbfeeff, 90, 190);
    this.lights = addLights(this.scene, { size: 50 });

    this.obstacles = [];
    this.entities = new Map();
    this.camTarget = new THREE.Vector3(0, 0, 2);
    this.camPos = new THREE.Vector3(0, 22, 30);
    this.launching = false;
    this.helpEl = null;
    this.eduOn = game.roster.progress.edu !== false;
    this.switchCd = 0;
    this.baskets = game.roster.progress.baskets || 0;

    this.buildIsland();
    this.buildPads();
    this.buildCorner();
    this.buildPlayground();
    this.buildNature();
    this.buildStars();

    const pad = PADS.find((d) => d.key === fromGame);
    for (const [i, p] of this.players.entries()) {
      const a = (i / Math.max(1, this.players.length)) * Math.PI * 2;
      const bx = pad ? pad.x * 0.78 : 0, bz = pad ? pad.z * 0.78 : 0;
      this.spawn(p, bx + Math.cos(a) * 1.4, bz + Math.sin(a) * 1.4);
    }

    this.titleEl = null;
    this.refreshTitle();
    game.audio.playMusic('hub');
  }

  // ---------- island ----------

  buildIsland() {
    const s = this.scene;
    const water = new THREE.Mesh(new THREE.CircleGeometry(220, 48), toon(COLORS.water));
    water.rotation.x = -Math.PI / 2;
    water.position.y = -0.7;
    water.receiveShadow = true;
    s.add(water);
    const sand = new THREE.Mesh(new THREE.CylinderGeometry(ISLAND_R + 2.2, ISLAND_R + 3.2, 1.2, 80), toon(COLORS.sand));
    sand.position.y = -0.75;
    sand.receiveShadow = true;
    s.add(sand);
    const grass = new THREE.Mesh(new THREE.CylinderGeometry(ISLAND_R, ISLAND_R + 0.6, 1, 80), toon(COLORS.grass));
    grass.position.y = -0.5;
    grass.receiveShadow = true;
    s.add(grass);
    const cliff = new THREE.Mesh(new THREE.CylinderGeometry(ISLAND_R + 3, ISLAND_R - 6, 5, 80), toon(COLORS.dirt));
    cliff.position.y = -3.8;
    s.add(cliff);
    this.foam = new THREE.Mesh(new THREE.TorusGeometry(ISLAND_R + 3.3, 0.3, 6, 100), toon(COLORS.white));
    this.foam.rotation.x = Math.PI / 2;
    this.foam.position.y = -0.62;
    s.add(this.foam);

    this.sparkles = [];
    const rand = seeded(9);
    for (let i = 0; i < 50; i++) {
      const m = new THREE.Mesh(sharedGeo('sparkle', () => new THREE.CircleGeometry(0.35, 6)), basic(0xffffff, { transparent: true, opacity: 0.7 }));
      m.rotation.x = -Math.PI / 2;
      const a = rand() * Math.PI * 2, r = ISLAND_R + 6 + rand() * 40;
      m.position.set(Math.cos(a) * r, -0.66, Math.sin(a) * r);
      m.userData.phase = rand() * 6;
      s.add(m);
      this.sparkles.push(m);
    }

    const plaza = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.7, 0.1, 36), toon(COLORS.sand));
    plaza.position.y = 0.01;
    plaza.receiveShadow = true;
    s.add(plaza);
    // A few stepping stones leading up to every pad.
    const stoneGeo = sharedGeo('stone', () => new THREE.CylinderGeometry(0.55, 0.6, 0.12, 10));
    for (const pad of PADS) {
      for (let r = RING_R - 9.6; r < RING_R - 3; r += 2.4) {
        const st = new THREE.Mesh(stoneGeo, toon(COLORS.sand));
        const wob = Math.sin(r * 1.7 + pad.angle * 3) * 0.35;
        st.position.set(Math.sin(pad.angle) * r + Math.cos(pad.angle) * wob, 0.02, -Math.cos(pad.angle) * r + Math.sin(pad.angle) * wob);
        st.receiveShadow = true;
        s.add(st);
      }
    }
  }

  buildPads() {
    const s = this.scene;
    for (const pad of PADS) {
      const g = new THREE.Group();
      g.position.set(pad.x, 0, pad.z);
      const base = new THREE.Mesh(sharedGeo('padBase', () => new THREE.CylinderGeometry(PAD_R, PAD_R + 0.2, 0.25, 40)), toon(COLORS.icing));
      base.position.y = 0.12;
      base.receiveShadow = true;
      const rim = new THREE.Mesh(sharedGeo('padRim', () => new THREE.TorusGeometry(PAD_R, 0.18, 8, 48)), toon(pad.color));
      rim.rotation.x = Math.PI / 2;
      rim.position.y = 0.26;
      const fill = new THREE.Mesh(sharedGeo('padFill', () => new THREE.CylinderGeometry(PAD_R - 0.1, PAD_R - 0.1, 0.05, 40)), toon(pad.color));
      fill.position.y = 0.27;
      fill.scale.set(0.001, 1, 0.001);
      g.add(base, rim, fill);
      // Floating icon on a little glowing stand.
      const icon = makeGameIcon(pad.key);
      icon.position.y = 3.3;
      g.add(icon);
      const glow = new THREE.Mesh(sharedGeo('iconGlow', () => new THREE.CircleGeometry(1.2, 28)), basic(pad.color, { transparent: true, opacity: 0.35 }));
      glow.rotation.x = -Math.PI / 2;
      glow.position.y = 0.3;
      g.add(glow);
      s.add(g);
      pad.group = g;
      pad.fill = fill;
      pad.icon = icon;
      pad.progress = 0;
      pad.label = this.game.ui.label('label');
      pad.label.style.color = pad.css;
      pad.labelPos = new THREE.Vector3(pad.x, 5.6, pad.z);
    }
  }

  // ---------- settings corner ----------

  buildCorner() {
    const s = this.scene;
    const rug = new THREE.Mesh(new THREE.CylinderGeometry(8.6, 8.8, 0.08, 40), toon(0xeee6ff));
    rug.scale.z = 0.62;
    rug.position.set(CORNER.x, 0.03, CORNER.z + 0.5);
    rug.receiveShadow = true;
    s.add(rug);

    // Paint pots: walk or jump into one to take that color.
    this.pots = POT_SPOTS.map((sp, i) => {
      const g = new THREE.Group();
      g.position.set(sp.x, 0, sp.z);
      const pot = new THREE.Mesh(sharedGeo('hubPot', () => new THREE.CylinderGeometry(0.5, 0.42, 0.7, 18)), toon(COLORS.icing));
      pot.position.y = 0.35;
      pot.castShadow = true;
      const paint = new THREE.Mesh(sharedGeo('hubPotPaint', () => new THREE.CylinderGeometry(0.46, 0.46, 0.08, 18)), toon(PLAYER_COLORS[i].hex));
      paint.position.y = 0.71;
      const drip = new THREE.Mesh(sharedGeo('hubPotDrip', () => new THREE.SphereGeometry(0.12, 8, 6)), toon(PLAYER_COLORS[i].hex));
      drip.position.set(0.45, 0.5, 0.15);
      drip.scale.set(0.7, 1.5, 0.7);
      g.add(pot, paint, drip);
      s.add(g);
      this.obstacles.push({ x: sp.x, z: sp.z, r: 0.55, top: 0.75, pot: i });
      const label = this.game.ui.label('label player-tag');
      label.style.color = PLAYER_COLORS[i].css;
      return { index: i, group: g, label, labelPos: new THREE.Vector3(sp.x, 1.5, sp.z), flash: 0 };
    });

    // Swap pads: one player on each, both tap B to trade colors.
    this.swapPads = SWAP_PADS.map((sp) => {
      const disc = new THREE.Mesh(sharedGeo('swapPad', () => new THREE.CylinderGeometry(0.95, 1.0, 0.14, 28)), toon(COLORS.icing));
      disc.position.set(sp.x, 0.08, sp.z);
      disc.receiveShadow = true;
      s.add(disc);
      return { ...sp, disc, who: null };
    });
    const arrows = new THREE.Group();
    arrows.position.set(0, 0.16, SWAP_PADS[0].z);
    for (const dir of [-1, 1]) {
      const head = new THREE.Mesh(sharedGeo('swapArrow', () => new THREE.ConeGeometry(0.18, 0.4, 3)), toon(0xffc93c));
      head.rotation.set(-Math.PI / 2, 0, (dir * Math.PI) / 2);
      head.position.set(dir * 0.35, 0, dir * 0.18);
      arrows.add(head);
    }
    s.add(arrows);
    this.swapLabel = this.game.ui.label('label');
    this.swapLabelPos = new THREE.Vector3(0, 1.6, SWAP_PADS[0].z);
    this.swapCd = 0;

    // Hat stand: walk into it to try the next unlocked hat.
    const stand = new THREE.Group();
    stand.position.set(HAT_STAND.x, 0, HAT_STAND.z);
    const pole = new THREE.Mesh(sharedGeo('hatPole', () => new THREE.CylinderGeometry(0.1, 0.12, 2.2, 10)), toon(COLORS.trunk));
    pole.position.y = 1.1;
    const foot = new THREE.Mesh(sharedGeo('hatFoot', () => new THREE.CylinderGeometry(0.6, 0.7, 0.18, 16)), toon(COLORS.trunk));
    foot.position.y = 0.09;
    const top = new THREE.Group();
    top.position.y = 2.3;
    [1, 5, 6].forEach((h, i) => {
      const hat = makeHat(h);
      const a = (i / 3) * Math.PI * 2;
      hat.position.set(Math.cos(a) * 0.45, 0, Math.sin(a) * 0.45);
      hat.scale.setScalar(1.3);
      top.add(hat);
    });
    pole.castShadow = true;
    stand.add(pole, foot, top);
    s.add(stand);
    this.hatTop = top;
    this.obstacles.push({ x: HAT_STAND.x, z: HAT_STAND.z, r: 0.6, hatStand: true });
    this.hatLabel = this.game.ui.label('label');
    this.hatLabel.style.color = '#8a45e0';
    this.hatLabelPos = new THREE.Vector3(HAT_STAND.x, 3.6, HAT_STAND.z);

    // Learning switch (book button) and language flag.
    const button = (pos, capColor) => {
      const g = new THREE.Group();
      g.position.set(pos.x, 0, pos.z);
      const base = new THREE.Mesh(sharedGeo('swBase', () => new THREE.CylinderGeometry(1.0, 1.15, 0.5, 24)), toon(COLORS.icing));
      base.position.y = 0.25;
      base.castShadow = base.receiveShadow = true;
      const cap = new THREE.Mesh(sharedGeo('swCap', () => new THREE.CylinderGeometry(0.75, 0.8, 0.3, 24)), toon(capColor));
      cap.position.y = 0.62;
      g.add(base, cap);
      s.add(g);
      return { g, cap };
    };
    const edu = button(EDU_SWITCH, 0x3ddc97);
    const book = new THREE.Mesh(sharedGeo('swBook', () => new RoundedBoxGeometry(0.9, 0.12, 0.65, 2, 0.04)), toon(COLORS.white));
    book.position.y = 0.82;
    edu.g.add(book);
    this.eduCap = edu.cap;
    this.obstacles.push({ x: EDU_SWITCH.x, z: EDU_SWITCH.z, r: 0.9, top: 0.8, toggle: true });
    this.eduLabel = this.game.ui.label('label');
    this.eduLabelPos = new THREE.Vector3(EDU_SWITCH.x, 2.2, EDU_SWITCH.z);

    const lang = button(LANG_FLAG, 0x4cc9f0);
    const flagPole = new THREE.Mesh(sharedGeo('langPole', () => new THREE.CylinderGeometry(0.06, 0.06, 2.2, 8)), toon(COLORS.white));
    flagPole.position.set(0.55, 1.8, 0);
    this.langCloth = new THREE.Mesh(sharedGeo('langCloth', () => new THREE.PlaneGeometry(1.25, 0.85)), toon(0x4cc9f0));
    this.langCloth.position.set(1.18, 2.5, -0.01);
    this.langFlag = new THREE.Mesh(sharedGeo('langFlag', () => new THREE.PlaneGeometry(1.2, 0.8)), glyphMaterial('EN'));
    this.langFlag.position.set(1.18, 2.5, 0);
    lang.g.add(flagPole, this.langCloth, this.langFlag);
    this.obstacles.push({ x: LANG_FLAG.x, z: LANG_FLAG.z, r: 0.9, top: 0.8, lang: true });
    this.langLabel = this.game.ui.label('label');
    this.langLabelPos = new THREE.Vector3(LANG_FLAG.x, 3.4, LANG_FLAG.z);
  }

  // ---------- playground ----------

  buildPlayground() {
    const s = this.scene;

    // Trampoline.
    const tr = new THREE.Group();
    tr.position.set(TRAMPOLINE.x, 0, TRAMPOLINE.z);
    const frame = new THREE.Mesh(sharedGeo('trFrame', () => new THREE.TorusGeometry(1.7, 0.16, 8, 32)), toon(0x4cc9f0));
    frame.rotation.x = Math.PI / 2;
    frame.position.y = 0.6;
    const mat = new THREE.Mesh(sharedGeo('trMat', () => new THREE.CylinderGeometry(1.6, 1.6, 0.06, 32)), toon(COLORS.ink));
    mat.position.y = 0.58;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const leg = new THREE.Mesh(sharedGeo('trLeg', () => new THREE.CylinderGeometry(0.07, 0.07, 0.6, 6)), toon(COLORS.rockDark));
      leg.position.set(Math.cos(a) * 1.6, 0.3, Math.sin(a) * 1.6);
      tr.add(leg);
    }
    frame.castShadow = true;
    tr.add(frame, mat);
    s.add(tr);
    this.trampoline = { mesh: mat, squish: 0 };
    this.obstacles.push({ x: TRAMPOLINE.x, z: TRAMPOLINE.z, r: 1.7, top: 0.62, bounce: 20, trampoline: true });

    // Swings.
    const sw = new THREE.Group();
    sw.position.set(SWINGS.x, 0, SWINGS.z);
    for (const sx of [-2.4, 2.4]) {
      for (const sz of [-0.9, 0.9]) {
        const post = new THREE.Mesh(sharedGeo('swPost', () => new THREE.CylinderGeometry(0.1, 0.12, 4.0, 8)), toon(0xff5d73));
        post.position.set(sx, 1.85, sz * 0.55);
        post.rotation.x = sz > 0 ? -0.22 : 0.22;
        post.castShadow = true;
        sw.add(post);
      }
      this.obstacles.push({ x: SWINGS.x + sx, z: SWINGS.z, r: 0.35 });
    }
    const bar = new THREE.Mesh(sharedGeo('swBar', () => new THREE.CylinderGeometry(0.1, 0.1, 5.0, 8)), toon(0xff5d73));
    bar.rotation.z = Math.PI / 2;
    bar.position.y = 3.75;
    sw.add(bar);
    s.add(sw);
    this.seats = [-1.1, 1.1].map((ox, i) => {
      const g = new THREE.Group();
      g.position.set(SWINGS.x + ox, 3.7, SWINGS.z);
      for (const rx of [-0.35, 0.35]) {
        const rope = new THREE.Mesh(sharedGeo('swRope', () => new THREE.CylinderGeometry(0.025, 0.025, 2.9, 5)), toon(COLORS.white));
        rope.position.set(rx, -1.45, 0);
        g.add(rope);
      }
      const seat = new THREE.Mesh(sharedGeo('swSeat', () => new RoundedBoxGeometry(0.9, 0.12, 0.5, 2, 0.05)), toon(i ? 0xffc93c : 0x3ddc97));
      seat.position.y = -2.9;
      seat.castShadow = true;
      g.add(seat);
      s.add(g);
      return { g, ox, theta: 0, omega: 0, rider: null, cd: 0, L: 2.9 };
    });

    // Basketball hoop.
    const hoop = new THREE.Group();
    hoop.position.set(HOOP.x, 0, HOOP.z);
    const hpole = new THREE.Mesh(sharedGeo('hoopPole', () => new THREE.CylinderGeometry(0.14, 0.16, 4.2, 10)), toon(COLORS.rockDark));
    hpole.position.set(0, 2.1, -1.3);
    const board = new THREE.Mesh(sharedGeo('hoopBoard', () => new RoundedBoxGeometry(2.0, 1.3, 0.12, 2, 0.05)), toon(COLORS.white));
    board.position.set(0, 3.9, -0.95);
    const square = new THREE.Mesh(sharedGeo('hoopSquare', () => new THREE.PlaneGeometry(0.7, 0.5)), toon(0xff5d73));
    square.position.set(0, 3.75, -0.88);
    const ring = new THREE.Mesh(sharedGeo('hoopRing', () => new THREE.TorusGeometry(0.62, 0.05, 8, 28)), toon(0xff8c42));
    ring.rotation.x = Math.PI / 2;
    ring.position.set(0, 3.3, -0.2);
    const net = new THREE.Mesh(sharedGeo('hoopNet', () => new THREE.CylinderGeometry(0.6, 0.38, 0.6, 14, 1, true)), toon(0xffffff, { transparent: true, opacity: 0.6 }));
    net.position.set(0, 2.98, -0.2);
    hpole.castShadow = board.castShadow = true;
    hoop.add(hpole, board, square, ring, net);
    s.add(hoop);
    this.hoop = { x: HOOP.x, z: HOOP.z - 0.2, y: 3.3, boardZ: HOOP.z - 0.89, ring };
    this.obstacles.push({ x: HOOP.x, z: HOOP.z - 1.3, r: 0.3 });
    this.hoopLabel = this.game.ui.label('label');
    this.hoopLabel.style.color = '#f26b1d';
    this.hoopLabelPos = new THREE.Vector3(HOOP.x, 5.3, HOOP.z - 1);

    // Bowling pins in a triangle with a short lane in front.
    const lane = new THREE.Mesh(new RoundedBoxGeometry(3, 0.06, 8, 2, 0.03), toon(0xffe0b0));
    lane.position.set(PINS_AT.x, 0.03, PINS_AT.z + 3);
    lane.receiveShadow = true;
    s.add(lane);
    const spots = [[0, 0.8], [-0.45, 0.1], [0.45, 0.1], [-0.9, -0.6], [0, -0.6], [0.9, -0.6]];
    this.pins = spots.map(([dx, dz]) => {
      const g = new THREE.Group();
      const body = new THREE.Mesh(sharedGeo('pinBody', () => new THREE.CapsuleGeometry(0.2, 0.5, 4, 12)), toon(COLORS.white));
      body.position.y = 0.45;
      const neck = new THREE.Mesh(sharedGeo('pinHead', () => new THREE.SphereGeometry(0.15, 12, 8)), toon(COLORS.white));
      neck.position.y = 0.92;
      const band = new THREE.Mesh(sharedGeo('pinBand', () => new THREE.TorusGeometry(0.17, 0.035, 6, 16)), toon(0xff5d73));
      band.rotation.x = Math.PI / 2;
      band.position.y = 0.72;
      body.castShadow = true;
      g.add(body, neck, band);
      const home = { x: PINS_AT.x + dx, z: PINS_AT.z + dz };
      g.position.set(home.x, 0, home.z);
      s.add(g);
      return { g, home, x: home.x, z: home.z, fallen: false, angle: 0, dirX: 0, dirZ: -1 };
    });
    this.pinState = { firstHit: null, lastHit: 0 };

    // Throwable balls (B to pick up, B to throw).
    this.toys = BALL_SPOTS.map(([x, z, color]) => {
      const m = new THREE.Group();
      const ball = new THREE.Mesh(sharedGeo('toyBall', () => new THREE.SphereGeometry(0.42, 18, 12)), toon(color));
      const stripe = new THREE.Mesh(sharedGeo('toyStripe', () => new THREE.TorusGeometry(0.42, 0.05, 6, 24)), toon(COLORS.white));
      ball.castShadow = true;
      m.add(ball, stripe);
      s.add(m);
      return { mesh: m, x, y: 0.42, z, vx: 0, vy: 0, vz: 0, r: 0.42, holder: null, thrower: null, flyT: 9, home: { x, z } };
    });

    // A big beach ball to kick around.
    const tex = (() => {
      const c = document.createElement('canvas');
      c.width = 256; c.height = 128;
      const g = c.getContext('2d');
      ['#ff5d73', '#ffffff', '#ffc93c', '#ffffff', '#4cc9f0', '#ffffff'].forEach((col, i) => { g.fillStyle = col; g.fillRect((i * 256) / 6, 0, 256 / 6 + 1, 128); });
      const tx = new THREE.CanvasTexture(c);
      tx.colorSpace = THREE.SRGBColorSpace;
      return tx;
    })();
    const big = new THREE.Mesh(new THREE.SphereGeometry(0.85, 24, 16), new THREE.MeshToonMaterial({ map: tex, gradientMap: toon(0xffffff).gradientMap }));
    big.castShadow = true;
    s.add(big);
    this.beachBall = { x: -1.5, z: -9, vx: 0, vz: 0, r: 0.85, mesh: big };

    // Stump staircase and a bouncy mushroom for stars.
    const stumpGeo = sharedGeo('stump', () => new THREE.CylinderGeometry(1, 1.1, 1, 16));
    [[14, -4.5, 0.9, 0.9], [15.5, -6.8, 1.8, 0.9], [14, -9, 2.7, 1.0]].forEach(([x, z, top, r]) => {
      const m = new THREE.Mesh(stumpGeo, toon(COLORS.trunk));
      m.scale.set(r, top, r);
      m.position.set(x, top / 2, z);
      m.castShadow = m.receiveShadow = true;
      const lid = new THREE.Mesh(sharedGeo('stumpLid', () => new THREE.CylinderGeometry(0.92, 0.92, 0.06, 16)), toon(COLORS.sand));
      lid.scale.set(r, 1, r);
      lid.position.set(x, top + 0.03, z);
      s.add(m, lid);
      this.obstacles.push({ x, z, r, top });
    });
    this.mushrooms = [];
    const mush = makeMushroom(0xff5d73);
    mush.position.set(-14, 0, -3);
    s.add(mush);
    const mo = { x: -14, z: -3, r: 0.9, top: 1.15, bounce: 17.5, mesh: mush, squish: 0 };
    this.obstacles.push(mo);
    this.mushrooms.push(mo);
  }

  buildNature() {
    const s = this.scene;
    const rand = seeded(42);
    const nearPath = (x, z, d) => PADS.some((p) => {
      // Distance to the radial stone path from the plaza to this pad.
      const ux = Math.sin(p.angle), uz = -Math.cos(p.angle);
      const along = x * ux + z * uz;
      if (along < 0 || along > RING_R) return false;
      return Math.abs(x * uz - z * ux) < d;
    });
    const clear = (x, z, d) =>
      PADS.every((p) => Math.hypot(p.x - x, p.z - z) > PAD_R + d + 1.5) &&
      STAR_SPOTS.every(([sx, sz]) => Math.hypot(sx - x, sz - z) > d + 1.6) &&
      this.obstacles.every((o) => Math.hypot(o.x - x, o.z - z) > o.r + d + 1.2) &&
      !nearPath(x, z, d + 1.2) && Math.hypot(x - CORNER.x, z - CORNER.z) > 9.5;
    let placed = 0;
    for (let i = 0; i < 1200 && placed < 44; i++) {
      const a = rand() * Math.PI * 2;
      const r = rand() < 0.3 ? 18 + rand() * 6 : RING_R + 2.5 + rand() * 3.5;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (!clear(x, z, 1.2)) continue;
      const tree = makeTree(rand, 1 + rand() * 0.6);
      tree.position.set(x, 0, z);
      s.add(tree);
      this.obstacles.push({ x, z, r: 0.5 });
      placed++;
    }
    for (let i = 0; i < 24; i++) {
      const a = rand() * Math.PI * 2, r = 15 + rand() * 24;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (!clear(x, z, 0.6)) continue;
      const b = rand() < 0.6 ? makeBush(rand, 1) : makeRock(rand, 0.55);
      b.position.set(x, b.isMesh ? 0.15 : 0, z);
      s.add(b);
    }
    for (let i = 0; i < 90; i++) {
      const a = rand() * Math.PI * 2, r = 4 + rand() * 35;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (Math.hypot(x - CORNER.x, z - CORNER.z) < 8) continue;
      const f = makeFlower(rand);
      f.position.set(x, 0, z);
      s.add(f);
    }
    this.clouds = [];
    for (let i = 0; i < 12; i++) {
      const c = makeCloud(rand, 1.6 + rand() * 1.6);
      c.position.set((rand() - 0.5) * 140, 18 + rand() * 12, -50 + (rand() - 0.5) * 70);
      c.userData.speed = 0.4 + rand() * 0.6;
      s.add(c);
      this.clouds.push(c);
    }
  }

  buildStars() {
    this.stars = STAR_SPOTS.map(([x, z, y]) => {
      const m = makeStar();
      m.position.set(x, y, z);
      m.visible = false;
      this.scene.add(m);
      return { x, y, z, mesh: m, active: false, timer: 0 };
    });
    const order = [...this.stars.keys()].sort(() => Math.random() - 0.5);
    order.slice(0, 7).forEach((i) => { this.stars[i].active = true; this.stars[i].mesh.visible = true; });
    this.stars.forEach((s) => { if (!s.active) s.timer = 4 + Math.random() * 10; });
  }

  // ---------- players ----------

  spawn(p, x, z) {
    const ch = new Character(p.color, { hat: p.hat });
    ch.group.position.set(x, 0, z);
    this.scene.add(ch.group);
    const tag = this.game.ui.label('label player-tag');
    tag.style.color = p.css;
    tag.textContent = p.deviceLabel;
    const e = {
      p, ch, x, y: 0, z, vx: 0, vy: 0, vz: 0, grounded: true, tag, tagPos: new THREE.Vector3(),
      bHold: 0, bAction: null, prevB: false, carry: null, charge: 0, riding: null, potCd: 0, hatCd: 0, bonkT: 0,
    };
    this.entities.set(p, e);
    this.puffs.burst(new THREE.Vector3(x, 0.6, z), 0xffffff, { count: 14, speed: 4, size: 0.4 });
    return e;
  }

  despawn(e) {
    if (e.carry) this.drop(e);
    if (e.riding) e.riding.rider = null;
    this.puffs.burst(new THREE.Vector3(e.x, 0.6, e.z), 0xffffff, { count: 14, speed: 4, size: 0.4 });
    this.scene.remove(e.ch.group);
    e.tag.remove();
    this.entities.delete(e.p);
    this.game.roster.leave(e.p);
    this.game.audio.play('leave');
  }

  handleJoins() {
    const roster = this.game.roster;
    for (const d of this.game.input.joinRequests()) {
      if (roster.has(d.id)) continue;
      const p = roster.join(d);
      if (!p) continue;
      const a = Math.random() * Math.PI * 2;
      this.spawn(p, Math.cos(a) * 1.6, Math.sin(a) * 1.6);
      this.game.audio.play('join');
      this.game.ui.toast(t('hub.joined', { name: p.name }));
    }
    if (this.game.input.escPressed) this.toggleHelp();
  }

  /** B: pick up / throw, toggle swap readiness, or hold to leave. */
  handleB(e, inp, dt) {
    if (inp.bPressed) {
      e.bAction = 'hold';
      if (e.carry) {
        e.bAction = 'throw';
        e.charge = 0;
      } else if (this.onSwapPad(e)) {
        e.bAction = 'swap';
        e.swapReady = !e.swapReady;
        this.game.audio.play(e.swapReady ? 'join' : 'select');
      } else {
        const toy = this.toys.find((b) => !b.holder && Math.hypot(b.x - e.x, b.z - e.z) < 1.6 && Math.abs(b.y - (e.y + 0.6)) < 1.6);
        if (toy) {
          e.bAction = 'pick';
          toy.holder = e;
          e.carry = toy;
          e.ch.squash(1.2);
          this.game.audio.play('select');
        }
      }
    }
    if (inp.b) {
      if (e.bAction === 'throw') e.charge += dt;
      if (e.bAction === 'hold') {
        e.bHold += dt;
        if (e.bHold > 1.3) { this.despawn(e); this.refreshTitle(); return true; }
      }
    } else {
      if (e.prevB && e.bAction === 'throw') this.throwToy(e);
      e.bHold = 0;
      e.bAction = null;
    }
    e.prevB = inp.b;
    e.ch.group.scale.setScalar(1 - Math.min(0.4, Math.max(0, e.bHold - 0.35) * 0.4));
    return false;
  }

  throwToy(e) {
    const b = e.carry;
    if (!b) return;
    const k = Math.min(1, e.charge);
    const yaw = e.ch.yaw;
    const power = 7 + k * 11;
    b.vx = Math.sin(yaw) * power + e.vx * 0.4;
    b.vz = Math.cos(yaw) * power + e.vz * 0.4;
    b.vy = 4.5 + k * 4;
    // Hoop assist: a throw roughly toward the hoop arcs toward the ring.
    const H = this.hoop;
    const hx = H.x - e.x, hz = H.z - e.z, hd = Math.hypot(hx, hz);
    if (hd > 1.2 && hd < 9 && (Math.sin(yaw) * hx + Math.cos(yaw) * hz) / hd > 0.75) {
      const T = 0.55 + hd * 0.06;
      const tx = H.x + (Math.random() - 0.5) * 0.7, tz = H.z + (Math.random() - 0.5) * 0.7;
      b.vx = (tx - b.x) / T;
      b.vz = (tz - b.z) / T;
      b.vy = (H.y - b.y + 11 * T * T) / T;
    }
    b.holder = null;
    b.thrower = e;
    b.flyT = 0;
    e.carry = null;
    e.ch.squash(0.8);
    this.game.audio.play('dash');
  }

  drop(e) {
    const b = e.carry;
    if (!b) return;
    b.holder = null;
    b.vx = b.vz = 0;
    b.vy = 1;
    e.carry = null;
  }

  updatePlayer(e, dt) {
    const inp = this.input(e.p);
    if (!inp) return;
    const audio = this.game.audio;
    e.potCd -= dt; e.hatCd -= dt; e.bonkT -= dt;
    if (this.handleB(e, inp, dt)) return;

    if (e.riding) {
      this.updateRider(e, inp);
      return;
    }

    const tx = inp.x * SPEED, tz = -inp.y * SPEED;
    const acc = (e.grounded ? 50 : 26) * dt;
    e.vx += THREE.MathUtils.clamp(tx - e.vx, -acc, acc);
    e.vz += THREE.MathUtils.clamp(tz - e.vz, -acc, acc);
    if (inp.aPressed && e.grounded) {
      e.vy = JUMP;
      e.grounded = false;
      e.ch.squash(1.3);
      audio.play('jump');
    }

    e.x += e.vx * dt;
    e.z += e.vz * dt;
    for (const o of this.obstacles) {
      const dx = e.x - o.x, dz = e.z - o.z;
      const d = Math.hypot(dx, dz);
      const min = o.r + PR;
      if (d < min && (o.top === undefined || e.y < o.top - 0.3)) {
        const nx = d > 1e-4 ? dx / d : 1, nz = d > 1e-4 ? dz / d : 0;
        e.x = o.x + nx * min;
        e.z = o.z + nz * min;
        const vn = e.vx * nx + e.vz * nz;
        if (vn < 0) { e.vx -= vn * nx; e.vz -= vn * nz; }
        if (o.pot !== undefined) this.touchPot(e, o.pot);
        if (o.hatStand) this.touchHatStand(e);
      }
    }
    const rr = Math.hypot(e.x, e.z);
    if (rr > ISLAND_R - 0.6) { e.x *= (ISLAND_R - 0.6) / rr; e.z *= (ISLAND_R - 0.6) / rr; }

    e.vy -= GRAVITY * dt;
    const prevY = e.y;
    e.y += e.vy * dt;
    let floor = 0, floorObj = null;
    for (const o of this.obstacles) {
      if (o.top === undefined) continue;
      if (Math.hypot(e.x - o.x, e.z - o.z) < o.r + PR * 0.3 && prevY >= o.top - 0.35 && o.top > floor) {
        floor = o.top;
        floorObj = o;
      }
    }
    const wasGrounded = e.grounded;
    if (e.y <= floor) {
      e.y = floor;
      if (floorObj?.bounce && e.vy < 0) {
        e.vy = floorObj.bounce;
        if (floorObj.trampoline) this.trampoline.squish = 1;
        else floorObj.squish = 1;
        e.ch.squash(1.4);
        e.grounded = false;
        audio.play('boing');
      } else {
        if (!wasGrounded && e.vy < -4) { e.ch.squash(0.7); audio.play('land'); }
        if (!wasGrounded && floorObj?.toggle && this.switchCd <= 0) { this.toggleEdu(); this.switchCd = 0.6; }
        if (!wasGrounded && floorObj?.lang && this.switchCd <= 0) { this.game.toggleLanguage(); this.switchCd = 0.6; }
        if (!wasGrounded && floorObj?.pot !== undefined) this.touchPot(e, floorObj.pot);
        e.vy = 0;
        e.grounded = true;
      }
    } else {
      e.grounded = false;
    }

    // Hop onto a free swing seat.
    for (const seat of this.seats) {
      if (seat.rider || seat.cd > 0) continue;
      const p = this.seatPos(seat);
      if (Math.hypot(e.x - p.x, e.z - p.z) < 0.75 && Math.abs(e.y - (p.y - 0.25)) < 1.1) {
        seat.rider = e;
        e.riding = seat;
        if (seat.omega === 0) seat.omega = 0.8;
        audio.play('select');
        break;
      }
    }

    const sp = Math.hypot(e.vx, e.vz);
    e.ch.face(e.vx, e.vz);
    e.ch.spin = e.bonkT > 0 ? e.bonkT * 14 : 0;
    e.ch.group.position.set(e.x, e.y, e.z);
    e.ch.update(dt, { moving: Math.min(1, sp / SPEED), grounded: e.grounded, vy: e.vy });
  }

  seatPos(seat) {
    return {
      x: SWINGS.x + seat.ox,
      y: 3.7 - seat.L * Math.cos(seat.theta),
      z: SWINGS.z + seat.L * Math.sin(seat.theta),
    };
  }

  updateRider(e, inp) {
    const seat = e.riding;
    const p = this.seatPos(seat);
    e.x = p.x; e.y = p.y - 0.15; e.z = p.z;
    e.vx = e.vz = e.vy = 0;
    if (inp.aPressed) {
      // Let go at the top of the swing for a big launch.
      const v = seat.omega * seat.L;
      e.vz = Math.cos(seat.theta) * v;
      e.vy = Math.sin(seat.theta) * v + 6;
      e.vx = inp.x * 3;
      e.grounded = false;
      e.riding = null;
      seat.rider = null;
      seat.cd = 1;
      e.ch.squash(1.3);
      this.game.audio.play('jump');
    }
    e.ch.targetYaw = 0;
    e.ch.group.position.set(e.x, e.y, e.z);
    e.ch.update(1 / 60, { moving: 0, grounded: true });
  }

  updateSwings(dt) {
    for (const seat of this.seats) {
      seat.cd -= dt;
      const g = 9.8, L = seat.L;
      seat.omega += (-g / L) * Math.sin(seat.theta) * dt;
      seat.omega *= Math.max(0, 1 - (seat.rider ? 0.05 : 0.5) * dt);
      if (seat.rider) {
        // Pump: add energy until the swing reaches a happy height.
        const energy = 0.5 * L * seat.omega * seat.omega + g * (1 - Math.cos(seat.theta));
        if (energy < g * (1 - Math.cos(1.05))) seat.omega += Math.sign(seat.omega || 1) * 1.6 * dt;
      }
      seat.theta += seat.omega * dt;
      if (Math.abs(seat.omega) < 0.02 && Math.abs(seat.theta) < 0.02 && !seat.rider) { seat.omega = 0; seat.theta = 0; }
      seat.g.rotation.x = -seat.theta;
    }
  }

  separatePlayers() {
    const list = [...this.entities.values()].filter((e) => !e.riding);
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i], b = list[j];
        if (Math.abs(a.y - b.y) > 1) continue;
        const dx = b.x - a.x, dz = b.z - a.z;
        const d = Math.hypot(dx, dz);
        if (d < PR * 2 && d > 1e-4) {
          const push = (PR * 2 - d) / 2;
          a.x -= (dx / d) * push; a.z -= (dz / d) * push;
          b.x += (dx / d) * push; b.z += (dz / d) * push;
        }
      }
    }
  }

  // ---------- toys ----------

  floorAt(x, z, bottom) {
    let floor = 0, obj = null;
    for (const o of this.obstacles) {
      if (o.top === undefined) continue;
      if (Math.hypot(x - o.x, z - o.z) < o.r && bottom >= o.top - 0.3 && o.top > floor) { floor = o.top; obj = o; }
    }
    return { floor, obj };
  }

  updateToys(dt) {
    for (const b of this.toys) {
      if (b.holder) {
        const h = b.holder;
        const pulse = h.bAction === 'throw' ? 1 + Math.min(1, h.charge) * 0.25 + Math.sin(this.time * 30) * 0.03 * Math.min(1, h.charge * 3) : 1;
        b.x = h.x; b.y = h.y + 1.85; b.z = h.z;
        b.mesh.position.set(b.x, b.y, b.z);
        b.mesh.scale.setScalar(pulse);
        continue;
      }
      b.mesh.scale.setScalar(1);
      b.flyT += dt;
      const prevY = b.y;
      b.vy -= 22 * dt;
      b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
      const { floor, obj } = this.floorAt(b.x, b.z, prevY - b.r);
      if (b.y - b.r < floor) {
        b.y = floor + b.r;
        if (obj?.bounce) {
          b.vy = 14;
          this.trampoline.squish = obj.trampoline ? 1 : this.trampoline.squish;
          this.game.audio.play('boing');
        } else if (b.vy < -2.5) {
          b.vy = -b.vy * 0.55;
          if (b.vy > 3) this.game.audio.play('land');
        } else {
          b.vy = 0;
        }
        const f = Math.max(0, 1 - 2.2 * dt);
        b.vx *= f; b.vz *= f;
      }
      for (const o of this.obstacles) {
        if (o.top !== undefined && b.y - b.r >= o.top - 0.1) continue;
        const dx = b.x - o.x, dz = b.z - o.z;
        const d = Math.hypot(dx, dz);
        if (d < o.r + b.r && d > 1e-4) {
          const nx = dx / d, nz = dz / d;
          b.x = o.x + nx * (o.r + b.r); b.z = o.z + nz * (o.r + b.r);
          const vn = b.vx * nx + b.vz * nz;
          if (vn < 0) { b.vx -= 1.7 * vn * nx; b.vz -= 1.7 * vn * nz; }
        }
      }
      const rr = Math.hypot(b.x, b.z);
      if (rr > ISLAND_R - b.r) {
        const nx = b.x / rr, nz = b.z / rr;
        b.x = nx * (ISLAND_R - b.r); b.z = nz * (ISLAND_R - b.r);
        const vn = b.vx * nx + b.vz * nz;
        if (vn > 0) { b.vx -= 1.7 * vn * nx; b.vz -= 1.7 * vn * nz; }
      }
      this.checkHoop(b, prevY);
      this.checkPins(b);
      // Bonk a friend (just for laughs).
      const speed = Math.hypot(b.vx, b.vy, b.vz);
      if (speed > 6) {
        for (const e of this.entities.values()) {
          if (e.riding || (e === b.thrower && b.flyT < 0.5)) continue;
          if (Math.hypot(e.x - b.x, e.z - b.z) < PR + b.r && b.y > e.y && b.y < e.y + 1.4) {
            const dx = e.x - b.x, dz = e.z - b.z, d = Math.hypot(dx, dz) || 1;
            e.vx += (dx / d) * 5; e.vz += (dz / d) * 5; e.vy = Math.max(e.vy, 6); e.grounded = false;
            e.bonkT = 0.5;
            e.ch.squash(0.6);
            b.vx *= -0.35; b.vz *= -0.35; b.vy = 3;
            this.game.audio.play('boing');
            this.puffs.burst(new THREE.Vector3(b.x, b.y, b.z), 0xffffff, { count: 8, size: 0.3, life: 0.4 });
          }
        }
      }
      b.mesh.position.set(b.x, b.y, b.z);
      const hs = Math.hypot(b.vx, b.vz);
      if (hs > 0.05) b.mesh.rotateOnWorldAxis(new THREE.Vector3(b.vz, 0, -b.vx).normalize(), (hs * dt) / b.r);
    }
  }

  checkHoop(b, prevY) {
    const H = this.hoop;
    const d = Math.hypot(b.x - H.x, b.z - H.z);
    if (prevY > H.y && b.y <= H.y && b.vy < 0) {
      if (d < 0.45) {
        this.baskets++;
        this.game.roster.progress.baskets = this.baskets;
        this.game.roster.save();
        b.vx *= 0.3; b.vz *= 0.3;
        this.game.audio.play('star');
        this.confetti.burst(new THREE.Vector3(H.x, H.y, H.z), 0, { count: 36, speed: 6, colors: PLAYER_COLORS.map((c) => c.hex).concat(COLORS.gold) });
        this.game.ui.toast(t('hub.basket', { n: this.baskets }));
      } else if (d < 0.85) {
        b.vy = -b.vy * 0.45;
        const nx = (b.x - H.x) / (d || 1), nz = (b.z - H.z) / (d || 1);
        b.vx += nx * 2; b.vz += nz * 2;
        this.game.audio.play('bump');
      }
    }
    // Backboard.
    if (b.z - b.r < H.boardZ && b.z > H.boardZ - 0.6 && Math.abs(b.x - H.x) < 1.0 && b.y > H.y - 0.4 && b.y < H.y + 1.3 && b.vz < 0) {
      b.z = H.boardZ + b.r;
      b.vz = -b.vz * 0.6;
      this.game.audio.play('bump');
    }
  }

  knockPin(pin, dirX, dirZ) {
    if (pin.fallen) return;
    const d = Math.hypot(dirX, dirZ) || 1;
    pin.fallen = true;
    pin.dirX = dirX / d + (Math.random() - 0.5) * 0.6;
    pin.dirZ = dirZ / d + (Math.random() - 0.5) * 0.6;
    pin.slide = 0.6;
    const st = this.pinState;
    if (st.firstHit === null) st.firstHit = this.time;
    st.lastHit = this.time;
    this.game.audio.play('bump');
    // Falling pins knock their neighbors.
    for (const other of this.pins) {
      if (other.fallen || Math.hypot(other.x - pin.x, other.z - pin.z) > 1.0) continue;
      if (Math.random() < 0.75) this.later(0.12, () => this.knockPin(other, pin.dirX, pin.dirZ));
    }
  }

  checkPins(b) {
    const speed = Math.hypot(b.vx, b.vz);
    if (speed < 2 || b.y > 1.5) return;
    for (const pin of this.pins) {
      if (!pin.fallen && Math.hypot(pin.x - b.x, pin.z - b.z) < 0.6) this.knockPin(pin, b.vx, b.vz);
    }
  }

  updatePins(dt) {
    for (const pin of this.pins) {
      if (pin.fallen) {
        pin.angle = Math.min(Math.PI / 2, pin.angle + dt * 6);
        if (pin.slide > 0) {
          const s = Math.min(pin.slide, dt * 3);
          pin.slide -= s;
          pin.x += pin.dirX * s; pin.z += pin.dirZ * s;
        }
        const axis = new THREE.Vector3(pin.dirZ, 0, -pin.dirX).normalize();
        pin.g.quaternion.setFromAxisAngle(axis, pin.angle);
      } else {
        for (const e of this.entities.values()) {
          if (Math.hypot(e.x - pin.x, e.z - pin.z) < 0.6 && e.y < 1 && Math.hypot(e.vx, e.vz) > 3) this.knockPin(pin, e.vx, e.vz);
        }
      }
      pin.g.position.set(pin.x, 0, pin.z);
    }
    const st = this.pinState;
    if (st.firstHit === null) return;
    const down = this.pins.filter((p) => p.fallen).length;
    if (down === this.pins.length && !st.announced) {
      st.announced = true;
      const strike = this.time - st.firstHit < 3;
      this.game.ui.toast(strike ? t('hub.strike') : t('hub.pins', { n: down }));
      if (strike) {
        this.game.audio.play('fanfare');
        this.confetti.burst(new THREE.Vector3(PINS_AT.x, 1.5, PINS_AT.z), 0, { count: 40, speed: 7, colors: PLAYER_COLORS.map((c) => c.hex) });
      }
    }
    if ((down === this.pins.length && this.time - st.lastHit > 3) || this.time - st.lastHit > 7) {
      if (!st.announced && down > 0) this.game.ui.toast(t('hub.pins', { n: down }));
      for (const pin of this.pins) {
        pin.fallen = false; pin.angle = 0; pin.x = pin.home.x; pin.z = pin.home.z;
        pin.g.quaternion.identity();
      }
      this.puffs.burst(new THREE.Vector3(PINS_AT.x, 0.6, PINS_AT.z), 0xffffff, { count: 14, size: 0.4 });
      this.pinState = { firstHit: null, lastHit: 0 };
    }
  }

  updateBeachBall(dt) {
    const b = this.beachBall;
    for (const e of this.entities.values()) {
      const dx = b.x - e.x, dz = b.z - e.z;
      const d = Math.hypot(dx, dz);
      if (d < b.r + PR && e.y < 1.4 && d > 1e-4) {
        const nx = dx / d, nz = dz / d;
        b.x = e.x + nx * (b.r + PR);
        b.z = e.z + nz * (b.r + PR);
        const kick = Math.max(3, (e.vx * nx + e.vz * nz) * 1.4 + 2);
        b.vx = nx * kick + e.vx * 0.3;
        b.vz = nz * kick + e.vz * 0.3;
        if (kick > 6) this.game.audio.play('bump');
      }
    }
    b.x += b.vx * dt;
    b.z += b.vz * dt;
    const f = Math.max(0, 1 - 0.9 * dt);
    b.vx *= f; b.vz *= f;
    for (const o of this.obstacles) {
      const dx = b.x - o.x, dz = b.z - o.z;
      const d = Math.hypot(dx, dz);
      if (d < o.r + b.r && d > 1e-4) {
        const nx = dx / d, nz = dz / d;
        b.x = o.x + nx * (o.r + b.r);
        b.z = o.z + nz * (o.r + b.r);
        const vn = b.vx * nx + b.vz * nz;
        if (vn < 0) { b.vx -= 1.8 * vn * nx; b.vz -= 1.8 * vn * nz; }
      }
    }
    for (const pin of this.pins) {
      if (!pin.fallen && Math.hypot(pin.x - b.x, pin.z - b.z) < b.r + 0.25 && Math.hypot(b.vx, b.vz) > 2) this.knockPin(pin, b.vx, b.vz);
    }
    const rr = Math.hypot(b.x, b.z);
    if (rr > ISLAND_R - b.r) {
      const nx = b.x / rr, nz = b.z / rr;
      b.x = nx * (ISLAND_R - b.r); b.z = nz * (ISLAND_R - b.r);
      const vn = b.vx * nx + b.vz * nz;
      if (vn > 0) { b.vx -= 1.8 * vn * nx; b.vz -= 1.8 * vn * nz; }
    }
    const sp = Math.hypot(b.vx, b.vz);
    b.mesh.position.set(b.x, b.r, b.z);
    if (sp > 0.01) b.mesh.rotateOnWorldAxis(new THREE.Vector3(b.vz, 0, -b.vx).normalize(), (sp * dt) / b.r);
  }

  // ---------- corner interactions ----------

  touchPot(e, index) {
    if (e.potCd > 0 || e.p.colorIndex === index) return;
    e.potCd = 1;
    if (this.game.roster.setColor(e.p, index)) {
      this.recolor(e);
      this.game.audio.play('join');
      this.game.ui.toast(t('hub.newColor', { name: e.p.name }));
      this.confetti.burst(new THREE.Vector3(e.x, 1, e.z), e.p.color, { count: 16, speed: 5 });
    } else {
      this.pots[index].flash = 1.5;
      this.game.audio.play('bump');
    }
  }

  touchHatStand(e) {
    if (e.hatCd > 0) return;
    e.hatCd = 0.9;
    const h = this.game.roster.cycleHat(e.p);
    e.ch.setHat(h);
    e.ch.squash(1.25);
    this.game.audio.play('select');
    this.game.ui.toast(hatName(h), 1200);
  }

  /** Rebuild a player's character after a color change. */
  recolor(e) {
    const pos = e.ch.group.position.clone();
    const yaw = e.ch.yaw;
    this.scene.remove(e.ch.group);
    e.ch = new Character(e.p.color, { hat: e.p.hat });
    e.ch.group.position.copy(pos);
    e.ch.yaw = e.ch.targetYaw = yaw;
    e.ch.squash(1.3);
    this.scene.add(e.ch.group);
  }

  onSwapPad(e) {
    return this.swapPads.find((sp) => Math.hypot(e.x - sp.x, e.z - sp.z) < 1.0 && e.y < 0.6) || null;
  }

  toggleEdu() {
    const roster = this.game.roster;
    this.eduOn = !this.eduOn;
    roster.progress.edu = this.eduOn;
    roster.save();
    this.game.audio.play(this.eduOn ? 'join' : 'leave');
    this.game.ui.toast(this.eduOn ? t('hub.eduOn') : t('hub.eduOff'));
    this.confetti.burst(new THREE.Vector3(EDU_SWITCH.x, 1.2, EDU_SWITCH.z), 0, { count: 18, speed: 5, colors: [0x3ddc97, 0xffc93c, 0xffffff] });
  }

  updateCorner(dt) {
    this.switchCd -= dt;
    this.swapCd -= dt;
    if (this.game.input.pressed.has('KeyG')) this.toggleEdu();
    const ents = [...this.entities.values()];

    // Pot labels: only the pot nearest to each player.
    const nearest = new Set();
    for (const e of ents) {
      let best = null, bestD = 2.2;
      for (const pot of this.pots) {
        const d = Math.hypot(e.x - pot.group.position.x, e.z - pot.group.position.z);
        if (d < bestD) { bestD = d; best = pot; }
      }
      if (best) nearest.add(best);
    }
    for (const pot of this.pots) {
      pot.flash -= dt;
      const show = nearest.has(pot) || pot.flash > 0;
      const owner = this.game.roster.colorOwner(pot.index);
      pot.label.style.display = show ? '' : 'none';
      const text = owner ? `${t(`color.${pot.index}`)} · ${t('hub.taken')}` : t(`color.${pot.index}`);
      if (pot.label.textContent !== text) pot.label.textContent = text;
      if (show) this.game.ui.place(pot.label, pot.labelPos, this.camera);
      pot.group.scale.setScalar(pot.flash > 0 ? 1 + Math.sin(pot.flash * 20) * 0.06 : 1);
    }

    // Swap pads.
    for (const sp of this.swapPads) {
      const who = ents.find((e) => Math.hypot(e.x - sp.x, e.z - sp.z) < 1.0 && e.y < 0.6) || null;
      if (sp.who && sp.who !== who) sp.who.swapReady = false;
      sp.who = who;
      sp.disc.material = toon(who ? (who.swapReady ? 0x3ddc97 : who.p.color) : COLORS.icing);
    }
    const [a, b] = this.swapPads.map((sp) => sp.who);
    const both = a && b && a !== b;
    if (both && a.swapReady && b.swapReady && this.swapCd <= 0) {
      this.swapCd = 1.5;
      this.game.roster.swapColors(a.p, b.p);
      a.swapReady = b.swapReady = false;
      this.recolor(a);
      this.recolor(b);
      this.game.audio.play('fanfare');
      this.game.ui.toast(t('hub.swapped', { a: a.p.name, b: b.p.name }), 2200);
      this.confetti.burst(new THREE.Vector3(0, 1.2, SWAP_PADS[0].z), 0, { count: 30, speed: 6, colors: [a.p.color, b.p.color, COLORS.white] });
    }
    const swapHtml = `${t('hub.swapTitle')}<small>${both ? t('hub.swapReady') : t('hub.swapHint')}</small>`;
    if (this.swapLabel.innerHTML !== swapHtml) this.swapLabel.innerHTML = swapHtml;
    this.swapLabel.style.color = both ? '#16b874' : '#8a45e0';
    this.game.ui.place(this.swapLabel, this.swapLabelPos, this.camera);

    // Hat stand, learning switch, language flag.
    this.hatTop.rotation.y += dt * 0.8;
    const hatHtml = `${t('hub.hatStand')}<small>${t('hub.hatHint')}</small>`;
    if (this.hatLabel.innerHTML !== hatHtml) this.hatLabel.innerHTML = hatHtml;
    this.game.ui.place(this.hatLabel, this.hatLabelPos, this.camera);

    this.eduCap.material = toon(this.eduOn ? 0x3ddc97 : 0xbdb8cf);
    const eduHtml = `<span class="edu-badge small">${t('badge.edu')}</span>${this.eduOn ? t('hub.on') : t('hub.off')}<small>${t('hub.jumpButton')}</small>`;
    if (this.eduLabel.innerHTML !== eduHtml) this.eduLabel.innerHTML = eduHtml;
    this.eduLabel.style.color = this.eduOn ? '#16b874' : '#9a94b2';
    this.game.ui.place(this.eduLabel, this.eduLabelPos, this.camera);

    const no = t('lang.name') === 'Norsk';
    this.langFlag.material = glyphMaterial(no ? 'NO' : 'EN');
    this.langCloth.material = toon(no ? 0xff5d73 : 0x4cc9f0);
    this.langFlag.rotation.y = this.langCloth.rotation.y = Math.sin(this.time * 2) * 0.15;
    const langHtml = `${t('hub.langSign')}<small>${t('hub.jumpFlag')}</small>`;
    if (this.langLabel.innerHTML !== langHtml) this.langLabel.innerHTML = langHtml;
    this.langLabel.style.color = no ? '#f0364f' : '#1aa7d8';
    this.game.ui.place(this.langLabel, this.langLabelPos, this.camera);

    const hoopHtml = t('hub.baskets', { n: this.baskets });
    if (this.hoopLabel.textContent !== hoopHtml) this.hoopLabel.textContent = hoopHtml;
    this.game.ui.place(this.hoopLabel, this.hoopLabelPos, this.camera);
  }

  // ---------- stars, pads, camera ----------

  updateStars(dt) {
    const roster = this.game.roster;
    for (const s of this.stars) {
      if (!s.active) {
        s.timer -= dt;
        if (s.timer <= 0) {
          s.active = true;
          s.mesh.visible = true;
          s.mesh.scale.setScalar(0.01);
        }
        continue;
      }
      s.mesh.rotation.y += dt * 2.5;
      s.mesh.position.y = s.y + Math.sin(this.time * 3 + s.x) * 0.15;
      s.mesh.scale.lerp(new THREE.Vector3(1, 1, 1), Math.min(1, dt * 6));
      for (const e of this.entities.values()) {
        if (Math.hypot(e.x - s.x, e.z - s.z) < 0.95 && Math.abs(e.y + 0.6 - s.y) < 1.1) {
          s.active = false;
          s.mesh.visible = false;
          s.timer = 12 + Math.random() * 10;
          const before = roster.unlockedHats().length;
          roster.addStars(1);
          this.game.audio.play('star');
          this.confetti.burst(s.mesh.position, 0, { count: 26, speed: 6, colors: PLAYER_COLORS.map((c) => c.hex).concat(COLORS.gold) });
          e.ch.squash(1.3);
          if (roster.unlockedHats().length > before) {
            this.game.ui.toast(t('hub.newHat', { hat: hatName(roster.unlockedHats().at(-1)) }), 2600);
            this.game.audio.play('fanfare');
          }
          break;
        }
      }
    }
  }

  updatePads(dt) {
    const n = this.entities.size;
    const need = Math.max(1, Math.ceil(n / 2));
    for (const pad of PADS) {
      const hidden = pad.edu && !this.eduOn;
      pad.group.visible = !hidden;
      if (hidden) {
        pad.progress = 0;
        pad.label.style.display = 'none';
        continue;
      }
      let on = 0;
      for (const e of this.entities.values()) {
        if (Math.hypot(e.x - pad.x, e.z - pad.z) < PAD_R && e.y < 2 && !e.riding) on++;
      }
      const ready = n > 0 && on >= need;
      pad.progress = THREE.MathUtils.clamp(pad.progress + (ready ? dt / 1.8 : -dt * 1.5), 0, 1);
      const k = Math.max(0.001, pad.progress);
      pad.fill.scale.set(k, 1, k);
      pad.icon.rotation.y += dt * (0.8 + pad.progress * 6);
      pad.icon.position.y = 3.3 + Math.sin(this.time * 1.8 + pad.angle * 3) * 0.2 + pad.progress * 0.6;
      const sub = n === 0 ? t('hub.padJoin') : on > 0 ? t('hub.padReady', { on, need }) : t('hub.padNeed', { need });
      const html = `${pad.edu ? `<span class="edu-badge small">${t('badge.edu')}</span>` : ''}${esc(t(`game.${pad.key}`))}<small>${esc(sub)}</small>`;
      if (pad.label.innerHTML !== html) pad.label.innerHTML = html;
      this.game.ui.place(pad.label, pad.labelPos, this.camera);
      if (pad.progress >= 1 && !this.launching) {
        this.launching = true;
        this.game.startGame(pad.key);
      }
    }
  }

  updateCamera(dt) {
    const list = [...this.entities.values()];
    const target = new THREE.Vector3();
    let spread = 0;
    if (list.length) {
      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
      for (const e of list) {
        minX = Math.min(minX, e.x); maxX = Math.max(maxX, e.x);
        minZ = Math.min(minZ, e.z); maxZ = Math.max(maxZ, e.z);
      }
      target.set((minX + maxX) / 2, 0, (minZ + maxZ) / 2);
      spread = Math.max(maxX - minX, (maxZ - minZ) * 1.4);
    } else {
      target.set(Math.sin(this.time * 0.1) * 5, 0, -2);
      spread = 40;
    }
    const zoom = THREE.MathUtils.clamp(0.8 + spread / 22, 0.8, 2.7);
    const k = Math.min(1, dt * 3);
    this.camTarget.lerp(target, k);
    this.camPos.lerp(new THREE.Vector3(this.camTarget.x, 13 * zoom, this.camTarget.z + 13 * zoom), k);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camTarget.x, 0.6, this.camTarget.z);
    const sun = this.lights.sun;
    sun.position.set(this.camTarget.x - 20, 40, this.camTarget.z + 24);
    sun.target.position.copy(this.camTarget);
  }

  animateWorld(dt) {
    const t2 = this.time;
    this.foam.scale.setScalar(1 + Math.sin(t2 * 1.3) * 0.006);
    for (const s of this.sparkles) s.scale.setScalar(0.3 + ((Math.sin(t2 * 2 + s.userData.phase) + 1) / 2) * 0.8);
    for (const c of this.clouds) {
      c.position.x += c.userData.speed * dt;
      if (c.position.x > 70) c.position.x = -70;
    }
    for (const m of this.mushrooms) {
      m.squish = Math.max(0, m.squish - dt * 4);
      const s = 1 - Math.sin(m.squish * Math.PI) * 0.3;
      m.mesh.scale.set(1 + (1 - s) * 0.6, s, 1 + (1 - s) * 0.6);
    }
    const tr = this.trampoline;
    tr.squish = Math.max(0, tr.squish - dt * 4);
    tr.mesh.position.y = 0.58 - Math.sin(tr.squish * Math.PI) * 0.3;
    this.updateSwings(dt);
  }

  // ---------- panels ----------

  refreshTitle() {
    const has = this.players.length > 0;
    if (!has && !this.titleEl) {
      const keys = KEYBOARD_SCHEMES.map((s) => `<div class="join-key"><b>${t(`akey.${s.id}`)}</b>${t(`hint.${s.id}`)}</div>`).join('');
      this.titleEl = this.game.ui.panel(`
        <div class="title-logo">${t('hub.title')}</div>
        <div class="title-sub blink">${t('hub.join')}</div>
        <div class="join-grid">${keys}<div class="join-key"><b>A</b>${t('gamepad')}</div></div>
        <div class="title-sub" style="font-size:0.9em;margin:16px 0 0">${t('hub.keys')}</div>`);
    } else if (has && this.titleEl) {
      this.titleEl.remove();
      this.titleEl = null;
    }
  }

  onLanguage() {
    if (this.titleEl) { this.titleEl.remove(); this.titleEl = null; }
    this.refreshTitle();
    if (this.helpEl) { this.toggleHelp(); this.toggleHelp(); }
  }

  toggleHelp() {
    if (this.helpEl) { this.helpEl.remove(); this.helpEl = null; return; }
    this.helpEl = this.game.ui.panel(`
      <div class="help-panel">
        <h2>${t('help.title')}</h2>
        <ul>${[1, 2, 3, 7, 4, 5, 6].map((i) => `<li>${t(`help.${i}`)}</li>`).join('')}</ul>
      </div>`);
  }

  update(dt) {
    this.handleJoins();
    this.refreshTitle();
    for (const e of [...this.entities.values()]) this.updatePlayer(e, dt);
    this.separatePlayers();
    this.updateToys(dt);
    this.updatePins(dt);
    this.updateBeachBall(dt);
    this.updateStars(dt);
    this.updateCorner(dt);
    this.updatePads(dt);
    this.animateWorld(dt);
    this.updateCamera(dt);
    for (const e of this.entities.values()) {
      if (e.tag.textContent !== e.p.deviceLabel) e.tag.textContent = e.p.deviceLabel;
      if (e.tag.style.color !== e.p.css) e.tag.style.color = e.p.css;
      e.tagPos.set(e.x, e.y + 2, e.z);
      this.game.ui.place(e.tag, e.tagPos, this.camera);
    }
    const goal = this.game.roster.nextHatGoal();
    const hint = this.players.length ? `<div class="pill" style="font-size:clamp(12px,1.1vw,18px)">${t('hub.hint')}</div>` : '';
    this.game.ui.setCorner(`${hint}<div class="pill"><span class="star-icon"></span><b>${this.game.roster.stars}</b>${goal ? `<span style="opacity:.7">${t('hub.nextHat', { n: goal.stars })}</span>` : ''}</div>`);
    this.game.ui.bar(this.players, (p) => esc(p.deviceLabel));
  }

  idle(dt) {
    this.animateWorld(dt);
    for (const e of this.entities.values()) e.ch.update(dt, {});
  }
}
