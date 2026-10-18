import * as THREE from 'three';
import { MiniGame } from '../core/minigame.js';
import { t } from '../core/i18n.js';
import { Character } from '../core/character.js';
import { COLORS, PLAYER_COLORS, toon, basic, sharedGeo, faceted } from '../core/palette.js';
import { skyTexture, seeded } from '../core/world.js';
import { esc } from '../core/ui.js';
import { VotePicker, VOTES } from '../core/vote.js';

// Star Dash: split-screen space race through ring gates.
// Flight feel borrowed from Tachyon-style arcade flight: turn rates ease in and out with a
// little inertia, velocity chases the nose, boost burns a recharging tank, and holding slide
// keeps your momentum while the nose swings freely.
const GATES = 14;
const N = 1200; // course samples
const GATE_R = 7;
const SPEED = 30;
const BOOST = 48;
const YAW_RATE = 1.7;
const PITCH_RATE = 1.3;
const MAX_PITCH = 1.1;
const TURN_RESPONSE = 6;
const GRIP = 2.6;
const FINISH_WAIT = 20;
const LOST_DIST = 55;
const CONTROL = [
  [0, 0, -150], [90, 18, -120], [150, -10, -40], [140, 25, 50], [80, 5, 120], [10, -20, 150],
  [-60, 10, 110], [-80, 35, 40], [-150, 15, 10], [-160, -15, -70], [-100, -25, -130], [-40, 5, -170],
];
const ord = (i) => t(`ord.${i}`);
const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();
const UP = new THREE.Vector3(0, 1, 0);

let dotTex = null;
/** Soft round sprite so point clouds draw as dots instead of squares. */
function dotTexture() {
  if (dotTex) return dotTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.5, 'rgba(255,255,255,0.9)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  dotTex = new THREE.CanvasTexture(c);
  dotTex.userData.shared = true;
  return dotTex;
}

function makeRocket(p) {
  const g = new THREE.Group(); // orients with the ship
  const body = new THREE.Group(); // banks inside it
  g.add(body);
  const hull = new THREE.Mesh(sharedGeo('rkHull', () => new THREE.CapsuleGeometry(0.75, 1.6, 8, 16)), toon(p.color));
  hull.rotation.x = Math.PI / 2;
  const nose = new THREE.Mesh(sharedGeo('rkNose', () => new THREE.ConeGeometry(0.62, 1.1, 16)), toon(COLORS.white));
  nose.rotation.x = Math.PI / 2;
  nose.position.z = 1.75;
  body.add(hull, nose);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + Math.PI;
    const fin = new THREE.Mesh(sharedGeo('rkFin', () => new THREE.BoxGeometry(0.12, 0.9, 0.9)), toon(COLORS.white));
    fin.position.set(Math.sin(a) * 0.8, Math.cos(a) * 0.8, -1.1);
    fin.rotation.z = -a;
    body.add(fin);
  }
  // Glass dome with the player's bean inside.
  const dome = new THREE.Mesh(sharedGeo('rkDome', () => new THREE.SphereGeometry(0.6, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2)), toon(0xbfe9ff, { transparent: true, opacity: 0.45 }));
  dome.position.set(0, 0.55, 0.3);
  const pilot = new Character(p.color, { hat: p.hat });
  pilot.group.scale.setScalar(0.42);
  pilot.group.position.set(0, 0.3, 0.3);
  body.add(pilot.group, dome);
  const flame = new THREE.Mesh(sharedGeo('rkFlame', () => new THREE.ConeGeometry(0.45, 1.6, 12)), basic(0xffc93c, { transparent: true, opacity: 0.85 }));
  flame.rotation.x = -Math.PI / 2;
  flame.position.z = -2.2;
  const core = new THREE.Mesh(sharedGeo('rkCore', () => new THREE.ConeGeometry(0.25, 1.0, 10)), basic(COLORS.white));
  core.rotation.x = -Math.PI / 2;
  core.position.z = -1.9;
  body.add(flame, core);
  const bubble = new THREE.Mesh(sharedGeo('rkBubble', () => new THREE.SphereGeometry(2.2, 20, 14)), toon(0xbfe9ff, { transparent: true, opacity: 0.35 }));
  bubble.visible = false;
  g.add(bubble);
  return { g, body, flame, core, pilot, bubble };
}

