// Part 2: villagers with their own lives: conversations, dramas, projects, reactions.
import { open, close, startIsland, island, sim, at, setTime, test, assert, done, shot, dismiss, press, DAY } from './helper.mjs';

const page = await open();
const D0 = at(2026, 11, 17, 9); // Tuesday 17 November 2026
const closeBoard = () => island(page, (I) => { if (I.mode === 'today') { I.hud.setPanel(null); I.mode = 'walk'; } });

await test('conversations: one to three slots a day, one at a time, and you can listen', async () => {
  await startIsland(page, { time: D0 });
  await closeBoard();
  const slots = await island(page, (I) => I.village.slots('2026-11-17'));
  assert(slots.length >= 1 && slots.length <= 3, JSON.stringify(slots));
  // walk the day: at each slot stand by the square and wait for a conversation
  let seen = 0, heard = null;
  for (const s of slots) {
    await setTime(page, D0 + (s.from + 0.05 - 9) * 3600e3);
    await island(page, (I) => { I.player.x = 12; I.player.z = -4; I.groundCheck(I.player, I.walkState); });
    await sim(page, 1.5, 0.1);
    const c = await island(page, (I) => I.village.chat && { a: I.village.chat.a.id, b: I.village.chat.b.id, id: I.village.chat.tp.id });
    if (!c) continue;
    seen++;
    // walk up and listen
    await island(page, (I) => { const C = I.village.chat; I.player.x = C.a.x + 1.2; I.player.z = C.a.z + 1.2; I.groundCheck(I.player, I.walkState); });
    for (let k = 0; k < 40 && await island(page, (I) => !!I.village.chat); k++) {
      await sim(page, 1, 0.1);
      if (k === 6) await shot(page, 'lively-conversation');
      const n = await island(page, (I) => I.npcs.filter((x) => x.busy).length);
      assert(n <= 2, 'one conversation at a time');
    }
    heard = await island(page, (I) => I.village.lastChat && { heard: I.village.lastChat.heard, texts: I.village.lastChat.texts, a: I.village.lastChat.a.id, b: I.village.lastChat.b.id });
    break;
  }
  assert(seen >= 1, 'a conversation started');
  assert(heard && heard.heard === 3 && heard.texts.length === 3, JSON.stringify(heard));
  const log = await page.evaluate(async () => (await import('/src/core/voice.js')).voiceLog.slice(-8).map((e) => e.speaker));
  assert(log.includes(`isl.${heard.a}`) && log.includes(`isl.${heard.b}`), `voices: ${log}`);
  const saved = await island(page, (I, S) => S.village.heard.length);
  assert(saved === 1, 'remembered as heard');
});

await test('conversations: a heard topic does not come back within four weeks', async () => {
  const r = await island(page, (I, S) => {
    const id = S.village.heard[0].id, out = [];
    for (let d = 0; d < 28; d++) { const p = I.village.plan(Date.now() + window.__islandTimeOffset + d * 86400000); if (p) out.push(p.tp.id); }
    return { id, again: out.includes(id), n: out.length };
  });
  assert(!r.again, JSON.stringify(r));
});

await test('drama: the fishing contest starts, you pick a side, your fish count, and it ends on its big day', async () => {
  await startIsland(page, { time: D0 });
  // jump to the day the first drama starts
  let info = null;
  for (let d = 0; d < 6 && !info; d++) {
    await setTime(page, D0 + d * DAY + 3 * 3600e3);
    await sim(page, 1.2, 0.1);
    await closeBoard();
    info = await island(page, (I, S) => S.village.drama && { ...S.village.drama });
  }
  assert(info && info.id === 'rivalry', JSON.stringify(info));
  const startItems = await island(page, (I, S) => S.todayBoard.items.map((i) => i.k));
  assert(startItems.includes('vd.rivalry.news.start'), startItems.join());
  // talk to Pip: she asks whose side you are on (the first answer: Pip)
  assert(await island(page, (I) => I.hasNews('pip')), 'Pip has news (!)');
  await island(page, (I, S) => { S.npcs.pip = { pts: 30, talkAt: 0, giftAt: 0, ev: 9, q: 9, met: true }; const n = I.npc('pip'); I.player.x = n.x + 1; I.player.z = n.z + 1; I.talkTo(n); });
  await dismiss(page, 8);
  let D = await island(page, (I, S) => S.village.drama);
  assert(D.side === 'pip', `side ${D.side}`);
  // three fish for Pip
  await island(page, (I) => { for (let i = 0; i < 3; i++) I.village.onFish('sardine'); });
  // the middle: the chalk board shows the score with your fish
  const toDay = async (di, h = 12) => { const ms = await page.evaluate(async ([di, h]) => { const C = await import('/src/scenes/solo/calendar.js'); return C.dayMs(di) + (h - 12) * 3600e3; }, [di, h]); await setTime(page, ms); await sim(page, 1.2, 0.1); await closeBoard(); };
  await toDay(D.start + 2);
  const mid = await island(page, (I, S) => ({ items: S.todayBoard.items, scores: I.village.scores(S.village.drama) }));
  const m = mid.items.find((i) => i.k === 'vd.rivalry.news.mid');
  assert(m && m.v.p === mid.scores.p && mid.scores.p >= 4, JSON.stringify(mid));
  // the big day: walk up to the pier
  await toDay(D.climax, 12);
  const climaxItems = await island(page, (I, S) => S.todayBoard.items.map((i) => i.k));
  assert(climaxItems.includes('vd.rivalry.news.climax'), climaxItems.join());
  await island(page, (I) => { I.player.x = 2.4; I.player.z = 43.0; I.groundCheck(I.player, I.walkState); });
  await sim(page, 0.5, 0.1);
  await shot(page, 'lively-drama-weighin');
  D = await island(page, (I, S) => S.village.drama);
  assert(D.res === 'pip', `result ${D.res}`);
  await dismiss(page, 8);
  // the next day it is over, and the next drama waits a few days
  await toDay(D.climax + 1);
  const after = await island(page, (I, S) => ({ d: S.village.drama, past: S.village.past }));
  assert(!after.d && after.past.at(-1).res === 'pip', JSON.stringify(after));
});

