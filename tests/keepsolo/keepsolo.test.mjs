// Pillow Keep Solo (scenes/keepsolo.js): from the island's keep door (the bridge built), the hero picker, the town
// of Pillowby, the first floor's step-by-step tutorial (the card, then one control at a time), the inventory
// (pick up gear and potions, wear, drink, drag and drop in the bag), the starting kit and Bolster's forge, rooms
// with a locked door and a key, a fight, fainting (the bag drops and waits) and the save: resume after a page
// reload, and End in the pause menu back to the island at the keep door.
import { open, close, startIsland, island, sim, at, test, assert, done, press, shot } from '../lively/helper.mjs';
import { hold } from '../island/isl.mjs';

const page = await open();
const D0 = at(2026, 11, 18, 11);
/** Run fn(K, hs, e, G, arg) in the page with K the keep scene, hs the hero's save, e the hero. */
const K = (fn, arg) => page.evaluate(([src, arg]) => { const G = window.game, k = G.current; return (0, eval)(`(${src})`)(k, k.hs, k.hero, G, arg); }, [String(fn), arg]);
const inKeep = () => page.waitForFunction(() => window.game.current?.constructor?.name === 'KeepSoloScene' && !window.game.switching, null, { timeout: 30000 });
const settle = async () => { await page.waitForFunction(() => !window.game.current.moving, null, { timeout: 20000 }).catch(() => {}); };
/** Wait for the keep to finish moving between worlds (a wipe: game timers plus the real clock). */
async function waitMoved() { for (let i = 0; i < 40 && (await K((k) => k.moving)); i++) await sim(page, 0.1); await settle(); }
/** The nearest live grumble to the hero, with the hero put next to it (on walkable floor). */
const nextTo = () => K((k, hs, e) => {
  const g = k.grumbles.filter((g) => !g.dead).sort((a, b) => Math.hypot(a.x - e.x, a.z - e.z) - Math.hypot(b.x - e.x, b.z - e.z))[0];
  if (!g) return null;
  for (const [dx, dz] of [[1.4, 0], [-1.4, 0], [0, 1.4], [0, -1.4], [1, 1], [-1, -1]]) if (k.walkableAt(g.x + dx, g.z + dz)) { e.x = g.x + dx; e.z = g.z + dz; break; }
  e.fx = (g.x - e.x) / 1.4; e.fz = (g.z - e.z) / 1.4;
  return { kind: g.kind, hp: g.hp };
});

await test('the keep door on the island (the bridge built) starts Pillow Keep Solo with the hero picker; Space picks; Pillowby', async () => {
  await startIsland(page, { time: D0, name: 'Hero', save: (S) => { S.unlocks.bridge = true; S.unlocks.bridgeWood = 10; } });
  await island(page, (I) => { if (I.mode === 'today') { I.hud.setPanel(null); I.mode = 'walk'; } });
  const door = await page.evaluate(async () => (await import('/src/scenes/solo/map.js')).PLACES.find((p) => p.id === 'keep').door);
  await island(page, (I, S, G, d) => { const P = I.player; P.x = d.x; P.z = d.z + 0.4; P.lx = undefined; P.fx = 0; P.fz = -1; I.groundCheck(P, I.walkState); }, door);
  await press(page, 'KeyE');
  await inKeep();
  await sim(page, 0.5);
  const r0 = await K((k) => ({ mode: k.mode, picker: !!k.picker, text: document.querySelector('.ks-pick, .ks-panel')?.innerText?.slice(0, 80) || '' }));
  assert(r0.mode === 'pick' && r0.picker, JSON.stringify(r0));
  await shot(page, 'keepsolo-picker');
  await press(page, 'Space');
  await sim(page, 0.5);
  const r = await K((k, hs) => ({ mode: k.mode, kind: k.kind, cls: k.cls, started: hs.started, weapon: hs.gear.weapon?.slot, belt: hs.belt.filter(Boolean).map((x) => x.use) }));
  assert(r.mode === 'town' && r.kind === 'town' && r.started, JSON.stringify(r));
  // the starting kit: a weapon worn, two red potions, a blue one and a Town Portal scroll on the belt
  assert(r.weapon === 'weapon' && r.belt.filter((u) => u === 'hp').length === 2 && r.belt.includes('mp') && r.belt.includes('tp'), `kit: ${JSON.stringify(r)}`);
  await shot(page, 'keepsolo-town');
});

