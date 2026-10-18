import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { MiniGame } from '../core/minigame.js';
import { t } from '../core/i18n.js';
import { Character } from '../core/character.js';
import { COLORS, PLAYER_COLORS, toon, basic, sharedGeo } from '../core/palette.js';
import { addLights, skyTexture, makeCloud, makeTree, makeBush, seeded } from '../core/world.js';
import { esc } from '../core/ui.js';
import { VotePicker, VOTES } from '../core/vote.js';

const HW = 6.5; // track half width
const WALL = HW + 3;
const N = 900; // track samples
const SCALE = 1.4;
const CONTROL = [[0, -40], [35, -38], [55, -20], [50, 5], [30, 15], [25, 35], [45, 50], [20, 62], [-15, 55], [-30, 35], [-50, 30], [-55, 5], [-40, -15], [-25, -35]];
const MAX_SPEED = 23;
const FINISH_WAIT = 15;
const ITEMS = {
  boost: { css: '#ffc93c' },
  banana: { css: '#ffe14d' },
  bubble: { css: '#4cc9f0' },
};
const ord = (i) => t(`ord.${i}`);

export class KartScene extends MiniGame {
  constructor(game, opts) {
    super(game, opts);
    this.scene.background = skyTexture('#5fc4ff', '#e2f7ff');
    this.scene.fog = new THREE.Fog(0xd6f2ff, 90, 220);
    this.lights = addLights(this.scene, { size: 95, dir: new THREE.Vector3(-0.5, 1, 0.35) });
    this.lights.sun.shadow.mapSize.set(4096, 4096);

    this.buildTrack();
    this.buildScenery();
    this.bananas = [];
    this.shots = [];
    this.finishOrder = [];
    this.finishTimer = null;
    this.raceTime = 0;

    this.karts = this.players.map((p, i) => this.makeKart(p, i));
    this.overview = new THREE.PerspectiveCamera(50, 1, 1, 600);
    this.overview.position.set(0, 190, 60);
    this.overview.lookAt(0, 0, 10);
    for (const k of this.karts) this.snapCamera(k);

    game.audio.playMusic('platformer');
    this.laps = opts.laps || 3;
    if (opts.laps) {
      this.intro(t('game.kart'), t('kart.intro'));
    } else {
      this.state = 'vote';
      this.picker = new VotePicker(this, {
        title: () => t('game.kart'),
        vote: VOTES.laps(3),
        onDone: (n) => { this.picker = null; this.laps = n; this.intro(t('game.kart'), t('kart.intro')); },
      });
    }
  }

  retryOptions() {
    return { key: this.key, laps: this.laps };
  }

  onLanguage() {
    this.picker?.render();
  }

  // ---------- track ----------

