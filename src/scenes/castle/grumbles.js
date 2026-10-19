import * as THREE from 'three';
import { moveBody, platformerControl } from '../../core/physics2d.js';
import { makeGrumble } from '../../core/critters.js';
import { COLORS, toon, sharedGeo } from '../../core/palette.js';
import { makeStar } from '../../core/world.js';
import { t } from '../../core/i18n.js';
import { makeGrumbleGear, mesh, GRUMBLE_COLORS, FRIEND_COLOR } from './props.js';
import { CASTLE, DOOR, EMPTY, KNIGHT_HP, WOOD, LADDER, PAD, ROWS } from './tilemap.js';

// The grumble army. Knights guard a post and push beans and troopers around with pink foam swords;
// archers stand on the walls and shoot suction-cup arrows; builders put dug-out castle stone back
// and take bean ladders and bridges apart. Bonked grumbles float home in a bubble and come back a
// few times; when a post runs out of grumbles, the last ones simply give up and turn friendly.

const GW = 0.8, GH = 1.25;
const GPHYS = { speed: 3.6, accel: 40, airAccel: 30, jump: 14, jump2: 0, doubleJump: false, gravity: 38, fallMul: 1.6, coyote: 0.1, buffer: 0.12, maxFall: -20 };
const HP = { knight: 3, archer: 2, builder: 2 };
const BUBBLE_TIME = 3;

export class Grumbles {
  constructor(scene, diff) {
    this.scene = scene;
    this.map = scene.map;
    this.diff = diff;
    this.list = [];
    this.friends = 0;
    this.phys = { ...GPHYS, speed: diff.gSpeed };
  }

  add(type, c, r) {
    const color = GRUMBLE_COLORS[type];
    const group = new THREE.Group();
    const pivot = new THREE.Group();
    group.add(pivot);
    const critter = makeGrumble(color);
    critter.scale.setScalar(1.3);
    pivot.add(critter);
    const gear = makeGrumbleGear(type);
    pivot.add(gear);
    this.scene.scene.add(group);
    const bubble = mesh(sharedGeo('kcGBubble', () => new THREE.SphereGeometry(0.95, 20, 14)), toon(color, { transparent: true, opacity: 0.35 }));
    bubble.visible = false;
    this.scene.scene.add(bubble);
    const x = c + 0.5, y = r;
    const g = {
      kind: 'grumble', type, team: 1, group, pivot, critter, gear, bubble, color,
      body: { x, y, w: GW, h: GH, vx: 0, vy: 0, grounded: true },
      home: { x, y }, post: x, state: 'play', hp: HP[type], hits: 0, hitT: 0, invuln: 0, wobble: 0,
      facing: -1, swingT: 0, swingCd: 0, react: 0.5, think: Math.random() * 0.3, goalX: x, target: null,
      jumpHold: 0, stuckT: 0, lastX: x, reserves: this.diff.reserves, respawnT: 0, bub: null,
      fireT: 1 + Math.random() * this.diff.archerRate, work: 0, job: null, jobT: 0, ignore: new Map(), shieldT: 0, aim: 0,
      zone: this.zoneOf(c, r), sq: 1,
      get name() { return t('kc.grumble'); },
    };
    this.list.push(g);
    return g;
  }

  /** The castle a grumble belongs to: the run of castle floor around it, plus a margin. */
  zoneOf(c, r) {
    const m = this.map;
    const floor = (cc) => { for (let rr = r - 1; rr >= 0; rr--) if (m.orig[m.idx(cc, rr)] !== EMPTY) return m.orig[m.idx(cc, rr)] === CASTLE; return false; };
    let c0 = c, c1 = c;
    while (c0 > 0 && floor(c0 - 1)) c0--;
    while (c1 < m.cols - 1 && floor(c1 + 1)) c1++;
    return [c0 - 3, c1 + 3];
  }

  inPlay(g) { return g.state === 'play'; }

  /** Things a grumble can push: beans in play and troopers on the march. */
  targets() {
    const out = [];
    for (const e of this.scene.heroes) if (e.state === 'play') out.push(e);
    for (const tr of this.scene.troopers.list) if (this.scene.troopers.active(tr)) out.push(tr);
    return out;
  }

