import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { MiniGame } from '../core/minigame.js';
import { t, addStrings } from '../core/i18n.js';
import { esc } from '../core/ui.js';
import { Character } from '../core/character.js';
import { makeGrumble } from '../core/critters.js';
import { COLORS, toon, sharedGeo, faceted } from '../core/palette.js';
import { addLights, skyTexture, makeTree, makeFlower, makeRock, makeStar, seeded } from '../core/world.js';

// Garden Hide & Seek: prop-hunt on one shared screen.
// Each round one player seeks. First the seeker looks away from the screen (honor system) while
// everyone else runs off and turns into a garden prop. Then the seeker checks props with a
// magnifying glass: decoys just go "boing", hidden players pop out and go cheer behind the fence.

addStrings({
  en: {
    'game.hideseek': 'Garden Hide & Seek',
    'hideseek.intro': 'Hide as a garden prop, or find the friends who did!',
    'hideseek.round': 'Round {n} of {total}',
    'hideseek.seekerIs': '{name} is the seeker',
    'hideseek.lookAway': '{name}, look away!',
    'hideseek.lookSub': 'No peeking at the screen! Everyone else: hide!',
    'hideseek.hideHelp': 'A: copy a prop next to you · B: change prop · then stand still!',
    'hideseek.soloHide': 'The grumbles are hiding...',
    'hideseek.soloSub': 'Close your eyes and count!',
    'hideseek.ready': 'Ready or not, here I come!',
    'hideseek.seekHelp': 'Walk up to a prop and press A to check it',
    'hideseek.boing': 'boing!',
    'hideseek.found': 'Found {name}!',
    'hideseek.giggle': 'Hee hee! Something giggled...',
    'hideseek.allFound': 'Everyone found!',
    'hideseek.timeUp': 'Time is up!',
    'hideseek.safe': 'Safe!',
    'hideseek.seeker': 'Seeker',
    'hideseek.counting': 'counting... {n}',
    'hideseek.hiding': '{n} hiding',
    'hideseek.grumble': 'Grumble',
    'hideseek.foundN': 'found {n}',
    'hideseek.hidS': 'hid {s} s',
    'hideseek.pts': '{n} points',
    'hideseek.roundDone': 'Round {n} done!',
    'hideseek.roundSub': '{name} found {n} of {total}',
    'hideseek.next': 'press jump for the next round',
    'hideseek.final': 'press jump for the final results',
    'hideseek.solo': 'Super seeking!',
    'hideseek.finalSub': '{n} rounds in the garden',
    'hideseek.statSeek': 'found {n}',
    'hideseek.statHide': 'hid {s} s',
    'hideseek.place.1': '1st', 'hideseek.place.2': '2nd', 'hideseek.place.3': '3rd',
    'hideseek.place.4': '4th', 'hideseek.place.5': '5th', 'hideseek.place.6': '6th',
    'hideseek.prop.gnome': 'gnome', 'hideseek.prop.pumpkin': 'pumpkin', 'hideseek.prop.bush': 'bush',
    'hideseek.prop.pot': 'flower pot', 'hideseek.prop.can': 'watering can',
  },
  no: {
    'game.hideseek': 'Gjemsel i hagen',
    'hideseek.intro': 'Gjem deg som en ting i hagen, eller finn vennene som gjorde det!',
    'hideseek.round': 'Runde {n} av {total}',
    'hideseek.seekerIs': '{name} skal lete',
    'hideseek.lookAway': '{name}, se bort!',
    'hideseek.lookSub': 'Ingen titting på skjermen! Alle andre: gjem dere!',
    'hideseek.hideHelp': 'A: bli lik en ting ved siden av deg · B: bytt ting · stå så helt stille!',
    'hideseek.soloHide': 'Grumlingene gjemmer seg ...',
    'hideseek.soloSub': 'Lukk øynene og tell!',
    'hideseek.ready': 'Klar eller ikke, her kommer jeg!',
    'hideseek.seekHelp': 'Gå bort til en ting og trykk A for å sjekke den',
    'hideseek.boing': 'boing!',
    'hideseek.found': 'Fant {name}!',
    'hideseek.giggle': 'Hi hi! Noe fniste ...',
    'hideseek.allFound': 'Alle er funnet!',
    'hideseek.timeUp': 'Tiden er ute!',
    'hideseek.safe': 'Trygg!',
    'hideseek.seeker': 'Leter',
    'hideseek.counting': 'teller ... {n}',
    'hideseek.hiding': '{n} gjemt',
    'hideseek.grumble': 'Grumling',
    'hideseek.foundN': 'fant {n}',
    'hideseek.hidS': 'gjemt {s} s',
    'hideseek.pts': '{n} poeng',
    'hideseek.roundDone': 'Runde {n} ferdig!',
    'hideseek.roundSub': '{name} fant {n} av {total}',
    'hideseek.next': 'trykk hopp for neste runde',
    'hideseek.final': 'trykk hopp for sluttresultatet',
    'hideseek.solo': 'Supert lett!',
    'hideseek.finalSub': '{n} runder i hagen',
    'hideseek.statSeek': 'fant {n}',
    'hideseek.statHide': 'gjemt {s} s',
    'hideseek.place.1': '1. plass', 'hideseek.place.2': '2. plass', 'hideseek.place.3': '3. plass',
    'hideseek.place.4': '4. plass', 'hideseek.place.5': '5. plass', 'hideseek.place.6': '6. plass',
    'hideseek.prop.gnome': 'hagenisse', 'hideseek.prop.pumpkin': 'gresskar', 'hideseek.prop.bush': 'busk',
    'hideseek.prop.pot': 'blomsterpotte', 'hideseek.prop.can': 'vannkanne',
  },
});

const HW = 12.5, HD = 8; // garden half width / depth (inside the fence)
const PR = 0.42; // body radius for collisions
const SPEED = 5.5; // walking (undisguised hiders, seeker)
const SEEK_SPEED = 5.2;
const PROP_SPEED = 1.8; // disguised hiders shuffle slowly
const CARD_TIME = 2.2;
const HIDE_TIME = 9;
const SOLO_HIDE_TIME = 4.5;
const SEEK_TIME = 45;
const REVEAL_TIME = 2.8;
const SCORES_MAX = 12;
const REACH = 1.35; // how far in front the magnifying glass reaches
const STUN = 0.5;
const HINT_EVERY = 10;
const FIND_PTS = 4; // seeker, per hider found
const SURVIVE_EVERY = 5; // hiders: +1 point per this many seconds hidden
const SAFE_BONUS = 3; // hiders: bonus for never being found
const MAX_ROUNDS = 4;
const SOLO_ROUNDS = 2;

const PROP_KEYS = ['gnome', 'pumpkin', 'bush', 'pot', 'can'];
const DECOYS_PER_TYPE = 6;
const BOT_COLORS = [0x7b6cf6, 0xff9f43, 0x4cc9f0];

// Solid things in the garden (axis-aligned boxes and circles).
const SHED = { x: -9.3, z: -5.7, hw: 2.2, hd: 1.6 };
const BOXES = [
  SHED,
  { x: 2.6, z: -5.3, hw: 3, hd: 0.5, kind: 'hedge' },
  { x: -4.4, z: 2.6, hw: 0.5, hd: 2.3, kind: 'hedge' },
  { x: 5.6, z: -0.6, hw: 0.5, hd: 1.7, kind: 'hedge' },
  { x: -8.9, z: 4, hw: 1.9, hd: 1.0, kind: 'bed' },
  { x: 1.6, z: 5.9, hw: 2.4, hd: 0.75, kind: 'bed' },
];
const POND = { x: 8.6, z: 4.4, r: 2.3 };
const SEEKER_START = { x: -9.3, z: -3.35 };
const SEATS_Z = -HD - 1.25; // found players cheer from behind the back fence

