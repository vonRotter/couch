// The odd-adventure round, part 1: the magic ball. Tinka's letter brings it; the first time you hold it the tutorial
// teaches throw, bounce and catch; it bounces off walls (2 bounces, Tinka's springs add more), always comes back and is
// never lost; the aim line shows more with "Help me play" aim help; the switch door only wakes for a bounced ball; the
// three bells (and all three with one throw: Coach's trial); apples from the fruit trees once a day; and the two
// existing puzzles it fits: a villager's lost thing up high and Skye's goggles.
import { open, close, startIsland, island, sim, at, test, assert, done, press, shot, standAt, answerCard, oddSave } from './lba2.mjs';

const page = await open();
const D0 = at(2026, 11, 18, 12);

/** Throw from (x, z) at angle a (degrees) and fly until the ball is back in your hand: what happened. */
async function throwAt(x, z, a) {
  await standAt(page, x, z, [Math.cos((a * Math.PI) / 180), Math.sin((a * Math.PI) / 180)]);
  await island(page, (I) => { I.odd.ball.throw(); });
  let max = 0, bounces = 0, far = 0;
  for (let i = 0; i < 80; i++) {
    await sim(page, 0.1);
    const f = await island(page, (I) => { const F = I.odd.ball.fly; return F ? { b: F.b, d: Math.hypot(F.x - I.player.x, F.z - I.player.z) } : null; });
    if (!f) return { back: true, bounces, far, t: i / 10 };
    bounces = Math.max(bounces, f.b); far = Math.max(far, f.d); max = i;
  }
  return { back: false, bounces, far, t: max / 10 };
}

/** A direction from (x, z) that hits target `id` (with `bounced`: after a bounce), searching every 2 degrees. */
async function findAim(x, z, id, bounced = false) {
  return island(page, (I, S, G, [x, z, id, bounced]) => {
    const M = I.odd.ball, feet = I.map.floorAt(x, z, false);
    for (let a = 0; a < 360; a += 2) {
      const r = (a * Math.PI) / 180, tr = M.trace(x, z, { x: Math.cos(r), z: Math.sin(r) }, feet);
      if (tr.hits.includes(id) && (!bounced || tr.bounces > 0)) return a;
    }
    return null;
  }, [x, z, id, bounced]);
}

await test('Tinka\'s letter brings the magic ball; holding it the first time teaches throw, bounce and catch', async () => {
  await startIsland(page, { time: D0, save: oddSave({}) });
  await island(page, (I, S) => { S.odd.got = {}; S.odd.last = -1e9; S.odd.first = 0; S.mail = []; S.odd.got.sporty = 0; S.odd.modes.sporty = true; });
  // the next arrival on a quiet day is the ball (after Sporty): its letter brings it
  const got = await page.evaluate(async () => {
    const O = await import('/src/scenes/solo/odd.js');
    const I = window.game.current, S = I.save;
    for (let d = 0; d < 20; d++) { const ms = Date.now() + window.__islandTimeOffset + d * 86400000; const id = O.arrivalDue(S, ms); if (id) return id; }
    return null;
  });
  assert(got === 'ball', `next: ${got}`);
  await island(page, (I, S) => { S.mail.push({ id: 'od.ball', from: 'tinka', items: [['magicBall', 1]] }); S.odd.got.ball = 0; });
  await standAt(page, 0, 0);
  await island(page, (I) => I.openLetter());
  await sim(page, 0.6);
  const letter = await island(page, (I) => I.hud.panel.innerText);
  assert(/magic ball/i.test(letter) && /Tinka/.test(letter), letter);
  await press(page, 'KeyE');
  await sim(page, 0.5);
  const slot = await island(page, (I, S) => S.inv.find((x) => x.id === 'magicBall')?.slot);
  assert(slot !== undefined, 'the ball is in the bag');
  await island(page, (I, S, G, slot) => { S.sel = slot; }, slot);
  await sim(page, 0.5);
  assert(await answerCard(page, 'show'), 'the card');
  await sim(page, 1.2);
  let step = await island(page, (I) => I.odd.ball.teach?.step(I.player.p)?.key);
  assert(step === 'mb.tut.throw', step);
  // a wall: the game hall's west side (stand west of it, throw east)
  // one thing at a time: throw, then (another throw) the bounce, then the catch; a child just keeps throwing
  const seen = [];
  let r = null;
  for (let i = 0; i < 4 && (await island(page, (I) => !!I.odd.ball.teach)); i++) {
    seen.push(await island(page, (I) => I.odd.ball.teach?.step(I.player.p)?.key || '-'));
    r = await throwAt(18, -15, 0);
    await sim(page, 1.5);
  }
  step = await island(page, (I) => !!I.odd.ball.teach);
  console.log(`   ball tutorial: ${seen.join(' -> ')}`);
  assert(r.back && r.bounces >= 1 && !step && seen[0] === 'mb.tut.throw', JSON.stringify({ r, step, seen }));
});

