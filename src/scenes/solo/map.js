import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { COLORS, toon } from '../../core/palette.js';
import { makeTree, makeRock, makeBush, makeMushroom, seeded } from '../../core/world.js';
import { makeShip } from '../adventure/props.js';
import {
  mesh, box, cyl, ico, cone, WOOD, WOOD_DARK, makeCottage, makeStore, makeLighthouse, makeTent, makeBalloon, makeMine, makeRockfall,
  makeKeepTower, makeBurrow, makeCastleGate, makeHall, makeLaunchPad, makeBridge, makeFence, makeLamp, makeSign, makeBench, makeBarrel,
  makeCrate, makeMailbox, makeShippingBin, makeWell, makeFountain, makeNoticeBoard, makeBunting, makeCafe, makeBarn, makePier, makeBuoy,
  makeRowboat, makeTelescope, makeWaterfall, makeCrop,
} from './models.js';

// The hand-made island town. North is -z (the cliffs), south is +z (the beach and the dock), the camera
// looks north. A river runs from the waterfall in the cliffs down to the sea and cuts off the west bank
// (castle and keep) until the old bridge is repaired.
//
//   west bank (forest, castle gate, Pillow Keep) | river | home + farm, Aunt Hazel, kite hill (balloon),
//   village square (store, fountain, game hall), Pip's launch pad, fairground tent, mine in the cliffs,
//   grumble meadow (burrow), lighthouse point, beach with the café, the dock and the pirate ship.

const A = 60, B = 46; // island half size (super-ellipse)
export const SEA_Y = -0.45;
const CLIFF_H = 4.6;

export const RIVER = new THREE.CatmullRomCurve3([[-23, -48], [-23, -36], [-22, -28], [-24.5, -18], [-23, -6], [-26, 6], [-24, 18], [-28, 30], [-31, 42], [-33, 60]].map(([x, z]) => new THREE.Vector3(x, 0, z)));
const RIVER_W = 2.6;

export const cliffZ = (x) => -33 - 2 * Math.sin(x * 0.09);
const HILLS = [{ x: 8, z: -25.5, r: 8, h: 2.0 }, { x: -44, z: -6, r: 7, h: 1.0 }, { x: 40, z: 2, r: 6, h: 0.8 }];

// ---------- layout ----------

export const HOME = { x: -12, z: -15 };
export const FIELD = { x0: -18.25, z0: -8.5, cols: 8, rows: 6, size: 1.25 };
export const BIN = { x: -7.2, z: -11.6 };
export const MAILBOX = { x: -15, z: -11.2 };
export const WELL = { x: -5, z: -5.2 };
export const HAZEL_HOME = { x: -2, z: -27 };
export const PLAZA = { x: 12, z: -5, r: 7.5 };
export const STORE = { x: 12, z: -16.4 };
export const HALL = { x: 27, z: -15 };
export const PAD = { x: 40, z: -16 };
export const BRIDGE = { x: -24.2, z: -19, len: 11.5 };
export const ROCKFALL = { x: 26, z: -32.4 };
export const PIER = { x: 4, z0: 40.5, len: 19 };

/**
 * Game places. door: where you stand to enter. lock: an unlock flag in save.unlocks (closed until set).
 * key: game key in GAMES (or guest: a guest game name).
 */
export const PLACES = [
  { id: 'lighthouse', key: 'lighthouse', x: 44, z: 26.5, door: { x: 44, z: 30.2 } },
  { id: 'ship', key: 'adventure', x: 11.5, z: 54, door: { x: 5.2, z: 54 } },
  { id: 'tent', key: 'duckhunt', x: 34, z: 11.5, door: { x: 34, z: 15.4 } },
  { id: 'balloon', key: 'platformer', x: 8, z: -26, door: { x: 8, z: -23.8 } },
  { id: 'mine', key: 'cave', x: 26, z: cliffZ(26) - 0.2, door: { x: 26, z: -31.6 }, lock: 'mine' },
  { id: 'keep', key: 'keep', x: -45, z: 7.5, door: { x: -45, z: 11.4 }, lock: 'bridge' },
  { id: 'castle', key: 'castle', opts: { mode: 'campaign' }, x: -44, z: -25, door: { x: -44, z: -22.6 }, lock: 'bridge' },
  { id: 'burrow', key: 'guides', x: 47, z: -23, door: { x: 47, z: -19.6 }, lock: 'burrow' },
  // the four arcade cabinets in the game hall (filled in by build)
  ...['tachyon', 'starlite', 'foothold', 'starhop'].map((g, i) => ({ id: g, key: g, guest: g, x: HALL.x - 3.9 + i * 2.6, z: HALL.z - 1.2, door: { x: HALL.x - 3.9 + i * 2.6, z: HALL.z + 0.2 }, cabinet: i })),
];

// Paths (smoothed): dirt roads between the places. NPCs walk on these.
const PATHS = [
  [[-12, -12.2], [-11, -10.4], [-6, -10.2], [0, -9.2], [5.5, -7.2]],
  [[12, -12.4], [12, -9]],
  [[18.5, -6], [24, -9.5], [27, -12.2]],
  [[24, -9.5], [33, -10.5], [40, -13]],
  [[12.5, 2.3], [10, 10], [6.5, 22], [4.5, 33], [4, 41]],
  [[10, 10], [20, 13.5], [30, 15.6], [34, 15.6]],
  [[34, 15.6], [40, 20], [43, 26], [44, 30.2]],
  [[7, -11], [5.5, -17], [8, -23.6]],
  [[5.5, -17], [0, -21.5], [-2, -24.6]],
  [[-6, -10.2], [-6.4, -16.5], [-10, -19.6], [-18.6, -19.2]],
  [[-29.8, -19.2], [-37, -19.2], [-42, -21.6], [-44, -22.6]],
  [[-37, -19.2], [-38, -8], [-42, 4], [-45, 11.4]],
  [[17.5, -9.5], [21, -20], [25, -26], [26, -31.6]],
  [[33, -10.5], [41, -14.5], [47, -19.6]],
  [[4.5, 38.5], [-4, 39], [-10, 39.4]],
];

