import * as THREE from 'three';
import { t } from '../../core/i18n.js';
import { say as speak } from '../../core/voice.js';
import { heightAt } from './map.js';
import { give } from './save.js';
import { weekIndex } from './calendar.js';
import { makeSled, makeSnowman, makeSledRamp, makeSnowflake } from './models3.js';

// Winter sledding on kite hill (milestone B3). In winter weeks a sled waits on a little start ramp east of
// the balloon. [A] starts the ride: the sled whooshes down the ramp and glides east across the snow; the
// stick steers up and down to catch snowflakes and to steer around two snowmen (bumping one just slows you
// down with a giggle). The first ride of every winter week brings a mug of hot cocoa and a few coins.

// The run: a ramp down kite hill's east side, then along a gentle curve north of the store and the hall
// (where the camera can always see you). Positions on the run are (distance along it, sideways offset).
const Z = -21;
const RAMP = { x0: 9.6, len: 3.8, h: 1.4 };
const LINE = [[9.6, -21], [19, -21], [25, -25.6], [38.5, -26.6]];
const HALF = 1.6; // how far you can steer to each side
const SEGS = [];
let RUN = 0;
for (let i = 1; i < LINE.length; i++) {
  const [ax, az] = LINE[i - 1], [bx, bz] = LINE[i];
  const len = Math.hypot(bx - ax, bz - az);
  SEGS.push({ ax, az, dx: (bx - ax) / len, dz: (bz - az) / len, s0: RUN, len });
  RUN += len;
}
/** World position of (distance along the run, sideways offset; + is to the left, toward the north). */
function at(sAlong, off = 0) {
  const g = SEGS.find((q) => sAlong <= q.s0 + q.len) || SEGS[SEGS.length - 1];
  const k = Math.min(sAlong - g.s0, g.len);
  return { x: g.ax + g.dx * k + g.dz * off, z: g.az + g.dz * k - g.dx * off, dx: g.dx, dz: g.dz };
}
const START = { x: RAMP.x0 - 0.2, z: Z };
const FLAKES = [[5, 0.9], [8, -0.9], [11.5, 0.8], [15, -0.7], [19.5, 0.9], [24, -0.9]].map(([sa, o]) => at(sa, o));
const SNOWMEN = [[13.4, 0.1], [21.5, -0.2]].map(([sa, o]) => at(sa, o));

export class Sled {
  constructor(host) {
    this.host = host;
    const S = host.save;
    if (!S.sled) S.sled = { week: null, rides: 0 };
    const map = host.map;
    this.group = new THREE.Group();
    const base = heightAt(RAMP.x0 + RAMP.len, Z);
    this.baseY = base;
    const ramp = makeSledRamp(RAMP.len, RAMP.h);
    ramp.position.set(RAMP.x0, base, Z);
    this.group.add(ramp);
    this.sled = makeSled();
    this.group.add(this.sled);
    this.snowmen = SNOWMEN.map(({ x, z }) => {
      const m = makeSnowman();
      m.position.set(x, heightAt(x, z), z);
      m.rotation.y = -0.4;
      this.group.add(m);
      return { x, z, m };
    });
    this.flakes = FLAKES.map(({ x, z }) => {
      const m = makeSnowflake();
      this.group.add(m);
      return { x, z, m };
    });
    host.scene.add(this.group);
    this.obs = [
      map.boxObs(RAMP.x0 + RAMP.len / 2 + 0.3, Z, RAMP.len / 2 + 0.2, 1.0, { sled: true }),
      ...this.snowmen.map((s) => map.circObs(s.x, s.z, 0.5, { sled: true })),
    ];
    this.ride = null;
    this.parkSled();
    this.setWinter(false);
  }

  get S() { return this.host.save; }

  /** Show the run only in winter weeks (and move its obstacles away otherwise). */
  setWinter(on) {
    this.on = on;
    this.group.visible = on;
    for (const o of this.obs) { if (o.ox === undefined) o.ox = o.x; o.x = on ? o.ox : 1e5; }
  }

  parkSled() {
    this.sled.position.set(START.x - 0.7, this.rampY(START.x - 0.7) + 0.05, Z + 1.3);
    this.sled.rotation.set(0, 0, 0);
  }

  /** Height of the run at (x, z): the ramp, then the snowy ground. */
  rampY(x, z = Z) {
    const k = (x - RAMP.x0) / RAMP.len;
    const ground = heightAt(x, z);
    if (Math.abs(z - Z) > 1.2) return ground;
    if (k < 0) return Math.max(ground, this.baseY + RAMP.h + 0.04);
    if (k > 1) return ground;
    return Math.max(ground, this.baseY + RAMP.h * (1 - k) + 0.08);
  }

  interactions(P, out, nm) {
    if (!this.on || out.a) return;
    const sx = this.sled.position.x, sz = this.sled.position.z;
    if (Math.hypot(P.x - sx, P.z - sz) < 1.7) out.a = { text: nm('isl.h.sled'), fn: () => this.start(), ok: true };
  }

