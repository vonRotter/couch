import * as THREE from 'three';
import { t, tFor, addStrings } from '../../core/i18n.js';
import { esc } from '../../core/ui.js';
import { say as speak } from '../../core/voice.js';
import { now, hourOf } from './save.js';
import { dayKey, dayIndex, rainyOn, rareEventOn, seasonOf } from './calendar.js';
import { heightAt, FIELD } from './map.js';
import { tileCenter, parseKey } from './farm.js';
import { ITEMS, addIcons } from './items.js';
import { mesh, sph } from './models.js';
import { Guest, arrived } from './odd.js';
import { makeWizardTower, makeGuestHat } from './models11.js';

// The little wizard school (the odd-adventure round, part 2): a round stone tower on the meadow between the hollow
// tree and the river, and Wizard Wendeline, who teaches weather spells as short lessons (each one: trace the spell's
// rune with the stick, one arrow at a time, nothing to fail; then cast it once for real).
//   - Lesson one, the rain spell (when the school opens): a little cloud rains over you for a moment and waters
//     every crop under it (at the field: the whole field). In winter it snows (snow waters too).
//   - Lesson two, the sun spell (a few weeks later, after lesson one): a warm ray that clears the weather for an hour
//     where you are: rain or snow stops (the crops are already wet), fog lifts (the ghost ship still comes at night).
//     On a clear day it simply shines.
// Daily limits, so spells never break the calendar's weather or seasons: each spell once a real day; the rain spell
// is a little local cloud (the day's weather stays what the calendar says); the sun spell only lifts the rain, snow or
// fog look for an hour (rainyOn() and the fog's ghost ship stay); no spells on Shell Isle or indoors.
// Cast with the wand (Wendeline gives it at the first lesson; a hotbar thing, [B] picks a spell you know).
// Save: S.odd.wiz = { lessons: { rain, sun }, cast: { rain: day, sun: day }, sunUntil, cloud }.

export const SCHOOL = { x: -20.5, z: 26, door: { x: -18.6, z: 26.2 }, teacher: { x: -18.4, z: 28.0 } };
const RUNES = { rain: ['up', 'down', 'down', 'right'], sun: ['up', 'right', 'down', 'left'] };
const ARROW = { up: '⬆', down: '⬇', left: '⬅', right: '➡' };
const CLOUD_T = 14; // seconds the rain cloud rains
const SUN_MS = 60 * 60 * 1000; // the sun spell clears the weather this long
const CSS = `.isl-rune { display: flex; gap: 10px; justify-content: center; font-size: clamp(30px, 4vw, 56px); margin: 10px 0; }
.isl-rune span { width: 1.4em; height: 1.4em; display: grid; place-items: center; border-radius: 16px; background: rgba(74,63,192,.12); border: 3px solid rgba(74,63,192,.35); }
.isl-rune span.on { background: #ffd23f; border-color: #c99a00; }
.isl-rune span.next { border-color: #4a3fc0; border-style: dashed; }`;

ITEMS.wand = { kind: 'gadget' };
addIcons({ wand: '<path d="M5 20 L16 9" stroke="#5a3a8a" stroke-width="3" stroke-linecap="round"/><path d="M18 2 L19.2 5.6 L23 5.8 L20 8.1 L21 11.8 L18 9.7 L15 11.8 L16 8.1 L13 5.8 L16.8 5.6Z" fill="#ffd23f" stroke="#2b2340" stroke-width="1"/>' });

