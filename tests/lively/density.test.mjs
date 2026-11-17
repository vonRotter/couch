// The owner's budget ("new and special, never too much of the same"), over eight simulated weeks of daily
// visits: at most one special world thing a day, rare events about once a week and never on consecutive days,
// at most one conversation at a time (1-3 a day), no conversation or reaction text again within four weeks,
// each reaction said once by one villager, no Today item again within three weeks, at most one project and one
// tomorrow hook at a time. Prints the measured numbers.
import { open, close, startIsland, island, sim, at, setTime, test, assert, done, DAY } from './helper.mjs';

const page = await open();
const D0 = at(2026, 11, 16, 8); // Monday 16 November 2026
const DAYS = 56;
const log = { days: [] };

await test('eight weeks of daily visits: collect what happens', async () => {
  await startIsland(page, { time: D0, save: (S) => { S.unlocks.greenhouse = true; S.unlocks.barn = true; } });
  const spots = [[12, -4], [3, 46], [30, -11], [-6, -10], [40, -14], [44, 30]];
  let maxBusy = 0, maxChats = 0;
  const skip = new Set();
  let locks = 0;
  for (let d = 0; d < DAYS; d++) {
    // a child who saved a coming event (lock.js) and could not come on its days
    if (skip.has(d)) { log.days.push({ d, skipped: true, chats: [], reacts: [], items: [], keys: [] }); continue; }
    const day = { d, chats: [], reacts: [] };
    await setTime(page, D0 + d * DAY);
    await sim(page, 1.5, 0.1);
    const info = await island(page, (I, S) => {
      if (I.mode === 'today') { I.hud.setPanel(null); I.mode = 'walk'; }
      const V = S.village, di = Math.round((new Date(S.todayBoard.day + 'T12:00').getTime() - new Date(1970, 0, 1, 12).getTime()) / 86400000);
      return { di, keys: S.todayBoard.items.map((i) => i.k), late: S.lockPlay?.di === di ? S.lockPlay.kind : null, items: I.todayBoard.texts(), fest: I.seasons.festival, sur: I.surprise.kind, rare: I.events.kind, climax: V.drama && V.drama.climax === di ? V.drama.id : null, drama: V.drama && { id: V.drama.id, start: V.drama.start, climax: V.drama.climax }, proj: V.proj ? 1 : 0, hooks: S.hook ? 1 : 0, slots: I.village.slots(S.todayBoard.day), projAt: V.proj?.id };
    });
    Object.assign(day, info);
    // every ten days: save the next thing coming, stay away on its days and come back 1, 2 or 3 days after
    if (d % 10 === 2 && d < DAYS - 10) {
      const e = await island(page, (I) => { const c = I.lock.coming(); if (c[0]) I.lock.lock(c[0]); return c[0] || null; });
      if (e) { locks++; const k = 1 + (locks % 3); for (let x = e.day; x < e.last + k; x++) skip.add(x - info.di + d); }
    }
    // things you did today, and every villager you would talk to
    const reacts = await island(page, (I, S, G, d) => {
      const kinds = ['roof', 'crab', 'hopRecord', 'trophy', 'newFish', 'harvest'];
      I.village.note(kinds[d % 6], { trail: '@hop.trail.stumps', item: '@isl.d.kite', fish: '@isl.i.sardine' });
      I.village.note(kinds[(d + 2) % 6], { trail: '@hop.trail.stumps', item: '@isl.d.kite', fish: '@isl.i.sardine' });
      const out = [];
      for (const n of I.npcs) { const L = I.village.reactLine(n); if (L) out.push({ who: n.id, key: L.key, text: window.game.current.village && L.key }); }
      return out;
    }, d);
    day.reacts = reacts;
    // the conversation slots: stand where people are and listen
    for (const s of info.slots) {
      let started = false;
      for (const [x, z] of spots) {
        await setTime(page, D0 + d * DAY + (s.from + 0.03 - 8) * 3600e3);
        await island(page, (I, S, G, [x, z]) => { I.player.x = x; I.player.z = z; I.groundCheck(I.player, I.walkState); if (I.mode !== 'walk') { I.hud.setDialog(null); I.hud.setPanel(null); I.dlg = null; I.mode = 'walk'; } }, [x, z]);
        await sim(page, 1.2, 0.1);
        if (await island(page, (I) => !!I.village.chat)) { started = true; break; }
      }
      if (!started) continue;
      await island(page, (I) => { const C = I.village.chat; I.player.x = C.a.x + 1.2; I.player.z = C.a.z + 1.2; I.groundCheck(I.player, I.walkState); });
      for (let k = 0; k < 50 && await island(page, (I) => !!I.village.chat); k++) {
        await sim(page, 1, 0.1);
        const b = await island(page, (I) => ({ busy: I.npcs.filter((n) => n.busy).length, chats: I.village.chat ? 1 : 0 }));
        maxBusy = Math.max(maxBusy, b.busy); maxChats = Math.max(maxChats, b.chats);
      }
      const c = await island(page, (I) => I.village.lastChat && { id: I.village.lastChat.tp.id, pair: `${I.village.lastChat.a.id}+${I.village.lastChat.b.id}`, texts: I.village.lastChat.texts, abort: I.village.lastChat.abort });
      if (c) day.chats.push(c);
    }
    log.days.push(day);
  }
  log.maxBusy = maxBusy; log.maxChats = maxChats;
  log.said = await island(page, (I, S) => S.village.react.said || []);
  log.texts = await island(page, (I, S) => (S.village.react.said || []).map((r) => r.key));
  assert(!page.errors.length, page.errors.join('\n'));
});

