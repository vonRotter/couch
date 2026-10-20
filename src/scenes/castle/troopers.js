import * as THREE from 'three';
import { moveBody, platformerControl, approach } from '../../core/physics2d.js';
import { sharedGeo, toon } from '../../core/palette.js';
import { makeStar } from '../../core/world.js';
import { t } from '../../core/i18n.js';
import { makeTrooper, mesh, TROOPER_COLOR } from './props.js';
import { WATER, LADDER, GATE, DOOR } from './tilemap.js';

// Bean troopers march to the Golden Bean flag on their own. They hop up 1-tile steps, float down
// any drop on a leaf parachute, climb ladders, and wait (and call for help) at water, high walls,
// closed gates and grumble doors. They are soldiers too: foam-sword troopers charge grumbles and
// swing (after a little wind-up), archer troopers shoot suction-cup arrows (over walls, up at
// towers), shield bearers block arrows and bash. Foam hits push and wobble; three hits (or a big
// one) and a trooper floats back to the last tent in a bubble, then marches again.

const TW = 0.6, TH = 1.1;
const TPHYS = { speed: 2.3, accel: 30, airAccel: 12, jump: 10.6, jump2: 0, doubleJump: false, gravity: 38, fallMul: 1.2, coyote: 0.08, buffer: 0.1, maxFall: -20 };
const CLIMB = 2.8;
const SPAWN_EVERY = 2.2;
const NO = { x: 0, y: 0, a: false, aPressed: false };
const TYPES = ['sword', 'sword', 'archer', 'shield', 'sword', 'archer'];
const MAX_HITS = 3;
const WIND = { sword: 0.32, shield: 0.38 }; // wind-up before a swing (readable)
const ARROW_V = 18, ARROW_G = 8;

export class Troopers {
  constructor(scene, { camp, flag, count }) {
    this.scene = scene;
    this.map = scene.map;
    this.camp = camp;
    this.flag = flag;
    this.list = [];
    this.toSpawn = count;
    this.spawnT = 0.5;
    this.home = 0;
    this.labels = [];
  }

  make(x, y, state = 'march', type = TYPES[this.list.length % TYPES.length]) {
    const ch = makeTrooper(this.list.length, type);
    this.scene.scene.add(ch.group);
    const bubble = mesh(sharedGeo('kcTBubble', () => new THREE.SphereGeometry(0.75, 18, 12)), toon(0xbfeaff, { transparent: true, opacity: 0.4 }));
    bubble.visible = false;
    this.scene.scene.add(bubble);
    const tr = {
      kind: 'trooper', team: 0, ch, bubble, state, why: '', dir: 1,
      body: { x, y, w: TW, h: TH, vx: 0, vy: 0, grounded: true },
      dizzy: 0, think: 0, lastSafe: { x, y }, bub: null, homeT: 0, invuln: 0, waitT: 0,
      type, hits: 0, hitT: 0, cd: Math.random(), windT: 0, swingT: 0, drawT: 0, foe: null, foeT: 0, wobble: 0, bonks: 0, bonked: 0,
      css: '#fff3dc', get name() { return t('kc.trooper'); },
    };
    this.list.push(tr);
    return tr;
  }

  /** Troopers in cages: idle until the cage breaks. */
  caged(x, y) {
    const tr = this.make(x, y, 'caged');
    tr.body.grounded = true;
    return tr;
  }

  release(tr) {
    tr.state = 'march';
    tr.body.vy = 7;
    tr.body.vx = 1.5;
    tr.lastSafe = { x: tr.body.x, y: tr.body.y };
    tr.ch.squash(1.3);
  }

  /** Active = on the field and able to be pushed around. */
  active(tr) {
    return tr.state === 'march' || tr.state === 'wait' || tr.state === 'climb' || tr.state === 'dizzy' || tr.state === 'fight';
  }

  get activeList() {
    return this.list.filter((tr) => this.active(tr));
  }

