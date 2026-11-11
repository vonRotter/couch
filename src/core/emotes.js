import * as THREE from 'three';
import { addStrings, t, tFor } from './i18n.js';
import { calmOn } from './assist.js';
import { toon, sharedGeo } from './palette.js';
import { darken } from './character.js';

// Emotes (the owner's emote round): four little ways to say something without words, everywhere you walk
// (the solo island and Shell Isle, the shared island, Pillow Keep Solo's town).
//
// Controls: a gamepad's Y opens a small wheel over your bean (input.js PAD_EXTRA.emote; a pad remap moves it
// like any button); the D-pad or the stick up / right / down / left plays heart / wave / dance / laugh at
// once; Y or B closes it. Keyboard: G opens it (G again closes), the arrow keys, your own walk keys or 1-4
// pick. While the wheel is open the player's input goes to the wheel only (the scene gets NO_INPUT).
//
// The bean: heart (hearts float up), wave (a little mitten waves), dance (a hop, a wiggle and a spin, notes),
// laugh ("ha ha" bubbles and a bounce). Nothing blinks or shakes the camera; with "reduce flashing" on
// (calmOn) the moves are a little softer and there are no sparkles. Not read aloud (it is not story or help).
// Villagers, animals and crab friends nearby react: scenes pass onEmote(player, kind, at) and play the
// same moves on their own characters with play(ch, kind, { small: true }).

export const EMOTES = ['heart', 'wave', 'dance', 'laugh']; // keys 1-4, and the wheel: up, right, down, left
const BY_DIR = { up: 'heart', right: 'wave', down: 'dance', left: 'laugh' };
export const EMOTE_ICON = { heart: '💗', wave: '👋', dance: '💃', laugh: '😄' };
const DUR = { heart: 1.7, wave: 1.5, dance: 1.9, laugh: 1.6 };
const SFX = { heart: 'emoteHeart', wave: 'emoteWave', dance: 'emoteDance', laugh: 'emoteLaugh' };
const ARROWS = { ArrowUp: 'heart', ArrowRight: 'wave', ArrowDown: 'dance', ArrowLeft: 'laugh' };
const DIGITS = ['Digit1', 'Digit2', 'Digit3', 'Digit4'];

/** Input for a player whose wheel is open: nothing moves, nothing is pressed. */
export const NO_INPUT = Object.freeze({
  x: 0, y: 0, a: false, b: false, c: false, aPressed: false, bPressed: false, cPressed: false,
  okPressed: false, backPressed: false, stepX: 0, stepY: 0, btn: {}, btnPressed: {}, type: 'none',
});

addStrings({
  en: {
    'emote.heart': 'Heart', 'emote.wave': 'Wave', 'emote.dance': 'Dance', 'emote.laugh': 'Laugh',
    'emote.closePad': '[EMOTE] / [BACK]: close', 'emote.closeKey': '[EMOTE]: close',
    'emote.ha': 'ha', 'emote.ha2': 'ha ha!', 'emote.hee': 'hee hee',
    'emote.a.chicken': 'cluck cluck!', 'emote.a.cow': 'moo!', 'emote.a.goat': 'meh-eh!', 'emote.a.cat': 'mew!', 'emote.a.crab': 'click click!',
  },
  no: {
    'emote.heart': 'Hjerte', 'emote.wave': 'Vinke', 'emote.dance': 'Danse', 'emote.laugh': 'Le',
    'emote.closePad': '[EMOTE] / [BACK]: lukk', 'emote.closeKey': '[EMOTE]: lukk',
    'emote.ha': 'ha', 'emote.ha2': 'ha ha!', 'emote.hee': 'hi hi',
    'emote.a.chicken': 'klukk klukk!', 'emote.a.cow': 'mø!', 'emote.a.goat': 'mæ-æ!', 'emote.a.cat': 'mjau!', 'emote.a.crab': 'klikk klikk!',
  },
});

