import * as THREE from 'three';
import { Character } from '../../core/character.js';
import { PLAYER_COLORS } from '../../core/palette.js';
import { t, tFor } from '../../core/i18n.js';
import { esc } from '../../core/ui.js';
import { say as speak } from '../../core/voice.js';
import { ITEMS, icon } from './items.js';
import { RECIPES, RECIPE_IDS, matches, isRiverFish } from './sea.js';
import { count, give, take, hourOf, now } from './save.js';
import { CAFE, heightAt } from './map.js';
import { makeCafeBoards, makeCafeOpen, makeCafeTable, mesh, box } from './models.js';
import { NPCS, npcState, makeNpcModel } from './npcs.js';

// The Driftwood Café on the beach: fix it (wood + coins), cook dishes at the stove from the recipe book,
// and open for guests (a Dave the Diver style service: guests order what you cooked, you pick the guest
// and the dish and serve it before they get tired of waiting). Coins, tips and friendship.

const WOOD_NEED = 10, COIN_NEED = 100;
const SEATS = [-11.4, -10, -8.6].map((x) => ({ x, z: CAFE.z + 2.55 }));
const SERVE_SPOT = { x: CAFE.x, z: CAFE.z + 4.35 };
const STOVE = { x: CAFE.x - 3.3, z: CAFE.z + 2.9 };
const MENU = { x: CAFE.x + 2.9, z: CAFE.z + 4.2 }; // the chalkboard with today's specials (milestone B3)
const MAX_SPECIALS = 4, SPECIAL_BONUS = 1.3;
const ENTER = { x: CAFE.x + 4.4, z: CAFE.z + 2.55 };
const PATIENCE = 30;
const FRIENDS = ['rosa', 'hazel', 'bram', 'grumbleton', 'pip', 'mumble'];
const FAVORITE = { hazel: 'carrotSoup', rosa: 'strawberryShake', bram: 'fishStew', grumbleton: 'sushi', pip: 'tempura', mumble: 'radishSalad', shelby: 'seaweedSalad' };
// friends from Shell Isle only sail over as regulars (3+ hearts), for their favorite dish (milestone B4)
const ISLE_FRIENDS = ['shelby'];
export const OPEN_HOURS = [8, 22];

const CSS = `
.label.isl-order { background: rgba(255,250,240,.96); border-radius: 16px; padding: 4px 8px 6px; border: 3px solid #3ddc97; text-align: center; font-weight: 700; font-size: clamp(11px, 1vw, 15px); }
.label.isl-order img { width: clamp(42px, 4vw, 60px); height: clamp(42px, 4vw, 60px); display: block; margin: 0 auto; }
.label.isl-order .pat { height: 6px; border-radius: 3px; background: #e0d8c8; overflow: hidden; margin-top: 3px; }
.label.isl-order .pat i { display: block; height: 100%; background: #3ddc97; }
.label.isl-order.sel { border-color: #ffd84a; box-shadow: 0 0 0 4px #ffd84a; }
.label.isl-order.low .pat i { background: #ff5d73; }
.label.isl-order .say { white-space: nowrap; }
.isl-cook-ing { display: inline-flex; align-items: center; gap: 2px; margin-right: 8px; font-size: .85em; }
.isl-cook-ing svg, .isl-cook-ing img { width: 1.5em; height: 1.5em; }
.isl-cook-ing.no { color: #d9364f; }
.isl-row img.isl-ico, .isl-gifts img.isl-ico { width: 1.8em; height: 1.8em; }
`;

function injectStyle() {
  if (document.getElementById('isl-cafe-style')) return;
  const el = document.createElement('style');
  el.id = 'isl-cafe-style';
  el.textContent = CSS;
  document.head.appendChild(el);
}

