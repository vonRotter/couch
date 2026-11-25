// The owner's decisions 7 to 9 after the second play-test pass (tests/playtest/LOG.md, "Owner decisions built").
import { open, close, startIsland, island, sim, at, test, assert, done, press, shot, DAY } from '../lively/helper.mjs';

const page = await open();
const odd = (got) => `(S) => { S.odd = { first: 0, last: -1e9, got: ${JSON.stringify(got)}, modes: {}, mode: 'normal' }; }`;

await test('7. an evening child (19:45) meets Tinka at her workshop and gets tea; at 20:45 / 20:15 both are closed', async () => {
  await startIsland(page, { time: at(2026, 11, 18, 19, 45), save: odd({ ball: 0, inventor: 0, booths: 0, robot: 0, tea: 0 }) });
  const r = await island(page, (I) => {
    I.hud.setPanel(null); I.mode = 'walk';
    const inv = I.odd.inventor, cr = I.odd.creatures;
    inv.tick(); cr.tick?.(Date.now() + window.__islandTimeOffset);
    const P = I.player;
    P.x = inv.tinka.x - 1.2; P.z = inv.tinka.z; P.fx = 1; P.fz = 0; I.groundCheck(P, I.walkState);
    const tinka = I.useAction(I.interactions())?.text || '';
    return { shown: inv.tinka.shown, tinka };
  });
  assert(r.shown && /Tinka/.test(r.tinka), JSON.stringify(r));
  const tea = await page.evaluate(async () => {
    const C = await import('/src/scenes/solo/creatures.js');
    const I = window.game.current, P = I.player;
    P.x = C.TEA.stand.x; P.z = C.TEA.stand.z + 0.6; P.fx = 0; P.fz = -1; I.groundCheck(P, I.walkState);
    return I.useAction(I.interactions())?.text || '';
  });
  assert(/tea/i.test(tea) && !/closed/i.test(tea), tea);
  await page.evaluate((ms) => { window.__islandTimeOffset = ms - Date.now(); }, at(2026, 11, 18, 20, 45));
  await sim(page, 1.5);
  const late = await island(page, (I) => { I.hud.setPanel(null); I.mode = 'walk'; I.odd.inventor.tick(); return I.odd.inventor.tinka.shown; });
  assert(!late, 'home at 20:45');
  const closed = await page.evaluate(async () => { const I = window.game.current; return I.useAction(I.interactions())?.text || ''; });
  assert(/closed.*10 to 20/.test(closed), closed);
});

await test('8. a drama the child saw within six months does not come again; with every one blocked, no drama that week', async () => {
  await startIsland(page, { time: at(2026, 11, 16, 10) });
  const r = await island(page, (I, S) => {
    S.village = {}; S.intro = true;
    const d0 = Math.round((new Date(S.todayBoard.day + 'T12:00').getTime() - new Date(1970, 0, 1, 12).getTime()) / 86400000);
    const seen = [];
    for (let di = d0; di < d0 + 365; di++) {
      I.village.newDay(new Date(1970, 0, 1 + di, 12).getTime());
      const D = S.village.drama;
      if (D && D.start === di) seen.push({ id: D.id, d: di - d0 });
    }
    return seen;
  });
  const again = [];
  for (let i = 0; i < r.length; i++) for (let j = 0; j < i; j++) if (r[j].id === r[i].id && r[i].d - r[j].d < 183) again.push([r[j], r[i]]);
  console.log(`   a year: ${r.map((x) => `${x.id} d${x.d}`).join(', ')}`);
  assert(!again.length, `again within six months: ${JSON.stringify(again)}`);
  assert(r.length >= 10 && r.slice(0, 8).map((x) => x.id).join() === 'rivalry,pumpkin,cake,fence,election,club,party,rumour', JSON.stringify(r));
});

await test('9. a tool the child is told to hold goes to the hotbar: an empty slot, else the last slot moves to the chest', async () => {
  await startIsland(page, { time: at(2026, 11, 18, 11) });
  const r = await page.evaluate(async () => {
    const SV = await import('/src/scenes/solo/save.js');
    const mk = (hotbarFull, bagFull) => {
      const S = { inv: [], chest: [], bagRows: 2, unlocks: {} };
      for (let i = 0; i < (hotbarFull ? 9 : 5); i++) S.inv.push({ id: `seed${i}`, n: 1, slot: i });
      if (bagFull) for (let i = 9; i < 27; i++) S.inv.push({ id: `x${i}`, n: 1, slot: i });
      return S;
    };
    const out = {};
    for (const [k, hf, bf] of [['room', false, false], ['fullHotbar', true, false], ['fullBag', true, true]]) {
      const S = mk(hf, bf);
      SV.give(S, 'wand', 1);
      const w = S.inv.find((x) => x.id === 'wand');
      out[k] = { slot: w?.slot, chest: S.chest.map((x) => x.id), made: S.madeRoom || null };
    }
    const B = mk(true, true); SV.give(B, 'magicBall', 1); out.ball = B.inv.find((x) => x.id === 'magicBall')?.slot;
    const R = mk(true, true); SV.give(R, 'rod', 1); out.rod = R.inv.find((x) => x.id === 'rod')?.slot;
    return out;
  });
  assert(r.room.slot === 5 && !r.room.chest.length, JSON.stringify(r));
  assert(r.fullHotbar.slot === 8 && r.fullHotbar.chest.join() === 'seed8' && r.fullHotbar.made === 'seed8', JSON.stringify(r));
  assert(r.fullBag.slot === 8 && r.ball === 8 && r.rod === 8, JSON.stringify(r));
  // on the island: the toast says why
  await island(page, (I, S) => { I.hud.setPanel(null); I.mode = 'walk'; I.toasts.clear(); for (let i = 0; i < 9; i++) if (!S.inv.some((x) => x.slot === i)) S.inv.push({ id: 'wood', n: 1, slot: i }); I.giveItems([['wand', 1]], true); });
  await sim(page, 1.5);
  const tx = await island(page, (I) => I.toasts.texts.join(' | '));
  assert(/make room on your hotbar/.test(tx), tx);
});

await test('no console errors', async () => { assert(!page.errors.length, page.errors.join('\n')); });
await close(page);
done();
