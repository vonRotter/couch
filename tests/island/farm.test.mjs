// The solo island core, part 2: farming (the welcome's steps with real key presses: till, plant, water, grow,
// harvest, ship; growth over a night and days, soil that dries, weeds), the bag, hotbar and the cottage chest
// (move, stack, a full bag), Rosa's shop (buy and sell), the workbench (craft, the farm helpers) and decorating
// (place, turn, take back).
import { open, close, startIsland, island, sim, at, setTime, test, assert, done, press, shot } from '../lively/helper.mjs';
import { hold, tp, toWalk, useText, use } from './isl.mjs';

const page = await open();
const D0 = at(2026, 11, 18, 9); // a Wednesday morning (radishes and carrots grow in every season)
const M = await page.evaluate(async () => { const m = await import('/src/scenes/solo/map.js'); return { HOME: m.HOME, FIELD: m.FIELD, BIN: m.BIN, STORE: m.STORE }; });
const F = M.FIELD;
/** Stand just below field tile (c, r), facing it (up). */
const atTile = (c, r) => tp(page, F.x0 + (c + 0.5) * F.size, F.z0 + (r + 0.5) * F.size + 1.0, 0, -1);
const stage = (c, r) => page.evaluate(async (k) => { const f = await import('/src/scenes/solo/farm.js'); const tl = window.game.current.save.tiles[k]; return tl ? f.stageOf(tl) : -2; }, `${c},${r}`);
/** Send villagers standing close along (one in front of you wins over the field). */
const clear = () => island(page, (I) => { for (const n of I.npcs) if (Math.hypot(n.x - I.player.x, n.z - I.player.z) < 5) { n.x += 14; n.route = []; } });
/** [E] where you stand (villagers walking by sent along first: one you face wins over the field). */
async function useHere(s) { await toWalk(page); await clear(); await use(page, s); }
const coolZap = () => island(page, (I) => { I.zipzap.cool = 0; });

await test('farming with the welcome\'s steps: till, plant, water, it grows, harvest, ship at the bin', async () => {
  await startIsland(page, { time: D0, name: 'Farmer', intro: false });
  await sim(page, 1.5);
  for (let i = 0; i < 12 && (await island(page, (I) => I.mode)) === 'dialog'; i++) { await sim(page, 0.3); await press(page, 'KeyE'); await sim(page, 0.2); }
  assert((await island(page, (I, S) => S.tut)) === 1, 'the farming steps start');
  await toWalk(page);
  await atTile(0, 5);
  await clear();
  assert(/till|pløy|grav/i.test(await useText(page)), `till: ${await useText(page)}`);
  await useHere(0.6);
  const t1 = await island(page, (I, S) => ({ tile: S.tiles['0,5'], tut: S.tut, held: I.held?.id }));
  assert(t1.tile && !t1.tile.crop && t1.tut === 2 && t1.held === 'radishSeed', JSON.stringify(t1));
  await useHere(0.6);
  const t2 = await island(page, (I, S) => ({ tile: S.tiles['0,5'], tut: S.tut, held: I.held?.id, seeds: S.inv.find((i) => i.id === 'radishSeed')?.n }));
  assert(t2.tile?.crop === 'radish' && t2.tut === 3 && t2.held === 'zipzap' && t2.seeds === 5, JSON.stringify(t2));
  await coolZap();
  await useHere(0.6);
  const t3 = await island(page, (I, S) => ({ wet: S.tiles['0,5'].wetUntil > Date.now() + window.__islandTimeOffset, tut: S.tut }));
  assert(t3.wet && t3.tut === 4, JSON.stringify(t3));
  assert((await stage(0, 5)) === 0, 'a seed at first');
  await shot(page, 'island-farm-planted');
  // four minutes later (a radish) it is ripe
  await setTime(page, D0 + 5 * 60e3);
  await sim(page, 1.5);
  assert((await stage(0, 5)) === 3, `ripe: ${await stage(0, 5)}`);
  assert((await island(page, (I, S) => S.tut)) === 5, 'the "it is ripe" step');
  assert(/harvest|høst/i.test(await useText(page)), await useText(page));
  await useHere(0.6);
  const t4 = await island(page, (I, S) => ({ tile: S.tiles['0,5'], radish: S.inv.find((i) => i.id === 'radish')?.n, tut: S.tut, held: I.held?.id, harvested: S.stats.harvested }));
  assert(!t4.tile?.crop && t4.radish === 1 && t4.tut === 6 && t4.held === 'radish' && t4.harvested === 1, JSON.stringify(t4));
  // the bin: [E] ships what you hold
  const c0 = await island(page, (I, S) => S.coins);
  await tp(page, M.BIN.x, M.BIN.z + 1.4, 0, -1);
  await clear();
  assert(/ship|send|selg/i.test(await useText(page)), await useText(page));
  await useHere(0.5);
  const t5 = await island(page, (I, S) => ({ coins: S.coins, radish: S.inv.some((i) => i.id === 'radish'), tut: S.tut, shipped: S.stats.shipped }));
  assert(t5.coins === c0 + 12 && !t5.radish && t5.tut === 7 && t5.shipped === 1, JSON.stringify({ c0, t5 }));
});

