import * as THREE from 'three';
import { MiniGame } from '../core/minigame.js';
import { COLORS, PLAYER_COLORS, toon } from '../core/palette.js';
import { addLights, skyTexture } from '../core/world.js';
import { t, addStrings } from '../core/i18n.js';
import { esc } from '../core/ui.js';
import { TeamPicker, TEAM_COLORS, TEAM_CSS, helpersNeeded } from '../core/teams.js';
import { VotePicker, voteLength } from '../core/vote.js';
import { makePlane, makeBlimp, makeChute, makePellet, addSplat, buildWorld, tint, XW, SEA_X, RUNWAY } from './dogfight/models.js';
import { FLY, makeFlight, flightStep, botControl, pitchOf, clamp } from './dogfight/flight.js';

// Paint Pilots: side-view biplane dogfights (Triplane Turmoil / Luftrausers spirit) on one shared
// screen. The stick points the nose, [A] boosts, [B] fires paint pellets, [C] does a barrel roll.
// Climb too steeply and you stall. Three paint hits and a plane sputters: the pilot parachutes
// down in a burst of confetti and is back in the air three seconds later; the painter scores.
// Modes (by vote): free for all, two teams, or co-op against waves of grumble planes and blimps.

addStrings({
  en: {
    'game.dogfight': 'Paint Pilots',
    'dogfight.modeQ': 'Which dogfight?',
    'dogfight.mode.ffa': 'Free for all', 'dogfight.mode.teams': 'Teams', 'dogfight.mode.coop': 'Co-op vs grumbles',
    'dogfight.intro': 'Stick points the nose · [A] boost · [B] paint · [C] barrel roll',
    'dogfight.goal.ffa': 'Three paint hits make a plane sputter. The painter gets the point!',
    'dogfight.goal.teams': "Paint the other team's planes. Three hits and they sputter!",
    'dogfight.goal.coop': 'Stop the grumble air show together: planes, blimps and a King Blimp!',
    'dogfight.takeoff': 'take off!',
    'dogfight.stall': 'STALL!',
    'dogfight.stallTip': 'Stall! Climb too steeply and you lose speed. Let the nose drop to pick it up again.',
    'dogfight.landTip': 'Tip: land gently on the runway to wash the paint off your plane.',
    'dogfight.clean': 'Squeaky clean!',
    'dogfight.bonk': 'Bonk!', 'dogfight.splash': 'Splash!',
    'dogfight.jam': 'refilling paint',
    'dogfight.bot.0': 'Red Grumble', 'dogfight.bot.1': 'Baron Grumble', 'dogfight.helper': 'Helper Grumble',
    'dogfight.wave': 'Wave {n} of {m}', 'dogfight.bossWave': 'Here comes the King Blimp!',
    'dogfight.waveHud': 'Wave {n}/{m}', 'dogfight.left': 'Grumbles left: {n}', 'dogfight.cleared': 'Wave cleared!',
    'dogfight.boss': 'King Blimp',
    'dogfight.pts': '{n} points', 'dogfight.pt1': '1 point',
    'dogfight.detail': '{h} hits · {c} parachutes',
    'dogfight.ffaSub': 'Three paint hits = one point',
    'dogfight.coopWin': 'The King Blimp is popped!', 'dogfight.coopLose': 'Time is up! You reached wave {n}',
    'dogfight.coopSub': 'Team points: {n}',
  },
  no: {
    'game.dogfight': 'Fargeflygerne',
    'dogfight.modeQ': 'Hvilken luftkamp?',
    'dogfight.mode.ffa': 'Alle mot alle', 'dogfight.mode.teams': 'Lag', 'dogfight.mode.coop': 'Sammen mot grumlingene',
    'dogfight.intro': 'Pinnen styrer nesen · [A] turbo · [B] maling · [C] rull',
    'dogfight.goal.ffa': 'Tre malingstreff, og flyet begynner å hoste. Den som malte, får poenget!',
    'dogfight.goal.teams': 'Mal flyene til det andre laget. Tre treff, og de begynner å hoste!',
    'dogfight.goal.coop': 'Stopp grumling-flyshowet sammen: fly, luftskip og et Kongeluftskip!',
    'dogfight.takeoff': 'ta av!',
    'dogfight.stall': 'STALL!',
    'dogfight.stallTip': 'Steiling! Stiger du for bratt, mister du farten. La nesen falle for å få fart igjen.',
    'dogfight.landTip': 'Tips: land forsiktig på rullebanen for å vaske malingen av flyet.',
    'dogfight.clean': 'Skinnende rent!',
    'dogfight.bonk': 'Bonk!', 'dogfight.splash': 'Plask!',
    'dogfight.jam': 'fyller maling',
    'dogfight.bot.0': 'Røde Grumling', 'dogfight.bot.1': 'Baron Grumling', 'dogfight.helper': 'Hjelpegrumling',
    'dogfight.wave': 'Bølge {n} av {m}', 'dogfight.bossWave': 'Her kommer Kongeluftskipet!',
    'dogfight.waveHud': 'Bølge {n}/{m}', 'dogfight.left': 'Grumlinger igjen: {n}', 'dogfight.cleared': 'Bølgen er klarert!',
    'dogfight.boss': 'Kongeluftskipet',
    'dogfight.pts': '{n} poeng', 'dogfight.pt1': '1 poeng',
    'dogfight.detail': '{h} treff · {c} fallskjermer',
    'dogfight.ffaSub': 'Tre malingstreff = ett poeng',
    'dogfight.coopWin': 'Kongeluftskipet er sprukket!', 'dogfight.coopLose': 'Tiden er ute! Dere kom til bølge {n}',
    'dogfight.coopSub': 'Lagpoeng: {n}',
  },
});

const MODES = ['ffa', 'teams', 'coop'];
const MAX_HITS = 3;
const CHUTE_TIME = 3; // parachute until respawn
const CRASH_TIME = 2.5;
const INVULN = 1.6;
const PELLET_SPEED = 32;
const PELLET_LIFE = 0.8;
const FIRE_CD = 0.14;
const HEAT_SHOT = 0.11, HEAT_COOL = 0.45; // paint tank: about 2.5 s of steady fire
const COOP_TIME = 300;
const CREDIT_TIME = 6; // crash soon after being painted: the painter gets the point
const WORLD_TOP = 52, WORLD_BOTTOM = -3;
const RED = 0xe0262f;
const PURPLE = 0x7b6cf6;
const GOO = 0xb08bff;

// Bot pilots. turn: turn-rate factor, cone/react: how well lined up and for how long before
// firing, jitter: aim wobble, lead: how much they lead the target, fireCd: slower trigger.
const SKILL = {
  ace: { turn: 0.8, cone: 0.13, react: 0.3, jitter: 0.12, lead: 0.75, dodge: 0.012, fireCd: 1.6 },
  helper: { turn: 0.78, cone: 0.13, react: 0.32, jitter: 0.14, lead: 0.7, dodge: 0.01, fireCd: 1.7 },
  grunt: { turn: 0.6, cone: 0.12, react: 0.5, jitter: 0.22, lead: 0.4, dodge: 0, fireCd: 2.4 },
  red: { turn: 0.8, cone: 0.14, react: 0.3, jitter: 0.12, lead: 0.75, dodge: 0.012, fireCd: 1.7 },
};

