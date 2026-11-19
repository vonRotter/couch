// The solo island core, part 3: villagers' days (asleep at home at night, knocking, a closed store, locked game
// doors), friendship hearts (a chat and a gift), the journal's tabs and the map, fishing, the café (cook and
// serve), a hop trail run, the museum, the trophy shelf, and the seasons (the winter look and the sled).
import { open, close, startIsland, island, sim, at, setTime, test, assert, done, press, shot } from '../lively/helper.mjs';
import { tp, toWalk, useText, use, rawKeys } from './isl.mjs';

const page = await open();
const D0 = at(2026, 11, 18, 11); // a Wednesday in a summer week
const NIGHT = at(2026, 11, 18, 23, 40);
const imp = (path, fn, arg) => page.evaluate(async ([path, src, arg]) => (0, eval)(`(${src})`)(await import(path), arg), [path, String(fn), arg]);
/** Stand by villager id, facing them (others sent along). */
async function faceNpc(id) {
  await island(page, (I, S, G, id) => {
    const n = I.npc(id), P = I.player;
    for (const m of I.npcs) if (m !== n && Math.hypot(m.x - n.x, m.z - n.z) < 5) { m.x += 14; m.route = []; }
    P.x = n.x; P.z = n.z + 1.3; P.lx = undefined; P.fx = 0; P.fz = -1;
    I.groundCheck(P, I.walkState);
  }, id);
}
async function talkThrough(max = 14) {
  for (let i = 0; i < max && (await island(page, (I) => I.mode)) === 'dialog'; i++) { await sim(page, 0.3); await press(page, 'KeyE'); }
  await sim(page, 0.3);
}

await test('night: villagers are at home asleep (hidden, Zzz), the store is closed; knocking gets a sleepy answer through the door', async () => {
  await startIsland(page, { time: NIGHT, name: 'Night' });
  await toWalk(page);
  const r = await island(page, (I) => I.npcs.filter((n) => n.id !== 'shelby').map((n) => ({ id: n.id, inside: !!n.inside, sleep: !!n.sleep, hidden: I.homes.hidden(n) })));
  const bad = r.filter((n) => n.id !== 'bram' && !(n.inside && n.sleep && n.hidden));
  assert(!bad.length, `not in bed at 23:40: ${JSON.stringify(bad)}`);
  // Hazel's door: knock
  const H = await imp('/src/scenes/solo/map.js', (M) => M.HOME_DOORS.hazel.spot);
  await tp(page, H.x, H.z + 0.4, 0, -1);
  const txt = await useText(page);
  assert(/knock|bank/i.test(txt), txt);
  await use(page, 1.2);
  const d = await island(page, (I) => ({ mode: I.mode, key: I.dlg?.lines[I.dlg.i]?.key }));
  assert(d.mode === 'dialog' && /^isl\.knock\.hazel\./.test(d.key), JSON.stringify(d));
  await talkThrough();
  // Rosa's store at night: closed (a sign, and she is asleep)
  const R = await imp('/src/scenes/solo/map.js', (M) => M.HOME_DOORS.rosa.spot);
  await tp(page, R.x, R.z + 0.3, 0, -1);
  const st = await useText(page);
  assert(/closed|stengt/i.test(st), st);
  await shot(page, 'island-night-store');
});

await test('morning: they wake and come out on their schedule; a locked game door says what it needs and opens nothing', async () => {
  await setTime(page, at(2026, 11, 19, 9, 30));
  await sim(page, 40, 1 / 15);
  await toWalk(page);
  const r = await island(page, (I) => I.npcs.filter((n) => ['hazel', 'rosa', 'pip', 'hoot', 'mumble'].includes(n.id)).map((n) => ({ id: n.id, inside: !!n.inside, sleep: !!n.sleep, visible: n.model.group.visible })));
  assert(r.every((n) => !n.inside && !n.sleep && n.visible), JSON.stringify(r));
  // Pillow Keep needs the bridge
  const door = await imp('/src/scenes/solo/map.js', (M) => M.PLACES.find((p) => p.id === 'keep').door);
  await island(page, (I, S) => { S.unlocks.bridge = true; });
  await tp(page, door.x, door.z + 0.4, 0, -1);
  await island(page, (I, S) => { S.unlocks.bridge = false; });
  const txt = await useText(page);
  assert(txt && !/enter|gå inn/i.test(txt), `locked: ${txt}`);
  await use(page, 0.5);
  assert(await page.evaluate(() => window.game.current.constructor.name === 'SoloIslandScene' && !window.game.switching), 'no game starts');
  await island(page, (I, S) => { S.unlocks.bridge = true; });
  assert(/Pillow|Pute|Keep/i.test(await useText(page)), `open: ${await useText(page)}`);
  await island(page, (I, S) => { S.unlocks.bridge = false; });
});

