import { ITEMS } from './items.js';
import { now, hourOf } from './save.js';
import { dayKey, dayRand, dayIndex, seasonOf } from './calendar.js';

// Crab friends (the owner's crab update), the pure part: no three.js, so the island, Shell Isle and the dive
// share it. Crabs, snow crabs and lobsters are never caught, sold or cooked any more: they are friends you
// help. Each real day ONE crab needs a hand in all (the owner's "fewer crabs"): its trouble and its place
// take turns by date (flipped on its back, tangled in seaweed or an old net, lost babies, a hermit crab who
// has outgrown its shell; on the main island, on Shell Isle or in the dive). Every crab you help counts for
// Crab Cove (it grows in levels), the museum's "Crab friends" wall and the Friends book, and can become a crab
// friend who follows you.

/** The crabs old saves may still carry: released kindly (with a thank-you and the coins they were worth). */
export const OLD_CRABS = { crab: 35, lobster: 90, snowCrab: 50 };

/** The museum's "Crab friends" wall: filled by helping (not by donating). kind -> museum id. */
export const MUSEUM_CRABS = ['crab', 'snowCrab', 'lobster', 'hermitCrab', 'babyCrab'];
export const MUSEUM_OF = { red: 'crab', snow: 'snowCrab', lobster: 'lobster', hermit: 'hermitCrab', baby: 'babyCrab' };

/** The ways to help: flip (on its back), free (tangled), home (lost babies), shell (a new shell for a hermit). */
export const HELP_TYPES = ['flip', 'free', 'home', 'shell'];

/** Hermit crabs who need a bigger shell, one by one (names are isl.crab.hermit.<id>). */
export const HERMITS = ['pebble', 'biscuit', 'noodle', 'dot', 'bubbles', 'sandy', 'coco', 'wiggle'];

/**
 * Big shells for hermit crabs. Found ones lie on the beach, in Shell Isle's tide pools and in the dive;
 * crafted ones come from the workbench (bag pieces, like sprinklers).
 */
export const SHELLS = {
  spiralShell: { found: true, sell: 25 },
  conchShell: { found: true, sell: 30 },
  castleShell: { need: [['seaShell', 1], ['stone', 2]] },
  teapotShell: { need: [['seaShell', 1], ['stone', 1], ['fiber', 1]] },
  lanternShell: { need: [['seaShell', 1], ['seaGlass', 1], ['wood', 1]] },
  flowerShell: { need: [['seaShell', 1], ['fiber', 1], ['bouquet', 1]] },
};
export const SHELL_IDS = Object.keys(SHELLS);
export const FOUND_SHELLS = SHELL_IDS.filter((id) => SHELLS[id].found);
export const CRAFT_SHELLS = SHELL_IDS.filter((id) => !SHELLS[id].found);
for (const id of FOUND_SHELLS) ITEMS[id] = { kind: 'shell', sell: SHELLS[id].sell };
export const isShell = (id) => SHELL_IDS.includes(id);

/**
 * Crab Cove grows with the number of crabs helped. Each level shows something new and gives a little reward.
 * One crab a day: level 1 on the first day, 2 after about four days, 3 after nine and 4 after sixteen
 * (it was 1 / 5 / 12 / 25 when up to eleven crabs a day needed a hand; saves keep the levels they reached).
 */
export const COVE_LEVELS = [
  { n: 0 },
  { n: 1, reward: { coins: 30 } }, // a sandcastle crab house and a crab family
  { n: 4, reward: { items: [['spiralShell', 1]], coins: 50 } }, // shell houses, flags, hermit crabs move in
  { n: 9, reward: { deco: 'crabStatue', coins: 80 } }, // the dance ring, shell lanterns, crab dances
  { n: 16, reward: { deco: 'crabPlush', coins: 150 } }, // the shell palace and the crab band
];
export function coveLevel(helped) {
  let lv = 0;
  for (let i = 0; i < COVE_LEVELS.length; i++) if (helped >= COVE_LEVELS[i].n) lv = i;
  return lv;
}