await test('a throw bounces and always comes back: two bounces, three after Tinka\'s spring', async () => {
  const two = await throwAt(18, -15, 0);
  assert(two.back && two.bounces <= 3, JSON.stringify(two));
  // the most bounces counted while flying (b counts the last bounce that sends it home)
  const tr = await island(page, (I) => I.odd.ball.trace(18, -15, { x: 1, z: 0 }, I.player.fy).bounces);
  await island(page, (I) => { I.odd.ball.onArrive('bounce'); });
  const tr3 = await island(page, (I) => ({ max: I.odd.ball.maxBounces, b: I.odd.ball.trace(18, -15, { x: 1, z: 0 }, I.player.fy).bounces }));
  assert(tr <= 2 && tr3.max === 3 && tr3.b <= 3, JSON.stringify({ tr, tr3 }));
  // thrown out to sea: it still comes back
  const sea = await throwAt(4, 38, 90);
  assert(sea.back && sea.t < 6, JSON.stringify(sea));
  await island(page, (I, S) => { S.odd.ball.bounces = 2; });
});

await test('the aim line: to the first wall without aim help, further with a little, every bounce with a lot', async () => {
  await standAt(page, 18, -15, [1, 0]);
  const lens = [];
  for (const lv of [0, 1, 2]) {
    await page.evaluate((lv) => { const id = window.__testProfile.id; const A = window.game.assist; A.saveSettings(id, { ...A.profileSettings(id), aim: lv, aimChosen: true }); }, lv);
    await sim(page, 0.3);
    lens.push(await island(page, (I) => I.odd.ball.dots.children.filter((d) => d.visible).length));
  }
  await shot(page, 'lba2-ball-aim');
  console.log(`   aim line dots: off ${lens[0]}, a little ${lens[1]}, a lot ${lens[2]}`);
  assert(lens[0] > 0 && lens[1] >= lens[0] && lens[2] > lens[0], lens.join());
  await page.evaluate(() => { const id = window.__testProfile.id; const A = window.game.assist; A.saveSettings(id, { ...A.profileSettings(id), aim: 0, aimChosen: true }); });
});

await test('the switch door only wakes for a ball that bounced first; the chest inside', async () => {
  const direct = await findAim(36.6, -26.5, 'switch', false);
  // a straight throw at the switch (no bounce) does nothing
  let spot = null;
  for (const [x, z] of [[36.6, -27.2], [30, -27], [28, -29], [32, -26], [40, -26]]) {
    const a = await findAim(x, z, 'switch', true);
    if (a !== null) { spot = { x, z, a }; break; }
  }
  assert(spot, 'some bank shot opens it');
  if (direct !== null) {
    await throwAt(36.6, -26.5, direct);
    const still = await island(page, (I, S) => S.odd.ball.door);
    const tr = await island(page, (I, S, G, a) => I.odd.ball.trace(36.6, -26.5, { x: Math.cos((a * Math.PI) / 180), z: Math.sin((a * Math.PI) / 180) }, I.player.fy).bounces, direct);
    assert(still === (tr > 0), `a straight hit does not open it: ${still} ${tr}`);
  }
  await throwAt(spot.x, spot.z, spot.a);
  await sim(page, 3);
  const open = await island(page, (I, S) => S.odd.ball.door);
  assert(open, `the bank shot opened it: ${JSON.stringify(spot)}`);
  await standAt(page, 34, -29.4, [0, -1]);
  const use = await island(page, (I) => I.interactions().b?.text);
  assert(/old chest/.test(use), use);
  const c0 = await island(page, (I, S) => S.coins);
  await island(page, (I) => I.interactions().b.fn());
  const r = await island(page, (I, S) => ({ coins: S.coins, deco: S.deco.gearClock, chest: S.odd.ball.chest }));
  assert(r.coins === c0 + 60 && r.deco && r.chest, JSON.stringify(r));
  await shot(page, 'lba2-ball-door');
});

