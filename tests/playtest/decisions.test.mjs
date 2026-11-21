// The owner's decisions after the play-test pass (tests/playtest/LOG.md, "Owner decisions built"): each test is one
// decision, checked so it stays built.
import { open, close, startIsland, island, sim, at, test, assert, done, press, shot, DAY } from '../lively/helper.mjs';

const page = await open();
const D0 = at(2026, 11, 18, 11); // a Wednesday

/** Put a visitor's letter on today's board (an offer to save) and open the board. */
async function boardWithOffer() {
  return island(page, (I, S) => {
    I.hud.setPanel(null); I.mode = 'walk'; S.lock = null;
    const today = Math.round((new Date(S.todayBoard.day + 'T12:00').getTime() - new Date(1970, 0, 1, 12).getTime()) / 86400000);
    S.hook = { kind: 'letter', who: 'balloon', made: today, due: today + 3 };
    S.todayBoard.items = [{ kind: 'visitor', icon: '✉️', k: 'td.lk.letter.balloon', v: { day: '@td.wd.1' } }];
    I.todayBoard.open();
    I.todayBoard.t = 1;
    return { offer: !!I.todayBoard.offer, text: I.hud.panel.innerText };
  });
}

await test('1. the Today board: [OK] and [BACK] only close it; saving for later is its own row (▼, then [OK])', async () => {
  await startIsland(page, { time: D0 });
  const b = await boardWithOffer();
  assert(b.offer && /Save it for later/.test(b.text) && /E: off we go/.test(b.text), JSON.stringify(b));
  await press(page, 'KeyE'); // the use key, the one that closes every panel
  await sim(page, 0.2);
  let r = await island(page, (I, S) => ({ mode: I.mode, lock: S.lock }));
  assert(r.mode === 'walk' && !r.lock, `[OK] alone closes and never saves: ${JSON.stringify(r)}`);
  await boardWithOffer();
  await press(page, 'Space'); // (Space on a keyboard)
  await sim(page, 0.2);
  assert(!(await island(page, (I, S) => S.lock)), 'Space alone never saves');
  // ▼ picks the row, [BACK] still only closes
  await boardWithOffer();
  await press(page, 'KeyS');
  const on = await island(page, (I) => ({ sel: I.todayBoard.sel, text: I.hud.panel.innerText }));
  assert(on.sel === 0 && /save it for later/i.test(on.text), JSON.stringify(on));
  await shot(page, 'decisions-board-row');
  await press(page, 'KeyQ');
  await sim(page, 0.2);
  assert(!(await island(page, (I, S) => S.lock)), '[BACK] on the row never saves');
  // ▼ then [OK] saves
  await boardWithOffer();
  await press(page, 'KeyS');
  await press(page, 'KeyE');
  await sim(page, 0.2);
  r = await island(page, (I, S) => ({ mode: I.mode, lock: S.lock }));
  assert(r.mode === 'walk' && r.lock?.what === 'balloon', JSON.stringify(r));
  // ▼ then ▲ leaves the row: [OK] closes
  await island(page, (I, S) => { S.lock = null; });
  await boardWithOffer();
  await press(page, 'KeyS'); await press(page, 'KeyW'); await press(page, 'KeyE');
  await sim(page, 0.2);
  assert(!(await island(page, (I, S) => S.lock)), '▲ leaves the row');
  // Norwegian
  const no = await page.evaluate(async () => { const i = await import('/src/core/i18n.js'); const w = i.getLang(); i.setLang('no'); const s = [i.t('lk.boardRow'), i.t('lk.boardHint'), i.t('lk.boardHintOn')]; i.setLang(w); return s; });
  assert(/Spar den til senere/.test(no[0]) && /av sted/.test(no[1]), no.join(' | '));
});

/** Start a drama whose big moment is today (an island opened at `ms`, its first visit of the day). */
async function climaxToday(ms, id = 'pumpkin') {
  await startIsland(page, { time: ms, settle: 0 });
  return island(page, (I, S, G, id) => {
    const di = Math.round((new Date(S.todayBoard.day + 'T12:00').getTime() - new Date(1970, 0, 1, 12).getTime()) / 86400000);
    S.village.drama = { id, start: di - 4, climax: di, told: {}, side: null, fish: 0, water: [di - 3], flavor: null, res: null };
    S.village.firstVisit = { di, h: new Date(Date.now() + window.__islandTimeOffset).getHours() };
    I.hud.setPanel(null); I.mode = 'walk';
    return di;
  }, id);
}

