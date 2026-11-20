// The odd-adventure round, part 2a: the little wizard school. Wendeline's lesson one (the rain spell's rune, one
// arrow at a time, nothing to fail) gives the wand; the rain spell waters the crops under its cloud (the whole field
// when you are at it), once a real day; lesson two (the sun spell) only after the sun's letter; the sun spell lifts the
// rain's look for an hour, never the calendar's weather; no spells indoors or on Shell Isle.
import { open, close, startIsland, island, sim, at, test, assert, done, press, shot, standAt, talkThrough, oddSave, DAY } from './lba2.mjs';

const page = await open();
const D0 = at(2026, 11, 18, 11); // a Wednesday

async function stick(dir) {
  const code = { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD' }[dir];
  await press(page, code);
  await sim(page, 0.1);
}

await test('lesson one: Wendeline at her tower, the rain rune (wrong arrows only wobble), the wand', async () => {
  await startIsland(page, { time: D0, save: oddSave({ school: 0 }) });
  await sim(page, 1.2);
  const pre = await island(page, (I) => ({ task: I.allTasks().some((x) => /Lesson one/.test(x)), tower: I.odd.wizard.tower.visible, w: I.odd.wizard.teacher.shown, mk: I.odd.markers().some((m) => m.key === 'odd:school') }));
  assert(pre.task && pre.tower && pre.w && pre.mk, JSON.stringify(pre));
  await standAt(page, -17.6, 28.4, [-1, 0]);
  const b = await island(page, (I) => I.interactions().b?.text);
  assert(/lesson with Wendeline/.test(b), b);
  await island(page, (I) => I.interactions().b.fn());
  await talkThrough(page);
  const m = await island(page, (I) => ({ mode: I.mode, html: I.hud.panel.innerText }));
  assert(m.mode === 'spell' && /Rain spell/.test(m.html), JSON.stringify(m));
  await shot(page, 'lba2-wizard-rune');
  await sim(page, 0.4); // (the rune takes no arrows for its first moment: the press that closed the talk never counts)
  // a wrong arrow does nothing bad; then up, down, down, right
  await stick('left');
  assert((await island(page, (I) => I.odd.wizard.rune.i)) === 0, 'a wrong arrow only wobbles');
  for (const d of ['up', 'down', 'down', 'right']) await stick(d);
  await sim(page, 0.3);
  await talkThrough(page);
  const r = await island(page, (I, S) => ({ mode: I.mode, learned: S.odd.wiz.lessons.rain, wand: S.inv.some((x) => x.id === 'wand') }));
  assert(r.mode === 'walk' && r.learned && r.wand, JSON.stringify(r));
});

await test('the rain spell waters every crop under its cloud (the whole field), once a real day', async () => {
  // plant a dry crop on four field tiles
  await island(page, (I, S) => {
    const t0 = Date.now() + window.__islandTimeOffset;
    for (const [c, r] of [[0, 0], [3, 2], [7, 5], [5, 1]]) S.tiles[`${c},${r}`] = { crop: 'radish', growth: 0, wetUntil: 0, last: t0 };
    I.farm.tick?.(t0);
  });
  await standAt(page, -12, -5);
  const slot = await island(page, (I, S) => S.inv.find((x) => x.id === 'wand').slot);
  await island(page, (I, S, G, slot) => { S.sel = slot; }, slot);
  await sim(page, 0.3);
  const use = await island(page, (I) => I.interactions().a?.text || I.useAction(I.interactions())?.text);
  assert(/cast a spell/.test(use), use);
  await island(page, (I) => I.interactions().a.fn());
  await talkThrough(page, 0);
  await sim(page, 0.4);
  for (const d of ['up', 'down', 'down', 'right']) await stick(d);
  await sim(page, 1.0);
  const r = await island(page, (I, S) => { const now = Date.now() + window.__islandTimeOffset; return { wet: ['0,0', '3,2', '7,5', '5,1'].map((k) => S.tiles[k].wetUntil > now), cloud: !!I.odd.wizard.cloud, rainy: I.seasons.rainy }; });
  await shot(page, 'lba2-wizard-rain');
  assert(r.wet.every(Boolean) && r.cloud && !r.rainy, JSON.stringify(r));
  // again today: the spell is tired (no rune)
  await island(page, (I) => I.odd.wizard.tryCast('rain'));
  const again = await island(page, (I) => I.mode);
  assert(again === 'walk', `tired: ${again}`);
  // tomorrow it works again
  await page.evaluate((ms) => { window.__islandTimeOffset = ms - Date.now(); }, D0 + DAY);
  await sim(page, 1.5);
  await standAt(page, -12, -5);
  await island(page, (I) => I.odd.wizard.tryCast('rain'));
  assert((await island(page, (I) => I.mode)) === 'spell', 'tomorrow it can be cast again');
  await island(page, (I) => { I.odd.wizard.rune = null; I.hud.setPanel(null); I.mode = 'walk'; });
});

await test('lesson two waits for the sun\'s letter; the sun spell lifts a rainy day\'s look for an hour, not the weather', async () => {
  const before = await island(page, (I) => I.odd.wizard.lessonDue());
  assert(before === null, `no lesson two yet: ${before}`);
  await island(page, (I, S) => { S.odd.got.sun = 0; });
  assert((await island(page, (I) => I.odd.wizard.lessonDue())) === 'sun', 'lesson two after the letter');
  await island(page, (I, S) => { S.odd.wiz.lessons.sun = true; });
  // a rainy day
  const rainy = await page.evaluate(async (d0) => { const C = await import('/src/scenes/solo/calendar.js'); for (let d = 2; d < 60; d++) { const ms = d0 + d * 86400000; if (C.rainyOn(ms) && !C.rareEventOn(ms)) return ms; } return null; }, D0);
  await page.evaluate((ms) => { window.__islandTimeOffset = ms - Date.now(); }, rainy);
  await sim(page, 2);
  await standAt(page, 8, 8);
  await island(page, (I) => { I.odd.wizard.tryCast('sun'); });
  await sim(page, 0.4);
  for (const d of ['up', 'right', 'down', 'left']) await stick(d);
  await sim(page, 0.5);
  const r = await island(page, (I) => ({ sunny: I.odd.wizard.sunny, rainy: I.seasons.rainy, rainShown: I.seasons.rain.visible }));
  assert(r.sunny && r.rainy && !r.rainShown, JSON.stringify(r));
  // an hour later the rain is back
  await page.evaluate((ms) => { window.__islandTimeOffset = ms - Date.now(); }, rainy + 61 * 60 * 1000);
  await sim(page, 1.5);
  const later = await island(page, (I) => ({ sunny: I.odd.wizard.sunny, shown: I.seasons.rain.visible || I.seasons.season === 'winter' }));
  assert(!later.sunny && later.shown, JSON.stringify(later));
});

await test('no spells indoors; the school\'s chats do not repeat within four weeks', async () => {
  await island(page, (I) => { const P = I.player; P.x = -12; P.z = -16.8; I.groundCheck(P, I.walkState); });
  const inside = await island(page, (I) => I.indoors);
  if (inside) {
    await island(page, (I) => I.odd.wizard.tryCast('rain'));
    assert((await island(page, (I) => I.mode)) === 'walk', 'no rune indoors');
  }
  const keys = await page.evaluate(async () => {
    const W = await import('/src/scenes/solo/wizard.js');
    const said = [], out = [];
    for (let di = 20000; di < 20028; di++) { const k = W.freshLine('wz.chat', 10, said, di, 3.1); if (k) { said.push({ k, di }); out.push(k); } }
    return out;
  });
  assert(keys.length === 10 && new Set(keys).size === 10, keys.join());
});

await test('no console errors', async () => { assert(!page.errors.length, page.errors.join('\n')); });
await close(page);
done();
