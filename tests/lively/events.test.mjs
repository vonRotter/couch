// Part 3: rare weather events (storm, fog and the ghost ship, rainbow) and the seasonal mystery chain.
import { open, close, startIsland, island, sim, at, setTime, test, assert, done, shot, dismiss, DAY } from './helper.mjs';

const page = await open();
const D0 = at(2026, 11, 16, 12); // Monday 16 November 2026
const closeBoard = () => island(page, (I) => { if (I.mode === 'today') { I.hud.setPanel(null); I.mode = 'walk'; } });
const cal = (fn, arg) => page.evaluate(async ([src, arg]) => { const C = await import('/src/scenes/solo/calendar.js'); return (0, eval)(`(${src})`)(C, arg); }, [String(fn), arg]);

await test('rare events over a simulated year: about once a week, never two days in a row, never with a festival or a surprise', async () => {
  const r = await cal((C, t0) => {
    const d0 = C.dayIndex(t0), days = [];
    for (let d = d0; d < d0 + 364; d++) { const ms = C.dayMs(d), k = C.rareEventOn(ms); if (k) days.push({ d, k, fest: C.festivalOn(ms), sur: C.surpriseOn(ms) }); }
    const consec = days.filter((x, i) => i && x.d - days[i - 1].d === 1).length;
    const kinds = {}; for (const x of days) kinds[x.k] = (kinds[x.k] || 0) + 1;
    const sameKindRun = days.filter((x, i) => i && x.k === days[i - 1].k).length;
    const clash = days.filter((x) => x.fest || x.sur).length;
    const winterRainbow = days.filter((x) => x.k === 'rainbow' && C.seasonOf(C.dayMs(x.d)) === 'winter').length;
    return { n: days.length, perWeek: +(days.length / 52).toFixed(2), consec, clash, kinds, sameKindRun, winterRainbow };
  }, D0);
  console.log('   rare events in a year:', JSON.stringify(r));
  assert(r.perWeek >= 0.7 && r.perWeek <= 1.1, `per week ${r.perWeek}`);
  assert(r.consec === 0 && r.clash === 0 && r.sameKindRun === 0 && r.winterRainbow === 0, JSON.stringify(r));
});

/** The next day (from D0) with a rare event of a kind, as ms at hour h. */
const nextRare = (kind, h) => cal((C, [t0, kind, h]) => { const d0 = C.dayIndex(t0); for (let d = d0; d < d0 + 120; d++) if (C.rareEventOn(C.dayMs(d)) === kind) return C.dayMs(d) + (h - 12) * 3600e3; return null; }, [D0, kind, h]);

await test('storm: finds on the beach and stranded crabs to carry back (not the day\'s crab job)', async () => {
  const ms = await nextRare('storm', 10);
  await startIsland(page, { time: ms });
  await closeBoard();
  const items = await island(page, (I, S) => S.todayBoard.items.map((i) => i.k));
  assert(items.includes('td.ev.storm'), items.join());
  const st = await island(page, (I) => ({ finds: I.events.finds.filter((f) => f.g.visible).length, crabs: I.events.crabs.filter((c) => c.g.visible).length, rain: I.seasons.rainy }));
  assert(st.finds === 3 && st.crabs === 2, JSON.stringify(st));
  await island(page, (I) => { I.player.x = 12; I.player.z = 38; I.groundCheck(I.player, I.walkState); });
  await sim(page, 0.3);
  await shot(page, 'lively-storm-beach');
  const crabJob = await island(page, (I, S) => JSON.stringify(S.crabs?.today || S.crabDay || null));
  const r = await island(page, (I, S) => { const c = I.events.crabs[0]; I.player.x = c.x + 0.5; I.player.z = c.z; const ia = I.interactions(); const txt = ia.b?.text; ia.b?.fn(); const f = I.events.finds[0]; I.player.x = f.x + 0.4; I.player.z = f.z; const ib = I.interactions(); ib.b?.fn(); return { txt, ev: S.events }; });
  await sim(page, 2);
  assert(r.ev.crabs.length === 1 && r.ev.finds.length === 1, JSON.stringify(r));
  const crabJob2 = await island(page, (I, S) => JSON.stringify(S.crabs?.today || S.crabDay || null));
  assert(crabJob === crabJob2, 'the crab job is untouched');
});

await test('fog: thick fog, and at night a ghost ship with a friendly captain', async () => {
  const ms = await nextRare('fog', 21);
  await startIsland(page, { time: ms });
  await closeBoard();
  await sim(page, 3);
  const st = await island(page, (I, S) => ({ items: S.todayBoard.items.map((i) => i.k), ship: I.events.ship.visible, far: I.scene.fog.far }));
  assert(st.items.includes('td.ev.fog') && st.ship && st.far < 80, JSON.stringify(st));
  await island(page, (I) => { I.player.x = -15.2; I.player.z = 39.2; I.groundCheck(I.player, I.walkState); });
  await sim(page, 0.4);
  await shot(page, 'lively-ghost-ship');
  const r = await island(page, (I) => { const ia = I.interactions(); const txt = ia.b?.text; ia.b?.fn(); return { txt, mode: I.mode, speaker: I.dlg?.lines[0].speaker }; });
  assert(/ghost/.test(r.txt) && r.speaker === 'isl.wisp', JSON.stringify(r));
  const coins = await island(page, (I, S) => S.coins);
  await dismiss(page, 6);
  assert(await island(page, (I, S) => S.coins) === coins + 40, 'gift');
  // in the day: no ship
  await setTime(page, ms - 9 * 3600e3);
  await sim(page, 1.2);
  assert(!(await island(page, (I) => I.events.ship.visible)), 'no ship by day');
});

