import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { COLORS, toon, faceted, sharedGeo } from '../../core/palette.js';
import { makeTree, makeCloud, skyTexture } from '../../core/world.js';
import { SOLID, PLATFORM } from './world.js';
import { mulberry32 } from './util.js';

// Builds the 3D look of a Spacefall map in the Couch toon style. Tiles become instanced meshes
// (one draw call per kind, per-instance colors), so even the 70 x 42 Kessler Belt stays cheap.
// Themes: a candy-colored space station, an asteroid field, a goo-covered hive, and the sunny
// treetop grove from Balloon Archers.

const DEPTH = 1.4;

export const THEMES = {
  station: {
    wall: 0x8f86c9, panel: 0xb7aee8, girder: 0xffb347, trim: COLORS.gold, trimAlt: 0x3ddc97,
    platform: 0xe4ddff, back: 0x3a3170, lamp: [COLORS.candyYellow, COLORS.candyMint, COLORS.candyPink],
    sky: ['#120d30', '#3b2a7a'], planets: [[0xff9fd0, 0xffe47a], [0x8fd8ff, 0xc9a8ff]], additive: true,
  },
  asteroid: {
    wall: 0xbdb8cf, wall2: 0x9a94b2, crystal: COLORS.candyBlue, trim: COLORS.candyBlue,
    sky: ['#0b1838', '#2c5a8f'], planets: [[0xffb347, 0xfff3dc], [0x9ff0c8, 0x8fd8ff]], additive: true,
  },
  hive: {
    wall: 0xd65a9a, wall2: 0xa8437f, crystal: 0x9ff0c8, platform: 0x9ff0c8, back: 0x3a1638,
    sky: ['#1c0826', '#5a1f5a'], planets: [[0x9ff0c8, 0xffe47a], [0xff9fd0, 0xc9a8ff]], additive: true,
  },
  grove: {
    wall: COLORS.dirt, grass: COLORS.grass, platform: 0xc98b5a, sky: ['#ffbe7a', '#fff1d6'], additive: false,
  },
};

/** Collects per-instance transforms and colors, then builds one InstancedMesh. */
class Instances {
  constructor() { this.items = []; }
  add(x, y, z, sx = 1, sy = 1, sz = 1, color = 0xffffff, rx = 0, ry = 0, rz = 0) {
    this.items.push({ x, y, z, sx, sy, sz, color, rx, ry, rz });
  }
  build(geometry, material, { shadow = true } = {}) {
    if (!this.items.length) return null;
    const mesh = new THREE.InstancedMesh(geometry, material, this.items.length);
    const o = new THREE.Object3D();
    const c = new THREE.Color();
    this.items.forEach((it, i) => {
      o.position.set(it.x, it.y, it.z);
      o.rotation.set(it.rx, it.ry, it.rz);
      o.scale.set(it.sx, it.sy, it.sz);
      o.updateMatrix();
      mesh.setMatrixAt(i, o.matrix);
      mesh.setColorAt(i, c.set(it.color));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.castShadow = shadow;
    mesh.receiveShadow = true;
    return mesh;
  }
}

/** A fresh toon material for instanced meshes (instance colors tint it). Disposed with the scene. */
const instToon = (opts = {}) => new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: toon(0xffffff).gradientMap, ...opts });

function vary(hex, rng, amount = 0.12) {
  const c = new THREE.Color(hex);
  return c.multiplyScalar(1 + (rng() - 0.5) * 2 * amount).getHex();
}

