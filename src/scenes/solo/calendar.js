import { now } from './save.js';

// The island calendar, from the real date: rainy days (a deterministic daily seed, the same for everyone),
// birthdays, seasons and festivals. Everything here is a pure function of the date, so it is the same for
// everyone, needs no saved state and simply follows the clock (also when it goes backwards).
//
// Seasons (milestone B3, the owner's choice): ONE SEASON PER REAL WEEK. Weeks start on Monday; spring,
// summer, autumn and winter take turns week by week. Festivals (the owner's "rarer" round): one festival weekend
// every second week, Saturday and Sunday: the Fishing Derby on the first weekend of the month (the first Saturday
// and the Sunday after: never two in a month) and the season's own festival on the third (the third Saturday and
// the Sunday after; the season of that week: the Spring Planting Fair, the Summer Beach Day, the Harvest Fair or
// Lantern Night). Months are not whole weeks, so the third weekend's season moves on and every season's festival
// comes round a few times a year. Birthdays keep their dates.

/** Local date key "YYYY-MM-DD". */
export function dayKey(ms = now()) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
export const SEASON_ICON = { spring: '🌸', summer: '☀️', autumn: '🍂', winter: '❄️' };
const SEASON_SHIFT = 2; // so that the week of 2026-10-26 is autumn

/** Days since 1970-01-01 for the LOCAL calendar date (not the UTC instant). */
export function dayIndex(ms = now()) {
  const d = new Date(ms);
  return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
}

/** Week number, weeks starting on Monday (1970-01-05 was a Monday). */
export function weekIndex(ms = now()) {
  return Math.floor((dayIndex(ms) - 4) / 7);
}

/** The season of a date: spring, summer, autumn or winter (one real week each). */
export function seasonOf(ms = now()) {
  return SEASONS[(((weekIndex(ms) + SEASON_SHIFT) % 4) + 4) % 4];
}

/** Each season's own festival (Friday to Sunday of its week). */
export const SEASON_FEST = { spring: 'plant', summer: 'beach', autumn: 'fair', winter: 'lanterns' };

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
/** A number 0..1 fixed for a key (e.g. a day, or a day and a name). */
export const dayRand = (key) => (hash(key) % 10000) / 10000;

/** Birthdays: [month 1-12, day]. */
export const BIRTHDAYS = { hazel: [4, 12], rosa: [7, 3], bram: [11, 20], grumbleton: [2, 14], pip: [9, 1], mumble: [1, 30] };

export function birthdayOf(npc, ms = now()) {
  const d = new Date(ms);
  const b = BIRTHDAYS[npc];
  return !!b && d.getMonth() + 1 === b[0] && d.getDate() === b[1];
}

/**
 * Festivals, two weekends a month: derby (the first Saturday of the month and the Sunday after, fishing at the
 * pier) and the season's festival on the third Saturday and the Sunday after (the season of that week): plant
 * (spring planting fair in the square), beach (summer beach day), fair (harvest fair, autumn) and lanterns
 * (lantern night by the lighthouse, winter).
 */
export function festivalOn(ms = now()) {
  const L = latePlay(ms);
  return L ? L.fest || null : festivalNative(ms) || extraFest?.(ms) || null;
}

/**
 * The profile's own festival (folk.js: the new folk's Pebble Day, once they have settled on this island), or none:
 * (ms) => kind | null. Like the late play, it only changes that profile's island; the calendar stays the same.
 */
let extraFest = null;
export function setExtraFestival(fn) { extraFest = typeof fn === 'function' ? fn : null; }

/**
 * The fifth Saturday of a month (a month with one: the 29th to the 31st), when no daily surprise and no rare event
 * falls on it: the day the new folk keep Pebble Day (folk.js). Pure: the same for everyone (a few times a year).
 */
export function pebbleDayNative(ms = now()) {
  const d = new Date(ms);
  return d.getDay() === 6 && d.getDate() >= 29 && !surpriseNative(ms) && !rareNative(ms);
}

