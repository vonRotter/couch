import * as THREE from 'three';
import { moveBody, platformerControl, approach } from '../../core/physics2d.js';
import { sharedGeo, toon } from '../../core/palette.js';
import { t } from '../../core/i18n.js';
import { makeTrooper, mesh, TROOPER_COLOR } from './props.js';
import { WATER, LADDER, GATE, DOOR, PAD } from './tilemap.js';

// Bean troopers march to the Golden Bean flag on their own. They hop up 1-tile steps, float down
// any drop on a leaf parachute, climb ladders, and wait (and call for help) at water, high walls,
// closed gates and grumble doors. Grumble hits only push them and make them dizzy for a moment.

const TW = 0.6, TH = 1.1;
const TPHYS = { speed: 2.3, accel: 30, airAccel: 12, jump: 10.6, jump2: 0, doubleJump: false, gravity: 38, fallMul: 1.2, coyote: 0.08, buffer: 0.1, maxFall: -20 };
const CLIMB = 2.8;
const SPAWN_EVERY = 2.2;
const NO = { x: 0, y: 0, a: false, aPressed: false };

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

  make(x, y, state = 'march') {
    const ch = makeTrooper(this.list.length);
    this.scene.scene.add(ch.group);
    const bubble = mesh(sharedGeo('kcTBubble', () => new THREE.SphereGeometry(0.75, 18, 12)), toon(0xbfeaff, { transparent: true, opacity: 0.4 }));
    bubble.visible = false;
    this.scene.scene.add(bubble);
    const tr = {
      kind: 'trooper', team: 0, ch, bubble, state, why: '', dir: 1,
      body: { x, y, w: TW, h: TH, vx: 0, vy: 0, grounded: true },
      dizzy: 0, think: 0, lastSafe: { x, y }, bub: null, homeT: 0, invuln: 0, waitT: 0,
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
    return tr.state === 'march' || tr.state === 'wait' || tr.state === 'climb' || tr.state === 'dizzy';
  }

  get activeList() {
    return this.list.filter((tr) => this.active(tr));
  }

  get total() {
    return this.list.length + this.toSpawn;
  }

  /** A grumble swing, arrow or pillow: a push and a little dizzy spell. */
  knock(tr, dir, power = 7, dizzy = 1.3) {
    if (!this.active(tr) || tr.invuln > 0) return false;
    tr.state = 'dizzy';
    tr.dizzy = dizzy;
    tr.body.vx = dir * power;
    tr.body.vy = 5;
    tr.invuln = 0.5;
    tr.ch.squash(0.7);
    this.scene.puffs.burst(new THREE.Vector3(tr.body.x, tr.body.y + 0.7, 0.6), 0xffffff, { count: 5, size: 0.25, life: 0.3 });
    this.scene.game.audio.play('boing');
    return true;
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
    if (tr.state === 'caged') return;
    if (tr.state === 'home') { this.updateHome(tr, dt); return; }
    if (tr.state === 'bubble') { this.updateBubble(tr, dt); return; }

    let inp = NO;
    if (!playing) {
      b.vx = approach(b.vx, 0, 20 * dt);
    } else if (tr.state === 'dizzy') {
      tr.dizzy -= dt;
      if (tr.dizzy <= 0 && b.grounded) tr.state = 'march';
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
    if (m.at(Math.floor(b.x), Math.floor(b.y + 0.3)) === WATER) {
      this.scene.puffs.burst(new THREE.Vector3(b.x, b.y + 0.5, 0.5), 0x8fd8ff, { count: 10, size: 0.35 });
      this.scene.game.audio.play('splat');
      tr.state = 'bubble';
      tr.bub = { x0: b.x, y0: b.y, x1: tr.lastSafe.x, y1: tr.lastSafe.y, t: 0 };
      tr.ch.leaf.visible = false;
      return;
    }
    if (b.grounded && tr.state !== 'dizzy' && b.ground && !b.ground.pad && m.at(Math.floor(b.x), Math.floor(b.y - 0.5)) !== WATER) {
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
    B.t += dt / 2;
    const k = Math.min(1, B.t), s = k * k * (3 - 2 * k);
    b.x = B.x0 + (B.x1 - B.x0) * s;
    b.y = B.y0 + (B.y1 - B.y0) * s + Math.sin(k * Math.PI) * 2.5;
    b.vx = b.vy = 0;
    if (B.t >= 1) {
      tr.state = 'march';
      tr.invuln = 1;
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
      ch.faceSide(tr.state === 'home' || tr.state === 'caged' ? 0.3 : tr.dir);
      ch.spin = inBubble ? ch.spin + dt * 3 : 0;
      const moving = tr.state === 'march' || tr.state === 'climb' ? Math.min(1, Math.abs(b.vx) / TPHYS.speed + (tr.state === 'climb' ? 0.6 : 0)) : 0;
      ch.update(dt, { moving, grounded: b.grounded || tr.state === 'climb' || inBubble || tr.state === 'home', vy: b.vy });
      const t2 = this.scene.time;
      let rz = 0;
      if (tr.state === 'dizzy') rz = Math.sin(t2 * 18) * 0.25;
      else if (tr.state === 'wait' && tr.why !== 'friend') rz = Math.sin(t2 * 6 + b.x) * 0.12; // waving for help
      else if (tr.state === 'caged') rz = Math.sin(t2 * 4 + b.x * 3) * 0.1;
      ch.pivot.rotation.z = rz;
      tr.bubble.visible = inBubble;
      if (inBubble) tr.bubble.position.set(b.x, b.y + 0.55, 0.2);
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
