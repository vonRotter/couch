import * as THREE from 'three';
import { toon } from '../../core/palette.js';
import { t, tFor } from '../../core/i18n.js';
import { esc } from '../../core/ui.js';
import { say as speak } from '../../core/voice.js';
import { ITEMS, icon } from './items.js';
import { count, give, take, now, since, MIN } from './save.js';
import { heightAt, HOME, FIELD } from './map.js';
import { mesh, box, cone, makeDeco, makeSign } from './models.js';
import { makeCraft, makeDeco2, makeRoom, makePorch, makeStoneNode, makeTallGrass } from './models2.js';
import { makeDeco3, DECO3, makeSprinkler, makeScarecrow } from './models3.js';
import { makeDeco4, DECO4 } from './models4.js';
import { makeDeco5, DECO5 } from './models5.js';
import { makeDeco6, DECO6 } from './models6.js';

// Building and decorating (milestone B2).
// - Gathering: break rock piles with the pickaxe (stone), cut tall grass with the scythe (hay and fiber).
// - The workbench by the cottage: craft yard pieces and furniture, upgrade the cottage (porch + extra room),
//   and switch to decorate mode.
// - Decorate mode: place, move (pick up), rotate and remove decorations, trophies and crafted things on a
//   grid in the yard and inside the cottage. Everything is saved in save.yard / save.store.
// - The cottage interior: a cozy room built away from the island; the front door takes you in and out.

export const CRAFTS = {
  fence: { need: [['wood', 2]], solid: true },
  pathStone: { need: [['stone', 1]] },
  yardLamp: { need: [['wood', 2], ['stone', 2]], solid: true, light: true },
  flowerBed: { need: [['fiber', 3], ['stone', 1]], solid: true },
  yardBench: { need: [['wood', 4]], solid: true },
  hedge: { need: [['fiber', 4]], solid: true },
  bed: { need: [['wood', 6], ['fiber', 4]], solid: true },
  table: { need: [['wood', 4]], solid: true },
  chair: { need: [['wood', 2]], solid: true },
  rug: { need: [['fiber', 5]] },
  plant: { need: [['fiber', 2], ['stone', 1]], solid: true },
  shelf: { need: [['wood', 5]], solid: true },
  // milestone B3: farm helpers (they go into the bag and stand on field tiles, see farm.js)
  sprinkler: { need: [['stone', 5], ['wood', 3]], bag: true },
  scarecrow: { need: [['wood', 3], ['fiber', 3], ['hay', 2]], bag: true },
};
export const CRAFT_IDS = Object.keys(CRAFTS);
const DECO2 = new Set(['quilt', 'gardenArch', 'portrait', 'photo', 'shipWheel', 'scope', 'anchor', 'starLamp', 'derbyTrophy', 'ribbon', 'paperLantern']);
const FLAT = new Set(['pathStone', 'rug', 'quilt']);
export const UPGRADE = { wood: 30, stone: 20, coins: 500 };

for (const id of CRAFT_IDS) ITEMS[id] = { kind: 'craft' };
Object.assign(ITEMS, { stone: { kind: 'res', sell: 3 }, fiber: { kind: 'res', sell: 2 }, hay: { kind: 'res', sell: 2 } });

// Where things can go: the yard around the cottage, and the room inside.
const YARD = { x0: -23, x1: 6, z0: -24, z1: 3 };
export const ROOM = { x: 200, z: 120, w: 8, w2: 12, d: 6 };
const HOME_DOOR = { x: HOME.x, z: HOME.z + 2.7 };

const STONES = [[18, -28], [32, -24], [42, -27], [-6, -30], [50, 4], [20, 25], [-32, -8], [-40, 20], [30, 30], [-19, 28], [10, -31], [-46, -14]];
const GRASS = [[-21, 6], [-21.5, 10.5], [-6.5, 6], [-5.5, 10], [-8, 15], [40, -6], [44, -1], [36, -2], [-36, -12], [-42, -2], [12, 14], [16, 18], [24, 6], [-2, 16]];
const STONE_RESPAWN = 20 * MIN, GRASS_RESPAWN = 10 * MIN;