// Named spots for NPC routines and props.
export const SPOTS = {
  hazelGarden: { x: 2.5, z: -24 }, hazelPorch: { x: -2.6, z: -24.4 }, farmFence: { x: -5.2, z: -7.8 },
  plazaBench: { x: 7.6, z: -1.2 }, plazaFountain: { x: 14.6, z: -2.4 }, plazaEast: { x: 17.4, z: -5 },
  storeCounter: { x: 13.4, z: -12.2 }, storeHome: { x: 9.4, z: -12.6 },
  lhDoor: { x: 42.4, z: 30.8 }, beach: { x: 18, z: 40 }, pier: { x: 3, z: 47 }, pierEnd: { x: 3.4, z: 56.5 },
  cafe: { x: -8.2, z: 41.2 }, shipDeck: { x: 4.6, z: 52 },
  pad: { x: 37.4, z: -12.4 }, hallFront: { x: 30.5, z: -11.2 }, hillTop: { x: 10.4, z: -26.4 }, rocket: { x: 38.6, z: -13.2 },
  meadow: { x: 44, z: -14 },
};

// Branch spots (wood for the bridge), quest finds and dive/fish spots for later.
export const BRANCHES = [[-2, -32], [16, -30], [34, -28], [-14, -26], [44, -10], [52, 14], [24, 26], [-16, 22], [-6, 18], [16, 30], [30, -2], [-18, 30]];
export const FINDS = { feather: { x: 37, z: -27 }, starmap: { x: 3.5, z: -29 }, lens: { x: -18, z: 41.5 } };
export const DIVE_SPOT = { x: -4, z: 55 };

// ---------- terrain ----------

const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// Sampled river for fast distance checks.
const RIVER_PTS = RIVER.getSpacedPoints(160).map((p) => ({ x: p.x, z: p.z }));
function distToPts(pts, x, z) {
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const dx = b.x - a.x, dz = b.z - a.z;
    const L = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / L));
    const d = Math.hypot(x - a.x - dx * t, z - a.z - dz * t);
    if (d < best) best = d;
  }
  return best;
}
export const riverDist = (x, z) => distToPts(RIVER_PTS, x, z);

/** 0 at the coast, growing inland (about 1 = 60 units); negative in the sea. */
function coast(x, z) {
  const a = Math.atan2(z, x);
  const wob = 1 + 0.035 * Math.sin(a * 5 + 1) + 0.02 * Math.sin(a * 11);
  const e = Math.pow(Math.abs(x) / (A * wob), 4) + Math.pow(Math.abs(z) / (B * wob), 4);
  return 1 - Math.pow(e, 0.25);
}

/** Ground height (without bridges or the pier). */
export function heightAt(x, z) {
  const c = coast(x, z);
  let h = c < 0 ? -1.2 + c * 18 : -1.2 + 1.2 * sstep(0, 0.11, c);
  if (c > 0.05) {
    // cliffs along the north
    const cz = cliffZ(x);
    h += CLIFF_H * sstep(cz + 0.6, cz - 0.6, z);
    for (const hl of HILLS) {
      const d = Math.hypot(x - hl.x, z - hl.z);
      if (d < hl.r) h += hl.h * (0.5 + 0.5 * Math.cos((d / hl.r) * Math.PI));
    }
  }
  // the river channel (also a gorge through the cliffs)
  const rd = riverDist(x, z);
  if (rd < RIVER_W + 1.4) {
    const k = sstep(RIVER_W + 1.4, RIVER_W - 0.4, rd);
    h = h * (1 - k) + -1.15 * k;
  }
  return h;
}

/** The terrain color at a point (vertex colors of the ground mesh). */
const _c = new THREE.Color();
function colorAt(x, z, h, out) {
  const c = coast(x, z);
  const n = Math.sin(x * 0.21 + Math.sin(z * 0.13) * 2) * Math.sin(z * 0.17 - x * 0.05) * 0.5 + 0.5;
  if (h < -0.62) out.set(0x7fc7c9).lerp(_c.set(0x3f9fc9), sstep(-0.62, -2.5, h));
  else if (c < 0.09 && h < 0.02) out.set(0xf7e1a6);
  else if (h > 0.4 && z < cliffZ(x) + 0.7 && h < CLIFF_H - 0.2) out.set(0xc2a98a).lerp(_c.set(0xa48d74), n);
  else if (riverDist(x, z) < RIVER_W + 0.9) out.set(0xe2d39a);
  else if (z < cliffZ(x)) out.set(0x7fc556).lerp(_c.set(0x6db34a), n);
  else out.set(0x92d85c).lerp(_c.set(0x7fcb52), n);
  if (c < 0.12 && c >= 0.09 && h < 0.02) out.lerp(_c.set(0xf7e1a6), 0.5);
  return out;
}

// ---------- baking static meshes ----------

/** Merge every mesh under root into one mesh per material (fast to draw). Meshes marked keep stay as they are. */
export function bake(root) {
  root.updateMatrixWorld(true);
  const groups = new Map();
  const keepers = [];
  root.traverse((o) => {
    if (!o.isMesh) return;
    if (o.userData.keep) { keepers.push(o); return; }
    const k = `${o.material.uuid}|${o.castShadow}`;
    if (!groups.has(k)) groups.set(k, { mat: o.material, cast: o.castShadow, geos: [] });
    let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
    g.applyMatrix4(o.matrixWorld);
    groups.get(k).geos.push(g);
  });
  const out = new THREE.Group();
  for (const { mat, cast, geos } of groups.values()) {
    const merged = mergeGeometries(geos, false);
    for (const g of geos) g.dispose();
    if (!merged) continue;
    const m = new THREE.Mesh(merged, mat);
    m.castShadow = cast;
    m.receiveShadow = true;
    out.add(m);
  }
  return { group: out, keepers };
}

// ---------- the world ----------

