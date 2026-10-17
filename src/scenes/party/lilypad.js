import * as THREE from 'three';
import { Round, clock } from './common.js';
import { COLORS, toon, sharedGeo } from '../../core/palette.js';
import { makeTree, makeFlower, makeRock, makeBush, seeded } from '../../core/world.js';
import { t, addStrings } from '../../core/i18n.js';

addStrings({
  en: {
    'lilypad.title': 'Lily Pad Hop',
    'lilypad.hint': 'Tap the stick to hop one step at a time (A hops forward too). Ride the logs and lily pads across the pond. Pale pads sink for a moment! Every crossing scores a point.',
    'lilypad.go': 'Hop across!', 'lilypad.splash': 'splash!', 'lilypad.n': '{n} crossings',
  },
  no: {
    'lilypad.title': 'Nøkkerosehopp',
    'lilypad.hint': 'Trykk på spaken for å hoppe ett steg om gangen (A hopper også fremover). Hopp på stokkene og nøkkerosebladene over dammen. Lyse blader synker en liten stund! Hver tur over gir ett poeng.',
    'lilypad.go': 'Hopp over!', 'lilypad.splash': 'plask!', 'lilypad.n': '{n} turer over',
  },
});

// Lily Pad Hop: frogger-style grid hops across a pond of drifting logs and lily pads.
const CELL = 1.3;
const COLS = 6; // columns run from -COLS to +COLS
const HALF = COLS * CELL;
const ROWS = 9; // row 0 = near bank, row ROWS-1 = far bank
const EXTRA = 4.5; // drifting things wrap this far past the screen edge
const SPAN = (HALF + EXTRA) * 2;
const TIME = 45;
const HOP = 0.22;
const BANK_Y = 0.28;
const PAD_R = 0.62;
const LOG_R = 0.32;

// Water lanes from near to far. Pads: pitch between pads. Logs: length and gap (in cells).
const LANES = [
  { type: 'pad', speed: 0.55, pitch: 2.1, sinkers: 0.34 },
  { type: 'log', speed: -1.25, len: 3, gap: 2.2 },
  { type: 'log', speed: 1.7, len: 2.2, gap: 2.6 },
  { type: 'pad', speed: 0, pitch: 1.6, sinkers: 0.4 },
  { type: 'log', speed: -1.55, len: 3.4, gap: 2.8 },
  { type: 'pad', speed: -0.7, pitch: 2, sinkers: 0.34 },
  { type: 'log', speed: 1.1, len: 2.6, gap: 2.3 },
];

const rowZ = (row) => ((ROWS - 1) / 2 - row) * CELL;
const wrap = (x) => {
  const lim = HALF + EXTRA;
  while (x > lim) x -= SPAN;
  while (x < -lim) x += SPAN;
  return x;
};

function makeLog(len) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(sharedGeo(`lpLog${len}`, () => new THREE.CylinderGeometry(LOG_R, LOG_R, len, 14)), toon(0xa0704a));
  body.rotation.z = Math.PI / 2;
  body.castShadow = true;
  g.add(body);
  for (const s of [-1, 1]) {
    const cap = new THREE.Mesh(sharedGeo('lpLogCap', () => new THREE.CylinderGeometry(LOG_R * 0.92, LOG_R * 0.92, 0.04, 14)), toon(0xe8c690));
    cap.rotation.z = Math.PI / 2;
    cap.position.x = s * (len / 2 + 0.01);
    const ring = new THREE.Mesh(sharedGeo('lpLogRing', () => new THREE.TorusGeometry(LOG_R * 0.5, 0.025, 6, 16)), toon(0xb87a48));
    ring.rotation.y = Math.PI / 2;
    ring.position.x = s * (len / 2 + 0.035);
    g.add(cap, ring);
  }
  // Bark stripes and a tuft of moss.
  for (let i = 1; i < len / 0.8; i++) {
    const band = new THREE.Mesh(sharedGeo('lpBark', () => new THREE.TorusGeometry(LOG_R + 0.005, 0.03, 5, 16)), toon(0x7e5535));
    band.rotation.y = Math.PI / 2;
    band.position.x = -len / 2 + i * 0.8;
    g.add(band);
  }
  const moss = new THREE.Mesh(sharedGeo('lpMoss', () => new THREE.SphereGeometry(0.16, 8, 6)), toon(COLORS.leafLight));
  moss.scale.set(1.6, 0.5, 1);
  moss.position.set(len * 0.25, LOG_R - 0.02, -0.1);
  g.add(moss);
  return g;
}

