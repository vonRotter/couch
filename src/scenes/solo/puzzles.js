import * as THREE from 'three';
import { t, addStrings } from '../../core/i18n.js';
import { markSkipped } from '../../core/assist.js';
import { ArcadeRunner } from '../arcade/runner.js';
import { arcadeDef } from '../arcade/defs.js';
import { now } from './save.js';
import { dayIndex, weekIndex, dayRand, freeDay, dayMs } from './calendar.js';
import { heightAt } from './map.js';
import { makePuzzleDoor, makePuzzleLock } from './models10.js';
import { PUZZLE_DOORS } from './hopdata.js';

// Puzzles in the world (the classic games round): some of the hidden areas' treasure chests get a puzzle lock,
// and three new doors stand around the island (in the cliff behind Aunt Hazel's, in a mossy boulder on the east
// shore, in a giant old stump in the west wood) with something worth finding behind them. Each puzzle is a
// one-screen version of a Game Hall classic with a set goal (a maze, crates to push, lanterns to put to sleep, a
// tune to ring back, rows to clear, bricks to bonk, berries to eat, rocks to zap), short (well under two
// minutes), played right there over the island (the arcade runner, embedded).
//
// Special, never crowded (the owner's rule): a new puzzle appears about once a week, on a quiet day of the week
// (no festival, surprise or rare event: calendar.freeDay), and never while another one is still waiting; the
// order goes round the map (north, south-west, east, the sea, the cliff top, the west, Gull Rock, the hall roof).
// A chest's puzzle only comes once its hidden chest has been found, the west wood's door once the bridge is fixed:
// a puzzle that cannot be reached yet lets the next one go first. All from the date and the save (date-deterministic):
// the same week's puzzle day is the same for everyone.
//
// Solving it opens the chest or the door: coins, a keepsake for the yard (and seeds or a little something). After a
// few tries a skip is offered ("Help me play" offers): skipped, the lock opens anyway, the reward is given, it is
// marked skipped (the parent page lists it) and it can be played again. Every lock can be played again later.
// The last one also brings the puzzle trophy to the shelf. Saved in save.puzzles = { week, cur, at, done }.

export const PUZZLES = [
  { id: 'cliffdoor', door: 'cliff', game: 'maze', maze: { w: 5, h: 4 }, seed: 31, reward: { coins: 60, deco: 'minerLamp', items: [['stone', 4]] } },
  { id: 'hollow', chest: 'hollow', game: 'lights', lights: { n: 4, taps: [[0, 0], [3, 1], [1, 2], [2, 3]] }, reward: { coins: 40, deco: 'sleepyLantern' } },
  { id: 'rockdoor', door: 'rock', game: 'simon', goal: { notes: 5 }, reward: { coins: 60, deco: 'bellChime' } },
  { id: 'islet', chest: 'islet', game: 'crates', crates: ['#######', '#.  $ #', '# #   #', '#  $@.#', '#######'], reward: { coins: 50, deco: 'shipBottle', items: [['coconut', 2]] } },
  { id: 'grove', chest: 'grove', game: 'blocks', goal: { lines: 3 }, rows: 12, garbage: 3, well: 7, pieces: ['O', 'T', 'L', 'I'], reward: { coins: 50, deco: 'blockTower', items: [['starfruitSeed', 1]] } },
  { id: 'treedoor', door: 'tree', game: 'bonk', need: 'bridge', reward: { coins: 60, deco: 'acornLamp' } },
  { id: 'ledge', chest: 'ledge', game: 'snake', goal: { eat: 8 }, cols: 11, rows: 9, reward: { coins: 50, deco: 'wormPlush', items: [['strawberrySeed', 2]] } },
  { id: 'roof', chest: 'roof', game: 'rocks', goal: { rocks: 3 }, reward: { coins: 60, deco: 'spaceRock' } },
];
export const PUZZLE_IDS = PUZZLES.map((p) => p.id);
export const puzzleById = (id) => PUZZLES.find((p) => p.id === id) || null;

/** The three doors (hopdata.js: map.js keeps their spots clear). */
export const DOORS = PUZZLE_DOORS;
const STAND = 1.45; // the standing spot in front of a door