export function buildLevel(world) {
  const theme = THEMES[world.def.theme];
  const kind = world.def.theme;
  const rng = mulberry32(world.w * 131 + world.h * 7 + world.def.id.length);
  const group = new THREE.Group();
  const add = (m) => m && group.add(m);
  if (kind === 'grove') {
    buildGrove(world, theme, group, rng);
    return { group, theme };
  }
  const open = (x, y) => world.tile(x, y) !== SOLID;

  const walls = new Instances();
  const girders = new Instances();
  const faces = new Instances();
  const trims = new Instances();
  const crystals = new Instances();
  const platforms = new Instances();
  const backs = new Instances();
  const lamps = new Instances();

  for (let y = 0; y < world.h; y++) {
    for (let x = 0; x < world.w; x++) {
      const t = world.tile(x, y);
      const ch = world.charAt(x, y);
      const cx = x + 0.5, cy = y + 0.5;
      if (t === SOLID) {
        const exposed = open(x + 1, y) || open(x - 1, y) || open(x, y + 1) || open(x, y - 1);
        if (kind === 'station') {
          if (ch === '=') {
            girders.add(cx, cy, 0, 1, 0.82, DEPTH * 0.8, vary(theme.girder, rng, 0.08));
          } else {
            walls.add(cx, cy, 0, 1, 1, DEPTH, vary(theme.wall, rng, 0.06));
            if (exposed || rng() < 0.3) faces.add(cx, cy, DEPTH / 2 + 0.01, 0.76, 0.76, 0.04, vary(theme.panel, rng, 0.08));
          }
          // Glowing trim on top of every walkable surface.
          if (open(x, y + 1) && ch !== '=' && rng() > 0.1) {
            trims.add(cx, y + 1 - 0.04, DEPTH / 2 + 0.04, 0.94, 0.08, 0.08, rng() < 0.15 ? theme.trimAlt : theme.trim);
          }
        } else if (kind === 'asteroid') {
          const s = 0.95 + rng() * 0.22;
          const col = vary(rng() < 0.4 ? theme.wall2 : theme.wall, rng, 0.1);
          walls.add(cx, cy, (rng() - 0.5) * 0.3, s, s, s * 1.1, col, rng() * 6, rng() * 6, rng() * 6);
          if (!exposed && rng() < 0.5) walls.add(cx, cy, -0.6, 1.1, 1.1, 1.1, vary(theme.wall2, rng, 0.15), rng() * 6, rng() * 6, rng() * 6);
          if (ch === '*') crystals.add(cx + (rng() - 0.5) * 0.3, cy + (rng() - 0.5) * 0.3, 0.6, 0.38, 0.75 + rng() * 0.5, 0.38, theme.crystal, 0, 0, (rng() - 0.5) * 1.2);
        } else {
          const s = 0.98 + rng() * 0.35;
          const col = vary(rng() < 0.35 ? theme.wall2 : theme.wall, rng, 0.08);
          walls.add(cx + (rng() - 0.5) * 0.1, cy + (rng() - 0.5) * 0.1, 0, s, s, s * 1.3, col, rng(), rng(), rng());
          if (ch === '*') crystals.add(cx, cy + 0.35, 0.5, 0.42, 0.42, 0.42, theme.crystal);
        }
      } else if (t === PLATFORM) {
        platforms.add(cx, y + 1 - 0.09, 0, 1, 0.18, DEPTH * 0.75, vary(theme.platform, rng, 0.05));
        trims.add(cx, y + 1 - 0.01, DEPTH * 0.375 + 0.03, 0.96, 0.05, 0.05, theme.trim ?? COLORS.white);
      }
      if (t !== SOLID && theme.back) {
        backs.add(cx, cy, -DEPTH / 2 - 0.02, 1, 1, 1, vary(theme.back, rng, (x + y) % 2 ? 0.1 : 0.04));
        if (rng() < 0.03) lamps.add(cx, cy, -DEPTH / 2 + 0.02, 0.22, 0.22, 1, theme.lamp ? theme.lamp[Math.floor(rng() * 3)] : theme.crystal);
      }
    }
  }

  if (kind === 'asteroid') {
    add(walls.build(sharedGeo('sfRock', () => faceted(new THREE.IcosahedronGeometry(0.72, 0))), instToon()));
    add(crystals.build(sharedGeo('sfCrystal', () => faceted(new THREE.OctahedronGeometry(0.5, 0))), instToon({ emissive: 0x2a5a7a }), { shadow: false }));
  } else if (kind === 'hive') {
    add(walls.build(sharedGeo('sfBlob', () => faceted(new THREE.IcosahedronGeometry(0.66, 1))), instToon()));
    add(crystals.build(sharedGeo('sfPod', () => new THREE.SphereGeometry(0.5, 12, 8)), new THREE.MeshBasicMaterial({ color: 0xffffff }), { shadow: false }));
  } else {
    add(walls.build(sharedGeo('sfBox', () => new THREE.BoxGeometry(1, 1, 1)), instToon()));
    add(faces.build(sharedGeo('sfPanel', () => new RoundedBoxGeometry(1, 1, 1, 2, 0.12)), instToon(), { shadow: false }));
    add(girders.build(sharedGeo('sfGirder', () => new RoundedBoxGeometry(1, 1, 1, 2, 0.1)), instToon()));
  }
  add(platforms.build(sharedGeo('sfPlat', () => new RoundedBoxGeometry(1, 1, 1, 2, 0.05)), instToon()));
  add(trims.build(sharedGeo('sfBox', () => new THREE.BoxGeometry(1, 1, 1)), new THREE.MeshBasicMaterial({ color: 0xffffff }), { shadow: false }));
  const back = backs.build(sharedGeo('sfBack', () => new THREE.PlaneGeometry(1, 1)), instToon(), { shadow: false });
  if (back) { back.castShadow = false; group.add(back); }
  add(lamps.build(sharedGeo('sfLamp', () => new THREE.CircleGeometry(0.5, 12)), new THREE.MeshBasicMaterial({ color: 0xffffff }), { shadow: false }));

  group.add(buildBackdrop(world, theme, rng));
  return { group, theme };
}