function makePad(sinker, flower) {
  const g = new THREE.Group();
  const leaf = new THREE.Mesh(sharedGeo('lpPad', () => new THREE.CylinderGeometry(PAD_R, PAD_R, 0.07, 26, 1, false, 0.35, Math.PI * 2 - 0.7)), toon(sinker ? 0xc7ec8c : 0x46b85a));
  leaf.receiveShadow = true;
  g.add(leaf);
  const vein = new THREE.Mesh(sharedGeo('lpVein', () => new THREE.BoxGeometry(0.04, 0.02, PAD_R * 1.5)), toon(sinker ? 0xa9d46a : 0x3a9e4c));
  vein.position.y = 0.045;
  vein.rotation.y = Math.PI / 2;
  g.add(vein);
  if (flower) {
    const f = new THREE.Group();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const petal = new THREE.Mesh(sharedGeo('lpPetal', () => new THREE.ConeGeometry(0.07, 0.22, 6)), toon(0xff9fd0));
      petal.position.set(Math.cos(a) * 0.07, 0.1, Math.sin(a) * 0.07);
      petal.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
      f.add(petal);
    }
    const mid = new THREE.Mesh(sharedGeo('lpMid', () => new THREE.SphereGeometry(0.05, 8, 6)), toon(COLORS.candyYellow));
    mid.position.y = 0.12;
    f.add(mid);
    f.position.set(-0.3, 0.02, 0.15);
    g.add(f);
  }
  g.rotation.y = Math.random() * Math.PI * 2;
  return g;
}

export class LilyPadRound extends Round {
  static key = 'lilypad';

  constructor(party) {
    super(party);
    this.t = 0;
    this.pond = 0; // drift clock, runs even before play so the pond looks alive
    this.build();
    const n = this.players.length;
    this.ents = this.players.map((p, i) => {
      const ch = this.bean(p);
      const col = n === 1 ? 0 : Math.round((i - (n - 1) / 2) * Math.min(2, (COLS * 2) / (n - 1)));
      ch.yaw = ch.targetYaw = Math.PI;
      const e = { p, ch, home: col * CELL, x: col * CELL, row: 0, ride: null, hop: null, queued: null, splash: 0, cheer: 0, points: 0, dunks: 0, tag: this.label('label') };
      return e;
    });
  }

  get title() { return t('lilypad.title'); }
  get hint() { return t('lilypad.hint'); }

