import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { MiniGame } from '../core/minigame.js';
import { Character } from '../core/character.js';
import { makeGrumble } from '../core/critters.js';
import { COLORS, toon, basic, sharedGeo } from '../core/palette.js';
import { addLights, skyTexture, makeCloud, seeded } from '../core/world.js';
import { t, addStrings } from '../core/i18n.js';
import { TeamPicker, TEAM_COLORS, TEAM_CSS, helpersNeeded } from '../core/teams.js';
import { voteLength } from '../core/vote.js';

addStrings({
  en: {
    'game.snowball': 'Snowball Fort',
    'snowball.intro': "B: tap to throw at the other team's targets · hold B to scoop snow · A: build a snow wall (3 snow)",
    'snowball.bot': 'Snow Bot',
    'snowball.hits': '{n} hits', 'snowball.hit1': '1 hit',
    'snowball.walls': '{n} walls', 'snowball.wall1': '1 wall',
    'snowball.throws': '{n} throws', 'snowball.throw1': '1 throw',
    'snowball.need': 'Hold B for snow!',
  },
  no: {
    'game.snowball': 'Snøballfestningen',
    'snowball.intro': 'B: trykk for å kaste på det andre lagets blinker · hold B for å samle snø · A: bygg en snømur (3 snø)',
    'snowball.bot': 'Snøbot',
    'snowball.hits': '{n} treff', 'snowball.hit1': '1 treff',
    'snowball.walls': '{n} murer', 'snowball.wall1': '1 mur',
    'snowball.throws': '{n} kast', 'snowball.throw1': '1 kast',
    'snowball.need': 'Hold B for snø!',
  },
});

// Snowball Fort: two teams, each behind a low middle ridge, throw snowballs at the
// other team's targets (bells, snowman heads, flags) and build snow walls to shield their own.
// Snowballs never hit players: they fly straight through beans.
const HX = 13, HZ = 7.5; // arena half size
const PR = 0.45; // player radius
const SPEED = 5.6;
const BOT_SPEED = 3.9;
const MATCH_TIME = 150;
const MAX_SNOW = 6;
const START_SNOW = 3;
const WALL_COST = 3;
const TAP_TIME = 0.25; // shorter B presses throw, longer ones scoop
const THROW_CD = 0.35;
const G = 14; // snowball gravity
const BALL_R = 0.17;
const HAND_Y = 1.2;
const AIM_CONE = THREE.MathUtils.degToRad(40);
const THROW_RANGE = 13; // landing distance when no target is in the aim cone
const TARGET_RESPAWN = 5;
const TARGET_R = 0.62; // hit radius around a target's center
const WL = 1.1, WT = 0.28; // wall half length and half thickness
const ROW_H = 0.5; // one row of snow bricks
const WALL_HP = 6; // hits per wall (two per brick row)
const WALL_DECAY = 14; // seconds per hp lost on its own
const WALL_SPRAY = 0.6; // walls also stop balls a little above their top (fluffy snow)
const MAX_WALLS = 6; // per team; building more crumbles the oldest
const PILE_R = 1.7;
const TARGET_Z = [-5.2, -2.6, 0, 2.6, 5.2];
const TARGET_TYPES = ['flag', 'snowman', 'bell', 'snowman', 'flag'];

const clamp = THREE.MathUtils.clamp;
const sideOf = (team) => (team ? 1 : -1); // team 0 plays on the left, team 1 on the right

/** Rounded-rectangle shape centered on the origin. */
function roundedRect(hx, hz, r) {
  const s = new THREE.Shape();
  s.moveTo(-hx + r, -hz);
  s.lineTo(hx - r, -hz);
  s.absarc(hx - r, -hz + r, r, -Math.PI / 2, 0);
  s.lineTo(hx, hz - r);
  s.absarc(hx - r, hz - r, r, 0, Math.PI / 2);
  s.lineTo(-hx + r, hz);
  s.absarc(-hx + r, hz - r, r, Math.PI / 2, Math.PI);
  s.lineTo(-hx, -hz + r);
  s.absarc(-hx + r, -hz + r, r, Math.PI, Math.PI * 1.5);
  return s;
}

/** Snowy pine: stacked cones with white caps. */
function makePine(rand, scale = 1) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(sharedGeo('sbTrunk', () => new THREE.CylinderGeometry(0.18, 0.24, 0.8, 6)), toon(COLORS.trunk));
  trunk.position.y = 0.4;
  g.add(trunk);
  for (let i = 0; i < 3; i++) {
    const cone = new THREE.Mesh(sharedGeo(`sbPine${i}`, () => new THREE.ConeGeometry(1.1 - i * 0.28, 1.25, 8)), toon(i % 2 ? 0x3fa65a : 0x2f8f4e));
    cone.position.y = 1.0 + i * 0.72;
    cone.castShadow = true;
    const cap = new THREE.Mesh(sharedGeo(`sbPineCap${i}`, () => new THREE.ConeGeometry(0.52 - i * 0.12, 0.5, 8)), toon(COLORS.white));
    cap.position.y = 1.4 + i * 0.72;
    g.add(cone, cap);
  }
  g.scale.setScalar(scale);
  g.rotation.y = rand() * 6;
  return g;
}

/** World point -> wall-local coordinates (lx along the wall, lz through it). */
function toWall(w, x, z) {
  const dx = x - w.x, dz = z - w.z;
  return { lx: dx * w.cos - dz * w.sin, lz: dx * w.sin + dz * w.cos };
}

export class SnowballScene extends MiniGame {
  constructor(game, opts) {
    super(game, opts);
    this.camera.fov = 40;
    this.scene.background = skyTexture('#a6d6ff', '#f4fbff');
    addLights(this.scene, { size: 26, dir: new THREE.Vector3(-0.3, 1, 0.45) });

    this.score = [0, 0];
    this.timeLeft = MATCH_TIME;
    this.targets = [];
    this.walls = [];
    this.balls = [];
    this.floaters = [];
    this.piles = [];
    this.shake = 0;
    this.buildArena();

    this.ents = this.players.map((p, i) => this.makeEnt(p, i % 2));
    this.frame();
    game.audio.playMusic('party');
    this.state = 'teams';
    const teams = () => { this.picker = new TeamPicker(this, {
      title: () => t('game.snowball'),
      ents: this.ents,
      setTeam: (e, team) => this.setTeam(e, team),
      onChange: () => this.placeEnts(),
      onDone: () => {
        this.picker = null;
        helpersNeeded(this.ents).forEach((need, team) => {
          for (let i = 0; i < need; i++) this.ents.push(this.makeEnt(null, team, i));
        });
        this.placeEnts();
        this.intro(t('game.snowball'), t('snowball.intro'));
      },
    }); };
    // Story campaign (opts.coop): every player on one team against helper bots, no team picker.
    const coop = () => {
      for (const e of this.ents) this.setTeam(e, 0);
      helpersNeeded(this.ents).forEach((need, team) => {
        for (let i = 0; i < need; i++) this.ents.push(this.makeEnt(null, team, i));
      });
      this.placeEnts();
      this.intro(t('game.snowball'), t('snowball.intro'));
    };
    voteLength(this, opts, () => t('game.snowball'), opts.coop ? coop : teams);
    this.placeEnts();
  }