/** The calendar's own festival of a date (without a locked event played late: lock.js). */
export function festivalNative(ms = now()) {
  const d = new Date(ms);
  const day = d.getDate(), dow = d.getDay();
  // the first Saturday of the month and the Sunday after it (never two derbies in one month)
  if ((dow === 6 && day <= 7) || (dow === 0 && day >= 2 && day <= 8)) return 'derby';
  // the third Saturday and the Sunday after it (Saturday and Sunday are in the same Monday week: one season)
  if ((dow === 6 && day >= 15 && day <= 21) || (dow === 0 && day >= 16 && day <= 22)) return SEASON_FEST[seasonOf(ms)];
  return null;
}

/** The plain rain of a date (about one day in five, never on a festival day), before the rare events. */
function baseRain(ms) {
  if (festivalNative(ms)) return false;
  return dayRand(`rain:${dayKey(ms)}`) < 0.2;
}

/** Rain on about one day in five, never on a festival day (a storm or a rainbow day is a rainy day too). */
export function rainyOn(ms = now()) {
  if (baseRain(ms)) return true;
  const r = rareEventOn(ms);
  return r === 'storm' || r === 'rainbow';
}

/**
 * The daily surprise of a date (surprise.js shows them), or null: about one non-festival day in four: ~6.5%
 * meteor shower (not on rainy days), 6.5% merchant, 6% balloon, 6% bottle. The owner's budget (one special
 * thing a day): never on a festival day.
 */
export function surpriseOn(ms = now()) {
  const L = latePlay(ms);
  if (L) return L.sur || null;
  const k = surpriseNative(ms);
  return k && swap ? swap(dayIndex(ms), k) || k : k;
}

/**
 * A rare creature that takes a daily surprise's day on one profile's island (creatures.js: the mushroom merchant on
 * some of Marlo's days, the cloud whale on some meteor nights, once they have come to that island): (di, kind) =>
 * kind. It never adds a special day: the day keeps exactly one surprise, and the calendar stays the same for
 * everyone (surpriseNative).
 */
let swap = null;
export function setSurpriseSwap(fn) { swap = typeof fn === 'function' ? fn : null; }

/** The calendar's own surprise of a date (without a locked event played late). */
export function surpriseNative(ms = now()) {
  if (festivalNative(ms)) return null;
  const r = dayRand(`surprise:${dayKey(ms)}`);
  if (r < 0.065) return baseRain(ms) ? null : 'meteor';
  if (r < 0.13) return 'merchant';
  if (r < 0.19) return 'balloon';
  if (r < 0.25) return 'bottle';
  return null;
}

/**
 * A locked event played late (lock.js): on that one day (a day index) the island shows the locked festival, rare
 * event or visitor instead of the day's own (one special thing a day). The island sets it for the profile
 * playing (setLatePlay), and clears it when it closes; everything else stays a pure function of the date.
 */
let late = null; // { di, fest, rare, sur }
export function setLatePlay(o) { late = o && Number.isFinite(o.di) ? o : null; }
export function latePlay(ms) { return late && dayIndex(ms) === late.di ? late : null; }

/** Noon of a day index (local calendar). */
export const dayMs = (di) => new Date(1970, 0, 1 + di, 12).getTime();

/**
 * Rare weather events (events.js): a storm that washes treasure and stranded crabs ashore, fog that brings a
 * ghost ship at night, a rainbow that ends at a dig spot. One a week, on a Tuesday to Saturday that has no
 * festival and no daily surprise (one special thing a day), so never two days in a row. The kinds take turns
 * (never the same twice running); no rainbows in winter (it snows).
 */
export function rareEventOn(ms = now()) {
  const L = latePlay(ms);
  if (L) return L.rare || null;
  const M = rareMove, di = dayIndex(ms);
  if (M && di === M.from) return null;
  if (M && di === M.to) return M.kind;
  return rareNative(ms);
}

/**
 * A locked rare event played late (lock.js) must not land on the day next to the following rare event ("never two
 * days in a row"). The next rare event after a late rare play on day `lateDi`: if it is the very next day and was
 * not warned about (rareWarned: no promise on the Today board), it moves to the next allowed day of its own week
 * (Tuesday to Saturday, no festival, no daily surprise), or skips that week when there is none; a warned one stays
 * (a promise to the player). Deterministic: { from, to (null: none this week), kind } or null (nothing moves).
 */
