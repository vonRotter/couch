import * as THREE from 'three';
import { Round } from './common.js';
import { makeGrumble } from '../../core/critters.js';
import { COLORS, toon, sharedGeo } from '../../core/palette.js';
import { makeTree, makeFlower, makeBush, seeded } from '../../core/world.js';
import { t, addStrings } from '../../core/i18n.js';

addStrings({
  en: {
    'potato.title': 'Hot Potato Picnic',
    'potato.hint': 'A ticking cream pie is going round! Bump into someone (or press [A] next to them) to hand it over. [A] on its own is a little dash. Whoever holds it when it goes SPLAT gets creamed, and everyone else scores.',
    'potato.pie': 'Pie {n} of {total}', 'potato.pass': 'Pass the pie!', 'potato.splat': 'SPLAT!',
    'potato.detail': '{n} points · creamed {s}×',
  },
  no: {
    'potato.title': 'Varm potet-piknik',
    'potato.hint': 'En tikkende kremkake går på rundgang! Dult borti noen (eller trykk [A] ved siden av dem) for å gi den videre. [A] alene er et lite byks. Den som holder kaken når den sier SPLAT, får krem i fjeset, og alle andre får poeng.',
    'potato.pie': 'Kake {n} av {total}', 'potato.pass': 'Send kaka videre!', 'potato.splat': 'SPLAT!',
    'potato.detail': '{n} poeng · fikk krem {s}×',
  },
});

// Hot Potato Picnic: pass the ticking cream pie by bumping; don't hold it when it splats.
const HX = 7.2; // picnic blanket half width
const HZ = 4.4; // picnic blanket half depth
const PR = 0.45;
const SPEED = 5.2;
const HOLDER_BOOST = 1.12; // the holder is a touch faster so passing is always possible
const DASH_SPEED = 12;
const DASH_TIME = 0.16;
const DASH_CD = 1.0;
const TOUCH = PR * 2 + 0.12;
const REACH = 1.9; // A-press pass distance
const MIN_HOLD = 0.35; // the pie has to land before it can move on
const NO_BACKS = 0.9; // no instant pass-backs to the giver
const PIES = 4;
const GAP = 2.2;
const TABLE = new THREE.Vector3(0, 1.05, -HZ - 1.9);
const BOT_COLORS = [0x7b6cf6, 0x55b8a0];

/** A grumble that can face, squash and wobble like a Character. */
function grumbleBody(color) {
  const inner = makeGrumble(color);
  inner.scale.setScalar(1.25);
  const group = new THREE.Group();
  group.add(inner);
  return {
    group, pivot: inner, yaw: 0, targetYaw: 0, spin: 0, sq: 1, sqVel: 0, walk: 0,
    face(dx, dz) { if (Math.abs(dx) + Math.abs(dz) > 0.01) this.targetYaw = Math.atan2(dx, dz); },
    squash(a) { this.sq = a; this.sqVel = 0; },
    update(dt, { moving = 0 } = {}) {
      this.walk += dt * (6 + 12 * moving);
      this.sqVel += ((1 - this.sq) * 320 - this.sqVel * 16) * dt;
      this.sq += this.sqVel * dt;
      const s = THREE.MathUtils.clamp(this.sq, 0.5, 1.6), w = 1 / Math.sqrt(s);
      inner.scale.set(1.25 * w, 1.25 * s, 1.25 * w);
      inner.position.y = Math.abs(Math.sin(this.walk)) * 0.12 * moving;
      let d = this.targetYaw - this.yaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.yaw += d * Math.min(1, dt * 12);
      group.rotation.y = this.yaw + this.spin;
    },
  };
}

