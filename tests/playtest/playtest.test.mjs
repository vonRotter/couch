// Fixes from the play-test pass over a simulated month (tests/playtest/LOG.md): each test is one thing a child ran
// into on the solo island, checked so it stays fixed.
import { open, close, startIsland, island, sim, at, test, assert, done, press, dismiss, shot } from '../lively/helper.mjs';

const page = await open();
const BEACH_DAY = at(2026, 11, 21, 9, 30); // a Saturday: the season's festival (Beach Day)

await test('a new island on a festival day: no puzzle lock on top of it, nor while the farming steps run; it comes on a quiet day', async () => {
  const r = await page.evaluate(async (t0) => {
    const Z = await import('/src/scenes/solo/puzzles.js');
    const C = await import('/src/scenes/solo/calendar.js');
    const S = { intro: true, tut: 8, hops: { chests: {} }, unlocks: {} };
    const out = { festival: !!C.festivalOn(t0), onFestival: Z.puzzleDue(S, t0) };
    out.inSteps = Z.puzzleDue({ ...S, tut: 3 }, t0 + 3 * 864e5);
    // the next days: it comes on the first quiet one
    for (let d = 1; d < 10 && !out.came; d++) {
      const t = t0 + d * 864e5;
      const id = Z.schedule(S, t);
      if (id) out.came = { id, quiet: C.freeDay(t), d };
    }
    return out;
  }, BEACH_DAY);
  assert(r.festival, 'the date is a festival day');
  assert(r.onFestival === null, `no puzzle on the festival day: ${r.onFestival}`);
  assert(r.inSteps === null, `none while the farming steps run: ${r.inSteps}`);
  assert(r.came && r.came.quiet, `then on a quiet day: ${JSON.stringify(r.came)}`);
});

await test('the first farming step tops the task list while the steps run; every step names its button', async () => {
  await startIsland(page, { time: BEACH_DAY, save: (S) => { S.tut = 2; S.inv.push({ id: 'radishSeed', n: 6, slot: 1 }); } });
  await island(page, (I) => { if (I.mode === 'today') { I.hud.setPanel(null); I.mode = 'walk'; } });
  const r = await island(page, (I) => ({ tasks: I.tasks(), fest: I.seasons.tasks() }));
  assert(r.fest.length > 0, 'the festival has a task today');
  assert(/Plant radish seeds/.test(r.tasks[0]), `the step first: ${r.tasks.join(' | ')}`);
  const steps = await page.evaluate(async () => {
    const { t, setLang } = await import('/src/core/i18n.js');
    return [1, 2, 3, 5].map((n) => t(`isl.tut.${n}`));
  });
  assert(steps.every((s) => /\[B\]|\bE\b|press|trykk|med/.test(s)), steps.join(' | '));
});

await test('toasts: one at a time, wrapped and clear of the task list', async () => {
  await island(page, (I, S, G) => {
    G.ui.toast('🧩 Something new on the island: an old door in the cliff behind Aunt Hazel\'s! It is on your map.', 3000);
    G.ui.toast('Today: Beach Day!', 2000);
  });
  await sim(page, 0.3);
  const r = await page.evaluate(() => {
    const els = [...document.querySelectorAll('.ui-toast .toast')];
    const tasks = document.querySelector('.isl-tasks').getBoundingClientRect();
    const b = els[0]?.getBoundingClientRect();
    return { n: els.length, right: b?.right, tasksLeft: tasks.left, tasksBottom: tasks.bottom, top: b?.top };
  });
  assert(r.n === 1, `one toast showing: ${r.n}`);
  assert(r.right < r.tasksLeft || r.top > r.tasksBottom, `clear of the task list: ${JSON.stringify(r)}`);
  await shot(page, 'playtest-toast');
  await sim(page, 3.2);
  const second = await page.evaluate(() => [...document.querySelectorAll('.ui-toast .toast')].map((e) => e.textContent));
  assert(second.length === 1 && /Beach Day/.test(second[0]), `then the next: ${second}`);
});

await test('a dialog hides the held thing\'s name (it peeked out between the dialog and the hotbar)', async () => {
  await sim(page, 2.5);
  await island(page, (I) => I.say([{ who: 'hazel', key: 'isl.hazel.tutSkip' }]));
  await sim(page, 0.2);
  const hid = await page.evaluate(() => getComputedStyle(document.querySelector('.isl-selname')).opacity);
  assert(hid === '0', `hidden: ${hid}`);
  await dismiss(page);
  const back = await page.evaluate(() => getComputedStyle(document.querySelector('.isl-selname')).opacity);
  assert(back === '1', `back: ${back}`);
});

await test('no console errors', async () => { assert(!page.errors.length, page.errors.join('\n')); });
await close(page);
done();