// ---------- props (decoys and disguises share these builders, so they look identical) ----------

const geo = (key, make) => sharedGeo(`hs-${key}`, make);
const sphere = (r, w = 14, h = 10) => geo(`sph${r}|${w}`, () => new THREE.SphereGeometry(r, w, h));
const cylinder = (key, rt, rb, h, seg = 16) => geo(key, () => new THREE.CylinderGeometry(rt, rb, h, seg));

function part(g, geometry, color, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geometry, toon(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  g.add(m);
  return m;
}

const PROP_BUILDERS = {
  gnome(g) {
    part(g, cylinder('gnBoots', 0.3, 0.3, 0.1), 0x6b4a32, 0, 0.05, 0);
    part(g, cylinder('gnCoat', 0.24, 0.33, 0.46), 0x3a86ff, 0, 0.32, 0);
    part(g, cylinder('gnBelt', 0.26, 0.27, 0.07), 0x5a3a22, 0, 0.36, 0);
    part(g, sphere(0.2), 0xffd2b0, 0, 0.66, 0);
    const beard = part(g, geo('gnBeard', () => new THREE.ConeGeometry(0.2, 0.36, 14)), COLORS.white, 0, 0.5, 0.1);
    beard.rotation.x = Math.PI;
    part(g, sphere(0.06), COLORS.blush, 0, 0.64, 0.2);
    for (const s of [-1, 1]) part(g, sphere(0.03, 8, 6), COLORS.ink, s * 0.08, 0.71, 0.17);
    const hat = part(g, geo('gnHat', () => new THREE.ConeGeometry(0.22, 0.56, 14)), 0xff4d5e, 0, 1.0, -0.02);
    hat.rotation.x = -0.12;
  },
  pumpkin(g) {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const lobe = part(g, sphere(0.26), 0xff8c2a, Math.cos(a) * 0.15, 0.26, Math.sin(a) * 0.15);
      lobe.scale.set(0.85, 0.95, 0.85);
    }
    part(g, sphere(0.3), 0xff9a3c, 0, 0.27, 0).scale.set(1, 0.92, 1);
    const stem = part(g, cylinder('pkStem', 0.04, 0.06, 0.2, 8), 0x6b8e23, 0.02, 0.58, 0);
    stem.rotation.z = -0.2;
    const leaf = part(g, sphere(0.12), COLORS.leaf, -0.12, 0.53, 0.05);
    leaf.scale.set(1.2, 0.3, 0.8);
    leaf.rotation.z = 0.4;
  },
  bush(g) {
    const blobs = [[0, 0.42, 0, 0.5, COLORS.leaf], [0.32, 0.3, 0.1, 0.36, COLORS.leafLight], [-0.3, 0.3, -0.05, 0.38, COLORS.leaf], [0.05, 0.62, -0.08, 0.32, COLORS.leafLight]];
    for (const [x, y, z, r, c] of blobs) {
      const b = part(g, geo('bushBlob', () => faceted(new THREE.IcosahedronGeometry(1, 1))), c, x, y, z);
      b.scale.setScalar(r);
    }
    for (const [x, y, z] of [[0.2, 0.7, 0.3], [-0.3, 0.55, 0.3], [0.45, 0.45, 0.25]]) part(g, sphere(0.06, 8, 6), 0xff7eb6, x, y, z);
  },
  pot(g) {
    part(g, cylinder('potBody', 0.3, 0.22, 0.42), 0xd9714a, 0, 0.21, 0);
    part(g, cylinder('potRim', 0.34, 0.34, 0.1), 0xe88a5f, 0, 0.43, 0);
    part(g, cylinder('potSoil', 0.29, 0.29, 0.04), 0x6b4a32, 0, 0.47, 0);
    const rand = seeded(9); // fixed seed: every pot gets the same flowers
    for (const [x, z, s] of [[0, 0, 1.4], [0.14, 0.1, 1.15], [-0.13, 0.08, 1.2]]) {
      const f = makeFlower(rand);
      f.position.set(x, 0.46, z);
      f.scale.setScalar(s);
      g.add(f);
    }
  },
  can(g) {
    part(g, cylinder('canBody', 0.25, 0.27, 0.44), 0x3ddc97, 0, 0.22, 0);
    part(g, cylinder('canTop', 0.2, 0.25, 0.08), 0x2fbf7f, 0, 0.48, 0);
    const spout = part(g, cylinder('canSpout', 0.035, 0.055, 0.52, 8), 0x3ddc97, 0.36, 0.42, 0);
    spout.rotation.z = -0.95;
    const rose = part(g, cylinder('canRose', 0.09, 0.05, 0.08, 10), 0xffd23f, 0.57, 0.58, 0);
    rose.rotation.z = -0.95;
    const handle = part(g, geo('canHandle', () => new THREE.TorusGeometry(0.17, 0.04, 8, 16, Math.PI)), 0x2fbf7f, -0.06, 0.5, 0);
    handle.rotation.z = 0.15;
  },
};

const PROP_SCALE = 1.2;

function makeProp(type) {
  const g = new THREE.Group();
  const inner = new THREE.Group(); // scaled inside, so boing squash can use g.scale freely
  inner.scale.setScalar(PROP_SCALE);
  PROP_BUILDERS[PROP_KEYS[type]](inner);
  g.add(inner);
  return g;
}

/** Grumble stand-in with the same tiny interface as Character (for bot hiders). */
class GrumbleBody {
  constructor(color) {
    this.group = new THREE.Group();
    this.critter = makeGrumble(color);
    this.critter.scale.setScalar(1.25);
    this.group.add(this.critter);
    this.yaw = 0; this.targetYaw = 0; this.walk = 0; this.sq = 1;
  }
  face(dx, dz) { if (Math.abs(dx) + Math.abs(dz) > 0.01) this.targetYaw = Math.atan2(dx, dz); }
  squash(a) { this.sq = a; }
  update(dt, { moving = 0 } = {}) {
    this.walk += dt * (6 + 10 * moving);
    this.critter.position.y = Math.abs(Math.sin(this.walk)) * 0.12 * moving;
    let d = this.targetYaw - this.yaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.yaw += d * Math.min(1, dt * 12);
    this.group.rotation.y = this.yaw;
    this.sq += (1 - this.sq) * Math.min(1, dt * 10);
    this.critter.scale.set(1.25 / Math.sqrt(this.sq), 1.25 * this.sq, 1.25 / Math.sqrt(this.sq));
  }
}

const clamp = THREE.MathUtils.clamp;

export class HideSeekScene extends MiniGame {
  constructor(game, opts) {
    super(game, opts);
    this.camera.fov = 40;
    this.scene.background = skyTexture('#9fe0ff', '#fff4dc');
    addLights(this.scene, { size: 20, dir: new THREE.Vector3(-0.45, 1, 0.55) });

    this.solo = this.players.length === 1;
    this.rand = seeded(1000 + Math.floor(Math.random() * 1e6));
    this.buildGarden();
    this.buildDecoys();

    // Everyone gets a body and one copy of every prop (only the current disguise is visible).
    this.ents = this.players.map((p, i) => this.makeEnt(p, i));
    const bots = this.solo ? 3 : Math.max(0, 3 - (this.players.length - 1));
    for (let i = 0; i < bots; i++) this.ents.push(this.makeEnt(null, i));

    const humans = this.ents.filter((e) => !e.bot);
    this.seekers = this.solo ? [humans[0], humans[0]] : humans.slice(0, MAX_ROUNDS);
    this.roundIdx = -1;
    this.phase = 'idle';
    this.phaseT = 0;

    // Ring that shows which prop the magnifying glass would check.
    this.aimRing = new THREE.Mesh(geo('aimRing', () => new THREE.RingGeometry(0.55, 0.7, 28)), toon(COLORS.white, { transparent: true, opacity: 0.85 }));
    this.aimRing.rotation.x = -Math.PI / 2;
    this.aimRing.visible = false;
    this.scene.add(this.aimRing);

    this.magnifier = this.makeMagnifier();
    this.dizzy = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const s = makeStar();
      s.scale.setScalar(0.35);
      this.dizzy.add(s);
    }
    this.dizzy.visible = false;
    this.scene.add(this.dizzy);

