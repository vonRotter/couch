import { t, tFor, getLang } from '../../core/i18n.js';
import { esc } from '../../core/ui.js';
import { say as speak } from '../../core/voice.js';
import { makeGameIcon } from '../hub-icons.js';
import { thumb } from './thumbs.js';
import {
  GENRES, SKILLS, TRIALS, GAMES, MEDALS, LEVEL_NAMES, SILVER_AT, GOLD_AT, loadPassport, skillLevel, masteryCount, gameName,
} from '../../core/passport.js';

// The Passport tab of the journal (journal.js): the genre passport of core/passport.js for the profile playing.
// Pages (the stick or the arrow keys turn them, like the Friends book):
//   0  the passport: a stamp per genre (coloured once earned), the nine skills with their medal, and what Coach
//      suggests next;
//   1  Coach's trials: every trial, done or not, the one Coach gave you marked;
//   2+ one card per genre: a picture, one paragraph (what kind of game it is, what you practise, a famous
//      example, the games here) and the date of its stamp.
// Read aloud (the passport is help, like the Tasks): the narrator reads each page when it is turned to.

const CSS = `
.pp-stamps { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px 8px; margin: 2px auto 6px; width: min(100%, calc(48vh * 7 / 2.2)); }
.pp-stamp { aspect-ratio: 1; border-radius: 50%; display: flex; flex-direction: column; align-items: center; justify-content: center; border: 3px dashed rgba(138,90,50,.3); color: rgba(138,90,50,.45); text-align: center; font-size: clamp(9px, .85vw, 13px); line-height: 1.05; padding: 3px; }
.pp-stamp i { font-style: normal; font-size: clamp(18px, 2.2vw, 32px); filter: grayscale(1) opacity(.35); }
.pp-stamp.on { border: 3px solid var(--c); color: var(--c); background: radial-gradient(circle, #fff 0, #fff6e4 70%); transform: rotate(-6deg); box-shadow: 0 2px 0 rgba(43,35,64,.12); font-weight: 700; }
.pp-stamp.on i { filter: none; }
.pp-stamp.on:nth-child(even) { transform: rotate(5deg); }
.pp-skills { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px 10px; font-size: clamp(12px, 1.2vw, 18px); }
.pp-skills div { background: rgba(138,90,50,.08); border-radius: 10px; padding: 2px 8px; display: flex; flex-wrap: wrap; align-items: center; gap: 0 6px; min-width: 0; }
.pp-skills b { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pp-skills small { opacity: .65; white-space: nowrap; font-size: .78em; flex-basis: 100%; padding-left: 1.7em; margin-top: -2px; }
.pp-next { margin-top: 8px; background: #fff3c4; border-radius: 12px; padding: 5px 10px; font-size: clamp(13px, 1.25vw, 19px); }
.pp-trials { margin: 0; padding: 0; list-style: none; display: grid; grid-template-columns: 1fr 1fr; gap: 3px 6px; font-size: clamp(11px, 1.08vw, 16px); }
.pp-trials li { display: flex; gap: 6px; align-items: center; background: rgba(138,90,50,.07); border-radius: 10px; padding: 2px 7px; line-height: 1.2; }
.pp-trials li.done { background: #e4f7d8; }
.pp-trials li.given { box-shadow: inset 0 0 0 2px #ffb703; }
.pp-trials li span { flex: 1; }
.pp-card { display: grid; grid-template-columns: clamp(110px, 15vw, 190px) 1fr; gap: 8px 18px; align-items: start; }
.pp-card .pic { background: radial-gradient(circle at 50% 40%, #fff 0, var(--bg) 75%); border-radius: 18px; padding: 6px; box-shadow: inset 0 0 0 3px rgba(138,90,50,.2); aspect-ratio: 1; display: flex; align-items: center; justify-content: center; font-size: clamp(50px, 7vw, 96px); }
.pp-card .pic img { width: 100%; display: block; }
.pp-card .nm { font-size: clamp(20px, 2.3vw, 34px); font-weight: 700; color: var(--c); display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.pp-card p { margin: 4px 0 6px; font-size: clamp(14px, 1.4vw, 21px); line-height: 1.4; }
.pp-card .st { font-size: clamp(12px, 1.15vw, 17px); opacity: .75; }
.pp-card .games { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
.pp-card .games span { background: #fff; border-radius: 999px; padding: 1px 9px; font-size: clamp(11px, 1.05vw, 16px); box-shadow: 0 2px 0 rgba(43,35,64,.1); }
.pp-card .games span.on { background: #e4f7d8; }
`;
function injectStyle() {
  if (document.getElementById('pp-style')) return;
  const el = document.createElement('style');
  el.id = 'pp-style';
  el.textContent = CSS;
  document.head.appendChild(el);
}

