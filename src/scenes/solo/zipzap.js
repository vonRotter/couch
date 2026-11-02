import * as THREE from 'three';
import { t } from '../../core/i18n.js';
import { esc } from '../../core/ui.js';
import { say as speak } from '../../core/voice.js';
import { ITEMS, icon } from './items.js';
import { count, give, take, held, now, since, MIN } from './save.js';
import { heightAt, ROCKFALL, PAD } from './map.js';
import { isle2Height } from './isle2geo.js';
import { makeOreRock, makeBigOre, makeChopTree, makeStump, makeScanGlow, makeGadgetBench, decorateRockfall, glowMat } from './models8.js';
import { makeTallGrass } from './models2.js';

// Pip's Zip-Zap (the owner's playtest): ONE gadget instead of the hoe, watering can, scythe and pickaxe.
// It works by target: point it at untilled soil and [B] tills, at dry soil or a thirsty crop it waters, at
// weeds or tall grass it cuts, at an ore rock it breaks (once Keeper Bram has switched on its rock buster),
// at a choppable tree it chops (wood; the tree grows back), at a ripe crop it harvests, at buried treasure
// on Shell Isle it digs. A small icon over the target shows what will happen, every action has its own
// beam color and sound, and the gadget hums and glows in the bean's hand. While you hold it, everything it
// can break, cut or chop nearby glows softly (a scan). Pip's gadget bench by the rocket sells upgrades.
// This module owns the things to break, cut and chop (they used to live in build.js), the beam, the target
// icon, the scan and the bench. The field actions themselves are in island.js (doZap) and farm.js.

/** What the Zip-Zap can do: beam color and the target icon (inline SVG). */
export const ZAP = {
  till: { color: 0xffa94d },
  water: { color: 0x4cc9f0 },
  cut: { color: 0x8ddf4a },
  break: { color: 0xff6fd0 },
  chop: { color: 0xffd23f },
  harvest: { color: 0xff5d73 },
  dig: { color: 0xc9a8ff },
};
const INK = '#2b2340';
const ICONS = {
  till: `<path d="M2.5 18 Q12 7 21.5 18Z" fill="#a8703f" stroke="${INK}" stroke-width="1.3" stroke-linejoin="round"/><path d="M7 16 L9.5 12.5 M11.5 15.5 L13 11 M16 16 L14.6 12.4" stroke="#6e4a2c" stroke-width="1.4" stroke-linecap="round"/><path d="M12 9 V5 M12 6.5 Q9.5 4 8.5 5.5 M12 6 Q14.5 3.5 15.5 5" fill="none" stroke="#3fae4a" stroke-width="1.4" stroke-linecap="round"/>`,
  water: `<path d="M12 2.5 C12 2.5 5 10.5 5 15 a7 7 0 0 0 14 0 C19 10.5 12 2.5 12 2.5Z" fill="#4cc9f0" stroke="${INK}" stroke-width="1.3"/><ellipse cx="9.4" cy="14.5" rx="1.6" ry="2.6" fill="#fff" opacity=".75"/>`,
  cut: `<path d="M5 21 Q6 11 4 5 M10 21 Q10 10 9 3 M15 21 Q14 11 16 4 M20 21 Q19 13 21 7" fill="none" stroke="#3fae4a" stroke-width="2.2" stroke-linecap="round"/><path d="M2 13 L22 11" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-dasharray="3 2"/>`,
  break: `<path d="M3 18 L5 10 L11 6 L18 8 L21 15 L17 20 L7 20Z" fill="#d0935a" stroke="${INK}" stroke-width="1.3" stroke-linejoin="round"/><path d="M11 6.5 L10 11 L13 13 L11.5 19.5" fill="none" stroke="${INK}" stroke-width="1.4"/><path d="M16 11 l1.3 -1.3 1.3 1.3 -1.3 1.3Z" fill="#5ff2ff"/><path d="M6.5 15 l1 -1 1 1 -1 1Z" fill="#ff6fd0"/>`,
  chop: `<rect x="3" y="10" width="15" height="8" rx="4" fill="#c68a52" stroke="${INK}" stroke-width="1.3"/><ellipse cx="18" cy="14" rx="3.2" ry="4" fill="#f0c890" stroke="${INK}" stroke-width="1.2"/><ellipse cx="18" cy="14" rx="1.4" ry="1.8" fill="none" stroke="#9a6440" stroke-width="1"/><path d="M8 4 L10 7 M13 3 L13 7 M18 4 L16 7" stroke="#ffd23f" stroke-width="1.8" stroke-linecap="round"/>`,
  harvest: `<path d="M4 11 H20 L18 20 H6Z" fill="#e2b06a" stroke="${INK}" stroke-width="1.3" stroke-linejoin="round"/><path d="M7 11 Q12 2 17 11" fill="none" stroke="${INK}" stroke-width="1.4"/><circle cx="10" cy="10" r="3" fill="#ff5d73" stroke="${INK}" stroke-width="1.1"/><circle cx="14.5" cy="10.5" r="2.6" fill="#ffd23f" stroke="${INK}" stroke-width="1.1"/><path d="M6.5 15 H17.5" stroke="#b8862e" stroke-width="1"/>`,
  dig: `<path d="M5 5 L19 19 M19 5 L5 19" stroke="#d9583a" stroke-width="3.4" stroke-linecap="round"/><path d="M19 2 l1 2 2 1 -2 1 -1 2 -1 -2 -2 -1 2 -1Z" fill="#ffd23f"/>`,
};
export const zapIcon = (kind) => `<svg viewBox="0 0 24 24" class="isl-ico">${ICONS[kind] || ICONS.cut}</svg>`;

