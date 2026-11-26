// The graphics trial's comparison (tests/graphics/LOG.md): the solo island at fixed spots, seasons and times, the
// same camera for "now" (every look off), each look alone and all four together, at 1280x720 and device scale 2.
// Writes <spot>-<look>.png and index.html (a grid per spot, relative image paths) to GFX_DIR.
//   node tests/graphics/compare.mjs            the screenshots and the page
//   node tests/graphics/compare.mjs --cost     also the relative cost: ms per frame per look (1280x720, scale 1)
//   ONLY=square,beach LOOKS=now,glow           a part of it
// The page's game loop is stopped while shooting (each look draws the same frozen moment).
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { BASE, startIsland, island, sim, setTime, at } from '../lively/helper.mjs';

const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = require('playwright-core'); }

const OUT = process.env.GFX_DIR || path.join(os.tmpdir(), 'couch-gfx');
const COST = process.argv.includes('--cost');
const LOOKS = [
  ['now', []], ['glow', ['glow']], ['life', ['life']], ['light', ['light']], ['mini', ['mini']],
  ['all', ['glow', 'life', 'light', 'mini']],
].filter(([k]) => !process.env.LOOKS || process.env.LOOKS.split(',').includes(k));
const LOOK_NAME = { now: 'Now (all off)', glow: 'Glow and colour', life: 'Living world', light: 'Softer light', mini: 'Miniature look', all: 'All four' };

// Seasons are one real week each (calendar.js): the week of 2026-11-09 is spring, 11-16 summer, 11-23 autumn,
// 11-30 winter. Weekdays (no festival); a day that turns out rainy moves on a day (tryDays).
// bean: where the bean stands; cam: a fixed view { pos, look } relative to the bean (null: the island's own camera);
// npc: a villager next to the bean.
const SPOTS = [
  { id: 'square', name: 'The village square, spring morning', days: [[2026, 11, 10], [2026, 11, 11], [2026, 11, 12]], hour: 8.6, bean: [12, -1.5] },
  { id: 'beach', name: 'The beach, summer day', days: [[2026, 11, 17], [2026, 11, 18], [2026, 11, 19]], hour: 13, bean: [16, 40.5], cam: { pos: [-2, 8.5, -10], look: [0, 0, 6] } },
  { id: 'lighthouse', name: 'The lighthouse, autumn evening', days: [[2026, 11, 24], [2026, 11, 25], [2026, 11, 26]], hour: 19.2, bean: [39.5, 33], cam: { pos: [-6, 3, 14], look: [3, 4.5, -8] } },
  { id: 'cottage', name: 'The cottage, winter night', days: [[2026, 12, 1], [2026, 12, 2], [2026, 12, 3]], hour: 22, bean: [-11, -10.2] },
  { id: 'close', name: 'Close: the bean and a villager (rim light, name tag)', days: [[2026, 11, 17], [2026, 11, 18], [2026, 11, 19]], hour: 17.2, bean: [7.5, -5], npc: 'hazel', cam: { pos: [0.4, 2.4, 5.4], look: [0.6, 0.9, 0] } },
];

async function openPage(scale) {
  const browser = await pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: scale });
  const page = await ctx.newPage();
  page.errors = [];
  page.on('console', (m) => { if (m.type() === 'error') page.errors.push(m.text()); });
  page.on('pageerror', (e) => page.errors.push(String(e && e.stack || e)));
  await page.goto(BASE + '?gfx=none');
  await page.waitForFunction(() => !!window.game && !!window.game.current, null, { timeout: 30000 });
  page.browser = browser;
  return page;
}

