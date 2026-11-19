import * as THREE from 'three';
import { t, tFor, addStrings } from '../../core/i18n.js';
import { esc } from '../../core/ui.js';
import { say as speak } from '../../core/voice.js';
import { now, hourOf } from './save.js';
import { dayKey, dayIndex, dayMs, setExtraFestival, pebbleDayNative, surpriseOn, rareEventOn } from './calendar.js';
import { heightAt } from './map.js';
import { mesh, box, sph, cyl, cone } from './models.js';
import { Guest, arrived } from './odd.js';
import { makeGuestHat, makeDeco11 } from './models11.js';

// A new folk moves in (the odd-adventure round, part 4): the Ollo folk, three travellers who came on a raft from a
// far-away reef and settle in the north-east corner, under the cliffs, over a few weeks. Original and playful: they
// wear tall knitted hats with a little bell, greet by bowing so the bells ring, leave a painted pebble on the doorstep
// of someone they like, hum together at sunset and keep their own festival, Pebble Day, when everyone paints a pebble
// with a wish and the pebbles become a tower.
//   - They come slowly: Hoot's letter (an arrival of odd.js), then a tent; a week later their first round house and a
//     third traveller; two weeks: a second house and the pebble circle (now they have settled); three weeks: a third
//     house and their drum logs. Each step is a line on the Today board (like the villagers' projects).
//   - Their language, Ollish: a few words per visit (at most two new words a day), kept in a word book (the journal's
//     Friends tab, its last page). The first four words come by just talking; after that they teach more only when you
//     greet them their way ("Ollo!", once you know it).
//   - Pebble Day: the fifth Saturday of a month (when a month has one and the day is otherwise quiet: no daily surprise
//     or rare event), once they have settled; a festival of this island only (calendar.setExtraFestival): paint a pebble
//     at their village and it joins the tower.
// Save: S.odd.folk = { words: [ids], wordDay: { day, n }, met: { id: true }, customs: [keys], pebble: { day }, painted }.

export const FOLK = { x: 44.5, z: -27.5, raft: { x: 55.2, z: -24.5 } };
const HOUSES = [{ x: 40.6, z: -27.8, r: 1.3 }, { x: 45.8, z: -29.6, r: 1.3 }, { x: 49.0, z: -27.0, r: 1.3 }];
const TOWER = { x: 44.4, z: -25.6 };
const MEMBERS = [
  { id: 'bimsa', color: 0xd9a066, hat: 'bells', spot: { x: 43.0, z: -26.2 }, from: 0 },
  { id: 'tuko', color: 0xffd0a0, hat: 'bellsRed', spot: { x: 46.6, z: -25.8 }, from: 0 },
  { id: 'wenna', color: 0xb07a50, hat: 'bellsBlue', spot: { x: 42.0, z: -24.6 }, from: 7 },
];
/** Their words in order (the first four come by plain talk; the rest only after an "Ollo!" greeting). */
export const WORDS = ['ollo', 'bimbom', 'fliffi', 'zibbo', 'tanu', 'pom', 'nunu', 'wawa', 'pipri', 'mimola', 'dumdi', 'yaya', 'nono', 'hoppa', 'zizzi', 'pompom'];
export const FREE_WORDS = 4, WORDS_A_DAY = 2;
const STAGE_DAYS = [0, 7, 14, 21];
const CUSTOMS = ['hats', 'pebbles', 'hum', 'pebbleday'];
const COLORS = [['red', 0xff5d73], ['blue', 0x4cc9f0], ['yellow', 0xffd23f], ['green', 0x3ddc97]];

