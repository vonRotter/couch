import * as THREE from 'three';
import { MiniGame } from '../core/minigame.js';
import { addLights, skyTexture } from '../core/world.js';
import { COLORS, toon } from '../core/palette.js';
import { t } from '../core/i18n.js';
import { esc } from '../core/ui.js';
import { shuffle } from '../core/edu.js';
import { CountRound } from './party/count.js';
import { StatueRound } from './party/statue.js';
import { CushionRound } from './party/cushions.js';
import { FruitRound } from './party/fruit.js';
import { DanceRound } from './party/dance.js';
import { TugRound } from './party/tug.js';
import { TowerRound } from './party/tower.js';

// Party Mix: five short random rounds in a row with a running scoreboard.
export const ROUNDS = [CountRound, StatueRound, CushionRound, FruitRound, DanceRound, TugRound, TowerRound];
const PER_MIX = 5;
const PLACE_POINTS = [4, 3, 2, 1, 1, 1];
const HOWTO_MAX = 20;
const SCORES_MAX = 9;

export class PartyScene extends MiniGame {
  constructor(game, opts) {
    super(game, opts);
    this.camera.fov = 42;
    this.camera.updateProjectionMatrix();
    this.scene.background = skyTexture('#7fd3ff', '#fff1d6');
    addLights(this.scene, { size: 26, dir: new THREE.Vector3(-0.4, 1, 0.6) });
    const byKey = Object.fromEntries(ROUNDS.map((R) => [R.key, R]));
    this.order = (opts.rounds || shuffle(ROUNDS.map((R) => R.key)).slice(0, PER_MIX)).map((k) => byKey[k]).filter(Boolean);
    this.totals = new Map(this.players.map((p) => [p, 0]));
    this.wins = new Map(this.players.map((p) => [p, 0]));
    this.index = -1;
    this.round = null;
    game.audio.playMusic('party');
    this.nextRound();
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
    this.game.ui.setTop('');
    this.showHowTo();
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
    this.panelEl.innerHTML = `<div class="party-round">${t('party.round', { n: this.index + 1, total: this.order.length })}</div>
      <div class="results-title">${esc(this.round.title)}</div>
      <div class="party-hint">${esc(this.round.hint)}</div>
      <div class="party-ready">${chips}</div>
      <div class="results-footer blink">${t('party.ready')}</div>`;
  }

  updateHowTo(dt) {
    this.stateT += dt;
    let changed = false;
    for (const p of this.players) {
      const d = this.input(p);
      if (d?.aPressed && !this.ready.get(p)) { this.ready.set(p, true); this.game.audio.play('join'); changed = true; }
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

  // ---------- scoring ----------

  roundOver() {
    const r = this.round;
    this.state = 'scores';
    this.stateT = 0;
    r.hideLabels();
    const vals = this.players.map((p) => r.score(p));
    const best = Math.max(...vals);
    this.lastPoints = new Map();
    this.players.forEach((p, i) => {
      const rank = vals.filter((v) => v > vals[i]).length;
      const pts = PLACE_POINTS[Math.min(rank, PLACE_POINTS.length - 1)];
      this.lastPoints.set(p, pts);
      this.totals.set(p, this.totals.get(p) + pts);
      if (vals[i] === best) this.wins.set(p, this.wins.get(p) + 1);
    });
    this.game.audio.play('fanfare');
    this.game.ui.setTop('');
    this.renderScores();
  }

  renderScores() {
    const r = this.round;
    const vals = new Map(this.players.map((p) => [p, r.score(p)]));
    const best = Math.max(...vals.values());
    const ranked = [...this.players].sort((a, b) => this.totals.get(b) - this.totals.get(a));
    const last = this.index + 1 >= this.order.length;
    this.panelEl?.remove();
    this.panelEl = this.game.ui.results({
      title: r.title,
      subtitle: `${t('party.round', { n: this.index + 1, total: this.order.length })} · ${t('party.total')}`,
      rows: ranked.map((p) => ({
        css: p.css, name: p.name,
        value: String(this.totals.get(p)),
        detail: `+${this.lastPoints.get(p)} · ${r.detail(p)}`,
        crown: vals.get(p) === best,
      })),
      footer: `<span class="blink">${last ? t('party.final') : t('party.next')}</span>`,
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
    const ranked = [...this.players].sort((a, b) => this.totals.get(b) - this.totals.get(a));
    const top = this.totals.get(ranked[0]);
    const leaders = ranked.filter((p) => this.totals.get(p) === top);
    this.confettiOrigin = new THREE.Vector3(0, 3, 0);
    const ground = new THREE.Mesh(new THREE.CircleGeometry(60, 40), toon(COLORS.grass));
    ground.rotation.x = -Math.PI / 2;
    this.scene.add(ground);
    this.camera.position.set(0, 4, 14);
    this.camera.lookAt(0, 2, 0);
    this.finish({
      title: leaders.length > 1 && this.players.length > 1 ? t('tie') : t('win', { name: leaders[0].name }),
      subtitle: t('party.sub', { n: this.order.length }),
      rows: ranked.map((p) => ({
        css: p.css, name: p.name, value: String(this.totals.get(p)),
        detail: `${t('party.points', { n: this.totals.get(p) })} · ${t('party.wins', { n: this.wins.get(p) })}`, crown: this.totals.get(p) === top,
      })),
      stars: 3,
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
    if (this.updateResults(dt)) return;
    const r = this.round;
    if (!r) return;
    const playing = this.state === 'play';
    r.update(dt, playing);
    if (this.state === 'howto') this.updateHowTo(dt);
    else if (this.state === 'scores') this.updateScores(dt);
    else if (playing && r.done) this.roundOver();
    if (this.state === 'play' || this.state === 'countdown') {
      this.game.ui.setTop(`<div class="pill">${t('party.round', { n: this.index + 1, total: this.order.length })}</div>${r.hud()}`);
    }
    this.game.ui.bar(this.players, (p) => `${this.totals.get(p)}`);
  }
}
