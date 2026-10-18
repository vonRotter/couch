import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { MiniGame } from '../core/minigame.js';
import { Character, darken } from '../core/character.js';
import { COLORS, PLAYER_COLORS, toon, sharedGeo } from '../core/palette.js';
import { addLights, skyTexture, makeCloud, seeded } from '../core/world.js';
import { t } from '../core/i18n.js';
import { esc } from '../core/ui.js';

// Snow slalom: everyone skis down the same slope (toward -z) through flag gates.
const LENGTH = 470;
const HALF_W = 12;
const SLOPE = 0.36; // height drop per unit of z (about 20 degrees, so it reads as a real hill)
const GATE_EVERY = 22;
const GATE_HALF = 2.8;
const MAX_SPEED = 14;
const TUCK_SPEED = 18;
const FINISH_WAIT = 15;
const PR = 0.45;

// The slope flattens out just after the finish line.
const groundY = (z) => SLOPE * Math.max(z, -LENGTH - 6);

/** Triangular prism: half width w, lip height h at -z, half length d; flat bottom on y = 0. */
function wedgeGeometry(w, h, d) {
  const A = [-w, 0, d], B = [w, 0, d], C = [-w, h, -d], D = [w, h, -d], E = [-w, 0, -d], F = [w, 0, -d];
  const tris = [A, B, D, A, D, C, E, C, D, E, D, F, A, C, E, B, F, D, A, E, F, A, F, B];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(tris.flat(), 3));
  g.computeVertexNormals();
  return g;
}

function makeFir(rand, scale = 1) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(sharedGeo('firTrunk', () => new THREE.CylinderGeometry(0.18, 0.22, 0.8, 6)), toon(COLORS.trunk));
  trunk.position.y = 0.4;
  g.add(trunk);
  for (let i = 0; i < 3; i++) {
    const cone = new THREE.Mesh(sharedGeo(`firCone${i}`, () => new THREE.ConeGeometry(1.1 - i * 0.28, 1.2, 7)), toon(i % 2 ? 0x3fa65a : 0x2f8f4e));
    cone.position.y = 1.0 + i * 0.7;
    cone.castShadow = true;
    const snow = new THREE.Mesh(sharedGeo(`firSnow${i}`, () => new THREE.ConeGeometry(0.5 - i * 0.12, 0.45, 7)), toon(COLORS.white));
    snow.position.y = 1.45 + i * 0.7;
    g.add(cone, snow);
  }
  g.scale.setScalar(scale * (0.8 + rand() * 0.5));
  g.rotation.y = rand() * 6;
  return g;
}

export class SlalomScene extends MiniGame {
  constructor(game, opts) {
    super(game, opts);
    this.camera.fov = 50;
    this.camera.far = 800;
    this.camera.updateProjectionMatrix();
    this.scene.background = skyTexture('#7cc7ff', '#eef8ff');
    this.scene.fog = new THREE.Fog(0xe6f4ff, 60, 170);
    this.lights = addLights(this.scene, { size: 40, dir: new THREE.Vector3(-0.4, 1, 0.5) });

    this.gates = [];
    this.bumpers = [];
    this.ramps = [];
    this.finishOrder = [];
    this.finishTimer = null;
    this.camZ = 0;
    this.buildCourse();

    const n = this.players.length;
    this.ents = this.players.map((p, i) => {
      const ch = new Character(p.color, { hat: p.hat });
      for (const sx of [-1, 1]) {
        const ski = new THREE.Mesh(sharedGeo('ski', () => new RoundedBoxGeometry(0.16, 0.06, 1.7, 2, 0.03)), toon(darken(p.color, 0.8)));
        ski.position.set(sx * 0.18, 0.03, 0.1);
        ch.group.add(ski);
      }
      this.scene.add(ch.group);
      const bubble = new THREE.Mesh(sharedGeo('slBubble', () => new THREE.SphereGeometry(0.9, 20, 14)), toon(p.color, { transparent: true, opacity: 0.35 }));
      bubble.visible = false;
      this.scene.add(bubble);
      const x = n === 1 ? 0 : -6 + (i * 12) / (n - 1);
      return {
        p, ch, bubble, x, z: 2, h: 0, vx: 0, vy: 0, speed: 0,
        gates: 0, nextGate: 0, place: 0, finished: false, finishTime: 0,
        state: 'ski', t: 0, boostCd: 0, lean: 0,
      };
    });

    this.updateCamera(1);
    game.audio.playMusic('platformer');
    this.intro(t('game.slalom'), t('slalom.intro'));
  }

