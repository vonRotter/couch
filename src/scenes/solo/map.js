import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { COLORS, toon } from '../../core/palette.js';
import { makeTree, makeRock, makeBush, makeMushroom, seeded } from '../../core/world.js';
import { makeShip } from '../adventure/props.js';
import {
  mesh, box, cyl, ico, cone, WOOD, WOOD_DARK, makeCottage, makeStore, makeLighthouse, makeTent, makeBalloon, makeMine, makeRockfall,
  makeKeepTower, makeBurrow, makeCastleGate, makeHall, makeLaunchPad, makeBridge, makeFence, makeLamp, makeSign, makeBench, makeBarrel,
  makeCrate, makeMailbox, makeShippingBin, makeWell, makeFountain, makeNoticeBoard, makeBunting, makeCafe, makeBarn, makePier, makeBuoy, makeDiveBoat,
  makeRowboat, makeTelescope, makeCrop, sph, roofGeo, makeBoardwalk,
} from './models.js';
import { isle2Height, ISLE2_SPOTS } from './isle2geo.js';
import { makeGarage } from './models5.js';
import { POND, inKeepClear, CLIFF_WALLS, WALL_R } from './hopdata.js';
import { makeSchool } from './school.js';
import { makeFerry } from '../ferry-model.js';

// The hand-made island town. North is -z (the cliffs), south is +z (the beach and the dock), the camera
// looks north. A river runs from the waterfall in the cliffs down to the sea and cuts off the west bank
// (castle and keep) until the old bridge is repaired.
//
//   west bank (forest, castle gate, Pillow Keep) | river | home + farm, Aunt Hazel, kite hill (balloon),
//   village square (store, fountain, game hall), Pip's launch pad, fairground tent, mine in the cliffs,
//   grumble meadow (burrow), the mech garage on the east hill, lighthouse point, beach with the café,
//   the dock and the pirate ship.

const A = 60, B = 46; // island half size (super-ellipse)
export const SEA_Y = -0.45;
const CLIFF_H = 4.6;

export const RIVER = new THREE.CatmullRomCurve3([[-23, -48], [-23, -36], [-22, -28], [-24.5, -18], [-23, -6], [-26, 6], [-24, 18], [-28, 30], [-31, 42], [-33, 60]].map(([x, z]) => new THREE.Vector3(x, 0, z)));
export const RIVER_W = 2.6;

export const cliffZ = (x) => -33 - 2 * Math.sin(x * 0.09);
const HILLS = [{ x: 8, z: -25.5, r: 8, h: 2.0 }, { x: -44, z: -6, r: 7, h: 1.0 }, { x: 40, z: 2, r: 6, h: 0.8 }];

// ---------- layout ----------

export const HOME = { x: -12, z: -15 };
export const FIELD = { x0: -18.25, z0: -8.5, cols: 8, rows: 6, size: 1.25 };
// milestone B3: the greenhouse east of the farm (its beds are a second, small field) and the museum
export const GREENHOUSE = { x: 0.3, z: -3.6, w: 6.2, d: 4.6 };
export const GREEN = { x0: -2.2, z0: -5.4, cols: 4, rows: 2, size: 1.25, green: true };
export const MUSEUM = { x: 26, z: -2.8 };
export const BIN = { x: -7.2, z: -11.6 };
export const MAILBOX = { x: -15, z: -11.2 };
// (playtest round 3: the well and its barrel moved against the field fence, so a wide lane runs between the field and
// the greenhouse; they stood in the middle of it, and you had to walk all the way around the greenhouse)
export const WELL = { x: -6.35, z: -5.2 };
export const HAZEL_HOME = { x: -2, z: -27 };
export const PLAZA = { x: 12, z: -5, r: 7.5 };
export const STORE = { x: 12, z: -16.4 };
export const HALL = { x: 27, z: -15 };
export const PAD = { x: 40, z: -16 };
export const BRIDGE = { x: -24.2, z: -19, len: 11.5 };
export const ROCKFALL = { x: 26, z: -32.4 };
export const PIER = { x: 4, z0: 40.5, len: 19 };
// The Party Pier (ferry.js): a short jetty off the east side of the pier, near the beach, with the ferry to
// the shared island at its end (clear of the dive boat on the west side, the pirate ship and its gangplank
// further out, and Grumbleton's sailboat at the pier's end); the badge board stands on the beach by it.
export const FERRY = { x: 10.9, z: 47.2, y: -0.72, jetty: { x0: PIER.x + 1.45, x1: 8.4, z: 47.2, hw: 0.7 }, board: { x: 8.9, z: 42.1 } };
export const HILLS_LIST = HILLS;

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
  { id: 'keep', key: 'keepsolo', x: -45, z: 7.5, door: { x: -45, z: 11.4 }, lock: 'bridge' }, // Pillow Keep Solo (the co-op Pillow Keep stays on the shared island)
  { id: 'castle', key: 'castle', opts: { mode: 'campaign' }, x: -44, z: -25, door: { x: -44, z: -22.6 }, lock: 'bridge' },
  { id: 'burrow', key: 'guides', x: 47, z: -23, door: { x: 47, z: -19.6 }, lock: 'burrow' },
  { id: 'garage', key: 'breach', x: 46, z: 3.2, door: { x: 46, z: 6.8 } }, // Bean Brigade's mech garage on the east hill
  // the school house on the meadow south-west of the square: its door opens the learning games' picker (school.js)
  { id: 'school', key: 'school', school: true, x: -1.5, z: 16.2, door: { x: -1.5, z: 19.6 } },
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
  [[34, 15.6], [39.5, 11.8], [44, 8.4], [46, 6.8]], // to the mech garage
  [[-1.5, 19.8], [2.4, 20.9], [7.0, 20.4]], // to the school house
];

// Where each villager lives (milestone C): the door they walk to at bedtime (`spot` is the doorstep
// outside it). Homes are built and animated in homes.js; these numbers are shared with the schedules.
export const DEN = { x: 50.3, z: -17.6 }; // Mumble's own little den at the meadow (the big burrow is the game)
export const HOME_DOORS = {
  hazel: { spot: { x: -2, z: -24.0 } }, // her cottage on the hill
  rosa: { spot: { x: 12, z: -13.0 } }, // upstairs in the store
  bram: { spot: { x: 41.7, z: 29.0 } }, // the keeper's door on the lighthouse
  grumbleton: { spot: { x: 8.3, z: 54 } }, // the cabin hatch on his ship, at the top of the gangplank
  pip: { spot: { x: 40, z: -14.3 } }, // the rocket on the launch pad
  mumble: { spot: { x: DEN.x, z: DEN.z + 1.9 } },
  hoot: { spot: { x: 26, z: 1.1 } }, // the museum
  shelby: { spot: { x: 6.5, z: 189.5 } }, // her shell house on Shell Isle
  coach: { spot: { x: HALL.x - 6.4, z: HALL.z - 0.6 } }, // Coach Bo: a little door on the game hall's west wall
};

