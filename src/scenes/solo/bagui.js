import * as THREE from 'three';
import { t, tFor } from '../../core/i18n.js';
import { esc } from '../../core/ui.js';
import { ITEMS, icon } from './items.js';
import { HOTBAR, ROW, bagSize, chestSize, freeSlot, fixSlots } from './save.js';
import { CHEST, fitsHere } from './build.js';
import { makeChest } from './models8.js';

// The bag panel (the owner's playtest, like Stardew Valley): a grid of bag rows (9 wide) above the 9-slot
// hotbar, and the cottage's storage chest above the bag when it is open. The data lives in save.js (stacks
// with a slot number); this file only moves stacks between slots.
// - Mouse: drag a stack to another slot (an empty slot: move; the same thing: the stacks merge; something
//   else: they swap). Right click or shift+click moves a stack across at once (bag <-> hotbar, or
//   bag <-> chest when the chest is open). Clicking a hotbar slot picks it as the one you hold.
// - Keyboard and gamepad: the stick / arrow keys move a cursor (on the hotbar row the cursor also picks the
//   slot you hold), [B] picks a stack up and puts it down again, [A] moves it across at once, [C] (or Tab)
//   closes. Keys 1-9 pick a hotbar slot.
// - The name and sell price of the thing under the cursor or mouse is shown and read aloud.
// - Below the hotbar: the things waiting to be placed (decorations and furniture from the workbench's storage).
//   [B] or [A] on one (or a click) starts decorate mode right where you are with it in hand (playtest round 3;
//   furniture only inside the cottage, yard pieces only outside: build.js fitsHere).

const CSS = `
.zb-panel { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); pointer-events: auto; background: rgba(255,250,240,.98); border-radius: 24px;
  border: 4px solid #8a5a32; box-shadow: 0 10px 0 rgba(43,35,64,.3); padding: 12px 18px 10px; box-sizing: border-box; font-weight: 600; --s: clamp(36px, min(6.2vh, 4.8vw), 62px);
  user-select: none; -webkit-user-select: none; max-height: 96vh; width: calc(9 * var(--s) + 40px + 10px + 36px + 8px); }
.zb-panel.chest { --s: clamp(32px, min(4.9vh, 4.4vw), 52px); }
.zb-panel h3 { margin: 4px 0 4px; font-size: clamp(14px, 1.4vw, 21px); color: #8a5a32; display: flex; align-items: center; gap: 8px; }
.zb-panel h3 small { font-weight: 600; opacity: .7; font-size: .8em; }
.zb-panel h3 .ic { width: 1.4em; height: 1.4em; }
.zb-grid { display: grid; grid-template-columns: repeat(9, var(--s)); gap: 5px; width: max-content; }
.zb-grid.chestgrid { max-height: calc(4 * (var(--s) + 5px)); overflow-y: auto; }
.zb-grid.hot { margin-top: 8px; padding: 5px; background: rgba(43,35,64,.55); border-radius: 14px; }
.zb-slot { width: var(--s); height: var(--s); border-radius: 10px; background: rgba(138,90,50,.12); position: relative; padding: 5px; box-sizing: border-box; cursor: pointer; }
.zb-grid.hot .zb-slot { background: rgba(255,250,240,.9); }
.zb-slot.sel { background: #ffd84a !important; box-shadow: 0 0 0 3px #fff; }
.zb-slot.cur { outline: 4px solid #4c8bd6; outline-offset: 1px; z-index: 2; }
.zb-slot.carry > :not(.k) { opacity: .3; }
.zb-slot.drop { outline: 3px dashed #3ddc97; outline-offset: 1px; }
.zb-slot .n { position: absolute; right: 3px; bottom: 0; font-weight: 700; font-size: clamp(11px, .95vw, 15px); paint-order: stroke fill; -webkit-text-stroke: .25em #fff; }
.zb-slot .k { position: absolute; left: 4px; top: 1px; font-size: 10px; font-weight: 700; opacity: .55; }
.zb-slot .up { position: absolute; left: 50%; top: -38%; width: 70%; height: 70%; transform: translateX(-50%); animation: zb-bob .8s infinite; pointer-events: none; }
@keyframes zb-bob { 50% { margin-top: -4px; } }
.zb-tip { margin-top: 8px; min-height: 1.4em; text-align: center; font-size: clamp(14px, 1.35vw, 20px); font-weight: 700; }
.zb-tip small { font-weight: 600; opacity: .7; }
.zb-grid.decogrid .zb-slot { background: rgba(255,216,74,.25); }
.zb-grid.decogrid .zb-slot img { width: 100%; height: 100%; object-fit: contain; }
.zb-grid.decogrid .zb-slot.away { opacity: .45; }
.zb-foot { text-align: center; margin-top: 4px; opacity: .75; font-size: clamp(11px, 1vw, 15px); }
.zb-ghost { position: fixed; width: 54px; height: 54px; pointer-events: none; z-index: 50; transform: translate(-50%, -50%) scale(1.15); filter: drop-shadow(0 4px 2px rgba(43,35,64,.35)); }
`;

