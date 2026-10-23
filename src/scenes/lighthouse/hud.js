import { t, tFor } from '../../core/i18n.js';
import { esc } from '../../core/ui.js';

// HTML overlay for Lighthouse Caves: hearts, shells, keys and the two button boxes at the top, the
// dialog box, button hints, the item / map screen, the title card, "fainted" and "to be continued".
// It lives in the shared label layer, so UI.clear() removes it when the scene changes.

const CSS = `
.lh-layer { position: absolute; inset: 0; pointer-events: none; font-family: var(--font); color: var(--ink); }
.lh-layer > * { position: absolute; }
.lh-top { left: 1.4vw; top: 1.4vh; right: 1.4vw; display: flex; align-items: flex-start; gap: 1.2vw; }
.lh-hearts { display: flex; flex-wrap: wrap; max-width: min(380px, 34vw); gap: 2px; filter: drop-shadow(0 2px 0 rgba(43,35,64,.45)); }
.lh-hearts svg { width: clamp(20px, 2.2vw, 34px); height: clamp(20px, 2.2vw, 34px); }
.lh-hearts.low svg.f { animation: lh-beat .6s infinite; }
@keyframes lh-beat { 50% { transform: scale(1.15); } }
.lh-chip { display: flex; align-items: center; gap: 6px; background: rgba(255,255,255,.92); border-radius: 999px; padding: 3px 12px 3px 6px;
  font-weight: 700; font-size: clamp(15px, 1.5vw, 24px); box-shadow: 0 3px 0 rgba(43,35,64,.2); }
.lh-chip svg { width: 1.4em; height: 1.4em; }
.lh-boxes { margin-left: auto; display: flex; gap: 10px; }
.lh-box { width: clamp(52px, 4.8vw, 74px); height: clamp(52px, 4.8vw, 74px); border-radius: 16px; background: rgba(43,35,64,.72);
  border: 3px solid #fff; position: relative; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 0 rgba(43,35,64,.25); }
.lh-box svg { width: 72%; height: 72%; }
.lh-box .k { position: absolute; top: -10px; left: 50%; transform: translateX(-50%); background: #ffd84a; border-radius: 999px; padding: 0 8px;
  font-size: clamp(11px, 1vw, 15px); font-weight: 700; white-space: nowrap; box-shadow: 0 2px 0 rgba(43,35,64,.25); }
.lh-box .n { position: absolute; right: 4px; bottom: 0; color: #fff; font-weight: 700; font-size: 0.95em; paint-order: stroke fill; -webkit-text-stroke: 0.2em #2b2340; }
.lh-place { left: 50%; top: 13vh; transform: translateX(-50%); font-weight: 700; font-size: clamp(22px, 3vw, 46px); color: #fff;
  paint-order: stroke fill; -webkit-text-stroke: 0.18em #2b2340; opacity: 0; transition: opacity .5s; white-space: nowrap; }
.lh-place.on { opacity: 1; }
.lh-dialog { left: 50%; bottom: 3vh; transform: translateX(-50%); width: min(980px, 92vw); background: rgba(255,250,240,.97); border-radius: 22px;
  border: 4px solid var(--c, #2b2340); padding: 14px 22px 12px; box-shadow: 0 8px 0 rgba(43,35,64,.25); font-size: clamp(17px, 2vw, 32px);
  font-weight: 600; line-height: 1.3; }
.lh-dialog .who { position: absolute; top: -0.9em; left: 18px; background: var(--c, #2b2340); color: #fff; border-radius: 999px; padding: 1px 14px;
  font-size: 0.62em; font-weight: 700; }
.lh-dialog .more { position: absolute; right: 16px; bottom: 6px; font-size: 0.6em; opacity: .75; animation: lh-blink 1s infinite; }
.lh-dialog .choices { display: flex; gap: 18px; margin-top: 8px; font-size: 0.85em; }
.lh-dialog .choices span { padding: 2px 16px; border-radius: 999px; }
.lh-dialog .choices span.on { background: #ffd84a; box-shadow: 0 3px 0 rgba(43,35,64,.2); }
@keyframes lh-blink { 50% { opacity: .2; } }
.lh-hints { right: 1.4vw; bottom: 1.6vh; display: flex; gap: 8px; font-weight: 600; font-size: clamp(12px, 1.1vw, 18px); }
.lh-hints span { background: rgba(255,255,255,.9); border-radius: 999px; padding: 2px 12px; box-shadow: 0 3px 0 rgba(43,35,64,.18); white-space: nowrap; }
.lh-hints b { background: var(--ink); color: #fff; border-radius: 7px; padding: 0 6px; margin-right: 5px; }
.lh-card { left: 50%; top: 50%; transform: translate(-50%, -50%); background: rgba(255,250,240,.97); border-radius: 34px; text-align: center;
  padding: clamp(18px, 3vw, 40px) clamp(26px, 4.5vw, 70px); box-shadow: 0 10px 0 rgba(43,35,64,.25); min-width: min(600px, 90vw); }
.lh-card .logo { font-size: clamp(32px, 5vw, 80px); font-weight: 700; line-height: 1; color: #ffd84a; paint-order: stroke fill; -webkit-text-stroke: 0.13em #2b2340; }
.lh-card .sub { font-size: clamp(15px, 1.8vw, 28px); font-weight: 600; margin: 10px 0 16px; color: #3f8ea3; }
.lh-card .opt { font-size: clamp(18px, 2.2vw, 34px); font-weight: 700; padding: 6px 22px; border-radius: 999px; margin: 6px auto; width: fit-content; }
.lh-card .opt small { display: block; font-size: 0.5em; font-weight: 600; opacity: .75; }
.lh-card .opt.on { background: #ffd84a; box-shadow: 0 4px 0 rgba(43,35,64,.2); }
.lh-card .foot { margin-top: 12px; font-size: clamp(12px, 1.2vw, 18px); font-weight: 600; opacity: .8; }
.lh-big { left: 50%; top: 40%; transform: translate(-50%, -50%); text-align: center; }
.lh-big .t1 { font-size: clamp(36px, 6vw, 100px); font-weight: 700; color: #ffd84a; paint-order: stroke fill; -webkit-text-stroke: 0.14em #2b2340; font-style: italic; }
.lh-big .t2 { font-size: clamp(16px, 2vw, 32px); font-weight: 700; color: #fff; paint-order: stroke fill; -webkit-text-stroke: 0.22em #2b2340; }
.lh-big .t3 { margin-top: 16px; display: inline-block; background: rgba(255,255,255,.92); border-radius: 999px; padding: 4px 16px; font-weight: 600; font-size: clamp(13px, 1.3vw, 20px); }
.lh-menu { left: 50%; top: 50%; transform: translate(-50%, -50%); width: min(1100px, 94vw); background: rgba(30,24,48,.94); border-radius: 30px;
  color: #fff; padding: 18px 24px; display: grid; grid-template-columns: 1fr 1.25fr; gap: 22px; box-shadow: 0 10px 0 rgba(0,0,0,.3); }
.lh-menu h3 { margin: 0 0 10px; font-size: clamp(16px, 1.7vw, 26px); color: #ffd84a; }
.lh-menu .items { display: flex; flex-wrap: wrap; gap: 10px; }
.lh-menu .slot { width: clamp(64px, 6vw, 92px); height: clamp(64px, 6vw, 92px); border-radius: 18px; background: rgba(255,255,255,.12); border: 3px solid transparent;
  display: flex; align-items: center; justify-content: center; position: relative; }
.lh-menu .slot svg { width: 70%; height: 70%; }
.lh-menu .slot.on { border-color: #ffd84a; background: rgba(255,216,74,.18); }
.lh-menu .slot .eq { position: absolute; bottom: -9px; left: 50%; transform: translateX(-50%); background: #ffd84a; color: #2b2340; border-radius: 999px; padding: 0 7px; font-size: 12px; font-weight: 700; white-space: nowrap; }
.lh-menu .slot .n { position: absolute; right: 5px; bottom: 2px; font-weight: 700; }
.lh-menu .name { margin: 12px 0 4px; font-weight: 700; font-size: clamp(15px, 1.5vw, 22px); min-height: 1.3em; }
.lh-menu .stats { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
.lh-menu .stats span { background: rgba(255,255,255,.12); border-radius: 999px; padding: 3px 12px; font-weight: 600; display: flex; align-items: center; gap: 6px; }
.lh-menu .stats svg { width: 1.3em; height: 1.3em; }
.lh-menu .restart { margin-top: 14px; padding: 6px 14px; border-radius: 14px; background: rgba(255,255,255,.08); width: fit-content; font-weight: 600; }
.lh-menu .restart.on { background: #ffd84a; color: #2b2340; }
.lh-menu .restart small { display: block; font-size: .75em; opacity: .7; }
.lh-menu .foot { grid-column: 1 / -1; text-align: center; opacity: .8; font-weight: 600; font-size: clamp(12px, 1.2vw, 18px); }
.lh-map { display: grid; gap: 5px; justify-content: center; }
.lh-map .cell { border-radius: 8px; background: rgba(255,255,255,.06); position: relative; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; color: #2b2340; text-align: center; line-height: 1.05; padding: 2px; }
.lh-map .cell.room { background: #9a8db5; }
.lh-map .cell.seen { background: #e9e2ff; }
.lh-map .cell.here { background: #ffd84a; box-shadow: 0 0 0 3px #fff; animation: lh-blink 1.2s infinite; }
.lh-map .cell .dot { position: absolute; width: 10px; height: 10px; border-radius: 50%; background: #ff5d73; right: 4px; top: 4px; }
.lh-map .cell .boss { position: absolute; left: 50%; top: 50%; transform: translate(-50%,-50%); width: 18px; height: 18px; border-radius: 50%; background: #2b2340; box-shadow: 0 0 0 3px #ff5d73; }
.lh-map .door { position: absolute; background: #fff; }
.lh-flash { inset: 0; background: #fff; opacity: 0; }
.lh-credits { inset: 0; overflow: hidden; background: linear-gradient(rgba(20,14,40,.88), rgba(20,14,40,.72)); }
.lh-credits .roll { position: absolute; left: 0; right: 0; top: 0; text-align: center; color: #fff; }
.lh-credits .big { font-size: clamp(30px, 4.6vw, 70px); font-weight: 700; color: #ffd84a; paint-order: stroke fill; -webkit-text-stroke: 0.12em #2b2340; margin: 0.5em 0; }
.lh-credits .small { font-size: clamp(14px, 1.6vw, 24px); font-weight: 600; opacity: .8; margin-bottom: 2.2em; }
.lh-credits .head { font-size: clamp(14px, 1.5vw, 22px); font-weight: 700; color: #8ff0ff; margin-top: 2.4em; text-transform: uppercase; letter-spacing: .08em; }
.lh-credits .text { font-size: clamp(18px, 2.1vw, 32px); font-weight: 700; margin-top: .35em; }
.lh-dark { inset: 0; background: #000; opacity: 0; }
`;

