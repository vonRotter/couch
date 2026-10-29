// A toast queue for the solo island (milestone B3). While an island scene is running it stands in for
// game.ui.toast: at most two pop-ups are visible at a time, each for its own duration, and the queue
// pauses (and hides what is showing) while a full panel is open. Exact duplicates are dropped, and toasts
// with the same group merge into one ("3 letters in the mailbox", "+60 coins", "You got: a, b").
// Timers run on game time (update(dt) from the scene), so they also follow window.game.simulate().
// The shared UI's own toast (used by every co-op game) is put back untouched on dispose().

const MAX_SHOWN = 2;
const MAX_WAITING = 5;

export class ToastQueue {
  constructor(ui) {
    this.ui = ui;
    this.orig = ui.toast;
    this.waiting = [];
    this.shown = [];
    this.paused = false;
    // toast(text, ms, { group, add, fmt }): with a group, `add` joins the group's values and fmt(values)
    // makes the text (e.g. sums coins or lists items).
    ui.toast = (text, ms, opts) => this.push(text, ms, opts);
  }

  push(text, ms = 1600, opts = {}) {
    const { group = null, add, fmt } = opts || {};
    if (group) {
      const same = this.waiting.find((q) => q.group === group);
      if (same) {
        if (add !== undefined) same.vals.push(add);
        same.text = fmt ? fmt(same.vals) : String(text);
        same.ms = Math.max(same.ms, ms);
        return;
      }
    }
    text = String(fmt && add !== undefined ? fmt([add]) : text);
    if (this.shown.some((s) => s.text === text && s.left > ms * 0.5) || this.waiting.some((q) => q.text === text)) return;
    this.waiting.push({ text, ms, group, vals: add !== undefined ? [add] : [] });
    // a long chain: keep the newest few (groups already merged the usual bursts)
    while (this.waiting.length > MAX_WAITING) this.waiting.shift();
  }

  /** Waiting plus visible toasts (for tests). */
  get texts() { return [...this.shown.map((s) => s.text), ...this.waiting.map((q) => q.text)]; }

  setPaused(on) {
    if (on === this.paused) return;
    this.paused = on;
    for (const s of this.shown) {
      s.el.style.display = on ? 'none' : '';
      s.el.style.animationPlayState = on ? 'paused' : 'running';
    }
  }

  update(dt, paused = false) {
    this.setPaused(paused);
    if (this.paused) return;
    for (const s of [...this.shown]) {
      s.left -= dt * 1000;
      if (s.left <= 0) { s.el.remove(); this.shown.splice(this.shown.indexOf(s), 1); }
    }
    while (this.shown.length < MAX_SHOWN && this.waiting.length) {
      const q = this.waiting.shift();
      const el = document.createElement('div');
      el.className = 'toast';
      el.textContent = q.text;
      el.style.animationDuration = `${q.ms}ms`;
      this.ui.toastEl.appendChild(el);
      this.shown.push({ el, text: q.text, left: q.ms });
    }
  }

  clear() {
    for (const s of this.shown) s.el.remove();
    this.shown = [];
    this.waiting = [];
  }

  dispose() {
    this.clear();
    if (Object.prototype.hasOwnProperty.call(this.ui, 'toast')) delete this.ui.toast;
    if (this.ui.toast !== this.orig) this.ui.toast = this.orig;
  }
}