export class Cafe {
  constructor(host) {
    injectStyle();
    this.host = host;
    const map = host.map;
    this.boards = map.live(makeCafeBoards(), CAFE.x, CAFE.z, 0, heightAt(CAFE.x, CAFE.z));
    this.open = map.live(makeCafeOpen(host.M), CAFE.x, CAFE.z, 0, heightAt(CAFE.x, CAFE.z));
    for (const [x, z, c] of [[CAFE.x - 5.2, CAFE.z + 1.6, 0xff5d73], [CAFE.x + 3.6, CAFE.z + 1.8, 0xffc93c]]) {
      map.live(makeCafeTable(c), x, z);
      map.circObs(x, z, 0.6);
    }
    map.boxObs(CAFE.x, CAFE.z + 3.4, 2.15, 0.35, { cafe: true });
    // the specials board: a little chalkboard on legs
    if (!host.save.cafe.specials) host.save.cafe.specials = [];
    const mb = new THREE.Group();
    for (const s of [-1, 1]) { const leg = mesh(box(0.08, 1.3, 0.08), 0x8a5a32, s * 0.45, 0.6, 0); leg.rotation.x = 0.12; mb.add(leg); }
    mb.add(mesh(box(1.1, 0.8, 0.08), 0x8a5a32, 0, 1.0, 0.06), mesh(box(0.96, 0.66, 0.09), 0x2f4a3a, 0, 1.0, 0.07, false));
    for (let i = 0; i < 3; i++) mb.add(mesh(box(0.6 - i * 0.1, 0.05, 0.1), 0xffffff, -0.1, 1.2 - i * 0.16, 0.08, false), mesh(box(0.08, 0.08, 0.1), 0xffd23f, 0.32, 1.2 - i * 0.16, 0.08, false));
    this.menuBoard = map.live(mb, MENU.x, MENU.z, 0.2);
    map.circObs(MENU.x, MENU.z, 0.45, { cafe: true });
    map.circObs(STOVE.x, STOVE.z, 0.7, { cafe: true });
    this.svc = null;
    this.refresh();
  }

  get save() { return this.host.save; }
  get repaired() { return this.save.cafe.repaired; }

  refresh() {
    this.boards.visible = !this.repaired;
    this.open.visible = this.repaired;
    this.menuBoard.visible = this.repaired;
  }

  // ---------- today's specials ----------

  get specials() { return this.save.cafe.specials; }
  isSpecial(id) { return this.specials.includes(id); }
  priceOf(id) { return Math.round(RECIPES[id].price * (this.isSpecial(id) ? SPECIAL_BONUS : 1)); }

  openMenu() {
    const host = this.host;
    host.mode = 'board';
    this.menu = { i: this.menu?.i || 0, t: 0 };
    this.renderMenu();
    host.game.audio.play('select');
    speak(t('isl.menu.intro', { n: MAX_SPECIALS }));
  }

  renderMenu() {
    const host = this.host, M = this.menu;
    const start = Math.max(0, Math.min(M.i - 3, RECIPE_IDS.length - 7));
    const rows = RECIPE_IDS.slice(start, start + 7).map((id, k) => {
      const on = this.isSpecial(id);
      return `<div class="isl-row ${start + k === M.i ? 'on' : ''}">${icon(id)}<div>${on ? '★ ' : ''}${esc(t(`isl.i.${id}`))} <small>${esc(t('isl.shop.owned', { n: count(this.save, id) }))}</small></div>
        <small>${on ? esc(t('isl.menu.special')) : ''}</small><div class="p">${icon('coin')}${this.priceOf(id)}</div></div>`;
    }).join('');
    const list = this.specials.map((id) => t(`isl.i.${id}`)).join(', ') || '—';
    host.hud.setPanel(`<h2>${esc(t('isl.menu.title'))}</h2>
      <div class="isl-foot" style="opacity:1;margin:0 0 6px">${esc(t('isl.menu.today', { list, n: this.specials.length, m: MAX_SPECIALS }))}</div>
      <div class="isl-rows">${rows}</div>
      <div class="isl-foot">${esc(tFor(host.player?.p, 'isl.menu.hint'))}</div>`);
  }