  get total() {
    return this.list.length + this.toSpawn;
  }

  /**
   * A grumble swing, arrow or pillow. Shield bearers block from the front; otherwise a push, a
   * wobble and a hit pip. Three pips (or a big hit) and the trooper floats back to a tent.
   */
  knock(tr, dir, power = 7, dizzy = 0.6, { big = false, from = null } = {}) {
    if (!this.active(tr) || tr.invuln > 0) return false;
    const b = tr.body;
    if (tr.type === 'shield' && tr.windT <= 0 && from !== null && Math.sign(from - b.x) === this.faceOf(tr) && Math.random() < 0.75) {
      b.vx += dir * 3;
      tr.invuln = 0.25;
      this.scene.floater(t('castle.blocked'), new THREE.Vector3(b.x, b.y + 1.7, 0.5), '#ffffff', 0.6);
      this.scene.puffs.burst(new THREE.Vector3(b.x + this.faceOf(tr) * 0.4, b.y + 0.6, 0.6), 0xffffff, { count: 5, size: 0.25, life: 0.3 });
      this.scene.game.audio.play('bump');
      return true;
    }
    tr.hits++;
    tr.hitT = 0;
    tr.windT = tr.drawT = 0;
    if (big || tr.hits >= MAX_HITS) { this.bonk(tr); return true; }
    tr.state = 'dizzy';
    tr.dizzy = dizzy;
    tr.wobble = 0.8;
    b.vx = dir * power;
    b.vy = 5;
    tr.invuln = 0.5;
    tr.ch.squash(0.7);
    this.scene.puffs.burst(new THREE.Vector3(b.x, b.y + 0.7, 0.6), 0xffffff, { count: 5, size: 0.25, life: 0.3 });
    this.scene.game.audio.play('boing');
    return true;
  }

  /** Bonked: float back to the last tent behind (or the camp) and march again from there. */
  bonk(tr) {
    const b = tr.body;
    tr.bonked++;
    this.scene.floater(t('castle.bonk'), new THREE.Vector3(b.x, b.y + 1.8, 0.5), '#ffffff', 1);
    this.scene.confetti.burst(new THREE.Vector3(b.x, b.y + 0.8, 0.5), 0, { count: 12, speed: 5, colors: [0xfff3dc, 0x4c7fd8, 0xffd23f], life: 0.9 });
    this.scene.game.audio.play('pop');
    const dest = this.scene.trooperRespawn(b.x);
    tr.state = 'bubble';
    tr.hits = 0;
    tr.foe = null;
    tr.ch.leaf.visible = false;
    tr.bub = { x0: b.x, y0: b.y, x1: dest.x, y1: dest.y, t: 0, time: 3 };
  }

  faceOf(tr) {
    return tr.state === 'fight' && tr.foe ? Math.sign(tr.foe.body.x - tr.body.x) || tr.dir : tr.dir;
  }

  // ---------- fighting ----------

  /** Look for a foe five times a second; true while there is one to fight. */
  engaged(tr, dt) {
    tr.foeT -= dt;
    if (tr.foeT <= 0 || (tr.foe && tr.foe.state !== 'play')) {
      tr.foeT = 0.2;
      // Finish a swing or a shot that is already winding up.
      if (!(tr.windT > 0 || tr.drawT > 0) || tr.foe?.state !== 'play') {
        const was = tr.foe;
        tr.foe = this.pickFoe(tr);
        if (tr.foe !== was) { tr.engageT = 0; tr.foeHits = tr.foe ? tr.foe.hits : 0; }
      }
    }
    // A fight that goes nowhere (a grumble out of reach up on a wall): march on for a while.
    if (tr.foe) {
      if (tr.foe.hits !== tr.foeHits) { tr.foeHits = tr.foe.hits; tr.engageT = Math.min(tr.engageT, 4); }
      tr.engageT = (tr.engageT || 0) + dt;
      if (tr.engageT > 7) { tr.ignore = tr.foe; tr.ignoreT = this.scene.time + 10; tr.foe = null; tr.windT = tr.drawT = 0; }
    }
    return !!tr.foe;
  }

