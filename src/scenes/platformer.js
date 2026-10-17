import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { MiniGame } from '../core/minigame.js';
import { Character } from '../core/character.js';
import { makeGrumble } from '../core/critters.js';
import { COLORS, PLAYER_COLORS, toon, sharedGeo } from '../core/palette.js';
import { addLights, skyTexture, makeCloud, makeTree, makeFlower, makeBush, makeGem, makeStar, makeMushroom, seeded } from '../core/world.js';
import { moveBody, platformerControl, solidAt, boxesTouch, overlaps } from '../core/physics2d.js';
import { SKYHOP_LEVELS } from './skyhop-levels.js';
import { esc } from '../core/ui.js';

const PHYS = {
  speed: 7.5, accel: 60, airAccel: 40, jump: 15.5, jump2: 12.5, doubleJump: true,
  gravity: 38, fallMul: 1.5, coyote: 0.14, buffer: 0.16, maxFall: -20,
};
const SPRING = 24;
const FINISH_TIME = 12;
const ROWS = 14;
const GEM_COLORS = PLAYER_COLORS.map((c) => c.hex);

export class PlatformerScene extends MiniGame {
  constructor(game, opts) {
    super(game, opts);
    const progress = game.roster.progress.skyhop || 0;
    this.unlocked = Math.min(SKYHOP_LEVELS.length - 1, progress);
    this.picking = opts.level === undefined;
    this.levelIndex = this.picking ? this.unlocked : opts.level;
    this.selection = this.levelIndex;
    this.level = SKYHOP_LEVELS[this.levelIndex];
    this.theme = this.level.theme;
    this.rows = Array.from({ length: ROWS }, (_, r) => this.level.chunks.map((c) => c[r]).join(''));
    this.width = this.rows[0].length;

    this.scene.background = skyTexture(...this.theme.sky);
    this.sun = addLights(this.scene, { size: 22 }).sun;

    this.solids = [];
    this.movers = [];
    this.crumbles = [];
    this.springs = [];
    this.gems = [];
    this.enemies = [];
    this.totalGems = 0;
    this.teamGems = 0;
    this.finishTimer = null;
    this.firstFinisher = null;
    this.spawn = { x: 3, y: 2 };
    this.flag = null;
    this.camX = 0;
    this.camDist = 20;

    this.buildLevel();
    this.buildBackdrop();

    this.ents = this.players.map((p, i) => {
      const ch = new Character(p.color, { hat: p.hat });
      this.scene.add(ch.group);
      const bubble = new THREE.Mesh(sharedGeo('pbubble2', () => new THREE.SphereGeometry(0.85, 22, 16)), toon(p.color, { transparent: true, opacity: 0.35 }));
      bubble.visible = false;
      this.scene.add(bubble);
      const x = this.spawn.x + (i - (this.players.length - 1) / 2) * 0.9;
      return {
        p, ch, bubble,
        body: { x, y: this.spawn.y, w: 0.7, h: 1.1, vx: 0, vy: 0, grounded: true },
        facing: 1, state: 'play', t: 0, stun: 0, invuln: 0,
        lastSafe: { x, y: this.spawn.y }, gems: 0, stomps: 0, place: 0,
      };
    });

    this.camX = this.spawn.x + 6;
    this.updateCamera(1);
    game.audio.playMusic(this.theme.music);
    if (this.picking) this.openPicker();
    else this.startIntro();
  }

  startIntro() {
    this.intro(`Sky Hop ${this.levelIndex + 1}: ${this.level.name}`, 'Reach the flag together · fall and you float back in a bubble');
  }

  // ---------- level picker ----------

  openPicker() {
    this.state = 'select';
    this.pickerEl = this.game.ui.panel('', 'panel picker');
    this.stickPrev = new Map();
    this.renderPicker();
  }

  renderPicker() {
    const cards = SKYHOP_LEVELS.map((lv, i) => {
      const locked = i > this.unlocked;
      const [top, bottom] = lv.theme.sky;
      return `<div class="level-card ${i === this.selection ? 'selected' : ''} ${locked ? 'locked' : ''}" style="background:linear-gradient(${top}, ${bottom})">
        <div class="level-num">${i + 1}</div><div class="level-name">${locked ? 'Locked' : esc(lv.name)}</div></div>`;
    }).join('');
    this.pickerEl.innerHTML = `<div class="results-title">Sky Hop</div>
      <div class="results-sub">Pick a level · stick left/right · jump to start</div>
      <div class="level-row">${cards}</div>
      <div class="results-footer">Finish a level to unlock the next one</div>`;
  }

