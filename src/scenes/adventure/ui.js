import { esc } from '../../core/ui.js';

// HTML overlay for the adventure: pointer, sentence line, inventory bar, speech bubbles,
// narrator captions, dialog choices, giggle meters and the title card.
// It lives inside the shared label layer, so the game's UI.clear() removes it on scene change.
// Nothing here takes mouse events (the overlay is pointer-events: none); the engine hit-tests
// the rectangles returned by slotRects() / choiceRects() instead.

const CSS = `
.adv-layer { position: absolute; inset: 0; font-family: var(--font); pointer-events: none; }
.adv-layer > * { position: absolute; }
.adv-bubble { left: 0; top: 0; max-width: min(560px, 44vw); background: #fff; border: 4px solid var(--c); border-radius: 22px;
  padding: 12px 18px 12px; font-size: clamp(16px, 1.75vw, 29px); font-weight: 600; line-height: 1.25; color: var(--ink);
  box-shadow: 0 6px 0 rgba(43,35,64,.22); white-space: normal; text-align: left; will-change: transform; }
.adv-bubble .who { position: absolute; top: -0.95em; left: 14px; background: var(--c); color: #fff; border-radius: 999px;
  padding: 1px 12px; font-size: 0.6em; font-weight: 700; white-space: nowrap; }
.adv-bubble .tail { position: absolute; bottom: -17px; width: 0; height: 0; border-left: 12px solid transparent;
  border-right: 12px solid transparent; border-top: 17px solid var(--c); transform: translateX(-50%); }
.adv-bubble .tail::after { content: ''; position: absolute; left: -7px; top: -21px; border-left: 7px solid transparent;
  border-right: 7px solid transparent; border-top: 11px solid #fff; }
.adv-bubble.note { background: #fff4d2; font-style: italic; transform-origin: 50% 100%; }
.adv-bubble.note .tail::after { border-top-color: #fff4d2; }
.adv-bubble.pop { animation: adv-pop 0.22s cubic-bezier(.2,1.6,.4,1); }
@keyframes adv-pop { from { opacity: 0; } to { opacity: 1; } }
.adv-caption { top: 11vh; left: 50%; transform: translateX(-50%); max-width: min(900px, 88vw); background: rgba(43,35,64,.88);
  color: #fff; border-radius: 18px; padding: 10px 22px; font-size: clamp(15px, 1.6vw, 26px); font-weight: 600; font-style: italic;
  text-align: center; box-shadow: 0 6px 0 rgba(43,35,64,.25); }
.adv-caption.help { font-style: normal; background: rgba(255,255,255,.95); color: var(--ink); }
.adv-bottom { left: 0; right: 0; bottom: 1.2vh; display: flex; flex-direction: column; align-items: center; gap: 0.6vh; }
.adv-sentence { font-size: clamp(18px, 2.2vw, 36px); font-weight: 700; color: #fff; min-height: 1.2em; line-height: 1.2;
  paint-order: stroke fill; -webkit-text-stroke: 0.22em #2b2340; text-align: center; padding: 0 3vw; }
.adv-sentence b { color: #ffd84a; }
.adv-hints { font-size: clamp(12px, 1.15vw, 19px); font-weight: 600; background: rgba(255,255,255,.92); border-radius: 999px;
  padding: 3px 16px; box-shadow: 0 3px 0 rgba(43,35,64,.18); white-space: nowrap; }
.adv-hints b { background: var(--ink); color: #fff; border-radius: 8px; padding: 0 7px; margin: 0 3px 0 10px; font-size: 0.9em; }
.adv-hints b:first-child { margin-left: 0; }
.adv-inv { display: flex; gap: 0.7vw; background: rgba(43,35,64,.62); border-radius: 22px; padding: 7px 12px; min-height: 40px; align-items: center; }
.adv-inv.open { background: rgba(43,35,64,.88); box-shadow: 0 0 0 4px #ffd84a; }
.adv-slot { width: clamp(54px, 5.4vw, 84px); height: clamp(54px, 5.4vw, 84px); background: rgba(255,255,255,.88); border-radius: 16px;
  border: 4px solid transparent; position: relative; transition: transform .12s; }
.adv-slot img { width: 100%; height: 100%; display: block; }
.adv-slot.on { border-color: #ffd84a; transform: scale(1.12); }
.adv-slot.held { background: #ffe39a; border-color: #ff8c42; }
.adv-slot .nm { position: absolute; left: 50%; bottom: calc(100% + 8px); transform: translateX(-50%); background: #fff; border-radius: 999px;
  padding: 1px 10px; font-size: clamp(12px, 1.1vw, 18px); font-weight: 700; white-space: nowrap; box-shadow: 0 3px 0 rgba(43,35,64,.2); }
.adv-choices { left: 50%; bottom: 1.5vh; transform: translateX(-50%); width: min(1000px, 94vw); background: rgba(43,35,64,.92);
  border-radius: 24px; padding: 12px 16px; box-shadow: 0 8px 0 rgba(43,35,64,.25); }
.adv-choices .head { color: #ffd84a; font-weight: 700; font-size: clamp(14px, 1.5vw, 24px); padding: 2px 10px 8px; }
.adv-choices .head small { display: block; color: #cfc6ff; font-weight: 600; font-size: 0.75em; }
.adv-choice { color: #d9d2ff; font-size: clamp(16px, 1.75vw, 28px); font-weight: 600; padding: 4px 12px 4px 36px; border-radius: 12px;
  position: relative; line-height: 1.25; }
.adv-choice.used { color: #a99fd8; }
.adv-choice.on { color: #fff; background: rgba(255,255,255,.14); }
.adv-choice.on::before { content: '▶'; position: absolute; left: 10px; color: #ffd84a; font-size: 0.8em; top: 0.3em; }
.adv-cursor { left: 0; top: 0; width: 0; height: 0; will-change: transform; }
.adv-cursor .arm { position: absolute; background: #fff; box-shadow: 0 0 0 2px #2b2340; border-radius: 3px; }
.adv-cursor .h { width: 12px; height: 4px; top: -2px; } .adv-cursor .v { width: 4px; height: 12px; left: -2px; }
.adv-cursor .l { left: -19px; } .adv-cursor .r { left: 7px; } .adv-cursor .t { top: -19px; } .adv-cursor .b { top: 7px; }
.adv-cursor.hot .arm { background: #ffd84a; }
.adv-cursor.hot .l { left: -23px; } .adv-cursor.hot .r { left: 11px; } .adv-cursor.hot .t { top: -23px; } .adv-cursor.hot .b { top: 11px; }
.adv-cursor img { position: absolute; left: 10px; top: 10px; width: 46px; height: 46px; filter: drop-shadow(0 2px 0 rgba(43,35,64,.4)); }
.adv-cursor .tag { position: absolute; left: 0; top: 26px; transform: translateX(-50%); white-space: nowrap; font-weight: 700;
  font-size: clamp(13px, 1.25vw, 20px); color: #fff; paint-order: stroke fill; -webkit-text-stroke: 0.25em #2b2340; }
.adv-meters { top: 2vh; left: 50%; transform: translateX(-50%); display: flex; gap: 2vw; align-items: center; }
.adv-meter { background: #fff; border-radius: 999px; padding: 6px 16px; display: flex; gap: 8px; align-items: center; font-weight: 700;
  font-size: clamp(14px, 1.5vw, 24px); box-shadow: 0 4px 0 rgba(43,35,64,.2); border: 4px solid var(--c); }
.adv-meter .g { width: 1.25em; height: 1.25em; border-radius: 50%; border: 3px solid var(--c); background: #f3f0fa; position: relative; }
.adv-meter .g.full { background: var(--c); animation: adv-wobble .5s ease; }
.adv-meter .g.full::after { content: ''; position: absolute; left: 22%; right: 22%; top: 45%; height: 28%; border-radius: 0 0 99px 99px; background: #fff; }
.adv-duel-tag { font-weight: 700; color: #fff; font-size: clamp(18px, 2vw, 32px); paint-order: stroke fill; -webkit-text-stroke: 0.22em #ff6fae; }
@keyframes adv-wobble { 0% { transform: scale(1.5) rotate(-20deg); } 100% { transform: none; } }
.adv-title { left: 50%; top: 50%; transform: translate(-50%, -50%); background: rgba(255,250,240,.96); border-radius: 36px;
  padding: clamp(18px, 3vw, 40px) clamp(26px, 4.5vw, 70px); text-align: center; box-shadow: 0 10px 0 rgba(43,35,64,.22);
  animation: adv-card .4s cubic-bezier(.2,1.5,.4,1); min-width: min(620px, 90vw); }
.adv-title .logo { font-size: clamp(30px, 4.6vw, 76px); font-weight: 700; line-height: 1; color: #ff6fae;
  paint-order: stroke fill; -webkit-text-stroke: 0.12em #2b2340; letter-spacing: 0.01em; }
.adv-title .sub { font-size: clamp(16px, 1.9vw, 30px); font-weight: 600; margin: 10px 0 16px; color: #7a5bd0; }
.adv-title .opt { font-size: clamp(18px, 2.2vw, 34px); font-weight: 700; padding: 6px 20px; border-radius: 999px; margin: 6px auto; width: fit-content; }
.adv-title .opt small { display: block; font-size: 0.5em; font-weight: 600; opacity: 0.75; }
.adv-title .opt.on { background: #ffd84a; box-shadow: 0 4px 0 rgba(43,35,64,.2); }
.adv-title .foot { margin-top: 12px; font-size: clamp(12px, 1.2vw, 18px); font-weight: 600; opacity: 0.8; }
.adv-tbc { left: 50%; top: 42%; transform: translate(-50%, -50%); text-align: center; animation: adv-card .6s cubic-bezier(.2,1.5,.4,1); }
@keyframes adv-card { from { transform: translate(-50%, -50%) scale(0.3); opacity: 0; } to { transform: translate(-50%, -50%) scale(1); opacity: 1; } }
.adv-tbc .big { font-size: clamp(40px, 7vw, 120px); font-weight: 700; color: #ffd84a; paint-order: stroke fill; -webkit-text-stroke: 0.14em #2b2340; font-style: italic; }
.adv-tbc .small { font-size: clamp(16px, 2vw, 32px); font-weight: 700; color: #fff; paint-order: stroke fill; -webkit-text-stroke: 0.22em #2b2340; }
.adv-float { left: 0; top: 0; font-weight: 700; font-size: clamp(14px, 1.4vw, 22px); color: #fff; paint-order: stroke fill;
  -webkit-text-stroke: 0.25em #ff6fae; animation: adv-float 2.2s ease-out forwards; white-space: nowrap; }
@keyframes adv-float { from { opacity: 0; margin-top: 0; } 15% { opacity: 1; } to { opacity: 0; margin-top: -60px; } }
`;

