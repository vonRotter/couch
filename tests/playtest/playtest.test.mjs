// Fixes from the play-test pass over a simulated month (tests/playtest/LOG.md): each test is one thing a child ran
// into on the solo island, checked so it stays fixed.
import { open, close, startIsland, island, sim, at, test, assert, done, press, dismiss, shot } from '../lively/helper.mjs';

const page = await open();
const BEACH_DAY = at(2026, 11, 21, 9, 30); // a Saturday: the season's festival (Beach Day)

await test('a new island on a festival day: no puzzle lock on top of it, nor while the farming steps run; it comes on a quiet day', async () => {
  const r = await page.evaluate(async (t0) => {
    const Z = await import('/src/scenes/solo/puzzles.js');
    const C = await import('/src/scenes/solo/calendar.js');
    const S = { intro: true, tut: 8, hops: { chests: {} }, unlocks: {} };
    const out = { festival: !!C.festivalOn(t0), onFestival: Z.puzzleDue(S, t0) };
    out.inSteps = Z.puzzleDue({ ...S, tut: 3 }, t0 + 3 * 864e5);
    // the next days: it comes on the first quiet one
    for (let d = 1; d < 10 && !out.came; d++) {
      const t = t0 + d * 864e5;
      const id = Z.schedule(S, t);
      if (id) out.came = { id, quiet: C.freeDay(t), d };
    }
    return out;
  }, BEACH_DAY);
  assert(r.festival, 'the date is a festival day');
  assert(r.onFestival === null, `no puzzle on the festival day: ${r.onFestival}`);
  assert(r.inSteps === null, `none while the farming steps run: ${r.inSteps}`);
  assert(r.came && r.came.quiet, `then on a quiet day: ${JSON.stringify(r.came)}`);
});

await test('the first farming step tops the task list while the steps run; every step names its button', async () => {
  await startIsland(page, { time: BEACH_DAY, save: (S) => { S.tut = 2; S.inv.push({ id: 'radishSeed', n: 6, slot: 1 }); } });
  await island(page, (I) => { if (I.mode === 'today') { I.hud.setPanel(null); I.mode = 'walk'; } });
  const r = await island(page, (I) => ({ tasks: I.tasks(), fest: I.seasons.tasks() }));
  assert(r.fest.length > 0, 'the festival has a task today');
  assert(/Plant radish seeds/.test(r.tasks[0]), `the step first: ${r.tasks.join(' | ')}`);
  const steps = await page.evaluate(async () => {
    const { t, setLang } = await import('/src/core/i18n.js');
    return [1, 2, 3, 5].map((n) => t(`isl.tut.${n}`));
  });
  assert(steps.every((s) => /\[B\]|\bE\b|press|trykk|med/.test(s)), steps.join(' | '));
});

await test('toasts: one at a time, wrapped and clear of the task list', async () => {
  await island(page, (I, S, G) => {
    I.toasts.clear();
    G.ui.toast('🧩 Something new on the island: an old door in the cliff behind Aunt Hazel\'s! It is on your map.', 3000);
    G.ui.toast('A second toast (Beach Day)', 2000);
  });
  await sim(page, 0.3);
  const r = await page.evaluate(() => {
    const els = [...document.querySelectorAll('.ui-toast .toast')];
    const tasks = document.querySelector('.isl-tasks').getBoundingClientRect();
    const b = els[0]?.getBoundingClientRect();
    return { n: els.length, right: b?.right, tasksLeft: tasks.left, tasksBottom: tasks.bottom, top: b?.top };
  });
  assert(r.n === 1, `one toast showing: ${r.n}`);
  assert(r.right < r.tasksLeft || r.top > r.tasksBottom, `clear of the task list: ${JSON.stringify(r)}`);
  await shot(page, 'playtest-toast');
  await sim(page, 3.2);
  const second = await page.evaluate(() => [...document.querySelectorAll('.ui-toast .toast')].map((e) => e.textContent));
  assert(second.length === 1 && /Beach Day/.test(second[0]), `then the next: ${second}`);
});