  /** The grumble this trooper should fight right now (or null). */
  pickFoe(tr) {
    const b = tr.body;
    let best = null, bd = 1e9;
    for (const g of this.scene.grumbles.list) {
      if (g.state !== 'play' || (g === tr.ignore && tr.ignoreT > this.scene.time)) continue;
      const dx = g.body.x - b.x, dy = g.body.y - b.y;
      const ax = Math.abs(dx);
      if (tr.type === 'archer') {
        if (ax < 1.2 || ax > 12 || dy < -4 || dy > 10) continue;
        // Archers shoot what is ahead on the march (or right next to them), not towers left behind.
        if (dx * tr.dir < -1 && ax > 3) continue;
        if (!this.shotAt(tr, g)) continue;
      } else {
        if (ax > 6.5 || Math.abs(dy) > 1.2 || !this.walkClear(b, g.body.x)) continue;
      }
      if (ax < bd) { bd = ax; best = g; }
    }
    return best;
  }

  /** Can a trooper walk straight over to x (no wall, no water) on its own row? */
  walkClear(b, x) {
    const m = this.map;
    const r = Math.floor(b.y + 0.05);
    const c0 = Math.floor(Math.min(b.x, x)), c1 = Math.floor(Math.max(b.x, x));
    for (let c = c0; c <= c1; c++) {
      if (m.solidFor(c, r, 0) || m.solidFor(c, r + 1, 0)) return false;
      if (!m.solidFor(c, r - 1, 0) && m.at(c, r - 1) !== LADDER) return false;
    }
    return true;
  }

  /** A suction-cup arrow arc that reaches the grumble: low if the way is clear, else lobbed high. */
  shotAt(tr, g) {
    const b = tr.body;
    const sx = b.x, sy = b.y + 0.9;
    const tx = g.body.x, ty = g.body.y + 0.6;
    const dx = tx - sx, dy = ty - sy, ax = Math.abs(dx);
    const disc = ARROW_V ** 4 - ARROW_G * (ARROW_G * ax * ax + 2 * dy * ARROW_V * ARROW_V);
    if (disc < 0) return null;
    for (const sgn of [-1, 1]) {
      const ang = Math.atan((ARROW_V * ARROW_V + sgn * Math.sqrt(disc)) / (ARROW_G * ax));
      const vx = Math.sign(dx) * Math.cos(ang) * ARROW_V, vy = Math.sin(ang) * ARROW_V;
      if (this.arcClear(sx, sy, vx, vy, tx)) return { vx, vy, sx, sy };
    }
    return null;
  }

  arcClear(x, y, vx, vy, tx) {
    const m = this.map;
    const h = 0.04;
    for (let i = 0; i < 120; i++) {
      x += vx * h; y += vy * h; vy -= ARROW_G * h;
      if ((vx > 0 && x >= tx - 0.3) || (vx < 0 && x <= tx + 0.3)) return true;
      if (m.solid(Math.floor(x), Math.floor(y))) return false;
    }
    return false;
  }