  updateMenu(inp, dt) {
    const M = this.menu, host = this.host, sp = this.specials;
    M.t += dt;
    if (inp.stepY) { M.i = THREE.MathUtils.clamp(M.i - inp.stepY, 0, RECIPE_IDS.length - 1); host.game.audio.play('select'); this.renderMenu(); }
    if (M.t < 0.25) return;
    if (inp.bPressed) { host.hud.setPanel(null); host.mode = 'walk'; host.markDirty(); return; }
    if (inp.aPressed) {
      const id = RECIPE_IDS[M.i];
      if (this.isSpecial(id)) sp.splice(sp.indexOf(id), 1);
      else {
        if (sp.length >= MAX_SPECIALS) sp.shift(); // the oldest special makes room
        sp.push(id);
      }
      host.game.audio.play('pop');
      host.markDirty();
      this.renderMenu();
    }
  }

  isOpenHour(h = hourOf()) { return h >= OPEN_HOURS[0] && h < OPEN_HOURS[1]; }

  /** [B] actions near the café (fills out.b). */
  interactions(P, out, nm) {
    const near = (p, r) => Math.hypot(P.x - p.x, P.z - p.z) < r;
    const S = this.save;
    if (!this.repaired) {
      if (near({ x: CAFE.x, z: CAFE.z + 2.6 }, 2.6) || near({ x: -5.2, z: 40.6 }, 1.4)) out.b = { text: nm('isl.h.repair', { w: count(S, 'wood') }), fn: () => this.askRepair() };
      return;
    }
    if (near(MENU, 1.5)) out.b = { text: nm('isl.h.menu'), fn: () => this.openMenu() };
    else if (near(STOVE, 1.8)) out.b = { text: nm('isl.h.cook'), fn: () => this.openCook(false) };
    else if (near(SERVE_SPOT, 1.5)) out.b = { text: nm('isl.h.serve'), fn: () => this.askService() };
  }

  // ---------- repair ----------

  askRepair() {
    const host = this.host, S = this.save;
    const w = count(S, 'wood');
    if (w < WOOD_NEED || S.coins < COIN_NEED) {
      host.say([{ key: 'isl.cafe.repairNeed', vars: { w, c: S.coins } }]);
      return;
    }
    host.say([{ key: 'isl.cafe.repairAsk', choices: ['isl.yes', 'isl.no'], onChoice: (i) => { if (i === 0) this.repair(); } }]);
  }

  repair() {
    const host = this.host, S = this.save;
    take(S, 'wood', WOOD_NEED);
    S.coins -= COIN_NEED;
    S.cafe.repaired = true;
    give(S, 'recipes', 1);
    this.refresh();
    host.confetti.burst(new THREE.Vector3(CAFE.x, 3, CAFE.z + 2), 0, { count: 70, speed: 8, up: 5, life: 1.6, gravity: -7, colors: [0x3ddc97, 0xffffff, 0xffc93c, 0xff5d73] });
    host.puffs.burst(new THREE.Vector3(CAFE.x, 1.5, CAFE.z + 2), 0xc68a52, { count: 20, speed: 4, size: 0.5 });
    host.game.audio.play('fanfare');
    host.game.ui.toast(t('isl.cafe.repaired'), 2600);
    host.markDirty();
    // Rosa's dream comes true
    host.say([{ who: 'rosa', key: 'isl.rosa.dream1' }, { who: 'rosa', key: 'isl.rosa.dream2' }], () => host.addPts('rosa', 10));
  }

  // ---------- cooking ----------

  /** Items that can fill a need, cheapest first. */
  supply(need) {
    // river fish first for "any fish", so sea fish stay free for sushi; then the cheapest
    const rank = (id) => (need === 'fish' && isRiverFish(id) ? -1000 : 0) + (ITEMS[id]?.sell || 0);
    return this.save.inv.filter((it) => matches(need, it.id)).sort((a, b) => rank(a.id) - rank(b.id));
  }

