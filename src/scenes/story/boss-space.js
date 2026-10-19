import * as THREE from 'three';
import { COLORS, PLAYER_COLORS, toon, basic, sharedGeo } from '../../core/palette.js';
import { skyTexture, seeded } from '../../core/world.js';
import { t, addStrings } from '../../core/i18n.js';
import { BossScene, volley } from './boss-common.js';
import { darken } from '../../core/character.js';
import { makeGrumble } from '../../core/critters.js';

// Starry Space boss (side view): the Grumble King sits on his little moon and blows bubble
// rings across the sky. Steer your rocket through them with the stick; A gives a short boost.
// Golden rings count double. Rings that float away just fade out.
//
// Opposition (harmless, telegraphed): he takes a deep breath and a purple stripe flashes across
// the sky at a rocket's height; a moment later he sneezes a stream of sticky bubbles along it.
// Get out of the stripe! A sticky bubble holds your rocket for a moment (no rings while stuck).
// Phase 2 (a third of the goal): grumble comets wobble across the sky; touching one also sticks
// you. Phase 3: sneezes come faster and there is one more comet.
// Scaling with n players: goal 12 + 4n rings (stages.js), rings blown faster for bigger teams,
// sneeze stripes per volley ceil(n/2) (+1 in phase 3), comets ceil(n/2) (+1 in phase 3).

addStrings({
  en: {
    'bosss.hint': 'Stick: fly · [A]: boost · fly through the bubble rings · fly out of the purple stripes!',
    'bosss.gold': 'Golden ring! +2',
    'bosss.p1': 'Grumble comets! Fly around them!',
    'bosss.p2': 'Achoo! He sneezes faster now!',
  },
  no: {
    'bosss.hint': 'Pinnen: fly · [A]: fart · fly gjennom bobleringene · fly ut av de lilla stripene!',
    'bosss.gold': 'Gullring! +2',
    'bosss.p1': 'Grumle-kometer! Fly rundt dem!',
    'bosss.p2': 'Atsjo! Nå nyser han fortere!',
  },
});

const X0 = -14, X1 = 4.5, Y0 = 0.8, Y1 = 12.2;
const KING_X = 11.5;
const RING_R = 1.05;
const FLY = 8;
const BOOST = 14;
const STUCK = 1.4; // seconds a sticky bubble holds a rocket
const SAFE = 1.0; // blinking grace afterwards
const BAND_H = 0.8; // half height of a sneeze stripe
const BAND_WARN = 1.15; // seconds the stripe flashes before the sneeze
const SNEEZE_SPEED = 22;
const BAND_GAP = [3.4, 2.9, 2.4]; // seconds between sneezes, per phase
const MARK_COLOR = 0x8a63f0;

export class BossSpaceScene extends BossScene {
  constructor(game, opts) {
    super(game, opts, { chapter: 3, kingSize: 2.2 });
    this.camera.fov = 42;
    this.scene.background = skyTexture('#120a35', '#4a2f8f');
    const hemi = new THREE.HemisphereLight(0xe8e0ff, 0x6a4fb0, 1.7);
    const sun = new THREE.DirectionalLight(0xfff2dd, 1.8);
    sun.position.set(-10, 20, 25);
    this.scene.add(hemi, sun);
    this.buildSpace();

    this.k = { y: 6, vy: 0, goal: 6, think: 0, blowT: 1.5, blowing: 0, made: 0 };
    this.king.group.position.set(KING_X, 6, 0);
    this.king.group.rotation.y = -Math.PI / 2 + 0.5; // faces left, a little toward us
    this.rings = [];
    // Seconds between rings: 2.4 solo, faster for bigger teams (1.85, 1.5, 1.26, 1.1, 0.96).
    this.interval = Math.max(0.65, 2.4 / (1 + 0.3 * (this.n - 1)));
    this.bands = [];
    this.helpers = [];
    this.sneezeT = 3;

    const n = this.players.length;
    this.players.forEach((p, i) => {
      const e = this.makeBean(p, -10, n === 1 ? 6 : 2.5 + (7 * i) / (n - 1));
      e.y = e.z; e.z = 0; // side view: x/y plane
      e.ring.visible = false;
      e.boostT = 0; e.boostCd = 0; e.stuck = 0;
      e.bubble = new THREE.Mesh(sharedGeo('bsSticky', () => new THREE.SphereGeometry(1, 18, 12)), toon(0xc9a8ff, { transparent: true, opacity: 0.45 }));
      e.bubble.visible = false;
      this.scene.add(e.bubble);
      e.rocket = this.makeRocket(p.color);
      e.ch.group.add(e.rocket);
      e.ch.group.scale.setScalar(0.9);
    });
    this.start('space');
  }

