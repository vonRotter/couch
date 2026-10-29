import * as THREE from 'three';
import { toon } from '../../core/palette.js';
import { makeRock } from '../../core/world.js';
import { t } from '../../core/i18n.js';
import { say as speak } from '../../core/voice.js';
import { now, count, give, take } from './save.js';
import { dayKey, weekIndex } from './calendar.js';
import { heightAt, SEA_Y, PIER } from './map.js';
import { mesh, cyl, sph, cone, makePier, makeLamp, makeSign } from './models.js';
import { makePalm, makeBerryBush, makePoolRim, makeDigSpot, makeShellHut, makeSailboat } from './models3.js';
import { ISLE2, ISLE2_DOCK, ISLE2_BOAT, ISLE2_ARRIVE, COVE, POOLS, PALMS, BERRIES, DIGS, HUT, isle2Height, inCove } from './isle2geo.js';

// Shell Isle, the second island (milestone B3). The sea chart from the glow cave (diving) shows the way;
// Grumbleton then sails you there in his little sailboat from the end of the pier (a short boat trip).
// The isle is small and always warm: a sandy beach with three tide pools (a find in each, every day), palms
// to shake for coconuts and wild berry bushes (every day), a hidden cove behind the rocks where special
// fish bite, four treasure spots to dig with the hoe (new treasure every week), and Shelby the hermit crab,
// who visits the main island's beach on weekends once you are friends. Sail home from the dock.

const SAIL_TIME = 6;
const MAIN_BOAT = { x: PIER.x, z: PIER.z0 + PIER.len + 2.3 }; // the sailboat waits at the end of the pier
const MAIN_BOARD = { x: PIER.x, z: PIER.z0 + PIER.len - 0.7 };
const POOL_FINDS = ['starfish', 'seaGlass', 'seaShell'];
const DIG_LOOT = ['oldcoin', 'seaGlass', 'pearl', 'oldcoin', 'seaShell', 'goldcup'];