await test('friendship: a chat once an hour gives points, a loved gift more; ten points make a heart (a toast), shown on the line', async () => {
  await toWalk(page);
  await island(page, (I, S) => { S.npcs.hazel = { pts: 6, talkAt: 0, giftAt: 0, ev: 0, q: 1, met: true }; S.quests = {}; S.inv.push({ id: 'tomato', n: 2 }); I.selectItem('zipzap'); });
  await faceNpc('hazel');
  await use(page, 0.4);
  const p1 = await island(page, (I, S) => S.npcs.hazel.pts);
  assert(p1 === 9, `a chat: +3 (${p1})`);
  await talkThrough();
  await toWalk(page);
  // again within the hour: no more points
  await faceNpc('hazel');
  await use(page, 0.4);
  await talkThrough();
  assert((await island(page, (I, S) => S.npcs.hazel.pts)) === 9, 'once an hour');
  // a tomato (she loves them): +10, and the first heart
  await toWalk(page);
  await island(page, (I) => I.selectItem('tomato'));
  await faceNpc('hazel');
  await use(page, 0.4);
  let ask = false;
  for (let i = 0; i < 10 && (await island(page, (I) => I.mode)) === 'dialog'; i++) {
    const L = await island(page, (I) => I.dlg.lines[I.dlg.i]);
    if (L.key === 'isl.giftAsk') ask = true;
    await sim(page, 0.3);
    await press(page, 'KeyE');
  }
  const h = await island(page, (I, S) => ({ pts: S.npcs.hazel.pts, tom: S.inv.filter((i) => i.id === 'tomato').reduce((a, i) => a + i.n, 0), learned: S.friends?.known?.hazel || S.fb || null }));
  assert(ask && h.pts === 19 && h.tom === 1, JSON.stringify(h));
  const hearts = await island(page, async (I, S) => (await import('/src/scenes/solo/npcs.js')).heartsOf(S.npcs.hazel));
  assert(hearts === 1, `one heart: ${hearts}`);
  await toWalk(page);
});

await test('the journal: F opens it, 1-8 and ] go through every tab (none shows a raw text key), Q closes; M opens the map', async () => {
  await toWalk(page);
  await press(page, 'KeyF');
  assert((await island(page, (I) => I.mode)) === 'journal', 'open');
  const tabs = await imp('/src/scenes/solo/journal.js', (J) => J.TABS);
  for (let k = 1; k <= tabs.length; k++) {
    await press(page, `Digit${k}`);
    await sim(page, 0.1);
    const r = await island(page, (I) => ({ tab: I.journal.tab, html: I.hud.panel.innerText.length }));
    assert(r.tab === tabs[k - 1] && r.html > 10, `tab ${k}: ${JSON.stringify(r)}`);
    const raw = await rawKeys(page);
    assert(!raw.length, `raw keys on ${r.tab}: ${raw.join(', ')}`);
  }
  await press(page, 'Digit2');
  await press(page, 'BracketRight');
  assert((await island(page, (I) => I.journal.tab)) === tabs[2], '] next tab');
  await shot(page, 'island-journal');
  await press(page, 'KeyQ');
  assert((await island(page, (I) => I.mode)) === 'walk', 'Q closes');
  await sim(page, 0.3);
  await press(page, 'KeyM');
  const m = await island(page, (I) => ({ mode: I.mode, tab: I.journal.tab, markers: I.atlas.markers().length }));
  assert(m.mode === 'journal' && m.tab === 'map' && m.markers > 5, JSON.stringify(m));
  await shot(page, 'island-map');
  await sim(page, 0.4);
  await press(page, 'KeyM');
  assert((await island(page, (I) => I.mode)) === 'walk', 'M closes the map');
});