/** Distant space: twinkly stars, two toon planets and dim floating rocks for parallax. */
function buildBackdrop(world, theme, rng) {
  const g = new THREE.Group();
  const cx = world.w / 2, cy = world.h / 2;
  const n = 1800;
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  const c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const z = -160 - rng() * 140;
    const spread = 1.3 + (-z) / 45;
    pos[i * 3] = cx + (rng() - 0.5) * (world.w + 40) * spread;
    pos[i * 3 + 1] = cy + (rng() - 0.5) * (world.h + 40) * spread;
    pos[i * 3 + 2] = z;
    c.setHSL(rng(), 0.5, 0.8 + rng() * 0.2);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  sg.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.add(new THREE.Points(sg, new THREE.PointsMaterial({ size: 2.4, sizeAttenuation: false, vertexColors: true })));

  // Toon planets far behind the map (one with a ring), small enough to stay scenery.
  theme.planets.forEach(([body, ring], i) => {
    const r = i ? 16 : 24;
    const planet = new THREE.Mesh(sharedGeo('sfPlanet', () => new THREE.SphereGeometry(1, 32, 20)), toon(body));
    planet.scale.setScalar(r);
    planet.position.set(cx + (i ? -1 : 1) * (world.w * 0.5 + 50), cy + (i ? -1 : 1) * (world.h * 0.3 + 30), -260 - i * 30);
    g.add(planet);
    const extra = i === 0
      ? new THREE.Mesh(sharedGeo('sfPlanetRing', () => new THREE.TorusGeometry(1.55, 0.12, 4, 48)), toon(ring))
      : new THREE.Mesh(sharedGeo('sfPlanet', () => new THREE.SphereGeometry(1, 32, 20)), toon(ring));
    if (i === 0) { extra.rotation.set(1.25, 0.2, 0.35); extra.scale.set(1, 1, 0.25); } else { extra.scale.setScalar(0.25); extra.position.set(1.5, 0.6, 0); }
    planet.add(extra);
  });

  // Distant debris, dim and small so it never reads as solid terrain.
  const debris = new Instances();
  const count = 16 + Math.floor((world.w * world.h) / 70);
  for (let i = 0; i < count; i++) {
    const z = -14 - rng() * 30;
    const s = 0.4 + rng() * (world.def.theme === 'asteroid' ? 2 : 1.1);
    const k = 0.35 + rng() * 0.15;
    const col = new THREE.Color(theme.wall).multiplyScalar(k).getHex();
    debris.add(rng() * (world.w + 40) - 20, rng() * (world.h + 30) - 15, z, s, s * (0.6 + rng() * 0.6), s, col, rng() * 6, rng() * 6, rng() * 6);
  }
  const dMesh = debris.build(sharedGeo('sfRock', () => faceted(new THREE.IcosahedronGeometry(0.72, 0))), instToon(), { shadow: false });
  if (dMesh) { dMesh.receiveShadow = false; g.add(dMesh); }
  return g;
}

