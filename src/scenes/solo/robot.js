import * as THREE from 'three';
import { t, addStrings } from '../../core/i18n.js';
import { now, hourOf, give } from './save.js';
import { dayKey, dayIndex } from './calendar.js';
import { heightAt } from './map.js';
import { mesh, box, sph, cyl } from './models.js';
import { tileCenter, parseKey, stageOf } from './farm.js';
import { TROUGH, NEST } from './animals.js';

// Pip's robot helper, Bolt (the "livelier island" round, part 5). Once the greenhouse is fixed, Pip writes that
// she is building a helper; the next day Bolt stands on its charging pad by the greenhouse and Pip shows it to
// you (a short scene). Each day from 7 (while you are on the island, until 20) Bolt hovers once along a route:
// it waters the dry crops on the field and in the greenhouse, takes the eggs from the nest (it keeps them for you:
// talk to it) and tops up the trough with hay from the cottage chest when it runs low. You still harvest. Talk
// to Bolt to tell it to rest today, or until you say so. Then it goes back to its pad and charges quietly.
// Save: S.robot (old saves have none: no robot until the greenhouse is fixed).

const SPEED = 2.4;
const TROUGH_LOW = 4, TROUGH_FILL = 8;

addStrings({
  en: {
    'isl.npc.robot': 'Bolt',
    'isl.mail.robot': 'Hi {name}! The greenhouse looks great. It gave me an idea: I am building a little robot to help you with the chores! Come to the greenhouse tomorrow and meet it. Pip',
    'rb.pip.1': 'Ta-da! Meet Bolt, my robot helper!',
    'rb.pip.2': 'Every morning Bolt waters your dry crops, collects the eggs and fills the trough with hay from your chest.',
    'rb.pip.3': 'The harvest is still your job! And you can tell Bolt to rest when you like.',
    'rb.bolt.hello': 'BEEP BOOP. HELLO, FRIEND. CHORES: READY.',
    'rb.h.talk': '[B]: talk to Bolt', 'rb.h.eggs': '[B]: take the eggs from Bolt ({n})',
    'rb.bolt.eggs': 'BEEP. {n} EGGS FOR YOU. STILL WARM.',
    'rb.bolt.ask': 'BOOP? WHAT SHALL BOLT DO?',
    'rb.ch.work': 'Do the chores', 'rb.ch.today': 'Rest today', 'rb.ch.always': 'Rest until I say', 'rb.ch.bye': 'Nothing, thanks',
    'rb.bolt.work': 'BEEP! CHORES: ON.', 'rb.bolt.rest': 'BOOP. RESTING. ZZZ...', 'rb.bolt.bye': 'BEEP BEEP.',
    'rb.bolt.done': 'CHORES: DONE TODAY. BEEP.',
    'td.robot.built': 'Pip built a little robot helper! It is by the greenhouse.',
    'map.a.robot': 'Bolt, Pip\'s robot',
  },
  no: {
    'isl.npc.robot': 'Bolt',
    'isl.mail.robot': 'Hei {name}! Drivhuset ser flott ut. Det ga meg en idé: Jeg bygger en liten robot som kan hjelpe deg med gårdsarbeidet! Kom til drivhuset i morgen og hils på den. Pip',
    'rb.pip.1': 'Tadaa! Dette er Bolt, robothjelperen min!',
    'rb.pip.2': 'Hver morgen vanner Bolt de tørre plantene dine, samler eggene og fyller trauet med høy fra kista di.',
    'rb.pip.3': 'Innhøstingen er fortsatt jobben din! Og du kan be Bolt hvile når du vil.',
    'rb.bolt.hello': 'BIP BOP. HEI, VENN. ARBEID: KLAR.',
    'rb.h.talk': '[B]: snakk med Bolt', 'rb.h.eggs': '[B]: ta eggene fra Bolt ({n})',
    'rb.bolt.eggs': 'BIP. {n} EGG TIL DEG. FORTSATT VARME.',
    'rb.bolt.ask': 'BOP? HVA SKAL BOLT GJØRE?',
    'rb.ch.work': 'Gjør arbeidet', 'rb.ch.today': 'Hvil i dag', 'rb.ch.always': 'Hvil til jeg sier ifra', 'rb.ch.bye': 'Ingenting, takk',
    'rb.bolt.work': 'BIP! ARBEID: PÅ.', 'rb.bolt.rest': 'BOP. HVILER. ZZZ...', 'rb.bolt.bye': 'BIP BIP.',
    'rb.bolt.done': 'ARBEID: FERDIG I DAG. BIP.',
    'td.robot.built': 'Pip har bygget en liten robothjelper! Den står ved drivhuset.',
    'map.a.robot': 'Bolt, roboten til Pip',
  },
});