const CSS = `
.label.zz-tag { width: clamp(30px, 2.8vw, 44px); height: clamp(30px, 2.8vw, 44px); border-radius: 50%; background: #fff; border: 3px solid var(--c, #4cc9f0);
  box-shadow: 0 3px 0 rgba(43,35,64,.25), 0 0 12px var(--c, #4cc9f0); padding: 4px; box-sizing: border-box; animation: zz-bob 1s infinite; -webkit-text-stroke: 0; }
@keyframes zz-bob { 50% { margin-top: -5px; } }
.isl-zzrow-done { opacity: .55; }
`;

// Where the things to zap are. Main island: the old rock piles and tall grass (same save keys), plus new
// big ore boulders and choppable trees. Shell Isle (z > 150): ore rocks, tall grass and one big boulder
// (their save keys start at 100, so the main island's keys stay as they were).
const STONES = [[18, -28], [32, -24], [42, -27], [-6, -30], [50, 4], [20, 25], [-32, -8], [-40, 20], [30, 30], [-19, 28], [10, -31], [-46, -14]];
const GRASS = [[-21, 6], [-21.5, 10.5], [-6.5, 6], [-5.5, 10], [-8, 15], [40, -6], [44, -1], [36, -2], [-36, -12], [-42, -2], [12, 14], [16, 18], [24, 6], [-2, 16]];
const BIG = [[47, -22], [-38, 17], [36, 22]];
const TREES = [[-32, -3.5], [9.5, 20], [29, 13], [46.5, 9.5], [35, -19], [-10, -24], [-19, -16.5], [1.5, -17]];
const ISLE_STONES = [[-13.5, 191], [12, 188], [-1.5, 186.5]];
const ISLE_GRASS = [[-8, 196.5], [2.5, 194], [9.5, 191.5]];
const ISLE_BIG = [[-5, 189]];
const RESPAWN = { stone: 20 * MIN, grass: 10 * MIN, big: 60 * MIN, tree: 30 * MIN };
const SAVE_KEY = { stone: 'stones', grass: 'grass', big: 'big', tree: 'trees' };
const REACH = { stone: 1.6, grass: 1.4, big: 2.0, tree: 1.7 };
const GLOW = { stone: 'rock', big: 'rock', grass: 'grass', tree: 'tree' };
const GLOW_COLOR = { rock: 0xff5fd0, grass: 0x8ddf4a, tree: 0xffc93c };
const SCAN_R = 11;
const CAVE_CRYSTALS = ['roseQuartz', 'skyTopaz', 'sunCitrine'];

