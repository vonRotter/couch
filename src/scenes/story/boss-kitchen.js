import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { COLORS, toon, sharedGeo } from '../../core/palette.js';
import { addLights, skyTexture } from '../../core/world.js';
import { t, addStrings } from '../../core/i18n.js';
import { makeGrumble } from '../../core/critters.js';
import { BossScene, volley } from './boss-common.js';

// Castle Kitchen boss: the hungry Grumble King sits at his table and thinks about cake.
// Walk into a cake stand to pick up that cake, then walk to his table to serve it.
// The right cake: munch munch! The wrong one: he shakes his head and you keep it.
//
// Opposition (harmless, telegraphed): he flings wobbly jelly at the beans, mostly at the ones
// carrying cake. A purple ring shows where it lands; a hit makes you slip and drop your cake.
// Phase 2 (a third of the goal): grumble waiters march back and forth across the kitchen;
// bumping into one also makes you slip. Phase 3: more waiters, more jelly, and he changes his
// mind about one wish every few seconds. Carrying a cake slows you down, and he eats one cake
// at a time (the next server waits while he chews).
// Scaling with n players: goal 6 + 3n cakes (stages.js), wishes at once ceil(n/2) (pairs of
// beans share a wish, so helping each other matters), jelly per volley ceil(n/2) (+1 in phase 3), waiters ceil(n/2) (+1 in phase 3).

addStrings({
  en: {
    'bossk.hint': 'Walk into a cake stand to grab a cake · bring him the one in his thought bubble · dodge the jelly!',
    'bossk.p1': 'His waiters are coming! Don\'t bump into them!',
    'bossk.p2': 'He keeps changing his mind! Watch his thought bubble!',
    'bossk.no': 'Not that one!', 'bossk.yum': 'Yum!', 'bossk.hmm': 'Hmm, no, THIS one!',
    'bossk.c0': 'strawberry', 'bossk.c1': 'chocolate', 'bossk.c2': 'lemon', 'bossk.c3': 'blueberry',
  },
  no: {
    'bossk.hint': 'Gå inn i et kakefat for å ta en kake · kom med den han tenker på · unngå geléen!',
    'bossk.p1': 'Kelnerne hans kommer! Ikke dult borti dem!',
    'bossk.p2': 'Han ombestemmer seg hele tiden! Følg med på tankeboblen!',
    'bossk.no': 'Ikke den!', 'bossk.yum': 'Nam!', 'bossk.hmm': 'Hmm, nei, DENNE!',
    'bossk.c0': 'jordbær', 'bossk.c1': 'sjokolade', 'bossk.c2': 'sitron', 'bossk.c3': 'blåbær',
  },
});

const HW = 10, Z0 = -2.6, Z1 = 6.2;
const TABLE_Z = -3.6, TABLE_HW = 3.4;
const KING_Z = -5.4;
// Cake types: frosting color, sponge color.
const CAKES = [
  { top: 0xff8fb8, side: 0xffd1e0 },
  { top: 0x7a4a2e, side: 0xb07a52 },
  { top: 0xffe066, side: 0xfff2b0 },
  { top: 0x7aa7ff, side: 0xcfe0ff },
];
const STAND_XS = [-7.5, -2.6, 2.6, 7.5];
const STAND_Z = 4.4;
// Per phase: seconds between jelly throws and how long a throw is in the air.
const JELLY_GAP = [2.8, 2.3, 1.9];
const JELLY_TIME = [1.3, 1.15, 1.0];
const WAITER_LANES = [1.0, 2.6, 0.2, 3.3]; // z of each waiter's path across the kitchen
const CARRY_SPEED = 4.6;
const FUSSY_GAP = 7; // phase 3: seconds between changes of mind

