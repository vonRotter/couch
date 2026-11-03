import * as THREE from 'three';
import { t, tFor } from '../../core/i18n.js';
import { makeCrab, animateCrab, makeTangle, makeFamilySpot, makeHelpBubble, makeShell } from './models7.js';
import { crabSave, doneToday, dailyCrabs, crabHelped } from './crabdata.js';
import { seasonOf } from './calendar.js';
import { now } from './save.js';

// Crab friends in the dive (the owner's crab update). Crabs and lobsters are never netted any more: they
// scuttle along the sea floor, and [B] waves to them (they wave back). Each real day three of them need a
// hand down here, the underwater versions of the beach help: a crab on its back to turn over, a crab or a
// lobster caught in an old net to free (three tugs), and a family of lost baby crabs who swim after you to
// their glowing family spot. There is also a big shell for the hermit crabs on the floor.

// candidate spots on the sunny shelf and the reef slope (x; y comes from the floor)
const SPOTS_X = [-40, -34, -28, -23, 21, 26, 31, 37, 42, -15, 14];

export class DiveCrabs {
  /** host: the dive scene; floorY: the sea floor height function. */
  constructor(host, floorY) {
    this.host = host;
    this.floorY = floorY;
    const S = host.save, sc = host.scene;
    crabSave(S);
    this.done = doneToday(S);
    this.helped = 0;
    // friendly crabs walking on the floor (snow crabs in winter) and two lobsters on the reef slope
    const winter = seasonOf(now()) === 'winter';
    this.walkers = [];
    const r = host.rand;
    const walk = (kind, x) => {
      const g = makeCrab(kind);
      g.scale.multiplyScalar(kind === 'lobster' ? 1.05 : 0.95);
      sc.add(g);
      const w = { kind, g, x, hx: x, tx: x, wait: r() * 2, wave: 0, dir: 1 };
      this.walkers.push(w);
      return w;
    };
    for (let i = 0; i < 3; i++) walk(winter && i < 2 ? 'snow' : 'red', (r() < 0.5 ? -1 : 1) * (20 + r() * 22));
    for (let i = 0; i < 2; i++) walk('lobster', (i ? 1 : -1) * (9 + r() * 6));
    // today's crabs who need help
    const spots = SPOTS_X.map((x) => ({ x, y: floorY(x) }));
    this.list = [];
    for (const c of dailyCrabs('dive', spots, now(), S)) {
      if (this.done.includes(c.id)) continue;
      this.list.push(this.spawn(c));
    }
  }

  spawn(c) {
    const sc = this.host.scene, fy = this.floorY;
    const o = { ...c, x: c.at.x, y: fy(c.at.x), state: 'wait', t: 0, tugs: 0 };
    if (c.type === 'find') {
      o.g = makeShell(c.item);
      o.g.scale.setScalar(0.8);
      o.g.position.set(o.x, o.y + 0.02, 0.2);
      sc.add(o.g);
      return o;
    }
    if (c.type === 'home') {
      o.babies = [];
      for (let i = 0; i < c.n; i++) {
        const b = makeCrab('baby');
        b.scale.setScalar(0.72);
        sc.add(b);
        o.babies.push({ g: b, x: o.x + (i - 1) * 0.55, y: o.y, ph: i * 1.3 });
      }
      o.to = { x: c.to.x, y: fy(c.to.x) };
      o.spot = makeFamilySpot();
      o.spot.position.set(o.to.x, o.to.y + 0.02, 0);
      o.spot.rotation.x = 0.35; // tilted a little toward the camera, so the ring reads in the side view
      sc.add(o.spot);
      o.parents = [-0.7, 0.7].map((dx) => { const p = makeCrab('red'); p.position.set(o.to.x + dx, fy(o.to.x + dx) + 0.02, -0.2); sc.add(p); return p; });
    } else {
      o.g = makeCrab(c.kind);
      o.g.position.set(o.x, o.y + 0.02, 0);
      sc.add(o.g);
      if (c.type === 'flip') { o.g.userData.body.rotation.z = Math.PI; o.g.userData.body.position.y = 0.5; }
      if (c.type === 'free') { o.tangle = makeTangle('net'); o.g.add(o.tangle); }
    }
    o.bubble = makeHelpBubble();
    o.bubble.scale.setScalar(0.9);
    this.host.night?.addHalo(o.bubble, 0xffffff, 0.45); // on night dives the bubble glows, so you can find them
    sc.add(o.bubble);
    return o;
  }

