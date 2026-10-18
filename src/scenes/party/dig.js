import * as THREE from 'three';
import { Round, clock } from './common.js';
import { COLORS, toon, sharedGeo } from '../../core/palette.js';
import { makeCloud, makeRock, seeded } from '../../core/world.js';
import { t, addStrings } from '../../core/i18n.js';

addStrings({
  en: {
    'dig.title': 'Treasure Dig',
    'dig.hint': 'Treasure is hidden in the sand! Your sparkles get brighter and faster the closer you are. Hold [A] to dig. Chest = 3, coin = 1, old boot = 0.',
    'dig.hot': 'Hot!', 'dig.warm': 'Warm',
    'dig.boot': 'Boot!', 'dig.nothing': 'Nothing...',
    'dig.n': '{c} chests · {k} coins',
  },
  no: {
    'dig.title': 'Skattejakt',
    'dig.hint': 'Det er skatter gjemt i sanden! Glitteret ditt blir sterkere og raskere jo nærmere du er. Hold [A] for å grave. Kiste = 3, mynt = 1, gammel støvel = 0.',
    'dig.hot': 'Varmt!', 'dig.warm': 'Lunkent',
    'dig.boot': 'Støvel!', 'dig.nothing': 'Ingenting...',
    'dig.n': '{c} kister · {k} mynter',
  },
});

// Treasure Dig: hidden treasure on a beach, sparkles say "warmer/colder", hold A to dig.
const HW = 10; // half width of the dig area
const HD = 6; // half depth
const TIME = 45;
const SPEED = 5.2;
const PR = 0.45;
const DIG_TIME = 1;
const FIND_R = 1.05; // a dig finds treasure this close to the shovel
const MAX_HOLES = 60;
const HOLE_LIFE = 14; // seconds before a hole fills back in
const KINDS = [
  { key: 'chest', points: 3, w: 22 },
  { key: 'coin', points: 1, w: 50 },
  { key: 'boot', points: 0, w: 28 },
];
const TOTAL_W = KINDS.reduce((s, k) => s + k.w, 0);
const COLD = new THREE.Color(0x8fd8ff);
const WARM = new THREE.Color(0xffe47a);
const HOT = new THREE.Color(0xff6a3d);

function pickKind() {
  let r = Math.random() * TOTAL_W;
  for (const k of KINDS) { if ((r -= k.w) < 0) return k; }
  return KINDS[1];
}

const geo = {
  hole: () => sharedGeo('digHole', () => new THREE.CircleGeometry(0.5, 20)),
  mound: () => sharedGeo('digMound', () => new THREE.TorusGeometry(0.55, 0.14, 6, 20)),
  sparkle: () => sharedGeo('digSparkle', () => new THREE.OctahedronGeometry(0.13, 0)),
  tick: () => sharedGeo('digTick', () => new THREE.BoxGeometry(0.16, 0.04, 0.1)),
};

function makeChest() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(sharedGeo('chestBody', () => new THREE.BoxGeometry(0.8, 0.45, 0.5)), toon(0xa0623a));
  body.position.y = 0.22;
  const lid = new THREE.Mesh(sharedGeo('chestLid', () => new THREE.CylinderGeometry(0.25, 0.25, 0.8, 14, 1, false, 0, Math.PI)), toon(0x8a5230));
  lid.rotation.z = Math.PI / 2;
  lid.rotation.y = Math.PI / 2;
  const hinge = new THREE.Group();
  hinge.position.set(0, 0.45, -0.25);
  lid.position.set(0, 0, 0.25);
  hinge.add(lid);
  hinge.rotation.x = -1.1; // lid flipped open
  for (const x of [-0.28, 0.28]) {
    const band = new THREE.Mesh(sharedGeo('chestBand', () => new THREE.BoxGeometry(0.08, 0.47, 0.52)), toon(COLORS.gold));
    band.position.set(x, 0.22, 0);
    g.add(band);
  }
  const lock = new THREE.Mesh(sharedGeo('chestLock', () => new THREE.BoxGeometry(0.14, 0.16, 0.06)), toon(COLORS.gold));
  lock.position.set(0, 0.36, 0.27);
  g.add(body, hinge, lock);
  for (let i = 0; i < 7; i++) {
    const c = new THREE.Mesh(sharedGeo('chestGold', () => new THREE.SphereGeometry(0.1, 8, 6)), toon(COLORS.gold, { emissive: 0x332200 }));
    c.position.set(-0.28 + (i % 4) * 0.19, 0.48 + (i > 3 ? 0.06 : 0), -0.08 + (i % 2) * 0.12);
    g.add(c);
  }
  return g;
}