addStrings({
  en: {
    'od.npc.bimsa': 'Elder Bimsa', 'od.npc.tuko': 'Tuko', 'od.npc.wenna': 'Wenna',
    'fk.folk': 'the Ollo folk', 'map.a.folk': 'The Ollo folk\'s corner', 'isl.fest.pebble': 'Pebble Day', 'map.a.pebble': 'Pebble Day',
    'isl.mail.od.folk': 'Dear {name}, a raft landed on the north-east shore this morning! Three travellers from a far-away reef would like to stay, under the cliffs. They are shy at first. They say "ollo" for hello. Let us make them welcome! Curator Hoot',
    'od.td.folk': 'A raft landed on the north-east shore. Travellers with tall knitted hats!',
    'fk.td.s1': 'The Ollo folk built their first round house under the north-east cliffs. A third traveller came!',
    'fk.td.s2': 'A second round house, and a circle of painted pebbles: the Ollo folk have settled in.',
    'fk.td.s3': 'Drum logs and a third house in the Ollo folk\'s corner. It is a little village now!',
    'td.fest.pebble.1': 'Pebble Day! The Ollo folk paint pebbles with wishes and build a tower.',
    'td.fest.pebble.2': 'Drums in the north-east corner: it is the Ollo folk\'s Pebble Day!',
    'td.fest.pebble.3': 'The Ollo folk invite everyone to Pebble Day. Bring a wish!',
    'fk.h.talk': '[B] talk to {name}', 'fk.h.paint': '[B] paint a pebble for the tower',
    'fk.greet.ask': '(How do you say hello?)', 'fk.greet.ollo': 'Say: "Ollo!"', 'fk.greet.hello': 'Say: "Hello!"',
    'fk.bimsa.meet': 'Ollo, little one. I am Bimsa. We came on the raft, from far. Is it all right if we stay?',
    'fk.tuko.meet': 'Ollo! I am Tuko! Your island has SO many trees. Ours had none. Only pebbles.',
    'fk.wenna.meet': 'Ollo, friend. I am Wenna. I came on the second raft. My sister\'s hat told me the way.',
    'fk.bow': '{name} bows, and the little bell on the hat rings: ding!',
    'fk.teach': 'In our words, "{word}" means {mean}. {word}!',
    'fk.hello': 'Ollo, ollo. A good day to you.', 'fk.more': 'Greet me our way, and I teach you more words.',
    'fk.enough': 'Two new words a day is plenty. Bimbom: see you soon!',
    'fk.custom.hats': 'Our hats have a bell. When we bow, the bell says hello for us.',
    'fk.custom.pebbles': 'When we like someone, we leave a painted pebble on their doorstep. Look at your door some day!',
    'fk.custom.hum': 'At sunset we hum together. It tells the sea we are happy.',
    'fk.custom.pebbleday': 'On Pebble Day everyone paints a pebble with a wish. All the pebbles make a tower. It comes on the fifth Saturday of a month!',
    'fk.wave': '{name} rings the hat bell at you. Ding!',
    'fk.paint.ask': 'Pebble Day! Which colour is your pebble?', 'fk.paint.red': 'Red', 'fk.paint.blue': 'Blue', 'fk.paint.yellow': 'Yellow', 'fk.paint.green': 'Green',
    'fk.paint.done': 'Your pebble is on the tower! Its wish is a secret. Pompom!', 'fk.paint.again': 'Your pebble is already on the tower today. Pompom!',
    'fk.paint.first': 'For your first Pebble Day: a little pebble tower of your own.',
    'fk.t.word': 'New word: {word} ({mean}). It is in your word book.',
    'fk.book': 'Ollish words', 'fk.book.n': '{n} of {m} words', 'fk.book.none': 'Talk to the Ollo folk to learn their words.',
    'fk.book.tip': 'Greet them their way ("Ollo!") to learn more. Two new words a day at most.',
    'fk.book.say': 'Ollish words. {n} of {m}.',
    'fk.task': '🪨 Say hello to the Ollo folk (the north-east corner)',
    'fk.w.ollo': 'hello', 'fk.w.bimbom': 'see you soon', 'fk.w.fliffi': 'thank you', 'fk.w.zibbo': 'friend', 'fk.w.tanu': 'sun', 'fk.w.pom': 'pebble',
    'fk.w.nunu': 'tea', 'fk.w.wawa': 'the sea', 'fk.w.pipri': 'bird', 'fk.w.mimola': 'flower', 'fk.w.dumdi': 'home', 'fk.w.yaya': 'yes', 'fk.w.nono': 'no',
    'fk.w.hoppa': 'jump', 'fk.w.zizzi': 'star', 'fk.w.pompom': 'Pebble Day',
  },
  no: {
    'od.npc.bimsa': 'Eldste Bimsa', 'od.npc.tuko': 'Tuko', 'od.npc.wenna': 'Wenna',
    'fk.folk': 'Ollo-folket', 'map.a.folk': 'Hjørnet til Ollo-folket', 'isl.fest.pebble': 'Steindagen', 'map.a.pebble': 'Steindagen',
    'isl.mail.od.folk': 'Kjære {name}, en flåte gikk i land på nordøststranda i morges! Tre reisende fra et rev langt borte vil gjerne bli, under klippene. De er sjenerte i begynnelsen. De sier «ollo» for hei. La oss ta godt imot dem! Kurator Hu',
    'od.td.folk': 'En flåte gikk i land på nordøststranda. Reisende med høye strikkeluer!',
    'fk.td.s1': 'Ollo-folket har bygget sitt første runde hus under nordøstklippene. En tredje reisende kom!',
    'fk.td.s2': 'Et hus til, og en sirkel av malte steiner: Ollo-folket har slått seg ned.',
    'fk.td.s3': 'Trommestokker og et tredje hus i hjørnet til Ollo-folket. Nå er det en liten landsby!',
    'td.fest.pebble.1': 'Steindagen! Ollo-folket maler steiner med ønsker og bygger et tårn.',
    'td.fest.pebble.2': 'Trommer i nordøsthjørnet: det er Steindagen til Ollo-folket!',
    'td.fest.pebble.3': 'Ollo-folket inviterer alle til Steindagen. Ta med et ønske!',
    'fk.h.talk': '[B] snakk med {name}', 'fk.h.paint': '[B] mal en stein til tårnet',
    'fk.greet.ask': '(Hvordan sier du hei?)', 'fk.greet.ollo': 'Si: «Ollo!»', 'fk.greet.hello': 'Si: «Hei!»',
    'fk.bimsa.meet': 'Ollo, lille venn. Jeg heter Bimsa. Vi kom på flåten, langveisfra. Er det greit at vi blir?',
    'fk.tuko.meet': 'Ollo! Jeg heter Tuko! Øya di har SÅ mange trær. Vår hadde ingen. Bare steiner.',
    'fk.wenna.meet': 'Ollo, venn. Jeg heter Wenna. Jeg kom med den andre flåten. Lua til søsteren min viste meg veien.',
    'fk.bow': '{name} bukker, og den lille bjella på lua ringer: ding!',
    'fk.teach': 'På vårt språk betyr «{word}» {mean}. {word}!',
    'fk.hello': 'Ollo, ollo. En god dag til deg.', 'fk.more': 'Hils på meg på vår måte, så lærer jeg deg flere ord.',
    'fk.enough': 'To nye ord om dagen er nok. Bimbom: vi ses snart!',
    'fk.custom.hats': 'Luene våre har en bjelle. Når vi bukker, sier bjella hei for oss.',
    'fk.custom.pebbles': 'Når vi liker noen, legger vi en malt stein på dørterskelen deres. Se på døra di en dag!',
    'fk.custom.hum': 'Når sola går ned, nynner vi sammen. Det forteller havet at vi er glade.',
    'fk.custom.pebbleday': 'På Steindagen maler alle en stein med et ønske. Alle steinene blir et tårn. Den kommer den femte lørdagen i en måned!',
    'fk.wave': '{name} ringer med luebjella til deg. Ding!',
    'fk.paint.ask': 'Steindagen! Hvilken farge skal steinen din ha?', 'fk.paint.red': 'Rød', 'fk.paint.blue': 'Blå', 'fk.paint.yellow': 'Gul', 'fk.paint.green': 'Grønn',
    'fk.paint.done': 'Steinen din ligger på tårnet! Ønsket er en hemmelighet. Pompom!', 'fk.paint.again': 'Steinen din ligger allerede på tårnet i dag. Pompom!',
    'fk.paint.first': 'For din første Steindag: et lite steintårn helt for deg selv.',
    'fk.t.word': 'Nytt ord: {word} ({mean}). Det står i ordboka di.',
    'fk.book': 'Ollisk-ord', 'fk.book.n': '{n} av {m} ord', 'fk.book.none': 'Snakk med Ollo-folket for å lære ordene deres.',
    'fk.book.tip': 'Hils på dem på deres måte («Ollo!») for å lære flere. Høyst to nye ord om dagen.',
    'fk.book.say': 'Ollisk-ord. {n} av {m}.',
    'fk.task': '🪨 Si hei til Ollo-folket (nordøsthjørnet)',
    'fk.w.ollo': 'hei', 'fk.w.bimbom': 'vi ses snart', 'fk.w.fliffi': 'takk', 'fk.w.zibbo': 'venn', 'fk.w.tanu': 'sol', 'fk.w.pom': 'stein',
    'fk.w.nunu': 'te', 'fk.w.wawa': 'havet', 'fk.w.pipri': 'fugl', 'fk.w.mimola': 'blomst', 'fk.w.dumdi': 'hjem', 'fk.w.yaya': 'ja', 'fk.w.nono': 'nei',
    'fk.w.hoppa': 'hopp', 'fk.w.zizzi': 'stjerne', 'fk.w.pompom': 'Steindagen',
  },
});