const nameOf = (id) => t(ITEMS[id] ? `isl.i.${id}` : `isl.d.${id}`);

export class BagUi {
  constructor(host) {
    this.host = host;
    if (!document.getElementById('zb-style')) {
      const el = document.createElement('style');
      el.id = 'zb-style';
      el.textContent = CSS;
      document.head.appendChild(el);
    }
    // the chest in the cottage (the room is far away from the island, see build.js)
    this.model = makeChest();
    this.model.position.set(CHEST.x, 0.05, CHEST.z);
    host.scene.add(this.model);
    host.map.circObs(CHEST.x, CHEST.z, 0.55);
    this.el = document.createElement('div');
    this.el.className = 'zb-panel';
    this.el.style.display = 'none';
    host.hud.root.appendChild(this.el);
    this.ghost = document.createElement('div');
    this.ghost.className = 'zb-ghost';
    this.ghost.style.display = 'none';
    document.body.appendChild(this.ghost);
    this.open = false;
    this.chest = false;
    this.cur = { c: 'inv', s: 0 };
    this.carry = null; // a stack picked up with [B]: { c, s }
    this.drag = null; // a mouse drag: { c, s, x, y, moved }
    this.hover = null;
    this.spoken = null;
    this.lastSpoken = '';
    this.bindMouse();
  }

  get S() { return this.host.save; }

  /** [B] next to the chest in the cottage. */
  interactions(P, out, nm) {
    if (Math.hypot(P.x - CHEST.x, P.z - CHEST.z) < 1.5) out.b = { text: nm('zb.h.chest'), fn: () => this.show(true) };
  }

  // ---------- the data: stacks in the bag (S.inv) and in the chest (S.chest) ----------

  list(c) { return c === 'chest' ? this.S.chest : c === 'deco' ? this.decoItems() : this.S.inv; }
  size(c) { return c === 'chest' ? chestSize(this.S) : c === 'deco' ? this.decoItems().length : bagSize(this.S); }

  /** The things waiting to be placed (build.js storage) as stacks on a row of their own. */
  decoItems() { return (this.host.builder?.storeAll() || []).map((it, i) => ({ id: it.id, n: it.n, slot: i })); }

  /** Decorate with this thing, right where you are (closes the bag; a toast if it cannot go here). */
  decorateWith(p) {
    const it = this.at(p);
    if (!it) { this.host.game.audio.play('bump'); return; }
    const host = this.host;
    if (!fitsHere(it.id, !!host.indoors)) { host.game.ui.toast(t(host.indoors ? 'deco.t.goesOut' : 'deco.t.goesIn', { item: nameOf(it.id) }), 2400); host.game.audio.play('bump'); return; }
    this.close();
    host.builder.startDecorate(it.id); // (outside your land: a toast says where you can decorate)
  }
  at(p) { return p ? this.list(p.c).find((it) => it.slot === p.s) || null : null; }

  /** Move the stack at a to slot b: into an empty slot, onto the same thing (merge), or swap. */
  move(a, b) {
    if (!a || !b || (a.c === b.c && a.s === b.s) || a.c === 'deco' || b.c === 'deco') return false; // (things to place stay in storage)
    const A = this.at(a);
    if (!A || b.s < 0 || b.s >= this.size(b.c)) return false;
    const B = this.at(b);
    const LA = this.list(a.c), LB = this.list(b.c);
    if (B && B.id === A.id) {
      B.n += A.n;
      LA.splice(LA.indexOf(A), 1);
    } else {
      if (B) {
        LB.splice(LB.indexOf(B), 1);
        B.slot = a.s;
        LA.push(B);
      }
      LA.splice(LA.indexOf(A), 1);
      A.slot = b.s;
      LB.push(A);
    }
    this.changed();
    return true;
  }

