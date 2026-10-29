import * as THREE from 'three';
import { toon } from '../../core/palette.js';
import { CROPS, WET_MS } from './items.js';
import { FIELD, GREEN, heightAt } from './map.js';
import { mesh, box, cyl, makeCrop } from './models.js';
import { now } from './save.js';

// The home farm: a grid of tiles next to the cottage. Grass (maybe with weeds) -> tilled -> planted.
// Crops grow in REAL time, but only while the soil is wet (one watering lasts WET_MS). Dry crops simply
// wait; nothing ever wilts or dies. Saved per tile in save.tiles["c,r"].
// Milestone B3: a second small field, the greenhouse beds (saved as "gc,r", f = 1), and things that stand
// on a tile (tile.obj): a sprinkler keeps its 8 neighbours wet all the time, a scarecrow sometimes finds an
// extra crop at harvest for the tiles around it.

const SOIL = 0xa8703f, SOIL_WET = 0x6e4a2c;
export const FIELDS = [FIELD, GREEN];
export const tileKey = (c, r, f = 0) => (f ? `g${c},${r}` : `${c},${r}`);
export function parseKey(k) {
  const g = k[0] === 'g';
  const [c, r] = (g ? k.slice(1) : k).split(',').map(Number);
  return { c, r, f: g ? 1 : 0 };
}

export function tileCenter(c, r, f = 0) {
  const F = FIELDS[f];
  return { x: F.x0 + (c + 0.5) * F.size, z: F.z0 + (r + 0.5) * F.size };
}

/** The tile at a point: { c, r, f, key } (f = 0 the field, 1 the greenhouse beds), or null. */
export function tileAt(x, z, greenhouse = true) {
  for (let f = 0; f < FIELDS.length; f++) {
    if (f === 1 && !greenhouse) continue;
    const F = FIELDS[f];
    const c = Math.floor((x - F.x0) / F.size), r = Math.floor((z - F.z0) / F.size);
    if (c < 0 || r < 0 || c >= F.cols || r >= F.rows) continue;
    return { c, r, f, key: tileKey(c, r, f) };
  }
  return null;
}

/** Add the wet time between tile.last and now to the crop's growth (clock-safe). */
export function grow(tile, at, sprinkled = false) {
  if (!tile.crop) { tile.last = at; return; }
  const total = CROPS[tile.crop].grow;
  if (tile.wetUntil > at + WET_MS) tile.wetUntil = at + WET_MS; // the clock went backwards
  const last = tile.last ?? at;
  if (at > last) {
    const wetEnd = sprinkled ? at : Math.min(tile.wetUntil || 0, at); // a sprinkler never lets it dry
    if (wetEnd > last) tile.growth = Math.min(total, (tile.growth || 0) + (wetEnd - last));
  }
  tile.last = at;
}

export function stageOf(tile) {
  if (!tile.crop) return -1;
  const g = (tile.growth || 0) / CROPS[tile.crop].grow;
  return g >= 1 ? 3 : g >= 0.5 ? 2 : g >= 0.12 ? 1 : 0;
}

/** Minutes until ripe if kept wet (for the little hover hint). */
export function minutesLeft(tile) {
  if (!tile.crop) return 0;
  return Math.max(0, Math.ceil((CROPS[tile.crop].grow - (tile.growth || 0)) / 60000));
}

export class Farm {
  constructor(scene, save) {
    this.scene = scene;
    this.save = save;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.views = new Map();
    // the weedy start: a few tiles have weeds to cut with the scythe
    if (!save.weeds) save.weeds = ['1,1', '4,0', '6,2', '2,4', '5,4', '7,5', '0,3'];
    this.objModel = null; // set by the island: sprinkler and scarecrow models
    this.soilDry = toon(SOIL);
    this.soilWet = toon(SOIL_WET);
    this.highlight = mesh(box(FIELD.size * 0.96, 0.05, FIELD.size * 0.96), toon(0xffffff, { transparent: true, opacity: 0.45 }), 0, 0, 0, false);
    this.highlight.visible = false;
    scene.add(this.highlight);
    for (let c = 0; c < FIELD.cols; c++) for (let r = 0; r < FIELD.rows; r++) this.refresh(c, r);
    for (const k of Object.keys(save.tiles)) { const p = parseKey(k); if (p.f) this.refresh(p.c, p.r, now(), p.f); }
  }