// Named spots for NPC routines and props.
export const SPOTS = {
  ...Object.fromEntries(Object.entries(HOME_DOORS).map(([id, h]) => [`${id}Home`, h.spot])),
  hazelGarden: { x: 2.5, z: -24 }, hazelPorch: { x: -2.6, z: -24.4 }, farmFence: { x: -5.2, z: -7.8 },
  plazaBench: { x: 7.6, z: -1.2 }, plazaFountain: { x: 14.6, z: -2.4 }, plazaEast: { x: 17.4, z: -5 },
  storeCounter: { x: 13.4, z: -12.2 }, storeHome: { x: 9.4, z: -12.6 },
  lhDoor: { x: 42.4, z: 30.8 }, beach: { x: 18, z: 40 }, pier: { x: 3, z: 47 }, pierEnd: { x: 3.4, z: 56.5 },
  cafe: { x: -8.2, z: 41.2 }, shipDeck: { x: 4.6, z: 52 },
  pad: { x: 37.4, z: -12.4 }, hallFront: { x: 30.5, z: -11.2 }, hillTop: { x: 10.4, z: -26.4 }, rocket: { x: 38.6, z: -13.2 },
  meadow: { x: 47, z: -11 },
  beachDay: { x: 16.5, z: 39.6 },
  museumDoor: { x: 23.4, z: 1.2 },
  hallCoach: { x: HALL.x - 3.4, z: HALL.z + 3.0 }, // Coach Bo by the game hall's open front
  ...ISLE2_SPOTS,
};

// Branch spots (wood for the bridge), quest finds and dive/fish spots for later. (One branch moved from the
// crowded kite hill to the emptier meadow south-west of the square; the save keeps branches by number.)
export const BRANCHES = [[-2, -32], [5.8, 12.4], [34, -28], [-14, -26], [44, -10], [52, 14], [24, 26], [-16, 22], [-6, 18], [16, 30], [30, -2], [-18, 30]];
/** Little spots for the emptier parts of the island (buildSpread); r: kept clear of spawns around them. */
export const SPREAD = [
  { id: 'picnic', x: 10.8, z: 29.8, r: 2.2 },
  { id: 'meadow', x: 3.6, z: 7.2, r: 2.6 },
  { id: 'berries', x: 1.6, z: 9.6, r: 1.2 }, // a wild berry bush: [B] picks a few berries once a day (island.js)
  { id: 'ring', x: 13.0, z: 16.8, r: 2.2 },
  { id: 'seaview', x: 33.4, z: 33.4, r: 1.4 },
  { id: 'birdbath', x: 42.5, z: 14.5, r: 1.6 },
  { id: 'woodpile', x: 29.6, z: -28.6, r: 2.0 },
  { id: 'sandcastle', x: 13.2, z: 37.6, r: 1.6 },
];
export const FINDS = { feather: { x: 37, z: -27 }, starmap: { x: 3.5, z: -29 }, lens: { x: -18, z: 41.5 } };
export const DIVE_SPOT = { x: -4, z: 55 };
export const DIVE_BOAT = { x: 0, z: 56.2 };
export const CAFE = { x: -10, z: 37.4 };
/** The boardwalk along the café's front, over the edge of the water (walkable). */
export const CAFE_WALK = { x0: -13.4, x1: -4.6, z0: 41.4, z1: 43.0 };
// the crab update: Crab Cove on the east beach, between the sandcastle and the lighthouse point (crabs.js)
export const CRAB_COVE = { x: 35.5, z: 36.1 };

// ---------- terrain ----------

const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// Sampled river for fast distance checks.
export const RIVER_PTS = RIVER.getSpacedPoints(160).map((p) => ({ x: p.x, z: p.z }));
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

/**
 * The waterfall (after the owner's playtest: it has to look whole). Behind the falling water the gorge is
 * filled up to the cliff top, and the upper river runs in a channel from a spring of boulders to the lip;
 * the water arcs over the lip and falls into the plunge pool. Under the arc, behind the falling sheet, is a
 * narrow slot at pool level where the grove's hidden steps climb (hopdata.js).
 */
export const FALL = { x: -22.6, z: cliffZ(-22.6) - 0.2, w: 4.6 }; // the falling sheet: center and width
export const UPPER = { y: 4.2, bed: 3.6, w: 2.55, zLip: -32.7, zFill: -32.5, zEnd: -40.2 }; // the upper river

/** Is (x, z) in the upper river's water (on the cliff top behind the waterfall)? */
export function inUpperWater(x, z) {
  if (z > UPPER.zLip || z < UPPER.zEnd || x < -30 || x > -16) return false;
  return riverDist(x, z) < UPPER.w - 0.1;
}

/** How steep the ground is at (x, z) (rise per meter; a cliff face is about 5, the hills are under 0.5). */
export function slopeAt(x, z) {
  const e = 0.12;
  return Math.hypot(heightAt(x + e, z) - heightAt(x - e, z), heightAt(x, z + e) - heightAt(x, z - e)) / (2 * e);
}

/** Ground height (without bridges or the pier). */
export function heightAt(x, z) {
  let h = baseHeight(x, z);
  // behind the waterfall: the gorge filled up to the cliff top, with the upper river's channel in it
  if (z < UPPER.zFill && z > -47 && x > -30 && x < -16) {
    const rd = riverDist(x, z);
    if (rd < RIVER_W + 1.4) {
      const kf = sstep(UPPER.zFill, UPPER.zFill - 0.5, z);
      const kc = sstep(UPPER.w + 0.9, UPPER.w - 0.25, rd) * sstep(UPPER.zEnd - 0.7, UPPER.zEnd + 0.3, z);
      const top = uncarved(x, z);
      h = h * (1 - kf) + (top * (1 - kc) + UPPER.bed * kc) * kf;
    }
  }
  // the pond south of the square (with stepping stones, see hopdata.js)
  const pd = Math.hypot(x - POND.x, z - POND.z);
  if (pd < POND.r + 0.8) { const k = sstep(POND.r + 0.8, POND.r - 0.6, pd); return h * (1 - k) + -1.15 * k; }
  return h;
}

/** The land before the river was cut into it (coast, cliffs, hills). */
function uncarved(x, z) {
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
  return h;
}

/** The terrain before the pond was dug (the random trees and flowers are still placed by it, so they stay put). */
function baseHeight(x, z) {
  if (z > 120) return isle2Height(x, z); // Shell Isle, far to the south (milestone B3)
  let h = uncarved(x, z);
  // the river channel (also a gorge through the cliffs)
  const rd = riverDist(x, z);
  if (rd < RIVER_W + 1.4) {
    const k = sstep(RIVER_W + 1.4, RIVER_W - 0.4, rd);
    h = h * (1 - k) + -1.15 * k;
  }
  return h;
}

/** Is (x, z) sandy beach (on the main island or Shell Isle)? For crabs digging up treasure. */
export function isSand(x, z) {
  const h = heightAt(x, z);
  if (z > 120) return h > -0.6 && h < 0.15;
  return h > -0.6 && h < 0.03 && colorAt(x, z, h, _sandC).r > 0.55; // the sand (or the sandy rim) of the beach
}
const _sandC = new THREE.Color();

/** The terrain color at a point (vertex colors of the ground mesh). */
const _c = new THREE.Color();
function colorAt(x, z, h, out) {
  const c = coast(x, z);
  const n = Math.sin(x * 0.21 + Math.sin(z * 0.13) * 2) * Math.sin(z * 0.17 - x * 0.05) * 0.5 + 0.5;
  if (h < -0.62) out.set(0x7fc7c9).lerp(_c.set(0x3f9fc9), sstep(-0.62, -2.5, h));
  else if (c < 0.09 && h < 0.02) out.set(0xf7e1a6);
  else if (h > 0.4 && z < cliffZ(x) + 0.7 && h < CLIFF_H - 0.2) out.set(0xc2a98a).lerp(_c.set(0xa48d74), n);
  else if (riverDist(x, z) < RIVER_W + 0.9 || Math.hypot(x - POND.x, z - POND.z) < POND.r + 0.7) out.set(0xe2d39a);
  else if (z < cliffZ(x)) out.set(0x7fc556).lerp(_c.set(0x6db34a), n);
  else out.set(0x92d85c).lerp(_c.set(0x7fcb52), n);
  if (c < 0.12 && c >= 0.09 && h < 0.02) out.lerp(_c.set(0xf7e1a6), 0.5);
  return out;
}

