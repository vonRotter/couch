import * as THREE from 'three';
import { toon, basic, sharedGeo } from '../../core/palette.js';
import { t } from '../../core/i18n.js';
import { mesh, sph, fadeMat } from '../keep/common.js';
import { FoeMixin } from '../keep/foes.js';
import { ACT_FLOORS, actOf, isDeep } from './acts.js';

// Champions and uniques of Pillow Keep Solo (mixed into the scene), Diablo style:
//   champion packs  3-4 blue-named grumbles (more on Nightmare / Hell) sharing 1-2 modifiers; the
//                   last one of the pack drops a guaranteed item
//   unique grumbles a gold name ("Grumbo the Swift" style: random) with 1-2 modifiers and a few
//                   followers; 1-2 items with a better rarity roll
//   named uniques   hand-made, three per act with funny names and fixed modifiers; one waits on each
//                   of an act's first two floors (the Deep Keep picks any); 2 items, the first magic or better
// Modifiers: fast, tough, jelly trail (sticky puddles that sting), bubble shield (blocks a few hits,
// comes back), blinking (hops next to you), sleepy aura (makes you yawn), splitter (two little ones
// when poofed). Nightmare and Hell add more of them. Everything still poofs into fluff.

export const MODS = ['fast', 'tough', 'jelly', 'shield', 'blink', 'sleepy', 'splitter'];
const CHAMP_BLUE = 0x4c8dff;

// Hand-made uniques: kind, body color, size, modifiers.
export const NAMED = [
  [{ id: 'crumbs', kind: 'basic', color: 0xd9a066, size: 1.5, mods: ['fast', 'jelly'] }, { id: 'snorts', kind: 'shield', color: 0x9b8ad6, size: 1.6, mods: ['tough', 'sleepy'] }, { id: 'dusty', kind: 'thrower', color: 0xbdb8cf, size: 1.45, mods: ['blink', 'splitter'] }],
  [{ id: 'twiggy', kind: 'charger', color: 0x8a6a3a, size: 1.5, mods: ['fast', 'tough'] }, { id: 'feather', kind: 'thrower', color: 0xfff3e6, size: 1.5, mods: ['shield', 'fast'] }, { id: 'moss', kind: 'shield', color: 0x6fae5a, size: 1.7, mods: ['tough', 'jelly'] }],
  [{ id: 'admiral', kind: 'charger', color: 0xffd23f, size: 1.55, mods: ['blink', 'shield'] }, { id: 'sue', kind: 'basic', color: 0xff9fd0, size: 1.5, mods: ['jelly', 'splitter'] }, { id: 'drip', kind: 'shield', color: 0x56c6f0, size: 1.75, mods: ['tough', 'sleepy'] }],
  [{ id: 'snoozula', kind: 'basic', color: 0x6b4a9e, size: 1.6, mods: ['sleepy', 'blink'] }, { id: 'marsh', kind: 'shield', color: 0xfff7ef, size: 1.8, mods: ['tough', 'shield'] }, { id: 'yawn', kind: 'thrower', color: 0xc9a8ff, size: 1.55, mods: ['fast', 'sleepy'] }],
];
const RANDOM_NAMES = ['Grumbo', 'Mopsy', 'Snorkel', 'Bramble', 'Puddle', 'Waffles', 'Noodle', 'Biscuit', 'Fuzzlebert', 'Pickles', 'Dumpling', 'Mumble'];

const pick = (list) => list[Math.floor(Math.random() * list.length)];

/** n different modifiers. */
function rollMods(n, avoid = []) {
  const pool = MODS.filter((m) => !avoid.includes(m));
  const out = [];
  for (let i = 0; i < n && pool.length; i++) out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  return out;
}

