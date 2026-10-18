import * as THREE from 'three';
import { Round, clock } from './common.js';
import { COLORS, toon, sharedGeo } from '../../core/palette.js';
import { makeTree, makeCloud, makeFlower, seeded } from '../../core/world.js';
import { t, addStrings } from '../../core/i18n.js';

addStrings({
  en: {
    'keepy.title': 'Keepy-Uppy',
    'keepy.hint': 'Work together! Jump with [A] and bop the balloons with your head to keep them in the air. Every bop adds to the team streak. More balloons float in as you go.',
    'keepy.streak': 'Streak {n}', 'keepy.best': 'Team best {n}', 'keepy.more': 'Another balloon!', 'keepy.aww': 'aww',
    'keepy.n': '{n} bops',
  },
  no: {
    'keepy.title': 'Hold ballongen oppe',
    'keepy.hint': 'Samarbeid! Hopp med [A] og dunk ballongene med hodet så de holder seg i lufta. Hvert dunk teller på lagets rekke. Flere ballonger kommer svevende etter hvert.',
    'keepy.streak': 'Rekke {n}', 'keepy.best': 'Lagrekord {n}', 'keepy.more': 'En ballong til!', 'keepy.aww': 'åhh',
    'keepy.n': '{n} dunk',
  },
});

// Keepy-Uppy: co-op, side view. Bop the balloons with your head; don't let them land.
const HALF = 10;
const TIME = 40;
const SPEED = 7;
const JUMP = 11;
const GRAV = 30;
const BR = 0.6; // balloon radius
const HEAD = 0.5; // head bop radius
const B_GRAV = 4.2;
const B_FALL = 2.3; // terminal fall speed: balloons drift down gently
const BOP = 5.6;
const TOP = 10.5;
const BALLOON_COLORS = [0xff5d73, 0xffc93c, 0x4cc9f0, 0x3ddc97, 0x9b5de5, 0xff8c42];

function makeBalloon(color) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(sharedGeo('kbBody', () => new THREE.SphereGeometry(BR, 22, 16)), toon(color));
  body.scale.set(1, 1.12, 1);
  body.castShadow = true;
  const shine = new THREE.Mesh(sharedGeo('kbShine', () => new THREE.SphereGeometry(0.12, 10, 8)), toon(COLORS.white, { transparent: true, opacity: 0.7 }));
  shine.scale.set(0.8, 1.4, 0.5);
  shine.position.set(-0.28, 0.3, 0.42);
  const knot = new THREE.Mesh(sharedGeo('kbKnot', () => new THREE.ConeGeometry(0.1, 0.16, 8)), toon(color));
  knot.position.y = -BR * 1.12 - 0.04;
  g.add(body, shine, knot);
  // Cute face so the balloons feel like little friends to rescue.
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(sharedGeo('kbEye', () => new THREE.SphereGeometry(0.07, 8, 6)), toon(COLORS.ink));
    eye.position.set(s * 0.17, 0.12, BR - 0.05);
    eye.scale.set(1, 1.3, 0.6);
    g.add(eye);
  }
  const mouth = new THREE.Mesh(sharedGeo('kbMouth', () => new THREE.TorusGeometry(0.1, 0.025, 6, 12, Math.PI)), toon(COLORS.ink));
  mouth.position.set(0, -0.06, BR - 0.04);
  mouth.rotation.z = Math.PI;
  g.add(mouth);
  const string = new THREE.Mesh(sharedGeo('kbString', () => new THREE.CylinderGeometry(0.012, 0.012, 1.1, 4).translate(0, -0.55, 0)), toon(COLORS.white));
  string.position.y = -BR * 1.12 - 0.1;
  g.add(string);
  g.userData = { body, mouth, string };
  return g;
}

export class KeepyRound extends Round {
  static key = 'keepy';

