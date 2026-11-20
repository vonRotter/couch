import * as THREE from 'three';
import { t, tFor, addStrings } from '../../core/i18n.js';
import { esc } from '../../core/ui.js';
import { say as speak } from '../../core/voice.js';
import { now, hourOf, give } from './save.js';
import { dayKey, dayIndex, dayMs, dayRand, festivalOn, surpriseOn, rareEventOn, seasonOf, birthdayOf, BIRTHDAYS } from './calendar.js';
import { heightAt } from './map.js';
import { SURPRISE_HOURS } from './surprise.js';
import { mesh, box, sph, cyl, cone } from './models.js';

// The Today board and tomorrow hooks (the "livelier island" round, part 1).
//
// Today board: the first visit of a real day (per profile) opens a card with up to three things that are new
// today: a rumor (something coming), a visitor and something that changed. Everything comes from what really
// happens (the calendar, the day's surprise, rare events, the villagers' dramas and projects, the hooks below,
// letters), so there is no filler: a quiet day shows fewer. The same text never comes back within three weeks
// (S.todayHist keeps what was shown; a thing that happens again picks another wording or is left out). It is
// deterministic by date for the same save. The journal's Tasks tab shows it again (with tomorrow's line), and
// the map marks the ones that have a place.
//
// Tomorrow hooks, one at a time (S.hook): a speckled egg by your door that hatches tomorrow, a mystery pot that
// opens the day after tomorrow, or a letter from Marlo or Skye saying which day they come. The menu and the
// evening in the cottage say what tomorrow brings (tomorrowLine).

export const HIST_DAYS = 21;
const HOOK_GAP = 2; // days between one hook ending and the next
const KIND_ICON = { rumor: '💬', visitor: '👋', changed: '✨' };

