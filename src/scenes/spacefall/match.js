import * as THREE from 'three';
import { t } from '../../core/i18n.js';
import { COLORS } from '../../core/palette.js';
import { SHIP, GRAV, MISSILE, VERSUS, FRENZY, COOP } from './config.js';
import { Ship } from './ship.js';
import { Missile, Crate, Bolt, Rift } from './items.js';
import { Alien } from './aliens.js';
import { View, computeLayout } from './views.js';
import { buildLevel, themeSky } from './level.js';
import { Sparks } from './fx.js';
import { makePod, makeDebris } from './models.js';
import { pick, rand, shuffle } from './util.js';

// One Spacefall match on one map (ported from Spacefall's Game and extended):
//   versus  last ship standing wins the round, first to N rounds wins (Spacefall PvP)
//   frenzy  timed free-for-all with quick respawns, most pops wins (Balloon Archers' rules)
//   coop    survive waves of aliens together, ending with the Hive Queen (Spacefall PvE)
// Popped pilots always get out safe in an escape bubble. Pilots: { p (roster player) | bot, name,
// css, hex, ship, pod, ctl, wins, pops, kills, deaths, score, lives }.

const SHARED_MAX_W = 36;
const SHARED_MAX_H = 22;
const _v = new THREE.Vector3();

/** Escape bubble with the pilot inside. Floats (and can be steered a little) until it respawns. */
class Pod {
  constructor(match, pl, x, y, kind) {
    this.match = match;
    this.pl = pl;
    this.x = x; this.y = y;
    this.vx = rand(-1, 1); this.vy = 2.5;
    this.hw = 0.45; this.hh = 0.45;
    this.kind = kind; // 'respawn' | 'out' (versus) | 'rescue' (co-op, no lives left)
    this.t = 0;
    this.mesh = makePod(pl.hex, pl.hat, pl.grumble);
    this.mesh.position.set(x, y, 0.3);
    match.ents.add(this.mesh);
    // Start in open space even if the ship popped against a wall.
    for (let i = 0; i < 8 && match.world.boxSolid(this.x, this.y, this.hw, this.hh); i++) this.y += 0.25;
  }
  update(dt, ctl) {
    const w = this.match.world;
    this.t += dt;
    const sx = ctl ? ctl.x : 0, sy = ctl ? ctl.y : 0;
    const k = Math.min(1, dt * 2.5);
    this.vx += (sx * 2.6 - this.vx) * k;
    const rise = w.gravity ? 0.9 : 0;
    this.vy += (sy * 2.6 + rise + Math.sin(this.t * 2) * 0.3 - this.vy) * k;
    const res = w.move(this, this.vx * dt, this.vy * dt);
    if (res.left || res.right) this.vx *= -0.5;
    if (res.up || res.down) this.vy *= -0.5;
    this.mesh.position.set(this.x, this.y + Math.sin(this.t * 3) * 0.05, 0.3);
    const u = this.mesh.userData;
    if (u.pilot) {
      u.pilot.spin += dt * (this.kind === 'rescue' ? 0.6 : 2.2);
      u.pilot.update(dt, { moving: 0, grounded: false, vy: 0 });
    }
    const pop = this.kind === 'rescue' ? 1 + Math.sin(this.t * 5) * 0.06 : 1;
    this.mesh.scale.setScalar(Math.min(1, this.t * 5) * pop);
  }
  remove(burst = true) {
    this.match.ents.remove(this.mesh);
    if (burst) {
      this.match.scene.confetti.burst(_v.set(this.x, this.y, 0.4), 0, { count: 14, speed: 4, colors: [this.pl.hex, COLORS.white], life: 0.8, gravity: -6, size: 0.13 });
      this.match.sfx('pop');
    }
  }
}

