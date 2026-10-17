import * as THREE from 'three';
import { MiniGame } from '../core/minigame.js';
import { addLights, skyTexture } from '../core/world.js';
import { LEVELS, fontsReady, chooseLevels } from '../core/edu.js';
import { t, addStrings } from '../core/i18n.js';
import { esc } from '../core/ui.js';
import { KlokkaRound } from './learn/klokka.js';
import { PengerRound } from './learn/penger.js';
import { RimordRound } from './learn/rimord.js';

// Læringsmiks: pick a level, then three short learning rounds in a row
// (clock, money, rhymes) and a shared results screen. Norwegian only.

addStrings({
  en: {
    'game.learnmix': 'Læringsmiks',
    'learnmix.round': 'Runde {n} av {total}',
    'learnmix.ready': 'alle trykker hopp når de er klare',
    'learnmix.next': 'trykk hopp for neste runde',
    'learnmix.final': 'trykk hopp for å se hvordan det gikk',
    'learnmix.roundSub': 'Runde {n} av {total} · riktige svar',
    'learnmix.title': 'Supert jobbet!',
    'learnmix.sub': 'Dere fikk {n} riktige til sammen i tre runder',
    'learnmix.right': 'riktige',
    'learnmix.badge': 'LÆRING',
    'learnmix.continue': 'trykk hopp for å fortsette',
    'learnmix.short.klokka': 'Klokka',
    'learnmix.short.penger': 'Penger',
    'learnmix.short.rimord': 'Rim',
  },
  no: {
    'game.learnmix': 'Læringsmiks',
    'learnmix.round': 'Runde {n} av {total}',
    'learnmix.ready': 'alle trykker hopp når de er klare',
    'learnmix.next': 'trykk hopp for neste runde',
    'learnmix.final': 'trykk hopp for å se hvordan det gikk',
    'learnmix.roundSub': 'Runde {n} av {total} · riktige svar',
    'learnmix.title': 'Supert jobbet!',
    'learnmix.sub': 'Dere fikk {n} riktige til sammen i tre runder',
    'learnmix.right': 'riktige',
    'learnmix.badge': 'LÆRING',
    'learnmix.continue': 'trykk hopp for å fortsette',
    'learnmix.short.klokka': 'Klokka',
    'learnmix.short.penger': 'Penger',
    'learnmix.short.rimord': 'Rim',
  },
});

export const LEARN_ROUNDS = [KlokkaRound, PengerRound, RimordRound];
const HOWTO_MAX = 25;
const SCORES_MAX = 12;

export class LearnMixScene extends MiniGame {
  constructor(game, opts) {
    super(game, opts);
    this.camera.fov = 38;
    this.camera.updateProjectionMatrix();
    this.scene.background = skyTexture('#9fe0ff', '#fff6dc');
    addLights(this.scene, { size: 20, dir: new THREE.Vector3(-0.4, 1, 0.5) });
    const byKey = Object.fromEntries(LEARN_ROUNDS.map((R) => [R.key, R]));
    // opts.rounds lets tests (or a future menu) run a subset in a given order.
    this.order = (opts.rounds || LEARN_ROUNDS.map((R) => R.key)).map((k) => byKey[k]).filter(Boolean);
    this.scores = new Map(this.players.map((p) => [p, []]));
    this.index = 0;
    this.round = null;
    game.audio.playMusic('hub');
    this.state = 'pick';
    fontsReady().then(() => {
      if (this.game.current !== this) return null;
      // Build the first field once the font is ready (its boards draw text on canvases).
      this.round = new this.order[0](this);
      this.round.frame();
      return chooseLevels(this, t('game.learnmix'));
    }).then(() => {
      if (this.game.current !== this) return;
      this.round.prepare();
      this.showHowTo();
    });
  }

  retryOptions() {
    return { key: this.key };
  }

  nextRound() {
    this.panelEl?.remove();
    this.panelEl = null;
    this.round?.dispose();
    this.round = null;
    this.index++;
    if (this.index >= this.order.length) { this.end(); return; }
    this.round = new this.order[this.index](this);
    this.round.frame();
    this.round.prepare();
    this.game.ui.setTop('');
    this.showHowTo();
  }

  roundLabel() {
    return t('learnmix.round', { n: this.index + 1, total: this.order.length });
  }

  // ---------- how to play ----------

  showHowTo() {
    this.state = 'howto';
    this.stateT = 0;
    this.ready = new Map(this.players.map((p) => [p, false]));
    this.panelEl = this.game.ui.panel('', 'panel picker');
    this.renderHowTo();
  }

