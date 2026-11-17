import { now } from './save.js';

// The island calendar, from the real date: rainy days (a deterministic daily seed, the same for everyone),
// birthdays, seasons and festivals. Everything here is a pure function of the date, so it is the same for
// everyone, needs no saved state and simply follows the clock (also when it goes backwards).
//
// Seasons (milestone B3, the owner's choice): ONE SEASON PER REAL WEEK. Weeks start on Monday; spring,
// summer, autumn and winter take turns week by week. Each season has its festival from Friday to Sunday of
// its week: the Spring Planting Fair, the Summer Beach Day, the Harvest Fair and Lantern Night. The
// Fishing Derby keeps the first Saturday of every month and the Sunday after (it wins on its days), birthdays keep their dates.

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
 * Festivals: derby (the first Saturday of every month and the Sunday after, fishing at the pier), and each season's festival on
 * Friday, Saturday and Sunday of its week: plant (spring planting fair in the square), beach (summer beach
 * day), fair (harvest fair, autumn) and lanterns (lantern night by the lighthouse, winter).
 */
export function festivalOn(ms = now()) {
  const d = new Date(ms);
  const day = d.getDate(), dow = d.getDay();
  // the first Saturday of the month and the Sunday after it (never two derbies in one month)
  if ((dow === 6 && day <= 7) || (dow === 0 && day >= 2 && day <= 8)) return 'derby';
  if (dow === 5 || dow === 6 || dow === 0) return SEASON_FEST[seasonOf(ms)];
  return null;
}

/** The plain rain of a date (about one day in five, never on a festival day), before the rare events. */
function baseRain(ms) {
  if (festivalOn(ms)) return false;
  return dayRand(`rain:${dayKey(ms)}`) < 0.2;
}

/** Rain on about one day in five, never on a festival day (a storm or a rainbow day is a rainy day too). */
export function rainyOn(ms = now()) {
  if (baseRain(ms)) return true;
  const r = rareEventOn(ms);
  return r === 'storm' || r === 'rainbow';
}

/**
 * The daily surprise of a date (surprise.js shows them), or null: ~17% meteor shower (not on rainy days), 17%
 * merchant, 15% balloon, 17% bottle. The owner's budget (one special thing a day): never on a festival day.
 */
export function surpriseOn(ms = now()) {
  if (festivalOn(ms)) return null;
  const r = dayRand(`surprise:${dayKey(ms)}`);
  if (r < 0.17) return baseRain(ms) ? null : 'meteor';
  if (r < 0.34) return 'merchant';
  if (r < 0.49) return 'balloon';
  if (r < 0.66) return 'bottle';
  return null;
}

/** Noon of a day index (local calendar). */
export const dayMs = (di) => new Date(1970, 0, 1 + di, 12).getTime();

/**
 * Rare weather events (events.js): a storm that washes treasure and stranded crabs ashore, fog that brings a
 * ghost ship at night, a rainbow that ends at a dig spot. At most one a week (in about nine weeks in ten), on a
 * Monday to Thursday that has no festival and no daily surprise (one special thing a day), so never two days in
 * a row. Never the same kind two weeks running; no rainbows in winter (it snows).
 */
export function rareEventOn(ms = now()) {
  const di = dayIndex(ms), w = Math.floor((di - 4) / 7);
  return rareDayOfWeek(w) === di ? rareKind(w) : null;
}

const rareCache = new Map();
/** The day index of week w's rare event, or null. */
export function rareDayOfWeek(w) {
  if (rareCache.has(w)) return rareCache.get(w);
  let out = null;
  if (dayRand(`rare:${w}`) < 0.9) {
    const free = [];
    for (let k = 0; k < 4; k++) { const d = w * 7 + 4 + k, t = dayMs(d); if (!festivalOn(t) && !surpriseOn(t)) free.push(d); }
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

/** A day with no festival, no daily surprise and no rare event (a drama's big moment waits for one). */
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
