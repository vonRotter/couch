// The odd-adventure round, part 4a: social happenings, run like the villagers' dramas (village.js): one at a time,
// a start, a middle and one big moment (on a free day), beats at most one a day, and the island remembers. The fence
// (pick a side or make peace), the island vote (the result stands in the square), the secret club (clues one a day, or
// sneak up on the sleepy guard's note; the password at the door), Hoot's surprise party (things to bring, without
// him noticing) and the rumour that grows as it spreads.
import { open, close, startIsland, island, sim, at, test, assert, done, shot, standAt, talkThrough, oddSave, DAY } from './lba2.mjs';

const page = await open();
const D0 = at(2026, 11, 18, 11);
const day = async (d, h = 11) => { await page.evaluate((ms) => { window.__islandTimeOffset = ms - Date.now(); }, D0 + d * DAY + (h - 11) * 3600e3); await sim(page, 1.3); await island(page, (I) => { if (I.mode === 'today') { I.hud.setPanel(null); I.mode = 'walk'; } }); };
const talk = async (id, pick = 0) => {
  await island(page, (I, S, G, id) => { const n = I.npc(id); n.sleep = false; n.inside = false; n.away = false; I.player.x = n.x + 1.2; I.player.z = n.z; I.groundCheck(I.player, I.walkState); I.talkTo(n); }, id);
  const keys = await island(page, (I) => (I.mode === 'dialog' ? I.dlg.lines.map((l) => l.key) : []));
  await talkThrough(page, pick);
  await island(page, (I, S, G, id) => { I.npc(id).talking = false; }, id);
  return keys;
};
/** Start a drama now (as village.newDay would), its big moment 4 days later (the test's days are free days). */
const startDrama = (id) => page.evaluate(async (id) => {
  const { SOCIAL } = await import('/src/scenes/solo/social.js');
  const I = window.game.current, S = I.save, V = I.village.V, di = Math.round((new Date(S.todayBoard.day + 'T12:00').getTime() - new Date(1970, 0, 1, 12).getTime()) / 86400000);
  V.drama = { id, start: di, climax: di + 4, told: {}, side: null, fish: 0, water: [], flavor: null, res: null };
  SOCIAL[id]?.init?.(V.drama);
  return di;
}, id);

await test('the turn order over six months: the five new happenings join after the first three, one at a time', async () => {
  await startIsland(page, { time: D0, save: oddSave({}) });
  const r = await island(page, (I, S) => {
    S.village = {}; S.intro = true;
    const d0 = Math.round((new Date(S.todayBoard.day + 'T12:00').getTime() - new Date(1970, 0, 1, 12).getTime()) / 86400000);
    const seen = [];
    let most = 0;
    for (let di = d0; di < d0 + 183; di++) {
      I.village.newDay(new Date(1970, 0, 1 + di, 12).getTime());
      const D = S.village.drama;
      if (D && !seen.some((x) => x.start === D.start - d0)) seen.push({ id: D.id, start: D.start - d0, climax: D.climax - D.start });
      most = Math.max(most, D ? 1 : 0);
    }
    return { seen, most };
  });
  console.log(`   six months: ${r.seen.map((x) => `${x.id} (day ${x.start}, big moment +${x.climax})`).join(', ')}`);
  const ids = r.seen.map((x) => x.id);
  assert(r.most === 1 && ['fence', 'election', 'club', 'party', 'rumour'].every((id) => ids.includes(id)), JSON.stringify(r));
  assert(ids.slice(0, 3).join() === 'rivalry,pumpkin,cake' && r.seen.every((x) => x.climax >= 4 && x.climax <= 9), JSON.stringify(r.seen));
});

