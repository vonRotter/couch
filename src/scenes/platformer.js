import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { MiniGame } from '../core/minigame.js';
import { Character } from '../core/character.js';
import { makeGrumble } from '../core/critters.js';
import { COLORS, PLAYER_COLORS, toon, sharedGeo } from '../core/palette.js';
import { addLights, skyTexture, makeCloud, makeTree, makeFlower, makeBush, makeGem, makeStar, makeMushroom, seeded } from '../core/world.js';
import { moveBody, platformerControl, solidAt, boxesTouch } from '../core/physics2d.js';

const PHYS = {
  speed: 7.5, accel: 60, airAccel: 40, jump: 15.5, jump2: 12.5, doubleJump: true,
  gravity: 38, fallMul: 1.5, coyote: 0.14, buffer: 0.16, maxFall: -20,
};
const SPRING = 24;
const FINISH_TIME = 12;

// Level chunks, 14 rows each. Legend:
// # ground  = cloud (jump up through)  ^ spring  M moving platform
// o gem  * big star  e grumble  S start  F flag
const CHUNKS = [
  [
    '....................',
    '....................',
    '....................',
    '....................',
    '....................',
    '....................',
    '................o...',
    '...............ooo..',
    '....................',
    '..............====..',
    '.......ooo..........',
    '..S.......====......',
    '####################',
    '####################',
  ],
  [
    '....................',
    '....................',
    '.........ooo........',
    '....................',
    '....................',
    '.........===........',
    '....................',
    '....................',
    '...o.o.o............',
    '....................',
    '....................',
    '........^........e..',
    '#####...#####...####',
    '#####...#####...####',
  ],
  [
    '....................',
    '....................',
    '....................',
    '....................',
    '....................',
    '.............*......',
    '....................',
    '.......o............',
    '......###...........',
    '....####............',
    '..######.....M......',
    '.########...........',
    '##########.......###',
    '##########.......###',
  ],
  [
    '....................',
    '....................',
    '....................',
    '....................',
    '....................',
    '..........ooo.......',
    '....................',
    '.........=====......',
    '....................',
    '....................',
    '....===.......===...',
    '.o.o...e.......o.o..',
    '####################',
    '####################',
  ],
  [
    '....................',
    '....................',
    '....................',
    '....................',
    '..........ooo.......',
    '....................',
    '....................',
    '....................',
    '...........M........',
    '....................',
    '.....M..............',
    '..................e.',
    '#####..........#####',
    '#####..........#####',
  ],
  [
    '....................',
    '....................',
    '....................',
    '....................',
    '....................',
    '......*.............',
    '.....###............',
    '....................',
    '...........ooooo....',
    '....................',
    '..####..............',
    '........e....e......',
    '####################',
    '####################',
  ],
  [
    '....................',
    '....................',
    '....................',
    '..............ooo...',
    '....................',
    '.............====...',
    '....................',
    '.........===........',
    '....................',
    '.....===............',
    '....................',
    '.^..................',
    '####################',
    '####################',
  ],
  [
    '....................',
    '....................',
    '....................',
    '....................',
    '....................',
    '....................',
    '....................',
    '..........o.o.o.....',
    '....................',
    '....................',
    '....................',
    '.......e......F.....',
    '####################',
    '####################',
  ],
];

const ROWS = 14;
const LEVEL = Array.from({ length: ROWS }, (_, r) => CHUNKS.map((c) => c[r]).join(''));
const WIDTH = LEVEL[0].length;
const GEM_COLORS = PLAYER_COLORS.map((c) => c.hex);

export class PlatformerScene extends MiniGame {
  constructor(game, opts) {
    super(game, opts);
    this.scene.background = skyTexture('#6cc8ff', '#e6f9ff');
    this.sun = addLights(this.scene, { size: 22 }).sun;

    this.solids = [];
    this.movers = [];
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
    game.audio.playMusic('platformer');
    this.intro('Sky Hop', 'Reach the flag together · fall and you float back in a bubble');
  }

  // ---------- level ----------