export class Isle2 {
  constructor(host) {
    this.host = host;
    const S = host.save;
    if (!S.isle2) S.isle2 = { chart: false, visits: 0, palms: {}, berries: {}, pools: {}, digs: {}, dug: {} };
    const scene = host.scene, map = host.map;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.buildGround();
    // the dock and the sailboat
    const pier = makePier(ISLE2_DOCK.z1 - ISLE2_DOCK.z0);
    pier.position.set(ISLE2_DOCK.x, 0.05, ISLE2_DOCK.z0);
    this.group.add(pier);
    map.decks.push({ x0: ISLE2_DOCK.x - ISLE2_DOCK.w / 2 - 0.2, x1: ISLE2_DOCK.x + ISLE2_DOCK.w / 2 + 0.2, z0: ISLE2_DOCK.z0, z1: ISLE2_DOCK.z1 + 0.6, y: ISLE2_DOCK.y });
    this.boat = makeSailboat();
    this.boat.rotation.y = Math.PI / 2; // bow toward the isle (+z)
    scene.add(this.boat);
    this.mainBoatObs = map.circObs(MAIN_BOAT.x, MAIN_BOAT.z, 0.1);
    // Shelby's hut, palms, berry bushes, tide pools, digging spots, rocks around the cove, lamps
    const put = (obj, x, z, ry = 0) => { obj.position.set(x, heightAt(x, z), z); obj.rotation.y = ry; this.group.add(obj); return obj; };
    put(makeShellHut(), HUT.x, HUT.z);
    map.circObs(HUT.x, HUT.z, 1.55);
    this.palms = PALMS.map(([x, z], i) => { const g = put(makePalm(), x, z, i * 1.1); map.circObs(x, z, 0.35); return { i, x, z, g }; });
    this.berries = BERRIES.map(([x, z], i) => { const g = put(makeBerryBush(), x, z, i); map.circObs(x, z, 0.6); return { i, x, z, g }; });
    this.pools = POOLS.map((p, i) => ({ i, ...p, g: put(makePoolRim(), p.x, p.z, i) }));
    for (const p of this.pools) p.g.position.y = SEA_Y - 0.05;
    this.digs = DIGS.map(([x, z], i) => ({ i, x, z, g: put(makeDigSpot(), x, z, i * 0.7) }));
    const rand = (() => { let a = 7; return () => { a = (a * 16807) % 2147483647; return a / 2147483647; }; })();
    for (let i = 0; i < 9; i++) {
      const a = -1.2 + (i / 8) * 2.4; // an arc of rocks on the land side of the cove: it is hidden from the path
      const x = COVE.x + Math.cos(a) * (COVE.r + 1.1), z = COVE.z + Math.sin(a) * (COVE.r + 1.1);
      if (i === 2 || i === 3) continue; // the gap you walk through
      put(makeRock(rand, 0.9 + rand() * 0.6), x, z);
      map.circObs(x, z, 0.75);
    }
    for (const [x, z] of [[1.6, 178.2], [7.2, 190.2], [-10, 194]]) { const l = put(makeLamp(host.M), x, z); l.userData.isle = true; map.circObs(x, z, 0.3); map.lampSpots.push({ x, y: heightAt(x, z) + 3, z }); }
    // flowers, grass and shells so the isle feels alive
    const flowerCols = [0xff7eb6, 0xffd23f, 0xffffff, 0xff8c42, 0xb08bff];
    for (let i = 0; i < 70; i++) {
      const x = ISLE2.x + (rand() - 0.5) * 38, z = ISLE2.z + (rand() - 0.5) * 28;
      const h = isle2Height(x, z);
      if (h < 0.05 || Math.hypot(x - HUT.x, z - HUT.z) < 2.4 || Math.abs(x) < 1.6 && z < 182) continue;
      const g = new THREE.Group();
      if (h > 0.35 && rand() < 0.6) {
        g.add(mesh(cyl(0.03, 0.03, 0.4, 4), 0x58b947, 0, 0.2, 0, false));
        const head = mesh(sph(0.12, 6, 4), flowerCols[i % flowerCols.length], 0, 0.42, 0, false);
        head.scale.y = 0.5;
        g.add(head);
      } else if (h > 0.25) for (let k = 0; k < 3; k++) g.add(mesh(cyl(0, 0.05, 0.4, 3), 0x6fbf4a, (k - 1) * 0.12, 0.18, 0, false).rotateZ((k - 1) * 0.35));
      else { const sh = mesh(sph(0.1, 6, 4), [0xffd8c8, 0xffffff, 0xffc0d0][i % 3], 0, 0.04, 0, false); sh.scale.set(1.2, 0.4, 1); g.add(sh); }
      put(g, x, z, rand() * 6);
    }
    // a dolphin that leaps beside the boat on the trip
    this.dolphin = new THREE.Group();
    const db = mesh(sph(0.5, 12, 8), 0x8fa8c8, 0, 0, 0, false);
    db.scale.set(2.0, 0.8, 0.8);
    this.dolphin.add(db, mesh(cone(0.25, 0.6, 4), 0x8fa8c8, 0, 0.6, 0, false), mesh(cone(0.3, 0.5, 4), 0x8fa8c8, -1.1, 0, 0, false).rotateZ(Math.PI / 2), mesh(sph(0.06, 6, 4), 0x2b2340, 0.75, 0.15, 0.3, false));
    this.dolphin.visible = false;
    scene.add(this.dolphin);
    put(makeSign(0xff9fc0), -2.2, 178.4);
    map.circObs(-2.2, 178.4, 0.3);
    this.signSpot = { x: -2.2, z: 178.4 };
    this.sail = null;
    S.isle2.at = 'main'; // you always wake up at home: the boat waits at the pier
    this.placeBoat('main');
    this.refresh();
  }

  get S() { return this.host.save; }
  get I() { return this.S.isle2; }

  /** Is the player on Shell Isle (or its dock)? */
  here(P = this.host.player) { return !!P && P.z > 150; }