addStrings({
  en: {
    'isl.i.wand': 'wand', 'wz.school': 'The Little Wizard School', 'map.a.school': 'The Little Wizard School',
    'isl.mail.od.school': 'Dear {name}, a little wizard school has opened on your island, between the hollow tree and the river! I teach weather spells, just small ones. Come for your first lesson: the rain spell. Wizard Wendeline',
    'isl.mail.od.sun': 'Dear {name}, you are ready for lesson two: the sun spell! Come to the school when you can. Wendeline',
    'od.td.school': 'A little tower with a pointy roof stands by the river now. A wizard school!',
    'od.td.sun': 'Wizard Wendeline polished a sunny rune on her door: lesson two is ready.',
    'wz.h.talk': '[B] talk to Wendeline', 'wz.h.lesson': '[B] a lesson with Wendeline',
    'wz.w.hello1': 'Welcome, welcome! I am Wendeline. Weather spells are my favourite: small ones, kind ones.',
    'wz.w.rain1': 'Lesson one: the rain spell. Every spell has a rune. You draw it with the stick, one arrow at a time.',
    'wz.w.rain2': 'Draw it, and a little cloud comes to water your crops. Only once a day, mind: clouds get tired too!',
    'wz.w.sun1': 'Lesson two: the sun spell! A warm ray that clears rain, snow or fog where you are, for a little while.',
    'wz.w.sun2': 'The weather comes back afterwards, of course. We borrow the sky, we do not keep it.',
    'wz.w.wand': 'Here is a wand for you. Hold it and press [B] to pick a spell.',
    'wz.w.done': 'Wonderful! Now try it for real, outside, wherever you like.',
    'wz.chat.1': 'A good spell is a small spell. Big ones make the clouds grumpy.',
    'wz.chat.2': 'I once made it snow on one single carrot. It was very surprised.',
    'wz.chat.3': 'Did you know the gulls can feel a spell coming? They fluff up their feathers.',
    'wz.chat.4': 'My hat has seventeen stars. I counted them twice.',
    'wz.chat.5': 'Rain likes to be asked nicely. Up, down, down, and a little wave to the right.',
    'wz.chat.6': 'The sun spell is my warmest. I keep it for foggy mornings.',
    'wz.chat.7': 'Wizards do not need to be old. You only need to be curious.',
    'wz.chat.8': 'Tea and a spell book: my perfect afternoon.',
    'wz.chat.9': 'Every rune is a little drawing of the weather it calls. Can you see it?',
    'wz.chat.10': 'I hum when I tidy the tower. Nobody has told me to stop yet.',
    'wz.rune.title': 'The {spell}', 'wz.rune.hint': 'Push the stick: {arrows}. Nothing can go wrong, take your time. [C]: stop',
    'wz.spell.rain': 'rain spell', 'wz.spell.sun': 'sun spell', 'wz.spellName.rain': 'Rain spell', 'wz.spellName.sun': 'Sun spell',
    'wz.t.rain': 'A little cloud! It waters every crop under it.', 'wz.t.snow': 'A little cloud! It snows softly on your crops.',
    'wz.t.sun': 'A warm ray! The sky clears for an hour.', 'wz.t.sunClear': 'A warm ray of sun. Everything sparkles!',
    'wz.t.tired': 'The {spell} needs a day\'s rest. Try again tomorrow!', 'wz.t.notHere': 'Spells only work outside on your island.',
    'wz.t.learned': 'You learned the {spell}!', 'wz.ask': 'Which spell?', 'wz.never': 'Never mind',
    'wz.task.rain': '🪄 Lesson one at the wizard school (by the river)', 'wz.task.sun': '🪄 Lesson two at the wizard school: the sun spell',
    'wz.task.try': '🪄 Try the {spell} with your wand',
  },
  no: {
    'isl.i.wand': 'tryllestav', 'wz.school': 'Den lille trollmannsskolen', 'map.a.school': 'Den lille trollmannsskolen',
    'isl.mail.od.school': 'Kjære {name}, en liten trollmannsskole har åpnet på øya di, mellom det hule treet og elva! Jeg lærer bort værtrylleformler, bare små. Kom til den første timen: regntrylleformelen. Trollkvinnen Wendeline',
    'isl.mail.od.sun': 'Kjære {name}, nå er du klar for time to: soltrylleformelen! Kom til skolen når du kan. Wendeline',
    'od.td.school': 'Et lite tårn med spisst tak står ved elva nå. En trollmannsskole!',
    'od.td.sun': 'Trollkvinnen Wendeline har pusset en solrune på døra si: time to er klar.',
    'wz.h.talk': '[B] snakk med Wendeline', 'wz.h.lesson': '[B] en time med Wendeline',
    'wz.w.hello1': 'Velkommen, velkommen! Jeg heter Wendeline. Værtrylleformler er favoritten min: små og snille.',
    'wz.w.rain1': 'Time en: regntrylleformelen. Hver trylleformel har en rune. Du tegner den med spaken, én pil om gangen.',
    'wz.w.rain2': 'Tegn den, så kommer en liten sky og vanner plantene dine. Bare én gang om dagen: skyer blir også slitne!',
    'wz.w.sun1': 'Time to: soltrylleformelen! En varm stråle som fjerner regn, snø eller tåke der du er, en liten stund.',
    'wz.w.sun2': 'Været kommer tilbake etterpå, selvfølgelig. Vi låner himmelen, vi beholder den ikke.',
    'wz.w.wand': 'Her er en tryllestav til deg. Hold den og trykk [B] for å velge en trylleformel.',
    'wz.w.done': 'Fantastisk! Prøv den på ordentlig nå, ute, hvor du vil.',
    'wz.chat.1': 'En god trylleformel er en liten trylleformel. Store gjør skyene grinete.',
    'wz.chat.2': 'En gang fikk jeg det til å snø på én eneste gulrot. Den ble veldig overrasket.',
    'wz.chat.3': 'Visste du at måkene kjenner det når en trylleformel kommer? De bruser med fjærene.',
    'wz.chat.4': 'Hatten min har sytten stjerner. Jeg har telt dem to ganger.',
    'wz.chat.5': 'Regnet liker å bli spurt pent. Opp, ned, ned, og et lite vink til høyre.',
    'wz.chat.6': 'Soltrylleformelen er min varmeste. Jeg sparer den til tåkete morgener.',
    'wz.chat.7': 'Trollmenn trenger ikke være gamle. Man trenger bare være nysgjerrig.',
    'wz.chat.8': 'Te og en trylleformelbok: min perfekte ettermiddag.',
    'wz.chat.9': 'Hver rune er en liten tegning av været den kaller på. Ser du det?',
    'wz.chat.10': 'Jeg nynner når jeg rydder i tårnet. Ingen har bedt meg slutte ennå.',
    'wz.rune.title': '{spell}', 'wz.rune.hint': 'Skyv spaken: {arrows}. Ingenting kan gå galt, ta den tiden du trenger. [C]: stopp',
    'wz.spell.rain': 'regntrylleformelen', 'wz.spell.sun': 'soltrylleformelen', 'wz.spellName.rain': 'Regntrylleformel', 'wz.spellName.sun': 'Soltrylleformel',
    'wz.t.rain': 'En liten sky! Den vanner alle plantene under seg.', 'wz.t.snow': 'En liten sky! Det snør mykt på plantene dine.',
    'wz.t.sun': 'En varm stråle! Himmelen klarner i en time.', 'wz.t.sunClear': 'En varm solstråle. Alt glitrer!',
    'wz.t.tired': '{spell} trenger en dags hvile. Prøv igjen i morgen!', 'wz.t.notHere': 'Trylleformler virker bare ute på øya di.',
    'wz.t.learned': 'Du lærte {spell}!', 'wz.ask': 'Hvilken trylleformel?', 'wz.never': 'Ikke nå',
    'wz.task.rain': '🪄 Time en på trollmannsskolen (ved elva)', 'wz.task.sun': '🪄 Time to på trollmannsskolen: soltrylleformelen',
    'wz.task.try': '🪄 Prøv {spell} med tryllestaven din',
  },
});

