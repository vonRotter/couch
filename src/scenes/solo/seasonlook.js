import * as THREE from 'three';
import { COLORS, toon } from '../../core/palette.js';
import { HOME, HAZEL_HOME, STORE, CAFE, RIVER_PTS, RIVER_W, SEA_Y, heightAt } from './map.js';
import { mesh, roofGeo } from './models.js';

// How the island looks in each season (milestone B3), kept cheap: the baked tree and bush meshes get a
// seasonal material, the ground's vertex colors are tinted once per season change, winter adds snow caps
// on the roofs and an icy rim along the river, and a single small particle system shows petals (spring),
// falling leaves (autumn) or snow (winter; heavier on snowy days).

// leaf colors used by the trees and bushes (world.js and the forest in map.js) -> season colors
const LEAVES = {
  [COLORS.leaf]: { spring: 0x5fd07a, autumn: 0xf08a2a, winter: 0xeef6ff },
  [COLORS.leafLight]: { spring: 0xffb3d1, autumn: 0xffc93c, winter: 0xdfeeff }, // spring blossoms
  0x2f9e5a: { spring: 0x3fae6a, autumn: 0x8a9a3a, winter: 0x6f9f8a },
  0x3fae4a: { spring: 0x6fcf5a, autumn: 0xd9583a, winter: 0xe8f2ff },
};
const GROUND = {
  spring: { grass: [0xa8e878, 0.22], sand: null },
  summer: null,
  autumn: { grass: [0xd2b45a, 0.42], sand: null },
  winter: { grass: [0xf2f7ff, 0.86], sand: [0xf2f7ff, 0.35] },
};
const PARTICLES = {
  spring: { n: 70, colors: [0xffc0dc, 0xffe0ee, 0xffffff], fall: 0.7, sway: 1.2, size: 0.22 },
  summer: { n: 0 },
  autumn: { n: 80, colors: [0xf08a2a, 0xffc93c, 0xd9583a], fall: 1.0, sway: 1.4, size: 0.26 },
  winter: { n: 260, colors: [0xffffff], fall: 1.6, sway: 0.6, size: 0.2 },
};
const MAX_P = 520;

function dotTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(16, 16, 2, 16, 16, 15);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.6, 'rgba(255,255,255,0.9)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
}

export class SeasonLook {
  constructor(host) {
    this.host = host;
    const map = host.map;
    this.season = null;
    this.mats = new Map();
    // the baked leaf meshes
    this.leaves = [];
    for (const m of map.baked?.children || []) {
      const hex = m.material?.color?.getHex();
      if (hex !== undefined && LEAVES[hex]) this.leaves.push({ m, base: m.material, hex });
    }
    // the ground's own colors, and which vertices are grass or sand
    const col = map.ground.geometry.attributes.color;
    this.groundBase = Float32Array.from(col.array);
    this.kind = new Uint8Array(col.count);
    const c = new THREE.Color(), sand = new THREE.Color(0xf7e1a6);
    for (let i = 0; i < col.count; i++) {
      c.fromArray(this.groundBase, i * 3);
      if (c.g > c.r && c.g > c.b * 1.2) this.kind[i] = 1; // grass
      else if (Math.abs(c.r - sand.r) + Math.abs(c.g - sand.g) + Math.abs(c.b - sand.b) < 0.25) this.kind[i] = 2; // sand
    }
    // winter: snow on the roofs and an icy rim along the river
    this.winter = new THREE.Group();
    const snow = toon(0xf4f9ff);
    const cap = (x, z, w, d, h, rotY = 0, wallH = 2.4) => {
      const rh = Math.min(2.4, d * 0.55);
      const m = mesh(roofGeo(w + 0.86, d + 1.04, rh + 0.1), snow, 0, 0, 0, false);
      m.position.set(x, heightAt(x, z) + 0.35 + wallH + 0.02, z);
      m.rotation.y = rotY;
      this.winter.add(m);
    };
    cap(HOME.x, HOME.z, 5.2, 4, 0, 0, 2.5);
    cap(HAZEL_HOME.x, HAZEL_HOME.z, 4.6, 3.6, 0, 0, 2.2);
    cap(STORE.x, STORE.z, 7, 4.6, 0, 0, 2.6);
    cap(CAFE.x, CAFE.z, 4.6, 3.4, 0, 0, 2.2);
    cap(-7.5, -27.5, 1.6, 1.3, 0, 0, 0.9);
    const barn = mesh(roofGeo(5.0, 4.36, 1.86), snow, -14, heightAt(-14, 12.6) + 2.78, 12.6, false);
    barn.rotation.y = Math.PI;
    this.winter.add(barn);
    this.winter.add(this.iceRim());
    this.winter.visible = false;
    host.scene.add(this.winter);
    // particles that follow the camera
    this.tex = dotTexture();
    const pos = new Float32Array(MAX_P * 3), cols = new Float32Array(MAX_P * 3);
    this.pGeo = new THREE.BufferGeometry();
    this.pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.pGeo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    this.pMat = new THREE.PointsMaterial({ size: 0.22, map: this.tex, vertexColors: true, transparent: true, depthWrite: false, alphaTest: 0.05 });
    this.points = new THREE.Points(this.pGeo, this.pMat);
    this.points.frustumCulled = false;
    this.points.visible = false;
    host.scene.add(this.points);
    this.parts = [...Array(MAX_P)].map(() => ({ x: (Math.random() - 0.5) * 50, y: Math.random() * 16, z: (Math.random() - 0.5) * 40, ph: Math.random() * 6 }));
  }

