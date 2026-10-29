// Solo island save and real-time clock.
// The island lives in roster.progress.island of the active solo profile (one save per profile).
// Time is the real clock (Date.now), so crops grow while nobody plays. Tests can shift the clock with
// window.__islandTimeOffset (milliseconds). Everything that compares times is robust to the clock
// going backwards: elapsed time is never negative and "once per hour" limits simply reset.

export const MIN = 60 * 1000;
export const HOUR = 60 * MIN;

/** The island's "now" in ms (real clock plus the test offset). */
export function now() {
  const off = (typeof window !== 'undefined' && Number(window.__islandTimeOffset)) || 0;
  return Date.now() + off;
}

/** Hour of the day as a float (0..24) in the player's local time zone. */
export function hourOf(ms = now()) {
  const d = new Date(ms);
  return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
}

/** True if at least `ms` has passed since `then` (or the clock went backwards past it). */
export function since(then, ms, at = now()) {
  if (!then) return true;
  return at - then >= ms || at < then;
}

export function freshIsland() {
  return {
    v: 1,
    intro: false, // Aunt Hazel's welcome (gives the tools)
    tut: 0, // tutorial step (see TUTORIAL in island.js)
    coins: 30,
    inv: [],
    sel: 0,
    tiles: {}, // "c,r": { s: 'till', crop, growth, wetUntil, last }
    weeds: null, // list of field tiles that still have weeds (filled on first build)
    npcs: {}, // id: { pts, talkAt, giftAt, ev: n, q: n (quests done), met }
    quests: {}, // npc id: { id, started } for the active quest
    unlocks: { bridgeWood: 0, bridge: false, mineHits: 0, mine: false, burrow: false },
    branches: {}, // branch spot index: taken-at ms
    found: {}, // quest items picked up
    rewards: {}, // game rewards already sent by mail
    mail: [], // unread letters: { from, key, vars, items: [{ id, n }], deco: [] }
    deco: {}, // decorations shown around the house
    stats: { harvested: 0, shipped: 0, earned: 0 },
    last: { place: null },
  };
}

/** Load (or create) the island save of the active profile, filling in fields a newer version added. */
export function loadIsland(roster) {
  const p = roster.progress;
  if (!p.island || typeof p.island !== 'object') p.island = freshIsland();
  const s = p.island;
  const f = freshIsland();
  for (const k of Object.keys(f)) if (s[k] === undefined) s[k] = f[k];
  for (const k of Object.keys(f.unlocks)) if (s.unlocks[k] === undefined) s.unlocks[k] = f.unlocks[k];
  for (const k of Object.keys(f.stats)) if (s.stats[k] === undefined) s.stats[k] = f.stats[k];
  return s;
}

// ---------- inventory ----------

export function count(save, id) {
  return save.inv.find((it) => it.id === id)?.n || 0;
}

export function give(save, id, n = 1) {
  const it = save.inv.find((x) => x.id === id);
  if (it) it.n += n;
  else save.inv.push({ id, n });
}

/** Take n of an item; returns false (and takes nothing) if there are not enough. Tools never run out. */
export function take(save, id, n = 1) {
  const i = save.inv.findIndex((x) => x.id === id);
  if (i < 0 || save.inv[i].n < n) return false;
  save.inv[i].n -= n;
  if (save.inv[i].n <= 0) {
    save.inv.splice(i, 1);
    if (save.sel >= save.inv.length) save.sel = Math.max(0, save.inv.length - 1);
  }
  return true;
}
