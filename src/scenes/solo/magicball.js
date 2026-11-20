import * as THREE from 'three';
import { t, addStrings } from '../../core/i18n.js';
import { aimLevel, aimAt, homeToward } from '../../core/assist.js';
import { StepTeacher } from '../../core/tutorial.js';
import { report } from '../../core/passport.js';
import { basic } from '../../core/palette.js';
import { markA11y } from '../../core/outline.js';
import { dayKey } from './calendar.js';
import { count } from './save.js';
import { heightAt, cliffZ, SEA_Y } from './map.js';
import { ITEMS, addIcons } from './items.js';
import { mesh, box, sph, cyl, cone } from './models.js';

// The magic ball (the odd-adventure round, part 1). Tinka the inventor mails it ahead of her move. Hold it (a hotbar
// slot, next to the Zip-Zap) and [B] throws it the way you face: it flies low over the ground, bounces off walls, rocks,
// trees and cliffs (twice; Tinka's springs add a third and a fourth bounce), rings bells, wakes switches and knocks
// fruit from the choppable trees, then always flies back to your hand. While you hold it a dotted aim line shows where
// it goes: up to the first wall, or with "Help me play" aim help further (a little: past the first bounce; a lot: every
// bounce, and it bends a little toward a target in front of you).
// Places for it: three bells under the cliffs north of Aunt Hazel's (ring all three before they stop humming; all
// three with one throw is Coach's trial), an old switch door in the cliff by the woodpile that only wakes for a ball
// that bounced first (Tinka's old storeroom), the fruit trees (an apple, once a day each), and two existing puzzles
// where it fits: a villager's little lost thing up on a roof or a rock (the ball knocks it down to you) and Skye's
// goggles. Save: S.odd.ball = { have, bounces, bells, door, fruit: { day, trees }, throws }.

const SPEED = 15, BACK = 17, MAX_DIST = 24, R = 0.2, HOVER = 0.8, SUB = 0.12;
export const BELLS = [{ x: -11.2, z: -29.0, note: 523 }, { x: -9.0, z: -30.1, note: 659 }, { x: -6.6, z: -29.5, note: 784 }];
const BELL_R = 0.45, HUM = 8; // seconds the bells keep humming (all three rung within: done)
export const BALL_DOOR = { x: 34, z: -31.5, sw: { x: 36.6, z: -29.6 }, chest: { x: 34, z: -30.3 } };
const AIM_SHOW = [0, 1, 9]; // bounces the aim line shows: aim help off (to the first wall), a little (past it), a lot (every one)

ITEMS.magicBall = { kind: 'gadget' };
ITEMS.apple = { kind: 'forage', sell: 8 };
addIcons({
  magicBall: '<circle cx="12" cy="12" r="8" fill="#9b5de5" stroke="#2b2340" stroke-width="1.2"/><path d="M12 6 L13.4 10.2 L17.6 10.4 L14.3 13 L15.4 17 L12 14.7 L8.6 17 L9.7 13 L6.4 10.4 L10.6 10.2Z" fill="#ffd23f"/><circle cx="9" cy="8" r="1.6" fill="#fff" opacity=".7"/>',
  apple: '<circle cx="12" cy="14" r="7" fill="#ff4f4f" stroke="#2b2340" stroke-width="1.2"/><path d="M12 7 V4" stroke="#8a5a32" stroke-width="1.6"/><path d="M12 6 Q16 2 18 5 Q15 7 12 6Z" fill="#58b947" stroke="#2b2340" stroke-width="1"/><ellipse cx="9.5" cy="11.5" rx="1.6" ry="1" fill="#fff" opacity=".6"/>',
});