export class Robot {
  constructor(host) {
    this.host = host;
    this.model = makeRobot();
    this.model.visible = false;
    host.scene.add(this.model);
    this.pad = makePad();
    this.pad.visible = false;
    host.scene.add(this.pad);
    this.run = null;
    this.t = 0;
    this.x = 0; this.z = 0;
  }

  get S() { return this.host.save; }
  /** The robot's state (null until the greenhouse is fixed). */
  get R() { return this.S.robot || null; }

  /** The charging pad by the greenhouse (clear of its door, the field and the paths). */
  dock() {
    if (!this.dockAt) this.dockAt = this.host.map.findSpot(4.4, -0.8, 0.6);
    return this.dockAt;
  }

  /** A new day: Pip's letter after the greenhouse, Bolt the day after. */
  newDay(at) {
    const S = this.S, di = dayIndex(at);
    if (!S.unlocks?.greenhouse || !S.intro) return;
    if (!S.robot) { S.robot = { letter: di, built: false, day: '', eggs: 0, rest: false }; S.mail.push({ id: 'robot', from: 'pip' }); this.host.markDirty(); }
  }

  todayNews(at) {
    const R = this.R, di = dayIndex(at);
    return R && !R.built && di > R.letter ? [{ kind: 'changed', pri: 8, icon: '🤖', keys: ['td.robot.built'], ...this.dock() }] : [];
  }

  mapItems() {
    return this.model.visible ? [{ key: 'robot', icon: '🤖', name: t('map.a.robot'), x: this.x, z: this.z }] : [];
  }

  /** Is it here (built, or ready to be shown today)? */
  present(at = now()) {
    const R = this.R;
    return !!R && (R.built || dayIndex(at) > R.letter);
  }

  resting(at = now()) {
    const R = this.R;
    return !!R && (R.rest === 'always' || R.rest === dayKey(at));
  }

  tick(at) {
    if (!this.S.robot && this.S.unlocks?.greenhouse) this.newDay(at); // the greenhouse was just fixed: Pip writes
    const R = this.R, host = this.host;
    if (!R) return;
    if (!this.present(at) || host.isle2?.here()) { this.model.visible = this.pad.visible = false; return; }
    const d = this.dock();
    if (!this.pad.visible) { this.pad.position.set(d.x, heightAt(d.x, d.z), d.z); this.pad.visible = true; this.x = d.x; this.z = d.z; }
    this.model.visible = true;
    const h = hourOf(at), day = dayKey(at);
    if (R.built && !this.run && R.day !== day && !this.resting(at) && h >= 7 && h < 20 && host.mode === 'walk') this.startRun(at);
  }

  /** Today's route: the dry crops, the greenhouse beds, the nest, the trough, then home. */
  plan(at) {
    const S = this.S, out = [];
    const tiles = Object.entries(S.tiles || {}).map(([k, tl]) => ({ k, tl, ...parseKey(k) })).filter((x) => x.tl.crop && !(x.tl.wetUntil > at) && !x.tl.grass && stageOf(x.tl) < 3); // (ripe ones wait for you)
    // the field first (row by row), then the greenhouse
    tiles.sort((a, b) => a.f - b.f || a.r - b.r || (a.r % 2 ? b.c - a.c : a.c - b.c));
    for (const x of tiles) { const c = tileCenter(x.c, x.r, x.f); out.push({ x: c.x, z: c.z, do: 'water', tile: x }); }
    const Rn = S.ranch;
    if (S.unlocks.barn && Rn) {
      if (Rn.nest > 0) out.push({ x: NEST.x + 0.8, z: NEST.z - 0.6, do: 'eggs' });
      if (Rn.trough < TROUGH_LOW && (S.chest || []).some((it) => it.id === 'hay' && it.n > 0)) out.push({ x: TROUGH.x, z: TROUGH.z - 0.9, do: 'hay' });
    }
    const d = this.dock();
    out.push({ x: d.x, z: d.z, do: 'home' });
    return out;
  }

