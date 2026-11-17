// Saving a coming event for later (lock.js): the journal's Coming up tab and the Today board, one lock at a time,
// late play 1-3 days after for festivals, warned rare events and visitors, priority over that day's own thing with
// the one-special-thing budget intact, expiry, the already-visited case and old saves.
import { open, close, startIsland, island, sim, at, setTime, test, assert, done, shot, press } from './helper.mjs';

const page = await open();
const D0 = at(2026, 11, 17, 10); // Tuesday 17 November 2026
const closeBoard = () => island(page, (I) => { if (I.mode === 'today') { I.hud.setPanel(null); I.mode = 'walk'; } });
const cal = (fn, arg) => page.evaluate(async ([src, arg]) => { const C = await import('/src/scenes/solo/calendar.js'); return (0, eval)(`(${src})`)(C, arg); }, [String(fn), arg]);
const toDay = async (di, h = 10) => { const ms = await cal((C, [di, h]) => C.dayMs(di) + (h - 12) * 3600e3, [di, h]); await setTime(page, ms); await sim(page, 1.5, 0.1); };
const di0 = await cal((C, t) => C.dayIndex(t), D0);
/** The effective special things today (what the island shows). */
const specials = () => island(page, (I, S) => {
  const V = S.village, di = Math.round((new Date(S.todayBoard.day + 'T12:00').getTime() - new Date(1970, 0, 1, 12).getTime()) / 86400000);
  return { fest: I.seasons.festival, sur: I.surprise.kind, rare: I.events.kind, climax: !!(V?.drama && V.drama.climax === di), items: S.todayBoard.items.map((i) => i.k), lockPlay: S.lockPlay, lock: S.lock, note: S.lockNote };
});
const count = (s) => (s.fest ? 1 : 0) + (s.sur ? 1 : 0) + (s.rare ? 1 : 0) + (s.climax ? 1 : 0);

await test('Coming up (journal): festivals ahead; [OK] locks with a lock icon, [C] closes and never locks', async () => {
  await startIsland(page, { time: D0 });
  await closeBoard();
  await island(page, (I) => I.journal.open('coming'));
  await sim(page, 0.4);
  // [C] (Q) closes the journal: nothing is locked
  await press(page, 'KeyQ');
  assert(!(await island(page, (I, S) => S.lock)) && await island(page, (I) => I.mode) === 'walk', 'Q never locks');
  await island(page, (I) => I.journal.open('coming'));
  await sim(page, 0.4);
  const list = await island(page, (I) => I.lock.coming());
  assert(list.length >= 1 && list[0].kind === 'fest', JSON.stringify(list));
  await press(page, 'KeyE');
  const r = await island(page, (I, S) => ({ lock: S.lock, txt: I.hud.panel.innerText }));
  assert(r.lock && r.lock.kind === 'fest' && r.txt.includes('🔒'), JSON.stringify(r));
  await shot(page, 'lively-lock-coming-up');
  const said = await page.evaluate(() => window.game.voiceLog.slice(-3).map((e) => e.text).join(' | '));
  assert(/Saved for you/.test(said), said);
});

await test('one lock at a time: locking another moves it (and says so)', async () => {
  const r = await island(page, (I, S) => {
    const first = { ...S.lock };
    const other = { kind: 'vis', what: 'merchant', day: first.day + 1, last: first.day + 1 };
    const res = I.lock.lock(other);
    return { res, lock: S.lock, first };
  });
  assert(r.res === 'moved' && r.lock.kind === 'vis' && r.lock.day === r.first.day + 1, JSON.stringify(r));
  const said = await page.evaluate(() => window.game.voiceLog.slice(-1)[0]?.text || '');
  assert(/moved/.test(said), said);
});

