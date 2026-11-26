// The graphics trial's switches (core/gfx.js, solo/gfxlook.js; tests/graphics/LOG.md): each look on and off on the
// solo island with no console errors, simple graphics turns every one off, Reduce flashing stops the glow's breath and
// the fireflies' twinkle, name tags and the HUD stay as they are, Strong outlines keep the tilt-shift off, the Help me
// play Graphics page, the automatic step-down, and the other scenes (the shared island, a game, a puzzle lock with
// clipping, the Game Hall's games) still draw with every look on.
import fs from 'fs';
import path from 'path';
import { open, close, startIsland, island, sim, at, SHOTS, test, assert, done } from '../lively/helper.mjs';

const EFFECTS = ['glow', 'life', 'light', 'mini'];
const page = await open({ query: '?gfx=none' });

/** Draw n frames by hand (the look's update, then the scene's own render). */
async function frames(page, n = 3, dt = 1 / 30) {
  await page.evaluate(([n, dt]) => {
    const G = window.game, C = G.current;
    for (let i = 0; i < n; i++) {
      C.look?.update(dt);
      if (C.render) C.render(G.renderer); else G.renderer.render(C.scene, C.camera);
    }
  }, [n, dt]);
}

/**
 * A screenshot of a still moment: the game loop paused, one frame drawn (software rendering takes about a second
 * for a frame with the looks on, and a running loop queues up more than a screenshot waits for), then the loop again.
 */
