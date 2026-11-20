import { t, tFor, addStrings } from '../../core/i18n.js';
import { esc } from '../../core/ui.js';
import { say as speak } from '../../core/voice.js';
import { now } from './save.js';
import { dayKey, dayIndex, dayMs, festivalNative, rareNative, setLatePlay, rareMoveFor, setRareMove } from './calendar.js';

// Saving a coming event for later (the owner's "can't play that day" item). A child who cannot come on a festival
// weekend, a rare event's day or a visitor's day can lock it: if they miss it, it plays on their next visit within
// three days after it (the festival with its stalls, villagers and rewards; the storm's finds, the fog's ghost
// ship, the rainbow; Marlo or Skye). That day it is the one special thing: the day's own surprise or rare event is
// skipped (a festival day waits: the late play goes to the next day in the window), and a drama's big moment
// moves on (village.js). Visiting on the event's day uses the lock up (no replay); three days unplayed and it
// expires with a gentle note.
//
// Lockable: festivals (the Derby and the season's festival weekends), a rare event that was warned about on
// today's Today board (tomorrow's storm, fog or rainbow; an unwarned one stays a surprise) and a visitor announced
// by letter (the tomorrow hook). Not the dramas' big moments, not the daily surprises.
// Where: the journal's "Coming up" tab (▲▼ choose, [OK] locks, [BACK] closes: it never locks) and the Today
// board when it shows a warning or a visitor's letter ([OK] locks it). One lock at a time: locking another moves
// it. Save: S.lock { kind, what, day, last } and S.lockPlay { di, kind, what } (old saves have neither).
// A rare event played late never lands the day before the next rare event: an unwarned next one moves to the next
// allowed day of its week (S.rareMove { from, to, kind }, calendar.js rareMoveFor); a warned one stays (a promise).

export const LATE_DAYS = 3;
const AHEAD = 14;

addStrings({
  en: {
    'isl.jn.coming': 'Coming up',
    'lk.title': 'Coming up', 'lk.help': 'Can\'t play that day? Pick one and press [OK] to save it: if you miss it, it waits up to three days for you. One at a time.',
    'lk.none': 'Nothing to save right now. Look again in a day or two!',
    'lk.hint': '▲▼: choose · [OK]: save it 🔒 · [C]: close',
    'lk.saved': 'Saved for you: {name}. If you miss it, it waits up to three days.',
    'lk.moved': 'The lock moved to {name}. (One at a time.)',
    'lk.already': '{name} is already saved for you.',
    'lk.used': 'You were here for {name}, so your lock is free again.',
    'lk.late': 'Saved for you: {name}, today!',
    'lk.expired': 'The {name} you saved has passed. There will be another one!',
    'lk.boardRow': 'Save it for later, in case you cannot come',
    'lk.boardHint': '[OK]: off we go · ▼: save it for later',
    'lk.boardHintOn': '[OK]: 🔒 save it for later · ▲: no thanks · [C]: off we go',
    'lk.today': 'today', 'lk.tomorrow': 'tomorrow', 'lk.days': '{a} and {b}',
    'lk.rare.storm': 'the storm (treasure on the beach)', 'lk.rare.fog': 'the foggy night (the ghost ship)', 'lk.rare.rainbow': 'the rainbow',
    'lk.vis.merchant': 'Marlo\'s visit', 'lk.vis.balloon': 'Skye\'s visit',
    'td.lk.letter.merchant': 'Marlo\'s letter: he comes on {day}. Can\'t come then? Save it in the journal (Coming up).',
    'td.lk.letter.balloon': 'Skye\'s letter: she lands on {day}. Can\'t come then? Save it in the journal (Coming up).',
  },
  no: {
    'isl.jn.coming': 'Snart',
    'lk.title': 'Snart', 'lk.help': 'Kan du ikke spille den dagen? Velg en og trykk [OK] for å spare den: hvis du går glipp av den, venter den opptil tre dager på deg. Én om gangen.',
    'lk.none': 'Ingenting å spare akkurat nå. Se igjen om en dag eller to!',
    'lk.hint': '▲▼: velg · [OK]: spar den 🔒 · [C]: lukk',
    'lk.saved': 'Spart til deg: {name}. Går du glipp av den, venter den opptil tre dager.',
    'lk.moved': 'Låsen flyttet til {name}. (Én om gangen.)',
    'lk.already': '{name} er allerede spart til deg.',
    'lk.used': 'Du var her på {name}, så låsen din er ledig igjen.',
    'lk.late': 'Spart til deg: {name}, i dag!',
    'lk.expired': '{name} som du sparte, er over. Det kommer en ny!',
    'lk.boardRow': 'Spar den til senere, i tilfelle du ikke kan komme',
    'lk.boardHint': '[OK]: av sted · ▼: spar den til senere',
    'lk.boardHintOn': '[OK]: 🔒 spar den til senere · ▲: nei takk · [C]: av sted',
    'lk.today': 'i dag', 'lk.tomorrow': 'i morgen', 'lk.days': '{a} og {b}',
    'lk.rare.storm': 'stormen (skatter på stranda)', 'lk.rare.fog': 'tåkenatta (spøkelsesskipet)', 'lk.rare.rainbow': 'regnbuen',
    'lk.vis.merchant': 'besøket til Marlo', 'lk.vis.balloon': 'besøket til Skye',
    'td.lk.letter.merchant': 'Brev fra Marlo: han kommer på {day}. Kan du ikke da? Spar det i dagboka (Snart).',
    'td.lk.letter.balloon': 'Brev fra Skye: hun lander på {day}. Kan du ikke da? Spar det i dagboka (Snart).',
  },
});

