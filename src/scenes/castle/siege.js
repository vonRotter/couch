import * as THREE from 'three';
import { COLORS, PLAYER_COLORS } from '../../core/palette.js';
import { t } from '../../core/i18n.js';
import { makeCage, makeLever, makePortcullis, makeCatapult, makePillow, makeTargetRing, makePrincess, GOLD } from './props.js';
import { GATE, EMPTY } from './tilemap.js';

// Castle props: gates with their levers, cages with captured troopers, pillow catapults and the
// Golden Bean Princess. Anything here can be hit by bean swords, hammers and arrows.

const PILLOW_G = 16;

export class Siege {
  constructor(scene, markers, diff, level) {
    this.scene = scene;
    this.map = scene.map;
    this.diff = diff;
    this.gates = [];
    this.levers = [];
    this.cages = [];
    this.catapults = [];
    this.pillows = [];
    this.princess = null;
    this.buildGates();
    let cageNo = 0;
    for (const mk of markers) {
      if (mk.ch === 'L') this.addLever(mk.c, mk.r);
      else if (mk.ch === 'c') this.addCage(mk.c, mk.r, level.cages[cageNo++] ?? 2);
      else if (mk.ch === 'Q') this.addPrincess(mk.c, mk.r);
      else if (mk.ch === 'K') this.addCatapult(mk.c, mk.r);
    }
    // Each lever opens the gate nearest to it.
    for (const lv of this.levers) {
      let best = null, bd = 1e9;
      for (const g of this.gates) { const d = Math.abs(g.c - lv.c) + Math.abs(g.r0 - lv.r) * 0.2; if (d < bd) { bd = d; best = g; } }
      lv.gate = best;
    }
  }

  buildGates() {
    const m = this.map;
    for (let c = 0; c < m.cols; c++) {
      for (let r = 0; r < m.rows; r++) {
        if (m.at(c, r) !== GATE || m.at(c, r - 1) === GATE) continue;
        let r1 = r;
        while (m.at(c, r1 + 1) === GATE) r1++;
        const h = r1 - r + 1;
        const mesh = makePortcullis(h);
        mesh.position.set(c + 0.5, r, 0);
        this.scene.scene.add(mesh);
        this.gates.push({ c, r0: r, r1, h, open: false, lift: 0, mesh });
      }
    }
  }

  addLever(c, r) {
    const mesh = makeLever();
    mesh.position.set(c + 0.5, r + 0.5, 0);
    this.scene.scene.add(mesh);
    this.levers.push({ c, r, open: false, mesh, box: { x0: c - 0.1, x1: c + 1.1, y0: r - 0.1, y1: r + 1.1 } });
  }

  addCage(c, r, n) {
    const mesh = makeCage(false);
    mesh.position.set(c, r, 0);
    this.scene.scene.add(mesh);
    const cage = { c, r, hp: this.diff.cageHp, max: this.diff.cageHp, broken: false, mesh, troopers: [], shake: 0, box: { x0: c, x1: c + 2, y0: r, y1: r + 2 } };
    for (let i = 0; i < n; i++) cage.troopers.push(this.scene.troopers.caged(c + 0.55 + (i % 3) * 0.45, r + 0.18));
    this.cages.push(cage);
  }

  addPrincess(c, r) {
    const mesh = makeCage(true);
    mesh.position.set(c, r, 0);
    this.scene.scene.add(mesh);
    const ch = makePrincess();
    ch.group.position.set(c + 1, r + 0.18, -0.2);
    this.scene.scene.add(ch.group);
    this.princess = { c, r, hp: this.diff.princessHp, max: this.diff.princessHp, broken: false, mesh, ch, shake: 0, box: { x0: c, x1: c + 2, y0: r, y1: r + 2 }, x: c + 1, y: r + 0.18, fly: null, free: false };
  }