/**
 * Crab friends who can follow you (one at a time, chosen at the cove): ruby (a red crab), frost (a snow
 * crab), captain (a lobster), tiny (a baby crab), and every hermit crab you gave a shell.
 */
export const FRIEND_KIND = { ruby: 'red', frost: 'snow', captain: 'lobster', tiny: 'baby' };
export function friendKind(id) { return FRIEND_KIND[id] || 'hermit'; }

/** The save part (S.crabs), filled in for old saves. */
export function crabSave(S) {
  if (!S.crabs || typeof S.crabs !== 'object') S.crabs = {};
  const C = S.crabs;
  const def = { helped: 0, kinds: {}, done: { day: '', ids: [] }, hermits: {}, hermitAt: {}, friends: [], follower: null, level: 0, released: 0, digs: { day: '', n: 0 }, danced: '' };
  for (const [k, v] of Object.entries(def)) if (C[k] === undefined) C[k] = v;
  for (const t of HELP_TYPES) if (C.kinds[t] === undefined) C.kinds[t] = 0;
  return C;
}

/** Today's list of helped spots (resets when the day changes). */
export function doneToday(S, at = now()) {
  const C = crabSave(S), day = dayKey(at);
  if (C.done.day !== day) C.done = { day, ids: [] };
  return C.done.ids;
}

/**
 * Old saves: crabs, lobsters and snow crabs in the bag go home to the sea. Returns { n, coins } (0 if none).
 * Crab cakes become seaweed cakes (in the bag and on the specials board).
 */
export function releaseOldCrabs(S) {
  crabSave(S);
  let n = 0, coins = 0;
  for (const it of [...S.inv]) {
    if (OLD_CRABS[it.id] === undefined) continue;
    n += it.n;
    coins += it.n * OLD_CRABS[it.id];
    S.inv.splice(S.inv.indexOf(it), 1);
  }
  // cooked crab cakes become seaweed cakes, and the old seafood platter keeps its name
  const cake = S.inv.find((it) => it.id === 'crabCake');
  if (cake) {
    const sw = S.inv.find((it) => it.id === 'seaweedCake');
    if (sw) { sw.n += cake.n; S.inv.splice(S.inv.indexOf(cake), 1); } else cake.id = 'seaweedCake';
  }
  const sp = S.cafe?.specials;
  if (sp) for (let i = sp.length - 1; i >= 0; i--) if (sp[i] === 'crabCake') { if (sp.includes('seaweedCake')) sp.splice(i, 1); else sp[i] = 'seaweedCake'; }
  if (S.store) for (const id of Object.keys(OLD_CRABS)) delete S.store[id];
  if (n) S.crabs.released += n;
  return { n, coins };
}

/**
 * A crab was helped (on the island, Shell Isle or in the dive). Counts it, fills the museum's crab wall and
 * makes a crab friend. Returns { museum: id | null (newly on the wall), friend: id | null (new friend) }.
 */
export function crabHelped(S, kind, how, at = now()) {
  const C = crabSave(S);
  C.helped++;
  C.kinds[how] = (C.kinds[how] || 0) + 1;
  if (!S.museum) S.museum = { got: {}, steps: 0 };
  const mid = MUSEUM_OF[kind];
  let museum = null;
  if (mid && !S.museum.got[mid]) { S.museum.got[mid] = at; museum = mid; }
  const fid = Object.keys(FRIEND_KIND).find((f) => FRIEND_KIND[f] === kind);
  let friend = null;
  if (fid && !C.friends.includes(fid)) { C.friends.push(fid); friend = fid; }
  return { museum, friend };
}

/** A hermit crab got a new shell: it wears it from now on and becomes a crab friend. */
export function hermitHelped(S, hermit, shell, area = 'main', at = now()) {
  const C = crabSave(S);
  C.hermits[hermit] = shell;
  (C.hermitAt ||= {})[hermit] = `${area}:${dayKey(at)}`; // it stays there today to show off
  const r = crabHelped(S, 'hermit', 'shell', at);
  if (!C.friends.includes(hermit)) { C.friends.push(hermit); r.friend = hermit; }
  return r;
}

