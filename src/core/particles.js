import * as THREE from 'three';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();
const _c = new THREE.Color();

/** Pooled instanced particles: confetti cubes or soft puffs. */
export class Particles {
  constructor(scene, { max = 600, shape = 'box' } = {}) {
    const geo = shape === 'box' ? new THREE.BoxGeometry(1, 1, 1) : new THREE.IcosahedronGeometry(0.5, 1);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.mesh = new THREE.InstancedMesh(geo, mat, max);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    for (let i = 0; i < max; i++) this.mesh.setColorAt(i, _c.set(0xffffff));
    scene.add(this.mesh);
    this.max = max;
    this.list = [];
  }

  burst(pos, color, { count = 12, speed = 4, up = 3, size = 0.16, life = 0.8, gravity = -14, spread = 1, colors = null, drag = 1.5 } = {}) {
    for (let i = 0; i < count && this.list.length < this.max; i++) {
      const a = Math.random() * Math.PI * 2;
      const e = (Math.random() - 0.3) * Math.PI;
      const sp = speed * (0.4 + Math.random() * 0.6);
      this.list.push({
        x: pos.x + (Math.random() - 0.5) * 0.2 * spread,
        y: pos.y + (Math.random() - 0.5) * 0.2 * spread,
        z: pos.z + (Math.random() - 0.5) * 0.2 * spread,
        vx: Math.cos(a) * Math.cos(e) * sp,
        vy: Math.sin(e) * sp * 0.6 + up * (0.5 + Math.random() * 0.5),
        vz: Math.sin(a) * Math.cos(e) * sp,
        rx: Math.random() * 6, ry: Math.random() * 6,
        vr: (Math.random() - 0.5) * 16,
        life: life * (0.6 + Math.random() * 0.4),
        max: life,
        size: size * (0.6 + Math.random() * 0.8),
        color: colors ? colors[(Math.random() * colors.length) | 0] : color,
        gravity, drag,
      });
    }
  }

  update(dt) {
    const L = this.list;
    for (let i = L.length - 1; i >= 0; i--) {
      const p = L[i];
      p.life -= dt;
      if (p.life <= 0) {
        L[i] = L[L.length - 1];
        L.pop();
        continue;
      }
      p.vy += p.gravity * dt;
      const d = Math.max(0, 1 - p.drag * dt);
      p.vx *= d; p.vz *= d;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      p.rx += p.vr * dt; p.ry += p.vr * 0.7 * dt;
    }
    for (let i = 0; i < L.length; i++) {
      const p = L[i];
      const k = Math.min(1, p.life / (p.max * 0.4));
      _p.set(p.x, p.y, p.z);
      _q.setFromEuler(_e.set(p.rx, p.ry, 0));
      _s.setScalar(p.size * k);
      _m.compose(_p, _q, _s);
      this.mesh.setMatrixAt(i, _m);
      this.mesh.setColorAt(i, _c.set(p.color));
    }
    this.mesh.count = L.length;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}