/** Pip's upgrades (bought at the gadget bench by the rocket): coins plus things from the island. */
export const UPGRADES = [
  { id: 'speed1', key: 'speed', lv: 1, coins: 150, need: [['wood', 5], ['stone', 5]] },
  { id: 'area1', key: 'area', lv: 1, coins: 200, need: [['wood', 10], ['fiber', 5]] },
  { id: 'area2', key: 'area', lv: 2, coins: 500, need: [['wood', 15], ['stone', 15]] },
  { id: 'range1', key: 'range', lv: 1, coins: 250, need: [['stone', 5], ['fiber', 10]] },
  { id: 'power1', key: 'power', lv: 1, coins: 400, need: [['stone', 15], ['wood', 5]], buster: true },
];
export const BENCH = { x: PAD.x - 4, z: PAD.z + 6.5 }; // by the path below the launch pad

const _v = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
const groundY = (x, z) => (z > 150 ? Math.max(isle2Height(x, z), 0.05) : heightAt(x, z));

export class ZipZap {
  constructor(host) {
    this.host = host;
    const S = host.save, map = host.map;
    if (!S.gather) S.gather = { stones: {}, grass: {} };
    for (const k of Object.values(SAVE_KEY)) if (!S.gather[k]) S.gather[k] = {};
    if (!S.zz) S.zz = { area: 0, speed: 0, range: 0, power: 0 };
    if (!document.getElementById('zz-style')) {
      const el = document.createElement('style');
      el.id = 'zz-style';
      el.textContent = CSS;
      document.head.appendChild(el);
    }
    // the scan glow: one ring and one dome material per kind, pulsing together
    this.glowMats = {};
    for (const [k, c] of Object.entries(GLOW_COLOR)) this.glowMats[k] = { ring: glowMat(c, 0.6, false), dome: glowMat(c, 0.15, false) }; // (tints, so it also shows on snow)
    this.targets = [];
    const add = (kind, list, make, keyBase = 0) => list.map(([x, z], j) => {
      const g = make();
      g.position.set(x, groundY(x, z), z);
      g.rotation.y = (j * 1.7 + keyBase) % 6;
      host.scene.add(g);
      const r = { stone: 0.8, grass: 0.6, big: 1.3, tree: 1.0 }[kind];
      const glow = makeScanGlow(this.glowMats[GLOW[kind]], r, kind === 'tree' ? 2.6 : kind === 'big' ? 1.8 : kind === 'grass' ? 0.9 : 1.0);
      g.add(glow);
      const o = { kind, key: keyBase + j, x, z, g, glow, isle: z > 150 };
      if (kind !== 'grass') o.obs = map.circObs(x, z, { stone: 0.7, big: 1.1, tree: 0.45 }[kind]);
      if (kind === 'tree') { o.stump = makeStump(); o.stump.position.copy(g.position); o.stump.visible = false; host.scene.add(o.stump); }
      this.targets.push(o);
      return o;
    });
    this.stones = [...add('stone', STONES, makeOreRock), ...add('stone', ISLE_STONES, makeOreRock, 100)];
    this.grass = [...add('grass', GRASS, makeTallGrass), ...add('grass', ISLE_GRASS, makeTallGrass, 100)];
    this.big = [...add('big', BIG, makeBigOre), ...add('big', ISLE_BIG, makeBigOre, 100)];
    this.trees = add('tree', TREES, makeChopTree);
    // the Crystal Caves rockfall looks breakable too (and glows in the scan)
    decorateRockfall(map.rockfall);
    this.rockfallGlow = makeScanGlow(this.glowMats.rock, 2.0, 2.0);
    this.rockfallGlow.position.set(0, 0, 1.0);
    map.rockfall.add(this.rockfallGlow);
    // Pip's gadget bench by the rocket
    this.bench = makeGadgetBench(host.M);
    this.bench.position.set(BENCH.x, heightAt(BENCH.x, BENCH.z), BENCH.z);
    this.bench.rotation.y = -0.5;
    host.scene.add(this.bench);
    map.boxObs(BENCH.x, BENCH.z, 0.7, 0.45);
    // the beam (one at a time) and the icon over the target
    this.beamMat = glowMat(0xffffff, 0.8);
    this.coreMat = glowMat(0xffffff, 0.9);
    const geo = new THREE.CylinderGeometry(1, 1, 1, 8, 1, true);
    geo.translate(0, 0.5, 0);
    this.beam = new THREE.Mesh(geo, this.beamMat);
    this.core = new THREE.Mesh(geo, this.coreMat);
    this.beam.add(this.core);
    this.beam.visible = false;
    this.beam.renderOrder = 5;
    host.scene.add(this.beam);
    this.beamT = 0;
    this.cool = 0;
    this.humT = 0;
    this.hits = {};
    this.tag = host.game.ui.label('label zz-tag');
    this.tag.style.display = 'none';
    this.tagKind = null;
    this.time = 0;
    this.tick(now());
  }