addStrings({
  en: {
    'td.title': 'Today on the island', 'td.hint': '[OK]: off we go!',
    'td.kind.rumor': 'Rumor', 'td.kind.visitor': 'Visitor', 'td.kind.changed': 'Something new',
    'td.journal': 'Today', 'td.tomorrow': 'Tomorrow: {text}', 'td.quiet': 'A quiet day: nothing new yet.',
    'td.wd.0': 'Sunday', 'td.wd.1': 'Monday', 'td.wd.2': 'Tuesday', 'td.wd.3': 'Wednesday', 'td.wd.4': 'Thursday', 'td.wd.5': 'Friday', 'td.wd.6': 'Saturday',
    // festivals
    'td.fest.derby.1': 'The Fishing Derby is on at the pier: Grumbleton has his megaphone out!',
    'td.fest.derby.2': 'Derby day! Rods and buckets all along the pier.',
    'td.fest.derby.3': 'Grumbleton painted a new Derby banner. The biggest catch wins!',
    'td.fest.plant.1': 'The Spring Planting Fair is in the square: Rosa has seed stalls out.',
    'td.fest.plant.2': 'Flower pots everywhere: it is the Planting Fair!',
    'td.fest.plant.3': 'Rosa tied ribbons on the fountain for the Planting Fair.',
    'td.fest.beach.1': 'Beach Day! Pip set out towels and a sand bucket on the beach.',
    'td.fest.beach.2': 'The sun is out for the Summer Beach Day: shells to find on the sand.',
    'td.fest.beach.3': 'Parasols on the beach: the Summer Beach Day is here.',
    'td.fest.fair.1': 'The Harvest Fair is in the square: Aunt Hazel is judging the crops.',
    'td.fest.fair.2': 'Pumpkins and ribbons in the square: Harvest Fair today!',
    'td.fest.fair.3': 'Hay bales by the fountain: the Harvest Fair has started.',
    'td.fest.lanterns.1': 'Lantern Night: lanterns hang all the way to the lighthouse.',
    'td.fest.lanterns.2': 'Keeper Bram polished every lantern for Lantern Night.',
    'td.fest.lanterns.3': 'Tonight the island glows: it is Lantern Night!',
    // the daily surprises
    'td.sur.merchant.1': 'Marlo the merchant set up his cart by the square. Today: {list}.',
    'td.sur.merchant.2': 'Marlo\'s cart jingled into town with {list}.',
    'td.sur.merchant.3': 'Odd things for sale by the square: {list}. Marlo says hello!',
    'td.sur.merchant.letter': 'Marlo came, just as his letter said! He brought {list}.',
    'td.sur.balloon.1': 'A hot-air balloon is coming down on the meadow by the square!',
    'td.sur.balloon.2': 'Skye the explorer is flying in today. Look up!',
    'td.sur.balloon.3': 'Rosa saw a red balloon far out over the sea. Someone is coming!',
    'td.sur.balloon.letter': 'Skye\'s balloon is here, just as her letter said!',
    'td.sur.bottle.1': 'A bottle washed up on the beach. Is there a note inside?',
    'td.sur.bottle.2': 'Something glints in the sand on the beach: a bottle!',
    'td.sur.bottle.3': 'Grumbleton saw a bottle bobbing to the shore this morning.',
    'td.sur.meteor.1': 'Hoot says stars will fall tonight. Catch the star bits!',
    'td.sur.meteor.2': 'A meteor shower tonight! Stay up and look at the sky.',
    'td.sur.meteor.3': 'Pip says tonight is perfect for shooting stars.',
    // the calendar
    'td.season.spring': 'Spring is here: blossoms on the trees and new seeds at Rosa\'s.',
    'td.season.summer': 'Summer is here: warm sand and long days.',
    'td.season.autumn': 'Autumn is here: the leaves are turning gold.',
    'td.season.winter': 'Winter is here: snow on the hills!',
    'td.bday.1': 'It is {name}\'s birthday! A gift would make the day.',
    'td.bday.2': 'Party hats out: {name} has a birthday today.',
    'td.r.bday': 'Psst: tomorrow is {name}\'s birthday.',
    'td.r.fest': 'Tomorrow: {name}. Everyone is getting ready.',
    'td.r.merchant': 'Rosa heard cart bells far away: Marlo comes tomorrow.',
    'td.r.balloon': 'Pip saw a balloon on her telescope: a visitor tomorrow?',
    'td.mail.1': 'The mailbox flag is up: a letter from {name}.',
    'td.mail.2': '{name} wrote you a letter. It is in the mailbox.',
    // hooks
    'td.hook.egg': 'The speckled egg by your door is wobbling!',
    'td.hook.pot': 'The mystery pot by your door has opened!',
    'td.hook.egg.new': 'Aunt Hazel left a speckled egg in a basket by your door.',
    'td.hook.pot.new': 'Someone left a little pot with a mystery seed by your door.',
    'tm.egg.tomorrow': 'the speckled egg hatches!', 'tm.egg.now': 'the speckled egg is hatching now. Go and see!',
    'tm.pot.tomorrow': 'the mystery pot opens!', 'tm.pot.later': 'the mystery pot opens on {day}.', 'tm.pot.now': 'the mystery pot has opened. Go and see!',
    'tm.letter.merchant': 'Marlo comes on {day}, says his letter.', 'tm.letter.balloon': 'Skye\'s balloon lands on {day}, says her letter.',
    'tm.letter.merchant.tomorrow': 'Marlo the merchant comes, says his letter!', 'tm.letter.balloon.tomorrow': 'Skye\'s balloon lands, says her letter!',
    'tm.fest': '{name}!', 'tm.bday': 'it is {name}\'s birthday.',
    'td.h.egg': '[B]: look at the egg', 'td.h.pot': '[B]: look at the pot',
    'td.egg.wait': 'The egg is warm. It hatches tomorrow!', 'td.pot.wait': 'A tiny green tip peeks out. It opens on {day}.',
    'td.egg.chick': 'Crack! A fluffy chick! She runs off to the barn to meet the hens.',
    'td.egg.duck': 'Crack! A little duckling! It waddles off to the river and leaves you a shiny shell.',
    'td.pot.open': 'The pot opened into a {flower}! You picked a bunch.',
    'td.flower.0': 'moonbell', 'td.flower.1': 'sunburst daisy', 'td.flower.2': 'star lily',
    'isl.mail.td.merchant': 'Hello {name}! My cart and I will roll into town on {day}, with odd things you will not find anywhere else. Save a few coins! Your friend, Marlo',
    'isl.mail.td.balloon': 'Dear {name}, the winds say I can land on your island on {day}. Look for my red balloon! Skye',
    'isl.from.merchant': 'Marlo the merchant', 'isl.from.skye': 'Skye the explorer',
    'map.a.hookEgg': 'The speckled egg', 'map.a.hookPot': 'The mystery pot',
  },
  no: {
    'td.title': 'I dag på øya', 'td.hint': '[OK]: av sted!',
    'td.kind.rumor': 'Rykte', 'td.kind.visitor': 'Besøk', 'td.kind.changed': 'Noe nytt',
    'td.journal': 'I dag', 'td.tomorrow': 'I morgen: {text}', 'td.quiet': 'En rolig dag: ikke noe nytt ennå.',
    'td.wd.0': 'søndag', 'td.wd.1': 'mandag', 'td.wd.2': 'tirsdag', 'td.wd.3': 'onsdag', 'td.wd.4': 'torsdag', 'td.wd.5': 'fredag', 'td.wd.6': 'lørdag',
    'td.fest.derby.1': 'Fiskederbyet er i gang på brygga: Grumbleton har tatt fram megafonen!',
    'td.fest.derby.2': 'Konkurransedag! Fiskestenger og bøtter langs hele brygga.',
    'td.fest.derby.3': 'Grumbleton har malt et nytt banner. Den største fangsten vinner!',
    'td.fest.plant.1': 'Vårens plantemarked er på torget: Rosa har frøboder ute.',
    'td.fest.plant.2': 'Blomsterpotter overalt: det er plantemarked!',
    'td.fest.plant.3': 'Rosa har knyttet sløyfer på fontenen til plantemarkedet.',
    'td.fest.beach.1': 'Stranddag! Pip har lagt ut håndklær og en sandbøtte på stranda.',
    'td.fest.beach.2': 'Sola skinner på sommerens stranddag: skjell å finne i sanden.',
    'td.fest.beach.3': 'Parasoller på stranda: sommerens stranddag er her.',
    'td.fest.fair.1': 'Høstmarkedet er på torget: tante Hassel dømmer avlingene.',
    'td.fest.fair.2': 'Gresskar og sløyfer på torget: høstmarked i dag!',
    'td.fest.fair.3': 'Høyballer ved fontenen: høstmarkedet har begynt.',
    'td.fest.lanterns.1': 'Lyktekveld: lykter henger helt bort til fyret.',
    'td.fest.lanterns.2': 'Fyrvokter Bram har pusset hver eneste lykt til lyktekvelden.',
    'td.fest.lanterns.3': 'I kveld lyser hele øya: det er lyktekveld!',
    'td.sur.merchant.1': 'Kremmeren Marlo har satt opp vogna si ved torget. I dag: {list}.',
    'td.sur.merchant.2': 'Vogna til Marlo klirret inn i byen med {list}.',
    'td.sur.merchant.3': 'Rare ting til salgs ved torget: {list}. Marlo sier hei!',
    'td.sur.merchant.letter': 'Marlo kom, akkurat som brevet sa! Han har med {list}.',
    'td.sur.balloon.1': 'En luftballong er på vei ned på enga ved torget!',
    'td.sur.balloon.2': 'Oppdageren Skye flyr inn i dag. Se opp!',
    'td.sur.balloon.3': 'Rosa så en rød ballong langt ute over havet. Noen kommer!',
    'td.sur.balloon.letter': 'Ballongen til Skye er her, akkurat som brevet sa!',
    'td.sur.bottle.1': 'En flaske har drevet i land på stranda. Er det en lapp inni?',
    'td.sur.bottle.2': 'Noe glitrer i sanden på stranda: en flaske!',
    'td.sur.bottle.3': 'Grumbleton så en flaske guppe inn mot land i morges.',
    'td.sur.meteor.1': 'Hu sier at stjerner faller i natt. Fang stjernebitene!',
    'td.sur.meteor.2': 'Stjerneskudd i natt! Hold deg våken og se på himmelen.',
    'td.sur.meteor.3': 'Pip sier at i natt er perfekt for stjerneskudd.',
    'td.season.spring': 'Våren er her: blomster på trærne og nye frø hos Rosa.',
    'td.season.summer': 'Sommeren er her: varm sand og lange dager.',
    'td.season.autumn': 'Høsten er her: bladene blir gylne.',
    'td.season.winter': 'Vinteren er her: snø på åsene!',
    'td.bday.1': 'Det er bursdagen til {name}! En gave hadde gjort dagen.',
    'td.bday.2': 'Fram med festhattene: {name} har bursdag i dag.',
    'td.r.bday': 'Psst: i morgen har {name} bursdag.',
    'td.r.fest': 'I morgen: {name}. Alle gjør seg klare.',
    'td.r.merchant': 'Rosa hørte vognbjeller langt borte: Marlo kommer i morgen.',
    'td.r.balloon': 'Pip så en ballong i teleskopet sitt: besøk i morgen?',
    'td.mail.1': 'Flagget på postkassa er oppe: et brev fra {name}.',
    'td.mail.2': '{name} har skrevet et brev til deg. Det ligger i postkassa.',
    'td.hook.egg': 'Det prikkete egget ved døra di vagler!',
    'td.hook.pot': 'Den mystiske potta ved døra di har åpnet seg!',
    'td.hook.egg.new': 'Tante Hassel har lagt et prikkete egg i en kurv ved døra di.',
    'td.hook.pot.new': 'Noen har satt en liten potte med et mysteriefrø ved døra di.',
    'tm.egg.tomorrow': 'det prikkete egget klekkes!', 'tm.egg.now': 'det prikkete egget klekkes nå. Gå og se!',
    'tm.pot.tomorrow': 'den mystiske potta åpner seg!', 'tm.pot.later': 'den mystiske potta åpner seg på {day}.', 'tm.pot.now': 'den mystiske potta har åpnet seg. Gå og se!',
    'tm.letter.merchant': 'Marlo kommer på {day}, står det i brevet.', 'tm.letter.balloon': 'Ballongen til Skye lander på {day}, står det i brevet.',
    'tm.letter.merchant.tomorrow': 'kremmeren Marlo kommer, står det i brevet!', 'tm.letter.balloon.tomorrow': 'ballongen til Skye lander, står det i brevet!',
    'tm.fest': '{name}!', 'tm.bday': 'det er bursdagen til {name}.',
    'td.h.egg': '[B]: se på egget', 'td.h.pot': '[B]: se på potta',
    'td.egg.wait': 'Egget er varmt. Det klekkes i morgen!', 'td.pot.wait': 'En liten grønn spiss titter fram. Den åpner seg på {day}.',
    'td.egg.chick': 'Knekk! En dunete kylling! Hun løper til låven for å hilse på hønene.',
    'td.egg.duck': 'Knekk! En liten andunge! Den vagger ned til elva og gir deg et skinnende skjell.',
    'td.pot.open': 'Potta åpnet seg til en {flower}! Du plukket en bukett.',
    'td.flower.0': 'måneklokke', 'td.flower.1': 'solstråle-tusenfryd', 'td.flower.2': 'stjernelilje',
    'isl.mail.td.merchant': 'Hei {name}! Vogna mi og jeg ruller inn i byen på {day}, med rare ting du ikke finner noe annet sted. Spar på noen mynter! Din venn Marlo',
    'isl.mail.td.balloon': 'Kjære {name}, vindene sier at jeg kan lande på øya di på {day}. Se etter den røde ballongen min! Skye',
    'isl.from.merchant': 'kremmeren Marlo', 'isl.from.skye': 'oppdageren Skye',
    'map.a.hookEgg': 'Det prikkete egget', 'map.a.hookPot': 'Den mystiske potta',
  },
});