export class Builder {
  constructor(host) {
    this.host = host;
    const S = host.save;
    if (!S.yard) S.yard = [];
    if (!S.store) S.store = {};
    if (!S.home) S.home = { upgraded: false };
    if (!S.gather) S.gather = { stones: {}, grass: {} };
    this.views = new Map();
    this.hits = {};
    this.sel = 0;
    this.rot = 0;
    const map = host.map;
    // gathering spots
    this.stones = STONES.map(([x, z], i) => ({ i, x, z, g: map.live(makeStoneNode(), x, z, i), obs: map.circObs(x, z, 0.7) }));
    this.grass = GRASS.map(([x, z], i) => ({ i, x, z, g: map.live(makeTallGrass(), x, z, i * 1.3) }));
    // workbench by the cottage
    const wb = new THREE.Group();
    wb.add(mesh(box(1.6, 0.12, 0.8), 0xc68a52, 0, 0.85, 0), mesh(box(1.5, 0.8, 0.7), 0x8a5a32, 0, 0.4, 0));
    wb.add(mesh(box(0.5, 0.3, 0.3), 0x9a94b2, -0.4, 1.05, 0), mesh(box(0.06, 0.4, 0.06), 0xa0704a, 0.35, 1.1, 0.1));
    this.bench = { x: HOME.x - 4.6, z: HOME.z - 1.6 };
    map.live(wb, this.bench.x, this.bench.z, Math.PI / 2);
    map.boxObs(this.bench.x, this.bench.z, 0.45, 0.85);
    // the porch (upgrade) and the inside room
    this.porch = map.live(makePorch(), HOME.x, HOME.z + 2.95, 0, 0);
    this.porchObs = [-2.6, 2.6].map((x) => map.circObs(HOME.x + x, HOME.z + 3.75, 0.15, { ox: HOME.x + x }));
    this.buildRoom();
    this.ghost = null;
    this.hl = mesh(box(0.96, 0.05, 0.96), toon(0x9ff07a, { transparent: true, opacity: 0.5 }), 0, 0, 0, false);
    this.hl.visible = false;
    host.scene.add(this.hl);
    this.migrate();
    this.renderYard();
    this.refreshHome();
  }

  get S() { return this.host.save; }

  // ---------- the room inside the cottage ----------

  buildRoom() {
    const map = this.host.map, M = this.host.M;
    this.room = makeRoom(M, ROOM.w, ROOM.d, false);
    this.room2 = makeRoom(M, ROOM.w2, ROOM.d, true);
    map.live(this.room, ROOM.x, ROOM.z, 0, 0);
    map.live(this.room2, ROOM.x + (ROOM.w2 - ROOM.w) / 2, ROOM.z, 0, 0);
    map.lampSpots.push({ x: ROOM.x, y: 2.9, z: ROOM.z });
    this.roomDeck = { x0: ROOM.x - ROOM.w / 2, x1: ROOM.x + ROOM.w / 2, z0: ROOM.z - ROOM.d / 2, z1: ROOM.z + ROOM.d / 2 + 0.6, y: 0.05 };
    map.decks.push(this.roomDeck);
  }

  roomBounds() {
    const w = this.S.home.upgraded ? ROOM.w2 : ROOM.w;
    return { x0: ROOM.x - ROOM.w / 2, x1: ROOM.x - ROOM.w / 2 + w, z0: ROOM.z - ROOM.d / 2, z1: ROOM.z + ROOM.d / 2 };
  }

  get exitSpot() { return { x: ROOM.x, z: ROOM.z + ROOM.d / 2 - 0.4 }; }

  refreshHome() {
    const up = this.S.home.upgraded;
    this.porch.visible = up;
    for (const o of this.porchObs) o.x = up ? o.ox : 1e5; // posts only matter when the porch is there
    this.room.visible = !up;
    this.room2.visible = up;
    const b = this.roomBounds();
    Object.assign(this.roomDeck, { x0: b.x0, x1: b.x1 });
  }

  inside(P) {
    const b = this.roomBounds();
    return P.x > b.x0 - 1 && P.x < b.x1 + 1 && P.z > b.z0 - 1 && P.z < b.z1 + 2;
  }

