import * as THREE from 'three';
import { t, addStrings } from '../../core/i18n.js';
import { Character } from '../../core/character.js';
import { now } from './save.js';
import { dayIndex, dayKey, freeDay, weekIndex } from './calendar.js';
import { heightAt } from './map.js';
import { puzzleDay, nextPuzzle, puzzleSave } from './puzzles.js';
import { Modes } from './modes.js';
import { MagicBall } from './magicball.js';
import { Wizard } from './wizard.js';
import { Inventor } from './inventor.js';
import { Creatures } from './creatures.js';
import { Folk, STAGE_DAYS as FOLK_STEPS } from './folk.js';

// The odd-adventure round (behaviour modes, a bouncing magic ball, a wizard school, an inventor and her odd machines,
// strange creatures, social happenings and a new folk). This module is its hub: the PACE at which its new things come
// to an island, and the hooks the island calls (talk, interactions, Today, the map, tasks).
//
// The owner's rule: new things must feel special, never "too much of the same at once". So everything here ARRIVES
// slowly, one thing at a time, through a letter and the Today board:
//   - at most one arrival a day, at least GAP days apart (about one every ten days, the owner's choice; sixteen
//     over about five to six months);
//   - only on a quiet day: no festival, daily surprise, rare event or drama big moment (calendar.freeDay), and not the
//     day a puzzle lock appears (puzzles.js), so one new special thing a day at most;
//   - in a fixed order, each after what it builds on (Sneaky mode after Sporty, the booths after the ball...), a step
//     that is not ready yet lets the next one go first (like the puzzle locks).
// Everything is computed from the date and the save (date-deterministic), so a test can simulate weeks of it.
// Save: S.odd = { first, last, got: { id: dayIndex }, ... } (old saves: made on first use, nothing arrived yet).

/** Days between two arrivals (at least). */
export const GAP = 9;
/** Days after the first visit of this round before the first arrival. */
export const FIRST_AFTER = 2;

/**
 * The arrivals in order. from: who writes the letter (isl.from.<from>); need(S, got): ready to come (built on what came
 * before); items: what the letter brings. Each part gives them meaning (modes.js, magicball.js, wizard.js, inventor.js,
 * creatures.js, folk.js).
 */
export const ARRIVALS = [
  { id: 'sporty', from: 'coach', icon: '🏃' }, // Coach Bo teaches Sporty mode (modes.js)
  { id: 'ball', from: 'tinka', icon: '🔮', items: [['magicBall', 1]] }, // Tinka mails a magic ball ahead of her (magicball.js)
  { id: 'sneaky', from: 'mumble', icon: '🤫', need: (S) => !!S.odd.modes?.sporty }, // Mumble teaches Sneaky mode
  { id: 'inventor', from: 'tinka', icon: '🔧' }, // Tinka moves in: her workshop (inventor.js)
  { id: 'school', from: 'wendeline', icon: '🪄' }, // the little wizard school opens: lesson one, the rain spell (wizard.js)
  { id: 'booths', from: 'tinka', icon: '📞', need: (S, got) => got.inventor !== undefined && !!S.odd.ball?.have }, // teleport booths
  { id: 'tea', from: 'rosa', icon: '🫖' }, // the tiny elephants' tea stall (creatures.js)
  { id: 'moss', from: 'mumble', icon: '🌿', need: (S) => !!S.odd.modes?.sneaky }, // a shy moss creature (only seen when sneaky)
  { id: 'robot', from: 'tinka', icon: '🤖', need: (S, got) => got.booths !== undefined }, // the joke vending robot
  { id: 'sun', from: 'wendeline', icon: '☀️', need: (S) => !!S.odd.wiz?.lessons?.rain }, // lesson two, the sun spell
  { id: 'folk', from: 'hoot', icon: '🪨' }, // the new folk arrive on a raft (folk.js)
  { id: 'mushroom', from: 'shroom', icon: '🍄' }, // the wandering mushroom merchant may come (creatures.js)
  { id: 'bounce', from: 'tinka', icon: '🔮', need: (S, got) => got.robot !== undefined && !!S.odd.ball?.have }, // the ball: one more bounce
  { id: 'whale', from: 'hoot', icon: '🐋' }, // the cloud whale may drift over at dusk (creatures.js)
  { id: 'voice', from: 'tinka', icon: '🗼', need: (S, got) => got.bounce !== undefined }, // the talking lighthouse
  { id: 'bounce2', from: 'tinka', icon: '🔮', need: (S, got) => got.voice !== undefined }, // the ball: one more bounce again
];
export const ARRIVAL_IDS = ARRIVALS.map((a) => a.id);

// guests of this round (not villagers: no hearts or gifts) and their voices (core/voices.js SPEAKERS)
export const ODD_SPEAKERS = new Set(['tinka', 'wendeline', 'shroom', 'elephant', 'moss', 'lighthouse', 'vendor', 'bimsa', 'tuko', 'wenna', 'guard']);