  /** A foam hit on a grumble. Returns false if it missed (shield, or just hit). */
  hit(g, by, { dir, big = false, melee = false, arrowVx = 0 }) {
    if (g.state !== 'play' || g.invuln > 0) return false;
    if (g.type === 'knight' && g.shieldT > 0) {
      const fromFront = melee && by ? Math.sign(by.body.x - g.body.x) === g.facing : Math.sign(-arrowVx) === g.facing;
      if (fromFront) {
        g.body.vx += dir * 4;
        g.invuln = 0.2;
        this.scene.floater(t('castle.blocked'), new THREE.Vector3(g.body.x, g.body.y + 1.9, 0.5), '#ffffff', 0.7);
        this.scene.game.audio.play('bump');
        return true;
      }
    }
    g.hits++;
    g.hitT = 0;
    g.invuln = 0.3;
    if (big || g.hits >= g.hp) {
      if (by && by.bonks !== undefined) by.bonks++;
      this.scene.floater(t('castle.bonk'), new THREE.Vector3(g.body.x, g.body.y + 2, 0.5), by?.css || '#ffffff', 1.1);
      this.scene.confetti.burst(new THREE.Vector3(g.body.x, g.body.y + 1, 0.5), 0, { count: 16, speed: 6, colors: [g.color, COLORS.white, COLORS.gold], life: 1 });
      this.scene.game.audio.play('pop');
      this.scene.game.audio.play('dizzy');
      this.toBubble(g);
    } else {
      g.body.vx = dir * 9;
      g.body.vy = 6;
      g.wobble = 0.8;
      this.scene.puffs.burst(new THREE.Vector3(g.body.x, g.body.y + 0.8, 0.6), 0xffffff, { count: 6, size: 0.3, life: 0.35 });
      this.scene.game.audio.play('boing');
    }
    return true;
  }

  toBubble(g) {
    g.state = 'bubble';
    g.hits = 0;
    g.job = null;
    g.work = 0;
    g.bub = { x0: g.body.x, y0: g.body.y, x1: g.home.x, y1: g.home.y, t: 0 };
    g.bubble.visible = true;
  }

  updateBubble(g, dt) {
    const B = g.bub, b = g.body;
    B.t += dt / BUBBLE_TIME;
    const k = Math.min(1, B.t), s = k * k * (3 - 2 * k);
    b.x = B.x0 + (B.x1 - B.x0) * s;
    b.y = B.y0 + (B.y1 - B.y0) * s + Math.sin(k * Math.PI) * 4;
    b.vx = b.vy = 0;
    g.bubble.position.set(b.x, b.y + 0.7, 0.2);
    if (B.t >= 1) {
      g.bubble.visible = false;
      g.state = 'rest';
      g.respawnT = this.diff.respawn;
      this.scene.puffs.burst(new THREE.Vector3(b.x, b.y + 0.7, 0.5), g.color, { count: 10, size: 0.35 });
    }
  }

  /** Out of reserves (or the level is won): the grumble cheers up and stops fighting. */
  befriend(g, quiet = false) {
    if (g.state === 'friendly') return;
    if (g.state !== 'rest') {
      g.bubble.visible = false;
      g.body.x = g.home.x;
      g.body.y = g.home.y;
    }
    g.state = 'friendly';
    g.critter.userData.body.material = toon(FRIEND_COLOR, { flat: true });
    g.gear.visible = false;
    if (!g.flower) {
      g.flower = makeStar(0xfff3a0);
      g.flower.scale.setScalar(0.35);
      g.flower.position.set(0.3, 1.25, 0.3);
      g.pivot.add(g.flower);
    }
    this.friends++;
    if (!quiet) {
      this.scene.floater(t('kc.friend'), new THREE.Vector3(g.body.x, g.body.y + 2, 0.5), '#ff6fae', 1.6);
      this.scene.puffs.burst(new THREE.Vector3(g.body.x, g.body.y + 1, 0.5), FRIEND_COLOR, { count: 14, size: 0.4 });
      this.scene.game.audio.play('rescue');
    }
  }