  build() {
    const g = this.group;
    const nearEdge = rowZ(0) - CELL / 2;
    const farEdge = rowZ(ROWS - 1) + CELL / 2;
    // Water, with every lane a slightly different blue so the rows read clearly.
    const water = new THREE.Mesh(new THREE.PlaneGeometry(90, nearEdge - farEdge + 2), toon(COLORS.waterDeep));
    water.rotation.x = -Math.PI / 2;
    water.position.set(0, -0.12, (nearEdge + farEdge) / 2);
    g.add(water);
    for (let r = 1; r < ROWS - 1; r++) {
      const lane = new THREE.Mesh(new THREE.PlaneGeometry(90, CELL), toon(r % 2 ? COLORS.water : 0x62cdf3));
      lane.rotation.x = -Math.PI / 2;
      lane.position.set(0, -0.06, rowZ(r));
      lane.receiveShadow = true;
      g.add(lane);
    }
    // Banks: grassy blocks with a sandy lip.
    const bank = (z0, z1) => {
      const depth = Math.abs(z1 - z0);
      const top = new THREE.Mesh(new THREE.BoxGeometry(90, BANK_Y + 0.5, depth), toon(COLORS.grass));
      top.position.set(0, BANK_Y / 2 - 0.25 - 0.001, (z0 + z1) / 2);
      top.receiveShadow = true;
      g.add(top);
      const lip = new THREE.Mesh(new THREE.BoxGeometry(90, 0.3, 0.5), toon(COLORS.sand));
      lip.position.set(0, -0.02, z0 + Math.sign(z1 - z0) * -0.05);
      g.add(lip);
    };
    bank(nearEdge, nearEdge + 12);
    bank(farEdge, farEdge - 26);
    // Start line and finish bunting.
    const start = new THREE.Mesh(new THREE.PlaneGeometry(HALF * 2 + CELL, 0.12), toon(COLORS.white));
    start.rotation.x = -Math.PI / 2;
    start.position.set(0, BANK_Y + 0.01, rowZ(0) + CELL * 0.45);
    g.add(start);
    const flagColors = [0xff5d73, 0xffc93c, 0x3ddc97, 0x4cc9f0, 0x9b5de5, 0xff8c42];
    const fz = rowZ(ROWS - 1) - CELL * 0.6;
    for (const s of [-1, 1]) {
      const pole = new THREE.Mesh(sharedGeo('lpPole', () => new THREE.CylinderGeometry(0.07, 0.07, 2.6, 8)), toon(COLORS.white));
      pole.position.set(s * (HALF + 0.9), BANK_Y + 1.3, fz);
      pole.castShadow = true;
      g.add(pole);
    }
    const nFlags = 22;
    for (let i = 0; i < nFlags; i++) {
      const u = (i + 0.5) / nFlags;
      const x = -(HALF + 0.9) + u * (HALF + 0.9) * 2;
      const flag = new THREE.Mesh(sharedGeo('lpFlag', () => new THREE.ConeGeometry(0.22, 0.45, 3)), toon(flagColors[i % flagColors.length]));
      flag.rotation.x = Math.PI;
      flag.position.set(x, BANK_Y + 2.3 - Math.sin(u * Math.PI) * 0.5, fz);
      g.add(flag);
    }
    // Pond plants off to the sides and scenery on the banks.
    const rand = seeded(23);
    for (let i = 0; i < 26; i++) {
      const side = i % 2 ? 1 : -1;
      const reed = new THREE.Group();
      const stalk = new THREE.Mesh(sharedGeo('lpReed', () => new THREE.CylinderGeometry(0.03, 0.04, 1.4, 5)), toon(COLORS.grassDark));
      stalk.position.y = 0.7;
      const head = new THREE.Mesh(sharedGeo('lpCat', () => new THREE.CapsuleGeometry(0.07, 0.25, 4, 8)), toon(0x8a5e3c));
      head.position.y = 1.35;
      reed.add(stalk, head);
      reed.rotation.z = (rand() - 0.5) * 0.3;
      reed.position.set(side * (HALF + 1.6 + rand() * 2.5), 0, farEdge + rand() * (nearEdge - farEdge));
      g.add(reed);
    }
    for (let i = 0; i < 14; i++) {
      const tr = makeTree(rand, 1.2 + rand() * 0.6);
      tr.position.set(-20 + i * 3.1 + rand(), BANK_Y, farEdge - 3 - rand() * 6);
      g.add(tr);
    }
    for (let i = 0; i < 8; i++) {
      const b = makeBush(rand, 0.8 + rand() * 0.4);
      b.position.set((rand() - 0.5) * 30, BANK_Y, farEdge - 1.6 - rand());
      if (Math.abs(b.position.x) < HALF + 1.5) continue;
      g.add(b);
    }
    for (let i = 0; i < 30; i++) {
      const f = makeFlower(rand);
      f.position.set((rand() - 0.5) * 34, BANK_Y, nearEdge + 0.8 + rand() * 4);
      if (Math.abs(f.position.x) < HALF + 0.8 && f.position.z < nearEdge + 2) continue;
      g.add(f);
    }
    for (let i = 0; i < 6; i++) {
      const rk = makeRock(rand, 0.4 + rand() * 0.3);
      const side = i % 2 ? 1 : -1;
      rk.position.set(side * (HALF + 1.2 + rand() * 3), 0, (rand() - 0.5) * 6);
      g.add(rk);
    }

    // Drifting lanes.
    this.lanes = LANES.map((def, k) => {
      const row = k + 1;
      const lane = { ...def, row, items: [] };
      if (def.type === 'log') {
        const pitch = (def.len + def.gap) * CELL;
        const count = Math.max(2, Math.round(SPAN / pitch));
        const step = SPAN / count;
        const phase = rand() * step;
        for (let i = 0; i < count; i++) {
          const len = def.len * CELL * (0.9 + rand() * 0.2);
          const mesh = makeLog(Math.round(len * 10) / 10);
          const item = { x: wrap(-HALF - EXTRA + phase + i * step), len: Math.round(len * 10) / 10, mesh, bob: rand() * 6 };
          mesh.position.set(item.x, 0.02, rowZ(row));
          g.add(mesh);
          lane.items.push(item);
        }
      } else {
        const pitch = def.pitch * CELL;
        const count = Math.round(SPAN / pitch);
        const step = SPAN / count;
        const phase = def.speed ? rand() * step : 0;
        for (let i = 0; i < count; i++) {
          const sinker = rand() < def.sinkers;
          const mesh = makePad(sinker, !sinker && rand() < 0.3);
          const item = { x: wrap(-HALF - EXTRA + phase + i * step), mesh, bob: rand() * 6, sinker, period: 4.6 + rand() * 1.8, phase: rand() * 6, sunk: false, warn: false, depth: 0 };
          mesh.position.set(item.x, 0, rowZ(row));
          g.add(mesh);
          lane.items.push(item);
        }
      }
      return lane;
    });
    // A few lazy ripples on the water.
    this.ripples = [];
    for (let i = 0; i < 8; i++) {
      const rip = new THREE.Mesh(sharedGeo('lpRipple', () => new THREE.RingGeometry(0.85, 1, 28)), toon(0xbfeeff, { transparent: true, opacity: 0.6 }));
      rip.rotation.x = -Math.PI / 2;
      rip.position.set((rand() - 0.5) * HALF * 2.4, -0.03, rowZ(1 + Math.floor(rand() * 7)));
      rip.userData.phase = rand();
      g.add(rip);
      this.ripples.push(rip);
    }
    this.splashes = [];
  }