  /** Where a stack goes when it is moved across at once: onto the same thing there, else the first free slot. */
  quickTarget(p) {
    const A = this.at(p);
    if (!A) return null;
    let c, from, to;
    if (this.chest) { c = p.c === 'chest' ? 'inv' : 'chest'; from = 0; to = this.size(c); }
    else if (p.s < HOTBAR) { c = 'inv'; from = HOTBAR; to = bagSize(this.S); }
    else { c = 'inv'; from = 0; to = HOTBAR; }
    const same = this.list(c).find((it) => it.id === A.id && it.slot >= from && it.slot < to && !(c === p.c && it.slot === p.s));
    if (same) return { c, s: same.slot };
    const s = freeSlot(this.list(c), to, from);
    return s >= 0 ? { c, s } : null;
  }

  quickMove(p) {
    if (p.c === 'deco') { this.decorateWith(p); return true; }
    const to = this.quickTarget(p);
    if (!to) { this.host.game.audio.play('bump'); return false; }
    this.move(p, to);
    this.host.game.audio.play('pop');
    return true;
  }

  changed() {
    fixSlots(this.S);
    this.host.markDirty();
    this.render();
  }

  // ---------- open and close ----------

  show(chest = false) {
    const host = this.host;
    host.mode = 'bag';
    this.open = true;
    this.chest = chest;
    this.t = 0;
    this.carry = null;
    this.cur = { c: 'inv', s: this.S.sel };
    this.el.style.display = '';
    this.el.classList.toggle('chest', chest);
    if (chest) { this.model.userData.lid.rotation.x = -1.1; host.game.audio.play('whoosh'); } else host.game.audio.play('select');
    this.render();
    this.sayTip();
  }

  close() {
    this.open = false;
    this.carry = null;
    this.drag = null;
    this.el.style.display = 'none';
    this.ghost.style.display = 'none';
    this.model.userData.lid.rotation.x = 0;
    this.host.mode = 'walk';
    this.host.markDirty();
  }

  // ---------- the cursor (keyboard and gamepad) ----------

  /** Rows from top to bottom: the chest rows, the bag rows, then the hotbar. Each row: [c, first slot]. */
  rows() {
    const out = [];
    if (this.chest) for (let r = 0; r < chestSize(this.S) / ROW; r++) out.push(['chest', r * ROW]);
    for (let r = 0; r < (this.S.bagRows ?? 2); r++) out.push(['inv', HOTBAR + r * ROW]);
    out.push(['inv', 0]);
    if (!this.chest) for (let r = 0; r < Math.ceil(this.size('deco') / ROW); r++) out.push(['deco', r * ROW]);
    return out;
  }

  rowOf(p) {
    const rows = this.rows();
    return rows.findIndex(([c, s0]) => c === p.c && p.s >= s0 && p.s < s0 + ROW);
  }

  step(dx, dy) {
    const rows = this.rows();
    let r = this.rowOf(this.cur);
    if (r < 0) r = rows.length - 1;
    const col = this.cur.s % ROW;
    const nr = THREE.MathUtils.clamp(r - dy, 0, rows.length - 1);
    let nc = (col + dx + ROW) % ROW;
    if (rows[nr][0] === 'deco') nc = Math.min(nc, this.size('deco') - 1 - rows[nr][1]); // (a short last row)
    this.cur = { c: rows[nr][0], s: rows[nr][1] + nc };
    if (this.cur.c === 'inv' && this.cur.s < HOTBAR) this.S.sel = this.cur.s; // on the hotbar: that is what you hold
    this.host.game.audio.play('select');
    this.render();
    this.sayTip();
  }

  /** [B]: pick the stack up, or put the one you carry down here. */
  pickOrPlace() {
    if (this.cur.c === 'deco') { this.carry = null; this.decorateWith(this.cur); return; }
    if (this.carry) {
      const from = this.carry;
      this.carry = null;
      if (from.c !== this.cur.c || from.s !== this.cur.s) { this.move(from, this.cur); this.host.game.audio.play('pop'); } else this.render();
      return;
    }
    if (!this.at(this.cur)) { this.host.game.audio.play('bump'); return; }
    this.carry = { ...this.cur };
    this.host.game.audio.play('select');
    this.render();
  }

