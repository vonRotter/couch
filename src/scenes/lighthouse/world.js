import * as THREE from 'three';
import { toon } from '../../core/palette.js';
import { W, H, DOOR_TILES, DIRS, SOLID, TALL, FLOORISH, tileX, tileZ, colOf, rowOf, inGrid, pegUp, parseMap, groundOf } from './tiles.js';
import { ROOMS, AREAS, DOORS, neighbor } from './rooms.js';
import { buildRoomStatic, floorPatch } from './build.js';
import {
  makeBlock, makePot, makeLiftRock, makeChest, makeSign, makeSaveStone, makeTorch, makeSwitch, makePeg, makePlate, makeBush,
  makeGrass, makeGate, makeDoorLeaf, makeNpc, makeDecor, makeLamp, makeShopItem, makeItem, mesh, box, cyl, sph,
} from './models.js';
import { makeEnemy } from './enemies.js';

// Room runtime: turns room data into a live room (meshes, entities, doors, puzzle state) and
// answers "can something stand / walk / fly here?". Mixed into LighthouseEngine.
// Rooms are rebuilt from data every time you enter, so pushed blocks, thrown pots, cut bushes and
// enemies reset when you leave a room (no block can stay stuck in a corner). Chests, keys, doors,
// solved puzzles and defeated bosses are remembered in the save.

const DYN = new Set(['b', '*', 'g', 't', 'L', 'x', 'y', '_']);
const STATIC_CACHE = {};

/** Parsed (unchanging) grid of a room, for looking past the screen edge. */
export function staticGrid(id) {
  if (!STATIC_CACHE[id]) STATIC_CACHE[id] = parseMap(ROOMS[id]).grid;
  return STATIC_CACHE[id];
}

const keyOf = (c, r) => `${c},${r}`;