await test('the gate leads to the first floor; the tutorial\'s card ("Show me how"), then the attack step near a grumble, done by attacking', async () => {
  await sim(page, 3);
  const gate = await K((k) => { k.openPanel('gate'); return { kind: k.panelKind, text: k.panel?.el?.innerText?.slice(0, 200) || '' }; });
  assert(gate.kind === 'gate' && gate.text.length > 5, JSON.stringify(gate));
  await K((k) => { k.closePanel(); k.enterFloor(0); });
  await sim(page, 1);
  await waitMoved();
  const f = await K((k) => ({ kind: k.kind, g: k.g, grumbles: k.grumbles.filter((g) => !g.dead).length, doors: k.doors.length }));
  assert(f.kind === 'dungeon' && f.g === 0 && f.grumbles > 0, JSON.stringify(f));
  await sim(page, 2.5);
  const card = await page.evaluate(() => !!window.game.tutorialCard);
  assert(card, 'the tutorial card is up');
  await page.evaluate(() => window.game.tutorialCard.answer('show'));
  await sim(page, 0.5);
  assert(await K((k) => !!k.teach && k.teach.active), 'the tutorial runs');
  const g = await nextTo();
  assert(g, 'a grumble');
  await sim(page, 1.5);
  const step = await K((k) => k.teach.step(k.player)?.id || null);
  assert(step === 'attack', `the attack step near a grumble: ${step}`);
  const txt = await page.evaluate(() => [...document.querySelectorAll('div')].filter((d) => d.style.display !== 'none' && /attack|Attack|angrip/i.test(d.textContent) && d.children.length < 4).map((d) => d.textContent).join(' | ').slice(0, 200));
  assert(txt, 'the step shows on screen');
  await shot(page, 'keepsolo-tutorial-attack');
  await press(page, 'Space');
  await sim(page, 1.6);
  const after = await K((k) => ({ step: k.teach.step(k.player)?.id || null, left: k.teach.stateOf(k.player)?.left.length }));
  assert(after.step !== 'attack' && after.left === 4, `attack done, four steps left: ${JSON.stringify(after)}`);
});

await test('a fight: attacking a grumble poofs it into fluff (XP, the fluffed count)', async () => {
  const x0 = await K((k, hs) => ({ xp: hs.xp, level: hs.level, fluffed: hs.stats.fluffed }));
  let dead = false;
  for (let i = 0; i < 30 && !dead; i++) {
    const g = await nextTo();
    if (!g) break;
    await K((k, hs, e) => { e.hp = e.st.maxHp; });
    await press(page, 'Space');
    await sim(page, 0.4);
    dead = await K((k, hs, e, G, n) => hs.stats.fluffed > n, x0.fluffed);
  }
  const x1 = await K((k, hs) => ({ xp: hs.xp, level: hs.level, fluffed: hs.stats.fluffed }));
  assert(dead && (x1.xp > x0.xp || x1.level > x0.level), JSON.stringify({ x0, x1 }));
});