/** Co-op waves for n players: more grumbles with more pilots, then the King Blimp. */
function coopWaves(n) {
  const half = Math.ceil(n / 2);
  return [
    { planes: 1 + half, aces: 0, blimps: 0 },
    { planes: 1 + half, aces: 0, blimps: 1 },
    { planes: half, aces: 1 + (n >= 4 ? 1 : 0), blimps: n >= 3 ? 2 : 1 },
    { planes: 1 + Math.floor(n / 3), aces: n >= 5 ? 1 : 0, blimps: 0, boss: true },
  ];
}

const clock = (secs) => {
  const s = Math.max(0, Math.ceil(secs));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
const ptsText = (n) => (n === 1 ? t('dogfight.pt1') : t('dogfight.pts', { n }));

export class DogfightScene extends MiniGame {
  constructor(game, opts = {}) {
    super(game, opts);
    this.camera.fov = 26; // narrow lens: a flatter, more side-on look
    this.camera.far = 600;
    this.camera.updateProjectionMatrix();
    this.scene.background = skyTexture('#5fbfff', '#fff1d6');
    addLights(this.scene, { size: 60, target: new THREE.Vector3(0, 12, 0), dir: new THREE.Vector3(-0.35, 1, 0.7) });
    this.world = buildWorld(this.scene);

    this.ents = [];
    this.pellets = [];
    this.blimps = [];
    this.decor = []; // drifting grumble parachutes from popped blimps
    this.floaters = [];
    this.teamScore = [0, 0];
    this.mode = null;
    this.timeLeft = 0;
    this.matchTime = 0;
    this.wave = -1;
    this.won = false;
    this.tips = new Set();
    this.cam = { x: 0, y: 8, d: 40 };
    this.sfxT = 0;

    for (const p of this.players) this.ents.push(this.makeEnt({ p, kind: 'player', team: 0 }));
    this.parkAll();
    this.frameCamera(0, true);
    game.audio.playMusic('platformer');

    const title = () => t('game.dogfight');
    if (opts.mode || this.campaign) {
      this.chooseMode(MODES.includes(opts.mode) ? opts.mode : 'coop', { length: 150, ...opts });
    } else {
      this.state = 'vote';
      this.picker = new VotePicker(this, {
        title,
        vote: { question: () => t('dogfight.modeQ'), def: 'ffa', options: MODES.map((m) => ({ value: m, label: () => t(`dogfight.mode.${m}`) })) },
        onDone: (m) => { this.picker = null; this.chooseMode(m, opts); },
      });
    }
  }

  retryOptions() {
    return { key: this.key, mode: this.mode, length: this.matchTime || undefined };
  }

  onLanguage() {
    this.picker?.render();
  }

  // ---------- setup ----------

  chooseMode(mode, opts) {
    this.mode = mode;
    for (const e of this.ents) this.recolor(e);
    if (mode === 'coop') {
      this.timeLeft = COOP_TIME;
      this.waves = coopWaves(this.players.length);
      this.parkAll();
      this.startIntro();
      return;
    }
    this.state = 'vote';
    voteLength(this, opts, () => t('game.dogfight'), () => {
      if (mode === 'ffa') this.setupFfa();
      else this.pickTeams();
    });
  }

  setupFfa() {
    // Every pilot is their own team. Red grumble aces fill small groups.
    this.ents.forEach((e, i) => { e.team = 100 + i; });
    const n = this.players.length;
    const bots = n <= 2 ? 2 : n <= 4 ? 1 : 0;
    for (let i = 0; i < bots; i++) {
      const e = this.makeEnt({ kind: 'bot', team: 200 + i, slot: i });
      this.ents.push(e);
    }
    this.parkAll();
    this.startIntro();
  }

  pickTeams() {
    this.state = 'teams';
    this.ents.forEach((e, i) => this.setTeam(e, i % 2));
    this.parkAll();
    this.picker = new TeamPicker(this, {
      title: () => t('game.dogfight'),
      ents: this.ents,
      setTeam: (e, team) => this.setTeam(e, team),
      onChange: () => this.parkAll(),
      onDone: () => {
        this.picker = null;
        helpersNeeded(this.ents).forEach((need, team) => {
          for (let i = 0; i < need; i++) this.ents.push(this.makeEnt({ kind: 'bot', team, slot: i }));
        });
        this.parkAll();
        this.startIntro();
      },
    });
  }

  startIntro() {
    this.state = 'intro';
    this.intro(t('game.dogfight'), t('dogfight.intro'));
  }

  onStart() {
    this.game.ui.toast(t(`dogfight.goal.${this.mode}`), 3200);
    if (this.mode !== 'coop') this.later(25, () => this.state === 'play' && this.game.ui.toast(t('dogfight.landTip'), 3500));
    if (this.mode === 'coop') this.later(2, () => this.nextWave());
  }

  /** One plane with its pilot. kind: 'player', 'bot' (FFA ace or team helper) or 'enemy' (co-op). */
  makeEnt({ p = null, kind, team, slot = 0, type = 'plane' }) {
    let color, wing, planeKind = 'bi', pilot, skill = null, css, name;
    if (p) {
      color = p.color; pilot = { color: p.color, hat: p.hat }; css = p.css; name = p.name;
    } else if (kind === 'bot' && this.mode === 'teams') {
      color = TEAM_COLORS[team]; wing = tint(color, 0.5); pilot = { grumble: PURPLE }; skill = SKILL.helper;
      css = TEAM_CSS[team]; name = t('dogfight.helper');
    } else if (kind === 'bot') {
      color = RED; wing = slot ? 0xffd23f : 0xff7b7b; planeKind = 'tri'; pilot = { grumble: PURPLE }; skill = SKILL.ace;
      css = '#d62828'; name = t(`dogfight.bot.${slot % 2}`);
    } else if (type === 'ace') {
      color = RED; wing = 0xff7b7b; planeKind = 'tri'; pilot = { grumble: 0x4b3fb6 }; skill = SKILL.red; css = '#d62828'; name = '';
    } else {
      color = PURPLE; wing = 0xc9a8ff; pilot = { grumble: 0x5fd068 }; skill = SKILL.grunt; css = '#7b6cf6'; name = '';
    }
    const m = makePlane({ color, wing, kind: planeKind, pilot });
    this.scene.add(m.group);
    const chute = makeChute(p ? { color: p.color, hat: p.hat } : { color: tint(color, 0.15), grumble: pilot.grumble });
    this.scene.add(chute.group);
    const e = {
      p, kind, bot: !p, team, slot, type, skill, name, css, color,
      m, chute, fl: makeFlight(0, FLY.groundY, 1, 0, true),
      state: 'fly', t: 0, hits: 0, maxHits: MAX_HITS, invuln: 0,
      heat: 0, jam: false, fireCd: 0, washT: 0, fxT: 0,
      lastHitBy: null, lastHitT: -99,
      points: 0, stat: { hits: 0, pops: 0, chutes: 0, crashes: 0 },
      roll: 0.35, wreck: false, poofed: false, z: ((this.ents.length % 5) - 2) * 0.14,
      chuteX: 0, chuteY: 0, chuteVx: 0, chuteVy: 0,
    };
    if (skill) e.fl.turnMul = skill.turn;
    if (kind !== 'enemy') {
      e.tag = this.game.ui.label('label player-tag');
      e.tag.style.color = css;
      e.tagHtml = '';
      e.stallEl = this.game.ui.label('label');
      e.stallEl.style.color = '#ff3b5c';
      e.stallEl.style.display = 'none';
    }
    return e;
  }

  setTeam(e, team) {
    e.team = team;
    this.recolor(e);
  }

  /** In team games the wings show the team color; otherwise a light tint of the plane color. */
  recolor(e) {
    if (e.kind !== 'player') return;
    const wing = this.mode === 'teams' ? TEAM_COLORS[e.team] : tint(e.color, 0.45);
    for (const w of e.m.wings) w.material = toon(wing);
  }

  /** Lines everyone up on the runway. Teams take off away from each other. */
  parkAll() {
    const list = this.ents.filter((e) => e.kind !== 'enemy');
    const left = [], right = [];
    list.forEach((e, i) => {
      if (this.mode === 'coop') right.push(e);
      else if (this.mode === 'teams') (e.team === 0 ? left : right).push(e);
      else (i % 2 ? right : left).push(e);
    });
    const place = (e, x, dir) => {
      e.fl = makeFlight(x, FLY.groundY, dir, 0, true);
      if (e.skill) e.fl.turnMul = e.skill.turn;
      e.roll = dir > 0 ? 0.25 : Math.PI - 0.25;
      e.state = 'fly';
      this.updateModel(e, 0);
    };
    if (this.mode === 'coop') right.forEach((e, k) => place(e, -RUNWAY + 3 + k * 4.4, 1));
    else {
      left.forEach((e, k) => place(e, -2.5 - k * 4.4, -1));
      right.forEach((e, k) => place(e, 2.5 + k * 4.4, 1));
    }
  }

  // ---------- co-op waves ----------

  nextWave() {
    if (this.state !== 'play') return;
    this.wave++;
    this.clearing = false;
    if (this.wave >= this.waves.length) { this.won = true; this.end(); return; }
    const w = this.waves[this.wave];
    this.game.ui.banner(w.boss ? t('dogfight.bossWave') : t('dogfight.wave', { n: this.wave + 1, m: this.waves.length }), '', 1800);
    this.game.audio.play('star');
    const q = [];
    if (w.boss) q.push('boss');
    for (let i = 0; i < w.blimps; i++) q.push('blimp');
    for (let i = 0; i < w.planes; i++) q.push('plane');
    for (let i = 0; i < w.aces; i++) q.push('ace');
    this.spawnQueue = q;
    this.spawnT = 1.2;
    this.escortT = 12;
    this.escorts = w.boss ? w.planes : 0;
  }

  spawnEnemy(type) {
    const side = Math.random() < 0.5 ? -1 : 1;
    if (type === 'boss' || type === 'blimp') { this.spawnBlimp(type === 'boss', side); return; }
    const e = this.makeEnt({ kind: 'enemy', team: 1, type });
    e.fl = makeFlight(side * (XW - 1), 18 + Math.random() * 14, -side, 15);
    e.fl.turnMul = e.skill.turn;
    e.roll = -side > 0 ? 0.25 : Math.PI - 0.25;
    e.invuln = 0.8;
    this.ents.push(e);
  }

  spawnBlimp(boss, side) {
    const n = this.players.length;
    const size = boss ? 2 : 1;
    const color = boss ? 0x9b5de5 : [0xff9fd0, 0x8fd8ff, 0xffb347][this.blimps.length % 3];
    const m = makeBlimp(size, color, boss);
    this.scene.add(m.group);
    const hp = boss ? 24 + 8 * n : 6 + 2 * n;
    const y = boss ? 27 : 17 + Math.random() * 15;
    const b = {
      m, boss, size, hp, maxHp: hp, x: side * (XW + 4 * size), y, baseY: y, dir: -side,
      speed: boss ? 2.2 : 3, fireT: 2 + Math.random() * 2, t: Math.random() * 6, flash: 0, splats: 0,
      // Blimps own their goo balls, so they keep the same score fields as a plane.
      team: 1, color: GOO, css: '#8a45e0', points: 0, stat: { hits: 0, pops: 0, chutes: 0, crashes: 0 },
    };
    b.tag = this.game.ui.label('label player-tag');
    b.tagHtml = '';
    this.blimps.push(b);
  }

  updateWaves(dt) {
    if (this.wave < 0 || this.wave >= this.waves.length) return;
    if (this.spawnQueue.length) {
      this.spawnT -= dt;
      if (this.spawnT <= 0) {
        this.spawnEnemy(this.spawnQueue.shift());
        this.spawnT = 1.1;
      }
    }
    // The King Blimp calls for fresh escorts now and then.
    const boss = this.blimps.find((b) => b.boss);
    if (boss && this.escorts > 0) {
      this.escortT -= dt;
      const flying = this.ents.filter((e) => e.kind === 'enemy' && e.state === 'fly').length;
      if (this.escortT <= 0 && flying < this.escorts) { this.spawnEnemy('plane'); this.escortT = 10; }
    }
    const left = this.enemiesLeft();
    if (!this.spawnQueue.length && left === 0 && !this.clearing) {
      this.clearing = true;
      if (this.wave < this.waves.length - 1) {
        this.game.ui.toast(t('dogfight.cleared'), 1800);
        this.game.audio.play('rescue');
      }
      this.later(this.wave < this.waves.length - 1 ? 2.5 : 1.5, () => this.nextWave());
    }
  }

  enemiesLeft() {
    return this.ents.filter((e) => e.kind === 'enemy' && e.state === 'fly').length + this.blimps.length + (this.spawnQueue?.length || 0);
  }

  // ---------- planes ----------

  /** Everything a bot could shoot at, for its team. */
  targetsFor(team) {
    const out = [];
    for (const o of this.ents) {
      if (o.team === team || o.state !== 'fly' || o.invuln > 0.3) continue;
      out.push({ x: o.fl.x, y: o.fl.y, vx: o.fl.vx, vy: o.fl.vy });
    }
    if (team !== 1 || this.mode !== 'coop') {
      if (this.mode === 'coop') for (const b of this.blimps) out.push({ x: b.x, y: b.y, vx: b.dir * b.speed, vy: 0, big: true });
    }
    return out;
  }

  /** True if a foe's pellet is about to hit this plane (bots use it to barrel roll). */
  threatened(e) {
    for (const p of this.pellets) {
      if (p.team === e.team) continue;
      const dx = e.fl.x - p.x, dy = e.fl.y - p.y;
      if (dx * dx + dy * dy < 25 && dx * (p.vx - e.fl.vx) + dy * (p.vy - e.fl.vy) > 0) return true;
    }
    return false;
  }

  controlFor(e, dt) {
    const playing = this.state === 'play';
    if (!playing) return { x: 0, y: 0, boost: false, fire: false, rollPressed: false };
    if (e.p) {
      const d = this.input(e.p) || {};
      return { x: d.x || 0, y: d.y || 0, boost: !!d.a, fire: !!d.b, rollPressed: !!d.cPressed };
    }
    const threat = e.skill.dodge > 0 && this.threatened(e);
    return botControl(e, this.targetsFor(e.team), this.time, dt, e.skill, XW, PELLET_SPEED, threat);
  }

  updatePlane(e, dt) {
    const f = e.fl;
    const ctl = this.controlFor(e, dt);
    // Soft walls: past the pylons the plane is turned back toward the middle.
    if ((f.x > XW - 1 && Math.cos(f.ang) > -0.3) || (f.x < -XW + 1 && Math.cos(f.ang) < 0.3)) {
      ctl.x = f.x > 0 ? -1 : 1;
      ctl.y = 0.7;
    }
    const ev = flightStep(f, ctl, dt);
    if (ev === 'stall') this.onStall(e);
    else if (ev === 'roll') { this.game.audio.play('whoosh'); e.m.ch?.squash(0.8); }
    else if (ev === 'boost' && e.p) this.game.audio.play('dash');
    else if (ev === 'liftoff' && e.p) this.game.audio.play('jump');

    for (const s of [-1, 1]) {
      const edge = s * (XW - 2);
      if (s * f.x > s * edge) f.vx -= (f.x - edge) * 8 * dt;
      if (s * f.x > XW + 2) { f.x = s * (XW + 2); if (s * f.vx > 0) f.vx = 0; }
    }
    if (f.y > WORLD_TOP - 2) { f.y = WORLD_TOP - 2; f.vy = Math.min(f.vy, 0); }

    // Touching the ground: a gentle landing rolls on, anything else is a soft bonk.
    if (!f.grounded && f.y <= FLY.groundY) {
      if (f.x < SEA_X) this.crash(e, true);
      else if (f.vy > -7.5 && Math.abs(pitchOf(f)) < 0.5) {
        f.grounded = true;
        f.y = FLY.groundY;
        f.vy = 0;
        f.ang = f.facing > 0 ? 0 : Math.PI;
        f.stalled = false;
        if (e.p) this.game.audio.play('land');
        this.puffs.burst(new THREE.Vector3(f.x, 0.2, e.z), 0xffffff, { count: 6, size: 0.4, life: 0.5, speed: 3 });
      } else {
        this.crash(e, false);
      }
    }
    if (e.state !== 'fly') return;
    if (f.grounded && f.x < SEA_X) { this.crash(e, true); return; }

    // Rolling on the runway washes the paint off.
    if (f.grounded && Math.abs(f.x) < RUNWAY && this.state === 'play' && (e.hits > 0 || f.boost < 0.99 || e.heat > 0.3)) {
      e.washT += dt;
      if (e.washT > 0.8) {
        e.washT = 0;
        const had = e.hits > 0;
        e.hits = 0; e.heat = 0; e.jam = false; f.boost = 1;
        e.m.splats.clear();
        if (had) {
          this.floater(t('dogfight.clean'), new THREE.Vector3(f.x, f.y + 2, 0), e.css);
          this.game.audio.play('coin');
          this.confetti.burst(new THREE.Vector3(f.x, f.y + 1, e.z), 0, { count: 14, speed: 4, colors: [0xbfe9ff, COLORS.white], life: 0.8, gravity: -4, size: 0.14 });
        }
      }
    } else {
      e.washT = 0;
    }

    // Paint pellets.
    e.heat = Math.max(0, e.heat - HEAT_COOL * dt);
    if (e.jam && e.heat < 0.35) e.jam = false;
    e.fireCd -= dt;
    if (ctl.fire && this.state === 'play' && !f.grounded && !e.jam && e.fireCd <= 0) this.shoot(e);

    // Effects: stall sputter, boost puffs, damage drips.
    e.fxT -= dt;
    if (e.fxT <= 0) {
      const tail = new THREE.Vector3(f.x - Math.cos(f.ang) * 1.6, f.y - Math.sin(f.ang) * 1.6, e.z);
      if (f.stalled) {
        e.fxT = 0.1;
        const nose = new THREE.Vector3(f.x + Math.cos(f.ang) * 1.4, f.y + Math.sin(f.ang) * 1.4, e.z + 0.3);
        this.puffs.burst(nose, 0x8c86a8, { count: 1, size: 0.55, life: 0.6, speed: 1.5 });
        if (e.p && this.sfxOk()) this.game.audio.tone(80 + Math.random() * 30, 0.07, { type: 'square', vol: 0.05 });
      } else if (f.boosting) {
        e.fxT = 0.05;
        this.puffs.burst(tail, 0xffffff, { count: 1, size: 0.45, life: 0.45, speed: 0.6 });
      } else if (e.hits >= 2) {
        e.fxT = 0.2;
        this.puffs.burst(tail, e.lastHitBy?.color ?? 0xcccccc, { count: 1, size: 0.35, life: 0.5, speed: 0.5 });
      } else {
        e.fxT = 0.1;
      }
    }
  }

  onStall(e) {
    this.game.audio.play('dizzy');
    if (e.p && !this.tips.has('stall')) {
      this.tips.add('stall');
      this.game.ui.toast(t('dogfight.stallTip'), 3800);
    }
  }

  sfxOk() {
    // Keeps rapid little sounds (shots, sputters) from piling up.
    if (this.time - this.sfxT < 0.06) return false;
    this.sfxT = this.time;
    return true;
  }

  shoot(e) {
    const f = e.fl;
    let ang = f.ang + (Math.random() - 0.5) * 0.05;
    const enemy = e.kind === 'enemy';
    const speed = enemy ? 24 : PELLET_SPEED;
    // A gentle aim assist for players: pellets bend toward a foe that is nearly lined up.
    if (e.p) {
      let best = null, bestErr = 0.15;
      for (const o of this.targetsFor(e.team)) {
        const d = Math.hypot(o.x - f.x, o.y - f.y);
        if (d > 30) continue;
        const lt = d / speed;
        const a = Math.atan2(o.y + o.vy * lt - f.y, o.x + o.vx * lt - f.x);
        const err = Math.abs(Math.atan2(Math.sin(a - f.ang), Math.cos(a - f.ang)));
        if (err < bestErr * (o.big ? 2 : 1)) { bestErr = err; best = a; }
      }
      if (best !== null) ang += Math.atan2(Math.sin(best - ang), Math.cos(best - ang)) * 0.6;
    }
    const color = enemy ? GOO : e.kind === 'bot' && this.mode === 'teams' ? TEAM_COLORS[e.team] : e.color;
    const mesh = makePellet(color);
    this.scene.add(mesh);
    const c = Math.cos(ang), s = Math.sin(ang);
    this.pellets.push({
      mesh, owner: e, team: e.team, color, r: 0.2,
      x: f.x + Math.cos(f.ang) * 1.7, y: f.y + Math.sin(f.ang) * 1.7,
      vx: c * speed + f.vx, vy: s * speed + f.vy, life: PELLET_LIFE * (enemy ? 1.1 : 1),
    });
    e.fireCd = FIRE_CD * (e.skill ? e.skill.fireCd : 1);
    e.heat += HEAT_SHOT;
    if (e.heat >= 1) {
      e.jam = true;
      if (e.p) this.game.audio.play('bump');
    }
    if (e.p && this.sfxOk()) this.game.audio.tone(620 + Math.random() * 120, 0.05, { type: 'sine', vol: 0.06, slide: 0.55 });
  }

  /** A paint pellet lands on a plane. */
  hitPlane(v, pel) {
    if (v.invuln > 0 || v.fl.rollT > 0) return false; // barrel rolls dodge paint
    const by = pel.owner;
    v.hits++;
    by.stat.hits++;
    v.lastHitBy = by;
    v.lastHitT = this.time;
    addSplat(v.m.splats, pel.color);
    v.fl.vx += pel.vx * 0.015;
    v.fl.vy += pel.vy * 0.015;
    this.puffs.burst(new THREE.Vector3(pel.x, pel.y, v.z + 0.4), pel.color, { count: 6, size: 0.3, life: 0.4, speed: 3 });
    if (v.p || by.p) this.game.audio.play('splat');
    v.m.ch?.squash(0.8);
    if (v.hits >= v.maxHits) this.sputter(v, by);
    return true;
  }

  /** Points for popping a plane. The same team never scores off itself. */
  award(by, victim, value = 1) {
    if (!by || by.team === victim.team) return;
    by.points += value;
    by.stat.pops++;
    if (this.mode === 'teams' && by.team < 2) this.teamScore[by.team] += value;
    const pos = victim.fl ? new THREE.Vector3(victim.fl.x, victim.fl.y + 2.4, 0) : new THREE.Vector3(victim.x, victim.y + 3, 0);
    this.floater(`+${value}`, pos, by.css);
    by.m?.ch?.squash(1.3);
  }

  /** Three hits: the engine sputters, the pilot pops out under a parachute in a burst of confetti. */
  sputter(e, by) {
    this.award(by, e, e.type === 'ace' ? 2 : 1);
    e.state = 'chute';
    e.t = 0;
    e.stat.chutes++;
    e.wreck = true;
    e.poofed = false;
    e.fl.dead = true;
    e.fl.engine = false;
    e.fl.stalled = false;
    e.m.pilotSlot.visible = false;
    e.chuteX = e.fl.x;
    e.chuteY = e.fl.y + 1.5;
    e.chuteVx = e.fl.vx * 0.25;
    e.chuteVy = 7;
    e.chute.group.visible = true;
    e.chute.group.scale.set(0.2, 0.2, 0.2);
    const pos = new THREE.Vector3(e.fl.x, e.fl.y + 0.5, e.z + 0.5);
    this.confetti.burst(pos, 0, { count: 40, speed: 8, up: 5, colors: [e.color, by.color, COLORS.gold, COLORS.white], life: 1.4, gravity: -8, size: 0.2 });
    this.game.audio.play('pop');
    this.later(0.15, () => this.game.audio.play('boing'));
  }

  /** Ground or sea contact. No harsh penalty: a puff, a short wait, and back in the air. */
  crash(e, water) {
    const f = e.fl;
    if (e.lastHitBy && this.time - e.lastHitT < CREDIT_TIME) this.award(e.lastHitBy, e, e.type === 'ace' ? 2 : 1);
    e.state = 'crash';
    e.t = 0;
    e.water = water;
    e.poofed = false;
    e.stat.crashes++;
    f.dead = true;
    f.engine = false;
    f.stalled = false;
    f.y = water ? -0.2 : FLY.groundY;
    f.vy = water ? 0 : 6;
    f.vx *= 0.35;
    const pos = new THREE.Vector3(f.x, 0.6, e.z + 0.5);
    if (water) {
      this.puffs.burst(pos, COLORS.water, { count: 18, size: 0.6, life: 0.9, speed: 6 });
      this.puffs.burst(pos, COLORS.white, { count: 10, size: 0.5, life: 0.7, speed: 5 });
      this.game.audio.play('splat');
    } else {
      this.puffs.burst(pos, 0xf4e8d0, { count: 16, size: 0.7, life: 0.8, speed: 5 });
      this.game.audio.play('bump');
    }
    if (e.kind !== 'enemy') this.floater(water ? t('dogfight.splash') : t('dogfight.bonk'), new THREE.Vector3(f.x, 3, 0), e.css);
  }

  /** Air start after a parachute or a bonk, away from foes, flashing for a moment. */
  respawn(e) {
    if (e.kind === 'enemy') { this.remove(e); return; }
    const foes = this.ents.filter((o) => o.team !== e.team && o.state === 'fly');
    let best = null, bestScore = -Infinity;
    for (const x of [-XW + 9, -XW / 2, 0, XW / 2, XW - 9]) {
      const y = 22 + Math.random() * 8;
      let d = 60;
      for (const o of foes) d = Math.min(d, Math.hypot(o.fl.x - x, o.fl.y - y));
      for (const b of this.blimps) d = Math.min(d, Math.hypot(b.x - x, b.y - y) - 4);
      const score = d + Math.random() * 6;
      if (score > bestScore) { bestScore = score; best = { x, y }; }
    }
    const dir = best.x < 0 ? 1 : best.x > 0 ? -1 : (Math.random() < 0.5 ? 1 : -1);
    e.fl = makeFlight(best.x, best.y, dir, 15);
    if (e.skill) e.fl.turnMul = e.skill.turn;
    e.roll = dir > 0 ? 0.25 : Math.PI - 0.25;
    e.state = 'fly';
    e.hits = 0; e.heat = 0; e.jam = false;
    e.invuln = INVULN;
    e.wreck = false;
    e.lastHitBy = null;
    e.m.splats.clear();
    e.m.group.visible = true;
    e.m.pilotSlot.visible = true;
    e.chute.group.visible = false;
    this.puffs.burst(new THREE.Vector3(best.x, best.y, e.z), e.color, { count: 14, size: 0.5, life: 0.6, speed: 4 });
    if (e.p) this.game.audio.play('join');
  }

  remove(e) {
    e.state = 'gone';
    this.scene.remove(e.m.group);
    this.scene.remove(e.chute.group);
    e.tag?.remove();
    e.stallEl?.remove();
  }

  /** Falling wreck after a sputter, and the parachute drifting down. */
  updateDown(e, dt) {
    e.t += dt;
    const f = e.fl;
    if (e.state === 'chute') {
      if (e.wreck) {
        flightStep(f, { x: 0, y: 0 }, dt);
        e.fxT -= dt;
        if (e.fxT <= 0) {
          e.fxT = 0.07;
          this.puffs.burst(new THREE.Vector3(f.x, f.y, e.z), Math.random() < 0.5 ? e.lastHitBy?.color ?? 0xffffff : 0x9a94b2, { count: 1, size: 0.5, life: 0.6, speed: 1 });
        }
        if (f.y <= FLY.groundY + 0.2 || e.t > 1.6) this.poof(e);
      }
      // Parachute: pops up, opens, then sways down.
      e.chuteVy += (-2.2 - e.chuteVy) * Math.min(1, dt * 2.2);
      e.chuteVx *= Math.max(0, 1 - dt * 1.5);
      e.chuteX += (e.chuteVx + Math.sin(e.t * 1.7) * 0.8) * dt;
      e.chuteY = Math.max(3.0, e.chuteY + e.chuteVy * dt);
      e.chuteX = clamp(e.chuteX, -XW - 2, XW + 2);
      const open = Math.min(1, e.t / 0.4);
      const g = e.chute.group;
      const landed = e.chuteY <= 3.0;
      g.scale.set(open, open * (landed ? 0.6 : 1), open);
      g.position.set(e.chuteX, e.chuteY, e.z + 0.2);
      g.rotation.z = landed ? 0 : Math.sin(e.t * 1.7) * 0.18;
      if (e.chute.ch) {
        e.chute.ch.face(0, 1);
        e.chute.ch.update(dt, { moving: landed ? 0 : 0.4, grounded: landed });
      }
      if (e.t > CHUTE_TIME) {
        this.puffs.burst(new THREE.Vector3(e.chuteX, e.chuteY - 1.5, e.z), e.color, { count: 10, size: 0.5, life: 0.5 });
        this.respawn(e);
      }
    } else if (e.state === 'crash') {
      if (e.water) {
        f.y -= dt * 1.6;
      } else {
        f.vy -= 22 * dt;
        f.y += f.vy * dt;
        if (f.y < FLY.groundY) { f.y = FLY.groundY; f.vy = Math.abs(f.vy) > 3 ? -f.vy * 0.35 : 0; }
      }
      f.x += f.vx * dt;
      f.vx *= Math.max(0, 1 - dt * 2);
      f.ang += dt * 6 * f.facing * Math.max(0, 1 - e.t);
      if (e.t > 1.0) this.poof(e);
      if (e.t > CRASH_TIME) this.respawn(e);
    }
  }

  poof(e) {
    if (e.poofed) return;
    e.poofed = true;
    e.wreck = false;
    e.m.group.visible = false;
    const pos = new THREE.Vector3(e.fl.x, Math.max(0.6, e.fl.y), e.z + 0.4);
    this.puffs.burst(pos, COLORS.white, { count: 12, size: 0.7, life: 0.6, speed: 4 });
    this.confetti.burst(pos, 0, { count: 16, speed: 5, colors: [e.color, COLORS.gold], life: 1, size: 0.16 });
  }

  // ---------- pellets ----------

  updatePellets(dt) {
    const steps = 2, h = dt / steps;
    for (const p of this.pellets) {
      for (let i = 0; i < steps && p.life > 0; i++) {
        p.vy -= 5 * h;
        p.x += p.vx * h;
        p.y += p.vy * h;
        p.life -= h;
        if (p.y < 0.1) {
          p.life = 0;
          this.puffs.burst(new THREE.Vector3(p.x, 0.2, 0.3), p.color, { count: 3, size: 0.25, life: 0.3, speed: 2 });
          break;
        }
        for (const e of this.ents) {
          if (e.state !== 'fly' || e.team === p.team) continue;
          const dx = e.fl.x - p.x, dy = e.fl.y - p.y;
          if (dx * dx + dy * dy < (1.15 + p.r) ** 2 && this.hitPlane(e, p)) { p.life = 0; break; }
        }
        if (p.life <= 0) break;
        if (p.team !== 1 || this.mode !== 'coop') {
          for (const b of this.blimps) {
            const ex = (p.x - b.x) / (3.1 * b.size), ey = (p.y - b.y) / (1.35 * b.size);
            if (ex * ex + ey * ey < 1) { this.hitBlimp(b, p); p.life = 0; break; }
          }
        }
      }
      p.mesh.position.set(p.x, p.y, 0.35);
      if (p.life <= 0 || Math.abs(p.x) > XW + 10) { p.life = 0; this.scene.remove(p.mesh); }
    }
    this.pellets = this.pellets.filter((p) => p.life > 0);
  }

  // ---------- blimps ----------

  hitBlimp(b, p) {
    if (b.hp <= 0) return;
    b.hp--;
    b.flash = 0.12;
    p.owner.stat.hits++;
    b.lastHitBy = p.owner;
    if (b.splats < 16) {
      b.splats++;
      addSplat(b.m.splats, p.color, Math.random, [[-2 + Math.random() * 4, (Math.random() - 0.5) * 1.4, 1.12]]);
    }
    this.puffs.burst(new THREE.Vector3(p.x, p.y, 1), p.color, { count: 5, size: 0.35, life: 0.4, speed: 3 });
    if (p.owner.p && this.sfxOk()) this.game.audio.play('splat');
    if (b.hp <= 0) this.popBlimp(b, p.owner);
  }

  popBlimp(b, by) {
    const value = b.boss ? 6 : 3;
    if (by) {
      by.points += value;
      by.stat.pops++;
      this.floater(`+${value}`, new THREE.Vector3(b.x, b.y + 3 * b.size, 0), by.css);
    }
    const pos = new THREE.Vector3(b.x, b.y, 1);
    this.confetti.burst(pos, 0, { count: b.boss ? 160 : 70, speed: b.boss ? 16 : 10, up: 6, colors: PLAYER_COLORS.map((c) => c.hex).concat(COLORS.gold), life: 2, gravity: -6, size: 0.26 });
    this.puffs.burst(pos, COLORS.white, { count: 20, size: 1.2 * b.size, life: 0.8, speed: 8 });
    this.game.audio.play('pop');
    this.game.audio.play(b.boss ? 'fanfare' : 'boing');
    this.scene.remove(b.m.group);
    b.tag.remove();
    this.blimps = this.blimps.filter((x) => x !== b);
    // The grumble pilot floats down under a little parachute.
    const ch = makeChute({ color: 0xc9a8ff, grumble: PURPLE });
    ch.group.visible = true;
    this.scene.add(ch.group);
    this.decor.push({ g: ch.group, x: b.x, y: b.y - 1, t: 0 });
  }

  updateBlimps(dt) {
    for (const b of this.blimps) {
      b.t += dt;
      b.x += b.dir * b.speed * dt;
      const lim = XW - 5 * b.size;
      if (b.dir > 0 && b.x > lim) b.dir = -1;
      else if (b.dir < 0 && b.x < -lim) b.dir = 1;
      b.y = b.baseY + Math.sin(b.t * 0.8) * 1.5;
      b.m.group.position.set(b.x, b.y, -1.3);
      b.m.group.scale.x += (b.dir - b.m.group.scale.x) * Math.min(1, dt * 3);
      b.m.prop.rotation.x += dt * 20;
      b.flash -= dt;
      b.m.inner.position.y = b.flash > 0 ? 0.15 : 0;
      // Goo balls lobbed at the nearest pilot.
      b.fireT -= dt;
      if (b.fireT <= 0 && this.state === 'play') {
        b.fireT = b.boss ? 1.9 : 3.2;
        let tgt = null, bd = 34;
        for (const e of this.ents) {
          if (e.team !== 0 || e.state !== 'fly' || e.fl.grounded) continue;
          const d = Math.hypot(e.fl.x - b.x, e.fl.y - b.y);
          if (d < bd) { bd = d; tgt = e; }
        }
        if (tgt) {
          const gx = b.x + b.dir * 0.2 * b.size, gy = b.y - 1.45 * b.size;
          const base = Math.atan2(tgt.fl.y - gy, tgt.fl.x - gx);
          const spread = b.boss ? [-0.28, 0, 0.28] : [0];
          for (const da of spread) {
            const mesh = makePellet(GOO, 0.38);
            this.scene.add(mesh);
            this.pellets.push({ mesh, owner: b, team: 1, color: GOO, r: 0.38, x: gx, y: gy, vx: Math.cos(base + da) * 12, vy: Math.sin(base + da) * 12 + 2, life: 3 });
          }
        }
      }
      // Health bar over the blimp.
      const pct = Math.round((b.hp / b.maxHp) * 20) * 5;
      const html = `${b.boss ? `${esc(t('dogfight.boss'))}<br>` : ''}<span style="display:inline-block;width:${b.boss ? 7 : 4}em;height:.5em;border-radius:9px;background:rgba(43,35,64,.25);overflow:hidden;-webkit-text-stroke:0"><span style="display:block;height:100%;width:${pct}%;background:#ff5d73"></span></span>`;
      if (html !== b.tagHtml) { b.tag.innerHTML = html; b.tagHtml = html; }
      b.tag.style.color = '#8a45e0';
      this.game.ui.place(b.tag, new THREE.Vector3(b.x, b.y + 1.9 * b.size + 0.6, 0), this.camera);
    }
    for (const d of this.decor) {
      d.t += dt;
      d.y = Math.max(3, d.y - dt * 2.4);
      d.x += Math.sin(d.t * 1.5) * dt;
      const k = Math.min(1, d.t / 0.4) * (d.t > 3.5 ? Math.max(0.01, 1 - (d.t - 3.5) * 2) : 1);
      d.g.scale.setScalar(k);
      d.g.position.set(d.x, d.y, 0.2);
      d.g.rotation.z = Math.sin(d.t * 1.5) * 0.2;
      if (d.t > 4) { this.scene.remove(d.g); d.gone = true; }
    }
    this.decor = this.decor.filter((d) => !d.gone);
  }

  // ---------- visuals ----------

  updateModel(e, dt) {
    const f = e.fl;
    const m = e.m;
    // Show the top of the wings a little, flip upright when flying left, spin in a barrel roll.
    const target = f.facing > 0 ? 0.25 : Math.PI - 0.25;
    e.roll += clamp(target - e.roll, -6 * dt, 6 * dt);
    if (dt === 0) e.roll = target;
    let r = e.roll;
    if (f.rollT > 0) r += (1 - f.rollT / 0.55) * Math.PI * 2;
    if (f.stalled) r += Math.sin(this.time * 16) * 0.35;
    m.group.position.set(f.x, f.y, e.z);
    m.body.rotation.set(r, 0, f.ang, 'ZYX');
    const parked = f.grounded && this.state !== 'play';
    m.prop.rotation.x += dt * (f.dead || !f.engine ? 3 : parked ? 18 : f.boosting ? 60 : f.stalled ? 12 : 38);
    m.scarf.rotation.y = Math.sin(this.time * 22 + e.z * 10) * 0.35;
    if (m.ch) {
      const yaw = Math.PI / 2 - 0.8 * Math.cos(r);
      m.ch.yaw = m.ch.targetYaw = yaw;
      m.ch.update(dt, { grounded: true });
    }
    if (e.state === 'fly') m.group.visible = e.invuln <= 0 || Math.floor(this.time * 14) % 2 === 0;
  }

  updateTag(e) {
    if (!e.tag) return;
    const show = e.state === 'fly' || e.state === 'chute';
    if (!show || this.state === 'results') { e.tag.style.display = 'none'; e.stallEl.style.display = 'none'; return; }
    const f = e.fl;
    const pos = e.state === 'chute' ? new THREE.Vector3(e.chuteX, e.chuteY + 0.7, 0) : new THREE.Vector3(f.x, f.y + 1.8, 0);
    let sub = '';
    if (e.state === 'fly') {
      if (f.grounded && this.state === 'play' && e.p && this.time - this.playStart < 8) sub = `<small>↑ ${esc(t('dogfight.takeoff'))}</small>`;
      else {
        const pips = [0, 1, 2].map((i) => `<span style="display:inline-block;width:.62em;height:.62em;border-radius:50%;margin:0 1px;border:2px solid #fff;background:${i < e.maxHits - e.hits ? e.css : '#d8d2ea'}"></span>`).join('');
        const boost = Math.round(f.boost * 10) * 10;
        const bar = `<span style="display:block;width:3.4em;height:.36em;margin:2px auto 0;border-radius:9px;background:rgba(43,35,64,.22);overflow:hidden"><span style="display:block;height:100%;width:${boost}%;background:${f.boostLock > 0 ? '#ff9fb0' : '#4cc9f0'}"></span></span>`;
        sub = `<small>${pips}${e.jam ? ` ${esc(t('dogfight.jam'))}` : ''}</small>${e.p ? bar : ''}`;
      }
    }
    const html = `${esc(e.name)}${sub}`;
    if (html !== e.tagHtml) { e.tag.innerHTML = html; e.tagHtml = html; }
    this.game.ui.place(e.tag, pos, this.camera);
    if (e.state === 'fly' && f.stalled && Math.floor(this.time * 6) % 2 === 0) {
      e.stallEl.textContent = t('dogfight.stall');
      this.game.ui.place(e.stallEl, new THREE.Vector3(f.x, f.y + 3.6, 0), this.camera);
    } else {
      e.stallEl.style.display = 'none';
    }
  }

  floater(text, pos, css) {
    const el = this.game.ui.label('label');
    el.textContent = text;
    el.style.color = css;
    this.floaters.push({ el, pos: pos.clone(), life: 1.2 });
  }

  updateFloaters(dt) {
    for (const f of this.floaters) {
      f.life -= dt;
      f.pos.y += dt * 1.5;
      this.game.ui.place(f.el, f.pos, this.camera);
      f.el.style.opacity = Math.min(1, f.life * 2.5);
      if (f.life <= 0) f.el.remove();
    }
    this.floaters = this.floaters.filter((f) => f.life > 0);
  }

  /** Shared camera: frames every plane (zooming out as they spread), kept inside the world. */
  frameCamera(dt, instant = false) {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    const addPt = (x, y) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); };
    for (const e of this.ents) {
      if (e.state === 'gone') continue;
      if (e.state === 'chute') addPt(e.chuteX, e.chuteY - 1.5);
      else if (e.state === 'fly' || !e.poofed) addPt(e.fl.x, e.fl.y);
    }
    for (const b of this.blimps) { addPt(b.x - 3 * b.size, b.y); addPt(b.x + 3 * b.size, b.y + 2 * b.size); }
    if (x0 === Infinity) addPt(0, 10);
    const w = Math.max(x1 - x0 + 16, 34), h = Math.max(y1 - y0 + 12, 18);
    const dMax = this.fitDistance(XW * 2 + 12, WORLD_TOP - WORLD_BOTTOM);
    const d = Math.min(this.fitDistance(w, h), dMax);
    const half = this.viewHalfSize(d);
    const L = -XW - 6, R = XW + 6;
    let cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    cx = half.w * 2 >= R - L ? 0 : clamp(cx, L + half.w, R - half.w);
    cy = half.h * 2 >= WORLD_TOP - WORLD_BOTTOM ? (WORLD_TOP + WORLD_BOTTOM) / 2 : clamp(cy, WORLD_BOTTOM + half.h, WORLD_TOP - half.h);
    const k = instant ? 1 : Math.min(1, dt * 2.2);
    this.cam.x += (cx - this.cam.x) * k;
    this.cam.y += (cy - this.cam.y) * k;
    this.cam.d += (d - this.cam.d) * k;
    this.camera.position.set(this.cam.x, this.cam.y + 1.2, this.cam.d);
    this.camera.lookAt(this.cam.x, this.cam.y, 0);
    this.confettiOrigin = new THREE.Vector3(this.cam.x, this.cam.y + 2, 0);
  }

  resize(w, h) {
    super.resize(w, h);
    this.frameCamera(0, true);
  }

  // ---------- results ----------

  campaignStats() {
    const team = this.ents.filter((e) => e.p).reduce((s, e) => s + e.points, 0);
    return { mode: this.mode, points: team, won: this.won, wave: this.wave + 1 };
  }

  end() {
    if (this.state === 'results') return;
    for (const e of this.ents) { e.tag && (e.tag.style.display = 'none'); e.stallEl && (e.stallEl.style.display = 'none'); }
    for (const b of this.blimps) b.tag.style.display = 'none';
    const row = (e, crown) => ({
      css: e.css, name: e.name, value: ptsText(e.points),
      detail: t('dogfight.detail', { h: e.stat.hits, c: e.stat.chutes }), crown,
    });
    if (this.mode === 'ffa') {
      const ranked = this.ents.filter((e) => e.kind !== 'enemy').sort((a, b) => b.points - a.points || b.stat.hits - a.stat.hits);
      const top = ranked[0];
      const tie = ranked.length > 1 && ranked[1].points === top.points;
      this.finish({
        title: tie ? t('tie') : t('win', { name: top.name }),
        subtitle: t('dogfight.ffaSub'),
        rows: ranked.map((e) => row(e, e.points === top.points && top.points > 0)),
        stars: 2,
      });
    } else if (this.mode === 'teams') {
      const [a, b] = this.teamScore;
      const winner = a === b ? -1 : a > b ? 0 : 1;
      const ranked = this.ents.filter((e) => e.p).sort((x, y) => (y.team === winner) - (x.team === winner) || y.points - x.points);
      this.finish({
        title: winner < 0 ? t('ball.draw') : t('ball.winTitle', { team: t(`ball.team.${winner}`) }),
        subtitle: `${t('ball.team.0')} ${t('ball.sub', { a, b })} ${t('ball.team.1')}`,
        rows: ranked.map((e) => ({ ...row(e, e.team === winner), detail: `${t(`ball.team.${e.team}`)} · ${t('dogfight.detail', { h: e.stat.hits, c: e.stat.chutes })}` })),
        stars: 2,
      });
    } else {
      const ranked = this.ents.filter((e) => e.p).sort((a, b) => b.points - a.points || b.stat.hits - a.stat.hits);
      const total = ranked.reduce((s, e) => s + e.points, 0);
      const top = ranked[0];
      this.finish({
        title: this.won ? t('dogfight.coopWin') : t('dogfight.coopLose', { n: Math.max(1, this.wave + 1) }),
        subtitle: t('dogfight.coopSub', { n: total }),
        rows: ranked.map((e) => row(e, e.points === top.points && top.points > 0)),
        stars: this.won ? 3 : 2,
      });
    }
  }

  // ---------- frame ----------

  update(dt) {
    // Scenery.
    for (const w of this.world.waves) w.position.y = -0.35 + Math.sin(this.time * 1.5 + w.userData.phase) * 0.12;
    this.world.sock.rotation.y = Math.sin(this.time * 0.7) * 0.4;
    for (const c of this.world.front) c.c.position.x = c.x + Math.sin(this.time * 0.08 + c.phase) * 4;

    if (this.picker) {
      this.picker.update(dt);
      for (const e of this.ents) this.updateModel(e, dt);
      this.frameCamera(dt);
      return;
    }
    if (this.state === 'results') {
      for (const e of this.ents) if (e.state !== 'gone') { e.m.ch?.update(dt, { grounded: true }); }
      this.updateFloaters(dt);
      this.updateResults(dt);
      return;
    }

    const playing = this.state === 'play';
    for (const e of this.ents) {
      e.invuln = Math.max(0, e.invuln - dt);
      if (e.state === 'fly') {
        if (playing) this.updatePlane(e, dt);
      } else if (e.state === 'chute' || e.state === 'crash') {
        this.updateDown(e, dt);
      }
      if (e.state !== 'gone') this.updateModel(e, dt);
    }
    this.ents = this.ents.filter((e) => e.state !== 'gone');
    this.updatePellets(dt);
    this.updateBlimps(dt);
    if (playing && this.mode === 'coop') this.updateWaves(dt);
    for (const e of this.ents) this.updateTag(e);
    this.updateFloaters(dt);
    this.frameCamera(dt);

    if (playing) {
      this.timeLeft -= dt;
      if (this.timeLeft <= 0) { this.timeLeft = 0; this.end(); return; }
    }
    if (this.state === 'play' || this.state === 'intro') this.hud();
  }

  hud() {
    const ui = this.game.ui;
    if (this.mode === 'teams') {
      ui.setTop(`<div class="pill ball-score"><span style="color:${TEAM_CSS[0]}">${t('ball.team.0')}</span><span class="big-num">${this.teamScore[0]} - ${this.teamScore[1]}</span><span style="color:${TEAM_CSS[1]}">${t('ball.team.1')}</span></div><div class="pill"><b>${clock(this.timeLeft)}</b></div>`);
    } else if (this.mode === 'coop') {
      const wave = Math.max(0, this.wave);
      const boss = this.blimps.find((b) => b.boss);
      const bossBar = boss ? `<div class="pill">${esc(t('dogfight.boss'))}<span style="display:inline-block;width:8em;height:.6em;border-radius:9px;background:#eee;overflow:hidden"><span style="display:block;height:100%;width:${Math.round((boss.hp / boss.maxHp) * 100)}%;background:#ff5d73"></span></span></div>` : '';
      ui.setTop(`<div class="pill hud-title">${t('dogfight.waveHud', { n: wave + 1, m: this.waves.length })}</div><div class="pill">${t('dogfight.left', { n: this.wave < 0 ? '…' : this.enemiesLeft() })}</div>${bossBar}<div class="pill"><b>${clock(this.timeLeft)}</b></div>`);
    } else {
      ui.setTop(`<div class="pill"><span class="big-num">${clock(this.timeLeft)}</span></div><div class="pill hud-title">${t('game.dogfight')}</div>`);
    }
    ui.bar(this.players, (p) => {
      const e = this.ents.find((x) => x.p === p);
      return e ? `${e.points}` : '';
    });
  }
}
