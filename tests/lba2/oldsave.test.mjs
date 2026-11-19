// Old saves and the odd-adventure round: an island saved before it (no S.odd, a drama turn order that stopped at the
// first three) opens with safe defaults: nothing new on day one, no mode badge, no ball, the old drama finishes and the
// next one is a new social happening, and weeks of days run on without errors; a half-made S.odd (a field missing or
// of the wrong kind) is filled in; and everything this round saves survives a page reload.
import { open, close, startIsland, island, sim, at, setTime, test, assert, done, DAY } from './lba2.mjs';

const page = await open();
const D0 = at(2026, 11, 19, 10);

const OLD = {
  v: 1, intro: true, tut: 8, coins: 250, inv: [{ id: 'zipzap', n: 1, slot: 0 }, { id: 'wood', n: 7, slot: 1 }], invV: 2, bagRows: 2, chest: [], sel: 0,
  zz: { area: 1, speed: 0, range: 0, power: 0 }, tiles: {}, weeds: [],
  npcs: { hazel: { pts: 45, talkAt: 0, giftAt: 0, ev: 2, q: 4, met: true }, coach: { pts: 10, talkAt: 0, giftAt: 0, ev: 0, q: 0, met: true } },
  quests: {}, unlocks: { bridgeWood: 10, bridge: true, mineHits: 0, mine: false, burrow: false, rockBuster: true, barn: false, greenhouse: false },
  branches: {}, found: {}, rewards: {}, mail: [], deco: {}, stats: { harvested: 12, shipped: 30, earned: 400 }, last: { place: null },
  sea: { rod: true, suit: false, quest: 2, log: {}, caught: 4, dives: 0, haul: null }, cafe: { repaired: false, wood: 0, served: 0, earned: 0, nights: 0, cooked: 0 },
  // the livelier island's state of that time: three dramas played, the cake one running
  village: { heard: [], react: { q: [], last: {}, n: {} }, built: ['gazebo'], dramaN: 2, projN: 1, nextDrama: 0, nextProj: 99999,
    drama: { id: 'cake', start: 20774, climax: 20778, told: {}, side: null, fish: 0, water: [], flavor: null, res: null } },
};

await test('an old save opens: nothing new on day one, no badge, no ball, no new places yet', async () => {
  await startIsland(page, { time: D0, raw: OLD });
  await sim(page, 3);
  const r = await island(page, (I, S) => ({ odd: S.odd && { first: S.odd.first, got: Object.keys(S.odd.got), mode: S.odd.mode }, badge: I.odd.modes.badge(), ball: !!I.odd.ball.B, school: I.odd.wizard.tower.visible, shop: I.odd.inventor.shop.visible, folk: I.odd.folk.group.visible, top: I.hud.top.innerText }));
  assert(r.odd && !r.odd.got.length && r.odd.mode === 'normal' && !r.badge && !r.ball && !r.school && !r.shop && !r.folk, JSON.stringify(r));
  assert(!/Sporty|Normal/.test(r.top), r.top);
  assert(!page.errors.length, page.errors.join('\n'));
});

await test('weeks of days: the cake drama ends, the next is a social happening, the first arrivals come', async () => {
  const seen = new Set();
  for (let d = 1; d <= 28; d++) {
    await setTime(page, D0 + d * DAY);
    await sim(page, 1.6, 1 / 10);
    await island(page, (I) => { if (I.mode === 'today') { I.hud.setPanel(null); I.mode = 'walk'; } });
    const D = await island(page, (I, S) => S.village.drama?.id || null);
    if (D) seen.add(D);
    if (d % 7 === 0) await island(page, (I) => { I.journal.open('tasks'); I.journal.close(); I.journal.open('map'); I.journal.close(); I.journal.open('friends'); I.journal.close(); I.openMode(0); I.closeMode(); });
  }
  const r = await island(page, (I, S) => ({ got: S.odd.got, dramaN: S.village.dramaN }));
  console.log(`   dramas seen: ${[...seen].join(', ')}; arrived: ${Object.keys(r.got).join(', ')}`);
  assert(seen.has('fence') && Object.keys(r.got).length >= 2, JSON.stringify({ seen: [...seen], r }));
  assert(!page.errors.length, page.errors.join('\n'));
});

await test('a half-made odd-adventure save is filled in (fields missing or of the wrong kind)', async () => {
  const half = JSON.parse(JSON.stringify(OLD));
  half.odd = { got: { ball: 20700, inventor: 20701 }, modes: null, mode: 'flying', ball: { have: true }, wiz: 'nope', inv: { jokes: null }, cre: null, folk: { words: null } };
  await startIsland(page, { time: D0, raw: half, name: 'Half' });
  await sim(page, 2);
  const r = await island(page, (I, S) => ({ mode: I.odd.modes.mode, modes: typeof S.odd.modes, bounces: I.odd.ball.maxBounces, lessons: I.odd.wizard.W.lessons, jokes: I.odd.inventor.I.jokes.told.length, folk: I.odd.folk.F.words.length, cre: !!I.odd.creatures.C.tea }));
  assert(r.mode === 'normal' && r.modes === 'object' && r.bounces === 2 && r.lessons && r.jokes === 0 && r.folk === 0 && r.cre, JSON.stringify(r));
  assert(!page.errors.length, page.errors.join('\n'));
});

await test('what this round saves survives a page reload', async () => {
  await island(page, (I, S) => { S.odd.modes = { sporty: true, sneaky: true }; S.odd.mode = 'sneaky'; S.odd.folk.words = ['ollo', 'bimbom']; S.odd.got.folk = 20700; I.markDirty(); I.flush(); window.game.roster.save(); });
  const id = await page.evaluate(() => window.__testProfile.id);
  await page.reload();
  await page.waitForFunction(() => !!window.game && !!window.game.current, null, { timeout: 30000 });
  await setTime(page, D0 + 29 * DAY);
  await page.evaluate(async (id) => { const P = await import('/src/core/profiles.js'); const prof = P.getProfile(id); window.game.audio.ensure(); window.game.enterSolo(prof || { id, name: 'Half', colorIndex: 1 }, 'kb0'); }, id);
  await page.waitForFunction(() => window.game.current?.constructor?.name === 'SoloIslandScene' && !window.game.switching && window.game.current.player, null, { timeout: 30000 });
  await sim(page, 2);
  const r = await island(page, (I, S) => ({ mode: I.odd.modes.mode, words: S.odd.folk.words, badge: I.odd.modes.badge()?.word }));
  assert(r.mode === 'sneaky' && r.words.join() === 'ollo,bimbom' && r.badge === 'Sneaky', JSON.stringify(r));
  assert(!page.errors.length, page.errors.join('\n'));
});

await close(page);
done();
