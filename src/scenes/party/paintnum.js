import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Round, clock } from './common.js';
import { COLORS, toon, sharedGeo } from '../../core/palette.js';
import { makeTree, makeFlower, makeCloud, seeded } from '../../core/world.js';
import { glyphMaterial } from '../../core/edu.js';
import { t, addStrings } from '../../core/i18n.js';

addStrings({
  en: {
    'paintnum.title': 'Paint by Numbers',
    'paintnum.hint': 'Walk into a paint pot to fill your brush. Then stand on squares with the same number and hold A to paint. Finish the picture together for a bonus!',
    'paintnum.left': 'Painted {n} / {total}', 'paintnum.done': 'Picture done!', 'paintnum.bonus': 'Bonus for everyone!',
    'paintnum.n': '{n} squares',
    'paintnum.heart': 'a heart', 'paintnum.fish': 'a fish', 'paintnum.house': 'a house', 'paintnum.flower': 'a flower', 'paintnum.mushroom': 'a mushroom', 'paintnum.boat': 'a boat',
    'paintnum.what': 'It was {what}!',
  },
  no: {
    'paintnum.title': 'Mal etter tall',
    'paintnum.hint': 'Gå inn i en malingsbøtte for å fylle penselen. Stå på ruter med samme tall og hold inne A for å male. Gjør ferdig bildet sammen for bonus!',
    'paintnum.left': 'Malt {n} / {total}', 'paintnum.done': 'Bildet er ferdig!', 'paintnum.bonus': 'Bonus til alle!',
    'paintnum.n': '{n} ruter',
    'paintnum.heart': 'et hjerte', 'paintnum.fish': 'en fisk', 'paintnum.house': 'et hus', 'paintnum.flower': 'en blomst', 'paintnum.mushroom': 'en sopp', 'paintnum.boat': 'en båt',
    'paintnum.what': 'Det ble {what}!',
  },
});

// Paint by Numbers: calm co-op. Load a color from a pot, paint the squares with its number.
const GW = 10;
const GH = 8;
const CELL = 1.15;
const TIME = 50;
const SPEED = 5;
const PR = 0.42;
const BONUS = 10;
const POT_R = 0.95;
const HALF_W = (GW * CELL) / 2;
const HALF_D = (GH * CELL) / 2;
const POT_X = HALF_W + 1.5;
const BOUND_X = POT_X + 0.6;
const BOUND_Z0 = -HALF_D - 0.5;
const BOUND_Z1 = HALF_D + 1.9;

// Each design: palette (number 1..n) and 8 rows of 10; '.' = blank canvas.
const DESIGNS = [
  { key: 'heart', colors: [0xff3b5c, 0xffb3c6], rows: [
    '.111..111.',
    '1221111111',
    '1211111111',
    '1111111111',
    '.11111111.',
    '..111111..',
    '...1111...',
    '....11....'] },
  { key: 'fish', colors: [0xff8c42, 0xffd23f, 0x2b2340, 0x4cc9f0], rows: [
    '........4.',
    '.......4..',
    '...222....',
    '2.1111111.',
    '221111131.',
    '221111111.',
    '2.1111111.',
    '...222....'] },
  { key: 'house', colors: [0xff5d73, 0xffd23f, 0x4cc9f0, 0xa0704a, 0x58b947], rows: [
    '....11....',
    '...1111...',
    '..111111..',
    '.11111111.',
    '..233222..',
    '..233242..',
    '..222242..',
    '5555555555'] },
  { key: 'flower', colors: [0xff7eb6, 0xffd23f, 0x3fae5a], rows: [
    '...1111...',
    '..112211..',
    '..122221..',
    '..112211..',
    '...1111...',
    '....33.33.',
    '.33.3333..',
    '....33....'] },
  { key: 'mushroom', colors: [0xff3b5c, 0xffffff, 0xf7e1a6, 0x58b947], rows: [
    '...1111...',
    '..112111..',
    '.11111211.',
    '.12111111.',
    '...3333...',
    '...3333...',
    '...3333...',
    '4444444444'] },
  { key: 'boat', colors: [0xffffff, 0xff5d73, 0x4cc9f0, 0xa0704a], rows: [
    '....4.....',
    '....41....',
    '....411...',
    '....4111..',
    '....41111.',
    '.22222222.',
    '..222222..',
    '3333333333'] },
];

