import * as THREE from 'three';
import { t, buttonText } from '../../core/i18n.js';
import { esc } from '../../core/ui.js';
import { say as speak, voiceOn, isSpeaking, stopVoice } from '../../core/voice.js';
import { Character } from '../../core/character.js';
import { skyTexture } from '../../core/world.js';
import { AdvUI } from './ui.js';
import { ITEMS, itemIcon, combineResponse } from './items.js';
import { makeSpoon } from './props.js';

// The point-and-click engine: rooms, hotspots, the pointer, Pip walking, verbs, inventory and a
// tiny SCUMM-like script runner.
//
// Scripts are generator functions `function* (s, ctx)`. They run synchronously inside update(), so
// they pause with the game and work with game.simulate(). A script yields commands and gets
// their result back:
//   yield s.say('pip', 'key')          speech bubble (skippable, read aloud), waits for it
//   yield s.walk(x, z)                 Pip walks there (s.walkTo('hotspotId') for a hotspot)
//   yield s.wait(seconds)
//   const i = yield s.choose([{ text, used }], head)   dialog choice, returns the index
//   yield s.goRoom('room', 'entry')    wipe to another room
//   yield* s.lines([['pip', 'k1'], ['grum', 'k2'], (s) => ...])
// Instant helpers: s.flag/setFlag, s.has/give/drop, s.face, s.tween, s.sfx, s.float, s.hint.
//
// Rooms are data (see rooms.js): build(s, group) makes the diorama and returns props; walk is a
// list of rectangles [x0, z0, x1, z1]; hotspots have a name, a hit box, a stand point and
// handlers per verb. Saving: game.roster.progress.adventure = { room, inventory, flags, ... }.

export const SAVE_VERSION = 1;
const PIP_SPEED = 3.3;
const PIP_SCALE = 0.9;

const _ray = new THREE.Raycaster();
const _ndc = new THREE.Vector2();
const _v = new THREE.Vector3();
const _box = new THREE.Box3();
const _plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

const EASE = {
  linear: (p) => p,
  inOut: (p) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2),
  out: (p) => 1 - (1 - p) * (1 - p),
  in: (p) => p * p,
  back: (p) => 1 + 2.7 * Math.pow(p - 1, 3) + 1.7 * Math.pow(p - 1, 2),
};

const GET = {
  x: (o) => o.position.x, y: (o) => o.position.y, z: (o) => o.position.z,
  rx: (o) => o.rotation.x, ry: (o) => o.rotation.y, rz: (o) => o.rotation.z,
  s: (o) => o.scale.x, sx: (o) => o.scale.x, sy: (o) => o.scale.y, sz: (o) => o.scale.z,
};
const SET = {
  x: (o, v) => { o.position.x = v; }, y: (o, v) => { o.position.y = v; }, z: (o, v) => { o.position.z = v; },
  rx: (o, v) => { o.rotation.x = v; }, ry: (o, v) => { o.rotation.y = v; }, rz: (o, v) => { o.rotation.z = v; },
  s: (o, v) => { o.scale.setScalar(v); }, sx: (o, v) => { o.scale.x = v; }, sy: (o, v) => { o.scale.y = v; }, sz: (o, v) => { o.scale.z = v; },
};

export function freshSave(room) {
  return { v: SAVE_VERSION, room, inventory: ['spoon'], flags: {}, comebacks: [], pos: null, done: false };
}

const isIter = (x) => x && typeof x.next === 'function';

export class AdventureEngine {
  constructor(host, { rooms, start, intro }) {
    this.host = host;
    this.game = host.game;
    this.rooms = rooms;
    this.startRoom = start;
    this.introScript = intro;
    this.ui = new AdvUI(this.game);
    this.mode = 'title';
    this.time = 0;
    this.tweens = [];
    this.attached = [];
    this.hover = { hs: null, slot: -1 };
    this.held = null;
    this.pending = null;
    this.walker = null;
    this.script = null;
    this.bubbleCmd = null;
    this.helpTimer = 0;
    this.invSel = 0;
    this.holdTime = 0;
    this.pointer = { x: window.innerWidth / 2, y: window.innerHeight * 0.45 };
    this.mouse = { active: false, left: false, right: false };

    const saved = this.game.roster.progress.adventure;
    this.hasSave = !!(saved && saved.v === SAVE_VERSION && this.rooms[saved.room]);
    this.save = this.hasSave ? JSON.parse(JSON.stringify(saved)) : freshSave(start);
    this.save.flags ||= {};
    this.save.inventory ||= [];
    this.save.comebacks ||= [];

    this.makePip();
    this.bindMouse();
    this.loadRoom(this.save.room, this.save.pos ? null : 'start');
    this.showTitle();
  }

  // ---------- Pip ----------

  makePip() {
    const p = this.host.players[0];
    const color = p ? p.color : 0x4cc9f0;
    this.pipChar = new Character(color, { hat: p ? p.hat : 0 });
    this.pip = this.pipChar.group;
    this.pip.scale.setScalar(PIP_SCALE);
    // The wooden pirate spoon, held at the side
    const spoon = makeSpoon();
    spoon.scale.setScalar(0.75);
    spoon.position.set(0.5, 0.42, 0.12);
    spoon.rotation.set(0.2, 0, -0.35);
    this.pipChar.pivot.add(spoon);
    this.pipSpoon = spoon;
    // Things sitting on Pip's head (the seagull) go here, above the hat
    this.headSlot = new THREE.Group();
    const hatH = new THREE.Box3().setFromObject(this.pipChar.hat).getSize(_v).y;
    this.headSlot.position.y = this.pipChar.hatSlot.position.y + (this.pipChar.hat.children.length ? Math.max(0.1, hatH - 0.12) : -0.05);
    this.pipChar.pivot.add(this.headSlot);
    this.host.scene.add(this.pip);
    this.pipChar.faceSide(1);
  }

