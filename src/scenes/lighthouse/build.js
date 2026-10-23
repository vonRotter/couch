import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { COLORS, toon } from '../../core/palette.js';
import { seeded } from '../../core/world.js';
import { W, H, DOOR_TILES, tileX, tileZ, groundOf } from './tiles.js';
import { box, cyl, cone, ico, sph, mesh, C } from './models.js';

// Builds the static look of a room: a painted floor texture, every wall / tree / cliff / prop merged
// into a few meshes (one per color, so a room costs a handful of draw calls), door frames and the
// ocean or darkness around it. Things that change (bushes, torches, pegs, doors...) are made by
// the engine on top of this.

export const THEMES = {
  over: { floor: ['#8ed86c', '#86d266'], wall: 0xc4a382, wallTop: 0x7ad65a, bg: 0x56c6f0, sea: 0x4fb8e8 },
  house: { floor: ['#d9a877', '#cf9d6c'], wall: 0xf3dcb8, wallTop: 0xc98f5e, bg: 0x241a2c },
  tower: { floor: ['#cfc8dc', '#c4bcd3'], wall: 0xf4f1f8, wallTop: 0xff6b7d, bg: 0x241a2c },
  cave: { floor: ['#8a7764', '#7f6c5a'], wall: 0x5e4c40, wallTop: 0x7d6a5a, bg: 0x120d0a },
  cellar: { floor: ['#958aa8', '#8a7f9d'], wall: 0x6d6084, wallTop: 0x9a8db5, bg: 0x17121f },
  grotto: { floor: ['#e3d3a8', '#d9c89c'], wall: 0x3f8ea3, wallTop: 0x7fd0db, bg: 0x0d2630 },
  // part 2: the stormy cliffs (outdoors, grey-green under rain clouds) and the Stormcliff Ruins
  cliff: { floor: ['#9cc38a', '#93ba82'], wall: 0x9a93a8, wallTop: 0x6f9a63, bg: 0x4f6a88, sea: 0x3d7fa6, outdoor: true },
  ruins: { floor: ['#a9b4a6', '#a0ab9d'], wall: 0x76848c, wallTop: 0xa9b5b2, bg: 0x111a22 },
};
THEMES.over.outdoor = true;

const TILE_PX = 32;
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();

/** Collects transformed geometry per color and merges it into one mesh per color. */
class Batch {
  constructor() { this.parts = new Map(); }
  add(geo, color, x, y, z, { sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0 } = {}) {
    _m.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz));
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    g.deleteAttribute('uv');
    g.applyMatrix4(_m);
    if (!this.parts.has(color)) this.parts.set(color, []);
    this.parts.get(color).push(g);
  }
  build(group) {
    for (const [color, list] of this.parts) {
      const merged = mergeGeometries(list, false);
      for (const g of list) g.dispose();
      const m = new THREE.Mesh(merged, toon(color));
      m.castShadow = true;
      m.receiveShadow = true;
      group.add(m);
    }
  }
}

const shade = (hex, f) => {
  const c = new THREE.Color(hex);
  c.multiplyScalar(f);
  return `#${c.getHexString()}`;
};

