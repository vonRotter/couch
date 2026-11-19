// The odd-adventure round, part 3: strange creatures, rare sightings. Old Morel takes some of Marlo's days and the
// cloud whale some meteor nights once they have come (never adding a special day, never both on one day, never a day
// Marlo promised in a letter); the whale drifts over at dusk, a moment to watch and to photograph; the tiny elephants'
// tea stall (say when, forgiving timing widens the line, one cup a day); the shy moss creature (only in Sneaky mode,
// hides from noise, five visits make a friend).
import { open, close, startIsland, island, sim, at, test, assert, done, press, shot, standAt, talkThrough, hold, oddSave, DAY } from './lba2.mjs';

const page = await open();
const D0 = at(2026, 11, 18, 10);

await test('schedules: the merchant and the whale only take surprise days, never add one; rare; not before they came', async () => {
  await startIsland(page, { time: D0, save: oddSave({}) });
  const r = await page.evaluate(async (d0) => {
    const C = await import('/src/scenes/solo/calendar.js'), K = await import('/src/scenes/solo/creatures.js');
    const di0 = C.dayIndex(d0), S = { odd: { got: { mushroom: di0 + 30, whale: di0 + 60 } } };
    const out = { shroom: 0, whale: 0, before: 0, wrong: 0, native: 0, days: 728, firstShroom: null, firstWhale: null, gaps: [] };
    let last = null;
    for (let d = 0; d < 728; d++) {
      const di = di0 + d, nat = C.surpriseNative(C.dayMs(di)), k = nat ? K.creatureSwap(S, di, nat) : null;
      if (nat) out.native++;
      if (k === 'mushroom') { out.shroom++; out.firstShroom ??= d; if (nat !== 'merchant') out.wrong++; if (d <= 30) out.before++; }
      if (k === 'whale') { out.whale++; out.firstWhale ??= d; if (nat !== 'meteor') out.wrong++; if (d <= 60) out.before++; }
      if (k === 'mushroom' || k === 'whale') { if (last !== null) out.gaps.push(d - last); last = d; }
    }
    return out;
  }, D0);
  const minGap = Math.min(...r.gaps);
  console.log(`   two years: ${r.native} surprise days by the calendar (unchanged); Old Morel ${r.shroom} of them (first on day ${r.firstShroom}), the cloud whale ${r.whale} (first on day ${r.firstWhale}); creature days at least ${minGap} days apart`);
  assert(!r.wrong && !r.before && r.shroom >= 6 && r.shroom <= 40 && r.whale >= 4 && r.whale <= 30, JSON.stringify(r));
  // a day Marlo promised in a letter stays Marlo's
  const kept = await page.evaluate(async () => {
    const C = await import('/src/scenes/solo/calendar.js'), K = await import('/src/scenes/solo/creatures.js');
    for (let di = 20500; di < 21500; di++) {
      if (C.surpriseNative(C.dayMs(di)) !== 'merchant') continue;
      const S = { odd: { got: { mushroom: 0 } } };
      if (K.creatureSwap(S, di, 'merchant') !== 'mushroom') continue;
      S.hook = { kind: 'letter', due: di, who: 'merchant' };
      return K.creatureSwap(S, di, 'merchant');
    }
    return null;
  });
  assert(kept === 'merchant', String(kept));
});

/** The first day from D0 with this creature (once it came on day 0 of the save). */
async function creatureDay(kind) {
  return page.evaluate(async ([d0, kind]) => {
    const C = await import('/src/scenes/solo/calendar.js'), K = await import('/src/scenes/solo/creatures.js');
    const di0 = C.dayIndex(d0), S = { odd: { got: { mushroom: di0 - 1, whale: di0 - 1 } } };
    for (let d = 1; d < 400; d++) { const nat = C.surpriseNative(C.dayMs(di0 + d)); if (nat && K.creatureSwap(S, di0 + d, nat) === kind) return d; }
    return null;
  }, [D0, kind]);
}

