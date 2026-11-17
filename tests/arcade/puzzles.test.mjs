// Puzzles in the world (src/scenes/solo/puzzles.js): puzzle locks on hidden chests and three puzzle doors. The pace
// (about one a week, on a quiet day, never two waiting, round the map, the same from the date), playing one over the
// island, solving -> the reward, a skip offered after tries -> the reward (marked skipped, playable again), the
// trophy after the last, and old saves.
import { open, close, startIsland, island, sim, at, setTime, test, assert, done, press, dismiss, DAY } from '../lively/helper.mjs';
import { R, answerOffer, setAssist } from './arcade.mjs';

const page = await open();
const D0 = at(2026, 11, 16, 12); // a Monday

/** Simulate weeks of days in the page with the pure pace functions. solveAfter: days until the child solves (-1 never). */
const simulate = (opts) => page.evaluate(async ({ start, weeks, solveAfter, chests, bridge }) => {
  const Z = await import('/src/scenes/solo/puzzles.js');
  const C = await import('/src/scenes/solo/calendar.js');
  const H = await import('/src/scenes/solo/hopdata.js');
  const S = { intro: true, hops: { chests: Object.fromEntries(chests.map((c) => [c, { n: 1 }])) }, unlocks: { bridge } };
  const pos = (id) => { const p = Z.puzzleById(id); return p.door ? H.PUZZLE_DOORS[p.door] : H.SECRETS[p.chest].chest; };
  const log = [];
  const d0 = new Date(start);
  for (let d = 0; d < weeks * 7; d++) {
    for (const h of [8, 12, 17, 21]) {
      const t = new Date(d0.getFullYear(), d0.getMonth(), d0.getDate() + d, h).getTime();
      const waiting = S.puzzles?.cur || null;
      const id = Z.schedule(S, t);
      if (id) log.push({ id, day: C.dayIndex(t), week: C.weekIndex(t), quiet: C.freeDay(t), was: waiting, ...pos(id) });
      const cur = S.puzzles.cur;
      if (cur && solveAfter >= 0 && C.dayIndex(t) - C.dayIndex(S.puzzles.at[cur]) >= solveAfter) Z.markDone(S, cur, { at: t });
    }
  }
  return { log, open: S.puzzles.cur };
}, { start: D0, weeks: 8, solveAfter: 0, chests: ['grove', 'ledge', 'roof', 'hollow', 'islet'], bridge: true, ...opts });

await test('pace over 8 weeks (solved the same day): one a week, on a quiet day, in the order round the map', async () => {
  const { log } = await simulate({});
  assert(log.length === 8, `eight puzzles in eight weeks (${log.map((l) => l.id)})`);
  assert(new Set(log.map((l) => l.week)).size === 8, 'one a week');
  assert(log.every((l) => l.quiet), 'never on a festival, surprise or rare-event day');
  assert(log.every((l) => !l.was), 'never while one waits');
  assert(log.map((l) => l.id).join() === 'cliffdoor,hollow,rockdoor,islet,grove,treedoor,ledge,roof', log.map((l) => l.id).join());
  for (let i = 1; i < log.length; i++) { const d = Math.hypot(log[i].x - log[i - 1].x, log[i].z - log[i - 1].z); assert(d > 15, `spread over the map: ${log[i - 1].id} -> ${log[i].id} is ${d.toFixed(1)} m`); }
  const gaps = log.slice(1).map((l, i) => l.day - log[i].day);
  console.log(`   (measured: puzzle days ${log.map((l) => l.day - log[0].day).join(', ')}; gaps ${gaps.join(', ')} days)`);
  assert(gaps.every((g) => g >= 1 && g <= 13), `gaps ${gaps}`);
});

await test('pace: never more than one waiting (a slow child, or one who never solves)', async () => {
  const slow = await simulate({ solveAfter: 10 });
  assert(slow.log.every((l) => !l.was), 'none while one waits');
  assert(slow.log.length >= 4 && slow.log.length <= 6, `a slow child gets fewer (${slow.log.length})`);
  const never = await simulate({ solveAfter: -1 });
  assert(never.log.length === 1 && never.open === 'cliffdoor', JSON.stringify(never));
});

await test('pace: from the date (the same run twice is the same); unreachable ones wait for their chest or the bridge', async () => {
  const a = await simulate({}), b = await simulate({});
  assert(JSON.stringify(a.log) === JSON.stringify(b.log), 'deterministic');
  const fresh = await simulate({ chests: [], bridge: false });
  assert(fresh.log.map((l) => l.id).join() === 'cliffdoor,rockdoor', fresh.log.map((l) => l.id).join());
});

const puzzleDayOf = (ms) => page.evaluate(async (ms) => {
  const Z = await import('/src/scenes/solo/puzzles.js');
  const C = await import('/src/scenes/solo/calendar.js');
  const di = Z.puzzleDay(C.weekIndex(ms));
  return C.dayMs(di);
}, ms);