  /** Fight behaviour: returns the walking input for this frame. */
  fight(tr, dt) {
    const b = tr.body, g = tr.foe;
    const dx = g.body.x - b.x, dir = Math.sign(dx) || tr.dir;
    tr.cd -= dt;
    if (tr.type === 'archer') {
      if (tr.drawT > 0) {
        tr.drawT -= dt;
        if (tr.drawT <= 0) {
          const s = this.shotAt(tr, g);
          if (s) {
            this.scene.arrows.push({ owner: tr, team: 0, mesh: this.scene.makeArrow(0x4c7fd8), state: 'fly', rope: false, t: 0, x: s.sx, y: s.sy, vx: s.vx, vy: s.vy });
            this.scene.game.audio.play('dash');
            tr.ch.squash(0.85);
          }
          tr.cd = 1.6 + Math.random() * 0.8;
        }
      } else if (tr.cd <= 0) tr.drawT = 0.55;
      return NO;
    }
    // Sword and shield: walk up, wind up, swing.
    if (tr.windT > 0) {
      tr.windT -= dt;
      if (tr.windT <= 0) this.swing(tr, dir);
      return NO;
    }
    if (Math.abs(dx) > 1.1) return { x: dir * 1.25, y: 0, a: false, aPressed: false };
    if (tr.cd <= 0 && Math.abs(g.body.y - b.y) < 1.2) { tr.windT = WIND[tr.type]; tr.ch.squash(1.15); }
    return NO;
  }

  swing(tr, dir) {
    const b = tr.body;
    tr.swingT = 0.2;
    tr.cd = tr.type === 'shield' ? 1.3 + Math.random() * 0.4 : 0.9 + Math.random() * 0.5;
    this.scene.game.audio.play('whoosh');
    for (const g of this.scene.grumbles.list) {
      if (g.state !== 'play') continue;
      const fx = (g.body.x - b.x) * dir;
      if (fx > -0.3 && fx < 1.45 && Math.abs(g.body.y - b.y) < 1.2) {
        this.scene.grumbles.hit(g, tr, { dir, melee: true });
        if (tr.type === 'shield') g.body.vx = dir * 11;
      }
    }
    this.scene.puffs.burst(new THREE.Vector3(b.x + dir * 0.8, b.y + 0.6, 0.6), 0xffe9a8, { count: 4, size: 0.22, life: 0.3, speed: 3 });
  }

  /**
   * What the path ahead looks like for a trooper standing at (x, y) walking right:
   * go | hop | gap | wall | gate | door | climb
   */
  ahead(b, dir = 1) {
    const m = this.map;
    const c = Math.floor(b.x), r = Math.floor(b.y + 0.05);
    const nc = Math.floor(b.x + dir * (b.w / 2 + 0.12));
    const ladderHere = m.at(c, r) === LADDER || m.at(c, r + 1) === LADDER;
    if (nc === c) return { kind: 'go', c: nc, r };
    const s = (cc, rr) => m.solidFor(cc, rr, 0);
    if (!s(nc, r) && !s(nc, r + 1)) {
      if (s(nc, r - 1) || m.at(nc, r - 1) === LADDER) return { kind: 'go', c: nc, r };
      return m.landing(nc, r - 1) < 0 ? { kind: 'gap', c: nc, r } : { kind: 'go', c: nc, r };
    }
    if (s(nc, r) && !s(nc, r + 1) && !s(nc, r + 2) && !s(c, r + 2)) return { kind: 'hop', c: nc, r };
    if (ladderHere && !s(c, r + 2)) return { kind: 'climb', c: nc, r };
    const ty = s(nc, r) ? m.at(nc, r) : m.at(nc, r + 1);
    const kind = ty === GATE ? 'gate' : ty === DOOR ? 'door' : 'wall';
    return { kind, c: nc, r };
  }

  update(dt, playing) {
    if (playing && this.toSpawn > 0) {
      this.spawnT -= dt;
      if (this.spawnT <= 0) {
        this.spawnT = SPAWN_EVERY;
        this.toSpawn--;
        const tr = this.make(this.camp.x, this.camp.y);
        tr.ch.squash(1.3);
        this.scene.puffs.burst(new THREE.Vector3(tr.body.x, tr.body.y + 0.6, 0.4), 0xffffff, { count: 6, size: 0.3 });
      }
    }
    for (const tr of this.list) this.updateOne(tr, dt, playing);
  }

