import * as THREE from 'three';
import { Round, clock } from './common.js';
import { COLORS, toon, sharedGeo } from '../../core/palette.js';
import { makeTree, makeFlower, seeded } from '../../core/world.js';
import { t } from '../../core/i18n.js';

// Statue Stop: walk toward the owl while it looks away, freeze when it turns.
const START_Z = 13;
const FINISH_Z = -15; // long enough that it takes several green phases
const SPEED = 4.2;
const TIME = 45;

function makeOwl() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(sharedGeo('owlBody', () => new THREE.SphereGeometry(1, 24, 18)), toon(0xa0704a));
  body.scale.set(1, 1.2, 0.9);
  body.position.y = 1.2;
  body.castShadow = true;
  const belly = new THREE.Mesh(sharedGeo('owlBelly', () => new THREE.SphereGeometry(0.7, 20, 14)), toon(COLORS.cream));
  belly.scale.set(1, 1.1, 0.6);
  belly.position.set(0, 1.0, 0.55);
  const head = new THREE.Group();
  head.position.y = 2.25;
  const skull = new THREE.Mesh(sharedGeo('owlHead', () => new THREE.SphereGeometry(0.8, 24, 16)), toon(0xb8875a));
  skull.castShadow = true;
  head.add(skull);
  for (const s of [-1, 1]) {
    const ring = new THREE.Mesh(sharedGeo('owlRing', () => new THREE.SphereGeometry(0.34, 16, 12)), toon(COLORS.cream));
    ring.scale.set(1, 1, 0.4);
    ring.position.set(s * 0.32, 0.05, 0.62);
    const eye = new THREE.Mesh(sharedGeo('owlEye', () => new THREE.SphereGeometry(0.16, 12, 10)), toon(COLORS.ink));
    eye.position.set(s * 0.32, 0.05, 0.75);
    const tuft = new THREE.Mesh(sharedGeo('owlTuft', () => new THREE.ConeGeometry(0.16, 0.5, 6)), toon(0x8a5e3c));
    tuft.position.set(s * 0.45, 0.7, 0);
    tuft.rotation.z = -s * 0.4;
    head.add(ring, eye, tuft);
  }
  const beak = new THREE.Mesh(sharedGeo('owlBeak', () => new THREE.ConeGeometry(0.12, 0.3, 6)), toon(0xffb347));
  beak.rotation.x = Math.PI / 2 + 0.4;
  beak.position.set(0, -0.2, 0.8);
  head.add(beak);
  g.add(body, belly, head);
  g.userData.head = head;
  return g;
}

export class StatueRound extends Round {
  static key = 'statue';

  constructor(party) {
    super(party);
    this.halfW = Math.max(4, this.players.length * 1.2);
    this.build();
    this.phase = 'away';
    this.phaseT = 2.5;
    this.t = 0;
    this.finishers = 0;
    this.ents = this.players.map((p, i) => {
      const ch = this.bean(p);
      const n = this.players.length;
      const x = (i - (n - 1) / 2) * Math.min(2, (this.halfW * 2 - 1) / Math.max(1, n - 1));
      ch.yaw = ch.targetYaw = Math.PI;
      return { p, ch, x, z: START_Z, stun: 0, caught: false, place: 0, tag: this.label('label') };
    });
  }

  get title() { return t('statue.title'); }
  get hint() { return t('statue.hint'); }

