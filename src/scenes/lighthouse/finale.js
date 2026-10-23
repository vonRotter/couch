import * as THREE from 'three';
import { t, tFor } from '../../core/i18n.js';
import { say as speak } from '../../core/voice.js';
import { tileX, tileZ } from './tiles.js';
import { makeNpc } from './models.js';
import { makeShip } from './build.js';

// The end of the first act: the third crystal goes into the great lamp, the gloom that stole the
// crystals shows itself in the lamp room (Murk), and after the fight the ending plays: Murk turns
// out to be a small lonely puff, the ships come home, credits roll and the island stays open for
// 100% (heart pieces and golden shells). Mixed into LighthouseEngine.

const CREDIT_SECONDS = 24;

export const FinaleMixin = {
  // ---------- little actors for cutscenes ----------

  /** A townsperson (or Murky) that only lives for this room visit. */
  spawnActor(id, x, z, face = [0, 1]) {
    const room = this.room;
    const ch = makeNpc(id);
    ch.group.position.set(x, 0, z);
    ch.face(face[0], face[1]);
    room.group.add(ch.group);
    const e = { t: 'npc', id, x, z, c: Math.round(x + 8), r: Math.round(z + 5), mesh: ch.group, char: ch, solid: false, actor: true };
    room.ents.push(e);
    return e;
  },

  /** Walk an actor along points (yield* this in a cutscene). */
  *walkActor(e, points, speed = 3) {
    for (const [x, z] of points) {
      while (Math.hypot(e.mesh.position.x - x, e.mesh.position.z - z) > 0.05) {
        const dx = x - e.mesh.position.x, dz = z - e.mesh.position.z;
        const d = Math.hypot(dx, dz);
        const st = Math.min(d, speed / 60);
        e.mesh.position.x += (dx / d) * st;
        e.mesh.position.z += (dz / d) * st;
        e.x = e.mesh.position.x; e.z = e.mesh.position.z;
        e.char.face(dx, dz);
        e.char.update(1 / 60, { moving: 1 });
        yield 0;
      }
    }
  },

  /** Keeps cutscene props moving while dialogs are up (ship, lamp beams, hopping actors). */
  updateCutActors(dt) {
    const room = this.room;
    for (const a of room.anim) if (a.kind === 'spin') a.m.rotation.y += dt * 0.8;
    if (this.ship && this.ship.room === room) {
      const s = this.ship;
      s.t = Math.min(s.dur, s.t + dt);
      const p = s.t / s.dur;
      const e = 1 - (1 - p) * (1 - p);
      s.mesh.position.x = s.x0 + (s.x1 - s.x0) * e;
      s.mesh.position.y = Math.sin(this.time * 1.6) * 0.06;
      s.mesh.rotation.z = Math.sin(this.time * 1.3) * 0.04;
    }
    for (const e of room.ents) {
      if (!e.actor || !e.hop) continue;
      e.mesh.position.y = Math.abs(Math.sin(this.time * 7 + e.hop)) * 0.3;
    }
  },

  // ---------- the third crystal ----------

  /** All three crystals in the lamp: it shines, then flickers. Something waits upstairs. */
  *finaleCall() {
    const s = this.save;
    const room = this.room;
    const keeper = room.ents.find((e) => e.t === 'npc' && e.id === 'keeper');
    const K = (k) => ({ who: 'keeper', key: k });
    yield { lines: [K('lh.k.three')] };
    // the light flickers and dies down: a cold shadow passes over the room
    this.sfx('roar');
    this.shake(0.4);
    for (let i = 0; i < 3; i++) { this.hud.setDark(true); yield 0.18; this.hud.setDark(false); yield 0.22; }
    if (keeper) keeper.char.face(1, -0.3);
    yield { lines: [K('lh.k.three2'), K('lh.k.three3')] };
    s.flags.finale = true;
    s.savePoint = { room: 'h_light', at: [8, 5], face: 'n' };
    s.hp = s.maxHp;
    this.persist();
    // the stairs to the lamp room
    const spec = Object.entries(room.def.at).find(([, e]) => e.to === 'h_top');
    if (spec && !room.ents.some((e) => e.t === 'warp' && e.to === 'h_top')) {
      const [ch, e] = spec;
      let c = 0, r = 0;
      room.def.map.forEach((line, rr) => { const cc = line.indexOf(ch); if (cc >= 0) { c = cc; r = rr; } });
      const w = this.addEntity(room, { ...e, c, r });
      if (w) { w.mesh.scale.setScalar(0.01); room.anim.push({ m: w.mesh, t: 0, dur: 0.5, kind: 'grow' }); this.puffAt(w.x, w.z, 0xffffff, 14); }
      this.sfx('secret');
    }
  },

  // ---------- the lamp room ----------

  *murkIntro() {
    yield 0.8;
    yield { lines: [{ who: 'murk', key: 'lh.murk.1' }, { who: 'murk', key: 'lh.murk.2' }] };
    this.later(6, () => { if (this.room.id === 'h_top' && !this.room.solved) this.hintOnce('lh.murk.hint1'); });
  },

  // ---------- the ending ----------

  *endingScene() {
    const s = this.save;
    const room = this.room;
    const h = this.hero;
    this.game.audio.playMusic('lhEnd');
    yield 0.8;
    // where the gloom was, a small puff blinks
    const murky = this.spawnActor('murky', 0, -1.5, [0, 1]);
    this.puffAt(0, -1.5, 0xd9d2ff, 20, 0.6);
    this.sfx('secret');
    h.face = 'n';
    yield 0.8;
    yield { lines: [{ who: 'murky', key: 'lh.end.m1' }, { who: 'murky', key: 'lh.end.m2' }] };
    // the keeper climbs the stairs
    const keeper = this.spawnActor('keeper', tileX(8), tileZ(9), [0, -1]);
    yield* this.walkActor(keeper, [[tileX(8), tileZ(7.4)], [tileX(6.5), tileZ(6.4)]], 2.6);
    keeper.char.face(murky.x - keeper.x, murky.z - keeper.z);
    yield { lines: [{ who: 'keeper', key: 'lh.end.k1' }, { who: 'keeper', key: 'lh.end.k2' }, { who: 'murky', key: 'lh.end.m3' }] };
    murky.hop = 1;
    this.sfx('fanfare');
    yield 1.2;
    // dusk at Lighthouse Point: everyone came out, and a ship finds the harbor again
    this.hud.setDark(true);
    yield 0.7;
    this.dusk = true;
    this.loadRoom('o10', [8, 6], 'n');
    this.host.scene.background = new THREE.Color(0x6a5a8f);
    this.lastPlace = '';
    const pt = (c, r) => [tileX(c), tileZ(r)];
    const crowd = [['keeper', 6, 6], ['olga', 10, 6], ['tobi', 11, 7], ['mira', 5, 7], ['pell', 12, 6], ['murky', 7, 5]];
    if (s.flags.catFound) crowd.push(['mitten', 9, 7]);
    crowd.forEach(([id, c, r], i) => {
      const [x, z] = pt(c, r);
      const a = this.spawnActor(id, x, z, [tileX(8) - x, tileZ(4) - z]);
      if (id === 'tobi' || id === 'murky' || id === 'mitten') a.hop = i;
    });
    const ship = makeShip();
    ship.position.set(-11, 0, tileZ(0) - 0.4);
    ship.scale.setScalar(0.8);
    this.room.group.add(ship);
    this.ship = { room: this.room, mesh: ship, x0: -11, x1: -3.5, t: 0, dur: 6 };
    this.hud.setDark(false);
    this.game.audio.playMusic('lhEnd');
    yield 2.2;
    this.sfx('horn');
    for (let i = 0; i < 5; i++) this.later(i * 0.45, () => this.confettiAt((Math.random() - 0.5) * 8, 0.5));
    yield 1.2;
    yield { lines: [{ who: 'tobi', key: 'lh.end.t1' }, { who: 'keeper', key: 'lh.end.k3' }] };
    yield 0.6;
    this.showCredits();
  },

  // ---------- credits and the end card ----------

  creditLines() {
    const p = this.host.players[0];
    return [
      { big: t('game.lighthouse') },
      { small: t('lh.cr.act') },
      { head: t('lh.cr.hero') }, { text: p?.name || t('lh.who.you') },
      { head: t('lh.cr.island') },
      { text: `${t('lh.who.keeper')} · ${t('lh.who.olga')} · ${t('lh.who.tobi')}` },
      { text: `${t('lh.who.mira')} · ${t('lh.who.pell')}` },
      { text: `${t('lh.who.mitten')} · ${t('lh.who.sela')} · ${t('lh.who.murky')}` },
      { head: t('lh.cr.monsters') },
      { text: t('lh.cr.bosses1') }, { text: t('lh.cr.bosses2') }, { text: t('lh.cr.bosses3') },
      { head: t('lh.cr.places') },
      { text: `${t('lh.area.d1')} · ${t('lh.area.d2')} · ${t('lh.area.d3')}` },
      { text: `${t('lh.area.well')} · ${t('lh.place.cliff')} · ${t('lh.place.seal')}` },
      { head: t('lh.cr.made') }, { text: t('lh.cr.made2') },
      { big: t('lh.cr.thanks') },
    ];
  },

  showCredits() {
    this.mode = 'credits';
    this.credits = { t: 0, card: false };
    this.hud.setCredits({ lines: this.creditLines(), p: 0 });
    speak(`${t('lh.cr.thanks')}`);
  },

  updateCredits(inp, dt) {
    const c = this.credits;
    const fast = inp.aHeld ? 4 : 1;
    c.t += dt * fast;
    if (!c.card) {
      this.hud.setCredits({ lines: this.creditLines(), p: Math.min(1, c.t / CREDIT_SECONDS) });
      if (c.t >= CREDIT_SECONDS) {
        c.card = true;
        c.cardT = 0;
        this.finishGame();
        this.hud.setCredits(null);
        const s = this.save;
        this.hud.setBig({
          t1: t('lh.theEnd'),
          t2: t('lh.endStats', { p: this.heartPiecesFound(), pm: this.heartPiecesTotal(), g: this.gshellsFound(), gm: this.gshellsTotal(), h: s.maxHp / 2 }),
          t3: tFor(this.host.players[0], 'lh.endHint'),
        });
        speak(`${t('lh.theEnd')} ${t('lh.endStats', { p: this.heartPiecesFound(), pm: this.heartPiecesTotal(), g: this.gshellsFound(), gm: this.gshellsTotal(), h: s.maxHp / 2 })}`);
        this.sfx('fanfare');
      }
      return;
    }
    c.cardT += dt;
    if (c.cardT > 1.2 && (inp.a || inp.b)) {
      this.hud.setBig(null);
      this.dusk = false;
      this.ship = null;
      this.lastPlace = '';
      this.loadRoom('o10', [8, 6], 's');
      this.mode = 'play';
      this.onEnterRoom('end');
    }
  },

  /** Saved for good: the island is safe. Stars once per profile. */
  finishGame() {
    const s = this.save;
    s.flags.beaten = true;
    s.flags.intro = true;
    s.hp = s.maxHp;
    s.savePoint = { room: 'h_light', at: [8, 5], face: 'n' };
    if (!s.endRewarded) { s.endRewarded = true; this.giveStars(5); }
    this.persist();
  },
};