await test('2. a drama\'s big moment: a day\'s first visit after 18:00 plays it on that visit; a visit that began earlier still ends at 18', async () => {
  // the first visit at 19:00 on the big day (a Wednesday, a free day)
  const day = at(2026, 11, 18, 19);
  await climaxToday(day);
  const news = await island(page, (I) => I.village.todayNews(Date.now() + window.__islandTimeOffset).map((x) => x.keys[0]));
  assert(news.includes('vd.pumpkin.news.climax'), `the board announces it: ${news}`);
  await sim(page, 4); // the cast walks over
  const cast = await island(page, (I) => I.village.schedule('hazel', Date.now() + window.__islandTimeOffset));
  assert(cast && /drama/.test(cast.name), `Aunt Hazel waits at the pumpkin: ${JSON.stringify(cast)}`);
  await island(page, (I) => { I.hud.setPanel(null); I.mode = 'walk'; const P = I.player; P.x = 4.6; P.z = -21.2; I.groundCheck(P, I.walkState); I.village.updateClimax(); });
  const r = await island(page, (I, S) => ({ mode: I.mode, res: S.village.drama?.res, keys: I.dlg?.lines?.map((l) => l.key) }));
  assert(r.mode === 'dialog' && r.res && r.keys.some((k) => /vd\.pumpkin\.end/.test(k)), `it plays: ${JSON.stringify(r)}`);
  await shot(page, 'decisions-late-climax');
  // a visit that began at 12 the same day: at 19 it is over without you (the next day's board tells how)
  await climaxToday(at(2026, 11, 18, 12));
  await page.evaluate((ms) => { window.__islandTimeOffset = ms - Date.now(); }, at(2026, 11, 18, 19));
  await island(page, (I) => { I.hud.setPanel(null); I.mode = 'walk'; const P = I.player; P.x = 30; P.z = 10; I.groundCheck(P, I.walkState); I.village.updateClimax(); });
  const e = await island(page, (I, S) => ({ res: S.village.drama?.res, news: S.village.resNews, cast: I.village.schedule('hazel', Date.now() + window.__islandTimeOffset) }));
  assert(e.res && e.news && !e.cast, `ended without you: ${JSON.stringify(e)}`);
});

await test('3. a new profile\'s first three days: no torn page, no little task, no tomorrow hook; from the fourth day they come', async () => {
  const born = at(2026, 11, 18, 10);
  await startIsland(page, { time: born, save: `(S) => { S.born = Math.round((new Date(2026, 10, 18, 12).getTime() - new Date(1970, 0, 1, 12).getTime()) / 864e5); }` });
  const rows = [];
  for (let d = 0; d < 8; d++) {
    await page.evaluate((ms) => { window.__islandTimeOffset = ms - Date.now(); }, born + d * DAY);
    await sim(page, 1.2);
    rows.push(await page.evaluate(async () => {
      const P = await import('/src/scenes/solo/play.js');
      const C = await import('/src/scenes/solo/calendar.js');
      const I = window.game.current, S = I.save, ms = Date.now() + window.__islandTimeOffset;
      const keepHook = S.hook, keepLast = S.hookLast;
      S.hook = null; S.hookLast = -99;
      const hook = !!I.todayBoard.issueHook(ms);
      S.hook = keepHook; S.hookLast = keepLast;
      return { d: C.dayIndex(ms) - S.born, mystery: I.events.hasNews('hoot'), task: I.play.hasNews(P.taskOn(ms)), hook, crab: I.crabs.tasks().length > 0, fest: C.festivalOn(ms) || null };
    }));
  }
  const early = rows.filter((r) => r.d <= 2), later = rows.filter((r) => r.d > 2);
  assert(early.length === 3 && early.every((r) => !r.mystery && !r.task && !r.hook), JSON.stringify(early));
  assert(early.every((r) => r.crab), `the day's crab stays: ${JSON.stringify(early)}`);
  assert(later.some((r) => r.task) && later.some((r) => r.mystery) && later.some((r) => r.hook), JSON.stringify(later));
  // an island from before (no S.born) is never new
  const old = await page.evaluate(async () => { const C = await import('/src/scenes/solo/calendar.js'); return [C.newcomer?.({}, 5), C.newcomer?.({ born: 5 }, 7), C.newcomer?.({ born: 5 }, 8)]; });
  assert(old.join() === 'false,true,false', old.join());
});