addStrings({
  en: {
    'pz.new': '🧩 Something new on the island: {where}! It is on your map.',
    'pz.where.cliffdoor': 'an old door in the cliff behind Aunt Hazel\'s', 'pz.where.hollow': 'a puzzle lock on the hollow tree\'s chest',
    'pz.where.rockdoor': 'a round door in a mossy boulder on the east shore', 'pz.where.islet': 'a puzzle lock on the islet\'s chest',
    'pz.where.grove': 'a puzzle lock on the chest in the hidden grove', 'pz.where.treedoor': 'a little door in a giant stump in the west wood',
    'pz.where.ledge': 'a puzzle lock on the chest on Gull Rock', 'pz.where.roof': 'a puzzle lock on Pip\'s box on the Game Hall roof',
    'pz.name.cliffdoor': 'The cliff door', 'pz.name.hollow': 'The hollow tree\'s chest', 'pz.name.rockdoor': 'The boulder door', 'pz.name.islet': 'The islet\'s chest',
    'pz.name.grove': 'The grove\'s chest', 'pz.name.treedoor': 'The stump door', 'pz.name.ledge': 'The Gull Rock chest', 'pz.name.roof': 'Pip\'s box on the roof',
    'pz.h.try': '[B] try the puzzle lock', 'pz.h.again': '[B] play the puzzle lock again', 'pz.h.locked': 'Locked tight. There is a picture on the lock...',
    'pz.h.open': 'Open: you found what was inside', 'pz.map': 'Puzzle lock: {game}',
    'pz.t.solved': 'The lock clicks open!', 'pz.t.skipped': 'Skipped: the lock opens anyway. You can play it again any time.',
    'pz.t.replayed': 'Solved again! (The prize was already yours.)', 'pz.t.all': 'Every puzzle lock is open! A trophy for your shelf.',
    'pz.reward': 'Inside: {prize}', 'pz.rewardSkip': 'The lock opens: {prize}',
    'isl.d.minerLamp': 'old miner\'s lamp', 'isl.d.sleepyLantern': 'sleepy lantern', 'isl.d.bellChime': 'bell chime', 'isl.d.shipBottle': 'ship in a bottle',
    'isl.d.blockTower': 'toy block tower', 'isl.d.acornLamp': 'acorn lamp', 'isl.d.wormPlush': 'wiggle worm plush', 'isl.d.spaceRock': 'glowing space rock',
    'isl.d.puzzleTrophy': 'puzzle trophy', 'pg.puzzles': 'Puzzle locks on the island',
  },
  no: {
    'pz.new': '🧩 Noe nytt på øya: {where}! Det står på kartet ditt.',
    'pz.where.cliffdoor': 'en gammel dør i fjellveggen bak tante Hassels hus', 'pz.where.hollow': 'en gåtelås på kista i det hule treet',
    'pz.where.rockdoor': 'en rund dør i en mosegrodd kampestein på østsiden', 'pz.where.islet': 'en gåtelås på kista på holmen',
    'pz.where.grove': 'en gåtelås på kista i den skjulte lunden', 'pz.where.treedoor': 'en liten dør i en kjempestubbe i vestskogen',
    'pz.where.ledge': 'en gåtelås på kista på Måkeskjæret', 'pz.where.roof': 'en gåtelås på Pips kasse på taket til Spillhallen',
    'pz.name.cliffdoor': 'Døra i fjellet', 'pz.name.hollow': 'Kista i det hule treet', 'pz.name.rockdoor': 'Steindøra', 'pz.name.islet': 'Kista på holmen',
    'pz.name.grove': 'Kista i lunden', 'pz.name.treedoor': 'Stubbedøra', 'pz.name.ledge': 'Kista på Måkeskjæret', 'pz.name.roof': 'Pips kasse på taket',
    'pz.h.try': '[B] prøv gåtelåsen', 'pz.h.again': '[B] spill gåtelåsen igjen', 'pz.h.locked': 'Godt låst. Det er et bilde på låsen...',
    'pz.h.open': 'Åpen: du fant det som var inni', 'pz.map': 'Gåtelås: {game}',
    'pz.t.solved': 'Låsen klikker opp!', 'pz.t.skipped': 'Hoppet over: låsen åpner seg likevel. Du kan spille den igjen når du vil.',
    'pz.t.replayed': 'Løst igjen! (Premien var allerede din.)', 'pz.t.all': 'Alle gåtelåsene er åpne! Et trofé til hylla di.',
    'pz.reward': 'Inni: {prize}', 'pz.rewardSkip': 'Låsen åpner seg: {prize}',
    'isl.d.minerLamp': 'gammel gruvelampe', 'isl.d.sleepyLantern': 'søvnig lykt', 'isl.d.bellChime': 'bjelleklokkespill', 'isl.d.shipBottle': 'skip i flaske',
    'isl.d.blockTower': 'lekeklosstårn', 'isl.d.acornLamp': 'eikenøttlampe', 'isl.d.wormPlush': 'vrikkeorm-kosedyr', 'isl.d.spaceRock': 'lysende romstein',
    'isl.d.puzzleTrophy': 'gåtetrofé', 'pg.puzzles': 'Gåtelåser på øya',
  },
});