/** Resolve vars: '@key' becomes t(key), an array becomes a list. */
export function rv(vars) {
  if (!vars) return vars;
  const out = {};
  for (const [k, v] of Object.entries(vars)) {
    const one = (x) => (typeof x === 'string' && x.startsWith('@') ? t(x.slice(1)) : x);
    out[k] = Array.isArray(v) ? v.map(one).join(', ') : one(v);
  }
  return out;
}
/** The text of a board item (or any { k, v }). */
export const itemText = (it) => t(it.k, rv(it.v));
const sigOf = (k, v) => `${k}|${JSON.stringify(v || {})}`;
const wd = (di) => `@td.wd.${new Date(dayMs(di)).getDay()}`;
const FEST_AT = { derby: { x: 3.4, z: 46 }, fair: { x: 12, z: -5 }, plant: { x: 12, z: -5 }, lanterns: { x: 40, z: 20 }, beach: { x: 14, z: 37.5 }, pebble: { x: 44.5, z: -27.5 } }; // (pebble: the Ollo folk's Pebble Day, folk.js)

export class TodayBoard {
  constructor(host) {
    this.host = host;
    this.day = '';
    this.t = 0;
    this.spot = null;
    this.model = null;
  }

  get S() { return this.host.save; }

  /** Once a second: a new day computes the board (shown on your first visit that day) and the hooks. */
  tick(at) {
    const day = dayKey(at);
    if (day === this.day) { this.updateModel(); return; }
    this.day = day;
    const S = this.S;
    if (S.todayBoard?.day !== day) this.newDay(at);
    else if (!S.todayBoard.shown) this.pending = true;
    this.updateModel();
  }

