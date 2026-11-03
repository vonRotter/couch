import * as THREE from 'three';
import { t, tFor } from '../../core/i18n.js';
import { esc } from '../../core/ui.js';
import { say as speak } from '../../core/voice.js';
import { now, hourOf } from './save.js';
import { dayRand, weekIndex, seasonOf } from './calendar.js';
import { CROP_IDS, inSeason } from './items.js';
import { heightAt, SEA_Y, HALL, bake } from './map.js';
import { npcState } from './npcs.js';
import { RIVER_STONES, POND_STONES, SECRETS, SECRET_IDS, TRAILS, TRAIL_IDS } from './hopdata.js';
import {
  makeStepStone, makeLilyPad, makeLedgeRock, makeStump, makeLog, makePlank, makeCrateStack, makeTallBarrel, makeDeck, makeTreasure, makeBellPost,
  makeTrailSign, makeHollowTree, makeShelf, makeBranchStep, makeIslet, makeGroveBits, makeGroveTree,
} from './models9.js';
import './strings11.js';

// Jumping on the solo island (the owner's "Jumping" list): stepping stones over the river and the pond,
// five hidden areas with a treasure chest each, three hop trails with a timer and a bell, and races
// against Pip and Grumbleton. The height itself (standing on tops, falling, landing, the splash back) lives
// in island.js (movement) and map.js (platform(), supportAt()); this module builds the things to stand on
// from hopdata.js and runs the chests and the trails.
//
// Chests (save.hops.chests[id] = { n, week }): the first find has a decoration, coins and seeds. The grove,
// Gull Rock, the hollow tree and the islet fill up again every Monday (new week) with coins and seeds of
// the season; the game hall roof holds Pip's lost toolbox and is found once.

const CHESTS = {
  grove: { first: { deco: 'glowShroom', coins: 60, items: [['starfruitSeed', 1]] }, refill: { coins: 40, seeds: 2 } },
  ledge: { first: { deco: 'gullVane', coins: 80, items: [['pearl', 1]] }, refill: { coins: 50, items: [['seaGlass', 1]] } },
  roof: { first: { deco: 'robotToy', coins: 50, items: [['cornSeed', 2], ['stone', 5]] }, refill: null },
  hollow: { first: { deco: 'owlHouse', coins: 40, items: [['strawberrySeed', 2]] }, refill: { coins: 30, seeds: 3 } },
  islet: { first: { deco: 'shellChime', coins: 60, items: [['coconut', 2]] }, refill: { coins: 40, items: [['spiralShell', 1]] } },
};
// Racers: their time on a trail (seconds); each win makes them a little faster (down to `min`).
const RACE = { stumps: { base: 9.5, min: 6.6 }, barrels: { base: 11.5, min: 8.0 } };
const FIRST_COINS = { 1: 30, 2: 50, 3: 80 };
const SIGN_COLOR = { stumps: 0x8ac926, barrels: 0x4cc9f0, cliff: 0xff9f1c };
const HALL_ROOF = { x: HALL.x, z: HALL.z, hw: 6, hd: 3.1, y: 4.0, ridge: 1.4 };
const CSS = `.isl-hop { left: 50%; top: 1.2vh; transform: translateX(-50%); background: rgba(255,250,240,.95); border: 3px solid #3f9a32; border-radius: 999px; padding: 4px 18px;
  font-weight: 700; font-size: clamp(15px, 1.5vw, 24px); white-space: nowrap; box-shadow: 0 3px 0 rgba(43,35,64,.2); }
.isl-count { left: 50%; top: 36%; transform: translate(-50%, -50%); font-size: clamp(60px, 10vw, 150px); font-weight: 800; color: #fff; paint-order: stroke fill; -webkit-text-stroke: .12em #2b2340; }`;

/** "12.3 s" / "1:02.4" */
export function fmtTime(s) {
  if (s == null) return '–';
  const m = Math.floor(s / 60), r = s - m * 60;
  return m ? `${m}:${r.toFixed(1).padStart(4, '0')}` : `${r.toFixed(1)} s`;
}

