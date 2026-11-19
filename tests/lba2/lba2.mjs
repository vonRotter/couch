// Shared bits for the odd-adventure round's tests (tests/lba2): the island helper plus a few shortcuts.
// See tests/README.md (start the dev server first; run on a tree nobody edits meanwhile).
export * from '../lively/helper.mjs';
import { island, sim, press } from '../lively/helper.mjs';

/** Hold a key for s seconds of game time (then let go). */
export async function hold(page, code, s) {
  await page.evaluate((code) => window.dispatchEvent(new KeyboardEvent('keydown', { code, key: code, bubbles: true })), code);
  await sim(page, s);
  await page.evaluate((code) => window.dispatchEvent(new KeyboardEvent('keyup', { code, key: code, bubbles: true })), code);
  await sim(page, 1 / 30);
}

/** Close whatever is up (a panel, a dialog, the Today board) the quick way, and stand at (x, z). */
export async function standAt(page, x, z, face = null) {
  await island(page, (I, S, G, [x, z, face]) => {
    if (I.mode !== 'walk') { I.hud.setDialog(null); I.hud.setPanel(null); I.dlg = null; I.mode = 'walk'; }
    const P = I.player;
    P.x = x; P.z = z; P.lx = undefined; P.vx = 0; P.vz = 0;
    I.groundCheck(P, I.walkState);
    if (face) { P.fx = face[0]; P.fz = face[1]; P.ch.face(face[0], face[1]); }
  }, [x, z, face]);
}

/** Walk through a dialog to its end (answering choice `pick` on questions). */
export async function talkThrough(page, pick = 0, max = 12) {
  for (let i = 0; i < max; i++) {
    const st = await island(page, (I) => ({ mode: I.mode, choices: I.dlg?.lines?.[I.dlg.i]?.choices?.length || 0 }));
    if (st.mode !== 'dialog') return;
    if (st.choices) await island(page, (I, S, G, pick) => { I.dlg.choice = pick; }, pick);
    await sim(page, 0.3);
    await press(page, 'KeyE');
  }
}

/** Answer a tutorial's first card ('show' or 'skip') if one is up. */
export async function answerCard(page, k = 'show') {
  await sim(page, 0.2);
  return page.evaluate((k) => { const c = window.game.tutorialCard; if (!c) return false; c.answer(k); return true; }, k);
}

/** Give the odd-adventure round's save part a shape: S.odd with things already arrived (a function body for startIsland's save). */
export const oddSave = (got = {}, extra = {}) => `(S) => { S.odd = Object.assign({ first: 0, last: -1e9, got: ${JSON.stringify(got)}, modes: {}, mode: 'normal' }, ${JSON.stringify(extra)}); }`;
