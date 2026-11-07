import * as THREE from 'three';
import { t, tFor } from '../../core/i18n.js';
import { esc } from '../../core/ui.js';
import { say as speak } from '../../core/voice.js';
import { now, hourOf, give } from './save.js';
import { dayKey, dayRand, rainyOn } from './calendar.js';
import { heightAt, SEA_Y, PLACES } from './map.js';
import { makeMerchantCart, makeMerchant, makeVisitorBalloon, makeExplorer, makeBottle, makeDigX, makeStarBit, makeLostThing } from './models9.js';
import { ITEMS } from './items.js';

// Daily surprises (the owner's "More fun" list), one at most per day and the same for everyone on that
// date (calendar.js dayRand): a meteor shower at night (catch the falling star bits, also by jumping), the
// traveling merchant Marlo with odd things in the square, a hot-air balloon that lands with Skye the
// explorer (who lost her goggles on landing), and a bottle on the beach with a treasure map to a dig spot.
// About two days in three have one. surpriseOn(ms) tells which (tests use it to find a date).

/** The surprise of a date (or null): ~17% meteor shower (not on rainy days), 17% merchant, 15% balloon, 17% bottle. */
export function surpriseOn(ms = now()) {
  const r = dayRand(`surprise:${dayKey(ms)}`);
  if (r < 0.17) return rainyOn(ms) ? null : 'meteor';
  if (r < 0.34) return 'merchant';
  if (r < 0.49) return 'balloon';
  if (r < 0.66) return 'bottle';
  return null;
}
/** When each surprise is on (hours of the day). */
export const SURPRISE_HOURS = { meteor: [20, 24], merchant: [9, 18], balloon: [10, 17], bottle: [6, 21] };

const CART = { x: 25.1, z: -6.8 }, MERCHANT = { x: 23.5, z: -5.7 }; // (beside the road east of the square, not on it)
// Skye's balloon lands on the open meadow south-east of the square, away from every door, path and trail (it
// used to come down by the museum steps, in the way); map.spotClear() checks every spawn spot (placeSpots)
const BALLOON = { x: 22.2, z: 7.6 }, SKYE = { x: 20.3, z: 8.6 };
const BALLOON_R = 2.2; // the basket and the ropes, with room to walk around
const TAKEOFF = { wait: 1.4, up: 4.5 }; // in the evening: Skye climbs in, a puff of the burner, up and away
// where Skye's goggles can land (on things you hop onto, or just in the grass)
const GOGGLES = [{ x: 46.3, z: -4.5, on: 'log' }, { x: 23.4, z: -16.2, roof: true }, { x: -9.6, z: 26.4, hollow: true }, { x: 15.4, z: 25.4, pond: true }, { x: 34.0, z: 2.0 }];
// beach spots where the bottle washes up, and the dig spots the maps lead to (with a landmark for the hint)
const BOTTLE_AT = [[12.5, 41.6], [19.6, 41.3], [-6.4, 42.2], [28.4, 39.8]];
const DIG = [{ x: -3.6, z: 22.6, near: 'hollow' }, { x: 30.6, z: 22.4, near: 'lighthouse' }, { x: 19.4, z: -24.6, near: 'cliff' }, { x: 48.6, z: 12.6, near: 'garage' }, { x: -17.6, z: 18.2, near: 'barn' }, { x: 36.4, z: -2.2, near: 'museum' }];
// Marlo's odd things: [id, price, deco?]; three of them each merchant day
const WARES = [['mysterySeed', 30], ['oddSock', 5], ['goldenAcorn', 40], ['moonCheese', 25], ['rubberDuck', 60, true], ['cloudJar', 80, true], ['musicBox', 120, true], ['starJar', 150, true]];
const BITS_PER_NIGHT = 12;
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const GUEST = { merchant: { speaker: 'isl.merchant', css: '#7a4fc0' }, skye: { speaker: 'isl.skye', css: '#d9583a' } };