function injectStyle() {
  if (document.getElementById('lh-style')) return;
  const el = document.createElement('style');
  el.id = 'lh-style';
  el.textContent = CSS;
  document.head.appendChild(el);
}

const div = (cls, parent) => {
  const el = document.createElement('div');
  el.className = cls;
  parent.appendChild(el);
  return el;
};

// ---------- icons (inline SVG) ----------

const HEART = 'M12 21s-7.5-4.6-9.6-9.2C1 8.6 3 5 6.5 5c2.1 0 3.5 1.2 5.5 3.2C14 6.2 15.4 5 17.5 5 21 5 23 8.6 21.6 11.8 19.5 16.4 12 21 12 21z';
export const ICONS = {
  heartFull: `<svg viewBox="0 0 24 24" class="f"><path d="${HEART}" fill="#ff5d73" stroke="#2b2340" stroke-width="1.6"/><ellipse cx="8" cy="9" rx="2" ry="1.3" fill="#fff" opacity=".7"/></svg>`,
  heartHalf: `<svg viewBox="0 0 24 24" class="f"><clipPath id="lhh"><rect x="0" y="0" width="12" height="24"/></clipPath><path d="${HEART}" fill="#5a4d7a"/><path d="${HEART}" fill="#ff5d73" clip-path="url(#lhh)"/><path d="${HEART}" fill="none" stroke="#2b2340" stroke-width="1.6"/></svg>`,
  heartEmpty: `<svg viewBox="0 0 24 24"><path d="${HEART}" fill="#5a4d7a" stroke="#2b2340" stroke-width="1.6"/></svg>`,
  shell: '<svg viewBox="0 0 24 24"><path d="M3 15c0-6 4-10 9-10s9 4 9 10l-3 2H6z" fill="#ffb3c7" stroke="#2b2340" stroke-width="1.5"/><path d="M12 5v12M8 6.5l1.5 10M16 6.5l-1.5 10M5 9.5l3 7M19 9.5l-3 7" stroke="#fff" stroke-width="1.2"/><rect x="9" y="17" width="6" height="3" rx="1" fill="#ffb3c7" stroke="#2b2340" stroke-width="1.3"/></svg>',
  key: '<svg viewBox="0 0 24 24"><circle cx="8" cy="8" r="4.5" fill="none" stroke="#ffd23f" stroke-width="3"/><path d="M11 11l8 8M16 16l2-2M18.5 18.5l2-2" stroke="#ffd23f" stroke-width="3" stroke-linecap="round"/></svg>',
  bigkey: '<svg viewBox="0 0 24 24"><circle cx="8" cy="8" r="5" fill="#ff7a2e" stroke="#2b2340" stroke-width="1.4"/><circle cx="8" cy="8" r="2" fill="#ff5d73"/><path d="M11.5 11.5l8 8M16 16l2.5-2.5M18.5 18.5l2.5-2.5" stroke="#ff7a2e" stroke-width="3.4" stroke-linecap="round"/></svg>',
  sword: '<svg viewBox="0 0 24 24"><path d="M19 3l2 2-10 10-2-2z" fill="#e8eefc" stroke="#2b2340" stroke-width="1.3"/><path d="M6 13l5 5M8.5 15.5l-4 4" stroke="#ffd23f" stroke-width="2.6" stroke-linecap="round"/><path d="M4.5 19.5l-1.5 1.5" stroke="#8a5a3a" stroke-width="3" stroke-linecap="round"/></svg>',
  lantern: '<svg viewBox="0 0 24 24"><path d="M9 3h6l1 3H8z" fill="#8a5a3a"/><rect x="7" y="6" width="10" height="12" rx="3" fill="#fff1a8" stroke="#8a5a3a" stroke-width="1.6"/><path d="M12 9c2 2.5 2 4.5 0 6-2-1.5-2-3.5 0-6z" fill="#ff9f2e"/><rect x="7" y="18" width="10" height="3" rx="1" fill="#8a5a3a"/></svg>',
  grapple: '<svg viewBox="0 0 24 24"><circle cx="9" cy="14" r="5.5" fill="none" stroke="#d8b27a" stroke-width="3"/><circle cx="9" cy="14" r="2.5" fill="none" stroke="#d8b27a" stroke-width="2"/><path d="M13 10l6-6M16 4h3v3" stroke="#dfe6f5" stroke-width="2.4" stroke-linecap="round" fill="none"/></svg>',
  potion: '<svg viewBox="0 0 24 24"><path d="M10 3h4v4l4 5a6 6 0 1 1-12 0l4-5z" fill="#5ee0b0" stroke="#2b2340" stroke-width="1.4"/><rect x="9.5" y="2" width="5" height="2.5" rx="1" fill="#8a5a3a"/></svg>',
  map: '<svg viewBox="0 0 24 24"><path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z" fill="#f6e2b8" stroke="#8a5a3a" stroke-width="1.4"/><path d="M9 4v14M15 6v14" stroke="#8a5a3a" stroke-width="1"/><path d="M5 12l3-2 4 3 4-4" stroke="#ff5d73" stroke-width="1.6" fill="none"/></svg>',
  compass: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="#ffd23f" stroke="#2b2340" stroke-width="1.4"/><circle cx="12" cy="12" r="6.5" fill="#fff"/><path d="M12 6l2 6h-4z" fill="#ff5d73"/><path d="M12 18l-2-6h4z" fill="#5a4d7a"/></svg>',
  crystal: '<svg viewBox="0 0 24 24"><path d="M12 2l6 8-6 12-6-12z" fill="#8ff0ff" stroke="#2b2340" stroke-width="1.4"/><path d="M12 2v20M6 10h12" stroke="#fff" stroke-width="1"/></svg>',
  piece: '<svg viewBox="0 0 24 24"><path d="M12 21s-7.5-4.6-9.6-9.2C1 8.6 3 5 6.5 5c2.1 0 3.5 1.2 5.5 3.2V21z" fill="#ff5d73" stroke="#2b2340" stroke-width="1.4"/></svg>',
  glove: '<svg viewBox="0 0 24 24"><path d="M7 21v-4l-3-5c-.6-1 .8-2 1.6-1.2L8 13V5.5a1.4 1.4 0 0 1 2.8 0V11V3.8a1.4 1.4 0 0 1 2.8 0V11V4.8a1.4 1.4 0 0 1 2.8 0V12V7.5a1.4 1.4 0 0 1 2.8 0V15c0 3-2 6-5 6z" fill="#c9873f" stroke="#2b2340" stroke-width="1.3"/><rect x="6.5" y="19" width="11" height="3" rx="1" fill="#ff5d73" stroke="#2b2340" stroke-width="1.1"/></svg>',
  bombs: '<svg viewBox="0 0 24 24"><circle cx="11" cy="14" r="7" fill="#34406a" stroke="#2b2340" stroke-width="1.4"/><circle cx="8.5" cy="11.5" r="1.8" fill="#8ea0d8"/><rect x="9.5" y="5.5" width="4" height="2.6" rx=".8" fill="#5b5470"/><path d="M13 6c1.5-2 3-2.5 4.5-2" stroke="#d8b27a" stroke-width="1.6" fill="none"/><circle cx="18.3" cy="3.6" r="2" fill="#ffd23f"/></svg>',
  bow: '<svg viewBox="0 0 24 24"><path d="M6 3c8 3 8 15 0 18" fill="none" stroke="#b5835a" stroke-width="2.6" stroke-linecap="round"/><path d="M6 3v18" stroke="#fff" stroke-width="1"/><path d="M4 12h15" stroke="#d8b27a" stroke-width="1.8"/><path d="M21 12l-3.5-2.2v4.4z" fill="#dfe6f5" stroke="#2b2340" stroke-width=".8"/><path d="M4 12l-2-1.8M4 12l-2 1.8" stroke="#ff5d73" stroke-width="1.4"/></svg>',
  fins: '<svg viewBox="0 0 24 24"><path d="M5 4l4 1 1 10-2 6-5-1 1-6z" fill="#3ddc97" stroke="#2b2340" stroke-width="1.3"/><path d="M14 5l4-1 2 10-1 6-5 1-2-6z" fill="#3ddc97" stroke="#2b2340" stroke-width="1.3"/><path d="M6 8l2 9M18 8l-2 9" stroke="#1f9e6e" stroke-width="1.2"/></svg>',
  gshell: '<svg viewBox="0 0 24 24"><path d="M3 15c0-6 4-10 9-10s9 4 9 10l-3 2H6z" fill="#ffd23f" stroke="#2b2340" stroke-width="1.5"/><path d="M12 5v12M8 6.5l1.5 10M16 6.5l-1.5 10M5 9.5l3 7M19 9.5l-3 7" stroke="#fff6c8" stroke-width="1.2"/><rect x="9" y="17" width="6" height="3" rx="1" fill="#ffd23f" stroke="#2b2340" stroke-width="1.3"/></svg>',
};
export const itemIcon = (id) => ICONS[id] || '';