  have(need) { return this.supply(need).reduce((a, it) => a + it.n, 0); }

  canCook(id) { return RECIPES[id].need.every(([n, k]) => this.have(n) >= k); }

  openCook(bookOnly) {
    const host = this.host;
    host.mode = 'cook';
    this.cook = { i: this.cook?.i || 0, t: 0, bookOnly };
    this.renderCook();
    host.game.audio.play('select');
  }

  renderCook() {
    const C = this.cook, host = this.host;
    const start = Math.max(0, Math.min(C.i - 3, RECIPE_IDS.length - 7));
    const rows = RECIPE_IDS.slice(start, start + 7).map((id, k) => {
      const r = RECIPES[id];
      const ings = r.need.map(([n, need]) => {
        const have = this.have(n);
        const ic = ITEMS[n] ? icon(n) : icon(n === 'seafish' ? 'tuna' : 'trout');
        return `<span class="isl-cook-ing ${have < need ? 'no' : ''}">${ic}${need > 1 ? `×${need}` : ''} <small>${esc(t(`isl.i.${n}`))} ${Math.min(have, need)}/${need}</small></span>`;
      }).join('');
      return `<div class="isl-row ${start + k === C.i ? 'on' : ''}" style="grid-template-columns: clamp(34px,3.2vw,46px) 1fr auto auto">${icon(id)}<div>${this.isSpecial(id) ? '★ ' : ''}${esc(t(`isl.i.${id}`))}<div>${ings}</div></div>
        <small>${esc(t('isl.shop.owned', { n: count(this.save, id) }))}</small><div class="p">${icon('coin')}${this.priceOf(id)}</div></div>`;
    }).join('');
    const regs = this.regulars().map((id) => `${t(`isl.npc.${id}`)}: ${t(`isl.i.${FAVORITE[id]}`)}`).join(', ');
    host.hud.setPanel(`<h2>${esc(t('isl.cook.title'))}</h2>${regs ? `<div class="isl-foot" style="opacity:1;margin:0 0 6px">${esc(t('isl.cafe.regulars', { list: regs }))}</div>` : ''}<div class="isl-rows">${rows}</div>
      <div class="isl-foot">${esc(tFor(host.player?.p, C.bookOnly ? 'isl.cook.bookHint' : 'isl.cook.hint'))}</div>`);
  }

  updateCook(inp, dt) {
    const C = this.cook, host = this.host;
    C.t += dt;
    if (inp.stepY) { C.i = THREE.MathUtils.clamp(C.i - inp.stepY, 0, RECIPE_IDS.length - 1); host.game.audio.play('select'); this.renderCook(); }
    if (C.t < 0.25) return;
    if (inp.bPressed) { host.hud.setPanel(null); host.mode = 'walk'; return; }
    if (inp.aPressed && !C.bookOnly) this.cookOne(RECIPE_IDS[C.i]);
  }

  cookOne(id) {
    const host = this.host, S = this.save;
    if (!this.canCook(id)) { host.game.ui.toast(t('isl.cook.missing'), 1200); host.game.audio.play('bump'); return false; }
    for (const [n, k] of RECIPES[id].need) {
      let left = k;
      for (const it of this.supply(n)) { const use = Math.min(left, it.n); take(S, it.id, use); left -= use; if (!left) break; }
    }
    give(S, id, 1);
    S.cafe.cooked++;
    host.puffs.burst(new THREE.Vector3(STOVE.x, 1.6, STOVE.z), 0xffffff, { count: 14, speed: 2, up: 2, size: 0.5, life: 1 });
    host.game.audio.play('star');
    host.game.ui.toast(t('isl.cook.cooked', { item: t(`isl.i.${id}`) }), 1400);
    host.markDirty();
    if (host.mode === 'cook') this.renderCook();
    return true;
  }