  update(dt, playing) {
    for (const g of this.list) {
      g.invuln = Math.max(0, g.invuln - dt);
      g.wobble = Math.max(0, g.wobble - dt);
      g.swingT = Math.max(0, g.swingT - dt);
      g.swingCd -= dt;
      g.shieldT -= dt;
      g.hitT += dt;
      if (g.hitT > 5) g.hits = 0;
      if (g.state === 'bubble') { this.updateBubble(g, dt); continue; }
      if (g.state === 'rest') {
        if (!playing) continue;
        g.respawnT -= dt;
        if (g.respawnT <= 0) {
          if (g.reserves > 0) {
            g.reserves--;
            g.state = 'play';
            g.invuln = 1;
            g.body.x = g.home.x; g.body.y = g.home.y; g.body.vx = g.body.vy = 0;
            this.scene.puffs.burst(new THREE.Vector3(g.body.x, g.body.y + 0.7, 0.5), g.color, { count: 10, size: 0.35 });
          } else this.befriend(g);
        }
        continue;
      }
      if (g.state === 'friendly') { this.updateFriend(g, dt); continue; }
      let inp = { x: 0, y: 0, a: false, aPressed: false };
      if (playing) {
        if (g.type === 'knight') inp = this.knightInput(g, dt);
        else if (g.type === 'archer') inp = this.archerInput(g, dt);
        else inp = this.builderInput(g, dt);
      }
      if (g.wobble > 0) inp.x *= 0.3;
      const b = g.body;
      platformerControl(b, inp, dt, this.phys);
      moveBody(b, dt, this.scene.solidsAround(b, 1));
      if (Math.abs(inp.x) > 0.2) g.facing = Math.sign(inp.x);
      // A grumble that falls in the water floats home (no reserve lost).
      if (this.scene.inWater(b)) {
        this.scene.puffs.burst(new THREE.Vector3(b.x, b.y + 0.5, 0.5), 0x8fd8ff, { count: 10, size: 0.35 });
        this.toBubble(g);
        g.reserves++;
      }
    }
  }

  // ---------- knights ----------

  knightInput(g, dt) {
    const inp = { x: 0, y: 0, a: false, aPressed: false };
    const b = g.body, d = this.diff;
    g.think -= dt;
    if (g.think <= 0) {
      g.think = 0.3;
      g.target = null;
      let best = 1e9;
      for (const o of this.targets()) {
        if (Math.abs(o.body.x - g.post) > d.leash) continue;
        const dist = Math.hypot(o.body.x - b.x, (o.body.y - b.y) * 1.5);
        if (dist < d.aggro && dist < best) { best = dist; g.target = o; }
      }
      g.goalX = g.target ? g.target.body.x : g.post + Math.sin(this.scene.time * 0.6 + g.home.x) * 1.5;
    }
    g.react -= dt;
    const dx = g.goalX - b.x;
    if (Math.abs(dx) > 0.5) inp.x = Math.sign(dx);
    const tg = g.target;
    if (tg) {
      const tdx = tg.body.x - b.x, tdy = tg.body.y - b.y;
      if (Math.abs(tdx) < 1.5 && Math.abs(tdy) < 1.2) {
        g.facing = Math.sign(tdx) || g.facing;
        if (Math.abs(tdx) < 0.9) inp.x = 0;
        if (g.react <= 0 && g.swingCd <= 0) { this.swing(g); g.react = d.swingGap * (0.8 + Math.random() * 0.5); }
      } else g.react = Math.max(g.react, 0.3);
      if (Math.abs(tdx) < 1.6 && tdy > 1.0 && b.grounded) { inp.aPressed = true; g.jumpHold = 0.35; }
    }
    // Shield up at bean arrows flying in (sometimes).
    for (const a of this.scene.arrows) {
      if (a.state !== 'fly' || a.rope || a.team === 1 || a.seen?.has(g)) continue;
      const adx = b.x - a.x;
      if (Math.abs(adx) < 5 && Math.sign(a.vx) === Math.sign(adx) && Math.abs(a.y - b.y - 0.7) < 2) {
        (a.seen ||= new Set()).add(g);
        if (Math.random() < d.shield) { g.shieldT = 0.6; g.facing = -Math.sign(a.vx); }
      }
    }
    if (g.shieldT > 0) inp.x = 0;
    this.walkSmarts(g, inp, dt);
    return inp;
  }

  /** Jump over low walls; bash bean pieces in the way. */
  walkSmarts(g, inp, dt) {
    const b = g.body;
    g.jumpHold -= dt;
    if (inp.x && b.wallHit && b.grounded) { inp.aPressed = true; g.jumpHold = 0.35; }
    inp.a = g.jumpHold > 0;
    const moved = Math.abs(b.x - g.lastX);
    g.lastX = b.x;
    if (inp.x && moved < 0.01) g.stuckT += dt; else g.stuckT = Math.max(0, g.stuckT - dt * 2);
    if (g.stuckT > 0.8 && b.grounded && g.swingCd <= 0 && g.type === 'knight') {
      const c = Math.floor(b.x + inp.x * 0.9), r0 = Math.floor(b.y + 0.1);
      if ([r0, r0 + 1].some((r) => KNIGHT_HP[this.map.at(c, r)] && this.map.ownerAt(c, r) === 0)) {
        g.facing = inp.x;
        this.swing(g);
      }
    }
    // Hopelessly stuck: give up on the chase for a bit.
    if (g.stuckT > 4) { g.stuckT = 0; g.target = null; g.goalX = g.post; g.think = 3; }
  }