// a heart: two round lobes and a point (a flat shape that turns to the camera)
const heartGeo = () => sharedGeo('emoteHeart', () => {
  const s = new THREE.Shape();
  s.moveTo(0, -0.5);
  s.bezierCurveTo(-0.15, -0.35, -0.55, -0.1, -0.5, 0.18);
  s.bezierCurveTo(-0.45, 0.48, -0.08, 0.5, 0, 0.25);
  s.bezierCurveTo(0.08, 0.5, 0.45, 0.48, 0.5, 0.18);
  s.bezierCurveTo(0.55, -0.1, 0.15, -0.35, 0, -0.5);
  return new THREE.ShapeGeometry(s, 10);
});
let heartMats = null;
function heartMat(i) {
  if (!heartMats) {
    heartMats = [0xff5d73, 0xff8fb8, 0xffb3cf].map((c) => {
      const m = new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide, depthWrite: false });
      m.userData.shared = true; // kept for every scene (BaseScene.dispose skips it)
      return m;
    });
  }
  return heartMats[i % heartMats.length];
}

let styled = false;
function addStyle() {
  if (styled) return;
  styled = true;
  const st = document.createElement('style');
  st.id = 'emote-style';
  st.textContent = `
.label.emote-wheel { pointer-events: none; -webkit-text-stroke: 0; width: 13.5em; height: 9.6em; font-size: clamp(11px, 1vw, 15px); }
.emote-wheel .ew-opt { position: absolute; transform: translate(-50%, -50%); background: #fffaf0; border: 3px solid var(--ew, #ff5d73);
  border-radius: 14px; padding: 2px 7px 3px; text-align: center; color: #2b2340; box-shadow: 0 3px 0 rgba(43,35,64,.25); min-width: 4.2em; }
.emote-wheel .ew-opt b { display: block; font-size: 1.9em; line-height: 1.1; }
.emote-wheel .ew-opt span { display: block; font-weight: 700; white-space: nowrap; }
.emote-wheel .ew-opt kbd { font: inherit; font-size: .85em; opacity: .7; white-space: nowrap; }
.emote-wheel .ew-up { left: 50%; top: 14%; } .emote-wheel .ew-down { left: 50%; top: 86%; }
.emote-wheel .ew-left { left: 14%; top: 50%; } .emote-wheel .ew-right { left: 86%; top: 50%; }
.emote-wheel .ew-mid { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); font-size: .85em; font-weight: 700;
  color: #fff; background: rgba(43,35,64,.72); border-radius: 10px; padding: 2px 6px; white-space: nowrap; }
.label.emote-text { pointer-events: none; -webkit-text-stroke: 0; font-weight: 800; font-size: clamp(15px, 1.5vw, 24px); color: #fff; background: var(--ew, #ff9f1c);
  border-radius: 12px; padding: 1px 8px; box-shadow: 0 2px 0 rgba(43,35,64,.3); white-space: nowrap; }
.label.emote-note { pointer-events: none; font-size: clamp(20px, 2vw, 32px); color: var(--ew, #9b5de5); font-weight: 900;
  text-shadow: 0 2px 0 rgba(255,255,255,.8); }`;
  document.head.appendChild(st);
}

const _v = new THREE.Vector3();

/**
 * One scene's emotes: the players' wheels and every emote playing on a character (players, villagers...).
 * scene: the BaseScene (game, scene, camera). onEmote(player, kind, at): somebody emoted (reactions).
 */
export class Emotes {
  constructor(scene, { onEmote = null } = {}) {
    this.host = scene;
    this.onEmote = onEmote;
    this.wheels = new Map(); // player -> { el, ch, open }
    this.fx = new Map(); // character -> playing emote
    this.bits = []; // hearts, notes and "ha ha" bubbles in the air
    this.lastKey = null; // the keyboard player G belongs to (the shared island: whoever moved last)
    addStyle();
  }

  get game() { return this.host.game; }

  isOpen(p) { return !!this.wheels.get(p)?.open; }
  anyOpen() { for (const w of this.wheels.values()) if (w.open) return true; return false; }