  get S() { return this.host.save; }

  /** Is the bean holding the Zip-Zap? */
  holding() { return held(this.S)?.id === 'zipzap'; }

  // ---------- upgrades ----------

  /** How many zaps a thing needs (Fast Zap makes it fewer). */
  hitsFor(kind) {
    const fast = (this.S.zz?.speed || 0) > 0;
    return { stone: fast ? 1 : 2, big: fast ? 2 : 4, tree: fast ? 2 : 3, rockfall: fast ? 3 : 5 }[kind] || 1;
  }

  /** Wide beam: 0 = one tile, 1 = three in a row, 2 = 3x3 (Aunt Hazel's magic spout is a wide water beam). */
  areaFor(kind) {
    const a = this.S.zz?.area || 0;
    return kind === 'water' ? Math.max(a, this.S.unlocks.bigCan ? 1 : 0) : a;
  }

  /** Long reach: how far ahead the beam looks for a target. */
  reaches() { return (this.S.zz?.range || 0) > 0 ? [0.9, 2.3] : [0.9]; }

  get cooldown() { return (this.S.zz?.speed || 0) > 0 ? 0.18 : 0.32; }

  // ---------- the things to zap ----------

  present(o, at = now()) {
    return since(this.S.gather[SAVE_KEY[o.kind]][o.key], RESPAWN[o.kind], at);
  }

  /** Respawns (about once a second): rocks and grass come back, chopped trees grow back from their stumps. */
  tick(at) {
    for (const o of this.targets) {
      const on = this.present(o, at);
      if (on && !o.g.visible && o.wasGone) { o.g.scale.setScalar(0.2); o.pop = 1; } // a little grow pop
      o.g.visible = on;
      o.wasGone = !on;
      if (o.obs) o.obs.x = on || o.kind === 'tree' ? o.x : 1e5; // a stump still stands in the way
      if (o.stump) {
        o.stump.visible = !on;
        if (!on) { const k = Math.min(1, (at - (this.S.gather.trees[o.key] || at)) / RESPAWN.tree); o.stump.userData.sprout.scale.setScalar(0.4 + k * 1.6); }
      }
    }
  }

  /** [B] with the Zip-Zap at a rock, a big boulder, tall grass or a tree (or a hint why not). */
  gatherAction(P, heldId, nm) {
    if (heldId !== 'zipzap') return null;
    let best = null, bd = Infinity;
    const isle = P.z > 150;
    for (const o of this.targets) {
      if (o.isle !== isle || !o.g.visible) continue;
      const r = REACH[o.kind];
      for (const d of this.reaches()) {
        const fx = P.x + P.fx * d, fz = P.z + P.fz * d;
        const hit = Math.hypot(fx - o.x, fz - o.z) < r || (d < 1 && Math.hypot(P.x - o.x, P.z - o.z) < r);
        if (!hit) continue;
        const dist = Math.hypot(P.x - o.x, P.z - o.z);
        if (dist < bd) { bd = dist; best = o; }
      }
    }
    if (!best) return null;
    const o = best;
    const pos = new THREE.Vector3(o.x, o.g.position.y + { stone: 0.7, grass: 0.6, big: 1.4, tree: 1.6 }[o.kind], o.z);
    if ((o.kind === 'stone' || o.kind === 'big') && !this.S.unlocks.rockBuster) return { text: t('zz.h.needBuster'), fn: () => this.nope('zz.h.needBuster'), bad: true };
    if (o.kind === 'big' && !(this.S.zz.power > 0)) return { text: t('zz.h.needPower'), fn: () => this.nope('zz.h.needPower'), bad: true };
    const kind = o.kind === 'grass' ? 'cut' : o.kind === 'tree' ? 'chop' : 'break';
    const key = { stone: 'isl.h.mine', big: 'zz.h.big', grass: 'isl.h.grass', tree: 'zz.h.chop' }[o.kind];
    return { text: nm(key), fn: () => this.hitTarget(o, kind, pos), ok: true, zz: { kind, pos } };
  }

