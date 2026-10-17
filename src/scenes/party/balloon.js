import * as THREE from 'three';
import { Round, clock } from './common.js';
import { COLORS, PLAYER_COLORS, toon, sharedGeo } from '../../core/palette.js';
import { makeTree, makeCloud, makeFlower, seeded } from '../../core/world.js';
import { t, addStrings } from '../../core/i18n.js';

addStrings({
  en: {
    'balloon.title': 'Balloon Pump',
    'balloon.hint': 'Tap A to pump your balloon bigger. Tap B to bank it: bigger balloons are worth more points. But every balloon pops at a secret size, and a popped one gives nothing!',
    'balloon.pop': 'POP!', 'balloon.banked': 'banked',
    'balloon.n': '{n} balloons · best {b}', 'balloon.n1': '1 balloon · best {b}',
  },
  no: {
    'balloon.title': 'Ballongpumpa',
    'balloon.hint': 'Trykk A for å pumpe ballongen større. Trykk B for å spare den: store ballonger gir flere poeng. Men hver ballong sprekker ved en hemmelig størrelse, og da får du ingenting for den!',
    'balloon.pop': 'PANG!', 'balloon.banked': 'spart',
    'balloon.n': '{n} ballonger · beste {b}', 'balloon.n1': '1 ballong · beste {b}',
  },
});

// Balloon Pump: press your luck. Pump (A) for size, bank (B) for points, or pop for nothing.
const TIME = 30;
const KNOT_Y = 2.75; // where the balloon is tied, above the pump
const REFILL = 1; // seconds before a fresh balloon appears (keeps tiny safe balloons from being the best plan)

/** Secret pop size: mostly middling, sometimes tiny, sometimes huge. */
function popSize() {
  const r = Math.random();
  if (r < 0.15) return 3 + Math.floor(Math.random() * 8);
  if (r < 0.65) return 10 + Math.floor(Math.random() * 17);
  return 26 + Math.floor(Math.random() * 25);
}

const radius = (size) => 0.3 + Math.sqrt(size) * 0.145;

function makeBalloon(color) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(sharedGeo('balloonBody', () => new THREE.SphereGeometry(1, 24, 18)), toon(color));
  body.scale.set(1, 1.15, 1);
  body.castShadow = true;
  const shine = new THREE.Mesh(sharedGeo('balloonShine', () => new THREE.SphereGeometry(0.16, 10, 8)), toon(COLORS.white, { transparent: true, opacity: 0.7 }));
  shine.position.set(-0.38, 0.45, 0.78);
  shine.scale.set(1, 1.6, 0.5);
  const knot = new THREE.Mesh(sharedGeo('balloonKnot', () => new THREE.ConeGeometry(0.12, 0.18, 8)), toon(color));
  knot.position.y = -1.18;
  g.add(body, shine, knot);
  return g;
}

function makePump(color) {
  const g = new THREE.Group();
  const base = new THREE.Mesh(sharedGeo('pumpBase', () => new THREE.BoxGeometry(0.9, 0.16, 0.6)), toon(COLORS.ink));
  base.position.y = 0.08;
  const barrel = new THREE.Mesh(sharedGeo('pumpBarrel', () => new THREE.CylinderGeometry(0.2, 0.22, 1.1, 14)), toon(color));
  barrel.position.y = 0.7;
  barrel.castShadow = true;
  const band = new THREE.Mesh(sharedGeo('pumpBand', () => new THREE.CylinderGeometry(0.23, 0.23, 0.1, 14)), toon(COLORS.white));
  band.position.y = 1.1;
  const plunger = new THREE.Group();
  const rod = new THREE.Mesh(sharedGeo('pumpRod', () => new THREE.CylinderGeometry(0.05, 0.05, 0.7, 8)), toon(0xbdb8cf));
  rod.position.y = 0.35;
  const handle = new THREE.Mesh(sharedGeo('pumpHandle', () => new THREE.CylinderGeometry(0.07, 0.07, 0.8, 8)), toon(COLORS.ink));
  handle.rotation.z = Math.PI / 2;
  handle.position.y = 0.7;
  plunger.add(rod, handle);
  plunger.position.y = 1.25;
  g.add(base, barrel, band, plunger);
  g.userData.plunger = plunger;
  return g;
}

export class BalloonRound extends Round {
  static key = 'balloon';

