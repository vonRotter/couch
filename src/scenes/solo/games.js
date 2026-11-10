import * as THREE from 'three';
import { timingScale, struggle, overcame } from '../../core/assist.js';
import { t, tFor } from '../../core/i18n.js';
import { esc } from '../../core/ui.js';
import { say as speak } from '../../core/voice.js';
import { now, hourOf, give } from './save.js';
import { dayKey, dayRand } from './calendar.js';
import { heightAt, SEA_Y, bake } from './map.js';
import { mesh, sph } from './models.js';
import { makeLeafPile, makeSnowFort, makeSnowball, makeFlatStone, makeStonePile, makeKite, makeKiteStand } from './models9.js';
import { makeBush } from '../../core/world.js';

// Island mini-games (the owner's "More fun" list):
// - Skipping stones on the beach: [B] at the pile of flat stones, then [B] again when the bar is in the green.
// - Kite flying on kite hill: [B] at the kite stand; the stick keeps the kite in the wind for 30 seconds.
// - Hide-and-seek with Mumble (he asks when you talk to him; play.js): count to five, then find the bush that
//   giggles at the meadow within a minute.
// - A snowball fight with Pip in winter weeks (she asks; play.js): [B] throws, jump over her snowballs.
// - Leaf piles in autumn weeks: jump into one (from a hop) and it bursts; some hide a little something.
// Rewards are small (coins, a seed, friendship); nothing is ever lost.

export const PILE = { x: 25.6, z: 40.2, face: { x: 0.35, z: 1 } }; // skipping stones (throw toward the sea)
export const KITE = { x: 13.4, z: -25.6 }; // the kite stand on kite hill
const HIDE = [[51.8, -7.6], [53.4, -11.6], [48.6, -13.6], [44.8, -9.4], [51.2, -13.0], [43.2, -12.6]]; // bushes at the meadow
export const LEAF_PILES = [[-3.7, -13.4], [2.5, -11.6], [16.4, 4.2], [6.2, 15.2], [26.4, 12.0], [-6.2, 16.4], [36.6, -6.2], [30.4, -6.8]];
const ARENA = { x0: 15.5, x1: 22.5, them: 1.9, fort: 2.9, me: 9.4, myFort: 8.4 }; // the snowball fight, south of the square
const SKIP_SWEET = [0.72, 0.9];
/** The green part of the skipping meter: wider with forgiving timing ("Help me play"), around the same middle. */
const sweetFor = (p) => { const k = timingScale(p), mid = 0.81, h = 0.09 * k; return [mid - h, Math.min(0.99, mid + h)]; };
const RIPPLE_GEO = new THREE.RingGeometry(0.75, 1, 28);
const CSS = `.isl-meter { left: 50%; bottom: 24vh; transform: translateX(-50%); width: min(420px, 60vw); height: 26px; border-radius: 999px; background: rgba(255,255,255,.9);
  box-shadow: 0 3px 0 rgba(43,35,64,.2); overflow: hidden; }
.isl-meter .sweet { position: absolute; top: 0; bottom: 0; background: #8ddf4a; }
.isl-meter .needle { position: absolute; top: -2px; bottom: -2px; width: 8px; margin-left: -4px; background: #2b2340; border-radius: 4px; }`;

