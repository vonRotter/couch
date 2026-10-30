import * as THREE from 'three';
import { COLORS, toon, basic, sharedGeo } from '../../core/palette.js';
import { skyTexture, makeTree, makeFlower } from '../../core/world.js';
import { Character } from '../../core/character.js';
import { t, tFor } from '../../core/i18n.js';
import { esc } from '../../core/ui.js';
import { say } from '../../core/voice.js';
import { CELL, mesh, sph, rbox, bx, cyl, cone } from '../keep/common.js';
import { Hazards } from '../keep/hazards.js';
import { Nav, skillIcon, slotIcon, whereText } from './ui.js';
import { ACTS, ACT_FLOORS, ACT_COUNT, DEEP_START, DEEP_BOSS_EVERY, isDeep, questProgress, questDone, makeQuest } from './acts.js';
import { rollItem, rollRarity, SLOTS, itemName } from './items.js';
import { setDifficulty, beatTier } from './save.js';

// Pillowby, the little town of Pillow Keep Solo (mixed into the scene as a "world" like a floor):
// Bolster's forge (upgrade and salvage), Auntie Fizz's potion shop (potions, a bigger belt and a
// mystery box), the stash chest (shared by the profile's three heroes), the quest board (three
// quests), the gate to the keep (every floor you have reached, and Deep Keep checkpoints), the
// town portal (back to the floor you left), and four townsfolk with jokes. Everything is read aloud.

const W = 22, H = 14;
// Blocked rectangles in cells: [c0, r0, c1, r1].
const BLOCKS = {
  smith: [1, 1, 4, 3], shop: [17, 1, 20, 3], gate: [9, 0, 12, 1], fountain: [10, 5, 11, 6], stash: [5, 5, 5, 5], board: [16, 5, 16, 5],
  house1: [1, 8, 2, 9], house2: [19, 8, 20, 9],
};
const wx = (c) => (c - W / 2) * CELL; // left edge of cell c in world x
const wz = (r) => (r - H / 2) * CELL;
const P = (c, r) => [wx(c), wz(r)]; // a point in cell units (cell edges are whole numbers)
const mid = ([c0, r0, c1, r1]) => ({ x: (wx(c0) + wx(c1 + 1)) / 2, z: (wz(r0) + wz(r1 + 1)) / 2, w: (c1 - c0 + 1) * CELL, d: (r1 - r0 + 1) * CELL });
export const TOWN_START = { x: 0, z: wz(11.6) };
const PORTAL_AT = { x: 0, z: wz(9.6) };
const NPCS = [
  { id: 'smith', color: 0xff8c42, hat: 0, lines: 4, home: P(2.2, 4.6), route: null },
  { id: 'fizz', color: 0x9b5de5, hat: 2, lines: 4, home: P(19.4, 4.6), route: null },
  { id: 'fluff', color: 0x4cc9f0, hat: 5, lines: 6, home: P(7.5, 8), route: [P(7.5, 8), P(6.5, 4.5), P(8.5, 3.2)] },
  { id: 'snore', color: 0xc9a8ff, hat: 0, lines: 6, home: P(14.6, 7.6), route: null, sleepy: true },
  { id: 'tilly', color: 0xffc93c, hat: 3, lines: 6, home: P(13, 9), route: [P(13, 9), P(15, 4.5), P(13.5, 3.2), P(8.5, 10.5)] },
  { id: 'gumdrop', color: 0xff5d73, hat: 1, lines: 6, home: P(4.5, 11), route: [P(4.5, 11), P(3.5, 6.5), P(7.5, 11.5)] },
];

