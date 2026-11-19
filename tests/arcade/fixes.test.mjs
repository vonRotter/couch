// Fixes after the classic games round: Rock Patrol's wrap-around edge (rocks and the rocket are cut off at the
// board's edge and show on the other side at once), Echo Bells' first tune waits for the tutorial's "watch and
// listen" step, and Start pauses every game at any time (a real gamepad's Start, and Esc on a keyboard): the hall's
// games, a puzzle lock over the island, a hop trail's run, an island activity, the dive. Out walking the island
// Start still opens the island's own menu and Esc its help.
import { open, close, startIsland, island, sim, test, assert, done, press, dismiss, shot } from '../lively/helper.mjs';
import { R, startArcade, D0 } from './arcade.mjs';

const page = await open();

// a fake gamepad (standard mapping): Start is button 9
await page.evaluate(() => {
  const pad = { id: 'test pad', index: 0, connected: true, mapping: 'standard', timestamp: 0, axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0, touched: false })) };
  window.__pad = pad;
  navigator.getGamepads = () => [window.__pad.on ? pad : null, null, null, null];
});
const padOn = () => page.evaluate(() => { window.__pad.on = true; });
async function start() {
  await page.evaluate(() => { const b = window.__pad.buttons[9]; b.pressed = true; b.value = 1; window.__pad.timestamp++; });
  await sim(page, 1 / 30);
  await page.evaluate(() => { const b = window.__pad.buttons[9]; b.pressed = false; b.value = 0; window.__pad.timestamp++; });
  await sim(page, 1 / 30);
}
const paused = () => page.evaluate(() => !!window.game.pause);

await startIsland(page, { time: D0 });
await dismiss(page);

await test('Rock Patrol: a rock over the edge is cut off there and its other part shows on the far side', async () => {
  await startArcade(page, 'rocks');
  const r = await R(page, (r, g, G) => {
    const rock = g.rocks[0];
    rock.x = g.w / 2 - 0.3; rock.z = 0; rock.vx = 0; rock.vz = 0;
    g.s.x = -3; g.s.z = 3; g.safe = 5;
    g.draw(0);
    const vis = rock.m.children.filter((c) => c.visible).map((c) => +(c.position.x).toFixed(2));
    const mat = rock.m.children[0].material;
    return { vis, clip: mat.clippingPlanes?.length, on: G.renderer.localClippingEnabled, shipCopies: g.ship.children.filter((c) => c.visible).length, w: g.w };
  });
  assert(r.on && r.clip === 4, JSON.stringify(r));
  assert(r.vis.length === 2 && r.vis.includes(0) && r.vis.includes(-r.w), `two copies, one a field over: ${JSON.stringify(r)}`);
  assert(r.shipCopies === 1, 'the rocket in the middle: one copy');
  const c = await R(page, (r, g) => { const rock = g.rocks[0]; rock.x = g.w / 2 - 0.3; rock.z = g.h / 2 - 0.3; g.draw(0); return rock.m.children.filter((c) => c.visible).length; });
  assert(c === 4, `at a corner: four copies (${c})`);
  await R(page, (r, g) => { g.rocks[0].x = g.w / 2 - 0.2; g.rocks[0].z = 1; g.s.x = -g.w / 2 + 0.3; g.s.z = -1; g.draw(0); });
  await shot(page, 'arcade-rocks-edge');
  // it still plays: the rocks drift over the edge and come back on the other side
  await R(page, (r, g) => { const rock = g.rocks[0]; rock.x = g.w / 2 - 0.1; rock.vx = 3; rock.vz = 0; });
  await sim(page, 0.2);
  const x = await R(page, (r, g) => g.rocks[0].x);
  assert(x < 0, `wrapped: ${x}`);
});

await test('Echo Bells with the tutorial: the first tune waits for "watch and listen", "your turn" only after it', async () => {
  await page.evaluate(() => window.game.startGame('simon'));
  await page.waitForFunction(() => window.game.current?.key === 'simon' && !window.game.switching && !!window.game.current.runner, null, { timeout: 30000 });
  await sim(page, 0.2);
  await page.evaluate(() => window.game.tutorialCard?.answer('show'));
  const log = [];
  for (let i = 0; i < 120; i++) {
    await sim(page, 1 / 15);
    const s = await R(page, (r, g) => ({ st: r.state, ph: g.phase, step: r.teach?.step(r.p)?.key || null, hud: r.hudEl.textContent }));
    log.push(s);
  }
  const play = log.filter((s) => s.st === 'play');
  assert(play.length > 10, 'it plays');
  const bad = play.filter((s) => s.step === 'arc.simon.t1' && s.ph === 'answer');
  assert(!bad.length, `"Your turn" under "watch and listen": ${JSON.stringify(bad[0])}`);
  const firstListen = play.findIndex((s) => s.ph === 'listen');
  const firstT1 = play.findIndex((s) => s.step === 'arc.simon.t1');
  assert(firstT1 >= 0 && firstListen >= firstT1, `the tune starts once the step shows (t1 at ${firstT1}, tune at ${firstListen})`);
  assert(play.some((s) => s.step === 'arc.simon.t2' && s.ph === 'answer'), 'then "ring the same bells" while it is your turn');
  assert(play.filter((s) => s.step === 'arc.simon.t1').every((s) => /Listen|Lytt/i.test(s.hud)), 'the HUD says listen meanwhile');
});