  /** Keep the player inside the room walls. */
  clampInside(P) {
    const b = this.roomBounds();
    P.x = THREE.MathUtils.clamp(P.x, b.x0 + 0.45, b.x1 - 0.45);
    const atDoor = Math.abs(P.x - ROOM.x) < 0.7;
    P.z = THREE.MathUtils.clamp(P.z, b.z0 + 0.45, atDoor ? b.z1 + 0.3 : b.z1 - 0.45);
    if (this.S.home.upgraded) {
      // the inner wall between the rooms, with a wide doorway in the middle
      const wx = ROOM.x - ROOM.w / 2 + ROOM.w2 - 4;
      if (Math.abs(P.x - wx) < 0.4 && Math.abs(P.z - ROOM.z) > 0.9) P.x = P.x < wx ? wx - 0.4 : wx + 0.4;
    }
  }

  goInside() {
    const P = this.host.player;
    this.host.game.ui.wipe(() => {
      P.x = this.exitSpot.x; P.z = this.exitSpot.z - 0.8; P.fx = 0; P.fz = -1;
      P.ch.face(0, -1);
      this.host.snapCamera();
    });
    this.host.game.audio.play('whoosh');
  }

  goOutside() {
    const P = this.host.player;
    this.host.game.ui.wipe(() => {
      P.x = HOME_DOOR.x; P.z = HOME_DOOR.z + 0.6; P.fx = 0; P.fz = 1;
      P.ch.face(0, 1);
      this.host.snapCamera();
    });
    this.host.game.audio.play('whoosh');
  }

  // ---------- yard pieces ----------

  model(id) {
    if (id === 'sprinkler') return makeSprinkler();
    if (id === 'scarecrow') return makeScarecrow();
    if (DECO3.has(id)) return makeDeco3(id, this.host.M);
    if (DECO4.has(id)) return makeDeco4(id, this.host.M);
    if (DECO5.has(id)) return makeDeco5(id);
    if (DECO6.has(id)) return makeDeco6(id);
    if (CRAFTS[id]) return makeCraft(id, this.host.M);
    if (DECO2.has(id)) return makeDeco2(id, this.host.M);
    return makeDeco(id, this.host.M);
  }

  solid(id) { return CRAFTS[id] ? !!CRAFTS[id].solid : !FLAT.has(id); }

  /** Old saves had decorations on fixed spots: they become yard pieces where they were. */
  migrate() {
    const S = this.S;
    if (S.yardInit) return;
    S.yardInit = true;
    for (const id of Object.keys(S.deco)) {
      if (id === 'flag') continue;
      const spot = this.host.decoSpot(id);
      if (spot && !this.occupied(spot.x, spot.z)) this.addPiece(id, spot.x, spot.z, 0);
      else S.store[id] = (S.store[id] || 0) + 1;
    }
  }

  addPiece(id, x, z, r) {
    const S = this.S;
    S.yardNext = (S.yardNext || 0) + 1;
    const p = { u: S.yardNext, id, x, z, r };
    S.yard.push(p);
    return p;
  }

  occupied(x, z, except = null) {
    return this.S.yard.find((p) => p !== except && Math.hypot(p.x - x, p.z - z) < 0.7) || null;
  }

  renderYard() {
    const map = this.host.map;
    for (const [u, v] of this.views) if (!this.S.yard.find((p) => p.u === u)) { v.removeFromParent(); this.views.delete(u); this.host.decoViews?.delete(`y${u}`); }
    map.obstacles = map.obstacles.filter((o) => !o.yard);
    map.lampSpots = map.lampSpots.filter((l) => !l.yard);
    for (const p of this.S.yard) {
      let v = this.views.get(p.u);
      if (!v || v.userData.pid !== p.id) {
        if (v) v.removeFromParent();
        v = this.model(p.id);
        v.userData.pid = p.id;
        this.host.scene.add(v);
        this.views.set(p.u, v);
      }
      v.position.set(p.x, this.groundAt(p.x, p.z), p.z);
      v.rotation.y = (p.r || 0) * (Math.PI / 2);
      this.host.decoViews?.set(`y${p.u}`, v);
      if (this.solid(p.id)) map.obstacles.push({ x: p.x, z: p.z, r: 0.38, yard: true });
      if (p.id === 'yardLamp' || p.id === 'lhLamp' || p.id === 'starLamp' || p.id === 'miniLighthouse') map.lampSpots.push({ x: p.x, y: this.groundAt(p.x, p.z) + 2.3, z: p.z, yard: true });
    }
  }