const ICON = { fest: '🎉', rare: { storm: '🌊', fog: '👻', rainbow: '🌈' }, vis: { merchant: '🛍️', balloon: '🎈' } };
/** The name of a lockable thing. */
export function lockName(e) {
  if (!e) return '';
  if (e.kind === 'fest') return t(`isl.fest.${e.what}`);
  if (e.kind === 'rare') return t(`lk.rare.${e.what}`);
  return t(`lk.vis.${e.what}`);
}
const iconOf = (e) => (e.kind === 'fest' ? ICON.fest : ICON[e.kind]?.[e.what] || '📅');
const same = (a, b) => !!a && !!b && a.kind === b.kind && a.what === b.what && a.day === b.day;

export class EventLock {
  constructor(host) {
    this.host = host;
    this.i = 0;
    this.day = '';
  }

  get S() { return this.host.save; }

  // ---------- what can be locked ----------

  /** The lockable things from today on: [{ kind, what, day, last }] (festival weekends, a warned rare event, a visitor's letter). */
  coming(at = now()) {
    const S = this.S, di = dayIndex(at), out = [];
    for (let d = di + 1; d <= di + AHEAD; d++) {
      const f = festivalNative(dayMs(d));
      if (f && festivalNative(dayMs(d - 1)) !== f) { let last = d; while (festivalNative(dayMs(last + 1)) === f) last++; out.push({ kind: 'fest', what: f, day: d, last }); }
    }
    // tomorrow's rare event, only when today's board warned about it
    const r = rareNative(dayMs(di + 1));
    const B = S.todayBoard;
    if (r && B?.day === dayKey(at) && B.items.some((it) => it.k?.startsWith(`td.ev.r.${r}`))) out.push({ kind: 'rare', what: r, day: di + 1, last: di + 1 });
    // a visitor announced by letter
    const H = S.hook;
    if (H?.kind === 'letter' && H.due > di) out.push({ kind: 'vis', what: H.who, day: H.due, last: H.due });
    return out.sort((a, b) => a.day - b.day);
  }

  whenText(e, at = now()) {
    const di = dayIndex(at);
    const one = (d) => (d === di ? t('lk.today') : d === di + 1 ? t('lk.tomorrow') : t(`td.wd.${new Date(dayMs(d)).getDay()}`));
    return e.last > e.day ? t('lk.days', { a: one(e.day), b: one(e.last) }) : one(e.day);
  }

  /** Lock it (one at a time: an old lock moves). Returns 'saved' | 'moved' | 'already'. */
  lock(e) {
    const S = this.S, host = this.host;
    if (same(S.lock, e)) { host.game.ui.toast(t('lk.already', { name: lockName(e) }), 2400); return 'already'; }
    const moved = !!S.lock;
    S.lock = { kind: e.kind, what: e.what, day: e.day, last: e.last };
    const msg = t(moved ? 'lk.moved' : 'lk.saved', { name: lockName(e) });
    host.game.ui.toast(msg, 3200);
    speak(msg, 'narrator');
    host.game.audio.play('star');
    host.markDirty();
    return moved ? 'moved' : 'saved';
  }

  // ---------- a new day: used, played late, or expired ----------

  /**
   * Called first thing each second (island.secondTick): on the first visit of a new day decide what the lock does,
   * then tell the calendar what plays late today (or nothing).
   */
  prepare(at) {
    const S = this.S, day = dayKey(at);
    if (day !== this.day) {
      this.day = day;
      if (S.todayBoard?.day !== day) this.resolve(dayIndex(at));
    }
    const L = S.lockPlay, di = dayIndex(at);
    setLatePlay(L && L.di === di ? { di, fest: L.kind === 'fest' ? L.what : null, rare: L.kind === 'rare' ? L.what : null, sur: L.kind === 'vis' ? L.what : null } : null);
    // the next rare event moved off the day after a late rare play (calendar.js rareMoveFor), until it is over
    const R = S.rareMove;
    setRareMove(R && di <= Math.max(R.from, R.to ?? R.from) ? R : null);
  }