  /**
   * The closest crab thing for [B]: { text, fn } or null. Crabs who need a hand come first; waving to a
   * walking crab (wave: true) comes after chests, clams and kelp (dive.js).
   */
  nearest(wave = false) {
    const D = this.host.diver, P = this.host.players[0];
    const d = (x, y) => Math.hypot(D.x - x, D.y - y);
    if (wave) {
      for (const w of this.walkers) if (d(w.x, this.floorY(w.x) + 0.4) < 1.6) return { text: tFor(P, 'crab.h.wave'), fn: () => this.wave(w) };
      return null;
    }
    for (const o of this.list) {
      if (o.state !== 'wait') continue;
      if (o.type === 'find' && d(o.x, o.y + 0.4) < 1.6) return { text: tFor(P, 'dive.pick', { item: t(`isl.i.${o.item}`) }), fn: () => this.pickShell(o) };
      if (o.type === 'flip' && d(o.x, o.y + 0.4) < 1.8) return { text: tFor(P, 'crab.h.flip'), fn: () => this.flip(o) };
      if (o.type === 'free' && d(o.x, o.y + 0.4) < 1.8) return { text: tFor(P, 'crab.h.freeNet', { n: 3 - o.tugs }), fn: () => this.tug(o) };
      if (o.type === 'home' && d(o.x, o.y + 0.4) < 2.0) return { text: tFor(P, 'crab.h.babies'), fn: () => this.lead(o) };
    }
    return null;
  }

  say(key, vars) {
    const txt = t(key, vars);
    this.host.game.ui.toast(txt, 2400); // (not read aloud: the narrator reads story and help)
  }

  hearts(x, y) {
    this.host.confetti.burst(new THREE.Vector3(x, y + 0.8, 0.5), 0, { count: 18, speed: 3, up: 3, life: 1.1, gravity: -2, colors: [0xff5d73, 0xff9fd0, 0xffffff] });
  }

  /** A helped crab: counted (museum wall, cove, friends), today's spot is done. */
  helpedOne(o, kind, how) {
    o.state = 'done';
    this.done.push(o.id);
    const S = this.host.save;
    const r = crabHelped(S, kind, how);
    this.helped++;
    this.host.crabsHelped = this.helped;
    if (r.museum) this.host.later(1.4, () => this.say('crab.t.museum', { item: t(`isl.i.${r.museum}`) }));
    if (o.bubble) o.bubble.visible = false;
    this.host.game.audio.play('rescue');
    this.host.game.roster.save();
  }

  flip(o) {
    o.state = 'flip';
    o.t = 0;
    this.host.bag('seaShell');
    this.hearts(o.x, o.y);
    this.helpedOne(o, o.kind, 'flip');
    o.state = 'flip';
    this.say('crab.t.flipped');
  }

  tug(o) {
    o.tugs++;
    const part = o.tangle.userData.parts[o.tugs - 1];
    if (part) part.visible = false;
    this.host.puffs.burst(new THREE.Vector3(o.x, o.y + 0.5, 0.4), 0xffffff, { count: 6, speed: 2, size: 0.18, life: 0.6, gravity: 2 });
    this.host.game.audio.play('pop');
    if (o.tugs < 3) return;
    o.tangle.removeFromParent();
    this.host.bag(o.kind === 'lobster' ? 'pearl' : 'seaShell');
    this.hearts(o.x, o.y);
    this.helpedOne(o, o.kind, 'free');
    o.state = 'free';
    o.t = 0;
    this.say(o.kind === 'lobster' ? 'crab.t.freedLobster' : 'crab.t.freed');
  }

  lead(o) {
    o.state = 'follow';
    this.host.game.audio.play('join');
    this.say('crab.t.follow');
  }

  wave(w) {
    w.wave = 1.6;
    this.hearts(w.x, this.floorY(w.x));
    this.host.game.audio.play('boing');
  }

  pickShell(o) {
    o.state = 'done';
    this.done.push(o.id);
    o.g.visible = false;
    this.host.bag(o.item);
    this.host.game.audio.play('star');
    this.say('crab.t.foundShell', { item: t(`isl.i.${o.item}`) });
  }