/** The next hermit crabs who still need a shell (in order). */
export function hermitsWaiting(S) {
  const C = crabSave(S);
  return HERMITS.filter((h) => !C.hermits[h]);
}

/**
 * Today's hermit crab in an area (main or isle): the one helped here today (it stays to show off its new
 * shell), else the next one who still needs a shell, else null.
 */
export function hermitFor(S, area, ms = now()) {
  const C = crabSave(S), day = dayKey(ms);
  const shown = Object.keys(C.hermitAt || {}).find((h) => C.hermitAt[h] === `${area}:${day}`);
  if (shown) return shown;
  const wait = hermitsWaiting(S);
  if (!wait.length) return null;
  return wait[dayIndex(ms) % wait.length];
}

// ---------- when: full moons and crab dances ----------

/** Moon phase 0..1 (0 new, 0.5 full) from a known new moon (2000-01-06 18:14 UTC). */
export function moonPhase(ms = now()) {
  const days = (ms - Date.UTC(2000, 0, 6, 18, 14)) / 86400000;
  const p = (days / 29.530588853) % 1;
  return p < 0 ? p + 1 : p;
}
/** The night of a full moon (the evening whose midnight is closest to the full moon). */
export function fullMoonOn(ms = now()) {
  const d = new Date(ms);
  const mid = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59).getTime();
  return Math.abs(moonPhase(mid) - 0.5) < 0.5 / 29.53;
}

/** Crab dances at Crab Cove (from cove level 3): weekend evenings 17-20, and full moon nights 19-23. */
export const DANCE_HOURS = { weekend: [17, 20], moon: [19, 23] };
export function crabDanceKind(ms = now()) {
  const d = new Date(ms), dow = d.getDay();
  if (fullMoonOn(ms)) return 'moon';
  if (dow === 6 || dow === 0) return 'weekend';
  return null;
}
export function crabDanceNow(ms = now()) {
  const k = crabDanceKind(ms);
  if (!k) return null;
  const h = hourOf(ms), [a, b] = DANCE_HOURS[k];
  return h >= a && h < b ? k : null;
}

// ---------- today's crab ----------

/** The kinds of trouble, in turn day by day (shell: a hermit crab who needs a bigger shell, on land only). */
export const DAY_TYPES = ['flip', 'free', 'home', 'shell'];
/** The places a crab can need a hand. */
export const CRAB_AREAS = ['main', 'isle', 'dive'];

/** Where today's crab can be: the main island, Shell Isle once you know the way (the sea chart), the dive with the suit. */
export function crabAreas(S) {
  const out = ['main'];
  if (S?.isle2?.chart) out.push('isle');
  if (S?.sea?.suit) out.push('dive');
  return out;
}

/**
 * The one crab who needs a hand on a day: { area, type }, a pure function of the date and the places you can
 * reach. The trouble turns every day (flip, free, home, shell) and the place with it, so that every trouble
 * comes to every place: in 12 days with all three places (8 with two). In the dive a shell day is a crab or
 * lobster caught in a net; when every hermit crab has its shell, a shell day is a flipped or tangled crab.
 */
export function crabOfDay(ms = now(), areas = CRAB_AREAS, hermitWaiting = true) {
  const d = dayIndex(ms), L = areas.length || 1;
  const area = areas[(((d + Math.floor(d / 4)) % L) + L) % L] || 'main';
  let type = DAY_TYPES[((d % 4) + 4) % 4];
  if (type === 'shell' && area === 'dive') type = 'free';
  else if (type === 'shell' && !hermitWaiting) type = Math.floor(d / 4) % 2 ? 'free' : 'flip';
  return { area, type };
}

/**
 * Today's crab for a save: { day, area, type }, kept in the save for the day (a place that opens during the
 * day does not move it). helped: it got its hand today.
 */