  /** Top of Pip's head (with hat and passengers) in world space. */
  pipHead(out = new THREE.Vector3()) {
    const extra = this.headSlot.children.length ? 0.55 : 0;
    return this.headSlot.localToWorld(out.set(0, 0.25 + extra, 0));
  }

  /** Put something on Pip's head (removed again when the room unloads). */
  attachToHead(obj) {
    this.headSlot.add(obj);
    this.attached.push(obj);
  }

  // ---------- rooms ----------

  loadRoom(id, entry) {
    this.unloadRoom();
    const def = this.rooms[id];
    const group = new THREE.Group();
    this.host.scene.add(group);
    this.room = { id, def, group, props: {}, time: 0 };
    this.save.room = id;
    if (def.sky) {
      this.host.scene.background?.dispose?.();
      this.host.scene.background = skyTexture(def.sky[0], def.sky[1]);
    }
    def.lights?.(this, this.host.lights);
    this.room.props = def.build(this, group) || {};
    this.actors = {
      pip: { name: 'adv.who.pip', css: this.host.players[0]?.css || '#4cc9f0', voice: { pitch: 1.35, rate: 1.05 }, head: (v) => this.pipHead(v) },
      narr: { narrator: true, voice: { pitch: 1, rate: 0.95 } },
      ...(def.actors?.(this, this.room.props) || {}),
    };
    const at = entry ? def.entries[entry] : null;
    const pos = at ? [at.x, at.z] : this.save.pos || [def.entries.start.x, def.entries.start.z];
    const [x, z] = this.clampWalk(pos[0], pos[1]);
    this.pip.position.set(x, 0, z);
    this.pipChar.faceSide(at?.face ?? 1);
    this.walker = null;
    this.pending = null;
    this.frame();
  }

  unloadRoom() {
    if (!this.room) return;
    for (const o of this.attached) o.parent?.remove(o);
    const disposeTree = (root) => root.traverse((o) => {
      if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose();
      const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      for (const m of mats) {
        if (m.userData.shared) continue;
        if (m.map && !m.map.userData.shared) m.map.dispose();
        m.dispose();
      }
    });
    for (const o of this.attached) disposeTree(o);
    this.attached = [];
    this.host.scene.remove(this.room.group);
    disposeTree(this.room.group);
    this.tweens = [];
    this.room = null;
  }

  /** Camera framing for the room (also on resize). */
  frame() {
    if (!this.room) return;
    const cam = this.host.camera;
    const c = this.room.def.camera;
    cam.fov = c.fov || 30;
    cam.updateProjectionMatrix();
    const dist = this.host.fitDistance(c.viewW, c.viewH || c.viewW * 0.5);
    const pitch = c.pitch ?? 0.15;
    const x = this.camX ?? c.x ?? 0;
    cam.position.set(x, c.lookY + Math.sin(pitch) * dist, Math.cos(pitch) * dist);
    cam.lookAt(x, c.lookY, 0);
  }

  // ---------- walking ----------

  walkRects() {
    const w = this.room.def.walk;
    return typeof w === 'function' ? w(this) : w;
  }

  clampWalk(x, z) {
    let best = null;
    let bd = Infinity;
    for (const [x0, z0, x1, z1] of this.walkRects()) {
      const cx = Math.min(x1, Math.max(x0, x));
      const cz = Math.min(z1, Math.max(z0, z));
      const d = (cx - x) ** 2 + (cz - z) ** 2;
      if (d < bd) { bd = d; best = [cx, cz]; }
    }
    return best || [x, z];
  }

  rectOf(x, z) {
    return this.walkRects().findIndex(([x0, z0, x1, z1]) => x >= x0 - 1e-3 && x <= x1 + 1e-3 && z >= z0 - 1e-3 && z <= z1 + 1e-3);
  }

  /** Waypoints from Pip to (x, z) through the walk rectangles (breadth-first over touching rects). */
  findPath(x, z) {
    [x, z] = this.clampWalk(x, z);
    const rects = this.walkRects();
    const [sx, sz] = this.clampWalk(this.pip.position.x, this.pip.position.z);
    const a = this.rectOf(sx, sz);
    const b = this.rectOf(x, z);
    if (a < 0 || b < 0 || a === b) return [[x, z]];
    const touch = (p, q) => p[0] <= q[2] + 1e-3 && q[0] <= p[2] + 1e-3 && p[1] <= q[3] + 1e-3 && q[1] <= p[3] + 1e-3;
    const prev = new Map([[a, -1]]);
    const queue = [a];
    while (queue.length) {
      const i = queue.shift();
      if (i === b) break;
      rects.forEach((r, j) => { if (!prev.has(j) && touch(rects[i], r)) { prev.set(j, i); queue.push(j); } });
    }
    if (!prev.has(b)) return [[x, z]];
    const chain = [];
    for (let i = b; i !== -1; i = prev.get(i)) chain.unshift(i);
    const pts = [];
    for (let k = 0; k < chain.length - 1; k++) {
      const p = rects[chain[k]], q = rects[chain[k + 1]];
      pts.push([(Math.max(p[0], q[0]) + Math.min(p[2], q[2])) / 2, (Math.max(p[1], q[1]) + Math.min(p[3], q[3])) / 2]);
    }
    pts.push([x, z]);
    return pts;
  }