await test('Today board: a warning about tomorrow\'s rare event (or a visitor\'s letter) can be locked with [OK]', async () => {
  await startIsland(page, { time: D0, name: 'Board' });
  // walk the days until the board warns about tomorrow's rare event
  let found = null, warned = 0, rares = 0;
  for (let d = 0; d < 21 && !found; d++) {
    await toDay(di0 + d, 9);
    const r = await island(page, (I, S) => ({ items: S.todayBoard.items.map((i) => i.k), mode: I.mode, offer: I.todayBoard.offer || null }));
    if (r.items.some((k) => k.startsWith('td.ev.r.'))) { warned++; if (r.offer) found = r; }
    if (!found) await closeBoard();
  }
  assert(found && found.offer.kind === 'rare' && found.mode === 'today', JSON.stringify(found));
  await shot(page, 'lively-lock-today-board');
  // [C] closes without locking... (a second board for the test: open it again)
  await island(page, (I) => { I.todayBoard.open(); I.todayBoard.t = 1; I.todayBoard.updateBoard({ bPressed: true }); });
  assert(!(await island(page, (I, S) => S.lock)), '[BACK] never locks');
  await island(page, (I) => { I.todayBoard.open(); I.todayBoard.t = 1; I.todayBoard.updateBoard({ aPressed: true }); });
  const lock = await island(page, (I, S) => S.lock);
  assert(lock && lock.kind === 'rare' && lock.what === found.offer.what, JSON.stringify(lock));
  // a visitor's letter on the board is offered too
  const vis = await island(page, (I, S) => { const di = I.lock.coming()[0] ? 0 : 0; const today = Math.round((new Date(S.todayBoard.day + 'T12:00').getTime() - new Date(1970, 0, 1, 12).getTime()) / 86400000); S.hook = { kind: 'letter', who: 'balloon', made: today, due: today + 3 }; S.todayBoard.items.push({ kind: 'visitor', icon: '✉️', k: 'td.lk.letter.balloon', v: {} }); S.todayBoard.items = S.todayBoard.items.filter((i) => !i.k.startsWith('td.ev.r.')); return I.lock.boardOffer(); });
  assert(vis && vis.kind === 'vis' && vis.what === 'balloon', JSON.stringify(vis));
});

/** Lock an entry, skip its days, come back k days after: what plays. */
async function latePlay(entry, k, name, h = 10) {
  await startIsland(page, { time: D0, name });
  await closeBoard();
  await island(page, (I, S, G, e) => { I.lock.lock(e); }, entry);
  await toDay(entry.last + k, h);
  return specials();
}

await test('late play: a festival weekend you missed plays 1, 2 or 3 days after', async () => {
  const fest = await cal((C, di) => { for (let d = di + 1; d < di + 40; d++) if (C.festivalOn(C.dayMs(d)) && !C.festivalOn(C.dayMs(d - 1))) return { kind: 'fest', what: C.festivalOn(C.dayMs(d)), day: d, last: d + 1 }; return null; }, di0);
  for (const k of [1, 2, 3]) {
    const s = await latePlay(fest, k, `Fest${k}`);
    assert(s.fest === fest.what && s.lockPlay?.kind === 'fest' && s.items.includes('lk.late') && count(s) === 1, `day ${k}: ${JSON.stringify(s)}`);
    if (k === 1) await shot(page, 'lively-lock-late-festival');
  }
});

await test('late play: a warned rare event (storm, fog, rainbow) plays late, with its finds, ship or rainbow', async () => {
  for (const [kind, k, h] of [['storm', 1, 10], ['fog', 2, 21], ['rainbow', 3, 14]]) {
    const e = await cal((C, [di, kind]) => { for (let d = di + 1; d < di + 60; d++) if (C.rareEventOn(C.dayMs(d)) === kind && !C.festivalOn(C.dayMs(d + 1)) && !C.festivalOn(C.dayMs(d + 2)) && !C.festivalOn(C.dayMs(d + 3))) return { kind: 'rare', what: kind, day: d, last: d }; return null; }, [di0, kind]);
    const s = await latePlay(e, k, `Rare${kind}`, h);
    const shown = await island(page, (I) => ({ finds: I.events.finds.filter((f) => f.g.visible).length, ship: I.events.ship.visible, rainbow: I.events.rainbow.visible }));
    const ok = kind === 'storm' ? shown.finds === 3 : kind === 'fog' ? shown.ship : shown.rainbow;
    assert(s.rare === kind && count(s) === 1 && ok, `${kind}: ${JSON.stringify({ s, shown })}`);
  }
});

await test('late play: a visitor announced by letter comes late (Marlo, Skye)', async () => {
  for (const [who, k] of [['merchant', 1], ['balloon', 2]]) {
    const e = await cal((C, [di, who]) => { for (let d = di + 1; d < di + 60; d++) if (C.surpriseOn(C.dayMs(d)) === who && !C.festivalOn(C.dayMs(d + 1)) && !C.festivalOn(C.dayMs(d + 2))) return { kind: 'vis', what: who, day: d, last: d }; return null; }, [di0, who]);
    const s = await latePlay(e, k, `Vis${who}`, 12);
    const shown = await island(page, (I) => ({ cart: I.surprise.cart.visible, balloon: I.surprise.balloon.visible }));
    assert(s.sur === who && count(s) === 1 && (who === 'merchant' ? shown.cart : shown.balloon), `${who}: ${JSON.stringify({ s, shown })}`);
  }
});

