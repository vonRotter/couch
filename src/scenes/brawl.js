import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { MiniGame } from '../core/minigame.js';
import { Character } from '../core/character.js';
import { makeGrumble } from '../core/critters.js';
import { COLORS, toon, sharedGeo } from '../core/palette.js';
import { addLights, skyTexture, makeCloud, makeTree, makeRock, seeded } from '../core/world.js';
import { moveBody, approach } from '../core/physics2d.js';
import { esc } from '../core/ui.js';

const STOCKS = 3;
const MATCH_TIME = 150;
const BLAST = { left: -24, right: 24, bottom: -11, top: 24 };
const GLOVE = 0xff3b5c;

const PHYS = {
  speed: 8, accel: 70, airAccel: 38, jump: 15, jump2: 13,
  gravity: 36, fallMul: 1.35, coyote: 0.1, buffer: 0.14, maxFall: -19, airJumps: 2,
};

// Attack definitions. Hitbox offset is relative to the feet, x mirrored by facing.
const ATTACKS = {
  jab: { start: 0.05, end: 0.17, total: 0.28, ox: 1.0, oy: 0.65, r: 0.65, dmg: 7, ax: 0.85, ay: 0.45, base: 5, scale: 0.09 },
  up: { start: 0.06, end: 0.2, total: 0.32, ox: 0.25, oy: 1.5, r: 0.75, dmg: 8, ax: 0.15, ay: 1, base: 6, scale: 0.1 },
  spin: { start: 0.05, end: 0.3, total: 0.4, ox: 0, oy: 0.55, r: 1.15, dmg: 6, ax: 1, ay: 0.55, base: 5, scale: 0.08, radial: true },
  smash: { start: 0.08, end: 0.22, total: 0.42, ox: 1.15, oy: 0.65, r: 0.8, dmg: 12, ax: 0.8, ay: 0.55, base: 7, scale: 0.13 },
};

export class BrawlScene extends MiniGame {
  constructor(game, opts) {
    super(game, opts);
    this.scene.background = skyTexture('#7fb8ff', '#ffe0f0');
    this.lights = addLights(this.scene, { size: 26, target: new THREE.Vector3(0, 3, 0), dir: new THREE.Vector3(-0.4, 1, 0.8) });
    this.solids = [];
    this.respawnClouds = [];
    this.timeLeft = MATCH_TIME;
    this.camPos = new THREE.Vector3(0, 5, 30);
    this.camLook = new THREE.Vector3(0, 4, 0);
    this.buildStage();

    const spots = [-6, 6, -2.5, 2.5, -4, 4];
    this.ents = this.players.map((p, i) => this.makeFighter(p, spots[i % spots.length], i));
    if (this.ents.length === 1) this.ents.push(this.makeFighter(null, 4, 1));

    this.updateCamera(1);
    game.audio.playMusic('paint');
    this.intro('Bonk Brawl', 'B: punch (hold to charge) · up+B: uppercut · down+B: spin · knock friends off the stage!');
  }

  makeFighter(p, x, i) {
    const bot = !p;
    let ch;
    if (bot) {
      ch = { group: makeGrumble(0x2ec4b6), update() {}, faceSide() {}, squash() {}, spin: 0 };
      ch.group.scale.setScalar(1.3);
    } else {
      ch = new Character(p.color, { hat: p.hat });
    }
    this.scene.add(ch.group);
    const glove = new THREE.Group();
    const fist = new THREE.Mesh(sharedGeo('bFist', () => new THREE.SphereGeometry(0.26, 14, 10)), toon(GLOVE));
    fist.scale.set(1.15, 0.95, 1);
    const cuff = new THREE.Mesh(sharedGeo('bCuff', () => new THREE.CylinderGeometry(0.15, 0.17, 0.16, 12)), toon(COLORS.white));
    cuff.rotation.z = Math.PI / 2;
    cuff.position.x = -0.25;
    fist.castShadow = true;
    glove.add(fist, cuff);
    this.scene.add(glove);
    const bubble = new THREE.Mesh(sharedGeo('bbubble', () => new THREE.SphereGeometry(0.85, 22, 16)), toon(p ? p.color : 0x2ec4b6, { transparent: true, opacity: 0.3 }));
    bubble.visible = false;
    this.scene.add(bubble);
    const tag = this.game.ui.label('label');
    tag.style.color = p ? p.css : '#1aa79b';
    return {
      p, bot, ch, glove, bubble, tag, tagPos: new THREE.Vector3(),
      name: p ? p.name : 'Bonk Bot', css: p ? p.css : '#2ec4b6',
      body: { x, y: 1, w: 0.75, h: 1.15, vx: 0, vy: 0, grounded: true },
      facing: x < 0 ? 1 : -1, damage: 0, stocks: STOCKS, state: 'play',
      attack: null, atkT: 0, hitSet: null, charge: 0, charging: false,
      hitstun: 0, invuln: 0, respawnT: 0, kos: 0, falls: 0, pushCd: 0,
      airJumps: PHYS.airJumps, botT: 0, botDir: 1, index: i,
    };
  }

