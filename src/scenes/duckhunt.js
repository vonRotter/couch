import * as THREE from 'three';
import { MiniGame } from '../core/minigame.js';
import { COLORS, PLAYER_COLORS } from '../core/palette.js';
import { addLights, skyTexture } from '../core/world.js';
import { t, tFor, addStrings } from '../core/i18n.js';
import { VotePicker } from '../core/vote.js';
import { esc } from '../core/ui.js';
import {
  DUCK_TYPES, makeDuck, zapTint, makeClay, makeDog, makePopDog, makeCrosshair, makeBeam, buildStage,
} from './duckhunt/models.js';

// Laser Ducks: the classic NES duck hunt, with laser guns. Ducks fly up out of the tall grass,
// zigzag and bounce at the screen edges, and fly away after a few seconds. Every player aims a
// crosshair with the stick (or player 1 with the mouse) and has 3 shots per flight. Each round has
// 10 ducks and a quota of hits; miss the quota and the game is over. Game A: 1 duck at a time,
// Game B: 2 at a time, Clay shooting: discs launched away into the distance. With 2+ players the
// group votes Team (shared quota, team score) or Versus (the first laser to reach a duck gets it).

addStrings({
  en: {
    'game.duckhunt': 'Laser Ducks',
    'duckhunt.intro': 'Stick: aim · [A]: fire your laser · 3 shots per flight. Or use the mouse: point and click! Hit enough ducks each round to go on.',
    'duckhunt.modeQ': 'Which game?',
    'duckhunt.mode.A': 'Game A · 1 duck',
    'duckhunt.mode.B': 'Game B · 2 ducks',
    'duckhunt.mode.C': 'Clay shooting',
    'duckhunt.rulesQ': 'Together or against each other?',
    'duckhunt.team': 'Team · shared quota',
    'duckhunt.versus': 'Versus · first laser wins',
    'duckhunt.round': 'Round {n}',
    'duckhunt.goal': 'Hit {q} of 10',
    'duckhunt.need': 'need {q}',
    'duckhunt.flyAway': 'Fly away!',
    'duckhunt.perfect': 'Perfect! +{n}',
    'duckhunt.clear': 'Round clear!',
    'duckhunt.short': 'Not enough hits!',
    'duckhunt.gameOver': 'Game over',
    'duckhunt.newBest': 'New high score!',
    'duckhunt.best': 'Best {n}',
    'duckhunt.teamScore': 'Team {n}',
    'duckhunt.sub': 'Reached round {r} · {score} points',
    'duckhunt.subVs': 'Reached round {r}',
    'duckhunt.detail': '{hits} hits',
    'duckhunt.detail1': '1 hit',
    'duckhunt.fire': '[A] fire',
    'duckhunt.ha': 'Ha ha!',
  },
  no: {
    'game.duckhunt': 'Laserender',
    'duckhunt.intro': 'Pinne: sikt · [A]: skyt med laseren · 3 skudd per flukt. Eller bruk musa: pek og klikk! Treff nok ender hver runde for å fortsette.',
    'duckhunt.modeQ': 'Hvilket spill?',
    'duckhunt.mode.A': 'Spill A · 1 and',
    'duckhunt.mode.B': 'Spill B · 2 ender',
    'duckhunt.mode.C': 'Leirdueskyting',
    'duckhunt.rulesQ': 'Sammen eller mot hverandre?',
    'duckhunt.team': 'Lag · felles mål',
    'duckhunt.versus': 'Mot hverandre · første laser vinner',
    'duckhunt.round': 'Runde {n}',
    'duckhunt.goal': 'Treff {q} av 10',
    'duckhunt.need': 'trenger {q}',
    'duckhunt.flyAway': 'Den fløy vekk!',
    'duckhunt.perfect': 'Perfekt! +{n}',
    'duckhunt.clear': 'Runden er klart!',
    'duckhunt.short': 'Ikke nok treff!',
    'duckhunt.gameOver': 'Spillet er slutt',
    'duckhunt.newBest': 'Ny rekord!',
    'duckhunt.best': 'Rekord {n}',
    'duckhunt.teamScore': 'Laget {n}',
    'duckhunt.sub': 'Nådde runde {r} · {score} poeng',
    'duckhunt.subVs': 'Nådde runde {r}',
    'duckhunt.detail': '{hits} treff',
    'duckhunt.detail1': '1 treff',
    'duckhunt.fire': '[A] skyt',
    'duckhunt.ha': 'Ha ha!',
  },
});

const FIELD_W = 26;
const FIELD_H = 14.6;
const CAM_Y = 4.2; // a low eye tilted up: mostly sky, like the original
const GRASS_TOP = 4.6; // ducks bounce above this line (the grass hides them below ~4.4)
const HIT_Y = 4.1; // a rising duck can be hit once it is this high
const STRIP_Z = 3.6; // the dirt strip in front of the grass
const STRIP_TOP = 2;
const DOG_Z = 1.4; // where the dog pops up behind the grass
const AMMO = 3;
const DUCK_R = 0.9;
const DUCK_SCALE = 1.35;
const CLAY_R = 0.85;
const CLAY_SCALE = 1.7;
const AIM_TOL = 0.22; // extra slack around a target for a laser hit
const PERFECT = 10000;

/** Hits needed out of 10, like the original (rises with the rounds). */
function quotaFor(round) {
  return round <= 2 ? 6 : round <= 4 ? 7 : round <= 6 ? 8 : 9;
}

const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = THREE.MathUtils.clamp;
const _v = new THREE.Vector3();
const _plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
const _ray = new THREE.Raycaster();