const FIXED = ['home', 'trials']; // then one page per genre

export class PassportBook {
  constructor(host) {
    this.host = host;
    this.page = 0;
    injectStyle();
  }

  get P() { return loadPassport(this.host.game.solo?.profile?.id) || null; }

  pages() { return [...FIXED, ...GENRES.map((g) => `genre:${g.id}`)]; }

  /** Open the journal at the passport, at a page ('home', 'trials' or 'genre:<id>'). */
  open(page = null) {
    if (page !== null) { const i = this.pages().indexOf(page); if (i >= 0) this.page = i; }
    this.host.journal.open('passport');
  }

  flip(inp) {
    const n = this.pages().length;
    const keys = this.host.game.input.pressed;
    const step = inp.stepX || -inp.stepY || (keys.has('ArrowRight') || keys.has('ArrowDown') ? 1 : keys.has('ArrowLeft') || keys.has('ArrowUp') ? -1 : 0);
    if (!step) return;
    this.page = (this.page + step + n) % n;
    this.host.game.audio.play('select');
    this.render(true);
  }

  picture(g) {
    if (!g.pic) return esc(g.icon);
    const src = thumb(this.host.game.renderer, `genre:${g.id}`, () => makeGameIcon(g.pic), { rx: 0.15, ry: -0.5 });
    return src ? `<img src="${src}" alt="">` : esc(g.icon);
  }

  render(read = false) {
    const host = this.host, list = this.pages();
    this.page = Math.max(0, Math.min(this.page, list.length - 1));
    const id = list[this.page];
    const P = this.P;
    const dots = `<div class="isl-fbdots">${list.map((_, i) => `<span class="${i === this.page ? 'on' : ''}"></span>`).join('')}</div>`;
    const foot = `<div class="isl-foot">${esc(tFor(host.player?.p, 'pp.hint'))}</div>`;
    let html = '', say = [];
    if (!P) html = `<h2>${esc(t('pp.title'))}</h2>`;
    else if (id === 'home') [html, say] = this.renderHome(P);
    else if (id === 'trials') [html, say] = this.renderTrials(P);
    else [html, say] = this.renderGenre(P, id.slice(6));
    host.hud.setPanel(`${html}${dots}${foot}`);
    if (read && say.length) speak(say.join(' '), 'narrator');
  }