const css = (hex) => `#${hex.toString(16).padStart(6, '0')}`;

export class PaintNumRound extends Round {
  static key = 'paintnum';

  constructor(party) {
    super(party);
    this.design = DESIGNS[Math.floor(Math.random() * DESIGNS.length)];
    this.t = 0;
    this.finished = false;
    this.build();
    this.ents = this.players.map((p, i) => {
      const ch = this.bean(p);
      const n = this.players.length;
      const x = (i - (n - 1) / 2) * Math.min(1.6, 10 / Math.max(1, n));
      ch.yaw = ch.targetYaw = Math.PI;
      const blob = new THREE.Mesh(sharedGeo('pn-badge', () => new THREE.PlaneGeometry(0.7, 0.7)), glyphMaterial('?'));
      blob.visible = false;
      this.group.add(blob);
      return { p, ch, x, z: HALF_D + 1.2, vx: 0, vz: 0, color: 0, painted: 0, bonus: 0, blob, nope: 0 };
    });
  }

  get title() { return t('paintnum.title'); }
  get hint() { return t('paintnum.hint'); }

  build() {
    const g = this.group;
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(120, 80), toon(COLORS.grass));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.02;
    ground.receiveShadow = true;
    g.add(ground);
    // Wooden easel-floor under the canvas.
    const deck = new THREE.Mesh(new RoundedBoxGeometry(BOUND_X * 2 + 1.2, 0.3, BOUND_Z1 - BOUND_Z0 + 1.2, 3, 0.12), toon(0xe9c28f));
    deck.position.set(0, -0.14, (BOUND_Z0 + BOUND_Z1) / 2);
    deck.receiveShadow = true;
    g.add(deck);
    const frame = new THREE.Mesh(new RoundedBoxGeometry(GW * CELL + 0.6, 0.2, GH * CELL + 0.6, 2, 0.08), toon(0xa0704a));
    frame.position.y = 0.02;
    frame.receiveShadow = true;
    g.add(frame);

    // Cells: a cream tile with the number drawn in its own color.
    this.cells = [];
    const tileGeo = sharedGeo('pn-tile', () => new RoundedBoxGeometry(CELL * 0.92, 0.12, CELL * 0.92, 2, 0.04));
    const numGeo = sharedGeo('pn-num', () => new THREE.PlaneGeometry(CELL * 0.8, CELL * 0.8));
    this.design.rows.forEach((row, r) => {
      [...row].forEach((ch, c) => {
        const num = ch === '.' ? 0 : Number(ch);
        const x = -HALF_W + CELL / 2 + c * CELL, z = -HALF_D + CELL / 2 + r * CELL;
        const tile = new THREE.Mesh(tileGeo, toon(num ? 0xfff7e6 : 0xecd7ae));
        tile.position.set(x, 0.17, z);
        tile.receiveShadow = true;
        g.add(tile);
        let label = null;
        if (num) {
          const col = new THREE.Color(this.design.colors[num - 1]);
          const dark = col.r * 0.3 + col.g * 0.59 + col.b * 0.11 < 0.3;
          label = new THREE.Mesh(numGeo, glyphMaterial(String(num), { fg: css(this.design.colors[num - 1]), stroke: dark ? '#ffffff' : '#2b2340' }));
          label.rotation.x = -Math.PI / 2;
          label.position.set(x, 0.24, z);
          g.add(label);
        }
        this.cells.push({ r, c, x, z, num, tile, label, painted: !num, pop: 0 });
      });
    });
    this.toPaint = this.cells.filter((c) => c.num).length;

