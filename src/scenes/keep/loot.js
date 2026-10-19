import * as THREE from 'three';
import { COLORS, toon, basic, sharedGeo } from '../../core/palette.js';
import { darken } from '../../core/character.js';
import { makeStar } from '../../core/world.js';
import { t } from '../../core/i18n.js';
import { esc } from '../../core/ui.js';
import { RARITY_CSS, RARITY_HEX, mesh, sph, rbox, bx, cyl, cone } from './common.js';

// Loot and gear for Pillow Keep, Diablo style but with zero inventory management:
// every drop is a piece of gear with a rarity (white / blue / gold) and a few stats. A player who
// walks over it puts it on only if it is better than what they wear; gear nobody needs turns
// into coins. What you wear shows on your bean (pillow, hat, slippers, cape).

export const SLOTS = ['weapon', 'hat', 'boots', 'cape'];
// One "point" of each stat; an item's score is its stats counted in points.
const UNIT = { dmg: 0.25, rate: 0.06, speed: 0.035, yawn: 0.12, cdr: 0.05 };
const MAIN = { weapon: 'dmg', hat: 'yawn', boots: 'speed', cape: 'cdr' };
const AFFIX = ['dmg', 'rate', 'speed', 'yawn', 'cdr'];
const GOLD_NAMES = 5;

// Class base stats: damage per hit, yawn meter size, cooldowns of [A] and [B].
export const BASE = {
  knight: { dmg: 1.3, yawn: 1.5, cdA: 0.42, cdB: 3.5 },
  archer: { dmg: 1.0, yawn: 1.0, cdA: 0.3, cdB: 3 },
  wizard: { dmg: 1.0, yawn: 1.1, cdA: 0.5, cdB: 5 },
  bard: { dmg: 1.0, yawn: 1.1, cdA: 0.4, cdB: 6 },
};

// Gear colors per rarity: [main, accent, emissive glow].
const LOOK = [
  [0xfff3e6, 0xff9fd0, 0x000000],
  [0x5a9bff, 0xbfe0ff, 0x0a1a40],
  [0xffc93c, 0xff8c42, 0x4a3000],
];
const mainMat = (r) => toon(LOOK[r][0], { emissive: LOOK[r][2] });
const accMat = (r) => toon(LOOK[r][1]);

/** Rarity roll; kind: 'grumble' | 'nest' | 'chest' | 'elite' | 'boss'. */
export function rollRarity(kind, depth) {
  const W = { grumble: [80, 19, 1], nest: [62, 32, 6], chest: [40, 45, 15], elite: [15, 55, 30], boss: [0, 45, 55] }[kind];
  const gold = W[2] + depth * 1.5, blue = W[1] + depth * 2;
  const x = Math.random() * (W[0] + blue + gold);
  return x < gold ? 2 : x < gold + blue ? 1 : 0;
}

/** A fresh piece of gear. */
export function rollItem({ depth, rarity, slot, cls }) {
  const P = 1 + depth * 0.9 + rarity * 1.2 + Math.random() * 0.8;
  const stats = {};
  const main = MAIN[slot];
  stats[main] = UNIT[main] * P * (0.8 + Math.random() * 0.4);
  let suffix = null;
  for (let i = 0; i < rarity; i++) {
    const a = AFFIX[Math.floor(Math.random() * AFFIX.length)];
    const v = UNIT[a] * P * (0.45 + Math.random() * 0.3);
    stats[a] = (stats[a] || 0) + v;
    if (!suffix || v > (stats[suffix] || 0) * 0.5) suffix = a;
  }
  const tier = Math.max(0, Math.min(2, Math.floor((depth + rarity * 0.8 + Math.random() * 1.2) / 2)));
  const item = { slot, cls: slot === 'weapon' ? cls : null, rarity, tier, stats, suffix, gold: Math.floor(Math.random() * GOLD_NAMES) };
  item.score = scoreOf(item);
  item.plus = Math.max(1, Math.round(item.score));
  return item;
}

export function starterWeapon(cls) {
  return { slot: 'weapon', cls, rarity: 0, tier: 0, stats: {}, score: 0, plus: 0, starter: true };
}

export function scoreOf(item) {
  let s = 0;
  for (const k in item.stats) s += item.stats[k] / UNIT[k];
  return s;
}