export class Match {
  constructor(scene, { world, mode, settings, pilots, onEnd }) {
    this.scene = scene;
    this.world = world;
    this.mode = mode;
    this.settings = settings;
    this.pilots = pilots;
    this.onEnd = onEnd;
    this.time = 0;
    this.missiles = [];
    this.aliens = [];
    this.crates = [];
    this.bolts = [];
    this.rifts = [];
    this.pods = [];
    this.texts = [];
    this.debris = [];
    this.controlsLocked = true;
    this.alienSpeedScale = 1;
    this.flowT = 0;
    this.round = 0;
    this.wave = 0;
    this.over = false;
    this.phase = 'ready';
    this.phaseT = 0;
    this.timeLeft = settings.length || 0;

    const level = buildLevel(world);
    this.theme = level.theme;
    scene.scene.add(level.group);
    scene.scene.background?.dispose?.();
    scene.scene.background = themeSky(level.theme);
    this.sparks = new Sparks(scene.scene, { additive: level.theme.additive });
    this.ents = new THREE.Group();
    scene.scene.add(this.ents);

    // Solo pilots get a spare life (and in co-op a Grumble Buddy wingman, added by the scene).
    const startLives = pilots.filter((pl) => !pl.bot).length === 1 ? 4 : 3;
    this.startLives = startLives;
    for (const pl of pilots) {
      Object.assign(pl, { wins: 0, pops: 0, kills: 0, deaths: 0, score: 0, rescues: 0, lives: startLives, respawnT: 0, pod: null, deathPos: null });
      pl.ship = new Ship(this, pl);
    }
    this.shared = world.w <= SHARED_MAX_W && world.h <= SHARED_MAX_H;
    this.views = this.makeViews();

    // Everyone sits on the pad, frozen, until begin() (after the intro countdown).
    this.startSpawn(Infinity);
  }

  /** Start play: the first versus round, the frenzy clock or the first co-op wave. */
  begin() {
    if (this.mode === 'versus') this.startRound();
    else this.phaseT = this.mode === 'coop' ? 1.2 : 0.4;
  }

  /** Short score for HUD cards and chips. */
  scoreText(pl) {
    if (this.mode === 'versus') return t('sf.winsN', { n: pl.wins });
    if (this.mode === 'frenzy') return String(pl.pops);
    return String(pl.score);
  }

  // ---------------------------------------------------------------------------
  // Views

  humans() { return this.pilots.filter((pl) => !pl.bot); }

  makeViews() {
    if (this.shared) return [new View('shared')];
    const views = this.humans().map((pl) => new View('follow', pl));
    if (views.length === 3 || views.length === 5) views.push(new View('overview'));
    return views;
  }

  layout(W, H, padTop, padBottom) {
    if (this.shared) this.views[0].setRect({ x: 0, y: 0, w: W, h: H }, H, padTop, padBottom);
    else computeLayout(this.views.length, W, H).forEach((r, i) => this.views[i].setRect(r, H));
  }

  /** What a follow camera looks at: your ship, your escape bubble, or a teammate. */
  followTarget(pl) {
    if (pl.ship.alive) return pl.ship;
    if (pl.pod) return pl.pod;
    const other = this.ships().find((s) => s.alive);
    return other || pl.deathPos;
  }

  shake(amount, x, y) {
    for (const v of this.views) v.addShake(amount, x, y);
  }

  // ---------------------------------------------------------------------------
  // Helpers used by the entities

  ships() { return this.pilots.map((pl) => pl.ship); }
  aliveShips() { return this.ships().filter((s) => s.alive); }
  later(sec, fn) { this.scene.later(sec, fn); }
  sfx(name) { this.scene.sfx(name); }
  rumble(pl, strength, ms) { this.scene.rumble(pl, strength, ms); }

  aimTargets(ship) {
    const out = this.aliens.filter((a) => !a.dead);
    if (this.mode !== 'coop') for (const s of this.ships()) if (s !== ship && s.alive) out.push(s);
    return out;
  }

  addText(x, y, text, color = '#fff', life = 1) {
    this.texts.push({ x, y, text, color, t: 0, life });
  }

  puff(x, y, color, count = 6) {
    this.scene.puffs.burst(_v.set(x, y, 0.3), color, { count, size: 0.3, life: 0.5, speed: 2.5 });
  }

  /** Cartoon explosion: flash, sparks, smoke puffs, confetti and a few bouncing hull pieces. */
  boom(x, y, color, big = false, alien = false) {
    const k = big ? 1.6 : 1;
    this.sparks.explosion(x, y, color, big);
    this.scene.puffs.burst(_v.set(x, y, 0.3), 0xffffff, { count: Math.round(8 * k), size: 0.5 * k, life: 0.6, speed: 4 * k });
    this.scene.puffs.burst(_v.set(x, y, 0.2), alien ? 0x9ae65a : 0xffc060, { count: Math.round(6 * k), size: 0.35 * k, life: 0.45, speed: 5 * k });
    this.scene.confetti.burst(_v.set(x, y, 0.3), 0, {
      count: Math.round(18 * k), speed: 7 * k, up: 2, size: 0.14, life: 1.1,
      gravity: this.world.gravity ? -12 : -1, colors: alien ? [color, 0x9ae65a, COLORS.white] : [color, COLORS.white, COLORS.gold],
    });
    if (!alien) {
      for (let i = 0; i < 5; i++) {
        const m = makeDebris(color);
        const a = rand(0, Math.PI * 2), sp = rand(3, 7);
        this.ents.add(m);
        this.debris.push({ m, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp + 2, hw: 0.08, hh: 0.08, t: 0, spin: rand(-10, 10) });
      }
    }
    this.sfx(big ? 'boomBig' : 'boom');
    this.shake(big ? 0.7 : alien ? 0.25 : 0.6, x, y);
  }