/** A chat line for a date that was not said in the last four weeks (said: [{ k, di }]). */
export function freshLine(prefix, n, said, di, seed, ok = null) {
  const recent = new Set((said || []).filter((x) => di - x.di < 28).map((x) => x.k));
  const s = Math.abs(Math.floor(Math.sin(di * 12.9898 + seed) * 43758.5453)) % n;
  for (let i = 0; i < n; i++) { const k = `${prefix}.${((s + i) % n) + 1}`; if (!recent.has(k) && (!ok || ok(k))) return k; }
  return null;
}

export class Wizard {
  constructor(host, odd) {
    this.host = host;
    this.odd = odd;
    if (!document.getElementById('isl-wiz-style')) { const st = document.createElement('style'); st.id = 'isl-wiz-style'; st.textContent = CSS; document.head.appendChild(st); }
    this.tower = makeWizardTower(host.M);
    this.tower.position.set(SCHOOL.x, heightAt(SCHOOL.x, SCHOOL.z), SCHOOL.z);
    this.tower.visible = false;
    host.scene.add(this.tower);
    this.towerObs = host.map.circObs(1e5, SCHOOL.z, 1.75);
    host.map.addKeepOut(SCHOOL.x + 1, SCHOOL.z + 1, 4, 'wizard school');
    this.teacher = new Guest(host, { id: 'wendeline', color: 0xb8a8ff, hat: makeGuestHat('wizard'), css: '#4a3fc0', nameKey: 'od.npc.wendeline' });
    this.rune = null;
    this.cloud = null;
    this.t = 0;
  }