export class IslandMap {
  /** Builds the static world into scene. M: night materials. Dynamic bits are returned on this. */
  constructor(scene, M) {
    this.scene = scene;
    this.M = M;
    this.obstacles = []; // { x, z, r } circles, { x, z, hw, hd } boxes, { ax, az, bx, bz, r } segments
    this.decks = []; // walkable rectangles over water: { x0, x1, z0, z1, y, on: () => bool }
    this.lampSpots = [];
    this.chimneys = [];
    this.places = PLACES.map((p) => ({ ...p }));
    this.pathPts = PATHS.map((pts) => new THREE.CatmullRomCurve3(pts.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal').getSpacedPoints(Math.max(4, Math.round(this.lenOf(pts) / 0.6))).map((p) => ({ x: p.x, z: p.z })));
    this.statics = new THREE.Group();
    this.rand = seeded(2026);

    this.buildGround();
    this.buildPaths();
    this.buildTown();
    this.buildPlaces();
    this.buildFarmYard();
    this.buildBeach();
    this.roadLamps();
    this.buildNature();

    const { group, keepers } = bake(this.statics);
    this.scene.add(group);
    for (const k of keepers) { k.removeFromParent(); this.scene.add(k); }
    this.statics = null;
    this.buildGraph();
  }

  lenOf(pts) {
    let L = 0;
    for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    return L;
  }

  /** Put a static prop at (x, z) on the ground. */
  put(obj, x, z, rotY = 0, y = null) {
    obj.position.set(x, y ?? heightAt(x, z), z);
    obj.rotation.y = rotY;
    this.statics.add(obj);
    return obj;
  }

  /** A live (animated / changing) object at (x, z). */
  live(obj, x, z, rotY = 0, y = null) {
    obj.position.set(x, y ?? heightAt(x, z), z);
    obj.rotation.y = rotY;
    this.scene.add(obj);
    return obj;
  }

  boxObs(x, z, hw, hd, extra = {}) { const o = { x, z, hw, hd, ...extra }; this.obstacles.push(o); return o; }
  circObs(x, z, r, extra = {}) { const o = { x, z, r, ...extra }; this.obstacles.push(o); return o; }
  segObs(a, b, r = 0.25) { this.obstacles.push({ ax: a.x, az: a.z, bx: b.x, bz: b.z, r }); }

  pathDist(x, z) {
    let best = Infinity;
    for (const pts of this.pathPts) best = Math.min(best, distToPts(pts, x, z));
    return best;
  }

  buildGround() {
    const W = 170, D = 160;
    const geo = new THREE.PlaneGeometry(W, D, W, D);
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, 0, 6);
    const pos = geo.attributes.position;
    const cols = new Float32Array(pos.count * 3);
    const col = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const h = heightAt(x, z);
      pos.setY(i, h);
      colorAt(x, z, h, col);
      cols[i * 3] = col.r; cols[i * 3 + 1] = col.g; cols[i * 3 + 2] = col.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    geo.computeVertexNormals();
    const mat = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toon(0xffffff).gradientMap });
    const ground = new THREE.Mesh(geo, mat);
    ground.receiveShadow = true;
    this.scene.add(ground);

