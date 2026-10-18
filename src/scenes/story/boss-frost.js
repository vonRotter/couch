import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { COLORS, toon, basic, sharedGeo } from '../../core/palette.js';
import { addLights, skyTexture, seeded } from '../../core/world.js';
import { t, addStrings } from '../../core/i18n.js';
import { BossScene } from './boss-common.js';

// Frosty Peaks boss: the Grumble King guards the bells on his snow fort with a big umbrella.
// Stand in front of a bell and throw snowballs (A or B) to ring it. Snowballs only ever fly
// at the bells; a blocked one just goes poof on his umbrella and he laughs.

addStrings({
  en: { 'bossf.hint': 'Stand in front of a bell · [A] or [B] throws a snowball', 'bossf.ha': 'Ha!' },
  no: { 'bossf.hint': 'Stå foran en bjelle · [A] eller [B] kaster en snøball', 'bossf.ha': 'Ha!' },
});

const HW = 10.5; // yard half width
const Z0 = 0.5, Z1 = 7.5; // yard depth
const WALL_Z = -2.6;
const WALL_H = 1.5;
const BELL_XS = [-8, -4, 0, 4, 8];
const KING_Z = -4.2;
const KING_Y = 0.9; // he stands on a snow step behind the wall
const BLOCK = 1.75; // umbrella half width
const THROW_CD = 0.45;
const G = 18;

export class BossFrostScene extends BossScene {
  constructor(game, opts) {
    super(game, opts, { chapter: 1, kingSize: 2.1 });
    this.camera.fov = 40;
    this.scene.background = skyTexture('#86c8ff', '#f2fbff');
    addLights(this.scene, { size: 20, dir: new THREE.Vector3(-0.3, 1, 0.6) });
    this.balls = [];
    this.buildYard();
    this.buildFort();

    this.k = { x: 0, vx: 0, laugh: 0, wander: 0, goal: 0 };
    this.king.group.position.set(0, KING_Y, KING_Z);
    this.buildUmbrella();
    const n = this.players.length;
    this.players.forEach((p, i) => {
      const e = this.makeBean(p, n === 1 ? 0 : -7 + (14 * i) / (n - 1), 5);
      e.cd = 0;
      e.reticle = new THREE.Mesh(sharedGeo('bfReticle', () => new THREE.RingGeometry(0.55, 0.72, 28)), basic(p.color));
      e.reticle.visible = false;
      this.scene.add(e.reticle);
    });
    this.haTag = this.game.ui.label('label');
    this.haTag.style.color = '#8a63f0';
    this.haTag.style.display = 'none';
    this.start('platformer');
  }

  frame() {
    const tilt = THREE.MathUtils.degToRad(38);
    const d = this.fitDistance(HW * 2 + 3, 13.5);
    this.camera.position.set(0, Math.sin(tilt) * d + 1.5, Math.cos(tilt) * d + 2);
    this.camera.lookAt(0, 1.6, 0.5);
  }