function injectStyle() {
  if (document.getElementById('adv-style')) return;
  const el = document.createElement('style');
  el.id = 'adv-style';
  el.textContent = CSS;
  document.head.appendChild(el);
}

const div = (cls, parent) => {
  const el = document.createElement('div');
  el.className = cls;
  parent.appendChild(el);
  return el;
};

export class AdvUI {
  constructor(game) {
    injectStyle();
    this.game = game;
    this.root = div('adv-layer', game.ui.labels);
    this.floats = div('adv-floats', this.root);
    this.bubble = div('adv-bubble', this.root);
    this.bubble.style.display = 'none';
    this.caption = div('adv-caption', this.root);
    this.caption.style.display = 'none';
    this.meters = div('adv-meters', this.root);
    this.meters.style.display = 'none';
    this.bottom = div('adv-bottom', this.root);
    this.sentence = div('adv-sentence', this.bottom);
    this.hints = div('adv-hints', this.bottom);
    this.inv = div('adv-inv', this.bottom);
    this.choices = div('adv-choices', this.root);
    this.choices.style.display = 'none';
    this.title = div('adv-title', this.root);
    this.title.style.display = 'none';
    this.tbc = div('adv-tbc', this.root);
    this.tbc.style.display = 'none';
    this.cursor = div('adv-cursor', this.root);
    this.cursor.innerHTML = '<div class="arm h l"></div><div class="arm h r"></div><div class="arm v t"></div><div class="arm v b"></div><img alt=""><div class="tag"></div>';
    this.cursorImg = this.cursor.querySelector('img');
    this.cursorTag = this.cursor.querySelector('.tag');
    this.cache = {};
  }

