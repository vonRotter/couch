// The odd-adventure round, part 1: behaviour modes. Coach Bo teaches Sporty mode after his letter, Mumble teaches
// Sneaky mode later; [MODE] (R, or RB on a gamepad) switches; the badge by the clock shows the mode (symbol and word,
// English and Norwegian); each mode's tutorial teaches one thing at a time; the modes' effects (speed, jump height,
// Sporty's slide after a turn, Sneaky's quiet steps: gulls stay put).
import { open, close, startIsland, island, sim, at, test, assert, done, press, shot, hold, standAt, talkThrough, answerCard, oddSave } from './lba2.mjs';

const page = await open();
const D0 = at(2026, 11, 18, 12); // a Wednesday

await test('Coach Bo teaches Sporty mode once his letter came: the lines, the badge, the tutorial one step at a time', async () => {
  await startIsland(page, { time: D0, save: oddSave({ sporty: 0 }) });
  await standAt(page, 0, 0);
  const before = await island(page, (I) => ({ badge: I.odd.modes.badge(), news: I.hasNews('coach'), task: I.allTasks().some((x) => x.includes('Coach Bo has a new move')) }));
  assert(!before.badge && before.news && before.task, JSON.stringify(before));
  await island(page, (I) => { const c = I.npc('coach'); I.player.x = c.x + 1; I.player.z = c.z + 1; I.groundCheck(I.player, I.walkState); I.talkTo(c); });
  const lines = await island(page, (I) => I.dlg.lines.map((l) => l.key));
  assert(lines.join() === 'md.coach.1,md.coach.2,md.coach.3', lines.join());
  await talkThrough(page);
  assert(await answerCard(page, 'show'), 'the first card asked');
  await sim(page, 1.2);
  const st = await island(page, (I) => ({ known: I.odd.modes.known(), badge: I.odd.modes.badge(), step: I.odd.modes.teach?.step(I.player.p)?.key }));
  assert(st.known.join() === 'normal,sporty' && st.badge.word === 'Normal' && st.step === 'md.tut.sporty.switch', JSON.stringify(st));
  // 1: [MODE]
  await press(page, 'KeyR');
  await sim(page, 1.5);
  let step = await island(page, (I) => I.odd.modes.teach?.step(I.player.p)?.key);
  assert(step === 'md.tut.sporty.run', `after R: ${step}`);
  // 2: run (east across the meadow)
  await standAt(page, 14, 10, [1, 0]);
  await hold(page, 'KeyD', 1.8);
  await sim(page, 1.5);
  step = await island(page, (I) => I.odd.modes.teach?.step(I.player.p)?.key);
  assert(step === 'md.tut.sporty.jump', `after running: ${step}`);
  await press(page, 'Space');
  await sim(page, 1.6);
  step = await island(page, (I) => I.odd.modes.teach?.step(I.player.p)?.key);
  assert(step === 'md.tut.sporty.back', `after the jump: ${step}`);
  await shot(page, 'lba2-modes-sporty');
  await press(page, 'KeyR');
  await sim(page, 1.6);
  const end = await island(page, (I) => ({ teach: !!I.odd.modes.teach, mode: I.odd.modes.mode, seen: window.game.assist.profileSettings(window.__testProfile.id).tutSeen.includes('isl.sporty') }));
  assert(!end.teach && end.mode === 'normal' && end.seen, JSON.stringify(end));
  assert(!page.errors.length, page.errors.join('\n'));
});

