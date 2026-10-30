import * as THREE from 'three';
import { COLORS, toon, basic, sharedGeo } from '../../core/palette.js';
import { skyTexture, makeTree, makeMushroom, makeStar } from '../../core/world.js';
import { t } from '../../core/i18n.js';
import { esc } from '../../core/ui.js';
import { CELL, mesh, sph, rbox, bx, cyl, cone, disposeTree } from '../keep/common.js';
import { generateFloor } from '../keep/dungeon.js';
import { Hazards } from '../keep/hazards.js';
import { FoeMixin } from '../keep/foes.js';
import { TeddyBoss, SheepBoss } from '../keep/bosses.js';
import { GooseBoss, DuckBoss } from './bosses.js';
import { floorPlan, themeOf, mixOf, bossHpAt, foeHpAt, xpAt, isDeep, ACT_FLOORS } from './acts.js';
import { rollRarity, rollItem, SLOTS, CLASS_SLOTS, itemName, RARITY_CSS, RARITY_HEX, useItem } from './items.js';
import { CLASS_IDS, isBetter } from './classes.js';
import { itemModel } from './models.js';

// The dungeon side of Pillow Keep Solo (mixed into the scene): building a floor from the shared
// co-op generator (keep/dungeon.js) with the act's plan and look, the things lying on the floor
// (coins, potions, keys, gear, the hero's dropped bag, portals), loot drops and boss rewards.
//
// A "world" is the set of fields below. The town and a dungeon floor are both worlds; the floor the
// hero left through a town portal (or fainted on) is kept as it is and swapped back in later.

export const WORLD_KEYS = ['level', 'floorDef', 'theme', 'cells', 'W', 'H', 'doorAt', 'flow', 'hazards', 'grumbles', 'items', 'shots', 'fx',
  'nests', 'chests', 'doors', 'torches', 'boss', 'fog', 'arena', 'stairs', 'stairsArrow', 'wallTiles', 'g', 'floorSeed', 'start', 'portal',
  'zones', 'kind', 'stations', 'npcs', 'floorIndex', 'bg', 'signs', 'townPortal', 'gateSpiral', 'featherTop', 'chimney'];

const BOSSES = { teddy: TeddyBoss, goose: GooseBoss, duck: DuckBoss, sheep: SheepBoss };

// Gear drop chances, Diablo-like: most drops are coins, potions and scrolls; gear is rarer and more
// exciting. grumble/nest/elite go to keep/foes.js through scene.lootRates (champion packs and named
// uniques drop their own loot, see monsters.js); chest = chance a chest holds one item; scroll =
// chance a plain grumble drops a scroll.
export const LOOT = { grumble: 0.025, nest: 0.18, elite: 1, chest: 0.38, scroll: 0.02 };
const COIN_GEO = () => sharedGeo('ksCoin', () => new THREE.CylinderGeometry(0.24, 0.24, 0.07, 16));