  buildCourse() {
    const s = this.scene;
    const total = LENGTH + 120;
    const geo = new THREE.PlaneGeometry(90, total, 30, 120);
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, 0, -total / 2 + 30);
    const pos = geo.attributes.position;
    const rand = seeded(29);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const edge = Math.max(0, Math.abs(x) - HALF_W - 2);
      pos.setY(i, groundY(z) + edge * 0.3 + edge * edge * 0.006 + Math.sin(x * 0.4 + z * 0.1) * 0.15 * Math.min(1, edge));
    }
    geo.computeVertexNormals();
    const snow = new THREE.Mesh(geo, toon(0xf4f9ff));
    snow.receiveShadow = true;
    s.add(snow);

    // Piste edges: orange fence posts.
    for (let z = 0; z > -LENGTH - 10; z -= 6) {
      for (const sx of [-1, 1]) {
        const post = new THREE.Mesh(sharedGeo('fencePost', () => new THREE.CylinderGeometry(0.06, 0.06, 1.1, 5)), toon(0xff8c42));
        post.position.set(sx * (HALF_W + 0.8), groundY(z) + 0.55, z);
        s.add(post);
        const net = new THREE.Mesh(sharedGeo('fenceNet', () => new THREE.BoxGeometry(0.04, 0.5, 6)), toon(0xff8c42, { transparent: true, opacity: 0.55 }));
        net.position.set(sx * (HALF_W + 0.8), groundY(z - 3) + 0.75, z - 3);
        net.rotation.x = -Math.atan(SLOPE);
        s.add(net);
      }
    }

    // Gates alternate left and right.
    const gateCount = Math.floor((LENGTH - 30) / GATE_EVERY);
    for (let i = 0; i < gateCount; i++) {
      const z = -24 - i * GATE_EVERY;
      const side = i % 2 ? 1 : -1;
      const gx = THREE.MathUtils.clamp(side * (2.5 + rand() * 3), -HALF_W + 3, HALF_W - 3);
      const color = i % 2 ? 0x4c9bf0 : 0xff5d73;
      const g = new THREE.Group();
      g.position.set(gx, groundY(z), z);
      for (const sx of [-1, 1]) {
        const pole = new THREE.Mesh(sharedGeo('gatePole', () => new THREE.CylinderGeometry(0.07, 0.07, 1.9, 8)), toon(color));
        pole.position.set(sx * GATE_HALF, 0.95, 0);
        pole.castShadow = true;
        const flag = new THREE.Mesh(sharedGeo('gateFlag', () => new THREE.BoxGeometry(0.9, 0.6, 0.03)), toon(color));
        flag.position.set(sx * (GATE_HALF - 0.45), 1.55, 0);
        g.add(pole, flag);
      }
      s.add(g);
      this.gates.push({ x: gx, z, group: g, color, passedBy: new Set() });
    }

    // Snowmen to steer around, and a few jump ramps.
    for (let i = 0; i < gateCount - 1; i++) {
      const gate = this.gates[i], next = this.gates[i + 1];
      const z = (gate.z + next.z) / 2;
      if (i % 3 === 1) {
        const x = -(gate.x + next.x) / 2 * 0.3 + (rand() - 0.5) * 6;
        this.ramps.push(this.addRamp(THREE.MathUtils.clamp(x, -8, 8), z));
      } else if (i % 2 === 0) {
        const x = THREE.MathUtils.clamp(-gate.x * 0.9 + (rand() - 0.5) * 3, -HALF_W + 1.5, HALF_W - 1.5);
        this.bumpers.push(this.addSnowman(x, z));
      }
    }

    // Start and finish arches.
    this.addArch(0, 0xffc93c);
    this.addArch(-LENGTH, 0xff5d73, true);

    // Trees along the sides and mountains far away.
    for (let z = 10; z > -LENGTH - 60; z -= 4) {
      for (const sx of [-1, 1]) {
        if (rand() < 0.35) continue;
        const x = sx * (HALF_W + 3 + rand() * 14);
        const tree = makeFir(rand, 1.2 + rand() * 0.6);
        const edge = Math.max(0, Math.abs(x) - HALF_W - 2);
        tree.position.set(x, groundY(z) + edge * 0.3 + edge * edge * 0.006, z);
        s.add(tree);
      }
    }
    // Far scenery (valley and mountains) rides along with the camera, below the skiers, so you
    // always look down into the valley: that is what makes the slope read as downhill.
    const noFog = (c) => { const m = toon(c).clone(); m.fog = false; m.userData = {}; return m; };
    this.far = new THREE.Group();
    const valley = new THREE.Mesh(new THREE.CircleGeometry(400, 32), noFog(0xe8f3ff));
    valley.rotation.x = -Math.PI / 2;
    this.far.add(valley);
    const rockMat = noFog(0xa7b4d6), capMat = noFog(COLORS.white), pineMat = noFog(0x5f9e7a);
    for (let i = 0; i < 14; i++) {
      const m = new THREE.Group();
      const rock = new THREE.Mesh(sharedGeo('mountain', () => new THREE.ConeGeometry(1, 1, 7)), rockMat);
      // The cap sits clearly outside the rock so distant peaks don't flicker.
      const cap = new THREE.Mesh(sharedGeo('mountainCap2', () => new THREE.ConeGeometry(0.5, 0.44, 7)), capMat);
      cap.position.y = 0.3;
      m.add(rock, cap);
      const sc = 50 + rand() * 40;
      m.scale.set(sc, sc * 0.9, sc);
      m.position.set(-260 + i * 40 + rand() * 10, sc * 0.45, -120 - rand() * 80);
      this.far.add(m);
    }
    for (let i = 0; i < 40; i++) {
      const fir = new THREE.Mesh(sharedGeo('farFir', () => new THREE.ConeGeometry(3, 8, 6)), pineMat);
      fir.position.set(-150 + rand() * 300, 4, -40 - rand() * 60);
      this.far.add(fir);
    }
    s.add(this.far);
    for (let i = 0; i < 10; i++) {
      const c = makeCloud(rand, 4 + rand() * 3);
      c.position.set(-80 + rand() * 160, groundY(-i * 50) + 30 + rand() * 20, -i * 55 - 40);
      s.add(c);
    }
  }

  addRamp(x, z) {
    // A snow wedge lying on the slope: flush with the snow uphill, a lip downhill.
    const m = new THREE.Mesh(sharedGeo('rampWedge', () => wedgeGeometry(1.6, 0.9, 1.7)), toon(0xdff1ff));
    m.position.set(x, groundY(z) + 0.02, z);
    m.rotation.x = -Math.atan(SLOPE);
    m.castShadow = m.receiveShadow = true;
    this.scene.add(m);
    for (const sx of [-1, 1]) {
      const stripe = new THREE.Mesh(sharedGeo('rampEdge', () => wedgeGeometry(0.09, 0.92, 1.72)), toon(0xff8c42));
      stripe.position.x = sx * 1.55;
      m.add(stripe);
    }
    const lip = new THREE.Mesh(sharedGeo('rampLip', () => new THREE.BoxGeometry(3.2, 0.1, 0.12)), toon(0xff8c42));
    lip.position.set(0, 0.9, -1.7);
    m.add(lip);
    // Orange bars across the incline so you can see it is a ramp, even from behind.
    for (const bz of [0.8, -0.4]) {
      const bar = new THREE.Mesh(sharedGeo('rampBar', () => new THREE.BoxGeometry(2.6, 0.04, 0.28)), toon(0xff8c42));
      bar.position.set(0, (0.9 * (1.7 - bz)) / 3.4 + 0.03, bz);
      bar.rotation.x = Math.atan(0.9 / 3.4);
      m.add(bar);
    }
    return { x, z, w: 1.6, d: 1.5 };
  }

  addSnowman(x, z) {
    const g = new THREE.Group();
    const base = new THREE.Mesh(sharedGeo('snowBase', () => new THREE.SphereGeometry(0.7, 16, 12)), toon(COLORS.white));
    base.position.y = 0.6;
    const mid = new THREE.Mesh(sharedGeo('snowMid', () => new THREE.SphereGeometry(0.5, 16, 12)), toon(COLORS.white));
    mid.position.y = 1.4;
    const head = new THREE.Mesh(sharedGeo('snowHead', () => new THREE.SphereGeometry(0.35, 14, 10)), toon(COLORS.white));
    head.position.y = 2.0;
    const nose = new THREE.Mesh(sharedGeo('snowNose', () => new THREE.ConeGeometry(0.07, 0.35, 8)), toon(0xff8c42));
    nose.rotation.x = Math.PI / 2;
    nose.position.set(0, 2.0, 0.42);
    const hat = new THREE.Mesh(sharedGeo('snowHat', () => new THREE.CylinderGeometry(0.22, 0.25, 0.35, 12)), toon(COLORS.ink));
    hat.position.y = 2.38;
    const scarf = new THREE.Mesh(sharedGeo('snowScarf', () => new THREE.TorusGeometry(0.38, 0.08, 6, 16)), toon(0xff5d73));
    scarf.rotation.x = Math.PI / 2;
    scarf.position.y = 1.72;
    base.castShadow = mid.castShadow = true;
    g.add(base, mid, head, nose, hat, scarf);
    g.position.set(x, groundY(z), z);
    this.scene.add(g);
    return { x, z, r: 0.8, group: g, wobble: 0 };
  }

  addArch(z, color, finish = false) {
    const g = new THREE.Group();
    g.position.set(0, groundY(z), z);
    for (const sx of [-1, 1]) {
      const post = new THREE.Mesh(sharedGeo('slArchPost', () => new THREE.CylinderGeometry(0.3, 0.3, 6, 10)), toon(COLORS.white));
      post.position.set(sx * (HALF_W + 0.5), 3, 0);
      g.add(post);
    }
    const banner = new THREE.Mesh(new THREE.BoxGeometry(HALF_W * 2 + 1.6, 1.2, 0.3), toon(color));
    banner.position.y = 5.8;
    g.add(banner);
    if (finish) {
      const line = new THREE.Mesh(new THREE.PlaneGeometry(HALF_W * 2, 0.8), toon(color));
      line.rotation.x = -Math.PI / 2;
      line.position.y = 0.04;
      g.add(line);
    }
    PLAYER_COLORS.forEach((pc, i) => {
      const b = new THREE.Mesh(sharedGeo('slBalloon', () => new THREE.SphereGeometry(0.5, 12, 10)), toon(pc.hex));
      b.position.set((i - 2.5) * 3.6, 6.9, 0);
      b.scale.y = 1.2;
      g.add(b);
    });
    this.scene.add(g);
  }

  // ---------- skiing ----------

  leader() {
    let best = null;
    for (const e of this.ents) if (e.state === 'ski' && (!best || e.z < best.z)) best = e;
    return best;
  }

  updateSkier(e, dt) {
    const inp = this.input(e.p) || { x: 0, y: 0, aPressed: false, bPressed: false };
    const racing = this.state === 'play';
    e.boostCd -= dt;

    if (e.state === 'bubble') {
      const lead = this.leader();
      const tx = lead ? lead.x * 0.6 : 0, tz = lead ? lead.z + 3.5 : e.z - 5;
      e.x += (tx - e.x) * Math.min(1, dt * 3);
      e.z += (tz - e.z) * Math.min(1, dt * 3);
      e.t += dt;
      if (e.t > 1.3) {
        e.state = 'ski';
        e.bubble.visible = false;
        e.speed = lead ? lead.speed * 0.85 : 8;
        e.h = 0.5;
        e.vy = 2;
        // Skip gates already behind you.
        while (e.nextGate < this.gates.length && this.gates[e.nextGate].z > e.z) e.nextGate++;
        this.game.audio.play('pop');
      }
      e.bubble.position.set(e.x, groundY(e.z) + 1.4 + e.h, e.z);
      e.ch.group.position.set(e.x, groundY(e.z) + 0.8, e.z);
      e.ch.spin += dt * 3;
      e.ch.update(dt, { grounded: false });
      return;
    }
    e.ch.spin = 0;

    const steer = racing && !e.finished ? inp.x : e.finished ? -e.x * 0.1 : 0;
    const tuck = racing && !e.finished && inp.y > 0.5;
    const brake = (racing && inp.y < -0.5) || e.finished;
    let max = tuck ? TUCK_SPEED : MAX_SPEED;
    if (brake) max = e.finished ? 0 : 6;
    if (!racing && !e.finished) max = 0;
    if (e.speed < max) e.speed = Math.min(max, e.speed + 7 * dt);
    else e.speed = Math.max(max, e.speed - (brake ? 14 : 4) * dt);
    e.speed = Math.max(0, e.speed - Math.abs(steer) * 1.6 * dt);

    if (e.h <= 0.001) e.vx += steer * 28 * dt;
    e.vx *= Math.max(0, 1 - 2.6 * dt);
    e.vx = THREE.MathUtils.clamp(e.vx, -10, 10);

    if (racing && !e.finished && inp.aPressed && e.h <= 0.001) {
      e.vy = 7;
      e.ch.squash(1.3);
      this.game.audio.play('jump');
    }
    if (racing && !e.finished && inp.bPressed && e.boostCd <= 0) {
      e.boostCd = 2.5;
      e.speed = Math.min(TUCK_SPEED + 2, e.speed + 6);
      this.game.audio.play('whoosh');
      this.puffs.burst(new THREE.Vector3(e.x, groundY(e.z) + 0.3, e.z + 0.8), 0xffffff, { count: 8, size: 0.4, life: 0.4 });
    }

    const prevZ = e.z;
    e.x += e.vx * dt;
    e.z -= e.speed * dt;
    e.vy -= 25 * dt;
    e.h = Math.max(0, e.h + e.vy * dt);
    if (e.h === 0) {
      if (e.vy < -6) { e.ch.squash(0.7); this.game.audio.play('land'); }
      e.vy = 0;
    }
    if (Math.abs(e.x) > HALF_W) {
      e.x = Math.sign(e.x) * HALF_W;
      e.vx = -e.vx * 0.5;
      e.speed *= 0.9;
    }

    // Ramps launch you, snowmen bump you aside.
    for (const r of this.ramps) {
      if (e.h < 0.2 && Math.abs(e.x - r.x) < r.w && e.z < r.z + r.d && e.z > r.z - r.d) {
        e.vy = 9;
        e.h = 0.3;
        e.ch.squash(1.4);
        this.game.audio.play('boing');
      }
    }
    for (const b of this.bumpers) {
      const dx = e.x - b.x, dz = e.z - b.z;
      const d = Math.hypot(dx, dz);
      if (d < b.r + PR && e.h < 1.5) {
        // Always slide off sideways so nobody gets stuck behind a snowman.
        const side = Math.sign(dx) || 1;
        e.x = b.x + side * (b.r + PR + 0.05);
        e.vx = side * 7;
        e.speed *= 0.6;
        b.wobble = 1;
        e.ch.squash(0.75);
        this.game.audio.play('bump');
        this.puffs.burst(new THREE.Vector3(b.x, groundY(b.z) + 1.2, b.z), 0xffffff, { count: 10, size: 0.4 });
      }
    }

    // Gates: passing between the poles earns a star.
    while (e.nextGate < this.gates.length && e.z <= this.gates[e.nextGate].z) {
      const g = this.gates[e.nextGate];
      if (Math.abs(e.x - g.x) <= GATE_HALF && prevZ > g.z - 1) {
        e.gates++;
        g.passedBy.add(e);
        this.game.audio.play('coin');
        this.confetti.burst(new THREE.Vector3(g.x, groundY(g.z) + 1.6, g.z), 0, { count: 10, speed: 4, size: 0.14, colors: [e.p.color, g.color, COLORS.gold] });
      }
      e.nextGate++;
    }

    if (!e.finished && e.z <= -LENGTH) this.finishSkier(e);

    // Visuals.
    const y = groundY(e.z) + e.h;
    e.ch.group.position.set(e.x, y, e.z);
    e.ch.face(e.vx * 0.6, -Math.max(2, e.speed));
    e.lean = THREE.MathUtils.lerp(e.lean, -steer * 0.35, Math.min(1, dt * 8));
    e.ch.update(dt, { moving: 0, grounded: e.h === 0, vy: e.vy });
    e.ch.group.rotation.z = e.lean;
    e.ch.group.rotation.x = e.h > 0 ? 0 : Math.atan(SLOPE) * 0.6 - (tuck ? 0.25 : 0);
    if (e.h === 0 && (Math.abs(steer) > 0.4 || brake) && e.speed > 4 && Math.random() < 0.5) {
      this.puffs.burst(new THREE.Vector3(e.x - steer * 0.4, groundY(e.z) + 0.15, e.z + 0.3), 0xffffff, { count: 1, speed: 2, up: 1.5, size: 0.35, life: 0.45, gravity: -4 });
    }
  }

  finishSkier(e) {
    e.finished = true;
    this.finishOrder.push(e);
    e.place = this.finishOrder.length;
    e.finishTime = this.time;
    this.game.audio.play('star');
    this.confetti.burst(new THREE.Vector3(e.x, groundY(e.z) + 2, e.z), 0, { count: 30, speed: 7, colors: [e.p.color, COLORS.gold, COLORS.white] });
    if (this.finishOrder.length === 1) {
      this.finishTimer = FINISH_WAIT;
      if (this.ents.length > 1) this.game.ui.toast(t('slalom.finished', { name: e.p.name }), 2200);
    }
    if (this.ents.every((x) => x.finished)) this.later(1.5, () => this.end());
  }

  catchUp() {
    const lead = this.leader();
    if (!lead || this.state !== 'play') return;
    for (const e of this.ents) {
      if (e.state !== 'ski' || e.finished || e === lead) continue;
      if (e.z - lead.z > 26) {
        e.state = 'bubble';
        e.t = 0;
        e.bubble.visible = true;
        this.game.audio.play('bubble');
      }
    }
  }

  separate() {
    for (let i = 0; i < this.ents.length; i++) {
      for (let j = i + 1; j < this.ents.length; j++) {
        const a = this.ents[i], b = this.ents[j];
        if (a.state !== 'ski' || b.state !== 'ski') continue;
        const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
        if (d < PR * 2 && d > 1e-4) {
          const push = (PR * 2 - d) / 2;
          a.x -= (dx / d) * push; a.z -= (dz / d) * push;
          b.x += (dx / d) * push; b.z += (dz / d) * push;
        }
      }
    }
  }

  updateCamera(dt) {
    const skiing = this.ents.filter((e) => e.state === 'ski');
    const list = skiing.length ? skiing : this.ents;
    const zs = list.map((e) => e.z);
    const front = Math.min(...zs), back = Math.max(...zs);
    const target = Math.max(front + 4, (front + back) / 2);
    this.camZ = THREE.MathUtils.lerp(this.camZ, target, Math.min(1, dt * 3));
    const cz = this.camZ;
    const spread = THREE.MathUtils.clamp(back - front, 0, 22);
    const dist = 11 + spread * 0.35;
    // Sit up the hill behind the skiers and look down the fall line, so the slope drops away.
    this.camera.position.set(0, groundY(cz) + 6.5 + spread * 0.25, cz + dist);
    this.camera.lookAt(0, groundY(cz) - 2.5, cz - 30);
    this.far?.position.set(0, groundY(cz) - 80, cz - 150);
    const sun = this.lights.sun;
    sun.position.set(-15, groundY(cz) + 30, cz + 15);
    sun.target.position.set(0, groundY(cz), cz - 8);
    this.confettiOrigin = new THREE.Vector3(0, groundY(cz - 6) + 3, cz - 6);
  }

  score(e) {
    const bonus = e.finished ? Math.max(0, 7 - e.place) : 0;
    return e.gates + bonus;
  }

  /** Story campaign: gates passed by the whole team. */
  campaignStats() {
    return { gates: this.ents.reduce((s, e) => s + e.gates, 0), gateCount: this.gates.length, finished: this.finishOrder.length };
  }

  end() {
    if (this.state === 'results') return;
    const ranked = [...this.ents].sort((a, b) => this.score(b) - this.score(a) || (a.place || 99) - (b.place || 99));
    const top = ranked[0];
    this.finish({
      title: this.ents.length === 1 ? t('slalom.solo') : t('slalom.title', { name: top.p.name }),
      subtitle: t('slalom.sub', { n: this.gates.length }),
      rows: ranked.map((e, i) => ({
        css: e.p.css, name: e.p.name, value: t('slalom.points', { n: this.score(e) }),
        detail: t('slalom.detail', { place: e.finished ? t(`ord.${e.place - 1}`) : t('slalom.dnf'), g: e.gates }),
        crown: i === 0,
      })),
      stars: 2,
    });
  }

  update(dt) {
    for (const e of this.ents) this.updateSkier(e, dt);
    this.separate();
    this.catchUp();
    this.updateCamera(dt);
    for (const b of this.bumpers) {
      b.wobble = Math.max(0, b.wobble - dt * 2);
      b.group.rotation.z = Math.sin(b.wobble * 20) * b.wobble * 0.3;
    }
    if (this.updateResults(dt)) return;
    if (this.finishTimer !== null && this.state === 'play') {
      this.finishTimer -= dt;
      if (this.finishTimer <= 0) this.end();
    }
    if (this.state !== 'intro' && this.state !== 'results') {
      const lead = this.leader() || this.ents[0];
      const left = Math.max(0, Math.round(LENGTH + lead.z));
      const timer = this.finishTimer !== null && this.ents.length > 1 ? `<div class="pill">${t('slalom.closes')} <b>${Math.ceil(this.finishTimer)}</b></div>` : '';
      this.game.ui.setTop(`<div class="pill hud-title">${t('game.slalom')}</div><div class="pill">${t('slalom.toGo', { n: left })}</div>${timer}`);
    }
    this.game.ui.bar(this.players, (p) => {
      const e = this.ents.find((x) => x.p === p);
      return e ? esc(`${e.gates} ${t('slalom.gates')}${e.finished ? ` · ${t(`ord.${e.place - 1}`)}` : ''}`) : '';
    });
  }
}
