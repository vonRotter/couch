import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { BaseScene } from '../core/scene.js';
import { Character } from '../core/character.js';
import { COLORS, PLAYER_COLORS, toon, basic, sharedGeo } from '../core/palette.js';
import { addLights, skyTexture, makeTree, makeCloud, makeFlower, makeRock, makeBush, makeStar, makeMushroom, seeded, soccerBallTexture } from '../core/world.js';
import { KEYBOARD_SCHEMES } from '../core/input.js';
import { hatName } from '../core/roster.js';
import { t } from '../core/i18n.js';
import { esc } from '../core/ui.js';
import { glyphMaterial } from '../core/edu.js';

const ISLAND_R = 22;
const PR = 0.42; // player radius
const SPEED = 7;
const GRAVITY = 32;
const JUMP = 11.5;

const PADS = [
  { key: 'bubble', x: -11, z: -7, color: 0xff7eb6, css: '#ff4f9a' },
  { key: 'platformer', x: 0, z: -13, color: 0x4cc9f0, css: '#1aa7d8' },
  { key: 'paint', x: 11, z: -7, color: 0xff8c42, css: '#f26b1d' },
  { key: 'archers', x: -15, z: 3, color: 0xffc93c, css: '#e0a100' },
  { key: 'brawl', x: 15, z: 3, color: 0xff5d73, css: '#f0364f' },
  { key: 'kart', x: -9, z: 12, color: 0x3ddc97, css: '#16b874' },
  { key: 'portal', x: 9, z: 12, color: 0x9b5de5, css: '#8a45e0' },
  { key: 'spelling', x: -6, z: -12.5, color: 0x2ec4b6, css: '#139e91', edu: true },
  { key: 'math', x: 6, z: -12.5, color: 0xff9f1c, css: '#e07f00', edu: true },
  { key: 'football', x: 17.5, z: -3.5, color: 0x58b947, css: '#3f9a32' },
];
const LANG_FLAG = { x: 5.5, z: 6.5 };
const SWAP_PADS = [{ x: -1.6, z: 9.2 }, { x: 1.6, z: 9.2 }];
const POT_SPOTS = [30, 54, 78, 102, 126, 150].map((deg) => {
  const a = THREE.MathUtils.degToRad(deg);
  return { x: Math.cos(a) * 5, z: 2 + Math.sin(a) * 5 };
});
const EDU_SWITCH = { x: -5.5, z: 6.5 };
const PAD_R = 2.6;

// Where stars can appear. y is the star's height.
const STAR_SPOTS = [
  [0, 14.5, 3.7], [-9, 7, 5.6], [-16.5, -5, 2.2], [0, 6, 2.4],
  [-4, 3, 0.8], [5, -2, 0.8], [13.5, 8, 0.8], [-17, 9, 0.8],
  [5, 17, 0.8], [-5, 17, 0.8], [12, -13.5, 0.8], [-3, -8, 2.2],
]

export class HubScene extends BaseScene {
  constructor(game, { fromGame = null } = {}) {
    super(game);
    this.key = null;
    this.camera.fov = 45;
    this.camera.updateProjectionMatrix();
    this.scene.background = skyTexture('#6fd0ff', '#d9f6ff');
    this.scene.fog = new THREE.Fog(0xbfeeff, 70, 140);
    addLights(this.scene, { size: 30 });

    this.obstacles = [];
    this.entities = new Map();
    this.camTarget = new THREE.Vector3(0, 0, 2);
    this.camPos = new THREE.Vector3(0, 18, 22);
    this.launching = false;
    this.helpEl = null;
    this.eduOn = game.roster.progress.edu !== false;
    this.switchCd = 0;

    this.buildIsland();
    this.buildPads();
    this.buildProps();
    this.buildStars();
    this.buildBall();

    for (const [i, p] of this.players.entries()) {
      const pad = PADS.find((d) => d.key === fromGame);
      const a = (i / Math.max(1, this.players.length)) * Math.PI * 2;
      const base = pad ? new THREE.Vector3(pad.x * 0.7, 0, pad.z * 0.7 + 2.5) : new THREE.Vector3(0, 0, 2);
      this.spawn(p, base.x + Math.cos(a) * 1.4, base.z + Math.sin(a) * 1.4);
    }

    this.titleEl = null;
    this.refreshTitle();
    game.audio.playMusic('hub');
  }

  // ---------- building ----------

