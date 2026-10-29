import * as THREE from 'three';
import { toon, basic } from '../../core/palette.js';
import { makeSeagull } from '../adventure/props.js';
import { makeNpc as makeLhNpc } from '../lighthouse/models.js';
import { mesh, box, sph, cone } from './models.js';
import { heightAt, SEA_Y, RIVER, STORE, HAZEL_HOME, PIER } from './map.js';

// Ambient life on the solo island: gulls over the dock, butterflies by day, fireflies at night, ducks on
// the river, Hazel's chickens, Mitten the cat napping at the store, chimney smoke, jumping fish, and the
// little animations of the landmarks (balloon, lighthouse beam, tent ducks, fountain, flags...).

export class Life {
  constructor(host, map) {
    this.host = host;
    this.map = map;
    const scene = host.scene;
    this.t = 0;
    this.smokeT = 0;
    this.fishT = 3;
    // gulls
    this.gulls = [];
    for (let i = 0; i < 3; i++) {
      const g = makeSeagull();
      g.scale.setScalar(0.9);
      scene.add(g);
      this.gulls.push({ g, a: i * 2.1, r: 7 + i * 2.5, cx: PIER.x - 6 + i * 8, cz: PIER.z0 + 18 + i * 2, y: 3.5 + i * 0.6, sp: 0.35 + i * 0.07 });
    }
    // butterflies
    this.butterflies = [];
    const cols = [0xff7eb6, 0xffd23f, 0x8fd8ff, 0xc9a8ff, 0xffffff];
    const spots = [[6, 0], [-14, -12], [4, -24], [18, -2], [-6, 14], [30, 6], [22, -24], [-2, -4], [44, -2], [14, 26]];
    for (const [x, z] of spots) {
      const b = new THREE.Group();
      const wings = [];
      for (const s of [-1, 1]) {
        const w = new THREE.Group();
        const m = mesh(box(0.22, 0.02, 0.18), cols[this.butterflies.length % cols.length], s * 0.12, 0, 0, false);
        w.add(m);
        b.add(w);
        wings.push({ w, s });
      }
      b.add(mesh(box(0.04, 0.04, 0.2), 0x2b2340, 0, 0, 0, false));
      scene.add(b);
      this.butterflies.push({ b, wings, x, z, hx: x, hz: z, ph: Math.random() * 6 });
    }
    // fireflies (Points), shown at night near the river, forest and lamps
    const n = 60, pos = new Float32Array(n * 3);
    this.flies = [];
    for (let i = 0; i < n; i++) {
      const p = RIVER.getPoint(0.2 + Math.random() * 0.6);
      const x = i % 3 === 0 ? p.x + (Math.random() - 0.5) * 10 : -60 + Math.random() * 120;
      const z = i % 3 === 0 ? p.z + (Math.random() - 0.5) * 10 : -30 + Math.random() * 64;
      this.flies.push({ x, z, ph: Math.random() * 10, y: heightAt(x, z) });
    }
    this.flyGeo = new THREE.BufferGeometry();
    this.flyGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.flyMat = new THREE.PointsMaterial({ color: 0xfff27a, size: 0.28, transparent: true, opacity: 0, depthWrite: false });
    this.flyPts = new THREE.Points(this.flyGeo, this.flyMat);
    this.flyPts.frustumCulled = false;
    scene.add(this.flyPts);
    // ducks on the river
    this.ducks = [];
    for (let i = 0; i < 3; i++) {
      const d = new THREE.Group();
      d.add(mesh(sph(0.28, 10, 8), 0xffffff, 0, 0.12, 0), mesh(sph(0.17, 10, 8), 0x3f9a32, 0.18, 0.35, 0), mesh(cone(0.07, 0.2, 6), 0xffb020, 0.38, 0.33, 0, false).rotateZ(-Math.PI / 2));
      d.children[0].scale.set(1.3, 0.7, 1);
      scene.add(d);
      this.ducks.push({ d, u: 0.32 + i * 0.05, dir: i % 2 ? 1 : -1 });
    }
    // chickens by Hazel's coop
    this.chickens = [];
    for (let i = 0; i < 3; i++) {
      const c = new THREE.Group();
      c.add(mesh(sph(0.22, 10, 8), 0xffffff, 0, 0.25, 0), mesh(sph(0.14, 10, 8), 0xffffff, 0.15, 0.45, 0), mesh(box(0.06, 0.1, 0.04), 0xff5d73, 0.17, 0.6, 0, false), mesh(cone(0.05, 0.12, 5), 0xffb020, 0.3, 0.44, 0, false).rotateZ(-Math.PI / 2));
      scene.add(c);
      this.chickens.push({ c, x: HAZEL_HOME.x - 5 - i, z: HAZEL_HOME.z + 2.5 + i * 0.4, tx: 0, tz: 0, wait: Math.random() * 2, peck: 0 });
    }
    // Mitten the cat napping on the store porch
    this.cat = makeLhNpc('mitten');
    this.cat.group.position.set(STORE.x + 4.4, 0.75, STORE.z + 0.5);
    this.cat.group.rotation.y = -0.6;
    scene.add(this.cat.group);
    // a fish that jumps now and then
    this.fish = mesh(sph(0.22, 10, 8), 0xff8c42, 0, -5, 0, false);
    this.fish.scale.set(1.6, 0.8, 0.6);
    scene.add(this.fish);
    this.fishJump = null;
    // water sparkles
    this.sparkles = [];
    for (let i = 0; i < 40; i++) {
      const s = mesh(box(0.3, 0.02, 0.06), basic(0xffffff), 0, SEA_Y + 0.03, 0, false);
      const a = Math.random() * Math.PI * 2;
      const r = 58 + Math.random() * 20;
      s.position.x = Math.cos(a) * r;
      s.position.z = Math.sin(a) * r * 0.85;
      s.userData.ph = Math.random() * 6;
      scene.add(s);
      this.sparkles.push(s);
    }
  }

