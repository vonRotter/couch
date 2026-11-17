// The Game Hall (src/scenes/solo/arcade.js, map.js HALL_CABS, models.js makeHall): the row of nine classic cabinets
// and the four guest cabinets, the nearest cabinet is the one you use, Coach Bo's line at a cabinet the first time,
// the high-score board and the front sign, Coach's "Which arcade game?", and the passport's new genre, skill and trials.
import { open, close, startIsland, island, sim, test, assert, done, press, dismiss } from '../lively/helper.mjs';
import { D0 } from './arcade.mjs';

const page = await open();
await startIsland(page, { time: D0 });
await dismiss(page);

const KEYS = ['snake', 'blocks', 'maze', 'crates', 'simon', 'lights', 'bonk', 'pong', 'rocks'];

await test('the hall has the nine classic cabinets in a row and the four guest games on the side walls', async () => {
  const r = await island(page, (I) => {
    const cabs = I.map.places.filter((p) => p.cabinet !== undefined);
    return { n: cabs.length, classic: cabs.filter((p) => p.arcade).map((p) => p.key), guests: cabs.filter((p) => p.guest).map((p) => p.id), models: I.map.hall.userData.cabinets.length };
  });
  assert(r.n === 13 && r.models === 13, JSON.stringify(r));
  assert(r.classic.join() === KEYS.join(), r.classic.join());
  assert(r.guests.join() === 'tachyon,starlite,foothold,starhop', 'the guest games keep their ids');
});

await test('standing at a cabinet uses that one (the nearest), with its name and best on its sign', async () => {
  for (const key of KEYS) {
    const t = await island(page, (I, S, G, key) => {
      const pl = I.map.places.find((p) => p.id === `arc-${key}`);
      I.player.x = pl.door.x; I.player.z = pl.door.z;
      return { a: I.interactions().a?.text || '' };
    }, key);
    const name = await page.evaluate(async (k) => (await import('/src/core/i18n.js')).t(`game.${k}`), key);
    assert(t.a.includes(name), `${key}: ${t.a}`);
  }
});

await test('Coach Bo says one line about a game the first time you walk up to its cabinet (once)', async () => {
  await island(page, (I, S) => { S.hall.told = {}; const pl = I.map.places.find((p) => p.id === 'arc-simon'); I.player.x = pl.door.x; I.player.z = pl.door.z; I.mode = 'walk'; I.arcade.tick(); });
  const told = await island(page, (I, S) => ({ ...S.hall.told }));
  assert(told.simon === 1 && Object.keys(told).length === 1, JSON.stringify(told));
  await island(page, (I) => I.arcade.tick());
  assert(await island(page, (I, S) => Object.keys(S.hall.told).length) === 1, 'not again');
});

await test('playing from a cabinet and back: the board and the sign show the best', async () => {
  await island(page, (I) => { const pl = I.map.places.find((p) => p.id === 'arc-snake'); I.player.x = pl.door.x; I.player.z = pl.door.z; });
  await press(page, 'KeyE');
  await page.waitForFunction(() => window.game.current?.key === 'snake' && !window.game.switching, null, { timeout: 30000 });
  await sim(page, 0.3);
  await page.evaluate(() => window.game.tutorialCard?.answer('skip'));
  await sim(page, 1.2);
  await page.evaluate(() => { const g = window.game.current.runner.g; g.score = 7; g.die(); });
  await sim(page, 0.3);
  await page.evaluate(() => window.game.offer?.answer('no'));
  await page.evaluate(() => window.game.current.runner.choose('back'));
  await page.waitForFunction(() => window.game.current?.constructor?.name === 'SoloIslandScene' && !window.game.switching && window.game.current.player, null, { timeout: 30000 });
  await sim(page, 1);
  const r = await island(page, (I) => ({
    info: I.placeInfo(I.map.places.find((p) => p.id === 'arc-snake')),
    board: !!I.map.hall.userData.board.material.map, sign: !!I.map.hall.userData.marquee.material.map,
  }));
  assert(/7/.test(r.info) && r.board && r.sign, JSON.stringify(r));
});

await test('Coach\'s "Which arcade game?" suggests a classic game you have not played yet, with its line', async () => {
  const s = await island(page, (I) => I.arcade.suggestion());
  assert(KEYS.includes(s.key) && s.key !== 'snake', JSON.stringify(s));
  const line = await island(page, (I) => {
    const n = I.npc('coach');
    I.coach.answer(n, 'arcade');
    return I.dlg ? JSON.stringify(I.dlg) : '';
  });
  assert(line.includes('coach.arcSuggest'), line.slice(0, 200));
  await dismiss(page);
});

await test('the passport knows the classics: genres, the Remembering skill, ten trials, the suggested order', async () => {
  const r = await page.evaluate(async (keys) => {
    const P = await import('/src/core/passport.js');
    return {
      games: keys.map((k) => P.GAMES[k]?.where === 'arcade' && P.GAMES[k].skills.length >= 2),
      arcadeGenre: keys.filter((k) => P.GAMES[k].genre === 'arcade'),
      memory: !!P.SKILLS.find((s) => s.id === 'memory'),
      trials: P.TRIALS.filter((t) => keys.includes(t.game)).length,
      path: keys.every((k) => P.PATH.includes(k)),
    };
  }, KEYS);
  assert(r.games.every(Boolean) && r.memory && r.trials === 10 && r.path, JSON.stringify(r));
  assert(r.arcadeGenre.join() === 'snake,simon,bonk', r.arcadeGenre.join());
  // the passport page opens with the new genre and skill
  await island(page, (I) => I.journal.open('passport'));
  await sim(page, 0.5);
  const html = await page.evaluate(() => document.body.innerText);
  assert(/Arcade classic/.test(html) && /Remembering/.test(html), 'the passport shows them');
  await dismiss(page);
});

await test('no console errors', async () => { assert(!page.errors.length, page.errors.join('\n')); });
await close(page);
done();
