// Part 4: calm island music and ambience by time, season and place, and the new menu settings.
import { open, close, startIsland, island, sim, at, setTime, test, assert, done, press } from './helper.mjs';

const page = await open();
const SUMMER = at(2026, 11, 18, 8); // a summer week (Wednesday)
const WINTER = at(2026, 12, 2, 8); // a winter week
const closeBoard = () => island(page, (I) => { if (I.mode === 'today') { I.hud.setPanel(null); I.mode = 'walk'; } });
const moveTo = (x, z) => island(page, (I, S, G, [x, z]) => { I.player.x = x; I.player.z = z; I.groundCheck(I.player, I.walkState); }, [x, z]);

await test('music: a calm track for the time of day, crossfading when it changes', async () => {
  await startIsland(page, { time: SUMMER });
  await closeBoard();
  const seen = {};
  for (const [h, want] of [[8, 'isl.morning'], [13, 'isl.day'], [18.5, 'isl.evening'], [23, 'isl.night'], [3, 'isl.night']]) {
    await setTime(page, SUMMER + (h - 8) * 3600e3 + (h < 8 ? 86400e3 : 0));
    await sim(page, 0.6);
    const r = await island(page, (I, S, G) => ({ s: I.soundState.music, a: G.audio.songName, calm: G.audio.song?.calm || !!G.audio.fading }));
    assert(r.s === want && r.a === want, `${h}: ${JSON.stringify(r)}`);
    seen[h] = r.s;
  }
  const fade = await page.evaluate(() => { const a = window.game.audio; a.playMusic('isl.day', { fade: 4 }); return !!a.fading || !a.ctx; });
  assert(fade, 'a crossfade');
});

await test('music: winter sounds different', async () => {
  await startIsland(page, { time: WINTER });
  await closeBoard();
  const r = await island(page, (I, S, G) => ({ m: I.soundState.music, season: I.seasons.season, song: G.audio.song && { bells: !!G.audio.song.bells, bpm: G.audio.song.bpm } }));
  assert(r.season === 'winter' && r.m === 'isl.morning.winter', JSON.stringify(r));
});

await test('ambience: waves by the shore, wind on the hill, birds by day, crickets at night, rain, the café', async () => {
  await startIsland(page, { time: at(2026, 11, 18, 12) });
  await closeBoard();
  const amb = async () => { await sim(page, 0.4); return island(page, (I) => I.soundState.amb); };
  await moveTo(13, 40);
  const beach = await amb();
  await moveTo(10.4, -26.4);
  const hill = await amb();
  await moveTo(-8.6, 40.6);
  const cafe = await amb();
  assert(beach.waves > 0.6 && hill.waves < 0.2, `waves ${beach.waves} / ${hill.waves}`);
  assert(hill.wind > beach.wind, `wind ${hill.wind} / ${beach.wind}`);
  assert(beach.birds > 0 && hill.birds > 0 && hill.crickets === 0, JSON.stringify(hill));
  assert(cafe.cafe > 0.3, JSON.stringify(cafe));
  await setTime(page, at(2026, 11, 18, 23));
  await moveTo(10.4, -26.4);
  const night = await amb();
  assert(night.crickets > 0 && night.birds === 0, JSON.stringify(night));
  // a rainy day (rain), and snow in a winter week
  const rainy = await page.evaluate(async () => { const C = await import('/src/scenes/solo/calendar.js'); const out = {}; const d0 = C.dayIndex(Date.now()); for (let d = d0; d < d0 + 60; d++) { const ms = C.dayMs(d); if (C.rainyOn(ms) && !C.rareEventOn(ms)) out[C.seasonOf(ms) === 'winter' ? 'winter' : 'other'] ??= ms; } return out; });
  await setTime(page, rainy.other);
  await sim(page, 1.5);
  const r = await amb();
  assert(r.rain === 1 && r.snow === 0, JSON.stringify(r));
  await setTime(page, rainy.winter);
  await sim(page, 1.5);
  const w = await amb();
  assert(w.snow === 1 && w.rain === 0, JSON.stringify(w));
  // indoors only a little comes through
  const audioLevels = await page.evaluate(() => window.game.audio.ambLevels);
  assert(Object.values(audioLevels).every((v) => v <= 1), 'levels');
});

await test('settings: island music and island sounds switch off (per profile, kept), the master sound still mutes all', async () => {
  await startIsland(page, { time: SUMMER, name: 'Sound' });
  await closeBoard();
  await island(page, (I) => I.openMode(0));
  const items = await island(page, (I) => I.menuItems());
  assert(items.includes('music') && items.includes('amb'), items.join());
  await island(page, (I) => { I.modeIndex = I.menuItems().indexOf('music'); I.renderMode(); });
  await sim(page, 0.4);
  await press(page, 'KeyE');
  await island(page, (I) => { I.modeIndex = I.menuItems().indexOf('amb'); I.renderMode(); });
  await press(page, 'KeyD');
  const txt = await island(page, (I) => I.modeEl.innerText);
  assert(/Island music: off/i.test(txt) && /Island sounds.*: off/i.test(txt), txt);
  await island(page, (I) => I.closeMode());
  await sim(page, 0.5);
  const st = await island(page, (I, S, G) => ({ pref: S.sound, level: G.audio.musicLevel, amb: Object.values(G.audio.ambLevels).every((v) => v === 0) }));
  assert(!st.pref.music && !st.pref.amb && st.level === 0 && st.amb, JSON.stringify(st));
  // kept for this profile: back on the island after a game
  await island(page, (I) => I.flush());
  await page.evaluate(() => window.game.enterSolo(window.__testProfile, 'kb0'));
  await page.waitForFunction(() => !window.game.switching && window.game.current?.save?.sound);
  await sim(page, 0.5);
  const again = await island(page, (I, S, G) => ({ pref: S.sound, level: G.audio.musicLevel }));
  assert(!again.pref.music && !again.pref.amb && again.level === 0, JSON.stringify(again));
  // another profile has its own (on)
  await startIsland(page, { time: SUMMER, name: 'Other' });
  const other = await island(page, (I, S, G) => ({ m: I.soundPrefs.music, level: G.audio.musicLevel }));
  assert(other.m && other.level === 1, JSON.stringify(other));
  // the master switch mutes everything, and leaves the island settings alone
  const muted = await page.evaluate(() => { const a = window.game.audio; a.toggleMute(); const r = { muted: a.muted, gain: a.master ? a.master.gain.value : 0 }; a.toggleMute(); return r; });
  assert(muted.muted && muted.gain === 0, JSON.stringify(muted));
});

await test('the dive has its underwater hum, and leaving the island stops the ambience', async () => {
  await startIsland(page, { time: SUMMER, save: (S) => { S.sea.suit = true; } });
  await closeBoard();
  await island(page, (I) => I.startDive());
  await page.waitForFunction(() => window.game.current?.constructor?.name === 'DiveScene' && !window.game.switching, null, { timeout: 30000 });
  await sim(page, 1);
  const lv = await page.evaluate(() => window.game.audio.ambLevels);
  assert(lv.under === 1 && !lv.waves, JSON.stringify(lv));
});

await test('no console errors', async () => { assert(!page.errors.length, page.errors.join('\n')); });
await close(page);
done();