await test('on the island: the week\'s puzzle shows up (a toast, a lock over it, the map) and nothing more', async () => {
  const day = await puzzleDayOf(D0);
  await startIsland(page, { time: day });
  await sim(page, 2.5);
  const r = await island(page, (I, S) => ({ cur: S.puzzles.cur, lock: !!I.puzzles.lock, map: I.atlas.markers('main').filter((m) => m.key.startsWith('puzzle:')).map((m) => m.key) }));
  assert(r.cur === 'cliffdoor' && r.lock && r.map.join() === 'puzzle:cliffdoor', JSON.stringify(r));
  await setTime(page, day + 3 * DAY);
  await sim(page, 25, 1 / 10);
  assert(await island(page, (I, S) => S.puzzles.cur) === 'cliffdoor', 'still the one waiting');
});

const goTo = async (id) => {
  await dismiss(page); // (a new day's Today board)
  await island(page, (I, S, G, id) => { const w = I.puzzles.where(id); I.player.x = w.stand.x; I.player.z = w.stand.z; I.snapCamera(); }, id);
};

await test('solve -> the door opens, the prize is given, the next one can come next week', async () => {
  await setAssist(page, { offers: false });
  await goTo('cliffdoor');
  await sim(page, 0.4);
  const hint = await island(page, (I) => I.interactions().b?.text || '');
  assert(/puzzle lock/.test(hint), hint);
  const coins = await island(page, (I, S) => S.coins);
  await press(page, 'KeyE');
  await sim(page, 0.4);
  await page.evaluate(() => window.game.tutorialCard?.answer('skip'));
  await sim(page, 1.2);
  assert(await island(page, (I) => I.mode) === 'puzzle', 'playing over the island');
  assert(await page.evaluate(() => window.game.current.padLayout) === 'arcade', 'the arcade buttons');
  await R(page, (r, g) => { g.pos = { ...g.end }; g.from = { ...g.end }; g.state = 'won'; });
  await sim(page, 0.5);
  await press(page, 'KeyE');
  await sim(page, 1.5);
  await dismiss(page);
  const s = await island(page, (I, S) => ({ mode: I.mode, cur: S.puzzles.cur, done: S.puzzles.done.cliffdoor, coins: S.coins, deco: !!S.deco.minerLamp, open: I.puzzles.doors.cliffdoor.target }));
  assert(s.mode === 'walk' && !s.cur && s.done && !s.done.skipped && s.coins >= coins + 60 && s.deco && s.open === 1, JSON.stringify(s));
});

await test('leave a puzzle for now ([C]), then a skip offered after a few tries opens it anyway (marked skipped)', async () => {
  // next week's puzzle: the boulder door (Echo Bells)
  const next = await puzzleDayOf(D0 + 7 * DAY);
  await setTime(page, next);
  await sim(page, 25, 1 / 10);
  assert(await island(page, (I, S) => S.puzzles.cur) === 'rockdoor', 'the next one came');
  await goTo('rockdoor');
  await sim(page, 0.3);
  await press(page, 'KeyE');
  await sim(page, 0.3);
  await page.evaluate(() => window.game.tutorialCard?.answer('skip'));
  await sim(page, 1.3);
  await press(page, 'KeyQ');
  await sim(page, 0.3);
  assert(await island(page, (I, S) => I.mode === 'walk' && S.puzzles.cur === 'rockdoor'), 'left, still waiting');
  await setAssist(page, { offers: true });
  await press(page, 'KeyE');
  await sim(page, 1.6);
  let kind = null;
  for (let i = 0; i < 8 && kind !== 'skip'; i++) {
    await R(page, (r) => r.fail('timing'));
    await sim(page, 0.1);
    kind = await page.evaluate(() => window.game.offer?.kind || null);
    if (kind && kind !== 'skip') await answerOffer(page, 'no');
  }
  assert(kind === 'skip', 'a skip was offered');
  await answerOffer(page, 'yes');
  await sim(page, 1);
  await dismiss(page);
  const s = await island(page, (I, S, G) => ({ mode: I.mode, done: S.puzzles.done.rockdoor, deco: !!S.deco.bellChime, skipped: G.roster.progress.skipped?.puzzles || [] }));
  assert(s.mode === 'walk' && s.done?.skipped && s.deco && s.skipped.includes('rockdoor'), JSON.stringify(s));
  // and it can be played again
  await goTo('rockdoor');
  await sim(page, 0.3);
  assert(/again/.test(await island(page, (I) => I.interactions().b?.text || '')), 'play it again');
  await setAssist(page, { offers: false });
});