export class LhHud {
  constructor(game) {
    injectStyle();
    this.game = game;
    this.root = div('lh-layer', game.ui.labels);
    this.dark = div('lh-dark', this.root);
    this.flashEl = div('lh-flash', this.root);
    this.top = div('lh-top', this.root);
    this.place = div('lh-place', this.root);
    this.hints = div('lh-hints', this.root);
    this.dialog = div('lh-dialog', this.root);
    this.dialog.style.display = 'none';
    this.card = div('lh-card', this.root);
    this.card.style.display = 'none';
    this.big = div('lh-big', this.root);
    this.big.style.display = 'none';
    this.menu = div('lh-menu', this.root);
    this.menu.style.display = 'none';
    this.creditsEl = div('lh-credits', this.root);
    this.creditsEl.style.display = 'none';
    this.cache = {};
  }

  set(key, el, html) {
    if (this.cache[key] === html) return;
    this.cache[key] = html;
    el.innerHTML = html;
  }

  show(el, on) {
    const v = on ? '' : 'none';
    if (el.style.display !== v) el.style.display = v;
  }

  /** Top bar: hearts, shells, keys and the [A] / [C] boxes. */
  setTop(s, { visible = true, player } = {}) {
    this.show(this.top, visible);
    if (!visible) return;
    const hearts = [];
    for (let i = 0; i < s.maxHp / 2; i++) {
      const v = s.hp - i * 2;
      hearts.push(v >= 2 ? ICONS.heartFull : v === 1 ? ICONS.heartHalf : ICONS.heartEmpty);
    }
    const chips = [`<div class="lh-chip">${ICONS.shell}${s.shells}</div>`];
    if (s.dungeon) {
      chips.push(`<div class="lh-chip">${ICONS.key}${s.keys}${s.bigkey ? ICONS.bigkey : ''}</div>`);
    }
    const box = (label, icon, n = '') => `<div class="lh-box"><span class="k">${label}</span>${icon}${n !== '' ? `<span class="n">${n}</span>` : ''}</div>`;
    const boxes = [];
    if (s.sword) boxes.push(box(tFor(player, '[A]'), ICONS.sword));
    if (s.equip) boxes.push(box(tFor(player, '[C]'), itemIcon(s.equip)));
    if (s.potion) boxes.push(box(t('lh.item.potion'), ICONS.potion));
    this.set('top', this.top, `<div class="lh-hearts ${s.hp <= 2 && s.maxHp > 2 ? 'low' : ''}">${hearts.join('')}</div>${chips.join('')}<div class="lh-boxes">${boxes.join('')}</div>`);
  }

