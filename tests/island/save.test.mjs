// The solo island core, part 4: the save round trip (play, save, reload the page, the same island), old saves (a
// minimal one with none of the newer fields, and one from before the bag slots), and the language switch: English
// and Norwegian, with no raw text keys ("isl.x", "arc.x"...) on the island's panels in either.
import { open, close, startIsland, island, sim, at, setTime, test, assert, done, press, shot } from '../lively/helper.mjs';
import { toWalk, rawKeys } from './isl.mjs';

const page = await open();
const D0 = at(2026, 11, 18, 14);

/** The parts of the island save the round trip compares. */
const snapshot = () => island(page, (I, S) => JSON.stringify({
  coins: S.coins, inv: [...S.inv].sort((a, b) => a.slot - b.slot), chest: S.chest, sel: S.sel, tiles: S.tiles, npcs: S.npcs, quests: S.quests, unlocks: S.unlocks,
  yard: S.yard, store: S.store, sea: S.sea, cafe: S.cafe, stats: S.stats, deco: S.deco, tut: S.tut, mail: S.mail.length, hops: S.hops?.best, museum: S.museum,
}));

await test('the save round trip: play a bit, the island saves itself, reload the page, the same island comes back', async () => {
  await startIsland(page, { time: D0, name: 'Saver' });
  await toWalk(page);
  await island(page, async (I, S) => {
    const Sv = await import('/src/scenes/solo/save.js');
    S.coins = 777;
    Sv.give(S, 'wood', 9); Sv.give(S, 'carrotSeed', 3); Sv.give(S, 'pumpkin', 1);
    I.farm.till(2, 5, Sv.now()); I.farm.plant(2, 5, 'carrot', Sv.now()); I.farm.water(2, 5, Sv.now());
    I.addPts('pip', 14);
    S.store.fence = 2;
    S.unlocks.bridge = true; I.applyUnlocks(false);
    S.sel = 2;
    I.markDirty();
  });
  await sim(page, 2.5); // (the island writes every two seconds when something changed)
  const before = await snapshot();
  const id = await page.evaluate(() => window.__testProfile.id);
  const stored = await page.evaluate((id) => JSON.parse(localStorage.getItem(`couch-party.solo.${id}`) || '{}').progress?.island?.coins, id);
  assert(stored === 777, `written to localStorage: ${stored}`);
  await page.reload();
  await page.waitForFunction(() => !!window.game && !!window.game.current, null, { timeout: 30000 });
  await page.evaluate(([id, ms]) => {
    window.__islandTimeOffset = ms - Date.now();
    window.game.audio.ensure();
    import('/src/core/profiles.js').then((P) => window.game.enterSolo(P.getProfile(id), 'kb0'));
  }, [id, D0 + 60e3]);
  await page.waitForFunction(() => window.game.current?.constructor?.name === 'SoloIslandScene' && !window.game.switching && window.game.current.player, null, { timeout: 30000 });
  await sim(page, 1.5);
  const after = await snapshot();
  const A = JSON.parse(before), B = JSON.parse(after);
  // (the crop grew a minute in between)
  for (const o of [A, B]) for (const tl of Object.values(o.tiles)) { delete tl.growth; delete tl.last; }
  const diff = Object.keys(A).filter((k) => JSON.stringify(A[k]) !== JSON.stringify(B[k]));
  assert(!diff.length, `changed after the reload: ${diff.map((k) => `${k}: ${JSON.stringify(A[k])} -> ${JSON.stringify(B[k])}`).join('\n')}`);
  const look = await island(page, (I, S) => ({ bridge: I.walkState.bridge, held: I.held?.id, name: window.game.solo.profile.name }));
  assert(look.bridge && look.name === 'Saver', JSON.stringify(look));
});

await test('a minimal old save (only a few early fields) opens without errors and plays a day', async () => {
  const raw = { v: 1, intro: true, tut: 8, coins: 55, inv: [{ id: 'hoe', n: 1 }, { id: 'radishSeed', n: 2 }, { id: 'wood', n: 4 }], tiles: { '0,0': { s: 'till', crop: 'radish', growth: 10000, wetUntil: 0, last: 0 } }, npcs: { hazel: { pts: 12, met: true } }, quests: {}, unlocks: {}, mail: [], deco: {} };
  await startIsland(page, { time: D0, raw, name: 'Minimal' });
  await sim(page, 3);
  await toWalk(page);
  const r = await island(page, (I, S) => ({ coins: S.coins, inv: S.inv.map((i) => i.id), zz: !!S.zz, sea: !!S.sea, cafe: !!S.cafe, invV: S.invV, hazel: S.npcs.hazel.pts }));
  assert(r.coins === 55 && r.inv.includes('zipzap') && r.inv.includes('wood') && r.zz && r.sea && r.cafe && r.invV === 2 && r.hazel === 12, JSON.stringify(r));
  // a day of things: the menu, the journal's tabs, the bag, talking, a new day
  await island(page, (I) => { I.openMode(0); I.closeMode(); for (const t of ['map', 'friends', 'tasks', 'cal', 'fish', 'museum', 'passport', 'coming']) { I.journal.open(t); } I.journal.close(); I.openBag(); I.bagUi.close(); });
  await setTime(page, D0 + 86400e3);
  await sim(page, 3);
  await toWalk(page);
  await island(page, (I) => { I.talkTo(I.npc('hazel')); });
  for (let i = 0; i < 10 && (await island(page, (I) => I.mode)) === 'dialog'; i++) { await sim(page, 0.3); await press(page, 'KeyE'); }
  assert(!page.errors.length, page.errors.join('\n'));
});