addStrings({
  en: {
    'isl.from.tinka': 'Tinka the inventor', 'isl.from.wendeline': 'Wizard Wendeline', 'isl.from.shroom': 'Old Morel, the mushroom merchant',
    'isl.from.coach': 'Coach Bo', 'isl.from.mumble': 'Mumble',
    'od.npc.tinka': 'Tinka', 'od.npc.wendeline': 'Wendeline',
    'isl.mail.od.sporty': 'Hey {name}! Coach Bo here. Come and find me at the Game Hall: I have a new move to show you. It is called Sporty mode, and it is FAST. See you there! Coach',
    'isl.mail.od.ball': 'Dear {name}, I am Tinka, an inventor, and I am moving to your island soon! I made you a little present: a magic ball. Hold it and throw it: it bounces off walls and always comes back to you. Try a tree! Yours, Tinka',
    'isl.mail.od.sneaky': 'psst... {name}... it is Mumble. I know how to walk very very quietly. Come to the meadow and I show you. Shhh! Mumble',
    'od.td.sporty': 'Coach Bo is stretching by the Game Hall. He wants to teach you something new!',
    'od.td.ball': 'A parcel in your mailbox, from someone called Tinka. It goes "boing"...',
    'od.td.sneaky': 'Mumble tiptoed past the square this morning. Nobody heard a thing!',
    'od.task.sporty': '🏃 Coach Bo has a new move for you (the Game Hall)',
    'od.task.sneaky': '🤫 Mumble wants to show you something (the meadow)',
    'isl.d.sporeLamp': 'Spore lamp', 'isl.d.mossCharm': 'Moss charm', 'isl.d.teaSet': 'Tiny tea set', 'isl.d.pebbleTower': 'Pebble tower',
    'isl.d.wizardHat': 'Wizard hat on a stand', 'isl.d.whaleKite': 'Cloud-whale kite', 'isl.d.clubPin': 'Secret club pin', 'isl.d.ballotBox': 'Little ballot box',
  },
  no: {
    'isl.from.tinka': 'oppfinneren Tinka', 'isl.from.wendeline': 'trollkvinnen Wendeline', 'isl.from.shroom': 'gamle Morkel, sopphandleren',
    'isl.from.coach': 'Trener Bo', 'isl.from.mumble': 'Mumle',
    'od.npc.tinka': 'Tinka', 'od.npc.wendeline': 'Wendeline',
    'isl.mail.od.sporty': 'Hei {name}! Det er trener Bo. Kom og finn meg ved Spillhallen: jeg har et nytt triks å vise deg. Det heter sportsmodus, og det går FORT. Vi ses! Trener Bo',
    'isl.mail.od.ball': 'Kjære {name}, jeg heter Tinka og er oppfinner, og snart flytter jeg til øya di! Jeg har laget en liten gave til deg: en magisk ball. Hold den og kast den: den spretter mot vegger og kommer alltid tilbake til deg. Prøv et tre! Hilsen Tinka',
    'isl.mail.od.sneaky': 'psst... {name}... det er Mumle. Jeg kan gå veldig veldig stille. Kom til enga, så viser jeg deg. Hysj! Mumle',
    'od.td.sporty': 'Trener Bo tøyer ut ved Spillhallen. Han vil lære deg noe nytt!',
    'od.td.ball': 'En pakke i postkassa di, fra en som heter Tinka. Den sier «boing»...',
    'od.td.sneaky': 'Mumle listet seg forbi torget i morges. Ingen hørte en lyd!',
    'od.task.sporty': '🏃 Trener Bo har et nytt triks til deg (Spillhallen)',
    'od.task.sneaky': '🤫 Mumle vil vise deg noe (enga)',
    'isl.d.sporeLamp': 'Sopplampe', 'isl.d.mossCharm': 'Mosemaskot', 'isl.d.teaSet': 'Bitteliten teservise', 'isl.d.pebbleTower': 'Steintårn',
    'isl.d.wizardHat': 'Trollmannshatt på stativ', 'isl.d.whaleKite': 'Skyhvaldrage', 'isl.d.clubPin': 'Hemmelig klubbmerke', 'isl.d.ballotBox': 'Liten valgurne',
  },
});

/** The save part (old saves: made on first use; nothing has arrived yet). */
export function oddSave(S, di = dayIndex()) {
  if (!S.odd || typeof S.odd !== 'object') S.odd = {};
  const O = S.odd;
  if (typeof O.first !== 'number') O.first = di;
  if (!O.got || typeof O.got !== 'object') O.got = {};
  if (typeof O.last !== 'number') O.last = -1e9;
  if (!O.modes || typeof O.modes !== 'object') O.modes = {};
  if (!['normal', 'sporty', 'sneaky'].includes(O.mode)) O.mode = 'normal';
  return O;
}