  addCatapult(c, r) {
    const mesh = makeCatapult();
    mesh.position.set(c + 0.5, r, 0.1);
    this.scene.scene.add(mesh);
    this.catapults.push({ c, r, x: c + 0.5, y: r, hp: this.diff.catHp, max: this.diff.catHp, broken: false, mesh, cd: 3 + Math.random() * 2, armT: 0, shake: 0, box: { x0: c - 0.4, x1: c + 1.4, y0: r, y1: r + 1.6 } });
  }

  // ---------- goals ----------

  get gatesOpen() { return this.levers.filter((l) => l.open).length; }
  get cagesOpen() { return this.cages.filter((c) => c.broken).length; }
  get catapultsDown() { return this.catapults.filter((c) => c.broken).length; }

  // ---------- hits ----------

  /** Bean hit on everything overlapping the box. power 1 = a normal hit. Returns true if anything was hit. */
  hitBox(box, by, power = 1) {
    let any = false;
    const hits = (o) => o.box.x0 < box.x1 && o.box.x1 > box.x0 && o.box.y0 < box.y1 && o.box.y1 > box.y0;
    for (const lv of this.levers) if (!lv.open && hits(lv)) { this.pull(lv, by); any = true; }
    for (const cg of this.cages) if (!cg.broken && hits(cg)) { this.damageCage(cg, power, by); any = true; }
    for (const cp of this.catapults) if (!cp.broken && hits(cp)) { this.damageCatapult(cp, power, by); any = true; }
    const P = this.princess;
    if (P && !P.broken && hits(P)) { this.damagePrincess(power, by); any = true; }
    return any;
  }

  hitPoint(x, y, by) {
    return this.hitBox({ x0: x - 0.12, x1: x + 0.12, y0: y - 0.12, y1: y + 0.12 }, by, 1);
  }

  pull(lv, by) {
    lv.open = true;
    this.scene.game.audio.play('coin');
    this.scene.puffs.burst(new THREE.Vector3(lv.c + 0.5, lv.r + 0.5, 0.2), GOLD, { count: 10, size: 0.35 });
    const g = lv.gate;
    if (g && !g.open) {
      g.open = true;
      for (let r = g.r0; r <= g.r1; r++) this.map.set(g.c, r, EMPTY, -1);
      this.scene.game.ui.toast(t('kc.gateOpen'), 2200);
      this.scene.game.audio.play('fanfare');
      this.scene.shake = 0.3;
    }
    if (by) by.levers = (by.levers || 0) + 1;
  }

  damageCage(cg, power, by) {
    cg.hp -= power;
    cg.shake = 0.3;
    this.scene.game.audio.play('bump');
    this.scene.puffs.burst(new THREE.Vector3(cg.c + 1, cg.r + 1, 0.6), 0xffffff, { count: 4, size: 0.25, life: 0.3 });
    if (cg.hp > 0) return;
    cg.broken = true;
    cg.mesh.userData.bars.visible = false;
    cg.mesh.children[1].visible = false;
    this.scene.confetti.burst(new THREE.Vector3(cg.c + 1, cg.r + 1.5, 0.5), 0, { count: 40, speed: 7, colors: PLAYER_COLORS.map((p) => p.hex).concat(GOLD), life: 1.4 });
    this.scene.game.audio.play('rescue');
    this.scene.game.ui.toast(t('kc.freed', { n: cg.troopers.length }), 2000);
    cg.troopers.forEach((tr, i) => this.scene.later(0.15 * i, () => this.scene.troopers.release(tr)));
    if (by) by.freed = (by.freed || 0) + cg.troopers.length;
  }

