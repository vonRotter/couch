import * as THREE from 'three';
import { COLORS, toon, basic, sharedGeo } from '../../core/palette.js';
import { makeGrumble } from '../../core/critters.js';
import { makeStar } from '../../core/world.js';
import { t } from '../../core/i18n.js';
import { esc } from '../../core/ui.js';
import { PR, GR, angDiff, clamp, mesh, sph, rbox, cone } from './common.js';

// Gear drop chances in co-op. A scene can set its own `lootRates` (Pillow Keep Solo does).
export const COOP_LOOT_RATES = { grumble: 0.015, nest: 0.25, elite: 1 };


// Grumbles of Pillow Keep: still harmless fuzzballs (a touch only makes you yawn), but now in
// several kinds you learn to read:
//   basic    walks at you
//   charger  (orange, horns) stops, paints a line on the floor, then dashes along it; dizzy after
//   thrower  (green, holds a pillow) keeps its distance and lobs pillows: a growing circle shows where
//   shield   (blue, big cushion) blocks bonks from the front; hit it from the side or behind
//   elite    any kind, bigger, golden aura and a name, with a trait (swift, tough, sleepy, splitter)
// They sleep in rooms until you come close, and nests keep sending more until fluffed.

export const TYPES = {
  basic: { hp: 1, speed: 1, yawn: 0.24, xp: 1 },
  charger: { hp: 1.5, speed: 0.9, yawn: 0.3, xp: 1.5, color: 0xff8c42 },
  thrower: { hp: 1, speed: 0.85, yawn: 0.2, xp: 1.5, color: 0x58c26a },
  shield: { hp: 2.2, speed: 0.72, yawn: 0.26, xp: 2, color: 0x4f7fd9 },
};
const TRAITS = ['swift', 'tough', 'sleepy', 'splitter'];
const NAMES = ['Grumbo', 'Mopsy', 'Snorkel', 'Bramble', 'Puddle', 'Waffles', 'Noodle', 'Biscuit', 'Fuzzlebert', 'Pickles', 'Dumpling', 'Mumble'];
// Which kinds nests send, by depth.
const MIX = [
  { basic: 0.75, charger: 0.25 },
  { basic: 0.55, charger: 0.25, thrower: 0.2 },
  { basic: 0.45, charger: 0.2, thrower: 0.2, shield: 0.15 },
  { basic: 0.35, charger: 0.22, thrower: 0.23, shield: 0.2 },
  { basic: 0.35, charger: 0.22, thrower: 0.23, shield: 0.2 },
];

function pickKind(depth) {
  const mix = MIX[Math.min(depth, MIX.length - 1)];
  let x = Math.random();
  for (const k in mix) { x -= mix[k]; if (x <= 0) return k; }
  return 'basic';
}

/** The grumble look plus its kind's extras. */
function makeFoeMesh(kind, color, elite) {
  const g = makeGrumble(color);
  if (kind === 'charger') {
    for (const s of [-1, 1]) {
      const horn = mesh(cone('gHorn', 0.08, 0.3, 8), toon(COLORS.cream), s * 0.25, 0.86, 0.1, false);
      horn.rotation.z = -s * 0.5;
      g.add(horn);
    }
  } else if (kind === 'thrower') {
    const arm = new THREE.Group();
    arm.position.set(0, 0.85, 0);
    const pillow = mesh(rbox('gPillow', 0.5, 0.18, 0.36, 0.08), toon(COLORS.candyPink), 0, 0.15, -0.05, false);
    arm.add(pillow);
    g.add(arm);
    g.userData.arm = arm;
  } else if (kind === 'shield') {
    const sh = new THREE.Group();
    sh.position.set(0, 0.45, 0.55);
    const pad = mesh(sharedGeo('gShield', () => new THREE.CylinderGeometry(0.5, 0.5, 0.16, 20)), toon(COLORS.candyPink), 0, 0, 0);
    pad.rotation.x = Math.PI / 2;
    const btn = mesh(sph(0.08), toon(COLORS.cream), 0, 0, 0.1, false);
    sh.add(pad, btn);
    g.add(sh);
  }
  if (elite) {
    // Golden aura on the floor and a little crown: "this one is special".
    const ring = mesh(sharedGeo('gAura', () => new THREE.RingGeometry(0.62, 0.8, 32)), basic(COLORS.gold, { transparent: true, opacity: 0.8, depthWrite: false }), 0, 0.06, 0, false);
    ring.rotation.x = -Math.PI / 2;
    const glow = mesh(sharedGeo('gAuraGlow', () => new THREE.CircleGeometry(0.62, 32)), basic(0xffe9a0, { transparent: true, opacity: 0.35, depthWrite: false }), 0, 0.05, 0, false);
    glow.rotation.x = -Math.PI / 2;
    const crown = makeStar(COLORS.gold);
    crown.scale.setScalar(0.25);
    crown.position.set(0, 1.12, 0);
    g.add(ring, glow, crown);
    g.userData.aura = ring;
    g.userData.crown = crown;
  }
  return g;
}