await test('the tutorial\'s other steps, each at its moment: the class move near a charger, a potion at half health, picking up gear, a skill', async () => {
  const stepNow = async () => { await sim(page, 1.6); return K((k) => k.teach.step(k.player)?.id || null); };
  const seen = [];
  // a potion at half health
  await K((k, hs, e) => { for (const g of k.grumbles) if (!g.dead && Math.hypot(g.x - e.x, g.z - e.z) < 12) { g.x += 40; g.z += 40; } e.hp = e.st.maxHp * 0.4; });
  let st = await stepNow();
  assert(st === 'potion', `the potion step at half health: ${st}`);
  seen.push(st);
  const col = await K((k, hs) => hs.belt.findIndex((x) => x?.use === 'hp'));
  await press(page, `Digit${5 + col}`);
  await sim(page, 1.5);
  // gear on the floor: the pick-up step, [C] picks it up
  await page.evaluate(async () => { const I = await import('/src/scenes/keepsolo/items.js'); const k = window.game.current; const g = k.spawnGear(I.rollItem({ ilvl: 1, rarity: 0, slot: 'gloves', cls: k.cls, diff: 0 }), k.hero.x + 0.3, k.hero.z); g.vx = g.vz = 0; });
  st = await stepNow();
  assert(st === 'item', `the item step: ${st}`);
  seen.push(st);
  await hold(page, 'KeyQ', 0.1);
  await sim(page, 1.5);
  // a skill learned and ready: the skill step, its key casts it
  const id = await page.evaluate(async () => {
    const C = await import('/src/scenes/keepsolo/classes.js');
    const k = window.game.current, hs = k.hs;
    const def = C.TREE[k.cls].find((d) => d.kind === 'active' && d.id !== C.B_MOVE[k.cls] && !k.raiseSkill(d.id));
    if (!def) return null;
    k.assignSkill(1, def.id);
    k.hero.mana = k.hero.st.maxMana;
    return def.id;
  });
  assert(id, 'a skill to learn');
  // (a grumble in front: skills are cast at things)
  await K((k, hs, e) => { const g = k.grumbles.find((g) => !g.dead); g.x = e.x + 2; g.z = e.z; g.state = 'idle'; });
  st = await stepNow();
  assert(st === 'skill', `the skill step: ${st}`);
  seen.push(st);
  await press(page, 'Digit2');
  await sim(page, 1.5);
  // a charger near: the class move (the knight's block: hold [E])
  await K((k, hs, e) => { const g = k.grumbles.find((g) => !g.dead); g.kind = 'charger'; g.x = e.x + 4; g.z = e.z; e.hp = e.st.maxHp; });
  st = await stepNow();
  assert(st === 'move', `the class move step: ${st}`);
  seen.push(st);
  await hold(page, 'KeyE', 0.4);
  await sim(page, 1.6);
  const r = await K((k) => ({ active: k.teach.active, left: k.teach.stateOf(k.player)?.left.length }));
  assert(!r.active && r.left === 0, `all done: ${JSON.stringify(r)} after ${seen.join(', ')}`);
});

