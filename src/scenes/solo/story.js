import * as THREE from 'three';
import { t } from '../../core/i18n.js';
import { esc } from '../../core/ui.js';
import { say as speak } from '../../core/voice.js';
import { count, take, give } from './save.js';
import { dayKey } from './calendar.js';
import { NPCS, npcState, heartsOf } from './npcs.js';
import { PLACES, heightAt } from './map.js';
import { makeStairsDoor, makeCrumb, makeNightCrystal, makeSkyLantern } from './models4.js';

// The lighthouse story (milestone B4): "Why did the lamp go dark?" Six chapters, driven by Keeper Bram.
// Each chapter has an opening scene (a few read-aloud lines with simple staging: friends pop in next to
// you, the view slides over to them or to the lighthouse, speakers hop), a small quest, and a closing
// scene with a reward. Then a letter says who to see next. Goals are one of:
//   talk  a villager tells you something          bring  items for a villager
//   game  a point reached in a solo game          find   glowing crumbs to pick up on the island
// Game goals read the games' own saves (roster.progress) and never block: a step that was already done
// in earlier play counts at once. The story starts after the tutorial once Bram has 2 hearts or the
// Lighthouse Caves have been visited. From then the lamp is dark at night, until the Lamp Festival at the
// end lights it again (a long beam sweeps every night from then on) and opens the lighthouse top
// (lighttop.js). Saved in roster.progress.island.story.
//
// Chapters and their goals:
//   1 The lamp went dark   talk to Hazel, Rosa and Grumbleton about that night
//   2 Down in the caves    Lighthouse Caves: bring back a crystal                 (game)
//   3 The moon lens        bring Shelby on Shell Isle two coconuts for her lens
//   4 The pudding gear     The Secret of Pudding Island: finish the first part    (game)
//   5 The green glow       Sky Hop: fly one level with Pip (game), then follow the glowing crumbs to Mumble
//   6 The Lamp Festival    wood and stone to fix the stairs, invite four friends, then the night festival

export const CHAPTERS = 6;
const LH = PLACES.find((p) => p.id === 'lighthouse');
const DOOR_A = 0.85; // where the stairs door sits on the tower (angle from +x toward +z)
export const STAIRS = { x: LH.x + Math.cos(DOOR_A) * 3.25, z: LH.z + Math.sin(DOOR_A) * 3.25 };
// the glowing crumbs: from the lighthouse path toward Mumble's meadow
const CRUMBS = [[39.6, 18.6], [43.4, 5.2], [45.2, -4.6]];
const PARTY = [0xff5d73, 0xffc93c, 0x3ddc97, 0x4cc9f0, 0x9b5de5, 0xffffff];