await test('the fence: Rosa and Coach Bo each ask; make peace; the big moment; the island remembers the gate', async () => {
  await startIsland(page, { time: D0, save: oddSave({}) });
  await island(page, (I, S) => { S.npcs.rosa = { ...(S.npcs.rosa || {}), met: true }; S.npcs.coach = { ...(S.npcs.coach || {}), met: true }; });
  await startDrama('fence');
  await island(page, (I) => I.village.newDay(Date.now() + window.__islandTimeOffset));
  const keys = await talk('rosa', 2);
  assert(keys[0] === 'vd.fence.rosa.start.1', keys.join());
  const side = await island(page, (I, S) => S.village.drama.side);
  assert(side === 'peace', side);
  await day(2);
  const mid = await island(page, (I) => I.village.todayNews(Date.now() + window.__islandTimeOffset).map((x) => x.keys[0]));
  assert(mid.includes('vd.fence.news.mid'), mid.join());
  // the big moment (day 4, a free day: the test made it so)
  await day(4);
  await island(page, (I, S) => { I.player.x = 18.4; I.player.z = -19.4; I.groundCheck(I.player, I.walkState); });
  await sim(page, 0.5);
  const lines = await island(page, (I) => (I.mode === 'dialog' ? I.dlg.lines.map((l) => l.key) : null));
  await shot(page, 'lba2-social-fence');
  await talkThrough(page);
  const r = await island(page, (I, S) => ({ res: S.village.drama?.res, mem: S.village.mem?.fence, gate: I.village.props.get('s:fence')?.userData.parts.peace.visible }));
  assert(lines?.includes('vd.fence.end.peace') && r.res === 'peace' && r.mem === 'peace' && r.gate, JSON.stringify({ lines, r }));
});

await test('the island vote: your vote breaks the tie; the flower clock stands in the square from then on', async () => {
  await startIsland(page, { time: D0, save: oddSave({}) });
  await startDrama('election');
  await island(page, (I) => I.village.newDay(Date.now() + window.__islandTimeOffset));
  await standAt(page, 16.6, -6.4, [0, -1]);
  const b = await island(page, (I) => I.interactions().b?.text);
  assert(/vote at the ballot box/.test(b), b);
  await island(page, (I) => I.interactions().b.fn());
  await talkThrough(page, 0);
  await day(2);
  const tally = await island(page, (I, S) => I.village.todayNews(Date.now() + window.__islandTimeOffset).find((x) => x.keys[0] === 'vd.election.news.mid')?.v);
  assert(tally && tally.clock >= 1, JSON.stringify(tally));
  await day(5); // the day after the big moment, never visited: it ended without you
  const r = await island(page, (I, S) => ({ mem: S.village.mem?.election, clock: !!I.village.props.get('s:square') }));
  assert(r.mem === 'clock' && r.clock, JSON.stringify(r));
});

await test('the secret club: one clue a day; the sleepy guard wakes at noise but not when you tiptoe; the password', async () => {
  await startIsland(page, { time: D0, save: oddSave({ sneaky: 0 }, { modes: { sneaky: true } }) });
  await island(page, (I, S) => { for (const id of ['hazel', 'rosa', 'bram', 'pip', 'mumble']) S.npcs[id] = { ...(S.npcs[id] || {}), met: true }; });
  await startDrama('club');
  await island(page, (I) => I.village.newDay(Date.now() + window.__islandTimeOffset));
  const word = await island(page, (I, S) => ['pancake', 'snowball', 'jellyfish'][S.village.drama.pw]);
  const c1 = await talk('hazel');
  const c2 = await talk('rosa'); // a second clue the same day: not yet
  assert(c1[0] === 'cl.clue' && c2[0] !== 'cl.clue', `${c1} / ${c2}`);
  await day(1);
  assert((await talk('rosa'))[0] === 'cl.clue', 'the next day');
  // the guard: walk up normally and he wakes (no peeking today)
  await island(page, (I, S) => { S.odd.mode = 'normal'; });
  await standAt(page, -5.6, 27.2);
  await sim(page, 1.2);
  const woke = await island(page, (I, S) => S.village.drama.woke);
  assert(woke !== null && woke !== undefined, 'noise wakes him');
  await day(2);
  await island(page, (I, S) => { S.odd.mode = 'sneaky'; });
  await standAt(page, -5.6, 27.6);
  await sim(page, 1.2);
  await standAt(page, -5.6, 26.6);
  await sim(page, 1.2);
  const st = await island(page, (I, S) => ({ woke: S.village.drama.woke, b: I.interactions().b?.text }));
  assert(/note behind the guard/.test(st.b), `tiptoeing, he sleeps on: ${JSON.stringify(st)}`);
  await island(page, (I) => I.interactions().b.fn());
  const note = await island(page, (I) => I.dlg?.lines[0]?.key);
  await shot(page, 'lba2-social-club');
  await talkThrough(page);
  assert(note === 'cl.note', note);
  // club day: the password at the door
  await day(4);
  await standAt(page, -4, 25.4, [0, -1]);
  await island(page, (I) => I.interactions().b.fn());
  const pick = await island(page, (I, S, G, word) => I.dlg.lines[0].choices.indexOf(`cl.word.${word}`), word);
  await talkThrough(page, pick);
  await sim(page, 0.5);
  await talkThrough(page);
  const r = await island(page, (I, S) => ({ res: S.village.drama?.res, mem: S.village.mem?.club, pin: !!S.deco.clubPin }));
  assert(r.res === 'member' && r.mem && r.pin, JSON.stringify(r));
});