/** The folk's stage on a day (0 tent, 1 a house, 2 settled, 3 a little village), or -1 before they came. */
export function folkStage(S, di) {
  const a = S?.odd?.got?.folk;
  if (a === undefined || di < a) return -1;
  return STAGE_DAYS.filter((d) => di - a >= d).length - 1;
}

/** Is it Pebble Day on this island (settled, a fifth Saturday that is otherwise quiet)? */
export function pebbleDayOn(S, ms) {
  return folkStage(S, dayIndex(ms)) >= 2 && pebbleDayNative(ms) && !surpriseOn(ms) && !rareEventOn(ms);
}

export class Folk {
  constructor(host, odd) {
    this.host = host;
    this.odd = odd;
    setExtraFestival((ms) => (pebbleDayOn(host.save, ms) ? 'pebble' : null));
    const map = host.map;
    this.group = new THREE.Group();
    host.scene.add(this.group);
    this.tent = makeTent();
    this.tent.position.set(FOLK.x, heightAt(FOLK.x, FOLK.z), FOLK.z);
    this.raft = makeRaft();
    this.raft.position.set(FOLK.raft.x, Math.max(heightAt(FOLK.raft.x, FOLK.raft.z), -0.4), FOLK.raft.z);
    this.raft.rotation.y = 0.6;
    this.houses = HOUSES.map((h, i) => { const g = makeRoundHouse(i); g.position.set(h.x, heightAt(h.x, h.z), h.z); g.rotation.y = Math.atan2(FOLK.x - h.x, FOLK.z + 2 - h.z); this.group.add(g); return { ...h, g, obs: map.circObs(1e5, h.z, h.r) }; });
    this.tentObs = map.circObs(1e5, FOLK.z, 0.9);
    this.circle = makePebbleCircle();
    this.circle.position.set(TOWER.x, heightAt(TOWER.x, TOWER.z), TOWER.z);
    this.drums = makeDrumLogs();
    this.drums.position.set(FOLK.x + 2.6, heightAt(FOLK.x + 2.6, FOLK.z + 2.4), FOLK.z + 2.4);
    this.drumObs = map.circObs(1e5, FOLK.z + 2.4, 0.6);
    this.tower = new THREE.Group();
    this.tower.position.set(TOWER.x, heightAt(TOWER.x, TOWER.z), TOWER.z);
    this.group.add(this.tent, this.raft, this.circle, this.drums, this.tower);
    this.towerObs = map.circObs(1e5, TOWER.z, 0.5);
    map.addKeepOut(FOLK.x, FOLK.z, 6, 'the Ollo folk');
    this.members = MEMBERS.map((m) => ({ ...m, g: new Guest(host, { id: m.id, color: m.color, hat: makeGuestHat(m.hat), css: '#3a9a5a', nameKey: `od.npc.${m.id}` }) }));
    this.stage = -2;
    this.t = 0;
  }