export class Hops {
  constructor(host) {
    this.host = host;
    const S = host.save;
    if (!S.hops) S.hops = {};
    for (const k of ['chests', 'best', 'wins', 'runs']) if (!S.hops[k]) S.hops[k] = {};
    if (!document.getElementById('isl-hop-style')) {
      const el = document.createElement('style');
      el.id = 'isl-hop-style';
      el.textContent = CSS;
      document.head.appendChild(el);
    }
    this.el = document.createElement('div');
    this.el.className = 'isl-hop';
    this.el.style.display = 'none';
    host.hud.root.appendChild(this.el);
    this.countEl = document.createElement('div');
    this.countEl.className = 'isl-count';
    this.countEl.style.display = 'none';
    host.hud.root.appendChild(this.countEl);
    this.group = new THREE.Group(); // things that move (chests, bells)
    host.scene.add(this.group);
    // everything else is baked into a few meshes per place (fast to draw, and culled when out of view)
    this.clusters = new Map();
    this.cluster = 'stones';
    this.run = null;
    this.t = 0;
    // stepping stones (no timer): the river shortcut (once the bridge is fixed) and the pond
    this.riverStones = !!host.save.unlocks.bridge;
    if (this.riverStones) for (const p of RIVER_STONES) this.piece(p);
    this.cluster = 'pond';
    for (const p of POND_STONES) this.piece(p);
    this.buildSecrets();
    this.buildTrails();
    for (const root of this.clusters.values()) {
      const { group, keepers } = bake(root);
      host.scene.add(group);
      for (const k of keepers) { k.removeFromParent(); host.scene.add(k); }
    }
    this.clusters = null;
    this.refreshChests();
  }

  get S() { return this.host.save; }

  /** The river stones appear when the old bridge is fixed (so the bridge quest still matters). */
  addRiverStones() {
    if (this.riverStones) return;
    this.riverStones = true;
    this.clusters = new Map();
    this.cluster = 'stones';
    for (const p of RIVER_STONES) this.piece(p);
    for (const root of this.clusters.values()) {
      const { group, keepers } = bake(root);
      this.host.scene.add(group);
      for (const k of keepers) { k.removeFromParent(); this.host.scene.add(k); }
    }
    this.clusters = null;
  }

  /** The group of static models for the place being built (baked once all is built). */
  statics() {
    if (!this.clusters.has(this.cluster)) this.clusters.set(this.cluster, new THREE.Group());
    return this.clusters.get(this.cluster);
  }

  // ---------- building ----------

  /** One thing to stand on (hopdata.js), with its model. extra goes into the platform (e.g. trail). */
  piece(p, extra = {}, i = 0) {
    const map = this.host.map;
    const ground = heightAt(p.x, p.z);
    const top = p.abs ?? ground + p.top;
    const base = p.abs !== undefined ? Math.min(ground, SEA_Y + 0.02) : ground;
    const h = top - base;
    let m;
    switch (p.kind) {
      case 'stone': m = makeStepStone(p.r, h, ground < SEA_Y); break;
      case 'pad': m = makeLilyPad(p.r); m.position.y = top - 0.03; break;
      case 'rock': case 'ledge': m = makeLedgeRock(p.r, h, i + Math.round(p.x)); break;
      case 'stump': case 'root': m = makeStump(p.r, h); break;
      case 'log': m = makeLog(p.hw, p.hd, h); break;
      case 'plank': m = makePlank(p.hw, p.hd, h); break;
      case 'crate': case 'crate2': m = makeCrateStack(h); break;
      case 'barrel': m = makeTallBarrel(h, p.color); break;
      case 'deck': m = makeDeck(p.hw, p.hd, h); break;
      case 'shelf': m = makeShelf(p.r, h); break;
      case 'branch': m = makeBranchStep(p.hw, p.hd, h); break;
      default: m = makeStepStone(p.r || 0.5, h);
    }
    if (p.kind !== 'pad') m.position.y = base;
    m.position.x = p.x;
    m.position.z = p.z;
    this.statics().add(m);
    const shape = p.hw !== undefined ? { x: p.x, z: p.z, hw: p.hw, hd: p.hd } : { x: p.x, z: p.z, r: p.r };
    return map.platform({ ...shape, top, kind: p.kind, ...extra });
  }