await test('Rosa\'s shop: talk to her, buy seeds (coins go down), the sell tab sells a crop; not enough coins: nothing bought', async () => {
  await toWalk(page);
  await tp(page, M.STORE.x, M.STORE.z + 3.2, 0, -1);
  await island(page, (I) => { const r = I.npc('rosa'); for (const n of I.npcs) if (n !== r && Math.hypot(n.x - I.player.x, n.z - I.player.z) < 5) { n.x += 14; n.route = []; } });
  await island(page, (I) => I.selectItem('zipzap'));
  const txt = await useText(page);
  assert(/shop|butikk|handle|Rosa/i.test(txt), txt);
  await use(page, 0.5);
  for (let i = 0; i < 8 && (await island(page, (I) => I.mode)) === 'dialog'; i++) { await press(page, 'KeyE'); await sim(page, 0.35); }
  assert((await island(page, (I) => I.mode)) === 'shop', `the shop opens: ${await island(page, (I) => I.mode)}`);
  await sim(page, 0.4);
  const b0 = await island(page, (I, S) => ({ coins: S.coins, row: I.shopRows()[I.shop.i], owned: S.inv.filter((x) => x.id === I.shopRows()[I.shop.i].id).reduce((a, x) => a + x.n, 0) }));
  await press(page, 'KeyE');
  const b1 = await island(page, (I, S, G, id) => ({ coins: S.coins, owned: S.inv.filter((x) => x.id === id).reduce((a, x) => a + x.n, 0), tut: S.tut }), b0.row.id);
  assert(b1.coins === b0.coins - b0.row.price && b1.owned === b0.owned + 1 && b1.tut === 8, JSON.stringify({ b0, b1 }));
  // the sell tab
  await island(page, (I, S) => { S.inv.push({ id: 'carrot', n: 2 }); I.renderShop(); });
  await sim(page, 1 / 30);
  await press(page, 'KeyD');
  const rows = await island(page, (I) => ({ tab: I.shop.tab, rows: I.shopRows().map((r) => r.id) }));
  assert(rows.tab === 1 && rows.rows.includes('carrot') && !rows.rows.includes('zipzap'), JSON.stringify(rows));
  await island(page, (I) => { I.shop.i = I.shopRows().findIndex((r) => r.id === 'carrot'); I.renderShop(); });
  const s0 = await island(page, (I, S) => S.coins);
  await press(page, 'KeyE');
  const s1 = await island(page, (I, S) => ({ coins: S.coins, n: S.inv.filter((x) => x.id === 'carrot').reduce((a, x) => a + x.n, 0) }));
  assert(s1.coins === s0 + 20 && s1.n === 1, JSON.stringify({ s0, s1 }));
  await shot(page, 'island-shop-sell');
  // too few coins: a toast, nothing bought
  await press(page, 'KeyA');
  await island(page, (I, S) => { S.coins = 0; I.shop.i = 0; I.renderShop(); });
  const n0 = await island(page, (I, S) => S.inv.reduce((a, x) => a + x.n, 0));
  await press(page, 'KeyE');
  const n1 = await island(page, (I, S) => ({ n: S.inv.reduce((a, x) => a + x.n, 0), coins: S.coins }));
  assert(n1.n === n0 && n1.coins === 0, JSON.stringify({ n0, n1 }));
  await press(page, 'KeyQ');
  await sim(page, 0.3);
  assert((await island(page, (I) => I.mode)) === 'walk', 'Q leaves the shop');
  await island(page, (I, S) => { S.coins = 200; });
});