export class SpaceScene extends MiniGame {
  constructor(game, opts) {
    super(game, opts);
    this.scene.background = skyTexture('#1d1450', '#5b3d9e');
    const hemi = new THREE.HemisphereLight(0xe8e0ff, 0x6a4fb0, 1.6);
    const sun = new THREE.DirectionalLight(0xfff2dd, 2.0);
    sun.position.set(-60, 100, 40);
    this.scene.add(hemi, sun);

    this.buildCourse();
    this.buildSpace();
    this.finishOrder = [];
    this.finishTimer = null;
    this.raceTime = 0;
    this.ships = this.players.map((p, i) => this.makeShip(p, i));
    this.overview = new THREE.PerspectiveCamera(55, 1, 1, 2000);
    this.overview.position.set(0, 330, 120);
    this.overview.lookAt(0, 0, 0);
    game.audio.playMusic('space');
    this.laps = opts.laps || 3;
    if (opts.laps) {
      this.intro(t('game.space'), t('space.intro'));
    } else {
      this.state = 'vote';
      this.picker = new VotePicker(this, {
        title: () => t('game.space'),
        vote: VOTES.laps(3),
        onDone: (n) => { this.picker = null; this.laps = n; this.intro(t('game.space'), t('space.intro')); },
      });
    }
  }

  retryOptions() {
    return { key: this.key, laps: this.laps };
  }

  onLanguage() {
    this.picker?.render();
  }

  // ---------- course ----------

