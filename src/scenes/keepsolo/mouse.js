import * as THREE from 'three';

// Mouse for Pillow Keep Solo only (no other game listens to it): the scene makes one Mouse when it
// starts and detaches it in dispose(), so the island and the other games never see mouse events.
//
// The state is read once per frame (like the keyboard in core/input.js): x, y in CSS pixels, the
// held buttons (left, right), the presses and releases since the last frame (leftPressed,
// rightPressed, leftReleased, rightReleased), the wheel steps and the modifier keys. A press and a
// release inside one frame still counts as a press (a quick click is never lost).
//
// The gamepad (and a keyboard player without a mouse) can drive the same pointer in the panels:
// drive(d, dt) moves it with the stick, [A] is a left click and [C] a right click (see the panels).

const PLANE = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const _ray = new THREE.Raycaster();
const _v2 = new THREE.Vector2();
const _v3 = new THREE.Vector3();

export class Mouse {
  constructor() {
    this.x = window.innerWidth / 2;
    this.y = window.innerHeight / 2;
    this.left = false; this.right = false;
    this.leftPressed = false; this.rightPressed = false;
    this.leftReleased = false; this.rightReleased = false;
    this.wheel = 0; // + = zoom out (wheel down), - = zoom in
    this.shift = false; this.ctrl = false; this.alt = false;
    this.used = false; // has a real mouse done anything yet (the HUD shows mouse hints then)
    this.virtual = false; // the stick drives the pointer (panels with a gamepad)
    this.moved = 0;
    this.on = {
      pointermove: (e) => this.move(e),
      pointerdown: (e) => this.down(e),
      pointerup: (e) => this.up(e),
      contextmenu: (e) => e.preventDefault(),
      wheel: (e) => { e.preventDefault(); this.used = true; this.wheel += Math.sign(e.deltaY); },
      keydown: (e) => { this.mods(e); if (e.code === 'AltLeft' || e.code === 'AltRight' || e.code === 'Tab') e.preventDefault(); },
      keyup: (e) => this.mods(e),
      blur: () => { this.left = this.right = false; this.shift = this.ctrl = this.alt = false; },
    };
  }

  attach() {
    for (const [k, f] of Object.entries(this.on)) window.addEventListener(k, f, k === 'wheel' ? { passive: false } : undefined);
  }

  detach() {
    for (const [k, f] of Object.entries(this.on)) window.removeEventListener(k, f);
    document.body.style.cursor = '';
  }

  mods(e) {
    this.shift = e.shiftKey; this.ctrl = e.ctrlKey || e.metaKey; this.alt = e.altKey;
  }

  move(e) {
    this.mods(e);
    if (Math.abs(e.clientX - this.x) + Math.abs(e.clientY - this.y) > 0.5) { this.used = true; this.virtual = false; this.moved++; }
    this.x = e.clientX; this.y = e.clientY;
  }

  down(e) {
    this.move(e);
    this.used = true;
    this.virtual = false;
    // the modifier keys held at the moment of the click (they may be let go before the next frame)
    this.clickShift = e.shiftKey; this.clickCtrl = e.ctrlKey || e.metaKey; this.clickAlt = e.altKey;
    if (e.button === 0) { this.left = true; this.leftPressed = true; }
    if (e.button === 2) { this.right = true; this.rightPressed = true; }
  }

  up(e) {
    this.mods(e);
    if (e.button === 0) { this.left = false; this.leftReleased = true; }
    if (e.button === 2) { this.right = false; this.rightReleased = true; }
  }

  /** Call once per frame after the scene read the mouse. */
  endFrame() {
    this.leftPressed = this.rightPressed = this.leftReleased = this.rightReleased = false;
    this.clickShift = this.clickCtrl = this.clickAlt = false;
    this.wheel = 0;
  }

  /** Stick-driven pointer for menus: move with the stick, [A] = left click, [C] = right click. */
  drive(d, dt) {
    if (!d) return;
    const len = Math.hypot(d.x, d.y);
    if (len > 0.2) {
      this.virtual = true;
      const sp = (380 + 900 * Math.min(1, len)) * dt * Math.min(1, len) * (window.innerHeight / 720);
      this.x = Math.max(4, Math.min(window.innerWidth - 4, this.x + d.x / Math.max(1, len) * sp));
      this.y = Math.max(4, Math.min(window.innerHeight - 4, this.y - d.y / Math.max(1, len) * sp));
    }
    if (d.aPressed) { this.virtual = true; this.leftPressed = true; this.left = true; this.vLeft = true; }
    else if (this.vLeft && !d.a) { this.left = false; this.leftReleased = true; this.vLeft = false; }
    if (d.cPressed) { this.virtual = true; this.rightPressed = true; this.right = true; this.vRight = true; }
    else if (this.vRight && !d.c) { this.right = false; this.rightReleased = true; this.vRight = false; }
  }

  /** Where the pointer meets the floor (y = 0), or null. */
  ground(camera, out = new THREE.Vector3()) {
    _v2.set((this.x / window.innerWidth) * 2 - 1, -(this.y / window.innerHeight) * 2 + 1);
    _ray.setFromCamera(_v2, camera);
    return _ray.ray.intersectPlane(PLANE, out);
  }

  /** The HTML element under the pointer (only elements with pointer-events count). */
  element() {
    return document.elementFromPoint(this.x, this.y);
  }
}

/** Screen position (CSS pixels) of a world point. */
export function toScreen(camera, x, y, z) {
  _v3.set(x, y, z).project(camera);
  return { x: ((_v3.x + 1) / 2) * window.innerWidth, y: ((1 - _v3.y) / 2) * window.innerHeight, behind: _v3.z > 1 };
}
