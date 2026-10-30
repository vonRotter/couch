import { esc } from '../../core/ui.js';

// Bean Brigade HTML overlay: grid power and turns at the top, objectives on the right, the mech
// roster on the left, info about the tile under the cursor, button hints, tutorial bubbles and the
// menu cards (title, difficulty, squads, map, upgrades, results). It lives in the shared label layer,
// so UI.clear() removes it when the scene changes.

const CSS = `
.br-layer { position: absolute; inset: 0; z-index: 3; pointer-events: none; font-family: var(--font); color: var(--ink); }
.br-layer > * { position: absolute; }
.br-top { left: 1.2vw; right: 1.2vw; top: 1.2vh; display: flex; align-items: flex-start; gap: 1vw; }
.br-pill { background: rgba(255,255,255,.93); border-radius: 18px; padding: 6px 14px; box-shadow: 0 4px 0 rgba(43,35,64,.2); font-weight: 700;
  font-size: clamp(13px, 1.4vw, 22px); line-height: 1.15; }
.br-pill small { display: block; font-size: .62em; font-weight: 600; opacity: .7; }
.br-power { display: flex; align-items: center; gap: 8px; }
.br-power .bar { display: flex; gap: 3px; }
.br-power .bar i { width: clamp(12px, 1.3vw, 20px); height: clamp(18px, 2vw, 30px); border-radius: 5px; background: #d9d4e8; display: block; }
.br-power .bar i.on { background: linear-gradient(#ffe97a, #ffc21a); box-shadow: inset 0 -3px 0 rgba(0,0,0,.12); }
.br-power .bar i.lose { background: #ff5d73; animation: br-blink .5s infinite; }
.br-power.flash { animation: br-shake .4s; }
.br-power .bolt { font-size: 1.3em; color: #ffb000; -webkit-text-stroke: 0.06em #2b2340; }
.br-turn { text-align: center; margin: 0 auto; }
.br-turn.last { background: #ffd84a; }
.br-objs { margin-left: auto; max-width: 30vw; }
.br-objs div { display: flex; gap: 8px; align-items: center; font-size: .82em; font-weight: 600; margin: 2px 0; }
.br-objs div::before { content: '★'; color: #c9c2dc; font-size: 1.2em; }
.br-objs div.power::before { content: '⚡'; }
.br-objs div.done::before { color: #ffb000; }
.br-objs div.fail { opacity: .45; text-decoration: line-through; }
.br-objs div.main::before { content: '⏳'; color: #2b2340; }
.br-roster { left: 1.2vw; top: 17vh; display: flex; flex-direction: column; gap: 8px; width: min(250px, 19vw); }
.br-mech { background: rgba(255,255,255,.9); border-radius: 16px; padding: 6px 10px; box-shadow: 0 3px 0 rgba(43,35,64,.18); border: 3px solid transparent;
  font-weight: 700; font-size: clamp(12px, 1.15vw, 18px); line-height: 1.15; }
.br-mech.on { border-color: #ffd84a; background: #fffbe6; }
.br-mech.done { opacity: .6; }
.br-mech .nm { display: flex; align-items: center; gap: 6px; }
.br-mech .nm i { width: .9em; height: .9em; border-radius: 50%; display: inline-block; background: var(--c); box-shadow: 0 0 0 2px #2b2340 inset; }
.br-mech small { display: block; font-weight: 600; opacity: .75; font-size: .78em; }
.br-pips { display: inline-flex; gap: 2px; margin-left: auto; }
.br-pips i, .br-hp i { display: inline-block; width: .62em; height: .62em; border-radius: 3px; background: #d9d4e8; box-shadow: 0 0 0 1.5px #2b2340; }
.br-pips i.on, .br-hp .mech i.on { background: #3ddc97; }
.br-hp .bug i.on { background: #ff5d73; }
.br-hp .rock i.on { background: #bdb8cf; }
.br-hp i.lose { background: #ffffff !important; animation: br-blink .45s infinite; }
.br-hp i.gain { background: #b6ffd8; }
.br-hp { -webkit-text-stroke: 0; font-size: clamp(12px, 1.25vw, 20px); display: flex; align-items: center; gap: 4px; }
.br-hp span { display: inline-flex; gap: 2px; background: rgba(43,35,64,.55); padding: 2px 4px; border-radius: 6px; }
.br-hp b { background: #ff3b54; color: #fff; border-radius: 50%; width: 1.25em; height: 1.25em; display: inline-flex; align-items: center; justify-content: center;
  font-size: .8em; box-shadow: 0 0 0 2px #fff; }
.br-pv { font-size: clamp(14px, 1.6vw, 26px); -webkit-text-stroke: 0.2em #fff; }
.br-pv.pv-dmg, .br-pv.pv-bad { color: #e8243f; }
.br-pv.pv-poof { color: #9b3bd6; }
.br-pv.pv-power { color: #e07f00; }
.br-pv.pv-good { color: #16a46a; }
.br-pv.pv-bonk { color: #2b2340; font-size: clamp(12px, 1.3vw, 20px); }
.br-pv.pv-info { color: #5a5470; font-size: clamp(12px, 1.2vw, 18px); }
.br-fx { font-size: clamp(16px, 1.9vw, 30px); }
.br-fx.fx-dmg, .br-fx.fx-bad { color: #e8243f; }
.br-fx.fx-poof { color: #9b3bd6; }
.br-fx.fx-power { color: #e07f00; }
.br-fx.fx-good { color: #16a46a; }
.br-fx.fx-bonk, .br-fx.fx-info { color: #2b2340; }
.br-info { left: 1.2vw; bottom: 1.6vh; width: min(400px, 27vw); background: rgba(255,250,240,.96); border-radius: 18px; padding: 8px 14px;
  box-shadow: 0 4px 0 rgba(43,35,64,.2); font-size: clamp(12px, 1.2vw, 19px); font-weight: 600; line-height: 1.25; }
.br-info h4 { margin: 0 0 2px; font-size: 1.15em; display: flex; gap: 8px; align-items: center; }
.br-info h4 small { font-weight: 600; opacity: .7; font-size: .75em; }
.br-info p { margin: 2px 0; }
.br-hints { right: 1.2vw; bottom: 1.6vh; display: flex; flex-direction: column; align-items: flex-end; gap: 6px; font-weight: 600; font-size: clamp(12px, 1.15vw, 18px); }
.br-hints span { background: rgba(255,255,255,.92); border-radius: 999px; padding: 3px 12px; box-shadow: 0 3px 0 rgba(43,35,64,.18); white-space: nowrap; position: relative; overflow: hidden; }
.br-hints span.hold i { position: absolute; left: 0; top: 0; bottom: 0; background: rgba(255,216,74,.85); z-index: -1; }
.br-hints span.hold { z-index: 0; }
.br-hints span.warn { background: #ffd84a; }
.br-tip { left: 50%; bottom: 2vh; transform: translateX(-50%); width: min(640px, 40vw); background: #fffbe6; border: 4px solid #ffd84a; border-radius: 22px;
  padding: 10px 18px; font-weight: 600; font-size: clamp(14px, 1.55vw, 24px); line-height: 1.3; box-shadow: 0 6px 0 rgba(43,35,64,.2); text-align: center; }
.br-tip .ok { display: block; margin-top: 6px; font-size: .75em; opacity: .75; animation: br-blink 1.2s infinite; }
.br-banner { left: 50%; top: 15vh; transform: translate(-50%, 0); text-align: center; font-weight: 700; font-size: clamp(28px, 4.2vw, 68px); color: #ffd84a;
  paint-order: stroke fill; -webkit-text-stroke: 0.14em #2b2340; opacity: 0; transition: opacity .18s; white-space: nowrap; line-height: 1.05; }
.br-banner small { display: block; font-size: .38em; color: #fff; -webkit-text-stroke: 0.2em #2b2340; }
.br-banner.on { opacity: 1; }
.br-go { left: 50%; bottom: 3vh; transform: translateX(-50%); background: #fffbe6; border: 4px solid #ffd84a; border-radius: 999px; padding: 6px 34px;
  font-weight: 700; font-size: clamp(20px, 2.6vw, 40px); color: #2b2340; box-shadow: 0 6px 0 rgba(43,35,64,.2); opacity: .8; }
.br-go small { font-size: .5em; font-weight: 600; margin-left: 10px; opacity: .75; }
.br-go.on { background: #ffd84a; opacity: 1; animation: br-pulse .9s infinite; }
@keyframes br-pulse { 50% { transform: translateX(-50%) scale(1.06); } }
.br-card { left: 50%; top: 50%; transform: translate(-50%, -50%); background: rgba(255,250,240,.97); border-radius: 30px; text-align: center;
  padding: clamp(14px, 2.4vw, 34px) clamp(20px, 3.4vw, 56px); box-shadow: 0 10px 0 rgba(43,35,64,.25); width: min(860px, 92vw); max-height: 92vh; overflow: hidden; }
.br-card.side { left: 2vw; transform: translate(0, -50%); width: min(480px, 38vw); text-align: left; }
.br-card .logo { font-size: clamp(30px, 5vw, 78px); font-weight: 700; line-height: 1; color: #ffd84a; paint-order: stroke fill; -webkit-text-stroke: 0.13em #2b2340; }
.br-card h2 { margin: 0 0 6px; font-size: clamp(22px, 3vw, 46px); color: #9b5de5; line-height: 1.05; }
.br-card .sub { font-size: clamp(14px, 1.6vw, 25px); font-weight: 600; margin: 8px 0 14px; color: #3f8ea3; }
.br-card .opt { font-size: clamp(17px, 2vw, 31px); font-weight: 700; padding: 6px 22px; border-radius: 20px; margin: 6px auto; width: fit-content; max-width: 100%; }
.br-card .opt small { display: block; font-size: .52em; font-weight: 600; opacity: .8; max-width: 640px; }
.br-card .opt.on { background: #ffd84a; box-shadow: 0 4px 0 rgba(43,35,64,.2); }
.br-card .foot { margin-top: 12px; font-size: clamp(12px, 1.2vw, 18px); font-weight: 600; opacity: .8; }
.br-squads { display: flex; gap: 12px; justify-content: center; }
.br-squad { flex: 1; border-radius: 22px; padding: 10px 12px; background: rgba(43,35,64,.06); border: 4px solid transparent; text-align: left; }
.br-squad.on { border-color: #ffd84a; background: #fffbe6; }
.br-squad h3 { margin: 0 0 4px; font-size: clamp(16px, 1.8vw, 28px); }
.br-squad .medal { color: #e0a000; font-size: .8em; }
.br-squad p { margin: 0 0 6px; font-weight: 600; font-size: clamp(12px, 1.15vw, 18px); color: #3f8ea3; }
.br-squad .m { font-weight: 700; font-size: clamp(12px, 1.15vw, 18px); margin-top: 6px; display: flex; gap: 6px; align-items: baseline; }
.br-squad .m i { width: .8em; height: .8em; border-radius: 50%; background: var(--c); display: inline-block; box-shadow: 0 0 0 2px #2b2340 inset; flex: none; }
.br-squad .m small { font-weight: 600; opacity: .75; display: block; font-size: .85em; }
.br-isles { display: flex; gap: 10px; margin: 8px 0 12px; flex-wrap: wrap; }
.br-isle { flex: 1; min-width: 40%; border-radius: 16px; padding: 6px 10px; background: rgba(43,35,64,.06); font-weight: 700; font-size: clamp(12px, 1.15vw, 18px); }
.br-isle.on { background: #fffbe6; box-shadow: 0 0 0 3px #ffd84a inset; }
.br-isle.done { background: #dff8ea; }
.br-isle .dots { display: flex; gap: 5px; margin-top: 4px; }
.br-isle .dots i { width: 14px; height: 14px; border-radius: 50%; background: #d9d4e8; display: block; }
.br-isle .dots i.done { background: #3ddc97; }
.br-isle .dots i.now { background: #ffd84a; box-shadow: 0 0 0 2px #2b2340; animation: br-blink 1.2s infinite; }
.br-row { display: flex; justify-content: space-between; gap: 12px; font-weight: 700; font-size: clamp(14px, 1.5vw, 23px); margin: 4px 0; text-align: left; }
.br-row.miss { opacity: .5; }
.br-row b { color: #e0a000; white-space: nowrap; }
.br-shop { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; text-align: left; }
.br-shop .col { border-radius: 18px; padding: 8px; background: rgba(43,35,64,.05); }
.br-shop .col h3 { margin: 0 0 6px; font-size: clamp(14px, 1.5vw, 22px); display: flex; gap: 6px; align-items: center; }
.br-shop .col h3 i { width: .8em; height: .8em; border-radius: 50%; background: var(--c); display: inline-block; box-shadow: 0 0 0 2px #2b2340 inset; }
.br-shop .up { border-radius: 12px; padding: 4px 8px; margin: 3px 0; font-weight: 600; font-size: clamp(11px, 1.05vw, 16px); display: flex; justify-content: space-between; gap: 6px; border: 3px solid transparent; }
.br-shop .up.on { border-color: #ffd84a; background: #fffbe6; }
.br-shop .up.got { background: #dff8ea; }
.br-shop .up.lock { opacity: .5; }
.br-shop .up b { white-space: nowrap; color: #e0a000; }
.br-shop .desc { grid-column: 1 / -1; min-height: 1.4em; font-weight: 600; font-size: clamp(13px, 1.3vw, 20px); text-align: center; }
.br-stars { font-weight: 700; font-size: clamp(16px, 1.8vw, 28px); margin: 4px 0 8px; }
.br-stars b { color: #e0a000; }
@keyframes br-blink { 50% { opacity: .35; } }
@keyframes br-shake { 20% { transform: translateX(-6px); } 40% { transform: translateX(6px); } 60% { transform: translateX(-4px); } 80% { transform: translateX(3px); } }
`;

