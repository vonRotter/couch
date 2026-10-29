import * as THREE from 'three';
import { t } from '../../core/i18n.js';
import { esc } from '../../core/ui.js';
import { say as speak } from '../../core/voice.js';
import { count, give, take, hourOf, now } from './save.js';
import { dayKey } from './calendar.js';
import { heightAt } from './map.js';
import { mesh, box } from './models.js';
import { makeChicken, makeCow, makeTrough, makeNest } from './models2.js';
import { heartsHtml } from './hud.js';

// The barn and paddock (milestone B2). Aunt Hazel's quest repairs the barn and brings two chickens; Rosa
// sells more chickens, a goat and a cow. Animals live in real time: each day, an animal that finds hay in
// the trough eats and makes something (eggs in the nest, milk from the cow and goat). A hungry animal just
// skips that day: nobody gets sick or sad. Pet each animal once a day for animal hearts (up to 5); happy
// chickens sometimes lay two eggs.

export const PADDOCK = { x0: -18.6, x1: -9.4, z0: 3.4, z1: 8.6 };
const TROUGH = { x: -11, z: 4 };
const NEST = { x: -17.6, z: 9.3 };
const BARN_DOOR = { x: -14, z: 10.3 };
export const LIMITS = { chicken: 4, goat: 1, cow: 1 };
const NAMES = { chicken: ['Clucky', 'Nugget', 'Pebble', 'Sunny', 'Popcorn', 'Dotty'], goat: ['Billy', 'Clover'], cow: ['Daisy', 'Bella'] };
const TROUGH_MAX = 20;

export class Ranch {
  constructor(host) {
    this.host = host;
    const S = host.save;
    if (!S.ranch) S.ranch = { animals: [], trough: 0, nest: 0 };
    this.trough = host.map.live(makeTrough(), TROUGH.x, TROUGH.z);
    this.nest = host.map.live(makeNest(), NEST.x, NEST.z, Math.PI);
    host.map.boxObs(NEST.x, NEST.z, 0.55, 0.35);
    // the open barn door (once repaired): a warm doorway and hay bales
    this.open = new THREE.Group();
    this.open.add(mesh(box(2.0, 2.0, 0.1), 0x3a2a20, 0, 1.0, 0, false), mesh(box(1.8, 0.4, 0.06), 0xffd27a, 0, 1.5, -0.02, false));
    for (const x of [-2.6, 2.6]) this.open.add(mesh(box(0.9, 0.6, 0.6), 0xf0d060, x, 0.3, -0.3));
    host.map.live(this.open, BARN_DOOR.x, BARN_DOOR.z + 0.45, 0, heightAt(BARN_DOOR.x, BARN_DOOR.z));
    this.views = new Map();
    this.refresh();
  }

  get S() { return this.host.save; }
  get R() { return this.S.ranch; }
  get barn() { return !!this.S.unlocks.barn; }

  refresh() {
    this.open.visible = this.barn;
    this.trough.userData.hay.visible = this.R.trough > 0;
    this.trough.userData.hay.scale.y = Math.max(0.2, Math.min(1, this.R.trough / 8));
    this.nest.userData.eggs.forEach((e, i) => { e.visible = i < this.R.nest; });
    // models for the animals
    for (const a of this.R.animals) {
      if (this.views.has(a.u)) continue;
      const m = a.kind === 'chicken' ? makeChicken([0xffffff, 0xf0c890, 0xb07a4a][a.u % 3]) : makeCow(a.kind === 'goat');
      const x = PADDOCK.x0 + 1 + Math.random() * (PADDOCK.x1 - PADDOCK.x0 - 2), z = PADDOCK.z0 + 1 + Math.random() * (PADDOCK.z1 - PADDOCK.z0 - 2);
      m.position.set(x, heightAt(x, z), z);
      this.host.scene.add(m);
      const tag = this.host.game.ui.label('label isl-tag');
      this.views.set(a.u, { m, x, z, tx: x, tz: z, wait: Math.random() * 3, t: Math.random() * 5, tag, hop: 0 });
    }
  }

  /** A new animal (from the barn quest or Rosa's store). */
  addAnimal(kind) {
    const R = this.R;
    if (R.animals.filter((a) => a.kind === kind).length >= LIMITS[kind]) return false;
    const used = new Set(R.animals.map((a) => a.name));
    const name = NAMES[kind].find((n) => !used.has(n)) || NAMES[kind][0];
    R.animals.push({ u: (R.next = (R.next || 0) + 1), kind, name, hearts: 0, petDay: '', day: '', ready: false });
    this.refresh();
    const v = this.views.get(R.animals[R.animals.length - 1].u);
    this.host.puffs.burst(new THREE.Vector3(v.x, 0.8, v.z), 0xffffff, { count: 14, speed: 3, size: 0.4 });
    this.host.markDirty();
    return true;
  }

  canBuy(kind) {
    return this.barn && this.R.animals.filter((a) => a.kind === kind).length < LIMITS[kind];
  }

  /** Once per real day each animal eats one hay (if there is any) and makes eggs or milk. */
  tick(at) {
    const today = dayKey(at);
    let changed = false;
    for (const a of this.R.animals) {
      if (a.day > today) { a.day = today; continue; } // the clock went backwards: wait for a new day
      if (a.day === today || this.R.trough <= 0) continue;
      this.R.trough--;
      a.day = today;
      if (a.kind === 'chicken') this.R.nest = Math.min(4, this.R.nest + (a.hearts >= 5 && (a.u + today.length) % 2 ? 2 : 1));
      else a.ready = true;
      changed = true;
    }
    if (changed) { this.refresh(); this.host.markDirty(); }
  }