  newDay(at) {
    const S = this.S, host = this.host, di = dayIndex(at), day = dayKey(at);
    host.village?.newDay?.(at); // dramas and projects move on first (the board tells about them)
    host.events?.newDay?.(at);
    host.robot?.newDay?.(at);
    host.odd?.newDay?.(at); // the odd-adventure round: something new may arrive (odd.js)
    this.resolveHooks(di);
    const fresh = this.issueHook(at);
    const items = S.intro ? this.compute(at, fresh) : [];
    S.todayBoard = { day, items, shown: !S.intro || !items.length, ...(S.intro ? {} : { pre: true }) };
    if (items.length) {
      S.todayHist = (S.todayHist || []).filter((h) => di - h.di < HIST_DAYS);
      S.todayHist.push({ di, sigs: items.map((it) => sigOf(it.k, it.v)) });
    }
    this.pending = !S.todayBoard.shown;
    host.markDirty();
  }

  /** The board's things for a date: { kind, icon, k, v, x?, z? }, at most three, never one shown in the last three weeks. */
  compute(at, fresh = null) {
    const S = this.S, host = this.host, di = dayIndex(at), day = dayKey(at);
    const used = new Set((S.todayHist || []).filter((h) => di - h.di < HIST_DAYS && h.di !== di).flatMap((h) => h.sigs));
    const C = []; // { kind, pri, icon, keys: [...], v, x, z }
    const fest = festivalOn(at);
    if (fest) C.push({ kind: 'changed', pri: 9, icon: '🎉', keys: [1, 2, 3].map((i) => `td.fest.${fest}.${i}`), ...FEST_AT[fest] });
    // (a surprise that is already over by the first visit is not news: play-test, "Skye is flying in today. Look up!"
    // at 19:00, two hours after her balloon left)
    const sur0 = surpriseOn(at), sur = sur0 && SURPRISE_HOURS[sur0] && hourOf(at) >= SURPRISE_HOURS[sur0][1] ? null : sur0;
    const letter = S.hookDone?.kind === 'letter' && S.hookDone.di === di ? S.hookDone.who : null;
    if (sur === 'merchant') {
      const list = (host.surprise?.pickWares(day) || []).map(([id]) => `@${host.surprise.itemKey(id)}`);
      C.push({ kind: 'visitor', pri: 8, icon: '🛍️', keys: letter === 'merchant' ? ['td.sur.merchant.letter'] : [1, 2, 3].map((i) => `td.sur.merchant.${i}`), v: { list }, x: 25.1, z: -6.8 });
    } else if (sur === 'balloon') C.push({ kind: 'visitor', pri: 8, icon: '🎈', keys: letter === 'balloon' ? ['td.sur.balloon.letter'] : [1, 2, 3].map((i) => `td.sur.balloon.${i}`), x: 22.2, z: 7.6 });
    else if (sur === 'bottle') C.push({ kind: 'changed', pri: 7, icon: '🍾', keys: [1, 2, 3].map((i) => `td.sur.bottle.${i}`) });
    else if (sur === 'meteor') C.push({ kind: 'rumor', pri: 7, icon: '🌠', keys: [1, 2, 3].map((i) => `td.sur.meteor.${i}`) });
    // the rare events, the villagers' dramas and projects, the robot (their own modules)
    for (const src of [host.events, host.village, host.robot, host.lock, host.odd]) for (const c of src?.todayNews?.(at) || []) C.push(c);
    // the season's first day
    const season = seasonOf(at);
    if (seasonOf(at - 86400000) !== season) C.push({ kind: 'changed', pri: 6, icon: '🌦️', keys: [`td.season.${season}`] });
    const bday = Object.keys(BIRTHDAYS).find((n) => birthdayOf(n, at));
    if (bday) C.push({ kind: 'changed', pri: 7, icon: '🎂', keys: ['td.bday.1', 'td.bday.2'], v: { name: `@isl.npc.${bday}` } });
    // the hooks
    const H = S.hook;
    if (H?.ready && H.readyDi === di && H.kind !== 'letter') C.push({ kind: 'changed', pri: 8, icon: H.kind === 'egg' ? '🥚' : '🌼', keys: [`td.hook.${H.kind}`], x: H.x, z: H.z });
    if (fresh && fresh.kind !== 'letter') C.push({ kind: 'changed', pri: 5, icon: fresh.kind === 'egg' ? '🥚' : '🪴', keys: [`td.hook.${fresh.kind}.new`], x: fresh.x, z: fresh.z });
    // what tomorrow brings (rumors)
    const tm = at + 86400000;
    const tf = festivalOn(tm);
    if (tf && tf !== fest) C.push({ kind: 'rumor', pri: 5, icon: '📅', keys: ['td.r.fest'], v: { name: `@isl.fest.${tf}` } });
    const tb = Object.keys(BIRTHDAYS).find((n) => birthdayOf(n, tm));
    if (tb) C.push({ kind: 'rumor', pri: 6, icon: '🎁', keys: ['td.r.bday'], v: { name: `@isl.npc.${tb}` } });
    const ts = surpriseOn(tm);
    if ((ts === 'merchant' || ts === 'balloon') && !(H?.kind === 'letter')) C.push({ kind: 'rumor', pri: 3, icon: ts === 'merchant' ? '🔔' : '🔭', keys: [`td.r.${ts}`] });
    // a letter from a friend arrived today
    const friend = (S.mail || []).find((m) => m.id?.startsWith('f.') && m.day === day);
    if (friend) C.push({ kind: 'changed', pri: 4, icon: '📫', keys: ['td.mail.1', 'td.mail.2'], v: { name: `@isl.npc.${friend.from}` }, x: -15, z: -11.2 });
    // pick: the best of each kind first, then the next best; a wording that was shown lately is skipped
    C.sort((a, b) => b.pri - a.pri);
    const pickWord = (c) => {
      const n = c.keys.length, s = Math.floor(dayRand(`td:${day}:${c.keys[0]}`) * n);
      for (let i = 0; i < n; i++) { const k = c.keys[(s + i) % n]; if (!used.has(sigOf(k, c.v))) return k; }
      return null;
    };
    const out = [], kinds = new Set();
    for (const pass of [0, 1]) {
      for (const c of C) {
        if (out.length >= 3 || c.taken || (pass === 0 && kinds.has(c.kind))) continue;
        const k = pickWord(c);
        if (!k) continue;
        c.taken = true;
        kinds.add(c.kind);
        out.push({ kind: c.kind, icon: c.icon, k, v: c.v, x: c.x, z: c.z });
      }
    }
    return out;
  }