  /** Friends with 3+ hearts are regulars with a standing order (their favorite dish). */
  regulars() {
    return [...FRIENDS, ...ISLE_FRIENDS].filter((id) => (npcState(this.save, id).pts || 0) >= 30);
  }

  // ---------- service ----------

  dishesInStock() {
    return this.save.inv.filter((it) => ITEMS[it.id]?.kind === 'dish' && it.n > 0).map((it) => it.id);
  }

  askService() {
    const host = this.host;
    if (!this.isOpenHour()) { host.say([{ key: 'isl.cafe.closed' }]); return; }
    if (!this.dishesInStock().length) { host.say([{ key: 'isl.cafe.noDishes' }]); return; }
    host.say([{ key: 'isl.cafe.openAsk', choices: ['isl.yes', 'isl.no'], onChoice: (i) => { if (i === 0) this.startService(); } }]);
  }

  startService() {
    const host = this.host, P = host.player;
    P.x = SERVE_SPOT.x; P.z = SERVE_SPOT.z; P.fx = 0; P.fz = -1;
    P.ch.face(0, -1);
    host.mode = 'service';
    this.svc = { seats: [null, null, null], sel: 1, dish: 0, spawnT: 0.6, guests: 0, max: 6, served: 0, coins: 0, tips: 0, done: false, t: 0, sumT: 0 };
    host.game.audio.play('join');
    host.game.audio.playMusic('party');
  }

  pendingCount(id) {
    return this.svc.seats.filter((g) => g && g.state !== 'out' && !g.served && g.order === id).length;
  }

  spawnGuest() {
    const host = this.host, sv = this.svc;
    const free = sv.seats.findIndex((g) => !g);
    if (free < 0 || sv.guests >= sv.max || sv.closing) return false;
    const avail = this.dishesInStock().filter((id) => count(this.save, id) - this.pendingCount(id) > 0);
    if (!avail.length) return false;
    // a friend (awake, not already here) or a visitor
    const here = new Set(sv.seats.filter(Boolean).map((g) => g.who));
    const regs = this.regulars();
    const friends = [...FRIENDS, ...ISLE_FRIENDS.filter((id) => regs.includes(id))].filter((id) => !here.has(id) && !host.npc(id).sleep && !host.npc(id).talking);
    // regulars (3+ hearts) come first, once each per night, for their usual dish
    const regular = regs.find((id) => friends.includes(id) && !sv.came?.has(id) && avail.includes(FAVORITE[id]));
    let who = null, model;
    if (regular || (friends.length && Math.random() < 0.65)) {
      who = regular || friends[Math.floor(Math.random() * friends.length)];
      (sv.came ||= new Set()).add(who);
      model = makeNpcModel(who);
      const real = host.npc(who);
      real.model.group.visible = false;
      real.away = true;
    } else {
      const c = PLAYER_COLORS[Math.floor(Math.random() * PLAYER_COLORS.length)];
      model = new Character(c.hex, { hat: Math.floor(Math.random() * 5) });
    }
    const fav = who && FAVORITE[who];
    // today's specials are popular: most guests without a favorite ask for one
    const specials = avail.filter((id) => this.isSpecial(id));
    const order = fav && avail.includes(fav) ? fav : specials.length && Math.random() < 0.65 ? specials[Math.floor(Math.random() * specials.length)] : avail[Math.floor(Math.random() * avail.length)];
    model.group.position.set(ENTER.x, heightAt(ENTER.x, ENTER.z), ENTER.z);
    host.scene.add(model.group);
    const tag = host.game.ui.label('label isl-order');
    sv.seats[free] = { seat: free, who, regular: who && who === regular, model, order, x: ENTER.x, z: ENTER.z, state: 'in', pat: PATIENCE, say: '', sayT: 0, tag, hop: 0 };
    sv.guests++;
    return true;
  }

