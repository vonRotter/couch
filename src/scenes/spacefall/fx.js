import * as THREE from 'three';
import { rand, TAU } from './util.js';

// Pooled glowing point sparks (engine exhaust, missile trails, explosion flashes) drawn in one
// call. Ported from Spacefall. Sizes are in world units; setViewportHeight() must be called before
// each viewport is rendered because point sizes depend on the viewport's pixel height.
// Confetti and puffs (the Couch particle systems) handle debris and smoke on top of this.

const MAX = 4000;

const vert = /* glsl */ `
attribute float size;
attribute float alpha;
attribute vec3 tint;
uniform float uScale;
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = size * uScale / -mv.z;
  gl_Position = projectionMatrix * mv;
  vColor = tint;
  vAlpha = alpha;
}`;

const frag = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float a = smoothstep(1.0, 0.0, d);
  a *= a;
  gl_FragColor = vec4(vColor, a * vAlpha);
}`;

const tmpColor = new THREE.Color();

export class Sparks {
  /** additive: glow on dark space backdrops; normal blending reads better on the sunny grove. */
  constructor(scene, { additive = true } = {}) {
    this.count = 0;
    this.pos = new Float32Array(MAX * 3);
    this.col = new Float32Array(MAX * 3);
    this.size = new Float32Array(MAX);
    this.alpha = new Float32Array(MAX);
    this.vel = new Float32Array(MAX * 2);
    this.life = new Float32Array(MAX);
    this.maxLife = new Float32Array(MAX);
    this.size0 = new Float32Array(MAX);
    this.size1 = new Float32Array(MAX);
    this.drag = new Float32Array(MAX);
    this.grav = new Float32Array(MAX);
    this.alpha0 = new Float32Array(MAX);
    const geo = new THREE.BufferGeometry();
    const attr = (arr, n) => new THREE.BufferAttribute(arr, n).setUsage(THREE.DynamicDrawUsage);
    this.attrs = { position: attr(this.pos, 3), tint: attr(this.col, 3), size: attr(this.size, 1), alpha: attr(this.alpha, 1) };
    for (const [k, a] of Object.entries(this.attrs)) geo.setAttribute(k, a);
    geo.setDrawRange(0, 0);
    this.material = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: 500 } },
      vertexShader: vert,
      fragmentShader: frag,
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 10;
    this.geo = geo;
    scene.add(this.points);
  }

  setViewportHeight(px, fovDeg) {
    this.material.uniforms.uScale.value = px / (2 * Math.tan((fovDeg * Math.PI) / 360));
  }

  clear() {
    this.count = 0;
    this.geo.setDrawRange(0, 0);
  }

  emit(x, y, z, vx, vy, life, size0, size1, color, opts = {}) {
    if (this.count >= MAX) return;
    const i = this.count++;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 2] = vx; this.vel[i * 2 + 1] = vy;
    this.life[i] = life; this.maxLife[i] = life;
    this.size0[i] = size0; this.size1[i] = size1;
    tmpColor.set(color);
    this.col[i * 3] = tmpColor.r; this.col[i * 3 + 1] = tmpColor.g; this.col[i * 3 + 2] = tmpColor.b;
    this.drag[i] = opts.drag ?? 2;
    this.grav[i] = opts.gravity ?? 0;
    this.alpha0[i] = opts.alpha ?? 1;
    this.size[i] = size0;
    this.alpha[i] = this.alpha0[i];
  }

  burst(x, y, color, count, speed, life = 0.6, size = 0.35, opts = {}) {
    for (let n = 0; n < count; n++) {
      const a = rand(0, TAU), s = speed * Math.sqrt(Math.random());
      this.emit(x, y, rand(-0.3, 0.3), Math.cos(a) * s, Math.sin(a) * s, life * rand(0.5, 1.2), size * rand(0.6, 1.3), 0, color, opts);
    }
  }

  /** Cartoon explosion: a white flash, a fireball, colored sparks and a little dust. */
  explosion(x, y, color, big = false) {
    const k = big ? 1.7 : 1;
    this.burst(x, y, 0xffffff, 10 * k, 3 * k, 0.25, 1.4 * k, { drag: 6 });
    this.burst(x, y, 0xffc060, 26 * k, 7 * k, 0.55, 0.6 * k, { drag: 3.5 });
    this.burst(x, y, color, 30 * k, 9 * k, 0.9, 0.35 * k, { drag: 2.5 });
  }

  update(dt) {
    let i = 0;
    while (i < this.count) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this.copy(--this.count, i);
        continue;
      }
      const t = 1 - this.life[i] / this.maxLife[i];
      const d = Math.exp(-this.drag[i] * dt);
      this.vel[i * 2] *= d;
      this.vel[i * 2 + 1] = this.vel[i * 2 + 1] * d - this.grav[i] * dt;
      this.pos[i * 3] += this.vel[i * 2] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 2 + 1] * dt;
      this.size[i] = this.size0[i] + (this.size1[i] - this.size0[i]) * t;
      this.alpha[i] = this.alpha0[i] * (1 - t * t);
      i++;
    }
    this.geo.setDrawRange(0, this.count);
    for (const a of Object.values(this.attrs)) a.needsUpdate = true;
  }

  copy(from, to) {
    if (from === to) return;
    for (let k = 0; k < 3; k++) {
      this.pos[to * 3 + k] = this.pos[from * 3 + k];
      this.col[to * 3 + k] = this.col[from * 3 + k];
    }
    this.vel[to * 2] = this.vel[from * 2];
    this.vel[to * 2 + 1] = this.vel[from * 2 + 1];
    for (const arr of [this.life, this.maxLife, this.size0, this.size1, this.size, this.drag, this.grav, this.alpha0, this.alpha]) arr[to] = arr[from];
  }
}
