// Helpers for the solo island core tests (tests/island), built on the island helper (tests/lively/helper.mjs).
import { sim, island, press } from '../lively/helper.mjs';

/** Hold a key for s seconds of game time. */
export async function hold(page, code, s) {
  await page.evaluate((code) => window.dispatchEvent(new KeyboardEvent('keydown', { code, key: code, bubbles: true })), code);
  await sim(page, s);
  await page.evaluate((code) => window.dispatchEvent(new KeyboardEvent('keyup', { code, key: code, bubbles: true })), code);
  await sim(page, 1 / 30);
}

/** Put the bean at (x, z) on the ground there, facing (fx, fz), out walking. */
export async function tp(page, x, z, fx = 0, fz = 1) {
  await island(page, (I, S, G, [x, z, fx, fz]) => {
    const P = I.player;
    P.x = x; P.z = z; P.lx = undefined; P.fx = fx; P.fz = fz; P.air = false; P.on = null;
    I.groundCheck(P, I.walkState);
    P.ch.face(fx, fz);
  }, [x, z, fx, fz]);
}

/** Close any panel, dialog or line and stand out walking. */
export async function toWalk(page) {
  for (let i = 0; i < 12; i++) {
    const m = await island(page, (I) => I.mode);
    if (m === 'walk' && !(await island(page, (I) => !!I.dlg))) return;
    if (m === 'dialog') await press(page, 'KeyE');
    else if (m === 'today') await island(page, (I) => { I.hud.setPanel(null); I.mode = 'walk'; });
    else await press(page, 'KeyQ');
    await sim(page, 0.35);
  }
}

/** The text of what [E] would do right now ('' when nothing). */
export async function useText(page) {
  return island(page, (I) => { const ia = I.interactions(); return I.useAction(ia)?.text || ''; });
}

/** Press [E] (use) for one frame and let it settle. */
export async function use(page, s = 0.3) {
  await press(page, 'KeyE');
  await sim(page, s);
}

/** Any raw string keys of the island or the arcade left in the visible text ("isl.x.y", "arc.x"). */
export async function rawKeys(page) {
  return page.evaluate(() => {
    const txt = document.body.innerText;
    return [...new Set(txt.match(/\b(isl|arc|zz|zb|td|ev|lk|gh|spr|hop|cafe|pz|ks|kp|tut|pause|assist|pg|map|jn|fx|sea|dive|coach|pp)\.[a-zA-Z0-9_.]+[a-zA-Z0-9_]/g) || [])];
  });
}