  nope(key) {
    const txt = t(key);
    this.host.game.ui.toast(txt, 2200);
    speak(txt, 'narrator');
    this.host.game.audio.play('bump');
  }

  hitTarget(o, kind, pos) {
    if (!this.fire(kind, pos)) return;
    const host = this.host, S = this.S;
    const id = `${o.kind}${o.key}`;
    if (o.kind === 'tree') { o.shake = 1; host.puffs.burst(new THREE.Vector3(o.x, o.g.position.y + 2.2, o.z), 0x58c45a, { count: 8, speed: 3, size: 0.3 }); }
    this.hits[id] = (this.hits[id] || 0) + 1;
    if (o.kind !== 'grass' && this.hits[id] < this.hitsFor(o.kind)) return;
    this.hits[id] = 0;
    S.gather[SAVE_KEY[o.kind]][o.key] = now();
    if (o.kind === 'stone') { give(S, 'stone', 2); host.game.ui.toast(t('isl.t.stone')); }
    else if (o.kind === 'big') {
      give(S, 'stone', 6);
      // every third big boulder has a crystal inside (for the museum)
      S.gather.bigN = (S.gather.bigN || 0) + 1;
      const crystal = S.gather.bigN % 3 === 1 ? CAVE_CRYSTALS[Math.floor(S.gather.bigN / 3) % 3] : null;
      if (crystal) give(S, crystal, 1);
      host.game.ui.toast(crystal ? t('zz.t.bigCrystal', { item: t(`isl.i.${crystal}`) }) : t('zz.t.big'), 2200);
      host.confetti.burst(pos.clone(), 0, { count: 30, speed: 5, up: 4, colors: [0x5ff2ff, 0xff6fd0, 0xffd23f], life: 1.1, gravity: -7 });
    } else if (o.kind === 'grass') {
      give(S, 'hay', 1);
      const fiber = (o.key + (S.gather.cuts = (S.gather.cuts || 0) + 1)) % 3 !== 0;
      if (fiber) give(S, 'fiber', 1);
      host.game.ui.toast(t(fiber ? 'isl.t.grass2' : 'isl.t.grass'));
    } else if (o.kind === 'tree') {
      give(S, 'wood', 3);
      host.game.ui.toast(t('zz.t.wood'));
      host.puffs.burst(new THREE.Vector3(o.x, o.g.position.y + 1.2, o.z), 0x9a6440, { count: 14, speed: 4, size: 0.35 });
    }
    host.puffs.burst(new THREE.Vector3(o.x, o.g.position.y + 0.6, o.z), o.kind === 'grass' ? 0x8ac926 : o.kind === 'tree' ? 0x58c45a : 0xe8b07a, { count: 14, speed: 4, size: 0.35, life: 0.7 });
    this.tick(now());
    host.markDirty();
  }

  // ---------- the beam ----------

  /** The bean's Zip-Zap tip in the world (or the hand when it is not out). */
  tipPos(out) {
    const P = this.host.player;
    const tip = P?.toolMesh?.userData.tip;
    if (tip) return tip.getWorldPosition(out);
    return out.set(P?.x || 0, (P?.y || 0) + 0.9, P?.z || 0);
  }

  /** Zap! A beam of the action's color from the tip to the target, a sound, sparkles. False while cooling. */
  fire(kind, pos) {
    if (this.cool > 0) return false;
    this.cool = this.cooldown;
    const host = this.host;
    host.swingTool();
    this.shot = { kind, pos: pos.clone() };
    this.beamT = 0.34;
    const col = ZAP[kind]?.color ?? 0xffffff;
    this.beamMat.color.setHex(col);
    this.lastKind = kind;
    this.sound(kind);
    const pc = { till: 0xa8703f, water: 0x6fd0ff, cut: 0x8ddf4a, break: 0xffc0f0, chop: 0xffe066, harvest: 0xffffff, dig: 0xf0d48a }[kind];
    host.puffs.burst(pos.clone(), pc, { count: 8, speed: 2.5, up: kind === 'water' ? 1 : 2, size: 0.18, life: 0.5, gravity: kind === 'water' ? -12 : 0 });
    host.confetti.burst(pos.clone(), 0, { count: 6, speed: 2, up: 2, colors: [col, 0xffffff], life: 0.5, gravity: -4, size: 0.12 });
    this.fired = (this.fired || 0) + 1;
    return true;
  }