await test('the three bells: all three humming; all three with one throw is Coach\'s trial', async () => {
  // one throw that rings all three (a bank shot off the cliff), searched from a few spots
  let best = null;
  for (const [x, z] of [[-18, -29], [-17, -27], [-16, -29], [-18, -25], [-16, -25]]) {
    const a = await island(page, (I, S, G, [x, z]) => {
      const M = I.odd.ball, feet = I.map.floorAt(x, z, false);
      for (let a = 0; a < 360; a += 2) { const r = (a * Math.PI) / 180; const tr = M.trace(x, z, { x: Math.cos(r), z: Math.sin(r) }, feet); if (tr.hits.filter((h) => h.startsWith('bell')).length === 3) return a; }
      return null;
    }, [x, z]);
    if (a !== null) { best = { x, z, a }; break; }
  }
  assert(best, 'some throw rings all three');
  const c0 = await island(page, (I, S) => S.coins);
  await throwAt(best.x, best.z, best.a);
  const r = await island(page, (I, S) => ({ bells: S.odd.ball.bells, coins: S.coins, deco: S.deco.tinyBells, trial: !!window.game.passport.loadPassport(window.__testProfile.id).trials['ball.bells'] }));
  assert(r.bells && r.coins === c0 + 40 && r.deco && r.trial, JSON.stringify({ r, best }));
});

await test('apples: the ball knocks one from a fruit tree, once a day each', async () => {
  const tree = await island(page, (I) => { const o = I.zipzap.trees.find((x) => x.g.visible && !x.isle); return { x: o.x, z: o.z, key: o.key }; });
  const n0 = await island(page, (I, S) => S.inv.filter((x) => x.id === 'apple').reduce((a, x) => a + x.n, 0));
  await throwAt(tree.x - 4, tree.z, 0);
  await throwAt(tree.x - 4, tree.z, 0);
  const n1 = await island(page, (I, S) => S.inv.filter((x) => x.id === 'apple').reduce((a, x) => a + x.n, 0));
  assert(n1 === n0 + 1, `${n0} -> ${n1}`);
});

await test('two existing puzzles: a villager\'s lost thing up high and Skye\'s goggles come down to you', async () => {
  // today's little task: its thing waits up on something
  const r = await island(page, (I, S) => { const D = I.play.day(); D.task = 1; I.play.placeThing(); const a = I.play.thingAt(); return { x: a.x, z: a.z }; });
  // find a throw from somewhere near that hits it
  let shotAt = null;
  for (const [dx, dz] of [[-4, 0], [4, 0], [0, 4], [0, -4], [-3, 3], [3, 3]]) {
    const x = r.x + dx, z = r.z + dz;
    const ok = await island(page, (I, S, G, [x, z]) => I.map.walkable(x, z, 0.42, I.walkState, I.map.floorAt(x, z, false)), [x, z]);
    if (!ok) continue;
    const a = await findAim(x, z, 'task');
    if (a !== null) { shotAt = { x, z, a }; break; }
  }
  assert(shotAt, `a throw reaches the task thing at ${JSON.stringify(r)}`);
  await throwAt(shotAt.x, shotAt.z, shotAt.a);
  const task = await island(page, (I) => ({ task: I.play.day().task, carry: !!I.play.carry }));
  assert(task.task === 2 && task.carry, JSON.stringify(task));
  // Skye's goggles (surprise.js): a target while they are lost
  const g = await island(page, (I) => { const s = I.surprise; s.goggles.visible = true; s.gogglesAt = { x: 30, z: 12 }; return I.odd.ballTargets().some((x) => x.id === 'goggles'); });
  assert(g, 'the goggles are a target');
});

await test('no console errors', async () => { assert(!page.errors.length, page.errors.join('\n')); });
await close(page);
done();
