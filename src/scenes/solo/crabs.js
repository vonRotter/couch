import * as THREE from 'three';
import { t, tFor } from '../../core/i18n.js';
import { esc } from '../../core/ui.js';
import { now, hourOf, count, give, take, held as heldOf } from './save.js';
import { dayKey } from './calendar.js';
import { icon } from './items.js';
import { heightAt, isSand, bake, CRAB_COVE, HOME, PIER } from './map.js';
import { npcState } from './npcs.js';
import { makeBunting, mesh, cyl, WOOD } from './models.js';
import {
  makeCrab, animateCrab, setHermitShell, makeShell, makeTangle, makeFamilySpot, makeHelpBubble, makeCoveSign, makeCrabHouse,
  makeShellHouse, makeDanceRing, makeShellLantern, makeShellPalace, makeCrabDrum, makeCovePool,
} from './models7.js';
import {
  crabSave, doneToday, dailyCrabs, crabHelped, hermitHelped, releaseOldCrabs, coveLevel, COVE_LEVELS, SHELL_IDS, HERMITS,
  friendKind, isCrabNight, crabDanceNow, crabDanceKind, DANCE_HOURS, MUSEUM_CRABS, todaysCrab,
} from './crabdata.js';
import './strings13.js';

// Crab friends on the solo island and Shell Isle (the owner's crab update). Crabs are never caught any more;
// they are friends who sometimes need a hand. One crab a day in all (the owner's "fewer crabs", crabdata.js
// todaysCrab), on the main island (beach and pier), on Shell Isle (beaches and tide pools) or in the dive,
// by turns: a crab flipped on its back ([B] turns it over), a crab tangled in seaweed or an old net ([B]
// three times), a little family of lost babies who follow you in a parade to the glowing spot where their
// family waits, or a hermit crab who has outgrown its shell (give it a bigger one: found on the sand, in tide
// pools and the dive, or crafted at the workbench). Shells to find lie on the sand every day.
// Crab Cove on the east beach grows with every crab you help (five levels with houses, flags, a dance ring,
// lanterns and a shell palace), has crab dances on weekend evenings and full-moon nights, and Shelby looks
// after it. Helped crabs become crab friends: choose one at the cove's sign and it scuttles after you, dances
// when you jump, waves, digs up treasure on the sand, and waits at your cottage at night.

const COVE = CRAB_COVE;
const SIGN = { x: COVE.x - 3.6, z: COVE.z - 1.9 };
const DANCE = { x: COVE.x + 0.4, z: COVE.z + 0.5, r: 1.6 };
const HOME_WAIT = { x: HOME.x + 2.2, z: HOME.z + 3.5 }; // where a crab friend waits at night, by the porch
const MAIN_SPOTS = [[12.5, 42.4], [17.5, 41.6], [20.5, 41.6], [30.5, 38.0], [-14.5, 40.2], [-19.5, 39.2], [25.5, 40.4], [-3.5, 40.8], [PIER.x + 1.0, 42.6], [PIER.x - 0.5, 51.5]]; // beach and pier (away from Grumbleton's spots and the ship's door)
const ISLE_SPOTS = [[-1.5, 201.5], [2.5, 193.0], [15.4, 189.0], [13.6, 194.2], [-8.4, 181.4], [-13.4, 190.8], [6.4, 181.4], [-5.2, 197.4]];
const DOORS_EXTRA = [{ x: HOME.x, z: HOME.z + 2.7 }, { x: 12, z: -13.0 }, { x: 26, z: 1.1 }, { x: -7.1, z: 42.8 }, { x: -1, z: 57.3 }, { x: 4, z: 58.8 }];
const NEAR = 1.6;
const BIG = 1.35; // crabs on the island are drawn a bit bigger than in the dive, so they read from the island camera
const ALPHA = (a, b, k) => { const d = Math.atan2(Math.sin(b - a), Math.cos(b - a)); return a + d * k; };

/** Pick a yaw so a crab walks sideways along (dx, dz) and still faces the camera (+z) as much as it can. */
function sideYaw(dx, dz) {
  let yaw = Math.atan2(dx, dz) - Math.PI / 2;
  if (Math.cos(yaw) < 0) yaw += Math.PI;
  return yaw;
}

export class CrabCare {
  constructor(host) {
    this.host = host;
    const S = host.save;
    this.C = crabSave(S);
    // old saves: crabs in the bag go home to the sea, with a thank-you letter from Shelby
    const rel = releaseOldCrabs(S);
    if (rel.n) {
      S.mail.push({ id: 'crabThanks', from: 'shelby', coins: rel.coins, items: [['spiralShell', 1]] });
      host.later(1.6, () => host.game.ui.toast(t('crab.t.released', { n: rel.n }), 3200));
      host.markDirty();
    }
    this.group = new THREE.Group(); // today's crabs (out on the beaches)
    this.coveGroup = new THREE.Group(); // Crab Cove (hidden when you are far away: fewer things to draw)
    host.scene.add(this.group, this.coveGroup);
    this.items = [];
    this.trail = [];
    this.followT = { idle: 0, wave: 0, dig: 0, dance: 0, digAnim: 0 };
    this.buildCove();
    this.day = '';
    this.tick(now());
    this.applyLevel(false);
    this.makeFollower();
  }

  get S() { return this.host.save; }

  // ---------- Crab Cove ----------