// ---------- the pace (pure: tests simulate weeks with it) ----------

/** The save part (old saves: made on first use). */
export function puzzleSave(S) {
  if (!S.puzzles || typeof S.puzzles !== 'object') S.puzzles = {};
  const Z = S.puzzles;
  if (typeof Z.week !== 'number') Z.week = -1e9;
  if (Z.cur === undefined) Z.cur = null;
  if (!Z.at || typeof Z.at !== 'object') Z.at = {};
  if (!Z.done || typeof Z.done !== 'object') Z.done = {};
  return Z;
}

/** The day of week w a new puzzle may appear: a quiet day (no festival, surprise or rare event), picked from the date. */
export function puzzleDay(w) {
  const first = 4 + w * 7; // weekIndex: (dayIndex - 4) / 7
  const k = Math.floor(dayRand(`puzzle:${w}`) * 7);
  for (let i = 0; i < 7; i++) {
    const di = first + ((k + i) % 7);
    if (freeDay(dayMs(di))) return di;
  }
  return first + k;
}

/** Can this puzzle be reached now? (its chest found, the bridge for the west wood) */
export function canReach(S, p) {
  if (p.chest && !S.hops?.chests?.[p.chest]) return false;
  if (p.need && !S.unlocks?.[p.need]) return false;
  return true;
}

/** The next puzzle to bring: the first in the order not done yet that can be reached. */
export function nextPuzzle(S) {
  const Z = puzzleSave(S);
  return PUZZLES.find((p) => !Z.done[p.id] && canReach(S, p))?.id || null;
}

/**
 * The puzzle that is due at this time, or null (pure: nothing changes): none waiting, not one this week yet, and this
 * week's puzzle day has come. The odd-adventure round asks it too (odd.js puzzleComes: nothing else arrives that day).
 */
export function puzzleDue(S, at = now()) {
  if (!S.intro) return null; // (after the welcome)
  if (S.tut >= 1 && S.tut <= 7) return null; // (nor while Aunt Hazel's farming steps run: one new thing at a time)
  const Z = puzzleSave(S);
  if (Z.cur) return null; // one is waiting: never more than one
  const w = weekIndex(at);
  if (Z.week >= w) return null; // this week's already came
  if (dayIndex(at) < puzzleDay(w)) return null;
  // a puzzle day that passed while the child was away (or before the island was made) comes on a later quiet day
  // only, never on top of a festival, a surprise or a rare event (play-test: it came on a new island's Beach Day)
  if (dayIndex(at) > puzzleDay(w) && !freeDay(at)) return null;
  return nextPuzzle(S);
}

/** Bring a new puzzle if one is due at this time (puzzleDue). Returns the new puzzle's id or null. (Idempotent for the same time and save.) */
export function schedule(S, at = now()) {
  const id = puzzleDue(S, at);
  if (!id) return null;
  const Z = puzzleSave(S);
  Z.cur = id;
  Z.week = weekIndex(at);
  Z.at[id] = at;
  return id;
}

/** Done (solved or skipped): the lock is open, the next can come next week. */
export function markDone(S, id, { skipped = false, at = now() } = {}) {
  const Z = puzzleSave(S);
  if (!Z.done[id]) Z.done[id] = { at, skipped };
  else if (!skipped) Z.done[id].skipped = false; // played again and solved
  if (Z.cur === id) Z.cur = null;
}

// ---------- on the island ----------

