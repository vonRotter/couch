// The owner's decisions after the play-test pass (tests/playtest/LOG.md, "Owner decisions built"): each test is one
// decision, checked so it stays built.
import { open, close, startIsland, island, sim, at, test, assert, done, press, shot, DAY } from '../lively/helper.mjs';

const page = await open();
const D0 = at(2026, 11, 18, 11); // a Wednesday

/** Put a visitor's letter on today's board (an offer to save) and open the board. */
async function boardWithOffer() {
  return island(page, (I, S) => {
    I.hud.setPanel(null); I.mode = 'walk'; S.lock = null;
    const today = Math.round((new Date(S.todayBoard.day + 'T12:00').getTime() - new Date(1970, 0, 1, 12).getTime()) / 86400000);
    S.hook = { kind: 'letter', who: 'balloon', made: today, due: today + 3 };
    S.todayBoard.items = [{ kind: 'visitor', icon: '✉️', k: 'td.lk.letter.balloon', v: { day: '@td.wd.1' } }];
    I.todayBoard.open();
    I.todayBoard.t = 1;
    return { offer: !!I.todayBoard.offer, text: I.hud.panel.innerText };
  });
}

await test('1. the Today board: [OK] and [BACK] only close it; saving for later is its own row (▼, then [OK])', async () => {
  await startIsland(page, { time: D0 });
  const b = await boardWithOffer();
  assert(b.offer && /Save it for later/.test(b.text) && /E: off we go/.test(b.text), JSON.stringify(b));
  await press(page, 'KeyE'); // the use key, the one that closes every panel
  await sim(page, 0.2);
  let r = await island(page, (I, S) => ({ mode: I.mode, lock: S.lock }));
  assert(r.mode === 'walk' && !r.lock, `[OK] alone closes and never saves: ${JSON.stringify(r)}`);
  await boardWithOffer();
  await press(page, 'Space'); // (Space on a keyboard)
  await sim(page, 0.2);
  assert(!(await island(page, (I, S) => S.lock)), 'Space alone never saves');
  // ▼ picks the row, [BACK] still only closes
  await boardWithOffer();
  await press(page, 'KeyS');
  const on = await island(page, (I) => ({ sel: I.todayBoard.sel, text: I.hud.panel.innerText }));
  assert(on.sel === 0 && /save it for later/i.test(on.text), JSON.stringify(on));
  await shot(page, 'decisions-board-row');
  await press(page, 'KeyQ');
  await sim(page, 0.2);
  assert(!(await island(page, (I, S) => S.lock)), '[BACK] on the row never saves');
  // ▼ then [OK] saves
  await boardWithOffer();
  await press(page, 'KeyS');
  await press(page, 'KeyE');
  await sim(page, 0.2);
  r = await island(page, (I, S) => ({ mode: I.mode, lock: S.lock }));
  assert(r.mode === 'walk' && r.lock?.what === 'balloon', JSON.stringify(r));
  // ▼ then ▲ leaves the row: [OK] closes
  await island(page, (I, S) => { S.lock = null; });
  await boardWithOffer();
  await press(page, 'KeyS'); await press(page, 'KeyW'); await press(page, 'KeyE');
  await sim(page, 0.2);
  assert(!(await island(page, (I, S) => S.lock)), '▲ leaves the row');
  // Norwegian
  const no = await page.evaluate(async () => { const i = await import('/src/core/i18n.js'); const w = i.getLang(); i.setLang('no'); const s = [i.t('lk.boardRow'), i.t('lk.boardHint'), i.t('lk.boardHintOn')]; i.setLang(w); return s; });
  assert(/Spar den til senere/.test(no[0]) && /av sted/.test(no[1]), no.join(' | '));
});

await test('no console errors', async () => { assert(!page.errors.length, page.errors.join('\n')); });
await close(page);
done();
