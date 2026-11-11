import { t, addStrings } from '../../core/i18n.js';
import { now } from './save.js';
import { npcState, canTalkBonus, TALK_PTS } from './npcs.js';
import {
  GENRES, GAMES, LEVEL_NAMES, loadPassport, savePassport, syncProfile, suggestNext, openTrials, trialById, gameName, skillLevel, announce,
} from '../../core/passport.js';

// Coach Bo, the solo island's game coach (development step 3). Lives in the Game Hall (a little door on its west
// wall; npcs.js has the routine and the model, homes.js the door, map.js the spots), has a Friends-book page and a
// map marker like every villager, and speaks with the voice 'isl.coach' (core/voices.js).
//
// Talking to Coach: the first time, who Coach is and what the Passport tab is. Then he hands out the stamps you
// earned since the last visit (a cheer, and the genre's card read by the narrator, plus 10 coins a stamp) and
// cheers for trials you finished (25 coins). Then a question: "What next?" (a suggestion that builds on what
// you have learned: core/passport.js suggestNext(), with the way there on the map), "A trial, please!" (a short
// optional challenge for your weakest skill; the Passport marks it), "Kinds of games" (opens the Passport's genre
// cards) or "Bye". Nothing is ever locked or forced by him: every place stays open as before.

addStrings({
  en: {
    'isl.npc.coach': 'Coach Bo',
    'isl.coach.meet': 'Hey there, {name}! I am Coach Bo. I help kids get good at games: all kinds of games.',
    'isl.coach.chat1': 'Every game teaches you something. Sky Hop teaches timing, Bean Brigade teaches thinking ahead.',
    'isl.coach.chat2': 'Losing a try is how you learn the level. Even the best players fall off a lot!',
    'isl.coach.chat3': 'Try one new thing at a time. When it feels easy, add the next one.',
    'isl.coach.chat4': 'Take a break when you get stuck. Your brain keeps practising while you rest. Really!',
    'isl.coach.chat5': 'I warm up on kite hill every morning. Jumping jacks for the thumbs!',
    'isl.coach.love': 'Wow, for me? This is my favorite! Thanks, champ!',
    'isl.coach.like': 'Nice one! Thanks, {name}.',
    'isl.coach.neutral': 'Oh, thank you! Every bit of energy helps.',
    'isl.coach.dislike': 'Hmm, not really my thing. But thanks for thinking of me!',
    'isl.knock.coach.1': 'Zzz... one more lap... zzz. (Coach Bo is asleep. Come back in the morning!)',
    'isl.knock.coach.2': 'Mmm... great job, team... zzz.',
    'isl.home.hall': 'the Game Hall',
    'coach.meet2': 'See the new Passport tab in your journal? Every kind of game gets a stamp, and every skill gets a medal: bronze, silver and gold.',
    'coach.meet3': 'Play anything you like! I will give you ideas for what to try next. Come and show me your stamps.',
    'coach.stamp': 'Look at that: a {genre} stamp! Here it is in your passport.',
    'coach.trialDone': 'You did the trial: {trial}! That is {level} in {skill}. Amazing!',
    'coach.ask': 'So, {name}, what shall we talk about?',
    'coach.c.next': 'What should I try next?', 'coach.c.trial': 'Give me a trial!', 'coach.c.genres': 'Kinds of games', 'coach.c.bye': 'Bye!',
    'coach.next': 'Try {game} next! {why}',
    'coach.nextLocked': 'Try {game} next! {why} It is not open yet: {how}',
    'coach.nextTrial': 'You have tried every game here! Now a trial: {trial}.',
    'coach.nextDone': 'You have done everything I know about! Play your favorites with friends.',
    'coach.way': 'Want me to show you the way on the map?', 'coach.c.way': 'Yes, show me', 'coach.c.noWay': 'No, thanks',
    'coach.trial': 'Here is a trial for you: {trial}. It lifts {skill} to {level}. It is in your passport!',
    'coach.trialNone': 'You are doing so well that I have no trial left for you. Wow!',
    'coach.genres': 'Every game is one kind of game. Have a look at the cards in your passport!',
    'coach.bye': 'Have fun out there! Remember: one new thing at a time.',
    'coach.why.rod': 'Grumbleton at the pier has a fishing rod for you.', 'coach.why.suit': 'Grumbleton can help you get a diving suit.',
    'coach.why.cafe': 'The café needs fixing first.', 'coach.why.burrow': 'Mumble at the meadow knows the way.',
  },
  no: {
    'isl.npc.coach': 'Trener Bo',
    'isl.coach.meet': 'Hei, {name}! Jeg er Trener Bo. Jeg hjelper barn med å bli gode i spill: alle slags spill.',
    'isl.coach.chat1': 'Hvert spill lærer deg noe. Skyhopp lærer deg timing, Bønnebrigaden lærer deg å tenke framover.',
    'isl.coach.chat2': 'Å tape et forsøk er sånn du lærer brettet. Selv de beste faller av mange ganger!',
    'isl.coach.chat3': 'Prøv én ny ting om gangen. Når det føles lett, legger du til den neste.',
    'isl.coach.chat4': 'Ta en pause når du står fast. Hjernen øver videre mens du hviler. Helt sant!',
    'isl.coach.chat5': 'Jeg varmer opp på dragebakken hver morgen. Sprellemenn for tomlene!',
    'isl.coach.love': 'Oi, til meg? Dette er favoritten min! Takk, mester!',
    'isl.coach.like': 'Så fint! Takk, {name}.',
    'isl.coach.neutral': 'Å, takk! All energi hjelper.',
    'isl.coach.dislike': 'Hmm, ikke helt min greie. Men takk for at du tenkte på meg!',
    'isl.knock.coach.1': 'Zzz... én runde til... zzz. (Trener Bo sover. Kom tilbake i morgen tidlig!)',
    'isl.knock.coach.2': 'Mmm... bra jobba, laget... zzz.',
    'isl.home.hall': 'Spillhallen',
    'coach.meet2': 'Ser du den nye Pass-fanen i dagboka di? Hver slags spill gir et stempel, og hver ferdighet gir en medalje: bronse, sølv og gull.',
    'coach.meet3': 'Spill hva du vil! Jeg gir deg ideer til hva du kan prøve etterpå. Kom og vis meg stemplene dine.',
    'coach.stamp': 'Se der: et stempel for {genre}! Her er det i passet ditt.',
    'coach.trialDone': 'Du klarte prøven: {trial}! Det er {level} i {skill}. Helt utrolig!',
    'coach.ask': 'Nå, {name}, hva skal vi snakke om?',
    'coach.c.next': 'Hva skal jeg prøve nå?', 'coach.c.trial': 'Gi meg en prøve!', 'coach.c.genres': 'Slags spill', 'coach.c.bye': 'Ha det!',
    'coach.next': 'Prøv {game} nå! {why}',
    'coach.nextLocked': 'Prøv {game} nå! {why} Det er ikke åpent ennå: {how}',
    'coach.nextTrial': 'Du har prøvd alle spillene her! Nå en prøve: {trial}.',
    'coach.nextDone': 'Du har gjort alt jeg vet om! Spill favorittene dine med venner.',
    'coach.way': 'Vil du at jeg viser deg veien på kartet?', 'coach.c.way': 'Ja, vis meg', 'coach.c.noWay': 'Nei takk',
    'coach.trial': 'Her er en prøve til deg: {trial}. Den løfter {skill} til {level}. Den står i passet ditt!',
    'coach.trialNone': 'Du er så flink at jeg ikke har flere prøver til deg. Wow!',
    'coach.genres': 'Hvert spill er en slags spill. Ta en titt på kortene i passet ditt!',
    'coach.bye': 'Ha det gøy! Husk: én ny ting om gangen.',
    'coach.why.rod': 'Grumleton på brygga har en fiskestang til deg.', 'coach.why.suit': 'Grumleton kan hjelpe deg å få en dykkerdrakt.',
    'coach.why.cafe': 'Kafeen må fikses først.', 'coach.why.burrow': 'Mumle på enga vet veien.',
  },
});

