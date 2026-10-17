import * as THREE from 'three';
import { Round } from './common.js';
import { COLORS, PLAYER_COLORS, toon, sharedGeo } from '../../core/palette.js';
import { makeTree, seeded } from '../../core/world.js';
import { t } from '../../core/i18n.js';

// Musical Cushions: dance while the music plays; when it stops, grab a cushion.
const R = 7;
const SPEED = 6;
const ROUNDS = 5;
const PR = 0.45;
const CUSHION_COLORS = [0xff7eb6, 0xffc93c, 0x4cc9f0, 0x3ddc97, 0x9b5de5];

export class CushionRound extends Round {
  static key = 'cushions';

  constructor(party) {
    super(party);
    this.build();
    this.round = 0;
    this.phase = 'idle';
    this.phaseT = 0;
    this.cushions = [];
    this.ents = this.players.map((p, i) => {
      const ch = this.bean(p);
      const a = (i / this.players.length) * Math.PI * 2;
      return { p, ch, x: Math.sin(a) * 2.5, z: Math.cos(a) * 2.5, vx: 0, vz: 0, points: 0, seat: null };
    });
    for (const e of this.ents) e.ch.group.position.set(e.x, 0, e.z);
  }

  get title() { return t('cushions.title'); }
  get hint() { return t('cushions.hint'); }