  buildSecrets() {
    const map = this.host.map;
    this.chests = {};
    for (const id of SECRET_IDS) {
      const sc = SECRETS[id];
      this.cluster = id;
      sc.path.forEach((p, i) => this.piece(p, { secret: id }, i));
      let y = heightAt(sc.chest.x, sc.chest.z);
      if (id === 'roof') {
        // the game hall roof: you stand on its slopes (the ridge runs east-west); it never blocks the hall below
        const R = HALL_ROOF;
        map.platform({ x: R.x, z: R.z, hw: R.hw, hd: R.hd, top: R.y + R.ridge, block: false, topAt: (x, z) => R.y + R.ridge * Math.max(0, 1 - Math.abs(z - R.z) / R.hd), secret: id, roof: true });
        // the big sign at the front pokes up above the eaves
        map.obstacles.push({ x: R.x, z: R.z + 2.8, hw: 2.5, hd: 0.12, top: R.y + 1.15, bottom: R.y + 0.05 });
        y = R.y + R.ridge;
      } else if (id === 'hollow') {
        const T = sc.tree, top = heightAt(T.x, T.z) + T.top;
        const m = makeHollowTree(T.r, T.top);
        m.position.set(T.x, heightAt(T.x, T.z), T.z);
        this.statics().add(m);
        map.platform({ x: T.x, z: T.z, r: T.r, top, secret: id });
        y = top;
      } else if (id === 'islet') {
        const I = sc.island;
        const m = makeIslet(I.r, I.abs - SEA_Y);
        m.position.set(I.x, SEA_Y, I.z);
        this.statics().add(m);
        map.platform({ x: I.x, z: I.z, r: I.r, top: I.abs, secret: id });
        map.circObs(I.x + I.r * 0.45 * 0.8, I.z - I.r * 0.35 * 0.8, 0.22); // the palm trunk
        y = I.abs;
      } else if (id === 'ledge') {
        y = sc.path[sc.path.length - 1].abs;
      } else if (id === 'grove') {
        // a glade on the cliff top: moss, glowing mushrooms and flowers, trees around it
        const g = makeGroveBits(6, 4.6);
        g.position.set(sc.area.x, heightAt(sc.area.x, sc.area.z) + 0.01, sc.area.z);
        this.statics().add(g);
        this.groveGlow = g.userData.glowCap;
        for (const [x, z, s] of [[-16.4, -41.0, 1.0], [-12.0, -39.8, 1.15], [-11.4, -35.4, 0.9], [-17.6, -34.4, 0.85], [-13.8, -41.2, 0.9]]) {
          const tr = makeGroveTree(s);
          tr.position.set(x, heightAt(x, z), z);
          tr.rotation.y = x;
          this.statics().add(tr);
          map.circObs(x, z, 0.4 * s);
        }
      }
      const c = makeTreasure(id === 'roof' ? 0x9a94b2 : 0xc68a52);
      c.position.set(sc.chest.x, y, sc.chest.z);
      c.rotation.y = id === 'roof' ? 0 : Math.atan2(-0.4, 1);
      this.group.add(c);
      this.chests[id] = { id, g: c, x: sc.chest.x, z: sc.chest.z, y, open: 0 };
    }
  }

  buildTrails() {
    this.trails = {};
    for (const id of TRAIL_IDS) {
      const T = TRAILS[id];
      this.cluster = id;
      const sign = makeTrailSign(SIGN_COLOR[id]);
      sign.position.set(T.sign.x, heightAt(T.sign.x, T.sign.z), T.sign.z);
      sign.rotation.y = -0.3;
      this.statics().add(sign);
      this.host.map.circObs(T.sign.x, T.sign.z, 0.3);
      const plats = T.path.map((p, i) => this.piece(p, { trail: id, step: i }, i));
      const last = plats[plats.length - 1];
      const bell = makeBellPost(SIGN_COLOR[id]);
      const bp = T.path[T.path.length - 1];
      const bx = bp.x + (bp.hw ? bp.hw - 0.35 : 0), bz = bp.z - (bp.hw ? bp.hd - 0.3 : 0);
      bell.position.set(bx - (bp.hw ? 0 : 0.1), last.top, bz);
      bell.scale.setScalar(bp.hw ? 1 : 0.8);
      this.group.add(bell);
      // the racer's path: the start, then the middle of every top
      const pts = [{ x: T.start.x, z: T.start.z, y: heightAt(T.start.x, T.start.z) }, ...plats.map((o) => ({ x: o.x, z: o.z, y: o.top }))];
      this.trails[id] = { id, T, plats, last, bell: bell.userData.bell, pts };
    }
  }

