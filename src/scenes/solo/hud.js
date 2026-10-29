import { t } from '../../core/i18n.js';
import { esc } from '../../core/ui.js';
import { icon } from './items.js';

// HTML overlay for the solo island: clock and coins, the task list, the hotbar, the action prompt, the
// dialog box, and the shop / letter panels. Lives in the shared label layer (UI.clear() removes it).

const CSS = `
.isl-layer { position: absolute; inset: 0; pointer-events: none; font-family: var(--font); color: var(--ink, #2b2340); }
.isl-layer > * { position: absolute; }
.isl-ico { width: 100%; height: 100%; display: block; }
.isl-top { left: 1.2vw; top: 1.2vh; display: flex; gap: 10px; align-items: center; }
.isl-pill { display: flex; align-items: center; gap: 8px; background: rgba(255,255,255,.93); border-radius: 999px; padding: 4px 14px 4px 8px;
  font-weight: 700; font-size: clamp(15px, 1.5vw, 24px); box-shadow: 0 3px 0 rgba(43,35,64,.2); white-space: nowrap; }
.isl-pill .i { width: 1.4em; height: 1.4em; }
.isl-pill small { font-weight: 600; opacity: .65; font-size: .75em; }
.isl-sun { width: 1.3em; height: 1.3em; border-radius: 50%; background: #ffd23f; box-shadow: 0 0 0 3px rgba(255,210,63,.35); }
.isl-sun.moon { background: #e9e2ff; box-shadow: inset -5px -2px 0 #b9b0e0, 0 0 0 3px rgba(233,226,255,.3); }
.isl-tasks { right: 1.2vw; top: 1.2vh; width: min(340px, 30vw); background: rgba(255,250,240,.92); border-radius: 16px; padding: 8px 14px 10px;
  box-shadow: 0 4px 0 rgba(43,35,64,.2); font-size: clamp(12px, 1.05vw, 17px); font-weight: 600; line-height: 1.25; }
.isl-tasks b { display: block; font-size: 1.05em; margin-bottom: 4px; color: #8a5a32; }
.isl-tasks div { margin: 4px 0; padding-left: 1.1em; position: relative; }
.isl-tasks div::before { content: ''; position: absolute; left: 0; top: .35em; width: .65em; height: .65em; border-radius: 3px; border: 2px solid #8a5a32; }
.isl-tasks div.new { animation: isl-pop .6s; }
@keyframes isl-pop { 30% { transform: scale(1.08); background: #fff3a8; } }
.isl-hotbar { left: 50%; bottom: 1.4vh; transform: translateX(-50%); display: flex; gap: 6px; background: rgba(43,35,64,.55); padding: 6px; border-radius: 18px; }
.isl-slot { width: clamp(42px, 4.2vw, 64px); height: clamp(42px, 4.2vw, 64px); border-radius: 12px; background: rgba(255,250,240,.9); position: relative; padding: 6px; box-sizing: border-box; }
.isl-more { color: #fff; font-weight: 700; align-self: center; padding: 0 2px; }
.isl-slot.on { background: #ffd84a; box-shadow: 0 0 0 3px #fff; transform: translateY(-4px); }
.isl-slot .n { position: absolute; right: 3px; bottom: 0; font-weight: 700; font-size: clamp(11px, 1vw, 16px); paint-order: stroke fill; -webkit-text-stroke: .25em #fff; }
.isl-slot .k { position: absolute; left: 4px; top: 1px; font-size: 10px; font-weight: 700; opacity: .5; }
.isl-selname { left: 50%; bottom: calc(1.4vh + clamp(56px, 5.4vw, 80px)); transform: translateX(-50%); font-weight: 700; font-size: clamp(13px, 1.25vw, 20px);
  color: #fff; paint-order: stroke fill; -webkit-text-stroke: .2em #2b2340; white-space: nowrap; }
.isl-prompt { left: 50%; bottom: calc(1.4vh + clamp(84px, 8vw, 118px)); transform: translateX(-50%); background: rgba(255,255,255,.95); border-radius: 999px;
  padding: 4px 16px; font-weight: 700; font-size: clamp(14px, 1.4vw, 22px); box-shadow: 0 3px 0 rgba(43,35,64,.22); white-space: nowrap; }
.isl-keys { left: 1.2vw; bottom: 1.4vh; max-width: 26vw; font-weight: 600; font-size: clamp(11px, .95vw, 15px); background: rgba(255,255,255,.85); border-radius: 12px; padding: 4px 10px; }
.isl-bagtip { left: 50%; bottom: calc(1.4vh + clamp(84px, 8vw, 118px)); transform: translateX(-50%); background: #ffd84a; border-radius: 999px; padding: 4px 16px; font-weight: 700;
  font-size: clamp(13px, 1.2vw, 19px); white-space: nowrap; box-shadow: 0 3px 0 rgba(43,35,64,.22); }
.isl-dialog { left: 50%; bottom: calc(1.4vh + clamp(64px, 6vw, 88px)); transform: translateX(-50%); width: min(940px, 90vw); background: rgba(255,250,240,.97); border-radius: 22px;
  border: 4px solid var(--c, #2b2340); padding: 14px 22px 12px; box-shadow: 0 8px 0 rgba(43,35,64,.25); font-size: clamp(17px, 1.9vw, 30px); font-weight: 600; line-height: 1.3; box-sizing: border-box; }
.isl-dialog .who { position: absolute; top: -0.95em; left: 18px; background: var(--c, #2b2340); color: #fff; border-radius: 999px; padding: 1px 14px; font-size: .62em; font-weight: 700; display: flex; gap: 6px; align-items: center; }
.isl-dialog .who .hs { display: inline-flex; gap: 1px; }
.isl-dialog .who .hs svg { width: .85em; height: .85em; }
.isl-dialog .more { position: absolute; right: 16px; bottom: 6px; font-size: .6em; opacity: .75; animation: isl-blink 1s infinite; }
.isl-dialog .choices { display: flex; gap: 18px; margin-top: 8px; font-size: .85em; }
.isl-dialog .choices span { padding: 2px 16px; border-radius: 999px; }
.isl-dialog .choices span.on { background: #ffd84a; box-shadow: 0 3px 0 rgba(43,35,64,.2); }
@keyframes isl-blink { 50% { opacity: .2; } }
.isl-panel { left: 50%; top: 50%; transform: translate(-50%, -50%); width: min(760px, 92vw); max-height: 86vh; overflow: hidden; background: rgba(255,250,240,.98);
  border-radius: 26px; border: 4px solid #8a5a32; box-shadow: 0 10px 0 rgba(43,35,64,.3); padding: 18px 24px; box-sizing: border-box; font-weight: 600; }
.isl-panel h2 { margin: 0 0 8px; text-align: center; font-size: clamp(22px, 2.6vw, 38px); color: #8a5a32; }
.isl-tabs { display: flex; justify-content: center; gap: 12px; margin-bottom: 10px; }
.isl-tabs span { padding: 3px 22px; border-radius: 999px; background: rgba(138,90,50,.15); font-weight: 700; font-size: clamp(15px, 1.5vw, 22px); }
.isl-tabs span.on { background: #ffd84a; box-shadow: 0 3px 0 rgba(43,35,64,.2); }
.isl-rows { display: grid; gap: 6px; }
.isl-row { display: grid; grid-template-columns: clamp(34px, 3.2vw, 46px) 1fr auto auto; gap: 12px; align-items: center; padding: 4px 12px; border-radius: 14px; font-size: clamp(14px, 1.4vw, 21px); }
.isl-row.on { background: #ffd84a; box-shadow: 0 3px 0 rgba(43,35,64,.18); }
.isl-row small { opacity: .65; font-size: .78em; }
.isl-row .p { display: flex; align-items: center; gap: 4px; font-weight: 700; }
.isl-row .p svg { width: 1.2em; height: 1.2em; }
.isl-foot { text-align: center; margin-top: 10px; opacity: .8; font-size: clamp(12px, 1.15vw, 17px); }
.isl-loggrid { display: grid; grid-template-columns: repeat(8, 1fr); gap: 6px; }
.isl-logcell { background: rgba(138,90,50,.1); border-radius: 12px; padding: 4px; text-align: center; font-size: clamp(10px, .9vw, 14px); font-weight: 700; }
.isl-logcell img { width: 100%; aspect-ratio: 1; display: block; }
.isl-logcell.on { background: #ffd84a; box-shadow: 0 3px 0 rgba(43,35,64,.2); }
.isl-cal { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; }
.isl-calh { text-align: center; font-weight: 700; opacity: .6; font-size: clamp(11px, 1vw, 15px); }
.isl-cald { background: rgba(138,90,50,.08); border-radius: 8px; min-height: clamp(34px, 4.4vh, 56px); padding: 2px 4px; font-size: clamp(10px, .85vw, 13px); line-height: 1.1; overflow: hidden; }
.isl-cald b { display: block; font-size: 1.15em; }
.isl-cald.on { background: #ffd84a; box-shadow: 0 0 0 2px #8a5a32; }
.isl-cald i { display: block; font-style: normal; font-weight: 700; }
.isl-cald i.f { color: #b5179e; } .isl-cald i.b { color: #d9583a; } .isl-cald i.r { color: #3f8fd6; display: inline; }
.isl-letter { font-size: clamp(16px, 1.75vw, 26px); line-height: 1.4; background: repeating-linear-gradient(#fffaf0 0 1.38em, #f0e2c8 1.38em 1.42em); padding: 8px 14px; border-radius: 10px; }
.isl-letter .from { text-align: right; font-style: italic; margin-top: 6px; }
.isl-gifts { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; margin-top: 12px; }
.isl-gifts div { display: flex; align-items: center; gap: 6px; background: #fff; border-radius: 999px; padding: 3px 12px 3px 4px; box-shadow: 0 3px 0 rgba(43,35,64,.15); font-size: clamp(13px, 1.3vw, 19px); }
.isl-gifts svg { width: 1.8em; height: 1.8em; }
.label.isl-tag { background: rgba(255,255,255,.92); color: #2b2340; border-radius: 999px; padding: 2px 12px; font-weight: 700; font-size: clamp(12px, 1.15vw, 18px); text-align: center; white-space: nowrap; }
.label.isl-tag small { display: block; font-weight: 600; opacity: .7; font-size: .8em; }
.label.isl-tag .hs { display: inline-flex; gap: 1px; vertical-align: -2px; margin-left: 4px; }
.label.isl-tag .hs svg { width: .8em; height: .8em; }
.label.isl-mark { font-size: clamp(22px, 2.4vw, 36px); font-weight: 700; color: #ffd84a; paint-order: stroke fill; -webkit-text-stroke: .16em #2b2340; animation: isl-bob 1s infinite; }
.label.isl-zzz { font-size: clamp(16px, 1.6vw, 24px); font-weight: 700; color: #fff; paint-order: stroke fill; -webkit-text-stroke: .16em #5a4d7a; animation: isl-bob 2s infinite; }
@keyframes isl-bob { 50% { margin-top: -6px; } }
`;