  /** A pale, slightly see-through ribbon of ice on both sides of the river. */
  iceRim() {
    const verts = [], idx = [];
    const pts = RIVER_PTS.filter((p) => p.z > -31 && p.z < 44);
    for (const side of [-1, 1]) {
      const base = verts.length / 3;
      for (let i = 0; i < pts.length; i++) {
        const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
        let dx = b.x - a.x, dz = b.z - a.z;
        const L = Math.hypot(dx, dz) || 1;
        dx /= L; dz /= L;
        for (const off of [RIVER_W - 1.3, RIVER_W + 0.3]) {
          const r = off * side;
          verts.push(pts[i].x - dz * r, SEA_Y + 0.04, pts[i].z + dx * r);
        }
        if (i > 0) { const k = base + i * 2; idx.push(k - 2, k - 1, k, k - 1, k + 1, k); }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const mat = new THREE.MeshBasicMaterial({ color: 0xe6f6ff, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false });
    return new THREE.Mesh(g, mat);
  }

  leafMat(hex, season) {
    const key = `${hex}|${season}`;
    if (!this.mats.has(key)) {
      const m = new THREE.MeshToonMaterial({ color: LEAVES[hex][season], gradientMap: toon(0xffffff).gradientMap });
      this.mats.set(key, m);
    }
    return this.mats.get(key);
  }

  apply(season) {
    if (season === this.season) return;
    this.season = season;
    for (const L of this.leaves) L.m.material = season === 'summer' ? L.base : this.leafMat(L.hex, season);
    // ground tint
    const col = this.host.map.ground.geometry.attributes.color;
    const arr = col.array, base = this.groundBase, look = GROUND[season];
    const c = new THREE.Color(), grass = new THREE.Color(), sand = new THREE.Color();
    if (look?.grass) grass.set(look.grass[0]);
    if (look?.sand) sand.set(look.sand[0]);
    for (let i = 0; i < col.count; i++) {
      c.fromArray(base, i * 3);
      if (look && this.kind[i] === 1 && look.grass) c.lerp(grass, look.grass[1]);
      else if (look && this.kind[i] === 2 && look.sand) c.lerp(sand, look.sand[1]);
      c.toArray(arr, i * 3);
    }
    col.needsUpdate = true;
    this.winter.visible = season === 'winter';
    // particles of the season
    const P = PARTICLES[season];
    const cols = this.pGeo.attributes.color.array, cc = new THREE.Color();
    for (let i = 0; i < MAX_P; i++) { cc.set(P.colors?.[i % P.colors.length] ?? 0xffffff); cc.toArray(cols, i * 3); }
    this.pGeo.attributes.color.needsUpdate = true;
    this.pMat.size = P.size || 0.2;
    this.look = P;
  }

  /** Particles every frame. heavy: a snowy (rainy) winter day. */
  update(dt, { indoors, heavy }) {
    const P = this.look;
    const n = !P || indoors ? 0 : Math.min(MAX_P, heavy && this.season === 'winter' ? MAX_P : P.n);
    this.points.visible = n > 0;
    if (!n) return;
    this.pGeo.setDrawRange(0, n);
    const c = this.host.camTarget;
    const a = this.pGeo.attributes.position.array;
    const fall = P.fall * (heavy ? 1.6 : 1);
    for (let i = 0; i < n; i++) {
      const d = this.parts[i];
      d.y -= dt * fall;
      d.ph += dt;
      if (d.y < 0) { d.y = 14 + Math.random() * 4; d.x = (Math.random() - 0.5) * 50; d.z = (Math.random() - 0.5) * 40; }
      a[i * 3] = c.x + d.x + Math.sin(d.ph * 0.9 + i) * P.sway;
      a[i * 3 + 1] = d.y;
      a[i * 3 + 2] = c.z + d.z + Math.cos(d.ph * 0.7 + i) * P.sway * 0.5;
    }
    this.pGeo.attributes.position.needsUpdate = true;
  }
}