await test('Hoot\'s surprise party: one thing a day; Hoot notices you unless you keep away (or tiptoe); the result', async () => {
  await startIsland(page, { time: D0, save: oddSave({}) });
  await island(page, (I, S) => { for (const id of ['hazel', 'rosa', 'pip', 'grumbleton', 'hoot']) S.npcs[id] = { ...(S.npcs[id] || {}), met: true }; });
  await startDrama('party');
  await island(page, (I) => I.village.newDay(Date.now() + window.__islandTimeOffset));
  assert((await talk('hazel'))[0] === 'pt.give.hazel', 'Hazel gives bunting');
  assert((await talk('pip'))[0] !== 'pt.give.pip', 'one thing a day');
  // walk right past Hoot with the bunting: he notices (once)
  await island(page, (I) => { const h = I.npc('hoot'); h.sleep = false; h.inside = false; I.player.x = h.x + 1.5; I.player.z = h.z; I.groundCheck(I.player, I.walkState); });
  await sim(page, 1.5);
  const n1 = await island(page, (I, S) => S.village.drama.noticed);
  assert(n1 === 1, `noticed ${n1}`);
  await standAt(page, 0, 0);
  await day(1); assert((await talk('pip'))[0] === 'pt.give.pip', 'Pip');
  await day(2); assert((await talk('grumbleton'))[0] === 'pt.give.grumbleton', 'Grumbleton');
  assert((await talk('rosa'))[0] !== undefined, 'Rosa');
  const D = await island(page, (I, S) => S.village.drama);
  assert(D.delivered && D.got.length === 3, JSON.stringify(D));
  await day(4);
  await island(page, (I) => { I.player.x = 23.0; I.player.z = 5.6; I.groundCheck(I.player, I.walkState); });
  await sim(page, 0.6);
  const lines = await island(page, (I) => (I.mode === 'dialog' ? I.dlg.lines.map((l) => l.key) : null));
  await shot(page, 'lba2-social-party');
  await talkThrough(page);
  assert(lines?.includes('vd.party.end.almost'), String(lines));
});

await test('the rumour grows as it spreads: each villager tells a bigger version (one a day); the truth on the big day', async () => {
  await startIsland(page, { time: D0, save: oddSave({}) });
  await island(page, (I, S) => { for (const id of ['hazel', 'rosa', 'pip', 'bram', 'grumbleton', 'hoot', 'mumble']) S.npcs[id] = { ...(S.npcs[id] || {}), met: true }; });
  await startDrama('rumour');
  await island(page, (I) => I.village.newDay(Date.now() + window.__islandTimeOffset));
  const heard = [];
  heard.push((await talk('rosa'))[0]);
  heard.push((await talk('pip'))[0]); // the same day: not a second version
  await day(1); heard.push((await talk('pip'))[0]);
  await day(2); heard.push((await talk('bram'))[0]);
  await day(3); heard.push((await talk('hazel'))[0]);
  console.log(`   versions heard: ${heard.join(', ')}`);
  assert(heard[0] === 'rm.v.1' && heard[1] !== 'rm.v.2' && heard[2] === 'rm.v.2' && heard[3] === 'rm.v.3' && heard[4] === 'rm.v.4', heard.join());
  await day(4);
  await island(page, (I) => { I.player.x = 31.0; I.player.z = 37.2; I.groundCheck(I.player, I.walkState); });
  await sim(page, 0.6);
  const lines = await island(page, (I) => (I.mode === 'dialog' ? I.dlg.lines.map((l) => l.key) : null));
  await talkThrough(page);
  const duck = await island(page, (I, S) => S.inv.some((x) => x.id === 'rubberDuck'));
  assert(lines?.includes('vd.rumour.end.duck') && duck, JSON.stringify({ lines, duck }));
});

await test('no console errors', async () => { assert(!page.errors.length, page.errors.join('\n')); });
await close(page);
done();