export const WorldMixin = {
  snapshotWorld() {
    const o = {};
    for (const k of WORLD_KEYS) o[k] = this[k];
    return o;
  },

  useWorld(w) {
    if (this.level && this.level !== w.level) this.scene.remove(this.level);
    for (const k of WORLD_KEYS) this[k] = w[k];
    this.scene.add(this.level);
    this.scene.background = this.bg;
    for (const it of this.items || []) if (it.label) it.label.style.display = '';
    for (const g of this.grumbles || []) if (g.label) g.label.style.display = '';
  },

  /** Hide a world's floating labels (it is not on screen). */
  hideWorldLabels(w) {
    for (const it of w.items || []) if (it.label) it.label.style.display = 'none';
    for (const g of w.grumbles || []) if (g.label) g.label.style.display = 'none';
    for (const s of w.signs || []) s.el.style.display = 'none';
    for (const n of w.npcs || []) { n.label.style.display = 'none'; n.sayT = 0; }
  },

  /** Throw a world away for good (meshes, labels, the sky texture). */
  disposeWorld(w) {
    if (!w) return;
    for (const it of w.items || []) it.label?.remove();
    for (const g of w.grumbles || []) g.label?.remove();
    for (const n of w.npcs || []) n.label?.remove();
    for (const s of w.signs || []) s.el.remove();
    w.hazards?.clear();
    if (w.level?.parent) w.level.parent.remove(w.level);
    if (w.level) disposeTree(w.level);
    if (w.bg && w.bg !== this.scene.background) w.bg.dispose?.();
  },

  // ---------------------------------------------------------------- building a floor

  /** Build dungeon floor g (see acts.js) as the current world. */
  buildFloor(g, seed) {
    this.g = g;
    this.D = g;
    this.kind = 'dungeon';
    this.floorSeed = seed >>> 0;
    this.floorIndex = mixOf(g); // keep/foes.js uses this for which grumble kinds come
    this.floorDef = generateFloor(0, this.floorSeed, floorPlan(g));
    this.theme = themeOf(g);
    this.bg = skyTexture(...this.theme.sky);
    this.scene.background = this.bg;
    this.level = new THREE.Group();
    this.scene.add(this.level);
    this.hazards = new Hazards(this, this.level);
    Object.assign(this, { grumbles: [], items: [], shots: [], fx: [], nests: [], chests: [], doors: [], torches: [], zones: [], stations: [], npcs: [], signs: [] });
    this.boss = null; this.fog = null; this.arena = null; this.portal = null;
    this.townPortal = null; this.gateSpiral = null; this.featherTop = null; this.chimney = null;
    const map = this.floorDef.map;
    this.H = map.length;
    this.W = Math.max(...map.map((r) => r.length));
    const { W, H } = this;
    this.cells = new Uint8Array(W * H);
    this.doorAt = new Map();
    this.flow = new Int16Array(W * H).fill(-1);
    const starts = [], marks = [];
    for (let r = 0; r < H; r++) {
      for (let c = 0; c < W; c++) {
        const ch = map[r][c] || ' ';
        this.cells[r * W + c] = ch === ' ' ? 0 : ch === '#' ? 1 : ch === 'D' ? 3 : ch === '>' ? 4 : 2;
        if (ch === 'S') starts.push([c, r]);
        if ('KNCrBEg'.includes(ch)) marks.push([ch, c, r]);
      }
    }
    if (this.floorDef.arenaRow) {
      let c0 = W, c1 = 0, r0 = H, r1 = 0;
      for (let r = 0; r < this.floorDef.arenaRow; r++) for (let c = 0; c < W; c++) if (this.cells[r * W + c] >= 2) { c0 = Math.min(c0, c); c1 = Math.max(c1, c); r0 = Math.min(r0, r); r1 = Math.max(r1, r); }
      this.arena = { x0: (c0 - W / 2) * CELL, x1: (c1 + 1 - W / 2) * CELL, z0: (r0 - H / 2) * CELL, z1: (r1 + 1 - H / 2) * CELL };
    }
    this.buildTiles();
    this.buildDoors();
    this.buildStairs();
    this.buildDecor(marks);
    this.buildProps(marks);
    for (const [ch, c, r] of marks) {
      const x = this.cx(c), z = this.cz(r);
      if (ch === 'K') this.spawnItem('key', x, z);
      else if (ch === 'N') this.makeNest(x, z);
      else if (ch === 'C') this.makeChest(x, z);
      else if (ch === 'E') this.spawnPack(x, z, true);
      else if (ch === 'g') this.spawnPack(x, z, false);
      else if (ch === 'B') this.makeBoss(x, z);
    }
    for (const nest of this.nests) {
      // Nests are as tough as a few grumbles of this depth.
      nest.hp = nest.max = foeHpAt(this.D) * 4.5;
      this.spawnGrumble(nest.x, nest.z, nest, 'basic');
    }
    const sx = starts.reduce((a, [c]) => a + this.cx(c), 0) / starts.length;
    const sz = starts.reduce((a, [, r]) => a + this.cz(r), 0) / starts.length;
    this.start = { x: sx, z: sz };
    // The hero's bag waits where it fell, if it fell on this floor.
    const drop = this.hs.drop;
    if (drop && drop.g === g && drop.seed === this.floorSeed) this.spawnBag(drop);
  },

  makeBoss(x, z) {
    const key = this.floorDef.boss;
    const B = BOSSES[key] || TeddyBoss;
    this.boss = new B(this, x, z);
    this.boss.key = key;
    this.boss.max = this.boss.hp = Math.round(bossHpAt(this.D, key));
    const fog = new THREE.Group();
    const cloud = toon(0xf4eaff, { transparent: true, opacity: 0.92 });
    for (let i = 0; i < 9; i++) {
      const a = i * 2.4;
      fog.add(mesh(sph(0.75 + (i % 3) * 0.2, 14, 10), cloud, this.stairs.x + Math.cos(a) * (0.4 + (i % 4) * 0.4), 0.4 + (i % 2) * 0.35, this.stairs.z + Math.sin(a) * (0.3 + (i % 3) * 0.35), false));
    }
    this.level.add(fog);
    this.fog = fog;
  },

  /** Little props that say which act this is (trees, ducks, stars...), on free floor next to walls. */
  buildProps(marks) {
    const kind = this.theme.props;
    const used = new Set(marks.map(([, c, r]) => `${c},${r}`));
    let n = 0;
    const rand = mulberry(this.floorSeed ^ 0x5bd1e995);
    for (let r = 1; r < this.H - 1; r++) {
      for (let c = 1; c < this.W - 1; c++) {
        if (this.cell(c, r) !== 2 || used.has(`${c},${r}`) || rand() > 0.07) continue;
        // only along walls, never in corridors (both sides open across)
        const wallN = this.cell(c, r - 1) === 1, wallS = this.cell(c, r + 1) === 1, wallW = this.cell(c - 1, r) === 1, wallE = this.cell(c + 1, r) === 1;
        if (!(wallN || wallW || wallE) || (wallW && wallE) || (wallN && wallS)) continue;
        if (this.inArenaTile(c, r)) continue;
        const x = this.cx(c) + (wallW ? -0.45 : wallE ? 0.45 : 0), z = this.cz(r) + (wallN ? -0.45 : 0);
        const p = propModel(kind, rand, n++);
        p.position.set(x, 0, z);
        p.rotation.y = rand() * Math.PI * 2;
        this.level.add(p);
      }
    }
  },

  inArenaTile(c, r) {
    return !!this.floorDef.arenaRow && r < this.floorDef.arenaRow;
  },

  // ---------------------------------------------------------------- things on the floor

  spawnItem(kind, x, z, pop = false, custom = null) {
    let m = custom;
    let use = null;
    if (kind === 'snack') kind = 'potion'; // keep/foes.js drops "snacks": here they are potions (mostly red, some blue)
    if (kind === 'potion') use = custom?.use || (Math.random() < 0.3 ? 'mp' : 'hp');
    if (kind === 'scroll') use = custom?.use || (Math.random() < 0.5 ? 'tp' : 'id');
    if (custom?.use) m = null;
    if (kind === 'coin') {
      m = new THREE.Group();
      const disc = mesh(COIN_GEO(), toon(COLORS.gold, { emissive: 0x4a3000 }), 0, 0, 0, true);
      disc.rotation.x = Math.PI / 2;
      m.add(disc, mesh(bx('coinMark', 0.06, 0.22, 0.08), toon(0xe0a100), 0, 0, 0, false));
    } else if (kind === 'potion') {
      m = potionModel(use);
    } else if (kind === 'scroll') {
      m = scrollModel(use);
    } else if (kind === 'key') {
      m = keyModel();
    }
    this.level.add(m);
    const a = Math.random() * Math.PI * 2, sp = pop ? 2 + Math.random() * 3 : 0;
    const it = { kind, x, z, y: pop ? 0.8 : 0.5, vx: Math.cos(a) * sp, vz: Math.sin(a) * sp, vy: pop ? 5 + Math.random() * 3 : 0, t: 0, mesh: m, phase: Math.random() * 6, value: 1 };
    if (kind === 'coin') it.value = 1 + Math.floor(this.D / 3);
    if (use) it.use = use;
    this.items.push(it);
    return it;
  },

  spawnGear(item, x, z) {
    const m = new THREE.Group();
    const model = itemModel(item);
    model.position.y += 0.1;
    m.add(model);
    const beam = mesh(sharedGeo('ksLootBeam', () => new THREE.CylinderGeometry(0.16, 0.3, 3, 10, 1, true)), basic(RARITY_HEX[item.rarity], { transparent: true, opacity: item.rarity ? 0.45 : 0.22, depthWrite: false }), 0, 1.2, 0, false);
    const disc = mesh(sharedGeo('ksLootDisc', () => new THREE.CircleGeometry(0.6, 20)), basic(RARITY_HEX[item.rarity], { transparent: true, opacity: 0.35, depthWrite: false }), 0, -0.42, 0, false);
    disc.rotation.x = -Math.PI / 2;
    m.add(beam, disc);
    const label = this.game.ui.label('label');
    label.style.fontSize = 'clamp(10px, 0.95vw, 15px)';
    label.style.webkitTextStroke = '0.22em #2b2340';
    const it = this.spawnItem('gear', x, z, true, m);
    Object.assign(it, { item, label, labelHtml: '' });
    return it;
  },

  /** The bag the hero dropped when fainting: a big sack with a golden beam and a label. */
  spawnBag(drop) {
    const m = new THREE.Group();
    const sack = mesh(sph(0.55, 16, 12), toon(0xb07848), 0, 0.1, 0);
    sack.scale.set(1, 0.85, 1);
    const neck = mesh(cyl('ksSackNeck', 0.18, 0.28, 0.3, 12), toon(0x9a6a3a), 0, 0.6, 0);
    const tie = mesh(sharedGeo('ksSackTie', () => new THREE.TorusGeometry(0.2, 0.05, 6, 14)), toon(0xff5d73), 0, 0.55, 0, false);
    tie.rotation.x = Math.PI / 2;
    const patch = mesh(bx('ksSackPatch', 0.3, 0.3, 0.05), toon(0xffd23f), 0, 0.15, 0.52, false);
    m.add(sack, neck, tie, patch);
    const beam = mesh(sharedGeo('ksBagBeam', () => new THREE.CylinderGeometry(0.3, 0.5, 9, 12, 1, true)), basic(0xffd23f, { transparent: true, opacity: 0.4, depthWrite: false }), 0, 4.2, 0, false);
    m.add(beam);
    this.level.add(m);
    const label = this.game.ui.label('label');
    label.style.webkitTextStroke = '0.22em #2b2340';
    label.style.color = '#ffd23f';
    const it = { kind: 'bag', x: drop.x, z: drop.z, y: 0.5, vx: 0, vz: 0, vy: 0, t: 0, mesh: m, phase: 0, drop, label, labelHtml: '' };
    this.items.push(it);
    return it;
  },

  /** A blue swirl the hero can step into (town portal on a floor). */
  makePortalMesh() {
    const g = new THREE.Group();
    const ring = mesh(sharedGeo('ksPortalRing', () => new THREE.TorusGeometry(1.0, 0.16, 10, 28)), toon(0x7a5ad0, { emissive: 0x221144 }), 0, 1.25, 0);
    const swirl = mesh(sharedGeo('ksPortalSwirl', () => new THREE.CircleGeometry(0.92, 28)), basic(0x8fd8ff, { transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide }), 0, 1.25, 0, false);
    const swirl2 = mesh(sharedGeo('ksPortalSwirl2', () => new THREE.RingGeometry(0.3, 0.6, 20, 1, 0, Math.PI * 1.3)), basic(0xffffff, { transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide }), 0, 1.25, 0.02, false);
    const pad = mesh(sharedGeo('ksPortalPad', () => new THREE.CircleGeometry(1.2, 28)), basic(0xbfe9ff, { transparent: true, opacity: 0.35, depthWrite: false }), 0, 0.04, 0, false);
    pad.rotation.x = -Math.PI / 2;
    g.add(ring, swirl, swirl2, pad);
    g.userData.spin = swirl2;
    return g;
  },

  updateItems(dt, active) {
    const e = this.hero;
    for (const it of this.items) {
      it.t += dt;
      if (it.vy || it.y > 0.5) {
        it.vy -= 20 * dt;
        it.y += it.vy * dt;
        if (it.y < 0.5) { it.y = 0.5; it.vy = Math.abs(it.vy) > 2 ? -it.vy * 0.35 : 0; }
      }
      if (it.vx || it.vz) {
        const nx = it.x + it.vx * dt, nz = it.z + it.vz * dt;
        if (this.walkableAt(nx, nz)) { it.x = nx; it.z = nz; } else { it.vx *= -0.5; it.vz *= -0.5; }
        const f = Math.max(0, 1 - dt * 3);
        it.vx *= f; it.vz *= f;
        if (Math.abs(it.vx) + Math.abs(it.vz) < 0.05) it.vx = it.vz = 0;
      }
      const d = Math.hypot(e.x - it.x, e.z - it.z);
      if (active && e.state === 'walk' && it.t > 0.4) {
        if (it.kind === 'coin') {
          if (d < 2.4) {
            if (d > 0.55) { const k = Math.min(1, dt * 9 / d); it.x += (e.x - it.x) * k; it.z += (e.z - it.z) * k; } else this.pickItem(it);
          }
        } else if (it.kind === 'potion' || it.kind === 'scroll') {
          // potions and scrolls hop onto the belt (or into the bag) when you walk over them
          if (d < 0.95 && it.t > 0.8) this.tryPickup(it);
        } else if (it.kind === 'key') {
          if (d < 0.95 && !e.hasKey) this.pickItem(it);
        } else if (it.kind === 'bag') {
          if (d < 1.2) this.pickBag(it);
        }
      }
      if (it.taken) continue;
      if (it.label) this.itemLabel(it, d);
      const bob = it.kind === 'coin' || it.kind === 'bag' ? 0 : Math.sin(this.time * 3 + it.phase) * 0.12;
      it.mesh.position.set(it.x, (it.kind === 'bag' ? 0.1 : it.y) + bob + (it.kind === 'key' ? 0.3 : 0), it.z);
      if (it.kind !== 'bag') it.mesh.rotation.y += dt * (it.kind === 'key' ? 2 : it.kind === 'gear' ? 1.5 : 4);
    }
    this.items = this.items.filter((it) => !it.taken);
  },

  itemLabel(it, d) {
    if (d > 16) { it.label.style.display = 'none'; return; }
    let html;
    if (it.kind === 'bag') html = esc(t('ks.bagHere'));
    else {
      const delta = this.compareItemFor(it.item);
      const tag = delta === undefined ? ' <span style="color:#c9a8ff">?</span>' : delta === null ? `<small style="color:#d6cfe6">${esc(t('ks.forClass', { cls: t(`ks.cls.${it.item.cls}`) }))}</small>` : isBetter(delta) ? ' <span style="color:#3ddc97">▲</span>' : '';
      html = `<span style="color:${RARITY_CSS[it.item.rarity]}">${esc(itemName(it.item))}</span>${tag}`;
    }
    if (html !== it.labelHtml) { it.label.innerHTML = html; it.labelHtml = html; }
    this.game.ui.place(it.label, new THREE.Vector3(it.x, it.y + (it.kind === 'bag' ? 1.9 : 1.0), it.z), this.camera);
  },

  removeItem(it) {
    it.taken = true;
    this.level.remove(it.mesh);
    it.label?.remove();
  },

  pickItem(it) {
    const e = this.hero;
    this.removeItem(it);
    const at = new THREE.Vector3(it.x, 0.8, it.z);
    if (it.kind === 'coin') {
      const v = it.value * (e.st.powers.has('coins') ? 2 : 1);
      this.hs.coins += v;
      this.game.audio.play('coin');
      this.confetti.burst(at, COLORS.gold, { count: 4, speed: 2, life: 0.4, size: 0.1 });
    } else if (it.kind === 'potion' || it.kind === 'scroll') {
      this.game.audio.play('star');
      this.floater(t(`ks.got.${it.use}`), at.setY(2.2), it.use === 'hp' ? '#ff5d73' : it.use === 'mp' ? '#2f6fe0' : '#8a45e0', 1);
    } else if (it.kind === 'key') {
      e.hasKey = true;
      this.game.audio.play('rescue');
      this.game.ui.toast(t('ks.gotKey'), 1800);
      this.confetti.burst(at, COLORS.gold, { count: 20, speed: 5, life: 0.8, size: 0.14 });
    }
    this.dirty = true;
  },

  /** A potion or scroll on the floor: onto the belt, else into the bag (else it stays). */
  tryPickup(it) {
    if (it.taken) return false;
    if (it.kind === 'key') { if (!this.hero.hasKey) this.pickItem(it); return true; }
    if (it.kind !== 'potion' && it.kind !== 'scroll') return false;
    const item = it.item || useItem(it.use);
    if (!this.beltAdd(item) && !this.bagGrid().add(item)) {
      if (this.toastCd <= 0) { this.toastCd = 2; this.game.ui.toast(t('ks.beltFull'), 1400); }
      it.t = -1;
      return false;
    }
    this.pickItem(it);
    return true;
  },

  /** Gear on the floor within reach of the hero (for [C]: pick up). */
  gearNear(dist = 1.5) {
    const e = this.hero;
    let best = null, bd = dist;
    for (const it of this.items) {
      if (it.kind !== 'gear' || it.taken || it.t < 0.4) continue;
      const d = Math.hypot(e.x - it.x, e.z - it.z);
      if (d < bd) { bd = d; best = it; }
    }
    return best;
  },

  /** [C] on gear: into the bag (the bag must have room). */
  pickGear(it) {
    if (!this.bagGrid().add(it.item)) {
      this.game.ui.toast(t('ks.bagFull'), 1800);
      this.game.audio.play('bump');
      return false;
    }
    this.removeItem(it);
    this.hs.stats.found++;
    if (it.item.rarity >= 2) this.hs.stats.rares++;
    const delta = this.compareItemFor(it.item);
    this.pickFloater(it.item, isBetter(delta));
    this.game.audio.play(it.item.rarity >= 3 ? 'fanfare' : it.item.rarity === 2 ? 'star' : 'select');
    this.say(`${itemName(it.item)}${isBetter(delta) ? `. ${t('ks.better')}` : ''}`);
    this.dirty = true;
    return true;
  },

  /** Walking onto your dropped bag puts everything back in (what does not fit stays in it). */
  pickBag(it) {
    const drop = it.drop, bag = this.bagGrid();
    const left = [];
    for (const item of drop.items) if (!bag.add(item)) left.push(item);
    drop.items = left;
    this.game.audio.play('fanfare');
    this.confetti.burst(new THREE.Vector3(it.x, 1, it.z), 0, { count: 40, speed: 6, up: 5, colors: [COLORS.gold, 0xffffff, 0xff5d73], life: 1, size: 0.15 });
    if (!left.length) {
      this.removeItem(it);
      if (this.hs.drop === drop) this.hs.drop = null;
      this.game.ui.toast(t('ks.bagBack'), 2400);
      this.say(t('ks.bagBack'));
    } else {
      this.game.ui.toast(t('ks.bagSome', { n: left.length }), 2400);
      it.t = -2; // wait a moment before trying again
    }
    this.saveNow();
  },

  // ---------------------------------------------------------------- loot

  /** Drop `count` items at (x, z): mostly for the hero's class, sometimes for another one (for the stash). */
  dropLoot(x, z, kind, count = 1) {
    const src = { grumble: 'foe', nest: 'nest', chest: 'chest', elite: 'elite', boss: 'boss' }[kind] || kind;
    for (let i = 0; i < count; i++) {
      let rarity = rollRarity(src, this.D);
      if (src === 'boss' && i === 0) rarity = Math.max(2, rarity);
      const slot = SLOTS[Math.floor(Math.random() * SLOTS.length)];
      const cls = CLASS_SLOTS.has(slot) && Math.random() < 0.2 ? CLASS_IDS[Math.floor(Math.random() * 3)] : this.cls;
      const ilvl = Math.max(0, this.D + (Math.random() < 0.3 ? 1 : 0) + (src === 'boss' ? 1 : 0));
      this.spawnGear(rollItem({ ilvl, rarity, slot, cls, diff: this.hs.diff }), x + (Math.random() - 0.5) * 0.6, z + (Math.random() - 0.5) * 0.6);
      this.lootCount = (this.lootCount || 0) + 1; // for the drop-rate tests
    }
  },

  openChest(chest) {
    chest.open = true;
    this.game.audio.play('star');
    this.floater(t('ks.chest'), new THREE.Vector3(chest.x, 2.2, chest.z), '#ffd23f', 1.2, true);
    this.confetti.burst(new THREE.Vector3(chest.x, 1, chest.z), COLORS.gold, { count: 24, speed: 5, up: 5, life: 0.9, size: 0.14 });
    // Diablo-like: mostly coins, potions and scrolls; gear only now and then (LOOT.chest)
    for (let i = 0; i < 6; i++) this.spawnItem('coin', chest.x, chest.z + 0.5, true);
    if (Math.random() < LOOT.chest) this.dropLoot(chest.x, chest.z + 0.6, 'chest', 1);
    else {
      this.spawnItem(Math.random() < 0.65 ? 'potion' : 'scroll', chest.x, chest.z + 0.5, true);
      for (let i = 0; i < 4; i++) this.spawnItem('coin', chest.x, chest.z + 0.5, true);
    }
    if (Math.random() < 0.4) this.spawnItem('potion', chest.x, chest.z + 0.5, true);
    this.gainXp(8, chest.x, chest.z);
  },

  onBossDefeated(boss) {
    for (let i = 0; i < 16; i++) this.spawnItem('coin', boss.x, boss.z, true);
    for (let i = 0; i < 2; i++) this.spawnItem('potion', boss.x, boss.z, true);
    this.spawnItem('scroll', boss.x, boss.z, true);
    this.dropLoot(boss.x, boss.z, 'boss', 2); // the first one is rare or better
    this.gainXp(foeHpAt(0) * 6, boss.x, boss.z);
    for (const g of [...this.grumbles]) this.fluffGrumble(g, undefined);
    if (this.fog) {
      for (const c of this.fog.children) this.puffs.burst(c.getWorldPosition(new THREE.Vector3()), 0xf4eaff, { count: 4, size: 0.8, life: 1, speed: 2 });
      this.level.remove(this.fog);
      this.fog = null;
    }
    this.hs.stats.bosses++;
    if (!isDeep(this.g)) {
      const act = Math.floor(this.g / ACT_FLOORS);
      const first = !this.hs.bosses[act];
      this.hs.bosses[act] = true;
      if (first) this.later(2.2, () => this.game.ui.banner(t('ks.actClear', { n: act + 1 }), t(act === 3 ? 'ks.actClear4' : 'ks.actClearSub'), 2600));
    }
    this.saveNow();
  },

  /** Grumbles count for quests; plain ones drop gear a little more often than in co-op. */
  fluffGrumble(g, by) {
    if (g.dead) return;
    FoeMixin.fluffGrumble.call(this, g, by); // gear: LOOT rates via this.lootRates (keep/foes.js)
    if (by === undefined) return;
    this.hs.stats.fluffed++;
    if (g.elite) this.hs.stats.elites++;
    if (!g.elite && Math.random() < LOOT.scroll) this.spawnItem('scroll', g.x, g.z, true);
    const e = this.hero;
    if (e.st.powers.has('heal') && e.state === 'walk') e.hp = Math.min(e.st.maxHp, e.hp + e.st.maxHp * 0.03);
  },

  /** Snooze Arrows put what they hit to sleep (the arrow's owner carries the time, see skills.js). */
  hitGrumble(g, dmg, by, kx = 0, kz = 0, from = null) {
    const hit = FoeMixin.hitGrumble.call(this, g, dmg, by, kx, kz, from);
    if (hit && by?.snooze && !g.dead && (g.state === 'walk' || g.state === 'aim' || g.state === 'dash')) { g.state = 'sleep'; g.t = by.snooze; g.vx = g.vz = 0; }
    return hit;
  },

  damageNest(nest, dmg, by) {
    const was = nest.done;
    FoeMixin.damageNest.call(this, nest, dmg, by);
    if (!was && nest.done) this.hs.stats.nests++;
  },

  /** Grumble health grows with the difficulty (keep/foes.js gives the kind and elite factors). */
  foeHp(kind, elite, trait) {
    const T = { basic: 1, charger: 1.5, thrower: 1, shield: 2.2 }[kind] || 1;
    let hp = foeHpAt(this.D) * T;
    if (elite) hp *= 5 * (trait === 'tough' ? 1.6 : 1);
    return hp;
  },

  gainXp(amount) {
    this.addXp(amount * xpAt(this.D));
  },
};

