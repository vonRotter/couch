import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { MiniGame } from '../core/minigame.js';
import { Character } from '../core/character.js';
import { COLORS, PLAYER_COLORS, toon, basic, sharedGeo, faceted } from '../core/palette.js';
import { addLights, skyTexture, makeCloud, makeTree, seeded } from '../core/world.js';
import { t, addStrings } from '../core/i18n.js';
import { esc } from '../core/ui.js';
import { VotePicker, VOTES } from '../core/vote.js';

// Bean Golf: everyone putts on the same hole at the same time. Six holes on floating candy islands.

addStrings({
  en: {
    'game.golf': 'Bean Golf',
    'golf.intro': 'Everyone putts at once! Stick: aim · hold [A]: power, let go: putt · hold [B]: fine aim',
    'golf.hole': 'Hole {n}/{total}', 'golf.par': 'Par {n}',
    'golf.name.0': 'Warm-up', 'golf.name.1': 'Bumper Bend', 'golf.name.2': 'Windmill', 'golf.name.3': 'Big Jump',
    'golf.name.4': 'Block Party', 'golf.name.5': 'Loop-de-loop',
    'golf.ace': 'Hole in one!', 'golf.aceBy': '{name} did it!',
    'golf.term.-3': 'Albatross!', 'golf.term.-2': 'Eagle!', 'golf.term.-1': 'Birdie!', 'golf.term.0': 'Par!',
    'golf.term.1': 'Bogey', 'golf.term.more': '+{n}', 'golf.in': 'In!',
    'golf.hurry': 'Hurry! {n}', 'golf.oops': 'Oops! +1', 'golf.pickup': 'Picked up',
    'golf.card': 'Scorecard', 'golf.cardSub': 'After hole {n} of {total}', 'golf.final': 'Final scorecard',
    'golf.total': 'Total', 'golf.parRow': 'Par', 'golf.next': '[A]: next hole', 'golf.toResults': '[A]: results',
    'golf.win': '{name} wins!', 'golf.tie': 'It\'s a tie!', 'golf.solo.under': 'Under par!', 'golf.solo.even': 'Right on par!',
    'golf.solo.over': 'Nice round!', 'golf.sub': 'Lowest total wins · course par {par}',
    'golf.strokes': '{n} strokes', 'golf.vsPar': '{d} vs par', 'golf.even': 'even par', 'golf.aces': '{n}× hole in one',
  },
  no: {
    'game.golf': 'Bønnegolf',
    'golf.intro': 'Alle slår samtidig! Pinne: sikt · hold [A]: kraft, slipp: slå · hold [B]: finsikting',
    'golf.hole': 'Hull {n}/{total}', 'golf.par': 'Par {n}',
    'golf.name.0': 'Oppvarming', 'golf.name.1': 'Sprettsvingen', 'golf.name.2': 'Vindmølla', 'golf.name.3': 'Det store hoppet',
    'golf.name.4': 'Klosselek', 'golf.name.5': 'Loopen',
    'golf.ace': 'Rett i hullet!', 'golf.aceBy': '{name} klarte det!',
    'golf.term.-3': 'Albatross!', 'golf.term.-2': 'Ørn!', 'golf.term.-1': 'Birdie!', 'golf.term.0': 'Par!',
    'golf.term.1': 'Bogey', 'golf.term.more': '+{n}', 'golf.in': 'I hullet!',
    'golf.hurry': 'Skynd deg! {n}', 'golf.oops': 'Oi! +1', 'golf.pickup': 'Plukket opp',
    'golf.card': 'Poengkort', 'golf.cardSub': 'Etter hull {n} av {total}', 'golf.final': 'Ferdig poengkort',
    'golf.total': 'Sum', 'golf.parRow': 'Par', 'golf.next': '[A]: neste hull', 'golf.toResults': '[A]: resultater',
    'golf.win': '{name} vinner!', 'golf.tie': 'Uavgjort!', 'golf.solo.under': 'Under par!', 'golf.solo.even': 'Akkurat på par!',
    'golf.solo.over': 'Fin runde!', 'golf.sub': 'Færrest slag vinner · banens par {par}',
    'golf.strokes': '{n} slag', 'golf.vsPar': '{d} mot par', 'golf.even': 'på par', 'golf.aces': '{n}× rett i hullet',
  },
});

// ---------- tuning ----------
const BALL_R = 0.2;
const WALL_H = 0.42; // wall height above the felt
const WALL_HALF = 0.13; // half wall thickness
const G = 16; // gravity
const SLOPE_K = 0.6; // how strongly slopes pull a rolling ball
const FRIC_A = 2.6, FRIC_K = 0.25; // rolling friction: constant + speed-based
const MIN_PUTT = 0.9, MAX_PUTT = 14; // putt speed range
const CHARGE_T = 1.1; // seconds from empty to full power (the meter then swings back down)
const WALL_E = 0.62, BALL_E = 0.6, BUMP_E = 1.1;
const CUP_R = 0.36, CUP_PULL = 0.9, SINK_SPEED = 5.5;
const LOOP_G = 9; // gravity used inside the loop (gentler than the real one)
const FALL_Y = -3;
const MAX_STROKES = 8;
const HURRY_T = 25; // seconds the others get after the first ball drops
const HOLE_CAP = 150; // absolute safety limit per hole
const SUBSTEPS = 4;
const HOLE_SPACING = 70;

const clamp = THREE.MathUtils.clamp;
const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

/*
 * Holes are described in local coordinates (x right, z toward the camera, y up).
 * tiles: felt rectangles; h0/h1 make a ramp that rises along x.
 * walls: polylines [x, z, x, z, ...] (optionally { p, h } for a raised base, or { p, h0, h1 } for one sloped segment).
 * path: helper waypoints on the way to the cup (used for the default aim).
 */
const HOLES = [
  { // 1: a straight warm-up
    par: 2, felt: 0x6fd86a, cake: 0xffb3c7, stripe: [0xff6fae, COLORS.icing],
    tiles: [{ x0: -9, x1: 9, z0: -2, z1: 2 }],
    walls: [[-9, -2, 9, -2, 9, 2, -9, 2, -9, -2]],
    tee: [-7.3, 0], cup: [6.5, 0], path: [],
    decor: [['lolly', -5.5, -4.2], ['gum', -1, 4.2], ['cupcake', 4, -4.3], ['cane', 10.8, 2.6], ['tree', -11, -1.5], ['gum', 8, 4.4]],
  },
  { // 2: dogleg with bumpers
    par: 3, felt: 0x5fd69a, cake: 0xc9a8ff, stripe: [0x4cc9f0, COLORS.icing],
    tiles: [{ x0: -9, x1: 4.5, z0: 1, z1: 5 }, { x0: 0, x1: 4.5, z0: -6, z1: 1 }],
    walls: [[-9, 1, 0, 1, 0, -6, 4.5, -6, 4.5, 5, -9, 5, -9, 1]],
    bumpers: [[3.7, 4.2, 0.45], [1.0, -0.8, 0.4], [3.4, -2.6, 0.4], [-2.8, 4.2, 0.35]],
    tee: [-7.5, 3], cup: [2.2, -4.6], path: [[2.2, 2.6]],
    decor: [['tree', -5, -1.5], ['lolly', -1.5, -3.5], ['cupcake', 7, 0], ['gum', -8, 7], ['cane', 6.8, -4.5], ['tree', 7.5, 4.5]],
  },
  { // 3: the windmill
    par: 3, felt: 0x6fd86a, cake: 0xffe47a, stripe: [0xff5d73, COLORS.icing], tilt: 47,
    tiles: [{ x0: -4.5, x1: 4.5, z0: 0, z1: 7 }, { x0: -0.8, x1: 0.8, z0: -2.4, z1: 0 }, { x0: -4.5, x1: 4.5, z0: -8, z1: -2.4 }],
    walls: [[-4.5, 7, 4.5, 7, 4.5, 0, 0.8, 0, 0.8, -2.4, 4.5, -2.4, 4.5, -8, -4.5, -8, -4.5, -2.4, -0.8, -2.4, -0.8, 0, -4.5, 0, -4.5, 7]],
    windmill: { x: 0, z: 0, hy: 2.7, len: 2.45, speed: 1.0, bladeZ: 0.38 },
    tee: [0, 5.4], cup: [1.2, -6], path: [[0, 1.4], [0, -3.4]],
    decor: [['tree', -7, 4], ['lolly', 7, 3], ['cupcake', -7, -5], ['gum', 7, -6], ['cane', -7.2, -0.5], ['tree', 7.5, -1.5]],
  },
  { // 4: ramp and jump over a gap (the landing's front wall is low enough to fly over)
    par: 3, felt: 0x7ad65a, cake: 0xff9fd0, stripe: [0x9b5de5, COLORS.icing], tilt: 48,
    tiles: [{ x0: -8.5, x1: -1, z0: -2.2, z1: 2.2 }, { x0: -1, x1: 1, z0: -1.6, z1: 1.6, h0: 0, h1: 0.6 }, { x0: 2.6, x1: 10, z0: -3, z1: 3, h0: 0, h1: 0 }],
    walls: [
      [-1, -1.6, -1, -2.2, -8.5, -2.2, -8.5, 2.2, -1, 2.2, -1, 1.6],
      { p: [-1, -1.6, 1, -1.6], h0: 0, h1: 0.6 }, { p: [-1, 1.6, 1, 1.6], h0: 0, h1: 0.6 },
      { p: [2.6, -3, 2.6, 3], low: true }, [2.6, 3, 10, 3, 10, -3, 2.6, -3],
    ],
    bumpers: [[6.0, -1.0, 0.4]],
    tee: [-6.3, 0], cup: [8.3, 1.9], path: [[1, 0]],
    decor: [['lolly', -5, -4.3], ['cupcake', -5, 4.3], ['gum', 1.8, -3.6], ['tree', 12.2, -1], ['cane', 7, -5], ['gum', 1.8, 3.8]],
  },
  { // 5: sliding marshmallow blocks
    par: 3, felt: 0x5fd69a, cake: 0x8fd8ff, stripe: [0xffc93c, COLORS.icing],
    tilt: 50,
    tiles: [{ x0: -4.5, x1: 4.5, z0: -8, z1: 7 }],
    walls: [[-4.5, -8, 4.5, -8, 4.5, 7, -4.5, 7, -4.5, -8], [-1.6, -5.0, 4.5, -5.0]],
    movers: [
      { x: 0, z: 3.2, hx: 1.0, hz: 0.45, amp: 2.8, speed: 1.1, phase: 0, color: 0xff9fd0 },
      { x: 0, z: 0, hx: 1.0, hz: 0.45, amp: 2.8, speed: 1.5, phase: 2, color: 0x9ff0c8 },
      { x: 0, z: -3, hx: 1.0, hz: 0.45, amp: 2.8, speed: 0.9, phase: 4, color: 0xc9a8ff },
    ],
    tee: [0, 5.5], cup: [2.2, -6.6], path: [[-3.0, -4.2]],
    decor: [['tree', -7, 3], ['cupcake', 7, 4.5], ['lolly', -7.2, -4], ['gum', 7, -1], ['cane', 7, -6.5], ['gum', -7, 7]],
  },
  { // 6: loop-de-loop
    par: 3, felt: 0x6fd86a, cake: 0xc9a8ff, stripe: [0xff8c42, COLORS.icing], tilt: 48,
    tiles: [{ x0: -10, x1: -3, z0: -2.2, z1: 2.2 }, { x0: -3, x1: 3, z0: -0.75, z1: 0.75 }, { x0: 3, x1: 10, z0: -3.2, z1: 3.2 }],
    walls: [
      [-3, -0.75, -3, -2.2, -10, -2.2, -10, 2.2, -3, 2.2, -3, 0.75, 3, 0.75, 3, 3.2, 10, 3.2, 10, -3.2, 7, -3.2],
      [3, -3.2, 3, -0.75, -3, -0.75],
    ],
    loop: { x: 0, z: 0, r: 1.3 },
    bumpers: [[5.4, 1.5, 0.4]],
    tee: [-8, 0], cup: [7.2, -1.4], path: [[3.4, 0]],
    decor: [['lolly', -6, -4.2], ['gum', -6, 4.2], ['tree', 0, -3.6], ['cupcake', 0, 3.4], ['cane', 12, 1], ['gum', 5, -5.2]],
  },
];