await test('inventory: [C] picks up gear (into the bag), I opens the bag, right click wears it, a potion on the floor goes on the belt, 5 drinks one', async () => {
  // a helmet for this class on the floor at the hero's feet
  await K((k, hs, e) => {
    for (const g of k.grumbles) if (!g.dead && Math.hypot(g.x - e.x, g.z - e.z) < 12) { g.x += 40; g.z += 40; } // (quiet around)
  });
  const item = await page.evaluate(async () => {
    const I = await import('/src/scenes/keepsolo/items.js');
    const k = window.game.current;
    const it = I.rollItem({ ilvl: 1, rarity: 0, slot: 'helmet', cls: k.cls, diff: 0 });
    delete it.req;
    const g = k.spawnGear(it, k.hero.x + 0.3, k.hero.z);
    g.vx = g.vz = 0;
    return { slot: it.slot, name: it.name || it.base || '' };
  });
  await sim(page, 0.6);
  await hold(page, 'KeyQ', 0.1); // a tap of [C]
  await sim(page, 0.2);
  const b = await K((k, hs) => ({ bag: hs.bag.map((x) => x.it.slot), found: hs.stats.found }));
  assert(b.bag.includes('helmet'), `picked up: ${JSON.stringify(b)}`);
  await press(page, 'KeyI');
  await sim(page, 0.3);
  assert(await K((k) => k.panelKind === 'bag'), 'the bag');
  await shot(page, 'keepsolo-bag');
  // right click the helmet in the bag: worn
  const cell = await page.evaluate(() => {
    const k = window.game.current, e = k.hs.bag.find((x) => x.it.slot === 'helmet');
    const g = document.querySelector('[data-grid="bag"]').getBoundingClientRect(), cs = g.width / 10;
    return { x: g.left + (e.x + 0.5) * cs, y: g.top + (e.y + 0.5) * cs };
  });
  await page.mouse.move(cell.x, cell.y);
  await sim(page, 0.1);
  await page.mouse.click(cell.x, cell.y, { button: 'right' });
  await sim(page, 0.2);
  const w = await K((k, hs) => ({ head: hs.gear.helmet?.slot, bag: hs.bag.length }));
  assert(w.head === 'helmet' && w.bag === b.bag.length - 1, `worn: ${JSON.stringify(w)}`);
  // drag the weapon? it must stay worn: a click picks it up, a click on the bag puts it down, it comes back on close
  const slot = await page.evaluate(() => { const r = document.querySelector('[data-slot="helmet"]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await page.mouse.click(slot.x, slot.y);
  await sim(page, 0.2);
  assert(await K((k) => !!k.panel.held && !k.hs.gear.helmet), 'the helmet on the pointer');
  const to = await page.evaluate(() => { const g = document.querySelector('[data-grid="bag"]').getBoundingClientRect(), cs = g.width / 10; return { x: g.left + 5 * cs, y: g.top + 2 * cs }; });
  await page.mouse.click(to.x, to.y);
  await sim(page, 0.2);
  const d = await K((k, hs) => ({ held: !!k.panel.held, bag: hs.bag.map((x) => `${x.it.slot}@${x.x},${x.y}`) }));
  assert(!d.held && d.bag.length === b.bag.length && d.bag.some((x) => x.startsWith('helmet@')), `put down in the bag: ${JSON.stringify(d)}`);
  await press(page, 'KeyI');
  await sim(page, 0.2);
  assert(await K((k) => !k.panel), 'I closes the bag');
  await page.mouse.move(5, 5);
  // a red potion on the floor: onto the belt (walk over it)
  const belt0 = await K((k, hs) => hs.belt.filter((x) => x?.use === 'hp').length);
  await K((k, hs, e) => { if (hs.belt.filter(Boolean).length >= k.beltCap()) hs.belt[3] = null; k.spawnItem('potion', e.x, e.z, false, { use: 'hp' }); });
  await sim(page, 1);
  const belt1 = await K((k, hs) => hs.belt.filter((x) => x?.use === 'hp').length);
  assert(belt1 === belt0 + 1, `picked up onto the belt: ${belt0} -> ${belt1}`);
  // hurt: 5 drinks the bottom red potion
  await K((k, hs, e) => { e.hp = e.st.maxHp * 0.3; });
  const hp0 = await K((k, hs, e) => e.hp);
  const col = await K((k, hs) => hs.belt.findIndex((x) => x?.use === 'hp'));
  await press(page, `Digit${5 + col}`);
  const r = await K((k, hs, e) => ({ hp: e.hp, n: hs.belt.filter((x) => x?.use === 'hp').length }));
  assert(r.hp > hp0 && r.n === belt1 - 1, JSON.stringify({ hp0, r }));
});

await test('rooms and doors: a locked door does not open without the key; with the key, leaning on it opens it', async () => {
  const r = await K((k, hs, e) => {
    k.closePanel(); if (k.menu) { k.menu.close(); k.menu = null; }
    const door = k.doors.find((d) => !d.open);
    if (!door) return { none: true };
    e.hasKey = false;
    return { n: k.doors.length, x: door.x, z: door.z };
  });
  if (r.none) {
    // (some floors have no locked door: the next floor)
    await K((k) => { k.disposeWorld(k.snapshotWorld()); k.enterFloorNow(1); });
    await sim(page, 0.5);
  }
  const d = await K((k, hs, e) => {
    const door = k.doors.find((d) => !d.open);
    const [c, rr] = door.tiles[0];
    const CELL = (door.x - (c - k.W / 2) * 0) ? null : null; void CELL;
    // stand right against the door (the nearest walkable spot next to it)
    let best = null;
    for (let a = 0; a < 32; a++) for (const rad of [1.0, 1.3, 1.6, 2.0]) {
      const x = door.x + Math.cos((a / 32) * Math.PI * 2) * rad, z = door.z + Math.sin((a / 32) * Math.PI * 2) * rad;
      if (k.walkableAt(x, z) && k.doorNear({ x, z }, 0.62) === door && (!best || rad < best.rad)) best = { x, z, rad };
    }
    if (!best) return { err: 'no spot by the door', rr };
    e.x = best.x; e.z = best.z;
    e.hasKey = false;
    return { ok: true, x: door.x, z: door.z };
  });
  assert(d.ok, JSON.stringify(d));
  await sim(page, 1.2);
  assert(await K((k) => k.doors.some((d) => !d.open && k.doorNear(k.hero, 0.62) === d)), 'still locked without a key');
  await K((k, hs, e) => { e.hasKey = true; });
  await sim(page, 1.2);
  const o = await K((k, hs, e) => ({ open: k.doors.filter((d) => d.open).length, key: e.hasKey }));
  assert(o.open >= 1 && !o.key, `opened with the key: ${JSON.stringify(o)}`);
  await shot(page, 'keepsolo-door');
});

await test('fainting: at zero health the hero wakes in town, the bag drops where they fainted; back on the floor, walking over it gives it back', async () => {
  // something in the bag to drop
  await page.evaluate(async () => {
    const I = await import('/src/scenes/keepsolo/items.js');
    const k = window.game.current;
    const it = I.rollItem({ ilvl: 1, rarity: 0, slot: 'boots', cls: k.cls, diff: 0 });
    k.bagGrid().add(it);
  });
  const before = await K((k, hs, e) => ({ bag: hs.bag.length, g: k.g, x: e.x, z: e.z, deaths: hs.stats.deaths }));
  assert(before.bag >= 2, JSON.stringify(before));
  await K((k, hs, e) => { e.inv = 0; e.state = 'walk'; k.addYawn(e, 1e6); });
  await sim(page, 3);
  await waitMoved();
  await sim(page, 0.6);
  const t1 = await K((k, hs, e) => ({ kind: k.kind, hp: e.hp, max: e.st.maxHp, bag: hs.bag.length, drop: hs.drop && { g: hs.drop.g, n: hs.drop.items.length }, deaths: hs.stats.deaths, live: !!k.live }));
  assert(t1.kind === 'town' && t1.hp === t1.max && t1.bag === 0 && t1.drop?.n === before.bag && t1.deaths === before.deaths + 1, JSON.stringify(t1));
  await shot(page, 'keepsolo-fainted');
  // back down through the gate (the floor waits: its entrance), walk to the bag
  await K((k) => k.backToLive());
  await sim(page, 1);
  await waitMoved();
  const bag = await K((k) => { const b = k.items.find((it) => it.kind === 'bag' && !it.taken); return b ? { x: b.x, z: b.z } : null; });
  assert(bag, 'the bag waits on the floor');
  await K((k, hs, e, G, b) => { e.x = b.x + 0.2; e.z = b.z; }, bag);
  await sim(page, 1);
  const t2 = await K((k, hs) => ({ bag: hs.bag.length, drop: hs.drop }));
  assert(t2.bag === before.bag && !t2.drop, JSON.stringify(t2));
});

await test('Bolster\'s forge: an item goes up a plus for coins and fluff (and not without them)', async () => {
  await K((k) => k.goTown('portal'));
  await sim(page, 1);
  await waitMoved();
  await K((k, hs) => { hs.coins = 0; hs.fluff = 0; k.openPanel('smith'); k.panel.sel = hs.gear.weapon; k.panel.act('up'); });
  const p0 = await K((k, hs) => hs.gear.weapon.plus || 0);
  assert(p0 === 0, 'too poor: no upgrade');
  await K((k, hs) => { hs.coins = 5000; hs.fluff = 500; k.panel.act('up'); });
  const p1 = await K((k, hs) => ({ plus: hs.gear.weapon.plus, coins: hs.coins, fluff: hs.fluff }));
  assert(p1.plus === 1 && p1.coins < 5000 && p1.fluff < 500, JSON.stringify(p1));
  await shot(page, 'keepsolo-forge');
  await K((k) => k.closePanel());
});

await test('save and resume: reload the page, back through the keep door, the same hero (level, coins, gear, bag)', async () => {
  const s0 = await K((k, hs) => { k.saveNow(); return JSON.stringify({ cls: k.cls, level: hs.level, xp: hs.xp, coins: hs.coins, fluff: hs.fluff, plus: hs.gear.weapon.plus, head: hs.gear.helmet?.slot, bag: hs.bag.length, reached: hs.reached, deaths: hs.stats.deaths }); });
  const id = await page.evaluate(() => window.__testProfile.id);
  await page.reload();
  await page.waitForFunction(() => !!window.game && !!window.game.current, null, { timeout: 30000 });
  await page.evaluate(([id, ms]) => { window.__islandTimeOffset = ms - Date.now(); window.game.audio.ensure(); import('/src/core/profiles.js').then((P) => window.game.enterSolo(P.getProfile(id), 'kb0')); }, [id, D0]);
  await page.waitForFunction(() => window.game.current?.constructor?.name === 'SoloIslandScene' && !window.game.switching && window.game.current.player, null, { timeout: 30000 });
  await page.evaluate(() => window.game.startGame('keepsolo'));
  await inKeep();
  await sim(page, 0.5);
  await press(page, 'Space'); // the picker starts on the hero played last
  await sim(page, 0.5);
  const s1 = await K((k, hs) => JSON.stringify({ cls: k.cls, level: hs.level, xp: hs.xp, coins: hs.coins, fluff: hs.fluff, plus: hs.gear.weapon.plus, head: hs.gear.helmet?.slot, bag: hs.bag.length, reached: hs.reached, deaths: hs.stats.deaths }));
  assert(s1 === s0, `before ${s0}\nafter  ${s1}`);
});

await test('the pause menu\'s End goes back to the island, at the keep door; the island shows the keep\'s progress', async () => {
  await press(page, 'Escape');
  assert(await page.evaluate(() => !!window.game.pause), 'paused');
  const items = await page.evaluate(() => window.game.pauseItems());
  await page.evaluate((i) => { window.game.pause.index = i; window.game.renderPause(); }, items.indexOf('end'));
  await press(page, 'KeyE');
  await page.waitForFunction(() => window.game.current?.constructor?.name === 'SoloIslandScene' && !window.game.switching && window.game.current.player, null, { timeout: 30000 });
  await sim(page, 1);
  const r = await island(page, async (I) => {
    const M = await import('/src/scenes/solo/map.js');
    const d = M.PLACES.find((p) => p.id === 'keep').door;
    return { d: Math.hypot(I.player.x - d.x, I.player.z - d.z), info: I.placeInfo(M.PLACES.find((p) => p.id === 'keep')), sum: window.game.roster.progress.keepSolo?.summary || null };
  });
  assert(r.d < 2.5, `at the keep door: ${JSON.stringify(r)}`);
  assert(r.sum && r.info && !/^isl\./.test(r.info), JSON.stringify(r));
});

await test('no console errors', async () => { assert(!page.errors.length, page.errors.join('\n')); });
await close(page);
done();