    this.overlay = null; // look-away banner element
    this.placeAtStart();
    this.frame();
    game.audio.playMusic('bubble');
    this.intro(t('game.hideseek'), t('hideseek.intro'));
  }

  // ---------- setup ----------

  makeEnt(p, i) {
    const root = new THREE.Group();
    const body = p ? new Character(p.color, { hat: p.hat }) : new GrumbleBody(BOT_COLORS[i % BOT_COLORS.length]);
    root.add(body.group);
    const propWrap = new THREE.Group();
    const props = PROP_KEYS.map((_, k) => {
      const m = makeProp(k);
      m.visible = false;
      propWrap.add(m);
      return m;
    });
    root.add(propWrap);
    this.scene.add(root);
    const label = this.game.ui.label('label player-tag');
    return {
      p, bot: !p, body, root, propWrap, props, label,
      name: p ? p.name : t('hideseek.grumble'),
      css: p ? p.css : '#7b6cf6',
      color: p ? p.color : BOT_COLORS[i % BOT_COLORS.length],
      x: 0, z: 0, y: 0, vy: 0, speed: 0,
      role: 'hider', disguise: -1, propYaw: 0,
      found: false, reveal: -1, revealFrom: null, seat: null,
      giggle: 0, stun: 0, checkCd: 0, poke: 0, cheer: Math.random() * 6,
      total: 0, roundPts: 0, roundStat: '', finds: 0, hidTime: 0, survived: 0,
      bot_target: null,
    };
  }

  makeMagnifier() {
    const g = new THREE.Group();
    const handle = part(g, cylinder('magHandle', 0.05, 0.06, 0.45, 8), 0xa0704a, 0, 0, 0);
    handle.position.y = -0.3;
    const ring = part(g, geo('magRing', () => new THREE.TorusGeometry(0.22, 0.05, 8, 24)), COLORS.gold, 0, 0.12, 0);
    ring.rotation.y = 0;
    const lens = new THREE.Mesh(cylinder('magLens', 0.2, 0.2, 0.03, 20), toon(0xbfe9ff, { transparent: true, opacity: 0.55 }));
    lens.rotation.x = Math.PI / 2;
    lens.position.y = 0.12;
    g.add(lens);
    g.position.set(0.42, 0.75, 0.42);
    g.rotation.set(-0.5, 0, -0.3);
    g.scale.setScalar(1.4);
    return g;
  }

  frame() {
    const tilt = THREE.MathUtils.degToRad(58);
    // Fit the fence plus the cheering row behind it, leaving room for the HUD.
    const d = this.fitDistance(HW * 2 + 2.5, (HD * 2 + 3.2) * Math.sin(tilt) + 5.2);
    this.camera.position.set(0, Math.sin(tilt) * d, Math.cos(tilt) * d - 0.4);
    this.camera.lookAt(0, 0, -0.4);
    this.confettiOrigin = new THREE.Vector3(0, 3, 0);
  }

  resize(w, h) {
    super.resize(w, h);
    this.frame();
  }

  lawnTexture() {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 512;
    const g = c.getContext('2d');
    // Mowed stripes.
    for (let i = 0; i < 10; i++) {
      g.fillStyle = i % 2 ? '#79d45a' : '#86de66';
      g.fillRect(i * 51.2, 0, 51.2, 512);
    }
    const rand = seeded(4);
    g.fillStyle = 'rgba(255,255,255,0.18)';
    for (let i = 0; i < 160; i++) g.fillRect(rand() * 512, rand() * 512, 3, 6);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  buildGarden() {
    const s = this.scene;
    const rand = seeded(17);

    const outer = new THREE.Mesh(new THREE.CircleGeometry(90, 40), toon(COLORS.grassDark));
    outer.rotation.x = -Math.PI / 2;
    outer.position.y = -0.02;
    outer.receiveShadow = true;
    s.add(outer);
    const lawn = new THREE.Mesh(new THREE.PlaneGeometry(HW * 2 + 0.6, HD * 2 + 0.6), new THREE.MeshToonMaterial({ map: this.lawnTexture(), gradientMap: toon(0xffffff).gradientMap }));
    lawn.rotation.x = -Math.PI / 2;
    lawn.receiveShadow = true;
    s.add(lawn);

    // Stepping stones from the gate to the shed.
    for (let i = 0; i < 9; i++) {
      const k = i / 8;
      const x = THREE.MathUtils.lerp(0, -8.4, k) + Math.sin(k * 5) * 1.2;
      const z = THREE.MathUtils.lerp(HD - 0.4, -3.9, k);
      const st = new THREE.Mesh(cylinder('stone', 0.42, 0.45, 0.06, 12), toon(0xe6dfd0));
      st.position.set(x, 0.03, z);
      st.scale.set(1, 1, 0.8);
      st.receiveShadow = true;
      s.add(st);
    }

    this.buildFence();
    this.buildShed();

    // Hedges and raised flower beds.
    for (const b of BOXES) {
      if (b.kind === 'hedge') {
        const h = new THREE.Mesh(new RoundedBoxGeometry(b.hw * 2, 1.0, b.hd * 2, 3, 0.3), toon(0x3fae5a));
        h.position.set(b.x, 0.5, b.z);
        h.castShadow = h.receiveShadow = true;
        s.add(h);
        const n = Math.round(Math.max(b.hw, b.hd) * 2);
        for (let i = 0; i < n; i++) {
          const k = (i + 0.5) / n - 0.5;
          const bump = new THREE.Mesh(geo('hedgeBump', () => faceted(new THREE.IcosahedronGeometry(0.4, 1))), toon(0x4cc46a));
          bump.position.set(b.x + (b.hw > b.hd ? k * b.hw * 2 : 0), 0.95, b.z + (b.hw > b.hd ? 0 : k * b.hd * 2));
          bump.castShadow = true;
          s.add(bump);
        }
      } else if (b.kind === 'bed') {
        const frame = new THREE.Mesh(new RoundedBoxGeometry(b.hw * 2, 0.34, b.hd * 2, 2, 0.08), toon(0xb87a48));
        frame.position.set(b.x, 0.17, b.z);
        frame.castShadow = frame.receiveShadow = true;
        const soil = new THREE.Mesh(new THREE.BoxGeometry(b.hw * 2 - 0.25, 0.05, b.hd * 2 - 0.25), toon(0x7a5236));
        soil.position.set(b.x, 0.34, b.z);
        s.add(frame, soil);
        const cols = Math.round(b.hw * 2.2), rows = Math.max(1, Math.round(b.hd * 2));
        for (let i = 0; i < cols; i++) {
          for (let j = 0; j < rows; j++) {
            const f = makeFlower(rand);
            f.position.set(b.x - b.hw + 0.4 + (i / Math.max(1, cols - 1)) * (b.hw * 2 - 0.8), 0.34, b.z - b.hd + 0.4 + (rows > 1 ? (j / (rows - 1)) * (b.hd * 2 - 0.8) : b.hd - 0.4));
            f.scale.setScalar(1.3);
            s.add(f);
          }
        }
      }
    }

    // The pond with a rocky rim, lily pads and a rubber duck.
    const water = new THREE.Mesh(cylinder('pond', POND.r, POND.r, 0.06, 32), toon(COLORS.water));
    water.position.set(POND.x, 0.03, POND.z);
    water.receiveShadow = true;
    const deep = new THREE.Mesh(cylinder('pondDeep', POND.r * 0.55, POND.r * 0.55, 0.07, 28), toon(COLORS.waterDeep));
    deep.position.set(POND.x + 0.2, 0.035, POND.z - 0.1);
    s.add(water, deep);
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const r = makeRock(rand, 0.38);
      r.position.set(POND.x + Math.cos(a) * (POND.r + 0.1), 0.08, POND.z + Math.sin(a) * (POND.r + 0.1));
      s.add(r);
    }
    for (const [x, z] of [[-0.9, 0.6], [0.8, -0.9], [-0.3, -1.2]]) {
      const pad = new THREE.Mesh(cylinder('lily', 0.32, 0.32, 0.03, 14), toon(0x58b947));
      pad.position.set(POND.x + x, 0.08, POND.z + z);
      s.add(pad);
    }
    this.duck = new THREE.Group();
    part(this.duck, sphere(0.26), COLORS.candyYellow, 0, 0.18, 0).scale.set(1.2, 0.8, 1);
    part(this.duck, sphere(0.16), COLORS.candyYellow, 0.18, 0.4, 0);
    part(this.duck, sphere(0.07), 0xff8c42, 0.34, 0.38, 0).scale.set(1.4, 0.6, 1);
    part(this.duck, sphere(0.03, 8, 6), COLORS.ink, 0.27, 0.45, 0.09);
    part(this.duck, sphere(0.03, 8, 6), COLORS.ink, 0.27, 0.45, -0.09);
    this.duck.position.set(POND.x, 0.05, POND.z);
    s.add(this.duck);

    // Trees and bushes outside the fence.
    for (let i = 0; i < 16; i++) {
      const x = -HW - 2 + (i / 15) * (HW * 2 + 4) + (rand() - 0.5) * 1.2;
      const tr = makeTree(rand, 1.1 + rand() * 0.5);
      tr.position.set(x, 0, -HD - 3.4 - rand() * 2.5);
      s.add(tr);
    }
    for (const sx of [-1, 1]) {
      for (let i = 0; i < 4; i++) {
        const tr = makeTree(rand, 1 + rand() * 0.4);
        tr.position.set(sx * (HW + 2.6 + rand() * 1.5), 0, -HD + 1 + i * 4.5);
        s.add(tr);
      }
    }
  }

  buildFence() {
    const s = this.scene;
    const spots = [];
    const step = 0.62;
    for (let x = -HW; x <= HW + 0.01; x += step) {
      spots.push([x, -HD - 0.35]);
      if (Math.abs(x) > 1.3) spots.push([x, HD + 0.35]); // gate gap in the front
    }
    for (let z = -HD + step; z < HD; z += step) { spots.push([-HW - 0.35, z]); spots.push([HW + 0.35, z]); }
    const picket = new THREE.InstancedMesh(geo('picket', () => new THREE.BoxGeometry(0.16, 0.8, 0.08)), toon(COLORS.white), spots.length);
    const tip = new THREE.InstancedMesh(geo('picketTip', () => new THREE.ConeGeometry(0.115, 0.18, 4)), toon(COLORS.white), spots.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1);
    spots.forEach(([x, z], i) => {
      const side = Math.abs(z) < HD; // side fences face along x
      q.setFromEuler(new THREE.Euler(0, side ? Math.PI / 2 : 0, 0));
      m.compose(new THREE.Vector3(x, 0.4, z), q, one);
      picket.setMatrixAt(i, m);
      q.setFromEuler(new THREE.Euler(0, Math.PI / 4 + (side ? Math.PI / 2 : 0), 0));
      m.compose(new THREE.Vector3(x, 0.89, z), q, new THREE.Vector3(1, 1, 0.5));
      tip.setMatrixAt(i, m);
    });
    picket.castShadow = tip.castShadow = true;
    s.add(picket, tip);
    const rail = (x, z, w, d) => {
      for (const y of [0.25, 0.6]) {
        const r = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, d), toon(0xf3ede0));
        r.position.set(x, y, z);
        s.add(r);
      }
    };
    rail(0, -HD - 0.4, HW * 2 + 0.8, 0.05);
    rail(-(HW + 1.3) / 2, HD + 0.4, HW - 1.3, 0.05);
    rail((HW + 1.3) / 2, HD + 0.4, HW - 1.3, 0.05);
    rail(-HW - 0.4, 0, 0.05, HD * 2 + 0.8);
    rail(HW + 0.4, 0, 0.05, HD * 2 + 0.8);
    // Gate posts.
    for (const sx of [-1, 1]) part(s, cylinder('gatePost', 0.14, 0.14, 1.2, 10), 0xffffff, sx * 1.4, 0.6, HD + 0.35);
  }

  buildShed() {
    const s = this.scene;
    const g = new THREE.Group();
    const w = SHED.hw * 2, d = SHED.hd * 2;
    const walls = new THREE.Mesh(new RoundedBoxGeometry(w, 2.1, d, 2, 0.08), toon(0xc98b5a));
    walls.position.y = 1.05;
    walls.castShadow = walls.receiveShadow = true;
    g.add(walls);
    // Roof: two slanted panels.
    for (const sz of [-1, 1]) {
      const panel = new THREE.Mesh(new RoundedBoxGeometry(w + 0.5, 0.14, d / 2 + 0.55, 2, 0.05), toon(0xff5d73));
      panel.position.set(0, 2.55, sz * (d / 4 + 0.05));
      panel.rotation.x = sz * 0.55;
      panel.castShadow = true;
      g.add(panel);
    }
    // Triangular gable that fills the space under the roof.
    const tri = new THREE.Shape();
    tri.moveTo(-d / 2, 0); tri.lineTo(d / 2, 0); tri.lineTo(0, 0.95); tri.closePath();
    const gGeo = new THREE.ExtrudeGeometry(tri, { depth: w - 0.1, bevelEnabled: false });
    gGeo.translate(0, 0, -(w - 0.1) / 2);
    const gable = new THREE.Mesh(gGeo, toon(0xd9a06a));
    gable.rotation.y = Math.PI / 2;
    gable.position.y = 2.08;
    g.add(gable);
    const door = new THREE.Mesh(new RoundedBoxGeometry(0.95, 1.6, 0.1, 2, 0.04), toon(0x8a5a36));
    door.position.set(0.7, 0.8, d / 2 + 0.03);
    const knob = new THREE.Mesh(sphere(0.06), toon(COLORS.gold));
    knob.position.set(0.35, 0.8, d / 2 + 0.1);
    const win = new THREE.Mesh(new RoundedBoxGeometry(0.85, 0.7, 0.08, 2, 0.04), toon(0xbfe9ff));
    win.position.set(-0.9, 1.25, d / 2 + 0.03);
    const frameV = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.75, 0.1), toon(COLORS.white));
    frameV.position.set(-0.9, 1.25, d / 2 + 0.06);
    const frameH = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.07, 0.1), toon(COLORS.white));
    frameH.position.set(-0.9, 1.25, d / 2 + 0.06);
    const box = new THREE.Mesh(new RoundedBoxGeometry(1, 0.25, 0.35, 2, 0.06), toon(0xb87a48));
    box.position.set(-0.9, 0.82, d / 2 + 0.2);
    g.add(door, knob, win, frameV, frameH, box);
    for (let i = 0; i < 3; i++) {
      const f = makeFlower(seeded(40 + i));
      f.position.set(-1.2 + i * 0.3, 0.92, d / 2 + 0.2);
      g.add(f);
    }
    g.position.set(SHED.x, 0, SHED.z);
    s.add(g);
  }

  /** True if a circle at (x, z) with radius r overlaps nothing solid. */
  isFree(x, z, r, { decoys = true } = {}) {
    if (Math.abs(x) > HW - r || Math.abs(z) > HD - r) return false;
    for (const b of BOXES) {
      const cx = clamp(x, b.x - b.hw, b.x + b.hw), cz = clamp(z, b.z - b.hd, b.z + b.hd);
      if (Math.hypot(x - cx, z - cz) < r) return false;
    }
    if (Math.hypot(x - POND.x, z - POND.z) < POND.r + r) return false;
    if (decoys) for (const d of this.decoys) if (Math.hypot(x - d.x, z - d.z) < r + PR) return false;
    return true;
  }

  buildDecoys() {
    this.decoys = [];
    const rand = seeded(77 + Math.floor(Math.random() * 1000));
    const types = [];
    for (let k = 0; k < PROP_KEYS.length; k++) for (let i = 0; i < DECOYS_PER_TYPE; i++) types.push(k);
    for (const type of types) {
      for (let tries = 0; tries < 300; tries++) {
        const x = (rand() * 2 - 1) * (HW - 0.8), z = (rand() * 2 - 1) * (HD - 0.8);
        if (!this.isFree(x, z, 0.9, { decoys: false })) continue;
        if (Math.hypot(x - SEEKER_START.x, z - SEEKER_START.z) < 2.6) continue;
        if (Math.hypot(x, z - 0.5) < 2.2) continue; // keep the hiders' start spot clear
        if (this.decoys.some((d) => Math.hypot(d.x - x, d.z - z) < 1.7)) continue;
        const g = makeProp(type);
        const yaw = rand() * Math.PI * 2;
        g.rotation.y = yaw;
        g.position.set(x, 0, z);
        this.scene.add(g);
        this.decoys.push({ g, type, x, z, yaw, boing: 0 });
        break;
      }
    }
  }

  placeAtStart() {
    const hiders = this.ents.filter((e) => e !== this.seeker);
    hiders.forEach((e, i) => {
      const a = (i / Math.max(1, hiders.length)) * Math.PI * 2 + 0.4;
      e.x = Math.cos(a) * 1.3;
      e.z = 0.5 + Math.sin(a) * 1.0;
      e.body.face(e.x, 1);
      e.body.yaw = e.body.targetYaw;
    });
    if (this.seeker) { this.seeker.x = SEEKER_START.x; this.seeker.z = SEEKER_START.z; }
  }

  // ---------- round flow ----------

  onStart() {
    this.nextRound();
  }

  get roundsTotal() {
    return this.seekers.length;
  }

  nextRound() {
    this.scoresEl?.remove();
    this.scoresEl = null;
    this.roundIdx++;
    if (this.roundIdx >= this.roundsTotal) { this.end(); return; }
    this.seeker = this.seekers[this.roundIdx];
    for (const e of this.ents) {
      e.role = e === this.seeker ? 'seeker' : 'hider';
      e.found = false; e.reveal = -1; e.seat = null; e.y = 0; e.vy = 0;
      e.stun = 0; e.giggle = 0; e.roundPts = 0; e.survived = 0; e.bot_target = null;
      this.setDisguise(e, -1, 0);
    }
    if (this.magnifier.parent) this.magnifier.parent.remove(this.magnifier);
    this.seeker.body.group.add(this.magnifier);
    this.placeAtStart();
    this.seeker.body.face(0, -1); // facing the shed wall, eyes closed
    this.seeker.body.yaw = this.seeker.body.targetYaw;
    this.foundCount = 0;
    this.setPhase('card');
    this.game.ui.banner(t('hideseek.round', { n: this.roundIdx + 1, total: this.roundsTotal }), t('hideseek.seekerIs', { name: this.seeker.name }), CARD_TIME * 1000 - 200);
    this.game.audio.play('whoosh');
  }

  setPhase(ph) {
    this.phase = ph;
    this.phaseT = 0;
  }

  startHide() {
    this.setPhase('hide');
    this.hideLeft = this.solo ? SOLO_HIDE_TIME : HIDE_TIME;
    this.lastCount = -1;
    for (const e of this.ents) if (e.bot && e.role === 'hider') this.pickBotSpot(e);
    this.showOverlay();
    this.game.audio.play('go');
  }

  startSeek() {
    this.setPhase('seek');
    this.removeOverlay();
    this.seekLeft = SEEK_TIME;
    this.hintT = HINT_EVERY * (0.8 + Math.random() * 0.3);
    // Anyone still out in the open gets tucked into the nearest prop shape (forgiving).
    for (const e of this.ents) {
      if (e.role !== 'hider') continue;
      if (e.bot && e.bot_target && e.disguise < 0) { e.x = e.bot_target.x; e.z = e.bot_target.z; }
      if (e.disguise < 0) {
        const d = this.nearestDecoy(e.x, e.z);
        this.setDisguise(e, d ? d.d.type : 0, d ? d.d.yaw : 0);
      }
    }
    this.seeker.body.face(1, 1);
    this.game.ui.banner(t('hideseek.ready'), t('hideseek.seekHelp'), 1900);
    this.game.audio.play('whoosh');
  }

  endSeek(allFound) {
    this.setPhase('reveal');
    this.aimRing.visible = false;
    this.dizzy.visible = false;
    this.game.ui.banner(allFound ? t('hideseek.allFound') : t('hideseek.timeUp'), '', 1600);
    this.game.audio.play(allFound ? 'fanfare' : 'go');
    // Survivors pop out where they hid.
    let i = 0;
    for (const e of this.ents) {
      if (e.role !== 'hider' || e.found) continue;
      e.survived = SEEK_TIME;
      this.later(0.4 + i++ * 0.25, () => {
        this.setDisguise(e, -1, 0);
        e.vy = 6;
        e.body.squash(1.3);
        this.puffs.burst(new THREE.Vector3(e.x, 0.6, e.z), COLORS.white, { count: 12, size: 0.35, life: 0.6 });
        this.confetti.burst(new THREE.Vector3(e.x, 1.2, e.z), 0, { count: 16, speed: 5, colors: [e.color, COLORS.gold], life: 1.2 });
        this.game.audio.play('star');
      });
    }
  }

  scoreRound() {
    const sk = this.seeker;
    const hiders = this.ents.filter((e) => e !== sk);
    sk.roundPts = this.foundCount * FIND_PTS;
    sk.finds += this.foundCount;
    sk.roundStat = t('hideseek.foundN', { n: this.foundCount });
    for (const e of hiders) {
      e.roundPts = Math.floor(e.survived / SURVIVE_EVERY) + (e.found ? 0 : SAFE_BONUS);
      e.hidTime += e.survived;
      e.roundStat = e.found ? t('hideseek.hidS', { s: Math.floor(e.survived) }) : t('hideseek.safe');
    }
    for (const e of this.ents) e.total += e.roundPts;
  }

  showScores() {
    this.scoreRound();
    this.setPhase('scores');
    this.game.audio.play('fanfare');
    this.renderScores();
  }

  renderScores() {
    const humans = this.ents.filter((e) => !e.bot).sort((a, b) => b.total - a.total);
    const hiders = this.ents.filter((e) => e !== this.seeker).length;
    const last = this.roundIdx + 1 >= this.roundsTotal;
    const best = Math.max(...humans.map((e) => e.roundPts));
    this.scoresEl?.remove();
    this.scoresEl = this.game.ui.results({
      title: t('hideseek.roundDone', { n: this.roundIdx + 1 }),
      subtitle: t('hideseek.roundSub', { name: this.seeker.name, n: this.foundCount, total: hiders }),
      rows: humans.map((e) => ({
        css: e.css, name: e.name,
        value: String(e.total),
        detail: `+${e.roundPts} · ${e === this.seeker ? `${t('hideseek.seeker')}, ` : ''}${e.roundStat}`,
        crown: e.roundPts === best && best > 0,
      })),
      footer: `<span class="blink">${last ? t('hideseek.final') : t('hideseek.next')}</span>`,
    });
  }

  onLanguage() {
    if (this.phase === 'scores' && this.scoresEl) this.renderScores();
    if (this.phase === 'hide') this.showOverlay();
    for (const e of this.ents) if (e.bot) e.name = t('hideseek.grumble');
  }

  end() {
    this.removeOverlay();
    this.aimRing.visible = false;
    const humans = this.ents.filter((e) => !e.bot).sort((a, b) => b.total - a.total);
    const top = humans[0].total;
    const leaders = humans.filter((e) => e.total === top);
    // Everybody pops out of hiding for the party.
    for (const e of this.ents) { this.setDisguise(e, -1, 0); e.seat = null; e.reveal = -1; e.role = 'out'; }
    this.magnifier.parent?.remove(this.magnifier);
    this.placeAtStart();
    this.finish({
      title: this.solo ? t('hideseek.solo') : leaders.length > 1 ? t('tie') : t('win', { name: leaders[0].name }),
      subtitle: t('hideseek.finalSub', { n: this.roundsTotal }),
      rows: humans.map((e) => {
        const place = humans.filter((o) => o.total > e.total).length + 1;
        const stats = this.solo ? t('hideseek.statSeek', { n: e.finds })
          : `${t('hideseek.statSeek', { n: e.finds })} · ${t('hideseek.statHide', { s: Math.floor(e.hidTime) })}`;
        return {
          css: e.css, name: e.name, value: String(e.total),
          detail: `${t(`hideseek.place.${place}`)} · ${stats}`, crown: e.total === top,
        };
      }),
      stars: 2,
    });
  }

  // ---------- look-away banner ----------

  showOverlay() {
    this.removeOverlay();
    const el = this.game.ui.label('hs-overlay');
    const sk = this.seeker;
    if (this.solo) {
      // Solo: the grumbles hide behind a leafy curtain.
      el.style.cssText = 'position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;background:radial-gradient(circle,#86de66 0%,#3fae5a 100%);text-align:center;';
      el.innerHTML = `<div class="outlined" style="font-weight:700;font-size:clamp(30px,5.5vw,86px);color:#2fa04a">${esc(t('hideseek.soloHide'))}</div>
        <div class="big-num hs-count" style="font-size:clamp(60px,10vw,160px)"></div>
        <div class="banner-sub">${esc(t('hideseek.soloSub'))}</div>`;
    } else {
      el.style.cssText = 'position:absolute;left:50%;top:2%;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:4px;text-align:center;width:96vw;';
      el.innerHTML = `<div style="display:flex;align-items:center;gap:clamp(10px,2vw,30px)">
          <div class="outlined" style="font-weight:700;font-size:clamp(28px,4.6vw,76px);line-height:1;color:${sk.css}">${esc(t('hideseek.lookAway', { name: sk.name }))}</div>
          <div class="big-num hs-count" style="font-size:clamp(40px,6vw,96px)"></div>
        </div>
        <div class="banner-sub" style="margin-top:2px;font-size:clamp(14px,1.7vw,26px)">${esc(t('hideseek.lookSub'))}</div>
        <div class="pill" style="margin-top:4px">${esc(t('hideseek.hideHelp'))}</div>`;
    }
    this.overlay = el;
    this.overlayCount = el.querySelector('.hs-count');
  }

  removeOverlay() {
    this.overlay?.remove();
    this.overlay = null;
  }

  // ---------- disguises ----------

  setDisguise(e, type, yaw) {
    e.disguise = type;
    e.propYaw = yaw;
    e.props.forEach((m, k) => { m.visible = k === type; });
    e.propWrap.rotation.set(0, yaw, 0);
    e.body.group.visible = type < 0;
  }

  nearestDecoy(x, z, max = Infinity) {
    let best = null;
    for (const d of this.decoys) {
      const dist = Math.hypot(d.x - x, d.z - z);
      if (dist < max && (!best || dist < best.dist)) best = { d, dist };
    }
    return best;
  }

  /** A: copy the nearest decoy; otherwise pop in/out of the last shape. B: next shape. */
  disguiseInput(e, inp) {
    const at = new THREE.Vector3(e.x, 0.6, e.z);
    if (inp.aPressed && this.phase === 'hide') {
      const near = this.nearestDecoy(e.x, e.z, 1.7);
      if (near && near.d.type !== e.disguise) this.setDisguise(e, near.d.type, near.d.yaw);
      else if (!near) this.setDisguise(e, e.disguise >= 0 ? -1 : 0, Math.random() * Math.PI * 2);
      this.puffs.burst(at, COLORS.white, { count: 10, size: 0.3, life: 0.5 });
      this.game.audio.play('pop');
    }
    if (inp.bPressed) {
      this.setDisguise(e, (e.disguise + 1) % PROP_KEYS.length, e.disguise >= 0 ? e.propYaw : Math.random() * Math.PI * 2);
      // Changing shape while the seeker looks gives a little puff away.
      this.puffs.burst(at, COLORS.white, { count: this.phase === 'seek' ? 8 : 10, size: 0.3, life: 0.5 });
      this.game.audio.play(this.phase === 'seek' ? 'pop' : 'select');
    }
  }

  pickBotSpot(e) {
    for (let tries = 0; tries < 60; tries++) {
      const d = this.decoys[Math.floor(Math.random() * this.decoys.length)];
      const a = Math.random() * Math.PI * 2;
      const x = d.x + Math.cos(a) * 1.0, z = d.z + Math.sin(a) * 1.0;
      if (!this.isFree(x, z, PR)) continue;
      if (this.ents.some((o) => o !== e && o.bot_target && Math.hypot(o.bot_target.x - x, o.bot_target.z - z) < 3)) continue;
      e.bot_target = { x, z, d };
      return;
    }
    e.bot_target = { x: e.x, z: e.z, d: this.decoys[0] };
  }

  // ---------- simulation ----------

  inputFor(e) {
    if (e.bot) return null;
    return this.input(e.p) || null;
  }

  move(e, ix, iz, speed, dt) {
    const len = Math.hypot(ix, iz);
    if (len > 1) { ix /= len; iz /= len; }
    const tvx = ix * speed, tvz = iz * speed;
    e.vx = (e.vx || 0) + (tvx - (e.vx || 0)) * Math.min(1, dt * 12);
    e.vz = (e.vz || 0) + (tvz - (e.vz || 0)) * Math.min(1, dt * 12);
    e.x += e.vx * dt;
    e.z += e.vz * dt;
    e.speed = Math.hypot(e.vx, e.vz);
    if (len > 0.2 && e.disguise < 0) e.body.face(ix, iz);
  }

  collide(e) {
    e.x = clamp(e.x, -HW + PR, HW - PR);
    e.z = clamp(e.z, -HD + PR, HD - PR);
    for (const b of BOXES) {
      const cx = clamp(e.x, b.x - b.hw, b.x + b.hw), cz = clamp(e.z, b.z - b.hd, b.z + b.hd);
      const dx = e.x - cx, dz = e.z - cz, d = Math.hypot(dx, dz);
      if (d >= PR) continue;
      if (d > 1e-4) { e.x = cx + (dx / d) * PR; e.z = cz + (dz / d) * PR; continue; }
      // Inside the box: push out along the shortest side.
      const ox = b.hw + PR - Math.abs(e.x - b.x), oz = b.hd + PR - Math.abs(e.z - b.z);
      if (ox < oz) e.x += Math.sign(e.x - b.x || 1) * ox; else e.z += Math.sign(e.z - b.z || 1) * oz;
    }
    const pushCircle = (cx, cz, r) => {
      const dx = e.x - cx, dz = e.z - cz, d = Math.hypot(dx, dz);
      if (d < r && d > 1e-4) { e.x = cx + (dx / d) * r; e.z = cz + (dz / d) * r; }
    };
    pushCircle(POND.x, POND.z, POND.r + PR);
    for (const d of this.decoys) pushCircle(d.x, d.z, PR * 1.9);
  }

  separate() {
    const act = this.ents.filter((e) => e.role !== 'out' && e.reveal < 0);
    for (let i = 0; i < act.length; i++) {
      for (let j = i + 1; j < act.length; j++) {
        const a = act[i], b = act[j];
        const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
        if (d < PR * 2 && d > 1e-4) {
          const push = (PR * 2 - d) / 2;
          a.x -= (dx / d) * push; a.z -= (dz / d) * push;
          b.x += (dx / d) * push; b.z += (dz / d) * push;
        }
      }
    }
  }

  updateHider(e, dt) {
    if (e.found || e.role !== 'hider') return;
    const canAct = this.phase === 'hide' || this.phase === 'seek';
    let ix = 0, iz = 0;
    if (canAct && e.bot && this.phase === 'hide') {
      const tg = e.bot_target;
      if (tg && e.disguise < 0) {
        const dx = tg.x - e.x, dz = tg.z - e.z, d = Math.hypot(dx, dz);
        if (d > 0.25) { ix = dx / d; iz = dz / d; } else this.setDisguise(e, tg.d.type, tg.d.yaw);
      }
    } else if (canAct) {
      const inp = this.inputFor(e);
      if (inp) {
        ix = inp.x; iz = -inp.y;
        this.disguiseInput(e, inp);
      }
    }
    const speed = e.disguise >= 0 ? PROP_SPEED : e.bot ? SPEED * 0.8 : SPEED;
    this.move(e, ix, iz, speed, dt);
  }

  /** The prop the seeker's magnifying glass is pointing at (decoy or hider), or null. */
  aimTarget(sk) {
    const yaw = sk.body.targetYaw;
    const px = sk.x + Math.sin(yaw) * 0.6, pz = sk.z + Math.cos(yaw) * 0.6;
    let best = null;
    const consider = (x, z, obj) => {
      const d = Math.hypot(x - px, z - pz);
      if (d < REACH && (!best || d < best.d)) best = { d, obj, x, z };
    };
    for (const d of this.decoys) consider(d.x, d.z, { decoy: d });
    for (const e of this.ents) if (e.role === 'hider' && !e.found) consider(e.x, e.z, { ent: e });
    return best;
  }

  updateSeeker(sk, dt) {
    sk.stun -= dt;
    sk.checkCd -= dt;
    sk.poke = Math.max(0, sk.poke - dt * 4);
    let ix = 0, iz = 0;
    const seeking = this.phase === 'seek';
    const inp = this.inputFor(sk);
    if (seeking && sk.stun <= 0 && inp) { ix = inp.x; iz = -inp.y; }
    this.move(sk, ix, iz, SEEK_SPEED, dt);

    // Magnifying glass pokes forward when checking.
    this.magnifier.position.z = 0.42 + sk.poke * 0.35;
    this.magnifier.rotation.x = -0.5 - sk.poke * 0.6;

    const target = seeking && sk.stun <= 0 ? this.aimTarget(sk) : null;
    this.aimRing.visible = !!target;
    if (target) {
      this.aimRing.position.set(target.x, 0.04, target.z);
      this.aimRing.scale.setScalar(1 + Math.sin(this.time * 8) * 0.06);
      this.aimRing.material = toon(sk.color, { transparent: true, opacity: 0.85 });
    }
    if (seeking && target && inp?.aPressed && sk.stun <= 0 && sk.checkCd <= 0) {
      sk.checkCd = 0.3;
      sk.poke = 1;
      if (target.obj.ent) this.findHider(target.obj.ent, sk);
      else this.boingDecoy(target.obj.decoy, sk);
    }

    this.dizzy.visible = sk.stun > 0;
    if (sk.stun > 0) {
      this.dizzy.position.set(sk.x, 1.6, sk.z);
      this.dizzy.children.forEach((s, i) => {
        const a = this.time * 7 + (i / 3) * Math.PI * 2;
        s.position.set(Math.cos(a) * 0.45, Math.sin(this.time * 9 + i) * 0.06, Math.sin(a) * 0.45);
        s.rotation.y += dt * 6;
      });
    }
  }

  boingDecoy(d, sk) {
    d.boing = 1;
    sk.stun = STUN;
    sk.vx = sk.vz = 0; // stop on the spot
    sk.body.squash(0.7);
    this.game.audio.play('boing');
    this.puffs.burst(new THREE.Vector3(d.x, 0.7, d.z), COLORS.white, { count: 6, size: 0.25, life: 0.4 });
    this.popText(t('hideseek.boing'), d.x, d.z, '#ff8c42');
  }

  findHider(e, sk) {
    e.found = true;
    e.survived = SEEK_TIME - this.seekLeft;
    this.foundCount++;
    e.reveal = 0;
    e.revealFrom = { x: e.x, z: e.z };
    this.setDisguise(e, -1, 0);
    e.body.face(sk.x - e.x, sk.z - e.z);
    e.body.squash(1.4);
    // Pick a free seat behind the back fence.
    const taken = this.ents.filter((o) => o.seat).length;
    e.seat = { x: 1.5 + taken * 1.4, z: SEATS_Z };
    this.game.audio.play('pop');
    this.later(0.15, () => this.game.audio.play('rescue'));
    this.confetti.burst(new THREE.Vector3(e.x, 1.2, e.z), 0, { count: 40, speed: 7, up: 5, colors: [e.color, COLORS.gold, COLORS.white], life: 1.4 });
    this.puffs.burst(new THREE.Vector3(e.x, 0.6, e.z), COLORS.white, { count: 14, size: 0.4, life: 0.6 });
    this.game.ui.toast(t('hideseek.found', { name: e.name }));
    sk.body.squash(1.25);
  }

  popText(text, x, z, color) {
    const el = this.game.ui.label('label');
    el.textContent = text;
    el.style.color = color;
    const pos = new THREE.Vector3(x, 1.4, z);
    let life = 0.8;
    const tick = (dt) => {
      life -= dt;
      pos.y += dt * 1.5;
      this.game.ui.place(el, pos, this.camera);
      if (life <= 0) { el.remove(); return false; }
      return true;
    };
    (this.popTexts ||= []).push(tick);
    tick(0);
  }

  /** Found players jump out, then hop over the fence to cheer. */
  updateReveal(e, dt) {
    if (e.reveal < 0) return;
    e.reveal += dt;
    const JUMP = 0.8, FLY = 1.1;
    if (e.reveal < JUMP) {
      const k = e.reveal / JUMP;
      e.y = Math.sin(k * Math.PI) * 1.2;
      e.body.spin = k * Math.PI * 2;
    } else if (e.reveal < JUMP + FLY) {
      const k = (e.reveal - JUMP) / FLY;
      e.x = THREE.MathUtils.lerp(e.revealFrom.x, e.seat.x, k);
      e.z = THREE.MathUtils.lerp(e.revealFrom.z, e.seat.z, k);
      e.y = Math.sin(k * Math.PI) * 3.2;
      e.body.spin = 0;
      e.body.face(e.seat.x - e.revealFrom.x, e.seat.z - e.revealFrom.z);
    } else {
      e.reveal = -1;
      e.role = 'out';
      e.x = e.seat.x; e.z = e.seat.z; e.y = 0;
      e.body.face(0, 1);
      e.body.squash(0.7);
    }
  }

  updateEnt(e, dt) {
    // Small hop physics for pop-outs (safe reveals and the end).
    if (e.reveal < 0 && (e.vy || e.y > 0)) {
      e.vy -= 22 * dt;
      e.y += e.vy * dt;
      if (e.y <= 0) { e.y = 0; e.vy = 0; }
    }
    if (e.role === 'out' && e.reveal < 0 && e.seat) {
      // Cheering: bounce behind the fence.
      e.cheer += dt;
      e.y = Math.abs(Math.sin(e.cheer * 5)) * 0.45;
    }
    e.root.position.set(e.x, e.y, e.z);
    const moving = e.disguise < 0 ? Math.min(1, e.speed / SPEED) : 0;
    e.body.update(dt, { moving, grounded: e.y < 0.05 });

    // Disguised players wobble while moving (a hint!), and giggle now and then.
    if (e.disguise >= 0) {
      e.wob = (e.wob || 0) + dt * 16;
      const m = Math.min(1, e.speed / PROP_SPEED);
      e.giggle = Math.max(0, e.giggle - dt);
      const g = e.giggle > 0 ? Math.sin(e.giggle * 30) * 0.12 : 0;
      e.propWrap.rotation.set(Math.cos(e.wob) * 0.1 * m, e.propYaw + g, Math.sin(e.wob) * 0.14 * m + g);
      e.propWrap.position.y = Math.abs(Math.sin(e.wob)) * 0.07 * m + (e.giggle > 0 ? Math.sin((e.giggle / 0.6) * Math.PI) * 0.25 : 0);
    } else {
      e.propWrap.position.y = 0;
    }
  }

  updateLabels() {
    const v = new THREE.Vector3();
    for (const e of this.ents) {
      let html = '';
      const ph = this.phase;
      if (this.state === 'intro' || ph === 'card') html = e.bot ? '' : esc(e.name);
      if (e.role === 'seeker' && ph !== 'scores') {
        const sub = ph === 'hide' ? t('hideseek.counting', { n: Math.max(1, Math.ceil((this.solo ? SOLO_HIDE_TIME : HIDE_TIME) - this.hideLeft)) }) : t('hideseek.seeker');
        html = `${esc(e.name)}<small>${esc(sub)}</small>`;
      } else if (e.role === 'hider' && ph === 'hide' && !e.bot) {
        html = e.disguise >= 0 ? `${esc(e.name)}<small>${esc(t(`hideseek.prop.${PROP_KEYS[e.disguise]}`))}</small>` : esc(e.name);
      } else if (e.role === 'hider' && ph === 'reveal' && !e.found && e.disguise < 0) {
        html = `${esc(e.name)}<small>${esc(t('hideseek.safe'))}</small>`;
      } else if (e.found && e.reveal >= 0) {
        html = esc(e.name);
      } else if (e.role === 'out' && e.seat && ph !== 'scores') {
        html = esc(e.name);
      }
      if (this.state === 'results') html = '';
      if (!html) { e.label.style.display = 'none'; continue; }
      if (e.label.dataset.html !== html) { e.label.innerHTML = html; e.label.dataset.html = html; }
      e.label.style.color = e.css;
      v.set(e.x, e.y + (e.disguise >= 0 ? 1.45 : 1.65), e.z);
      this.game.ui.place(e.label, v, this.camera);
    }
  }

  updateHud() {
    if (this.state === 'results' || this.phase === 'scores' || this.phase === 'hide' || this.state === 'intro') {
      this.game.ui.setTop('');
    } else if (this.seeker) {
      const round = `<div class="pill">${t('hideseek.round', { n: this.roundIdx + 1, total: this.roundsTotal })}</div>`;
      const who = `<div class="pill"><b style="color:${this.seeker.css}">${esc(this.seeker.name)}</b> ${t('hideseek.seeker')}</div>`;
      const left = this.ents.filter((e) => e.role === 'hider' && !e.found).length;
      const clock = this.phase === 'seek' ? `<div class="pill"><span class="big-num">${Math.ceil(this.seekLeft)}</span></div>` : '';
      this.game.ui.setTop(`${round}${who}${clock}<div class="pill">${t('hideseek.hiding', { n: left })}</div>`);
    }
    this.game.ui.bar(this.players, (p) => {
      const e = this.ents.find((x) => x.p === p);
      return e ? String(e.total) : '';
    });
  }

  update(dt) {
    // Ambient: duck bobbing, decoy boings, floating texts.
    this.duck.position.set(POND.x + Math.cos(this.time * 0.4) * 1.1, 0.05 + Math.sin(this.time * 3) * 0.03, POND.z + Math.sin(this.time * 0.4) * 1.1);
    this.duck.rotation.y = -this.time * 0.4;
    for (const d of this.decoys) {
      if (d.boing <= 0) continue;
      d.boing = Math.max(0, d.boing - dt * 2.5);
      const k = Math.sin(d.boing * Math.PI * 3) * d.boing * 0.35;
      d.g.scale.set(1 + k * 0.5, 1 - k, 1 + k * 0.5);
    }
    if (this.popTexts?.length) this.popTexts = this.popTexts.filter((f) => f(dt));

    for (const e of this.ents) this.updateEnt(e, dt);
    this.updateLabels();
    if (this.updateResults(dt)) return;
    this.updateHud();
    if (this.state !== 'play') return;

    this.phaseT += dt;
    const ph = this.phase;
    if (ph === 'card') {
      if (this.phaseT >= CARD_TIME) this.startHide();
    } else if (ph === 'hide') {
      this.hideLeft -= dt;
      for (const e of this.ents) this.updateHider(e, dt);
      for (const e of this.ents) this.collide(e);
      this.separate();
      this.seeker.x = SEEKER_START.x; this.seeker.z = SEEKER_START.z;
      const n = Math.max(0, Math.ceil(this.hideLeft));
      if (this.overlayCount && n !== this.lastCount) {
        this.lastCount = n;
        this.overlayCount.textContent = String(n);
        if (n <= 3 && n > 0) this.game.audio.play('beep');
      }
      if (this.hideLeft <= 0) this.startSeek();
    } else if (ph === 'seek') {
      this.seekLeft -= dt;
      for (const e of this.ents) this.updateHider(e, dt);
      this.updateSeeker(this.seeker, dt);
      for (const e of this.ents) if (e.reveal < 0 && e.role !== 'out') this.collide(e);
      this.separate();
      for (const e of this.ents) this.updateReveal(e, dt);
      // Every ~10 s one hidden prop giggles.
      this.hintT -= dt;
      if (this.hintT <= 0) {
        this.hintT = HINT_EVERY * (0.85 + Math.random() * 0.3);
        const hidden = this.ents.filter((e) => e.role === 'hider' && !e.found);
        if (hidden.length) {
          const e = hidden[Math.floor(Math.random() * hidden.length)];
          e.giggle = 0.6;
          this.confetti.burst(new THREE.Vector3(e.x, 1.1, e.z), 0, { count: 10, speed: 2.5, up: 3, colors: [COLORS.gold, COLORS.white], life: 0.8, size: 0.12 });
          this.game.audio.play('bubble');
          this.game.ui.toast(t('hideseek.giggle'), 1400);
        }
      }
      const left = this.ents.filter((e) => e.role === 'hider' && !e.found).length;
      if (left === 0) this.endSeek(true);
      else if (this.seekLeft <= 0) { this.seekLeft = 0; this.endSeek(false); }
    } else if (ph === 'reveal') {
      for (const e of this.ents) this.updateReveal(e, dt);
      this.updateSeeker(this.seeker, dt);
      if (this.phaseT >= REVEAL_TIME && this.ents.every((e) => e.reveal < 0)) this.showScores();
    } else if (ph === 'scores') {
      const any = this.players.some((p) => this.input(p)?.aPressed);
      if ((this.phaseT > 1.5 && any) || this.phaseT > SCORES_MAX) {
        this.setPhase('wipe');
        this.game.ui.wipe(() => { if (this.game.current === this) this.nextRound(); });
      }
    }
  }

  dispose() {
    this.removeOverlay();
    super.dispose();
  }
}

