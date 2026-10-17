import * as THREE from 'three';
import { Particles } from './particles.js';

export class BaseScene {
  constructor(game) {
    this.game = game;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 400);
    this.confetti = new Particles(this.scene, { max: 700, shape: 'box' });
    this.puffs = new Particles(this.scene, { max: 300, shape: 'puff' });
    this.time = 0;
    this.timers = [];
  }

  /** Run fn after `seconds` of game time (pauses with the scene, unlike setTimeout). */
  later(seconds, fn) {
    this.timers.push({ t: seconds, fn });
  }

  get players() {
    return this.game.roster.players;
  }

  input(p) {
    return this.game.input.get(p.deviceId);
  }

  resize(w, h) {
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /** Visible half-width/height of the plane at the given camera distance. */
  viewHalfSize(dist) {
    const h = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * dist;
    return { w: h * this.camera.aspect, h };
  }

  /** Camera distance needed to fit a w x h rectangle facing the camera. */
  fitDistance(w, h) {
    const t = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    return Math.max(h / 2 / t, w / 2 / (t * this.camera.aspect));
  }

  baseUpdate(dt) {
    this.time += dt;
    if (this.timers.length) {
      const due = [];
      for (const tm of this.timers) if ((tm.t -= dt) <= 0) due.push(tm);
      if (due.length) {
        this.timers = this.timers.filter((tm) => tm.t > 0);
        for (const tm of due) tm.fn();
      }
    }
    this.confetti.update(dt);
    this.puffs.update(dt);
  }

  update() {}

  dispose() {
    this.scene.traverse((o) => {
      if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose();
      const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      for (const m of mats) {
        if (m.userData.shared) continue;
        if (m.map && !m.map.userData.shared) m.map.dispose();
        m.dispose();
      }
    });
    if (this.scene.background?.dispose) this.scene.background.dispose();
  }
}