export function itemName(item) {
  const base = t(item.slot === 'weapon' ? `keep.item.${item.cls}.${item.tier}` : `keep.item.${item.slot}.${item.tier}`);
  if (item.starter) return base;
  if (item.rarity === 0) return t('keep.itemName0', { base, n: item.plus });
  if (item.rarity === 1) return t('keep.itemName1', { base, suf: t(`keep.suf.${item.suffix}`), n: item.plus });
  return t('keep.itemName2', { base, suf: t(`keep.suf.${item.suffix}`), gold: t(`keep.gold.${item.gold}`), n: item.plus });
}

/** Short stat line for the results screen and tests, e.g. "+0.8 bonk, +5% speed". */
export function statLine(item) {
  const parts = [];
  for (const k of AFFIX) {
    const v = item.stats[k];
    if (!v) continue;
    parts.push(k === 'dmg' || k === 'yawn' ? `+${v.toFixed(1)} ${t(`keep.stat.${k}`)}` : `+${Math.round(v * 100)}% ${t(`keep.stat.${k}`)}`);
  }
  return parts.join(', ');
}

// ---------------------------------------------------------------- looks

/** The thing in the bean's hand. */
export function buildWeapon(item) {
  const g = new THREE.Group();
  const r = item.rarity, tier = item.tier;
  const s = 1 + tier * 0.15;
  if (item.cls === 'knight') {
    const pillow = mesh(rbox('pillow', 0.85, 0.26, 0.58, 0.12), mainMat(r), 0.42, 0.05, 0.42);
    pillow.add(mesh(bx('pillowStripe', 0.87, 0.06, 0.6), accMat(r), 0, 0, 0, false));
    if (tier >= 1) for (const sx of [-1, 1]) for (const sz of [-1, 1]) pillow.add(mesh(sph(0.07, 8, 6), accMat(r), sx * 0.43, 0, sz * 0.29, false));
    if (tier >= 2) pillow.add(mesh(sph(0.1, 10, 8), toon(COLORS.gold, { emissive: 0x4a3000 }), 0, 0.14, 0, false));
    pillow.rotation.y = 0.5;
    pillow.scale.setScalar(s);
    g.add(pillow);
  } else if (item.cls === 'archer') {
    const tube = mesh(cyl('blaster', 0.1, 0.1, 0.62), mainMat(r), 0.42, 0, 0.3);
    tube.rotation.x = Math.PI / 2;
    g.add(tube, mesh(sph(0.12), accMat(r), 0.42, 0, 0.64), mesh(bx('grip', 0.1, 0.24, 0.12), toon(0x9b5de5), 0.42, -0.14, 0.12));
    if (tier >= 1) {
      const t2 = mesh(cyl('blaster2', 0.07, 0.07, 0.5), accMat(r), 0.42, 0.15, 0.28);
      t2.rotation.x = Math.PI / 2;
      g.add(t2);
    }
    if (tier >= 2) g.add(mesh(sharedGeo('kScope', () => new THREE.TorusGeometry(0.1, 0.03, 6, 14)), toon(COLORS.gold, { emissive: 0x4a3000 }), 0.42, 0.18, 0.05, false));
    g.scale.setScalar(s);
  } else if (item.cls === 'wizard') {
    const len = 0.75 + tier * 0.25;
    const wand = mesh(cyl(`wand${tier}`, 0.03, 0.035, len, 8), toon(0x8a5a3a), 0.45, 0.15, 0.25);
    wand.rotation.x = 0.7;
    const tipY = 0.15 + Math.cos(0.7) * len / 2, tipZ = 0.25 + Math.sin(0.7) * len / 2;
    const tip = mesh(sharedGeo('kWandTip', () => new THREE.OctahedronGeometry(0.13)), toon(LOOK[r][0], { emissive: r ? LOOK[r][2] : 0x664400 }), 0.45, tipY, tipZ);
    g.add(wand, tip);
    if (tier >= 2) {
      const moon = mesh(sharedGeo('kMoon', () => new THREE.TorusGeometry(0.2, 0.05, 6, 16, Math.PI * 1.3)), toon(COLORS.gold, { emissive: 0x4a3000 }), 0.45, tipY, tipZ);
      g.add(moon);
    }
  } else {
    const body = mesh(sph(0.27), mainMat(r), 0.15, -0.05, 0.42);
    body.scale.set(1, 1.2, 0.45);
    const hole = mesh(sph(0.08), toon(COLORS.ink), 0.15, 0.0, 0.53, false);
    hole.scale.z = 0.3;
    const neck = mesh(bx('luteNeck', 0.08, 0.55, 0.06), toon(0x8a5a3a), 0.33, 0.3, 0.44);
    neck.rotation.z = -0.6;
    g.add(body, hole, neck);
    if (tier >= 1) g.add(mesh(sph(0.06, 8, 6), accMat(r), 0.5, 0.52, 0.44, false));
    if (tier >= 2) {
      const harp = mesh(sharedGeo('kHarp', () => new THREE.TorusGeometry(0.25, 0.04, 6, 16, Math.PI)), toon(COLORS.gold, { emissive: 0x4a3000 }), 0.15, 0.3, 0.42, false);
      g.add(harp);
    }
    g.scale.setScalar(s);
  }
  return g;
}