export const WorldMixin = {
  /** Is this door open right now? (shared door state from the save, plus trap rooms) */
  doorIsOpen(roomId, d) {
    const door = DOORS[roomId]?.[d];
    if (!door) return false;
    if (this.room && this.room.trapActive && (this.room.id === roomId || this.room.id === door.to)) return false;
    if (door.type === 'open') return true;
    if (door.type === 'shut') return !!this.save.solved[door.owner];
    return !!this.save.doors[door.id];
  },

  makeRoom(id, origin) {
    const def = ROOMS[id];
    const area = def.area;
    const { grid, ents } = parseMap(def);
    for (const e of def.extra || []) ents.push({ ...e });
    const group = new THREE.Group();
    group.position.copy(origin);
    this.host.scene.add(group);
    const solved = !!this.save.solved[id];
    const room = {
      id, def, area, origin: origin.clone(), group, grid, ents: [], occ: new Map(), enemies: [], projs: [], pickups: [], thrown: [],
      torches: [], plates: [], pegs: [], tileMeshes: new Map(), doors: {}, doorAt: new Map(), solved, time: 0,
      lit: !def.dark || (def.lightOnSolve && solved), trapActive: false, bossSpawned: false, pegSafe: new Set(), anim: [],
    };
    // Burnt thorns stay gone
    for (const k of Object.keys(this.save.burnt || {})) {
      const [rid, pos] = k.split(':');
      if (rid !== id) continue;
      const [c, r] = pos.split(',').map(Number);
      if (grid[r]?.[c] === '*') grid[r][c] = '.';
    }
    // Door gaps
    for (const [d, door] of Object.entries(DOORS[id] || {})) {
      const [c, r] = DOOR_TILES[d];
      grid[r][c] = '.';
      room.doors[d] = { d, door, c, r, open: this.doorIsOpen(id, d), leaf: null, y: 0 };
      room.doorAt.set(keyOf(c, r), room.doors[d]);
    }
    // Static look (dynamic tiles drawn as plain floor underneath)
    const floorCh = def.floor || '.';
    const sGrid = grid.map((row, r) => row.map((ch, c) => (DYN.has(ch) ? groundOf(def.map, c, r, floorCh) : ch)));
    const built = buildRoomStatic(def, sGrid, group, Object.fromEntries(Object.entries(room.doors).map(([d, v]) => [d, v])));
    room.waves = built.waves;
    room.lampTop = built.lampTop;
    if (built.lampTop) {
      // The great lamp on top of the lighthouse glows brighter with every crystal brought home.
      const p = def.props.find((pr) => pr.kind === 'lighthouse');
      const n = this.save.placed || 0;
      const lamp = new THREE.Group();
      lamp.position.set(tileX(p.c), built.lampTop + 0.65, tileZ(p.r));
      lamp.add(mesh(sph(0.42), toon(n ? 0xfff1a8 : 0x8a8270, { emissive: n ? 0x886600 : 0x000000 }), 0, 0, 0, false));
      const beam = new THREE.Group();
      for (let i = 0; i < n; i++) {
        const b = mesh(cyl(0.06, 0.3, 3.2, 10), toon(0xfff6c8, { transparent: true, opacity: 0.25 }), 0, 0, 0, false);
        b.rotation.z = Math.PI / 2;
        b.position.x = 1.8;
        const arm = new THREE.Group();
        arm.rotation.y = (i / Math.max(1, n)) * Math.PI * 2;
        arm.add(b);
        beam.add(arm);
      }
      lamp.add(beam);
      group.add(lamp);
      room.anim.push({ m: beam, t: 0, dur: Infinity, kind: 'spin' });
    }
    // Dynamic tiles
    for (let r = 0; r < H; r++) {
      for (let c = 0; c < W; c++) {
        const ch = grid[r][c];
        if (!DYN.has(ch)) continue;
        const x = tileX(c), z = tileZ(r);
        if (ch === 'b' || ch === '*' || ch === 'g') {
          const m = ch === 'g' ? makeGrass() : makeBush(ch === '*');
          m.position.set(x, 0, z);
          m.rotation.y = ((c * 7 + r * 13) % 10) * 0.6;
          group.add(m);
          room.tileMeshes.set(keyOf(c, r), m);
        } else if (ch === 't' || ch === 'L') {
          const m = makeTorch();
          m.position.set(x, 0, z);
          group.add(m);
          const torch = { c, r, x, z, mesh: m, lit: ch === 'L', fixed: ch === 'L', timer: 0 };
          if (solved && def.solve === 'torches') torch.lit = true;
          m.userData.flame.visible = torch.lit;
          room.torches.push(torch);
        } else if (ch === 'x' || ch === 'y') {
          const m = makePeg(ch);
          m.position.set(x, 0, z);
          group.add(m);
          const up = pegUp(ch, this.sw(area));
          m.userData.top.scale.y = up ? 1 : 0.08;
          m.userData.top.position.y = up ? 0.35 : 0.03;
          room.pegs.push({ c, r, ch, mesh: m, up });
        } else if (ch === '_') {
          const m = makePlate();
          m.position.set(x, 0, z);
          group.add(m);
          room.plates.push({ c, r, mesh: m, pressed: false });
        }
      }
    }
    // Door leaves
    for (const dr of Object.values(room.doors)) {
      const type = dr.door.type === 'open' ? (def.trap && !solved ? 'shut' : null) : dr.door.type;
      const showLeaf = type || (def.trap && !solved);
      if (!showLeaf) continue;
      const leaf = makeDoorLeaf(type || 'shut', def.theme);
      leaf.position.set(tileX(dr.c), 0, tileZ(dr.r));
      if (dr.d === 'w' || dr.d === 'e') leaf.rotation.y = Math.PI / 2;
      if (dr.d === 's') leaf.scale.y = 0.5;
      if (dr.open) { leaf.position.y = -1.25; leaf.visible = false; }
      group.add(leaf);
      dr.leaf = leaf;
      dr.leafType = type || 'shut';
    }
    // Entities
    for (const spec of ents) this.addEntity(room, spec);
    if (solved && def.reward) this.spawnReward(room, false);
    // A beaten boss's heart container / crystal wait for you if you left without them.
    if (solved && def.victory) {
      if (!this.save.got[`${id}.heart`]) this.addPickup(room, 'container', tileX(6), tileZ(5), { id: `${id}.heart`, persist: true });
      if (!this.save.got[`${id}.crystal`]) this.addPickup(room, 'crystal', tileX(10), tileZ(5), { id: `${id}.crystal`, persist: true });
    }
    return room;
  },

  sw(area) { return this.save.sw[area] || 0; },

  addEntity(room, spec) {
    const x = tileX(spec.c), z = tileZ(spec.r);
    const g = room.group;
    const put = (m, solid = true) => {
      m.position.set(x, 0, z);
      g.add(m);
      const e = { ...spec, x, z, mesh: m, solid };
      room.ents.push(e);
      if (solid) room.occ.set(keyOf(spec.c, spec.r), e);
      return e;
    };
    switch (spec.t) {
      case 'block': return put(makeBlock(room.def.theme));
      case 'pot': return put(makePot());
      case 'rock': return put(makeLiftRock());
      case 'switch': { const e = put(makeSwitch()); this.syncSwitch(room, e); return e; }
      case 'enemy': {
        const en = makeEnemy(this, spec.kind, x, z);
        this.addEnemy(en, room);
        return null;
      }
      case 'boss': {
        if (this.save.bosses[room.id] || room.solved) return null;
        room.bossSpec = spec;
        return null;
      }
      case 'chest': {
        const m = makeChest(spec.big);
        const e = put(m);
        e.opened = !!this.save.got[spec.id];
        if (e.opened) m.userData.lid.rotation.x = -1.9;
        return e;
      }
      case 'item': {
        if (spec.id && this.save.got[spec.id]) return null;
        this.addPickup(room, spec.item, x, z, { id: spec.id, persist: true });
        return null;
      }
      case 'warp': {
        let m;
        if (spec.look === 'stairsDown' || spec.look === 'stairsUp') {
          m = new THREE.Group();
          const down = spec.look === 'stairsDown';
          for (let i = 0; i < 4; i++) {
            const step = down
              ? mesh(box(0.9, 0.06, 0.22), toon([0x6d6084, 0x4a4060, 0x2f2840, 0x1a1426][i]), 0, -i * 0.02, -0.33 + i * 0.22, false)
              : mesh(box(0.9, 0.1 + (3 - i) * 0.12, 0.24), toon([0xd8d0ec, 0xc9c0e0, 0xbab0d4, 0xaba0c8][i]), 0, (0.1 + (3 - i) * 0.12) / 2, -0.36 + i * 0.24);
            m.add(step);
          }
          if (!down) m.add(mesh(box(0.08, 0.7, 0.9), toon(0x8a5a3a), -0.47, 0.35, 0), mesh(box(0.08, 0.7, 0.9), toon(0x8a5a3a), 0.47, 0.35, 0));
          if (down) m.rotation.y = Math.PI;
        } else if (spec.look === 'cave' || spec.look === 'caveOut') {
          m = new THREE.Group();
          m.add(mesh(box(0.95, 0.04, 0.95), toon(0x0c0810), 0, 0.02, 0, false));
        } else {
          m = new THREE.Group();
          m.add(mesh(box(0.8, 0.03, 0.6), toon(0x8a5a3a), 0, 0.02, 0, false));
        }
        const e = put(m, false);
        if (spec.under) m.visible = false;
        return e;
      }
      case 'npc': {
        const f = this.save.flags;
        if (spec.when && !f[spec.when]) return null;
        if (spec.unless && f[spec.unless]) return null;
        const ch = makeNpc(spec.id);
        const e = put(ch.group);
        e.char = ch;
        return e;
      }
      case 'sign': return put(makeSign());
      case 'save': return put(makeSaveStone());
      case 'decor': return put(makeDecor(spec.kind));
      case 'lamp': {
        const e = put(makeLamp());
        this.syncLamp(e);
        return e;
      }
      case 'shop': {
        const e = put(makeShopItem(spec.item));
        if (spec.id && this.save.got[spec.id]) e.mesh.userData.item.visible = false;
        return e;
      }
      case 'gate': {
        const e = put(makeGate(), !room.solved);
        if (room.solved) e.mesh.position.y = -1.2;
        return e;
      }
      default: return null;
    }
  },

  addEnemy(en, room = this.room) {
    room.enemies.push(en);
    room.group.add(en.group);
    en.sync(0);
  },

  addProjectile(p) { this.room.projs.push(p); },

  addPickup(room, item, x, z, { id = null, persist = false, life = 0, pop = false } = {}) {
    const m = makeItem(item);
    const holder = new THREE.Group();
    holder.add(m);
    holder.position.set(x, 0, z);
    room.group.add(holder);
    const p = { item, x, z, id, persist, life: life || (persist ? Infinity : 9), mesh: holder, inner: m, t: Math.random() * 6, pop: pop ? 0.5 : 0, dead: false };
    room.pickups.push(p);
    return p;
  },

  /** Reward of a solved puzzle: a chest or an item appears. */
  spawnReward(room, fresh = true) {
    const rw = room.def.reward;
    if (!rw) return;
    if (rw.t === 'item') {
      if (this.save.got[rw.id]) return;
      const p = this.addPickup(room, rw.item, tileX(rw.at[0]), tileZ(rw.at[1]), { id: rw.id, persist: true, pop: fresh });
      if (fresh) this.puffAt(p.x, p.z, 0xffffff, 12);
    } else {
      if (room.ents.some((e) => e.t === 'chest' && e.id === rw.id)) return;
      const e = this.addEntity(room, { t: 'chest', item: rw.item, id: rw.id, big: rw.big, c: rw.at[0], r: rw.at[1] });
      if (fresh) { this.puffAt(e.x, e.z, 0xffffff, 16); e.mesh.scale.setScalar(0.01); room.anim.push({ m: e.mesh, t: 0, dur: 0.4, kind: 'grow' }); }
    }
  },

  unloadRoom(room) {
    if (!room) return;
    this.host.scene.remove(room.group);
    room.group.traverse((o) => {
      if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose();
      const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      for (const m of mats) {
        if (m.userData?.shared) continue;
        if (m.map && !m.map.userData?.shared) m.map.dispose();
        m.dispose();
      }
    });
  },

  // ---------- solidity ----------

  entAt(room, c, r) { return room.occ.get(keyOf(c, r)) || null; },

  /** Can the hero not stand on this tile? (out-of-grid tiles look into the next screen) */
  heroBlocked(room, c, r, dz = 0) {
    if (!inGrid(c, r)) return this.edgeBlocked(room, c, r);
    const door = room.doorAt.get(keyOf(c, r));
    if (door) return !door.open;
    const ch = room.grid[r][c];
    if (ch === 'x' || ch === 'y') return pegUp(ch, this.sw(room.area)) && !room.pegSafe.has(keyOf(c, r));
    if (ch === 'v') return dz <= 0;
    if (SOLID.has(ch)) return true;
    const e = room.occ.get(keyOf(c, r));
    return !!(e && e.solid);
  },

  edgeBlocked(room, c, r) {
    if (!AREAS[room.area].scroll) return true;
    const d = c < 0 ? 'w' : c >= W ? 'e' : r < 0 ? 'n' : 's';
    const nb = neighbor(room.id, d);
    if (!nb) return true;
    const tc = c < 0 ? W - 1 : c >= W ? 0 : c;
    const tr = r < 0 ? H - 1 : r >= H ? 0 : r;
    if (!inGrid(tc, tr)) return true;
    const opp = DIRS[d].opp;
    const [dc, dr] = DOOR_TILES[opp];
    if (DOORS[nb]?.[opp] && dc === tc && dr === tr) return !this.doorIsOpen(nb, opp);
    const ch = staticGrid(nb)[tr][tc];
    return SOLID.has(ch) || ch === 'x' || ch === 'y';
  },

  /** Walkers: no holes, water, ledges or door gaps; flyers only stop at tall things. */
  bodyBlocked(room, c, r, fly) {
    if (!inGrid(c, r) || c === 0 || r === 0 || c === W - 1 || r === H - 1) {
      if (!inGrid(c, r)) return true;
      if (room.doorAt.has(keyOf(c, r))) return true;
    }
    const ch = room.grid[r][c];
    if ((ch === 'x' || ch === 'y') && pegUp(ch, this.sw(room.area))) return true;
    if (fly) return TALL.has(ch);
    if (SOLID.has(ch) || ch === 'o' || ch === 'v') return true;
    const e = room.occ.get(keyOf(c, r));
    return !!(e && e.solid);
  },

  /** Is a box (center x,z, half size h) touching any tile that blocks? */
  boxHits(x, z, h, test) {
    const c0 = Math.floor(x - h + 8.5), c1 = Math.floor(x + h + 8.5 - 1e-6);
    const r0 = Math.floor(z - h + 5.5), r1 = Math.floor(z + h + 5.5 - 1e-6);
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (test(c, r)) return true;
    return false;
  },

  /** Move an enemy (or any body with x, z, r, fly) with collision. Returns { x: hitX, z: hitZ }. */
  moveBody(b, dx, dz) {
    const room = this.room;
    const h = Math.min(0.45, b.r * 0.85);
    const test = (c, r) => this.bodyBlocked(room, c, r, b.fly);
    const out = { x: false, z: false };
    if (dx) {
      if (!this.boxHits(b.x + dx, b.z, h, test)) b.x += dx; else out.x = true;
    }
    if (dz) {
      if (!this.boxHits(b.x, b.z + dz, h, test)) b.z += dz; else out.z = true;
    }
    return out;
  },

  overHole(x, z) {
    const c = colOf(x), r = rowOf(z);
    return inGrid(c, r) && this.room.grid[r][c] === 'o';
  },

  projectileBlocked(x, z) {
    const c = colOf(x), r = rowOf(z);
    if (!inGrid(c, r)) return true;
    const ch = this.room.grid[r][c];
    if (TALL.has(ch) || (pegUp(ch, this.sw(this.room.area)) && (ch === 'x' || ch === 'y'))) return true;
    const door = this.room.doorAt.get(keyOf(c, r));
    if (door) return true;
    const e = this.room.occ.get(keyOf(c, r));
    return !!(e && e.solid && e.t !== 'warp');
  },

  /** Nothing tall between two points (for the brute's line of sight). */
  lineClear(x0, z0, x1, z1) {
    const n = Math.ceil(Math.hypot(x1 - x0, z1 - z0) * 3);
    for (let i = 1; i < n; i++) {
      const x = x0 + ((x1 - x0) * i) / n, z = z0 + ((z1 - z0) * i) / n;
      if (this.projectileBlocked(x, z)) return false;
    }
    return true;
  },

  // ---------- tiles that change ----------

  setTile(room, c, r, ch) {
    room.grid[r][c] = ch;
    const k = keyOf(c, r);
    const m = room.tileMeshes.get(k);
    if (m) { room.group.remove(m); room.tileMeshes.delete(k); }
    // A hidden stairway under a cut bush shows up
    for (const e of room.ents) if (e.t === 'warp' && e.c === c && e.r === r && e.under) { e.mesh.visible = true; this.sfx('secret'); }
  },

  cutTile(room, c, r) {
    const ch = room.grid[r][c];
    if (ch !== 'b' && ch !== 'g') return false;
    const x = tileX(c), z = tileZ(r);
    this.setTile(room, c, r, room.def.floor || (room.area === 'over' ? '.' : '.'));
    this.puffAt(x, z, 0x6fd06a, 8);
    this.sfx('cut');
    const roll = Math.random();
    if (roll < 0.22) this.addPickup(room, 'shell', x, z, { pop: true });
    else if (roll < 0.3) this.addPickup(room, 'heart', x, z, { pop: true });
    return true;
  },

  burnTile(room, c, r) {
    room.burning ||= new Set();
    if (room.grid[r][c] !== '*' || room.burning.has(`${c},${r}`)) return false;
    room.burning.add(`${c},${r}`);
    this.save.burnt[`${room.id}:${c},${r}`] = true;
    const m = room.tileMeshes.get(keyOf(c, r));
    const x = tileX(c), z = tileZ(r);
    this.sfx('flame');
    for (let i = 0; i < 3; i++) this.later(i * 0.12, () => this.puffAt(x, z, [0xff9f2e, 0xffd23f, 0x5a4d7a][i], 8));
    if (m) room.anim.push({ m, t: 0, dur: 0.45, kind: 'shrink' });
    this.later(0.45, () => { if (this.room === room) this.setTile(room, c, r, '.'); });
    return true;
  },

  lightTorch(room, torch) {
    if (torch.lit) return false;
    torch.lit = true;
    torch.timer = room.def.torchTime && !room.solved ? room.def.torchTime : 0;
    torch.mesh.userData.flame.visible = true;
    this.sfx('torch');
    this.puffAt(torch.x, torch.z, 0xffd23f, 8, 1);
    return true;
  },

  extinguish(torch) {
    if (!torch.lit || torch.fixed) return;
    torch.lit = false;
    torch.mesh.userData.flame.visible = false;
    this.puffAt(torch.x, torch.z, 0x8f89a8, 8, 1);
    this.sfx('dash');
  },

  toggleSwitch(room) {
    if (room.switchCool > 0) return;
    room.switchCool = 0.5;
    this.save.sw[room.area] = 1 - this.sw(room.area);
    this.sfx('switch');
    const sw = this.sw(room.area);
    for (const e of room.ents) if (e.t === 'switch') this.syncSwitch(room, e);
    for (const p of room.pegs) {
      p.up = pegUp(p.ch, sw);
      // A peg that would rise under the hero waits until the hero steps off it.
      if (p.up && this.heroOnTile(p.c, p.r)) room.pegSafe.add(keyOf(p.c, p.r));
    }
  },

  syncSwitch(room, e) {
    const sw = this.sw(room.area);
    e.mesh.userData.orbs[0].visible = sw === 0;
    e.mesh.userData.orbs[1].visible = sw === 1;
  },

  syncLamp(e) {
    const n = this.save.placed || 0;
    e.mesh.userData.sockets.forEach((s, i) => { s.visible = i < n; });
  },

  heroOnTile(c, r) {
    const h = 0.28;
    const hx = this.hero.x, hz = this.hero.z;
    const x = tileX(c), z = tileZ(r);
    return Math.abs(hx - x) < 0.5 + h && Math.abs(hz - z) < 0.5 + h;
  },

  // ---------- per-frame room logic ----------

  updateRoomLogic(room, dt) {
    room.time += dt;
    if (room.switchCool > 0) room.switchCool -= dt;
    // waves
    for (const w of room.waves) w.position.x = w.userData.x0 + Math.sin(room.time * 1.2 + w.userData.phase) * 0.12;
    // torches flicker and burn out in timed rooms
    for (const tc of room.torches) {
      const f = tc.mesh.userData.flame;
      if (tc.lit) {
        f.scale.set(1 + Math.sin(room.time * 17 + tc.c) * 0.08, 1 + Math.sin(room.time * 23 + tc.r) * 0.12, 1);
        if (tc.timer > 0) {
          tc.timer -= dt;
          if (tc.timer < 2) f.visible = Math.floor(tc.timer * 8) % 2 === 0;
          if (tc.timer <= 0) { tc.timer = 0; this.extinguish(tc); }
        }
      }
    }
    // pegs animate up / down; safe pegs rise once the hero leaves them
    for (const p of room.pegs) {
      const k = keyOf(p.c, p.r);
      if (room.pegSafe.has(k) && !this.heroOnTile(p.c, p.r)) room.pegSafe.delete(k);
      const up = p.up && !room.pegSafe.has(k);
      const top = p.mesh.userData.top;
      const ty = up ? 1 : 0.08;
      top.scale.y += (ty - top.scale.y) * Math.min(1, dt * 14);
      top.position.y = 0.35 * top.scale.y;
      p.mesh.children[1].position.y = 0.72 * top.scale.y + 0.01;
    }
    // plates
    for (const pl of room.plates) {
      const e = room.occ.get(keyOf(pl.c, pl.r));
      const pressed = !!(e && e.t === 'block' && !e.moving) || (room.def.heroPlates && this.heroOnTile(pl.c, pl.r));
      if (pressed && !pl.pressed) this.sfx('switch');
      pl.pressed = pressed;
      const top = pl.mesh.userData.top;
      top.position.y += ((pressed ? 0.02 : 0.08) - top.position.y) * Math.min(1, dt * 12);
    }
    // doors
    for (const dr of Object.values(room.doors)) {
      const open = this.doorIsOpen(room.id, dr.d);
      if (open !== dr.open) {
        dr.open = open;
        if (dr.leaf) this.sfx(open ? 'door' : 'door');
      }
      if (dr.leaf) {
        const ty = dr.open ? -1.25 : 0;
        dr.leaf.position.y += (ty - dr.leaf.position.y) * Math.min(1, dt * 10);
        dr.leaf.visible = dr.leaf.position.y > -1.2;
      }
    }
    // gates
    for (const e of room.ents) {
      if (e.t === 'gate') {
        if (room.solved && e.solid) { e.solid = false; room.occ.delete(keyOf(e.c, e.r)); this.sfx('door'); }
        e.mesh.position.y += ((e.solid ? 0 : -1.2) - e.mesh.position.y) * Math.min(1, dt * 8);
      } else if (e.t === 'save') {
        e.mesh.userData.lamp.scale.setScalar(1 + Math.sin(room.time * 3) * 0.08);
      } else if (e.t === 'npc' && e.char) {
        e.char.update(dt, { moving: 0 });
      } else if (e.t === 'shop') {
        e.mesh.userData.item.rotation.y += dt * 1.5;
      } else if (e.t === 'lamp') {
        e.mesh.userData.glow.scale.setScalar(1 + (this.save.placed || 0) * 0.15 + Math.sin(room.time * 2) * 0.05);
        e.mesh.userData.sockets.forEach((s, i) => { s.rotation.y += dt * (1 + i * 0.3); });
      } else if (e.t === 'block' && e.moving) {
        const mv = e.moving;
        mv.t += dt;
        const p = Math.min(1, mv.t / mv.dur);
        e.mesh.position.x = mv.fx + (mv.tx - mv.fx) * p;
        e.mesh.position.z = mv.fz + (mv.tz - mv.fz) * p;
        if (p >= 1) {
          e.moving = null;
          e.x = mv.tx; e.z = mv.tz;
          if (mv.hole) this.blockIntoHole(room, e);
        }
      }
    }
    // little animations (grow / shrink)
    room.anim = room.anim.filter((a) => {
      a.t += dt;
      const p = Math.min(1, a.t / a.dur);
      if (a.kind === 'grow') a.m.scale.setScalar(0.01 + p * 0.99);
      else if (a.kind === 'shrink') a.m.scale.setScalar(Math.max(0.01, 1 - p));
      else if (a.kind === 'lid') a.m.rotation.x = -1.9 * p;
      else if (a.kind === 'spin') a.m.rotation.y += dt * 0.8;
      else if (a.kind === 'sink') { a.m.position.y = -p * 1.2; a.m.scale.setScalar(1 - p * 0.5); }
      return p < 1;
    });
  },

  /** Try to push a block one tile. */
  pushBlock(room, e, d) {
    if (e.moving) return false;
    const v = DIRS[d];
    const c = e.c + v.dx, r = e.r + v.dz;
    if (!inGrid(c, r) || c === 0 || r === 0 || c === W - 1 || r === H - 1) return false;
    if (room.doorAt.has(keyOf(c, r))) return false;
    const ch = room.grid[r][c];
    const ok = FLOORISH.has(ch) || ch === 'o' || ((ch === 'x' || ch === 'y') && !pegUp(ch, this.sw(room.area)));
    if (!ok || room.occ.get(keyOf(c, r))) return false;
    if (room.enemies.some((en) => !en.dead && !en.fly && colOf(en.x) === c && rowOf(en.z) === r)) return false;
    room.occ.delete(keyOf(e.c, e.r));
    e.moving = { fx: e.x, fz: e.z, tx: tileX(c), tz: tileZ(r), t: 0, dur: 0.24, hole: ch === 'o' };
    e.c = c; e.r = r;
    room.occ.set(keyOf(c, r), e);
    this.sfx('push');
    return true;
  },

  blockIntoHole(room, e) {
    room.occ.delete(keyOf(e.c, e.r));
    room.ents = room.ents.filter((x) => x !== e);
    room.anim.push({ m: e.mesh, t: 0, dur: 0.35, kind: 'sink' });
    this.later(0.35, () => {
      e.mesh.parent?.remove(e.mesh);
      if (this.room !== room) return;
      room.grid[e.r][e.c] = '.';
      const patch = floorPatch(room.def.theme);
      patch.position.set(tileX(e.c), -0.02, tileZ(e.r));
      room.group.add(patch);
      this.sfx('land');
    });
  },
};
