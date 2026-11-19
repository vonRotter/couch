// Helpers for the games suite (tests/games): every game in main.js GAMES starts from the shared island (the hub)
// with keyboard players (or from a profile's island for the games that only live there), runs with random-ish
// input, and its pause menu works (Resume, Retry, End). Built on the island helper (tests/lively/helper.mjs).
import { sim, startIsland, at, press } from '../lively/helper.mjs';

export const sceneName = (page) => page.evaluate(() => window.game.current?.constructor?.name);
const waitIdle = (page) => page.waitForFunction(() => !window.game.switching && !!window.game.current, null, { timeout: 30000 });

/** The shared island with n keyboard players joined (kb0, kb1...). */
export async function hub(page, n = 1) {
  await page.evaluate(() => { window.game.audio.ensure(); window.game.openTogether(); });
  await page.waitForFunction(() => window.game.current?.constructor?.name === 'HubScene' && !window.game.switching, null, { timeout: 30000 });
  await page.evaluate((n) => {
    const g = window.game;
    for (const p of [...g.roster.players]) g.roster.leave(p);
    for (let i = 0; i < n; i++) g.roster.join(g.input.get(`kb${i}`));
  }, n);
  await sim(page, 0.5);
}

/** A profile's own island (for the games that only start there: Bean Brigade, Pillow Keep Solo, the Game Hall). */
export async function soloIsland(page) {
  await startIsland(page, { time: at(2026, 11, 18, 12), name: 'Player' });
}

/**
 * Start a game and play it for `seconds` of game time with random-ish keys for every joined player (a seeded
 * random walk: moves held for a while, the three buttons tapped now and then). Tutorial cards are answered
 * "I know how to play" (skip) and help offers "no". Returns what happened.
 */
export async function play(page, key, { seconds = 20, seed = 1, opts = {} } = {}) {
  await page.evaluate(([k, o]) => window.game.startGame(k, o), [key, opts]);
  await page.waitForFunction((k) => window.game.current?.key === k && !window.game.switching, key, { timeout: 30000 });
  await sim(page, 0.3);
  return page.evaluate(async ([seconds, seed]) => {
    const G = window.game;
    let s = seed >>> 0 || 1;
    const rnd = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
    const SCHEMES = [['KeyW', 'KeyS', 'KeyA', 'KeyD', 'Space', 'KeyE', 'KeyQ'], ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'ShiftRight', 'ControlRight'],
      ['KeyI', 'KeyK', 'KeyJ', 'KeyL', 'KeyU', 'KeyO', 'KeyP'], ['Numpad8', 'Numpad5', 'Numpad4', 'Numpad6', 'Numpad0', 'NumpadDecimal', 'NumpadEnter']];
    const down = new Set();
    const key = (code, on) => {
      if (on === down.has(code)) return;
      if (on) down.add(code); else down.delete(code);
      window.dispatchEvent(new KeyboardEvent(on ? 'keydown' : 'keyup', { code, key: code, bubbles: true }));
    };
    const n = Math.max(1, G.roster.players.length);
    let cards = 0, offers = 0;
    const scene0 = G.current;
    let t = 0, states = new Set();
    const tick = () => new Promise((r) => setTimeout(r, 0));
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    // titles, countdowns and wipes run on the real clock: let them (at most ~8 s), then play in game time
    let real = 0;
    while (t < seconds) {
      const st = G.current?.state;
      if ((st === 'intro' || st === 'countdown' || G.switching) && real < 8000) { G.simulate(1 / 30, 1 / 30); await wait(60); real += 60; continue; }
      if (G.tutorialCard) { G.tutorialCard.answer('skip'); cards++; }
      if (G.offer) { G.offer.answer('no'); offers++; }
      if (G.pause) G.closePause();
      for (let i = 0; i < n; i++) {
        const S = SCHEMES[i];
        // a direction held for a while
        if (rnd() < 0.25) { for (const c of S.slice(0, 4)) key(c, false); const d = Math.floor(rnd() * 6); if (d < 4) key(S[d], true); if (rnd() < 0.3) key(S[(Math.floor(rnd() * 4))], true); }
        // the buttons: taps, sometimes held
        for (const b of [4, 5, 6]) { if (down.has(S[b]) && rnd() < 0.6) key(S[b], false); else if (rnd() < 0.18) key(S[b], true); }
      }
      G.simulate(0.1, 1 / 30);
      t += 0.1;
      await tick();
      if (G.current?.state) states.add(G.current.state);
      if (G.current !== scene0 && !G.switching) break; // (the game ended and went back)
    }
    for (const c of [...down]) key(c, false);
    G.simulate(0.1, 1 / 30);
    return { scene: G.current?.constructor?.name, same: G.current === scene0, key: G.current?.key, t: +t.toFixed(1), real, states: [...states], cards, offers, players: G.roster.players.length };
  }, [seconds, seed]);
}