/** Collects boxes/cylinders per color and merges them into one mesh each (fewer draw calls). */
class Batch {
  constructor() { this.parts = new Map(); }
  add(color, geo, pos, rot = [0, 0, 0], scale = [1, 1, 1]) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    g.applyMatrix4(new THREE.Matrix4().compose(
      new THREE.Vector3(...pos),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)),
      new THREE.Vector3(...scale)));
    if (!this.parts.has(color)) this.parts.set(color, []);
    this.parts.get(color).push(g);
  }
  build(group) {
    for (const [color, list] of this.parts) {
      const mesh = new THREE.Mesh(mergeGeometries(list), toon(color));
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
      for (const g of list) g.dispose();
    }
  }
}

const UNIT_BOX = () => sharedGeo('golfUnitBox', () => new THREE.BoxGeometry(1, 1, 1));
const UNIT_CYL = () => sharedGeo('golfUnitCyl', () => new THREE.CylinderGeometry(1, 1, 1, 16));

export class GolfScene extends MiniGame {
  constructor(game, opts) {
    super(game, opts);
    this.camera.fov = 40;
    this.scene.background = skyTexture('#8fd8ff', '#ffe3f1');
    this.lights = addLights(this.scene, { size: 17, dir: new THREE.Vector3(-0.4, 1, 0.5) });
    this.outlineMat = new THREE.MeshBasicMaterial({ color: COLORS.ink, side: THREE.BackSide });

    game.audio.playMusic('space');
    if (opts.holes) {
      this.setup(opts.holes);
    } else {
      // Vote on 3 or 6 holes first.
      this.state = 'vote';
      this.camera.position.set(0, 8, 18);
      this.camera.lookAt(0, 0, 0);
      this.picker = new VotePicker(this, {
        title: () => t('game.golf'),
        vote: VOTES.holes(HOLES.length),
        onDone: (n) => { this.picker = null; this.setup(n); },
      });
    }
  }

  /** Builds the course. opts.holes picks a shorter round: 3 plays the first three holes. */
  setup(holes) {
    this.holeCount = clamp(Math.round(holes || HOLES.length), 1, HOLES.length);
    this.course = HOLES.slice(0, this.holeCount);
    this.holes = this.course.map((def, i) => this.buildHole(def, i));
    this.buildSky();

    this.ents = this.players.map((p, i) => this.makeEnt(p, i));
    this.holeIndex = 0;
    this.phase = 'intro';
    this.camPos = new THREE.Vector3();
    this.camLook = new THREE.Vector3();
    this.setupHole(0, true);
    this.intro(t('game.golf'), t('golf.intro'));
  }

  onStart() {
    this.startHole();
  }

  /** Retry from the pause menu keeps the same round length. */
  retryOptions() {
    return { key: this.key, holes: this.holeCount };
  }

  // ---------- building ----------

