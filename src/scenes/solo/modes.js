import * as THREE from 'three';
import { t, tFor, addStrings } from '../../core/i18n.js';
import { StepTeacher } from '../../core/tutorial.js';
import { npcState } from './npcs.js';

// Behaviour modes (the odd-adventure round, part 1): how your bean moves. Normal; Sporty (runs, jumps bigger, a
// little harder to steer: it keeps sliding a moment after you turn); Sneaky (tiptoes: slow and quiet, so shy
// creatures and sleeping guards notice you less, and gulls stay put). [MODE] (R on a keyboard, RB / R1 / R on a
// gamepad: the island's free bumper) switches to the next mode you know; a small badge by the clock shows the mode
// with a symbol and a word.
// Coach Bo teaches Sporty mode (his letter comes first, then you talk to him at the Game Hall); Mumble, who knows all
// about being quiet, teaches Sneaky mode a while later. Each comes with a step-by-step tutorial (core/tutorial.js:
// one thing at a time, the first card asks "Show me how" / "I know how to play", skippable).
// Save: S.odd.modes = { sporty, sneaky } (learned), S.odd.mode (the mode you are in).

export const MODES = ['normal', 'sporty', 'sneaky'];
/** What each mode does: speed and jump multipliers, steer (0: turns at once; else how fast the run follows the stick), noise (1: normal). */
export const MODE_FX = {
  normal: { speed: 1, jump: 1, steer: 0, noise: 1 },
  sporty: { speed: 1.45, jump: 1.14, steer: 5.5, noise: 1.6 },
  sneaky: { speed: 0.5, jump: 0.9, steer: 0, noise: 0.35 },
};
const ICON = { normal: '🙂', sporty: '🏃', sneaky: '🤫' };
const CSS = '.isl-pill.isl-mode small { margin-left: 6px; opacity: .75; font-size: .7em; } .isl-pill.isl-mode.sporty { background: #fff1d6; } .isl-pill.isl-mode.sneaky { background: #e6e2ff; }';

addStrings({
  en: {
    'md.normal': 'Normal', 'md.sporty': 'Sporty', 'md.sneaky': 'Sneaky', 'md.key': '[MODE]',
    'md.t.switch': '{icon} {mode} mode', 'md.title.sporty': 'Sporty mode', 'md.title.sneaky': 'Sneaky mode',
    'md.coach.1': 'There you are! Ready for something new? It is called Sporty mode.',
    'md.coach.2': 'In Sporty mode you run fast and jump bigger. But careful: at full speed you slide a little when you turn!',
    'md.coach.3': 'Press [MODE] to switch. Press it again to go back to Normal. Give it a go!',
    'md.mumble.1': 'shhh... hello. You came!',
    'md.mumble.2': 'This is Sneaky mode. Tiptoe, tiptoe. Slow and quiet. Gulls do not fly away. Shy things are not scared.',
    'md.mumble.3': 'Press [MODE] until it says Sneaky. Then come close to me... very quietly.',
    'md.learned.sporty': 'You learned Sporty mode! [MODE] switches.', 'md.learned.sneaky': 'You learned Sneaky mode! [MODE] switches.',
    'md.tut.sporty.switch': 'Press [MODE] to switch to Sporty mode', 'md.tut.sporty.run': 'Run! Push the stick and keep going',
    'md.tut.sporty.jump': 'Press [A] for a big Sporty jump', 'md.tut.sporty.back': 'Press [MODE] until it says Normal: back to your calm walk',
    'md.tut.sneaky.switch': 'Press [MODE] until it says Sneaky', 'md.tut.sneaky.walk': 'Tiptoe a few steps. So quiet!',
    'md.tut.sneaky.near': 'Tiptoe right up to Mumble', 'md.tut.sneaky.back': 'Press [MODE] until it says Normal again',
    'md.mumble.near': 'eek! ...oh, it is you. You are good at this!',
  },
  no: {
    'md.normal': 'Vanlig', 'md.sporty': 'Sporty', 'md.sneaky': 'Snik', 'md.key': '[MODE]',
    'md.t.switch': '{icon} {mode}-modus', 'md.title.sporty': 'Sportsmodus', 'md.title.sneaky': 'Snikemodus',
    'md.coach.1': 'Der er du! Klar for noe nytt? Det heter sportsmodus.',
    'md.coach.2': 'I sportsmodus løper du fort og hopper lenger. Men pass på: i full fart sklir du litt når du svinger!',
    'md.coach.3': 'Trykk [MODE] for å bytte. Trykk igjen for å gå tilbake til vanlig. Prøv!',
    'md.mumble.1': 'hysj... hei. Du kom!',
    'md.mumble.2': 'Dette er snikemodus. Tå, tå. Sakte og stille. Måkene flyr ikke vekk. Sky ting blir ikke redde.',
    'md.mumble.3': 'Trykk [MODE] til det står Snik. Så kommer du nær meg... veldig stille.',
    'md.learned.sporty': 'Du lærte sportsmodus! [MODE] bytter.', 'md.learned.sneaky': 'Du lærte snikemodus! [MODE] bytter.',
    'md.tut.sporty.switch': 'Trykk [MODE] for å bytte til sportsmodus', 'md.tut.sporty.run': 'Løp! Skyv spaken og fortsett',
    'md.tut.sporty.jump': 'Trykk [A] for et stort sportshopp', 'md.tut.sporty.back': 'Trykk [MODE] til det står Vanlig: tilbake til rolig gange',
    'md.tut.sneaky.switch': 'Trykk [MODE] til det står Snik', 'md.tut.sneaky.walk': 'List deg noen skritt. Så stille!',
    'md.tut.sneaky.near': 'List deg helt bort til Mumle', 'md.tut.sneaky.back': 'Trykk [MODE] til det står Vanlig igjen',
    'md.mumble.near': 'iiik! ...å, det er deg. Du er flink til dette!',
  },
});