  buildCourse() {
    const curve = new THREE.CatmullRomCurve3(CONTROL.map(([x, y, z]) => new THREE.Vector3(x, y, z)), true, 'centripetal');
    this.pts = curve.getSpacedPoints(N).slice(0, N);
    this.tan = this.pts.map((p, i) => this.pts[(i + 1) % N].clone().sub(p).normalize());

    // A dotted trail of little lights along the course so it is easy to follow.
    const dots = [];
    for (let i = 0; i < N; i += 6) dots.push(this.pts[i].x, this.pts[i].y, this.pts[i].z);
    const dg = new THREE.BufferGeometry();
    dg.setAttribute('position', new THREE.Float32BufferAttribute(dots, 3));
    this.scene.add(new THREE.Points(dg, new THREE.PointsMaterial({ color: 0xfff3b0, size: 0.9, map: dotTexture(), transparent: true, opacity: 0.8, depthWrite: false })));

    this.gates = [];
    const ringGeo = new THREE.TorusGeometry(GATE_R, 0.8, 12, 44);
    for (let i = 0; i < GATES; i++) {
      const idx = Math.round((i / GATES) * N) % N;
      const pos = this.pts[idx], tan = this.tan[idx];
      const color = i === 0 ? COLORS.white : PLAYER_COLORS[i % 6].hex;
      const ring = new THREE.Mesh(ringGeo, toon(color, { emissive: 0x222222 }));
      ring.position.copy(pos);
      ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tan);
      this.scene.add(ring);
      // Bulbs around the ring.
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        const bulb = new THREE.Mesh(sharedGeo('gateBulb', () => new THREE.SphereGeometry(0.45, 10, 8)), basic(0xfff3b0));
        bulb.position.set(Math.cos(a) * GATE_R, Math.sin(a) * GATE_R, 0);
        ring.add(bulb);
      }
      if (i === 0) {
        // Checkered start banner.
        const c = document.createElement('canvas');
        c.width = 256; c.height = 32;
        const g2 = c.getContext('2d');
        for (let x = 0; x < 16; x++) for (let y = 0; y < 2; y++) { g2.fillStyle = (x + y) % 2 ? '#2b2340' : '#ffffff'; g2.fillRect(x * 16, y * 16, 16, 16); }
        const tex = new THREE.CanvasTexture(c);
        tex.colorSpace = THREE.SRGBColorSpace;
        const banner = new THREE.Mesh(new THREE.PlaneGeometry(GATE_R * 2, 1.6), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }));
        banner.position.y = GATE_R + 1.6;
        ring.add(banner);
      }
      this.gates.push({ i, idx, pos, tan, ring });
    }
  }

  buildSpace() {
    const rand = seeded(17);
    // Stars.
    const star = [];
    for (let i = 0; i < 1800; i++) {
      const v = new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize().multiplyScalar(700 + rand() * 200);
      star.push(v.x, v.y, v.z);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.Float32BufferAttribute(star, 3));
    this.scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 3, sizeAttenuation: false, map: dotTexture(), transparent: true, depthWrite: false })));

    // Candy planets far away.
    const planets = [
      { pos: [-320, 60, -420], r: 90, color: 0xff9fd0, ring: 0xffe47a },
      { pos: [420, -40, 120], r: 70, color: 0x8fd8ff, ring: null },
      { pos: [60, 260, 380], r: 55, color: 0xffc93c, ring: 0xff7eb6 },
      { pos: [-380, -160, 300], r: 40, color: 0x9ff0c8, ring: null },
    ];
    for (const pl of planets) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(pl.r, 40, 28), toon(pl.color));
      m.position.set(...pl.pos);
      this.scene.add(m);
      if (pl.ring) {
        const mat = new THREE.MeshToonMaterial({ color: pl.ring, gradientMap: toon(0xffffff).gradientMap, side: THREE.DoubleSide, transparent: true, opacity: 0.8 });
        const r = new THREE.Mesh(new THREE.RingGeometry(pl.r * 1.3, pl.r * 1.8, 64), mat);
        r.position.copy(m.position);
        r.rotation.set(1.2, 0.3, 0);
        this.scene.add(r);
      }
    }

    // Asteroids: big ones line the course, small ones drift in the lane to dodge.
    this.rocks = [];
    const rockMats = [toon(0xbdb8cf, { flat: true }), toon(0x9a94b2, { flat: true }), toon(0xd8c3a5, { flat: true })];
    const geo = sharedGeo('asteroid', () => faceted(new THREE.IcosahedronGeometry(1, 1)));
    const place = (idx, offset, r) => {
      const tan = this.tan[idx];
      const side = new THREE.Vector3().crossVectors(tan, UP).normalize();
      const up = new THREE.Vector3().crossVectors(side, tan).normalize();
      const a = rand() * Math.PI * 2;
      const pos = this.pts[idx].clone().addScaledVector(side, Math.cos(a) * offset).addScaledVector(up, Math.sin(a) * offset);
      if (this.gates.some((gt) => gt.pos.distanceTo(pos) < GATE_R + r + 4)) return;
      const m = new THREE.Mesh(geo, rockMats[Math.floor(rand() * 3)]);
      m.position.copy(pos);
      m.scale.set(r, r * (0.7 + rand() * 0.4), r * (0.8 + rand() * 0.3));
      m.rotation.set(rand() * 6, rand() * 6, rand() * 6);
      this.scene.add(m);
      this.rocks.push({ m, pos, r: r * 0.85, spin: new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).multiplyScalar(0.6) });
    };
    for (let i = 0; i < 90; i++) place(Math.floor(rand() * N), 16 + rand() * 22, 3 + rand() * 5);
    for (let i = 0; i < 26; i++) place(Math.floor(rand() * N), 2 + rand() * 6, 1.2 + rand() * 1.3);
  }

  makeShip(p, i) {
    const rk = makeRocket(p);
    this.scene.add(rk.g);
    const row = Math.floor(i / 3), col = (i % 3) - 1;
    const idx = (N - 25 - row * 12) % N;
    const tan = this.tan[idx];
    const side = new THREE.Vector3().crossVectors(tan, UP).normalize();
    const pos = this.pts[idx].clone().addScaledVector(side, col * 4).addScaledVector(UP, row ? 2 : 0);
    const yaw = Math.atan2(tan.x, tan.z);
    const pitch = Math.asin(THREE.MathUtils.clamp(tan.y, -1, 1));
    const cam = new THREE.PerspectiveCamera(66, 1, 0.3, 2500);
    cam.layers.enable(1 + i);
    // Guide arrow toward the next gate; only this player's camera sees it.
    const arrow = new THREE.Group();
    const shaft = new THREE.Mesh(sharedGeo('arShaft', () => new THREE.CylinderGeometry(0.12, 0.12, 1.2, 8)), basic(p.color));
    shaft.rotation.x = Math.PI / 2;
    const head = new THREE.Mesh(sharedGeo('arHead', () => new THREE.ConeGeometry(0.35, 0.7, 10)), basic(p.color));
    head.rotation.x = Math.PI / 2;
    head.position.z = 0.9;
    arrow.add(shaft, head);
    arrow.traverse((o) => o.layers.set(1 + i));
    this.scene.add(arrow);
    const hud = this.game.ui.label('kart-hud');
    hud.style.setProperty('--c', p.css);
    const s = {
      p, ...rk, cam, arrow, hud, hudCache: '',
      pos, vel: new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)).multiplyScalar(0), yaw, pitch,
      yawRate: 0, pitchRate: 0, bank: 0, energy: 1, boostLocked: false, boosting: false, sliding: false,
      next: 0, gatesPassed: 0, lap: 0, finished: false, finishTime: 0, place: i,
      idx, lostT: 0, bubbleT: 0, bumpCd: 0, flash: 0,
      camPos: new THREE.Vector3(), camLook: new THREE.Vector3(),
    };
    this.snapCamera(s);
    return s;
  }

  forward(s, out = new THREE.Vector3()) {
    return out.set(Math.sin(s.yaw) * Math.cos(s.pitch), Math.sin(s.pitch), Math.cos(s.yaw) * Math.cos(s.pitch));
  }

  snapCamera(s) {
    const f = this.forward(s);
    s.camPos.copy(s.pos).addScaledVector(f, -10).addScaledVector(UP, 3.2);
    s.camLook.copy(s.pos).addScaledVector(f, 12);
    s.cam.position.copy(s.camPos);
    s.cam.lookAt(s.camLook);
  }

  nearest(s) {
    let best = s.idx, bestD = Infinity;
    for (let o = -60; o <= 60; o++) {
      const i = (s.idx + o + N) % N;
      const d = this.pts[i].distanceToSquared(s.pos);
      if (d < bestD) { bestD = d; best = i; }
    }
    return { i: best, d: Math.sqrt(bestD) };
  }

  progress(s) {
    const g = this.gates[s.next % GATES];
    return s.gatesPassed * 10000 - g.pos.distanceTo(s.pos);
  }

  // ---------- flight ----------

  updateShip(s, dt) {
    const racing = this.state === 'play' && !s.finished;
    const d = this.input(s.p) || { x: 0, y: 0, a: false, b: false };
    let sx = racing ? d.x : 0, sy = racing ? d.y : 0;
    const wantBoost = racing && d.a;
    const slide = racing && d.b;
    s.bumpCd -= dt; s.flash -= dt;

    if (s.bubbleT > 0) {
      // Floating back to the last gate in a bubble.
      s.bubbleT -= dt;
      s.bubble.visible = true;
      s.pos.lerp(s.rescueTo, Math.min(1, dt * 3));
      s.vel.set(0, 0, 0);
      if (s.bubbleT <= 0) {
        s.bubble.visible = false;
        const f = this.forward(s);
        s.vel.copy(f).multiplyScalar(SPEED * 0.6);
        this.game.audio.play('pop');
      }
      sx = sy = 0;
    }

    // Turn rates ease toward the stick with a short lag, so the ship feels weighty but responsive.
    const k = 1 - Math.exp(-TURN_RESPONSE * dt);
    const turnMul = slide ? 1.3 : 1;
    s.yawRate += (-sx * YAW_RATE * turnMul - s.yawRate) * k;
    s.pitchRate += (sy * PITCH_RATE * turnMul - s.pitchRate) * k;
    s.yaw += s.yawRate * dt;
    s.pitch += s.pitchRate * dt;
    // Soft pitch limit, and a gentle pull back toward level when the stick is centered.
    if (Math.abs(s.pitch) > MAX_PITCH) { s.pitch = Math.sign(s.pitch) * MAX_PITCH; s.pitchRate = 0; }
    if (Math.abs(sy) < 0.1) s.pitch *= Math.max(0, 1 - dt * 0.25);

    // Boost tank: drains while boosting, refills otherwise; empty locks boost until 30 %.
    if (s.energy <= 0.01) s.boostLocked = true;
    else if (s.boostLocked && s.energy >= 0.3) s.boostLocked = false;
    s.boosting = wantBoost && !s.boostLocked && s.bubbleT <= 0;
    s.energy = THREE.MathUtils.clamp(s.energy + (s.boosting ? -0.32 : 0.14) * dt, 0, 1);
    s.sliding = slide;

    // Players behind get a little extra top speed.
    const catchUp = 1 + Math.min(0.12, s.place * 0.03);
    const f = this.forward(s, _v);
    if (s.bubbleT <= 0) {
      if (slide) {
        // Slide: keep the momentum, just a touch of drag, while the nose swings freely.
        s.vel.multiplyScalar(Math.max(0, 1 - dt * 0.12));
        if (s.boosting) s.vel.addScaledVector(f, BOOST * 0.6 * dt);
      } else {
        const target = (s.boosting ? BOOST : SPEED) * catchUp;
        const want = f.clone().multiplyScalar(this.state === 'play' || s.finished ? target : 0);
        s.vel.lerp(want, Math.min(1, dt * GRIP));
      }
      const sp = s.vel.length();
      if (sp > BOOST * catchUp) s.vel.multiplyScalar((BOOST * catchUp) / sp);
    }
    const prev = s.pos.clone();
    s.pos.addScaledVector(s.vel, dt);

    // Asteroids bounce you off gently.
    for (const r of this.rocks) {
      const dd = s.pos.distanceTo(r.pos);
      const min = r.r + 1.1;
      if (dd < min) {
        const n = s.pos.clone().sub(r.pos).normalize();
        s.pos.copy(r.pos).addScaledVector(n, min);
        const vn = s.vel.dot(n);
        if (vn < 0) s.vel.addScaledVector(n, -1.6 * vn);
        s.vel.multiplyScalar(0.7);
        if (s.bumpCd <= 0) {
          s.bumpCd = 0.4;
          this.game.audio.play('bump');
          this.puffs.burst(s.pos.clone().addScaledVector(n, -1), 0xd8d0ff, { count: 10, size: 0.6, life: 0.5 });
        }
      }
    }

    // Gates: crossing the next gate's plane near the ring counts. Through the ring gives a boost top-up.
    if (racing && s.bubbleT <= 0) {
      const g = this.gates[s.next % GATES];
      const before = prev.clone().sub(g.pos).dot(g.tan);
      const after = s.pos.clone().sub(g.pos).dot(g.tan);
      if (before < 0 && after >= 0) {
        const dist = s.pos.distanceTo(g.pos);
        if (dist < GATE_R * 2.2) this.passGate(s, g, dist < GATE_R + 0.6);
      }
    }

    // Wandered off? Float back to the last gate.
    const near = this.nearest(s);
    s.idx = near.i;
    if (racing && s.bubbleT <= 0) {
      s.lostT = near.d > LOST_DIST ? s.lostT + dt : 0;
      if (s.lostT > 1.5) this.rescue(s);
    }

    // Visuals.
    s.bank += (THREE.MathUtils.clamp(s.yawRate * 0.55, -0.8, 0.8) * (slide ? 1.4 : 1) - s.bank) * Math.min(1, dt * 6);
    s.g.position.copy(s.pos);
    s.g.rotation.set(-s.pitch, s.yaw, 0, 'YXZ');
    s.body.rotation.z = -s.bank;
    const fl = (s.boosting ? 1.9 : 1) * (0.85 + Math.random() * 0.3) * (s.sliding ? 0.5 : 1);
    s.flame.scale.set(1, fl, 1);
    s.flame.position.z = -1.8 - 0.8 * fl;
    s.flame.material = basic(s.boosting ? 0x7dffcf : 0xffc93c, { transparent: true, opacity: 0.85 });
    s.pilot.update(dt, {});

    // Arrow to the next gate, floating above the ship.
    const tg = this.gates[s.next % GATES].pos;
    s.arrow.position.copy(s.pos).addScaledVector(UP, 2.4);
    s.arrow.lookAt(tg);
    s.arrow.visible = !s.finished;

    // Chase camera: behind and a little above, smoothed.
    const camF = this.forward(s);
    const back = s.sliding ? s.vel.clone().normalize().lerp(camF, 0.5).normalize() : camF;
    const wantPos = s.pos.clone().addScaledVector(back, -10 - (s.boosting ? 2 : 0)).addScaledVector(UP, 3.2);
    const wantLook = s.pos.clone().addScaledVector(camF, 12);
    s.camPos.lerp(wantPos, Math.min(1, dt * 5));
    s.camLook.lerp(wantLook, Math.min(1, dt * 8));
    s.cam.position.copy(s.camPos);
    s.cam.lookAt(s.camLook);
    s.cam.fov += ((s.boosting ? 76 : 66) - s.cam.fov) * Math.min(1, dt * 4);
  }

  passGate(s, g, clean) {
    s.gatesPassed++;
    s.next = (s.next + 1) % GATES;
    if (clean) {
      s.energy = Math.min(1, s.energy + 0.25);
      this.game.audio.play('coin');
      this.confetti.burst(g.pos.clone(), 0, { count: 16, speed: 6, colors: [s.p.color, COLORS.gold], life: 0.8 });
    } else {
      this.game.audio.play('select');
    }
    if (g.i === 0 && s.gatesPassed > 1) {
      s.lap++;
      if (s.lap >= this.laps) this.finishShip(s);
      else this.game.audio.play('star');
    }
  }

  finishShip(s) {
    s.finished = true;
    s.finishTime = this.raceTime;
    this.finishOrder.push(s);
    this.game.audio.play('fanfare');
    this.confetti.burst(s.pos.clone(), 0, { count: 60, speed: 9, colors: PLAYER_COLORS.map((c) => c.hex) });
    if (this.finishTimer === null) this.finishTimer = FINISH_WAIT;
  }

  rescue(s) {
    s.lostT = 0;
    const last = this.gates[(s.next - 1 + GATES) % GATES];
    const nxt = this.gates[s.next % GATES];
    s.rescueTo = last.pos.clone();
    s.bubbleT = 1.4;
    const dir = nxt.pos.clone().sub(last.pos).normalize();
    s.yaw = Math.atan2(dir.x, dir.z);
    s.pitch = THREE.MathUtils.clamp(Math.asin(dir.y), -MAX_PITCH, MAX_PITCH);
    s.yawRate = s.pitchRate = 0;
    this.game.audio.play('trap');
  }

  separate() {
    for (let i = 0; i < this.ships.length; i++) {
      for (let j = i + 1; j < this.ships.length; j++) {
        const a = this.ships[i], b = this.ships[j];
        const dd = a.pos.distanceTo(b.pos);
        if (dd < 2.6 && dd > 1e-3) {
          const n = b.pos.clone().sub(a.pos).normalize();
          const push = (2.6 - dd) / 2;
          a.pos.addScaledVector(n, -push);
          b.pos.addScaledVector(n, push);
          if (a.bumpCd <= 0) { this.game.audio.play('bump'); a.bumpCd = b.bumpCd = 0.4; }
        }
      }
    }
  }

  updatePlaces() {
    const order = [...this.ships].sort((a, b) => {
      if (a.finished && b.finished) return a.finishTime - b.finishTime;
      if (a.finished) return -1;
      if (b.finished) return 1;
      return this.progress(b) - this.progress(a);
    });
    order.forEach((s, i) => { s.place = i; });
  }

  // ---------- split screen ----------

  layout() {
    const W = window.innerWidth, H = window.innerHeight;
    const n = this.ships.length;
    const cols = n <= 2 ? 1 : n <= 4 ? 2 : 3;
    const rows = n === 1 ? 1 : 2;
    const cells = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = Math.round((c * W) / cols), y = Math.round((r * H) / rows);
        cells.push({ x, y, w: Math.round(((c + 1) * W) / cols) - x, h: Math.round(((r + 1) * H) / rows) - y });
      }
    }
    return cells;
  }

  render(renderer) {
    const H = window.innerHeight;
    const cells = this.layout();
    renderer.setScissorTest(true);
    cells.forEach((cell, i) => {
      const s = this.ships[i];
      const cam = s ? s.cam : this.overview;
      cam.aspect = cell.w / cell.h;
      cam.updateProjectionMatrix();
      renderer.setViewport(cell.x, H - cell.y - cell.h, cell.w, cell.h);
      renderer.setScissor(cell.x, H - cell.y - cell.h, cell.w, cell.h);
      renderer.render(this.scene, cam);
    });
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, window.innerWidth, H);
  }

  updateHud() {
    const cells = this.layout();
    this.ships.forEach((s, i) => {
      const c = cells[i];
      const lap = Math.min(this.laps, s.lap + 1);
      const tank = `<div class="space-tank ${s.boostLocked ? 'locked' : ''} ${s.flash > 0 ? 'flash' : ''}"><span style="width:${Math.round(s.energy * 100)}%"></span></div>`;
      const status = s.finished ? `<div class="kart-done">${t('kart.finished', { ord: ord(this.finishOrder.indexOf(s)) })}</div>` : '';
      const gate = `<div class="space-gate">${t('space.gate', { a: s.next + 1, b: GATES })}</div>`;
      const html = `<div class="kart-place">${ord(s.place)}</div><div class="kart-lap">${esc(s.p.name)} · ${t('kart.lap', { a: lap, b: this.laps })}</div>${s.finished ? '' : gate}${tank}${status}`;
      if (html !== s.hudCache) { s.hud.innerHTML = html; s.hudCache = html; }
      s.hud.style.transform = `translate(${c.x}px, ${c.y}px)`;
      s.hud.style.width = `${c.w}px`;
      s.hud.style.height = `${c.h}px`;
    });
  }

  /** Story campaign: rings flown through by the whole team, and who finished. */
  campaignStats() {
    return { rings: this.ships.reduce((s, x) => s + x.gatesPassed, 0), finished: this.finishOrder.length, players: this.ships.length, laps: this.laps };
  }

  end() {
    if (this.state === 'results') return;
    this.updatePlaces();
    const ranked = [...this.ships].sort((a, b) => a.place - b.place);
    for (const s of this.ships) s.hud.style.display = 'none';
    this.finish({
      title: this.ships.length === 1 ? t('space.solo') : t('kart.winsRace', { name: ranked[0].p.name }),
      subtitle: t('space.sub', { n: this.laps, g: GATES }),
      rows: ranked.map((s, i) => ({
        css: s.p.css, name: s.p.name, value: ord(i),
        detail: s.finished ? `${s.finishTime.toFixed(1)} s` : t('space.gates', { n: s.gatesPassed }), crown: i === 0,
      })),
      stars: 2,
    });
  }

  update(dt) {
    if (this.state === 'vote') this.picker?.update(dt);
    if (this.state === 'play') this.raceTime += dt;
    for (const s of this.ships) this.updateShip(s, dt);
    this.separate();
    for (const r of this.rocks) { r.m.rotation.x += r.spin.x * dt; r.m.rotation.y += r.spin.y * dt; }
    for (const g of this.gates) {
      const isNext = this.ships.some((s) => !s.finished && s.next % GATES === g.i);
      g.ring.scale.setScalar(isNext ? 1 + Math.sin(this.time * 5) * 0.04 : 1);
    }
    if (this.updateResults(dt)) return;
    this.updatePlaces();
    this.updateHud();
    if (this.finishTimer !== null && this.state === 'play') {
      this.finishTimer -= dt;
      const left = this.ships.filter((s) => !s.finished).length;
      if (left === 0 || this.finishTimer <= 0) { this.end(); return; }
      this.game.ui.setTop(left ? `<div class="pill">${t('kart.closes')} <b>${Math.ceil(this.finishTimer)}</b></div>` : '');
    }
  }
}