  /**
   * One player's emote input this frame (call before the scene reads that player's input).
   * dev: their device; ch: their bean; keys: G and 1-4 are theirs (the solo player, or the keyboard player G
   * belongs to on the shared island); arrows: the arrow keys pick too (not when another player walks with
   * them); can: they may open the wheel now (walking, no panel).
   * Returns true when the input belongs to the wheel this frame: give the player NO_INPUT.
   */
  handle(p, dev, ch, { keys = false, arrows = keys, can = true } = {}) {
    if (!dev) return false;
    let w = this.wheels.get(p);
    const input = this.game.input, pressed = input.pressed;
    const pad = dev.type === 'gamepad';
    const g = keys && pressed.has('KeyG');
    const y = pad && !!dev.btnPressed?.y;
    if (!w?.open) {
      if (!can || !(g || y)) return false;
      if (!w) { w = { el: null, ch, open: false, t: 0 }; this.wheels.set(p, w); }
      w.ch = ch;
      this.openWheel(p, w, pad);
      return true;
    }
    w.ch = ch;
    if (!can) { this.closeWheel(w); return true; }
    // close: Y again or B on a pad, G again on a keyboard
    if (g || y || (pad && dev.backPressed)) { this.closeWheel(w); this.game.audio.play('select'); return true; }
    let kind = null;
    if (dev.stepY > 0) kind = BY_DIR.up;
    else if (dev.stepX > 0) kind = BY_DIR.right;
    else if (dev.stepY < 0) kind = BY_DIR.down;
    else if (dev.stepX < 0) kind = BY_DIR.left;
    if (!kind && keys) {
      if (arrows) for (const [code, k] of Object.entries(ARROWS)) if (pressed.has(code)) kind = k;
      DIGITS.forEach((code, i) => { if (pressed.has(code)) kind = EMOTES[i]; });
    }
    if (kind) {
      this.closeWheel(w);
      this.emote(p, ch, kind);
    }
    return true;
  }

  /** A player plays an emote (from the wheel, or a test): the bean's moves, its sound, and reactions. */
  emote(p, ch, kind) {
    if (!EMOTES.includes(kind) || !ch) return;
    this.play(ch, kind, { css: p?.css });
    this.game.audio.play(SFX[kind]);
    this.onEmote?.(p, kind, ch.group.position);
  }

  openWheel(p, w, pad) {
    if (!w.el) w.el = this.game.ui.label('label emote-wheel');
    const opt = (k, dir, key) => `<div class="ew-opt ew-${dir}"><b>${EMOTE_ICON[k]}</b><span>${t(`emote.${k}`)}</span><kbd>${key}</kbd></div>`;
    const arrows = { up: '↑', right: '→', down: '↓', left: '←' };
    const keyOf = (k, dir) => (pad ? arrows[dir] : `${arrows[dir]} ${EMOTES.indexOf(k) + 1}`);
    w.el.innerHTML = Object.entries(BY_DIR).map(([dir, k]) => opt(k, dir, keyOf(k, dir))).join('')
      + `<div class="ew-mid">${tFor(p, pad ? 'emote.closePad' : 'emote.closeKey')}</div>`;
    w.el.style.setProperty('--ew', p?.css || '#ff5d73');
    w.el.style.display = '';
    w.open = true;
    w.t = 0;
    this.place(w);
    this.game.audio.play('select');
  }

  closeWheel(w) {
    w.open = false;
    if (w.el) w.el.style.display = 'none';
  }

  /** Close every wheel (a panel opened, a scene ends). */
  closeAll() { for (const w of this.wheels.values()) this.closeWheel(w); }

  /** A player left: forget their wheel. */
  drop(p) {
    const w = this.wheels.get(p);
    if (w?.el) w.el.remove();
    this.wheels.delete(p);
  }

  place(w) {
    if (!w.open || !w.el || !w.ch) return;
    _v.copy(w.ch.group.position);
    _v.y += 2.0;
    this.game.ui.place(w.el, _v, this.host.camera);
  }

  /** Every open wheel over its bean; wheels of players standing close slide apart so none hides another. */
  placeAll() {
    const open = [...this.wheels.values()].filter((w) => w.open && w.el && w.ch);
    if (open.length < 2) { for (const w of open) this.place(w); return; }
    const ui = this.game.ui, cam = this.host.camera;
    const z = ui.textScale > 1 ? ui.textScale : 1; // big text zooms .label elements (see UI.place)
    const list = open.map((w) => {
      _v.copy(w.ch.group.position);
      _v.y += 2.0;
      _v.project(cam);
      return { w, x: ((_v.x + 1) / 2) * window.innerWidth / z, y: ((1 - _v.y) / 2) * window.innerHeight / z, off: _v.z > 1, wd: (w.el.offsetWidth || 180) + 6 };
    }).sort((a, b) => a.x - b.x);
    // push neighbours apart until they no longer overlap (a few rounds are plenty for six players)
    for (let k = 0; k < 6; k++) {
      for (let i = 0; i + 1 < list.length; i++) {
        const a = list[i], b = list[i + 1];
        const need = (a.wd + b.wd) / 2 - (b.x - a.x);
        if (need > 0 && Math.abs(a.y - b.y) < (a.w.el.offsetHeight || 130)) { a.x -= need / 2; b.x += need / 2; }
      }
    }
    for (const o of list) {
      o.w.el.style.display = o.off ? 'none' : '';
      o.w.el.style.transform = `translate(${o.x.toFixed(1)}px, ${o.y.toFixed(1)}px) translate(-50%, -100%)`;
    }
  }

