import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { COLORS, toon, basic, sharedGeo } from '../../core/palette.js';
import { addLights, skyTexture, seeded } from '../../core/world.js';
import { makeGrumble } from '../../core/critters.js';
import { t, addStrings } from '../../core/i18n.js';
import { BossScene, volley } from './boss-common.js';

// Frosty Peaks boss: "He throws back". The Grumble King guards the five bells on his snow fort
// with a big umbrella and throws snowballs back at the beans.
// - Beans: hold [B] to pack a snowball (you stand almost still while packing), then tap [B] to
//   throw it at the bell straight ahead (the colored ring shows which; it turns grey when an
//   umbrella covers that bell). [A] hops.
// - A good plan: pack your snowball away from the umbrellas, then run to a free bell and throw.
// - The King lobs snowballs at the beans. A purple ring on the snow shows where each one lands;
//   a hit makes you slip and drop your snowball for a moment (no harm).
// - He moves his umbrella to the bell most beans are aiming at (with a short reaction delay),
//   so the team rings bells by spreading out and switching bells.
// - Phase 2 (a third of the goal): helper grumbles pop up and guard bells too.
//   Phase 3 (two thirds): a snowball storm, the helpers throw as well.
// Scaling with n players: goal 8 + 3n bells (stages.js), throws per volley ceil(n/2) (+1 in
// phase 3), helpers per helperCount() below (at least one bell is always open), and the guards
// react faster and walk faster with more beans to watch (solo gets a slower King).

addStrings({
  en: {
    'bossf.hint': 'Hold [B] to make a snowball, tap [B] to throw it at the bell in front of you · step out of the purple rings!',
    'bossf.ha': 'Ha!',
    'bossf.p1': 'He calls his helpers! Find a free bell!',
    'bossf.p2': 'Snowball storm! Keep dodging!',
  },
  no: {
    'bossf.hint': 'Hold [B] for å lage en snøball, trykk [B] for å kaste den på bjella foran deg · gå ut av de lilla ringene!',
    'bossf.ha': 'Ha!',
    'bossf.p1': 'Han roper på hjelperne sine! Finn en ledig bjelle!',
    'bossf.p2': 'Snøballstorm! Fortsett å unngå!',
  },
});

const HW = 10.5; // yard half width
const Z0 = 0.5, Z1 = 7.5; // yard depth
const WALL_Z = -2.6;
const WALL_H = 1.5;
const BELL_XS = [-8, -4, 0, 4, 8];
const BELL_Y = WALL_H + 1.95; // middle of a bell
const KING_Z = -4.2;
const KING_Y = 1.25; // he stands on a snow step behind the wall, head and crown above it
const UMB_Z = WALL_Z + 0.85; // umbrellas are held just in front of the bells
const COVER = 1.0; // an umbrella this close (in x) to a bell covers it
const PACK_TIME = 0.75; // holding [B] this long packs a snowball
const PACK_SPEED = 1.8; // walking speed while packing
const G = 18;
const HELPER_COLOR = 0x7b6cf6; // the usual grumble violet, unlike any player color

/**
 * Helper grumbles guarding bells, by players and phase: big teams get one from the start, and
 * from phase 2 there is one per extra bean (at least 1, at most 3, so one bell of five stays open).
 *   n:       1  2  3  4  5  6
 *   phase 1: 0  0  1  1  2  2
 *   phase 2: 1  1  2  3  3  3
 */
const helperCount = (n, phase) => (phase === 0 ? Math.floor((n - 1) / 2) : Math.min(3, Math.max(1, n - 1)));

// Per phase: seconds between the King's throws, how long a throw is in the air, how long he
// takes to notice where the beans are aiming, and how fast he walks.
const KING_GAP = [2.7, 2.3, 1.9];
const LOB_TIME = [1.35, 1.2, 1.05];
const REACT = [1.0, 0.85, 0.7];
const WALK = [4.2, 4.8, 5.4];