// Lines are [who, fx]; their text keys are story.c<n>.<part>.<i> (who null = the narrator).
// fx: hop (the speaker hops), lh (the view slides to the lighthouse), back (the view returns), fix (stairs).
const GAMES = {
  lighthouse: (p) => (p.lighthouse?.crystals || 0) >= 1,
  adventure: (p) => !!(p.adventure?.done || p.adventure?.done2),
  platformer: (p) => (p.skyhop || 0) >= 1,
};
const CH = [
  null,
  { // 1 The lamp went dark
    opener: 'bram', cast: ['grumbleton'],
    open: [['bram', 'hop'], ['grumbleton', 'hop'], ['bram', 'lh'], ['bram', 'back'], ['grumbleton']],
    stages: [[{ id: 'hazel', talk: 'hazel', n: 2 }, { id: 'rosa', talk: 'rosa', n: 2 }, { id: 'grumbleton', talk: 'grumbleton', n: 2 }]],
    closer: 'bram', close: [['bram'], ['bram', 'hop']], wait: 'bram',
    reward: { coins: 30 },
  },
  { // 2 Down in the caves
    opener: 'bram', cast: [],
    open: [['bram'], ['bram', 'lh'], ['bram', 'back']],
    stages: [[{ id: 'caves', game: 'lighthouse' }]],
    closer: 'bram', close: [['bram', 'hop'], ['bram'], ['bram']], wait: 'bram',
    reward: { coins: 50, items: [['pumpkinSeed', 2]] },
  },
  { // 3 The moon lens
    opener: 'hoot', cast: [],
    open: [['hoot', 'hop'], ['hoot'], ['hoot']],
    stages: [[{ id: 'coconuts', bring: 'shelby', need: [['coconut', 2]], ask: 2, done: 2 }]],
    closer: 'bram', close: [['bram', 'hop'], ['bram']], wait: 'hoot',
    reward: { coins: 60 },
  },
  { // 4 The pudding gear
    opener: 'grumbleton', cast: ['bram'],
    open: [['grumbleton'], ['bram', 'hop'], ['grumbleton'], ['bram', 'hop'], ['grumbleton']],
    stages: [[{ id: 'pudding', game: 'adventure' }]],
    closer: 'grumbleton', closeCast: ['bram'], close: [['grumbleton', 'hop'], ['bram']], wait: 'grumbleton',
    reward: { coins: 60, items: [['strawberrySeed', 3]] },
  },
  { // 5 The green glow
    opener: 'pip', cast: [],
    open: [['pip', 'hop'], ['pip'], ['pip']],
    stages: [[{ id: 'skyhop', game: 'platformer' }], [{ id: 'crumbs', find: CRUMBS }]],
    closer: 'mumble', closeCast: ['bram'], close: [['mumble'], ['mumble'], ['bram', 'hop'], ['mumble', 'hop'], ['bram'], ['mumble', 'hop']], wait: 'pip',
    reward: { coins: 40, items: [['radishSeed', 5]] },
  },
  { // 6 The Lamp Festival
    opener: 'bram', cast: ['rosa', 'hazel'],
    open: [['bram'], ['rosa', 'hop'], ['hazel', 'hop'], ['bram']],
    stages: [[{ id: 'stairs', bring: 'bram', need: [['wood', 5], ['stone', 3]], ask: 1, done: 2 }],
      [{ id: 'pip', talk: 'pip', n: 1 }, { id: 'grumbleton', talk: 'grumbleton', n: 2 }, { id: 'hoot', talk: 'hoot', n: 1 }, { id: 'mumble', talk: 'mumble', n: 1 }]],
    closer: 'bram', close: [['bram', 'hop']], wait: 'bram',
    reward: { coins: 200, deco: 'miniLighthouse' },
  },
];

// The festival crowd: everyone in an arc south of the lighthouse door, Bram at the door.
const FEST_SPOT = { x: LH.x, z: LH.z + 4.9 };
const FEST_ORDER = ['grumbleton', 'hazel', 'rosa', 'mumble', null, 'pip', 'hoot', 'shelby']; // null = you
const FEST_LINES = [[null], ['bram', 'hop'], ['pip', 'light'], ['hazel', 'hop'], ['grumbleton'], ['rosa', 'lanterns'], ['hoot', 'hop'], ['shelby'], ['mumble', 'hop'], ['bram', 'reward']];

const CSS = `
.isl-fade { position: absolute; inset: 0; background: #0b1030; opacity: 0; pointer-events: none; display: flex; align-items: center; justify-content: center; }
.isl-fade span { color: #fff3c4; font-weight: 700; font-size: clamp(26px, 3.4vw, 52px); text-shadow: 0 3px 0 rgba(0,0,0,.35); }
`;
function injectStyle() {
  if (document.getElementById('isl-story-style')) return;
  const el = document.createElement('style');
  el.id = 'isl-story-style';
  el.textContent = CSS;
  document.head.appendChild(el);
}