export class IslandGames {
  constructor(host) {
    this.host = host;
    const S = host.save;
    if (!S.games) S.games = {};
    const G = S.games;
    for (const [k, v] of Object.entries({ skipBest: 0, kiteBest: 0, hide: { day: '', n: 0, found: 0 }, snow: { day: '', wins: 0 }, leaves: { day: '', done: [] } })) if (G[k] === undefined) G[k] = v;
    if (!document.getElementById('isl-games-style')) {
      const el = document.createElement('style');
      el.id = 'isl-games-style';
      el.textContent = CSS;
      document.head.appendChild(el);
    }
    this.el = document.createElement('div');
    this.el.className = 'isl-hop';
    this.el.style.display = 'none';
    host.hud.root.appendChild(this.el);
    this.meter = document.createElement('div');
    this.meter.className = 'isl-meter';
    this.meter.style.display = 'none';
    this.meter.innerHTML = `<div class="sweet" style="left:${SKIP_SWEET[0] * 100}%;width:${(SKIP_SWEET[1] - SKIP_SWEET[0]) * 100}%"></div><div class="needle"></div>`;
    host.hud.root.appendChild(this.meter);
    const map = host.map;
    this.group = new THREE.Group();
    host.scene.add(this.group);
    // the pile of flat stones on the beach, the kite stand on the hill
    this.pile = makeStonePile();
    this.pile.position.set(PILE.x, heightAt(PILE.x, PILE.z), PILE.z);
    this.group.add(this.pile);
    this.stand = makeKiteStand();
    this.stand.position.set(KITE.x, heightAt(KITE.x, KITE.z), KITE.z);
    this.stand.rotation.y = -0.3;
    this.group.add(this.stand);
    map.circObs(KITE.x, KITE.z, 0.45);
    map.addKeepOut(PILE.x, PILE.z, 1.6, 'skipping stones');
    map.addKeepOut(KITE.x, KITE.z + 0.6, 1.6, 'kite stand');
    // Mumble's hiding bushes at the meadow
    const rnd = (() => { let s = 7; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; })();
    this.bushes = HIDE.map(([x, z], i) => {
      const b = makeBush(rnd, 1.25);
      b.position.set(x, heightAt(x, z), z);
      b.rotation.y = i;
      this.group.add(b);
      map.circObs(x, z, 0.55);
      return { i, x, z, b, wig: 0 };
    });
    // autumn leaf piles
    const pile = bake(makeLeafPile()).group; // (one mesh per leaf color)
    this.piles = LEAF_PILES.map(([x, z], i) => {
      const g = pile.clone();
      g.position.set(x, heightAt(x, z), z);
      g.rotation.y = i * 1.3;
      g.visible = false;
      this.group.add(g);
      return { i, x, z, g, burst: 0 };
    });
    // winter snow forts for the snowball fight
    this.forts = [makeSnowFort(2.4), makeSnowFort(2.4)];
    this.forts[0].position.set((ARENA.x0 + ARENA.x1) / 2, heightAt(19, ARENA.fort), ARENA.fort);
    this.forts[1].position.set((ARENA.x0 + ARENA.x1) / 2, heightAt(19, ARENA.myFort), ARENA.myFort);
    for (const f of this.forts) { f.visible = false; this.group.add(f); }
    this.balls = [];
    this.ripples = []; // skipping stones: ripple rings and floating counts
    this.nums = [];
    this.cur = null; // the mini-game with its own controls (mode 'game')
    this.hide = null;
    this.snow = null;
    this.t = 0;
    this.season = null;
  }

  get S() { return this.host.save; }
  get G() { return this.host.save.games; }

  tick() {
    const season = this.host.seasons.season;
    const today = dayKey();
    const L = this.G.leaves;
    if (L.day !== today) { L.day = today; L.done = []; }
    const isle = this.host.isle2?.here();
    for (const p of this.piles) p.g.visible = season === 'autumn' && !isle;
    for (const p of this.piles) if (!L.done.includes(p.i)) p.g.scale.setScalar(1); else p.g.scale.set(1.3, 0.25, 1.3);
    for (const f of this.forts) f.visible = season === 'winter';
    this.season = season;
  }

  // ---------- [B] ----------

  /** Things that take over [B] while a game runs (the snowball fight, hide-and-seek). */
  override(P, out, nm) {
    if (this.snow && !this.snow.done) { out.b = { text: nm('gm.h.throw'), fn: () => this.throwBall() }; return true; }
    if (this.hide && !this.hide.done) {
      const b = this.bushes.find((x) => Math.hypot(P.x - x.x, P.z - x.z) < 1.5);
      if (b) { out.b = { text: nm('gm.h.search'), fn: () => this.search(b) }; return true; }
    }
    return false;
  }

  interactions(P, out, nm) {
    if (Math.hypot(P.x - PILE.x, P.z - PILE.z) < 1.6) { out.b = { text: nm('gm.h.skip', { best: this.G.skipBest ? t('gm.bestSkips', { n: this.G.skipBest }) : '' }), fn: () => this.startSkip() }; return true; }
    if (Math.hypot(P.x - KITE.x, P.z - (KITE.z + 0.6)) < 1.6) { out.b = { text: nm('gm.h.kite'), fn: () => this.startKite() }; return true; }
    return false;
  }

  // ---------- skipping stones ----------

