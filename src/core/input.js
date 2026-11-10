// Unified input: up to 4 keyboard schemes + up to 4 gamepads.
// Every device exposes the same tiny controller: a stick (x, y) and buttons A, B and C.
// A is jump / confirm, B is the "use" button, C is the third button. No key counts as two buttons.
// y is +1 for "up". Menus pick with okPressed (A; on a keyboard also the use key) and go back with B:
// a gamepad's B never picks anything in a menu (see README, Controls).

import { keyName, t } from './i18n.js';

export const KEYBOARD_SCHEMES = [
  {
    id: 'kb0',
    label: 'WASD',
    up: ['KeyW'], down: ['KeyS'], left: ['KeyA'], right: ['KeyD'],
    a: ['Space'], b: ['KeyE'], c: ['KeyQ'],
  },
  {
    id: 'kb1',
    label: 'Arrows',
    up: ['ArrowUp'], down: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'],
    a: ['Enter'], b: ['ShiftRight'], c: ['ControlRight'],
  },
  {
    id: 'kb2',
    label: 'IJKL',
    up: ['KeyI'], down: ['KeyK'], left: ['KeyJ'], right: ['KeyL'],
    a: ['KeyU'], b: ['KeyO'], c: ['KeyP'],
  },
  {
    id: 'kb3',
    label: 'Numpad',
    up: ['Numpad8'], down: ['Numpad5', 'Numpad2'], left: ['Numpad4'], right: ['Numpad6'],
    a: ['Numpad0'], b: ['NumpadDecimal'], c: ['NumpadEnter'],
  },
];

// Gamepad buttons by their Xbox name (the standard Gamepad API mapping) and what they are called on each kind.
// Nintendo pads swap the letters: the bottom button is B, the right one A, the left one Y, the top one X.
export const PAD_BUTTONS = { a: 0, b: 1, x: 2, y: 3, lb: 4, rb: 5, lt: 6, rt: 7, view: 8, start: 9, up: 12, down: 13, left: 14, right: 15 };
export const PAD_LABELS = {
  xbox: { a: 'A', b: 'B', x: 'X', y: 'Y', lb: 'LB', rb: 'RB', lt: 'LT', rt: 'RT', start: 'Start', view: 'View' },
  ps: { a: '✕', b: '○', x: '□', y: '△', lb: 'L1', rb: 'R1', lt: 'L2', rt: 'R2', start: 'Options', view: 'Create' },
  nintendo: { a: 'B', b: 'A', x: 'Y', y: 'X', lb: 'L', rb: 'R', lt: 'ZL', rt: 'ZR', start: '+', view: '−' },
};

/**
 * Which gamepad buttons are the game buttons A / B / C (the first one names it in text).
 * 'default' (every co-op game): A jump/confirm, B the "use" button, X the third one.
 * 'island' (the solo island and its dive, set by the scene's padLayout): A jumps, X uses, B is back;
 * the D-pad does not walk there (left/right: hotbar, up: bag, down: journal) and Y is free.
 */
export const PAD_LAYOUTS = {
  default: { a: ['a', 'y'], b: ['b', 'rb', 'rt'], c: ['x', 'lb', 'lt'], dpadMoves: true },
  island: { a: ['a'], b: ['x'], c: ['b'], dpadMoves: false },
};
let layoutNow = 'default';
/** The scene's gamepad layout ('default' | 'island'): main.js sets it every frame from scene.padLayout. */
export function setPadLayout(name) { layoutNow = PAD_LAYOUTS[name] ? name : 'default'; }
export function padLayout() { return layoutNow; }