addStrings({
  en: {
    'isl.i.magicBall': 'Magic ball', 'isl.i.apple': 'Apple',
    'mb.h.throw': '[B] throw the magic ball', 'mb.h.flying': 'Boing...', 'mb.title': 'The magic ball',
    'mb.task': '🔮 Try Tinka\'s magic ball: hold it ({key}) and press [B]', 'mb.task.bag': 'it is in your bag: {bag}',
    'mb.t.apple': 'An apple fell from the tree!', 'mb.t.appleDone': 'This tree gave you an apple today already.',
    'mb.t.bell': 'Ding! {n} of 3 bells humming...', 'mb.t.bells': 'All three bells ring together! What a sound.',
    'mb.t.bellsOne': 'All three with ONE throw! Amazing aim!',
    'mb.t.switchNo': 'The switch only wakes for a ball that bounced first. Bounce it off the cliff!',
    'mb.t.switch': 'Click! The old door rumbles open.', 'mb.h.chest': '[B] open the old chest',
    'mb.t.chest': 'Tinka\'s old storeroom! Inside: a gear clock and a few coins.', 'mb.h.door': 'An old door with a round switch nearby.',
    'mb.t.knock': 'Bonk! It fell down, right into your hands.',
    'mb.t.bounce': 'Your magic ball can bounce {n} times now!',
    'mb.tut.throw': 'Press [B] to throw the ball at a wall', 'mb.tut.bounce': 'Watch it bounce off the wall', 'mb.tut.catch': 'It always comes back: catch it!',
    'mb.sign.bells': 'Three bells. Can you make them all ring?', 'mb.h.bells': 'Three bells. Throw the magic ball to ring them!',
    'map.a.bells': 'The three bells', 'map.a.ballDoor': 'The old switch door',
    'isl.d.gearClock': 'Gear clock', 'isl.d.tinyBells': 'Tiny bells',
    'isl.mail.od.bounce': 'Hi {name}! I made a tiny spring for your magic ball. I sent it with the wind (do not ask). Your ball can bounce three times now! Tinka',
    'isl.mail.od.bounce2': 'Hello {name}! Another spring, even springier! Your magic ball bounces four times now. Try a long bank shot! Tinka',
    'od.td.bounce': 'Your magic ball feels extra bouncy today. Tinka must be up to something!',
    'od.td.bounce2': 'Boing, boing, boing, boing: your magic ball can bounce four times now.',
  },
  no: {
    'isl.i.magicBall': 'Magisk ball', 'isl.i.apple': 'Eple',
    'mb.h.throw': '[B] kast den magiske ballen', 'mb.h.flying': 'Boing...', 'mb.title': 'Den magiske ballen',
    'mb.task': '🔮 Prøv den magiske ballen til Tinka: hold den ({key}) og trykk [B]', 'mb.task.bag': 'den ligger i sekken: {bag}',
    'mb.t.apple': 'Et eple falt ned fra treet!', 'mb.t.appleDone': 'Dette treet har allerede gitt deg et eple i dag.',
    'mb.t.bell': 'Ding! {n} av 3 bjeller nynner...', 'mb.t.bells': 'Alle tre bjellene ringer sammen! For en lyd.',
    'mb.t.bellsOne': 'Alle tre med ETT kast! For et sikte!',
    'mb.t.switchNo': 'Bryteren våkner bare for en ball som har sprettet først. Sprett den mot fjellet!',
    'mb.t.switch': 'Klikk! Den gamle døra går rumlende opp.', 'mb.h.chest': '[B] åpne den gamle kista',
    'mb.t.chest': 'Tinkas gamle lagerrom! Inni: en tannhjulsklokke og noen mynter.', 'mb.h.door': 'En gammel dør med en rund bryter like ved.',
    'mb.t.knock': 'Bonk! Den falt ned, rett i hendene dine.',
    'mb.t.bounce': 'Den magiske ballen din kan sprette {n} ganger nå!',
    'mb.tut.throw': 'Trykk [B] for å kaste ballen mot en vegg', 'mb.tut.bounce': 'Se den sprette fra veggen', 'mb.tut.catch': 'Den kommer alltid tilbake: ta imot!',
    'mb.sign.bells': 'Tre bjeller. Klarer du å få alle til å ringe?', 'mb.h.bells': 'Tre bjeller. Kast den magiske ballen for å ringe dem!',
    'map.a.bells': 'De tre bjellene', 'map.a.ballDoor': 'Den gamle bryterdøra',
    'isl.d.gearClock': 'Tannhjulsklokke', 'isl.d.tinyBells': 'Små bjeller',
    'isl.mail.od.bounce': 'Hei {name}! Jeg har laget en bitteliten fjær til den magiske ballen din. Jeg sendte den med vinden (ikke spør). Nå kan ballen sprette tre ganger! Tinka',
    'isl.mail.od.bounce2': 'Hallo {name}! En fjær til, enda sprettere! Den magiske ballen din spretter fire ganger nå. Prøv et langt vinkelskudd! Tinka',
    'od.td.bounce': 'Den magiske ballen din føles ekstra sprett i dag. Tinka har nok noe fore!',
    'od.td.bounce2': 'Boing, boing, boing, boing: den magiske ballen din kan sprette fire ganger nå.',
  },
});

