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
    intro: false, // the welcome: Pip gives the Zip-Zap, Aunt Hazel the seeds
    tut: 0, // tutorial step (see TUTORIAL in island.js)
    coins: 30,
    inv: [], // stacks in the bag: { id, n, slot } (slots 0-8 are the hotbar, then the bag rows; see below)
    invV: 2, // inventory layout version (2: slots, bag rows and the cottage chest)
    bagRows: 2, // bag rows above the hotbar (Rosa sells a 3rd and a 4th)
    chest: [], // the storage chest in the cottage: { id, n, slot }
    sel: 0, // the selected hotbar slot (0-8)
    zz: { area: 0, speed: 0, range: 0, power: 0 }, // Pip's Zip-Zap upgrades (zipzap.js)
    tiles: {}, // "c,r": { s: 'till', crop, growth, wetUntil, last }
    weeds: null, // list of field tiles that still have weeds (filled on first build)
    npcs: {}, // id: { pts, talkAt, giftAt, ev: n, q: n (quests done), met }
    quests: {}, // npc id: { id, started } for the active quest
    unlocks: { bridgeWood: 0, bridge: false, mineHits: 0, mine: false, burrow: false, rockBuster: false },
    branches: {}, // branch spot index: taken-at ms
    found: {}, // quest items picked up
    rewards: {}, // game rewards already sent by mail
    mail: [], // unread letters: { from, key, vars, items: [{ id, n }], deco: [] }
    deco: {}, // decorations shown around the house
    stats: { harvested: 0, shipped: 0, earned: 0 },
    last: { place: null },
    // milestone B1: the sea and the café
    sea: { rod: false, suit: false, quest: 0, log: {}, caught: 0, dives: 0, haul: null },
    cafe: { repaired: false, wood: 0, served: 0, earned: 0, nights: 0, cooked: 0 },
  };
}

/** Load (or create) the island save of the active profile, filling in fields a newer version added. */
export function loadIsland(roster) {
  const p = roster.progress;
  if (!p.island || typeof p.island !== 'object') p.island = freshIsland();
  const s = p.island;
  const f = freshIsland();
  const oldInv = s.invV !== 2; // (checked before the new fields are filled in)
  for (const k of Object.keys(f)) if (s[k] === undefined) s[k] = f[k];
  for (const k of Object.keys(f.unlocks)) if (s.unlocks[k] === undefined) s.unlocks[k] = f.unlocks[k];
  for (const k of Object.keys(f.stats)) if (s.stats[k] === undefined) s.stats[k] = f.stats[k];
  for (const part of ['sea', 'cafe', 'zz']) {
    if (!s[part] || typeof s[part] !== 'object') s[part] = f[part];
    for (const k of Object.keys(f[part])) if (s[part][k] === undefined) s[part][k] = f[part][k];
  }
  // old saves: one list of things becomes the hotbar, the bag rows and the cottage chest; the old tools
  // become Pip's Zip-Zap. (A save made before this kept invV undefined.)
  if (oldInv) migrateInventory(s);
  fixSlots(s);
  return s;
}

// ---------- inventory ----------
// The bag is a list of stacks { id, n, slot }. Slots 0-8 are the hotbar (keys 1-9), slots 9 and up are the
// bag rows (9 per row, S.bagRows of them). The cottage chest (S.chest) holds stacks the same way. Most code
// only asks count / give / take; the bag panel (bagui.js) moves stacks between slots.

export const HOTBAR = 9;
export const ROW = 9;
export const CHEST_ROWS = 4;
/** The old tools: they all became Pip's Zip-Zap (the pickaxe also switched on its rock buster). */
export const OLD_TOOLS = ['hoe', 'can', 'scythe', 'pickaxe'];

export const bagSize = (S) => HOTBAR + ROW * Math.max(0, S.bagRows ?? 2);
export const chestSize = (S) => ROW * Math.max(CHEST_ROWS, Math.ceil(Math.max(0, ...(S.chest || []).map((it) => (it.slot ?? 0) + 1)) / ROW));

/** The first free slot in a list (from `from` up), or -1 if none below `size`. */
export function freeSlot(list, size, from = 0) {
  const used = new Set(list.map((it) => it.slot));
  for (let i = from; i < size; i++) if (!used.has(i)) return i;
  return -1;
}

/** Put a stack in the chest (it grows a row when it is full: nothing is ever lost). */
function toChest(S, id, n) {
  if (!S.chest) S.chest = [];
  const same = S.chest.find((x) => x.id === id);
  if (same) { same.n += n; return; }
  let slot = freeSlot(S.chest, chestSize(S));
  if (slot < 0) slot = chestSize(S);
  S.chest.push({ id, n, slot });
}

/**
 * Every stack needs its own slot in range (tests and old code may push stacks without one): give those the
 * first free slot, or send them to the chest when the bag is full. Also keeps the hotbar selection in 0-8.
 */