function makeCoin() {
  const g = new THREE.Group();
  const c = new THREE.Mesh(sharedGeo('digCoin', () => new THREE.CylinderGeometry(0.32, 0.32, 0.08, 20)), toon(COLORS.gold, { emissive: 0x332200 }));
  c.rotation.x = Math.PI / 2;
  c.position.y = 0.35;
  const star = new THREE.Mesh(sharedGeo('digCoinMark', () => new THREE.CylinderGeometry(0.17, 0.17, 0.1, 5)), toon(0xffb347));
  star.rotation.x = Math.PI / 2;
  star.position.y = 0.35;
  g.add(c, star);
  return g;
}

function makeBoot() {
  const g = new THREE.Group();
  const mat = toon(0x7d6b3a);
  const leg = new THREE.Mesh(sharedGeo('bootLeg', () => new THREE.CylinderGeometry(0.16, 0.18, 0.5, 12)), mat);
  leg.position.set(-0.08, 0.38, 0);
  const foot = new THREE.Mesh(sharedGeo('bootFoot', () => new THREE.CapsuleGeometry(0.15, 0.3, 4, 10)), mat);
  foot.rotation.z = Math.PI / 2;
  foot.position.set(0.08, 0.15, 0);
  const sole = new THREE.Mesh(sharedGeo('bootSole', () => new THREE.BoxGeometry(0.62, 0.06, 0.3)), toon(COLORS.ink));
  sole.position.set(0.06, 0.02, 0);
  // A sprig of seaweed sticking out of the top makes it extra silly.
  const weed = new THREE.Mesh(sharedGeo('bootWeed', () => new THREE.ConeGeometry(0.06, 0.4, 5)), toon(COLORS.leaf));
  weed.position.set(-0.1, 0.78, 0);
  weed.rotation.z = 0.4;
  g.add(leg, foot, sole, weed);
  return g;
}

function makePalm(rand, scale = 1) {
  const g = new THREE.Group();
  const lean = (rand() - 0.5) * 0.5;
  let x = 0, y = 0;
  for (let i = 0; i < 6; i++) {
    const seg = new THREE.Mesh(sharedGeo('palmSeg', () => new THREE.CylinderGeometry(0.2, 0.26, 0.7, 8)), toon(i % 2 ? COLORS.trunk : 0xb8875a));
    seg.position.set(x, y + 0.35, 0);
    seg.rotation.z = -lean;
    seg.castShadow = true;
    g.add(seg);
    x += Math.sin(lean) * 0.7 * (1 + i * 0.15);
    y += 0.66;
  }
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const leaf = new THREE.Mesh(sharedGeo('palmLeaf', () => new THREE.SphereGeometry(0.5, 10, 6)), toon(i % 2 ? COLORS.leaf : COLORS.leafLight));
    leaf.scale.set(2.6, 0.18, 0.8);
    leaf.position.set(x + Math.cos(a) * 1.1, y - 0.15, Math.sin(a) * 1.1);
    leaf.rotation.y = -a;
    leaf.rotation.z = -0.45;
    leaf.castShadow = true;
    g.add(leaf);
  }
  for (let i = 0; i < 3; i++) {
    const nut = new THREE.Mesh(sharedGeo('coconut', () => new THREE.SphereGeometry(0.17, 10, 8)), toon(0x7a5230));
    nut.position.set(x + Math.cos(i * 2.1) * 0.22, y - 0.25, Math.sin(i * 2.1) * 0.22);
    g.add(nut);
  }
  g.scale.setScalar(scale);
  return g;
}