export class BossFrostScene extends BossScene {
  constructor(game, opts) {
    super(game, opts, { chapter: 1, kingSize: 2.1 });
    this.camera.fov = 40;
    this.scene.background = skyTexture('#86c8ff', '#f2fbff');
    addLights(this.scene, { size: 20, dir: new THREE.Vector3(-0.3, 1, 0.6) });
    this.balls = [];
    this.buildYard();
    this.buildFort();

    this.king.group.position.set(1.6, KING_Y, KING_Z);
    // Guards hold an umbrella in front of one bell each: the King first, helpers later.
    this.guards = [];
    this.kingGuard = this.addGuard('king', 2);
    for (const gd of this.guards) gd.pop = 1;
    this.addHelpers(helperCount(this.n, 0));
    for (const gd of this.guards) gd.pop = 1;
    this.throwT = 2.2; // first throw shortly after the start
    this.windup = 0;
    this.targetOrder = [];

    const n = this.players.length;
    this.players.forEach((p, i) => {
      const e = this.makeBean(p, n === 1 ? 0 : -7 + (14 * i) / (n - 1), 5);
      e.ball = false;
      e.pack = 0;
      e.held = false; // [B] must be let go between packing and throwing
      e.reticle = new THREE.Mesh(sharedGeo('bfReticle', () => new THREE.RingGeometry(0.55, 0.72, 28)), basic(p.color));
      e.reticle.visible = false;
      e.reticleColor = basic(p.color);
      this.scene.add(e.reticle);
      // The snowball in hand, shown while you have one ready.
      e.hand = new THREE.Mesh(sharedGeo('bfHand', () => new THREE.SphereGeometry(0.2, 12, 9)), toon(COLORS.white));
      e.hand.position.set(0.45, 0.62, 0.25);
      e.ch.group.add(e.hand);
    });
    // The snowball he lifts over his head before a throw.
    this.kingBall = new THREE.Mesh(sharedGeo('bfKingBall', () => new THREE.SphereGeometry(0.34, 12, 9)), toon(COLORS.white));
    this.kingBall.visible = false;
    this.scene.add(this.kingBall);
    this.haTag = this.game.ui.label('label');
    this.haTag.style.color = '#8a63f0';
    this.haTag.style.display = 'none';
    this.haT = 0;
    this.haPos = new THREE.Vector3();
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
    // The yard the beans play in: a pale blue icy patch with soft snow banks around it.
    const yard = new THREE.Mesh(new THREE.PlaneGeometry(HW * 2 + 0.6, Z1 - WALL_Z + 0.4), toon(0xe3f1ff));
    yard.rotation.x = -Math.PI / 2;
    yard.position.set(0, 0.01, (Z1 + WALL_Z) / 2);
    yard.receiveShadow = true;
    s.add(yard);
    for (let i = 0; i < 9; i++) {
      const bank = new THREE.Mesh(sharedGeo('bfBank', () => new THREE.SphereGeometry(1, 12, 8)), toon(COLORS.white));
      bank.position.set(-HW + (i * HW * 2) / 8, -0.35, Z1 + 1.1);
      bank.scale.set(1.6, 0.7, 0.9);
      s.add(bank);
    }
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
    this.bells = BELL_XS.map((x, i) => {
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
      return { i, x, g, swing, wobble: 0, rings: 0, pos: new THREE.Vector3(x, BELL_Y, WALL_Z + 0.2) };
    });
  }

  /** A striped umbrella held open toward the beans (dome facing the camera). */
  makeUmbrella(color, size) {
    const u = new THREE.Group();
    const dome = new THREE.Group();
    const top = new THREE.Mesh(sharedGeo('bfUmb', () => new THREE.SphereGeometry(1, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2.4)), toon(color));
    top.scale.set(1, 0.5, 1);
    const stripe = new THREE.Mesh(sharedGeo('bfUmbS', () => new THREE.TorusGeometry(0.8, 0.07, 6, 24)), toon(COLORS.white));
    stripe.rotation.x = Math.PI / 2;
    stripe.position.y = 0.22;
    const tip = new THREE.Mesh(sharedGeo('bfUmbTip', () => new THREE.SphereGeometry(0.09, 8, 6)), toon(COLORS.white));
    tip.position.y = 0.52;
    dome.add(top, stripe, tip);
    dome.rotation.x = Math.PI / 2; // dome points toward +z (the beans)
    const stick = new THREE.Mesh(sharedGeo('bfUmbStick', () => new THREE.CylinderGeometry(0.05, 0.05, 1.3, 6)), toon(COLORS.ink));
    stick.rotation.x = Math.PI / 2;
    stick.position.z = -0.65;
    u.add(dome, stick);
    u.scale.setScalar(size);
    u.userData.dome = dome;
    this.scene.add(u);
    return u;
  }