  buildStage() {
    const s = this.scene;
    // Main floating island.
    this.solids.push({ x: -10, y: -1, w: 20, h: 2 });
    const island = new THREE.Mesh(new RoundedBoxGeometry(20, 2, 5, 3, 0.4), toon(COLORS.dirt));
    island.position.set(0, 0, 0);
    island.castShadow = island.receiveShadow = true;
    const grass = new THREE.Mesh(new RoundedBoxGeometry(20.3, 0.45, 5.3, 3, 0.2), toon(COLORS.grass));
    grass.position.set(0, 0.85, 0);
    grass.receiveShadow = true;
    s.add(island, grass);
    for (let i = 0; i < 7; i++) {
      const cone = new THREE.Mesh(sharedGeo('underCone', () => new THREE.ConeGeometry(1, 1, 7)), toon(i % 2 ? COLORS.dirtDark : COLORS.dirt));
      const r = 1.2 + Math.sin(i * 2.1) * 0.5;
      cone.scale.set(r, 2.5 + Math.cos(i * 1.7) * 1.2, r);
      cone.rotation.x = Math.PI;
      cone.position.set(-8 + i * 2.7, -1 - cone.scale.y / 2, Math.sin(i) * 0.8);
      s.add(cone);
    }
    // One-way platforms.
    const plat = (x0, x1, top, color) => {
      this.solids.push({ x: x0, y: top - 0.4, w: x1 - x0, h: 0.4, oneWay: true });
      const m = new THREE.Mesh(new RoundedBoxGeometry(x1 - x0, 0.45, 2.6, 2, 0.15), toon(color));
      m.position.set((x0 + x1) / 2, top - 0.2, 0);
      m.castShadow = m.receiveShadow = true;
      const ic = new THREE.Mesh(new RoundedBoxGeometry(x1 - x0 + 0.06, 0.14, 2.66, 2, 0.06), toon(COLORS.icing));
      ic.position.set((x0 + x1) / 2, top + 0.02, 0);
      s.add(m, ic);
    };
    plat(-7, -2.5, 4.5, COLORS.candyBlue);
    plat(2.5, 7, 4.5, COLORS.candyPink);
    plat(-2.2, 2.2, 8, COLORS.candyYellow);

    const rand = seeded(77);
    for (let i = 0; i < 5; i++) {
      const t = makeTree(rand, 0.7 + rand() * 0.3);
      t.position.set(-8 + i * 4 + rand(), 1, -2.3);
      s.add(t);
    }
    // Distant floating islands and clouds.
    for (let i = 0; i < 8; i++) {
      const g = new THREE.Group();
      const top = new THREE.Mesh(sharedGeo('farIsle', () => new THREE.CylinderGeometry(3, 2.6, 1, 10)), toon(COLORS.grass));
      const under = new THREE.Mesh(sharedGeo('farIsleUnder', () => new THREE.ConeGeometry(2.6, 4, 10)), toon(COLORS.dirt));
      under.rotation.x = Math.PI;
      under.position.y = -2.5;
      g.add(top, under);
      const t = makeTree(rand, 0.8);
      t.position.y = 0.5;
      g.add(t);
      g.position.set(-45 + i * 13 + rand() * 4, -6 + rand() * 18, -30 - rand() * 15);
      g.scale.setScalar(0.8 + rand() * 0.8);
      s.add(g);
    }
    for (let i = 0; i < 10; i++) {
      const c = makeCloud(rand, 1.5 + rand() * 1.5);
      c.position.set(-50 + i * 11, -10 + rand() * 30, -20 - rand() * 20);
      s.add(c);
    }
    const rock = makeRock(rand, 0.8);
    rock.position.set(7.5, 1.2, 1.5);
    s.add(rock);
  }

