import { t, tFor } from '../../core/i18n.js';
import { esc } from '../../core/ui.js';
import { say } from '../../core/voice.js';
import { BAG_W, BAG_H, STASH_W, STASH_H, MAX_PLUS, itemName, upgradeCost, salvageValue } from './items.js';
import { Nav, cellHtml, itemCard, heroSummary } from './ui.js';

// The item grids of Pillow Keep Solo, one panel in three modes:
//   bag    worn gear (a little paper doll) + the 8x4 bag: [A] wear / take off, [C] drop on the floor
//   smith  the same grids at Bolster's forge: [A] upgrade (+1 to +5, coins and fluff), [C] salvage
//   stash  the bag + the 8x6 stash chest in town (shared by the profile's three heroes): [A] move across
// The card under the grids shows the item at the cursor next to what is worn in that slot, with
// green and red arrows per stat and a "Better!" line.

// Paper doll: [col, row] of each worn slot in a 3x3 grid.
const DOLL = { helmet: [1, 0], weapon: [0, 1], armor: [1, 1], offhand: [2, 1], gloves: [0, 2], boots: [1, 2], charm: [2, 2] };
const DOLL_AT = Object.fromEntries(Object.entries(DOLL).map(([k, [c, r]]) => [`${c},${r}`, k]));

export class GridPanel {
  constructor(scene, mode = 'bag') {
    this.s = scene;
    this.mode = mode;
    this.nav = new Nav();
    this.areas = mode === 'stash' ? ['bag', 'stash'] : ['gear', 'bag'];
    this.cur = mode === 'stash' ? { a: 0, c: 0, r: 0 } : { a: 1, c: 0, r: 0 };
    this.el = document.createElement('div');
    this.el.className = 'ks-panel';
    scene.hud.layer.appendChild(this.el);
    this.msg = '';
    this.render();
  }

  dims(a) {
    const id = this.areas[a];
    if (id === 'gear') return [3, 3];
    if (id === 'bag') return [BAG_W, BAG_H];
    return [STASH_W, STASH_H];
  }

  /** The list and index (or the gear slot) under the cursor. */
  at(cur = this.cur) {
    const id = this.areas[cur.a];
    if (id === 'gear') {
      const slot = DOLL_AT[`${cur.c},${cur.r}`];
      return { area: 'gear', slot, item: slot ? this.s.hs.gear[slot] : null };
    }
    const list = id === 'bag' ? this.s.hs.bag : this.s.data.stash;
    const i = cur.r * this.dims(cur.a)[0] + cur.c;
    return { area: id, list, i, item: list[i] };
  }

  move(dx, dy) {
    const c = { ...this.cur };
    if (dx) {
      c.c += dx;
      const [w] = this.dims(c.a);
      if (c.c >= w && c.a < this.areas.length - 1) { c.a++; c.c = 0; c.r = Math.min(c.r, this.dims(c.a)[1] - 1); }
      else if (c.c < 0 && c.a > 0) { c.a--; c.c = this.dims(c.a)[0] - 1; c.r = Math.min(c.r, this.dims(c.a)[1] - 1); }
      c.c = Math.max(0, Math.min(this.dims(c.a)[0] - 1, c.c));
    }
    if (dy) c.r = Math.max(0, Math.min(this.dims(c.a)[1] - 1, c.r + dy));
    // the empty corners of the paper doll are skipped
    if (this.areas[c.a] === 'gear' && !DOLL_AT[`${c.c},${c.r}`]) {
      if (dy) c.r = Math.max(0, Math.min(2, c.r + dy));
      if (!DOLL_AT[`${c.c},${c.r}`]) { if (dx) c.c = Math.max(0, Math.min(2, c.c + dx)); }
      if (!DOLL_AT[`${c.c},${c.r}`]) return;
    }
    this.cur = c;
    this.msg = '';
    this.s.game.audio.play('select');
    this.render();
    // read the item aloud, with "better" when it is
    const it = this.at().item;
    if (it) {
      const d = this.s.compareItemFor(it);
      say(`${itemName(it)}. ${it.cls && it.cls !== this.s.cls ? t('ks.forClass', { cls: t(`ks.cls.${it.cls}`) }) : d !== null && d > 0.005 && this.s.hs.gear[it.slot] !== it ? t('ks.better') : ''}`);
    }
  }

  gridHtml(a) {
    const id = this.areas[a];
    const [w, h] = this.dims(a);
    let cells = '';
    for (let r = 0; r < h; r++) {
      for (let c = 0; c < w; c++) {
        const here = this.cur.a === a && this.cur.c === c && this.cur.r === r;
        if (id === 'gear') {
          const slot = DOLL_AT[`${c},${r}`];
          cells += slot ? cellHtml(this.s, this.s.hs.gear[slot], { cur: here, slot, upArrow: false }) : '<div class="ks-cell" style="background:none;box-shadow:none"></div>';
        } else {
          const list = id === 'bag' ? this.s.hs.bag : this.s.data.stash;
          cells += cellHtml(this.s, list[r * w + c], { cur: here });
        }
      }
    }
    const label = { gear: t('ks.worn'), bag: t('ks.bag'), stash: t('ks.stash') }[id];
    return `<div><div class="ks-label">${esc(label)}</div><div class="ks-grid" style="grid-template-columns:repeat(${w}, auto)">${cells}</div></div>`;
  }

