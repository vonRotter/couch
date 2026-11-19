// Games suite (coop3): runner cook hideseek snowball golf castle from the shared island with one and two keyboard players: each starts, plays 20 s
// of random-ish input with no console errors, and its pause menu works (Retry, End). See games.mjs.
import { open, close, test, assert, done } from '../lively/helper.mjs';
import { family } from './games.mjs';

const page = await open();
await family(page, ['runner', 'cook', 'hideseek', 'snowball', 'golf', 'castle'], { from: 'hub', test, assert });
await test('no console errors', async () => { assert(!page.errors.length, page.errors.join('\n')); });
await close(page);
done();
