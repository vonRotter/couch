import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { MiniGame } from '../core/minigame.js';
import { Character } from '../core/character.js';
import { makeGrumble } from '../core/critters.js';
import { COLORS, toon, basic, sharedGeo } from '../core/palette.js';
import { addLights, skyTexture, makeCloud, seeded } from '../core/world.js';
import { t } from '../core/i18n.js';
import { TeamPicker, TEAM_COLORS, TEAM_CSS, helpersNeeded } from '../core/teams.js';
import { VotePicker, voteLength } from '../core/vote.js';
import './snowball/strings.js';
import { HX, HZ, STEP, MAPS, MAP_KEYS, Terrain, COVER_HP, COVER_REGROW } from './snowball/maps.js';
import { BALL_R, ballGeo, roundedRect, makePine, makeFort, makePile, makeTarget, makeCtfFlag, powerIcon } from './snowball/props.js';
import { botBrain } from './snowball/bots.js';

// Snowball Fort: two teams throw snowballs on a snowy map. Three modes (voted before the match):
//   Snow Targets      (simplest) stay in your half and pop the other team's targets.
//   King of the Hill  stand in the ring to score; snowballs push you out.
//   Capture the Flag  carry their flag to yours; a snowball makes the carrier drop it.
// Three maps (voted): Fort Meadow, Frosty Creek, Glacier Peaks (see snowball/maps.js).
// A snowball hit on a player is never a knock-out: you slip for a moment, drop a snowball and drop
// the flag if you carry it. Gifts (power-ups) appear at contested spots; [C] uses them.

const MODES = ['targets', 'koth', 'ctf'];
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
const HAND_Y = 1.2;
const AIM_CONE = THREE.MathUtils.degToRad(40);
const AIM_RANGE = 10.5; // auto-aim reach for players; +3 from high ground
const THROW_RANGE = 13; // landing distance when nothing is in the aim cone
const TARGET_RESPAWN = 5;
const TARGET_R = 0.62;
const WL = 1.1, WT = 0.28; // snow wall half length and half thickness
const ROW_H = 0.5;
const WALL_HP = 6;
const WALL_DECAY = 14;
const WALL_SPRAY = 0.6;
const MAX_WALLS = 6;
const PILE_R = 1.7;
const TARGET_Z = [-5.2, -2.6, 0, 2.6, 5.2];
const TARGET_TYPES = ['flag', 'snowman', 'bell', 'snowman', 'flag'];
const GOLD_EVERY = 18, GOLD_TIME = 9;
// Player hits
const SLIP_TIME = 0.75;
const IMMUNE_AFTER = 1.4;
const KNOCK = 3.5, KNOCK_HILL = 6.5;
// Capture the Flag
const CAP_LIMIT = 3;
const FLAG_RETURN = 12;
const FLAG_GRAB_R = 0.9;
const HOME_R = 1.3;
// King of the Hill
const ZONE_HOP = 30, ZONE_WARN = 5;
// Gifts
const POWERS = ['giant', 'triple', 'boots', 'fort', 'freeze'];
const POWER_FIRST = 8, POWER_RESPAWN = 14;
const TRIPLE_TIME = 8, BOOTS_TIME = 7;
const GIANT_R = 0.42, GIANT_SPLASH = 1.5;
const FREEZE_R = 2.0, FREEZE_TIME = 14;
// Where the King of the Hill ring sits on each map (circle or rectangle).
const ZONES = {
  meadow: [{ x: 0, z: 0, r: 2.0 }],
  creek: [{ x0: -1.5, x1: 1.5, z0: -5.7, z1: -3.7 }, { x0: -1.5, x1: 1.5, z0: 3.7, z1: 5.7 }],
  peaks: [{ x: 0, z: 0, r: 1.45 }, { x: 0, z: 6.0, r: 1.6 }, { x: 0, z: -6.0, r: 1.6 }],
};

const clamp = THREE.MathUtils.clamp;
const sideOf = (team) => (team ? 1 : -1); // team 0 plays on the left, team 1 on the right

/** World point -> wall-local coordinates (lx along the wall, lz through it). */
function toWall(w, x, z) {
  const dx = x - w.x, dz = z - w.z;
  return { lx: dx * w.cos - dz * w.sin, lz: dx * w.sin + dz * w.cos };
}

export class SnowballScene extends MiniGame {
  constructor(game, opts = {}) {
    super(game, opts);
    this.camera.fov = 40;
    this.scene.background = skyTexture('#a6d6ff', '#f4fbff');
    addLights(this.scene, { size: 26, dir: new THREE.Vector3(-0.3, 1, 0.45) });

    this.score = [0, 0];
    this.matchTime = MATCH_TIME;
    this.timeLeft = MATCH_TIME;
    this.targets = [];
    this.walls = [];
    this.balls = [];
    this.floaters = [];
    this.piles = [];
    this.flags = [];
    this.spots = [];
    this.freezes = [];
    this.shake = 0;
    this.coop = !!opts.coop;
    // Our own (not shared) materials for see-through and color-changing things.
    const grad = toon(0xffffff).gradientMap;
    this.mats = {
      tunnel: new THREE.MeshToonMaterial({ color: 0xbfe6ff, gradientMap: grad, transparent: true, opacity: 0.42, side: THREE.DoubleSide, depthWrite: false }),
      bubble: new THREE.MeshToonMaterial({ color: 0xdff3ff, gradientMap: grad, transparent: true, opacity: 0.35, depthWrite: false }),
      freeze: new THREE.MeshToonMaterial({ color: 0xbfe8ff, gradientMap: grad, transparent: true, opacity: 0.85 }),
    };
    this.buildBase();

    this.ents = this.players.map((p, i) => this.makeEnt(p, i % 2));
    this.frame();
    game.audio.playMusic('party');
    this.state = 'teams';

    // Story campaign (opts.coop): Snow Targets on Fort Meadow, everyone on one team vs grumble bots.
    this.mode = this.coop ? 'targets' : MODES.includes(opts.mode) ? opts.mode : null;
    this.mapKey = this.coop ? (MAPS[opts.map] ? opts.map : 'meadow') : MAPS[opts.map] ? opts.map : null;
    const title = () => t('game.snowball');
    const teams = () => {
      this.picker = new TeamPicker(this, {
        title, ents: this.ents,
        setTeam: (e, team) => this.setTeam(e, team),
        onChange: () => this.placeEnts(),
        onDone: () => { this.picker = null; this.startMatch(); },
      });
    };
    const coop = () => {
      for (const e of this.ents) this.setTeam(e, 0);
      this.startMatch();
    };
    const afterVotes = () => { this.setup(); (this.coop ? coop : teams)(); };
    const pickMap = () => this.vote(this.mapKey, 'snowball.voteMap', 'meadow',
      MAP_KEYS.map((k) => ({ value: k, label: () => t(`snowball.map.${k}`) })),
      (v) => { this.mapKey = v; voteLength(this, opts, title, afterVotes); });
    // Modes are listed simplest first; stars hint at how much there is to learn.
    this.vote(this.mode, 'snowball.voteMode', 'targets',
      MODES.map((m, i) => ({ value: m, label: () => `${t(`snowball.mode.${m}`)} ${'★'.repeat(i + 1)}` })),
      (v) => { this.mode = v; pickMap(); });
    this.placeEnts();
  }

  /** One pre-game vote, skipped when the value is already known (retry, story). */
  vote(known, question, def, options, next) {
    if (known) { next(known); return; }
    this.picker = new VotePicker(this, {
      title: () => t('game.snowball'),
      vote: { question: () => t(question), def, options },
      onDone: (v) => { this.picker = null; next(v); },
    });
  }

  retryOptions() {
    return { key: this.key, length: this.matchTime, mode: this.mode, map: this.mapKey };
  }

  onLanguage() {
    this.picker?.render();
  }

  /** Helper bots even out the teams, then the intro card. */
  startMatch() {
    helpersNeeded(this.ents).forEach((need, team) => {
      for (let i = 0; i < need; i++) this.ents.push(this.makeEnt(null, team, i));
    });
    // Capture the Flag roles: the first bot of a team attacks, the second defends.
    for (const e of this.ents) if (e.bot) e.role = e.slot === 0 ? 'att' : 'def';
    this.placeEnts();
    this.intro(t(`snowball.mode.${this.mode}`), t(`snowball.goal.${this.mode}`));
  }

  /** Like MiniGame.intro, but the card stays up a little longer so the goal line can be read. */
  async intro(title, sub) {
    this.state = 'intro';
    await this.game.ui.banner(title, sub, 3600);
    if (this.game.current !== this) return;
    await this.game.ui.countdown(this.game.audio);
    if (this.game.current !== this) return;
    this.state = 'play';
    this.playStart = this.time;
    this.onStart();
  }