export const TownMixin = {
  buildTown() {
    this.kind = 'town';
    this.g = -1;
    this.D = this.townD();
    this.floorIndex = 0;
    this.W = W; this.H = H;
    this.theme = { floorA: 0, floorB: 0 };
    this.bg = skyTexture('#7fd3ff', '#fff1d6');
    this.scene.background = this.bg;
    this.level = new THREE.Group();
    this.scene.add(this.level);
    this.hazards = new Hazards(this, this.level);
    Object.assign(this, { grumbles: [], items: [], shots: [], fx: [], nests: [], chests: [], doors: [], torches: [], zones: [], stations: [], npcs: [], signs: [], puddles: [] });
    this.boss = null; this.fog = null; this.arena = null; this.portal = null; this.stairs = null; this.stairsArrow = null; this.wallTiles = [];
    this.floorDef = { map: [] };
    this.cells = new Uint8Array(W * H).fill(2);
    this.doorAt = new Map();
    this.flow = new Int16Array(W * H).fill(-1);
    for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) if (r === 0 || c === 0 || r === H - 1 || c === W - 1) this.cells[r * W + c] = 1;
    for (const b of Object.values(BLOCKS)) for (let r = b[1]; r <= b[3]; r++) for (let c = b[0]; c <= b[2]; c++) this.cells[r * W + c] = 1;
    this.start = { ...TOWN_START };
    this.buildTownLook();
    // stations: where you stand to use them
    // (box: the building, for clicking it with the mouse)
    const st = (id, x, z, r, box) => this.stations.push({ id, x, z, r, box });
    const sm = mid(BLOCKS.smith), sh = mid(BLOCKS.shop), gt = mid(BLOCKS.gate), ch = mid(BLOCKS.stash), bd = mid(BLOCKS.board);
    st('smith', sm.x, sm.z + sm.d / 2 + 1.0, 2.6, sm);
    st('shop', sh.x, sh.z + sh.d / 2 + 1.0, 2.6, sh);
    st('gate', gt.x, gt.z + gt.d / 2 + 1.0, 2.8, { ...gt, z: gt.z + 0.6, d: gt.d + 1.2 });
    st('stash', ch.x, ch.z + 1.4, 2.0, ch);
    st('board', bd.x, bd.z + 1.4, 2.0, bd);
    // Old Snorewell is the sage (identify, reset points); his bench is his shop
    const sn = NPCS.find((n) => n.id === 'snore').home;
    st('sage', sn[0], sn[1] + 1.2, 2.2, { x: sn[0], z: sn[1], w: 2.2, d: 1.6 });
    // the lost-and-found chest (only after the big bag change left things over)
    if (this.data.lost.length) {
      const [lx, lz] = P(4.3, 5.5);
      this.buildLostChest(lx, lz);
      st('lost', lx, lz + 1.3, 1.8, { x: lx, z: lz, w: 1.4, d: 1.2 });
    }
    for (const def of NPCS) this.makeNpc(def);
  },

  buildTownLook() {
    const L = this.level;
    // grass all around, a cobbled square inside the hedge
    const grass = mesh(new THREE.PlaneGeometry(140, 110), toon(COLORS.grass), 0, -0.02, 0, false);
    grass.rotation.x = -Math.PI / 2;
    grass.receiveShadow = true;
    L.add(grass);
    const m = new THREE.Matrix4();
    const plaza = mesh(rbox('ksPlaza', (W - 2) * CELL, 0.12, (H - 2) * CELL, 0.05), toon(0xdfe9c4), 0, 0.02, 0, false);
    plaza.receiveShadow = true;
    L.add(plaza);
    // cobbled paths: north-south from the gate, east-west between the shops and past the houses
    for (const [x, z, w, d] of [[0, 0, 4, (H - 2) * CELL], [0, wz(4.5), (W - 2) * CELL, 3], [0, wz(10.5), (W - 2) * CELL, 2.4]]) {
      const pth = mesh(new THREE.BoxGeometry(w, 0.13, d), toon(0xf0dab0), x, 0.03, z, false);
      pth.receiveShadow = true;
      L.add(pth);
    }
    for (let i = 0; i < 40; i++) {
      // a few darker stones on the paths
      const rr = seededRand(100 + i);
      const onNS = i % 2 === 0;
      const x = onNS ? (rr() - 0.5) * 3.4 : (rr() - 0.5) * (W - 3) * CELL;
      const z = onNS ? (rr() - 0.5) * (H - 3) * CELL : wz(4.5) + (rr() - 0.5) * 2.4;
      const st = mesh(rbox('ksStone', 0.7, 0.05, 0.5, 0.02), toon(0xe3c899), x, 0.1, z, false);
      st.rotation.y = rr() * 3;
      L.add(st);
    }
    // hedges with flowers all around (a gap in the south, the gate in the north)
    const hedgeTiles = [];
    for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) if ((r === 0 || c === 0 || r === H - 1 || c === W - 1) && !(r === 0 && c >= 9 && c <= 12)) hedgeTiles.push([c, r]);
    const hedge = new THREE.InstancedMesh(rbox('ksHedge', CELL, 1.4, CELL, 0.4), toon(0x58b947), hedgeTiles.length);
    hedgeTiles.forEach(([c, r], i) => { m.makeTranslation(this.cx(c), 0.7, this.cz(r)); hedge.setMatrixAt(i, m); });
    hedge.castShadow = true;
    L.add(hedge);
    const rand = seededRand(7);
    for (let i = 0; i < 26; i++) {
      const [c, r] = hedgeTiles[Math.floor(rand() * hedgeTiles.length)];
      const f = makeFlower(rand);
      f.position.set(this.cx(c) + (rand() - 0.5), 1.35, this.cz(r) + (rand() - 0.5));
      L.add(f);
    }
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * Math.PI * 2;
      const tr = makeTree(rand, 1.1 + rand() * 0.4);
      tr.position.set(Math.cos(a) * (27 + rand() * 6), 0, Math.sin(a) * (19 + rand() * 5));
      if (tr.position.z > 8) continue; // keep the view open toward the camera
      L.add(tr);
    }
    this.buildSmith(mid(BLOCKS.smith));
    this.buildShop(mid(BLOCKS.shop));
    this.buildGate(mid(BLOCKS.gate));
    this.buildFountain(mid(BLOCKS.fountain));
    this.buildStash(mid(BLOCKS.stash));
    this.buildBoard(mid(BLOCKS.board));
    this.buildHouse(mid(BLOCKS.house1), 0xffd0e4, 0x8fd8ff);
    this.buildHouse(mid(BLOCKS.house2), 0xfff3a0, 0xff9a2e);
    // lamp posts (their flames share the scene's warm lamps)
    this.buildTownProps();
    for (const [x, z] of [P(8.6, 4), P(13.4, 4), P(8.6, 9.6), P(13.4, 9.6)]) {
      const g = new THREE.Group();
      g.position.set(x, 0, z);
      g.add(mesh(cyl('ksPost', 0.09, 0.12, 2.6, 8), toon(0x5a4a6a), 0, 1.3, 0));
      const flame = mesh(sph(0.22, 10, 8), toon(0xfff1a8, { emissive: 0xffaa00 }), 0, 2.75, 0, false);
      g.add(mesh(cone('ksLampHat', 0.32, 0.3, 6), toon(0x5a4a6a), 0, 3.05, 0, false), flame);
      L.add(g);
      this.torches.push({ x, z, flame, phase: x });
    }
    // the town portal (only shown while a floor waits for you)
    const p = this.makePortalMesh();
    p.position.set(PORTAL_AT.x, 0, PORTAL_AT.z);
    p.visible = false;
    L.add(p);
    this.townPortal = p;
  },

  /** Benches, barrels, crates, flower beds and bunting: a lived-in square. */
  buildTownProps() {
    const L = this.level;
    const bench = (x, z, ry) => {
      const g = new THREE.Group();
      g.position.set(x, 0, z);
      g.rotation.y = ry;
      g.add(mesh(rbox('ksBenchSeat', 1.8, 0.14, 0.55, 0.05), toon(0xc98b5a), 0, 0.5, 0));
      g.add(mesh(rbox('ksBenchBack', 1.8, 0.5, 0.12, 0.05), toon(0xb07848), 0, 0.85, -0.25));
      for (const s of [-1, 1]) g.add(mesh(bx('ksBenchLeg', 0.12, 0.5, 0.45), toon(0x5a4a6a), s * 0.75, 0.25, 0));
      L.add(g);
    };
    bench(...P(14.6, 7.2), Math.PI);
    bench(...P(7, 7.2), Math.PI);
    const barrel = (x, z) => {
      L.add(mesh(cyl('ksBarrel', 0.38, 0.38, 0.85, 12), toon(0xb07848), x, 0.43, z));
      for (const y of [0.18, 0.68]) L.add(mesh(cyl('ksBarrelBand', 0.4, 0.4, 0.07, 12), toon(0x6b6380), x, y, z, false));
    };
    barrel(...P(5.4, 1.6)); barrel(...P(5.6, 2.6));
    for (const [c, r, k] of [[16.4, 1.6, 0], [16.5, 2.6, 1]]) L.add(mesh(rbox('ksCrate', 0.7, 0.6, 0.7, 0.06), toon(k ? 0xc98b5a : 0xb07848), ...[wx(c), 0.3, wz(r)]));
    // flower beds by the houses and the gate
    const rand = seededRand(31);
    for (const [c, r] of [[3.4, 8.3], [3.4, 9.6], [18.6, 8.3], [18.6, 9.6], [8.2, 1.2], [13.8, 1.2]]) {
      const [x, z] = P(c, r);
      L.add(mesh(rbox('ksBed', 1.2, 0.25, 1.0, 0.08), toon(0x8a5a3a), x, 0.12, z, false));
      for (let i = 0; i < 4; i++) { const f = makeFlower(rand); f.position.set(x + (rand() - 0.5) * 0.8, 0.25, z + (rand() - 0.5) * 0.6); L.add(f); }
    }
    // bunting between the lamp posts over the square
    const flags = [0xff5d73, 0xffc93c, 0x3ddc97, 0x4cc9f0, 0x9b5de5];
    for (const [a, b] of [[P(8.6, 4), P(13.4, 4)], [P(8.6, 9.6), P(13.4, 9.6)]]) {
      const n = 8;
      for (let i = 0; i < n; i++) {
        const k = (i + 0.5) / n;
        const x = a[0] + (b[0] - a[0]) * k, z = a[1] + (b[1] - a[1]) * k;
        const fl = mesh(cone('ksFlag', 0.2, 0.36, 3), toon(flags[i % flags.length]), x, 2.55 - Math.sin(k * Math.PI) * 0.35, z, false);
        fl.rotation.x = Math.PI;
        L.add(fl);
      }
    }
  },

  buildSmith(b) {
    const g = new THREE.Group();
    g.position.set(b.x, 0, b.z);
    g.add(mesh(rbox('ksSmithWall', b.w - 0.6, 2.6, b.d - 0.8, 0.1), toon(0xf1d3a8), 0, 1.3, -0.2));
    const roof = mesh(sharedGeo('ksRoofS', () => new THREE.ConeGeometry(b.w * 0.62, 2.0, 4)), toon(0xc0504d), 0, 3.6, -0.2);
    roof.rotation.y = Math.PI / 4;
    roof.scale.z = 0.75;
    g.add(roof);
    g.add(mesh(bx('ksChimney', 0.8, 2, 0.8), toon(0x9a94b2), b.w * 0.25, 4, -0.8));
    // the open forge front with a warm glow
    g.add(mesh(bx('ksForge', 2.4, 1.6, 0.2), toon(0x5a4a6a), -1.6, 0.8, b.d / 2 - 0.55));
    g.add(mesh(bx('ksForgeGlow', 1.8, 0.9, 0.22), toon(0xffb347, { emissive: 0xff6a00 }), -1.6, 0.7, b.d / 2 - 0.5, false));
    g.add(mesh(rbox('ksDoor', 1.3, 2, 0.2, 0.1), toon(0x8a5a3a), 1.5, 1, b.d / 2 - 0.55));
    // anvil and a big hammer outside
    const anvil = new THREE.Group();
    anvil.position.set(-0.4, 0, b.d / 2 + 0.4);
    anvil.add(mesh(bx('ksAnvilBase', 0.5, 0.5, 0.4), toon(0x5a5470), 0, 0.25, 0), mesh(bx('ksAnvilTop', 1.0, 0.3, 0.5), toon(0x6b6380), 0, 0.62, 0));
    anvil.add(mesh(cone('ksAnvilHorn', 0.15, 0.4, 8), toon(0x6b6380), 0.65, 0.62, 0, false).rotateZ(-Math.PI / 2));
    g.add(anvil);
    this.signBoard(g, 0, 3.0, b.d / 2 - 0.4, 'smith');
    this.level.add(g);
    this.chimney = new THREE.Vector3(b.x + b.w * 0.25, 5.1, b.z - 0.8);
  },

  buildShop(b) {
    const g = new THREE.Group();
    g.position.set(b.x, 0, b.z);
    g.add(mesh(rbox('ksShopWall', b.w - 0.6, 2.6, b.d - 0.8, 0.1), toon(0xffd0e4), 0, 1.3, -0.2));
    const roof = mesh(sharedGeo('ksRoofP', () => new THREE.ConeGeometry(b.w * 0.62, 2.2, 4)), toon(0x8a45e0), 0, 3.7, -0.2);
    roof.rotation.y = Math.PI / 4;
    roof.scale.z = 0.75;
    g.add(roof);
    // counter with potions and a striped awning
    g.add(mesh(rbox('ksCounter', 3.4, 1.0, 0.8, 0.08), toon(0xc98b5a), 0, 0.5, b.d / 2 - 0.2));
    for (let i = 0; i < 5; i++) {
      const pc = [0xff5d73, 0x4cc9f0, 0x3ddc97, 0xffc93c, 0xff5d73][i];
      g.add(mesh(sph(0.18, 10, 8), toon(pc, { transparent: true, opacity: 0.9 }), -1.2 + i * 0.6, 1.15, b.d / 2 - 0.2, false));
      g.add(mesh(cyl('ksPotNeck2', 0.05, 0.06, 0.14, 6), toon(0xfff3dc), -1.2 + i * 0.6, 1.36, b.d / 2 - 0.2, false));
    }
    for (let i = 0; i < 6; i++) g.add(mesh(bx('ksAwning', 0.62, 0.08, 1.2), toon(i % 2 ? 0xffffff : 0xff5d73), -1.55 + i * 0.62, 2.35, b.d / 2 - 0.1, false).rotateX(0.3));
    this.signBoard(g, 0, 3.0, b.d / 2 - 0.4, 'shop');
    this.level.add(g);
  },

  buildGate(b) {
    const g = new THREE.Group();
    g.position.set(b.x, 0, b.z + 0.6);
    const stone = toon(0xd3c3ea), dark = toon(0x8a76c4);
    for (const s of [-1, 1]) {
      g.add(mesh(rbox('ksGatePillar', 1.4, 4.4, 1.4, 0.15), stone, s * 3, 2.2, 0));
      g.add(mesh(rbox('ksGateCap', 1.7, 0.4, 1.7, 0.12), dark, s * 3, 4.55, 0));
      // pillow-pile tops
      g.add(mesh(rbox('ksGatePillow', 1.4, 0.45, 1.0, 0.2), toon(s > 0 ? COLORS.candyPink : COLORS.candyBlue), s * 3, 5.0, 0));
    }
    const arch = mesh(sharedGeo('ksGateArch', () => new THREE.TorusGeometry(3, 0.55, 10, 24, Math.PI)), stone, 0, 4.0, 0);
    g.add(arch);
    const swirl = mesh(sharedGeo('ksGateSwirl', () => new THREE.CircleGeometry(2.5, 32, 0, Math.PI)), basic(0x9b5de5, { transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide }), 0, 4.0, 0, false);
    const lower = mesh(sharedGeo('ksGateLow', () => new THREE.PlaneGeometry(5, 4)), basic(0x9b5de5, { transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide }), 0, 2.0, 0, false);
    const spiral = mesh(sharedGeo('ksGateSpiral', () => new THREE.RingGeometry(0.6, 1.4, 24, 1, 0, Math.PI * 1.4)), basic(0xffffff, { transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide }), 0, 3.0, 0.05, false);
    g.add(swirl, lower, spiral);
    this.gateSpiral = spiral;
    for (const s of [-1, 1]) {
      const ban = mesh(bx('ksGateBanner', 0.9, 1.6, 0.06), toon(s > 0 ? 0xff5d73 : 0x4cc9f0), s * 3, 2.6, 0.74, false);
      g.add(ban);
    }
    this.signBoard(g, 0, 6.0, 0.3, 'gate');
    this.level.add(g);
  },

  buildFountain(b) {
    const g = new THREE.Group();
    g.position.set(b.x, 0, b.z);
    g.add(mesh(cyl('ksFountainRim', 2.0, 2.2, 0.6, 24), toon(0xd3c3ea), 0, 0.3, 0));
    g.add(mesh(cyl('ksFountainWater', 1.8, 1.8, 0.1, 24), toon(0x56c6f0, { transparent: true, opacity: 0.85 }), 0, 0.58, 0, false));
    g.add(mesh(cyl('ksFountainPost', 0.25, 0.3, 1.6, 10), toon(0xd3c3ea), 0, 1.2, 0));
    // a big golden feather on top
    const f = mesh(cone('ksBigFeather', 0.35, 1.6, 8), toon(COLORS.gold, { emissive: 0x3a2600 }), 0, 2.6, 0);
    f.scale.z = 0.35;
    f.rotation.z = 0.25;
    g.add(f);
    this.featherTop = f;
    this.level.add(g);
  },

  buildStash(b) {
    const g = new THREE.Group();
    g.position.set(b.x, 0, b.z);
    g.add(mesh(rbox('ksStash', 1.7, 0.9, 1.1, 0.08), toon(0x9b5de5), 0, 0.45, 0));
    g.add(mesh(rbox('ksStashLid', 1.75, 0.4, 1.15, 0.15), toon(0xb57bff), 0, 1.05, 0));
    g.add(mesh(bx('ksStashBand', 1.8, 0.12, 1.2), toon(COLORS.gold), 0, 0.6, 0, false));
    g.add(mesh(bx('ksStashLock', 0.3, 0.34, 0.1), toon(COLORS.gold, { emissive: 0x4a3000 }), 0, 0.8, 0.58, false));
    this.signBoard(g, 0, 2.1, 0, 'stash', 0.7);
    this.level.add(g);
  },

  buildLostChest(x, z) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.add(mesh(rbox('ksLost', 1.2, 0.7, 0.9, 0.08), toon(0x4cc9f0), 0, 0.35, 0));
    g.add(mesh(rbox('ksLostLid', 1.25, 0.3, 0.95, 0.12), toon(0x8fd8ff), 0, 0.8, 0));
    g.add(mesh(bx('ksLostBand', 1.3, 0.1, 1.0), toon(COLORS.gold), 0, 0.5, 0, false));
    this.level.add(g);
    const sg = { position: new THREE.Vector3(x, 0, z) };
    this.signBoard(sg, 0, 1.7, 0, 'lost', 0.7);
  },

  buildBoard(b) {
    const g = new THREE.Group();
    g.position.set(b.x, 0, b.z);
    for (const s of [-1, 1]) g.add(mesh(cyl('ksBoardLeg', 0.08, 0.08, 2.2, 6), toon(0x8a5a3a), s * 0.8, 1.1, 0));
    g.add(mesh(rbox('ksBoard', 2.0, 1.3, 0.12, 0.05), toon(0xc98b5a), 0, 1.6, 0));
    for (let i = 0; i < 3; i++) g.add(mesh(bx('ksNote', 0.5, 0.6, 0.02), toon([0xfff3dc, 0xffe47a, 0xffd0e4][i]), -0.6 + i * 0.6, 1.6, 0.08, false).rotateZ((i - 1) * 0.12));
    this.signBoard(g, 0, 2.7, 0, 'board', 0.7);
    this.level.add(g);
  },

  buildHouse(b, wall, roofC) {
    const g = new THREE.Group();
    g.position.set(b.x, 0, b.z);
    g.add(mesh(rbox(`ksHouse${wall}`, b.w - 0.8, 2.3, b.d - 0.8, 0.1), toon(wall), 0, 1.15, 0));
    const roof = mesh(sharedGeo('ksRoofH', () => new THREE.ConeGeometry(b.w * 0.6, 1.8, 4)), toon(roofC), 0, 3.2, 0);
    roof.rotation.y = Math.PI / 4;
    g.add(roof);
    g.add(mesh(rbox('ksHouseDoor', 1.0, 1.6, 0.15, 0.08), toon(0x8a5a3a), 0, 0.8, b.d / 2 - 0.4));
    for (const s of [-1, 1]) g.add(mesh(bx('ksWin', 0.7, 0.7, 0.12), toon(0xfff1a8, { emissive: 0x332200 }), s * 1.5, 1.4, b.d / 2 - 0.38, false));
    this.level.add(g);
  },

  /** A floating name sign above a station (an HTML label). */
  signBoard(g, x, y, z, id, s = 1) {
    const p = new THREE.Vector3(g.position.x + x, y, g.position.z + z);
    const el = this.game.ui.label('label');
    el.style.fontSize = s < 1 ? 'clamp(10px, 0.95vw, 15px)' : 'clamp(12px, 1.2vw, 19px)';
    el.style.color = '#8a45e0';
    this.signs.push({ el, pos: p, id });
  },

  // ---------------------------------------------------------------- townsfolk

  makeNpc(def) {
    const ch = new Character(def.color, { hat: def.hat });
    ch.group.position.set(def.home[0], 0, def.home[1]);
    if (def.id === 'smith') {
      const apron = mesh(rbox('ksApron', 0.6, 0.6, 0.1, 0.04), toon(0x8a5a3a), 0, 0.45, 0.4, false);
      ch.pivot.add(apron);
      const hammer = new THREE.Group();
      hammer.position.set(0.5, 0.5, 0.1);
      hammer.add(mesh(cyl('ksHammer', 0.04, 0.04, 0.6, 6), toon(0x8a5a3a), 0, 0.2, 0, false), mesh(bx('ksHammerHead', 0.3, 0.16, 0.16), toon(0x6b6380), 0, 0.5, 0, false));
      ch.pivot.add(hammer);
    } else if (def.id === 'fizz') {
      ch.pivot.add(mesh(sph(0.14, 10, 8), toon(0x3ddc97, { transparent: true, opacity: 0.85 }), 0.5, 0.55, 0.2, false));
    } else if (def.id === 'fluff') {
      const sh = mesh(sharedGeo('ksShield', () => new THREE.CylinderGeometry(0.42, 0.42, 0.14, 20)), toon(COLORS.candyPink), -0.5, 0.5, 0.1, false);
      sh.rotation.z = Math.PI / 2;
      sh.scale.setScalar(0.7);
      ch.pivot.add(sh);
    } else if (def.id === 'gumdrop') {
      ch.pivot.add(mesh(cyl('ksCake', 0.2, 0.22, 0.16, 12), toon(0xffd0e4), 0.45, 0.5, 0.3, false), mesh(sph(0.06), toon(0xff5d73), 0.45, 0.62, 0.3, false));
    }
    this.level.add(ch.group);
    const label = this.game.ui.label('label');
    label.style.display = 'none';
    const n = { ...def, ch, x: def.home[0], z: def.home[1], ti: 0, wp: 0, wait: 1 + Math.random() * 2, label, sayT: 0, html: '' };
    if (def.id === 'smith' || def.id === 'fizz') ch.face(0, 1);
    this.npcs.push(n);
    return n;
  },

  updateNpcs(dt) {
    const e = this.hero;
    for (const n of this.npcs) {
      const near = Math.hypot(e.x - n.x, e.z - n.z) < 3.2;
      let moving = 0;
      if (near || n.sayT > 0 || !n.route) {
        // stop and look at the hero when close
        if (near) n.ch.face(e.x - n.x, e.z - n.z);
        else if (!n.route) n.ch.face(0, 1);
      } else {
        n.wait -= dt;
        if (n.wait <= 0) {
          const [tx, tz] = n.route[n.wp];
          const dx = tx - n.x, dz = tz - n.z, d = Math.hypot(dx, dz);
          if (d < 0.2) { n.wp = (n.wp + 1) % n.route.length; n.wait = 1.5 + Math.random() * 3; } else {
            const sp = (n.id === 'tilly' ? 3.2 : 1.6) * dt;
            n.x += (dx / d) * Math.min(d, sp); n.z += (dz / d) * Math.min(d, sp);
            n.ch.face(dx, dz);
            moving = 1;
          }
        }
      }
      if (n.sleepy && !near && n.sayT <= 0 && Math.random() < dt * 0.6) this.puffs.burst(new THREE.Vector3(n.x + 0.3, 1.6, n.z), 0xc9a8ff, { count: 1, size: 0.2, life: 1.2, speed: 0.4 });
      n.ch.group.position.set(n.x, 0, n.z);
      n.ch.pivot.rotation.x = n.sleepy && !near && n.sayT <= 0 ? -0.35 : 0;
      n.ch.update(dt, { moving });
      n.sayT -= dt;
      const show = n.sayT > 0;
      if (show) {
        if (n.label.style.display === 'none') n.label.style.display = '';
        this.game.ui.place(n.label, new THREE.Vector3(n.x, 2.3, n.z), this.camera);
      } else if (n.label.style.display !== 'none') n.label.style.display = 'none';
    }
  },

  /** A speech bubble over a townsperson, read aloud in their own voice. */
  npcSay(id, text, secs = 5) {
    const n = this.npcs?.find((x) => x.id === id);
    if (!n) return;
    n.label.className = 'label';
    n.label.innerHTML = `<div class="ks-bubble"><b>${esc(t(`ks.npc.${id}`))}</b>${esc(text)}</div>`;
    n.label.style.display = '';
    n.sayT = secs;
    const pitch = { smith: 0.7, fizz: 1.3, fluff: 0.85, snore: 0.6, tilly: 1.6, gumdrop: 1.15 }[id] || 1;
    say(text, { pitch, rate: id === 'snore' ? 0.8 : 0.95 });
  },

  talkTo(n) {
    const i = n.ti % n.lines;
    n.ti++;
    const text = tFor(this.player, `ks.npc.${n.id}.${i}`, { name: this.player?.profileName || this.player?.name || '' });
    this.npcSay(n.id, text, Math.max(4, text.length / 14));
    this.game.audio.play('select');
  },

  // ---------------------------------------------------------------- what [A] does in town

  townAction() {
    const e = this.hero;
    let best = null, bd = Infinity;
    for (const s of this.stations) {
      const d = Math.hypot(e.x - s.x, e.z - s.z);
      if (d < s.r && d < bd) { bd = d; best = { kind: 'station', id: s.id }; }
    }
    for (const n of this.npcs) {
      const d = Math.hypot(e.x - n.x, e.z - n.z);
      if (n.id === 'smith' || n.id === 'fizz' || n.id === 'snore') continue; // their stations cover them
      if (d < 2.0 && d < bd) { bd = d; best = { kind: 'npc', n }; }
    }
    return best;
  },

  townPrompt() {
    const a = this.townAction();
    if (!a) return '';
    if (a.kind === 'npc') return tFor(this.player, 'ks.p.talk', { name: t(`ks.npc.${a.n.id}`) });
    return tFor(this.player, `ks.p.${a.id}`);
  },

  useTown() {
    const a = this.townAction();
    if (!a) return;
    if (a.kind === 'npc') { this.talkTo(a.n); return; }
    this.useStation(a.id);
  },

  /** Open a town station's panel (walked up to it, or clicked it). */
  useStation(id) {
    this.game.audio.play('select');
    switch (id) {
      case 'smith': this.openPanel('smith'); this.npcSay('smith', t('ks.npc.smith.hi')); break;
      case 'shop': this.openPanel('shop'); this.npcSay('fizz', t('ks.npc.fizz.hi')); break;
      case 'stash': this.openPanel('stash'); break;
      case 'board': this.openPanel('quests'); break;
      case 'gate': this.openPanel('gate'); break;
      case 'sage': this.openPanel('sage'); this.npcSay('snore', t('ks.npc.snore.hi')); break;
      case 'lost': this.openPanel('lost'); break;
      default: break;
    }
  },

  updateTown(dt) {
    this.updateNpcs(dt);
    if (this.gateSpiral) this.gateSpiral.rotation.z -= dt * 1.5;
    if (this.featherTop) this.featherTop.rotation.y += dt * 0.8;
    if (this.chimney && Math.random() < dt * 2) this.puffs.burst(this.chimney.clone(), 0xf2f2f2, { count: 1, speed: 0.4, up: 1.4, size: 0.45, life: 2.2, gravity: 0.6 });
    // the town portal back to the floor that waits
    const p = this.townPortal;
    p.visible = !!this.live;
    if (p.visible) {
      p.userData.spin.rotation.z += dt * 3;
      const e = this.hero;
      if (e.state === 'walk' && Math.hypot(e.x - PORTAL_AT.x, e.z - PORTAL_AT.z) < 1.0 && this.portalCd <= 0) this.backToLive();
    }
    for (const s of this.signs || []) {
      const txt = t(`ks.sign.${s.id}`);
      if (s.el.textContent !== txt) s.el.textContent = txt;
      this.game.ui.place(s.el, s.pos, this.camera);
    }
  },
};

