// The solo island core: a new profile's welcome (Aunt Hazel and Pip, the Zip-Zap and the seeds, the farming
// steps), walking, jumping and bumping into things, no stuck spots anywhere on the island (a grid of points:
// from each one the bean can walk away, or the safety net puts it on a free spot), and the cottage door.
import { open, close, startIsland, island, sim, at, test, assert, done, press, shot } from '../lively/helper.mjs';
import { hold, tp, toWalk } from './isl.mjs';

const page = await open();
const D0 = at(2026, 11, 18, 11); // a Wednesday, late morning

await test('a new profile: the welcome plays (Hazel and Pip), gives the Zip-Zap and seeds, and starts the farming steps', async () => {
  await startIsland(page, { time: D0, name: 'Newbie', intro: false });
  await sim(page, 1.5);
  const d0 = await island(page, (I) => ({ mode: I.mode, who: I.dlg?.lines[I.dlg.i]?.who, n: I.dlg?.lines.length }));
  assert(d0.mode === 'dialog' && d0.who === 'hazel' && d0.n >= 4, JSON.stringify(d0));
  const said = [];
  for (let i = 0; i < 12 && (await island(page, (I) => I.mode)) === 'dialog'; i++) {
    said.push(await island(page, (I) => I.dlg.lines[I.dlg.i].key));
    await sim(page, 0.3);
    await press(page, 'KeyE'); // the question's first answer: "Show me how"
    await sim(page, 0.2);
  }
  const r = await island(page, (I, S) => ({ intro: S.intro, tut: S.tut, inv: S.inv.map((i) => `${i.id}:${i.n}`), sel: I.held?.id, mode: I.mode, q: S.quests.hazel, task: I.tasks()[0] || '' }));
  assert(said.some((k) => k?.startsWith('zz.pip.')), `Pip spoke: ${said.join()}`);
  assert(r.intro && r.mode === 'walk' && r.tut === 1, JSON.stringify(r));
  assert(r.inv.includes('zipzap:1') && r.inv.includes('radishSeed:6') && r.inv.includes('carrotSeed:3'), r.inv.join());
  assert(r.sel === 'zipzap' && r.q && r.task.length > 3, JSON.stringify(r));
  await shot(page, 'island-intro-done');
});

await test('walking: the stick moves the bean, a hop goes up and lands, a wall stops it', async () => {
  await toWalk(page);
  await tp(page, -4, -12);
  const p0 = await island(page, (I) => ({ x: I.player.x, z: I.player.z }));
  await hold(page, 'KeyD', 0.6);
  const p1 = await island(page, (I) => ({ x: I.player.x, z: I.player.z }));
  assert(p1.x - p0.x > 2.5, `moved right: ${JSON.stringify([p0, p1])}`);
  await hold(page, 'KeyW', 0.5);
  const p2 = await island(page, (I) => ({ x: I.player.x, z: I.player.z }));
  assert(p1.z - p2.z > 2, `moved up (away from the camera): ${JSON.stringify([p1, p2])}`);
  // a hop: up in the air, then down again on the ground
  const fy = await island(page, (I) => I.player.fy);
  await press(page, 'Space');
  await sim(page, 0.15);
  const j = await island(page, (I) => ({ air: I.player.air, y: I.player.fy }));
  assert(j.air && j.y > fy + 0.3, `in the air: ${JSON.stringify(j)}`);
  await sim(page, 1);
  const l = await island(page, (I) => ({ air: I.player.air, y: I.player.y, fy: I.player.fy }));
  assert(!l.air && Math.abs(l.y - l.fy) < 0.05, `landed: ${JSON.stringify(l)}`);
  // the cottage: walking into its wall stops at the wall (never inside it)
  const H = await page.evaluate(async () => (await import('/src/scenes/solo/map.js')).HOME);
  await tp(page, H.x, H.z + 6, 0, -1);
  await hold(page, 'KeyW', 2);
  const w = await island(page, (I, S, G, H) => ({ z: I.player.z, over: I.map.overlap(I.player.x, I.player.z, 0.42, I.walkState, I.player.fy), indoors: I.indoors }), H);
  assert(w.over <= 0.001 && w.z > H.z + 1, `stopped by the cottage: ${JSON.stringify(w)}`);
});

