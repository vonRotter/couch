import { t, getLang, addStrings } from './i18n.js';
import { esc } from './ui.js';
import { PLAYER_COLORS } from './palette.js';
import { listProfiles, soloSaveKey } from './profiles.js';
import { profileSettings } from './assist.js';
import { menuDevices } from './assistmenu.js';
import {
  GENRES, SKILLS, TRIALS, GAMES, MEDALS, LEVEL_NAMES, loadPassport, skillLevel, lastDays, flushPlayTime, gameName,
} from './passport.js';

// The parent page (development step 3): for grown-ups, behind a hold so children do not wander in. In a menu
// (the start screen, the island's menu or a game's pause menu) hold View + Start on a gamepad, or H on a
// keyboard, for 3 seconds (main.js shows a small ring while it fills). One page per profile (the stick or the
// arrow keys switch profiles): time played per day for the last 14 days, the genres and skills practised, the
// games played, Coach's trials, "Help me play" settings that are on, the help offers taken and the parts that
// were skipped. Everything is read from this browser's storage; nothing leaves the device. Not read aloud
// (it is for grown-ups). [B] / Esc / H closes it.

export const HOLD_SECONDS = 3;

addStrings({
  en: {
    'pg.title': 'For parents', 'pg.private': 'Everything here is stored in this browser only. Nothing leaves the device.',
    'pg.hint': 'Stick or ←/→: next child · Esc, H or a gamepad’s B: close', 'pg.hold': 'Keep holding for the parent page…',
    'pg.none': 'No profiles yet.', 'pg.time': 'Time played (last 14 days)', 'pg.total': '{t} in 14 days · today {d}',
    'pg.min': '{n} min', 'pg.h': '{h} h {m} min', 'pg.genres': 'Kinds of games tried ({n} of {m})', 'pg.noGenres': 'none yet',
    'pg.skills': 'Skills practised', 'pg.games': 'Most played', 'pg.noGames': 'nothing yet', 'pg.times': '{n}×',
    'pg.trials': 'Coach’s trials done: {n} of {m}', 'pg.assist': 'Help me play: on now', 'pg.assistNone': 'nothing (all default)',
    'pg.offers': 'Help offers taken', 'pg.offersNone': 'none', 'pg.skips': 'Skipped parts', 'pg.skipsNone': 'none',
    'pg.offer.timing': 'forgiving timing', 'pg.offer.aim': 'more aim help', 'pg.offer.speed': 'slower game', 'pg.offer.skip': 'skip a part',
    'pg.lv': 'level {n}',
    'pg.tutOff': 'Tutorials and tips: off', 'pg.tutSkipped': 'Tutorials skipped',
  },
  no: {
    'pg.title': 'For foreldre', 'pg.private': 'Alt her lagres bare i denne nettleseren. Ingenting forlater enheten.',
    'pg.hint': 'Pinne eller ←/→: neste barn · Esc, H eller B på en håndkontroll: lukk', 'pg.hold': 'Hold inne for foreldresiden…',
    'pg.none': 'Ingen profiler ennå.', 'pg.time': 'Spilletid (siste 14 dager)', 'pg.total': '{t} på 14 dager · i dag {d}',
    'pg.min': '{n} min', 'pg.h': '{h} t {m} min', 'pg.genres': 'Slags spill prøvd ({n} av {m})', 'pg.noGenres': 'ingen ennå',
    'pg.skills': 'Ferdigheter øvd på', 'pg.games': 'Mest spilt', 'pg.noGames': 'ingenting ennå', 'pg.times': '{n}×',
    'pg.trials': 'Trenerens prøver klart: {n} av {m}', 'pg.assist': 'Hjelp meg å spille: på nå', 'pg.assistNone': 'ingenting (alt standard)',
    'pg.offers': 'Hjelp som ble tatt imot', 'pg.offersNone': 'ingen', 'pg.skips': 'Deler som ble hoppet over', 'pg.skipsNone': 'ingen',
    'pg.offer.timing': 'snill timing', 'pg.offer.aim': 'mer siktehjelp', 'pg.offer.speed': 'saktere spill', 'pg.offer.skip': 'hoppe over en del',
    'pg.lv': 'brett {n}',
    'pg.tutOff': 'Opplæring og tips: av', 'pg.tutSkipped': 'Opplæring hoppet over',
  },
});