/** Put the island in the spot's moment, then stop the game loop (the picture stays still). */
async function setUp(page, spot) {
  // a dry day of the spot's season
  let day = spot.days[0];
  for (const d of spot.days) {
    await setTime(page, at(...d, Math.floor(spot.hour), Math.round((spot.hour % 1) * 60)));
    await sim(page, 0.5, 0.1);
    day = d;
    if (!(await island(page, (I) => I.seasons.rainy))) break;
  }
  await island(page, (I, S, G, sp) => {
    G.loopStopped = false;
    if (I.mode !== 'walk') { I.hud.setDialog?.(null); I.hud.setPanel?.(null); I.dlg = null; I.mode = 'walk'; }
    const P = I.player;
    P.x = sp.bean[0]; P.z = sp.bean[1];
    I.groundCheck(P, I.walkState);
    I.camView = null;
    // a fixed view of its own (set before the settling: the see-through around the bean is off with one, island.js)
    if (sp.cam) {
      const V = I.camera.position.constructor;
      I.camView = { pos: new V(P.x + sp.cam.pos[0], P.y + sp.cam.pos[1], P.z + sp.cam.pos[2]), look: new V(P.x + sp.cam.look[0], P.y + sp.cam.look[1], P.z + sp.cam.look[2]) };
    }
  }, spot);
  await sim(page, 1.5, 1 / 30);
  return island(page, (I, S, G, sp) => {
    const P = I.player;
    // the Today board (a new day) or a line that opened meanwhile: closed
    if (I.mode !== 'walk') { I.hud.setDialog?.(null); I.hud.setPanel?.(null); I.dlg = null; I.mode = 'walk'; }
    if (sp.npc) {
      const n = I.npcs.find((q) => q.id === sp.npc);
      Object.assign(n, { busy: true, route: [], inside: false, wantIn: false, away: false, sleep: false, doorAnim: null });
      n.x = P.x + 1.25; n.z = P.z - 0.2;
      // the bean looks at the villager, the villager at the bean (updateNpcs: close by, idle)
      P.ch.face?.(1, 0);
    }
    // a still moment: the game loop stops (the next frame it would draw is skipped), a frame is stepped by hand
    G.loop = () => {};
    G.loopStopped = true;
    G.simulate(1 / 30, 1 / 30);
    if (sp.cam) {
      I.updateCamera(0);
      I.camera.updateMatrixWorld(); // (the labels project with it before the next draw)
      I.updateLabels();
    }
    if (sp.npc) { I.updateNpcs(0); I.camera.updateMatrixWorld(); I.updateLabels(); }
    const n = sp.npc && I.npcs.find((q) => q.id === sp.npc);
    return { season: I.seasons.season, rainy: I.seasons.rainy, hour: I.hour, mode: I.mode, tag: n ? `${n.tag.style.display}|${n.tag.style.transform}` : undefined };
  }, spot).then((r) => ({ ...r, day }));
}

/** Draw the frozen moment with these looks (twice: the first also compiles what changed). */
async function draw(page, list) {
  await page.evaluate((list) => {
    const G = window.game, I = G.current;
    G.gfx.trial(list);
    I.look?.update(0);
    I.render(G.renderer);
    I.look?.update(0);
    I.render(G.renderer);
  }, list);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await page.evaluate(() => { const G = window.game; G.current.render(G.renderer); });
}

/** ms per frame (the GPU work waited for with a 1-pixel read) over n frames, after warm-up frames. */
async function cost(page, list, n = 12) {
  return page.evaluate(async ([list, n]) => {
    const G = window.game, I = G.current, gl = G.renderer.getContext();
    G.gfx.trial(list);
    const px = new Uint8Array(4);
    const frame = (dt) => { I.look?.update(dt); I.render(G.renderer); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); };
    for (let i = 0; i < 4; i++) frame(1 / 60);
    const t0 = performance.now();
    for (let i = 0; i < n; i++) frame(1 / 60);
    return (performance.now() - t0) / n;
  }, [list, n]);
}

fs.mkdirSync(OUT, { recursive: true });
const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
const spots = SPOTS.filter((s) => !only || only.includes(s.id));
const meta = [];
const page = await openPage(2);
await startIsland(page, { time: at(...spots[0].days[0], 10), save: (S) => { S.unlocks.greenhouse = true; S.unlocks.barn = true; S.unlocks.bridge = true; } });
for (const spot of spots) {
  // a fresh start per spot (the stopped loop and the frozen moment are per page): reload and open the island again
  if (meta.length) {
    await page.goto(BASE + '?gfx=none');
    await page.waitForFunction(() => !!window.game && !!window.game.current, null, { timeout: 30000 });
    await startIsland(page, { time: at(...spot.days[0], 10), save: (S) => { S.unlocks.greenhouse = true; S.unlocks.barn = true; S.unlocks.bridge = true; } });
  }
  const info = await setUp(page, spot);
  console.log(`${spot.id}: ${JSON.stringify(info)}`);
  const shots = [];
  for (const [k, list] of LOOKS) {
    await draw(page, list);
    const file = `${spot.id}-${k}.png`;
    await page.screenshot({ path: path.join(OUT, file) });
    shots.push({ k, file });
    console.log(`  ${file}`);
  }
  meta.push({ spot, info, shots });
}
if (page.errors.length) console.log('console errors:\n' + page.errors.join('\n'));
await page.browser.close();