  spawnMissile(ship, angle) {
    const cx = Math.cos(angle), cy = Math.sin(angle);
    let x = ship.x + cx * 0.45, y = ship.y + cy * 0.45;
    if (this.world.solidAt(x, y)) { x = ship.x; y = ship.y; }
    this.missiles.push(new Missile(this, ship, x, y, cx * MISSILE.speed, cy * MISSILE.speed, ship.color));
    this.capMissiles();
  }

  dropMissile(x, y, vx, vy, color) {
    this.missiles.push(new Missile(this, null, x, y, vx, vy, color, 'drop'));
    this.capMissiles();
  }

  capMissiles() {
    if (this.missiles.length <= 70) return;
    const old = this.missiles.find((m) => m.state === 'stuck');
    if (old) old.remove();
  }

  spawnBolt(x, y, vx, vy) { this.bolts.push(new Bolt(this, x, y, vx, vy)); }

  spawnAlien(type, x, y) {
    if (type === 'crawler' && !this.world.gravity) type = 'spore';
    if (type === 'spore' && this.world.gravity) type = 'crawler';
    const a = new Alien(this, type, x, y);
    const free = this.freeSpot(x, y, a.hw, a.hh);
    a.x = free.x; a.y = free.y;
    this.aliens.push(a);
  }