  tile(c, r, f = 0) { return this.save.tiles[tileKey(c, r, f)] || null; }
  hasWeed(c, r, f = 0) { return !f && this.save.weeds.includes(tileKey(c, r)); }

  /** Rebuild the look of one tile from the save. */
  refresh(c, r, at = now(), f = 0) {
    const k = tileKey(c, r, f);
    let v = this.views.get(k);
    const { x, z } = tileCenter(c, r, f);
    const y = heightAt(x, z) + 0.02;
    if (!v) {
      v = { soil: null, plant: null, weed: null, stage: -2, crop: null, wet: null, obj: null, objId: null };
      this.views.set(k, v);
    }
    const t = this.save.tiles[k];
    const soil = t && !t.grass;
    if (soil && !v.soil) {
      v.soil = mesh(box(FIELDS[f].size * 0.92, 0.12, FIELDS[f].size * 0.92), this.soilDry, x, y + 0.04, z, false);
      // furrows
      for (const dz of [-0.3, 0, 0.3]) v.soil.add(mesh(box(FIELDS[f].size * 0.8, 0.04, 0.08), toon(0x8a5a32), 0, 0.07, dz, false));
      this.group.add(v.soil);
    } else if (!soil && v.soil) { v.soil.removeFromParent(); v.soil = null; }
    if (v.soil) {
      const wet = t.wetUntil > at;
      if (wet !== v.wet) { v.soil.material = wet ? this.soilWet : this.soilDry; v.wet = wet; }
    }
    // a sprinkler or scarecrow standing on the tile
    const objId = t?.obj || null;
    if (objId !== v.objId) {
      if (v.obj) v.obj.removeFromParent();
      v.obj = objId && this.objModel ? this.objModel(objId) : null;
      if (v.obj) { v.obj.position.set(x, y + 0.05, z); this.group.add(v.obj); }
      v.objId = v.obj || !objId ? objId : null; // try again once the models are there
    }
    const weed = this.hasWeed(c, r, f);
    if (weed && !v.weed) {
      v.weed = new THREE.Group();
      for (let i = 0; i < 4; i++) {
        const b = mesh(cyl(0, 0.08, 0.45, 3), 0x5f9a2a, (i % 2 - 0.5) * 0.35, 0.22, (Math.floor(i / 2) - 0.5) * 0.3, false);
        b.rotation.z = (i - 1.5) * 0.25;
        v.weed.add(b);
      }
      v.weed.add(mesh(cyl(0.2, 0.25, 0.12, 7), 0x6b9a3a, 0, 0.06, 0, false));
      v.weed.position.set(x, y, z);
      this.group.add(v.weed);
    } else if (!weed && v.weed) { v.weed.removeFromParent(); v.weed = null; }
    const st = t ? stageOf(t) : -1;
    if (st !== v.stage || (t?.crop || null) !== v.crop) {
      if (v.plant) v.plant.removeFromParent();
      v.plant = null;
      if (st >= 0) {
        v.plant = makeCrop(t.crop, st);
        v.plant.position.set(x, y + 0.1, z);
        v.plant.rotation.y = (c * 7 + r * 3) % 6;
        this.group.add(v.plant);
      }
      v.stage = st;
      v.crop = t?.crop || null;
      v.pop = 1; // little grow pop
    }
  }

  /** Keys of the tiles a sprinkler waters (its 8 neighbours in the same field). */
  sprinkled() {
    const out = new Set();
    for (const [k, t] of Object.entries(this.save.tiles)) {
      if (t.obj !== 'sprinkler') continue;
      const { c, r, f } = parseKey(k);
      for (let dc = -1; dc <= 1; dc++) for (let dr = -1; dr <= 1; dr++) if (dc || dr) out.add(tileKey(c + dc, r + dr, f));
    }
    return out;
  }

  /** Is a scarecrow within two tiles of this one? */
  nearScarecrow(c, r, f = 0) {
    for (let dc = -2; dc <= 2; dc++) for (let dr = -2; dr <= 2; dr++) if (this.tile(c + dc, r + dr, f)?.obj === 'scarecrow') return true;
    return false;
  }