await test('a puzzle lock on a hidden chest (only once the chest was found), solved -> the chest opens with its prize', async () => {
  await dismiss(page);
  await island(page, (I, S) => { S.hops.chests.hollow = { n: 1, week: 0 }; S.puzzles.cur = 'hollow'; S.puzzles.at.hollow = Date.now(); I.puzzles.refresh(); });
  const hint = await island(page, (I) => { const c = I.hops.chests.hollow; const out = {}; I.hops.interactions({ x: c.x, z: c.z, fy: c.y }, out, (k) => k, true); return out.b?.text || ''; });
  assert(/pz\.h\.try/.test(hint), hint);
  await island(page, (I) => I.puzzles.start('hollow'));
  await sim(page, 0.3);
  await page.evaluate(() => window.game.tutorialCard?.answer('skip'));
  await sim(page, 1.3);
  await R(page, (r, g) => { for (const [c, rr] of r.puzzle.lights.taps) g.tap(c, rr); });
  await sim(page, 0.4);
  await press(page, 'KeyE');
  await sim(page, 1.5);
  const s = await island(page, (I, S) => ({ cur: S.puzzles.cur, done: !!S.puzzles.done.hollow, deco: !!S.deco.sleepyLantern }));
  assert(!s.cur && s.done && s.deco, JSON.stringify(s));
});

await test('every puzzle starts over the island with its goal on screen, and [C] leaves it for later', async () => {
  const ids = await page.evaluate(async () => (await import('/src/scenes/solo/puzzles.js')).PUZZLE_IDS);
  for (const id of ids) {
    await dismiss(page);
    await island(page, (I, S, G, id) => { I.mode = 'walk'; I.puzzles.start(id); }, id);
    await sim(page, 0.3);
    await page.evaluate(() => window.game.tutorialCard?.answer('skip'));
    await sim(page, 1.3);
    const r = await R(page, (r, g) => ({ key: r.key, st: r.state, goal: g.goalText?.() || '', hud: r.hudEl.textContent }));
    assert(r.st === 'play' && r.goal.length > 3 && r.hud.includes(r.goal), `${id}: ${JSON.stringify(r)}`);
    await press(page, 'KeyQ');
    await sim(page, 0.2);
    assert(await island(page, (I) => I.mode) !== 'puzzle', `${id}: left`);
  }
});

await test('the last one brings the puzzle trophy to the shelf', async () => {
  await island(page, (I, S) => { for (const id of ['islet', 'grove', 'treedoor', 'ledge']) S.puzzles.done[id] = { at: 1, skipped: false }; S.hops.chests.roof = { n: 1 }; S.puzzles.cur = 'roof'; I.puzzles.refresh(); I.puzzles.start('roof'); });
  await sim(page, 0.3);
  await page.evaluate(() => window.game.tutorialCard?.answer('skip'));
  await sim(page, 1.3);
  await R(page, (r, g) => { g.state = 'won'; });
  await sim(page, 0.4);
  await press(page, 'KeyE');
  await sim(page, 3);
  const s = await island(page, (I, S) => ({ trophy: !!S.deco.puzzleTrophy, shelf: I.shelf.owned('puzzleTrophy'), rock: !!S.deco.spaceRock }));
  assert(s.trophy && s.shelf && s.rock, JSON.stringify(s));
});

await test('an old save (from before this round) opens: the hall, the puzzles from here on, no errors', async () => {
  const OLD = {
    v: 1, intro: true, tut: 8, coins: 200, inv: [{ id: 'zipzap', n: 1, slot: 0 }], invV: 2, bagRows: 2, chest: [], sel: 0, zz: { area: 0, speed: 0, range: 0, power: 0 },
    tiles: {}, weeds: [], npcs: {}, quests: {}, unlocks: { bridgeWood: 0, bridge: false, mineHits: 0, mine: false, burrow: false, rockBuster: false },
    branches: {}, found: {}, rewards: {}, mail: [], deco: {}, stats: { harvested: 0, shipped: 0, earned: 0 }, last: { place: 'tachyon', at: 0 },
    sea: { rod: false, suit: false, quest: 0, log: {}, caught: 0, dives: 0, haul: null }, cafe: { repaired: false, wood: 0, served: 0, earned: 0, nights: 0, cooked: 0 },
    hops: { chests: { grove: { n: 2, week: 2900 } }, best: {}, wins: {}, runs: {} },
  };
  await startIsland(page, { time: await puzzleDayOf(D0), raw: OLD });
  await sim(page, 3);
  const r = await island(page, (I, S, G) => ({
    cabs: I.map.places.filter((p) => p.cabinet !== undefined).length, guests: I.map.places.filter((p) => p.guest).map((p) => p.id).join(),
    pz: S.puzzles && S.puzzles.cur, arcade: G.roster.progress.arcade || null, coins: S.coins,
  }));
  assert(r.cabs === 13 && r.guests === 'tachyon,starlite,foothold,starhop' && r.pz === 'cliffdoor' && r.coins === 200, JSON.stringify(r));
  assert(!page.errors.length, page.errors.join('\n'));
});

await test('no console errors', async () => { assert(!page.errors.length, page.errors.join('\n')); });
await close(page);
done();
