import * as THREE from 'three';
import { COLORS, toon, sharedGeo, faceted } from './palette.js';

export function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function addLights(scene, { size = 30, target = new THREE.Vector3(), dir = new THREE.Vector3(-0.5, 1, 0.6) } = {}) {
  const hemi = new THREE.HemisphereLight(0xffffff, 0x9ad48a, 1.5);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff2dd, 1.9);
  sun.position.copy(target).add(dir.clone().normalize().multiplyScalar(40));
  sun.target.position.copy(target);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const c = sun.shadow.camera;
  c.left = -size; c.right = size; c.top = size; c.bottom = -size;
  c.near = 1; c.far = 120;
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.02;
  scene.add(sun, sun.target);
  return { hemi, sun };
}

/** Screen-space vertical gradient used as scene.background. */
export function skyTexture(top = '#7fd3ff', bottom = '#fff1d6') {
  const c = document.createElement('canvas');
  c.width = 4; c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, top);
  grad.addColorStop(1, bottom);
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const ico = (r, d = 0) => sharedGeo(`ico${r}|${d}`, () => faceted(new THREE.IcosahedronGeometry(r, d)));
const sph = (r) => sharedGeo(`wsph${r}`, () => new THREE.SphereGeometry(r, 16, 12));

export function makeTree(rand = Math.random, scale = 1) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(sharedGeo('trunk', () => new THREE.CylinderGeometry(0.22, 0.32, 1.6, 8)), toon(COLORS.trunk));
  trunk.position.y = 0.8;
  trunk.castShadow = true;
  g.add(trunk);
  const leaf = rand() < 0.5 ? COLORS.leaf : COLORS.leafLight;
  const blobs = [[0, 2.1, 0, 1.1], [0.55, 1.75, 0.2, 0.75], [-0.5, 1.8, -0.15, 0.8], [0.05, 2.75, 0.05, 0.7]];
  for (const [x, y, z, r] of blobs) {
    const b = new THREE.Mesh(ico(1, 1), toon(leaf, { flat: true }));
    b.position.set(x, y, z);
    b.scale.setScalar(r);
    b.castShadow = true;
    g.add(b);
  }
  g.scale.setScalar(scale);
  g.rotation.y = rand() * Math.PI * 2;
  return g;
}

export function makeCloud(rand = Math.random, scale = 1) {
  const g = new THREE.Group();
  const n = 3 + Math.floor(rand() * 3);
  for (let i = 0; i < n; i++) {
    const b = new THREE.Mesh(sph(1), toon(COLORS.cloud));
    const t = i / (n - 1) - 0.5;
    b.position.set(t * 2.6, Math.sin((i / (n - 1)) * Math.PI) * 0.5, (rand() - 0.5) * 0.4);
    b.scale.setScalar(0.7 + Math.sin((i / (n - 1)) * Math.PI) * 0.5);
    g.add(b);
  }
  g.scale.set(scale, scale * 0.8, scale);
  return g;
}

const FLOWER_COLORS = [0xff7eb6, 0xffd23f, 0xffffff, 0xb08bff, 0xff8c42];
export function makeFlower(rand = Math.random) {
  const g = new THREE.Group();
  const stem = new THREE.Mesh(sharedGeo('stem', () => new THREE.CylinderGeometry(0.03, 0.03, 0.4, 5)), toon(COLORS.grassDark));
  stem.position.y = 0.2;
  g.add(stem);
  const col = FLOWER_COLORS[Math.floor(rand() * FLOWER_COLORS.length)];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const p = new THREE.Mesh(sph(0.08), toon(col));
    p.position.set(Math.cos(a) * 0.09, 0.42, Math.sin(a) * 0.09);
    p.scale.set(1, 0.5, 1);
    g.add(p);
  }
  const c = new THREE.Mesh(sph(0.06), toon(col === 0xffd23f ? 0xff8c42 : 0xffd23f));
  c.position.y = 0.44;
  g.add(c);
  return g;
}

export function makeRock(rand = Math.random, scale = 1) {
  const m = new THREE.Mesh(ico(1, 0), toon(rand() < 0.5 ? COLORS.rock : COLORS.rockDark, { flat: true }));
  m.scale.set(scale * (0.9 + rand() * 0.4), scale * (0.6 + rand() * 0.3), scale * (0.9 + rand() * 0.4));
  m.rotation.set(rand(), rand() * 6, rand());
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export function makeBush(rand = Math.random, scale = 1) {
  const g = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const b = new THREE.Mesh(ico(0.5, 1), toon(COLORS.leaf, { flat: true }));
    b.position.set((i - 1) * 0.45, 0.3 + (i === 1 ? 0.15 : 0), (rand() - 0.5) * 0.3);
    b.scale.setScalar(0.8 + rand() * 0.4);
    b.castShadow = true;
    g.add(b);
  }
  g.scale.setScalar(scale);
  return g;
}

/** Puffy five-point star used as the collectible everywhere. */
export function starGeometry() {
  return sharedGeo('star', () => {
    const shape = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? 0.5 : 0.24;
      const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
      const x = Math.cos(a) * r, y = Math.sin(a) * r;
      if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
    }
    shape.closePath();
    const g = new THREE.ExtrudeGeometry(shape, { depth: 0.14, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.07, bevelSegments: 3 });
    g.center();
    return g;
  });
}

export function makeStar(color = COLORS.gold) {
  const m = new THREE.Mesh(starGeometry(), toon(color, { emissive: 0x332200 }));
  m.castShadow = true;
  return m;
}

export function makeGem(color = 0x4cc9f0) {
  const m = new THREE.Mesh(sharedGeo('gem', () => new THREE.OctahedronGeometry(0.28, 0)), toon(color, { flat: true, emissive: 0x111122 }));
  m.scale.y = 1.3;
  m.castShadow = true;
  return m;
}

export function makeMushroom(capColor = 0xff5d73) {
  const g = new THREE.Group();
  const stem = new THREE.Mesh(sharedGeo('mushStem', () => new THREE.CylinderGeometry(0.35, 0.45, 0.7, 12)), toon(COLORS.icing));
  stem.position.y = 0.35;
  const cap = new THREE.Mesh(sharedGeo('mushCap', () => new THREE.SphereGeometry(0.9, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2)), toon(capColor));
  cap.position.y = 0.6;
  cap.scale.y = 0.75;
  g.add(stem, cap);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const dot = new THREE.Mesh(sph(0.13), toon(COLORS.white));
    dot.position.set(Math.cos(a) * 0.55, 1.1, Math.sin(a) * 0.55);
    dot.scale.y = 0.4;
    g.add(dot);
  }
  stem.castShadow = cap.castShadow = true;
  g.userData.cap = cap;
  return g;
}