// ---------------------------------------------------------------- town panels

/** The quest board: three quests; [A] claims a finished one, [C] swaps one for a new quest. */
export class QuestPanel {
  constructor(scene) {
    this.s = scene;
    this.nav = new Nav();
    this.i = 0;
    this.msg = '';
    this.el = document.createElement('div');
    this.el.className = 'ks-panel';
    scene.hud.layer.appendChild(this.el);
    this.render();
    const q = scene.hs.quests[0];
    if (q) say(questText(scene.hs, q));
  }

  render() {
    const hs = this.s.hs;
    const rows = hs.quests.map((q, i) => {
      const [a, b] = questProgress(hs, q);
      const done = a >= b;
      const rw = t('ks.q.reward', { coins: q.reward.coins, xp: q.reward.xp }) + (q.reward.item ? ` + ${t('ks.q.item')}` : '');
      return `<div class="ks-item ${i === this.i ? 'cur' : ''}">${skillIcon(done ? 'cheer' : 'talk')}<div class="grow">${esc(questText(hs, q))}<small>${esc(rw)}</small></div>
        ${done ? `<b style="color:#16a46a">${esc(t('ks.q.done'))}</b>` : `<span class="ks-prog"><i style="width:${Math.round(a / b * 100)}%"></i></span> ${q.kind === 'floor' ? '' : `${a}/${b}`}`}</div>`;
    }).join('');
    this.el.innerHTML = `<h2>${esc(t('ks.questTitle'))}<small>${esc(t('ks.questSub'))}</small></h2><div class="ks-list">${rows}</div>
      ${this.msg ? `<div class="ks-verdict good">${esc(this.msg)}</div>` : ''}<div class="foot">${esc(tFor(this.s.player, 'ks.hint.quests'))}</div>`;
  }