await test('the cottage door: [E] goes in, and [E] at the door inside comes out again', async () => {
  await toWalk(page);
  const H = await page.evaluate(async () => (await import('/src/scenes/solo/map.js')).HOME);
  await tp(page, H.x, H.z + 3.3, 0, -1);
  // (villagers walking by win over the door when you face them: send them along)
  await island(page, (I) => { for (const n of I.npcs) if (Math.hypot(n.x - I.player.x, n.z - I.player.z) < 5) { n.x += 12; n.route = []; } });
  const t0 = await island(page, (I) => I.useAction(I.interactions())?.text || '');
  assert(/inside|inn/i.test(t0), `the door says go inside: ${t0}`);
  await press(page, 'KeyE');
  await page.waitForTimeout(1000); // (the circle wipe runs on the real clock)
  await sim(page, 0.5);
  const r = await island(page, (I) => ({ indoors: I.indoors, x: I.player.x, z: I.player.z }));
  assert(r.indoors, `inside: ${JSON.stringify(r)}`);
  await shot(page, 'island-cottage-inside');
  // walk back to the door inside (the exit spot behind the bean)
  await hold(page, 'KeyS', 0.4);
  const t1 = await island(page, (I) => I.useAction(I.interactions())?.text || '');
  assert(/outside|ut/i.test(t1), `the door inside says go out: ${t1}`);
  await press(page, 'KeyE');
  await page.waitForTimeout(1000);
  await sim(page, 0.5);
  const o = await island(page, (I, S, G, H) => ({ indoors: I.indoors, d: Math.hypot(I.player.x - H.x, I.player.z - H.z - 2.7) }), H);
  assert(!o.indoors && o.d < 1.5, `out at the front door: ${JSON.stringify(o)}`);
});

/** In the page: the grid walk. inside = true: start inside things (a prop, a wall) and check the bean gets out. */
const gridWalk = (unlocks, inside) => island(page, async (I, S, G, [unlocks, inside]) => {
  const M = await import('/src/scenes/solo/map.js');
  const keep = { ...S.unlocks, cafe: S.cafe.repaired };
  if (unlocks) { Object.assign(S.unlocks, { bridge: true, mine: true, burrow: true }); S.cafe.repaired = true; }
  const P = I.player, st = I.walkState, map = I.map;
  const dirs = [];
  for (let k = 0; k < 8; k++) dirs.push([Math.cos((k / 8) * Math.PI * 2), Math.sin((k / 8) * Math.PI * 2)]);
  const bad = [];
  let n = 0;
  for (let x = -70; x <= 70; x += 2) {
    for (let z = -70; z <= 70; z += 2) {
      const floor = map.floorAt(x, z, st.bridge);
      if (map.supportAt(x, z, floor, st).water || M.heightAt(x, z) < -0.3) continue;
      const free = map.walkable(x, z, 0.42, st, floor);
      if (free === inside) continue;
      if (inside && map.overlap(x, z, 0.42, st, floor) >= 9) continue; // (inside the terrain: a cliff, not a thing)
      n++;
      let ok = false;
      for (const [dx, dy] of dirs) {
        P.x = x; P.z = z; P.lx = undefined; P.air = false; P.on = null; P.stuckT = 0;
        I.groundCheck(P, st);
        const x0 = P.x, z0 = P.z;
        for (let i = 0; i < 40; i++) I.movePlayer({ x: dx, y: dy }, 1 / 30);
        if (P.air) for (let i = 0; i < 60 && P.air; i++) I.movePlayer({ x: 0, y: 0 }, 1 / 30);
        const out = map.overlap(P.x, P.z, 0.42, st, P.fy) <= 0.01;
        if (inside ? out : Math.hypot(P.x - x0, P.z - z0) > 0.5) { ok = true; break; }
      }
      if (!ok) bad.push([x, z, +floor.toFixed(2), +P.x.toFixed(2), +P.z.toFixed(2)]);
    }
  }
  Object.assign(S.unlocks, { bridge: keep.bridge, mine: keep.mine, burrow: keep.burrow }); S.cafe.repaired = keep.cafe;
  P.x = M.HOME.x + 0.8; P.z = M.HOME.z + 4.2; P.lx = undefined;
  I.groundCheck(P, I.walkState);
  return { n, bad };
}, [unlocks, inside]);

await test('no stuck spots: from every free spot on a 2 m grid the bean walks away (a new island, and with everything unlocked)', async () => {
  await toWalk(page);
  for (const u of [false, true]) {
    const r = await gridWalk(u, false);
    assert(r.n > 500, `points checked: ${r.n}`);
    assert(!r.bad.length, `${u ? 'unlocked' : 'new'}: stuck at ${r.bad.length} of ${r.n}: ${JSON.stringify(r.bad.slice(0, 20))}`);
  }
});

await test('unstick: put inside a prop or a house on that grid, pushing the stick gets the bean out onto a free spot', async () => {
  for (const u of [false, true]) {
    const r = await gridWalk(u, true);
    assert(r.n > 20, `points checked: ${r.n}`);
    assert(!r.bad.length, `${u ? 'unlocked' : 'new'}: still inside at ${r.bad.length} of ${r.n} ([x, z, floor, then x, z]): ${JSON.stringify(r.bad.slice(0, 20))}`);
  }
});

await test('no console errors', async () => { assert(!page.errors.length, page.errors.join('\n')); });
await close(page);
done();