  get S() { return this.host.save; }
  get F() {
    const O = this.odd.O;
    if (!O.folk || typeof O.folk !== 'object') O.folk = {};
    const F = O.folk;
    F.words ||= []; F.met ||= {}; F.customs ||= []; F.wordDay ||= { day: '', n: 0 }; F.pebble ||= { day: '' };
    return F;
  }
  get here() { return arrived(this.S, 'folk'); }

  /** Pebble Day today? */
  get fest() { return pebbleDayOn(this.S, now()); }

  // ---------- the days ----------

  todayNews(at) {
    const di = dayIndex(at), a = this.S.odd?.got?.folk;
    if (a === undefined) return [];
    const k = STAGE_DAYS.indexOf(di - a);
    return k > 0 ? [{ kind: 'changed', pri: 7.3, icon: '🛖', keys: [`fk.td.s${k}`], x: FOLK.x, z: FOLK.z }] : [];
  }

  tick() {
    const host = this.host, di = dayIndex(), st = folkStage(this.S, di), main = !host.isle2?.here(), h = hourOf();
    this.group.visible = main && st >= 0;
    this.tent.visible = st === 0;
    this.tentObs.x = main && st === 0 ? FOLK.x : 1e5;
    this.raft.visible = st >= 0 && st < 2;
    this.houses.forEach((H, i) => { const on = main && st >= i + 1; H.g.visible = on; H.obs.x = on ? H.x : 1e5; });
    this.circle.visible = st >= 2;
    this.drums.visible = st >= 3;
    this.drumObs.x = main && st >= 3 ? FOLK.x + 2.6 : 1e5;
    const fest = this.fest;
    this.tower.visible = st >= 2;
    this.towerObs.x = main && st >= 2 ? TOWER.x : 1e5;
    if (st !== this.stage || fest !== this.wasFest) { this.stage = st; this.wasFest = fest; this.buildTower(); }
    // the folk are about from 8 to 20 (and on Pebble Day until 21); asleep in their houses at night
    const up = h >= 8 && h < (fest ? 21 : 20);
    for (const m of this.members) m.g.place(m.spot.x, m.spot.z, main && st >= 0 && up && di - this.S.odd.got.folk >= m.from, { x: FOLK.x - m.spot.x, z: FOLK.z - m.spot.z });
  }

