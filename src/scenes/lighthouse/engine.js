import * as THREE from 'three';
import { t } from '../../core/i18n.js';
import { say as speak, stopVoice } from '../../core/voice.js';
import { W, H, DIRS, tileX, tileZ, colOf, rowOf, inGrid } from './tiles.js';
import { ROOMS, AREAS, START, neighbor } from './rooms.js';
import { THEMES } from './build.js';
import { LhHud } from './hud.js';
import { sfx } from './sfx.js';
import { WorldMixin } from './world.js';
import { HeroMixin, HERO_SCALE } from './hero.js';
import { StoryMixin } from './story.js';
import { MenuMixin } from './menu.js';
import { ToolsMixin } from './tools.js';
import { FinaleMixin } from './finale.js';
import { makeBoss } from './foes.js';

// Lighthouse Caves engine: modes (title, play, dialog, item screen, cutscene, screen scroll, stairs
// fade, fainted, to be continued), the camera that frames one room at a time, light and darkness,
// enemies, pickups, puzzles and saving. Room building lives in world.js, the hero in hero.js,
// talking and items in story.js, the title / item screen in menu.js.
//
// Save: game.roster.progress.lighthouse (per solo profile), written on every room change, at beacon
// stones and when something important happens. Version 1 saves (part 1) are migrated on load.

export const SAVE_VERSION = 2;
const PITCH = THREE.MathUtils.degToRad(57);
const FOV = 30;
const HOLD_MENU = 0.32;

export function freshSave() {
  return {
    v: SAVE_VERSION, room: START.room, pos: START.at, face: START.face, hp: 6, maxHp: 6, shells: 0, pieces: 0,
    items: {}, equip: null, potion: 0, keys: {}, big: {}, maps: {}, compass: {}, crystals: 0, placed: 0, rewarded: 0,
    got: {}, doors: {}, solved: {}, bosses: {}, sw: {}, visited: {}, flags: {}, talk: {}, burnt: {},
    savePoint: { room: START.room, at: START.at, face: 's' }, tbcShown: false,
    // part 2
    blown: {}, gshells: 0, playTime: 0,
  };
}

/** Fill in fields a save from an older version does not have (part 1 saves continue into part 2). */
export function migrate(s) {
  const f = freshSave();
  for (const k of Object.keys(f)) if (s[k] === undefined) s[k] = f[k];
  if (s.v < 2) {
    // v1 -> v2: the Tidepools chest was a locked teaser; the shrine stone became a real gate.
    s.v = 2;
    if (s.room === 'o00' && s.pos && s.pos[1] <= 1) s.pos = [8, 5];
  }
  return s;
}

export const canContinue = (saved) => !!(saved && saved.v >= 1 && saved.v <= SAVE_VERSION && ROOMS[saved.room]);

const _v = new THREE.Vector3();
const _cam = new THREE.PerspectiveCamera();

export class LighthouseEngine {
  constructor(host) {
    this.host = host;
    this.game = host.game;
    this.time = 0;
    this.mode = 'title';
    this.hud = new LhHud(this.game);
    this.setupLights();
    const saved = this.game.roster.progress.lighthouse;
    this.hasSave = canContinue(saved);
    this.save = this.hasSave ? migrate(JSON.parse(JSON.stringify(saved))) : freshSave();
    this.makeHero();
    this.camTarget = new THREE.Vector3();
    this.camDist = 20;
    this.shakeT = 0;
    this.cHold = 0;
    this.cDown = false;
    this.lowBeep = 0;
    this.lastPlace = '';
    this.loadRoom(this.save.room, this.save.pos, this.save.face);
    this.showTitle();
  }

  // ---------- small helpers ----------

  sfx(name) { sfx(this.game.audio, name); }
  later(s, fn) { this.host.later(s, fn); }
  world(x, y, z) { return _v.set(this.room.origin.x + x, y, this.room.origin.z + z).clone(); }
  get area() { return this.room?.area; }