function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = a;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

export function potionModel(use = 'hp') {
  const m = new THREE.Group();
  const bottle = mesh(sph(0.22, 14, 10), toon(use === 'mp' ? 0x4c8dff : 0xff5d73, { transparent: true, opacity: 0.9 }), 0, 0, 0);
  const neck = mesh(cyl('ksPotNeck', 0.07, 0.09, 0.16, 10), toon(0xfff3dc), 0, 0.24, 0, false);
  const cork = mesh(cyl('ksPotCork', 0.08, 0.07, 0.08, 10), toon(0xb07848), 0, 0.34, 0, false);
  const shine = mesh(sph(0.06), toon(0xffffff), -0.08, 0.08, 0.16, false);
  const heart = mesh(bx('ksPotHeart', 0.12, 0.12, 0.04), toon(0xffffff), 0, 0, 0.21, false);
  heart.rotation.z = Math.PI / 4;
  m.add(bottle, neck, cork, shine, heart);
  m.scale.setScalar(1.25);
  return m;
}

/** A rolled-up scroll: blue ribbons for Town Portal, yellow for Identify. */
export function scrollModel(use = 'tp') {
  const m = new THREE.Group();
  const roll = mesh(cyl('ksScroll', 0.12, 0.12, 0.55, 12), toon(0xfff3dc), 0, 0, 0);
  roll.rotation.z = Math.PI / 2;
  const band = mesh(cyl('ksScrollBand', 0.13, 0.13, 0.1, 12), toon(use === 'tp' ? 0x4cc9f0 : 0xffd23f), 0, 0, 0, false);
  band.rotation.z = Math.PI / 2;
  m.add(roll, band);
  m.scale.setScalar(1.3);
  return m;
}

