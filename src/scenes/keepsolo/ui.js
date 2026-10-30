import { t, tFor } from '../../core/i18n.js';
import { esc } from '../../core/ui.js';
import { say } from '../../core/voice.js';
import { RARITY_TEXT, RARITY_CSS, itemName, statLines, baseName, STATS, statsOf, reqOf, sellValue } from './items.js';
import { CLASS_IDS, B_MOVE, GLYPH, CLASS_COLOR, TREE, skillDef, manaCost, isBetter, armorCut, xpNeed, STAT_IDS } from './classes.js';
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
.ks-glyph { width: 1.6em; height: 1.6em; border-radius: 50%; background: var(--c); color: #fff; display: inline-flex; align-items: center; justify-content: center;
  font-size: 1.1em; box-shadow: 0 0 0 3px #fff, 0 3px 0 3px rgba(43,35,64,.2); flex: none; }
.ks-bar { position: relative; flex: 1; height: 1.05em; border-radius: 1em; background: #e6defa; border: 3px solid #2b2340; overflow: hidden; }
.ks-bar > i { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 1em; }
.ks-bar > span { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: .72em; color: #2b2340; font-weight: 700;
  -webkit-text-stroke: .25em #fff; paint-order: stroke fill; }
.ks-hint { left: 50%; transform: translateX(-50%); white-space: nowrap; bottom: calc(1.6vh + var(--slot) * 1.15 + 26px); font-weight: 600; font-size: clamp(11px, 1vw, 16px); background: rgba(255,255,255,.88);
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
.ks-panel, .ks-ui { pointer-events: auto; }
.ks-layer { --slot: clamp(40px, 4.3vw, 64px); --orb: clamp(92px, 10.5vw, 150px); }
.ks-dark { inset: 0; pointer-events: none; display: none; }
.ks-orb { bottom: 1.2vh; width: var(--orb); height: var(--orb); border-radius: 50%; overflow: hidden; background: #2b2340;
  box-shadow: 0 0 0 5px #fffaf2, 0 0 0 8px #2b2340, 0 8px 0 6px rgba(43,35,64,.35); }
.ks-orb.hp { left: 1.6vw; } .ks-orb.mp { right: 1.6vw; }
.ks-orb > i { position: absolute; left: 0; right: 0; bottom: 0; transition: height .15s; }
.ks-orb.hp > i { background: radial-gradient(circle at 35% 25%, #ffb3c4, #ff3b6b 45%, #c8164a); }
.ks-orb.mp > i { background: radial-gradient(circle at 35% 25%, #b8dcff, #3b7bff 45%, #1f4fc8); }
.ks-orb.low > i { animation: ks-blink .6s infinite; }
.ks-orb > span { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #fff; font-weight: 700;
  font-size: clamp(14px, 1.5vw, 24px); -webkit-text-stroke: .2em #2b2340; paint-order: stroke fill; line-height: 1; }
.ks-orb > span small { font-size: .6em; }
.ks-orb::after { content: ''; position: absolute; left: 18%; top: 10%; width: 30%; height: 18%; border-radius: 50%; background: rgba(255,255,255,.35); }
.ks-who { left: 1.6vw; bottom: calc(1.2vh + var(--orb) + 16px); display: flex; flex-direction: column; gap: 5px; align-items: flex-start; }
.ks-who .row { display: flex; align-items: center; gap: 8px; }
.ks-who .tier1 { color: #8a45e0; } .ks-who .tier2 { color: #e8243f; }
.ks-pts { background: #ffd23f; color: #2b2340; border-radius: 14px; padding: 3px 12px; font-weight: 700; font-size: clamp(11px, 1.05vw, 16px); cursor: pointer;
  box-shadow: 0 3px 0 rgba(43,35,64,.25); animation: ks-pulse 1.2s infinite; }
@keyframes ks-pulse { 50% { transform: scale(1.06); } }
.ks-dock { left: 50%; transform: translateX(-50%); bottom: 1.2vh; display: flex; flex-direction: column; align-items: stretch; gap: 5px;
  background: rgba(255,250,242,.94); border-radius: 20px; padding: 6px 10px 8px; box-shadow: 0 5px 0 rgba(43,35,64,.22); }
.ks-xp2 { height: 7px; border-radius: 6px; background: #e6defa; overflow: hidden; border: 2px solid #2b2340; }
.ks-xp2 > i { display: block; height: 100%; background: #ffb400; }
.ks-slots { display: flex; gap: 6px; align-items: flex-end; }
.ks-slots .gap { width: 6px; }
.ks-sk { position: relative; width: var(--slot); height: var(--slot); border-radius: 14px; background: #fff; box-shadow: inset 0 0 0 3px #d6cfe6; overflow: hidden;
  display: flex; align-items: center; justify-content: center; }
.ks-sk svg { width: 72%; height: 72%; }
.ks-sk .key { position: absolute; left: 4px; top: 1px; font-size: clamp(10px, .9vw, 14px); font-weight: 700; color: #2b2340; }
.ks-sk .mana { position: absolute; right: 3px; bottom: 1px; font-size: clamp(9px, .8vw, 12px); font-weight: 700; color: #2f6fe0; }
.ks-sk .cd { position: absolute; left: 0; right: 0; bottom: 0; background: rgba(43,35,64,.45); }
.ks-sk.nomana svg { opacity: .35; } .ks-sk.nomana { box-shadow: inset 0 0 0 3px #5a9bff; }
.ks-sk.off { opacity: .45; } .ks-sk.empty { background: #f1ecf8; }
.ks-beltbar { display: flex; gap: 3px; margin-right: 8px; }
.ks-bc { width: calc(var(--slot) * .72); display: flex; flex-direction: column; gap: 2px; }
.ks-bc > div { position: relative; height: calc(var(--slot) * .72); border-radius: 10px; background: #f1ecf8; box-shadow: inset 0 0 0 2px #d6cfe6; display: flex; align-items: center; justify-content: center; }
.ks-bc > .up2 { opacity: .8; height: calc(var(--slot) * .5); }
.ks-bc svg { width: 78%; height: 78%; }
.ks-bc .key { position: absolute; left: 3px; top: 0; font-size: clamp(9px, .8vw, 12px); font-weight: 700; }
.ks-inv { --cs: clamp(26px, 3.1vw, 46px); padding-bottom: 10px; }
.ks-inv.identify { cursor: help; }
.ks-grid2 { position: relative; border-radius: 10px; background-color: #ece4f8;
  background-image: linear-gradient(rgba(43,35,64,.12) 1px, transparent 1px), linear-gradient(90deg, rgba(43,35,64,.12) 1px, transparent 1px);
  background-size: var(--cs) var(--cs); box-shadow: inset 0 0 0 2px rgba(43,35,64,.15); }
.ks-it, .ks-it2 { position: absolute; box-sizing: border-box; border-radius: 8px; display: flex; align-items: center; justify-content: center; }
.ks-it2 { position: relative; width: var(--cs); height: var(--cs); }
.ks-it svg, .ks-it2 svg, .ks-slot svg { width: 82%; height: 82%; max-width: 70px; max-height: 70px; }
.ks-it.r0, .ks-it2.r0, .ks-slot.r0 { background: #f4f1ea; box-shadow: inset 0 0 0 2px #d6d0c4; }
.ks-it.r1, .ks-it2.r1, .ks-slot.r1 { background: #e3eeff; box-shadow: inset 0 0 0 2px #5a9bff; }
.ks-it.r2, .ks-it2.r2, .ks-slot.r2 { background: #fff6cc; box-shadow: inset 0 0 0 2px #ffc21a; }
.ks-it.r3, .ks-it2.r3, .ks-slot.r3 { background: #ffe6cc; box-shadow: inset 0 0 0 2px #ff8c1a; }
.ks-it.noreq, .ks-slot.noreq { background: #ffd6dc !important; box-shadow: inset 0 0 0 3px #e8243f !important; }
.ks-it.other::after { content: ''; position: absolute; inset: 0; border-radius: 8px; background: rgba(43,35,64,.28); }
.ks-it.sel, .ks-slot.sel { outline: 3px solid #2b2340; outline-offset: -1px; }
.ks-it .up, .ks-slot .up, .ks-it2 .up { position: absolute; right: 2px; top: 0; color: #16a46a; font-size: 1em; -webkit-text-stroke: .2em #fff; paint-order: stroke fill; font-weight: 700; }
.ks-it .unid, .ks-slot .unid, .ks-it2 .unid { position: absolute; left: 3px; top: 0; color: #8a45e0; font-weight: 700; -webkit-text-stroke: .2em #fff; paint-order: stroke fill; }
.ks-it .plus, .ks-slot .plus { position: absolute; left: 3px; bottom: 0; font-size: .75em; font-weight: 700; color: #2b2340; }
.ks-drop { position: absolute; display: none; border-radius: 8px; pointer-events: none; }
.ks-drop.ok { background: rgba(61,220,151,.35); box-shadow: inset 0 0 0 3px #16a46a; } .ks-drop.no { background: rgba(232,36,63,.3); box-shadow: inset 0 0 0 3px #e8243f; }
.ks-ghost { left: 0; top: 0; pointer-events: none; z-index: 5; opacity: .9; }
.ks-ghost > .ks-it { position: relative; }
.ks-tip { left: 0; top: 0; pointer-events: none; z-index: 6; display: flex; gap: 8px; font-size: clamp(12px, 1.1vw, 17px); font-weight: 600; }
.ks-side { display: flex; flex-direction: column; gap: 6px; align-items: center; max-width: calc(var(--cs) * 9); }
.ks-sum { font-size: .8em; opacity: .8; max-width: 22em; }
.ks-say { margin: 0; font-size: .9em; max-width: 20em; }
.ks-doll { display: grid; grid-template-columns: repeat(3, calc(var(--cs) * 2)); grid-template-rows: calc(var(--cs) * 2) calc(var(--cs) * 3) calc(var(--cs) * 2) calc(var(--cs) * 1.2);
  gap: 5px; grid-template-areas: ". helmet charm" "weapon armor offhand" "gloves . boots" ". belt ."; }
.ks-slot { position: relative; border-radius: 10px; background: #ece4f8; display: flex; align-items: center; justify-content: center; flex-direction: column; }
.ks-slot.empty svg { opacity: .22; filter: grayscale(1); }
.ks-slot b { position: absolute; bottom: 1px; font-size: .58em; opacity: .55; }
.ks-doll-helmet { grid-area: helmet; } .ks-doll-charm { grid-area: charm; } .ks-doll-weapon { grid-area: weapon; } .ks-doll-armor { grid-area: armor; }
.ks-doll-offhand { grid-area: offhand; } .ks-doll-gloves { grid-area: gloves; } .ks-doll-belt { grid-area: belt; } .ks-doll-boots { grid-area: boots; }
.ks-belt { display: grid; grid-template-columns: repeat(4, var(--cs)); gap: 3px; margin-top: 2px; }
.ks-bcell { position: relative; width: var(--cs); height: var(--cs); border-radius: 8px; background: #f1ecf8; box-shadow: inset 0 0 0 2px #d6cfe6; display: flex; align-items: center; justify-content: center; }
.ks-bcell svg { width: 80%; height: 80%; } .ks-bcell .key { position: absolute; left: 3px; top: 0; font-size: .7em; font-weight: 700; }
.ks-btn { background: #8a45e0; color: #fff; border-radius: 14px; padding: 6px 14px; font-weight: 700; cursor: pointer; box-shadow: 0 3px 0 rgba(43,35,64,.3); }
.ks-btn.off { opacity: .4; }
.ks-btn:hover, .ks-buy:hover { filter: brightness(1.08); }
.ks-shop { min-width: min(380px, 40vw); } .ks-buy { cursor: pointer; }
.ks-lost { display: flex; flex-wrap: wrap; gap: 4px; max-width: calc(var(--cs) * 10); max-height: calc(var(--cs) * 8); overflow: auto; }
.ks-card .st.req { color: #5a5470; } .ks-card .st.req.bad { color: #e8243f; font-weight: 700; }
.ks-card .st.unid { color: #8a45e0; font-size: .85em; }
.ks-card .sell { margin-top: 3px; }
.tier1 { color: #8a45e0; } .tier2 { color: #e8243f; }
.label.ks-flabel { left: 0; top: 0; font-size: clamp(11px, 1vw, 16px); -webkit-text-stroke: 0; background: rgba(28,20,52,.82); border-radius: 7px; padding: 2px 8px;
  line-height: 1.2; box-shadow: 0 2px 0 rgba(0,0,0,.25); }
.ks-target { left: 50%; top: calc(14px + clamp(34px, 3.6vw, 52px)); transform: translateX(-50%); text-align: center; display: flex; flex-direction: column;
  align-items: center; gap: 2px; padding: 4px 18px 6px; min-width: 12em; }
.ks-target small { font-size: .7em; opacity: .75; }
.ks-target .tb { display: block; width: clamp(140px, 18vw, 300px); height: .55em; border-radius: 1em; background: #e6defa; border: 2px solid #2b2340; overflow: hidden; }
.ks-target .tb i { display: block; height: 100%; background: linear-gradient(#ff8fa8, #ff3b6b); }
`;

// ---------------------------------------------------------------- icons

const svg = (body, vb = '0 0 40 40') => `<svg viewBox="${vb}" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;
const FILL = ['#fff3e6', '#7fb2ff', '#ffd23f', '#ff9a2e'];
const INK = '#2b2340';

/** A little picture of an item (by slot, class and rarity). */
export function itemIcon(item) {
  if (item?.slot === 'use') return useIcon(item.use);
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
    case 'belt': return svg(`<rect x="3" y="15" width="34" height="11" rx="4" fill="${f}" ${s}/><rect x="16" y="13" width="9" height="15" rx="2" fill="#ffd23f" ${s} stroke-width="1.8"/><path d="M8 19 v3 M12 19 v3 M29 19 v3 M33 19 v3" ${s} stroke-width="1.5"/>`);
    case 'potion': return svg(`<path d="M15 5 h10 v7 Q34 16 33 26 Q32 36 20 36 Q8 36 7 26 Q6 16 15 12 Z" fill="#ff5d73" ${s}/><rect x="14" y="2" width="12" height="5" rx="2" fill="#c98b5a" ${s} stroke-width="1.6"/><path d="M20 30 l-6 -6 a3.5 3.5 0 0 1 6 -4 a3.5 3.5 0 0 1 6 4z" fill="#fff"/>`);
    default: return svg(`<path d="M30 4 Q12 10 10 30 L8 36 L13 31 Q32 26 30 4 Z" fill="${f}" ${s}/><path d="M10 31 Q18 20 27 9" fill="none" stroke="${INK}" stroke-width="1.6"/>`);
  }
}

/** Potions and scrolls: red potion, blue potion, Town Portal scroll (blue), Identify scroll (yellow). */
export function useIcon(use) {
  const s = `stroke="${INK}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"`;
  if (use === 'hp') return slotIcon('potion');
  if (use === 'mp') return svg(`<path d="M15 5 h10 v7 Q34 16 33 26 Q32 36 20 36 Q8 36 7 26 Q6 16 15 12 Z" fill="#4c8dff" ${s}/><rect x="14" y="2" width="12" height="5" rx="2" fill="#c98b5a" ${s} stroke-width="1.6"/><path d="M20 19 l2 4.5 5 .4 -3.8 3.2 1.2 4.9 -4.4 -2.7 -4.4 2.7 1.2 -4.9 -3.8 -3.2 5 -.4z" fill="#fff"/>`);
  const c = use === 'tp' ? '#8fd8ff' : '#ffe27a';
  const mark = use === 'tp' ? `<ellipse cx="20" cy="20" rx="5" ry="7" fill="#7a5ad0" stroke="${INK}" stroke-width="1.6"/>` : `<text x="20" y="25" font-size="13" font-weight="700" text-anchor="middle" fill="${INK}" font-family="sans-serif">?</text>`;
  return svg(`<rect x="9" y="7" width="22" height="26" rx="3" fill="#fff3dc" ${s}/><rect x="6" y="4" width="28" height="6" rx="3" fill="${c}" ${s}/><rect x="6" y="30" width="28" height="6" rx="3" fill="${c}" ${s}/>${mark}`);
}

/** Icons for the skills and menu entries. */
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
    case 'bash': return svg(`<rect x="6" y="10" width="22" height="14" rx="6" fill="#fff3e6" ${s} transform="rotate(-25 17 17)"/><path d="M26 26 l8 8 M30 22 l6 2 M22 30 l2 6" ${s}/>`);
    case 'leap': return svg(`<path d="M5 32 Q20 0 35 32" fill="none" ${s} stroke-dasharray="4 3"/><circle cx="35" cy="32" r="4" fill="#ff5d73" ${s}/><path d="M28 34 h14" ${s}/>`);
    case 'avalanche': return svg(`<rect x="4" y="6" width="14" height="8" rx="3" fill="#ffd0e4" ${s}/><rect x="22" y="12" width="14" height="8" rx="3" fill="#bfe0ff" ${s}/><rect x="10" y="24" width="16" height="9" rx="3" fill="#fff3a0" ${s}/>`);
    case 'stuffing': return svg(`<path d="M20 34 Q4 22 8 12 Q12 4 20 11 Q28 4 32 12 Q36 22 20 34 Z" fill="#ff8fa8" ${s}/><path d="M14 18 h12 M20 12 v12" stroke="#fff" stroke-width="3"/>`);
    case 'power': return svg(`<path d="M22 3 L8 22 h10 L15 37 L32 16 h-11 z" fill="#ffd23f" ${s}/>`);
    case 'snooze': return svg(`<path d="M4 28 H28" ${s} stroke-width="4"/><path d="M26 22 L34 28 L26 34 Z" fill="#c9a8ff" ${s}/><text x="12" y="17" font-size="12" font-weight="700" fill="${INK}" font-family="sans-serif">z z</text>`);
    case 'trap': return svg(`<circle cx="20" cy="26" r="11" fill="#3ddc97" fill-opacity=".5" ${s}/><path d="M20 26 L12 8 M20 26 L28 8 M20 26 L20 5" ${s}/>`);
    case 'star': return svg(`<path d="M20 3 l4.5 10.5 11 1 -8.4 7.3 2.6 11 -9.7 -5.8 -9.7 5.8 2.6 -11 -8.4 -7.3 11 -1z" fill="#ffd23f" ${s}/><path d="M2 38 L12 28" ${s}/>`);
    case 'eye': return svg(`<path d="M3 20 Q20 4 37 20 Q20 36 3 20 Z" fill="#fff" ${s}/><circle cx="20" cy="20" r="6" fill="#3ddc97" ${s}/><circle cx="20" cy="20" r="2" fill="${INK}"/>`);
    case 'feet': return svg(`<ellipse cx="13" cy="24" rx="7" ry="11" fill="#3ddc97" ${s}/><ellipse cx="28" cy="16" rx="7" ry="11" fill="#3ddc97" ${s}/><path d="M2 36 h10 M24 32 h12" ${s}/>`);
    case 'bolt': return svg(`<circle cx="26" cy="20" r="9" fill="#7fd8ff" ${s}/><path d="M4 14 H16 M2 20 H16 M4 26 H16" ${s}/><circle cx="23" cy="17" r="2.5" fill="#fff"/>`);
    case 'shield': return svg(`<circle cx="20" cy="20" r="16" fill="#bfe9ff" fill-opacity=".7" ${s}/><circle cx="20" cy="20" r="8" fill="#4cc9f0" ${s}/><circle cx="13" cy="12" r="3" fill="#fff"/>`);
    case 'splash': return svg(`<circle cx="20" cy="22" r="15" fill="#8fd8ff" fill-opacity=".6" ${s}/><circle cx="20" cy="22" r="8" fill="#bfe9ff" ${s}/><path d="M6 6 l5 5 M34 6 l-5 5 M20 1 v6" ${s}/>`);
    case 'thoughts': return svg(`<circle cx="20" cy="17" r="13" fill="#c9a8ff" ${s}/><circle cx="12" cy="34" r="3" fill="#c9a8ff" ${s}/><path d="M14 17 q6 -8 12 0" fill="none" ${s}/>`);
    case 'soapy': return svg(`<rect x="7" y="14" width="26" height="18" rx="7" fill="#ffd0e4" ${s}/><circle cx="14" cy="9" r="4" fill="#bfe9ff" ${s}/><circle cx="25" cy="7" r="3" fill="#bfe9ff" ${s}/>`);
    case 'potion': return slotIcon('potion');
    case 'mpotion': return useIcon('mp');
    case 'scroll': return useIcon('tp');
    case 'char': return svg(`<circle cx="20" cy="13" r="8" fill="#ffd23f" ${s}/><path d="M6 37 Q6 23 20 23 Q34 23 34 37 Z" fill="#ff8fa8" ${s}/>`);
    case 'tree': return svg(`<circle cx="20" cy="8" r="5" fill="#3ddc97" ${s}/><circle cx="9" cy="30" r="5" fill="#4cc9f0" ${s}/><circle cx="31" cy="30" r="5" fill="#ff8fa8" ${s}/><path d="M20 13 L11 26 M20 13 L29 26" ${s}/>`);
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

/** Requirement lines ("needs 25 Strength"), red when not met. */
export function reqHtml(scene, item) {
  const r = reqOf(item);
  const at = scene.hero?.st?.attrs || {};
  return Object.entries(r).map(([k, v]) => `<div class="st req ${(at[k] || 0) < v ? 'bad' : ''}"><span>${esc(t('ks.needs', { n: v, stat: t(`ks.attr.${k}`) }))}</span></div>`).join('');
}

/** Stat comparison card: `item` (maybe for another class) against what is worn in the same slot. */
export function itemCard(scene, item, { title = '', compare = true } = {}) {
  if (!item) return `<div class="ks-card" style="opacity:.4"><div class="sub">${esc(title)}</div><h4>${esc(t('ks.empty'))}</h4></div>`;
  if (item.slot === 'use') {
    return `<div class="ks-card"><div class="sub">${esc(title)}</div><h4>${esc(itemName(item))}</h4><div class="sub">${esc(t(`ks.useDesc.${item.use}`))}</div><div class="sub">${esc(t('ks.useHow'))}</div></div>`;
  }
  const hs = scene.hs, cls = scene.cls;
  const worn = hs.gear[item.slot];
  const lines = statLines(item);
  const wornStats = worn && worn !== item && !item.unid ? statsOf(worn) : null;
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
  if (item.unid) rows.push(`<div class="st unid"><span>${esc(t('ks.unidHint'))}</span></div>`);
  const forOther = item.cls && item.cls !== cls;
  const diffTag = item.diff ? ` · <b class="tier${item.diff}">${esc(t(`ks.diff.${item.diff}`))}</b>` : '';
  const sub = `${esc(t(`ks.rarity.${item.rarity}`))} · ${esc(baseName(item))} · ${esc(t('ks.ilvl', { n: item.ilvl + 1 }))}${diffTag}${forOther ? ` · <b style="color:#e8243f">${esc(t('ks.forClass', { cls: t(`ks.cls.${item.cls}`) }))}</b>` : ''}`;
  let verdict = '';
  if (compare && worn !== item) {
    const delta = scene.compareItemFor(item);
    if (delta === undefined) verdict = `<div class="ks-verdict bad">${esc(t('ks.unknown'))}</div>`;
    else if (delta !== null) verdict = isBetter(delta) ? `<div class="ks-verdict good">▲ ${esc(t('ks.better'))}</div>` : `<div class="ks-verdict bad">${esc(t('ks.notBetter'))}</div>`;
  }
  const pow = item.power && !item.unid ? `<div class="pow">★ ${esc(t(`ks.power.${item.power}`))}</div>` : '';
  return `<div class="ks-card" style="border-color:${RARITY_CSS[item.rarity]}"><div class="sub">${esc(title)}</div><h4 style="color:${RARITY_TEXT[item.rarity]}">${esc(itemName(item))}</h4>
    <div class="sub">${sub}</div>${rows.join('')}${reqHtml(scene, item)}${pow}${verdict}<div class="sub sell">${esc(t('ks.sellsFor', { n: sellValue(item) }))}</div></div>`;
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

/**
 * The Diablo-style HUD: the red health orb (bottom left), the blue mana orb (bottom right), and
 * between them the belt (keys 5-8), the mouse buttons and the skill keys 1-4, with the XP bar on
 * top. Level, class and unspent points sit above the health orb (click them to spend).
 */
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
    this.layer.innerHTML = `<div class="ks-dark"></div><div class="ks-orb hp ks-ui"><i></i><span></span></div><div class="ks-orb mp ks-ui"><i></i><span></span></div>
      <div class="ks-who"></div><div class="ks-dock ks-ui"></div><div class="ks-hint ks-pill"></div><div class="ks-money"></div><div class="ks-bagnote ks-pill"></div><div class="ks-target ks-pill"></div>`;
    this.dark = this.layer.querySelector('.ks-dark');
    this.hp = this.layer.querySelector('.ks-orb.hp');
    this.mp = this.layer.querySelector('.ks-orb.mp');
    this.who = this.layer.querySelector('.ks-who');
    this.dock = this.layer.querySelector('.ks-dock');
    this.hint = this.layer.querySelector('.ks-hint');
    this.money = this.layer.querySelector('.ks-money');
    this.bagNote = this.layer.querySelector('.ks-bagnote');
    this.targetEl = this.layer.querySelector('.ks-target');
    this.targetEl.style.display = 'none';
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
    for (const el of [this.hp, this.mp, this.who, this.dock, this.hint, this.money, this.bagNote]) el.style.display = on ? '' : 'none';
  }

  orb(el, key, now, max, low) {
    const pct = Math.max(0, Math.min(1, now / Math.max(1, max)));
    this.set(el, key, `<i style="height:${(pct * 100).toFixed(1)}%"></i><span>${Math.ceil(Math.max(0, now))}<small>/ ${Math.round(max)}</small></span>`);
    el.classList.toggle('low', low && pct < 0.3);
  }

  /** One hotbar box: icon, key, mana cost, recharge shade. */
  slotBox(id, key, { basic = false, off = false } = {}) {
    const s = this.s, e = s.hero;
    if (!id) return `<div class="ks-sk empty" data-hot="${esc(key)}"><span class="key">${esc(key)}</span></div>`;
    let cost = '', shade = '', no = '';
    if (!basic) {
      const def = skillDef(s.cls, id);
      const r = s.rank(id);
      const c = def && def.mana ? manaCost(def, r) : 0;
      if (c) cost = `<span class="mana">${c}</span>`;
      const left = s.skillCd(e, id), full = (def?.cd || 0) * (1 - e.st.cdr);
      if (left > 0 && full > 0) shade = `<i class="cd" style="height:${Math.min(100, left / full * 100).toFixed(0)}%"></i>`;
      if (c > e.mana) no = 'nomana';
    }
    return `<div class="ks-sk ${off ? 'off' : ''} ${no}" data-hot="${esc(key)}">${skillIcon(id)}<span class="key">${esc(key)}</span>${cost}${shade}</div>`;
  }

  update() {
    const s = this.s, e = s.hero, hs = s.hs;
    if (!e || !hs) return;
    const p = s.player, pad = s.isPad();
    this.orb(this.hp, 'hp', e.hp, e.st.maxHp, true);
    this.orb(this.mp, 'mp', e.mana, e.st.maxMana, false);
    const xpPct = Math.min(100, Math.round(hs.xp / xpNeed(hs.level) * 100));
    const pts = [];
    if (hs.statPts > 0) pts.push(`<span class="ks-pts ks-ui" data-open="char">+${hs.statPts} ${esc(t('ks.statPtsShort'))}${pad ? '' : ' (C)'}</span>`);
    if (hs.skillPts > 0) pts.push(`<span class="ks-pts ks-ui" data-open="tree">+${hs.skillPts} ${esc(t(hs.skillPts > 1 ? 'ks.skillPtsShort' : 'ks.skillPtShort'))}${pad ? '' : ' (T)'}</span>`);
    const tier = hs.diff ? ` · <b class="tier${hs.diff}">${esc(t(`ks.diff.${hs.diff}`))}</b>` : '';
    this.set(this.who, 'who', `<div class="ks-pill row"><span class="ks-glyph" style="--c:${CLASS_COLOR[s.cls]}">${GLYPH[s.cls]}</span><span>${esc(t(`ks.cls.${s.cls}`))} · ${esc(t('ks.lv', { n: hs.level }))}${tier}</span></div>${pts.join('')}`);
    // the dock: belt (5-8), mouse buttons, skill keys (1-4)
    const cap = s.beltCap();
    let belt = '';
    for (let c = 0; c < 4; c++) {
      const top = cap > 4 ? hs.belt[4 + c] : null, it = hs.belt[c];
      belt += `<div class="ks-bc" data-beltkey="${c}">${cap > 4 ? `<div class="up2">${top ? itemIcon(top) : ''}</div>` : ''}<div class="lo">${it ? itemIcon(it) : ''}<span class="key">${pad ? '' : c + 5}</span></div></div>`;
    }
    const town = s.kind === 'town';
    const lmbKey = pad ? tFor(p, 'ks.key.a') : t('ks.key.lmb'), rmbKey = pad ? tFor(p, 'ks.key.c') : t('ks.key.rmb');
    const bm = B_MOVE[s.cls];
    const keys = hs.bar.k.map((id, i) => this.slotBox(id, pad ? (id === bm ? tFor(p, 'ks.key.b') : '') : String(i + 1), { off: town }));
    const html = `<div class="ks-xp2"><i style="width:${xpPct}%"></i></div><div class="ks-slots"><div class="ks-beltbar">${belt}</div>
      ${this.slotBox(town ? 'talk' : `attack.${s.cls}`, lmbKey, { basic: true })}${this.slotBox(hs.bar.rmb, rmbKey, { off: town })}<span class="gap"></span>${keys.join('')}</div>`;
    this.set(this.dock, 'dock', html);
    this.set(this.hint, 'hint', esc(pad ? tFor(p, town ? 'ks.hintTownPad' : 'ks.hintDungeonPad') : t(town ? 'ks.hintTownMouse' : 'ks.hintDungeonMouse')));
    this.set(this.money, 'money', `<span class="ks-pill"><span class="ks-coin"></span> ${hs.coins}</span><span class="ks-pill"><span class="ks-fluff"></span>${hs.fluff}</span>`);
    const drop = hs.drop;
    const note = drop ? esc(t('ks.bagNote', { where: whereText(drop.g) })) : '';
    this.set(this.bagNote, 'bag', note);
    this.bagNote.style.display = note && this.visible ? '' : 'none';
  }

  /** The name (and health bar) of what is under the mouse pointer, at the top of the screen. */
  target(html) {
    if (!this.visible) html = '';
    this.set(this.targetEl, 'target', html);
    this.targetEl.style.display = html ? '' : 'none';
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
  const st = scene.hero.st;
  const cut = Math.round(armorCut(st.armor, scene.D) * 100);
  return t('ks.summary2', { dmg: Math.round(st.dmg), hp: st.maxHp, mana: st.maxMana, armor: Math.round(st.armor), cut, speed: Math.round((st.speed - 1) * 100), rate: Math.round((st.rate - 1) * 100) });
}

// ---------------------------------------------------------------- class picker

/** Choose a hero: three saves, one per class (stick or mouse: point at a card, click to play). */
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
      const tier = h.diff ? ` · ${t(`ks.diff.${h.diff}`)}` : '';
      const save = h.started ? t('ks.saveLine', { lv: h.level, where: whereText(h.reached) }) + tier : t('ks.saveNew');
      const learn = TREE[cls].filter((k) => k.kind !== 'passive').slice(0, 6).map((k) => t(`ks.skill.${k.id}`)).join(', ');
      return `<div class="ks-class ${i === this.i ? 'cur' : ''}" data-cls="${i}" style="--c:${CLASS_COLOR[cls]}"><div class="big">${GLYPH[cls]}</div><h3>${esc(t(`ks.cls.${cls}`))}</h3>
        <p>${esc(t(`ks.desc2.${cls}`))}</p><p style="opacity:.6">${esc(t('ks.learns', { list: learn }))}</p><div class="save">${esc(save)}</div></div>`;
    }).join('');
    this.el.innerHTML = `<h2>${esc(t('game.keepsolo'))}<small>${esc(t('ks.pick'))}</small></h2><div class="ks-classes">${cards}</div>
      <div class="foot">${esc(tFor(s.player, 'ks.pickHint2'))}</div>`;
  }

  choose(i) {
    if (i === this.i) return;
    this.i = i;
    this.s.game.audio.play('select');
    this.render();
    const cls = CLASS_IDS[this.i];
    this.s.previewClass(cls);
    say(`${t(`ks.cls.${cls}`)}. ${t(`ks.descSay.${cls}`)}`);
  }

  update(dt, d) {
    const st = this.nav.step(d, dt);
    if (st.x) this.choose((this.i + st.x + CLASS_IDS.length) % CLASS_IDS.length);
    const m = this.s.mouse;
    const card = m.used && !m.virtual ? m.element()?.closest?.('[data-cls]') : null;
    if (card && m.moved !== this.mMoved) { this.mMoved = m.moved; this.choose(+card.dataset.cls); }
    if (d?.aPressed || (m.leftPressed && card)) {
      if (card) this.i = +card.dataset.cls;
      this.el.remove();
      this.s.game.audio.play('join');
      this.onPick(CLASS_IDS[this.i]);
      return true;
    }
    return false;
  }

  close() { this.el.remove(); }
}

// ---------------------------------------------------------------- hold-[C] menu (gamepad)

/**
 * The gamepad menu: opens while [C] is held. Skills (choosing one puts it on [C] and the right
 * mouse button), potions, the Town Portal scroll, the bag, the hero page and the skill tree.
 * Letting go of [C] uses the entry. Mouse players can click the entries too.
 */
export class SkillMenu {
  constructor(scene) {
    this.s = scene;
    this.nav = new Nav();
    this.entries = this.makeEntries();
    const sel = scene.hs.bar.rmb;
    this.i = Math.max(0, this.entries.findIndex((x) => x.id === sel));
    this.el = document.createElement('div');
    this.el.className = 'ks-panel ks-menu';
    scene.hud.layer.appendChild(this.el);
    this.render();
  }

  makeEntries() {
    const s = this.s, hs = s.hs;
    const out = [];
    if (s.kind !== 'town') {
      for (const sk of TREE[s.cls]) if (sk.kind !== 'passive' && sk.kind !== 'hold' && hs.ranks[sk.id]) out.push({ id: sk.id, kind: 'skill', on: true });
      for (const use of ['hp', 'mp', 'tp']) out.push({ id: use, kind: 'use', on: s.countUse(use) > 0 });
    }
    out.push({ id: 'bag', kind: 'panel', on: true }, { id: 'char', kind: 'panel', on: true }, { id: 'tree', kind: 'panel', on: true });
    return out;
  }

  render() {
    const s = this.s;
    const rows = this.entries.map((x, i) => {
      let name, sub, icon;
      if (x.kind === 'skill') { name = t(`ks.skill.${x.id}`); sub = t(`ks.skillDesc.${x.id}`); icon = skillIcon(x.id); }
      else if (x.kind === 'use') { name = t(`ks.use.${x.id}`); sub = t('ks.m.have', { n: s.countUse(x.id) }); icon = useIcon(x.id); }
      else { name = t(`ks.m.${x.id}`); sub = t(`ks.m.${x.id}Desc`); icon = skillIcon(x.id); }
      const chosen = s.hs.bar.rmb === x.id ? ' ✓' : '';
      return `<div class="ks-item ${i === this.i ? 'cur' : ''} ${x.on ? '' : 'off'}" data-entry="${i}">${icon}<div class="grow">${esc(name)}${chosen}<small>${esc(sub)}</small></div></div>`;
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
      say(x.kind === 'skill' ? t(`ks.skill.${x.id}`) : x.kind === 'use' ? t(`ks.use.${x.id}`) : t(`ks.m.${x.id}`));
    }
    const m = this.s.mouse;
    const row = m.leftPressed ? m.element()?.closest?.('[data-entry]') : null;
    if (row) return this.entries[+row.dataset.entry];
    if (d?.bPressed) return false;
    if (d?.aPressed || (d && !d.c && !this.mouseOpen)) return this.entries[this.i];
    return null;
  }

  close() { this.el.remove(); }
}