  poof(x, z, y = 0) {
    this.host.puffs.burst(this.world(x, y + 0.4, z), 0xffffff, { count: 16, size: 0.35, life: 0.6, speed: 3 });
    this.host.puffs.burst(this.world(x, y + 0.4, z), 0xd9d2ff, { count: 8, size: 0.25, life: 0.5, speed: 2 });
    this.sfx('poof');
  }
  puffAt(x, z, color, count = 10, y = 0.3) { this.host.puffs.burst(this.world(x, y, z), color, { count, size: 0.22, life: 0.5, speed: 2.2 }); }
  sparkAt(x, z) { this.host.confetti.burst(this.world(x, 0.6, z), 0, { count: 8, speed: 4, up: 2, colors: [0xfff27a, 0xffffff], life: 0.35, size: 0.08 }); }
  windAt(x, z, dx, dz) { this.host.puffs.burst(this.world(x + dx * 0.5, 0.5, z + dz * 0.5), 0xe9e2ff, { count: 2, size: 0.15, life: 0.4, speed: 3 }); }
  confettiAt(x, z) { this.host.confetti.burst(this.world(x, 3, z), 0, { count: 40, speed: 7, up: 4, colors: [0xff5d73, 0xffc93c, 0x3ddc97, 0x4cc9f0, 0x9b5de5], life: 1.6, gravity: -6, size: 0.18 }); }
  shake(a) { this.shakeT = Math.max(this.shakeT, a); }
  pushHero(vx, vz) { this.hero.push.vx += vx; this.hero.push.vz += vz; }

  dropLoot(x, z, en) {
    if (en.bossPart) return;
    const c = colOf(x), r = rowOf(z);
    if (!inGrid(c, r) || ['o', '~'].includes(this.room.grid[r][c])) return;
    const roll = Math.random();
    const s = this.save;
    const heartChance = s.hp < s.maxHp ? 0.28 : 0.08;
    if (roll < heartChance) this.addPickup(this.room, 'heart', x, z, { pop: true });
    else if (roll < heartChance + 0.3) this.addPickup(this.room, 'shell', x, z, { pop: true });
    else if (roll < heartChance + 0.38) this.addPickup(this.room, 'shell5', x, z, { pop: true });
  }

  persist() {
    this.game.roster.progress.lighthouse = JSON.parse(JSON.stringify(this.save));
    this.game.roster.save();
  }

  // ---------- lights ----------

