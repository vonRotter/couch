// Fixes from the second play-test pass (months 2 to 5, daily, weekend-only and evening-only children;
// tests/playtest/LOG.md "Second pass"): each test is one thing a child ran into, checked so it stays fixed.
import { open, close, startIsland, island, sim, at, test, assert, done, press, shot, DAY } from '../lively/helper.mjs';

const page = await open();
const D0 = at(2026, 11, 18, 11); // a Wednesday
const dayOf = (I, S) => Math.round((new Date(S.todayBoard.day + 'T12:00').getTime() - new Date(1970, 0, 1, 12).getTime()) / 86400000);

await test('the island vote: the map marker (and the Today line) point at the ballot box, where [B] votes', async () => {
  await startIsland(page, { time: D0 });
  const r = await page.evaluate(async () => {
    const { SOCIAL } = await import('/src/scenes/solo/social.js');
    const I = window.game.current, S = I.save, di = Math.round((new Date(S.todayBoard.day + 'T12:00').getTime() - new Date(1970, 0, 1, 12).getTime()) / 86400000);
    S.village.drama = { id: 'election', start: di, climax: di + 4, told: {}, side: null, fish: 0, water: [], flavor: null, res: null };
    SOCIAL.election.init?.(S.village.drama);
    I.hud.setPanel(null); I.mode = 'walk';
    const m = I.village.mapItems().find((x) => x.key === 'drama');
    const P = I.player; P.x = m.x; P.z = m.z + 0.6; P.fx = 0; P.fz = -1; I.groundCheck(P, I.walkState);
    const news = I.village.todayNews(Date.now() + window.__islandTimeOffset).find((x) => x.icon === '🗳️');
    return { m, use: I.useAction(I.interactions())?.text || '', news: news && { x: news.x, z: news.z } };
  });
  assert(/vote/i.test(r.use), `standing at the marker, [B] votes: ${JSON.stringify(r)}`);
  assert(r.news && Math.hypot(r.news.x - r.m.x, r.news.z - r.m.z) < 0.1, JSON.stringify(r));
});

await test('a language chosen on the island (N) is still chosen on the next visit (after a page reload)', async () => {
  await island(page, (I) => { I.hud.setPanel(null); I.mode = 'walk'; });
  const was = await page.evaluate(() => document.documentElement.lang);
  await press(page, 'KeyN');
  const now = await page.evaluate(() => document.documentElement.lang);
  assert(was !== now, `switched: ${was} -> ${now}`);
  await page.reload();
  await page.waitForFunction(() => !!window.game && !!window.game.current, null, { timeout: 30000 });
  const after = await page.evaluate(() => document.documentElement.lang);
  assert(after === now, `kept after a reload: ${after}, chosen ${now}`);
  await page.evaluate(() => window.game.toggleLanguage()); // (back, for the tests after this one)
});

await test('Tinka never talks about the teleport booths (or Wendeline) before they are on the island', async () => {
  await startIsland(page, { time: D0, save: `(S) => { S.odd = { first: 0, last: -1e9, got: { sporty: 0, ball: 0, inventor: 0 }, modes: {}, mode: 'normal' }; }` });
  const keys = [];
  for (let d = 0; d < 40; d++) {
    const k = await island(page, (I, S, G, d) => {
      const inv = I.odd.parts.find((p) => p.talkTinka);
      const di = Math.round((new Date(S.todayBoard.day + 'T12:00').getTime() - new Date(1970, 0, 1, 12).getTime()) / 86400000) + d;
      const real = Date.now; const base = window.__islandTimeOffset;
      window.__islandTimeOffset = base + d * 864e5;
      inv.I.met = true; inv.I.said = (inv.I.said || []).filter((x) => x.di !== di);
      inv.talkTinka();
      const key = I.dlg?.lines?.[0]?.key || null;
      I.hud.setDialog(null); I.dlg = null; I.mode = 'walk';
      window.__islandTimeOffset = base;
      return key;
    }, d);
    if (k) keys.push(k);
  }
  assert(keys.length > 10, keys.join());
  assert(!keys.includes('iv.chat.5') && !keys.includes('iv.chat.10'), keys.join());
});

await test('a task that sends you to Shelby says she visits Crab Cove on a weekend (10-18); Norwegian calls the cove one name', async () => {
  // Saturday 20 March 2027, 11:00, the story's chapter 3 (coconuts for Shelby's moon lens)
  await startIsland(page, { time: at(2027, 3, 20, 11), save: `(S) => { S.npcs.shelby = { pts: 10, talkAt: 0, giftAt: 0, ev: 0, q: 0, met: true }; S.story = { ch: 3, phase: 'quest', stage: 0, goals: {}, asked: {}, crumbs: [], stairs: false, festDay: '', stars: {}, filterTold: false, topVisits: 0 }; }` });
  const sat = await island(page, (I) => I.story.tasks().join(' | '));
  assert(/Shelby/.test(sat) && /Crab Cove/.test(sat), sat);
  await page.evaluate((ms) => { window.__islandTimeOffset = ms - Date.now(); }, at(2027, 3, 22, 11)); // a Monday
  await sim(page, 1.2);
  const mon = await island(page, (I) => I.story.tasks().join(' | '));
  assert(/Shelby/.test(mon) && !/Crab Cove/.test(mon), mon);
  const no = await page.evaluate(async () => { const i = await import('/src/core/i18n.js'); return i.stringKeys().no.length; });
  const cove = await page.evaluate(async () => { const i = await import('/src/core/i18n.js'), w = i.getLang(); i.setLang('no'); const k = i.stringKeys().no.map((k) => i.t(k)).filter((x) => /Krabbevika/.test(x)); i.setLang(w); return k; });
  assert(no > 0 && !cove.length, cove.join(' | '));
});

await test('Norwegian Today lines write a title small inside a sentence ("i morgen har tante Hassel bursdag") and keep a capital first letter', async () => {
  const r = await page.evaluate(async () => {
    const i = await import('/src/core/i18n.js'), T = await import('/src/scenes/solo/today.js');
    const w = i.getLang(); i.setLang('no');
    const a = T.itemText({ k: 'td.r.bday', v: { name: '@isl.npc.hazel' } }), b = T.itemText({ k: 'td.mail.2', v: { name: '@isl.npc.hazel' } }), c = T.itemText({ k: 'td.mail.1', v: { name: '@isl.npc.rosa' } });
    i.setLang('en');
    const e = T.itemText({ k: 'td.mail.2', v: { name: '@isl.npc.hazel' } });
    i.setLang(w);
    return { a, b, c, e };
  });
  assert(/i morgen har tante Hassel bursdag/.test(r.a) && /^Tante Hassel har skrevet/.test(r.b) && /fra Rosa/.test(r.c) && /^Aunt Hazel wrote/.test(r.e), JSON.stringify(r));
});

await test('a task to bring things says how many wait in the cottage chest (a full bag sends gifts there)', async () => {
  await startIsland(page, { time: at(2026, 11, 18, 11) });
  const r = await island(page, (I, S) => {
    S.quests.hazel = { n: 2 };
    S.chest = [{ id: 'stone', n: 4, slot: 0 }];
    S.inv = S.inv.filter((x) => x.id !== 'stone');
    return I.questText('hazel', 2);
  });
  assert(/10 stone \(0\/10\) · 4 in your cottage chest/.test(r), r);
});

await test('no console errors', async () => { assert(!page.errors.length, page.errors.join('\n')); });
await close(page);
done();