    const wmat = new THREE.MeshToonMaterial({ color: 0x56c6f0, transparent: true, opacity: 0.86, gradientMap: toon(0xffffff).gradientMap });
    this.water = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), wmat);
    this.water.rotation.x = -Math.PI / 2;
    this.water.position.y = SEA_Y;
    this.water.receiveShadow = true;
    this.scene.add(this.water);

    // cliff boulders, the waterfall and trees along the top
    for (let x = -58; x <= 58; x += 2.6) {
      if (Math.abs(x + 23) < 4.5 || Math.abs(x - 26) < 3.2) continue;
      const z = cliffZ(x) + 0.5;
      if (coast(x, z) < 0.04) continue;
      const r = makeRock(this.rand, 1.0 + this.rand() * 0.9);
      this.put(r, x + this.rand() - 0.5, z + this.rand() * 0.6, 0, heightAt(x, z) + 0.2);
    }
    const wx = -22.6, wz = cliffZ(-22.6);
    const fall = makeWaterfall(CLIFF_H + 0.6, 4.4);
    fall.position.set(wx, SEA_Y, wz - 0.2);
    fall.rotation.y = -0.05;
    this.scene.add(fall);
    this.waterfall = { x: wx, z: wz + 0.6 };
  }

  /** Street lamps every ~16 units along the longer roads (cozy at night). */
  roadLamps() {
    for (const k of [4, 5, 6, 9, 12, 13, 11]) {
      const pts = this.pathPts[k];
      for (let i = 14; i < pts.length - 8; i += 26) {
        const a = pts[i - 1], b = pts[i + 1];
        let dx = b.x - a.x, dz = b.z - a.z;
        const L = Math.hypot(dx, dz) || 1;
        const x = pts[i].x - (dz / L) * 1.7, z = pts[i].z + (dx / L) * 1.7;
        if (this.obstacles.some((o) => o.r !== undefined && o.x !== undefined && Math.hypot(o.x - x, o.z - z) < o.r + 0.8)) continue;
        this.lamp(x, z);
      }
    }
  }

  buildPaths() {
    const mat = toon(0xe0b57a);
    const edge = toon(0xc99a5e);
    for (const pts of this.pathPts) {
      for (const [w, m, lift] of [[2.5, edge, 0.04], [2.0, mat, 0.07]]) {
        const verts = [], idx = [];
        for (let i = 0; i < pts.length; i++) {
          const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
          let dx = b.x - a.x, dz = b.z - a.z;
          const L = Math.hypot(dx, dz) || 1;
          dx /= L; dz /= L;
          const p = pts[i];
          for (const s of [-1, 1]) {
            const x = p.x - dz * s * w / 2, z = p.z + dx * s * w / 2;
            verts.push(x, Math.max(heightAt(x, z), heightAt(p.x, p.z)) + lift, z);
          }
          if (i > 0) { const k = i * 2; idx.push(k - 2, k - 1, k, k - 1, k + 1, k); }
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
        g.setIndex(idx);
        g.computeVertexNormals();
        const msh = new THREE.Mesh(g, m);
        msh.receiveShadow = true;
        this.statics.add(msh);
        // round caps so path ends and joins look soft
        for (const p of [pts[0], pts[pts.length - 1]]) this.put(mesh(cyl(w / 2, w / 2, 0.05, 16), m, 0, 0, 0, false), p.x, p.z, 0, heightAt(p.x, p.z) + lift - 0.02);
      }
    }
  }

  buildTown() {
    const M = this.M;
    // village square: cobbles, fountain, benches, notice board, flower beds, lamps and bunting
    this.put(mesh(cyl(PLAZA.r, PLAZA.r + 0.2, 0.12, 40), 0xe9dcc4, 0, 0, 0, false), PLAZA.x, PLAZA.z, 0, 0.04);
    this.put(mesh(cyl(PLAZA.r - 0.6, PLAZA.r - 0.6, 0.13, 40), 0xf3e8d2, 0, 0, 0, false), PLAZA.x, PLAZA.z, 0, 0.05);
    for (let i = 0; i < 40; i++) {
      const a = this.rand() * Math.PI * 2, r = 2.6 + this.rand() * (PLAZA.r - 3.6);
      const s = mesh(cyl(0.3 + this.rand() * 0.2, 0.3, 0.05, 6), this.rand() < 0.5 ? 0xd9cbb2 : 0xe2d6c0, 0, 0, 0, false);
      this.put(s, PLAZA.x + Math.cos(a) * r, PLAZA.z + Math.sin(a) * r, this.rand() * 3, 0.13);
    }
    const fountain = makeFountain();
    this.live(fountain, PLAZA.x, PLAZA.z, 0, 0.05);
    this.fountain = fountain;
    this.circObs(PLAZA.x, PLAZA.z, 2.2);
    for (const [x, z, r] of [[7.2, -2.2, 0.9], [12, 1.6, Math.PI], [17.6, -1.2, -0.9]]) {
      this.put(makeBench(), x, z, r + Math.PI, 0.05);
      this.circObs(x, z, 0.8);
    }
    this.put(makeNoticeBoard(), 17.8, -9.8, -0.6, 0.05);
    this.boxObs(17.8, -9.8, 1.0, 0.4);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.5;
      const x = PLAZA.x + Math.cos(a) * (PLAZA.r - 0.3), z = PLAZA.z + Math.sin(a) * (PLAZA.r - 0.3);
      if (Math.abs(Math.sin(a) + 1) < 0.1) continue;
      this.lamp(x, z);
    }
    // flower beds
    for (const [x, z] of [[5.2, -9], [19.2, -1.5], [6, 0.5]]) this.flowerBed(x, z);
    // bunting across the square
    this.put(makeBunting({ x: 6.2, y: 3.3, z: -8.5 }, { x: 17.8, y: 3.3, z: -8.5 }), 0, 0, 0, 0);
    this.put(makeBunting({ x: 6.2, y: 3.3, z: -8.5 }, { x: 12, y: 3.3, z: 2.3 }), 0, 0, 0, 0);

    // the general store
    const store = makeStore(M);
    this.put(store, STORE.x, STORE.z);
    this.boxObs(STORE.x, STORE.z, 3.7, 2.5);
    this.chimneys.push(store.userData.chimney.clone().add(new THREE.Vector3(STORE.x, 0, STORE.z)));
    for (const sx of [-3.2, 3.2]) this.circObs(STORE.x + sx, STORE.z + 3.6, 0.25);
    for (const [x, z] of [[STORE.x - 2.1, STORE.z + 3.3], [STORE.x - 3.1, STORE.z + 3.3], [STORE.x + 2.1, STORE.z + 3.3], [STORE.x + 3.1, STORE.z + 3.3]]) this.circObs(x, z, 0.45);
    this.put(makeBarrel(), STORE.x + 4.3, STORE.z + 1.5);
    this.put(makeCrate(), STORE.x + 4.4, STORE.z + 0.5, 0.3);
    this.circObs(STORE.x + 4.3, STORE.z + 1.0, 0.8);

    // Aunt Hazel's cottage with her garden and chickens' coop
    const hz = makeCottage(M, { wall: 0xfff0f5, roof: 0x8ac926, w: 4.6, d: 3.6, h: 2.2, door: 0x4c8bd6 });
    this.put(hz, HAZEL_HOME.x, HAZEL_HOME.z);
    this.boxObs(HAZEL_HOME.x, HAZEL_HOME.z, 2.5, 2.0);
    this.chimneys.push(hz.userData.chimney.clone().add(new THREE.Vector3(HAZEL_HOME.x, 0, HAZEL_HOME.z)));
    for (let i = 0; i < 2; i++) {
      for (let k = 0; k < 3; k++) {
        const x = 3 + k * 1.3, z = -27.5 + i * 1.6;
        this.put(mesh(box(1.1, 0.16, 1.2), 0x7a4a2e, 0, 0.08, 0, false), x, z);
        this.put(makeCrop(['carrot', 'lettuce', 'tomato'][k], 3), x, z, this.rand() * 3, heightAt(x, z) + 0.16);
      }
    }
    this.boxObs(4.3, -26.7, 2.1, 1.5);
    this.put(makeFence({ x: 1.7, z: -24.9 }, { x: 7, z: -24.9 }, heightAt), 0, 0, 0, 0);
    this.segObs({ x: 1.7, z: -24.9 }, { x: 7, z: -24.9 });
    // washing line
    for (const x of [-6.4, -3.6 - 2.4]) this.put(mesh(cyl(0.05, 0.05, 2, 5), WOOD_DARK, 0, 1, 0), x, -23.2);
    this.put(mesh(cyl(0.015, 0.015, 2.8, 4), 0xffffff, 0, 1.9, 0, false).rotateZ(Math.PI / 2), -7.6, -23.2);
    for (const [x, c] of [[-8.4, 0xff9fd0], [-7.6, 0x8fd8ff], [-6.9, 0xffe47a]]) this.put(mesh(box(0.5, 0.6, 0.04), c, 0, 1.55, 0, false), x, -23.2);
    this.put(mesh(cyl(0.05, 0.05, 2, 5), WOOD_DARK, 0, 1, 0), -9, -23.2);
    this.circObs(-9, -23.2, 0.2);
    this.circObs(-6.2, -23.2, 0.2);
    // chicken coop
    this.put(makeCottage(M, { wall: 0xffe0b0, roof: 0xff5d73, w: 1.6, d: 1.3, h: 0.9, chimney: false, porch: false }), -7.5, -27.5);
    this.boxObs(-7.5, -27.5, 1.0, 0.85);

    // game hall
    const hall = makeHall(M, ['tachyon', 'starlite', 'foothold', 'starhop']);
    this.live(hall, HALL.x, HALL.z, 0, 0);
    this.hall = hall;
    this.boxObs(HALL.x, HALL.z - 2.5, 5.7, 0.35);
    for (const sx of [-1, 1]) this.boxObs(HALL.x + sx * 5.5, HALL.z, 0.35, 2.7);
    for (const c of hall.userData.cabinets) this.boxObs(HALL.x + c.x, HALL.z - 1.2, 0.7, 0.55);
    this.lamp(HALL.x - 6.6, HALL.z + 3.2);
    this.lamp(HALL.x + 6.6, HALL.z + 3.2);
    // Pip's launch pad
    const pad = makeLaunchPad();
    this.live(pad, PAD.x, PAD.z, 0, heightAt(PAD.x, PAD.z));
    this.pad = pad;
    this.circObs(PAD.x, PAD.z, 1.0);
    this.circObs(PAD.x + 2.6, PAD.z - 1.2, 0.6);
  }

  flowerBed(x, z) {
    this.put(mesh(cyl(1.1, 1.2, 0.3, 14), 0x9a6440, 0, 0.15, 0), x, z, 0, 0.04);
    this.put(mesh(cyl(1.0, 1.0, 0.05, 14), 0x6b4a3a, 0, 0.3, 0, false), x, z, 0, 0.04);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const f = makeFlower(this.rand);
      f.scale.setScalar(1.6);
      this.put(f, x + Math.cos(a) * 0.55, z + Math.sin(a) * 0.55, 0, 0.3);
    }
    this.circObs(x, z, 1.2);
  }

  lamp(x, z) {
    this.put(makeLamp(this.M), x, z);
    this.circObs(x, z, 0.3);
    this.lampSpots.push({ x, y: heightAt(x, z) + 3.0, z });
  }

  sign(x, z, color, rot = 0) {
    this.put(makeSign(color), x, z, rot);
    this.circObs(x, z, 0.3);
  }

  buildPlaces() {
    const M = this.M;
    const P = Object.fromEntries(this.places.map((p) => [p.id, p]));
    // lighthouse on its rocky point
    const lh = makeLighthouse(M);
    this.live(lh, P.lighthouse.x, P.lighthouse.z, 0, 0.1);
    this.lighthouse = lh;
    this.circObs(P.lighthouse.x, P.lighthouse.z, 2.6);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + 0.3;
      if (Math.sin(a) > 0.7) continue;
      const r = makeRock(this.rand, 0.9 + this.rand());
      this.put(r, P.lighthouse.x + Math.cos(a) * 4.2, P.lighthouse.z + Math.sin(a) * 4.0);
      this.circObs(P.lighthouse.x + Math.cos(a) * 4.2, P.lighthouse.z + Math.sin(a) * 4.0, 0.9);
    }
    this.put(makeBench(), 48.5, 30.5, -0.5);
    this.circObs(48.5, 30.5, 0.8);
    this.sign(46.6, 31.2, 0x1f7f8f);
    this.lamp(41.4, 30.6);
    // fairground tent
    const tent = makeTent(M);
    this.live(tent, P.tent.x, P.tent.z, 0, 0.02);
    this.tent = tent;
    this.circObs(P.tent.x, P.tent.z - 0.4, 2.7);
    this.boxObs(P.tent.x, P.tent.z + 2.4, 2.1, 0.35);
    this.put(makeBunting({ x: 29, y: 3.6, z: 15 }, { x: 31.6, y: 5.0, z: 12.2 }), 0, 0, 0, 0);
    this.put(makeBunting({ x: 39, y: 3.6, z: 15 }, { x: 36.4, y: 5.0, z: 12.2 }), 0, 0, 0, 0);
    for (const x of [29, 39]) { this.put(mesh(cyl(0.07, 0.07, 3.8, 6), 0xffffff, 0, 1.9, 0), x, 15); this.circObs(x, 15, 0.2); }
    this.sign(37.4, 16.6, 0x00d4e6);
    // Sky Hop balloon on kite hill + Pip's telescope and a bench
    const bal = makeBalloon();
    this.live(bal, P.balloon.x, P.balloon.z);
    this.balloon = bal;
    this.circObs(P.balloon.x, P.balloon.z, 1.0);
    this.put(makeTelescope(), 11.2, -27.4, -0.6);
    this.circObs(11.2, -27.4, 0.4);
    this.put(makeBench(), 4.8, -27.4, 0.4);
    this.circObs(4.8, -27.4, 0.8);
    this.sign(10.4, -22.6, 0x4cc9f0);
    this.lamp(5.4, -22.4);
    // the mine in the cliff and its rockfall
    const mine = makeMine();
    this.put(mine, P.mine.x, P.mine.z, 0, 0);
    this.boxObs(P.mine.x - 2.0, P.mine.z + 0.2, 0.3, 0.4);
    this.boxObs(P.mine.x + 2.0, P.mine.z + 0.2, 0.3, 0.4);
    this.circObs(P.mine.x + 2.6, P.mine.z + 2.6, 0.7);
    this.rockfall = this.live(makeRockfall(), P.mine.x, P.mine.z, 0, 0);
    this.rockObs = this.boxObs(ROCKFALL.x, ROCKFALL.z - 0.6, 1.9, 1.0, { rockfall: true });
    this.sign(29.4, -30.6, 0x565c8c);
    // west bank: castle gate and Pillow Keep
    this.put(makeCastleGate(), P.castle.x, P.castle.z);
    this.boxObs(P.castle.x, P.castle.z, 3.7, 1.1);
    this.sign(P.castle.x + 4.6, P.castle.z + 2.6, 0xd9a066);
    this.put(makeKeepTower(M), P.keep.x, P.keep.z);
    this.circObs(P.keep.x, P.keep.z, 2.6);
    this.circObs(P.keep.x - 2.0, P.keep.z + 2.2, 0.8);
    this.sign(P.keep.x + 3.4, P.keep.z + 3.4, 0xb79fd6);
    // the burrow (hidden until Mumble trusts you)
    this.burrow = this.live(makeBurrow(), P.burrow.x, P.burrow.z);
    this.burrowObs = this.circObs(P.burrow.x, P.burrow.z, 2.4, { burrow: true });
    // the river bridge: broken and fixed versions (one is shown)
    const by = 0.0;
    this.bridgeBroken = this.live(makeBridge(BRIDGE.len, true), BRIDGE.x, BRIDGE.z, 0, by);
    this.bridgeFixed = this.live(makeBridge(BRIDGE.len, false), BRIDGE.x, BRIDGE.z, 0, by);
    this.decks.push({ x0: BRIDGE.x - BRIDGE.len / 2 - 0.6, x1: BRIDGE.x + BRIDGE.len / 2 + 0.6, z0: BRIDGE.z - 1.2, z1: BRIDGE.z + 1.2, y: 0.38, bridge: true });
    this.sign(BRIDGE.x + BRIDGE.len / 2 + 1.0, BRIDGE.z + 2.0, 0xf3d9a4);
    // pirate ship at the dock
    const ship = makeShip();
    ship.scale.setScalar(1.25);
    this.live(ship, P.ship.x, P.ship.z, Math.PI / 2, SEA_Y - 0.1);
    this.ship = ship;
    this.boxObs(P.ship.x, P.ship.z, 1.6, 4.2);
    // gangplank
    const gp = mesh(box(3.6, 0.1, 0.9), WOOD, 0, 0, 0);
    gp.rotation.z = -0.15;
    this.put(gp, 7.4, 54, 0, 0.55);
    this.decks.push({ x0: PIER.x - 1.5, x1: PIER.x + 1.5, z0: PIER.z0 - 1.5, z1: PIER.z0 + PIER.len, y: 0.12 });
    this.decks.push({ x0: PIER.x + 1.4, x1: 8.6, z0: 53.4, z1: 54.6, y: 0.3 });
    this.sign(6.2, 41.5, 0x8e3b62);
  }

  buildFarmYard() {
    const M = this.M;
    const home = makeCottage(M, { wall: 0xfff3dc, roof: 0xff7a59, w: 5.2, d: 4, h: 2.5 });
    this.put(home, HOME.x, HOME.z);
    this.home = home;
    this.boxObs(HOME.x, HOME.z, 2.85, 2.2);
    this.chimneys.push(home.userData.chimney.clone().add(new THREE.Vector3(HOME.x, 0, HOME.z)));
    this.lamp(HOME.x + 3.4, HOME.z + 2.8);
    // field: soft dark grass underlay and a fence with a gate gap at the north side
    const F = FIELD, w = F.cols * F.size, d = F.rows * F.size;
    this.put(mesh(box(w + 0.6, 0.04, d + 0.6), 0x86c24e, 0, 0, 0, false), F.x0 + w / 2, F.z0 + d / 2, 0, 0.02);
    const x0 = F.x0 - 0.7, x1 = F.x0 + w + 0.7, z0 = F.z0 - 0.7, z1 = F.z0 + d + 0.7;
    const gate = F.x0 + w / 2;
    const fences = [[{ x: x0, z: z0 }, { x: gate - 1.4, z: z0 }], [{ x: gate + 1.4, z: z0 }, { x: x1, z: z0 }], [{ x: x1, z: z0 }, { x: x1, z: z1 - 2.4 }], [{ x: x0, z: z1 }, { x: x1, z: z1 }], [{ x: x0, z: z0 }, { x: x0, z: z1 }]];
    for (const [a, b] of fences) { this.put(makeFence(a, b, heightAt), 0, 0, 0, 0); this.segObs(a, b); }
    // mailbox, shipping bin, well, scarecrow
    this.mailbox = this.live(makeMailbox(), MAILBOX.x, MAILBOX.z, 0.3);
    this.circObs(MAILBOX.x, MAILBOX.z, 0.4);
    this.bin = this.live(makeShippingBin(), BIN.x, BIN.z, 0);
    this.boxObs(BIN.x, BIN.z, 0.8, 0.55);
    this.put(makeWell(), WELL.x, WELL.z);
    this.circObs(WELL.x, WELL.z, 1.1);
    const sc = new THREE.Group();
    sc.add(mesh(cyl(0.06, 0.06, 2.2, 5), WOOD_DARK, 0, 1.1, 0), mesh(cyl(0.04, 0.04, 1.6, 5), WOOD_DARK, 0, 1.5, 0).rotateZ(Math.PI / 2));
    sc.add(mesh(box(0.7, 0.8, 0.3), 0x4c8bd6, 0, 1.4, 0), mesh(ico(0.3, 1), 0xf3d9a4, 0, 2.1, 0), mesh(cyl(0.5, 0.5, 0.06, 12), 0xe2b06a, 0, 2.35, 0), mesh(cyl(0.25, 0.3, 0.3, 12), 0xe2b06a, 0, 2.5, 0));
    this.put(sc, x1 + 1.2, z1 - 1.0, -0.3);
    this.circObs(x1 + 1.2, z1 - 1.0, 0.4);
    this.put(makeBarrel(0x4cc9f0), WELL.x + 1.4, WELL.z + 0.6);
    this.circObs(WELL.x + 1.4, WELL.z + 0.6, 0.45);
    // the old paddock and barn (animals come later)
    const p0 = { x: -19.4, z: 2.6 }, p1 = { x: -8.6, z: 9.4 };
    for (const [a, b] of [[p0, { x: p1.x, z: p0.z }], [{ x: p1.x, z: p0.z }, p1], [p1, { x: p0.x, z: p1.z }], [{ x: p0.x, z: p1.z }, { x: p0.x, z: p0.z + 2.5 }]]) { this.put(makeFence(a, b, heightAt), 0, 0, 0, 0); this.segObs(a, b); }
    this.put(makeBarn(M), -14, 12.6, Math.PI);
    this.boxObs(-14, 12.6, 2.3, 1.9);
    this.put(mesh(box(1.4, 0.5, 0.6), WOOD, 0, 0.25, 0), -11, 4);
    this.circObs(-11, 4, 0.7);
    this.sign(-7.6, 4.2, 0xd94a4a);
    // home yard: flower beds and a bench
    this.flowerBed(HOME.x - 4.3, HOME.z + 1.0);
    this.put(makeBench(), HOME.x + 4.6, HOME.z + 0.4, -Math.PI / 2 + 0.3);
    this.circObs(HOME.x + 4.6, HOME.z + 0.4, 0.8);
  }

  buildBeach() {
    const M = this.M;
    const pier = makePier(PIER.len);
    this.put(pier, PIER.x, PIER.z0, 0, 0.05);
    this.lamp(PIER.x - 1.9, PIER.z0 + 1.2);
    this.put(makeLamp(M), PIER.x + 1.3, PIER.z0 + PIER.len - 0.6, 0, 0.12);
    this.lampSpots.push({ x: PIER.x + 1.3, y: 3.1, z: PIER.z0 + PIER.len - 0.6 });
    this.circObs(PIER.x + 1.3, PIER.z0 + PIER.len - 0.6, 0.3);
    for (const [x, z] of [[2.9, 44], [5.1, 50.3]]) { this.put(makeBarrel(), x, z, 0, 0.12); this.circObs(x, z, 0.45); }
    this.put(makeCrate(), 5.0, 45.6, 0.4, 0.12);
    this.circObs(5.0, 45.6, 0.5);
    this.boat = this.live(makeRowboat(), 0.6, 50, 0.2, SEA_Y + 0.05);
    for (const [x, z] of [[-4, 52], [-7.5, 56], [-1, 58]]) this.live(makeBuoy(), x, z, 0, SEA_Y);
    this.buoys = this.scene.children.slice(-3);
    // the Driftwood Café (closed, a restaurant for later) and the dive spot sign
    this.put(makeCafe(M), -10, 37.4);
    this.boxObs(-10, 37.4, 2.5, 1.9);
    for (const x of [-11.6, -8.4]) this.circObs(x, 40.4, 0.6);
    this.sign(-5.2, 40.6, 0x3ddc97);
    this.sign(-2, 42.6, 0xff5d73, 0.3);
    // a beach towel, parasol and sand castle
    this.put(mesh(box(1.2, 0.03, 2.0), 0xff9fd0, 0, 0.02, 0, false), 22, 40.5, 0.4);
    this.put(mesh(cyl(0.04, 0.04, 2.2, 5), 0xffffff, 0, 1.1, 0), 23.4, 39.8);
    this.put(mesh(cone(1.4, 0.6, 10), 0x4cc9f0, 0, 2.3, 0), 23.4, 39.8);
    this.circObs(23.4, 39.8, 0.25);
    const sandC = new THREE.Group();
    sandC.add(mesh(cyl(0.5, 0.6, 0.5, 8), 0xf0d48a, 0, 0.25, 0), mesh(cone(0.35, 0.5, 8), 0xf0d48a, 0, 0.75, 0), mesh(cyl(0.2, 0.25, 0.35, 6), 0xf0d48a, 0.6, 0.17, 0.2));
    this.put(sandC, 27, 38.5);
    this.circObs(27, 38.5, 0.6);
  }

  buildNature() {
    const r = this.rand;
    const clear = [
      { x: HOME.x, z: HOME.z + 2, r: 7 }, { x: FIELD.x0 + 5, z: FIELD.z0 + 3.75, r: 8 }, { x: PLAZA.x, z: PLAZA.z, r: PLAZA.r + 2 },
      { x: STORE.x, z: STORE.z, r: 6.5 }, { x: HALL.x, z: HALL.z, r: 8 }, { x: PAD.x, z: PAD.z, r: 5 }, { x: HAZEL_HOME.x + 2, z: HAZEL_HOME.z + 1, r: 7.5 },
      { x: 8, z: -25.5, r: 5 }, { x: -14, z: 7, r: 8 }, { x: -10, z: 38, r: 6 },
      ...this.places.map((p) => ({ x: p.x, z: p.z, r: 5.5 })),
    ];
    const ok = (x, z, pad = 0) => {
      const h = heightAt(x, z);
      if (h < -0.15 || coast(x, z) < 0.08) return false;
      if (z < cliffZ(x) + 1.6 && z > cliffZ(x) - 1.6) return false;
      if (riverDist(x, z) < RIVER_W + 1.6) return false;
      if (this.pathDist(x, z) < 2.2 + pad) return false;
      for (const c of clear) if (Math.hypot(x - c.x, z - c.z) < c.r + pad) return false;
      return true;
    };
    const trees = [];
    const tryTree = (x, z, s = 1, leaf = null) => {
      if (!ok(x, z, 0.4)) return;
      for (const t of trees) if (Math.hypot(t.x - x, t.z - z) < 2.4 * s) return;
      const tr = makeTree(r, s, leaf);
      this.put(tr, x, z, r() * 6);
      trees.push({ x, z });
      if (z > cliffZ(x)) this.circObs(x, z, 0.45 * s);
    };
    // dense forest on the west bank, light woods elsewhere, trees on the cliff tops
    for (let i = 0; i < 900; i++) {
      const x = -62 + r() * 124, z = -50 + r() * 96;
      let p;
      if (x < -27) p = 0.55;
      else if (z < cliffZ(x)) p = 0.35;
      else if (z < -24 && x > 14) p = 0.3;
      else if (x > 44 && z < 22) p = 0.22;
      else if (z > 18 && z < 34 && x < 0) p = 0.18;
      else p = 0.05;
      if (r() > p) continue;
      const pine = x < -27 && r() < 0.4;
      tryTree(x, z, 0.85 + r() * 0.5, pine ? [0x2f9e5a, 0x3fae4a] : null);
    }
    this.trees = trees;
    // undergrowth: bushes, flowers, rocks, mushrooms
    for (let i = 0; i < 520; i++) {
      const x = -60 + r() * 120, z = -48 + r() * 92;
      if (!ok(x, z, -1.0)) continue;
      const k = r();
      if (k < 0.45) {
        const f = makeFlower(r);
        f.scale.setScalar(1.4);
        this.put(f, x, z, r() * 6);
      } else if (k < 0.7) {
        this.put(makeBush(r, 0.9 + r() * 0.6), x, z, r() * 6);
      } else if (k < 0.85) {
        const rk = makeRock(r, 0.35 + r() * 0.5);
        this.put(rk, x, z, 0, heightAt(x, z) + 0.05);
      } else if (k < 0.92 && (x < -27 || z < -20)) {
        const m = makeMushroom(r() < 0.5 ? 0xff5d73 : 0xffc93c);
        m.scale.setScalar(0.5);
        this.put(m, x, z, r() * 6);
      } else {
        // grass tuft
        const g = new THREE.Group();
        for (let k2 = 0; k2 < 3; k2++) g.add(mesh(sharedTuft(), 0x6fbf4a, (k2 - 1) * 0.12, 0.18, (r() - 0.5) * 0.1, false).rotateZ((k2 - 1) * 0.35));
        this.put(g, x, z, r() * 6);
      }
    }
    // reeds along the river
    for (let i = 0; i < 70; i++) {
      const p = RIVER_PTS[Math.floor(r() * RIVER_PTS.length)];
      const a = r() * Math.PI * 2;
      const x = p.x + Math.cos(a) * (RIVER_W + 0.6), z = p.z + Math.sin(a) * (RIVER_W + 0.6);
      if (z < cliffZ(x) + 1 || coast(x, z) < 0.06 || Math.abs(z - BRIDGE.z) < 2.4) continue;
      const g = new THREE.Group();
      for (let k = 0; k < 3; k++) g.add(mesh(cyl(0.03, 0.03, 0.9, 4), 0x5fae3a, (k - 1) * 0.12, 0.3, 0, false));
      g.add(mesh(cyl(0.06, 0.06, 0.25, 6), 0x8a5a32, 0, 0.8, 0, false));
      this.put(g, x, z, r() * 3, heightAt(x, z) - 0.2);
    }
  }

  // ---------- NPC walking graph ----------

  buildGraph() {
    const nodes = [];
    const near = (x, z) => nodes.findIndex((n) => Math.hypot(n.x - x, n.z - z) < 1.6);
    const add = (x, z) => {
      let i = near(x, z);
      if (i < 0) { i = nodes.length; nodes.push({ x, z, to: new Set() }); }
      return i;
    };
    for (const pts of this.pathPts) {
      let prev = -1;
      for (let i = 0; i < pts.length; i += 3) {
        const k = add(pts[i].x, pts[i].z);
        if (prev >= 0 && prev !== k) { nodes[prev].to.add(k); nodes[k].to.add(prev); }
        prev = k;
      }
      const last = add(pts[pts.length - 1].x, pts[pts.length - 1].z);
      if (prev !== last) { nodes[prev].to.add(last); nodes[last].to.add(prev); }
    }
    // join paths whose ends touch other paths
    for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
      if (Math.hypot(nodes[i].x - nodes[j].x, nodes[i].z - nodes[j].z) < 2.4) { nodes[i].to.add(j); nodes[j].to.add(i); }
    }
    this.nodes = nodes;
  }

  nearestNode(x, z, eastOnly = true) {
    let best = 0, bd = Infinity;
    this.nodes.forEach((n, i) => {
      if (eastOnly && n.x < -20) return;
      const d = Math.hypot(n.x - x, n.z - z);
      if (d < bd) { bd = d; best = i; }
    });
    return best;
  }

  /** Waypoints from (x, z) to target along the paths (breadth-first by distance). */
  route(x, z, tx, tz) {
    const a = this.nearestNode(x, z), b = this.nearestNode(tx, tz);
    if (Math.hypot(tx - x, tz - z) < 6) return [{ x: tx, z: tz }];
    const dist = new Map([[a, 0]]), prev = new Map();
    const open = [a];
    while (open.length) {
      open.sort((i, j) => dist.get(i) - dist.get(j));
      const i = open.shift();
      if (i === b) break;
      for (const j of this.nodes[i].to) {
        if (this.nodes[j].x < -20) continue;
        const d = dist.get(i) + Math.hypot(this.nodes[i].x - this.nodes[j].x, this.nodes[i].z - this.nodes[j].z);
        if (d < (dist.get(j) ?? Infinity)) { dist.set(j, d); prev.set(j, i); open.push(j); }
      }
    }
    const out = [{ x: tx, z: tz }];
    let k = b;
    while (k !== undefined && k !== a) { out.unshift({ x: this.nodes[k].x, z: this.nodes[k].z }); k = prev.get(k); }
    out.unshift({ x: this.nodes[a].x, z: this.nodes[a].z });
    return out;
  }

  // ---------- collision ----------

  /** The deck under (x, z), if any (bridge only once repaired). */
  deckAt(x, z, bridgeOpen) {
    for (const d of this.decks) {
      if (d.bridge && !bridgeOpen) continue;
      if (x > d.x0 && x < d.x1 && z > d.z0 && z < d.z1) return d;
    }
    return null;
  }

  /** Ground height for walkers, including decks. */
  floorAt(x, z, bridgeOpen) {
    const d = this.deckAt(x, z, bridgeOpen);
    const h = heightAt(x, z);
    return d ? Math.max(h, d.y) : h;
  }

  /** Can a walker of radius r stand at (x, z)? state = { bridge, mine, burrow } from the save. */
  walkable(x, z, r, state) {
    const deck = this.deckAt(x, z, state.bridge);
    if (!deck) {
      if (heightAt(x, z) < -0.3) return false;
      if (z < cliffZ(x) + 1.0) return false;
    }
    for (const o of this.obstacles) {
      if (o.rockfall && state.mine) continue;
      if (o.burrow && !state.burrow) continue;
      if (o.hw !== undefined) {
        if (Math.abs(x - o.x) < o.hw + r && Math.abs(z - o.z) < o.hd + r) return false;
      } else if (o.ax !== undefined) {
        const dx = o.bx - o.ax, dz = o.bz - o.az;
        const L = dx * dx + dz * dz || 1;
        const t = Math.max(0, Math.min(1, ((x - o.ax) * dx + (z - o.az) * dz) / L));
        if (Math.hypot(x - o.ax - dx * t, z - o.az - dz * t) < o.r + r) return false;
      } else if (Math.hypot(x - o.x, z - o.z) < o.r + r) return false;
    }
    return true;
  }
}

/** A cheap low-poly flower (the shared one is too detailed for hundreds of copies). */
const FLOWER_COLS = [0xff7eb6, 0xffd23f, 0xffffff, 0xb08bff, 0xff8c42];
function makeFlower(rand) {
  const g = new THREE.Group();
  g.add(mesh(cyl(0.03, 0.03, 0.4, 4), 0x58b947, 0, 0.2, 0, false));
  const col = FLOWER_COLS[Math.floor(rand() * FLOWER_COLS.length)];
  const head = mesh(ico(0.13, 0), col, 0, 0.42, 0, false);
  head.scale.set(1, 0.45, 1);
  g.add(head, mesh(ico(0.06, 0), col === 0xffd23f ? 0xff8c42 : 0xffd23f, 0, 0.47, 0, false));
  return g;
}

function sharedTuft() {
  return cyl(0.0, 0.05, 0.4, 3);
}
