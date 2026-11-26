import * as THREE from 'three';
import { calmOn } from '../../core/assist.js';
import { GLOW, markGlow, glowBlend } from '../../core/gfx.js';

// The solo island's side of the graphics trial (core/gfx.js has the switches and the post-processing chain).
// Each look is switched on and off here every frame from game.gfx.on, so a change in the settings shows at once.
//
// Glow and colour: the bloom picks up only what carries the glow mark (core/gfx.js markGlow): lamps and lanterns, lit
// windows, the lighthouse lamp and beam, the arcade screens, the greenhouse lamps and fireflies at night; the magic
// ball and its aim dots and the ghost ship's lanterns always. While the island is drawn they are also a little
// brighter (and put back after). The colour grade follows the hour and the season (GRADE below).

// [hour, [r, g, b] tint, saturation]: warm morning, neutral day, golden evening, cool blue night
const GRADE = [
  [0, [0.9, 0.96, 1.1], 0.95], [4.6, [0.9, 0.96, 1.1], 0.95],
  [6, [1.08, 1.0, 0.9], 1.04], [8.5, [1.05, 1.0, 0.94], 1.04], [10.5, [1, 1, 1], 1.03],
  [16, [1, 1, 1], 1.03], [18.5, [1.08, 1.0, 0.86], 1.06], [20, [1.0, 0.95, 1.05], 1.0],
  [21.5, [0.9, 0.96, 1.1], 0.95], [24, [0.9, 0.96, 1.1], 0.95],
];
// the season on top: winter a little cooler and brighter, autumn a little warmer, spring a little fresher
const SEASON_TINT = { spring: [[1, 1.01, 1], 1.02], summer: [[1, 1, 1], 1], autumn: [[1.03, 1, 0.96], 1.02], winter: [[1.0, 1.03, 1.08], 0.97] };

function gradeAt(h, season) {
  let i = 0;
  while (i < GRADE.length - 2 && GRADE[i + 1][0] <= h) i++;
  const [h0, a, sa] = GRADE[i], [h1, b, sb] = GRADE[i + 1];
  const k = h1 > h0 ? THREE.MathUtils.clamp((h - h0) / (h1 - h0), 0, 1) : 0;
  const [st, ss] = SEASON_TINT[season] || SEASON_TINT.summer;
  return { tint: [0, 1, 2].map((c) => (a[c] + (b[c] - a[c]) * k) * st[c]), sat: (sa + (sb - sa) * k) * ss };
}

export class IslandLook {
  constructor(host) {
    this.host = host;
    this.gfx = host.game.gfx;
    this.t = 0;
    this.pulse = 0; // the bloom's slow breath now (0 with "Reduce flashing")
    this.saved = [];
    this.ownBall();
  }

  /** The magic ball's little stars share a material with other things: give the ball its own, so only it glows. */
  ownBall() {
    const B = this.host.odd?.ball;
    this.ballMats = new Set();
    for (const g of [B?.ball, B?.handBall]) {
      g?.traverse((o) => {
        if (!o.isMesh || !o.material?.isMeshBasicMaterial) return;
        o.material = o.material.clone();
        o.material.userData = {};
        this.ballMats.add(o.material);
      });
    }
    if (B?.dots?.children[0]) this.ballMats.add(B.dots.children[0].material);
  }

  /** The glowing materials: { night: [opaque], always: [opaque], blend: [see-through] }. */
  glowMats() {
    const H = this.host, M = H.M;
    return {
      night: [M.lamp, M.win, M.screen, H.story?.lampMat, H.greenhouse?.lampMat, ...Object.values(M.home || {})].filter(Boolean),
      always: [...this.ballMats].filter((m) => !m.transparent).concat((H.events?.lanterns || []).map((l) => l.material)),
      blend: [M.beam, H.life?.flyMat, ...[...this.ballMats].filter((m) => m.transparent)].filter(Boolean),
    };
  }

  /** [material, 'color' | 'emissive', factor]: a little brighter while drawn with the glow (at night). */
  boostList() {
    const H = this.host, M = H.M;
    const lit = this.lit;
    const out = [];
    const add = (m, prop, k) => { if (m && k > 1.001) out.push([m, prop, k]); };
    add(M.lamp, 'color', 1 + 0.5 * lit);
    add(H.story?.lampMat, 'color', 1 + 0.5 * lit);
    add(H.greenhouse?.lampMat, 'color', 1 + 0.3 * lit);
    add(M.win, 'emissive', 1 + 1.2 * lit);
    for (const m of Object.values(M.home || {})) add(m, 'emissive', 1 + 1.2 * lit);
    add(M.beam, 'color', 1 + 0.2 * lit);
    return out;
  }

  /** How lit the lamps are (0 by day, 1 at night: island.js applySky). */
  get lit() {
    const n = this.host.night || 0;
    return n > 0.3 ? Math.min(1, (n - 0.3) * 2 + 0.3) : 0;
  }

  update(dt) {
    this.t += dt;
    // the slow breath of the glow (0.2 Hz, a few percent): none with "Reduce flashing"
    this.pulse = calmOn() ? 0 : Math.sin(this.t * Math.PI * 0.4) * 0.08;
  }

  /** What the post-processing needs this frame (core/gfx.js render()). */
  frameLook() {
    const H = this.host;
    const g = gradeAt(H.hour ?? 12, H.seasons?.season);
    return { tint: g.tint, sat: g.sat, bloom: 1 + this.pulse };
  }

  render(renderer) {
    const H = this.host;
    const on = this.gfx.on;
    let G = null;
    if (on.glow) {
      G = this.glowMats();
      if (!this.marked) { this.marked = true; for (const m of G.night) markGlow(m, 'night'); for (const m of G.always) markGlow(m, 'always'); }
      for (const m of G.always) markGlow(m, 'always'); // (the ghost ship's lanterns come with a rare event)
      for (const m of G.blend) glowBlend(m, true);
      GLOW.night.value = this.lit > 0 ? 1 + this.lit : 0;
      GLOW.always.value = 2;
      this.saved = this.boostList();
      for (const s of this.saved) { const c = s[0][s[1]]; s.push(c.r, c.g, c.b); c.multiplyScalar(s[2]); }
    }
    try {
      this.gfx.render(H.scene, H.camera, this.frameLook());
    } finally {
      for (const [m, prop, , r, g, b] of this.saved) m[prop].setRGB(r, g, b);
      this.saved = [];
      GLOW.night.value = GLOW.always.value = 0;
      if (G) for (const m of G.blend) glowBlend(m, false);
    }
  }

  dispose() {}
}