  /** The pebble tower: a few pebbles once they settled, a tall one on Pebble Day (with yours on it). */
  buildTower() {
    this.tower.clear();
    const F = this.F, fest = this.fest, n = fest ? 7 + (F.pebble.day === dayKey() ? 1 : 0) : 3;
    for (let i = 0; i < n; i++) {
      const col = i === n - 1 && fest && F.pebble.day === dayKey() ? (COLORS.find((c) => c[0] === F.pebble.color)?.[1] ?? 0xffffff) : [0xff9f40, 0x4cc9f0, 0xff7eb6, 0xffd23f, 0x3ddc97, 0xc9a8ff, 0xffffff][i % 7];
      const p = mesh(sph(0.3 - i * 0.022, 10, 8), col, Math.sin(i * 2.1) * 0.05, 0.18 + i * 0.27, 0);
      p.scale.set(1, 0.6, 1);
      this.tower.add(p);
    }
    if (fest) for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; this.tower.add(mesh(cyl(0.03, 0.03, 1.6, 5), 0xffffff, Math.cos(a) * 1.6, 0.8, Math.sin(a) * 1.6), mesh(sph(0.12, 8, 6), [0xff5d73, 0xffd23f, 0x4cc9f0][i % 3], Math.cos(a) * 1.6, 1.65, Math.sin(a) * 1.6, false)); }
  }

  // ---------- talking and words ----------

  interactions(P, out, nm) {
    for (const m of this.members) {
      if (!m.g.near(P, 1.9)) continue;
      const paint = this.fest && m.id === 'bimsa';
      out.b = { text: paint ? nm('fk.h.paint') : nm('fk.h.talk', { name: m.g.name }), fn: () => (paint ? this.paintAsk(m) : this.talkTo(m)) };
      return true;
    }
    return false;
  }

  /** The next word they can teach now (or null): the free ones by plain talk; the rest only after "Ollo!". */
  nextWord(greeted) {
    const F = this.F, day = dayKey();
    if (F.wordDay.day === day && F.wordDay.n >= WORDS_A_DAY) return null;
    const w = WORDS.find((x) => !F.words.includes(x));
    if (!w) return null;
    return WORDS.indexOf(w) < FREE_WORDS || greeted ? w : null;
  }

  learn(w) {
    const F = this.F, day = dayKey();
    if (F.wordDay.day !== day) F.wordDay = { day, n: 0 };
    F.wordDay.n++;
    F.words.push(w);
    this.host.game.ui.toast(t('fk.t.word', { word: w, mean: t(`fk.w.${w}`) }), 2800);
    this.host.markDirty();
  }

  talkTo(m) {
    const host = this.host, F = this.F, g = m.g, P = host.player;
    g.faceTo(P);
    P.ch.face(g.x - P.x, g.z - P.z);
    if (!F.met[m.id]) {
      F.met[m.id] = true;
      host.say([g.line(`fk.${m.id}.meet`)], () => this.afterGreet(m, false));
      host.markDirty();
      return;
    }
    if (F.words.includes('ollo')) {
      host.say([{ name: host.playerName, css: '#2b2340', key: 'fk.greet.ask', choices: ['fk.greet.ollo', 'fk.greet.hello'], onChoice: (i) => this.afterGreet(m, i === 0) }]);
      return;
    }
    this.afterGreet(m, false);
  }

  /** After the hello: a bow for "Ollo!", then a word, a custom, or a wave (nothing said twice). */
  afterGreet(m, ollo) {
    const host = this.host, F = this.F, g = m.g, lines = [];
    if (ollo) { lines.push({ name: g.name, css: g.css, key: 'fk.bow', vars: { name: g.name }, fx: () => this.bell(g) }); g.hop = 1; }
    const w = this.nextWord(ollo);
    if (w) lines.push(g.line('fk.teach', { word: w, mean: t(`fk.w.${w}`) }, { fx: () => this.learn(w) }));
    else {
      const c = CUSTOMS.find((k) => !F.customs.includes(k) && (k !== 'pebbleday' || this.stage >= 2));
      if (c && (ollo || F.words.length >= FREE_WORDS)) { F.customs.push(c); lines.push(g.line(`fk.custom.${c}`)); }
      else if (!ollo && F.words.length >= FREE_WORDS && WORDS.some((x) => !F.words.includes(x)) && F.hint !== dayKey()) { F.hint = dayKey(); lines.push(g.line('fk.more')); }
      else if (F.wordDay.day === dayKey() && F.wordDay.n >= WORDS_A_DAY && F.enough !== dayKey()) { F.enough = dayKey(); lines.push(g.line('fk.enough')); }
    }
    if (!lines.length) { g.hop = 1; this.bell(g); host.game.ui.toast(t('fk.wave', { name: g.name }), 1800); host.markDirty(); return; }
    host.say(lines, () => host.markDirty());
  }

  bell(g) {
    const A = this.host.game.audio;
    if (A.ctx && !A.muted) { A.tone(1568, 0.5, { type: 'sine', vol: 0.06 }); A.tone(2093, 0.4, { type: 'sine', vol: 0.03, delay: 0.05 }); }
  }

  // ---------- Pebble Day ----------

  paintAsk(m) {
    const host = this.host, F = this.F, day = dayKey(), g = m.g;
    if (F.pebble.day === day) { host.say([g.line('fk.paint.again')]); return; }
    host.say([g.line('fk.paint.ask', null, { choices: COLORS.map(([c]) => `fk.paint.${c}`), onChoice: (i) => {
      F.pebble = { day, color: COLORS[i][0] };
      this.buildTower();
      host.confetti?.burst(new THREE.Vector3(TOWER.x, heightAt(TOWER.x, TOWER.z) + 2.4, TOWER.z), 0, { count: 40, speed: 5, up: 4, life: 1.3, gravity: -6, colors: [0xff5d73, 0x4cc9f0, 0xffd23f, 0x3ddc97] });
      host.game.audio.play('fanfare');
      const lines = [g.line('fk.paint.done')];
      if (!F.painted) { F.painted = true; lines.push(g.line('fk.paint.first')); host.grant({ deco: 'pebbleTower', coins: 40 }); }
      host.say(lines);
      host.markDirty();
    } })]);
  }

  // ---------- the word book (the Friends book's last page: friends.js) ----------

  bookOn() { return this.here; }

  bookHtml(read = false) {
    const F = this.F, known = WORDS.filter((w) => F.words.includes(w));
    const rows = known.map((w) => `<div><b>${esc(w)}</b> <small>${esc(t(`fk.w.${w}`))}</small></div>`).join('');
    if (read) speak([t('fk.book.say', { n: known.length, m: WORDS.length }), ...known.map((w) => `${w}: ${t(`fk.w.${w}`)}`)].join('. '), 'narrator');
    return `<div class="nm" style="text-align:center;font-weight:700;color:#8a5a32;margin-bottom:6px">🪨 ${esc(t('fk.book'))} · ${esc(t('fk.book.n', { n: known.length, m: WORDS.length }))}</div>
      ${known.length ? `<div class="isl-fbanimals">${rows}</div>` : `<p style="text-align:center">${esc(t('fk.book.none'))}</p>`}<div class="isl-foot" style="opacity:1">${esc(t('fk.book.tip'))}</div>`;
  }

  // ---------- the rest ----------

  tasks() { return this.here && folkStage(this.S, dayIndex()) >= 0 && !Object.keys(this.F.met).length ? [t('fk.task')] : []; }

  markers() {
    if (!this.here) return [];
    return [{ key: 'odd:folk', kind: 'place', icon: '🛖', name: t('map.a.folk'), x: FOLK.x, z: FOLK.z, tx: FOLK.x, tz: FOLK.z + 2.6 }];
  }

  update(dt) {
    this.t += dt;
    for (const m of this.members) m.g.update(dt);
    if (this.fest && this.drums.visible && (this.drumT = (this.drumT || 0) - dt) <= 0) {
      this.drumT = 0.6;
      const P = this.host.player, A = this.host.game.audio;
      if (P && Math.hypot(P.x - FOLK.x, P.z - FOLK.z) < 14 && A.ctx && !A.muted) A.tone(110, 0.15, { type: 'sine', vol: 0.08 });
    }
  }

  dispose() { setExtraFestival(null); for (const m of this.members) m.g.dispose(); }
}

