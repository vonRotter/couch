// Shared helper for the island tests: headless Chromium (playwright) against the dev server.
// Start the server first: npx vite --port 5173 --strictPort (from the repo root). See tests/README.md.
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';

const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = require('playwright-core'); }

export const BASE = process.env.ISLAND_URL || 'http://localhost:5173/';
export const SHOTS = process.env.SHOTS_DIR || '';
export const DAY = 24 * 3600 * 1000;

/** A local date (y, m 1-12, d, hour) in ms. */
export const at = (y, m, d, h = 10, min = 0) => new Date(y, m - 1, d, h, min).getTime();

/** Open the site in a fresh browser page. Console errors are collected in page.errors. */
export async function open({ width = 1280, height = 720, query = '' } = {}) {
  const browser = await pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width, height } });
  page.errors = [];
  page.on('console', (m) => { if (m.type() === 'error') page.errors.push(m.text()); });
  page.on('pageerror', (e) => page.errors.push(String(e && e.stack || e)));
  await page.goto(BASE + query);
  await page.waitForFunction(() => !!window.game && !!window.game.current, null, { timeout: 30000 });
  page.browser = browser;
  return page;
}

export async function close(page) { await page.browser.close(); }

/** Move the island clock to a local date-time (ms). */
export async function setTime(page, ms) {
  await page.evaluate((ms) => { window.__islandTimeOffset = ms - Date.now(); }, ms);
}

/**
 * Start the solo island with a new profile at a date (ms). opts.intro: skip the welcome (default true).
 * opts.save: a function (as a string) run as (S) => {...} on the island save before the island opens.
 * opts.raw: an island save object to start from (an old save, say).
 */
export async function startIsland(page, { time, name = 'Tess', intro = true, save = null, raw = null, settle = 2 } = {}) {
  if (time) await setTime(page, time);
  await page.evaluate(async ({ name, intro, save, raw }) => {
    const P = await import('/src/core/profiles.js');
    const prof = P.createProfile({ name, colorIndex: 1 });
    // prepare the save before the island scene loads it
    const key = P.soloSaveKey(prof.id);
    const progress = {};
    if (raw) progress.island = raw;
    else if (intro || save) {
      const { freshIsland } = await import('/src/scenes/solo/save.js');
      const S = freshIsland();
      if (intro) { S.intro = true; S.tut = 8; S.inv = [{ id: 'zipzap', n: 1, slot: 0 }]; }
      if (save) (0, eval)(`(${save})`)(S);
      progress.island = S;
    }
    localStorage.setItem(key, JSON.stringify({ stars: 0, progress }));
    window.__testProfile = prof;
    window.game.audio.ensure();
    window.game.enterSolo(prof, 'kb0');
  }, { name, intro, save: save ? String(save) : null, raw });
  await page.waitForFunction(() => window.game.current?.constructor?.name === 'SoloIslandScene' && !window.game.switching && window.game.current.player, null, { timeout: 30000 });
  if (settle) await sim(page, settle);
}

/** Run the game for s seconds of game time (no rendering), dt per step. */
export async function sim(page, s, dt = 1 / 30) {
  await page.evaluate(([s, dt]) => window.game.simulate(s, dt), [s, dt]);
}

/** Evaluate a function body with I = the island scene, S = its save, G = window.game. */
export async function island(page, fn, arg) {
  return page.evaluate(([src, arg]) => {
    const I = window.game.current, S = I.save, G = window.game;
    return (0, eval)(`(${src})`)(I, S, G, arg);
  }, [String(fn), arg]);
}

/** Close whatever panel or dialog is up (the Today board, a letter, a line). */
export async function dismiss(page, n = 6) {
  for (let i = 0; i < n; i++) {
    const mode = await island(page, (I) => I.mode);
    if (mode === 'walk') return;
    await press(page, 'KeyE');
    await sim(page, 0.4);
  }
}

/** Press a key for one frame. */
export async function press(page, code) {
  await page.evaluate((code) => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code, key: code, bubbles: true }));
  }, code);
  await sim(page, 1 / 30);
  await page.evaluate((code) => {
    window.dispatchEvent(new KeyboardEvent('keyup', { code, key: code, bubbles: true }));
  }, code);
  await sim(page, 1 / 30);
}

export async function shot(page, name) {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
}

// ---------- a tiny test runner ----------
const results = [];
export async function test(name, fn) {
  const t0 = Date.now();
  try { await fn(); results.push({ name, ok: true }); console.log(`PASS ${name} (${((Date.now() - t0) / 1000).toFixed(1)} s)`); }
  catch (e) { results.push({ name, ok: false, err: e }); console.log(`FAIL ${name}: ${e && e.stack || e}`); }
}
export function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
export function done() {
  const bad = results.filter((r) => !r.ok);
  console.log(`\n${results.length - bad.length}/${results.length} passed`);
  process.exit(bad.length ? 1 : 0);
}