export function keyModel() {
  const g = new THREE.Group();
  const mat = toon(COLORS.gold, { emissive: 0x5a3c00 });
  g.add(mesh(sharedGeo('kKeyRing', () => new THREE.TorusGeometry(0.2, 0.07, 8, 18)), mat, 0, 0.25, 0));
  g.add(mesh(bx('keyShaft', 0.09, 0.5, 0.09), mat, 0, -0.15, 0));
  g.add(mesh(bx('keyTooth', 0.17, 0.08, 0.09), mat, 0.1, -0.34, 0));
  g.add(mesh(bx('keyTooth', 0.17, 0.08, 0.09), mat, 0.1, -0.2, 0));
  return g;
}

/** One small themed prop. */
function propModel(kind, rand, i) {
  const g = new THREE.Group();
  if (kind === 'forest') {
    if (i % 3 === 0) { const tr = makeTree(rand, 0.55); g.add(tr); } else if (i % 3 === 1) { const m = makeMushroom([0xff5d73, 0xffc93c, 0x9b5de5][i % 3]); m.scale.setScalar(0.7); g.add(m); } else {
      const f = mesh(cone('ksFeather', 0.12, 0.8, 6), toon(0xffffff), 0, 0.12, 0, false);
      f.rotation.z = Math.PI / 2; f.scale.z = 0.3;
      g.add(f, mesh(cyl('ksQuill', 0.02, 0.02, 0.5, 5), toon(0xd8c4a8), 0.55, 0.12, 0, false).rotateZ(Math.PI / 2));
    }
  } else if (kind === 'grotto') {
    if (i % 2 === 0) {
      // a rubber duck
      const body = mesh(sph(0.3, 12, 10), toon(0xffd23f), 0, 0.25, 0);
      body.scale.set(1.2, 0.85, 1);
      const head = mesh(sph(0.18, 12, 10), toon(0xffd23f), 0.22, 0.55, 0);
      const beak = mesh(cone('ksBeak', 0.07, 0.16, 6), toon(0xff8c42), 0.42, 0.52, 0, false);
      beak.rotation.z = -Math.PI / 2;
      g.add(body, head, beak, mesh(sph(0.035, 6, 4), toon(COLORS.ink), 0.3, 0.6, 0.1, false), mesh(sph(0.035, 6, 4), toon(COLORS.ink), 0.3, 0.6, -0.1, false));
    } else {
      // soap bubbles
      const mat = toon(0xbfe9ff, { transparent: true, opacity: 0.45 });
      for (let k = 0; k < 3; k++) g.add(mesh(sph(0.18 + k * 0.08, 12, 10), mat, (k - 1) * 0.3, 0.3 + k * 0.25, 0, false));
    }
  } else if (kind === 'dream') {
    const st = makeStar(i % 2 ? COLORS.gold : 0xc9a8ff);
    st.scale.setScalar(0.4);
    st.position.y = 0.8;
    st.userData.float = true;
    g.add(st);
  } else {
    // cellars: a little stack of crates
    g.add(mesh(rbox('ksCrate', 0.7, 0.6, 0.7, 0.06), toon(0xc98b5a), 0, 0.3, 0));
    if (i % 2) g.add(mesh(rbox('ksCrate2', 0.5, 0.45, 0.5, 0.05), toon(0xb07848), 0.05, 0.82, 0.05));
  }
  return g;
}