  /** Today's items as text (tests, the journal). */
  texts() { return this.items().map(itemText); }

  /** Today's items (for the journal and the map). */
  items() {
    const B = this.S.todayBoard;
    if (B?.day !== dayKey()) return [];
    // made before the welcome (a new island's first day): the board is not shown that day, but the journal and the
    // map still tell what is on today (play-test: it said "a quiet day" on Beach Day)
    if (B.pre && this.S.intro) { B.items = this.compute(now()); B.pre = false; }
    return B.items;
  }

  // ---------- the board ----------

  /** Show it (once, the first time you walk about on a new day). */
  update(dt) {
    const host = this.host;
    if (this.model) this.animate(dt);
    if (host.mode === 'today') { this.t += dt; return; }
    if (!this.pending || host.mode !== 'walk' || host.hud.cinemaOn || host.camView || !host.player || host.launching) return;
    if ((this.wait = (this.wait || 0) + dt) < 1.2) return;
    this.wait = 0;
    this.pending = false;
    const B = this.S.todayBoard;
    if (!B || B.shown || !B.items.length) return;
    B.shown = true;
    this.open();
    host.markDirty();
  }

  open() {
    const host = this.host;
    host.mode = 'today';
    this.t = 0;
    this.sel = -1; // the "save it for later" row: only picked with the stick (owner's decision: [OK] never saves by itself)
    this.offer = host.lock?.boardOffer() || null; // a warning or a visitor's letter: it can be saved for later (lock.js)
    this.render(true);
    host.game.audio.play('join');
  }

