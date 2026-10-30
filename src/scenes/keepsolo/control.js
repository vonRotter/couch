import * as THREE from 'three';
import { basic, sharedGeo } from '../../core/palette.js';
import { t } from '../../core/i18n.js';
import { esc } from '../../core/ui.js';
import { GR, PR, CELL, mesh } from '../keep/common.js';
import { Mouse, toScreen } from './mouse.js';
import { findPath, clearWalk } from './path.js';
import { itemName, RARITY_TEXT } from './items.js';

// Mouse control of Pillow Keep Solo, Diablo style (mixed into the scene):
//   left click the floor          walk there (on a path around walls); hold to keep walking toward the pointer
//   left click a grumble / nest   walk up and attack it; hold to keep attacking
//   left click an item, chest, locked door, portal, person or shop   walk there and use it
//   shift + left click            attack in place toward the pointer
//   mouse wheel                   zoom out a little (never closer than the normal camera)
// What is under the pointer gets a ring on the floor (red for grumbles, gold for things to use) and
// grumbles show their name and health bar at the top of the screen. The keyboard / gamepad stick
// still walks directly (and cancels a click goal).

const FOE_KINDS = new Set(['foe', 'nest', 'boss']);
const ZOOM_MAX = 1.4;
const _gp = new THREE.Vector3();