export class DuckHuntScene extends MiniGame {
  constructor(game, opts = {}) {
    super(game, opts);
    this.camera.fov = 40;
    this.skyNormal = skyTexture('#5fc2ff', '#d8f3ff');
    this.skyFlash = skyTexture('#ff8fc8', '#ffe0ef');
    this.scene.background = this.skyNormal;
    addLights(this.scene, { size: 30, target: new THREE.Vector3(0, 0, -4), dir: new THREE.Vector3(-0.45, 1, 0.8) });
    this.stage = buildStage(this.scene, { stripZ: STRIP_Z, stripTop: STRIP_TOP });
    this.frame();

    this.dog = makeDog();
    this.dog.scale.setScalar(1.25);
    this.dog.visible = false;
    this.popDog = makePopDog();
    this.popDog.scale.setScalar(1.45);
    this.popDog.visible = false;
    this.scene.add(this.dog, this.popDog);
    this.dogAnim = null; // walk-in animation state
    this.popAnim = null; // pop-up animation state
    this.held = []; // ducks the pop-up dog holds

    this.targets = [];
    this.floaters = [];
    this.marks = null;
    this.round = 0;
    this.teamBonus = 0;
    this.makeShooters();
    this.callout = this.game.ui.label('label');
    this.callout.style.cssText = 'left:50%;top:30%;transform:translate(-50%,-50%);font-size:clamp(30px,5vw,76px);color:#ff6fae;display:none';
    this.calloutT = 0;
    this.flashT = 0;

    this.bindMouse();
    game.audio.playMusic('bubble');

    // Mode and rules: votes unless a retry or the story campaign already knows them.
    const solo = this.players.length < 2;
    this.mode = opts.mode || (this.campaign ? 'A' : null);
    this.rules = solo ? 'team' : opts.rules || (this.campaign ? 'team' : null);
    this.state = 'vote';
    this.askMode();
  }

  askMode() {
    if (this.mode) { this.askRules(); return; }
    this.picker = new VotePicker(this, {
      title: () => t('game.duckhunt'),
      vote: {
        question: () => t('duckhunt.modeQ'), def: 'A',
        options: ['A', 'B', 'C'].map((m) => ({ value: m, label: () => t(`duckhunt.mode.${m}`) })),
      },
      onDone: (v) => { this.picker = null; this.mode = v; this.askRules(); },
    });
  }

  askRules() {
    if (this.rules) { this.begin(); return; }
    this.picker = new VotePicker(this, {
      title: () => t('game.duckhunt'),
      vote: {
        question: () => t('duckhunt.rulesQ'), def: 'team',
        options: [{ value: 'team', label: () => t('duckhunt.team') }, { value: 'versus', label: () => t('duckhunt.versus') }],
      },
      onDone: (v) => { this.picker = null; this.rules = v; this.begin(); },
    });
  }

  begin() {
    this.versus = this.rules === 'versus' && this.players.length > 1;
    this.clay = this.mode === 'C';
    this.perFlight = this.mode === 'A' ? 1 : 2;
    this.flights = 10 / this.perFlight;
    this.intro(t('game.duckhunt'), t('duckhunt.intro'));
  }

  onStart() {
    this.startRound(1);
  }

  retryOptions() {
    return { key: this.key, mode: this.mode, rules: this.rules };
  }

  onLanguage() {
    this.picker?.render();
  }

  // ---------- framing ----------

  /**
   * Fit the 30 x 17 field. The camera sits low and tilts up so that the bottom edge of the screen
   * meets y = 0 on the duck plane (z = 0); the horizon ends up low and the sky fills the screen.
   */
  frame() {
    const d = this.fitDistance(FIELD_W, FIELD_H);
    const halfFov = THREE.MathUtils.degToRad(this.camera.fov / 2);
    const pitch = halfFov - Math.atan(CAM_Y / d);
    this.camD = d;
    this.camY = CAM_Y;
    this.camera.position.set(0, CAM_Y, d);
    this.camera.rotation.set(pitch, 0, 0);
    this.camera.updateMatrixWorld();
    this.top = CAM_Y + d * Math.tan(pitch + halfFov);
    // Narrowest visible half-width on the duck plane (at the bottom edge).
    _ray.setFromCamera(new THREE.Vector2(1, -1), this.camera);
    const hw = _ray.ray.intersectPlane(_plane, _v) ? _v.x : d * Math.tan(halfFov) * this.camera.aspect;
    this.halfW = Math.min(hw, 26);
  }

  /** Lowest visible y at depth z (the bottom edge of the screen passes through the origin). */
  bottomAt(z) {
    return this.camY * (z / this.camD);
  }

  resize(w, h) {
    super.resize(w, h);
    this.frame();
  }

  /** Where a world point lands on the duck plane, seen from the camera; s = its size factor. */
  project(p) {
    const s = this.camD / (this.camD - p.z);
    return { x: p.x * s, y: this.camY + (p.y - this.camY) * s, s };
  }

  // ---------- players ----------

  makeShooters() {
    this.shooters = this.players.map((p, i) => {
      const cross = makeCrosshair(p.color);
      const beam = makeBeam(p.color);
      this.scene.add(cross, beam.group, beam.flash);
      const tag = this.game.ui.label('label player-tag');
      tag.style.color = p.css;
      const n = this.players.length;
      return {
        p, i, cross, beam, tag,
        x: (n === 1 ? 0 : (i / (n - 1) - 0.5) * 16), y: 9, vx: 0, vy: 0, holdT: 0,
        ammo: AMMO, score: 0, hits: 0, beamT: 0, kick: 0, emptyT: 0,
      };
    });
  }