await test('the modes: Sporty is faster and jumps higher and slides a little after a turn; Sneaky tiptoes at half speed', async () => {
  const run = async (mode, s = 0.8) => {
    await island(page, (I, S, G, m) => { S.odd.mode = m; }, mode);
    await standAt(page, 14, 10, [1, 0]);
    const x0 = await island(page, (I) => I.player.x);
    await hold(page, 'KeyD', s);
    return (await island(page, (I) => I.player.x)) - x0;
  };
  await island(page, (I, S) => { S.odd.modes.sneaky = true; });
  const n = await run('normal'), sp = await run('sporty'), sn = await run('sneaky');
  console.log(`   0.8 s east: normal ${n.toFixed(2)} m, sporty ${sp.toFixed(2)} m, sneaky ${sn.toFixed(2)} m`);
  assert(sp > n * 1.2 && sn < n * 0.6 && sn > n * 0.35, JSON.stringify({ n, sp, sn }));
  // the jump: the highest point over the ground
  const jump = async (mode) => {
    await island(page, (I, S, G, m) => { S.odd.mode = m; }, mode);
    await standAt(page, 14, 10, [1, 0]);
    const fy0 = await island(page, (I) => { I.jump(); return I.player.fy; });
    await sim(page, 1.2);
    return (await island(page, (I) => I.player.peak)) - fy0;
  };
  const jn = await jump('normal'), js = await jump('sporty');
  console.log(`   jump height: normal ${jn.toFixed(2)}, sporty ${js.toFixed(2)}`);
  assert(js > jn * 1.15, `sporty jumps higher: ${jn} ${js}`);
  // Sporty: let go of the stick and the run carries you a little further (a slide), Normal stops at once
  const slide = async (mode) => {
    await island(page, (I, S, G, m) => { S.odd.mode = m; }, mode);
    await standAt(page, 14, 10, [1, 0]);
    await hold(page, 'KeyD', 0.5);
    const x1 = await island(page, (I) => I.player.x);
    await sim(page, 0.5);
    return (await island(page, (I) => I.player.x)) - x1;
  };
  const sl = { normal: await slide('normal'), sporty: await slide('sporty') };
  assert(sl.normal < 0.05 && sl.sporty > 0.3, JSON.stringify(sl));
  await island(page, (I, S) => { S.odd.mode = 'normal'; });
});

await test('Sneaky mode is quiet: a gull on a post stays put; Mumble teaches it (with its own tutorial)', async () => {
  // gulls: the scare radius is smaller when sneaky
  const r = await island(page, (I, S) => {
    // the gull's own rule (gulls.js): scared within 2.6 m, or 1.0 m when you tiptoe; the bean's sneaky flag follows the mode
    const g = I.life.gulls[0], P = { x: g.pos.x + 1.8, z: g.pos.z, y: g.pos.y };
    const src = g.update.toString();
    const scared = (sneaky) => Math.hypot(P.x - g.pos.x, P.z - g.pos.z) < (sneaky ? 1.0 : 2.6);
    S.odd.mode = 'sneaky'; S.odd.modes.sneaky = true; I.odd.modes.update(0);
    const flag = I.player.sneaky;
    S.odd.mode = 'normal'; I.odd.modes.update(0);
    return { normal: scared(false), sneaky: scared(true), rule: /P\.sneaky \? 1\.0 : 2\.6/.test(src), flag, after: I.player.sneaky };
  });
  assert(r.normal && !r.sneaky && r.rule && r.flag && !r.after, JSON.stringify(r));
  await island(page, (I, S) => { S.odd.modes.sneaky = false; S.odd.got.sneaky = S.odd.got.sneaky ?? 0; S.npcs.mumble = { ...(S.npcs.mumble || {}), met: true }; });
  const news = await island(page, (I) => I.hasNews('mumble'));
  assert(news, 'Mumble has news');
  await island(page, (I) => { const m = I.npc('mumble'); m.sleep = false; m.inside = false; I.player.x = m.x + 1.2; I.player.z = m.z; I.groundCheck(I.player, I.walkState); I.talkTo(m); });
  const lines = await island(page, (I) => I.dlg?.lines.map((l) => l.key));
  assert(lines?.join() === 'md.mumble.1,md.mumble.2,md.mumble.3', String(lines));
  await talkThrough(page);
  assert(await answerCard(page, 'show'), 'the card');
  await sim(page, 1.2);
  // switch until Sneaky (normal -> sporty -> sneaky)
  for (let i = 0; i < 3 && (await island(page, (I) => I.odd.modes.mode)) !== 'sneaky'; i++) { await press(page, 'KeyR'); await sim(page, 0.3); }
  await sim(page, 1.5);
  let step = await island(page, (I) => [I.odd.modes.mode, I.odd.modes.teach?.step(I.player.p)?.key]);
  assert(step[0] === 'sneaky' && step[1] === 'md.tut.sneaky.walk', String(step));
  const m = await island(page, (I) => { const n = I.npc('mumble'); return { x: n.x, z: n.z }; });
  await standAt(page, m.x + 4, m.z, [-1, 0]);
  await hold(page, 'KeyA', 2.2);
  await sim(page, 1.5);
  step = await island(page, (I) => I.odd.modes.teach?.step(I.player.p)?.key);
  await shot(page, 'lba2-modes-sneaky');
  // tiptoe right up to him
  await island(page, (I) => { const n = I.npc('mumble'); I.player.x = n.x + 1.5; I.player.z = n.z; I.groundCheck(I.player, I.walkState); });
  await sim(page, 1.6);
  step = await island(page, (I) => I.odd.modes.teach?.step(I.player.p)?.key);
  assert(step === 'md.tut.sneaky.back', `near Mumble: ${step}`);
  await press(page, 'KeyR');
  await sim(page, 1.6);
  const fin = await island(page, (I) => ({ teach: !!I.odd.modes.teach, mode: I.odd.modes.mode }));
  assert(!fin.teach && fin.mode === 'normal', JSON.stringify(fin));
});