  // ---------- chests ----------

  chestFull(id, at = now()) {
    const c = this.S.hops.chests[id];
    if (!c) return true;
    return !!CHESTS[id].refill && weekIndex(at) > (c.week ?? -1e9);
  }

  refreshChests() {
    for (const c of Object.values(this.chests)) {
      c.full = this.chestFull(c.id);
      c.g.userData.glow.visible = c.full;
      c.g.userData.lid.rotation.x = c.full ? 0 : -1.9;
    }
  }

  openChest(id) {
    const host = this.host, S = this.S, c = this.chests[id];
    if (!this.chestFull(id)) { this.sayT('hop.t.empty'); host.game.audio.play('bump'); return; }
    const first = !S.hops.chests[id];
    const at = now();
    S.hops.chests[id] = { n: (S.hops.chests[id]?.n || 0) + 1, week: weekIndex(at) };
    const def = first ? CHESTS[id].first : CHESTS[id].refill;
    const items = [...(def.items || [])];
    if (def.seeds) items.push([this.seedOfWeek(id, at), def.seeds]);
    c.open = 0.001;
    host.confetti.burst(new THREE.Vector3(c.x, c.y + 0.9, c.z), 0, { count: 50, speed: 6, up: 5, life: 1.4, gravity: -6, colors: [0xffd23f, 0xffffff, 0xff9fc0, 0x8ff0ff] });
    host.game.audio.play('fanfare');
    this.sayT(first ? `hop.chest.${id}` : 'hop.t.refill');
    host.grant({ items, coins: def.coins, deco: def.deco });
    this.refreshChests();
    c.g.userData.lid.rotation.x = 0;
    host.markDirty();
  }

  /** A seed packet of the season for a chest that filled up again (the same all week). */
  seedOfWeek(id, at) {
    const season = seasonOf(at);
    const list = CROP_IDS.filter((c) => inSeason(c, season) && c !== 'starfruit');
    return `${list[Math.floor(dayRand(`chest:${id}:${weekIndex(at)}`) * list.length)]}Seed`;
  }

  // ---------- [B] ----------

  interactions(P, out, nm, high) {
    // a chest you stand next to (and at its height)
    for (const c of Object.values(this.chests)) {
      if (Math.hypot(P.x - c.x, P.z - c.z) > 1.35 || Math.abs(P.fy - c.y) > 0.9) continue;
      out.b = c.full ? { text: nm('hop.h.chest'), fn: () => this.openChest(c.id) } : { text: t('hop.h.chestEmpty', { when: t(CHESTS[c.id].refill ? 'hop.when.monday' : 'hop.when.never') }), fn: () => this.sayT('hop.t.empty') };
      return true;
    }
    // a trail's bell (ring it for fun when you are not running)
    for (const tr of Object.values(this.trails)) {
      const o = tr.last;
      if (Math.hypot(P.x - o.x, P.z - o.z) < (o.hw ? o.hw + 0.6 : 1.1) && Math.abs(P.fy - o.top) < 0.3 && !this.run) {
        out.b = { text: nm('hop.h.bell'), fn: () => this.ringBell(tr) };
        return true;
      }
    }
    if (high) return false;
    // a trail's start sign
    for (const tr of Object.values(this.trails)) {
      const s = tr.T.sign;
      if (Math.hypot(P.x - s.x, P.z - s.z) > 1.8) continue;
      const best = this.S.hops.best[tr.id];
      out.b = { text: nm('hop.h.start', { name: t(`hop.trail.${tr.id}`), best: best ? t('hop.best', { time: fmtTime(best) }) : '' }), fn: () => this.askStart(tr) };
      return true;
    }
    return false;
  }

  ringBell(tr) {
    tr.ring = 1;
    this.host.game.audio.play('star');
  }

