import { t, tFor } from '../../core/i18n.js';
import { esc } from '../../core/ui.js';
import { say } from '../../core/voice.js';
import { BAG_W, BAG_H, STASH_W, STASH_H, MAX_PLUS, SLOTS, sizeOf, itemName, upgradeCost, salvageValue, sellValue, identifyCost, meetsReq, USE_PRICE, rollItem, rollRarity, shopBelt } from './items.js';
import { Grid } from './grid.js';
import { itemIcon, slotIcon, itemCard, heroSummary } from './ui.js';
import { isBetter } from './classes.js';
import { BELT_SLOTS } from './save.js';

// The item panels of Pillow Keep Solo, Diablo style. One panel class in several modes:
//   bag    the paper doll (worn gear), the 10x4 bag grid and the belt
//   stash  the 10x10 stash chest (shared by the profile's three heroes) next to the bag
//   shop   Auntie Fizz's shelf (potions, scrolls, a belt, a mystery box) next to the bag: Ctrl+click or right click sells
//   smith  Bolster's forge: click an item, then upgrade (+1 to +5) or salvage it into fluff
//   sage   Old Snorewell the sage: identify items, and reset stat and skill points
//   lost   the lost-and-found chest (old items that did not fit after the big bag change)
// Mouse: left click picks an item up onto the pointer and puts it down (or swaps it with the item
// under it), drag and drop works too; right click wears / takes off / drinks / reads; Ctrl+click
// moves to the stash or sells; the tooltip compares with what you wear (green ▲ = better).
// Gamepad: the stick moves the same pointer, [A] is a left click, [C] a right click, [B] closes.

const DOLL = ['helmet', 'charm', 'weapon', 'armor', 'offhand', 'gloves', 'belt', 'boots'];
const SHOP = ['hp', 'mp', 'tp', 'id', 'belt', 'box'];

export class GridPanel {
  constructor(scene, mode = 'bag') {
    this.s = scene;
    this.mode = mode;
    this.held = null; // { it, back: () => void } an item on the pointer
    this.sel = null; // the item chosen at the forge
    this.msg = '';
    this.good = true;
    this.lastSay = null;
    this.identifying = null; // an Identify scroll waiting for an item
    this.el = document.createElement('div');
    this.el.className = 'ks-panel ks-inv';
    scene.hud.layer.appendChild(this.el);
    this.tip = document.createElement('div');
    this.tip.className = 'ks-tip';
    scene.hud.layer.appendChild(this.tip);
    this.ghost = document.createElement('div');
    this.ghost.className = 'ks-ghost';
    scene.hud.layer.appendChild(this.ghost);
    this.render();
  }

  get bag() { return new Grid(this.s.hs.bag, BAG_W, BAG_H); }
  get stash() { return new Grid(this.s.data.stash, STASH_W, STASH_H); }
  gridOf(id) { return id === 'bag' ? this.bag : id === 'stash' ? this.stash : null; }

  // ---------------------------------------------------------------- drawing

  gridHtml(id, grid) {
    const items = grid.list.map((e) => {
      const [w, h] = sizeOf(e.it);
      return `<div class="ks-it r${e.it.rarity} ${this.flags(e.it)}" style="left:calc(var(--cs) * ${e.x});top:calc(var(--cs) * ${e.y});width:calc(var(--cs) * ${w});height:calc(var(--cs) * ${h})">${this.iconHtml(e.it)}</div>`;
    }).join('');
    return `<div class="ks-grid2" data-grid="${id}" style="width:calc(var(--cs) * ${grid.w});height:calc(var(--cs) * ${grid.h});--gw:${grid.w}">${items}<i class="ks-drop"></i></div>`;
  }

  /** Little marks on an item: better (▲), not yours, needs not met, unidentified, upgrades. */
  flags(it) {
    const s = this.s;
    const out = [];
    if (it === this.sel) out.push('sel');
    if (it.cls && it.cls !== s.cls) out.push('other');
    else if (it.slot !== 'use' && !meetsReq(it, s.hero.st.attrs)) out.push('noreq');
    return out.join(' ');
  }