  render() {
    const s = this.s, at = this.at();
    const title = { bag: t('ks.bagTitle'), smith: t('ks.smithTitle'), stash: t('ks.stashTitle') }[this.mode];
    const sub = this.mode === 'bag' ? heroSummary(s) : this.mode === 'smith' ? t('ks.smithSub') : t('ks.stashSub');
    let cards = itemCard(s, at.item, { title: at.area === 'gear' ? t('ks.worn') : t('ks.selected') });
    if (at.item && at.area !== 'gear' && s.hs.gear[at.item.slot] && (!at.item.cls || at.item.cls === s.cls)) cards += itemCard(s, s.hs.gear[at.item.slot], { title: t('ks.nowWorn'), compare: false });
    let action = '';
    if (this.mode === 'smith' && at.item) {
      const up = upgradeCost(at.item), sv = salvageValue(at.item);
      const upTxt = at.item.plus >= MAX_PLUS ? t('ks.smithMax') : t('ks.smithUp', { coins: up.coins, fluff: up.fluff });
      action = `<div class="ks-pill" style="display:inline-block;margin-top:6px">${esc(tFor(s.player, 'ks.smithA', { what: upTxt }))}${at.area !== 'gear' ? ` · ${esc(tFor(s.player, 'ks.smithC', { coins: sv.coins, fluff: sv.fluff }))}` : ''}</div>`;
    }
    const money = `<span class="ks-coin"></span> ${s.hs.coins} &nbsp; <span class="ks-fluff"></span>${s.hs.fluff}`;
    const hint = tFor(s.player, `ks.hint.${this.mode}`);
    this.el.innerHTML = `<h2>${esc(title)}<small>${esc(sub)}</small><small>${money}</small></h2>
      <div class="ks-row">${this.areas.map((_, a) => this.gridHtml(a)).join('')}</div>
      <div class="ks-cards">${cards}</div>${action}
      ${this.msg ? `<div class="ks-verdict good">${esc(this.msg)}</div>` : ''}<div class="foot">${esc(hint)}</div>`;
  }

  note(msg, good = true) {
    this.msg = msg;
    this.s.game.audio.play(good ? 'star' : 'bump');
    this.render();
  }

  // ---------------------------------------------------------------- actions

  /** [A] in the bag: wear the item (swapping with the worn one) or take a worn one off. */
  wear() {
    const s = this.s, hs = s.hs, at = this.at();
    if (!at.item) return;
    if (at.area === 'gear') {
      if (at.slot === 'weapon') { this.note(t('ks.needWeapon'), false); return; }
      const i = hs.bag.findIndex((x) => !x);
      if (i < 0) { this.note(t('ks.bagFull'), false); return; }
      hs.bag[i] = at.item;
      delete hs.gear[at.slot];
    } else {
      const it = at.item;
      if (it.cls && it.cls !== s.cls) { this.note(t('ks.notYours', { cls: t(`ks.cls.${it.cls}`) }), false); return; }
      const old = hs.gear[it.slot] || null;
      hs.gear[it.slot] = it;
      at.list[at.i] = old;
      this.note(t('ks.wearing', { name: itemName(it) }));
      say(t('ks.wearing', { name: itemName(it) }));
    }
    s.refreshHero();
    this.render();
  }

  /** [C] in the bag: drop it on the floor next to the hero (in town it stays). */
  drop() {
    const s = this.s, at = this.at();
    if (!at.item || at.area === 'gear') return;
    if (s.kind === 'town') { this.note(t('ks.dropTown'), false); return; }
    at.list[at.i] = null;
    const e = s.hero;
    const it = s.spawnGear(at.item, e.x + e.fx * 1.2, e.z + e.fz * 1.2);
    it.vx = it.vz = 0;
    this.note(t('ks.dropped'));
  }

  upgrade() {
    const s = this.s, hs = s.hs, at = this.at();
    if (!at.item) return;
    if (at.item.plus >= MAX_PLUS) { this.note(t('ks.smithMax'), false); return; }
    const c = upgradeCost(at.item);
    if (hs.coins < c.coins || hs.fluff < c.fluff) { this.note(t('ks.smithPoor'), false); s.npcSay('smith', t('ks.npc.smith.poor')); return; }
    hs.coins -= c.coins; hs.fluff -= c.fluff;
    at.item.plus++;
    s.refreshHero();
    this.note(t('ks.smithDone', { name: itemName(at.item) }));
    s.game.audio.play('fanfare');
    s.npcSay('smith', t('ks.npc.smith.up'));
    s.saveNow();
  }

  salvage() {
    const s = this.s, hs = s.hs, at = this.at();
    if (!at.item || at.area === 'gear') return;
    const v = salvageValue(at.item);
    at.list[at.i] = null;
    hs.coins += v.coins; hs.fluff += v.fluff;
    this.note(t('ks.salvaged', { coins: v.coins, fluff: v.fluff }));
    s.game.audio.play('pop');
    s.saveNow();
  }

  /** [A] at the stash: move the item to the other grid. */
  transfer() {
    const s = this.s, at = this.at();
    if (!at.item) return;
    const to = at.area === 'bag' ? s.data.stash : s.hs.bag;
    const i = to.findIndex((x) => !x);
    if (i < 0) { this.note(t(at.area === 'bag' ? 'ks.stashFull' : 'ks.bagFull'), false); return; }
    to[i] = at.item;
    at.list[at.i] = null;
    this.note(t(at.area === 'bag' ? 'ks.stored' : 'ks.taken'));
    s.saveNow();
  }

  /** Returns true when the panel closes. */
  update(dt, d) {
    if (!d) return false;
    const st = this.nav.step(d, dt);
    if (st.x || st.y) this.move(st.x, st.y);
    if (d.bPressed) { this.close(); return true; }
    if (d.aPressed) {
      if (this.mode === 'bag') this.wear();
      else if (this.mode === 'smith') this.upgrade();
      else this.transfer();
    }
    if (d.cPressed) {
      if (this.mode === 'bag') this.drop();
      else if (this.mode === 'smith') this.salvage();
    }
    return false;
  }

  close() {
    this.el.remove();
    this.s.saveNow();
  }
}