const CSS = `
.panel.parent-panel { position: fixed; inset: 0; margin: auto; height: fit-content; z-index: 80; animation: none; opacity: 1; transform: none; width: min(980px, 94vw); max-height: 94vh; overflow: hidden; text-align: left; padding: 14px 24px; background: #fffdf8; border-radius: 26px; }
.panel.parent-panel .results-footer { text-align: center; font-size: clamp(13px, 1.2vw, 17px); }
.panel.parent-panel .results-title { font-size: clamp(22px, 2.6vw, 36px); }
.pg-head { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.pg-head .results-title { margin: 0; }
.pg-kids { display: flex; gap: 6px; flex-wrap: wrap; margin-left: auto; }
.pg-kids span { padding: 2px 12px; border-radius: 999px; background: rgba(43,35,64,.08); font-weight: 700; border-bottom: 3px solid var(--c); }
.pg-kids span.on { background: var(--c); color: #fff; }
.pg-grid { display: grid; grid-template-columns: 1.15fr 1fr; gap: 8px 22px; margin-top: 8px; font-size: clamp(12px, 1.15vw, 16px); }
.pg-grid h3 { margin: 4px 0 3px; font-size: 1.05em; color: #5a4d7a; }
.pg-bars { display: grid; grid-template-columns: repeat(14, 1fr); gap: 3px; align-items: end; height: 110px; padding-top: 14px; }
.pg-bars div { display: flex; flex-direction: column; align-items: center; justify-content: flex-end; height: 100%; font-size: .72em; }
.pg-bars i { display: block; width: 100%; background: var(--c); border-radius: 4px 4px 0 0; min-height: 2px; }
.pg-bars b { font-weight: 600; opacity: .7; white-space: nowrap; }
.pg-bars small { opacity: .6; }
.pg-chips { display: flex; flex-wrap: wrap; gap: 3px 5px; }
.pg-chips span { background: rgba(43,35,64,.07); border-radius: 999px; padding: 0 8px; white-space: nowrap; }
.pg-list { margin: 0; padding-left: 1.1em; }
.pg-note { margin-top: 8px; opacity: .7; font-size: .9em; text-align: center; }
`;
function injectStyle() {
  if (document.getElementById('pg-style')) return;
  const el = document.createElement('style');
  el.id = 'pg-style';
  el.textContent = CSS;
  document.head.appendChild(el);
}

const fmtTime = (s) => {
  const m = Math.round(s / 60);
  return m < 60 ? t('pg.min', { n: m }) : t('pg.h', { h: Math.floor(m / 60), m: m % 60 });
};
const locale = () => (getLang() === 'no' ? 'nb-NO' : 'en-GB');

/** The skipped parts in a profile's solo save: { game: [part, ...] }. */
function skippedOf(id) {
  try { return JSON.parse(localStorage.getItem(soloSaveKey(id)))?.progress?.skipped || {}; } catch { return {}; }
}

/** "Help me play" settings that are not the default, as words. */
function assistOn(s) {
  const out = [];
  if (s.speed !== 1) out.push(`${t('assist.speed')} ${Math.round(s.speed * 100)} %`);
  if (s.timing) out.push(t('assist.timing'));
  if (s.aimChosen && s.aim > 0) out.push(`${t('assist.aim')} ${s.aim}`);
  if (s.toggle) out.push(t('assist.toggle'));
  if (s.text > 0) out.push(`${t('assist.text')}: ${t(`assist.text.${s.text}`)}`);
  if (s.contrast) out.push(t('assist.contrast'));
  if (s.calm) out.push(t('assist.calm'));
  if (Object.keys(s.keys || {}).length || s.pad) out.push('🎮 ⇄');
  if (s.tutorials === false) out.push(t('pg.tutOff')); // tutorials and tips off (core/tutorial.js)
  return out;
}

export class ParentPage {
  constructor(game, { onClose = null, profileId = null } = {}) {
    this.game = game;
    this.onClose = onClose;
    injectStyle();
    flushPlayTime(); // the minutes just played count too
    this.profiles = listProfiles();
    this.index = Math.max(0, this.profiles.findIndex((p) => p.id === (profileId || game.solo?.profile?.id)));
    this.t = 0;
    // over everything (the start screen's panel too): its own layer on the page
    this.el = document.createElement('div');
    this.el.className = 'panel parent-panel';
    document.body.appendChild(this.el);
    game.audio.play('select');
    this.render();
  }

  get profile() { return this.profiles[this.index] || null; }