  updateOne(tr, dt, playing) {
    const b = tr.body;
    const m = this.map;
    tr.invuln = Math.max(0, tr.invuln - dt);
    tr.wobble = Math.max(0, tr.wobble - dt);
    tr.swingT = Math.max(0, tr.swingT - dt);
    tr.hitT += dt;
    if (tr.hitT > 6) tr.hits = 0;
    if (tr.state === 'caged') return;
    if (tr.state === 'home') { this.updateHome(tr, dt); return; }
    if (tr.state === 'bubble') { this.updateBubble(tr, dt); return; }

    // Walk toward the flag (a trooper pushed or bounced past it turns around).
    if (b.grounded && tr.state !== 'climb') tr.dir = b.x > this.flag.x + 0.5 ? -1 : 1;
    let inp = NO;
    if (!playing) {
      b.vx = approach(b.vx, 0, 20 * dt);
    } else if (tr.state === 'dizzy') {
      tr.dizzy -= dt;
      if (tr.dizzy <= 0 && b.grounded) tr.state = 'march';
    } else if (tr.state !== 'climb' && b.grounded && this.engaged(tr, dt)) {
      tr.state = 'fight';
      tr.why = '';
      inp = this.fight(tr, dt);
    } else if (tr.state === 'climb') {
      // Up the ladder, centered on its column; step off onto the wall top as soon as we are high enough.
      const c = Math.floor(b.x);
      b.vx = (c + 0.5 - b.x) * 10;
      b.vy = CLIMB;
      const T = Math.floor(b.y);
      const nc = c + tr.dir;
      if (m.solidFor(nc, T - 1, 0) && !m.solidFor(nc, T, 0) && !m.solidFor(nc, T + 1, 0)) {
        tr.state = 'march';
        b.y = Math.max(b.y, T + 0.01);
        b.vy = 1.5;
        b.vx = tr.dir * TPHYS.speed;
      } else if (m.solidFor(c, Math.floor(b.y + b.h + 0.1), 0) || !this.scene.onLadder(b)) {
        tr.state = 'march'; // top of the ladder (or a ceiling): look again from here
      }
      moveBody(b, dt, this.scene.solidsAround(b, 0));
      this.afterMove(tr);
      return;
    } else {
      if (tr.state === 'fight') { tr.state = 'march'; tr.windT = tr.drawT = 0; }
      tr.think -= dt;
      if (b.grounded && tr.think <= 0) {
        tr.think = tr.state === 'wait' ? 0.25 : 0.05;
        const a = this.ahead(b, tr.dir);
        const friend = this.blockedByFriend(tr);
        if (friend) { tr.state = 'wait'; tr.why = 'friend'; }
        else if (a.kind === 'go' || a.kind === 'hop') { tr.state = 'march'; tr.why = ''; tr.hop = a.kind === 'hop'; }
        else if (a.kind === 'climb') { tr.state = 'climb'; tr.why = ''; }
        else { if (tr.state !== 'wait') tr.waitT = 0; tr.state = 'wait'; tr.why = a.kind; }
      }
      if (tr.state === 'wait') tr.waitT += dt;
      if (tr.state === 'march') {
        inp = { x: tr.dir, y: 0, a: !!tr.hop, aPressed: !!tr.hop && b.grounded };
        if (tr.hop && b.grounded) tr.hop = false;
      }
    }
    platformerControl(b, inp, dt, TPHYS);
    if (tr.state === 'wait' && b.grounded) b.vx = approach(b.vx, 0, 30 * dt);
    if (tr.state === 'dizzy' && b.grounded) b.vx = approach(b.vx, 0, 14 * dt);
    if (tr.state === 'fight' && inp === NO && b.grounded) b.vx = approach(b.vx, 0, 30 * dt);
    // Long falls: open the leaf parachute and float down.
    tr.ch.leaf.visible = b.vy < -5.5 || (tr.ch.leaf.visible && !b.grounded);
    if (tr.ch.leaf.visible) b.vy = Math.max(b.vy, -5);
    moveBody(b, dt, this.scene.solidsAround(b, 0));
    if (b.grounded && b.ground?.pad) {
      b.vy = 21;
      b.grounded = false;
      tr.ch.squash(1.4);
      this.scene.game.audio.play('boing');
    }
    this.afterMove(tr);
  }