  showPlace(text) {
    this.place.textContent = text;
    this.place.classList.add('on');
    clearTimeout(this.placeTimer);
    this.placeTimer = setTimeout(() => this.place.classList.remove('on'), 2200);
  }

  setHints(list, player) {
    const html = list.map(([b, key]) => `<span><b>${esc(tFor(player, `[${b}]`))}</b>${esc(t(key))}</span>`).join('');
    this.set('hints', this.hints, html);
  }

  setDialog(d) {
    this.show(this.dialog, !!d);
    if (!d) { this.cache.dialog = null; return; }
    const choices = d.choices ? `<div class="choices">${d.choices.map((c, i) => `<span class="${i === d.index ? 'on' : ''}">${esc(c)}</span>`).join('')}</div>` : '';
    this.dialog.style.setProperty('--c', d.css || '#2b2340');
    this.set('dialog', this.dialog, `${d.who ? `<div class="who">${esc(d.who)}</div>` : ''}${esc(d.text)}${choices}${d.choices ? '' : '<div class="more">▼</div>'}`);
  }

  setTitle(c) {
    this.show(this.card, !!c);
    if (!c) { this.cache.card = null; return; }
    const opts = c.options.map((o, i) => `<div class="opt ${i === c.index ? 'on' : ''}">${esc(o.text)}${o.sub ? `<small>${esc(o.sub)}</small>` : ''}</div>`).join('');
    this.set('card', this.card, `<div class="logo">${esc(c.logo)}</div><div class="sub">${esc(c.sub)}</div>${opts}<div class="foot">${esc(c.foot)}</div>`);
  }

