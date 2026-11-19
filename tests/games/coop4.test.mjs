// Games suite (coop4): keep guides splash cave dogfight duckhunt from the shared island with one and two keyboard players: each starts, plays 20 s
// of random-ish input with no console errors, and its pause menu works (Retry, End). See games.mjs.
import { open, close, test, assert, done } from '../lively/helper.mjs';
import { family } from './games.mjs';

const page = await open();
await family(page, ['keep', 'guides', 'splash', 'cave', 'dogfight', 'duckhunt'], { from: 'hub', test, assert });
await test('no console errors', async () => { assert(!page.errors.length, page.errors.join('\n')); });
await close(page);
done();