function makeShovel(color) {
  const g = new THREE.Group();
  const handle = new THREE.Mesh(sharedGeo('shovelHandle', () => new THREE.CylinderGeometry(0.035, 0.035, 0.8, 6)), toon(COLORS.trunk));
  handle.position.y = 0.4;
  const blade = new THREE.Mesh(sharedGeo('shovelBlade', () => new THREE.BoxGeometry(0.26, 0.3, 0.04)), toon(color));
  blade.position.y = -0.05;
  const grip = new THREE.Mesh(sharedGeo('shovelGrip', () => new THREE.BoxGeometry(0.2, 0.05, 0.05)), toon(color));
  grip.position.y = 0.8;
  g.add(handle, blade, grip);
  return g;
}

export class DigRound extends Round {
  static key = 'dig';

  constructor(party) {
    super(party);
    this.t = 0;
    this.holes = [];
    this.treasures = [];
    this.reveals = [];
    this.build();
    const n = this.players.length;
    this.ents = this.players.map((p, i) => {
      const ch = this.bean(p);
      const shovel = makeShovel(p.color);
      shovel.position.set(0.5, 0.35, 0.15);
      shovel.rotation.set(0.3, 0, -0.25);
      ch.pivot.add(shovel);
      // Hint sparkles: one unshared material per player so each can glow on its own.
      const sparkMat = new THREE.MeshBasicMaterial({ color: COLD, transparent: true, opacity: 0.3, depthWrite: false });
      const sparkles = new THREE.Group();
      for (let k = 0; k < 6; k++) {
        const s = new THREE.Mesh(geo.sparkle(), sparkMat);
        s.userData.k = k;
        sparkles.add(s);
      }
      this.group.add(sparkles);
      // Dig progress: a ring of little ticks that fill up while A is held.
      const ticks = new THREE.Group();
      for (let k = 0; k < 10; k++) {
        const a = (k / 10) * Math.PI * 2;
        const tk = new THREE.Mesh(geo.tick(), toon(p.color));
        tk.position.set(Math.sin(a) * 0.72, 0.05, Math.cos(a) * 0.72);
        tk.rotation.y = a;
        tk.visible = false;
        ticks.add(tk);
      }
      this.group.add(ticks);
      const a = (i / n) * Math.PI * 2 + 0.4;
      const x = n === 1 ? 0 : Math.sin(a) * 3.5, z = n === 1 ? 1.5 : Math.cos(a) * 2.6 + 0.5;
      ch.group.position.set(x, 0, z);
      return {
        p, ch, shovel, sparkles, sparkMat, ticks, x, z, vx: 0, vz: 0,
        dig: 0, cool: 0, heat: 0, orbit: Math.random() * 6, sparkT: 0,
        points: 0, chests: 0, coins: 0, boots: 0, tag: this.label('label'),
      };
    });
    const count = 3 + Math.ceil(n * 0.8);
    for (let i = 0; i < count; i++) this.hide();
  }

  get title() { return t('dig.title'); }
  get hint() { return t('dig.hint'); }

