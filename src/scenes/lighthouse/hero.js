import * as THREE from 'three';
import { toon } from '../../core/palette.js';
import { Character } from '../../core/character.js';
import { DIRS, TALL, tileX, tileZ, colOf, rowOf, inGrid, pegUp, ROPE_RANGE, THROW_RANGE } from './tiles.js';
import { makeSword, makeItem, mesh, cyl, cone, sph, tor } from './models.js';

// The hero: a bean in the solo profile's color and hat. Mixed into LighthouseEngine.
//   stick: walk (8 ways, faces 4 ways like the classics)   [A]: sword (hold and let go: spin)
//   [B]: talk / read / open / lift / throw                  [C]: equipped item (hold: item + map screen)
// Part 2: the Strong Gloves lift boulders with [B], bombs can be picked up and thrown, and with the
// swim fins you swim in deep water (no sword or items while swimming). Bombs and arrows: tools.js.
// Positions are room-local tiles; the mesh sits at room.origin + (x, z).

export const HERO_SCALE = 0.64;
const SPEED = 4.6;
const BOX = 0.29;
const SWING = 0.26;
const CHARGE = 0.75;
const YAW = { s: 0, e: Math.PI / 2, n: Math.PI, w: -Math.PI / 2 };

export const HeroMixin = {
  makeHero() {
    const p = this.host.players[0];
    const ch = new Character(p ? p.color : 0x4cc9f0, { hat: p ? p.hat : 1 });
    ch.group.scale.setScalar(HERO_SCALE);
    this.heroChar = ch;
    // sword on a pivot at hand height
    this.swordPivot = new THREE.Group();
    this.swordPivot.position.set(0, 0.5, 0.05);
    const sword = makeSword();
    sword.scale.setScalar(1.25);
    this.swordPivot.add(sword);
    ch.pivot.add(this.swordPivot);
    this.swordMesh = sword;
    // lantern at the belt (shown once you have it)
    this.beltLantern = makeItem('lantern');
    this.beltLantern.scale.setScalar(0.7);
    this.beltLantern.position.set(-0.45, 0.45, 0.1);
    ch.pivot.add(this.beltLantern);
    // the rope: a thin cylinder from the hero to the hook
    this.ropeLine = mesh(cyl(0.035, 0.035, 1, 6), toon(0xd8b27a), 0, 0, 0, false);
    this.ropeHook = mesh(cone(0.12, 0.28, 6), toon(0xdfe6f5), 0, 0, 0, false);
    this.ropeLine.visible = this.ropeHook.visible = false;
    // rings on the water while swimming
    this.swimRing = mesh(tor(0.42, 0.04, 6, 20), toon(0xffffff, { transparent: true, opacity: 0.75 }), 0, 0, 0, false);
    this.swimRing.rotation.x = Math.PI / 2;
    this.swimRing.visible = false;
    this.host.scene.add(ch.group, this.ropeLine, this.ropeHook, this.swimRing);
    // the shine on a charged sword
    this.chargeGlow = mesh(sph(0.16, 10, 8), toon(0xfff27a, { emissive: 0xaa8800 }), 0, 0, 0.95, false);
    this.chargeGlow.visible = false;
    sword.add(this.chargeGlow);
    this.hero = { x: 0, z: 0, face: 's', mode: 'walk', t: 0, inv: 0, kb: null, push: { vx: 0, vz: 0 }, pushT: 0, carry: null, charge: 0, warpArmed: false, moving: 0, swingHits: new Set(), swim: false };
  },

  placeHero(x, z, face) {
    const h = this.hero;
    h.x = x; h.z = z;
    if (face) h.face = face;
    h.mode = 'walk';
    h.kb = null;
    h.pushT = 0;
    h.charge = 0;
    this.dropCarry(true);
    h.swim = this.room ? this.room.grid[rowOf(z)]?.[colOf(x)] === '~' : false;
    this.heroChar.yaw = this.heroChar.targetYaw = YAW[h.face];
    this.syncHero(0);
  },

  syncHero(dt) {
    const h = this.hero;
    const ch = this.heroChar;
    const o = this.room ? this.room.origin : new THREE.Vector3();
    ch.group.position.set(o.x + h.x, (h.y || 0) + (h.swim ? -0.34 : 0), o.z + h.z);
    this.swimRing.visible = !!h.swim && h.mode !== 'dead';
    if (h.swim) {
      this.swimRing.position.set(o.x + h.x, 0.04, o.z + h.z);
      this.swimRing.scale.setScalar(1 + Math.sin(this.time * 5) * 0.08 + (h.moving ? 0.1 : 0));
    }
    if (h.mode !== 'get' && h.mode !== 'spin') ch.targetYaw = YAW[h.face];
    ch.update(dt, { moving: h.moving });
    ch.group.visible = h.inv > 0 && h.mode !== 'get' ? Math.floor(h.inv * 16) % 2 === 0 : true;
    this.swordMesh.visible = !!this.save.items.sword && !h.carry && h.mode !== 'get' && !h.swim;
    this.beltLantern.visible = !!this.save.items.lantern;
    // sword pose
    const sp = this.swordPivot;
    if (h.mode === 'swing') {
      const p = Math.min(1, h.t / SWING);
      sp.rotation.set(0, 1.7 - p * 3.4, 0);
      sp.position.set(0, 0.5, 0.05);
    } else if (h.mode === 'spin') {
      sp.rotation.set(0, 1.6, 0);
    } else if (h.mode === 'charge') {
      sp.rotation.set(0, 0.05, 0);
    } else {
      sp.rotation.set(0.9, -2.3, 0);
      sp.position.set(0.32, 0.45, 0.05);
    }
    if (h.mode === 'swing' || h.mode === 'spin' || h.mode === 'charge') sp.position.set(0, 0.5, 0.05);
    this.chargeGlow.visible = h.mode === 'charge' && h.charge >= CHARGE && Math.floor(this.time * 10) % 2 === 0;
    if (h.carry) {
      const m = h.carry.mesh;
      const lift = h.mode === 'lift' ? Math.min(1, h.t / 0.2) : 1;
      m.position.set(h.x + (h.carry.fromX - h.x) * (1 - lift), 0.85 * lift + 0.05, h.z + (h.carry.fromZ - h.z) * (1 - lift));
    }
  },

  // ---------- per frame ----------

  updateHero(dt, inp) {
    const h = this.hero;
    h.t += dt;
    if (h.inv > 0) h.inv -= dt;
    h.moving = 0;
    const ix = inp.x, iz = -inp.y;
    const mag = Math.min(1, Math.hypot(ix, iz));

    if (h.mode === 'fall') {
      const p = Math.min(1, h.t / 0.7);
      this.heroChar.group.scale.setScalar(HERO_SCALE * (1 - p * 0.9));
      this.heroChar.spin = p * 8;
      h.y = -p * 0.6;
      if (p >= 1) this.afterFall();
      return;
    }
    if (h.mode === 'get' || h.mode === 'dead') return;

    // knockback
    if (h.kb) {
      h.kb.t -= dt;
      this.moveHero(h.kb.vx * dt, h.kb.vz * dt, true);
      if (h.kb.t <= 0) h.kb = null;
      this.checkHeroTile();
      return;
    }
    // wind (the moth boss, Stormbeak, gusts on the cliffs); a rope pull holds on
    if (h.push.vx || h.push.vz) {
      if (h.mode !== 'rope') this.moveHero(h.push.vx * dt, h.push.vz * dt, true);
      h.push.vx = 0; h.push.vz = 0;
      if (h.mode !== 'rope') this.checkHeroTile();
      if (this.mode !== 'play' || h.mode === 'fall') return;
    }

    if (h.mode === 'rope') { this.updateRope(dt); return; }
    if (h.mode === 'lift') { if (h.t >= 0.2) { h.mode = 'walk'; } return; }

    if (h.mode === 'swing') {
      this.swordHits(false);
      if (h.t >= SWING) {
        if (inp.aHeld) { h.mode = 'charge'; h.charge = 0; } else h.mode = 'walk';
      }
      return;
    }
    if (h.mode === 'spin') {
      this.heroChar.spin = (h.t / 0.42) * Math.PI * 2;
      this.swordHits(true);
      if (h.t >= 0.42) { h.mode = 'walk'; this.heroChar.spin = 0; }
      return;
    }

    // walking (also while charging a spin, slower and facing locked)
    const charging = h.mode === 'charge';
    if (charging) {
      const before = h.charge;
      h.charge += dt;
      if (before < CHARGE && h.charge >= CHARGE) this.sfx('charged');
      if (!inp.aHeld) {
        if (h.charge >= CHARGE) { h.mode = 'spin'; h.t = 0; h.swingHits.clear(); this.sfx('spin'); } else h.mode = 'walk';
        return;
      }
    }
    if (mag > 0.15) {
      if (!charging) this.setFacing(ix, iz);
      const sp = (charging ? 2.3 : h.swim ? 2.9 : h.carry ? (h.carry.kind === 'boulder' ? 3.1 : 3.7) : SPEED) * mag;
      const len = Math.hypot(ix, iz) || 1;
      const res = this.moveHero((ix / len) * sp * dt * Math.min(1, mag / 0.9 + 0.1), (iz / len) * sp * dt * Math.min(1, mag / 0.9 + 0.1));
      h.moving = Math.min(1, mag);
      // pushing blocks / bumping doors in the facing direction
      const v = DIRS[h.face];
      const along = v.dx ? ix * v.dx : iz * v.dz;
      if ((res.x && v.dx) || (res.z && v.dz)) {
        if (along > 0.5) this.bump(dt); else h.pushT = 0;
      } else h.pushT = 0;
    } else h.pushT = 0;

    this.checkHeroTile();
    if (this.mode !== 'play') return;

    if (charging) return;
    if (h.swim) {
      // swimming: no sword or items, but you can still talk and read
      if (inp.b) this.interact();
      else if (inp.a || inp.useItem) this.notice('lh.swimming');
      return;
    }
    if (inp.a && this.save.items.sword) {
      if (h.carry) this.throwCarry();
      else { h.mode = 'swing'; h.t = 0; h.swingHits.clear(); this.sfx('swing'); }
      return;
    }
    if (inp.b) {
      if (h.carry) this.throwCarry();
      else this.interact();
      return;
    }
    if (inp.useItem && !h.carry) this.useItem();
  },

  setFacing(ix, iz) {
    const h = this.hero;
    const ax = Math.abs(ix), az = Math.abs(iz);
    const fx = ix > 0 ? 'e' : 'w', fz = iz > 0 ? 's' : 'n';
    if (ax > az + 0.15) h.face = fx;
    else if (az > ax + 0.15) h.face = fz;
    else if (h.face !== fx && h.face !== fz) h.face = az >= ax ? fz : fx;
  },

  /** Move with tile collision and a little corner help (slides you into doorways). */
  moveHero(dx, dz, noAssist = false) {
    const h = this.hero;
    const room = this.room;
    const out = { x: false, z: false };
    // A tile you already overlap (a door that just shut, a peg that rose) never traps you:
    // it only blocks moves that go deeper into it.
    const overlaps = (x, z, c, r) => Math.abs(x - tileX(c)) < 0.5 + BOX && Math.abs(z - tileZ(r)) < 0.5 + BOX;
    const blocked = (x, z, ddz) => this.boxHits(x, z, BOX, (c, r) => {
      if (!this.heroBlocked(room, c, r, ddz)) return false;
      if (!overlaps(h.x, h.z, c, r)) return true;
      const before = Math.abs(h.x - tileX(c)) + Math.abs(h.z - tileZ(r));
      const after = Math.abs(x - tileX(c)) + Math.abs(z - tileZ(r));
      return after < before;
    });
    if (dx) {
      if (!blocked(h.x + dx, h.z, 0)) h.x += dx;
      else {
        out.x = true;
        if (!noAssist && Math.abs(dz) < 1e-6) this.assist('z', dx);
      }
    }
    if (dz) {
      if (!blocked(h.x, h.z + dz, dz)) h.z += dz;
      else {
        out.z = true;
        if (!noAssist && Math.abs(dx) < 1e-6) this.assist('x', dz);
      }
    }
    return out;
  },

  /** Blocked while walking straight: if most of the hero fits the free lane, slide toward it. */
  assist(axis, dir) {
    const h = this.hero;
    const room = this.room;
    const s = Math.sign(dir);
    if (axis === 'z') {
      const c = colOf(h.x + s * (BOX + 0.15));
      const r = rowOf(h.z);
      const lane = tileZ(r);
      if (Math.abs(h.z - lane) < 0.42 && !this.heroBlocked(room, c, r)) {
        const step = Math.sign(lane - h.z) * Math.min(Math.abs(lane - h.z), 3 * (1 / 60));
        if (!this.boxHits(h.x, h.z + step, BOX, (cc, rr) => this.heroBlocked(room, cc, rr))) h.z += step;
      }
    } else {
      const r = rowOf(h.z + s * (BOX + 0.15));
      const c = colOf(h.x);
      const lane = tileX(c);
      if (Math.abs(h.x - lane) < 0.42 && !this.heroBlocked(room, c, r, s)) {
        const step = Math.sign(lane - h.x) * Math.min(Math.abs(lane - h.x), 3 * (1 / 60));
        if (!this.boxHits(h.x + step, h.z, BOX, (cc, rr) => this.heroBlocked(room, cc, rr))) h.x += step;
      }
    }
  },

  /** Walking into something in front: push a block, unlock a door, or say what it is. */
  bump(dt) {
    const h = this.hero;
    const room = this.room;
    const v = DIRS[h.face];
    const c = colOf(h.x + v.dx * 0.75), r = rowOf(h.z + v.dz * 0.75);
    const door = room.doorAt.get(`${c},${r}`);
    if (door && !door.open) {
      const type = door.door.type;
      if (type === 'key' && !this.save.doors[door.door.id]) {
        if ((this.save.keys[room.area] || 0) > 0) {
          this.save.keys[room.area]--;
          this.save.doors[door.door.id] = true;
          this.sfx('unlock');
          this.persist();
        } else this.notice('lh.locked');
      } else if (type === 'boss' && !this.save.doors[door.door.id]) {
        if (this.save.big[room.area]) {
          this.save.doors[door.door.id] = true;
          this.sfx('unlock');
          this.persist();
        } else this.notice('lh.bossLocked');
      } else if (type === 'bomb') this.notice('lh.crackedWall');
      return;
    }
    const e = this.entAt(room, c, r);
    if (e && e.t === 'block') {
      h.pushT += dt;
      h.moving = 0.3;
      if (h.pushT > 0.32) { this.pushBlock(room, e, h.face); h.pushT = 0; }
    }
  },

  /** After moving: screen edges, holes and stairs. */
  checkHeroTile() {
    const h = this.hero;
    if (h.x < -8.5) return this.startScroll('w');
    if (h.x > 8.5) return this.startScroll('e');
    if (h.z < -5.5) return this.startScroll('n');
    if (h.z > 5.5) return this.startScroll('s');
    const c = colOf(h.x), r = rowOf(h.z);
    if (!inGrid(c, r)) return;
    const ch = this.room.grid[r][c];
    if (ch === 'o' && Math.abs(h.x - tileX(c)) < 0.36 && Math.abs(h.z - tileZ(r)) < 0.36) { this.startFall(); return; }
    const swim = ch === '~';
    if (swim !== !!h.swim) {
      h.swim = swim;
      this.sfx('splash');
      this.puffAt(h.x, h.z, 0xbfe9ff, 12, 0.1);
      if (swim) { this.dropCarry(false); if (h.mode === 'charge') h.mode = 'walk'; }
    }
    const warp = this.room.ents.find((e) => e.t === 'warp' && e.c === c && e.r === r);
    if (!warp || (warp.under && this.room.grid[r][c] === warp.under)) { h.warpArmed = true; return; }
    if (!h.warpArmed) return;
    if (warp.lockBoss && this.room.enemies.some((en) => en.boss && !en.dead)) { h.warpArmed = false; this.notice('lh.noEscape'); return; }
    if (warp.need && !this.save.items[warp.need]) {
      h.warpArmed = false;
      this.say([{ who: 'you', key: 'lh.dark' }]);
      const v = DIRS[h.face];
      h.x -= v.dx * 0.6; h.z -= v.dz * 0.6;
      return;
    }
    this.startWarp(warp.to, warp.at, warp.face);
  },

  // ---------- sword ----------

  swordHits(spin) {
    const h = this.hero;
    const room = this.room;
    const v = DIRS[h.face];
    let inBox;
    if (spin) {
      inBox = (x, z, r = 0) => Math.hypot(x - h.x, z - h.z) < 1.45 + r;
    } else {
      if (h.t < 0.03 || h.t > 0.2) return;
      const cx = h.x + v.dx * 0.78, cz = h.z + v.dz * 0.78;
      const hx = v.dx ? 0.6 : 0.75, hz = v.dz ? 0.6 : 0.75;
      inBox = (x, z, r = 0) => Math.abs(x - cx) < hx + r && Math.abs(z - cz) < hz + r;
    }
    // bushes and grass
    const reach = spin ? 1 : 0;
    const hc = colOf(h.x), hr = rowOf(h.z);
    for (let r = hr - 1 - reach; r <= hr + 1 + reach; r++) {
      for (let c = hc - 1 - reach; c <= hc + 1 + reach; c++) {
        if (!inGrid(c, r) || h.swingHits.has(`t${c},${r}`)) continue;
        if (!inBox(tileX(c), tileZ(r), -0.1)) continue;
        const ch = room.grid[r][c];
        if (ch === 'b' || ch === 'g') { h.swingHits.add(`t${c},${r}`); this.cutTile(room, c, r); }
        const e = this.entAt(room, c, r);
        if (e && e.t === 'switch' && !h.swingHits.has('sw')) { h.swingHits.add('sw'); this.toggleSwitch(room); this.sparkAt(e.x, e.z); }
      }
    }
    // enemies
    for (const en of room.enemies) {
      if (en.dead || h.swingHits.has(en)) continue;
      if (en.fly && en.y > 1.25) continue;
      for (const part of en.parts()) {
        if (inBox(part.x, part.z, part.r * 0.8)) {
          h.swingHits.add(en);
          const res = en.hurt(spin ? 2 : 1, h.x, h.z, spin ? 'spin' : 'sword', part.part);
          if (res === 'clang') this.recoil();
          break;
        }
      }
    }
    // pebbles
    for (const p of room.projs) if (!p.dead && inBox(p.x, p.z, p.r)) { p.dead = true; this.sfx('clang'); this.sparkAt(p.x, p.z); }
  },

  recoil() {
    const v = DIRS[this.hero.face];
    this.hero.kb = { vx: -v.dx * 6, vz: -v.dz * 6, t: 0.1 };
  },

  // ---------- [B] ----------

  frontTile() {
    const h = this.hero;
    const v = DIRS[h.face];
    return { c: colOf(h.x + v.dx * 0.8), r: rowOf(h.z + v.dz * 0.8) };
  },

  /** What [B] would do right now (for the hint), and the target. */
  frontAction() {
    const room = this.room;
    const h = this.hero;
    if (h.carry) return { kind: 'throw' };
    const { c, r } = this.frontTile();
    const e = inGrid(c, r) ? this.entAt(room, c, r) : null;
    if (e) {
      if (e.t === 'npc') return { kind: 'talk', e };
      if (e.t === 'sign') return { kind: 'read', e };
      if (h.swim) return null;
      if (e.t === 'chest' && !e.opened) return { kind: 'open', e };
      if (e.t === 'pot' || e.t === 'rock') return { kind: 'lift', e };
      if (e.t === 'save' || e.t === 'lamp') return { kind: 'save', e };
      if (e.t === 'shop') return { kind: 'buy', e };
      if (e.t === 'well') return { kind: 'climb', e };
    }
    if (h.swim) return null;
    // a bomb on the ground in front (or under you) can be picked up
    const v = DIRS[h.face];
    const bomb = room.bombs.find((b) => b.state === 'ground' && (Math.hypot(b.x - (h.x + v.dx * 0.7), b.z - (h.z + v.dz * 0.7)) < 0.55 || Math.hypot(b.x - h.x, b.z - h.z) < 0.35));
    if (bomb) return { kind: 'lift', bomb };
    if (inGrid(c, r)) {
      const ch = room.grid[r][c];
      if (ch === 'R') return this.save.items.glove ? { kind: 'lift', tile: [c, r] } : { kind: 'note', key: 'lh.heavy' };
      if (ch === 'C') return { kind: 'note', key: 'lh.cracked' };
      if (ch === '*') return { kind: 'note', key: 'lh.thorns' };
    }
    return null;
  },

  interact() {
    const act = this.frontAction();
    if (!act) return;
    const h = this.hero;
    switch (act.kind) {
      case 'talk': this.talkTo(act.e); break;
      case 'read': this.say([{ who: 'sign', key: act.e.text }]); break;
      case 'open': this.openChest(act.e); break;
      case 'save': this.useSavePoint(act.e); break;
      case 'buy': this.buy(act.e); break;
      case 'note': this.say([{ who: 'you', key: act.key }]); break;
      case 'climb': this.startWarp(act.e.to, act.e.at, act.e.face); break;
      case 'lift': {
        if (act.bomb) {
          const b = act.bomb;
          b.state = 'carried';
          h.carry = { kind: 'bomb', mesh: b.mesh, bomb: b, fromX: b.x, fromZ: b.z };
        } else if (act.tile) {
          const [c, r] = act.tile;
          const m = this.liftTile(this.room, c, r);
          h.carry = { kind: 'boulder', mesh: m, fromX: tileX(c), fromZ: tileZ(r) };
        } else {
          const e = act.e;
          this.room.occ.delete(`${e.c},${e.r}`);
          this.room.ents = this.room.ents.filter((x) => x !== e);
          h.carry = { kind: e.t, mesh: e.mesh, has: e.has, fromX: e.x, fromZ: e.z };
        }
        h.mode = 'lift';
        h.t = 0;
        this.sfx(h.carry.kind === 'boulder' ? 'heave' : 'lift');
        break;
      }
      default: break;
    }
  },

  throwCarry() {
    const h = this.hero;
    const c = h.carry;
    if (!c) return;
    const v = DIRS[h.face];
    const sp = c.kind === 'boulder' ? 8.5 : 10;
    this.room.thrown.push({ kind: c.kind, has: c.has, bomb: c.bomb, mesh: c.mesh, x: h.x + v.dx * 0.3, z: h.z + v.dz * 0.3, vx: v.dx * sp, vz: v.dz * sp, dist: 0, y: 0.85 });
    if (c.bomb) c.bomb.state = 'flying';
    h.carry = null;
    this.sfx('whoosh');
  },

  dropCarry(silent) {
    const h = this.hero;
    if (!h.carry) return;
    const c = h.carry;
    h.carry = null;
    if (c.bomb && !silent && this.room && this.room.bombs.includes(c.bomb)) {
      // a bomb you were holding just drops at your feet
      c.bomb.state = 'ground';
      c.bomb.x = h.x; c.bomb.z = h.z;
      c.mesh.position.set(h.x, 0, h.z);
      return;
    }
    if (c.bomb && this.room) this.room.bombs = this.room.bombs.filter((b) => b !== c.bomb);
    c.mesh.parent?.remove(c.mesh);
    if (!silent) this.sfx('shatter');
  },

  /** Thrown pots and rocks fly 4 tiles, then shatter (over holes they just drop). */
  updateThrown(dt) {
    const room = this.room;
    room.thrown = room.thrown.filter((p) => {
      const step = Math.hypot(p.vx, p.vz) * dt;
      p.x += p.vx * dt;
      p.z += p.vz * dt;
      p.dist += step;
      p.y = 0.85 - (p.dist / THROW_RANGE) * 0.55;
      p.mesh.position.set(p.x, p.y, p.z);
      p.mesh.rotation.x += dt * 8;
      const c = colOf(p.x), r = rowOf(p.z);
      let hit = !inGrid(c, r);
      if (!hit) {
        const e = this.entAt(room, c, r);
        if (e && e.t === 'switch') { this.toggleSwitch(room); this.sparkAt(e.x, e.z); hit = true; } else if (this.projectileBlocked(p.x, p.z)) hit = true;
      }
      for (const en of room.enemies) {
        if (hit || en.dead) continue;
        if (en.fly && en.y > (en.highCatch || 1.2)) continue;
        for (const part of en.parts()) {
          if (Math.hypot(part.x - p.x, part.z - p.z) < part.r + 0.3) {
            if (p.kind !== 'bomb') en.hurt(p.kind === 'rock' || p.kind === 'boulder' ? 2 : 1, p.x - p.vx * 0.05, p.z - p.vz * 0.05, p.kind, part.part);
            hit = true;
            break;
          }
        }
      }
      if (p.bomb) {
        // a thrown bomb lands (or bumps into something) and keeps ticking there
        const b = p.bomb;
        b.x = p.x; b.z = p.z;
        if (!room.bombs.includes(b)) return false;
        if (hit || p.dist >= THROW_RANGE) {
          const bx = hit ? p.x - Math.sign(p.vx) * 0.45 : p.x, bz = hit ? p.z - Math.sign(p.vz) * 0.45 : p.z;
          const bc = colOf(bx), br = rowOf(bz);
          if (inGrid(bc, br) && ['o', '~'].includes(room.grid[br][bc])) {
            room.bombs = room.bombs.filter((x) => x !== b);
            p.mesh.parent?.remove(p.mesh);
            this.sfx(room.grid[br][bc] === '~' ? 'splash' : 'fall');
            this.puffAt(bx, bz, 0x9a94b2, 8);
            return false;
          }
          b.state = 'ground';
          b.x = bx; b.z = bz;
          p.mesh.position.set(bx, 0, bz);
          p.mesh.rotation.set(0, 0, 0);
          this.sfx('land');
          return false;
        }
        return true;
      }
      if (hit || p.dist >= THROW_RANGE) {
        p.mesh.parent?.remove(p.mesh);
        const overHole = inGrid(c, r) && ['o', '~'].includes(room.grid[r][c]);
        if (!overHole || hit) {
          this.sfx('shatter');
          this.puffAt(p.x - p.vx * 0.03, p.z - p.vz * 0.03, p.kind === 'pot' ? 0xd9805a : 0x9a94b2, p.kind === 'boulder' ? 18 : 10);
          if (p.kind === 'boulder') this.shake(0.12);
          const bx = p.x - Math.sign(p.vx) * 0.4, bz = p.z - Math.sign(p.vz) * 0.4;
          if (p.has) this.addPickup(room, p.has, bx, bz, { pop: true, persist: p.has === 'key' });
          else if (p.kind !== 'boulder' && Math.random() < 0.35) this.addPickup(room, Math.random() < 0.6 ? 'shell' : 'heart', bx, bz, { pop: true });
        } else this.sfx('splat');
        return false;
      }
      return true;
    });
  },

  // ---------- [C] items ----------

  useItem() {
    const item = this.save.equip;
    if (item === 'lantern' && this.save.items.lantern) this.useLantern();
    else if (item === 'grapple' && this.save.items.grapple) this.fireRope();
    else if (item === 'bombs' && this.save.items.bombs) this.placeBomb();
    else if (item === 'bow' && this.save.items.bow) this.shootArrow();
  },

  useLantern() {
    const h = this.hero;
    if (this.lanternCool > 0) return;
    this.lanternCool = 0.35;
    const room = this.room;
    const v = DIRS[h.face];
    const fx = h.x + v.dx * 0.9, fz = h.z + v.dz * 0.9;
    this.puffAt(fx, fz, 0xffa726, 10, 0.6);
    this.puffAt(fx, fz, 0xffe27a, 6, 0.6);
    this.sfx('flame');
    const targets = [this.frontTile(), { c: colOf(h.x) + v.dx, r: rowOf(h.z) + v.dz }];
    for (const { c, r } of targets) {
      if (!inGrid(c, r)) continue;
      const tc = room.torches.find((x) => x.c === c && x.r === r);
      if (tc) { this.lightTorch(room, tc); break; }
      if (room.grid[r][c] === '*') { this.burnTile(room, c, r); break; }
    }
    for (const en of room.enemies) {
      if (en.dead || (en.fly && en.y > (en.flameReach || 1.2))) continue;
      if (Math.hypot(en.x - fx, en.z - fz) < en.r + 0.55) en.hurt(1, h.x, h.z, 'flame');
    }
  },

  fireRope() {
    const h = this.hero;
    h.mode = 'rope';
    h.t = 0;
    const v = DIRS[h.face];
    this.rope = { dx: v.dx, dz: v.dz, dist: 0.3, state: 'out', carry: null, target: null };
    this.sfx('rope');
  },

  updateRope(dt) {
    const h = this.hero;
    const rp = this.rope;
    const room = this.room;
    const tipX = () => h.x + rp.dx * rp.dist, tipZ = () => h.z + rp.dz * rp.dist;
    if (rp.state === 'out') {
      rp.dist += 15 * dt;
      const x = tipX(), z = tipZ();
      const c = colOf(x), r = rowOf(z);
      const back = (snd = 'clang') => { rp.state = 'back'; if (snd) this.sfx(snd); };
      // the tip only checks a tile once it is past its middle in the throw direction
      if (!inGrid(c, r)) back();
      else {
        const ch = room.grid[r][c];
        const e = this.entAt(room, c, r);
        const door = room.doorAt.get(`${c},${r}`);
        const hookable = ch === '|' || (e && e.t === 'chest');
        if (hookable) {
          const ac = c - rp.dx, ar = r - rp.dz;
          const ach = inGrid(ac, ar) ? room.grid[ar][ac] : '#';
          const okLand = inGrid(ac, ar) && !this.heroBlocked(room, ac, ar) && ach !== 'o' && ach !== '~' && Math.hypot(tileX(ac) - h.x, tileZ(ar) - h.z) > 0.6;
          if (okLand) { rp.state = 'pull'; rp.target = { x: tileX(ac), z: tileZ(ar) }; rp.dist = Math.hypot(tileX(c) - h.x, tileZ(r) - h.z) - 0.4; this.sfx('hook'); this.sparkAt(tileX(c) - rp.dx * 0.45, tileZ(r) - rp.dz * 0.45); } else back();
        } else if (e && e.t === 'switch') { this.toggleSwitch(room); this.sparkAt(e.x, e.z); back(null); } else if (door && !door.open) back();
        else if (TALL.has(ch) || ((ch === 'x' || ch === 'y') && pegUp(ch, this.sw(room.area))) || (e && e.solid)) back();
      }
      if (rp.state === 'out') {
        for (const p of room.pickups) {
          if (!p.dead && Math.hypot(p.x - x, p.z - z) < 0.5) { rp.carry = p; rp.state = 'back'; this.sfx('hook'); break; }
        }
      }
      if (rp.state === 'out') {
        for (const en of room.enemies) {
          if (en.dead || (en.fly && en.y > 1.3)) continue;
          const part = en.parts().find((pt) => Math.hypot(pt.x - x, pt.z - z) < pt.r + 0.2);
          if (part) { en.hurt(1, h.x, h.z, 'rope', part.part); rp.state = 'back'; break; }
        }
      }
      if (rp.state === 'out' && rp.dist >= ROPE_RANGE) rp.state = 'back';
    } else if (rp.state === 'back') {
      rp.dist -= 20 * dt;
      if (rp.carry) { rp.carry.x = tipX(); rp.carry.z = tipZ(); rp.carry.mesh.position.set(rp.carry.x, 0, rp.carry.z); }
      if (rp.dist <= 0.2) {
        if (rp.carry) { rp.carry.x = h.x; rp.carry.z = h.z; }
        this.endRope();
      }
    } else if (rp.state === 'pull') {
      const tx = rp.target.x, tz = rp.target.z;
      const dx = tx - h.x, dz = tz - h.z;
      const d = Math.hypot(dx, dz);
      const step = 12 * dt;
      if (d <= step) { h.x = tx; h.z = tz; this.endRope(); } else {
        h.x += (dx / d) * step; h.z += (dz / d) * step;
        rp.dist = Math.max(0.3, rp.dist - step);
      }
      h.moving = 0;
    }
    this.syncRope();
  },

  endRope() {
    this.rope = null;
    this.hero.mode = 'walk';
    this.hero.t = 0;
    this.syncRope();
  },

  syncRope() {
    const rp = this.rope;
    const show = !!rp;
    this.ropeLine.visible = this.ropeHook.visible = show;
    if (!show) return;
    const h = this.hero;
    const o = this.room.origin;
    const x0 = o.x + h.x, z0 = o.z + h.z, y = 0.42;
    const x1 = x0 + rp.dx * rp.dist, z1 = z0 + rp.dz * rp.dist;
    this.ropeLine.position.set((x0 + x1) / 2, y, (z0 + z1) / 2);
    this.ropeLine.scale.set(1, Math.max(0.01, rp.dist), 1);
    this.ropeLine.rotation.set(rp.dz ? Math.PI / 2 : 0, 0, rp.dx ? Math.PI / 2 : 0);
    this.ropeHook.position.set(x1, y, z1);
    this.ropeHook.rotation.set(rp.dz ? (rp.dz > 0 ? Math.PI / 2 : -Math.PI / 2) : 0, 0, rp.dx ? (rp.dx > 0 ? -Math.PI / 2 : Math.PI / 2) : 0);
  },

  // ---------- getting hurt ----------

  hurtHero(dmg, sx, sz, kb = 8) {
    const h = this.hero;
    if (h.inv > 0 || this.mode !== 'play' || h.mode === 'fall' || h.mode === 'get' || h.mode === 'dead') return false;
    if (h.mode === 'rope' && this.rope?.state === 'pull') return false;
    this.save.hp -= dmg;
    h.inv = 1.1;
    const dx = h.x - sx, dz = h.z - sz;
    const d = Math.hypot(dx, dz) || 1;
    if (h.mode === 'rope') this.endRope();
    h.kb = { vx: (dx / d) * kb, vz: (dz / d) * kb, t: 0.17 };
    if (h.mode !== 'walk') h.mode = 'walk';
    this.dropCarry(false);
    this.sfx('hurt');
    this.shake(0.15);
    if (this.save.hp <= 0) this.heroDown();
    return true;
  },

  startFall() {
    const h = this.hero;
    if (h.mode === 'fall') return;
    this.dropCarry(true);
    h.mode = 'fall';
    h.t = 0;
    h.kb = null;
    this.sfx('fall');
  },

  afterFall() {
    const h = this.hero;
    this.heroChar.group.scale.setScalar(HERO_SCALE);
    this.heroChar.spin = 0;
    h.y = 0;
    this.save.hp -= 1;
    const e = this.room.entry;
    this.placeHero(e.x, e.z, e.face);
    h.inv = 1.2;
    this.sfx('hurt');
    if (this.save.hp <= 0) this.heroDown();
  },
};

export { BOX, SPEED };