  swing(g) {
    g.swingT = 0.22;
    g.swingCd = 0.45;
    g.sq = 1.15;
    const b = g.body;
    this.scene.game.audio.play('whoosh');
    for (const o of this.targets()) {
      const dx = (o.body.x - b.x) * g.facing, dy = o.body.y - b.y;
      if (dx > -0.3 && dx < 1.55 && Math.abs(dy) < 1.3) {
        if (o.kind === 'trooper') this.scene.troopers.knock(o, g.facing, 7, this.diff.dizzy);
        else this.scene.hitHero(o, g, { dir: g.facing, big: false, melee: true });
      }
    }
    const c = Math.floor(b.x + g.facing * 0.9), r0 = Math.floor(b.y + 0.1);
    for (const r of [r0, r0 + 1]) {
      const ty = this.map.at(c, r);
      if (KNIGHT_HP[ty] && this.map.ownerAt(c, r) === 0) this.scene.damageTile(c, r, 1 / KNIGHT_HP[ty] + 0.001, null);
    }
    this.scene.puffs.burst(new THREE.Vector3(b.x + g.facing, b.y + 0.8, 0.6), 0xffb3d9, { count: 4, size: 0.25, life: 0.3, speed: 3 });
  }

  // ---------- archers ----------

  archerInput(g, dt) {
    const inp = { x: 0, y: 0, a: false, aPressed: false };
    const b = g.body, d = this.diff;
    // Stay on the post; shuffle a little.
    const dx = g.post - b.x;
    if (Math.abs(dx) > 0.6) inp.x = Math.sign(dx);
    g.fireT -= dt;
    g.aim = Math.max(0, g.aim - dt);
    if (g.fireT <= 0) {
      let best = null, bd = 1e9;
      for (const o of this.targets()) {
        const ox = o.body.x - b.x, oy = o.body.y - b.y;
        const dist = Math.hypot(ox, oy);
        if (dist < d.archerRange && Math.abs(ox) > 1.5 && dist < bd && this.scene.lineClear(b.x, b.y + 1, o.body.x, o.body.y + 0.6)) { bd = dist; best = o; }
      }
      if (best) {
        g.facing = Math.sign(best.body.x - b.x) || g.facing;
        this.shoot(g, best);
        g.fireT = d.archerRate * (0.85 + Math.random() * 0.3);
      } else g.fireT = 0.5;
    }
    return inp;
  }

  shoot(g, o) {
    const b = g.body;
    const sx = b.x + g.facing * 0.5, sy = b.y + 0.9;
    const v = 19, grav = 8;
    let tx = o.body.x + o.body.vx * 0.35, ty = o.body.y + 0.6;
    tx += (Math.random() - 0.5) * this.diff.archerSpread;
    const dx = tx - sx, dy = ty - sy;
    const ax = Math.abs(dx);
    const disc = v ** 4 - grav * (grav * ax * ax + 2 * dy * v * v);
    let ang;
    if (disc < 0) ang = Math.PI / 4;
    else ang = Math.atan((v * v - Math.sqrt(disc)) / (grav * ax));
    const vx = Math.sign(dx) * Math.cos(ang) * v, vy = Math.sin(ang) * v;
    this.scene.arrows.push({ owner: g, team: 1, mesh: this.scene.makeArrow(0x3fb8a0), state: 'fly', rope: false, t: 0, x: sx, y: sy, vx, vy });
    g.aim = 0.3;
    g.sq = 0.85;
    this.scene.game.audio.play('dash');
  }

  // ---------- builders ----------

  /** Jobs: castle stone or doors that are gone, and bean pieces inside the castle. */
  findJob(g) {
    const m = this.map, b = g.body;
    const fr = Math.floor(b.y + 0.05);
    let best = null, bd = 1e9;
    for (let c = Math.max(0, g.zone[0]); c <= Math.min(m.cols - 1, g.zone[1]); c++) {
      for (let r = Math.max(1, fr - 1); r <= Math.min(ROWS - 1, fr + 3); r++) {
        const i = m.idx(c, r), ty = m.tile[i], o = m.orig[i];
        let job = null;
        if (ty === EMPTY && (o === CASTLE || o === DOOR)) job = 'fix';
        else if (m.owner[i] === 0 && (ty === WOOD || ty === LADDER || ty === PAD || ty === DOOR)) job = 'take';
        if (!job) continue;
        if ((g.ignore.get(i) || 0) > this.scene.time) continue;
        const d = Math.abs(c + 0.5 - b.x) + Math.abs(r - fr) * 0.3;
        if (d < bd) { bd = d; best = { c, r, i, job }; }
      }
    }
    return best;
  }

