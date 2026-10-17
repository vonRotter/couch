import * as THREE from 'three';
import { Character } from '../../core/character.js';

/**
 * One Party Mix round. The party scene owns the renderer scene, camera, lights and
 * particles; a round adds its own group and cleans it up in dispose().
 * Set `done = true` when the round is over; `score(p)` is higher-is-better.
 */
export class Round {
  constructor(party) {
    this.party = party;
    this.game = party.game;
    this.scene = party.scene;
    this.camera = party.camera;
    this.players = party.players;
    this.group = new THREE.Group();
    this.scene.add(this.group);
    this.labels = [];
    this.done = false;
    this.disposed = false;
    this.time = 0;
  }

  input(p) {
    return this.party.input(p) || { x: 0, y: 0, a: false, b: false, aPressed: false, bPressed: false, stepX: 0, stepY: 0 };
  }

  /** Game-time timer that is dropped if the round ends first. */
  later(seconds, fn) {
    this.party.later(seconds, () => { if (!this.disposed) fn(); });
  }

  bean(p) {
    const ch = new Character(p.color, { hat: p.hat });
    this.group.add(ch.group);
    return ch;
  }

  label(className = 'label') {
    const el = this.game.ui.label(className);
    this.labels.push(el);
    return el;
  }

  setLabel(el, text, pos, color) {
    if (el.dataset.text !== text) { el.innerHTML = text; el.dataset.text = text; }
    if (color) el.style.color = color;
    this.game.ui.place(el, pos, this.camera);
  }

  frame() {}
  start() {}
  update() {}
  hud() { return ''; }
  score() { return 0; }
  detail() { return ''; }

  hideLabels() {
    for (const el of this.labels) el.remove();
    this.labels = [];
  }

  dispose() {
    this.disposed = true;
    this.hideLabels();
    this.scene.remove(this.group);
    this.group.traverse((o) => {
      if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose();
      const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      for (const m of mats) {
        if (m.userData.shared) continue;
        if (m.map && !m.map.userData.shared) m.map.dispose();
        m.dispose();
      }
    });
  }
}

export function clock(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  return `<div class="pill"><b>${s}</b></div>`;
}

/** Ground disc helper used by several rounds. */
export function disc(r, color, mat) {
  const m = new THREE.Mesh(new THREE.CircleGeometry(r, 48), mat(color));
  m.rotation.x = -Math.PI / 2;
  m.receiveShadow = true;
  return m;
}
