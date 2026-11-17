// Part 1: the Today board and the tomorrow hooks.
import { open, close, startIsland, island, sim, at, setTime, test, assert, done, shot, DAY } from './helper.mjs';

const page = await open();
const D0 = at(2026, 11, 17, 10); // a Tuesday

await test('today board: up to 3 items, shown on the first visit of a day', async () => {
  await startIsland(page, { time: D0 });
  await sim(page, 2);
  const r = await island(page, (I, S) => ({ mode: I.mode, n: S.todayBoard.items.length, day: S.todayBoard.day, text: I.hud.panel.innerText }));
  assert(r.n >= 1 && r.n <= 3, `items: ${r.n}`);
  assert(r.mode === 'today', `mode ${r.mode}`);
  assert(r.text.includes('Today on the island'), r.text);
  await shot(page, 'lively-today-board');
  // closing it, then coming back the same day: not shown again
  await island(page, (I) => { I.todayBoard.updateBoard({ aPressed: true }); I.todayBoard.t = 1; I.todayBoard.updateBoard({ aPressed: true }); });
  await sim(page, 3);
  assert(await island(page, (I) => I.mode) === 'walk', 'board closed');
});

await test('today board: a day with three things has three (a festival day with a birthday)', async () => {
  // 2026-11-20 is a Friday (Beach Day in this summer week) and Keeper Bram's birthday; a hook is made too
  await startIsland(page, { time: at(2026, 11, 20, 10) });
  await sim(page, 2);
  const n = await island(page, (I, S) => S.todayBoard.items.length);
  assert(n === 3, `items ${n}`);
});

await test('today board: deterministic by date, different across days', async () => {
  const days = [];
  for (let d = 0; d < 7; d++) {
    await startIsland(page, { time: D0 + d * DAY, name: `A${d}` });
    const a = await island(page, (I, S) => S.todayBoard.items.map((i) => i.k + JSON.stringify(i.v || {})).join(';'));
    await startIsland(page, { time: D0 + d * DAY, name: `B${d}` });
    const b = await island(page, (I, S) => S.todayBoard.items.map((i) => i.k + JSON.stringify(i.v || {})).join(';'));
    assert(a === b, `day ${d}: ${a} vs ${b}`);
    days.push(a);
  }
  assert(new Set(days).size >= 6, `distinct days: ${new Set(days).size} of 7: ${days.join(' | ')}`);
});

await test('today board: in the journal (Tasks tab) with the tomorrow line', async () => {
  await startIsland(page, { time: D0 });
  await island(page, (I) => { I.hud.setPanel(null); I.mode = 'walk'; I.journal.open('tasks'); });
  await sim(page, 0.2);
  const txt = await island(page, (I) => I.hud.panel.innerText);
  const items = await island(page, (I) => I.todayBoard.texts());
  assert(txt.includes('Today'), txt);
  for (const s of items) assert(txt.includes(s), `missing ${s}`);
  await shot(page, 'lively-today-journal');
});

/** Find the next day (from ms) where a hook of the wanted kind is made, with S.hookN set for it. */
async function makeHook(kind) {
  return island(page, (I, S, G, kind) => {
    const order = ['egg', 'letter', 'pot'];
    for (let d = 0; d < 40; d++) {
      const ms = window.__now0 + d * 86400000;
      S.hook = null; S.hookLast = -99; S.hookN = order.indexOf(kind);
      const H = I.todayBoard.issueHook(ms);
      if (H && H.kind === kind) return { d, H, mail: S.mail.map((m) => m.id) };
    }
    return null;
  }, kind);
}