await test('a dialog hides the held thing\'s name (it peeked out between the dialog and the hotbar)', async () => {
  await sim(page, 2.5);
  await island(page, (I) => I.say([{ who: 'hazel', key: 'isl.hazel.tutSkip' }]));
  await sim(page, 0.2);
  const hid = await page.evaluate(() => getComputedStyle(document.querySelector('.isl-selname')).opacity);
  assert(hid === '0', `hidden: ${hid}`);
  await dismiss(page);
  const back = await page.evaluate(() => getComputedStyle(document.querySelector('.isl-selname')).opacity);
  assert(back === '1', `back: ${back}`);
});

await test('a burst of toasts goes by quicker (no long trail after the moment)', async () => {
  await sim(page, 4);
  await island(page, (I, S, G) => { for (const x of ['one', 'two', 'three', 'four']) G.ui.toast(x, 2600); });
  await sim(page, 0.2);
  const left = await island(page, (I) => I.toasts.shown[0].left);
  assert(left < 2000, `the first of four is shorter: ${left}`);
  await sim(page, 8.6);
  const left2 = await island(page, (I) => I.toasts.texts);
  assert(left2.length === 0, `all four gone in under nine seconds (four full ones took 10.4): ${left2}`);
});

await test('the Zip-Zap hint names its hotbar key (not the bag key), and the day\'s news toast is said once a day', async () => {
  await island(page, (I) => { I.mode = 'walk'; });
  await island(page, (I) => I.selectItem('radishSeed'));
  // face untilled soil
  await island(page, (I) => { const P = I.player; P.x = -16.4; P.z = -6.5 - 1.1; P.fx = 0; P.fz = 1; P.ch.face(0, 1); I.groundCheck(P, I.walkState); });
  await sim(page, 0.2);
  const u = await island(page, (I) => I.useAction(I.interactions())?.text || '');
  assert(/\(1\)/.test(u), `names key 1: ${u}`);
  // the festival's news toast came on arrival; coming back to the island the same day does not say it again
  await page.evaluate(() => window.game.enterSolo(window.__testProfile, 'kb0'));
  await page.waitForFunction(() => window.game.current?.constructor?.name === 'SoloIslandScene' && !window.game.switching && window.game.current.player, null, { timeout: 30000 });
  await sim(page, 3.5);
  const tx = await island(page, (I) => I.toasts.texts);
  assert(!tx.some((x) => /Beach Day/.test(x)), `not again: ${tx}`);
});

await test('a quest for a crop that does not grow this season says when it does', async () => {
  const r = await island(page, (I, S) => { S.quests.hazel = { n: 1 }; return I.questText('hazel', 1); });
  assert(/lettuce grows in spring or winter/.test(r), r);
});

await test('in the Game Hall toasts go up under the clock, clear of the cabinet\'s name tag', async () => {
  await island(page, (I) => { I.mode = 'walk'; const P = I.player; P.x = 27 - 4.4 + 4 * 1.1; P.z = -15 - 0.85 + 0.2; P.fx = 0; P.fz = -1; I.groundCheck(P, I.walkState); });
  await sim(page, 1.5);
  await island(page, (I, S, G) => G.ui.toast('Coach Bo: Echo Bells trains your memory. Listen, watch, then ring it back!', 3000));
  await sim(page, 0.4);
  const r = await page.evaluate(() => {
    const tag = [...document.querySelectorAll('.label.isl-tag')].find((e) => e.style.display !== 'none' && /Best|not played|new/i.test(e.textContent) || e.style.display !== 'none' && e.textContent.length > 0 && e.getBoundingClientRect().top < 300);
    const toast = document.querySelector('.ui-toast .toast');
    const a = tag?.getBoundingClientRect(), b = toast?.getBoundingClientRect();
    return { tag: tag?.textContent, a: a && { t: a.top, b: a.bottom, l: a.left, r: a.right }, b: b && { t: b.top, b: b.bottom, l: b.left, r: b.right } };
  });
  assert(r.a && r.b, JSON.stringify(r));
  const overlap = !(r.a.b <= r.b.t || r.b.b <= r.a.t || r.a.r <= r.b.l || r.b.r <= r.a.l);
  assert(!overlap, `the toast and the tag do not overlap: ${JSON.stringify(r)}`);
  await shot(page, 'playtest-hall-toast');
  await sim(page, 3.5);
});