export function injectHudStyle() { injectStyle(); }

function injectStyle() {
  if (document.getElementById('isl-style')) return;
  const el = document.createElement('style');
  el.id = 'isl-style';
  el.textContent = CSS;
  document.head.appendChild(el);
}

const THREE_clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const div = (cls, parent) => {
  const el = document.createElement('div');
  el.className = cls;
  parent.appendChild(el);
  return el;
};

export function heartsHtml(n, max = 10) {
  let s = '<span class="hs">';
  for (let i = 0; i < max; i++) s += icon(i < n ? 'heart' : 'heartEmpty');
  return `${s}</span>`;
}

export class IslandHud {
  constructor(game) {
    injectStyle();
    this.root = div('isl-layer', game.ui.labels);
    this.top = div('isl-top', this.root);
    this.tasks = div('isl-tasks', this.root);
    this.keys = div('isl-keys', this.root);
    this.prompt = div('isl-prompt', this.root);
    this.selname = div('isl-selname', this.root);
    this.hotbar = div('isl-hotbar', this.root);
    this.dialog = div('isl-dialog', this.root);
    this.panel = div('isl-panel', this.root);
    this.cache = {};
    this.show(this.dialog, false);
    this.show(this.panel, false);
    this.show(this.prompt, false);
  }