  /** Where a player's laser comes from: just below the bottom edge, spread out by player. */
  gunPos(s) {
    const n = this.shooters.length;
    const z = 6;
    const k = (this.camD - z) / this.camD;
    const x = n === 1 ? this.halfW * k * 0.25 : (s.i / (n - 1) - 0.5) * this.halfW * k * 1.4;
    return new THREE.Vector3(x, this.bottomAt(z) - 0.4, z);
  }

  // ---------- mouse (player 1 light gun) ----------

  bindMouse() {
    const el = this.game.renderer.domElement;
    this.mouseNdc = new THREE.Vector2();
    this.mouseActive = false;
    this.mouseFire = false;
    this.onPointerMove = (e) => {
      const r = el.getBoundingClientRect();
      this.mouseNdc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      this.mouseActive = true;
      el.style.cursor = 'none';
    };
    this.onPointerDown = (e) => {
      if (e.button !== 0) return;
      this.onPointerMove(e);
      this.mouseFire = true;
    };
    this.onPointerLeave = () => { el.style.cursor = ''; };
    el.addEventListener('pointermove', this.onPointerMove);
    el.addEventListener('pointerdown', this.onPointerDown);
    el.addEventListener('pointerleave', this.onPointerLeave);
  }

  dispose() {
    const el = this.game.renderer.domElement;
    el.removeEventListener('pointermove', this.onPointerMove);
    el.removeEventListener('pointerdown', this.onPointerDown);
    el.removeEventListener('pointerleave', this.onPointerLeave);
    el.style.cursor = '';
    this.scene.background = null;
    this.skyNormal.dispose();
    this.skyFlash.dispose();
    super.dispose();
  }

  // ---------- round flow ----------

  startRound(r) {
    this.round = r;
    this.quota = quotaFor(r);
    this.marks = Array.from({ length: 10 }, () => ({ state: 'pending', css: '' }));
    this.flightIndex = -1;
    this.phase = 'walk';
    for (const s of this.shooters) s.ammo = AMMO;
    this.clearTargets();
    // (Round 1 waits for the countdown's GO! to clear.)
    this.later(r === 1 ? 0.8 : 0, () => this.showCallout(t('duckhunt.round', { n: r }), t('duckhunt.goal', { q: this.quota }), 2.4));
    this.game.audio.play('beep');
    // The dog sniffs along the strip and jumps into the grass (a shorter walk after round 1).
    const k = (this.camD - 5) / this.camD;
    const left = -this.halfW * k - 2;
    this.dogAnim = { t: 0, x0: left, x1: r === 1 ? -2 : left + 5, walk: r === 1 ? 2.4 : 1.1, sniffed: false };
    this.dog.visible = true;
    this.dog.position.set(left, STRIP_TOP, 5);
    this.dog.rotation.set(0, -0.25, 0);
    this.dog.userData.bang.visible = false;
  }

  /** Difficulty knobs: faster, twitchier ducks each round, and a little more with more players. */
  get speedMul() {
    const n = this.players.length;
    return Math.min(2.2, 1 + 0.1 * (this.round - 1)) * (1 + (this.versus ? 0.03 : 0.06) * (n - 1));
  }

  startFlight() {
    this.flightIndex++;
    this.phase = 'flight';
    this.flightT = 0;
    this.escaping = false;
    this.clearTargets();
    for (const s of this.shooters) s.ammo = AMMO;
    const n = this.players.length;
    this.flightTime = Math.max(3.6, 7 - 0.3 * (this.round - 1)) * (this.versus ? 1 : 1 - 0.035 * (n - 1));
    for (let j = 0; j < this.perFlight; j++) {
      const mark = this.flightIndex * this.perFlight + j;
      this.targets.push(this.clay ? this.spawnClay(mark, j * rnd(0.3, 0.8)) : this.spawnDuck(mark, j));
    }
    this.game.audio.play(this.clay ? 'whoosh' : 'bubble');
  }

  pickType() {
    const r = this.round;
    const red = Math.min(0.45, 0.08 + 0.05 * (r - 1));
    const blue = Math.min(0.4, 0.25 + 0.03 * (r - 1));
    const x = Math.random();
    return x < red ? 'red' : x < red + blue ? 'blue' : 'black';
  }

  spawnDuck(mark, j) {
    const typeKey = this.pickType();
    const type = DUCK_TYPES[typeKey];
    const model = makeDuck(type);
    model.scale.setScalar(DUCK_SCALE);
    const x = clamp(rnd(-0.55, 0.55) * this.halfW + (j ? (Math.random() < 0.5 ? -4 : 4) : 0), -this.halfW + 3, this.halfW - 3);
    model.position.set(x, 0.6 - j * 0.8, 0);
    this.scene.add(model);
    const tg = {
      kind: 'duck', type, typeKey, model, mark, state: 'fly', pos: model.position, t: 0,
      vel: new THREE.Vector3(), speed: type.speed * this.speedMul, emerged: false, turnT: 0, flap: Math.random() * 6,
      r: DUCK_R, spin: 0, by: null, sx: 0, sy: 0, ss: 1, svx: 0, svy: 0,
    };
    this.newHeading(tg, true);
    return tg;
  }

  /** Pick a new zigzag heading: one of the classic diagonal angles. */
  newHeading(tg, up = false) {
    const angles = up ? [0.9, 1.1, 1.25] : [0.35, 0.6, 0.85, 1.1]; // rise out of the grass steeply
    const a = angles[(Math.random() * angles.length) | 0];
    const sx = Math.random() < 0.5 ? -1 : 1;
    const sy = up ? 1 : Math.random() < 0.55 ? 1 : -1;
    tg.vel.set(Math.cos(a) * sx, Math.sin(a) * sy, 0).multiplyScalar(tg.speed);
    // Later rounds turn more often (more erratic flight).
    tg.turnT = Math.max(0.45, 1.6 - 0.11 * (this.round - 1)) * rnd(0.6, 1.3);
  }