  /** Grow everything up to `at` and refresh the visuals (called about once a second). */
  tick(at) {
    const wet = this.sprinkled();
    for (const [k, t] of Object.entries(this.save.tiles)) {
      const sp = wet.has(k);
      grow(t, at, sp);
      if (sp) t.wetUntil = Math.max(t.wetUntil || 0, at + WET_MS);
      const { c, r, f } = parseKey(k);
      this.refresh(c, r, at, f);
    }
  }

  /** Animate (pops, the star fruit spin) every frame. */
  animate(dt, time) {
    for (const v of this.views.values()) {
      if (v.obj?.userData.spin) v.obj.userData.spin.rotation.y += dt * 3;
      if (!v.plant) continue;
      if (v.pop > 0) {
        v.pop = Math.max(0, v.pop - dt * 3);
        const s = 1 + Math.sin(v.pop * Math.PI) * 0.35;
        v.plant.scale.set(s, s, s);
      }
      if (v.stage === 3) {
        v.plant.rotation.z = Math.sin(time * 2 + v.plant.position.x) * 0.05;
        if (v.plant.userData.spin) v.plant.userData.spin.rotation.y += dt * 1.5;
      }
    }
  }

  showHighlight(tile, color) {
    if (!tile) { this.highlight.visible = false; return; }
    const { x, z } = tileCenter(tile.c, tile.r, tile.f || 0);
    this.highlight.visible = true;
    this.highlight.position.set(x, heightAt(x, z) + 0.2, z);
    this.highlight.material = toon(color, { transparent: true, opacity: 0.45 });
  }

  // ---------- actions (return a result key for feedback, or null if nothing happened) ----------

  till(c, r, at, f = 0) {
    if (this.hasWeed(c, r, f)) return 'weedFirst';
    const t = this.tile(c, r, f);
    if (t && !t.grass) return null;
    if (t) delete t.grass; // grass under a sprinkler or scarecrow
    else this.save.tiles[tileKey(c, r, f)] = { crop: null, growth: 0, wetUntil: 0, last: at };
    this.refresh(c, r, at, f);
    return 'tilled';
  }

  plant(c, r, crop, at, f = 0) {
    const t = this.tile(c, r, f);
    if (!t || t.grass) return 'tillFirst';
    if (t.crop || t.obj) return null;
    t.crop = crop;
    t.growth = 0;
    t.last = at;
    this.refresh(c, r, at, f);
    return 'planted';
  }

  water(c, r, at, f = 0) {
    const t = this.tile(c, r, f);
    if (!t || t.grass) return null;
    grow(t, at);
    t.wetUntil = at + WET_MS;
    this.refresh(c, r, at, f);
    return 'watered';
  }

  cut(c, r, at) {
    const k = tileKey(c, r);
    if (!this.hasWeed(c, r)) return null;
    this.save.weeds = this.save.weeds.filter((w) => w !== k);
    this.refresh(c, r, at);
    return 'cut';
  }

  /** Pick a ripe crop: returns the crop id or null. Regrowing crops go back to their young stage. */
  harvest(c, r, at, f = 0) {
    const t = this.tile(c, r, f);
    if (!t || stageOf(t) !== 3) return null;
    const crop = t.crop, def = CROPS[crop];
    if (def.regrow) t.growth = def.grow - def.regrow;
    else { t.crop = null; t.growth = 0; }
    t.last = at;
    this.refresh(c, r, at, f);
    return crop;
  }

  /** Put a sprinkler or scarecrow on an empty tile (grass or soil). */
  placeObj(c, r, id, at, f = 0) {
    if (this.hasWeed(c, r, f)) return false;
    const t = this.tile(c, r, f);
    if (t && (t.crop || t.obj)) return false;
    if (t) t.obj = id;
    else this.save.tiles[tileKey(c, r, f)] = { crop: null, growth: 0, wetUntil: 0, last: at, obj: id, grass: true };
    this.refresh(c, r, at, f);
    return true;
  }

  /** Take it back: returns its id. Grass tiles go back to plain grass. */
  takeObj(c, r, at, f = 0) {
    const k = tileKey(c, r, f), t = this.save.tiles[k];
    if (!t?.obj) return null;
    const id = t.obj;
    delete t.obj;
    if (t.grass) delete this.save.tiles[k];
    this.refresh(c, r, at, f);
    return id;
  }

  dispose() {
    this.group.removeFromParent();
    this.highlight.removeFromParent();
  }
}