export class MagicBall {
  constructor(host, odd) {
    this.host = host;
    this.odd = odd;
    this.fly = null;
    this.teach = null;
    this.bellT = 0;
    this.pathT = 0;
    this.ball = makeBall();
    this.ball.visible = false;
    markA11y(this.ball, 'item'); // ("Strong outlines": the flying ball, the bells and the switch stand out)
    host.scene.add(this.ball);
    this.handBall = makeBall();
    this.handBall.scale.setScalar(0.7);
    // the aim line: little glowing dots along the way
    this.dots = new THREE.Group();
    const dm = new THREE.MeshBasicMaterial({ color: 0xfff3b0, transparent: true, opacity: 0.85, depthWrite: false });
    const dg = new THREE.SphereGeometry(0.07, 8, 6);
    for (let i = 0; i < 60; i++) this.dots.add(new THREE.Mesh(dg, dm));
    this.dots.visible = false;
    host.scene.add(this.dots);
    // the three bells and the switch door
    this.bells = BELLS.map((b, i) => {
      const g = makeBell(i);
      g.position.set(b.x, heightAt(b.x, b.z), b.z);
      markA11y(g, 'target');
      host.scene.add(g);
      host.map.circObs(b.x, b.z, 0.22);
      return { ...b, i, g, at: -99, swing: 0 };
    });
    host.map.addKeepOut(-9, -29.6, 3.2, 'bells');
    this.door = makeSwitchDoor();
    this.door.position.set(BALL_DOOR.x, heightAt(BALL_DOOR.x, BALL_DOOR.z), BALL_DOOR.z);
    host.scene.add(this.door);
    host.map.boxObs(BALL_DOOR.x, BALL_DOOR.z - 0.2, 1.1, 0.4);
    this.sw = makeSwitch();
    markA11y(this.sw, 'target');
    this.sw.position.set(BALL_DOOR.sw.x, heightAt(BALL_DOOR.sw.x, BALL_DOOR.sw.z), BALL_DOOR.sw.z);
    host.scene.add(this.sw);
    host.map.circObs(BALL_DOOR.sw.x, BALL_DOOR.sw.z, 0.25);
    host.map.boxObs(BALL_DOOR.sw.x, BALL_DOOR.sw.z + 0.75, 0.7, 0.18); // the low stone shield in front of it
    host.map.addKeepOut(BALL_DOOR.x + 1, BALL_DOOR.z + 1, 3.2, 'switch door');
    this.chest = makeChest();
    this.chest.position.set(BALL_DOOR.chest.x, heightAt(BALL_DOOR.chest.x, BALL_DOOR.chest.z), BALL_DOOR.chest.z);
    this.chest.visible = false;
    host.scene.add(this.chest);
    this.doorOpen = this.B?.door ? 1 : 0;
  }

  get S() { return this.host.save; }
  /** The ball's save (null until it came). */
  get B() {
    const O = this.odd.O;
    if (!O.ball && (O.got.ball !== undefined || count(this.S, 'magicBall'))) O.ball = { have: false, bounces: 2, bells: false, door: false, chest: false, fruit: { day: '', trees: [] }, throws: 0 };
    return O.ball || null;
  }

  get maxBounces() { return this.B?.bounces || 2; }

  /** Tinka's springs (her letters): one more bounce each. */
  onArrive(id) {
    const B = this.B;
    if (!B) return;
    if (id === 'bounce') B.bounces = Math.max(B.bounces, 3);
    if (id === 'bounce2') B.bounces = Math.max(B.bounces, 4);
  }

  todayNews() { return []; }

  /**
   * Until the first throw: how to hold it. The parcel lands in the bag when the hotbar is full, and the letter only
   * says "hold it" (play-test): the task names the hotbar key, or how to open the bag.
   */
  tasks() {
    const B = this.B, S = this.S;
    if (!B || B.throws || !count(S, 'magicBall') || this.host.held?.id === 'magicBall') return [];
    const it = S.inv.find((x) => x.id === 'magicBall');
    const key = it && it.slot >= 0 && it.slot < 9 ? (this.host.onPad ? t('[ITEMS]') : String(it.slot + 1)) : t('mb.task.bag', { bag: this.host.bagKey() });
    return [t('mb.task', { key })];
  }

  tick() {
    const B = this.B;
    if (B && !B.have && count(this.S, 'magicBall')) { B.have = true; this.host.markDirty(); }
  }

