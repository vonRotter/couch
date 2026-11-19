// Games suite (story): the Story campaign map and the Grumble King's four boss games, from the shared island with
// one and two keyboard players: each starts, plays 20 s of random-ish input with no console errors, and its pause
// menu works (Retry, End). The bosses are also played as story stages (the map's way in). See games.mjs.
import { open, close, test, assert, done, sim } from '../lively/helper.mjs';
import { family, hub, play } from './games.mjs';

const page = await open();
await family(page, ['story', 'boss0', 'boss1', 'boss2', 'boss3'], { from: 'hub', test, assert });
await test('a boss as a story stage: started from the campaign, End goes back to the story map', async () => {
  const e0 = page.errors.length;
  await hub(page, 2);
  await page.evaluate(() => window.game.startStage({ id: 'test', key: 'boss0', opts: {} }));
  await page.waitForFunction(() => window.game.current?.key === 'boss0' && !window.game.switching, null, { timeout: 30000 });
  const r = await play(page, 'boss0', { seconds: 10, seed: 3 }).catch(() => null);
  void r;
  await page.evaluate(() => { const G = window.game; if (G.pause) G.closePause(); G.openPause(); G.pause.index = G.pauseItems().indexOf('end'); });
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE', key: 'KeyE', bubbles: true })));
  await sim(page, 1 / 30);
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyE', key: 'KeyE', bubbles: true })));
  await page.waitForFunction(() => window.game.current?.constructor?.name === 'StoryScene' && !window.game.switching, null, { timeout: 30000 });
  assert(page.errors.length === e0, page.errors.slice(e0).join('\n'));
});
await test('no console errors', async () => { assert(!page.errors.length, page.errors.join('\n')); });
await close(page);
done();