  render(read = false) {
    const host = this.host, items = this.items(), P = host.player?.p;
    const d = new Date(now());
    const date = `${t(`td.wd.${d.getDay()}`)} ${d.getDate()}.${d.getMonth() + 1}.`;
    const cards = items.map((it) => `<div class="isl-row" style="grid-template-columns:auto 1fr;align-items:center"><span style="font-size:1.8em">${it.icon}</span><div><small style="opacity:.7">${KIND_ICON[it.kind]} ${esc(t(`td.kind.${it.kind}`))}</small><br>${esc(itemText(it))}</div></div>`).join('');
    // its own row, picked with the stick (▼) and confirmed with [OK]; [OK] alone and [BACK] only close the board
    const save = this.offer ? `<div class="isl-row td-save ${this.sel === 0 ? 'on' : ''}" style="grid-template-columns:auto 1fr;align-items:center;margin-top:6px;border:2px dashed #8a5a32"><span style="font-size:1.5em">🔒</span><div>${esc(t('lk.boardRow'))}</div></div>` : '';
    const hint = this.offer ? (this.sel === 0 ? 'lk.boardHintOn' : 'lk.boardHint') : 'td.hint';
    host.hud.setPanel(`<h2>${esc(t('td.title'))} <small style="font-size:.5em;opacity:.7">${esc(date)}</small></h2><div class="isl-rows">${cards}${save}</div><div class="isl-foot">${esc(tFor(P, hint))}</div>`);
    if (read) speak([t('td.title'), ...items.map(itemText), ...(this.offer ? [tFor(P, 'lk.boardHint')] : [])].join('. '), 'narrator');
  }

  /**
   * In 'today' mode: [OK] (E / A), [BACK] or [C] close the board, every day. With a warning or a visitor's letter on
   * it, ▼ picks the "save it for later" row and [OK] on that row saves it (▲ leaves the row); nothing else saves.
   */
  updateBoard(inp) {
    if (this.t < 0.5) return;
    if (this.offer && inp.stepY) {
      const want = inp.stepY < 0 ? 0 : -1;
      if (want !== this.sel) { this.sel = want; this.host.game.audio.play('select'); this.render(); }
      return;
    }
    if (!(inp.aPressed || inp.bPressed || inp.cPressed)) return;
    if (this.offer && this.sel === 0 && inp.aPressed && !inp.bPressed && !inp.cPressed) this.host.lock.lock(this.offer);
    this.offer = null;
    this.sel = -1;
    this.host.hud.setPanel(null);
    this.host.mode = 'walk';
  }

  /** The Today section of the journal's Tasks tab. */
  journalHtml() {
    const items = this.items();
    const tm = this.tomorrowLine();
    const list = items.length ? items.map((it) => `<li>${it.icon} ${esc(itemText(it))}</li>`).join('') : `<li>${esc(t('td.quiet'))}</li>`;
    return `<h3 style="margin:0 0 4px;color:#8a5a32">${esc(t('td.journal'))}</h3><ul class="isl-jtasks" style="list-style:none;padding:0">${list}${tm ? `<li>🌙 ${esc(t('td.tomorrow', { text: tm }))}</li>` : ''}</ul>`;
  }

  /** Map markers for today's things that have a place. */
  mapItems() {
    // (a friend's letter that has been read is no longer anything to go to: play-test, the mailbox kept glowing)
    const out = this.items().filter((it) => it.x !== undefined && !(it.k?.startsWith('td.mail') && !this.S.mail?.some((m) => m.id?.startsWith('f.')))).map((it, i) => ({ key: `td:${i}`, icon: it.icon, name: itemText(it), x: it.x, z: it.z }));
    const H = this.S.hook;
    if (H && H.kind !== 'letter' && this.spot && H.ready) out.push({ key: 'td:hook', icon: H.kind === 'egg' ? '🥚' : '🌼', name: t(H.kind === 'egg' ? 'map.a.hookEgg' : 'map.a.hookPot'), x: this.spot.x, z: this.spot.z });
    return out;
  }