  buildGround() {
    const W = 64, D = 46;
    const geo = new THREE.PlaneGeometry(W, D, W, D);
    geo.rotateX(-Math.PI / 2);
    geo.translate(ISLE2.x, 0, ISLE2.z);
    const pos = geo.attributes.position;
    const cols = new Float32Array(pos.count * 3);
    const c = new THREE.Color(), sand = new THREE.Color(0xf7e1a6), grass = new THREE.Color(0x9ede5c), wet = new THREE.Color(0x7fc7c9);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const h = isle2Height(x, z);
      pos.setY(i, h);
      if (h < -0.62) c.copy(wet);
      else if (h < 0.15) c.copy(sand);
      else c.copy(sand).lerp(grass, Math.min(1, (h - 0.15) * 3));
      cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    geo.computeVertexNormals();
    const ground = new THREE.Mesh(geo, new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toon(0xffffff).gradientMap }));
    ground.receiveShadow = true;
    this.group.add(ground);
  }

  /** The boat at the main pier (after the chart is found) or at Shell Isle's dock. */
  placeBoat(where) {
    const known = !!this.I.chart;
    this.boat.visible = known;
    if (where === 'isle') this.boat.position.set(ISLE2_BOAT.x, SEA_Y - 0.1, ISLE2_BOAT.z);
    else this.boat.position.set(MAIN_BOAT.x, SEA_Y - 0.1, MAIN_BOAT.z);
    this.boat.rotation.y = where === 'isle' ? Math.PI / 2 : -Math.PI / 2;
    this.mainBoatObs.x = known && where !== 'isle' ? MAIN_BOAT.x : 1e5;
  }

  /** What is still there today (coconuts, berries, finds in the pools, treasure this week). */
  refresh() {
    const I = this.I, today = dayKey(), week = weekIndex();
    for (const p of this.palms) p.g.userData.nuts.visible = I.palms[p.i] !== today;
    for (const b of this.berries) b.g.userData.berries.visible = I.berries[b.i] !== today;
    for (const p of this.pools) p.g.userData.find.visible = I.pools[p.i] !== today;
    for (const d of this.digs) d.g.visible = I.digs[d.i] !== week;
  }

  tick() { this.refresh(); }

  // ---------- the boat trip ----------

  /** [B] at the end of the main pier (once you know the way), or on Shell Isle's dock. */
  boatAction(P, out, nm) {
    if (!this.I.chart || this.sail) return;
    const g = this.host.npc('grumbleton');
    const ask = (dir) => {
      if (g.sleep && dir === 'isle') return { text: t('isl.isle.boatSleep'), fn: () => this.host.say([{ key: 'isl.isle.boatSleep' }]) };
      return { text: nm(dir === 'isle' ? 'isl.h.sailThere' : 'isl.h.sailHome'), fn: () => this.startSail(dir) };
    };
    if (!this.here(P) && Math.hypot(P.x - MAIN_BOARD.x, P.z - MAIN_BOARD.z) < 1.8) out.b = ask('isle');
    else if (this.here(P) && P.z < ISLE2_DOCK.z0 + 3.5 && Math.abs(P.x - ISLE2_DOCK.x) < 2.5) out.b = ask('main');
  }

  startSail(dir) {
    const host = this.host, P = host.player;
    const g = host.npc('grumbleton');
    host.mode = 'sail';
    host.hud.setPrompt('');
    const from = dir === 'isle' ? { x: MAIN_BOAT.x, z: MAIN_BOAT.z } : { x: ISLE2_BOAT.x, z: ISLE2_BOAT.z };
    const to = dir === 'isle' ? { x: ISLE2_BOAT.x, z: ISLE2_BOAT.z } : { x: MAIN_BOAT.x, z: MAIN_BOAT.z };
    this.sail = { dir, t: 0, from, to };
    g.busy = true;
    g.route = [];
    g.sleep = false;
    this.boat.visible = true;
    this.boat.rotation.y = dir === 'isle' ? -Math.PI / 2 : Math.PI / 2;
    host.game.audio.play('whoosh');
    const txt = t(dir === 'isle' ? 'isl.isle.sailing' : 'isl.isle.sailingHome');
    speak(txt, { pitch: 0.55, rate: 0.9 });
    host.game.ui.toast(txt, 2600);
  }

  /** The trip: the boat crosses the open sea with you and Grumbleton on board. */
  updateSail(inp, dt) {
    const host = this.host, P = host.player, sl = this.sail;
    if (!sl) { host.mode = 'walk'; return; }
    sl.t += dt;
    const k = Math.min(1, sl.t / SAIL_TIME);
    const e = k * k * (3 - 2 * k);
    const x = sl.from.x + (sl.to.x - sl.from.x) * e, z = sl.from.z + (sl.to.z - sl.from.z) * e;
    const y = SEA_Y - 0.1 + Math.sin(sl.t * 2.2) * 0.12;
    this.boat.position.set(x, y, z);
    this.boat.rotation.z = Math.sin(sl.t * 1.7) * 0.05;
    const fwd = sl.dir === 'isle' ? 1 : -1;
    P.x = x; P.z = z - fwd * 0.4; P.y = y + 0.75; P.fx = 0; P.fz = fwd;
    P.ch.face(0, fwd);
    const g = host.npc('grumbleton');
    g.x = x + 0.6; g.z = z - fwd * 1.3; g.yOverride = y + 0.6; g.model.face(0, fwd);
    if (Math.random() < 0.6) host.puffs.burst(new THREE.Vector3(x + (Math.random() - 0.5) * 1.6, SEA_Y + 0.1, z - fwd * 2.2), 0xffffff, { count: 1, speed: 1.2, up: 1, size: 0.4, life: 0.7 });
    host.hud.setPrompt(t(sl.dir === 'isle' ? 'isl.isle.sailing' : 'isl.isle.sailingHome'));
    // two happy dolphin leaps on the way
    const jt = [1.6, 3.6].map((t0) => (sl.t - t0) / 1.1).find((q) => q >= 0 && q <= 1);
    this.dolphin.visible = jt !== undefined;
    if (jt !== undefined) {
      this.dolphin.position.set(x + 3.2, SEA_Y - 0.4 + Math.sin(jt * Math.PI) * 2.2, z + fwd * (1 + jt * 4));
      this.dolphin.rotation.set(0, -fwd * Math.PI / 2, (0.5 - jt) * 1.6);
      if (jt < 0.05 || jt > 0.95) host.puffs.burst(new THREE.Vector3(this.dolphin.position.x, SEA_Y + 0.1, this.dolphin.position.z), 0xffffff, { count: 6, speed: 2, up: 2, size: 0.3, life: 0.6 });
    }
    host.snapCamera(); // keep the boat in the middle of the screen
    if (k >= 1) { this.dolphin.visible = false; this.arrive(); }
  }

  arrive() {
    const host = this.host, P = host.player, sl = this.sail, I = this.I;
    const g = host.npc('grumbleton');
    this.sail = null;
    host.mode = 'walk';
    g.yOverride = null;
    host.hud.setPrompt('');
    if (sl.dir === 'isle') {
      I.at = 'isle';
      I.visits++;
      P.x = ISLE2_ARRIVE.x; P.z = ISLE2_ARRIVE.z; P.fx = 0; P.fz = 1;
      g.x = ISLE2_DOCK.x + 1.4; g.z = ISLE2_DOCK.z1 - 0.8; g.busy = true; // he waits by the boat
      this.placeBoat('isle');
      const txt = t(I.visits === 1 ? 'isl.isle.welcome1' : 'isl.isle.welcome');
      host.game.ui.toast(txt, 2800);
      speak(txt);
      host.game.audio.play('fanfare');
    } else {
      I.at = 'main';
      P.x = MAIN_BOARD.x; P.z = MAIN_BOARD.z - 0.6; P.fx = 0; P.fz = -1;
      g.busy = false; // back to his own day
      g.spotName = null;
      this.placeBoat('main');
      host.game.audio.play('land');
    }
    P.y = host.map.floorAt(P.x, P.z, true);
    host.snapCamera();
    host.markDirty();
  }

  // ---------- things to do on the isle ----------

  interactions(P, out, nm) {
    if (!this.here(P)) return;
    const near = (o, r) => Math.hypot(P.x - o.x, P.z - o.z) < r;
    const I = this.I, today = dayKey();
    if (!out.b) for (const p of this.palms) if (near(p, 1.5)) { out.b = I.palms[p.i] !== today ? { text: nm('isl.h.palm'), fn: () => this.shakePalm(p) } : { text: t('isl.h.palmDone'), fn: () => this.host.game.audio.play('bump') }; break; }
    if (!out.b) for (const b of this.berries) if (near(b, 1.5) && I.berries[b.i] !== today) { out.b = { text: nm('isl.h.pick', { item: t('isl.i.wildBerry') }), fn: () => this.pickBerries(b) }; break; }
    if (!out.b) for (const p of this.pools) if (near(p, 2.2)) { out.b = I.pools[p.i] !== today ? { text: nm('isl.h.pool'), fn: () => this.lookInPool(p) } : { text: t('isl.h.poolDone'), fn: () => this.host.game.audio.play('bump') }; break; }
    if (!out.b && near(this.signSpot, 1.3)) out.b = { text: nm('isl.h.sign'), fn: () => this.host.say([{ key: 'isl.sign.isle' }]) };
    // treasure: dig with the hoe
    const held = this.S.inv[this.S.sel]?.id;
    if (!out.a) {
      for (const d of this.digs) {
        if (!d.g.visible || !(near(d, 1.4) || Math.hypot(P.x + P.fx * 0.9 - d.x, P.z + P.fz * 0.9 - d.z) < 1.0)) continue;
        out.a = held === 'hoe' ? { text: nm('isl.h.dig'), fn: () => this.dig(d), ok: true } : { text: t('isl.h.digNeed'), fn: () => this.host.game.audio.play('bump') };
        break;
      }
    }
  }

  shakePalm(p) {
    const host = this.host;
    this.I.palms[p.i] = dayKey();
    give(this.S, 'coconut', 1);
    p.g.userData.top.rotation.z = 0.25;
    host.later(0.25, () => { p.g.userData.top.rotation.z = -0.15; });
    host.later(0.5, () => { p.g.userData.top.rotation.z = 0; });
    host.puffs.burst(new THREE.Vector3(p.x, 3.5, p.z), 0x58c45a, { count: 10, speed: 3, size: 0.3 });
    host.game.audio.play('boing');
    host.gotToast(t('isl.i.coconut'));
    this.refresh();
    host.markDirty();
  }

  pickBerries(b) {
    const host = this.host;
    this.I.berries[b.i] = dayKey();
    give(this.S, 'wildBerry', 2);
    host.game.audio.play('pop');
    host.gotToast(`2 ${t('isl.i.wildBerry')}`);
    this.refresh();
    host.markDirty();
  }

  lookInPool(p) {
    const host = this.host;
    this.I.pools[p.i] = dayKey();
    const id = POOL_FINDS[(p.i + new Date(now()).getDate()) % POOL_FINDS.length];
    give(this.S, id, 1);
    host.confetti.burst(new THREE.Vector3(p.x, 0.6, p.z), 0, { count: 16, speed: 3, up: 3, colors: [0x8ff0ff, 0xffffff, 0xff9f5a], life: 0.9, gravity: -6 });
    host.game.audio.play('star');
    const txt = t('isl.isle.pool', { item: t(`isl.i.${id}`) });
    host.game.ui.toast(txt, 2000);
    speak(txt);
    this.refresh();
    host.markDirty();
  }

  dig(d) {
    const host = this.host, I = this.I;
    host.swingTool();
    I.digs[d.i] = weekIndex();
    // the first dig at the big rock finds the star crystal (for the museum); then weekly treasure
    let id;
    if (!I.dug[d.i] && d.i === 0) id = 'starCrystal';
    else id = DIG_LOOT[(d.i * 3 + weekIndex()) % DIG_LOOT.length];
    I.dug[d.i] = (I.dug[d.i] || 0) + 1;
    give(this.S, id, 1);
    host.puffs.burst(new THREE.Vector3(d.x, 0.4, d.z), 0xf0d48a, { count: 16, speed: 4, size: 0.35 });
    host.confetti.burst(new THREE.Vector3(d.x, 1, d.z), 0, { count: 30, speed: 5, up: 4, colors: [0xffd23f, 0xffffff, 0xc9a8ff], life: 1.2, gravity: -6 });
    host.game.audio.play('fanfare');
    const txt = t('isl.isle.dug', { item: t(`isl.i.${id}`) });
    host.game.ui.toast(txt, 2400);
    speak(txt);
    this.refresh();
    host.markDirty();
  }

  /** Which fish spot is this water? The hidden cove has its own fish. */
  fishWhere(x, z) { return inCove(x, z) ? 'cove' : 'pier'; }

  update(dt, time) {
    for (const d of this.digs) if (d.g.visible) { d.g.userData.glint.rotation.y += dt * 3; d.g.userData.glint.scale.y = 0.6 + Math.sin(time * 4 + d.i) * 0.4; }
    for (const p of this.pools) if (p.g.userData.find.visible) p.g.userData.find.children[1].scale.y = 0.6 + Math.sin(time * 5 + p.i) * 0.4;
    if (!this.sail && this.boat.visible) { this.boat.position.y = SEA_Y - 0.1 + Math.sin(time * 1.3) * 0.06; this.boat.rotation.z = Math.sin(time) * 0.03; }
  }

  /** The chart: once Grumbleton has seen it, the boat is ready at the pier. */
  learnChart() {
    this.I.chart = true;
    take(this.S, 'seaChart', count(this.S, 'seaChart'));
    this.placeBoat('main');
    this.host.markDirty();
  }
}