  update(dt, night, playerPos) {
    this.t += dt;
    const t = this.t;
    const map = this.map;
    for (const s of this.gulls) {
      s.a += dt * s.sp;
      s.g.position.set(s.cx + Math.cos(s.a) * s.r, s.y + Math.sin(t * 0.7 + s.a) * 0.5, s.cz + Math.sin(s.a) * s.r);
      s.g.rotation.y = -s.a - Math.PI;
      for (const [i, w] of s.g.userData.wings.entries()) w.rotation.x = (i ? 1 : -1) * Math.sin(t * 6 + s.a) * 0.6;
    }
    const day = night < 0.5;
    for (const b of this.butterflies) {
      b.b.visible = day;
      if (!day) continue;
      b.ph += dt;
      b.x = b.hx + Math.sin(b.ph * 0.5) * 2.5 + Math.sin(b.ph * 1.3) * 0.6;
      b.z = b.hz + Math.cos(b.ph * 0.4) * 2.0;
      b.b.position.set(b.x, heightAt(b.x, b.z) + 0.9 + Math.sin(b.ph * 3) * 0.3, b.z);
      b.b.rotation.y = b.ph * 0.5;
      for (const { w, s } of b.wings) w.rotation.z = s * Math.sin(b.ph * 18) * 0.9;
    }
    this.flyMat.opacity = Math.max(0, night - 0.3) * 1.4;
    if (this.flyMat.opacity > 0) {
      const arr = this.flyGeo.attributes.position.array;
      this.flies.forEach((f, i) => {
        arr[i * 3] = f.x + Math.sin(t * 0.6 + f.ph) * 1.2;
        arr[i * 3 + 1] = f.y + 0.8 + Math.sin(t * 1.3 + f.ph * 2) * 0.4;
        arr[i * 3 + 2] = f.z + Math.cos(t * 0.5 + f.ph) * 1.2;
      });
      this.flyGeo.attributes.position.needsUpdate = true;
    }
    for (const d of this.ducks) {
      d.u += d.dir * dt * 0.004;
      if (d.u > 0.72 || d.u < 0.3) d.dir *= -1;
      const p = RIVER.getPoint(d.u), q = RIVER.getPoint(d.u + 0.01 * d.dir);
      d.d.position.set(p.x + Math.sin(t + d.u * 50) * 0.6, SEA_Y + Math.sin(t * 2 + d.u * 20) * 0.03, p.z);
      d.d.rotation.y = Math.atan2(q.x - p.x, q.z - p.z) - Math.PI / 2;
    }
    for (const c of this.chickens) {
      c.wait -= dt;
      if (c.wait <= 0 && !c.tx) {
        const a = Math.random() * Math.PI * 2;
        c.tx = HAZEL_HOME.x - 6 + Math.cos(a) * 2.2;
        c.tz = HAZEL_HOME.z + 3 + Math.sin(a) * 1.4;
      }
      if (c.tx) {
        const dx = c.tx - c.x, dz = c.tz - c.z, d = Math.hypot(dx, dz);
        if (d < 0.1) { c.tx = 0; c.wait = 1 + Math.random() * 3; c.peck = 1; } else {
          c.x += (dx / d) * dt * 1.2;
          c.z += (dz / d) * dt * 1.2;
          c.c.rotation.y = Math.atan2(dx, dz) - Math.PI / 2;
        }
      }
      c.peck = Math.max(0, c.peck - dt * 1.5);
      c.c.position.set(c.x, heightAt(c.x, c.z) + Math.abs(Math.sin(t * 10)) * (c.tx ? 0.05 : 0), c.z);
      c.c.rotation.z = -Math.sin(c.peck * Math.PI * 4) * 0.4;
    }
    this.cat.update(dt, {});
    // chimney smoke
    this.smokeT -= dt;
    if (this.smokeT <= 0) {
      this.smokeT = 0.5;
      for (const ch of map.chimneys) this.host.puffs.burst(ch, 0xf2f2f2, { count: 1, speed: 0.4, up: 1.4, size: 0.35, life: 2.2, gravity: 0.6 });
      const wf = map.waterfall;
      this.host.puffs.burst(new THREE.Vector3(wf.x + (Math.random() - 0.5) * 3, SEA_Y + 0.2, wf.z), 0xffffff, { count: 2, speed: 1.2, up: 1.2, size: 0.4, life: 0.8 });
    }
    // a fish jumps near the dock
    this.fishT -= dt;
    if (this.fishT <= 0 && !this.fishJump) {
      this.fishT = 4 + Math.random() * 6;
      const x = playerPos.x + (Math.random() - 0.5) * 24, z = Math.max(playerPos.z + 6, 50) + Math.random() * 6;
      if (heightAt(x, z) < -0.8) this.fishJump = { x, z, t: 0, dir: Math.random() < 0.5 ? 1 : -1 };
    }
    if (this.fishJump) {
      const f = this.fishJump;
      f.t += dt;
      const k = f.t / 0.9;
      this.fish.position.set(f.x + f.dir * k * 1.6, SEA_Y + Math.sin(k * Math.PI) * 1.4, f.z);
      this.fish.rotation.z = f.dir * (0.9 - k * 1.8);
      if (k >= 1) {
        this.host.puffs.burst(new THREE.Vector3(f.x + f.dir * 1.6, SEA_Y + 0.1, f.z), 0xffffff, { count: 8, speed: 2, up: 2, size: 0.25, life: 0.6 });
        this.fish.position.y = -5;
        this.fishJump = null;
      }
    }
    for (const s of this.sparkles) {
      const k = (Math.sin(t * 2 + s.userData.ph) + 1) / 2;
      s.scale.setScalar(0.3 + k);
    }
    // landmarks
    if (map.balloon) {
      const b = map.balloon.userData.balloon;
      b.position.y = 4.4 + Math.sin(t * 0.8) * 0.25;
      b.rotation.y = Math.sin(t * 0.3) * 0.2;
    }
    if (map.lighthouse) map.lighthouse.userData.beam.rotation.y += dt * 0.7;
    if (map.tent) map.tent.userData.ducks.children.forEach((d, i) => { d.position.x = -1.8 + ((i * 0.8 + t * 0.6) % 4); d.rotation.z = Math.sin(t * 4 + i) * 0.1; });
    if (map.fountain) map.fountain.userData.spout.scale.setScalar(1 + Math.sin(t * 5) * 0.15);
    if (map.hall) for (const c of map.hall.userData.cabinets) c.icon.rotation.y += dt * 0.8;
    if (map.boat) { map.boat.position.y = SEA_Y + 0.05 + Math.sin(t * 1.4) * 0.05; map.boat.rotation.z = Math.sin(t * 1.1) * 0.05; }
    if (map.ship) { map.ship.rotation.z = Math.sin(t * 0.7) * 0.02; map.ship.position.y = SEA_Y - 0.1 + Math.sin(t * 0.9) * 0.06; }
    for (const d of this.host.decoViews?.values() || []) {
      if (d.userData.spin) d.userData.spin.rotation.y += dt * 1.2;
      if (d.userData.wave) d.userData.wave.rotation.y = Math.sin(t * 2) * 0.25;
    }
  }
}