  iconHtml(it) {
    const s = this.s;
    const d = s.compareItemFor(it);
    const worn = s.hs.gear[it.slot] === it;
    const up = !worn && isBetter(d) ? '<span class="up">▲</span>' : '';
    const unid = it.unid ? '<span class="unid">?</span>' : '';
    return `${itemIcon(it)}${up}${unid}${it.plus ? `<span class="plus">+${it.plus}</span>` : ''}`;
  }

  dollHtml() {
    const s = this.s;
    const slots = DOLL.map((slot) => {
      const it = s.hs.gear[slot];
      const off = it && s.hero.st.off.has(slot);
      return `<div class="ks-doll-${slot} ks-slot ${it ? `r${it.rarity}` : 'empty'} ${off ? 'noreq' : ''} ${it === this.sel ? 'sel' : ''}" data-slot="${slot}">${it ? this.iconHtml(it) : slotIcon(slot, s.cls)}<b>${esc(t(`ks.slot.${slot}`))}</b></div>`;
    }).join('');
    return `<div class="ks-doll">${slots}</div>`;
  }

  beltHtml() {
    const s = this.s, belt = s.hs.belt, cap = s.beltCap();
    let cells = '';
    for (let row = cap / 4 - 1; row >= 0; row--) {
      for (let c = 0; c < 4; c++) {
        const it = belt[row * 4 + c];
        cells += `<div class="ks-bcell" data-belt="${row * 4 + c}">${it ? itemIcon(it) : ''}${row === 0 ? `<span class="key">${c + 5}</span>` : ''}</div>`;
      }
    }
    return `<div><div class="ks-label">${esc(t('ks.beltLabel'))}</div><div class="ks-belt">${cells}</div></div>`;
  }

  money() {
    const hs = this.s.hs;
    return `<span class="ks-coin"></span> ${hs.coins} &nbsp; <span class="ks-fluff"></span>${hs.fluff}`;
  }

  leftHtml() {
    const s = this.s, hs = s.hs;
    switch (this.mode) {
      case 'stash': return `<div><div class="ks-label">${esc(t('ks.stash'))}</div>${this.gridHtml('stash', this.stash)}</div>`;
      case 'shop': {
        const rows = SHOP.map((id) => {
          const p = this.shopPrice(id);
          const icon = id === 'box' ? slotIcon('charm', null, '#ffd23f') : id === 'belt' ? slotIcon('belt') : itemIcon({ slot: 'use', use: id, rarity: 0 });
          return `<div class="ks-item ks-buy ${hs.coins >= p ? '' : 'off'}" data-buy="${id}">${icon}<div class="grow">${esc(t(`ks.shop.${id}`))}<small>${esc(t(`ks.shop.${id}Desc`))}</small></div><b><span class="ks-coin"></span> ${p}</b></div>`;
        }).join('');
        return `<div class="ks-list ks-shop">${rows}</div>`;
      }
      case 'smith': {
        const it = this.sel;
        let btns = '';
        if (it) {
          const up = upgradeCost(it), sv = salvageValue(it);
          const worn = Object.values(hs.gear).includes(it);
          btns = `<div class="ks-btn ${it.plus >= MAX_PLUS || it.slot === 'use' ? 'off' : ''}" data-act="up">${esc(it.plus >= MAX_PLUS ? t('ks.smithMax') : t('ks.smithUp', { coins: up.coins, fluff: up.fluff }))}</div>
            <div class="ks-btn ${worn ? 'off' : ''}" data-act="salvage">${esc(t('ks.smithSalvage', { coins: sv.coins, fluff: sv.fluff }))}</div>`;
        }
        return `<div class="ks-side">${itemCard(s, it, { title: t('ks.selected') })}${btns}${this.dollHtml()}</div>`;
      }
      case 'sage': {
        const unid = this.allItems().filter((x) => x.unid);
        const all = unid.reduce((a, x) => a + identifyCost(x), 0);
        const reset = s.resetCost();
        return `<div class="ks-side"><p class="ks-say">${esc(t('ks.sageSub'))}</p>
          <div class="ks-btn ${unid.length ? '' : 'off'}" data-act="idall">${esc(t('ks.sageAll', { n: unid.length, coins: all }))}</div>
          <div class="ks-btn" data-act="reset">${esc(t('ks.sageReset', { coins: reset }))}</div>${this.dollHtml()}</div>`;
      }
      case 'lost': {
        const lost = s.data.lost;
        const cells = lost.map((it, i) => `<div class="ks-it2 r${it.rarity}" data-lost="${i}">${this.iconHtml(it)}</div>`).join('');
        return `<div><div class="ks-label">${esc(t('ks.lostLabel', { n: lost.length }))}</div><div class="ks-lost">${cells || `<i>${esc(t('ks.lostEmpty'))}</i>`}</div></div>`;
      }
      default: return `<div class="ks-side">${this.dollHtml()}<div class="ks-sum">${esc(heroSummary(s))}</div></div>`;
    }
  }

