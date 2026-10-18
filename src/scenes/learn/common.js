import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Round } from '../party/common.js';
import { COLORS, toon, sharedGeo } from '../../core/palette.js';
import { makeTree, makeFlower, makeCloud, seeded } from '../../core/world.js';
import { LEVELS, shuffle } from '../../core/edu.js';
import { esc } from '../../core/ui.js';

// Shared pieces for the Læringsmiks rounds: a fenced top-down field where every
// player walks to answer tiles for their own task (like Mattejakt).

export const HW = 13, HD = 8;
const PR = 0.42;
const SPEED = 6.2;
export const ROUND_TIME = 60;
export const TILE_COLORS = [0xffe47a, 0x9ff0c8, 0x8fd8ff, 0xff9fd0, 0xc9a8ff, 0xffc08a];

// ---------- text on canvases ----------

const texCache = new Map();
const matCache = new Map();

/**
 * Chunky outlined text on a transparent canvas. `lines` is a list of strings or
 * [text, relativeSize] pairs; the text shrinks to fit the canvas.
 */
export function textTexture(lines, { w = 512, h = 256, fg = '#2b2340', stroke = '#ffffff' } = {}) {
  const rows = lines.map((l) => (Array.isArray(l) ? l : [l, 1]));
  const key = `${JSON.stringify(rows)}|${w}|${h}|${fg}|${stroke}`;
  let tex = texCache.get(key);
  if (tex) return tex;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  const font = (px) => `700 ${px}px Fredoka, "Trebuchet MS", sans-serif`;
  const weight = rows.reduce((s, [, r]) => s + r, 0);
  // Base size from the height, then shrink until the widest line fits.
  // Leave headroom for Å rings and descenders.
  let base = (h * 0.74) / (weight * 1.08);
  for (const [text, r] of rows) {
    g.font = font(base * r);
    const tw = g.measureText(text).width + base * r * 0.16;
    if (tw > w * 0.94) base *= (w * 0.94) / tw;
  }
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  const total = rows.reduce((s, [, r]) => s + base * r * 1.08, 0);
  let y = (h - total) / 2;
  for (const [text, r] of rows) {
    const px = base * r;
    g.font = font(px);
    g.lineWidth = px * 0.16;
    g.strokeStyle = stroke;
    const cy = y + px * 0.54 + px * 0.04;
    g.strokeText(text, w / 2, cy);
    g.fillStyle = fg;
    g.fillText(text, w / 2, cy);
    y += px * 1.08;
  }
  tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.userData.shared = true;
  texCache.set(key, tex);
  return tex;
}

/** Shared transparent material showing text; never disposed. */
export function textMaterial(lines, opts = {}) {
  const key = `${JSON.stringify(lines)}|${JSON.stringify(opts)}`;
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ map: textTexture(lines, opts), transparent: true, depthWrite: false });
    m.userData.shared = true;
    matCache.set(key, m);
  }
  return m;
}

/** Splits a long phrase into two balanced lines ("ti på halv fem" -> "ti på" / "halv fem"). */
export function splitPhrase(text, max = 10) {
  if (text.length <= max || !text.includes(' ')) return [text];
  let best = null;
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== ' ') continue;
    const d = Math.abs(i - text.length / 2);
    if (!best || d < best.d) best = { i, d };
  }
  return [text.slice(0, best.i), text.slice(best.i + 1)];
}

/** A rounded answer board lying on the field, tilted toward the camera. */
export function makeBoard(lines, color, { w = 3.4, d = 1.7 } = {}) {
  const g = new THREE.Group();
  const board = new THREE.Mesh(sharedGeo(`lmBoard${w}x${d}`, () => new RoundedBoxGeometry(w, 0.3, d, 3, 0.14)), toon(color));
  board.castShadow = true;
  const edge = new THREE.Mesh(sharedGeo(`lmEdge${w}x${d}`, () => new RoundedBoxGeometry(w + 0.16, 0.22, d + 0.16, 3, 0.12)), toon(COLORS.white));
  edge.position.y = -0.06;
  const face = new THREE.Mesh(sharedGeo(`lmFace${w}x${d}`, () => new THREE.PlaneGeometry(w - 0.12, d - 0.1)), textMaterial(lines));
  face.rotation.x = -Math.PI / 2;
  face.position.y = 0.16;
  g.add(edge, board, face);
  g.rotation.x = 0.45;
  return g;
}

// ---------- the field round ----------

