import * as THREE from 'three';
import { toScreen } from './mouse.js';

// The dark keep (mixed into the scene): dungeon floors are dim, with a warm circle of light around
// the hero; grumbles come out of the gloom. Town stays bright and sunny.
//   light radius = 7 + 0.8 per "+light radius" on gear (world units; a floor tile is 2), and up to
//   +2.5 more next to a torch.
// Cheap on purpose: one point light that follows the hero (the four torch lamps are the scene's own),
// dimmer sun and sky light, and a screen-space darkness (a CSS radial gradient centered on the hero)
// that sits under the item labels, so names stay readable.

const BRIGHT = { hemi: 1.35, sun: 1.55 };
const DARK = { hemi: 0.42, sun: 0.3 };

export const LightMixin = {
  initLight(L) {
    this.hemi = L.hemi;
    this.heroLight = new THREE.PointLight(0xffc98a, 0, 16, 1.3);
    this.scene.add(this.heroLight);
    this.darkEl = document.createElement('div');
    this.darkEl.className = 'ks-darkness';
    this.game.ui.labels.insertBefore(this.darkEl, this.game.ui.labels.firstChild);
    this.darkK = 0; // 0 = town light, 1 = dungeon dark
    this.lightR = 7;
  },

  /** How far the hero's light reaches right now. */
  lightRadius() {
    const e = this.hero;
    let r = 7 + 0.8 * (e.st.light || 0);
    let torch = 0;
    for (const tc of this.torches || []) {
      const d = Math.hypot(tc.x - e.x, tc.z - e.z);
      if (d < 7) torch = Math.max(torch, 1 - Math.max(0, d - 2.5) / 4.5);
    }
    return r + 2.5 * torch;
  },

  updateLight(dt, snap = false) {
    const dark = this.kind === 'dungeon' && this.mode !== 'pick' ? 1 : 0;
    this.darkK = snap ? dark : this.darkK + (dark - this.darkK) * Math.min(1, dt * 3);
    if (Math.abs(this.darkK - dark) < 0.01) this.darkK = dark;
    const k = this.darkK;
    this.hemi.intensity = BRIGHT.hemi + (DARK.hemi - BRIGHT.hemi) * k;
    this.sun.intensity = BRIGHT.sun + (DARK.sun - BRIGHT.sun) * k;
    const e = this.hero;
    const R = this.lightRadius();
    this.lightR += (R - this.lightR) * Math.min(1, (snap ? 1 : dt * 3));
    this.heroLight.intensity = 16 * k;
    this.heroLight.distance = this.lightR * 1.7;
    this.heroLight.position.set(e.x, 3.2 + (e.leapY || 0), e.z);
    if (k <= 0.01) { if (this.darkEl.style.display !== 'none') this.darkEl.style.display = 'none'; return; }
    // the darkness: clear inside the light circle, deep blue-purple outside
    const c = toScreen(this.camera, e.x, 0.6, e.z);
    const edge = toScreen(this.camera, e.x + this.lightR, 0.6, e.z);
    const rpx = Math.max(40, Math.abs(edge.x - c.x));
    const a = (0.93 * k).toFixed(2);
    this.darkEl.style.display = 'block';
    this.darkEl.style.background = `radial-gradient(ellipse ${(rpx * 1.15).toFixed(0)}px ${(rpx * 0.95).toFixed(0)}px at ${c.x.toFixed(0)}px ${c.y.toFixed(0)}px, rgba(12,8,30,0) 0%, rgba(12,8,30,0) 50%, rgba(12,8,30,${(a * 0.7).toFixed(2)}) 82%, rgba(12,8,30,${a}) 100%)`;
  },
};