  buildHole(def, index) {
    const H = { ...def, index, bumpers: def.bumpers || [], movers: def.movers || [], path: def.path || [], faders: [] };
    H.origin = new THREE.Vector3(index * HOLE_SPACING, 0, 0);
    H.tiles = def.tiles.map((tl) => ({ ...tl, h0: tl.h0 ?? 0, h1: tl.h1 ?? tl.h0 ?? 0 }));
    const group = new THREE.Group();
    group.position.copy(H.origin);
    this.scene.add(group);
    H.group = group;
    const batch = new Batch();
    const rand = seeded(17 + index * 31);

    // Felt tiles on a layer of icing and cake, with a pointy candy rock underneath.
    for (const tl of H.tiles) {
      const w = tl.x1 - tl.x0, d = tl.z1 - tl.z0, cx = (tl.x0 + tl.x1) / 2, cz = (tl.z0 + tl.z1) / 2;
      if (tl.h0 === tl.h1) {
        const h = tl.h0;
        batch.add(def.felt, UNIT_BOX(), [cx, h - 0.1, cz], [0, 0, 0], [w, 0.2, d]);
        // Soft mowing stripes.
        const n = Math.floor(w / 1.5);
        for (let s = 0; s < n; s += 2) {
          batch.add(darker(def.felt, 0.93), UNIT_BOX(), [tl.x0 + (s + 0.5) * (w / n), h + 0.004, cz], [0, 0, 0], [w / n, 0.01, d - 0.02]);
        }
        batch.add(COLORS.icing, UNIT_BOX(), [cx, h - 0.27, cz], [0, 0, 0], [w + 0.12, 0.14, d + 0.12]);
        batch.add(def.cake, UNIT_BOX(), [cx, h - 0.8, cz], [0, 0, 0], [w, 0.95, d]);
        const cones = Math.max(1, Math.round(Math.max(w, d) / 7));
        for (let k = 0; k < cones; k++) {
          const along = (k + 0.5) / cones;
          const px = w >= d ? tl.x0 + along * w : cx, pz = w >= d ? cz : tl.z0 + along * d;
          const r = Math.min(w, d) * 0.5 + 0.3;
          batch.add(darker(def.cake, 0.85), sharedGeo('golfRock', () => faceted(new THREE.ConeGeometry(1, 1, 7))),
            [px, h - 1.27 - r * 1.1, pz], [Math.PI, rand() * 6, 0], [r, r * 2.2, r]);
        }
      } else {
        // A sloped slab with candy-stick supports.
        const len = Math.hypot(w, tl.h1 - tl.h0), ang = Math.atan2(tl.h1 - tl.h0, w);
        const my = (tl.h0 + tl.h1) / 2;
        batch.add(def.felt, UNIT_BOX(), [cx, my - 0.1, cz], [0, 0, ang], [len, 0.2, d]);
        batch.add(COLORS.icing, UNIT_BOX(), [cx, my - 0.27, cz], [0, 0, ang], [len + 0.1, 0.14, d + 0.12]);
        for (const sz of [tl.z0 + 0.3, tl.z1 - 0.3]) {
          const top = tl.h1 - 0.3;
          batch.add(COLORS.icing, UNIT_CYL(), [tl.x1 - 0.3, (top - 1.2) / 2, sz], [0, 0, 0], [0.13, top + 1.2, 0.13]);
        }
      }
    }

    // Walls as candy-striped segments with round posts at the corners.
    H.segs = [];
    let stripe = 0;
    for (const wd of def.walls) {
      const pts = Array.isArray(wd) ? wd : wd.p;
      const hBase = Array.isArray(wd) ? 0 : (wd.h ?? null);
      for (let k = 0; k + 3 < pts.length; k += 2) {
        const ax = pts[k], az = pts[k + 1], bx = pts[k + 2], bz = pts[k + 3];
        const ha = hBase ?? wd.h0 ?? 0, hb = hBase ?? wd.h1 ?? 0;
        H.segs.push([ax, az, bx, bz, ha, hb, !!wd.low]);
        const L = Math.hypot(bx - ax, bz - az);
        const n = Math.max(1, Math.round(L / 1.1));
        for (let s = 0; s < n; s++) {
          const f0 = s / n, f1 = (s + 1) / n, fm = (f0 + f1) / 2;
          const px = ax + (bx - ax) * fm, pz = az + (bz - az) * fm, ph = ha + (hb - ha) * fm;
          const pitch = Math.atan2(hb - ha, L);
          batch.add(def.stripe[stripe++ % 2], UNIT_BOX(), [px, ph + WALL_H / 2 - 0.05, pz],
            [0, -Math.atan2(bz - az, bx - ax), pitch], [Math.hypot(L / n, (hb - ha) / n) + 0.01, WALL_H + 0.1, WALL_HALF * 2]);
        }
        for (const [x, z, h] of [[ax, az, ha], [bx, bz, hb]]) {
          batch.add(COLORS.icing, UNIT_CYL(), [x, h + WALL_H / 2, z], [0, 0, 0], [WALL_HALF + 0.05, WALL_H + 0.16, WALL_HALF + 0.05]);
        }
      }
    }

    // Tee mat and cup.
    H.cupH = this.groundAtHole(H, H.cup[0], H.cup[1]);
    const teeH = this.groundAtHole(H, H.tee[0], H.tee[1]);
    const mat = new THREE.Mesh(sharedGeo('golfTee', () => new RoundedBoxGeometry(2.0, 0.04, 2.0, 2, 0.02)), toon(darker(def.felt, 1.12)));
    mat.position.set(H.tee[0], teeH + 0.012, H.tee[1]);
    mat.receiveShadow = true;
    group.add(mat);
    const cup = new THREE.Mesh(sharedGeo('golfCup', () => new THREE.CircleGeometry(CUP_R, 24)), basic(COLORS.ink));
    cup.rotation.x = -Math.PI / 2;
    cup.position.set(H.cup[0], H.cupH + 0.02, H.cup[1]);
    const rim = new THREE.Mesh(sharedGeo('golfRim', () => new THREE.RingGeometry(CUP_R, CUP_R + 0.07, 24)), basic(COLORS.white));
    rim.rotation.x = -Math.PI / 2;
    rim.position.set(H.cup[0], H.cupH + 0.021, H.cup[1]);
    group.add(cup, rim);
    const flag = new THREE.Group();
    const pole = new THREE.Mesh(sharedGeo('golfPole', () => new THREE.CylinderGeometry(0.04, 0.04, 2.2, 8)), toon(COLORS.white));
    pole.position.y = 1.1;
    pole.castShadow = true;
    const cloth = new THREE.Mesh(sharedGeo('golfFlag', () => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0.9, -0.25, 0, 0, -0.5, 0], 3));
      g.computeVertexNormals();
      return g;
    }), new THREE.MeshToonMaterial({ color: 0xff5d73, gradientMap: toon(0xffffff).gradientMap, side: THREE.DoubleSide }));
    cloth.position.y = 2.15;
    cloth.castShadow = true;
    flag.add(pole, cloth);
    flag.position.set(H.cup[0], H.cupH, H.cup[1]);
    group.add(flag);
    H.flagCloth = cloth;

    // Bumpers: bouncy gumdrops.
    H.bumperMeshes = H.bumpers.map(([x, z, r], k) => {
      const b = new THREE.Group();
      const col = [0xff5d73, 0xffc93c, 0x4cc9f0, 0x9b5de5][k % 4];
      const base = new THREE.Mesh(sharedGeo('golfBumpBase', () => new THREE.CylinderGeometry(1, 1, 0.4, 20)), toon(COLORS.icing));
      base.position.y = 0.2;
      const top = new THREE.Mesh(sharedGeo('golfBumpTop', () => new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2)), toon(col));
      top.position.y = 0.38;
      top.scale.set(0.95, 0.7, 0.95);
      b.add(base, top);
      b.scale.set(r, r * 1.3, r);
      b.position.set(x, this.groundAtHole(H, x, z), z);
      b.traverse((o) => { o.castShadow = true; });
      b.userData.kick = 0;
      b.userData.r = r;
      group.add(b);
      return b;
    });

    // Moving marshmallow blocks with friendly eyes.
    H.moverMeshes = H.movers.map((m) => {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new RoundedBoxGeometry(m.hx * 2, 0.8, m.hz * 2, 3, 0.15), toon(m.color));
      body.position.y = 0.4;
      body.castShadow = true;
      g.add(body);
      for (const s of [-1, 1]) {
        const eye = new THREE.Mesh(sharedGeo('golfEye', () => new THREE.SphereGeometry(0.11, 10, 8)), toon(COLORS.white));
        eye.position.set(s * 0.25, 0.5, m.hz + 0.02);
        const pupil = new THREE.Mesh(sharedGeo('golfPupil', () => new THREE.SphereGeometry(0.06, 8, 6)), toon(COLORS.ink));
        pupil.position.set(s * 0.25, 0.48, m.hz + 0.1);
        g.add(eye, pupil);
      }
      group.add(g);
      return g;
    });

    if (H.windmill) this.buildWindmill(H, group);
    if (H.loop) this.buildLoop(H, group, batch);

    // Decorations on little floating cookie islands (they fade too if they ever hide a ball).
    for (const [type, x, z] of def.decor || []) this.makeFader(H, this.buildDecor(group, type, x, z, def.cake, rand));

    batch.build(group);

    // Framing bounds.
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const tl of H.tiles) { x0 = Math.min(x0, tl.x0); x1 = Math.max(x1, tl.x1); z0 = Math.min(z0, tl.z0); z1 = Math.max(z1, tl.z1); }
    H.bounds = { x0, x1, z0, z1, top: H.windmill ? 4.6 : H.loop ? 3.0 : 1.2 };
    return H;
  }

  buildWindmill(H, group) {
    const W = H.windmill;
    const mill = new THREE.Group();
    mill.position.set(W.x, 0, W.z);
    const body = new THREE.Mesh(new RoundedBoxGeometry(3.2, 2.7, 2.4, 2, 0.12), toon(COLORS.cream));
    body.position.set(0, 1.35, -1.2);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(2.4, 1.7, 4), toon(0xff6fae));
    roof.rotation.y = Math.PI / 4;
    roof.scale.z = 0.8;
    roof.position.set(0, 3.55, -1.2);
    const door = new THREE.Mesh(new RoundedBoxGeometry(1.6, 1.0, 0.1, 2, 0.04), toon(COLORS.ink));
    door.position.set(0, 0.5, 0.02);
    const window1 = new THREE.Mesh(sharedGeo('golfWin', () => new THREE.CircleGeometry(0.3, 16)), toon(0x8fd8ff));
    window1.position.set(0.95, 1.9, 0.01);
    for (const m of [body, roof]) { m.castShadow = true; m.receiveShadow = true; }
    mill.add(body, roof, door, window1);
    const hub = new THREE.Group();
    hub.position.set(0, W.hy, W.bladeZ);
    const cap = new THREE.Mesh(sharedGeo('golfHub', () => new THREE.SphereGeometry(0.28, 14, 10)), toon(COLORS.gold));
    hub.add(cap);
    W.blades = [];
    for (let i = 0; i < 4; i++) {
      const arm = new THREE.Group();
      const blade = new THREE.Mesh(sharedGeo('golfBlade', () => new RoundedBoxGeometry(0.5, W.len - 0.3, 0.08, 2, 0.03)), toon(i % 2 ? 0xff5d73 : COLORS.icing));
      blade.position.y = -(W.len + 0.3) / 2;
      blade.castShadow = true;
      arm.add(blade);
      hub.add(arm);
      W.blades.push(arm);
    }
    mill.add(hub);
    group.add(mill);
    // The mill hides the far half of the hole: it fades out whenever a ball or bean is behind it.
    this.makeFader(H, mill, W.len * 0.7);
  }

  /**
   * Lets a tall object fade out while it stands between the camera and a ball or bean.
   * Uses its own cloned materials, so the shared toon materials are never touched.
   */
  makeFader(H, obj, pad = 0.1) {
    const mats = [];
    obj.traverse((o) => {
      if (!o.isMesh) return;
      const m = o.material.clone();
      m.userData = {};
      m.transparent = true;
      o.material = m;
      mats.push(m);
    });
    obj.updateWorldMatrix(true, true);
    const box = new THREE.Box3().setFromObject(obj);
    box.min.x -= pad; box.max.x += pad;
    H.faders.push({ mats, box, opacity: 1 });
  }

  buildLoop(H, group, batch) {
    const L = H.loop;
    const h = this.groundAtHole(H, L.x, L.z);
    const cy = h + BALL_R + L.r;
    const tor = sharedGeo(`golfLoop${L.r}`, () => new THREE.TorusGeometry(L.r + BALL_R + 0.03, 0.07, 8, 40));
    const rails = new THREE.Group();
    for (const s of [-1, 1]) {
      const rail = new THREE.Mesh(tor, toon(0xff8c42));
      rail.position.set(L.x, cy, L.z + s * 0.36);
      rail.castShadow = true;
      rails.add(rail);
    }
    group.add(rails);
    this.makeFader(H, rails);
    // Cross ties around the loop and two posts.
    for (let k = 1; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      const rr = L.r + BALL_R + 0.03;
      batch.add(COLORS.icing, UNIT_CYL(), [L.x + Math.sin(a) * rr, cy - Math.cos(a) * rr, L.z], [Math.PI / 2, 0, 0], [0.05, 0.78, 0.05]);
    }
    for (const s of [-1, 1]) batch.add(COLORS.icing, UNIT_CYL(), [L.x, cy / 2, L.z + s * 0.6], [0, 0, 0], [0.07, cy, 0.07]);
  }

  buildDecor(group, type, x, z, cake, rand) {
    const g = new THREE.Group();
    g.position.set(x, -0.15, z);
    const pad = new THREE.Mesh(sharedGeo('golfPad', () => new THREE.CylinderGeometry(1.05, 0.8, 0.5, 18)), toon(cake));
    pad.position.y = -0.25;
    const icing = new THREE.Mesh(sharedGeo('golfPadTop', () => new THREE.CylinderGeometry(1.1, 1.1, 0.12, 18)), toon(COLORS.icing));
    icing.position.y = 0;
    const rock = new THREE.Mesh(sharedGeo('golfPadRock', () => faceted(new THREE.ConeGeometry(0.8, 1.6, 6))), toon(darker(cake, 0.85)));
    rock.rotation.x = Math.PI;
    rock.position.y = -1.3;
    g.add(pad, icing, rock);
    const add = (geo, color, px, py, pz) => {
      const m = new THREE.Mesh(geo, toon(color));
      m.position.set(px, py, pz);
      m.castShadow = true;
      g.add(m);
      return m;
    };
    if (type === 'lolly') {
      add(sharedGeo('golfStick', () => new THREE.CylinderGeometry(0.06, 0.06, 1.6, 8)), COLORS.icing, 0, 0.8, 0);
      const disc = add(sharedGeo('golfLolly', () => new THREE.CylinderGeometry(0.6, 0.6, 0.16, 24)), [0xff6fae, 0x4cc9f0, 0xffc93c][Math.floor(rand() * 3)], 0, 1.9, 0);
      disc.rotation.x = Math.PI / 2;
      const swirl = add(sharedGeo('golfSwirl', () => new THREE.TorusGeometry(0.34, 0.07, 6, 20)), COLORS.icing, 0, 1.9, 0.09);
      swirl.scale.z = 0.5;
    } else if (type === 'gum') {
      const col = [0xff5d73, 0x3ddc97, 0xffc93c, 0x9b5de5][Math.floor(rand() * 4)];
      const d = add(sharedGeo('golfGum', () => new THREE.SphereGeometry(0.6, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2)), col, 0, 0.05, 0);
      d.scale.set(1, 1.3, 1);
      const d2 = add(sharedGeo('golfGum', () => null), [0x4cc9f0, 0xff8c42][Math.floor(rand() * 2)], 0.55, 0.05, 0.3);
      d2.scale.set(0.6, 0.8, 0.6);
    } else if (type === 'cupcake') {
      add(sharedGeo('golfWrap', () => new THREE.CylinderGeometry(0.55, 0.4, 0.6, 14)), 0x8fd8ff, 0, 0.35, 0);
      const top = add(sharedGeo('golfFrost', () => new THREE.SphereGeometry(0.6, 16, 10)), 0xffd6ea, 0, 0.75, 0);
      top.scale.set(1, 0.7, 1);
      add(sharedGeo('golfCherry', () => new THREE.SphereGeometry(0.16, 10, 8)), 0xff3b5c, 0, 1.25, 0);
    } else if (type === 'cane') {
      for (let k = 0; k < 6; k++) add(sharedGeo('golfCane', () => new THREE.CylinderGeometry(0.11, 0.11, 0.3, 10)), k % 2 ? COLORS.icing : 0xff3b5c, 0, 0.15 + k * 0.3, 0);
      const hook = add(sharedGeo('golfHook', () => new THREE.TorusGeometry(0.3, 0.11, 8, 16, Math.PI)), 0xff3b5c, 0.3, 1.8, 0);
      hook.rotation.z = 0;
    } else if (type === 'tree') {
      const tr = makeTree(rand, 0.75, [0xff9fd0, 0xc9a8ff, 0xffe47a]);
      tr.position.y = 0.05;
      g.add(tr);
    }
    group.add(g);
    return g;
  }

  buildSky() {
    const rand = seeded(9);
    for (let i = 0; i < 26; i++) {
      const c = makeCloud(rand, 2 + rand() * 2.5);
      c.position.set(-30 + rand() * (HOLE_SPACING * this.holeCount + 30), -16 - rand() * 10, -40 + rand() * 34);
      this.scene.add(c);
    }
  }

  makeEnt(p, i) {
    const ch = new Character(p.color, { hat: p.hat });
    ch.group.scale.setScalar(0.62);
    this.scene.add(ch.group);
    // Putter: pivots at the hands, head rests behind the ball.
    const putter = new THREE.Group();
    putter.position.set(0.22, 0.62, 0.36);
    const head = new THREE.Vector3(-0.22, -0.55, 0.27);
    const shaft = new THREE.Mesh(sharedGeo('golfShaft', () => new THREE.CylinderGeometry(0.035, 0.035, 1, 6)), toon(0xbfc6d6));
    shaft.scale.y = head.length();
    shaft.position.copy(head).multiplyScalar(0.5);
    shaft.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), head.clone().normalize());
    const club = new THREE.Mesh(sharedGeo('golfClub', () => new RoundedBoxGeometry(0.36, 0.12, 0.12, 2, 0.04)), toon(p.color));
    club.position.copy(head);
    putter.add(shaft, club);
    ch.group.add(putter);

    const mesh = new THREE.Mesh(sharedGeo('golfBall', () => new THREE.SphereGeometry(BALL_R, 20, 14)), toon(p.color));
    mesh.castShadow = true;
    const outline = new THREE.Mesh(sharedGeo('golfBall', () => null), this.outlineMat);
    outline.scale.setScalar(1.16);
    mesh.add(outline);
    // X-ray ghost: only drawn where something stands in front of the ball (GreaterDepth),
    // so a ball behind a wall, a tree or the windmill still shows as a bright see-through dot.
    const ghost = new THREE.Mesh(sharedGeo('golfBall', () => null), new THREE.MeshBasicMaterial({
      color: p.color, transparent: true, opacity: 0.75, depthWrite: false, depthFunc: THREE.GreaterDepth,
    }));
    ghost.scale.setScalar(1.35);
    ghost.renderOrder = 20;
    mesh.add(ghost);
    this.scene.add(mesh);

    const ring = new THREE.Mesh(sharedGeo('golfReady', () => new THREE.RingGeometry(0.3, 0.4, 24)), basic(p.color));
    ring.rotation.x = -Math.PI / 2;
    this.scene.add(ring);

    const dots = [];
    for (let k = 0; k < 18; k++) {
      const d = new THREE.Mesh(sharedGeo('golfDot', () => new THREE.SphereGeometry(0.06, 8, 6)), toon(p.color));
      this.scene.add(d);
      dots.push(d);
    }

    const meter = this.game.ui.label('label');
    meter.innerHTML = `<div style="width:66px;height:14px;border-radius:9px;background:#fff;border:3px solid ${p.css};overflow:hidden;box-shadow:0 3px 0 rgba(43,35,64,.25)"><div style="height:100%;width:0%;background:linear-gradient(90deg,#3ddc97,#ffc93c,#ff5d73);background-size:60px 100%"></div></div>`;
    meter.style.display = 'none';
    const pop = this.game.ui.label('label');
    pop.style.color = p.css;
    pop.style.display = 'none';

    return {
      p, i, ch, putter, mesh, ring, dots, meter, meterFill: meter.firstChild.firstChild, pop, popT: 0,
      ball: { x: 0, z: 0, y: 0, vx: 0, vz: 0, vy: 0, grounded: true, state: 'ready', loop: null, loopCd: 0, still: 0, rollT: 0 },
      aim: 0, holdT: 0, charging: false, power: 0, pdir: 1, swing: 0, swingT: 0,
      strokes: 0, scores: [], aces: 0, lastSpot: { x: 0, z: 0 }, sndT: 0,
      bean: { x: 0, z: 0, y: 0, hopT: -1, fx: 0, fz: 0, tx: 0, tz: 0 }, cheer: 0,
    };
  }

  // ---------- course queries ----------

  groundAtHole(H, x, z) {
    for (const tl of H.tiles) {
      if (x >= tl.x0 && x <= tl.x1 && z >= tl.z0 && z <= tl.z1) return tl.h0 + (tl.h1 - tl.h0) * (x - tl.x0) / (tl.x1 - tl.x0);
    }
    return null;
  }

  groundAt(x, z) {
    return this.groundAtHole(this.hole, x, z);
  }

  slopeAt(x, z) {
    for (const tl of this.hole.tiles) {
      if (x >= tl.x0 && x <= tl.x1 && z >= tl.z0 && z <= tl.z1) return (tl.h1 - tl.h0) / (tl.x1 - tl.x0);
    }
    return 0;
  }

  /** True if the straight line between two points crosses no wall. */
  clearLine(ax, az, bx, bz) {
    // Check the center line and both edges of the ball's path.
    const L = Math.hypot(bx - ax, bz - az) || 1;
    const ox = (-(bz - az) / L) * BALL_R, oz = ((bx - ax) / L) * BALL_R;
    for (const k of [0, 1, -1]) {
      for (const [cx, cz, dx, dz] of this.hole.segs) {
        if (segCross(ax + ox * k, az + oz * k, bx + ox * k, bz + oz * k, cx, cz, dx, dz)) return false;
      }
    }
    // Bumpers in the way count too.
    for (const [x, z, r] of this.hole.bumpers) {
      const k = clamp(((x - ax) * (bx - ax) + (z - az) * (bz - az)) / (L * L), 0, 1);
      if (Math.hypot(ax + (bx - ax) * k - x, az + (bz - az) * k - z) < r + BALL_R) return false;
    }
    return true;
  }

  /** Rough distance still to travel: through the waypoints, from the furthest one in sight. */
  pathDist(x, z) {
    const H = this.hole;
    const pts = [...H.path, H.cup];
    let rest = 0;
    let best = Infinity;
    for (let i = pts.length - 1; i >= 0; i--) {
      if (i < pts.length - 1) rest += Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
      if (this.clearLine(x, z, pts[i][0], pts[i][1])) best = Math.min(best, Math.hypot(pts[i][0] - x, pts[i][1] - z) + rest);
    }
    if (best === Infinity) best = Math.hypot(pts[0][0] - x, pts[0][1] - z) + rest + 5;
    return best;
  }

  /** Default aim: toward the furthest waypoint (or the cup) that is in sight. */
  autoAim(x, z) {
    const H = this.hole;
    const pts = [...H.path, H.cup];
    for (let i = pts.length - 1; i >= 0; i--) {
      if (this.clearLine(x, z, pts[i][0], pts[i][1])) return Math.atan2(pts[i][1] - z, pts[i][0] - x);
    }
    return Math.atan2(pts[0][1] - z, pts[0][0] - x);
  }

  moverAt(m, time) {
    const ph = time * m.speed + m.phase;
    return { x: m.x + Math.sin(ph) * m.amp, z: m.z, vx: Math.cos(ph) * m.speed * m.amp, vz: 0 };
  }

  /** The windmill blades that currently reach down to ball height, as moving boxes. */
  bladeBoxes(time) {
    const W = this.hole.windmill;
    const out = [];
    if (!W) return out;
    const lim = (W.hy - 0.45) / W.len;
    for (let i = 0; i < 4; i++) {
      const phi = wrapAngle(W.speed * time + (i * Math.PI) / 2);
      const c = Math.cos(phi);
      if (c < lim) continue;
      const arm = W.hy - 0.25;
      out.push({
        x: W.x + arm * Math.tan(phi), z: W.z + W.bladeZ, hx: 0.27 / c, hz: 0.12,
        vx: clamp((arm * W.speed) / (c * c), -8, 8), vz: 0,
      });
    }
    return out;
  }

  // ---------- ball physics ----------

  /** Advance one ball by dt. Pure apart from fx(type, ball, strength) callbacks, so it can also run ghost shots. */
  stepBall(b, dt, time, fx) {
    const H = this.hole;
    if (b.loop) { this.stepLoop(b, dt, fx); return; }
    if (b.loopCd > 0) b.loopCd -= dt;
    const h0 = this.groundAt(b.x, b.z);
    if (b.grounded && h0 !== null) {
      b.vx -= G * SLOPE_K * this.slopeAt(b.x, b.z) * dt;
      const sp = Math.hypot(b.vx, b.vz);
      const dec = (FRIC_A + FRIC_K * sp) * dt;
      if (sp <= dec) { b.vx = 0; b.vz = 0; } else { b.vx *= (sp - dec) / sp; b.vz *= (sp - dec) / sp; }
      // The cup: drop in when slow enough, and gently pull slow balls that pass close by.
      const cx = H.cup[0] - b.x, cz = H.cup[1] - b.z, cd = Math.hypot(cx, cz);
      if (cd < CUP_PULL && Math.abs(h0 - H.cupH) < 0.05) {
        const s2 = Math.hypot(b.vx, b.vz);
        if (cd < CUP_R && s2 < SINK_SPEED) { b.event = 'sunk'; return; }
        if (s2 < 3.5 && cd > 1e-3) {
          const k = (5 * (1 - cd / CUP_PULL) * dt) / cd;
          b.vx += cx * k; b.vz += cz * k;
        }
      }
    }
    const px = b.x;
    let nx = b.x + b.vx * dt, nz = b.z + b.vz * dt;
    const vyN = b.vy - G * dt, yP = b.y + vyN * dt;
    const hN = this.groundAt(nx, nz);
    if (hN !== null && b.y < hN - 0.25) {
      // Bumped into the side of an island from below: bounce back and keep falling.
      nx = b.x; nz = b.z;
      b.vx *= -0.4; b.vz *= -0.4;
      b.vy = vyN; b.y = yP; b.grounded = false;
    } else if (hN !== null && yP <= hN) {
      if (!b.grounded && vyN < -2.5) {
        b.vy = -vyN * 0.35; b.vx *= 0.9; b.vz *= 0.9;
        b.grounded = false;
        fx?.('land', b, -vyN);
      } else {
        b.vy = (hN - b.y) / dt;
        b.grounded = true;
      }
      b.y = hN;
    } else {
      b.vy = vyN; b.y = yP; b.grounded = false;
    }
    b.x = nx; b.z = nz;
    if (b.y > -0.25) this.collide(b, time, fx);
    if (b.y < FALL_Y || Math.abs(b.x) > 40 || Math.abs(b.z) > 40) { b.event = 'fell'; return; }
    // Loop entry: rolling forward across the bottom of the loop.
    const L = H.loop;
    if (L && b.grounded && b.loopCd <= 0 && px < L.x && b.x >= L.x && b.vx > 0 && Math.abs(b.z - L.z) < 0.8) {
      b.loop = { th: 0.0001, w: b.vx / L.r };
      b.x = L.x;
      fx?.('loop', b, b.vx);
    }
  }

  stepLoop(b, dt, fx) {
    const L = this.hole.loop, lp = b.loop;
    const h = this.groundAt(L.x, L.z);
    // A pendulum around the loop: fast balls go all the way, slow ones roll back out.
    lp.w += -(LOOP_G / L.r) * Math.sin(lp.th) * dt;
    lp.w *= 1 - 0.1 * dt;
    lp.th += lp.w * dt;
    b.z += (L.z - b.z) * Math.min(1, dt * 10);
    if (lp.th >= Math.PI * 2 || lp.th <= 0) {
      const fwd = lp.th > 0;
      b.loop = null;
      b.x = L.x + (fwd ? 0.01 : -0.01);
      b.vx = L.r * lp.w; b.vz = 0; b.vy = 0;
      b.y = h; b.grounded = true;
      b.loopCd = 0.4;
      if (fwd) fx?.('loopDone', b, b.vx);
      return;
    }
    b.x = L.x + L.r * Math.sin(lp.th);
    b.y = h + L.r * (1 - Math.cos(lp.th));
    b.vx = L.r * lp.w * Math.cos(lp.th);
    b.vy = L.r * lp.w * Math.sin(lp.th);
  }

  collide(b, time, fx) {
    const H = this.hole;
    const rr = BALL_R + WALL_HALF;
    for (const [ax, az, bx, bz, ha, hb] of H.segs) {
      const ex = bx - ax, ez = bz - az;
      const k = clamp(((b.x - ax) * ex + (b.z - az) * ez) / (ex * ex + ez * ez), 0, 1);
      if (b.y > ha + (hb - ha) * k + WALL_H - 0.05) continue; // flying over the wall
      const cx = ax + ex * k, cz = az + ez * k;
      const dx = b.x - cx, dz = b.z - cz, d = Math.hypot(dx, dz);
      if (d >= rr || d < 1e-6) continue;
      const nx = dx / d, nz = dz / d;
      b.x = cx + nx * rr; b.z = cz + nz * rr;
      const vn = b.vx * nx + b.vz * nz;
      if (vn < 0) { b.vx -= (1 + WALL_E) * vn * nx; b.vz -= (1 + WALL_E) * vn * nz; fx?.('wall', b, -vn); }
    }
    H.bumpers.forEach(([x, z, r], i) => {
      const dx = b.x - x, dz = b.z - z, d = Math.hypot(dx, dz);
      if (d >= r + BALL_R || d < 1e-6) return;
      const nx = dx / d, nz = dz / d;
      b.x = x + nx * (r + BALL_R); b.z = z + nz * (r + BALL_R);
      const vn = b.vx * nx + b.vz * nz;
      if (vn < 0) {
        b.vx -= (1 + BUMP_E) * vn * nx; b.vz -= (1 + BUMP_E) * vn * nz;
        // Always leave with a little pop.
        const out = b.vx * nx + b.vz * nz;
        if (out < 2.5) { b.vx += (2.5 - out) * nx; b.vz += (2.5 - out) * nz; }
        fx?.('bump', b, -vn, i);
      }
    });
    for (const m of H.movers) {
      const s = this.moverAt(m, time);
      this.boxHit(b, s.x, s.z, m.hx, m.hz, s.vx, s.vz, fx);
    }
    for (const bl of this.bladeBoxes(time)) this.boxHit(b, bl.x, bl.z, bl.hx, bl.hz, bl.vx, bl.vz, fx);
  }

  /** Ball against a (possibly moving) axis-aligned box. */
  boxHit(b, cx, cz, hx, hz, vx, vz, fx) {
    const qx = clamp(b.x, cx - hx, cx + hx), qz = clamp(b.z, cz - hz, cz + hz);
    const dx = b.x - qx, dz = b.z - qz, d = Math.hypot(dx, dz);
    let nx, nz;
    if (d < 1e-6) {
      // Center inside: push out along the shallow side.
      const ox = hx - Math.abs(b.x - cx), oz = hz - Math.abs(b.z - cz);
      if (ox < oz) { nx = Math.sign(b.x - cx) || 1; nz = 0; b.x = cx + nx * (hx + BALL_R); }
      else { nx = 0; nz = Math.sign(b.z - cz) || 1; b.z = cz + nz * (hz + BALL_R); }
    } else if (d < BALL_R) {
      nx = dx / d; nz = dz / d;
      b.x = qx + nx * BALL_R; b.z = qz + nz * BALL_R;
    } else return;
    const rvx = b.vx - vx, rvz = b.vz - vz, vn = rvx * nx + rvz * nz;
    if (vn < 0) {
      b.vx -= (1 + WALL_E) * vn * nx; b.vz -= (1 + WALL_E) * vn * nz;
      fx?.('wall', b, -vn);
    }
  }

  /** Soft bumps between balls that are on the course. */
  ballContacts() {
    const list = this.ents.filter((e) => (e.ball.state === 'ready' || e.ball.state === 'roll') && !e.ball.loop && e.ball.y > -0.25);
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i].ball, c = list[j].ball;
        if (Math.abs(a.y - c.y) > 0.35) continue;
        const dx = c.x - a.x, dz = c.z - a.z, d = Math.hypot(dx, dz);
        if (d >= BALL_R * 2 || d < 1e-5) continue;
        const nx = dx / d, nz = dz / d, push = (BALL_R * 2 - d) / 2;
        a.x -= nx * push; a.z -= nz * push;
        c.x += nx * push; c.z += nz * push;
        const rel = (a.vx - c.vx) * nx + (a.vz - c.vz) * nz;
        if (rel > 0) {
          const j2 = rel * (1 + BALL_E) / 2;
          a.vx -= nx * j2; a.vz -= nz * j2;
          c.vx += nx * j2; c.vz += nz * j2;
          if (rel > 1) this.sound(list[i], 'bump');
        }
      }
    }
  }

  /**
   * Plays a shot with a ghost copy of the ball (ignores other balls) and reports where it ends.
   * Used by the test brain; handy for a future bot too.
   */
  simulateShot(e, angle, power, tOffset = 0, maxT = 12) {
    const b = { ...e.ball, loop: null, event: null, grounded: true, vy: 0 };
    const sp = MIN_PUTT + power * (MAX_PUTT - MIN_PUTT);
    b.vx = Math.cos(angle) * sp; b.vz = Math.sin(angle) * sp;
    const dt = 1 / 60 / SUBSTEPS;
    let time = this.time + tOffset, still = 0;
    for (let tt = 0; tt < maxT; tt += dt) {
      this.stepBall(b, dt, time, null);
      time += dt;
      if (b.event === 'sunk') return { sunk: true, t: tt, x: this.hole.cup[0], z: this.hole.cup[1] };
      if (b.event === 'fell') return { fell: true, t: tt, x: b.x, z: b.z };
      if (!b.loop && b.grounded && Math.hypot(b.vx, b.vz) < 0.15 && Math.abs(this.slopeAt(b.x, b.z)) < 0.05) {
        still += dt;
        if (still > 0.2) break;
      } else still = 0;
    }
    return { x: b.x, z: b.z, t: maxT };
  }

  // ---------- hole flow ----------

  setupHole(index, snap = false) {
    this.holeIndex = index;
    this.hole = this.holes[index];
    const H = this.hole;
    this.hurry = -1;
    this.holeT = 0;
    this.endT = -1;
    // Spread the tee shots across the tee, perpendicular to the first aim.
    const aim0 = Math.atan2(([...H.path, H.cup][0][1]) - H.tee[1], ([...H.path, H.cup][0][0]) - H.tee[0]);
    const n = this.ents.length;
    const px = -Math.sin(aim0), pz = Math.cos(aim0);
    this.ents.forEach((e, k) => {
      const off = (k - (n - 1) / 2) * 0.62;
      const b = e.ball;
      Object.assign(b, { x: H.tee[0] + px * off, z: H.tee[1] + pz * off, vx: 0, vz: 0, vy: 0, grounded: true, state: 'ready', loop: null, loopCd: 0, still: 0, rollT: 0, event: null });
      b.y = this.groundAt(b.x, b.z) ?? 0;
      e.strokes = 0;
      e.charging = false;
      e.power = 0;
      e.lastSpot = { x: b.x, z: b.z };
      e.aim = this.autoAim(b.x, b.z);
      e.mesh.visible = true;
      const bx = b.x - Math.cos(e.aim) * 0.62, bz = b.z - Math.sin(e.aim) * 0.62;
      Object.assign(e.bean, { x: bx, z: bz, y: b.y, hopT: -1 });
    });
    // Sun follows the hole.
    const o = H.origin;
    this.lights.sun.position.copy(o).add(new THREE.Vector3(-0.4, 1, 0.5).normalize().multiplyScalar(40));
    this.lights.sun.target.position.copy(o);
    this.frame();
    if (snap) { this.camPos.copy(this.camGoal); this.camLook.copy(this.lookGoal); }
  }

  startHole() {
    this.phase = 'play';
    const H = this.hole;
    // On the first hole, wait for the countdown's "Go!" to clear.
    this.later(H.index === 0 ? 0.75 : 0, () => this.game.ui.banner(`${t('golf.hole', { n: H.index + 1, total: this.holeCount })}: ${t(`golf.name.${H.index}`)}`, t('golf.par', { n: H.par }), 1500));
  }

  frame() {
    const H = this.hole;
    if (!H) return;
    const tilt = THREE.MathUtils.degToRad(H.tilt || 56);
    const { x0, x1, z0, z1, top } = H.bounds;
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const w = x1 - x0 + 2.5, d = z1 - z0;
    const dist = this.fitDistance(w, d * Math.sin(tilt) + top * Math.cos(tilt) + 3.4);
    this.lookGoal = new THREE.Vector3(cx, top * 0.25, cz + 0.4 + d * 0.06).add(H.origin);
    this.camGoal = this.lookGoal.clone().add(new THREE.Vector3(0, Math.sin(tilt) * dist, Math.cos(tilt) * dist));
    this.confettiOrigin = H.origin.clone().add(new THREE.Vector3(cx, 3, cz));
  }

  resize(w, h) {
    super.resize(w, h);
    this.frame();
    if (this.camGoal && this.phase !== 'pan') { this.camPos.copy(this.camGoal); this.camLook.copy(this.lookGoal); }
  }

  putt(e) {
    const b = e.ball;
    const sp = MIN_PUTT + e.power * (MAX_PUTT - MIN_PUTT);
    b.vx = Math.cos(e.aim) * sp; b.vz = Math.sin(e.aim) * sp;
    b.state = 'roll'; b.still = 0; b.rollT = 0;
    e.lastSpot = { x: b.x, z: b.z };
    e.strokes++;
    e.charging = false;
    e.swingT = 0.5;
    e.ch.squash(0.8);
    this.game.audio.play('bump');
  }

  sink(e) {
    const H = this.hole, b = e.ball;
    b.state = 'sink';
    b.sinkT = 0;
    b.sx = b.x; b.sz = b.z; b.sy = b.y;
    b.vx = b.vz = b.vy = 0;
    e.score = Math.min(e.strokes, MAX_STROKES);
    const cupW = H.origin.clone().add(new THREE.Vector3(H.cup[0], H.cupH + 0.4, H.cup[1]));
    if (e.strokes === 1) {
      e.aces++;
      this.game.audio.play('fanfare');
      this.game.audio.play('star');
      this.game.ui.banner(t('golf.ace'), t('golf.aceBy', { name: e.p.name }), 2200);
      const colors = PLAYER_COLORS.map((c) => c.hex).concat(COLORS.gold);
      this.confetti.burst(cupW, 0, { count: 120, speed: 9, up: 8, colors, life: 2, gravity: -9, size: 0.2 });
    } else {
      this.game.audio.play('coin');
      this.confetti.burst(cupW, 0, { count: 24, speed: 4, up: 4, colors: [e.p.color, COLORS.gold, COLORS.white], life: 1.1, size: 0.14 });
      const diff = e.strokes - H.par;
      this.showPop(e, diff >= 2 ? t('golf.term.more', { n: diff }) : t(`golf.term.${Math.max(-3, diff)}`), cupW);
    }
    this.startHurry(e);
  }

  /** Once the first ball is in, everyone else gets HURRY_T seconds. */
  startHurry(e) {
    if (this.hurry < 0 && this.ents.some((o) => o !== e && o.ball.state !== 'in' && o.ball.state !== 'sink')) {
      this.hurry = HURRY_T;
    }
  }

  /** Puts a ball in for the player (max strokes, or the hurry timer ran out). */
  pickUp(e) {
    const H = this.hole, b = e.ball;
    this.puffs.burst(this.worldPos(b.x, b.y + 0.3, b.z), e.p.color, { count: 10, size: 0.4 });
    e.strokes = MAX_STROKES;
    b.loop = null;
    b.state = 'sink';
    b.sinkT = 0;
    b.sx = H.cup[0]; b.sz = H.cup[1]; b.sy = H.cupH + 1.2;
    b.x = H.cup[0]; b.z = H.cup[1];
    e.score = MAX_STROKES;
    e.charging = false;
    this.game.audio.play('pop');
    this.showPop(e, t('golf.pickup'), H.origin.clone().add(new THREE.Vector3(H.cup[0], H.cupH + 0.6, H.cup[1])));
    if (this.hurry === -1) this.startHurry(e);
  }

  fellOff(e) {
    const b = e.ball;
    e.strokes++;
    this.game.audio.play('splat');
    if (e.strokes >= MAX_STROKES) { this.pickUp(e); return; }
    Object.assign(b, { x: e.lastSpot.x, z: e.lastSpot.z, vx: 0, vz: 0, vy: 0, grounded: true, loop: null, state: 'ready', event: null, still: 0 });
    b.y = this.groundAt(b.x, b.z) ?? 0;
    e.aim = this.autoAim(b.x, b.z);
    this.puffs.burst(this.worldPos(b.x, b.y + 0.3, b.z), e.p.color, { count: 10, size: 0.35 });
    this.game.audio.play('bubble');
    this.showPop(e, t('golf.oops'), this.worldPos(b.x, b.y + 0.9, b.z));
  }

  showPop(e, text, pos) {
    e.pop.textContent = text;
    e.pop.style.display = '';
    e.popT = 1.4;
    e.popPos = pos.clone();
  }

  endHole() {
    this.phase = 'card';
    for (const e of this.ents) e.scores[this.holeIndex] = e.score ?? MAX_STROKES;
    this.cardT = 0;
    this.renderCard();
    this.game.audio.play('select');
  }

  renderCard() {
    const last = this.holeIndex === this.holeCount - 1;
    const big = this.ents.length > 3;
    const cell = `padding:${big ? 2 : 4}px 8px;border-radius:10px;min-width:1.8em;text-align:center`;
    const head = this.course.map((_, i) => `<th style="${cell}">${i + 1}</th>`).join('');
    const pars = this.course.map((h) => `<td style="${cell}">${h.par}</td>`).join('');
    const parTotal = this.course.reduce((s, h) => s + h.par, 0);
    const rows = this.ents.map((e) => {
      const cells = this.course.map((h, i) => {
        const s = e.scores[i];
        if (s === undefined) return `<td style="${cell};opacity:.3">·</td>`;
        const bg = s === 1 ? '#ffd23f' : s < h.par ? '#9ff0c8' : s === h.par ? '#f1ecff' : '#ffe0e8';
        return `<td style="${cell};background:${bg}">${s}</td>`;
      }).join('');
      return `<tr><td style="padding:2px 10px;text-align:left;white-space:nowrap"><span style="display:inline-block;width:.9em;height:.9em;border-radius:50%;background:${e.p.css};margin-right:6px;vertical-align:-1px"></span>${esc(e.p.name)}</td>${cells}<td style="${cell};color:#9b5de5">${this.total(e)}</td></tr>`;
    }).join('');
    const html = `<div class="results-title" style="font-size:clamp(28px,4vw,60px)">${last ? t('golf.final') : t('golf.card')}</div>
      <div class="results-sub">${t('golf.cardSub', { n: this.holeIndex + 1, total: this.holeCount })}</div>
      <table style="margin:${big ? 8 : 14}px auto ${big ? 6 : 10}px;border-collapse:separate;border-spacing:4px 3px;font-weight:700;font-size:${big ? 'clamp(13px,1.4vw,22px)' : 'clamp(14px,1.7vw,26px)'}">
        <tr><th></th>${head}<th style="${cell}">${t('golf.total')}</th></tr>
        <tr style="opacity:.6"><td style="padding:4px 10px;text-align:left">${t('golf.parRow')}</td>${pars}<td style="${cell}">${parTotal}</td></tr>
        ${rows}
      </table>
      <div class="results-footer"><span class="blink">${last ? t('golf.toResults') : t('golf.next')}</span></div>`;
    if (!this.cardEl) this.cardEl = this.game.ui.panel(html, 'panel');
    else this.cardEl.innerHTML = html;
  }

  onLanguage() {
    this.picker?.render();
    if (this.cardEl) this.renderCard();
  }

  total(e) {
    return e.scores.reduce((s, v) => s + (v || 0), 0);
  }

  closeCard() {
    this.cardEl?.remove();
    this.cardEl = null;
    if (this.holeIndex >= this.holeCount - 1) { this.end(); return; }
    this.setupHole(this.holeIndex + 1);
    this.phase = 'pan';
    this.panT = 0;
    this.game.audio.play('whoosh');
  }

  /** Story campaign: team strokes against the course par. */
  campaignStats() {
    const par = this.course.reduce((s, h) => s + h.par, 0);
    // Holes not played yet (ended early) count as the maximum strokes.
    const strokes = this.ents.reduce((s, e) => s + this.course.reduce((h, _, i) => h + (e.scores[i] ?? MAX_STROKES), 0), 0);
    return { strokes, par, players: this.ents.length };
  }

  end() {
    if (this.state === 'results') return;
    const totals = this.ents.map((e) => this.total(e));
    const best = Math.min(...totals);
    const coursePar = this.course.reduce((s, h) => s + h.par, 0);
    const ranked = [...this.ents].sort((a, b) => this.total(a) - this.total(b) || b.aces - a.aces);
    const winners = ranked.filter((e) => this.total(e) === best);
    let title;
    if (this.ents.length === 1) {
      const d = best - coursePar;
      title = d < 0 ? t('golf.solo.under') : d === 0 ? t('golf.solo.even') : t('golf.solo.over');
    } else title = winners.length > 1 ? t('golf.tie') : t('golf.win', { name: winners[0].p.name });
    const fmtPar = (d) => (d === 0 ? t('golf.even') : t('golf.vsPar', { d: d > 0 ? `+${d}` : `−${-d}` }));
    this.finish({
      title,
      subtitle: t('golf.sub', { par: coursePar }),
      rows: ranked.map((e) => ({
        css: e.p.css, name: e.p.name, value: String(this.total(e)),
        detail: `${t('golf.strokes', { n: this.total(e) })} · ${fmtPar(this.total(e) - coursePar)}${e.aces ? ` · ${t('golf.aces', { n: e.aces })}` : ''}`,
        crown: this.total(e) === best,
      })),
      stars: 2,
    });
  }

  // ---------- per frame ----------

  worldPos(x, y, z) {
    return this.hole.origin.clone().add(new THREE.Vector3(x, y, z));
  }

  sound(e, name) {
    if (e.sndT > 0) return;
    e.sndT = 0.08;
    this.game.audio.play(name);
  }

  update(dt) {
    if (this.state === 'vote') { this.picker?.update(dt); return; }
    const H = this.hole;
    this.animateCourse(dt);
    this.updateCamera(dt);
    if (this.updateResults(dt)) { this.updateVisuals(dt); return; }

    const playing = this.state === 'play' && this.phase === 'play';
    if (playing) {
      this.holeT += dt;
      for (const e of this.ents) this.controlPlayer(e, dt);
      this.simulate(dt);
      // Timers that make sure the hole ends.
      if (this.hurry >= 0) {
        const before = Math.ceil(this.hurry);
        this.hurry -= dt;
        if (Math.ceil(this.hurry) !== before && this.hurry < 5 && this.hurry > 0) this.game.audio.play('beep');
      }
      if (this.hurry < 0 && this.hurry !== -1) this.hurry = 0;
      if ((this.hurry === 0 || this.holeT > HOLE_CAP) && this.endT < 0) {
        for (const e of this.ents) if (e.ball.state !== 'in' && e.ball.state !== 'sink') this.pickUp(e);
      }
      if (this.endT < 0 && this.ents.every((e) => e.ball.state === 'in')) this.endT = 1.3;
      if (this.endT > 0) {
        this.endT -= dt;
        if (this.endT <= 0) this.endHole();
      }
    } else if (this.phase === 'card') {
      this.cardT += dt;
      const any = this.game.input.anyAPressed(this.players.map((p) => p.deviceId));
      if ((this.cardT > 1.2 && any) || this.cardT > 9) this.closeCard();
    } else if (this.phase === 'pan') {
      this.panT += dt;
      if (this.panT > 1.7) this.startHole();
    }
    // Sinking animation runs in any phase.
    for (const e of this.ents) {
      const b = e.ball;
      if (b.state !== 'sink') continue;
      b.sinkT += dt;
      const k = Math.min(1, b.sinkT / 0.35);
      b.x = b.sx + (H.cup[0] - b.sx) * k;
      b.z = b.sz + (H.cup[1] - b.sz) * k;
      b.y = b.sy + (H.cupH - 0.45 - b.sy) * k * k;
      if (k >= 1) b.state = 'in';
    }
    this.updateVisuals(dt);
    this.updateHud();
  }

  controlPlayer(e, dt) {
    const b = e.ball;
    const d = this.input(e.p);
    if (!d) return;
    if (b.state !== 'ready') { e.charging = false; return; }
    // Aim: the stick turns the aim; hold B to turn slowly for fine aiming.
    if (Math.abs(d.x) > 0.15) {
      e.holdT += dt;
      const rate = d.b ? 0.35 : 0.9 + Math.min(1.8, e.holdT * 1.6);
      e.aim = wrapAngle(e.aim + d.x * rate * dt);
    } else e.holdT = 0;
    if (d.aPressed && !e.charging) {
      e.charging = true;
      e.power = 0;
      e.pdir = 1;
      this.game.audio.play('select');
    }
    if (e.charging) {
      if (d.a) {
        // The meter fills, then swings back down if held too long.
        e.power += (e.pdir * dt) / CHARGE_T;
        if (e.power >= 1) { e.power = 1; e.pdir = -1; }
        if (e.power <= 0) { e.power = 0; e.pdir = 1; }
      } else {
        e.power = Math.max(0.02, e.power);
        this.putt(e);
      }
    }
  }

  simulate(dt) {
    const sdt = dt / SUBSTEPS;
    const fx = (type, b, s, i) => {
      const e = b.ent;
      if (type === 'wall' && s > 1.5) this.sound(e, 'land');
      else if (type === 'bump') {
        this.sound(e, 'boing');
        const m = this.hole.bumperMeshes[i];
        if (m) m.userData.kick = 1;
      } else if (type === 'land') this.sound(e, 'land');
      else if (type === 'loop') this.game.audio.play('whoosh');
    };
    for (let s = 0; s < SUBSTEPS; s++) {
      const time = this.time - dt + sdt * (s + 1);
      for (const e of this.ents) {
        const b = e.ball;
        if (b.state !== 'ready' && b.state !== 'roll') continue;
        b.ent = e;
        b.event = null;
        this.stepBall(b, sdt, time, fx);
        if (b.event === 'sunk') this.sink(e);
        else if (b.event === 'fell') this.fellOff(e);
      }
      this.ballContacts();
    }
    for (const e of this.ents) {
      e.sndT -= dt;
      const b = e.ball;
      const sp = Math.hypot(b.vx, b.vz);
      if (b.state === 'ready' && (sp > 0.3 || b.loop || !b.grounded)) { b.state = 'roll'; b.still = 0; b.rollT = 0; e.charging = false; }
      if (b.state !== 'roll') continue;
      b.rollT += dt;
      if (!b.loop && b.grounded && sp < 0.15 && Math.abs(this.slopeAt(b.x, b.z)) < 0.05) {
        b.still += dt;
      } else b.still = 0;
      if (b.still > 0.2 || (b.rollT > 20 && !b.loop && b.grounded)) {
        b.state = 'ready';
        b.vx = b.vz = 0;
        if (e.strokes >= MAX_STROKES) { this.pickUp(e); continue; }
        e.aim = this.autoAim(b.x, b.z);
      }
    }
  }

  animateCourse(dt) {
    for (const H of this.holes) {
      if (H.windmill) H.windmill.blades.forEach((arm, i) => { arm.rotation.z = H.windmill.speed * this.time + (i * Math.PI) / 2; });
      H.movers.forEach((m, i) => {
        const s = this.moverAt(m, this.time);
        H.moverMeshes[i].position.set(s.x, 0, s.z);
      });
      for (const bm of H.bumperMeshes) {
        bm.userData.kick = Math.max(0, bm.userData.kick - dt * 4);
        const r = bm.userData.r * (1 + Math.sin(bm.userData.kick * Math.PI) * 0.25);
        bm.scale.set(r, bm.userData.r * 1.3 * (1 - bm.userData.kick * 0.15), r);
      }
      H.flagCloth.rotation.y = Math.sin(this.time * 2.2 + H.index) * 0.35;
    }
  }

  updateCamera(dt) {
    if (!this.camGoal) return;
    const k = this.phase === 'pan' ? 1 - Math.exp(-dt * 3.2) : 1 - Math.exp(-dt * 6);
    this.camPos.lerp(this.camGoal, k);
    this.camLook.lerp(this.lookGoal, k);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);
  }

  /** Fade every fader that stands between the camera and a ball, bean or the cup. */
  updateFaders(dt) {
    const H = this.hole;
    if (!H?.faders.length) return;
    const cam = this.camera.position;
    const pts = [this.worldPos(H.cup[0], H.cupH + 0.3, H.cup[1])];
    for (const e of this.ents) {
      const b = e.ball;
      if (b.state !== 'in') pts.push(this.worldPos(b.x, b.y + BALL_R, b.z));
      pts.push(e.ch.group.position.clone().add(new THREE.Vector3(0, 0.45, 0)));
    }
    const ray = this._ray || (this._ray = new THREE.Ray());
    const hit = this._hit || (this._hit = new THREE.Vector3());
    for (const f of H.faders) {
      let hide = false;
      for (const p of pts) {
        ray.origin.copy(cam);
        ray.direction.copy(p).sub(cam).normalize();
        if (ray.intersectBox(f.box, hit) && hit.distanceTo(cam) < p.distanceTo(cam) - 0.05) { hide = true; break; }
      }
      const goal = hide ? 0.22 : 1;
      if (Math.abs(goal - f.opacity) < 0.002) continue;
      f.opacity += (goal - f.opacity) * Math.min(1, dt * 10);
      if (Math.abs(goal - f.opacity) < 0.01) f.opacity = goal;
      for (const m of f.mats) { m.opacity = f.opacity; m.depthWrite = f.opacity > 0.98; }
    }
  }

  updateVisuals(dt) {
    const H = this.hole;
    this.updateFaders(dt);
    const showAim = this.state !== 'results' && (this.phase === 'play' || this.phase === 'intro');
    this.ents.forEach((e, idx) => {
      const b = e.ball;
      e.mesh.visible = b.state !== 'in';
      e.mesh.position.copy(this.worldPos(b.x, b.y + BALL_R, b.z));
      if (b.state === 'roll' || b.state === 'sink') {
        // Roll the ball visually.
        e.mesh.rotation.z -= b.vx * dt / BALL_R;
        e.mesh.rotation.x += b.vz * dt / BALL_R;
      }
      const ready = b.state === 'ready' && showAim;
      e.ring.visible = ready;
      if (ready) {
        e.ring.position.copy(this.worldPos(b.x, b.y + 0.025, b.z));
        e.ring.scale.setScalar(1 + Math.sin(this.time * 5 + idx) * 0.12);
      }
      this.updateAimDots(e, ready);

      // Power meter above the ball.
      if (e.charging && ready) {
        e.meter.style.display = '';
        e.meterFill.style.width = `${Math.round(e.power * 100)}%`;
        this.game.ui.place(e.meter, this.worldPos(b.x, b.y + 1.15, b.z), this.camera);
      } else e.meter.style.display = 'none';
      if (e.popT > 0) {
        e.popT -= dt;
        e.popPos.y += dt * 0.6;
        this.game.ui.place(e.pop, e.popPos, this.camera);
        if (e.popT <= 0) e.pop.style.display = 'none';
      }

      // The bean: stands behind the ball while aiming, watches it roll, cheers by the cup.
      const bn = e.bean;
      let tx = bn.x, tz = bn.z, fx = 0, fz = 1;
      if (b.state === 'in' || b.state === 'sink') {
        const a = (idx / Math.max(1, this.ents.length)) * Math.PI * 2 + 0.6;
        tx = H.cup[0] + Math.cos(a) * 1.25;
        tz = H.cup[1] + Math.sin(a) * 1.25;
        const g = this.groundAt(tx, tz);
        if (g === null) { tx = H.cup[0] + Math.cos(a) * 0.7; tz = H.cup[1] + Math.sin(a) * 0.7; }
        fx = 0; fz = 1;
      } else if (b.state === 'ready') {
        tx = b.x - Math.cos(e.aim) * 0.62;
        tz = b.z - Math.sin(e.aim) * 0.62;
        fx = Math.cos(e.aim); fz = Math.sin(e.aim);
      } else {
        fx = b.x - bn.x; fz = b.z - bn.z;
      }
      const dist = Math.hypot(tx - bn.x, tz - bn.z);
      let moving = 0, grounded = true;
      if (bn.hopT >= 0) {
        bn.hopT += dt / bn.hopDur;
        const k = Math.min(1, bn.hopT);
        bn.x = bn.fx + (bn.tx - bn.fx) * k;
        bn.z = bn.fz + (bn.tz - bn.fz) * k;
        bn.hopY = Math.sin(Math.PI * k) * (0.5 + bn.hopDur * 0.8);
        grounded = false;
        if (k >= 1) { bn.hopT = -1; bn.hopY = 0; e.ch.squash(0.75); }
      } else if (dist > 1.0 && b.state !== 'roll') {
        Object.assign(bn, { hopT: 0, fx: bn.x, fz: bn.z, tx, tz, hopDur: Math.min(0.8, 0.3 + dist * 0.04) });
        e.ch.squash(1.25);
      } else if (dist > 0.01 && b.state !== 'roll') {
        const k = Math.min(1, dt * 12);
        bn.x += (tx - bn.x) * k;
        bn.z += (tz - bn.z) * k;
        moving = Math.min(1, dist * 2);
      }
      const gy = this.groundAt(bn.x, bn.z);
      bn.y = gy ?? bn.y;
      // Happy hops by the cup.
      let cheerY = 0;
      if (b.state === 'in' && bn.hopT < 0) cheerY = Math.max(0, Math.sin(this.time * 6 + idx * 1.3)) * 0.25;
      e.ch.group.position.copy(this.worldPos(bn.x, bn.y + (bn.hopY || 0) + cheerY, bn.z));
      e.ch.face(fx, fz);
      e.ch.update(dt, { moving, grounded, vy: grounded ? 0 : 3 });

      // Putter swing: pull back while charging, swing through on release.
      if (e.swingT > 0) {
        e.swingT -= dt;
        const k = 1 - e.swingT / 0.5;
        e.swing = k < 0.2 ? THREE.MathUtils.lerp(e.swing, -0.6, 0.6) : -0.6 * (1 - (k - 0.2) / 0.8);
      } else e.swing = e.charging ? e.power * 0.9 : e.swing * 0.8;
      e.putter.rotation.x = e.swing;
      e.putter.visible = b.state !== 'in' && b.state !== 'sink';
    });
  }

  /** Dotted aim line that shows the first bounces off walls. */
  updateAimDots(e, show) {
    if (!show) { for (const d of e.dots) d.visible = false; return; }
    const b = e.ball;
    const len = e.charging ? 1.2 + e.power * 6.5 : 2.6;
    let x = b.x, z = b.z, dx = Math.cos(e.aim), dz = Math.sin(e.aim);
    const pts = [[x, z]];
    let left = len;
    for (let bounce = 0; bounce < 3 && left > 0; bounce++) {
      let bestT = left, nrm = null;
      for (const [ax, az, bx, bz, ha, hb, low] of this.hole.segs) {
        if (low || Math.min(ha, hb) > b.y + 0.1) continue; // walls the ball will fly over
        const hit = raySeg(x, z, dx, dz, ax, az, bx, bz);
        if (hit && hit.t > 1e-3 && hit.t < bestT) { bestT = hit.t; nrm = hit.n; }
      }
      let step = nrm ? Math.max(0, bestT - (BALL_R + WALL_HALF)) : bestT; // bounce where the ball would
      // Bumpers: ray against a circle grown by the ball radius.
      for (const [cx, cz, r] of this.hole.bumpers) {
        const R = r + BALL_R, fx = x - cx, fz = z - cz;
        const bb = fx * dx + fz * dz, cc = fx * fx + fz * fz - R * R, disc = bb * bb - cc;
        if (cc <= 0 || disc < 0) continue;
        const tt = -bb - Math.sqrt(disc);
        if (tt > 1e-3 && tt < step) { step = tt; const hx = x + dx * tt - cx, hz = z + dz * tt - cz, hl = Math.hypot(hx, hz); nrm = [hx / hl, hz / hl]; }
      }
      x += dx * step; z += dz * step;
      pts.push([x, z]);
      left -= step;
      if (!nrm) break;
      const dn = dx * nrm[0] + dz * nrm[1];
      dx -= 2 * dn * nrm[0]; dz -= 2 * dn * nrm[1];
      if (step < 1e-3) left -= 0.2;
    }
    // Walk along the polyline placing dots, with a gentle marching motion.
    const gap = 0.34;
    let seg = 0, along = 0.35 + ((this.time * 0.9) % gap);
    let used = 0;
    for (const d of e.dots) {
      while (seg < pts.length - 1) {
        const [ax, az] = pts[seg], [bx, bz] = pts[seg + 1];
        const L = Math.hypot(bx - ax, bz - az);
        if (along - used <= L) break;
        used += L;
        seg++;
      }
      if (seg >= pts.length - 1) { d.visible = false; continue; }
      const [ax, az] = pts[seg], [bx, bz] = pts[seg + 1];
      const L = Math.hypot(bx - ax, bz - az) || 1;
      const k = (along - used) / L;
      const px = ax + (bx - ax) * k, pz = az + (bz - az) * k;
      const gy = this.groundAt(px, pz);
      d.visible = gy !== null || seg === 0;
      d.position.copy(this.worldPos(px, (gy ?? b.y) + 0.07, pz));
      along += gap;
    }
  }

  updateHud() {
    if (this.state === 'results') return;
    const H = this.hole;
    let html = `<div class="pill"><b>${t('golf.hole', { n: H.index + 1, total: this.holeCount })}</b> ${esc(t(`golf.name.${H.index}`))} · ${t('golf.par', { n: H.par })}</div>`;
    if (this.hurry > 0 && this.phase === 'play') html += `<div class="pill" style="color:#ff5d73"><b>${t('golf.hurry', { n: Math.ceil(this.hurry) })}</b></div>`;
    this.game.ui.setTop(html);
    this.game.ui.bar(this.players, (p) => {
      const e = this.ents.find((x) => x.p === p);
      if (!e) return '';
      const done = e.ball.state === 'in' || e.ball.state === 'sink';
      const tot = this.total(e) + (this.phase === 'play' || this.phase === 'intro' ? (done ? e.score : e.strokes) : 0);
      return `${done ? '✓ ' : ''}${e.strokes} <span style="opacity:.55;font-weight:600">· ${tot}</span>`;
    });
  }
}

