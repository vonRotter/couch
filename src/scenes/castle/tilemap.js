import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { toon } from '../../core/palette.js';
import { seeded } from '../../core/world.js';

// Tile map for the Knights & Builders campaign: like the Versus map in castle.js, but any width,
// with water, castle gates and a memory of the original castle (grumble builders repair it).
// Column c spans world x [c, c+1); row r spans y [r, r+1). Row 0 is bedrock.

export const ROWS = 24;
export const EMPTY = 0, DIRT = 1, STONE = 2, CASTLE = 3, WOOD = 4, DOOR = 5, LADDER = 6, PAD = 7, BEDROCK = 8, WATER = 11, GATE = 12;
export const BLOCKY = new Set([DIRT, STONE, CASTLE, WOOD, BEDROCK]);
export const DIG_TIME = { [DIRT]: 0.45, [STONE]: 1.6, [CASTLE]: 2.0, [WOOD]: 0.4, [DOOR]: 0.55, [LADDER]: 0.25, [PAD]: 0.4 };
export const KNIGHT_HP = { [WOOD]: 3, [DOOR]: 4, [LADDER]: 1, [PAD]: 2 }; // sword hits to break enemy pieces
export const REFUND = { [WOOD]: 1, [DOOR]: 2, [LADDER]: 1, [PAD]: 2 };
export const STICKY = new Set([DIRT, WOOD, DOOR, PAD]); // arrows stick here and bounce off stone
const TILE_COLOR = { [DIRT]: 0xd99a62, [STONE]: 0xaaa4c6, [CASTLE]: 0xc9c0dd, [WOOD]: 0xe2a96b, [BEDROCK]: 0x6f6789 };
const TEAM_PANEL = [0xffc93c, 0x8a63f0]; // door colors: bean team, grumbles

const CHAR_TILE = { '#': DIRT, S: STONE, C: CASTLE, B: BEDROCK, w: WOOD, H: LADDER, D: DOOR, G: GATE, '~': WATER, p: PAD };

function box(w, h, d, x = 0, y = 0, z = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  return g;
}

export class TileMap {
  /** grid: from parseLevel() — { cols, chars[c][r], back[c][r] } */
  constructor(scene, grid) {
    this.scene = scene;
    this.cols = grid.cols;
    this.rows = ROWS;
    const N = this.cols * ROWS;
    this.tile = new Uint8Array(N);
    this.owner = new Int8Array(N).fill(-1);
    this.dmg = new Float32Array(N);
    this.orig = new Uint8Array(N); // the castle as built: grumble builders put CASTLE and DOOR cells back
    this.shade = new Float32Array(N);
    const rand = seeded(57);
    for (let i = 0; i < N; i++) this.shade[i] = 0.93 + rand() * 0.1;
    for (let c = 0; c < this.cols; c++) {
      for (let r = 0; r < ROWS; r++) {
        const ty = CHAR_TILE[grid.chars[c][r]] ?? EMPTY;
        const i = this.idx(c, r);
        this.tile[i] = ty;
        this.orig[i] = ty;
        // Castle doors and gates belong to the grumbles.
        this.owner[i] = ty === DOOR || ty === CASTLE || ty === GATE ? 1 : -1;
      }
    }
    this.back = grid.back;
    this.dirty = true;
    this.openDoors = new Set();
    this.doorKey = '';
    this.buildLayers();
  }

  idx(c, r) { return c * ROWS + r; }

  inside(c, r) { return c >= 0 && c < this.cols && r >= 0 && r < ROWS; }

  at(c, r) {
    if (c < 0 || c >= this.cols || r < 0) return BEDROCK;
    if (r >= ROWS) return EMPTY;
    return this.tile[this.idx(c, r)];
  }

  ownerAt(c, r) { return this.inside(c, r) ? this.owner[this.idx(c, r)] : -1; }