await test('growing over a night and days: slow at night outside, the soil dries after six hours of daytime, weeds need cutting first', async () => {
  await toWalk(page);
  await island(page, (I, S) => { S.inv.push({ id: 'carrotSeed', n: 4 }); });
  // a carrot planted and watered at 20:58: the night (21-6) grows it at a tenth, so it is ripe in the morning
  await setTime(page, at(2026, 11, 18, 20, 58));
  await sim(page, 1.2);
  await atTile(1, 5);
  await clear();
  for (const id of ['zipzap', 'carrotSeed', 'zipzap']) { await island(page, (I, S, G, id) => I.selectItem(id), id); await coolZap(); await useHere(0.5); }
  const p = await island(page, (I, S) => S.tiles['1,5']);
  assert(p?.crop === 'carrot' && p.wetUntil > at(2026, 11, 18, 21), JSON.stringify(p));
  await setTime(page, at(2026, 11, 18, 21, 40));
  await sim(page, 1.2);
  assert((await stage(1, 5)) < 3, 'not ripe yet at 21:40 (2 minutes of day and 40 of night: about 6 of the 8 minutes)');
  await setTime(page, at(2026, 11, 19, 6, 10));
  await sim(page, 1.2);
  assert((await stage(1, 5)) === 3, `ripe in the morning: ${await stage(1, 5)}`);
  // the night's watering lasts six hours of daytime (night hours do not count): wet until about 12:00
  await island(page, (I) => I.doHarvest({ c: 1, r: 5, f: 0 }));
  const wet = (h, m = 0) => page.evaluate(([k, ms]) => window.game.current.save.tiles[k].wetUntil > ms, ['1,5', at(2026, 11, 19, h, m)]);
  assert(await wet(11, 50) && !(await wet(12, 10)), 'the night watering dries at about noon');
  // planted in dry soil and left dry: it does not grow, two days later it is still a seed
  await setTime(page, at(2026, 11, 19, 12, 30));
  await sim(page, 1.2);
  await island(page, (I) => I.selectItem('carrotSeed'));
  await useHere(0.5);
  await setTime(page, at(2026, 11, 21, 12, 30));
  await sim(page, 1.2);
  assert((await stage(1, 5)) === 0, `left dry: still a seed (${await stage(1, 5)})`);
  // watered at 12:30: wet until 18:30, and it grows again
  await island(page, (I) => I.selectItem('zipzap'));
  await coolZap();
  await useHere(0.5);
  const wet2 = (h, m = 0) => page.evaluate(([k, ms]) => window.game.current.save.tiles[k].wetUntil > ms, ['1,5', at(2026, 11, 21, h, m)]);
  assert(await wet2(18, 20) && !(await wet2(18, 40)), 'six hours wet');
  await setTime(page, at(2026, 11, 21, 12, 40));
  await sim(page, 1.2);
  assert((await stage(1, 5)) >= 1, `grows again: ${await stage(1, 5)}`);
  // a weed: the Zip-Zap cuts it first, then it tills
  await atTile(1, 1);
  await island(page, (I) => I.selectItem('zipzap'));
  const w0 = await useText(page);
  assert(/cut|klipp|kutt/i.test(w0), w0);
  await coolZap();
  await useHere(0.5);
  const w1 = await island(page, (I, S) => ({ weed: S.weeds.includes('1,1'), text: I.useAction(I.interactions())?.text }));
  assert(!w1.weed && /till|pløy|grav/i.test(w1.text), JSON.stringify(w1));
});

await test('the bag: Tab opens it, [E] picks up and puts down (move), onto the same thing stacks, Space sends to the hotbar; Tab closes', async () => {
  await toWalk(page);
  await island(page, (I, S) => { S.inv = [{ id: 'zipzap', n: 1, slot: 0 }, { id: 'wood', n: 3, slot: 1 }, { id: 'wood', n: 2, slot: 19 }, { id: 'stone', n: 4, slot: 21 }]; S.sel = 0; });
  await press(page, 'Tab');
  assert((await island(page, (I) => I.mode)) === 'bag', 'open');
  await sim(page, 0.3);
  // the cursor starts on the hotbar slot held (0); move right to the wood (slot 1), pick it up, up a row (the bag row
  // just above the hotbar: slots 18-26) to slot 19: they stack
  await press(page, 'ArrowRight');
  await press(page, 'KeyE');
  await press(page, 'ArrowUp');
  const cur = await island(page, (I) => I.bagUi.cur);
  assert(cur.c === 'inv' && cur.s === 19, JSON.stringify(cur));
  await press(page, 'KeyE');
  const r1 = await island(page, (I, S) => S.inv.filter((i) => i.id === 'wood').map((i) => `${i.slot}:${i.n}`));
  assert(r1.length === 1 && r1[0] === '19:5', `stacked: ${r1}`);
  // move the stone (slot 21) to an empty slot (22)
  await press(page, 'ArrowRight'); await press(page, 'ArrowRight');
  await press(page, 'KeyE');
  await press(page, 'ArrowRight');
  await press(page, 'KeyE');
  assert((await island(page, (I, S) => S.inv.find((i) => i.id === 'stone')?.slot)) === 22, 'moved to 22');
  // Space: from the bag row down to the hotbar
  await press(page, 'Space');
  const st = await island(page, (I, S) => S.inv.find((i) => i.id === 'stone')?.slot);
  assert(st < 9, `quick move to the hotbar: ${st}`);
  await shot(page, 'island-bag');
  await press(page, 'Tab');
  assert((await island(page, (I) => I.mode)) === 'walk', 'closed');
  // hotbar keys: 2 holds slot 1
  await press(page, 'Digit1');
  assert((await island(page, (I, S) => S.sel)) === 0, 'Digit1 selects slot 0');
});

