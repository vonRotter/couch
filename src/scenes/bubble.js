import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { MiniGame } from '../core/minigame.js';
import { t } from '../core/i18n.js';
import { Character } from '../core/character.js';
import { COLORS, toon, sharedGeo } from '../core/palette.js';
import { addLights, skyTexture, makeCloud, seeded } from '../core/world.js';
import { makeGrumble } from '../core/critters.js';
import { moveBody, platformerControl, solidAt, boxesTouch, approach } from '../core/physics2d.js';

// Arena: x in [-13, 13], y in [0, 15]. A gap in the floor wraps you to the top.
const LEFT = -13, RIGHT = 13, TOP = 15;
const WRAP_Y = 13.6;
const WAVES = 3;
const BUBBLE_R = 0.6;

const PHYS = {
  speed: 7, accel: 70, airAccel: 45, jump: 15.5, jump2: 12.5, doubleJump: true,
  gravity: 38, fallMul: 1.5, coyote: 0.12, buffer: 0.15, maxFall: -18,
};

const FRUITS = ['cherry', 'orange', 'grape', 'strawberry', 'banana'];

function makeFruit(kind) {
  const g = new THREE.Group();
  const sph = (r) => sharedGeo(`fruit${r}`, () => new THREE.SphereGeometry(r, 14, 10));
  const leaf = () => {
    const l = new THREE.Mesh(sph(0.1), toon(COLORS.grassDark));
    l.scale.set(1.4, 0.4, 0.8);
    return l;
  };
  switch (kind) {
    case 'cherry': {
      for (const s of [-1, 1]) {
        const c = new THREE.Mesh(sph(0.18), toon(0xff3b5c));
        c.position.set(s * 0.15, 0.18, 0);
        g.add(c);
      }
      const st = new THREE.Mesh(sharedGeo('cherryStem', () => new THREE.TorusGeometry(0.2, 0.025, 6, 12, Math.PI)), toon(COLORS.grassDark));
      st.position.y = 0.32;
      g.add(st);
      break;
    }
    case 'orange': {
      const o = new THREE.Mesh(sph(0.26), toon(0xff9a1f));
      o.position.y = 0.26;
      const l = leaf();
      l.position.set(0.08, 0.53, 0);
      g.add(o, l);
      break;
    }
    case 'grape': {
      const pts = [[0, 0.5], [-0.12, 0.38], [0.12, 0.38], [0, 0.26], [-0.1, 0.15], [0.1, 0.15], [0, 0.05]];
      for (const [x, y] of pts) {
        const b = new THREE.Mesh(sph(0.1), toon(0x9b5de5));
        b.position.set(x, y + 0.05, 0.02 * Math.sin(x * 30));
        g.add(b);
      }
      break;
    }
    case 'strawberry': {
      const b = new THREE.Mesh(sharedGeo('strawb', () => new THREE.ConeGeometry(0.22, 0.42, 12)), toon(0xff4060));
      b.rotation.z = Math.PI;
      b.position.y = 0.24;
      const top = new THREE.Mesh(sph(0.14), toon(COLORS.grassDark));
      top.scale.set(1.3, 0.35, 1.3);
      top.position.y = 0.45;
      g.add(b, top);
      break;
    }
    default: {
      const b = new THREE.Mesh(sharedGeo('banana', () => new THREE.TorusGeometry(0.28, 0.09, 8, 14, Math.PI * 0.9)), toon(0xffe14d));
      b.rotation.z = Math.PI + 0.15;
      b.position.y = 0.36;
      g.add(b);
    }
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

export class BubbleScene extends MiniGame {
  constructor(game, opts) {
    super(game, opts);
    this.scene.background = skyTexture('#ffc8ec', '#c9f3ff');
    addLights(this.scene, { size: 20, target: new THREE.Vector3(0, 7, 0), dir: new THREE.Vector3(-0.4, 0.8, 1) });

    this.solids = [];
    this.buildArena();

    this.bubbles = [];
    this.enemies = [];
    this.fruits = [];
    this.wave = 0;
    this.spawnQueue = 0;
    this.spawnTimer = 0;
    this.waveDone = false;
    this.teamScore = 0;

    const spots = [-10, 10, -6.5, 6.5, -4, 4];
    this.ents = this.players.map((p, i) => {
      const ch = new Character(p.color, { hat: p.hat });
      this.scene.add(ch.group);
      const x = spots[i % spots.length];
      const bubble = new THREE.Mesh(sharedGeo('pbubble', () => new THREE.SphereGeometry(0.85, 22, 16)), toon(p.color, { transparent: true, opacity: 0.35 }));
      bubble.visible = false;
      this.scene.add(bubble);
      return {
        p, ch, bubble,
        body: { x, y: 0, w: 0.7, h: 1.1, vx: 0, vy: 0, grounded: true },
        facing: x < 0 ? 1 : -1,
        state: 'play', bubbledT: 0, invuln: 0, shootCd: 0,
        score: 0, fruits: 0, rescues: 0,
      };
    });

    this.frame();
    game.audio.playMusic('bubble');
    this.intro(t('game.bubble'), t('bubble.intro')).then(() => {});
  }

  onStart() {
    this.nextWave();
  }

  frame() {
    const d = this.fitDistance(RIGHT - LEFT + 3, TOP + 5);
    this.camera.position.set(0, TOP / 2 - 0.6, d);
    this.camera.lookAt(0, TOP / 2 - 0.6, 0);
    this.confettiOrigin = new THREE.Vector3(0, 9, 0);
  }

  resize(w, h) {
    super.resize(w, h);
    this.frame();
  }

  buildArena() {
    const s = this.scene;
    const add = (x, y, w, h, color, oneWay = false, icing = true) => {
      this.solids.push({ x, y, w, h, oneWay });
      const depth = 2.6;
      const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, depth, 3, Math.min(0.22, h / 2.2)), toon(color));
      m.position.set(x + w / 2, y + h / 2, 0);
      m.castShadow = m.receiveShadow = true;
      s.add(m);
      if (icing) {
        const ic = new THREE.Mesh(new RoundedBoxGeometry(w + 0.12, 0.2, depth + 0.12, 2, 0.08), toon(COLORS.icing));
        ic.position.set(x + w / 2, y + h - 0.05, 0);
        ic.receiveShadow = true;
        s.add(ic);
        const drips = Math.floor(w / 1.2);
        for (let i = 0; i < drips; i++) {
          const dr = new THREE.Mesh(sharedGeo('drip2', () => new THREE.SphereGeometry(0.14, 10, 8)), toon(COLORS.icing));
          dr.position.set(x + 0.6 + i * 1.2 + Math.sin(i * 3.1) * 0.2, y + h - 0.2, depth / 2 + 0.02);
          dr.scale.set(1, 1.5 + Math.sin(i * 7.3) * 0.5, 0.6);
          s.add(dr);
        }
      }
    };
    // Floor with a gap in the middle, walls, ceiling.
    add(-14, -1.2, 12, 1.2, COLORS.candyLilac);
    add(2, -1.2, 12, 1.2, COLORS.candyLilac);
    add(-14.6, -1.2, 1.6, 17.4, COLORS.candyPink, false, false);
    add(13, -1.2, 1.6, 17.4, COLORS.candyPink, false, false);
    add(-14.6, 15, 29.2, 1, COLORS.candyBlue, false, false);
    // One-way candy platforms.
    const P = (x0, x1, top, c) => add(x0, top - 0.5, x1 - x0, 0.5, c, true);
    P(-11, -5, 3.5, COLORS.candyMint);
    P(5, 11, 3.5, COLORS.candyMint);
    P(-13, -9.5, 6.5, COLORS.candyYellow);
    P(-4, 4, 6.5, COLORS.candyYellow);
    P(9.5, 13, 6.5, COLORS.candyYellow);
    P(-10, -4, 9.5, COLORS.candyBlue);
    P(4, 10, 9.5, COLORS.candyBlue);
    P(-2.5, 2.5, 12.3, COLORS.candyPink);

    // Back wall with soft polka dots.
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(31, 18), toon(0xfff0fa));
    wall.position.set(0, 7, -1.4);
    s.add(wall);
    const rand = seeded(17);
    const dotCols = [0xffd6ec, 0xd6f1ff, 0xfff1c2, 0xdcffe9, 0xeadcff];
    for (let i = 0; i < 26; i++) {
      const d = new THREE.Mesh(sharedGeo('dot', () => new THREE.CircleGeometry(1, 24)), toon(dotCols[i % dotCols.length]));
      d.position.set(-14 + rand() * 28, rand() * 15, -1.38 + i * 0.001);
      d.scale.setScalar(0.4 + rand() * 1.2);
      s.add(d);
    }
    // Gap arrows hint at the wrap.
    for (const y of [-0.6, 14.6]) {
      const arrow = new THREE.Mesh(sharedGeo('arrow', () => new THREE.ConeGeometry(0.35, 0.6, 3)), toon(COLORS.white));
      arrow.position.set(0, y, 0.8);
      arrow.rotation.z = Math.PI;
      s.add(arrow);
    }
    for (let i = 0; i < 5; i++) {
      const c = makeCloud(rand, 1.5 + rand());
      c.position.set(-28 + i * 14, 16 + rand() * 5, -8);
      s.add(c);
    }
  }

  nextWave() {
    this.wave++;
    this.waveDone = false;
    this.waveTime = 0;
    this.sleepyWave = false;
    this.spawnQueue = 3 + this.players.length + (this.wave - 1) * 2;
    this.spawnTimer = 0.5;
    this.game.ui.banner(t('bubble.wave', { n: this.wave }), this.wave === WAVES ? t('bubble.last') : '', 1300);
  }

  spawnEnemy() {
    const mesh = makeGrumble();
    this.scene.add(mesh);
    const x = (Math.random() - 0.5) * 16;
    const e = {
      mesh,
      body: { x, y: WRAP_Y, w: 0.8, h: 0.85, vx: 0, vy: 0, grounded: false },
      dir: Math.random() < 0.5 ? -1 : 1,
      speed: 2.1 + this.wave * 0.35,
      state: 'walk', jumpT: 1.5 + Math.random() * 2, edgeCd: 0, angry: false, grace: 0.6, sleepy: false,
    };
    this.puffs.burst(new THREE.Vector3(x, WRAP_Y + 0.4, 0.5), 0xffffff, { count: 10, size: 0.45 });
    this.enemies.push(e);
  }

  shoot(ent) {
    const b = ent.body;
    const mesh = new THREE.Group();
    const shell = new THREE.Mesh(sharedGeo('bubble', () => new THREE.SphereGeometry(BUBBLE_R, 22, 16)), toon(ent.p.color, { transparent: true, opacity: 0.38 }));
    const shine = new THREE.Mesh(sharedGeo('shine', () => new THREE.SphereGeometry(0.12, 8, 6)), toon(COLORS.white));
    shine.position.set(-0.25, 0.25, 0.42);
    shine.scale.set(1, 0.6, 0.5);
    mesh.add(shell, shine);
    this.scene.add(mesh);
    this.bubbles.push({
      mesh, owner: ent, x: b.x + ent.facing * 0.5, y: b.y + 0.6,
      vx: ent.facing * 15, vy: 0, t: 0, state: 'shoot', trapped: null, seed: Math.random() * 6, squish: 0,
    });
    this.game.audio.play('bubble');
  }

  popBubble(bub, popper, chain = 0) {
    if (bub.dead) return;
    bub.dead = true;
    this.scene.remove(bub.mesh);
    const pos = new THREE.Vector3(bub.x, bub.y, 0.3);
    this.puffs.burst(pos, 0xffffff, { count: 8, speed: 3, size: 0.25, life: 0.5, gravity: 0 });
    this.game.audio.play('pop');
    if (bub.trapped) {
      const e = bub.trapped;
      e.state = 'gone';
      this.scene.remove(e.mesh);
      this.confetti.burst(pos, 0, { count: 18, speed: 6, colors: [0xff5d73, 0xffc93c, 0x3ddc97, 0x4cc9f0] });
      this.spawnFruit(bub.x, bub.y);
      if (popper) this.addScore(popper, 50 + chain * 50);
      // Chain reaction: nearby trapped bubbles pop too.
      for (const other of this.bubbles) {
        if (!other.dead && other.trapped && Math.hypot(other.x - bub.x, other.y - bub.y) < 2.4) {
          this.popBubble(other, popper, chain + 1);
        }
      }
      if (chain === 1) this.game.ui.toast(t('bubble.chain'));
    } else if (popper) {
      this.addScore(popper, 10);
    }
  }

  spawnFruit(x, y) {
    const kind = FRUITS[Math.floor(Math.random() * FRUITS.length)];
    const mesh = makeFruit(kind);
    this.scene.add(mesh);
    this.fruits.push({
      mesh, life: 12,
      body: { x, y: y - 0.3, w: 0.6, h: 0.6, vx: (Math.random() - 0.5) * 7, vy: 9, grounded: false },
    });
  }

  addScore(ent, n) {
    ent.score += n;
    this.teamScore += n;
  }

  bubblePlayer(ent) {
    ent.state = 'bubbled';
    ent.bubbledT = 2.6;
    ent.body.vy = 0;
    ent.bubble.visible = true;
    this.game.audio.play('dizzy');
  }

  freePlayer(ent, rescuer = null) {
    ent.state = 'play';
    ent.invuln = 1.6;
    ent.body.vy = 7;
    ent.bubble.visible = false;
    ent.ch.squash(1.3);
    const pos = new THREE.Vector3(ent.body.x, ent.body.y + 0.6, 0.4);
    this.puffs.burst(pos, ent.p.color, { count: 10, size: 0.3 });
    if (rescuer) {
      rescuer.rescues++;
      this.addScore(rescuer, 50);
      this.game.audio.play('rescue');
      this.confetti.burst(pos, rescuer.p.color, { count: 14, speed: 5 });
    } else {
      this.game.audio.play('pop');
    }
  }

  wrap(body) {
    if (body.y < -2.2) body.y = WRAP_Y;
    body.x = THREE.MathUtils.clamp(body.x, LEFT + body.w / 2, RIGHT - body.w / 2);
  }

  updatePlayers(dt) {
    for (const ent of this.ents) {
      const inp = this.input(ent.p) || { x: 0, y: 0, a: false, aPressed: false, bPressed: false };
      const b = ent.body;
      ent.invuln = Math.max(0, ent.invuln - dt);
      ent.shootCd -= dt;

      if (ent.state === 'bubbled') {
        ent.bubbledT -= dt;
        if (inp.aPressed || inp.bPressed) ent.bubbledT -= 0.3;
        b.vx = approach(b.vx, inp.x * 2.5, 10 * dt);
        b.vy = approach(b.vy, 1.2, 5 * dt);
        b.x += b.vx * dt;
        b.y = Math.min(b.y + b.vy * dt, WRAP_Y - 0.5);
        this.wrap(b);
        if (ent.bubbledT <= 0) this.freePlayer(ent);
        ent.bubble.position.set(b.x, b.y + 0.55, 0);
        ent.bubble.scale.setScalar(1 + Math.sin(this.time * 7) * 0.05);
        ent.ch.spin += dt * 3;
      } else {
        ent.ch.spin = 0;
        if (this.state === 'play') {
          const j = platformerControl(b, inp, dt, PHYS);
          if (j) { ent.ch.squash(1.3); this.game.audio.play(j === 2 ? 'doubleJump' : 'jump'); }
          if (inp.bPressed && ent.shootCd <= 0) { this.shoot(ent); ent.shootCd = 0.32; ent.ch.squash(0.8); }
        } else {
          platformerControl(b, { x: 0, y: 0, a: false, aPressed: false }, dt, PHYS);
        }
        if (Math.abs(inp.x) > 0.2 && this.state === 'play') ent.facing = Math.sign(inp.x);
        moveBody(b, dt, this.solids);
        this.wrap(b);
        if (b.justLanded) { ent.ch.squash(0.75); }
      }

      ent.ch.faceSide(ent.facing);
      ent.ch.group.position.set(b.x, b.y, 0);
      ent.ch.group.visible = ent.invuln <= 0 || Math.floor(this.time * 14) % 2 === 0;
      ent.ch.update(dt, { moving: Math.min(1, Math.abs(b.vx) / PHYS.speed), grounded: b.grounded || ent.state === 'bubbled', vy: b.vy });
    }

    // Rescue: touch a bubbled friend.
    for (const a of this.ents) {
      if (a.state !== 'bubbled') continue;
      for (const r of this.ents) {
        if (r === a || r.state !== 'play') continue;
        if (Math.hypot(r.body.x - a.body.x, r.body.y - a.body.y) < 1.3) { this.freePlayer(a, r); break; }
      }
    }
  }

  updateBubbles(dt) {
    for (const bub of this.bubbles) {
      if (bub.dead) continue;
      bub.t += dt;
      if (bub.state === 'shoot') {
        bub.x += bub.vx * dt;
        if (bub.t > 0.3 || bub.x < LEFT + BUBBLE_R || bub.x > RIGHT - BUBBLE_R) {
          bub.state = 'float';
          bub.vx *= 0.1;
        }
        for (const e of this.enemies) {
          if (e.state !== 'walk' || e.grace > 0) continue;
          if (Math.abs(e.body.x - bub.x) < 0.85 && Math.abs(e.body.y + 0.45 - bub.y) < 0.85) {
            e.state = 'trapped';
            bub.trapped = e;
            bub.state = 'float';
            bub.t = 0;
            bub.vx = 0;
            this.game.audio.play('trap');
            break;
          }
        }
      } else {
        bub.vx = approach(bub.vx, Math.sin(bub.t * 1.7 + bub.seed) * 0.7, 6 * dt);
        bub.vy = approach(bub.vy, bub.trapped ? 1.1 : 1.6, 4 * dt);
        bub.x += bub.vx * dt;
        bub.y += bub.vy * dt;
      }
      bub.x = THREE.MathUtils.clamp(bub.x, LEFT + BUBBLE_R, RIGHT - BUBBLE_R);
      bub.y = Math.min(bub.y, TOP - BUBBLE_R - 0.1);

      const life = bub.trapped ? 7 : 8;
      if (bub.t > life) {
        if (bub.trapped) {
          const e = bub.trapped;
          e.state = 'walk';
          e.angry = true;
          e.speed *= 1.35;
          e.grace = 0.8;
          e.body.x = bub.x; e.body.y = bub.y - 0.4; e.body.vy = 4;
          e.mesh.userData.body.material = toon(0xff6b6b, { flat: true });
          bub.trapped = null;
        }
        bub.dead = true;
        this.scene.remove(bub.mesh);
        this.puffs.burst(new THREE.Vector3(bub.x, bub.y, 0.3), 0xffffff, { count: 6, size: 0.2, life: 0.4, gravity: 0 });
        continue;
      }

      // Player contact: trapped bubbles pop, empty ones are bouncy from above.
      for (const ent of this.ents) {
        if (ent.state !== 'play') continue;
        if (bub.state === 'shoot' && bub.owner === ent) continue;
        const b = ent.body;
        const dx = b.x - bub.x, dy = b.y + 0.55 - bub.y;
        if (Math.hypot(dx, dy) > BUBBLE_R + 0.5) continue;
        const above = b.vy <= 0 && b.y > bub.y - 0.15;
        if (above) {
          b.vy = 13;
          b.jumps = 0;
          ent.ch.squash(1.3);
          bub.squish = 1;
          this.game.audio.play('boing');
        }
        if (bub.trapped || (!above && bub.state === 'float')) {
          this.popBubble(bub, ent);
          break;
        }
      }

      bub.squish = Math.max(0, bub.squish - dt * 4);
      const wob = Math.sin(bub.t * 8 + bub.seed) * 0.05;
      const sq = Math.sin(bub.squish * Math.PI) * 0.3;
      bub.mesh.position.set(bub.x, bub.y, 0);
      bub.mesh.scale.set(1 + wob + sq, 1 - wob - sq, 1);
      const warn = bub.t > life - 1.5 && Math.floor(bub.t * 10) % 2 === 0;
      bub.mesh.children[0].visible = !warn;
      if (bub.trapped) {
        const e = bub.trapped;
        e.mesh.position.set(bub.x, bub.y - 0.45, 0);
        e.mesh.rotation.z = Math.sin(this.time * (warn ? 30 : 4)) * 0.3;
        e.body.x = bub.x; e.body.y = bub.y - 0.45;
      }
    }
    this.bubbles = this.bubbles.filter((b) => !b.dead);

    // Bubbles gently push apart so they cluster under the ceiling.
    for (let i = 0; i < this.bubbles.length; i++) {
      for (let j = i + 1; j < this.bubbles.length; j++) {
        const a = this.bubbles[i], b = this.bubbles[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        if (d < BUBBLE_R * 2 && d > 1e-3) {
          const push = (BUBBLE_R * 2 - d) * 0.5;
          a.x -= (dx / d) * push; a.y -= (dy / d) * push;
          b.x += (dx / d) * push; b.y += (dy / d) * push;
        }
      }
    }
  }

  updateEnemies(dt) {
    if (this.state === 'play' && this.spawnQueue > 0) {
      this.spawnTimer -= dt;
      const alive = this.enemies.filter((e) => e.state === 'walk').length;
      if (this.spawnTimer <= 0 && alive < 3 + this.players.length) {
        this.spawnEnemy();
        this.spawnQueue--;
        this.spawnTimer = 0.9;
      }
    }
    if (this.state === 'play') this.waveTime += dt;
    if (this.waveTime > 45 && this.spawnQueue === 0 && !this.sleepyWave) {
      this.sleepyWave = true;
      this.game.ui.toast(t('bubble.sleepy'));
    }
    for (const e of this.enemies) {
      if (e.state !== 'walk') continue;
      const b = e.body;
      e.grace -= dt;
      e.edgeCd -= dt;
      if (this.sleepyWave && this.spawnQueue === 0) e.sleepy = true;
      b.vx = e.sleepy ? 0 : e.dir * e.speed;
      b.vy = Math.max(-16, b.vy - 34 * dt);
      moveBody(b, dt, this.solids);
      if (b.wallHit) e.dir = -b.wallHit;
      this.wrap(b);
      if (b.grounded) {
        if (e.edgeCd <= 0 && !solidAt(this.solids, b.x + e.dir * 0.55, b.y - 0.1)) {
          if (Math.random() < 0.55) e.dir = -e.dir;
          e.edgeCd = 0.6;
        }
        e.jumpT -= dt;
        if (e.jumpT <= 0 && !e.sleepy) {
          b.vy = 14;
          e.jumpT = 2 + Math.random() * 3;
        }
      }
      e.mesh.position.set(b.x, b.y, 0);
      e.mesh.rotation.y = e.dir * 0.8;
      e.mesh.rotation.z = 0;
      e.mesh.userData.body.position.y = 0.45 + Math.abs(Math.sin(this.time * (e.sleepy ? 2 : 10) + b.x)) * 0.08;
      if (e.sleepy) e.mesh.rotation.z = Math.sin(this.time * 1.5) * 0.25;

      if (e.grace > 0 || e.sleepy || this.state !== 'play') continue;
      for (const ent of this.ents) {
        if (ent.state !== 'play' || ent.invuln > 0) continue;
        if (boxesTouch(ent.body, b, -0.12)) this.bubblePlayer(ent);
      }
    }
    this.enemies = this.enemies.filter((e) => e.state !== 'gone');

    if (this.state === 'play' && !this.waveDone && this.spawnQueue === 0 && this.enemies.length === 0) {
      this.waveDone = true;
      this.game.audio.play('star');
      if (this.wave >= WAVES) {
        this.game.ui.banner(t('bubble.allClear'), t('bubble.grab'), 1800);
        this.later(3.2, () => this.end());
      } else {
        this.game.ui.banner(t('bubble.cleared'), '', 1500);
        this.later(3, () => this.state === 'play' && this.nextWave());
      }
    }
  }

  updateFruits(dt) {
    for (const f of this.fruits) {
      const b = f.body;
      f.life -= dt;
      b.vy = Math.max(-16, b.vy - 30 * dt);
      moveBody(b, dt, this.solids);
      if (b.wallHit) b.vx = -b.vx * 0.5;
      if (b.grounded) b.vx *= Math.max(0, 1 - 6 * dt);
      this.wrap(b);
      f.mesh.position.set(b.x, b.y, 0);
      f.mesh.rotation.y += dt * 2;
      f.mesh.visible = f.life > 2 || Math.floor(f.life * 10) % 2 === 0;
      for (const ent of this.ents) {
        if (ent.state !== 'play') continue;
        if (boxesTouch(ent.body, b, 0.1)) {
          f.life = 0;
          ent.fruits++;
          this.addScore(ent, 100);
          this.game.audio.play('coin');
          this.confetti.burst(new THREE.Vector3(b.x, b.y + 0.3, 0.3), ent.p.color, { count: 8, speed: 3, size: 0.12 });
          break;
        }
      }
      if (f.life <= 0) this.scene.remove(f.mesh);
    }
    this.fruits = this.fruits.filter((f) => f.life > 0);
  }

  /** Story campaign: did the team clear every wave, and the team score. */
  campaignStats() {
    return { cleared: this.wave >= WAVES && this.waveDone, waves: this.wave, score: this.teamScore };
  }

  end() {
    const ranked = [...this.ents].sort((a, b) => b.score - a.score);
    this.finish({
      title: t('bubble.title'),
      subtitle: t('bubble.sub', { n: this.teamScore }),
      rows: ranked.map((e, i) => ({
        css: e.p.css, name: e.p.name, value: e.score,
        detail: t('bubble.detail', { f: e.fruits, r: e.rescues }), crown: i === 0 && e.score > 0,
      })),
      stars: 3,
    });
  }

  update(dt) {
    this.updatePlayers(dt);
    if (this.updateResults(dt)) return;
    this.updateBubbles(dt);
    this.updateEnemies(dt);
    this.updateFruits(dt);
    if (this.state !== 'intro') {
      this.game.ui.setTop(`<div class="pill hud-title">${t('bubble.hudWave', { n: Math.max(1, this.wave), m: WAVES })}</div><div class="pill">${t('team')} <b>${this.teamScore}</b></div>`);
    }
    this.game.ui.bar(this.players, (p) => this.ents.find((e) => e.p === p)?.score ?? 0);
  }
}