  show(el, on) { el.style.display = on ? '' : 'none'; }

  set(name, el, html) {
    if (this.cache[name] === html) return;
    this.cache[name] = html;
    el.innerHTML = html;
  }

  setVisible(on) { this.root.style.display = on ? '' : 'none'; }

  /** Cut-scene look (boat trip, Lamp Festival): only the dialog and the prompt stay. */
  setCinema(on) {
    for (const el of [this.top, this.tasks, this.keys, this.hotbar, this.selname]) el.style.visibility = on ? 'hidden' : '';
  }

  setTop({ time, night, coins, phase }) {
    this.set('top', this.top, `<div class="isl-pill"><span class="isl-sun ${night ? 'moon' : ''}"></span>${esc(time)}<small>${esc(phase)}</small></div>
      <div class="isl-pill"><span class="i">${icon('coin')}</span>${coins}</div>`);
  }

  setTasks(list) {
    this.show(this.tasks, list.length > 0);
    const html = `<b>${esc(t('isl.tasks'))}</b>${list.map((s) => `<div>${esc(s)}</div>`).join('')}`;
    if (this.cache.tasks !== html && this.cache.tasks) {
      this.set('tasks', this.tasks, html);
      this.tasks.lastElementChild?.classList.add('new');
    } else this.set('tasks', this.tasks, html);
  }