await test('Echo Bells without the tutorial: the tune starts by itself (about a second in)', async () => {
  await page.evaluate(() => window.game.current.runner.leave({}));
  await page.waitForFunction(() => window.game.current?.constructor?.name === 'SoloIslandScene' && !window.game.switching && window.game.current.player, null, { timeout: 30000 });
  await startArcade(page, 'simon', { tutorial: 'skip', settle: 0.2 });
  await sim(page, 2.5);
  const ph = await R(page, (r, g) => g.phase);
  assert(ph === 'answer' || ph === 'listen', ph);
});

await test('a hall game: Start pauses (the game stops) and Start again goes on', async () => {
  await padOn();
  const t0 = await R(page, (r) => r.t);
  await start();
  assert(await paused(), 'paused');
  await sim(page, 2);
  const t1 = await R(page, (r) => r.t);
  assert(Math.abs(t1 - t0) < 0.2, `frozen: ${t0} -> ${t1}`);
  await start();
  assert(!(await paused()), 'resumed');
  await sim(page, 0.5);
  assert((await R(page, (r) => r.t)) > t1 + 0.3, 'runs again');
});

async function backToIsland() {
  await page.evaluate(() => { window.game.pause && window.game.closePause(); window.game.current.runner?.leave({}); });
  await page.waitForFunction(() => window.game.current?.constructor?.name === 'SoloIslandScene' && !window.game.switching && window.game.current.player, null, { timeout: 30000 });
  await sim(page, 1);
  await dismiss(page);
}

await test('a puzzle lock over the island: Start pauses it, Start again resumes in the puzzle; Esc too', async () => {
  await backToIsland();
  const id = await page.evaluate(async () => (await import('/src/scenes/solo/puzzles.js')).PUZZLE_IDS[0]);
  await island(page, (I, S, G, id) => { I.mode = 'walk'; I.puzzles.start(id); }, id);
  await sim(page, 0.3);
  await page.evaluate(() => window.game.tutorialCard?.answer('skip'));
  await sim(page, 1.3);
  const t0 = await R(page, (r) => r.t);
  await start();
  assert(await paused(), 'Start: paused');
  await sim(page, 2);
  assert(Math.abs((await R(page, (r) => r.t)) - t0) < 0.2, 'the puzzle is frozen');
  const items = await page.evaluate(() => window.game.pauseItems());
  assert(!items.includes('retry') && !items.includes('end') && items[0] === 'resume', items.join());
  await start();
  assert(!(await paused()) && (await island(page, (I) => I.mode)) === 'puzzle', 'back in the puzzle');
  await press(page, 'Escape');
  assert(await paused(), 'Esc: paused');
  await press(page, 'Escape');
  assert(!(await paused()) && (await island(page, (I) => I.mode)) === 'puzzle' && !(await island(page, (I) => !!I.helpEl)), 'Esc again: back in it (no help card)');
  await press(page, 'KeyQ');
  await sim(page, 0.3);
});

await test('out walking: Start opens the island menu (not the pause), Esc the help; in a hop trail\'s run Start pauses its clock', async () => {
  await dismiss(page);
  await island(page, (I) => { I.player.p.deviceId = 'gp0'; }); // a child playing on the pad
  await start();
  assert(!(await paused()) && (await island(page, (I) => I.mode)) === 'menu', 'the island menu');
  await sim(page, 0.4);
  await start();
  await sim(page, 0.4);
  assert((await island(page, (I) => I.mode)) === 'walk', 'closed');
  await press(page, 'Escape');
  assert(!(await paused()) && (await island(page, (I) => !!I.helpEl)), 'help');
  await press(page, 'Escape');
  await sim(page, 0.2);
  // a hop trail's run
  await island(page, (I) => { const tr = Object.values(I.hops.trails)[0]; I.hops.start(tr.tr || tr, null); });
  await sim(page, 4.5);
  const r0 = await island(page, (I) => ({ mode: I.mode, t: I.hops.run?.t }));
  assert(r0.t > 0, JSON.stringify(r0));
  await start();
  assert(await paused(), 'Start in a run: the pause');
  await sim(page, 2);
  const r1 = await island(page, (I) => I.hops.run?.t);
  assert(Math.abs(r1 - r0.t) < 0.1, `the run's clock stops: ${r0.t} -> ${r1}`);
  await start();
  assert(!(await paused()), 'resumed');
  await island(page, (I) => { I.hops.stop(); I.player.p.deviceId = 'kb0'; });
  await sim(page, 0.3);
});

await test('an island activity (fishing) and the dive: Start pauses; in the dive [C] still goes up early', async () => {
  await dismiss(page);
  await island(page, (I) => { I.mode = 'fish'; });
  await start();
  assert(await paused(), 'fishing: paused');
  await start();
  await island(page, (I) => { I.mode = 'walk'; });
  await island(page, (I) => { I.save.sea.suit = true; I.startDive(); });
  await page.waitForFunction(() => window.game.current?.constructor?.name === 'DiveScene' && !window.game.switching, null, { timeout: 30000 });
  await sim(page, 1.5);
  const a0 = await page.evaluate(() => window.game.current.air);
  await start();
  assert(await paused(), 'dive: paused');
  await sim(page, 2);
  const a1 = await page.evaluate(() => window.game.current.air);
  assert(Math.abs(a1 - a0) < 0.1, `air stops: ${a0} -> ${a1}`);
  await press(page, 'Escape');
  assert(!(await paused()) && !(await page.evaluate(() => window.game.current.ending)), 'Esc resumes (no early ascent)');
});

await test('no console errors', async () => { assert(!page.errors.length, page.errors.join('\n')); });
await close(page);
done();