  /** [B] with the ball in hand. */
  action(id, nm) {
    if (id !== 'magicBall' || !this.B) return null;
    if (this.fly) return { text: t('mb.h.flying'), fn: () => {} };
    return { text: nm('mb.h.throw'), fn: () => this.throw(), ok: true };
  }

  // ---------- flying ----------

  get state() { return { bridge: !!this.S.unlocks?.bridge }; }

  /** Is (x, z) solid for the ball at this height? */
  solid(x, z, feet) {
    const map = this.host.map;
    if (z < cliffZ(x) + 0.6 && heightAt(x, z) > feet + 0.6) return 9;
    if (!this.near) return map.overlap(x, z, R, this.state, feet);
    // only the obstacles near the throw (near(): a throw never flies farther than MAX_DIST from where it starts)
    const all = map.obstacles;
    map.obstacles = this.near;
    try { return map.overlap(x, z, R, this.state, feet); } finally { map.obstacles = all; }
  }

  /** Run fn with the obstacles within reach of a throw from (x, z) (the ball is checked often: a few hundred steps). */
  around(x, z, fn) {
    const D = MAX_DIST + 3, keep = this.near;
    this.near = this.host.map.obstacles.filter((o) => (o.ax !== undefined ? Math.min(Math.hypot(o.ax - x, o.az - z), Math.hypot(o.bx - x, o.bz - z)) < D + 6
      : Math.abs(o.x - x) < D + (o.hw ?? o.r ?? 1) && Math.abs(o.z - z) < D + (o.hd ?? o.r ?? 1)));
    try { return fn(); } finally { this.near = keep; }
  }

  /** The wall's normal at a blocked point (pointing out), from the depth around it. */
  normal(x, z, feet, vx, vz) {
    const e = 0.14;
    let nx = this.solid(x - e, z, feet) - this.solid(x + e, z, feet), nz = this.solid(x, z - e, feet) - this.solid(x, z + e, feet);
    const L = Math.hypot(nx, nz);
    if (L < 1e-6) { const v = Math.hypot(vx, vz) || 1; return { x: -vx / v, z: -vz / v }; }
    return { x: nx / L, z: nz / L };
  }

  /** The aim direction from where you stand (aim help bends it toward a target in front of you). */
  aimDir(P) {
    const lv = aimLevel(P.p);
    const tg = this.odd.ballTargets().map((x) => ({ x: x.x, y: x.z }));
    const d = aimAt({ x: P.x, y: P.z }, { x: P.fx, y: P.fz }, tg, lv, { maxDist: 14 });
    const L = Math.hypot(d.x, d.y) || 1;
    return { x: d.x / L, z: d.y / L };
  }

  /** Where the ball would go (the aim line): points, and where it bounces. Stops after `bounces` bounces. */
  path(P, bounces) {
    return this.trace(P.x, P.z, this.aimDir(P), P.fy ?? P.y, bounces).pts;
  }

  /**
   * Follow a throw from (x, z) in direction dir without throwing (the aim line; tests): { pts (every half meter),
   * hits (target ids in order), bounces }. The same steps as the real flight (no aim help bending in flight).
   */
  trace(x0, z0, dir, feet, bounces = this.maxBounces) {
    if (!this.near) return this.around(x0, z0, () => this.trace(x0, z0, dir, feet, bounces));
    const k = this.solid(x0 + dir.x * 0.5, z0 + dir.z * 0.5, feet) > 0 ? 0 : 0.5;
    let x = x0 + dir.x * k, z = z0 + dir.z * k, vx = dir.x, vz = dir.z, dist = 0, b = 0;
    const pts = [], hits = [], targets = this.odd.ballTargets();
    let next = 0.45;
    while (dist < MAX_DIST) {
      const nx = x + vx * SUB, nz = z + vz * SUB;
      if (this.solid(nx, nz, feet) > 0) {
        const n = this.normal(nx, nz, feet, vx, vz);
        const d = vx * n.x + vz * n.z;
        if (d < 0) { vx -= 2 * d * n.x; vz -= 2 * d * n.z; } else { vx = -vx; vz = -vz; }
        if (++b > bounces) break;
        continue;
      }
      x = nx; z = nz; dist += SUB;
      if (dist >= next && pts.length < 60) { next += 0.5; pts.push({ x, z }); }
      for (const tg of targets) if (!hits.includes(tg.id) && Math.hypot(x - tg.x, z - tg.z) <= (tg.r || 0.5) + R) { hits.push(tg.id); if (tg.stop) return { pts, hits, bounces: b }; }
    }
    return { pts, hits, bounces: Math.min(b, bounces) };
  }

