import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { MiniGame } from '../core/minigame.js';
import { Character } from '../core/character.js';
import { COLORS, PLAYER_COLORS, toon, sharedGeo } from '../core/palette.js';
import { addLights, skyTexture, makeCloud, makeTree, seeded } from '../core/world.js';
import { moveBody, platformerControl, boxesTouch } from '../core/physics2d.js';

// TowerFall-style arena. 26 x 15 tiles; open edges wrap around.
// #  block   =  one-way ledge   s  spawn point
const MAP = [
  '##########......##########',
  '#........................#',
  '#..s..................s..#',
  '......====......====......',
  '..........................',
  '#.........######.........#',
  '#............s...........#',
  '#..#####..........#####..#',
  '...s..................s...',
  '..........................',
  '#.....======..======.....#',
  '#........................#',
  '#...s................s...#',
  '#...###............###...#',
  '##########......##########',
];
const COLS = MAP[0].length, ROWS = MAP.length;
const HALF_W = COLS / 2;
const ROUND_TIME = 90;
const MAX_ARROWS = 5;
const START_ARROWS = 3;
const ARROW_SPEED = 21;

const PHYS = {
  speed: 7.5, accel: 70, airAccel: 45, jump: 16, jump2: 12.5, doubleJump: true,
  gravity: 38, fallMul: 1.5, coyote: 0.12, buffer: 0.15, maxFall: -18,
};

const tileX = (c) => c - HALF_W;
const tileY = (r) => ROWS - 1 - r;

export class ArchersScene extends MiniGame {
  constructor(game, opts) {
    super(game, opts);
    this.scene.background = skyTexture('#ffbe7a', '#fff1d6');
    addLights(this.scene, { size: 20, target: new THREE.Vector3(0, 7, 0), dir: new THREE.Vector3(-0.4, 0.8, 1) });

    this.solids = [];
    this.spawns = [];
    this.arrows = [];
    this.targets = [];
    this.timeLeft = ROUND_TIME;
    this.solo = this.players.length === 1;
    this.buildArena();

    this.ents = this.players.map((p, i) => {
      const ch = new Character(p.color, { hat: p.hat });
      this.scene.add(ch.group);
      const balloon = this.makeBalloon(p.color);
      ch.group.add(balloon);
      const quiver = new THREE.Group();
      quiver.position.y = 2.75;
      for (let k = 0; k < MAX_ARROWS; k++) {
        const pip = new THREE.Mesh(sharedGeo('pip', () => new THREE.ConeGeometry(0.07, 0.22, 6)), toon(COLORS.white));
        pip.position.x = (k - (MAX_ARROWS - 1) / 2) * 0.17;
        quiver.add(pip);
      }
      this.scene.add(quiver);
      const aim = new THREE.Mesh(sharedGeo('aimTri', () => new THREE.ConeGeometry(0.14, 0.32, 3)), toon(p.color));
      this.scene.add(aim);
      const bubble = new THREE.Mesh(sharedGeo('abubble', () => new THREE.SphereGeometry(0.85, 22, 16)), toon(p.color, { transparent: true, opacity: 0.35 }));
      bubble.visible = false;
      this.scene.add(bubble);
      const sp = this.spawns[i % this.spawns.length];
      return {
        p, ch, balloon, quiver, aim, bubble,
        body: { x: sp.x, y: sp.y, w: 0.7, h: 1.1, vx: 0, vy: 0, grounded: true },
        facing: sp.x < 0 ? 1 : -1, aimX: 1, aimY: 0,
        state: 'play', t: 0, invuln: 0, arrows: START_ARROWS, shootCd: 0, refillT: 0,
        pops: 0, popped: 0,
      };
    });

    this.frame();
    game.audio.playMusic('bubble');
    this.intro('Balloon Archers', 'Stick: aim · B: shoot · pop balloons, jump on heads, grab your arrows back');
  }

  onStart() {
    if (this.solo) for (let i = 0; i < 4; i++) this.spawnTarget();
  }

  frame() {
    const d = this.fitDistance(COLS + 2, ROWS + 4.5);
    this.camera.position.set(0, ROWS / 2 - 0.9, d);
    this.camera.lookAt(0, ROWS / 2 - 0.9, 0);
    this.confettiOrigin = new THREE.Vector3(0, 9, 0);
  }

  resize(w, h) {
    super.resize(w, h);
    this.frame();
  }

