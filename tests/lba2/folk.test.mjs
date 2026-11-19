// The odd-adventure round, part 4b: the Ollo folk move in over weeks (a tent, then a house a week: the Today board
// says so), their words (at most two new a day; the first four by plain talk, more only after greeting them their way,
// "Ollo!"), the word book in the journal (English and Norwegian), Pebble Day (the fifth Saturday of a month, once they
// settled, the only special thing that day; paint a pebble for the tower), and their corner never traps the bean.
import { open, close, startIsland, island, sim, at, test, assert, done, shot, standAt, talkThrough, DAY } from './lba2.mjs';

const page = await open();
const D0 = at(2026, 11, 18, 11);
const folkSave = (d0) => `(S) => { const d = new Date(${d0}); const di = Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000); S.odd = { first: 0, last: -1e9, got: { folk: di }, modes: {}, mode: 'normal' }; }`;
const goto = async (ms) => { await page.evaluate((ms) => { window.__islandTimeOffset = ms - Date.now(); }, ms); await sim(page, 1.3); await island(page, (I) => { if (I.mode === 'today') { I.hud.setPanel(null); I.mode = 'walk'; } }); };

await test('they move in over weeks: a tent, then a house a week, each step on the Today board', async () => {
  await startIsland(page, { time: D0, save: folkSave(D0) });
  await sim(page, 1);
  const seen = [];
  for (const d of [0, 7, 14, 21]) {
    await goto(D0 + d * DAY);
    seen.push(await island(page, (I, S) => {
      const F = I.odd.folk;
      return { d: 0, tent: F.tent.visible, houses: F.houses.filter((h) => h.g.visible).length, circle: F.circle.visible, drums: F.drums.visible, people: F.members.filter((m) => m.g.shown).length, news: S.todayBoard.items.map((i) => i.k).filter((k) => k.startsWith('fk.')), offered: I.odd.folk.todayNews(Date.now() + window.__islandTimeOffset).map((x) => x.keys[0]), fest: I.seasons.festival };
    }));
  }
  console.log(`   ${seen.map((s, i) => `day ${[0, 7, 14, 21][i]}: ${s.tent ? 'tent' : `${s.houses} houses`}, ${s.people} folk${s.circle ? ', pebble circle' : ''}${s.drums ? ', drums' : ''}`).join('; ')}`);
  assert(seen[0].tent && seen[0].people === 2 && seen[1].houses === 1 && seen[1].people === 3 && seen[2].houses === 2 && seen[2].circle && seen[3].houses === 3 && seen[3].drums, JSON.stringify(seen));
  // each step is offered to the Today board on its day (the board shows the three most important things of a day)
  const shown = [1, 2, 3].filter((k) => seen[k].news.includes(`fk.td.s${k}`)).length;
  console.log(`   the steps on the Today board: ${shown} of 3 (offered on each step's day: ${[1, 2, 3].every((k) => seen[k].offered.includes(`fk.td.s${k}`))})`);
  assert([1, 2, 3].every((k) => seen[k].offered.includes(`fk.td.s${k}`)) && shown >= 2, JSON.stringify(seen.map((s) => [s.news, s.offered])));
  await standAt(page, 44.5, -22.5, [0, -1]);
  await shot(page, 'lba2-folk-village');
});

await test('their corner never traps the bean: from every free spot on a 1 m grid it can walk away', async () => {
  const r = await island(page, (I) => {
    const st = I.walkState, out = { spots: 0, stuck: [] };
    for (let x = 37; x <= 52; x += 1) for (let z = -31; z <= -22; z += 1) {
      const feet = I.map.floorAt(x, z, st.bridge);
      if (!I.map.walkable(x, z, 0.42, st, feet)) continue;
      out.spots++;
      let ways = 0;
      for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2, nx = x + Math.cos(a) * 0.5, nz = z + Math.sin(a) * 0.5; if (I.map.walkable(nx, nz, 0.42, st, I.map.floorAt(nx, nz, st.bridge))) ways++; }
      if (ways < 2) out.stuck.push([x, z]);
    }
    return out;
  });
  assert(r.spots > 60 && !r.stuck.length, JSON.stringify(r));
});

/** Talk to a folk member (greet: 0 "Ollo!", 1 "Hello" when asked): the keys said. */
async function talkFolk(id, greet = 0) {
  await island(page, (I, S, G, id) => { const m = I.odd.folk.members.find((x) => x.id === id); I.player.x = m.g.x + 1.3; I.player.z = m.g.z; I.groundCheck(I.player, I.walkState); I.odd.folk.talkTo(m); }, id);
  const out = [];
  for (let i = 0; i < 8; i++) {
    const L = await island(page, (I) => (I.mode === 'dialog' ? { key: I.dlg.lines[I.dlg.i].key, choices: !!I.dlg.lines[I.dlg.i].choices, vars: I.dlg.lines[I.dlg.i].vars } : null));
    if (!L) break;
    out.push(L.key === 'fk.teach' ? `teach:${L.vars.word}` : L.key);
    await talkThrough(page, greet, 1);
  }
  return out;
}