  // ---------- combat ----------

  startAttack(e, kind) {
    e.attack = ATTACKS[kind];
    e.attackKind = kind;
    e.atkT = 0;
    e.hitSet = new Set();
    if (kind === 'smash') {
      const k = Math.min(1, e.charge);
      e.attackPower = { dmg: 10 + 12 * k, base: 7 + 5 * k, scale: 0.12 + 0.03 * k };
    } else {
      e.attackPower = null;
    }
    if (kind === 'up' && !e.body.grounded) e.body.vy = Math.max(e.body.vy, 8);
    this.game.audio.play('dash');
  }

  updateAttack(e, dt) {
    const A = e.attack;
    if (!A) return;
    e.atkT += dt;
    if (e.atkT >= A.start && e.atkT <= A.end) {
      const hx = e.body.x + A.ox * e.facing, hy = e.body.y + A.oy;
      for (const o of this.ents) {
        if (o === e || o.state !== 'play' || o.invuln > 0 || e.hitSet.has(o)) continue;
        const cx = o.body.x, cy = o.body.y + 0.6;
        if (Math.hypot(cx - hx, cy - hy) < A.r + 0.45) {
          e.hitSet.add(o);
          const pw = e.attackPower || A;
          const dirX = A.radial ? Math.sign(cx - e.body.x) || e.facing : e.facing;
          this.hit(o, e, pw.dmg, dirX * A.ax, A.ay, pw.base, pw.scale);
        }
      }
    }
    if (e.atkT >= A.total) e.attack = null;
  }

  hit(target, by, dmg, ax, ay, base, scale) {
    target.damage = Math.min(999, target.damage + dmg);
    const kb = base + target.damage * scale;
    const len = Math.hypot(ax, ay) || 1;
    target.body.vx = (ax / len) * kb;
    target.body.vy = (ay / len) * kb;
    target.body.grounded = false;
    target.hitstun = 0.12 + kb * 0.022;
    target.attack = null;
    target.charging = false;
    target.lastHitBy = by;
    target.ch.squash(0.7);
    const pos = new THREE.Vector3(target.body.x, target.body.y + 0.7, 0.5);
    this.confetti.burst(pos, 0, { count: 8 + Math.floor(kb), speed: 3 + kb * 0.3, size: 0.15, colors: [COLORS.gold, COLORS.white, GLOVE] });
    this.puffs.burst(pos, 0xffffff, { count: 5, size: 0.3, life: 0.35, gravity: 0 });
    this.game.audio.play(kb > 14 ? 'boing' : 'bump');
    if (kb > 16) this.shake = 0.25;
  }

  knockOut(e) {
    e.stocks--;
    e.falls++;
    if (e.lastHitBy && e.lastHitBy !== e) e.lastHitBy.kos++;
    const cx = THREE.MathUtils.clamp(e.body.x, BLAST.left + 3, BLAST.right - 3);
    const cy = THREE.MathUtils.clamp(e.body.y, BLAST.bottom + 3, BLAST.top - 3);
    this.confetti.burst(new THREE.Vector3(cx, cy, 0.5), 0, { count: 40, speed: 10, colors: [e.p ? e.p.color : 0x2ec4b6, COLORS.gold, COLORS.white], life: 1.2 });
    this.game.audio.play('pop');
    this.game.audio.play('whoosh');
    this.shake = 0.3;
    e.state = 'out';
    e.respawnT = 1.4;
    e.attack = null;
    e.ch.group.visible = false;
    e.glove.visible = false;
    if (e.stocks <= 0 && !e.bot) this.game.ui.toast(`${e.name} is a bubble ghost now!`);
  }