  render() {
    const s = this.s;
    const title = t(`ks.inv.${this.mode}`);
    const sub = t(`ks.inv.${this.mode}Sub`);
    const hint = tFor(s.player, s.isPad() ? `ks.hintPad.${this.mode}` : `ks.hintMouse.${this.mode}`);
    this.el.innerHTML = `<h2>${esc(title)}<small>${esc(sub)}</small><small>${this.money()}</small></h2>
      <div class="ks-row">${this.leftHtml()}<div><div class="ks-label">${esc(t('ks.bag'))}</div>${this.gridHtml('bag', this.bag)}${this.mode === 'bag' || this.mode === 'shop' ? this.beltHtml() : ''}</div></div>
      <div class="ks-verdict ${this.good ? 'good' : 'bad'}">${esc(this.msg || ' ')}</div><div class="foot">${esc(hint)}</div>`;
    this.dirty = false;
  }

  note(msg, good = true, speak = false) {
    this.msg = msg;
    this.good = good;
    this.s.game.audio.play(good ? 'star' : 'bump');
    if (speak) say(msg);
    this.render();
  }

  allItems() {
    const hs = this.s.hs;
    return [...hs.bag.map((e) => e.it), ...Object.values(hs.gear), ...(this.mode === 'stash' ? this.s.data.stash.map((e) => e.it) : [])];
  }

  // ---------------------------------------------------------------- what is under the pointer

  /** { area: 'bag'|'stash'|'gear'|'belt'|'buy'|'act'|'lost', ... } under the pointer, or null. */
  pointed() {
    const m = this.s.mouse;
    const el = m.element();
    if (!el || !this.el.contains(el)) return null;
    const g = el.closest('[data-grid]');
    if (g) {
      const r = g.getBoundingClientRect();
      const id = g.dataset.grid;
      const grid = this.gridOf(id);
      const cs = r.width / grid.w;
      const fx = (m.x - r.left) / cs, fy = (m.y - r.top) / cs;
      const cx = Math.floor(fx), cy = Math.floor(fy);
      return { area: id, grid, cx, cy, fx, fy, cs, rect: r, entry: grid.at(cx, cy), el: g };
    }
    const sl = el.closest('[data-slot]');
    if (sl) return { area: 'gear', slot: sl.dataset.slot, item: this.s.hs.gear[sl.dataset.slot] || null };
    const b = el.closest('[data-belt]');
    if (b) return { area: 'belt', i: +b.dataset.belt, item: this.s.hs.belt[+b.dataset.belt] || null };
    const buy = el.closest('[data-buy]');
    if (buy) return { area: 'buy', id: buy.dataset.buy };
    const act = el.closest('[data-act]');
    if (act) return { area: 'act', id: act.dataset.act };
    const lost = el.closest('[data-lost]');
    if (lost) return { area: 'lost', i: +lost.dataset.lost, item: this.s.data.lost[+lost.dataset.lost] };
    return { area: 'panel' };
  }

  itemAt(p) {
    if (!p) return null;
    if (p.area === 'bag' || p.area === 'stash') return p.entry?.it || null;
    return p.item || null;
  }

  // ---------------------------------------------------------------- per frame