  onStart() {
    // A few tips during the first minute and a half: they add depth as the match goes on.
    const tips = [];
    if (this.mode === 'ctf') tips.push('snowball.tip.ctf');
    if (this.mode === 'koth') tips.push('snowball.tip.koth');
    tips.push('snowball.tip.gift', MAPS[this.mapKey].tips[0], 'snowball.tip.dodge', 'snowball.tip.wall', MAPS[this.mapKey].tips[1]);
    tips.slice(0, 5).forEach((key, i) => this.later(9 + i * 24, () => {
      if (this.state === 'play') this.game.ui.toast(t(key), 4200);
    }));
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
    const hand = new THREE.Mesh(ballGeo(), toon(COLORS.white));
    hand.position.set(0.48, 0.62, 0.22);
    hand.castShadow = true;
    ch.group.add(hand);

    const ring = new THREE.Mesh(sharedGeo('teamRing', () => new THREE.RingGeometry(0.55, 0.78, 24)), toon(TEAM_COLORS[team]));
    ring.rotation.x = -Math.PI / 2;
    this.scene.add(ring);

    const e = {
      p, bot: !p, ch, ring, hand, team, slot,
      x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, dirX: -sideOf(team), dirZ: 0, spin: 0,
      snow: START_SNOW, bHold: 0, bWas: false, scooping: false, scoopT: 0, gained: false,
      throwCd: 0, buildCd: 0, refill: 0,
      slip: 0, immune: 0, slow: 0, triple: 0, boots: 0, power: null, powerHeld: 0, powerMesh: null,
      carry: null, pickCd: 0, msgT: 0,
      hits: 0, walls: 0, throws: 0, splats: 0, caps: 0, saves: 0, hill: 0,
      // bot brain
      role: 'att', task: 'move', goal: null, wp: null, wpT: 0, think: Math.random() * 0.3, wantSnow: 4,
      buildTimer: 8 + Math.random() * 10, station: null, stationT: 0, aimT: null, buildTarget: null,
      detour: 0, detX: 0, detZ: 0, stuckT: 1, lastX: 0, lastZ: 0,
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

  /** Spread each team over its own side, bots further back. */
  placeEnts() {
    const targets = this.mode === 'targets';
    for (const team of [0, 1]) {
      const s = sideOf(team);
      const humans = this.ents.filter((e) => e.team === team && !e.bot);
      humans.forEach((e, k) => {
        const n = humans.length;
        e.x = s * (targets ? 3.0 + (k % 2) * 2.4 : HX - 4.4 - (k % 2) * 1.6);
        e.z = n === 1 ? 0 : -4.5 + (k * 9) / (n - 1);
      });
      this.ents.filter((e) => e.team === team && e.bot).forEach((e) => {
        e.x = s * (targets ? 8.6 : 9.6);
        e.z = e.slot ? 3 : -3;
      });
      for (const e of this.ents.filter((m) => m.team === team)) {
        if (this.terrain) Object.assign(e, this.terrain.findFree(e.x, e.z, PR + 0.05));
        e.y = this.terrain ? this.terrain.groundY(e.x, e.z) : 0;
        e.vx = e.vz = e.vy = 0;
        e.dirX = -s; e.dirZ = 0;
        e.ch.face(e.dirX, 0);
        e.ch.yaw = e.ch.targetYaw ?? 0;
        if (e.bot) e.ch.group.rotation.y = Math.atan2(e.dirX, e.dirZ);
        e.ch.group.position.set(e.x, e.y, e.z);
        e.ring.position.set(e.x, e.y + 0.04, e.z);
        e.lastX = e.x; e.lastZ = e.z;
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

  snowTexture(mode) {
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
    if (mode === 'targets') {
      // Middle line nobody crosses, and fort lines in front of each row of targets.
      g.setLineDash([18, 14]);
      g.lineWidth = 7;
      g.strokeStyle = '#ff5d73';
      g.globalAlpha = 0.45;
      g.beginPath(); g.moveTo(512, 20); g.lineTo(512, 572); g.stroke();
      g.lineWidth = 6;
      for (const team of [0, 1]) {
        g.strokeStyle = TEAM_CSS[team];
        g.globalAlpha = 0.35;
        const x = (sideOf(team) * (HX - 3.3) + HX) / (HX * 2) * 1024;
        g.beginPath(); g.moveTo(x, 30); g.lineTo(x, 562); g.stroke();
      }
      g.globalAlpha = 1;
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  }

  /** Everything that does not depend on the votes: field, bank, scenery, forts, snowfall. */
  buildBase() {
    const s = this.scene;
    const rand = seeded(31);
    const geo = new THREE.ShapeGeometry(roundedRect(HX, HZ, 1.4), 8);
    const pos = geo.attributes.position, uv = geo.attributes.uv;
    for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + HX) / (HX * 2), (pos.getY(i) + HZ) / (HZ * 2));
    this.field = new THREE.Mesh(geo, new THREE.MeshToonMaterial({ map: this.snowTexture(null), gradientMap: toon(0xffffff).gradientMap }));
    this.field.rotation.x = -Math.PI / 2;
    this.field.receiveShadow = true;
    s.add(this.field);

    const shape = roundedRect(HX + 0.7, HZ + 0.7, 2.1);
    shape.holes.push(roundedRect(HX, HZ, 1.4));
    const bank = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.35, bevelEnabled: true, bevelThickness: 0.2, bevelSize: 0.2, bevelSegments: 3, curveSegments: 12 }), toon(0xeef6ff));
    bank.rotation.x = -Math.PI / 2;
    bank.castShadow = bank.receiveShadow = true;
    s.add(bank);

    for (const team of [0, 1]) {
      const fort = makeFort(TEAM_COLORS[team], HZ);
      fort.position.x = sideOf(team) * (HX + 0.35);
      s.add(fort);
    }

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
      const tree = makePine(rand, 1.1 + rand() * 0.8);
      tree.position.set((rand() - 0.5) * 70, 0, -HZ - 3 - rand() * 18);
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

  /** After the votes: the chosen map's features and the chosen mode's objects. */
  setup() {
    const T = this.terrain = new Terrain(this.mapKey);
    const def = MAPS[this.mapKey];
    this.field.material.map.dispose();
    this.field.material.map = this.snowTexture(this.mode);
    this.field.material.needsUpdate = true;
    this.mapGroup = new THREE.Group();
    this.scene.add(this.mapGroup);
    T.build(this.mapGroup, this.mats);

    for (const team of [0, 1]) {
      const s = sideOf(team);
      const pile = makePile(TEAM_COLORS[team]);
      const px = s * def.pile[0], pz = def.pile[1];
      pile.position.set(px, 0, pz);
      this.scene.add(pile);
      this.piles.push({ x: px, z: pz, group: pile });
    }

    if (this.mode === 'targets') {
      for (const team of [0, 1]) {
        TARGET_Z.forEach((z, i) => {
          const x = sideOf(team) * (HX - 1.3 - (i % 2) * 0.6);
          const tg = makeTarget(team, TEAM_COLORS[team], TARGET_TYPES[i], x, z);
          this.scene.add(tg.group);
          this.targets.push(tg);
        });
      }
      // Candy poles at both ends of the middle line.
      for (const z of [-HZ - 0.3, HZ + 0.3]) {
        const pole = new THREE.Mesh(sharedGeo('sbMidPole', () => new THREE.CylinderGeometry(0.1, 0.1, 1.8, 10)), toon(0xff5d73));
        pole.position.set(0, 0.9, z);
        const top = new THREE.Mesh(sharedGeo('sbMidTop', () => new THREE.SphereGeometry(0.2, 12, 8)), toon(COLORS.white));
        top.position.set(0, 1.9, z);
        pole.castShadow = true;
        this.scene.add(pole, top);
      }
      this.goldT = GOLD_EVERY * 0.7;
    } else if (this.mode === 'ctf') {
      this.buildFlags();
    } else {
      this.buildZone();
    }

    // Gift spots in contested places.
    def.power.forEach(([x, z], i) => {
      const y = T.groundY(x, z);
      const pad = new THREE.Mesh(sharedGeo('sbGiftPad', () => new THREE.RingGeometry(0.55, 0.75, 28)), toon(COLORS.gold));
      pad.rotation.x = -Math.PI / 2;
      pad.position.set(x, y + 0.035, z);
      this.scene.add(pad);
      const holder = new THREE.Group();
      holder.position.set(x, y, z);
      this.scene.add(holder);
      this.spots.push({ x, z, y, item: null, timer: POWER_FIRST + i * 4, last: null, holder });
    });
  }

  // ---------- capture the flag ----------

  buildFlags() {
    for (const team of [0, 1]) {
      const s = sideOf(team);
      const home = { x: s * (HX - 1.6), z: 0 };
      const pad = new THREE.Mesh(sharedGeo('sbHomePad', () => new THREE.RingGeometry(HOME_R - 0.22, HOME_R, 32)), toon(TEAM_COLORS[team]));
      pad.rotation.x = -Math.PI / 2;
      pad.position.set(home.x, 0.03, home.z);
      const fill = new THREE.Mesh(sharedGeo('sbHomeFill', () => new THREE.CircleGeometry(HOME_R - 0.22, 32)), basic(TEAM_COLORS[team], { transparent: true, opacity: 0.22 }));
      fill.rotation.x = -Math.PI / 2;
      fill.position.set(home.x, 0.025, home.z);
      this.scene.add(pad, fill);
      const group = makeCtfFlag(TEAM_COLORS[team], -s);
      this.scene.add(group);
      this.flags.push({ team, home, x: home.x, z: home.z, state: 'home', carrier: null, returnT: 0, group });
    }
  }

  placeFlag(f) {
    this.scene.add(f.group);
    f.group.scale.setScalar(1);
    f.group.rotation.set(0, 0, 0);
    f.group.position.set(f.x, this.terrain.groundY(f.x, f.z), f.z);
  }

  returnFlag(f) {
    if (f.carrier) f.carrier.carry = null;
    f.state = 'home';
    f.carrier = null;
    f.x = f.home.x; f.z = f.home.z;
    this.placeFlag(f);
    this.puffs.burst(new THREE.Vector3(f.x, 1, f.z), TEAM_COLORS[f.team], { count: 12, size: 0.35, life: 0.6 });
  }

  grabFlag(f, e) {
    f.state = 'carried';
    f.carrier = e;
    e.carry = f;
    e.immune = Math.max(e.immune, 0.8); // a moment to get going
    e.ch.group.add(f.group);
    f.group.position.set(0, 0.2, -0.38);
    f.group.scale.setScalar(0.62);
    f.group.rotation.set(-0.2, 0, 0);
    this.game.audio.play('coin');
    if (!e.bot) this.floater(t('snowball.grab'), new THREE.Vector3(e.x, e.y + 2.6, e.z), e.css, 1.3);
  }

  dropFlag(e) {
    const f = e.carry;
    if (!f) return;
    e.carry = null;
    e.pickCd = 1.5;
    f.state = 'dropped';
    f.carrier = null;
    f.x = e.x; f.z = e.z;
    f.returnT = FLAG_RETURN;
    this.placeFlag(f);
    this.game.audio.play('bump');
    this.floater(t('snowball.dropped'), new THREE.Vector3(e.x, e.y + 2.6, e.z), TEAM_CSS[f.team], 1.1);
  }

  updateFlags(dt) {
    for (const f of this.flags) {
      if (f.state === 'carried') {
        const e = f.carrier;
        f.group.userData.cloth.rotation.y = Math.sin(this.time * 9) * 0.2;
        // Kid-friendly rule: you can score even while your own flag is away (no stalemates).
        const mine = this.flags[e.team];
        if (Math.hypot(e.x - mine.home.x, e.z - mine.home.z) < HOME_R && !this.ending) this.capture(e, f);
        continue;
      }
      // Waving at home or lying in the snow, blinking before it flies back.
      f.group.userData.cloth.rotation.y = Math.sin(this.time * 2.5 + f.team) * 0.15;
      if (f.state === 'dropped') {
        f.returnT -= dt;
        f.group.rotation.z = 0.9 * sideOf(f.team);
        f.group.visible = f.returnT > 3 || Math.sin(this.time * 20) > -0.3;
        if (f.returnT <= 0) { f.group.visible = true; this.returnFlag(f); continue; }
      }
      if (this.state !== 'play') continue;
      const fy = this.terrain.groundY(f.x, f.z);
      for (const e of this.ents) {
        if (e.slip > 0 || e.pickCd > 0 || Math.hypot(e.x - f.x, e.z - f.z) > FLAG_GRAB_R || Math.abs(e.y - fy) > 0.8) continue;
        if (e.team !== f.team && !e.carry) { f.group.visible = true; this.grabFlag(f, e); break; }
        if (e.team === f.team && f.state === 'dropped') {
          e.saves++;
          f.group.visible = true;
          this.returnFlag(f);
          this.game.audio.play('rescue');
          this.floater(t('snowball.returned'), new THREE.Vector3(e.x, e.y + 2.6, e.z), e.css, 1.2);
          break;
        }
      }
    }
  }

  capture(e, f) {
    this.score[e.team]++;
    e.caps++;
    this.returnFlag(f);
    const home = this.flags[e.team].home;
    const at = new THREE.Vector3(home.x, 1.5, home.z);
    this.game.audio.play('star');
    this.confetti.burst(at, 0, { count: 60, speed: 8, up: 6, colors: [TEAM_COLORS[e.team], COLORS.white, COLORS.gold], life: 1.4, size: 0.18 });
    this.floater('+1', at.clone().setY(3), TEAM_CSS[e.team], 1.2);
    this.game.ui.toast(t('snowball.captured', { team: t(`ball.team.${e.team}`) }), 2200);
    this.shake = 0.2;
    if (this.score[e.team] >= CAP_LIMIT) {
      this.ending = true;
      this.later(1.4, () => this.end());
    }
  }

  // ---------- king of the hill ----------

  /** A ring (or rectangle) whose vertices follow the ground, so it lies nicely on hills. */
  drapedZone(spec, inner, outer, y0 = 0.05) {
    const T = this.terrain;
    const pos = [];
    const pt = (x, z) => [x, T.groundY(x, z) + y0, z];
    const quad = (a, b, c, d) => pos.push(...a, ...b, ...c, ...a, ...c, ...d);
    if (spec.r) {
      const seg = 48;
      const radii = inner > 0 ? [spec.r * inner, spec.r * outer] : [0, 0.25, 0.5, 0.75, 1].map((k) => k * spec.r * outer);
      for (let ri = 0; ri < radii.length - 1; ri++) {
        for (let i = 0; i < seg; i++) {
          const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
          const [r0, r1] = [radii[ri], radii[ri + 1]];
          quad(pt(spec.x + Math.cos(a0) * r0, spec.z - Math.sin(a0) * r0), pt(spec.x + Math.cos(a0) * r1, spec.z - Math.sin(a0) * r1),
            pt(spec.x + Math.cos(a1) * r1, spec.z - Math.sin(a1) * r1), pt(spec.x + Math.cos(a1) * r0, spec.z - Math.sin(a1) * r0));
        }
      }
    } else {
      const { x0, x1, z0, z1 } = spec;
      const w = 0.22;
      if (inner > 0) {
        quad(pt(x0, z1), pt(x1, z1), pt(x1, z1 - w), pt(x0, z1 - w));
        quad(pt(x0, z0 + w), pt(x1, z0 + w), pt(x1, z0), pt(x0, z0));
        quad(pt(x0, z1 - w), pt(x0 + w, z1 - w), pt(x0 + w, z0 + w), pt(x0, z0 + w));
        quad(pt(x1 - w, z1 - w), pt(x1, z1 - w), pt(x1, z0 + w), pt(x1 - w, z0 + w));
      } else {
        quad(pt(x0, z1), pt(x1, z1), pt(x1, z0), pt(x0, z0));
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.computeVertexNormals();
    return geo;
  }

  buildZone() {
    this.zoneSpecs = ZONES[this.mapKey].map((z) => ({
      ...z,
      x: z.r ? z.x : (z.x0 + z.x1) / 2,
      z: z.r ? z.z : (z.z0 + z.z1) / 2,
    }));
    this.zoneRing = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
    this.zoneFill = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.2, side: THREE.DoubleSide, depthWrite: false });
    this.zoneNext = new THREE.MeshBasicMaterial({ color: 0xff5d73, transparent: true, opacity: 0.8, side: THREE.DoubleSide });
    this.zoneCloth = new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: toon(0xffffff).gradientMap });
    this.zoneFlag = new THREE.Group();
    const pole = new THREE.Mesh(sharedGeo('sbZonePole', () => new THREE.CylinderGeometry(0.06, 0.06, 2.4, 8)), toon(COLORS.icing));
    pole.position.y = 1.2;
    const cloth = new THREE.Mesh(sharedGeo('sbZoneCloth', () => new THREE.ConeGeometry(0.35, 0.9, 3)), this.zoneCloth);
    cloth.rotation.z = Math.PI / 2;
    cloth.position.set(0.45, 2.1, 0);
    const knob = new THREE.Mesh(sharedGeo('sbKnob', () => new THREE.SphereGeometry(0.09, 10, 8)), toon(COLORS.gold));
    knob.position.y = 2.45;
    pole.castShadow = cloth.castShadow = true;
    this.zoneFlag.add(pole, cloth, knob);
    this.scene.add(this.zoneFlag);
    this.zoneMeshes = [];
    this.zoneOwner = -1;
    this.zoneAcc = 0;
    this.zoneHop = ZONE_HOP;
    this.setZone(0);
  }