  buildYard() {
    const s = this.scene;
    const rand = seeded(12);
    const snow = new THREE.Mesh(new THREE.PlaneGeometry(120, 80), toon(0xf4faff));
    snow.rotation.x = -Math.PI / 2;
    snow.receiveShadow = true;
    s.add(snow);
    // Soft snow lumps and little firs at the sides.
    for (let i = 0; i < 26; i++) {
      const lump = new THREE.Mesh(sharedGeo('bfLump', () => new THREE.SphereGeometry(1, 12, 8)), toon(COLORS.white));
      const side = i % 2 ? 1 : -1;
      lump.position.set(side * (HW + 1.5 + rand() * 8), -0.3, -6 + rand() * 14);
      lump.scale.set(1 + rand(), 0.5 + rand() * 0.4, 1 + rand());
      s.add(lump);
    }
    for (let i = 0; i < 14; i++) {
      const fir = makeFir(rand);
      const side = i % 2 ? 1 : -1;
      fir.position.set(side * (HW + 2 + rand() * 7), 0, -9 + rand() * 13);
      s.add(fir);
    }
    // Mountains far behind the fort.
    for (let i = 0; i < 6; i++) {
      const h = 14 + rand() * 10;
      const m = new THREE.Mesh(sharedGeo(`bfMount${i}`, () => new THREE.ConeGeometry(8 + rand() * 5, h, 7)), toon(i % 2 ? 0xb9d7f2 : 0xa7c8ea));
      m.position.set(-30 + i * 12, h / 2 - 1, -32 - rand() * 8);
      const cap = new THREE.Mesh(sharedGeo(`bfCap${i}`, () => new THREE.ConeGeometry(3.2, 4, 7)), toon(COLORS.white));
      cap.position.set(m.position.x, h - 3, m.position.z);
      s.add(m, cap);
    }
    // Falling snow.
    const count = 300;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (rand() - 0.5) * 40;
      pos[i * 3 + 1] = rand() * 18;
      pos[i * 3 + 2] = -10 + rand() * 22;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.snow = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.18 }));
    s.add(this.snow);
  }

  buildFort() {
    const s = this.scene;
    // The wall: big snow blocks with a crenellated top.
    const block = sharedGeo('bfBlock', () => new RoundedBoxGeometry(2.1, WALL_H, 1.4, 2, 0.2));
    for (let x = -11; x <= 11; x += 2.2) {
      const b = new THREE.Mesh(block, toon(0xeaf6ff));
      b.position.set(x, WALL_H / 2, WALL_Z);
      b.castShadow = true;
      b.receiveShadow = true;
      s.add(b);
    }
    // The step he walks on, behind the wall.
    const step = new THREE.Mesh(new THREE.BoxGeometry(24, KING_Y, 2.4), toon(0xdbeefc));
    step.position.set(0, KING_Y / 2, KING_Z);
    step.receiveShadow = true;
    s.add(step);
    // Icy towers at the ends with flags.
    for (const sx of [-1, 1]) {
      const tower = new THREE.Mesh(sharedGeo('bfTower', () => new THREE.CylinderGeometry(1.3, 1.5, 4, 14)), toon(0xeaf6ff));
      tower.position.set(sx * 12.6, 2, WALL_Z - 0.8);
      tower.castShadow = true;
      const roof = new THREE.Mesh(sharedGeo('bfRoof', () => new THREE.ConeGeometry(1.6, 1.8, 14)), toon(0x7fb8ff));
      roof.position.set(sx * 12.6, 4.9, WALL_Z - 0.8);
      const flag = new THREE.Mesh(sharedGeo('bfFlag', () => new THREE.ConeGeometry(0.4, 0.9, 3)), toon(0x8a63f0));
      flag.rotation.z = -Math.PI / 2;
      flag.position.set(sx * 12.6 + 0.45, 6.2, WALL_Z - 0.8);
      const pole = new THREE.Mesh(sharedGeo('bfPole', () => new THREE.CylinderGeometry(0.04, 0.04, 1.2, 6)), toon(COLORS.ink));
      pole.position.set(sx * 12.6, 6.1, WALL_Z - 0.8);
      s.add(tower, roof, flag, pole);
    }
    // Bells hanging in little arches on top of the wall.
    this.bells = BELL_XS.map((x) => {
      const g = new THREE.Group();
      g.position.set(x, WALL_H, WALL_Z);
      for (const sx of [-1, 1]) {
        const post = new THREE.Mesh(sharedGeo('bfPost', () => new THREE.CylinderGeometry(0.09, 0.09, 2.4, 8)), toon(COLORS.trunk));
        post.position.set(sx * 0.75, 1.2, 0);
        g.add(post);
      }
      const bar = new THREE.Mesh(sharedGeo('bfBar', () => new THREE.CylinderGeometry(0.08, 0.08, 1.7, 8)), toon(COLORS.trunk));
      bar.rotation.z = Math.PI / 2;
      bar.position.y = 2.4;
      g.add(bar);
      const swing = new THREE.Group();
      swing.position.y = 2.35;
      const bell = new THREE.Mesh(sharedGeo('bfBell', () => new THREE.LatheGeometry([
        new THREE.Vector2(0.05, 0), new THREE.Vector2(0.22, -0.05), new THREE.Vector2(0.3, -0.3),
        new THREE.Vector2(0.36, -0.6), new THREE.Vector2(0.5, -0.78), new THREE.Vector2(0.48, -0.85), new THREE.Vector2(0, -0.85),
      ], 18)), toon(COLORS.gold));
      bell.castShadow = true;
      const clapper = new THREE.Mesh(sharedGeo('bfClap', () => new THREE.SphereGeometry(0.11, 8, 6)), toon(0xd99a2b));
      clapper.position.y = -0.85;
      swing.add(bell, clapper);
      g.add(swing);
      this.scene.add(g);
      return { x, g, swing, wobble: 0, rings: 0, pos: new THREE.Vector3(x, WALL_H + 1.95, WALL_Z + 0.2) };
    });
  }

  buildUmbrella() {
    // A big striped snow umbrella he holds in front of himself.
    const u = new THREE.Group();
    const top = new THREE.Mesh(sharedGeo('bfUmb', () => new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2.6)), toon(0x7fd3ff));
    top.scale.set(1, 0.55, 1);
    const stripe = new THREE.Mesh(sharedGeo('bfUmbS', () => new THREE.TorusGeometry(0.82, 0.06, 6, 24)), toon(COLORS.white));
    stripe.rotation.x = Math.PI / 2;
    stripe.position.y = 0.2;
    const stick = new THREE.Mesh(sharedGeo('bfUmbStick', () => new THREE.CylinderGeometry(0.04, 0.04, 1.4, 6)), toon(COLORS.ink));
    stick.position.y = -0.6;
    u.add(top, stripe, stick);
    u.rotation.x = 0.9; // held up over his head, tilted toward the bells
    u.position.set(0, 1.5, 0.3);
    u.scale.setScalar(0.62);
    // Parent to the king's inner group so it wobbles with him (and inherits his size).
    this.king.inner.add(u);
    this.umbrella = u;
  }

  /** The bell a bean is aiming at: the one straight ahead (closest in x). */
  aimBell(e) {
    let best = this.bells[0], bd = Infinity;
    for (const b of this.bells) {
      const d = Math.abs(b.x - e.x);
      if (d < bd) { bd = d; best = b; }
    }
    return best;
  }

  throwBall(e) {
    const bell = this.aimBell(e);
    const from = new THREE.Vector3(e.x + 0.3, e.y + 1.0, e.z - 0.2);
    const to = bell.pos.clone();
    const T = 0.55 + from.distanceTo(to) * 0.03;
    const mesh = new THREE.Mesh(sharedGeo('bfBall', () => new THREE.SphereGeometry(0.2, 10, 8)), toon(COLORS.white));
    mesh.castShadow = true;
    mesh.position.copy(from);
    this.scene.add(mesh);
    this.balls.push({
      e, bell, mesh, t: 0, T, from,
      vx: (to.x - from.x) / T, vz: (to.z - from.z) / T, vy: (to.y - from.y) / T + 0.5 * G * T,
    });
    e.ch.squash(1.2);
    this.game.audio.play('whoosh');
  }

  updateBalls(dt) {
    for (const b of this.balls) {
      b.t += dt;
      const tt = Math.min(b.t, b.T);
      b.mesh.position.set(b.from.x + b.vx * tt, b.from.y + b.vy * tt - 0.5 * G * tt * tt, b.from.z + b.vz * tt);
      if (b.t >= b.T) {
        b.done = true;
        this.scene.remove(b.mesh);
        const blocked = Math.abs(this.k.x - b.bell.x) < BLOCK && !this.finished;
        if (blocked) {
          this.puffs.burst(b.mesh.position.clone(), 0xffffff, { count: 12, speed: 4, size: 0.35 });
          this.game.audio.play('splat');
          this.k.laugh = 1.1;
          this.king.squash(1.1);
        } else {
          this.puffs.burst(b.mesh.position.clone(), 0xffffff, { count: 8, speed: 3, size: 0.25 });
          b.bell.wobble = 1;
          b.bell.rings++;
          this.game.audio.play('coin');
          this.addPoint(b.e, b.bell.pos.clone().setY(WALL_H + 2.8));
        }
      }
    }
    this.balls = this.balls.filter((b) => !b.done);
  }

  updateKing(dt) {
    const k = this.k;
    const playing = this.state === 'play' && !this.finished;
    k.laugh -= dt;
    if (playing && k.laugh <= 0) {
      // Rush to the bell with the snowball that lands soonest; otherwise drift toward the beans.
      let target = null, soon = Infinity;
      for (const b of this.balls) {
        const left = b.T - b.t;
        if (left < soon) { soon = left; target = b.bell.x; }
      }
      if (target === null) {
        k.wander -= dt;
        if (k.wander <= 0) {
          const xs = this.ents.map((e) => this.aimBell(e).x);
          k.goal = xs[Math.floor(Math.random() * xs.length)] ?? 0;
          k.wander = 1.2 + Math.random();
        }
        target = k.goal;
      }
      const speed = 3.8 + this.n * 0.3;
      const dx = target - k.x;
      k.vx = THREE.MathUtils.clamp(dx * 4, -speed, speed);
    } else {
      k.vx *= 0.85;
    }
    k.x = THREE.MathUtils.clamp(k.x + k.vx * dt, -10, 10);
    const g = this.king.group;
    g.position.x = k.x;
    g.rotation.y = this.finished ? g.rotation.y + dt * 2 : Math.sin(this.time * 2) * 0.15;
    this.umbrella.visible = !this.finished;
    this.king.update(dt, { dizzy: this.finished, hop: Math.abs(k.vx) > 0.5 ? 14 : 0 });
    if (this.finished) this.king.setMood('laugh');
    else this.king.setMood(k.laugh > 0 ? 'laugh' : 'grumpy');
    this.haTag.style.display = k.laugh > 0 && !this.finished ? '' : 'none';
    if (k.laugh > 0) {
      this.haTag.textContent = t('bossf.ha');
      this.game.ui.place(this.haTag, new THREE.Vector3(k.x + 1.2, KING_Y + 3.2, KING_Z), this.camera);
    }
  }

  updateBoss(dt) {
    const pos = this.snow.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      let y = pos.getY(i) - dt * 1.1;
      if (y < 0) y += 18;
      pos.setY(i, y);
    }
    pos.needsUpdate = true;

    this.updateKing(dt);
    for (const e of this.ents) {
      this.moveBean(e, dt, { x0: -HW, x1: HW, z0: Z0, z1: Z1 }, { jump: false });
      e.cd -= dt;
      const inp = this.input(e.p);
      if (this.state === 'play' && !this.finished && inp && (inp.aPressed || inp.bPressed) && e.cd <= 0) {
        e.cd = THROW_CD;
        this.throwBall(e);
      }
      // Beans face the fort while standing still.
      if (Math.hypot(e.vx, e.vz) < 0.5) e.ch.face(0, -1);
      const bell = this.aimBell(e);
      e.reticle.visible = this.state === 'play' && !this.finished;
      e.reticle.position.set(bell.x, WALL_H + 1.95, WALL_Z + 0.6);
      e.reticle.scale.setScalar(0.8 + 0.1 * Math.sin(this.time * 6 + e.x));
    }
    this.separate();
    this.updateBalls(dt);
    for (const b of this.bells) {
      b.wobble = Math.max(0, b.wobble - dt * 0.8);
      b.swing.rotation.z = Math.sin(this.time * 18) * b.wobble * 0.6;
      if (this.finished) b.swing.rotation.z = Math.sin(this.time * 14 + b.x) * 0.4;
    }
  }

  end() {
    for (const e of this.ents) e.reticle.visible = false;
    super.end();
  }

  onStart() {
    this.game.ui.toast(t('bossf.hint'), 4000);
  }
}

function makeFir(rand) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(sharedGeo('bfTrunk', () => new THREE.CylinderGeometry(0.18, 0.22, 0.8, 6)), toon(COLORS.trunk));
  trunk.position.y = 0.4;
  g.add(trunk);
  for (let i = 0; i < 3; i++) {
    const cone = new THREE.Mesh(sharedGeo(`bfCone${i}`, () => new THREE.ConeGeometry(1.1 - i * 0.28, 1.2, 7)), toon(i % 2 ? 0x3fa65a : 0x2f8f4e));
    cone.position.y = 1.0 + i * 0.7;
    cone.castShadow = true;
    const cap = new THREE.Mesh(sharedGeo(`bfFirSnow${i}`, () => new THREE.ConeGeometry(0.5 - i * 0.12, 0.45, 7)), toon(COLORS.white));
    cap.position.y = 1.45 + i * 0.7;
    g.add(cone, cap);
  }
  g.scale.setScalar(1 + rand() * 0.6);
  return g;
}