  render() {
    const prof = this.profile;
    const kids = this.profiles.map((p, i) => `<span class="${i === this.index ? 'on' : ''}" style="--c:${(PLAYER_COLORS[p.colorIndex] || PLAYER_COLORS[0]).css}">${esc(p.name)}</span>`).join('');
    const head = `<div class="pg-head"><div class="results-title">👪 ${esc(t('pg.title'))}</div><div class="pg-kids">${kids}</div></div>`;
    const foot = `<div class="pg-note">🔒 ${esc(t('pg.private'))}</div><div class="results-footer">${esc(t('pg.hint'))}</div>`;
    if (!prof) { this.el.innerHTML = `${head}<p>${esc(t('pg.none'))}</p>${foot}`; return; }
    const P = loadPassport(prof.id);
    const css = (PLAYER_COLORS[prof.colorIndex] || PLAYER_COLORS[0]).css;
    // time per day
    const days = lastDays(P, 14);
    const max = Math.max(600, ...days.map((d) => d.s));
    const bars = days.map((d) => {
      const top = Object.entries(d.g).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, s]) => `${k === 'island' || k === 'hub' ? k : gameName(k)} ${fmtTime(s)}`).join(', ');
      return `<div title="${esc(top)}"><b>${d.s >= 60 ? Math.round(d.s / 60) : d.s > 0 ? '<1' : ''}</b><i style="height:${((d.s / max) * 100).toFixed(1)}%"></i><small>${esc(d.date.toLocaleDateString(locale(), { weekday: 'narrow' }))}${d.date.getDate()}</small></div>`;
    }).join('');
    const total = days.reduce((a, d) => a + d.s, 0);
    // genres, skills, games
    const genres = GENRES.filter((g) => P.stamps[g.id]).map((g) => `<span>${g.icon} ${esc(t(`pp.genre.${g.id}`))} · ${esc(new Date(P.stamps[g.id].at).toLocaleDateString(locale(), { day: 'numeric', month: 'short' }))}</span>`).join('');
    const skills = SKILLS.map((s) => { const lv = skillLevel(P, s.id); return `<span>${s.icon} ${esc(t(`pp.skill.${s.id}`))} ${lv ? MEDALS[lv] : '·'} ${esc(t(`pp.lv.${LEVEL_NAMES[lv]}`))}</span>`; }).join('');
    const games = Object.entries(P.games).filter(([k]) => GAMES[k]).sort((a, b) => b[1].plays - a[1].plays).slice(0, 8)
      .map(([k, g]) => `<span>${esc(gameName(k))} ${esc(t('pg.times', { n: g.plays }))}</span>`).join('');
    const trials = Object.keys(P.trials).length;
    // help
    const on = assistOn(profileSettings(prof.id));
    const offers = P.assists.slice(-6).reverse().map((a) => `<li>${esc(t(`pg.offer.${a.kind}`))}${a.game && GAMES[a.game] ? ` · ${esc(gameName(a.game))}` : ''} · ${esc(new Date(a.at).toLocaleDateString(locale(), { day: 'numeric', month: 'short' }))}</li>`).join('');
    const sk = skippedOf(prof.id);
    const tutSk = profileSettings(prof.id).tutSkipped; // tutorials skipped with "I know how to play" (core/tutorial.js)
    const skips = Object.entries(sk).filter(([, l]) => l?.length).map(([g, l]) => `<span>${esc(GAMES[g] || g === 'skyhop' ? gameName(g === 'skyhop' ? 'platformer' : g) : g)}: ${l.length}</span>`).join('')
      + (tutSk.length ? `<span>${esc(t('pg.tutSkipped'))}: ${tutSk.length}</span>` : '');
    this.el.innerHTML = `${head}
      <div class="pg-grid" style="--c:${css}">
        <div>
          <h3>⏱️ ${esc(t('pg.time'))}</h3>
          <div class="pg-bars">${bars}</div>
          <div style="opacity:.8">${esc(t('pg.total', { t: fmtTime(total), d: fmtTime(days[days.length - 1].s) }))}</div>
          <h3>🏷️ ${esc(t('pg.genres', { n: Object.keys(P.stamps).length, m: GENRES.length }))}</h3>
          <div class="pg-chips">${genres || esc(t('pg.noGenres'))}</div>
          <h3>🎮 ${esc(t('pg.games'))}</h3>
          <div class="pg-chips">${games || esc(t('pg.noGames'))}</div>
        </div>
        <div>
          <h3>🏅 ${esc(t('pg.skills'))}</h3>
          <div class="pg-chips">${skills}</div>
          <h3>🏆 ${esc(t('pg.trials', { n: trials, m: TRIALS.length }))}</h3>
          <h3>🙌 ${esc(t('pg.assist'))}</h3>
          <div class="pg-chips">${on.length ? on.map((x) => `<span>${esc(x)}</span>`).join('') : esc(t('pg.assistNone'))}</div>
          <h3>💬 ${esc(t('pg.offers'))}</h3>
          ${offers ? `<ul class="pg-list">${offers}</ul>` : `<div>${esc(t('pg.offersNone'))}</div>`}
          <h3>⏭️ ${esc(t('pg.skips'))}</h3>
          <div class="pg-chips">${skips || esc(t('pg.skipsNone'))}</div>
        </div>
      </div>${foot}`;
  }

  update(dt) {
    this.t += dt;
    const input = this.game.input;
    const keys = input.pressed;
    let step = (keys.has('ArrowRight') ? 1 : 0) - (keys.has('ArrowLeft') ? 1 : 0);
    let close = !!input.escPressed || keys.has('Escape') || (this.t > 0.4 && keys.has('KeyH'));
    for (const d of menuDevices(this.game)) {
      if (d.type === 'keyboard' && (keys.has('ArrowRight') || keys.has('ArrowLeft'))) continue; // (already counted)
      step ||= d.stepX || -d.stepY;
      if (this.t > 0.4 && (d.backPressed || d.cPressed)) close = true;
    }
    for (const d of input.devices.values()) if (d.type !== 'keyboard' && d.connected && this.t > 0.4 && d.btnPressed?.b) close = true;
    if (close) { this.close(); return; }
    if (step && this.profiles.length > 1) {
      this.index = (this.index + step + this.profiles.length) % this.profiles.length;
      this.game.audio.play('select');
      this.render();
    }
  }

  close() {
    this.el?.remove();
    this.el = null;
    this.game.audio.play('select');
    this.onClose?.();
  }
}