/** Methods mixed into KeepScene (`this` = the scene). */
export const FoeMixin = {
  foeHp(kind, elite, trait) {
    const n = this.ents.length, d = this.floorIndex;
    let hp = (1 + 1.1 * d) * TYPES[kind].hp * (1 + 0.12 * (n - 1));
    if (elite) hp *= 4 * (trait === 'tough' ? 1.8 : 1) * (1 + 0.15 * (n - 1));
    return hp;
  },

  /**
   * Spawn a grumble. nest: the nest it belongs to (or null); kind: see TYPES; opts.idle: waits
   * until a player comes close; opts.elite: make it an elite with a name and a trait.
   */
  spawnGrumble(x, z, nest, kind = 'basic', color = null, opts = {}) {
    const type = TYPES[kind];
    const elite = !!opts.elite;
    const trait = elite ? TRAITS[Math.floor(Math.random() * TRAITS.length)] : null;
    const g = makeFoeMesh(kind, color ?? type.color ?? this.theme.grumble, elite);
    const bubble = mesh(sph(0.72, 18, 12), toon(0xbfe9ff, { transparent: true, opacity: 0.45 }), 0, 0.45, 0, false);
    bubble.add(mesh(sph(0.12), toon(COLORS.white), -0.3, 0.3, 0.45, false));
    bubble.visible = false;
    g.add(bubble);
    // Step out of the pile toward an open spot.
    let sx = x, sz = z;
    if (nest) {
      for (let tries = 0; tries < 8; tries++) {
        const a = Math.random() * Math.PI * 2;
        const px = x + Math.sin(a) * 1.3, pz = z + Math.cos(a) * 1.3;
        if (this.walkableAt(px, pz)) { sx = px; sz = pz; break; }
      }
    }
    this.level.add(g);
    const hp = this.foeHp(kind, elite, trait);
    const gr = {
      g, bubble, kind, type, elite, trait, x: sx, z: sz, vx: 0, vz: 0, kx: 0, kz: 0, state: opts.idle ? 'idle' : 'pop', t: 0,
      hp, max: hp, size: elite ? 1.4 : kind === 'shield' ? 1.1 : 1, nest, hitCd: 0.6, wx: sx, wz: sz, wanderT: 0, y: 0,
      phase: Math.random() * 6, yaw: Math.random() * Math.PI * 2, actCd: 1.5 + Math.random() * 1.5, pack: opts.pack || null, auraT: 0,
      speed: type.speed * (trait === 'swift' ? 1.4 : 1),
    };
    if (elite) {
      gr.name = t('keep.eliteName', { name: NAMES[Math.floor(Math.random() * NAMES.length)], trait: t(`keep.trait.${trait}`) });
      gr.label = this.game.ui.label('label');
      gr.label.style.fontSize = 'clamp(11px, 1vw, 16px)';
      gr.label.style.color = '#ffb400';
      gr.label.style.webkitTextStroke = '0.22em #2b2340';
      gr.labelHtml = '';
    }
    g.position.set(sx, 0, sz);
    g.scale.setScalar(opts.idle ? gr.size : 0.01);
    this.grumbles.push(gr);
    if (nest) nest.alive++;
    if (!opts.idle) this.puffs.burst(new THREE.Vector3(sx, 0.5, sz), 0xffffff, { count: 6, size: 0.35, life: 0.5, speed: 2 });
    return gr;
  },

  /** A sleeping group in a room ('g' marks), or an elite with its followers ('E' marks). */
  spawnPack(x, z, elite) {
    const n = this.ents.length, d = this.floorIndex;
    const pack = { awake: false };
    const count = elite ? 1 + Math.floor(n / 2) + Math.floor(d / 2) : 1 + Math.round(n * 0.4) + Math.floor(d / 2);
    if (elite) this.spawnGrumble(x, z, null, pickKind(Math.max(1, d)), null, { idle: true, elite: true, pack });
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + Math.random();
      const px = x + Math.cos(a) * 1.5, pz = z + Math.sin(a) * 1.5;
      const ok = this.walkableAt(px, pz);
      this.spawnGrumble(ok ? px : x, ok ? pz : z, null, pickKind(d), null, { idle: true, pack });
    }
  },

  makeNest(x, z) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    const cols = [COLORS.candyPink, COLORS.candyBlue, COLORS.candyYellow, COLORS.candyLilac, COLORS.candyMint, COLORS.cream];
    const pillows = [
      [-0.5, 0.2, 0.0, 0.3], [0.5, 0.2, -0.1, -0.4], [0.0, 0.2, -0.55, 1.4], [0.05, 0.2, 0.45, 0.1],
      [-0.25, 0.55, -0.15, 0.9], [0.3, 0.55, 0.05, -0.2], [0.0, 0.88, -0.05, 0.5],
    ];
    const pieces = pillows.map(([px, py, pz, ry], i) => {
      const p = mesh(rbox('nestPillow', 0.95, 0.38, 0.68, 0.17), toon(cols[i % cols.length]), px, py, pz);
      p.rotation.set((i % 3 - 1) * 0.12, ry, (i % 2 ? 0.1 : -0.12));
      g.add(p);
      return p;
    });
    // A dark doorway with grumpy eyes peeking out says "grumbles live here".
    const hole = mesh(sph(0.3), toon(0x2b2340), 0, 0.32, 0.72, false);
    hole.scale.set(1.1, 0.8, 0.35);
    g.add(hole);
    for (const s of [-1, 1]) g.add(mesh(sph(0.06, 8, 6), toon(0xfff1a8, { emissive: 0x665500 }), s * 0.1, 0.34, 0.82, false));
    this.level.add(g);
    const n = this.ents.length;
    const hp = (7 + 4 * this.floorIndex) * (1 + 0.2 * (n - 1));
    this.nests.push({ x, z, g, pieces, hp, max: hp, done: false, alive: 0, spawnT: 1.5, wob: 0, r: 1.15 });
  },

  updateNests(dt, active) {
    const n = this.ents.length, d = this.floorIndex;
    const interval = Math.max(1.8, (3.6 - 0.25 * (n - 1)) * (1 - 0.06 * d));
    const perNest = 2 + Math.floor((n + 1) / 2) + Math.floor(d / 2);
    const cap = 8 + 2 * n + d;
    for (const nest of this.nests) {
      if (nest.done) continue;
      nest.wob = Math.max(0, nest.wob - dt * 3);
      const s = 1.25 * (0.6 + 0.4 * nest.hp / nest.max);
      nest.g.scale.set(s * (1 + Math.sin(this.time * 30) * nest.wob * 0.15), s * (1 - nest.wob * 0.2), s);
      if (!active) continue;
      // Only nests the team can actually reach soon (path distance, not straight line) send grumbles.
      const f = this.flowNear(nest.x, nest.z);
      if (f < 0 || f > 11) continue;
      nest.spawnT -= dt;
      if (nest.spawnT <= 0) {
        nest.spawnT = interval * (0.8 + Math.random() * 0.4);
        if (nest.alive < perNest && this.grumbles.length < cap) {
          const elite = d >= 2 && Math.random() < 0.04;
          this.spawnGrumble(nest.x, nest.z, nest, pickKind(d), null, { elite });
        }
      }
    }
  },

  /** Smallest flow distance on the tiles around a point (-1 = nobody near). */
  flowNear(x, z) {
    const c = this.tileC(x), r = this.tileR(z);
    let best = -1;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const f = this.flowAt(c + dc, r + dr);
        if (f >= 0 && (best < 0 || f < best)) best = f;
      }
    }
    return best;
  },

  damageNest(nest, dmg, by) {
    if (nest.done) return;
    nest.hp -= dmg;
    nest.wob = 1;
    this.puffs.burst(new THREE.Vector3(nest.x, 0.9, nest.z), 0xffffff, { count: 5, size: 0.25, life: 0.6, speed: 3 });
    this.game.audio.play('bump');
    if (nest.hp > 0) return;
    nest.done = true;
    if (by) by.nests++;
    this.level.remove(nest.g);
    for (const p of nest.pieces) {
      const wp = p.getWorldPosition(new THREE.Vector3());
      const piece = mesh(p.geometry, p.material, wp.x, wp.y, wp.z);
      piece.rotation.copy(p.rotation);
      this.level.add(piece);
      const a = Math.random() * Math.PI * 2;
      this.fx.push({ kind: 'piece', obj: piece, life: 1.1, max: 1.1, vx: Math.cos(a) * 4, vy: 5 + Math.random() * 3, vz: Math.sin(a) * 4, spin: (Math.random() - 0.5) * 10 });
    }
    const at = new THREE.Vector3(nest.x, 1, nest.z);
    this.confetti.burst(at, 0, { count: 50, speed: 8, up: 5, colors: [COLORS.candyPink, COLORS.candyBlue, COLORS.candyYellow, COLORS.white], life: 1.3, gravity: -9, size: 0.18 });
    this.puffs.burst(at, 0xffffff, { count: 14, size: 0.5, life: 1, speed: 4 });
    for (let i = 0; i < 3; i++) this.spawnStarFx(nest.x, 1, nest.z);
    for (let i = 0; i < 4; i++) this.spawnItem('coin', nest.x, nest.z, true);
    if (Math.random() < 0.4) this.spawnItem('snack', nest.x, nest.z, true);
    if (Math.random() < (this.lootRates || COOP_LOOT_RATES).nest) this.dropLoot(nest.x, nest.z, 'nest');
    this.gainXp(12 + 3 * this.floorIndex, nest.x, nest.z);
    this.floater(t('keep.nest'), new THREE.Vector3(nest.x, 2.2, nest.z), by ? by.p.css : '#ff4f9a', 1.2);
    this.game.audio.play('star');
  },

  /** Does a shield grumble block a hit coming from (fx, fz)? */
  blocks(g, fx, fz) {
    if (g.kind !== 'shield' || g.state === 'sleep' || g.state === 'dizzy' || g.state === 'bubble' || g.state === 'idle') return false;
    return angDiff(Math.atan2(fx - g.x, fz - g.z), g.yaw) < 1.15;
  },

  blockFx(g) {
    this.game.audio.play('boing');
    // Keep bonking: after a few blocks in a row the cushion wobbles and the shield is open.
    g.blockN = (g.blockN || 0) + 1;
    if (g.blockN >= 4) { g.blockN = 0; g.state = 'dizzy'; g.t = 1.6; g.vx = g.vz = 0; }
    this.puffs.burst(new THREE.Vector3(g.x + Math.sin(g.yaw) * 0.6, 0.6, g.z + Math.cos(g.yaw) * 0.6), 0x8fd8ff, { count: 3, size: 0.25, life: 0.3, speed: 2 });
    if ((g.blockMsg || 0) < this.time) {
      g.blockMsg = this.time + 1.5;
      this.floater(t('keep.block'), new THREE.Vector3(g.x, 1.9, g.z), '#4f7fd9', 0.8);
    }
  },

  /** from = where the hit came from (for shields); null = from everywhere (spins, songs). */
  hitGrumble(g, dmg, by, kx = 0, kz = 0, from = null) {
    if (g.dead) return false;
    if (from && this.blocks(g, from.x, from.z)) { this.blockFx(g); g.kx += kx * 0.4; g.kz += kz * 0.4; return false; }
    if (g.state === 'bubble') { this.popBubble(g, by); return true; }
    if (g.state === 'idle') this.wakePack(g);
    g.hp -= dmg * (g.state === 'dizzy' ? 1.5 : 1);
    if (!(g.elite && g.trait === 'bouncy')) { g.kx += kx; g.kz += kz; }
    if (g.hp <= 0) this.fluffGrumble(g, by);
    else { this.game.audio.play('bump'); g.flash = 0.2; }
    return true;
  },

  trapGrumble(g, by) {
    if (g.dead) return;
    if (g.state === 'bubble') { this.popBubble(g, by); return; }
    if (g.state === 'idle') this.wakePack(g);
    g.state = 'bubble';
    g.t = g.elite ? 2.5 : 6;
    g.bubble.visible = true;
    this.game.audio.play('trap');
  },

  /** Popping a bubbled grumble is a big bonk (Pop Splash: it also bonks the ones around it). */
  popBubble(g, by) {
    g.state = 'walk';
    g.bubble.visible = false;
    const dmg = (by ? by.st.dmg : 1) * 4;
    this.puffs.burst(new THREE.Vector3(g.x, 0.9, g.z), 0xbfe9ff, { count: 8, size: 0.4, life: 0.5, speed: 3 });
    this.game.audio.play('pop');
    const splash = by && this.hasSkill(by, 'splash');
    this.hitGrumble(g, dmg, by);
    if (splash) {
      for (const o of [...this.grumbles]) if (o !== g && !o.dead && Math.hypot(o.x - g.x, o.z - g.z) < 2.6) this.hitGrumble(o, dmg * 0.5, by);
      this.addFx('ring', g.x, g.z, { color: 0xbfe9ff, from: 0.4, to: 2.6, life: 0.35 });
    }
  },

  wakePack(g) {
    if (g.pack) {
      if (!g.pack.awake) {
        g.pack.awake = true;
        for (const o of this.grumbles) if (o.pack === g.pack && o.state === 'idle') { o.state = 'walk'; o.hitCd = 0.5; }
        const elite = this.grumbles.find((o) => o.pack === g.pack && o.elite);
        if (elite) { this.game.ui.toast(elite.name, 1600); this.game.audio.play('boing'); }
      }
    } else if (g.state === 'idle') g.state = 'walk';
  },

  /** A fluffed grumble poofs into confetti and stars, gives XP and sometimes coins or gear. */
  fluffGrumble(g, by) {
    if (g.dead) return;
    g.dead = true;
    this.level.remove(g.g);
    if (g.label) g.label.remove();
    if (g.nest) g.nest.alive--;
    const at = new THREE.Vector3(g.x, 0.6 + g.y, g.z);
    this.confetti.burst(at, 0, { count: g.elite ? 50 : 18, speed: 6, up: 3, colors: [g.g.userData.body.material.color.getHex(), COLORS.gold, COLORS.white, COLORS.candyPink], life: 0.9, size: 0.14 });
    this.puffs.burst(at, 0xffffff, { count: 5, size: 0.35, life: 0.5 });
    this.spawnStarFx(g.x, 0.8, g.z);
    this.game.audio.play('pop');
    if (by === undefined) return; // swept away (boss asleep, floor change)
    if (by) by.fluffed = (by.fluffed || 0) + 1;
    const coins = g.elite ? 6 : Math.random() < 0.5 ? 2 : 1;
    for (let i = 0; i < coins; i++) this.spawnItem('coin', g.x, g.z, true);
    this.gainXp((3 + this.floorIndex) * g.type.xp * (g.elite ? 6 : 1), g.x, g.z);
    if (g.elite) {
      if (Math.random() < (this.lootRates || COOP_LOOT_RATES).elite) this.dropLoot(g.x, g.z, 'elite', 1);
      if (Math.random() < 0.6) this.spawnItem('snack', g.x, g.z, true);
      if (g.trait === 'splitter') for (let i = 0; i < 2; i++) this.spawnGrumble(g.x + (i ? 0.8 : -0.8), g.z, null, 'basic');
    } else if (Math.random() < (this.lootRates || COOP_LOOT_RATES).grumble) this.dropLoot(g.x, g.z, 'grumble');
  },

  /** Multi-source BFS from every awake player: grumbles walk downhill on this field. */
  updateFlow() {
    const { W, flow } = this;
    flow.fill(-1);
    const q = [];
    for (const e of this.ents) {
      if (e.state !== 'walk') continue;
      const c = this.tileC(e.x), r = this.tileR(e.z), i = r * W + c;
      if (this.walkable(c, r) && flow[i] < 0) { flow[i] = 0; q.push(i); }
    }
    for (let h = 0; h < q.length; h++) {
      const i = q[h], c = i % W, r = (i - c) / W, d = flow[i];
      if (d >= 16) continue;
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nc = c + dc, nr = r + dr, j = nr * W + nc;
        if (this.walkable(nc, nr) && flow[j] < 0) { flow[j] = d + 1; q.push(j); }
      }
    }
  },

  flowAt(c, r) { return this.walkable(c, r) ? this.flow[r * this.W + c] : -1; },

  /** Straight walkable line between two points (for aiming charges and throws). */
  clearLine(x0, z0, x1, z1) {
    const d = Math.hypot(x1 - x0, z1 - z0), n = Math.ceil(d / 0.5);
    for (let i = 1; i < n; i++) if (!this.walkableAt(x0 + (x1 - x0) * i / n, z0 + (z1 - z0) * i / n)) return false;
    return true;
  },

  nearestEnt(g, max = Infinity) {
    let best = null, bd = max;
    for (const e of this.ents) {
      if (e.state !== 'walk') continue;
      const d = Math.hypot(e.x - g.x, e.z - g.z);
      if (d < bd) { bd = d; best = e; }
    }
    return best ? { e: best, d: bd } : null;
  },

  /** Direction toward the players along the flow field (null when nobody is near). */
  chaseDir(g) {
    const c = this.tileC(g.x), r = this.tileR(g.z), here = this.flowAt(c, r);
    if (here >= 0 && here <= 1) {
      const n = this.nearestEnt(g);
      return n ? { x: n.e.x, z: n.e.z } : null;
    }
    if (here > 1 && here <= 11) {
      let best = here, tx = null, tz = null;
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        if (dc && dr && (!this.walkable(c + dc, r) || !this.walkable(c, r + dr))) continue;
        const f = this.flowAt(c + dc, r + dr);
        if (f >= 0 && f < best) { best = f; tx = this.cx(c + dc); tz = this.cz(r + dr); }
      }
      return tx === null ? null : { x: tx, z: tz };
    }
    return null;
  },

  updateGrumbles(dt, active) {
    const base = 2.5 * (1 + 0.05 * this.floorIndex);
    const yawnK = 1 + 0.15 * this.floorIndex;
    for (const g of this.grumbles) {
      if (g.dead) continue;
      g.hitCd -= dt;
      g.actCd -= dt;
      g.flash = Math.max(0, (g.flash || 0) - dt);
      let mvx = 0, mvz = 0;
      const sp = base * g.speed;
      if (g.state === 'idle') {
        // Snoozing in its room until the team gets close (by path, so not through walls).
        if (active && Math.random() < dt * 4) {
          const f = this.flowNear(g.x, g.z);
          if (f >= 0 && f <= 5) this.wakePack(g);
        }
        if (Math.random() < dt * 0.4) this.puffs.burst(new THREE.Vector3(g.x + 0.2, 1.2, g.z), 0xc9a8ff, { count: 1, size: 0.18, life: 1, speed: 0.4 });
      } else if (g.state === 'pop') {
        g.t += dt;
        if (g.t > 0.35) g.state = 'walk';
      } else if (g.state === 'bubble') {
        g.t -= dt;
        g.y += (0.7 - g.y) * Math.min(1, dt * 4);
        if (g.t <= 0) { g.state = 'walk'; g.bubble.visible = false; }
        for (const e of this.ents) {
          if (e.state === 'walk' && Math.hypot(e.x - g.x, e.z - g.z) < PR + 0.75) { this.popBubble(g, e); break; }
        }
      } else if (g.state === 'sleep' || g.state === 'dizzy') {
        g.t -= dt;
        if (g.state === 'sleep' && Math.random() < dt * 1.5) this.puffs.burst(new THREE.Vector3(g.x + 0.2, 1.3, g.z), 0xc9a8ff, { count: 1, size: 0.2, life: 1, speed: 0.4 });
        if (g.t <= 0) g.state = 'walk';
      } else if (g.state === 'aim') {
        // Charger wind-up: shaking in place while its line shows on the floor.
        g.t -= dt;
        if (g.t <= 0) { g.state = 'dash'; g.ran = 0; this.game.audio.play('dash'); }
      } else if (g.state === 'dash' && active) {
        const step = 13 * dt;
        const ox = g.x, oz = g.z;
        this.moveCircle(g, Math.sin(g.yaw) * step, Math.cos(g.yaw) * step, GR * g.size);
        const moved = Math.hypot(g.x - ox, g.z - oz);
        g.ran += step;
        for (const e of this.ents) {
          if (e.state !== 'walk' || Math.hypot(e.x - g.x, e.z - g.z) > PR + GR * g.size + 0.1) continue;
          if (this.addYawn(e, g.type.yawn * yawnK)) { e.vx += Math.sin(g.yaw) * 10; e.vz += Math.cos(g.yaw) * 10; }
        }
        if (moved < step * 0.5 || g.ran >= g.len) { g.state = 'dizzy'; g.t = moved < step * 0.5 ? 1.4 : 0.6; g.actCd = 3 + Math.random(); }
      } else if (g.state === 'walk' && active) {
        let goal = this.chaseDir(g);
        const near = this.nearestEnt(g, 14);
        let k = 1;
        if (g.kind === 'charger' && near && near.d < 8 && near.d > 2 && g.actCd <= 0 && this.clearLine(g.x, g.z, near.e.x, near.e.z)) {
          // Charge: paint the line, wait, then go.
          g.state = 'aim';
          g.t = 0.75;
          g.yaw = Math.atan2(near.e.x - g.x, near.e.z - g.z);
          g.len = Math.min(10, this.lineLength(g.x, g.z, g.yaw, 10));
          this.hazards.add({ shape: 'rect', x: g.x, z: g.z, yaw: g.yaw, len: g.len, width: 1.2, warn: 0.75, noHit: true, life: 0.2 });
        } else if (g.kind === 'thrower' && near) {
          // Keep a safe distance and lob pillows where a player stands.
          if (near.d < 4.5) { goal = { x: g.x - (near.e.x - g.x), z: g.z - (near.e.z - g.z) }; k = 0.8; }
          else if (near.d < 8.5 && this.clearLine(g.x, g.z, near.e.x, near.e.z)) goal = null;
          if (g.actCd <= 0 && near.d < 11 && this.clearLine(g.x, g.z, near.e.x, near.e.z)) {
            g.actCd = 2.6 + Math.random() * 0.8 - this.floorIndex * 0.15;
            g.throwT = 0.4;
            const lead = 0.35;
            const tx = near.e.x + near.e.vx * lead, tz = near.e.z + near.e.vz * lead;
            const ok = this.walkableAt(tx, tz);
            this.hazards.add({ shape: 'circle', x: ok ? tx : near.e.x, z: ok ? tz : near.e.z, r: 1.05, warn: 1.15, drop: true, dropColor: COLORS.candyPink, yawn: g.type.yawn * yawnK });
            g.yaw = Math.atan2(near.e.x - g.x, near.e.z - g.z);
            this.game.audio.play('whoosh');
          }
        }
        if (g.state === 'walk') {
          let s2 = sp * k;
          if (!goal && g.kind !== 'thrower') {
            // Nobody close: potter around home.
            g.wanderT -= dt;
            if (g.wanderT <= 0) {
              g.wanderT = 2 + Math.random() * 2;
              const hx = g.nest ? g.nest.x : g.x, hz = g.nest ? g.nest.z : g.z;
              const px = hx + (Math.random() - 0.5) * 6, pz = hz + (Math.random() - 0.5) * 6;
              if (this.walkableAt(px, pz)) { g.wx = px; g.wz = pz; }
            }
            goal = { x: g.wx, z: g.wz };
            s2 *= 0.4;
          }
          if (goal) {
            const dx = goal.x - g.x, dz = goal.z - g.z, d = Math.hypot(dx, dz);
            if (d > 0.05) { mvx = dx / d * s2; mvz = dz / d * s2; }
          }
          // Shields turn slowly toward their target, so friends can get around them.
          const face = near ? Math.atan2(near.e.x - g.x, near.e.z - g.z) : Math.abs(mvx) + Math.abs(mvz) > 0.1 ? Math.atan2(mvx, mvz) : g.yaw;
          const turn = g.kind === 'shield' ? 1.3 : 12;
          const diff = Math.atan2(Math.sin(face - g.yaw), Math.cos(face - g.yaw));
          g.yaw += clamp(diff, -turn * dt, turn * dt);
          // Touching a player makes them yawn; the grumble bounces off.
          for (const e of this.ents) {
            if (e.state !== 'walk' || g.hitCd > 0) continue;
            const ex = g.x - e.x, ez = g.z - e.z, ed = Math.hypot(ex, ez);
            if (ed < PR + GR * g.size) {
              g.hitCd = 1.2;
              g.kx += ex / (ed || 1) * 7; g.kz += ez / (ed || 1) * 7;
              this.addYawn(e, g.type.yawn * yawnK * (g.elite ? 1.25 : 1));
            }
          }
          // Sleepy elites make everyone near them yawn a little.
          if (g.elite && g.trait === 'sleepy') {
            g.auraT -= dt;
            if (g.auraT <= 0) {
              g.auraT = 1.6;
              for (const e of this.ents) if (e.state === 'walk' && Math.hypot(e.x - g.x, e.z - g.z) < 3.2) this.addYawn(e, 0.1);
              this.addFx('ring', g.x, g.z, { color: 0xc9a8ff, from: 0.5, to: 3.2, life: 0.5 });
            }
          }
        }
      }
      g.vx += (mvx - g.vx) * Math.min(1, dt * 8);
      g.vz += (mvz - g.vz) * Math.min(1, dt * 8);
      const decay = Math.max(0, 1 - dt * 6);
      g.kx *= decay; g.kz *= decay;
      if (g.state !== 'bubble' && g.state !== 'dash') {
        this.moveCircle(g, (g.vx + g.kx) * dt, (g.vz + g.kz) * dt, GR * g.size);
        if (g.state !== 'walk') g.vx = g.vz = 0;
      }
    }
    // Keep grumbles from piling into one spot.
    const L = this.grumbles;
    for (let i = 0; i < L.length; i++) {
      for (let j = i + 1; j < L.length; j++) {
        const a = L[i], b = L[j];
        if (a.dead || b.dead || a.state === 'bubble' || b.state === 'bubble') continue;
        const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz), min = 0.4 * (a.size + b.size);
        if (d < min && d > 0.001) {
          const push = (min - d) / 2;
          a.x -= dx / d * push; a.z -= dz / d * push;
          b.x += dx / d * push; b.z += dz / d * push;
        }
      }
    }
    this.grumbles = this.grumbles.filter((g) => !g.dead);
    for (const g of this.grumbles) this.poseGrumble(g, dt);
  },

  lineLength(x, z, yaw, max) {
    let d = 0;
    while (d < max && this.walkableAt(x + Math.sin(yaw) * (d + 0.6), z + Math.cos(yaw) * (d + 0.6))) d += 0.25;
    return Math.max(1, d);
  },

  poseGrumble(g, dt) {
    const grow = g.state === 'pop' ? Math.min(1, g.t / 0.35) : 1;
    const breathe = g.state === 'sleep' || g.state === 'idle' ? 1 + Math.sin(this.time * 3 + g.phase) * 0.06 : 1;
    const s = g.size * grow;
    g.g.scale.set(s, s * breathe * (g.flash > 0 ? 0.7 : 1), s);
    let y = g.state === 'bubble' ? g.y + Math.sin(this.time * 3 + g.phase) * 0.08 : (g.y = Math.max(0, g.y - dt * 3));
    let shake = 0;
    if (g.state === 'aim') shake = Math.sin(this.time * 50) * 0.08;
    if (g.state === 'walk' && Math.abs(g.vx) + Math.abs(g.vz) > 0.1) y = Math.abs(Math.sin(this.time * 12 + g.phase)) * 0.12;
    g.g.position.set(g.x + shake, y, g.z);
    g.g.rotation.y = g.yaw;
    g.g.rotation.z = g.state === 'sleep' || g.state === 'idle' ? 0.3 : g.state === 'dizzy' ? Math.sin(this.time * 10) * 0.2 : 0;
    if (g.g.userData.arm) {
      g.throwT = Math.max(0, (g.throwT || 0) - dt);
      g.g.userData.arm.rotation.x = g.throwT > 0 ? -1.5 * Math.sin(g.throwT / 0.4 * Math.PI) : 0;
    }
    if (g.g.userData.aura) {
      g.g.userData.aura.rotation.z += dt * 2;
      g.g.userData.crown.rotation.y += dt * 3;
    }
    if (g.label) {
      const pct = Math.max(0, g.hp / g.max) * 100;
      const html = `${esc(g.name)}<span style="display:block;margin:2px auto 0;width:4.5em;height:.4em;border-radius:1em;background:#5a4a7a;overflow:hidden;-webkit-text-stroke:0"><span style="display:block;height:100%;width:${pct.toFixed(0)}%;background:#ffb400"></span></span>`;
      if (html !== g.labelHtml) { g.label.innerHTML = html; g.labelHtml = html; }
      this.game.ui.place(g.label, new THREE.Vector3(g.x, 1.9 * g.size + y, g.z), this.camera);
    }
  },
};
