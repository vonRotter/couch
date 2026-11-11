import { t } from './i18n.js';
import { say } from './voice.js';
import { esc } from './ui.js';
import { symHtml, TEAM_SYMBOLS } from './palette.js';

export const TEAM_COLORS = [0xffc93c, 0x4cc9f0];
export const TEAM_CSS = ['#e0a100', '#1aa7d8'];
export { TEAM_SYMBOLS }; // Sun / Sea symbols (core/palette.js), so colour is never the only cue

/**
 * Two-team picker shared by the team games. Each player pushes the stick
 * left or right to pick a side and taps jump when ready.
 * `ents` need { p, team, name, css }; `setTeam(e, team)` recolors an entity.
 */
export class TeamPicker {
  constructor(scene, { title, ents, setTeam, onChange, onDone }) {
    this.scene = scene;
    this.title = title;
    this.ents = ents;
    this.setTeam = setTeam;
    this.onChange = onChange;
    this.onDone = onDone;
    this.ready = new Map(ents.map((e) => [e, false]));
    this.el = scene.game.ui.panel('', 'panel picker');
    this.render();
    say(`${this.title()}. ${t('ball.teams')}`, 'narrator'); // read aloud (accessibility audit)
  }

  render() {
    const col = (team) => this.ents.filter((e) => e.team === team).map((e) => {
      const ok = this.ready.get(e);
      return `<div class="ball-pick ${ok ? 'done' : ''}" style="--c:${e.css}">${symHtml(e.p || e)}${esc(e.name)}${ok ? ' ✓' : ''}</div>`;
    }).join('');
    const sizes = [0, 1].map((tm) => this.ents.filter((e) => e.team === tm).length);
    const helper = (team) => (sizes[team] < sizes[1 - team] || (sizes[team] === 0 && this.ents.length === 1) ? `<div class="ball-helper">${t('ball.helper')}</div>` : '');
    this.el.innerHTML = `<div class="results-title">${this.title()}</div>
      <div class="results-sub">${t('ball.teams')}</div>
      <div class="ball-teams">
        <div class="ball-team" style="--c:${TEAM_CSS[0]}"><div class="ball-team-name"><span class="psym">${TEAM_SYMBOLS[0]}</span>${t('ball.team.0')}</div>${col(0)}${helper(0)}</div>
        <div class="ball-team" style="--c:${TEAM_CSS[1]}"><div class="ball-team-name"><span class="psym">${TEAM_SYMBOLS[1]}</span>${t('ball.team.1')}</div>${col(1)}${helper(1)}</div>
      </div>`;
  }

  update() {
    const { scene } = this;
    let changed = false;
    for (const e of this.ents) {
      const d = scene.input(e.p);
      if (!d) continue;
      const ok = this.ready.get(e);
      if (!ok && d.stepX) {
        const team = d.stepX < 0 ? 0 : 1;
        if (team !== e.team) { this.setTeam(e, team); scene.game.audio.play('select'); changed = true; }
      }
      if (d.aPressed) { this.ready.set(e, !ok); scene.game.audio.play(ok ? 'select' : 'join'); changed = true; }
    }
    if (changed) { this.render(); this.onChange?.(); }
    if ([...this.ready.values()].every(Boolean)) {
      this.el.remove();
      this.onDone();
    }
  }
}

/** How many helper bots each team needs so the sides feel even (max 2). */
export function helpersNeeded(ents) {
  const sizes = [0, 1].map((tm) => ents.filter((e) => e.team === tm).length);
  return [0, 1].map((team) => {
    if (ents.length === 1 && sizes[team] === 0) return 1;
    return Math.max(0, Math.min(2, sizes[1 - team] - sizes[team]));
  });
}