    // Paint pots around the sides, one per number.
    this.pots = [];
    const n = this.design.colors.length;
    const left = Math.ceil(n / 2);
    this.design.colors.forEach((color, i) => {
      const side = i < left ? -1 : 1;
      const k = i < left ? i : i - left;
      const count = i < left ? left : n - left;
      const z = count === 1 ? 0 : -HALF_D + 1.2 + (k / (count - 1)) * (GH * CELL - 2.4);
      const pot = new THREE.Group();
      const bucket = new THREE.Mesh(sharedGeo('pn-bucket', () => new THREE.CylinderGeometry(0.62, 0.5, 0.75, 20)), toon(0xe8e4f2));
      bucket.position.y = 0.375;
      bucket.castShadow = true;
      const rim = new THREE.Mesh(sharedGeo('pn-rim', () => new THREE.TorusGeometry(0.62, 0.07, 8, 24)), toon(0xbdb8cf));
      rim.rotation.x = Math.PI / 2;
      rim.position.y = 0.75;
      const paint = new THREE.Mesh(sharedGeo('pn-paint', () => new THREE.CylinderGeometry(0.57, 0.57, 0.05, 20)), toon(color));
      paint.position.y = 0.72;
      const drip = new THREE.Mesh(sharedGeo('pn-drip', () => new THREE.CapsuleGeometry(0.08, 0.25, 4, 8)), toon(color));
      drip.position.set(side * -0.45, 0.55, 0.38);
      const band = new THREE.Mesh(sharedGeo('pn-band', () => new THREE.CylinderGeometry(0.6, 0.57, 0.18, 20)), toon(color));
      band.position.y = 0.3;
      const sign = new THREE.Mesh(sharedGeo('pn-sign', () => new THREE.PlaneGeometry(1.1, 1.1)), glyphMaterial(String(i + 1), { disc: css(color) }));
      sign.position.y = 1.55;
      sign.rotation.x = -0.6;
      pot.add(bucket, rim, paint, drip, band, sign);
      pot.position.set(side * POT_X, 0, z);
      g.add(pot);
      this.pots.push({ num: i + 1, color, x: side * POT_X, z, mesh: pot, sign });
    });

