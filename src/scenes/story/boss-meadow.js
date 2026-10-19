import * as THREE from 'three';
import { COLORS, toon, basic, sharedGeo } from '../../core/palette.js';
import { addLights, skyTexture, makeTree, makeFlower, makeBush, makeCloud, makeMushroom, seeded } from '../../core/world.js';
import { t, addStrings } from '../../core/i18n.js';
import { makeGrumble } from '../../core/critters.js';
import { BossScene, PR } from './boss-common.js';

// Meadow boss: the Grumble King chases the beans around a flower meadow until he spins
// himself dizzy. While the stars circle his head, bounce on it! Bouncing while he is not
// dizzy just boings you off, and when he bumps into you, you only get pushed away.
//
// Opposition (all harmless, all telegraphed):
// - Belly flop: while chasing he crouches, a purple ring marks where he will land, then he
//   jumps there. Beans in the ring slip. From phase 2 the landing also sends out a shockwave
//   ring along the grass: hop over it ([A]) or slip.
// - Phase 2 (a third of the goal): helper grumbles waddle after the beans. A bump makes you
//   slip; bounce on a helper's head to squash it flat for a moment.
// - Phase 3 (two thirds): he chases faster, flops more often and flops twice in a row.
// Scaling with n players: goal 6 + 2n bounces (stages.js); he shakes off the dizziness after
// 2 + n bounces, so every team needs about three dizzy rounds; helpers ceil(n/2) (+1 in phase 3,
// max 4); he runs a little faster with more beans to chase.

addStrings({
  en: {
    'bossm.hint': 'Run away and dodge the purple rings · when he is dizzy, jump on his head ([A])!',
    'bossm.hey': 'Hey!', 'bossm.dizzy': 'Dizzy! Bounce now!', 'bossm.awake': 'Woah! He shook it off!',
    'bossm.p1': 'Here come his helpers! Bounce on them to squash them flat!',
    'bossm.p2': 'He is getting faster! Hop over the shockwaves!',
  },
  no: {
    'bossm.hint': 'Løp unna og unngå de lilla ringene · når han er svimmel, hopp på hodet hans ([A])!',
    'bossm.hey': 'Hei!', 'bossm.dizzy': 'Svimmel! Hopp nå!', 'bossm.awake': 'Oi! Han ristet det av seg!',
    'bossm.p1': 'Her kommer hjelperne hans! Hopp på dem for å klemme dem flate!',
    'bossm.p2': 'Han blir raskere! Hopp over sjokkbølgene!',
  },
});

const R = 9.5; // arena radius
const KING_SIZE = 2.3;
const KING_R = 0.45 * KING_SIZE; // body radius
const CHASE_SPEED = 4.0;
const FLOP_R = 1.7; // belly flop landing ring
const WAVE_R = 5; // shockwave reaches this far
// Per phase: seconds of chasing between belly flops, flop air time, dizzy time.
const FLOP_GAP = [4.2, 3.4, 2.7];
const FLOP_AIR = [0.95, 0.9, 0.8];
const DIZZY = [4.6, 4.2, 3.8];
const HELPER_SPEED = [2.6, 2.6, 3.0];