  serve() {
    const host = this.host, sv = this.svc, S = this.save;
    const g = sv.seats[sv.sel];
    const stock = this.dishesInStock();
    const dish = stock[sv.dish];
    if (!g || g.state !== 'wait' || !dish) { host.game.audio.play('bump'); return; }
    if (dish !== g.order) {
      g.pat = Math.max(1, g.pat - 6);
      g.say = t('isl.serve.wrong');
      g.sayT = 2;
      speak(g.say, g.who ? NPCS[g.who].voice : {});
      host.game.audio.play('bump');
      return;
    }
    take(S, dish, 1);
    const price = this.priceOf(dish); // specials sell for more
    const tip = Math.round(price * 0.5 * (g.pat / PATIENCE) * (S.unlocks.rosaHelps ? 1.25 : 1) * (g.regular ? 2 : 1));
    S.coins += price + tip;
    S.cafe.earned += price + tip;
    S.cafe.served++;
    sv.served++;
    sv.coins += price + tip;
    sv.tips += tip;
    g.state = 'eat';
    g.eatT = 1.4;
    g.served = true;
    g.hop = 1;
    g.say = g.regular ? `${t('isl.serve.regular')} +${price + tip}` : t('isl.serve.tip', { n: price + tip, t: tip });
    g.sayT = 1.6;
    const dishModel = host.dishModel(dish);
    dishModel.position.set(SEATS[g.seat].x, 0.72, CAFE.z + 3.3);
    host.scene.add(dishModel);
    g.plate = dishModel;
    if (g.who) host.addPts(g.who, g.regular ? 6 : 4);
    host.confetti.burst(new THREE.Vector3(g.x, 2.2, g.z), 0, { count: 22, speed: 4, up: 4, life: 1, gravity: -8, colors: [0xffd23f, 0xffe47a, 0x3ddc97] });
    host.game.audio.play('coin');
    sv.dish = Math.min(sv.dish, Math.max(0, this.dishesInStock().length - 1));
    host.markDirty();
  }

  updateService(inp, dt) {
    const host = this.host, sv = this.svc;
    sv.t += dt;
    if (sv.done) {
      sv.sumT += dt;
      if (sv.sumT > 0.4 && (inp.aPressed || inp.bPressed)) this.finish();
      return;
    }
    const stock = this.dishesInStock();
    if (inp.stepX) { sv.sel = THREE.MathUtils.clamp(sv.sel + inp.stepX, 0, 2); host.game.audio.play('select'); }
    if (inp.stepY && stock.length) { sv.dish = (sv.dish - inp.stepY + stock.length) % stock.length; host.game.audio.play('select'); }
    if (inp.aPressed && sv.t > 0.3) this.serve();
    if (inp.bPressed && sv.t > 0.3) { sv.closing = true; for (const g of sv.seats) if (g && g.state !== 'eat') g.state = 'out'; }
    // guests arrive every few seconds
    sv.spawnT -= dt;
    if (sv.spawnT <= 0) { sv.spawnT = 3 + Math.random() * 3; this.spawnGuest(); }
    for (const g of sv.seats) if (g) this.updateGuest(g, dt);
    const empty = sv.seats.every((g) => !g);
    const noMore = sv.guests >= sv.max || sv.closing || !this.dishesInStock().some((id) => count(this.save, id) - this.pendingCount(id) > 0);
    if (empty && noMore && sv.t > 1) this.summary();
    // the tray: dishes you have, on the hotbar
    host.hud.setHotbar(stock.map((id) => ({ id, n: count(this.save, id), kind: 'dish', name: t(`isl.i.${id}`) })), sv.dish, false);
  }