  /** Is this cell solid for a body (or arrow) of `team`? Doors only let their own team through. */
  solidFor(c, r, team) {
    const ty = this.at(c, r);
    if (ty === EMPTY || ty === LADDER || ty === WATER) return false;
    if (ty === DOOR) return this.ownerAt(c, r) !== team;
    return true;
  }

  /** Solid for everyone (doors count as solid). */
  solid(c, r) {
    const ty = this.at(c, r);
    return !(ty === EMPTY || ty === LADDER || ty === WATER);
  }

  set(c, r, ty, team = -1) {
    if (!this.inside(c, r)) return;
    const i = this.idx(c, r);
    this.tile[i] = ty;
    this.owner[i] = team;
    this.dmg[i] = 0;
    this.dirty = true;
  }

  /** Top row a body standing in column c above row `from` would land on (or -1 for water / nothing). */
  landing(c, from, team = 0) {
    for (let r = from; r >= 0; r--) {
      const ty = this.at(c, r);
      if (ty === WATER) return -1;
      if (this.solidFor(c, r, team)) return r + 1;
    }
    return -1;
  }

  // ---------- rendering (instanced, like castle.js) ----------

  buildLayers() {
    const N = this.cols * ROWS;
    const s = this.scene;
    this.tileMat = new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: toon(0xffffff).gradientMap });
    const inst = (geo, mat = this.tileMat, shadows = true) => {
      const m = new THREE.InstancedMesh(geo, mat, N);
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(N * 3).fill(1), 3);
      m.count = 0;
      m.castShadow = m.receiveShadow = shadows;
      m.frustumCulled = false;
      s.add(m);
      return m;
    };
    this.waterMat = new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: toon(0xffffff).gradientMap, transparent: true, opacity: 0.72 });
    this.layers = {
      block: inst(new RoundedBoxGeometry(1, 1, 1.6, 2, 0.07)),
      grass: inst(new RoundedBoxGeometry(1.03, 0.26, 1.72, 2, 0.08)),
      brick: inst(mergeGeometries([box(0.9, 0.05, 0.04, 0, 0.02, 0.81), box(0.05, 0.45, 0.04, -0.2, 0.26, 0.81), box(0.05, 0.45, 0.04, 0.25, -0.24, 0.81)])),
      plank: inst(mergeGeometries([box(0.88, 0.05, 0.04, 0, 0.17, 0.81), box(0.88, 0.05, 0.04, 0, -0.17, 0.81), box(0.1, 0.1, 0.04, -0.32, 0.33, 0.82), box(0.1, 0.1, 0.04, 0.32, -0.33, 0.82)])),
      doorFrame: inst(mergeGeometries([box(0.13, 1, 0.8, -0.44, 0, 0), box(0.13, 1, 0.8, 0.44, 0, 0)])),
      doorPanel: inst(mergeGeometries([box(0.76, 0.98, 0.34), box(0.8, 0.1, 0.42, 0, 0.22, 0), box(0.8, 0.1, 0.42, 0, -0.22, 0)])),
      ladder: inst(mergeGeometries([box(0.08, 1, 0.08, -0.32, 0, -0.45), box(0.08, 1, 0.08, 0.32, 0, -0.45), box(0.64, 0.07, 0.07, 0, -0.25, -0.45), box(0.64, 0.07, 0.07, 0, 0.25, -0.45)])),
      padBase: inst(mergeGeometries([box(0.96, 0.36, 1.3, 0, -0.32, 0), box(0.12, 0.3, 0.12, -0.3, -0.02, 0.4), box(0.12, 0.3, 0.12, 0.3, -0.02, 0.4)])),
      padTop: inst(new RoundedBoxGeometry(0.94, 0.3, 1.3, 2, 0.12)),
      water: inst(new THREE.BoxGeometry(1.001, 1.001, 1.5), this.waterMat, false),
    };
    this.layers.water.receiveShadow = true;

    // Static backdrop: dark dirt underground, lilac stone inside the castles.
    const back = [];
    for (let c = 0; c < this.cols; c++) {
      for (let r = 0; r < ROWS; r++) {
        const b = this.back[c][r];
        if (b === 1) back.push([c, r, 0x9c6a43]);
        else if (b === 2) back.push([c, r, 0x9d95b8]);
        else if (b === 3) back.push([c, r, 0x3f7fb0]);
      }
    }
    const bm = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), this.tileMat, Math.max(1, back.length));
    const m4 = new THREE.Matrix4(), col = new THREE.Color();
    back.forEach(([c, r, hex], i) => {
      m4.makeTranslation(c + 0.5, r + 0.5, -0.82);
      bm.setMatrixAt(i, m4);
      bm.setColorAt(i, col.setHex(hex).multiplyScalar(this.shade[this.idx(c, r)]));
    });
    bm.count = back.length;
    bm.receiveShadow = true;
    s.add(bm);
  }

  rebuild() {
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
    for (let c = 0; c < this.cols; c++) {
      for (let r = 0; r < ROWS; r++) {
        const i = this.idx(c, r), ty = this.tile[i];
        if (ty === EMPTY || ty === GATE) continue;
        const x = c + 0.5, y = r + 0.5;
        const shade = this.shade[i] * (1 - 0.45 * this.dmg[i]);
        if (BLOCKY.has(ty)) {
          put(L.block, x, y, TILE_COLOR[ty], shade);
          if (ty === DIRT) {
            const above = this.at(c, r + 1);
            if (!(BLOCKY.has(above) || above === PAD || above === WATER) || r + 1 >= ROWS) put(L.grass, x, r + 0.9, 0x7ad65a, shade);
          }
          if (ty === CASTLE) put(L.brick, x, y, 0xa79fc2, shade);
          if (ty === WOOD) put(L.plank, x, y, this.owner[i] === 0 ? 0xb07a12 : 0x9a6a3a, 1);
        } else if (ty === DOOR) {
          const open = this.openDoors.has(i);
          put(L.doorFrame, x, y, 0x9a6a3a, shade);
          put(L.doorPanel, x, y, TEAM_PANEL[this.owner[i]] ?? 0xe2a96b, shade, open ? 0.18 : 1, open ? -0.33 : 0);
        } else if (ty === LADDER) {
          put(L.ladder, x, y, 0xc98b5a, shade);
        } else if (ty === PAD) {
          put(L.padBase, x, y, 0x9a94b2, shade);
          put(L.padTop, x, y + 0.12, 0xff7eb6, shade);
        } else if (ty === WATER) {
          const top = this.at(c, r + 1) !== WATER;
          put(L.water, x, y - (top ? 0.12 : 0), top ? 0x7fd6ff : 0x56c6f0, 1);
          if (top) L.water.setMatrixAt(L.water.count - 1, m4.makeScale(1, 0.76, 1).setPosition(x, y - 0.12, 0));
        }
      }
    }
    for (const k in L) {
      L[k].instanceMatrix.needsUpdate = true;
      L[k].instanceColor.needsUpdate = true;
    }
    this.dirty = false;
  }

  /** Doors swing open while a teammate stands in them. bodies: [{ body, team }] */
  updateDoors(actors, bw, bh) {
    const open = new Set();
    for (const e of actors) {
      const b = e.body;
      for (let c = Math.floor(b.x - b.w / 2); c <= Math.floor(b.x + b.w / 2); c++) {
        for (let r = Math.floor(b.y); r <= Math.floor(b.y + b.h); r++) {
          if (this.at(c, r) === DOOR && this.inside(c, r)) open.add(this.idx(c, r));
        }
      }
    }
    const key = [...open].sort().join(',');
    if (key !== this.doorKey) {
      this.doorKey = key;
      this.openDoors = open;
      this.dirty = true;
    }
  }
}