  /** The nearest position to (x, y) where a box of this size doesn't overlap a wall. */
  freeSpot(x, y, hw, hh) {
    const w = this.world;
    if (!w.boxSolid(x, y, hw, hh)) return { x, y };
    for (let r = 0.25; r <= 4; r += 0.25) {
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI * 2;
        const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
        if (!w.boxSolid(px, py, hw, hh)) return { x: px, y: py };
      }
    }
    return { x, y };
  }

  riftAt(type, pos) { this.rifts.push(new Rift(this, pos.x, pos.y, type, type === 'queen' ? 2 : 1.1)); }

  queenHp() { return 14 + 6 * this.humans().length; }

  /** The Hive Queen calls two helpers through rifts near her. */
  queenSummon(q) {
    if (this.aliens.length + this.rifts.length >= 10) return;
    const ships = this.aliveShips();
    const cells = this.world.openCells.filter((c) => {
      const d = this.world.dist(c, q);
      return d > 2 && d < 6 && ships.every((s) => this.world.dist(s, c) > 3);
    });
    for (let i = 0; i < 2 && cells.length; i++) {
      this.riftAt(Math.random() < 0.5 ? 'wisp' : 'crawler', cells.splice(Math.floor(Math.random() * cells.length), 1)[0]);
    }
  }

  /** A spawn spot for an alien away from all ships. */
  alienSpawnPos() {
    const ships = this.aliveShips();
    for (const r of shuffle(this.world.rifts.slice())) {
      if (ships.every((s) => this.world.dist(s, r) > 7)) return r;
    }
    return this.world.randomOpen(ships, 8);
  }

  relocateAlien(alien) {
    const ships = this.aliveShips();
    if (!ships.length) return;
    for (let i = 0; i < 50; i++) {
      const c = pick(this.world.openCells);
      const d = Math.min(...ships.map((s) => this.world.dist(s, c)));
      if (d > 6 && d < 14) {
        alien.remove();
        this.riftAt(alien.type, c);
        return;
      }
    }
  }

  spawnCrate() {
    const ships = this.aliveShips();
    const spots = shuffle(this.world.crates.slice());
    let pos = spots.find((c) => ships.every((s) => this.world.dist(s, c) > 3) && this.crates.every((k) => this.world.dist(k, c) > 2));
    if (!pos) pos = this.world.randomOpen(ships, 4);
    this.crates.push(new Crate(this, pos.x, pos.y));
  }

  /** n spawn points spread far apart (and away from `avoid`). */
  spreadSpawns(n, avoid = []) {
    const pts = shuffle(this.world.spawns.slice());
    const chosen = [];
    while (chosen.length < n && pts.length) {
      let best = 0, bestD = -1;
      pts.forEach((p, i) => {
        const others = [...chosen, ...avoid];
        const d = others.length ? Math.min(...others.map((o) => this.world.dist(o, p))) : Math.random();
        if (d > bestD) { bestD = d; best = i; }
      });
      chosen.push(pts.splice(best, 1)[0]);
    }
    while (chosen.length < n) chosen.push(this.world.randomOpen([...chosen, ...avoid], 4));
    return chosen;
  }

  clearRoundEntities() {
    for (const list of [this.missiles, this.aliens, this.crates, this.bolts, this.rifts]) {
      for (const e of list) e.remove();
      list.length = 0;
    }
    for (const pod of this.pods) pod.remove(false);
    this.pods.length = 0;
    for (const pl of this.pilots) {
      pl.pod = null;
      if (pl.ship.alive) { pl.ship.alive = false; this.ents.remove(pl.ship.mesh, pl.ship.rack); }
    }
    this.texts.length = 0;
    this.sparks.clear();
  }

  /** Everyone spawns spread out; play starts after a short ready pause. */
  startSpawn(ready) {
    this.clearRoundEntities();
    const spawns = this.spreadSpawns(this.pilots.length);
    this.pilots.forEach((pl, i) => pl.ship.spawn(spawns[i]));
    for (const v of this.views) v.snap = true;
    this.controlsLocked = true;
    this.phase = 'ready';
    this.phaseT = ready;
    this.crateT = rand(...VERSUS.crateInterval);
    this.alienT = rand(...VERSUS.alienInterval);
    this.roundT = 0;
  }

  banner(title, sub = '', ms = 1600) {
    if (this.over) return;
    this.scene.game.ui.banner(title, sub, ms);
  }

  // ---------------------------------------------------------------------------
  // Versus: last ship standing

  startRound() {
    this.round++;
    // Round 1 follows the intro countdown straight away; later rounds get a banner.
    this.startSpawn(this.round === 1 ? 0.3 : VERSUS.readyTime);
    if (this.round > 1) this.banner(t('sf.round', { n: this.round }), t('sf.firstTo', { n: this.settings.rounds }), 1300);
  }

  updateVersus(dt) {
    if (this.phase === 'ready') {
      this.phaseT -= dt;
      if (this.phaseT <= 0) {
        this.phase = 'play';
        this.controlsLocked = false;
        this.sfx('go');
      }
      return;
    }
    if (this.phase === 'play') {
      this.roundT += dt;
      this.updateHazards(dt);
      const alive = this.aliveShips();
      // Once every human is out, the bots don't get to drag the round on.
      const humansAlive = alive.some((s) => !s.pl.bot);
      if (alive.length <= 1 || !humansAlive) {
        this.phase = 'roundEnd';
        this.phaseT = humansAlive ? VERSUS.roundEndDelay : 0.6;
      }
      return;
    }
    if (this.phase === 'roundEnd') {
      this.phaseT -= dt;
      if (this.phaseT > 0) return;
      const alive = this.aliveShips();
      const winner = alive.length === 1 ? alive[0].pl : null;
      if (winner) {
        winner.wins++;
        this.sfx('round');
        this.banner(t('sf.roundWin', { name: winner.name }), this.scoreLine(), 1900);
        const s = winner.ship;
        this.scene.confetti.burst(_v.set(s.x, s.y + 0.5, 0.4), 0, { count: 30, speed: 6, colors: [winner.hex, COLORS.white, COLORS.gold] });
      } else {
        this.banner(t('sf.draw'), this.scoreLine(), 2000);
      }
      this.controlsLocked = true;
      this.phase = winner && winner.wins >= this.settings.rounds ? 'matchEnd' : 'between';
      this.phaseT = 2.4;
      this.matchWinner = winner;
      return;
    }
    if (this.phase === 'between') {
      this.phaseT -= dt;
      if (this.phaseT <= 0) this.startRound();
      return;
    }
    if (this.phase === 'matchEnd') {
      this.phaseT -= dt;
      if (this.phaseT <= 0) this.finish({ winner: this.matchWinner });
    }
  }

  scoreLine() {
    return this.pilots.map((pl) => `${pl.name} ${pl.wins}`).join('  ·  ');
  }

  /** Crates now and then, plus a few stray aliens (more of them if a round drags on). */
  updateHazards(dt) {
    this.crateT -= dt;
    if (this.crateT <= 0) {
      this.crateT = rand(...VERSUS.crateInterval);
      if (this.crates.length < 2) this.spawnCrate();
    }
    this.alienT -= dt;
    if (this.alienT <= 0) {
      const late = this.mode === 'versus' && this.roundT > 45;
      this.alienT = late ? rand(3, 5) : rand(...VERSUS.alienInterval);
      if (late && !this.swarmTold) { this.swarmTold = true; this.scene.game.ui.toast(t('sf.swarm'), 2200); }
      const cap = late ? 5 : VERSUS.maxHazardAliens;
      if (this.aliens.length + this.rifts.length < cap) {
        this.riftAt(Math.random() < 0.6 ? 'wisp' : 'crawler', this.world.randomOpen(this.aliveShips(), 7));
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Frenzy: timed free-for-all with respawns

  updateFrenzy(dt) {
    if (this.phase === 'ready') {
      this.phaseT -= dt;
      if (this.phaseT <= 0) { this.phase = 'play'; this.controlsLocked = false; this.sfx('go'); }
      return;
    }
    if (this.phase !== 'play') return;
    this.updateHazards(dt);
    this.timeLeft -= dt;
    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      this.controlsLocked = true;
      this.finish({});
    }
  }

  // ---------------------------------------------------------------------------
  // Co-op: waves of aliens, then the Hive Queen

  nextWave() {
    this.wave++;
    this.alienSpeedScale = Math.min(1.45, 1 + (this.wave - 1) * 0.05);
    this.queue = this.composeWave(this.wave);
    this.spawnT = 0.8;
    this.phase = 'wave';
    this.controlsLocked = false;
    this.sfx('wave');
    const boss = this.wave >= COOP.waves;
    this.banner(boss ? t('sf.queenWave') : t('sf.wave', { n: this.wave, m: COOP.waves }), boss ? t('sf.queenSub') : t('sf.incoming', { n: this.queue.length }), 1800);
  }

  composeWave(n) {
    const players = this.humans().length;
    const basic = this.world.gravity ? 'crawler' : 'spore';
    if (n >= COOP.waves) {
      // The finale: the queen first, then a trickle of escorts.
      const escorts = [];
      for (let i = 0; i < 2 + players; i++) escorts.push(i % 2 ? 'wisp' : basic);
      return [...shuffle(escorts), 'queen'];
    }
    // More aliens with more pilots: about 5 in wave 1 alone, 10 with four players.
    const total = Math.round((3 + n * 1.7) * (0.6 + 0.4 * players));
    const weights = [[basic, 0.55], ['wisp', 0.45]];
    if (n >= 3) weights.push(['spitter', 0.15 + 0.02 * (n - 3)]);
    if (n >= 5) weights.push(['brute', 0.08 + 0.02 * (n - 5)]);
    const sum = weights.reduce((a, w) => a + w[1], 0);
    const list = [];
    for (let i = 0; i < total; i++) {
      let r = Math.random() * sum;
      for (const [type, w] of weights) { r -= w; if (r <= 0) { list.push(type); break; } }
    }
    // Make sure a newly introduced alien actually shows up.
    if (n === 3) list[0] = 'spitter';
    if (n === 5) list[0] = 'brute';
    return shuffle(list);
  }

  updateCoop(dt) {
    // Respawns for pilots with lives left.
    for (const pl of this.pilots) {
      if (pl.ship.alive || pl.lives <= 0 || pl.respawnT <= 0) continue;
      pl.respawnT -= dt;
      if (pl.respawnT <= 0) this.respawn(pl, this.aliens.filter((a) => !a.dead));
    }
    if (this.phase === 'ready' || this.phase === 'break') {
      this.phaseT -= dt;
      if (this.phaseT <= 0) this.nextWave();
    } else if (this.phase === 'wave') {
      const maxActive = Math.min(16, 3 + 2 * this.humans().length + Math.floor(this.wave / 2));
      this.spawnT -= dt;
      if (this.queue.length && this.spawnT <= 0 && this.aliens.length + this.rifts.length < maxActive) {
        this.spawnT = rand(...COOP.spawnInterval);
        this.riftAt(this.queue.pop(), this.alienSpawnPos());
      }
      if (!this.queue.length && !this.aliens.length && !this.rifts.length) this.waveCleared();
    } else if (this.phase === 'gameOver' || this.phase === 'victory') {
      this.phaseT -= dt;
      if (this.phaseT <= 0) this.finish({ won: this.phase === 'victory' });
      return;
    }
    if (this.phase !== 'gameOver' && this.pilots.every((pl) => !pl.ship.alive && pl.lives <= 0)) {
      this.phase = 'gameOver';
      this.phaseT = 2.5;
      this.controlsLocked = true;
      this.sfx('over');
      this.banner(t('sf.overrun'), t('sf.reached', { n: this.wave }), 1900);
    }
  }

  waveCleared() {
    this.sfx('round');
    if (this.wave >= COOP.waves) {
      this.phase = 'victory';
      this.phaseT = 2.2;
      this.banner(t('sf.queenDown'), '', 2000);
      return;
    }
    this.phase = 'break';
    this.phaseT = COOP.waveBreak;
    this.banner(t('sf.cleared'), t('sf.supplies'), 1800);
    const crates = 1 + Math.floor(this.humans().length / 2);
    for (let i = 0; i < crates; i++) this.spawnCrate();
    for (const pl of this.pilots) {
      // Bubbled teammates float back in, and everyone gets a spare life back.
      if (pl.pod && pl.pod.kind === 'rescue') this.rescue(pl, null);
      else if (pl.lives < this.startLives) pl.lives++;
    }
  }

  // ---------------------------------------------------------------------------
  // Events

  respawn(pl, avoid = []) {
    if (pl.pod) { pl.pod.remove(); this.pods = this.pods.filter((p) => p !== pl.pod); pl.pod = null; }
    pl.ship.spawn(this.spreadSpawns(1, [...avoid, ...this.aliveShips()])[0]);
  }

  /** Co-op: a teammate flew into the bubble (or the wave ended). Back in with one life. */
  rescue(pl, by) {
    const pod = pl.pod;
    if (!pod) return;
    pl.lives = 1;
    const at = { x: pod.x, y: pod.y };
    pod.remove();
    this.pods = this.pods.filter((p) => p !== pod);
    pl.pod = null;
    pl.ship.spawn(at);
    this.sfx('rescue');
    if (by) {
      by.pl.rescues++;
      this.addText(at.x, at.y + 0.9, t('sf.rescued'), by.pl.css, 1.2);
    }
  }

  onShipKilled(ship, killer, cause) {
    const pl = ship.pl;
    pl.deaths++;
    pl.deathPos = { x: ship.x, y: ship.y, vx: 0, vy: 0 };
    const kp = killer && killer.pl ? killer.pl : null;
    if (kp && kp !== pl && this.mode !== 'coop') {
      kp.kills++;
      kp.pops++;
      this.addText(ship.x, ship.y + 0.9, cause === 'stomp' ? t('sf.stomped') : `${kp.name} ▸ ${pl.name}`, kp.css, 1.3);
    } else if (kp === pl) {
      this.addText(ship.x, ship.y + 0.9, t('sf.oops'), '#ff5d73', 1.3);
    }
    let kind = 'respawn';
    if (this.mode === 'versus') kind = 'out';
    else if (this.mode === 'coop') {
      pl.lives--;
      if (pl.lives > 0) pl.respawnT = COOP.respawnDelay;
      else kind = this.pilots.length > 1 ? 'rescue' : 'out';
    } else {
      pl.respawnT = FRENZY.respawn;
    }
    const pod = new Pod(this, pl, ship.x, ship.y, kind);
    pl.pod = pod;
    this.pods.push(pod);
  }

  onAlienKilled(alien, by) {
    const pl = by && by.pl ? by.pl : null;
    if (pl) {
      pl.kills++;
      if (this.mode === 'coop') {
        pl.score += alien.T.score;
        this.addText(alien.x, alien.y + 0.6, `+${alien.T.score}`, pl.css, 0.9);
      }
    }
    if (alien.boss) {
      // Popping the queen pops every helper too.
      for (const a of this.aliens) if (!a.dead && a !== alien) a.die(null);
      for (const r of this.rifts) r.remove();
      this.queue = [];
    }
    if (Math.random() < 0.14) this.dropMissile(alien.x, alien.y, rand(-2, 2), rand(2, 5), 0xd8d2f2);
  }

  finish(extra) {
    if (this.over) return;
    this.over = true;
    this.onEnd({ mode: this.mode, pilots: this.pilots, wave: this.wave, ...extra });
  }

  // ---------------------------------------------------------------------------
  // Main step (fixed 1/60 s)

  step(dt) {
    this.time += dt;
    if (this.mode === 'versus') this.updateVersus(dt);
    else if (this.mode === 'frenzy') this.updateFrenzy(dt);
    else this.updateCoop(dt);

    if (this.aliens.length) {
      this.flowT -= dt;
      if (this.flowT <= 0) {
        this.flowT = 0.3;
        this.world.computeFlow(this.aliveShips());
      }
    }

    for (const pl of this.pilots) pl.ship.update(dt, pl.ctl);
    for (const m of this.missiles) if (!m.dead) m.update(dt);
    for (const r of this.rifts) if (!r.dead) r.update(dt);
    for (const a of this.aliens) if (!a.dead) a.update(dt);
    for (const b of this.bolts) if (!b.dead) b.update(dt);
    for (const c of this.crates) if (!c.dead) c.update(dt);
    this.updatePods(dt);
    this.updateDebris(dt);

    this.separateAliens();
    this.collide();

    this.missiles = this.missiles.filter((e) => !e.dead);
    this.aliens = this.aliens.filter((e) => !e.dead);
    this.rifts = this.rifts.filter((e) => !e.dead);
    this.bolts = this.bolts.filter((e) => !e.dead);
    this.crates = this.crates.filter((e) => !e.dead);

    for (const tx of this.texts) { tx.t += dt; tx.y += dt * 0.7; }
    this.texts = this.texts.filter((tx) => tx.t < tx.life);
    this.sparks.update(dt);
  }

  updatePods(dt) {
    for (const pod of [...this.pods]) {
      const pl = pod.pl;
      pod.update(dt, pl.bot ? null : pl.ctl);
      if (pod.kind === 'respawn' && this.mode === 'frenzy') {
        pl.respawnT -= dt;
        if (pl.respawnT <= 0) this.respawn(pl);
      }
    }
    // Co-op respawns with lives left are handled in updateCoop (they also remove the pod).
  }

  updateDebris(dt) {
    const g = this.world.gravity ? 14 : 0;
    for (const d of this.debris) {
      d.t += dt;
      d.vy -= g * dt;
      const res = this.world.move(d, d.vx * dt, d.vy * dt);
      if (res.left || res.right) d.vx *= -0.5;
      if (res.up || res.down) { d.vy *= -0.4; d.vx *= 0.7; }
      d.m.position.set(d.x, d.y, 0.25);
      d.m.rotation.z += d.spin * dt;
      d.m.rotation.x += d.spin * 0.7 * dt;
      d.m.scale.setScalar(Math.max(0.01, Math.min(1, (1.6 - d.t) * 2)));
    }
    const gone = this.debris.filter((d) => d.t > 1.6);
    for (const d of gone) this.ents.remove(d.m);
    if (gone.length) this.debris = this.debris.filter((d) => d.t <= 1.6);
  }

  /** Called by a flying missile after each sub-step. Returns true if the missile was used up. */
  missileHits(m) {
    const w = this.world;
    const dx = Math.cos(m.angle), dy = Math.sin(m.angle);
    if (this.mode !== 'coop') {
      for (const s of this.ships()) {
        if (!s.alive) continue;
        if (s === m.owner && m.age < MISSILE.ownerGrace) continue;
        if (!w.overlaps(s, m)) continue;
        // A dash catches the missile right out of the air.
        if (s.dashing) {
          if (s.ammo < SHIP.maxAmmo) {
            s.ammo++;
            this.addText(s.x, s.y + 0.8, t('sf.catch'), s.pl.css, 0.9);
            this.sfx('catch');
            this.sparks.burst(s.x, s.y, s.color, 14, 4, 0.4, 0.3);
            m.remove();
          } else {
            m.drop();
          }
          return true;
        }
        const r = s.hit(m.owner, 'missile', dx, dy);
        if (r === 'immune') continue;
        m.drop(-m.vx * 0.1, 3);
        return true;
      }
    }
    for (const a of this.aliens) {
      if (a.dead || !w.overlaps(a, m)) continue;
      a.damage(1, m.owner, dx, dy);
      m.drop(-m.vx * 0.1, 3);
      return true;
    }
    return false;
  }

  separateAliens() {
    const list = this.aliens;
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      if (a.dead || !a.flying) continue;
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j];
        if (b.dead || !b.flying) continue;
        const [dx, dy] = this.world.delta(a.x, a.y, b.x, b.y);
        const min = a.hw + b.hw;
        const d2 = dx * dx + dy * dy;
        if (d2 > min * min || d2 < 1e-6) continue;
        const d = Math.sqrt(d2), push = (min - d) * 0.5;
        a.vx -= (dx / d) * push * 6; a.vy -= (dy / d) * push * 6;
        b.vx += (dx / d) * push * 6; b.vy += (dy / d) * push * 6;
      }
    }
  }

  collide() {
    const w = this.world;
    const ships = this.aliveShips();

    // Alien goo bolts.
    for (const b of this.bolts) {
      if (b.dead) continue;
      for (const s of ships) {
        if (!s.alive || !w.overlaps(s, b)) continue;
        if (s.hit(null, 'acid', Math.sign(b.vx), Math.sign(b.vy)) !== 'immune') { b.remove(); break; }
      }
    }

    // Ships vs aliens (stomps in gravity maps).
    for (const s of ships) {
      for (const a of this.aliens) {
        if (!s.alive || a.dead || !w.overlaps(s, a)) continue;
        const fromAbove = w.gravity && s.prevY - s.hh >= a.y + a.hh - 0.25 && s.vy <= 0.5;
        if (fromAbove) {
          a.damage(1, s, 0, -1);
          s.vy = GRAV.stompBounce;
          this.sfx('stomp');
          this.puff(s.x, s.y - s.hh, 0xffffff, 5);
          continue;
        }
        const [dx, dy] = w.delta(a.x, a.y, s.x, s.y);
        const m = Math.hypot(dx, dy) || 1;
        s.hit(null, 'alien', dx / m, dy / m);
      }
    }

    // Ship vs ship: stomps in gravity maps (not between co-op teammates), otherwise a bump.
    const pvp = this.mode !== 'coop';
    for (let i = 0; i < ships.length; i++) {
      for (let j = i + 1; j < ships.length; j++) {
        const a = ships[i], b = ships[j];
        if (!a.alive || !b.alive || !w.overlaps(a, b)) continue;
        if (pvp && w.gravity && this.tryStomp(a, b)) continue;
        if (pvp && w.gravity && this.tryStomp(b, a)) continue;
        this.bump(a, b);
      }
    }

    // Pickups and rescues.
    for (const s of this.aliveShips()) {
      for (const m of this.missiles) {
        if (m.dead || !m.pickable || s.ammo >= SHIP.maxAmmo) continue;
        if (w.dist(s, m) > MISSILE.pickupRadius) continue;
        s.ammo++;
        m.remove();
        this.sfx('pickup');
        this.addText(s.x, s.y + 0.8, '+1', s.pl.css, 0.6);
      }
      for (const c of this.crates) {
        if (c.dead || c.age < 0.3 || !w.overlaps(s, c)) continue;
        this.openCrate(s, c);
      }
      if (this.mode === 'coop') {
        for (const pod of this.pods) {
          if (pod.kind === 'rescue' && pod.t > 0.8 && w.dist(s, pod) < 0.95) { this.rescue(pod.pl, s); break; }
        }
      }
    }
  }

  tryStomp(top, bottom) {
    if (top.prevY - top.hh < bottom.y + bottom.hh - 0.18) return false;
    if (top.vy > bottom.vy - GRAV.stompSpeed) return false;
    top.vy = GRAV.stompBounce;
    this.sfx('stomp');
    this.puff(bottom.x, bottom.y + bottom.hh, 0xffffff, 6);
    bottom.hit(top, 'stomp', 0, -1);
    return true;
  }

  bump(a, b) {
    const [dx, dy] = this.world.delta(a.x, a.y, b.x, b.y);
    const ox = a.hw + b.hw - Math.abs(dx), oy = a.hh + b.hh - Math.abs(dy);
    if (ox < oy) {
      const sx = Math.sign(dx) || 1;
      this.world.move(a, -sx * ox / 2, 0);
      this.world.move(b, sx * ox / 2, 0);
      const avg = (a.vx + b.vx) / 2;
      a.vx = avg - sx * 2; b.vx = avg + sx * 2;
    } else {
      const sy = Math.sign(dy) || 1;
      this.world.move(a, 0, -sy * oy / 2);
      this.world.move(b, 0, sy * oy / 2);
      const avg = (a.vy + b.vy) / 2;
      a.vy = avg - sy * 1.5; b.vy = avg + sy * 1.5;
    }
  }

  openCrate(ship, crate) {
    crate.remove();
    this.sfx('crate');
    this.sparks.burst(crate.x, crate.y, 0xffd36a, 30, 6, 0.6, 0.35);
    this.scene.confetti.burst(_v.set(crate.x, crate.y, 0.3), 0, { count: 16, speed: 5, colors: [COLORS.gold, 0xff5d73, COLORS.white], life: 0.9, gravity: -6 });
    const r = Math.random();
    if (r < 0.42) {
      ship.ammo = Math.min(SHIP.maxAmmo, ship.ammo + 2);
      this.addText(crate.x, crate.y + 0.7, t('sf.crate.ammo'), ship.pl.css, 1.2);
    } else if (r < 0.72 && !ship.shield) {
      ship.shield = true;
      this.sfx('shield');
      this.addText(crate.x, crate.y + 0.7, t('sf.crate.shield'), '#4cc9f0', 1.2);
    } else {
      ship.spread += 3;
      ship.ammo = Math.min(SHIP.maxAmmo, ship.ammo + 1);
      this.addText(crate.x, crate.y + 0.7, t('sf.crate.triple'), '#e0a100', 1.2);
    }
  }

  updateViews(dt) {
    for (const v of this.views) v.update(dt, this);
  }
}