  throw() {
    const host = this.host, P = host.player, B = this.B;
    if (!P || !B || this.fly) return;
    const dir = this.aimDir(P);
    const feet = P.fy ?? P.y;
    const k = this.solid(P.x + dir.x * 0.5, P.z + dir.z * 0.5, feet) > 0 ? 0 : 0.5; // (right up against a wall: from the bean itself)
    this.fly = { x0: P.x, z0: P.z, x: P.x + dir.x * k, z: P.z + dir.z * k, y: feet + HOVER, vx: dir.x * SPEED, vz: dir.z * SPEED, b: 0, dist: 0, back: false, t: 0, feet, hit: new Set(), bells: 0, lv: aimLevel(P.p) };
    B.throws = (B.throws || 0) + 1;
    P.ch.face(dir.x, dir.z);
    P.ch.squash(1.15);
    host.swing = 1;
    host.game.audio.play('whoosh');
    this.teach?.did(P.p, 'throw');
    host.markDirty();
  }

  step(dt) {
    if (!this.near) { this.around(this.fly.x0, this.fly.z0, () => this.step(dt)); return; }
    const F = this.fly, host = this.host, P = host.player;
    F.t += dt;
    if (F.back) {
      // home again: straight to your hand, over everything
      const tx = P.x, tz = P.z, ty = P.y + 1.0;
      const dx = tx - F.x, dz = tz - F.z, dy = ty - F.y, d = Math.hypot(dx, dz, dy);
      if (d < 0.5 || F.t > 5) { this.catch(); return; }
      const s = Math.min(d, BACK * dt);
      F.x += (dx / d) * s; F.z += (dz / d) * s; F.y += (dy / d) * s;
      this.ball.position.set(F.x, F.y + Math.sin(F.t * 9) * 0.05, F.z);
      return;
    }
    // whole steps of SUB, like trace() (the aim line shows exactly where it goes)
    F.acc = (F.acc || 0) + Math.hypot(F.vx, F.vz) * dt;
    let left = Math.floor(F.acc / SUB) * SUB;
    F.acc -= left;
    const sp = Math.hypot(F.vx, F.vz) || 1;
    const targets = this.odd.ballTargets();
    if (F.lv) { const v = { x: F.vx, y: F.vz }; homeToward({ x: F.x, y: F.z }, v, targets.filter((x) => !F.hit.has(x.id)).map((x) => ({ x: x.x, y: x.z })), F.lv, dt, { range: 5 }); F.vx = v.x; F.vz = v.y; }
    while (left > SUB * 0.5 && !F.back) {
      const s = SUB;
      left -= s;
      const nx = F.x + (F.vx / sp) * s, nz = F.z + (F.vz / sp) * s;
      if (this.solid(nx, nz, F.feet) > 0) {
        const n = this.normal(nx, nz, F.feet, F.vx, F.vz);
        const d = F.vx * n.x + F.vz * n.z;
        if (d < 0) { F.vx -= 2 * d * n.x; F.vz -= 2 * d * n.z; } else { F.vx = -F.vx; F.vz = -F.vz; }
        F.b++;
        host.game.audio.play('boing');
        host.puffs?.burst(new THREE.Vector3(F.x, F.y, F.z), 0xd9c2ff, { count: 6, speed: 2, size: 0.18, life: 0.35 });
        this.teach?.did(P?.p, 'bounce');
        if (F.b > this.maxBounces) { F.back = true; F.t = 0; }
        continue;
      }
      F.x = nx; F.z = nz; F.dist += s;
      for (const tg of targets) {
        if (F.hit.has(tg.id) || Math.hypot(F.x - tg.x, F.z - tg.z) > (tg.r || 0.5) + R) continue;
        F.hit.add(tg.id);
        tg.hit({ bounced: F.b > 0, ball: F });
        if (tg.stop) { F.back = true; F.t = 0; }
      }
      if (F.dist > MAX_DIST) { F.back = true; F.t = 0; }
    }
    const ground = Math.max(this.host.map.floorAt(F.x, F.z, this.state.bridge), SEA_Y, F.feet - 0.4);
    F.y += (ground + HOVER - F.y) * Math.min(1, dt * 10);
    this.ball.position.set(F.x, F.y, F.z);
    this.ball.rotation.x += dt * 12;
  }

