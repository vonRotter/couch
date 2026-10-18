import * as THREE from 'three';
import { Round, clock } from './common.js';
import { Character } from '../../core/character.js';
import { makeGrumble } from '../../core/critters.js';
import { COLORS, PLAYER_COLORS, toon, sharedGeo } from '../../core/palette.js';
import { makeTree, seeded } from '../../core/world.js';
import { t, addStrings } from '../../core/i18n.js';

addStrings({
  en: {
    'trails.title': 'Paint Trails',
    'trails.hint': 'Your paint roller never stops! Push the stick to turn. Don\'t bump into any paint stripe or the wall. Every second you keep rolling is a point, and you get 2 points when someone splats into your stripe.',
    'trails.go': 'Keep rolling!', 'trails.splat': 'splat!',
    'trails.detail': '{n} points · {s} splats',
  },
  no: {
    'trails.title': 'Malingsspor',
    'trails.hint': 'Malingsrullen din stopper aldri! Skyv spaken for å svinge. Ikke kræsj i en malingsstripe eller veggen. Hvert sekund du ruller videre gir ett poeng, og du får 2 poeng når noen kræsjer i stripa di.',
    'trails.go': 'Rull videre!', 'trails.splat': 'splæsj!',
    'trails.detail': '{n} poeng · {s} kræsj',
  },
});

// Paint Trails: Tron / Snake with paint rollers on a grid. Rollers always move forward and
// paint the cells behind them; stripes dry up (fade) after a few seconds. Hitting a stripe or
// the wall is a comic splat: -1 point, your stripe fades, and you pop back in 1.5 s as a ghost.
const CELL = 0.6;
const SPEED = 6.5; // cells per second
const TRAIL_LIFE = 6; // seconds a stripe stays wet (and dangerous)
const TIME = 45;
const RESPAWN = 1.5;
const GHOST = 1.3;
const HIT_BONUS = 2;
const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]]; // +x, +z (toward camera), -x, -z
const CAP = Math.ceil(SPEED * TRAIL_LIFE) + 8;

export class TrailsRound extends Round {
  static key = 'trails';

  constructor(party) {
    super(party);
    this.t = 0;
    this.frameNo = 0;
    // 1 player races 2 grumble rollers, 2 players get one, 3+ play on their own.
    const bots = Math.max(0, 3 - this.players.length);
    const n = this.players.length + bots;
    this.GW = n <= 3 ? 32 : n <= 4 ? 36 : 40;
    this.GH = Math.round(this.GW * 0.58);
    this.owner = new Int8Array(this.GW * this.GH).fill(-1);
    this.claimed = new Int32Array(this.GW * this.GH).fill(-1);
    this.build();
    const used = new Set(this.players.map((p) => p.color));
    const botColors = PLAYER_COLORS.filter((c) => !used.has(c.hex)).slice(0, bots);
    const roster = this.players.map((p) => ({ p, color: p.color, css: p.css, name: p.name }))
      .concat(botColors.map((c, i) => ({ p: null, color: c.hex, css: c.css, name: `Grumble ${i + 1}` })));
    this.rollers = roster.map((r, i) => this.makeRoller(r, i, n));
    this.splats = [];
    this.popups = [];
  }

  get title() { return t('trails.title'); }
  get hint() { return t('trails.hint'); }

  // ---------- world ----------

  cx(c) { return (c - this.GW / 2 + 0.5) * CELL; }
  cz(r) { return (r - this.GH / 2 + 0.5) * CELL; }
  inside(c, r) { return c >= 0 && r >= 0 && c < this.GW && r < this.GH; }