  /** A guard: the King or a helper grumble, each holding an umbrella in front of one bell. */
  addGuard(kind, bell) {
    const king = kind === 'king';
    const x = BELL_XS[bell];
    const gd = {
      kind, x, bell, think: king ? 0.5 : 1.2, wobble: 0, pop: king ? 1 : 0, giggle: 0,
      umb: this.makeUmbrella(king ? 0x7fd3ff : 0xff9fd0, king ? 1.3 : 1.12),
      throwT: 2.5 + Math.random() * 2,
    };
    if (!king) {
      gd.mesh = makeGrumble(HELPER_COLOR);
      gd.mesh.scale.setScalar(1.7);
      this.scene.add(gd.mesh);
      this.puffs.burst(new THREE.Vector3(x + 1, WALL_H + 1, KING_Z + 0.6), 0xffffff, { count: 16, speed: 4, size: 0.45 });
    }
    this.guards.push(gd);
    return gd;
  }

  /** Is this bell covered by any umbrella right now? */
  covered(bell) {
    return this.guards.some((g) => Math.abs(g.x - bell.x) < COVER && g.pop > 0.6 && !this.finished);
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
      if (b.t < b.T) continue;
      b.done = true;
      this.scene.remove(b.mesh);
      if (this.finished) continue;
      const guard = this.guards.find((g) => Math.abs(g.x - b.bell.x) < COVER && g.pop > 0.6);
      if (guard) {
        // Poof on the umbrella, and a smug "Ha!".
        this.puffs.burst(new THREE.Vector3(guard.x, BELL_Y, UMB_Z + 0.4), 0xffffff, { count: 12, speed: 4, size: 0.35 });
        this.game.audio.play('splat');
        guard.wobble = 1;
        guard.giggle = 1.1;
        this.ha(new THREE.Vector3(guard.x, BELL_Y + 1.6, UMB_Z));
      } else {
        this.puffs.burst(b.mesh.position.clone(), 0xffffff, { count: 8, speed: 3, size: 0.25 });
        b.bell.wobble = 1;
        b.bell.rings++;
        this.game.audio.play('coin');
        this.addPoint(b.e, b.bell.pos.clone().setY(WALL_H + 2.8));
      }
    }
    this.balls = this.balls.filter((b) => !b.done);
  }

  ha(pos) {
    this.haT = 0.9;
    this.haPos.copy(pos);
  }

  /** Helpers join in phase 2; in phase 3 they throw too. */
  onPhase(p) {
    if (p === 1) {
      this.addHelpers(helperCount(this.n, 1));
      this.game.audio.play('trap');
      this.game.ui.toast(t('bossf.p1'), 2600);
    } else if (p === 2) {
      this.game.audio.play('whoosh');
      this.game.ui.toast(t('bossf.p2'), 2600);
    }
  }

  /** Bring the helper grumbles up to `count`, each on a bell nobody covers yet. */
  addHelpers(count) {
    while (this.guards.length - 1 < count) {
      const used = new Set(this.guards.map((g) => g.bell));
      const free = [1, 3, 0, 4, 2].filter((b) => !used.has(b));
      this.addGuard('helper', free[0]);
    }
  }

  /** Where the beans are aiming: a weight per bell (beans with a snowball ready count more). */
  aimWeights() {
    const w = this.bells.map(() => 0);
    for (const e of this.ents) {
      if (e.slip > 0) continue;
      w[this.aimBell(e).i] += e.ball ? 1.5 : 1;
    }
    return w;
  }

  /** Each guard picks the busiest bell nobody else is covering, after a short reaction time. */
  updateGuards(dt) {
    const playing = this.state === 'play' && !this.finished;
    const weights = this.aimWeights();
    for (const gd of this.guards) {
      gd.pop = Math.min(1, gd.pop + dt * 2.5);
      gd.wobble = Math.max(0, gd.wobble - dt * 2.5);
      gd.giggle -= dt;
      const king = gd.kind === 'king';
      if (playing) {
        gd.think -= dt;
        if (gd.think <= 0) {
          // Slower to react when there are few beans to watch (solo is fair), sharp with a crowd.
          gd.think = (REACT[this.phase] + 0.9 / this.n - 0.15 + (king ? 0 : 0.4)) * (0.85 + Math.random() * 0.3);
          const taken = new Set(this.guards.filter((o) => o !== gd).map((o) => o.bell));
          let best = gd.bell, bw = -1;
          for (const b of this.bells) {
            if (taken.has(b.i)) continue;
            // Prefer busy bells, then the ones close by.
            const score = weights[b.i] - Math.abs(b.x - gd.x) * 0.04 + Math.random() * 0.1;
            if (score > bw) { bw = score; best = b.i; }
          }
          gd.bell = best;
        }
        const speed = (king ? WALK[this.phase] : WALK[this.phase] - 1.2) - 0.8 + this.n * 0.3;
        const dx = BELL_XS[gd.bell] - gd.x;
        gd.vx = THREE.MathUtils.clamp(dx * 5, -speed, speed);
      } else {
        gd.vx = (gd.vx || 0) * 0.85;
      }
      gd.x += (gd.vx || 0) * dt;
      // Umbrella in front of the bell; the holder stands just to its right.
      const shake = Math.sin(this.time * 30) * gd.wobble * 0.25;
      gd.umb.visible = !this.finished;
      gd.umb.position.set(gd.x, BELL_Y + Math.sin(this.time * 3 + gd.x) * 0.05 - (1 - gd.pop) * 2, UMB_Z);
      gd.umb.rotation.set(0, shake, shake);
      if (!king) {
        const m = gd.mesh;
        m.position.set(gd.x + 1.05, KING_Y + (gd.pop - 1) * 1.5 + Math.abs(Math.sin(this.time * 10)) * 0.08 * Math.min(1, Math.abs(gd.vx || 0)), KING_Z + 0.5);
        m.rotation.y = this.finished ? m.rotation.y + dt * 4 : -0.25;
        m.rotation.z = gd.giggle > 0 || this.finished ? Math.sin(this.time * 16) * 0.12 : 0;
      }
    }
  }

  /** Throw a telegraphed snowball from (x, y, z) at one bean. */
  throwAt(e, from, time) {
    const mesh = new THREE.Mesh(sharedGeo('bfLob', () => new THREE.SphereGeometry(0.3, 12, 9)), toon(COLORS.white));
    mesh.castShadow = true;
    // He aims a little ahead of a running bean, so you dodge by changing direction, not just by moving.
    const lead = time * 0.45;
    const x = THREE.MathUtils.clamp(e.x + e.vx * lead + (Math.random() - 0.5) * 0.6, -HW + 0.5, HW - 0.5);
    const z = THREE.MathUtils.clamp(e.z + e.vz * lead + (Math.random() - 0.5) * 0.6, Z0 + 0.3, Z1 - 0.3);
    this.lob({ from, x, z, time, r: 1.05, mesh, arc: 3.2 });
    this.game.audio.play('whoosh');
  }

  /** Beans to aim at, round robin so nobody is picked on (beans that are slipping get a break). */
  nextTargets(count) {
    const out = [];
    for (let tries = 0; out.length < count && tries < count * 3 + 6; tries++) {
      if (!this.targetOrder.length) this.targetOrder = [...this.ents].sort(() => Math.random() - 0.5);
      const e = this.targetOrder.shift();
      if (e.slip > 0 && this.ents.length > 1) continue;
      if (!out.includes(e) || this.ents.length < count) out.push(e);
    }
    return out;
  }

  updateKing(dt) {
    const k = this.kingGuard;
    const playing = this.state === 'play' && !this.finished;
    const g = this.king.group;
    // The King stands beside his umbrella.
    g.position.x = THREE.MathUtils.clamp(k.x + 1.6, -10.4, 10.4);
    if (playing) {
      this.throwT -= dt;
      if (this.throwT <= 0 && this.windup <= 0) {
        this.windup = 0.5; // lift a snowball over his head first
        this.king.squash(1.2);
      }
      if (this.windup > 0) {
        this.windup -= dt;
        if (this.windup <= 0) {
          const targets = this.nextTargets(volley(this.n, this.phase));
          targets.forEach((e, i) => this.later(i * 0.18, () => {
            if (this.finished || this.state !== 'play') return;
            this.throwAt(e, new THREE.Vector3(g.position.x, KING_Y + 3.2, KING_Z + 0.6), LOB_TIME[this.phase]);
            this.king.squash(0.85);
          }));
          this.throwT = KING_GAP[this.phase] * (0.9 + Math.random() * 0.2);
        }
      }
      // Phase 3: helpers throw now and then too.
      if (this.phase >= 2) {
        for (const gd of this.guards) {
          if (gd.kind === 'king') continue;
          gd.throwT -= dt;
          if (gd.throwT <= 0) {
            gd.throwT = 3.8 + Math.random() * 1.6;
            const [e] = this.nextTargets(1);
            if (e) this.throwAt(e, new THREE.Vector3(gd.x + 1.05, KING_Y + 1.8, KING_Z + 0.8), 1.3);
            gd.mesh.scale.setScalar(1.9);
            this.later(0.15, () => gd.mesh.scale.setScalar(1.7));
          }
        }
      }
    } else {
      this.windup = 0;
    }
    this.kingBall.visible = this.windup > 0 && playing;
    this.kingBall.position.set(g.position.x, KING_Y + 3.0 + (0.5 - this.windup) * 0.8, KING_Z + 0.4);
    g.rotation.y = this.finished ? g.rotation.y + dt * 2 : -0.35 + Math.sin(this.time * 2) * 0.1;
    this.king.update(dt, { dizzy: this.finished, hop: Math.abs(k.vx || 0) > 0.5 ? 14 : 0 });
    if (this.finished) this.king.setMood('laugh');
    else this.king.setMood(k.giggle > 0 ? 'laugh' : 'grumpy');
  }

  onSlip(e) {
    // Drop the snowball: it plops in the snow, and making a new one waits until you're up again.
    if (e.ball) this.puffs.burst(new THREE.Vector3(e.x + 0.3, 0.3, e.z), 0xffffff, { count: 6, speed: 2, size: 0.3 });
    e.ball = false;
    e.pack = 0;
  }

  updateBoss(dt) {
    const pos = this.snow.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      let y = pos.getY(i) - dt * 1.1;
      if (y < 0) y += 18;
      pos.setY(i, y);
    }
    pos.needsUpdate = true;

    this.updateGuards(dt);
    this.updateKing(dt);
    const playing = this.state === 'play' && !this.finished;
    for (const e of this.ents) {
      const inp = playing && e.slip <= 0 ? this.input(e.p) : null;
      const packing = !!inp && inp.b && !e.ball && !e.held;
      this.moveBean(e, dt, { x0: -HW, x1: HW, z0: Z0, z1: Z1 }, { speed: packing ? PACK_SPEED : undefined });
      if (packing) {
        // Scoop and pat: the bean crouches while the snowball grows in its hand.
        e.pack += dt;
        e.ch.pivot.rotation.x = 0.35;
        if (e.pack >= PACK_TIME) {
          e.ball = true;
          e.pack = 0;
          e.held = true;
          e.ch.squash(1.2);
          this.game.audio.play('select');
        }
      } else {
        e.pack = Math.max(0, e.pack - dt * 2);
        e.ch.pivot.rotation.x *= 0.8;
      }
      if (inp && !inp.b) e.held = false;
      if (inp && inp.bPressed && e.ball && !e.held) {
        e.ball = false;
        e.held = true;
        this.throwBall(e);
      }
      e.hand.visible = e.ball || e.pack > 0.05;
      e.hand.scale.setScalar(e.ball ? 1 : Math.min(1, e.pack / PACK_TIME));
      // Beans face the fort while standing still.
      if (Math.hypot(e.vx, e.vz) < 0.5 && e.slip <= 0) e.ch.face(0, -1);
      const bell = this.aimBell(e);
      e.reticle.visible = playing;
      e.reticle.material = this.covered(bell) ? basic(0xb4b0c4) : e.reticleColor;
      e.reticle.position.set(bell.x, BELL_Y, UMB_Z + 0.75);
      e.reticle.scale.setScalar(0.8 + 0.1 * Math.sin(this.time * 6 + e.x));
    }
    this.separate();
    this.updateBalls(dt);
    for (const b of this.bells) {
      b.wobble = Math.max(0, b.wobble - dt * 0.8);
      b.swing.rotation.z = Math.sin(this.time * 18) * b.wobble * 0.6;
      if (this.finished) b.swing.rotation.z = Math.sin(this.time * 14 + b.x) * 0.4;
    }
    this.haT -= dt;
    this.haTag.style.display = this.haT > 0 && !this.finished ? '' : 'none';
    if (this.haT > 0) {
      this.haTag.textContent = t('bossf.ha');
      this.game.ui.place(this.haTag, this.haPos, this.camera);
    }
  }

  end() {
    for (const e of this.ents) { e.reticle.visible = false; e.hand.visible = false; }
    this.kingBall.visible = false;
    super.end();
  }

  onStart() {
    this.game.ui.toast(t('bossf.hint'), 4500);
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