  spawnClay(mark, delay) {
    const model = makeClay();
    model.scale.setScalar(CLAY_SCALE);
    model.visible = false;
    this.scene.add(model);
    const m = Math.min(2, 1 + 0.1 * (this.round - 1)) * (1 + 0.04 * (this.players.length - 1));
    const tg = {
      kind: 'clay', model, mark, state: 'wait', delay, pos: model.position, t: 0,
      vel: new THREE.Vector3(rnd(2, 5) * m * (Math.random() < 0.5 ? -1 : 1), rnd(9, 12), -rnd(13, 16) * m),
      r: CLAY_R, by: null, spin: rnd(8, 14), sx: 0, sy: 0, ss: 1, svx: 0, svy: 0,
    };
    model.position.set(rnd(-6, 6), 1.2, 2);
    return tg;
  }

  clearTargets() {
    for (const tg of this.targets) this.scene.remove(tg.model);
    this.targets = [];
  }

  flyAway() {
    this.escaping = true;
    for (const tg of this.targets) {
      if (tg.state !== 'fly') continue;
      tg.state = 'escape';
      tg.vel.set(tg.vel.x * 0.3, tg.speed * 1.5, 0);
    }
    this.flashT = 0.8;
    this.showCallout(t('duckhunt.flyAway'), '', 1.4);
    this.game.audio.play('whoosh');
  }

  endFlight() {
    this.phase = 'dog';
    const hits = this.targets.filter((tg) => tg.by);
    this.phaseT = 1.6;
    const fall = hits.length ? hits[hits.length - 1].fallX : 0;
    this.startPop(hits, clamp(fall ?? 0, -this.halfW + 4, this.halfW - 4), this.phaseT);
  }

  tally() {
    this.phase = 'tally';
    this.phaseT = 2.4;
    // Like the original, the hit marks slide together to the left.
    this.marks.sort((a, b) => (b.state === 'hit') - (a.state === 'hit'));
    const hits = this.marks.filter((m) => m.state === 'hit').length;
    this.passed = hits >= this.quota;
    if (!this.passed) {
      this.showCallout(t('duckhunt.short'), t('duckhunt.gameOver'), 2.6);
      this.startPop([], 0, 2.4);
      this.game.audio.play('leave');
      this.phaseT = 2.8;
    } else if (hits === 10) {
      if (this.versus) for (const s of this.shooters) s.score += PERFECT;
      else this.teamBonus += PERFECT;
      this.showCallout(t('duckhunt.perfect', { n: PERFECT }), '', 2.2);
      this.game.audio.play('star');
      this.confetti.burst(new THREE.Vector3(0, this.top * 0.6, 0), 0, { count: 80, speed: 10, up: 5, colors: PLAYER_COLORS.map((c) => c.hex).concat(COLORS.gold), life: 1.8, gravity: -7, size: 0.3 });
    } else {
      this.showCallout(t('duckhunt.clear'), '', 1.8);
      this.game.audio.play('coin');
    }
  }

  updatePhase(dt) {
    if (this.phase === 'walk') {
      if (!this.dogAnim) this.startFlight();
    } else if (this.phase === 'flight') {
      this.flightT += dt;
      const live = this.targets.some((tg) => tg.state === 'fly');
      if (!this.clay && !this.escaping && live && (this.flightT > this.flightTime || this.shooters.every((s) => s.ammo <= 0))) this.flyAway();
      if (this.targets.every((tg) => tg.state === 'done')) this.endFlight();
    } else if (this.phase === 'dog') {
      this.phaseT -= dt;
      if (this.phaseT <= 0) {
        if (this.flightIndex + 1 >= this.flights) this.tally();
        else this.startFlight();
      }
    } else if (this.phase === 'tally') {
      this.phaseT -= dt;
      if (this.phaseT <= 0) {
        if (this.passed) this.startRound(this.round + 1);
        else this.end();
      }
    }
  }

  // ---------- shooting ----------

  /** The live target under (x, y) on the duck plane, if any (closest relative to its size). */
  findTarget(x, y) {
    let best = null, bestD = Infinity;
    for (const tg of this.targets) {
      if (tg.state !== 'fly' && tg.state !== 'escape') continue;
      if (tg.state === 'escape' && !this.clay) continue;
      if (tg.pos.y < HIT_Y && tg.kind === 'duck') continue;
      const d = Math.hypot(tg.sx - x, tg.sy - y) / (tg.r * tg.ss + AIM_TOL);
      if (d < 1 && d < bestD) { best = tg; bestD = d; }
    }
    return best;
  }

  shoot(s) {
    if (s.ammo <= 0) {
      s.emptyT = 0.35;
      this.game.audio.play('bump');
      return;
    }
    s.ammo--;
    s.kick = 1;
    this.game.audio.play('dash');
    const tg = this.findTarget(s.x, s.y);
    const end = tg ? tg.pos.clone() : new THREE.Vector3(s.x, s.y, 0);
    const from = this.gunPos(s);
    s.beam.aim(from, end, tg && tg.kind === 'clay' ? 0.07 : 0.09);
    s.beamT = 1;
    if (tg) this.hit(tg, s);
  }