export const STAMP_COINS = 10, TRIAL_COINS = 25;

export class Coach {
  constructor(host, { fromGame = null } = {}) {
    this.host = host;
    this.sugT = -1;
    this.sug = null;
    // the stamps and medals the game progress shows (old saves too); back from a game, say what is new
    const got = syncProfile(host.game);
    if (fromGame && got.length) host.later(1.4, () => announce(host.game, got));
  }

  get P() { return loadPassport(this.host.game.solo?.profile?.id); }
  save() { savePassport(this.host.game.solo?.profile?.id, this.P); }

  /** Can this game or activity be played on the island right now? { open, why, hidden }. */
  avail(key) {
    const host = this.host, S = host.save, G = GAMES[key];
    if (!G) return { open: false, hidden: true };
    if (key === 'coop') return { open: true }; // the Party Pier ferry
    if (G.where === 'coop') return { open: false, hidden: true };
    if (G.where === 'solo' || G.where === 'school') {
      const pl = host.map.places.find((p) => `place:${p.id}` === G.place);
      if (!pl) return { open: false, hidden: true };
      if (host.placeOpen(pl)) return { open: true };
      return { open: false, why: pl.lock === 'burrow' ? t('coach.why.burrow') : t(`isl.locked.${pl.lock}`) };
    }
    if (key === 'fishing') return S.sea?.rod ? { open: true } : { open: false, why: t('coach.why.rod') };
    if (key === 'dive') return S.sea?.suit ? { open: true } : { open: false, why: t('coach.why.suit') };
    if (key === 'cafe') return S.cafe?.repaired ? { open: true } : { open: false, why: t('coach.why.cafe') };
    if (key === 'islplay') return { open: false, hidden: true }; // the villagers invite you themselves
    return { open: true };
  }