  updatePicker() {
    for (const p of this.players) {
      const d = this.input(p);
      if (!d) continue;
      const dir = d.x > 0.5 ? 1 : d.x < -0.5 ? -1 : 0;
      if (dir && dir !== this.stickPrev.get(p)) {
        const next = THREE.MathUtils.clamp(this.selection + dir, 0, SKYHOP_LEVELS.length - 1);
        if (next !== this.selection) {
          this.selection = next;
          this.game.audio.play('select');
          this.renderPicker();
        }
      }
      this.stickPrev.set(p, dir);
      if (d.aPressed) {
        if (this.selection > this.unlocked) {
          this.game.audio.play('bump');
          continue;
        }
        this.game.audio.play('join');
        if (this.selection === this.levelIndex) {
          this.pickerEl.remove();
          this.startIntro();
        } else {
          const level = this.selection;
          this.state = 'leaving';
          this.game.transition(() => new PlatformerScene(this.game, { key: this.key, level }));
        }
        return;
      }
    }
  }

  // ---------- level ----------

  cell(c, r) {
    return r >= 0 && r < ROWS && c >= 0 && c < this.width ? this.rows[r][c] : '.';
  }

  buildLevel() {
    const s = this.scene;
    const th = this.theme;
    const dirtTiles = [], grassTiles = [];
    for (let r = 0; r < ROWS; r++) {
      let run = -1;
      for (let c = 0; c <= this.width; c++) {
        const ch = this.cell(c, r);
        if (ch === '#') {
          if (run < 0) run = c;
          dirtTiles.push([c, r]);
          if (this.cell(c, r - 1) !== '#') grassTiles.push([c, r]);
        } else if (run >= 0) {
          this.solids.push({ x: run, y: ROWS - 1 - r, w: c - run, h: 1 });
          run = -1;
        }
      }
      let cloud = -1;
      for (let c = 0; c <= this.width; c++) {
        if (this.cell(c, r) === '=') {
          if (cloud < 0) cloud = c;
        } else if (cloud >= 0) {
          this.addCloudPlatform(cloud, ROWS - r, c - cloud);
          cloud = -1;
        }
      }
    }
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < this.width; c++) {
        const ch = this.cell(c, r);
        const x = c + 0.5, y = ROWS - 1 - r;
        if (ch === 'o' || ch === '*') this.addGem(x, y + 0.5, ch === '*');
        else if (ch === '^') this.addSpring(c, y);
        else if (ch === 'M') this.addMover(c, ROWS - r, 'x');
        else if (ch === 'V') this.addMover(c, ROWS - r, 'y');
        else if (ch === 'C') this.addCrumble(c, y);
        else if (ch === 'e') this.addEnemy(x, y);
        else if (ch === 'S') this.spawn = { x, y };
        else if (ch === 'F') this.addFlag(x, y);
      }
    }

    const depth = 3;
    const col = new THREE.Color();
    const m = new THREE.Matrix4();
    const dirt = new THREE.InstancedMesh(sharedGeo('pDirt', () => new THREE.BoxGeometry(1, 1, depth)), toon(0xffffff), dirtTiles.length);
    dirtTiles.forEach(([c, r], i) => {
      m.makeTranslation(c + 0.5, ROWS - 1 - r + 0.5, 0);
      dirt.setMatrixAt(i, m);
      dirt.setColorAt(i, col.set((c + r) % 2 ? th.dirt[0] : th.dirt[1]));
    });
    dirt.receiveShadow = dirt.castShadow = true;
    s.add(dirt);
    const grass = new THREE.InstancedMesh(new RoundedBoxGeometry(1.04, 0.36, depth + 0.1, 2, 0.1), toon(0xffffff), grassTiles.length);
    grassTiles.forEach(([c, r], i) => {
      m.makeTranslation(c + 0.5, ROWS - r - 0.12, 0);
      grass.setMatrixAt(i, m);
      grass.setColorAt(i, col.set(c % 3 ? th.grass[0] : th.grass[1]));
    });
    grass.receiveShadow = grass.castShadow = true;
    s.add(grass);

    const rand = seeded(5 + this.levelIndex);
    for (const [c, r] of grassTiles) {
      if (rand() < 0.3) {
        const f = makeFlower(rand);
        f.position.set(c + rand(), ROWS - r + 0.05, 0.9 + rand() * 0.5);
        s.add(f);
      }
      if (rand() < 0.06 && this.cell(c, r - 1) === '.' && th.prop !== 'tower') {
        const b = makeBush(rand, 0.7);
        b.position.set(c + 0.5, ROWS - r, -1);
        s.add(b);
      }
    }
  }

  addCloudPlatform(c0, top, len) {
    this.solids.push({ x: c0, y: top - 0.4, w: len, h: 0.4, oneWay: true });
    const g = new THREE.Group();
    for (let i = 0; i <= len * 2; i++) {
      const puff = new THREE.Mesh(sharedGeo('cpuff', () => new THREE.SphereGeometry(0.5, 14, 10)), toon(COLORS.cloud));
      puff.position.set(c0 + i * 0.5, top - 0.3 + Math.sin(i * 2.3) * 0.05, (i % 2) * 0.3 - 0.15);
      puff.scale.set(1, 0.6, 1.4);
      puff.castShadow = true;
      g.add(puff);
    }
    this.scene.add(g);
  }

  addSpring(c, y) {
    const solid = { x: c + 0.1, y, w: 0.8, h: 0.5, spring: true, squish: 0 };
    this.solids.push(solid);
    const m = makeMushroom(0xff5d73);
    m.scale.setScalar(0.45);
    m.position.set(c + 0.5, y, 0);
    this.scene.add(m);
    solid.mesh = m;
    this.springs.push(solid);
  }

  addMover(c, top, axis) {
    const solid = { x: c, y: top - 0.4, w: 3, h: 0.4, oneWay: true, dx: 0, dy: 0 };
    this.solids.push(solid);
    const mesh = new THREE.Group();
    const base = new THREE.Mesh(new RoundedBoxGeometry(3, 0.45, 2, 2, 0.15), toon(this.theme.mover));
    const ic = new THREE.Mesh(new RoundedBoxGeometry(3.06, 0.14, 2.06, 2, 0.06), toon(COLORS.icing));
    ic.position.y = 0.2;
    base.castShadow = ic.castShadow = true;
    mesh.add(base, ic);
    if (axis === 'y') {
      for (const sx of [-1, 1]) {
        const arrow = new THREE.Mesh(sharedGeo('liftArrow', () => new THREE.ConeGeometry(0.18, 0.35, 3)), toon(COLORS.white));
        arrow.position.set(sx * 0.9, -0.05, 1.05);
        arrow.rotation.x = Math.PI / 2;
        mesh.add(arrow);
      }
    }
    this.scene.add(mesh);
    this.movers.push({ solid, mesh, axis, base: axis === 'x' ? c : top - 0.4, range: 2.5, phase: this.movers.length * 1.7, speed: 0.9 });
  }

  addCrumble(c, y) {
    const solid = { x: c, y, w: 1, h: 1, crumble: true };
    this.solids.push(solid);
    const mesh = new THREE.Mesh(sharedGeo('crumble', () => new RoundedBoxGeometry(0.96, 0.96, 2.6, 2, 0.12)), toon(0xd7b98a));
    mesh.position.set(c + 0.5, y + 0.5, 0);
    mesh.castShadow = mesh.receiveShadow = true;
    const crack = new THREE.Mesh(sharedGeo('crack', () => new THREE.BoxGeometry(0.5, 0.06, 0.02)), toon(0x8a6a44));
    crack.position.set(0, 0.1, 1.31);
    crack.rotation.z = 0.6;
    mesh.add(crack);
    this.scene.add(mesh);
    this.crumbles.push({ solid, mesh, state: 'idle', t: 0, home: mesh.position.clone() });
  }

  addGem(x, y, big) {
    const mesh = big ? makeStar() : makeGem(GEM_COLORS[this.gems.length % GEM_COLORS.length]);
    if (big) mesh.scale.setScalar(1.3);
    mesh.position.set(x, y, 0);
    this.scene.add(mesh);
    const value = big ? 5 : 1;
    this.totalGems += value;
    this.gems.push({ x, y, mesh, big, value, taken: false });
  }

  addEnemy(x, y) {
    const mesh = makeGrumble(this.theme.enemy);
    this.scene.add(mesh);
    this.enemies.push({ mesh, dir: -1, body: { x, y, w: 0.8, h: 0.85, vx: 0, vy: 0 }, alive: true, squash: 0 });
  }

  addFlag(x, y) {
    const g = new THREE.Group();
    g.position.set(x, y, 0);
    const pole = new THREE.Mesh(sharedGeo('fpole', () => new THREE.CylinderGeometry(0.09, 0.09, 6, 10)), toon(COLORS.white));
    pole.position.y = 3;
    const ball = new THREE.Mesh(sharedGeo('fball', () => new THREE.SphereGeometry(0.22, 12, 10)), toon(COLORS.gold));
    ball.position.y = 6.1;
    const cloth = new THREE.Mesh(sharedGeo('fcloth', () => new THREE.ConeGeometry(0.8, 1.8, 3)), toon(0xff5d73));
    cloth.rotation.z = -Math.PI / 2;
    cloth.position.set(0.95, 5.2, 0);
    const base = new THREE.Mesh(new RoundedBoxGeometry(1.2, 0.4, 1.2, 2, 0.1), toon(COLORS.candyLilac));
    base.position.y = 0.2;
    pole.castShadow = cloth.castShadow = true;
    g.add(pole, ball, cloth, base);
    this.scene.add(g);
    for (let i = 0; i <= 10; i++) {
      const a = (i / 10) * Math.PI;
      const b = new THREE.Mesh(sharedGeo('balloon', () => new THREE.SphereGeometry(0.42, 14, 10)), toon(GEM_COLORS[i % GEM_COLORS.length]));
      b.position.set(x + Math.cos(a) * 3.2, y + Math.sin(a) * 4.2, -1.2);
      b.scale.y = 1.15;
      this.scene.add(b);
    }
    this.flag = { x, y, cloth, group: g };
  }

  makeProp(rand) {
    const th = this.theme;
    if (th.prop === 'lollipop') {
      const g = new THREE.Group();
      const stick = new THREE.Mesh(sharedGeo('lolliStick', () => new THREE.CylinderGeometry(0.08, 0.08, 2.4, 8)), toon(COLORS.white));
      stick.position.y = 1.2;
      const candyCols = [0xff7eb6, 0x8fd8ff, 0xffe47a, 0x9ff0c8, 0xc9a8ff];
      const disc = new THREE.Mesh(sharedGeo('lolliDisc', () => new THREE.CylinderGeometry(0.9, 0.9, 0.25, 24)), toon(candyCols[Math.floor(rand() * candyCols.length)]));
      disc.rotation.x = Math.PI / 2;
      disc.position.y = 2.8;
      const swirl = new THREE.Mesh(sharedGeo('lolliSwirl', () => new THREE.TorusGeometry(0.5, 0.1, 8, 24)), toon(COLORS.white));
      swirl.position.set(0, 2.8, 0.14);
      g.add(stick, disc, swirl);
      g.scale.setScalar(0.9 + rand() * 0.6);
      return g;
    }
    if (th.prop === 'tower') {
      const g = new THREE.Group();
      const h = 3 + rand() * 4;
      const body = new THREE.Mesh(sharedGeo('tower', () => new THREE.CylinderGeometry(1, 1.1, 1, 12)), toon(0xb3a6d6));
      body.scale.set(1, h, 1);
      body.position.y = h / 2;
      const roof = new THREE.Mesh(sharedGeo('towerRoof', () => new THREE.ConeGeometry(1.35, 1.8, 12)), toon(rand() < 0.5 ? 0xff7eb6 : 0x4cc9f0));
      roof.position.y = h + 0.9;
      const win = new THREE.Mesh(sharedGeo('towerWin', () => new THREE.CircleGeometry(0.28, 12)), toon(0xffe47a, { emissive: 0x554400 }));
      win.position.set(0, h * 0.7, 1.02);
      g.add(body, roof, win);
      return g;
    }
    return makeTree(rand, 0.8 + rand() * 0.6, th.leaves);
  }

  buildBackdrop() {
    const s = this.scene;
    const th = this.theme;
    const rand = seeded(12 + this.levelIndex * 7);
    for (let i = 0; i < 26; i++) {
      const r = 5 + rand() * 7;
      const h = new THREE.Mesh(sharedGeo('hill', () => new THREE.SphereGeometry(1, 24, 14)), toon(th.hills[i % 3]));
      h.scale.set(r * 1.3, r, r);
      h.position.set(i * 7 - 10 + rand() * 4, -r * 0.35, -16 - rand() * 14);
      s.add(h);
    }
    for (let i = 0; i < 30; i++) {
      const t = this.makeProp(rand);
      t.position.set(rand() * this.width, 0.5 + rand() * 1.5, -6 - rand() * 6);
      s.add(t);
    }
    for (let i = 0; i < 18; i++) {
      const c = makeCloud(rand, 1.2 + rand() * 1.6);
      c.position.set(rand() * (this.width + 30) - 15, 12 + rand() * 8, -18 - rand() * 12);
      s.add(c);
    }
  }

  // ---------- players ----------

  leader() {
    let best = null;
    for (const e of this.ents) if (e.state === 'play' && (!best || e.body.x > best.body.x)) best = e;
    return best;
  }

  bubbleUp(ent) {
    if (ent.state !== 'play') return;
    ent.state = 'bubble';
    ent.t = 0;
    ent.bubble.visible = true;
    ent.body.vx = ent.body.vy = 0;
    this.game.audio.play('bubble');
  }

  updatePlayers(dt) {
    const half = this.viewHalfSize(this.camDist).w;
    const lead = this.leader();
    for (const ent of this.ents) {
      const b = ent.body;
      const inp = this.input(ent.p) || { x: 0, y: 0, a: false, aPressed: false };
      ent.invuln = Math.max(0, ent.invuln - dt);

      if (ent.state === 'bubble') {
        ent.t += dt;
        const target = lead ? { x: lead.lastSafe.x - 0.8, y: lead.lastSafe.y + 2.4 } : { x: ent.lastSafe.x, y: ent.lastSafe.y + 2 };
        const dx = target.x - b.x, dy = target.y - b.y;
        const d = Math.hypot(dx, dy);
        const sp = Math.min(d / dt, 6 + d * 1.5);
        if (d > 0.01) { b.x += (dx / d) * sp * dt; b.y += (dy / d) * sp * dt; }
        if (ent.t > 1 && (d < 0.5 || (inp.aPressed && ent.t > 1.4))) {
          ent.state = 'play';
          ent.bubble.visible = false;
          ent.invuln = 1.2;
          b.vy = 5;
          this.puffs.burst(new THREE.Vector3(b.x, b.y + 0.6, 0.4), ent.p.color, { count: 10, size: 0.3 });
          this.game.audio.play('pop');
        }
        ent.bubble.position.set(b.x, b.y + 0.55, 0);
        ent.bubble.scale.setScalar(1 + Math.sin(this.time * 7) * 0.05);
        ent.ch.spin += dt * 2;
      } else if (ent.state === 'done') {
        b.vx = 0;
        b.vy = Math.max(PHYS.maxFall, b.vy - PHYS.gravity * dt);
        moveBody(b, dt, this.solids);
        if (b.grounded && Math.random() < dt * 1.5) { b.vy = 9; ent.ch.squash(1.3); }
        ent.facing = 0;
        ent.ch.spin = 0;
      } else {
        ent.ch.spin = 0;
        const ctrl = this.state === 'play' && ent.stun <= 0 ? inp : { x: 0, y: 0, a: false, aPressed: false };
        ent.stun -= dt;
        const j = platformerControl(b, ctrl, dt, PHYS);
        if (j) { ent.ch.squash(1.3); this.game.audio.play(j === 2 ? 'doubleJump' : 'jump'); }
        if (Math.abs(ctrl.x) > 0.2) ent.facing = Math.sign(ctrl.x);
        moveBody(b, dt, this.solids.concat(this.headTops(ent)));
        if (b.justLanded) ent.ch.squash(0.75);
        const g = b.grounded ? b.ground : null;
        if (g?.spring && b.vy <= 0) {
          b.vy = SPRING;
          b.grounded = false;
          g.squish = 1;
          ent.ch.squash(1.45);
          this.game.audio.play('boing');
        }
        if (g?.crumble) {
          const cr = this.crumbles.find((k) => k.solid === g);
          if (cr && cr.state === 'idle') { cr.state = 'shake'; cr.t = 0.45; }
        }
        if (g && !g.oneWay && !g.head && !g.spring && !g.crumble) ent.lastSafe = { x: b.x, y: b.y };
        b.x = THREE.MathUtils.clamp(b.x, 0.4, this.width - 0.4);
        if (b.y < -3) this.bubbleUp(ent);
        if (b.x < this.camX - half - 0.5 || b.x > this.camX + half + 0.5) this.bubbleUp(ent);

        if (this.flag && ent.state === 'play' && Math.abs(b.x - this.flag.x) < 0.8 && b.y < this.flag.y + 6) this.reachFlag(ent);
      }

      ent.ch.faceSide(ent.facing || 1);
      if (ent.state === 'done') ent.ch.targetYaw = 0;
      ent.ch.group.position.set(b.x, b.y, 0);
      ent.ch.group.visible = ent.invuln <= 0 || Math.floor(this.time * 14) % 2 === 0;
      ent.ch.update(dt, { moving: Math.min(1, Math.abs(b.vx) / PHYS.speed), grounded: b.grounded || ent.state === 'bubble', vy: b.vy });
    }
  }

  /** Other players' heads act like little one-way platforms. */
  headTops(self) {
    const out = [];
    for (const e of this.ents) {
      if (e === self || e.state !== 'play') continue;
      out.push({ x: e.body.x - 0.35, y: e.body.y + 1.0, w: 0.7, h: 0.1, oneWay: true, head: true, dx: 0, dy: 0 });
    }
    return out;
  }

  reachFlag(ent) {
    ent.state = 'done';
    this.finishOrder = (this.finishOrder || 0) + 1;
    ent.place = this.finishOrder;
    this.game.audio.play('star');
    this.confetti.burst(new THREE.Vector3(this.flag.x, this.flag.y + 3, 0.5), 0, { count: 30, speed: 7, colors: GEM_COLORS });
    if (!this.firstFinisher) {
      this.firstFinisher = ent;
      this.flag.cloth.material = toon(ent.p.color);
      this.finishTimer = FINISH_TIME;
      if (this.ents.length > 1) this.game.ui.banner(`${ent.p.name} made it!`, 'Everyone to the flag!', 1600);
    }
    if (this.ents.every((e) => e.state === 'done')) this.end();
  }

  updateMovers(dt) {
    for (const mv of this.movers) {
      const v = mv.base + Math.sin(this.time * mv.speed + mv.phase) * mv.range;
      if (mv.axis === 'x') {
        mv.solid.dx = v - mv.solid.x;
        mv.solid.x = v;
      } else {
        mv.solid.dy = v - mv.solid.y;
        mv.solid.y = v;
      }
      mv.mesh.position.set(mv.solid.x + 1.5, mv.solid.y + 0.15, 0);
    }
    for (const sp of this.springs) {
      sp.squish = Math.max(0, sp.squish - dt * 4);
      const k = 1 - Math.sin(sp.squish * Math.PI) * 0.35;
      sp.mesh.scale.set(0.45 * (2 - k), 0.45 * k, 0.45 * (2 - k));
    }
    for (const cr of this.crumbles) {
      if (cr.state === 'shake') {
        cr.t -= dt;
        cr.mesh.position.x = cr.home.x + Math.sin(this.time * 60) * 0.05;
        if (cr.t <= 0) {
          cr.state = 'gone';
          cr.t = 3.5;
          cr.vy = 0;
          this.solids = this.solids.filter((s) => s !== cr.solid);
          for (const e of this.ents) if (e.body.ground === cr.solid) { e.body.grounded = false; e.body.ground = null; }
          this.puffs.burst(cr.home, 0xd7b98a, { count: 6, size: 0.3 });
        }
      } else if (cr.state === 'gone') {
        cr.t -= dt;
        cr.vy -= 30 * dt;
        if (cr.mesh.visible) {
          cr.mesh.position.y += cr.vy * dt;
          if (cr.mesh.position.y < -4) cr.mesh.visible = false;
        }
        const blocked = this.ents.some((e) => e.state === 'play' && overlaps(e.body, cr.solid));
        if (cr.t <= 0 && !blocked) {
          cr.state = 'idle';
          cr.mesh.visible = true;
          cr.mesh.position.copy(cr.home);
          cr.mesh.scale.setScalar(0.01);
          this.solids.push(cr.solid);
        }
      } else if (cr.mesh.scale.x < 1) {
        cr.mesh.scale.setScalar(Math.min(1, cr.mesh.scale.x + dt * 4));
      }
    }
  }

  updateGems(dt) {
    for (const g of this.gems) {
      if (g.taken) continue;
      g.mesh.rotation.y += dt * (g.big ? 2 : 3);
      g.mesh.position.y = g.y + Math.sin(this.time * 3 + g.x) * 0.1;
      for (const e of this.ents) {
        if (e.state !== 'play') continue;
        if (Math.abs(e.body.x - g.x) < 0.75 && g.y > e.body.y - 0.3 && g.y < e.body.y + 1.5) {
          g.taken = true;
          this.scene.remove(g.mesh);
          e.gems += g.value;
          this.teamGems += g.value;
          this.game.audio.play(g.big ? 'star' : 'coin');
          this.confetti.burst(new THREE.Vector3(g.x, g.y, 0.4), 0, { count: g.big ? 24 : 8, speed: 4, size: 0.12, colors: GEM_COLORS });
          break;
        }
      }
    }
  }

  updateEnemies(dt) {
    for (const en of this.enemies) {
      if (!en.alive) {
        en.squash += dt * 3;
        en.mesh.scale.set(1 + en.squash, Math.max(0.05, 1 - en.squash * 2), 1 + en.squash);
        if (en.squash > 0.5 && en.mesh.parent) this.scene.remove(en.mesh);
        continue;
      }
      const b = en.body;
      if (Math.abs(b.x - this.camX) > 30) continue;
      b.vx = en.dir * 2;
      b.vy = Math.max(-16, b.vy - 34 * dt);
      moveBody(b, dt, this.solids);
      if (b.wallHit) en.dir = -b.wallHit;
      if (b.grounded && !solidAt(this.solids, b.x + en.dir * 0.5, b.y - 0.1)) en.dir = -en.dir;
      if (b.y < -4) { en.alive = false; continue; }
      en.mesh.position.set(b.x, b.y, 0);
      en.mesh.rotation.y = en.dir * 0.8;
      en.mesh.userData.body.position.y = 0.45 + Math.abs(Math.sin(this.time * 9 + b.x)) * 0.08;

      for (const e of this.ents) {
        if (e.state !== 'play' || e.invuln > 0) continue;
        const pb = e.body;
        if (!boxesTouch(pb, b, -0.05)) continue;
        if (pb.vy < 0 && pb.y > b.y + 0.35) {
          en.alive = false;
          pb.vy = 12;
          pb.jumps = 0;
          e.stomps++;
          e.gems += 2;
          this.teamGems += 2;
          e.ch.squash(1.3);
          this.game.audio.play('boing');
          this.puffs.burst(new THREE.Vector3(b.x, b.y + 0.4, 0.4), 0xffffff, { count: 10, size: 0.35 });
          this.confetti.burst(new THREE.Vector3(b.x, b.y + 0.6, 0.4), 0, { count: 12, speed: 5, colors: GEM_COLORS });
          break;
        } else {
          const dir = Math.sign(pb.x - b.x) || 1;
          pb.vx = dir * 9;
          pb.vy = 7;
          e.stun = 0.45;
          e.invuln = 1.4;
          this.game.audio.play('bump');
        }
      }
    }
  }

  updateCamera(dt) {
    const active = this.ents.filter((e) => e.state === 'play' || e.state === 'done');
    const xs = active.length ? active.map((e) => e.body.x) : this.ents.map((e) => e.body.x);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const maxDist = this.fitDistance(34, ROWS + 2);
    const minDist = this.fitDistance(22, ROWS + 2);
    const want = THREE.MathUtils.clamp(this.fitDistance(maxX - minX + 8, ROWS + 2), minDist, maxDist);
    this.camDist = THREE.MathUtils.lerp(this.camDist, want, Math.min(1, dt * 2));
    const half = this.viewHalfSize(this.camDist).w;
    let cx = (minX + maxX) / 2;
    if (maxX - minX > half * 2 - 4) cx = maxX - half + 2;
    cx = THREE.MathUtils.clamp(cx, half, this.width - half);
    this.camX = THREE.MathUtils.lerp(this.camX, cx, Math.min(1, dt * 3));
    this.camera.position.set(this.camX, ROWS / 2 + 1.5, this.camDist);
    this.camera.lookAt(this.camX, ROWS / 2 - 0.5, 0);
    this.sun.position.set(this.camX - 15, 30, 20);
    this.sun.target.position.set(this.camX, 0, 0);
    this.confettiOrigin = new THREE.Vector3(this.camX, ROWS / 2, 0);
  }

  end() {
    const ranked = [...this.ents].sort((a, b) => b.gems - a.gems);
    const finished = this.ents.filter((e) => e.state === 'done').length;
    const roster = this.game.roster;
    if (finished > 0 && (roster.progress.skyhop || 0) < this.levelIndex + 1) {
      roster.progress.skyhop = this.levelIndex + 1;
      roster.save();
    }
    this.hasNext = finished > 0 && this.levelIndex + 1 < SKYHOP_LEVELS.length;
    this.finish({
      title: finished === this.ents.length ? 'Everybody made it!' : 'You made it!',
      subtitle: `${this.level.name} · team gems: ${this.teamGems} / ${this.totalGems}`,
      rows: ranked.map((e, i) => ({
        css: e.p.css, name: e.p.name, value: `${e.gems} gems`,
        detail: e.place === 1 ? 'First to the flag!' : `${e.stomps} stomps`,
        crown: i === 0 && e.gems > 0,
      })),
      stars: 3,
      action: this.hasNext ? 'A: next level · B: back to the island' : 'press jump to continue',
    });
  }

  updateResults(dt) {
    if (this.state !== 'results') return false;
    this.resultsDelay -= dt;
    if (this.resultsDelay > 0) return true;
    const inputs = this.players.map((p) => this.input(p)).filter(Boolean);
    if (this.hasNext && inputs.some((d) => d.aPressed)) {
      const level = this.levelIndex + 1;
      this.state = 'leaving';
      this.game.transition(() => new PlatformerScene(this.game, { key: this.key, level }));
    } else if (inputs.some((d) => d.aPressed || (this.hasNext && d.bPressed))) {
      this.state = 'leaving';
      this.game.goHub(this.key);
    }
    return true;
  }

  update(dt) {
    this.updateMovers(dt);
    if (this.state === 'select') {
      this.updatePicker();
      for (const e of this.ents) e.ch.update(dt, {});
      return;
    }
    if (this.state === 'leaving') return;
    this.updatePlayers(dt);
    this.updateCamera(dt);
    if (this.updateResults(dt)) return;
    this.updateGems(dt);
    this.updateEnemies(dt);
    if (this.flag) this.flag.cloth.scale.y = 1 + Math.sin(this.time * 6) * 0.06;
    if (this.theme.falling && Math.random() < dt * 6) {
      const pos = new THREE.Vector3(this.camX + (Math.random() - 0.5) * 30, 15, (Math.random() - 0.5) * 4);
      this.confetti.burst(pos, 0, { count: 1, speed: 0.5, up: 0, gravity: -1.2, life: 6, drag: 0.2, size: 0.25, colors: this.theme.leaves });
    }

    if (this.finishTimer !== null && this.state === 'play') {
      this.finishTimer -= dt;
      if (this.finishTimer <= 0) this.end();
    }
    if (this.state !== 'intro' && this.state !== 'results') {
      const timer = this.finishTimer !== null && this.ents.length > 1 ? `<div class="pill">Flag closes in <b class="big-num" style="font-size:1.3em">${Math.ceil(this.finishTimer)}</b></div>` : '';
      this.game.ui.setTop(`<div class="pill hud-title">${esc(this.level.name)}</div><div class="pill">Gems <b>${this.teamGems}</b> / ${this.totalGems}</div>${timer}`);
    }
    this.game.ui.bar(this.players, (p) => this.ents.find((e) => e.p === p)?.gems ?? 0);
  }
}
