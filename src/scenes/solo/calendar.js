import { now } from './save.js';

// The island calendar, from the real date: rainy days (a deterministic daily seed, the same for everyone),
// birthdays, and small seasonal festivals. Everything here is a pure function of the date.

/** Local date key "YYYY-MM-DD". */
export function dayKey(ms = now()) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

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
 * Festivals: derby (first weekend of every month, fishing at the pier), fair (harvest fair, the 15th-17th
 * of September, October and November), lanterns (lantern night by the lighthouse, all December and
 * midsummer, June 20-24, in the evening).
 */
export function festivalOn(ms = now()) {
  const d = new Date(ms);
  const m = d.getMonth() + 1, day = d.getDate(), dow = d.getDay();
  if (day <= 7 && (dow === 6 || dow === 0)) return 'derby';
  if ([9, 10, 11].includes(m) && day >= 15 && day <= 17) return 'fair';
  if (m === 12 || (m === 6 && day >= 20 && day <= 24)) return 'lanterns';
  return null;
}

/** Rain on about one day in five, never on a festival day. */
export function rainyOn(ms = now()) {
  if (festivalOn(ms)) return false;
  return dayRand(`rain:${dayKey(ms)}`) < 0.2;
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
    out.push({ day: i, festival: festivalOn(t), rain: rainyOn(t), bday, today: i === d.getDate() });
  }
  return { first, days: out, month: m, year: y };
}