  setBig(b) {
    this.show(this.big, !!b);
    if (!b) { this.cache.big = null; return; }
    this.set('big', this.big, `<div class="t1">${esc(b.t1)}</div>${b.t2 ? `<div class="t2">${esc(b.t2)}</div>` : ''}${b.t3 ? `<div class="t3">${esc(b.t3)}</div>` : ''}`);
  }

  /** Item + map screen. m = { items: [{ id, name, n, equipped }], sel, restartSel, map: {cols, rows, cells}, stats, foot } */
  setMenu(m) {
    this.show(this.menu, !!m);
    if (!m) { this.cache.menu = null; return; }
    const slots = m.items.length
      ? m.items.map((it, i) => `<div class="slot ${i === m.sel && !m.restartSel ? 'on' : ''}">${itemIcon(it.id)}${it.n ? `<span class="n">${it.n}</span>` : ''}${it.equipped ? `<span class="eq">${esc(m.eqLabel)}</span>` : ''}</div>`).join('')
      : `<div style="opacity:.7">${esc(t('lh.menu.none'))}</div>`;
    const cur = m.items[m.sel];
    const stats = m.stats.map(([icon, text]) => `<span>${ICONS[icon] || ''}${esc(text)}</span>`).join('');
    const map = m.map;
    const cw = map.cellW, ch = map.cellH;
    const cells = map.cells.map((c) => {
      const doors = (c.doors || []).map((d) => {
        const st = d === 'n' ? 'left:42%;top:-4px;width:16%;height:5px' : d === 's' ? 'left:42%;bottom:-4px;width:16%;height:5px' : d === 'w' ? 'top:38%;left:-4px;height:24%;width:5px' : 'top:38%;right:-4px;height:24%;width:5px';
        return `<i class="door" style="${st}"></i>`;
      }).join('');
      return `<div class="cell ${c.cls}" style="grid-column:${c.col};grid-row:${c.row};width:${cw}px;height:${ch}px">${c.label ? esc(c.label) : ''}${c.dot ? '<i class="dot"></i>' : ''}${c.boss ? '<i class="boss"></i>' : ''}${doors}</div>`;
    }).join('');
    this.set('menu', this.menu, `
      <div><h3>${esc(t('lh.menu.items'))}</h3><div class="items">${slots}</div>
        <div class="name">${cur ? esc(cur.name) : ''}</div>
        <div class="stats">${stats}</div>
        <div class="restart ${m.restartSel ? 'on' : ''}">${esc(t('lh.restart'))}<small>${esc(t('lh.restartSub'))}</small></div></div>
      <div><h3>${esc(map.title)}</h3><div class="lh-map" style="grid-template-columns:repeat(${map.cols},${cw}px)">${cells}</div>
        ${map.note ? `<div style="margin-top:8px;opacity:.75;text-align:center">${esc(map.note)}</div>` : ''}</div>
      <div class="foot">${esc(m.foot)}</div>`);
  }