  startWalk(x, z, free = false) {
    const path = free ? [[x, z]] : this.findPath(x, z);
    this.walker = { path };
  }

  updateWalker(dt) {
    const w = this.walker;
    let moving = 0;
    if (w) {
      const [tx, tz] = w.path[0];
      const p = this.pip.position;
      const dx = tx - p.x, dz = tz - p.z;
      const d = Math.hypot(dx, dz);
      const step = PIP_SPEED * dt;
      if (d <= step) {
        p.x = tx; p.z = tz;
        w.path.shift();
        if (!w.path.length) this.walker = null;
      } else {
        p.x += (dx / d) * step;
        p.z += (dz / d) * step;
        moving = 1;
        if (Math.abs(dx) > 0.05) this.pipChar.faceSide(Math.sign(dx));
      }
      if (!this.walker) this.arrived();
    }
    this.pipChar.update(dt, { moving });
  }

  arrived() {
    const p = this.pending;
    this.pending = null;
    if (p && this.mode === 'play') this.doInteract(p.hs, p.verb, p.item);
  }

  // ---------- hotspots ----------

  hotspots() {
    const list = this.room.def.hotspots.filter((h) => !h.when || h.when(this));
    return list.concat(this.selfHotspot());
  }

  selfHotspot() {
    // Pip can be looked at and used with items like any other hotspot.
    const def = this.room.def.self || {};
    return [{ id: 'pip', name: def.name || 'adv.who.pip', kind: 'self', anchor: () => this.pip, box: [0, 0.6, 0, 0.9, 1.3, 0.8], priority: -1, ...def }];
  }

  hsName(h) {
    return typeof h.name === 'function' ? h.name(this) : t(h.name);
  }

  hsBox(h, out = _box) {
    const [cx, cy, cz, sx, sy, sz] = h.box;
    const c = _v.set(cx, cy, cz);
    if (h.anchor) {
      const o = h.anchor(this);
      if (!o) return null;
      o.updateWorldMatrix(true, false);
      c.add(o.getWorldPosition(new THREE.Vector3()));
    }
    out.min.set(c.x - sx / 2, c.y - sy / 2, c.z - sz / 2);
    out.max.set(c.x + sx / 2, c.y + sy / 2, c.z + sz / 2);
    return out;
  }

  verbFor(h) {
    if (h.verb) return typeof h.verb === 'function' ? h.verb(this) : h.verb;
    return { person: 'talk', item: 'take', exit: 'go', self: 'look' }[h.kind] || 'use';
  }

  standFor(h) {
    if (h.walk === null || h.kind === 'self') return null;
    if (h.walk) return typeof h.walk === 'function' ? h.walk(this) : h.walk;
    const b = this.hsBox(h, new THREE.Box3());
    if (!b) return null;
    const cx = (b.min.x + b.max.x) / 2;
    const side = this.pip.position.x < cx ? -1 : 1;
    return this.clampWalk(cx + side * ((b.max.x - b.min.x) / 2 + 0.5), this.pip.position.z);
  }

  hsCenterX(h) {
    const b = this.hsBox(h, new THREE.Box3());
    return b ? (b.min.x + b.max.x) / 2 : this.pip.position.x;
  }

  pointerRay() {
    _ndc.set((this.pointer.x / window.innerWidth) * 2 - 1, -(this.pointer.y / window.innerHeight) * 2 + 1);
    _ray.setFromCamera(_ndc, this.host.camera);
    return _ray;
  }

  pickHotspot() {
    const ray = this.pointerRay();
    let best = null;
    for (const h of this.hotspots()) {
      const b = this.hsBox(h);
      if (!b || !ray.ray.intersectBox(b, _v)) continue;
      const d = _v.distanceTo(ray.ray.origin);
      const pr = h.priority || 0;
      if (!best || pr > best.pr || (pr === best.pr && d < best.d)) best = { h, d, pr };
    }
    return best ? best.h : null;
  }

  groundPoint() {
    const ray = this.pointerRay();
    const hit = ray.ray.intersectPlane(_plane, new THREE.Vector3());
    if (!hit || hit.z < -30) {
      // Pointing at the sky: walk to that x at Pip's depth.
      const t0 = -ray.ray.origin.z / (ray.ray.direction.z || -1e-6);
      const x = ray.ray.origin.x + ray.ray.direction.x * t0;
      return this.clampWalk(x, this.pip.position.z);
    }
    return this.clampWalk(hit.x, hit.z);
  }

  // ---------- state & saving ----------

  flag(name) { return this.save.flags[name]; }

  setFlag(name, value = true) {
    this.save.flags[name] = value;
    this.persist();
  }

  has(item) { return this.save.inventory.includes(item); }

  give(item) {
    if (!this.has(item)) this.save.inventory.push(item);
    this.game.audio.play('coin');
    this.persist();
  }