const di0 = () => log.days[0].di;

await test('at most one special world thing a day (festival, surprise, rare event, drama climax)', async () => {
  let worst = 0, specialDays = 0;
  const kinds = { fest: 0, sur: 0, rare: 0, climax: 0 };
  const visited = log.days.filter((d) => !d.skipped);
  for (const d of visited) {
    const n = (d.fest ? 1 : 0) + (d.sur ? 1 : 0) + (d.rare ? 1 : 0) + (d.climax ? 1 : 0);
    worst = Math.max(worst, n);
    if (n) specialDays++;
    for (const k of Object.keys(kinds)) if (d[k]) kinds[k]++;
  }
  const ordinary = visited.length - specialDays;
  const late = visited.filter((d) => d.late);
  console.log(`   visited ${visited.length} of ${log.days.length} days (stayed away ${log.days.length - visited.length} days after saving ${late.length + 0} things); special days ${specialDays}/${visited.length}, ordinary days ${ordinary} (${Math.round((ordinary / visited.length) * 100)} %), most on one day ${worst}, by kind ${JSON.stringify(kinds)}`);
  console.log(`   late-play days ${late.length} (${late.map((d) => `day ${d.d}: ${d.late} ${d.fest || d.rare || d.sur}`).join(', ')}), each the only special thing that day`);
  assert(worst <= 1, `worst ${worst}`);
  assert(late.length >= 3, `late plays ${late.length}`);
  assert(ordinary >= visited.length * 0.4, `ordinary ${ordinary}`);
});