export class Story {
  constructor(host) {
    injectStyle();
    this.host = host;
    const S = host.save;
    const f = { ch: 0, phase: 'locked', stage: 0, goals: {}, asked: {}, crumbs: [], stairs: false, festDay: '', stars: {}, filterTold: false, topVisits: 0 };
    if (!S.story || typeof S.story !== 'object') S.story = f;
    for (const k of Object.keys(f)) if (S.story[k] === undefined) S.story[k] = f[k];
    const map = host.map;
    // the lighthouse's own lamp material (dark while the story is on, see applyLamp)
    this.lampMat = new THREE.MeshBasicMaterial({ color: 0xf3ead2 });
    map.lighthouse.traverse((o) => { if (o.isMesh && o.material === host.M.lamp) o.material = this.lampMat; });
    // the long beams after the festival: the old beam stretched, and a second one opposite
    const pivot = map.lighthouse.userData.beam;
    this.beam = pivot.children[0];
    this.beam2 = this.beam.clone();
    this.beam2.rotation.z = -Math.PI / 2;
    pivot.add(this.beam2);
    // ...and where they sweep, a soft path of light on the ground and the water
    const shape = new THREE.Shape([new THREE.Vector2(4, -0.5), new THREE.Vector2(24, -2.6), new THREE.Vector2(24, 2.6), new THREE.Vector2(4, 0.5)]);
    this.pathMat = new THREE.MeshBasicMaterial({ color: 0xfff3b0, transparent: true, opacity: 0, depthWrite: false });
    this.paths = [1, -1].map((s) => {
      const m = new THREE.Mesh(new THREE.ShapeGeometry(shape), this.pathMat);
      m.rotation.set(-Math.PI / 2, 0, s > 0 ? 0 : Math.PI);
      m.position.y = -pivot.position.y + 0.1;
      m.renderOrder = 2;
      pivot.add(m);
      return m;
    });
    // the stairs door on the tower's side
    this.door = makeStairsDoor();
    this.door.position.set(LH.x + Math.cos(DOOR_A) * 2.02, 0.7, LH.z + Math.sin(DOOR_A) * 2.02); // on the stone base, like the front door
    this.door.rotation.y = Math.PI / 2 - DOOR_A;
    host.scene.add(this.door);
    // glowing crumbs (chapter 5)
    this.crumbs = CRUMBS.map(([x, z], i) => { const g = makeCrumb(); g.position.set(x, heightAt(x, z) + 0.05, z); g.visible = false; host.scene.add(g); return { i, x, z, g }; });
    this.fade = null;
    this.fadeEl = null;
    this.fest = null;
    this.look = null;
    this.refresh();
  }

  get S() { return this.host.save.story; }
  get chapter() { return CH[this.S.ch] || null; }
  get done() { return this.S.phase === 'done'; }

  // ---------- state ----------

  /** The story may start: tutorial done, and two hearts with Bram or a visit to Lighthouse Caves. */
  gateOpen() {
    const host = this.host, I = host.save;
    if (!I.intro || I.tut < 8) return false;
    return heartsOf(npcState(I, 'bram')) >= 2 || !!I.visited?.lighthouse || !!host.game.roster.progress.lighthouse;
  }

  /** Once a second: open the story, and see if game goals were reached. */
  tick() {
    const S = this.S;
    if (S.phase === 'locked' && this.gateOpen()) {
      S.ch = 1;
      S.phase = 'ready';
      this.letter(1);
      this.host.markDirty();
    }
    if (S.phase === 'quest' && this.checkGoals()) this.host.markDirty();
    this.refresh();
  }

  /** The current stage's goals. */
  stageGoals() {
    const c = this.chapter;
    return c && this.S.phase === 'quest' ? c.stages[this.S.stage] || [] : [];
  }

  /** Mark game and find goals that are reached; move on when a stage is complete. True if anything changed. */
  checkGoals(quiet = false) {
    const S = this.S, p = this.host.game.roster.progress;
    let changed = false;
    for (const g of this.stageGoals()) {
      if (S.goals[g.id]) continue;
      if ((g.game && GAMES[g.game](p)) || (g.find && S.crumbs.filter(Boolean).length >= g.find.length)) { S.goals[g.id] = true; changed = true; }
    }
    if (changed || this.stageDone()) this.advance(quiet);
    return changed;
  }

  stageDone() {
    const goals = this.stageGoals();
    return goals.length > 0 && goals.every((g) => this.S.goals[g.id]);
  }

  /** Next stage, or time to report back to the chapter's closer. */
  advance(quiet = false) {
    const S = this.S, c = this.chapter;
    while (S.phase === 'quest' && this.stageDone()) {
      S.stage++;
      if (S.stage >= c.stages.length) {
        S.phase = 'report';
        if (!quiet) this.news(t('story.t.report', { name: t(`isl.npc.${c.closer}`) }));
      } else if (!quiet) this.news(t(`story.c${S.ch}.next${S.stage}`));
    }
    this.refresh();
  }

  news(text) {
    this.host.game.ui.toast(text, 3000);
    speak(text);
    this.host.game.audio.play('star');
  }

  /** A letter from the next chapter's opener says where to go. */
  letter(n) {
    this.host.save.mail.push({ id: `story${n}`, from: CH[n].opener, items: [] });
    this.host.later(0.6, () => this.host.mailToast());
  }

