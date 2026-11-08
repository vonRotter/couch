import { soloSaveKey } from './profiles.js';
import { t, addStrings } from './i18n.js';

// Rewards for playing together. Every player who joined the shared (co-op) island as a profile gets
// something back on their own island when a co-op game is finished (the results screen, not ending it
// from the pause menu):
// - coins: COOP_COINS for each game, once per game per real day (so playing the same game ten times
//   in a row is not ten rewards, but trying a different game is);
// - a badge the first time they finish a game together (shown on the Party Pier board by the ferry),
//   and a decoration for their yard at 3 and 10 badges.
// Guests get nothing (they have no island). Rewards are written into the profile's own solo save
// (progress.coop) and arrive as one letter per day from Grumbleton, the harbor master, the next time
// that child is on their island (island.js takes them out with takeCoopMail).

export const COOP_COINS = 15;
export const BADGE_DECOS = { 3: 'coopPennants', 10: 'coopTrophy' };

addStrings({
  en: {
    'coop.toast': 'A gift for playing together is on its way to {names}!',
    'coop.and': '{a} and {b}',
  },
  no: {
    'coop.toast': 'En gave for å spille sammen er på vei til {names}!',
    'coop.and': '{a} og {b}',
  },
});

/** Today's date (the player's local day, with the island's test clock offset) as YYYY-MM-DD. */
export function today() {
  const off = (typeof window !== 'undefined' && Number(window.__islandTimeOffset)) || 0;
  const d = new Date(Date.now() + off);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** The co-op record in a profile's progress: { badges: { key: day }, days: { key: day }, pending: [letter] }. */
export function coopRecord(progress) {
  const c = progress.coop && typeof progress.coop === 'object' ? progress.coop : (progress.coop = {});
  c.badges ||= {};
  c.days ||= {};
  c.pending ||= [];
  return c;
}

/**
 * A profile finished the co-op game `key`: coins (once per game per day), a badge (first time) and maybe a
 * decoration. Writes the profile's own save without switching to it. Returns what was given, or null.
 */
export function coopReward(roster, profileId, key) {
  let out = null;
  roster.editSave(soloSaveKey(profileId), (progress) => {
    const c = coopRecord(progress);
    const day = today();
    const coins = c.days[key] === day ? 0 : COOP_COINS;
    const badge = !c.badges[key];
    if (!coins && !badge) return;
    c.days[key] = day;
    if (badge) c.badges[key] = day;
    const deco = badge ? BADGE_DECOS[Object.keys(c.badges).length] || null : null;
    // one letter a day: today's letter grows until the child is home to read it
    let L = c.pending.find((x) => x.day === day);
    if (!L) { L = { day, games: [], badges: [], coins: 0, decos: [] }; c.pending.push(L); }
    if (!L.games.includes(key)) L.games.push(key);
    L.coins += coins;
    if (badge) L.badges.push(key);
    if (deco) L.decos.push(deco);
    out = { coins, badge, deco };
  });
  return out;
}

/** The letters waiting for a profile's island (taken out of progress.coop.pending). */
export function takeCoopMail(progress) {
  if (!progress.coop?.pending?.length) return [];
  const list = progress.coop.pending;
  progress.coop.pending = [];
  return list;
}

/** "Ola", "Ola and Kari", "Ola, Kari and Ida". */
export function nameList(names) {
  if (names.length < 2) return names[0] || '';
  return t('coop.and', { a: names.slice(0, -1).join(', '), b: names[names.length - 1] });
}