export class Puzzles {
  constructor(host) {
    this.host = host;
    puzzleSave(host.save);
    this.group = new THREE.Group();
    host.scene.add(this.group);
    this.t = 0;
    this.runner = null;
    this.doors = {};
    const map = host.map;
    for (const p of PUZZLES) {
      if (!p.door) continue;
      const D = DOORS[p.door];
      const g = makePuzzleDoor(p.door);
      g.position.set(D.x, heightAt(D.x, D.z), D.z);
      g.rotation.y = D.rot;
      this.group.add(g);
      g.updateMatrixWorld(true);
      const fx = Math.sin(D.rot), fz = Math.cos(D.rot);
      // what blocks: the door's rock, cliff or stump behind it
      const back = p.door === 'cliff' ? 0.45 : p.door === 'rock' ? 1.7 : 2.35;
      if (p.door === 'cliff') map.boxObs(D.x - fx * back, D.z - fz * back, Math.abs(fz) * 1.3 + Math.abs(fx) * 0.5, Math.abs(fx) * 1.3 + Math.abs(fz) * 0.5);
      else map.circObs(D.x - fx * back, D.z - fz * back, p.door === 'rock' ? 2.1 : 2.2);
      this.doors[p.id] = { p, g, leaf: g.userData.leaf, open: 0, stand: { x: D.x + fx * STAND, z: D.z + fz * STAND }, lockAt: g.localToWorld(g.userData.lock.clone()) };
    }
    this.lock = null; // the floating lock over the waiting puzzle
    this.refresh(true);
    // a puzzle due today shows up (after the island has settled)
    host.later(1.6, () => this.check(true));
  }

  get S() { return this.host.save; }
  get Z() { return puzzleSave(this.host.save); }

  /** Where a puzzle is: its spot (x, y, z) and where to stand. */
  where(id) {
    const p = puzzleById(id);
    if (p.door) { const d = this.doors[id]; return { x: d.lockAt.x, y: d.lockAt.y, z: d.lockAt.z, stand: d.stand }; }
    const c = this.host.hops.chests[p.chest];
    return { x: c.x, y: c.y + 1.4, z: c.z, stand: { x: c.x, z: c.z } };
  }

  /** The doors' leaves (open when done) and the floating lock over the waiting puzzle. */
  refresh(snap = false) {
    const Z = this.Z;
    for (const d of Object.values(this.doors)) {
      d.target = Z.done[d.p.id] ? 1 : 0;
      if (snap) { d.open = d.target; d.leaf.rotation.y = -d.open * 1.9; }
    }
    const cur = Z.cur;
    if (this.lock && this.lock.userData.id !== cur) { this.lock.removeFromParent(); this.lock = null; }
    if (cur && !this.lock) {
      const p = puzzleById(cur);
      this.lock = makePuzzleLock(p.game);
      this.lock.userData.id = cur;
      const w = this.where(cur);
      this.lock.position.set(w.x, w.y, w.z);
      this.lock.userData.base = w.y;
      this.group.add(this.lock);
    }
  }

  /** Is a puzzle due? (on load and now and then) */
  check(load = false) {
    const id = schedule(this.S, now());
    if (!id) return;
    this.host.markDirty();
    this.refresh();
    this.host.game.ui.toast(t('pz.new', { where: t(`pz.where.${id}`) }), 4200);
    if (load) this.host.game.audio.play('star');
  }

  tick() {
    if ((this.tickN = (this.tickN || 0) + 1) % 20 === 0) this.check();
  }

  /** The map marker for the waiting puzzle (atlas.js). */
  markers() {
    const id = this.Z.cur;
    if (!id) return [];
    const p = puzzleById(id), w = this.where(id);
    return [{ key: `puzzle:${id}`, kind: 'place', icon: '🧩', name: t(`pz.name.${id}`), sub: t('pz.map', { game: t(`game.${p.game}`) }), x: w.x, z: w.z, tx: w.stand.x, tz: w.stand.z, isNew: true }];
  }

  // ---------- [B] ----------

  /** At a door: try the lock (waiting), play it again (done) or "locked". */
  interactions(P, out, nm) {
    for (const d of Object.values(this.doors)) {
      if (Math.hypot(P.x - d.stand.x, P.z - d.stand.z) > 1.3) continue;
      const id = d.p.id;
      if (this.Z.cur === id) out.b = { text: nm('pz.h.try'), fn: () => this.start(id) };
      else if (this.Z.done[id]) out.b = { text: nm('pz.h.again'), fn: () => this.start(id) };
      else out.b = { text: t('pz.h.locked'), fn: () => this.host.game.audio.play('bump') };
      return true;
    }
    return false;
  }