  /** Returns true when the panel closes. */
  update(dt, d) {
    const s = this.s, m = s.mouse;
    if (s.isPad() || m.virtual || !m.used) m.drive(d, dt);
    if (d?.bPressed) {
      if (this.held) this.putBack(); else { this.close(); return true; }
    }
    const p = this.pointed();
    if (m.leftPressed) this.leftClick(p, m.clickCtrl || m.ctrl);
    else if (m.leftReleased && this.held && this.dragFrom && p && (p.area !== this.dragFrom.area || p.cx !== this.dragFrom.cx || p.cy !== this.dragFrom.cy || p.slot !== this.dragFrom.slot)) this.leftClick(p, false, true);
    if (m.rightPressed) this.rightClick(p);
    if (this.dirty) this.render();
    this.drawHover(p);
    return false;
  }

  /** The tooltip, the item on the pointer and the green / red drop spot. */
  drawHover(p) {
    const s = this.s, m = s.mouse;
    // the held item follows the pointer
    if (this.held) {
      const [w, h] = sizeOf(this.held.it);
      const cs = this.el.querySelector('.ks-grid2')?.getBoundingClientRect().width / BAG_W || 40;
      const html = `<div class="ks-it r${this.held.it.rarity}" style="width:${cs * w}px;height:${cs * h}px">${this.iconHtml(this.held.it)}</div>`;
      if (this.ghost.dataset.k !== this.held.it.id) { this.ghost.innerHTML = html; this.ghost.dataset.k = this.held.it.id; }
      this.ghost.style.display = '';
      this.ghost.style.transform = `translate(${m.x - cs * w / 2}px, ${m.y - cs * h / 2}px)`;
    } else this.ghost.style.display = 'none';
    // where a held item would land
    for (const dr of this.el.querySelectorAll('.ks-drop')) dr.style.display = 'none';
    if (this.held && p && p.grid) {
      const spot = this.dropSpot(p, this.held.it);
      const dr = p.el.querySelector('.ks-drop');
      const [w, h] = sizeOf(this.held.it);
      dr.style.display = '';
      dr.style.left = `calc(var(--cs) * ${spot.x})`; dr.style.top = `calc(var(--cs) * ${spot.y})`;
      dr.style.width = `calc(var(--cs) * ${w})`; dr.style.height = `calc(var(--cs) * ${h})`;
      dr.className = `ks-drop ${spot.ok ? 'ok' : 'no'}`;
    }
    // the tooltip
    const it = this.held ? null : this.itemAt(p);
    if (it) {
      const key = `${it.id}|${it.unid}|${it.plus}|${this.msg}`;
      if (this.tip.dataset.k !== key) {
        const worn = s.hs.gear[it.slot];
        let html = itemCard(s, it, { title: '' });
        if (worn && worn !== it && (!it.cls || it.cls === s.cls)) html += itemCard(s, worn, { title: t('ks.nowWorn'), compare: false });
        this.tip.innerHTML = html;
        this.tip.dataset.k = key;
      }
      this.tip.style.display = '';
      const r = this.tip.getBoundingClientRect();
      let x = m.x + 18, y = m.y + 14;
      if (x + r.width > window.innerWidth - 6) x = m.x - r.width - 18;
      if (y + r.height > window.innerHeight - 6) y = Math.max(6, window.innerHeight - r.height - 6);
      this.tip.style.transform = `translate(${x}px, ${y}px)`;
      if (this.lastSay !== it.id) {
        this.lastSay = it.id;
        const dd = s.compareItemFor(it);
        say(`${itemName(it)}. ${it.cls && it.cls !== s.cls ? t('ks.forClass', { cls: t(`ks.cls.${it.cls}`) }) : isBetter(dd) && s.hs.gear[it.slot] !== it ? t('ks.better') : ''}`);
      }
    } else { this.tip.style.display = 'none'; this.tip.dataset.k = ''; this.lastSay = null; }
    this.el.classList.toggle('identify', !!this.identifying);
  }

  /** Top-left cell for the held item over a grid (centered under the pointer) and whether it fits. */
  dropSpot(p, it) {
    const [w, h] = sizeOf(it);
    const x = Math.max(0, Math.min(p.grid.w - w, Math.round(p.fx - w / 2)));
    const y = Math.max(0, Math.min(p.grid.h - h, Math.round(p.fy - h / 2)));
    const under = p.grid.under(x, y, w, h);
    return { x, y, under, ok: under.length <= 1 };
  }

  // ---------------------------------------------------------------- clicks