  get S() { return this.host.save; }
  get W() {
    const O = this.odd.O;
    if (!O.wiz || typeof O.wiz !== 'object') O.wiz = { lessons: {}, cast: {}, said: [], tried: {} };
    O.wiz.lessons ||= {}; O.wiz.cast ||= {}; O.wiz.said ||= []; O.wiz.tried ||= {};
    return O.wiz;
  }
  get open() { return arrived(this.S, 'school'); }

  /** The lesson waiting (the school open and lesson one not done; the sun's letter came and lesson two not done). */
  lessonDue() {
    const W = this.W;
    if (!this.open) return null;
    if (!W.lessons.rain) return 'rain';
    if (arrived(this.S, 'sun') && !W.lessons.sun) return 'sun';
    return null;
  }

  tick() {
    const host = this.host, h = hourOf(), here = !host.isle2?.here();
    const show = this.open && here;
    this.tower.visible = show;
    this.towerObs.x = show ? SCHOOL.x : 1e5;
    const T = SCHOOL.teacher;
    this.teacher.place(T.x, T.z, show && h >= 8 && h < 20, { x: 0, z: 1 });
  }

  // ---------- talking and lessons ----------

  interactions(P, out, nm) {
    if (!this.teacher.near(P, 1.9)) return false;
    const due = this.lessonDue();
    out.b = { text: nm(due ? 'wz.h.lesson' : 'wz.h.talk'), fn: () => this.talk1() };
    return true;
  }

  talk1() {
    const host = this.host, W = this.W, P = host.player, g = this.teacher, di = dayIndex();
    g.faceTo(P);
    P.ch.face(g.x - P.x, g.z - P.z);
    const due = this.lessonDue();
    if (due) {
      const lines = [...(W.met ? [] : [g.line('wz.w.hello1')]), g.line(`wz.w.${due}1`), g.line(`wz.w.${due}2`)];
      W.met = true;
      host.say(lines, () => this.startRune(due, true));
      return;
    }
    // one chat a day, never one heard in the last four weeks; else she just waves (no line said twice)
    const k = W.said.some((x) => x.di === di) ? null : freshLine('wz.chat', 10, W.said, di, 3.1);
    if (k) { W.said = [...W.said.filter((x) => di - x.di < 60), { k, di }]; host.say([g.line(k)]); } else waveHello(host, g);
    host.markDirty();
  }

  /** The rune: push the stick in the arrows' order (lesson: learn it; cast: the spell happens). Nothing to fail. */
  startRune(spell, lesson = false) {
    const host = this.host;
    host.mode = 'spell';
    this.rune = { spell, lesson, i: 0, t: 0, wob: 0 };
    this.renderRune(true);
    host.game.audio.play('select');
  }

  renderRune(read = false) {
    const R = this.rune, host = this.host, seq = RUNES[R.spell];
    const arrows = seq.map((d, i) => `<span class="${i < R.i ? 'on' : i === R.i ? 'next' : ''}">${ARROW[d]}</span>`).join('');
    const words = seq.map((d) => ARROW[d]).join(' ');
    host.hud.setPanel(`<h2>🪄 ${esc(t('wz.rune.title', { spell: t(`wz.spellName.${R.spell}`) }))}</h2><div class="isl-rune" style="${R.wob > 0 ? 'transform:translateX(4px)' : ''}">${arrows}</div><div class="isl-foot" style="opacity:1">${esc(tFor(host.player?.p, 'wz.rune.hint', { arrows: words }))}</div>`);
    if (read) speak(t('wz.rune.hint', { arrows: seq.map((d) => t(`wz.dir.${d}`)).join(', ') }), 'narrator');
  }