export function rareMoveFor(lateDi) {
  const from = lateDi + 1, kind = rareNative(dayMs(from));
  if (!kind || rareWarned(dayMs(from))) return null;
  const sat = Math.floor((from - 4) / 7) * 7 + 4 + 5; // the Saturday of its week
  let to = null;
  for (let d = from + 1; d <= sat && to === null; d++) if (!festivalNative(dayMs(d)) && !surpriseNative(dayMs(d))) to = d;
  return { from, to, kind };
}

/** The moved rare event of the profile playing (lock.js sets it each second, like the late play), or null. */
let rareMove = null; // { from, to, kind }
export function setRareMove(o) { rareMove = o && Number.isFinite(o.from) ? o : null; }

/** The calendar's own rare event of a date (without a locked event played late). */
export function rareNative(ms = now()) {
  const di = dayIndex(ms), w = Math.floor((di - 4) / 7);
  return rareDayOfWeek(w) === di ? rareKind(w) : null;
}

const rareCache = new Map();
/** The day index of week w's rare event, or null. */
export function rareDayOfWeek(w) {
  if (rareCache.has(w)) return rareCache.get(w);
  let out = null;
  {
    // Tuesday to Saturday (so a Saturday and the next Tuesday are never two days in a row)
    const free = [];
    for (let k = 1; k <= 5; k++) { const d = w * 7 + 4 + k, t = dayMs(d); if (!festivalNative(t) && !surpriseNative(t)) free.push(d); }
    if (free.length) out = free[Math.floor(dayRand(`rareday:${w}`) * free.length)];
  }
  rareCache.set(w, out);
  return out;
}

const RARE_KINDS = ['storm', 'fog', 'rainbow'];
const RARE_W0 = 2922; // the week of Monday 2026-01-05: the kinds are counted from here
const rareKinds = []; // week (from RARE_W0) -> kind or null
let rareN = 0;
/**
 * The kind of week w's rare event: the events take turns storm, fog, rainbow (never the same kind twice in a
 * row, also across a week without one); in winter a rainbow's turn goes to the next kind (it snows).
 */
export function rareKind(w) {
  if (w < RARE_W0) return RARE_KINDS[((w % 3) + 3) % 3];
  while (rareKinds.length <= w - RARE_W0) {
    const ww = RARE_W0 + rareKinds.length;
    if (rareDayOfWeek(ww) === null) { rareKinds.push(null); continue; }
    let k = RARE_KINDS[rareN % 3];
    if (k === 'rainbow' && seasonOf(dayMs(ww * 7 + 4)) === 'winter') { rareN++; k = RARE_KINDS[rareN % 3]; }
    rareN++;
    rareKinds.push(k);
  }
  return rareKinds[w - RARE_W0];
}

/**
 * Is a date's rare event warned about the day before (a rumor on the Today board; only then can it be saved for
 * later, lock.js)? About two in three are; the rest arrive unannounced. By date.
 */
export function rareWarned(ms = now()) {
  return !!rareNative(ms) && dayRand(`rarewarn:${dayKey(ms)}`) < 2 / 3;
}

/** A day with no festival, no daily surprise and no rare event (a drama's big moment waits for one). */
/**
 * A new profile's first three days (day 0, 1 and 2 after its island was made; S.born): no seasonal mystery, no daily
 * little task and no tomorrow hook, so the welcome, the farming steps and meeting everyone come first (the owner's
 * decision after the play-test). Islands from before have no S.born and are never new.
 */
export const NEW_DAYS = 3;
export const newcomer = (S, di) => Number.isFinite(S?.born) && di - S.born < NEW_DAYS;

export function freeDay(ms = now()) {
  return !festivalOn(ms) && !surpriseOn(ms) && !rareEventOn(ms);
}

/** The days of a month with their events, for the calendar board. */
export function monthDays(ms = now()) {
  const d = new Date(ms);
  const y = d.getFullYear(), m = d.getMonth();
  const days = new Date(y, m + 1, 0).getDate();
  const first = (new Date(y, m, 1).getDay() + 6) % 7; // Monday first
  const out = [];
  for (let i = 1; i <= days; i++) {
    const t = new Date(y, m, i, 12).getTime();
    const bday = Object.keys(BIRTHDAYS).find((n) => birthdayOf(n, t));
    out.push({ day: i, festival: festivalOn(t), rain: rainyOn(t), bday, today: i === d.getDate(), season: seasonOf(t) });
  }
  return { first, days: out, month: m, year: y };
}