  leftClick(p, ctrl, drop = false) {
    const s = this.s;
    this.dragFrom = null;
    if (!p || p.area === 'panel') return;
    if (this.identifying) { this.identifyWith(p); return; }
    if (p.area === 'buy') { this.buy(p.id); return; }
    if (p.area === 'act') { this.act(p.id); return; }
    if (p.area === 'lost') { this.takeLost(p.i); return; }
    const it = this.itemAt(p);
    if (this.mode === 'smith' || this.mode === 'sage') {
      // the forge and the sage: click chooses (the sage identifies right away)
      if (!it) return;
      if (this.mode === 'sage') { this.identifyPaid(it); return; }
      this.sel = it; this.msg = ''; s.game.audio.play('select'); this.render();
      return;
    }
    if (ctrl && it && !this.held) { this.ctrlMove(p, it); return; }
    if (this.held) { this.place(p); return; }
    if (!it || drop) return;
    // pick it up onto the pointer
    this.pickUp(p, it);
    this.dragFrom = { area: p.area, cx: p.cx, cy: p.cy, slot: p.slot };
  }

  pickUp(p, it) {
    const s = this.s, hs = s.hs;
    if (p.area === 'bag' || p.area === 'stash') {
      const e = p.entry;
      p.grid.remove(e);
      this.held = { it, back: () => p.grid.place(it, e.x, e.y) };
    } else if (p.area === 'gear') {
      delete hs.gear[p.slot];
      this.held = { it, back: () => { hs.gear[p.slot] = it; } };
      s.refreshHero();
    } else if (p.area === 'belt') {
      hs.belt[p.i] = null;
      this.held = { it, back: () => { hs.belt[p.i] = it; } };
      s.settleBelt();
    }
    s.game.audio.play('select');
    this.msg = '';
    this.dirty = true;
  }

  /** Put the held item down where the pointer is (swapping with one item under it). */
  place(p) {
    const s = this.s, hs = s.hs, it = this.held.it;
    if (p.grid) {
      const spot = this.dropSpot(p, it);
      if (!spot.ok) { this.note(t('ks.noRoom'), false); return; }
      const other = spot.under[0] || null;
      if (other) p.grid.remove(other);
      p.grid.place(it, spot.x, spot.y);
      this.held = other ? { it: other.it, back: this.held.back && (() => this.stowAnywhere(other.it)) } : null;
      s.game.audio.play('select');
    } else if (p.area === 'gear') {
      if (it.slot !== p.slot) { this.note(t('ks.wrongSlot', { slot: t(`ks.slot.${p.slot}`) }), false); return; }
      if (!this.canWear(it)) return;
      const old = hs.gear[p.slot] || null;
      hs.gear[p.slot] = it;
      this.held = old ? { it: old, back: () => this.stowAnywhere(old) } : null;
      s.refreshHero();
      s.settleBelt();
      this.note(t('ks.wearing', { name: itemName(it) }), true, true);
    } else if (p.area === 'belt') {
      if (it.slot !== 'use') { this.note(t('ks.beltOnly'), false); return; }
      if (p.i >= s.beltCap()) return;
      const old = hs.belt[p.i];
      hs.belt[p.i] = it;
      this.held = old ? { it: old, back: () => this.stowAnywhere(old) } : null;
      s.settleBelt();
      s.game.audio.play('select');
    } else return;
    this.dirty = true;
  }

  canWear(it) {
    const s = this.s;
    if (it.cls && it.cls !== s.cls) { this.note(t('ks.notYours', { cls: t(`ks.cls.${it.cls}`) }), false, true); return false; }
    if (!meetsReq(it, s.hero.st.attrs)) { this.note(t('ks.needStats', { what: s.reqText(it) }), false, true); return false; }
    return true;
  }

  /** Bag, then stash (in town), then the floor or the lost-and-found chest: an item is never lost. */
  stowAnywhere(it) {
    const s = this.s;
    if (this.bag.add(it)) return;
    if (s.kind === 'town' && this.stash.add(it)) return;
    if (s.kind === 'dungeon') { const g = s.spawnGear(it, s.hero.x, s.hero.z); g.vx = g.vz = 0; return; }
    s.data.lost.push(it);
  }