  startRun(at) {
    const R = this.R;
    R.day = dayKey(at);
    this.run = { steps: this.plan(at), i: 0, wait: 0.6, did: { water: 0, eggs: 0, hay: 0 } };
    this.host.markDirty();
  }

  /** Do the chore at a stop. */
  doStep(s) {
    const host = this.host, S = this.S, R = this.R, run = this.run, at = now();
    const pos = new THREE.Vector3(s.x, heightAt(s.x, s.z) + 0.4, s.z);
    if (s.do === 'water') {
      if (host.farm.water(s.tile.c, s.tile.r, at, s.tile.f)) { run.did.water++; host.puffs.burst(pos, 0x6fd0ff, { count: 6, speed: 1.6, up: 1, size: 0.16, life: 0.5, gravity: -12 }); }
    } else if (s.do === 'eggs') {
      const n = S.ranch.nest;
      if (n > 0) { S.ranch.nest = 0; R.eggs = (R.eggs || 0) + n; run.did.eggs += n; host.ranch.refresh(); }
    } else if (s.do === 'hay') {
      const it = (S.chest || []).find((x) => x.id === 'hay' && x.n > 0);
      if (it) {
        const k = Math.min(it.n, TROUGH_FILL - S.ranch.trough);
        it.n -= k;
        if (!it.n) S.chest.splice(S.chest.indexOf(it), 1);
        S.ranch.trough += k;
        run.did.hay += k;
        host.ranch.refresh();
        host.ranch.tick(at);
      }
    }
    host.markDirty();
  }

  // ---------- [B] ----------

  interactions(P, out, nm) {
    if (!this.model.visible || Math.hypot(P.x - this.x, P.z - this.z) > 1.6) return false;
    const R = this.R;
    if (R.built && R.eggs > 0) out.b = { text: nm('rb.h.eggs', { n: R.eggs }), fn: () => this.giveEggs() };
    else out.b = { text: nm('rb.h.talk'), fn: () => this.talk() };
    return true;
  }

  line(key, vars, extra = {}) { return { key, vars, speaker: 'isl.robot', css: '#5a8ac0', name: t('isl.npc.robot'), ...extra }; }

  giveEggs() {
    const host = this.host, R = this.R, n = R.eggs;
    R.eggs = 0;
    give(this.S, 'egg', n);
    host.game.audio.play('star');
    host.say([this.line('rb.bolt.eggs', { n })]);
    host.markDirty();
  }

  talk() {
    const host = this.host, R = this.R;
    if (!R.built) { this.showScene(); return; }
    host.say([this.line('rb.bolt.ask', null, {
      choices: ['rb.ch.work', 'rb.ch.today', 'rb.ch.always', 'rb.ch.bye'],
      onChoice: (i) => {
        if (i === 0) { R.rest = false; host.say([this.line(R.day === dayKey() && !this.run ? 'rb.bolt.done' : 'rb.bolt.work')]); }
        else if (i === 1 || i === 2) { R.rest = i === 1 ? dayKey() : 'always'; if (this.run) this.run.steps = this.run.steps.slice(-1), this.run.i = 0; host.say([this.line('rb.bolt.rest')]); }
        else host.say([this.line('rb.bolt.bye')]);
        host.markDirty();
      },
    })]);
  }

  /** The first meeting: Pip pops over and shows Bolt (a short scene). */
  showScene() {
    const host = this.host, R = this.R, pip = host.npc('pip'), P = host.player;
    if (!P || R.built) return;
    R.built = true;
    R.day = ''; // its first round starts right after
    if (pip && !pip.sleep && !pip.inside) {
      pip.intro = true; pip.route = [];
      pip.x = this.x - 1.3; pip.z = this.z + 1.1;
      host.puffs.burst(new THREE.Vector3(pip.x, heightAt(pip.x, pip.z) + 0.6, pip.z), 0xffffff, { count: 10, speed: 3, size: 0.35 });
      pip.model.face(P.x - pip.x, P.z - pip.z);
    }
    const lines = pip && pip.intro ? [{ who: 'pip', key: 'rb.pip.1', fx: () => { pip.hop = 1; this.hop = 1; } }, this.line('rb.bolt.hello'), { who: 'pip', key: 'rb.pip.2' }, { who: 'pip', key: 'rb.pip.3' }] : [this.line('rb.bolt.hello'), { who: 'pip', key: 'rb.pip.2' }];
    host.say(lines, () => { if (pip) { pip.intro = false; pip.spotName = null; } });
    host.game.audio.play('fanfare');
    host.markDirty();
  }