  build() {
    const g = this.group;
    const ground = new THREE.Mesh(new THREE.CircleGeometry(60, 40), toon(COLORS.grassDark));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.02;
    g.add(ground);
    // Dance floor: colored rings.
    for (let i = 0; i < 6; i++) {
      const r0 = (R * i) / 6, r1 = (R * (i + 1)) / 6;
      const ring = new THREE.Mesh(new THREE.RingGeometry(r0, r1, 48), toon(PLAYER_COLORS[i % 6].hex));
      ring.rotation.x = -Math.PI / 2;
      ring.receiveShadow = true;
      g.add(ring);
    }
    const rim = new THREE.Mesh(new THREE.TorusGeometry(R, 0.25, 8, 64), toon(COLORS.white));
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.1;
    g.add(rim);
    this.lightsRing = [];
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const bulb = new THREE.Mesh(sharedGeo('cushBulb', () => new THREE.SphereGeometry(0.22, 10, 8)), toon(PLAYER_COLORS[i % 6].hex, { emissive: 0x222222 }));
      bulb.position.set(Math.sin(a) * (R + 0.6), 0.3, Math.cos(a) * (R + 0.6));
      g.add(bulb);
      this.lightsRing.push(bulb);
    }
    const rand = seeded(31);
    for (let i = 0; i < 16; i++) {
      const a = rand() * Math.PI * 2;
      const tr = makeTree(rand, 1.2 + rand() * 0.5);
      tr.position.set(Math.sin(a) * (R + 5 + rand() * 6), 0, Math.cos(a) * (R + 5 + rand() * 6) - 3);
      if (tr.position.z > R + 2) continue;
      g.add(tr);
    }
  }

  frame() {
    const d = this.party.fitDistance(R * 2 + 3, R * 2 * 0.8 + 3);
    this.camera.position.set(0, d * 0.82, d * 0.6);
    this.camera.lookAt(0, 0, 0.3);
  }

  start() {
    this.startMusic();
  }

  startMusic() {
    this.round++;
    this.phase = 'music';
    this.phaseT = 3.5 + Math.random() * 4.5;
    for (const c of this.cushions) this.group.remove(c.mesh);
    this.cushions = [];
    for (const e of this.ents) e.seat = null;
    this.game.audio.playMusic('party');
  }

  stopMusic() {
    this.phase = 'grab';
    this.phaseT = 4;
    this.game.audio.stopMusic();
    this.game.audio.play('beep');
    // Cushions pop up at fresh spots, away from everyone.
    const n = Math.max(1, this.ents.length - 1);
    for (let i = 0; i < n; i++) {
      let x = 0, z = 0;
      for (let tries = 0; tries < 60; tries++) {
        const a = Math.random() * Math.PI * 2, r = 1 + Math.random() * (R - 2);
        x = Math.sin(a) * r; z = Math.cos(a) * r;
        const farFromPlayers = this.ents.every((e) => Math.hypot(e.x - x, e.z - z) > 1.6);
        const farFromCushions = this.cushions.every((c) => Math.hypot(c.x - x, c.z - z) > 2);
        if (farFromPlayers && farFromCushions) break;
      }
      const mesh = new THREE.Mesh(sharedGeo('cushion', () => new THREE.CylinderGeometry(0.7, 0.75, 0.35, 20)), toon(CUSHION_COLORS[i % CUSHION_COLORS.length]));
      mesh.scale.set(1, 0.6, 1);
      mesh.position.set(x, 0.18, z);
      mesh.castShadow = true;
      this.group.add(mesh);
      this.party.puffs.burst(new THREE.Vector3(x, 0.4, z), 0xffffff, { count: 8, size: 0.35, life: 0.4 });
      this.cushions.push({ x, z, mesh, owner: null, pop: 0 });
    }
  }

  update(dt, playing) {
    this.time += dt;
    const dancing = this.phase === 'music';
    this.lightsRing.forEach((b, i) => { b.position.y = 0.3 + (dancing ? Math.abs(Math.sin(this.time * 6 + i)) * 0.3 : 0); });

    if (playing) {
      this.phaseT -= dt;
      if (this.phase === 'music' && this.phaseT <= 0) this.stopMusic();
      else if (this.phase === 'grab' && (this.phaseT <= 0 || this.cushions.every((c) => c.owner))) {
        this.phase = 'score';
        this.phaseT = 1.4;
        for (const c of this.cushions) {
          if (!c.owner) continue;
          c.owner.points++;
          this.party.confetti.burst(new THREE.Vector3(c.x, 1.5, c.z), 0, { count: 16, speed: 5, colors: [c.owner.p.color, COLORS.gold] });
        }
        this.game.audio.play('coin');
      } else if (this.phase === 'score' && this.phaseT <= 0) {
        if (this.round >= ROUNDS) { this.phase = 'over'; this.done = true; this.game.audio.playMusic('party'); }
        else this.startMusic();
      }
    }

    for (const e of this.ents) {
      if (e.seat) {
        e.x += (e.seat.x - e.x) * Math.min(1, dt * 12);
        e.z += (e.seat.z - e.z) * Math.min(1, dt * 12);
        e.ch.group.position.set(e.x, 0.25, e.z);
        e.ch.update(dt, {});
        continue;
      }
      const d = playing && this.phase !== 'score' ? this.input(e.p) : { x: 0, y: 0 };
      const ix = d.x, iz = -d.y;
      e.vx += (ix * SPEED - e.vx) * Math.min(1, dt * 12);
      e.vz += (iz * SPEED - e.vz) * Math.min(1, dt * 12);
      e.x += e.vx * dt; e.z += e.vz * dt;
      const r = Math.hypot(e.x, e.z);
      if (r > R - PR) { e.x *= (R - PR) / r; e.z *= (R - PR) / r; }
      e.ch.face(e.vx, e.vz);
      const sp = Math.hypot(e.vx, e.vz) / SPEED;
      const bop = dancing ? Math.abs(Math.sin(this.time * 9 + e.x)) * 0.25 : 0;
      e.ch.group.position.set(e.x, bop, e.z);
      e.ch.update(dt, { moving: sp });
      if (this.phase === 'grab') {
        for (const c of this.cushions) {
          if (!c.owner && Math.hypot(c.x - e.x, c.z - e.z) < 0.85) {
            c.owner = e; e.seat = c;
            e.ch.squash(0.7);
            this.game.audio.play('boing');
            break;
          }
        }
      }
    }
    // Bump apart.
    for (let i = 0; i < this.ents.length; i++) {
      for (let j = i + 1; j < this.ents.length; j++) {
        const a = this.ents[i], b = this.ents[j];
        if (a.seat || b.seat) continue;
        const dx = b.x - a.x, dz = b.z - a.z, dd = Math.hypot(dx, dz);
        if (dd < PR * 2 && dd > 1e-4) {
          const push = (PR * 2 - dd) / 2;
          a.x -= (dx / dd) * push; a.z -= (dz / dd) * push;
          b.x += (dx / dd) * push; b.z += (dz / dd) * push;
        }
      }
    }
  }

  hud() {
    const status = this.phase === 'music' ? t('cushions.dance') : this.phase === 'grab' ? t('cushions.grab') : '';
    return `<div class="pill">${t('cushions.round', { n: Math.max(1, this.round), total: ROUNDS })}</div>${status ? `<div class="pill"><b>${status}</b></div>` : ''}`;
  }

  score(p) {
    return this.ents.find((x) => x.p === p).points;
  }

  detail(p) {
    return t('cushions.n', { n: this.score(p) });
  }

  dispose() {
    this.game.audio.playMusic('party');
    super.dispose();
  }
}