function injectCss() {
  if (document.getElementById('br-css')) return;
  const el = document.createElement('style');
  el.id = 'br-css';
  el.textContent = CSS;
  document.head.appendChild(el);
}

export class BreachHud {
  constructor(ui) {
    injectCss();
    this.ui = ui;
    this.layer = ui.label('br-layer');
    this.layer.innerHTML = `<div class="br-top"></div><div class="br-roster"></div><div class="br-info"></div><div class="br-hints"></div>
      <div class="br-tip"></div><div class="br-go"></div><div class="br-banner"></div><div class="br-card"></div>`;
    const q = (c) => this.layer.querySelector(c);
    this.top = q('.br-top'); this.roster = q('.br-roster'); this.info = q('.br-info'); this.hints = q('.br-hints');
    this.tip = q('.br-tip'); this.go = q('.br-go'); this.bannerEl = q('.br-banner'); this.card = q('.br-card');
    this.cache = {};
    for (const k of ['top', 'roster', 'info', 'hints', 'tip', 'go', 'card']) this.set(k, null);
  }

  /** Set an element's html (null hides it); only touches the DOM when it changed. */
  set(key, html, cls = null) {
    const el = this[key];
    const c = `${cls}|${html}`;
    if (this.cache[key] === c) return;
    this.cache[key] = c;
    if (html === null || html === undefined) { el.style.display = 'none'; return; }
    el.style.display = '';
    el.innerHTML = html;
    if (cls !== null) el.className = cls;
  }