  setZone(i) {
    this.zoneIndex = i;
    this.zone = this.zoneSpecs[i];
    for (const m of this.zoneMeshes) { this.scene.remove(m); m.geometry.dispose(); }
    const ring = new THREE.Mesh(this.drapedZone(this.zone, 0.9, 1), this.zoneRing);
    const fill = new THREE.Mesh(this.drapedZone(this.zone, 0, 0.9, 0.04), this.zoneFill);
    fill.renderOrder = 1;
    this.zoneMeshes = [ring, fill];
    this.scene.add(ring, fill);
    // The flag pole stands at the far edge of the ring, out of the way of gifts and players.
    const fz = this.zone.r ? this.zone.z - this.zone.r * 0.92 : this.zone.z0 + 0.1;
    this.zoneFlag.position.set(this.zone.x, this.terrain.groundY(this.zone.x, fz), fz);
    this.nextMesh = null;
  }

  inZone(e) {
    const z = this.zone;
    if (!z || this.terrain.inTunnel(e.x, e.z)) return false;
    if (z.r) return Math.hypot(e.x - z.x, e.z - z.z) < z.r;
    return e.x > z.x0 && e.x < z.x1 && e.z > z.z0 && e.z < z.z1;
  }

  updateZone(dt) {
    const blink = Math.sin(this.time * 10) > 0;
    const counts = [0, 0];
    if (this.state === 'play') for (const e of this.ents) if (this.inZone(e)) counts[e.team]++;
    const owner = counts[0] && counts[1] ? 2 : counts[0] ? 0 : counts[1] ? 1 : -1;
    if (owner !== this.zoneOwner) { this.zoneOwner = owner; this.zoneAcc = 0; }
    const FREE = 0x9b5de5; // grape purple: a free hill stands out on white snow
    const col = owner === 2 ? (blink ? 0xff5d73 : 0xffffff) : owner >= 0 ? TEAM_COLORS[owner] : FREE;
    this.zoneRing.color.setHex(col);
    this.zoneFill.color.setHex(owner >= 0 && owner < 2 ? TEAM_COLORS[owner] : FREE);
    this.zoneCloth.color.setHex(owner >= 0 && owner < 2 ? TEAM_COLORS[owner] : FREE);
    this.zoneFlag.children[1].rotation.x = Math.sin(this.time * 5) * 0.2;
    if (this.state !== 'play') return;
    if (owner === 0 || owner === 1) {
      this.zoneAcc += dt;
      for (const e of this.ents) if (e.team === owner && this.inZone(e)) e.hill += dt;
      while (this.zoneAcc >= 1) {
        this.zoneAcc -= 1;
        this.score[owner]++;
        this.game.audio.play('coin');
        this.floater('+1', new THREE.Vector3(this.zone.x, this.terrain.groundY(this.zone.x, this.zone.z) + 2.8, this.zone.z), TEAM_CSS[owner], 0.8);
      }
    }
    // On maps with several hills the ring moves now and then, with a warning first.
    if (this.zoneSpecs.length > 1) {
      this.zoneHop -= dt;
      const next = (this.zoneIndex + 1) % this.zoneSpecs.length;
      if (this.zoneHop <= ZONE_WARN && !this.nextMesh) {
        this.nextMesh = new THREE.Mesh(this.drapedZone(this.zoneSpecs[next], 0.9, 1), this.zoneNext);
        this.scene.add(this.nextMesh);
        this.zoneMeshes.push(this.nextMesh);
        this.game.ui.toast(t('snowball.hillMoves'), 2200);
        this.game.audio.play('whoosh');
      }
      if (this.nextMesh) this.nextMesh.visible = blink;
      if (this.zoneHop <= 0) {
        this.zoneHop = ZONE_HOP;
        this.setZone(next);
        this.game.audio.play('boing');
      }
    }
  }