/** The ground's color at a point (as the island's ground mesh draws it), for the island map (atlas.js). */
export function groundColor(x, z, out = new THREE.Color()) {
  return colorAt(x, z, heightAt(x, z), out);
}

/** A villager's house gets its own window material (M.home[id], see homes.js) before it is baked. */
export function ownWindows(g, M, id) {
  const mat = M.home?.[id];
  if (mat) g.traverse((o) => { if (o.isMesh && o.material === M.win) o.material = mat; });
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
    this.plats = []; // obstacles you can also stand on: they have a top (see platform() and hopdata.js)
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
    this.baked = group; // seasons recolor its leaves (see seasonlook.js)
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

  /** A long thing turned by rotY (a bench, a board): a segment along its length, so its ends are not air. */
  longObs(x, z, rotY, half, r) {
    const c = Math.cos(rotY), sn = -Math.sin(rotY);
    this.segObs({ x: x - c * half, z: z - sn * half }, { x: x + c * half, z: z + sn * half }, r);
  }

  boxObs(x, z, hw, hd, extra = {}) { const o = { x, z, hw, hd, ...extra }; this.obstacles.push(o); return o; }
  circObs(x, z, r, extra = {}) { const o = { x, z, r, ...extra }; this.obstacles.push(o); return o; }
  segObs(a, b, r = 0.25) { this.obstacles.push({ ax: a.x, az: a.z, bx: b.x, bz: b.z, r }); }
  /** A wooden fence: in the way on foot, but you can jump up and balance along its top (or hop over it). */
  fenceObs(a, b) {
    const top = Math.max(heightAt(a.x, a.z), heightAt(b.x, b.z), heightAt((a.x + b.x) / 2, (a.z + b.z) / 2)) + 0.95;
    this.platform({ ax: a.x, az: a.z, bx: b.x, bz: b.z, r: 0.25, top, kind: 'fence' });
  }

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
    mat.userData = { noCut: true }; // (the see-through around the bean leaves the ground alone: seethrough.js)
    const ground = new THREE.Mesh(geo, mat);
    ground.receiveShadow = true;
    this.scene.add(ground);
    this.ground = ground;

    const wmat = new THREE.MeshToonMaterial({ color: 0x56c6f0, transparent: true, opacity: 0.86, gradientMap: toon(0xffffff).gradientMap });
    wmat.userData = { noCut: true };
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
    this.buildFalls(wmat);
    this.buildCliffFace();
    this.buildCliffWalls();
  }

  /**
   * The rock walls that close the cliff tops round the grove and the lookout (hopdata.js CLIFF_WALLS): tall
   * boulders shoulder to shoulder, from the foot of the cliff up the face and along the top. On the top they
   * stand two bean heights tall (a hop is one); on the face they are stacked up past the edge, so the line
   * reads as one wall from below and from above. The last boulder of a wall out to the sea sits on the edge and
   * hangs out over the water. They block along the whole line at any height (nothing to land on).
   */
  buildCliffWalls() {
    const rr = seeded(919); // (their own random numbers: the island's trees stay where they were)
    const boulder = (x, z, y0, y1, s) => {
      const rk = makeRock(rr, 1);
      const half = (y1 - y0) / 2;
      rk.scale.set(s * (0.95 + rr() * 0.2), half / 0.92, s * (0.95 + rr() * 0.2));
      rk.rotation.set((rr() - 0.5) * 0.3, rr() * 6, (rr() - 0.5) * 0.3); // (upright: a lying rock looks hoppable)
      this.put(rk, x, z, 0, y0 + half);
    };
    for (const w of CLIFF_WALLS) {
      let landY = 0;
      for (let i = 1; i < w.pts.length; i++) {
        const [ax, az] = w.pts[i - 1], [bx, bz] = w.pts[i];
        this.segObs({ x: ax, z: az }, { x: bx, z: bz }, WALL_R);
        const n = Math.max(1, Math.round(Math.hypot(bx - ax, bz - az) / 0.9));
        for (let k = i === 1 ? 0 : 1; k <= n; k++) {
          const x = ax + ((bx - ax) * k) / n + (rr() - 0.5) * 0.16, z = az + ((bz - az) * k) / n + (rr() - 0.5) * 0.16;
          const h = heightAt(x, z);
          if (h < SEA_Y + 0.2) {
            // out over the sea: one big boulder perched on the edge, hanging out over the water
            if (w.sea && i === w.pts.length - 1 && k === n) { const [ex, ez] = w.pts[i - 1]; boulder((ex + x) / 2, (ez + z) / 2, landY - 0.6, landY + 2.3, 1.25); }
            continue;
          }
          landY = h;
          const cz = cliffZ(x);
          const top = z > cz - 0.75 ? heightAt(x, cz - 0.9) : h; // (on the cliff face: the top of the cliff here)
          const y1 = Math.max(h, top) + 1.95 + rr() * 0.4;
          // stacked when tall (on the face): a boulder for every two meters or so
          const m = Math.max(1, Math.round((y1 - h + 0.3) / 2.3));
          for (let j = 0; j < m; j++) {
            const a = h - 0.3 + ((y1 - h + 0.3) * j) / m, b = h - 0.3 + ((y1 - h + 0.3) * (j + 1)) / m;
            boulder(x, z, a - (j ? 0.25 : 0), b, (j ? 0.78 : 0.92) + rr() * 0.14);
          }
        }
      }
    }
  }

  /**
   * A rocky face on the cliffs (the ground mesh alone made them look like a grassy slope you could walk up,
   * the owner's "invisible wall"): bands of rock from the foot to the top, left open at the waterfall and
   * the mine. Its foot is where the bean stops (the terrain gets too steep there).
   */
  buildCliffFace() {
    const rr = seeded(311);
    const pos = [], col = [];
    const C = [new THREE.Color(0xb7a189), new THREE.Color(0xa58f78), new THREE.Color(0x97836e), new THREE.Color(0x8fae6a)];
    const tmp = new THREE.Color();
    const cols = [];
    for (let x = -58; x <= 58.01; x += 1.0) {
      const cz = cliffZ(x);
      const open = Math.abs(x - FALL.x) < 3.2 || Math.abs(x - 26) < 2.3 || coast(x, cz) < 0.07;
      const top = heightAt(x, cz - 0.75);
      const base = heightAt(x, cz + 1.05) - 0.25;
      // four rows: the foot, two middles (bulging a little) and the top edge
      const rows = [[base, cz + 0.95], [base + (top - base) * 0.36, cz + 0.62], [base + (top - base) * 0.7, cz + 0.2], [top + 0.06, cz - 0.55]];
      cols.push(open ? null : rows.map(([y, z], j) => [x + (j % 3 ? (rr() - 0.5) * 0.35 : 0), y + (j === 1 || j === 2 ? (rr() - 0.5) * 0.3 : 0), z + (j === 1 || j === 2 ? rr() * 0.28 : 0)]));
    }
    for (let i = 1; i < cols.length; i++) {
      const a = cols[i - 1], b = cols[i];
      if (!a || !b) continue;
      for (let j = 0; j < 3; j++) {
        const quad = [a[j], b[j], b[j + 1], a[j + 1]];
        for (const [p, q, r] of [[0, 1, 2], [0, 2, 3]]) {
          tmp.copy(C[j === 2 && rr() < 0.25 ? 3 : Math.floor(rr() * 3)]).multiplyScalar(0.94 + rr() * 0.1);
          for (const k of [p, q, r]) { pos.push(...quad[k]); col.push(tmp.r, tmp.g, tmp.b); }
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.computeVertexNormals(); // (not indexed: flat facets)
    const face = new THREE.Mesh(g, new THREE.MeshToonMaterial({ vertexColors: true, side: THREE.DoubleSide, gradientMap: toon(0xffffff).gradientMap }));
    face.receiveShadow = true;
    face.castShadow = true;
    face.userData.cliffFace = true;
    this.scene.add(face);
    this.cliffFace = face;
  }

  /**
   * The waterfall, whole: the upper river on the cliff top (a spring of boulders at its head), the water
   * arcing over the lip and falling into the plunge pool, foam at its foot. The falling water is its own
   * (fading) material: the camera's see-through fade includes it (island.js), so you see the bean behind it.
   */
  buildFalls(wmat) {
    const F = FALL, U = UPPER;
    // the upper river's surface: a ribbon along the river line, from the lip to the spring
    const pts = RIVER.getSpacedPoints(400).filter((p) => p.z <= U.zLip + 0.05 && p.z >= U.zEnd - 0.3);
    const verts = [], idx = [];
    pts.forEach((p, i) => {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      let dx = b.x - a.x, dz = b.z - a.z;
      const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L;
      const w = U.w + 0.15;
      verts.push(p.x - dz * w, U.y, p.z + dx * w, p.x + dz * w, U.y, p.z - dx * w);
      if (i > 0) { const k = i * 2; idx.push(k - 2, k, k - 1, k - 1, k, k + 1); } // (facing up)
    });
    const rg = new THREE.BufferGeometry();
    rg.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    rg.setIndex(idx);
    rg.computeVertexNormals();
    const upper = new THREE.Mesh(rg, wmat);
    upper.receiveShadow = true;
    this.scene.add(upper);
    // the falling water: a sheet that arcs over the lip and drops straight down to the pool
    const D = F.z - U.zLip, top = U.y + 0.03, bend = 0.8;
    const prof = [];
    for (let i = 0; i <= 6; i++) { const a = (i / 6) * Math.PI / 2; prof.push([Math.sin(a) * D, top - (1 - Math.cos(a)) * bend]); }
    for (let i = 1; i <= 4; i++) prof.push([D, top - bend - (i / 4) * (top - bend - SEA_Y)]);
    const sheetGeo = (w, nx, out = 0) => {
      const v = [], ix = [];
      for (let j = 0; j < prof.length; j++) for (let i = 0; i <= nx; i++) {
        const x = -w / 2 + (i / nx) * w;
        const wob = Math.sin(x * 2.3 + j * 0.9) * 0.05;
        v.push(x, prof[j][1], prof[j][0] + out + wob);
        if (i > 0 && j > 0) { const a = j * (nx + 1) + i, b = a - 1, c = a - (nx + 1), d = c - 1; ix.push(d, c, b, c, a, b); }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
      g.setIndex(ix);
      g.computeVertexNormals();
      return g;
    };
    const fall = new THREE.Group();
    const sheetMat = new THREE.MeshToonMaterial({ color: 0x9fe4ff, transparent: true, opacity: 0.86, side: THREE.DoubleSide, depthWrite: false, gradientMap: toon(0xffffff).gradientMap });
    sheetMat.userData = { fade: 0.86 };
    fall.add(new THREE.Mesh(sheetGeo(F.w, 10), sheetMat));
    // white streaks down the water, and a foamy curl along the lip
    const streakMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false });
    streakMat.userData = { fade: 0.7 };
    for (const [x, w] of [[-1.8, 0.14], [-1.05, 0.1], [-0.3, 0.16], [0.5, 0.1], [1.2, 0.14], [1.85, 0.1]]) {
      const m = new THREE.Mesh(sheetGeo(w, 1, 0.04), streakMat);
      m.position.x = x;
      fall.add(m);
    }
    const curl = new THREE.Mesh(cyl(0.16, 0.16, F.w + 0.1, 8), streakMat);
    curl.rotation.z = Math.PI / 2;
    curl.position.set(0, top - 0.02, 0.12);
    fall.add(curl);
    fall.position.set(F.x, 0, U.zLip);
    this.scene.add(fall);
    this.falls = { group: fall, mats: [sheetMat, streakMat], drops: [], t: 0 };
    // drops sliding down the sheet (they make it look like it is falling) and foam at its foot
    const dropMat = basicOwn(0xffffff, 0.85);
    for (let i = 0; i < 14; i++) {
      const d = new THREE.Mesh(sph(0.07, 6, 4), dropMat);
      d.scale.set(1, 3.2, 1);
      d.userData = { x: -F.w / 2 + 0.25 + ((i * 0.37) % 1) * (F.w - 0.5), k: (i * 0.29) % 1 };
      fall.add(d);
      this.falls.drops.push(d);
    }
    this.falls.prof = prof;
    const foamMat = basicOwn(0xffffff, 0.9);
    const foam = new THREE.Group();
    for (let i = 0; i < 11; i++) {
      const b = new THREE.Mesh(ico(0.42 + (i % 3) * 0.12, 1), foamMat);
      b.position.set(-F.w / 2 - 0.2 + i * (F.w + 0.4) / 10, SEA_Y + 0.05, D + 0.25 + (i % 2) * 0.35);
      b.scale.y = 0.45;
      foam.add(b);
    }
    const pool = new THREE.Mesh(sharedDisc(), basicOwn(0xe8fbff, 0.45));
    pool.rotation.x = -Math.PI / 2;
    pool.scale.set(F.w * 0.75, 1.9, 1);
    pool.position.set(0, SEA_Y + 0.03, D + 1.1);
    foam.add(pool);
    fall.add(foam);
    this.falls.foam = foam;
    this.waterfall = { x: F.x, z: F.z + 0.8 };
    // the spring: a heap of boulders at the head of the upper river (in the way, and you can see why)
    const rr = seeded(77); // (its own random numbers: the island's sequence, and so its trees, stays as it was)
    for (const [x, z, r] of [[-24.6, -40.6, 1.5], [-22.4, -41.2, 1.7], [-20.4, -40.5, 1.3], [-23.4, -42.9, 1.6], [-21.1, -42.6, 1.3], [-25.6, -42.2, 1.2]]) {
      const rk = makeRock(rr, r * 1.12);
      this.put(rk, x, z, 0, heightAt(x, z) + 0.1);
      this.circObs(x, z, r * 0.95);
    }
    // the plunge pool's west rim: big rocks (the west bank stays across the river until the bridge is fixed)
    for (let z = -26.4; z >= -31.4; z -= 1.0) {
      const x = -26.3 + Math.sin(z * 2.1) * 0.15;
      const rk = makeRock(rr, 0.95);
      this.put(rk, x, z, 0, heightAt(x, z) + 0.15);
      this.circObs(x, z, 0.75);
    }
    // and one in the corner of the slot behind the falls (no sliver of land to get stuck on)
    this.put(makeRock(rr, 0.7), -25.25, -31.9, 0, heightAt(-25.25, -31.9) + 0.1);
    this.circObs(-25.25, -31.9, 0.6);
  }

  /** The water of the falls slides down (called every frame from life.js). */
  updateFalls(dt) {
    const f = this.falls;
    if (!f) return;
    f.t += dt;
    const P = f.prof, n = P.length - 1;
    for (const d of f.drops) {
      d.userData.k = (d.userData.k + dt * 0.55) % 1;
      const u = d.userData.k * n, j = Math.min(n - 1, Math.floor(u)), t = u - j;
      d.position.set(d.userData.x, P[j][1] + (P[j + 1][1] - P[j][1]) * t, P[j][0] + (P[j + 1][0] - P[j][0]) * t + 0.06);
    }
    f.foam.children.forEach((b, i) => { if (b.geometry.type !== 'CircleGeometry') { const k = 1 + Math.sin(f.t * 5 + i * 1.7) * 0.15; b.scale.set(k, 0.45 * k, k); } });
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
      this.longObs(x, z, r + Math.PI, 0.62, 0.32);
    }
    this.put(makeNoticeBoard(), 17.8, -9.8, -0.6, 0.05);
    this.longObs(17.8, -9.8, -0.6, 0.8, 0.22);
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
    ownWindows(store, M, 'rosa'); // her windows go dark when she sleeps (homes.js)
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
    ownWindows(hz, M, 'hazel');
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
    this.fenceObs({ x: 1.7, z: -24.9 }, { x: 7, z: -24.9 });
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
    // (the walls end under the roof: up there you can walk over them, see hops.js)
    this.boxObs(HALL.x, HALL.z - 2.5, 5.7, 0.35, { top: 4.0 });
    for (const sx of [-1, 1]) this.boxObs(HALL.x + sx * 5.5, HALL.z, 0.35, 2.7, { top: 4.0 });
    for (const c of hall.userData.cabinets) this.boxObs(HALL.x + c.x, HALL.z - 1.2, 0.7, 0.55);
    this.lamp(HALL.x - 6.6, HALL.z + 3.2);
    this.lamp(HALL.x + 5.6, HALL.z + 3.4); // (not closing the gap between the hall and the crates up to its roof)
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
    this.longObs(48.5, 30.5, -0.5, 0.62, 0.32);
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
    this.longObs(4.8, -27.4, 0.4, 0.62, 0.32);
    this.sign(10.4, -22.6, 0x4cc9f0);
    this.lamp(5.4, -22.4);
    // the mine in the cliff and its rockfall
    const mine = makeMine();
    this.put(mine, P.mine.x, P.mine.z, 0, 0);
    // the frame posts end below the cliff top (up there you walk over them)
    this.boxObs(P.mine.x - 2.0, P.mine.z + 0.2, 0.3, 0.4, { top: 3.4 });
    this.boxObs(P.mine.x + 2.0, P.mine.z + 0.2, 0.3, 0.4, { top: 3.4 });
    this.circObs(P.mine.x + 2.6, P.mine.z + 2.6, 0.7);
    this.rockfall = this.live(makeRockfall(), P.mine.x, P.mine.z, 0, 0);
    this.rockObs = this.boxObs(ROCKFALL.x, ROCKFALL.z - 0.8, 1.6, 0.8, { rockfall: true }); // (the size of the rock pile)
    this.sign(29.4, -30.6, 0x565c8c);
    // west bank: castle gate and Pillow Keep
    this.put(makeCastleGate(), P.castle.x, P.castle.z);
    this.boxObs(P.castle.x, P.castle.z, 3.7, 1.1);
    this.sign(P.castle.x + 4.6, P.castle.z + 2.6, 0xd9a066);
    this.put(makeKeepTower(M), P.keep.x, P.keep.z);
    this.circObs(P.keep.x, P.keep.z, 2.6);
    this.circObs(P.keep.x - 2.0, P.keep.z + 2.2, 0.8);
    this.sign(P.keep.x + 3.4, P.keep.z + 3.4, 0xb79fd6);
    // Bean Brigade's mech garage with its lookout tower and practice board
    const gar = makeGarage(M);
    this.live(gar, P.garage.x, P.garage.z, 0);
    this.garage = gar;
    this.boxObs(P.garage.x, P.garage.z - 0.1, 2.6, 2.4);
    this.circObs(P.garage.x + 3.4, P.garage.z - 0.6, 0.9);
    // the practice board is a flat checker on the ground: you can walk onto it (it was a wall of air)
    this.platform({ x: P.garage.x - 3.3, z: P.garage.z + 1.6, hw: 0.9, hd: 0.9, top: heightAt(P.garage.x - 3.3, P.garage.z + 1.6) + 0.12 });
    this.sign(P.garage.x + 2.6, P.garage.z + 3.9, 0xff5d73);
    // the school house (school.js): live, so its bell can swing
    this.school = this.live(makeSchool(this.M), P.school.x, P.school.z, 0);
    this.boxObs(P.school.x, P.school.z, 3.2, 2.3);
    this.circObs(P.school.x + 3.8, P.school.z + 1.8, 0.2); // the flag pole
    this.circObs(P.school.x + 2.1, P.school.z + 3.0, 0.5); // the chalkboard easel
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
    this.lamp(HOME.x + 2.7, HOME.z + 3.0); // (a bean's width from the house corner and the shipping bin: playtest round 3)
    // field: soft dark grass underlay and a fence with a gate gap at the north side
    const F = FIELD, w = F.cols * F.size, d = F.rows * F.size;
    this.put(mesh(box(w + 0.6, 0.04, d + 0.6), 0x86c24e, 0, 0, 0, false), F.x0 + w / 2, F.z0 + d / 2, 0, 0.02);
    const x0 = F.x0 - 0.7, x1 = F.x0 + w + 0.7, z0 = F.z0 - 0.7, z1 = F.z0 + d + 0.7;
    const gate = F.x0 + w / 2;
    const fences = [[{ x: x0, z: z0 }, { x: gate - 1.4, z: z0 }], [{ x: gate + 1.4, z: z0 }, { x: x1, z: z0 }], [{ x: x1, z: z0 }, { x: x1, z: z1 - 2.4 }], [{ x: x0, z: z1 }, { x: x1, z: z1 }], [{ x: x0, z: z0 }, { x: x0, z: z1 }]];
    for (const [a, b] of fences) { this.put(makeFence(a, b, heightAt), 0, 0, 0, 0); this.fenceObs(a, b); }
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
    this.put(sc, x1 + 1.6, z1 - 1.0, -0.3); // (a bean's width from the fence end)
    this.circObs(x1 + 1.6, z1 - 1.0, 0.4);
    this.put(makeBarrel(0x4cc9f0), WELL.x - 0.65, WELL.z - 1.45); // (on the fence side of the well, out of the lane)
    this.circObs(WELL.x - 0.65, WELL.z - 1.45, 0.45);
    // the old paddock and barn (animals come later)
    const p0 = { x: -19.4, z: 2.6 }, p1 = { x: -8.6, z: 9.4 };
    for (const [a, b] of [[p0, { x: p1.x, z: p0.z }], [{ x: p1.x, z: p0.z }, p1], [p1, { x: p0.x, z: p1.z }], [{ x: p0.x, z: p1.z }, { x: p0.x, z: p0.z + 2.5 }]]) { this.put(makeFence(a, b, heightAt), 0, 0, 0, 0); this.fenceObs(a, b); }
    this.put(makeBarn(M), -14, 12.6, Math.PI);
    this.boxObs(-14, 12.6, 2.3, 1.9);
    this.circObs(-11, 4, 0.7);
    this.sign(-7.6, 4.2, 0xd94a4a);
    // home yard: flower beds and a bench (the bed stands a lane's width from the house: playtest round 3, the
    // cottage was walled in by it, the workbench, the lamp and the shipping bin)
    this.flowerBed(HOME.x - 5.7, HOME.z + 1.3);
    this.put(makeBench(), HOME.x + 4.6, HOME.z + 0.4, -Math.PI / 2 + 0.3);
    this.longObs(HOME.x + 4.6, HOME.z + 0.4, -Math.PI / 2 + 0.3, 0.62, 0.32);
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
    for (const [x, z] of [[-6, 52], [-8.5, 56.5], [-6.5, 60]]) this.live(makeBuoy(), x, z, 0, SEA_Y);
    // the dive boat moored at the pier end (fish from it, or dive from its ladder)
    this.diveBoat = this.live(makeDiveBoat(), DIVE_BOAT.x, DIVE_BOAT.z, 0, SEA_Y - 0.05);
    this.decks.push({ x0: DIVE_BOAT.x - 2.5, x1: DIVE_BOAT.x + 2.6, z0: DIVE_BOAT.z - 1.7, z1: DIVE_BOAT.z + 1.7, y: SEA_Y + 0.5, boat: true });
    this.boxObs(DIVE_BOAT.x + 0.3, DIVE_BOAT.z - 1.0, 0.65, 0.55);
    this.boxObs(DIVE_BOAT.x + 1.9, DIVE_BOAT.z - 1.3, 0.45, 0.25);
    this.circObs(DIVE_BOAT.x - 1.9, DIVE_BOAT.z - 1.1, 0.45);
    this.circObs(DIVE_BOAT.x + 2.2, DIVE_BOAT.z + 1.3, 0.15);
    this.buoys = this.scene.children.slice(-3);
    this.buildFerry();
    // the Driftwood Café (closed, a restaurant for later) and the dive spot sign
    this.put(makeCafe(M), -10, 37.4);
    this.boxObs(-10, 37.4, 2.5, 1.9);
    // a boardwalk along the café's front (playtest round 3: the counter, the stove and the specials board left
    // no way past on the water side, so you had to go round behind the café)
    const BW = CAFE_WALK;
    this.put(makeBoardwalk(BW.x1 - BW.x0, BW.z1 - BW.z0), (BW.x0 + BW.x1) / 2, (BW.z0 + BW.z1) / 2, 0, 0);
    this.decks.push({ ...BW, y: 0.1 });
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

  /** The Party Pier: the jetty, the ferry at its end and the badge board on the beach (ferry.js). */
  buildFerry() {
    const J = FERRY.jetty, len = J.x1 - J.x0;
    const jetty = new THREE.Group();
    const n = Math.round(len / 0.6);
    for (let i = 0; i < n; i++) jetty.add(mesh(box(0.54, 0.14, J.hw * 2), i % 3 === 1 ? 0xb87a48 : WOOD, 0.3 + i * (len / n), 0, 0));
    for (const sz of [-1, 1]) jetty.add(mesh(cyl(0.13, 0.15, 2.4, 8), WOOD_DARK, len - 0.2, -0.9, sz * (J.hw - 0.08)));
    for (const sz of [-1, 1]) jetty.add(mesh(cyl(0.1, 0.12, 0.5, 8), 0xff5d73, len - 0.2, 0.3, sz * (J.hw - 0.08)));
    this.put(jetty, J.x0, J.z, 0, 0.05);
    this.decks.push({ x0: J.x0 - 0.1, x1: J.x1, z0: J.z - J.hw, z1: J.z + J.hw, y: 0.12 });
    this.ferry = this.live(makeFerry(), FERRY.x, FERRY.z, 0, FERRY.y);
    // the badge board: a notice board with room for a colored disc per badge (ferry.js shows them)
    const board = new THREE.Group();
    for (const sx of [-0.88, 0.88]) board.add(mesh(box(0.14, 2.1, 0.14), WOOD_DARK, sx, 1.05, 0));
    board.add(mesh(box(1.9, 1.2, 0.1), 0x4c8bd6, 0, 1.45, 0.03), mesh(box(1.76, 1.06, 0.04), 0xfff3dc, 0, 1.45, 0.09, false));
    board.add(mesh(roofGeo(2.2, 0.6, 0.35), 0xff5d73, 0, 2.08, 0));
    const mats = new Map();
    board.userData.mat = (c) => { if (!mats.has(c)) mats.set(c, toon(c)); return mats.get(c); };
    board.userData.discs = [];
    for (let i = 0; i < 28; i++) {
      const m = mesh(cyl(0.09, 0.09, 0.04, 12), 0xffffff, -0.75 + (i % 7) * 0.25, 1.81 - Math.floor(i / 7) * 0.24, 0.12, false);
      m.rotation.x = Math.PI / 2;
      m.visible = false;
      board.add(m);
      board.userData.discs.push(m);
    }
    this.ferryBoard = this.live(board, FERRY.board.x, FERRY.board.z, -0.25);
    this.circObs(FERRY.board.x - 0.78, FERRY.board.z + 0.2, 0.15);
    this.circObs(FERRY.board.x + 0.78, FERRY.board.z - 0.2, 0.15);
    this.put(makeBunting({ x: J.x0 + 0.2, y: 1.6, z: J.z - 0.8 }, { x: J.x1 - 0.2, y: 1.9, z: J.z - 0.8 }, 0.25), 0, 0, 0, 0);
  }

  buildNature() {
    const r = this.rand;
    const clear = [
      { x: HOME.x, z: HOME.z + 2, r: 7 }, { x: FIELD.x0 + 5, z: FIELD.z0 + 3.75, r: 8 }, { x: PLAZA.x, z: PLAZA.z, r: PLAZA.r + 2 },
      { x: STORE.x, z: STORE.z, r: 6.5 }, { x: HALL.x, z: HALL.z, r: 8 }, { x: PAD.x, z: PAD.z, r: 5 }, { x: HAZEL_HOME.x + 2, z: HAZEL_HOME.z + 1, r: 7.5 },
      { x: 8, z: -25.5, r: 5 }, { x: -14, z: 7, r: 8 }, { x: -10, z: 38, r: 6 },
      ...this.places.map((p) => ({ x: p.x, z: p.z, r: 5.5 })),
      ...this.places.filter((p) => p.school).map((p) => ({ x: p.door.x, z: p.door.z + 3, r: 4 })), // a clear view of the school's door
    ];
    const ok = (x, z, pad = 0) => {
      const h = baseHeight(x, z);
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
      const rot = r() * 6;
      trees.push({ x, z });
      if (inKeepClear(x, z)) return; // (made all the same, so the random trees after it stay where they were)
      this.put(tr, x, z, rot);
      this.circObs(x, z, 0.45 * s); // (the trees on the cliff tops too: scenery round the grove and the lookout)
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
      // spots kept clear for the jumping content: the same random numbers are used, nothing is placed
      if (inKeepClear(x, z)) { const keep = this.statics; this.statics = new THREE.Group(); this.undergrowth(r, k, x, z); this.statics = keep; continue; }
      this.undergrowth(r, k, x, z);
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
    this.buildSpread();
  }

  /**
   * Little spots for the emptier parts of the island (the owner's playtest: some parts were crowded, some empty;
   * see SPREAD): a picnic with a bench by the pond, a wildflower meadow with a wild berry bush, a fairy ring, a
   * bench with a sea view, a birdbath, a woodpile under the cliffs and a sandcastle on the beach. Their own
   * random numbers, so the island's trees stay where they were.
   */
  buildSpread() {
    const rr = seeded(505);
    this.extras = [];
    const note = (id, x, z) => this.extras.push({ id, x, z });
    const flowers = (x, z, n, rad) => { for (let i = 0; i < n; i++) { const a = rr() * Math.PI * 2, d = Math.sqrt(rr()) * rad; const f = makeFlower(rr); f.scale.setScalar(1.3 + rr() * 0.4); this.put(f, x + Math.cos(a) * d, z + Math.sin(a) * d, rr() * 6); } };
    const tree = (x, z, s = 1) => { this.put(makeTree(rr, s), x, z, rr() * 6); this.circObs(x, z, 0.45 * s); };
    const bench = (x, z, rot) => { this.put(makeBench(), x, z, rot); this.longObs(x, z, rot, 0.62, 0.32); };
    for (const p of SPREAD) this.addKeepOut(p.x, p.z, p.r, `spread:${p.id}`);
    const S = Object.fromEntries(SPREAD.map((p) => [p.id, p]));
    // a picnic by the pond: a checked blanket, a basket and a bench looking at the water
    { const { x, z } = S.picnic;
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) this.put(mesh(box(0.4, 0.03, 0.4), (i + j) % 2 ? 0xff5d73 : 0xffffff, 0, 0.02, 0, false), x - 0.6 + i * 0.4, z - 0.6 + j * 0.4, 0, heightAt(x, z) + 0.01);
      const basket = new THREE.Group();
      basket.add(mesh(box(0.42, 0.26, 0.3), 0xc68a52, 0, 0.13, 0), mesh(new THREE.TorusGeometry(0.16, 0.025, 5, 12, Math.PI), 0x8a5a32, 0, 0.26, 0, false), mesh(sph(0.07, 8, 6), 0xff5d73, -0.1, 0.3, 0, false));
      this.put(basket, x + 0.35, z - 0.3, 0.4);
      bench(x + 0.6, z - 1.7, 0.75);
      flowers(x - 1.5, z + 1.2, 6, 0.9);
      note('picnic', x, z); }
    // a wildflower meadow with a wild berry bush (a few berries every day: island.js) and two trees
    { const { x, z } = S.meadow;
      flowers(x, z, 22, 2.4);
      tree(x - 3.0, z + 3.4, 1.05); tree(x + 3.2, z - 3.0, 0.95);
      const bb = S.berries;
      this.put(makeBush(rr, 1.25), bb.x, bb.z, rr() * 6);
      this.circObs(bb.x, bb.z, 0.55);
      note('meadow', x, z); note('berries', bb.x, bb.z); }
    // a fairy ring: little standing stones in a circle, mushrooms inside
    { const { x, z } = S.ring;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + 0.3, sx = x + Math.cos(a) * 1.7, sz = z + Math.sin(a) * 1.7;
        const st = makeRock(rr, 0.42); st.scale.y *= 2.4; this.put(st, sx, sz, 0, heightAt(sx, sz) + 0.35); this.circObs(sx, sz, 0.32);
      }
      for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2, m = makeMushroom(i % 2 ? 0xff5d73 : 0xffc93c); m.scale.setScalar(0.42); this.put(m, x + Math.cos(a) * 0.9, z + Math.sin(a) * 0.9, rr() * 6); }
      note('ring', x, z); }
    // a bench with a view of the sea, and a birdbath with flowers by the garage path
    { const { x, z } = S.seaview; bench(x, z, 0.1); flowers(x - 1.4, z - 0.8, 4, 0.6); note('seaview', x, z); }
    { const { x, z } = S.birdbath;
      const bath = new THREE.Group();
      bath.add(mesh(cyl(0.14, 0.2, 0.8, 8), 0xd9d4ee, 0, 0.4, 0), mesh(cyl(0.5, 0.3, 0.16, 12), 0xd9d4ee, 0, 0.86, 0), mesh(cyl(0.42, 0.42, 0.03, 12), 0x8fe0ff, 0, 0.94, 0, false));
      this.put(bath, x, z);
      this.circObs(x, z, 0.45);
      flowers(x, z, 10, 1.6);
      note('birdbath', x, z); }
    // a woodpile and a stump under the cliffs north-east of the store
    { const { x, z } = S.woodpile;
      const pile = new THREE.Group();
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3 - i; j++) pile.add(mesh(cyl(0.16, 0.16, 1.3, 7), WOOD, (j - (2 - i) / 2) * 0.34, 0.16 + i * 0.29, 0).rotateX(Math.PI / 2));
      this.put(pile, x, z, 0.2);
      this.boxObs(x, z, 0.6, 0.7);
      this.put(mesh(cyl(0.32, 0.38, 0.4, 9), WOOD, 0, 0.2, 0), x + 1.4, z + 0.6);
      this.circObs(x + 1.4, z + 0.6, 0.38);
      tree(x - 2.4, z - 1.2, 1.1); tree(x + 2.6, z - 2.0, 0.9);
      note('woodpile', x, z); }
    // a sandcastle and a starfish on the beach
    { const { x, z } = S.sandcastle;
      const c = new THREE.Group();
      c.add(mesh(cyl(0.6, 0.7, 0.5, 8), 0xf0d48a, 0, 0.25, 0), mesh(cone(0.4, 0.55, 8), 0xf0d48a, 0, 0.78, 0));
      for (const [dx, dz] of [[0.75, 0.2], [-0.7, 0.3]]) c.add(mesh(cyl(0.22, 0.27, 0.42, 6), 0xf0d48a, dx, 0.21, dz), mesh(cone(0.18, 0.3, 6), 0xff5d73, dx, 0.57, dz, false));
      this.put(c, x, z, 0.3);
      this.circObs(x, z, 0.85);
      const star = new THREE.Group();
      for (let i = 0; i < 5; i++) star.add(mesh(box(0.08, 0.04, 0.3), 0xff8c42, Math.sin((i / 5) * Math.PI * 2) * 0.12, 0.03, Math.cos((i / 5) * Math.PI * 2) * 0.12, false).rotateY((i / 5) * Math.PI * 2));
      this.put(star, x + 1.4, z + 0.9, 0.5);
      note('sandcastle', x, z); }
  }

  /** One random flower, bush, rock, mushroom or grass tuft (k picks which; uses r like before). */
  undergrowth(r, k, x, z) {
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

  /**
   * Can a walker of radius r stand at (x, z)? state = { bridge, mine, burrow, cafe } from the save.
   * feet: the walker's height (the jumping bean); without it the old flat rules hold (water and cliffs are
   * walls, and so is everything you could stand on).
   */
  walkable(x, z, r, state, feet = -Infinity) {
    return this.overlap(x, z, r, state, feet) <= 0;
  }

  /**
   * How deep a walker of radius r at (x, z) is inside something (0 or less: free; 9: a wall of terrain).
   * With feet (a height): terrain higher than a step is a wall (a cliff face, a steep bank: you see it), the
   * cliff tops are land (rock walls you can see close them round the grove and the lookout), and things with a
   * top you are above (feet over top - STEP) are not in the way.
   * Water is not a wall here (the bean decides: never walk into it, but you can jump over it).
   */
  overlap(x, z, r, state, feet = -Infinity) {
    const flat = feet === -Infinity;
    if (!this.deckAt(x, z, state.bridge)) {
      const h = heightAt(x, z);
      if (flat) {
        if (h < -0.3) return 9;
        if (z < cliffZ(x) + 1.0) return 9;
      } else if (h > feet + STEP) return 9; // a steep bank or a cliff face (on the cliff tops: the rock walls, no invisible walls)
    }
    let worst = 0;
    for (const o of this.obstacles) {
      if (o.rockfall && state.mine) continue;
      if (o.burrow && !state.burrow) continue;
      if (o.cafe && !state.cafe) continue;
      if (o.top !== undefined && (o.block === false || feet >= topOf(o, x, z) - STEP)) continue;
      if (o.bottom !== undefined && (flat || feet + 1.2 < o.bottom)) continue; // up in the air: only in the way up there
      const d = depth(o, x, z, r);
      if (d > worst) worst = d;
    }
    return worst;
  }

  /** Add something you can stand on (also an obstacle while you are below its top). See hopdata.js. */
  platform(o) {
    this.obstacles.push(o);
    this.plats.push(o);
    return o;
  }

  /**
   * What holds you up at (x, z) for feet at that height: { y, plat, water }. The ground (or a deck), or the
   * highest top under you that you can reach (no more than a step above your feet). Over water with nothing
   * under you: water (y is the water level).
   */
  supportAt(x, z, feet, state) {
    const deck = this.deckAt(x, z, state.bridge);
    const h = heightAt(x, z);
    let y = deck ? Math.max(h, deck.y) : h, plat = null;
    let water = !deck && h < -0.3;
    if (water) y = SEA_Y;
    else if (!deck && inUpperWater(x, z)) { water = true; y = UPPER.y; } // the upper river behind the waterfall
    for (const o of this.plats) {
      if (o.off || !inside(o, x, z, EDGE)) continue;
      const ty = topOf(o, x, z);
      if (ty > feet + STEP || (ty <= y && !water)) continue;
      if (ty > y || water) { y = ty; plat = o; water = false; }
    }
    return { y, plat, water };
  }

  // ---------- spawn spots ----------

  /** Doors and things you use (and where villagers stand): nothing that spawns may land on them. */
  buildKeepOut() {
    const K = this.keepOut = [];
    const add = (x, z, r, why) => K.push({ x, z, r, why });
    for (const p of this.places) add(p.door.x, p.door.z, 2.0, `door:${p.id}`);
    for (const [id, h] of Object.entries(HOME_DOORS)) add(h.spot.x, h.spot.z, 1.8, `home:${id}`);
    add(HOME.x, HOME.z + 2.7, 2.2, 'door:cottage');
    add(GREENHOUSE.x, GREENHOUSE.z + GREENHOUSE.d / 2 + 0.6, 2.4, 'door:greenhouse');
    for (const dx of [-1.6, 1.6]) add(GREENHOUSE.x + dx, GREENHOUSE.z, 2.4, 'greenhouse'); // its beds (nothing spawns inside)
    add(MUSEUM.x, MUSEUM.z + 3.9, 2.4, 'door:museum');
    add(STORE.x, STORE.z + 3.4, 2.4, 'door:store');
    add(BIN.x, BIN.z, 1.6, 'bin'); add(MAILBOX.x, MAILBOX.z, 1.4, 'mailbox'); add(WELL.x, WELL.z, 1.8, 'well');
    for (const [id, p] of Object.entries(SPOTS)) add(p.x, p.z, 1.2, `spot:${id}`);
    add(CRAB_COVE.x, CRAB_COVE.z, 2.5, 'crab cove');
    add(PIER.x, PIER.z0, 2.0, 'pier');
    add(FERRY.jetty.x1 - 0.8, FERRY.jetty.z, 1.6, 'ferry');
    add(FERRY.board.x, FERRY.board.z + 0.9, 1.4, 'ferry board');
  }

  /** Something else you use, added by the module that builds it (trail signs, chests, benches...). */
  addKeepOut(x, z, r, why) { (this.keepOut || (this.buildKeepOut(), this.keepOut)).push({ x, z, r, why }); }

  /**
   * Can something of radius r spawn at (x, z) (a visitor's balloon, a cart, a dig spot)? null when it can,
   * else why not: in the water, on a slope, on a path, in something, or on a door or a thing you use.
   */
  spotClear(x, z, r = 1) {
    if (!this.keepOut) this.buildKeepOut();
    const h = heightAt(x, z);
    if (h < -0.3 || inUpperWater(x, z)) return 'water';
    for (const [dx, dz] of [[r, 0], [-r, 0], [0, r], [0, -r]]) if (Math.abs(heightAt(x + dx, z + dz) - h) > 0.45 * r + 0.1 || heightAt(x + dx, z + dz) < -0.3) return 'slope';
    if (this.pathDist(x, z) < 1.25 + r) return 'path';
    if (this.overlap(x, z, r, { bridge: true }, -Infinity) > 0) return 'thing';
    for (const k of this.keepOut) if (Math.hypot(x - k.x, z - k.z) < k.r + r) return k.why;
    return null;
  }

  /** The nearest clear spot to (x, z) (searching outward), or the spot itself if nothing is found. */
  findSpot(x, z, r = 1) {
    if (!this.spotClear(x, z, r)) return { x, z };
    for (let d = 0.5; d < 12; d += 0.5) {
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI * 2, sx = x + Math.cos(a) * d, sz = z + Math.sin(a) * d;
        if (!this.spotClear(sx, sz, r)) return { x: sx, z: sz };
      }
    }
    return { x, z };
  }

  /** Where a crab or a little critter rests at (x, z): the ground, a deck, a solid top, or the water surface. */
  restY(x, z) {
    const s = this.supportAt(x, z, 99, { bridge: true });
    if (s.plat?.block === false) return this.floorAt(x, z, true); // (not up on a roof)
    return s.water ? s.y - 0.08 : s.y;
  }
}