export class Modes {
  constructor(host, odd) {
    this.host = host;
    this.odd = odd;
    this.teach = null;
    this.runT = 0;
    this.tipT = 0;
    this.dustT = 0;
    this.crouch = 1;
    if (!document.getElementById('isl-mode-style')) {
      const st = document.createElement('style');
      st.id = 'isl-mode-style';
      st.textContent = CSS;
      document.head.appendChild(st);
    }
  }

  get O() { return this.odd.O; }

  /** The modes you know, in switching order. */
  known() { return MODES.filter((m) => m === 'normal' || this.O.modes[m]); }

  get mode() { return this.O.modes[this.O.mode] || this.O.mode === 'normal' ? this.O.mode : 'normal'; }

  /** What the current mode does (speed, jump, steer, noise). */
  fx() { return MODE_FX[this.mode]; }

  /** How much noise you make (1 normal, less when sneaky): shy creatures and sleepy guards use it. */
  get noise() { return this.fx().noise; }

  /** The badge by the clock (only once you know a mode beyond Normal): { icon, word, key, mode }. */
  badge() {
    if (this.known().length < 2) return null;
    const m = this.mode;
    return { icon: ICON[m], word: t(`md.${m}`), mode: m };
  }

  /** [MODE]: the next mode you know. */
  cycle() {
    const list = this.known();
    if (list.length < 2) return false;
    const i = list.indexOf(this.mode);
    this.set(list[(i + 1) % list.length]);
    return true;
  }

  set(m) {
    const host = this.host, P = host.player;
    this.O.mode = m;
    host.game.audio.play(m === 'sporty' ? 'go' : m === 'sneaky' ? 'bubble' : 'select');
    host.game.ui.toast(t('md.t.switch', { icon: ICON[m], mode: t(`md.${m}`) }), 1400);
    if (P) { P.ch.squash(m === 'sneaky' ? 0.8 : 1.2); if (P.vx === undefined) { P.vx = 0; P.vz = 0; } }
    this.teach?.did(P?.p, `mode:${m}`);
    host.markDirty();
  }

  // ---------- learning them ----------

  /** Coach Bo (Sporty) and Mumble (Sneaky) teach their mode once its letter came. */
  talk(n, done) {
    const O = this.O, host = this.host;
    const lesson = n.id === 'coach' && O.got.sporty !== undefined && !O.modes.sporty ? 'sporty'
      : n.id === 'mumble' && O.got.sneaky !== undefined && !O.modes.sneaky && npcState(host.save, 'mumble').met ? 'sneaky' : null;
    if (!lesson) return false;
    const who = n.id, k = lesson === 'sporty' ? 'coach' : 'mumble';
    n.talking = true;
    host.say([1, 2, 3].map((i) => ({ who, key: `md.${k}.${i}`, fx: i === 1 ? () => { n.hop = 1; } : null })), () => {
      done?.();
      this.learn(lesson, n);
    });
    return true;
  }