/** The pause menu (Esc): its items; pick one by name (E picks on a keyboard). */
export async function pause(page) {
  if (!(await page.evaluate(() => !!window.game.pause))) await press(page, 'Escape');
  return page.evaluate(() => (window.game.pause ? window.game.pauseItems() : null));
}
export async function pick(page, item) {
  await page.evaluate((item) => { const G = window.game; G.pause.index = G.pauseItems().indexOf(item); G.renderPause(); }, item);
  await press(page, 'KeyE');
}

/** Retry from the pause menu: a new scene of the same game. */
export async function retry(page, key) {
  const before = await page.evaluate(() => { window.__oldScene = window.game.current; return true; });
  void before;
  await pause(page);
  await pick(page, 'retry');
  await page.waitForFunction((k) => window.game.current !== window.__oldScene && window.game.current?.key === k && !window.game.switching, key, { timeout: 30000 });
  await sim(page, 0.3);
  await page.evaluate(() => { if (window.game.tutorialCard) window.game.tutorialCard.answer('skip'); });
  return sceneName(page);
}

/** End from the pause menu: back to where the game was started from. */
export async function end(page) {
  await pause(page);
  await pick(page, 'end');
  await page.waitForFunction(() => ['HubScene', 'SoloIslandScene', 'StoryScene'].includes(window.game.current?.constructor?.name) && !window.game.switching, null, { timeout: 30000 });
  await sim(page, 0.3);
  return sceneName(page);
}

export { waitIdle };

/**
 * The tests for a family of games (one file per family): per game, with 1 and 2 keyboard players (`players`), it
 * starts, 20 s of random-ish play without console errors (a tutorial's card answered "I know how to play": the
 * tutorial is off), and once (with the first player count) the pause menu: Esc opens it, Retry restarts the game,
 * End goes back. from: 'hub' (the shared island) or 'solo' (a profile's island: the games that only live there).
 */
export async function family(page, keys, { from = 'hub', players = [1, 2], test, assert } = {}) {
  for (const key of keys) {
    for (const [i, n] of players.entries()) {
      await test(`${key}: ${n} player${n > 1 ? 's' : ''}: starts from the ${from === 'hub' ? 'shared island' : 'island'}, 20 s of play, no console errors${i === 0 ? '; the pause menu: Retry restarts, End returns' : ''}`, async () => {
        const e0 = page.errors.length;
        if (from === 'hub') await hub(page, n);
        else if (!(await page.evaluate(() => window.game.current?.constructor?.name === 'SoloIslandScene'))) await soloIsland(page);
        const r = await play(page, key, { seconds: 20, seed: 11 * n + key.length });
        assert(r.same && r.key === key, `still in the game: ${JSON.stringify(r)}`);
        assert(r.states.some((s) => s !== 'intro'), `got past its title: ${JSON.stringify(r)}`);
        if (r.cards) assert(!(await page.evaluate(() => !!window.game.current.tutorialActive?.())), `"I know how to play" skips the tutorial: ${JSON.stringify(r)}`);
        assert(page.errors.length === e0, page.errors.slice(e0).join('\n'));
        if (i === 0) {
          const items = await pause(page);
          assert(items && items[0] === 'resume' && items.includes('retry') && items.includes('end'), `pause: ${JSON.stringify(items)}`);
          await press(page, 'Escape');
          assert(!(await page.evaluate(() => !!window.game.pause)), 'Esc closes it');
          const sc = await retry(page, key);
          assert(sc, 'retried');
          await sim(page, 1);
          const back = await end(page);
          assert(back === (from === 'hub' ? 'HubScene' : 'SoloIslandScene') || (key.startsWith('boss') && back === 'StoryScene'), `End: back to ${back}`);
          assert(page.errors.length === e0, page.errors.slice(e0).join('\n'));
        } else {
          await page.evaluate(() => { const G = window.game; if (G.pause) G.closePause(); });
        }
      });
    }
  }
}