  // ---------- gifts (power-ups) ----------

  updateSpots(dt) {
    for (const sp of this.spots) {
      if (sp.item) {
        sp.item.rotation.y += dt * 1.6;
        sp.item.position.y = 0.95 + Math.sin(this.time * 3) * 0.12;
        if (this.state !== 'play') continue;
        // Pick up: walk into it with empty hands.
        for (const e of this.ents) {
          if (e.power || e.slip > 0) continue;
          if (Math.hypot(e.x - sp.x, e.z - sp.z) > 1.0 || Math.abs(e.y - sp.y) > 0.6) continue;
          this.givePower(e, sp.type);
          sp.holder.remove(sp.item);
          sp.item = null;
          sp.timer = POWER_RESPAWN;
          break;
        }
      } else if (this.state === 'play') {
        sp.timer -= dt;
        if (sp.timer <= 0) {
          const pool = POWERS.filter((p) => p !== sp.last);
          sp.type = pool[Math.floor(Math.random() * pool.length)];
          sp.last = sp.type;
          const g = new THREE.Group();
          const bubble = new THREE.Mesh(sharedGeo('sbBubble', () => new THREE.SphereGeometry(0.5, 18, 12)), this.mats.bubble);
          bubble.renderOrder = 3;
          g.add(powerIcon(sp.type), bubble);
          sp.item = g;
          sp.holder.add(g);
          this.game.audio.play('bubble');
          this.puffs.burst(new THREE.Vector3(sp.x, sp.y + 1, sp.z), COLORS.gold, { count: 10, size: 0.3, life: 0.5 });
        }
      }
    }
  }

  givePower(e, type) {
    e.power = type;
    e.powerHeld = 0;
    e.powerMesh = powerIcon(type);
    e.powerMesh.scale.setScalar(0.6);
    e.powerMesh.position.set(0, 1.85, 0);
    e.ch.group.add(e.powerMesh);
    this.game.audio.play('star');
    if (!e.bot) this.floater(t('snowball.pwGot', { x: t(`snowball.pw.${type}`) }), new THREE.Vector3(e.x, e.y + 2.7, e.z), e.css, 1.8);
  }

  usePower(e) {
    const type = e.power;
    if (!type) return;
    if ((type === 'giant' || type === 'freeze') && this.terrain.inTunnel(e.x, e.z)) {
      this.say(e, 'snowball.noRoom');
      return;
    }
    if (type === 'fort' && !this.fortSpots(e).length) {
      this.say(e, 'snowball.notHere'); // keep the gift for a better spot
      return;
    }
    e.power = null;
    if (e.powerMesh) { e.ch.group.remove(e.powerMesh); e.powerMesh = null; }
    if (type === 'giant' || type === 'freeze') this.throwBall(e, this.aimFor(e), type);
    else if (type === 'triple') e.triple = TRIPLE_TIME;
    else if (type === 'boots') { e.boots = BOOTS_TIME; this.game.audio.play('dash'); }
    else if (type === 'fort') this.instantFort(e);
    this.game.audio.play('whoosh');
  }

  /** Where the three walls of an instant fort go (a U in front of you), minus blocked ones. */
  fortSpots(e) {
    const a = Math.atan2(e.dirX, e.dirZ);
    const px = -e.dirZ, pz = e.dirX;
    return [
      [e.x + e.dirX * 1.3, e.z + e.dirZ * 1.3, a],
      [e.x + e.dirX * 0.3 + px * 1.35, e.z + e.dirZ * 0.3 + pz * 1.35, a + Math.PI / 2],
      [e.x + e.dirX * 0.3 - px * 1.35, e.z + e.dirZ * 0.3 - pz * 1.35, a + Math.PI / 2],
    ].filter(([x, z, ang]) => this.wallSpotOk(e.team, x, z, ang));
  }

  /** Three free walls in a U in front of you. */
  instantFort(e) {
    for (const [x, z, ang] of this.fortSpots(e)) this.makeWall(e.team, x, z, ang, e);
    e.ch.squash(0.7);
    this.game.audio.play('land');
    this.puffs.burst(new THREE.Vector3(e.x, 0.5, e.z), 0xffffff, { count: 18, size: 0.45, life: 0.6, speed: 3 });
  }

  addFreeze(x, z) {
    const spec = { x, z, r: FREEZE_R };
    const mesh = new THREE.Mesh(this.drapedZone(spec, 0, 1, 0.03), this.mats.freeze);
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    this.freezes.push({ x, z, r: FREEZE_R, t: FREEZE_TIME, mesh });
  }

  updateFreezes(dt) {
    for (const f of this.freezes) {
      f.t -= dt;
      if (f.t < 1) f.mesh.visible = Math.sin(this.time * 18) > 0;
      if (f.t <= 0) { this.scene.remove(f.mesh); f.mesh.geometry.dispose(); }
    }
    this.freezes = this.freezes.filter((f) => f.t > 0);
  }