  /** At a chest (hops.js): its puzzle lock while one waits there; a done one can be played again once the chest is empty. */
  chestInteraction(chestId, full, out, nm) {
    const p = PUZZLES.find((x) => x.chest === chestId);
    if (!p) return false;
    if (this.Z.cur === p.id) { out.b = { text: nm('pz.h.try'), fn: () => this.start(p.id) }; return true; }
    if (this.Z.done[p.id] && !full) { out.b = { text: nm('pz.h.again'), fn: () => this.start(p.id) }; return true; }
    return false;
  }

  // ---------- playing one ----------

  get active() { return !!this.runner; }
  get holds() { return this.runner ? arcadeDef(this.runner.key)?.holds || [] : []; }

  start(id) {
    const host = this.host;
    if (this.runner || host.mode !== 'walk') return;
    const p = puzzleById(id);
    const replay = !!this.Z.done[id] && this.Z.cur !== id;
    this.playing = { id, replay };
    host.mode = 'puzzle';
    host.hud.setCinema(true);
    host.hud.setPrompt?.('');
    host.game.audio.play('select');
    const stand = { game: host.game, key: 'puzzle', get players() { return host.players; }, state: 'play' };
    const prize = t(`isl.d.${p.reward.deco}`);
    this.runner = new ArcadeRunner(stand, {
      key: p.game, embedded: true, seed: 1000 + PUZZLE_IDS.indexOf(id) * 97,
      puzzle: { ...p, rewardText: replay ? '' : t('pz.reward', { prize }) },
      onExit: (r) => this.later(() => this.finish(id, r)),
    });
    stand.camera = this.runner.camera;
    this.runner.start();
  }

  later(fn) { this.host.later(0, fn); }

  update(dt) {
    this.runner?.update(dt);
  }

  /** The runner closed: solved, skipped, or left for now. */
  finish(id, r = {}) {
    const host = this.host;
    this.runner?.dispose();
    this.runner = null;
    const replay = this.playing?.replay;
    this.playing = null;
    host.mode = 'walk';
    host.hud.setCinema(false);
    host.game.input.clearLatches?.();
    if (!r.solved && !r.skipped) return;
    if (replay) { if (r.solved) { markDone(this.S, id); host.game.ui.toast(t('pz.t.replayed'), 2600); host.markDirty(); } return; }
    this.reward(id, { skipped: !!r.skipped });
  }

  /** Open it: the prize, the chest's lid or the door, and the trophy after the last one. */
  reward(id, { skipped = false } = {}) {
    const host = this.host, p = puzzleById(id);
    markDone(this.S, id, { skipped });
    if (skipped) markSkipped(host.game.roster.progress, 'puzzles', id);
    const w = this.where(id);
    host.confetti.burst(new THREE.Vector3(w.x, w.y, w.z), 0, { count: 60, speed: 6, up: 5, life: 1.5, gravity: -6, colors: [0xffd23f, 0xffffff, 0xff9fc0, 0x8ff0ff, 0x3ddc97] });
    host.game.audio.play('fanfare');
    if (p.chest) { const c = host.hops.chests[p.chest]; if (c) c.open = 0.001; }
    host.game.ui.toast(t(skipped ? 'pz.t.skipped' : 'pz.t.solved'), 3000);
    host.grant(p.reward);
    if (PUZZLES.every((x) => this.Z.done[x.id]) && !this.S.deco.puzzleTrophy) host.later(1.2, () => { host.game.ui.toast(t('pz.t.all'), 3400); host.grant({ deco: 'puzzleTrophy' }); });
    this.refresh();
    host.markDirty();
  }

  // ---------- every frame ----------

  /** The floating lock bobs and glows (a slow breath: steady with "Reduce flashing"); doors swing open. */
  animate(dt) {
    this.t += dt;
    if (this.lock) {
      const L = this.lock;
      L.position.y = L.userData.base + Math.sin(this.t * 1.6) * 0.12;
      L.rotation.y = Math.sin(this.t * 0.7) * 0.5;
      if (L.userData.glow) L.userData.glow.scale.setScalar(1 + Math.sin(this.t * 2) * 0.06);
    }
    for (const d of Object.values(this.doors)) {
      if (d.open === d.target) continue;
      d.open += Math.sign(d.target - d.open) * Math.min(Math.abs(d.target - d.open), dt * 1.2);
      d.leaf.rotation.y = -d.open * 1.9;
    }
  }

  render(renderer) {
    if (!this.runner) return;
    renderer.autoClear = false;
    renderer.clearDepth();
    renderer.render(this.runner.scene, this.runner.camera);
    renderer.autoClear = true;
  }

  dispose() { this.runner?.dispose(); }
}