  catch() {
    const host = this.host, P = host.player, F = this.fly;
    this.fly = null;
    this.ball.visible = false;
    host.game.audio.play('pop');
    if (P) P.ch.squash(0.9);
    this.teach?.did(P?.p, 'catch');
    if (F?.bells >= 3) this.oneThrowBells();
  }

  // ---------- targets ----------

  ballTargets() {
    if (!this.B) return [];
    const host = this.host, out = [];
    for (const b of this.bells) out.push({ id: `bell${b.i}`, x: b.x, z: b.z, r: BELL_R, hit: (h) => this.ring(b, h) });
    if (!this.B.door) out.push({ id: 'switch', x: BALL_DOOR.sw.x, z: BALL_DOOR.sw.z, r: 0.45, stop: true, hit: (h) => this.switchHit(h) });
    for (const o of host.zipzap?.trees || []) if (o.g.visible && !o.isle) out.push({ id: `tree${o.key}`, x: o.x, z: o.z, r: 0.75, hit: () => this.fruit(o) });
    // a villager's little lost thing up high (play.js) and Skye's goggles (surprise.js): the ball knocks them down to you
    const pl = host.play;
    if (pl?.thing?.visible) { const a = pl.thingAt(); out.push({ id: 'task', x: a.x, z: a.z, r: 0.7, stop: true, hit: () => this.knock(() => pl.pickThing()) }); }
    const sur = host.surprise;
    if (sur?.goggles?.visible) out.push({ id: 'goggles', x: sur.gogglesAt.x, z: sur.gogglesAt.z, r: 0.7, stop: true, hit: () => this.knock(() => sur.pickGoggles()) });
    return out;
  }

  knock(fn) {
    this.host.game.audio.play('bump');
    this.host.game.ui.toast(t('mb.t.knock'), 2200);
    fn();
    report(this.host, 'island', { key: 'magicball', what: 'knock' });
  }

  fruit(o) {
    const host = this.host, B = this.B, day = dayKey();
    if (B.fruit.day !== day) B.fruit = { day, trees: [] };
    if (B.fruit.trees.includes(o.key)) { host.game.ui.toast(t('mb.t.appleDone'), 1600); return; }
    B.fruit.trees.push(o.key);
    host.puffs?.burst(new THREE.Vector3(o.x, heightAt(o.x, o.z) + 2.2, o.z), 0x7ac943, { count: 10, speed: 2, size: 0.2, life: 0.6, gravity: -8 });
    host.giveItems([['apple', 1]], true);
    host.game.ui.toast(t('mb.t.apple'), 1800);
    report(host, 'island', { key: 'magicball', what: 'fruit' });
    host.markDirty();
  }

  ring(b, h) {
    const host = this.host, A = host.game.audio;
    b.at = this.bellT;
    b.swing = 1;
    if (A.ctx && !A.muted) { A.tone(b.note, 1.2, { type: 'sine', vol: 0.16 }); A.tone(b.note * 2, 0.6, { type: 'sine', vol: 0.05, delay: 0.02 }); }
    if (this.fly) this.fly.bells++;
    const humming = this.bells.filter((x) => this.bellT - x.at < HUM).length;
    if (humming >= 3) {
      for (const x of this.bells) x.at = -99;
      host.game.ui.toast(t('mb.t.bells'), 2600);
      host.confetti?.burst(new THREE.Vector3(-9, heightAt(-9, -29.6) + 2.4, -29.6), 0, { count: 40, speed: 5, up: 4, life: 1.3, gravity: -6, colors: [0xffd23f, 0xffffff, 0x9b5de5] });
      report(host, 'island', { key: 'magicball', what: 'bells' });
      if (!this.B.bells) { this.B.bells = true; host.grant({ coins: 40, deco: 'tinyBells' }); }
      host.markDirty();
    } else host.game.ui.toast(t('mb.t.bell', { n: humming }), 1200);
  }

  /** All three bells with one throw: Coach's trial. */
  oneThrowBells() {
    this.host.game.ui.toast(t('mb.t.bellsOne'), 2600);
    report(this.host, 'island', { key: 'magicball', what: 'bells1' });
    report(this.host, 'trial', { id: 'ball.bells' });
  }