await test('4. Grumbleton\'s tournament "!" only on Wednesdays and on the first day of the 5-heart offer; he still asks on other days', async () => {
  await startIsland(page, { time: at(2026, 11, 19, 10), save: `(S) => { S.sea.rod = true; S.sea.quest = 2; S.npcs.grumbleton = { pts: 60, talkAt: 0, giftAt: 0, ev: 0, q: 0, met: true }; }` });
  const rows = [];
  for (let d = 0; d < 8; d++) {
    const ms = at(2026, 11, 19 + d, 10); // Thursday 19 November on
    rows.push(await island(page, (I, S, G, ms) => ({ wd: new Date(ms).getDay(), bang: I.tour.newsToday(ms), asks: I.tour.available(ms) }), ms));
  }
  const bangs = rows.filter((r) => r.bang).map((r) => r.wd);
  assert(bangs.length === 2 && bangs[0] === 4 && bangs[1] === 3, `the first day (a Thursday) and the Wednesday: ${JSON.stringify(rows)}`);
  assert(rows.filter((r) => r.wd !== 0 && r.wd !== 6).every((r) => r.asks), `he still asks on the other days: ${JSON.stringify(rows)}`);
});

await test('5. a torn page given on the week\'s last two days stays three days more; then the next chapter; never two at once', async () => {
  const chapter = async (startMs, days) => {
    await startIsland(page, { time: startMs });
    await island(page, (I) => { I.hud.setPanel(null); I.mode = 'walk'; });
    const ok = await island(page, (I) => { const h = I.npc('hoot'); if (!I.events.hasNews('hoot')) return false; I.events.talk(h, () => {}); I.hud.setDialog(null); I.dlg = null; I.hud.setPanel(null); I.mode = 'walk'; return true; });
    assert(ok, 'Hoot has the page');
    const out = [];
    for (const d of days) {
      await page.evaluate((ms) => { window.__islandTimeOffset = ms - Date.now(); }, startMs + d * DAY);
      await sim(page, 1.2);
      out.push(await island(page, (I, S) => ({ d: 0, task: I.events.tasks()[0] || '', mound: I.events.mound.visible, hoot: I.events.hasNews('hoot'), step: S.mystery.step })));
    }
    return out.map((r, i) => ({ ...r, d: days[i] }));
  };
  // given on a Sunday (22 Nov 2026, the summer week's last day): Monday to Wednesday it stays, Thursday it is gone
  const sun = await chapter(at(2026, 11, 22, 11), [1, 2, 3, 4]);
  assert(sun.slice(0, 3).every((r) => /dig at the X/.test(r.task) && r.mound && !r.hoot && r.step === 1), `three more days: ${JSON.stringify(sun)}`);
  assert(sun[3].step === 0 && !sun[3].task && !sun[3].mound, `then gone: ${JSON.stringify(sun[3])}`);
  assert(sun[3].hoot, `and the new week's chapter can start: ${JSON.stringify(sun[3])}`);
  // given on a Wednesday: gone with its week, as before
  const wed = await chapter(at(2026, 11, 18, 11), [5]);
  assert(wed[0].step === 0 && !wed[0].task, JSON.stringify(wed));
});

await test('A. a rare event moved off a busy week with no free day left is not skipped: it comes on the first quiet day visited', async () => {
  // the fog moved off Tue 24 Nov 2026 with nowhere to go that week; the child visits every day from Wed 25 Nov
  const di = (y, m, d) => Math.round((new Date(y, m - 1, d, 12).getTime() - new Date(1970, 0, 1, 12).getTime()) / 864e5);
  await startIsland(page, { time: at(2026, 11, 25, 10), save: `(S) => { S.rareMove = { from: ${di(2026, 11, 24)}, to: null, kind: 'fog' }; }` });
  const log = [];
  for (let d = 25; d <= 34; d++) {
    const ms = at(2026, 11, d, 10);
    await page.evaluate((ms) => { window.__islandTimeOffset = ms - Date.now(); }, ms);
    await sim(page, 1.3);
    log.push(await island(page, (I, S, G, ms) => ({ day: new Date(ms).getDate(), rare: I.events.kind, move: S.rareMove && { ...S.rareMove } }), ms));
  }
  const fogs = log.filter((x) => x.rare === 'fog');
  // Dec 3 (day 33 here) is the first quiet day: Nov 25 meteor, 26 storm, 27 the day after a storm, 28-30 surprises,
  // Dec 1 a fog of its own, Dec 2 the day after it
  assert(fogs.length === 2 && fogs[1].day === 3, `the moved fog came on Thursday 3 December: ${JSON.stringify(log.map((x) => [x.day, x.rare]))}`);
  assert(log.every((x) => !(x.rare && x.day === 3 && x.move?.kind !== 'fog')), 'one special thing that day');
});

await test('no console errors', async () => { assert(!page.errors.length, page.errors.join('\n')); });
await close(page);
done();