  builderInput(g, dt) {
    const inp = { x: 0, y: 0, a: false, aPressed: false };
    const b = g.body, m = this.map;
    g.think -= dt;
    if (g.think <= 0 && !g.job) {
      g.think = 0.5;
      g.job = this.findJob(g);
      g.jobT = 0;
      g.work = 0;
    }
    if (!g.job) {
      const dx = g.post + Math.sin(this.scene.time * 0.5 + g.home.x) * 2 - b.x;
      if (Math.abs(dx) > 0.5) inp.x = Math.sign(dx) * 0.6;
      this.walkSmarts(g, inp, dt);
      return inp;
    }
    const J = g.job;
    g.jobT += dt;
    // The job may have sorted itself out.
    const ty = m.tile[J.i];
    if ((J.job === 'fix' && ty !== EMPTY) || (J.job === 'take' && (m.owner[J.i] !== 0 || ty === EMPTY))) { g.job = null; return inp; }
    const dx = J.c + 0.5 - b.x;
    if (Math.abs(dx) > 1.6 || (Math.abs(dx) < 0.6 && J.r === Math.floor(b.y + 0.05) && J.job === 'fix')) {
      inp.x = Math.abs(dx) < 0.6 ? -g.facing : Math.sign(dx);
    } else {
      g.facing = Math.sign(dx) || g.facing;
      // Not while someone stands in the way.
      const blocked = J.job === 'fix' && this.scene.cellOccupied(J.c, J.r);
      if (!blocked) {
        g.work += dt;
        if (Math.random() < dt * 6) this.scene.puffs.burst(new THREE.Vector3(J.c + 0.5, J.r + 0.5, 0.85), 0xffe2a8, { count: 1, size: 0.22, life: 0.3 });
        if (g.work >= this.diff.repair) {
          if (J.job === 'fix') {
            m.set(J.c, J.r, m.orig[J.i], 1);
            this.scene.puffs.burst(new THREE.Vector3(J.c + 0.5, J.r + 0.5, 0.8), 0xc9c0dd, { count: 6, size: 0.3, life: 0.4 });
            this.scene.game.audio.play('land');
            this.scene.onRepair?.(J);
          } else {
            this.scene.breakTile(J.c, J.r, null);
          }
          g.job = null;
          g.work = 0;
        }
      }
    }
    // Can't get there: try something else for a while.
    if (g.jobT > 6) { g.ignore.set(J.i, this.scene.time + 10); g.job = null; }
    this.walkSmarts(g, inp, dt);
    return inp;
  }

  updateFriend(g, dt) {
    const b = g.body;
    b.vx = 0;
    platformerControl(b, { x: 0, y: 0, a: false, aPressed: false }, dt, this.phys);
    moveBody(b, dt, this.scene.solidsAround(b, 1));
    if (b.grounded && Math.random() < dt * 0.8) { b.vy = 6; b.grounded = false; }
  }

  pose(dt) {
    for (const g of this.list) {
      const b = g.body;
      g.group.position.set(b.x, b.y, g.state === 'friendly' ? -0.3 : 0);
      const cr = g.critter;
      const face = g.state === 'friendly' ? 0 : g.facing * 0.9;
      cr.rotation.y += (face - cr.rotation.y) * Math.min(1, dt * 10);
      g.gear.scale.x = g.facing;
      g.sq += (1 - g.sq) * Math.min(1, dt * 10);
      const hop = b.grounded && Math.abs(b.vx) > 0.5 ? Math.abs(Math.sin(this.scene.time * 12)) * 0.12 : 0;
      g.pivot.position.y = hop;
      g.pivot.scale.set(1 / Math.sqrt(g.sq), g.sq, 1 / Math.sqrt(g.sq));
      g.pivot.rotation.z = Math.sin(this.scene.time * 18) * g.wobble * 0.5 + (g.state === 'bubble' ? this.scene.time * 3 : 0);
      g.group.visible = g.state !== 'rest' && (g.invuln <= 0.4 || Math.floor(this.scene.time * 14) % 2 === 0 || g.hits > 0);
      const G = g.gear.userData;
      if (G.sword) G.sword.rotation.z = g.swingT > 0 ? 1.3 - (1 - g.swingT / 0.22) * 3 : g.shieldT > 0 ? 1.4 : -0.4;
      if (G.hammer) G.hammer.rotation.z = g.work > 0 ? -0.6 + Math.sin(this.scene.time * 26) * 0.8 : -0.3;
      if (G.bow) G.bow.rotation.z = -Math.PI / 2 + (g.aim > 0 ? 0.3 : 0);
    }
  }
}