  start() {
    const host = this.host;
    host.mode = 'sled';
    this.ride = { s: -0.2, off: 0, x: START.x, z: Z, y: this.rampY(START.x), v: 4.5, t: 0, got: new Set(), bumped: new Set(), done: false, endT: 0, dir: { x: 1, z: 0 } };
    for (const f of this.flakes) f.m.visible = true;
    host.game.audio.play('whoosh');
    host.hud.setPrompt('');
  }

  update(inp, dt) {
    const host = this.host, P = host.player, r = this.ride;
    if (!r) { host.mode = 'walk'; return; }
    r.t += dt;
    if (!r.done) {
      const onRamp = r.s < RAMP.len;
      r.v = Math.max(0, r.v + (onRamp ? 7 : -1.15) * dt);
      r.s += r.v * dt;
      r.off = THREE.MathUtils.clamp(r.off + (inp?.y || 0) * 3.4 * dt, -HALF, HALF);
      const p = at(Math.max(0, r.s), r.off);
      r.x = p.x; r.z = p.z;
      r.dir = { x: p.dx, z: p.dz };
      r.y = this.rampY(r.x, r.z);
      for (const [i, f] of this.flakes.entries()) {
        if (r.got.has(i) || Math.hypot(r.x - f.x, r.z - f.z) > 0.85) continue;
        r.got.add(i);
        f.m.visible = false;
        host.confetti.burst(new THREE.Vector3(f.x, r.y + 1.2, f.z), 0, { count: 12, speed: 3, up: 3, colors: [0xbff6ff, 0xffffff], life: 0.8, gravity: -6 });
        host.game.audio.play('coin');
      }
      for (const [i, sm] of this.snowmen.entries()) {
        if (r.bumped.has(i) || Math.hypot(r.x - sm.x, r.z - sm.z) > 0.95) continue;
        r.bumped.add(i);
        r.v *= 0.55;
        sm.wob = 1;
        host.puffs.burst(new THREE.Vector3(sm.x, 1.0 + sm.m.position.y, sm.z), 0xffffff, { count: 16, speed: 4, size: 0.4 });
        host.game.audio.play('boing');
      }
      if ((!onRamp && r.v < 0.3) || r.s >= RUN) this.finish();
      // a little spray of snow behind the sled
      if (r.v > 2 && Math.random() < 0.5) host.puffs.burst(new THREE.Vector3(r.x - r.dir.x * 0.6, r.y + 0.1, r.z - r.dir.z * 0.6), 0xffffff, { count: 1, speed: 1, up: 1, size: 0.25, life: 0.5 });
    } else {
      r.endT += dt;
      if (r.endT > 0.5 && (inp?.aPressed || inp?.bPressed || r.endT > 2.5)) { this.leave(); return; }
    }
    // the bean rides on the sled
    const slope = r.s > 0 && r.s < RAMP.len ? Math.atan2(RAMP.h, RAMP.len) : 0;
    this.sled.position.set(r.x, r.y, r.z);
    this.sled.rotation.set(0, Math.atan2(-r.dir.z, r.dir.x), -slope);
    P.x = r.x; P.z = r.z; P.y = r.y + 0.22; P.fx = r.dir.x; P.fz = r.dir.z;
    P.ch.face(r.dir.x, r.dir.z);
    P.moving = 0;
    host.hud.setPrompt(r.done ? '' : t('isl.sled.ride', { n: r.got.size, m: this.flakes.length }));
  }

  finish() {
    const host = this.host, r = this.ride, S = this.S;
    r.done = true;
    r.endT = 0;
    S.sled.rides++;
    const n = r.got.size;
    const txt = t(n === this.flakes.length ? 'isl.sled.all' : 'isl.sled.done', { n, m: this.flakes.length });
    host.game.ui.toast(txt, 2600);
    speak(txt);
    host.game.audio.play(n >= 4 ? 'fanfare' : 'star');
    const week = weekIndex();
    if (S.sled.week !== week) {
      // the first ride of the winter week: hot cocoa and a few coins
      S.sled.week = week;
      give(S, 'cocoa', 1);
      host.gotToast(t('isl.i.cocoa'));
      host.grant({ coins: 25 + n * 5 });
    }
    if (!S.deco.snowGlobe) host.addDeco('snowGlobe'); // a keepsake from the very first ride
    host.markDirty();
  }

  leave() {
    const host = this.host, P = host.player;
    this.ride = null;
    host.mode = 'walk';
    P.y = host.map.floorAt(P.x, P.z, host.save.unlocks.bridge);
    if (!host.map.walkable(P.x, P.z, 0.42, host.walkState)) host.unstick(P, host.walkState);
    this.parkSled();
    for (const f of this.flakes) f.m.visible = true;
    host.hud.setPrompt('');
  }

  animate(dt, time) {
    if (!this.on) return;
    for (const [i, f] of this.flakes.entries()) {
      f.m.position.set(f.x, heightAt(f.x, f.z) + 0.9 + Math.sin(time * 2 + i) * 0.15, f.z);
      f.m.rotation.y += dt * 1.5;
    }
    for (const s of this.snowmen) {
      s.wob = Math.max(0, (s.wob || 0) - dt * 1.5);
      s.m.rotation.z = Math.sin(s.wob * 18) * s.wob * 0.25;
    }
  }
}
