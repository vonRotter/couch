// A real-gamepad sanity pass (safety round), with a fake standard-mapping pad (as in tests/arcade/fixes.test.mjs):
// Start pauses, A picks and B never picks in every pause menu: a co-op game on the shared island, a Game Hall game,
// a puzzle lock over the island, a hop trail's run, the dive and Pillow Keep Solo; on the island itself Start
// opens the island's menu (B closes it, never picks) and View opens the map and closes it again.
// Buttons (input.js PAD_BUTTONS): A 0, B 1, X 2, Y 3, View 8, Start 9, D-pad 12-15.
import { open, close, startIsland, island, sim, at, test, assert, done, shot } from '../lively/helper.mjs';

const page = await open();
const D0 = at(2026, 11, 18, 12);
await page.evaluate(() => {
  const pad = { id: 'Xbox test pad (STANDARD GAMEPAD)', index: 0, connected: true, mapping: 'standard', timestamp: 0, axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0, touched: false })) };
  window.__pad = pad;
  navigator.getGamepads = () => [window.__pad.on ? pad : null, null, null, null];
});
const BTN = { a: 0, b: 1, x: 2, y: 3, view: 8, start: 9, up: 12, down: 13 };
/** Press one pad button for a frame (and let go). */
async function tap(name) {
  await page.evaluate((i) => { const b = window.__pad.buttons[i]; b.pressed = true; b.value = 1; window.__pad.timestamp++; }, BTN[name]);
  await sim(page, 1 / 30);
  await page.evaluate((i) => { const b = window.__pad.buttons[i]; b.pressed = false; b.value = 0; window.__pad.timestamp++; }, BTN[name]);
  await sim(page, 1 / 30);
}
const paused = () => page.evaluate(() => !!window.game.pause);
const pauseOn = (item) => page.evaluate((item) => { const G = window.game; G.pause.index = G.pauseItems().indexOf(item); G.renderPause(); return G.pause.index; }, item);
const scene = () => page.evaluate(() => ({ name: window.game.current?.constructor?.name, key: window.game.current?.key ?? null, switching: window.game.switching }));
const waitScene = (name) => page.waitForFunction((n) => window.game.current?.constructor?.name === n && !window.game.switching, name, { timeout: 30000 });

/** The pause menu in the scene now: Start opens it; with "End" (or the last item) chosen, B closes it and picks nothing. */
async function bNeverPicks(label) {
  const s0 = await scene();
  await tap('start');
  assert(await paused(), `${label}: Start pauses`);
  const items = await page.evaluate(() => window.game.pauseItems());
  const risky = items.includes('end') ? 'end' : items.includes('retry') ? 'retry' : 'assist';
  await pauseOn(risky);
  await tap('b');
  await sim(page, 0.5);
  const s1 = await scene();
  assert(!(await paused()) && !(await page.evaluate(() => !!window.game.assistMenu)), `${label}: B closed the pause`);
  assert(s1.name === s0.name && s1.key === s0.key && !s1.switching, `${label}: B on "${risky}" picked nothing: ${JSON.stringify([s0, s1])}`);
  return items;
}

