import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { MiniGame } from '../core/minigame.js';
import { t, addStrings } from '../core/i18n.js';
import { Character } from '../core/character.js';
import { COLORS, PLAYER_COLORS, toon, sharedGeo } from '../core/palette.js';
import { addLights, skyTexture, makeTree, makeCloud, makeFlower, seeded } from '../core/world.js';
import { makeGrumble } from '../core/critters.js';

addStrings({
  en: {
    'paint.introG': 'Walk to paint · [A]: dash · [B]: paint bomb · Dash into the grumbles so they drop their mud brushes, then paint over the mud!',
    'paint.more': 'Another grumble sneaks in!',
    'paint.mudHud': 'Mud {n}%',
    'paint.grumbles': 'Grumbles',
    'paint.subMud': 'The floor is {n}% painted · {m}% mud',
    'paint.muddy': 'The grumbles made a mess!',
    'paint.bonks': '{n} bonks',
  },
  no: {
    'paint.introG': 'Gå for å male · [A]: spurt · [B]: malingsbombe · Spurt inn i grumlingene så de mister gjørmepenselen, og mal over gjørma!',
    'paint.more': 'Enda en grumling sniker seg inn!',
    'paint.mudHud': 'Gjørme {n} %',
    'paint.grumbles': 'Grumlinger',
    'paint.subMud': 'Gulvet er {n} % malt · {m} % gjørme',
    'paint.muddy': 'Grumlingene grisa det til!',
    'paint.bonks': '{n} dult',
  },
});

const HW = 14, HD = 9; // arena half width / depth
const RES = 6; // paint cells per unit
const GW = HW * 2 * RES, GH = HD * 2 * RES;
const PR = 0.42;
const SPEED = 6.5;
const DASH_SPEED = 16;
const ROUND_TIME = 60;

// Grumble painters: they smear grey-brown mud over the floor. Mud belongs to nobody and
// has to be painted over. A dash, a Mega Brush bump or a paint bomb makes one dizzy for a bit.
const MUD = -2; // owner value for mud cells (-1 = clean floor)
const MUD_RGB = [139, 118, 98];
const MUD_CSS = '#8b7662';
const GRUMBLE_COLOR = 0x8f8577;
const GR = 0.45; // grumble radius
const MUD_R = 0.62; // mud brush radius
const DIZZY_TIME = 3.5;
const JOIN_AT = [40, 20]; // timeLeft when an extra grumble joins

const BUMPERS = [
  { x: -7, z: -3.5, r: 0.9 }, { x: 7, z: -3.5, r: 0.9 },
  { x: -7, z: 3.5, r: 0.9 }, { x: 7, z: 3.5, r: 0.9 },
  { x: 0, z: 0, r: 1.2 },
];