/** Gear hats sit in the bean's hat slot (instead of the roster hat). */
export function buildHat(item) {
  const g = new THREE.Group();
  const r = item.rarity;
  if (item.tier === 0) {
    // Nightcap with a pom-pom.
    const c = mesh(cone('nightcap2', 0.27, 0.62, 14), mainMat(r), 0.06, 0.24, 0);
    c.rotation.z = -0.45;
    const band = mesh(cyl('capBand2', 0.29, 0.29, 0.09, 14), accMat(r), 0, 0.02, 0, false);
    const pom = mesh(sph(0.09), accMat(r), 0.3, 0.46, 0, false);
    g.add(c, band, pom);
  } else if (item.tier === 1) {
    // Bobble beanie.
    const dome = mesh(sharedGeo('kBeanie', () => new THREE.SphereGeometry(0.33, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2)), mainMat(r), 0, -0.06, 0);
    const fold = mesh(cyl('beanieFold', 0.34, 0.34, 0.1, 16), accMat(r), 0, -0.03, 0, false);
    const pom = mesh(sph(0.12), accMat(r), 0, 0.31, 0, false);
    g.add(dome, fold, pom);
  } else {
    // Teapot helmet, the coziest armor there is.
    const pot = mesh(cyl('teapot', 0.3, 0.34, 0.32, 16), mainMat(r), 0, 0.08, 0);
    const lid = mesh(sharedGeo('kTeaLid', () => new THREE.SphereGeometry(0.28, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2)), mainMat(r), 0, 0.24, 0);
    const knob = mesh(sph(0.07), accMat(r), 0, 0.53, 0, false);
    const spout = mesh(cyl('teaSpout', 0.04, 0.07, 0.3, 8), mainMat(r), 0.36, 0.14, 0, false);
    spout.rotation.z = -0.9;
    const handle = mesh(sharedGeo('kTeaHandle', () => new THREE.TorusGeometry(0.11, 0.035, 6, 12)), accMat(r), -0.34, 0.1, 0, false);
    g.add(pot, lid, knob, spout, handle);
  }
  if (r === 2) {
    const st = makeStar(COLORS.gold);
    st.scale.setScalar(0.18);
    st.position.set(0, item.tier === 0 ? 0.2 : 0.18, 0.3);
    g.add(st);
  }
  return g;
}

/** A cape on the bean's back. */
export function buildCape(item) {
  const g = new THREE.Group();
  const r = item.rarity;
  const capeM = mesh(rbox('cape', 0.7, 0.75, 0.08, 0.04), mainMat(r), 0, 0.2, -0.42);
  capeM.rotation.x = 0.12;
  g.add(capeM, mesh(sph(0.06), toon(COLORS.gold), 0.15, 0.35, -0.47, false), mesh(sph(0.06), toon(COLORS.gold), -0.15, 0.35, -0.47, false));
  if (item.tier >= 1) {
    for (const [x, y] of [[-0.15, 0.1], [0.17, -0.05]]) capeM.add(mesh(bx('capePatch', 0.18, 0.18, 0.1), accMat(r), x, y, -0.01, false));
  }
  if (item.tier >= 2) {
    for (const [x, y] of [[0.1, 0.18], [-0.12, -0.12], [0.2, -0.2]]) {
      const st = makeStar(COLORS.gold);
      st.scale.setScalar(0.12);
      st.position.set(x, y, -0.06);
      st.rotation.y = Math.PI;
      capeM.add(st);
    }
  }
  return g;
}