  buildCove() {
    const host = this.host, map = host.map;
    // the props of each level go into one holder, baked into a few merged meshes at the end (cheap to draw)
    this.levelGroups = [0, 1, 2, 3, 4].map(() => new THREE.Group());
    const put = (obj, x, z, ry = 0, minLevel = 0, obs = 0) => {
      obj.position.set(x, heightAt(x, z), z);
      obj.rotation.y = ry;
      this.levelGroups[minLevel].add(obj);
      const o = obs ? map.circObs(x, z, obs, { cove: minLevel }) : null;
      this.props.push({ obj, minLevel, obs: o, x });
      return obj;
    };
    this.props = [];
    put(makeCoveSign(), SIGN.x, SIGN.z, 0.35, 0, 0.3);
    put(makeCovePool(), COVE.x + 3.2, COVE.z + 1.4, 0.2, 0);
    // level 1: a sandcastle crab house; level 2: shell houses and flags
    put(makeCrabHouse(), COVE.x - 1.6, COVE.z - 1.6, 0.2, 1, 0.6);
    put(makeShellHouse('conchShell'), COVE.x + 1.9, COVE.z - 1.9, -0.3, 2, 0.6);
    put(makeShellHouse('spiralShell'), COVE.x + 3.9, COVE.z - 0.9, -0.6, 2, 0.6);
    // flags on two driftwood poles (the bunting hangs in the cove's own coordinates)
    const flags = makeBunting({ x: -3.0, y: 1.9, z: -2.6 }, { x: 3.0, y: 1.9, z: -3.0 }, 0.4);
    put(flags, COVE.x, COVE.z, 0, 2);
    flags.position.y = heightAt(COVE.x, COVE.z - 2.8);
    for (const [dx, dz] of [[-3.0, -2.6], [3.0, -3.0]]) { const pole = new THREE.Group(); pole.add(mesh(cyl(0.04, 0.05, 2.0, 5), WOOD, 0, 1.0, 0)); put(pole, COVE.x + dx, COVE.z + dz, 0, 2, 0.12); }
    // level 3: the dance ring and shell lanterns (they glow at night with the island's lamps)
    put(makeDanceRing(DANCE.r), DANCE.x, DANCE.z, 0, 3);
    this.lanterns = [];
    for (const [dx, dz] of [[-2.6, 0.9], [3.2, -0.4], [-0.6, -2.9], [1.6, 2.5]]) { put(makeShellLantern(host.M), COVE.x + dx, COVE.z + dz, 0, 3, 0.15); this.lanterns.push({ x: COVE.x + dx, z: COVE.z + dz }); }
    // level 4: the shell palace and the crab band
    put(makeShellPalace(), COVE.x + 0.2, COVE.z - 3.6, 0, 4, 1.3);
    put(makeCrabDrum(), COVE.x - 2.6, COVE.z - 0.4, 0, 4);
    this.levelGroups = this.levelGroups.map((hold) => { const { group } = bake(hold); this.coveGroup.add(group); return group; });
    // the cove's crabs: a family first, more as it grows (hermit crabs you helped move in from level 2)
    this.coveCrabs = [];
    const add = (kind, dx, dz, minLevel, extra = {}) => {
      const g = makeCrab(kind, extra);
      g.scale.multiplyScalar(BIG);
      this.coveGroup.add(g);
      const c = { g, kind, minLevel, hx: COVE.x + dx, hz: COVE.z + dz, x: COVE.x + dx, z: COVE.z + dz, tx: COVE.x + dx, tz: COVE.z + dz, wait: Math.random() * 3, wave: 0, yaw: 0, ...extra };
      this.coveCrabs.push(c);
      return c;
    };
    add('red', -1.0, -0.6, 1); add('red', -0.2, -0.9, 1); add('baby', -0.6, -0.2, 1);
    add('red', 2.0, -0.6, 2); add('snow', 2.8, 0.4, 2);
    add('baby', 0.6, 1.0, 3); add('lobster', -2.0, 0.8, 3);
    add('red', -2.8, -0.9, 4); add('baby', 1.4, 0.2, 4);
    // hermit crabs you helped live here, wearing their new shells
    HERMITS.forEach((h, i) => { const c = add('hermit', -2.5 + (i % 4) * 1.6, 1.4 + Math.floor(i / 4) * 0.8, 99, { hermit: h }); c.g.visible = false; });
  }

  get level() { return coveLevel(this.C.helped); }

  /** Show the cove for its level; a new level celebrates and gives its reward. */
  applyLevel(celebrate = true) {
    const host = this.host, C = this.C, lv = this.level;
    this.levelGroups.forEach((g, i) => { g.visible = lv >= i; });
    for (const p of this.props) if (p.obs) p.obs.x = lv >= p.minLevel ? p.obj.position.x : 1e5;
    host.map.lampSpots = host.map.lampSpots.filter((l) => !l.cove);
    if (lv >= 3) for (const l of this.lanterns) host.map.lampSpots.push({ x: l.x, y: heightAt(l.x, l.z) + 1.4, z: l.z, cove: true });
    for (const c of this.coveCrabs) {
      if (c.hermit) {
        const shell = C.hermits[c.hermit];
        c.g.visible = lv >= 2 && !!shell;
        if (shell && c.g.userData.shellId !== shell) setHermitShell(c.g, shell);
      } else c.g.visible = lv >= c.minLevel;
    }
    if ((C.level || 0) >= lv) return;
    const from = C.level || 0;
    C.level = lv;
    if (!celebrate) { for (let i = from + 1; i <= lv; i++) host.grant(COVE_LEVELS[i].reward); return; }
    for (let i = from + 1; i <= lv; i++) {
      host.later(1.2 + (i - from - 1) * 2.5, () => {
        const txt = t(`crab.cove.level${i}`);
        host.game.ui.toast(txt, 3200);
        host.confetti.burst(new THREE.Vector3(COVE.x, 2.2, COVE.z), 0, { count: 60, speed: 7, up: 5, life: 1.6, gravity: -7, colors: [0xff6a4a, 0xffd23f, 0xff9fc0, 0x8ff0ff] });
        host.game.audio.play('fanfare');
        host.grant(COVE_LEVELS[i].reward);
      });
    }
    host.markDirty();
  }

  // ---------- today's crabs ----------

  /** Once a second: a new day brings new crabs. */
  tick(at) {
    const day = dayKey(at);
    if (day === this.day) return;
    this.day = day;
    for (const it of this.items) this.dispose(it);
    this.items = [];
    const done = doneToday(this.S, at);
    const pt = ([x, z]) => ({ x, z });
    for (const [area, spots] of [['main', MAIN_SPOTS], ['isle', ISLE_SPOTS]]) {
      for (const c of dailyCrabs(area, spots.map(pt), at, this.S)) {
        const isDone = done.includes(c.id);
        if (isDone && c.type !== 'shell') continue; // a helped hermit stays all day to show off its shell
        this.items.push(this.spawn(c, isDone));
      }
    }
    this.host.markDirty();
  }

  groundY(x, z) { return this.host.map.restY(x, z); } // (a crab friend hops onto stones and crates after you)