// Extra things a hint can name ([OK], [BACK], [MENU], [BAG], [JOURNAL], [ITEMS], [TABS], [MAP] in text, see i18n.js).
// [OK] is what picks in a menu: the use key on a keyboard (Space works too), A on a gamepad.
// [BACK] closes the pause menu: Esc on a keyboard, B on a gamepad. [MENU] is the solo island's menu (Q / Start).
// [MAP] is the solo island's map (M / the View button: Create on a PlayStation pad, − on a Nintendo one).
const KEY_EXTRA = { bag: 'Tab', journal: 'F', items: '1–9', tabs: '1–6', back: 'Esc', map: 'M' };
const PAD_EXTRA = { ok: 'a', back: 'b', menu: 'start', tabs: ['lb', 'rb'], map: 'view' };
const DPAD = { bag: 'pad.up', journal: 'pad.down', items: 'pad.leftRight' };

/** What a player presses for 'a' | 'b' | 'c' (or 'ok', 'menu', 'bag', 'journal', 'items', 'tabs') on this device. */
export function buttonLabel(device, btn) {
  if (device.type === 'keyboard') {
    const k = device.keys || device.scheme; // remapped keys ("Help me play"), else the scheme's
    if (btn === 'ok') return keyName(k.b[0]);
    if (btn === 'menu') return keyName(k.c[0]);
    return KEY_EXTRA[btn] ?? keyName(k[btn][0]);
  }
  const names = PAD_LABELS[device.kind] || PAD_LABELS.xbox;
  if (DPAD[btn]) return t(DPAD[btn]);
  const b = PAD_EXTRA[btn] ?? PAD_LAYOUTS[layoutNow][btn]?.[0];
  // a remapped pad: the game's button X is done by the physical button padMap[X]
  const phys = (x) => names[device.padMap?.[x] || x];
  return Array.isArray(b) ? b.map(phys).join('/') : (b && names[b] ? phys(b) : btn.toUpperCase());
}

// Buttons a pad remap may move around (the D-pad, Start and View stay where they are).
export const REMAP_PAD = ['a', 'b', 'x', 'y', 'lb', 'rb', 'lt', 'rt'];
// Keys a keyboard remap may not take: the game's own shortcuts and menu keys.
export const RESERVED_KEYS = new Set(['Escape', 'KeyM', 'KeyN', 'KeyV', 'KeyB', 'KeyG', 'Tab', 'KeyF', 'F9', 'F10',
  'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0', 'BracketLeft', 'BracketRight']);

/**
 * Hold to toggle ("Help me play"): for a button a scene marks as a hold (scene.holdButtons) a tap turns the
 * hold on and the next tap turns it off. Presses still arrive as presses. held(d, 'b') is the held state
 * with that applied, for games that read one hold of a button that is also tapped.
 */
export function held(d, k) {
  if (!d) return false;
  return d.toggle ? !!d.latch?.[k] : !!d[k];
}

/** Guess the controller family from the Gamepad id string. */
export function padKind(id = '') {
  if (/054c|playstation|dualshock|dualsense|wireless controller/i.test(id)) return 'ps';
  if (/057e|nintendo|switch|joy-con|pro controller/i.test(id)) return 'nintendo';
  return 'xbox';
}

const ALL_CODES = new Set(
  KEYBOARD_SCHEMES.flatMap((s) => [...s.up, ...s.down, ...s.left, ...s.right, ...s.a, ...s.b, ...s.c]),
);
/** Every key some scheme moves with or uses (a remap may not steal another scheme's key). */
export function schemeKeyOwner(code) {
  for (const s of KEYBOARD_SCHEMES) for (const k of ['up', 'down', 'left', 'right', 'a', 'b', 'c']) if (s[k].includes(code)) return { id: s.id, k };
  return null;
}

const DEADZONE = 0.28;

