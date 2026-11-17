import * as THREE from 'three';
import { toon, basic, sharedGeo, COLORS } from '../../../core/palette.js';

// Little helpers for the arcade games' toon models. Boards lie flat (x right, z toward the camera, y up);
// cell (c, r) of a cols x rows board sits at cx(c, cols), cz(r, rows), cell size 1.

export const BOX = (w, h, d) => sharedGeo(`arc-box${w}|${h}|${d}`, () => new THREE.BoxGeometry(w, h, d));
export const SPH = (r, a = 14, b = 10) => sharedGeo(`arc-sph${r}|${a}|${b}`, () => new THREE.SphereGeometry(r, a, b));
export const CYL = (rt, rb, h, s = 16) => sharedGeo(`arc-cyl${rt}|${rb}|${h}|${s}`, () => new THREE.CylinderGeometry(rt, rb, h, s));
export const CONE = (r, h, s = 12) => sharedGeo(`arc-cone${r}|${h}|${s}`, () => new THREE.ConeGeometry(r, h, s));
export const TOR = (r, t) => sharedGeo(`arc-tor${r}|${t}`, () => new THREE.TorusGeometry(r, t, 8, 24));

export function M(geo, color, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, typeof color === 'number' ? toon(color) : color);
  m.position.set(x, y, z);
  return m;
}
export const glow = (color, emissive) => toon(color, { emissive });
export { toon, basic, COLORS };

export const cx = (c, cols) => c - (cols - 1) / 2;
export const cz = (r, rows) => r - (rows - 1) / 2;

/** A flat board of cols x rows cells in two colours (a canvas texture; disposed with the scene). */
export function checker(cols, rows, a, b, { line = null } = {}) {
  const s = 16;
  const c = document.createElement('canvas');
  c.width = cols * s; c.height = rows * s;
  const g = c.getContext('2d');
  for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) {
    g.fillStyle = (r + k) % 2 ? b : a;
    g.fillRect(k * s, r * s, s, s);
  }
  if (line) { g.strokeStyle = line; g.lineWidth = 1; for (let k = 0; k <= cols; k++) { g.beginPath(); g.moveTo(k * s, 0); g.lineTo(k * s, rows * s); g.stroke(); } for (let r = 0; r <= rows; r++) { g.beginPath(); g.moveTo(0, r * s); g.lineTo(cols * s, r * s); g.stroke(); } }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(cols, rows), new THREE.MeshToonMaterial({ map: tex }));
  m.rotation.x = -Math.PI / 2;
  return m;
}

/** Two toon eyes looking toward +z (put them on a head). */
export function eyes(size = 1, gap = 0.15) {
  const g = new THREE.Group();
  for (const s of [-1, 1]) {
    const w = M(SPH(0.11 * size, 10, 8), 0xffffff, s * gap * size, 0, 0);
    w.scale.set(1, 1.15, 0.7);
    g.add(w, M(SPH(0.06 * size, 8, 6), COLORS.ink, s * gap * size, 0, 0.06 * size));
  }
  return g;
}

/** A dashed line of little dots (aim guides): set(points) places them along a polyline on the board. */
export class Dots {
  constructor(root, color = 0xffffff, n = 24, r = 0.07) {
    this.list = [];
    for (let i = 0; i < n; i++) { const d = M(SPH(r, 8, 6), basic(color)); d.visible = false; root.add(d); this.list.push(d); }
  }
  set(pts, step = 0.55, y = 0.3) {
    let i = 0, next = step * 0.5, acc = 0;
    for (let k = 1; k < pts.length; k++) {
      const a = pts[k - 1], b = pts[k];
      const L = Math.hypot(b.x - a.x, b.z - a.z);
      while (L > 0 && next <= acc + L && i < this.list.length) {
        const f = (next - acc) / L;
        const o = this.list[i++];
        o.visible = true;
        o.position.set(a.x + (b.x - a.x) * f, y, a.z + (b.z - a.z) * f);
        next += step;
      }
      acc += L;
    }
    for (; i < this.list.length; i++) this.list[i].visible = false;
  }
  hide() { for (const o of this.list) o.visible = false; }
}

/** Ease toward a value. */
export const ease = (a, b, k) => a + (b - a) * Math.min(1, k);