  /** The trail sign: run alone, race the trail's racer (when they are around), or not now. */
  askStart(tr) {
    const host = this.host;
    const racer = this.racerFree(tr) ? tr.T.racer : null;
    const best = this.S.hops.best[tr.id];
    const lines = [{ key: `hop.sign.${tr.id}`, vars: { best: best ? t('hop.bestIs', { time: fmtTime(best) }) : t('hop.bestNone') } }];
    if (racer) {
      lines[0].choices = ['hop.c.run', `hop.c.race.${racer}`, 'hop.c.no'];
      lines[0].onChoice = (i) => { if (i === 0) this.start(tr, null); else if (i === 1) this.start(tr, racer); };
    } else {
      lines[0].choices = ['hop.c.run', 'hop.c.no'];
      lines[0].onChoice = (i) => { if (i === 0) this.start(tr, null); };
    }
    host.say(lines);
  }

  /** Can this trail's racer come over now? (awake, outside, not busy, daytime, on the main island) */
  racerFree(tr) {
    const id = tr.T.racer;
    if (!id) return false;
    const n = this.host.npc(id);
    const h = hourOf();
    return !!n && !n.sleep && !n.inside && !n.wantIn && !n.busy && !n.away && !n.talking && !n.doorAnim && h >= 7 && h < 20 && Math.hypot(n.x, n.z - 30) < 150 && !this.host.tour?.run;
  }

  // ---------- running a trail ----------

  start(tr, racerId) {
    const host = this.host, P = host.player;
    const S = this.S;
    // to the start line, facing the first top
    const s = tr.T.start, f = tr.pts[1];
    P.x = s.x; P.z = s.z;
    const dx = f.x - s.x, dz = f.z - s.z, d = Math.hypot(dx, dz) || 1;
    P.fx = dx / d; P.fz = dz / d;
    P.ch.face(P.fx, P.fz);
    host.groundCheck(P, host.walkState);
    this.run = { id: tr.id, tr, t: 0, count: 3.2, reached: -1, falls: 0, done: false, racer: null };
    if (racerId) {
      const n = host.npc(racerId);
      n.busy = true; n.talking = false; n.route = []; n.wanderAt = null;
      host.puffs.burst(new THREE.Vector3(n.x, n.y + 0.6, n.z), 0xffffff, { count: 10, speed: 3, size: 0.35 });
      n.x = s.x + P.fz * 1.1; n.z = s.z - P.fx * 1.1; // beside you
      n.yOverride = tr.pts[0].y;
      n.model.face(dx, dz);
      host.puffs.burst(new THREE.Vector3(n.x, n.yOverride + 0.6, n.z), 0xffffff, { count: 10, speed: 3, size: 0.35 });
      const wins = S.hops.wins[tr.id] || 0;
      const R = RACE[tr.id];
      const time = Math.max(R.min, R.base * (1 - 0.06 * wins));
      this.run.racer = { n, id: racerId, time, k: 0, done: false, at: null };
      this.sayLine(racerId, `hop.race.${racerId}.go`);
    }
    host.mode = 'hopgo';
    S.hops.runs[tr.id] = (S.hops.runs[tr.id] || 0) + 1;
    host.markDirty();
  }

  /** The countdown before a run (mode 'hopgo'): 3, 2, 1, go! */
  updateCount(dt) {
    const r = this.run;
    if (!r) { this.host.mode = 'walk'; return; }
    const before = Math.ceil(r.count);
    r.count -= dt;
    const n = Math.ceil(r.count);
    if (r.count <= 0) {
      this.countEl.textContent = t('hop.go');
      this.countEl.style.display = '';
      this.host.game.audio.play('go');
      this.host.mode = 'walk';
      this.goT = 0.7;
      return;
    }
    if (n !== before || this.countEl.style.display === 'none') {
      this.countEl.textContent = String(Math.min(3, n));
      this.countEl.style.display = '';
      if (n <= 3) this.host.game.audio.play('beep');
    }
  }

  /** Landed somewhere (island.js): on the trail that is progress; below the hop you took off from, back you go. */
  onLand(P, plat) {
    const r = this.run;
    if (!r || r.done || this.host.mode === 'hopgo') return;
    if (plat?.trail === r.id) {
      r.reached = Math.max(r.reached, plat.step);
      if (plat === r.tr.last) this.finish();
      return;
    }
    // fell off the trail (onto lower ground): back to the start of that hop
    if (r.reached >= 0 && P.takeoff && P.fy < P.takeoff.fy - 0.25) {
      r.falls++;
      this.host.splash(P, 0xffffff);
    }
  }