  afterMove(tr) {
    const b = tr.body, m = this.map;
    if (b.justLanded) tr.ch.squash(0.8);
    // Fell in the water: float back to the last dry spot.
    const c = Math.floor(b.x);
    if (m.at(c, Math.floor(b.y + 0.3)) === WATER || m.at(c, Math.floor(b.y + 0.05)) === WATER) {
      this.scene.puffs.burst(new THREE.Vector3(b.x, b.y + 0.5, 0.5), 0x8fd8ff, { count: 10, size: 0.35 });
      this.scene.game.audio.play('splat');
      // Two splashes in a row: the dry spot is no good, float to a tent instead.
      tr.splashes = this.scene.time - (tr.splashT ?? -99) < 6 ? (tr.splashes || 0) + 1 : 1;
      tr.splashT = this.scene.time;
      const dest = tr.splashes >= 2 ? this.scene.trooperRespawn(b.x) : tr.lastSafe;
      tr.state = 'bubble';
      tr.bub = { x0: b.x, y0: b.y, x1: dest.x, y1: dest.y, t: 0, time: 2 };
      tr.ch.leaf.visible = false;
      return;
    }
    if (b.grounded && tr.state !== 'dizzy' && b.ground && !b.ground.pad && m.solid(c, Math.floor(b.y - 0.5))) {
      tr.lastSafe = { x: Math.floor(b.x) + 0.5, y: b.y };
    }
    // Home at the Golden Bean flag!
    const f = this.flag;
    if (Math.abs(b.x - f.x) < 0.8 && b.y > f.y - 0.6 && b.y < f.y + 1.5) {
      tr.state = 'home';
      tr.homeIndex = this.home++;
      tr.ch.leaf.visible = false;
      this.scene.onTrooperHome(tr);
    }
  }

  /** Queue up behind a friend who is waiting right in front. */
  blockedByFriend(tr) {
    const b = tr.body;
    for (const o of this.list) {
      if (o === tr || (o.state !== 'wait' && o.state !== 'climb')) continue;
      const dx = (o.body.x - b.x) * tr.dir;
      if (dx > 0.05 && dx < 0.6 && Math.abs(o.body.y - b.y) < 0.5) return o.state === 'wait' || this.ahead(b, tr.dir).kind !== 'climb';
    }
    return false;
  }

  updateBubble(tr, dt) {
    const B = tr.bub, b = tr.body;
    B.t += dt / (B.time || 2);
    const k = Math.min(1, B.t), s = k * k * (3 - 2 * k);
    b.x = B.x0 + (B.x1 - B.x0) * s;
    b.y = B.y0 + (B.y1 - B.y0) * s + Math.sin(k * Math.PI) * 2.5;
    b.vx = b.vy = 0;
    if (B.t >= 1) {
      tr.state = 'march';
      tr.invuln = 1.5;
      this.scene.puffs.burst(new THREE.Vector3(b.x, b.y + 0.6, 0.5), 0xbfeaff, { count: 8, size: 0.3 });
      this.scene.game.audio.play('pop');
    }
  }

  updateHome(tr, dt) {
    // Line up behind the flag and cheer.
    const b = tr.body;
    tr.homeT += dt;
    const spot = this.flag.x + 1.2 + (tr.homeIndex % 6) * 0.55;
    b.x += (spot - b.x) * Math.min(1, dt * 3);
    const hop = Math.abs(Math.sin(tr.homeT * 5 + tr.homeIndex)) * 0.5;
    b.y = this.flag.y + hop;
  }