  /** Show the world as the story says: the door's planks, the crumbs, Mumble's nightlight. */
  refresh() {
    const S = this.S;
    this.door.userData.planks.visible = !S.stairs && !this.done;
    const findOn = this.stageGoals().some((g) => g.find);
    for (const c of this.crumbs) c.g.visible = findOn && !S.crumbs[c.i];
    const mumble = this.host.npc?.('mumble');
    const glow = S.ch > 5 || this.done;
    if (mumble && glow && !mumble.nightCrystal) {
      mumble.nightCrystal = makeNightCrystal();
      mumble.nightCrystal.position.set(0.45, 0.35, 0.25);
      mumble.model.group.add(mumble.nightCrystal);
    }
  }

  // ---------- the lamp ----------

  /** Called by the island's sky update. lit: it is dark enough for lamps. */
  applyLamp(lit) {
    const S = this.S, M = this.host.M;
    const dark = S.phase !== 'locked' && S.phase !== 'done' && !this.fest?.lit;
    const bright = this.done || !!this.fest?.lit;
    this.lampMat.color.setHex(dark ? 0x5d6478 : lit ? 0xffe08a : 0xf3ead2);
    M.beam.opacity = dark || !lit ? 0 : bright ? 0.3 : 0.22;
    // after the festival the beam is long (it reaches over the sea), with a twin on the other side
    const L = bright ? 2.4 : 1, R = bright ? 1.6 : 1;
    this.beam.scale.set(R, L, R);
    this.beam.position.x = 0.1 + 4.5 * L;
    this.beam2.scale.set(R, L, R);
    this.beam2.position.x = -(0.1 + 4.5 * L);
    this.beam2.visible = bright;
    this.pathMat.opacity = bright && lit ? 0.2 : 0;
    for (const m of this.paths) m.visible = bright && lit;
  }

  // ---------- talking ----------

  /** Story lines for this villager, if any: plays them and returns true. done() runs at the very end. */
  talk(n, done) {
    const S = this.S, c = this.chapter;
    if (!c) return false;
    const id = n.id;
    if (S.phase === 'ready' && id === c.opener) { this.opening(n, done); return true; }
    if (S.phase === 'report' && id === c.closer) { this.closing(n, [], done); return true; }
    if (S.phase !== 'quest') return false;
    const g = this.stageGoals().find((x) => !S.goals[x.id] && (x.talk === id || x.bring === id));
    if (!g) return false;
    const L = (part, i, fx) => ({ who: id, key: `story.c${S.ch}.${g.id}.${part}${i}`, fx: fx ? () => this.fx(fx, n) : null });
    if (g.talk) {
      const lines = [];
      for (let i = 1; i <= g.n; i++) lines.push(L('', i, i === 1 ? 'hop' : null));
      this.host.say(lines, () => { S.goals[g.id] = true; this.host.game.audio.play('beep'); this.afterGoal(n, done); });
      return true;
    }
    // bring: the items now, or what is needed
    const ready = g.need.every(([it, k]) => count(this.host.save, it) >= k);
    if (!ready) {
      S.asked[g.id] = true;
      const lines = [];
      for (let i = 1; i <= g.ask; i++) lines.push(L('ask', i, i === 1 ? 'hop' : null));
      this.host.say(lines, () => { this.host.markDirty(); done(); });
      return true;
    }
    for (const [it, k] of g.need) take(this.host.save, it, k);
    const lines = [];
    for (let i = 1; i <= g.done; i++) lines.push(L('done', i, i === 1 ? 'hop' : g.id === 'stairs' && i === 2 ? 'fix' : null));
    this.host.say(lines, () => { S.goals[g.id] = true; this.host.celebrate(n); this.afterGoal(n, done); });
    return true;
  }

  /** A goal was reached by talking: the stage may be complete; the closer may be right here. */
  afterGoal(n, done) {
    const S = this.S, c = this.chapter;
    this.advance();
    this.host.markDirty();
    if (S.phase === 'report' && c.closer === n.id) { this.closing(n, [], done); return; }
    done();
  }

  /** A reminder instead of small talk while a chapter waits (see island.talkTo). */
  waitLine(n) {
    const S = this.S, c = this.chapter;
    if (!c || S.phase !== 'quest' || c.wait !== n.id) return null;
    return { who: n.id, key: `story.c${S.ch}.wait` };
  }