  build() {
    const g = this.group;
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(90, 60), toon(COLORS.grassDark));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.01;
    ground.receiveShadow = true;
    g.add(ground);
    const field = new THREE.Mesh(new THREE.PlaneGeometry(this.halfW * 2 + 2, START_Z - FINISH_Z + 4), toon(COLORS.grass));
    field.rotation.x = -Math.PI / 2;
    field.position.z = (START_Z + FINISH_Z) / 2;
    field.receiveShadow = true;
    g.add(field);
    for (const [z, color] of [[START_Z + 0.8, COLORS.white], [FINISH_Z, 0xff5d73]]) {
      const line = new THREE.Mesh(new THREE.PlaneGeometry(this.halfW * 2 + 2, 0.4), toon(color));
      line.rotation.x = -Math.PI / 2;
      line.position.set(0, 0.02, z);
      g.add(line);
    }
    const stump = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.3, 1, 14), toon(COLORS.trunk));
    stump.position.set(0, 0.5, FINISH_Z - 2.5);
    stump.castShadow = true;
    g.add(stump);
    this.owl = makeOwl();
    this.owl.position.set(0, 1, FINISH_Z - 2.5);
    this.owl.rotation.y = Math.PI;
    g.add(this.owl);
    const rand = seeded(19);
    for (let i = 0; i < 22; i++) {
      const side = i % 2 ? 1 : -1;
      const tr = makeTree(rand, 1.1 + rand() * 0.6);
      tr.position.set(side * (this.halfW + 3 + rand() * 6), 0, FINISH_Z - 6 + rand() * (START_Z - FINISH_Z + 6));
      g.add(tr);
    }
    for (let i = 0; i < 40; i++) {
      const f = makeFlower(rand);
      f.position.set((rand() - 0.5) * this.halfW * 2, 0, FINISH_Z + rand() * (START_Z - FINISH_Z));
      g.add(f);
    }
    this.owlTag = this.label('label');
  }

  frame() {
    const mid = (START_Z + FINISH_Z) / 2 + 0.5;
    const d = this.party.fitDistance(this.halfW * 2 + 4, START_Z - FINISH_Z + 11);
    this.camera.position.set(0, d * 0.92, mid + d * 0.4);
    this.camera.lookAt(0, 0, mid);
  }

  /** Owl cycle: away (safe) -> turning (warning) -> watching -> turning back. */
  updateOwl(dt) {
    this.phaseT -= dt;
    if (this.phaseT <= 0) {
      if (this.phase === 'away') {
        this.phase = 'turning'; this.phaseT = 0.5;
        this.game.audio.play('dizzy');
      } else if (this.phase === 'turning') {
        this.phase = 'watch'; this.phaseT = 1.4 + Math.random() * 1.6;
        for (const e of this.ents) e.caught = false;
      } else if (this.phase === 'watch') {
        this.phase = 'back'; this.phaseT = 0.4;
      } else {
        this.phase = 'away'; this.phaseT = 1.0 + Math.random() * 1.8;
      }
    }
    const facing = this.phase === 'watch' || this.phase === 'turning';
    const target = facing ? 0 : Math.PI;
    this.owl.rotation.y += (target - this.owl.rotation.y) * Math.min(1, dt * (facing ? 9 : 6));
    this.owl.userData.head.rotation.z = this.phase === 'away' ? Math.sin(this.time * 6) * 0.15 : 0;
    const text = facing ? t('statue.freeze') : t('statue.go');
    this.setLabel(this.owlTag, text, this.owl.position.clone().setY(4.6), facing ? '#f0364f' : '#16b874');
  }

  update(dt, playing) {
    this.time += dt;
    if (playing) { this.t += dt; this.updateOwl(dt); }
    for (const e of this.ents) {
      const d = this.input(e.p);
      let ix = 0, iz = 0;
      if (playing && !e.place && e.stun <= 0) { ix = d.x; iz = -d.y; }
      e.stun -= dt;
      const moving = Math.hypot(ix, iz) > 0.25;
      if (moving) {
        e.x = THREE.MathUtils.clamp(e.x + ix * SPEED * dt, -this.halfW, this.halfW);
        e.z = Math.min(START_Z, e.z + iz * SPEED * dt);
        e.ch.face(ix, iz);
      }
      if (playing && this.phase === 'watch' && moving && !e.caught && !e.place) {
        // Caught: hop back a few steps, never out.
        e.caught = true;
        e.stun = 0.8;
        e.z = Math.min(START_Z, e.z + 5);
        e.ch.squash(0.6);
        this.game.audio.play('boing');
        this.party.puffs.burst(new THREE.Vector3(e.x, 0.6, e.z), 0xffffff, { count: 10, size: 0.35, life: 0.5 });
      }
      if (!e.place && e.z <= FINISH_Z) {
        e.place = ++this.finishers;
        this.game.audio.play('coin');
        this.party.confetti.burst(new THREE.Vector3(e.x, 2, e.z), 0, { count: 30, speed: 6, colors: [e.p.color, COLORS.gold] });
      }
      e.ch.spin = e.place ? this.time * 6 : e.stun > 0 ? e.stun * 10 : 0;
      e.ch.group.position.set(e.x, e.place ? Math.abs(Math.sin(this.time * 6)) * 0.4 : 0, e.z);
      e.ch.update(dt, { moving: moving ? 1 : 0 });
      const tag = e.place ? t('statue.made') : e.stun > 0 ? '!' : '';
      e.tag.style.display = tag ? '' : 'none';
      if (tag) this.setLabel(e.tag, tag, e.ch.group.position.clone().setY(2.1), e.p.css);
    }
    if (playing && !this.done && (this.t >= TIME || this.ents.every((e) => e.place))) {
      this.done = true;
      this.owlTag.style.display = 'none';
    }
  }

  hud() {
    return clock(TIME - this.t);
  }

  score(p) {
    const e = this.ents.find((x) => x.p === p);
    return e.place ? 1000 - e.place : -(e.z - FINISH_Z);
  }

  detail(p) {
    const e = this.ents.find((x) => x.p === p);
    return e.place ? t('statue.made') : t('statue.left', { n: Math.ceil(e.z - FINISH_Z) });
  }
}
