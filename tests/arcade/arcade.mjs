// Helpers for the Game Hall's classic games and the island's puzzles (tests/arcade). Built on the island
// helper (tests/lively/helper.mjs): a profile's island first (high scores are per profile), then a game.
import { startIsland, sim, at, press, island } from '../lively/helper.mjs';

export const D0 = at(2026, 11, 18, 12);

/** Run fn(r, g, G, arg) in the page: r the arcade runner (the game scene's, or the island puzzle's), g its game. */
export async function R(page, fn, arg) {
  return page.evaluate(([src, arg]) => {
    const G = window.game, cur = G.current;
    const r = cur.runner || cur.puzzles?.runner;
    return (0, eval)(`(${src})`)(r, r?.g, G, arg);
  }, [String(fn), arg]);
}

/** Set "Help me play" for the profile playing (a patch: { timing: true }, { aim: 2, aimChosen: true }...). */
export async function setAssist(page, patch) {
  await page.evaluate((patch) => {
    const G = window.game, id = G.solo.profile.id;
    const s = G.assist.profileSettings(id);
    G.assist.saveSettings(id, { ...s, ...patch });
    G.applyDeviceSettings(true);
    G.applyScreenSettings();
  }, patch);
}

/** A fresh profile and island (once per file), then a classic game from its cabinet key; past the first card and Ready. */
export async function startArcade(page, key, { tutorial = 'skip', settle = 1.3 } = {}) {
  if (!(await page.evaluate(() => !!window.game.solo))) await startIsland(page, { time: D0 });
  await page.evaluate((k) => window.game.startGame(k), key);
  await page.waitForFunction((k) => window.game.current?.key === k && !window.game.switching && !!window.game.current.runner, key, { timeout: 30000 });
  await sim(page, 0.2);
  if (tutorial) await page.evaluate((a) => window.game.tutorialCard?.answer(a), tutorial);
  await sim(page, settle);
}

/** Hold a key for s seconds of game time. */
export async function hold(page, code, s) {
  await page.evaluate((code) => window.dispatchEvent(new KeyboardEvent('keydown', { code, key: code, bubbles: true })), code);
  await sim(page, s);
  await page.evaluate((code) => window.dispatchEvent(new KeyboardEvent('keyup', { code, key: code, bubbles: true })), code);
  await sim(page, 1 / 30);
}

/** Answer whatever help offer is up (main.js OfferCard): 'yes', 'no', 'never'. Returns its kind or null. */
export async function answerOffer(page, k = 'no') {
  return page.evaluate((k) => { const o = window.game.offer; if (!o) return null; const kind = o.kind; o.answer(k); return kind; }, k);
}

/** Where a board point (x, z) is on the screen (for real mouse clicks). */
export async function screenOf(page, x, z, y = 0) {
  return page.evaluate(([x, z, y]) => {
    const G = window.game, r = G.current.runner || G.current.puzzles?.runner;
    const v = r.camera.position.clone().set(x, y, z).project(r.camera);
    const rect = G.renderer.domElement.getBoundingClientRect();
    return { x: rect.left + ((v.x + 1) / 2) * rect.width, y: rect.top + ((1 - v.y) / 2) * rect.height };
  }, [x, z, y]);
}

/** The best scores in the profile's save (and as stored in localStorage, to be sure they were written). */
export async function bests(page) {
  return page.evaluate(() => {
    const G = window.game, P = G.roster.progress.arcade?.best || {};
    const raw = JSON.parse(localStorage.getItem(`couch-party.solo.${G.solo.profile.id}`) || '{}');
    return { mem: P, stored: raw.progress?.arcade?.best || {} };
  });
}

export { sim, press, island };