  onIce(e) {
    if (e.y < 0.1 && this.terrain.isIce(e.x, e.z)) return true;
    return this.freezes.some((f) => Math.hypot(e.x - f.x, e.z - f.z) < f.r);
  }

  // ---------- targets (Snow Targets mode) ----------

  hitTarget(tg, b) {
    const pts = tg.gold > 0 ? 3 : 1;
    tg.alive = false;
    tg.respawn = TARGET_RESPAWN;
    tg.pop = 0;
    tg.gold = 0;
    tg.coin.visible = false;
    this.score[b.team] += pts;
    b.owner.hits += pts;
    const at = new THREE.Vector3(tg.hx, tg.hy, tg.hz);
    this.game.audio.play(pts > 1 ? 'star' : 'pop');
    this.confetti.burst(at, 0, { count: pts > 1 ? 50 : 26, speed: 6, up: 4, colors: [TEAM_COLORS[b.team], COLORS.white, COLORS.gold], life: 1.1, size: 0.16 });
    this.puffs.burst(at, 0xffffff, { count: 10, size: 0.4, life: 0.5, speed: 3 });
    this.floater(`+${pts}`, at.clone().setY(tg.hy + 0.7), TEAM_CSS[b.team], 0.9);
    this.shake = Math.max(this.shake, 0.12);
  }