export class Surprises {
  constructor(host) {
    this.host = host;
    this.group = new THREE.Group();
    host.scene.add(this.group);
    // the merchant's cart and Marlo
    this.cart = makeMerchantCart();
    this.cart.position.set(CART.x, heightAt(CART.x, CART.z), CART.z);
    this.merchant = makeMerchant();
    this.merchant.position.set(MERCHANT.x, heightAt(MERCHANT.x, MERCHANT.z), MERCHANT.z);
    this.merchant.rotation.y = 0.5;
    this.cartObs = host.map.boxObs(1e5, CART.z, 1.3, 0.75, { ox: CART.x });
    // the balloon and Skye
    this.balloon = makeVisitorBalloon();
    this.skye = makeExplorer();
    this.skye.position.set(SKYE.x, heightAt(SKYE.x, SKYE.z), SKYE.z);
    this.skye.rotation.y = 0.3;
    this.balloonObs = host.map.circObs(1e5, BALLOON.z, 0.75, { ox: BALLOON.x });
    this.takeoff = null;
    this.goggles = makeLostThing('goggles');
    // the bottle and the dig spot
    this.bottle = makeBottle();
    this.digX = makeDigX();
    // star bits (a pool) and shooting stars across the sky
    this.bits = Array.from({ length: 6 }, () => { const g = makeStarBit(); g.visible = false; this.group.add(g); return { g, on: false }; });
    this.shooters = Array.from({ length: 3 }, () => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 3.2), new THREE.MeshBasicMaterial({ color: 0xfff6c0, transparent: true, opacity: 0, depthWrite: false }));
      m.material.userData = {};
      this.group.add(m);
      return { m, t: 1 + Math.random() * 3 };
    });
    for (const m of [this.cart, this.merchant, this.balloon, this.skye, this.goggles, this.bottle, this.digX]) { m.visible = false; this.group.add(m); }
    this.kind = null;
    this.today = '';
    this.bitT = 2;
    this.t = 0;
    this.balloonY = 0;
  }

  get S() { return this.host.save; }

  /** Today's state in the save (a new day starts fresh). */
  day() {
    const today = dayKey();
    const S = this.S;
    if (!S.surprise || S.surprise.day !== today) S.surprise = { day: today, bits: 0, bought: [], skye: 0, read: false, dug: false, told: false };
    return S.surprise;
  }

  /** Is the day's surprise going on right now? */
  on(kind, at = now()) {
    if (this.kind !== kind || this.host.isle2?.here()) return false;
    const [a, b] = SURPRISE_HOURS[kind];
    const h = this.host.forceHour ?? hourOf(at);
    return h >= a && h < b;
  }

  /**
   * Make sure every place a visitor or a find appears is clear of doors, paths, trails and the things you use
   * (map.spotClear); anything that is not moves to the nearest clear spot. (The goggles are meant to sit on
   * things you hop onto, so they are not checked.)
   */
  placeSpots() {
    const map = this.host.map;
    this.placed = true;
    this.moved = [];
    const fix = (p, r, name) => { const why = map.spotClear(p.x, p.z, r); if (!why) return; const q = map.findSpot(p.x, p.z, r); this.moved.push({ name, why, from: [p.x, p.z], to: [+q.x.toFixed(2), +q.z.toFixed(2)] }); p.x = q.x; p.z = q.z; };
    fix(BALLOON, BALLOON_R, 'balloon'); fix(SKYE, 0.6, 'skye'); fix(CART, 1.4, 'cart'); fix(MERCHANT, 0.4, 'merchant');
    for (const d of DIG) fix(d, 0.6, 'dig');
    this.balloonObs.ox = BALLOON.x; this.balloonObs.z = BALLOON.z;
    this.cartObs.ox = CART.x; this.cartObs.z = CART.z;
    this.cart.position.set(CART.x, heightAt(CART.x, CART.z), CART.z);
    this.merchant.position.set(MERCHANT.x, heightAt(MERCHANT.x, MERCHANT.z), MERCHANT.z);
    this.skye.position.set(SKYE.x, heightAt(SKYE.x, SKYE.z), SKYE.z);
  }

  tick(at) {
    if (!this.placed) this.placeSpots();
    const today = dayKey(at);
    const D = this.day();
    if (today !== this.today) {
      this.today = today;
      this.kind = surpriseOn(at);
      const r = dayRand(`surprise-at:${today}`);
      this.bottleAt = BOTTLE_AT[Math.floor(r * BOTTLE_AT.length)];
      this.dig = DIG[Math.floor(dayRand(`dig:${today}`) * DIG.length)];
      this.gogglesAt = GOGGLES[Math.floor(dayRand(`goggles:${today}`) * GOGGLES.length)];
      this.wares = this.pickWares(today);
    }
    const merchant = this.on('merchant', at), balloon = this.on('balloon', at), bottle = this.on('bottle', at), meteor = this.on('meteor', at);
    this.cart.visible = this.merchant.visible = merchant;
    this.cartObs.x = merchant ? this.cartObs.ox : 1e5;
    if (balloon && !this.balloon.visible) { this.balloonY = 14; this.takeoff = null; } // it comes down
    // the evening: it takes off (only if you are here to see it; it is never there at night)
    if (!balloon && this.balloon.visible && !this.takeoff && this.balloonY < 0.5 && (this.host.forceHour ?? hourOf(at)) < SURPRISE_HOURS.balloon[1] + 1) this.takeoff = { t: 0, vy: 0, dx: 0 };
    this.leaving = !balloon && !!this.takeoff;
    this.balloon.visible = balloon || this.leaving;
    this.balloonObs.x = balloon ? this.balloonObs.ox : 1e5;
    this.skye.visible = balloon && this.balloonY < 0.1;
    this.bottle.visible = bottle && !D.read;
    if (this.bottle.visible) this.bottle.position.set(this.bottleAt[0], Math.max(heightAt(...this.bottleAt), SEA_Y) + 0.05, this.bottleAt[1]);
    this.digX.visible = D.read && !D.dug;
    if (this.digX.visible) this.digX.position.set(this.dig.x, heightAt(this.dig.x, this.dig.z) + 0.02, this.dig.z);
    this.goggles.visible = balloon && D.skye === 1;
    if (this.goggles.visible) this.goggles.position.set(this.gogglesAt.x, this.gogglesY(), this.gogglesAt.z);
    this.meteor = meteor && this.host.night > 0.4;
    // the news, once a day when it starts (read aloud)
    if ((merchant || balloon || bottle || meteor) && !D.told && this.host.mode === 'walk') {
      D.told = true;
      this.host.later(1.4, () => this.news(`sur.news.${this.kind}`));
    }
  }

  gogglesY() {
    const g = this.gogglesAt;
    return this.host.map.supportAt(g.x, g.z, 99, this.host.walkState).y + 0.02;
  }

  /** Three of Marlo's odd things for a date. */
  pickWares(today) {
    const list = WARES.map((w, i) => ({ w, k: dayRand(`ware:${today}:${i}`) })).sort((a, b) => a.k - b.k).slice(0, 3).map((x) => x.w);
    return list;
  }

  /** The day's news, a toast (not read aloud: the narrator reads story and help). */
  news(key, vars) {
    this.host.dayToast(t(key, vars));
  }

  // ---------- [B] ----------

  interactions(P, out, nm) {
    const near = (x, z, r) => Math.hypot(P.x - x, P.z - z) < r;
    const D = this.day();
    if (this.merchant.visible && near(MERCHANT.x, MERCHANT.z + 0.4, 2.0)) { out.b = { text: nm('sur.h.merchant'), fn: () => this.talkMerchant() }; return true; }
    if (this.skye.visible && near(SKYE.x, SKYE.z, 2.0)) { out.b = { text: nm('sur.h.skye'), fn: () => this.talkSkye() }; return true; }
    if (this.goggles.visible && near(this.gogglesAt.x, this.gogglesAt.z, 1.3) && Math.abs(P.fy - this.gogglesY()) < 0.9) { out.b = { text: nm('sur.h.goggles'), fn: () => this.pickGoggles() }; return true; }
    if (this.bottle.visible && near(this.bottleAt[0], this.bottleAt[1], 1.4)) { out.b = { text: nm('sur.h.bottle'), fn: () => this.readBottle() }; return true; }
    if (this.digX.visible && near(this.dig.x, this.dig.z, 1.3)) { out.b = { text: nm('sur.h.dig'), fn: () => this.digUp() }; return true; }
    return false;
  }

  line(guest, key, vars, extra = {}) {
    const g = GUEST[guest];
    return { key, vars, speaker: g.speaker, css: g.css, name: t(`sur.name.${guest}`), ...extra };
  }

  // the traveling merchant
  talkMerchant() {
    const host = this.host, S = this.S, D = this.day();
    const left = this.wares.filter(([id]) => !D.bought.includes(id));
    if (!left.length) { host.say([this.line('merchant', 'sur.m.soldOut')]); return; }
    const names = left.map(([id, price]) => t('sur.m.ware', { item: this.itemName(id), n: price }));
    host.say([this.line('merchant', 'sur.m.hello', { list: names.join(', ') }, {
      choices: [...left.map(([id]) => cap(this.itemName(id))), t('sur.m.bye')],
      onChoice: (i) => {
        const w = left[i];
        if (!w) { host.say([this.line('merchant', 'sur.m.byeLine')]); return; }
        const [id, price, deco] = w;
        if (S.coins < price) { host.say([this.line('merchant', 'sur.m.poor', { n: price })]); return; }
        S.coins -= price;
        D.bought.push(id);
        host.game.audio.play('coin');
        if (deco) host.addDeco(id);
        else host.giveItems([[id, 1]]);
        host.say([this.line('merchant', `sur.m.sold.${id}`)]);
        host.markDirty();
      },
    })]);
  }

  itemName(id) { return t(ITEMS[id] ? `isl.i.${id}` : `isl.d.${id}`); }

  // the balloon visitor: hello, the lost goggles, the thank-you
  talkSkye() {
    const host = this.host, S = this.S, D = this.day();
    if (D.skye === 0) {
      D.skye = 1;
      host.say([this.line('skye', 'sur.s.hello'), this.line('skye', 'sur.s.goggles', { where: t(`sur.where.${this.gogglesWhere()}`) })]);
    } else if (D.skye === 1) host.say([this.line('skye', 'sur.s.wait', { where: t(`sur.where.${this.gogglesWhere()}`) })]);
    else if (D.skye === 2) {
      D.skye = 3;
      const first = !S.deco.balloonModel;
      host.say([this.line('skye', 'sur.s.thanks'), this.line('skye', first ? 'sur.s.gift' : 'sur.s.gift2')], () => {
        if (first) host.addDeco('balloonModel');
        host.grant({ coins: 50, items: [['starfruitSeed', 1]] });
      });
      host.game.audio.play('fanfare');
    } else host.say([this.line('skye', 'sur.s.bye')]);
    host.markDirty();
  }

  gogglesWhere() { const g = this.gogglesAt; return g.roof ? 'roof' : g.hollow ? 'hollow' : g.pond ? 'pond' : g.on ? 'stumps' : 'grass'; }

  pickGoggles() {
    const D = this.day();
    D.skye = 2;
    this.goggles.visible = false;
    this.host.game.audio.play('star');
    this.news('sur.t.goggles');
    this.host.markDirty();
  }

  // the bottle and the treasure map
  readBottle() {
    const host = this.host, D = this.day();
    D.read = true;
    this.bottle.visible = false;
    host.game.audio.play('pop');
    this.showMap();
    host.markDirty();
  }

  /** The treasure map: the island with an X (a panel, read aloud). */
  showMap() {
    const host = this.host;
    const X = this.dig;
    const sx = (x) => ((x + 62) / 124) * 300, sz = (z) => ((z + 48) / 96) * 200;
    const ico = (x, z, s) => `<text x="${sx(x)}" y="${sz(z)}" font-size="13" text-anchor="middle">${s}</text>`;
    const places = PLACES.filter((p) => !p.cabinet).map((p) => ico(p.x, p.z + 1, { lighthouse: '🗼', ship: '⛵', tent: '🎪', balloon: '🎈', mine: '⛏', keep: '🏰', castle: '🏰', burrow: '🕳', garage: '🤖' }[p.id] || '•')).join('');
    const svg = `<svg viewBox="0 0 300 200" style="width:100%;max-height:52vh;background:#f3d9a4;border-radius:14px">
      <ellipse cx="150" cy="100" rx="142" ry="94" fill="#9fd77a" stroke="#c99a5e" stroke-width="4"/>
      <path d="M${sx(-23)} ${sz(-48)} Q${sx(-24)} ${sz(-6)} ${sx(-26)} ${sz(6)} T${sx(-33)} ${sz(60)}" fill="none" stroke="#5ab8e8" stroke-width="6"/>
      ${ico(-12, -14, '🏠')}${ico(27, -14, '🕹')}${ico(12, -4, '⛲')}${ico(-12, 28, '🌳')}${places}
      <path d="M${sx(X.x) - 9} ${sz(X.z) - 9} L${sx(X.x) + 9} ${sz(X.z) + 9} M${sx(X.x) + 9} ${sz(X.z) - 9} L${sx(X.x) - 9} ${sz(X.z) + 9}" stroke="#d9583a" stroke-width="5" stroke-linecap="round"/></svg>`;
    const text = t('sur.map', { where: t(`sur.dig.${X.near}`) });
    host.mode = 'map';
    host.hud.setPanel(`<h2>${esc(t('sur.mapTitle'))}</h2>${svg}<div class="isl-letter" style="margin-top:8px">${esc(text)}</div><div class="isl-foot">${esc(tFor(host.player?.p, 'isl.ok'))}</div>`);
    speak(text, 'narrator');
    this.mapOpen = { t: 0 };
  }

  digUp() {
    const host = this.host, D = this.day();
    D.dug = true;
    this.digX.visible = false;
    const r = dayRand(`treasure:${this.today}`);
    const items = [['oldcoin', 1], r < 0.5 ? ['pearl', 1] : ['goldenAcorn', 1], [r < 0.3 ? 'mysterySeed' : 'pumpkinSeed', 2]];
    host.puffs.burst(new THREE.Vector3(this.dig.x, heightAt(this.dig.x, this.dig.z) + 0.4, this.dig.z), 0xc9a06a, { count: 18, speed: 3.5, size: 0.35, life: 0.7 });
    host.confetti.burst(new THREE.Vector3(this.dig.x, heightAt(this.dig.x, this.dig.z) + 1, this.dig.z), 0, { count: 40, speed: 5, up: 5, life: 1.3, gravity: -6, colors: [0xffd23f, 0xffffff, 0xff9fc0] });
    host.game.audio.play('fanfare');
    this.news('sur.t.dug');
    host.grant({ coins: 60 + Math.round(r * 60), items });
    host.markDirty();
  }

  // ---------- every frame ----------

  update(dt) {
    const host = this.host, P = host.player;
    this.t += dt;
    if (this.mapOpen && host.mode === 'map') {
      this.mapOpen.t += dt;
      const inp = P ? host.input(P.p) : null;
      if (inp && this.mapOpen.t > 0.4 && (inp.aPressed || inp.bPressed || inp.cPressed)) { host.hud.setPanel(null); host.mode = 'walk'; this.mapOpen = null; }
    }
    // the balloon comes down (and goes up again in the evening)
    if (this.balloon.visible) {
      const T = this.takeoff;
      if (T && !this.on('balloon')) {
        // the take-off: Skye hops in, the burner puffs, then up (faster and faster) and away to the east
        if (T.t === 0) { this.host.puffs.burst(new THREE.Vector3(SKYE.x, heightAt(SKYE.x, SKYE.z) + 0.6, SKYE.z), 0xffffff, { count: 10, speed: 3, size: 0.35 }); }
        T.t += dt;
        if (T.t > TAKEOFF.wait) {
          T.vy = Math.min(TAKEOFF.up, T.vy + dt * 2.5);
          this.balloonY += T.vy * dt;
          T.dx += dt * 0.9 * Math.min(1, this.balloonY / 4);
        }
        if (Math.floor(T.t * 4) !== Math.floor((T.t - dt) * 4)) this.host.puffs.burst(this.balloon.position.clone().add(new THREE.Vector3(0, 2.3, 0)), 0xffb347, { count: 2, speed: 1, up: 1.5, size: 0.25, life: 0.4 });
        if (this.balloonY > 18) { this.balloon.visible = false; this.leaving = false; this.takeoff = null; this.balloonY = 0; }
        this.balloon.position.set(BALLOON.x + T.dx, heightAt(BALLOON.x, BALLOON.z) + this.balloonY, BALLOON.z);
      } else {
        this.balloonY = Math.max(0, this.balloonY - dt * 2.2); // it comes down
        this.balloon.position.set(BALLOON.x + Math.sin(this.t * 0.4) * (this.balloonY > 0.1 ? 0.6 : 0), heightAt(BALLOON.x, BALLOON.z) + this.balloonY, BALLOON.z);
      }
      this.balloon.userData.top.rotation.y = Math.sin(this.t * 0.3) * 0.15;
      this.skye.visible = this.on('balloon') && this.balloonY < 0.1;
    }
    if (this.merchant.visible) { this.merchant.position.y = heightAt(MERCHANT.x, MERCHANT.z) + Math.abs(Math.sin(this.t * 2.2)) * 0.05; if (P) this.merchant.rotation.y = Math.atan2(P.x - MERCHANT.x, P.z - MERCHANT.z); }
    if (this.skye.visible && P) { this.skye.rotation.y = Math.atan2(P.x - SKYE.x, P.z - SKYE.z); this.skye.position.y = heightAt(SKYE.x, SKYE.z) + (this.day().skye === 2 ? Math.abs(Math.sin(this.t * 6)) * 0.2 : 0); }
    if (this.goggles.visible) { this.goggles.rotation.y += dt; this.goggles.userData.glint.scale.y = 0.6 + Math.sin(this.t * 5) * 0.4; }
    if (this.bottle.visible) this.bottle.rotation.z = Math.sin(this.t * 1.5) * 0.15;
    this.updateMeteor(dt);
  }

  /** The meteor shower: shooting stars, and star bits that fall near you. Catch them (a jump catches them in the air). */
  updateMeteor(dt) {
    const host = this.host, P = host.player, D = this.day();
    const on = this.meteor && P && host.mode === 'walk' && !host.indoors;
    for (const s of this.shooters) {
      const m = s.m;
      m.visible = !!this.meteor && s.life > 0;
      if (!this.meteor) { m.material.opacity = 0; continue; }
      s.t -= dt;
      if (s.t <= 0) { s.t = 1.5 + Math.random() * 2.5; s.life = 0.9; const a = Math.random() * 6; s.from = new THREE.Vector3((P?.x || 0) + Math.cos(a) * 14, 16 + Math.random() * 6, (P?.z || 0) - 10 - Math.random() * 8); s.dir = new THREE.Vector3(-1 + Math.random() * 2, -0.5, 0.4).normalize(); }
      if (s.life > 0) {
        s.life -= dt;
        m.position.copy(s.from).addScaledVector(s.dir, (0.9 - s.life) * 26);
        m.lookAt(m.position.clone().add(s.dir));
        m.material.opacity = Math.max(0, Math.sin((s.life / 0.9) * Math.PI)) * 0.9;
      } else m.material.opacity = 0;
    }
    // star bits
    this.bitT -= dt;
    if (on && this.bitT <= 0 && D.bits < BITS_PER_NIGHT) {
      this.bitT = 2.2 + Math.random() * 1.6;
      const b = this.bits.find((x) => !x.on);
      if (b) {
        for (let k = 0; k < 8; k++) {
          const a = Math.random() * Math.PI * 2, r = 2.5 + Math.random() * 4;
          const x = P.x + Math.cos(a) * r, z = P.z + Math.sin(a) * r * 0.8;
          const s = host.map.supportAt(x, z, P.fy + 0.5, host.walkState);
          if (s.water || !host.map.walkable(x, z, 0.3, host.walkState, s.y)) continue;
          Object.assign(b, { on: true, x, z, y: s.y + 11, ground: s.y + 0.35, vy: -9, life: 9 });
          b.g.visible = true;
          break;
        }
      }
    }
    for (const b of this.bits) {
      if (!b.on) continue;
      if (b.y > b.ground) { b.y = Math.max(b.ground, b.y + b.vy * dt); if (b.y === b.ground) { host.puffs.burst(new THREE.Vector3(b.x, b.ground, b.z), 0xfff27a, { count: 6, speed: 2, size: 0.2, life: 0.5 }); host.game.audio.play('pop'); } } else b.life -= dt;
      b.g.position.set(b.x, b.y + (b.y === b.ground ? Math.sin(this.t * 4 + b.x) * 0.08 : 0), b.z);
      b.g.rotation.y += dt * 3;
      const caught = P && host.mode === 'walk' && Math.hypot(P.x - b.x, P.z - b.z) < 0.85 && b.y > P.fy - 0.3 && b.y < P.fy + 1.5;
      if (caught) {
        const inAir = b.y > b.ground + 0.2;
        b.on = false;
        b.g.visible = false;
        D.bits++;
        give(this.S, 'starBit', inAir ? 2 : 1);
        host.confetti.burst(new THREE.Vector3(b.x, b.y, b.z), 0, { count: 18, speed: 3.5, up: 3, life: 0.9, gravity: -5, colors: [0xfff27a, 0xffffff, 0x9ff0ff] });
        host.game.audio.play('star');
        host.gotToast(inAir ? t('sur.t.bitAir') : t('isl.i.starBit'));
        if (D.bits === BITS_PER_NIGHT) this.later(0.8, () => this.news('sur.t.wish'));
        host.markDirty();
      } else if (b.life <= 0) { b.on = false; b.g.visible = false; }
    }
  }

  later(s, fn) { this.host.later(s, fn); }

  tasks() {
    const D = this.S.surprise?.day === dayKey() ? this.S.surprise : null;
    const out = [];
    if (this.meteor) out.push(t('sur.task.meteor', { n: D?.bits || 0, m: BITS_PER_NIGHT }));
    if (D?.read && !D.dug) out.push(t('sur.task.dig', { where: t(`sur.dig.${this.dig.near}`) }));
    if (D?.skye === 1 && this.on('balloon')) out.push(t('sur.task.goggles', { where: t(`sur.where.${this.gogglesWhere()}`) }));
    if (D?.skye === 2) out.push(t('sur.task.skye'));
    return out;
  }

  dispose() {}
}