await test('priority: the late play replaces that day\'s own surprise or rare event, and a drama\'s big moment moves on', async () => {
  // a late day that has its own surprise (or rare event)
  const p = await cal((C, di) => {
    for (let d = di + 1; d < di + 80; d++) {
      const f = C.festivalOn(C.dayMs(d));
      if (!f || C.festivalOn(C.dayMs(d - 1))) continue;
      const late = d + 2; // the Monday after the weekend
      if (C.surpriseOn(C.dayMs(late)) || C.rareEventOn(C.dayMs(late))) return { e: { kind: 'fest', what: f, day: d, last: d + 1 }, late, own: C.surpriseOn(C.dayMs(late)) || C.rareEventOn(C.dayMs(late)) };
    }
    return null;
  }, di0);
  await startIsland(page, { time: D0, name: 'Prio' });
  await closeBoard();
  await island(page, (I, S, G, p) => { I.lock.lock(p.e); S.village.drama = { id: 'cake', start: p.late - 4, climax: p.late, told: {}, side: null, fish: 0, water: [], flavor: null, res: null }; }, p);
  await toDay(p.late, 11);
  const s = await specials();
  const climax = await island(page, (I, S) => S.village.drama?.climax);
  assert(s.fest === p.e.what && !s.sur && !s.rare && count(s) === 1, JSON.stringify({ p, s }));
  assert(climax > p.late, `climax moved: ${climax} vs ${p.late}`);
  // the calendar is back to normal the next day, and other days were never changed
  const next = await cal((C, d) => C.festivalOn(C.dayMs(d)), p.late);
  assert(next === null, 'the late play only changes the island of this profile, that day');
});

await test('expiry: unplayed for three days, the lock ends with a gentle note', async () => {
  const fest = await cal((C, di) => { for (let d = di + 1; d < di + 40; d++) if (C.festivalOn(C.dayMs(d)) && !C.festivalOn(C.dayMs(d - 1))) return { kind: 'fest', what: C.festivalOn(C.dayMs(d)), day: d, last: d + 1 }; return null; }, di0);
  const s = await latePlay(fest, 4, 'Expire');
  assert(!s.lock && !s.lockPlay && s.note?.note === 'expired' && s.items.includes('lk.expired') && s.fest !== fest.what, JSON.stringify(s));
});

await test('already visited on the day: the lock is used up, no replay', async () => {
  const fest = await cal((C, di) => { for (let d = di + 1; d < di + 40; d++) if (C.festivalOn(C.dayMs(d)) && !C.festivalOn(C.dayMs(d - 1))) return { kind: 'fest', what: C.festivalOn(C.dayMs(d)), day: d, last: d + 1 }; return null; }, di0);
  await startIsland(page, { time: D0, name: 'Visited' });
  await closeBoard();
  await island(page, (I, S, G, e) => I.lock.lock(e), fest);
  await toDay(fest.day, 11);
  const onDay = await specials();
  assert(onDay.fest === fest.what && !onDay.lock && onDay.note?.note === 'used', JSON.stringify(onDay));
  await toDay(fest.last + 1, 11);
  const after = await specials();
  assert(!after.lockPlay && after.fest !== fest.what, JSON.stringify(after));
});

await test('old save: no lock fields, the Coming up tab and a new day work', async () => {
  await startIsland(page, { time: D0, name: 'OldLock', raw: { v: 1, intro: true, tut: 8, coins: 50, inv: [{ id: 'zipzap', n: 1, slot: 0 }], invV: 2, npcs: {}, quests: {}, unlocks: { bridgeWood: 0, bridge: false, mineHits: 0, mine: false, burrow: false, rockBuster: false }, mail: [], deco: {}, tiles: {}, sea: {}, cafe: {} } });
  await closeBoard();
  await island(page, (I) => I.journal.open('coming'));
  await sim(page, 0.3);
  await island(page, (I) => I.journal.close());
  await toDay(di0 + 1, 10);
  const r = await island(page, (I, S) => ({ lock: S.lock ?? null, play: S.lockPlay ?? null }));
  assert(r.lock === null && r.play === null, JSON.stringify(r));
});

await test('no console errors', async () => { assert(!page.errors.length, page.errors.join('\n')); });
await close(page);
done();