await test('pausing over a game\'s card (or a tutorial step box) hides it until the pause menu closes', async () => {
  const r = await page.evaluate(() => {
    const G = window.game, card = G.ui.panel('<b>Play again</b>', 'panel test-card');
    const tip = document.createElement('div'); tip.className = 'teach-tip teach-box'; tip.textContent = '3/3 Hit the ball'; G.ui.labels.appendChild(tip);
    G.openPause();
    const hidden = card.style.display === 'none', tipHidden = getComputedStyle(tip).display === 'none';
    G.closePause();
    const back = card.style.display !== 'none', tipBack = getComputedStyle(tip).display !== 'none';
    card.remove(); tip.remove();
    return { hidden, back, tipHidden, tipBack };
  });
  assert(r.hidden && r.back && r.tipHidden && r.tipBack, JSON.stringify(r));
});

await test('the speckled egg\'s basket by the shipping bin: walking up to it, the basket answers (not the bin)', async () => {
  const r = await island(page, (I, S) => {
    I.mode = 'walk';
    const sp = I.todayBoard.hookSpot();
    S.hook = { kind: 'egg', due: 0, made: 0, x: sp.x, z: sp.z, ready: true, readyDi: 0 };
    I.todayBoard.updateModel?.();
    const out = [];
    for (const [dx, dz] of [[0, 1.1], [0.8, 0.8], [-0.9, 0.6]]) {
      const P = I.player; P.x = sp.x + dx; P.z = sp.z + dz; const d = Math.hypot(dx, dz); P.fx = -dx / d; P.fz = -dz / d; I.groundCheck(P, I.walkState);
      out.push(I.useAction(I.interactions())?.text || '');
    }
    S.hook = null; I.todayBoard.updateModel?.();
    return out;
  });
  assert(r.every((x) => /egg|egget/i.test(x)), r.join(' | '));
});

await test('a read friend\'s letter no longer glows on the map\'s Today list', async () => {
  const r = await island(page, (I, S) => {
    const day = new Date(Date.now() + (window.__islandTimeOffset || 0));
    const key = `${day.getFullYear()}-${day.getMonth() + 1}-${day.getDate()}`;
    const B = S.todayBoard;
    B.items = [...B.items, { kind: 'changed', icon: '📫', k: 'td.mail.1', v: { name: '@isl.npc.rosa' }, x: -15, z: -11.2 }];
    S.mail = [{ id: 'f.rosa.1', day: key, from: 'rosa', items: [], coins: 0 }];
    const before = I.todayBoard.mapItems().some((m) => /mail|letter/i.test(m.name));
    S.mail = [];
    const after = I.todayBoard.mapItems().some((m) => /mail|letter/i.test(m.name));
    B.items = B.items.filter((it) => it.k !== 'td.mail.1');
    return { before, after };
  });
  assert(r.before && !r.after, JSON.stringify(r));
});