  /** In 'spell' mode: the stick draws the rune (stepX / stepY), [C] stops. */
  updateRune(inp, dt) {
    const R = this.rune, host = this.host;
    if (!R) { host.mode = 'walk'; return; }
    R.t += dt;
    R.wob = Math.max(0, R.wob - dt);
    if (inp.bPressed && R.t > 0.3) { this.rune = null; host.hud.setPanel(null); host.mode = 'walk'; return; }
    const dir = inp.stepX > 0 ? 'right' : inp.stepX < 0 ? 'left' : inp.stepY > 0 ? 'up' : inp.stepY < 0 ? 'down' : null;
    if (!dir || R.t < 0.25) return;
    const seq = RUNES[R.spell];
    if (dir === seq[R.i]) {
      R.i++;
      const A = host.game.audio;
      if (A.ctx && !A.muted) A.tone(440 * Math.pow(2, R.i / 6), 0.25, { type: 'sine', vol: 0.12 });
      if (R.i >= seq.length) { this.finishRune(); return; }
    } else { R.wob = 0.15; host.game.audio.play('bump'); }
    this.renderRune();
  }

  finishRune() {
    const R = this.rune, host = this.host, W = this.W;
    this.rune = null;
    host.hud.setPanel(null);
    host.mode = 'walk';
    host.game.audio.play('fanfare');
    if (R.lesson) {
      W.lessons[R.spell] = true;
      host.game.ui.toast(t('wz.t.learned', { spell: t(`wz.spell.${R.spell}`) }), 2600);
      const g = this.teacher, lines = [g.line('wz.w.done')];
      if (!this.S.inv.some((x) => x.id === 'wand') && !(this.S.chest || []).some((x) => x.id === 'wand')) { lines.unshift(g.line('wz.w.wand')); host.giveItems([['wand', 1]], true); }
      host.say(lines);
      host.markDirty();
      return;
    }
    this.cast(R.spell);
  }

  // ---------- casting ----------

  /** [B] with the wand: pick a spell you know (a question), then draw its rune. */
  action(id, nm) {
    if (id !== 'wand') return null;
    const known = ['rain', 'sun'].filter((s) => this.W.lessons[s]);
    if (!known.length) return null;
    return { text: nm('wz.h.cast'), ok: true, fn: () => {
      const host = this.host;
      host.say([{ name: t('isl.i.wand'), css: '#4a3fc0', key: 'wz.ask', choices: [...known.map((s) => `wz.spellName.${s}`), 'wz.never'], onChoice: (i) => { if (i < known.length) this.tryCast(known[i]); } }]);
    } };
  }

  /** Can it be cast now? (outside on the main island, once a day each) */
  tryCast(spell) {
    const host = this.host, W = this.W, day = dayKey();
    if (host.indoors || host.isle2?.here()) { host.game.ui.toast(t('wz.t.notHere'), 2200); return; }
    if (W.cast[spell] === day) { host.game.ui.toast(t('wz.t.tired', { spell: t(`wz.spellName.${spell}`) }), 2400); host.game.audio.play('bump'); return; }
    this.startRune(spell, false);
  }

  cast(spell) {
    const host = this.host, W = this.W, P = host.player, day = dayKey();
    W.cast[spell] = day;
    W.tried[spell] = true;
    if (spell === 'rain') {
      // over the field when you are near it (then all of it), else over you
      const fc = tileCenter((FIELD.cols - 1) / 2, (FIELD.rows - 1) / 2, 0);
      const atField = Math.hypot(P.x - fc.x, P.z - fc.z) < 12;
      const at = atField ? { x: fc.x, z: fc.z, r: 7 } : { x: P.x, z: P.z, r: 4 };
      W.cloud = { ...at, until: now() + CLOUD_T * 1000 };
      this.waterUnder(at);
      host.game.ui.toast(t(seasonOf() === 'winter' ? 'wz.t.snow' : 'wz.t.rain'), 2600);
    } else {
      const weather = rainyOn(now()) || rareEventOn(now()) === 'fog';
      if (weather) W.sunUntil = now() + SUN_MS;
      host.game.ui.toast(t(weather ? 'wz.t.sun' : 'wz.t.sunClear'), 2600);
      host.confetti?.burst(new THREE.Vector3(P.x, P.y + 3, P.z), 0, { count: 30, speed: 3, up: 2, life: 1.2, gravity: -2, colors: [0xffd23f, 0xfff3b0, 0xffffff] });
    }
    host.markDirty();
  }