  retryOptions() {
    return { key: this.key, length: this.matchTime };
  }

  // ---------- players and helper bots ----------

  makeEnt(p, team, slot = 0) {
    const ch = p ? new Character(p.color, { hat: p.hat }) : { group: new THREE.Group(), update() {}, face() {}, squash() {} };
    if (!p) {
      const critter = makeGrumble(TEAM_COLORS[team]);
      critter.scale.setScalar(1.3);
      ch.group.add(critter);
      ch.critter = critter;
    }
    this.scene.add(ch.group);

    // The snowball in hand, shown while you carry snow.
    const hand = new THREE.Mesh(sharedGeo('sbBall', () => new THREE.SphereGeometry(BALL_R, 12, 9)), toon(COLORS.white));
    hand.position.set(0.48, 0.62, 0.22);
    hand.castShadow = true;
    ch.group.add(hand);

    const ring = new THREE.Mesh(sharedGeo('teamRing', () => new THREE.RingGeometry(0.55, 0.78, 24)), toon(TEAM_COLORS[team]));
    ring.rotation.x = -Math.PI / 2;
    this.scene.add(ring);

    const e = {
      p, bot: !p, ch, ring, hand, team, slot,
      x: 0, z: 0, vx: 0, vz: 0, dirX: -sideOf(team), dirZ: 0,
      snow: START_SNOW, bHold: 0, bWas: false, scooping: false, scoopT: 0,
      throwCd: 0, buildCd: 0, refill: 0,
      hits: 0, walls: 0, throws: 0,
      // bot brain
      mode: 'throw', aimT: null, think: 0, wantSnow: 4, buildTimer: 8 + Math.random() * 10, station: null, buildTarget: null,
      get name() { return p ? p.name : t('snowball.bot'); },
      css: p ? p.css : TEAM_CSS[team],
    };
    if (p) {
      // Snow counter above the head, and a dotted aim arc with a ring on the aimed spot.
      e.label = this.game.ui.label('label player-tag');
      e.labelHtml = '';
      e.dots = [];
      for (let i = 0; i < 7; i++) {
        const dot = new THREE.Mesh(sharedGeo('sbDot', () => new THREE.SphereGeometry(0.07, 8, 6)), basic(p.color));
        dot.visible = false;
        this.scene.add(dot);
        e.dots.push(dot);
      }
      e.reticle = new THREE.Mesh(sharedGeo('sbReticle', () => new THREE.RingGeometry(0.5, 0.68, 28)), basic(p.color));
      e.reticle.rotation.x = -Math.PI / 2;
      e.reticle.visible = false;
      this.scene.add(e.reticle);
    }
    return e;
  }

  setTeam(e, team) {
    e.team = team;
    e.ring.material = toon(TEAM_COLORS[team]);
  }

  onLanguage() {
    this.picker?.render();
  }

  /** Spread each team over its own half, bots further back. */
  placeEnts() {
    for (const team of [0, 1]) {
      const s = sideOf(team);
      const humans = this.ents.filter((e) => e.team === team && !e.bot);
      humans.forEach((e, k) => {
        const n = humans.length;
        e.x = s * (2.8 + (k % 2) * 2.4);
        e.z = n === 1 ? 0 : -4.5 + (k * 9) / (n - 1);
      });
      this.ents.filter((e) => e.team === team && e.bot).forEach((e) => {
        e.x = s * 8.6;
        e.z = e.slot ? 3 : -3;
      });
      for (const e of this.ents.filter((m) => m.team === team)) {
        e.vx = e.vz = 0;
        e.dirX = -s; e.dirZ = 0;
        e.ch.face(e.dirX, 0);
        e.ch.yaw = e.ch.targetYaw ?? 0;
        if (e.bot) e.ch.group.rotation.y = Math.atan2(e.dirX, e.dirZ);
        e.ch.group.position.set(e.x, 0, e.z);
        e.ring.position.set(e.x, 0.03, e.z);
      }
    }
  }

  // ---------- arena ----------

  frame() {
    const tilt = THREE.MathUtils.degToRad(56);
    const d = this.fitDistance(HX * 2 + 3, HZ * 2 * Math.sin(tilt) + 7);
    this.camBase = new THREE.Vector3(0, Math.sin(tilt) * d, Math.cos(tilt) * d + 1);
    this.camera.position.copy(this.camBase);
    this.camera.lookAt(0, 0, 1);
    this.confettiOrigin = new THREE.Vector3(0, 4, 0);
  }

  resize(w, h) {
    super.resize(w, h);
    this.frame();
  }