  constructor(party) {
    super(party);
    const n = this.players.length;
    this.spacing = THREE.MathUtils.clamp(16 / n, 2.8, 4.2);
    this.t = 0;
    this.over = false;
    this.floaters = [];
    this.build();
    this.ents = this.players.map((p, i) => {
      const x = (i - (n - 1) / 2) * this.spacing;
      const pump = makePump(p.color);
      pump.position.set(x + 0.15, 0, 0);
      this.group.add(pump);
      // A hose from the pump up to the balloon's knot.
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(x + 0.38, 0.5, 0), new THREE.Vector3(x + 0.85, 0.9, 0.1),
        new THREE.Vector3(x + 0.7, 2.0, 0.1), new THREE.Vector3(x + 0.35, KNOT_Y - 0.05, 0),
      ]);
      const hose = new THREE.Mesh(new THREE.TubeGeometry(curve, 20, 0.05, 6), toon(0x3b2d6b));
      this.group.add(hose);
      const nozzle = new THREE.Mesh(sharedGeo('balloonNozzle', () => new THREE.CylinderGeometry(0.07, 0.05, 0.16, 8)), toon(0x3b2d6b));
      nozzle.position.set(x + 0.35, KNOT_Y + 0.02, 0);
      this.group.add(nozzle);
      const ch = this.bean(p);
      ch.group.position.set(x - 0.55, 0, 0.15);
      ch.yaw = ch.targetYaw = 0.5;
      return {
        p, ch, x, pump, balloon: null, size: 0, popAt: 0, refill: 0.01, pumpAnim: 0, wobble: 0, dizzy: 0,
        banked: 0, count: 0, best: 0, pops: 0, tag: this.label('label party-num'), sizeTag: this.label('label'),
      };
    });
  }

  get title() { return t('balloon.title'); }
  get hint() { return t('balloon.hint'); }

  build() {
    const g = this.group;
    const rand = seeded(23);
    const ground = new THREE.Mesh(new THREE.BoxGeometry(90, 1, 24), toon(COLORS.grass));
    ground.position.set(0, -0.5, -4);
    ground.receiveShadow = true;
    g.add(ground);
    const path = new THREE.Mesh(new THREE.BoxGeometry(90, 0.04, 2.4), toon(COLORS.sand));
    path.position.set(0, 0.01, 0.2);
    path.receiveShadow = true;
    g.add(path);
    for (let i = 0; i < 9; i++) {
      const tr = makeTree(rand, 1.6 + rand() * 0.6);
      tr.position.set(-24 + i * 6 + rand() * 2, 0, -7 - rand() * 4);
      g.add(tr);
    }
    for (let i = 0; i < 36; i++) {
      const f = makeFlower(rand);
      f.position.set((rand() - 0.5) * 34, 0, rand() < 0.5 ? -1.6 - rand() * 3 : 1.8 + rand() * 2);
      g.add(f);
    }
    for (let i = 0; i < 4; i++) {
      const c = makeCloud(rand, 2);
      c.position.set(-20 + i * 13, 13 + rand() * 3, -16);
      g.add(c);
    }
    // Bunting: little flags strung between two poles above the stations.
    const half = Math.max(9, (this.players.length * this.spacing) / 2 + 2);
    for (const s of [-1, 1]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 9.4, 8), toon(COLORS.white));
      pole.position.set(s * half, 4.7, -1.4);
      pole.castShadow = true;
      g.add(pole);
    }
    const flags = Math.round(half * 2 / 0.9);
    for (let i = 0; i <= flags; i++) {
      const x = -half + (i * half * 2) / flags;
      const sag = 8.9 - Math.cos((x / half) * Math.PI / 2) * 0.9;
      const flag = new THREE.Mesh(sharedGeo('buntFlag', () => new THREE.ConeGeometry(0.28, 0.6, 3)), toon(PLAYER_COLORS[i % 6].hex));
      flag.rotation.x = Math.PI;
      flag.position.set(x, sag - 0.3, -1.4);
      g.add(flag);
    }
  }

  frame() {
    const w = Math.max(12, this.players.length * this.spacing + 3);
    const d = this.party.fitDistance(w, 10);
    this.camera.position.set(0, 4, d + 1);
    this.camera.lookAt(0, 3.6, 0);
  }

  newBalloon(e) {
    e.balloon = makeBalloon(e.p.color);
    e.size = 1;
    e.popAt = popSize();
    e.balloon.scale.setScalar(0.01);
    this.group.add(e.balloon);
  }

  pump(e) {
    e.size++;
    e.pumpAnim = 1;
    e.wobble = 1;
    e.ch.squash(0.75);
    const a = this.game.audio;
    if (a.ctx) {
      a.noise(0.09, { vol: 0.08, freq: 900 + e.size * 30, q: 1.2 });
      a.tone(260 + e.size * 14, 0.08, { type: 'triangle', vol: 0.05, slide: 1.2 });
    }
    if (e.size >= e.popAt) this.popIt(e);
  }

  popIt(e) {
    const r = radius(e.size);
    const pos = new THREE.Vector3(e.x + 0.35, KNOT_Y + r * 1.2, 0);
    this.party.confetti.burst(pos, 0, { count: 26 + e.size, speed: 6 + r * 2, colors: [e.p.color, COLORS.white, COLORS.gold], life: 1 });
    this.game.audio.play('pop');
    this.game.audio.noise(0.12, { vol: 0.25, freq: 2500, q: 0.5 });
    this.group.remove(e.balloon);
    e.balloon = null;
    e.pops++;
    e.size = 0;
    e.refill = REFILL;
    e.dizzy = 0.8;
    this.float(e, t('balloon.pop'), '#f0364f', pos);
  }

  bank(e) {
    const s = e.size;
    e.banked += s;
    e.count++;
    e.best = Math.max(e.best, s);
    this.floaters.push({ mesh: e.balloon, vy: 1.5, sway: Math.random() * 6, x: e.x + 0.35 });
    const pos = new THREE.Vector3(e.x + 0.35, KNOT_Y + radius(s) * 1.2, 0);
    this.game.audio.play(s >= 20 ? 'star' : 'coin');
    if (s >= 20) this.party.confetti.burst(pos, 0, { count: 18, speed: 4, colors: [COLORS.gold, e.p.color] });
    e.balloon = null;
    e.size = 0;
    e.refill = REFILL;
    e.ch.squash(1.3);
    this.float(e, `+${s}`, e.p.css, pos);
  }

  /** A short-lived floating label. */
  float(e, text, color, pos) {
    const el = this.label('label party-num');
    this.floaters.push({ el, t: 0, text, color, pos: pos.clone() });
  }

  update(dt, playing) {
    this.time += dt;
    if (playing && !this.over) {
      this.t += dt;
      if (this.t >= TIME) this.timeUp();
    }
    const live = playing && !this.over;
    for (const e of this.ents) {
      e.refill -= dt;
      if (!e.balloon && e.refill <= 0 && !this.over) this.newBalloon(e);
      if (live && e.balloon) {
        const d = this.input(e.p);
        if (d.bPressed && e.size > 1) this.bank(e);
        else if (d.aPressed) this.pump(e);
      }
      e.pumpAnim = Math.max(0, e.pumpAnim - dt * 6);
      e.wobble = Math.max(0, e.wobble - dt * 3);
      e.dizzy = Math.max(0, e.dizzy - dt);
      e.pump.userData.plunger.position.y = 1.25 - e.pumpAnim * 0.45;
      if (e.balloon) {
        // Grow smoothly toward the current size, with a little jiggle on every pump.
        const target = radius(e.size);
        const cur = e.balloon.scale.x;
        const r = cur + (target - cur) * Math.min(1, dt * 14);
        const jig = 1 + Math.sin(this.time * 30) * 0.04 * e.wobble;
        e.balloon.scale.set(r * jig, r / jig, r * jig);
        e.balloon.position.set(e.x + 0.35 + Math.sin(this.time * 1.7 + e.x) * 0.04, KNOT_Y + r * 1.3, 0);
        e.balloon.rotation.z = Math.sin(this.time * 1.3 + e.x) * 0.06;
      }
      e.ch.spin = e.dizzy > 0 ? e.dizzy * 9 : 0;
      e.ch.update(dt, {});
      this.setLabel(e.tag, `${e.banked}<small>${t('balloon.banked')}</small>`, new THREE.Vector3(e.x, 6.45, 0), e.p.css);
      if (e.balloon && e.size > 1) {
        this.setLabel(e.sizeTag, String(e.size), new THREE.Vector3(e.x + 0.35, KNOT_Y + e.balloon.scale.y * 1.3 - 0.15, 1.5), '#2b2340');
      } else e.sizeTag.style.display = 'none';
    }
    this.updateFloaters(dt);
  }

  updateFloaters(dt) {
    for (const f of this.floaters) {
      if (f.mesh) {
        // Banked balloons drift up and away.
        f.vy += dt * 1.5;
        f.mesh.position.y += f.vy * dt;
        f.mesh.position.x = f.x + Math.sin(this.time * 2 + f.sway) * 0.3;
        f.mesh.rotation.z = Math.sin(this.time * 2 + f.sway) * 0.15;
        if (f.mesh.position.y > 18) f.gone = true;
      } else {
        f.t += dt;
        f.el.style.opacity = String(Math.min(1, (1.1 - f.t) * 3));
        this.setLabel(f.el, f.text, f.pos.clone().setY(f.pos.y + f.t * 1.2), f.color);
        if (f.t > 1.1) f.gone = true;
      }
    }
    this.floaters = this.floaters.filter((f) => {
      if (!f.gone) return true;
      if (f.mesh) this.group.remove(f.mesh);
      if (f.el) { f.el.remove(); this.labels = this.labels.filter((l) => l !== f.el); }
      return false;
    });
  }

  /** Time is up: balloons still on the pumps are banked for free (no sad endings). */
  timeUp() {
    this.over = true;
    for (const e of this.ents) if (e.balloon && e.size > 1) this.bank(e);
    this.game.audio.play('fanfare');
    this.later(1.8, () => { this.done = true; });
  }

  hud() {
    return clock(TIME - this.t);
  }

  score(p) {
    return this.ents.find((x) => x.p === p).banked;
  }

  detail(p) {
    const e = this.ents.find((x) => x.p === p);
    return t(e.count === 1 ? 'balloon.n1' : 'balloon.n', { n: e.count, b: e.best });
  }
}
