import { now, HOUR } from './save.js';
import { seasonOf, festivalOn, rainyOn, SEASON_ICON } from './calendar.js';

// Playtest time machine for the solo island (not for kids, so it stays hidden):
// open the site once with ?dev in the address to turn it on (?dev=0 turns it off again),
// then F9 shows a small panel that moves the island clock forward to any hour, day, season,
// festival or rainy day. It only shifts window.__islandTimeOffset (see save.js), which the
// island reads live, and remembers the shift in this browser until "Real time" is pressed.

const ON_KEY = 'couch.dev';
const OFFSET_KEY = 'couch.dev.offset';
const DAY = 24 * HOUR;

function read(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function write(key, value) {
  try { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value); } catch { /* storage unavailable */ }
}

function enabled() {
  const q = new URLSearchParams(location.search);
  if (q.has('dev')) write(ON_KEY, q.get('dev') === '0' ? null : '1');
  return read(ON_KEY) === '1';
}

function setOffset(ms) {
  window.__islandTimeOffset = ms;
  write(OFFSET_KEY, ms ? String(ms) : null);
}

/** Move the clock forward by ms (forward keeps crops and animals growing as if time passed). */
function forward(ms) {
  setOffset((Number(window.__islandTimeOffset) || 0) + ms);
}

/** Forward to the next time the island clock shows hour h. */
function toHour(h) {
  const d = new Date(now());
  const target = new Date(d);
  target.setHours(h, 0, 0, 0);
  if (target.getTime() <= d.getTime()) target.setDate(target.getDate() + 1);
  forward(target.getTime() - d.getTime());
}

/** Forward day by day (keeping the time of day) until test(ms) is true, at most 60 days. */
function toDay(test) {
  const t0 = now();
  for (let i = 1; i <= 60; i++) if (test(t0 + i * DAY)) return forward(i * DAY);
}

const fmt = (ms) => new Date(ms).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

function mount() {
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;right:12px;top:60px;z-index:9999;background:#1d1830ee;color:#fff;font:13px/1.35 system-ui,sans-serif;'
    + 'padding:10px 12px;border-radius:12px;width:250px;display:none;box-shadow:0 6px 24px #0008';
  const btn = (label, fn) => {
    const b = document.createElement('button');
    b.textContent = label;
    b.style.cssText = 'margin:2px;padding:4px 7px;border:0;border-radius:7px;background:#ffd84a;color:#2b2340;font:600 12px system-ui;cursor:pointer';
    b.onclick = (e) => { e.stopPropagation(); fn(); render(); b.blur(); };
    return b;
  };
  const info = document.createElement('div');
  const row = (title, buttons) => {
    const r = document.createElement('div');
    r.style.marginTop = '6px';
    r.innerHTML = `<div style="opacity:.7;font-size:11px">${title}</div>`;
    for (const b of buttons) r.appendChild(b);
    el.appendChild(r);
  };
  el.innerHTML = '<b>Time machine</b> <span style="opacity:.6">(F9 · F10: voices)</span>';
  el.appendChild(info);
  row('Go to the next', [6, 9, 12, 15, 18, 21, 0, 3].map((h) => btn(`${String(h).padStart(2, '0')}:00`, () => toHour(h))));
  row('Skip ahead', [btn('+1 h', () => forward(HOUR)), btn('+6 h', () => forward(6 * HOUR)), btn('+1 day', () => forward(DAY)), btn('+1 week', () => forward(7 * DAY))]);
  row('Next day with', [
    btn('new season', () => { const s = seasonOf(); toDay((ms) => seasonOf(ms) !== s); }),
    btn('festival', () => toDay((ms) => !!festivalOn(ms) && festivalOn(ms) !== festivalOn())),
    btn('rain/snow', () => toDay((ms) => rainyOn(ms))),
  ]);
  row('', [btn('Real time', () => setOffset(0))]);
  document.body.appendChild(el);

  function render() {
    const at = now(), off = Number(window.__islandTimeOffset) || 0;
    const s = seasonOf(at), f = festivalOn(at);
    info.innerHTML = `<div style="margin-top:4px">${fmt(at)}</div>`
      + `<div>${SEASON_ICON[s]} ${s}${f ? ` · ${f}` : ''}${rainyOn(at) ? ` · ${s === 'winter' ? 'snow' : 'rain'}` : ''}</div>`
      + `<div style="opacity:.6">${off ? `+${(off / DAY).toFixed(2)} days from real time` : 'real time'}</div>`;
  }
  window.addEventListener('keydown', (e) => {
    if (e.code !== 'F9') return;
    e.preventDefault();
    el.style.display = el.style.display === 'none' ? 'block' : 'none';
    render();
  });
  setInterval(() => { if (el.style.display !== 'none') render(); }, 1000);
}

if (typeof window !== 'undefined' && enabled()) {
  const saved = Number(read(OFFSET_KEY)) || 0;
  if (saved && !window.__islandTimeOffset) window.__islandTimeOffset = saved;
  if (document.body) mount(); else window.addEventListener('DOMContentLoaded', mount);
}