  claim() {
    const s = this.s, hs = s.hs, q = hs.quests[this.i];
    if (!q) return;
    if (!questDone(hs, q)) { this.msg = t('ks.q.notYet'); s.game.audio.play('bump'); this.render(); return; }
    hs.coins += q.reward.coins;
    s.addXp(q.reward.xp);
    let extra = '';
    if (q.reward.item) {
      const it = rollItem({ ilvl: s.D, rarity: rollRarity('quest', s.D), slot: SLOTS[Math.floor(Math.random() * SLOTS.length)], cls: s.cls, diff: hs.diff });
      if (s.bagGrid().add(it)) extra = ` + ${itemName(it)}`; else { hs.coins += 40; extra = ' + 40'; }
    }
    hs.quests.splice(this.i, 1, makeQuest(hs, hs.quests.map((x) => x.kind)));
    this.msg = t('ks.q.claimed', { coins: q.reward.coins }) + extra;
    s.game.audio.play('fanfare');
    say(this.msg);
    s.saveNow();
    this.render();
  }

  swap() {
    const s = this.s, hs = s.hs;
    hs.quests.splice(this.i, 1, makeQuest(hs, hs.quests.map((x) => x.kind)));
    this.msg = t('ks.q.swapped');
    s.game.audio.play('whoosh');
    say(questText(hs, hs.quests[this.i]));
    s.saveNow();
    this.render();
  }