  update(dt) {
    const D = this.host.diver, fy = this.floorY, tm = this.host.time;
    for (const w of this.walkers) {
      w.wait -= dt;
      if (w.wait <= 0) { w.wait = 2 + Math.random() * 3; w.tx = w.hx + (Math.random() - 0.5) * 6; }
      const dx = w.tx - w.x, moving = w.wave <= 0 && Math.abs(dx) > 0.05;
      if (moving) { w.x += Math.sign(dx) * Math.min(Math.abs(dx), dt * 1.1); w.dir = Math.sign(dx); }
      w.wave = Math.max(0, w.wave - dt);
      w.g.position.set(w.x, fy(w.x) + 0.02, -0.3);
      // crabs face the camera and walk sideways (the side view suits them)
      animateCrab(w.g, dt, { walk: moving ? 1 : 0, wave: w.wave > 0 ? 1 : 0 });
    }
    for (const o of this.list) {
      o.t += dt;
      if (o.bubble?.visible) o.bubble.position.set(o.x + 0.3, o.y + 1.5 + Math.sin(tm * 3 + o.x) * 0.1, 0.6);
      if (o.type === 'find') { if (o.g.visible) o.g.rotation.y = Math.sin(tm * 1.5) * 0.4; continue; }
      if (o.type === 'home') { this.updateBabies(o, dt); continue; }
      const g = o.g, u = g.userData;
      if (o.state === 'wait') {
        animateCrab(g, dt, { wiggle: 1 });
        if (o.type === 'flip') { u.body.position.y = 0.52; u.body.rotation.x = Math.sin(this.host.time * 5) * 0.15; } // on its back, rocking
      } else if (o.state === 'flip') {
        // turn over, a happy dance, then scuttle off
        const k = Math.min(1, o.t / 0.5);
        u.body.rotation.z = Math.PI * (1 - k);
        u.body.rotation.x = 0;
        u.body.position.y = 0.5 * (1 - k) + Math.sin(k * Math.PI) * 0.6;
        if (o.t > 0.5) animateCrab(g, dt, { dance: o.t < 2.4 ? 1 : 0, walk: o.t >= 2.4 ? 1 : 0 });
        if (o.t > 2.4) { o.x += dt * 1.5; g.position.set(o.x, fy(o.x) + 0.02, 0); }
        if (o.t > 6) { g.visible = false; o.state = 'gone'; }
      } else if (o.state === 'free') {
        animateCrab(g, dt, { dance: o.t < 2 ? 1 : 0, walk: o.t >= 2 ? 1 : 0 });
        if (o.t > 2) { o.x -= dt * 1.5; g.position.set(o.x, fy(o.x) + 0.02, 0); }
        if (o.t > 6) { g.visible = false; o.state = 'gone'; }
      }
    }
  }

  /** Lost babies: they wiggle until you come, swim after you in a little line, and run to their family. */
  updateBabies(o, dt) {
    const D = this.host.diver, fy = this.floorY;
    for (const p of o.parents) animateCrab(p, dt, { wave: o.state === 'home' ? 0 : 1, dance: o.state === 'home' ? 1 : 0 });
    o.spot.userData.ring.scale.setScalar(1 + Math.sin(this.host.time * 3) * 0.06);
    if (o.state === 'wait') {
      for (const b of o.babies) { b.g.position.set(b.x, fy(b.x) + 0.02, 0.1); animateCrab(b.g, dt, { wiggle: 0.6 }); }
      return;
    }
    if (o.state === 'follow') {
      // a little parade: each baby follows the one in front (the first follows you)
      let lead = { x: D.x - D.dir * 0.6, y: D.y - 0.3 };
      for (const b of o.babies) {
        const dx = lead.x - b.x, dy = lead.y - b.y, d = Math.hypot(dx, dy);
        if (d > 0.7) { const s = Math.min(d - 0.7, dt * Math.max(3, d * 3)); b.x += (dx / d) * s; b.y += (dy / d) * s; }
        b.y = Math.max(b.y, fy(b.x) + 0.05);
        b.g.position.set(b.x, b.y, 0.15);
        b.g.rotation.z = Math.sin(this.host.time * 8 + b.ph) * 0.2;
        animateCrab(b.g, dt, { walk: 1 });
        lead = b;
      }
      o.x = o.babies[0].x; o.y = o.babies[0].y;
      if (o.bubble) o.bubble.visible = false;
      if (Math.hypot(o.babies[0].x - o.to.x, o.babies[0].y - o.to.y) < 2.2) {
        o.state = 'home';
        o.t = 0;
        this.hearts(o.to.x, o.to.y);
        this.host.bag('conchShell');
        this.helpedOne(o, 'baby', 'home');
        o.state = 'home';
        this.say('crab.t.home');
      }
      return;
    }
    // home: the babies run to the family and everyone dances
    o.babies.forEach((b, i) => {
      const tx = o.to.x + (i - 1) * 0.45, ty = fy(tx) + 0.02;
      b.x += (tx - b.x) * Math.min(1, dt * 3); b.y += (ty - b.y) * Math.min(1, dt * 3);
      b.g.position.set(b.x, b.y, 0.1);
      b.g.rotation.z = 0;
      animateCrab(b.g, dt, { dance: 1 });
    });
  }
}