  /** A little fizzle when the Zip-Zap has nothing to work on. */
  fizzle() {
    if (this.cool > 0) return;
    this.cool = this.cooldown;
    this.host.swingTool();
    this.tipPos(_v);
    this.host.puffs.burst(_v.clone(), 0x7ff0ff, { count: 5, speed: 1.5, size: 0.12, life: 0.35 });
    this.host.game.audio.play('dash');
  }

  /** Each action has its own sound (built from the audio engine's tones and noise). */
  sound(kind) {
    const a = this.host.game.audio;
    if (!a.ctx || a.muted) return;
    a.tone(880, 0.07, { type: 'sine', vol: 0.05, slide: 2 }); // zip!
    switch (kind) {
      case 'till': a.noise(0.14, { vol: 0.12, freq: 500, q: 0.7, type: 'lowpass', delay: 0.04 }); a.tone(240, 0.14, { type: 'triangle', vol: 0.1, slide: 0.6, delay: 0.04 }); break;
      case 'water': [0, 0.06, 0.12].forEach((d, i) => a.tone(520 + i * 140, 0.1, { type: 'sine', vol: 0.09, slide: 1.8, delay: 0.04 + d })); break;
      case 'cut': a.noise(0.06, { vol: 0.12, freq: 3200, q: 2, delay: 0.04 }); a.noise(0.06, { vol: 0.12, freq: 3600, q: 2, delay: 0.13 }); break;
      case 'break': a.tone(150, 0.16, { type: 'square', vol: 0.07, slide: 0.5, delay: 0.04 }); a.noise(0.18, { vol: 0.16, freq: 900, q: 0.8, delay: 0.05 }); break;
      case 'chop': a.tone(320, 0.08, { type: 'triangle', vol: 0.14, slide: 0.7, delay: 0.04 }); a.tone(210, 0.1, { type: 'triangle', vol: 0.12, slide: 0.7, delay: 0.12 }); break;
      case 'harvest': [0, 4, 7].forEach((n, i) => a.tone(660 * 2 ** (n / 12), 0.1, { type: 'triangle', vol: 0.09, delay: 0.04 + i * 0.05 })); break;
      case 'dig': a.tone(400, 0.2, { type: 'sine', vol: 0.1, slide: 0.4, delay: 0.04 }); a.noise(0.16, { vol: 0.12, freq: 700, q: 0.6, delay: 0.08 }); break;
      default: break;
    }
  }

  // ---------- every frame ----------