  updateTargets(dt) {
    for (const tg of this.targets) {
      if (tg.alive) {
        tg.pop = Math.min(1, tg.pop + dt * 4);
        const k = tg.pop;
        const sc = k < 1 ? 1 + Math.sin(k * Math.PI) * 0.3 - (1 - k) * 0.9 : 1;
        tg.part.scale.setScalar(Math.max(0.01, sc));
        const sway = Math.sin(this.time * 2 + tg.phase);
        if (tg.type === 'bell') tg.part.rotation.x = sway * 0.12;
        else if (tg.type === 'flag') tg.part.rotation.y = sway * 0.15;
        else tg.part.position.y = 1.62 + Math.abs(sway) * 0.04;
        if (tg.gold > 0) {
          tg.gold -= dt;
          tg.coin.rotation.z += dt * 4;
          tg.coin.visible = tg.gold > 2 || Math.sin(this.time * 16) > 0;
          if (tg.gold <= 0) tg.coin.visible = false;
        }
      } else {
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
    // Now and then one target per team turns gold and is worth 3.
    if (this.state === 'play' && this.mode === 'targets') {
      this.goldT -= dt;
      if (this.goldT <= 0) {
        this.goldT = GOLD_EVERY;
        for (const team of [0, 1]) {
          const pool = this.targets.filter((tg) => tg.team === team && tg.alive && tg.gold <= 0);
          const tg = pool[Math.floor(Math.random() * pool.length)];
          if (tg) { tg.gold = GOLD_TIME; tg.coin.visible = true; }
        }
        this.game.audio.play('coin');
        this.game.ui.toast(t('snowball.gold'), 1600);
      }
    }
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
    const pennant = new THREE.Group();
    const stick = new THREE.Mesh(sharedGeo('sbPennantStick', () => new THREE.CylinderGeometry(0.03, 0.03, 0.6, 5)), toon(COLORS.ink));
    stick.position.y = 0.3;
    const flag = new THREE.Mesh(sharedGeo('sbPennant', () => new THREE.ConeGeometry(0.14, 0.4, 3)), toon(TEAM_COLORS[team]));
    flag.rotation.z = Math.PI / 2;
    flag.position.set(0.2, 0.5, 0);
    pennant.add(stick, flag);
    pennant.position.x = 0.8;
    g.add(pennant);

    const y = this.terrain.groundY(x, z);
    g.position.set(x, y, z);
    g.rotation.y = angle;
    g.scale.y = 0.01;
    this.scene.add(g);
    const w = { team, x, z, y, cos: Math.cos(angle), sin: Math.sin(angle), group: g, rows, pennant, hp: WALL_HP, grow: 0, decay: WALL_DECAY, wobble: 0, owner };
    this.walls.push(w);
    const mine = this.walls.filter((m) => m.team === team);
    if (mine.length > MAX_WALLS) this.crumble(mine[0]);
    this.refreshWall(w);
    return w;
  }

  refreshWall(w) {
    const rows = Math.ceil(w.hp / 2);
    w.rows.forEach((r, i) => { r.visible = i < rows; });
    w.pennant.position.y = rows * ROW_H;
    w.h = rows * ROW_H;
  }

  crumble(w) {
    this.puffs.burst(new THREE.Vector3(w.x, w.y + 0.5, w.z), 0xffffff, { count: 14, size: 0.45, life: 0.6, speed: 3 });
    this.scene.remove(w.group);
    this.walls = this.walls.filter((m) => m !== w);
  }

  hitWall(w, b, dmg = 1) {
    w.hp -= dmg;
    w.wobble = 0.25;
    this.game.audio.play('splat');
    this.puffs.burst(new THREE.Vector3(b.x, b.y, b.z), 0xffffff, { count: 8, size: 0.32, life: 0.45, speed: 2.5 });
    if (w.hp <= 0) this.crumble(w);
    else this.refreshWall(w);
  }

  /** Is this a fair place for a wall? Not in solid stuff, not in tunnels, not on a flag home. */
  wallSpotOk(team, x, z, angle) {
    const T = this.terrain;
    const ex = Math.cos(angle) * WL, ez = -Math.sin(angle) * WL;
    for (const [px, pz] of [[x, z], [x + ex, z + ez], [x - ex, z - ez]]) {
      if (Math.abs(px) > HX - 0.3 || Math.abs(pz) > HZ - 0.3) return false;
      if (T.solidAt(px, pz, 0.15) || T.inTunnel(px, pz)) return false;
    }
    if (Math.abs(T.groundY(x + ex, z + ez) - T.groundY(x - ex, z - ez)) > 0.5) return false;
    if (this.mode === 'targets' && x * sideOf(team) < 0.9) return false;
    for (const f of this.flags) if (Math.hypot(x - f.home.x, z - f.home.z) < 2.2) return false;
    return true;
  }

  tryBuild(e) {
    if (e.buildCd > 0) return false;
    e.buildCd = 0.5;
    if (e.carry) { this.say(e, 'snowball.carrying'); return false; }
    if (e.snow < WALL_COST) { this.say(e, 'snowball.need'); return false; }
    const s = sideOf(e.team);
    let x = e.x + e.dirX * 1.1;
    const z = clamp(e.z + e.dirZ * 1.1, -HZ + 0.6, HZ - 0.6);
    if (this.mode === 'targets') x = s * clamp(s * x, 0.9, HX - 0.7);
    const angle = Math.atan2(e.dirX, e.dirZ);
    if (!this.wallSpotOk(e.team, x, z, angle)) { this.say(e, 'snowball.notHere'); return false; }
    this.makeWall(e.team, x, z, angle, e);
    e.snow -= WALL_COST;
    e.walls++;
    e.ch.squash(0.75);
    this.game.audio.play('land');
    this.puffs.burst(new THREE.Vector3(x, e.y + 0.3, z), 0xffffff, { count: 10, size: 0.4, life: 0.5 });
    return true;
  }

  /** A short message above a human player's head (bots just shrug). */
  say(e, key) {
    if (e.bot || e.msgT > 0) return;
    e.msgT = 0.9;
    this.floater(t(key), new THREE.Vector3(e.x, e.y + 2.4, e.z), e.css, 1.0);
    this.game.audio.play('bump');
  }

  pushOutOfWall(o, r, w) {
    if (Math.abs(o.y - w.y) > 1.2) return;
    const { lx, lz } = toWall(w, o.x, o.z);
    if (Math.abs(lx) > WL + r || Math.abs(lz) > WT + r) return;
    const qx = clamp(lx, -WL, WL), qz = clamp(lz, -WT, WT);
    let dx = lx - qx, dz = lz - qz;
    const d = Math.hypot(dx, dz);
    if (d > 1e-5) {
      if (d >= r) return;
      const nx = dx / d, nz = dz / d;
      dx = nx * (r - d); dz = nz * (r - d);
    } else if (WL - Math.abs(lx) < WT - Math.abs(lz)) {
      dx = Math.sign(lx || 1) * (WL - Math.abs(lx) + r); dz = 0;
    } else {
      dx = 0; dz = Math.sign(lz || 1) * (WT - Math.abs(lz) + r);
    }
    o.x += dx * w.cos + dz * w.sin;
    o.z += -dx * w.sin + dz * w.cos;
  }

  // ---------- breakable ice blocks ----------

  damageCover(c, dmg, at) {
    c.hp -= dmg;
    c.wobble = 0.25;
    this.game.audio.play('splat');
    this.puffs.burst(at, 0xcfeeff, { count: 8, size: 0.3, life: 0.45, speed: 2.5 });
    if (c.hp <= 0) {
      c.alive = false;
      c.regrow = COVER_REGROW;
      c.mesh.visible = false;
      this.game.audio.play('pop');
      this.confetti.burst(new THREE.Vector3(c.x, 0.7, c.z), 0, { count: 18, speed: 4, up: 3, colors: [0xbfe6ff, 0xffffff], life: 0.8, size: 0.16 });
      this.terrain.buildNav();
    }
  }

  updateCovers(dt) {
    for (const c of this.terrain.covers) {
      if (c.alive) {
        const k = 0.45 + 0.55 * (c.hp / COVER_HP);
        c.k += (k - c.k) * Math.min(1, dt * 10);
        c.wobble = Math.max(0, c.wobble - dt);
        c.mesh.scale.set(1 + c.wobble * 0.4, c.k, 1 + c.wobble * 0.4);
      } else {
        c.regrow -= dt;
        // Grows back only when nobody stands in the way.
        if (c.regrow <= 0 && !this.ents.some((e) => Math.hypot(e.x - c.x, e.z - c.z) < 1.2)) {
          c.alive = true;
          c.hp = COVER_HP;
          c.k = 0.1;
          c.mesh.visible = true;
          this.game.audio.play('boing');
          this.terrain.buildNav();
        }
      }
    }
  }

  // ---------- throwing ----------

  /** Auto-aim: the enemy (player or target) closest to where you face, or a spot on the ground ahead. */
  aimFor(e) {
    const range = AIM_RANGE + (e.y > 0.5 ? 3 : 0);
    let best = null, bestAng = AIM_CONE;
    const consider = (x, y, z, d, ent, target) => {
      if (d < 0.6) return;
      const ang = Math.acos(clamp(((x - e.x) * e.dirX + (z - e.z) * e.dirZ) / d, -1, 1)) + d * 0.004;
      if (ang < bestAng) { bestAng = ang; best = { x, y, z, ent, target }; }
    };
    for (const o of this.ents) {
      if (o.team === e.team || o.immune > 0 || this.terrain.inTunnel(o.x, o.z)) continue;
      const d = Math.hypot(o.x - e.x, o.z - e.z);
      if (d < range) consider(o.x, o.y + 0.7, o.z, d, o, null);
    }
    for (const tg of this.targets) {
      if (tg.team === e.team || !tg.alive) continue;
      consider(tg.hx, tg.hy, tg.hz, Math.hypot(tg.hx - e.x, tg.hz - e.z), null, tg);
    }
    if (best) return best;
    const x = clamp(e.x + e.dirX * THROW_RANGE, -HX, HX), z = clamp(e.z + e.dirZ * THROW_RANGE, -HZ, HZ);
    return { x, y: this.terrain.groundY(x, z), z };
  }

  /** Start point and launch velocity of a lob that lands on (x, y, z). */
  lob(e, x, y, z) {
    const sx = e.x + e.dirX * 0.4, sz = e.z + e.dirZ * 0.4, sy = e.y + HAND_Y;
    const d = Math.hypot(x - sx, z - sz);
    const T = 0.35 + d / 32;
    return { sx, sy, sz, T, vx: (x - sx) / T, vy: (y - sy) / T + (G * T) / 2, vz: (z - sz) / T };
  }

  /** kind: 'normal' (costs 1 snow), 'giant' or 'freeze' (from a gift). */
  throwBall(e, aim, kind = 'normal') {
    if (kind === 'normal') {
      if (e.snow < 1 || e.throwCd > 0) return false;
      if (this.terrain.inTunnel(e.x, e.z)) { this.say(e, 'snowball.noRoom'); e.throwCd = 0.5; return false; }
    }
    const d = Math.hypot(aim.x - e.x, aim.z - e.z);
    const spread = (e.bot ? 0.5 + d * 0.04 : 0.12 + d * 0.022) * (kind === 'normal' ? 1 : 0.5);
    // Triple throw: two extra balls fanned out to the sides.
    const angles = kind === 'normal' && e.triple > 0 ? [0, 0.28, -0.28] : [0];
    for (const off of angles) {
      const c = Math.cos(off), s = Math.sin(off);
      const rx = aim.x - e.x, rz = aim.z - e.z;
      const ax = e.x + rx * c - rz * s, az = e.z + rx * s + rz * c;
      const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * spread;
      const ay = off ? this.terrain.groundY(ax, az) + 0.6 : aim.y;
      const L = this.lob(e, ax + Math.cos(a) * r, ay + (Math.random() - 0.5) * spread * 0.6, az + Math.sin(a) * r);
      const radius = kind === 'giant' ? GIANT_R : BALL_R;
      const mesh = new THREE.Mesh(ballGeo(), toon(kind === 'freeze' ? 0x7fd6ff : COLORS.white));
      mesh.scale.setScalar(radius / BALL_R);
      mesh.castShadow = true;
      const shadow = new THREE.Mesh(sharedGeo('sbShadow', () => new THREE.CircleGeometry(0.2, 12)), basic(0x5a6c99, { transparent: true, opacity: 0.25 }));
      shadow.rotation.x = -Math.PI / 2;
      this.scene.add(mesh, shadow);
      this.balls.push({ mesh, shadow, x: L.sx, y: L.sy, z: L.sz, vx: L.vx, vy: L.vy, vz: L.vz, team: e.team, owner: e, life: 4, kind, r: radius });
    }
    if (kind === 'normal') e.snow--;
    e.throws++;
    e.throwCd = THROW_CD;
    e.ch.squash(1.2);
    this.game.audio.play(kind === 'normal' ? 'dash' : 'whoosh');
    return true;
  }

  updateBalls(dt) {
    const steps = 3, h = dt / steps;
    const T = this.terrain;
    for (const b of this.balls) {
      for (let i = 0; i < steps && !b.dead; i++) {
        b.vy -= G * h;
        b.x += b.vx * h; b.y += b.vy * h; b.z += b.vz * h;
        b.life -= h;
        // Enemy snow walls stop it (your own team's walls let your snowballs through).
        for (const w of this.walls) {
          if (w.team === b.team || b.y > w.y + w.h + WALL_SPRAY || b.y < w.y - 0.2) continue;
          const { lx, lz } = toWall(w, b.x, b.z);
          if (Math.abs(lx) < WL + b.r && Math.abs(lz) < WT + b.r) { this.impact(b, { wall: w }); break; }
        }
        if (b.dead) break;
        for (const o of this.ents) {
          if (o.team === b.team || o.immune > 0) continue;
          if (Math.hypot(b.x - o.x, b.z - o.z) < PR + b.r && b.y > o.y - 0.1 && b.y < o.y + 1.35 + b.r && !T.inTunnel(o.x, o.z)) {
            this.impact(b, { ent: o });
            break;
          }
        }
        if (b.dead) break;
        for (const tg of this.targets) {
          if (tg.team === b.team || !tg.alive) continue;
          if (Math.hypot(b.x - tg.hx, b.y - tg.hy, b.z - tg.hz) < TARGET_R + b.r - BALL_R) { this.impact(b, { target: tg }); break; }
        }
        if (b.dead) break;
        const hit = T.ballHit(b.x, b.y, b.z, b.r);
        if (hit) this.impact(b, hit);
        else if (b.life <= 0 || Math.abs(b.x) > HX + 4 || Math.abs(b.z) > HZ + 4) b.dead = true;
      }
      b.mesh.position.set(b.x, b.y, b.z);
      const gy = T.groundY(b.x, b.z);
      b.shadow.position.set(b.x, gy + 0.03, b.z);
      b.shadow.scale.setScalar(clamp(1.2 - (b.y - gy) * 0.12, 0.5, 1.2) * (b.r / BALL_R));
    }
    if (this.balls.some((b) => b.dead)) {
      for (const b of this.balls) if (b.dead) this.scene.remove(b.mesh, b.shadow);
      this.balls = this.balls.filter((b) => !b.dead);
    }
  }

  /** A snowball meets something. Giant balls splash, freeze bombs leave an ice patch. */
  impact(b, hit) {
    b.dead = true;
    const at = new THREE.Vector3(b.x, b.y, b.z);
    if (b.kind === 'giant') {
      this.game.audio.play('splat');
      this.shake = Math.max(this.shake, 0.25);
      this.puffs.burst(at, 0xffffff, { count: 24, size: 0.6, life: 0.7, speed: 4 });
      for (const o of this.ents) {
        if (o.team !== b.team && Math.hypot(o.x - b.x, o.z - b.z) < GIANT_SPLASH && Math.abs(o.y + 0.6 - b.y) < 1.6) this.hitPlayer(o, b);
      }
      for (const w of [...this.walls]) if (w.team !== b.team && Math.hypot(w.x - b.x, w.z - b.z) < GIANT_SPLASH + 0.6) this.hitWall(w, b, 4);
      for (const c of this.terrain.covers) if (c.alive && Math.hypot(c.x - b.x, c.z - b.z) < GIANT_SPLASH + 0.4) this.damageCover(c, 3, at);
      for (const tg of this.targets) if (tg.team !== b.team && tg.alive && Math.hypot(tg.hx - b.x, tg.hz - b.z) < 1.3) this.hitTarget(tg, b);
      return;
    }
    if (b.kind === 'freeze') {
      const gx = clamp(b.x, -HX + 1, HX - 1), gz = clamp(b.z, -HZ + 1, HZ - 1);
      this.addFreeze(gx, gz);
      this.game.audio.play('pop');
      this.puffs.burst(at, 0x9fdcff, { count: 20, size: 0.5, life: 0.6, speed: 3 });
      for (const o of this.ents) if (o.team !== b.team && Math.hypot(o.x - gx, o.z - gz) < FREEZE_R) this.hitPlayer(o, b);
      return;
    }
    if (hit.ent) this.hitPlayer(hit.ent, b);
    else if (hit.target) this.hitTarget(hit.target, b);
    else if (hit.wall) this.hitWall(hit.wall, b);
    else if (hit.kind === 'cover') this.damageCover(hit.cover, 1, at);
    else this.puffs.burst(at, 0xffffff, { count: 6, size: 0.28, life: 0.4, speed: 1.8 });
  }

  /** Splat! You slip for a moment, lose a snowball and drop the flag. Never a knock-out. */
  hitPlayer(o, b) {
    if (o.immune > 0) return;
    const big = b.kind !== 'normal';
    const l = Math.hypot(b.vx, b.vz) || 1;
    const kn = (this.mode === 'koth' ? KNOCK_HILL : KNOCK) * (big ? 1.3 : 1) * (o.boots > 0 ? 0.5 : 1);
    o.vx = (b.vx / l) * kn;
    o.vz = (b.vz / l) * kn;
    o.slip = o.boots > 0 ? 0.35 : SLIP_TIME * (big ? 1.4 : 1);
    o.immune = o.slip + IMMUNE_AFTER;
    if (this.mode === 'koth') o.slow = 1.6;
    o.snow = Math.max(0, o.snow - 1);
    o.scooping = false;
    if (o.carry) this.dropFlag(o);
    b.owner.splats++;
    this.game.audio.play('splat');
    this.game.audio.play('dizzy');
    this.puffs.burst(new THREE.Vector3(o.x, o.y + 0.9, o.z), 0xffffff, { count: 12, size: 0.38, life: 0.5, speed: 3 });
    this.floater(t('snowball.splat'), new THREE.Vector3(o.x, o.y + 2.2, o.z), TEAM_CSS[b.team], 0.9);
  }

  // ---------- per-frame movement ----------

  updateEnt(e, dt) {
    const playing = this.state === 'play';
    let ix = 0, iz = 0, scoop = false;
    for (const k of ['throwCd', 'buildCd', 'immune', 'slip', 'slow', 'triple', 'boots', 'pickCd', 'msgT']) e[k] -= dt;
    if (playing && e.slip <= 0) {
      if (e.bot) {
        ({ ix, iz, scoop } = botBrain(this, e, dt));
      } else {
        const d = this.input(e.p) || { x: 0, y: 0, b: false, aPressed: false, cPressed: false };
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
          if (e.bHold <= TAP_TIME || !e.gained) {
            if (e.snow >= 1) this.throwBall(e, this.aimFor(e));
            else if (e.throwCd <= 0) { this.say(e, 'snowball.need'); e.throwCd = 0.6; }
          }
          e.bHold = 0;
          e.gained = false;
        }
        e.bWas = !!d.b;
        scoop = d.b && e.bHold > TAP_TIME;
        if (d.aPressed) this.tryBuild(e);
        if (d.cPressed && e.power) this.usePower(e);
      }
      // Snow: scooping fills up (fast on your team's big pile); otherwise a slow trickle up to 2.
      e.scooping = scoop && e.snow < MAX_SNOW && !e.carry;
      if (e.scooping) {
        const pile = this.piles[e.team];
        const onPile = Math.hypot(e.x - pile.x, e.z - pile.z) < PILE_R;
        const before = Math.floor(e.snow);
        e.snow = Math.min(MAX_SNOW, e.snow + dt * (onPile ? 3 : 1.4));
        e.gained = true;
        e.scoopT -= dt;
        if (e.scoopT <= 0) {
          e.scoopT = 0.18;
          this.puffs.burst(new THREE.Vector3(e.x + e.dirX * 0.5, e.y + 0.15, e.z + e.dirZ * 0.5), 0xffffff, { count: 2, size: 0.25, life: 0.35, speed: 1.2 });
        }
        if (Math.floor(e.snow) > before) { e.ch.squash(0.85); if (!e.bot) this.game.audio.play('select'); }
        ix = iz = 0;
      } else if (e.snow < 2) {
        e.refill += dt;
        if (e.refill > 3) { e.refill = 0; e.snow = Math.min(2, Math.floor(e.snow) + 1); }
      }
    } else if (!playing) {
      e.scooping = false;
    }

    // Speed: boots are fast, carrying a flag or being snowy (King of the Hill) is a bit slower.
    const il = Math.hypot(ix, iz);
    if (il > 1) { ix /= il; iz /= il; }
    const ice = e.boots <= 0 && this.terrain && this.onIce(e);
    let sp = (e.bot ? BOT_SPEED : SPEED) * (e.boots > 0 ? 1.5 : 1) * (e.carry ? 0.88 : 1) * (e.slow > 0 ? 0.65 : 1);
    if (ice) sp *= 1.15;
    // Slipping (after a hit) and ice both make you slide.
    const k = e.slip > 0 ? Math.min(1, dt * 1.8) : ice ? Math.min(1, dt * 2.2) : Math.min(1, dt * 12);
    e.vx += (ix * sp - e.vx) * k;
    e.vz += (iz * sp - e.vz) * k;
    if (this.terrain) this.moveEnt(e, dt);
    else { e.x += e.vx * dt; e.z += e.vz * dt; }

    // Spin while slipping, then settle back facing forward.
    if (e.slip > 0) e.spin += dt * 15;
    else {
      const target = Math.round(e.spin / (Math.PI * 2)) * Math.PI * 2;
      e.spin += (target - e.spin) * Math.min(1, dt * 10);
    }
    e.ch.face(e.dirX, e.dirZ);
    const speed = Math.hypot(e.vx, e.vz);
    if (e.bot) {
      e.ch.group.rotation.y = Math.atan2(e.dirX, e.dirZ) + e.spin;
      e.ch.critter.position.y = speed > 0.5 ? Math.abs(Math.sin(this.time * 12)) * 0.15 : 0;
      e.ch.critter.scale.y = 1.3 * (e.scooping ? 0.85 + Math.sin(this.time * 18) * 0.05 : 1);
    } else {
      e.ch.spin = e.spin;
    }
    e.ch.group.position.set(e.x, e.y, e.z);
    e.ch.update(dt, { moving: Math.min(1, speed / SPEED), grounded: true, vy: 0 });
    if (e.scooping && !e.bot) e.ch.pivot.rotation.x = 0.35; else if (!e.bot) e.ch.pivot.rotation.x *= 0.8;
    e.hand.visible = e.snow >= 1;
    // Blink softly while you can't be hit.
    e.ch.group.visible = !(e.immune > 0 && e.slip <= 0) || Math.sin(this.time * 30) > -0.4;
    if (e.powerMesh) e.powerMesh.rotation.y += dt * 2;
    e.ring.position.set(e.x, e.y + 0.04, e.z);
  }

  /** Is this spot off limits for e? Solid features, water, or a step too high. */
  blocked(e, x, z) {
    const T = this.terrain;
    if (T.solidAt(x, z, PR, false)) return true;
    return T.maxGround(x, z, PR * 0.7) - e.y > STEP;
  }

  /** Move with collisions: per axis against walls and cliffs, smooth push around round things. */
  moveEnt(e, dt) {
    const T = this.terrain;
    const px = e.x, pz = e.z;
    const nx = e.x + e.vx * dt;
    if (!this.blocked(e, nx, e.z)) e.x = nx; else e.vx *= e.slip > 0 ? -0.4 : 0;
    const nz = e.z + e.vz * dt;
    if (!this.blocked(e, e.x, nz)) e.z = nz; else e.vz *= e.slip > 0 ? -0.4 : 0;
    T.pushOutCircles(e, PR);
    if (this.mode === 'targets') {
      for (const tg of this.targets) {
        const dx = e.x - tg.x, dz = e.z - tg.z, d = Math.hypot(dx, dz), min = PR + 0.45;
        if (d < min && d > 1e-5) { e.x = tg.x + (dx / d) * min; e.z = tg.z + (dz / d) * min; }
      }
    }
    for (const w of this.walls) this.pushOutOfWall(e, PR, w);
    this.keepInBounds(e);
    if (this.blocked(e, e.x, e.z) && !this.blocked(e, px, pz)) { e.x = px; e.z = pz; }
    // Height: walk up ramps and hills, hop down off edges.
    const g = T.groundY(e.x, e.z);
    if (g >= e.y - 0.08) { e.y = g; e.vy = 0; }
    else {
      e.vy -= 22 * dt;
      e.y = Math.max(g, e.y + e.vy * dt);
      if (e.y === g) { e.vy = 0; e.ch.squash(0.8); }
    }
  }

  keepInBounds(e) {
    if (this.mode === 'targets') {
      const s = sideOf(e.team);
      e.x = s * clamp(s * e.x, 0.75, HX - 0.55);
    } else {
      e.x = clamp(e.x, -HX + 0.55, HX - 0.55);
    }
    e.z = clamp(e.z, -HZ + 0.55, HZ - 0.55);
  }

  /** Beans bump into each other (also across teams, except in Snow Targets where halves are separate). */
  separate() {
    for (let i = 0; i < this.ents.length; i++) {
      for (let j = i + 1; j < this.ents.length; j++) {
        const a = this.ents[i], c = this.ents[j];
        if (a.team !== c.team && this.mode === 'targets') continue;
        if (Math.abs(a.y - c.y) > 0.8) continue;
        const dx = c.x - a.x, dz = c.z - a.z, d = Math.hypot(dx, dz);
        if (d < PR * 2 && d > 1e-4) {
          const push = (PR * 2 - d) / 2;
          a.x -= (dx / d) * push; a.z -= (dz / d) * push;
          c.x += (dx / d) * push; c.z += (dz / d) * push;
        }
      }
    }
    if (this.terrain) {
      for (const e of this.ents) {
        this.keepInBounds(e);
        if (this.blocked(e, e.x, e.z)) {
          const p = this.terrain.findFree(e.x, e.z, PR);
          if (Math.abs(this.terrain.groundY(p.x, p.z) - e.y) < STEP) { e.x = p.x; e.z = p.z; }
        }
      }
    }
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
      f.el.style.opacity = String(clamp((f.life / f.max) * 2, 0, 1));
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
      if (show) this.game.ui.place(e.label, new THREE.Vector3(e.x, e.y + (e.powerMesh ? 2.45 : 2.05), e.z), this.camera);
      else e.label.style.display = 'none';

      const aimOn = show && (n >= 1 || e.power === 'giant' || e.power === 'freeze') && e.slip <= 0 && !this.terrain.inTunnel(e.x, e.z);
      e.reticle.visible = aimOn;
      for (const dot of e.dots) dot.visible = aimOn;
      if (!aimOn) continue;
      const aim = this.aimFor(e);
      const L = this.lob(e, aim.x, aim.y, aim.z);
      e.dots.forEach((dot, i) => {
        const f = ((i + 1) / (e.dots.length + 1)) * 0.9;
        const tt = L.T * f;
        dot.position.set(L.sx + L.vx * tt, L.sy + L.vy * tt - 0.5 * G * tt * tt, L.sz + L.vz * tt);
      });
      const locked = aim.target || aim.ent;
      const rx = aim.target ? aim.target.x : aim.ent ? aim.ent.x : aim.x;
      const rz = aim.target ? aim.target.z : aim.ent ? aim.ent.z : aim.z;
      e.reticle.position.set(rx, this.terrain.groundY(rx, rz) + 0.06, rz);
      e.reticle.scale.setScalar(locked ? 1.25 + Math.sin(this.time * 8) * 0.08 : 0.8);
    }
  }