  /** [B] actions at the ranch. */
  interactions(P, out, nm) {
    if (!this.barn) return;
    const near = (p, r) => Math.hypot(P.x - p.x, P.z - p.z) < r;
    const today = dayKey();
    let best = null, bd = 1.7;
    for (const a of this.R.animals) {
      const v = this.views.get(a.u);
      const d = Math.hypot(P.x - v.x, P.z - v.z);
      if (d < bd) { bd = d; best = a; }
    }
    if (best) {
      if (best.ready) out.b = { text: nm('isl.h.milk', { name: best.name }), fn: () => this.milk(best) };
      else if (best.petDay !== today) out.b = { text: nm('isl.h.pet', { name: best.name }), fn: () => this.pet(best) };
      else out.b = { text: t('isl.h.happy', { name: best.name }), fn: () => this.pet(best) };
      return;
    }
    if (near(TROUGH, 1.9)) {
      out.b = count(this.S, 'hay') ? { text: nm('isl.h.hay', { n: this.R.trough }), fn: () => this.fill() } : { text: t('isl.h.hayNeed', { n: this.R.trough }), fn: () => this.host.game.audio.play('bump') };
    } else if (near(NEST, 1.6)) {
      out.b = this.R.nest ? { text: nm('isl.h.eggs', { n: this.R.nest }), fn: () => this.collectEggs() } : { text: t('isl.h.nestEmpty'), fn: () => this.host.game.audio.play('bump') };
    }
  }

  fill() {
    const n = Math.min(count(this.S, 'hay'), TROUGH_MAX - this.R.trough);
    if (n <= 0) return;
    take(this.S, 'hay', n);
    this.R.trough += n;
    this.host.puffs.burst(new THREE.Vector3(TROUGH.x, 0.8, TROUGH.z), 0xf0d060, { count: 14, speed: 3, size: 0.3 });
    this.host.game.audio.play('pop');
    this.host.game.ui.toast(t('isl.t.hay', { n: this.R.trough }));
    this.refresh();
    this.tick(now());
    this.host.markDirty();
  }

  collectEggs() {
    const n = this.R.nest;
    this.R.nest = 0;
    give(this.S, 'egg', n);
    this.host.game.audio.play('star');
    this.host.game.ui.toast(t('isl.t.got', { item: `${n} × ${t('isl.i.egg')}` }));
    this.refresh();
    this.host.markDirty();
  }

  milk(a) {
    a.ready = false;
    give(this.S, 'milk', 1);
    const v = this.views.get(a.u);
    v.hop = 1;
    this.host.game.audio.play('star');
    this.host.game.ui.toast(t('isl.t.got', { item: t('isl.i.milk') }));
    this.host.markDirty();
  }

  pet(a) {
    const today = dayKey();
    const v = this.views.get(a.u);
    v.hop = 1;
    this.host.confetti.burst(new THREE.Vector3(v.x, 1.6, v.z), 0, { count: 12, speed: 3, up: 3, colors: [0xff5d73, 0xff9fd0], life: 0.9, gravity: -5 });
    this.host.game.audio.play(a.kind === 'chicken' ? 'boing' : 'pop');
    if (a.petDay === today) return;
    a.petDay = today;
    a.hearts = Math.min(5, a.hearts + 1);
    const txt = t(`isl.pet.${a.kind}`, { name: a.name });
    this.host.game.ui.toast(txt, 1600);
    speak(txt);
    this.host.markDirty();
  }

  update(dt) {
    const host = this.host, P = host.player;
    const night = (() => { const h = hourOf(); return h >= 21 || h < 6; })();
    for (const a of this.R.animals) {
      const v = this.views.get(a.u);
      v.t += dt;
      v.wait -= dt;
      if (night) { v.tx = BARN_DOOR.x + ((a.u % 5) - 2) * 0.8; v.tz = BARN_DOOR.z - 0.9; }
      else if (v.wait <= 0) {
        v.wait = 2 + Math.random() * 4;
        v.tx = PADDOCK.x0 + 0.8 + Math.random() * (PADDOCK.x1 - PADDOCK.x0 - 1.6);
        v.tz = PADDOCK.z0 + 0.8 + Math.random() * (PADDOCK.z1 - PADDOCK.z0 - 1.6);
      }
      const dx = v.tx - v.x, dz = v.tz - v.z, d = Math.hypot(dx, dz);
      const sp = a.kind === 'chicken' ? 1.3 : 0.8;
      if (d > 0.1) { v.x += (dx / d) * Math.min(d, sp * dt); v.z += (dz / d) * Math.min(d, sp * dt); v.m.rotation.y = Math.atan2(dx, dz); }
      v.hop = Math.max(0, v.hop - dt * 3);
      v.m.position.set(v.x, heightAt(v.x, v.z) + Math.sin(v.hop * Math.PI) * 0.4 + (d > 0.1 && a.kind === 'chicken' ? Math.abs(Math.sin(v.t * 12)) * 0.05 : 0), v.z);
      if (v.m.userData.head) v.m.userData.head.rotation.x = d > 0.1 ? 0 : Math.sin(v.t * 1.5) * 0.25 + 0.2;
      // name tag with animal hearts when you are close
      const close = P && host.mode === 'walk' && Math.hypot(P.x - v.x, P.z - v.z) < 4.5;
      if (close) {
        const html = `${esc(a.name)}${heartsHtml(a.hearts, 5)}${a.ready ? ' 🥛' : ''}`;
        if (v.tag.innerHTML !== html) v.tag.innerHTML = html;
        host.game.ui.place(v.tag, new THREE.Vector3(v.x, a.kind === 'chicken' ? 1.2 : 2.3, v.z), host.camera);
      } else v.tag.style.display = 'none';
    }
  }
}