function makeDevice(id, type, label, scheme = null) {
  return {
    id, type, label, scheme, kind: type === 'keyboard' ? 'keyboard' : 'xbox',
    x: 0, y: 0, a: false, b: false, c: false,
    aPressed: false, bPressed: false, cPressed: false,
    okPressed: false, backPressed: false, // menus: pick / go back (see update())
    prevA: false, prevB: false, prevC: false,
    btn: {}, btnPressed: {}, // gamepads: every button by name (PAD_BUTTONS), held / pressed this frame
    raw: {}, rawPressed: {}, // gamepads: the physical buttons before a remap (the remap page listens to these)
    keys: null, padMap: null, // "Help me play" remaps (main.js sets them from the player's settings)
    toggle: false, holdKeys: [], latch: {}, // hold to toggle (see held())
    connected: type === 'keyboard',
  };
}

export class Input {
  constructor() {
    this.down = new Set();
    this.pressed = new Set();
    this.escPressed = false;
    this.menuPressed = false;
    this.mutePressed = false;
    this.devices = new Map();
    for (const s of KEYBOARD_SCHEMES) {
      this.devices.set(s.id, makeDevice(s.id, 'keyboard', s.label, s));
    }
    for (let i = 0; i < 4; i++) {
      this.devices.set(`gp${i}`, makeDevice(`gp${i}`, 'gamepad', `Pad ${i + 1}`));
    }

    this.extraCodes = new Set(); // remapped keys (main.js) are the game's keys too
    window.addEventListener('keydown', (e) => {
      if (ALL_CODES.has(e.code) || this.extraCodes.has(e.code) || e.code === 'Escape') e.preventDefault();
      if (e.repeat) return;
      this.down.add(e.code);
      this.pressed.add(e.code);
      if (e.code === 'Escape') { this.escPressed = true; this.menuPressed = true; }
      if (e.code === 'KeyM') this.mutePressed = true;
      this.onActivity?.();
    });
    window.addEventListener('keyup', (e) => {
      this.down.delete(e.code);
    });
    window.addEventListener('blur', () => this.down.clear());
  }