// ---------- models ----------

function makeRoundHouse(i) {
  const g = new THREE.Group();
  const wall = [0xd9b98a, 0xc9a87a, 0xe0c79a][i % 3];
  g.add(mesh(cyl(1.15, 1.25, 1.5, 14), wall, 0, 0.75, 0));
  const roof = mesh(sph(1.45, 14, 8), 0x6aa83a, 0, 1.4, 0);
  roof.scale.set(1, 0.6, 1);
  g.add(roof, mesh(sph(0.12, 8, 6), 0xffd23f, 0, 2.3, 0));
  g.add(mesh(cyl(0.38, 0.38, 0.08, 14), 0x7a4a2e, 0, 0.55, 1.18));
  g.children[g.children.length - 1].rotation.x = Math.PI / 2;
  for (let k = 0; k < 5; k++) { const a = -0.7 + k * 0.35; const p = mesh(sph(0.1, 8, 6), [0xff9f40, 0x4cc9f0, 0xff7eb6, 0xffd23f, 0x3ddc97][k], Math.sin(a) * 1.45, 0.06, Math.cos(a) * 1.45, false); p.scale.set(1, 0.6, 1); g.add(p); }
  return g;
}

function makeTent() {
  const g = new THREE.Group();
  g.add(mesh(cone(1.0, 1.5, 6), 0xffc89a, 0, 0.75, 0), mesh(cyl(0.03, 0.03, 0.5, 5), 0x8a5a32, 0, 1.6, 0), mesh(box(0.35, 0.22, 0.02), 0xff5d73, 0.18, 1.75, 0));
  return g;
}