  /**
   * The suggestion now: { key, text (for the passport and Coach), marker (a map marker key), trial } or null.
   * Kept for a second (the map asks for it on every redraw).
   */
  suggestion() {
    const host = this.host;
    if (this.sug && host.time - this.sugT < 1) return this.sug;
    this.sugT = host.time;
    const P = this.P;
    const s = P ? suggestNext(P, (k) => this.avail(k)) : null;
    if (!s) { this.sug = null; return null; }
    if (s.trial) { this.sug = { trial: s.trial, text: t(`pp.tr.${s.trial}`), marker: GAMES[trialById(s.trial).game]?.place || null }; return this.sug; }
    const G = GAMES[s.key];
    const why = s.from ? t('pp.why', { game: gameName(s.key), skill: t(`pp.skill.${s.skill}`).toLowerCase(), from: gameName(s.from) })
      : t('pp.whyNew', { game: gameName(s.key), genre: t(`pp.genre.${G.genre}`).toLowerCase(), skills: G.skills.map((k) => t(`pp.skill.${k}`).toLowerCase()).join(t('pp.and')) });
    this.sug = { key: s.key, open: s.open, how: s.why, why, text: gameName(s.key), marker: G.place || null };
    return this.sug;
  }

  /** Coach has something to hand out ("!" over him and on the map). */
  hasNews() {
    const P = this.P;
    if (!P) return false;
    return !P.coach.met || Object.keys(P.stamps).some((g) => !P.coach.handed[g]) || Object.keys(P.trials).some((id) => !P.coach.told[id]);
  }