  /** The held item goes back where it came from (or anywhere it fits). */
  putBack() {
    const h = this.held;
    if (!h) return;
    this.held = null;
    if (h.back) h.back(); else this.stowAnywhere(h.it);
    // a weapon must always be worn
    const hs = this.s.hs;
    if (!hs.gear.weapon) {
      const e = hs.bag.find((x) => x.it.slot === 'weapon' && (!x.it.cls || x.it.cls === this.s.cls) && meetsReq(x.it, this.s.hero.st.attrs));
      if (e) { new Grid(hs.bag, BAG_W, BAG_H).remove(e); hs.gear.weapon = e.it; }
    }
    this.s.refreshHero();
    this.s.settleBelt();
    this.dirty = true;
  }

  /** Right click: wear / take off / drink / read (stash: move across; shop: sell). */
  rightClick(p) {
    const s = this.s, hs = s.hs;
    if (this.identifying) { this.identifying = null; this.note(t('ks.idCancel'), false); return; }
    const it = this.itemAt(p);
    if (!it || this.held) return;
    if (this.mode === 'stash' || this.mode === 'shop') { this.ctrlMove(p, it); return; }
    if (this.mode === 'smith') { this.sel = it; this.dirty = true; return; }
    if (this.mode === 'sage') { this.identifyPaid(it); return; }
    if (it.slot === 'use') {
      // drink or read it
      const ok = s.useConsumable(it, this);
      if (ok && ok !== 'keep') this.removeFrom(p);
      this.dirty = true;
      return;
    }
    if (p.area === 'gear') {
      if (p.slot === 'weapon') { this.note(t('ks.needWeapon'), false); return; }
      if (!this.bag.add(it)) { this.note(t('ks.bagFull'), false); return; }
      delete hs.gear[p.slot];
      s.refreshHero();
      s.settleBelt();
      this.note(t('ks.tookOff', { name: itemName(it) }));
      return;
    }
    if (p.area === 'bag') {
      if (!this.canWear(it)) return;
      const old = hs.gear[it.slot] || null;
      p.grid.remove(p.entry);
      hs.gear[it.slot] = it;
      if (old && !this.bag.add(old)) { hs.gear[it.slot] = old; p.grid.place(it, p.entry.x, p.entry.y); this.note(t('ks.bagFull'), false); s.refreshHero(); return; }
      s.refreshHero();
      s.settleBelt();
      this.note(t('ks.wearing', { name: itemName(it) }), true, true);
    }
  }

  removeFrom(p) {
    const hs = this.s.hs;
    if (p.area === 'bag' || p.area === 'stash') p.grid.remove(p.entry);
    else if (p.area === 'belt') { hs.belt[p.i] = null; this.s.settleBelt(); }
  }

  /** Ctrl+click: to the stash and back, or sell at the shop. */
  ctrlMove(p, it) {
    const s = this.s;
    if (p.area === 'gear' || p.area === 'belt') return;
    if (this.mode === 'shop' && p.area === 'bag') {
      const v = sellValue(it);
      p.grid.remove(p.entry);
      s.hs.coins += v;
      this.note(t('ks.sold', { name: itemName(it), coins: v }), true, true);
      s.game.audio.play('coin');
      s.saveNow();
      return;
    }
    if (this.mode !== 'stash') return;
    const to = p.area === 'bag' ? this.stash : this.bag;
    if (!to.add(it)) { this.note(t(p.area === 'bag' ? 'ks.stashFull' : 'ks.bagFull'), false); return; }
    p.grid.remove(p.entry);
    this.note(t(p.area === 'bag' ? 'ks.stored' : 'ks.taken'));
    s.saveNow();
  }

  // ---------------------------------------------------------------- shop, forge, sage, lost and found

  shopPrice(id) {
    const s = this.s;
    if (id === 'belt') return 150 + 20 * Math.max(0, s.D);
    if (id === 'box') return 60 + 15 * Math.max(0, s.D);
    return USE_PRICE[id];
  }