  buildTrack() {
    const curve = new THREE.CatmullRomCurve3(CONTROL.map(([x, z]) => new THREE.Vector3(x * SCALE, 0, z * SCALE)), true, 'centripetal');
    this.pts = curve.getSpacedPoints(N).slice(0, N);
    this.tan = this.pts.map((p, i) => this.pts[(i + 1) % N].clone().sub(p).normalize());
    this.side = this.tan.map((t) => new THREE.Vector3(-t.z, 0, t.x));

    const ribbon = (inner, outer, y, colorAt) => {
      const pos = [], col = [];
      const c = new THREE.Color();
      for (let i = 0; i < N; i++) {
        const j = (i + 1) % N;
        const a0 = this.pts[i].clone().addScaledVector(this.side[i], inner);
        const a1 = this.pts[i].clone().addScaledVector(this.side[i], outer);
        const b0 = this.pts[j].clone().addScaledVector(this.side[j], inner);
        const b1 = this.pts[j].clone().addScaledVector(this.side[j], outer);
        for (const v of [a0, b0, a1, a1, b0, b1]) pos.push(v.x, y, v.z);
        c.set(colorAt(i));
        for (let k = 0; k < 6; k++) col.push(c.r, c.g, c.b);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toon(0xffffff).gradientMap, side: THREE.DoubleSide }));
      m.receiveShadow = true;
      this.scene.add(m);
      return m;
    };
    ribbon(-HW, HW, 0.03, (i) => (Math.floor(i / 30) % 2 ? 0x7d7896 : 0x77728f));
    const curb = (i) => (Math.floor(i / 4) % 2 ? 0xff5d73 : 0xffffff);
    ribbon(HW, HW + 1.3, 0.05, curb);
    ribbon(-HW - 1.3, -HW, 0.05, curb);

    // Center dashes.
    const dashGeo = sharedGeo('dash', () => new THREE.PlaneGeometry(0.35, 2.2));
    for (let i = 0; i < N; i += 14) {
      const d = new THREE.Mesh(dashGeo, basic(0xfff3c4));
      d.rotation.x = -Math.PI / 2;
      d.rotation.z = -Math.atan2(this.tan[i].x, this.tan[i].z);
      d.position.set(this.pts[i].x, 0.06, this.pts[i].z);
      this.scene.add(d);
    }

    // Checkered start line + arch.
    const c = document.createElement('canvas');
    c.width = 128; c.height = 16;
    const g = c.getContext('2d');
    for (let i = 0; i < 16; i++) for (let j = 0; j < 2; j++) {
      g.fillStyle = (i + j) % 2 ? '#2b2340' : '#ffffff';
      g.fillRect(i * 8, j * 8, 8, 8);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = THREE.NearestFilter;
    const line = new THREE.Mesh(new THREE.PlaneGeometry(HW * 2, 2), new THREE.MeshBasicMaterial({ map: tex }));
    line.rotation.x = -Math.PI / 2;
    line.rotation.z = -Math.atan2(this.tan[0].x, this.tan[0].z) + Math.PI / 2;
    line.position.set(this.pts[0].x, 0.07, this.pts[0].z);
    this.scene.add(line);
    const arch = new THREE.Group();
    arch.position.copy(this.pts[0]);
    arch.rotation.y = Math.atan2(this.side[0].x, this.side[0].z) - Math.PI / 2;
    for (const sx of [-1, 1]) {
      const post = new THREE.Mesh(sharedGeo('kPost', () => new THREE.CylinderGeometry(0.35, 0.35, 7, 10)), toon(COLORS.white));
      post.position.set(sx * (HW + 1.8), 3.5, 0);
      post.castShadow = true;
      arch.add(post);
    }
    const banner = new THREE.Mesh(new THREE.BoxGeometry(HW * 2 + 4, 1.4, 0.3), new THREE.MeshToonMaterial({ map: tex }));
    banner.position.y = 6.6;
    arch.add(banner);
    PLAYER_COLORS.forEach((pc, i) => {
      const b = new THREE.Mesh(sharedGeo('kBalloon', () => new THREE.SphereGeometry(0.55, 14, 10)), toon(pc.hex));
      b.position.set((i - 2.5) * 2.4, 7.9 + (i % 2) * 0.4, 0);
      b.scale.y = 1.2;
      arch.add(b);
    });
    this.scene.add(arch);

    // Item box rows.
    this.boxes = [];
    for (const f of [0.2, 0.47, 0.74]) {
      const i = Math.floor(N * f);
      for (const off of [-4.2, -1.4, 1.4, 4.2]) {
        const pos = this.pts[i].clone().addScaledVector(this.side[i], off);
        const mat = new THREE.MeshToonMaterial({ color: 0xffffff, transparent: true, opacity: 0.75, gradientMap: toon(0xffffff).gradientMap, emissive: 0x222222 });
        const box = new THREE.Mesh(sharedGeo('itemBox', () => new RoundedBoxGeometry(1.4, 1.4, 1.4, 2, 0.25)), mat);
        const star = new THREE.Mesh(sharedGeo('itemQ', () => new THREE.OctahedronGeometry(0.35)), toon(COLORS.white));
        box.add(star);
        box.position.set(pos.x, 1.2, pos.z);
        box.castShadow = true;
        this.scene.add(box);
        this.boxes.push({ mesh: box, mat, x: pos.x, z: pos.z, t: 0, phase: Math.random() * 6 });
      }
    }
  }

  buildScenery() {
    const s = this.scene;
    const ground = new THREE.Mesh(new THREE.CircleGeometry(300, 48), toon(COLORS.grass));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    s.add(ground);
    const rand = seeded(61);
    const far = (x, z, d) => {
      for (let i = 0; i < N; i += 6) if (Math.hypot(this.pts[i].x - x, this.pts[i].z - z) < d) return false;
      return true;
    };
    let trees = 0;
    for (let k = 0; k < 400 && trees < 44; k++) {
      const x = (rand() - 0.5) * 220, z = (rand() - 0.5) * 200 + 15;
      if (!far(x, z, WALL + 4)) continue;
      const t = makeTree(rand, 1.4 + rand() * 1.2);
      t.position.set(x, 0, z);
      s.add(t);
      trees++;
    }
    for (let i = 0; i < N; i += 45) {
      for (const sd of [-1, 1]) {
        const p = this.pts[i].clone().addScaledVector(this.side[i], sd * (WALL + 1.5));
        if (!far(p.x, p.z, WALL)) continue;
        const b = makeBush(rand, 1.4);
        b.position.copy(p);
        s.add(b);
      }
    }
    const hillCols = [0x9be37f, 0x7ed36a, 0xb4ec8f];
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const r = 200 + rand() * 40;
      const h = new THREE.Mesh(sharedGeo('khill', () => new THREE.SphereGeometry(1, 20, 12)), toon(hillCols[i % 3]));
      h.scale.set(40 + rand() * 20, 18 + rand() * 18, 40);
      h.position.set(Math.cos(a) * r, -6, Math.sin(a) * r + 15);
      s.add(h);
    }
    for (let i = 0; i < 12; i++) {
      const c = makeCloud(rand, 4 + rand() * 3);
      const a = rand() * Math.PI * 2;
      c.position.set(Math.cos(a) * 150, 40 + rand() * 25, Math.sin(a) * 150);
      s.add(c);
    }
  }

  // ---------- karts ----------

  makeKart(p, i) {
    const group = new THREE.Group();
    const body = new THREE.Mesh(sharedGeo('kBody', () => new RoundedBoxGeometry(1.7, 0.55, 2.6, 3, 0.22)), toon(p.color));
    body.position.y = 0.55;
    body.castShadow = true;
    const nose = new THREE.Mesh(sharedGeo('kNose', () => new RoundedBoxGeometry(1.5, 0.35, 0.6, 2, 0.15)), toon(COLORS.white));
    nose.position.set(0, 0.5, 1.4);
    const seat = new THREE.Mesh(sharedGeo('kSeat', () => new RoundedBoxGeometry(0.9, 0.32, 0.25, 2, 0.1)), toon(COLORS.ink));
    seat.position.set(0, 0.95, -0.8);
    const spoiler = new THREE.Mesh(sharedGeo('kSpoiler', () => new RoundedBoxGeometry(1.8, 0.1, 0.4, 2, 0.04)), toon(p.color));
    spoiler.position.set(0, 0.98, -1.3);
    group.add(body, nose, seat, spoiler);
    const wheels = [];
    for (const [x, z] of [[-0.9, 0.85], [0.9, 0.85], [-0.9, -0.85], [0.9, -0.85]]) {
      const w = new THREE.Mesh(sharedGeo('kWheel', () => new THREE.CylinderGeometry(0.36, 0.36, 0.34, 14)), toon(COLORS.ink));
      w.rotation.z = Math.PI / 2;
      w.position.set(x, 0.36, z);
      w.castShadow = true;
      const hub = new THREE.Mesh(sharedGeo('kHub', () => new THREE.CylinderGeometry(0.14, 0.14, 0.36, 8)), toon(COLORS.gold));
      w.add(hub);
      group.add(w);
      wheels.push(w);
    }
    const ch = new Character(p.color, { hat: p.hat });
    ch.group.scale.setScalar(0.66);
    ch.group.position.set(0, 0.72, -0.2);
    group.add(ch.group);
    const bubble = new THREE.Mesh(sharedGeo('kBubble', () => new THREE.SphereGeometry(1.8, 22, 16)), toon(0xbfe9ff, { transparent: true, opacity: 0.4 }));
    bubble.position.y = 1;
    bubble.visible = false;
    group.add(bubble);
    this.scene.add(group);

    const row = Math.floor(i / 2), sd = i % 2 ? 1 : -1;
    const idx = (N - 8 - row * 7) % N;
    const pos = this.pts[idx].clone().addScaledVector(this.side[idx], sd * 2.8);
    const heading = Math.atan2(this.tan[idx].x, this.tan[idx].z);
    const cam = new THREE.PerspectiveCamera(62, 1, 0.3, 400);
    const hud = this.game.ui.label('kart-hud');
    hud.style.setProperty('--c', p.css);
    return {
      p, group, body, wheels, ch, bubble, cam, hud, hudCache: '',
      x: pos.x, z: pos.z, y: 0, vy: 0, heading, camH: heading, speed: 0,
      idx, lap: 0, halfway: true, finished: false, place: i,
      item: null, rollT: 0, boostT: 0, spinT: 0, bubbleT: 0, immuneT: 0,
      drift: 0, driftT: 0, steerVis: 0, onTrack: true, bumpCd: 0,
      camPos: new THREE.Vector3(), camLook: new THREE.Vector3(),
    };
  }

  snapCamera(k) {
    const f = new THREE.Vector3(Math.sin(k.heading), 0, Math.cos(k.heading));
    k.camPos.set(k.x, 3.6, k.z).addScaledVector(f, -8);
    k.camLook.set(k.x, 1, k.z).addScaledVector(f, 4);
  }

  nearest(k) {
    let best = k.idx, bestD = Infinity;
    for (let o = -40; o <= 40; o++) {
      const i = (k.idx + o + N) % N;
      const p = this.pts[i];
      const d = (p.x - k.x) ** 2 + (p.z - k.z) ** 2;
      if (d < bestD) { bestD = d; best = i; }
    }
    return { i: best, d: Math.sqrt(bestD) };
  }

  progress(k) {
    return k.lap * N + k.idx;
  }

  rollItem(k) {
    const n = this.karts.length;
    const behind = n > 1 ? k.place / (n - 1) : 0.5;
    const r = Math.random();
    const boostP = 0.2 + behind * 0.35;
    const bubbleP = 0.3;
    return r < boostP ? 'boost' : r < boostP + bubbleP ? 'bubble' : 'banana';
  }

  useItem(k) {
    const f = new THREE.Vector3(Math.sin(k.heading), 0, Math.cos(k.heading));
    if (k.item === 'boost') {
      k.boostT = 1.5;
      this.game.audio.play('whoosh');
    } else if (k.item === 'banana') {
      const mesh = new THREE.Group();
      const peel = new THREE.Mesh(sharedGeo('peel', () => new THREE.TorusGeometry(0.45, 0.16, 8, 14, Math.PI * 1.1)), toon(0xffe14d));
      peel.rotation.x = -Math.PI / 2;
      peel.position.y = 0.2;
      const tip = new THREE.Mesh(sharedGeo('peelTip', () => new THREE.SphereGeometry(0.12, 8, 6)), toon(0x8a6a44));
      tip.position.set(0.45, 0.25, 0);
      mesh.add(peel, tip);
      const x = k.x - f.x * 2.6, z = k.z - f.z * 2.6;
      mesh.position.set(x, 0, z);
      this.scene.add(mesh);
      this.bananas.push({ mesh, x, z, owner: k, t: 0 });
      this.game.audio.play('select');
    } else if (k.item === 'bubble') {
      const mesh = new THREE.Mesh(sharedGeo('kShot', () => new THREE.SphereGeometry(0.75, 16, 12)), toon(0xbfe9ff, { transparent: true, opacity: 0.6 }));
      this.scene.add(mesh);
      this.shots.push({ mesh, x: k.x + f.x * 2.5, z: k.z + f.z * 2.5, idx: k.idx, owner: k, t: 0, heading: k.heading });
      this.game.audio.play('bubble');
    }
    k.item = null;
  }

  updateKart(k, dt) {
    const inp = this.input(k.p) || { x: 0, y: 0, a: false, b: false, aPressed: false, bPressed: false };
    const racing = this.state === 'play';
    k.boostT -= dt; k.spinT -= dt; k.bubbleT -= dt; k.immuneT -= dt; k.bumpCd -= dt;
    if (k.rollT > 0) {
      k.rollT -= dt;
      if (k.rollT <= 0) { k.item = k.pendingItem; this.game.audio.play('coin'); }
    }

    let steer = racing && !k.finished ? inp.x : 0;
    if (k.finished) steer = this.autoSteer(k);
    const n = this.karts.length;
    const rubber = n > 1 ? 1 + (k.place / (n - 1)) * 0.12 : 1;
    let max = MAX_SPEED * rubber * (k.onTrack ? 1 : 0.55);
    if (k.boostT > 0) max *= 1.5;
    if (k.finished) max *= 0.6;

    if (k.bubbleT > 0) {
      k.speed *= Math.max(0, 1 - 4 * dt);
      k.y = THREE.MathUtils.lerp(k.y, 1.6, Math.min(1, dt * 6));
      k.bubble.visible = true;
    } else if (k.spinT > 0) {
      k.speed *= Math.max(0, 1 - 2.5 * dt);
      k.heading += 11 * dt;
      k.bubble.visible = false;
    } else {
      k.bubble.visible = false;
      const braking = racing && inp.y < -0.6 && !k.finished;
      if (!racing && !k.finished) {
        k.speed = 0;
      } else if (braking) {
        k.speed = Math.max(-7, k.speed - 30 * dt);
      } else if (k.speed < max) {
        k.speed = Math.min(max, k.speed + (k.boostT > 0 ? 40 : 15) * dt);
      } else {
        k.speed = Math.max(max, k.speed - 20 * dt);
      }

      // Hop into a drift: hold A while steering; let go after a while for a mini boost.
      if (racing && !k.finished) {
        if (inp.aPressed && k.y <= 0.01) {
          k.vy = 5;
          this.game.audio.play('jump');
          if (Math.abs(inp.x) > 0.3 && k.speed > 10) { k.drift = Math.sign(inp.x); k.driftT = 0; }
        }
        if (k.drift && (!inp.a || k.speed < 8)) {
          if (k.driftT > 0.8) {
            k.boostT = Math.max(k.boostT, k.driftT > 1.6 ? 1.2 : 0.7);
            this.game.audio.play('whoosh');
          }
          k.drift = 0;
        }
        if (k.drift) k.driftT += dt;
        if (inp.bPressed && k.item) this.useItem(k);
      }
      const grip = THREE.MathUtils.clamp(Math.abs(k.speed) / 9, 0, 1) * Math.sign(k.speed || 1);
      const turn = k.drift ? (k.drift * 1.05 + steer * 0.75) * 1.9 : steer * 2.1;
      k.heading -= turn * grip * dt;
    }

    k.vy -= 22 * dt;
    if (k.bubbleT <= 0) {
      k.y += k.vy * dt;
      if (k.y <= 0) { k.y = 0; k.vy = 0; }
    }

    const fx = Math.sin(k.heading), fz = Math.cos(k.heading);
    k.x += fx * k.speed * dt;
    k.z += fz * k.speed * dt;

    // Stay near the track: soft walls, never stuck.
    const prevIdx = k.idx;
    const near = this.nearest(k);
    k.idx = near.i;
    k.onTrack = near.d < HW + 0.8;
    if (near.d > WALL) {
      const p = this.pts[near.i];
      const dx = k.x - p.x, dz = k.z - p.z;
      k.x = p.x + (dx / near.d) * WALL;
      k.z = p.z + (dz / near.d) * WALL;
      k.speed *= Math.max(0, 1 - 2 * dt);
      // Turn the kart back along the track so nobody stays pinned against the edge.
      const t = this.tan[near.i];
      const along = Math.atan2(t.x, t.z);
      let dh = along - k.heading;
      dh = Math.atan2(Math.sin(dh), Math.cos(dh));
      if (Math.abs(dh) < Math.PI * 0.75) k.heading += dh * Math.min(1, dt * 3);
      if (k.bumpCd <= 0) { this.game.audio.play('bump'); k.bumpCd = 0.6; }
    }

    // Laps.
    if (prevIdx > N * 0.85 && k.idx < N * 0.15) {
      if (k.halfway) {
        k.halfway = false;
        k.lap++;
        if (k.lap > this.laps && !k.finished) this.finishKart(k);
        else if (k.lap === this.laps && k.p) this.game.ui.toast(t('kart.final', { name: k.p.name }));
      }
    }
    if (prevIdx < N * 0.15 && k.idx > N * 0.85 && !k.finished) {
      // Drove backwards over the line: undo that lap.
      k.lap = Math.max(0, k.lap - 1);
      k.halfway = true;
    }
    if (k.idx > N * 0.45 && k.idx < N * 0.6) k.halfway = true;

    // Visuals.
    k.group.position.set(k.x, k.y, k.z);
    k.group.rotation.y = k.heading;
    k.steerVis = THREE.MathUtils.lerp(k.steerVis, steer + k.drift * 0.6, Math.min(1, dt * 8));
    k.group.rotation.z = k.steerVis * 0.08;
    k.wheels[0].rotation.y = k.wheels[1].rotation.y = -steer * 0.4;
    for (const w of k.wheels) w.rotation.x += (k.speed * dt) / 0.36;
    k.ch.update(dt, { moving: 0, grounded: true });
    k.ch.group.rotation.y = 0;
    if (k.drift && k.driftT > 0.8 && Math.random() < 0.6) {
      const col = k.driftT > 1.6 ? 0xff8c42 : 0x4cc9f0;
      for (const sd of [-1, 1]) {
        const wx = k.x - fx * 1 + Math.cos(k.heading) * sd * 0.9, wz = k.z - fz * 1 - Math.sin(k.heading) * sd * 0.9;
        this.confetti.burst(new THREE.Vector3(wx, 0.3, wz), col, { count: 1, speed: 2, up: 2, size: 0.15, life: 0.3 });
      }
    }
    if (k.boostT > 0 && Math.random() < 0.7) {
      this.puffs.burst(new THREE.Vector3(k.x - fx * 1.6, 0.6, k.z - fz * 1.6), 0xffffff, { count: 1, speed: 1, up: 0.5, size: 0.4, life: 0.4, gravity: 0 });
    }

    // Camera keeps its own heading so spins don't make anyone dizzy.
    if (k.spinT <= 0) {
      let d = k.heading - k.camH;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      k.camH += d * Math.min(1, dt * 5);
    }
    const cf = new THREE.Vector3(Math.sin(k.camH), 0, Math.cos(k.camH));
    const want = new THREE.Vector3(k.x, 3.6 + k.y * 0.5, k.z).addScaledVector(cf, -8);
    k.camPos.lerp(want, Math.min(1, dt * 8));
    k.camLook.lerp(new THREE.Vector3(k.x, 1.2 + k.y * 0.5, k.z).addScaledVector(cf, 4), Math.min(1, dt * 10));
    k.cam.position.copy(k.camPos);
    k.cam.lookAt(k.camLook);
    k.cam.fov = THREE.MathUtils.lerp(k.cam.fov, k.boostT > 0 ? 72 : 62, Math.min(1, dt * 4));
  }

  autoSteer(k) {
    const t = this.pts[(k.idx + 14) % N];
    const want = Math.atan2(t.x - k.x, t.z - k.z);
    let d = want - k.heading;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    return THREE.MathUtils.clamp(-d * 2, -1, 1);
  }

  finishKart(k) {
    k.finished = true;
    k.finishTime = this.raceTime;
    this.finishOrder.push(k);
    k.drift = 0;
    this.game.audio.play('star');
    this.confetti.burst(new THREE.Vector3(k.x, 2, k.z), 0, { count: 40, speed: 8, colors: PLAYER_COLORS.map((c) => c.hex) });
    if (this.finishOrder.length === 1) {
      this.finishTimer = FINISH_WAIT;
      if (this.karts.length > 1) this.game.ui.toast(t('kart.winsRace', { name: k.p.name }), 2400);
    }
    if (this.karts.every((x) => x.finished)) this.later(1.5, () => this.end());
  }

  updateObjects(dt) {
    for (const b of this.boxes) {
      b.mesh.rotation.y += dt * 1.5;
      b.mesh.rotation.x = Math.sin(this.time + b.phase) * 0.3;
      b.mesh.position.y = 1.2 + Math.sin(this.time * 2 + b.phase) * 0.15;
      b.mat.color.setHSL((this.time * 0.3 + b.phase) % 1, 0.8, 0.7);
      if (b.t > 0) {
        b.t -= dt;
        b.mesh.visible = b.t <= 0;
        if (b.t <= 0) b.mesh.scale.setScalar(0.1);
        continue;
      }
      b.mesh.scale.lerp(new THREE.Vector3(1, 1, 1), Math.min(1, dt * 5));
      for (const k of this.karts) {
        if (Math.hypot(k.x - b.x, k.z - b.z) < 1.8) {
          b.t = 3;
          b.mesh.visible = false;
          this.confetti.burst(new THREE.Vector3(b.x, 1.2, b.z), 0, { count: 14, speed: 5, colors: PLAYER_COLORS.map((c) => c.hex) });
          if (!k.item && k.rollT <= 0) {
            k.pendingItem = this.rollItem(k);
            k.rollT = 0.7;
            this.game.audio.play('select');
          }
          break;
        }
      }
    }
    for (const bn of this.bananas) {
      bn.t += dt;
      for (const k of this.karts) {
        if ((k === bn.owner && bn.t < 0.6) || k.bubbleT > 0 || k.y > 0.8) continue;
        if (Math.hypot(k.x - bn.x, k.z - bn.z) < 1.4) {
          k.spinT = 0.9;
          bn.dead = true;
          this.scene.remove(bn.mesh);
          this.game.audio.play('dizzy');
          break;
        }
      }
    }
    this.bananas = this.bananas.filter((b) => !b.dead);
    for (const s of this.shots) {
      s.t += dt;
      // Follow the track and home in on the closest kart ahead.
      let target = this.pts[(s.idx + 10) % N];
      for (const k of this.karts) {
        if (k === s.owner || k.bubbleT > 0) continue;
        const dx = k.x - s.x, dz = k.z - s.z;
        const d = Math.hypot(dx, dz);
        if (d < 22 && dx * Math.sin(s.heading) + dz * Math.cos(s.heading) > 0) { target = { x: k.x, z: k.z }; break; }
      }
      const want = Math.atan2(target.x - s.x, target.z - s.z);
      let dh = want - s.heading;
      dh = Math.atan2(Math.sin(dh), Math.cos(dh));
      s.heading += THREE.MathUtils.clamp(dh, -4 * dt, 4 * dt);
      s.x += Math.sin(s.heading) * 34 * dt;
      s.z += Math.cos(s.heading) * 34 * dt;
      const near = this.nearest(s);
      s.idx = near.i;
      s.mesh.position.set(s.x, 1, s.z);
      for (const k of this.karts) {
        if (k === s.owner || k.bubbleT > 0) continue;
        if (Math.hypot(k.x - s.x, k.z - s.z) < 1.8) {
          k.bubbleT = 1.3;
          k.drift = 0;
          s.t = 99;
          this.game.audio.play('trap');
          break;
        }
      }
      if (s.t > 4) {
        s.dead = true;
        this.scene.remove(s.mesh);
        this.puffs.burst(new THREE.Vector3(s.x, 1, s.z), 0xffffff, { count: 8, size: 0.4 });
      }
    }
    this.shots = this.shots.filter((s) => !s.dead);

    // Karts bump each other.
    for (let i = 0; i < this.karts.length; i++) {
      for (let j = i + 1; j < this.karts.length; j++) {
        const a = this.karts[i], b = this.karts[j];
        const dx = b.x - a.x, dz = b.z - a.z;
        const d = Math.hypot(dx, dz);
        if (d < 1.9 && d > 1e-3) {
          const push = (1.9 - d) / 2;
          a.x -= (dx / d) * push; a.z -= (dz / d) * push;
          b.x += (dx / d) * push; b.z += (dz / d) * push;
          if (a.bumpCd <= 0) { this.game.audio.play('bump'); a.bumpCd = b.bumpCd = 0.4; }
        }
      }
    }
  }

  updatePlaces() {
    const order = [...this.karts].sort((a, b) => {
      if (a.finished && b.finished) return a.finishTime - b.finishTime;
      if (a.finished) return -1;
      if (b.finished) return 1;
      return this.progress(b) - this.progress(a);
    });
    order.forEach((k, i) => { k.place = i; });
  }

  layout() {
    const W = window.innerWidth, H = window.innerHeight;
    const n = this.karts.length;
    const cols = n <= 2 ? 1 : n <= 4 ? 2 : 3;
    const rows = n === 1 ? 1 : 2;
    const cells = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = Math.round((c * W) / cols), y = Math.round((r * H) / rows);
        cells.push({ x, y, w: Math.round(((c + 1) * W) / cols) - x, h: Math.round(((r + 1) * H) / rows) - y });
      }
    }
    return cells;
  }

  render(renderer) {
    const H = window.innerHeight;
    const cells = this.layout();
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = true;
    renderer.setScissorTest(true);
    cells.forEach((cell, i) => {
      const k = this.karts[i];
      const cam = k ? k.cam : this.overview;
      cam.aspect = cell.w / cell.h;
      cam.updateProjectionMatrix();
      renderer.setViewport(cell.x, H - cell.y - cell.h, cell.w, cell.h);
      renderer.setScissor(cell.x, H - cell.y - cell.h, cell.w, cell.h);
      renderer.render(this.scene, cam);
    });
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, window.innerWidth, H);
  }

  updateHud() {
    const cells = this.layout();
    this.karts.forEach((k, i) => {
      const c = cells[i];
      const lap = Math.min(this.laps, Math.max(1, k.lap));
      const item = k.rollT > 0 ? '<div class="kart-item rolling">?</div>' : k.item ? `<div class="kart-item" style="--ic:${ITEMS[k.item].css}">${t(`kart.item.${k.item}`)}</div>` : '<div class="kart-item empty"></div>';
      const status = k.finished ? `<div class="kart-done">${t('kart.finished', { ord: ord(this.finishOrder.indexOf(k)) })}</div>` : '';
      const html = `<div class="kart-place">${ord(k.place)}</div><div class="kart-lap">${esc(k.p.name)} · ${t('kart.lap', { a: lap, b: this.laps })}</div>${item}${status}`;
      if (html !== k.hudCache) { k.hud.innerHTML = html; k.hudCache = html; }
      k.hud.style.transform = `translate(${c.x}px, ${c.y}px)`;
      k.hud.style.width = `${c.w}px`;
      k.hud.style.height = `${c.h}px`;
    });
  }

  end() {
    if (this.state === 'results') return;
    this.updatePlaces();
    const ranked = [...this.karts].sort((a, b) => a.place - b.place);
    for (const k of this.karts) k.hud.style.display = 'none';
    this.finish({
      title: this.karts.length === 1 ? t('kart.solo') : t('kart.winsRace', { name: ranked[0].p.name }),
      subtitle: t('kart.sub', { n: this.laps }),
      rows: ranked.map((k, i) => ({
        css: k.p.css, name: k.p.name, value: ord(i),
        detail: k.finished ? `${k.finishTime.toFixed(1)} s` : t('kart.lapShort', { n: Math.max(1, Math.min(this.laps, k.lap)) }), crown: i === 0,
      })),
      stars: 2,
    });
  }

  update(dt) {
    if (this.state === 'vote') this.picker?.update(dt);
    if (this.state === 'play') this.raceTime += dt;
    for (const k of this.karts) this.updateKart(k, dt);
    if (this.updateResults(dt)) return;
    this.updateObjects(dt);
    this.updatePlaces();
    this.updateHud();
    if (this.finishTimer !== null && this.state === 'play') {
      this.finishTimer -= dt;
      if (this.finishTimer <= 0) this.end();
    }
    const timer = this.finishTimer !== null && this.state === 'play' && this.karts.length > 1 ? `<div class="pill">${t('kart.closes')} <b>${Math.ceil(this.finishTimer)}</b></div>` : '';
    this.game.ui.setTop(timer);
  }

  dispose() {
    super.dispose();
    this.game.renderer.shadowMap.autoUpdate = true;
  }
}