/** Does a puzzle lock appear on this day (puzzles.js: then nothing new arrives that day)? */
export function puzzleComes(S, at) {
  const Z = puzzleSave(S), w = weekIndex(at);
  return !!S.intro && !Z.cur && Z.week < w && dayIndex(at) >= puzzleDay(w) && !!nextPuzzle(S);
}

/**
 * Is a day quiet enough for something new to arrive? No festival, surprise or rare event (freeDay), no drama big moment
 * (village.js) and no puzzle lock appearing.
 */
export function quietDay(S, at) {
  const di = dayIndex(at), D = S.village?.drama;
  if (!freeDay(at)) return false;
  if (D && D.climax === di && !D.res) return false;
  return !puzzleComes(S, at);
}

/** The arrival due on this day (pure, for tests): the first in order not come yet that is ready, or null. */
export function arrivalDue(S, at) {
  if (!S.intro) return null;
  const O = oddSave(S, dayIndex(at)), di = dayIndex(at);
  if (di < O.first + FIRST_AFTER || di - O.last < GAP) return null;
  if (Object.values(O.got).includes(di)) return null;
  if (!quietDay(S, at)) return null;
  // the folk's next step (a house, the pebble circle, the drums) is that day's new thing: nothing else arrives then
  if (O.got.folk !== undefined && FOLK_STEPS.includes(di - O.got.folk) && di > O.got.folk) return null;
  // nor on the day a villagers' drama or social happening starts (its first news is that day's new thing; the
  // villagers' day is decided first: today.js newDay)
  if (S.village?.drama && S.village.drama.start === di) return null;
  return ARRIVALS.find((a) => O.got[a.id] === undefined && (!a.need || a.need(S, O.got)))?.id || null;
}

/** Has this thing come to the island (on or before the day `di`)? */
export const arrived = (S, id, di = dayIndex()) => S.odd?.got?.[id] !== undefined && S.odd.got[id] <= di;

// ---------- guests: simple beans with a name tag (not villagers) ----------

export class Guest {
  /** id: the speaker ('isl.<id>'); color, hat: a group put on the head; css: the dialog colour; nameKey. */
  constructor(host, { id, color, hat = null, css = '#7a4fc0', nameKey, scale = 1, obstacle = 0.45 }) {
    this.host = host;
    this.id = id;
    this.css = css;
    this.nameKey = nameKey;
    this.ch = new Character(color, { hat: 0 });
    if (hat) { this.ch.hatSlot.clear(); this.ch.hatSlot.add(hat); this.ch.hat = hat; }
    this.ch.group.scale.setScalar(scale);
    this.ch.group.visible = false;
    host.scene.add(this.ch.group);
    this.tag = host.game.ui.label('label isl-tag');
    this.tag.style.display = 'none';
    this.obs = obstacle ? host.map.circObs(1e5, 0, obstacle) : null;
    this.x = 1e5; this.z = 0;
    this.tagPos = new THREE.Vector3();
    this.hop = 0;
  }

  get name() { return t(this.nameKey); }

  /** Stand somewhere (or hide: show = false). */
  place(x, z, show = true, face = null) {
    this.x = x; this.z = z;
    this.ch.group.visible = show;
    this.ch.group.position.set(x, heightAt(x, z), z);
    if (this.obs) { this.obs.x = show ? x : 1e5; this.obs.z = z; }
    if (face) this.ch.face(face.x, face.z);
  }

  get shown() { return this.ch.group.visible; }

  near(P, r = 2) { return this.shown && Math.hypot(P.x - this.x, P.z - this.z) < r; }

  /** A line in this guest's voice: { name, css, speaker, key, vars, ... }. */
  line(key, vars, extra = {}) { return { name: this.name, css: this.css, speaker: `isl.${this.id}`, key, vars, ...extra }; }

  faceTo(P) { if (P) this.ch.face(P.x - this.x, P.z - this.z); }

  update(dt) {
    if (!this.shown) { this.tag.style.display = 'none'; return; }
    this.hop = Math.max(0, this.hop - dt * 2);
    this.ch.update(dt, { moving: 0, grounded: this.hop <= 0, vy: this.hop > 0 ? 3 : 0 });
    this.ch.group.position.y = heightAt(this.x, this.z) + Math.sin(this.hop * Math.PI) * 0.4;
    const host = this.host, P = host.player;
    const show = host.mode === 'walk' && P && Math.hypot(P.x - this.x, P.z - this.z) < 8;
    if (!show) { this.tag.style.display = 'none'; return; }
    if (this.tag.textContent !== this.name) this.tag.textContent = this.name;
    this.tagPos.set(this.x, this.ch.group.position.y + 1.55 * this.ch.group.scale.y + 0.5, this.z);
    host.game.ui.place(this.tag, this.tagPos, host.camera);
  }