  pose(dt) {
    for (const tr of this.list) {
      const b = tr.body, ch = tr.ch;
      const inBubble = tr.state === 'bubble';
      ch.group.position.set(b.x, b.y, tr.state === 'caged' ? -0.2 : tr.state === 'home' ? -0.5 - (tr.homeIndex % 2) * 0.3 : 0.1);
      ch.faceSide(tr.state === 'home' || tr.state === 'caged' ? 0.3 : this.faceOf(tr));
      ch.spin = inBubble ? ch.spin + dt * 3 : 0;
      const moving = tr.state === 'march' || tr.state === 'climb' || tr.state === 'fight' ? Math.min(1, Math.abs(b.vx) / TPHYS.speed + (tr.state === 'climb' ? 0.6 : 0)) : 0;
      ch.update(dt, { moving, grounded: b.grounded || tr.state === 'climb' || inBubble || tr.state === 'home', vy: b.vy });
      const t2 = this.scene.time;
      let rz = 0;
      if (tr.state === 'dizzy' || tr.wobble > 0) rz = Math.sin(t2 * 18) * 0.25;
      else if (tr.windT > 0) rz = 0.18 * -this.faceOf(tr); // lean back before the swing
      else if (tr.state === 'wait' && tr.why !== 'friend') rz = Math.sin(t2 * 6 + b.x) * 0.12; // waving for help
      else if (tr.state === 'caged') rz = Math.sin(t2 * 4 + b.x * 3) * 0.1;
      ch.pivot.rotation.z = rz;
      tr.bubble.visible = inBubble;
      if (inBubble) tr.bubble.position.set(b.x, b.y + 0.55, 0.2);
      // Gear: sword raised during the wind-up, swept down on the swing; bow drawn; shield up front.
      const G = ch.gear;
      G.visible = !inBubble && tr.state !== 'caged';
      if (tr.type === 'archer') G.rotation.x = tr.drawT > 0 ? -0.9 : -0.2;
      else if (tr.windT > 0) G.rotation.x = -1.5;
      else if (tr.swingT > 0) G.rotation.x = 1.3 - (tr.swingT / 0.2) * 2.4;
      else G.rotation.x = tr.type === 'shield' ? 0 : 0.35;
      // Hit pips: little stars circling the head.
      if (!tr.pips) {
        tr.pips = new THREE.Group();
        for (let i = 0; i < MAX_HITS - 1; i++) { const st = makeStar(0xffd23f); st.scale.setScalar(0.22); tr.pips.add(st); }
        this.scene.scene.add(tr.pips);
      }
      tr.pips.visible = tr.hits > 0 && this.active(tr);
      if (tr.pips.visible) {
        tr.pips.position.set(b.x, b.y + 1.35, 0.3);
        tr.pips.children.forEach((st, i) => {
          const a = t2 * 5 + (i * Math.PI * 2) / (MAX_HITS - 1);
          st.visible = i < tr.hits;
          st.position.set(Math.cos(a) * 0.35, 0, Math.sin(a) * 0.35);
        });
      }
    }
    this.updateLabels();
  }

  /** "Help!" bubbles over the trooper at the front of each waiting line. */
  updateLabels() {
    const fronts = this.list.filter((tr) => tr.state === 'wait' && tr.why && tr.why !== 'friend' && tr.waitT > 0.6);
    while (this.labels.length < fronts.length) this.labels.push(this.scene.game.ui.label('label kc-help'));
    this.labels.forEach((el, i) => {
      const tr = fronts[i];
      if (!tr || this.scene.state !== 'play') { el.style.display = 'none'; return; }
      const txt = t(`kc.need.${tr.why}`);
      if (el.textContent !== txt) el.textContent = txt;
      this.scene.game.ui.place(el, new THREE.Vector3(tr.body.x, tr.body.y + 1.75 + Math.sin(this.scene.time * 4) * 0.08, 0.4), this.scene.camera);
    });
  }

  hideLabels() {
    for (const el of this.labels) el.style.display = 'none';
  }
}

export { TROOPER_COLOR };