await test('a co-op game on the shared island (the pad as player 1): Start pauses, B never picks (on End), A picks Resume', async () => {
  await page.evaluate(() => { window.__pad.on = true; window.game.audio.ensure(); window.game.openTogether(); });
  await waitScene('HubScene');
  await sim(page, 0.3);
  await page.evaluate(() => { const g = window.game; for (const p of [...g.roster.players]) g.roster.leave(p); g.input.update(); g.roster.join(g.input.get('gp0')); });
  await sim(page, 0.3);
  await page.evaluate(() => window.game.startGame('bubble'));
  await page.waitForFunction(() => window.game.current?.key === 'bubble' && !window.game.switching && window.game.current.state === 'play', null, { timeout: 30000, polling: 100 }).catch(() => {});
  for (let i = 0; i < 80 && (await page.evaluate(() => window.game.current.state)) !== 'play'; i++) { await sim(page, 0.05); await page.waitForTimeout(50); }
  const items = await bNeverPicks('Bubble');
  assert(items.includes('retry') && items.includes('end'), items.join());
  await tap('start');
  await pauseOn('resume');
  await tap('a');
  assert(!(await paused()) && (await scene()).key === 'bubble', 'A picked Resume');
  // A on Retry restarts it
  await tap('start');
  await pauseOn('retry');
  await page.evaluate(() => { window.__old = window.game.current; });
  await tap('a');
  await page.waitForFunction(() => window.game.current !== window.__old && window.game.current?.key === 'bubble' && !window.game.switching, null, { timeout: 30000 });
  // and End goes home
  await sim(page, 0.5);
  await tap('start');
  await pauseOn('end');
  await tap('a');
  await waitScene('HubScene');
});

await test('the solo island: Start opens the island\'s menu (not the pause), B closes it and never picks; X or A picks', async () => {
  await startIsland(page, { time: D0, name: 'Pad' });
  await island(page, (I) => { if (I.mode === 'today') { I.hud.setPanel(null); I.mode = 'walk'; } I.player.p.deviceId = 'gp0'; });
  await sim(page, 0.3);
  await tap('start');
  assert(!(await paused()) && (await island(page, (I) => I.mode)) === 'menu', 'the island menu');
  await sim(page, 0.4);
  // on "Play together" (it would leave the island): B closes, stays here
  await island(page, (I) => { I.modeIndex = I.menuItems().indexOf('island'); I.renderMode(); });
  await tap('b');
  await sim(page, 0.5);
  const r = await island(page, (I) => ({ mode: I.mode, launching: I.launching }));
  assert(r.mode === 'walk' && !r.launching && (await scene()).name === 'SoloIslandScene', `B never picks: ${JSON.stringify(r)}`);
  // A picks: "Help" opens the help card
  await tap('start');
  await sim(page, 0.4);
  await island(page, (I) => { I.modeIndex = I.menuItems().indexOf('help'); I.renderMode(); });
  await tap('a');
  assert(await island(page, (I) => !!I.helpEl), 'A picked Help');
  await tap('b');
  assert(!(await island(page, (I) => !!I.helpEl)), 'B puts the help away');
});

await test('the solo island: View opens the map, and View again closes it (it never opens the pause menu)', async () => {
  await sim(page, 0.3);
  await tap('view');
  const m = await island(page, (I) => ({ mode: I.mode, tab: I.journal.tab }));
  assert(m.mode === 'journal' && m.tab === 'map' && !(await paused()), `View: the map ${JSON.stringify(m)}`);
  await sim(page, 0.4);
  await tap('view');
  const m2 = await island(page, (I) => I.mode);
  assert(!(await paused()) && m2 === 'walk', `View again closes the map: ${m2}, paused ${await paused()}`);
  // the journal on another page (D-pad down): View goes to the map, B closes
  await tap('down');
  await sim(page, 0.4);
  await tap('view');
  assert(!(await paused()) && (await island(page, (I) => I.journal.tab)) === 'map', 'View: to the map');
  await sim(page, 0.4);
  await tap('b');
  assert((await island(page, (I) => I.mode)) === 'walk', 'B closes the journal');
});

await test('a puzzle lock over the island: Start pauses (Resume, Help me play: no End), B never picks', async () => {
  const id = await page.evaluate(async () => (await import('/src/scenes/solo/puzzles.js')).PUZZLE_IDS[0]);
  await island(page, (I, S, G, id) => { I.mode = 'walk'; I.puzzles.start(id); }, id);
  await sim(page, 0.3);
  await page.evaluate(() => window.game.tutorialCard?.answer('skip'));
  await sim(page, 1.3);
  assert((await island(page, (I) => I.mode)) === 'puzzle', 'in the puzzle');
  const items = await bNeverPicks('a puzzle lock');
  assert(!items.includes('end'), items.join());
  assert((await island(page, (I) => I.mode)) === 'puzzle', 'still in the puzzle');
  // B on the puzzle itself (no pause) goes back: the puzzle is left
  await tap('b');
  await sim(page, 0.5);
  assert((await island(page, (I) => I.mode)) !== 'puzzle', 'B leaves the puzzle');
  await island(page, (I) => { if (I.mode !== 'walk') { I.hud.setPanel(null); I.hud.setDialog(null); I.dlg = null; I.mode = 'walk'; } });
});