  damageCatapult(cp, power, by) {
    cp.hp -= power;
    cp.shake = 0.3;
    this.scene.game.audio.play('bump');
    this.scene.puffs.burst(new THREE.Vector3(cp.x, cp.y + 0.8, 0.6), 0xfff0f6, { count: 5, size: 0.3, life: 0.4 });
    if (cp.hp > 0) return;
    cp.broken = true;
    cp.mesh.rotation.z = -0.5;
    cp.mesh.userData.loaded.visible = false;
    cp.mesh.userData.arm.rotation.z = 0.6;
    this.scene.puffs.burst(new THREE.Vector3(cp.x, cp.y + 1, 0.6), 0xfff0f6, { count: 30, size: 0.45, life: 1, speed: 5 });
    this.scene.game.ui.toast(t('kc.catDown'), 2000);
    this.scene.game.audio.play('star');
    if (by) by.cats = (by.cats || 0) + 1;
  }

  damagePrincess(power, by) {
    const P = this.princess;
    P.hp -= power;
    P.shake = 0.3;
    this.scene.game.audio.play('bump');
    this.scene.puffs.burst(new THREE.Vector3(P.c + 1, P.r + 1, 0.6), GOLD, { count: 5, size: 0.3, life: 0.4 });
    if (P.hp > 0) return;
    P.broken = true;
    P.mesh.userData.bars.visible = false;
    P.mesh.children[1].visible = false;
    this.scene.confetti.burst(new THREE.Vector3(P.c + 1, P.r + 1.5, 0.5), 0, { count: 90, speed: 9, up: 4, colors: PLAYER_COLORS.map((p) => p.hex).concat(GOLD, COLORS.white), life: 2 });
    this.scene.game.audio.play('rescue');
    this.scene.game.audio.play('fanfare');
    this.scene.game.ui.toast(t('kc.princessFree'), 2600);
    // She floats down to the flag in a golden bubble.
    const f = this.scene.flagPos;
    P.fly = { x0: P.x, y0: P.y, x1: f.x - 1.2, y1: f.y, t: 0 };
    if (by) by.freed = (by.freed || 0) + 1;
  }

  // ---------- catapults ----------

  updateCatapult(cp, dt, playing) {
    cp.shake = Math.max(0, cp.shake - dt);
    cp.mesh.position.x = cp.x + Math.sin(this.scene.time * 60) * cp.shake * 0.15;
    if (cp.broken) return;
    const arm = cp.mesh.userData.arm;
    cp.armT = Math.max(0, cp.armT - dt);
    arm.rotation.z = cp.armT > 0 ? -0.35 + (cp.armT / 0.5) * 1.6 : -0.35;
    cp.mesh.userData.loaded.visible = cp.cd < this.diff.catRate - 0.8;
    if (!playing) return;
    cp.cd -= dt;
    if (cp.cd > 0) return;
    // Throw at the nearest bean or trooper 5..30 tiles away.
    let best = null, bd = 1e9;
    for (const o of this.scene.grumbles.targets()) {
      const dx = Math.abs(o.body.x - cp.x);
      if (dx < 5 || dx > 30) continue;
      if (dx < bd) { bd = dx; best = o; }
    }
    if (!best) { cp.cd = 1; return; }
    cp.cd = this.diff.catRate * (0.85 + Math.random() * 0.3);
    cp.armT = 0.5;
    const dir = Math.sign(best.body.x - cp.x);
    cp.mesh.scale.x = dir < 0 ? 1 : -1;
    let tx = best.body.x + best.body.vx * 1.2 + (Math.random() - 0.5) * this.diff.catSpread;
    tx = THREE.MathUtils.clamp(tx, 1, this.map.cols - 1);
    const col = Math.floor(tx);
    let ty = this.map.landing(col, Math.min(this.map.rows - 1, Math.floor(best.body.y + 3)));
    if (ty < 0) ty = best.body.y;
    const sx = cp.x + dir * 0.9, sy = cp.y + 1.6;
    const T = THREE.MathUtils.clamp(Math.abs(tx - sx) / 11, 1.3, 2.4);
    const vx = (tx - sx) / T, vy = (ty - sy + 0.5 * PILLOW_G * T * T) / T;
    const mesh = makePillow();
    this.scene.scene.add(mesh);
    const ring = makeTargetRing();
    ring.position.set(tx, ty + 0.06, 0.3);
    this.scene.scene.add(ring);
    this.pillows.push({ x: sx, y: sy, vx, vy, mesh, ring, tx, ty, t: 0 });
    this.scene.game.audio.play('whoosh');
  }