  // ---------- tomorrow hooks (one at a time) ----------

  /** Where the egg basket or the pot stands: by the cottage, clear of the yard and the path. */
  hookSpot() {
    if (!this.spot) this.spot = this.host.map.findSpot(-9.0, -13.0, 0.5);
    return this.spot;
  }

  /** Make a new hook now and then (never while one is pending, a few days apart). Returns it (for the board). */
  issueHook(at) {
    const S = this.S, di = dayIndex(at), day = dayKey(at);
    if (!S.intro || S.hook || di - (S.hookLast ?? -99) < HOOK_GAP || dayRand(`hook:${day}`) > 0.55) return null;
    const order = ['egg', 'letter', 'pot'];
    for (let k = 0; k < 3; k++) {
      const kind = order[((S.hookN || 0) + k) % 3];
      let H = null;
      if (kind === 'egg') H = { kind, due: di + 1 };
      else if (kind === 'pot') H = { kind, due: di + 2, flower: Math.floor(dayRand(`pot:${day}`) * 3) };
      else {
        for (let d = di + 2; d <= di + 5 && !H; d++) {
          const s = surpriseOn(dayMs(d));
          if (s === 'merchant' || s === 'balloon') H = { kind, due: d, who: s };
        }
        if (!H) continue;
        S.mail.push({ id: `td.${H.who}`, from: H.who === 'merchant' ? 'merchant' : 'skye', vars: { day: wd(H.due) } });
        this.host.later(1.5, () => this.host.mailToast());
      }
      const sp = this.hookSpot();
      Object.assign(H, { made: di, x: sp.x, z: sp.z });
      S.hook = H;
      S.hookN = (S.hookN || 0) + k + 1;
      return H;
    }
    return null;
  }

  /** On a new day: a hook that is due gets ready (a letter's visitor simply comes). */
  resolveHooks(di) {
    const S = this.S, H = S.hook;
    if (!H) return;
    if (H.due > di + 7 || H.made > di) { S.hook = null; return; } // (the clock went backwards a lot)
    if (di < H.due) return;
    if (H.kind === 'letter') { this.endHook(di, { who: H.who }); return; }
    if (!H.ready) { H.ready = true; H.readyDi = di; return; }
    // not looked at for two days: the chick or duckling finds its own way, the flower is picked by the wind (one hook at a time,
    // and never one that waits forever)
    if (di - H.readyDi >= 2) {
      if (H.kind === 'egg' && this.S.unlocks?.barn) this.host.ranch?.addAnimal('chicken', di);
      this.endHook(di, { result: 'self' });
    }
  }

  endHook(di, extra = {}) {
    const S = this.S, H = S.hook;
    S.hookDone = { kind: H?.kind, di, ...extra };
    S.hook = null;
    S.hookLast = di;
    this.host.markDirty();
  }

  /** What tomorrow brings, one line (or null): the hook first, else the calendar, else the villagers. */
  tomorrowLine(at = now()) {
    const S = this.S, H = S.hook, di = dayIndex(at);
    if (H) {
      if (H.ready) return t(`tm.${H.kind}.now`);
      if (H.kind === 'letter') return H.due === di + 1 ? t(`tm.letter.${H.who}.tomorrow`) : t(`tm.letter.${H.who}`, rv({ day: wd(H.due) }));
      if (H.due === di + 1) return t(`tm.${H.kind}.tomorrow`);
      return t(`tm.${H.kind}.later`, rv({ day: wd(H.due) }));
    }
    const tm = at + 86400000;
    const f = festivalOn(tm);
    if (f && f !== festivalOn(at)) return t('tm.fest', { name: t(`isl.fest.${f}`) });
    const b = Object.keys(BIRTHDAYS).find((n) => birthdayOf(n, tm));
    if (b) return t('tm.bday', { name: t(`isl.npc.${b}`) });
    return this.host.village?.tomorrowLine?.(at) || null;
  }

  /** Going into the cottage in the evening: a gentle line about tomorrow (once a day). */
  onEnterHome() {
    const S = this.S, day = dayKey();
    if (hourOf() < 19 || S.tmToldDay === day) return;
    const line = this.tomorrowLine();
    if (!line) return;
    S.tmToldDay = day;
    this.host.game.ui.toast(t('td.tomorrow', { text: line }), 3600);
  }

  // ---------- the egg basket and the mystery pot ----------

  updateModel() {
    const H = this.S.hook;
    const want = H && H.kind !== 'letter' ? H.kind : null;
    if (want !== this.modelKind) {
      if (this.model) { this.model.removeFromParent(); this.model = null; }
      this.modelKind = want;
      if (want) {
        const sp = this.hookSpot();
        this.model = want === 'egg' ? makeBasket() : makePot();
        this.model.position.set(sp.x, heightAt(sp.x, sp.z), sp.z);
        this.host.scene.add(this.model);
      }
    }
    if (this.model) {
      const u = this.model.userData;
      if (u.bloom) { u.bloom.visible = !!H.ready; u.sprout.visible = !H.ready; }
    }
  }

