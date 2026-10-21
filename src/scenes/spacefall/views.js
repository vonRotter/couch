import * as THREE from 'three';
import { VIEW } from './config.js';
import { clamp, damp, lerp, rand } from './util.js';

// Viewports and cameras (ported from Spacefall, extended to Couch's 1-6 players). Every viewport
// on screen has the same size: 1 = full screen, 2 = halves, 3-4 = quarters, 5-6 = a 3 x 2 grid.
// With 3 or 5 players the spare cell shows a tactical overview of the whole map.

/** Equal cells for n viewports in a W x H screen (CSS pixels, y down). */
export function computeLayout(n, W, H) {
  let cols = 1, rows = 1;
  if (n === 2) { if (W / H >= 1.2) cols = 2; else rows = 2; }
  else if (n >= 3 && n <= 4) { cols = 2; rows = 2; }
  else if (n >= 5) { if (W / H >= 1) { cols = 3; rows = 2; } else { cols = 2; rows = 3; } }
  const cells = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = Math.round((c * W) / cols), y = Math.round((r * H) / rows);
      cells.push({ x, y, w: Math.round(((c + 1) * W) / cols) - x, h: Math.round(((r + 1) * H) / rows) - y });
    }
  }
  return cells;
}

const halfFovTan = () => Math.tan((VIEW.fov * Math.PI) / 360);

export class View {
  /** kind: 'shared' (whole small map), 'follow' (one pilot) or 'overview' (whole big map). */
  constructor(kind, pilot = null) {
    this.kind = kind;
    this.pilot = pilot;
    this.camera = new THREE.PerspectiveCamera(VIEW.fov, 1, 0.5, 1000);
    this.rect = { x: 0, y: 0, w: 1, h: 1 };
    this.x = 0;
    this.y = 0;
    this.visH = VIEW.heightFull;
    this.followH = VIEW.heightFull;
    this.shakeAmt = 0;
    this.snap = true;
    this.padTop = 0;
    this.padBottom = 0;
  }

  /** padTop / padBottom: pixels kept free for HUD pills (shared view only). */
  setRect(rect, screenH, padTop = 0, padBottom = 0) {
    this.rect = rect;
    this.padTop = padTop;
    this.padBottom = padBottom;
    this.camera.aspect = rect.w / rect.h;
    this.camera.updateProjectionMatrix();
    const share = rect.h / screenH;
    this.followH = lerp(VIEW.heightHalf, VIEW.heightFull, clamp((share - 0.5) / 0.5, 0, 1));
    // Narrow viewports get a slightly taller window so the visible area stays generous.
    if (this.camera.aspect < 1) this.followH *= 1.12;
  }

  get visW() { return this.visH * this.camera.aspect; }

  /** Fit the whole map, keeping the HUD bands free. */
  fitWorld(world, margin) {
    const free = Math.max(0.3, (this.rect.h - this.padTop - this.padBottom) / this.rect.h);
    this.visH = Math.max((world.h + margin * 2) / free, (world.w + margin * 2) / this.camera.aspect);
    this.x = world.w / 2;
    // Shift so the map sits centered in the free band between the HUD strips.
    this.y = world.h / 2 + ((this.padTop - this.padBottom) / 2) * (this.visH / this.rect.h);
  }

  update(dt, match) {
    const world = match.world;
    if (this.kind === 'shared' || this.kind === 'overview') {
      this.fitWorld(world, this.kind === 'shared' ? 0.2 : 1);
    } else {
      this.visH = this.followH;
      const target = match.followTarget(this.pilot);
      if (target) {
        const tx = target.x + clamp(target.vx || 0, -8, 8) * 0.22;
        const ty = target.y + clamp(target.vy || 0, -8, 8) * 0.14;
        if (this.snap) { this.x = tx; this.y = ty; this.snap = false; }
        this.x = damp(this.x, tx, VIEW.followLerp, dt);
        this.y = damp(this.y, ty, VIEW.followLerp, dt);
      }
      this.clampTo(world);
    }
    this.shakeAmt = Math.max(0, this.shakeAmt - dt * 2.2);
    this.apply();
  }

  clampTo(world) {
    const hw = this.visW / 2, hh = this.visH / 2;
    const m = 0.4;
    this.x = world.w + 2 * m <= hw * 2 ? world.w / 2 : clamp(this.x, hw - m, world.w - hw + m);
    this.y = world.h + 2 * m <= hh * 2 ? world.h / 2 : clamp(this.y, hh - m, world.h - hh + m);
  }

  apply() {
    const dist = this.visH / 2 / halfFovTan();
    const s = this.shakeAmt * this.shakeAmt * 0.5;
    this.camera.position.set(this.x + rand(-s, s), this.y + rand(-s, s), dist);
    this.camera.lookAt(this.camera.position.x, this.camera.position.y, 0);
    this.camera.updateMatrixWorld();
  }

  addShake(amount, x, y) {
    if (x !== undefined && this.kind === 'follow') {
      const dx = Math.abs(x - this.x), dy = Math.abs(y - this.y);
      if (dx > this.visW * 0.7 || dy > this.visH * 0.7) return;
    }
    this.shakeAmt = Math.min(1.2, this.shakeAmt + amount);
  }

  /** World -> screen pixel coordinates (CSS px, whole canvas), or null if behind the camera. */
  project(x, y, z, v = new THREE.Vector3()) {
    v.set(x, y, z).project(this.camera);
    if (v.z > 1) return null;
    return {
      x: this.rect.x + (v.x * 0.5 + 0.5) * this.rect.w,
      y: this.rect.y + (-v.y * 0.5 + 0.5) * this.rect.h,
      inside: Math.abs(v.x) <= 1 && Math.abs(v.y) <= 1,
      nx: v.x,
      ny: v.y,
    };
  }
}