  onPutBack() {
    if (this.run && !this.run.done) this.host.game.ui.toast(t('hop.t.back'), 1000, { group: 'hopback' });
  }

  finish() {
    const host = this.host, r = this.run, S = this.S, P = host.player;
    r.done = true;
    const time = Math.round(r.t * 10) / 10;
    r.time = time;
    this.ringBell(r.tr);
    const old = S.hops.best[r.id];
    const first = old == null;
    const best = first || time < old;
    if (best) S.hops.best[r.id] = time;
    host.confetti.burst(new THREE.Vector3(P.x, P.fy + 1.4, P.z), 0, { count: 40, speed: 6, up: 5, life: 1.3, gravity: -6, colors: [0xffd23f, 0xff5d73, 0x3ddc97, 0x4cc9f0] });
    host.game.audio.play('fanfare');
    const lines = [t('hop.t.time', { name: t(`hop.trail.${r.id}`), time: fmtTime(time) })];
    if (best && !first) lines.push(t('hop.t.newBest'));
    let coins = first ? FIRST_COINS[r.tr.T.level] : best ? 10 : 0;
    const R = r.racer;
    if (R) {
      const won = !R.done || R.time > time;
      R.result = won ? 'win' : 'lose';
      if (won) {
        S.hops.wins[r.id] = (S.hops.wins[r.id] || 0) + 1;
        coins += 40;
        host.addPts(R.id, 6);
      } else host.addPts(R.id, 3);
      this.later(0.9, () => this.sayLine(R.id, `hop.race.${R.id}.${won ? 'lose' : 'win'}`, { time: fmtTime(R.time) }));
    }
    this.sayT(null, lines.join(' '));
    if (coins) host.grant({ coins });
    // all three bells rung: the golden bell for the yard
    if (!S.deco.goldBell && TRAIL_IDS.every((id) => S.hops.best[id] != null)) this.later(1.6, () => host.addDeco('goldBell'));
    this.endT = 3.5;
    host.markDirty();
  }

  /** Stop the run (walked away, or finished and the time has been shown). */
  stop(quiet = false) {
    const r = this.run;
    if (!r) return;
    if (r.racer) this.releaseRacer(r.racer);
    if (!r.done && !quiet) this.sayT('hop.t.stopped');
    this.run = null;
    this.countEl.style.display = 'none';
  }

  releaseRacer(R) {
    const n = R.n;
    n.busy = false;
    n.yOverride = null;
    n.spotName = null; // walk back to where they should be
    n.route = [];
  }

  later(s, fn) { this.host.later(s, fn); }

