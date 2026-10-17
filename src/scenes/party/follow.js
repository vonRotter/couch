import * as THREE from 'three';
import { Round, clock } from './common.js';
import { makeGrumble } from '../../core/critters.js';
import { makeHat } from '../../core/character.js';
import { COLORS, toon, basic, sharedGeo } from '../../core/palette.js';
import { makeTree, makeFlower, makeBush, seeded } from '../../core/world.js';
import { t, addStrings } from '../../core/i18n.js';

addStrings({
  en: {
    'follow.title': 'Follow the Leader',
    'follow.hint': 'The one with the crown leads and leaves a glowing trail. Walk on the trail to score! When you lead, keep moving: you score for everyone on your trail.',
    'follow.leads': '{name} leads!', 'follow.you': 'Follow the trail!', 'follow.move': 'Keep moving!',
    'follow.grumble': 'Grumble', 'follow.n': '{n} points',
  },
  no: {
    'follow.title': 'Følg lederen',
    'follow.hint': 'Den med kronen leder og lager et lysende spor. Gå på sporet for å få poeng! Når du leder, må du holde deg i bevegelse: du får poeng for alle på sporet ditt.',
    'follow.leads': '{name} leder!', 'follow.you': 'Følg sporet!', 'follow.move': 'Fortsett å gå!',
    'follow.grumble': 'Grumle', 'follow.n': '{n} poeng',
  },
});

// Follow the Leader: the crowned leader leaves a glowing trail; followers score while on it.
const R = 8.5;
const PR = 0.42;
const SPEED = 5.2;
const TRAIL_LIFE = 3.2;
const TRAIL_MIN_AGE = 0.35; // the freshest dots don't count, so nobody just hugs the leader
const TRAIL_STEP = 0.38;
const ON_DIST = 0.62;
const FOLLOW_RATE = 2; // points per second on the trail
const LEAD_RATE = 3; // points per second with every follower on the trail
const HANDOFF = 1.1;
const TOTAL = 44;
const BOT_COLOR = 0x7b6cf6;

function makeCrown() {
  const g = makeHat(6);
  g.scale.setScalar(1.6);
  return g;
}

export class FollowRound extends Round {
  static key = 'follow';

  constructor(party) {
    super(party);
    this.build();
    this.t = 0;
    this.trail = [];
    this.solo = this.players.length === 1;
    const n = this.players.length;
    this.ents = this.players.map((p, i) => ({ p, ch: this.bean(p), name: p.name, css: p.css, color: p.color, points: 0 }));
    if (this.solo) {
      // Grumble friends: one takes turns leading, all of them follow you.
      for (let i = 0; i < 3; i++) {
        const g = makeGrumble(i === 0 ? BOT_COLOR : [0xff8c42, 0x3ddc97][i - 1]);
        this.group.add(g);
        const ch = { group: g, pivot: g, yaw: 0, update(dt) { g.rotation.y += (this.yaw - g.rotation.y) * Math.min(1, dt * 10); }, squash() {}, face(dx, dz) { this.yaw = Math.atan2(dx, dz); } };
        this.ents.push({ p: null, bot: true, ch, name: t('follow.grumble'), css: '#7b6cf6', color: g.userData.body.material.color.getHex(), points: 0, wander: Math.random() * 6, lag: 0.7 + i * 0.45 });
      }
    }
    this.ents.forEach((e, i) => {
      const a = (i / this.ents.length) * Math.PI * 2;
      e.x = Math.sin(a) * 3; e.z = Math.cos(a) * 3;
      e.vx = 0; e.vz = 0; e.onT = 0; e.sparkT = 0;
      e.ring = new THREE.Mesh(sharedGeo('followRing', () => new THREE.RingGeometry(0.5, 0.68, 28)), basic(COLORS.white));
      e.ring.rotation.x = -Math.PI / 2;
      e.ring.visible = false;
      this.group.add(e.ring);
    });
    // Turn order: everyone leads equally often; solo alternates grumble / you.
    if (this.solo) this.order = [this.ents[1], this.ents[0], this.ents[1], this.ents[0]];
    else {
      const k = Math.max(1, Math.floor(6 / n));
      this.order = [];
      for (let r = 0; r < k; r++) this.order.push(...this.ents.slice(0, n));
    }
    this.turnLen = Math.min(9, TOTAL / this.order.length);
    this.turn = -1;
    this.phase = 'idle';
    this.phaseT = 0;
    this.crown = makeCrown();
    this.crown.position.set(0, 4, 0);
    this.group.add(this.crown);
    this.leader = null;
    this.idleT = 0;
    this.moveTag = this.label('label');
    this.moveTag.style.display = 'none';
  }

  get title() { return t('follow.title'); }
  get hint() { return t('follow.hint'); }