await test('their words: two new a day at most; the first four by plain talk; more only after "Ollo!"', async () => {
  await goto(D0 + 22 * DAY);
  const a = await talkFolk('bimsa');
  const b = await talkFolk('bimsa');
  const c = await talkFolk('tuko');
  const d = await talkFolk('tuko'); // the third new word today: no
  console.log(`   day 1: ${[a, b, c, d].map((x) => x.join('+')).join(' | ')}`);
  const words1 = await island(page, (I, S) => S.odd.folk.words);
  assert(words1.join() === 'ollo,bimbom' && !d.some((k) => k.startsWith('teach:')), JSON.stringify({ a, b, c, d, words1 }));
  await goto(D0 + 23 * DAY);
  await talkFolk('wenna'); await talkFolk('wenna');
  const w2 = await island(page, (I, S) => S.odd.folk.words);
  assert(w2.length === 4, w2.join());
  await goto(D0 + 24 * DAY);
  const plain = await talkFolk('bimsa', 1); // "Hello!": no new word (the fifth needs "Ollo!")
  const ollo = await talkFolk('tuko', 0);
  console.log(`   day 3: plain hello ${plain.join('+')}; Ollo! ${ollo.join('+')}`);
  const w3 = await island(page, (I, S) => S.odd.folk.words);
  assert(!plain.some((k) => k.startsWith('teach:')) && ollo.includes('fk.bow') && ollo.includes('teach:tanu') && w3.length === 5, JSON.stringify({ plain, ollo, w3 }));
});

await test('the word book: the Friends tab\'s last page, in English and Norwegian, read aloud', async () => {
  await island(page, (I) => { I.journal.open('friends'); I.friends.page = I.friends.pages().indexOf('words'); I.friends.render(true); });
  await sim(page, 0.3);
  const en = await island(page, (I) => I.hud.panel.innerText);
  await shot(page, 'lba2-folk-wordbook');
  await page.evaluate(() => window.game.toggleLanguage());
  await island(page, (I) => I.friends.render(false));
  const no = await island(page, (I) => I.hud.panel.innerText);
  await page.evaluate(() => window.game.toggleLanguage());
  await island(page, (I) => { I.journal.close(); });
  assert(/Ollish words/.test(en) && /5 of 16/.test(en) && /tanu/.test(en) && /sun/.test(en), en);
  assert(/Ollisk-ord/.test(no) && /5 av 16/.test(no) && /sol/.test(no), no);
});

await test('Pebble Day: the fifth Saturday once they settled, the only special thing that day; paint a pebble', async () => {
  // a fifth Saturday with no surprise or rare event
  const fifth = await page.evaluate(async (d0) => { const C = await import('/src/scenes/solo/calendar.js'); for (let d = 0; d < 400; d++) { const ms = d0 + d * 86400000; if (C.pebbleDayNative(ms)) return ms; } return null; }, D0);
  // they came only ten days before: not settled yet, no Pebble Day
  await startIsland(page, { time: fifth, save: folkSave(fifth - 10 * DAY) });
  await sim(page, 1.5);
  const early = await island(page, (I) => I.seasons.festival);
  assert(!early, `not settled: ${early}`);
  await startIsland(page, { time: fifth, save: folkSave(fifth - 30 * DAY) });
  await sim(page, 1.5);
  const st = await island(page, (I, S) => ({ fest: I.seasons.festival, sur: I.surprise.kind, rare: I.events.kind, items: S.todayBoard.items.map((i) => i.k), cal: I.odd.folk.fest }));
  assert(st.fest === 'pebble' && !st.sur && !st.rare && st.items.some((k) => k.startsWith('td.fest.pebble')), JSON.stringify(st));
  // paint a pebble with Elder Bimsa
  await island(page, (I) => { if (I.mode !== 'walk') { I.hud.setPanel(null); I.mode = 'walk'; } const m = I.odd.folk.members[0]; I.player.x = m.g.x + 1.3; I.player.z = m.g.z; I.groundCheck(I.player, I.walkState); });
  const b = await island(page, (I) => I.interactions().b?.text);
  assert(/paint a pebble/.test(b), b);
  await island(page, (I) => I.interactions().b.fn());
  await talkThrough(page, 1);
  await talkThrough(page);
  const r = await island(page, (I, S) => ({ day: S.odd.folk.pebble.day, deco: !!S.deco.pebbleTower, tower: I.odd.folk.tower.children.length }));
  await standAt(page, 44.4, -22.6, [0, -1]);
  await shot(page, 'lba2-folk-pebbleday');
  assert(r.day && r.deco && r.tower >= 8, JSON.stringify(r));
  // how often: by the calendar over two years
  const n = await page.evaluate(async (d0) => { const C = await import('/src/scenes/solo/calendar.js'); let k = 0; for (let d = 0; d < 730; d++) if (C.pebbleDayNative(d0 + d * 86400000)) k++; return k; }, D0);
  console.log(`   Pebble Days over two years: ${n} (the fifth Saturdays with no surprise or rare event)`);
  assert(n >= 3 && n <= 12, String(n));
});

await test('no console errors', async () => { assert(!page.errors.length, page.errors.join('\n')); });
await close(page);
done();