  setKeys(text) { this.set('keys', this.keys, esc(text)); }

  setPrompt(text) {
    this.show(this.prompt, !!text);
    if (text) this.set('prompt', this.prompt, esc(text));
  }

  setHotbar(all, sel, open, note = null) {
    // long bags scroll: show a window of slots around the selection
    const W = 11;
    const start = all.length > W ? THREE_clamp(sel - Math.floor(W / 2), 0, all.length - W) : 0;
    const items = all.slice(start, start + W);
    const more = `${start > 0 ? '<div class="isl-more">◀</div>' : ''}`;
    const more2 = `${start + W < all.length ? '<div class="isl-more">▶</div>' : ''}`;
    sel -= start;
    const html = more + items.map((it, j) => { const i = j + start; return `<div class="isl-slot ${j === sel ? 'on' : ''}">${i < 9 ? `<span class="k">${i + 1}</span>` : ''}${icon(it.id)}${it.n > 1 || (it.kind !== 'tool' && it.kind !== 'book') ? `<span class="n">${it.n}</span>` : ''}</div>`; }).join('') + more2;
    this.set('hotbar', this.hotbar, html);
    const cur = items[sel];
    this.set('selname', this.selname, cur ? esc(open ? `${cur.name} · ${note ?? t('isl.bag')}` : cur.name) : '');
    this.hotbar.style.boxShadow = open ? '0 0 0 4px #ffd84a' : '';
  }

  setDialog(d) {
    this.show(this.dialog, !!d);
    if (!d) { this.cache.dialog = null; return; }
    const choices = d.choices ? `<div class="choices">${d.choices.map((c, i) => `<span class="${i === d.index ? 'on' : ''}">${esc(c)}</span>`).join('')}</div>` : '';
    this.dialog.style.setProperty('--c', d.css || '#2b2340');
    this.set('dialog', this.dialog, `${d.who ? `<div class="who">${esc(d.who)}${d.hearts !== undefined ? heartsHtml(d.hearts) : ''}</div>` : ''}${esc(d.text)}${choices}${d.choices ? '' : '<div class="more">▼</div>'}`);
  }

  setPanel(html) {
    this.show(this.panel, !!html);
    if (html) this.set('panel', this.panel, html);
    else this.cache.panel = null;
  }
}