  buildLevel() {
    const s = this.scene;
    const cell = (c, r) => (r >= 0 && r < ROWS && c >= 0 && c < WIDTH ? LEVEL[r][c] : '.');
    const dirtTiles = [], grassTiles = [];
    for (let r = 0; r < ROWS; r++) {
      let run = -1;
      for (let c = 0; c <= WIDTH; c++) {
        const ch = cell(c, r);
        if (ch === '#') {
          if (run < 0) run = c;
          dirtTiles.push([c, r]);
          if (cell(c, r - 1) !== '#') grassTiles.push([c, r]);
        } else if (run >= 0) {
          this.solids.push({ x: run, y: ROWS - 1 - r, w: c - run, h: 1 });
          run = -1;
        }
      }
      let cloud = -1;
      for (let c = 0; c <= WIDTH; c++) {
        if (cell(c, r) === '=') {
          if (cloud < 0) cloud = c;
        } else if (cloud >= 0) {
          this.addCloudPlatform(cloud, ROWS - r, c - cloud);
          cloud = -1;
        }
      }
    }
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < WIDTH; c++) {
        const ch = cell(c, r);
        const x = c + 0.5, y = ROWS - 1 - r;
        if (ch === 'o' || ch === '*') this.addGem(x, y + 0.5, ch === '*');
        else if (ch === '^') this.addSpring(c, y);
        else if (ch === 'M') this.addMover(c, ROWS - r);
        else if (ch === 'e') this.addEnemy(x, y);
        else if (ch === 'S') this.spawn = { x, y };
        else if (ch === 'F') this.addFlag(x, y);
      }
    }

    // Instanced ground blocks with a grass cap on exposed tops.
    const depth = 3;
    const dirt = new THREE.InstancedMesh(sharedGeo('pDirt', () => new THREE.BoxGeometry(1, 1, depth)), toon(0xffffff), dirtTiles.length);
    const col = new THREE.Color();
    const m = new THREE.Matrix4();
    dirtTiles.forEach(([c, r], i) => {
      m.makeTranslation(c + 0.5, ROWS - 1 - r + 0.5, 0);
      dirt.setMatrixAt(i, m);
      dirt.setColorAt(i, col.set((c + r) % 2 ? COLORS.dirt : COLORS.dirtDark));
    });
    dirt.receiveShadow = dirt.castShadow = true;
    s.add(dirt);
    const grass = new THREE.InstancedMesh(new RoundedBoxGeometry(1.04, 0.36, depth + 0.1, 2, 0.1), toon(0xffffff), grassTiles.length);
    grassTiles.forEach(([c, r], i) => {
      m.makeTranslation(c + 0.5, ROWS - r - 0.12, 0);
      grass.setMatrixAt(i, m);
      grass.setColorAt(i, col.set(c % 3 ? COLORS.grass : COLORS.grassDark));
    });
    grass.receiveShadow = grass.castShadow = true;
    s.add(grass);

    // Flowers and bushes on top of the ground.
    const rand = seeded(5);
    for (const [c, r] of grassTiles) {
      if (rand() < 0.3) {
        const f = makeFlower(rand);
        f.position.set(c + rand(), ROWS - r + 0.05, 0.9 + rand() * 0.5);
        s.add(f);
      }
      if (rand() < 0.06 && cell(c, r - 1) === '.') {
        const b = makeBush(rand, 0.7);
        b.position.set(c + 0.5, ROWS - r, -1);
        s.add(b);
      }
    }
  }

  addCloudPlatform(c0, top, len) {
    const solid = { x: c0, y: top - 0.4, w: len, h: 0.4, oneWay: true };
    this.solids.push(solid);
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
    const solid = { x: c + 0.1, y, w: 0.8, h: 0.5, spring: true };
    this.solids.push(solid);
    const m = makeMushroom(0xff5d73);
    m.scale.setScalar(0.45);
    m.position.set(c + 0.5, y, 0);
    this.scene.add(m);
    solid.mesh = m;
    solid.squish = 0;
    this.springs = this.springs || [];
    this.springs.push(solid);
  }

  addMover(c, top) {
    const solid = { x: c, y: top - 0.4, w: 3, h: 0.4, oneWay: true, dx: 0, dy: 0 };
    this.solids.push(solid);
    const mesh = new THREE.Group();
    const base = new THREE.Mesh(new RoundedBoxGeometry(3, 0.45, 2, 2, 0.15), toon(COLORS.candyYellow));
    const ic = new THREE.Mesh(new RoundedBoxGeometry(3.06, 0.14, 2.06, 2, 0.06), toon(COLORS.icing));
    ic.position.y = 0.2;
    base.castShadow = ic.castShadow = true;
    mesh.add(base, ic);
    this.scene.add(mesh);
    this.movers.push({ solid, mesh, baseX: c, range: 2.5, phase: this.movers.length * 1.7, speed: 0.9 });
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
    const mesh = makeGrumble(0x2ec4b6);
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
    // Arch of balloons behind the goal.
    for (let i = 0; i <= 10; i++) {
      const a = (i / 10) * Math.PI;
      const b = new THREE.Mesh(sharedGeo('balloon', () => new THREE.SphereGeometry(0.42, 14, 10)), toon(GEM_COLORS[i % GEM_COLORS.length]));
      b.position.set(x + Math.cos(a) * 3.2, y + Math.sin(a) * 4.2, -1.2);
      b.scale.y = 1.15;
      this.scene.add(b);
    }
    this.flag = { x, y, cloth, group: g };
  }

  buildBackdrop() {
    const s = this.scene;
    const rand = seeded(12);
    const hillCols = [0x9be37f, 0x7ed36a, 0xb4ec8f];
    for (let i = 0; i < 26; i++) {
      const r = 5 + rand() * 7;
      const h = new THREE.Mesh(sharedGeo('hill', () => new THREE.SphereGeometry(1, 24, 14)), toon(hillCols[i % 3]));
      h.scale.set(r * 1.3, r, r);
      h.position.set(i * 7 - 10 + rand() * 4, -r * 0.35, -16 - rand() * 14);
      s.add(h);
    }
    for (let i = 0; i < 30; i++) {
      const t = makeTree(rand, 0.8 + rand() * 0.6);
      t.position.set(rand() * WIDTH, 0.5 + rand() * 1.5, -6 - rand() * 6);
      s.add(t);
    }
    for (let i = 0; i < 18; i++) {
      const c = makeCloud(rand, 1.2 + rand() * 1.6);
      c.position.set(rand() * (WIDTH + 30) - 15, 12 + rand() * 8, -18 - rand() * 12);
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
        const solids = this.solids.concat(this.headTops(ent));
        moveBody(b, dt, solids);
        if (b.justLanded) ent.ch.squash(0.75);
        if (b.grounded && b.ground?.spring && b.vy <= 0) {
          b.vy = SPRING;
          b.grounded = false;
          b.ground.squish = 1;
          ent.ch.squash(1.45);
          this.game.audio.play('boing');
        }
        if (b.grounded && b.ground && !b.ground.oneWay && !b.ground.head && !b.ground.spring) {
          ent.lastSafe = { x: b.x, y: b.y };
        }
        b.x = THREE.MathUtils.clamp(b.x, 0.4, WIDTH - 0.4);
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
      const nx = mv.baseX + Math.sin(this.time * mv.speed + mv.phase) * mv.range;
      mv.solid.dx = nx - mv.solid.x;
      mv.solid.x = nx;
      mv.mesh.position.set(nx + 1.5, mv.solid.y + 0.15, 0);
    }
    for (const sp of this.springs || []) {
      sp.squish = Math.max(0, sp.squish - dt * 4);
      const k = 1 - Math.sin(sp.squish * Math.PI) * 0.35;
      sp.mesh.scale.set(0.45 * (2 - k), 0.45 * k, 0.45 * (2 - k));
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
    cx = THREE.MathUtils.clamp(cx, half, WIDTH - half);
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
    this.finish({
      title: finished === this.ents.length ? 'Everybody made it!' : 'You made it!',
      subtitle: `Team gems: ${this.teamGems} / ${this.totalGems}`,
      rows: ranked.map((e, i) => ({
        css: e.p.css, name: e.p.name, value: `${e.gems} gems`,
        detail: e.place === 1 ? 'First to the flag!' : `${e.stomps} stomps`,
        crown: i === 0 && e.gems > 0,
      })),
      stars: 3,
    });
  }

  update(dt) {
    this.updateMovers(dt);
    this.updatePlayers(dt);
    this.updateCamera(dt);
    if (this.updateResults(dt)) return;
    this.updateGems(dt);
    this.updateEnemies(dt);
    if (this.flag) this.flag.cloth.scale.y = 1 + Math.sin(this.time * 6) * 0.06;

    if (this.finishTimer !== null && this.state === 'play') {
      this.finishTimer -= dt;
      if (this.finishTimer <= 0) this.end();
    }
    if (this.state !== 'intro' && this.state !== 'results') {
      const timer = this.finishTimer !== null && this.ents.length > 1 ? `<div class="pill">Flag closes in <b class="big-num" style="font-size:1.3em">${Math.ceil(this.finishTimer)}</b></div>` : '';
      this.game.ui.setTop(`<div class="pill hud-title">Sky Hop</div><div class="pill">Gems <b>${this.teamGems}</b> / ${this.totalGems}</div>${timer}`);
    }
    this.game.ui.bar(this.players, (p) => this.ents.find((e) => e.p === p)?.gems ?? 0);
  }
}