  // ---------- every frame ----------

  update(dt) {
    const host = this.host, R = this.R, P = host.player;
    if (!R || !this.model.visible) return;
    this.t += dt;
    // the first meeting starts when you come near the greenhouse on Bolt's first day
    if (!R.built && P && host.mode === 'walk' && Math.hypot(P.x - this.x, P.z - this.z) < 5) this.showScene();
    const run = this.run;
    if (run) {
      const s = run.steps[run.i];
      if (!s) { this.run = null; }
      else if (run.wait > 0) run.wait -= dt;
      else {
        const dx = s.x - this.x, dz = s.z - this.z, d = Math.hypot(dx, dz);
        if (d < 0.08) { this.doStep(s); run.i++; run.wait = s.do === 'home' ? 0 : 0.35; if (s.do === 'home') { this.lastRun = run; this.run = null; } }
        else { const k = Math.min(d, SPEED * dt); this.x += (dx / d) * k; this.z += (dz / d) * k; this.model.rotation.y = Math.atan2(dx, dz); }
      }
    }
    this.hop = Math.max(0, (this.hop || 0) - dt * 2);
    const flying = !!this.run;
    this.model.position.set(this.x, heightAt(this.x, this.z) + (flying ? 0.55 : 0.18) + Math.sin(this.t * 3) * 0.05 + Math.sin(this.hop * Math.PI) * 0.4, this.z);
    const u = this.model.userData;
    u.light.material.color.setHex(this.resting() ? 0x5a6a8a : flying ? 0x7ff0a0 : (Math.sin(this.t * 2) > 0 ? 0x7fd0ff : 0x3a7aaa)); // a slow charging blink on the pad
    u.prop.rotation.y += dt * (flying ? 18 : 0);
    if (!flying && P) this.model.rotation.y += (Math.atan2(P.x - this.x, P.z - this.z) - this.model.rotation.y) * Math.min(1, dt * 2) * (Math.hypot(P.x - this.x, P.z - this.z) < 4 ? 1 : 0);
  }
}

function makeRobot() {
  const g = new THREE.Group();
  const body = mesh(sph(0.3, 14, 10), 0xdfe6f0, 0, 0.3, 0);
  body.scale.set(1, 0.9, 1);
  g.add(body, mesh(cyl(0.3, 0.22, 0.12, 14), 0x9aa6b8, 0, 0.08, 0));
  g.add(mesh(box(0.34, 0.14, 0.05), 0x2b2340, 0, 0.36, 0.27, false));
  for (const x of [-0.08, 0.08]) g.add(mesh(sph(0.035, 6, 4), new THREE.MeshBasicMaterial({ color: 0x7ff0ff }), x, 0.37, 0.3, false));
  g.add(mesh(box(0.06, 0.2, 0.06), 0x9aa6b8, -0.33, 0.28, 0), mesh(box(0.06, 0.2, 0.06), 0x9aa6b8, 0.33, 0.28, 0));
  const light = mesh(sph(0.06, 8, 6), new THREE.MeshBasicMaterial({ color: 0x7fd0ff }), 0, 0.72, 0, false);
  g.add(mesh(cyl(0.015, 0.015, 0.16, 5), 0x5a5a6a, 0, 0.62, 0, false), light);
  const prop = new THREE.Group();
  prop.add(mesh(box(0.5, 0.02, 0.06), 0x5a5a6a, 0, 0, 0, false), mesh(box(0.06, 0.02, 0.5), 0x5a5a6a, 0, 0, 0, false));
  prop.position.y = 0.0;
  g.add(prop);
  // a little basket for the eggs
  g.add(mesh(cyl(0.12, 0.09, 0.1, 10), 0xb07a4a, 0, 0.2, -0.3, false));
  g.userData.light = light;
  g.userData.prop = prop;
  return g;
}

function makePad() {
  const g = new THREE.Group();
  g.add(mesh(cyl(0.5, 0.55, 0.08, 16), 0x9aa6b8, 0, 0.04, 0), mesh(cyl(0.36, 0.36, 0.02, 16), 0x4a3fc0, 0, 0.09, 0, false));
  g.add(mesh(box(0.06, 0.5, 0.06), 0x5a5a6a, 0.48, 0.25, -0.2), mesh(box(0.14, 0.1, 0.14), 0xffd23f, 0.48, 0.52, -0.2, false));
  return g;
}