export const MonsterMixin = {
  /** How many modifiers champions and uniques get on this difficulty. */
  modCount() {
    const d = this.hs.diff;
    return d === 0 ? 1 + (Math.random() < 0.45 ? 1 : 0) : d === 1 ? 2 : 2 + (Math.random() < 0.5 ? 1 : 0);
  },

  /** 'E' marks: a champion pack or a unique with followers; 'g' marks: a sleeping group. */
  spawnPack(x, z, elite) {
    if (!elite) { FoeMixin.spawnPack.call(this, x, z, false); return; }
    if (Math.random() < 0.6) this.spawnChampions(x, z);
    else this.spawnUnique(x, z, null);
  },

  spawnChampions(x, z) {
    const pack = { awake: false, champs: 0, kind: 'champ' };
    const mods = rollMods(this.modCount());
    const n = 3 + (Math.random() < 0.4 ? 1 : 0) + this.hs.diff;
    const kind = this.pickKind();
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random();
      const px = x + Math.cos(a) * 1.4, pz = z + Math.sin(a) * 1.4;
      const ok = this.walkableAt(px, pz);
      const g = this.spawnGrumble(ok ? px : x, ok ? pz : z, null, kind, null, { idle: true, pack });
      this.makeSpecial(g, 'champ', mods, t('ks.champ', { name: t(`ks.foe.${kind}`) }));
      pack.champs++;
    }
  },

  /** A unique: def = a hand-made one (NAMED), or null for a random one. */
  spawnUnique(x, z, def) {
    const pack = { awake: false, kind: 'unique' };
    const kind = def ? def.kind : this.pickKind();
    const g = this.spawnGrumble(x, z, null, kind, def ? def.color : null, { idle: true, elite: true, pack });
    const mods = def ? def.mods : rollMods(this.modCount());
    const extra = def && this.hs.diff ? rollMods(this.hs.diff, mods).slice(0, this.hs.diff) : [];
    const name = def ? t(`ks.uniq.${def.id}`) : t('ks.uniqRandom', { name: pick(RANDOM_NAMES), mod: t(`ks.modName.${mods[0]}`) });
    this.makeSpecial(g, 'unique', [...mods, ...extra], name);
    if (def) { g.named = def.id; g.size = def.size; }
    const n = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random();
      const px = x + Math.cos(a) * 1.6, pz = z + Math.sin(a) * 1.6;
      const ok = this.walkableAt(px, pz);
      this.spawnGrumble(ok ? px : x, ok ? pz : z, null, this.pickKind(), null, { idle: true, pack });
    }
    return g;
  },

  pickKind() {
    const mix = [['basic'], ['basic', 'charger'], ['basic', 'charger', 'thrower'], ['basic', 'charger', 'thrower', 'shield'], ['basic', 'charger', 'thrower', 'shield']][Math.min(4, this.floorIndex)];
    return pick(mix);
  },

  /** Turn a fresh grumble into a champion or unique with modifiers. */
  makeSpecial(g, type, mods, name) {
    g.trait = null; // the co-op elite traits are not used here
    g.speed = g.type.speed;
    g.mods = mods;
    g[type] = true;
    let hp = this.foeHp(g.kind, false, null) * (type === 'unique' ? 6 : 3.2);
    if (mods.includes('tough')) hp *= 1.7;
    if (mods.includes('fast')) g.speed *= 1.5;
    g.hp = g.max = hp;
    g.size = type === 'unique' ? 1.45 : 1.25;
    g.name = name;
    g.modText = mods.map((m) => t(`ks.mod.${m}`)).join(' · ');
    g.modT = 1 + Math.random() * 2;
    g.bshield = 0;
    if (type === 'champ') {
      // a blue aura ring and a blue name
      const ring = mesh(sharedGeo('ksChampRing', () => new THREE.RingGeometry(0.62, 0.8, 32)), basic(CHAMP_BLUE, { transparent: true, opacity: 0.85, depthWrite: false }), 0, 0.06, 0, false);
      ring.rotation.x = -Math.PI / 2;
      g.g.add(ring);
      g.g.userData.champRing = ring;
    }
    if (!g.label) {
      g.label = this.game.ui.label('label');
      g.label.style.fontSize = 'clamp(10px, .9vw, 14px)';
      g.label.style.webkitTextStroke = '0.22em #2b2340';
      g.labelHtml = '';
    }
    g.label.style.color = type === 'champ' ? '#7fb2ff' : '#ffd23f';
    if (mods.includes('shield')) {
      const bub = mesh(sph(0.95, 16, 12), toon(0xbfe9ff, { transparent: true, opacity: 0.35 }), 0, 0.6, 0, false);
      bub.visible = false;
      g.g.add(bub);
      g.shieldMesh = bub;
      g.bshield = 3;
    }
  },

  /** Hand-made uniques: one on an act's first two floors, sometimes one in the Deep Keep. */
  spawnNamed(marks) {
    if (this.floorDef.boss) return;
    const deep = isDeep(this.g);
    if (!deep && this.g % ACT_FLOORS === ACT_FLOORS - 1) return;
    if (deep && Math.random() < 0.5) return;
    const list = deep ? NAMED.flat() : NAMED[actOf(this.g)];
    const def = list[(this.floorSeed >>> 3) % list.length];
    // the 'g' mark farthest from the start
    let best = null, bd = -1;
    for (const [ch, c, r] of marks) {
      if (ch !== 'g') continue;
      const d = Math.hypot(this.cx(c) - this.start.x, this.cz(r) - this.start.z);
      if (d > bd) { bd = d; best = [this.cx(c), this.cz(r)]; }
    }
    if (best) this.spawnUnique(best[0] + 1.2, best[1], def);
  },

  // ---------------------------------------------------------------- modifiers at work

  updateMods(dt, active) {
    const e = this.hero;
    for (const g of this.grumbles) {
      if (g.dead || !g.mods || g.state === 'idle') continue;
      g.modT -= dt;
      if (g.g.userData.champRing) g.g.userData.champRing.rotation.z += dt * 2;
      if (g.shieldMesh) g.shieldMesh.visible = g.bshield > 0;
      if (!active) continue;
      const d = Math.hypot(e.x - g.x, e.z - g.z);
      // jelly trail: sticky puddles where it walks
      if (g.mods.includes('jelly')) {
        g.jellyT = (g.jellyT || 0) - dt;
        if (g.jellyT <= 0 && Math.abs(g.vx) + Math.abs(g.vz) > 0.3) { g.jellyT = 0.45; this.addPuddle(g.x, g.z); }
      }
      // bubble shield comes back
      if (g.mods.includes('shield') && g.bshield <= 0) {
        g.shieldBack = (g.shieldBack || 6) - dt;
        if (g.shieldBack <= 0) { g.shieldBack = 6; g.bshield = 3; this.game.audio.play('bubble'); }
      }
      // sleepy aura
      if (g.mods.includes('sleepy')) {
        g.auraT = (g.auraT || 1.8) - dt;
        if (g.auraT <= 0) {
          g.auraT = 2;
          if (e.state === 'walk' && d < 3.4) this.addYawn(e, 0.08);
          this.addFx('ring', g.x, g.z, { color: 0xc9a8ff, from: 0.5, to: 3.4, life: 0.5 });
        }
      }
      // blink: pop up next to you
      if (g.mods.includes('blink') && g.modT <= 0 && d < 13 && d > 3.5 && g.state === 'walk') {
        g.modT = 4 + Math.random() * 2;
        for (let k = 0; k < 8; k++) {
          const a = Math.random() * Math.PI * 2, r = 2 + Math.random();
          const x = e.x + Math.cos(a) * r, z = e.z + Math.sin(a) * r;
          if (!this.walkableAt(x, z) || !this.clearLine(e.x, e.z, x, z)) continue;
          this.puffs.burst(new THREE.Vector3(g.x, 0.7, g.z), 0xc9a8ff, { count: 8, size: 0.4, life: 0.5, speed: 2 });
          g.x = x; g.z = z;
          this.puffs.burst(new THREE.Vector3(x, 0.7, z), 0xc9a8ff, { count: 8, size: 0.4, life: 0.5, speed: 2 });
          this.game.audio.play('pop');
          break;
        }
      }
    }
    this.updatePuddles(dt, active);
  },

  addPuddle(x, z) {
    if (!this.walkableAt(x, z)) return;
    const mat = fadeMat(0xff6fae, 0.5);
    const m = new THREE.Mesh(sharedGeo('ksPuddle', () => new THREE.CircleGeometry(1, 20)), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.05, z);
    m.scale.setScalar(0.85);
    this.level.add(m);
    (this.puddles ||= []).push({ x, z, r: 0.85, t: 0, life: 4, m, mat, tick: 0 });
  },

  updatePuddles(dt, active) {
    if (!this.puddles?.length) return;
    const e = this.hero;
    for (const p of this.puddles) {
      p.t += dt;
      p.tick -= dt;
      p.mat.opacity = 0.5 * Math.min(1, (p.life - p.t) / 1);
      if (active && p.tick <= 0 && e.state === 'walk' && Math.hypot(e.x - p.x, e.z - p.z) < p.r + 0.3) { p.tick = 0.6; this.addYawn(e, 0.07); }
      if (p.t >= p.life) { p.done = true; this.level.remove(p.m); p.mat.dispose(); }
    }
    this.puddles = this.puddles.filter((p) => !p.done);
  },

  /** A champion / unique was poofed: loot, quests, splitters. Returns true when it was special. */
  specialPoofed(g) {
    if (!g.mods) return false;
    const hs = this.hs;
    if (g.mods.includes('splitter')) for (let i = 0; i < 2; i++) this.spawnGrumble(g.x + (i ? 0.8 : -0.8), g.z, null, 'basic');
    for (let i = 0; i < (g.unique ? 6 : 3); i++) this.spawnItem('coin', g.x, g.z, true);
    if (Math.random() < 0.5) this.spawnItem('potion', g.x, g.z, true);
    this.gainXp((3 + this.floorIndex) * g.type.xp * (g.unique ? 2 : 3), g.x, g.z);
    if (g.champ) {
      hs.stats.champs++;
      hs.stats.elites++;
      g.pack.champs--;
      if (g.pack.champs <= 0) { this.dropLoot(g.x, g.z, 'champ', 1); this.floater(t('ks.champDone'), new THREE.Vector3(g.x, 2.4, g.z), '#7fb2ff', 1.2, true); }
    } else if (g.unique) {
      hs.stats.uniques++;
      this.dropLoot(g.x, g.z, 'unique', g.named ? 2 : 1 + (Math.random() < 0.5 ? 1 : 0), g.named ? 1 : 0);
      this.spawnItem('scroll', g.x, g.z, true);
      this.say(t('ks.uniqDone', { name: g.name }));
      this.floater(t('ks.uniqDone', { name: g.name }), new THREE.Vector3(g.x, 2.6, g.z), '#ffd23f', 1.6, true);
    }
    return true;
  },
};