  respawn(e) {
    e.damage = 0;
    e.hitstun = 0;
    e.lastHitBy = null;
    e.body.vx = e.body.vy = 0;
    const x = (e.index % 2 ? 1 : -1) * (1 + (e.index % 3) * 2);
    e.body.x = x;
    e.body.y = 12;
    e.ch.group.visible = true;
    if (e.stocks > 0) {
      e.state = 'play';
      e.invuln = 2.2;
      const cloud = makeCloud(Math.random, 0.7);
      cloud.position.set(x, 11.6, 0);
      this.scene.add(cloud);
      const solid = { x: x - 1.2, y: 11.6, w: 2.4, h: 0.4, oneWay: true };
      this.solids.push(solid);
      this.respawnClouds.push({ cloud, solid, t: 3.5, owner: e });
      e.body.y = 12;
    } else if (e.bot) {
      e.state = 'gone';
      e.ch.group.visible = false;
    } else {
      e.state = 'ghost';
      e.bubble.visible = true;
      e.body.y = 9;
    }
  }

  // ---------- update ----------

  updateFighter(e, dt) {
    const b = e.body;
    const inp = e.bot ? this.botInput(e, dt) : this.input(e.p) || { x: 0, y: 0, a: false, b: false, aPressed: false, bPressed: false };
    const playing = this.state === 'play';
    e.invuln = Math.max(0, e.invuln - dt);
    e.pushCd -= dt;

    if (e.state === 'out') {
      e.respawnT -= dt;
      if (e.respawnT <= 0) this.respawn(e);
      return;
    }
    if (e.state === 'gone') return;

    if (e.state === 'ghost') {
      b.vx = approach(b.vx, inp.x * 7, 30 * dt);
      b.vy = approach(b.vy, inp.y * 7, 30 * dt);
      b.x = THREE.MathUtils.clamp(b.x + b.vx * dt, BLAST.left + 4, BLAST.right - 4);
      b.y = THREE.MathUtils.clamp(b.y + b.vy * dt, -4, 18);
      if (playing && inp.bPressed && e.pushCd <= 0) {
        e.pushCd = 1;
        this.game.audio.play('bubble');
        this.puffs.burst(new THREE.Vector3(b.x, b.y + 0.6, 0.5), e.p.color, { count: 10, size: 0.3, gravity: 0, life: 0.4 });
        for (const o of this.ents) {
          if (o.state !== 'play' || o.invuln > 0) continue;
          const dx = o.body.x - b.x, dy = o.body.y - b.y;
          const d = Math.hypot(dx, dy);
          if (d < 2.2) { o.body.vx += (dx / (d || 1)) * 6; o.body.vy += 4; o.hitstun = 0.15; }
        }
      }
      e.bubble.position.set(b.x, b.y + 0.55, 0);
      e.ch.group.position.set(b.x, b.y, 0);
      e.ch.spin += dt * 2;
      e.ch.faceSide(b.vx >= 0 ? 1 : -1);
      e.ch.update(dt, { grounded: false });
      e.glove.visible = false;
      return;
    }

    // Fighting.
    const canAct = playing && e.hitstun <= 0;
    if (e.hitstun > 0) {
      e.hitstun -= dt;
      b.vx *= Math.max(0, 1 - 0.8 * dt);
      b.vy = Math.max(PHYS.maxFall, b.vy - PHYS.gravity * 0.75 * dt);
    } else {
      const acc = b.grounded ? PHYS.accel : PHYS.airAccel;
      const tx = canAct && !e.charging ? inp.x * PHYS.speed : 0;
      b.vx = approach(b.vx, tx, acc * dt);
      if (b.grounded) { e.airJumps = PHYS.airJumps; e.coyote = PHYS.coyote; } else e.coyote = (e.coyote || 0) - dt;
      if (canAct && inp.aPressed) {
        if (b.grounded && b.ground?.oneWay && inp.y < -0.5) {
          b.dropTimer = 0.25;
        } else if (e.coyote > 0) {
          b.vy = PHYS.jump; e.coyote = 0; e.ch.squash(1.3); this.game.audio.play('jump');
        } else if (e.airJumps > 0) {
          e.airJumps--; b.vy = PHYS.jump2; e.ch.squash(1.3); this.game.audio.play('doubleJump');
        }
      }
      // Holding jump while falling floats a little: easier recovery.
      const floaty = inp.a && b.vy < 0 ? 0.45 : 1;
      const g = b.vy < 0 || !inp.a ? PHYS.gravity * PHYS.fallMul * floaty : PHYS.gravity;
      b.vy = Math.max(PHYS.maxFall * (floaty < 1 ? 0.45 : 1), b.vy - g * dt);
      if (canAct && Math.abs(inp.x) > 0.2 && !e.attack) e.facing = Math.sign(inp.x);

      // Attacks: tap B for quick moves, hold to charge a smash.
      if (canAct && !e.attack) {
        if (inp.bPressed) { e.charging = true; e.charge = 0; e.chargeDir = { x: inp.x, y: inp.y }; }
        if (e.charging) {
          if (inp.b) {
            e.charge += dt;
          } else {
            e.charging = false;
            const dir = e.chargeDir;
            if (e.charge > 0.3) this.startAttack(e, 'smash');
            else if (dir.y > 0.5) this.startAttack(e, 'up');
            else if (dir.y < -0.5) this.startAttack(e, 'spin');
            else this.startAttack(e, 'jab');
            e.charge = Math.min(1, e.charge);
          }
        }
      }
    }
    this.updateAttack(e, dt);

    moveBody(b, dt, this.solids);
    if (b.justLanded) e.ch.squash(0.75);
    if (b.x < BLAST.left || b.x > BLAST.right || b.y < BLAST.bottom || b.y > BLAST.top) {
      this.knockOut(e);
      return;
    }

    e.ch.faceSide(e.facing);
    e.ch.spin = e.attackKind === 'spin' && e.attack ? (e.atkT / e.attack.total) * Math.PI * 2 : 0;
    e.ch.group.position.set(b.x, b.y, 0);
    e.ch.group.visible = e.invuln <= 0 || Math.floor(this.time * 14) % 2 === 0;
    e.ch.update(dt, { moving: Math.min(1, Math.abs(b.vx) / PHYS.speed), grounded: b.grounded, vy: b.vy });
    if (e.bot) e.ch.group.rotation.y = e.facing * 0.8;

    // Glove position follows the current move.
    const g = e.glove;
    g.visible = e.ch.group.visible;
    let gx = 0.55 * e.facing, gy = 0.55, scale = 1;
    if (e.charging && e.charge > 0.12) {
      gx = -0.3 * e.facing + Math.sin(this.time * 50) * 0.04;
      scale = 1 + Math.min(1, e.charge) * 0.8;
    }
    if (e.attack) {
      const A = e.attack;
      const k = Math.min(1, e.atkT / A.start);
      const out = e.atkT < A.end ? k : 1 - (e.atkT - A.end) / (A.total - A.end);
      if (e.attackKind === 'spin') {
        const ang = (e.atkT / A.total) * Math.PI * 4;
        gx = Math.cos(ang) * 1.0; gy = 0.55;
      } else {
        gx = THREE.MathUtils.lerp(0.55 * e.facing, A.ox * e.facing, out);
        gy = THREE.MathUtils.lerp(0.55, A.oy, out);
      }
      if (e.attackKind === 'smash') scale = 1.6;
    }
    g.position.set(b.x + gx, b.y + gy, 0.45);
    g.scale.set(scale * (e.facing >= 0 ? 1 : -1), scale, scale);
  }