  build() {
    const g = this.group;
    const ground = new THREE.Mesh(new THREE.CircleGeometry(60, 40), toon(COLORS.grassDark));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.02;
    ground.receiveShadow = true;
    g.add(ground);
    const field = new THREE.Mesh(new THREE.CircleGeometry(R + 0.4, 64), toon(0x8ee06a));
    field.rotation.x = -Math.PI / 2;
    field.receiveShadow = true;
    g.add(field);
    // A ring of little hedges and flowers marks the edge.
    const rand = seeded(61);
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2;
      const b = makeBush(rand, 0.7);
      b.position.set(Math.sin(a) * (R + 0.9), 0, Math.cos(a) * (R + 0.9));
      b.rotation.y = -a;
      g.add(b);
    }
    for (let i = 0; i < 50; i++) {
      const f = makeFlower(rand);
      const a = rand() * Math.PI * 2, r = R + 1.8 + rand() * 4;
      f.position.set(Math.sin(a) * r, 0, Math.cos(a) * r);
      g.add(f);
    }
    for (let i = 0; i < 18; i++) {
      const a = rand() * Math.PI * 2, r = R + 6 + rand() * 6;
      const tr = makeTree(rand, 1.3 + rand() * 0.6);
      tr.position.set(Math.sin(a) * r, 0, Math.cos(a) * r - 2);
      if (tr.position.z > R) continue;
      g.add(tr);
    }
  }

  frame() {
    const d = this.party.fitDistance(R * 2 + 3, R * 2 * 0.86 + 4);
    this.camera.position.set(0, d * 0.82, d * 0.6);
    this.camera.lookAt(0, 0, 0.9);
  }

  start() {
    this.nextTurn();
  }

  nextTurn() {
    this.turn++;
    if (this.turn >= this.order.length) {
      this.phase = 'over';
      this.leader = null;
      this.done = true;
      return;
    }
    this.phase = 'handoff';
    this.phaseT = HANDOFF;
    this.crownFrom = this.crown.position.clone();
    this.leader = this.order[this.turn];
    for (const d of this.trail) this.group.remove(d.mesh);
    this.trail = [];
    this.lastDrop = null;
    this.idleT = 0;
    this.game.audio.play('whoosh');
  }

  dropDot(e) {
    const mesh = new THREE.Mesh(sharedGeo('followDot', () => new THREE.CircleGeometry(0.4, 18)), basic(e.color, { transparent: true, opacity: 0.85 }));
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(e.x, 0.03, e.z);
    this.group.add(mesh);
    const glow = new THREE.Mesh(sharedGeo('followGlow', () => new THREE.CircleGeometry(0.2, 12)), basic(COLORS.white, { transparent: true, opacity: 0.8 }));
    glow.position.z = 0.01;
    mesh.add(glow);
    this.trail.push({ x: e.x, z: e.z, age: 0, mesh });
    this.lastDrop = { x: e.x, z: e.z };
  }

  /** Input for a grumble: the leader wanders, followers chase an older bit of the trail. */
  botInput(e, dt) {
    if (e === this.leader) {
      e.wander += (Math.random() - 0.5) * dt * 6;
      let dx = Math.sin(e.wander), dz = Math.cos(e.wander);
      const r = Math.hypot(e.x, e.z);
      if (r > R - 2.5) { // turn back toward the middle
        const want = Math.atan2(-e.x, -e.z);
        let diff = want - e.wander;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        e.wander += diff * Math.min(1, dt * 2.5);
        dx = Math.sin(e.wander); dz = Math.cos(e.wander);
      }
      return { x: dx * 0.8, y: -dz * 0.8 };
    }
    let tx = this.leader.x, tz = this.leader.z;
    let best = null, bd = Infinity;
    for (const d of this.trail) {
      const k = Math.abs(d.age - e.lag);
      if (k < bd) { bd = k; best = d; }
    }
    if (best) { tx = best.x; tz = best.z; }
    const dx = tx - e.x, dz = tz - e.z, L = Math.hypot(dx, dz);
    if (L < 0.3) return { x: 0, y: 0 };
    const wob = Math.sin(this.time * 1.7 + e.lag * 5) * 0.35;
    const s = Math.min(1, L / 1.2) * 0.95;
    return { x: (dx / L + wob * (-dz / L)) * s, y: -(dz / L + wob * (dx / L)) * s };
  }

  update(dt, playing) {
    this.time += dt;
    if (playing && this.phase !== 'over') {
      this.t += dt;
      this.phaseT -= dt;
      if (this.phase === 'handoff' && this.phaseT <= 0) {
        this.phase = 'lead';
        this.phaseT = this.turnLen;
        this.game.audio.play('go');
        this.leader.ch.squash(1.4);
      } else if (this.phase === 'lead' && this.phaseT <= 0) {
        this.nextTurn();
      }
    }
    const leading = playing && this.phase === 'lead';
    const L = this.leader;

    // Crown: flies to the new leader, then rides on their head.
    if (L) {
      const head = new THREE.Vector3(L.x, L.bot ? 1.25 : 1.72, L.z);
      if (this.phase === 'handoff') {
        const k = 1 - Math.max(0, this.phaseT) / HANDOFF;
        const s = k * k * (3 - 2 * k);
        this.crown.position.lerpVectors(this.crownFrom, head, s);
        this.crown.position.y += Math.sin(s * Math.PI) * 2.5;
        this.crown.rotation.y += dt * 10;
      } else {
        this.crown.position.copy(head);
        this.crown.position.y += Math.sin(this.time * 5) * 0.06;
        this.crown.rotation.y += dt * 1.5;
      }
    }

    // Trail aging.
    for (const d of this.trail) {
      d.age += dt;
      const s = Math.max(0.2, 1 - (d.age / TRAIL_LIFE) * 0.75);
      d.mesh.scale.setScalar(s);
    }
    this.trail = this.trail.filter((d) => {
      if (d.age < TRAIL_LIFE) return true;
      this.group.remove(d.mesh);
      return false;
    });

    let onCount = 0;
    const followers = this.ents.filter((e) => e !== L);
    for (const e of this.ents) {
      const d = !playing || this.phase === 'over' ? { x: 0, y: 0 } : e.bot ? this.botInput(e, dt) : this.input(e.p);
      const ix = Math.abs(d.x) > 0.15 ? d.x : 0, iz = Math.abs(d.y) > 0.15 ? -d.y : 0;
      e.vx += (ix * SPEED - e.vx) * Math.min(1, dt * 12);
      e.vz += (iz * SPEED - e.vz) * Math.min(1, dt * 12);
      e.x += e.vx * dt; e.z += e.vz * dt;
      const r = Math.hypot(e.x, e.z);
      if (r > R - PR) { e.x *= (R - PR) / r; e.z *= (R - PR) / r; }
      const sp = Math.hypot(e.vx, e.vz) / SPEED;
      if (sp > 0.05) e.ch.face(e.vx, e.vz);
      e.on = false;
      if (leading && e !== L) {
        for (const q of this.trail) {
          if (q.age >= TRAIL_MIN_AGE && Math.hypot(q.x - e.x, q.z - e.z) < ON_DIST) { e.on = true; break; }
        }
        if (e.on) {
          onCount++;
          e.points += FOLLOW_RATE * dt;
          e.sparkT -= dt;
          if (e.sparkT <= 0) {
            e.sparkT = 0.5;
            this.party.confetti.burst(new THREE.Vector3(e.x, 0.6, e.z), 0, { count: 4, speed: 2.5, colors: [L.color, COLORS.gold], life: 0.5, size: 0.13 });
          }
        }
      }
      e.ring.visible = e.on;
      if (e.on) {
        e.ring.material = basic(L.color);
        e.ring.position.set(e.x, 0.05, e.z);
        e.ring.scale.setScalar(1 + Math.sin(this.time * 10) * 0.08);
      }
      const hop = e.bot ? Math.abs(Math.sin(this.time * 12 + e.lag)) * 0.12 * sp : 0;
      e.ch.group.position.set(e.x, hop, e.z);
      e.ch.update(dt, { moving: sp });
    }

    if (leading && L) {
      // The leader paints the trail as they move, and scores for every follower on it.
      if (!this.lastDrop || Math.hypot(L.x - this.lastDrop.x, L.z - this.lastDrop.z) > TRAIL_STEP) { this.dropDot(L); this.idleT = 0; }
      else this.idleT += dt;
      if (followers.length) L.points += LEAD_RATE * dt * (onCount / followers.length);
    }
    const nag = leading && L && this.idleT > 1.2;
    this.moveTag.style.display = nag ? '' : 'none';
    if (nag) this.setLabel(this.moveTag, t('follow.move'), new THREE.Vector3(L.x, 2.6, L.z), L.css);

    // Bump apart.
    for (let i = 0; i < this.ents.length; i++) {
      for (let j = i + 1; j < this.ents.length; j++) {
        const a = this.ents[i], b = this.ents[j];
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
    const L = this.leader;
    const who = L ? `<div class="pill" style="color:${L.css}"><b>${t('follow.leads', { name: L.bot ? t('follow.grumble') : L.name })}</b></div>` : '';
    const left = this.phase === 'idle' ? this.order.length * (this.turnLen + HANDOFF) : this.phase === 'over' ? 0
      : (this.order.length - this.turn - 1) * (this.turnLen + HANDOFF) + Math.max(0, this.phaseT) + (this.phase === 'handoff' ? this.turnLen : 0);
    return `${who}${clock(left)}`;
  }

  score(p) {
    return Math.floor(this.ents.find((x) => x.p === p).points);
  }

  detail(p) {
    return t('follow.n', { n: this.score(p) });
  }
}
