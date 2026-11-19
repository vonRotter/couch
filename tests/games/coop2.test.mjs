// Games suite (coop2): portal football slalom hockey party space from the shared island with one and two keyboard players: each starts, plays 20 s
// of random-ish input with no console errors, and its pause menu works (Retry, End). See games.mjs.
import { open, close, test, assert, done } from '../lively/helper.mjs';
import { family } from './games.mjs';

const page = await open();
await family(page, ['portal', 'football', 'slalom', 'hockey', 'party', 'space'], { from: 'hub', test, assert });
await test('no console errors', async () => { assert(!page.errors.length, page.errors.join('\n')); });
await close(page);
done();