  switchHit(h) {
    const host = this.host;
    if (!h.bounced) { host.game.audio.play('bump'); host.game.ui.toast(t('mb.t.switchNo'), 2600); return; }
    this.B.door = true;
    host.game.audio.play('fanfare');
    host.game.ui.toast(t('mb.t.switch'), 2400);
    report(host, 'island', { key: 'magicball', what: 'door' });
    host.markDirty();
  }

  // ---------- [B] near its places ----------

  interactions(P, out, nm) {
    const B = this.B;
    if (B?.door && !B.chest && Math.hypot(P.x - BALL_DOOR.chest.x, P.z - (BALL_DOOR.chest.z + 0.9)) < 1.4) {
      out.b = { text: nm('mb.h.chest'), fn: () => this.openChest() };
      return true;
    }
    if (Math.hypot(P.x - BALL_DOOR.x, P.z - (BALL_DOOR.z + 1.4)) < 1.3 && !B?.door) { out.b = { text: t('mb.h.door'), fn: () => this.host.game.audio.play('bump') }; return true; }
    if (Math.hypot(P.x + 9, P.z + 28.6) < 2.2) { out.b = { text: t('mb.h.bells'), fn: () => this.host.game.audio.play('select') }; return true; }
    return false;
  }

  openChest() {
    const host = this.host;
    this.B.chest = true;
    this.chest.userData.lid.rotation.x = -1.6;
    host.game.ui.toast(t('mb.t.chest'), 3000);
    host.grant({ coins: 60, deco: 'gearClock' });
    host.markDirty();
  }

  markers() {
    if (!this.B) return [];
    const out = [{ key: 'odd:bells', kind: 'place', icon: '🔔', name: t('map.a.bells'), x: -9, z: -29.6, tx: -9, tz: -27.4 }];
    if (!this.B.chest) out.push({ key: 'odd:balldoor', kind: 'place', icon: '🚪', name: t('map.a.ballDoor'), x: BALL_DOOR.x, z: BALL_DOOR.z, tx: BALL_DOOR.x, tz: BALL_DOOR.z + 2.4 });
    return out;
  }

  // ---------- every frame ----------

  /** The ball's tutorial, the first time you hold it. */
  async startTutorial() {
    const host = this.host, P = host.player;
    this.asked = true;
    const ans = await host.game.askTutorial({ id: 'isl.ball', title: t('mb.title'), players: [P.p] });
    if (host.game.current !== host || ans !== 'show') return;
    this.teach = new StepTeacher(host, {
      id: 'isl.ball', players: [P.p],
      steps: () => [{ key: 'mb.tut.throw', on: 'throw' }, { key: 'mb.tut.bounce', on: 'bounce' }, { key: 'mb.tut.catch', on: 'catch' }],
      where: () => (host.player ? new THREE.Vector3(host.player.x, host.player.y + 2.2, host.player.z) : null),
      onDone: () => { this.teach = null; },
    });
  }

  update(dt) {
    const host = this.host, P = host.player, B = this.B;
    this.bellT += dt;
    // the bells swing and the door swings open (also while a panel is up)
    for (const b of this.bells) { b.swing = Math.max(0, b.swing - dt * 0.8); b.g.userData.bell.rotation.z = Math.sin(this.bellT * 9) * 0.35 * b.swing; }
    const want = B?.door ? 1 : 0;
    if (this.doorOpen !== want) { this.doorOpen += Math.sign(want - this.doorOpen) * Math.min(Math.abs(want - this.doorOpen), dt * 0.8); this.door.userData.leaf.rotation.y = -this.doorOpen * 1.7; }
    this.chest.visible = !!B?.door;
    this.sw.userData.plate.material = B?.door ? this.sw.userData.on : this.sw.userData.off;
    if (!P || !B) { this.dots.visible = false; return; }
    // the ball only flies while you walk about (a panel or a scene freezes it: Start pauses everything)
    if (this.fly && host.mode === 'walk') this.step(dt);
    this.ball.visible = !!this.fly;
    const holding = host.held?.id === 'magicBall';
    if (holding && !this.fly && !this.asked && host.mode === 'walk') this.startTutorial();
    // in your hand
    const inHand = holding && !this.fly;
    if (inHand && this.handBall.parent !== P.hand) P.hand.add(this.handBall);
    if (!inHand && this.handBall.parent) this.handBall.removeFromParent();
    // the aim line (Help me play's aim help shows more of it)
    const show = inHand && host.mode === 'walk' && !host.hud.cinemaOn;
    this.dots.visible = show;
    if (show && (this.pathT -= dt) <= 0) {
      this.pathT = 0.08;
      const pts = this.path(P, AIM_SHOW[aimLevel(P.p)] ?? 1);
      this.dots.children.forEach((d, i) => {
        const p = pts[i];
        d.visible = !!p;
        if (p) d.position.set(p.x, Math.max(heightAt(p.x, p.z), SEA_Y) + HOVER, p.z);
      });
    }
    if (this.teach) { this.teach.hidden = host.mode !== 'walk'; this.teach.update(host.mode === 'walk' ? dt : 0); }
  }