async function shot(page, name) {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.evaluate(() => { const G = window.game; G.loop = () => {}; });
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r())));
  await frames(page, 1, 0);
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`), timeout: 120000 }); // (a panel over the island: slow in software)
  await page.evaluate(() => { const G = window.game; delete G.loop; G.last = performance.now(); G.loop(); });
}

/** What the island's looks are doing now. */
const state = () => island(page, (I, S, G) => {
  const rim = []; I.player.ch.group.traverse((o) => { if (o.isMesh && o.material?.userData?.rimOf) rim.push(o.name); });
  const sway = (I.look.sways || []).filter((m) => m.material.userData?.swayOf).length;
  return {
    on: G.gfx.on, simple: G.gfx.simple, frames: G.gfx.stats.frames, radius: I.lights.sun.shadow.radius, rim: rim.length, sway,
    blobs: !!I.look.blobs?.visible, tilt: I.look.tilt, pulse: I.look.pulse, twinkle: !!I.life.twinkle, composer: !!G.gfx.composer,
  };
});

await test('every look switches on and off on the island with no console errors', async () => {
  await startIsland(page, { time: at(2026, 11, 24, 20, 30) }); // an autumn evening: lamps lit, fireflies out
  await island(page, (I) => { if (I.mode !== 'walk') { I.hud.setPanel?.(null); I.mode = 'walk'; } });
  await frames(page);
  let s = await state();
  assert(!s.composer && s.frames === 0 && s.radius === 1 && !s.rim && !s.sway && !s.blobs, 'all off: as before ' + JSON.stringify(s));
  for (const e of EFFECTS) {
    await page.evaluate((e) => window.game.gfx.trial([e]), e);
    await sim(page, 0.3);
    await frames(page, 4);
    s = await state();
    assert(s.on[e] && EFFECTS.filter((k) => s.on[k]).length === 1, `${e} alone: ${JSON.stringify(s.on)}`);
    if (e === 'glow' || e === 'mini') assert(s.composer && s.frames > 0, `${e} draws through the composer`);
    if (e === 'light') assert(s.radius > 1 && s.rim > 0 && s.blobs, 'light: soft shadows, rim, contact shading ' + JSON.stringify(s));
    if (e === 'life') assert(s.sway > 0 && s.twinkle, 'life: sway and twinkle ' + JSON.stringify(s));
    if (e === 'mini') assert(s.tilt > 0.9, 'mini: tilt-shift out walking ' + s.tilt);
    await shot(page, `graphics-${e}`);
    await page.evaluate(() => window.game.gfx.trial([]));
    await frames(page, 2);
    const before = (await state()).frames;
    await frames(page, 2);
    s = await state();
    assert(s.frames === before && s.radius === 1 && !s.rim && !s.sway && !s.blobs && !s.twinkle, `${e} off again: ${JSON.stringify(s)}`);
  }
  await page.evaluate(() => window.game.gfx.trial(['glow', 'life', 'light', 'mini']));
  await sim(page, 0.5);
  await frames(page, 4);
  await shot(page, 'graphics-all');
  assert(!page.errors.length, page.errors.join('\n'));
});

await test('simple graphics turns every look off (and back), saved for the device', async () => {
  await page.evaluate(() => { localStorage.removeItem('couch.gfx'); window.game.gfx.set({ glow: true, life: true, light: true, mini: true }); });
  await frames(page, 3);
  let s = await state();
  assert(EFFECTS.every((k) => s.on[k]) && !s.simple && s.rim > 0, 'all on ' + JSON.stringify(s));
  await page.evaluate(() => window.game.gfx.set({ simple: true }));
  await frames(page, 2);
  const f0 = (await state()).frames;
  await frames(page, 3);
  s = await state();
  assert(s.simple && EFFECTS.every((k) => !s.on[k]), 'simple: all off ' + JSON.stringify(s.on));
  assert(s.frames === f0 && s.radius === 1 && !s.rim && !s.sway && !s.blobs && !s.twinkle && s.tilt === 0, 'simple: drawn as before ' + JSON.stringify(s));
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('couch.gfx')));
  assert(saved.simple === true && saved.glow === true, 'saved: simple, the looks remembered ' + JSON.stringify(saved));
  await page.evaluate(() => window.game.gfx.set({ simple: false }));
  s = await state();
  assert(EFFECTS.every((k) => s.on[k]), 'simple off: the looks are back ' + JSON.stringify(s.on));
  assert(!page.errors.length, page.errors.join('\n'));
});

await test('Reduce flashing stops the glow\'s breath and the fireflies\' twinkle', async () => {
  await page.evaluate(() => window.game.gfx.trial(['glow', 'life']));
  await sim(page, 1.3); // (the breath is a slow sine: not 0 a second in)
  await frames(page, 2, 0.4);
  let s = await state();
  assert(Math.abs(s.pulse) > 0.005 && s.twinkle, 'without: a slow breath and twinkle ' + JSON.stringify(s));
  await island(page, (I, S, G) => { const id = G.solo.profile.id; G.assist.saveSettings(id, { ...G.assist.profileSettings(id), calm: true }); G.applyScreenSettings(); });
  for (let i = 0; i < 4; i++) {
    await sim(page, 0.37);
    await frames(page, 1, 0.21);
    s = await state();
    assert(s.pulse === 0 && !s.twinkle, 'calm: steady ' + JSON.stringify(s));
  }
  // the fireflies are all the same brightness again
  const flies = await island(page, (I) => { const a = I.life.flyGeo.attributes.color.array; return [Math.min(...a), Math.max(...a)]; });
  assert(flies[0] === 1 && flies[1] === 1, 'flies steady ' + flies);
  await island(page, (I, S, G) => { const id = G.solo.profile.id; G.assist.saveSettings(id, { ...G.assist.profileSettings(id), calm: false }); G.applyScreenSettings(); });
  assert(!page.errors.length, page.errors.join('\n'));
});

await test('name tags and the HUD are untouched; no tilt-shift in dialogs, menus or with Strong outlines', async () => {
  await page.evaluate(() => window.game.gfx.trial(['glow', 'life', 'light', 'mini']));
  const tag = await island(page, (I) => {
    const n = I.npcs.find((q) => !q.inside && q.model.group.visible) || I.npcs[0];
    Object.assign(n, { busy: true, route: [], inside: false, wantIn: false, away: false });
    n.x = I.player.x + 1.5; n.z = I.player.z;
    return n.id;
  });
  await sim(page, 0.5);
  await frames(page, 2);
  const r = await island(page, (I, S, G, id) => {
    const n = I.npcs.find((q) => q.id === id);
    const cs = getComputedStyle(n.tag);
    const hud = document.querySelector('.ui-labels');
    return { shown: n.tag.style.display !== 'none', text: n.tag.textContent, filter: cs.filter, opacity: cs.opacity, color: cs.color, inUi: hud.contains(n.tag), canvasFilter: getComputedStyle(G.renderer.domElement).filter };
  }, tag);
  assert(r.shown && r.text && r.inUi && r.filter === 'none' && r.opacity === '1' && r.canvasFilter === 'none', 'the tag is page text, sharp ' + JSON.stringify(r));
  // a dialog: the tilt-shift fades out
  await island(page, (I) => I.say([{ who: 'hazel', text: 'Hello!' }], () => {}));
  for (let i = 0; i < 6; i++) await frames(page, 1, 0.1);
  let s = await state();
  assert(s.tilt < 0.05, 'no tilt in a dialog ' + s.tilt);
  await island(page, (I) => { I.hud.setDialog?.(null); I.dlg = null; I.mode = 'walk'; });
  for (let i = 0; i < 8; i++) await frames(page, 1, 0.1);
  s = await state();
  assert(s.tilt > 0.9, 'back out walking: tilt ' + s.tilt);
  // Strong outlines: the hulls are there and the tilt-shift is off
  await island(page, (I, S, G) => { const id = G.solo.profile.id; G.assist.saveSettings(id, { ...G.assist.profileSettings(id), contrast: true }); G.applyScreenSettings(); });
  for (let i = 0; i < 8; i++) await frames(page, 1, 0.1);
  s = await state();
  const hulls = await island(page, (I) => (I.player.ch.group.userData.hulls || []).length);
  assert(s.tilt < 0.05 && hulls > 0, 'outlines on: hulls, no tilt ' + JSON.stringify({ tilt: s.tilt, hulls }));
  await island(page, (I, S, G) => { const id = G.solo.profile.id; G.assist.saveSettings(id, { ...G.assist.profileSettings(id), contrast: false }); G.applyScreenSettings(); });
  assert(!page.errors.length, page.errors.join('\n'));
});

await test('the Help me play Graphics page switches the looks (English and Norwegian)', async () => {
  await page.evaluate(() => { localStorage.removeItem('couch.gfx'); window.game.gfx.url = null; window.game.gfx.version++; });
  await page.evaluate(() => window.game.openAssist());
  await sim(page, 0.3);
  const r = await page.evaluate(() => {
    const M = window.game.assistMenu;
    const row = M.el.querySelector('.assist-row.gfx')?.textContent;
    M.openGfx();
    const html = M.el.textContent;
    M.gIndex = 1; M.changeGfx('glow');
    const glow = window.game.gfx.on.glow;
    M.render();
    const after = M.el.querySelector('.gfx-glow').textContent;
    M.changeGfx('simple');
    const simple = window.game.gfx.simple;
    M.changeGfx('simple');
    return { row, html, glow, after, simple, back: window.game.gfx.on, saved: localStorage.getItem('couch.gfx') };
  });
  assert(r.row?.includes('Graphics'), 'a Graphics row ' + r.row);
  for (const w of ['Simple graphics', 'Glow and colour', 'Living world', 'Softer light', 'Miniature look']) assert(r.html.includes(w), w + ' in ' + r.html);
  assert(r.glow && /on/.test(r.after) && r.simple && r.back.glow, JSON.stringify(r));
  assert(!/gfx\.|assist\.gfx/.test(r.html), 'no raw keys');
  await page.evaluate(() => { window.game.toggleLanguage(); window.game.assistMenu.render(); });
  const no = await page.evaluate(() => window.game.assistMenu.el.textContent);
  assert(no.includes('Enkel grafikk') && no.includes('Miniatyrpreg') && !/gfx\./.test(no), 'Norwegian ' + no);
  await shot(page, 'graphics-settings-no');
  await page.evaluate(() => { window.game.toggleLanguage(); window.game.assistMenu.close(); });
  await sim(page, 0.3);
  assert(!page.errors.length, page.errors.join('\n'));
});

await test('a slow start steps down to simple graphics once (only from the defaults), with a toast', async () => {
  const r = await page.evaluate(() => {
    const g = window.game.gfx;
    localStorage.removeItem('couch.gfx');
    g.url = null; g.watch = null;
    g.defaults = { glow: true, life: true, light: true, mini: true };
    const fast = g.judge(Array(90).fill(17));
    const onFast = g.on.glow;
    g.watch = null;
    const slow = g.judge(Array(90).fill(70));
    const out = { fast, onFast, slow, simple: g.simple, saved: JSON.parse(localStorage.getItem('couch.gfx')) };
    // a device that chose is never measured; nor is one opened with ?gfx=
    g.watch = null; g.set({ glow: true }); g.measure(g.on);
    out.chosen = g.watch;
    g.watch = null; g.trial(['glow']); g.measure(g.on);
    out.url = g.watch;
    g.defaults = { glow: false, life: false, light: false, mini: false };
    return out;
  });
  // the toast (the island queues its pop-ups: toasts.js)
  let toast = false;
  for (let i = 0; i < 12 && !toast; i++) { await sim(page, 0.5); toast = await page.evaluate(() => document.body.textContent.includes('this device seemed slow')); }
  assert(!r.fast && r.onFast && r.slow && r.simple && r.saved.simple && r.saved.auto && toast, JSON.stringify({ ...r, toast }));
  assert(r.chosen === null && r.url === null, 'no measuring after a choice or with ?gfx= ' + JSON.stringify(r));
  assert(!page.errors.length, page.errors.join('\n'));
});

await test('with every look on, a puzzle lock (clipped board), a Game Hall game, a game and the shared island still draw', async () => {
  await page.evaluate(() => window.game.gfx.trial(['glow', 'life', 'light', 'mini']));
  // a puzzle lock drawn over the island (its own scene, after the island's picture)
  await island(page, (I, S) => { S.hops.chests.hollow = { n: 1, week: 0 }; S.puzzles.cur = 'hollow'; S.puzzles.at.hollow = Date.now(); I.puzzles.refresh(); I.mode = 'walk'; I.puzzles.start('hollow'); });
  await sim(page, 0.5);
  await frames(page, 3);
  const pz = await island(page, (I) => ({ mode: I.mode, runner: !!I.puzzles.runner, tilt: I.look.tilt }));
  assert(pz.runner && pz.mode === 'puzzle' && pz.tilt < 0.6, 'a puzzle lock ' + JSON.stringify(pz));
  await shot(page, 'graphics-puzzle');
  await island(page, (I) => I.puzzles.finish('hollow', {}));
  // Rock Patrol (localClipping) and the other scenes: drawn straight, as before
  for (const key of ['rocks', 'bubble']) {
    await page.evaluate((k) => window.game.startGame(k), key);
    await page.waitForFunction(() => !window.game.switching, null, { timeout: 30000 });
    await sim(page, 1);
    const f0 = await page.evaluate(() => window.game.gfx.stats.frames);
    await frames(page, 3);
    const r = await page.evaluate(() => ({ f: window.game.gfx.stats.frames, clip: window.game.renderer.localClippingEnabled, name: window.game.current.constructor.name }));
    assert(r.f === f0 && r.clip, `${key}: drawn as before ` + JSON.stringify(r));
    await shot(page, `graphics-${key}`);
    await page.evaluate(() => window.game.goHub());
    await page.waitForFunction(() => window.game.current?.constructor?.name === 'SoloIslandScene' && !window.game.switching, null, { timeout: 30000 });
  }
  await page.evaluate(() => window.game.goTogether());
  await page.waitForFunction(() => window.game.current?.constructor?.name === 'HubScene' && !window.game.switching, null, { timeout: 30000 });
  await sim(page, 1);
  await frames(page, 3);
  await shot(page, 'graphics-hub');
  // back home: the island draws with the looks again
  await page.evaluate(() => window.game.goHome());
  await page.waitForFunction(() => window.game.current?.constructor?.name === 'SoloIslandScene' && !window.game.switching, null, { timeout: 30000 });
  await sim(page, 1);
  const f0 = await page.evaluate(() => window.game.gfx.stats.frames);
  await frames(page, 3);
  const f1 = await page.evaluate(() => window.game.gfx.stats.frames);
  assert(f1 > f0, 'the island again through the composer');
  assert(!page.errors.length, page.errors.join('\n'));
});

await close(page);
done();