/**
 * Base for a Læringsmiks round. Subclasses implement:
 *  newTask(e)        give player e a new task (e.task). Prefer a task whose answer is
 *                    already on the field (see freeTiles): spawning the answer fresh would
 *                    make the newest tile the right one nearly every time.
 *  need(e)           one tile value that must exist on the field for e (always reachable)
 *  isRight(e, tile)  true if touching this tile answers e's task
 *  filler()          a value for a random practice tile
 *  makeTile(value)   { mesh, w, d } for a tile showing value
 *  onRight(e, tile)  called on a correct touch (default: score + celebrate + next task)
 *  card(e)           inner HTML for the player's card in the bottom bar
 *  tag(e)            HTML for the label above the player (or '' for none)
 */
export class FieldRound extends Round {
  constructor(mix, theme = {}) {
    super(mix);
    this.mix = mix;
    this.timeLeft = ROUND_TIME;
    this.tiles = [];
    this.ensureT = 0;
    this.cardCache = '';
    this.labelsHidden = false;
    this.buildField(theme);
    const n = this.players.length;
    this.ents = this.players.map((p, i) => {
      const a = (i / n) * Math.PI * 2 + 0.3;
      return {
        p, i, ch: this.bean(p), tagEl: this.label('label edu-tag'), tagPos: new THREE.Vector3(),
        x: n === 1 ? 0 : Math.cos(a) * 2.6, z: n === 1 ? 0 : Math.sin(a) * 1.6, vx: 0, vz: 0, dirX: 0, dirZ: 1,
        task: null, score: 0, wrongCd: 0, doneT: 0, flash: null, flashT: 0,
      };
    });
  }

  get tileCount() {
    return 7 + this.players.length * 2;
  }

  levelKey(e) {
    return LEVELS[e.p.eduLevel ?? 0].key;
  }

  levelName(e) {
    return LEVELS[e.p.eduLevel ?? 0].name;
  }

  /** Called by the mix once levels are known, before the how-to card. */
  prepare() {
    // Fill the field first, so the first tasks can be picked from tiles already lying there.
    for (let i = 0; i < this.tileCount; i++) this.spawnTile();
    for (const e of shuffle(this.ents)) this.newTask(e);
    this.ensure();
  }

  frame() {
    const tilt = THREE.MathUtils.degToRad(56);
    const d = this.mix.fitDistance(HW * 2 + 3, HD * 2 * Math.sin(tilt) + 7);
    this.camera.position.set(0, Math.sin(tilt) * d, Math.cos(tilt) * d + 0.8);
    this.camera.lookAt(0, 0, 0.8);
    this.mix.confettiOrigin = new THREE.Vector3(0, 3, 0);
  }

  buildField({ field = COLORS.grass, fences = [COLORS.candyPink, COLORS.candyBlue, COLORS.candyYellow, COLORS.candyMint], seed = 7, flowers = 40 } = {}) {
    const g = this.group;
    const f = new THREE.Mesh(sharedGeo('lmField', () => new RoundedBoxGeometry(HW * 2 + 1, 1, HD * 2 + 1, 3, 0.4)), toon(field));
    f.position.y = -0.5;
    f.receiveShadow = true;
    g.add(f);
    const fence = (x, z, w, d, c) => {
      const m = new THREE.Mesh(new RoundedBoxGeometry(w, 0.6, d, 2, 0.22), toon(c));
      m.position.set(x, 0.25, z);
      m.castShadow = m.receiveShadow = true;
      g.add(m);
    };
    fence(0, -HD - 0.4, HW * 2 + 1.6, 0.7, fences[0]);
    fence(0, HD + 0.4, HW * 2 + 1.6, 0.7, fences[1]);
    fence(-HW - 0.4, 0, 0.7, HD * 2, fences[2]);
    fence(HW + 0.4, 0, 0.7, HD * 2, fences[3]);
    const ground = new THREE.Mesh(sharedGeo('lmGround', () => new THREE.CircleGeometry(80, 40)), toon(COLORS.grassDark));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -1;
    g.add(ground);
    const rand = seeded(seed);
    for (let i = 0; i < 22; i++) {
      const a = rand() * Math.PI * 2;
      const x = Math.cos(a) * (20 + rand() * 8), z = Math.sin(a) * (13 + rand() * 6) - 4;
      if (z > 5) continue;
      const t = makeTree(rand, 1 + rand() * 0.5);
      t.position.set(x, -1, z);
      g.add(t);
    }
    for (let i = 0; i < flowers; i++) {
      const fl = makeFlower(rand);
      fl.position.set((rand() - 0.5) * HW * 2, 0, (rand() - 0.5) * HD * 2);
      g.add(fl);
    }
    for (let i = 0; i < 6; i++) {
      const c = makeCloud(rand, 2 + rand());
      c.position.set(-40 + i * 16, 10 + rand() * 6, -30);
      g.add(c);
    }
  }

  // ---------- tiles ----------