  dispose() { this.teach?.skip?.(); }
}

// ---------- models ----------

function makeBall() {
  const g = new THREE.Group();
  g.add(mesh(sph(0.2, 16, 12), 0x9b5de5, 0, 0, 0));
  const star = mesh(sph(0.08, 8, 6), basic(0xffd23f), 0, 0.15, 0.08, false);
  g.add(star, mesh(sph(0.06, 8, 6), basic(0xffd23f), 0.12, -0.08, 0.1, false), mesh(sph(0.05, 8, 6), basic(0xfff3b0), -0.13, 0.02, 0.1, false));
  return g;
}

function makeBell(i) {
  const g = new THREE.Group();
  const h = 1.5 + i * 0.25;
  g.add(mesh(cyl(0.07, 0.09, h, 8), 0x8a5a32, 0, h / 2, 0), mesh(box(0.7, 0.08, 0.12), 0x8a5a32, 0.25, h, 0));
  const bell = new THREE.Group();
  bell.position.set(0.5, h - 0.05, 0);
  bell.add(mesh(cone(0.26 - i * 0.03, 0.42 - i * 0.04, 14), 0xffc93c, 0, -0.25, 0), mesh(sph(0.06, 8, 6), 0xb8860b, 0, -0.48 + i * 0.04, 0));
  g.add(bell);
  g.userData.bell = bell;
  return g;
}

function makeSwitchDoor() {
  const g = new THREE.Group();
  g.add(mesh(box(2.2, 2.6, 0.5), 0x9a94b2, 0, 1.3, -0.2), mesh(box(2.5, 0.35, 0.6), 0x8a8498, 0, 2.7, -0.15));
  const leaf = new THREE.Group();
  leaf.position.set(-0.6, 0, 0.1);
  leaf.add(mesh(box(1.2, 1.9, 0.12), 0x7a4a2e, 0.6, 0.95, 0), mesh(box(1.25, 0.1, 0.14), 0x3a3a4a, 0.6, 1.5, 0.02), mesh(box(1.25, 0.1, 0.14), 0x3a3a4a, 0.6, 0.45, 0.02));
  leaf.add(mesh(cyl(0.16, 0.16, 0.05, 14), 0xffd23f, 0.6, 1.0, 0.09));
  leaf.children[leaf.children.length - 1].rotation.x = Math.PI / 2;
  g.add(leaf);
  g.add(mesh(box(1.1, 1.85, 0.1), 0x2b2340, 0, 0.95, 0.02)); // the dark inside behind the leaf
  g.userData.leaf = leaf;
  return g;
}

function makeSwitch() {
  const g = new THREE.Group();
  g.add(mesh(cyl(0.18, 0.22, 1.0, 8), 0x9a94b2, 0, 0.5, 0));
  const off = new THREE.MeshToonMaterial({ color: 0x6a6aa0 }), on = new THREE.MeshToonMaterial({ color: 0xffd23f, emissive: 0x6a4a00 });
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.08, 16), off);
  plate.position.set(0, 1.08, 0);
  g.add(plate);
  g.add(mesh(box(1.4, 0.5, 0.25), 0x8a8498, 0, 0.25, 0.75)); // the low stone shield
  g.userData = { plate, on, off };
  return g;
}

function makeChest() {
  const g = new THREE.Group();
  g.add(mesh(box(0.8, 0.45, 0.5), 0x8a5a32, 0, 0.23, 0));
  const lid = new THREE.Group();
  lid.position.set(0, 0.45, -0.25);
  lid.add(mesh(box(0.82, 0.16, 0.52), 0xa0683a, 0, 0.08, 0.25));
  g.add(lid, mesh(box(0.12, 0.16, 0.05), 0xffd23f, 0, 0.4, 0.26));
  g.userData.lid = lid;
  return g;
}