await test('a save with no island at all (a profile that only played games) gets a fresh island and the welcome', async () => {
  await page.evaluate(async () => {
    const P = await import('/src/core/profiles.js');
    const prof = P.createProfile({ name: 'Gamer', colorIndex: 2 });
    localStorage.setItem(P.soloSaveKey(prof.id), JSON.stringify({ stars: 3, progress: { duckhunt: { best: 12 } } }));
    window.game.enterSolo(prof, 'kb0');
  });
  await page.waitForFunction(() => window.game.current?.constructor?.name === 'SoloIslandScene' && !window.game.switching && window.game.current.player && window.game.current.save?.coins === 30, null, { timeout: 30000 });
  await sim(page, 1.5);
  const r = await island(page, (I, S) => ({ mode: I.mode, intro: S.intro, duck: window.game.roster.progress.duckhunt?.best }));
  assert(r.mode === 'dialog' && !r.intro && r.duck === 12, JSON.stringify(r));
  for (let i = 0; i < 12 && (await island(page, (I) => I.mode)) === 'dialog'; i++) { await sim(page, 0.3); await press(page, 'KeyE'); }
  assert((await island(page, (I, S) => S.intro)), 'welcomed');
});

/** Open the island's panels one by one and collect any raw keys on screen. */
async function panelsRaw() {
  const found = {};
  const look = async (name, fn) => {
    await island(page, fn);
    await sim(page, 0.3);
    const raw = await rawKeys(page);
    if (raw.length) found[name] = raw;
  };
  await toWalk(page);
  await look('walk', () => {});
  await look('menu', (I) => I.openMode(0));
  await look('help', (I) => { I.closeMode(); I.toggleHelp(); });
  await look('bag', (I) => { I.toggleHelp(); I.openBag(); });
  await look('chest', (I) => { I.bagUi.close(); I.bagUi.show(true); });
  await look('shop', (I) => { I.bagUi.close(); I.openShop(); });
  await look('shop sell', (I) => { I.shop.tab = 1; I.renderShop(); });
  await look('bench', (I) => { I.hud.setPanel(null); I.mode = 'walk'; I.builder.openBench(); });
  await look('bench upgrade', (I) => { I.builder.panel.tab = 1; I.builder.renderBench(); });
  await look('cook', (I) => { I.hud.setPanel(null); I.mode = 'walk'; I.cafe.openCook(true); });
  await look('zip-zap bench', (I) => { I.hud.setPanel(null); I.mode = 'walk'; I.zipzap.openBench?.(); });
  await look('museum', (I) => { I.hud.setPanel(null); I.mode = 'walk'; I.museum.open(); });
  await look('calendar board', (I) => { I.museum.close(); I.seasons.openCalendar(); });
  for (const tab of ['map', 'friends', 'tasks', 'cal', 'fish', 'museum', 'passport', 'coming']) await look(`journal ${tab}`, (I, S, G, tab) => { I.hud.setPanel(null); I.mode = 'walk'; I.journal.open(tab); }, tab);
  await look('today board', (I) => { I.journal.close(); I.todayBoard.open(); });
  await look('pause', (I, S, G) => { I.hud.setPanel(null); I.mode = 'fish'; G.openPause(); });
  await island(page, (I, S, G) => { G.closePause(); I.mode = 'walk'; });
  await toWalk(page);
  return found;
}

await test('English: no raw text keys on the island\'s panels (menu, help, bag, chest, shop, bench, cook, museum, journal tabs, Today board, pause)', async () => {
  await startIsland(page, { time: D0, name: 'Words' });
  await island(page, (I, S) => { S.inv.push({ id: 'carrot', n: 2 }, { id: 'wood', n: 3 }); S.store.fence = 1; });
  assert((await page.evaluate(async () => (await import('/src/core/i18n.js')).getLang())) === 'en', 'English first');
  const found = await panelsRaw();
  assert(!Object.keys(found).length, JSON.stringify(found));
});

await test('N switches to Norwegian (a toast, the HUD follows), no raw keys there either, and N switches back', async () => {
  await press(page, 'KeyN');
  const lang = await page.evaluate(async () => (await import('/src/core/i18n.js')).getLang());
  assert(lang === 'no', lang);
  await sim(page, 0.5);
  const found = await panelsRaw();
  await island(page, (I) => I.journal.open('tasks'));
  await sim(page, 0.3);
  await shot(page, 'island-norwegian-journal');
  const txt = await island(page, (I) => I.hud.panel.innerText);
  await island(page, (I) => I.journal.close());
  assert(!Object.keys(found).length, JSON.stringify(found));
  assert(/Oppgaver|oppgave/i.test(txt), `Norwegian text: ${txt.slice(0, 200)}`);
  await press(page, 'KeyN');
  assert((await page.evaluate(async () => (await import('/src/core/i18n.js')).getLang())) === 'en', 'back to English');
});

await test('no console errors', async () => { assert(!page.errors.length, page.errors.join('\n')); });
await close(page);
done();