  update() {
    const any = (codes) => codes.some((c) => this.down.has(c));
    const tapped = (codes) => codes.some((c) => this.pressed.has(c));

    for (const s of KEYBOARD_SCHEMES) {
      const d = this.devices.get(s.id);
      const k = d.keys || s; // a remap changes only the three buttons
      d.x = (any(s.right) ? 1 : 0) - (any(s.left) ? 1 : 0);
      d.y = (any(s.up) ? 1 : 0) - (any(s.down) ? 1 : 0);
      if (d.x && d.y) { d.x *= Math.SQRT1_2; d.y *= Math.SQRT1_2; }
      // Menu steps count quick taps too, even if the key was released before this frame.
      this.step(d, (tapped(s.right) ? 1 : 0) - (tapped(s.left) ? 1 : 0), (tapped(s.up) ? 1 : 0) - (tapped(s.down) ? 1 : 0));
      const a = any(k.a), b = any(k.b);
      d.aPressed = tapped(k.a) || (a && !d.prevA);
      d.bPressed = tapped(k.b) || (b && !d.prevB);
      d.a = a || d.aPressed;
      d.b = b || d.bPressed;
      d.prevA = a; d.prevB = b;
      const c = any(k.c);
      d.cPressed = tapped(k.c) || (c && !d.prevC);
      d.c = c || d.cPressed;
      d.prevC = c;
      // keyboards keep picking with jump or use (E) in menus; going back is up to each menu
      d.okPressed = d.aPressed || d.bPressed;
      d.backPressed = false;
      this.toggleHolds(d);
    }

    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (let i = 0; i < 4; i++) {
      const d = this.devices.get(`gp${i}`);
      const gp = pads[i];
      if (!gp || !gp.connected) {
        d.connected = false;
        d.x = d.y = 0; d.a = d.b = d.c = d.aPressed = d.bPressed = d.cPressed = d.okPressed = d.backPressed = false;
        d.btn = {}; d.btnPressed = {}; d.raw = {}; d.rawPressed = {};
        d.stepX = d.stepY = 0;
        continue;
      }
      d.connected = true;
      if (d.padId !== gp.id) { d.padId = gp.id; d.kind = padKind(gp.id); }
      const L = PAD_LAYOUTS[layoutNow];
      // every button by name, and which ones went down this frame
      for (const [name, n] of Object.entries(PAD_BUTTONS)) {
        const on = !!gp.buttons[n]?.pressed;
        d.rawPressed[name] = on && !d.raw[name];
        d.raw[name] = on;
      }
      // a remap: the game's button 'name' is read from the physical button padMap[name]
      for (const name of Object.keys(PAD_BUTTONS)) {
        const on = d.raw[d.padMap?.[name] || name];
        d.btnPressed[name] = on && !d.btn[name];
        d.btn[name] = on;
      }
      const btn = (name) => d.btn[name];
      const any = (names) => names.some(btn);
      let x = gp.axes[0] || 0;
      let y = -(gp.axes[1] || 0);
      const mag = Math.hypot(x, y);
      if (mag < DEADZONE) { x = 0; y = 0; } else if (mag > 1) { x /= mag; y /= mag; }
      if (L.dpadMoves) {
        if (btn('left')) x = -1;
        if (btn('right')) x = 1;
        if (btn('up')) y = 1;
        if (btn('down')) y = -1;
      }
      d.x = x; d.y = y;
      // a D-pad that does not walk still steps through menus
      const P = d.btnPressed;
      this.step(d, L.dpadMoves ? 0 : (P.right ? 1 : 0) - (P.left ? 1 : 0), L.dpadMoves ? 0 : (P.up ? 1 : 0) - (P.down ? 1 : 0));
      const start = btn('start') || btn('view');
      if (start && !d.prevStart) this.menuPressed = true;
      d.prevStart = start;
      const a = any(L.a);
      const b = any(L.b);
      d.aPressed = a && !d.prevA;
      d.bPressed = b && !d.prevB;
      d.a = a; d.b = b;
      d.prevA = a; d.prevB = b;
      const c = any(L.c);
      d.cPressed = c && !d.prevC;
      d.c = c;
      d.prevC = c;
      // menus: A picks, B goes back (never picks), whatever the layout
      d.okPressed = !!P.a || (L.a.includes('y') && !!P.y);
      d.backPressed = !!P.b;
      this.toggleHolds(d);
      if (a || b || c || start) this.onActivity?.();
    }
  }

  /** Hold to toggle: the scene's hold buttons (d.holdKeys) stay held from one tap to the next. */
  toggleHolds(d) {
    if (!d.toggle) { d.latch = {}; return; }
    for (const k of ['a', 'b', 'c']) if (d[`${k}Pressed`]) d.latch[k] = !d.latch[k];
    for (const k of d.holdKeys || []) d[k] = !!d.latch[k];
  }

  /** Forget held toggles (a new scene starts with every hold off). */
  clearLatches() {
    for (const d of this.devices.values()) d.latch = {};
  }

  /** stepX/stepY: -1/0/+1 on the frame a direction is first pushed (for menus and pickers). */
  step(d, tapX, tapY) {
    const dx = d.x > 0.5 ? 1 : d.x < -0.5 ? -1 : 0;
    const dy = d.y > 0.5 ? 1 : d.y < -0.5 ? -1 : 0;
    d.stepX = tapX || (dx !== d.prevDX ? dx : 0);
    d.stepY = tapY || (dy !== d.prevDY ? dy : 0);
    d.prevDX = dx;
    d.prevDY = dy;
  }

  /** Call once per frame after the scene consumed the input. */
  endFrame() {
    this.pressed.clear();
    this.escPressed = false;
    this.menuPressed = false;
    this.mutePressed = false;
  }

  get(id) {
    return this.devices.get(id);
  }

  /** Devices that pressed A this frame. */
  joinRequests() {
    const out = [];
    for (const d of this.devices.values()) if (d.aPressed) out.push(d);
    return out;
  }

  anyAPressed(ids) {
    return ids.some((id) => this.devices.get(id)?.aPressed);
  }
}
