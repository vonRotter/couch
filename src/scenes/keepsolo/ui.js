import { t, tFor } from '../../core/i18n.js';
import { esc } from '../../core/ui.js';
import { say } from '../../core/voice.js';
import { RARITY_TEXT, RARITY_CSS, itemName, statLines, baseName, STATS, statsOf } from './items.js';
import { CLASS_IDS, CLASSES, B_MOVE, GLYPH, CLASS_COLOR, SKILLS, compareItem, isBetter, heroStats, armorCut, xpNeed } from './classes.js';
import { ACT_FLOORS, isDeep, deepDepth } from './acts.js';

// Pillow Keep Solo HTML overlay: the HUD (health, potions, level, skills, coins), the item cards
// with the "better / not better" comparison, the item and skill icons (little inline SVGs, so they
// look the same everywhere), the class picker and the hold-[C] menu. It lives in the shared label
// layer, so UI.clear() removes it when the scene changes.

const CSS = `
.ks-layer { position: absolute; inset: 0; z-index: 20; pointer-events: none; font-family: var(--font); color: var(--ink); }
.ks-layer > * { position: absolute; }
.ks-pill { background: rgba(255,255,255,.93); border-radius: 18px; padding: 5px 14px; box-shadow: 0 4px 0 rgba(43,35,64,.2); font-weight: 700;
  font-size: clamp(12px, 1.3vw, 21px); line-height: 1.15; }
.ks-hero { left: 1.2vw; bottom: 1.6vh; display: flex; flex-direction: column; gap: 6px; width: min(380px, 30vw); }
.ks-hero .row { display: flex; align-items: center; gap: 8px; }
.ks-glyph { width: 1.6em; height: 1.6em; border-radius: 50%; background: var(--c); color: #fff; display: inline-flex; align-items: center; justify-content: center;
  font-size: 1.1em; box-shadow: 0 0 0 3px #fff, 0 3px 0 3px rgba(43,35,64,.2); flex: none; }
.ks-bar { position: relative; flex: 1; height: 1.05em; border-radius: 1em; background: #e6defa; border: 3px solid #2b2340; overflow: hidden; }
.ks-bar > i { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 1em; }
.ks-bar > span { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: .72em; color: #2b2340; font-weight: 700;
  -webkit-text-stroke: .25em #fff; paint-order: stroke fill; }
.ks-hp { height: 1.5em; }
.ks-hp > i { background: linear-gradient(#ff8fa8, #ff3b6b); }
.ks-hp.low > i { animation: ks-blink .6s infinite; }
.ks-xp { height: .55em; border-width: 2px; }
.ks-xp > i { background: #ffb400; }
.ks-pots { display: flex; gap: 3px; align-items: center; }
.ks-pots svg { width: 1.5em; height: 1.5em; }
.ks-pots svg.empty { opacity: .25; filter: grayscale(1); }
.ks-acts { right: 1.2vw; bottom: 1.6vh; display: flex; gap: 10px; align-items: flex-end; }
.ks-act { width: clamp(64px, 6.4vw, 100px); background: rgba(255,255,255,.93); border-radius: 18px; padding: 6px 4px 5px; text-align: center;
  box-shadow: 0 4px 0 rgba(43,35,64,.2); font-weight: 700; font-size: clamp(10px, .95vw, 15px); line-height: 1.1; position: relative; overflow: hidden; }
.ks-act svg { width: 58%; height: auto; display: block; margin: 0 auto 2px; }
.ks-act .key { display: block; font-size: .9em; opacity: .7; }
.ks-act .cd { position: absolute; left: 0; right: 0; bottom: 0; background: rgba(43,35,64,.35); }
.ks-act.off { opacity: .5; }
.ks-act.sel { box-shadow: 0 0 0 4px #ffd23f, 0 4px 0 4px rgba(43,35,64,.2); }
.ks-hint { right: 1.2vw; bottom: calc(1.6vh + clamp(90px, 9vw, 140px)); font-weight: 600; font-size: clamp(11px, 1vw, 16px); background: rgba(255,255,255,.88);
  border-radius: 999px; padding: 3px 12px; box-shadow: 0 3px 0 rgba(43,35,64,.18); }
.ks-money { right: 1.2vw; top: 1.4vh; display: flex; gap: 8px; }
.ks-bagnote { left: 1.2vw; top: 1.4vh; background: #fffbe6; border: 3px solid #ffd23f; }
.ks-coin { display: inline-block; width: .9em; height: .9em; border-radius: 50%; background: #ffd23f; box-shadow: inset 0 0 0 .14em #e0a100; vertical-align: -.1em; }
.ks-fluff { display: inline-block; width: 1em; height: .8em; border-radius: 50%; background: #fff; box-shadow: 0 0 0 2px #c9a8ff inset, .3em -.1em 0 -.05em #fff, .3em -.1em 0 .1em #c9a8ff; vertical-align: -.05em; margin-right: .3em; }
.ks-panel { left: 50%; top: 50%; transform: translate(-50%, -50%); background: #fffaf2; border-radius: 30px; padding: clamp(10px, 1.6vw, 24px) clamp(14px, 2vw, 30px);
  box-shadow: 0 10px 0 rgba(43,35,64,.22); max-width: 96vw; max-height: 96vh; font-weight: 600; font-size: clamp(12px, 1.15vw, 18px); text-align: center; }
.ks-panel h2 { margin: 0 0 6px; font-size: clamp(20px, 2.4vw, 38px); color: #8a45e0; line-height: 1.05; }
.ks-panel h2 small { display: block; font-size: .5em; color: #5a5470; font-weight: 600; margin-top: 2px; }
.ks-panel .foot { margin-top: 8px; font-size: .9em; opacity: .75; }
.ks-row { display: flex; gap: clamp(8px, 1.2vw, 18px); justify-content: center; align-items: flex-start; }
.ks-grid { display: grid; gap: 4px; }
.ks-cell { width: clamp(34px, 3.9vw, 60px); height: clamp(34px, 3.9vw, 60px); border-radius: 12px; background: #ece4f8; box-shadow: inset 0 3px 0 rgba(43,35,64,.08);
  position: relative; display: flex; align-items: center; justify-content: center; }
.ks-cell svg { width: 80%; height: 80%; }
.ks-cell.r0 { background: #f4f1ea; box-shadow: inset 0 0 0 3px #d6d0c4; }
.ks-cell.r1 { background: #e3eeff; box-shadow: inset 0 0 0 3px #5a9bff; }
.ks-cell.r2 { background: #fff6cc; box-shadow: inset 0 0 0 3px #ffc21a; }
.ks-cell.r3 { background: #ffe6cc; box-shadow: inset 0 0 0 3px #ff8c1a; }
.ks-cell.cur { outline: 4px solid #2b2340; outline-offset: 1px; z-index: 1; }
.ks-cell .up { position: absolute; right: 1px; top: -2px; color: #16a46a; font-size: 1.05em; -webkit-text-stroke: .2em #fff; paint-order: stroke fill; font-weight: 700; }
.ks-cell .plus { position: absolute; left: 3px; bottom: 0; font-size: .75em; font-weight: 700; color: #2b2340; }
.ks-cell .other { position: absolute; inset: 0; border-radius: 12px; background: rgba(43,35,64,.28); }
.ks-cell .slotname { font-size: .6em; opacity: .5; line-height: 1; padding: 2px; }
.ks-cell.empty svg { opacity: .22; filter: grayscale(1); }
.ks-label { font-size: .85em; opacity: .7; margin: 2px 0 4px; }
.ks-cards { display: flex; gap: 10px; justify-content: center; margin-top: 8px; min-height: clamp(110px, 13vw, 190px); }
.ks-card { width: clamp(200px, 22vw, 330px); background: #fff; border-radius: 18px; padding: 8px 12px; text-align: left; box-shadow: 0 3px 0 rgba(43,35,64,.15);
  border: 3px solid #e6defa; line-height: 1.25; }
.ks-card h4 { margin: 0; font-size: 1.1em; line-height: 1.1; }
.ks-card .sub { font-size: .8em; opacity: .7; margin-bottom: 4px; }
.ks-card .st { display: flex; justify-content: space-between; gap: 6px; font-size: .92em; }
.ks-card .st b.good { color: #16a46a; } .ks-card .st b.bad { color: #e8243f; }
.ks-card .pow { color: #e06a00; font-size: .88em; margin-top: 3px; }
.ks-verdict { font-weight: 700; font-size: 1.1em; margin-top: 4px; }
.ks-verdict.good { color: #16a46a; } .ks-verdict.bad { color: #8a8399; }
.ks-list { display: flex; flex-direction: column; gap: 6px; min-width: min(560px, 80vw); text-align: left; }
.ks-item { background: #fff; border-radius: 16px; padding: 7px 12px; box-shadow: 0 3px 0 rgba(43,35,64,.12); border: 3px solid transparent; display: flex; gap: 10px; align-items: center; }
.ks-item.cur { border-color: #2b2340; background: #fffbe6; }
.ks-item.off { opacity: .5; }
.ks-item .grow { flex: 1; }
.ks-item small { display: block; font-size: .78em; opacity: .7; font-weight: 600; }
.ks-item svg { width: 2.2em; height: 2.2em; flex: none; }
.ks-prog { display: inline-block; width: 6em; height: .6em; border-radius: 1em; background: #e6defa; overflow: hidden; vertical-align: middle; }
.ks-prog i { display: block; height: 100%; background: #3ddc97; }
.ks-classes { display: flex; gap: clamp(8px, 1.4vw, 22px); justify-content: center; }
.ks-class { width: clamp(150px, 19vw, 280px); background: #fff; border-radius: 22px; padding: 12px; border: 4px solid transparent; box-shadow: 0 4px 0 rgba(43,35,64,.15); }
.ks-class.cur { border-color: var(--c); background: #fffbe6; transform: translateY(-6px); }
.ks-class .big { font-size: 2.6em; color: var(--c); line-height: 1; -webkit-text-stroke: .05em #2b2340; }
.ks-class h3 { margin: 4px 0 2px; font-size: 1.25em; }
.ks-class p { margin: 2px 0; font-size: .85em; opacity: .8; }
.ks-class .save { margin-top: 6px; font-weight: 700; color: #8a45e0; }
.ks-menu { min-width: min(420px, 80vw); }
.ks-gate { display: grid; grid-template-columns: repeat(5, auto); gap: 6px 8px; justify-content: center; }
.ks-gate .hd { font-size: .82em; font-weight: 700; color: #5a5470; max-width: 9em; line-height: 1.1; align-self: end; }
.ks-wp { background: #fff; border-radius: 14px; padding: 7px 10px; border: 3px solid transparent; box-shadow: 0 3px 0 rgba(43,35,64,.12); font-weight: 700; min-width: 7em; }
.ks-wp.cur { border-color: #2b2340; background: #fffbe6; }
.ks-wp.off { opacity: .35; }
.ks-wp.bag { box-shadow: 0 0 0 3px #ffd23f; }
.ks-wp small { display: block; font-weight: 600; font-size: .75em; opacity: .7; }
.ks-bubble { font-size: clamp(12px, 1.2vw, 19px); background: #fff; border-radius: 16px; padding: 6px 12px; box-shadow: 0 3px 0 rgba(43,35,64,.2); max-width: 22em;
  white-space: normal; -webkit-text-stroke: 0; font-weight: 600; line-height: 1.25; color: #2b2340; }
.ks-bubble b { color: #8a45e0; display: block; font-size: .85em; }
.ks-prompt { font-size: clamp(11px, 1.05vw, 17px); -webkit-text-stroke: .22em #fff; color: #2b2340; }
.ks-boss { display: flex; flex-direction: column; gap: 3px; padding: 6px 22px; }
@keyframes ks-blink { 50% { opacity: .45; } }
`;