  constructor(party) {
    super(party);
    this.t = 0;
    this.streak = 0;
    this.best = 0;
    this.added = 0;
    this.balloons = [];
    this.pops = [];
    this.build();
    const n = this.players.length;
    this.maxBalloons = Math.min(5, 2 + Math.ceil(n / 2));
    this.ents = this.players.map((p, i) => {
      const ch = this.bean(p);
      return { p, ch, x: (i - (n - 1) / 2) * 2.4, y: 0, vx: 0, vy: 0, grounded: true, dir: 1, touches: 0, tag: this.label('label') };
    });
    this.awwTag = this.label('label');
    this.awwT = 0;
    this.awwPos = new THREE.Vector3();
    // First balloon(s) hang in the air during the how-to card.
    const first = n >= 4 ? 2 : 1;
    for (let i = 0; i < first; i++) this.addBalloon((i - (first - 1) / 2) * 5, 6.5, true);
    this.joined = first; // balloons in play, not counting respawns after a drop
  }

  get title() { return t('keepy.title'); }
  get hint() { return t('keepy.hint'); }

  build() {
    const g = this.group;
    const ground = new THREE.Mesh(new THREE.BoxGeometry(HALF * 2 + 40, 1, 16), toon(COLORS.grass));
    ground.position.set(0, -0.5, -3);
    ground.receiveShadow = true;
    g.add(ground);
    const rand = seeded(61);
    for (let i = 0; i < 8; i++) {
      const tr = makeTree(rand, 2.3 + rand() * 0.4);
      tr.position.set(-HALF - 2 + (i * (HALF * 2 + 4)) / 7, 0, -5 - rand() * 1.5);
      g.add(tr);
    }
    // Party bunting strung across the back.
    const flagColors = [0xff5d73, 0xffc93c, 0x3ddc97, 0x4cc9f0, 0x9b5de5, 0xff8c42];
    for (const span of [[-HALF - 2, 0], [0, HALF + 2]]) {
      const n = 12;
      for (let i = 0; i < n; i++) {
        const u = (i + 0.5) / n;
        const flag = new THREE.Mesh(sharedGeo('kbFlag', () => new THREE.ConeGeometry(0.3, 0.6, 3)), toon(flagColors[i % 6]));
        flag.rotation.x = Math.PI;
        flag.position.set(THREE.MathUtils.lerp(span[0], span[1], u), 8.6 - Math.sin(u * Math.PI) * 1.2, -4);
        g.add(flag);
      }
    }
    for (let i = 0; i < 40; i++) {
      const f = makeFlower(rand);
      f.position.set((rand() - 0.5) * HALF * 2.4, 0, -1.5 + rand() * 3.5);
      g.add(f);
    }
    for (let i = 0; i < 4; i++) {
      const c = makeCloud(rand, 2);
      c.position.set(-18 + i * 12, 15 + rand() * 3, -14);
      g.add(c);
    }
  }

  frame() {
    const d = this.party.fitDistance(HALF * 2 + 3, 12.5);
    this.camera.position.set(0, 5.6, d + 1);
    this.camera.lookAt(0, 5, 0);
  }