  update(dt, d) {
    if (!d) return false;
    const st = this.nav.step(d, dt);
    if (st.y) {
      this.i = (this.i + st.y + this.s.hs.quests.length) % this.s.hs.quests.length;
      this.msg = '';
      this.s.game.audio.play('select');
      this.render();
      say(questText(this.s.hs, this.s.hs.quests[this.i]));
    }
    if (d.aPressed) this.claim();
    if (d.cPressed) this.swap();
    if (d.bPressed) { this.close(); return true; }
    return false;
  }

  close() { this.el.remove(); }
}

export function questText(hs, q) {
  if (q.kind === 'floor') return t('ks.q.floor', { where: whereText(q.n) });
  return t(`ks.q.${q.kind}`, { n: q.n });
}

/** The gate: every floor reached so far (acts in columns), and Deep Keep checkpoints. */
export class GatePanel {
  constructor(scene) {
    this.s = scene;
    this.nav = new Nav();
    this.cols = this.makeCols();
    // start on the deepest floor reached
    let best = { c: 0, r: 0 };
    this.cols.forEach((col, c) => col.list.forEach((wp, r) => { if (wp.on) best = { c, r }; }));
    this.c = best.c; this.r = best.r;
    this.el = document.createElement('div');
    this.el.className = 'ks-panel';
    scene.hud.layer.appendChild(this.el);
    this.render();
    say(t('ks.gateSay'));
  }