export class BossMeadowScene extends BossScene {
  constructor(game, opts) {
    super(game, opts, { chapter: 0, kingSize: KING_SIZE });
    this.camera.fov = 40;
    this.scene.background = skyTexture('#8fdcff', '#fff4cf');
    addLights(this.scene, { size: 18, dir: new THREE.Vector3(-0.4, 1, 0.55) });
    this.buildMeadow();

    this.k = { x: 0, z: -3, vx: 0, vz: 0, mode: 'wait', t: 1.5, target: null, retarget: 0, dizzyCount: 0, bounces: 0, flopT: 3, flops: 0 };
    this.helpers = [];
    this.waves = [];
    this.flopMark = null;
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

  nearestBean(x, z, skipSlipping = false) {
    let best = null, bd = Infinity;
    for (const e of this.ents) {
      if (skipSlipping && e.slip > 0 && this.ents.length > 1) continue;
      const d = Math.hypot(e.x - x, e.z - z);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  /** Bounces he takes per dizzy spell before shaking it off: about three dizzy rounds per fight. */
  get bounceCap() {
    return 2 + this.n;
  }

  onPhase(p) {
    const want = Math.min(4, Math.max(1, Math.ceil(this.n / 2)) + (p >= 2 ? 1 : 0));
    while (this.helpers.length < want) this.addHelper();
    this.game.audio.play(p === 1 ? 'trap' : 'whoosh');
    this.game.ui.toast(t(`bossm.p${p}`), 2600);
  }

  addHelper() {
    // Helpers pop out of the bushes at the edge, away from the beans.
    const a = Math.random() * Math.PI * 2;
    const mesh = makeGrumble(0xff9f43);
    mesh.scale.setScalar(1.15);
    const h = { mesh, x: Math.cos(a) * (R - 1), z: Math.sin(a) * (R - 1), vx: 0, vz: 0, flat: 0, bumpCd: 1, target: null, retarget: 0 };
    mesh.position.set(h.x, 0, h.z);
    this.scene.add(mesh);
    this.puffs.burst(new THREE.Vector3(h.x, 0.5, h.z), 0xffffff, { count: 14, speed: 4, size: 0.4 });
    this.helpers.push(h);
  }

  updateHelpers(dt) {
    const playing = this.state === 'play' && !this.finished;
    for (const h of this.helpers) {
      h.flat = Math.max(0, h.flat - dt);
      h.bumpCd -= dt;
      h.retarget -= dt;
      let speed = 0;
      if (playing && h.flat <= 0) {
        if (!h.target || h.retarget <= 0) { h.target = this.nearestBean(h.x, h.z, true); h.retarget = 1.8 + Math.random(); }
        if (h.target) {
          const dx = h.target.x - h.x, dz = h.target.z - h.z, d = Math.hypot(dx, dz) || 1;
          speed = HELPER_SPEED[this.phase];
          h.vx += ((dx / d) * speed - h.vx) * Math.min(1, dt * 2.5);
          h.vz += ((dz / d) * speed - h.vz) * Math.min(1, dt * 2.5);
        }
      } else {
        h.vx *= 0.85; h.vz *= 0.85;
      }
      h.x += h.vx * dt; h.z += h.vz * dt;
      const d = Math.hypot(h.x, h.z);
      if (d > R - 0.5) { h.x *= (R - 0.5) / d; h.z *= (R - 0.5) / d; }
      // Keep helpers out of the King.
      const kd = Math.hypot(h.x - this.k.x, h.z - this.k.z);
      if (kd < KING_R + 0.5 && kd > 1e-4 && this.k.mode !== 'air') {
        h.x = this.k.x + ((h.x - this.k.x) / kd) * (KING_R + 0.5);
        h.z = this.k.z + ((h.z - this.k.z) / kd) * (KING_R + 0.5);
      }
      const m = h.mesh;
      m.position.set(h.x, 0, h.z);
      const flat = h.flat > 0 || this.finished;
      m.scale.set(1.15 * (flat ? 1.35 : 1), 1.15 * (flat ? 0.4 : 1 + Math.abs(Math.sin(this.time * 12)) * 0.06), 1.15 * (flat ? 1.35 : 1));
      if (Math.hypot(h.vx, h.vz) > 0.3) m.rotation.y = Math.atan2(h.vx, h.vz);
      if (this.finished) m.rotation.y += dt * 4;
    }
  }

  /** The belly flop: crouch (ring appears), fly, land. */
  startFlop() {
    const k = this.k;
    const e = this.nearestBean(k.x, k.z, true);
    if (!e) return;
    // Aim a little ahead of the bean, inside the meadow.
    let tx = e.x + e.vx * 0.35, tz = e.z + e.vz * 0.35;
    const d = Math.hypot(tx, tz);
    if (d > R - KING_R) { tx *= (R - KING_R) / d; tz *= (R - KING_R) / d; }
    k.mode = 'crouch';
    k.t = 0.6;
    k.from = { x: k.x, z: k.z };
    k.to = { x: tx, z: tz };
    k.flops++;
    this.flopMark = this.makeMarker(tx, tz, FLOP_R);
    this.king.squash(0.7);
    this.game.audio.play('beep');
  }

  landFlop() {
    const k = this.k;
    this.scene.remove(this.flopMark);
    this.flopMark = null;
    this.king.squash(0.6);
    this.game.audio.play('land');
    this.game.audio.play('bump');
    this.puffs.burst(new THREE.Vector3(k.x, 0.3, k.z), 0xffffff, { count: 22, speed: 6, size: 0.5 });
    for (const e of this.ents) {
      if (e.y < 0.6 && Math.hypot(e.x - k.x, e.z - k.z) < FLOP_R + PR * 0.5) this.slip(e, k.x, k.z, 7);
    }
    if (this.phase >= 1) this.addWave(k.x, k.z);
  }

  /** A shockwave ring that rolls out over the grass. Grounded beans it passes slip. */
  addWave(x, z) {
    const mesh = new THREE.Mesh(sharedGeo('bmWave', () => new THREE.TorusGeometry(1, 0.13, 6, 40)), basic(0x8a63f0));
    mesh.rotation.x = Math.PI / 2;
    mesh.position.set(x, 0.15, z);
    this.scene.add(mesh);
    this.waves.push({ mesh, x, z, r: FLOP_R, hit: new Set() });
  }

  updateWaves(dt) {
    for (const w of this.waves) {
      w.r += dt * 5.5;
      w.mesh.scale.set(w.r, w.r, 1 + (WAVE_R - w.r) * 0.3);
      if (this.state === 'play' && !this.finished) {
        for (const e of this.ents) {
          if (w.hit.has(e) || e.y > 0.35) continue;
          const d = Math.hypot(e.x - w.x, e.z - w.z);
          if (Math.abs(d - w.r) < 0.35) { w.hit.add(e); this.slip(e, w.x, w.z, 4); }
        }
      }
      if (w.r >= WAVE_R || this.finished) { w.done = true; this.scene.remove(w.mesh); }
    }
    this.waves = this.waves.filter((w) => !w.done);
  }

  updateKing(dt) {
    const k = this.k;
    const playing = this.state === 'play' && !this.finished;
    k.t -= dt;
    if (!playing) {
      k.vx *= 0.9; k.vz *= 0.9;
      if (k.mode === 'crouch' || k.mode === 'air') { k.mode = 'wait'; if (this.flopMark) { this.scene.remove(this.flopMark); this.flopMark = null; } }
    } else if (k.mode === 'wait') {
      if (k.t <= 0) { k.mode = 'chase'; k.t = 5 + this.phase * 0.5 + Math.random() * 1.5; }
    } else if (k.mode === 'chase') {
      k.retarget -= dt;
      if (!k.target || k.retarget <= 0) { k.target = this.nearestBean(k.x, k.z, true); k.retarget = 1.4; }
      if (k.target) {
        const dx = k.target.x - k.x, dz = k.target.z - k.z, d = Math.hypot(dx, dz) || 1;
        const speed = CHASE_SPEED + this.phase * 0.3 + this.n * 0.1;
        k.vx += ((dx / d) * speed - k.vx) * Math.min(1, dt * 3);
        k.vz += ((dz / d) * speed - k.vz) * Math.min(1, dt * 3);
      }
      k.flopT -= dt;
      if (k.t <= 0) { k.mode = 'spin'; k.t = 1.2; this.game.audio.play('whoosh'); }
      else if (k.flopT <= 0) startFlopOrWait.call(this);
    } else if (k.mode === 'crouch') {
      k.vx *= 0.8; k.vz *= 0.8;
      if (k.t <= 0) { k.mode = 'air'; k.air = FLOP_AIR[this.phase]; k.t = k.air; k.from = { x: k.x, z: k.z }; this.game.audio.play('jump'); }
    } else if (k.mode === 'air') {
      const u = 1 - Math.max(0, k.t) / k.air;
      k.x = THREE.MathUtils.lerp(k.from.x, k.to.x, u);
      k.z = THREE.MathUtils.lerp(k.from.z, k.to.z, u);
      k.vx = k.vz = 0;
      if (k.t <= 0) {
        this.landFlop();
        // Phase 3: a second flop right away now and then.
        if (this.phase >= 2 && k.flops % 2 === 1) { k.mode = 'chase'; k.flopT = 0.5; }
        else { k.mode = 'chase'; k.flopT = FLOP_GAP[this.phase] * (0.85 + Math.random() * 0.3); }
        k.t = Math.max(k.t, 1.5); // keep chasing a little before spinning
      }
    } else if (k.mode === 'spin') {
      k.vx *= 0.9; k.vz *= 0.9;
      if (k.t <= 0) {
        k.mode = 'dizzy';
        k.t = DIZZY[this.phase];
        k.bounces = 0;
        k.dizzyCount++;
        this.game.audio.play('dizzy');
        if (k.dizzyCount <= 2) this.game.ui.toast(t('bossm.dizzy'), 1500);
      }
    } else if (k.mode === 'dizzy') {
      k.vx *= 0.85; k.vz *= 0.85;
      if (k.t <= 0 || k.bounces >= this.bounceCap) {
        if (k.bounces >= this.bounceCap) { this.say(t('bossm.awake')); this.king.squash(1.3); this.game.audio.play('boing'); }
        k.mode = 'chase'; k.t = 5.5 + this.phase * 0.5 + Math.random() * 2; k.target = null; k.flopT = 1.5 + Math.random();
      }
    }
    k.x += k.vx * dt; k.z += k.vz * dt;
    const d = Math.hypot(k.x, k.z);
    if (d > R - KING_R) { k.x *= (R - KING_R) / d; k.z *= (R - KING_R) / d; }

    const g = this.king.group;
    // In the air he follows a high arc; crouching he sinks a little.
    const airY = k.mode === 'air' ? Math.sin(Math.PI * (1 - Math.max(0, k.t) / k.air)) * 3.2 : 0;
    g.position.set(k.x, airY, k.z);
    const dizzy = k.mode === 'dizzy' || this.finished;
    if (k.mode === 'spin') g.rotation.y += dt * 16;
    else if (dizzy) g.rotation.y += dt * 1.5;
    else if (k.mode === 'crouch' && k.to) {
      g.rotation.y = Math.atan2(k.to.x - k.x, k.to.z - k.z);
    } else if (Math.hypot(k.vx, k.vz) > 0.5) {
      const want = Math.atan2(k.vx, k.vz);
      let dd = want - g.rotation.y;
      dd = Math.atan2(Math.sin(dd), Math.cos(dd));
      g.rotation.y += dd * Math.min(1, dt * 8);
    }
    // He crouches a little while dizzy, so his head is easier to reach.
    this.king.inner.position.y = 0;
    this.king.update(dt, { dizzy, hop: k.mode === 'chase' ? 12 : 0 });
    if (dizzy && !this.finished) this.king.inner.scale.y *= 0.85;
    if (k.mode === 'crouch') this.king.inner.scale.y *= 0.8;
    if (this.flopMark) this.flopMark.userData.fill.scale.setScalar(k.mode === 'crouch' ? 0.05 + 0.45 * (1 - k.t / 0.6) : 0.5 + 0.5 * (1 - Math.max(0, k.t) / k.air));
    if (this.finished) this.king.setMood('laugh');
    else this.king.setMood(dizzy ? 'happy' : 'grumpy');
  }

  say(text) {
    this.heyT = 1.1;
    this.heyText = text;
  }

  updateBoss(dt) {
    this.updateKing(dt);
    this.updateHelpers(dt);
    this.updateWaves(dt);
    const k = this.k;
    const headY = this.king.headY;
    const dizzy = k.mode === 'dizzy';
    const airborne = k.mode === 'air';
    for (const e of this.ents) {
      this.moveBean(e, dt, { r: R }, { jump: e.slip <= 0 });
      // Helpers: bounce on their heads to squash them; bumping into them makes you slip.
      for (const h of this.helpers) {
        const hd = Math.hypot(e.x - h.x, e.z - h.z);
        if (hd > 0.85) continue;
        if (e.vy < 0 && e.y > 0.4 && e.y < 1.3 && h.flat <= 0) {
          e.vy = 10; e.grounded = false; e.ch.squash(1.3);
          h.flat = 2.5;
          this.game.audio.play('boing');
          this.puffs.burst(new THREE.Vector3(h.x, 0.5, h.z), 0xffffff, { count: 8, speed: 3, size: 0.3 });
        } else if (e.y < 0.4 && h.flat <= 0 && h.bumpCd <= 0 && this.state === 'play' && !this.finished) {
          if (this.slip(e, h.x, h.z, 6)) { h.bumpCd = 1.2; h.vx *= -0.5; h.vz *= -0.5; }
        }
      }
      if (airborne) { this.placeBean(e, 0); continue; }
      const dx = e.x - k.x, dz = e.z - k.z, d = Math.hypot(dx, dz);
      // Landing on his head.
      if (e.vy < 0 && d < KING_R + 0.15 && e.y < headY + 0.1 && e.y > headY - 0.8) {
        e.y = headY;
        e.vy = 13;
        e.grounded = false;
        e.ch.squash(1.35);
        this.king.squash(0.72);
        this.game.audio.play('boing');
        if (dizzy && this.state === 'play' && k.bounces < this.bounceCap) {
          k.bounces++;
          this.addPoint(e, new THREE.Vector3(k.x, headY + 0.8, k.z));
        } else if (!this.finished) { this.say(t('bossm.hey')); }
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
          this.say(t('bossm.hey'));
          this.king.squash(1.15);
        }
        this.placeBean(e, 0);
      }
    }
    this.separate();
    this.heyT -= dt;
    this.heyTag.style.display = this.heyT > 0 ? '' : 'none';
    if (this.heyT > 0) {
      this.heyTag.textContent = this.heyText || t('bossm.hey');
      this.game.ui.place(this.heyTag, new THREE.Vector3(k.x, this.king.group.position.y + headY + 1.9, k.z), this.camera);
    }
  }

  end() {
    if (this.flopMark) { this.scene.remove(this.flopMark); this.flopMark = null; }
    super.end();
  }

  onStart() {
    this.game.ui.toast(t('bossm.hint'), 4000);
  }
}

/** Flop only when the King is clear of the edge and not about to spin (keeps it readable). */
function startFlopOrWait() {
  if (this.k.t > 1.2) this.startFlop();
  else this.k.flopT = 99;
}