// ---------- shapes of obstacles and platforms ----------

/** A step you walk up without jumping, and how far past an edge your middle can be while you still stand on it. */
export const STEP = 0.34;
export const EDGE = 0.26;

/** The top of a platform at (x, z) (a sloped roof has its own function). */
export function topOf(o, x, z) { return o.topAt ? o.topAt(x, z) : o.top; }

/** Is (x, z) on obstacle o grown by m? */
export function inside(o, x, z, m) {
  if (o.hw !== undefined) return Math.abs(x - o.x) < o.hw + m && Math.abs(z - o.z) < o.hd + m;
  if (o.ax !== undefined) return segDist(o, x, z) < o.r + m;
  return Math.hypot(x - o.x, z - o.z) < o.r + m;
}

function segDist(o, x, z) {
  const dx = o.bx - o.ax, dz = o.bz - o.az;
  const L = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((x - o.ax) * dx + (z - o.az) * dz) / L));
  return Math.hypot(x - o.ax - dx * t, z - o.az - dz * t);
}

/** How far a walker of radius r at (x, z) reaches into obstacle o (0 or less: not touching). */
function depth(o, x, z, r) {
  if (o.hw !== undefined) return Math.min(o.hw + r - Math.abs(x - o.x), o.hd + r - Math.abs(z - o.z));
  if (o.ax !== undefined) return o.r + r - segDist(o, x, z);
  return o.r + r - Math.hypot(x - o.x, z - o.z);
}

/** A fresh unlit see-through material (the waterfall's own, so it can fade). */
function basicOwn(color, opacity) {
  const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
  m.userData = { fade: opacity };
  return m;
}
const sharedDisc = () => new THREE.CircleGeometry(1, 24);

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