/** Slippers recolor the bean's feet; better ones get bunny ears or cloud puffs. */
function dressFeet(ch, item, baseColor) {
  for (const f of ch.feet) {
    for (const c of [...f.children]) f.remove(c);
    f.material = item ? mainMat(item.rarity) : toon(darken(baseColor, 0.65));
    if (!item) continue;
    if (item.tier === 1) {
      for (const sx of [-1, 1]) {
        const ear = mesh(sph(0.05, 8, 6), accMat(item.rarity), sx * 0.05, 0.9, 0.35, false);
        ear.scale.set(0.8, 3, 0.6);
        f.add(ear);
      }
    } else if (item.tier === 2) {
      for (const sx of [-1, 1]) f.add(mesh(sph(0.09, 8, 6), toon(COLORS.white), sx * 0.12, 0.2, -0.2, false));
    }
  }
}

/** A small floating model of a drop. */
function dropModel(item) {
  if (item.slot === 'weapon') { const g = buildWeapon(item); g.position.set(-0.3, -0.1, -0.35); const w = new THREE.Group(); w.add(g); w.scale.setScalar(1.3); return w; }
  if (item.slot === 'hat') return buildHat(item);
  if (item.slot === 'cape') { const g = buildCape(item); g.position.z = 0.42; g.position.y = -0.2; return g; }
  const g = new THREE.Group();
  for (const sx of [-1, 1]) {
    const f = mesh(sph(0.16), mainMat(item.rarity), sx * 0.2, 0, 0);
    f.scale.set(1, 0.6, 1.4);
    g.add(f);
  }
  return g;
}

// ---------------------------------------------------------------- scene mixin