  groundAt(x, z) {
    const b = this.roomBounds();
    if (x > b.x0 - 1 && x < b.x1 + 1 && z > b.z0 - 1 && z < b.z1 + 1) return 0.05;
    return heightAt(x, z);
  }

  /** A new decoration (from a game, a friend or a festival): on its usual spot if free, else in storage. */
  addDecoration(id, celebrate) {
    let spot = this.host.decoSpot(id);
    if (!spot || this.occupied(spot.x, spot.z)) spot = this.freeCellNear(HOME.x + 3.5, HOME.z + 6.5);
    if (spot && !this.occupied(spot.x, spot.z)) {
      this.addPiece(id, spot.x, spot.z, 0);
      this.renderYard();
      const v = [...this.views.values()].pop();
      if (celebrate && v) this.host.confetti.burst(v.position.clone().add(new THREE.Vector3(0, 1.5, 0)), 0, { count: 40, speed: 6, up: 4, life: 1.4, gravity: -6, colors: [0xff5d73, 0xffc93c, 0x3ddc97, 0x4cc9f0] });
    } else {
      this.S.store[id] = (this.S.store[id] || 0) + 1;
      this.host.game.ui.toast(t('isl.t.stored', { item: this.name(id) }), 2200);
    }
  }

  name(id) { return t(ITEMS[id] ? `isl.i.${id}` : `isl.d.${id}`); }