  makeBalloon(color) {
    const g = new THREE.Group();
    const ball = new THREE.Mesh(sharedGeo('aBalloon', () => new THREE.SphereGeometry(0.32, 16, 12)), toon(color));
    ball.scale.y = 1.2;
    ball.position.y = 2.2;
    ball.castShadow = true;
    const knot = new THREE.Mesh(sharedGeo('aKnot', () => new THREE.ConeGeometry(0.07, 0.1, 6)), toon(color));
    knot.position.y = 1.8;
    const string = new THREE.Mesh(sharedGeo('aString', () => new THREE.CylinderGeometry(0.012, 0.012, 0.6, 4)), toon(COLORS.ink));
    string.position.y = 1.5;
    const shine = new THREE.Mesh(sharedGeo('aShine', () => new THREE.SphereGeometry(0.07, 8, 6)), toon(COLORS.white));
    shine.position.set(-0.12, 2.35, 0.25);
    g.add(ball, knot, string, shine);
    g.position.x = -0.15;
    return g;
  }

  buildArena() {
    const s = this.scene;
    for (let r = 0; r < ROWS; r++) {
      let run = -1;
      let ledge = -1;
      for (let c = 0; c <= COLS; c++) {
        const ch = c < COLS ? MAP[r][c] : '.';
        if (ch === '#') { if (run < 0) run = c; } else if (run >= 0) { this.addBlock(run, r, c - run); run = -1; }
        if (ch === '=') { if (ledge < 0) ledge = c; } else if (ledge >= 0) { this.addLedge(ledge, r, c - ledge); ledge = -1; }
        if (ch === 's') this.spawns.push({ x: tileX(c) + 0.5, y: tileY(r) });
      }
    }
    const rand = seeded(23);
    // Big tree trunks and leafy canopy behind the arena.
    for (const x of [-11, 11]) {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.2, 22, 12), toon(COLORS.trunk));
      trunk.position.set(x, 6, -5);
      s.add(trunk);
    }
    for (let i = 0; i < 12; i++) {
      const t = makeTree(rand, 2.5 + rand() * 2, [0x58b947, 0x7ad65a, 0x4cc46a]);
      t.position.set(-24 + rand() * 48, -4 + rand() * 4, -12 - rand() * 8);
      s.add(t);
    }
    for (let i = 0; i < 6; i++) {
      const c = makeCloud(rand, 1.6 + rand());
      c.position.set(-30 + i * 12, 15 + rand() * 4, -14);
      s.add(c);
    }
    const back = new THREE.Mesh(new THREE.PlaneGeometry(COLS + 6, ROWS + 4), toon(0xffe2b8));
    back.position.set(0, ROWS / 2 - 0.5, -1.6);
    s.add(back);
    for (let i = 0; i < 18; i++) {
      const leaf = new THREE.Mesh(sharedGeo('archLeaf', () => new THREE.CircleGeometry(1, 6)), toon(i % 2 ? 0xffd39a : 0xffcb8a));
      leaf.position.set(-13 + rand() * 26, rand() * 15, -1.55 + i * 0.001);
      leaf.scale.setScalar(0.5 + rand() * 1.4);
      s.add(leaf);
    }
  }

  addBlock(c0, r, len) {
    const x = tileX(c0), y = tileY(r);
    this.solids.push({ x, y, w: len, h: 1 });
    const m = new THREE.Mesh(new RoundedBoxGeometry(len, 1, 2.6, 2, 0.12), toon(COLORS.dirt));
    m.position.set(x + len / 2, y + 0.5, 0);
    m.castShadow = m.receiveShadow = true;
    this.scene.add(m);
    if (r > 0 && MAP[r - 1].slice(c0, c0 + len).split('').some((ch) => ch !== '#')) {
      const top = new THREE.Mesh(new RoundedBoxGeometry(len + 0.08, 0.3, 2.7, 2, 0.1), toon(COLORS.grass));
      top.position.set(x + len / 2, y + 0.92, 0);
      top.receiveShadow = true;
      this.scene.add(top);
    }
  }

  addLedge(c0, r, len) {
    const x = tileX(c0), y = tileY(r);
    this.solids.push({ x, y: y + 0.6, w: len, h: 0.4, oneWay: true });
    const m = new THREE.Mesh(new RoundedBoxGeometry(len, 0.35, 2.2, 2, 0.1), toon(0xc98b5a));
    m.position.set(x + len / 2, y + 0.82, 0);
    m.castShadow = m.receiveShadow = true;
    this.scene.add(m);
    for (let i = 0; i <= len; i += 2) {
      const rope = new THREE.Mesh(sharedGeo('rope', () => new THREE.CylinderGeometry(0.04, 0.04, 1.2, 5)), toon(0xf7e1a6));
      rope.position.set(x + i, y + 1.4, -0.9);
      this.scene.add(rope);
    }
  }

  isSolidAt(x, y) {
    for (const s of this.solids) {
      if (s.oneWay) continue;
      if (x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h) return true;
    }
    return false;
  }

  /** The arena is a torus: leaving one edge brings you in at the opposite one. */
  wrap(o) {
    if (o.x < -HALF_W) o.x += COLS;
    else if (o.x > HALF_W) o.x -= COLS;
    if (o.y < -1.5) o.y += ROWS;
    else if (o.y > ROWS - 1.5) o.y -= ROWS;
  }

  // ---------- arrows ----------

  shoot(ent) {
    if (ent.arrows <= 0) {
      this.game.audio.play('bump');
      return;
    }
    ent.arrows--;
    const len = Math.hypot(ent.aimX, ent.aimY) || 1;
    const dx = ent.aimX / len, dy = ent.aimY / len;
    const mesh = this.makeArrow(ent.p.color);
    this.scene.add(mesh);
    this.arrows.push({
      owner: ent, mesh, state: 'fly', t: 0,
      x: ent.body.x + dx * 0.6, y: ent.body.y + 0.6 + dy * 0.6,
      vx: dx * ARROW_SPEED + ent.body.vx * 0.2, vy: dy * ARROW_SPEED,
    });
    ent.ch.squash(0.85);
    this.game.audio.play('dash');
  }

  makeArrow(color) {
    const g = new THREE.Group();
    const shaft = new THREE.Mesh(sharedGeo('shaft', () => new THREE.CylinderGeometry(0.035, 0.035, 0.9, 6)), toon(COLORS.icing));
    shaft.rotation.z = Math.PI / 2;
    const cup = new THREE.Mesh(sharedGeo('cup', () => new THREE.SphereGeometry(0.12, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2)), toon(color));
    cup.rotation.z = -Math.PI / 2;
    cup.position.x = 0.48;
    const fl = new THREE.Mesh(sharedGeo('fletch', () => new THREE.ConeGeometry(0.12, 0.25, 3)), toon(color));
    fl.rotation.z = Math.PI / 2;
    fl.position.x = -0.42;
    g.add(shaft, cup, fl);
    return g;
  }

  updateArrows(dt) {
    for (const a of this.arrows) {
      a.t += dt;
      if (a.state === 'fly' || a.state === 'drop') {
        const steps = 3;
        for (let i = 0; i < steps && (a.state === 'fly' || a.state === 'drop'); i++) {
          a.vy -= (a.state === 'fly' ? 7 : 30) * (dt / steps);
          a.x += a.vx * (dt / steps);
          a.y += a.vy * (dt / steps);
          this.wrap(a);
          const ang = Math.atan2(a.vy, a.vx);
          const tipX = a.x + Math.cos(ang) * 0.45, tipY = a.y + Math.sin(ang) * 0.45;
          if (this.isSolidAt(tipX, tipY) || (a.state === 'drop' && this.isSolidAt(a.x, a.y - 0.1))) {
            a.state = 'stuck';
            a.stuckT = 0;
            a.vx = a.vy = 0;
            this.puffs.burst(new THREE.Vector3(tipX, tipY, 0.3), 0xffffff, { count: 4, size: 0.15, life: 0.3 });
            break;
          }
          if (a.state === 'fly') this.arrowHits(a, tipX, tipY);
        }
        if (a.state === 'fly' || a.state === 'drop') a.mesh.rotation.z = Math.atan2(a.vy, a.vx);
      } else if (a.state === 'stuck') {
        // Old arrows fade away so the arena never fills up.
        a.stuckT += dt;
        if (a.stuckT > 12) a.mesh.scale.setScalar(Math.max(0.01, 1 - (a.stuckT - 12)));
        if (a.stuckT > 13) a.state = 'gone';
        // Pickup by touch.
        for (const e of this.ents) {
          if (e.state !== 'play' || e.arrows >= MAX_ARROWS) continue;
          if (Math.abs(e.body.x - a.x) < 0.8 && a.y > e.body.y - 0.6 && a.y < e.body.y + 1.6) {
            e.arrows++;
            a.state = 'gone';
            this.game.audio.play('coin');
            break;
          }
        }
      }
      a.mesh.position.set(a.x, a.y, 0.2);
      if (a.state === 'gone') this.scene.remove(a.mesh);
    }
    this.arrows = this.arrows.filter((a) => a.state !== 'gone');
  }

  arrowHits(a, tx, ty) {
    for (const e of this.ents) {
      if (e === a.owner || e.state !== 'play' || e.invuln > 0) continue;
      const bx = e.body.x - 0.15, by = e.body.y + 2.2;
      const hitBalloon = Math.hypot(tx - bx, ty - by) < 0.55;
      const hitBody = Math.abs(tx - e.body.x) < 0.45 && ty > e.body.y && ty < e.body.y + 1.2;
      if (hitBalloon || hitBody) {
        this.pop(e, a.owner);
        a.state = 'drop';
        a.vx *= -0.2;
        a.vy = 4;
        return;
      }
    }
    for (const t of this.targets) {
      if (!t.alive) continue;
      if (Math.hypot(tx - t.cx, ty - t.cy) < 0.6) {
        t.alive = false;
        this.scene.remove(t.mesh);
        a.owner.pops++;
        this.game.audio.play('pop');
        this.confetti.burst(new THREE.Vector3(t.cx, t.cy, 0.3), 0, { count: 16, speed: 5, colors: PLAYER_COLORS.map((c) => c.hex) });
        this.later(1.2, () => this.state === 'play' && this.spawnTarget());
      }
    }
  }

  spawnTarget() {
    const color = PLAYER_COLORS[Math.floor(Math.random() * 6)].hex;
    const mesh = this.makeBalloon(color);
    mesh.position.y = -2.2;
    const g = new THREE.Group();
    g.add(mesh);
    this.scene.add(g);
    const t = { mesh: g, x: (Math.random() - 0.5) * 20, y: 2 + Math.random() * 10, phase: Math.random() * 6, alive: true };
    t.cx = t.x; t.cy = t.y;
    g.position.set(t.x, t.y, 0);
    this.targets.push(t);
  }

  pop(victim, by) {
    victim.state = 'bubble';
    victim.t = 0;
    victim.balloon.visible = false;
    victim.bubble.visible = true;
    victim.popped++;
    victim.body.vx *= 0.3;
    victim.body.vy = 2;
    if (by) {
      by.pops++;
      by.ch.squash(1.25);
    }
    const pos = new THREE.Vector3(victim.body.x, victim.body.y + 2.1, 0.3);
    this.confetti.burst(pos, 0, { count: 22, speed: 6, colors: [victim.p.color, COLORS.white, COLORS.gold] });
    this.game.audio.play('pop');
    // Drop a couple of arrows so the round stays flowing.
    const drop = Math.min(victim.arrows, 2);
    victim.arrows -= drop;
    for (let i = 0; i < drop; i++) {
      const mesh = this.makeArrow(victim.p.color);
      this.scene.add(mesh);
      this.arrows.push({ owner: victim, mesh, state: 'drop', t: 0, x: victim.body.x, y: victim.body.y + 1, vx: (i ? 1 : -1) * 3, vy: 6 });
    }
  }

  respawn(e) {
    let best = this.spawns[0], bestD = -1;
    for (const sp of this.spawns) {
      const d = Math.min(...this.ents.filter((o) => o !== e && o.state === 'play').map((o) => Math.hypot(o.body.x - sp.x, o.body.y - sp.y)), 99);
      const score = d + Math.random() * 3;
      if (score > bestD) { bestD = score; best = sp; }
    }
    e.body.x = best.x;
    e.body.y = best.y;
    e.body.vx = e.body.vy = 0;
    e.state = 'play';
    e.invuln = 1.8;
    e.arrows = Math.max(e.arrows, START_ARROWS);
    e.balloon.visible = true;
    e.bubble.visible = false;
    this.puffs.burst(new THREE.Vector3(best.x, best.y + 0.6, 0.4), e.p.color, { count: 12, size: 0.35 });
  }

  // ---------- players ----------

  updatePlayers(dt) {
    for (const e of this.ents) {
      const inp = this.input(e.p) || { x: 0, y: 0, a: false, aPressed: false, bPressed: false };
      const b = e.body;
      e.invuln = Math.max(0, e.invuln - dt);
      e.shootCd -= dt;
      // A quiver slowly refills to 3, so nobody is ever stuck without arrows.
      if (e.arrows < START_ARROWS && e.state === 'play') {
        e.refillT += dt;
        if (e.refillT > 3) { e.arrows++; e.refillT = 0; }
      } else {
        e.refillT = 0;
      }

      if (e.state === 'bubble') {
        e.t += dt;
        b.vx += (inp.x * 3 - b.vx) * Math.min(1, dt * 3);
        b.vy += (1.5 - b.vy) * Math.min(1, dt * 3);
        b.x += b.vx * dt;
        b.y = Math.min(ROWS - 3, b.y + b.vy * dt);
        this.wrap(b);
        e.bubble.position.set(b.x, b.y + 0.55, 0);
        e.ch.spin += dt * 3;
        if (e.t > 2) this.respawn(e);
      } else {
        e.ch.spin = 0;
        const playing = this.state === 'play';
        const ctrl = playing ? inp : { x: 0, y: 0, a: false, aPressed: false };
        const j = platformerControl(b, ctrl, dt, PHYS);
        if (j) { e.ch.squash(1.3); this.game.audio.play(j === 2 ? 'doubleJump' : 'jump'); }
        if (Math.abs(ctrl.x) > 0.2) e.facing = Math.sign(ctrl.x);
        let ax = Math.abs(inp.x) > 0.4 ? Math.sign(inp.x) : 0;
        let ay = Math.abs(inp.y) > 0.4 ? Math.sign(inp.y) : 0;
        if (b.grounded && ay < 0) ay = 0;
        if (!ax && !ay) ax = e.facing;
        e.aimX = ax; e.aimY = ay;
        if (playing && inp.bPressed && e.shootCd <= 0) { this.shoot(e); e.shootCd = 0.25; }
        moveBody(b, dt, this.solids);
        this.wrap(b);
        if (b.justLanded) e.ch.squash(0.75);
      }

      e.ch.faceSide(e.facing);
      e.ch.group.position.set(b.x, b.y, 0);
      e.ch.group.visible = e.invuln <= 0 || Math.floor(this.time * 14) % 2 === 0;
      e.ch.update(dt, { moving: Math.min(1, Math.abs(b.vx) / PHYS.speed), grounded: b.grounded || e.state === 'bubble', vy: b.vy });
      e.balloon.rotation.z = Math.sin(this.time * 2 + b.x) * 0.1 - b.vx * 0.02;
      e.quiver.position.set(b.x, b.y + 2.85, 0.2);
      e.quiver.visible = e.state === 'play';
      e.quiver.children.forEach((pip, k) => { pip.visible = k < e.arrows; });
      const al = Math.hypot(e.aimX, e.aimY) || 1;
      e.aim.visible = e.state === 'play' && this.state === 'play';
      e.aim.position.set(b.x + (e.aimX / al) * 1.0, b.y + 0.6 + (e.aimY / al) * 1.0, 0.5);
      e.aim.rotation.z = Math.atan2(e.aimY, e.aimX) - Math.PI / 2;
    }

    // Stomps: land on someone's head to pop their balloon.
    if (this.state !== 'play') return;
    for (const a of this.ents) {
      if (a.state !== 'play' || a.body.vy >= 0) continue;
      for (const v of this.ents) {
        if (v === a || v.state !== 'play' || v.invuln > 0) continue;
        if (boxesTouch(a.body, v.body, 0) && a.body.y > v.body.y + 0.75) {
          a.body.vy = 13;
          a.body.jumps = 0;
          this.pop(v, a);
          this.game.audio.play('boing');
        }
      }
    }
  }

  end() {
    for (const e of this.ents) { e.aim.visible = false; }
    const ranked = [...this.ents].sort((a, b) => b.pops - a.pops || a.popped - b.popped);
    const top = ranked[0];
    const tie = ranked.length > 1 && ranked[1].pops === top.pops && ranked[1].popped === top.popped;
    this.finish({
      title: this.solo ? `${top.pops} balloons popped!` : tie ? "It's a tie!" : `${top.p.name} wins!`,
      subtitle: this.solo ? 'Target practice complete' : 'Most balloons popped',
      rows: ranked.map((e) => ({
        css: e.p.css, name: e.p.name, value: `${e.pops} pops`,
        detail: `popped ${e.popped} times`, crown: e.pops === top.pops && e.popped === top.popped && e.pops > 0,
      })),
      stars: 2,
    });
  }

  update(dt) {
    this.updatePlayers(dt);
    if (this.updateResults(dt)) return;
    this.updateArrows(dt);
    for (const t of this.targets) {
      if (!t.alive) continue;
      t.cx = t.x + Math.sin(this.time + t.phase) * 1.2;
      t.cy = t.y + Math.sin(this.time * 1.4 + t.phase) * 0.6;
      t.mesh.position.set(t.cx, t.cy, 0);
    }

    if (this.state === 'play') {
      this.timeLeft -= dt;
      if (this.timeLeft <= 0) { this.timeLeft = 0; this.end(); return; }
    }
    if (this.state !== 'intro') {
      this.game.ui.setTop(`<div class="pill"><span class="big-num">${Math.ceil(this.timeLeft)}</span></div><div class="pill hud-title">Balloon Archers</div>`);
    }
    this.game.ui.bar(this.players, (p) => this.ents.find((e) => e.p === p)?.pops ?? 0);
  }
}