  buildIsland() {
    const s = this.scene;
    const water = new THREE.Mesh(new THREE.CircleGeometry(160, 48), toon(COLORS.water));
    water.rotation.x = -Math.PI / 2;
    water.position.y = -0.7;
    water.receiveShadow = true;
    s.add(water);

    const sand = new THREE.Mesh(new THREE.CylinderGeometry(ISLAND_R + 1.8, ISLAND_R + 2.6, 1.2, 64), toon(COLORS.sand));
    sand.position.y = -0.75;
    sand.receiveShadow = true;
    s.add(sand);

    const grass = new THREE.Mesh(new THREE.CylinderGeometry(ISLAND_R, ISLAND_R + 0.6, 1, 64), toon(COLORS.grass));
    grass.position.y = -0.5;
    grass.receiveShadow = true;
    s.add(grass);

    const cliff = new THREE.Mesh(new THREE.CylinderGeometry(ISLAND_R + 2.4, ISLAND_R - 4, 4, 64), toon(COLORS.dirt));
    cliff.position.y = -3.3;
    s.add(cliff);

    this.foam = new THREE.Mesh(new THREE.TorusGeometry(ISLAND_R + 2.7, 0.25, 6, 80), toon(COLORS.white));
    this.foam.rotation.x = Math.PI / 2;
    this.foam.position.y = -0.62;
    s.add(this.foam);

    // Sparkles on the water.
    this.sparkles = [];
    const rand = seeded(9);
    for (let i = 0; i < 40; i++) {
      const m = new THREE.Mesh(sharedGeo('sparkle', () => new THREE.CircleGeometry(0.35, 6)), basic(0xffffff, { transparent: true, opacity: 0.7 }));
      m.rotation.x = -Math.PI / 2;
      const a = rand() * Math.PI * 2, r = ISLAND_R + 5 + rand() * 30;
      m.position.set(Math.cos(a) * r, -0.66, Math.sin(a) * r);
      m.userData.phase = rand() * 6;
      s.add(m);
      this.sparkles.push(m);
    }

    // Stepping-stone paths from the plaza to each pad.
    const stoneGeo = sharedGeo('stone', () => new THREE.CylinderGeometry(0.55, 0.6, 0.12, 10));
    for (const pad of PADS) {
      const n = 6;
      for (let i = 1; i < n; i++) {
        const t = i / n;
        const st = new THREE.Mesh(stoneGeo, toon(COLORS.sand));
        st.position.set(pad.x * t + Math.sin(i * 1.7) * 0.4, 0.02, pad.z * t + 1.5 * (1 - t));
        st.receiveShadow = true;
        s.add(st);
      }
    }
    const plaza = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.3, 0.1, 32), toon(COLORS.sand));
    plaza.position.set(0, 0.01, 2);
    plaza.receiveShadow = true;
    s.add(plaza);
  }

  buildPads() {
    const s = this.scene;
    for (const pad of PADS) {
      const g = new THREE.Group();
      g.position.set(pad.x, 0, pad.z);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(PAD_R, PAD_R + 0.2, 0.25, 40), toon(COLORS.icing));
      base.position.y = 0.12;
      base.receiveShadow = true;
      const rim = new THREE.Mesh(new THREE.TorusGeometry(PAD_R, 0.18, 8, 48), toon(pad.color));
      rim.rotation.x = Math.PI / 2;
      rim.position.y = 0.26;
      const fill = new THREE.Mesh(new THREE.CylinderGeometry(PAD_R - 0.1, PAD_R - 0.1, 0.05, 40), toon(pad.color));
      fill.position.y = 0.27;
      fill.scale.set(0.001, 1, 0.001);
      g.add(base, rim, fill);
      s.add(g);
      pad.group = g;
      pad.fill = fill;
      pad.progress = 0;
      pad.label = this.game.ui.label('label');
      pad.label.style.color = pad.css;
      pad.labelPos = new THREE.Vector3(pad.x, 3.4, pad.z);
    }

    // Landmarks behind each pad.
    this.buildNewLandmarks();
    const [bub, sky, paint] = PADS;
    // Candy hut with floating bubbles.
    const hut = new THREE.Group();
    hut.position.set(bub.x - 3.8, 0, bub.z - 4);
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.8, 2.4, 20), toon(COLORS.candyPink));
    wall.position.y = 1.2;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(2.2, 1.8, 20), toon(COLORS.candyBlue));
    roof.position.y = 3.3;
    wall.castShadow = roof.castShadow = true;
    hut.add(wall, roof);
    s.add(hut);
    this.obstacles.push({ x: hut.position.x, z: hut.position.z, r: 1.9 });
    this.hubBubbles = [];
    for (let i = 0; i < 6; i++) {
      const b = new THREE.Mesh(sharedGeo('hubBubble', () => new THREE.SphereGeometry(0.5, 20, 14)), toon(0xbfe9ff, { transparent: true, opacity: 0.55 }));
      b.userData = { t: i / 6, x: hut.position.x + (Math.random() - 0.5) * 3, z: hut.position.z + (Math.random() - 0.5) * 3 };
      s.add(b);
      this.hubBubbles.push(b);
    }

    // Floating sky blocks with a flag.
    const blocks = new THREE.Group();
    blocks.position.set(sky.x, 0, sky.z - 4.2);
    const blockGeo = sharedGeo('hubBlock', () => new THREE.BoxGeometry(1.4, 1.4, 1.4));
    [[-2.2, 1.2], [0, 2.4], [2.2, 3.6]].forEach(([x, y]) => {
      const b = new THREE.Mesh(blockGeo, toon(COLORS.dirt));
      b.position.set(x, y, 0);
      const top = new THREE.Mesh(sharedGeo('hubBlockTop', () => new THREE.BoxGeometry(1.5, 0.4, 1.5)), toon(COLORS.grass));
      top.position.set(x, y + 0.75, 0);
      b.castShadow = top.castShadow = true;
      blocks.add(b, top);
    });
    const pole = new THREE.Mesh(sharedGeo('pole', () => new THREE.CylinderGeometry(0.07, 0.07, 2.6, 8)), toon(COLORS.white));
    pole.position.set(2.2, 5.6, 0);
    const flag = new THREE.Mesh(sharedGeo('flagTri', () => new THREE.ConeGeometry(0.5, 1.1, 3)), toon(0xff5d73));
    flag.rotation.z = -Math.PI / 2;
    flag.position.set(2.75, 6.4, 0);
    this.skyFlag = flag;
    blocks.add(pole, flag);
    s.add(blocks);
    this.skyBlocks = blocks;

    // Giant paint buckets and splats.
    const buckets = new THREE.Group();
    buckets.position.set(paint.x + 3.8, 0, paint.z - 4);
    [[0, 0, 0xff5d73, 1.2], [1.9, 1.1, 0x4cc9f0, 0.9], [-1.4, 1.5, 0xffc93c, 0.8]].forEach(([x, z, c, sc]) => {
      const b = new THREE.Mesh(sharedGeo('bucket', () => new THREE.CylinderGeometry(0.9, 0.75, 1.5, 20)), toon(COLORS.icing));
      b.position.set(x, 0.75 * sc, z);
      b.scale.setScalar(sc);
      const p = new THREE.Mesh(sharedGeo('bucketPaint', () => new THREE.CylinderGeometry(0.86, 0.86, 0.1, 20)), toon(c));
      p.position.set(x, 1.5 * sc + 0.01, z);
      p.scale.set(sc, 1, sc);
      const drip = new THREE.Mesh(sharedGeo('drip', () => new THREE.SphereGeometry(0.25, 10, 8)), toon(c));
      drip.position.set(x + 0.8 * sc, 1.2 * sc, z + 0.2);
      drip.scale.set(0.6, 1.4, 0.6);
      b.castShadow = true;
      buckets.add(b, p, drip);
      this.obstacles.push({ x: buckets.position.x + x, z: buckets.position.z + z, r: 0.95 * sc });
    });
    s.add(buckets);
    const splatGeo = sharedGeo('splat', () => new THREE.CircleGeometry(1, 12));
    const rand = seeded(4);
    for (let i = 0; i < 9; i++) {
      const c = PLAYER_COLORS[i % 6].hex;
      const sp = new THREE.Mesh(splatGeo, toon(c));
      sp.rotation.x = -Math.PI / 2;
      sp.position.set(paint.x + (rand() - 0.5) * 9, 0.02 + i * 0.002, paint.z + (rand() - 0.3) * 7);
      sp.scale.setScalar(0.4 + rand() * 0.6);
      sp.receiveShadow = true;
      s.add(sp);
    }
  }

  buildEduLandmarks() {
    const s = this.scene;
    const blockGeo = sharedGeo('eduBlock', () => new RoundedBoxGeometry(1.3, 1.3, 1.3, 2, 0.14));
    const faceGeo = sharedGeo('eduFace', () => new THREE.PlaneGeometry(1.15, 1.15));
    const stack = (pad, glyphs, colors) => {
      pad.extras = [];
      glyphs.forEach((ch, i) => {
        const b = new THREE.Mesh(blockGeo, toon(colors[i % colors.length]));
        const row = i < 3 ? 0 : 1;
        const col = row === 0 ? i - 1 : i - 3.5;
        b.position.set(pad.x + col * 1.4, 0.65 + row * 1.3, pad.z - 3.6);
        b.rotation.y = (i % 2 ? 0.12 : -0.12);
        b.castShadow = true;
        const face = new THREE.Mesh(faceGeo, glyphMaterial(ch));
        face.position.z = 0.66;
        b.add(face);
        s.add(b);
        pad.extras.push(b);
      });
      this.obstacles.push({ x: pad.x, z: pad.z - 3.6, r: 2.1, top: 2.6, eduPad: pad });
    };
    stack(PADS.find((p) => p.key === 'spelling'), ['A', 'B', 'C', 'Æ', 'Ø'], [0xff9fd0, 0x8fd8ff, 0xffe47a, 0x9ff0c8, 0xc9a8ff]);
    stack(PADS.find((p) => p.key === 'math'), ['1', '+', '2', '=', '3'], [0xffe47a, 0x9ff0c8, 0xff9fd0, 0x8fd8ff, 0xffc08a]);

    // The learning switch: jump on the big button to show or hide the learning games.
    const g = new THREE.Group();
    g.position.set(EDU_SWITCH.x, 0, EDU_SWITCH.z);
    const base = new THREE.Mesh(sharedGeo('swBase', () => new THREE.CylinderGeometry(1.0, 1.15, 0.5, 24)), toon(COLORS.icing));
    base.position.y = 0.25;
    base.castShadow = base.receiveShadow = true;
    const cap = new THREE.Mesh(sharedGeo('swCap', () => new THREE.CylinderGeometry(0.75, 0.8, 0.3, 24)), toon(0x3ddc97));
    cap.position.y = 0.62;
    cap.castShadow = true;
    const book = new THREE.Mesh(sharedGeo('swBook', () => new RoundedBoxGeometry(0.9, 0.12, 0.65, 2, 0.04)), toon(COLORS.white));
    book.position.y = 0.82;
    g.add(base, cap, book);
    s.add(g);
    this.eduCap = cap;
    this.eduSwitch = { x: EDU_SWITCH.x, z: EDU_SWITCH.z, r: 0.9, top: 0.8, toggle: true };
    this.obstacles.push(this.eduSwitch);
    this.eduLabel = this.game.ui.label('label');
    this.eduLabelPos = new THREE.Vector3(EDU_SWITCH.x, 2.2, EDU_SWITCH.z);
  }

  buildSocial() {
    const s = this.scene;
    // Football: a goal and a giant ball next to the pad.
    const fb = PADS.find((p) => p.key === 'football');
    const goal = new THREE.Group();
    goal.position.set(fb.x + 1.4, 0, fb.z - 4.2);
    goal.rotation.y = -0.35;
    const postGeo = sharedGeo('goalPost', () => new THREE.CylinderGeometry(0.12, 0.12, 2.4, 10));
    for (const sx of [-1.9, 1.9]) {
      const post = new THREE.Mesh(postGeo, toon(COLORS.white));
      post.position.set(sx, 1.2, 0);
      post.castShadow = true;
      goal.add(post);
      this.obstacles.push({ x: goal.position.x + Math.cos(-0.35) * sx, z: goal.position.z - Math.sin(-0.35) * sx, r: 0.25 });
    }
    const bar = new THREE.Mesh(sharedGeo('goalBar', () => new THREE.CylinderGeometry(0.12, 0.12, 4, 10)), toon(COLORS.white));
    bar.rotation.z = Math.PI / 2;
    bar.position.y = 2.4;
    const net = new THREE.Mesh(sharedGeo('goalNet', () => new THREE.BoxGeometry(3.8, 2.3, 1.2)), toon(0xffffff, { transparent: true, opacity: 0.35 }));
    net.position.set(0, 1.15, -0.7);
    goal.add(bar, net);
    s.add(goal);
    const bigBall = new THREE.Mesh(new THREE.SphereGeometry(1.1, 24, 16), new THREE.MeshToonMaterial({ map: soccerBallTexture(), gradientMap: toon(0xffffff).gradientMap }));
    bigBall.position.set(fb.x - 3.6, 1.1, fb.z - 2.2);
    bigBall.castShadow = true;
    s.add(bigBall);
    this.obstacles.push({ x: bigBall.position.x, z: bigBall.position.z, r: 1.1, top: 2.1 });

    // Paint pots: walk into one to take that color.
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
      const o = { x: sp.x, z: sp.z, r: 0.55, top: 0.75, pot: i };
      this.obstacles.push(o);
      const label = this.game.ui.label('label player-tag');
      label.style.color = PLAYER_COLORS[i].css;
      return { index: i, group: g, label, labelPos: new THREE.Vector3(sp.x, 1.5, sp.z), flash: 0 };
    });

    // Swap pads: one player on each, both tap B to trade colors.
    this.swapPads = SWAP_PADS.map((sp) => {
      const disc = new THREE.Mesh(sharedGeo('swapPad', () => new THREE.CylinderGeometry(0.95, 1.0, 0.14, 28)), toon(COLORS.icing));
      disc.position.set(sp.x, 0.07, sp.z);
      disc.receiveShadow = true;
      s.add(disc);
      return { ...sp, disc, who: null };
    });
    const arrows = new THREE.Group();
    arrows.position.set(0, 0.16, SWAP_PADS[0].z);
    for (const dir of [-1, 1]) {
      const head = new THREE.Mesh(sharedGeo('swapArrow', () => new THREE.ConeGeometry(0.18, 0.4, 3)), toon(0xffc93c));
      head.rotation.set(-Math.PI / 2, 0, dir * Math.PI / 2);
      head.position.set(dir * 0.35, 0, dir * 0.18);
      arrows.add(head);
    }
    s.add(arrows);
    this.swapLabel = this.game.ui.label('label');
    this.swapLabelPos = new THREE.Vector3(0, 1.6, SWAP_PADS[0].z);
    this.swapCd = 0;

    // Language flag: jump on its button to switch English / Norwegian.
    const fl = new THREE.Group();
    fl.position.set(LANG_FLAG.x, 0, LANG_FLAG.z);
    const base = new THREE.Mesh(sharedGeo('swBase', () => new THREE.CylinderGeometry(1.0, 1.15, 0.5, 24)), toon(COLORS.icing));
    base.position.y = 0.25;
    base.castShadow = base.receiveShadow = true;
    const cap = new THREE.Mesh(sharedGeo('swCap', () => new THREE.CylinderGeometry(0.75, 0.8, 0.3, 24)), toon(0x4cc9f0));
    cap.position.y = 0.62;
    const pole = new THREE.Mesh(sharedGeo('langPole', () => new THREE.CylinderGeometry(0.06, 0.06, 2.2, 8)), toon(COLORS.white));
    pole.position.set(0.55, 1.8, 0);
    this.langFlag = new THREE.Mesh(sharedGeo('langFlag', () => new THREE.PlaneGeometry(1.2, 0.8)), glyphMaterial('EN', { disc: null }));
    this.langFlag.position.set(1.18, 2.5, 0);
    const cloth = new THREE.Mesh(sharedGeo('langCloth', () => new THREE.PlaneGeometry(1.25, 0.85)), toon(0x4cc9f0));
    cloth.position.set(1.18, 2.5, -0.01);
    this.langCloth = cloth;
    fl.add(base, cap, pole, cloth, this.langFlag);
    s.add(fl);
    this.obstacles.push({ x: LANG_FLAG.x, z: LANG_FLAG.z, r: 0.9, top: 0.8, lang: true });
    this.langLabel = this.game.ui.label('label');
    this.langLabelPos = new THREE.Vector3(LANG_FLAG.x, 3.4, LANG_FLAG.z);
  }

  touchPot(e, index) {
    if (e.potCd > 0 || e.p.colorIndex === index) return;
    e.potCd = 1;
    const roster = this.game.roster;
    if (roster.setColor(e.p, index)) {
      this.recolor(e);
      this.game.audio.play('join');
      this.game.ui.toast(t('hub.newColor', { name: e.p.name }));
      this.confetti.burst(new THREE.Vector3(e.x, 1, e.z), e.p.color, { count: 16, speed: 5 });
    } else {
      this.pots[index].flash = 1.5;
      this.game.audio.play('bump');
    }
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

  updateSocial(dt) {
    this.swapCd -= dt;
    for (const e of this.entities.values()) e.potCd = (e.potCd || 0) - dt;
    // Pot labels show up when someone is close.
    const nearest = new Set();
    for (const e of this.entities.values()) {
      let best = null, bestD = 2.2;
      for (const pot of this.pots) {
        const d = Math.hypot(e.x - pot.group.position.x, e.z - pot.group.position.z);
        if (d < bestD) { bestD = d; best = pot; }
      }
      if (best) nearest.add(best);
    }
    for (const pot of this.pots) {
      pot.flash -= dt;
      const near = nearest.has(pot);
      const owner = this.game.roster.colorOwner(pot.index);
      pot.label.style.display = near || pot.flash > 0 ? '' : 'none';
      const text = owner ? `${t(`color.${pot.index}`)} · ${t('hub.taken')}` : t(`color.${pot.index}`);
      if (pot.label.textContent !== text) pot.label.textContent = text;
      if (near || pot.flash > 0) this.game.ui.place(pot.label, pot.labelPos, this.camera);
      pot.group.scale.setScalar(pot.flash > 0 ? 1 + Math.sin(pot.flash * 20) * 0.06 : 1);
    }
    // Swap pads.
    for (const sp of this.swapPads) {
      const who = [...this.entities.values()].find((e) => Math.hypot(e.x - sp.x, e.z - sp.z) < 1.0 && e.y < 0.6) || null;
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
    // Language flag.
    const no = t('lang.name') === 'Norsk';
    this.langFlag.material = glyphMaterial(no ? 'NO' : 'EN');
    this.langCloth.material = toon(no ? 0xff5d73 : 0x4cc9f0);
    this.langFlag.rotation.y = this.langCloth.rotation.y = Math.sin(this.time * 2) * 0.15;
    const langHtml = `${t('hub.langSign')}<small>${t('hub.jumpFlag')}</small>`;
    if (this.langLabel.innerHTML !== langHtml) this.langLabel.innerHTML = langHtml;
    this.langLabel.style.color = no ? '#f0364f' : '#1aa7d8';
    this.game.ui.place(this.langLabel, this.langLabelPos, this.camera);
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

  buildNewLandmarks() {
    const s = this.scene;
    const pad = (k) => PADS.find((p) => p.key === k);
    this.buildEduLandmarks();
    this.buildSocial();

    // Archery target with balloons.
    const ar = pad('archers');
    const target = new THREE.Group();
    target.position.set(ar.x - 4.2, 0, ar.z);
    target.rotation.y = Math.PI / 2;
    const rings = [[1.5, 0xff5d73], [1.15, 0xffffff], [0.8, 0x4cc9f0], [0.45, 0xffc93c]];
    rings.forEach(([r, c], i) => {
      const d = new THREE.Mesh(sharedGeo(`tgt${r}`, () => new THREE.CylinderGeometry(r, r, 0.2, 28)), toon(c));
      d.rotation.x = Math.PI / 2;
      d.position.set(0, 2.4, 0.05 + i * 0.04);
      d.castShadow = i === 0;
      target.add(d);
    });
    for (const sx of [-0.9, 0.9]) {
      const leg = new THREE.Mesh(sharedGeo('tgtLeg', () => new THREE.CylinderGeometry(0.12, 0.12, 2.4, 8)), toon(COLORS.trunk));
      leg.position.set(sx, 1.0, -0.3);
      leg.rotation.x = 0.15;
      target.add(leg);
    }
    s.add(target);
    this.obstacles.push({ x: target.position.x, z: target.position.z, r: 1.2 });
    this.hubBalloons = [];
    PLAYER_COLORS.forEach((c, i) => {
      const b = new THREE.Mesh(sharedGeo('hubBalloon', () => new THREE.SphereGeometry(0.45, 16, 12)), toon(c.hex));
      b.scale.y = 1.2;
      b.userData = { x: ar.x - 3 + (i % 3) * 0.9, z: ar.z - 2.6 + Math.floor(i / 3) * 0.8, phase: i };
      s.add(b);
      this.hubBalloons.push(b);
    });

    // Giant boxing glove on a spring.
    const br = pad('brawl');
    const glove = new THREE.Group();
    glove.position.set(br.x + 4.2, 0, br.z);
    const springGeo = sharedGeo('gloveSpring', () => new THREE.TorusGeometry(0.4, 0.08, 6, 16));
    for (let i = 0; i < 6; i++) {
      const ring = new THREE.Mesh(springGeo, toon(COLORS.rock));
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.3 + i * 0.32;
      glove.add(ring);
    }
    const fist = new THREE.Mesh(sharedGeo('fist', () => new THREE.SphereGeometry(1, 18, 14)), toon(0xff3b5c));
    fist.scale.set(1.1, 0.95, 1.25);
    fist.position.y = 3;
    const thumb = new THREE.Mesh(sharedGeo('thumb', () => new THREE.SphereGeometry(0.4, 12, 10)), toon(0xff3b5c));
    thumb.position.set(-0.85, 2.9, 0.5);
    const cuff = new THREE.Mesh(sharedGeo('cuff', () => new THREE.CylinderGeometry(0.6, 0.7, 0.6, 16)), toon(COLORS.white));
    cuff.position.y = 2.1;
    fist.castShadow = true;
    glove.add(fist, thumb, cuff);
    glove.rotation.y = -Math.PI / 2;
    s.add(glove);
    this.glove = glove;
    this.obstacles.push({ x: glove.position.x, z: glove.position.z, r: 0.9 });

    // Checkered arch and tire stacks.
    const kt = pad('kart');
    const arch = new THREE.Group();
    arch.position.set(kt.x - 2.8, 0, kt.z + 3.6);
    arch.rotation.y = -0.6;
    for (const sx of [-2.2, 2.2]) {
      const post = new THREE.Mesh(sharedGeo('archPost', () => new THREE.CylinderGeometry(0.22, 0.22, 3.2, 10)), toon(COLORS.white));
      post.position.set(sx, 1.6, 0);
      post.castShadow = true;
      arch.add(post);
      this.obstacles.push({ x: arch.position.x + Math.cos(-0.6) * sx, z: arch.position.z - Math.sin(-0.6) * sx, r: 0.3 });
    }
    const c = document.createElement('canvas');
    c.width = 64; c.height = 16;
    const g = c.getContext('2d');
    for (let i = 0; i < 16; i++) for (let j = 0; j < 4; j++) {
      g.fillStyle = (i + j) % 2 ? '#2b2340' : '#ffffff';
      g.fillRect(i * 4, j * 4, 4, 4);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = THREE.NearestFilter;
    const banner = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.7, 0.15), new THREE.MeshToonMaterial({ map: tex }));
    banner.position.y = 3.2;
    arch.add(banner);
    s.add(arch);
    for (const [dx, dz] of [[2.5, 3.5], [-4.5, 0.5]]) {
      const stack = new THREE.Group();
      stack.position.set(kt.x + dx, 0, kt.z + dz);
      for (let i = 0; i < 3; i++) {
        const tire = new THREE.Mesh(sharedGeo('tire', () => new THREE.TorusGeometry(0.42, 0.2, 8, 16)), toon(i % 2 ? COLORS.ink : 0xff5d73));
        tire.rotation.x = Math.PI / 2;
        tire.position.y = 0.2 + i * 0.38;
        tire.castShadow = true;
        stack.add(tire);
      }
      s.add(stack);
      this.obstacles.push({ x: stack.position.x, z: stack.position.z, r: 0.6, top: 1.15 });
    }

    // Two standing portal rings.
    const pt = pad('portal');
    this.portalRings = [];
    [[-1.6, 0x4cc9f0], [1.6, 0xff8c42]].forEach(([dx, col]) => {
      const ringG = new THREE.Group();
      ringG.position.set(pt.x + 2.8 + dx, 0, pt.z + 3.4);
      ringG.rotation.y = 0.5;
      const ring = new THREE.Mesh(sharedGeo('portalRing', () => new THREE.TorusGeometry(1, 0.18, 10, 32)), toon(col, { emissive: col === 0x4cc9f0 ? 0x0a3550 : 0x502a0a }));
      ring.scale.y = 1.4;
      ring.position.y = 1.6;
      const fill = new THREE.Mesh(sharedGeo('portalFill', () => new THREE.CircleGeometry(0.95, 32)), basic(col, { transparent: true, opacity: 0.45 }));
      fill.scale.y = 1.4;
      fill.position.y = 1.6;
      ringG.add(ring, fill);
      s.add(ringG);
      this.portalRings.push(fill);
      this.obstacles.push({ x: ringG.position.x, z: ringG.position.z, r: 0.5 });
    });
  }

  buildProps() {
    const s = this.scene;
    const rand = seeded(42);

    // Stump staircase to a high star.
    const stumpGeo = sharedGeo('stump', () => new THREE.CylinderGeometry(1, 1.1, 1, 16));
    [[0, 11, 0.9, 0.9], [2.2, 12.8, 1.8, 0.9], [0, 14.5, 2.7, 1.0]].forEach(([x, z, top, r]) => {
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

    // Big standable rock.
    const bigRock = makeRock(rand, 1.6);
    bigRock.scale.set(1.8, 1.2, 1.8);
    bigRock.position.set(-16.5, 0, -5);
    s.add(bigRock);
    this.obstacles.push({ x: -16.5, z: -5, r: 1.7, top: 1.1 });

    // Bouncy mushrooms.
    this.mushrooms = [];
    [[-9, 7, 0xff5d73], [-3, -8, 0x9b5de5]].forEach(([x, z, c]) => {
      const m = makeMushroom(c);
      m.position.set(x, 0, z);
      s.add(m);
      const o = { x, z, r: 0.9, top: 1.15, bounce: x === -3 ? 13 : 17.5, mesh: m, squish: 0 };
      this.obstacles.push(o);
      this.mushrooms.push(o);
    });

    // Tree ring and scattered nature, kept clear of pads and stars.
    const clear = (x, z, d) =>
      PADS.every((p) => Math.hypot(p.x - x, p.z - z) > PAD_R + d + 2.5) &&
      STAR_SPOTS.every(([sx, sz]) => Math.hypot(sx - x, sz - z) > d + 1.6) &&
      this.obstacles.every((o) => Math.hypot(o.x - x, o.z - z) > o.r + d + 1) &&
      Math.hypot(x, z - 2) > 5;
    let placed = 0;
    for (let i = 0; i < 300 && placed < 26; i++) {
      const a = rand() * Math.PI * 2;
      const r = 13 + rand() * 7.5;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (!clear(x, z, 1.2)) continue;
      const t = makeTree(rand, 0.9 + rand() * 0.5);
      t.position.set(x, 0, z);
      s.add(t);
      this.obstacles.push({ x, z, r: 0.5 });
      placed++;
    }
    for (let i = 0; i < 14; i++) {
      const a = rand() * Math.PI * 2, r = 6 + rand() * 14;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (!clear(x, z, 0.6)) continue;
      const b = rand() < 0.5 ? makeBush(rand, 0.9) : makeRock(rand, 0.5);
      b.position.set(x, b.isMesh ? 0.15 : 0, z);
      s.add(b);
    }
    for (let i = 0; i < 90; i++) {
      const a = rand() * Math.PI * 2, r = 3 + rand() * 18;
      const f = makeFlower(rand);
      f.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
      s.add(f);
    }

    this.clouds = [];
    for (let i = 0; i < 9; i++) {
      const c = makeCloud(rand, 1.4 + rand() * 1.4);
      c.position.set((rand() - 0.5) * 90, 14 + rand() * 10, -30 + (rand() - 0.5) * 50);
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

  buildBall() {
    const tex = (() => {
      const c = document.createElement('canvas');
      c.width = 256; c.height = 128;
      const g = c.getContext('2d');
      const cols = ['#ff5d73', '#ffffff', '#ffc93c', '#ffffff', '#4cc9f0', '#ffffff'];
      cols.forEach((col, i) => { g.fillStyle = col; g.fillRect((i * 256) / 6, 0, 256 / 6 + 1, 128); });
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    })();
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.75, 24, 16), new THREE.MeshToonMaterial({ map: tex }));
    mesh.castShadow = true;
    this.scene.add(mesh);
    this.ball = { x: 5, z: 10, vx: 0, vz: 0, r: 0.75, mesh };
  }

  // ---------- players ----------

  spawn(p, x, z) {
    const ch = new Character(p.color, { hat: p.hat });
    ch.group.position.set(x, 0, z);
    this.scene.add(ch.group);
    const tag = this.game.ui.label('label player-tag');
    tag.style.color = p.css;
    tag.textContent = p.deviceLabel;
    const e = { p, ch, x, y: 0, z, vx: 0, vy: 0, vz: 0, grounded: true, bHold: 0, prevB: false, tag, tagPos: new THREE.Vector3() };
    this.entities.set(p, e);
    this.puffs.burst(new THREE.Vector3(x, 0.6, z), 0xffffff, { count: 14, speed: 4, size: 0.4 });
    return e;
  }

  despawn(e) {
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
      this.spawn(p, Math.cos(a) * 1.5, 2 + Math.sin(a) * 1.5);
      this.game.audio.play('join');
      this.game.ui.toast(t('hub.joined', { name: p.name }));
    }
    if (this.game.input.escPressed) this.toggleHelp();
  }

  updatePlayer(e, dt) {
    const inp = this.input(e.p);
    if (!inp) return;
    const audio = this.game.audio;

    // Tap B: next hat. Hold B: leave.
    if (inp.b) {
      e.bHold += dt;
      if (e.bHold > 1.3) { this.despawn(e); this.refreshTitle(); return; }
    } else {
      if (e.prevB && e.bHold < 0.35 && this.onSwapPad(e)) {
        e.swapReady = !e.swapReady;
        audio.play(e.swapReady ? 'join' : 'select');
      } else if (e.prevB && e.bHold < 0.35) {
        const h = this.game.roster.cycleHat(e.p);
        e.ch.setHat(h);
        e.ch.squash(1.25);
        audio.play('select');
      }
      e.bHold = 0;
    }
    e.prevB = inp.b;
    e.ch.group.scale.setScalar(1 - Math.min(0.4, Math.max(0, e.bHold - 0.35) * 0.4));

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
      if (o.eduPad && !this.eduOn) continue;
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
      }
    }
    const rr = Math.hypot(e.x, e.z);
    if (rr > ISLAND_R - 0.6) { e.x *= (ISLAND_R - 0.6) / rr; e.z *= (ISLAND_R - 0.6) / rr; }

    e.vy -= GRAVITY * dt;
    const prevY = e.y;
    e.y += e.vy * dt;
    let floor = 0, floorObj = null;
    for (const o of this.obstacles) {
      if (o.top === undefined || (o.eduPad && !this.eduOn)) continue;
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
        floorObj.squish = 1;
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

    const sp = Math.hypot(e.vx, e.vz);
    e.ch.face(e.vx, e.vz);
    e.ch.group.position.set(e.x, e.y, e.z);
    e.ch.update(dt, { moving: Math.min(1, sp / SPEED), grounded: e.grounded, vy: e.vy });
  }

  separatePlayers() {
    const list = [...this.entities.values()];
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

  updateBall(dt) {
    const b = this.ball;
    for (const e of this.entities.values()) {
      const dx = b.x - e.x, dz = b.z - e.z;
      const d = Math.hypot(dx, dz);
      if (d < b.r + PR && e.y < 1.2 && d > 1e-4) {
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
    const rr = Math.hypot(b.x, b.z);
    if (rr > ISLAND_R - b.r) {
      const nx = b.x / rr, nz = b.z / rr;
      b.x = nx * (ISLAND_R - b.r); b.z = nz * (ISLAND_R - b.r);
      const vn = b.vx * nx + b.vz * nz;
      if (vn > 0) { b.vx -= 1.8 * vn * nx; b.vz -= 1.8 * vn * nz; }
    }
    const sp = Math.hypot(b.vx, b.vz);
    b.mesh.position.set(b.x, b.r, b.z);
    if (sp > 0.01) {
      const axis = new THREE.Vector3(b.vz, 0, -b.vx).normalize();
      b.mesh.rotateOnWorldAxis(axis, (sp * dt) / b.r);
    }
  }

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
      let on = 0;
      for (const e of this.entities.values()) {
        if (Math.hypot(e.x - pad.x, e.z - pad.z) < PAD_R && e.y < 2) on++;
      }
      const hidden = pad.edu && !this.eduOn;
      pad.group.visible = !hidden;
      for (const m of pad.extras || []) m.visible = !hidden;
      if (hidden) {
        pad.progress = 0;
        pad.label.style.display = 'none';
        continue;
      }
      const ready = n > 0 && on >= need;
      pad.progress = THREE.MathUtils.clamp(pad.progress + (ready ? dt / 1.8 : -dt * 1.5), 0, 1);
      const k = Math.max(0.001, pad.progress);
      pad.fill.scale.set(k, 1, k);
      pad.group.position.y = Math.sin(this.time * 2 + pad.x) * 0.03;
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
    const target = new THREE.Vector3(0, 0, 0);
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
      target.set(Math.sin(this.time * 0.1) * 4, 0, -2);
      spread = 18;
    }
    const zoom = THREE.MathUtils.clamp(0.75 + spread / 22, 0.75, 1.7);
    const k = Math.min(1, dt * 3);
    this.camTarget.lerp(target, k);
    this.camPos.lerp(new THREE.Vector3(this.camTarget.x, 13 * zoom, this.camTarget.z + 13 * zoom), k);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camTarget.x, 0.6, this.camTarget.z);
  }

  animateWorld(dt) {
    const t = this.time;
    this.foam.scale.setScalar(1 + Math.sin(t * 1.3) * 0.008);
    for (const s of this.sparkles) {
      const v = (Math.sin(t * 2 + s.userData.phase) + 1) / 2;
      s.scale.setScalar(0.3 + v * 0.8);
    }
    for (const c of this.clouds) {
      c.position.x += c.userData.speed * dt;
      if (c.position.x > 50) c.position.x = -50;
    }
    for (const b of this.hubBubbles) {
      const u = b.userData;
      u.t = (u.t + dt * 0.18) % 1;
      b.position.set(u.x + Math.sin(u.t * 9) * 0.4, 1 + u.t * 7, u.z);
      b.scale.setScalar(Math.min(1, u.t * 8) * (1 - Math.max(0, u.t - 0.9) * 10));
    }
    this.skyBlocks.position.y = Math.sin(t * 1.2) * 0.25;
    for (const b of this.hubBalloons) {
      const u = b.userData;
      b.position.set(u.x + Math.sin(t + u.phase) * 0.15, 3.2 + Math.sin(t * 1.6 + u.phase) * 0.3, u.z);
    }
    this.glove.rotation.z = Math.sin(t * 2.2) * 0.06;
    for (const f of this.portalRings) f.material.opacity = 0.35 + Math.sin(t * 3) * 0.12;
    this.skyFlag.scale.y = 1 + Math.sin(t * 6) * 0.08;
    for (const m of this.mushrooms) {
      m.squish = Math.max(0, m.squish - dt * 4);
      const s = 1 - Math.sin(m.squish * Math.PI) * 0.3;
      m.mesh.scale.set(1 + (1 - s) * 0.6, s, 1 + (1 - s) * 0.6);
    }
  }

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
        <ul>${[1, 2, 3, 4, 5, 6].map((i) => `<li>${t(`help.${i}`)}</li>`).join('')}</ul>
      </div>`);
  }

  updateEduSwitch(dt) {
    this.switchCd -= dt;
    if (this.game.input.pressed.has('KeyG')) this.toggleEdu();
    this.eduCap.material = toon(this.eduOn ? 0x3ddc97 : 0xbdb8cf);
    const html = `<span class="edu-badge small">${t('badge.edu')}</span>${this.eduOn ? t('hub.on') : t('hub.off')}<small>${t('hub.jumpButton')}</small>`;
    if (this.eduLabel.innerHTML !== html) this.eduLabel.innerHTML = html;
    this.eduLabel.style.color = this.eduOn ? '#16b874' : '#9a94b2';
    this.game.ui.place(this.eduLabel, this.eduLabelPos, this.camera);
  }

  update(dt) {
    this.handleJoins();
    this.updateEduSwitch(dt);
    this.updateSocial(dt);
    this.refreshTitle();
    for (const e of [...this.entities.values()]) this.updatePlayer(e, dt);
    this.separatePlayers();
    this.updateBall(dt);
    this.updateStars(dt);
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