/** Paint the floor tiles of a room on a canvas. */
function paintFloor(grid, theme, rand) {
  const T = THEMES[theme];
  const cv = document.createElement('canvas');
  cv.width = W * TILE_PX;
  cv.height = H * TILE_PX;
  const g = cv.getContext('2d');
  const at = (c, r) => (c < 0 || r < 0 || c >= W || r >= H ? '#' : grid[r][c]);
  const lines = grid.map((row) => row.join(''));
  const PAINTED = new Set(['.', ',', 's', 'w', '~', 'o', '=', ' ', '#', 'H', 'f', 'g', '_', 'v']);
  for (let r = 0; r < H; r++) {
    for (let c = 0; c < W; c++) {
      let ch = grid[r][c];
      if (!PAINTED.has(ch)) ch = groundOf(lines, c, r, '.');
      const x = c * TILE_PX, y = r * TILE_PX;
      let col = T.floor[(c + r) % 2];
      if (ch === ',') col = theme === 'over' ? '#e8c890' : theme === 'cliff' ? '#cdb990' : shade(parseInt(T.floor[0].slice(1), 16), 0.9);
      else if (ch === 's') col = '#f5dfa2';
      else if (ch === 'w') col = '#9fe0f5';
      else if (ch === '~') col = T.outdoor ? `#${new THREE.Color(T.sea).getHexString()}` : '#2f86b8';
      else if (ch === 'o') col = T.outdoor ? '#1c2433' : '#110b18';
      else if (ch === ' ') col = `#${new THREE.Color(T.bg).getHexString()}`;
      else if (ch === '#' || ch === 'H') col = shade(T.wall, 0.7);
      g.fillStyle = col;
      g.fillRect(x, y, TILE_PX, TILE_PX);
      if (ch === 'o' && T.outdoor) {
        // a cliff drop: the sea far below, the cliff face at the top edge
        g.fillStyle = '#2b4a6a';
        g.fillRect(x, y, TILE_PX, TILE_PX);
        g.fillStyle = 'rgba(255,255,255,0.18)';
        g.fillRect(x + ((c * 13 + r * 7) % 20), y + ((c * 5 + r * 11) % 22) + 4, 7, 2);
        if (at(c, r - 1) !== 'o') { g.fillStyle = '#5e5870'; g.fillRect(x, y, TILE_PX, 12); g.fillStyle = '#463f57'; g.fillRect(x, y + 12, TILE_PX, 4); }
      } else if (ch === 'o') {
        // a hole: dark with a lit back rim, so it reads as a drop
        g.fillStyle = '#2a2138';
        if (at(c, r - 1) !== 'o') g.fillRect(x, y, TILE_PX, 7);
        g.fillStyle = '#000';
        g.fillRect(x + 3, y + 9, TILE_PX - 6, TILE_PX - 12);
      } else if (ch === '~' || ch === 'w') {
        g.strokeStyle = ch === '~' ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.6)';
        g.lineWidth = 2;
        g.beginPath();
        const yy = y + 10 + ((c * 7 + r * 3) % 12);
        g.moveTo(x + 6, yy); g.quadraticCurveTo(x + 12, yy - 4, x + 18, yy); g.quadraticCurveTo(x + 22, yy + 3, x + 26, yy);
        g.stroke();
        // foam where water meets land
        g.fillStyle = 'rgba(255,255,255,0.7)';
        const land = (cc, rr) => !['~', 'w', 'o', ' '].includes(at(cc, rr)) && at(cc, rr) !== '#';
        if (land(c, r - 1)) g.fillRect(x, y, TILE_PX, 3);
        if (land(c, r + 1)) g.fillRect(x, y + TILE_PX - 3, TILE_PX, 3);
        if (land(c - 1, r)) g.fillRect(x, y, 3, TILE_PX);
        if (land(c + 1, r)) g.fillRect(x + TILE_PX - 3, y, 3, TILE_PX);
      } else if (ch === '=') {
        g.fillStyle = '#c08a58';
        g.fillRect(x, y + 2, TILE_PX, TILE_PX - 4);
        g.fillStyle = '#8a5a3a';
        const vertical = at(c, r - 1) === '~' || at(c, r + 1) === '~';
        for (let i = 0; i < 4; i++) {
          if (vertical) g.fillRect(x + 2, y + 4 + i * 7, TILE_PX - 4, 2);
          else g.fillRect(x + 4 + i * 7, y + 2, 2, TILE_PX - 4);
        }
      } else if (T.outdoor && (ch === '.' || ch === 'f' || ch === 'g')) {
        g.fillStyle = 'rgba(60,140,50,0.35)';
        for (let i = 0; i < 3; i++) {
          const px = x + 4 + rand() * (TILE_PX - 8), py = y + 4 + rand() * (TILE_PX - 8);
          g.fillRect(px, py, 2, 5);
          g.fillRect(px + 3, py + 1, 2, 4);
        }
      } else if (['cellar', 'grotto', 'cave', 'tower', 'ruins'].includes(theme) && ch !== '#' && ch !== 's' && ch !== ',') {
        // stone slab seams
        g.strokeStyle = 'rgba(0,0,0,0.12)';
        g.lineWidth = 1.5;
        g.strokeRect(x + 1, y + 1, TILE_PX - 2, TILE_PX - 2);
      } else if (theme === 'house' && ch !== '#') {
        g.fillStyle = 'rgba(90,50,20,0.25)';
        g.fillRect(x, y + (r % 2 ? 15 : 0), TILE_PX, 2);
        g.fillRect(x + ((c + r) % 3) * 10, y, 2, TILE_PX);
      }
      if (ch === 's' || ch === ',') {
        g.fillStyle = 'rgba(160,110,60,0.18)';
        for (let i = 0; i < 4; i++) g.fillRect(x + rand() * 28, y + rand() * 28, 3, 3);
      }
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function addWall(B, theme, c, r, grid) {
  const T = THEMES[theme];
  const x = tileX(c), z = tileZ(r);
  const edge = r === 0 || c === 0 || c === W - 1;
  const out = !!T.outdoor;
  let h = out ? 1.25 : edge ? 1.15 : 0.95;
  if (r === H - 1 || (grid[r + 1]?.[c] === ' ' && !out)) h = out ? 0.6 : 0.42; // walls facing the camera stay low
  if (r === 0 && !out) h = 1.35;
  if (out) {
    const rnd = ((c * 928371 + r * 12377) % 100) / 100;
    B.add(box(1.02, h, 1.02), T.wall, x, h / 2, z);
    B.add(box(1.04, 0.14, 1.04), T.wallTop, x, h + 0.02, z);
    if (rnd > 0.6) B.add(ico(0.32, 0), COLORS.rockDark, x + (rnd - 0.8), h + 0.12, z + 0.1, { sy: 0.6 });
    return;
  }
  B.add(box(1.0, h, 1.0), T.wall, x, h / 2, z);
  B.add(box(1.02, 0.1, 1.02), T.wallTop, x, h + 0.05, z);
  // brick seams on the face toward the camera
  if (theme === 'cellar' || theme === 'cave') {
    const dark = theme === 'cellar' ? 0x584c6e : 0x4a3c32;
    if (h > 0.6 && grid[r + 1]?.[c] !== '#') {
      B.add(box(1.01, 0.04, 0.02), dark, x, h * 0.35, z + 0.505);
      B.add(box(1.01, 0.04, 0.02), dark, x, h * 0.7, z + 0.505);
      B.add(box(0.04, h * 0.33, 0.02), dark, x + ((c % 2) ? 0.2 : -0.2), h * 0.52, z + 0.505);
    }
  } else if (theme === 'grotto') {
    if ((c * 7 + r * 3) % 4 === 0) B.add(ico(0.22, 0), 0xff9fb8, x + 0.2, h + 0.1, z + 0.2);
  } else if (theme === 'tower') {
    B.add(box(1.01, 0.18, 1.01), 0xff6b7d, x, h * 0.55, z);
  } else if (theme === 'ruins') {
    // old carved blocks with moss and a broken top here and there
    if (h > 0.6 && grid[r + 1]?.[c] !== '#') {
      B.add(box(1.01, 0.05, 0.02), 0x5d6a72, x, h * 0.5, z + 0.505);
      B.add(box(0.05, h * 0.45, 0.02), 0x5d6a72, x + ((c + r) % 2 ? 0.25 : -0.25), h * 0.27, z + 0.505);
    }
    if ((c * 5 + r * 11) % 7 === 0) B.add(ico(0.2, 0), 0x6fae5f, x - 0.2, h + 0.12, z + 0.15);
    else if ((c * 3 + r * 7) % 9 === 0) B.add(box(0.5, 0.18, 0.5), T.wall, x + 0.18, h + 0.16, z - 0.1);
  }
}

function addTree(B, c, r, rand) {
  const x = tileX(c) + (rand() - 0.5) * 0.15, z = tileZ(r) + (rand() - 0.5) * 0.15;
  const s = 0.85 + rand() * 0.3;
  B.add(cyl(0.16, 0.22, 0.8, 7), COLORS.trunk, x, 0.4 * s, z, { sx: s, sy: s, sz: s });
  const leaf = rand() < 0.5 ? COLORS.leaf : 0x3fae5a;
  B.add(ico(0.62, 1), leaf, x, 1.15 * s, z, { sx: s, sy: s * 0.95, sz: s });
  B.add(ico(0.38, 1), COLORS.leafLight, x + 0.2 * s, 1.45 * s, z + 0.15 * s, { sx: s, sy: s, sz: s });
}

function addStatic(B, theme, ch, c, r, grid, rand) {
  const x = tileX(c), z = tileZ(r);
  switch (ch) {
    case '#': addWall(B, theme, c, r, grid); break;
    case 'T': addTree(B, c, r, rand); break;
    case 'F':
      B.add(box(0.12, 0.6, 0.12), C.wood, x - 0.38, 0.3, z);
      B.add(box(0.12, 0.6, 0.12), C.wood, x + 0.38, 0.3, z);
      B.add(box(1.0, 0.09, 0.07), 0xd9a877, x, 0.42, z);
      B.add(box(1.0, 0.09, 0.07), 0xd9a877, x, 0.22, z);
      break;
    case '@':
      B.add(box(0.8, 0.3, 0.8), C.stoneDark, x, 0.15, z);
      B.add(cyl(0.28, 0.32, 0.7, 10), C.stone, x, 0.65, z);
      B.add(sph(0.3), C.stone, x, 1.05, z);
      B.add(sph(0.08), 0x6d6084, x - 0.1, 1.1, z + 0.26);
      B.add(sph(0.08), 0x6d6084, x + 0.1, 1.1, z + 0.26);
      break;
    case '|':
      B.add(cyl(0.16, 0.2, 1.0, 8), C.woodDark, x, 0.5, z);
      B.add(cyl(0.22, 0.22, 0.08, 8), 0xd8b27a, x, 0.75, z);
      B.add(cyl(0.2, 0.16, 0.1, 8), C.wood, x, 1.03, z);
      break;
    case 'f':
      for (let i = 0; i < 3; i++) {
        const fx = x + (rand() - 0.5) * 0.6, fz = z + (rand() - 0.5) * 0.6;
        const col = [0xff7eb6, 0xffffff, 0xffd23f, 0xb08bff][Math.floor(rand() * 4)];
        B.add(sph(0.09, 8, 6), col, fx, 0.12, fz, { sy: 0.6 });
      }
      break;
    case 'v':
      B.add(box(1.0, 0.25, 0.25), shadeHex(THEMES[theme].wall, 0.9), x, 0.12, z + 0.38);
      break;
    case '=':
      B.add(box(0.08, 0.3, 0.08), C.woodDark, x - 0.45, 0.05, z - 0.45);
      B.add(box(0.08, 0.3, 0.08), C.woodDark, x + 0.45, 0.05, z + 0.45);
      break;
    default: break;
  }
}

function shadeHex(hex, f) {
  return new THREE.Color(hex).multiplyScalar(f).getHex();
}

// ---------- big props ----------

function addHouse(B, p) {
  const x = tileX(p.c), z = tileZ(p.r);
  B.add(box(2.9, 1.5, 1.9), 0xfff3dc, x, 0.75, z);
  B.add(box(3.0, 0.15, 2.0), 0xd9a877, x, 0.08, z);
  // roof: a prism (3-sided cylinder on its side)
  B.add(cyl(1.35, 1.35, 3.3, 3), p.roof || 0xe0564f, x, 1.95, z - 0.05, { rz: Math.PI / 2, rx: -Math.PI / 2, sz: 0.62 });
  B.add(box(0.7, 1.0, 0.1), 0x8a5a3a, x, 0.5, z + 0.96);
  B.add(sph(0.05), C.gold, x + 0.22, 0.5, z + 1.02);
  for (const s of [-1, 1]) {
    B.add(box(0.55, 0.5, 0.08), 0x8fd8ff, x + s * 0.95, 0.95, z + 0.96);
    B.add(box(0.65, 0.08, 0.12), 0xd9a877, x + s * 0.95, 0.68, z + 0.98);
  }
  B.add(box(0.35, 0.8, 0.35), 0xb87a48, x + 0.9, 2.4, z - 0.3);
}

function addLighthouse(B, p) {
  const x = tileX(p.c), z = tileZ(p.r);
  B.add(cyl(1.7, 1.9, 0.5, 16), C.stoneDark, x, 0.25, z);
  const bands = 3;
  for (let i = 0; i < bands; i++) {
    const y0 = 0.5 + i * 0.85;
    const r0 = 1.3 - i * 0.12, r1 = r0 - 0.12;
    B.add(cyl(r1, r0, 0.85, 16), i % 2 ? 0xff5d73 : 0xffffff, x, y0 + 0.425, z);
  }
  const top = 0.5 + bands * 0.85;
  B.add(cyl(1.05, 1.05, 0.15, 16), 0x4a4560, x, top + 0.08, z);
  B.add(cyl(0.95, 0.95, 0.1, 16), 0x4a4560, x, top + 1.25, z);
  B.add(cone(0.95, 0.7, 16), 0xff5d73, x, top + 1.65, z);
  B.add(sph(0.14), C.gold, x, top + 2.05, z);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    B.add(box(0.06, 1.1, 0.06), 0x4a4560, x + Math.cos(a) * 0.9, top + 0.7, z + Math.sin(a) * 0.9);
  }
  // door
  B.add(box(0.8, 1.1, 0.2), 0x8a5a3a, x, 0.75, z + 1.3);
  B.add(cyl(0.4, 0.4, 0.2, 12, 1), 0x8a5a3a, x, 1.3, z + 1.3, { rx: Math.PI / 2 });
  return top;
}

function addWell(B, p) {
  const x = tileX(p.c), z = tileZ(p.r);
  B.add(cyl(0.45, 0.48, 0.55, 12), C.stone, x, 0.27, z);
  B.add(cyl(0.36, 0.36, 0.06, 12), 0x2f86b8, x, 0.52, z);
  B.add(box(0.08, 1.0, 0.08), C.woodDark, x - 0.42, 0.75, z);
  B.add(box(0.08, 1.0, 0.08), C.woodDark, x + 0.42, 0.75, z);
  B.add(cyl(0.65, 0.65, 0.9, 3), 0xe0564f, x, 1.35, z, { rz: Math.PI / 2, rx: -Math.PI / 2, sz: 0.5 });
}

/** The front of the Stormcliff Ruins: a broken temple wall with an arch over the door. */
function addRuins(B, p) {
  const x = tileX(p.c), z = tileZ(p.r);
  const stone = 0x8a95a0, dark = 0x5d6a72, moss = 0x6fae5f;
  B.add(box(7.0, 1.7, 1.6), stone, x, 0.85, z - 0.2);
  B.add(box(7.2, 0.2, 1.8), dark, x, 1.75, z - 0.2);
  for (const s of [-3, -1.6, 1.6, 3]) {
    B.add(cyl(0.3, 0.34, 2.6, 10), 0xc9d0d6, x + s, 1.3, z + 0.65);
    B.add(box(0.8, 0.2, 0.8), dark, x + s, 2.65, z + 0.65);
  }
  B.add(box(4.2, 0.35, 0.5), 0xc9d0d6, x, 2.85, z + 0.65);
  B.add(cone(1.2, 0.8, 4), stone, x, 3.4, z + 0.5, { ry: Math.PI / 4, sz: 0.5 });
  // the dark arch
  B.add(box(1.0, 1.25, 0.1), 0x1a1426, x, 0.62, z + 0.62);
  B.add(cyl(0.5, 0.5, 0.1, 12), 0x1a1426, x, 1.25, z + 0.62, { rx: Math.PI / 2 });
  // broken bits and moss
  B.add(box(0.9, 0.5, 0.7), stone, x - 2.4, 2.0, z - 0.4, { rz: 0.3 });
  B.add(ico(0.35, 0), moss, x + 2.3, 1.9, z - 0.2);
  B.add(ico(0.28, 0), moss, x - 3.3, 1.85, z + 0.1);
}

/** A little sailing ship (the ending: the light brings the ships home). */
export function makeShip() {
  const g = new THREE.Group();
  g.add(mesh(box(2.2, 0.5, 0.9), 0xb5835a, 0, 0.25, 0));
  g.add(mesh(box(2.4, 0.12, 1.0), 0x8a5a3a, 0, 0.52, 0));
  g.add(mesh(cone(0.45, 0.9, 4), 0xb5835a, 1.3, 0.28, 0, true));
  g.children[2].rotation.z = -Math.PI / 2;
  g.add(mesh(cyl(0.05, 0.06, 2.0, 6), 0x8a5a3a, 0, 1.5, 0));
  const sail = mesh(box(0.06, 1.3, 1.3), 0xfff3dc, 0.15, 1.6, 0);
  g.add(sail);
  g.add(mesh(box(0.05, 0.25, 0.4), 0xff5d73, 0, 2.55, 0.18));
  return g;
}

function addStall(B, p) {
  const x = tileX(p.c), z = tileZ(p.r);
  for (const sx of [-1.4, 1.4]) B.add(box(0.1, 1.6, 0.1), C.woodDark, x + sx, 0.8, z - 0.3);
  for (let i = 0; i < 6; i++) B.add(box(0.5, 0.08, 1.0), i % 2 ? 0xffffff : 0x3ddc97, x - 1.25 + i * 0.5, 1.65, z, { rx: -0.35 });
}

/**
 * Build the static part of a room into `group`. Returns { waves, lampTop } (waves animate).
 */
export function buildRoomStatic(def, grid, group, doors) {
  const theme = def.theme;
  const rand = seeded(def.gx * 131 + def.gy * 977 + def.id.length * 31);
  const B = new Batch();
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) addStatic(B, theme, grid[r][c], c, r, grid, rand);

  // Door frames: two posts and a lintel in the wall color.
  const T = THEMES[theme];
  for (const [d, door] of Object.entries(doors || {})) {
    if (!door) continue;
    const [c, r] = DOOR_TILES[d];
    const x = tileX(c), z = tileZ(r);
    const low = d === 's';
    const h = low ? 0.55 : 1.45;
    const post = box(0.22, h, 0.22);
    const side = d === 'n' || d === 's' ? [[-0.55, 0], [0.55, 0]] : [[0, -0.55], [0, 0.55]];
    for (const [ox, oz] of side) B.add(post, T.wallTop, x + ox, h / 2, z + oz);
    if (!low) B.add(d === 'n' ? box(1.3, 0.25, 0.3) : box(0.3, 0.25, 1.3), T.wallTop, x, h, z);
  }

  let lampTop = null;
  for (const p of def.props || []) {
    if (p.kind === 'house') addHouse(B, p);
    else if (p.kind === 'lighthouse') lampTop = addLighthouse(B, p);
    else if (p.kind === 'well') addWell(B, p);
    else if (p.kind === 'stall') addStall(B, p);
    else if (p.kind === 'ruins') addRuins(B, p);
  }
  B.build(group);

  // Floor
  const tex = paintFloor(grid, theme, rand);
  const floorMat = new THREE.MeshToonMaterial({ map: tex, gradientMap: toon(0xffffff).gradientMap });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, H), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  group.add(floor);

  // Sea (overworld) or darkness around the room, so screen edges never show the void.
  const under = new THREE.Mesh(new THREE.PlaneGeometry(W * 3, H * 3), toon(T.outdoor ? T.sea : T.bg));
  under.rotation.x = -Math.PI / 2;
  under.position.y = -0.04;
  group.add(under);

  // Little moving wave crests on deep water
  const waves = [];
  for (let r = 0; r < H; r++) {
    for (let c = 0; c < W; c++) {
      if (grid[r][c] !== '~' || rand() > 0.35) continue;
      const w = mesh(box(0.34, 0.02, 0.06), toon(0xffffff, { transparent: true, opacity: 0.7 }), tileX(c) + (rand() - 0.5) * 0.5, 0.03, tileZ(r) + (rand() - 0.5) * 0.5, false);
      w.userData.phase = rand() * 6.28;
      w.userData.x0 = w.position.x;
      group.add(w);
      waves.push(w);
    }
  }
  return { waves, lampTop };
}

/** Patch a filled hole (a block fell in) with a floor-colored slab. */
export function floorPatch(theme) {
  const T = THEMES[theme];
  const m = mesh(box(1, 0.06, 1), parseInt(T.floor[0].slice(1), 16), 0, 0.0, 0, false);
  m.receiveShadow = true;
  return m;
}