  animate(dt) {
    const H = this.S.hook, u = this.model.userData;
    this.wob = (this.wob || 0) + dt;
    if (u.egg) u.egg.rotation.z = H?.ready ? Math.sin(this.wob * 9) * 0.25 * (Math.sin(this.wob * 1.3) > 0 ? 1 : 0.2) : Math.sin(this.wob * 1.5) * 0.04;
    if (u.bloom?.visible) u.bloom.rotation.y += dt * 0.6;
  }

  interactions(P, out, nm) {
    const H = this.S.hook;
    if (!H || H.kind === 'letter' || !this.model) return false;
    const sp = this.hookSpot();
    if (Math.hypot(P.x - sp.x, P.z - sp.z) > 1.4) return false;
    out.b = { text: nm(H.kind === 'egg' ? 'td.h.egg' : 'td.h.pot'), fn: () => this.useHook() };
    return true;
  }

  useHook() {
    const host = this.host, S = this.S, H = S.hook;
    if (!H) return;
    if (!H.ready) {
      host.game.ui.toast(H.kind === 'egg' ? t('td.egg.wait') : t('td.pot.wait', rv({ day: wd(H.due) })), 2400);
      host.game.audio.play('bump');
      return;
    }
    const sp = this.hookSpot(), pos = new THREE.Vector3(sp.x, heightAt(sp.x, sp.z) + 0.6, sp.z), di = dayIndex();
    host.confetti.burst(pos, 0, { count: 30, speed: 4, up: 4, life: 1.2, gravity: -6, colors: [0xffd23f, 0xffffff, 0xff9fd0] });
    host.game.audio.play('fanfare');
    if (H.kind === 'egg') {
      const chick = S.unlocks.barn && host.ranch.addAnimal('chicken', di);
      host.game.ui.toast(t(chick ? 'td.egg.chick' : 'td.egg.duck'), 3200);
      if (!chick) host.giveItems([['seaShell', 1]], true);
      this.endHook(di, { result: chick ? 'chick' : 'duck' });
    } else {
      host.game.ui.toast(t('td.pot.open', { flower: t(`td.flower.${H.flower || 0}`) }), 3200);
      host.giveItems([['bouquet', 2], [['goldenAcorn', 'mysterySeed', 'starfruitSeed'][H.flower || 0], 1]], true);
      this.endHook(di, { result: H.flower });
    }
    this.updateModel();
    host.markDirty();
  }
}

function makeBasket() {
  const g = new THREE.Group();
  g.add(mesh(cyl(0.32, 0.24, 0.22, 12), 0xb07a4a, 0, 0.11, 0));
  g.add(mesh(cyl(0.3, 0.3, 0.04, 12), 0xf0d060, 0, 0.22, 0, false)); // straw
  const egg = new THREE.Group();
  const e = mesh(sph(0.15, 12, 10), 0xfff4e0, 0, 0.15, 0);
  e.scale.set(0.85, 1.15, 0.85);
  egg.add(e);
  for (const [x, y, z] of [[0.08, 0.2, 0.1], [-0.1, 0.12, 0.06], [0.02, 0.26, -0.11], [-0.04, 0.05, -0.12]]) egg.add(mesh(sph(0.03, 6, 4), 0x9a6a4a, x, y, z, false));
  egg.position.y = 0.2;
  g.add(egg);
  g.userData.egg = egg;
  return g;
}

function makePot() {
  const g = new THREE.Group();
  g.add(mesh(cyl(0.26, 0.18, 0.34, 12), 0xd2693c, 0, 0.17, 0), mesh(cyl(0.24, 0.24, 0.03, 12), 0x5a3a24, 0, 0.33, 0, false));
  const sprout = new THREE.Group();
  sprout.add(mesh(cyl(0.02, 0.02, 0.16, 5), 0x5aa02c, 0, 0.42, 0, false), mesh(sph(0.05, 6, 4), 0x7ac943, 0.04, 0.5, 0, false));
  const bloom = new THREE.Group();
  bloom.add(mesh(cyl(0.025, 0.025, 0.5, 5), 0x5aa02c, 0, 0.58, 0, false));
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; bloom.add(mesh(sph(0.09, 8, 6), 0xc9a8ff, Math.cos(a) * 0.13, 0.86, Math.sin(a) * 0.13, false)); }
  bloom.add(mesh(sph(0.08, 8, 6), 0xffe14a, 0, 0.88, 0, false), mesh(cone(0.06, 0.12, 6), 0x7ac943, 0.12, 0.62, 0, false));
  g.add(sprout, bloom);
  g.userData.sprout = sprout;
  g.userData.bloom = bloom;
  return g;
}