function rgbBytes(hex) {
  return [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
}

export class PaintScene extends MiniGame {
  constructor(game, opts) {
    super(game, opts);
    this.camera.fov = 38;
    this.scene.background = skyTexture('#ffe1b8', '#c6f1ff');
    addLights(this.scene, { size: 20, dir: new THREE.Vector3(-0.4, 1, 0.5) });

    this.timeLeft = ROUND_TIME;
    this.blobs = [];
    this.pickup = null;
    this.pickupTimer = 8;
    this.lastBeep = 99;

    this.buildArena();
    this.buildPaint();

    // opts.grumbles: false/0 = none, a number = that many at the start, true/undefined = scaled by players.
    this.grumbleOpt = opts.grumbles;
    this.grumbles = [];
    this.mudCount = 0;
    this.joinIndex = 0;
    const n = this.players.length;
    const start = opts.grumbles === false ? 0 : typeof opts.grumbles === 'number' ? Math.max(0, Math.round(opts.grumbles)) : [2, 3, 4, 4, 5, 6][Math.min(6, Math.max(1, n)) - 1];
    this.grumbleSpeed = 2.3 + 0.12 * (n - 1);
    for (let i = 0; i < start; i++) this.spawnGrumble((i + 0.5) / start, false);

    this.ents = this.players.map((p, i) => {
      const ch = new Character(p.color, { hat: p.hat });
      this.scene.add(ch.group);
      const a = (i / this.players.length) * Math.PI * 2 + Math.PI / 2;
      const x = Math.cos(a) * 9, z = Math.sin(a) * 5.5;
      const ring = new THREE.Mesh(sharedGeo('cdRing', () => new THREE.RingGeometry(0.55, 0.7, 24)), toon(p.color, { transparent: true, opacity: 0.8 }));
      ring.rotation.x = -Math.PI / 2;
      this.scene.add(ring);
      ch.face(-x, -z);
      ch.yaw = ch.targetYaw;
      return {
        p, ch, ring, index: i, rgb: rgbBytes(p.color),
        x, z, vx: 0, vz: 0, dirX: -x, dirZ: -z,
        dashT: 0, dashCd: 0, bombCd: 0, mega: 0, stun: 0, count: 0, bonks: 0,
      };
    });
    for (const e of this.ents) {
      const d = Math.hypot(e.dirX, e.dirZ) || 1;
      e.dirX /= d; e.dirZ /= d;
      this.paintCircle(e.x, e.z, 1.6, e);
    }

    this.frame();
    game.audio.playMusic('paint');
    this.intro(t('game.paint'), t(this.grumbles.length ? 'paint.introG' : 'paint.intro'));
  }

  /** Free play keeps its grumble setting on retry (a story stage merges its own opts). */
  retryOptions() {
    const o = { key: this.key };
    if (this.grumbleOpt !== undefined) o.grumbles = this.grumbleOpt;
    return o;
  }

  frame() {
    const tilt = THREE.MathUtils.degToRad(55);
    const d = this.fitDistance(HW * 2 + 3, HD * 2 * Math.sin(tilt) + 6.5);
    this.camera.position.set(0, Math.sin(tilt) * d, Math.cos(tilt) * d + 0.6);
    this.camera.lookAt(0, 0, 0.6);
    this.confettiOrigin = new THREE.Vector3(0, 3, 0);
  }

  resize(w, h) {
    super.resize(w, h);
    this.frame();
  }

  buildArena() {
    const s = this.scene;
    const base = new THREE.Mesh(new RoundedBoxGeometry(HW * 2 + 2, 1.2, HD * 2 + 2, 3, 0.4), toon(COLORS.candyLilac));
    base.position.y = -0.62;
    base.receiveShadow = true;
    s.add(base);

    const fenceCols = [COLORS.candyPink, COLORS.candyBlue, COLORS.candyYellow, COLORS.candyMint];
    const fence = (x, z, w, d, c) => {
      const m = new THREE.Mesh(new RoundedBoxGeometry(w, 0.7, d, 2, 0.25), toon(c));
      m.position.set(x, 0.3, z);
      m.castShadow = m.receiveShadow = true;
      s.add(m);
    };
    fence(0, -HD - 0.5, HW * 2 + 2, 0.8, fenceCols[0]);
    fence(0, HD + 0.5, HW * 2 + 2, 0.8, fenceCols[1]);
    fence(-HW - 0.5, 0, 0.8, HD * 2, fenceCols[2]);
    fence(HW + 0.5, 0, 0.8, HD * 2, fenceCols[3]);

    this.bumperMeshes = BUMPERS.map((b, i) => {
      const g = new THREE.Group();
      const body = new THREE.Mesh(sharedGeo('bumper', () => new THREE.CylinderGeometry(1, 1.05, 1, 24)), toon(COLORS.icing));
      body.scale.set(b.r, 1, b.r);
      body.position.y = 0.5;
      const band = new THREE.Mesh(sharedGeo('bumperBand', () => new THREE.TorusGeometry(1, 0.16, 8, 28)), toon(PLAYER_COLORS[i % 6].hex));
      band.scale.set(b.r, b.r, 1);
      band.rotation.x = Math.PI / 2;
      band.position.y = 0.55;
      const top = new THREE.Mesh(sharedGeo('bumperTop', () => new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2)), toon(PLAYER_COLORS[(i + 3) % 6].hex));
      top.scale.set(b.r * 0.9, 0.4, b.r * 0.9);
      top.position.y = 1;
      body.castShadow = top.castShadow = true;
      g.add(body, band, top);
      g.position.set(b.x, 0, b.z);
      s.add(g);
      return { g, squish: 0 };
    });

    // Scenery around the arena.
    const ground = new THREE.Mesh(new THREE.CircleGeometry(80, 40), toon(COLORS.grass));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -1.2;
    ground.receiveShadow = true;
    s.add(ground);
    const rand = seeded(31);
    for (let i = 0; i < 26; i++) {
      const a = rand() * Math.PI * 2;
      const x = Math.cos(a) * (22 + rand() * 10), z = Math.sin(a) * (15 + rand() * 8) - 4;
      if (z > 6) continue;
      const t = makeTree(rand, 1 + rand() * 0.6);
      t.position.set(x, -1.2, z);
      s.add(t);
    }
    for (let i = 0; i < 60; i++) {
      const f = makeFlower(rand);
      const a = rand() * Math.PI * 2;
      f.position.set(Math.cos(a) * (17 + rand() * 6), -1.2, Math.sin(a) * (11 + rand() * 5));
      s.add(f);
    }
    for (let i = 0; i < 6; i++) {
      const c = makeCloud(rand, 2 + rand());
      c.position.set(-40 + i * 16, 10 + rand() * 6, -30);
      s.add(c);
    }
  }

  buildPaint() {
    this.data = new Uint8Array(GW * GH * 4);
    this.owner = new Int8Array(GW * GH).fill(-1);
    this.mask = new Uint8Array(GW * GH);
    this.shade = new Float32Array(GW * GH);
    let paintable = 0;
    for (let j = 0; j < GH; j++) {
      for (let i = 0; i < GW; i++) {
        const k = j * GW + i;
        const { x, z } = this.cellCenter(i, j);
        const blocked = BUMPERS.some((b) => Math.hypot(x - b.x, z - b.z) < b.r);
        this.mask[k] = blocked ? 0 : 1;
        if (!blocked) paintable++;
        this.shade[k] = 0.96 + Math.random() * 0.04;
        const light = (Math.floor(i / 6) + Math.floor(j / 6)) % 2 === 0;
        this.setCell(k, light ? [255, 246, 228] : [248, 234, 210], 1);
      }
    }
    this.paintable = paintable;
    this.tex = new THREE.DataTexture(this.data, GW, GH);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.tex.magFilter = THREE.LinearFilter;
    this.tex.minFilter = THREE.LinearFilter;
    this.tex.needsUpdate = true;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(HW * 2, HD * 2), new THREE.MeshToonMaterial({ map: this.tex, gradientMap: toon(0xffffff).gradientMap }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0.001;
    floor.receiveShadow = true;
    this.scene.add(floor);
  }

  cellCenter(i, j) {
    return { x: (i + 0.5) / RES - HW, z: HD - (j + 0.5) / RES };
  }

  setCell(k, rgb, shade) {
    const o = k * 4;
    this.data[o] = rgb[0] * shade;
    this.data[o + 1] = rgb[1] * shade;
    this.data[o + 2] = rgb[2] * shade;
    this.data[o + 3] = 255;
  }

  paintCircle(x, z, r, ent) {
    const i0 = Math.max(0, Math.floor((x - r + HW) * RES));
    const i1 = Math.min(GW - 1, Math.floor((x + r + HW) * RES));
    const j0 = Math.max(0, Math.floor((HD - z - r) * RES));
    const j1 = Math.min(GH - 1, Math.floor((HD - z + r) * RES));
    let changed = false;
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const k = j * GW + i;
        if (!this.mask[k] || this.owner[k] === ent.index) continue;
        const c = this.cellCenter(i, j);
        if ((c.x - x) ** 2 + (c.z - z) ** 2 > r * r) continue;
        const prev = this.owner[k];
        if (prev >= 0) this.ents[prev].count--;
        else if (prev === MUD) this.mudCount--;
        this.owner[k] = ent.index;
        ent.count++;
        this.setCell(k, ent.rgb, this.shade[k]);
        changed = true;
      }
    }
    if (changed) this.tex.needsUpdate = true;
  }

  /** A grumble's brush: turns any cell (clean or painted) into mud. */
  mudCircle(x, z, r) {
    const i0 = Math.max(0, Math.floor((x - r + HW) * RES));
    const i1 = Math.min(GW - 1, Math.floor((x + r + HW) * RES));
    const j0 = Math.max(0, Math.floor((HD - z - r) * RES));
    const j1 = Math.min(GH - 1, Math.floor((HD - z + r) * RES));
    let changed = false;
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const k = j * GW + i;
        if (!this.mask[k] || this.owner[k] === MUD) continue;
        const c = this.cellCenter(i, j);
        if ((c.x - x) ** 2 + (c.z - z) ** 2 > r * r) continue;
        const prev = this.owner[k];
        if (prev >= 0) this.ents[prev].count--;
        this.owner[k] = MUD;
        this.mudCount++;
        // Lumpy mud: a little speckle so it reads as smudges, not a flat color.
        const speck = ((i * 7 + j * 13) % 5) * 0.035;
        this.setCell(k, MUD_RGB, this.shade[k] * (0.9 + speck));
        changed = true;
      }
    }
    if (changed) this.tex.needsUpdate = true;
  }

  /** Player-painted cells in a 5x5 sample grid around (x, z): how juicy a spot is to mud. */
  paintAround(x, z) {
    let n = 0;
    for (let a = -2; a <= 2; a++) {
      for (let b = -2; b <= 2; b++) {
        const i = Math.floor((x + a * 0.55 + HW) * RES), j = Math.floor((HD - z - b * 0.55) * RES);
        if (i < 0 || j < 0 || i >= GW || j >= GH) continue;
        if (this.owner[j * GW + i] >= 0) n++;
      }
    }
    return n;
  }

  spawnGrumble(frac = Math.random(), puff = true) {
    const mesh = makeGrumble(GRUMBLE_COLOR);
    // Mud brush held out in front: wooden handle + muddy bristles.
    const brush = new THREE.Group();
    const handle = new THREE.Mesh(sharedGeo('pgHandle', () => new THREE.CylinderGeometry(0.045, 0.045, 0.7, 8)), toon(0xa0704a));
    handle.position.y = 0.35;
    const bristles = new THREE.Mesh(sharedGeo('pgBristle', () => new THREE.BoxGeometry(0.32, 0.18, 0.14)), toon(0x7a644f));
    bristles.position.y = 0.04;
    brush.add(handle, bristles);
    brush.position.set(0.34, 0.08, 0.42);
    brush.rotation.x = 0.7;
    mesh.add(brush);
    // Dizzy stars (hidden until bonked).
    const stars = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const st = new THREE.Mesh(sharedGeo('pgStar', () => new THREE.OctahedronGeometry(0.11, 0)), toon(COLORS.gold, { emissive: 0x443300 }));
      const a = (i / 3) * Math.PI * 2;
      st.position.set(Math.cos(a) * 0.38, 0, Math.sin(a) * 0.38);
      stars.add(st);
    }
    stars.position.y = 1.1;
    stars.visible = false;
    mesh.add(stars);
    // Start along the fence, spread around the arena.
    const a = frac * Math.PI * 2 + 0.3;
    const x = THREE.MathUtils.clamp(Math.cos(a) * HW, -HW + 1, HW - 1);
    const z = THREE.MathUtils.clamp(Math.sin(a) * HD, -HD + 1, HD - 1);
    mesh.position.set(x, 0, z);
    mesh.rotation.y = Math.atan2(-x, -z);
    this.scene.add(mesh);
    const g = { mesh, brush, stars, x, z, vx: 0, vz: 0, tx: undefined, tz: undefined, retarget: 0, dizzy: 0, yaw: mesh.rotation.y, phase: Math.random() * 6 };
    this.grumbles.push(g);
    if (puff) {
      this.puffs.burst(new THREE.Vector3(x, 0.6, z), GRUMBLE_COLOR, { count: 14, size: 0.35, life: 0.6 });
      this.game.audio.play('pop');
    }
    return g;
  }

  pickTarget(g) {
    let best = null, bestS = -Infinity;
    for (let k = 0; k < 14; k++) {
      const x = (Math.random() - 0.5) * (HW * 2 - 2), z = (Math.random() - 0.5) * (HD * 2 - 2);
      if (BUMPERS.some((b) => Math.hypot(b.x - x, b.z - z) < b.r + 0.7)) continue;
      // Like fresh paint, dislike being near players and crowding other grumbles.
      let s = this.paintAround(x, z) + Math.random() * 4 - Math.hypot(g.x - x, g.z - z) * 0.3;
      for (const e of this.ents) { const d = Math.hypot(e.x - x, e.z - z); if (d < 4) s -= (4 - d) * 2.5; }
      for (const o of this.grumbles) if (o !== g && o.tx !== undefined) { const d = Math.hypot(o.tx - x, o.tz - z); if (d < 4) s -= (4 - d) * 2; }
      if (s > bestS) { bestS = s; best = { x, z }; }
    }
    if (best) { g.tx = best.x; g.tz = best.z; }
    g.retarget = 2.5 + Math.random() * 2;
  }

  /** Bonk! The grumble gets dizzy and drops its brush for a few seconds. */
  bonk(g, e, nx, nz) {
    if (g.dizzy > 0.5) return;
    g.dizzy = DIZZY_TIME;
    g.vx = nx * 7; g.vz = nz * 7;
    g.stars.visible = true;
    // The brush falls to the floor where it is.
    g.mesh.remove(g.brush);
    g.brush.position.set(g.x + nx * 0.6, 0.06, g.z + nz * 0.6);
    g.brush.rotation.set(Math.PI / 2, Math.random() * Math.PI, 0);
    this.scene.add(g.brush);
    if (e) e.bonks++;
    this.game.audio.play('dizzy');
    this.puffs.burst(new THREE.Vector3(g.x, 0.7, g.z), COLORS.gold, { count: 8, size: 0.25, life: 0.5 });
  }

  updateGrumbles(dt) {
    const playing = this.state === 'play';
    if (playing && this.grumbles.length && this.joinIndex < JOIN_AT.length && this.timeLeft <= JOIN_AT[this.joinIndex]) {
      this.joinIndex++;
      this.spawnGrumble();
      this.game.ui.toast(t('paint.more'));
    }
    // They speed up as the match goes on.
    const progress = 1 - this.timeLeft / ROUND_TIME;
    const speed = this.grumbleSpeed * (1 + 0.35 * progress);
    for (const g of this.grumbles) {
      g.phase += dt;
      if (g.dizzy > 0) {
        g.dizzy -= dt;
        g.vx *= Math.max(0, 1 - dt * 5); g.vz *= Math.max(0, 1 - dt * 5);
        if (g.dizzy <= 0) {
          // Pick the brush back up.
          this.scene.remove(g.brush);
          g.brush.position.set(0.34, 0.08, 0.42);
          g.brush.rotation.set(0.7, 0, 0);
          g.mesh.add(g.brush);
          g.stars.visible = false;
          g.retarget = 0;
        }
      } else if (playing) {
        g.retarget -= dt;
        if (g.tx === undefined || g.retarget <= 0 || Math.hypot(g.tx - g.x, g.tz - g.z) < 0.7) this.pickTarget(g);
        let dx = g.tx - g.x, dz = g.tz - g.z;
        const d = Math.hypot(dx, dz) || 1;
        dx /= d; dz /= d;
        // A wiggly walk, and shy away from players who come close.
        const wig = Math.sin(g.phase * 3) * 0.35;
        let wx = dx - dz * wig, wz = dz + dx * wig;
        for (const e of this.ents) {
          const ex = g.x - e.x, ez = g.z - e.z, ed = Math.hypot(ex, ez);
          if (ed < 2.6 && ed > 1e-3) { const k = (2.6 - ed) / 2.6 * 1.4; wx += (ex / ed) * k; wz += (ez / ed) * k; }
        }
        const wl = Math.hypot(wx, wz) || 1;
        const rate = Math.min(1, dt * 4);
        g.vx += ((wx / wl) * speed - g.vx) * rate;
        g.vz += ((wz / wl) * speed - g.vz) * rate;
      } else {
        g.vx *= 0.9; g.vz *= 0.9;
      }
      g.x += g.vx * dt; g.z += g.vz * dt;
      g.x = THREE.MathUtils.clamp(g.x, -HW + GR, HW - GR);
      g.z = THREE.MathUtils.clamp(g.z, -HD + GR, HD - GR);
      for (const b of BUMPERS) {
        const bx = g.x - b.x, bz = g.z - b.z, bd = Math.hypot(bx, bz);
        if (bd < b.r + GR && bd > 1e-4) { g.x = b.x + (bx / bd) * (b.r + GR); g.z = b.z + (bz / bd) * (b.r + GR); }
      }

      // Players: a plain bump shoves it; a dash, Mega Brush or bomb makes it dizzy.
      for (const e of this.ents) {
        const ex = g.x - e.x, ez = g.z - e.z, ed = Math.hypot(ex, ez);
        if (ed >= PR + GR || ed < 1e-4) continue;
        const nx = ex / ed, nz = ez / ed;
        const push = PR + GR - ed;
        g.x += nx * push * 0.8; g.z += nz * push * 0.8;
        e.x -= nx * push * 0.2; e.z -= nz * push * 0.2;
        if (playing && (e.dashT > 0 || e.mega > 0)) this.bonk(g, e, nx, nz);
      }

      const moving = Math.hypot(g.vx, g.vz);
      if (playing && g.dizzy <= 0) {
        const fx = Math.sin(g.yaw), fz = Math.cos(g.yaw);
        this.mudCircle(g.x + fx * 0.3, g.z + fz * 0.3, MUD_R);
      }
      if (moving > 0.3 && g.dizzy <= 0) {
        const diff = Math.atan2(g.vx, g.vz) - g.yaw;
        g.yaw += Math.atan2(Math.sin(diff), Math.cos(diff)) * Math.min(1, dt * 8);
      }
      g.mesh.position.set(g.x, Math.abs(Math.sin(g.phase * 9)) * 0.08 * Math.min(1, moving), g.z);
      g.mesh.rotation.y = g.dizzy > 0 ? g.yaw + Math.sin(g.phase * 10) * 0.4 : g.yaw;
      g.mesh.rotation.z = g.dizzy > 0 ? Math.sin(g.phase * 7) * 0.2 : 0;
      g.stars.rotation.y += dt * 6;
      const sq = 1 + Math.sin(g.phase * 9) * 0.05;
      g.mesh.userData.body.scale.set(1 / sq, sq, 1 / sq);
    }
    // Grumbles don't stack on each other.
    for (let i = 0; i < this.grumbles.length; i++) {
      for (let j = i + 1; j < this.grumbles.length; j++) {
        const a = this.grumbles[i], b = this.grumbles[j];
        const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
        if (d >= GR * 2 || d < 1e-4) continue;
        const push = (GR * 2 - d) / 2;
        a.x -= (dx / d) * push; a.z -= (dz / d) * push;
        b.x += (dx / d) * push; b.z += (dz / d) * push;
      }
    }
  }

  throwBomb(e) {
    const tx = THREE.MathUtils.clamp(e.x + e.dirX * 4.5, -HW + 1, HW - 1);
    const tz = THREE.MathUtils.clamp(e.z + e.dirZ * 4.5, -HD + 1, HD - 1);
    const mesh = new THREE.Mesh(sharedGeo('blob', () => new THREE.SphereGeometry(0.35, 14, 10)), toon(e.p.color));
    mesh.castShadow = true;
    this.scene.add(mesh);
    this.blobs.push({ e, mesh, sx: e.x, sz: e.z, tx, tz, t: 0, dur: 0.55 });
    this.game.audio.play('bubble');
  }

  updatePlayers(dt) {
    const audio = this.game.audio;
    for (const e of this.ents) {
      const inp = this.input(e.p) || { x: 0, y: 0, aPressed: false, bPressed: false };
      const playing = this.state === 'play';
      e.dashCd -= dt; e.bombCd -= dt; e.stun -= dt;
      e.mega = Math.max(0, e.mega - dt);

      const ix = playing && e.stun <= 0 ? inp.x : 0;
      const iz = playing && e.stun <= 0 ? -inp.y : 0;
      if (Math.hypot(ix, iz) > 0.2) {
        const d = Math.hypot(ix, iz);
        e.dirX = ix / d; e.dirZ = iz / d;
      }
      if (e.dashT > 0) {
        e.dashT -= dt;
      } else {
        const acc = 45 * dt;
        e.vx += THREE.MathUtils.clamp(ix * SPEED - e.vx, -acc, acc);
        e.vz += THREE.MathUtils.clamp(iz * SPEED - e.vz, -acc, acc);
      }
      if (playing && inp.aPressed && e.dashCd <= 0) {
        e.dashT = 0.24;
        e.dashCd = 0.75;
        e.vx = e.dirX * DASH_SPEED;
        e.vz = e.dirZ * DASH_SPEED;
        e.ch.squash(0.75);
        audio.play('dash');
      }
      if (playing && inp.bPressed && e.bombCd <= 0) {
        e.bombCd = 3.5;
        this.throwBomb(e);
        e.ch.squash(1.25);
      }

      e.x += e.vx * dt;
      e.z += e.vz * dt;
      if (e.x < -HW + PR) { e.x = -HW + PR; e.vx = Math.abs(e.vx) * 0.5; }
      if (e.x > HW - PR) { e.x = HW - PR; e.vx = -Math.abs(e.vx) * 0.5; }
      if (e.z < -HD + PR) { e.z = -HD + PR; e.vz = Math.abs(e.vz) * 0.5; }
      if (e.z > HD - PR) { e.z = HD - PR; e.vz = -Math.abs(e.vz) * 0.5; }

      BUMPERS.forEach((b, bi) => {
        const dx = e.x - b.x, dz = e.z - b.z;
        const d = Math.hypot(dx, dz);
        const min = b.r + PR;
        if (d < min && d > 1e-4) {
          const nx = dx / d, nz = dz / d;
          e.x = b.x + nx * min; e.z = b.z + nz * min;
          const vn = e.vx * nx + e.vz * nz;
          const kick = Math.max(6, -vn * 1.4);
          e.vx += nx * (kick - Math.min(0, vn)); e.vz += nz * (kick - Math.min(0, vn));
          e.dashT = 0.12;
          this.bumperMeshes[bi].squish = 1;
          audio.play('boing');
        }
      });

      if (playing) {
        const r = e.mega > 0 ? 1.5 : e.dashT > 0 ? 1.0 : 0.72;
        this.paintCircle(e.x, e.z, r, e);
      }

      const sp = Math.hypot(e.vx, e.vz);
      e.ch.face(e.dirX, e.dirZ);
      e.ch.group.position.set(e.x, 0, e.z);
      const scale = e.mega > 0 ? 1.35 : 1;
      e.ch.group.scale.lerp(new THREE.Vector3(scale, scale, scale), Math.min(1, dt * 8));
      e.ch.update(dt, { moving: Math.min(1, sp / SPEED), grounded: true });
      e.ring.position.set(e.x, 0.03, e.z);
      const ready = e.bombCd <= 0;
      e.ring.scale.setScalar(ready ? 1 + Math.sin(this.time * 6) * 0.06 : 0.6 + 0.4 * (1 - e.bombCd / 3.5));
      e.ring.visible = playing;
    }

    // Players bump each other; a dash gives an extra shove.
    for (let i = 0; i < this.ents.length; i++) {
      for (let j = i + 1; j < this.ents.length; j++) {
        const a = this.ents[i], b = this.ents[j];
        const dx = b.x - a.x, dz = b.z - a.z;
        const d = Math.hypot(dx, dz);
        if (d >= PR * 2 || d < 1e-4) continue;
        const nx = dx / d, nz = dz / d;
        const push = (PR * 2 - d) / 2;
        a.x -= nx * push; a.z -= nz * push;
        b.x += nx * push; b.z += nz * push;
        if (a.dashT > 0 && b.stun <= 0) { b.vx += nx * 10; b.vz += nz * 10; b.stun = 0.3; audio.play('bump'); }
        if (b.dashT > 0 && a.stun <= 0) { a.vx -= nx * 10; a.vz -= nz * 10; a.stun = 0.3; audio.play('bump'); }
      }
    }
  }

  updateBlobs(dt) {
    for (const b of this.blobs) {
      b.t += dt;
      const k = Math.min(1, b.t / b.dur);
      b.mesh.position.set(THREE.MathUtils.lerp(b.sx, b.tx, k), 0.8 + Math.sin(k * Math.PI) * 3, THREE.MathUtils.lerp(b.sz, b.tz, k));
      b.mesh.rotation.x += dt * 10;
      if (k >= 1) {
        b.done = true;
        this.scene.remove(b.mesh);
        this.paintCircle(b.tx, b.tz, 2.1, b.e);
        for (const g of this.grumbles) {
          const dx = g.x - b.tx, dz = g.z - b.tz, d = Math.hypot(dx, dz);
          if (d < 2.3) this.bonk(g, b.e, d > 1e-3 ? dx / d : 1, d > 1e-3 ? dz / d : 0);
        }
        this.game.audio.play('splat');
        this.puffs.burst(new THREE.Vector3(b.tx, 0.3, b.tz), b.e.p.color, { count: 18, speed: 7, up: 4, size: 0.35, life: 0.7 });
      }
    }
    this.blobs = this.blobs.filter((b) => !b.done);
  }

  updatePickup(dt) {
    if (!this.pickup) {
      this.pickupTimer -= dt;
      if (this.pickupTimer <= 0 && this.state === 'play') {
        let x = 0, z = 0;
        for (let tries = 0; tries < 20; tries++) {
          x = (Math.random() - 0.5) * (HW * 2 - 4);
          z = (Math.random() - 0.5) * (HD * 2 - 4);
          if (BUMPERS.every((b) => Math.hypot(b.x - x, b.z - z) > b.r + 1.5)) break;
        }
        const g = new THREE.Group();
        const can = new THREE.Mesh(sharedGeo('can', () => new THREE.CylinderGeometry(0.45, 0.4, 0.7, 18)), toon(COLORS.icing));
        const top = new THREE.Mesh(sharedGeo('canTop', () => new THREE.CylinderGeometry(0.42, 0.42, 0.08, 18)), toon(COLORS.gold, { emissive: 0x332200 }));
        top.position.y = 0.37;
        const handle = new THREE.Mesh(sharedGeo('canHandle', () => new THREE.TorusGeometry(0.4, 0.04, 6, 18, Math.PI)), toon(COLORS.ink));
        handle.position.y = 0.38;
        can.castShadow = true;
        g.add(can, top, handle);
        g.position.set(x, 0.5, z);
        this.scene.add(g);
        this.pickup = { x, z, g };
        this.puffs.burst(g.position, COLORS.gold, { count: 12, size: 0.3 });
      }
      return;
    }
    const pk = this.pickup;
    pk.g.rotation.y += dt * 2;
    pk.g.position.y = 0.6 + Math.sin(this.time * 4) * 0.15;
    for (const e of this.ents) {
      if (Math.hypot(e.x - pk.x, e.z - pk.z) < 1) {
        e.mega = 6;
        this.scene.remove(pk.g);
        this.pickup = null;
        this.pickupTimer = 9 + Math.random() * 4;
        this.game.audio.play('star');
        this.game.ui.toast(t('paint.mega', { name: e.p.name }));
        this.confetti.burst(new THREE.Vector3(e.x, 1, e.z), e.p.color, { count: 20, speed: 6 });
        break;
      }
    }
  }

  /** Story campaign: share of the floor the whole team painted (0..1). */
  campaignStats() {
    return { painted: this.ents.reduce((s, e) => s + e.count, 0) / this.paintable };
  }

  end() {
    const ranked = [...this.ents].sort((a, b) => b.count - a.count);
    const pct = (e) => Math.round((e.count / this.paintable) * 100);
    const winner = ranked[0];
    const tie = ranked.length > 1 && ranked[1].count === winner.count;
    for (const e of this.ents) e.ring.visible = false;
    this.confettiOrigin = new THREE.Vector3(winner.x, 2, winner.z);
    const painted = this.ents.reduce((s, e) => s + e.count, 0);
    const mud = Math.round((this.mudCount / this.paintable) * 100);
    const muddy = this.grumbles.length && this.mudCount > painted;
    const rows = ranked.map((e, i) => ({
      css: e.p.css, name: e.p.name, value: `${pct(e)}%`,
      detail: [i === 0 ? t('paint.top') : '', e.bonks ? t('paint.bonks', { n: e.bonks }) : ''].filter(Boolean).join(' · '),
      crown: i === 0 || e.count === winner.count,
    }));
    if (this.grumbles.length) rows.push({ css: MUD_CSS, name: t('paint.grumbles'), value: `${mud}%`, detail: '', crown: false });
    this.finish({
      title: muddy ? t('paint.muddy') : this.ents.length === 1 ? t('paint.solo') : tie ? t('tie') : t('win', { name: winner.p.name }),
      subtitle: this.grumbles.length
        ? t('paint.subMud', { n: Math.round((painted / this.paintable) * 100), m: mud })
        : t('paint.sub', { n: Math.round((painted / this.paintable) * 100) }),
      rows,
      stars: 2,
    });
  }

  update(dt) {
    this.updatePlayers(dt);
    this.bumperMeshes.forEach((b) => {
      b.squish = Math.max(0, b.squish - dt * 4);
      const k = 1 + Math.sin(b.squish * Math.PI) * 0.2;
      b.g.scale.set(k, 2 - k, k);
    });
    if (this.updateResults(dt)) return;
    this.updateGrumbles(dt);
    this.updateBlobs(dt);
    this.updatePickup(dt);

    if (this.state === 'play') {
      this.timeLeft -= dt;
      const sec = Math.ceil(this.timeLeft);
      if (sec <= 5 && sec !== this.lastBeep && sec > 0) { this.lastBeep = sec; this.game.audio.play('beep'); }
      if (sec === 10 && !this.hurry) { this.hurry = true; this.game.ui.toast(t('paint.ten')); }
      if (this.timeLeft <= 0) {
        this.timeLeft = 0;
        this.game.audio.play('go');
        this.end();
        return;
      }
    }
    if (this.state !== 'intro') {
      const bars = this.ents
        .map((e) => `<div class="paint-bar" style="--c:${e.p.css}; height:${Math.min(100, Math.max(8, (e.count / this.paintable) * 300))}%"></div>`)
        .join('');
      const mud = this.grumbles.length
        ? `<div class="pill"><div class="paint-bars"><div class="paint-bar" style="--c:${MUD_CSS}; height:${Math.min(100, Math.max(8, (this.mudCount / this.paintable) * 300))}%"></div></div><b>${t('paint.mudHud', { n: Math.round((this.mudCount / this.paintable) * 100) })}</b></div>`
        : '';
      this.game.ui.setTop(`<div class="pill"><span class="big-num">${Math.ceil(this.timeLeft)}</span></div><div class="pill"><div class="paint-bars">${bars}</div></div>${mud}`);
    }
    this.game.ui.bar(this.players, (p) => {
      const e = this.ents.find((x) => x.p === p);
      return e ? `${Math.round((e.count / this.paintable) * 100)}%` : '';
    });
  }
}