  botInput(e, dt) {
    e.botT -= dt;
    if (e.botT <= 0) {
      e.botT = 0.8 + Math.random() * 1.2;
      e.botDir = Math.random() < 0.5 ? -1 : 1;
      if (Math.abs(e.body.x) > 6) e.botDir = -Math.sign(e.body.x);
    }
    const lost = e.body.y < 0.5 && Math.abs(e.body.x) > 9.5;
    return {
      x: lost ? -Math.sign(e.body.x) : e.botDir * 0.6, y: 0,
      a: lost, aPressed: (lost && e.body.vy < 0) || Math.random() < dt * 0.4, b: false, bPressed: false,
    };
  }

  updateCamera(dt) {
    const pts = this.ents.filter((e) => e.state === 'play' || e.state === 'ghost').map((e) => e.body);
    let minX = -9, maxX = 9, minY = -1, maxY = 9;
    for (const b of pts) {
      minX = Math.min(minX, b.x - 2); maxX = Math.max(maxX, b.x + 2);
      minY = Math.min(minY, b.y - 1); maxY = Math.max(maxY, b.y + 2.5);
    }
    minX = Math.max(minX, BLAST.left + 2); maxX = Math.min(maxX, BLAST.right - 2);
    minY = Math.max(minY, BLAST.bottom + 2); maxY = Math.min(maxY, BLAST.top - 2);
    const d = THREE.MathUtils.clamp(this.fitDistance(maxX - minX + 4, maxY - minY + 6), 18, 46);
    const target = new THREE.Vector3((minX + maxX) / 2, (minY + maxY) / 2 + 0.5, d);
    const k = Math.min(1, dt * 2.5);
    this.camPos.lerp(target, k);
    this.camLook.lerp(new THREE.Vector3(target.x, target.y - 0.6, 0), k);
    this.camera.position.copy(this.camPos);
    if (this.shake > 0) {
      this.shake -= dt;
      this.camera.position.x += (Math.random() - 0.5) * this.shake * 1.5;
      this.camera.position.y += (Math.random() - 0.5) * this.shake * 1.5;
    }
    this.camera.lookAt(this.camLook);
    this.confettiOrigin = new THREE.Vector3(this.camLook.x, this.camLook.y + 2, 0);
  }