  drop(item) {
    this.save.inventory = this.save.inventory.filter((i) => i !== item);
    if (this.held === item) this.held = null;
    this.persist();
  }

  persist() {
    if (this.mode === 'title') return;
    this.save.room = this.room.id;
    this.save.pos = [+this.pip.position.x.toFixed(2), +this.pip.position.z.toFixed(2)];
    this.game.roster.progress.adventure = JSON.parse(JSON.stringify(this.save));
    this.game.roster.save();
  }

  itemName(id) { return t(ITEMS[id]?.name || id); }

  // ---------- commands for scripts ----------

  say(who, key, vars, opts = {}) { return { type: 'say', who, key, vars, ...opts }; }
  walk(x, z, free = false) { return { type: 'walk', x, z, free }; }
  walkTo(id) {
    const h = this.hotspots().find((x) => x.id === id);
    const st = h && this.standFor(h);
    return st ? this.walk(st[0], st[1]) : null;
  }
  wait(sec) { return { type: 'wait', sec }; }
  choose(options, head = '') { return { type: 'choose', options, head }; }
  goRoom(id, entry = 'start') { return { type: 'room', id, entry }; }
  toBeContinued() { return { type: 'end' }; }

  *lines(list) {
    for (const ln of list) {
      if (typeof ln === 'function') {
        const r = ln(this);
        if (isIter(r)) yield* r;
        else if (r) yield r;
      } else {
        yield this.say(ln[0], ln[1], ln[2]);
      }
    }
  }

  face(who, dir) {
    if (who === 'pip') { if (dir === 0) this.pipChar.targetYaw = 0; else this.pipChar.faceSide(dir); }
    else this.actors[who]?.face?.(dir);
  }

  /** Pip turns toward a hotspot (or its own `face` direction). */
  faceHotspot(h) {
    if (h.kind === 'self') return;
    if (h.face === 0) { this.pipChar.targetYaw = 0; return; }
    const dir = h.face ?? Math.sign(this.hsCenterX(h) - this.pip.position.x);
    this.pipChar.faceSide(dir || 1);
  }

  /** Animate numbers on an object: { x, y, z, rx, ry, rz, s, sx, sy, sz }. Returns the duration. */
  tween(obj, to, dur, { ease = 'inOut', delay = 0 } = {}) {
    const from = {};
    for (const k of Object.keys(to)) from[k] = GET[k](obj);
    this.tweens.push({ obj, from, to, dur, t: -delay, ease: EASE[ease] || EASE.inOut });
    return dur + delay;
  }

  updateTweens(dt) {
    if (!this.tweens.length) return;
    for (const tw of this.tweens) {
      tw.t += dt;
      if (tw.t < 0) continue;
      const p = Math.min(1, tw.t / tw.dur);
      const e = tw.ease(p);
      for (const k of Object.keys(tw.to)) SET[k](tw.obj, tw.from[k] + (tw.to[k] - tw.from[k]) * e);
    }
    this.tweens = this.tweens.filter((tw) => tw.t < tw.dur);
  }

  /** Little text that floats up from a world point (giggles, squeaks). */
  float(text, pos) {
    const p = this.toScreen(pos);
    if (p) this.ui.float(text, p.x, p.y);
  }

  /** A help caption that stays for a while (or until the next narrator line). */
  hint(key, seconds = 8) {
    this.ui.showCaption(t(key), true);
    this.helpTimer = seconds;
    this.helpKey = key;
  }

  sfx(name) {
    const a = this.game.audio;
    if (!a.ctx || a.muted) return;
    const r = 1 + (Math.random() - 0.5) * 0.1;
    switch (name) {
      case 'squeak': a.tone(1300 * r, 0.12, { type: 'sine', vol: 0.12, slide: 1.5 }); a.tone(1500 * r, 0.1, { type: 'sine', vol: 0.1, slide: 0.8, delay: 0.12 }); break;
      case 'giggle': for (let i = 0; i < 4; i++) a.tone((620 + i * 40) * r, 0.08, { type: 'triangle', vol: 0.08, slide: 1.3, delay: i * 0.12 }); break;
      case 'bigGiggle': for (let i = 0; i < 9; i++) a.tone((520 + (i % 3) * 90) * r, 0.09, { type: 'triangle', vol: 0.1, slide: 1.4, delay: i * 0.1 }); break;
      case 'mine': a.tone(900 * r, 0.16, { type: 'square', vol: 0.05, slide: 0.7 }); a.tone(700 * r, 0.2, { type: 'square', vol: 0.05, slide: 0.6, delay: 0.12 }); break;
      case 'gurgle': for (let i = 0; i < 5; i++) a.tone((180 - i * 18) * r, 0.14, { type: 'sine', vol: 0.18, slide: 1.8, delay: i * 0.13 }); break;
      case 'splash': a.noise(0.5, { vol: 0.25, freq: 800, q: 0.6, type: 'lowpass' }); a.tone(220, 0.25, { type: 'sine', vol: 0.12, slide: 0.4 }); break;
      case 'tickle': a.noise(0.12, { vol: 0.08, freq: 4000, q: 2 }); a.tone(1200 * r, 0.06, { type: 'sine', vol: 0.06, slide: 1.6, delay: 0.05 }); break;
      case 'lid': a.tone(240, 0.12, { type: 'triangle', vol: 0.18, slide: 1.6 }); a.noise(0.08, { vol: 0.12, freq: 900 }); break;
      case 'knock': a.tone(150, 0.06, { type: 'triangle', vol: 0.25 }); a.tone(150, 0.06, { type: 'triangle', vol: 0.25, delay: 0.16 }); break;
      default: a.play(name);
    }
  }

