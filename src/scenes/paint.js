import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { MiniGame } from '../core/minigame.js';
import { Character } from '../core/character.js';
import { COLORS, PLAYER_COLORS, toon, sharedGeo } from '../core/palette.js';
import { addLights, skyTexture, makeTree, makeCloud, makeFlower, seeded } from '../core/world.js';

const HW = 14, HD = 9; // arena half width / depth
const RES = 6; // paint cells per unit
const GW = HW * 2 * RES, GH = HD * 2 * RES;
const PR = 0.42;
const SPEED = 6.5;
const DASH_SPEED = 16;
const ROUND_TIME = 60;

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
        dashT: 0, dashCd: 0, bombCd: 0, mega: 0, stun: 0, count: 0,
      };
    });
    for (const e of this.ents) {
      const d = Math.hypot(e.dirX, e.dirZ) || 1;
      e.dirX /= d; e.dirZ /= d;
      this.paintCircle(e.x, e.z, 1.6, e);
    }

    this.frame();
    game.audio.playMusic('paint');
    this.intro('Paint Party', 'Walk to paint · A: dash · B: throw a paint bomb');
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
        this.owner[k] = ent.index;
        ent.count++;
        this.setCell(k, ent.rgb, this.shade[k]);
        changed = true;
      }
    }
    if (changed) this.tex.needsUpdate = true;
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
        e.dashT = 0.2;
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
        this.game.ui.toast(`${e.p.name} got the Mega Brush!`);
        this.confetti.burst(new THREE.Vector3(e.x, 1, e.z), e.p.color, { count: 20, speed: 6 });
        break;
      }
    }
  }

  end() {
    const ranked = [...this.ents].sort((a, b) => b.count - a.count);
    const pct = (e) => Math.round((e.count / this.paintable) * 100);
    const winner = ranked[0];
    const tie = ranked.length > 1 && ranked[1].count === winner.count;
    for (const e of this.ents) e.ring.visible = false;
    this.confettiOrigin = new THREE.Vector3(winner.x, 2, winner.z);
    this.finish({
      title: this.ents.length === 1 ? 'What a masterpiece!' : tie ? "It's a tie!" : `${winner.p.name} wins!`,
      subtitle: `The floor is ${Math.round((this.ents.reduce((s, e) => s + e.count, 0) / this.paintable) * 100)}% painted`,
      rows: ranked.map((e, i) => ({
        css: e.p.css, name: e.p.name, value: `${pct(e)}%`,
        detail: i === 0 ? 'Top painter' : '', crown: i === 0 || e.count === winner.count,
      })),
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
    this.updateBlobs(dt);
    this.updatePickup(dt);

    if (this.state === 'play') {
      this.timeLeft -= dt;
      const sec = Math.ceil(this.timeLeft);
      if (sec <= 5 && sec !== this.lastBeep && sec > 0) { this.lastBeep = sec; this.game.audio.play('beep'); }
      if (sec === 10 && !this.hurry) { this.hurry = true; this.game.ui.toast('10 seconds left!'); }
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
      this.game.ui.setTop(`<div class="pill"><span class="big-num">${Math.ceil(this.timeLeft)}</span></div><div class="pill"><div class="paint-bars">${bars}</div></div>`);
    }
    this.game.ui.bar(this.players, (p) => {
      const e = this.ents.find((x) => x.p === p);
      return e ? `${Math.round((e.count / this.paintable) * 100)}%` : '';
    });
  }
}