  /** Something to say: the "!" over a villager's head. */
  hasNews(id) {
    const S = this.S, c = this.chapter;
    if (!c) return false;
    if (S.phase === 'ready') return id === c.opener;
    if (S.phase === 'report') return id === c.closer;
    if (S.phase !== 'quest') return false;
    return this.stageGoals().some((g) => !S.goals[g.id] && (g.talk === id || (g.bring === id && (!S.asked[g.id] || g.need.every(([it, k]) => count(this.host.save, it) >= k)))));
  }

  // ---------- scenes ----------

  opening(n, done) {
    const S = this.S, ch = S.ch, c = this.chapter;
    const lines = [{ key: 'story.chapterLine', vars: { n: ch, title: t(`story.c${ch}.title`) } }, ...this.lines(ch, 'open', c.open)];
    this.scene(n, c.cast, lines, () => {
      S.phase = 'quest';
      S.stage = 0;
      S.goals = {};
      S.asked = {};
      if (ch === 3 && !this.host.save.isle2?.chart) {
        // Hoot's book has the way to Shell Isle: Grumbleton can sail you there now
        this.host.isle2.learnChart();
        this.host.later(0.4, () => this.news(t('story.t.chart')));
      }
      this.host.game.ui.toast(t('isl.t.quest'));
      this.host.game.audio.play('beep');
      // game steps done in earlier play count at once
      const before = S.stage;
      const was = this.stageGoals().map((g) => g.id);
      this.checkGoals(true);
      const already = S.stage > before || was.some((id) => S.goals[id]);
      this.host.markDirty();
      if (!already) { done(); return; }
      const more = [{ who: c.opener, key: `story.c${ch}.already`, fxName: 'hop', fx: () => this.fx('hop', n) }];
      if (S.phase === 'report' && c.closer === c.opener) { this.closing(n, more, done); return; }
      this.host.say(more, () => { if (S.phase === 'quest' && S.stage > before) this.news(t(`story.c${ch}.next${S.stage}`)); done(); });
    });
  }

  closing(n, pre, done) {
    const S = this.S, ch = S.ch, c = this.chapter;
    const lines = [...pre, ...this.lines(ch, 'close', c.close)];
    this.scene(n, c.closeCast || [], lines, () => {
      if (ch === CHAPTERS) { this.startFestival(done); return; }
      this.host.game.ui.toast(t('story.t.chapterDone', { n: ch }), 2600);
      this.host.grant(c.reward);
      S.ch = ch + 1;
      S.phase = 'ready';
      S.stage = 0;
      S.goals = {};
      S.asked = {};
      this.letter(S.ch);
      this.refresh();
      this.host.markDirty();
      done();
    });
  }

  lines(ch, part, list) {
    return list.map(([who, fx], i) => ({ who, key: `story.c${ch}.${part}.${i + 1}`, fxName: fx }));
  }

  /** Play lines with simple staging: the cast pops in near you, speakers face you and hop, the view slides. */
  scene(anchor, castIds, lines, done) {
    const host = this.host, P = host.player;
    const cast = [anchor, ...castIds.map((id) => host.npc(id)).filter((m) => m && m !== anchor)];
    const slots = [[-1.9, -1.0], [1.9, -1.0], [-2.6, 0.7], [2.6, 0.7], [0, -2.2]];
    for (const m of cast) {
      m.busy = true;
      m.route = [];
      m.sleep = false;
      if (m === anchor || Math.hypot(m.x - P.x, m.z - P.z) < 5) continue;
      const st = this.host.walkState;
      const s = slots.find(([dx, dz]) => host.map.walkable(P.x + dx, P.z + dz, 0.4, st) && cast.every((o) => o === m || Math.hypot(o.x - P.x - dx, o.z - P.z - dz) > 1.2));
      if (!s) continue;
      m.x = P.x + s[0];
      m.z = P.z + s[1];
      m.model.group.visible = true;
      host.puffs.burst(new THREE.Vector3(m.x, 0.8, m.z), 0xffffff, { count: 10, speed: 3, size: 0.35 });
    }
    const frame = () => {
      let x = P.x, z = P.z;
      for (const m of cast) { x += m.x; z += m.z; }
      x /= cast.length + 1; z /= cast.length + 1;
      host.camOffset = { x: THREE.MathUtils.clamp(x - P.x, -5, 5), z: THREE.MathUtils.clamp(z - P.z, -4, 4) };
    };
    frame();
    const face = (who) => {
      const sp = who ? cast.find((m) => m.id === who) : null;
      for (const m of cast) if (m !== sp) m.model.face((sp?.x ?? P.x) - m.x, (sp?.z ?? P.z) - m.z);
      if (sp) { sp.model.face(P.x - sp.x, P.z - sp.z); P.ch.face(sp.x - P.x, sp.z - P.z); }
    };
    const out = lines.map((L) => ({ ...L, fx: () => { face(L.who); if (L.fxName) this.fx(L.fxName, cast.find((m) => m.id === L.who) || anchor, frame); } }));
    host.say(out, () => {
      for (const m of cast) { m.busy = false; m.spotName = null; m.talking = false; }
      host.camOffset = null;
      if (this.look) { this.look = null; host.camView = null; }
      done?.();
    });
  }