/** Balloon Archers' treetop arena: dirt blocks with grass tops, rope ledges, trees and clouds. */
function buildGrove(world, theme, group, rng) {
  const rows = world.rows;
  const H = world.h;
  for (let r = 0; r < H; r++) {
    let run = -1, ledge = -1;
    for (let c = 0; c <= world.w; c++) {
      const ch = c < world.w ? rows[r][c] : '.';
      if (ch === '#') { if (run < 0) run = c; } else if (run >= 0) { addBlock(run, r, c - run); run = -1; }
      if (ch === '-') { if (ledge < 0) ledge = c; } else if (ledge >= 0) { addLedge(ledge, r, c - ledge); ledge = -1; }
    }
  }
  function addBlock(c0, r, len) {
    const y = H - 1 - r;
    const m = new THREE.Mesh(new RoundedBoxGeometry(len, 1, 2.4, 2, 0.12), toon(COLORS.dirt));
    m.position.set(c0 + len / 2, y + 0.5, 0);
    m.castShadow = m.receiveShadow = true;
    group.add(m);
    if (r > 0 && rows[r - 1].slice(c0, c0 + len).split('').some((ch) => ch !== '#')) {
      const top = new THREE.Mesh(new RoundedBoxGeometry(len + 0.08, 0.3, 2.5, 2, 0.1), toon(COLORS.grass));
      top.position.set(c0 + len / 2, y + 0.92, 0);
      top.receiveShadow = true;
      group.add(top);
    }
  }
  function addLedge(c0, r, len) {
    const y = H - 1 - r;
    const m = new THREE.Mesh(new RoundedBoxGeometry(len, 0.3, 2, 2, 0.1), toon(theme.platform));
    m.position.set(c0 + len / 2, y + 0.85, 0);
    m.castShadow = m.receiveShadow = true;
    group.add(m);
    for (let i = 0; i <= len; i += 2) {
      const rope = new THREE.Mesh(sharedGeo('sfRope', () => new THREE.CylinderGeometry(0.04, 0.04, 1.2, 5)), toon(COLORS.sand));
      rope.position.set(c0 + i, y + 1.45, -0.8);
      group.add(rope);
    }
  }
  const cx = world.w / 2;
  for (const x of [cx - 11, cx + 11]) {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.2, 22, 12), toon(COLORS.trunk));
    trunk.position.set(x, 6, -5);
    group.add(trunk);
  }
  for (let i = 0; i < 12; i++) {
    const t = makeTree(rng, 2.5 + rng() * 2, [0x58b947, 0x7ad65a, 0x4cc46a]);
    t.position.set(cx - 24 + rng() * 48, -4 + rng() * 4, -12 - rng() * 8);
    group.add(t);
  }
  for (let i = 0; i < 6; i++) {
    const c = makeCloud(rng, 1.6 + rng());
    c.position.set(cx - 30 + i * 12, 15 + rng() * 4, -14);
    group.add(c);
  }
  const back = new THREE.Mesh(new THREE.PlaneGeometry(world.w + 6, H + 4), toon(0xffe2b8));
  back.position.set(cx, H / 2, -1.6);
  back.receiveShadow = true;
  group.add(back);
  for (let i = 0; i < 18; i++) {
    const leaf = new THREE.Mesh(sharedGeo('sfLeaf', () => new THREE.CircleGeometry(1, 6)), toon(i % 2 ? 0xffd39a : 0xffcb8a));
    leaf.position.set(cx - 13 + rng() * 26, rng() * 15, -1.55 + i * 0.001);
    leaf.scale.setScalar(0.5 + rng() * 1.4);
    group.add(leaf);
  }
}

/** The scene background for a theme (a vertical gradient). */
export function themeSky(theme) {
  return skyTexture(theme.sky[0], theme.sky[1]);
}

export { DEPTH };