  updateGuest(g, dt) {
    const host = this.host, sv = this.svc;
    const seat = SEATS[g.seat];
    let tx = g.x, tz = g.z;
    if (g.state === 'in') { tx = seat.x; tz = seat.z; }
    if (g.state === 'out') { tx = ENTER.x + 3; tz = ENTER.z; }
    const dx = tx - g.x, dz = tz - g.z, d = Math.hypot(dx, dz);
    let moving = 0;
    if (d > 0.05) {
      const sp = Math.min(d, 2.6 * dt);
      g.x += (dx / d) * sp; g.z += (dz / d) * sp;
      g.model.face(dx, dz);
      moving = 0.6;
    } else if (g.state === 'in') { g.state = 'wait'; g.model.face(0, 1); }
    else if (g.state === 'out') { this.removeGuest(g); return; }
    if (g.state === 'wait') {
      g.pat -= dt;
      if (g.pat <= 0) { g.state = 'out'; g.say = t('isl.serve.left'); g.sayT = 1.5; host.game.audio.play('leave'); }
    }
    if (g.state === 'eat') {
      g.eatT -= dt;
      g.model.face(0, 1);
      if (g.eatT <= 0) { g.state = 'out'; if (g.plate) { g.plate.removeFromParent(); g.plate = null; } }
    }
    g.hop = Math.max(0, g.hop - dt * 2.5);
    g.model.group.position.set(g.x, heightAt(g.x, g.z) + Math.sin(g.hop * Math.PI) * 0.6, g.z);
    g.model.update(dt, { moving, grounded: true, vy: 0 });
    g.sayT -= dt;
    // the order bubble
    let html;
    if (g.sayT > 0) html = `<div class="say">${esc(g.say)}</div>`;
    else if (g.state === 'wait') html = `${this.isSpecial(g.order) ? '<div class="say">★</div>' : ''}<img src="${host.picture(g.order)}" alt=""><div class="pat"><i style="width:${Math.round((g.pat / PATIENCE) * 100)}%"></i></div>`;
    else html = '';
    if (!html) g.tag.style.display = 'none';
    else {
      if (g.tag.innerHTML !== html) g.tag.innerHTML = html;
      g.tag.classList.toggle('sel', g.seat === sv.sel && g.state === 'wait');
      g.tag.classList.toggle('low', g.pat < PATIENCE * 0.3);
      host.game.ui.place(g.tag, new THREE.Vector3(g.x, 2.6, g.z), host.camera);
    }
  }

  removeGuest(g) {
    const host = this.host;
    g.model.group.removeFromParent();
    g.tag.remove();
    if (g.plate) g.plate.removeFromParent();
    if (g.who) { const real = host.npc(g.who); real.model.group.visible = true; real.away = false; }
    this.svc.seats[g.seat] = null;
  }

  summary() {
    const host = this.host, sv = this.svc;
    sv.done = true;
    sv.sumT = 0;
    const line = sv.served ? t('isl.serve.summary', { n: sv.served, c: sv.coins, t: sv.tips }) : t('isl.serve.none');
    host.hud.setPanel(`<h2>${esc(t('isl.serve.done'))}</h2><div class="isl-letter">${esc(line)}</div><div class="isl-foot">${esc(tFor(host.player?.p, 'isl.ok'))}</div>`);
    speak(line);
    host.game.audio.play(sv.served ? 'fanfare' : 'leave');
  }

  finish() {
    const host = this.host;
    for (const g of this.svc.seats) if (g) this.removeGuest(g);
    this.save.cafe.nights++;
    this.svc = null;
    host.hud.setPanel(null);
    host.mode = 'walk';
    host.game.audio.playMusic('hub');
    host.markDirty();
  }

  /** Leaving the scene mid-service: give the friends back. */
  dispose() {
    if (this.svc) for (const g of this.svc.seats) if (g) { g.tag.remove(); if (g.who) { const r = this.host.npc(g.who); r.away = false; } }
  }
}

export const CAFE_SPOTS = { SEATS, SERVE_SPOT, STOVE };
