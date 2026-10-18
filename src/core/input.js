// Unified input: up to 4 keyboard schemes + up to 4 gamepads.
// Every device exposes the same tiny controller: a stick (x, y), button A and button B.
// A few games also use button C; its keys also count as B, so games that ignore C keep working.
// y is +1 for "up".

export const KEYBOARD_SCHEMES = [
  {
    id: 'kb0',
    label: 'WASD',
    hint: 'WASD · Space · Shift',
    up: ['KeyW'], down: ['KeyS'], left: ['KeyA'], right: ['KeyD'],
    a: ['Space'], b: ['ShiftLeft', 'KeyE'], c: ['KeyE'],
    aLabel: 'Space', bLabel: 'Shift', cLabel: 'E',
  },
  {
    id: 'kb1',
    label: 'Arrows',
    hint: 'Arrows · Enter · R-Shift',
    up: ['ArrowUp'], down: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'],
    a: ['Enter'], b: ['ShiftRight', 'ControlRight'], c: ['ControlRight'],
    aLabel: 'Enter', bLabel: 'R-Shift', cLabel: 'R-Ctrl',
  },
  {
    id: 'kb2',
    label: 'IJKL',
    hint: 'IJKL · U · O',
    up: ['KeyI'], down: ['KeyK'], left: ['KeyJ'], right: ['KeyL'],
    a: ['KeyU'], b: ['KeyO', 'KeyP'], c: ['KeyP'],
    aLabel: 'U', bLabel: 'O', cLabel: 'P',
  },
  {
    id: 'kb3',
    label: 'Numpad',
    hint: 'Num 8456 · Num 0 · Num .',
    up: ['Numpad8'], down: ['Numpad5', 'Numpad2'], left: ['Numpad4'], right: ['Numpad6'],
    a: ['Numpad0'], b: ['NumpadDecimal', 'NumpadEnter'], c: ['NumpadEnter'],
    aLabel: 'Num 0', bLabel: 'Num .', cLabel: 'Num Enter',
  },
];

const ALL_CODES = new Set(
  KEYBOARD_SCHEMES.flatMap((s) => [...s.up, ...s.down, ...s.left, ...s.right, ...s.a, ...s.b]),
);

const DEADZONE = 0.28;

function makeDevice(id, type, label, hint) {
  return {
    id, type, label, hint,
    x: 0, y: 0, a: false, b: false, c: false,
    aPressed: false, bPressed: false, cPressed: false,
    prevA: false, prevB: false, prevC: false,
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
      this.devices.set(s.id, makeDevice(s.id, 'keyboard', s.label, s.hint));
    }
    for (let i = 0; i < 4; i++) {
      this.devices.set(`gp${i}`, makeDevice(`gp${i}`, 'gamepad', `Pad ${i + 1}`, 'Stick · A · B'));
    }

    window.addEventListener('keydown', (e) => {
      if (ALL_CODES.has(e.code) || e.code === 'Escape') e.preventDefault();
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
      d.x = (any(s.right) ? 1 : 0) - (any(s.left) ? 1 : 0);
      d.y = (any(s.up) ? 1 : 0) - (any(s.down) ? 1 : 0);
      if (d.x && d.y) { d.x *= Math.SQRT1_2; d.y *= Math.SQRT1_2; }
      // Menu steps count quick taps too, even if the key was released before this frame.
      this.step(d, (tapped(s.right) ? 1 : 0) - (tapped(s.left) ? 1 : 0), (tapped(s.up) ? 1 : 0) - (tapped(s.down) ? 1 : 0));
      const a = any(s.a), b = any(s.b);
      d.aPressed = tapped(s.a) || (a && !d.prevA);
      d.bPressed = tapped(s.b) || (b && !d.prevB);
      d.a = a || d.aPressed;
      d.b = b || d.bPressed;
      d.prevA = a; d.prevB = b;
      const c = any(s.c);
      d.cPressed = tapped(s.c) || (c && !d.prevC);
      d.c = c || d.cPressed;
      d.prevC = c;
    }

    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (let i = 0; i < 4; i++) {
      const d = this.devices.get(`gp${i}`);
      const gp = pads[i];
      if (!gp || !gp.connected) {
        d.connected = false;
        d.x = d.y = 0; d.a = d.b = d.c = d.aPressed = d.bPressed = d.cPressed = false;
        d.stepX = d.stepY = 0;
        continue;
      }
      d.connected = true;
      const btn = (n) => !!gp.buttons[n]?.pressed;
      let x = gp.axes[0] || 0;
      let y = -(gp.axes[1] || 0);
      const mag = Math.hypot(x, y);
      if (mag < DEADZONE) { x = 0; y = 0; } else if (mag > 1) { x /= mag; y /= mag; }
      if (btn(14)) x = -1;
      if (btn(15)) x = 1;
      if (btn(12)) y = 1;
      if (btn(13)) y = -1;
      d.x = x; d.y = y;
      this.step(d, 0, 0);
      const start = btn(9) || btn(8);
      if (start && !d.prevStart) this.menuPressed = true;
      d.prevStart = start;
      const a = btn(0) || btn(3);
      const b = btn(1) || btn(2) || btn(4) || btn(5) || btn(6) || btn(7);
      d.aPressed = a && !d.prevA;
      d.bPressed = b && !d.prevB;
      d.a = a; d.b = b;
      d.prevA = a; d.prevB = b;
      const c = btn(2) || btn(4) || btn(6); // X, LB, LT
      d.cPressed = c && !d.prevC;
      d.c = c;
      d.prevC = c;
      if (a || b) this.onActivity?.();
    }
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