await test('the fog night: walking up to Captain Wisp, the ghost ship is in view beside the bean, clear of the hotbar', async () => {
  await page.evaluate((ms) => { window.__islandTimeOffset = ms - Date.now(); }, at(2026, 12, 1, 20, 30));
  await sim(page, 2);
  await island(page, (I) => { I.hud.setPanel(null); I.hud.setDialog(null); I.dlg = null; I.mode = 'walk'; });
  await sim(page, 1.5);
  const r = await island(page, (I, S, G) => {
    I.hud.setPanel(null); I.mode = 'walk';
    const E = I.events, P = I.player;
    P.x = -17.6; P.z = 40.0; P.fx = 0; P.fz = 1; I.groundCheck(P, I.walkState); I.snapCamera();
    I.camera.updateMatrixWorld();
    const vis = E.ship.visible;
    // the ship's screen box (its world box's corners)
    E.ship.updateMatrixWorld(true);
    const box = { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 };
    const v = E.ship.position.clone();
    const W = innerWidth, Hh = innerHeight;
    E.ship.traverse((m) => {
      if (!m.isMesh) return;
      m.geometry.computeBoundingBox();
      const bb = m.geometry.boundingBox;
      for (const cx of [bb.min.x, bb.max.x]) for (const cy of [bb.min.y, bb.max.y]) for (const cz of [bb.min.z, bb.max.z]) {
        v.set(cx, cy, cz).applyMatrix4(m.matrixWorld);
        if (v.y < -0.3) continue; // (under the water: not seen)
        v.project(I.camera);
        const sx = (v.x + 1) / 2 * W, sy = (1 - v.y) / 2 * Hh;
        box.x0 = Math.min(box.x0, sx); box.x1 = Math.max(box.x1, sx); box.y0 = Math.min(box.y0, sy); box.y1 = Math.max(box.y1, sy);
      }
    });
    const hb = document.querySelector('.isl-hotbar').getBoundingClientRect();
    return { vis, box, hb: { l: hb.left, r: hb.right, t: hb.top }, W, H: Hh };
  });
  assert(r.vis, 'the ship is out tonight');
  const { box, hb } = r;
  const overHotbar = box.x1 > hb.l && box.x0 < hb.r && box.y1 > hb.t;
  assert(!overHotbar, `the ship is clear of the hotbar: ${JSON.stringify(r)}`);
  assert(box.x1 > 0 && box.y0 < r.H * 0.75, `and on screen: ${JSON.stringify(box)}`);
  await shot(page, 'playtest-ghost-ship');
});

await test('with big text the island menu fits the screen (1280x720), and the keys hint clears the hotbar', async () => {
  await page.evaluate(() => {
    const G = window.game, id = G.solo.profile.id;
    G.assist.saveSettings(id, { ...G.assist.profileSettings(id), text: 2 });
    G.applyDeviceSettings(true); G.applyScreenSettings();
  });
  await island(page, (I) => { I.hud.setPanel(null); I.mode = 'walk'; });
  await sim(page, 0.3);
  const k = await page.evaluate(() => { const a = document.querySelector('.isl-keys').getBoundingClientRect(), b = document.querySelector('.isl-hotbar').getBoundingClientRect(); return { keysRight: a.right, hotbarLeft: b.left }; });
  assert(k.keysRight <= k.hotbarLeft + 1, `keys hint clear of the hotbar: ${JSON.stringify(k)}`);
  await press(page, 'KeyQ');
  await sim(page, 0.4);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const r = await page.evaluate(() => { const el = document.querySelector('.panel.isl-menu'); const b = el.getBoundingClientRect(); return { t: b.top, b: b.bottom, h: innerHeight, zoom: el.style.zoom }; });
  assert(r.t >= 0 && r.b <= r.h, `the menu fits: ${JSON.stringify(r)}`);
  await shot(page, 'playtest-bigtext-menu');
  await press(page, 'KeyQ');
  await page.evaluate(() => {
    const G = window.game, id = G.solo.profile.id;
    G.assist.saveSettings(id, { ...G.assist.profileSettings(id), text: 0 });
    G.applyDeviceSettings(true); G.applyScreenSettings();
  });
  await sim(page, 0.3);
});

await test('Norwegian: a title inside a task sentence is small ("Gi tante Hassel ..."), the name tag keeps its capital', async () => {
  const r = await page.evaluate(async () => {
    const i = await import('/src/core/i18n.js');
    const was = i.getLang();
    i.setLang('no');
    const I = window.game.current;
    const q = I.questText('hazel', 1), tag = i.t('isl.npc.hazel');
    i.setLang('en');
    const en = I.questText('hazel', 1);
    i.setLang(was);
    return { q, tag, en };
  });
  assert(/^Gi tante Hassel /.test(r.q) && r.tag === 'Tante Hassel' && /^Bring Aunt Hazel /.test(r.en), JSON.stringify(r));
});