export function fixSlots(S) {
  const size = bagSize(S), seen = new Set();
  let moved = 0;
  for (const it of [...S.inv]) {
    if (Number.isInteger(it.slot) && it.slot >= 0 && it.slot < size && !seen.has(it.slot)) { seen.add(it.slot); continue; }
    it.slot = undefined;
  }
  for (const it of [...S.inv]) {
    if (it.slot !== undefined) continue;
    const slot = freeSlot(S.inv.filter((x) => x.slot !== undefined), size);
    if (slot >= 0) it.slot = slot;
    else { S.inv.splice(S.inv.indexOf(it), 1); toChest(S, it.id, it.n); moved++; }
  }
  if (!S.chest) S.chest = [];
  const cseen = new Set();
  for (const it of S.chest) {
    if (!Number.isInteger(it.slot) || it.slot < 0 || cseen.has(it.slot)) it.slot = freeSlot(S.chest.filter((x) => x !== it && Number.isInteger(x.slot)), 1e4);
    cseen.add(it.slot);
  }
  if (!(S.sel >= 0 && S.sel < HOTBAR)) S.sel = 0;
  if (moved) S.toChest = (S.toChest || 0) + moved;
  return moved;
}

/** Old saves (before the slots): tools become the Zip-Zap, the list fills hotbar, bag, then the chest. */
export function migrateInventory(S) {
  const old = Array.isArray(S.inv) ? S.inv.filter((it) => it && it.id && it.n > 0) : [];
  const selId = old[S.sel]?.id;
  const hadTools = old.some((it) => OLD_TOOLS.includes(it.id));
  if (old.some((it) => it.id === 'pickaxe') || (S.npcs?.bram?.q || 0) >= 1) S.unlocks.rockBuster = true;
  const list = [];
  for (const it of old) {
    if (OLD_TOOLS.includes(it.id)) { if (!list.some((x) => x.id === 'zipzap')) list.push({ id: 'zipzap', n: 1 }); continue; }
    const same = list.find((x) => x.id === it.id);
    if (same) same.n += it.n; else list.push({ id: it.id, n: it.n });
  }
  if (S.intro && !list.some((x) => x.id === 'zipzap')) list.unshift({ id: 'zipzap', n: 1 }); // the welcome was done
  S.inv = [];
  S.chest = Array.isArray(S.chest) ? S.chest : [];
  if (!S.bagRows) S.bagRows = 2;
  const size = bagSize(S);
  let over = 0;
  list.forEach((it, i) => { if (i < size) S.inv.push({ ...it, slot: i }); else { toChest(S, it.id, it.n); over++; } });
  const sel = S.inv.find((it) => it.id === (OLD_TOOLS.includes(selId) ? 'zipzap' : selId));
  S.sel = sel && sel.slot < HOTBAR ? sel.slot : 0;
  if (over) S.toChest = (S.toChest || 0) + over;
  // Pip writes a letter about the new gadget (only to friends who had the old tools)
  if (hadTools && S.intro) S.mail.push({ id: 'zipzap', from: 'pip' });
  S.invV = 2;
}

/** The stack in the selected hotbar slot, or null (empty hands). */
export function held(S) {
  return S.inv.find((it) => it.slot === S.sel) || null;
}

/** How many of an item are in the bag (all its stacks; the chest does not count). */
export function count(save, id) {
  let n = 0;
  for (const it of save.inv) if (it.id === id) n += it.n;
  return n;
}

/** In the bag or in the cottage chest? (For "have you found it already" checks.) */
export function owns(save, id) {
  return count(save, id) > 0 || !!save.chest?.some((it) => it.id === id && it.n > 0);
}

/**
 * Add n of an item: onto a stack already in the bag, else into the first free slot (hotbar first). A full
 * bag sends it to the cottage chest (S.toChest counts these for a toast). The old tools become the Zip-Zap.
 */
export function give(save, id, n = 1) {
  if (OLD_TOOLS.includes(id)) {
    if (id === 'pickaxe') save.unlocks.rockBuster = true;
    if (count(save, 'zipzap')) return 'bag';
    id = 'zipzap'; n = 1;
  }
  const it = save.inv.find((x) => x.id === id);
  if (it) { it.n += n; return 'bag'; }
  const slot = freeSlot(save.inv, bagSize(save));
  if (slot >= 0) { save.inv.push({ id, n, slot }); return 'bag'; }
  toChest(save, id, n);
  save.toChest = (save.toChest || 0) + 1;
  save.toChestId = id;
  return 'chest';
}

/** Take n of an item from the bag; returns false (and takes nothing) if there are not enough. */
export function take(save, id, n = 1) {
  if (count(save, id) < n) return false;
  let left = n;
  // smallest stacks first, so a stack in the hotbar stays where it is as long as possible
  const stacks = save.inv.filter((x) => x.id === id).sort((a, b) => a.n - b.n || b.slot - a.slot);
  for (const it of stacks) {
    const k = Math.min(left, it.n);
    it.n -= k;
    left -= k;
    if (it.n <= 0) save.inv.splice(save.inv.indexOf(it), 1);
    if (!left) break;
  }
  return true;
}
