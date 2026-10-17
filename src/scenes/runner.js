import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { MiniGame } from '../core/minigame.js';
import { t } from '../core/i18n.js';
import { Character } from '../core/character.js';
import { COLORS, PLAYER_COLORS, toon, basic, sharedGeo } from '../core/palette.js';
import { addLights, skyTexture, makeCloud, seeded } from '../core/world.js';
import { moveBody, solidAt, approach } from '../core/physics2d.js';

// Rooftop Rush: a side-scrolling speedrun race over the rooftops, shared camera.
// Moves: run, jump, wall jump, slide (B or down on the ground), air dash (B in the air),
// grapple (B in the air near a hook balloon, hold to swing).
const P = {
  speed: 10, accel: 55, airAccel: 32, jump: 15, gravity: 40, fallMul: 1.45, maxFall: -22,
  coyote: 0.12, buffer: 0.15, wallSlide: -3.5, wallJumpX: 9, wallJumpY: 14.5,
  slideTime: 0.55, slideSpeed: 12, dashSpeed: 19, dashTime: 0.18, padSpeed: 18,
  hookRange: 9,
};
const STAND_H = 1.1, SLIDE_H = 0.5, BODY_W = 0.7;
const FINISH_WAIT = 12;
const MAX_TIME = 150; // nobody is stuck forever
const VIEW_W = 30, VIEW_H = 17;
const ord = (i) => t(`ord.${i}`);

/** The course, in tiles. Each piece teaches one move, then mixes them. */
function buildCourse() {
  const solids = [], deco = [];
  const roof = (x0, x1, top, color) => { solids.push({ x: x0, y: -10, w: x1 - x0, h: top + 10, kind: 'roof', color }); };
  const block = (x0, x1, y0, y1, kind = 'block') => { solids.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0, kind }); };
  const hooks = [], pads = [], springs = [], signs = [];
  // Warm-up run with a speed pad, then a small gap and a step.
  roof(-6, 30, 2, 0);
  pads.push({ x: 14, y: 2 });
  signs.push({ x: 6, y: 2, key: 'runner.sign.run' });
  roof(34, 52, 2, 1);
  block(44, 52, 2, 4, 'crate');
  // Slide under the billboard.
  roof(52, 68, 4, 2);
  block(56, 64, 5, 8, 'billboard'); // 1 tile of headroom: slide under
  signs.push({ x: 53.5, y: 4, key: 'runner.sign.slide' });
  // Wall-jump chimney: run under the left wall into the shaft, kick up between the walls.
  roof(68, 82, 2, 3);
  block(71, 72, 4.2, 13.5, 'brick');
  block(74, 75, 2, 13, 'brick');
  signs.push({ x: 69, y: 2, key: 'runner.sign.wall' });
  roof(75, 86, 13, 4);
  // Drop down, then a wide gap with hook balloons.
  roof(86, 98, 3, 5);
  signs.push({ x: 95.5, y: 3, key: 'runner.sign.hook' });
  hooks.push({ x: 103, y: 9.5 }, { x: 110, y: 9.5 });
  roof(116, 132, 3, 0);
  pads.push({ x: 125, y: 3 });
  // Air-dash gap.
  signs.push({ x: 130, y: 3, key: 'runner.sign.dash' });
  roof(143, 162, 3, 1);
  // Two routes: a spring to the high road, or slide through the low one.
  springs.push({ x: 160, y: 3 });
  roof(162, 192, 3, 2);
  block(166, 184, 9, 9.6, 'ledge');
  block(170, 180, 4, 7.5, 'billboard');
  pads.push({ x: 176, y: 9.6 });
  // Hop the gaps, one more hook, then a chimney and the final sprint.
  roof(195, 203, 4, 3);
  roof(206, 214, 5, 4);
  hooks.push({ x: 220, y: 10.5 });
  roof(226, 237, 4, 5);
  block(233, 234, 6.2, 13.5, 'brick');
  block(236, 237, 4, 12.5, 'brick');
  roof(237, 270, 12.5, 0);
  pads.push({ x: 246, y: 12.5 });
  const flag = { x: 262, y: 12.5 };
  return { solids, hooks, pads, springs, signs, flag, width: 272, deco };
}

const ROOF_COLORS = [0xff9fd0, 0x8fd8ff, 0xffe47a, 0x9ff0c8, 0xc9a8ff, 0xffb38a];