  isTalking(who) { return this.bubbleCmd?.who === who && !this.bubbleCmd.finished; }

  toScreen(pos) {
    _v.copy(pos).project(this.host.camera);
    if (_v.z > 1) return null;
    return { x: ((_v.x + 1) / 2) * window.innerWidth, y: ((1 - _v.y) / 2) * window.innerHeight };
  }

  // ---------- running scripts ----------

  /** A handler (string key, list of lines, or script) as an iterator. */
  toIter(h, ctx) {
    if (!h) return null;
    if (typeof h === 'string') return this.lines([['pip', h]]);
    if (Array.isArray(h)) return this.lines(h);
    if (typeof h === 'function') {
      const r = h.call(null, this, ctx);
      if (isIter(r)) return r;
      return this.toIter(r, ctx);
    }
    if (isIter(h)) return h;
    // A single command (e.g. s.goRoom(...)) becomes a one-step script.
    if (h.type) return (function* one() { yield h; })();
    return null;
  }

  run(h, ctx = {}) {
    const it = this.toIter(h, ctx);
    if (!it) return;
    this.pending = null;
    this.script = { it, cmd: null };
    this.mode = 'script';
    this.advance(undefined);
  }

  advance(value) {
    const s = this.script;
    for (let guard = 0; guard < 200 && this.script === s; guard++) {
      const r = s.it.next(value);
      if (this.script !== s) return;
      if (r.done) { this.endScript(); return; }
      const cmd = r.value;
      value = undefined;
      if (!cmd || typeof cmd !== 'object' || !cmd.type) continue;
      this.startCmd(cmd);
      if (cmd.done) { value = cmd.result; this.finishCmd(cmd); continue; }
      s.cmd = cmd;
      return;
    }
  }

  endScript() {
    this.script = null;
    this.hideSpeech();
    this.ui.setChoices(null);
    if (this.mode === 'script') this.mode = 'play';
    this.persist();
  }

  startCmd(cmd) {
    cmd.t = 0;
    switch (cmd.type) {
      case 'say': this.startSay(cmd); break;
      case 'walk':
        this.startWalk(cmd.x, cmd.z, cmd.free);
        if (!this.walker) cmd.done = true;
        break;
      case 'wait': if (!(cmd.sec > 0)) cmd.done = true; break;
      case 'choose': {
        cmd.index = Math.max(0, cmd.options.findIndex((o) => !o.used));
        if (cmd.options.every((o) => o.used)) cmd.index = 0;
        break;
      }
      case 'room':
        this.game.audio.play('whoosh');
        this.game.ui.wipe(() => {
          this.loadRoom(cmd.id, cmd.entry);
          this.persist();
        }).then(() => { cmd.ready = true; });
        break;
      case 'end':
        this.mode = 'end';
        this.hideSpeech();
        this.ui.showTbc(t('adv.tbc'), t('adv.tbcSub'));
        this.game.audio.play('fanfare');
        speak(t('adv.tbc'));
        break;
      default: cmd.done = true;
    }
  }

  finishCmd(cmd) {
    if (cmd.type === 'say' && !cmd.hold) this.hideSpeech();
    if (cmd.type === 'choose') { this.ui.setChoices(null); this.hideSpeech(); }
  }

  /** Update the running command; returns true when it is done. */
  updateCmd(cmd, dt, inp) {
    cmd.t += dt;
    switch (cmd.type) {
      case 'say': {
        if (cmd.t > 0.3 && (inp.a || inp.click)) return true;
        if (cmd.t < cmd.dur) return false;
        // Let the voice finish its sentence (but never wait forever).
        return !(voiceOn() && isSpeaking() && cmd.t < cmd.dur * 2.5);
      }
      case 'walk': return !this.walker;
      case 'wait': return cmd.t >= cmd.sec;
      case 'choose': return this.updateChoose(cmd, inp);
      case 'room': return !!cmd.ready;
      case 'end':
        if (cmd.t > 3.6 && !cmd.finished) { cmd.finished = true; this.host.completeScene(); }
        return false;
      default: return true;
    }
  }

  // ---------- speech ----------

  startSay(cmd) {
    const actor = this.actors[cmd.who] || this.actors.pip;
    const text = t(cmd.key, cmd.vars);
    cmd.text = text;
    const chars = text.length;
    cmd.dur = Math.min(9, Math.max(2, 1.2 + chars * (voiceOn() ? 0.07 : 0.055)));
    this.hideSpeech(true);
    this.bubbleCmd = cmd;
    if (actor.narrator) {
      this.helpTimer = 0;
      this.ui.showCaption(text);
    } else {
      const name = typeof actor.name === 'function' ? actor.name(this) : t(actor.name || '');
      this.ui.showBubble(text, { who: actor.kind === 'note' ? '' : name, css: actor.css, kind: actor.kind || 'say' });
      actor.onSay?.(this);
    }
    if (actor.sfx) this.sfx(actor.sfx);
    speak(text, actor.voice || {});
  }

