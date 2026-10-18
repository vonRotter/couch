import { t, addStrings } from './i18n.js';
import { esc } from './ui.js';

addStrings({
  en: {
    'vote.hint': 'Stick left/right to choose · jump to vote',
    'vote.random': 'Random',
    'vote.picked': 'Most votes: {x}',
    'vote.pickedRandom': 'Random pick: {x}',
    'vote.tie': 'Tie! Random pick: {x}',
    'vote.laps': 'How many laps?', 'vote.lapsN': '{n} laps', 'vote.lap1': '1 lap',
    'vote.length': 'How long a match?', 'vote.short': 'Short', 'vote.normal': 'Normal', 'vote.long': 'Long',
    'vote.rounds': 'How many rounds?', 'vote.roundsN': '{n} rounds',
    'vote.holes': 'How many holes?', 'vote.holesN': '{n} holes',
  },
  no: {
    'vote.hint': 'Pinnen venstre/høyre for å velge · hopp for å stemme',
    'vote.random': 'Tilfeldig',
    'vote.picked': 'Flest stemmer: {x}',
    'vote.pickedRandom': 'Tilfeldig valg: {x}',
    'vote.tie': 'Likt! Tilfeldig valg: {x}',
    'vote.laps': 'Hvor mange runder?', 'vote.lapsN': '{n} runder', 'vote.lap1': '1 runde',
    'vote.length': 'Hvor lang kamp?', 'vote.short': 'Kort', 'vote.normal': 'Vanlig', 'vote.long': 'Lang',
    'vote.rounds': 'Hvor mange runder?', 'vote.roundsN': '{n} runder',
    'vote.holes': 'Hvor mange hull?', 'vote.holesN': '{n} hull',
  },
});

/** Ready-made option sets. Labels are functions so they follow the language switch. */
export const VOTES = {
  laps: (def = 3) => ({
    question: () => t('vote.laps'), def,
    options: [1, 2, 3, 5].map((n) => ({ value: n, label: () => (n === 1 ? t('vote.lap1') : t('vote.lapsN', { n })) })),
  }),
  length: (def = 150) => ({
    question: () => t('vote.length'), def,
    options: [
      { value: 90, label: () => `${t('vote.short')} · 1:30` },
      { value: 150, label: () => `${t('vote.normal')} · 2:30` },
      { value: 240, label: () => `${t('vote.long')} · 4:00` },
    ],
  }),
  rounds: (def = 5) => ({
    question: () => t('vote.rounds'), def,
    options: [3, 5, 7].map((n) => ({ value: n, label: () => t('vote.roundsN', { n }) })),
  }),
  holes: (def = 6) => ({
    question: () => t('vote.holes'), def,
    options: [3, 6].map((n) => ({ value: n, label: () => t('vote.holesN', { n }) })),
  }),
};

/**
 * Pre-game vote. Every player moves between the options with the stick and taps jump to lock
 * in. The option with the most votes wins; a tie (or a winning "Random") picks at random.
 * Same shape as TeamPicker (update / render) so a scene can hold either in `this.picker`.
 */
export class VotePicker {
  constructor(scene, { title, vote, onDone }) {
    this.scene = scene;
    this.title = title;
    this.question = vote.question;
    this.options = [...vote.options, { value: 'random', label: () => t('vote.random') }];
    this.onDone = onDone;
    const start = Math.max(0, this.options.findIndex((o) => o.value === vote.def));
    this.choice = new Map(scene.players.map((p) => [p, { i: start, locked: false }]));
    this.time = 0;
    this.el = scene.game.ui.panel('', 'panel picker');
    this.render();
  }

  render() {
    const cols = this.options.map((o, i) => {
      const chips = this.scene.players.filter((p) => this.choice.get(p).i === i).map((p) => {
        const c = this.choice.get(p);
        return `<div class="ball-pick ${c.locked ? 'done' : ''}" style="--c:${p.css}">${esc(p.name)}${c.locked ? ' ✓' : ''}</div>`;
      }).join('');
      return `<div class="vote-opt"><div class="vote-label">${esc(o.label())}</div>${chips}</div>`;
    }).join('');
    this.el.innerHTML = `<div class="results-title">${esc(this.title())}</div>
      <div class="results-sub">${esc(this.question())}</div>
      <div class="vote-row">${cols}</div>
      <div class="results-footer">${t('vote.hint')}</div>`;
  }

  update(dt = 1 / 60) {
    const { scene } = this;
    if (this.done) return;
    this.time += dt;
    let changed = false;
    for (const p of scene.players) {
      const d = scene.input(p);
      if (!d) continue;
      const c = this.choice.get(p);
      if (!c.locked && d.stepX) {
        c.i = Math.min(this.options.length - 1, Math.max(0, c.i + d.stepX));
        scene.game.audio.play('select');
        changed = true;
      }
      if (d.aPressed) {
        c.locked = !c.locked;
        scene.game.audio.play(c.locked ? 'join' : 'select');
        changed = true;
      }
    }
    if (changed) this.render();
    const all = [...this.choice.values()].every((c) => c.locked);
    if (all || this.time > 25) this.finish();
  }

  finish() {
    this.done = true;
    this.el.remove();
    const counts = this.options.map(() => 0);
    for (const c of this.choice.values()) counts[c.i]++;
    const best = Math.max(...counts);
    const top = this.options.filter((_, i) => counts[i] === best);
    const real = this.options.filter((o) => o.value !== 'random');
    let pick = top[Math.floor(Math.random() * top.length)];
    let how = top.length > 1 ? 'vote.tie' : 'vote.picked';
    if (pick.value === 'random') {
      pick = real[Math.floor(Math.random() * real.length)];
      how = 'vote.pickedRandom';
    }
    this.scene.game.audio.play('star');
    this.scene.game.ui.toast(t(how, { x: pick.label() }), 2200);
    this.onDone(pick.value);
  }
}

/**
 * Team games: vote on match length (unless a retry already knows it), then continue with `next`
 * (usually the team picker). Sets scene.matchTime and scene.timeLeft.
 */
export function voteLength(scene, opts, title, next) {
  const apply = (v) => { scene.matchTime = v; scene.timeLeft = v; };
  if (opts.length) { apply(opts.length); next(); return; }
  scene.picker = new VotePicker(scene, {
    title, vote: VOTES.length(150),
    onDone: (v) => { scene.picker = null; apply(v); next(); },
  });
}