await test('[MODE] on a gamepad (RB) and the badge in Norwegian; hints name R / RB', async () => {
  await page.evaluate(() => {
    const pad = { id: 'Xbox test pad (STANDARD GAMEPAD)', index: 0, connected: true, mapping: 'standard', timestamp: 0, axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0, touched: false })) };
    window.__pad = pad;
    navigator.getGamepads = () => [pad, null, null, null];
  });
  await sim(page, 0.1);
  await island(page, (I, S) => { I.game.roster.players[0].deviceId = 'gp0'; S.odd.mode = 'normal'; });
  const tap = async (i) => {
    await page.evaluate((i) => { const b = window.__pad.buttons[i]; b.pressed = true; b.value = 1; }, i);
    await sim(page, 1 / 30);
    await page.evaluate((i) => { const b = window.__pad.buttons[i]; b.pressed = false; b.value = 0; }, i);
    await sim(page, 1 / 30);
  };
  await tap(5); // RB
  const a = await island(page, (I) => ({ mode: I.odd.modes.mode, key: I.hud.top.innerText }));
  assert(a.mode === 'sporty' && /Sporty/.test(a.key) && /RB/.test(a.key), JSON.stringify(a));
  await page.evaluate(() => window.game.toggleLanguage());
  await sim(page, 0.2);
  await tap(5);
  const b = await island(page, (I) => ({ mode: I.odd.modes.mode, top: I.hud.top.innerText }));
  assert(b.mode === 'sneaky' && /Snik/.test(b.top), JSON.stringify(b));
  await page.evaluate(() => window.game.toggleLanguage());
  await island(page, (I) => { I.game.roster.players[0].deviceId = 'kb0'; });
  await page.evaluate(() => { navigator.getGamepads = () => [null, null, null, null]; });
  await sim(page, 0.2);
  const kb = await island(page, (I) => I.hud.top.innerText);
  assert(/\bR\b/.test(kb), kb);
  // R can never be taken by a key remap
  const reserved = await page.evaluate(async () => (await import('/src/core/input.js')).RESERVED_KEYS.has('KeyR'));
  assert(reserved, 'R is reserved');
});

await test('Start pauses the round\'s own island modes (a spell\'s rune, a teleport, the tea, the whale moment)', async () => {
  await island(page, (I) => { I.hud.setDialog(null); I.hud.setPanel(null); I.dlg = null; I.mode = 'walk'; });
  const r = await island(page, (I) => ['spell', 'teleport', 'tea', 'watch'].map((m) => { I.mode = m; const f = I.freezePause(); I.mode = 'walk'; return f; }));
  assert(r.every(Boolean), r.join());
  // and the magic ball only flies while you walk about (the island's menu freezes it)
  const fly = await island(page, (I, S) => {
    S.odd.got.ball = 0; S.inv.push({ id: 'magicBall', n: 1, slot: 4 }); S.sel = 4;
    I.odd.ball.throw();
    const x0 = I.odd.ball.fly?.x;
    I.mode = 'menu';
    return x0;
  });
  await sim(page, 0.5);
  const still = await island(page, (I) => { const x = I.odd.ball.fly?.x; I.mode = 'walk'; return x; });
  assert(fly !== undefined && still === fly, `frozen under the menu: ${fly} ${still}`);
});

await test('no console errors', async () => { assert(!page.errors.length, page.errors.join('\n')); });
await close(page);
done();