await test('a hop trail\'s run: Start pauses its clock, B never picks', async () => {
  await island(page, (I) => { const tr = Object.values(I.hops.trails)[0]; I.hops.start(tr, null); });
  await sim(page, 4);
  await bNeverPicks('a hop run');
  assert(await island(page, (I) => !!I.hops.run), 'still running');
  await tap('start');
  const t0 = await island(page, (I) => I.hops.run?.t);
  await sim(page, 1);
  assert(Math.abs((await island(page, (I) => I.hops.run.t)) - t0) < 0.3, 'its clock waits in the pause');
  await tap('start');
  await island(page, (I) => I.hops.stop(true));
  await sim(page, 0.3);
});

await test('a Game Hall game: Start pauses, B never picks (on End), A picks Resume', async () => {
  await page.evaluate(() => window.game.startGame('snake'));
  await page.waitForFunction(() => window.game.current?.key === 'snake' && !window.game.switching && window.game.current.runner, null, { timeout: 30000 });
  await sim(page, 0.3);
  await page.evaluate(() => window.game.tutorialCard?.answer('skip'));
  await sim(page, 1.5);
  await bNeverPicks('Snake');
  await tap('start');
  await pauseOn('resume');
  await tap('a');
  assert(!(await paused()) && (await scene()).key === 'snake', 'resumed');
  await tap('start');
  await pauseOn('end');
  await tap('a');
  await waitScene('SoloIslandScene');
  await sim(page, 1);
});

await test('the dive: Start pauses (no End there), B never picks and does not go up', async () => {
  await island(page, (I) => { if (I.mode !== 'walk') { I.hud.setPanel(null); I.mode = 'walk'; } I.player.p.deviceId = 'gp0'; I.save.sea.suit = true; I.startDive(); });
  await waitScene('DiveScene');
  await sim(page, 1.5);
  await bNeverPicks('the dive');
  assert(!(await page.evaluate(() => window.game.current.ending)), 'B in the pause did not go up');
  await page.evaluate(() => window.game.current.ascend?.('early'));
  // up, the haul card (A takes it home), the wipe
  for (let i = 0; i < 40 && (await scene()).name !== 'SoloIslandScene'; i++) { await sim(page, 0.5); if (await page.evaluate(() => window.game.current.ending === 'summary')) await tap('a'); await page.waitForTimeout(100); }
  assert((await scene()).name === 'SoloIslandScene', 'back on the island');
});

await test('Pillow Keep Solo: A picks the hero; Start pauses, B never picks (on End); B closes a panel', async () => {
  await sim(page, 1);
  await page.evaluate(() => window.game.startGame('keepsolo'));
  await waitScene('KeepSoloScene');
  await sim(page, 0.5);
  await tap('a');
  await sim(page, 0.5);
  assert((await page.evaluate(() => window.game.current.mode)) === 'town', 'A picked the hero');
  await bNeverPicks('Pillow Keep Solo');
  await page.evaluate(() => window.game.current.openPanel('bag'));
  await sim(page, 0.2);
  await tap('b');
  await sim(page, 0.2);
  assert(!(await page.evaluate(() => !!window.game.current.panel)) && !(await paused()), 'B closed the bag (no pause)');
  await tap('start');
  await pauseOn('end');
  await tap('a');
  await waitScene('SoloIslandScene');
});

await test('no console errors', async () => { assert(!page.errors.length, page.errors.join('\n')); });
await close(page);
done();
