// Games suite (solo): the games that only start on a profile's own island (Bean Brigade, Pillow Keep Solo and the
// Game Hall's nine classic games), one player each: each starts, plays 20 s of random-ish input with no console
// errors, and its pause menu works (Retry, End back to the island). See games.mjs.
import { open, close, test, assert, done } from '../lively/helper.mjs';
import { family } from './games.mjs';

const page = await open();
const arcade = await page.evaluate(async () => (await import('/src/scenes/arcade/defs.js')).ARCADE_KEYS);
await family(page, ['breach', 'keepsolo', ...arcade], { from: 'solo', players: [1], test, assert });
await test('no console errors', async () => { assert(!page.errors.length, page.errors.join('\n')); });
await close(page);
done();