  /** Beam, target icon, scan glow, the glowing tip and the hum. ia = the island's interactions(). */
  update(dt, ia) {
    const host = this.host, P = host.player;
    this.time += dt;
    this.cool = Math.max(0, this.cool - dt);
    const walking = host.mode === 'walk' && !!P && !host.launching;
    const holding = walking && this.holding();
    // the scan: things to break, cut and chop glow softly near you
    const pulse = 0.5 + 0.5 * Math.sin(this.time * 4);
    for (const m of Object.values(this.glowMats)) { m.ring.opacity = 0.5 + pulse * 0.4; m.dome.opacity = 0.1 + pulse * 0.12; }
    for (const o of this.targets) {
      const d = P ? Math.hypot(P.x - o.x, P.z - o.z) : 99;
      o.glow.visible = holding && d < SCAN_R;
      if (o.pop > 0) { o.pop = Math.max(0, o.pop - dt * 2); o.g.scale.setScalar(1 - o.pop * 0.8 + Math.sin(o.pop * Math.PI) * 0.25); }
      if (o.shake > 0 && o.g.userData.top) { o.shake = Math.max(0, o.shake - dt * 3); o.g.userData.top.rotation.z = Math.sin(o.shake * 18) * 0.08 * o.shake; }
      const sp = o.g.userData.sparkles;
      if (sp && o.g.visible && d < 30) sp.forEach((s, i) => { const k = 0.75 + 0.45 * Math.max(0, Math.sin(this.time * 3 + i * 1.9 + o.key)); s.scale.set(k, k * 1.4, k); });
    }
    const rf = host.map.rockfall;
    this.rockfallGlow.visible = holding && rf.visible && Math.hypot(P.x - ROCKFALL.x, P.z - ROCKFALL.z) < SCAN_R + 2;
    if (rf.visible) rf.userData.sparkles?.forEach((s, i) => { const k = 0.8 + 0.4 * Math.max(0, Math.sin(this.time * 3 + i * 2.1)); s.scale.set(k, k * 1.4, k); });
    // the icon over the target: what [B] will do
    const zz = walking ? ia?.use?.zz : null;
    if (zz) {
      if (this.tagKind !== zz.kind) {
        this.tagKind = zz.kind;
        this.tag.innerHTML = zapIcon(zz.kind);
        this.tag.style.setProperty('--c', `#${ZAP[zz.kind].color.toString(16).padStart(6, '0')}`);
        this.tag.dataset.kind = zz.kind;
      }
      _v.copy(zz.pos);
      _v.y += 0.9 + Math.sin(this.time * 4) * 0.05;
      host.game.ui.place(this.tag, _v, host.camera);
    } else { this.tag.style.display = 'none'; this.tagKind = null; this.tag.dataset.kind = ''; }
    // the tip glows in the color of what it would do, and pulses; a soft hum while it is out
    const tip = P?.toolMesh?.userData.tip;
    if (tip) {
      const col = zz ? ZAP[zz.kind].color : 0x7ff0ff;
      tip.material.color.setHex(col);
      tip.material.emissive.setHex(col).multiplyScalar(0.35 + pulse * 0.35);
      const halo = P.toolMesh.userData.halo;
      halo.material.color.setHex(col);
      halo.material.opacity = 0.25 + pulse * 0.25 + (this.beamT > 0 ? 0.4 : 0);
      halo.scale.setScalar(1 + pulse * 0.25 + (this.beamT > 0 ? 0.6 : 0));
    }
    if (holding) {
      this.humT -= dt;
      if (this.humT <= 0) {
        this.humT = 1.15;
        const a = host.game.audio;
        if (a.ctx && !a.muted) { a.tone(98, 1.25, { type: 'sine', vol: 0.018, attack: 0.3 }); a.tone(196, 1.2, { type: 'sine', vol: 0.006, attack: 0.3 }); }
      }
    } else this.humT = 0.3;
    // the beam: from the tip to the target, fading out
    if (this.beamT > 0 && this.shot) {
      this.beamT = Math.max(0, this.beamT - dt);
      this.tipPos(_v);
      const to = this.shot.pos;
      const dir = to.clone().sub(_v);
      const len = dir.length();
      this.beam.visible = len > 0.05;
      this.beam.position.copy(_v);
      this.beam.quaternion.setFromUnitVectors(_up, dir.normalize());
      const k = this.beamT / 0.34;
      const w = 0.11 + 0.04 * Math.sin(this.time * 40);
      this.beam.scale.set(w * (0.6 + k * 0.6), len, w * (0.6 + k * 0.6));
      this.core.scale.set(0.4, 1, 0.4);
      this.beamMat.opacity = 0.75 * k + 0.1;
      this.coreMat.opacity = 0.9 * k;
    } else this.beam.visible = false;
    // the spare Zip-Zap on Pip's bench twinkles too
    const bt = this.bench.userData.tip;
    if (bt) bt.material.emissive.setHex(0x2a8a99).multiplyScalar(0.6 + pulse * 0.8);
  }

  // ---------- Pip's gadget bench ----------

  interactions(P, out, nm) {
    if (Math.hypot(P.x - BENCH.x, P.z - BENCH.z) < 1.9) out.b = { text: nm('zz.h.bench'), fn: () => this.openBench() };
  }

  levelOf(key) { return this.S.zz?.[key] || 0; }

  rows() {
    return UPGRADES.map((u) => {
      const done = this.levelOf(u.key) >= u.lv;
      const locked = !done && ((this.levelOf(u.key) < u.lv - 1) || (u.buster && !this.S.unlocks.rockBuster));
      return { ...u, done, locked };
    });
  }

