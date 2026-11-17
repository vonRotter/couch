// Quick smoke test: the start screen, the shared island (hub), a profile's solo island and a few games open
// and run for a moment with no console errors. Needs the dev server (see tests/README.md).
import { open, close, startIsland, sim, test, assert, done, at } from './lively/helper.mjs';

const page = await open();
const sceneName = () => page.evaluate(() => window.game.current?.constructor?.name);
const waitScene = (name) => page.waitForFunction((n) => window.game.current?.constructor?.name === n && !window.game.switching, name, { timeout: 30000 });

await test('start screen', async () => {
  await sim(page, 1);
  assert(await sceneName(), 'a scene');
});

await test('shared island (hub) with a player', async () => {
  await page.evaluate(() => { window.game.openTogether(); });
  await waitScene('HubScene');
  await page.evaluate(() => { const g = window.game; if (!g.roster.players.length) g.roster.join(g.input.get('kb0')); });
  await sim(page, 2);
});

for (const key of ['bubble', 'platformer', 'kart', 'golf', 'cave']) {
  await test(`game: ${key}`, async () => {
    await page.evaluate((k) => window.game.startGame(k), key);
    await page.waitForFunction(() => !window.game.switching && window.game.current, null, { timeout: 30000 });
    await page.waitForTimeout(800);
    await sim(page, 3);
  });
}

await test('solo island', async () => {
  await startIsland(page, { time: at(2026, 11, 18, 12) });
  await sim(page, 4);
  assert(await sceneName() === 'SoloIslandScene', 'island');
});

await test('no console errors', async () => { assert(!page.errors.length, page.errors.join('\n')); });
await close(page);
done();