/** A small layered cake (about 0.7 wide). */
function makeCake(type, scale = 1) {
  const c = CAKES[type];
  const g = new THREE.Group();
  const base = new THREE.Mesh(sharedGeo('bkCakeBase', () => new THREE.CylinderGeometry(0.36, 0.38, 0.3, 18)), toon(c.side));
  base.position.y = 0.15;
  const top = new THREE.Mesh(sharedGeo('bkCakeTop', () => new THREE.CylinderGeometry(0.37, 0.37, 0.1, 18)), toon(c.top));
  top.position.y = 0.33;
  const tier = new THREE.Mesh(sharedGeo('bkCakeTier', () => new THREE.CylinderGeometry(0.22, 0.24, 0.2, 16)), toon(c.side));
  tier.position.y = 0.48;
  const tierTop = new THREE.Mesh(sharedGeo('bkCakeTierTop', () => new THREE.CylinderGeometry(0.23, 0.23, 0.08, 16)), toon(c.top));
  tierTop.position.y = 0.6;
  const cherry = new THREE.Mesh(sharedGeo('bkCherry', () => new THREE.SphereGeometry(0.08, 10, 8)), toon(0xe63950));
  cherry.position.y = 0.7;
  for (const m of [base, top, tier, tierTop, cherry]) { m.castShadow = true; g.add(m); }
  g.scale.setScalar(scale);
  return g;
}

export class BossKitchenScene extends BossScene {
  constructor(game, opts) {
    super(game, opts, { chapter: 2, kingSize: 2.3 });
    this.camera.fov = 40;
    this.scene.background = skyTexture('#ffd9b8', '#fff4e6');
    addLights(this.scene, { size: 18, dir: new THREE.Vector3(-0.3, 1, 0.6) });
    this.buildKitchen();

    this.king.group.position.set(0, 0.5, KING_Z);
    this.kingState = { chew: 0, shake: 0 };
    this.wishCount = Math.ceil(this.n / 2); // 1, 1, 2, 2, 3, 3 cakes wished for at once
    this.wishes = [];
    this.buildBubble();
    for (let i = 0; i < this.wishCount; i++) this.addWish();
    this.pendingWishes = 0;

    const n = this.players.length;
    this.players.forEach((p, i) => {
      const e = this.makeBean(p, n === 1 ? 0 : -6 + (12 * i) / (n - 1), 1.5);
      e.carry = null;
      e.carryMesh = null;
      e.serveCd = 0;
    });
    this.sayTag = this.game.ui.label('label');
    this.sayTag.style.display = 'none';
    this.sayT = 0;
    this.throwT = 2.5;
    this.windup = 0;
    this.fussyT = FUSSY_GAP;
    this.waiters = [];
    this.helpers = this.waiters; // (test bots look for scene.helpers)
    this.start('party');
  }

  frame() {
    const tilt = THREE.MathUtils.degToRad(52);
    const d = this.fitDistance(HW * 2 + 3, 17);
    this.camera.position.set(0, Math.sin(tilt) * d, Math.cos(tilt) * d + 1.2);
    this.camera.lookAt(0, 0.8, 0.4);
  }