  build() {
    const g = this.group;
    const rand = seeded(77);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(90, 70), toon(COLORS.sand));
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, -0.01, 10);
    ground.receiveShadow = true;
    g.add(ground);
    // The dig area itself is a touch lighter so its edges read clearly.
    const area = new THREE.Mesh(new THREE.PlaneGeometry(HW * 2 + 1, HD * 2 + 1), toon(0xfbe9b7));
    area.rotation.x = -Math.PI / 2;
    area.receiveShadow = true;
    g.add(area);
    const wet = new THREE.Mesh(new THREE.PlaneGeometry(90, 3), toon(0xe8c98a));
    wet.rotation.x = -Math.PI / 2;
    wet.position.set(0, 0, -HD - 2.6);
    g.add(wet);
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(120, 50), toon(COLORS.water));
    sea.rotation.x = -Math.PI / 2;
    sea.position.set(0, 0.02, -HD - 4 - 25);
    g.add(sea);
    this.foam = new THREE.Mesh(new THREE.PlaneGeometry(120, 0.6), toon(COLORS.white));
    this.foam.rotation.x = -Math.PI / 2;
    this.foam.position.set(0, 0.04, -HD - 4);
    g.add(this.foam);
    // Rope fence with little posts around the dig area.
    const postGeo = sharedGeo('digPost', () => new THREE.CylinderGeometry(0.09, 0.11, 0.7, 6));
    const corners = [[-HW - 0.5, -HD - 0.5], [HW + 0.5, -HD - 0.5], [HW + 0.5, HD + 0.5], [-HW - 0.5, HD + 0.5]];
    for (let c = 0; c < 4; c++) {
      const [x0, z0] = corners[c], [x1, z1] = corners[(c + 1) % 4];
      const len = Math.hypot(x1 - x0, z1 - z0);
      const steps = Math.round(len / 2.6);
      for (let s = 0; s < steps; s++) {
        const post = new THREE.Mesh(postGeo, toon(COLORS.trunk));
        post.position.set(x0 + ((x1 - x0) * s) / steps, 0.35, z0 + ((z1 - z0) * s) / steps);
        post.castShadow = true;
        g.add(post);
      }
      const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, len, 5), toon(0xe8c690));
      rope.position.set((x0 + x1) / 2, 0.6, (z0 + z1) / 2);
      rope.rotation.set(Math.PI / 2, 0, 0);
      rope.rotation.order = 'YXZ';
      rope.rotation.y = Math.atan2(x1 - x0, z1 - z0);
      g.add(rope);
    }
    // Palms, rocks, an umbrella, shells and starfish around the edges.
    for (const [x, z, s] of [[-13.5, -5, 1.2], [-15, 1, 1], [-13, 6, 0.9], [13.5, -4.5, 1.15], [15.5, 2, 1], [12.8, 7, 0.85], [-6, -10, 1.1], [7, -10.5, 1]]) {
      const palm = makePalm(rand, s);
      palm.position.set(x, 0, z);
      palm.rotation.y = rand() * 6;
      g.add(palm);
    }
    for (let i = 0; i < 8; i++) {
      const r = makeRock(rand, 0.4 + rand() * 0.5);
      const side = i % 2 ? 1 : -1;
      r.position.set(side * (HW + 1.8 + rand() * 4), 0.1, -HD + rand() * HD * 2);
      g.add(r);
    }
    const umbrella = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.6, 6), toon(COLORS.white));
    pole.position.y = 1.3;
    umbrella.add(pole);
    for (let i = 0; i < 8; i++) {
      const wedge = new THREE.Mesh(sharedGeo('umbWedge', () => new THREE.ConeGeometry(1.5, 0.6, 3, 1, true, 0, Math.PI / 4)), toon(i % 2 ? 0xff5d73 : COLORS.white));
      wedge.position.y = 2.7;
      wedge.rotation.y = (i / 8) * Math.PI * 2;
      wedge.castShadow = true;
      umbrella.add(wedge);
    }
    umbrella.position.set(HW + 3.4, 0, -1.2);
    umbrella.rotation.z = -0.15;
    g.add(umbrella);
    const towel = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 2.4), toon(0x4cc9f0));
    towel.rotation.x = -Math.PI / 2;
    towel.rotation.z = 0.3;
    towel.position.set(HW + 3.2, 0.02, 0.6);
    g.add(towel);
    const castle = new THREE.Group();
    const keep = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.85, 0.9, 10), toon(0xf0d48f));
    keep.position.y = 0.45;
    castle.add(keep);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const tower = new THREE.Mesh(sharedGeo('castleTower', () => new THREE.CylinderGeometry(0.25, 0.3, 1.2, 8)), toon(0xf0d48f));
      tower.position.set(Math.cos(a) * 0.8, 0.6, Math.sin(a) * 0.8);
      const roof = new THREE.Mesh(sharedGeo('castleRoof', () => new THREE.ConeGeometry(0.3, 0.4, 8)), toon(0xe8b86a));
      roof.position.set(Math.cos(a) * 0.8, 1.4, Math.sin(a) * 0.8);
      castle.add(tower, roof);
    }
    const flag = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.25, 0.02), toon(0xff5d73));
    flag.position.set(0.2, 1.55, 0);
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.8, 4), toon(COLORS.white));
    stick.position.set(0, 1.3, 0);
    castle.add(flag, stick);
    castle.position.set(-HW - 3.4, 0, -1.6);
    g.add(castle);
    for (let i = 0; i < 14; i++) {
      const shell = new THREE.Mesh(sharedGeo('shell', () => new THREE.SphereGeometry(0.16, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2)), toon([0xff9fd0, COLORS.white, 0xffb347][i % 3]));
      shell.scale.set(1, 0.5, 1.2);
      const side = i % 2 ? 1 : -1;
      shell.position.set(side * (HW + 1 + rand() * 5), 0, -HD - 1 + rand() * (HD * 2 + 4));
      g.add(shell);
    }
    for (let i = 0; i < 3; i++) {
      const c = makeCloud(rand, 2);
      c.position.set(-16 + i * 16, 12 + rand() * 3, -28);
      g.add(c);
    }
  }

  frame() {
    // Tilted a little more than a top-down view so the sea and palms frame the dig site.
    const d = this.party.fitDistance(HW * 2 + 5, HD * 2 + 7);
    this.camera.position.set(0, d * 0.74, d * 0.66);
    this.camera.lookAt(0, 0, -1.2);
  }

  /** Bury a new treasure somewhere free. */
  hide() {
    let x = 0, z = 0;
    for (let tries = 0; tries < 80; tries++) {
      x = (Math.random() * 2 - 1) * (HW - 1);
      z = (Math.random() * 2 - 1) * (HD - 1);
      const free = this.treasures.every((tr) => Math.hypot(tr.x - x, tr.z - z) > 2.6)
        && (this.ents || []).every((e) => Math.hypot(e.x - x, e.z - z) > 2)
        && this.holes.every((h) => Math.hypot(h.x - x, h.z - z) > 1);
      if (free) break;
    }
    this.treasures.push({ x, z, kind: pickKind() });
  }

  giggle() {
    const a = this.game.audio;
    if (!a.ctx) return;
    [0, 0.13, 0.26].forEach((d, i) => a.tone(820 - i * 60, 0.1, { type: 'triangle', vol: 0.1, slide: 1.35, delay: d }));
  }

  makeHole(x, z) {
    const h = new THREE.Group();
    const pit = new THREE.Mesh(geo.hole(), toon(0xa8814e));
    pit.rotation.x = -Math.PI / 2;
    pit.position.y = 0.015;
    const mound = new THREE.Mesh(geo.mound(), toon(0xf0d48f));
    mound.rotation.x = Math.PI / 2;
    mound.scale.z = 0.6;
    mound.position.y = 0.03;
    h.add(pit, mound);
    h.position.set(x, 0, z);
    h.scale.setScalar(0.2);
    this.group.add(h);
    this.holes.push({ x, z, mesh: h, grow: 0 });
    if (this.holes.length > MAX_HOLES) this.group.remove(this.holes.shift().mesh);
  }

  finishDig(e) {
    const fx = Math.sin(e.ch.yaw), fz = Math.cos(e.ch.yaw);
    const x = THREE.MathUtils.clamp(e.x + fx * 0.55, -HW, HW);
    const z = THREE.MathUtils.clamp(e.z + fz * 0.55, -HD, HD);
    this.makeHole(x, z);
    this.party.puffs.burst(new THREE.Vector3(x, 0.3, z), 0xf0d48f, { count: 10, size: 0.3, life: 0.5, speed: 3 });
    e.ch.squash(1.25);
    let best = null, bd = FIND_R;
    for (const tr of this.treasures) {
      const d = Math.hypot(tr.x - x, tr.z - z);
      if (d < bd) { bd = d; best = tr; }
    }
    if (!best) {
      this.game.audio.play('land');
      this.reveal(e, null, x, z);
      return;
    }
    this.treasures.splice(this.treasures.indexOf(best), 1);
    this.later(1.2, () => this.hide());
    const k = best.kind;
    e.points += k.points;
    if (k.key === 'chest') { e.chests++; this.game.audio.play('star'); }
    else if (k.key === 'coin') { e.coins++; this.game.audio.play('coin'); }
    else { e.boots++; this.game.audio.play('boing'); this.giggle(); }
    if (k.points) this.party.confetti.burst(new THREE.Vector3(x, 1, z), 0, { count: k.points > 1 ? 30 : 12, speed: 5, colors: [COLORS.gold, e.p.color, COLORS.white] });
    this.reveal(e, k, x, z);
  }

  /** Pop the find out of the hole with a floating label, then fly it to the digger. */
  reveal(e, kind, x, z) {
    let mesh = null;
    if (kind) {
      mesh = kind.key === 'chest' ? makeChest() : kind.key === 'coin' ? makeCoin() : makeBoot();
      mesh.position.set(x, 0, z);
      mesh.scale.setScalar(kind.key === 'coin' ? 1.2 : 1.1);
      this.group.add(mesh);
    }
    const text = !kind ? t('dig.nothing') : kind.key === 'boot' ? `${t('dig.boot')} <small>+0</small>` : `+${kind.points}`;
    const color = !kind ? '#8a6a3a' : kind.key === 'boot' ? '#7d6b3a' : '#e0a000';
    const tag = this.label('label');
    this.reveals.push({ e, mesh, x, z, kind, t: 0, tag, text, color });
  }

  update(dt, playing) {
    this.time += dt;
    if (playing) this.t += dt;
    this.foam.position.z = -HD - 4 + Math.sin(this.time * 0.9) * 0.6;
    // Holes pop open, then the sand slowly fills them back in so the beach stays readable.
    for (const h of this.holes) {
      h.age = (h.age || 0) + dt;
      if (h.grow < 1) { h.grow = Math.min(1, h.grow + dt * 6); h.mesh.scale.setScalar(0.2 + 0.8 * h.grow); }
      if (h.age > HOLE_LIFE) h.mesh.scale.setScalar(Math.max(0.001, 1 - (h.age - HOLE_LIFE)));
    }
    this.holes = this.holes.filter((h) => {
      if (h.age < HOLE_LIFE + 1) return true;
      this.group.remove(h.mesh);
      return false;
    });
    const live = playing && this.t < TIME;
    for (const e of this.ents) this.updateEnt(e, dt, live);
    this.separate();
    this.updateReveals(dt);
    if (playing && this.t >= TIME && !this.done) {
      this.done = true;
      for (const e of this.ents) { e.dig = 0; e.ticks.children.forEach((tk) => { tk.visible = false; }); }
    }
  }

  updateEnt(e, dt, live) {
    const d = live ? this.input(e.p) : { x: 0, y: 0, a: false };
    e.cool -= dt;
    // Holding A digs on the spot; letting go cancels.
    if (live && d.a && e.cool <= 0) {
      e.dig += dt / DIG_TIME;
      e.vx = e.vz = 0;
      if (Math.random() < dt * 10) {
        const fx = Math.sin(e.ch.yaw), fz = Math.cos(e.ch.yaw);
        this.party.puffs.burst(new THREE.Vector3(e.x + fx * 0.55, 0.2, e.z + fz * 0.55), 0xf0d48f, { count: 2, size: 0.2, life: 0.35, speed: 2 });
      }
      if (e.dig >= 1) { e.dig = 0; e.cool = 0.3; this.finishDig(e); }
    } else {
      e.dig = 0;
      const ix = d.x, iz = -d.y;
      e.vx += (ix * SPEED - e.vx) * Math.min(1, dt * 12);
      e.vz += (iz * SPEED - e.vz) * Math.min(1, dt * 12);
      e.x = THREE.MathUtils.clamp(e.x + e.vx * dt, -HW, HW);
      e.z = THREE.MathUtils.clamp(e.z + e.vz * dt, -HD, HD);
      e.ch.face(e.vx, e.vz);
    }
    const digging = e.dig > 0;
    e.shovel.rotation.x = digging ? 0.3 + Math.sin(this.time * 18) * 0.7 : 0.3;
    e.shovel.position.y = digging ? 0.25 + Math.abs(Math.sin(this.time * 18)) * 0.15 : 0.35;
    const lit = Math.floor(e.dig * 10 + 0.001);
    e.ticks.position.set(e.x, 0, e.z);
    e.ticks.children.forEach((tk, k) => { tk.visible = digging && k < lit; });
    const sp = Math.hypot(e.vx, e.vz) / SPEED;
    e.ch.group.position.set(e.x, digging ? -Math.abs(Math.sin(this.time * 18)) * 0.05 : 0, e.z);
    e.ch.update(dt, { moving: sp });
    this.updateSparkles(e, dt, live);
  }

  /** "Warmer / colder": sparkles brighten, warm up and speed up near the closest buried find. */
  updateSparkles(e, dt, live) {
    let nearest = Infinity;
    for (const tr of this.treasures) nearest = Math.min(nearest, Math.hypot(tr.x - e.x, tr.z - e.z));
    const target = live ? THREE.MathUtils.clamp(1 - (nearest - 0.7) / 6.5, 0, 1) : 0;
    e.heat += (target - e.heat) * Math.min(1, dt * 5);
    const h = e.heat;
    e.orbit += dt * (0.8 + h * h * 11);
    const c = e.sparkMat.color;
    if (h < 0.6) c.copy(COLD).lerp(WARM, h / 0.6); else c.copy(WARM).lerp(HOT, (h - 0.6) / 0.4);
    e.sparkMat.opacity = 0.18 + 0.82 * h;
    const r = 0.75 - h * 0.1;
    e.sparkles.position.set(e.x, 0, e.z);
    for (const s of e.sparkles.children) {
      const k = s.userData.k;
      const a = e.orbit + (k / 6) * Math.PI * 2;
      s.position.set(Math.cos(a) * r, 0.35 + ((k % 3) * 0.4) + Math.sin(e.orbit * 2 + k) * 0.12, Math.sin(a) * r);
      const tw = 0.5 + 0.5 * Math.sin(this.time * (6 + h * 14) + k * 1.7);
      const sc = 0.6 + h * 0.6 + tw * 0.35 * h;
      s.scale.set(sc, sc * 1.8, sc); // tall diamonds read as twinkles, not confetti
      s.rotation.y = this.time * 4 + k;
    }
    // Very close: little sparks fly up as well.
    e.sparkT -= dt * h * h * 14;
    if (live && e.sparkT <= 0 && h > 0.55) {
      e.sparkT = 1;
      this.party.confetti.burst(new THREE.Vector3(e.x, 1.3, e.z), 0, { count: 1, speed: 1.5, up: 3, size: 0.07, life: 0.5, colors: [COLORS.gold, 0xff8c42], gravity: -4 });
    }
    const status = h > 0.82 ? t('dig.hot') : h > 0.55 ? t('dig.warm') : '';
    const text = `${e.points}${status ? `<small>${status}</small>` : ''}`;
    this.setLabel(e.tag, text, e.ch.group.position.clone().setY(2.15), e.p.css);
  }

  updateReveals(dt) {
    for (const r of this.reveals) {
      r.t += dt;
      const k = Math.min(1, r.t / 0.45);
      let y = 0.1 + (1 - (1 - k) * (1 - k)) * 1.5;
      if (r.mesh) {
        if (r.t < 1.2) {
          r.mesh.position.set(r.x, y, r.z);
          r.mesh.rotation.y += dt * (r.kind.key === 'coin' ? 8 : 3);
          if (r.kind.key === 'boot') r.mesh.rotation.z = Math.sin(r.t * 14) * 0.3;
        } else {
          // Fly into the digger's arms and shrink away.
          const f = Math.min(1, (r.t - 1.2) / 0.35);
          r.mesh.position.lerpVectors(new THREE.Vector3(r.x, y, r.z), r.e.ch.group.position.clone().setY(1), f);
          r.mesh.scale.setScalar(1.1 * (1 - f) + 0.01);
        }
      }
      y += 1.1;
      r.tag.style.opacity = String(Math.min(1, 3 * (1.6 - r.t)));
      this.setLabel(r.tag, r.text, new THREE.Vector3(r.x, y + r.t * 0.3, r.z), r.color);
      if (r.t > 1.6) r.gone = true;
    }
    this.reveals = this.reveals.filter((r) => {
      if (!r.gone) return true;
      if (r.mesh) this.group.remove(r.mesh);
      r.tag.remove();
      this.labels = this.labels.filter((l) => l !== r.tag);
      return false;
    });
  }

  separate() {
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
    return clock(TIME - this.t);
  }

  score(p) {
    return this.ents.find((x) => x.p === p).points;
  }

  detail(p) {
    const e = this.ents.find((x) => x.p === p);
    return t('dig.n', { c: e.chests, k: e.coins });
  }
}