  hit(tg, s) {
    const pts = Math.round(((tg.kind === 'clay' ? 1000 : tg.type.pts) * (1 + 0.25 * (this.round - 1))) / 100) * 100;
    tg.by = s;
    s.score += pts;
    s.hits++;
    const mark = this.marks[tg.mark];
    mark.state = 'hit';
    mark.css = s.p.css;
    this.floater(`+${pts}`, s.p.css, tg.pos.clone().add(_v.set(0, 1, 0)));
    this.game.audio.play('pop');
    const sparks = [s.p.color, 0xffffff, 0xb8fff2];
    if (tg.kind === 'clay') {
      // Clay discs burst into chunks.
      tg.state = 'done';
      tg.model.visible = false;
      this.confetti.burst(tg.pos, 0, { count: 18, speed: 5, up: 1, colors: [0xff8c42, 0xffd166, 0xd9622b], life: 1, gravity: -9, size: 0.22 });
      this.confetti.burst(tg.pos, 0, { count: 10, speed: 6, up: 0, colors: sparks, life: 0.35, gravity: 0, size: 0.12 });
    } else {
      // Ducks freeze in a zap, then spin and drop into the grass with a few feathers.
      tg.state = 'hit';
      tg.t = 0;
      this.confetti.burst(tg.pos, 0, { count: 12, speed: 6, up: 0, colors: sparks, life: 0.35, gravity: 0, size: 0.12 });
      this.confetti.burst(tg.pos, 0, { count: 8, speed: 3, up: 1.5, colors: [0xffffff, tg.type.belly, tg.type.wing], life: 1.4, gravity: -2.5, size: 0.2, drag: 2.5 });
    }
  }

  floater(text, css, pos) {
    const el = this.game.ui.label('label');
    el.style.color = css;
    el.textContent = text;
    this.floaters.push({ el, pos, t: 0 });
  }

  // ---------- per frame ----------

  update(dt) {
    this.animateStage(dt);
    if (this.state === 'vote') {
      this.picker?.update(dt);
      this.updateShooters(dt, false);
      return;
    }
    if (this.updateResults(dt)) {
      this.updateTargets(dt);
      this.updateDogs(dt);
      this.updateFx(dt);
      return;
    }
    const playing = this.state === 'play';
    this.updateShooters(dt, playing);
    if (playing) this.updatePhase(dt);
    this.updateTargets(dt);
    this.updateDogs(dt);
    this.updateFx(dt);
    this.hud();
  }

  animateStage(dt) {
    for (const c of this.stage.clouds) {
      c.position.x += c.userData.speed * dt;
      if (c.position.x > 60) c.position.x = -60;
    }
    if (this.flashT > 0) {
      this.flashT -= dt;
      this.scene.background = this.flashT > 0 && (this.flashT > 0.4 || Math.floor(this.flashT * 10) % 2 === 0) ? this.skyFlash : this.skyNormal;
    }
  }

  updateShooters(dt, playing) {
    const canFire = playing && this.phase === 'flight';
    // Projected target positions (on the duck plane) for aim assist.
    const live = this.targets.filter((tg) => (tg.state === 'fly') && (tg.kind === 'clay' || tg.pos.y > HIT_Y));
    const firing = [];
    for (const s of this.shooters) {
      const d = this.input(s.p) || { x: 0, y: 0 };
      const mag = Math.hypot(d.x, d.y);
      const mouse = s.i === 0 && this.mouseActive;
      if (mouse && mag > 0.3) this.mouseActive = false;
      if (s.i === 0 && this.mouseActive) {
        // Light gun: the crosshair sits exactly under the mouse.
        _ray.setFromCamera(this.mouseNdc, this.camera);
        if (_ray.ray.intersectPlane(_plane, _v)) { s.x = _v.x; s.y = _v.y; }
        s.vx = s.vy = 0;
      } else {
        // Stick: speed ramps up while held, so short taps make fine adjustments.
        s.holdT = mag > 0.2 ? s.holdT + dt : 0;
        let speed = 7 + 15 * Math.min(1, s.holdT / 0.5);
        let near = null, nearD = Infinity;
        for (const tg of live) {
          const R = tg.r * tg.ss + 1.4;
          const dd = Math.hypot(tg.sx - s.x, tg.sy - s.y);
          if (dd < R && dd / R < nearD) { near = tg; nearD = dd / R; }
        }
        if (near) speed *= 0.72;
        const k = Math.min(1, dt * 12);
        s.vx += (d.x * speed - s.vx) * k;
        s.vy += (d.y * speed - s.vy) * k;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        if (near && canFire) {
          // Aim assist: a gentle pull toward the nearest duck and a little follow of its motion.
          const w = 1 - nearD;
          const pull = Math.min(1, 1.6 * w * dt);
          s.x += (near.sx - s.x) * pull + near.svx * dt * 0.25 * w;
          s.y += (near.sy - s.y) * pull + near.svy * dt * 0.25 * w;
        }
      }
      s.x = clamp(s.x, -this.halfW + 0.5, this.halfW - 0.5);
      s.y = clamp(s.y, 0.7, this.top - 0.5);
      if (canFire && (d.aPressed || (s.i === 0 && this.mouseFire))) firing.push(s);
      this.updateShooterLook(s, dt);
    }
    this.mouseFire = false;
    // Versus: when several fire on the same frame, a random order decides who reaches first.
    for (let i = firing.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [firing[i], firing[j]] = [firing[j], firing[i]];
    }
    for (const s of firing) this.shoot(s);
  }