  freeSpot(w, d) {
    let best = null, bestScore = -Infinity;
    for (let tries = 0; tries < 40; tries++) {
      // The bottom strip stays free: the player cards cover it.
      const x = (Math.random() - 0.5) * (HW * 2 - w - 0.8), z = -HD + d / 2 + 0.6 + Math.random() * (HD * 2 - d - 2.6);
      // Gap to the nearest tile edge (boxes) and to players.
      let gap = Infinity;
      for (const t of this.tiles) {
        const gx = Math.abs(t.x - x) - (t.w + w) / 2, gz = Math.abs(t.z - z) - (t.d + d) / 2;
        gap = Math.min(gap, Math.max(gx, gz));
      }
      for (const e of this.ents) gap = Math.min(gap, Math.hypot(e.x - x, e.z - z) - Math.max(w, d) / 2 - 0.6);
      if (gap > 0.6) return { x, z };
      if (gap > bestScore) { bestScore = gap; best = { x, z }; }
    }
    return best;
  }

  spawnTile(value) {
    if (value === undefined) {
      // Avoid duplicates of what is already lying around.
      for (let i = 0; i < 6; i++) {
        value = this.filler();
        if (!this.tiles.some((t) => t.value === value)) break;
      }
    }
    const { mesh, w, d, y = 0.5 } = this.makeTile(value);
    const spot = this.freeSpot(w, d);
    mesh.position.set(spot.x, y, spot.z);
    mesh.scale.setScalar(0.01);
    this.group.add(mesh);
    const tile = { value, mesh, w, d, y, x: spot.x, z: spot.z, hop: 0, phase: Math.random() * 6 };
    this.tiles.push(tile);
    return tile;
  }

  removeTile(tile) {
    this.group.remove(tile.mesh);
    this.tiles = this.tiles.filter((t) => t !== tile);
  }

  /** Tiles no other player is working toward: a new task for e may take its answer from these. */
  freeTiles(e) {
    return this.tiles.filter((t) => !this.ents.some((o) => o !== e && o.task && o.doneT <= 0 && this.isRight(o, t)));
  }

  /**
   * Every player who is working on a task always has a matching tile on the field.
   * Tasks normally come from tiles already there, so this rarely has to spawn. When it
   * does, the answer arrives in a small batch with fresh decoys in random order, so the
   * newest tile is still not a giveaway.
   */
  ensure() {
    for (const e of this.ents) {
      if (!e.task || e.doneT > 0) continue;
      const need = this.need(e);
      if (need === undefined || need === null) continue;
      if (this.tiles.some((t) => t.value === need || (this.counts(e, t)))) continue;
      // Swap out tiles nobody needs, preferring the ones far from everyone.
      const spare = this.tiles.filter((t) => !this.ents.some((o) => o.task && this.counts(o, t)));
      const far = (t) => Math.min(...this.ents.map((o) => Math.hypot(o.x - t.x, o.z - t.z))) * (0.6 + Math.random() * 0.8);
      spare.sort((a, b) => far(b) - far(a));
      const decoys = Math.min(2, spare.length);
      const room = this.tileCount - this.tiles.length;
      for (let i = 0; i < Math.max(0, decoys + 1 - room) && i < spare.length; i++) this.removeTile(spare[i]);
      for (const v of shuffle([need, ...Array(decoys).fill(undefined)])) this.spawnTile(v);
    }
  }

  /** Whether tile t would satisfy e's `need` (used by ensure). Default: right answer. */
  counts(e, t) {
    return e.doneT <= 0 && this.isRight(e, t);
  }

  // ---------- flow ----------

  start() {
    this.ensure();
  }

  onRight(e, tile) {
    e.score++;
    e.doneT = 1.2;
    this.game.audio.play('coin');
    this.game.audio.play('star');
    this.party.confetti.burst(new THREE.Vector3(tile.x, 1, tile.z), 0, { count: 26, speed: 6, colors: [e.p.color, COLORS.gold, COLORS.white] });
    e.ch.squash(1.35);
    this.removeTile(tile);
    this.ensure(); // someone else may have needed the same answer
    this.later(0.6, () => { if (!this.done && this.tiles.length < this.tileCount) this.spawnTile(); });
  }

  onWrong(e, tile) {
    // Not that one: the tile hops and nudges you away. No penalty.
    e.wrongCd = 0.7;
    tile.hop = 1;
    const dx = e.x - tile.x, dz = e.z - tile.z, d = Math.hypot(dx, dz) || 1;
    e.vx = (dx / d) * 5;
    e.vz = (dz / d) * 5;
    this.game.audio.play('bump');
  }

  /** Short text that pops up over a player (e.g. "For mye!"). */
  say(e, text, seconds = 1.1) {
    e.flash = text;
    e.flashT = seconds;
  }

  touching(e, t) {
    return Math.abs(e.x - t.x) < t.w / 2 + 0.25 && Math.abs(e.z - t.z) < t.d / 2 + 0.25;
  }