/** Cream pie: tin, crust rim, whipped cream swirl and a cherry. */
function makePie(cherryMat) {
  const g = new THREE.Group();
  const tin = new THREE.Mesh(sharedGeo('pieTin', () => new THREE.CylinderGeometry(0.5, 0.4, 0.18, 22)), toon(0xc9c3d9));
  tin.castShadow = true;
  const crust = new THREE.Mesh(sharedGeo('pieCrust', () => new THREE.TorusGeometry(0.46, 0.08, 8, 22)), toon(0xe8b06a));
  crust.rotation.x = Math.PI / 2;
  crust.position.y = 0.1;
  const cream = new THREE.Mesh(sharedGeo('pieCream', () => new THREE.SphereGeometry(0.44, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2)), toon(COLORS.icing));
  cream.scale.y = 0.55;
  cream.position.y = 0.08;
  g.add(tin, crust, cream);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const dollop = new THREE.Mesh(sharedGeo('pieDollop', () => new THREE.ConeGeometry(0.1, 0.16, 8)), toon(COLORS.icing));
    dollop.position.set(Math.cos(a) * 0.3, 0.22, Math.sin(a) * 0.3);
    g.add(dollop);
  }
  const cherry = new THREE.Mesh(sharedGeo('pieCherry', () => new THREE.SphereGeometry(0.11, 12, 10)), cherryMat);
  cherry.position.y = 0.35;
  const stem = new THREE.Mesh(sharedGeo('pieStem', () => new THREE.CylinderGeometry(0.015, 0.015, 0.16, 5)), toon(COLORS.leaf));
  stem.position.set(0.03, 0.47, 0);
  stem.rotation.z = -0.4;
  g.add(cherry, stem);
  return g;
}

/** Whipped cream splat that covers a face; hidden until someone gets creamed. */
function makeCreamFace(y, z, s) {
  const g = new THREE.Group();
  const blobs = [[0, 0.05, 0, 0.2], [-0.16, 0.12, -0.02, 0.15], [0.17, 0.1, -0.02, 0.16], [-0.1, -0.1, 0, 0.13], [0.12, -0.08, 0, 0.12], [0, 0.26, -0.08, 0.14]];
  for (const [x, by, bz, r] of blobs) {
    const b = new THREE.Mesh(sharedGeo('creamBlob', () => new THREE.SphereGeometry(1, 12, 10)), toon(COLORS.icing));
    b.position.set(x, by, bz);
    b.scale.set(r, r, r * 0.6);
    g.add(b);
  }
  for (const x of [-0.12, 0.05, 0.18]) {
    const drip = new THREE.Mesh(sharedGeo('creamBlob', () => new THREE.SphereGeometry(1, 12, 10)), toon(COLORS.icing));
    drip.position.set(x, -0.22, 0.02);
    drip.scale.set(0.05, 0.12, 0.05);
    g.add(drip);
  }
  const cherry = new THREE.Mesh(sharedGeo('pieCherry', () => new THREE.SphereGeometry(0.11, 12, 10)), toon(0xe0263f));
  cherry.position.set(0.05, 0.42, -0.1);
  g.add(cherry);
  g.position.set(0, y, z);
  g.scale.setScalar(s);
  g.visible = false;
  return g;
}

export class PotatoRound extends Round {
  static key = 'potato';

  constructor(party) {
    super(party);
    this.build();
    this.pies = 0;
    this.phase = 'idle';
    this.phaseT = 0;
    this.tins = [];
    this.cherryMat = new THREE.MeshToonMaterial({ color: 0xe0263f, gradientMap: toon(0xffffff).gradientMap });
    this.pieMesh = makePie(this.cherryMat);
    this.pieMesh.visible = false;
    this.group.add(this.pieMesh);
    // Red warning ring under whoever holds the pie.
    this.holderRing = new THREE.Mesh(new THREE.RingGeometry(0.6, 0.82, 32), toon(0xff3b5c));
    this.holderRing.rotation.x = -Math.PI / 2;
    this.holderRing.position.y = 0.07;
    this.holderRing.visible = false;
    this.group.add(this.holderRing);
    this.pie = null;

    const roster = this.players.map((p) => ({ p }));
    if (this.players.length === 1) for (const c of BOT_COLORS) roster.push({ p: null, color: c });
    const n = roster.length;
    this.ents = roster.map((r, i) => {
      const bot = !r.p;
      const ch = bot ? grumbleBody(r.color) : this.bean(r.p);
      if (bot) this.group.add(ch.group);
      const a = (i / n) * Math.PI * 2 + 0.3;
      const e = {
        p: r.p, bot, ch, x: Math.sin(a) * HX * 0.55, z: Math.cos(a) * HZ * 0.55, vx: 0, vz: 0,
        dash: 0, dashCd: 0, dx: 0, dz: 1, points: 0, splats: 0, cream: 0, wobble: 0,
        headY: bot ? 1.15 : 1.3, css: bot ? '#' + r.color.toString(16).padStart(6, '0') : r.p.css,
        think: 0, wantX: 0, wantZ: 0, tag: this.label('label'), shout: 0,
      };
      e.creamFace = bot ? makeCreamFace(0.56, 0.38, 0.9) : makeCreamFace(0.82, 0.36, 1);
      ch.pivot.add(e.creamFace);
      ch.face(-e.x, -e.z);
      ch.yaw = ch.targetYaw;
      return e;
    });
  }