  dispose() { this.tag?.remove(); }
}

// ---------- the hub ----------

export class Odd {
  constructor(host) {
    this.host = host;
    oddSave(host.save);
    this.modes = new Modes(host, this);
    this.ball = new MagicBall(host, this);
    this.parts = [this.modes, this.ball];
    this.wizard = this.add(new Wizard(host, this)); // part 2: the little wizard school and its weather spells (wizard.js)
    this.inventor = this.add(new Inventor(host, this)); // part 2: Tinka's workshop, teleport booths, the joke robot, the lighthouse voice
    this.creatures = this.add(new Creatures(host, this)); // part 3: Old Morel, the cloud whale, the tea elephants, the moss creature
    this.folk = this.add(new Folk(host, this)); // part 4: the Ollo folk, their words and Pebble Day (the social happenings: social.js, village.js)
  }

  /** The round's own island modes (each runs on its own: Start pauses them, main.js freezePause). */
  updateMode(mode, inp, panel, dt) {
    if (mode === 'spell') this.wizard.updateRune(panel, dt);
    else if (mode === 'teleport') this.inventor.updateTele(dt);
    else for (const p of this.parts) p.updateMode?.(mode, inp, panel, dt);
  }

  /** Add a part (the later modules: wizard, inventor, creatures, social happenings, folk). */
  add(part) { this.parts.push(part); return part; }

  get S() { return this.host.save; }
  get O() { return oddSave(this.host.save); }

  /** A new real day (today.js, after the villagers): maybe something new arrives, then each part's day. */
  newDay(at) {
    const S = this.S, O = this.O, di = dayIndex(at);
    const id = arrivalDue(S, at);
    if (id) {
      const A = ARRIVALS.find((a) => a.id === id);
      O.got[id] = di;
      O.last = di;
      O.news = { id, di };
      S.mail.push({ id: `od.${id}`, from: A.from, ...(A.items ? { items: A.items } : {}) });
      this.host.later(1.5, () => this.host.mailToast());
      for (const p of this.parts) p.onArrive?.(id, at);
      this.host.markDirty();
    }
    for (const p of this.parts) p.newDay?.(at);
  }

  /** The Today board's things: what arrived today, and each part's news. */
  todayNews(at) {
    const O = this.O, di = dayIndex(at), out = [];
    if (O.news?.di === di) {
      const A = ARRIVALS.find((a) => a.id === O.news.id);
      if (A) out.push({ kind: 'changed', pri: 8.2, icon: A.icon, keys: [`od.td.${A.id}`] });
    }
    for (const p of this.parts) for (const c of p.todayNews?.(at) || []) out.push(c);
    return out;
  }

  tick(at) { for (const p of this.parts) p.tick?.(at); }

  update(dt) { for (const p of this.parts) p.update?.(dt); }

  /** [B] near one of this round's things. */
  interactions(P, out, nm) {
    for (const p of this.parts) if (p.interactions?.(P, out, nm)) return true;
    return false;
  }

  /** What [B] does with something you hold (the magic ball), or null. */
  heldAction(id, nm) { return this.ball.action(id, nm) || this.wizard.action(id, nm) || null; }

  /** Before the usual talk with a villager: a lesson, a clue... True: handled. */
  talk(n, done) {
    for (const p of this.parts) if (p.talk?.(n, done)) return true;
    return false;
  }

  hasNews(id) { return this.parts.some((p) => p.hasNews?.(id)); }

  /** Places on the map (atlas.js). */
  markers() { return this.parts.flatMap((p) => p.markers?.() || []); }

  /** Today's things on the map (island.mapToday). */
  mapItems() { return this.parts.flatMap((p) => p.mapItems?.() || []); }

  /** The task list. */
  tasks() {
    const S = this.S, O = this.O, out = [];
    if (!S.intro) return out;
    if (O.got.sporty !== undefined && !O.modes.sporty) out.push(t('od.task.sporty'));
    if (O.got.sneaky !== undefined && !O.modes.sneaky) out.push(t('od.task.sneaky'));
    for (const p of this.parts) out.push(...(p.tasks?.() || []));
    return out;
  }

  /** Things the magic ball can hit now: [{ id, x, z, r, hit(info), stop?, needBounce? }]. */
  ballTargets() { return this.parts.flatMap((p) => p.ballTargets?.() || []); }

  /** A photo was taken (photo.js). */
  onPhoto() { for (const p of this.parts) p.onPhoto?.(); }

  /** The island's dialog voices: is this one of our guests? */
  static speaks(id) { return ODD_SPEAKERS.has(id); }

  dispose() { for (const p of this.parts) p.dispose?.(); }
}

export { now, dayKey };