  frame() {
    const cx = (X0 + KING_X) / 2 + 0.6;
    const d = this.fitDistance(KING_X - X0 + 6, Y1 - Y0 + 3.5);
    this.camera.position.set(cx, (Y0 + Y1) / 2 + 0.3, d);
    this.camera.lookAt(cx, (Y0 + Y1) / 2 + 0.3, 0);
  }

  buildSpace() {
    const s = this.scene;
    const rand = seeded(77);
    // Twinkly star field behind everything.
    const count = 260;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (rand() - 0.5) * 90;
      pos[i * 3 + 1] = -12 + rand() * 45;
      pos[i * 3 + 2] = -20 - rand() * 30;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.stars = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xfff6c9, size: 0.35 }));
    s.add(this.stars);
    // Planets.
    const planets = [[-20, 15, -25, 3, 0xff9fd0], [30, 22, -40, 4.5, 0x8fd8ff], [-6, -6, -18, 2.2, 0xffe47a], [8, 18, -35, 2.6, 0x9ff0c8]];
    for (const [x, y, z, r, c] of planets) {
      const p = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), toon(c));
      p.position.set(x, y, z);
      s.add(p);
      if (r > 2.5) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(r * 1.5, r * 0.08, 6, 40), toon(COLORS.white));
        ring.position.copy(p.position);
        ring.rotation.set(1.2, 0.3, 0);
        s.add(ring);
      }
    }
    // The King's little crescent moon seat.
    const moon = new THREE.Group();
    const ball = new THREE.Mesh(sharedGeo('bsMoon', () => new THREE.SphereGeometry(1.6, 24, 16)), toon(0xfff1b8));
    ball.scale.set(1.2, 0.55, 1.2);
    moon.add(ball);
    for (let i = 0; i < 4; i++) {
      const crater = new THREE.Mesh(sharedGeo('bsCrater', () => new THREE.CircleGeometry(0.25, 12)), toon(0xf0d98a));
      crater.position.set(-1 + i * 0.6, -0.1 - (i % 2) * 0.2, 1.92 - Math.abs(i - 1.5) * 0.15);
      moon.add(crater);
    }
    s.add(moon);
    this.moon = moon;
  }

  makeRocket(color) {
    // A little rocket seat the bean rides on, with a flame at the back.
    const g = new THREE.Group();
    const body = new THREE.Mesh(sharedGeo('bsRocket', () => new THREE.CapsuleGeometry(0.32, 1.0, 6, 12)), toon(COLORS.icing));
    body.rotation.x = Math.PI / 2; // the bean's front is +z, so the rocket points along z
    body.position.set(0, 0.1, 0);
    const nose = new THREE.Mesh(sharedGeo('bsNose', () => new THREE.ConeGeometry(0.3, 0.45, 12)), toon(color));
    nose.rotation.x = Math.PI / 2;
    nose.position.set(0, 0.1, 0.95);
    const fin = new THREE.Mesh(sharedGeo('bsFin', () => new THREE.BoxGeometry(0.06, 0.5, 0.4)), toon(darken(color, 0.8)));
    fin.position.set(0, 0.4, -0.55);
    const flame = new THREE.Mesh(sharedGeo('bsFlame', () => new THREE.ConeGeometry(0.22, 0.7, 10)), basic(0xffc93c));
    flame.rotation.x = -Math.PI / 2;
    flame.position.set(0, 0.1, -1.05);
    g.add(body, nose, fin, flame);
    g.userData.flame = flame;
    return g;
  }

  blowRing() {
    const k = this.k;
    k.made++;
    const gold = k.made % 6 === 0;
    const mesh = new THREE.Mesh(
      sharedGeo('bsRing', () => new THREE.TorusGeometry(RING_R, 0.13, 10, 28)),
      gold ? toon(COLORS.gold, { emissive: 0x332200 }) : toon(0xbfe9ff, { transparent: true, opacity: 0.75 }),
    );
    mesh.rotation.y = 0.65; // seen at an angle so it reads as a ring you fly through
    const y = k.y + 1.3;
    mesh.position.set(KING_X - 2, y, 0);
    mesh.scale.setScalar(0.2);
    this.scene.add(mesh);
    this.rings.push({ mesh, x: KING_X - 2, y, baseY: y, vx: -(3.2 + Math.random() * 1.6), wave: Math.random() < 0.5 ? 0 : 0.8 + Math.random() * 1.2, phase: Math.random() * 6, age: 0, gold });
    k.blowing = 0.35;
    this.king.squash(1.15);
    this.game.audio.play('bubble');
  }

  updateKing(dt) {
    const k = this.k;
    const playing = this.state === 'play' && !this.finished;
    k.think -= dt;
    if (k.think <= 0) { k.goal = 2 + Math.random() * 7.5; k.think = 1.5 + Math.random() * 1.5; }
    k.vy += ((k.goal - k.y) * 1.2 - k.vy) * Math.min(1, dt * 2);
    k.y += k.vy * dt;
    if (playing) {
      k.blowT -= dt;
      if (k.blowT <= 0) { this.blowRing(); k.blowT = this.interval * (0.8 + Math.random() * 0.4); }
    }
    k.blowing = Math.max(0, k.blowing - dt);
    this.moon.position.set(KING_X, k.y - 0.2, 0);
    const g = this.king.group;
    g.position.set(KING_X, k.y + 0.25, 0);
    if (this.finished) g.rotation.y += dt * 3;
    this.king.update(dt, { dizzy: this.finished });
    if (this.finished) this.king.setMood('laugh');
    else this.king.setMood(k.blowing > 0 ? 'happy' : 'grumpy');
    // Taking a deep breath before a sneeze: he puffs up.
    k.breath = Math.max(0, (k.breath || 0) - dt);
    if (k.breath > 0 && !this.finished) this.king.inner.scale.multiplyScalar(1 + (1 - k.breath / BAND_WARN) * 0.15);
  }

  onPhase(p) {
    this.game.audio.play(p === 1 ? 'trap' : 'whoosh');
    this.game.ui.toast(t(`bosss.p${p}`), 2600);
  }

  /** Stick a rocket in a sticky bubble for a moment. */
  stick(e) {
    if (e.stuck > 0 || e.safe > 0 || this.finished) return;
    e.stuck = STUCK;
    e.safe = STUCK + SAFE;
    e.slips = (e.slips || 0) + 1;
    e.vx *= 0.2; e.vy = 1;
    this.game.audio.play('bubble');
    e.ch.squash(0.75);
  }

  /** A deep breath: the stripe flashes at this rocket's height, then the sneeze sweeps along it. */
  addBand(e) {
    const y = THREE.MathUtils.clamp(e.y + 0.5, Y0 + 0.5, Y1);
    const len = KING_X - X0 + 2;
    const g = new THREE.Group();
    const fill = new THREE.Mesh(sharedGeo('bsBand', () => new THREE.PlaneGeometry(1, 1)), basic(MARK_COLOR, { transparent: true, opacity: 0.18, depthWrite: false }));
    fill.scale.set(len, BAND_H * 2, 1);
    g.add(fill);
    for (const sy of [-1, 1]) {
      const edge = new THREE.Mesh(sharedGeo('bsBand', () => new THREE.PlaneGeometry(1, 1)), basic(MARK_COLOR));
      edge.scale.set(len, 0.08, 1);
      edge.position.y = sy * BAND_H;
      g.add(edge);
    }
    g.position.set((X0 - 2 + KING_X) / 2 - 1, y, -0.3);
    this.scene.add(g);
    const puffs = [];
    for (let i = 0; i < 6; i++) {
      const m = new THREE.Mesh(sharedGeo('bsSneeze', () => new THREE.SphereGeometry(0.45, 12, 9)), toon(0xc9a8ff, { transparent: true, opacity: 0.7 }));
      m.visible = false;
      this.scene.add(m);
      puffs.push(m);
    }
    this.bands.push({ g, y, t: 0, front: null, puffs, hit: new Set() });
  }

  updateBands(dt) {
    const playing = this.state === 'play' && !this.finished;
    if (playing) {
      this.sneezeT -= dt;
      if (this.sneezeT <= 0) {
        this.sneezeT = BAND_GAP[this.phase] * (0.9 + Math.random() * 0.2);
        // One stripe per target rocket, never two on top of each other.
        const pool = this.ents.filter((e) => e.stuck <= 0).sort(() => Math.random() - 0.5);
        const picked = [];
        for (const e of pool) {
          if (picked.length >= volley(this.n, this.phase)) break;
          if (picked.every((o) => Math.abs(o.y - e.y) > BAND_H * 2.2)) picked.push(e);
        }
        if (this.n === 1 && this.phase >= 2 && picked.length) {
          // Solo phase 3: a second stripe just above or below, so there is less room to hide.
          const e = picked[0];
          picked.push({ y: e.y + (e.y > 6 ? -2.4 : 2.4) });
        }
        picked.forEach((e) => this.addBand(e));
        if (picked.length) { this.k.breath = BAND_WARN; this.king.squash(1.25); }
      }
    }
    for (const b of this.bands) {
      b.t += dt;
      // Flash while warning.
      b.g.visible = b.t > BAND_WARN || Math.floor(b.t * 8) % 2 === 0;
      if (b.t >= BAND_WARN) {
        if (b.front === null) { b.front = KING_X - 2; this.game.audio.play('whoosh'); this.king.squash(0.8); }
        b.front -= SNEEZE_SPEED * dt;
        b.puffs.forEach((m, i) => {
          const x = b.front + i * 1.1;
          m.visible = x < KING_X - 1.5;
          m.position.set(x, b.y + Math.sin(this.time * 9 + i) * 0.25, 0);
        });
        if (playing) {
          for (const e of this.ents) {
            if (b.hit.has(e)) continue;
            if (Math.abs(e.y + 0.5 - b.y) < BAND_H && e.x > b.front - 0.4 && e.x < b.front + 6.6) { b.hit.add(e); this.stick(e); }
          }
        }
        if (b.front < X0 - 10 || !playing) b.done = true;
      }
      if (b.done) { this.scene.remove(b.g); for (const m of b.puffs) this.scene.remove(m); }
    }
    this.bands = this.bands.filter((b) => !b.done);
  }

  /** Grumble comets from phase 2: they wobble across the sky from right to left. */
  updateHelpers(dt) {
    const playing = this.state === 'play' && !this.finished;
    const want = this.phase === 0 ? 0 : Math.min(4, Math.ceil(this.n / 2) + (this.phase >= 2 ? 1 : 0));
    if (playing && this.helpers.length < want && Math.random() < dt * 1.5) {
      const mesh = new THREE.Group();
      const body = makeGrumble();
      body.rotation.y = -Math.PI / 2;
      body.position.y = -0.45;
      mesh.add(body);
      for (let i = 0; i < 3; i++) {
        const tail = new THREE.Mesh(sharedGeo('bsTail', () => new THREE.SphereGeometry(0.22, 8, 6)), toon(0xfff1b8));
        tail.position.set(0.55 + i * 0.4, 0, -0.1);
        tail.scale.setScalar(1 - i * 0.25);
        mesh.add(tail);
      }
      mesh.scale.setScalar(1.2);
      const y = Y0 + 1 + Math.random() * (Y1 - Y0 - 2);
      this.scene.add(mesh);
      this.helpers.push({ mesh, x: X1 + 4, y, baseY: y, vx: -(2.8 + Math.random() * 1.2 + this.phase * 0.4), phase: Math.random() * 6 });
    }
    for (const h of this.helpers) {
      h.x += h.vx * dt;
      h.y = h.baseY + Math.sin(this.time * 1.6 + h.phase) * 1.3;
      h.mesh.position.set(h.x, h.y, 0.2);
      if (this.finished) h.mesh.rotation.z += dt * 5;
      if (h.x < X0 - 3) h.done = true;
      if (!playing) continue;
      for (const e of this.ents) if (Math.hypot(e.x - h.x, e.y + 0.5 - h.y) < 0.95) this.stick(e);
    }
    for (const h of this.helpers) if (h.done) this.scene.remove(h.mesh);
    this.helpers = this.helpers.filter((h) => !h.done);
  }

  updateBoss(dt) {
    this.updateBands(dt);
    this.updateHelpers(dt);
    this.stars.rotation.z = Math.sin(this.time * 0.05) * 0.02;
    this.updateKing(dt);
    // Rockets: free 2D flight with a soft, floaty feel.
    for (const e of this.ents) {
      e.stuck -= dt; e.safe = (e.safe || 0) - dt;
      const stuck = e.stuck > 0;
      const inp = this.state === 'play' && !stuck ? this.input(e.p) : null;
      const ix = inp ? inp.x : 0, iy = inp ? (stuck ? 0.15 : inp.y) : stuck ? 0.15 : 0;
      e.boostT -= dt; e.boostCd -= dt;
      if (inp?.aPressed && e.boostCd <= 0) {
        e.boostT = 0.45; e.boostCd = 1.1;
        this.game.audio.play('dash');
        e.ch.squash(0.8);
      }
      const top = e.boostT > 0 ? BOOST : FLY;
      const acc = 26 * dt;
      e.vx += THREE.MathUtils.clamp(ix * top - e.vx, -acc, acc);
      e.vy += THREE.MathUtils.clamp(iy * top - e.vy, -acc, acc);
      e.x = THREE.MathUtils.clamp(e.x + e.vx * dt, X0, X1);
      e.y = THREE.MathUtils.clamp(e.y + e.vy * dt, Y0, Y1);
      if (e.x <= X0 || e.x >= X1) e.vx *= -0.3;
      if (e.y <= Y0 || e.y >= Y1) e.vy *= -0.3;
      e.ch.group.position.set(e.x, e.y + Math.sin(this.time * 3 + e.x) * 0.06, 0);
      e.ch.targetYaw = 0.9 + THREE.MathUtils.clamp(-e.vx * 0.04, -0.3, 0.3);
      e.ch.group.rotation.z = THREE.MathUtils.clamp(e.vy * 0.04, -0.35, 0.35);
      e.ch.update(dt, { moving: 0, grounded: true });
      e.bubble.visible = stuck;
      if (stuck) {
        e.bubble.position.set(e.x, e.y + 0.45, 0);
        e.bubble.scale.setScalar(1.05 + Math.sin(this.time * 10) * 0.05);
        e.ch.group.rotation.z = Math.sin(this.time * 6) * 0.3;
      }
      e.ch.group.visible = !(e.safe > 0 && !stuck && Math.floor(e.safe * 12) % 2 === 0) || this.finished;
      const fl = e.rocket.userData.flame;
      fl.scale.set(1, 0.7 + Math.hypot(e.vx, e.vy) * 0.06 + (e.boostT > 0 ? 0.6 : 0) + Math.random() * 0.15, 1);
    }
    // Rocket bumps.
    for (let i = 0; i < this.ents.length; i++) {
      for (let j = i + 1; j < this.ents.length; j++) {
        const a = this.ents[i], b = this.ents[j];
        const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
        if (d < 1.0 && d > 1e-4) {
          const push = (1.0 - d) / 2;
          a.x -= (dx / d) * push; a.y -= (dy / d) * push;
          b.x += (dx / d) * push; b.y += (dy / d) * push;
        }
      }
    }
    // Rings drift left; flying through one pops it.
    for (const r of this.rings) {
      r.age += dt;
      r.x += r.vx * dt;
      r.y = r.baseY + Math.sin(r.age * 2 + r.phase) * r.wave;
      r.mesh.position.set(r.x, r.y, 0);
      r.mesh.scale.setScalar(Math.min(1, 0.2 + r.age * 2.5) * (r.gold ? 1.15 : 1));
      if (r.x < X0 - 2) { r.done = true; continue; }
      if (this.state !== 'play' || this.finished || r.age < 0.6) continue;
      for (const e of this.ents) {
        // You have to be flying (not parked) for a ring to count.
        if (Math.hypot(e.vx, e.vy) < 2 && e.boostT <= 0) continue;
        if (e.stuck > 0) continue; // stuck in a sneeze bubble
        if (Math.abs(e.x - r.x) < 0.55 && Math.abs(e.y + 0.55 - r.y) < RING_R * 0.85) {
          r.done = true;
          this.confetti.burst(new THREE.Vector3(r.x, r.y, 0), 0, { count: 22, speed: 5, colors: r.gold ? [COLORS.gold, COLORS.white] : [0xbfe9ff, e.p.color, COLORS.white], life: 0.9 });
          if (r.gold) this.game.ui.toast(t('bosss.gold'), 1100);
          this.game.audio.play(r.gold ? 'coin' : 'pop');
          this.addPoint(e, null, r.gold ? 2 : 1);
          break;
        }
      }
    }
    for (const r of this.rings) if (r.done) this.scene.remove(r.mesh);
    this.rings = this.rings.filter((r) => !r.done);
    if (this.finished && Math.random() < dt * 4) {
      this.confetti.burst(new THREE.Vector3(KING_X + (Math.random() - 0.5) * 3, this.k.y + 3, 0), 0, { count: 12, speed: 4, colors: PLAYER_COLORS.map((c) => c.hex) });
    }
  }

  onStart() {
    this.game.ui.toast(t('bosss.hint'), 4000);
  }
}