// ---------- small geometry helpers ----------

function darker(hex, f) {
  const c = new THREE.Color(hex).multiplyScalar(f);
  c.r = Math.min(1, c.r); c.g = Math.min(1, c.g); c.b = Math.min(1, c.b);
  return c.getHex();
}

/** Do segments AB and CD cross? */
function segCross(ax, az, bx, bz, cx, cz, dx, dz) {
  const d1 = (dx - cx) * (az - cz) - (dz - cz) * (ax - cx);
  const d2 = (dx - cx) * (bz - cz) - (dz - cz) * (bx - cx);
  const d3 = (bx - ax) * (cz - az) - (bz - az) * (cx - ax);
  const d4 = (bx - ax) * (dz - az) - (bz - az) * (dx - ax);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

/** Ray (origin, unit dir) against a segment: distance and the normal facing the ray. */
function raySeg(ox, oz, dx, dz, ax, az, bx, bz) {
  const ex = bx - ax, ez = bz - az;
  const den = dx * ez - dz * ex;
  if (Math.abs(den) < 1e-9) return null;
  const t = ((ax - ox) * ez - (az - oz) * ex) / den;
  const s = ((ax - ox) * dz - (az - oz) * dx) / den;
  if (t < 0 || s < 0 || s > 1) return null;
  const L = Math.hypot(ex, ez);
  let nx = -ez / L, nz = ex / L;
  if (nx * dx + nz * dz > 0) { nx = -nx; nz = -nz; }
  return { t, n: [nx, nz] };
}