  /** The nearest free yard cell to (x, z), searching outward a little. */
  freeCellNear(x, z) {
    for (let r = 0; r <= 7; r++) {
      for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        const cx = Math.floor(x) + dx + 0.5, cz = Math.floor(z) + dz + 0.5;
        if (this.cellOk(cx, cz)) return { x: cx, z: cz };
      }
    }
    return null;
  }

  // ---------- gathering ----------

  tickGather(at) {
    for (const s of this.stones) { const on = since(this.S.gather.stones[s.i], STONE_RESPAWN, at); s.g.visible = on; s.obs.x = on ? s.x : 1e5; }
    for (const g of this.grass) g.g.visible = since(this.S.gather.grass[g.i], GRASS_RESPAWN, at);
  }

  /** [A] at a rock pile (pickaxe) or tall grass (scythe). */
  gatherAction(P, held, nm) {
    const fx = P.x + P.fx * 0.9, fz = P.z + P.fz * 0.9;
    const near = (o, r) => Math.hypot(fx - o.x, fz - o.z) < r || Math.hypot(P.x - o.x, P.z - o.z) < r;
    if (held === 'pickaxe') for (const s of this.stones) if (s.g.visible && near(s, 1.6)) return { text: nm('isl.h.mine'), fn: () => this.breakStone(s), ok: true };
    if (held === 'scythe') for (const g of this.grass) if (g.g.visible && near(g, 1.4)) return { text: nm('isl.h.grass'), fn: () => this.cutGrass(g), ok: true };
    return null;
  }

  breakStone(s) {
    const host = this.host;
    host.swingTool();
    this.hits[s.i] = (this.hits[s.i] || 0) + 1;
    host.puffs.burst(new THREE.Vector3(s.x, 0.8, s.z), 0xbdb8cf, { count: 10, speed: 4, size: 0.35 });
    host.game.audio.play('bump');
    if (this.hits[s.i] < 2) return;
    this.hits[s.i] = 0;
    this.S.gather.stones[s.i] = now();
    give(this.S, 'stone', 2);
    host.game.ui.toast(t('isl.t.stone'));
    this.tickGather(now());
    host.markDirty();
  }

  cutGrass(g) {
    const host = this.host;
    host.swingTool();
    this.S.gather.grass[g.i] = now();
    give(this.S, 'hay', 1);
    const fiber = (g.i + (this.S.gather.cuts = (this.S.gather.cuts || 0) + 1)) % 3 !== 0;
    if (fiber) give(this.S, 'fiber', 1);
    host.puffs.burst(new THREE.Vector3(g.x, 0.5, g.z), 0x8ac926, { count: 12, speed: 3, size: 0.25, life: 0.6 });
    host.game.audio.play('pop');
    host.game.ui.toast(t(fiber ? 'isl.t.grass2' : 'isl.t.grass'));
    this.tickGather(now());
    host.markDirty();
  }

  // ---------- the workbench ----------

  interactions(P, out, nm) {
    const near = (p, r) => Math.hypot(P.x - p.x, P.z - p.z) < r;
    if (near(this.bench, 1.8)) out.b = { text: nm('isl.h.bench'), fn: () => this.openBench() };
    else if (near(HOME_DOOR, 1.2)) out.b = { text: nm('isl.h.inside'), fn: () => this.goInside() };
    else if (near(this.exitSpot, 1.1)) out.b = { text: nm('isl.h.outside'), fn: () => this.goOutside() };
  }

  benchRows() {
    if (this.panel.tab === 0) return CRAFT_IDS.map((id) => ({ id, need: CRAFTS[id].need }));
    if (this.panel.tab === 1) return [{ id: 'upgrade', need: [['wood', UPGRADE.wood], ['stone', UPGRADE.stone], ['coin', UPGRADE.coins]], done: this.S.home.upgraded }];
    return [{ id: 'decorate' }];
  }

  openBench() {
    this.host.mode = 'bench';
    this.panel = { tab: this.panel?.tab || 0, i: 0, t: 0 };
    this.renderBench();
    this.host.game.audio.play('select');
  }

  have(id) { return id === 'coin' ? this.S.coins : count(this.S, id); }

  renderBench() {
    const Pn = this.panel, host = this.host;
    const rows = this.benchRows();
    Pn.i = Math.min(Pn.i, rows.length - 1);
    const tabs = ['isl.bench.craft', 'isl.bench.upgrade', 'isl.bench.decorate'].map((k, i) => `<span class="${i === Pn.tab ? 'on' : ''}">${esc(t(k))}</span>`).join('');
    const start = Math.max(0, Math.min(Pn.i - 3, rows.length - 7));
    const list = rows.slice(start, start + 7).map((r, k) => {
      const on = start + k === Pn.i ? 'on' : '';
      if (r.id === 'decorate') return `<div class="isl-row ${on}">${icon('deco')}<div>${esc(t('isl.bench.decorateRow'))}<div><small>${esc(t('isl.bench.decorateSub'))}</small></div></div><small></small><div></div></div>`;
      const ings = (r.need || []).map(([n, k2]) => `<span class="isl-cook-ing ${this.have(n) < k2 ? 'no' : ''}">${icon(n === 'coin' ? 'coin' : n)}<small>${esc(n === 'coin' ? '' : t(`isl.i.${n}`))} ${Math.min(this.have(n), k2)}/${k2}</small></span>`).join('');
      const nm = r.id === 'upgrade' ? t(r.done ? 'isl.bench.upgraded' : 'isl.bench.upgradeRow') : t(`isl.i.${r.id}`);
      const placed = CRAFTS[r.id]?.bag ? count(this.S, r.id) + Object.values(this.S.tiles).filter((tl) => tl.obj === r.id).length : (this.S.store[r.id] || 0) + this.S.yard.filter((p) => p.id === r.id).length;
      const owned = CRAFTS[r.id] ? esc(t('isl.shop.owned', { n: placed })) : '';
      return `<div class="isl-row ${on}">${r.id === 'upgrade' ? icon('deco') : this.icon3d(r.id)}<div>${esc(nm)}<div>${ings}</div></div><small>${owned}</small><div></div></div>`;
    }).join('');
    host.hud.setPanel(`<h2>${esc(t('isl.bench.title'))}</h2><div class="isl-tabs">${tabs}</div><div class="isl-rows">${list}</div>
      <div class="isl-foot">${esc(tFor(host.player?.p, 'isl.bench.hint'))}</div>`);
  }

  icon3d(id) {
    const url = this.host.picture3d(`craft:${id}`, () => this.model(id));
    return url ? `<img class="isl-ico" src="${url}" alt="">` : icon(id);
  }

  updateBench(inp, dt) {
    const Pn = this.panel, host = this.host;
    Pn.t += dt;
    if (inp.stepX) { Pn.tab = (Pn.tab + inp.stepX + 3) % 3; Pn.i = 0; host.game.audio.play('select'); this.renderBench(); }
    if (inp.stepY) { Pn.i = THREE.MathUtils.clamp(Pn.i - inp.stepY, 0, this.benchRows().length - 1); host.game.audio.play('select'); this.renderBench(); }
    if (Pn.t < 0.25) return;
    if (inp.bPressed) { host.hud.setPanel(null); host.mode = 'walk'; return; }
    if (!inp.aPressed) return;
    const r = this.benchRows()[Pn.i];
    if (r.id === 'decorate') { host.hud.setPanel(null); this.startDecorate(); return; }
    if (r.id === 'upgrade') { this.upgrade(); return; }
    this.craft(r.id);
  }

  craft(id) {
    const host = this.host, S = this.S;
    if (!CRAFTS[id].need.every(([n, k]) => this.have(n) >= k)) { host.game.ui.toast(t('isl.cook.missing'), 1200); host.game.audio.play('bump'); return false; }
    for (const [n, k] of CRAFTS[id].need) take(S, n, k);
    if (CRAFTS[id].bag) give(S, id, 1); // sprinklers and scarecrows: into the bag, for the field
    else S.store[id] = (S.store[id] || 0) + 1;
    host.puffs.burst(new THREE.Vector3(this.bench.x, 1.4, this.bench.z), 0xc68a52, { count: 12, speed: 3, size: 0.3 });
    host.game.audio.play('star');
    host.game.ui.toast(t('isl.t.crafted', { item: t(`isl.i.${id}`) }), 1400);
    host.markDirty();
    if (host.mode === 'bench') this.renderBench();
    return true;
  }

  upgrade() {
    const host = this.host, S = this.S;
    if (S.home.upgraded) return;
    if (count(S, 'wood') < UPGRADE.wood || count(S, 'stone') < UPGRADE.stone || S.coins < UPGRADE.coins) { host.game.ui.toast(t('isl.cook.missing'), 1200); host.game.audio.play('bump'); return; }
    take(S, 'wood', UPGRADE.wood);
    take(S, 'stone', UPGRADE.stone);
    S.coins -= UPGRADE.coins;
    S.home.upgraded = true;
    this.refreshHome();
    host.confetti.burst(new THREE.Vector3(HOME.x, 4, HOME.z + 2), 0, { count: 80, speed: 8, up: 5, life: 1.6, gravity: -7, colors: [0xff5d73, 0xffc93c, 0x3ddc97, 0x4cc9f0] });
    host.game.audio.play('fanfare');
    const txt = t('isl.t.upgraded');
    host.game.ui.toast(txt, 2600);
    speak(txt);
    host.markDirty();
    this.renderBench();
  }

  // ---------- decorate mode ----------

  storeList() {
    return Object.entries(this.S.store).filter(([, n]) => n > 0).map(([id, n]) => ({ id, n, kind: 'deco', name: this.name(id) }));
  }

  startDecorate() {
    const P = this.host.player;
    this.host.mode = 'deco';
    this.sel = 0;
    this.rot = 0;
    this.decoT = 0;
    this.bHold = -1;
    // a free grid cursor that starts on the cell in front of you; the bean follows it loosely
    const x = Math.floor(P.x + P.fx * 1.3) + 0.5, z = Math.floor(P.z + P.fz * 1.3) + 0.5;
    this.cur = { x, z, fx: x, fz: z, holdT: 0 };
    this.host.game.audio.play('select');
    this.host.game.ui.toast(t('isl.deco.on'), 1800);
  }

  stopDecorate() {
    this.host.mode = 'walk';
    if (this.ghost) { this.ghost.removeFromParent(); this.ghost = null; }
    this.hl.visible = false;
    if (this.arrow) this.arrow.visible = false;
    this.host.markDirty();
  }

  /** The cell under the decorate cursor, and whether something can go there. */
  target() {
    const { x, z } = this.cur;
    const piece = this.S.yard.find((p) => Math.hypot(p.x - x, p.z - z) < 0.7) || null;
    return { x, z, piece, ok: this.cellOk(x, z) };
  }

  cellOk(x, z) {
    const b = this.roomBounds();
    if (x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1 - 0.6) return !this.occupied(x, z);
    if (x < YARD.x0 || x > YARD.x1 || z < YARD.z0 || z > YARD.z1) return false;
    if (x > FIELD.x0 - 1 && x < FIELD.x0 + FIELD.cols * FIELD.size + 1 && z > FIELD.z0 - 1 && z < FIELD.z0 + FIELD.rows * FIELD.size + 1) return false;
    if (Math.hypot(x - HOME_DOOR.x, z - HOME_DOOR.z) < 1.4) return false;
    if (this.host.map.pathDist(x, z) < 1.3) return false;
    if (this.occupied(x, z)) return false;
    const map = this.host.map;
    const yardObs = map.obstacles.filter((o) => o.yard);
    map.obstacles = map.obstacles.filter((o) => !o.yard);
    const ok = map.walkable(x, z, 0.3, this.host.walkState);
    map.obstacles.push(...yardObs);
    return ok;
  }

  /** Move the cursor: a tap steps one cell, holding the stick glides; it stays in the yard (or the room). */
  moveCursor(inp, dt) {
    const c = this.cur, P = this.host.player;
    // the bean was moved (in or out of the door): start again in front of it
    if (c.px !== undefined && Math.hypot(P.x - c.px, P.z - c.pz) > 0.45) {
      c.x = c.fx = Math.floor(P.x + P.fx * 1.3) + 0.5;
      c.z = c.fz = Math.floor(P.z + P.fz * 1.3) + 0.5;
    }
    const sx = inp.x, sz = -inp.y, len = Math.hypot(sx, sz);
    if (inp.stepX || inp.stepY) {
      c.fx = c.x + inp.stepX;
      c.fz = c.z - inp.stepY;
      c.holdT = 0;
    } else if (len > 0.3) {
      c.holdT += dt;
      if (c.holdT > 0.28) { c.fx += (sx / Math.max(1, len)) * 5.5 * dt; c.fz += (sz / Math.max(1, len)) * 5.5 * dt; }
    } else c.holdT = 0;
    const b = this.inside(P) ? (() => { const r = this.roomBounds(); return { x0: r.x0 + 0.5, x1: r.x1 - 0.5, z0: r.z0 + 0.5, z1: r.z1 - 0.5 }; })() : { x0: YARD.x0, x1: YARD.x1, z0: YARD.z0, z1: YARD.z1 };
    c.fx = THREE.MathUtils.clamp(c.fx, b.x0, b.x1);
    c.fz = THREE.MathUtils.clamp(c.fz, b.z0, b.z1);
    // never too far from the bean, so it stays on screen
    const dx = c.fx - P.x, dz = c.fz - P.z, d = Math.hypot(dx, dz);
    if (d > 7) { c.fx = P.x + (dx / d) * 7; c.fz = P.z + (dz / d) * 7; }
    c.x = Math.floor(c.fx) + 0.5;
    c.z = Math.floor(c.fz) + 0.5;
  }

  /** The bean strolls after the cursor when it gets far, and looks at it. */
  followCursor(dt) {
    const host = this.host, P = host.player, c = this.cur;
    const dx = c.x - P.x, dz = c.z - P.z, d = Math.hypot(dx, dz);
    if (d > 3.4) host.movePlayer({ x: (dx / d) * 0.8, y: (-dz / d) * 0.8 }, dt);
    else host.movePlayer({ x: 0, y: 0 }, dt);
    if (this.inside(P)) this.clampInside(P);
    if (d > 0.2) { P.fx = dx / d; P.fz = dz / d; P.ch.face(dx, dz); }
    c.px = P.x; c.pz = P.z;
  }

  updateDecorate(inp, dt) {
    const host = this.host;
    this.decoT += dt;
    this.moveCursor(inp, dt);
    this.followCursor(dt);
    const list = this.storeList();
    this.sel = Math.min(this.sel, Math.max(0, list.length - 1));
    for (let k = 1; k <= 9; k++) if (host.game.input.pressed.has(`Digit${k}`) && list[k - 1]) this.sel = k - 1;
    const tg = this.target();
    const held = list[this.sel]?.id;
    // the ghost of what you would place
    const want = !tg.piece && held ? held : null;
    if (!want && this.ghost) { this.ghost.removeFromParent(); this.ghost = null; }
    if (want && (!this.ghost || this.ghost.userData.pid !== want)) {
      if (this.ghost) this.ghost.removeFromParent();
      this.ghost = this.model(want);
      this.ghost.userData.pid = want;
      host.scene.add(this.ghost);
    }
    if (this.ghost) {
      this.ghost.position.set(tg.x, this.groundAt(tg.x, tg.z) + 0.15 + Math.sin(host.time * 5) * 0.06, tg.z);
      this.ghost.rotation.y = this.rot * (Math.PI / 2);
    }
    const col = tg.piece ? 0xffd84a : tg.ok && held ? 0x9ff07a : 0xff8fa8;
    this.hl.visible = true;
    this.hl.position.set(tg.x, this.groundAt(tg.x, tg.z) + 0.06, tg.z);
    this.hl.material = toon(col, { transparent: true, opacity: 0.6 });
    // a bobbing arrow over the cursor cell, easy to spot from the camera
    if (!this.arrow) {
      this.arrow = new THREE.Group();
      const a = mesh(cone(0.32, 0.55, 4), 0xffffff, 0, 0, 0, false);
      a.rotation.x = Math.PI;
      this.arrow.add(a);
      host.scene.add(this.arrow);
    }
    this.arrow.visible = true;
    this.arrow.children[0].material = toon(col);
    this.arrow.position.set(tg.x, this.groundAt(tg.x, tg.z) + 2.1 + Math.sin(host.time * 5) * 0.15, tg.z);
    this.arrow.rotation.y += dt * 2;
    // prompt
    const nm = (k, v) => tFor(host.player.p, k, v);
    const parts = tg.piece ? [nm('isl.deco.pick', { item: this.name(tg.piece.id) }), nm('isl.deco.rotate')] : held ? [tg.ok ? nm('isl.deco.place', { item: this.name(held) }) : t('isl.deco.blocked'), nm('isl.deco.rotate')] : [t('isl.deco.empty')];
    if (list.length > 1) parts.push(nm('isl.deco.next'));
    parts.push(nm('isl.deco.done'));
    host.hud.setPrompt(parts.join(' · '));
    host.hud.setHotbar(list, this.sel, true, tFor(host.player.p, 'isl.deco.bag'));
    if (this.decoT < 0.25) return;
    if (inp.cPressed || host.game.input.escPressed) { this.stopDecorate(); return; }
    if (inp.aPressed) {
      if (tg.piece) this.pickUp(tg.piece);
      else if (held && tg.ok) this.place(held, tg.x, tg.z);
      else host.game.audio.play('bump');
    }
    // [B]: a tap turns, holding it picks the next thing to place
    if (inp.bPressed) this.bHold = 0;
    if (this.bHold >= 0) {
      if (inp.b) {
        this.bHold += dt;
        if (this.bHold > 0.45) {
          this.bHold = -1;
          if (list.length) { this.sel = (this.sel + 1) % list.length; host.game.audio.play('select'); }
        }
      } else {
        this.bHold = -1;
        if (tg.piece) { tg.piece.r = ((tg.piece.r || 0) + 1) % 4; this.renderYard(); host.game.audio.play('select'); host.markDirty(); }
        else { this.rot = (this.rot + 1) % 4; host.game.audio.play('select'); }
      }
    }
  }

  place(id, x, z) {
    const S = this.S;
    S.store[id]--;
    if (S.store[id] <= 0) delete S.store[id];
    this.addPiece(id, x, z, this.rot);
    this.renderYard();
    this.host.puffs.burst(new THREE.Vector3(x, 0.5, z), 0xffffff, { count: 10, speed: 3, size: 0.3 });
    this.host.game.audio.play('land');
    this.host.markDirty();
  }

  pickUp(p) {
    const S = this.S;
    S.yard = S.yard.filter((q) => q !== p);
    S.store[p.id] = (S.store[p.id] || 0) + 1;
    this.renderYard();
    const list = this.storeList();
    this.sel = Math.max(0, list.findIndex((it) => it.id === p.id));
    this.rot = p.r || 0;
    this.host.puffs.burst(new THREE.Vector3(p.x, 0.5, p.z), 0xffffff, { count: 10, speed: 3, size: 0.3 });
    this.host.game.audio.play('pop');
    this.host.markDirty();
  }
}

export { makeSign };
