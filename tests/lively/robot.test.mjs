// Part 5: Pip's robot Bolt, after the greenhouse: the letter, the scene, the daily chores, resting.
import { open, close, startIsland, island, sim, at, setTime, test, assert, done, shot, dismiss, DAY } from './helper.mjs';

const page = await open();
const D0 = at(2026, 11, 17, 8);
const closeBoard = () => island(page, (I) => { if (I.mode === 'today') { I.hud.setPanel(null); I.mode = 'walk'; } });

await test('no robot before the greenhouse is fixed', async () => {
  await startIsland(page, { time: D0 });
  await closeBoard();
  await setTime(page, D0 + DAY);
  await sim(page, 2);
  const r = await island(page, (I, S) => ({ robot: S.robot, vis: I.robot.model.visible }));
  assert(!r.robot && !r.vis, JSON.stringify(r));
});

await test('greenhouse fixed: Pip writes, the next day Bolt is there and Pip shows it', async () => {
  await startIsland(page, { time: D0, save: (S) => { S.unlocks.greenhouse = true; S.unlocks.barn = true; S.npcs.pip = { pts: 30, talkAt: 0, giftAt: 0, ev: 9, q: 9, met: true }; } });
  await closeBoard();
  const day1 = await island(page, (I, S) => ({ robot: S.robot, mail: S.mail.map((m) => m.id), vis: I.robot.model.visible }));
  assert(day1.robot && !day1.robot.built && day1.mail.includes('robot') && !day1.vis, JSON.stringify(day1));
  // the next day, 9:00 (Pip is out): the board says so, and walking up to the greenhouse plays the scene
  await setTime(page, D0 + DAY + 3600e3);
  await sim(page, 2);
  const items = await island(page, (I, S) => S.todayBoard.items.map((i) => i.k));
  assert(items.includes('td.robot.built'), items.join());
  await closeBoard();
  await island(page, (I) => { const d = I.robot.dock(); I.player.x = d.x + 2; I.player.z = d.z + 2; I.groundCheck(I.player, I.walkState); });
  await sim(page, 0.5);
  const sc = await island(page, (I, S) => ({ mode: I.mode, built: S.robot.built, lines: I.dlg?.lines.map((l) => l.key) }));
  assert(sc.mode === 'dialog' && sc.built && sc.lines.includes('rb.bolt.hello'), JSON.stringify(sc));
  await shot(page, 'lively-robot-meet');
  await dismiss(page, 6);
});

await test('chores: Bolt waters dry crops (field and greenhouse), takes the eggs, tops up the trough; you harvest', async () => {
  await island(page, (I, S) => {
    const at = Date.now() + window.__islandTimeOffset;
    // dry crops: two on the field, one in the greenhouse, and a ripe one Bolt must leave
    for (const k of ['1,1', '2,1', 'g0,0']) S.tiles[k] = { s: 'till', crop: 'radish', growth: 0, wetUntil: 0, last: at };
    S.tiles['3,2'] = { s: 'till', crop: 'carrot', growth: 1e9, wetUntil: 0, last: at };
    S.ranch.nest = 3; S.ranch.trough = 1;
    S.chest.push({ id: 'hay', n: 10 });
    S.robot.day = ''; // (a fresh day for the chores)
  });
  await sim(page, 1.2);
  const start = await island(page, (I) => I.robot.run && I.robot.run.steps.map((s) => s.do));
  assert(start && start.filter((x) => x === 'water').length === 3 && start.includes('eggs') && start.includes('hay') && start.at(-1) === 'home', JSON.stringify(start));
  await sim(page, 20, 1 / 20);
  await shot(page, 'lively-robot-chores');
  await sim(page, 80, 1 / 10);
  const r = await island(page, (I, S) => {
    const at = Date.now() + window.__islandTimeOffset;
    return { run: !!I.robot.run, wet: ['1,1', '2,1', 'g0,0'].map((k) => S.tiles[k].wetUntil > at), ripe: S.tiles['3,2'].crop, eggs: S.robot.eggs, nest: S.ranch.nest, trough: S.ranch.trough, chestHay: S.chest.find((x) => x.id === 'hay')?.n, last: I.robot.lastRun?.did };
  });
  assert(!r.run && r.wet.every(Boolean) && r.ripe === 'carrot', JSON.stringify(r));
  assert(r.eggs === 3 && r.nest === 0 && r.trough >= 7 && r.chestHay <= 3, JSON.stringify(r));
  // the eggs are yours when you talk to Bolt
  const got = await island(page, (I, S) => { const d = I.robot.dock(); I.player.x = d.x + 0.8; I.player.z = d.z + 0.8; const n = S.inv.filter((x) => x.id === 'egg').reduce((a, b) => a + b.n, 0); const ia = I.interactions(); ia.b.fn(); return S.inv.filter((x) => x.id === 'egg').reduce((a, b) => a + b.n, 0) - n; });
  assert(got === 3, `eggs ${got}`);
  await dismiss(page, 3);
  // only once a day
  await sim(page, 3);
  assert(!(await island(page, (I) => I.robot.run)), 'no second round today');
});

await test('rest: told to rest, Bolt stays on its pad (today, or until told)', async () => {
  // rest until I say
  await island(page, (I) => { I.robot.talk(); });
  await island(page, (I) => { I.dlg.choice = 2; });
  await dismiss(page, 4);
  assert(await island(page, (I, S) => S.robot.rest) === 'always', 'resting');
  const tomorrow = await island(page, (I) => Date.now() + window.__islandTimeOffset + 86400000);
  await setTime(page, tomorrow);
  await sim(page, 3);
  await island(page, (I) => { if (I.mode === 'today') { I.hud.setPanel(null); I.mode = 'walk'; } });
  await sim(page, 2);
  assert(!(await island(page, (I) => I.robot.run)), 'no chores while resting');
  // back to work
  await island(page, (I) => { I.robot.talk(); });
  await island(page, (I) => { I.dlg.choice = 0; });
  await dismiss(page, 4);
  await sim(page, 2);
  const r = await island(page, (I, S) => ({ rest: S.robot.rest, run: !!I.robot.run || S.robot.day === S.todayBoard.day }));
  assert(r.rest === false && r.run, JSON.stringify(r));
});

await test('no console errors', async () => { assert(!page.errors.length, page.errors.join('\n')); });
await close(page);
done();