  setCard(html, side = false) {
    this.set('card', html, side ? 'br-card side' : 'br-card');
  }

  setTip(text, ok = '') {
    this.set('tip', text ? `${esc(text)}${ok ? `<span class="ok">${esc(ok)}</span>` : ''}` : null);
  }

  /** The deploy step's big Start! button (null hides it); on = it has the focus. */
  setGo(text, on = false) {
    this.set('go', text ? esc(text) : null, on ? 'br-go on' : 'br-go');
  }

  setHints(list) {
    this.set('hints', list?.length ? list.map((h) => (typeof h === 'string' ? `<span>${esc(h)}</span>`
      : `<span class="${h.cls || ''}">${h.hold !== undefined ? `<i style="width:${Math.round(h.hold * 100)}%"></i>` : ''}${esc(h.text)}</span>`)).join('') : null);
  }

  /** A big message near the top of the screen (above the board's middle, where preview labels are). */
  banner(title, sub = '', ms = 1300) {
    this.bannerEl.innerHTML = `${esc(title)}${sub ? `<small>${esc(sub)}</small>` : ''}`;
    this.bannerEl.classList.add('on');
    this.bannerT = Math.min(ms, 1400) * 0.75 / 1000; // short: it fades quickly
  }

  update(dt) {
    if (this.bannerT > 0) { this.bannerT -= dt; if (this.bannerT <= 0) this.bannerEl.classList.remove('on'); }
  }

  flashPower() {
    const el = this.top.querySelector('.br-power');
    if (!el) return;
    el.classList.remove('flash');
    void el.offsetWidth;
    el.classList.add('flash');
  }

  hideBattle() {
    for (const k of ['top', 'roster', 'info', 'hints', 'tip', 'go']) this.set(k, null);
  }

  dispose() {
    this.layer.remove();
  }
}

export { esc };