  resolve(di) {
    const S = this.S, L = S.lock;
    if (S.lockPlay && S.lockPlay.di !== di) S.lockPlay = null;
    if (S.rareMove && di > Math.max(S.rareMove.from, S.rareMove.to ?? S.rareMove.from)) S.rareMove = null;
    if (!L || !Number.isFinite(L.day)) { if (L) S.lock = null; return; }
    if (di < L.day - AHEAD * 2) { S.lock = null; return; } // (the clock went far back)
    if (di < L.day) return;
    if (di <= L.last) { // you came on the day: no replay needed
      S.lock = null;
      S.lockNote = { di, note: 'used', ...L };
      // (said a moment later; not if a new lock was made meanwhile, say from the Today board: "free again" would then
      // come right after "Saved for you" and read as if nothing were saved; play-test)
      this.host.later?.(2.5, () => { if (!this.S.lock) this.host.game.ui.toast(t('lk.used', { name: lockName(L) }), 3000); });
    } else {
      const late = di - L.last; // 1, 2 or 3 days after: it plays today (a festival day of its own waits a day)
      if (late > LATE_DAYS || (festivalNative(dayMs(di)) && late === LATE_DAYS)) { S.lock = null; S.lockNote = { di, note: 'expired', ...L }; }
      else if (festivalNative(dayMs(di))) return;
      else {
        S.lock = null; S.lockPlay = { di, kind: L.kind, what: L.what, from: L.day }; S.lockNote = { di, note: 'late', ...L };
        // a rare event played late: the next one never comes the day after (unless it was warned about)
        if (L.kind === 'rare') S.rareMove = rareMoveFor(di);
      }
    }
    this.host.markDirty();
  }

  /** Today board items: the late play, an expired lock, a visitor's letter (lockable). */
  todayNews(at) {
    const S = this.S, di = dayIndex(at), out = [];
    const N = S.lockNote;
    if (N?.di === di && N.note === 'late') out.push({ kind: 'changed', pri: 10, icon: '🔒', keys: ['lk.late'], v: { name: N.kind === 'fest' ? `@isl.fest.${N.what}` : `@lk.${N.kind === 'rare' ? 'rare' : 'vis'}.${N.what}` } });
    if (N?.di === di && N.note === 'expired') out.push({ kind: 'changed', pri: 7.2, icon: '🍂', keys: ['lk.expired'], v: { name: N.kind === 'fest' ? `@isl.fest.${N.what}` : `@lk.${N.kind === 'rare' ? 'rare' : 'vis'}.${N.what}` } });
    const H = S.hook;
    if (H?.kind === 'letter' && H.made === di) out.push({ kind: 'visitor', pri: 6, icon: '✉️', keys: [`td.lk.letter.${H.who}`], v: { day: `@td.wd.${new Date(dayMs(H.due)).getDay()}` } });
    return out;
  }

  /** The thing the Today board offers to lock (a warning or a visitor's letter on it), or null. */
  boardOffer(at = now()) {
    const items = this.S.todayBoard?.day === dayKey(at) ? this.S.todayBoard.items : [];
    if (!items.some((it) => it.k?.startsWith('td.ev.r.') || it.k?.startsWith('td.lk.letter.'))) return null;
    return this.coming(at).find((e) => (e.kind === 'rare' && items.some((it) => it.k?.startsWith(`td.ev.r.${e.what}`))) || (e.kind === 'vis' && items.some((it) => it.k === `td.lk.letter.${e.what}`))) || null;
  }

  // ---------- the journal's Coming up tab ----------

  render(read = false) {
    const host = this.host, list = this.coming(), S = this.S;
    this.i = Math.min(this.i, Math.max(0, list.length - 1));
    const rows = list.map((e, i) => `<div class="isl-row ${i === this.i ? 'on' : ''}" style="grid-template-columns:auto 1fr auto;align-items:center"><span style="font-size:1.5em">${iconOf(e)}</span><div>${esc(lockName(e))} <small>${esc(this.whenText(e))}</small></div><span style="font-size:1.4em">${same(S.lock, e) ? '🔒' : ''}</span></div>`).join('');
    host.hud.setPanel(`<h2>${esc(t('lk.title'))}</h2><div class="isl-foot" style="opacity:1;margin:0 0 6px">${esc(tFor(host.player?.p, 'lk.help'))}</div>
      <div class="isl-rows">${rows || `<div class="isl-foot">${esc(t('lk.none'))}</div>`}</div><div class="isl-foot">${esc(tFor(host.player?.p, 'lk.hint'))}</div>`);
    if (read) speak([t('lk.title'), tFor(host.player?.p, 'lk.help'), ...(list.length ? list.map((e) => `${lockName(e)}, ${this.whenText(e)}.`) : [t('lk.none')])].join(' '), 'narrator');
  }

  /** In the journal: ▲▼ choose, [OK] locks (A or Space, E or X); [BACK] closes the journal (journal.js), never locks. */
  update(inp) {
    const list = this.coming();
    if (inp.stepY && list.length) { this.i = (this.i - inp.stepY + list.length) % list.length; this.host.game.audio.play('select'); this.render(); }
    if ((inp.aPressed || inp.bPressed) && list[this.i]) { this.lock(list[this.i]); this.render(); }
  }

  /** Every day check for an old lock (also when the island stays open over midnight: prepare does it). */
  dispose() { setLatePlay(null); setRareMove(null); }
}