  /** The racer hops along the trail at their pace: from the start over every top to the bell. */
  updateRacer(R, dt) {
    if (R.done) return;
    const pts = this.run.tr.pts;
    R.k += dt;
    // time per stretch by its length
    const lens = [];
    let total = 0;
    for (let i = 1; i < pts.length; i++) { const L = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z); lens.push(L); total += L; }
    let d = (Math.min(R.k, R.time) / R.time) * total, i = 0;
    while (i < lens.length - 1 && d > lens[i]) { d -= lens[i]; i++; }
    const a = pts[i], b = pts[i + 1], k = Math.min(1, d / lens[i]);
    const n = R.n;
    n.x = a.x + (b.x - a.x) * k;
    n.z = a.z + (b.z - a.z) * k;
    n.yOverride = a.y + (b.y - a.y) * k + Math.sin(k * Math.PI) * (0.6 + Math.max(0, b.y - a.y) * 0.5);
    n.model.face(b.x - a.x, b.z - a.z);
    if (R.k >= R.time) {
      R.done = true;
      n.yOverride = pts[pts.length - 1].y;
      this.ringBell(this.run.tr);
      if (!this.run.done) {
        this.host.game.ui.toast(t(`hop.race.${R.id}.first`), 1800);
        speak(t(`hop.race.${R.id}.first`), `isl.${R.id}`);
      }
    }
  }

  // ---------- every frame ----------

  update(dt) {
    const host = this.host, P = host.player;
    this.t += dt;
    // chests: the lid opens, the glow breathes
    for (const c of Object.values(this.chests)) {
      if (c.open > 0) { c.open = Math.min(1, c.open + dt * 3); c.g.userData.lid.rotation.x = -1.9 * c.open; if (c.open >= 1) c.open = 0; }
      if (c.full) c.g.userData.glow.scale.setScalar(1 + Math.sin(this.t * 3 + c.x) * 0.12);
    }
    for (const tr of Object.values(this.trails)) {
      if (tr.ring > 0) { tr.ring = Math.max(0, tr.ring - dt * 0.8); tr.bell.rotation.z = Math.sin(tr.ring * 30) * 0.5 * tr.ring; }
    }
    if (this.groveGlow) this.groveGlow.emissive.setHex(host.night > 0.4 ? 0x3ab0c8 : 0x1a6a80);
    // the waterfall: hopping through it splashes
    if (P && host.mode === 'walk') {
      const wf = host.map.waterfall;
      const inFall = Math.abs(P.x - wf.x) < 2.2 && Math.abs(P.z - (wf.z - 0.8)) < 0.35 && P.fy < 4.8;
      if (inFall && !this.inFall) { host.puffs.burst(new THREE.Vector3(P.x, P.fy + 0.8, P.z), 0xbff0ff, { count: 16, speed: 3, up: 2, size: 0.3, life: 0.6 }); host.game.audio.play('splat'); }
      this.inFall = inFall;
    }
    if (this.goT > 0) { this.goT -= dt; if (this.goT <= 0) this.countEl.style.display = 'none'; }
    const r = this.run;
    if (r) {
      if (host.mode !== 'hopgo' && !r.done) r.t += dt;
      if (r.racer && host.mode !== 'hopgo') this.updateRacer(r.racer, dt);
      // walked far away: the run stops
      if (!r.done && P && Math.hypot(P.x - r.tr.T.start.x, P.z - r.tr.T.start.z) > 30) this.stop();
      if (r.done) { this.endT -= dt; if (this.endT <= 0 && (!r.racer || r.racer.done || this.endT < -6)) this.stop(true); }
    }
    const show = this.run && ['walk', 'hopgo', 'dialog'].includes(host.mode);
    this.el.style.display = show ? '' : 'none';
    if (show) {
      const rr = this.run;
      const vs = rr.racer ? ` · ${esc(t(`isl.npc.${rr.racer.id}`))} ${rr.racer.done ? fmtTime(rr.racer.time) : '…'}` : '';
      const html = `🏁 ${esc(t(`hop.trail.${rr.id}`))} · ${fmtTime(rr.done ? rr.time : rr.t)}${vs}`;
      if (this.el.innerHTML !== html) this.el.innerHTML = html;
    }
  }

  /** Once a second: a new week fills chests up again. */
  tick() {
    for (const c of Object.values(this.chests)) if (c.full !== this.chestFull(c.id)) { this.refreshChests(); break; }
  }

  // ---------- talk ----------

  /** A toast (not read aloud: the narrator reads story and help; the villagers say their own lines). */
  sayT(key, text = null, vars = {}) {
    const s = text ?? t(key, vars);
    this.host.game.ui.toast(s, Math.max(2200, s.length * 60));
  }

  /** A villager's line as a toast, in their voice. */
  sayLine(id, key, vars = {}) {
    const s = `${t(`isl.npc.${id}`)}: ${t(key, vars)}`;
    this.host.game.ui.toast(s, Math.max(2400, s.length * 60));
    speak(t(key, vars), `isl.${id}`);
  }

  /** A friend sometimes hints at a hidden spot you have not found yet (in a chat). */
  hintLine(n) {
    const H = { hazel: 'hollow', bram: 'grove', grumbleton: 'ledge', pip: 'roof', rosa: 'islet', mumble: 'grove', shelby: 'islet', hoot: 'ledge' };
    const id = H[n.id];
    if (!id || this.S.hops.chests[id]) return null;
    return { who: n.id, key: `hop.hint.${id}` };
  }

  tasks() { return []; }

  dispose() {
    this.el.remove();
    this.countEl.remove();
  }
}
