import { sizeOf } from './items.js';

// Diablo-style item grids (the bag and the stash): items take w x h cells (items.js sizeOf).
// A grid is a list of entries { it, x, y } (x, y = the top-left cell) plus its size; the list is what
// gets saved. Nothing here touches the DOM.

export class Grid {
  constructor(list, w, h) {
    this.list = list; // shared with the save (bag / stash arrays)
    this.w = w;
    this.h = h;
  }

  /** The entry covering cell (x, y), or null. */
  at(x, y) {
    for (const e of this.list) {
      const [w, h] = sizeOf(e.it);
      if (x >= e.x && x < e.x + w && y >= e.y && y < e.y + h) return e;
    }
    return null;
  }

  /** Entries an item of size w x h at (x, y) would cover (ignore = an entry to skip). */
  under(x, y, w, h, ignore = null) {
    const out = [];
    for (const e of this.list) {
      if (e === ignore) continue;
      const [ew, eh] = sizeOf(e.it);
      if (x < e.x + ew && x + w > e.x && y < e.y + eh && y + h > e.y) out.push(e);
    }
    return out;
  }

  inside(x, y, w, h) {
    return x >= 0 && y >= 0 && x + w <= this.w && y + h <= this.h;
  }

  fits(it, x, y, ignore = null) {
    const [w, h] = sizeOf(it);
    return this.inside(x, y, w, h) && this.under(x, y, w, h, ignore).length === 0;
  }

  /** First free spot (column by column, like Diablo), or null. */
  spot(it) {
    const [w, h] = sizeOf(it);
    for (let x = 0; x + w <= this.w; x++) for (let y = 0; y + h <= this.h; y++) if (!this.under(x, y, w, h).length) return { x, y };
    return null;
  }

  /** Put an item in the first free spot; returns the entry or null when it does not fit. */
  add(it) {
    const p = this.spot(it);
    if (!p) return null;
    const e = { it, x: p.x, y: p.y };
    this.list.push(e);
    return e;
  }

  place(it, x, y) {
    const e = { it, x, y };
    this.list.push(e);
    return e;
  }

  remove(e) {
    const i = this.list.indexOf(e);
    if (i >= 0) this.list.splice(i, 1);
  }

  find(it) {
    return this.list.find((e) => e.it === it) || null;
  }

  items() {
    return this.list.map((e) => e.it);
  }

  get empty() { return this.list.length === 0; }
}

/** Fill a grid with items (biggest first so they pack well); returns the ones that did not fit. */
export function packInto(grid, items) {
  const left = [];
  const sorted = [...items].sort((a, b) => { const [aw, ah] = sizeOf(a), [bw, bh] = sizeOf(b); return bw * bh - aw * ah; });
  for (const it of sorted) if (!grid.add(it)) left.push(it);
  return left;
}