  snowTexture() {
    const c = document.createElement('canvas');
    c.width = 1024; c.height = 592;
    const g = c.getContext('2d');
    g.fillStyle = '#f7fbff';
    g.fillRect(0, 0, 1024, 592);
    // Each half is faintly tinted in its team color.
    g.globalAlpha = 0.1;
    g.fillStyle = TEAM_CSS[0];
    g.fillRect(0, 0, 512, 592);
    g.fillStyle = TEAM_CSS[1];
    g.fillRect(512, 0, 512, 592);
    g.globalAlpha = 1;
    // Soft blue drifts and sparkles.
    const rand = seeded(9);
    for (let i = 0; i < 60; i++) {
      g.fillStyle = `rgba(170,205,240,${0.08 + rand() * 0.1})`;
      g.beginPath();
      g.ellipse(rand() * 1024, rand() * 592, 30 + rand() * 60, 8 + rand() * 14, 0, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = 'rgba(255,255,255,0.95)';
    for (let i = 0; i < 160; i++) {
      g.beginPath();
      g.arc(rand() * 1024, rand() * 592, 1.5 + rand() * 2.5, 0, Math.PI * 2);
      g.fill();
    }
    // Fort zone lines in front of each row of targets.
    g.setLineDash([18, 14]);
    g.lineWidth = 6;
    for (const team of [0, 1]) {
      g.strokeStyle = TEAM_CSS[team];
      g.globalAlpha = 0.35;
      const x = (sideOf(team) * (HX - 3.3) + HX) / (HX * 2) * 1024;
      g.beginPath(); g.moveTo(x, 30); g.lineTo(x, 562); g.stroke();
    }
    g.globalAlpha = 1;
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  }

  buildArena() {
    const s = this.scene;
    const rand = seeded(31);
    // Snow field with UVs stretched over the arena.
    const geo = new THREE.ShapeGeometry(roundedRect(HX, HZ, 1.4), 8);
    const pos = geo.attributes.position, uv = geo.attributes.uv;
    for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + HX) / (HX * 2), (pos.getY(i) + HZ) / (HZ * 2));
    const field = new THREE.Mesh(geo, new THREE.MeshToonMaterial({ map: this.snowTexture(), gradientMap: toon(0xffffff).gradientMap }));
    field.rotation.x = -Math.PI / 2;
    field.receiveShadow = true;
    s.add(field);

    // A soft snow bank all around the arena.
    const shape = roundedRect(HX + 0.7, HZ + 0.7, 2.1);
    shape.holes.push(roundedRect(HX, HZ, 1.4));
    const bank = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.35, bevelEnabled: true, bevelThickness: 0.2, bevelSize: 0.2, bevelSegments: 3, curveSegments: 12 }), toon(0xeef6ff));
    bank.rotation.x = -Math.PI / 2;
    bank.castShadow = bank.receiveShadow = true;
    s.add(bank);

    // The low middle ridge nobody crosses, with candy poles at the ends.
    const ridge = new THREE.Mesh(new THREE.CapsuleGeometry(0.4, HZ * 2 - 0.8, 6, 12), toon(0xe4f1ff));
    ridge.rotation.x = Math.PI / 2;
    ridge.scale.set(1, 1, 0.6);
    ridge.position.y = 0.05;
    ridge.castShadow = ridge.receiveShadow = true;
    s.add(ridge);
    for (const z of [-HZ - 0.3, HZ + 0.3]) {
      const pole = new THREE.Mesh(sharedGeo('sbMidPole', () => new THREE.CylinderGeometry(0.1, 0.1, 1.8, 10)), toon(0xff5d73));
      pole.position.set(0, 0.9, z);
      const top = new THREE.Mesh(sharedGeo('sbMidTop', () => new THREE.SphereGeometry(0.2, 12, 8)), toon(COLORS.white));
      top.position.set(0, 1.9, z);
      pole.castShadow = true;
      s.add(pole, top);
    }

    for (const team of [0, 1]) {
      this.buildFort(team);
      TARGET_Z.forEach((z, i) => {
        const x = sideOf(team) * (HX - 1.3 - (i % 2) * 0.6);
        this.targets.push(this.makeTarget(team, TARGET_TYPES[i], x, z));
      });
      // A big snow pile in each half: scoop here to fill up fast.
      const pile = new THREE.Group();
      const px = sideOf(team) * 6.4, pz = 0;
      [[0, 0, 1.1, 0.55], [0.7, 0.3, 0.7, 0.4], [-0.6, -0.4, 0.75, 0.38], [0.1, 0.7, 0.6, 0.32]].forEach(([x, z, r, h]) => {
        const m = new THREE.Mesh(sharedGeo('sbPileBlob', () => new THREE.SphereGeometry(1, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2)), toon(COLORS.white));
        m.position.set(x, 0, z);
        m.scale.set(r, h, r);
        m.castShadow = m.receiveShadow = true;
        pile.add(m);
      });
      const shovel = new THREE.Group();
      const stick = new THREE.Mesh(sharedGeo('sbShovelStick', () => new THREE.CylinderGeometry(0.05, 0.05, 1.2, 6)), toon(COLORS.trunk));
      stick.position.y = 0.6;
      const blade = new THREE.Mesh(sharedGeo('sbShovelBlade', () => new RoundedBoxGeometry(0.42, 0.5, 0.06, 2, 0.03)), toon(TEAM_COLORS[team]));
      blade.position.y = 1.25;
      shovel.add(stick, blade);
      shovel.position.set(0.4, 0.3, -0.5);
      shovel.rotation.set(0.3, 0, -0.4);
      pile.add(shovel);
      // A little pyramid of ready snowballs says "snow here".
      [[0, 0], [0.34, 0], [0.17, 0.28], [0.17, 0.1, 1]].forEach(([x, z, up]) => {
        const b = new THREE.Mesh(sharedGeo('sbBall', () => new THREE.SphereGeometry(BALL_R, 12, 9)), toon(COLORS.white));
        b.position.set(-1.0 + x, BALL_R + (up ? 0.26 : 0), 0.9 + z);
        b.scale.setScalar(1.15);
        b.castShadow = true;
        pile.add(b);
      });
      pile.position.set(px, 0, pz);
      s.add(pile);
      this.piles.push({ x: px, z: pz, group: pile });
    }

    // Outside: snowy ground, hills, pines and clouds.
    const ground = new THREE.Mesh(new THREE.CircleGeometry(90, 40), toon(0xeef6ff));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.02;
    ground.receiveShadow = true;
    s.add(ground);
    const hillGeo = sharedGeo('sbHill', () => new THREE.SphereGeometry(1, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2));
    for (let i = 0; i < 16; i++) {
      const a = rand() * Math.PI * 2;
      const x = Math.cos(a) * (24 + rand() * 14), z = Math.sin(a) * (16 + rand() * 10) - 6;
      if (z > 6) continue;
      const hill = new THREE.Mesh(hillGeo, toon(rand() < 0.5 ? 0xffffff : 0xe6f2ff));
      const r = 4 + rand() * 6;
      hill.scale.set(r, r * (0.35 + rand() * 0.3), r * 0.8);
      hill.position.set(x, -0.05, z);
      hill.receiveShadow = true;
      s.add(hill);
    }
    for (let i = 0; i < 46; i++) {
      const x = (rand() - 0.5) * 70;
      const z = -HZ - 3 - rand() * 18;
      const tree = makePine(rand, 1.1 + rand() * 0.8);
      tree.position.set(x, 0, z);
      s.add(tree);
    }
    for (let i = 0; i < 16; i++) {
      const sx = i % 2 ? 1 : -1;
      const tree = makePine(rand, 1 + rand() * 0.7);
      tree.position.set(sx * (HX + 3 + rand() * 9), 0, -HZ + rand() * (HZ * 2 + 4));
      s.add(tree);
    }
    for (let i = 0; i < 6; i++) {
      const cl = makeCloud(rand, 2.5 + rand());
      cl.position.set(-45 + i * 18, 14 + rand() * 6, -35);
      s.add(cl);
    }

    // Gentle snowfall.
    const n = 450;
    const flakes = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      flakes[i * 3] = (rand() - 0.5) * 60;
      flakes[i * 3 + 1] = rand() * 20;
      flakes[i * 3 + 2] = (rand() - 0.5) * 40 - 4;
    }
    const fg = new THREE.BufferGeometry();
    fg.setAttribute('position', new THREE.BufferAttribute(flakes, 3));
    this.snow = new THREE.Points(fg, new THREE.PointsMaterial({ color: 0xffffff, size: 0.18, transparent: true, opacity: 0.9 }));
    s.add(this.snow);
  }

  /** Crenellated snow wall on the back bank, towers with team roofs and banners. */
  buildFort(team) {
    const s = sideOf(team);
    const g = new THREE.Group();
    const brick = sharedGeo('sbFortBrick', () => new RoundedBoxGeometry(0.7, 0.55, 1.0, 2, 0.1));
    for (let z = -HZ + 0.6, k = 0; z <= HZ - 0.5; z += 1.02, k++) {
      for (let row = 0; row < 2; row++) {
        const m = new THREE.Mesh(brick, toon(row ? 0xffffff : 0xe8f3ff));
        m.position.set(0, 0.3 + row * 0.55, z + (row ? 0.25 : 0));
        m.castShadow = m.receiveShadow = true;
        g.add(m);
      }
      if (k % 2 === 0) {
        const cren = new THREE.Mesh(brick, toon(0xffffff));
        cren.position.set(0, 1.4, z);
        cren.scale.set(1, 0.9, 0.6);
        cren.castShadow = true;
        g.add(cren);
      }
    }
    for (const z of [-HZ - 0.2, HZ + 0.2]) {
      const tower = new THREE.Mesh(sharedGeo('sbTower', () => new THREE.CylinderGeometry(0.85, 0.95, 2.4, 14)), toon(0xf4f9ff));
      tower.position.set(0, 1.2, z);
      const roof = new THREE.Mesh(sharedGeo('sbRoof', () => new THREE.ConeGeometry(1.1, 1.2, 14)), toon(TEAM_COLORS[team]));
      roof.position.set(0, 3.0, z);
      const pole = new THREE.Mesh(sharedGeo('sbBannerPole', () => new THREE.CylinderGeometry(0.04, 0.04, 1.0, 6)), toon(COLORS.ink));
      pole.position.set(0, 4.0, z);
      const banner = new THREE.Mesh(sharedGeo('sbBanner', () => new THREE.BoxGeometry(0.03, 0.4, 0.7)), toon(TEAM_COLORS[team]));
      banner.position.set(0, 4.25, z + 0.35);
      tower.castShadow = roof.castShadow = true;
      g.add(tower, roof, pole, banner);
    }
    g.position.x = s * (HX + 0.35);
    this.scene.add(g);
  }

  /** A target in the team color. `part` is the bit that pops when hit. */
  makeTarget(team, type, x, z) {
    const s = sideOf(team);
    const col = TEAM_COLORS[team];
    const g = new THREE.Group();
    const part = new THREE.Group();
    let hy = 1.4, hx = 0;
    if (type === 'flag') {
      const mound = new THREE.Mesh(sharedGeo('sbMound', () => new THREE.SphereGeometry(0.42, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2)), toon(COLORS.white));
      const pole = new THREE.Mesh(sharedGeo('sbFlagPole', () => new THREE.CylinderGeometry(0.05, 0.05, 2.0, 8)), toon(COLORS.icing));
      pole.position.y = 1.0;
      const knob = new THREE.Mesh(sharedGeo('sbKnob', () => new THREE.SphereGeometry(0.09, 10, 8)), toon(COLORS.gold));
      knob.position.y = 2.02;
      pole.castShadow = true;
      g.add(mound, pole, knob);
      const flag = new THREE.Mesh(sharedGeo('sbFlag', () => new RoundedBoxGeometry(0.85, 0.6, 0.06, 2, 0.03)), toon(col));
      flag.position.set(-s * 0.45, 0, 0);
      const star = new THREE.Mesh(sharedGeo('sbFlagDot', () => new THREE.CylinderGeometry(0.13, 0.13, 0.08, 14)), toon(COLORS.white));
      star.rotation.x = Math.PI / 2;
      star.position.set(-s * 0.45, 0, 0.02);
      part.add(flag, star);
      part.position.y = 1.6;
      hy = 1.55; hx = -s * 0.4;
    } else if (type === 'bell') {
      for (const dz of [-0.6, 0.6]) {
        const post = new THREE.Mesh(sharedGeo('sbBellPost', () => new THREE.CylinderGeometry(0.07, 0.08, 2.1, 8)), toon(COLORS.trunk));
        post.position.set(0, 1.05, dz);
        post.castShadow = true;
        g.add(post);
      }
      const bar = new THREE.Mesh(sharedGeo('sbBellBar', () => new THREE.CylinderGeometry(0.07, 0.07, 1.45, 8)), toon(COLORS.trunk));
      bar.rotation.x = Math.PI / 2;
      bar.position.y = 2.05;
      const snowTop = new THREE.Mesh(sharedGeo('sbBellSnow', () => new RoundedBoxGeometry(0.22, 0.12, 1.5, 2, 0.05)), toon(COLORS.white));
      snowTop.position.y = 2.14;
      g.add(bar, snowTop);
      const bell = new THREE.Mesh(sharedGeo('sbBell', () => {
        const pts = [[0.02, 0.5], [0.16, 0.48], [0.24, 0.38], [0.27, 0.15], [0.33, 0.02], [0.4, -0.05], [0, -0.05]].map(([a, b]) => new THREE.Vector2(a, b));
        return new THREE.LatheGeometry(pts, 18);
      }), toon(col));
      bell.position.y = -0.5;
      bell.castShadow = true;
      const clapper = new THREE.Mesh(sharedGeo('sbClapper', () => new THREE.SphereGeometry(0.1, 10, 8)), toon(COLORS.gold));
      clapper.position.y = -0.55;
      const rope = new THREE.Mesh(sharedGeo('sbRope', () => new THREE.CylinderGeometry(0.025, 0.025, 0.3, 5)), toon(COLORS.ink));
      rope.position.y = -0.12;
      part.add(bell, clapper, rope);
      part.position.y = 2.0;
      hy = 1.6;
    } else {
      // Snowman: the body stays, the team-hatted head pops.
      const base = new THREE.Mesh(sharedGeo('sbSnowBase', () => new THREE.SphereGeometry(0.52, 16, 12)), toon(COLORS.white));
      base.position.y = 0.45;
      const mid = new THREE.Mesh(sharedGeo('sbSnowMid', () => new THREE.SphereGeometry(0.38, 16, 12)), toon(COLORS.white));
      mid.position.y = 1.08;
      const scarf = new THREE.Mesh(sharedGeo('sbScarf', () => new THREE.TorusGeometry(0.28, 0.08, 6, 16)), toon(col));
      scarf.rotation.x = Math.PI / 2;
      scarf.position.y = 1.36;
      for (const by of [0.95, 1.12]) {
        const btn = new THREE.Mesh(sharedGeo('sbButton', () => new THREE.SphereGeometry(0.05, 8, 6)), toon(COLORS.ink));
        btn.position.set(-s * 0.36, by, 0);
        g.add(btn);
      }
      base.castShadow = mid.castShadow = true;
      g.add(base, mid, scarf);
      const head = new THREE.Mesh(sharedGeo('sbSnowHead', () => new THREE.SphereGeometry(0.3, 14, 10)), toon(COLORS.white));
      head.castShadow = true;
      const nose = new THREE.Mesh(sharedGeo('sbNose', () => new THREE.ConeGeometry(0.06, 0.3, 8)), toon(0xff8c42));
      nose.rotation.z = s * Math.PI / 2;
      nose.position.set(-s * 0.38, 0, 0);
      const hat = new THREE.Mesh(sharedGeo('sbHat', () => new THREE.CylinderGeometry(0.2, 0.22, 0.3, 12)), toon(col));
      hat.position.y = 0.34;
      const brim = new THREE.Mesh(sharedGeo('sbBrim', () => new THREE.CylinderGeometry(0.32, 0.32, 0.05, 14)), toon(col));
      brim.position.y = 0.2;
      part.add(head, nose, hat, brim);
      for (const ez of [-0.11, 0.11]) {
        const eye = new THREE.Mesh(sharedGeo('sbEye', () => new THREE.SphereGeometry(0.045, 8, 6)), toon(COLORS.ink));
        eye.position.set(-s * 0.26, 0.08, ez);
        part.add(eye);
      }
      part.position.y = 1.62;
      hy = 1.65;
    }
    g.add(part);
    g.position.set(x, 0, z);
    this.scene.add(g);
    return { team, type, x, z, hx: x + hx, hy, hz: z, group: g, part, alive: true, respawn: 0, pop: 0, phase: Math.random() * 6 };
  }

  // ---------- snow walls ----------

  makeWall(team, x, z, angle, owner) {
    const g = new THREE.Group();
    const brick = sharedGeo('sbWallBrick', () => new RoundedBoxGeometry(0.72, ROW_H - 0.02, WT * 2, 2, 0.08));
    const rows = [];
    for (let r = 0; r < 3; r++) {
      const row = new THREE.Group();
      row.position.y = r * ROW_H + ROW_H / 2;
      for (let i = -1; i <= 1; i++) {
        const m = new THREE.Mesh(brick, toon((i + r) % 2 ? 0xffffff : 0xe6f2ff));
        m.position.x = i * 0.73 + (r % 2 ? 0.06 : -0.03);
        m.castShadow = m.receiveShadow = true;
        row.add(m);
      }
      g.add(row);
      rows.push(row);
    }
    // A little team pennant on top tells whose wall it is.
    const pennant = new THREE.Group();
    const stick = new THREE.Mesh(sharedGeo('sbPennantStick', () => new THREE.CylinderGeometry(0.03, 0.03, 0.6, 5)), toon(COLORS.ink));
    stick.position.y = 0.3;
    const flag = new THREE.Mesh(sharedGeo('sbPennant', () => new THREE.ConeGeometry(0.14, 0.4, 3)), toon(TEAM_COLORS[team]));
    flag.rotation.z = Math.PI / 2;
    flag.position.set(0.2, 0.5, 0);
    pennant.add(stick, flag);
    pennant.position.x = 0.8;
    g.add(pennant);

    g.position.set(x, 0, z);
    g.rotation.y = angle;
    g.scale.y = 0.01;
    this.scene.add(g);
    const w = { team, x, z, cos: Math.cos(angle), sin: Math.sin(angle), group: g, rows, pennant, hp: WALL_HP, grow: 0, decay: WALL_DECAY, wobble: 0, owner };
    this.walls.push(w);
    const mine = this.walls.filter((m) => m.team === team);
    if (mine.length > MAX_WALLS) this.crumble(mine[0]);
    this.refreshWall(w);
    return w;
  }

  /** Rows of bricks follow the wall's health. */
  refreshWall(w) {
    const rows = Math.ceil(w.hp / 2);
    w.rows.forEach((r, i) => { r.visible = i < rows; });
    w.pennant.position.y = rows * ROW_H;
    w.h = rows * ROW_H;
  }

  crumble(w) {
    this.puffs.burst(new THREE.Vector3(w.x, 0.5, w.z), 0xffffff, { count: 14, size: 0.45, life: 0.6, speed: 3 });
    this.scene.remove(w.group);
    this.walls = this.walls.filter((m) => m !== w);
  }

  hitWall(w, b) {
    w.hp--;
    w.wobble = 0.25;
    this.game.audio.play('splat');
    this.puffs.burst(new THREE.Vector3(b.x, b.y, b.z), 0xffffff, { count: 8, size: 0.32, life: 0.45, speed: 2.5 });
    if (w.hp <= 0) this.crumble(w);
    else this.refreshWall(w);
  }

  tryBuild(e) {
    if (e.buildCd > 0) return false;
    if (e.snow < WALL_COST) {
      if (!e.bot) {
        this.floater(t('snowball.need'), new THREE.Vector3(e.x, 2.3, e.z), e.css, 1.0);
        this.game.audio.play('bump');
      }
      e.buildCd = 0.5;
      return false;
    }
    const s = sideOf(e.team);
    const x = s * clamp(s * (e.x + e.dirX * 1.1), 0.9, HX - 0.7);
    const z = clamp(e.z + e.dirZ * 1.1, -HZ + 0.6, HZ - 0.6);
    this.makeWall(e.team, x, z, Math.atan2(e.dirX, e.dirZ), e);
    e.snow -= WALL_COST;
    e.walls++;
    e.buildCd = 0.5;
    e.ch.squash(0.75);
    this.game.audio.play('land');
    this.puffs.burst(new THREE.Vector3(x, 0.3, z), 0xffffff, { count: 10, size: 0.4, life: 0.5 });
    return true;
  }

  /** Pushes a circle out of a wall's footprint. */
  pushOutOfWall(o, r, w) {
    const { lx, lz } = toWall(w, o.x, o.z);
    if (Math.abs(lx) > WL + r || Math.abs(lz) > WT + r) return;
    const qx = clamp(lx, -WL, WL), qz = clamp(lz, -WT, WT);
    let dx = lx - qx, dz = lz - qz;
    const d = Math.hypot(dx, dz);
    let nx, nz;
    if (d > 1e-5) {
      if (d >= r) return;
      nx = dx / d; nz = dz / d;
      dx = nx * (r - d); dz = nz * (r - d);
    } else if (WL - Math.abs(lx) < WT - Math.abs(lz)) {
      dx = Math.sign(lx || 1) * (WL - Math.abs(lx) + r); dz = 0;
    } else {
      dx = 0; dz = Math.sign(lz || 1) * (WT - Math.abs(lz) + r);
    }
    // Back to world space (inverse of toWall).
    o.x += dx * w.cos + dz * w.sin;
    o.z += -dx * w.sin + dz * w.cos;
  }

  // ---------- throwing ----------

  /** Auto-aim: the enemy target closest to where you face, or a spot on the ground ahead. */
  aimFor(e) {
    let best = null, bestAng = AIM_CONE;
    for (const tg of this.targets) {
      if (tg.team === e.team || !tg.alive) continue;
      const dx = tg.hx - e.x, dz = tg.hz - e.z, d = Math.hypot(dx, dz) || 1;
      const ang = Math.acos(clamp((dx * e.dirX + dz * e.dirZ) / d, -1, 1));
      if (ang < bestAng) { best = tg; bestAng = ang; }
    }
    if (best) return { x: best.hx, y: best.hy, z: best.hz, target: best };
    return {
      x: clamp(e.x + e.dirX * THROW_RANGE, -HX, HX),
      y: 0,
      z: clamp(e.z + e.dirZ * THROW_RANGE, -HZ, HZ),
      target: null,
    };
  }

  /** Start point and launch velocity of a lob that lands on (x, y, z). */
  lob(e, x, y, z) {
    const sx = e.x + e.dirX * 0.4, sz = e.z + e.dirZ * 0.4;
    const d = Math.hypot(x - sx, z - sz);
    const T = 0.35 + d / 32;
    return { sx, sy: HAND_Y, sz, T, vx: (x - sx) / T, vy: (y - HAND_Y) / T + (G * T) / 2, vz: (z - sz) / T };
  }

  throwBall(e, aim) {
    if (e.snow < 1 || e.throwCd > 0) return false;
    // A little scatter that grows with distance; helpers are a lot less accurate.
    const d = Math.hypot(aim.x - e.x, aim.z - e.z);
    const spread = e.bot ? 0.5 + d * 0.04 : 0.12 + d * 0.022;
    const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * spread;
    const L = this.lob(e, aim.x + Math.cos(a) * r, aim.y + (Math.random() - 0.5) * spread * 0.6, aim.z + Math.sin(a) * r);
    const mesh = new THREE.Mesh(sharedGeo('sbBall', () => new THREE.SphereGeometry(BALL_R, 12, 9)), toon(COLORS.white));
    mesh.castShadow = true;
    const shadow = new THREE.Mesh(sharedGeo('sbShadow', () => new THREE.CircleGeometry(0.2, 12)), basic(0x5a6c99, { transparent: true, opacity: 0.25 }));
    shadow.rotation.x = -Math.PI / 2;
    this.scene.add(mesh, shadow);
    this.balls.push({ mesh, shadow, x: L.sx, y: L.sy, z: L.sz, vx: L.vx, vy: L.vy, vz: L.vz, team: e.team, owner: e, life: 4 });
    e.snow--;
    e.throws++;
    e.throwCd = THROW_CD;
    e.ch.squash(1.2);
    this.game.audio.play('dash');
    return true;
  }

  updateBalls(dt) {
    const steps = 3, h = dt / steps;
    for (const b of this.balls) {
      for (let i = 0; i < steps && !b.dead; i++) {
        b.vy -= G * h;
        b.x += b.vx * h; b.y += b.vy * h; b.z += b.vz * h;
        b.life -= h;
        // Enemy walls stop it (your own team's walls let your snowballs through).
        for (const w of this.walls) {
          if (w.team === b.team || b.y > w.h + WALL_SPRAY) continue;
          const { lx, lz } = toWall(w, b.x, b.z);
          if (Math.abs(lx) < WL + BALL_R && Math.abs(lz) < WT + BALL_R) { this.hitWall(w, b); b.dead = true; break; }
        }
        if (b.dead) break;
        for (const tg of this.targets) {
          if (tg.team === b.team || !tg.alive) continue;
          if (Math.hypot(b.x - tg.hx, b.y - tg.hy, b.z - tg.hz) < TARGET_R) { this.hitTarget(tg, b); b.dead = true; break; }
        }
        if (b.dead) break;
        if (b.y < BALL_R) {
          b.dead = true;
          this.puffs.burst(new THREE.Vector3(b.x, 0.15, b.z), 0xffffff, { count: 6, size: 0.28, life: 0.4, speed: 1.8 });
        } else if (b.life <= 0 || Math.abs(b.x) > HX + 4 || Math.abs(b.z) > HZ + 4) {
          b.dead = true;
        }
      }
      b.mesh.position.set(b.x, b.y, b.z);
      b.shadow.position.set(b.x, 0.03, b.z);
      b.shadow.scale.setScalar(clamp(1.2 - b.y * 0.12, 0.5, 1.2));
    }
    if (this.balls.some((b) => b.dead)) {
      for (const b of this.balls) if (b.dead) this.scene.remove(b.mesh, b.shadow);
      this.balls = this.balls.filter((b) => !b.dead);
    }
  }

  hitTarget(tg, b) {
    tg.alive = false;
    tg.respawn = TARGET_RESPAWN;
    tg.pop = 0;
    this.score[b.team]++;
    b.owner.hits++;
    const at = new THREE.Vector3(tg.hx, tg.hy, tg.hz);
    this.game.audio.play('pop');
    this.confetti.burst(at, 0, { count: 26, speed: 6, up: 4, colors: [TEAM_COLORS[b.team], COLORS.white, COLORS.gold], life: 1.1, size: 0.16 });
    this.puffs.burst(at, 0xffffff, { count: 10, size: 0.4, life: 0.5, speed: 3 });
    this.floater('+1', at.clone().setY(tg.hy + 0.7), TEAM_CSS[b.team], 0.9);
    this.shake = Math.max(this.shake, 0.12);
  }

  updateTargets(dt) {
    for (const tg of this.targets) {
      if (tg.alive) {
        tg.pop = Math.min(1, tg.pop + dt * 4);
        // Grow back in with a little overshoot, then idle sway.
        const k = tg.pop;
        const sc = k < 1 ? 1 + Math.sin(k * Math.PI) * 0.3 - (1 - k) * 0.9 : 1;
        tg.part.scale.setScalar(Math.max(0.01, sc));
        const sway = Math.sin(this.time * 2 + tg.phase);
        if (tg.type === 'bell') tg.part.rotation.x = sway * 0.12;
        else if (tg.type === 'flag') tg.part.rotation.y = sway * 0.15;
        else tg.part.position.y = 1.62 + Math.abs(sway) * 0.04;
      } else {
        // Quick pop: puff up, then vanish until respawn.
        tg.pop += dt * 6;
        tg.part.scale.setScalar(tg.pop < 1 ? 1 + tg.pop * 0.4 : 0.001);
        tg.part.visible = tg.pop < 1;
        tg.respawn -= dt;
        if (tg.respawn <= 0) {
          tg.alive = true;
          tg.pop = 0;
          tg.part.visible = true;
          this.game.audio.play('boing');
          this.puffs.burst(new THREE.Vector3(tg.hx, tg.hy, tg.hz), TEAM_COLORS[tg.team], { count: 8, size: 0.3, life: 0.45 });
        }
      }
    }
  }

  // ---------- per-frame movement ----------

  updateEnt(e, dt) {
    const playing = this.state === 'play';
    let ix = 0, iz = 0, scoop = false;
    e.throwCd -= dt; e.buildCd -= dt;
    if (playing) {
      if (e.bot) {
        ({ ix, iz, scoop } = this.botBrain(e, dt));
      } else {
        const d = this.input(e.p) || { x: 0, y: 0, b: false, aPressed: false };
        ix = d.x; iz = -d.y;
        const il = Math.hypot(ix, iz);
        if (il > 0.2) {
          const k = Math.min(1, dt * 16);
          e.dirX += (ix / il - e.dirX) * k; e.dirZ += (iz / il - e.dirZ) * k;
          const l = Math.hypot(e.dirX, e.dirZ) || 1;
          e.dirX /= l; e.dirZ /= l;
        }
        // B: a short tap throws on release; holding it scoops snow.
        if (d.b) e.bHold += dt;
        else if (e.bWas) {
          // A long press that scooped nothing (hands already full) still throws.
          if (e.bHold <= TAP_TIME || !e.gained) {
            if (e.snow >= 1) this.throwBall(e, this.aimFor(e));
            else if (e.throwCd <= 0) { this.floater(t('snowball.need'), new THREE.Vector3(e.x, 2.3, e.z), e.css, 1.0); e.throwCd = 0.6; }
          }
          e.bHold = 0;
          e.gained = false;
        }
        e.bWas = !!d.b;
        scoop = d.b && e.bHold > TAP_TIME;
        if (d.aPressed) this.tryBuild(e);
      }
      // Snow: scooping fills up (fast on the big pile); otherwise a slow trickle up to 2.
      e.scooping = scoop && e.snow < MAX_SNOW;
      if (e.scooping) {
        const pile = this.piles[e.team];
        const onPile = Math.hypot(e.x - pile.x, e.z - pile.z) < PILE_R;
        const before = Math.floor(e.snow);
        e.snow = Math.min(MAX_SNOW, e.snow + dt * (onPile ? 3 : 1.4));
        e.gained = true;
        e.scoopT -= dt;
        if (e.scoopT <= 0) {
          e.scoopT = 0.18;
          this.puffs.burst(new THREE.Vector3(e.x + e.dirX * 0.5, 0.15, e.z + e.dirZ * 0.5), 0xffffff, { count: 2, size: 0.25, life: 0.35, speed: 1.2 });
        }
        if (Math.floor(e.snow) > before) { e.ch.squash(0.85); if (!e.bot) this.game.audio.play('select'); }
        ix = iz = 0; // stand still while scooping
      } else if (e.snow < 2) {
        e.refill += dt;
        if (e.refill > 3) { e.refill = 0; e.snow = Math.min(2, Math.floor(e.snow) + 1); }
      }
    }

    const il = Math.hypot(ix, iz);
    if (il > 1) { ix /= il; iz /= il; }
    const sp = e.bot ? BOT_SPEED : SPEED;
    const k = Math.min(1, dt * 12);
    e.vx += (ix * sp - e.vx) * k;
    e.vz += (iz * sp - e.vz) * k;
    e.x += e.vx * dt;
    e.z += e.vz * dt;
    this.keepInHalf(e);

    e.ch.face(e.dirX, e.dirZ);
    const speed = Math.hypot(e.vx, e.vz);
    if (e.bot) {
      e.ch.group.rotation.y = Math.atan2(e.dirX, e.dirZ);
      e.ch.critter.position.y = speed > 0.5 ? Math.abs(Math.sin(this.time * 12)) * 0.15 : 0;
      e.ch.critter.scale.y = 1.3 * (e.scooping ? 0.85 + Math.sin(this.time * 18) * 0.05 : 1);
    }
    e.ch.group.position.set(e.x, 0, e.z);
    e.ch.update(dt, { moving: Math.min(1, speed / SPEED), grounded: true, vy: 0 });
    if (e.scooping && !e.bot) e.ch.pivot.rotation.x = 0.35; else if (!e.bot) e.ch.pivot.rotation.x *= 0.8;
    e.hand.visible = e.snow >= 1;
    e.ring.position.set(e.x, 0.03, e.z);
  }

  /** Arena bounds, the middle ridge, targets and walls. */
  keepInHalf(e) {
    const s = sideOf(e.team);
    e.x = s * clamp(s * e.x, 0.75, HX - 0.55);
    e.z = clamp(e.z, -HZ + 0.55, HZ - 0.55);
    for (const tg of this.targets) {
      const dx = e.x - tg.x, dz = e.z - tg.z, d = Math.hypot(dx, dz), min = PR + 0.45;
      if (d < min && d > 1e-5) { e.x = tg.x + (dx / d) * min; e.z = tg.z + (dz / d) * min; }
    }
    for (const w of this.walls) this.pushOutOfWall(e, PR, w);
    e.x = s * clamp(s * e.x, 0.75, HX - 0.55);
    e.z = clamp(e.z, -HZ + 0.55, HZ - 0.55);
  }

  separate() {
    for (let i = 0; i < this.ents.length; i++) {
      for (let j = i + 1; j < this.ents.length; j++) {
        const a = this.ents[i], c = this.ents[j];
        if (a.team !== c.team) continue;
        const dx = c.x - a.x, dz = c.z - a.z, d = Math.hypot(dx, dz);
        if (d < PR * 2 && d > 1e-4) {
          const push = (PR * 2 - d) / 2;
          a.x -= (dx / d) * push; a.z -= (dz / d) * push;
          c.x += (dx / d) * push; c.z += (dz / d) * push;
        }
      }
    }
  }

  /** Helper bot: scoop at the pile, lob at a random enemy target, now and then wall up a target. */
  botBrain(e, dt) {
    const s = sideOf(e.team);
    const out = { ix: 0, iz: 0, scoop: false };
    let gx = e.x, gz = e.z, face = null;
    e.think -= dt;
    e.buildTimer -= dt;
    if (e.mode === 'scoop') {
      const pile = this.piles[e.team];
      gx = pile.x - s * 0.9; gz = pile.z + (e.slot ? 0.9 : -0.9);
      if (Math.hypot(gx - e.x, gz - e.z) < 0.5) {
        out.scoop = true;
        gx = e.x; gz = e.z;
        if (e.snow >= e.wantSnow) e.mode = 'throw';
      }
    } else if (e.mode === 'build') {
      const tg = e.buildTarget;
      gx = tg.x - s * 1.15; gz = tg.z;
      if (e.snow < WALL_COST) e.mode = 'throw';
      else if (Math.hypot(gx - e.x, gz - e.z) < 0.3) {
        e.dirX = -s; e.dirZ = 0;
        this.tryBuild(e);
        e.mode = 'throw';
      }
    } else {
      if (e.snow < 1) {
        e.mode = 'scoop';
        e.wantSnow = 3 + Math.floor(Math.random() * 4);
      }
      if (!e.aimT || !e.aimT.alive || e.think <= 0) {
        const live = this.targets.filter((tg) => tg.team !== e.team && tg.alive);
        e.aimT = live[Math.floor(Math.random() * live.length)] || null;
        e.think = 4 + Math.random() * 4;
        e.station = { x: s * (1.6 + Math.random() * 3.6), z: clamp((e.aimT ? e.aimT.z * 0.5 : 0) + (Math.random() - 0.5) * 4, -HZ + 1, HZ - 1) };
      }
      gx = e.station.x; gz = e.station.z;
      if (e.aimT) {
        face = e.aimT;
        if (e.throwCd <= 0 && e.snow >= 1 && Math.hypot(gx - e.x, gz - e.z) < 3) {
          const dx = e.aimT.hx - e.x, dz = e.aimT.hz - e.z, d = Math.hypot(dx, dz) || 1;
          e.dirX = dx / d; e.dirZ = dz / d;
          this.throwBall(e, { x: e.aimT.hx, y: e.aimT.hy, z: e.aimT.hz });
          e.throwCd = 1.6 + Math.random() * 1.4;
        }
      }
      // Sometimes shield one of our own targets that has no wall yet.
      if (e.buildTimer <= 0) {
        e.buildTimer = 14 + Math.random() * 12;
        const mine = this.walls.filter((w) => w.team === e.team).length;
        const open = this.targets.filter((tg) => tg.team === e.team && !this.walls.some((w) => w.team === e.team && Math.hypot(w.x - tg.x, w.z - tg.z) < 3));
        if (e.snow >= WALL_COST && mine < 4 && open.length) {
          e.buildTarget = open[Math.floor(Math.random() * open.length)];
          e.mode = 'build';
        }
      }
    }
    const dx = gx - e.x, dz = gz - e.z, d = Math.hypot(dx, dz);
    if (d > 0.15) {
      out.ix = dx / Math.max(d, 0.6); out.iz = dz / Math.max(d, 0.6);
      if (!face) { e.dirX = dx / d; e.dirZ = dz / d; }
    }
    if (face && d < 1) {
      const fx = face.hx - e.x, fz = face.hz - e.z, fl = Math.hypot(fx, fz) || 1;
      e.dirX = fx / fl; e.dirZ = fz / fl;
    }
    return out;
  }

  // ---------- HUD bits ----------

  floater(text, pos, css, life) {
    const el = this.game.ui.label('label');
    el.textContent = text;
    el.style.color = css;
    this.floaters.push({ el, pos, life, max: life });
  }

  updateFloaters(dt) {
    for (const f of this.floaters) {
      f.life -= dt;
      f.pos.y += dt * 1.2;
      this.game.ui.place(f.el, f.pos, this.camera);
      f.el.style.opacity = String(clamp(f.life / f.max * 2, 0, 1));
      if (f.life <= 0) f.el.remove();
    }
    this.floaters = this.floaters.filter((f) => f.life > 0);
  }

  /** Snow pips above each player, plus the aim arc and ring. */
  updateAimAndLabels() {
    const show = this.state === 'play';
    for (const e of this.ents) {
      if (e.bot) continue;
      const n = Math.floor(e.snow);
      const html = show ? `<span style="color:${e.css}">${'●'.repeat(n)}</span><span style="color:#b9c6dd">${'●'.repeat(MAX_SNOW - n)}</span>` : '';
      if (html !== e.labelHtml) { e.label.innerHTML = html; e.labelHtml = html; }
      if (show) this.game.ui.place(e.label, new THREE.Vector3(e.x, 2.05, e.z), this.camera);
      else e.label.style.display = 'none';

      const aimOn = show && n >= 1;
      e.reticle.visible = aimOn;
      for (const dot of e.dots) dot.visible = aimOn;
      if (!aimOn) continue;
      const aim = this.aimFor(e);
      const L = this.lob(e, aim.x, aim.y, aim.z);
      e.dots.forEach((dot, i) => {
        const f = (i + 1) / (e.dots.length + 1) * 0.9;
        const tt = L.T * f;
        dot.position.set(L.sx + L.vx * tt, L.sy + L.vy * tt - 0.5 * G * tt * tt, L.sz + L.vz * tt);
      });
      if (aim.target) e.reticle.position.set(aim.target.x, 0.05, aim.target.z);
      else e.reticle.position.set(aim.x, 0.05, aim.z);
      e.reticle.scale.setScalar(aim.target ? 1.25 + Math.sin(this.time * 8) * 0.08 : 0.8);
    }
  }

  /** Story campaign: the players' team score against the helper bots. */
  campaignStats() {
    return { team: this.score[0], bots: this.score[1] };
  }

  end() {
    if (this.state === 'results') return;
    for (const e of this.ents) {
      if (e.label) e.label.style.display = 'none';
      if (e.reticle) e.reticle.visible = false;
      for (const dot of e.dots || []) dot.visible = false;
    }
    const [a, b] = this.score;
    const winner = a === b ? -1 : a > b ? 0 : 1;
    const ranked = this.ents.filter((e) => !e.bot).sort((x, y) => (y.team === winner) - (x.team === winner) || y.hits - x.hits || y.walls - x.walls);
    this.finish({
      title: winner < 0 ? t('ball.draw') : t('ball.winTitle', { team: t(`ball.team.${winner}`) }),
      subtitle: `${t('ball.team.0')} ${t('ball.sub', { a, b })} ${t('ball.team.1')}`,
      rows: ranked.map((e) => ({
        css: e.css, name: e.name, value: e.hits === 1 ? t('snowball.hit1') : t('snowball.hits', { n: e.hits }),
        detail: `${t(`ball.team.${e.team}`)} · ${e.walls === 1 ? t('snowball.wall1') : t('snowball.walls', { n: e.walls })} · ${e.throws === 1 ? t('snowball.throw1') : t('snowball.throws', { n: e.throws })}`,
        crown: e.team === winner,
      })),
      stars: 2,
    });
  }

  update(dt) {
    const pos = this.snow.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      let y = pos.getY(i) - dt * 1.1;
      if (y < -1) y += 20;
      pos.setY(i, y);
      pos.setX(i, pos.getX(i) + Math.sin(this.time + i) * dt * 0.3);
    }
    pos.needsUpdate = true;
    this.updateTargets(dt);

    if (this.state === 'teams') {
      this.picker?.update();
      for (const e of this.ents) { e.ch.update(dt, {}); e.ring.position.set(e.x, 0.03, e.z); }
      return;
    }
    for (const e of this.ents) this.updateEnt(e, dt);
    this.separate();
    for (const e of this.ents) e.ch.group.position.set(e.x, 0, e.z);
    this.updateBalls(dt);

    // Walls rise when built, wobble when hit, and slowly melt away.
    for (const w of [...this.walls]) {
      w.grow = Math.min(1, w.grow + dt * 4);
      w.wobble = Math.max(0, w.wobble - dt);
      w.group.scale.y = Math.max(0.01, w.grow < 1 ? w.grow * (1 + Math.sin(w.grow * Math.PI) * 0.2) : 1);
      w.group.position.x = w.x + Math.sin(w.wobble * 50) * w.wobble * 0.15;
      if (this.state === 'play') {
        w.decay -= dt;
        if (w.decay <= 0) {
          w.decay = WALL_DECAY;
          w.hp--;
          if (w.hp <= 0) this.crumble(w); else this.refreshWall(w);
        }
      }
    }
    this.updateFloaters(dt);
    this.updateAimAndLabels();

    this.camera.position.copy(this.camBase);
    if (this.shake > 0) {
      this.shake -= dt;
      this.camera.position.x += (Math.random() - 0.5) * this.shake;
      this.camera.position.y += (Math.random() - 0.5) * this.shake;
    }
    this.camera.lookAt(this.camera.position.x, 0, 1);

    if (this.updateResults(dt)) return;
    if (this.state === 'play') {
      this.timeLeft -= dt;
      if (this.timeLeft <= 0) {
        this.timeLeft = 0;
        this.end();
        return;
      }
    }
    if (this.state !== 'intro') {
      const secs = Math.max(0, Math.ceil(this.timeLeft));
      const clock = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
      this.game.ui.setTop(`<div class="pill ball-score"><span style="color:${TEAM_CSS[0]}">${t('ball.team.0')}</span><span class="big-num">${this.score[0]} - ${this.score[1]}</span><span style="color:${TEAM_CSS[1]}">${t('ball.team.1')}</span></div><div class="pill"><b>${clock}</b></div>`);
    }
    this.game.ui.bar(this.players, (p) => {
      const e = this.ents.find((x) => x.p === p);
      return e ? `<span style="color:${TEAM_CSS[e.team]}">●</span> ${e.hits}` : '';
    });
  }
}