  /** Rolling credits: c = { lines: [{ big | small | head | text }], p: 0..1 } or null. */
  setCredits(c) {
    this.show(this.creditsEl, !!c);
    if (!c) { this.cache.credits = null; return; }
    const html = c.lines.map((l) => {
      const [cls, text] = Object.entries(l)[0];
      return `<div class="${cls}">${esc(text)}</div>`;
    }).join('');
    this.set('credits', this.creditsEl, `<div class="roll">${html}</div>`);
    const roll = this.creditsEl.firstChild;
    const H = this.creditsEl.clientHeight || window.innerHeight;
    const h = roll.scrollHeight || H * 2;
    roll.style.transform = `translateY(${(H - c.p * (h + H * 0.45)).toFixed(1)}px)`;
  }

  flash(v = 0.6) { this.flashV = Math.max(this.flashV || 0, v); }

  setDark(on) { this.darkTarget = on ? 1 : 0; }

  /** Fades run on game time (they pause with the game and keep up with test fast-forwarding). */
  tick(dt) {
    this.flashV = Math.max(0, (this.flashV || 0) - dt * 2.4);
    const f = this.flashV.toFixed(2);
    if (this.flashEl.style.opacity !== f) this.flashEl.style.opacity = f;
    const tgt = this.darkTarget || 0;
    this.darkV = this.darkV ?? 0;
    this.darkV += Math.sign(tgt - this.darkV) * Math.min(Math.abs(tgt - this.darkV), dt * 3.2);
    const d = this.darkV.toFixed(2);
    if (this.dark.style.opacity !== d) this.dark.style.opacity = d;
  }

  dispose() {
    clearTimeout(this.placeTimer);
    this.root.remove();
  }
}