await test('tomorrow hooks: the egg hatches the next day (a chick with a barn, else a duckling)', async () => {
  await startIsland(page, { time: D0, save: (S) => { S.unlocks.barn = true; } });
  await page.evaluate((t) => { window.__now0 = t; }, D0);
  const r = await makeHook('egg');
  assert(r && r.H.due === r.H.made + 1, JSON.stringify(r));
  await island(page, (I, S) => { S.todayBoard = { day: 'x', items: [], shown: true }; I.todayBoard.day = ''; });
  await setTime(page, D0 + r.d * DAY);
  await sim(page, 1.5);
  let st = await island(page, (I, S) => ({ ready: !!S.hook?.ready, tm: I.todayBoard.tomorrowLine() }));
  assert(!st.ready && /hatches/.test(st.tm), JSON.stringify(st));
  await setTime(page, D0 + (r.d + 1) * DAY);
  await sim(page, 1.5);
  st = await island(page, (I, S) => ({ ready: !!S.hook?.ready, items: S.todayBoard.items.map((i) => i.k) }));
  assert(st.ready && st.items.includes('td.hook.egg'), JSON.stringify(st));
  const after = await island(page, (I, S) => { const n = S.ranch.animals.length; I.todayBoard.useHook(); return { hook: S.hook, done: S.hookDone, chicks: S.ranch.animals.length - n }; });
  assert(after.hook === null && after.done.result === 'chick' && after.chicks === 1, JSON.stringify(after));
});

await test('tomorrow hooks: the mystery pot opens two days later', async () => {
  await startIsland(page, { time: D0 });
  await page.evaluate((t) => { window.__now0 = t; }, D0);
  const r = await makeHook('pot');
  assert(r && r.H.due === r.H.made + 2, JSON.stringify(r));
  await island(page, (I, S) => { S.todayBoard = { day: 'x', items: [], shown: true }; I.todayBoard.day = ''; });
  await setTime(page, D0 + (r.d + 1) * DAY);
  await sim(page, 1.5);
  assert(!(await island(page, (I, S) => S.hook.ready)), 'not yet');
  assert(/opens!/.test(await island(page, (I) => I.todayBoard.tomorrowLine())), 'tomorrow line');
  await setTime(page, D0 + (r.d + 2) * DAY);
  await sim(page, 1.5);
  await shot(page, 'lively-hook-pot');
  const res = await island(page, (I, S) => { const b = S.inv.find((x) => x.id === 'bouquet')?.n || 0; I.todayBoard.useHook(); return { hook: S.hook, got: (S.inv.find((x) => x.id === 'bouquet')?.n || 0) - b }; });
  assert(res.hook === null && res.got === 2, JSON.stringify(res));
});

await test('tomorrow hooks: a letter says the day, and the visitor comes that day', async () => {
  await startIsland(page, { time: D0 });
  await page.evaluate((t) => { window.__now0 = t; }, D0);
  const r = await makeHook('letter');
  assert(r && r.mail.some((m) => m.startsWith('td.')), JSON.stringify(r));
  const due = r.H.due, who = r.H.who;
  const kind = await page.evaluate(async (ms) => (await import('/src/scenes/solo/calendar.js')).surpriseOn(ms), D0 + (due - r.H.made + r.d) * DAY);
  assert(kind === who, `${kind} vs ${who}`);
  await island(page, (I, S) => { S.todayBoard = { day: 'x', items: [], shown: true }; I.todayBoard.day = ''; });
  await setTime(page, D0 + (r.d + due - r.H.made) * DAY);
  await sim(page, 1.5);
  const st = await island(page, (I, S) => ({ hook: S.hook, items: S.todayBoard.items.map((i) => i.k) }));
  assert(!st.hook && st.items.includes(`td.sur.${who}.letter`), JSON.stringify(st));
});

await test('tomorrow hooks: one at a time', async () => {
  await startIsland(page, { time: D0 });
  let max = 0;
  for (let d = 0; d < 21; d++) {
    await setTime(page, D0 + d * DAY);
    await sim(page, 1.2);
    const n = await island(page, (I, S) => (S.hook ? 1 : 0));
    max = Math.max(max, n);
  }
  assert(max <= 1, 'one hook');
});

await test('no console errors', async () => { assert(!page.errors.length, page.errors.join('\n')); });

await close(page);
done();