export function todaysCrab(S, ms = now()) {
  const C = crabSave(S), day = dayKey(ms);
  if (!C.today || C.today.day !== day) C.today = { day, ...crabOfDay(ms, crabAreas(S), hermitsWaiting(S).length > 0) };
  const id = `${C.today.area}-${C.today.type}`;
  const done = doneToday(S, ms);
  // (a save from before the update may have helped another crab today already: that one counts)
  const helped = done.includes(id) || done.some((x) => !x.includes('-find'));
  return { ...C.today, id, helped };
}

/**
 * The kind of crab in trouble (red, snow, lobster): a snow crab on land and on the sea floor in winter weeks,
 * and a lobster caught in the dive's nets.
 */
export function crabKindFor(area, type, ms = now()) {
  if (area === 'dive' && type === 'free') return 'lobster';
  return seasonOf(ms) === 'winter' ? 'snow' : 'red';
}

/** Night for crab friends: they wait at your cottage from 21:00 to 6:00. */
export const isCrabNight = (h = hourOf()) => h >= 21 || h < 6;

/**
 * Today's crab things in one area (main, isle or dive), a pure function of the day (and the save): the day's
 * one crab in trouble if it is here (todaysCrab: a flipped crab, a tangled one, a little family of lost
 * babies with their family spot, or a hermit crab), and shells to find (two on land, one in the dive).
 * spots: candidate points for that area; returns [{ id, type, kind, at, to?, style? }]. Without a save every
 * place counts as reachable.
 */
export function dailyCrabs(area, spots, ms = now(), S = null) {
  const day = dayKey(ms);
  const r = (k) => dayRand(`crab:${area}:${k}:${day}`);
  const order = spots.map((p, i) => ({ p, i, k: r(`spot${i}`) })).sort((a, b) => a.k - b.k).map((o) => o.p);
  const today = S ? todaysCrab(S, ms) : { ...crabOfDay(ms), helped: false };
  const here = today.area === area && (!today.helped || done(S, ms).includes(`${area}-${today.type}`)) ? today.type : null;
  const out = [];
  if (here === 'flip') out.push({ id: `${area}-flip`, type: 'flip', kind: crabKindFor(area, 'flip', ms), at: order[0] });
  if (here === 'free') out.push({ id: `${area}-free`, type: 'free', kind: crabKindFor(area, 'free', ms), at: order[1], style: area === 'dive' || r('style') < 0.5 ? 'net' : 'weed' });
  // the babies' family waits a good walk away, but not too far (the farthest spot within reach)
  const from = order[2];
  const rest = order.slice(3);
  const dist = (p) => Math.hypot(p.x - from.x, (p.z ?? p.y) - (from.z ?? from.y));
  const maxD = area === 'dive' ? 16 : 24;
  const ok = rest.filter((p) => dist(p) >= 5 && dist(p) <= maxD);
  const to = (ok.length ? ok : rest).reduce((a, b) => (ok.length ? dist(b) > dist(a) : dist(b) < dist(a)) ? b : a);
  if (here === 'home') out.push({ id: `${area}-home`, type: 'home', kind: 'baby', at: from, to, n: 3 });
  if (area !== 'dive') {
    const left = rest.filter((p) => p !== to);
    // a hermit crab who has outgrown its shell (the next one in line)
    const h = here === 'shell' && (S ? hermitFor(S, area, ms) : HERMITS[dayIndex(ms) % HERMITS.length]);
    if (h) out.push({ id: `${area}-shell`, type: 'shell', kind: 'hermit', hermit: h, at: left[0] });
    // two shells to find on the sand (one plain sea shell, one big shell)
    out.push({ id: `${area}-find0`, type: 'find', item: area === 'main' ? 'seaShell' : 'conchShell', at: left[1] });
    out.push({ id: `${area}-find1`, type: 'find', item: r('big') < 0.5 ? 'spiralShell' : 'conchShell', at: left[2] });
  } else {
    out.push({ id: 'dive-find0', type: 'find', item: r('big') < 0.5 ? 'conchShell' : 'spiralShell', at: order[order.length - 1] });
  }
  return out.filter((c) => c.at);
}

const done = (S, ms) => (S ? doneToday(S, ms) : []);
