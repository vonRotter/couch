import { DIRS, TALL, ARROW_RANGE, tileX, tileZ, colOf, rowOf, inGrid, pegUp } from './tiles.js';
import { makeBomb, makeArrow } from './models.js';

// Part 2 items on [C]: bombs and the Wind Bow. Mixed into LighthouseEngine.
//
// Bombs: [C] sets a bomb down in front of you (one at a time). It ticks for a moment, then blows
// up: cracked rock and cracked walls break, enemies and switches get hit (and so do you, if you
// stand too close). [B] picks a ticking bomb up and throws it, over chasms too.
//
// Arrows: [C] shoots an arrow straight ahead. Arrows hit enemies, crystal switches and stone eyes,
// and fly over holes and water. An arrow that flies through a lit torch catches fire: a fire arrow
// lights the next unlit torch it meets and burns thorns.

const FUSE = 1.7;
const ARROW_SPEED = 15;

export const ToolsMixin = {
  // ---------- bombs ----------

  placeBomb() {
    const room = this.room;
    const h = this.hero;
    if (room.bombs.length >= 1) { this.notice('lh.oneBomb'); return; }
    const v = DIRS[h.face];
    const fc = colOf(h.x + v.dx * 0.8), fr = rowOf(h.z + v.dz * 0.8);
    let x = h.x, z = h.z;
    if (inGrid(fc, fr) && !this.heroBlocked(room, fc, fr) && !['o', '~'].includes(room.grid[fr][fc]) && !room.doorAt.has(`${fc},${fr}`)) {
      x = tileX(fc);
      z = tileZ(fr);
    }
    const m = makeBomb();
    m.position.set(x, 0, z);
    room.group.add(m);
    room.bombs.push({ x, z, fuse: FUSE, mesh: m, state: 'ground' });
    this.sfx('fuse');
    this.hintOnce('lh.bomb.hint');
  },

  updateBombs(dt) {
    const room = this.room;
    const h = this.hero;
    for (const b of room.bombs) {
      b.fuse -= dt;
      if (b.state === 'carried') { b.x = h.x; b.z = h.z; }
      const u = b.mesh.userData;
      // the bomb swells and blinks faster just before it goes off
      const hurry = b.fuse < 0.6;
      u.spark.visible = Math.floor(b.fuse * (hurry ? 18 : 8)) % 2 === 0;
      u.ball.scale.setScalar(1 + (hurry ? (0.6 - b.fuse) * 0.4 : 0) + Math.sin(this.time * 20) * 0.02);
      if (b.fuse <= 0) {
        b.dead = true;
        if (b.state === 'carried' && h.carry?.bomb === b) h.carry = null;
        room.thrown = room.thrown.filter((p) => p.bomb !== b);
        b.mesh.parent?.remove(b.mesh);
        this.blast(room, b.x, b.z);
      }
    }
    room.bombs = room.bombs.filter((b) => !b.dead);
  },

  // ---------- arrows ----------

  shootArrow() {
    const room = this.room;
    const h = this.hero;
    if ((this.arrowCool || 0) > 0 || room.arrows.length >= 2) return;
    this.arrowCool = 0.32;
    const v = DIRS[h.face];
    const m = makeArrow();
    m.rotation.y = Math.atan2(v.dx, v.dz);
    const a = { x: h.x + v.dx * 0.35, z: h.z + v.dz * 0.35, dx: v.dx, dz: v.dz, dist: 0, fire: false, mesh: m, tile: `${colOf(h.x)},${rowOf(h.z)}` };
    m.position.set(a.x, 0.5, a.z);
    room.group.add(m);
    room.arrows.push(a);
    this.sfx('arrow');
  },

  updateArrows(dt) {
    const room = this.room;
    if (this.arrowCool > 0) this.arrowCool -= dt;
    for (const a of room.arrows) {
      // small steps, so an arrow never skips a tile or an enemy
      let left = ARROW_SPEED * dt;
      while (left > 0 && !a.dead) {
        const step = Math.min(0.25, left);
        left -= step;
        // a strong head wind (Stormbeak's gale) blows arrows back
        if (room.gale && (a.dx === -room.gale.dx && a.dz === -room.gale.dz) && a.dist > 1.2) { this.arrowFizzle(a, true); break; }
        a.x += a.dx * step;
        a.z += a.dz * step;
        a.dist += step;
        this.arrowStep(room, a);
        if (!a.dead && a.dist >= ARROW_RANGE) this.arrowFizzle(a);
      }
      a.mesh.position.set(a.x, 0.5, a.z);
    }
    for (const a of room.arrows) if (a.dead) a.mesh.parent?.remove(a.mesh);
    room.arrows = room.arrows.filter((a) => !a.dead);
  },

  arrowFizzle(a, blown = false) {
    a.dead = true;
    this.puffAt(a.x, a.z, blown ? 0xe9e2ff : 0xd8b27a, 5, 0.5);
    if (blown) this.sfx('whoosh');
  },

  /** What the arrow meets on its way: tiles first (when it enters a new one), then enemies. */
  arrowStep(room, a) {
    const c = colOf(a.x), r = rowOf(a.z);
    if (!inGrid(c, r)) { a.dead = true; return; }
    const k = `${c},${r}`;
    if (k !== a.tile) {
      a.tile = k;
      const ch = room.grid[r][c];
      const e = this.entAt(room, c, r) || room.ents.find((x) => x.t === 'eye' && x.c === c && x.r === r);
      const torch = room.torches.find((tc) => tc.c === c && tc.r === r);
      const stop = (snd = 'clink') => { a.dead = true; this.sfx(snd); this.sparkAt(a.x - a.dx * 0.3, a.z - a.dz * 0.3); };
      if (e && e.t === 'eye') { a.dead = true; this.hitEye(room, e); return; }
      if (torch) {
        if (torch.lit) {
          // through the flame: now it is a fire arrow
          if (!a.fire) { a.fire = true; a.mesh.userData.flame.visible = true; this.sfx('flame'); this.hintOnce('lh.fire.hint'); }
          return;
        }
        if (a.fire) { a.dead = true; this.lightTorch(room, torch); return; }
        stop();
        return;
      }
      if (e && e.t === 'switch') { a.dead = true; this.toggleSwitch(room); this.sparkAt(e.x, e.z); return; }
      const door = room.doorAt.get(k);
      if (door && !door.open) { stop(); return; }
      if (ch === '*' && a.fire) { a.dead = true; this.burnTile(room, c, r); return; }
      if (TALL.has(ch) || ((ch === 'x' || ch === 'y') && pegUp(ch, this.sw(room.area))) || (e && e.solid && e.t !== 'warp')) { stop(); return; }
    }
    for (const en of room.enemies) {
      if (en.dead || (en.fly && en.y > (en.arrowReach || 2.6))) continue;
      const part = en.parts().find((pt) => Math.hypot(pt.x - a.x, pt.z - a.z) < pt.r + 0.15);
      if (part) {
        a.dead = true;
        const res = en.hurt(1, a.x - a.dx, a.z - a.dz, a.fire ? 'fire' : 'arrow', part.part);
        if (res === 'clang') this.sparkAt(a.x, a.z);
        return;
      }
    }
  },
};
