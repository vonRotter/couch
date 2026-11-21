// The odd-adventure round, part 2b: Tinka the inventor. Her workshop and her chats (one a day, none again within four
// weeks); the teleport booths (pick another booth, pop there; about one trip in four misfires to a funny spot, and
// every funny spot and every arrival is open ground you can walk away from: never water, never stuck); the joke
// vending robot (once a day, three jokes not told in four weeks, a small prize); the talking lighthouse (one short line
// a day in its own voice, not the narrator, none again within four weeks); her quests come one step at a time.
import { open, close, startIsland, island, sim, at, test, assert, done, shot, standAt, talkThrough, oddSave, DAY, goTo } from './lba2.mjs';

const page = await open();
const D0 = at(2026, 11, 18, 11);

await test('Tinka at her workshop: hello, then one chat a day, never one again within four weeks', async () => {
  // (the wizard school has come too: Tinka's line about Wendeline only comes once she is on the island, play-test pass 2)
  await startIsland(page, { time: D0, save: oddSave({ ball: 0, inventor: 0, booths: 0, robot: 0, voice: 0, school: 0 }) });
  await sim(page, 1.2);
  const t = await island(page, (I) => ({ shop: I.odd.inventor.shop.visible, tinka: I.odd.inventor.tinka.shown, x: I.odd.inventor.tinka.x, z: I.odd.inventor.tinka.z }));
  assert(t.shop && t.tinka, JSON.stringify(t));
  await standAt(page, t.x - 1.2, t.z, [1, 0]);
  await island(page, (I) => I.interactions().b.fn());
  const hello = await island(page, (I) => I.dlg.lines.map((l) => l.key).join());
  assert(hello === 'iv.t.hello1,iv.t.hello2', hello);
  await talkThrough(page);
  const heard = [];
  for (let d = 1; d <= 12; d++) {
    await goTo(page, D0 + d * DAY);
    await standAt(page, t.x - 1.2, t.z, [1, 0]);
    await island(page, (I) => I.interactions().b.fn());
    heard.push(await island(page, (I) => (I.mode === 'dialog' ? I.dlg.lines[0].key : '(wave)')));
    await talkThrough(page);
    // a second chat the same day: only a wave
    await island(page, (I) => I.interactions().b.fn());
    const second = await island(page, (I) => I.mode);
    assert(second === 'walk', `second chat today: ${second}`);
  }
  const lines = heard.filter((k) => k !== '(wave)');
  console.log(`   12 days of chats: ${lines.length} lines, ${new Set(lines).size} different, then waves (${heard.filter((k) => k === '(wave)').length})`);
  assert(new Set(lines).size === lines.length && lines.length === 10, heard.join());
});

await test('the teleport booths: pick a booth, pop there; misfires land on open ground (never water, never stuck)', async () => {
  // every funny spot and every booth's arrival spot: dry, walkable, and the bean can walk away from it
  const r = await page.evaluate(async () => {
    const M = await import('/src/scenes/solo/inventor.js');
    const I = window.game.current, st = I.walkState, out = [];
    const pts = [...M.FUNNY.map((f) => ({ id: f.id, x: f.x, z: f.z })), ...M.BOOTHS.map((b) => ({ id: `booth:${b.id}`, x: b.x - 1.3, z: b.z + 0.4 }))];
    for (const p of pts) {
      const feet = I.map.floorAt(p.x, p.z, st.bridge);
      const dry = !I.map.supportAt(p.x, p.z, feet, st).water;
      const walk = I.map.walkable(p.x, p.z, 0.42, st, feet);
      let away = 0;
      for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; if (I.map.walkable(p.x + Math.cos(a) * 1.2, p.z + Math.sin(a) * 1.2, 0.42, st, I.map.floorAt(p.x + Math.cos(a) * 1.2, p.z + Math.sin(a) * 1.2, st.bridge))) away++; }
      out.push({ ...p, dry, walk, away });
    }
    return out;
  });
  const bad = r.filter((p) => !p.dry || !p.walk || p.away < 3);
  console.log(`   landing spots checked: ${r.length} (${r.map((p) => `${p.id} ${p.away}/8`).join(', ')})`);
  assert(!bad.length, JSON.stringify(bad));
  // a real trip: from the east booth to the hill booth (or a funny spot). (The last test moved the clock to a new day:
  // let its Today board come up and close it first, or it opens on arrival, as it should on a new day's first walk.)
  await goTo(page, D0 + 13 * DAY);
  await standAt(page, 52.4 - 0.4, 11.6 + 0.9, [0, -1]);
  const use = await island(page, (I) => I.interactions().b?.text);
  assert(/teleport booth/.test(use), use);
  await island(page, (I) => I.interactions().b.fn());
  await talkThrough(page, 0);
  const mode = await island(page, (I) => I.mode);
  assert(mode === 'teleport', mode);
  await sim(page, 1.6);
  const end = await island(page, (I) => ({ mode: I.mode, x: I.player.x, z: I.player.z, scale: I.player.ch.group.scale.x, trips: I.save.odd.inv.trips }));
  await shot(page, 'lba2-booth-arrive');
  assert(end.mode === 'walk' && end.scale === 1 && end.trips === 1, JSON.stringify(end));
  // the island moved: the hill booth (-16, -28) or one of the funny spots
  const M = await page.evaluate(async () => (await import('/src/scenes/solo/inventor.js')).FUNNY.map((f) => [f.x, f.z]));
  const near = [[-17.3, -27.6], ...M].some(([x, z]) => Math.hypot(end.x - x, end.z - z) < 1.6);
  assert(near, JSON.stringify(end));
  // the misfire share over many trips (by date and count): about one in four
  const share = await island(page, (I) => { const V = I.odd.inventor, to = { x: 0, z: 0 }; let n = 0, m = 0; for (let d = 0; d < 60; d++) for (let k = 0; k < 4; k++) { n++; if (V.landing(to, k, `2027-01-${String(1 + (d % 28)).padStart(2, '0')}x${d}`).funny) m++; } return m / n; });
  console.log(`   misfires: ${Math.round(share * 100)} % of 240 trips`);
  assert(share > 0.15 && share < 0.35, String(share));
});

