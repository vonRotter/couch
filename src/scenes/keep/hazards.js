import * as THREE from 'three';
import { COLORS, toon } from '../../core/palette.js';
import { t } from '../../core/i18n.js';
import { PR, angDiff, mesh, rbox, bx, fadeMat } from './common.js';

// Telegraphed floor attacks for the bosses (and pillow-throwing grumbles).
// Every attack first paints its danger area on the floor: a bright outline right away and a
// fill that grows until it is full, then it "fires". Pink means "step out", green wedges in a
// wave mean "stand here". Nothing hits without showing its shape first.
//
// Shapes (yaw = direction, the same as atan2(dx, dz)):
//   circle { x, z, r, drop? }            falling pillow (with a shadow) or a stomp
//   rect   { x, z, yaw, len, width }     a line from (x, z), e.g. a charge or a pillow roll
//   cone   { x, z, yaw, r, half }        a yawn breath
//   wave   { x, z, gaps, gapHalf, speed, rMax }  an expanding ring with safe gaps
//   beam   { follow, yaw, spin, len, width, count }  rotating moonbeams around a point

const DANGER = 0xff2d7a;
const SAFE = 0x5ee08a;
const BEAM = 0xffd84a;
const FLOOR_Y = 0.07;

function flat(geo, mat, y = FLOOR_Y) {
  const m = new THREE.Mesh(geo, mat);
  m.rotation.x = -Math.PI / 2;
  m.position.y = y;
  m.renderOrder = 2;
  return m;
}

export class Hazards {
  constructor(scene, parent) {
    this.s = scene;
    this.group = new THREE.Group();
    parent.add(this.group);
    this.list = [];
    this.layer = 0;
  }

  /** Queue an attack. Returns the hazard (its `done` flag turns true when it is over). */
  add(o) {
    const h = { warn: 1, life: 0.25, yawn: 0.3, t: 0, fired: false, hit: new Set(), objs: [], mats: [], geos: [], ...o };
    h.y = FLOOR_Y + (this.layer = (this.layer + 1) % 6) * 0.004;
    h.root = new THREE.Group();
    h.root.position.set(h.x ?? 0, 0, h.z ?? 0);
    this.group.add(h.root);
    this.build(h);
    this.list.push(h);
    // The first telegraph of a run explains the rule once.
    if (!this.s.dodgeHint) { this.s.dodgeHint = true; this.s.game.ui.toast(t('keep.dodge'), 2600); }
    return h;
  }

  mat(h, color, opacity) {
    const m = fadeMat(color, opacity);
    h.mats.push(m);
    return m;
  }

  geo(h, g) {
    h.geos.push(g);
    return g;
  }