  get title() { return t('potato.title'); }
  get hint() { return t('potato.hint'); }

  build() {
    const g = this.group;
    const ground = new THREE.Mesh(new THREE.CircleGeometry(60, 40), toon(COLORS.grass));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.02;
    ground.receiveShadow = true;
    g.add(ground);
    // Checkered picnic blanket from a tiny canvas.
    const cols = 10, rows = 6;
    const c = document.createElement('canvas');
    c.width = cols; c.height = rows;
    const cx = c.getContext('2d');
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      cx.fillStyle = (x + y) % 2 ? '#fff3dc' : '#ff6f86';
      cx.fillRect(x, y, 1, 1);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    const blanket = new THREE.Mesh(new THREE.PlaneGeometry(HX * 2, HZ * 2), new THREE.MeshToonMaterial({ map: tex, gradientMap: toon(0xffffff).gradientMap }));
    blanket.rotation.x = -Math.PI / 2;
    blanket.position.y = 0.04;
    blanket.receiveShadow = true;
    const hem = new THREE.Mesh(new THREE.BoxGeometry(HX * 2 + 0.5, 0.04, HZ * 2 + 0.5), toon(0xe0455f));
    hem.position.y = -0.005;
    hem.receiveShadow = true;
    g.add(hem, blanket);

    // Pie table behind the blanket: the stack shows how many pies are left.
    const top = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.14, 24), toon(0xb87a48));
    top.position.set(TABLE.x, 0.9, TABLE.z);
    top.castShadow = top.receiveShadow = true;
    const cloth = new THREE.Mesh(new THREE.CylinderGeometry(1.56, 1.6, 0.1, 24), toon(COLORS.white));
    cloth.position.set(TABLE.x, 0.99, TABLE.z);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.25, 0.9, 10), toon(COLORS.trunk));
    leg.position.set(TABLE.x, 0.45, TABLE.z);
    leg.castShadow = true;
    g.add(top, cloth, leg);
    this.stack = [];
    for (let i = 0; i < PIES; i++) {
      const pie = makePie(toon(0xe0263f));
      const a = (i / PIES) * Math.PI * 2;
      pie.position.set(TABLE.x + Math.cos(a) * 0.8, 1.13, TABLE.z + Math.sin(a) * 0.65);
      g.add(pie);
      this.stack.push(pie);
    }

    // Picnic basket by the corner.
    const basket = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.8, 0.9), toon(0xd99a62));
    box.position.y = 0.4;
    box.castShadow = true;
    const lid = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.12, 0.96), toon(0xb87a48));
    lid.position.y = 0.84;
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.06, 6, 16, Math.PI), toon(0xb87a48));
    handle.position.y = 0.9;
    basket.add(box, lid, handle);
    basket.position.set(HX + 1.8, 0, -HZ + 0.6);
    basket.rotation.y = -0.4;
    g.add(basket);

    const rand = seeded(57);
    for (let i = 0; i < 18; i++) {
      const a = rand() * Math.PI * 2;
      const r = 13 + rand() * 8;
      const tr = makeTree(rand, 1.3 + rand() * 0.6);
      tr.position.set(Math.sin(a) * r * 1.2, 0, Math.cos(a) * r - 4);
      if (tr.position.z > 4) continue;
      g.add(tr);
    }
    for (let i = 0; i < 6; i++) {
      const b = makeBush(rand, 1 + rand() * 0.5);
      const side = i % 2 ? 1 : -1;
      b.position.set(side * (HX + 2.5 + rand() * 3), 0, -HZ + rand() * HZ * 2);
      g.add(b);
    }
    for (let i = 0; i < 40; i++) {
      const f = makeFlower(rand);
      const side = i % 2 ? 1 : -1;
      f.position.set(side * (HX + 0.8 + rand() * 5), 0, (rand() - 0.5) * (HZ * 2 + 6));
      g.add(f);
    }
  }

  frame() {
    const d = this.party.fitDistance(HX * 2 + 3, (HZ * 2 + 4.5) * 1.05);
    this.camera.position.set(0, d * 0.86, d * 0.52 + 0.4);
    this.camera.lookAt(0, 0, -0.5);
  }

  start() {
    this.phase = 'wait';
    this.phaseT = 0.4;
  }

  /** A new pie flies from the table to a random player. */
  spawnPie() {
    const pool = this.ents.filter((e) => e !== this.lastVictim);
    const holder = pool[Math.floor(Math.random() * pool.length)];
    const fromMesh = this.stack.pop();
    const from = fromMesh ? fromMesh.position.clone() : TABLE.clone();
    if (fromMesh) this.group.remove(fromMesh);
    const fuse = 7 + Math.random() * 6;
    this.pie = { holder, from, flight: 0, flightDur: 0.6, arc: 3, fuse, total: fuse, tickT: 0.3, tickN: 0, pulse: 0, giver: null, holdT: 0 };
    this.pies++;
    this.phase = 'live';
    this.pieMesh.visible = true;
    this.pieMesh.scale.setScalar(1);
    this.game.audio.play('whoosh');
  }

  pass(from, to) {
    const pie = this.pie;
    pie.from = this.pieMesh.position.clone();
    pie.flight = 0;
    pie.flightDur = 0.22;
    pie.arc = 1.1;
    pie.giver = from;
    pie.holder = to;
    pie.holdT = 0;
    to.ch.squash(0.75);
    from.ch.squash(1.2);
    this.game.audio.play('boing');
    this.party.puffs.burst(new THREE.Vector3((from.x + to.x) / 2, 1.2, (from.z + to.z) / 2), 0xffffff, { count: 6, size: 0.3, life: 0.35 });
  }

  canPassTo(e) {
    const pie = this.pie;
    return pie && this.phase === 'live' && pie.holdT >= MIN_HOLD && pie.holder !== e && e.wobble <= 0 && !(e === pie.giver && pie.holdT < NO_BACKS);
  }

  splat() {
    const pie = this.pie;
    const v = pie.holder;
    this.lastVictim = v;
    v.splats++;
    v.cream = 3.2;
    v.wobble = 1.5;
    v.shout = 1.4;
    v.ch.squash(0.55);
    this.game.audio.play('splat');
    this.game.audio.play('pop');
    const at = new THREE.Vector3(v.x, v.headY, v.z);
    this.party.puffs.burst(at, COLORS.icing, { count: 26, size: 0.5, life: 0.7, speed: 6 });
    this.party.confetti.burst(at, 0, { count: 30, speed: 7, colors: [COLORS.icing, COLORS.cream, 0xe0263f, 0xe8b06a], life: 0.9 });
    // The empty tin clatters onto the blanket.
    const tin = new THREE.Mesh(sharedGeo('pieTin', () => new THREE.CylinderGeometry(0.5, 0.4, 0.18, 22)), toon(0xc9c3d9));
    tin.position.set(v.x + 0.5, 0.1, v.z + 0.3);
    tin.rotation.set(Math.PI, 0, 0.3);
    tin.castShadow = true;
    this.group.add(tin);
    this.tins.push(tin);
    for (const e of this.ents) {
      if (e === v) continue;
      e.points++;
      e.ch.squash(1.3);
      this.party.confetti.burst(new THREE.Vector3(e.x, 1.6, e.z), 0, { count: 10, speed: 4, colors: [e.bot ? COLORS.white : e.p.color, COLORS.gold], life: 0.7 });
    }
    this.later(0.25, () => this.game.audio.play('coin'));
    this.pie = null;
    this.pieMesh.visible = false;
    this.holderRing.visible = false;
    this.phase = 'wait';
    this.phaseT = GAP;
    if (this.pies >= PIES) {
      this.phase = 'over';
      this.later(GAP, () => { this.done = true; });
    }
  }

  tick() {
    const pie = this.pie;
    pie.tickN++;
    pie.pulse = 1;
    const a = this.game.audio;
    if (a.ctx) a.tone(pie.tickN % 2 ? 1250 : 940, 0.05, { type: 'square', vol: 0.05 });
  }

  /** Grumble bots: chase with the pie, flee from it otherwise. */
  botBrain(e, dt) {
    e.think -= dt;
    const pie = this.pie;
    let dash = false;
    if (e.think <= 0) {
      e.think = 0.15 + Math.random() * 0.15;
      let wx = 0, wz = 0;
      if (pie && pie.holder === e) {
        let best = null, bd = 1e9;
        for (const o of this.ents) {
          if (o === e || (o === pie.giver && pie.holdT < NO_BACKS)) continue;
          const d = Math.hypot(o.x - e.x, o.z - e.z);
          if (d < bd) { bd = d; best = o; }
        }
        if (best) { wx = best.x - e.x; wz = best.z - e.z; dash = bd < 2.6 && Math.random() < 0.5; }
      } else if (pie) {
        const h = pie.holder;
        const dx = e.x - h.x, dz = e.z - h.z, d = Math.max(0.3, Math.hypot(dx, dz));
        wx = (dx / d) * (4 / d); wz = (dz / d) * (4 / d);
        dash = d < 1.8 && Math.random() < 0.3;
      }
      // Stay off the edges of the blanket, wander a bit.
      wx += (e.x / HX) ** 3 * -2.5 + (Math.random() - 0.5) * 0.6;
      wz += (e.z / HZ) ** 3 * -2.5 + (Math.random() - 0.5) * 0.6;
      const m = Math.hypot(wx, wz);
      e.wantX = m > 0.15 ? (wx / m) * 0.88 : 0;
      e.wantZ = m > 0.15 ? (wz / m) * 0.88 : 0;
    }
    return { x: e.wantX, y: -e.wantZ, aPressed: dash };
  }

  update(dt, playing) {
    this.time += dt;
    if (playing && this.phase === 'wait') {
      this.phaseT -= dt;
      if (this.phaseT <= 0) this.spawnPie();
    }
    const pie = this.pie;
    if (pie && playing) {
      pie.fuse -= dt;
      pie.holdT += dt;
      pie.tickT -= dt;
      if (pie.tickT <= 0) {
        this.tick();
        pie.tickT = THREE.MathUtils.clamp(0.08 + pie.fuse * 0.045, 0.09, 0.55);
      }
    }

    for (const e of this.ents) {
      e.dashCd -= dt;
      e.dash -= dt;
      e.wobble -= dt;
      e.cream -= dt;
      e.shout -= dt;
      const holding = this.pie && this.pie.holder === e;
      const active = playing && this.phase !== 'over' && e.wobble <= 0;
      const d = active ? (e.bot ? this.botBrain(e, dt) : this.input(e.p)) : { x: 0, y: 0, aPressed: false };
      const ix = d.x, iz = -d.y;
      if (Math.hypot(ix, iz) > 0.2) { const m = Math.hypot(ix, iz); e.dx = ix / m; e.dz = iz / m; }
      if (d.aPressed) {
        // A: hand the pie to someone close, otherwise a short dash.
        let passed = false;
        if (holding) {
          let best = null, bd = REACH;
          for (const o of this.ents) {
            if (!this.canPassTo(o)) continue;
            const dd = Math.hypot(o.x - e.x, o.z - e.z);
            if (dd < bd) { bd = dd; best = o; }
          }
          if (best) { this.pass(e, best); passed = true; }
        }
        if (!passed && e.dashCd <= 0) {
          e.dash = DASH_TIME;
          e.dashCd = DASH_CD;
          e.vx = e.dx * DASH_SPEED; e.vz = e.dz * DASH_SPEED;
          e.ch.squash(1.25);
          this.game.audio.play('dash');
          this.party.puffs.burst(new THREE.Vector3(e.x, 0.25, e.z), 0xffffff, { count: 4, size: 0.25, life: 0.3 });
        }
      }
      if (e.dash <= 0) {
        const sp = SPEED * (holding ? HOLDER_BOOST : 1);
        e.vx += (ix * sp - e.vx) * Math.min(1, dt * 12);
        e.vz += (iz * sp - e.vz) * Math.min(1, dt * 12);
      }
      e.x += e.vx * dt; e.z += e.vz * dt;
      e.x = THREE.MathUtils.clamp(e.x, -HX + PR, HX - PR);
      e.z = THREE.MathUtils.clamp(e.z, -HZ + PR, HZ - PR);
      if (Math.hypot(e.vx, e.vz) > 0.3) e.ch.face(e.vx, e.vz);
      const sp = Math.min(1, Math.hypot(e.vx, e.vz) / SPEED);
      // Creamed: wobble on the spot.
      const w = Math.max(0, e.wobble);
      e.ch.spin = w > 0 ? Math.sin(this.time * 9) * 0.6 * w : 0;
      e.ch.pivot.rotation.z = w > 0 ? Math.sin(this.time * 14) * 0.3 * Math.min(1, w) : 0;
      e.ch.group.position.set(e.x, 0, e.z);
      e.ch.update(dt, { moving: sp });
      e.creamFace.visible = e.cream > 0;
      if (e.cream > 0) e.creamFace.scale.setScalar((e.bot ? 0.9 : 1) * Math.min(1, e.cream * 2, (3.2 - e.cream) * 8 + 0.3));
    }

    // Bump apart; a bump hands the pie over.
    for (let i = 0; i < this.ents.length; i++) {
      for (let j = i + 1; j < this.ents.length; j++) {
        const a = this.ents[i], b = this.ents[j];
        const dx = b.x - a.x, dz = b.z - a.z, dd = Math.hypot(dx, dz);
        if (dd < TOUCH && this.pie && playing) {
          if (this.pie.holder === a && this.canPassTo(b)) this.pass(a, b);
          else if (this.pie.holder === b && this.canPassTo(a)) this.pass(b, a);
        }
        if (dd < PR * 2 && dd > 1e-4) {
          const push = (PR * 2 - dd) / 2;
          a.x -= (dx / dd) * push; a.z -= (dz / dd) * push;
          b.x += (dx / dd) * push; b.z += (dz / dd) * push;
        }
      }
    }

    this.updatePie(dt, playing);

    for (const e of this.ents) {
      const holding = this.pie && this.pie.holder === e;
      const text = e.shout > 0 ? t('potato.splat') : String(e.points);
      this.setLabel(e.tag, text, new THREE.Vector3(e.x, holding ? e.headY + 1.3 : e.headY + 0.75, e.z), e.shout > 0 ? '#ff3b5c' : e.css);
    }
    for (const tin of this.tins) tin.position.y = Math.max(0.1, tin.position.y - dt);
  }

  updatePie(dt, playing) {
    const pie = this.pie;
    if (!pie) return;
    const h = pie.holder;
    const target = new THREE.Vector3(h.x, h.headY + 0.35 + Math.sin(this.time * 8) * 0.05, h.z);
    if (pie.flight < 1) {
      if (playing) pie.flight = Math.min(1, pie.flight + dt / pie.flightDur);
      const k = pie.flight;
      this.pieMesh.position.lerpVectors(pie.from, target, k);
      this.pieMesh.position.y += Math.sin(k * Math.PI) * pie.arc;
      this.pieMesh.rotation.y += dt * 10;
      if (pie.flight >= 1 && pie.flightDur > 0.5) {
        h.ch.squash(0.7);
        this.game.audio.play('land');
        this.party.puffs.burst(target, 0xffffff, { count: 8, size: 0.3, life: 0.4 });
      }
    } else {
      this.pieMesh.position.copy(target);
      this.pieMesh.rotation.y += dt * 1.5;
    }
    // Pulses on every tick and shivers as the fuse runs out.
    pie.pulse = Math.max(0, pie.pulse - dt * 6);
    const urgency = 1 - THREE.MathUtils.clamp(pie.fuse / 4, 0, 1);
    this.pieMesh.scale.setScalar(1 + pie.pulse * (0.12 + urgency * 0.18));
    this.pieMesh.rotation.z = Math.sin(this.time * 40) * 0.08 * urgency;
    this.cherryMat.emissive.setRGB(0.6 * pie.pulse * (0.4 + urgency), 0.05 * pie.pulse, 0);
    this.holderRing.visible = true;
    this.holderRing.position.x = h.x;
    this.holderRing.position.z = h.z;
    this.holderRing.scale.setScalar(1 + pie.pulse * 0.25);
    if (playing && pie.fuse <= 0) this.splat();
  }

  hud() {
    const n = Math.max(1, Math.min(PIES, this.pies));
    const status = this.phase === 'live' ? `<div class="pill"><b>${t('potato.pass')}</b></div>` : '';
    return `<div class="pill">${t('potato.pie', { n, total: PIES })}</div>${status}`;
  }

  score(p) {
    return this.ents.find((x) => x.p === p).points;
  }

  detail(p) {
    const e = this.ents.find((x) => x.p === p);
    return t('potato.detail', { n: e.points, s: e.splats });
  }
}
