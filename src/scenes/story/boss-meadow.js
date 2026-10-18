import * as THREE from 'three';
import { COLORS, toon, sharedGeo } from '../../core/palette.js';
import { addLights, skyTexture, makeTree, makeFlower, makeBush, makeCloud, makeMushroom, seeded } from '../../core/world.js';
import { t, addStrings } from '../../core/i18n.js';
import { BossScene, PR } from './boss-common.js';

// Meadow boss: the Grumble King chases the beans around a flower meadow until he spins
// himself dizzy. While the stars circle his head, bounce on it! Bouncing while he is not
// dizzy just boings you off, and when he bumps into you, you only get pushed away.

addStrings({
  en: { 'bossm.hint': 'Run away while he chases you · when he is dizzy, jump on his head (A)!', 'bossm.hey': 'Hey!', 'bossm.dizzy': 'Dizzy! Bounce now!' },
  no: { 'bossm.hint': 'Løp unna når han jager deg · når han er svimmel, hopp på hodet hans (A)!', 'bossm.hey': 'Hei!', 'bossm.dizzy': 'Svimmel! Hopp nå!' },
});

const R = 9.5; // arena radius
const KING_SIZE = 2.3;
const KING_R = 0.45 * KING_SIZE; // body radius
const CHASE_SPEED = 4.3;

export class BossMeadowScene extends BossScene {
  constructor(game, opts) {
    super(game, opts, { chapter: 0, kingSize: KING_SIZE });
    this.camera.fov = 40;
    this.scene.background = skyTexture('#8fdcff', '#fff4cf');
    addLights(this.scene, { size: 18, dir: new THREE.Vector3(-0.4, 1, 0.55) });
    this.buildMeadow();

    this.k = { x: 0, z: -3, vx: 0, vz: 0, mode: 'wait', t: 1.5, target: null, retarget: 0, dizzyCount: 0 };
    this.king.group.position.set(0, 0, -3);
    this.players.forEach((p, i) => this.makeBean(p, (i - (this.players.length - 1) / 2) * 1.8, 5));
    this.heyTag = this.game.ui.label('label');
    this.heyTag.style.color = '#8a63f0';
    this.heyTag.style.display = 'none';
    this.heyT = 0;
    this.start('platformer');
  }

  frame() {
    const tilt = THREE.MathUtils.degToRad(50);
    const d = this.fitDistance(R * 2 + 1, R * 2 * Math.sin(tilt) + 6);
    this.camera.position.set(0, Math.sin(tilt) * d, Math.cos(tilt) * d + 0.8);
    this.camera.lookAt(0, 0.6, 0.2);
  }