  frame() {
    const d = this.party.fitDistance(HALF * 2 + 2.5, ROWS * CELL * 0.95 + 2.5);
    this.camera.position.set(0, d * 0.88, d * 0.5 + 0.6);
    this.camera.lookAt(0, 0, 0.4);
  }

  /** Sink cycle of a pale pad at a given pond time: up, wobbling warning, then under. */
  sinkState(item, time) {
    if (!item.sinker) return 0;
    const u = (time + item.phase) % item.period;
    const p = item.period;
    if (u < p - 2.1) return 0;
    if (u < p - 1.25) return 1; // warning
    return 2; // under
  }

  /**
   * What would hold a frog at (row, x), `ahead` seconds from now.
   * Returns { item, offset } for a lane item, { bank: true } on a bank, or null for water.
   */
  supportAt(row, x, ahead = 0) {
    if (row <= 0 || row >= ROWS - 1) return { bank: true };
    const lane = this.lanes[row - 1];
    for (const item of lane.items) {
      const ix = wrap(item.x + lane.speed * ahead);
      if (lane.type === 'log') {
        const h = item.len / 2;
        if (x > ix - h - 0.15 && x < ix + h + 0.15) return { item, offset: THREE.MathUtils.clamp(x - ix, -h + 0.25, h - 0.25) };
      } else if (Math.abs(x - ix) < PAD_R + 0.12 && this.sinkState(item, this.pond + ahead) < 2) {
        return { item, offset: 0 };
      }
    }
    return null;
  }

  start() {}

  hopTo(e, row, x) {
    e.hop = { t: 0, fromX: e.x, fromRow: e.row, toX: x, toRow: row, fromY: this.standY(e) };
    e.ride = null;
    e.ch.squash(1.25);
    e.ch.face(x - e.x, rowZ(row) - rowZ(e.row));
    this.game.audio.play('jump');
  }

  standY(e) {
    if (e.row <= 0 || e.row >= ROWS - 1) return BANK_Y;
    if (!e.ride) return 0;
    return this.lanes[e.row - 1].type === 'log' ? LOG_R + 0.04 : 0.04;
  }

  land(e) {
    const hop = e.hop;
    e.hop = null;
    e.row = hop.toRow;
    e.x = hop.toX;
    const sup = this.supportAt(e.row, e.x);
    if (!sup) { this.dunk(e); return; }
    e.ch.squash(0.75);
    if (sup.item) {
      e.ride = sup;
      e.x = sup.item.x + sup.offset;
      sup.item.dip = 1;
      this.game.audio.play('land');
    } else {
      e.ride = null;
      this.game.audio.play('land');
    }
    if (e.row === ROWS - 1) this.cross(e);
  }