  // ---------- the moves ----------

  /**
   * Play an emote on a character (a Character bean, or any model with a group): its moves and the things
   * in the air. small: a reaction (fewer hearts, a shorter dance). css: the colour of its bubbles.
   */
  play(ch, kind, { small = false, css = null } = {}) {
    if (!ch?.group) return;
    const old = this.fx.get(ch);
    if (old) this.stop(ch, old);
    const f = { kind, t: 0, dur: DUR[kind] * (small ? 0.8 : 1), small, css, next: 0, n: 0, bean: !!ch.pivot && ch.yaw !== undefined };
    if (kind === 'wave' && ch.pivot) {
      // a mitten on the bean's free side waves (beans have no arms)
      const arm = new THREE.Group();
      const mitt = new THREE.Mesh(sharedGeo('emoteMitt', () => new THREE.SphereGeometry(0.16, 10, 8)), toon(0xffffff));
      mitt.position.y = -0.34; // hangs at the side, swings up and out to wave
      mitt.scale.set(1, 1.15, 0.8);
      const thumb = new THREE.Mesh(sharedGeo('emoteThumb', () => new THREE.SphereGeometry(0.07, 8, 6)), toon(0xffffff));
      thumb.position.set(0.13, -0.3, 0);
      const cuff = new THREE.Mesh(sharedGeo('emoteCuff', () => new THREE.SphereGeometry(0.1, 8, 6)), toon(darken(ch.color ?? 0xffffff, 0.75)));
      cuff.position.y = -0.18;
      arm.add(mitt, thumb, cuff);
      arm.position.set(-0.42, 0.62, 0.1);
      ch.pivot.add(arm);
      f.arm = arm;
    }
    if (ch.squash) ch.squash(kind === 'laugh' ? 0.85 : 1.15);
    this.fx.set(ch, f);
  }

  /** Is an emote playing on this character? */
  playing(ch) { return this.fx.get(ch)?.kind || null; }

  stop(ch, f = this.fx.get(ch)) {
    if (!f) return;
    if (f.arm) f.arm.removeFromParent();
    if (ch.pivot) { ch.pivot.rotation.z = 0; if (f.kind === 'laugh') ch.pivot.rotation.x = 0; }
    this.fx.delete(ch);
  }

  /** Little hearts at a spot (an animal, a crab): a reaction without a bean. */
  heartsAt(pos, n = 3) {
    for (let i = 0; i < n; i++) this.addHeart(pos, i, 0.55, i * 0.18);
  }

  /** A floating text over a spot ("ha ha", a note): kind 'text' or 'note'. */
  floatText(pos, text, { kind = 'text', css = null, delay = 0, dx = 0 } = {}) {
    const el = this.game.ui.label(`label emote-${kind}`);
    el.textContent = text;
    if (css) el.style.setProperty('--ew', css);
    el.style.display = 'none';
    this.bits.push({ el, pos: pos.clone(), t: -delay, life: 1.1, dx, rise: 1.3 });
  }

  addHeart(pos, i, size = 0.75, delay = 0) {
    const m = new THREE.Mesh(heartGeo(), heartMat(i));
    m.visible = false;
    m.renderOrder = 5;
    this.host.scene.add(m);
    this.bits.push({ mesh: m, pos: pos.clone(), t: -delay, life: 1.3, dx: (i % 2 ? 1 : -1) * (0.25 + (i % 3) * 0.12), rise: 1.6, size });
  }