  /** Every crop under the cloud is watered (like rain: farm.water). */
  waterUnder(at) {
    const host = this.host, S = this.S, t0 = now();
    for (const key of Object.keys(S.tiles || {})) {
      const { c, r, f } = parseKey(key);
      if (f) continue; // (the greenhouse has its own roof)
      const p = tileCenter(c, r, 0);
      if (Math.hypot(p.x - at.x, p.z - at.z) > at.r) continue;
      if (S.tiles[key].crop || !S.tiles[key].grass) host.farm.water(c, r, t0, 0);
    }
    host.markDirty();
  }

  /** The sun spell lifts the weather's look for an hour (seasons.js and events.js ask). */
  get sunny() { return (this.W.sunUntil || 0) > now(); }

  // ---------- the rest ----------

  hasNews() { return false; }

  tasks() {
    const due = this.lessonDue(), W = this.W, out = [];
    if (due) out.push(t(`wz.task.${due}`));
    for (const s of ['rain', 'sun']) if (W.lessons[s] && !W.tried[s]) out.push(t('wz.task.try', { spell: t(`wz.spell.${s}`) }));
    return out;
  }

  markers() {
    if (!this.open) return [];
    return [{ key: 'odd:school', kind: 'place', icon: '🪄', name: t('map.a.school'), x: SCHOOL.x, z: SCHOOL.z, tx: SCHOOL.teacher.x, tz: SCHOOL.teacher.z + 1.2, isNew: !!this.lessonDue() }];
  }

  update(dt) {
    this.t += dt;
    this.teacher.update(dt);
    const W = this.odd.O.wiz, host = this.host;
    // the rain cloud: a puffy cloud that drifts a little and drops soft rain (or snow)
    const on = W?.cloud && W.cloud.until > now() && !host.isle2?.here();
    if (on && !this.cloud) { this.cloud = makeCloud(); host.scene.add(this.cloud); }
    if (!on && this.cloud) { this.cloud.removeFromParent(); this.cloud = null; }
    if (this.cloud) {
      const C = W.cloud;
      this.cloud.position.set(C.x + Math.sin(this.t * 0.5) * 0.6, heightAt(C.x, C.z) + 6, C.z);
      if ((this.dropT = (this.dropT || 0) - dt) <= 0) {
        this.dropT = 0.12;
        const a = Math.random() * Math.PI * 2, d = Math.random() * C.r * 0.7;
        host.puffs?.burst(new THREE.Vector3(C.x + Math.cos(a) * d, heightAt(C.x, C.z) + 5.4, C.z + Math.sin(a) * d), seasonOf() === 'winter' ? 0xffffff : 0x8fd0ff, { count: 2, speed: 0.4, size: 0.12, life: 1.1, gravity: seasonOf() === 'winter' ? -2 : -14 });
      }
    }
  }

  dispose() { this.teacher.dispose(); this.cloud?.removeFromParent(); }
}

/** A guest with nothing new to say today: a wave and a little hop, no words (lines never repeat for weeks). */
export function waveHello(host, g) {
  g.hop = 1;
  host.emotes?.floatText?.(new THREE.Vector3(g.x, g.ch.group.position.y + 2, g.z), '👋', { css: '#2b2340' });
  host.game.ui.toast(t('od.wave', { name: g.name }), 1800);
  host.game.audio.play('emoteWave');
}

function makeCloud() {
  const g = new THREE.Group();
  for (const [x, y, z, r] of [[0, 0, 0, 1.2], [1.1, -0.2, 0.2, 0.9], [-1.1, -0.15, -0.1, 0.95], [0.4, 0.5, -0.2, 0.8]]) g.add(mesh(sph(r, 12, 8), 0xf4f6ff, x, y, z));
  return g;
}

addStrings({
  en: { 'od.wave': '{name} waves at you happily.', 'wz.h.cast': '[B] cast a spell', 'wz.dir.up': 'up', 'wz.dir.down': 'down', 'wz.dir.left': 'left', 'wz.dir.right': 'right' },
  no: { 'od.wave': '{name} vinker blidt til deg.', 'wz.h.cast': '[B] kast en trylleformel', 'wz.dir.up': 'opp', 'wz.dir.down': 'ned', 'wz.dir.left': 'venstre', 'wz.dir.right': 'høyre' },
});