  dunk(e) {
    e.splash = 1;
    e.ride = null;
    e.dunks++;
    this.game.audio.play('splat');
    this.later(0.15, () => this.game.audio.play('bubble'));
    const at = new THREE.Vector3(e.x, 0.1, rowZ(e.row));
    this.party.puffs.burst(at, 0xd8f6ff, { count: 16, size: 0.35, life: 0.6, speed: 4 });
    this.party.confetti.burst(at, 0, { count: 12, speed: 4, colors: [0xffffff, 0x8fd8ff], life: 0.6, size: 0.12 });
    const ring = new THREE.Mesh(sharedGeo('lpSplashRing', () => new THREE.RingGeometry(0.4, 0.55, 24)), toon(COLORS.white));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(e.x, 0.0, rowZ(e.row));
    this.group.add(ring);
    this.splashes.push({ ring, t: 0 });
  }

  cross(e) {
    e.points++;
    e.cheer = 0.8;
    this.game.audio.play('coin');
    this.party.confetti.burst(new THREE.Vector3(e.x, 1.8, rowZ(e.row)), 0, { count: 26, speed: 6, colors: [e.p.color, COLORS.gold, COLORS.white] });
  }

  respawn(e) {
    const from = new THREE.Vector3(e.x, 0.6, rowZ(e.row));
    e.row = 0;
    e.x = e.home;
    e.ride = null;
    e.queued = null;
    e.ch.yaw = e.ch.targetYaw = Math.PI;
    e.ch.squash(0.6);
    this.party.puffs.burst(new THREE.Vector3(e.x, 0.8, rowZ(0)), 0xffffff, { count: 10, size: 0.35, life: 0.5 });
    return from;
  }

  readInput(e) {
    const d = this.input(e.p);
    if (d.stepY > 0 || d.aPressed) return [0, 1];
    if (d.stepY < 0) return [0, -1];
    if (d.stepX) return [d.stepX, 0];
    return null;
  }

  tryHop(e, [dx, dy]) {
    const row = THREE.MathUtils.clamp(e.row + dy, 0, ROWS - 1);
    if (row === e.row && !dx) return;
    let x = e.x + dx * CELL;
    if (row === 0 || row === ROWS - 1) x = Math.round(x / CELL) * CELL; // banks snap to the grid
    x = THREE.MathUtils.clamp(x, -HALF, HALF);
    if (row === e.row && Math.abs(x - e.x) < 0.01) return;
    this.hopTo(e, row, x);
  }