  /** A talk with Coach (island.js talkTo). */
  talk(n) {
    const host = this.host, S = host.save, P = this.P;
    const st = npcState(S, 'coach'), at = now();
    syncProfile(host.game);
    const C = (k, vars, fx) => ({ who: 'coach', key: k.startsWith('isl.') ? k : `coach.${k}`, vars, fx });
    const lines = [];
    if (!st.met || !P.coach.met) {
      lines.push(C('isl.coach.meet'), C('meet2'), C('meet3'));
      st.met = true;
      P.coach.met = true;
    }
    const bd = host.seasons.birthdayLine(n);
    if (bd) lines.push(bd);
    // stamps to hand out (two a talk, the rest next time), each with its genre card (read by the narrator: help)
    const fresh = Object.keys(P.stamps).filter((g) => !P.coach.handed[g]).slice(0, 2);
    for (const g of fresh) {
      const G = GENRES.find((x) => x.id === g);
      lines.push(C('stamp', { genre: t(`pp.genre.${g}`) }, () => { n.hop = 1; host.game.audio.play('star'); }));
      lines.push({ name: `${G.icon} ${t(`pp.genre.${g}`)}`, text: t(`pp.card.${g}`), speaker: 'narrator', css: G.css, fx: () => {
        P.coach.handed[g] = at;
        this.save();
        host.grant({ coins: STAMP_COINS });
      } });
    }
    for (const id of Object.keys(P.trials).filter((x) => !P.coach.told[x]).slice(0, 2)) {
      const tr = trialById(id);
      if (!tr) continue;
      lines.push(C('trialDone', { trial: t(`pp.tr.${id}`), level: t(`pp.lv.${LEVEL_NAMES[tr.level]}`), skill: t(`pp.skill.${tr.skill}`).toLowerCase() }, () => {
        P.coach.told[id] = at;
        if (P.coach.trial === id) P.coach.trial = null;
        this.save();
        host.celebrate(n);
        host.grant({ coins: TRIAL_COINS });
      }));
    }
    if (canTalkBonus(st, at)) { st.talkAt = at; host.addPts('coach', TALK_PTS); }
    lines.push({ ...C('ask'), choices: ['coach.c.next', 'coach.c.trial', 'coach.c.genres', 'coach.c.bye'], onChoice: (i) => this.answer(n, i) });
    host.say(lines, () => this.done(n));
  }

  done(n) {
    this.save();
    this.host.markDirty();
    this.host.afterTalk(n);
  }

  answer(n, i) {
    const host = this.host, P = this.P;
    const C = (k, vars) => ({ who: 'coach', key: `coach.${k}`, vars });
    if (i === 0) {
      this.sug = null;
      const s = this.suggestion();
      let line;
      if (!s) line = C('nextDone');
      else if (s.trial) line = C('nextTrial', { trial: s.text });
      else line = C(s.open ? 'next' : 'nextLocked', { game: s.text, why: s.why, how: s.how || '' });
      const m = s?.marker && this.marker(s.marker);
      if (!m) { host.say([line], () => this.done(n)); return; }
      host.say([line, { ...C('way'), choices: ['coach.c.way', 'coach.c.noWay'], onChoice: (k) => {
        if (k === 0) { host.atlas.setTarget(m); host.game.ui.toast(t('map.set', { name: m.name }), 2200); }
        this.done(n);
      } }], () => this.done(n));
      return;
    }
    if (i === 1) {
      const tr = openTrials(P, 1, (k) => this.avail(k))[0] || openTrials(P, 1)[0];
      if (!tr) { host.say([C('trialNone')], () => this.done(n)); return; }
      P.coach.trial = tr.id;
      this.save();
      host.say([C('trial', { trial: t(`pp.tr.${tr.id}`), skill: t(`pp.skill.${tr.skill}`).toLowerCase(), level: t(`pp.lv.${LEVEL_NAMES[tr.level]}`) })], () => this.done(n));
      return;
    }
    if (i === 2) {
      host.say([C('genres')], () => {
        this.done(n);
        // the first card you have a stamp for, else the first card
        const g = GENRES.find((x) => P.stamps[x.id]) || GENRES[0];
        if (host.mode === 'walk') host.passport.open(`genre:${g.id}`);
      });
      return;
    }
    host.say([C('bye')], () => this.done(n));
  }

  /** The map marker for a suggestion's place ('trail:' is any hop trail). */
  marker(key) {
    const list = this.host.atlas.markers('main');
    return list.find((m) => m.key === key) || (key === 'trail:' ? list.find((m) => m.key.startsWith('trail:')) : null) || null;
  }

  /** The skill levels, for tests and the parent page. */
  levels() {
    const P = this.P;
    return Object.fromEntries(['timing', 'aiming', 'steering', 'exploring', 'puzzles', 'planning', 'building', 'reading', 'teamwork'].map((s) => [s, skillLevel(P, s)]));
  }
}

