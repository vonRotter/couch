// Old saves: an island saved before this round (no Today board, villagers' lives, events, mystery, sound
// settings, robot or hooks) opens with safe defaults, and the new things start from there.
import { open, close, startIsland, island, sim, at, setTime, test, assert, done, DAY } from './helper.mjs';

const page = await open();
const D0 = at(2026, 11, 19, 10);

// an island as the game saved it before (the fields of that time, nothing from this round)
const OLD = {
  v: 1, intro: true, tut: 8, coins: 412, inv: [{ id: 'zipzap', n: 1, slot: 0 }, { id: 'wood', n: 7, slot: 1 }, { id: 'radishSeed', n: 4, slot: 2 }], invV: 2, bagRows: 2,
  chest: [{ id: 'hay', n: 6, slot: 0 }], sel: 0, zz: { area: 1, speed: 0, range: 0, power: 0 },
  tiles: { '1,1': { s: 'till', crop: 'radish', growth: 0, wetUntil: 0, last: 0 } }, weeds: [],
  npcs: { hazel: { pts: 45, talkAt: 0, giftAt: 0, ev: 2, q: 4, met: true }, pip: { pts: 20, talkAt: 0, giftAt: 0, ev: 1, q: 1, met: true }, hoot: { pts: 5, talkAt: 0, giftAt: 0, ev: 0, q: 0, met: true } },
  quests: {}, unlocks: { bridgeWood: 10, bridge: true, mineHits: 0, mine: false, burrow: false, rockBuster: true, barn: true, greenhouse: true },
  branches: {}, found: {}, rewards: {}, mail: [], deco: {}, stats: { harvested: 12, shipped: 30, earned: 400 }, last: { place: null },
  sea: { rod: true, suit: false, quest: 2, log: { sardine: 2 }, caught: 4, dives: 0, haul: null }, cafe: { repaired: false, wood: 0, served: 0, earned: 0, nights: 0, cooked: 0 },
  ranch: { animals: [{ u: 1, kind: 'chicken', name: 'Clucky', hearts: 2, petDay: '', day: '', ready: false }], trough: 2, nest: 1, next: 1 },
  surprise: { day: '2026-11-01', bits: 0, bought: [], skye: 0, read: false, dug: false, told: true },
  play: { day: '2026-11-01', task: 0, tag: 0, sun: false, stars: false },
};

await test('an old save opens with no errors and safe defaults', async () => {
  await startIsland(page, { time: D0, raw: OLD });
  await sim(page, 3);
  const r = await island(page, (I, S) => ({
    coins: S.coins, sound: S.sound, board: S.todayBoard && { day: S.todayBoard.day, n: S.todayBoard.items.length }, village: !!S.village,
    hook: S.hook ?? null, robot: S.robot && { built: S.robot.built }, mail: S.mail.map((m) => m.id), mystery: S.mystery?.step, music: I.soundState?.music,
  }));
  assert(r.coins === 412, 'coins kept');
  assert(r.sound && r.sound.music && r.sound.amb, JSON.stringify(r.sound));
  assert(r.board && r.board.n >= 1 && r.village, JSON.stringify(r));
  assert(r.robot && !r.robot.built && r.mail.includes('robot'), 'the greenhouse was fixed: Pip writes about the robot');
  assert(/^isl\./.test(r.music), r.music);
  assert(!page.errors.length, page.errors.join('\n'));
});

await test('the old save goes on through a week of days without errors', async () => {
  for (let d = 1; d <= 7; d++) {
    await setTime(page, D0 + d * DAY);
    await sim(page, 2, 1 / 10);
    await island(page, (I) => { if (I.mode === 'today') { I.hud.setPanel(null); I.mode = 'walk'; } });
    await island(page, (I) => { I.journal.open('tasks'); I.journal.close(); I.journal.open('map'); I.journal.close(); I.openMode(0); I.closeMode(); });
  }
  const r = await island(page, (I, S) => ({ robot: S.robot.built, proj: S.village.proj?.id || S.village.built.length }));
  assert(r.proj, JSON.stringify(r));
  assert(!page.errors.length, page.errors.join('\n'));
});

await test('a very old save (before the bag slots) still opens', async () => {
  const older = JSON.parse(JSON.stringify(OLD));
  delete older.invV; delete older.bagRows; delete older.chest; delete older.zz;
  older.inv = [{ id: 'hoe', n: 1 }, { id: 'can', n: 1 }, { id: 'radishSeed', n: 3 }];
  await startIsland(page, { time: D0, raw: older, name: 'Old' });
  await sim(page, 2);
  const r = await island(page, (I, S) => ({ inv: S.inv.map((x) => x.id), sound: S.sound }));
  assert(r.inv.includes('zipzap') && r.sound.music, JSON.stringify(r));
  assert(!page.errors.length, page.errors.join('\n'));
});

await close(page);
done();