  fx(name, n, frame) {
    const host = this.host, P = host.player;
    if (name === 'hop' && n) n.hop = 1;
    if (name === 'lh' && Math.hypot(LH.x - P.x, LH.z - P.z) < 30) {
      // look up at the lamp: the camera stays where it is (same distance), it only tilts up
      const from = host.camTarget.clone().add(new THREE.Vector3(0, 0.6, 0));
      this.look = { cur: from, home: from.clone(), to: new THREE.Vector3(LH.x, 10.5, LH.z), back: false };
      host.camView = { pos: host.camera.position.clone(), look: this.look.cur };
    }
    if (name === 'back') { if (this.look) { this.look.to = this.look.home; this.look.back = true; } frame?.(); }
    if (name === 'fix') {
      this.S.stairs = true;
      this.refresh();
      host.puffs.burst(new THREE.Vector3(STAIRS.x, 1.2, STAIRS.z), 0xc68a52, { count: 16, speed: 4, size: 0.35 });
      host.game.audio.play('land');
    }
  }

  // ---------- the island's interactions ----------

  /** [B] at the stairs door, and on the glowing crumbs. */
  interactions(P, out, nm) {
    if (out.b) return;
    const S = this.S;
    for (const c of this.crumbs) {
      if (!c.g.visible || Math.hypot(P.x - c.x, P.z - c.z) > 1.5) continue;
      out.b = { text: nm('isl.h.pick', { item: t('story.crumb') }), fn: () => this.pickCrumb(c) };
      return;
    }
    if (Math.hypot(P.x - STAIRS.x, P.z - STAIRS.z) < 1.5) {
      if (this.done) out.b = { text: nm('story.h.climb'), fn: () => this.host.lightTop.enter() };
      else out.b = { text: nm('isl.h.sign'), fn: () => this.host.say([{ key: S.stairs ? 'story.stairs.soon' : 'story.stairs.closed' }]) };
    }
  }

  pickCrumb(c) {
    const S = this.S, host = this.host;
    S.crumbs[c.i] = true;
    c.g.visible = false;
    host.confetti.burst(new THREE.Vector3(c.x, 0.8, c.z), 0, { count: 20, speed: 3, up: 3, colors: [0x9dff7a, 0xffffff, 0xff4f6d], life: 1, gravity: -6 });
    host.game.audio.play('star');
    const k = S.crumbs.filter(Boolean).length;
    const txt = t(k >= CRUMBS.length ? 'story.crumbLast' : 'story.crumbFound', { n: k, m: CRUMBS.length });
    host.game.ui.toast(txt, 2400);
    speak(txt);
    this.checkGoals(true);
    host.markDirty();
  }

  // ---------- the task list and the calendar ----------

  tasks() {
    const S = this.S, c = this.chapter;
    if (!c) return [];
    const title = t(`story.c${S.ch}.title`);
    if (S.phase === 'ready') return [`📖 ${t('story.task.ready', { name: t(`isl.npc.${c.opener}`), title })}`];
    if (S.phase === 'report') {
      const own = `story.c${S.ch}.task.report`; // a chapter can say it its own way
      return [`📖 ${t(own) !== own ? t(own) : t('story.task.report', { name: t(`isl.npc.${c.closer}`) })}`];
    }
    if (S.phase !== 'quest') return [];
    const out = [];
    for (const g of this.stageGoals()) {
      if (S.goals[g.id]) continue;
      const vars = {};
      if (g.need) {
        vars.list = g.need.map(([it, k]) => `${k} ${t(`isl.i.${it}`)} (${Math.min(k, count(this.host.save, it))}/${k})`).join(', ');
        vars.n = Math.min(g.need[0][1], count(this.host.save, g.need[0][0]));
      }
      if (g.find) vars.n = S.crumbs.filter(Boolean).length;
      out.push(`📖 ${t(`story.c${S.ch}.task.${g.id}`, vars)}`);
    }
    return out.slice(0, 2);
  }