let costs = null;
if (COST) {
  // relative cost: SwiftShader (software) at 1280x720, scale 1; real devices differ, the ratios are what counts
  const cp = await openPage(1);
  await startIsland(cp, { time: at(2026, 11, 24, 19, 12) });
  costs = {};
  for (const spot of spots.filter((s) => s.id === 'square' || s.id === 'lighthouse')) {
    await setUp(cp, spot);
    costs[spot.id] = {};
    for (const [k, list] of LOOKS) costs[spot.id][k] = await cost(cp, list);
    console.log(`cost ${spot.id}: ${Object.entries(costs[spot.id]).map(([k, v]) => `${k} ${v.toFixed(1)} ms`).join(', ')}`);
    await cp.goto(BASE + '?gfx=none');
    await cp.waitForFunction(() => !!window.game && !!window.game.current, null, { timeout: 30000 });
    await startIsland(cp, { time: at(2026, 11, 24, 19, 12) });
  }
  if (cp.errors.length) console.log('console errors (cost):\n' + cp.errors.join('\n'));
  await cp.browser.close();
  fs.writeFileSync(path.join(OUT, 'cost.json'), JSON.stringify(costs, null, 1));
}

// the page: one grid per spot, "now" first
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Graphics trial</title>
<style>
:root { --bg: #f7f4ee; --fg: #2b2340; --card: #fff; --muted: #6a6280; }
@media (prefers-color-scheme: dark) { :root { --bg: #17141f; --fg: #eee9f6; --card: #221e2d; --muted: #a59fb8; } }
body { margin: 0; padding: 16px; background: var(--bg); color: var(--fg); font: 15px/1.45 system-ui, sans-serif; }
h1 { margin: 0 0 4px; } h2 { margin: 28px 0 8px; } p { color: var(--muted); margin: 0 0 8px; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 420px), 1fr)); gap: 12px; }
figure { margin: 0; background: var(--card); border-radius: 10px; overflow: hidden; }
figure img { display: block; width: 100%; height: auto; cursor: zoom-in; }
figcaption { padding: 6px 10px; font-weight: 600; }
a { color: inherit; }
</style></head><body>
<h1>Graphics trial: the solo island</h1>
<p>The same frozen moment and camera per spot: now (every look off), each look alone, and all four. 1280×720 at device scale 2. Click a picture for full size.</p>
${costs ? `<p>Relative cost (software rendering, 1280×720, ms per frame; only the ratios mean anything): ${Object.entries(costs).map(([s, c]) => `${esc(s)}: ${Object.entries(c).map(([k, v]) => `${esc(LOOK_NAME[k])} ${v.toFixed(0)}`).join(', ')}`).join(' · ')}</p>` : ''}
${meta.map(({ spot, info, shots }) => `<h2>${esc(spot.name)}</h2><p>${esc(info.day.join('-'))} ${String(Math.floor(info.hour)).padStart(2, '0')}:${String(Math.round((info.hour % 1) * 60)).padStart(2, '0')} · ${esc(info.season)}${info.rainy ? ' · rainy' : ''}</p>
<div class="grid">${shots.map((s) => `<figure><a href="${s.file}"><img src="${s.file}" alt="${esc(spot.name)}: ${esc(LOOK_NAME[s.k])}" loading="lazy"></a><figcaption>${esc(LOOK_NAME[s.k])}</figcaption></figure>`).join('')}</div>`).join('\n')}
</body></html>`;
fs.writeFileSync(path.join(OUT, 'index.html'), html);
console.log(`\n${path.join(OUT, 'index.html')}`);
process.exit(page.errors.length ? 1 : 0);