  /** Story campaign: the players' team score against the helper bots. */
  campaignStats() {
    return { team: this.score[0], bots: this.score[1] };
  }

  /** The number each player is ranked by in the current mode, and its text. */
  stat(e) {
    if (this.mode === 'ctf') return { n: e.caps, text: e.caps === 1 ? t('snowball.cap1') : t('snowball.caps', { n: e.caps }) };
    if (this.mode === 'koth') return { n: Math.floor(e.hill), text: t('snowball.hillSecs', { n: Math.floor(e.hill) }) };
    return { n: e.hits, text: e.hits === 1 ? t('snowball.hit1') : t('snowball.hits', { n: e.hits }) };
  }

  end() {
    if (this.state === 'results') return;
    for (const e of this.ents) {
      if (e.label) e.label.style.display = 'none';
      if (e.reticle) e.reticle.visible = false;
      for (const dot of e.dots || []) dot.visible = false;
      e.ch.group.visible = true;
    }
    const [a, b] = this.score;
    const winner = a === b ? -1 : a > b ? 0 : 1;
    const ranked = this.ents.filter((e) => !e.bot).sort((x, y) => (y.team === winner) - (x.team === winner) || this.stat(y).n - this.stat(x).n || y.splats - x.splats);
    const extra = (e) => {
      if (this.mode === 'ctf' && e.saves) return e.saves === 1 ? t('snowball.save1') : t('snowball.saves', { n: e.saves });
      return e.walls === 1 ? t('snowball.wall1') : t('snowball.walls', { n: e.walls });
    };
    this.finish({
      title: winner < 0 ? t('ball.draw') : t('ball.winTitle', { team: t(`ball.team.${winner}`) }),
      subtitle: `${t(`snowball.mode.${this.mode}`)} · ${t('ball.team.0')} ${t('ball.sub', { a, b })} ${t('ball.team.1')}`,
      rows: ranked.map((e) => ({
        css: e.css, name: e.name, value: this.stat(e).text,
        detail: `${t(`ball.team.${e.team}`)} · ${e.splats === 1 ? t('snowball.splat1') : t('snowball.splats', { n: e.splats })} · ${extra(e)}`,
        crown: e.team === winner,
      })),
      stars: 2,
    });
  }