  /** Every frame, after the characters' own update (the moves add to their pose). */
  update(dt) {
    const calm = calmOn();
    for (const [ch, f] of [...this.fx]) {
      f.t += dt;
      const k = f.t / f.dur;
      if (k >= 1 || !ch.group.parent) { this.stop(ch, f); continue; }
      const head = _v.copy(ch.group.position);
      head.y += ch.pivot ? 1.45 : 1.2;
      const fade = Math.sin(Math.min(1, k * 1.15) * Math.PI); // in and out
      if (f.kind === 'heart') {
        // hearts float up, one after another; the bean sways happily
        const count = f.small ? 2 : 4;
        while (f.n < count && f.t >= f.n * 0.22) { this.addHeart(head, f.n, f.small ? 0.5 : 0.75); f.n++; }
        if (ch.pivot) ch.pivot.rotation.z = Math.sin(f.t * 6) * 0.12 * fade;
      } else if (f.kind === 'wave') {
        if (f.arm) {
          const up = Math.min(1, f.t / 0.2) * Math.min(1, (f.dur - f.t) / 0.2);
          f.arm.rotation.z = -up * (2.55 + Math.sin(f.t * 15) * 0.4);
        }
        if (ch.pivot) ch.pivot.rotation.z = Math.sin(f.t * 8) * 0.05 * fade;
      } else if (f.kind === 'dance') {
        // hops, a wiggle and one smooth spin; little notes
        const sp = calm ? 0.7 : 1;
        if (ch.pivot) {
          ch.pivot.position.y += Math.abs(Math.sin(f.t * Math.PI * 3 * sp)) * 0.32 * fade;
          ch.pivot.rotation.z = Math.sin(f.t * 9 * sp) * 0.22 * fade;
        }
        if (f.bean) ch.group.rotation.y += THREE.MathUtils.smoothstep(k, 0.25, 0.75) * Math.PI * 2;
        else ch.group.position.y += Math.abs(Math.sin(f.t * Math.PI * 3)) * 0.25 * fade;
        const notes = f.small ? 1 : 3;
        while (f.n < notes && f.t >= f.n * 0.45) { this.floatText(head, f.n % 2 ? '♫' : '♪', { kind: 'note', css: f.css, dx: f.n % 2 ? 0.5 : -0.5 }); f.n++; }
      } else if (f.kind === 'laugh') {
        // a giggly bounce and "ha ha" bubbles
        if (ch.pivot) {
          ch.pivot.position.y += Math.abs(Math.sin(f.t * (calm ? 9 : 14))) * 0.1 * fade;
          ch.pivot.rotation.x = -0.12 * fade;
          if (ch.eyes) ch.eyes.scale.y = 0.3; // squinting with joy
        } else ch.group.position.y += Math.abs(Math.sin(f.t * 12)) * 0.1 * fade;
        const lines = f.small ? ['emote.hee'] : ['emote.ha', 'emote.ha2'];
        while (f.n < lines.length && f.t >= f.n * 0.5) { this.floatText(head, t(lines[f.n]), { css: f.css, dx: f.n % 2 ? 0.55 : -0.55 }); f.n++; }
      }
      if (!calm && f.kind === 'heart' && !f.small && f.t < dt * 1.5) this.host.puffs?.burst(head.clone(), 0xffc0d8, { count: 4, size: 0.18, life: 0.5, speed: 1.2 });
    }
    // hearts, notes and bubbles in the air
    const cam = this.host.camera;
    for (const b of this.bits) {
      b.t += dt;
      if (b.t < 0) continue;
      const k = b.t / b.life;
      _v.copy(b.pos);
      _v.x += b.dx * Math.min(1, k * 2) + (b.mesh ? Math.sin(b.t * 5) * 0.12 : 0);
      _v.y += k * b.rise;
      if (b.mesh) {
        b.mesh.visible = k < 1;
        b.mesh.position.copy(_v);
        b.mesh.quaternion.copy(cam.quaternion);
        b.mesh.scale.setScalar(b.size * Math.min(1, k * 5) * (k > 0.7 ? Math.max(0, (1 - k) / 0.3) : 1));
      } else {
        this.game.ui.place(b.el, _v, cam);
        b.el.style.opacity = String(k > 0.65 ? Math.max(0, (1 - k) / 0.35) : 1);
      }
    }
    if (this.bits.some((b) => b.t >= b.life)) {
      this.bits = this.bits.filter((b) => {
        if (b.t < b.life) return true;
        if (b.mesh) b.mesh.removeFromParent(); else b.el.remove();
        return false;
      });
    }
    this.placeAll();
  }

  dispose() {
    for (const [ch, f] of [...this.fx]) this.stop(ch, f);
    for (const b of this.bits) { if (b.mesh) b.mesh.removeFromParent(); else b.el.remove(); }
    this.bits = [];
    for (const w of this.wheels.values()) w.el?.remove();
    this.wheels.clear();
  }
}