await test('drama: the big moment is always on a free day (no festival, surprise or rare event)', async () => {
  const bad = await page.evaluate(async () => {
    const C = await import('/src/scenes/solo/calendar.js');
    const I = window.game.current, out = [];
    for (let k = 0; k < 40; k++) {
      const di = C.dayIndex(Date.now()) + k * 3;
      I.save.village.drama = null; I.save.village.nextDrama = di; I.save.intro = true;
      I.village.newDay(C.dayMs(di));
      const D = I.save.village.drama;
      if (!C.freeDay(C.dayMs(D.climax)) || D.climax < di + 4) out.push(D);
    }
    return out;
  });
  assert(!bad.length, JSON.stringify(bad));
});

await test('projects: four stages two days apart, visible, one at a time; 5 wood makes it a day faster', async () => {
  await startIsland(page, { time: D0 });
  const toDay = async (di, h = 12) => { const ms = await page.evaluate(async ([di, h]) => { const C = await import('/src/scenes/solo/calendar.js'); return C.dayMs(di) + (h - 12) * 3600e3; }, [di, h]); await setTime(page, ms); await sim(page, 1.2, 0.1); await closeBoard(); };
  let P = null;
  for (let d = 0; d < 4 && !P; d++) { await setTime(page, D0 + d * DAY + 3 * 3600e3); await sim(page, 1.2, 0.1); await closeBoard(); P = await island(page, (I, S) => S.village.proj && { ...S.village.proj }); }
  assert(P && P.id === 'gazebo' && P.stage === 0, JSON.stringify(P));
  const stages = [];
  for (let k = 0; k <= 6; k++) {
    await toDay(P.start + k, 14);
    stages.push(await island(page, (I, S) => {
      const g = I.village.props.get('gazebo');
      return { stage: S.village.proj?.stage ?? 'done', shown: g.userData.stages.filter((s) => s.visible).length, built: S.village.built.slice() };
    }));
    if (k === 4) {
      await island(page, (I) => { I.player.x = 31; I.player.z = 28; I.groundCheck(I.player, I.walkState); });
      await sim(page, 0.3);
      await shot(page, 'lively-project-gazebo');
    }
  }
  assert(JSON.stringify(stages.map((s) => s.stage)) === JSON.stringify([0, 0, 1, 1, 2, 2, 'done']), JSON.stringify(stages));
  assert(stages[6].shown === 4 && stages[2].shown === 2, JSON.stringify(stages));
  // Bram works on the site in the early afternoon
  // the next project: a few days later, and only one at a time; help with wood
  let Q = null;
  for (let k = 7; k < 14 && !Q; k++) { await toDay(P.start + k, 11); Q = await island(page, (I, S) => S.village.proj && { ...S.village.proj }); }
  assert(Q && Q.id === 'garden', JSON.stringify(Q));
  await island(page, (I, S) => { S.inv.push({ id: 'wood', n: 5 }); const n = I.npc('hazel'); S.npcs.hazel = { ...(S.npcs.hazel || {}), met: true, pts: 0, ev: 9, q: 9 }; I.player.x = n.x + 1; I.player.z = n.z; I.talkTo(n); });
  await dismiss(page, 6);
  const helped = await island(page, (I, S) => ({ help: S.village.proj.help, wood: S.inv.filter((x) => x.id === 'wood').reduce((a, b) => a + b.n, 0), at1: I.village.stageOf(S.village.proj, S.village.proj.start + 1) }));
  assert(helped.help && helped.wood === 0 && helped.at1 === 1, JSON.stringify(helped));
});

await test('reactions: something you did is said once, by one villager', async () => {
  await startIsland(page, { time: D0 + 3 * 3600e3 });
  await closeBoard();
  await island(page, (I, S) => { for (const id of ['rosa', 'pip', 'hoot', 'coach']) S.npcs[id] = { pts: 0, talkAt: 0, giftAt: 0, ev: 9, q: 9, met: true }; I.village.note('roof'); });
  const say = async (id) => {
    await island(page, (I, S, G, id) => { const n = I.npc(id); n.sleep = false; I.player.x = n.x + 1; I.player.z = n.z; I.talkTo(n); }, id);
    const lines = await island(page, (I) => (I.dlg ? I.dlg.lines.map((l) => l.key) : []));
    await dismiss(page, 8);
    return lines;
  };
  const a = await say('rosa');
  assert(a.some((k) => k.startsWith('vr.roof.')), `rosa: ${a}`);
  const b = await say('hoot');
  assert(!b.some((k) => k.startsWith('vr.')), `hoot: ${b}`);
  // the same thing again this week: nobody says it again
  await island(page, (I) => I.village.note('roof'));
  const c = await say('pip');
  assert(!c.some((k) => k.startsWith('vr.')), `pip: ${c}`);
});

await test('no console errors', async () => { assert(!page.errors.length, page.errors.join('\n')); });
await close(page);
done();