export const ControlMixin = {
  initControl() {
    this.mouse = new Mouse();
    this.mouse.attach();
    this.ctl = { goal: null, path: null, pathT: 0, holdMove: false, stuckT: 0, lx: 0, lz: 0 };
    this.hover = null;
    this.ground = null;
    this.zoom = Math.max(1, Math.min(ZOOM_MAX, +this.data.zoom || 1));
    const ringGeo = sharedGeo('ksHoverRing', () => new THREE.RingGeometry(0.78, 0.98, 32));
    this.hoverRings = {
      foe: mesh(ringGeo, basic(0xff4f6a, { transparent: true, opacity: 0.9, depthWrite: false }), 0, 0.07, 0, false),
      use: mesh(ringGeo, basic(0xffd23f, { transparent: true, opacity: 0.9, depthWrite: false }), 0, 0.07, 0, false),
    };
    for (const r of Object.values(this.hoverRings)) { r.rotation.x = -Math.PI / 2; r.visible = false; r.renderOrder = 3; this.scene.add(r); }
    // the spot a click walks to: a little shrinking ring
    this.clickMark = mesh(ringGeo, basic(0xffffff, { transparent: true, opacity: 0.8, depthWrite: false }), 0, 0.08, 0, false);
    this.clickMark.rotation.x = -Math.PI / 2;
    this.clickMark.visible = false;
    this.clickT = 0;
    this.scene.add(this.clickMark);
  },

  /** Is the pointer over the HUD or a panel (then clicks are not for the world)? */
  pointerOnUi() {
    const el = this.mouse.element();
    return !!el?.closest?.('.ks-ui, .ks-panel');
  },

  // ---------------------------------------------------------------- what is under the pointer

  pickHover() {
    const m = this.mouse;
    this.ground = m.ground(this.camera, _gp) ? { x: _gp.x, z: _gp.z } : null;
    if (!m.used || m.virtual || this.moving || this.hero.state !== 'walk' || this.pointerOnUi()) return null;
    const gp = this.ground;
    let best = null, bs = Infinity;
    const take = (h, score) => { if (score < bs) { bs = score; best = h; } };
    // Item labels first (like Diablo: the labels sit on top).
    for (const it of this.items) {
      if (it.taken || !it.label || it.label.style.display === 'none' || !it.label.innerHTML) continue;
      const r = it.label.getBoundingClientRect();
      if (m.x >= r.left - 3 && m.x <= r.right + 3 && m.y >= r.top - 2 && m.y <= r.bottom + 2) take({ kind: 'item', ref: it, x: it.x, z: it.z }, -1);
    }
    if (best) return best;
    // Things standing in the world, tested on the screen (their height counts).
    const onScreen = (x, z, h, w, kind, ref, score0 = 0) => {
      const a = toScreen(this.camera, x, 0, z), b = toScreen(this.camera, x, h, z);
      if (a.behind) return;
      const ht = Math.max(12, a.y - b.y), hw = Math.max(10, ht * w);
      const dx = Math.abs(m.x - a.x), top = b.y - 6, bot = a.y + ht * 0.25;
      if (dx > hw || m.y < top || m.y > bot) return;
      take({ kind, ref, x, z }, score0 + dx / hw + Math.abs(m.y - (a.y + b.y) / 2) / ht);
    };
    if (this.kind === 'dungeon') {
      for (const g of this.grumbles) if (!g.dead) onScreen(g.x, g.z, 1.25 * g.size + g.y, 0.55, 'foe', g);
      for (const n of this.nests) if (!n.done) onScreen(n.x, n.z, 1.5, 0.7, 'nest', n, 0.3);
      const b = this.boss;
      if (b && !b.gone && b.state !== 'asleep' && b.y < 2.5) onScreen(b.x, b.z, b.r * 2.4, 0.5, 'boss', b, 0.2);
      if (gp) {
        for (const c of this.chests) if (!c.open && Math.hypot(c.x - gp.x, c.z - gp.z) < 1.1) take({ kind: 'chest', ref: c, x: c.x, z: c.z }, 0.5);
        for (const it of this.items) if (!it.taken && it.kind !== 'coin' && Math.hypot(it.x - gp.x, it.z - gp.z) < 0.8) take({ kind: 'item', ref: it, x: it.x, z: it.z }, 0.4);
        if (this.portal && Math.hypot(this.portal.x - gp.x, this.portal.z - gp.z) < 1.4) take({ kind: 'portal', ref: this.portal, x: this.portal.x, z: this.portal.z }, 0.6);
        const c = this.tileC(gp.x), r = this.tileR(gp.z);
        if (this.cell(c, r) === 3) {
          const dr = this.doorAt.get(r * this.W + c);
          if (dr && !dr.open) take({ kind: 'door', ref: dr, x: this.cx(c), z: this.cz(r) }, 0.7);
        }
      }
    } else {
      for (const n of this.npcs) if (n.id !== 'smith' && n.id !== 'fizz' && n.id !== 'snore') onScreen(n.x, n.z, 1.6, 0.5, 'npc', n);
      if (gp) {
        for (const s of this.stations) {
          const bx = s.box;
          const inBox = bx && gp.x > bx.x - bx.w / 2 - 0.3 && gp.x < bx.x + bx.w / 2 + 0.3 && gp.z > bx.z - bx.d / 2 - 0.3 && gp.z < bx.z + bx.d / 2 + 0.6;
          const d = Math.hypot(s.x - gp.x, s.z - gp.z);
          if (inBox || d < 1.2) take({ kind: 'station', ref: s, x: s.x, z: s.z }, 0.5 + (inBox ? 0 : d));
        }
        const p = this.townPortal;
        if (p?.visible && Math.hypot(p.position.x - gp.x, p.position.z - gp.z) < 1.4) take({ kind: 'tportal', ref: p, x: p.position.x, z: p.position.z }, 0.2);
      }
    }
    return best;
  },

  /** A name for the thing under the pointer (the top bar shows it). */
  hoverName(h) {
    switch (h.kind) {
      case 'foe': return h.ref.name || t('ks.foe.' + h.ref.kind);
      case 'nest': return t('ks.h.nest');
      case 'boss': return t(h.ref.nameKey);
      case 'item': return h.ref.kind === 'gear' ? itemName(h.ref.item) : t(`ks.h.${h.ref.kind}`);
      case 'chest': return t('ks.h.chest');
      case 'door': return t(this.hero.hasKey ? 'ks.h.doorKey' : 'ks.h.door');
      case 'portal': case 'tportal': return t('ks.h.portal');
      case 'npc': return t(`ks.npc.${h.ref.id}`);
      case 'station': return t(`ks.sign.${h.ref.id}`);
      default: return '';
    }
  },

  // ---------------------------------------------------------------- clicks

  /** Read the mouse for this frame (world clicks only; panels read it themselves). */
  updateMouse(dt) {
    const m = this.mouse, ctl = this.ctl, e = this.hero;
    if (m.wheel) {
      this.zoom = Math.max(1, Math.min(ZOOM_MAX, this.zoom + m.wheel * 0.07));
      this.data.zoom = this.zoom;
      this.dirty = true;
    }
    this.hover = this.pickHover();
    if (e.state !== 'walk' || this.moving) { ctl.goal = null; return; }
    const gp = this.ground;
    if (m.leftPressed && !m.virtual && !this.pointerOnUi()) {
      const h = this.hover;
      ctl.path = null; ctl.pathT = 0; ctl.stuckT = 0; ctl.holdMove = false;
      if ((m.shift || m.clickShift) && this.kind === 'dungeon') ctl.goal = { kind: 'inplace' };
      else if (h && FOE_KINDS.has(h.kind)) ctl.goal = { kind: 'attack', h };
      else if (h) ctl.goal = { kind: 'use', h };
      else if (gp) {
        ctl.goal = { kind: 'move', x: gp.x, z: gp.z };
        ctl.holdMove = true;
        this.clickMark.position.set(gp.x, 0.08, gp.z);
        this.clickT = 0.45;
      }
    }
    if (!m.left) ctl.holdMove = false;
    if (ctl.holdMove && gp && ctl.goal?.kind === 'move') {
      // holding the button: the goal follows the pointer (a new path now and then)
      const g = ctl.goal;
      if (Math.hypot(g.x - gp.x, g.z - gp.z) > 0.6) { g.x = gp.x; g.z = gp.z; if (ctl.pathT > 0.25) ctl.path = null; }
    }
    this.clickT -= dt;
    this.clickMark.visible = this.clickT > 0;
    if (this.clickT > 0) this.clickMark.scale.setScalar(0.3 + this.clickT * 1.4);
  },

  /** Drop the click goal (the stick or keys took over). */
  ctlCancel() {
    this.ctl.goal = null;
    this.ctl.path = null;
    this.ctl.holdMove = false;
  },

  /** How close the hero must be to hit `h` with the basic attack, and does it need a clear line? */
  attackReach(h) {
    const r = h.kind === 'foe' ? GR * h.ref.size : h.kind === 'nest' ? h.ref.r : h.ref.r || 1;
    if (this.cls === 'knight') return { reach: 2.1 + r, line: false };
    return { reach: (this.cls === 'archer' ? 11 : 9) + r * 0.5, line: true };
  },

  targetAlive(h) {
    if (h.kind === 'foe') return !h.ref.dead && this.grumbles.includes(h.ref);
    if (h.kind === 'nest') return !h.ref.done;
    if (h.kind === 'boss') return this.boss === h.ref && !h.ref.gone && h.ref.state !== 'asleep' && h.ref.hp > 0;
    return true;
  },

  /** Face a point and swing / shoot at it with the basic attack. */
  attackAt(x, z) {
    const e = this.hero;
    const dx = x - e.x, dz = z - e.z, d = Math.hypot(dx, dz);
    if (d > 0.05) { e.fx = dx / d; e.fz = dz / d; }
    this.aimAt = { x, z, d };
    this.attack(e);
    this.aimAt = null;
  },

  /**
   * Walk toward the click goal and act when there. Returns the wanted move direction (x, z) with
   * length 0..1, or null when there is no goal (then the stick decides).
   */
  steer(dt) {
    const ctl = this.ctl, g = ctl.goal, e = this.hero, m = this.mouse;
    if (!g || e.state !== 'walk') return null;
    const stop = { x: 0, z: 0 };
    let tx, tz, reach = 0.2;
    if (g.kind === 'inplace') {
      const gp = this.ground;
      g.t = (g.t || 0) + dt;
      if (gp && e.cdA <= 0 && !e.blocking) { this.attackAt(gp.x, gp.z); g.hits = (g.hits || 0) + 1; }
      // a click attacks once (even if the last swing is still recharging); holding keeps going
      if (!m.left && (g.hits || g.t > 1)) ctl.goal = null;
      return stop;
    }
    if (g.kind === 'move') {
      tx = g.x; tz = g.z;
      if (Math.hypot(tx - e.x, tz - e.z) < 0.25) { if (!ctl.holdMove) ctl.goal = null; return stop; }
    } else if (g.kind === 'attack') {
      const h = g.h;
      if (!this.targetAlive(h)) {
        // the target poofed: keep walking with the button held, else stop
        if (m.left && this.ground) { ctl.goal = { kind: 'move', x: this.ground.x, z: this.ground.z }; ctl.holdMove = true; } else ctl.goal = null;
        return stop;
      }
      tx = h.ref.x; tz = h.ref.z;
      const { reach: R, line } = this.attackReach(h);
      const d = Math.hypot(tx - e.x, tz - e.z);
      if (d <= R && (!line || this.clearLine(e.x, e.z, tx, tz))) {
        if (e.cdA <= 0 && !e.blocking) {
          this.attackAt(tx, tz);
          g.hits = (g.hits || 0) + 1;
        } else { const k = d || 1; e.fx = (tx - e.x) / k; e.fz = (tz - e.z) / k; }
        if (!m.left && g.hits) ctl.goal = null; // one click, one attack; hold to keep going
        return stop;
      }
      reach = 0;
    } else {
      const h = g.h;
      tx = h.x; tz = h.z;
      reach = this.useReach(h);
      if (Math.hypot(tx - e.x, tz - e.z) <= reach) { ctl.goal = null; this.useHover(h); return stop; }
    }
    return this.follow(tx, tz, dt, reach);
  },

  useReach(h) {
    switch (h.kind) {
      case 'item': return 1.1;
      case 'chest': return h.ref.r + PR + 0.55;
      case 'door': return CELL * 0.5 + PR + 0.45;
      case 'portal': case 'tportal': return 0.35;
      case 'npc': return 1.9;
      case 'station': return Math.min(1.6, h.ref.r * 0.7);
      default: return 1;
    }
  },

  /** Arrived next to the thing that was clicked: use it. */
  useHover(h) {
    const e = this.hero;
    if (h.kind === 'item') {
      const it = h.ref;
      if (it.taken) return;
      if (it.kind === 'gear') this.pickGear(it);
      else if (it.kind === 'bag') this.pickBag(it);
      else if (it.kind === 'potion' || it.kind === 'key' || it.kind === 'scroll') this.tryPickup?.(it);
    } else if (h.kind === 'chest') { if (!h.ref.open) this.openChest(h.ref); }
    else if (h.kind === 'door') {
      if (h.ref.open) return;
      if (e.hasKey) this.unlock(h.ref, e);
      else { this.game.ui.toast(t('ks.needKey'), 1600); this.game.audio.play('bump'); }
    } else if (h.kind === 'npc') this.talkTo(h.ref);
    else if (h.kind === 'station') this.useStation(h.ref.id);
  },

  /** Walk toward (tx, tz): straight when the way is clear, else along an A* path. */
  follow(tx, tz, dt, reach) {
    const ctl = this.ctl, e = this.hero;
    ctl.pathT += dt;
    let wx = tx, wz = tz;
    if (!clearWalk(this, e.x, e.z, tx, tz, PR + 0.02)) {
      if (!ctl.path || ctl.pathT > 0.6 || (ctl.pathGoal && Math.hypot(ctl.pathGoal.x - tx, ctl.pathGoal.z - tz) > 1)) {
        ctl.path = findPath(this, e.x, e.z, tx, tz);
        ctl.pathT = 0;
        ctl.pathGoal = { x: tx, z: tz };
        if (!ctl.path) { ctl.goal = null; return { x: 0, z: 0 }; }
      }
      while (ctl.path.length > 1 && Math.hypot(ctl.path[0].x - e.x, ctl.path[0].z - e.z) < 0.4) ctl.path.shift();
      if (ctl.path.length) { wx = ctl.path[0].x; wz = ctl.path[0].z; if (ctl.path.length === 1) { wx = tx; wz = tz; } }
    } else ctl.path = null;
    // stuck (a grumble in the way, a corner): try a new path, then give up
    const moved = Math.hypot(e.x - ctl.lx, e.z - ctl.lz);
    ctl.lx = e.x; ctl.lz = e.z;
    ctl.stuckT = moved < 0.01 ? ctl.stuckT + dt : 0;
    if (ctl.stuckT > 0.5) { ctl.path = null; ctl.pathT = 1; }
    if (ctl.stuckT > 1.6 && !ctl.holdMove) { ctl.goal = null; ctl.stuckT = 0; }
    const dx = wx - e.x, dz = wz - e.z, d = Math.hypot(dx, dz);
    if (d < 0.02) return { x: 0, z: 0 };
    const k = Math.min(1, (Math.hypot(tx - e.x, tz - e.z) - reach + 0.4) / 0.6);
    return { x: dx / d * Math.max(0.25, k), z: dz / d * Math.max(0.25, k) };
  },

  // ---------------------------------------------------------------- hover looks

  updateHoverLook() {
    const h = this.hover;
    const R = this.hoverRings;
    R.foe.visible = !!h && FOE_KINDS.has(h.kind);
    R.use.visible = !!h && !FOE_KINDS.has(h.kind);
    // a clicked target keeps its ring while the hero goes for it
    const g = this.ctl.goal;
    const show = h || (g && g.h && (g.kind === 'attack' ? this.targetAlive(g.h) : true) ? g.h : null);
    if (show) {
      const ring = FOE_KINDS.has(show.kind) ? R.foe : R.use;
      ring.visible = true;
      const ref = show.ref;
      const x = ref.x ?? show.x, z = ref.z ?? show.z;
      const s = show.kind === 'foe' ? ref.size * 0.75 : show.kind === 'boss' ? ref.r * 1.1 : show.kind === 'nest' ? 1.3 : show.kind === 'chest' ? 0.95 : 0.8;
      ring.position.set(x, 0.07, z);
      ring.scale.setScalar(s * (1 + Math.sin(this.time * 8) * 0.04));
    }
    let cur = '';
    if (h) cur = FOE_KINDS.has(h.kind) ? 'crosshair' : 'pointer';
    if (document.body.style.cursor !== cur) document.body.style.cursor = cur;
    this.hud.target(h ? this.targetHtml(h) : '');
  },

  /** The top-of-screen bar for what is under the pointer: name and (for grumbles) health. */
  targetHtml(h) {
    const name = this.hoverName(h);
    let color = '#2b2340', sub = '', bar = '';
    if (FOE_KINDS.has(h.kind)) {
      const ref = h.ref;
      const pct = h.kind === 'boss' ? ref.pct : ref.hp / ref.max;
      color = ref.unique ? '#b88a00' : ref.champ ? '#2f6fe0' : h.kind === 'boss' ? '#8a45e0' : '#2b2340';
      if (ref.modText) sub = ref.modText;
      bar = `<span class="tb"><i style="width:${Math.max(0, Math.min(100, pct * 100)).toFixed(0)}%"></i></span>`;
    } else if (h.kind === 'item' && h.ref.kind === 'gear') color = RARITY_TEXT[h.ref.item.rarity];
    return `<b style="color:${color}">${esc(name)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}${bar}`;
  },

  disposeControl() {
    this.mouse?.detach();
  },
};