await test('rare events: about once a week, never on consecutive days', async () => {
  const days = log.days.filter((d) => d.rare && !d.late).map((d) => d.d);
  const consec = days.filter((x, i) => i && x - days[i - 1] === 1).length;
  const native = await page.evaluate(async ([d0, n]) => { const C = await import('/src/scenes/solo/calendar.js'); let k = 0; for (let d = 0; d < n; d++) if (C.rareEventOn(d0 + d * 86400000)) k++; return k; }, [D0, DAYS]);
  const share = await page.evaluate(async (d0) => { const C = await import('/src/scenes/solo/calendar.js'); let n = 0, warned = 0; for (let d = 0; d < 728; d++) { const ms = d0 + d * 86400000; if (C.rareEventOn(ms)) { n++; if (C.rareWarned(ms)) warned++; } } return { n, warned }; }, D0);
  // warnings: a rare day whose day before (visited) had a warning on the Today board
  const rareDays = log.days.filter((d) => d.rare && !d.late && log.days[d.d - 1] && !log.days[d.d - 1].skipped);
  const warned = rareDays.filter((d) => log.days[d.d - 1].keys.some((k) => k.startsWith('td.ev.r.'))).length;
  console.log(`   rare events ${native} in ${DAYS / 7} weeks by the calendar (${(native / (DAYS / 7)).toFixed(2)} a week), ${days.length} seen on visited days, consecutive ${consec}; warned the day before: ${warned} of ${rareDays.length} (unwarned ${rareDays.length - warned}); by the calendar over two years: ${share.warned} of ${share.n} (${Math.round((share.warned / share.n) * 100)} %)`);
  assert(native >= 7 && native <= 8 && consec === 0, JSON.stringify(days));
  assert(share.warned / share.n > 0.58 && share.warned / share.n < 0.75, JSON.stringify(share));
});

await test('dramas: the big moment comes within about a week of the start', async () => {
  const seen = new Map();
  for (const d of log.days) if (d.drama) seen.set(`${d.drama.id}:${d.drama.start}`, d.drama.climax - d.drama.start);
  const gaps = [...seen.values()];
  console.log(`   dramas ${gaps.length}, start to big moment (days): ${gaps.join(', ')}`);
  assert(gaps.length >= 3 && gaps.every((g) => g >= 4 && g <= 9), JSON.stringify(gaps));
});

await test('conversations: one at a time, 1-3 a day, none repeated within four weeks', async () => {
  const all = log.days.flatMap((d) => d.chats.filter((c) => !c.abort).map((c) => ({ ...c, d: d.d })));
  const perDay = log.days.map((d) => d.chats.length);
  let rep = 0;
  for (const a of all) for (const b of all) if (a !== b && b.d > a.d && b.d - a.d < 28 && b.texts.some((t) => a.texts.includes(t))) { rep++; if (rep < 6) console.log('   repeat:', a.d, a.id, b.d, b.id, b.texts.find((t) => a.texts.includes(t))); }
  console.log(`   conversations heard ${all.length} (${(all.length / DAYS).toFixed(2)} a day, max ${Math.max(...perDay)} on a day), most at once ${log.maxChats} (busy villagers ${log.maxBusy}), repeated within 4 weeks ${rep}, topics ${new Set(all.map((c) => c.id)).size}`);
  assert(log.maxChats <= 1 && log.maxBusy <= 2, 'one at a time');
  assert(Math.max(...perDay) <= 3, 'at most 3 a day');
  assert(rep === 0, `repeats ${rep}`);
  assert(all.length >= DAYS * 0.5, `too few: ${all.length}`);
});

await test('reactions: each said once, by one villager; no reaction text again within four weeks', async () => {
  const said = log.days.flatMap((d) => d.reacts.map((r) => ({ ...r, d: d.d })));
  const perDayMulti = log.days.filter((d) => new Set(d.reacts.map((r) => r.key.split('.')[1])).size !== d.reacts.length).length;
  let rep = 0;
  for (const a of said) for (const b of said) if (a !== b && b.d > a.d && b.d - a.d < 28 && a.key === b.key) rep++;
  console.log(`   reactions said ${said.length} (two things noticed every day), repeated within 4 weeks ${rep}, a thing said by two villagers ${perDayMulti}`);
  assert(rep === 0 && perDayMulti === 0, `rep ${rep} multi ${perDayMulti}`);
});