  build(h) {
    const { y } = h;
    if (h.shape === 'circle') {
      h.outline = flat(this.geo(h, new THREE.RingGeometry(h.r - 0.14, h.r, 40)), this.mat(h, DANGER, 0.9), y + 0.002);
      h.fill = flat(this.geo(h, new THREE.CircleGeometry(h.r, 40)), this.mat(h, DANGER, 0.3), y);
      h.root.add(h.outline, h.fill);
      if (h.drop) {
        // A big pillow falls from the sky onto the circle.
        const p = new THREE.Group();
        const col = h.dropColor ?? COLORS.candyPink;
        p.add(mesh(rbox('hzPillow', 1.5, 0.5, 1.1, 0.22), toon(col), 0, 0, 0));
        p.add(mesh(bx('hzPillowBand', 1.52, 0.1, 1.12), toon(COLORS.white), 0, 0, 0, false));
        p.scale.setScalar(h.r / 1.1);
        p.rotation.y = Math.random() * Math.PI;
        p.visible = false;
        h.root.add(p);
        h.pillow = p;
      }
    } else if (h.shape === 'rect') {
      h.root.rotation.y = h.yaw;
      const w = h.width, L = h.len;
      const frame = new THREE.Shape();
      frame.moveTo(-w / 2, 0); frame.lineTo(w / 2, 0); frame.lineTo(w / 2, L); frame.lineTo(-w / 2, L); frame.lineTo(-w / 2, 0);
      const hole = new THREE.Path();
      const k = 0.14;
      hole.moveTo(-w / 2 + k, k); hole.lineTo(-w / 2 + k, L - k); hole.lineTo(w / 2 - k, L - k); hole.lineTo(w / 2 - k, k); hole.lineTo(-w / 2 + k, k);
      frame.holes.push(hole);
      // Shape is drawn in XY with +y = forward; flipped so +y maps onto local +z.
      h.outline = flat(this.geo(h, new THREE.ShapeGeometry(frame)), this.mat(h, DANGER, 0.9), y + 0.002);
      h.outline.rotation.x = Math.PI / 2;
      h.fill = flat(this.geo(h, new THREE.PlaneGeometry(w, 1)), this.mat(h, DANGER, 0.3), y);
      h.fill.scale.y = 0.001;
      h.root.add(h.outline, h.fill);
    } else if (h.shape === 'cone') {
      h.root.rotation.y = h.yaw;
      const ts = -Math.PI / 2 - h.half, tl = h.half * 2;
      h.outline = flat(this.geo(h, new THREE.RingGeometry(h.r - 0.16, h.r, 32, 1, ts, tl)), this.mat(h, DANGER, 0.9), y + 0.002);
      const sideGeo = new THREE.RingGeometry(0.3, h.r, 2, 1, ts, tl);
      h.sides = flat(this.geo(h, sideGeo), this.mat(h, DANGER, 0.12), y + 0.001);
      h.fill = flat(this.geo(h, new THREE.CircleGeometry(h.r, 32, ts, tl)), this.mat(h, DANGER, 0.35), y);
      h.fill.scale.setScalar(0.01);
      h.root.add(h.outline, h.sides, h.fill);
    } else if (h.shape === 'wave') {
      // Danger arcs = everything except the gaps. During the warning the whole band area shows
      // faintly with green safe wedges; then a solid band rolls outward.
      const gapHalf = h.gapHalf;
      const gaps = [...h.gaps].map((a) => ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)).sort((a, b) => a - b);
      h.arcs = [];
      for (let i = 0; i < gaps.length; i++) {
        const a0 = gaps[i] + gapHalf, a1 = (i + 1 < gaps.length ? gaps[i + 1] : gaps[0] + Math.PI * 2) - gapHalf;
        if (a1 > a0) h.arcs.push([a0, a1]);
      }
      if (!gaps.length) h.arcs.push([0, Math.PI * 2]);
      h.warnMeshes = [];
      for (const [a0, a1] of h.arcs) {
        const m = flat(this.geo(h, new THREE.RingGeometry(1.6, h.rMax, 48, 1, a0 - Math.PI / 2, a1 - a0)), this.mat(h, DANGER, 0.3), y);
        h.root.add(m);
        h.warnMeshes.push(m);
      }
      for (const g of gaps) {
        const m = flat(this.geo(h, new THREE.RingGeometry(1.6, h.rMax, 8, 1, g - gapHalf - Math.PI / 2, gapHalf * 2)), this.mat(h, SAFE, 0.5), y + 0.001);
        h.root.add(m);
        h.warnMeshes.push(m);
      }
      h.bandMat = this.mat(h, DANGER, 0.85);
      h.band = null;
    } else if (h.shape === 'beam') {
      h.beams = [];
      for (let k = 0; k < h.count; k++) {
        const g = new THREE.Group();
        const fill = flat(this.geo(h, new THREE.PlaneGeometry(h.width, h.len)), this.mat(h, BEAM, 0.12), y);
        fill.position.z = h.len / 2;
        const core = flat(this.geo(h, new THREE.PlaneGeometry(0.16, h.len)), this.mat(h, 0xfff3b0, 0.9), y + 0.002);
        core.position.z = h.len / 2;
        g.add(fill, core);
        h.root.add(g);
        h.beams.push({ g, fill, core, off: (k / h.count) * Math.PI * 2 });
      }
    }
  }

  update(dt, active) {
    for (const h of this.list) {
      h.t += dt;
      if (h.follow) { const p = h.follow(); h.x = p.x; h.z = p.z; h.root.position.set(p.x, 0, p.z); }
      const k = Math.min(1, h.t / h.warn);
      const pulse = 0.5 + 0.5 * Math.sin(h.t * 18);
      if (!h.fired) {
        // Warning: the fill grows; the outline blinks faster near the end.
        if (h.shape === 'circle') {
          h.fill.scale.setScalar(Math.max(0.01, k));
          h.fill.material.opacity = 0.25 + 0.35 * k;
          h.outline.material.opacity = 0.6 + 0.4 * (k > 0.7 ? pulse : 1);
          if (h.pillow) {
            const fall = Math.max(0, (k - 0.55) / 0.45);
            h.pillow.visible = fall > 0;
            h.pillow.position.y = 14 * (1 - fall) ** 1.6 + 0.3;
            h.pillow.rotation.y += dt * 2;
          }
        } else if (h.shape === 'rect') {
          h.fill.scale.y = Math.max(0.001, h.len * k);
          h.fill.position.z = h.len * k / 2;
          h.fill.material.opacity = 0.2 + 0.3 * k;
          h.outline.material.opacity = 0.6 + 0.4 * (k > 0.7 ? pulse : 1);
        } else if (h.shape === 'cone') {
          h.fill.scale.setScalar(Math.max(0.01, k));
          h.fill.material.opacity = 0.2 + 0.3 * k;
          h.outline.material.opacity = 0.6 + 0.4 * (k > 0.7 ? pulse : 1);
        } else if (h.shape === 'wave') {
          for (const m of h.warnMeshes) m.material.opacity = (m.material.color.getHex() === SAFE ? 0.45 : 0.2) + 0.2 * k * (k > 0.7 ? pulse : 1);
        } else if (h.shape === 'beam') {
          for (const b of h.beams) {
            b.g.rotation.y = h.yaw + b.off;
            b.fill.material.opacity = 0.08 + 0.2 * k;
            b.core.material.opacity = 0.3 + 0.5 * k * (k > 0.7 ? pulse : 1);
          }
        }
        if (h.t >= h.warn) this.fire(h);
        continue;
      }
      // Active phase.
      const at = h.t - h.warn;
      if (h.shape === 'wave') {
        const R = 1.6 + at * h.speed;
        if (h.band) { h.root.remove(...h.band); for (const m of h.band) m.geometry.dispose(); }
        h.band = h.arcs.map(([a0, a1]) => {
          const m = flat(new THREE.RingGeometry(Math.max(0.1, R - 0.45), R + 0.45, 48, 1, a0 - Math.PI / 2, a1 - a0), h.bandMat, h.y + 0.003);
          h.root.add(m);
          return m;
        });
        for (const m of h.warnMeshes) m.material.opacity *= 0.96;
        if (active) {
          for (const e of this.s.ents) {
            if (e.state !== 'walk' || h.hit.has(e)) continue;
            const dx = e.x - h.x, dz = e.z - h.z, d = Math.hypot(dx, dz);
            if (Math.abs(d - R) > 0.45 + PR) continue;
            const a = Math.atan2(dx, dz);
            if (h.gaps.some((g) => angDiff(a, g) < h.gapHalf - 0.04)) continue;
            h.hit.add(e);
            this.hurt(e, h, dx / (d || 1), dz / (d || 1));
          }
        }
        if (R > h.rMax) h.done = true;
      } else if (h.shape === 'beam') {
        h.yaw += h.spin * dt;
        for (const b of h.beams) {
          b.g.rotation.y = h.yaw + b.off;
          b.fill.material.opacity = 0.7 + 0.15 * pulse;
          b.core.material.opacity = 1;
        }
        if (active) {
          for (const e of this.s.ents) {
            if (e.state !== 'walk' || (e.beamCd || 0) > this.s.time) continue;
            const dx = e.x - h.x, dz = e.z - h.z;
            for (const b of h.beams) {
              const a = h.yaw + b.off;
              const along = dx * Math.sin(a) + dz * Math.cos(a), side = dx * Math.cos(a) - dz * Math.sin(a);
              if (along > 0 && along < h.len && Math.abs(side) < h.width / 2 + PR * 0.6) {
                e.beamCd = this.s.time + 0.9;
                this.hurt(e, h, Math.cos(a) * Math.sign(side || 1), -Math.sin(a) * Math.sign(side || 1));
                break;
              }
            }
          }
        }
        if (at > h.life) h.done = true;
      } else {
        // Instant shapes: a short white flash after firing.
        const f = 1 - at / h.life;
        for (const m of h.mats) m.opacity = Math.max(0, f) * 0.8;
        if (h.pillow) { h.pillow.position.y = 0.3; h.pillow.scale.y = (h.r / 1.1) * (0.6 + 0.4 * Math.min(1, at * 5)); }
        if (at > h.life) h.done = true;
      }
    }
    for (const h of this.list) if (h.done) this.remove(h);
    this.list = this.list.filter((h) => !h.done);
  }

  fire(h) {
    h.fired = true;
    h.onFire?.(h);
    if (h.shape === 'wave') { this.s.game.audio.play('whoosh'); return; }
    if (h.shape === 'beam') { this.s.game.audio.play('star'); return; }
    for (const m of h.mats) m.color.set(0xffffff);
    if (h.shape === 'circle' && h.pillow) {
      this.s.puffs.burst(new THREE.Vector3(h.x, 0.4, h.z), 0xffffff, { count: 8, size: 0.5, life: 0.6, speed: 3 });
      this.s.game.audio.play('splat');
    } else {
      this.s.game.audio.play('whoosh');
    }
    if (h.noHit) return;
    for (const e of this.s.ents) {
      if (e.state !== 'walk') continue;
      const dx = e.x - h.x, dz = e.z - h.z, d = Math.hypot(dx, dz);
      let inside = false;
      if (h.shape === 'circle') inside = d < h.r + PR * 0.5;
      else if (h.shape === 'cone') inside = d < h.r + PR * 0.5 && (d < 0.8 || angDiff(Math.atan2(dx, dz), h.yaw) < h.half + 0.05);
      else if (h.shape === 'rect') {
        const along = dx * Math.sin(h.yaw) + dz * Math.cos(h.yaw), side = dx * Math.cos(h.yaw) - dz * Math.sin(h.yaw);
        inside = along > -PR && along < h.len + PR && Math.abs(side) < h.width / 2 + PR * 0.5;
      }
      if (inside) this.hurt(e, h, dx / (d || 1), dz / (d || 1));
    }
  }

  hurt(e, h, nx, nz) {
    if (this.s.addYawn(e, h.yawn * (1 + 0.1 * this.s.floorIndex))) {
      e.vx += nx * 9; e.vz += nz * 9;
    }
  }

  remove(h) {
    this.group.remove(h.root);
    if (h.band) for (const m of h.band) m.geometry.dispose();
    for (const m of h.mats) m.dispose();
    for (const g of h.geos) g.dispose();
  }

  clear() {
    for (const h of this.list) this.remove(h);
    this.list = [];
  }

  /** True while any queued attack is still warning or active. */
  get busy() {
    return this.list.length > 0;
  }
}