  hideSpeech(keepVoice = false) {
    if (this.bubbleCmd) this.bubbleCmd.finished = true;
    this.bubbleCmd = null;
    this.ui.hideBubble();
    if (this.helpTimer <= 0) this.ui.hideCaption();
    if (!keepVoice && voiceOn()) stopVoice();
  }

  placeBubble() {
    const cmd = this.bubbleCmd;
    if (!cmd) return;
    const actor = this.actors[cmd.who] || this.actors.pip;
    if (actor.narrator) return;
    const head = actor.head?.(new THREE.Vector3());
    const p = head && this.toScreen(head);
    if (p) this.ui.placeBubble(p.x, p.y);
  }

  // ---------- choices ----------

  updateChoose(cmd, inp) {
    const n = cmd.options.length;
    if (inp.sy) {
      cmd.index = (cmd.index - inp.sy + n) % n;
      this.game.audio.play('select');
    }
    let clicked = false;
    if (this.mouse.active) {
      const rects = this.ui.choiceRects();
      const i = rects.findIndex((r) => this.pointer.x >= r.left && this.pointer.x <= r.right && this.pointer.y >= r.top && this.pointer.y <= r.bottom);
      if (i >= 0 && i !== cmd.index && this.mouse.moved) cmd.index = i;
      if (i >= 0 && inp.click) { cmd.index = i; clicked = true; }
    }
    this.ui.setChoices(cmd.options.map((o) => ({ text: t(o.text, o.vars), used: o.used })), cmd.index, cmd.head ? (typeof cmd.head === 'function' ? cmd.head() : cmd.head) : '');
    if ((inp.a && cmd.t > 0.15) || clicked) {
      this.game.audio.play('select');
      cmd.result = cmd.index;
      return true;
    }
    return false;
  }

  // ---------- the player's actions ----------

  interact(h, verb, item) {
    this.pending = null;
    const st = verb === 'look' ? null : this.standFor(h);
    if (st && Math.hypot(st[0] - this.pip.position.x, st[1] - this.pip.position.z) > 0.12) {
      this.pending = { hs: h, verb, item };
      this.startWalk(st[0], st[1]);
      if (!this.walker) this.arrived();
    } else {
      this.walker = null;
      this.doInteract(h, verb, item);
    }
  }

  doInteract(h, verb, item) {
    this.faceHotspot(h);
    this.held = null;
    const ctx = { hs: h, verb, item };
    this.run(this.handlerFor(h, verb, item), ctx);
  }

  handlerFor(h, verb, item) {
    if (item) {
      const u = h.useItem?.[item] ?? h.useItem?.any;
      if (u) return u;
      return this.generic('useOn', { i: this.itemName(item) });
    }
    if (verb === 'go' && !h.go && h.to) return (s) => s.goRoom(h.to, h.entry);
    return h[verb] || this.generic(verb === 'go' ? 'use' : verb);
  }

  /** A random generic line for a verb ("I don't think the duck wants to go there."). */
  generic(verb, vars) {
    const counts = { look: 3, take: 3, use: 3, talk: 2, useOn: 5 };
    const n = counts[verb] || 3;
    this.genericTurn = ((this.genericTurn || 0) + 1 + Math.floor(Math.random() * 2)) % 60;
    return [['pip', `adv.gen.${verb in counts ? verb : 'use'}.${1 + (this.genericTurn % n)}`, vars]];
  }

  lookItem(id) {
    this.run(ITEMS[id]?.look || this.generic('look'));
  }

  combineItems(a, b) {
    this.held = null;
    const r = combineResponse(a, b);
    this.run(r || [['pip', 'adv.gen.combine', { a: this.itemName(a), b: this.itemName(b) }]]);
  }

  // ---------- title card ----------

  showTitle() {
    this.mode = 'title';
    const opts = [];
    if (this.hasSave) opts.push({ id: 'continue', text: 'adv.continue' });
    opts.push({ id: 'new', text: 'adv.new', sub: this.hasSave ? 'adv.newSub' : '' });
    this.title = { options: opts, index: 0 };
    speak(`${t('adv.title')}. ${t('adv.scene1')}`);
  }

  renderTitle() {
    const c = this.title;
    this.ui.setTitle({
      logo: t('adv.title'),
      sub: this.save.done ? t('adv.done') : t('adv.scene1'),
      options: c.options.map((o) => ({ text: t(o.text), sub: o.sub ? t(o.sub) : '' })),
      index: c.index,
      foot: t('adv.titleHint'),
    });
  }

  updateTitle(inp) {
    const c = this.title;
    const n = c.options.length;
    if (inp.sy) { c.index = (c.index - inp.sy + n) % n; this.game.audio.play('select'); }
    let clicked = false;
    if (this.mouse.active) {
      const rects = this.ui.titleRects();
      const i = rects.findIndex((r) => this.pointer.x >= r.left && this.pointer.x <= r.right && this.pointer.y >= r.top && this.pointer.y <= r.bottom);
      if (i >= 0 && this.mouse.moved) c.index = i;
      if (i >= 0 && inp.click) { c.index = i; clicked = true; }
    }
    this.renderTitle();
    if (!(inp.a || clicked) || this.time < 0.3) return;
    this.game.audio.play('fanfare');
    this.ui.setTitle(null);
    const choice = c.options[c.index].id;
    if (choice === 'continue') {
      this.mode = 'play';
      this.hint('adv.loaded', 3);
      this.persist();
    } else {
      // Starting over keeps only the memory that scene 1's stars were already given.
      const starsGiven = this.save.starsGiven;
      this.save = freshSave(this.startRoom);
      this.save.starsGiven = starsGiven;
      this.mode = 'play';
      this.loadRoom(this.startRoom, 'intro');
      this.persist();
      if (this.introScript) this.run(this.introScript);
    }
  }