  /** The calendar board's line about the story. */
  calendarLine() {
    const S = this.S;
    if (S.phase === 'locked') return '';
    if (this.done) return t('story.cal.done');
    return t('story.cal', { n: S.ch, m: CHAPTERS, title: t(`story.c${S.ch}.title`) });
  }

  // ---------- the Lamp Festival ----------

  startFestival(done) {
    const host = this.host;
    this.fest = { t: 0, lit: false, lanterns: [], fw: 0, done };
    host.mode = 'festival';
    host.hud.setPrompt('');
    this.fadeTo(1, 0.7, t('story.fest.night'), () => {
      this.setupFestival();
      this.fadeTo(0, 0.9, '', () => this.festLines());
    });
  }

  setupFestival() {
    const host = this.host, P = host.player;
    host.forceHour = 21.7;
    host.applySky();
    host.seasons.lanternDeco.visible = true;
    host.hud.setCinema(true);
    host.game.audio.playMusic('party');
    // everyone in an arc south of the door; Bram at the door
    const bram = host.npc('bram');
    this.festCast = [bram];
    bram.x = LH.x; bram.z = LH.z + 4.3;
    FEST_ORDER.forEach((id, i) => {
      const a = Math.PI * (0.16 + (i / (FEST_ORDER.length - 1)) * 0.68);
      const x = FEST_SPOT.x - Math.cos(a) * 4.3, z = FEST_SPOT.z + Math.sin(a) * 2.6;
      if (!id) { P.x = x; P.z = z; P.fx = 0; P.fz = -1; P.ch.face(0, -1); return; }
      const m = host.npc(id);
      m.x = x; m.z = z;
      this.festCast.push(m);
    });
    for (const m of this.festCast) {
      m.busy = true; m.route = []; m.sleep = false; m.away = false; m.talking = true;
      m.model.group.visible = true;
      m.model.face(LH.x - m.x, LH.z - m.z);
    }
    bram.model.face(0, 1);
    // a view of its own: the crowd below, the lighthouse above
    host.camView = { pos: new THREE.Vector3(LH.x, 6, LH.z + 31.5), look: new THREE.Vector3(LH.x, 1.85, LH.z + 1.5) };
    host.camTarget.set(LH.x, 0, LH.z + 6);
  }

  festLines() {
    const host = this.host, P = host.player;
    const lines = FEST_LINES.map(([who, fx], i) => ({ who, key: `story.fest.${i + 1}`, fx: () => {
      // the speaker turns to us; everyone else looks at the light
      for (const m of this.festCast) m.model.face(m.id === 'bram' ? 0 : LH.x - m.x, m.id === 'bram' ? 1 : LH.z - m.z);
      const sp = who && this.festCast.find((m) => m.id === who);
      if (sp) sp.model.face(0, 1);
      if (fx === 'hop' && sp) sp.hop = 1;
      if (fx === 'light') this.lightUp();
      if (fx === 'lanterns') this.releaseLanterns();
      if (fx === 'reward') { if (sp) sp.hop = 1; this.festReward(); }
    } }));
    host.mode = 'walk';
    host.say(lines, () => {
      host.mode = 'festival';
      this.fadeTo(1, 0.7, '', () => { this.endFestival(); this.fadeTo(0, 0.7, '', () => { host.mode = 'walk'; const d = this.fest?.done; this.fest = null; d?.(); }); });
    });
    P.ch.face(0, -1);
  }

  lightUp() {
    const host = this.host;
    this.fest.lit = true;
    host.applySky();
    host.game.audio.play('fanfare');
    host.confetti.burst(new THREE.Vector3(LH.x, 12, LH.z), 0, { count: 80, speed: 9, up: 4, life: 2, gravity: -3, colors: [0xfff3b0, 0xffd23f, 0xffffff] });
  }

  releaseLanterns() {
    const host = this.host;
    host.game.audio.play('whoosh');
    for (let i = 0; i < 16; i++) {
      const g = makeSkyLantern([0xffb347, 0xff8c5a, 0xffd27a][i % 3]);
      const x = FEST_SPOT.x - 5 + Math.random() * 10, z = FEST_SPOT.z - 1 + Math.random() * 3;
      g.position.set(x, 1.4, z);
      host.scene.add(g);
      this.fest.lanterns.push({ g, x, z, v: 0.9 + Math.random() * 0.6, ph: Math.random() * 6, delay: i * 0.18 });
    }
  }