  updatePillows(dt) {
    for (const p of this.pillows) {
      p.t += dt;
      p.vy -= PILLOW_G * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.mesh.position.set(p.x, p.y, 0.3);
      p.mesh.rotation.z += dt * 6;
      const s = 1 + Math.sin(this.scene.time * 14) * 0.15;
      p.ring.scale.set(s, s, s);
      const landed = p.vy < 0 && (p.y <= p.ty + 0.2 || this.map.solid(Math.floor(p.x), Math.floor(p.y)));
      if (landed || p.t > 5) this.poof(p);
    }
    this.pillows = this.pillows.filter((p) => !p.done);
  }

  poof(p) {
    p.done = true;
    this.scene.scene.remove(p.mesh);
    this.scene.scene.remove(p.ring);
    this.scene.puffs.burst(new THREE.Vector3(p.x, p.y + 0.3, 0.6), 0xfff0f6, { count: 18, size: 0.45, life: 0.8, speed: 5 });
    this.scene.game.audio.play('splat');
    const dir = Math.sign(p.vx) || 1;
    for (const o of this.scene.grumbles.targets()) {
      const dx = o.body.x - p.x, dy = o.body.y + 0.5 - p.y;
      if (Math.abs(dx) > 1.7 || Math.abs(dy) > 1.6) continue;
      if (o.kind === 'trooper') this.scene.troopers.knock(o, Math.sign(dx) || dir, 6, this.diff.dizzy + 0.4);
      else this.scene.hitHero(o, null, { dir: Math.sign(dx) || dir, big: false });
    }
  }

  // ---------- frame ----------

  update(dt, playing) {
    for (const g of this.gates) {
      if (!g.open || g.lift >= 1) continue;
      g.lift = Math.min(1, g.lift + dt * 1.4);
      g.mesh.position.y = g.r0 + g.lift * (g.h - 0.25);
    }
    for (const lv of this.levers) {
      const target = lv.open ? -0.7 : 0.7;
      const st = lv.mesh.userData.stick;
      st.rotation.z += (target - st.rotation.z) * Math.min(1, dt * 10);
      const ring = lv.mesh.userData.ring;
      ring.visible = !lv.open;
      ring.scale.setScalar(1 + Math.sin(this.scene.time * 5) * 0.12);
    }
    for (const cg of [...this.cages, this.princess].filter(Boolean)) {
      cg.shake = Math.max(0, cg.shake - dt);
      cg.mesh.position.x = cg.c + Math.sin(this.scene.time * 60) * cg.shake * 0.12;
    }
    for (const cp of this.catapults) this.updateCatapult(cp, dt, playing);
    this.updatePillows(dt);
    const P = this.princess;
    if (P) {
      const ch = P.ch;
      if (P.fly) {
        const F = P.fly;
        F.t += dt / 3;
        const k = Math.min(1, F.t), s = k * k * (3 - 2 * k);
        P.x = F.x0 + (F.x1 - F.x0) * s;
        P.y = F.y0 + (F.y1 - F.y0) * s + Math.sin(k * Math.PI) * 3;
        ch.spin += dt * 3;
        if (F.t >= 1) { P.fly = null; P.free = true; ch.spin = 0; this.scene.onPrincessHome?.(); }
      } else if (P.free) {
        P.y = this.scene.flagPos.y + Math.abs(Math.sin(this.scene.time * 4)) * 0.4;
      }
      ch.group.position.set(P.x, P.y, P.free || P.fly ? 0.3 : -0.2);
      ch.faceSide(0.3);
      ch.update(dt, { moving: 0, grounded: true });
      ch.pivot.rotation.z = P.broken ? 0 : Math.sin(this.scene.time * 3) * 0.08;
    }
  }
}