  buildMeadow() {
    const s = this.scene;
    const rand = seeded(31);
    const grass = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.4, R + 0.8, 0.6, 64), toon(COLORS.grass));
    grass.position.y = -0.3;
    grass.receiveShadow = true;
    s.add(grass);
    const outer = new THREE.Mesh(new THREE.CircleGeometry(80, 40), toon(COLORS.grassDark));
    outer.rotation.x = -Math.PI / 2;
    outer.position.y = -0.62;
    outer.receiveShadow = true;
    s.add(outer);
    // A path ring and flowers along the edge.
    const ring = new THREE.Mesh(new THREE.RingGeometry(R - 0.5, R + 0.1, 64), toon(COLORS.sand));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.01;
    s.add(ring);
    for (let i = 0; i < 40; i++) {
      const a = rand() * Math.PI * 2, r = R - 1.5 - rand() * 7;
      const f = makeFlower(rand);
      f.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
      s.add(f);
    }
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * Math.PI * 2 + rand() * 0.2;
      const r = R + 2 + rand() * 5;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (z > R - 1) continue; // keep the front open toward the camera
      const o = i % 3 === 0 ? makeBush(rand, 1.2) : i % 5 === 0 ? makeMushroom(0xff5d73) : makeTree(rand, 1 + rand() * 0.5);
      o.position.set(x, -0.6, z);
      s.add(o);
    }
    for (let i = 0; i < 5; i++) {
      const c = makeCloud(rand, 2);
      c.position.set(-30 + i * 15, 14 + rand() * 4, -30 - rand() * 10);
      s.add(c);
    }
  }

  nearestBean(x, z) {
    let best = null, bd = Infinity;
    for (const e of this.ents) {
      const d = Math.hypot(e.x - x, e.z - z);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  updateKing(dt) {
    const k = this.k;
    const playing = this.state === 'play' && !this.finished;
    k.t -= dt;
    let speed = 0;
    if (!playing) {
      k.vx *= 0.9; k.vz *= 0.9;
    } else if (k.mode === 'wait') {
      if (k.t <= 0) { k.mode = 'chase'; k.t = 4 + Math.random() * 1.5; }
    } else if (k.mode === 'chase') {
      k.retarget -= dt;
      if (!k.target || k.retarget <= 0) { k.target = this.nearestBean(k.x, k.z); k.retarget = 1.4; }
      if (k.target) {
        const dx = k.target.x - k.x, dz = k.target.z - k.z, d = Math.hypot(dx, dz) || 1;
        speed = CHASE_SPEED + Math.min(1, this.count / this.goal) * 0.8;
        k.vx += ((dx / d) * speed - k.vx) * Math.min(1, dt * 3);
        k.vz += ((dz / d) * speed - k.vz) * Math.min(1, dt * 3);
      }
      if (k.t <= 0) { k.mode = 'spin'; k.t = 1.2; this.game.audio.play('whoosh'); }
    } else if (k.mode === 'spin') {
      k.vx *= 0.9; k.vz *= 0.9;
      if (k.t <= 0) {
        k.mode = 'dizzy';
        k.t = 4.6;
        k.dizzyCount++;
        this.game.audio.play('dizzy');
        if (k.dizzyCount <= 2) this.game.ui.toast(t('bossm.dizzy'), 1500);
      }
    } else if (k.mode === 'dizzy') {
      k.vx *= 0.85; k.vz *= 0.85;
      if (k.t <= 0) { k.mode = 'chase'; k.t = 4 + Math.random() * 2; k.target = null; }
    }
    k.x += k.vx * dt; k.z += k.vz * dt;
    const d = Math.hypot(k.x, k.z);
    if (d > R - KING_R) { k.x *= (R - KING_R) / d; k.z *= (R - KING_R) / d; }

    const g = this.king.group;
    g.position.set(k.x, 0, k.z);
    const dizzy = k.mode === 'dizzy' || this.finished;
    if (k.mode === 'spin') g.rotation.y += dt * 16;
    else if (dizzy) g.rotation.y += dt * 1.5;
    else if (Math.hypot(k.vx, k.vz) > 0.5) {
      const want = Math.atan2(k.vx, k.vz);
      let dd = want - g.rotation.y;
      dd = Math.atan2(Math.sin(dd), Math.cos(dd));
      g.rotation.y += dd * Math.min(1, dt * 8);
    }
    // He crouches a little while dizzy, so his head is easier to reach.
    this.king.inner.position.y = 0;
    this.king.update(dt, { dizzy, hop: k.mode === 'chase' ? 12 : 0 });
    if (dizzy && !this.finished) this.king.inner.scale.y *= 0.85;
    if (this.finished) this.king.setMood('laugh');
    else this.king.setMood(dizzy ? 'happy' : 'grumpy');
  }

  updateBoss(dt) {
    this.updateKing(dt);
    const k = this.k;
    const headY = this.king.headY;
    const dizzy = k.mode === 'dizzy';
    for (const e of this.ents) {
      this.moveBean(e, dt, { r: R });
      const dx = e.x - k.x, dz = e.z - k.z, d = Math.hypot(dx, dz);
      // Landing on his head.
      if (e.vy < 0 && d < KING_R + 0.15 && e.y < headY + 0.1 && e.y > headY - 0.8) {
        e.y = headY;
        e.vy = 13;
        e.grounded = false;
        e.ch.squash(1.35);
        this.king.squash(0.72);
        this.game.audio.play('boing');
        if (dizzy && this.state === 'play') this.addPoint(e, new THREE.Vector3(k.x, headY + 0.8, k.z));
        else if (!this.finished) { this.heyT = 0.9; }
        this.placeBean(e, 0);
        continue;
      }
      // Bumping into his body.
      if (d < KING_R + PR && e.y < headY - 0.3) {
        const nx = d > 1e-4 ? dx / d : 1, nz = d > 1e-4 ? dz / d : 0;
        e.x = k.x + nx * (KING_R + PR);
        e.z = k.z + nz * (KING_R + PR);
        if (k.mode === 'chase' && this.state === 'play' && e.push <= 0) {
          this.shove(e, k.x, k.z, 10);
          this.heyT = 0.9;
          this.king.squash(1.15);
        }
        this.placeBean(e, 0);
      }
    }
    this.separate();
    this.heyT -= dt;
    this.heyTag.style.display = this.heyT > 0 ? '' : 'none';
    if (this.heyT > 0) {
      this.heyTag.textContent = t('bossm.hey');
      this.game.ui.place(this.heyTag, new THREE.Vector3(k.x, headY + 1.9, k.z), this.camera);
    }
  }

  onStart() {
    this.game.ui.toast(t('bossm.hint'), 4000);
  }
}