  update(dt, playing) {
    this.time += dt;
    this.pond += dt;
    if (playing) this.t += dt;
    const active = playing && this.t < TIME;

    // Drift lanes and animate pads.
    for (const lane of this.lanes) {
      for (const item of lane.items) {
        item.x = wrap(item.x + lane.speed * dt);
        item.dip = Math.max(0, (item.dip || 0) - dt * 4);
        const z = rowZ(lane.row);
        if (lane.type === 'log') {
          item.mesh.position.set(item.x, 0.02 + Math.sin(this.time * 2 + item.bob) * 0.03 - item.dip * 0.06, z);
        } else {
          const s = this.sinkState(item, this.pond);
          item.sunk = s === 2;
          const target = s === 2 ? -0.45 : 0;
          item.depth += (target - item.depth) * Math.min(1, dt * 8);
          const wob = s === 1 ? Math.sin(this.time * 30) * 0.05 : 0;
          item.mesh.position.set(item.x, item.depth + wob - item.dip * 0.05 + Math.sin(this.time * 1.5 + item.bob) * 0.015, z);
          item.mesh.rotation.z = s === 1 ? Math.sin(this.time * 24) * 0.08 : 0;
          if (s === 1 && Math.random() < dt * 8) this.party.puffs.burst(new THREE.Vector3(item.x + (Math.random() - 0.5), 0.05, z + (Math.random() - 0.5) * 0.6), 0xd8f6ff, { count: 1, size: 0.15, life: 0.4, speed: 0.5, up: 1 });
        }
      }
    }

    for (const e of this.ents) {
      e.cheer -= dt;
      if (e.splash > 0) {
        // Sinking, then back to the near bank.
        e.splash -= dt;
        e.ch.group.position.set(e.x, -1.2 * (1 - Math.max(0, e.splash)), rowZ(e.row));
        e.ch.spin += dt * 10;
        if (e.splash <= 0) { e.ch.spin = 0; this.respawn(e); this.game.audio.play('boing'); }
        e.ch.update(dt, {});
        continue;
      }
      if (e.row === ROWS - 1 && !e.hop && e.cheer <= 0 && e.points > 0) {
        // Made it: puff back to the start for another go.
        this.respawn(e);
        this.game.audio.play('whoosh');
      }
      if (e.hop) {
        e.hop.t += dt / HOP;
        if (active && !e.queued && e.hop.t > 0.45) e.queued = this.readInput(e);
        if (e.hop.t >= 1) this.land(e);
      } else if (active && e.cheer <= 0) {
        const dir = e.queued || this.readInput(e);
        e.queued = null;
        if (dir) this.tryHop(e, dir);
      }
      if (e.splash > 0) continue;
      if (e.hop) {
        const k = Math.min(1, e.hop.t);
        const toSup = this.supportAt(e.hop.toRow, e.hop.toX);
        const toY = e.hop.toRow === 0 || e.hop.toRow === ROWS - 1 ? BANK_Y : toSup?.item && this.lanes[e.hop.toRow - 1].type === 'log' ? LOG_R + 0.04 : 0.04;
        e.x = THREE.MathUtils.lerp(e.hop.fromX, e.hop.toX, k);
        const z = THREE.MathUtils.lerp(rowZ(e.hop.fromRow), rowZ(e.hop.toRow), k);
        const y = THREE.MathUtils.lerp(e.hop.fromY, toY, k) + Math.sin(k * Math.PI) * 0.7;
        e.ch.group.position.set(e.x, y, z);
        e.ch.update(dt, { grounded: false, vy: (0.5 - k) * 10 });
      } else {
        if (e.ride) {
          e.x = e.ride.item.x + e.ride.offset;
          const lane = this.lanes[e.row - 1];
          // Drifted off screen, or the pad went under: splash.
          if (Math.abs(e.x) > HALF + 0.4 || (lane.type === 'pad' && e.ride.item.sunk)) { this.dunk(e); continue; }
        }
        let y = this.standY(e);
        if (e.ride) y += e.ride.item.mesh.position.y - (this.lanes[e.row - 1].type === 'log' ? 0.02 : 0);
        if (e.cheer > 0) y += Math.abs(Math.sin(e.cheer * 9)) * 0.5;
        e.ch.group.position.set(e.x, y, rowZ(e.row));
        e.ch.spin = e.cheer > 0 ? (0.8 - e.cheer) * 8 : 0;
        e.ch.update(dt, {});
      }
    }

    for (const s of this.splashes) {
      s.t += dt;
      s.ring.scale.setScalar(1 + s.t * 3);
      s.ring.position.y = -0.02;
      if (s.t > 0.6) { this.group.remove(s.ring); s.gone = true; }
    }
    this.splashes = this.splashes.filter((s) => !s.gone);
    for (const r of this.ripples) {
      const u = (this.time * 0.35 + r.userData.phase) % 1;
      r.scale.setScalar(0.3 + u * 1.2);
      r.visible = u < 0.85;
    }

    for (const e of this.ents) {
      const text = e.splash > 0 ? t('lilypad.splash') : String(e.points);
      const pos = e.ch.group.position.clone();
      pos.y = Math.max(pos.y, 0) + 1.75;
      this.setLabel(e.tag, text, pos, e.splash > 0 ? '#1a9fd8' : e.p.css);
    }

    if (playing && this.t >= TIME && !this.done && this.ents.every((e) => !e.hop)) this.done = true;
  }

  hud() {
    return `<div class="pill"><b>${t('lilypad.go')}</b></div>${clock(TIME - this.t)}`;
  }

  score(p) {
    return this.ents.find((x) => x.p === p).points;
  }

  detail(p) {
    return t('lilypad.n', { n: this.score(p) });
  }
}