await test('the joke robot: three jokes not told in four weeks, once a day, a small prize', async () => {
  await standAt(page, 51.2 - 1.2, 9.0, [1, 0]);
  const n0 = await island(page, (I, S) => S.inv.reduce((a, x) => a + x.n, 0));
  await island(page, (I) => I.interactions().b.fn());
  const ask = await island(page, (I) => I.dlg.lines[0].choices.length);
  assert(ask === 4, `three jokes and "not today": ${ask}`);
  await talkThrough(page, 1);
  await talkThrough(page);
  const r = await island(page, (I, S) => ({ n: S.inv.reduce((a, x) => a + x.n, 0), told: S.odd.inv.jokes.told.length, b: I.interactions().b?.text }));
  assert(r.n > n0 && r.told === 1 && /still laughing/.test(r.b), JSON.stringify(r));
  // over four weeks of daily jokes, none comes back
  const told = await island(page, (I, S) => {
    const V = I.odd.inventor, J = S.odd.inv.jokes, out = [];
    J.told = [];
    for (let d = 0; d < 15; d++) { const di = 20500 + d; const three = V.jokesToday(`d${d}`, di); out.push(three.length); J.told.push({ k: three[0], di }); }
    return { counts: out, uniq: new Set(J.told.map((x) => x.k)).size };
  });
  assert(told.uniq === 15 && told.counts.every((c) => c >= 1), JSON.stringify(told));
});

await test('the talking lighthouse: one short kind line a day by its door, in its own voice', async () => {
  // a new day: its Today board comes up first and cuts off a line just begun (the line is given back)
  await standAt(page, 44, 31.4, [0, -1]);
  await sim(page, 0.5);
  const cut = await island(page, (I, S) => ({ mode: I.mode, said: S.odd.inv.voice.said.length, day: S.odd.inv.voice.day }));
  if (cut.mode !== 'walk') assert(cut.said === 0 && !cut.day, `a line cut off by ${cut.mode} is given back: ${JSON.stringify(cut)}`);
  await standAt(page, 44, 31.4, [0, -1]);
  await sim(page, 0.5);
  const r = await island(page, (I, S) => ({ said: S.odd.inv.voice.said.length, bubble: I.odd.inventor.bubble.style.display !== 'none' && I.odd.inventor.bubble.textContent }));
  const voice = await page.evaluate(() => (window.game.voiceLog || []).slice(-3));
  await shot(page, 'lba2-lighthouse-voice');
  assert(r.said === 1 && r.bubble && voice.some((v) => v.speaker === 'isl.lighthouse' || JSON.stringify(v).includes('lighthouse')), JSON.stringify({ r, voice }));
  await sim(page, 7);
  await standAt(page, 44, 34, [0, -1]);
  await standAt(page, 44, 31.4, [0, -1]);
  await sim(page, 0.5);
  const again = await island(page, (I, S) => S.odd.inv.voice.said.length);
  assert(again === 1, 'once a day');
});

await test('no console errors', async () => { assert(!page.errors.length, page.errors.join('\n')); });
await close(page);
done();