  // ---------- inventory ----------

  invItems() {
    return this.save.inventory.map((id) => ({ id, name: this.itemName(id), icon: itemIcon(this.game.renderer, id) }));
  }

  updateInv(inp) {
    const inv = this.save.inventory;
    const n = inv.length;
    if (!n || inp.c) { this.mode = 'play'; this.game.audio.play('select'); return; }
    this.invSel = Math.min(this.invSel, n - 1);
    if (inp.sx) { this.invSel = (this.invSel + inp.sx + n) % n; this.game.audio.play('select'); }
    if (this.mouse.active && this.hover.slot >= 0 && this.mouse.moved) this.invSel = this.hover.slot;
    const id = inv[this.invSel];
    if (inp.a || (inp.click && this.hover.slot >= 0)) {
      if (this.held && this.held !== id) this.combineItems(this.held, id);
      else { this.held = id; this.game.audio.play('select'); this.mode = 'play'; }
    } else if (inp.b || (inp.right && this.hover.slot >= 0)) {
      this.lookItem(id);
    } else if (inp.click || inp.right) {
      this.mode = 'play';
    }
  }

  // ---------- input ----------

  bindMouse() {
    const el = this.game.renderer.domElement;
    this.onMove = (e) => {
      const r = el.getBoundingClientRect();
      this.pointer.x = e.clientX - r.left;
      this.pointer.y = e.clientY - r.top;
      this.mouse.active = true;
      this.mouse.moved = true;
      el.style.cursor = 'none';
    };
    this.onDown = (e) => {
      this.onMove(e);
      if (e.button === 0) this.mouse.left = true;
      if (e.button === 2) this.mouse.right = true;
      this.game.audio.ensure();
    };
    this.onMenu = (e) => e.preventDefault();
    el.addEventListener('pointermove', this.onMove);
    el.addEventListener('pointerdown', this.onDown);
    el.addEventListener('contextmenu', this.onMenu);
  }

  readInput() {
    const inp = { x: 0, y: 0, a: false, b: false, c: false, sx: 0, sy: 0, click: this.mouse.left, right: this.mouse.right };
    this.mouse.left = this.mouse.right = false;
    for (const p of this.host.players) {
      const d = this.host.input(p);
      if (!d) continue;
      if (Math.hypot(d.x, d.y) > Math.hypot(inp.x, inp.y)) { inp.x = d.x; inp.y = d.y; }
      inp.a ||= d.aPressed; inp.b ||= d.bPressed; inp.c ||= d.cPressed;
      inp.sx ||= d.stepX; inp.sy ||= d.stepY;
    }
    return inp;
  }

  movePointer(inp, dt) {
    const mag = Math.hypot(inp.x, inp.y);
    if (mag < 0.05) { this.holdTime = 0; return; }
    this.mouse.active = false;
    this.game.renderer.domElement.style.cursor = '';
    this.holdTime += dt;
    const W = window.innerWidth, H = window.innerHeight;
    // Short taps nudge, holding speeds up; slower over a hotspot so it's easy to stop on one.
    const ramp = Math.min(1, 0.3 + this.holdTime * 1.6);
    const slow = this.hover.hs || this.hover.slot >= 0 ? 0.6 : 1;
    const speed = 0.62 * Math.min(W, H * 1.78) * Math.pow(mag, 1.4) * ramp * slow;
    this.pointer.x = Math.max(4, Math.min(W - 4, this.pointer.x + inp.x * speed * dt));
    this.pointer.y = Math.max(4, Math.min(H - 4, this.pointer.y - inp.y * speed * dt));
  }

  updateHover() {
    const rects = this.ui.slotRects();
    const px = this.pointer.x, py = this.pointer.y;
    const slot = rects.findIndex((r) => px >= r.left - 4 && px <= r.right + 4 && py >= r.top - 4 && py <= r.bottom + 4);
    this.hover = { slot, hs: slot >= 0 ? null : this.pickHotspot() };
  }

  updatePlay(inp, dt) {
    this.movePointer(inp, dt);
    this.updateHover();
    const { hs, slot } = this.hover;
    if (inp.c) {
      if (this.save.inventory.length) {
        this.mode = 'inv';
        this.invSel = Math.max(0, this.save.inventory.indexOf(this.held));
        this.game.audio.play('select');
      } else this.hint('adv.invEmpty', 2);
      return;
    }
    if (inp.a || inp.click) {
      if (slot >= 0) {
        const id = this.save.inventory[slot];
        if (this.held && this.held !== id) this.combineItems(this.held, id);
        else { this.held = this.held === id ? null : id; this.game.audio.play('select'); }
      } else if (hs) {
        this.interact(hs, this.held ? 'useOn' : this.verbFor(hs), this.held);
      } else {
        this.pending = null;
        const [x, z] = this.groundPoint();
        this.startWalk(x, z);
      }
    } else if (inp.b || inp.right) {
      if (slot >= 0) this.lookItem(this.save.inventory[slot]);
      else if (hs) { this.walker = null; this.pending = null; this.held = null; this.faceHotspot(hs); this.run(this.handlerFor(hs, 'look')); }
      else if (this.held) this.held = null;
    }
  }