  hasNews(id) {
    const O = this.O;
    return (id === 'coach' && O.got.sporty !== undefined && !O.modes.sporty) || (id === 'mumble' && O.got.sneaky !== undefined && !O.modes.sneaky);
  }

  /** A mode learned: the badge appears and the tutorial asks (the first card), then teaches one thing at a time. */
  async learn(m, teacher = null) {
    const host = this.host, O = this.O;
    O.modes[m] = true;
    host.game.ui.toast(t(`md.learned.${m}`), 3000);
    host.game.audio.play('fanfare');
    host.markDirty();
    const P = host.player;
    if (!P) return;
    const id = `isl.${m}`;
    const ans = await host.game.askTutorial({ id, title: t(`md.title.${m}`), players: [P.p] });
    if (host.game.current !== host || ans !== 'show') return;
    this.mumble = teacher && m === 'sneaky' ? teacher : null;
    this.teach = new StepTeacher(host, {
      id, players: [P.p],
      steps: () => (m === 'sporty'
        ? [{ key: 'md.tut.sporty.switch', on: 'mode:sporty' }, { key: 'md.tut.sporty.run', on: 'run' }, { key: 'md.tut.sporty.jump', on: 'bigjump' }, { key: 'md.tut.sporty.back', on: 'mode:normal' }]
        : [{ key: 'md.tut.sneaky.switch', on: 'mode:sneaky' }, { key: 'md.tut.sneaky.walk', on: 'tiptoe' }, { key: 'md.tut.sneaky.near', on: 'near' }, { key: 'md.tut.sneaky.back', on: 'mode:normal' }]),
      where: () => (host.player ? new THREE.Vector3(host.player.x, host.player.y + 2.2, host.player.z) : null),
      onDone: () => { this.teach = null; },
    });
  }

  // ---------- every frame ----------

  /** You jumped (island.jump): a big jump in Sporty mode. */
  onJump() { if (this.mode === 'sporty') this.teach?.did(this.host.player?.p, 'bigjump'); }

  update(dt) {
    const host = this.host, P = host.player;
    if (!P) return;
    const m = this.mode, walking = host.mode === 'walk';
    P.sneaky = m === 'sneaky';
    // Sneaky: the bean crouches a little and tiptoes; Sporty: a little dust while running
    this.crouch += ((m === 'sneaky' ? 0.86 : 1) - this.crouch) * Math.min(1, dt * 8);
    P.ch.group.scale.set(1, this.crouch, 1);
    const moving = walking && (P.moving || 0) > 0.5 && !P.air;
    this.runT = m === 'sporty' && moving ? this.runT + dt : 0;
    this.tipT = m === 'sneaky' && moving ? this.tipT + dt : 0;
    if (m === 'sporty' && moving && (this.dustT -= dt) <= 0) {
      this.dustT = 0.16;
      host.puffs?.burst(new THREE.Vector3(P.x - P.fx * 0.3, P.y + 0.1, P.z - P.fz * 0.3), 0xf3ead2, { count: 2, speed: 1.2, size: 0.18, life: 0.35, up: 0.6 });
    }
    if (this.teach) {
      if (this.runT > 1.4) this.teach.did(P.p, 'run');
      if (this.tipT > 1.6) this.teach.did(P.p, 'tiptoe');
      const mb = this.mumble;
      if (m === 'sneaky' && mb && Math.hypot(P.x - mb.x, P.z - mb.z) < 2.2 && this.teach.did(P.p, 'near')) host.game.ui.toast(t('md.mumble.near'), 2200);
      this.teach.hidden = !walking;
      this.teach.update(walking ? dt : 0);
    }
  }

  /** The pause menu's "Skip the tutorial" and leaving the island. */
  skipTutorial() { this.teach?.skip(); this.teach = null; }

  dispose() { this.teach?.skip?.(); }
}

export { tFor };