  update(inp, dt) {
    this.t += dt;
    const keys = this.host.game.input.pressed;
    let dx = inp.stepX || 0, dy = inp.stepY || 0;
    if (!dx && !dy) {
      if (keys.has('ArrowLeft')) dx = -1; else if (keys.has('ArrowRight')) dx = 1;
      if (keys.has('ArrowUp')) dy = 1; else if (keys.has('ArrowDown')) dy = -1;
    }
    if (dx || dy) this.step(dx, dy);
    for (let k = 1; k <= 9; k++) if (keys.has(`Digit${k}`)) { this.S.sel = k - 1; this.cur = { c: 'inv', s: k - 1 }; this.host.game.audio.play('select'); this.render(); this.sayTip(); }
    if (this.t < 0.2) return;
    if (inp.cPressed || keys.has('Tab')) { this.close(); return; }
    if (inp.bPressed) this.pickOrPlace();
    else if (inp.aPressed) { this.carry = null; this.quickMove(this.cur); }
  }

  // ---------- drawing ----------

  slotHtml(c, s) {
    const it = this.list(c).find((x) => x.slot === s);
    const cls = ['zb-slot'];
    if (c === 'inv' && s === this.S.sel) cls.push('sel');
    if (this.cur.c === c && this.cur.s === s && !this.drag) cls.push('cur');
    if (this.carry && this.carry.c === c && this.carry.s === s) cls.push('carry');
    const kind = it && ITEMS[it.id]?.kind;
    const n = it && (it.n > 1 || (kind !== 'tool' && kind !== 'book' && kind !== 'gadget')) ? `<span class="n">${it.n}</span>` : '';
    const up = this.carry && this.cur.c === c && this.cur.s === s ? `<div class="up">${icon(this.at(this.carry)?.id)}</div>` : '';
    if (c === 'deco') {
      if (it && !fitsHere(it.id, !!this.host.indoors)) cls.push('away');
      return `<div class="${cls.join(' ')}" data-c="${c}" data-s="${s}">${it ? this.host.builder.icon3d(it.id) : ''}${it && it.n > 1 ? `<span class="n">${it.n}</span>` : ''}</div>`;
    }
    return `<div class="${cls.join(' ')}" data-c="${c}" data-s="${s}">${c === 'inv' && s < HOTBAR ? `<span class="k">${s + 1}</span>` : ''}${it ? icon(it.id) : ''}${n}${up}</div>`;
  }

  grid(c, from, to, cls = '') {
    let h = '';
    for (let s = from; s < to; s++) h += this.slotHtml(c, s);
    return `<div class="zb-grid ${cls}">${h}</div>`;
  }

  /** The text for a slot: name, and what it sells for. */
  tipText(p) {
    const it = this.at(p);
    if (!it) return '';
    if (p.c === 'deco') {
      const here = fitsHere(it.id, !!this.host.indoors);
      const where = here ? tFor(this.host.player?.p, 'deco.bag.tip') : t(this.host.indoors ? 'deco.t.goesOut' : 'deco.t.goesIn', { item: nameOf(it.id) });
      return [it.n > 1 ? `${nameOf(it.id)} × ${it.n}` : nameOf(it.id), where].join(' · ');
    }
    const def = ITEMS[it.id] || {};
    const parts = [it.n > 1 ? `${nameOf(it.id)} × ${it.n}` : nameOf(it.id)];
    if (def.sell) parts.push(t('zb.sells', { n: def.sell }));
    else if (it.id === 'zipzap') parts.push(t('zb.tip.zipzap'));
    else if (def.kind === 'tool' || def.kind === 'book' || def.kind === 'gadget' || def.kind === 'key' || def.kind === 'find') parts.push(t('zb.keep'));
    return parts.join(' · ');
  }