  spawn(c, isDone = false) {
    const o = { ...c, x: c.at.x, z: c.at.z, state: isDone ? 'happy' : 'wait', t: 0, tugs: 0, yaw: 0, seen: false, area: c.id.split('-')[0] };
    const y = this.groundY(o.x, o.z);
    if (c.type === 'find') {
      o.g = makeShell(c.item);
      o.g.scale.setScalar(0.62);
      o.g.position.set(o.x, y + 0.02, o.z);
      o.glint = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.45, 0.07), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      o.glint.position.set(o.x, y + 1.1, o.z);
      this.group.add(o.g, o.glint);
      return o;
    }
    if (c.type === 'home') {
      o.babies = [];
      for (let i = 0; i < c.n; i++) {
        const b = makeCrab('baby');
        b.scale.multiplyScalar(BIG);
        this.group.add(b);
        o.babies.push({ g: b, x: o.x + (i - 1) * 0.5, z: o.z + (i % 2) * 0.35, ph: i * 1.3, yaw: 0 });
      }
      o.to = { x: c.to.x, z: c.to.z };
      o.spot = makeFamilySpot();
      o.spot.position.set(o.to.x, this.groundY(o.to.x, o.to.z), o.to.z);
      this.group.add(o.spot);
      o.parents = [-0.75, 0.75].map((dx) => { const p = makeCrab('red'); p.scale.multiplyScalar(BIG); p.position.set(o.to.x + dx, this.groundY(o.to.x + dx, o.to.z - 0.4), o.to.z - 0.4); this.group.add(p); return p; });
    } else {
      o.g = makeCrab(c.kind === 'hermit' ? 'hermit' : c.kind, { shell: c.type === 'shell' ? (isDone ? this.C.hermits[c.hermit] : 'tiny') : null });
      o.g.scale.multiplyScalar(BIG);
      o.g.position.set(o.x, y + 0.02, o.z);
      this.group.add(o.g);
      if (c.type === 'flip') { o.g.userData.body.rotation.z = Math.PI; o.g.userData.body.position.y = 0.5; }
      if (c.type === 'free') { o.tangle = makeTangle(c.style); o.g.add(o.tangle); }
    }
    if (!isDone) {
      o.bubble = makeHelpBubble(c.type === 'shell');
      o.bubble.scale.setScalar(c.type === 'shell' ? 1.5 : 1.25);
      this.group.add(o.bubble);
    }
    return o;
  }

  dispose(o) {
    for (const g of [o.g, o.glint, o.spot, o.bubble, ...(o.babies || []).map((b) => b.g), ...(o.parents || [])]) g?.removeFromParent();
  }

  /** Crabs that still need a hand in an area ('main' or 'isle'). */
  waiting(area) {
    return this.items.filter((o) => o.area === area && o.type !== 'find' && (o.state === 'wait' || o.state === 'follow'));
  }

  // ---------- [B] ----------

  /**
   * [B] near crabs (fills out.b; returns true if it did). close: only a crab in need right at your feet (checked
   * before the villagers, so a crab by Shelby's tide pool can still be helped).
   */
  interactions(P, out, nm, close = 0) {
    if (out.b) return false;
    const near = (x, z, r = NEAR) => (close ? Math.hypot(P.x - x, P.z - z) < Math.min(r, close) : Math.hypot(P.x - x, P.z - z) < r || Math.hypot(P.x + P.fx * 0.8 - x, P.z + P.fz * 0.8 - z) < r * 0.8);
    for (const o of this.items) {
      if (close && (o.type === 'find' || o.state !== 'wait')) continue;
      if (o.state !== 'wait' && !(o.type === 'shell' && o.state === 'happy')) continue;
      if (o.type === 'find' && near(o.x, o.z, 1.3)) { out.b = { text: nm('isl.h.pick', { item: t(`isl.i.${o.item}`) }), fn: () => this.pickShell(o) }; return true; }
      if (o.type === 'flip' && near(o.x, o.z)) { out.b = { text: nm('crab.h.flip'), fn: () => this.flip(o) }; return true; }
      if (o.type === 'free' && near(o.x, o.z)) { out.b = { text: nm(o.style === 'net' ? 'crab.h.freeNet' : 'crab.h.freeWeed', { n: 3 - o.tugs }), fn: () => this.tug(o) }; return true; }
      if (o.type === 'home' && near(o.x, o.z, 1.9)) { out.b = { text: nm('crab.h.babies'), fn: () => this.lead(o) }; return true; }
      if (o.type === 'shell' && near(o.x, o.z, 1.7)) {
        const name = t(`crab.hermit.${o.hermit}`);
        out.b = o.state === 'happy' ? { text: nm('crab.h.waveTo', { name }), fn: () => this.waveAt(o) } : { text: nm(this.shellsInBag().length ? 'crab.h.shell' : 'crab.h.shellNeed', { name }), fn: () => this.askShell(o) };
        return true;
      }
    }
    if (close) return false;
    // Crab Cove: the sign (choose a crab friend), the dance
    if (Math.hypot(P.x - SIGN.x, P.z - SIGN.z) < 1.5) { out.b = { text: nm('crab.h.sign'), fn: () => this.openPicker() }; return true; }
    const dance = this.danceNow();
    if (dance && Math.hypot(P.x - DANCE.x, P.z - DANCE.z) < DANCE.r + 1.2) { out.b = { text: nm('crab.h.dance'), fn: () => this.joinDance() }; return true; }
    // waving to the cove's crabs
    for (const c of this.coveCrabs) if (c.g.visible && near(c.x, c.z, 1.1)) { out.b = { text: nm('crab.h.wave'), fn: () => this.waveAt(c) }; return true; }
    return false;
  }

  /** A toast (not read aloud: the narrator reads story and help). */
  sayT(key, vars, ms = 2600) {
    this.host.game.ui.toast(t(key, vars), ms);
  }

  hearts(x, z, y = 0.8) {
    this.host.confetti.burst(new THREE.Vector3(x, this.groundY(x, z) + y, z), 0, { count: 20, speed: 3.5, up: 3.5, life: 1.1, gravity: -5, colors: [0xff5d73, 0xff9fd0, 0xffffff] });
  }

  /** Count a helped crab (cove, museum wall, crab friend, Shelby's hearts) and mark today's spot. */
  helped(o, kind, how) {
    const host = this.host;
    doneToday(this.S).push(o.id);
    const r = how === 'shell' ? hermitHelped(this.S, o.hermit, o.gave, o.area) : crabHelped(this.S, kind, how);
    if (o.bubble) o.bubble.visible = false;
    host.game.audio.play('rescue');
    if (npcState(this.S, 'shelby').met) host.addPts('shelby', 2); // Shelby looks after the crabs
    if (r.museum) host.later(2.0, () => { this.sayT('crab.t.museum', { item: t(`isl.i.${r.museum}`) }); host.museum?.checkMilestones(); });
    if (r.friend) host.later(r.museum ? 4.4 : 2.0, () => this.sayT('crab.t.friend', { name: this.friendName(r.friend) }));
    this.applyLevel(true);
    host.markDirty();
  }

  flip(o) {
    o.state = 'flip';
    o.t = 0;
    give(this.S, 'seaShell', 1);
    this.hearts(o.x, o.z);
    this.helped(o, o.kind, 'flip');
    this.sayT('crab.t.flipped');
    this.host.gotToast(t('isl.i.seaShell'));
  }

  tug(o) {
    const host = this.host;
    o.tugs++;
    host.swingTool();
    const part = o.tangle.userData.parts[o.tugs - 1];
    if (part) part.visible = false;
    host.puffs.burst(new THREE.Vector3(o.x, this.groundY(o.x, o.z) + 0.5, o.z), o.style === 'net' ? 0xc8a878 : 0x58c47a, { count: 8, speed: 2.5, size: 0.22, life: 0.6 });
    host.game.audio.play('pop');
    if (o.tugs < 3) return;
    o.tangle.removeFromParent();
    const gift = o.style === 'net' ? 'seaGlass' : 'seaShell';
    give(this.S, gift, 1);
    o.state = 'free';
    o.t = 0;
    this.hearts(o.x, o.z);
    this.helped(o, o.kind, 'free');
    this.sayT(o.style === 'net' ? 'crab.t.freedNet' : 'crab.t.freedWeed');
    host.gotToast(t(`isl.i.${gift}`));
  }

  lead(o) {
    o.state = 'follow';
    if (o.bubble) o.bubble.visible = false;
    this.host.game.audio.play('join');
    this.sayT('crab.t.follow');
  }

  waveAt(c) {
    c.wave = 1.8;
    const P = this.host.player;
    if (P && c.g) c.yaw = Math.atan2(P.x - c.x, P.z - c.z);
    this.hearts(c.x, c.z, 0.6);
    this.host.game.audio.play('boing');
  }

  pickShell(o) {
    doneToday(this.S).push(o.id);
    o.state = 'done';
    o.g.visible = false;
    o.glint.visible = false;
    give(this.S, o.item, 1);
    this.host.confetti.burst(new THREE.Vector3(o.x, 1, o.z), 0, { count: 16, speed: 3, up: 3, colors: [0xffd8c8, 0xffffff, 0xff9fc0], life: 0.9, gravity: -6 });
    this.host.game.audio.play('star');
    this.sayT('crab.t.foundShell', { item: t(`isl.i.${o.item}`) });
    this.host.markDirty();
  }

  /** Big shells in the bag (found and crafted), the held one first. */
  shellsInBag() {
    const S = this.S, held = heldOf(S)?.id;
    const list = SHELL_IDS.filter((id) => count(S, id) > 0);
    if (list.includes(held)) { list.splice(list.indexOf(held), 1); list.unshift(held); }
    return list;
  }

  /** A hermit crab asks for a bigger shell: pick one of yours (or "not now"). */
  askShell(o) {
    const host = this.host, name = t(`crab.hermit.${o.hermit}`);
    const list = this.shellsInBag().slice(0, 3);
    if (!list.length) { host.say([{ key: 'crab.hermit.need', vars: { name } }]); return; }
    host.say([{ key: 'crab.hermit.ask', vars: { name }, choices: [...list.map((id) => `isl.i.${id}`), 'crab.notNow'], onChoice: (i) => {
      if (i >= list.length) return;
      this.giveShell(o, list[i]);
    } }]);
  }

  giveShell(o, shell) {
    const host = this.host, name = t(`crab.hermit.${o.hermit}`);
    if (!take(this.S, shell, 1)) return;
    o.gave = shell;
    setHermitShell(o.g, shell);
    o.state = 'happy';
    o.t = 0;
    give(this.S, 'seaShell', 1); // it leaves its old little shell for you
    host.confetti.burst(new THREE.Vector3(o.x, this.groundY(o.x, o.z) + 1, o.z), 0, { count: 40, speed: 5, up: 4, life: 1.3, gravity: -6, colors: [0xffd23f, 0xff9fc0, 0x8ff0ff, 0xffffff] });
    this.helped(o, 'hermit', 'shell');
    host.say([{ key: 'crab.hermit.thanks', vars: { name, shell: t(`isl.i.${shell}`) } }]);
    host.gotToast(t('isl.i.seaShell'));
  }

  // ---------- the dance ----------

  /** A crab dance is on right now (cove level 3 and up): 'weekend', 'moon' or null. */
  danceNow(at = now()) {
    return this.level >= 3 ? crabDanceNow(at) : null;
  }

  joinDance() {
    const host = this.host, C = this.C, today = dayKey();
    host.jump();
    for (const c of this.coveCrabs) c.dance = 2.5;
    if (this.follower) this.followT.dance = 2.5;
    host.confetti.burst(new THREE.Vector3(DANCE.x, 1.6, DANCE.z), 0, { count: 30, speed: 5, up: 4, life: 1.2, gravity: -6, colors: [0xff6a4a, 0xffd23f, 0xff9fc0, 0x8ff0ff] });
    host.game.audio.play('fanfare');
    if (C.danced === today) return;
    C.danced = today;
    this.sayT(this.danceNow() === 'moon' ? 'crab.t.danceMoon' : 'crab.t.dance');
    host.grant({ coins: 25, items: [['seaShell', 1]] });
  }

  // ---------- crab friends: the follower ----------

  friendName(id) { return HERMITS.includes(id) ? t(`crab.hermit.${id}`) : t(`crab.friend.${id}`); }

  /** The cove's picker: choose one crab friend to come along (or nobody). */
  openPicker() {
    const host = this.host, C = this.C;
    if (!C.friends.length) { host.say([{ key: 'crab.sign.empty', vars: { n: C.helped } }]); return; }
    host.mode = 'crabs';
    const list = ['', ...C.friends];
    this.pick = { i: Math.max(0, list.indexOf(C.follower || '')), t: 0 };
    this.renderPicker(true);
    host.game.audio.play('select');
  }

  pickList() { return ['', ...this.C.friends]; }

  renderPicker(read = false) {
    const host = this.host, list = this.pickList(), C = this.C;
    const rows = list.map((id, i) => {
      const nm = id ? this.friendName(id) : t('crab.pick.nobody');
      const kind = id ? t(`crab.kind.${friendKind(id)}`) : t('crab.pick.nobodySub');
      const shell = id && C.hermits[id] ? ` · ${t(`isl.i.${C.hermits[id]}`)}` : '';
      const pic = id ? `<img class="isl-ico" src="${host.picture(friendKind(id) === 'hermit' ? 'hermitCrab' : MUSEUM_CRABS[['red', 'snow', 'lobster', 'hermit', 'baby'].indexOf(friendKind(id))])}" alt="">` : icon('heartEmpty');
      return `<div class="isl-row ${i === this.pick.i ? 'on' : ''}">${pic}<div>${C.follower === id || (!id && !C.follower) ? '★ ' : ''}${esc(nm)} <small>${esc(kind + shell)}</small></div><small></small><div></div></div>`;
    }).join('');
    host.hud.setPanel(`<h2>${esc(t('crab.pick.title'))}</h2><div class="isl-foot" style="opacity:1;margin:0 0 6px">${esc(t('crab.pick.sub', { n: C.helped }))}</div>
      <div class="isl-rows">${rows}</div><div class="isl-foot">${esc(tFor(host.player?.p, 'crab.pick.hint'))}</div>`);
  }

  updatePicker(inp, dt) {
    const host = this.host, list = this.pickList();
    this.pick.t += dt;
    if (inp.stepY) { this.pick.i = THREE.MathUtils.clamp(this.pick.i - inp.stepY, 0, list.length - 1); host.game.audio.play('select'); this.renderPicker(); }
    if (this.pick.t < 0.25) return;
    if (inp.bPressed) { this.closePicker(); return; }
    if (inp.aPressed) {
      const id = list[this.pick.i] || null;
      this.C.follower = id;
      this.closePicker();
      this.makeFollower(true);
      if (id) this.sayT('crab.t.comes', { name: this.friendName(id) });
      else this.sayT('crab.t.stays');
      host.markDirty();
    }
  }

  closePicker() {
    this.host.hud.setPanel(null);
    this.host.mode = 'walk';
  }

  /** Build (or rebuild) the following crab friend from the save. */
  makeFollower(pop = false) {
    const host = this.host, C = this.C;
    if (this.follower) { this.follower.g.removeFromParent(); this.follower = null; }
    const id = C.follower;
    if (!id || !C.friends.includes(id)) { C.follower = null; return; }
    const kind = friendKind(id);
    const g = makeCrab(kind, { shell: C.hermits[id] || null });
    g.scale.setScalar(kind === 'baby' ? 0.85 : BIG * 1.1);
    this.group.add(g);
    const P = host.player;
    const night = isCrabNight(hourOf());
    const at = night || !P ? HOME_WAIT : { x: P.x - P.fx * 1.4, z: P.z - P.fz * 1.4 };
    this.follower = { id, kind, g, x: at.x, z: at.z, yaw: 0, state: night ? 'home' : 'follow', wave: 0 };
    this.trail = [];
    if (pop) host.puffs.burst(new THREE.Vector3(at.x, this.groundY(at.x, at.z) + 0.4, at.z), 0xffffff, { count: 10, speed: 3, size: 0.3 });
  }

  /** [A] jump: the crab friend does a happy dance (and the cove's crabs, if you are there). */
  onJump() {
    if (this.follower && this.follower.state === 'follow') { this.followT.dance = 1.3; this.followT.idle = 0; }
    const P = this.host.player;
    if (P && Math.hypot(P.x - COVE.x, P.z - COVE.z) < 6) for (const c of this.coveCrabs) if (c.g.visible) c.dance = 1.2;
  }

  /**
   * You played an emote (core/emotes.js): your crab friend and the crabs around you react (wave: they wave
   * back, dance: they dance along, heart: little hearts, laugh: a happy wiggle and a "click click").
   * Returns how many reacted.
   */
  onEmote(kind, P) {
    const em = this.host.emotes;
    let n = 0;
    const react = (c, x, z, setDance, look = true) => {
      const top = new THREE.Vector3(x, this.groundY(x, z) + 0.9, z);
      if (look) c.yaw = Math.atan2(P.x - x, P.z - z);
      if (kind === 'wave') c.wave = 1.5;
      else if (kind === 'dance') setDance(1.8);
      else if (kind === 'heart') { c.wave = 0.8; if (n < 4) em.heartsAt(top, 2); }
      else { setDance(0.7); if (n < 2) em.floatText(top, t('emote.a.crab'), { css: '#ff6a4a', delay: 0.25 + n * 0.2 }); }
      n++;
    };
    const F = this.follower;
    if (F && F.state === 'follow' && F.g.visible && Math.hypot(P.x - F.x, P.z - F.z) < 12) react(F, F.x, F.z, (s) => { this.followT.dance = s; });
    for (const c of this.coveCrabs) {
      if (!c.g.visible || Math.hypot(P.x - c.x, P.z - c.z) > 8) continue;
      react(c, c.x, c.z, (s) => { c.dance = s; });
    }
    // today's crab: a hermit showing off its new shell waves back; a crab that still needs a hand gets hearts
    for (const o of this.items) {
      if (!o.g || o.type === 'find' || Math.hypot(P.x - o.x, P.z - o.z) > 7) continue;
      if (o.state === 'happy') react(o, o.x, o.z, () => { o.wave = 1.5; }, false);
      else if (o.state === 'wait' && kind === 'heart') { em.heartsAt(new THREE.Vector3(o.x, this.groundY(o.x, o.z) + 0.9, o.z), 2); n++; }
    }
    return n;
  }

  /** Spots a follower keeps clear of: doors, ladders and boarding points. */
  doorSpots() {
    if (!this._doors) this._doors = [...this.host.map.places.map((p) => p.door), ...DOORS_EXTRA, ...Object.values(this.host.homes?.list || {}).map((h) => h.spot)];
    return this._doors;
  }

  updateFollower(dt) {
    const host = this.host, F = this.follower, P = host.player, T = this.followT;
    if (!F || !P) return;
    const h = hourOf();
    const night = isCrabNight(h);
    let tx = F.x, tz = F.z, moving = false, speed = 7.5;
    if (night) {
      // bedtime: the crab friend scuttles home and waits by your cottage until morning
      if (F.state !== 'home') {
        F.state = 'home';
        if (Math.hypot(P.x - F.x, P.z - F.z) < 25) this.sayT('crab.t.goHome', { name: this.friendName(F.id) });
        if (Math.hypot(HOME_WAIT.x - F.x, HOME_WAIT.z - F.z) > 30) { F.x = HOME_WAIT.x; F.z = HOME_WAIT.z; }
      }
      tx = HOME_WAIT.x; tz = HOME_WAIT.z; speed = 3;
    } else {
      if (F.state === 'home') { F.state = 'follow'; this.trail = []; }
      const indoors = host.indoors, away = host.mode === 'sail' || host.camView;
      F.g.visible = !away;
      if (indoors) { tx = HOME_WAIT.x; tz = HOME_WAIT.z; } else if (!away) {
        // follow the path you walked, a little behind you (so it never stands in your way)
        const last = this.trail[this.trail.length - 1];
        if (!last || Math.hypot(P.x - last.x, P.z - last.z) > 0.25) this.trail.push({ x: P.x, z: P.z });
        if (this.trail.length > 40) this.trail.shift();
        let back = 1.5, k = this.trail.length - 1, px = P.x, pz = P.z;
        for (; k > 0 && back > 0; k--) { const a = this.trail[k - 1]; back -= Math.hypot(a.x - px, a.z - pz); px = a.x; pz = a.z; }
        if (back > 0) { px -= P.fx * back; pz -= P.fz * back; } // a short trail: just behind you
        tx = px; tz = pz;
        // keep clear of doors: step aside
        for (const d of this.doorSpots()) {
          const dd = Math.hypot(tx - d.x, tz - d.z);
          if (dd < 1.6) { const k2 = (1.6 - dd) / (dd || 1); tx += (tx - d.x || 0.5) * k2; tz += (tz - d.z || 0.5) * k2; }
        }
        if (Math.hypot(P.x - F.x, P.z - F.z) > 14) {
          // too far behind (a boat trip, a door): it pops up next to you
          F.x = P.x - P.fx * 1.4; F.z = P.z - P.fz * 1.4; this.trail = [];
          host.puffs.burst(new THREE.Vector3(F.x, this.groundY(F.x, F.z) + 0.4, F.z), 0xffffff, { count: 8, speed: 3, size: 0.25 });
        }
      }
    }
    const dx = tx - F.x, dz = tz - F.z, d = Math.hypot(dx, dz);
    const busy = T.dance > 0 || T.digAnim > 0 || F.wave > 0;
    if (d > 0.08 && !busy) {
      const s = Math.min(d, (d > 2.5 ? speed : Math.min(speed, 2 + d * 3)) * dt);
      F.x += (dx / d) * s; F.z += (dz / d) * s;
      moving = s > dt * 0.4;
      F.yaw = ALPHA(F.yaw, sideYaw(dx, dz), Math.min(1, dt * 8));
    } else if (!busy) F.yaw = ALPHA(F.yaw, 0, Math.min(1, dt * 3));
    // tricks: a dance when you jump, a wave now and then, and digging on the sand
    T.dance = Math.max(0, T.dance - dt);
    F.wave = Math.max(0, F.wave - dt);
    const pMoving = this.host.player.moving > 0.1;
    T.idle = pMoving || night ? 0 : T.idle + dt;
    if (!night && T.idle > 4 && F.wave <= 0 && Math.random() < dt * 0.5) { F.wave = 1.6; F.yaw = Math.atan2(P.x - F.x, P.z - F.z); }
    this.updateDig(dt, night);
    const y = this.groundY(F.x, F.z);
    const hop = T.dance > 0 ? Math.abs(Math.sin(T.dance * 9)) * 0.35 : 0;
    F.g.position.set(F.x, y + 0.02 + hop, F.z);
    F.g.rotation.y = F.yaw + (T.dance > 0 ? T.dance * 6 : 0);
    animateCrab(F.g, dt, { walk: moving ? 1 : 0, wave: F.wave > 0 ? 1 : 0, dance: T.dance > 0 ? 1 : 0, wiggle: T.digAnim > 0 ? 1 : 0 });
    if (night && d < 0.3) for (const e of F.g.userData.eyes) e.scale.y = 0.12; // asleep by the door
  }

  /** On the sand, a crab friend sometimes digs up a little treasure (three times a day). */
  updateDig(dt, night) {
    const host = this.host, F = this.follower, T = this.followT, C = this.C, today = dayKey();
    if (C.digs.day !== today) C.digs = { day: today, n: 0 };
    if (T.digAnim > 0) {
      T.digAnim -= dt;
      if (Math.random() < dt * 12) host.puffs.burst(new THREE.Vector3(F.x, this.groundY(F.x, F.z) + 0.2, F.z), 0xf0d48a, { count: 2, speed: 2.5, up: 2, size: 0.2, life: 0.5 });
      if (T.digAnim <= 0) this.digUp();
      return;
    }
    if (night || F.state !== 'follow' || C.digs.n >= 3 || !isSand(F.x, F.z) || host.mode !== 'walk') { T.dig = Math.max(0, T.dig - dt); return; }
    T.dig += dt;
    if (T.dig > 14) { T.dig = 0; T.digAnim = 1.4; host.game.audio.play('land'); }
  }

  digUp() {
    const host = this.host, F = this.follower, C = this.C;
    C.digs.n++;
    const loot = [['seaShell', 1], ['coins', 15], ['spiralShell', 1], ['seaGlass', 1], ['oldcoin', 1], ['pearl', 1]];
    const [id, n] = loot[(C.digs.n * 2 + (C.helped % 3)) % loot.length];
    if (id === 'coins') { this.S.coins += n; host.coinToast(n); host.game.audio.play('coin'); } else { give(this.S, id, n); }
    host.confetti.burst(new THREE.Vector3(F.x, this.groundY(F.x, F.z) + 0.6, F.z), 0, { count: 24, speed: 4, up: 4, life: 1.1, gravity: -7, colors: [0xffd23f, 0xffffff, 0xf0d48a] });
    host.game.audio.play('star');
    this.sayT('crab.t.dug', { name: this.friendName(F.id), item: id === 'coins' ? t('isl.t.coins', { n }) : t(`isl.i.${id}`) });
    this.followT.dance = 1.0;
    host.markDirty();
  }

  // ---------- every frame ----------

  update(dt) {
    const host = this.host, P = host.player, tm = host.time;
    const px = P?.x ?? 0, pz = P?.z ?? 0;
    for (const o of this.items) {
      const far = Math.hypot(o.x - px, o.z - pz) > 45;
      if (o.type === 'home') {
        this.updateBabies(o, dt, far);
        if (o.state === 'wait' && !o.seen && Math.hypot(o.x - px, o.z - pz) < 7) { o.seen = true; this.sayT('crab.t.seeBabies', {}, 2400); }
        continue;
      }
      if (far) continue;
      o.t += dt;
      const g = o.g, y = this.groundY(o.x, o.z);
      if (o.bubble?.visible) o.bubble.position.set(o.x + 0.35, y + 1.85 + Math.sin(tm * 3 + o.x) * 0.1, o.z);
      if (o.type === 'find') { if (g.visible) { g.rotation.y = Math.sin(tm * 1.5 + o.x) * 0.4; o.glint.rotation.y += dt * 3; o.glint.scale.y = 0.6 + Math.sin(tm * 5 + o.z) * 0.4; } continue; }
      const u = g.userData;
      if (o.state === 'wait') {
        animateCrab(g, dt, { wiggle: o.type === 'flip' ? 1 : o.type === 'free' ? 0.6 : 0 });
        if (o.type === 'flip') { u.body.position.y = 0.52; u.body.rotation.x = Math.sin(tm * 5) * 0.15; } // on its back, rocking
        if (o.type === 'shell') g.rotation.z = Math.sin(tm * 4) * 0.05; // squeezed and wobbly
        const d = Math.hypot(o.x - px, o.z - pz);
        if (d < 7 && !o.seen) { o.seen = true; this.sayT(o.type === 'shell' ? 'crab.t.seeHermit' : 'crab.t.seeCrab', { name: o.hermit ? t(`crab.hermit.${o.hermit}`) : '' }, 2400); }
      } else if (o.state === 'flip') {
        // turns over with a little hop, dances, then scuttles back to the sea
        const k = Math.min(1, o.t / 0.5);
        u.body.rotation.z = Math.PI * (1 - k);
        u.body.rotation.x = 0;
        u.body.position.y = 0.5 * (1 - k) + Math.sin(k * Math.PI) * 0.6;
        this.leave(o, dt, 0.5);
      } else if (o.state === 'free') this.leave(o, dt, 0);
      else if (o.state === 'happy') {
        // a hermit crab showing off its new shell: a spin and a wave now and then
        const ph = (tm + o.x) % 6;
        g.rotation.y = ph < 1.2 ? ph * Math.PI * 2 / 1.2 : 0;
        animateCrab(g, dt, { wave: ph > 3 && ph < 4.5 ? 1 : (o.wave > 0 ? 1 : 0), dance: o.t < 2.5 ? 1 : 0 });
        o.wave = Math.max(0, (o.wave || 0) - dt);
        g.position.y = y + 0.02 + (o.t < 2.5 ? Math.abs(Math.sin(o.t * 7)) * 0.2 : 0);
      }
    }
    this.updateCove(dt, px, pz);
    this.updateFollower(dt);
  }

  /** After being helped: a happy dance, then off to the water (the crab is gone for today). */
  leave(o, dt, delay) {
    const g = o.g;
    if (o.t < delay) return;
    if (o.t < delay + 1.8) { animateCrab(g, dt, { dance: 1 }); g.position.y = this.groundY(o.x, o.z) + 0.02 + Math.abs(Math.sin(o.t * 7)) * 0.2; return; }
    // scuttle toward the sea (south on the main island; away from the middle on Shell Isle)
    const sx = o.z > 120 ? Math.sign(o.x - 0) || 1 : 0, sz = o.z > 120 ? Math.sign(o.z - 190) || 1 : 1;
    const L = Math.hypot(sx, sz);
    o.x += (sx / L) * dt * 2; o.z += (sz / L) * dt * 2;
    o.yaw = sideYaw(sx, sz);
    g.rotation.y = o.yaw;
    g.position.set(o.x, this.groundY(o.x, o.z) + 0.02, o.z);
    animateCrab(g, dt, { walk: 1 });
    if (o.t > delay + 5 || this.groundY(o.x, o.z) < -0.9) { g.visible = false; o.state = 'gone'; }
  }

  updateBabies(o, dt, far) {
    const host = this.host, P = host.player, tm = host.time;
    if (!far) {
      for (const p of o.parents) animateCrab(p, dt, { wave: o.state === 'home' ? 0 : 1, dance: o.state === 'home' ? 1 : 0 });
      o.spot.userData.ring.scale.setScalar(1 + Math.sin(tm * 3) * 0.06);
      if (o.bubble?.visible) o.bubble.position.set(o.x + 0.3, this.groundY(o.x, o.z) + 1.3 + Math.sin(tm * 3) * 0.1, o.z);
    }
    if (o.state === 'wait') {
      if (far) return;
      for (const b of o.babies) { b.g.position.set(b.x, this.groundY(b.x, b.z) + 0.02, b.z); animateCrab(b.g, dt, { wiggle: 0.6 }); }
      return;
    }
    if (o.state === 'follow' && P) {
      // the parade: each baby follows the one in front; the first follows you
      if (Math.hypot(P.x - o.babies[0].x, P.z - o.babies[0].z) > 16 || host.indoors || host.mode === 'sail') {
        // you went somewhere they cannot follow: they wait where they are
        o.state = 'wait'; o.x = o.babies[0].x; o.z = o.babies[0].z; o.seen = true;
        if (o.bubble) o.bubble.visible = true;
        return;
      }
      let lead = { x: P.x, z: P.z };
      let first = true;
      for (const b of o.babies) {
        const gap = first ? 1.0 : 0.6;
        const dx = lead.x - b.x, dz = lead.z - b.z, d = Math.hypot(dx, dz);
        let moving = false;
        if (d > gap) { const s = Math.min(d - gap, dt * Math.max(4, d * 4)); b.x += (dx / d) * s; b.z += (dz / d) * s; moving = true; b.yaw = ALPHA(b.yaw, sideYaw(dx, dz), Math.min(1, dt * 10)); }
        b.g.position.set(b.x, this.groundY(b.x, b.z) + 0.02, b.z);
        b.g.rotation.y = b.yaw;
        animateCrab(b.g, dt, { walk: moving ? 1 : 0 });
        lead = b;
        first = false;
      }
      o.x = o.babies[0].x; o.z = o.babies[0].z;
      if (Math.hypot(o.babies[0].x - o.to.x, o.babies[0].z - o.to.z) < 1.7) {
        o.state = 'home';
        o.t = 0;
        this.hearts(o.to.x, o.to.z, 1.0);
        give(this.S, 'spiralShell', 1);
        this.helped(o, 'baby', 'home');
        this.sayT('crab.t.home');
        host.gotToast(t('isl.i.spiralShell'));
      }
      return;
    }
    // home: the babies run to their family and everyone dances
    if (far) return;
    o.babies.forEach((b, i) => {
      const tx = o.to.x + (i - 1) * 0.45, tz = o.to.z + 0.1;
      b.x += (tx - b.x) * Math.min(1, dt * 3); b.z += (tz - b.z) * Math.min(1, dt * 3);
      b.g.position.set(b.x, this.groundY(b.x, b.z) + 0.02 + Math.abs(Math.sin(tm * 7 + i)) * 0.1, b.z);
      b.g.rotation.y = ALPHA(b.g.rotation.y, 0, Math.min(1, dt * 4));
      animateCrab(b.g, dt, { dance: 1 });
    });
  }

  /** The cove's crabs potter about, wave, and dance on dance evenings (only animated when you are near). */
  updateCove(dt, px, pz) {
    const d = Math.hypot(px - COVE.x, pz - COVE.z);
    this.coveGroup.visible = d < 48 || !!this.host.camView;
    const near = d < 32;
    const dance = near && this.danceNow();
    let i = 0;
    for (const c of this.coveCrabs) {
      if (!c.g.visible || !near) continue;
      i++;
      c.dance = Math.max(0, (c.dance || 0) - dt);
      c.wave = Math.max(0, c.wave - dt);
      let moving = false;
      if (dance) {
        // a ring around the dance floor, turning slowly
        const a = (i / 12) * Math.PI * 2 + this.host.time * 0.4;
        c.tx = DANCE.x + Math.cos(a) * (DANCE.r - 0.3); c.tz = DANCE.z + Math.sin(a) * (DANCE.r - 0.3) * 0.8;
      } else {
        c.wait -= dt;
        if (c.wait <= 0) { c.wait = 2 + Math.random() * 4; c.tx = c.hx + (Math.random() - 0.5) * 1.6; c.tz = c.hz + (Math.random() - 0.5) * 1.0; }
      }
      const dx = c.tx - c.x, dz = c.tz - c.z, d = Math.hypot(dx, dz);
      if (d > 0.05 && c.wave <= 0) { const s = Math.min(d, dt * 1.2); c.x += (dx / d) * s; c.z += (dz / d) * s; moving = true; c.yaw = ALPHA(c.yaw, sideYaw(dx, dz), Math.min(1, dt * 6)); }
      else if (c.wave <= 0) c.yaw = ALPHA(c.yaw, 0, Math.min(1, dt * 3));
      const dancing = dance || c.dance > 0;
      c.g.position.set(c.x, this.groundY(c.x, c.z) + 0.02 + (dancing ? Math.abs(Math.sin(this.host.time * 6 + i)) * 0.12 : 0), c.z);
      c.g.rotation.y = c.yaw;
      animateCrab(c.g, dt, { walk: moving && !dancing ? 1 : 0, wave: c.wave > 0 ? 1 : 0, dance: dancing ? 1 : 0 });
    }
  }

  // ---------- island hooks ----------

  /** Today's crab in words: "a crab on its back" and "on Shell Isle" (the task list, the map, the Friends book). */
  todayWords(T = todaysCrab(this.S)) {
    return { what: t(`crab.what.${T.area === 'dive' && T.type === 'free' ? 'freeLobster' : T.type}`), where: t(`crab.where.${T.area}`) };
  }

  /** Task list: today's crab while it still needs a hand (wherever it is), and tonight's crab dance. */
  tasks() {
    const out = [];
    const T = todaysCrab(this.S);
    // (a crab already following you home counts as helped soon: the line stays until it is home)
    if (!T.helped && this.host.save.intro) out.push(t('crab.task.today', this.todayWords(T)));
    const k = this.level >= 3 && crabDanceKind();
    if (k) { const [a, b] = DANCE_HOURS[k]; const h = hourOf(); if (h < b) out.push(t(k === 'moon' ? 'crab.task.danceMoon' : 'crab.task.dance', { a, b })); }
    return out;
  }

  /** Shelby talks about the crabs you helped (her chat), or null. */
  shelbyLine() {
    const C = this.C;
    const L = (key, vars) => ({ who: 'shelby', key, vars });
    if (!C.helped) return L('crab.shelby.none');
    const herm = Object.keys(C.hermits);
    const pick = (C.helped + (this.shelbyI = (this.shelbyI || 0) + 1)) % 3;
    if (pick === 0 && herm.length) { const h = herm[this.shelbyI % herm.length]; return L('crab.shelby.hermit', { name: t(`crab.hermit.${h}`), shell: t(`isl.i.${C.hermits[h]}`) }); }
    if (pick === 1 && this.level < COVE_LEVELS.length - 1) return L('crab.shelby.next', { n: C.helped, m: COVE_LEVELS[this.level + 1].n - C.helped });
    return L('crab.shelby.helped', { n: C.helped, f: C.kinds.flip || 0, r: C.kinds.free || 0, h: C.kinds.home || 0 });
  }

  /** The Friends book's crab page (friends.js): numbers and names. */
  bookInfo() {
    const C = this.C, lv = this.level;
    const next = COVE_LEVELS[lv + 1];
    const wall = MUSEUM_CRABS.filter((id) => this.S.museum?.got?.[id]).length;
    const T = todaysCrab(this.S);
    return {
      today: T.helped ? t('crab.today.done') : ((w) => w.charAt(0).toUpperCase() + w.slice(1))(`${this.todayWords(T).what} ${this.todayWords(T).where}`),
      helped: C.helped, kinds: C.kinds, level: lv, next: next ? next.n - C.helped : 0, wall, wallMax: MUSEUM_CRABS.length,
      hermits: HERMITS.map((h) => ({ id: h, name: t(`crab.hermit.${h}`), shell: C.hermits[h] || null })),
      follower: C.follower ? this.friendName(C.follower) : null, friends: C.friends.map((f) => this.friendName(f)), released: C.released,
    };
  }

  dispose() {}
}