  updateShooterLook(s, dt) {
    s.kick = Math.max(0, s.kick - dt * 6);
    s.cross.position.set(s.x, s.y, 0);
    const pulse = 1 + s.kick * 0.25 + (s.emptyT > 0 ? Math.sin(s.emptyT * 40) * 0.1 : 0);
    s.cross.scale.setScalar(pulse);
    const dim = this.phase === 'flight' && s.ammo <= 0 ? 0.35 : 1;
    for (const m of s.cross.userData.mats) m.opacity = dim;
    s.emptyT = Math.max(0, s.emptyT - dt);
    // Beam fade and zap flash.
    if (s.beamT > 0) s.beamT = Math.max(0, s.beamT - dt * 5);
    s.beam.set(s.beamT, s.beamT > 0 ? (1 - s.beamT) * 1.6 + 0.3 : 0);
    // Name tag (and a fire hint on the first flight) under the crosshair.
    const multi = this.shooters.length > 1;
    const hint = this.round === 1 && this.flightIndex <= 0 && this.state === 'play';
    const text = `${multi ? esc(s.p.name) : ''}${hint ? `<small>${esc(tFor(s.p, 'duckhunt.fire'))}</small>` : ''}`;
    if (text && this.state !== 'results') {
      if (s.tag.innerHTML !== text) s.tag.innerHTML = text;
      this.game.ui.place(s.tag, _v.set(s.x, s.y - 0.9, 0), this.camera);
    } else s.tag.style.display = 'none';
  }

  updateTargets(dt) {
    for (const tg of this.targets) {
      tg.t += dt;
      if (tg.kind === 'duck') this.updateDuck(tg, dt);
      else this.updateClay(tg, dt);
      // Screen-plane position and velocity (for hits and aim assist).
      const pr = this.project(tg.pos);
      if (dt > 0) { tg.svx = (pr.x - tg.sx) / dt; tg.svy = (pr.y - tg.sy) / dt; }
      if (tg.t <= dt) tg.svx = tg.svy = 0;
      tg.sx = pr.x; tg.sy = pr.y; tg.ss = pr.s;
    }
  }

  updateDuck(tg, dt) {
    const m = tg.model;
    const wings = m.userData.wings;
    if (tg.state === 'fly' || tg.state === 'escape') {
      tg.pos.addScaledVector(tg.vel, dt);
      if (tg.state === 'fly') {
        if (!tg.emerged && tg.pos.y > GRASS_TOP + 0.8) tg.emerged = true;
        tg.turnT -= dt;
        if (tg.turnT <= 0 && tg.emerged) this.newHeading(tg);
        const L = -this.halfW + 1, R = this.halfW - 1;
        if (tg.pos.x < L) { tg.pos.x = L; tg.vel.x = Math.abs(tg.vel.x); }
        if (tg.pos.x > R) { tg.pos.x = R; tg.vel.x = -Math.abs(tg.vel.x); }
        if (tg.emerged && tg.pos.y < GRASS_TOP + 0.6) { tg.pos.y = GRASS_TOP + 0.6; tg.vel.y = Math.abs(tg.vel.y); }
        if (tg.pos.y > this.top - 1.3) { tg.pos.y = this.top - 1.3; tg.vel.y = -Math.abs(tg.vel.y); }
      } else if (tg.pos.y > this.top + 2.5) {
        tg.state = 'done';
        this.marks[tg.mark].state = 'miss';
        m.visible = false;
      }
      tg.flap += dt * (tg.state === 'escape' ? 26 : 18);
      const f = Math.sin(tg.flap);
      for (const w of wings) w.rotation.x = w.userData.side * (0.2 + f * 0.75);
      // Side view toward the flight direction, turned a bit toward the camera.
      const dir = tg.vel.x >= 0 ? 1 : -1;
      const yaw = dir > 0 ? -0.35 : Math.PI + 0.35;
      m.rotation.y += (yaw - m.rotation.y) * Math.min(1, dt * 10);
      m.rotation.z = clamp(tg.vel.y / tg.speed, -0.6, 0.9) * 0.5 * dir;
      m.rotation.x = 0;
    } else if (tg.state === 'hit') {
      // Frozen in the zap: flicker bright.
      zapTint(m, Math.floor(tg.t * 16) % 2 === 0, Math.floor(tg.t * 8) % 2 ? 0xffffff : tg.by.p.color);
      for (const w of wings) w.rotation.x = w.userData.side * 1.2;
      if (tg.t > 0.5) {
        zapTint(m, false);
        tg.state = 'fall';
        tg.t = 0;
        tg.fallX = tg.pos.x;
        this.game.audio.play('dizzy');
      }
    } else if (tg.state === 'fall') {
      tg.pos.y -= (5 + tg.t * 10) * dt;
      m.rotation.y += dt * 14;
      m.rotation.z = Math.PI * 0.85;
      for (const w of wings) w.rotation.x = w.userData.side * (0.6 + Math.sin(tg.t * 30) * 0.4);
      if (tg.pos.y < 1) {
        tg.state = 'done';
        m.visible = false;
        this.puffs.burst(new THREE.Vector3(tg.pos.x, GRASS_TOP - 0.4, 2.2), 0x9fe08a, { count: 6, size: 0.5, life: 0.5, speed: 2 });
        this.game.audio.play('land');
      }
    }
  }

  updateClay(tg, dt) {
    const m = tg.model;
    if (tg.state === 'wait') {
      tg.delay -= dt;
      if (tg.delay <= 0) { tg.state = 'fly'; m.visible = true; tg.t = 0; }
      return;
    }
    if (tg.state !== 'fly') return;
    tg.vel.y -= 5.5 * dt;
    tg.pos.addScaledVector(tg.vel, dt);
    m.rotation.y += tg.spin * dt;
    m.rotation.x = 0.35;
    if (tg.pos.z < -110 || tg.pos.y < -0.5) {
      tg.state = 'done';
      m.visible = false;
      this.marks[tg.mark].state = 'miss';
    }
  }