  buy(id) {
    const s = this.s, hs = s.hs, price = this.shopPrice(id);
    if (hs.coins < price) { this.note(t('ks.poor'), false); s.npcSay('fizz', t('ks.npc.fizz.poor')); return; }
    let it;
    if (id === 'box') it = rollItem({ ilvl: s.D, rarity: rollRarity('box', s.D), slot: SLOTS[Math.floor(Math.random() * SLOTS.length)], cls: s.cls, diff: s.hs.diff });
    else if (id === 'belt') it = shopBelt(Math.max(0, s.D - 1));
    else it = s.newUse(id);
    // potions and scrolls go on the belt first
    const ok = (it.slot === 'use' && s.beltAdd(it)) || this.bag.add(it);
    if (!ok) { this.note(t('ks.bagFull'), false); return; }
    hs.coins -= price;
    if (id === 'box') {
      hs.stats.found++;
      if (it.rarity >= 2) hs.stats.rares++;
      s.npcSay('fizz', t('ks.npc.fizz.box'));
      this.note(t('ks.boxGot', { name: itemName(it) }), true, true);
      s.game.audio.play(it.rarity >= 2 ? 'fanfare' : 'star');
    } else { this.note(t('ks.bought'), true); s.game.audio.play('coin'); }
    s.saveNow();
  }

  act(id) {
    const s = this.s, hs = s.hs, it = this.sel;
    if (id === 'up' && it) {
      if (it.plus >= MAX_PLUS) { this.note(t('ks.smithMax'), false); return; }
      const c = upgradeCost(it);
      if (hs.coins < c.coins || hs.fluff < c.fluff) { this.note(t('ks.smithPoor'), false); s.npcSay('smith', t('ks.npc.smith.poor')); return; }
      hs.coins -= c.coins; hs.fluff -= c.fluff;
      it.plus++;
      s.refreshHero();
      this.note(t('ks.smithDone', { name: itemName(it) }), true, true);
      s.game.audio.play('fanfare');
      s.npcSay('smith', t('ks.npc.smith.up'));
      s.saveNow();
    } else if (id === 'salvage' && it) {
      const e = this.s.hs.bag.find((x) => x.it === it);
      if (!e) { this.note(t('ks.salvageWorn'), false); return; }
      const v = salvageValue(it);
      this.bag.remove(e);
      hs.coins += v.coins; hs.fluff += v.fluff;
      this.sel = null;
      this.note(t('ks.salvaged', { coins: v.coins, fluff: v.fluff }), true, true);
      s.game.audio.play('pop');
      s.saveNow();
    } else if (id === 'idall') {
      for (const x of this.allItems()) if (x.unid && !this.identifyPaid(x, true)) break;
      this.render();
    } else if (id === 'reset') s.resetPoints(this);
  }

  /** The sage identifies an item for coins. */
  identifyPaid(it, quiet = false) {
    const s = this.s, hs = s.hs;
    if (!it.unid) { if (!quiet) this.note(t('ks.idAlready'), false); return true; }
    const c = identifyCost(it);
    if (hs.coins < c) { this.note(t('ks.poor'), false); return false; }
    hs.coins -= c;
    s.identify(it);
    this.note(t('ks.identified', { name: itemName(it) }), true, true);
    s.npcSay('snore', t('ks.npc.snore.id'));
    s.saveNow();
    return true;
  }

  /** With an Identify scroll on the pointer: click an unidentified item. */
  identifyWith(p) {
    const it = this.itemAt(p);
    if (!it || !it.unid) { this.note(t('ks.idPick'), false); return; }
    const scroll = this.identifying;
    this.identifying = null;
    this.s.consume(scroll);
    this.s.identify(it);
    this.note(t('ks.identified', { name: itemName(it) }), true, true);
    this.s.saveNow();
  }

  takeLost(i) {
    const s = this.s, it = s.data.lost[i];
    if (!it) return;
    if (!this.bag.add(it)) { this.note(t('ks.bagFull'), false); return; }
    s.data.lost.splice(i, 1);
    this.note(t('ks.taken'));
    s.saveNow();
  }

  close() {
    this.putBack();
    this.el.remove();
    this.tip.remove();
    this.ghost.remove();
    this.s.saveNow();
  }
}

/** For tests and the [C] pick-up: is there room in the bag for this item? */
export function bagRoom(hs, it) {
  return !!new Grid(hs.bag, BAG_W, BAG_H).spot(it);
}

export { BELT_SLOTS };