  // ---------- per frame ----------

  update(dt) {
    this.time += dt;
    const inp = this.readInput();
    if (this.room) this.room.time += dt;
    if (this.helpTimer > 0) {
      this.helpTimer -= dt;
      if (this.helpTimer <= 0 && !this.bubbleCmd?.who?.startsWith?.('narr')) this.ui.hideCaption();
    }

    if (this.mode === 'title') this.updateTitle(inp);
    else if (this.mode === 'play') this.updatePlay(inp, dt);
    else if (this.mode === 'inv') { this.updateHover(); this.updateInv(inp); }
    else if (this.mode === 'script' || this.mode === 'end') {
      const s = this.script;
      if (s?.cmd && this.updateCmd(s.cmd, dt, inp)) {
        const cmd = s.cmd;
        s.cmd = null;
        this.finishCmd(cmd);
        this.advance(cmd.result);
      }
    }
    this.mouse.moved = false;

    this.updateWalker(dt);
    this.updateTweens(dt);
    this.room?.def.update?.(this, dt, this.room.props);
    this.placeBubble();
    this.renderHud();
  }

  renderHud() {
    const ui = this.ui;
    const mode = this.mode;
    const showPointer = mode === 'play' || mode === 'inv' || (mode === 'script' && this.script?.cmd?.type === 'choose' && this.mouse.active) || (mode === 'title' && this.mouse.active);
    const hot = mode === 'play' && (this.hover.hs || this.hover.slot >= 0);
    const tag = mode === 'play' && this.hover.hs ? this.hsName(this.hover.hs) : '';
    ui.setCursor(this.pointer.x, this.pointer.y, { visible: showPointer, hot: !!hot, tag, icon: this.held && mode === 'play' ? itemIcon(this.game.renderer, this.held) : '' });

    const choosing = mode === 'script' && this.script?.cmd?.type === 'choose';
    ui.setBottom(mode !== 'title' && mode !== 'end' && !choosing);
    if (mode === 'title' || mode === 'end') return;
    ui.setInventory(this.invItems(), { open: mode === 'inv', sel: this.invSel, held: this.held, hover: mode === 'play' ? this.hover.slot : -1 });
    const key = (b, word) => `<b>${esc(buttonText(b))}</b>${esc(t(word))}`;
    if (mode === 'script') {
      ui.setSentence('');
      ui.setHints(this.script?.cmd?.type === 'say' ? key('a', 'adv.h.skip') : '');
      return;
    }
    if (mode === 'inv') {
      const id = this.save.inventory[this.invSel];
      const nm = `<b>${esc(this.itemName(id))}</b>`;
      ui.setSentence(this.held && this.held !== id ? t('adv.v.useOn', { i: esc(this.itemName(this.held)), x: nm }) : t('adv.v.pick', { i: nm }));
      ui.setHints(`${key('a', 'adv.h.pick')} ${key('b', 'adv.h.look')} ${key('c', 'adv.h.close')}`);
      return;
    }
    const { hs, slot } = this.hover;
    const target = hs ? this.hsName(hs) : slot >= 0 ? this.itemName(this.save.inventory[slot]) : '';
    const nm = target ? `<b>${esc(target)}</b>` : '';
    let sentence;
    let verb = 'walk';
    if (this.held) {
      sentence = target && !(slot >= 0 && this.save.inventory[slot] === this.held)
        ? t('adv.v.useOn', { i: esc(this.itemName(this.held)), x: nm })
        : t('adv.v.useOnNothing', { i: esc(this.itemName(this.held)) });
      verb = 'use';
    } else if (hs) {
      verb = this.verbFor(hs);
      sentence = t(`adv.v.${verb}`, { x: nm });
    } else if (slot >= 0) {
      verb = 'pick';
      sentence = t('adv.v.pick', { i: nm });
    } else {
      sentence = t('adv.v.walk');
    }
    ui.setSentence(sentence);
    const parts = [key('a', `adv.h.${verb}`)];
    if (hs || slot >= 0) parts.push(key('b', 'adv.h.look'));
    else if (this.held) parts.push(key('b', 'adv.h.cancel'));
    parts.push(key('c', 'adv.h.items'));
    ui.setHints(parts.join(' '));
  }

  /** Language switched: redraw signs, the current line and the title. */
  onLanguage() {
    this.room?.def.relabel?.(this, this.room.props);
    this.duelMeters?.();
    const cmd = this.bubbleCmd;
    if (cmd) {
      const keep = cmd;
      this.startSay(keep);
      keep.finished = false;
      keep.t = Math.min(keep.t || 0, 0.3);
      if (this.script) this.script.cmd = keep;
    }
    if (this.helpTimer > 0 && this.helpKey) this.ui.showCaption(t(this.helpKey), true);
  }

  dispose() {
    const el = this.game.renderer.domElement;
    el.removeEventListener('pointermove', this.onMove);
    el.removeEventListener('pointerdown', this.onDown);
    el.removeEventListener('contextmenu', this.onMenu);
    el.style.cursor = '';
    stopVoice();
    this.unloadRoom();
    this.ui.dispose();
  }
}
