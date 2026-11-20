// The odd-adventure round's pace (the owner's rule: new things feel special, never too much at once). Over four months
// of daily visits by a child who takes up everything the day after it comes (talks to Coach and Mumble, reads every
// letter, takes the lessons): sixteen arrivals, never two on a day, at least five days apart, never on a day with a
// festival, a daily surprise, a rare event, a drama's big moment, a new puzzle lock or a step of the Ollo folk's
// settling (a house, the pebble circle, the drums) or a drama's first day; and the same with a child who
// does nothing (arrivals that build on something wait). All from the date and the save (odd.js arrivalDue), with the
// villagers' dramas and the puzzle locks running alongside as on the island.
import { open, close, startIsland, island, at, test, assert, done, oddSave } from './lba2.mjs';

const page = await open();
const D0 = at(2026, 11, 16, 10); // a Monday

async function simulate(days, eager) {
  return page.evaluate(async ([d0, days, eager]) => {
    const O = await import('/src/scenes/solo/odd.js'), C = await import('/src/scenes/solo/calendar.js'), Z = await import('/src/scenes/solo/puzzles.js');
    const I = window.game.current, S = I.save;
    S.odd = undefined; S.village = {}; S.puzzles = {}; S.intro = true;
    const log = [];
    for (let d = 0; d < days; d++) {
      const at = d0 + d * 86400000, di = C.dayIndex(at);
      I.village.newDay(at); // the dramas move on first (as today.js does)
      const id = O.arrivalDue(S, at);
      const D = S.village.drama, climax = !!D && D.climax === di && !D.res, dramaStart = !!D && D.start === di;
      const puzzle = O.puzzleComes(S, at);
      if (id) { S.odd.got[id] = di; S.odd.last = di; }
      Z.schedule(S, at);
      if (S.puzzles.cur) Z.markDone(S, S.puzzles.cur, { at }); // (the child solves each lock the day it comes)
      // an eager child takes everything up the day after it came
      if (eager) {
        const g = S.odd.got;
        if (g.sporty !== undefined && di > g.sporty) S.odd.modes.sporty = true;
        if (g.sneaky !== undefined && di > g.sneaky) S.odd.modes.sneaky = true;
        if (g.ball !== undefined && di > g.ball) S.odd.ball = { ...(S.odd.ball || { bounces: 2 }), have: true };
        if (g.school !== undefined && di > g.school) S.odd.wiz = { ...(S.odd.wiz || {}), lessons: { ...(S.odd.wiz?.lessons || {}), rain: true } };
      }
      const fa = S.odd.got.folk, folkStep = fa !== undefined && di > fa && [7, 14, 21].includes(di - fa); // a house, the circle, the drums
      log.push({ d, di, id, fest: C.festivalOn(at), sur: C.surpriseOn(at), rare: C.rareEventOn(at), climax, puzzle, folkStep, dramaStart });
    }
    return log;
  }, [D0, days, eager]);
}

await test('an eager child: sixteen arrivals over four months, one at a time, at least five days apart, only on quiet days', async () => {
  await startIsland(page, { time: D0, save: oddSave({}) });
  const log = await simulate(126, true);
  const arr = log.filter((x) => x.id);
  const gaps = arr.slice(1).map((x, i) => x.d - arr[i].d);
  const clash = arr.filter((x) => x.fest || x.sur || x.rare || x.climax || x.puzzle || x.folkStep || x.dramaStart);
  const steps = log.filter((x) => x.folkStep).map((x) => x.d);
  console.log(`   the Ollo folk's steps on days ${steps.join(', ')} (nothing else arrives then)`);
  assert(steps.length === 3, `the folk's three steps: ${steps}`);
  const in8 = arr.filter((x) => x.d < 56).length;
  console.log(`   ${arr.length} arrivals in 18 weeks (${in8} in the first 8): ${arr.map((x) => `${x.id} d${x.d}`).join(', ')}`);
  console.log(`   days between arrivals: min ${Math.min(...gaps)}, max ${Math.max(...gaps)}, average ${(gaps.reduce((a, b) => a + b, 0) / gaps.length).toFixed(1)}; on a special day: ${clash.length}`);
  assert(arr.length === 16 && new Set(arr.map((x) => x.d)).size === arr.length, `all sixteen, never two a day: ${arr.length}`);
  assert(Math.min(...gaps) >= 5 && !clash.length, JSON.stringify({ gaps, clash }));
  assert(in8 >= 6 && in8 <= 11, `about one a week: ${in8} in 8 weeks`);
  // the order: each after what it builds on
  const day = Object.fromEntries(arr.map((x) => [x.id, x.d]));
  assert(day.sneaky > day.sporty && day.booths > day.ball && day.booths > day.inventor && day.robot > day.booths && day.sun > day.school && day.voice > day.bounce && day.bounce2 > day.voice && day.moss > day.sneaky, JSON.stringify(day));
});

await test('a child who takes nothing up: what builds on something waits; the rest still comes slowly', async () => {
  const log = await simulate(126, false);
  const arr = log.filter((x) => x.id).map((x) => x.id);
  console.log(`   arrived: ${arr.join(', ')}`);
  assert(!arr.includes('sneaky') && !arr.includes('booths') && !arr.includes('moss') && !arr.includes('sun') && arr.includes('folk') && arr.includes('whale'), arr.join());
});

await test('an old island (no odd-adventure save): nothing on the first days, then the first arrival', async () => {
  const r = await page.evaluate(async (d0) => {
    const O = await import('/src/scenes/solo/odd.js');
    const S = { intro: true, village: {}, puzzles: {} };
    const out = [];
    for (let d = 0; d < 12; d++) { const id = O.arrivalDue(S, d0 + d * 86400000); if (id) { out.push({ d, id }); S.odd.got[id] = Math.round(Date.UTC(new Date(d0 + d * 86400000).getFullYear(), new Date(d0 + d * 86400000).getMonth(), new Date(d0 + d * 86400000).getDate()) / 86400000); S.odd.last = S.odd.got[id]; } }
    return out;
  }, D0);
  assert(r.length >= 1 && r[0].d >= 2, JSON.stringify(r));
});

await test('no console errors', async () => { assert(!page.errors.length, page.errors.join('\n')); });
await close(page);
done();