await test('the Today board does not announce what is already over at the first visit (a balloon gone at 17, a big moment over at 18)', async () => {
  const r = await page.evaluate(async () => {
    const C = await import('/src/scenes/solo/calendar.js');
    const I = window.game.current;
    // a balloon day: 4 December 2026
    const mk = (h) => new Date(2026, 11, 4, h).getTime();
    const morning = I.todayBoard.compute(mk(10)).map((x) => x.k), evening = I.todayBoard.compute(mk(19)).map((x) => x.k);
    // a drama's big moment today
    const S = I.save, keep = S.village.drama, di = C.dayIndex(mk(10));
    S.village.drama = { id: 'pumpkin', start: di - 4, climax: di, told: {}, side: null, fish: 0, water: [], flavor: null, res: null };
    const dm = I.village.todayNews(mk(12)).length, de = I.village.todayNews(mk(18)).length;
    S.village.drama = keep;
    return { sur: C.surpriseOn(mk(10)), morning, evening, dm, de };
  });
  assert(r.sur === 'balloon', JSON.stringify(r));
  assert(r.morning.some((k) => /balloon/.test(k)) && !r.evening.some((k) => /balloon/.test(k)), JSON.stringify(r));
  assert(r.dm === 1 && r.de === 0, JSON.stringify(r));
});

await test('the map\'s arrow never sits on the task list', async () => {
  const r = await island(page, (I) => {
    I.hud.setPanel(null); I.mode = 'walk';
    const P = I.player; P.x = -9; P.z = -10; I.groundCheck(P, I.walkState); I.snapCamera();
    const out = [];
    for (const m of I.atlas.markers('main').filter((m) => m.x !== undefined)) {
      I.atlas.setTarget(m);
      I.atlas.updateCompass(0.1);
      const c = I.atlas.compass, t = I.hud.tasks.getBoundingClientRect();
      if (c.style.display === 'none') continue;
      const a = I.atlas.compassAt;
      const hit = a.x + 26 > t.left && a.x - 26 < t.right && a.y + 26 > t.top && a.y - 26 < t.bottom;
      if (hit) out.push(m.key);
    }
    I.atlas.setTarget(null);
    return out;
  });
  assert(!r.length, `on the task list for: ${r.join(', ')}`);
});

await test('the fishing tournament\'s and a hop trail\'s pills sit under the top-left pills (they covered the mode badge)', async () => {
  await island(page, (I, S) => { S.odd = S.odd || {}; S.odd.modes = { sporty: true }; S.odd.mode = 'normal'; I.hud.setPanel(null); I.mode = 'walk'; });
  await sim(page, 0.3);
  await island(page, (I) => I.tour.start());
  await sim(page, 0.5);
  const r = await page.evaluate(() => {
    const top = [...document.querySelectorAll('.isl-top > *')].map((e) => e.getBoundingClientRect());
    const tour = document.querySelector('.isl-tour').getBoundingClientRect();
    const hit = top.some((a) => !(a.right <= tour.left || tour.right <= a.left || a.bottom <= tour.top || tour.bottom <= a.top));
    return { hit, n: top.length, tour: [tour.left, tour.top, tour.right, tour.bottom] };
  });
  assert(r.n >= 3 && !r.hit, JSON.stringify(r));
  await island(page, (I) => { I.tour.run = null; I.npc('grumbleton').busy = false; I.toasts.clear(); });
});

await test('the magic ball in the bag (a full hotbar): a task says how to hold it, until the first throw', async () => {
  const r = await island(page, (I, S) => {
    S.odd.got = { ...(S.odd.got || {}), ball: 0 };
    for (let i = 0; i < 9; i++) if (!S.inv.some((x) => x.slot === i)) S.inv.push({ id: 'wood', n: 1, slot: i });
    S.inv.push({ id: 'magicBall', n: 1, slot: 15 });
    const a = I.allTasks().find((x) => x.includes('🔮'));
    S.odd.ball.throws = 1;
    const b = I.allTasks().find((x) => x.includes('🔮'));
    return { a, b };
  });
  assert(/bag: Tab/.test(r.a || '') && !r.b, JSON.stringify(r));
});

await test('no console errors', async () => { assert(!page.errors.length, page.errors.join('\n')); });
await close(page);
done();