  build() {
    const g = this.group;
    const w = this.GW * CELL, h = this.GH * CELL;
    const ground = new THREE.Mesh(new THREE.CircleGeometry(60, 40), toon(COLORS.grassDark));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.03;
    g.add(ground);
    // Floor with a faint grid, drawn once on a canvas.
    const cv = document.createElement('canvas');
    const px = 16;
    cv.width = this.GW * px; cv.height = this.GH * px;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#fff6e4';
    ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.fillStyle = '#f3e4c8';
    for (let r = 0; r < this.GH; r++) for (let c = 0; c < this.GW; c++) if ((r + c) % 2) ctx.fillRect(c * px, r * px, px, px);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = THREE.NearestFilter;
    const floorMat = new THREE.MeshToonMaterial({ map: tex, gradientMap: toon(0xffffff).gradientMap });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, h), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    g.add(floor);
    // Soft bumper walls in party colors.
    const seg = 2.4;
    const wallGeo = sharedGeo('trailWall', () => new THREE.BoxGeometry(seg, 0.45, 0.4));
    let k = 0;
    const addWall = (x, z, rotY) => {
      const m = new THREE.Mesh(wallGeo, toon(PLAYER_COLORS[k++ % 6].hex));
      m.position.set(x, 0.22, z);
      m.rotation.y = rotY;
      m.castShadow = m.receiveShadow = true;
      g.add(m);
    };
    for (let x = -w / 2 + seg / 2; x < w / 2; x += seg) { addWall(x, -h / 2 - 0.2, 0); addWall(x, h / 2 + 0.2, 0); }
    for (let z = -h / 2 + seg / 2; z < h / 2; z += seg) { addWall(-w / 2 - 0.2, z, Math.PI / 2); addWall(w / 2 + 0.2, z, Math.PI / 2); }
    // Paint pots in the corners and trees around.
    PLAYER_COLORS.slice(0, 4).forEach((pc, i) => {
      const pot = new THREE.Group();
      const can = new THREE.Mesh(sharedGeo('trailPot', () => new THREE.CylinderGeometry(0.5, 0.45, 0.7, 18)), toon(0xc9c3d9));
      can.position.y = 0.35;
      const paint = new THREE.Mesh(sharedGeo('trailPaint', () => new THREE.CylinderGeometry(0.46, 0.46, 0.06, 18)), toon(pc.hex));
      paint.position.y = 0.71;
      can.castShadow = true;
      pot.add(can, paint);
      pot.position.set((i % 2 ? 1 : -1) * (w / 2 + 1.1), 0, (i < 2 ? -1 : 1) * (h / 2 + 0.6));
      g.add(pot);
    });
    const rand = seeded(77);
    for (let i = 0; i < 14; i++) {
      const tr = makeTree(rand, 1.1 + rand() * 0.5);
      const side = i % 2 ? 1 : -1;
      tr.position.set(side * (w / 2 + 2.5 + rand() * 4), 0, -h / 2 - 1 + rand() * (h + 1));
      g.add(tr);
    }
    for (let i = 0; i < 8; i++) {
      const tr = makeTree(rand, 1.2 + rand() * 0.5);
      tr.position.set(-w / 2 + rand() * w, 0, -h / 2 - 2.5 - rand() * 3);
      g.add(tr);
    }
  }

  makeRoller(info, i, n) {
    const group = new THREE.Group();
    const drum = new THREE.Group();
    drum.position.set(0, 0.24, 0.42);
    const roll = new THREE.Mesh(sharedGeo('trailDrum', () => new THREE.CylinderGeometry(0.22, 0.22, 0.75, 16)), toon(info.color));
    roll.rotation.z = Math.PI / 2;
    roll.castShadow = true;
    const fuzz = new THREE.Mesh(sharedGeo('trailFuzz', () => new THREE.TorusGeometry(0.22, 0.03, 6, 16)), toon(COLORS.white));
    fuzz.rotation.y = Math.PI / 2;
    fuzz.position.x = 0.36;
    const fuzz2 = fuzz.clone();
    fuzz2.position.x = -0.36;
    drum.add(roll, fuzz, fuzz2);
    group.add(drum);
    for (const s of [-1, 1]) {
      const arm = new THREE.Mesh(sharedGeo('trailArm', () => new THREE.CylinderGeometry(0.03, 0.03, 0.55, 6)), toon(0x8d86a8));
      arm.position.set(s * 0.32, 0.38, 0.2);
      arm.rotation.x = 1.0;
      group.add(arm);
    }
    const bar = new THREE.Mesh(sharedGeo('trailBar', () => new THREE.CylinderGeometry(0.035, 0.035, 0.7, 6)), toon(0x8d86a8));
    bar.rotation.z = Math.PI / 2;
    bar.position.set(0, 0.5, -0.02);
    group.add(bar);
    let ch = null, grumble = null;
    if (info.p) {
      ch = new Character(info.color, { hat: info.p.hat });
      ch.group.scale.setScalar(0.62);
      ch.group.position.z = -0.22;
      group.add(ch.group);
    } else {
      grumble = makeGrumble(info.color);
      grumble.scale.setScalar(0.85);
      grumble.position.z = -0.22;
      group.add(grumble);
    }
    group.scale.setScalar(1.25);
    this.group.add(group);
    const inst = new THREE.InstancedMesh(sharedGeo('trailCell', () => new THREE.BoxGeometry(CELL, 0.05, CELL)), toon(info.color), CAP);
    inst.receiveShadow = true;
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let k = 0; k < CAP; k++) inst.setMatrixAt(k, zero);
    inst.frustumCulled = false;
    this.group.add(inst);
    // Start on the left and right edges, facing in, on staggered rows so nobody meets head-on.
    const left = i % 2 === 0;
    const perSide = Math.ceil(n / 2);
    const slot = Math.floor(i / 2);
    const rowF = (slot + (left ? 0.3 : 0.8)) / perSide;
    const r = Math.round(2 + rowF * (this.GH - 5));
    const c = left ? 3 : this.GW - 4;
    const rl = {
      ...info, id: i, group, drum, ch, grumble, inst, c, r, dir: left ? 0 : 2, t: 0, entered: false, queue: [],
      state: 'roll', wait: 0, ghost: 0, points: 0, alive: 0, splatCount: 0, hits: 0,
      cells: [], fading: [], fade: 0, slot: 0, yaw: left ? Math.PI / 2 : -Math.PI / 2, think: 0,
    };
    this.placeMesh(rl);
    return rl;
  }

  frame() {
    const w = this.GW * CELL + 2.4, h = this.GH * CELL + 2;
    const d = this.party.fitDistance(w, h * 0.92 + 2.2);
    this.camera.position.set(0, d * 0.9, d * 0.42 + 0.6);
    this.camera.lookAt(0, 0, 0.6);
  }

  start() {
    this.game.audio.play('go');
  }

  // ---------- rolling ----------

  head(rl) {
    const [dc, dr] = DIRS[rl.dir];
    return { x: this.cx(rl.c) + dc * rl.t * CELL, z: this.cz(rl.r) + dr * rl.t * CELL };
  }

  placeMesh(rl) {
    const h = this.head(rl);
    rl.group.position.set(h.x, 0, h.z);
  }

  /** Stick to a wanted direction: taps count first, then a firmly held stick. */
  steer(rl) {
    const d = this.input(rl.p);
    let want = -1;
    if (d.stepX) want = d.stepX > 0 ? 0 : 2;
    else if (d.stepY) want = d.stepY > 0 ? 3 : 1;
    else if (Math.abs(d.x) > 0.6 && Math.abs(d.x) >= Math.abs(d.y)) want = d.x > 0 ? 0 : 2;
    else if (Math.abs(d.y) > 0.6) want = d.y > 0 ? 3 : 1;
    if (want < 0) return;
    const last = rl.queue.length ? rl.queue[rl.queue.length - 1] : rl.dir;
    if (want === last || want === (last + 2) % 4) return;
    if (rl.queue.length < 2) rl.queue.push(want);
  }

  free(c, r, self) {
    if (!this.inside(c, r)) return false;
    if (this.owner[r * this.GW + c] >= 0) return false;
    for (const o of this.rollers) if (o !== self && o.state === 'roll' && o.ghost <= 0 && o.c === c && o.r === r) return false;
    return true;
  }

  /** Grumble rollers look for the direction with the most room (and sometimes don't look far). */
  botThink(rl) {
    const opts = [rl.dir, (rl.dir + 1) % 4, (rl.dir + 3) % 4];
    const sloppy = Math.random() < 0.12;
    let best = rl.dir, bestS = -Infinity;
    for (const d of opts) {
      const [dc, dr] = DIRS[d];
      let run = 0;
      for (let k = 1; k <= 10 && this.free(rl.c + dc * k, rl.r + dr * k, rl); k++) run++;
      let area = 0;
      if (!sloppy && run > 0) area = this.floodArea(rl.c + dc, rl.r + dr, 90, rl);
      const s = Math.min(run, 6) + area * 0.08 + (d === rl.dir ? 0.8 : 0) + Math.random() * 1.2 - (run === 0 ? 100 : 0);
      if (s > bestS) { bestS = s; best = d; }
    }
    rl.dir = best;
  }

  floodArea(c, r, max, self) {
    const seen = new Set([r * this.GW + c]);
    const q = [[c, r]];
    for (let h = 0; h < q.length && seen.size < max; h++) {
      const [x, y] = q[h];
      for (const [dc, dr] of DIRS) {
        const nx = x + dc, ny = y + dr, k = ny * this.GW + nx;
        if (seen.has(k) || !this.free(nx, ny, self)) continue;
        seen.add(k);
        q.push([nx, ny]);
      }
    }
    return seen.size;
  }

  roll(rl, dt) {
    rl.t += SPEED * dt;
    for (let guard = 0; guard < 4; guard++) {
      if (!rl.entered && rl.t >= 0.5) {
        rl.entered = true;
        const [dc, dr] = DIRS[rl.dir];
        const nc = rl.c + dc, nr = rl.r + dr;
        if (rl.ghost <= 0) {
          if (!this.inside(nc, nr)) { this.splat(rl, -1); return; }
          const idx = nr * this.GW + nc;
          const own = this.owner[idx];
          if (own >= 0) {
            const other = this.rollers[own];
            // Two heads into the same cell on the same frame: both splat, nobody scores.
            if (this.claimed[idx] === this.frameNo && other !== rl) { this.splat(rl, -1); if (other.state === 'roll' && other.ghost <= 0) this.splat(other, -1); return; }
            this.splat(rl, own);
            return;
          }
          this.paint(rl, idx);
        }
      }
      if (rl.t < 1) break;
      // Arrived at the next cell's center: take the queued turn.
      const [dc, dr] = DIRS[rl.dir];
      rl.c += dc;
      rl.r += dr;
      rl.t -= 1;
      rl.entered = false;
      if (rl.p) {
        while (rl.queue.length) {
          const d = rl.queue.shift();
          if (d !== rl.dir && d !== (rl.dir + 2) % 4) { rl.dir = d; break; }
        }
      } else this.botThink(rl);
      // A ghost that is about to wake up inside a wall turns away from it.
      if (!this.inside(rl.c + DIRS[rl.dir][0], rl.r + DIRS[rl.dir][1]) && rl.ghost > 0) rl.dir = this.inside(rl.c + DIRS[(rl.dir + 1) % 4][0], rl.r + DIRS[(rl.dir + 1) % 4][1]) ? (rl.dir + 1) % 4 : (rl.dir + 3) % 4;
    }
  }

  paint(rl, idx) {
    this.owner[idx] = rl.id;
    this.claimed[idx] = this.frameNo;
    const slot = rl.slot++ % CAP;
    rl.cells.push({ idx, t: this.time, slot });
  }

  splat(rl, ownerId) {
    rl.state = 'splat';
    rl.wait = RESPAWN;
    rl.points = Math.max(0, rl.points - 1);
    rl.splatCount++;
    rl.queue = [];
    // Your stripe dries up right away (so others can pass) and fades out.
    for (const cell of rl.cells) if (this.owner[cell.idx] === rl.id) this.owner[cell.idx] = -1;
    rl.fading = rl.fading.concat(rl.cells);
    rl.cells = [];
    rl.fade = 0.6;
    const h = this.head(rl);
    const pos = new THREE.Vector3(h.x, 0.3, h.z);
    this.addSplat(pos, rl.color);
    this.party.confetti.burst(pos.clone().setY(0.6), 0, { count: 18, speed: 5, colors: [rl.color, COLORS.white], size: 0.16, life: 0.9 });
    this.party.puffs.burst(pos, rl.color, { count: 8, size: 0.35, life: 0.5 });
    this.game.audio.play('splat');
    this.popup(pos, '-1', rl.css);
    if (ownerId >= 0 && ownerId !== rl.id) {
      const o = this.rollers[ownerId];
      o.points += HIT_BONUS;
      o.hits++;
      this.popup(this.head(o), `+${HIT_BONUS}`, o.css);
      this.game.audio.play('coin');
    }
  }

  addSplat(pos, color) {
    const g = new THREE.Group();
    g.position.set(pos.x, 0.03, pos.z);
    const blob = sharedGeo('trailSplat', () => new THREE.CylinderGeometry(1, 1, 0.04, 14));
    for (let k = 0; k < 7; k++) {
      const m = new THREE.Mesh(blob, toon(color));
      const a = Math.random() * Math.PI * 2, r = k === 0 ? 0 : 0.3 + Math.random() * 0.35;
      const s = k === 0 ? 0.42 : 0.08 + Math.random() * 0.12;
      m.position.set(Math.cos(a) * r, k * 0.002, Math.sin(a) * r);
      m.scale.set(s, 1, s);
      g.add(m);
    }
    g.scale.setScalar(0.1);
    this.group.add(g);
    this.splats.push({ g, t: 0 });
  }

  popup(pos, text, css) {
    const el = this.label('label');
    this.popups.push({ el, text, css, pos: new THREE.Vector3(pos.x, 1.2, pos.z), t: 0 });
  }

  respawn(rl) {
    // A free spot with a clear lane ahead, away from other rollers.
    let best = null, bestS = -Infinity;
    for (let tries = 0; tries < 80; tries++) {
      const c = 3 + Math.floor(Math.random() * (this.GW - 6));
      const r = 3 + Math.floor(Math.random() * (this.GH - 6));
      if (!this.free(c, r, rl)) continue;
      const toCenter = Math.abs(c - this.GW / 2) > Math.abs(r - this.GH / 2) ? (c < this.GW / 2 ? 0 : 2) : (r < this.GH / 2 ? 1 : 3);
      let run = 0;
      for (let k = 1; k <= 8 && this.free(c + DIRS[toCenter][0] * k, r + DIRS[toCenter][1] * k, rl); k++) run++;
      let near = 99;
      for (const o of this.rollers) if (o !== rl && o.state === 'roll') near = Math.min(near, Math.abs(o.c - c) + Math.abs(o.r - r));
      const s = run * 2 + Math.min(near, 8) + Math.random();
      if (s > bestS) { bestS = s; best = { c, r, dir: toCenter }; }
    }
    best = best || { c: Math.floor(this.GW / 2), r: Math.floor(this.GH / 2), dir: 0 };
    Object.assign(rl, best);
    rl.t = 0;
    rl.entered = false;
    rl.state = 'roll';
    rl.ghost = GHOST;
    rl.queue = [];
    rl.yaw = Math.atan2(DIRS[rl.dir][0], DIRS[rl.dir][1]);
    this.party.puffs.burst(new THREE.Vector3(this.cx(rl.c), 0.4, this.cz(rl.r)), 0xffffff, { count: 10, size: 0.35 });
    this.game.audio.play('pop');
  }

  // ---------- frame ----------

  update(dt, playing) {
    this.time += dt;
    this.frameNo++;
    if (playing) {
      this.t += dt;
      if (this.t >= TIME) { this.done = true; playing = false; }
    }
    const m = new THREE.Matrix4();
    for (const rl of this.rollers) {
      if (playing) {
        if (rl.state === 'roll') {
          if (rl.p) this.steer(rl);
          rl.ghost -= dt;
          this.roll(rl, dt);
          if (rl.state === 'roll') {
            rl.alive += dt;
            while (rl.alive >= 1) { rl.alive -= 1; rl.points++; }
          }
        } else {
          rl.wait -= dt;
          if (rl.wait <= 0) this.respawn(rl);
        }
      }
      // Wet stripes dry up from the tail.
      while (rl.cells.length && this.time - rl.cells[0].t > TRAIL_LIFE) {
        const cell = rl.cells.shift();
        if (this.owner[cell.idx] === rl.id) this.owner[cell.idx] = -1;
        rl.inst.setMatrixAt(cell.slot, m.makeScale(0, 0, 0));
      }
      for (const cell of rl.cells) {
        const age = this.time - cell.t, left = TRAIL_LIFE - age;
        const s = Math.min(1, age * 8, left / 0.7);
        const c = cell.idx % this.GW, r = Math.floor(cell.idx / this.GW);
        m.makeScale(s, 1, s).setPosition(this.cx(c), 0.025, this.cz(r));
        rl.inst.setMatrixAt(cell.slot, m);
      }
      if (rl.fading.length) {
        rl.fade -= dt;
        const s = Math.max(0, rl.fade / 0.6);
        for (const cell of rl.fading) {
          const c = cell.idx % this.GW, r = Math.floor(cell.idx / this.GW);
          m.makeScale(s, 1, s).setPosition(this.cx(c), 0.025, this.cz(r));
          rl.inst.setMatrixAt(cell.slot, m);
        }
        if (rl.fade <= 0) rl.fading = [];
      }
      rl.inst.instanceMatrix.needsUpdate = true;

      // Roller and driver.
      this.placeMesh(rl);
      const want = Math.atan2(DIRS[rl.dir][0], DIRS[rl.dir][1]);
      let d = want - rl.yaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      rl.yaw += d * Math.min(1, dt * 16);
      const splatted = rl.state === 'splat';
      rl.group.rotation.y = rl.yaw + (splatted ? (RESPAWN - rl.wait) * 9 : 0);
      rl.group.position.y = splatted ? Math.max(0, Math.sin((RESPAWN - rl.wait) * 6) * 0.4) : 0;
      rl.group.visible = !(splatted && rl.wait < 0.6) && !(rl.ghost > 0 && Math.floor(this.time * 12) % 2 === 0);
      rl.drum.rotation.x += (playing && rl.state === 'roll' ? SPEED * CELL / 0.22 : 0) * dt;
      if (rl.ch) {
        rl.ch.targetYaw = 0;
        rl.ch.update(dt, { moving: playing && !splatted ? 0.6 : 0 });
      } else {
        rl.grumble.userData.body.position.y = 0.45 + Math.abs(Math.sin(this.time * 10 + rl.id)) * 0.06;
      }
    }
    for (const sp of this.splats) {
      sp.t += dt;
      const s = sp.t < 0.15 ? sp.t / 0.15 : sp.t > 3.5 ? Math.max(0.001, 1 - (sp.t - 3.5) / 0.5) : 1;
      sp.g.scale.setScalar(s);
    }
    this.splats = this.splats.filter((sp) => {
      if (sp.t < 4) return true;
      this.group.remove(sp.g);
      return false;
    });
    for (const pu of this.popups) {
      pu.t += dt;
      pu.pos.y += dt * 1.2;
      this.setLabel(pu.el, `<b>${pu.text}</b>`, pu.pos, pu.css);
    }
    this.popups = this.popups.filter((pu) => {
      if (pu.t < 1) return true;
      pu.el.remove();
      this.labels = this.labels.filter((x) => x !== pu.el);
      return false;
    });
  }

  hud() {
    return `<div class="pill"><b>${t('trails.go')}</b></div>${clock(TIME - this.t)}`;
  }

  score(p) {
    return this.rollers.find((r) => r.p === p).points;
  }

  detail(p) {
    const r = this.rollers.find((x) => x.p === p);
    return t('trails.detail', { n: r.points, s: r.splatCount });
  }
}