await test('fishing: the rod at the pier casts, a bite, [E] reels with hits in the green zone; the fish goes in the bag', async () => {
  await toWalk(page);
  await island(page, (I, S) => { S.sea.rod = true; S.inv.push({ id: 'rod', n: 1 }); I.selectItem('rod'); });
  const pier = await imp('/src/scenes/solo/map.js', (M) => M.PIER);
  await tp(page, pier.x + 0.6, pier.z0 + 8, 1, 0);
  const txt = await useText(page);
  assert(/cast|kast/i.test(txt), `cast here: ${txt}`);
  const c0 = await island(page, (I, S) => S.sea.caught || 0);
  await use(page, 0.2);
  assert((await island(page, (I) => I.mode)) === 'fish', 'fishing');
  for (let i = 0; i < 200 && (await island(page, (I) => I.fishing.state)) !== 'bite'; i++) await sim(page, 0.1);
  await press(page, 'KeyE');
  assert((await island(page, (I) => I.fishing.state)) === 'reel', 'reeling');
  for (let i = 0; i < 12 && (await island(page, (I) => I.fishing.state)) === 'reel'; i++) {
    await island(page, (I) => { const R = I.fishing.reel; R.p = R.zc; R.speed = 0; });
    await press(page, 'KeyE');
  }
  const r = await island(page, (I, S) => ({ st: I.fishing.state, caught: S.sea.caught, fish: I.fishing.fish, n: S.inv.filter((i) => i.id === I.fishing.fish).reduce((a, i) => a + i.n, 0) }));
  assert(r.st === 'result' && r.caught === c0 + 1 && r.n >= 1, JSON.stringify(r));
  await shot(page, 'island-fish');
  await sim(page, 3.5);
  assert((await island(page, (I) => I.mode)) === 'walk', 'back to walking');
});

await test('the café: cook carrot soup at the stove, open for guests, serve the order (coins), the night ends with a summary', async () => {
  await toWalk(page);
  await setTime(page, at(2026, 11, 19, 12));
  await island(page, (I, S) => { S.cafe.repaired = true; I.cafe.refresh(); S.inv.push({ id: 'carrot', n: 4 }); I.selectItem('zipzap'); });
  await sim(page, 1.2);
  await toWalk(page);
  const sp = await imp('/src/scenes/solo/cafe.js', (C) => C.CAFE_SPOTS);
  await tp(page, sp.STOVE.x, sp.STOVE.z + 1.2, 0, -1);
  await island(page, (I) => { for (const n of I.npcs) if (Math.hypot(n.x - I.player.x, n.z - I.player.z) < 5) { n.x += 14; n.route = []; } });
  const txt = await useText(page);
  assert(/cook|lag/i.test(txt), txt);
  await use(page, 0.4);
  assert((await island(page, (I) => I.mode)) === 'cook', 'the cook panel');
  const ids = await imp('/src/scenes/solo/sea.js', (S) => Object.keys(S.RECIPES));
  await island(page, (I, S, G, i) => { I.cafe.cook.i = i; I.cafe.renderCook(); }, ids.indexOf('carrotSoup'));
  await press(page, 'KeyE');
  await press(page, 'KeyE');
  const k = await island(page, (I, S) => ({ soup: S.inv.find((i) => i.id === 'carrotSoup')?.n, carrots: S.inv.filter((i) => i.id === 'carrot').reduce((a, i) => a + i.n, 0), cooked: S.cafe.cooked }));
  assert(k.soup === 2 && k.carrots === 0 && k.cooked === 2, JSON.stringify(k));
  await press(page, 'KeyQ');
  await sim(page, 0.3);
  // the counter: open for guests (yes), serve whoever waits
  await tp(page, sp.SERVE_SPOT.x, sp.SERVE_SPOT.z, 0, -1);
  await use(page, 0.4);
  assert((await island(page, (I) => I.mode)) === 'dialog', 'asks to open');
  await press(page, 'KeyE');
  await sim(page, 0.2);
  assert((await island(page, (I) => I.mode)) === 'service', 'service');
  const c0 = await island(page, (I, S) => S.coins);
  for (let i = 0; i < 120 && (await island(page, (I) => I.mode)) === 'service'; i++) {
    await sim(page, 0.25);
    const w = await island(page, (I) => { const sv = I.cafe.svc; if (!sv || sv.done) return 'done'; const i = sv.seats.findIndex((g) => g && g.state === 'wait'); if (i < 0) return -1; sv.sel = i; sv.dish = I.cafe.dishesInStock().indexOf(sv.seats[i].order); return i; });
    if (w === 'done') break;
    if (w >= 0) await press(page, 'KeyE');
  }
  const s = await island(page, (I, S) => ({ coins: S.coins, served: S.cafe.served, done: I.cafe.svc?.done, soup: S.inv.find((i) => i.id === 'carrotSoup')?.n || 0 }));
  assert(s.served === 2 && s.coins > c0 + 100 && s.done && s.soup === 0, JSON.stringify({ c0, s }));
  await shot(page, 'island-cafe-summary');
  await sim(page, 0.6);
  await press(page, 'KeyE');
  await sim(page, 0.3);
  const e = await island(page, (I, S) => ({ mode: I.mode, nights: S.cafe.nights }));
  assert(e.mode === 'walk' && e.nights === 1, JSON.stringify(e));
});