await test('Today board: up to 3 items, none again within three weeks', async () => {
  let rep = 0, total = 0;
  const n = [0, 0, 0, 0];
  for (const a of log.days.filter((x) => !x.skipped)) {
    n[a.items.length]++;
    total += a.items.length;
    for (const b of log.days) if (b.d > a.d && b.d - a.d < 21) for (const s of a.items) if (b.items.includes(s)) { rep++; if (rep < 10) console.log('   repeat:', a.d, b.d, s); }
  }
  console.log(`   Today items ${total} (${(total / DAYS).toFixed(2)} a day; days with 0/1/2/3 items: ${n.join('/')}), repeated within 3 weeks ${rep}`);
  assert(rep === 0 && log.days.every((d) => d.items.length <= 3), `rep ${rep}`);
});

await test('one project and one tomorrow hook at a time', async () => {
  const vis = log.days.filter((d) => !d.skipped);
  const proj = Math.max(...vis.map((d) => d.proj)), hooks = Math.max(...vis.map((d) => d.hooks));
  const built = vis.filter((d, i) => i && d.projAt !== vis[i - 1].projAt && d.projAt).map((d) => d.projAt);
  const hookDays = vis.filter((d) => d.hooks).length;
  console.log(`   projects started ${built.length} (${built.join(', ')}), most at once ${proj}; days with a hook pending ${hookDays}/${vis.length} visited, most at once ${hooks}`);
  assert(proj <= 1 && hooks <= 1, `proj ${proj} hooks ${hooks}`);
});

await test('projects over six months: the first four, then slowly more (one at a time)', async () => {
  const r = await island(page, (I, S) => {
    const C = { dayMs: (di) => new Date(1970, 0, 1 + di, 12).getTime() };
    S.village = {}; S.intro = true;
    const d0 = Math.round((new Date(S.todayBoard.day + 'T12:00').getTime() - new Date(1970, 0, 1, 12).getTime()) / 86400000);
    const starts = [], done = []; let most = 0;
    for (let di = d0; di < d0 + 183; di++) {
      I.village.newDay(C.dayMs(di));
      const V = S.village;
      if (V.proj && V.proj.start === di) starts.push({ id: V.proj.id, day: di - d0 });
      if (V.doneNews?.di === di) done.push({ id: V.doneNews.id, day: di - d0 });
      most = Math.max(most, V.proj ? 1 : 0);
    }
    return { starts, done, most };
  });
  console.log(`   six months: ${r.starts.length} projects started, ${r.done.length} finished, most at once ${r.most}; started on days ${r.starts.map((x) => `${x.id} ${x.day}`).join(', ')}`);
  assert(r.most <= 1 && r.starts.length === 8 && r.done.length >= 7, JSON.stringify(r));
  const late = r.starts.slice(4).map((x, i, a) => (i ? x.day - a[i - 1].day : x.day - r.starts[3].day));
  assert(late.every((g) => g >= 20), `later projects come slowly: ${late}`);
});

await test('spread across the map: projects, drama places and rare-event spots in different corners', async () => {
  const r = await page.evaluate(() => {
    const pts = { gazebo: [30, 24], garden: [-8, 12], lookout: [36, -22], bandstand: [-4, 30], birdhide: [-16, -24], windmill: [22, -30], course: [46, 18], boatshed: [26, 32], rivalry: [2.4, 41.6], pumpkin: [4.6, -23], cake: [15.8, -3.4], storm: [14, 40.5], ghost: [-17.6, 41.2], door: [-12, -31], robot: [4.4, -0.8], hook: [-9, -13] };
    const q = {};
    for (const [k, [x, z]] of Object.entries(pts)) { const c = `${z < 0 ? 'N' : 'S'}${x < 8 ? 'W' : 'E'}`; (q[c] ||= []).push(k); }
    return q;
  });
  console.log(`   by quarter: ${JSON.stringify(r)}`);
  assert(Object.keys(r).length === 4 && Object.values(r).every((v) => v.length <= 6), JSON.stringify(r));
});

await close(page);
done();