  // ---------- the dog ----------

  /** Dog pops up behind the grass with the ducks it caught, or laughs when there are none. */
  startPop(hits, x, length) {
    for (const h of this.held) h.parent?.remove(h);
    this.held = [];
    const laugh = hits.length === 0;
    if (!laugh && !this.clay) {
      const hands = this.popDog.userData.hands;
      hits.slice(0, 2).forEach((tg, i) => {
        const duck = makeDuck(tg.type);
        duck.scale.setScalar(0.75);
        // Held by the neck, hanging down.
        duck.rotation.set(0, i ? 0.5 : -0.5, Math.PI / 2 - 0.15);
        duck.position.set(0.25, -0.5, 0.25);
        for (const w of duck.userData.wings) w.rotation.x = w.userData.side * 0.15;
        const hand = hands.length === 2 && hits.length === 1 ? hands[1] : hands[i];
        hand.add(duck);
        this.held.push(duck);
      });
    }
    this.popAnim = { t: 0, length, laugh, x, n: hits.length };
    this.popDog.visible = true;
    this.popDog.position.set(x, -1, DOG_Z);
    this.game.audio.play(laugh ? 'boing' : 'coin');
  }

  updateDogs(dt) {
    // Walk-in: sniff along the strip, spot the ducks, jump into the grass.
    const A = this.dogAnim;
    const d = this.dog;
    if (A) {
      A.t += dt;
      const u = d.userData;
      if (A.t < A.walk) {
        const k = A.t / A.walk;
        d.position.x = A.x0 + (A.x1 - A.x0) * k;
        d.position.y = STRIP_TOP;
        d.position.z = 5;
        const step = A.t * 11;
        u.legs.forEach((l, i) => { l.rotation.z = Math.sin(step + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI / 2 : 0)) * 0.55; });
        u.head.rotation.z = -0.35 + Math.sin(A.t * 9) * 0.15; // nose down, sniffing
        u.head.position.y = 1.2 + Math.sin(A.t * 9) * 0.04;
        u.tail.rotation.z = 0.6 + Math.sin(A.t * 16) * 0.35;
        if (!A.sniffed && A.t > A.walk * 0.5) { A.sniffed = true; this.game.audio.play('select'); }
      } else if (A.t < A.walk + 0.55) {
        // Spotted! Head up, ears perk, "!".
        u.legs.forEach((l) => { l.rotation.z = 0; });
        u.head.rotation.z = 0.25;
        u.head.position.y = 1.32;
        u.tail.rotation.z = 0.2;
        if (!u.bang.visible) { u.bang.visible = true; this.game.audio.play('beep'); }
        u.bang.scale.setScalar(1 + Math.sin(A.t * 30) * 0.12);
      } else {
        // Jump in an arc over and behind the grass.
        const j = (A.t - A.walk - 0.55) / 0.9;
        if (!A.jumped) { A.jumped = true; u.bang.visible = false; this.game.audio.play('jump'); }
        d.position.x = A.x1 + j * 2.5;
        d.position.z = 5 + (DOG_Z - 5) * Math.min(1, j * 1.3);
        d.position.y = STRIP_TOP + Math.sin(Math.min(j, 1) * Math.PI) * 3.8 - Math.max(0, j - 0.5) * 6;
        d.rotation.z = 0.5 - j * 1.1;
        u.legs.forEach((l, i) => { l.rotation.z = (i < 2 ? -1 : 1) * 0.9; });
        if (j >= 1) {
          this.dogAnim = null;
          d.visible = false;
          d.rotation.z = 0;
          this.puffs.burst(new THREE.Vector3(d.position.x, GRASS_TOP, 2.5), 0x9fe08a, { count: 8, size: 0.6, life: 0.5, speed: 3 });
          this.game.audio.play('land');
        }
      }
    }