  checkEnd() {
    if (this.state !== 'play') return;
    const fighters = this.ents.filter((e) => !e.bot);
    const alive = fighters.filter((e) => e.stocks > 0);
    const bot = this.ents.find((e) => e.bot);
    if (fighters.length > 1 && alive.length <= 1) this.end();
    else if (fighters.length === 1 && (alive.length === 0 || (bot && bot.stocks <= 0))) this.end();
  }

  end() {
    const ranked = [...this.ents].sort((a, b) => b.stocks - a.stocks || a.damage - b.damage || b.kos - a.kos);
    const top = ranked[0];
    this.later(0, () => {
      for (const e of this.ents) { e.tag.style.display = 'none'; e.glove.visible = false; }
    });
    this.finish({
      title: top.bot ? 'Bonk Bot wins this time!' : `${top.name} wins!`,
      subtitle: 'Last one on the island',
      rows: ranked.map((e, i) => ({
        css: e.css, name: e.name, value: e.stocks > 0 ? `${e.stocks} left` : 'Ghost',
        detail: `${e.kos} bonks · ${e.falls} falls`, crown: i === 0,
      })),
      stars: 2,
    });
  }

  update(dt) {
    for (const e of this.ents) this.updateFighter(e, dt);
    for (const rc of this.respawnClouds) {
      rc.t -= dt;
      const onIt = rc.owner.body.grounded && rc.owner.body.ground === rc.solid;
      if (rc.t <= 0 || (!onIt && rc.t < 3.2)) {
        rc.dead = true;
        this.scene.remove(rc.cloud);
        this.solids = this.solids.filter((s) => s !== rc.solid);
      }
    }
    this.respawnClouds = this.respawnClouds.filter((r) => !r.dead);
    this.updateCamera(dt);

    for (const e of this.ents) {
      const show = (e.state === 'play' || e.state === 'ghost') && this.state !== 'results';
      e.tag.style.display = show ? '' : 'none';
      if (!show) continue;
      const pct = Math.round(e.damage);
      const heat = Math.min(1, e.damage / 120);
      const col = e.state === 'ghost' ? '#9a94b2' : `hsl(${Math.round(50 - heat * 50)}, 95%, ${Math.round(48 - heat * 8)}%)`;
      const dots = '●'.repeat(Math.max(0, e.stocks));
      e.tag.innerHTML = e.state === 'ghost' ? 'ghost' : `<span style="color:${col}">${pct}%</span><small style="color:${e.css}">${dots}</small>`;
      e.tagPos.set(e.body.x, e.body.y + 2.3, 0);
      this.game.ui.place(e.tag, e.tagPos, this.camera);
    }

    if (this.updateResults(dt)) return;
    if (this.state === 'play') {
      this.timeLeft -= dt;
      this.checkEnd();
      if (this.timeLeft <= 0 && this.state === 'play') { this.timeLeft = 0; this.end(); }
    }
    if (this.state !== 'intro' && this.state !== 'results') {
      const m = Math.floor(Math.ceil(this.timeLeft) / 60), s = Math.ceil(this.timeLeft) % 60;
      this.game.ui.setTop(`<div class="pill"><span class="big-num">${m}:${String(s).padStart(2, '0')}</span></div><div class="pill hud-title">Bonk Brawl</div>`);
    }
    this.game.ui.bar(this.players, (p) => {
      const e = this.ents.find((x) => x.p === p);
      return e ? esc(e.stocks > 0 ? `${'●'.repeat(e.stocks)} ${Math.round(e.damage)}%` : 'ghost') : '';
    });
  }
}