await test('a full bag: what does not fit goes to the cottage chest (nothing lost), and the chest moves things back', async () => {
  await toWalk(page);
  const r = await page.evaluate(async () => {
    const Sv = await import('/src/scenes/solo/save.js');
    const { ITEMS } = await import('/src/scenes/solo/items.js');
    const ids = Object.keys(ITEMS).filter((k) => ['crop', 'seed', 'wood', 'gift', 'forage'].includes(ITEMS[k].kind) && k !== 'pumpkin');
    const S = window.game.current.save;
    S.inv = [];
    const size = Sv.bagSize(S);
    for (let i = 0; i < size; i++) S.inv.push({ id: i ? ids[i] : 'zipzap', n: 1, slot: i });
    const where = Sv.give(S, 'pumpkin', 3);
    return { size, where, chest: S.chest.filter((c) => c.id === 'pumpkin').map((c) => c.n), inv: S.inv.length };
  });
  assert(r.where === 'chest' && r.chest[0] === 3 && r.inv === r.size, JSON.stringify(r));
  await sim(page, 1.2); // (a toast says so)
  // open the chest in the cottage and Space moves the pumpkins over (the bag is full: it bumps, nothing lost)
  await island(page, (I) => I.bagUi.show(true));
  await sim(page, 0.3);
  const p = await island(page, (I, S) => { const it = S.chest.find((c) => c.id === 'pumpkin'); I.bagUi.cur = { c: 'chest', s: it.slot }; return it.slot; });
  await press(page, 'Space');
  const r2 = await island(page, (I, S) => ({ chest: S.chest.filter((c) => c.id === 'pumpkin').length, inv: S.inv.filter((i) => i.id === 'pumpkin').length }));
  assert(r2.chest === 1 && r2.inv === 0, `full bag: stays in the chest ${JSON.stringify(r2)}`);
  // free a slot: now it moves
  await island(page, (I, S) => { S.inv = S.inv.filter((i) => i.slot !== 5); });
  await press(page, 'Space');
  const r3 = await island(page, (I, S) => ({ chest: S.chest.filter((c) => c.id === 'pumpkin').length, inv: S.inv.filter((i) => i.id === 'pumpkin').map((i) => i.n) }));
  assert(r3.chest === 0 && r3.inv[0] === 3, JSON.stringify(r3));
  await press(page, 'KeyQ');
  await island(page, (I, S) => { S.inv = [{ id: 'zipzap', n: 1, slot: 0 }]; S.sel = 0; });
});