  setupLights() {
    const scene = this.host.scene;
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x9ad48a, 1.5);
    this.sun = new THREE.DirectionalLight(0xfff2dd, 1.9);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const c = this.sun.shadow.camera;
    c.left = -13; c.right = 13; c.top = 11; c.bottom = -11; c.near = 1; c.far = 90;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.02;
    scene.add(this.hemi, this.sun, this.sun.target);
    this.points = [];
    for (let i = 0; i < 8; i++) {
      const l = new THREE.PointLight(0xffb36b, 0, 7, 1.2);
      scene.add(l);
      this.points.push(l);
    }
  }

  applyLighting(dt) {
    const room = this.room;
    const over = !!THEMES[room.def.theme].outdoor;
    const dark = !room.lit;
    const k = Math.min(1, dt * 5);
    // rain clouds dim the cliffs; the ending's dusk is warm and low
    const dim = room.def.rain ? 0.72 : this.dusk ? 0.55 : 1;
    this.hemi.intensity += ((dark ? 0.07 : (over ? 1.5 : 1.25) * dim) - this.hemi.intensity) * k;
    this.sun.intensity += ((dark ? 0.04 : (over ? 1.9 : 1.35) * dim) - this.sun.intensity) * k;
    this.sun.position.copy(this.camTarget).add(_v.set(-14, 34, 18));
    this.sun.target.position.copy(this.camTarget);
    const list = [];
    const o = room.origin;
    const h = this.hero;
    if (dark) {
      const lantern = !!this.save.items.lantern;
      list.push({ x: o.x + h.x, y: 1.3, z: o.z + h.z, i: lantern ? 9 : 2.2, d: lantern ? 6.5 : 2.6, c: 0xffd9a0 });
    }
    for (const tc of room.torches) if (tc.lit) list.push({ x: o.x + tc.x, y: 1.4, z: o.z + tc.z, i: dark ? 9 : 2.5, d: dark ? 6.5 : 4, c: 0xffa040 });
    for (const en of room.enemies) if (en.light && !en.dead && dark) list.push({ x: o.x + en.x, y: en.y + 0.6, z: o.z + en.z, i: en.lightI || 2.5, d: en.lightD || 3, c: en.lightC || 0xfff27a });
    for (const a of room.arrows) if (a.fire) list.push({ x: o.x + a.x, y: 0.6, z: o.z + a.z, i: dark ? 5 : 2, d: 3, c: 0xffa040 });
    if (dark) for (const e of room.ents) if (e.t === 'save') list.push({ x: o.x + e.x, y: 1.4, z: o.z + e.z, i: 2, d: 3, c: 0xffe27a });
    this.points.forEach((l, i) => {
      const s = list[i];
      if (!s) { l.intensity = 0; return; }
      l.position.set(s.x, s.y, s.z);
      l.intensity = s.i * (0.95 + Math.sin(this.time * 13 + i) * 0.05);
      l.distance = s.d;
      l.color.setHex(s.c);
    });
  }

  // ---------- camera ----------

  /** Where the camera looks and how far back it sits to show the whole room. */
  frameFor(room) {
    const g = room.grid;
    let c0 = W, c1 = -1, r0 = H, r1 = -1;
    for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) if (g[r][c] !== ' ') { c0 = Math.min(c0, c); c1 = Math.max(c1, c); r0 = Math.min(r0, r); r1 = Math.max(r1, r); }
    const cx = (tileX(c0) + tileX(c1)) / 2, cz = (tileZ(r0) + tileZ(r1)) / 2;
    const hw = (c1 - c0 + 1) / 2, hh = (r1 - r0 + 1) / 2;
    const cam = this.host.camera;
    _cam.fov = FOV;
    _cam.aspect = cam.aspect;
    _cam.near = 0.1; _cam.far = 400;
    _cam.updateProjectionMatrix();
    const pts = [[cx - hw, 0, cz + hh], [cx + hw, 0, cz + hh], [cx - hw, 1.3, cz - hh], [cx + hw, 1.3, cz - hh], [cx - hw, 0, cz - hh], [cx + hw, 0, cz - hh]];
    const fits = (d, oz) => {
      _cam.position.set(cx, Math.sin(PITCH) * d, cz + oz + Math.cos(PITCH) * d);
      _cam.lookAt(cx, 0, cz + oz);
      _cam.updateMatrixWorld();
      for (const [x, y, z] of pts) {
        _v.set(x, y, z).project(_cam);
        if (Math.abs(_v.x) > 0.99 || _v.y > 0.8 || _v.y < -0.97) return false;
      }
      return true;
    };
    // a little shift toward the camera keeps the room below the top bar
    const oz = -0.4;
    let lo = 4, hi = 80;
    for (let i = 0; i < 30; i++) { const mid = (lo + hi) / 2; if (fits(mid, oz)) hi = mid; else lo = mid; }
    return { target: new THREE.Vector3(room.origin.x + cx, 0, room.origin.z + cz + oz), dist: hi };
  }

  updateCamera(dt) {
    const cam = this.host.camera;
    if (cam.fov !== FOV) { cam.fov = FOV; cam.updateProjectionMatrix(); }
    if (this.shakeT > 0) this.shakeT = Math.max(0, this.shakeT - dt);
    const s = this.shakeT * 0.6;
    const sx = (Math.random() - 0.5) * s, sz = (Math.random() - 0.5) * s;
    const d = this.camDist;
    cam.position.set(this.camTarget.x + sx, Math.sin(PITCH) * d, this.camTarget.z + Math.cos(PITCH) * d + sz);
    cam.lookAt(this.camTarget.x + sx, 0, this.camTarget.z + sz);
  }

  reframe() {
    if (!this.room || this.mode === 'scroll') return;
    const f = this.frameFor(this.room);
    this.camTarget.copy(f.target);
    this.camDist = f.dist;
  }

  // ---------- rooms ----------

  loadRoom(id, at, face) {
    this.loadRoomAt(id, tileX(at[0]), tileZ(at[1]), face);
  }

  loadRoomAt(id, x, z, face) {
    const def = ROOMS[id];
    if (this.room) this.unloadRoom(this.room);
    this.room = this.makeRoom(id, new THREE.Vector3(def.gx * W, 0, def.gy * H));
    [x, z] = this.safeSpot(this.room, x, z);
    this.placeHero(x, z, face || 's');
    this.hero.warpArmed = false;
    this.room.entry = { x, z, face: face || 's' };
    this.host.scene.background = new THREE.Color(THEMES[def.theme].bg);
    this.reframe();
  }

  /** The nearest tile the hero can stand on (a save from an older map could point into a wall). */
  safeSpot(room, x, z) {
    const c0 = colOf(x), r0 = rowOf(z);
    const ok = (c, r) => inGrid(c, r) && !this.heroBlocked(room, c, r, 1) && room.grid[r][c] !== 'o' && (room.grid[r][c] !== '~' || this.save.items.fins);
    if (!inGrid(c0, r0) || ok(c0, r0)) return [x, z];
    for (let d = 1; d < 9; d++) {
      for (let r = r0 - d; r <= r0 + d; r++) for (let c = c0 - d; c <= c0 + d; c++) if (ok(c, r)) return [tileX(c), tileZ(r)];
    }
    return [x, z];
  }

  startScroll(d) {
    if (this.mode !== 'play') return;
    const nb = neighbor(this.room.id, d);
    const v = DIRS[d];
    if (!nb) { this.hero.x = THREE.MathUtils.clamp(this.hero.x, -8.4, 8.4); this.hero.z = THREE.MathUtils.clamp(this.hero.z, -5.4, 5.4); return; }
    this.dropCarry(true);
    if (this.rope) this.endRope();
    const from = this.room;
    const next = this.makeRoom(nb, from.origin.clone().add(new THREE.Vector3(v.dx * W, 0, v.dz * H)));
    const h = this.hero;
    h.x -= v.dx * W;
    h.z -= v.dz * H;
    h.kb = null;
    h.mode = 'walk';
    this.room = next;
    const to = this.frameFor(next);
    this.scrollState = {
      from, t: 0, dur: 0.75, camFrom: this.camTarget.clone(), distFrom: this.camDist, camTo: to.target, distTo: to.dist,
      sx: h.x, sz: h.z, ex: h.x + v.dx * 1.45, ez: h.z + v.dz * 1.45,
    };
    // keep the hero on the free lane of a doorway
    if (from.def.area !== 'over' && AREAS[next.area].dungeon) {
      if (v.dx) { this.scrollState.sz = this.scrollState.ez = THREE.MathUtils.clamp(h.z, -0.05, 0.05) || 0; }
      if (v.dz) { this.scrollState.sx = this.scrollState.ex = THREE.MathUtils.clamp(h.x, -0.05, 0.05) || 0; }
    }
    this.mode = 'scroll';
    this.host.scene.background = new THREE.Color(THEMES[next.def.theme].bg);
  }

  updateScroll(dt) {
    const s = this.scrollState;
    s.t += dt;
    const p = Math.min(1, s.t / s.dur);
    const e = p * p * (3 - 2 * p);
    this.camTarget.lerpVectors(s.camFrom, s.camTo, e);
    this.camDist = s.distFrom + (s.distTo - s.distFrom) * e;
    const h = this.hero;
    h.x = s.sx + (s.ex - s.sx) * p;
    h.z = s.sz + (s.ez - s.sz) * p;
    h.moving = 1;
    this.syncHero(dt);
    if (p >= 1) {
      this.unloadRoom(s.from);
      this.scrollState = null;
      this.mode = 'play';
      this.room.entry = { x: h.x, z: h.z, face: h.face };
      this.onEnterRoom('scroll');
    }
  }

  startWarp(to, at, face) {
    if (this.rope) this.endRope();
    this.dropCarry(true);
    this.warpState = { to, at, face, t: 0, phase: 'out' };
    this.mode = 'warp';
    this.hud.setDark(true);
    this.sfx('whoosh');
  }

  updateWarp(dt) {
    const w = this.warpState;
    w.t += dt;
    if (w.phase === 'out' && w.t >= 0.4) {
      this.loadRoom(w.to, w.at, w.face);
      w.phase = 'in';
      w.t = 0;
      this.hud.setDark(false);
    } else if (w.phase === 'in' && w.t >= 0.3) {
      this.mode = 'play';
      this.onEnterRoom('warp');
    }
    this.syncHero(dt);
  }

  restartRoom() {
    const e = this.room.entry;
    this.loadRoomAt(this.room.id, e.x, e.z, e.face);
    this.room.entry = { ...e };
    this.mode = 'play';
    this.onEnterRoom('restart');
  }

  onEnterRoom() {
    const room = this.room;
    const s = this.save;
    const h = this.hero;
    s.room = room.id;
    s.pos = [THREE.MathUtils.clamp(colOf(h.x), 0, W - 1), THREE.MathUtils.clamp(rowOf(h.z), 0, H - 1)];
    s.face = h.face;
    s.visited[room.id] = true;
    this.persist();
    this.playAreaMusic();
    const place = room.area === 'over' || room.area === 'in' ? t(room.def.name) : t(AREAS[room.area].name);
    if (place !== this.lastPlace) { this.hud.showPlace(place); this.lastPlace = place; }
    if (room.id === 'h_keeper' && !s.flags.intro) this.cutscene(this.introScene);
    else if (room.id === 'h_light' && s.crystals > (s.placed || 0)) this.cutscene(this.placeScene);
    else if (room.id === 'h_light' && (s.placed || 0) >= 2 && !s.flags.act2 && !s.bosses.d3_boss) this.cutscene(this.act2Scene);
  }

  playAreaMusic() {
    const room = this.room;
    const bossAlive = room.bossSpawned && room.enemies.some((e) => e.boss && !e.dead);
    const song = bossAlive ? (room.id === 'h_top' ? 'lhFinal' : 'lhBoss') : room.def.music || (room.def.theme === 'cliff' ? 'lhStorm' : AREAS[room.area].music);
    this.game.audio.playMusic(song);
  }

  // ---------- starting ----------

  newGame() {
    const keep = this.save.rewarded || 0;
    const tbc = !!this.save.tbcRewarded;
    const end = !!this.save.endRewarded, full = !!this.save.fullRewarded;
    this.save = freshSave();
    this.save.rewarded = keep;
    this.save.tbcRewarded = tbc;
    this.save.endRewarded = end;
    this.save.fullRewarded = full;
    this.hasSave = true;
    this.lastPlace = '';
    this.loadRoom(START.room, START.at, START.face);
    this.mode = 'play';
    this.onEnterRoom('new');
  }

  continueGame() {
    this.save.hp = this.save.maxHp;
    this.mode = 'play';
    this.lastPlace = '';
    this.onEnterRoom('continue');
  }

  // ---------- fainting ----------

  heroDown() {
    const s = this.save;
    if (s.potion) {
      s.potion = 0;
      s.hp = s.maxHp;
      this.game.ui.toast(t('lh.tonicUsed'), 2000);
      speak(t('lh.tonicUsed'));
      this.sfx('save');
      this.hero.inv = 2;
      this.persist();
      return;
    }
    s.hp = 0;
    this.mode = 'dead';
    this.deadT = 0;
    this.hero.mode = 'dead';
    if (this.rope) this.endRope();
    this.game.audio.stopMusic();
    this.sfx('dizzy');
    this.hud.setBig({ t1: t('lh.fainted'), t2: t('lh.faintedSub') });
    speak(t('lh.fainted'));
  }

  updateDead(dt) {
    this.deadT += dt;
    const p = Math.min(1, this.deadT / 1.2);
    this.heroChar.spin = p * 10;
    this.heroChar.group.scale.setScalar(HERO_SCALE * (1 - p * 0.4));
    this.syncHero(dt);
    if (this.deadT > 2.2 && !this.deadFade) { this.deadFade = true; this.hud.setDark(true); }
    if (this.deadT > 2.65) {
      this.deadFade = false;
      const s = this.save;
      s.hp = s.maxHp;
      this.heroChar.spin = 0;
      this.heroChar.group.scale.setScalar(HERO_SCALE);
      this.hud.setBig(null);
      this.hud.setDark(false);
      const sp = s.savePoint || { room: START.room, at: START.at, face: 's' };
      this.lastPlace = '';
      this.loadRoom(sp.room, sp.at, sp.face);
      this.hero.inv = 1.5;
      this.mode = 'play';
      this.onEnterRoom('respawn');
    }
  }

  // ---------- input ----------

  readInput(dt) {
    const devs = this.host.players.map((p) => this.host.input(p)).filter(Boolean);
    const inp = { x: 0, y: 0, a: false, b: false, c: false, cPress: false, aHeld: false, sx: 0, sy: 0, useItem: false };
    for (const d of devs) {
      if (!inp.x && !inp.y && (d.x || d.y)) { inp.x = d.x; inp.y = d.y; }
      inp.a ||= d.aPressed;
      inp.b ||= d.bPressed;
      inp.c ||= d.cPressed;
      inp.aHeld ||= d.a;
      inp.sx ||= d.stepX || 0;
      inp.sy ||= d.stepY || 0;
    }
    inp.cPress = inp.c;
    const cHeld = devs.some((d) => d.c);
    // [C]: a tap uses the item, holding opens the item + map screen
    if (inp.c && this.mode === 'play') { this.cDown = true; this.cHold = 0; }
    if (this.cDown) {
      if (cHeld && this.mode === 'play') {
        this.cHold += dt;
        if (this.cHold >= HOLD_MENU) { this.cDown = false; inp.openMenu = true; }
      } else {
        if (this.cHold < HOLD_MENU && this.mode === 'play') inp.useItem = true;
        this.cDown = false;
      }
    }
    return inp;
  }

  // ---------- main loop ----------

  update(dt) {
    this.time += dt;
    if (this.mode !== 'title') this.save.playTime = (this.save.playTime || 0) + dt;
    const inp = this.readInput(dt);
    if (this.noticeCool > 0) this.noticeCool -= dt;
    if (this.lanternCool > 0) this.lanternCool -= dt;
    switch (this.mode) {
      case 'title': this.updateTitle(inp, dt); this.idleWorld(dt); break;
      case 'play': this.updatePlay(dt, inp); break;
      case 'dialog': this.updateDialog(inp, dt); this.idleWorld(dt); break;
      case 'menu': this.updateMenu(inp, dt); break;
      case 'cut': this.updateCut(dt); this.idleWorld(dt); break;
      case 'scroll': this.updateScroll(dt); break;
      case 'warp': this.updateWarp(dt); break;
      case 'dead': this.updateDead(dt); this.idleWorld(dt); break;
      case 'tbc': this.updateTbc(inp, dt); this.idleWorld(dt); break;
      case 'credits': this.updateCredits(inp, dt); this.idleWorld(dt); break;
      default: break;
    }
    this.updateCamera(dt);
    this.applyLighting(dt);
    this.updateHud();
    this.hud.tick(dt);
  }

  /** The world breathes while a dialog or menu is up, but nothing moves or counts down. */
  idleWorld(dt) {
    const room = this.room;
    room.time += dt;
    for (const w of room.waves) w.position.x = w.userData.x0 + Math.sin(room.time * 1.2 + w.userData.phase) * 0.12;
    for (const e of room.ents) if (e.t === 'npc' && e.char) e.char.update(dt, { moving: 0 });
    for (const tc of room.torches) if (tc.lit) tc.mesh.userData.flame.scale.y = 1 + Math.sin(room.time * 23 + tc.r) * 0.12;
    if (room.rain) for (const m of room.rain.drops) { m.position.y -= dt * 13; if (m.position.y < 0) m.position.y += 7; }
    this.updatePickups(dt, false);
    this.updateCutActors?.(dt);
    this.syncHero(dt);
  }

  updatePlay(dt, inp) {
    const room = this.room;
    this.updateRoomLogic(room, dt);
    if (inp.openMenu) { this.openMenu(); return; }
    this.updateHero(dt, inp);
    if (this.mode !== 'play' || this.room !== room) { if (this.mode !== 'scroll') this.syncHero(dt); return; }
    const h = this.hero;
    // bosses wake up once you are inside
    const inside = Math.abs(h.x) < 7.15 && Math.abs(h.z) < 4.15;
    if (room.bossSpec && !room.bossSpawned && inside) {
      room.bossSpawned = true;
      const b = makeBoss(this, room.bossSpec.kind, tileX(room.bossSpec.c), tileZ(room.bossSpec.r));
      this.addEnemy(b);
      this.playAreaMusic();
      if (room.bossSpec.kind === 'moth') this.later(5, () => { if (this.room === room && !room.solved) this.hintOnce('lh.moth.hint'); });
      if (room.bossSpec.kind === 'murk') this.cutscene(this.murkIntro);
    }
    if (room.def.trap && !room.solved && !room.trapActive && inside) {
      room.trapActive = true;
      this.sfx('door');
    }
    // enemies
    for (const en of room.enemies) {
      if (en.dead) continue;
      en.update(dt);
      if (en.dead || !en.touch || h.mode === 'fall') continue;
      const hit = en.touches ? en.touches(h.x, h.z) : Math.hypot(en.x - h.x, en.z - h.z) < en.r + 0.27 && (!en.fly || en.y < 0.95);
      if (hit) this.hurtHero(en.dmg, en.x, en.z);
    }
    for (const en of room.enemies) if (en.dead && en.group.parent) { en.group.parent.remove(en.group); }
    room.enemies = room.enemies.filter((en) => !en.dead || en.bossPart);
    // projectiles
    for (const p of room.projs) {
      p.update(dt);
      if (!p.dead && Math.hypot(p.x - h.x, p.z - h.z) < p.r + 0.3) {
        p.dead = true;
        this.hurtHero(p.dmg, p.x - Math.sign(p.vx) * 0.5, p.z - Math.sign(p.vz) * 0.5, 4.5);
      }
      if (p.dead) p.remove();
    }
    room.projs = room.projs.filter((p) => !p.dead);
    this.updateThrown(dt);
    this.updateBombs(dt);
    this.updateArrows(dt);
    this.updatePickups(dt, true);
    this.checkSolve(room);
    // low health beep
    if (this.save.hp <= 2 && this.save.maxHp > 2) {
      this.lowBeep -= dt;
      if (this.lowBeep <= 0) { this.lowBeep = 1.1; this.sfx('lowhp'); }
    }
    this.syncHero(dt);
  }

  updatePickups(dt, collect) {
    const room = this.room;
    const h = this.hero;
    for (const p of room.pickups) {
      if (p.dead) continue;
      p.t += dt;
      if (p.pop > 0) { p.pop -= dt; }
      const y = p.pop > 0 ? Math.sin((1 - p.pop / 0.5) * Math.PI) * 0.8 : 0;
      p.inner.position.y = 0.35 + y + Math.sin(p.t * 3) * 0.06;
      p.inner.rotation.y += dt * 1.6;
      if (!collect) continue;
      if (p.life !== Infinity) {
        p.life -= dt;
        p.mesh.visible = p.life > 2 || Math.floor(p.life * 8) % 2 === 0;
        if (p.life <= 0) { p.dead = true; continue; }
      }
      if (h.mode !== 'get' && h.mode !== 'fall' && h.mode !== 'dead' && Math.hypot(p.x - h.x, p.z - h.z) < 0.55) {
        p.dead = true;
        this.giveItem(p.item, { id: p.id });
      }
    }
    for (const p of room.pickups) if (p.dead && p.mesh.parent) p.mesh.parent.remove(p.mesh);
    room.pickups = room.pickups.filter((p) => !p.dead);
  }

  checkSolve(room) {
    const def = room.def;
    if (room.solved || !def.solve) return;
    let ok = false;
    if (def.solve === 'clear') ok = room.time > 0.4 && room.enemies.every((e) => e.dead);
    else if (def.solve === 'plates') ok = room.plates.length > 0 && room.plates.every((p) => p.pressed);
    else if (def.solve === 'torches') ok = room.torches.length > 0 && room.torches.every((tc) => tc.lit);
    else if (def.solve === 'boss') ok = room.bossSpawned && !room.enemies.some((e) => e.bossPart && !e.dead);
    else if (def.solve === 'eyes') ok = room.eyes.length > 0 && room.eyes.every((e) => e.hit);
    if (ok) this.solveRoom(room);
  }

  solveRoom(room) {
    const def = room.def;
    room.solved = true;
    room.trapActive = false;
    this.save.solved[room.id] = true;
    if (def.lightOnSolve) room.lit = true;
    for (const tc of room.torches) tc.timer = 0;
    if (def.solve === 'boss') {
      this.save.bosses[room.id] = true;
      for (const en of room.enemies) if (!en.dead) { en.dead = true; this.poof(en.x, en.z, en.y); }
      this.victory(room);
    }
    this.spawnReward(room, true);
    this.later(0.25, () => this.sfx('secret'));
    this.persist();
    this.playAreaMusic();
  }

  /** A big boss is down: a heart container and a lamp crystal appear. */
  bossDown(en) {
    this.poof(en.x, en.z, en.y);
    for (let i = 0; i < 5; i++) this.later(i * 0.15, () => this.poof(en.x + (Math.random() - 0.5) * 1.5, en.z + (Math.random() - 0.5) * 1.5, 0.5));
    this.shake(0.4);
    this.sfx('roar');
  }

  victory(room) {
    const v = room.def.victory;
    if (!v) return;
    if (v.finale) { this.later(1.2, () => { if (this.room === room) this.cutscene(this.endingScene); }); return; }
    this.later(0.9, () => {
      if (this.room !== room) return;
      if (!this.save.got[`${room.id}.heart`]) this.addPickup(room, 'container', tileX(6), tileZ(5), { id: `${room.id}.heart`, persist: true, pop: true });
      this.addPickup(room, 'crystal', tileX(10), tileZ(5), { id: `${room.id}.crystal`, persist: true, pop: true });
      this.sfx('fanfare');
    });
  }

  // ---------- HUD ----------

  updateHud() {
    const s = this.save;
    const area = this.room.area;
    const show = this.mode !== 'title' && this.mode !== 'tbc' && this.mode !== 'credits';
    this.hud.setTop({
      hp: Math.max(0, s.hp), maxHp: s.maxHp, shells: s.shells, dungeon: !!AREAS[area].dungeon, keys: s.keys[area] || 0, bigkey: !!s.big[area],
      sword: !!s.items.sword, equip: s.equip, potion: s.potion, swim: !!this.hero.swim,
    }, { visible: show, player: this.host.players[0] });
    if (this.mode === 'play') {
      const hints = [];
      if (s.items.sword && !this.hero.swim) hints.push(['A', this.hero.carry ? 'lh.h.throw' : 'lh.h.sword']);
      const act = this.frontAction();
      if (act && act.kind !== 'note') hints.push(['B', `lh.h.${act.kind}`]);
      hints.push(['C', s.equip ? 'lh.h.itemMenu' : 'lh.h.menu']);
      this.hud.setHints(hints, this.host.players[0]);
    } else if (this.mode === 'dialog') {
      this.hud.setHints([['A', 'lh.h.next']], this.host.players[0]);
    } else this.hud.setHints([], this.host.players[0]);
  }

  onLanguage() {
    this.hud.cache = {};
    if (this.mode === 'title') this.renderTitle();
    if (this.mode === 'menu') this.renderMenu();
    if (this.mode === 'dialog' && this.dlg) this.showLine();
  }

  dispose() {
    stopVoice();
    this.dusk = false;
    this.hud.dispose();
    if (this.room) this.unloadRoom(this.room);
  }
}

Object.assign(LighthouseEngine.prototype, WorldMixin, HeroMixin, StoryMixin, MenuMixin, ToolsMixin, FinaleMixin);