  set(key, el, html) {
    if (this.cache[key] === html) return;
    this.cache[key] = html;
    el.innerHTML = html;
  }

  show(el, on) {
    const d = on ? '' : 'none';
    if (el.style.display !== d) el.style.display = d;
  }

  // ---------- pointer ----------

  setCursor(x, y, { visible = true, hot = false, tag = '', icon = '' } = {}) {
    this.show(this.cursor, visible);
    if (!visible) return;
    this.cursor.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    this.cursor.classList.toggle('hot', hot);
    if (this.cache.tag !== tag) { this.cache.tag = tag; this.cursorTag.textContent = tag; }
    if (this.cache.icon !== icon) {
      this.cache.icon = icon;
      if (icon) this.cursorImg.src = icon;
      this.cursorImg.style.display = icon ? '' : 'none';
    }
  }

  // ---------- bottom: sentence line, hints, inventory ----------

  setBottom(visible) { this.show(this.bottom, visible); }
  setSentence(html) { this.set('sentence', this.sentence, html); }
  setHints(html) { this.set('hints', this.hints, html); this.show(this.hints, !!html); }

  /** items: [{ id, icon, name }]; sel: index highlighted by the stick; held: id; hover: index under the mouse. */
  setInventory(items, { open = false, sel = -1, held = null, hover = -1 } = {}) {
    const html = items.map((it, i) => {
      const on = (open && i === sel) || i === hover;
      return `<div class="adv-slot ${on ? 'on' : ''} ${it.id === held ? 'held' : ''}" data-i="${i}">
        <img src="${it.icon}" alt="">${on ? `<div class="nm">${esc(it.name)}</div>` : ''}</div>`;
    }).join('');
    this.set('inv', this.inv, html);
    this.inv.classList.toggle('open', open);
    this.show(this.inv, items.length > 0);
  }