  addBalloon(x, y, hang = false) {
    const color = BALLOON_COLORS[(this.added++) % BALLOON_COLORS.length];
    const mesh = makeBalloon(color);
    this.group.add(mesh);
    const shadow = new THREE.Mesh(sharedGeo('kbShadow', () => new THREE.CircleGeometry(0.6, 20)), toon(0x3a8a3a, { transparent: true, opacity: 0.35 }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.02;
    this.group.add(shadow);
    const b = { mesh, shadow, color, x, y, vx: 0, vy: hang ? 0 : -1, hang, cool: new Map(), spin: 0, squish: 0 };
    mesh.position.set(x, y, 0);
    this.balloons.push(b);
    return b;
  }

  start() {
    for (const b of this.balloons) { b.hang = false; b.vy = 0.5; }
  }

  sad() {
    const a = this.game.audio;
    if (!a.ctx) return;
    a.tone(520, 0.18, { type: 'triangle', vol: 0.1 });
    a.tone(390, 0.32, { type: 'triangle', vol: 0.1, delay: 0.16, slide: 0.85 });
  }

  bop(e, b) {
    b.vy = BOP + Math.max(0, e.vy) * 0.2;
    b.vx = THREE.MathUtils.clamp((b.x - e.x) * 4 + e.vx * 0.3, -4, 4);
    b.squish = 1;
    b.cool.set(e, 0.3);
    e.touches++;
    this.streak++;
    this.best = Math.max(this.best, this.streak);
    e.ch.squash(0.75);
    this.game.audio.play('bubble');
    const at = new THREE.Vector3(b.x, b.y - BR, 0.2);
    this.party.puffs.burst(at, 0xffffff, { count: 5, size: 0.25, life: 0.3 });
    if (this.streak % 10 === 0) {
      this.game.audio.play('star');
      this.party.confetti.burst(new THREE.Vector3(b.x, b.y, 0.3), 0, { count: 30, speed: 6, colors: [b.color, COLORS.gold, COLORS.white] });
    }
  }

  drop(b) {
    // Lands softly with a sad little sound, deflates, and a new one floats in later.
    b.gone = true;
    this.streak = 0;
    this.sad();
    this.party.puffs.burst(new THREE.Vector3(b.x, 0.4, 0), b.color, { count: 10, size: 0.35, life: 0.5 });
    this.awwT = 1.2;
    this.awwPos.set(b.x, 1.6, 0);
    this.pops.push({ mesh: b.mesh, shadow: b.shadow, t: 0 });
    this.later(1.3, () => this.respawn());
  }

  respawn() {
    if (this.t >= TIME - 1.5) return;
    const x = (Math.random() - 0.5) * (HALF * 2 - 4);
    this.addBalloon(x, TOP + 1);
  }

  update(dt, playing) {
    this.time += dt;
    if (playing) {
      this.t += dt;
      // More balloons join over time.
      const want = Math.min(this.maxBalloons, (this.players.length >= 4 ? 2 : 1) + Math.floor(this.t / 9));
      if (this.t < TIME - 4 && this.joined < want) {
        this.joined++;
        this.addBalloon((Math.random() - 0.5) * (HALF * 2 - 4), TOP + 1);
        this.game.ui.toast(t('keepy.more'), 1200);
        this.game.audio.play('join');
      }
    }

    for (const e of this.ents) {
      const d = playing && this.t < TIME ? this.input(e.p) : { x: 0, aPressed: false };
      const ix = Math.abs(d.x) > 0.2 ? d.x : 0;
      e.vx = ix * SPEED;
      e.x = THREE.MathUtils.clamp(e.x + e.vx * dt, -HALF, HALF);
      if (ix) e.dir = Math.sign(ix);
      if (d.aPressed && e.grounded) { e.vy = JUMP; e.grounded = false; e.ch.squash(1.3); this.game.audio.play('jump'); }
      e.vy -= GRAV * dt;
      e.y += e.vy * dt;
      if (e.y <= 0) { if (!e.grounded) e.ch.squash(0.8); e.y = 0; e.vy = 0; e.grounded = true; }
      e.ch.faceSide(e.dir);
      e.ch.group.position.set(e.x, e.y, 0);
      e.ch.update(dt, { moving: ix ? 1 : 0, grounded: e.grounded, vy: e.vy });
    }

    for (const b of this.balloons) {
      if (b.hang) {
        b.mesh.position.set(b.x, b.y + Math.sin(this.time * 2 + b.x) * 0.15, 0);
      } else {
        b.vy = Math.max(-B_FALL, b.vy - B_GRAV * dt);
        b.vx *= Math.exp(-0.8 * dt);
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        if (Math.abs(b.x) > HALF + 0.5) { b.x = Math.sign(b.x) * (HALF + 0.5); b.vx = -b.vx * 0.8; }
        if (b.y > TOP + 1.5) { b.y = TOP + 1.5; b.vy = Math.min(0, b.vy); }
        for (const [e, c] of b.cool) { if (c - dt <= 0) b.cool.delete(e); else b.cool.set(e, c - dt); }
        if (playing && this.t < TIME) {
          for (const e of this.ents) {
            if (b.cool.has(e) || b.vy > 2.5) continue;
            const hy = e.y + 0.95;
            if (Math.hypot(b.x - e.x, (b.y - BR * 0.3) - hy) < BR + HEAD) { this.bop(e, b); break; }
          }
        }
        if (playing && b.y - BR * 1.1 <= 0) { this.drop(b); continue; }
        b.y = Math.max(b.y, BR * 1.1);
        b.squish = Math.max(0, b.squish - dt * 5);
        b.mesh.position.set(b.x, b.y, 0);
        b.mesh.rotation.z = THREE.MathUtils.clamp(-b.vx * 0.08, -0.4, 0.4);
        b.mesh.userData.string.rotation.z = THREE.MathUtils.clamp(b.vx * 0.15, -0.6, 0.6) + Math.sin(this.time * 3 + b.x) * 0.1;
      }
      const sq = 1 - b.squish * 0.25;
      b.mesh.userData.body.scale.set(1 / Math.sqrt(sq), 1.12 * sq, 1 / Math.sqrt(sq));
      // Worried "o" mouth when close to the ground.
      const low = b.y < 3;
      b.mesh.userData.mouth.rotation.z = low ? 0 : Math.PI;
      b.mesh.userData.mouth.position.y = low ? -0.14 : -0.06;
      const h = Math.max(0, b.y);
      b.shadow.position.x = b.x;
      b.shadow.scale.setScalar(THREE.MathUtils.clamp(1.3 - h * 0.08, 0.4, 1.3));
    }
    this.balloons = this.balloons.filter((b) => !b.gone);
    // Balloons nudge each other apart instead of overlapping.
    for (let i = 0; i < this.balloons.length; i++) {
      for (let j = i + 1; j < this.balloons.length; j++) {
        const a = this.balloons[i], b = this.balloons[j];
        if (a.hang || b.hang) continue;
        const dx = b.x - a.x, dy = b.y - a.y, dd = Math.hypot(dx, dy);
        if (dd >= BR * 2.1 || dd < 1e-4) continue;
        const nx = dx / dd, ny = dy / dd, push = (BR * 2.1 - dd) / 2;
        a.x -= nx * push; a.y -= ny * push;
        b.x += nx * push; b.y += ny * push;
        const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
        if (rel < 0) { a.vx += nx * rel * 0.8; a.vy += ny * rel * 0.8; b.vx -= nx * rel * 0.8; b.vy -= ny * rel * 0.8; }
      }
    }

    for (const p of this.pops) {
      p.t += dt;
      const s = Math.max(0.01, 1 - p.t * 2.5);
      p.mesh.scale.set(1 + p.t, s, 1 + p.t);
      p.mesh.position.y = Math.max(0.2, p.mesh.position.y - dt);
      p.shadow.scale.setScalar(s);
      if (p.t > 0.4) { this.group.remove(p.mesh); this.group.remove(p.shadow); p.done = true; }
    }
    this.pops = this.pops.filter((p) => !p.done);

    this.awwT -= dt;
    this.awwTag.style.display = this.awwT > 0 ? '' : 'none';
    if (this.awwT > 0) this.setLabel(this.awwTag, t('keepy.aww'), this.awwPos.clone().setY(1.6 + (1.2 - this.awwT) * 0.6), '#8a7fb0');
    for (const e of this.ents) this.setLabel(e.tag, String(e.touches), new THREE.Vector3(e.x, e.y + 1.75, 0), e.p.css);

    if (playing && this.t >= TIME && !this.done) {
      this.done = true;
      this.party.confetti.burst(new THREE.Vector3(0, 6, 0), 0, { count: 50, speed: 8, colors: BALLOON_COLORS });
    }
  }

  hud() {
    return `<div class="pill"><b>${t('keepy.streak', { n: this.streak })}</b></div><div class="pill">${t('keepy.best', { n: this.best })}</div>${clock(TIME - this.t)}`;
  }

  /** Story campaign: best team streak, as 0..1 of a great streak (25 bops). */
  campaignStats() {
    return { team: Math.min(1, this.best / 25) };
  }

  score(p) {
    return this.ents.find((x) => x.p === p).touches;
  }

  detail(p) {
    return t('keepy.n', { n: this.score(p) });
  }
}