    // Pop-up: rise, hold (show the catch or laugh), sink.
    const P = this.popAnim;
    const g = this.popDog;
    if (P) {
      P.t += dt;
      const up = 3.1;
      const rise = Math.min(1, P.t / 0.35);
      const sink = Math.max(0, (P.t - (P.length - 0.4)) / 0.4);
      const e = (v) => 1 - (1 - v) * (1 - v);
      g.position.y = -1 + (up + 1) * (e(rise) - sink * sink);
      const u = g.userData;
      if (P.laugh) {
        // Ha ha: bobbing head, mouth open, eyes squeezed, paws on the belly.
        const b = Math.sin(P.t * 22);
        u.head.position.y = 1.95 + Math.abs(b) * 0.12;
        u.mouth.scale.set(1.3, 0.9 + Math.abs(b) * 0.7, 0.6);
        u.tongue.visible = true;
        u.eyes.scale.y = 0.25;
        u.arms.forEach((a) => { a.rotation.z = a.userData.side * 2.5; a.rotation.x = -0.6; });
        if (!P.laughed && P.t > 0.7) { P.laughed = true; this.game.audio.play('boing'); }
        if (!P.label && P.t > 0.2) {
          P.label = true;
          this.floater(t('duckhunt.ha'), '#b8752f', new THREE.Vector3(g.position.x, up + 3.2, DOG_Z));
        }
      } else {
        // Proud: arms up with the catch, grin, wagging.
        u.head.position.y = 1.95;
        u.head.rotation.z = Math.sin(P.t * 6) * 0.08;
        u.mouth.scale.set(1.3, 0.45, 0.6);
        u.tongue.visible = false;
        u.eyes.scale.y = 1;
        u.arms.forEach((a) => {
          const rest = P.n === 1 && a.userData.side < 0 && !this.clay; // one duck: the other paw rests
          a.rotation.z = rest ? a.userData.side * 2.6 : -a.userData.side * (0.45 + Math.sin(P.t * 8) * 0.06);
          a.rotation.x = 0;
        });
      }
      if (P.t >= P.length) {
        this.popAnim = null;
        g.visible = false;
        for (const h of this.held) h.parent?.remove(h);
        this.held = [];
      }
    }
  }

  // ---------- effects, HUD, callouts ----------

  showCallout(title, sub, seconds) {
    this.callout.innerHTML = `${esc(title)}${sub ? `<small>${esc(sub)}</small>` : ''}`;
    this.callout.style.display = '';
    this.calloutT = seconds;
  }

  updateFx(dt) {
    if (this.calloutT > 0) {
      this.calloutT -= dt;
      if (this.calloutT <= 0) this.callout.style.display = 'none';
    }
    for (const f of this.floaters) {
      f.t += dt;
      f.pos.y += dt * 1.4;
      this.game.ui.place(f.el, f.pos, this.camera);
      f.el.style.opacity = String(Math.min(1, 3 * (1.3 - f.t)));
    }
    const done = this.floaters.filter((f) => f.t > 1.3);
    if (done.length) {
      for (const f of done) f.el.remove();
      this.floaters = this.floaters.filter((f) => f.t <= 1.3);
    }
  }

  teamScore() {
    return this.shooters.reduce((n, s) => n + s.score, 0) + this.teamBonus;
  }

  hud() {
    const ui = this.game.ui;
    if (this.state === 'results') { ui.bar([]); return; }
    if (!this.marks) { ui.setTop(''); return; }
    const flying = this.phase === 'flight' ? new Set(this.targets.map((tg) => tg.mark)) : new Set();
    const size = 'width:clamp(12px,1.5vw,22px);height:clamp(12px,1.5vw,22px)';
    const marks = this.marks.map((m, i) => {
      const bg = m.state === 'hit' ? m.css : m.state === 'miss' ? '#b9b2cc' : '#fff';
      const cls = flying.has(i) && m.state === 'pending' ? ' class="blink"' : '';
      const quota = i === this.quota - 1 ? '<span style="display:inline-block;width:4px;height:clamp(16px,2vw,28px);background:#ff3b5c;border-radius:2px;margin:0 4px;vertical-align:middle"></span>' : '';
      return `<span${cls} style="display:inline-block;${size};border-radius:50%;margin:0 2px;vertical-align:middle;background:${bg};border:3px solid #2b2340"></span>${quota}`;
    }).join('');
    const best = this.game.roster.progress.duckhunt?.best || 0;
    const bestPill = best ? `<div class="pill">${t('duckhunt.best', { n: best })}</div>` : '';
    const score = this.versus ? '' : `<div class="pill"><b>${t('duckhunt.teamScore', { n: this.teamScore() })}</b></div>`;
    ui.setTop(`<div class="pill hud-title">${t('duckhunt.round', { n: this.round })}</div>
      <div class="pill">${marks} <small style="margin-left:6px">${t('duckhunt.need', { q: this.quota })}</small></div>
      ${score}${bestPill}`);
    ui.bar(this.players, (p) => {
      const s = this.shooters.find((x) => x.p === p);
      if (!s) return '';
      const cells = Array.from({ length: AMMO }, (_, i) => `<span style="display:inline-block;width:0.55em;height:1em;margin-left:3px;border-radius:3px;border:2px solid #2b2340;vertical-align:middle;background:${i < s.ammo ? p.css : '#fff'};box-shadow:inset 0 3px 0 rgba(255,255,255,0.45)"></span>`).join('');
      return `${cells}<span style="margin-left:10px">${s.score}</span>`;
    });
  }

  // ---------- results ----------

  /** Story campaign: reached round, hits and score. */
  campaignStats() {
    return { round: this.round, score: this.teamScore(), hits: this.shooters.reduce((n, s) => n + s.hits, 0) };
  }

  end() {
    if (this.state === 'results') return;
    for (const s of this.shooters) s.tag.style.display = 'none';
    this.callout.style.display = 'none';
    const total = this.teamScore();
    const ranked = [...this.shooters].sort((a, b) => b.score - a.score || b.hits - a.hits);
    const top = ranked[0].score;
    const score = this.versus ? top : total;
    const roster = this.game.roster;
    const saved = roster.progress.duckhunt || { best: 0, bestRound: 0 };
    const newBest = score > (saved.best || 0);
    roster.progress.duckhunt = { best: Math.max(saved.best || 0, score), bestRound: Math.max(saved.bestRound || 0, this.round) };
    roster.save();
    let title;
    if (this.versus) {
      // Equal points: more hits wins.
      const winners = ranked.filter((s) => s.score === top && s.hits === ranked[0].hits);
      title = top > 0 && winners.length === 1 ? t('win', { name: winners[0].p.name }) : t('tie');
    } else title = t('duckhunt.gameOver');
    let subtitle = this.versus ? t('duckhunt.subVs', { r: this.round }) : t('duckhunt.sub', { r: this.round, score: total });
    if (newBest) subtitle += ` · ${t('duckhunt.newBest')}`;
    this.finish({
      title,
      subtitle,
      rows: ranked.map((s) => ({
        css: s.p.css, name: s.p.name, value: String(s.score),
        detail: t(s.hits === 1 ? 'duckhunt.detail1' : 'duckhunt.detail', { hits: s.hits }),
        crown: this.versus ? s.score === top && s.hits === ranked[0].hits && top > 0 : this.shooters.length > 1 && s.score === top && top > 0,
      })),
      stars: Math.min(5, 1 + Math.floor(this.round / 2)),
    });
  }
}