// ---------------------------------------------------------------- icons

const svg = (body, vb = '0 0 40 40') => `<svg viewBox="${vb}" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;
const FILL = ['#fff3e6', '#7fb2ff', '#ffd23f', '#ff9a2e'];
const INK = '#2b2340';

/** A little picture of an item (by slot, class and rarity). */
export function itemIcon(item) {
  const f = item ? FILL[item.rarity] : '#d9d4e8';
  const slot = item ? item.slot : 'charm';
  return slotIcon(slot, item?.cls, f);
}

export function slotIcon(slot, cls, f = '#d9d4e8') {
  const s = `stroke="${INK}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"`;
  switch (slot) {
    case 'weapon':
      if (cls === 'archer') return svg(`<path d="M12 5 Q34 20 12 35" fill="none" ${s} stroke-width="4"/><path d="M12 5 Q34 20 12 35" fill="none" stroke="${f}" stroke-width="2"/><line x1="12" y1="5" x2="12" y2="35" stroke="${INK}" stroke-width="1.5"/><path d="M8 20 L30 20" ${s}/><path d="M30 20 l-5 -3 v6 z" fill="${f}" ${s}/>`);
      if (cls === 'wizard') return svg(`<line x1="10" y1="33" x2="26" y2="14" ${s} stroke-width="4"/><line x1="10" y1="33" x2="26" y2="14" stroke="#c98b5a" stroke-width="2"/><path d="M28 4 l2.5 6 6 .5 -4.6 4 1.5 6 -5.4 -3.2 -5.4 3.2 1.5 -6 -4.6 -4 6 -.5z" fill="${f}" ${s} stroke-width="2"/>`);
      return svg(`<rect x="5" y="11" width="30" height="18" rx="7" fill="${f}" ${s} transform="rotate(-20 20 20)"/><path d="M8 24 L32 15" stroke="#ff9fd0" stroke-width="3"/>`);
    case 'offhand':
      if (cls === 'archer') return svg(`<rect x="13" y="12" width="13" height="24" rx="4" fill="${f}" ${s}/><path d="M15 12 l-2 -8 4 3z M20 12 l0 -9 3 5z M25 12 l3 -8 0 6z" fill="#3ddc97" ${s} stroke-width="1.6"/>`);
      if (cls === 'wizard') return svg(`<circle cx="20" cy="21" r="13" fill="${f}" fill-opacity=".8" ${s}/><circle cx="15" cy="16" r="3.5" fill="#fff"/>`);
      return svg(`<circle cx="20" cy="20" r="15" fill="${f}" ${s}/><circle cx="20" cy="20" r="9" fill="none" stroke="#ff9fd0" stroke-width="2.5"/><circle cx="20" cy="20" r="3" fill="#fff3dc" ${s} stroke-width="1.5"/>`);
    case 'helmet': return svg(`<path d="M6 30 Q8 12 26 8 Q22 18 32 28 Z" fill="${f}" ${s}/><rect x="5" y="27" width="28" height="6" rx="3" fill="#ff9fd0" ${s}/><circle cx="27" cy="7" r="4" fill="#fff" ${s}/>`);
    case 'armor': return svg(`<path d="M12 6 L20 10 L28 6 L35 12 L31 19 L29 18 L29 35 L11 35 L11 18 L9 19 L5 12 Z" fill="${f}" ${s}/><path d="M20 10 V35" stroke="#ff9fd0" stroke-width="2.5"/>`);
    case 'gloves': return svg(`<path d="M11 34 L11 15 Q11 7 19 7 Q27 7 27 15 L27 20 L32 15 Q35 17 32 22 L27 29 L27 34 Z" fill="${f}" ${s}/><rect x="10" y="29" width="18" height="6" rx="2" fill="#ff9fd0" ${s}/>`);
    case 'boots': return svg(`<path d="M8 28 Q6 20 13 18 L15 9 L24 9 L24 20 Q34 21 34 28 Q34 33 26 33 L13 33 Q8 33 8 28 Z" fill="${f}" ${s}/><circle cx="14" cy="9" r="3.5" fill="#fff" ${s} stroke-width="1.5"/>`);
    case 'potion': return svg(`<path d="M15 5 h10 v7 Q34 16 33 26 Q32 36 20 36 Q8 36 7 26 Q6 16 15 12 Z" fill="#ff5d73" ${s}/><rect x="14" y="2" width="12" height="5" rx="2" fill="#c98b5a" ${s} stroke-width="1.6"/><path d="M20 30 l-6 -6 a3.5 3.5 0 0 1 6 -4 a3.5 3.5 0 0 1 6 4z" fill="#fff"/>`);
    default: return svg(`<path d="M30 4 Q12 10 10 30 L8 36 L13 31 Q32 26 30 4 Z" fill="${f}" ${s}/><path d="M10 31 Q18 20 27 9" fill="none" stroke="${INK}" stroke-width="1.6"/>`);
  }
}

/** Icons for the [C] skills and menu entries. */
export function skillIcon(id) {
  const s = `stroke="${INK}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"`;
  switch (id) {
    case 'spin': return svg(`<path d="M8 20 A12 12 0 1 1 20 32" fill="none" ${s} stroke-width="4"/><path d="M20 32 l-6 -3 6 -5z" fill="#ff5d73" ${s}/><rect x="15" y="15" width="10" height="10" rx="3" fill="#fff3e6" ${s}/>`);
    case 'rush': return svg(`<path d="M4 20 H26" ${s} stroke-width="5"/><path d="M24 10 L36 20 L24 30 Z" fill="#ff5d73" ${s}/><path d="M4 12 H14 M4 28 H14" ${s}/>`);
    case 'quake': return svg(`<circle cx="20" cy="22" r="5" fill="#ffd23f" ${s}/><circle cx="20" cy="22" r="11" fill="none" ${s}/><circle cx="20" cy="22" r="17" fill="none" ${s} stroke-dasharray="4 4"/>`);
    case 'cheer': return svg(`<path d="M20 3 l4.5 10.5 11 1 -8.4 7.3 2.6 11 -9.7 -5.8 -9.7 5.8 2.6 -11 -8.4 -7.3 11 -1z" fill="#ffd23f" ${s}/>`);
    case 'fan': return svg(`<path d="M6 34 L18 6 M6 34 L28 10 M6 34 L34 20 M6 34 L34 32" ${s}/><circle cx="6" cy="34" r="3" fill="#3ddc97" ${s}/>`);
    case 'pierce': return svg(`<path d="M4 20 H30" ${s} stroke-width="5"/><path d="M28 12 L38 20 L28 28 Z" fill="#ffd23f" ${s}/><path d="M4 20 l5 -6 M4 20 l5 6" ${s}/>`);
    case 'rain': return svg(`<path d="M10 6 v8 M20 4 v10 M30 6 v8 M14 18 v8 M26 18 v8" ${s}/><ellipse cx="20" cy="33" rx="15" ry="4" fill="#fff" ${s}/>`);
    case 'owl': return svg(`<ellipse cx="20" cy="22" rx="13" ry="14" fill="#b07848" ${s}/><circle cx="14" cy="19" r="5" fill="#fff" ${s}/><circle cx="26" cy="19" r="5" fill="#fff" ${s}/><circle cx="14" cy="19" r="2" fill="${INK}"/><circle cx="26" cy="19" r="2" fill="${INK}"/><path d="M18 25 l2 4 2 -4z" fill="#ffb020"/>`);
    case 'ring': return svg(Array.from({ length: 8 }, (_, i) => `<circle cx="${20 + Math.cos(i * 0.785) * 13}" cy="${20 + Math.sin(i * 0.785) * 13}" r="4" fill="#bfe9ff" ${s} stroke-width="1.8"/>`).join(''));
    case 'bomb': return svg(`<circle cx="20" cy="22" r="13" fill="#8fd8ff" fill-opacity=".8" ${s}/><circle cx="15" cy="17" r="3.5" fill="#fff"/><path d="M8 8 l4 4 M32 8 l-4 4 M20 2 v5" ${s}/>`);
    case 'cloud': return svg(`<path d="M10 30 Q2 30 4 22 Q6 15 13 17 Q15 8 24 10 Q32 10 32 18 Q38 19 37 25 Q36 30 30 30 Z" fill="#e6dcff" ${s}/><text x="13" y="27" font-size="10" font-weight="700" fill="${INK}" font-family="sans-serif">z z</text>`);
    case 'storm': return svg(`<circle cx="20" cy="20" r="4" fill="#9ff0ff" ${s}/><circle cx="30" cy="12" r="4" fill="#9ff0ff" ${s}/><circle cx="10" cy="28" r="4" fill="#9ff0ff" ${s}/><circle cx="30" cy="30" r="3" fill="#9ff0ff" ${s}/><circle cx="10" cy="10" r="3" fill="#9ff0ff" ${s}/>`);
    case 'potion': return slotIcon('potion');
    case 'portal': return svg(`<ellipse cx="20" cy="20" rx="12" ry="16" fill="#8fd8ff" ${s}/><path d="M20 10 Q28 16 20 22 Q14 26 20 30" fill="none" stroke="#fff" stroke-width="3"/>`);
    case 'bag': return svg(`<path d="M12 14 Q4 20 6 30 Q8 36 20 36 Q32 36 34 30 Q36 20 28 14 Z" fill="#c98b5a" ${s}/><path d="M14 14 L16 6 L24 6 L26 14" fill="#b07848" ${s}/><rect x="16" y="22" width="8" height="7" rx="2" fill="#ffd23f" ${s} stroke-width="1.6"/>`);
    case 'block': return slotIcon('offhand', 'knight', '#fff3e6');
    case 'roll': return svg(`<circle cx="18" cy="20" r="9" fill="#3ddc97" ${s}/><path d="M4 30 Q18 38 32 26" fill="none" ${s}/><path d="M32 26 l-6 0 3 -5z" fill="${INK}"/>`);
    case 'hop': return svg(`<circle cx="9" cy="28" r="5" fill="#bfe9ff" ${s} stroke-dasharray="3 3"/><circle cx="29" cy="14" r="7" fill="#bfe9ff" ${s}/><path d="M12 24 Q16 10 24 12" fill="none" ${s} stroke-dasharray="3 3"/>`);
    case 'attack.knight': return slotIcon('weapon', 'knight', '#fff3e6');
    case 'attack.archer': return slotIcon('weapon', 'archer', '#fff3e6');
    case 'attack.wizard': return slotIcon('weapon', 'wizard', '#fff3e6');
    case 'talk': return svg(`<path d="M6 8 H34 Q36 8 36 11 V24 Q36 27 33 27 H18 L10 34 L11 27 H7 Q4 27 4 24 V11 Q4 8 6 8 Z" fill="#fff" ${s}/><circle cx="13" cy="18" r="2" fill="${INK}"/><circle cx="20" cy="18" r="2" fill="${INK}"/><circle cx="27" cy="18" r="2" fill="${INK}"/>`);
    default: return svg(`<circle cx="20" cy="20" r="12" fill="#fff" ${s}/>`);
  }
}

// ---------------------------------------------------------------- item cards

/** Stat comparison card: `item` (maybe for another class) against `worn` in the same slot. */
export function itemCard(scene, item, { title = '', compare = true } = {}) {
  if (!item) return `<div class="ks-card" style="opacity:.4"><div class="sub">${esc(title)}</div><h4>${esc(t('ks.empty'))}</h4></div>`;
  const hs = scene.hs, cls = scene.cls;
  const worn = hs.gear[item.slot];
  const lines = statLines(item);
  const wornStats = worn && worn !== item ? statsOf(worn) : null;
  const rows = lines.map((l) => {
    let diff = '';
    if (compare && wornStats) {
      const d = l.v - (wornStats[l.k] || 0);
      if (Math.abs(d) > 1e-6) diff = ` <b class="${d > 0 ? 'good' : 'bad'}">${d > 0 ? '▲' : '▼'}</b>`;
    }
    return `<div class="st"><span>${esc(l.text)}</span>${diff}</div>`;
  });
  // stats the worn item has but this one lacks
  if (compare && wornStats) for (const k of STATS) if (wornStats[k] && !item.stats[k]) rows.push(`<div class="st" style="opacity:.6"><span>${esc(t('ks.statNone', { s: t(`ks.stat.${k}`) }))}</span> <b class="bad">▼</b></div>`);
  const forOther = item.cls && item.cls !== cls;
  const sub = `${esc(t(`ks.rarity.${item.rarity}`))} · ${esc(baseName(item))} · ${esc(t('ks.ilvl', { n: item.ilvl + 1 }))}${forOther ? ` · <b style="color:#e8243f">${esc(t('ks.forClass', { cls: t(`ks.cls.${item.cls}`) }))}</b>` : ''}`;
  let verdict = '';
  if (compare && worn !== item) {
    const delta = compareItem(cls, hs.level, hs.gear, item, scene.D);
    if (delta !== null) verdict = isBetter(delta) ? `<div class="ks-verdict good">▲ ${esc(t('ks.better'))}</div>` : `<div class="ks-verdict bad">${esc(t('ks.notBetter'))}</div>`;
  }
  const pow = item.power ? `<div class="pow">★ ${esc(t(`ks.power.${item.power}`))}</div>` : '';
  return `<div class="ks-card" style="border-color:${RARITY_CSS[item.rarity]}"><div class="sub">${esc(title)}</div><h4 style="color:${RARITY_TEXT[item.rarity]}">${esc(itemName(item))}</h4>
    <div class="sub">${sub}</div>${rows.join('')}${pow}${verdict}</div>`;
}

/** One cell of an item grid. */
export function cellHtml(scene, item, { cur = false, slot = null, upArrow = true } = {}) {
  if (!item) return `<div class="ks-cell empty ${cur ? 'cur' : ''}">${slot ? slotIcon(slot, scene.cls) : ''}</div>`;
  const delta = upArrow ? compareItem(scene.cls, scene.hs.level, scene.hs.gear, item, scene.D) : null;
  const up = upArrow && isBetter(delta) && scene.hs.gear[item.slot] !== item ? '<span class="up">▲</span>' : '';
  const other = item.cls && item.cls !== scene.cls ? '<span class="other"></span>' : '';
  return `<div class="ks-cell r${item.rarity} ${cur ? 'cur' : ''}">${itemIcon(item)}${other}${up}${item.plus ? `<span class="plus">+${item.plus}</span>` : ''}</div>`;
}

// ---------------------------------------------------------------- menu navigation

/** Stick steps for menus, with a repeat when a direction is held. */
export class Nav {
  constructor() { this.dx = 0; this.dy = 0; this.t = 0; }
  step(d, dt) {
    if (!d) return { x: 0, y: 0 };
    const hx = d.x > 0.5 ? 1 : d.x < -0.5 ? -1 : 0;
    const hy = d.y > 0.5 ? -1 : d.y < -0.5 ? 1 : 0; // +1 = down the list
    let x = d.stepX || 0, y = -(d.stepY || 0);
    if (hx || hy) {
      if (hx !== this.dx || hy !== this.dy) { this.dx = hx; this.dy = hy; this.t = 0; } else {
        this.t += dt;
        if (this.t > 0.38) { this.t -= 0.12; x = hx; y = hy; }
      }
    } else { this.dx = this.dy = 0; this.t = 0; }
    return { x, y };
  }
}

// ---------------------------------------------------------------- HUD

export class Hud {
  constructor(scene) {
    this.s = scene;
    this.layer = scene.game.ui.label('ks-layer');
    if (!document.getElementById('ks-css')) {
      const st = document.createElement('style');
      st.id = 'ks-css';
      st.textContent = CSS;
      document.head.appendChild(st);
    }
    this.layer.innerHTML = '<div class="ks-hero"></div><div class="ks-acts"></div><div class="ks-hint ks-pill"></div><div class="ks-money"></div><div class="ks-bagnote ks-pill"></div>';
    this.hero = this.layer.querySelector('.ks-hero');
    this.acts = this.layer.querySelector('.ks-acts');
    this.hint = this.layer.querySelector('.ks-hint');
    this.money = this.layer.querySelector('.ks-money');
    this.bagNote = this.layer.querySelector('.ks-bagnote');
    this.cache = {};
    this.visible = true;
  }

  set(el, key, html) {
    if (this.cache[key] === html) return;
    this.cache[key] = html;
    el.innerHTML = html;
  }

  show(on) {
    if (this.visible === on) return;
    this.visible = on;
    for (const el of [this.hero, this.acts, this.hint, this.money, this.bagNote]) el.style.display = on ? '' : 'none';
  }

  update() {
    const s = this.s, e = s.hero, hs = s.hs;
    if (!e || !hs) return;
    const p = s.player;
    const pct = Math.max(0, e.hp / e.st.maxHp);
    const xpPct = Math.min(100, Math.round(hs.xp / xpNeed(hs.level) * 100));
    const pots = Array.from({ length: hs.belt }, (_, i) => slotIcon('potion').replace('<svg', `<svg class="${i < hs.potions ? '' : 'empty'}"`)).join('');
    this.set(this.hero, 'hero', `<div class="row ks-pill"><span class="ks-glyph" style="--c:${CLASS_COLOR[s.cls]}">${GLYPH[s.cls]}</span><span>${esc(t(`ks.cls.${s.cls}`))} · ${esc(t('ks.lv', { n: hs.level }))}</span>
      <div class="ks-bar ks-xp"><i style="width:${xpPct}%"></i></div></div>
      <div class="row ks-pill"><div class="ks-bar ks-hp ${pct < 0.3 ? 'low' : ''}"><i style="width:${(pct * 100).toFixed(1)}%"></i><span>${Math.ceil(Math.max(0, e.hp))} / ${e.st.maxHp}</span></div></div>
      <div class="row ks-pill ks-pots">${pots}</div>`);
    // action buttons: [A], [B], [C]
    const town = s.kind === 'town';
    const sk = town ? null : s.selectedAction();
    const cdK = (left, full) => (left > 0 && full > 0 ? `<i class="cd" style="height:${Math.min(100, left / full * 100).toFixed(0)}%"></i>` : '');
    const bId = B_MOVE[s.cls];
    const cDef = sk && sk !== 'potion' ? SKILLS[s.cls].find((x) => x.id === sk) : null;
    const cLeft = cDef ? s.skillCd(e, sk) : sk === 'potion' ? Math.max(0, e.potCd) : 0;
    const cFull = cDef ? cDef.cd * (1 - e.st.cdr) : 1;
    const box = (key, icon, name, cd = '', cls = '') => `<div class="ks-act ${cls}">${icon}${esc(name)}<span class="key">${esc(tFor(p, key))}</span>${cd}</div>`;
    const aName = town ? t('ks.a.talk') : t(`ks.a.${s.cls}`);
    const html = box('ks.key.a', skillIcon(town ? 'talk' : `attack.${s.cls}`), aName)
      + box('ks.key.b', skillIcon(bId), t(`ks.b.${s.cls}`), s.cls === 'knight' ? '' : cdK(e.cdB, CLASSES[s.cls].cdB))
      + box('ks.key.c', skillIcon(sk || 'bag'), sk === 'potion' ? t('ks.m.potion') : sk ? t(`ks.skill.${sk}`) : t('ks.m.bag'), cdK(cLeft, cFull), sk === 'potion' && !hs.potions ? 'off' : '');
    this.set(this.acts, 'acts', html);
    this.set(this.hint, 'hint', esc(tFor(p, town ? 'ks.hintTown' : 'ks.hintDungeon')));
    this.set(this.money, 'money', `<span class="ks-pill"><span class="ks-coin"></span> ${hs.coins}</span><span class="ks-pill"><span class="ks-fluff"></span>${hs.fluff}</span>`);
    const drop = hs.drop;
    const note = drop ? esc(t('ks.bagNote', { where: whereText(drop.g) })) : '';
    this.set(this.bagNote, 'bag', note);
    this.bagNote.style.display = note && this.visible ? '' : 'none';
  }

  dispose() {
    this.layer.remove();
  }
}

/** "Act 2 · Floor 3" or "Deep Keep 7". */
export function whereText(g) {
  if (isDeep(g)) return t('ks.whereDeep', { n: deepDepth(g) });
  return t('ks.where', { act: Math.floor(g / ACT_FLOORS) + 1, floor: (g % ACT_FLOORS) + 1 });
}

/** Big stat summary of the hero (used in the bag panel). */
export function heroSummary(scene) {
  const st = heroStats(scene.cls, scene.hs.level, scene.hs.gear);
  const cut = Math.round(armorCut(st.armor, scene.D) * 100);
  return t('ks.summary', { dmg: Math.round(st.dmg), hp: st.maxHp, armor: Math.round(st.armor), cut, speed: Math.round((st.speed - 1) * 100), rate: Math.round((st.rate - 1) * 100) });
}

// ---------------------------------------------------------------- class picker

/** Choose a hero: three saves, one per class. */
export class ClassPicker {
  constructor(scene, onPick) {
    this.s = scene;
    this.onPick = onPick;
    this.i = CLASS_IDS.indexOf(scene.data.last);
    this.nav = new Nav();
    this.el = document.createElement('div');
    this.el.className = 'ks-panel';
    scene.hud.layer.appendChild(this.el);
    this.render();
    say(`${t('game.keepsolo')}. ${t('ks.pickSay')}`);
  }

  render() {
    const s = this.s;
    const cards = CLASS_IDS.map((cls, i) => {
      const h = s.data.classes[cls];
      const save = h.started ? t('ks.saveLine', { lv: h.level, where: whereText(h.reached) }) : t('ks.saveNew');
      const learn = SKILLS[cls].map((k) => `${t(`ks.skill.${k.id}`)} (${k.lv})`).join(', ');
      return `<div class="ks-class ${i === this.i ? 'cur' : ''}" style="--c:${CLASS_COLOR[cls]}"><div class="big">${GLYPH[cls]}</div><h3>${esc(t(`ks.cls.${cls}`))}</h3>
        <p>${esc(tFor(s.player, `ks.desc.${cls}`))}</p><p style="opacity:.6">${esc(t('ks.learns', { list: learn }))}</p><div class="save">${esc(save)}</div></div>`;
    }).join('');
    this.el.innerHTML = `<h2>${esc(t('game.keepsolo'))}<small>${esc(t('ks.pick'))}</small></h2><div class="ks-classes">${cards}</div>
      <div class="foot">${esc(tFor(s.player, 'ks.pickHint'))}</div>`;
  }

  update(dt, d) {
    const st = this.nav.step(d, dt);
    if (st.x) {
      this.i = (this.i + st.x + CLASS_IDS.length) % CLASS_IDS.length;
      this.s.game.audio.play('select');
      this.render();
      const cls = CLASS_IDS[this.i];
      this.s.previewClass(cls);
      say(`${t(`ks.cls.${cls}`)}. ${t(`ks.descSay.${cls}`)}`);
    }
    if (d?.aPressed) {
      this.el.remove();
      this.s.game.audio.play('join');
      this.onPick(CLASS_IDS[this.i]);
      return true;
    }
    return false;
  }

  close() { this.el.remove(); }
}

// ---------------------------------------------------------------- hold-[C] menu

/** Skills, potion, town portal and bag. Opens while [C] is held; letting go of [C] uses the entry. */
export class SkillMenu {
  constructor(scene) {
    this.s = scene;
    this.nav = new Nav();
    this.entries = this.makeEntries();
    const sel = scene.selectedAction();
    this.i = Math.max(0, this.entries.findIndex((x) => x.id === sel));
    this.el = document.createElement('div');
    this.el.className = 'ks-panel ks-menu';
    scene.hud.layer.appendChild(this.el);
    this.render();
  }

  makeEntries() {
    const s = this.s;
    const out = [];
    if (s.kind !== 'town') {
      for (const sk of SKILLS[s.cls]) out.push({ id: sk.id, kind: 'skill', lv: sk.lv, on: s.hs.level >= sk.lv });
      out.push({ id: 'potion', kind: 'potion', on: s.hs.potions > 0 });
      out.push({ id: 'portal', kind: 'portal', on: true });
    }
    out.push({ id: 'bag', kind: 'bag', on: true });
    return out;
  }

  render() {
    const s = this.s;
    const rows = this.entries.map((x, i) => {
      let name, sub;
      if (x.kind === 'skill') { name = t(`ks.skill.${x.id}`); sub = x.on ? t(`ks.skillDesc.${x.id}`) : t('ks.unlockAt', { n: x.lv }); }
      else if (x.kind === 'potion') { name = t('ks.m.potion'); sub = t('ks.m.potionDesc', { n: s.hs.potions }); }
      else if (x.kind === 'portal') { name = t('ks.m.portal'); sub = t('ks.m.portalDesc'); }
      else { name = t('ks.m.bag'); sub = t('ks.m.bagDesc'); }
      const chosen = s.selectedAction() === x.id ? ' ✓' : '';
      return `<div class="ks-item ${i === this.i ? 'cur' : ''} ${x.on ? '' : 'off'}">${skillIcon(x.id)}<div class="grow">${esc(name)}${chosen}<small>${esc(sub)}</small></div></div>`;
    }).join('');
    this.el.innerHTML = `<h2>${esc(t('ks.m.title'))}</h2><div class="ks-list">${rows}</div><div class="foot">${esc(tFor(s.player, 'ks.m.hint'))}</div>`;
  }

  /** Returns the chosen entry when the menu should close (null = keep open, false = cancel). */
  update(dt, d) {
    const st = this.nav.step(d, dt);
    if (st.y) {
      this.i = (this.i + st.y + this.entries.length) % this.entries.length;
      this.s.game.audio.play('select');
      this.render();
      const x = this.entries[this.i];
      say(x.kind === 'skill' ? t(`ks.skill.${x.id}`) : t(`ks.m.${x.id}`));
    }
    if (d?.bPressed) return false;
    if (d?.aPressed || (d && !d.c)) return this.entries[this.i];
    return null;
  }

  close() { this.el.remove(); }
}