await test('rainbow: rain in the morning, a rainbow and a dig spot in the afternoon', async () => {
  const ms = await nextRare('rainbow', 10);
  await startIsland(page, { time: ms });
  await closeBoard();
  const morning = await island(page, (I) => ({ rain: I.seasons.rainy, rb: I.events.rainbow.visible }));
  assert(morning.rain && !morning.rb, JSON.stringify(morning));
  await setTime(page, ms + 4 * 3600e3);
  await sim(page, 1.5);
  const aft = await island(page, (I) => ({ rain: I.seasons.rainy, rb: I.events.rainbow.visible, dig: I.events.dig.visible, at: I.events.digAt }));
  assert(!aft.rain && aft.rb && aft.dig, JSON.stringify(aft));
  await island(page, (I) => { const e = I.events.digAt; I.player.x = e.x + 0.6; I.player.z = e.z + 0.6; I.groundCheck(I.player, I.walkState); });
  await sim(page, 0.4);
  await shot(page, 'lively-rainbow');
  const got = await island(page, (I, S) => { const c = S.coins; const ia = I.interactions(); ia.b?.fn(); return S.coins - c; });
  assert(got === 70, `coins ${got}`);
});

await test('mystery: Hoot\'s torn page -> dig for the key -> the old door\'s lock -> the chest', async () => {
  await startIsland(page, { time: D0 + 2 * DAY, save: (S) => { S.npcs.hoot = { pts: 20, talkAt: 0, giftAt: 0, ev: 0, q: 0, met: true }; } });
  await closeBoard();
  assert(await island(page, (I) => I.hasNews('hoot')), 'Hoot has news');
  await island(page, (I) => { const n = I.npc('hoot'); n.sleep = false; I.player.x = n.x + 1; I.player.z = n.z; I.talkTo(n); });
  await dismiss(page, 3);
  assert(await island(page, (I) => I.mode) === 'mystery', 'the torn page');
  await shot(page, 'lively-mystery-page');
  await dismiss(page, 2);
  const code = await island(page, (I, S) => ({ step: S.mystery.step, code: I.events.code, key: I.events.keyAt }));
  assert(code.step === 1, JSON.stringify(code));
  // dig at the X
  await island(page, (I) => { const k = I.events.keyAt; I.player.x = k.x + 0.5; I.player.z = k.z + 0.5; I.groundCheck(I.player, I.walkState); const ia = I.interactions(); ia.b.fn(); });
  assert(await island(page, (I, S) => S.mystery.step) === 2, 'got the key');
  // the door: a wrong code first, then the right one
  await island(page, (I) => { I.player.x = -12; I.player.z = I.events.door.position.z + 1.4; I.groundCheck(I.player, I.walkState); const ia = I.interactions(); ia.b.fn(); });
  assert(await island(page, (I) => I.mode) === 'mystery', 'the lock');
  const SYM = ['🐟', '⭐', '🌸', '🐚'];
  const putIn = async (sym) => island(page, (I, S, G, i) => { const L = I.events.panel; L.pick = i; L.t = 1; I.events.updatePanel({ aPressed: true }, 0.01); }, SYM.indexOf(sym));
  const wrong = code.code.map((s) => SYM[(SYM.indexOf(s) + 1) % 4]);
  for (const s of wrong) await putIn(s);
  assert(await island(page, (I, S) => S.mystery.step) === 2, 'still locked');
  await shot(page, 'lively-mystery-lock');
  for (const s of code.code) await putIn(s);
  assert(await island(page, (I, S) => S.mystery.step) === 3, 'open');
  const r = await island(page, (I, S) => { const c = S.coins; const ia = I.interactions(); ia.b.fn(); return { coins: S.coins - c, step: S.mystery.step, done: S.mystery.done }; });
  assert(r.coins === 80 && r.step === 4, JSON.stringify(r));
  // not again this week, nor for this season's next week
  assert(!(await island(page, (I) => I.hasNews('hoot'))), 'no news now');
  const later = await island(page, (I) => [1, 2, 3, 4, 8].map((w) => I.events.chapterOpen(Date.now() + window.__islandTimeOffset + w * 7 * 86400000)));
  assert(JSON.stringify(later) === JSON.stringify([true, true, true, false, true]), JSON.stringify(later));
});

await test('no console errors', async () => { assert(!page.errors.length, page.errors.join('\n')); });
await close(page);
done();