  startSkip() {
    const host = this.host, P = host.player;
    P.x = PILE.x - 0.6; P.z = PILE.z + 0.4;
    const f = PILE.face, L = Math.hypot(f.x, f.z);
    P.fx = f.x / L; P.fz = f.z / L;
    P.ch.face(P.fx, P.fz);
    host.mode = 'game';
    this.cur = { kind: 'skip', throws: 3, t: 0, phase: 'aim', best: 0, wait: 0.3, sweet: sweetFor(P.p) };
    const sw = this.cur.sweet;
    this.meter.querySelector('.sweet').style.cssText = `left:${sw[0] * 100}%;width:${(sw[1] - sw[0]) * 100}%`;
    this.meter.style.display = '';
    this.say('gm.skip.how', {}, true);
  }

  updateSkip(inp, dt) {
    const c = this.cur, host = this.host, P = host.player;
    c.t += dt;
    const power = (Math.sin(c.t * 2.6 - Math.PI / 2) + 1) / 2;
    if (c.phase === 'aim') {
      this.meter.querySelector('.needle').style.left = `${(power * 100).toFixed(1)}%`;
      c.wait -= dt;
      if (inp.cPressed) { this.endSkip(); return; }
      if (c.wait <= 0 && inp.bPressed) {
        const SW = c.sweet || SKIP_SWEET, half = (SW[1] - SW[0]) / 2;
        const sweet = power >= SW[0] && power <= SW[1];
        const skips = sweet ? 5 + Math.round(Math.max(0, 1 - Math.abs(power - 0.81) / half) * 2) : Math.max(0, Math.floor(power * 5) - (power > SW[1] ? 1 : 0));
        if (!sweet) struggle(host, P.p, 'timing', 'skipstones'); else overcame(host, 'skipstones');
        const stone = makeFlatStone();
        stone.scale.multiplyScalar(2.2); // (big enough to follow from the island camera)
        this.group.add(stone);
        c.phase = 'fly';
        c.fly = { stone, skips, k: 0, i: 0, x: P.x + P.fx * 0.6, z: P.z + P.fz * 0.6, y: P.fy + 1.0, hop: 2.4 + power * 1.6, trail: 0 };
        P.ch.squash(0.8);
        host.swing = 1;
        host.game.audio.play('whoosh');
      }
      return;
    }
    if (c.phase === 'done') return;
    // the stone flies and skips: each skip a bit shorter. The camera slides along with it (same distance, the
    // photo mode's offset), and the last skip plays in slow motion.
    const f = c.fly;
    if (inp.cPressed) c.quit = true; // (stops once this stone is down)
    const slow = f.i === f.skips && f.skips >= 2 ? 0.4 : 1;
    f.k += dt * 2.0 * slow;
    const len = f.hop * Math.pow(0.84, f.i);
    const x0 = f.x, z0 = f.z;
    const k = Math.min(1, f.k);
    const arc = f.i === 0 ? 1.0 : 0.95 * Math.pow(0.84, f.i);
    f.stone.position.set(x0 + P.fx * len * k, (f.i === 0 ? f.y * (1 - k) + SEA_Y * k : SEA_Y + 0.04) + Math.sin(k * Math.PI) * arc, z0 + P.fz * len * k);
    f.stone.rotation.y += dt * 20 * slow;
    f.trail -= dt;
    if (f.trail <= 0) { f.trail = 0.06; host.puffs.burst(f.stone.position.clone(), 0xffffff, { count: 1, speed: 0.2, up: 0.2, size: 0.16, life: 0.35 }); }
    host.camOffset = { x: THREE.MathUtils.clamp((f.stone.position.x - P.x) * 0.8, -8, 8), z: THREE.MathUtils.clamp((f.stone.position.z - P.z) * 0.8, -2, 12) };
    if (f.k >= 1) {
      f.x = x0 + P.fx * len; f.z = z0 + P.fz * len; f.k = 0; f.i++;
      const at = new THREE.Vector3(f.x, SEA_Y + 0.05, f.z);
      if (f.i <= f.skips) {
        host.puffs.burst(at, 0xdff8ff, { count: 12, speed: 2.4, up: 2.6, size: 0.3, life: 0.55 });
        this.ripple(at, 1.0);
        this.skipNum(at, f.i, f.i === f.skips);
        host.game.audio.play('pop');
      } else {
        host.puffs.burst(at, 0xdff8ff, { count: 18, speed: 2.8, up: 3.2, size: 0.38, life: 0.7 });
        this.ripple(at, 1.5);
        host.game.audio.play('splat');
        f.stone.removeFromParent();
        c.best = Math.max(c.best, f.skips);
        this.say(f.skips ? (f.skips >= 5 ? 'gm.skip.great' : 'gm.skip.n') : 'gm.skip.plop', { n: f.skips });
        c.throws--;
        c.phase = 'aim';
        c.wait = 0.9;
        this.later(0.7, () => { if (this.cur?.kind === 'skip' && this.cur.phase !== 'fly') host.camOffset = null; });
        if (c.throws <= 0 || c.quit) { c.phase = 'done'; this.later(1.4, () => this.endSkip()); }
      }
    }
  }