await test('the workbench: craft a fence and a sprinkler (materials taken), missing materials craft nothing; the sprinkler goes on a field tile and back', async () => {
  await toWalk(page);
  await island(page, (I, S) => { S.inv.push({ id: 'wood', n: 6 }, { id: 'stone', n: 5 }); });
  const bench = await island(page, (I) => ({ x: I.builder.bench.x, z: I.builder.bench.z }));
  await tp(page, bench.x, bench.z + 1.2, 0, -1);
  await clear();
  const txt = await useText(page);
  assert(/bench|benk/i.test(txt), txt);
  await useHere(0.5);
  assert((await island(page, (I) => I.mode)) === 'bench', 'the bench opens');
  // the first row is the fence (2 wood); in a panel [E] does it and [Q] goes back
  await press(page, 'KeyE');
  const f = await island(page, (I, S) => ({ store: S.store.fence, wood: S.inv.filter((i) => i.id === 'wood').reduce((a, i) => a + i.n, 0) }));
  assert(f.store === 1 && f.wood === 4, JSON.stringify(f));
  // the sprinkler: 5 stone and 3 wood, into the bag
  const si = await island(page, (I) => I.builder.benchRows().findIndex((r) => r.id === 'sprinkler'));
  await island(page, (I, S, G, si) => { I.builder.panel.i = si; I.builder.renderBench(); }, si);
  await press(page, 'KeyE');
  const s = await island(page, (I, S) => ({ spr: S.inv.find((i) => i.id === 'sprinkler')?.n, stone: S.inv.filter((i) => i.id === 'stone').reduce((a, i) => a + i.n, 0), wood: S.inv.filter((i) => i.id === 'wood').reduce((a, i) => a + i.n, 0) }));
  assert(s.spr === 1 && s.stone === 0 && s.wood === 1, JSON.stringify(s));
  // again: not enough
  await press(page, 'KeyE');
  assert((await island(page, (I, S) => S.inv.find((i) => i.id === 'sprinkler')?.n)) === 1, 'no second sprinkler');
  await shot(page, 'island-bench');
  await press(page, 'KeyQ');
  await sim(page, 0.2);
  assert((await island(page, (I) => I.mode)) === 'walk', `closed: ${await island(page, (I) => I.mode)}`);
  // the sprinkler on a field tile (empty), then back into the bag
  await atTile(3, 5);
  await clear();
  await island(page, (I) => I.selectItem('sprinkler'));
  await useHere(0.4);
  assert((await island(page, (I, S) => S.tiles['3,5']?.obj)) === 'sprinkler', 'placed');
  await useHere(0.4);
  const back = await island(page, (I, S) => ({ obj: S.tiles['3,5']?.obj || null, n: S.inv.find((i) => i.id === 'sprinkler')?.n }));
  assert(!back.obj && back.n === 1, JSON.stringify(back));
});

await test('decorating the yard: place the fence ([E]), turn it (a Space tap), take it back ([E]); Q ends', async () => {
  await toWalk(page);
  await tp(page, M.HOME.x + 4, M.HOME.z + 5, 1, 0);
  await clear();
  const ok = await island(page, (I) => I.builder.startDecorate('fence'));
  assert(ok, 'decorate mode starts on your land');
  await sim(page, 0.4);
  // find a free cell near the cursor
  const cell = await island(page, (I) => {
    const B = I.builder;
    for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) { const x = B.cur.x + dx, z = B.cur.z + dz; if (B.cellOk(x, z) && Math.hypot(x - I.player.x, z - I.player.z) < 5) { B.cur.x = B.cur.fx = x; B.cur.z = B.cur.fz = z; return { x, z }; } }
    return null;
  });
  assert(cell, 'a free cell');
  await press(page, 'KeyE');
  const p = await island(page, (I, S, G, c) => S.yard.find((q) => q.id === 'fence' && Math.hypot(q.x - c.x, q.z - c.z) < 0.7) || null, cell);
  assert(p && !(await island(page, (I, S) => S.store.fence)), `placed: ${JSON.stringify(p)}`);
  const r0 = p.r || 0;
  await press(page, 'Space');
  await sim(page, 0.1);
  const r1 = await island(page, (I, S, G, c) => S.yard.find((q) => q.id === 'fence' && Math.hypot(q.x - c.x, q.z - c.z) < 0.7)?.r || 0, cell);
  assert(r1 === (r0 + 1) % 4, `turned: ${r0} -> ${r1}`);
  await shot(page, 'island-decorate');
  await press(page, 'KeyE');
  const gone = await island(page, (I, S) => ({ yard: S.yard.filter((q) => q.id === 'fence').length, store: S.store.fence }));
  assert(gone.yard === 0 && gone.store === 1, JSON.stringify(gone));
  await press(page, 'KeyQ');
  await sim(page, 0.2);
  assert((await island(page, (I) => I.mode)) === 'walk', 'Q ends decorating');
  // furniture never goes in the yard
  await island(page, (I, S) => { S.store.bed = 1; });
  const no = await island(page, (I) => I.builder.startDecorate('bed'));
  assert(!no && (await island(page, (I) => I.mode)) === 'walk', 'a bed is for inside');
});

await test('no console errors', async () => { assert(!page.errors.length, page.errors.join('\n')); });
await close(page);
done();