  hud() {
    const secs = Math.max(0, Math.ceil(this.timeLeft));
    const clock = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
    let html = `<div class="pill ball-score"><span style="color:${TEAM_CSS[0]}">${t('ball.team.0')}</span><span class="big-num">${this.score[0]} - ${this.score[1]}</span><span style="color:${TEAM_CSS[1]}">${t('ball.team.1')}</span></div><div class="pill"><b>${clock}</b></div>`;
    if (this.mode === 'ctf') html += `<div class="pill">${t('snowball.firstTo', { n: CAP_LIMIT })}</div>`;
    if (this.mode === 'koth') {
      const o = this.zoneOwner;
      const who = o === 2 ? `<b style="color:#ff5d73">${t('snowball.hillContest')}</b>` : o >= 0 ? `<b style="color:${TEAM_CSS[o]}">${t(`ball.team.${o}`)}</b>` : t('snowball.hillFree');
      html += `<div class="pill">${t('snowball.hill')}: ${who}</div>`;
    }
    // The controls stay up during the intro and the first 25 seconds.
    if (this.state === 'intro' || (this.state === 'play' && this.time - this.playStart < 25)) {
      html += `<div class="pill" style="font-size:clamp(12px,1.2vw,19px)">${t(`snowball.map.${this.mapKey}`)} · ${t('snowball.controls')}</div>`;
    }
    return html;
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
      this.picker?.update(dt);
      for (const e of this.ents) { e.ch.update(dt, {}); e.ring.position.set(e.x, e.y + 0.04, e.z); }
      return;
    }
    for (const e of this.ents) this.updateEnt(e, dt);
    this.separate();
    for (const e of this.ents) e.ch.group.position.set(e.x, e.y, e.z);
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
    this.updateCovers(dt);
    this.updateFreezes(dt);
    this.updateSpots(dt);
    if (this.mode === 'ctf') this.updateFlags(dt);
    if (this.mode === 'koth') this.updateZone(dt);
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
    if (this.state === 'play' && !this.ending) {
      this.timeLeft -= dt;
      if (this.timeLeft <= 0) {
        this.timeLeft = 0;
        this.end();
        return;
      }
    }
    this.game.ui.setTop(this.hud());
    this.game.ui.bar(this.players, (p) => {
      const e = this.ents.find((x) => x.p === p);
      if (!e) return '';
      const gift = e.power ? ` · ${t(`snowball.pw.${e.power}`)}` : '';
      return `<span style="color:${TEAM_CSS[e.team]}">●</span> ${this.stat(e).n}${e.carry ? ' ⚑' : ''}${gift}`;
    });
  }
}