  renderHome(P) {
    const stamps = GENRES.map((g) => {
      const on = !!P.stamps[g.id];
      return `<div class="pp-stamp ${on ? 'on' : ''}" style="--c:${g.css}"><i>${g.icon}</i>${esc(t(`pp.genre.${g.id}`))}</div>`;
    }).join('');
    const n = Object.keys(P.stamps).length;
    const skills = SKILLS.map((s) => {
      const lv = skillLevel(P, s.id), m = masteryCount(P, s.id);
      const more = lv === 0 ? '' : lv === 1 ? t('pp.toSilver', { n: Math.max(1, SILVER_AT - m) }) : lv === 2 ? t('pp.toGold', { n: Math.max(1, GOLD_AT - m) }) : t('pp.maxed');
      return `<div><span>${s.icon}</span><b>${esc(t(`pp.skill.${s.id}`))}</b><span>${MEDALS[lv] || '·'}</span><small>${esc(lv ? t(`pp.lv.${LEVEL_NAMES[lv]}`) : t('pp.lv.none'))}${more && lv < 3 ? ` · ${esc(more)}` : ''}</small></div>`;
    }).join('');
    const sug = this.host.coach?.suggestion();
    const sugText = sug ? (sug.why ? `${sug.text}. ${sug.why}` : sug.text) : '';
    const next = sug ? `<div class="pp-next">⭐ <b>${esc(t('pp.next'))}:</b> ${esc(sugText)}</div>` : '';
    const html = `<h2>${esc(t('pp.title'))}</h2>
      <div style="text-align:center;font-weight:700;opacity:.75">${esc(t('pp.stamps', { n, m: GENRES.length }))}</div>
      <div class="pp-stamps">${stamps}</div>
      <div style="font-weight:700;margin:2px 0 4px;color:#8a5a32">${esc(t('pp.skills'))}</div>
      <div class="pp-skills">${skills}</div>${next}`;
    const say = [t('pp.say.title', { n, m: GENRES.length }), ...SKILLS.map((s) => t('pp.say.skill', { skill: t(`pp.skill.${s.id}`), level: t(`pp.lv.${LEVEL_NAMES[skillLevel(P, s.id)]}`) }))];
    if (sug) say.push(t('pp.say.next', { game: sugText.replace(/\.$/, '') }));
    return [html, say];
  }

  renderTrials(P) {
    const given = P.coach?.trial;
    const rows = TRIALS.map((tr) => {
      const done = !!P.trials[tr.id];
      const sk = SKILLS.find((s) => s.id === tr.skill);
      return `<li class="${done ? 'done' : ''} ${tr.id === given && !done ? 'given' : ''}"><span>${sk.icon} ${esc(t(`pp.tr.${tr.id}`))}${tr.id === given && !done ? ` <small>(${esc(t('pp.trialGiven'))})</small>` : ''}</span>
        <b title="${esc(t(`pp.skill.${tr.skill}`))}">${MEDALS[tr.level]}${done ? '✅' : '⬜'}</b></li>`;
    }).join('');
    const html = `<h2>${esc(t('pp.trialsTitle'))}</h2><div class="isl-foot" style="margin:-4px 0 6px;opacity:.85">${esc(t('pp.trialsSub'))}</div><ul class="pp-trials">${rows}</ul>`;
    // read: the trials not done yet, Coach's first (a long list read in full would be too much)
    const open = TRIALS.filter((tr) => !P.trials[tr.id]).sort((a, b) => (b.id === given) - (a.id === given));
    const say = [t('pp.say.trials'), t('pp.trialsSub'), ...open.slice(0, 4).map((tr) => `${t(`pp.tr.${tr.id}`)}: ${t('pp.say.medal', { skill: t(`pp.skill.${tr.skill}`), level: t(`pp.lv.${LEVEL_NAMES[tr.level]}`) })}.`)];
    return [html, say];
  }

  renderGenre(P, gid) {
    const g = GENRES.find((x) => x.id === gid);
    const st = P.stamps[gid];
    const games = Object.entries(GAMES).filter(([k, G]) => G.genre === gid && !k.startsWith('boss'));
    const chips = games.map(([k]) => `<span class="${P.games[k]?.proper ? 'on' : ''}">${P.games[k]?.proper ? '✓ ' : ''}${esc(gameName(k))}</span>`).join('');
    const date = st ? new Date(st.at).toLocaleDateString(getLang() === 'no' ? 'nb-NO' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
    const html = `<h2>${esc(t('pp.cardTitle'))}</h2>
      <div class="pp-card" style="--c:${g.css};--bg:${g.css}33"><div class="pic">${this.picture(g)}</div>
        <div><div class="nm">${g.icon} ${esc(t(`pp.genre.${gid}`))}${st ? ' <span title="stamp">🏷️</span>' : ''}</div>
        <p>${esc(t(`pp.card.${gid}`))}</p>
        <div class="st">${esc(st ? t('pp.cardStamp', { date }) : t('pp.cardNoStamp'))}</div>
        <div class="games">${chips}</div></div></div>`;
    return [html, [`${t(`pp.genre.${gid}`)}.`, t(`pp.card.${gid}`)]];
  }
}