  renderHowTo() {
    const chips = this.players.map((p) => {
      const ok = this.ready.get(p);
      return `<div class="ball-pick ${ok ? 'done' : ''}" style="--c:${p.css}">${esc(p.name)}${ok ? ' ✓' : ''}</div>`;
    }).join('');
    this.panelEl.innerHTML = `<div class="edu-badge">${t('learnmix.badge')}</div>
      <div class="party-round">${esc(this.roundLabel())}</div>
      <div class="results-title">${esc(this.round.title)}</div>
      <div class="party-hint">${esc(this.round.hint)}</div>
      ${this.round.howto?.() || ''}
      <div class="party-ready">${chips}</div>
      <div class="results-footer blink">${t('learnmix.ready')}</div>`;
  }

  updateHowTo(dt) {
    this.stateT += dt;
    let changed = false;
    for (const p of this.players) {
      if (this.input(p)?.aPressed && !this.ready.get(p)) { this.ready.set(p, true); this.game.audio.play('join'); changed = true; }
    }
    if (changed) this.renderHowTo();
    if ([...this.ready.values()].every(Boolean) || this.stateT > HOWTO_MAX) {
      this.panelEl.remove();
      this.panelEl = null;
      this.state = 'countdown';
      const round = this.round;
      this.game.ui.countdown(this.game.audio).then(() => {
        if (this.game.current !== this || this.round !== round || this.state !== 'countdown') return;
        this.state = 'play';
        round.start();
      });
    }
  }

  // ---------- between rounds ----------

  roundOver() {
    const r = this.round;
    this.state = 'scores';
    this.stateT = 0;
    r.hideLabels();
    for (const p of this.players) this.scores.get(p).push(r.score(p));
    this.game.audio.play('fanfare');
    this.game.ui.setTop('');
    this.renderScores();
  }

  renderScores() {
    const r = this.round;
    const best = Math.max(...this.players.map((p) => r.score(p)));
    const ranked = [...this.players].sort((a, b) => r.score(b) - r.score(a));
    const last = this.index + 1 >= this.order.length;
    this.panelEl?.remove();
    this.panelEl = this.game.ui.results({
      title: r.title,
      subtitle: t('learnmix.roundSub', { n: this.index + 1, total: this.order.length }),
      rows: ranked.map((p) => ({
        css: p.css, name: p.name, value: String(r.score(p)),
        detail: `${r.unit} · ${LEVELS[p.eduLevel ?? 0].name}`, crown: best > 0 && r.score(p) === best,
      })),
      footer: `<span class="blink">${last ? t('learnmix.final') : t('learnmix.next')}</span>`,
    });
  }

  updateScores(dt) {
    this.stateT += dt;
    const any = this.players.some((p) => this.input(p)?.aPressed);
    if ((this.stateT > 1.5 && any) || this.stateT > SCORES_MAX) {
      this.state = 'wipe';
      this.game.ui.wipe(() => this.nextRound());
    }
  }

  end() {
    // Keep the last field as a backdrop for the results.
    const last = this.order[this.order.length - 1];
    this.round = new last(this);
    this.round.frame();
    this.round.hideLabels();
    const total = (p) => this.scores.get(p).reduce((s, v) => s + v, 0);
    const ranked = [...this.players].sort((a, b) => total(b) - total(a));
    const top = total(ranked[0]);
    const sum = this.players.reduce((s, p) => s + total(p), 0);
    this.finish({
      title: t('learnmix.title'),
      subtitle: t('learnmix.sub', { n: sum }),
      rows: ranked.map((p) => ({
        css: p.css, name: p.name, value: String(total(p)),
        detail: `${t('learnmix.right')}: ${this.order.map((R, i) => `${t(`learnmix.short.${R.key}`)} ${this.scores.get(p)[i] ?? 0}`).join(' · ')}`,
        crown: top > 0 && total(p) === top,
      })),
      stars: 3,
      action: t('learnmix.continue'),
    });
  }

  onLanguage() {
    if (this.state === 'howto') this.renderHowTo();
    if (this.state === 'scores') this.renderScores();
  }

  resize(w, h) {
    super.resize(w, h);
    this.round?.frame();
  }

  update(dt) {
    const r = this.round;
    if (this.state === 'pick') {
      this.pickLevels?.();
      r?.update(dt, false);
      return;
    }
    if (this.updateResults(dt)) { r?.update(dt, false); return; }
    if (!r) return;
    const playing = this.state === 'play';
    r.update(dt, playing);
    if (this.state === 'howto') this.updateHowTo(dt);
    else if (this.state === 'scores') this.updateScores(dt);
    else if (playing && r.done) this.roundOver();
    if (this.state === 'play' || this.state === 'countdown') {
      this.game.ui.setTop(`<div class="pill">${esc(this.roundLabel())}</div>${r.hud()}`);
    }
  }
}