  slotRects() {
    return [...this.inv.querySelectorAll('.adv-slot')].map((el) => el.getBoundingClientRect());
  }

  // ---------- speech ----------

  /** kind: 'say' | 'note'. */
  showBubble(text, { who = '', css = '#9b5de5', kind = 'say' } = {}) {
    this.bubble.className = `adv-bubble pop ${kind === 'note' ? 'note' : ''}`;
    this.bubble.style.setProperty('--c', css);
    this.bubble.innerHTML = `${who ? `<div class="who">${esc(who)}</div>` : ''}${esc(text)}<div class="tail"></div>`;
    this.bubble.style.display = '';
    this.bubbleTail = this.bubble.querySelector('.tail');
    this.bubbleSize = null;
  }

  /** Put the bubble's tail at screen point (x, y), kept inside the screen. */
  placeBubble(x, y) {
    if (this.bubble.style.display === 'none') return;
    if (!this.bubbleSize) this.bubbleSize = { w: this.bubble.offsetWidth, h: this.bubble.offsetHeight };
    const { w, h } = this.bubbleSize;
    const W = window.innerWidth;
    const left = Math.max(10, Math.min(W - w - 10, x - w / 2));
    const top = Math.max(26, y - h - 20);
    const tail = Math.max(22, Math.min(w - 22, x - left));
    this.bubbleTail.style.left = `${tail}px`;
    this.bubbleTail.style.display = top > y - h - 20 + 1 ? 'none' : '';
    this.bubble.style.transform = `translate(${left.toFixed(1)}px, ${top.toFixed(1)}px)`;
  }

  hideBubble() { this.show(this.bubble, false); }

  showCaption(text, help = false) {
    this.caption.className = `adv-caption ${help ? 'help' : ''}`;
    this.caption.textContent = text;
    this.show(this.caption, true);
  }

  hideCaption() { this.show(this.caption, false); }

  float(text, x, y) {
    const el = div('adv-float', this.floats);
    el.textContent = text;
    el.style.transform = `translate(${x.toFixed(0)}px, ${y.toFixed(0)}px) translate(-50%, -100%)`;
    setTimeout(() => el.remove(), 2300); // display only
  }

  // ---------- dialog choices ----------

  /** list: [{ text, used }]. */
  setChoices(list, index, head = '') {
    if (!list) { this.show(this.choices, false); this.cache.choices = null; return; }
    const html = `${head ? `<div class="head">${head}</div>` : ''}${list.map((o, i) =>
      `<div class="adv-choice ${i === index ? 'on' : ''} ${o.used ? 'used' : ''}">${esc(o.text)}</div>`).join('')}`;
    this.set('choices', this.choices, html);
    this.show(this.choices, true);
  }

  choiceRects() {
    return [...this.choices.querySelectorAll('.adv-choice')].map((el) => el.getBoundingClientRect());
  }

  // ---------- duel meters ----------

  setMeters(m) {
    if (!m) { this.show(this.meters, false); this.cache.meters = null; return; }
    const meter = (x) => `<div class="adv-meter" style="--c:${x.css}">${esc(x.name)} ${Array.from({ length: x.max }, (_, i) => `<span class="g ${i < x.value ? 'full' : ''}"></span>`).join('')}</div>`;
    this.set('meters', this.meters, `${meter(m.left)}<div class="adv-duel-tag">${esc(m.title)}</div>${meter(m.right)}`);
    this.show(this.meters, true);
  }

  // ---------- cards ----------

  setTitle(card) {
    if (!card) { this.show(this.title, false); this.cache.title = null; return; }
    const opts = card.options.map((o, i) => `<div class="opt ${i === card.index ? 'on' : ''}">${esc(o.text)}${o.sub ? `<small>${esc(o.sub)}</small>` : ''}</div>`).join('');
    this.set('title', this.title, `<div class="logo">${esc(card.logo)}</div><div class="sub">${esc(card.sub)}</div>${opts}<div class="foot">${esc(card.foot)}</div>`);
    this.show(this.title, true);
  }

  titleRects() {
    return [...this.title.querySelectorAll('.opt')].map((el) => el.getBoundingClientRect());
  }

  showTbc(big, small) {
    this.tbc.innerHTML = `<div class="big">${esc(big)}</div><div class="small">${esc(small)}</div>`;
    this.show(this.tbc, true);
  }

  hideTbc() { this.show(this.tbc, false); }

  dispose() {
    this.root.remove();
  }
}