export class RunnerScene extends MiniGame {
  constructor(game, opts) {
    super(game, opts);
    this.scene.background = skyTexture('#ffb7d5', '#ffe9c2');
    this.sun = addLights(this.scene, { size: 26 }).sun;
    this.course = buildCourse();
    this.solids = this.course.solids;
    this.buildCity();
    this.finishOrder = [];
    this.finishTimer = null;
    this.raceTime = 0;
    this.camX = 8;
    this.checkpoint = { x: 2, y: 2 }; // furthest safe ground anyone has reached
    this.camY = 7;
    this.ents = this.players.map((p, i) => this.makeRunner(p, i));
    this.updateCamera(1);
    game.audio.playMusic('platformer');
    this.intro(t('game.runner'), t('runner.intro'));
  }

  // ---------- world ----------

  buildCity() {
    const s = this.scene;
    const c = this.course;
    const rand = seeded(23);
    for (const sd of this.solids) {
      let mesh;
      if (sd.kind === 'roof') {
        const color = ROOF_COLORS[sd.color % ROOF_COLORS.length];
        mesh = new THREE.Group();
        const body = new THREE.Mesh(new THREE.BoxGeometry(sd.w, sd.h, 3), toon(color));
        body.position.set(sd.x + sd.w / 2, sd.y + sd.h / 2, -0.6);
        body.receiveShadow = true;
        const rim = new THREE.Mesh(new RoundedBoxGeometry(sd.w + 0.3, 0.35, 3.4, 2, 0.1), toon(COLORS.white));
        rim.position.set(sd.x + sd.w / 2, sd.y + sd.h - 0.12, -0.6);
        rim.receiveShadow = true;
        mesh.add(body, rim);
        // Windows on the front.
        for (let wx = sd.x + 1; wx < sd.x + sd.w - 0.8; wx += 2) {
          for (let wy = sd.y + sd.h - 2; wy > -4; wy -= 2.2) {
            const win = new THREE.Mesh(sharedGeo('rWin', () => new THREE.PlaneGeometry(0.9, 1.2)), toon(rand() < 0.3 ? 0xfff3b0 : 0x6b8fd6));
            win.position.set(wx + 0.5, wy, 0.91);
            mesh.add(win);
          }
        }
      } else {
        const colors = { crate: 0xd99a62, billboard: 0xff5d73, brick: 0xc8705a, ledge: 0xffffff, block: 0xbdb8cf };
        mesh = new THREE.Mesh(new RoundedBoxGeometry(sd.w, sd.h, 2.4, 2, 0.08), toon(colors[sd.kind] || 0xbdb8cf));
        mesh.position.set(sd.x + sd.w / 2, sd.y + sd.h / 2, -0.2);
        mesh.castShadow = mesh.receiveShadow = true;
        if (sd.kind === 'billboard') {
          const face = new THREE.Mesh(new THREE.PlaneGeometry(sd.w - 0.6, sd.h - 0.6), toon(0xfff3dc));
          face.position.z = 1.21;
          mesh.add(face);
          const stripe = new THREE.Mesh(new THREE.PlaneGeometry(sd.w - 1.4, 0.5), toon(0x4cc9f0));
          stripe.position.set(0, 0, 1.22);
          mesh.add(stripe);
        }
      }
      s.add(mesh);
    }
    // Hook balloons.
    this.hooks = c.hooks.map((h) => {
      const g = new THREE.Group();
      const balloon = new THREE.Mesh(sharedGeo('hookBalloon', () => new THREE.SphereGeometry(0.9, 18, 14)), toon(0xff7eb6));
      balloon.scale.set(1, 1.15, 1);
      balloon.position.y = 2.2;
      const string = new THREE.Mesh(sharedGeo('hookString', () => new THREE.CylinderGeometry(0.03, 0.03, 1.3, 5)), toon(COLORS.white));
      string.position.y = 0.9;
      const ring = new THREE.Mesh(sharedGeo('hookRing', () => new THREE.TorusGeometry(0.35, 0.09, 8, 18)), toon(COLORS.gold));
      g.add(balloon, string, ring);
      g.position.set(h.x, h.y, 0);
      s.add(g);
      return { ...h, g, ring };
    });
    // Speed pads.
    for (const pd of c.pads) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.12, 1.6), basic(0x7dffcf));
      m.position.set(pd.x, pd.y + 0.06, 0);
      s.add(m);
      for (let i = 0; i < 2; i++) {
        const ar = new THREE.Mesh(sharedGeo('padArrow', () => new THREE.ConeGeometry(0.35, 0.6, 3)), basic(COLORS.white));
        ar.rotation.z = -Math.PI / 2;
        ar.position.set(pd.x - 0.5 + i * 0.8, pd.y + 0.2, 0.2);
        s.add(ar);
      }
    }
    // Springs.
    this.springs = c.springs.map((sp) => {
      const m = new THREE.Mesh(sharedGeo('rSpring', () => new THREE.CylinderGeometry(0.7, 0.8, 0.4, 16)), toon(0xff5d73));
      m.position.set(sp.x, sp.y + 0.2, 0);
      s.add(m);
      return { ...sp, m, squish: 0 };
    });
    // Little signs that name each move.
    this.signLabels = c.signs.map((sg) => {
      const pole = new THREE.Mesh(sharedGeo('signPole', () => new THREE.CylinderGeometry(0.06, 0.06, 1.6, 6)), toon(COLORS.trunk));
      pole.position.set(sg.x, sg.y + 0.8, -1.2);
      s.add(pole);
      const el = this.game.ui.label('label');
      el.style.color = '#8a45e0';
      return { ...sg, el, pos: new THREE.Vector3(sg.x, sg.y + 2.3, -1.2) };
    });
    // Finish flag.
    const f = c.flag;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 5, 8), toon(COLORS.white));
    pole.position.set(f.x, f.y + 2.5, 0);
    const cloth = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.1, 0.08), toon(0xff5d73));
    cloth.position.set(f.x + 0.95, f.y + 4.3, 0);
    s.add(pole, cloth);
    this.flagCloth = cloth;
    // Skyline far behind, and clouds.
    for (let i = 0; i < 70; i++) {
      const w = 3 + rand() * 5, h = 6 + rand() * 16;
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 2), toon([0xf6c6dc, 0xd7c4f2, 0xc6e3f6, 0xf6e0c6][Math.floor(rand() * 4)]));
      m.position.set(-10 + i * 4.2 + rand() * 2, h / 2 - 6, -14 - rand() * 6);
      s.add(m);
    }
    for (let i = 0; i < 18; i++) {
      const cl = makeCloud(rand, 1.6 + rand());
      cl.position.set(-10 + i * 16 + rand() * 6, 16 + rand() * 6, -22);
      s.add(cl);
    }
  }

  makeRunner(p, i) {
    const ch = new Character(p.color, { hat: p.hat });
    this.scene.add(ch.group);
    const bubble = new THREE.Mesh(sharedGeo('pbubble2', () => new THREE.SphereGeometry(0.85, 22, 16)), toon(p.color, { transparent: true, opacity: 0.35 }));
    bubble.visible = false;
    this.scene.add(bubble);
    const rope = new THREE.Mesh(sharedGeo('rRope', () => new THREE.CylinderGeometry(0.05, 0.05, 1, 6)), toon(p.color));
    rope.visible = false;
    this.scene.add(rope);
    const x = 2 + i * 1.0;
    return {
      p, ch, bubble, rope,
      body: { x, y: 2, w: BODY_W, h: STAND_H, vx: 0, vy: 0, grounded: true },
      facing: 1, state: 'play', t: 0, coyote: 0, buffer: 0, wallDir: 0, wallLock: 0,
      slideT: 0, dashT: 0, canDash: true, hook: null, ropeLen: 0, lastSafe: { x, y: 2 },
      finishTime: 0, place: i, trail: 0,
    };
  }

  // ---------- movement ----------

  touchingWall(b, dir) {
    const x = b.x + dir * (b.w / 2 + 0.06);
    return !!(solidAt(this.solids, x, b.y + 0.3) || solidAt(this.solids, x, b.y + b.h - 0.2));
  }

  ceilingAbove(b) {
    return !!(solidAt(this.solids, b.x - 0.3, b.y + STAND_H + 0.02) || solidAt(this.solids, b.x + 0.3, b.y + STAND_H + 0.02));
  }

  nearestHook(b) {
    let best = null, bestD = P.hookRange;
    for (const h of this.hooks) {
      const d = Math.hypot(h.x - b.x, h.y - (b.y + 0.6));
      if (d < bestD && h.y > b.y + 0.5 && h.x > b.x - 2) { best = h; bestD = d; }
    }
    return best;
  }

  updateRunner(e, dt, inp) {
    const b = e.body;
    const audio = this.game.audio;
    e.wallLock -= dt;
    e.buffer = inp.aPressed ? P.buffer : e.buffer - dt;
    if (Math.abs(inp.x) > 0.2 && e.wallLock <= 0 && !e.hook) e.facing = Math.sign(inp.x);

    // Grapple swing.
    if (e.hook) {
      const h = e.hook;
      b.vy -= P.gravity * dt;
      b.vx += inp.x * 12 * dt; // pump the swing
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      const cx = b.x, cy = b.y + 0.6;
      const dx = cx - h.x, dy = cy - h.y;
      const d = Math.hypot(dx, dy);
      if (d > e.ropeLen) {
        const nx = dx / d, ny = dy / d;
        b.x = h.x + nx * e.ropeLen;
        b.y = h.y + ny * e.ropeLen - 0.6;
        const vr = b.vx * nx + b.vy * ny;
        if (vr > 0) { b.vx -= vr * nx; b.vy -= vr * ny; }
      }
      const release = !inp.b || inp.aPressed || e.t > 4;
      if (release) {
        e.hook = null;
        e.rope.visible = false;
        if (inp.aPressed) { b.vy = Math.max(b.vy, 0) + 8; audio.play('jump'); }
        b.vx *= 1.1;
        e.canDash = true;
        e.buffer = 0;
      }
      e.t += dt;
      if (e.hook) {
        e.rope.visible = true;
        const mx = (b.x + h.x) / 2, my = (b.y + 0.6 + h.y) / 2;
        e.rope.position.set(mx, my, 0);
        e.rope.scale.y = Math.hypot(h.x - b.x, h.y - b.y - 0.6);
        e.rope.rotation.z = Math.atan2(-(h.x - b.x), h.y - b.y - 0.6);
      }
      moveBody(b, 0, this.solids);
      if (b.grounded && e.hook) { e.hook = null; e.rope.visible = false; }
      return;
    }

    // Dash: straight line, no gravity, for a moment.
    if (e.dashT > 0) {
      e.dashT -= dt;
      b.vy = Math.max(b.vy, e.dashUp ? 6 : 0);
      moveBody(b, dt, this.solids);
      if (b.wallHit) e.dashT = 0;
      return;
    }

    const wasGrounded = b.grounded;
    if (b.grounded) { e.coyote = P.coyote; e.canDash = true; } else e.coyote -= dt;

    // Slide: B or down on the ground. Keeps (or gives) speed and shrinks the hitbox.
    const wantSlide = b.grounded && (inp.bPressed || (inp.y < -0.6 && Math.abs(b.vx) > 3 && e.slideT <= 0 && !e.downHeld));
    e.downHeld = inp.y < -0.6;
    if (wantSlide && e.slideT <= 0) {
      e.slideT = P.slideTime;
      b.vx = e.facing * Math.max(Math.abs(b.vx), P.slideSpeed);
      audio.play('dash');
      this.puffs.burst(new THREE.Vector3(b.x, b.y + 0.2, 0.3), 0xffffff, { count: 6, size: 0.25, life: 0.35 });
    }
    if (e.slideT > 0) {
      e.slideT -= dt;
      if (e.slideT <= 0 && this.ceilingAbove(b)) e.slideT = 0.05; // stay low under a ceiling
    }
    const sliding = e.slideT > 0;
    b.h = sliding ? SLIDE_H : STAND_H;

    // Running.
    const top = Math.max(P.speed, Math.abs(b.vx) > P.speed ? Math.abs(b.vx) - 6 * dt : 0);
    if (sliding) {
      b.vx = approach(b.vx, e.facing * P.speed, 6 * dt);
    } else if (e.wallLock <= 0) {
      const target = inp.x * P.speed;
      const fast = Math.abs(b.vx) > P.speed && Math.sign(b.vx) === Math.sign(inp.x || b.vx);
      if (fast) b.vx = approach(b.vx, Math.sign(b.vx) * top, 6 * dt); // keep pad speed for a while
      else b.vx = approach(b.vx, target, (b.grounded ? P.accel : P.airAccel) * dt);
    }

    // Wall slide and wall jump.
    e.wallDir = 0;
    if (!b.grounded) {
      if (this.touchingWall(b, 1)) e.wallDir = 1;
      else if (this.touchingWall(b, -1)) e.wallDir = -1;
    }
    if (b.grounded) {
      if (e.buffer > 0 && !(sliding && this.ceilingAbove(b))) this.jump(e);
    } else if (e.wallDir && e.buffer > 0) {
      b.vy = P.wallJumpY;
      b.vx = -e.wallDir * P.wallJumpX;
      e.facing = -e.wallDir;
      e.wallLock = 0.16;
      e.buffer = 0;
      e.canDash = true;
      e.ch.squash(1.3);
      audio.play('doubleJump');
      this.puffs.burst(new THREE.Vector3(b.x + e.wallDir * 0.35, b.y + 0.6, 0.3), 0xffffff, { count: 6, size: 0.25, life: 0.35 });
    } else if (e.coyote > 0 && e.buffer > 0) {
      this.jump(e);
    }

    // B in the air: grapple a nearby hook, otherwise dash.
    if (!b.grounded && inp.bPressed) {
      const h = this.nearestHook(b);
      if (h) {
        e.hook = h;
        e.t = 0;
        e.ropeLen = Math.max(2.5, Math.hypot(h.x - b.x, h.y - b.y - 0.6) * 0.92);
        audio.play('select');
        e.slideT = 0;
        return;
      }
      if (e.canDash) {
        e.canDash = false;
        e.dashT = P.dashTime;
        e.dashUp = inp.y > 0.5;
        const dir = Math.abs(inp.x) > 0.2 ? Math.sign(inp.x) : e.facing;
        e.facing = dir;
        b.vx = dir * P.dashSpeed;
        b.vy = e.dashUp ? 8 : 0;
        e.ch.squash(0.75);
        audio.play('dash');
        this.puffs.burst(new THREE.Vector3(b.x, b.y + 0.6, 0.3), e.p.color, { count: 8, size: 0.3, life: 0.35 });
      }
    }

    // Gravity (gentle wall slide when pressing into a wall).
    const g = b.vy < 0 || !inp.a ? P.gravity * P.fallMul : P.gravity;
    b.vy = Math.max(P.maxFall, b.vy - g * dt);
    if (e.wallDir && b.vy < P.wallSlide) b.vy = P.wallSlide;
    moveBody(b, dt, this.solids);
    if (b.justLanded) e.ch.squash(0.75);
    if (b.grounded && !wasGrounded && Math.abs(b.vx) > P.speed) this.puffs.burst(new THREE.Vector3(b.x, b.y + 0.1, 0.3), 0xffffff, { count: 4, size: 0.2, life: 0.3 });

    // Pads and springs.
    if (b.grounded) {
      for (const pd of this.course.pads) {
        if (Math.abs(b.x - pd.x) < 1.3 && Math.abs(b.y - pd.y) < 0.2) {
          if (Math.abs(b.vx) < P.padSpeed - 1) audio.play('coin');
          b.vx = P.padSpeed * (b.vx < -1 ? -1 : 1);
        }
      }
      for (const sp of this.springs) {
        if (Math.abs(b.x - sp.x) < 0.9 && Math.abs(b.y - sp.y) < 0.3) {
          b.vy = 25;
          b.grounded = false;
          sp.squish = 1;
          e.ch.squash(1.45);
          audio.play('boing');
        }
      }
      if (!this.ceilingAbove(b) || !sliding) {
        const under = solidAt(this.solids, b.x, b.y - 0.05);
        if (under?.kind === 'roof' || under?.kind === 'ledge') {
          e.lastSafe = { x: b.x, y: b.y };
          if (b.x > this.checkpoint.x) this.checkpoint = { x: b.x, y: b.y };
        }
      }
    }
  }

  jump(e) {
    const b = e.body;
    b.vy = P.jump;
    b.grounded = false;
    e.coyote = 0;
    e.buffer = 0;
    e.slideT = 0;
    b.h = STAND_H;
    e.ch.squash(1.3);
    this.game.audio.play('jump');
  }

  leader() {
    let best = null;
    for (const e of this.ents) if (e.state === 'play' && (!best || e.body.x > best.body.x)) best = e;
    return best;
  }

  bubbleUp(e) {
    if (e.state !== 'play') return;
    e.state = 'bubble';
    e.t = 0;
    e.hook = null;
    e.rope.visible = false;
    e.dashT = e.slideT = 0;
    e.body.vx = e.body.vy = 0;
    e.body.h = STAND_H;
    e.bubble.visible = true;
    this.game.audio.play('bubble');
  }

  updatePlayers(dt) {
    const half = this.viewHalfSize(this.camDist).w;
    const lead = this.leader();
    for (const e of this.ents) {
      const b = e.body;
      const inp = this.input(e.p) || { x: 0, y: 0, a: false, b: false, aPressed: false, bPressed: false };
      if (e.state === 'bubble') {
        e.t += dt;
        const anchor = lead && lead !== e ? lead.lastSafe : this.checkpoint;
        const tx = Math.max(anchor.x - 1.2, Math.min(anchor.x, this.camX - half + 1.5)), ty = anchor.y + 2.2;
        const dx = tx - b.x, dy = ty - b.y, d = Math.hypot(dx, dy);
        const sp = Math.min(d / dt, 8 + d * 2.5);
        if (d > 0.01) { b.x += (dx / d) * sp * dt; b.y += (dy / d) * sp * dt; }
        if (e.t > 1.5 && d < 0.6) {
          e.state = 'play';
          e.bubble.visible = false;
          b.vy = 4;
          b.vx = lead ? Math.max(0, lead.body.vx * 0.5) : 0;
          this.puffs.burst(new THREE.Vector3(b.x, b.y + 0.6, 0.4), e.p.color, { count: 10, size: 0.3 });
          this.game.audio.play('pop');
        }
        e.bubble.position.set(b.x, b.y + 0.55, 0);
        e.ch.spin += dt * 2;
      } else if (e.state === 'done') {
        b.vx = approach(b.vx, 0, 20 * dt);
        b.vy = Math.max(P.maxFall, b.vy - P.gravity * dt);
        b.h = STAND_H;
        moveBody(b, dt, this.solids);
        if (b.grounded && Math.random() < dt * 1.5) { b.vy = 9; e.ch.squash(1.3); }
        e.ch.spin = 0;
      } else {
        e.ch.spin = 0;
        const ctrl = this.state === 'play' ? inp : { x: 0, y: 0, a: false, b: false, aPressed: false, bPressed: false };
        this.updateRunner(e, dt, ctrl);
        b.x = Math.max(0.4, b.x);
        if (b.y < -4) this.bubbleUp(e);
        else if (b.x < this.camX - half - 0.6) this.bubbleUp(e);
        if (e.state === 'play' && b.x >= this.course.flag.x && this.state === 'play') this.reachFlag(e);
      }
      const sliding = e.state === 'play' && e.slideT > 0;
      e.ch.faceSide(e.facing);
      if (e.state === 'done') e.ch.targetYaw = 0;
      e.ch.group.position.set(b.x, b.y, 0);
      e.ch.pivot.rotation.z = sliding ? -e.facing * 1.2 : e.dashT > 0 ? -e.facing * 0.4 : 0;
      e.ch.pivot.position.x = sliding ? -e.facing * 0.3 : 0;
      e.ch.update(dt, { moving: Math.min(1, Math.abs(b.vx) / P.speed), grounded: b.grounded || e.state === 'bubble', vy: b.vy });
      // Speed lines when going fast.
      if (e.state === 'play' && Math.abs(b.vx) > P.speed + 3) {
        e.trail -= dt;
        if (e.trail <= 0) { e.trail = 0.05; this.puffs.burst(new THREE.Vector3(b.x - Math.sign(b.vx) * 0.5, b.y + 0.6, 0.2), e.p.color, { count: 1, size: 0.22, life: 0.3, speed: 0.5 }); }
      }
    }
  }

  reachFlag(e) {
    e.state = 'done';
    e.finishTime = this.raceTime;
    this.finishOrder.push(e);
    e.hook = null;
    e.rope.visible = false;
    this.game.audio.play(this.finishOrder.length === 1 ? 'fanfare' : 'star');
    this.confetti.burst(new THREE.Vector3(e.body.x, e.body.y + 2, 0), 0, { count: 50, speed: 8, colors: [e.p.color, COLORS.gold, COLORS.white] });
    this.game.ui.toast(t('runner.finished', { name: e.p.name, ord: ord(this.finishOrder.length - 1) }));
    if (this.finishTimer === null) this.finishTimer = FINISH_WAIT;
  }

  updateCamera(dt) {
    this.camDist = this.fitDistance(VIEW_W, VIEW_H);
    const half = this.viewHalfSize(this.camDist).w;
    const playing = this.leader();
    const lead = playing || this.ents.find((e) => e.state === 'done') || this.ents[0];
    // Follow the leader, keeping them a bit right of center so you see what is coming.
    // If everyone is bubbling back, settle on the furthest checkpoint instead.
    const focusX = playing || lead.state === 'done' ? lead.body.x : this.checkpoint.x;
    const want = Math.min(this.course.width - half, Math.max(half - 4, focusX + 4));
    const next = THREE.MathUtils.lerp(this.camX, want, Math.min(1, dt * 3));
    this.camX = playing ? Math.max(this.camX, next) : next;
    const ys = this.ents.filter((e) => e.state === 'play').map((e) => e.body.y);
    const avgY = ys.length ? ys.reduce((a, v) => a + v, 0) / ys.length : lead.body.y;
    const wantY = THREE.MathUtils.clamp(Math.max(avgY, lead.body.y - 2) + 2.5, 5, 13);
    this.camY = THREE.MathUtils.lerp(this.camY, wantY, Math.min(1, dt * 2.5));
    this.camera.position.set(this.camX, this.camY + 1.5, this.camDist);
    this.camera.lookAt(this.camX, this.camY, 0);
    this.sun.position.set(this.camX - 15, 30, 20);
    this.sun.target.position.set(this.camX, 0, 0);
    this.confettiOrigin = new THREE.Vector3(this.camX, this.camY, 0);
  }

  end() {
    if (this.state === 'results') return;
    const ranked = [...this.ents].sort((a, b) => {
      const fa = this.finishOrder.indexOf(a), fb = this.finishOrder.indexOf(b);
      if (fa >= 0 && fb >= 0) return fa - fb;
      if (fa >= 0) return -1;
      if (fb >= 0) return 1;
      return b.body.x - a.body.x;
    });
    for (const sg of this.signLabels) sg.el.style.display = 'none';
    this.finish({
      title: this.ents.length === 1 ? t('runner.solo') : t('kart.winsRace', { name: ranked[0].p.name }),
      subtitle: t('runner.sub'),
      rows: ranked.map((e, i) => ({
        css: e.p.css, name: e.p.name, value: ord(i),
        detail: e.state === 'done' ? `${e.finishTime.toFixed(1)} s` : t('runner.left', { n: Math.max(0, Math.round(this.course.flag.x - e.body.x)) }),
        crown: i === 0,
      })),
      stars: 2,
    });
  }

  update(dt) {
    if (this.state === 'play') this.raceTime += dt;
    this.updatePlayers(dt);
    this.updateCamera(dt);
    for (const h of this.hooks) {
      h.g.position.y = h.y + Math.sin(this.time * 2 + h.x) * 0.15;
      const anyNear = this.ents.some((e) => e.state === 'play' && !e.body.grounded && this.nearestHook(e.body) === h);
      h.ring.scale.setScalar(anyNear ? 1.35 + Math.sin(this.time * 12) * 0.1 : 1);
    }
    for (const sp of this.springs) {
      sp.squish = Math.max(0, sp.squish - dt * 4);
      sp.m.scale.set(1, 1 - sp.squish * 0.5, 1);
    }
    this.flagCloth.rotation.y = Math.sin(this.time * 4) * 0.2;
    for (const sg of this.signLabels) {
      if (sg.el.dataset.text !== t(sg.key)) { sg.el.textContent = t(sg.key); sg.el.dataset.text = t(sg.key); }
      this.game.ui.place(sg.el, sg.pos, this.camera);
    }
    if (this.updateResults(dt)) return;
    // Progress chips: distance to the flag.
    this.game.ui.bar(this.players, (p) => {
      const e = this.ents.find((x) => x.p === p);
      if (e.state === 'done') return ord(this.finishOrder.indexOf(e));
      return `${Math.max(0, Math.round(this.course.flag.x - e.body.x))} m`;
    });
    if (this.state === 'play') {
      if (this.raceTime > MAX_TIME) { this.end(); return; }
      let top = `<div class="pill"><b>${this.raceTime.toFixed(1)}</b> s</div>`;
      if (this.finishTimer !== null) {
        this.finishTimer -= dt;
        const left = this.ents.filter((e) => e.state !== 'done').length;
        if (left === 0 || this.finishTimer <= 0) { this.end(); return; }
        top += `<div class="pill">${t('kart.closes')} <b>${Math.ceil(this.finishTimer)}</b></div>`;
      }
      this.game.ui.setTop(top);
    }
  }
}