  updatePlayers(dt, playing) {
    for (const e of this.ents) {
      const inp = this.input(e.p);
      e.wrongCd -= dt;
      e.flashT -= dt;
      const ix = playing ? inp.x : 0, iz = playing ? -inp.y : 0;
      if (Math.hypot(ix, iz) > 0.2) { e.dirX = ix; e.dirZ = iz; }
      const acc = 45 * dt;
      e.vx += THREE.MathUtils.clamp(ix * SPEED - e.vx, -acc, acc);
      e.vz += THREE.MathUtils.clamp(iz * SPEED - e.vz, -acc, acc);
      e.x = THREE.MathUtils.clamp(e.x + e.vx * dt, -HW + PR, HW - PR);
      e.z = THREE.MathUtils.clamp(e.z + e.vz * dt, -HD + PR, HD - PR);

      if (e.doneT > 0) {
        e.doneT -= dt;
        if (e.doneT <= 0 && !this.done) {
          this.newTask(e);
          this.ensure();
        }
      } else if (playing && e.task) {
        for (const t of this.tiles) {
          if (!this.touching(e, t)) continue;
          if (this.isRight(e, t)) { this.onRight(e, t); break; }
          if (e.wrongCd <= 0) { this.onWrong(e, t); break; }
        }
      }
      e.ch.face(e.dirX, e.dirZ);
      e.ch.group.position.set(e.x, 0, e.z);
      e.ch.update(dt, { moving: Math.min(1, Math.hypot(e.vx, e.vz) / SPEED), grounded: true });
    }
    // Beans gently push each other apart.
    for (let i = 0; i < this.ents.length; i++) {
      for (let j = i + 1; j < this.ents.length; j++) {
        const a = this.ents[i], b = this.ents[j];
        const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
        if (d < PR * 2 && d > 1e-4) {
          const push = (PR * 2 - d) / 2;
          a.x -= (dx / d) * push; a.z -= (dz / d) * push;
          b.x += (dx / d) * push; b.z += (dz / d) * push;
        }
      }
    }
  }

  updateTiles(dt) {
    for (const t of this.tiles) {
      t.hop = Math.max(0, t.hop - dt * 2.5);
      t.mesh.position.y = t.y + Math.sin(this.time * 2 + t.phase) * 0.08 + Math.sin(t.hop * Math.PI) * 0.9;
      const s = THREE.MathUtils.lerp(t.mesh.scale.x, 1, Math.min(1, dt * 6));
      t.mesh.scale.setScalar(s);
    }
  }

  updateLabels() {
    if (this.labelsHidden) return;
    for (const e of this.ents) {
      if (!e.task) { e.tagEl.style.display = 'none'; continue; }
      const html = e.flashT > 0 ? `<span style="color:#ff5d73">${esc(e.flash)}</span>` : this.tag(e);
      if (!html) { e.tagEl.style.display = 'none'; continue; }
      e.tagPos.set(e.x, this.tagHeight(e), e.z);
      this.setLabel(e.tagEl, html, e.tagPos, e.p.css);
    }
  }

  tagHeight() {
    return 2.1;
  }

  renderCards() {
    if (this.labelsHidden) return;
    const html = this.ents.map((e) => {
      if (!e.task) return '';
      return `<div class="edu-card ${e.doneT > 0 ? 'win' : ''}" style="--c:${e.p.css}">${this.card(e)}</div>`;
    }).join('');
    if (html !== this.cardCache) {
      this.game.ui.barEl.innerHTML = html;
      this.cardCache = html;
      this.game.ui.barCache = '';
    }
  }

  update(dt, playing) {
    this.time += dt;
    this.updatePlayers(dt, playing);
    this.updateTiles(dt);
    if (playing && !this.done) {
      this.ensureT -= dt;
      if (this.ensureT <= 0) {
        this.ensureT = 0.3;
        this.ensure();
        if (this.tiles.length < this.tileCount) this.spawnTile(); // gentle top-up
      }
      this.timeLeft -= dt;
      if (this.timeLeft <= 0) { this.timeLeft = 0; this.done = true; }
    }
    this.updateLabels();
    if (this.ents.some((e) => e.task)) this.renderCards();
  }

  hud() {
    return `<div class="pill"><span class="big-num">${Math.ceil(Math.max(0, this.timeLeft))}</span></div><div class="pill hud-title">${esc(this.title)}</div>`;
  }

  score(p) {
    return this.ents.find((e) => e.p === p)?.score ?? 0;
  }

  hideLabels() {
    this.labelsHidden = true;
    super.hideLabels();
    this.game.ui.barEl.innerHTML = '';
    this.game.ui.barCache = '';
  }
}