    const rand = seeded(23);
    for (let i = 0; i < 18; i++) {
      const a = rand() * Math.PI * 2;
      const r = 14 + rand() * 8;
      const tr = makeTree(rand, 1.3 + rand() * 0.6);
      tr.position.set(Math.sin(a) * r * 1.2, 0, Math.cos(a) * r * 0.7 - 4);
      if (tr.position.z > 4) continue;
      g.add(tr);
    }
    for (let i = 0; i < 30; i++) {
      const f = makeFlower(rand);
      const sx = rand() < 0.5 ? -1 : 1;
      f.position.set(sx * (BOUND_X + 1.2 + rand() * 4), 0, -6 + rand() * 13);
      g.add(f);
    }
    for (let i = 0; i < 4; i++) {
      const c = makeCloud(rand, 2);
      c.position.set(-18 + i * 12, 10 + rand() * 3, -20);
      g.add(c);
    }
  }

  frame() {
    const w = BOUND_X * 2 + 1.5;
    const d = this.party.fitDistance(w, (BOUND_Z1 - BOUND_Z0) * 0.9 + 3);
    this.camera.position.set(0, d * 0.86, d * 0.52 + 0.6);
    this.camera.lookAt(0, 0, 0.6);
  }

  cellAt(x, z) {
    const c = Math.floor((x + HALF_W) / CELL), r = Math.floor((z + HALF_D) / CELL);
    if (c < 0 || c >= GW || r < 0 || r >= GH) return null;
    return this.cells[r * GW + c];
  }

  paint(e, cell) {
    cell.painted = true;
    cell.pop = 1;
    cell.tile.material = toon(this.design.colors[cell.num - 1]);
    if (cell.label) { this.group.remove(cell.label); cell.label = null; }
    e.painted++;
    this.game.audio.play('pop');
    this.party.puffs.burst(new THREE.Vector3(cell.x, 0.4, cell.z), this.design.colors[cell.num - 1], { count: 5, size: 0.25, life: 0.35, speed: 2 });
    if (this.cells.every((c) => c.painted)) this.complete();
  }

  complete() {
    this.finished = true;
    for (const e of this.ents) { e.bonus = BONUS; e.ch.squash(1.4); }
    this.game.audio.play('fanfare');
    this.game.ui.banner(t('paintnum.done'), `${t('paintnum.what', { what: t(`paintnum.${this.design.key}`) })} ${t('paintnum.bonus')}`, 2200);
    const cols = this.design.colors.concat([COLORS.gold]);
    for (let i = 0; i < 6; i++) {
      this.later(i * 0.3, () => this.party.confetti.burst(new THREE.Vector3((Math.random() - 0.5) * GW * CELL, 2, (Math.random() - 0.5) * GH * CELL), 0, { count: 30, speed: 7, colors: cols }));
    }
    this.celebrate = 0;
    this.later(3.2, () => { this.done = true; });
  }

  update(dt, playing) {
    this.time += dt;
    const active = playing && !this.finished && this.t < TIME;
    if (playing && !this.finished) {
      this.t += dt;
      if (this.t >= TIME && !this.over) {
        this.over = true;
        this.game.audio.play('beep');
        this.game.ui.banner(t('paintnum.what', { what: t(`paintnum.${this.design.key}`) }), '', 1800);
        this.later(2, () => { this.done = true; });
      }
    }

    // Which numbers someone is carrying: those squares bob gently as a hint.
    const loaded = new Set(this.ents.map((e) => e.color));
    for (const c of this.cells) {
      if (c.label) {
        const s = loaded.has(c.num) ? 1 + Math.sin(this.time * 6 + c.r + c.c) * 0.1 : 0.9;
        c.label.scale.setScalar(s);
      }
      if (c.pop > 0) c.pop = Math.max(0, c.pop - dt * 4);
      let y = 0.17 + Math.sin(c.pop * Math.PI) * 0.15;
      if (this.celebrate !== undefined && c.num) y += Math.max(0, Math.sin(this.time * 7 - (c.c + c.r) * 0.5)) * 0.18;
      c.tile.position.y = y;
    }
    for (const pot of this.pots) {
      pot.sign.position.y = 1.55 + Math.sin(this.time * 3 + pot.num) * 0.08;
    }

    for (const e of this.ents) {
      const d = active ? this.input(e.p) : { x: 0, y: 0, a: false };
      const ix = Math.abs(d.x) > 0.15 ? d.x : 0, iz = Math.abs(d.y) > 0.15 ? -d.y : 0;
      e.vx += (ix * SPEED - e.vx) * Math.min(1, dt * 12);
      e.vz += (iz * SPEED - e.vz) * Math.min(1, dt * 12);
      e.x = THREE.MathUtils.clamp(e.x + e.vx * dt, -BOUND_X, BOUND_X);
      e.z = THREE.MathUtils.clamp(e.z + e.vz * dt, BOUND_Z0, BOUND_Z1);
      e.nope -= dt;
      if (active) {
        for (const pot of this.pots) {
          if (Math.hypot(pot.x - e.x, pot.z - e.z) < POT_R && e.color !== pot.num) {
            e.color = pot.num;
            e.ch.squash(1.25);
            this.game.audio.play('bubble');
            this.party.puffs.burst(new THREE.Vector3(pot.x, 1, pot.z), pot.color, { count: 8, size: 0.3, life: 0.4 });
            e.blob.material = glyphMaterial(String(pot.num), { disc: css(pot.color) });
            e.blob.visible = true;
          }
        }
        if (d.a) {
          const cell = this.cellAt(e.x, e.z);
          if (cell && !cell.painted && cell.num === e.color) this.paint(e, cell);
          else if (d.aPressed && cell && !cell.painted && e.nope <= 0) {
            // Wrong number: the brush just bounces off.
            e.nope = 0.4;
            e.ch.squash(0.85);
            this.game.audio.play('bump');
          }
        }
      }
      const sp = Math.hypot(e.vx, e.vz) / SPEED;
      if (sp > 0.05) e.ch.face(e.vx, e.vz);
      e.ch.group.position.set(e.x, 0.23, e.z);
      e.ch.spin = this.finished ? this.time * 8 : 0;
      e.ch.update(dt, { moving: sp });
      e.blob.position.set(e.x, 1.85 + Math.sin(this.time * 4 + e.x) * 0.05, e.z);
      e.blob.rotation.x = -0.6;
    }
    // Bump apart so beans don't stack on one square.
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
    const n = this.cells.filter((c) => c.num && c.painted).length;
    return `<div class="pill"><b>${t('paintnum.left', { n, total: this.toPaint })}</b></div>${clock(TIME - this.t)}`;
  }

  score(p) {
    const e = this.ents.find((x) => x.p === p);
    return e.painted + e.bonus;
  }

  detail(p) {
    const e = this.ents.find((x) => x.p === p);
    return t('paintnum.n', { n: e.painted }) + (e.bonus ? ` +${e.bonus}` : '');
  }
}