  /** A ring of ripples spreading on the water where the stone touched it. */
  ripple(at, size) {
    const m = new THREE.Mesh(RIPPLE_GEO, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false }));
    m.material.userData = {};
    m.rotation.x = -Math.PI / 2;
    m.position.copy(at).setY(SEA_Y + 0.03);
    m.scale.setScalar(0.3);
    this.group.add(m);
    this.ripples.push({ m, t: 0, size });
  }

  /** The skip count floats up over each splash ("1", "2", "3!"). */
  skipNum(at, n, last) {
    const el = this.host.game.ui.label('label party-num');
    el.textContent = last ? `${n}!` : `${n}`;
    this.nums.push({ el, pos: at.clone().setY(SEA_Y + 0.6), t: 0 });
  }

  endSkip() {
    const host = this.host, c = this.cur;
    if (!c || c.kind !== 'skip') return;
    this.meter.style.display = 'none';
    this.cur = null;
    host.mode = 'walk';
    host.camOffset = null;
    if (c.best > this.G.skipBest) {
      const first = !this.G.skipBest;
      this.G.skipBest = c.best;
      this.say(first ? 'gm.skip.first' : 'gm.skip.record', { n: c.best });
      host.grant({ coins: c.best * 5 });
    }
    host.markDirty();
  }

  // ---------- kite flying ----------

  startKite() {
    const host = this.host, P = host.player;
    P.x = KITE.x - 0.4; P.z = KITE.z + 1.2; P.fx = 0; P.fz = -1;
    P.ch.face(0, -1);
    host.groundCheck(P, host.walkState);
    host.mode = 'game';
    const kite = makeKite(0xff5d73);
    this.group.add(kite);
    const lineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    const line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: 0xffffff }));
    line.material.userData = {};
    line.frustumCulled = false;
    this.group.add(line);
    this.stand.userData.kite.visible = false;
    this.cur = { kind: 'kite', t: 30, kx: 0, ky: 1.5, wind: 0, kite, line, ph: Math.random() * 6, gust: 0 };
    this.say('gm.kite.how', {}, true);
  }

  updateKite(inp, dt) {
    const c = this.cur, host = this.host, P = host.player;
    c.t -= dt;
    c.ph += dt;
    // the wind spot drifts (faster as time goes on); the stick moves the kite
    const sp = 0.5 + (30 - c.t) * 0.02;
    const wx = Math.sin(c.ph * sp) * 3 + Math.sin(c.ph * sp * 2.3) * 0.8, wy = 2 + Math.sin(c.ph * sp * 0.8 + 1) * 1.6;
    c.kx = THREE.MathUtils.clamp(c.kx + inp.x * dt * 4.2, -4, 4);
    c.ky = THREE.MathUtils.clamp(c.ky + inp.y * dt * 3.4, 0, 4);
    const inWind = Math.hypot(c.kx - wx, c.ky - wy) < 1.25;
    if (inWind) c.wind += dt; else c.ky = Math.max(0, c.ky - dt * 0.8); // out of the wind it sinks
    const base = new THREE.Vector3(P.x, P.fy, P.z - 3.6);
    const pos = base.clone().add(new THREE.Vector3(c.kx, 2.6 + c.ky * 0.8, 0));
    c.kite.position.copy(pos);
    c.kite.rotation.set(-0.4, 0, Math.sin(c.ph * 3) * (inWind ? 0.15 : 0.5));
    c.kite.userData.tail.forEach((b, i) => { b.position.x = Math.sin(c.ph * 6 + i) * 0.12 * (i + 1); });
    const arr = c.line.geometry.attributes.position.array;
    arr[0] = P.x + 0.3; arr[1] = P.fy + 1.0; arr[2] = P.z; arr[3] = pos.x; arr[4] = pos.y - 0.5; arr[5] = pos.z;
    c.line.geometry.attributes.position.needsUpdate = true;
    // the wind spot shows as sparkles
    c.gust -= dt;
    if (c.gust <= 0) { c.gust = 0.25; host.puffs.burst(base.clone().add(new THREE.Vector3(wx, 2.6 + wy * 0.8, 0)), inWind ? 0xfff27a : 0xffffff, { count: 2, speed: 0.6, size: 0.25, life: 0.6, up: 0 }); }
    P.ch.face(c.kx * 0.2, -1);
    if (inp.cPressed || c.t <= 0) this.endKite();
  }

  endKite() {
    const host = this.host, c = this.cur;
    if (!c || c.kind !== 'kite') return;
    c.kite.removeFromParent();
    c.line.removeFromParent();
    c.line.geometry.dispose();
    this.stand.userData.kite.visible = true;
    this.cur = null;
    host.mode = 'walk';
    const s = Math.round(c.wind);
    if (c.t > 0.5) { host.markDirty(); return; } // stopped early: nothing lost
    const best = s > this.G.kiteBest;
    if (best) this.G.kiteBest = s;
    this.say(best ? 'gm.kite.record' : 'gm.kite.done', { n: s });
    host.grant({ coins: Math.max(5, s) });
    host.markDirty();
  }

  // ---------- hide-and-seek with Mumble ----------

  /** Can Mumble play now? (daytime, awake, outside, not more than three rounds a day) */
  canHide() {
    const n = this.host.npc('mumble'), H = this.G.hide;
    const h = hourOf();
    return !!n && !n.sleep && !n.inside && !this.hide && !this.snow && h >= 8 && h < 19.5 && (H.day !== dayKey() || H.n < 3);
  }

  startHide() {
    const host = this.host, H = this.G.hide;
    if (H.day !== dayKey()) { H.day = dayKey(); H.n = 0; }
    H.n++;
    const n = host.npc('mumble');
    const last = this.hide?.bush ?? -1;
    let i = Math.floor(Math.random() * this.bushes.length);
    if (i === last) i = (i + 1) % this.bushes.length;
    this.hide = { bush: i, t: 60, count: 5.2, done: false, giggled: false, wig: 2, n };
    n.busy = true; n.route = []; n.talking = false;
    host.mode = 'game';
    this.cur = { kind: 'count' };
    this.say('gm.hide.count', {}, true);
    host.markDirty();
  }

  updateCount(inp, dt) {
    const h = this.hide, host = this.host, el = host.hops.countEl;
    const before = Math.ceil(h.count);
    h.count -= dt;
    if (h.count <= 0) {
      el.textContent = t('gm.hide.ready');
      host.hops.goT = 0.9;
      // Mumble is gone: into his bush
      h.n.away = true;
      h.n.x = this.bushes[h.bush].x; h.n.z = this.bushes[h.bush].z;
      this.cur = null;
      host.mode = 'walk';
      host.game.audio.play('go');
      return;
    }
    if (Math.ceil(h.count) !== before || el.style.display === 'none') { el.textContent = String(Math.min(5, Math.ceil(h.count))); el.style.display = ''; host.game.audio.play('beep'); }
    if (h.count > 4.6) { h.n.model.group.visible = true; h.n.model.face(0, 1); }
  }

  search(b) {
    const host = this.host, h = this.hide;
    b.wig = 0.8;
    host.puffs.burst(new THREE.Vector3(b.x, heightAt(b.x, b.z) + 0.8, b.z), 0x6fcf4a, { count: 10, speed: 2.5, size: 0.25, life: 0.5 });
    if (b.i === h.bush) this.endHide(true);
    else { host.game.audio.play('bump'); this.say('gm.hide.notHere'); }
  }

  endHide(found) {
    const host = this.host, h = this.hide, n = h.n, b = this.bushes[h.bush];
    h.done = true;
    n.away = false; n.busy = false; n.spotName = null;
    n.x = b.x + 0.9; n.z = b.z + 0.7; n.hop = 1;
    host.puffs.burst(new THREE.Vector3(n.x, heightAt(n.x, n.z) + 0.6, n.z), 0x6fcf4a, { count: 14, speed: 3, size: 0.3 });
    if (found) {
      this.G.hide.found = (this.G.hide.found || 0) + 1;
      host.confetti.burst(new THREE.Vector3(n.x, 1.6, n.z), 0, { count: 30, speed: 5, up: 4, life: 1.2, gravity: -6, colors: [0x6fcf4a, 0xffd23f, 0xffffff] });
      host.game.audio.play('fanfare');
      this.sayNpc('mumble', 'gm.hide.found');
      host.addPts('mumble', 5);
      host.giveItems([['radish', 1]]);
    } else { host.game.audio.play('boing'); this.sayNpc('mumble', 'gm.hide.timeUp'); }
    this.hide = null;
    host.markDirty();
  }

  // ---------- the snowball fight (winter) ----------

  canSnow() {
    const n = this.host.npc('pip'), h = hourOf();
    return this.season === 'winter' && !!n && !n.sleep && !n.inside && !this.snow && !this.hide && h >= 8 && h < 18.5 && !this.host.isle2?.here();
  }

  startSnow() {
    const host = this.host, P = host.player, n = host.npc('pip');
    n.busy = true; n.route = []; n.talking = false;
    host.puffs.burst(new THREE.Vector3(n.x, n.y + 0.6, n.z), 0xffffff, { count: 10, speed: 3, size: 0.35 });
    n.x = 19; n.z = ARENA.them;
    P.x = 19; P.z = ARENA.me; P.fx = 0; P.fz = -1;
    P.ch.face(0, -1);
    host.groundCheck(P, host.walkState);
    this.snow = { t: 40, me: 0, them: 0, n, next: 2.5, dir: 1, cool: 0, done: false };
    this.sayNpc('pip', 'gm.snow.go');
    host.game.audio.play('go');
  }

  throwBall() {
    const host = this.host, P = host.player, s = this.snow;
    if (s.cool > 0) return;
    s.cool = 0.55;
    // roughly facing Pip: the snowball curves a little toward where she is now (not where she runs),
    // so you still have to lead her; she sometimes ducks (updateSnow)
    const y0 = P.fy + 1.0;
    let T = 0.5, tx = s.n.x - P.x, tz = s.n.z - P.z;
    const d0 = Math.hypot(tx, tz) || 1;
    if ((P.fx * tx + P.fz * tz) / d0 > 0.6) {
      T = d0 / 11;
      // half aim help: halfway between straight ahead and at her, plus a wobble
      tx = (tx + P.fx * d0) / 2 + (Math.random() - 0.5) * 1.6;
      tz = (tz + P.fz * d0) / 2;
      const vy = (s.n.y + 0.9 - y0) / T + 6 * T;
      this.ball(new THREE.Vector3(P.x, y0, P.z), tx / T, vy, tz / T, 'me');
    } else this.ball(new THREE.Vector3(P.x + P.fx * 0.4, y0, P.z + P.fz * 0.4), P.fx * 11, 3.2, P.fz * 11, 'me');
    host.swing = 1;
    host.game.audio.play('whoosh');
  }

  ball(pos, vx, vy, vz, from) {
    const m = makeSnowball();
    m.position.copy(pos);
    this.group.add(m);
    this.balls.push({ m, vx, vy, vz, from, life: 3 });
  }

  updateSnow(dt) {
    const s = this.snow, host = this.host, P = host.player, n = s.n;
    if (!s.done) {
      s.t -= dt;
      s.cool -= dt;
      // Pip runs to and fro behind her fort and throws now and then (aimed where you are going)
      n.x += s.dir * dt * 2.4;
      if (n.x > ARENA.x1) s.dir = -1; else if (n.x < ARENA.x0) s.dir = 1;
      if (Math.random() < dt * 0.4) s.dir *= -1;
      n.z = ARENA.them;
      n.model.face(P.x - n.x, P.z - n.z);
      s.next -= dt;
      if (s.next <= 0) {
        s.next = 1.6 + Math.random() * 1.4;
        const lead = P.moving ? 0.6 : 0;
        const tx = P.x + P.fx * lead * 3 + (Math.random() - 0.5) * 1.2, tz = P.z + P.fz * lead * 3;
        const T = 0.95, dx = tx - n.x, dz = tz - n.z;
        this.ball(new THREE.Vector3(n.x, 1.1, n.z + 0.4), dx / T, 0.5 * 12 * T - 0.1 / T, dz / T, 'them');
        n.hop = 0.6;
      }
      if (s.t <= 0) this.endSnow();
    }
    for (const b of [...this.balls]) {
      b.vy -= 12 * dt;
      b.m.position.x += b.vx * dt; b.m.position.y += b.vy * dt; b.m.position.z += b.vz * dt;
      b.life -= dt;
      const p = b.m.position;
      let hit = null;
      // the forts stop low snowballs
      for (const f of this.forts) if (Math.abs(p.x - f.position.x) < 1.2 && Math.abs(p.z - f.position.z) < 0.35 && p.y < f.position.y + 0.7) hit = 'fort';
      if (!hit && b.from === 'me' && !s.done && Math.hypot(p.x - n.x, p.z - n.z) < 0.75 && p.y < n.y + 1.4) {
        if (b.dodge === undefined) b.dodge = Math.random() < 0.2; // Pip ducks one throw in five
        if (b.dodge) n.hop = 1;
        else { hit = 'pip'; s.me++; n.hop = 1; this.sayNpc('pip', Math.random() < 0.5 ? 'gm.snow.hitPip' : 'gm.snow.hitPip2', {}, false); }
      }
      if (!hit && b.from === 'them' && !s.done && Math.hypot(p.x - P.x, p.z - P.z) < 0.7 && p.y < P.fy + 1.3 && p.y > P.fy) { hit = 'me'; s.them++; P.ch.squash(0.7); }
      if (!hit && p.y < heightAt(p.x, p.z)) hit = 'ground';
      if (hit || b.life <= 0) {
        host.puffs.burst(p.clone(), 0xffffff, { count: hit === 'pip' || hit === 'me' ? 14 : 6, speed: 2.5, size: 0.25, life: 0.5 });
        if (hit === 'pip' || hit === 'me') host.game.audio.play('splat');
        b.m.removeFromParent();
        this.balls.splice(this.balls.indexOf(b), 1);
      }
    }
  }

  endSnow() {
    const host = this.host, s = this.snow;
    s.done = true;
    const win = s.me > s.them, draw = s.me === s.them;
    if (win) this.G.snow.wins = (this.G.snow.wins || 0) + 1;
    this.G.snow.day = dayKey();
    this.sayNpc('pip', win ? 'gm.snow.win' : draw ? 'gm.snow.draw' : 'gm.snow.lose', { n: s.me, m: s.them });
    host.game.audio.play(win ? 'fanfare' : 'star');
    host.addPts('pip', win ? 5 : 4);
    host.grant({ coins: win ? 40 : 15, items: win && this.G.snow.wins === 1 ? [['cocoa', 1]] : [] });
    this.later(2.5, () => { s.n.busy = false; s.n.spotName = null; this.snow = null; });
    host.markDirty();
  }

  // ---------- leaf piles (autumn) ----------

  /** Landed (island.js): a jump into a leaf pile bursts it, and some hide something. */
  onLand(P) {
    if (this.season !== 'autumn' || P.peak == null || P.peak - P.fy < 0.3) return;
    const L = this.G.leaves;
    const p = this.piles.find((x) => x.g.visible && Math.hypot(P.x - x.x, P.z - x.z) < 1.05);
    if (!p) return;
    const host = this.host;
    host.puffs.burst(new THREE.Vector3(p.x, heightAt(p.x, p.z) + 0.6, p.z), 0xff8c42, { count: 16, speed: 4, up: 4, size: 0.35, life: 1.0, gravity: 3 });
    host.puffs.burst(new THREE.Vector3(p.x, heightAt(p.x, p.z) + 0.6, p.z), 0xffd23f, { count: 10, speed: 3.5, up: 4, size: 0.3, life: 1.0, gravity: 3 });
    host.game.audio.play('boing');
    p.burst = 1;
    if (L.done.includes(p.i)) return; // (already found what it hid today: just a whoosh of leaves)
    L.done.push(p.i);
    const r = dayRand(`leaf:${L.day}:${p.i}`);
    if (r < 0.35) { const n = 5 + Math.round(r * 30); host.save.coins += n; host.coinToast(n); host.game.audio.play('coin'); }
    else if (r < 0.55) { give(host.save, 'goldenAcorn', 1); this.say('gm.leaf.acorn'); }
    else if (r < 0.7) { give(host.save, 'beetSeed', 2); this.say('gm.leaf.seeds'); }
    else if (r < 0.8) this.say('gm.leaf.sock'), give(host.save, 'oddSock', 1);
    else this.say('gm.leaf.whee');
    host.markDirty();
  }

  // ---------- every frame ----------

  updateMode(inp, dt) {
    const c = this.cur;
    if (!c) { this.host.mode = 'walk'; return; }
    if (c.kind === 'skip') this.updateSkip(inp, dt);
    else if (c.kind === 'kite') this.updateKite(inp, dt);
    else if (c.kind === 'count') this.updateCount(inp, dt);
  }

  update(dt) {
    const host = this.host, P = host.player;
    this.t += dt;
    for (const p of this.piles) {
      if (p.burst > 0) { p.burst = Math.max(0, p.burst - dt * 1.5); const k = 1 + Math.sin(p.burst * Math.PI) * 0.4; p.g.scale.set(k, 1 - p.burst * 0.6, k); if (!p.burst) this.tick(); }
    }
    for (const b of this.bushes) { if (b.wig > 0) { b.wig = Math.max(0, b.wig - dt * 2); b.b.rotation.z = Math.sin(b.wig * 30) * 0.12 * b.wig; } }
    const h = this.hide;
    if (h && !h.done && host.mode === 'walk') {
      h.t -= dt;
      h.wig -= dt;
      const b = this.bushes[h.bush];
      if (h.wig <= 0) { h.wig = 2.6 + Math.random() * 1.5; b.wig = 0.6; host.puffs.burst(new THREE.Vector3(b.x, heightAt(b.x, b.z) + 1.0, b.z), 0x6fcf4a, { count: 3, speed: 1.2, size: 0.2, life: 0.4 }); }
      if (P && !h.giggled && Math.hypot(P.x - b.x, P.z - b.z) < 5.5) { h.giggled = true; this.sayNpc('mumble', 'gm.hide.giggle', {}, false); }
      if (h.t <= 0) this.endHide(false);
    }
    if (this.snow) this.updateSnow(dt);
    // skipping stones: the ripples spread and fade, the numbers float up
    this.ripples = this.ripples.filter((r) => {
      r.t += dt;
      const k = r.t / 0.9;
      r.m.scale.setScalar(0.3 + k * 1.6 * r.size);
      r.m.material.opacity = 0.9 * (1 - k);
      if (k >= 1) { r.m.removeFromParent(); r.m.material.dispose(); return false; }
      return true;
    });
    this.nums = this.nums.filter((n) => {
      n.t += dt;
      n.pos.y += dt * 0.9;
      host.game.ui.place(n.el, n.pos, host.camera);
      n.el.style.opacity = String(Math.min(1, 2.5 * (1.4 - n.t)));
      if (n.t >= 1.4) { n.el.remove(); return false; }
      return true;
    });
    // the status pill
    let html = '';
    if (h && !h.done && host.mode === 'walk') html = `🙈 ${esc(t('gm.hide.pill', { s: Math.ceil(h.t) }))}`;
    else if (this.snow && !this.snow.done) html = `❄ ${esc(t('gm.snow.pill', { s: Math.ceil(this.snow.t), n: this.snow.me, m: this.snow.them }))}`;
    else if (this.cur?.kind === 'kite') html = `🪁 ${esc(t('gm.kite.pill', { s: Math.ceil(this.cur.t), n: this.cur.wind.toFixed(1) }))}`;
    else if (this.cur?.kind === 'skip') html = `🪨 ${esc(t('gm.skip.pill', { n: this.cur.throws, b: this.cur.best }))}`;
    this.el.style.display = html && !host.hops.run ? '' : 'none';
    if (html && this.el.innerHTML !== html) this.el.innerHTML = html;
  }

  // ---------- talk ----------

  /** A toast; read aloud only when it is help (how to play: read = true). */
  say(key, vars = {}, read = false) {
    const s = t(key, vars);
    this.host.game.ui.toast(s, Math.max(2200, s.length * 60));
    if (read) speak(s, 'narrator');
  }

  sayNpc(id, key, vars = {}, toast = true) {
    const s = t(key, vars);
    if (toast) this.host.game.ui.toast(`${t(`isl.npc.${id}`)}: ${s}`, Math.max(2400, s.length * 60));
    else this.host.game.ui.toast(`${t(`isl.npc.${id}`)}: ${s}`, 1400, { group: `gm-${id}` });
    speak(s, `isl.${id}`);
  }

  later(s, fn) { this.host.later(s, fn); }

  tasks() {
    const out = [];
    if (this.season === 'autumn' && this.G.leaves.done.length < LEAF_PILES.length && !this.host.isle2?.here()) out.push(t('gm.task.leaves'));
    if (this.hide && !this.hide.done) out.push(t('gm.task.hide'));
    return out;
  }

  dispose() {
    this.el.remove();
    this.meter.remove();
    for (const n of this.nums) n.el.remove();
  }
}