await test('Old Morel by the fairy ring on his day (9-18): the Today board says so, odd seeds for coins', async () => {
  const d = await creatureDay('mushroom');
  await startIsland(page, { time: D0 + d * DAY, save: `(S) => { S.coins = 200; const di = Math.round((Date.UTC(new Date(${D0}).getFullYear(), new Date(${D0}).getMonth(), new Date(${D0}).getDate()) / 86400000)); S.odd = { first: 0, last: -1e9, got: { mushroom: di - 1, whale: di - 1 }, modes: {}, mode: 'normal' }; }` });
  await sim(page, 1.5);
  const st = await island(page, (I, S) => ({ kind: I.odd.creatures.kind, sur: I.surprise.kind, shown: I.odd.creatures.morel.shown, items: S.todayBoard.items.map((i) => i.k), cart: I.surprise.cart.visible }));
  assert(st.kind === 'mushroom' && st.shown && !st.cart && st.items.some((k) => k.startsWith('cr.td.shroom')), JSON.stringify(st));
  await standAt(page, 16.0, 20.0, [0, -1]);
  await shot(page, 'lba2-creature-morel');
  await island(page, (I) => I.interactions().b.fn());
  await talkThrough(page, 0); // the star fruit seed (60)
  await talkThrough(page);
  const r = await island(page, (I, S) => ({ coins: S.coins, seed: S.inv.some((x) => x.id === 'starfruitSeed') }));
  assert(r.coins === 140 && r.seed, JSON.stringify(r));
});

await test('the cloud whale at dusk: seen, a moment to watch (Start pauses it), a photo', async () => {
  const d = await creatureDay('whale');
  await startIsland(page, { time: D0 + d * DAY + 9.2 * 3600e3, save: `(S) => { const di = Math.round((Date.UTC(new Date(${D0}).getFullYear(), new Date(${D0}).getMonth(), new Date(${D0}).getDate()) / 86400000)); S.odd = { first: 0, last: -1e9, got: { mushroom: di - 1, whale: di - 1 }, modes: {}, mode: 'normal' }; S.inv.push({ id: 'camera', n: 1, slot: 2 }); }` });
  await sim(page, 1.5);
  const k = await island(page, (I) => ({ kind: I.odd.creatures.kind, vis: I.odd.creatures.whale.visible, surprise: I.surprise.kind }));
  assert(k.kind === 'whale' && k.vis && !(await island(page, (I) => I.surprise.meteor)), JSON.stringify(k));
  await standAt(page, 4, 4);
  await sim(page, 3);
  const w = await island(page, (I, S) => ({ mode: I.mode, seen: S.odd.cre.whale.seen, deco: !!S.deco.whaleKite }));
  assert(w.mode === 'watch' && w.seen === 1, JSON.stringify(w));
  await shot(page, 'lba2-creature-whale');
  const paused = await page.evaluate(() => window.game.current.freezePause());
  assert(paused, 'Start pauses the watch');
  await sim(page, 7);
  assert((await island(page, (I) => I.mode)) === 'walk', 'back to walking');
  // a photo with the whale in it
  await island(page, (I, S) => { S.sel = 2; I.photo.start(); });
  await sim(page, 0.5);
  await island(page, (I) => { const w = I.odd.creatures.whale.position; I.camOffset = null; I.camView = { pos: w.clone().add(new w.constructor(0, -12, 24)), look: w.clone(), fov: 50 }; I.photo.snap(); I.camView = null; });
  await sim(page, 2.5);
  const ph = await island(page, (I, S) => S.odd.cre.whale.photo);
  assert(ph, 'the photo counted');
});