await test('a hop trail: the sign asks, 3-2-1, landing top after top reaches the bell (a time and coins); a fall puts you back', async () => {
  await toWalk(page);
  const tr = await island(page, (I) => { const t = Object.values(I.hops.trails)[0]; return { id: t.id, sign: t.T.sign, n: t.plats.length }; });
  await tp(page, tr.sign.x, tr.sign.z + 1.2, 0, -1);
  await island(page, (I) => { for (const n of I.npcs) if (Math.hypot(n.x - I.player.x, n.z - I.player.z) < 6) { n.x += 14; n.route = []; } });
  const txt = await useText(page);
  assert(/trail|løype|sti|hop/i.test(txt), txt);
  await use(page, 0.4);
  assert((await island(page, (I) => I.mode)) === 'dialog', 'the sign asks');
  await press(page, 'KeyE'); // "Run it"
  await sim(page, 0.2);
  assert((await island(page, (I) => I.mode)) === 'hopgo', 'countdown');
  await sim(page, 3.6);
  assert((await island(page, (I) => I.mode)) === 'walk' && (await island(page, (I) => !!I.hops.run)), 'running');
  const c0 = await island(page, (I, S) => S.coins);
  // a fall: from the first top down to the ground below puts you back on it
  await island(page, (I) => { const r = I.hops.run, o = r.tr.plats[0], P = I.player; P.x = o.x; P.z = o.z; P.air = true; P.fy = o.top + 0.3; P.vy = 0; P.lx = P.x; P.lz = P.z; });
  await sim(page, 0.6);
  await island(page, (I) => { const r = I.hops.run, o = r.tr.plats[0], P = I.player; P.takeoff = { x: o.x, z: o.z, fy: o.top }; const o1 = r.tr.plats[1], dx = o1.x - o.x, dz = o1.z - o.z, d = Math.hypot(dx, dz) || 1; P.x = o.x - (dz / d) * 2.2; P.z = o.z + (dx / d) * 2.2; P.air = true; P.vy = 0; P.fy = o.top; P.lx = P.x; P.lz = P.z; });
  await sim(page, 1.2);
  const back = await island(page, (I) => ({ falls: I.hops.run.falls, d: Math.hypot(I.player.x - I.hops.run.tr.plats[0].x, I.player.z - I.hops.run.tr.plats[0].z) }));
  assert(back.falls >= 1 && back.d < 1.5, `put back: ${JSON.stringify(back)}`);
  for (let i = 1; i < tr.n; i++) {
    await island(page, (I, S, G, i) => { const o = I.hops.run.tr.plats[i], P = I.player; P.x = o.x; P.z = o.z; P.air = true; P.fy = o.top + 0.4; P.vy = 0; P.lx = P.x; P.lz = P.z; }, i);
    await sim(page, 0.5);
  }
  const r = await island(page, (I, S, G, id) => ({ done: I.hops.run?.done, best: S.hops.best[id], coins: S.coins }), tr.id);
  assert(r.done && r.best > 0 && r.coins > c0, JSON.stringify({ c0, r }));
  await sim(page, 5);
  await toWalk(page);
  assert(!(await island(page, (I) => !!I.hops.run)), 'the run ends after the time is shown');
});