  openBench() {
    const host = this.host;
    host.mode = 'zzbench';
    this.panel = { i: 0, t: 0 };
    const first = this.rows().findIndex((r) => !r.done && !r.locked);
    this.panel.i = Math.max(0, first);
    this.renderBench();
    host.game.audio.play('select');
    speak(t('zz.bench.hello'), 'isl.pip');
  }

  have(id) { return id === 'coin' ? this.S.coins : count(this.S, id); }

  renderBench() {
    const host = this.host, Pn = this.panel;
    const rows = this.rows().map((r, k) => {
      const need = [['coin', r.coins], ...r.need];
      const ings = r.done ? '' : need.map(([n, k2]) => `<span class="isl-cook-ing ${this.have(n) < k2 ? 'no' : ''}">${icon(n)}<small>${esc(n === 'coin' ? '' : t(`isl.i.${n}`))} ${n === 'coin' ? k2 : `${Math.min(this.have(n), k2)}/${k2}`}</small></span>`).join('');
      const state = r.done ? t('zz.up.done') : r.locked ? t(r.buster && !this.S.unlocks.rockBuster ? 'zz.up.needBuster' : 'zz.up.first') : '';
      return `<div class="isl-row ${k === Pn.i ? 'on' : ''} ${r.done ? 'isl-zzrow-done' : ''}">${icon('zipzap')}<div>${esc(t(`zz.up.${r.id}`))}<div><small>${esc(t(`zz.up.${r.id}.sub`))}</small></div><div>${ings}</div></div><small>${esc(state)}</small><div></div></div>`;
    }).join('');
    host.hud.setPanel(`<h2>${esc(t('zz.bench.title'))}</h2><div class="isl-rows">${rows}</div><div class="isl-foot">${esc(t('zz.bench.status', this.statusVars()))}</div>
      <div class="isl-foot">${esc(this.host.nm('zz.bench.hint'))}</div>`);
  }

  statusVars() {
    const S = this.S;
    return { buster: t(S.unlocks.rockBuster ? 'zz.on' : 'zz.off'), area: [t('zz.area0'), t('zz.area1'), t('zz.area2')][this.areaFor('till')] };
  }

  /** The bench panel: (island's [B] arrives as aPressed, [C] as bPressed). */
  updateBench(inp, dt) {
    const Pn = this.panel, host = this.host;
    Pn.t += dt;
    const n = UPGRADES.length;
    if (inp.stepY || inp.stepX) { Pn.i = THREE.MathUtils.clamp(Pn.i - inp.stepY + inp.stepX, 0, n - 1); host.game.audio.play('select'); this.renderBench(); speak(t(`zz.up.${UPGRADES[Pn.i].id}.sub`), 'narrator'); }
    if (Pn.t < 0.25) return;
    if (inp.bPressed) { host.hud.setPanel(null); host.mode = 'walk'; return; }
    if (inp.aPressed) this.buy(UPGRADES[Pn.i].id);
  }

  buy(id) {
    const host = this.host, S = this.S;
    const r = this.rows().find((x) => x.id === id);
    if (!r || r.done) { host.game.audio.play('bump'); return false; }
    if (r.locked) { this.nope(r.buster && !S.unlocks.rockBuster ? 'zz.up.needBuster' : 'zz.up.first'); return false; }
    if (S.coins < r.coins || !r.need.every(([it, k]) => count(S, it) >= k)) { host.game.ui.toast(t('isl.cook.missing'), 1400); host.game.audio.play('bump'); return false; }
    S.coins -= r.coins;
    for (const [it, k] of r.need) take(S, it, k);
    S.zz[r.key] = r.lv;
    host.game.audio.play('fanfare');
    host.confetti.burst(new THREE.Vector3(BENCH.x, 2, BENCH.z), 0, { count: 40, speed: 6, up: 4, life: 1.3, gravity: -6, colors: [0x7ff0ff, 0xff6fd0, 0xffd23f, 0x9b82ff] });
    const txt = t(`zz.up.${r.id}.got`);
    host.game.ui.toast(txt, 2600);
    speak(txt, 'isl.pip');
    host.markDirty();
    if (host.mode === 'zzbench') this.renderBench();
    return true;
  }

  dispose() {
    this.tag?.remove();
  }
}

export { ITEMS };