  festReward() {
    const S = this.S, host = this.host;
    if (S.phase === 'done') return;
    S.phase = 'done';
    S.ch = CHAPTERS + 1;
    S.festDay = dayKey();
    host.grant(CH[CHAPTERS].reward);
    host.later(0.8, () => this.news(t('story.t.topOpen')));
    this.refresh();
    host.markDirty();
  }

  endFestival() {
    const host = this.host;
    host.forceHour = null;
    host.camView = null;
    host.hud.setCinema(false);
    for (const l of this.fest.lanterns) l.g.removeFromParent();
    this.fest.lanterns = [];
    for (const m of this.festCast || []) { m.busy = false; m.talking = false; m.spotName = null; m.route = []; }
    this.festCast = null;
    this.fest.lit = false;
    host.seasons.refresh();
    host.applySky();
    host.game.audio.playMusic('hub');
    const P = host.player;
    P.x = LH.door.x; P.z = LH.door.z + 2.2; P.fx = 0; P.fz = 1;
    host.snapCamera();
  }

  // ---------- frame ----------

  /** A fade to (or from) the night sky color, on game time; mid text optional. */
  fadeTo(to, dur, text, then) {
    if (!this.fadeEl) {
      this.fadeEl = document.createElement('div');
      this.fadeEl.className = 'isl-fade';
      this.host.game.ui.labels.appendChild(this.fadeEl);
    }
    if (text) { this.fadeEl.innerHTML = `<span>${esc(text)}</span>`; speak(text); } else if (to > 0) this.fadeEl.innerHTML = '';
    this.fade = { from: Number(this.fadeEl.style.opacity) || 0, to, dur, t: 0, then, hold: text ? 1.6 : 0 };
  }

  update(dt) {
    // the tilt up to the lamp (and back down) in a scene
    const lk = this.look;
    if (lk) {
      lk.cur.lerp(lk.to, Math.min(1, dt * 3));
      if (lk.back && lk.cur.distanceTo(lk.to) < 0.1) { this.look = null; this.host.camView = null; }
    }
    const f = this.fade;
    if (f) {
      f.t += dt;
      const k = Math.min(1, f.t / f.dur);
      this.fadeEl.style.opacity = String(f.from + (f.to - f.from) * k);
      if (k >= 1 && f.t >= f.dur + f.hold) {
        this.fade = null;
        if (f.to === 0) this.fadeEl.innerHTML = '';
        f.then?.();
      }
    }
    for (const c of this.crumbs) if (c.g.visible) { c.g.userData.glint.rotation.y += dt * 3; c.g.userData.glint.scale.y = 0.6 + Math.sin(this.host.time * 5 + c.i) * 0.4; c.g.userData.glow.scale.setScalar(1 + Math.sin(this.host.time * 3 + c.i) * 0.15); }
    const mumble = this.host.npc('mumble');
    if (mumble?.nightCrystal) mumble.nightCrystal.rotation.y += dt * 1.5;
    this.door.userData.star.rotation.y += dt * (this.done ? 2 : 0.3);
    const F = this.fest;
    if (!F) return;
    F.t += dt;
    if (F.lit) {
      // fireworks over the lighthouse
      F.fw -= dt;
      if (F.fw <= 0) {
        F.fw = 0.5 + Math.random() * 0.5;
        const p = new THREE.Vector3(LH.x - 9 + Math.random() * 18, 15 + Math.random() * 6, LH.z - 3 + Math.random() * 4);
        this.host.confetti.burst(p, 0, { count: 36, speed: 7, up: 1, life: 1.5, gravity: -2.5, colors: [PARTY[Math.floor(Math.random() * PARTY.length)], 0xffffff] });
        this.host.game.audio.play('pop');
      }
    }
    for (const l of F.lanterns) {
      if ((l.delay -= dt) > 0) continue;
      l.ph += dt;
      l.g.position.set(l.x + Math.sin(l.ph * 0.8) * 0.6, l.g.position.y + l.v * dt, l.z + Math.cos(l.ph * 0.6) * 0.4);
    }
  }

  dispose() {
    this.fadeEl?.remove();
  }
}
