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

await test('a burst of toasts goes by quicker (no long trail after the moment)', async () => {
  await sim(page, 4);
  await island(page, (I, S, G) => { for (const x of ['one', 'two', 'three', 'four']) G.ui.toast(x, 2600); });
  await sim(page, 0.2);
  const left = await island(page, (I) => I.toasts.shown[0].left);
  assert(left < 2000, `the first of four is shorter: ${left}`);
  await sim(page, 8.6);
  const left2 = await island(page, (I) => I.toasts.texts);
  assert(left2.length === 0, `all four gone in under nine seconds (four full ones took 10.4): ${left2}`);
});

await test('the Zip-Zap hint names its hotbar key (not the bag key), and the day\'s news toast is said once a day', async () => {
  await island(page, (I) => { I.mode = 'walk'; });
  await island(page, (I) => I.selectItem('radishSeed'));
  // face untilled soil
  await island(page, (I) => { const P = I.player; P.x = -16.4; P.z = -6.5 - 1.1; P.fx = 0; P.fz = 1; P.ch.face(0, 1); I.groundCheck(P, I.walkState); });
  await sim(page, 0.2);
  const u = await island(page, (I) => I.useAction(I.interactions())?.text || '');
  assert(/\(1\)/.test(u), `names key 1: ${u}`);
  // the festival's news toast came on arrival; coming back to the island the same day does not say it again
  await page.evaluate(() => window.game.enterSolo(window.__testProfile, 'kb0'));
  await page.waitForFunction(() => window.game.current?.constructor?.name === 'SoloIslandScene' && !window.game.switching && window.game.current.player, null, { timeout: 30000 });
  await sim(page, 3.5);
  const tx = await island(page, (I) => I.toasts.texts);
  assert(!tx.some((x) => /Beach Day/.test(x)), `not again: ${tx}`);
});

await test('a quest for a crop that does not grow this season says when it does', async () => {
  const r = await island(page, (I, S) => { S.quests.hazel = { n: 1 }; return I.questText('hazel', 1); });
  assert(/lettuce grows in spring or winter/.test(r), r);
});

await test('in the Game Hall toasts go up under the clock, clear of the cabinet\'s name tag', async () => {
  await island(page, (I) => { I.mode = 'walk'; const P = I.player; P.x = 27 - 4.4 + 4 * 1.1; P.z = -15 - 0.85 + 0.2; P.fx = 0; P.fz = -1; I.groundCheck(P, I.walkState); });
  await sim(page, 1.5);
  await island(page, (I, S, G) => G.ui.toast('Coach Bo: Echo Bells trains your memory. Listen, watch, then ring it back!', 3000));
  await sim(page, 0.4);
  const r = await page.evaluate(() => {
    const tag = [...document.querySelectorAll('.label.isl-tag')].find((e) => e.style.display !== 'none' && /Best|not played|new/i.test(e.textContent) || e.style.display !== 'none' && e.textContent.length > 0 && e.getBoundingClientRect().top < 300);
    const toast = document.querySelector('.ui-toast .toast');
    const a = tag?.getBoundingClientRect(), b = toast?.getBoundingClientRect();
    return { tag: tag?.textContent, a: a && { t: a.top, b: a.bottom, l: a.left, r: a.right }, b: b && { t: b.top, b: b.bottom, l: b.left, r: b.right } };
  });
  assert(r.a && r.b, JSON.stringify(r));
  const overlap = !(r.a.b <= r.b.t || r.b.b <= r.a.t || r.a.r <= r.b.l || r.b.r <= r.a.l);
  assert(!overlap, `the toast and the tag do not overlap: ${JSON.stringify(r)}`);
  await shot(page, 'playtest-hall-toast');
  await sim(page, 3.5);
});

await test('pausing over a game\'s card hides the card until the pause menu closes', async () => {
  const r = await page.evaluate(() => {
    const G = window.game, card = G.ui.panel('<b>Play again</b>', 'panel test-card');
    G.openPause();
    const hidden = card.style.display === 'none';
    G.closePause();
    const back = card.style.display !== 'none';
    card.remove();
    return { hidden, back };
  });
  assert(r.hidden && r.back, JSON.stringify(r));
});

await test('the speckled egg\'s basket by the shipping bin: walking up to it, the basket answers (not the bin)', async () => {
  const r = await island(page, (I, S) => {
    I.mode = 'walk';
    const sp = I.todayBoard.hookSpot();
    S.hook = { kind: 'egg', due: 0, made: 0, x: sp.x, z: sp.z, ready: true, readyDi: 0 };
    I.todayBoard.updateModel?.();
    const out = [];
    for (const [dx, dz] of [[0, 1.1], [0.8, 0.8], [-0.9, 0.6]]) {
      const P = I.player; P.x = sp.x + dx; P.z = sp.z + dz; const d = Math.hypot(dx, dz); P.fx = -dx / d; P.fz = -dz / d; I.groundCheck(P, I.walkState);
      out.push(I.useAction(I.interactions())?.text || '');
    }
    S.hook = null; I.todayBoard.updateModel?.();
    return out;
  });
  assert(r.every((x) => /egg|egget/i.test(x)), r.join(' | '));
});

await test('no console errors', async () => { assert(!page.errors.length, page.errors.join('\n')); });
await close(page);
done();