await test('the museum: Hoot takes a fish for a room (it leaves the bag, the count goes up); the trophy shelf shows a trophy close up', async () => {
  await toWalk(page);
  const r = await island(page, (I, S) => {
    const id = I.museum.donatable()[0] || null;
    const n0 = I.museum.total;
    return { id, n0 };
  });
  assert(r.id, 'the fish from fishing can be donated');
  const door = await island(page, (I) => I.museum.constructor && { x: I.map.places ? 0 : 0 });
  void door;
  await island(page, (I) => I.museum.open());
  assert((await island(page, (I) => I.mode)) === 'museum', 'open');
  await island(page, (I, S, G, id) => I.museum.donate(id), r.id);
  const r2 = await island(page, (I, S, G, id) => ({ got: !!I.museum.got[id], total: I.museum.total, inBag: S.inv.some((i) => i.id === id) }), r.id);
  assert(r2.got && r2.total === r.n0 + 1, JSON.stringify(r2));
  await shot(page, 'island-museum');
  await island(page, (I) => I.museum.close());
  await toWalk(page);
  // the trophy shelf, inside the cottage
  const tid = await imp('/src/scenes/solo/shelf.js', (Sh) => Sh.TROPHIES[0].id || Sh.TROPHIES[0]);
  await island(page, (I, S, G, tid) => { S.deco[tid] = true; I.shelf.add(tid); }, tid);
  await island(page, (I) => { const f = I.shelf.front, P = I.player; P.x = f.x; P.z = f.z; P.lx = undefined; P.fx = 0; P.fz = -1; I.groundCheck(P, I.walkState); });
  const st = await useText(page);
  assert(/shelf|hylle|trophy|look|se/i.test(st), st);
  await use(page, 0.5);
  const sh = await island(page, (I) => ({ mode: I.mode, dlg: I.hud.dialog.innerText }));
  assert(sh.mode === 'shelf' && sh.dlg.length > 5, JSON.stringify(sh));
  await shot(page, 'island-shelf');
  await press(page, 'KeyQ');
  await sim(page, 0.4);
  assert((await island(page, (I) => I.mode)) === 'walk', 'closed');
  await island(page, (I) => I.builder.goOutside());
  await page.waitForTimeout(1000);
  await sim(page, 0.3);
});

await test('seasons: a winter week looks wintry (snow) and has the sled: a ride ends with cocoa the first time that week', async () => {
  await setTime(page, at(2026, 12, 1, 12));
  await sim(page, 3); // (a new day: the Today board shows after a moment)
  await toWalk(page);
  const s = await island(page, (I) => ({ season: I.seasons.season, sledOn: I.seasons.sled.on }));
  assert(s.season === 'winter' && s.sledOn, JSON.stringify(s));
  await shot(page, 'island-winter');
  const sp = await island(page, (I) => ({ x: I.seasons.sled.sled.position.x, z: I.seasons.sled.sled.position.z }));
  await tp(page, sp.x, sp.z + 1, 0, -1);
  await island(page, (I) => { for (const n of I.npcs) if (Math.hypot(n.x - I.player.x, n.z - I.player.z) < 5) { n.x += 14; n.route = []; } });
  const txt = await useText(page);
  assert(/sled|ake|kjelke/i.test(txt), txt);
  await use(page, 0.2);
  assert((await island(page, (I) => I.mode)) === 'sled', 'riding');
  for (let i = 0; i < 60 && (await island(page, (I) => I.mode)) === 'sled'; i++) await sim(page, 0.5);
  const r = await island(page, (I, S) => ({ mode: I.mode, rides: S.sled.rides, cocoa: S.inv.some((i) => i.id === 'cocoa') }));
  assert(r.mode === 'walk' && r.rides === 1 && r.cocoa, JSON.stringify(r));
  // summer again next week: no sled
  await setTime(page, at(2026, 12, 15, 12));
  await sim(page, 1.5);
  const s2 = await island(page, (I) => ({ season: I.seasons.season, sledOn: I.seasons.sled.on }));
  assert(s2.season !== 'winter' && !s2.sledOn, JSON.stringify(s2));
});

await test('no console errors', async () => { assert(!page.errors.length, page.errors.join('\n')); });
await close(page);
done();