  makeCols() {
    const hs = this.s.hs;
    const cols = ACTS.map((a, i) => ({
      head: `${t('ks.act', { n: i + 1 })}: ${t(`ks.actName.${a.id}`)}`,
      list: Array.from({ length: ACT_FLOORS }, (_, f) => {
        const g = i * ACT_FLOORS + f;
        return { g, on: g <= hs.reached, name: t('ks.floorN', { n: f + 1 }), sub: f === ACT_FLOORS - 1 ? t(`ks.bossName.${a.boss}`) : '' };
      }),
    }));
    const deepOn = hs.bosses[ACT_COUNT - 1];
    const best = Math.max(1, hs.deepBest);
    const deep = [];
    for (let d = 1; d <= Math.max(1, best); d += DEEP_BOSS_EVERY) deep.push({ g: DEEP_START + d - 1, on: deepOn, name: t('ks.deepN', { n: d }), sub: '' });
    cols.push({ head: t('ks.deepName'), list: deep.slice(-3) });
    return cols;
  }

  render() {
    const hs = this.s.hs;
    const maxR = Math.max(...this.cols.map((c) => c.list.length));
    let html = this.cols.map((c) => `<div class="hd">${esc(c.head)}</div>`).join('');
    for (let r = 0; r < maxR; r++) {
      html += this.cols.map((col, c) => {
        const wp = col.list[r];
        if (!wp) return '<div></div>';
        const bag = hs.drop && hs.drop.g === wp.g;
        return `<div class="ks-wp ${c === this.c && r === this.r ? 'cur' : ''} ${wp.on ? '' : 'off'} ${bag ? 'bag' : ''}">${esc(wp.name)}${wp.sub ? `<small>${esc(wp.sub)}</small>` : ''}${bag ? `<small style="color:#b88a00">${esc(t('ks.bagHere'))}</small>` : ''}</div>`;
      }).join('');
    }
    const wp = this.cols[this.c].list[this.r];
    const note = wp && !wp.on ? t(isDeep(wp.g) ? 'ks.gateDeepLocked' : 'ks.gateLocked') : '';
    this.el.innerHTML = `<h2>${esc(t('ks.gateTitle'))}<small>${esc(t('ks.gateSub'))}</small></h2><div class="ks-gate">${html}</div>
      ${note ? `<div class="ks-verdict bad">${esc(note)}</div>` : ''}
      ${hs.drop ? `<div class="ks-pill" style="display:inline-block;margin-top:6px;background:#fffbe6">${esc(t('ks.bagNote', { where: whereText(hs.drop.g) }))}</div>` : ''}
      <div class="foot">${esc(tFor(this.s.player, 'ks.hint.gate'))}</div>`;
  }

  update(dt, d) {
    if (!d) return false;
    const st = this.nav.step(d, dt);
    if (st.x || st.y) {
      this.c = Math.max(0, Math.min(this.cols.length - 1, this.c + st.x));
      this.r = Math.max(0, Math.min(this.cols[this.c].list.length - 1, this.r + st.y));
      this.s.game.audio.play('select');
      this.render();
      const wp = this.cols[this.c].list[this.r];
      say(`${this.cols[this.c].head}. ${wp.name}`);
    }
    if (d.aPressed) {
      const wp = this.cols[this.c].list[this.r];
      if (!wp.on) { this.s.game.audio.play('bump'); return false; }
      this.close();
      this.s.enterFloor(wp.g);
      return true;
    }
    if (d.bPressed) { this.close(); return true; }
    return false;
  }

  close() { this.el.remove(); }
}

function seededRand(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = a;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}