function makeRaft() {
  const g = new THREE.Group();
  for (let i = 0; i < 5; i++) { const l = mesh(cyl(0.15, 0.15, 2.4, 8), 0xa0683a, -0.6 + i * 0.3, 0.1, 0); l.rotation.x = Math.PI / 2; g.add(l); }
  g.add(mesh(cyl(0.04, 0.04, 1.6, 5), 0x8a5a32, 0, 0.9, 0), mesh(box(0.05, 0.9, 1.0), 0xfff6e0, 0.05, 1.1, 0.1));
  return g;
}

function makePebbleCircle() {
  const g = new THREE.Group();
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; const p = mesh(sph(0.14, 8, 6), [0xff9f40, 0x4cc9f0, 0xff7eb6, 0xffd23f, 0x3ddc97, 0xffffff][i % 6], Math.cos(a) * 1.2, 0.06, Math.sin(a) * 1.2, false); p.scale.set(1, 0.5, 1); g.add(p); }
  return g;
}

function makeDrumLogs() {
  const g = new THREE.Group();
  for (const [x, z, h] of [[-0.4, 0, 0.6], [0.3, 0.2, 0.45], [0.05, -0.4, 0.5]]) g.add(mesh(cyl(0.25, 0.27, h, 10), 0x8a5a32, x, h / 2, z), mesh(cyl(0.24, 0.24, 0.03, 10), 0xf3ead2, x, h + 0.01, z));
  return g;
}

export { tFor, makeDeco11 };