  buildKitchen() {
    const s = this.scene;
    // Checkered floor from a small canvas texture.
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) {
      g.fillStyle = (x + y) % 2 ? '#ffe3ec' : '#fff8ec';
      g.fillRect(x * 32, y * 32, 32, 32);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(14, 9);
    tex.magFilter = THREE.NearestFilter;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(36, 24), new THREE.MeshToonMaterial({ map: tex, gradientMap: toon(0xffffff).gradientMap }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.z = 0;
    floor.receiveShadow = true;
    s.add(floor);
    // Back wall with windows and bunting.
    const wall = new THREE.Mesh(new THREE.BoxGeometry(36, 9, 0.6), toon(0xf6d7b0));
    wall.position.set(0, 4.5, -8);
    wall.receiveShadow = true;
    s.add(wall);
    for (const x of [-11, 11]) {
      const win = new THREE.Mesh(sharedGeo('bkWin', () => new RoundedBoxGeometry(3.2, 3.6, 0.3, 2, 0.4)), toon(0x9fdcff));
      win.position.set(x, 4.6, -7.6);
      const frame = new THREE.Mesh(sharedGeo('bkWinBar', () => new THREE.BoxGeometry(0.2, 3.6, 0.35)), toon(COLORS.icing));
      frame.position.set(x, 4.6, -7.55);
      s.add(win, frame);
    }
    const colors = [0xff5d73, 0xffc93c, 0x3ddc97, 0x4cc9f0, 0x9b5de5];
    for (let i = 0; i < 17; i++) {
      const flag = new THREE.Mesh(sharedGeo('bkBunt', () => new THREE.ConeGeometry(0.35, 0.7, 3)), toon(colors[i % colors.length]));
      flag.rotation.x = Math.PI;
      const x = -16 + i * 2;
      flag.position.set(x, 7.6 - Math.sin((i / 16) * Math.PI) * 0.8, -7.6);
      s.add(flag);
    }
    // Side counters with pots and an oven, just for the look.
    for (const sx of [-1, 1]) {
      const counter = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.1, 10), toon(0xc9a8ff));
      counter.position.set(sx * (HW + 2.2), 0.55, 0);
      counter.castShadow = true;
      const top = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.15, 10.2), toon(COLORS.icing));
      top.position.set(sx * (HW + 2.2), 1.15, 0);
      s.add(counter, top);
      for (let i = 0; i < 2; i++) {
        const pot = new THREE.Mesh(sharedGeo('bkPot', () => new THREE.CylinderGeometry(0.5, 0.45, 0.6, 14)), toon(0x8a94b2));
        pot.position.set(sx * (HW + 2.2), 1.52, -2.5 + i * 4);
        s.add(pot);
      }
    }
    // The King's table with a tablecloth, and his big chair.
    const table = new THREE.Mesh(sharedGeo('bkTable', () => new RoundedBoxGeometry(TABLE_HW * 2, 0.9, 1.6, 2, 0.15)), toon(0xffffff));
    table.position.set(0, 0.45, TABLE_Z);
    table.castShadow = true;
    table.receiveShadow = true;
    const cloth = new THREE.Mesh(sharedGeo('bkCloth', () => new THREE.BoxGeometry(TABLE_HW * 2 + 0.1, 0.25, 1.7)), toon(0xff8fb8));
    cloth.position.set(0, 0.8, TABLE_Z);
    s.add(table, cloth);
    const plate = new THREE.Mesh(sharedGeo('bkPlate', () => new THREE.CylinderGeometry(0.55, 0.5, 0.06, 20)), toon(COLORS.icing));
    plate.position.set(0, 0.95, TABLE_Z);
    s.add(plate);
    this.plate = plate;
    const chair = new THREE.Mesh(sharedGeo('bkChair', () => new RoundedBoxGeometry(3.4, 4.4, 0.6, 2, 0.3)), toon(0xe63950));
    chair.position.set(0, 2.2, KING_Z - 1.2);
    const seat = new THREE.Mesh(new THREE.BoxGeometry(3, 0.5, 2.2), toon(0xe63950));
    seat.position.set(0, 0.25, KING_Z);
    s.add(chair, seat);
    for (const sx of [-1, 1]) {
      const knob = new THREE.Mesh(sharedGeo('bkKnob', () => new THREE.SphereGeometry(0.3, 12, 8)), toon(COLORS.gold));
      knob.position.set(sx * 1.6, 4.5, KING_Z - 1.2);
      s.add(knob);
    }
    // Cake stands along the front.
    this.stands = STAND_XS.map((x, type) => {
      const g2 = new THREE.Group();
      g2.position.set(x, 0, STAND_Z);
      const leg = new THREE.Mesh(sharedGeo('bkLeg', () => new THREE.CylinderGeometry(0.12, 0.3, 0.9, 10)), toon(COLORS.icing));
      leg.position.y = 0.45;
      const dish = new THREE.Mesh(sharedGeo('bkDish', () => new THREE.CylinderGeometry(0.75, 0.6, 0.12, 20)), toon(COLORS.icing));
      dish.position.y = 0.95;
      const rim = new THREE.Mesh(sharedGeo('bkRim', () => new THREE.TorusGeometry(0.72, 0.05, 6, 24)), toon(CAKES[type].top));
      rim.rotation.x = Math.PI / 2;
      rim.position.y = 1.0;
      const cake = makeCake(type, 1.3);
      cake.position.y = 1.0;
      g2.add(leg, dish, rim, cake);
      s.add(g2);
      return { x, type, g: g2, cake, bob: 0 };
    });
  }

  buildBubble() {
    // A thought bubble above the King, with the cakes he wants inside.
    const g = new THREE.Group();
    g.position.set(4.6, 3.6, KING_Z + 1.4);
    const cloud = new THREE.Group();
    const puff = sharedGeo('bkPuff', () => new THREE.SphereGeometry(1, 16, 12));
    const w = 0.9 + this.wishCount * 0.85;
    for (let i = 0; i < 5; i++) {
      const m = new THREE.Mesh(puff, toon(COLORS.white));
      const x = (i / 4 - 0.5) * w;
      m.position.set(x, Math.sin(i * 1.7) * 0.15, -0.3);
      m.scale.set(0.95, 0.85, 0.5);
      cloud.add(m);
    }
    g.add(cloud);
    for (let i = 0; i < 2; i++) {
      const dot = new THREE.Mesh(puff, toon(COLORS.white));
      dot.scale.setScalar(0.22 - i * 0.07);
      dot.position.set(-w / 2 - 0.4 - i * 0.45, -0.7 - i * 0.3, 0);
      g.add(dot);
    }
    this.scene.add(g);
    this.bubble = g;
    this.bubbleW = w;
  }

  addWish() {
    // Pick a cake that isn't wished for already when possible.
    const taken = new Set(this.wishes.map((w) => w.type));
    const free = [0, 1, 2, 3].filter((i) => !taken.has(i));
    const pool = free.length ? free : [0, 1, 2, 3];
    const type = pool[Math.floor(Math.random() * pool.length)];
    const mesh = makeCake(type, 0.9);
    this.bubble.add(mesh);
    this.wishes.push({ type, mesh, pop: 0 });
    this.layoutWishes();
  }

  layoutWishes() {
    const n = this.wishes.length;
    this.wishes.forEach((w, i) => {
      w.mesh.position.set((i - (n - 1) / 2) * 0.95, -0.35, 0.35);
    });
  }

  carry(e, type) {
    if (e.carryMesh) e.ch.group.remove(e.carryMesh);
    e.carry = type;
    e.carryMesh = null;
    if (type === null) return;
    e.carryMesh = makeCake(type, 0.85);
    e.carryMesh.position.y = 1.32;
    e.ch.group.add(e.carryMesh);
  }

  say(text, color) {
    this.sayT = 1.1;
    this.sayTag.textContent = text;
    this.sayTag.style.color = color;
  }

  serve(e) {
    const i = this.wishes.findIndex((w) => w.type === e.carry);
    const k = this.king.group.position;
    if (i >= 0) {
      const w = this.wishes[i];
      this.bubble.remove(w.mesh);
      this.wishes.splice(i, 1);
      this.layoutWishes();
      const type = e.carry;
      this.carry(e, null);
      this.kingState.chew = 1.2;
      this.say(t('bossk.yum'), '#e63950');
      this.game.audio.play('pop');
      this.puffs.burst(new THREE.Vector3(k.x, 2.2, k.z + 1.2), CAKES[type].side, { count: 16, speed: 4, size: 0.3 });
      this.addPoint(e, new THREE.Vector3(k.x, 3.4, k.z + 1));
      if (!this.finished) this.later(1.3, () => { if (!this.finished) this.addWish(); });
    } else {
      this.kingState.shake = 0.8;
      this.say(t('bossk.no'), '#8a63f0');
      this.game.audio.play('bump');
      this.shove(e, e.x, TABLE_Z - 1, 6);
    }
    e.serveCd = 0.6;
  }

  onPhase(p) {
    const want = Math.min(WAITER_LANES.length, Math.ceil(this.n / 2) + (p >= 2 ? 1 : 0));
    while (this.waiters.length < want) this.addWaiter();
    this.game.audio.play(p === 1 ? 'trap' : 'whoosh');
    this.game.ui.toast(t(`bossk.p${p}`), 2600);
  }

  /** A grumble waiter with a tray, marching left and right along one lane. */
  addWaiter() {
    const i = this.waiters.length;
    const g = new THREE.Group();
    const body = makeGrumble(); // the usual grumble violet, unlike any player color
    body.scale.setScalar(1.25);
    g.add(body);
    const tray = new THREE.Mesh(sharedGeo('bkTray', () => new THREE.CylinderGeometry(0.45, 0.45, 0.06, 18)), toon(0xd8dbe8));
    tray.position.set(0, 1.3, 0);
    g.add(tray);
    const dome = new THREE.Mesh(sharedGeo('bkCloche', () => new THREE.SphereGeometry(0.3, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2)), toon(0xd8dbe8));
    dome.position.set(0, 1.33, 0);
    g.add(dome);
    const dir = i % 2 ? -1 : 1;
    const w = { g, x: -dir * (HW + 1.5), z: WAITER_LANES[i], dir, pause: 0, bumpCd: 0 };
    g.position.set(w.x, 0, w.z);
    this.scene.add(g);
    this.waiters.push(w);
  }

  updateWaiters(dt) {
    const playing = this.state === 'play' && !this.finished;
    const speed = 2.6 + this.phase * 0.4;
    for (const w of this.waiters) {
      w.bumpCd -= dt;
      if (playing) {
        if (w.pause > 0) w.pause -= dt;
        else {
          w.x += w.dir * speed * dt;
          // Turn around at the walls, with a little pause to show where they'll go next.
          if (Math.abs(w.x) > HW - 0.6 && Math.sign(w.x) === w.dir) { w.dir = -w.dir; w.pause = 0.6; }
        }
      }
      const moving = playing && w.pause <= 0;
      w.g.position.set(w.x, moving ? Math.abs(Math.sin(this.time * 11 + w.z)) * 0.1 : 0, w.z);
      w.g.rotation.y = this.finished ? w.g.rotation.y + dt * 4 : w.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      if (!playing) continue;
      for (const e of this.ents) {
        if (w.bumpCd <= 0 && Math.hypot(e.x - w.x, e.z - w.z) < 0.95 && this.slip(e, w.x, w.z, 6)) w.bumpCd = 0.8;
      }
    }
  }

  /** Jelly goes mostly to beans carrying cake (they have something to drop). */
  pickTargets(count) {
    const pool = [...this.ents].filter((e) => e.slip <= 0 || this.ents.length === 1)
      .sort((a, b) => (b.carry !== null) - (a.carry !== null) || Math.random() - 0.5);
    const out = pool.slice(0, count);
    while (out.length < count && pool.length) out.push(pool[Math.floor(Math.random() * pool.length)]);
    return out;
  }

  throwJelly(e) {
    const k = this.king.group.position;
    const mesh = new THREE.Group();
    const blob = new THREE.Mesh(sharedGeo('bkJelly', () => new THREE.SphereGeometry(0.32, 14, 10)), toon(0x7ee08a));
    blob.scale.set(1, 0.8, 1);
    const cream = new THREE.Mesh(sharedGeo('bkJellyTop', () => new THREE.SphereGeometry(0.16, 10, 8)), toon(COLORS.white));
    cream.position.y = 0.24;
    mesh.add(blob, cream);
    const time = JELLY_TIME[this.phase];
    const lead = time * 0.4;
    const x = THREE.MathUtils.clamp(e.x + e.vx * lead + (Math.random() - 0.5) * 0.6, -HW + 0.5, HW - 0.5);
    const z = THREE.MathUtils.clamp(e.z + e.vz * lead + (Math.random() - 0.5) * 0.6, Z0 + 0.3, Z1 - 0.3);
    this.lob({ from: new THREE.Vector3(k.x + 0.8, 3.2, k.z + 0.8), x, z, time, r: 1.0, mesh, color: 0x7ee08a, arc: 3 });
    this.game.audio.play('whoosh');
  }

  /** Phase 3: swap one wished-for cake for another (nobody may be carrying the new one yet). */
  changeMind() {
    if (!this.wishes.length) return;
    const w = this.wishes[Math.floor(Math.random() * this.wishes.length)];
    const taken = new Set(this.wishes.map((x) => x.type));
    const free = [0, 1, 2, 3].filter((i) => !taken.has(i));
    if (!free.length) return;
    w.type = free[Math.floor(Math.random() * free.length)];
    this.bubble.remove(w.mesh);
    w.mesh = makeCake(w.type, 0.9);
    this.bubble.add(w.mesh);
    this.layoutWishes();
    this.puffs.burst(this.bubble.position.clone(), 0xffffff, { count: 10, speed: 3, size: 0.35 });
    this.say(t('bossk.hmm'), '#8a63f0');
    this.game.audio.play('beep');
  }

  updateThrows(dt) {
    if (this.state !== 'play' || this.finished) { this.windup = 0; return; }
    if (this.phase >= 2) {
      this.fussyT -= dt;
      if (this.fussyT <= 0) { this.fussyT = FUSSY_GAP * (0.8 + Math.random() * 0.4); this.changeMind(); }
    }
    this.throwT -= dt;
    if (this.throwT <= 0 && this.windup <= 0) { this.windup = 0.45; this.king.squash(1.2); }
    if (this.windup > 0) {
      this.windup -= dt;
      if (this.windup <= 0) {
        this.pickTargets(volley(this.n, this.phase)).forEach((e, i) => this.later(i * 0.18, () => {
          if (this.finished || this.state !== 'play') return;
          this.throwJelly(e);
          this.king.squash(0.85);
        }));
        this.throwT = JELLY_GAP[this.phase] * (0.9 + Math.random() * 0.2);
      }
    }
  }

  onSlip(e) {
    // The cake tumbles off and goes splat (the stands always have more).
    if (e.carry === null) return;
    this.puffs.burst(new THREE.Vector3(e.x, 0.4, e.z), CAKES[e.carry].top, { count: 12, speed: 3.5, size: 0.3 });
    this.carry(e, null);
  }

  updateBoss(dt) {
    this.updateThrows(dt);
    this.updateWaiters(dt);
    const ks = this.kingState;
    ks.chew = Math.max(0, ks.chew - dt);
    ks.shake = Math.max(0, ks.shake - dt);
    const g = this.king.group;
    g.rotation.y = ks.shake > 0 ? Math.sin(ks.shake * 30) * 0.35 : this.finished ? Math.sin(this.time * 3) * 0.3 : 0;
    if (ks.chew > 0 && Math.floor(ks.chew * 8) % 2 === 0) this.king.squash(0.88);
    this.king.update(dt, { dizzy: this.finished, hop: this.finished ? 10 : 0 });
    if (this.finished) this.king.setMood('laugh');
    else this.king.setMood(ks.chew > 0 ? 'happy' : 'grumpy');
    if (this.windup > 0) this.king.inner.rotation.z = Math.sin(this.time * 30) * 0.08; // wind-up wiggle
    this.bubble.visible = !this.finished;
    this.bubble.position.y = 3.6 + Math.sin(this.time * 2) * 0.12;
    for (const w of this.wishes) w.mesh.rotation.y += dt * 1.5;

    for (const st of this.stands) {
      st.cake.rotation.y += dt * 0.8;
      st.bob = Math.max(0, st.bob - dt * 3);
      st.cake.position.y = 1.0 + Math.sin(st.bob * Math.PI) * 0.3;
    }

    for (const e of this.ents) {
      // Cakes are wobbly: you walk slower while carrying one.
      this.moveBean(e, dt, { x0: -HW, x1: HW, z0: Z0, z1: Z1 }, { speed: e.carry !== null ? CARRY_SPEED : undefined });
      e.serveCd -= dt;
      if (this.state !== 'play' || this.finished || e.slip > 0) continue;
      // Grab (or swap) a cake by walking into a stand.
      for (const st of this.stands) {
        if (Math.hypot(e.x - st.x, e.z - STAND_Z) < 1.2 && e.carry !== st.type) {
          this.carry(e, st.type);
          st.bob = 1;
          this.game.audio.play('select');
          e.ch.squash(1.25);
        }
      }
      // Serve by walking up to the table.
      // He eats one cake at a time: wait at the table while he is still chewing.
      if (e.carry !== null && e.serveCd <= 0 && this.kingState.chew <= 0 && e.z < Z0 + PR_SERVE && Math.abs(e.x) < TABLE_HW + 0.3) this.serve(e);
    }
    // The stands block walking through them a little.
    for (const e of this.ents) {
      for (const st of this.stands) {
        const dx = e.x - st.x, dz = e.z - STAND_Z, d = Math.hypot(dx, dz);
        if (d < 0.9 && d > 1e-4) { e.x = st.x + (dx / d) * 0.9; e.z = STAND_Z + (dz / d) * 0.9; }
      }
    }
    this.separate();
    this.sayT -= dt;
    this.sayTag.style.display = this.sayT > 0 ? '' : 'none';
    if (this.sayT > 0) this.game.ui.place(this.sayTag, new THREE.Vector3(-3.2, 3.6, KING_Z + 1.2), this.camera);
  }

  onStart() {
    this.game.ui.toast(t('bossk.hint'), 4500);
  }
}

const PR_SERVE = 0.9; // how close to the table edge counts as serving