  render() {
    if (!this.open) return;
    const S = this.S, p = this.host.player?.p;
    const pad = this.host.onPad;
    const used = S.inv.length, size = bagSize(S);
    let h = '';
    if (this.chest) h += `<h3><span class="ic">${icon('chest')}</span>${esc(t('zb.chest'))} <small>${esc(t('zb.count', { n: S.chest.length, m: chestSize(S) }))}</small></h3>${this.grid('chest', 0, chestSize(S), 'chestgrid')}`;
    h += `<h3><span class="ic">${icon(S.bagRows >= 4 ? 'backpack2' : 'backpack1')}</span>${esc(t('zb.bag'))} <small>${esc(t('zb.count', { n: used, m: size }))}</small></h3>`;
    h += this.grid('inv', HOTBAR, size);
    h += this.grid('inv', 0, HOTBAR, 'hot');
    const nd = this.chest ? 0 : this.size('deco');
    if (nd) h += `<h3><span class="ic">${icon('deco')}</span>${esc(t('deco.bag'))} <small>${nd}</small></h3>${this.grid('deco', 0, nd, 'decogrid')}`;
    const tipP = this.hover || this.cur;
    h += `<div class="zb-tip">${esc(this.tipText(tipP)) || '&nbsp;'}</div>`;
    h += `<div class="zb-foot">${esc(tFor(p, pad ? (this.chest ? 'zb.hint.padChest' : 'zb.hint.pad') : this.chest ? 'zb.hint.kbChest' : 'zb.hint.kb'))}</div>`;
    if (this.html !== h) { this.html = h; this.el.innerHTML = h; }
  }

  /** Read the slot under the cursor (or mouse) aloud when it changes. */
  sayTip() {
    const text = this.tipText(this.hover || this.cur);
    if (!text || text === this.spoken) return;
    this.spoken = text;
    this.lastSpoken = text; // (item names are not read aloud: the narrator reads story and help)
  }

  // ---------- the mouse ----------

  slotFrom(target) {
    const el = target?.closest?.('.zb-slot');
    return el ? { c: el.dataset.c, s: Number(el.dataset.s) } : null;
  }

  bindMouse() {
    const el = this.el;
    this.onDown = (e) => {
      const p = this.slotFrom(e.target);
      if (!p || !this.open) return;
      e.preventDefault();
      if (e.button === 2) return; // (right click: see contextmenu)
      if (e.shiftKey) { this.quickMove(p); return; }
      this.carry = null;
      this.drag = { ...p, x: e.clientX, y: e.clientY, moved: false };
      const it = this.at(p);
      if (it) { this.ghost.innerHTML = icon(it.id); this.ghost.style.left = `${e.clientX}px`; this.ghost.style.top = `${e.clientY}px`; }
    };
    this.onMove = (e) => {
      if (!this.open) return;
      const d = this.drag;
      if (d) {
        if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 6 && this.at(d)) { d.moved = true; this.ghost.style.display = ''; }
        this.ghost.style.left = `${e.clientX}px`;
        this.ghost.style.top = `${e.clientY}px`;
      }
      const p = this.slotFrom(document.elementFromPoint?.(e.clientX, e.clientY) || e.target);
      const same = p && this.hover && p.c === this.hover.c && p.s === this.hover.s;
      if (!same) {
        this.hover = p;
        this.hoverT = this.host.time;
        this.render();
      }
    };
    this.onUp = (e) => {
      const d = this.drag;
      if (!d || !this.open) return;
      this.drag = null;
      this.ghost.style.display = 'none';
      const p = this.slotFrom(document.elementFromPoint?.(e.clientX, e.clientY) || e.target);
      if (p && (p.c !== d.c || p.s !== d.s)) { if (this.move(d, p)) this.host.game.audio.play('pop'); return; }
      if (p && !d.moved && p.c === 'deco') { this.cur = { ...p }; this.decorateWith(p); return; } // a click on a thing to place
      if (p && !d.moved) {
        // a click: on the hotbar it picks what you hold; it also moves the cursor there
        this.cur = { ...p };
        if (p.c === 'inv' && p.s < HOTBAR) this.S.sel = p.s;
        this.host.game.audio.play('select');
        this.render();
        this.sayTip();
      } else this.render();
    };
    this.onContext = (e) => {
      const p = this.slotFrom(e.target);
      if (!p || !this.open) return;
      e.preventDefault();
      this.quickMove(p);
    };
    this.onLeave = () => { if (this.hover) { this.hover = null; this.render(); } };
    el.addEventListener('pointerdown', this.onDown);
    window.addEventListener('pointermove', this.onMove);
    window.addEventListener('pointerup', this.onUp);
    el.addEventListener('contextmenu', this.onContext);
    el.addEventListener('pointerleave', this.onLeave);
  }

  /** Every frame (any mode): read a hovered slot aloud after a moment. */
  tick() {
    if (this.open && this.hover && this.host.time - (this.hoverT || 0) > 0.4) this.sayTip();
  }

  dispose() {
    window.removeEventListener('pointermove', this.onMove);
    window.removeEventListener('pointerup', this.onUp);
    this.el.remove();
    this.ghost.remove();
  }
}