await test('the tiny elephants\' tea: say when; forgiving timing widens the line; one cup a day', async () => {
  await startIsland(page, { time: at(2026, 11, 19, 11), save: oddSave({ tea: 0 }) });
  await sim(page, 1.5);
  await standAt(page, 22.0, 32.6, [0, -1]);
  const b = await island(page, (I) => I.interactions().b?.text);
  assert(/order a cup of tea/.test(b), b);
  await island(page, (I) => I.interactions().b.fn());
  await talkThrough(page, 0);
  const band = await island(page, (I) => ({ mode: I.mode, w: I.odd.creatures.tea.hi - I.odd.creatures.tea.lo }));
  assert(band.mode === 'tea', JSON.stringify(band));
  await sim(page, 1.2);
  await shot(page, 'lba2-creature-tea');
  // wait until the cup is at the line, then [B]
  for (let i = 0; i < 40 && (await island(page, (I) => I.odd.creatures.tea && I.odd.creatures.tea.fill < (I.odd.creatures.tea.lo + I.odd.creatures.tea.hi) / 2)); i++) await sim(page, 0.05);
  const pourAt = await island(page, (I) => ({ fill: I.odd.creatures.tea?.fill, lo: I.odd.creatures.tea?.lo, hi: I.odd.creatures.tea?.hi }));
  await press(page, 'KeyE');
  await sim(page, 1.6);
  const r = await island(page, (I, S) => ({ at: 0, mode: I.mode, tea: S.inv.some((x) => x.id === 'tea_mint'), perfect: S.odd.cre.tea.perfect, set: !!S.deco.teaSet, b: I.interactions().b?.text }));
  assert(r.mode === 'walk' && r.tea && r.perfect && r.set && /One cup a day/.test(r.b), JSON.stringify({ r, pourAt }));
  // forgiving timing: a wider line
  await page.evaluate(() => { const id = window.__testProfile.id, A = window.game.assist; A.saveSettings(id, { ...A.profileSettings(id), timing: true }); });
  const wide = await island(page, (I) => { const C = I.odd.creatures; C.startTea('honey'); const w = C.tea.hi - C.tea.lo; C.tea = null; I.hud.setPanel(null); I.mode = 'walk'; return w; });
  assert(wide > band.w * 1.5, `${band.w} -> ${wide}`);
});

await test('the shy moss creature: only seen in Sneaky mode; noise makes it hide for the day; five visits make a friend', async () => {
  await startIsland(page, { time: at(2026, 11, 19, 11), save: oddSave({ sneaky: 0, moss: 0 }, { modes: { sneaky: true } }) });
  await sim(page, 1.5);
  await standAt(page, -19.5, 23, [0, -1]);
  await sim(page, 0.3);
  const normal = await island(page, (I, S) => ({ vis: I.odd.creatures.moss.visible, hid: S.odd.cre.moss.hid }));
  assert(!normal.vis && normal.hid, `walking up normally: hidden for the day ${JSON.stringify(normal)}`);
  // the next day, tiptoe
  const visits = [];
  for (let d = 1; d <= 5; d++) {
    await standAt(page, 0, 0);
    await page.evaluate((ms) => { window.__islandTimeOffset = ms - Date.now(); }, at(2026, 11, 19 + d, 11));
    await sim(page, 1.2);
    await island(page, (I, S) => { S.odd.mode = 'sneaky'; });
    await standAt(page, -17, 25, [0, -1]);
    await hold(page, 'KeyW', 1.2);
    await island(page, (I) => { I.player.x = -19.5; I.player.z = 21.4; I.groundCheck(I.player, I.walkState); });
    await sim(page, 0.3);
    const st = await island(page, (I) => ({ vis: I.odd.creatures.moss.visible, b: I.interactions().b?.text }));
    if (d === 1) { await island(page, (I) => { if (I.mode !== 'walk') { I.hud.setPanel(null); I.mode = 'walk'; } }); await sim(page, 0.1); await shot(page, 'lba2-creature-moss'); }
    assert(st.vis && /hello softly/.test(st.b), `day ${d}: ${JSON.stringify(st)}`);
    await island(page, (I) => I.interactions().b.fn());
    visits.push(await island(page, (I, S) => new Set(S.odd.cre.moss.visits).size));
  }
  const r = await island(page, (I, S) => ({ friend: S.odd.cre.moss.friend, charm: !!S.deco.mossCharm, trial: !!window.game.passport.loadPassport(window.__testProfile.id).trials['sneak.moss'] }));
  assert(visits.join() === '1,2,3,4,5' && r.friend && r.charm && r.trial, JSON.stringify({ visits, r }));
});

await test('no console errors', async () => { assert(!page.errors.length, page.errors.join('\n')); });
await close(page);
done();