/** Methods mixed into KeepScene (they use `this` = the scene). */
export const LootMixin = {
  /** Recompute a player's stats from class, level and gear. */
  recomputeStats(e) {
    const b = BASE[e.cls], L = e.level - 1;
    const g = { dmg: 0, rate: 0, speed: 0, yawn: 0, cdr: 0 };
    for (const slot of SLOTS) { const it = e.gear[slot]; if (it) for (const k in it.stats) g[k] += it.stats[k]; }
    e.st = {
      dmg: b.dmg * (1 + 0.07 * L) + g.dmg,
      rate: Math.min(1.8, 1 + 0.02 * L + g.rate),
      speed: Math.min(1.35, 1 + g.speed),
      maxYawn: b.yawn + 0.04 * L + g.yawn,
      cdr: Math.min(0.5, g.cdr),
    };
  },

  isUpgrade(e, item) {
    if (item.slot === 'weapon' && item.cls !== e.cls) return false;
    const cur = e.gear[item.slot];
    return item.score > (cur ? cur.score : 0) + 0.05;
  },

  /** Put the gear on the bean: weapon in hand, hat, cape, slippers. */
  applyLook(e) {
    e.hand.clear();
    e.hand.add(buildWeapon(e.gear.weapon));
    e.capeSlot.clear();
    if (e.gear.cape) e.capeSlot.add(buildCape(e.gear.cape));
    const ch = e.ch;
    if (e.gear.hat) {
      ch.hatSlot.clear();
      ch.hat = buildHat(e.gear.hat);
      ch.hatSlot.add(ch.hat);
    } else {
      ch.setHat(e.p.hat);
    }
    dressFeet(ch, e.gear.boots, e.p.color);
  },

  equip(e, item) {
    e.gear[item.slot] = item;
    e.found++;
    if (!e.best || item.score > e.best.score) e.best = item;
    this.recomputeStats(e);
    e.yawn = Math.min(e.yawn, e.st.maxYawn - 0.01);
    this.applyLook(e);
    e.ch.squash(1.35);
    this.floater(t('keep.upgrade', { name: itemName(item) }), new THREE.Vector3(e.x, 2.6, e.z), RARITY_CSS[item.rarity], 1.9, true);
    this.confetti.burst(new THREE.Vector3(e.x, 1.2, e.z), 0, { count: 16 + item.rarity * 10, speed: 4, up: 4, colors: [RARITY_HEX[item.rarity], 0xffffff, COLORS.gold], life: 0.9, size: 0.13 });
    this.game.audio.play(item.rarity === 2 ? 'fanfare' : 'star');
  },

  /**
   * Drop `count` pieces of gear at (x, z). Drops lean toward what the team needs: a random
   * player's weakest slot, and weapons for a class someone actually plays.
   */
  dropLoot(x, z, kind, count = 1, forEnt = null) {
    for (let i = 0; i < count; i++) {
      const e = forEnt || this.ents[Math.floor(Math.random() * this.ents.length)];
      const rarity = rollRarity(kind, this.floorIndex);
      let slot = SLOTS[Math.floor(Math.random() * SLOTS.length)];
      if (Math.random() < 0.6) {
        const weakest = [...SLOTS].sort((a, b) => (e.gear[a]?.score || 0) - (e.gear[b]?.score || 0))[0];
        slot = weakest;
      }
      let item = rollItem({ depth: this.floorIndex, rarity, slot, cls: e.cls });
      if (forEnt && !this.isUpgrade(e, item)) {
        // Boss loot is always an upgrade for the player it is meant for.
        item = rollItem({ depth: this.floorIndex + 1, rarity: Math.max(1, rarity), slot, cls: e.cls });
        if (!this.isUpgrade(e, item)) { item.stats[MAIN[slot]] += ((e.gear[slot]?.score || 0) - item.score + 1) * UNIT[MAIN[slot]]; item.score = scoreOf(item); item.plus = Math.max(1, Math.round(item.score)); }
      }
      this.spawnGear(item, x, z);
    }
  },

  spawnGear(item, x, z) {
    const m = new THREE.Group();
    const model = dropModel(item);
    model.position.y += 0.15;
    m.add(model);
    // A Diablo-style light beam in the rarity color.
    const beam = mesh(sharedGeo('kLootBeam', () => new THREE.CylinderGeometry(0.16, 0.3, 3, 10, 1, true)), basic(RARITY_HEX[item.rarity], { transparent: true, opacity: item.rarity ? 0.45 : 0.25, depthWrite: false }), 0, 1.2, 0, false);
    const disc = mesh(sharedGeo('kLootDisc', () => new THREE.CircleGeometry(0.6, 20)), basic(RARITY_HEX[item.rarity], { transparent: true, opacity: 0.35, depthWrite: false }), 0, -0.42, 0, false);
    disc.rotation.x = -Math.PI / 2;
    m.add(beam, disc);
    this.level.add(m);
    const label = this.game.ui.label('label');
    label.style.fontSize = 'clamp(10px, 0.95vw, 15px)';
    label.style.webkitTextStroke = '0.22em #2b2340';
    const it = this.spawnItem('gear', x, z, true, m);
    Object.assign(it, { item, label, labelHtml: '', checkT: 1.2 });
    return it;
  },

  /** Per-frame gear logic: labels, auto-pickup when better, salvage into coins when nobody needs it. */
  updateGear(it, dt, active) {
    it.checkT -= dt;
    const fans = this.ents.filter((e) => this.isUpgrade(e, it.item));
    if (it.checkT <= 0 && !fans.length && active) {
      it.taken = true;
      this.level.remove(it.mesh);
      it.label.remove();
      this.puffs.burst(new THREE.Vector3(it.x, 0.6, it.z), RARITY_HEX[it.item.rarity], { count: 6, size: 0.3, life: 0.5, speed: 2 });
      for (let i = 0; i < 2 + it.item.rarity * 2; i++) this.spawnItem('coin', it.x, it.z, true);
      return;
    }
    const html = `<span style="color:${RARITY_CSS[it.item.rarity]}">${esc(itemName(it.item))}</span>${fans.map((e) => `<span style="color:${e.p.css}"> ●</span>`).join('')}`;
    if (html !== it.labelHtml) { it.label.innerHTML = html; it.labelHtml = html; }
    this.game.ui.place(it.label, new THREE.Vector3(it.x, it.y + 1.0, it.z), this.camera);
    if (!active || it.t < 0.5) return;
    let best = null, bd = 2.6;
    for (const e of fans) {
      if (e.state !== 'walk') continue;
      const d = Math.hypot(e.x - it.x, e.z - it.z);
      if (d < bd) { bd = d; best = e; }
    }
    if (!best) return;
    if (bd < 0.9) {
      it.taken = true;
      this.level.remove(it.mesh);
      it.label.remove();
      this.equip(best, it.item);
    } else {
      // Drift toward the player who would wear it.
      const k = Math.min(1, dt * 5 / bd);
      it.x += (best.x - it.x) * k; it.z += (best.z - it.z) * k;
    }
  },
};
