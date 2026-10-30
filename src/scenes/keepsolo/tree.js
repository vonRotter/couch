import { t, tFor } from '../../core/i18n.js';
import { esc } from '../../core/ui.js';
import { say } from '../../core/voice.js';
import { TREE, MAX_RANK, STAT_IDS, BASE_STATS, MAIN_STAT, skillDef, manaCost, canRaise, armorCut, xpNeed, CLASS_COLOR, GLYPH } from './classes.js';
import { skillIcon } from './ui.js';

// The hero page (C) and the skill tree (T) of Pillow Keep Solo.
//   Hero page: the four stats with a + button each (5 points every level), and what they do.
//   Skill tree: ten skills per class in four rows (lower rows open at higher levels and need the
//   skill above them). Click a skill to see it, "Learn" spends a skill point. To put a skill on the
//   hotbar: click it, then press 1-4 (or click a hotbar slot), or drag it onto a slot.
// Gamepad: the stick moves the pointer, [A] clicks, [C] right-clicks (clears a hotbar slot), [B] closes.

class BasePanel {
  constructor(scene) {
    this.s = scene;
    this.el = document.createElement('div');
    this.el.className = 'ks-panel ks-tree';
    scene.hud.layer.appendChild(this.el);
    if (!document.getElementById('ks-tree-css')) {
      const st = document.createElement('style');
      st.id = 'ks-tree-css';
      st.textContent = CSS;
      document.head.appendChild(st);
    }
  }

  note(msg, good = true, speak = false) {
    this.msg = msg;
    this.good = good;
    this.s.game.audio.play(good ? 'star' : 'bump');
    if (speak) say(msg);
    this.render();
  }

  /** Mouse (or the stick-driven pointer) over this panel: the element under it. */
  pointed() {
    const el = this.s.mouse.element();
    return el && this.el.contains(el) ? el : null;
  }

  update(dt, d) {
    const s = this.s, m = s.mouse;
    if (s.isPad() || m.virtual || !m.used) m.drive(d, dt);
    if (d?.bPressed) { this.close(); return true; }
    const el = this.pointed();
    this.hover(el);
    if (m.leftPressed) this.click(el);
    if (m.leftReleased) this.release?.(el);
    if (m.rightPressed) this.rightClick?.(el);
    this.keys?.();
    return false;
  }

  hover() {}

  close() {
    this.el.remove();
    this.s.saveNow();
  }
}

// ---------------------------------------------------------------- hero page

export class CharPanel extends BasePanel {
  constructor(scene) {
    super(scene);
    this.msg = '';
    this.render();
    const hs = scene.hs;
    say(`${t(`ks.cls.${scene.cls}`)}. ${t('ks.lv', { n: hs.level })}. ${hs.statPts ? t('ks.ptsLeft', { n: hs.statPts }) : ''}`);
  }

  render() {
    const s = this.s, hs = s.hs, st = s.hero.st;
    const rows = STAT_IDS.map((k) => {
      const base = BASE_STATS[s.cls][k] + hs.attrs[k];
      const bonus = st.attrs[k] - base;
      const main = MAIN_STAT[s.cls] === k ? ' ★' : '';
      return `<div class="ks-stat"><b>${esc(t(`ks.attr.${k}`))}${main}</b><span class="v">${st.attrs[k]}${bonus ? `<small> (+${bonus})</small>` : ''}</span>
        <span class="plus ${hs.statPts ? '' : 'off'}" data-stat="${k}">+</span><small class="what">${esc(t(`ks.attrDesc.${k}.${MAIN_STAT[s.cls] === k ? 'main' : 'other'}`))}</small></div>`;
    }).join('');
    const cut = Math.round(armorCut(st.armor, s.D) * 100);
    const nums = [
      [t('ks.n.dmg'), Math.round(st.dmg)], [t('ks.n.hp'), st.maxHp], [t('ks.n.mana'), st.maxMana], [t('ks.n.regen'), `${st.regen.toFixed(1)}/s`],
      [t('ks.n.armor'), `${Math.round(st.armor)} (${cut}%)`], [t('ks.n.rate'), `+${Math.round((st.rate - 1) * 100)}%`], [t('ks.n.speed'), `+${Math.round((st.speed - 1) * 100)}%`],
      [t('ks.n.luck'), `${Math.round(st.luck * 100)}%`], [t('ks.n.light'), `+${st.light}`],
    ].map(([a, b]) => `<div class="ks-num"><span>${esc(a)}</span><b>${esc(String(b))}</b></div>`).join('');
    this.el.innerHTML = `<h2><span style="color:${CLASS_COLOR[s.cls]}">${GLYPH[s.cls]}</span> ${esc(t(`ks.cls.${s.cls}`))}<small>${esc(t('ks.lv', { n: hs.level }))} · XP ${Math.floor(hs.xp)} / ${xpNeed(hs.level)}</small></h2>
      <div class="ks-pts2">${esc(hs.statPts ? t('ks.ptsLeft', { n: hs.statPts }) : t('ks.ptsNone'))}</div>
      <div class="ks-row"><div class="ks-stats">${rows}</div><div class="ks-nums">${nums}</div></div>
      <div class="ks-verdict ${this.good === false ? 'bad' : 'good'}">${esc(this.msg || ' ')}</div>
      <div class="foot">${esc(tFor(s.player, s.isPad() ? 'ks.hintPad.char' : 'ks.hintMouse.char'))}</div>`;
  }

  click(el) {
    const b = el?.closest?.('[data-stat]');
    if (!b) return;
    const k = b.dataset.stat;
    const m = this.s.mouse;
    if (!this.s.raiseStat(k, m.clickShift || m.shift ? 5 : 1)) { this.note(t('ks.ptsNone'), false); return; }
    this.s.pointFx();
    this.note(t('ks.statUp', { stat: t(`ks.attr.${k}`), n: this.s.hero.st.attrs[k] }), true, true);
  }
}

// ---------------------------------------------------------------- skill tree

export class TreePanel extends BasePanel {
  constructor(scene) {
    super(scene);
    this.sel = scene.hs.bar.rmb || TREE[scene.cls][0].id;
    this.msg = '';
    this.drag = null;
    this.render();
    say(`${t('ks.treeTitle')}. ${scene.hs.skillPts ? t('ks.skillPtsLeft', { n: scene.hs.skillPts }) : ''}`);
  }

  nodeHtml(def) {
    const s = this.s, hs = s.hs;
    const r = hs.ranks[def.id] || 0;
    const why = canRaise(s.cls, hs, def.id);
    const state = r ? 'have' : why === 'level' || why === 'need' ? 'locked' : 'open';
    const can = !why ? 'can' : '';
    return `<div class="ks-node ${state} ${can} ${this.sel === def.id ? 'sel' : ''}" data-skill="${def.id}" style="grid-row:${def.row + 1};grid-column:${def.col + 1}">
      ${skillIcon(def.id)}<b>${esc(t(`ks.skill.${def.id}`))}</b><span class="rk">${r}/${MAX_RANK}</span>${def.kind === 'passive' ? `<span class="pas">${esc(t('ks.passive'))}</span>` : ''}</div>`;
  }

  barHtml() {
    const s = this.s, bar = s.hs.bar;
    const slot = (key, id, label) => `<div class="ks-sk ks-hot" data-slot="${key}">${id ? skillIcon(id) : ''}<span class="key">${esc(label)}</span></div>`;
    return `<div class="ks-label">${esc(t('ks.hotbar'))}</div><div class="ks-hotbar">${slot('rmb', bar.rmb, t('ks.key.rmb'))}${bar.k.map((id, i) => slot(i, id, String(i + 1))).join('')}</div>`;
  }

  infoHtml() {
    const s = this.s, hs = s.hs, def = skillDef(s.cls, this.sel);
    if (!def) return '';
    const r = hs.ranks[def.id] || 0;
    const why = canRaise(s.cls, hs, def.id);
    const lines = [t(`ks.skillDesc.${def.id}`)];
    if (def.kind === 'passive') lines.push(t(`ks.passiveDesc.${def.id}`, { n: r, next: Math.min(MAX_RANK, r + 1) }));
    else {
      if (def.mana) lines.push(t('ks.costLine', { n: manaCost(def, Math.max(1, r)) }));
      if (def.cd) lines.push(t('ks.cdLine', { n: def.cd }));
      if (def.kind !== 'hold' && def.kind !== 'move') lines.push(t('ks.rankLine', { n: Math.max(1, r) * 20 + 80 }));
    }
    let need = '';
    if (why === 'level') need = t('ks.needLevel', { n: def.lv });
    else if (why === 'need') need = t('ks.needSkill', { skill: t(`ks.skill.${def.need}`) });
    else if (why === 'max') need = t('ks.maxRank');
    const btn = `<div class="ks-btn ${why ? 'off' : ''}" data-act="raise">${esc(r ? t('ks.raise', { n: r + 1 }) : t('ks.learn'))}</div>`;
    return `<div class="ks-info"><h4>${skillIcon(def.id)} ${esc(t(`ks.skill.${def.id}`))} <small>${r}/${MAX_RANK}</small></h4>${lines.map((l) => `<p>${esc(l)}</p>`).join('')}
      ${need ? `<p class="need">${esc(need)}</p>` : ''}${btn}</div>`;
  }

  render() {
    const s = this.s, hs = s.hs;
    const nodes = TREE[s.cls].map((d) => this.nodeHtml(d)).join('');
    // lines from a skill to the ones that need it
    const lines = TREE[s.cls].filter((d) => d.need).map((d) => {
      const p = skillDef(s.cls, d.need);
      return `<i class="ks-link ${hs.ranks[d.need] ? 'on' : ''}" style="grid-row:${p.row + 1} / span ${d.row - p.row + 1};grid-column:${Math.min(p.col, d.col) + 1} / span ${Math.abs(d.col - p.col) + 1};--dir:${d.col > p.col ? 1 : d.col < p.col ? -1 : 0}"></i>`;
    }).join('');
    this.el.innerHTML = `<h2>${esc(t('ks.treeTitle'))}<small>${esc(hs.skillPts ? t('ks.skillPtsLeft', { n: hs.skillPts }) : t('ks.skillPtsNone'))}</small></h2>
      <div class="ks-row"><div class="ks-treegrid">${lines}${nodes}</div><div class="ks-side2">${this.infoHtml()}${this.barHtml()}</div></div>
      <div class="ks-verdict ${this.good === false ? 'bad' : 'good'}">${esc(this.msg || ' ')}</div>
      <div class="foot">${esc(tFor(s.player, s.isPad() ? 'ks.hintPad.tree' : 'ks.hintMouse.tree'))}</div>`;
  }

  hover(el) {
    const n = el?.closest?.('[data-skill]');
    const id = n?.dataset.skill || null;
    if (id !== this.said && id) { this.said = id; say(`${t(`ks.skill.${id}`)}. ${t(`ks.skillDesc.${id}`)}`); }
  }

  click(el) {
    const n = el?.closest?.('[data-skill]');
    if (n) {
      this.sel = n.dataset.skill;
      this.drag = this.sel;
      this.msg = '';
      this.s.game.audio.play('select');
      this.render();
      return;
    }
    const slot = el?.closest?.('[data-slot]');
    if (slot) { this.assign(slot.dataset.slot); return; }
    if (el?.closest?.('[data-act="raise"]')) this.raise();
  }

  /** Drag a skill onto a hotbar slot. */
  release(el) {
    const slot = el?.closest?.('[data-slot]');
    if (this.drag && slot) this.assign(slot.dataset.slot);
    this.drag = null;
  }

  rightClick(el) {
    const slot = el?.closest?.('[data-slot]');
    if (!slot) return;
    const k = slot.dataset.slot;
    const bar = this.s.hs.bar;
    if (k === 'rmb') bar.rmb = null; else bar.k[+k] = null;
    this.s.dirty = true;
    this.note(t('ks.slotCleared'));
  }

  /** Keys 1-4 put the chosen skill on that slot. */
  keys() {
    for (let i = 0; i < 4; i++) if (this.s.keyPressed(`Digit${i + 1}`)) this.assign(String(i));
  }

  assign(key) {
    const s = this.s, id = this.sel;
    const slot = key === 'rmb' ? 'rmb' : +key;
    if (!s.hs.ranks[id]) { this.note(t('ks.learnFirst'), false); return; }
    if (skillDef(s.cls, id).kind === 'passive') { this.note(t('ks.passiveNoSlot'), false); return; }
    s.assignSkill(slot, id);
    this.note(t('ks.slotSet', { skill: t(`ks.skill.${id}`), key: key === 'rmb' ? t('ks.key.rmb') : String(slot + 1) }), true, true);
  }

  raise() {
    const s = this.s, id = this.sel;
    const why = s.raiseSkill(id);
    if (why) { this.note(t(`ks.why.${why}`), false, true); return; }
    s.pointFx();
    this.note(t('ks.learned', { skill: t(`ks.skill.${id}`), n: s.hs.ranks[id] }), true, true);
  }
}

const CSS = `
.ks-tree { --cs: clamp(26px, 3.1vw, 46px); }
.ks-stats { display: flex; flex-direction: column; gap: 6px; min-width: min(420px, 44vw); text-align: left; }
.ks-stat { display: grid; grid-template-columns: 8em 4.5em 2.2em 1fr; align-items: center; gap: 6px; background: #fff; border-radius: 14px; padding: 6px 10px; box-shadow: 0 3px 0 rgba(43,35,64,.12); }
.ks-stat .v { font-size: 1.2em; font-weight: 700; } .ks-stat .v small { color: #16a46a; font-size: .7em; }
.ks-stat .plus { width: 1.6em; height: 1.6em; border-radius: 50%; background: #ffd23f; display: flex; align-items: center; justify-content: center; font-weight: 700; cursor: pointer;
  box-shadow: 0 3px 0 rgba(43,35,64,.25); font-size: 1.1em; }
.ks-stat .plus.off { opacity: .3; cursor: default; }
.ks-stat .what { font-size: .72em; opacity: .7; line-height: 1.15; }
.ks-nums { display: flex; flex-direction: column; gap: 3px; min-width: 13em; text-align: left; }
.ks-num { display: flex; justify-content: space-between; gap: 10px; background: #fff; border-radius: 10px; padding: 3px 10px; font-size: .9em; }
.ks-pts2 { display: inline-block; background: #fffbe6; border: 3px solid #ffd23f; border-radius: 14px; padding: 3px 14px; margin-bottom: 8px; font-weight: 700; }
.ks-treegrid { position: relative; display: grid; grid-template-columns: repeat(3, calc(var(--cs) * 2.6)); grid-auto-rows: calc(var(--cs) * 2.2); gap: calc(var(--cs) * .5) calc(var(--cs) * .4); }
.ks-node { position: relative; z-index: 1; background: #fff; border-radius: 14px; border: 3px solid #d6cfe6; display: flex; flex-direction: column; align-items: center; justify-content: center;
  font-size: .72em; line-height: 1.05; padding: 3px; cursor: pointer; text-align: center; }
.ks-node svg { width: calc(var(--cs) * .95); height: calc(var(--cs) * .95); }
.ks-node .rk { position: absolute; right: 4px; top: 2px; font-weight: 700; color: #8a45e0; }
.ks-node .pas { position: absolute; left: 4px; top: 2px; font-size: .8em; opacity: .6; }
.ks-node.locked { opacity: .45; filter: grayscale(.8); }
.ks-node.have { border-color: #3ddc97; background: #effcf5; }
.ks-node.can { box-shadow: 0 0 0 3px #ffd23f; }
.ks-node.sel { border-color: #2b2340; transform: translateY(-3px); }
.ks-link { position: relative; z-index: 0; pointer-events: none; }
.ks-link::before { content: ''; position: absolute; left: calc(50% - 3px + var(--dir) * 0%); top: calc(var(--cs) * 1.1); bottom: calc(var(--cs) * 1.1); width: 6px; border-radius: 3px; background: #d6cfe6; }
.ks-link.on::before { background: #3ddc97; }
.ks-side2 { display: flex; flex-direction: column; gap: 8px; width: min(340px, 34vw); text-align: left; }
.ks-info { background: #fff; border-radius: 16px; padding: 8px 12px; box-shadow: 0 3px 0 rgba(43,35,64,.12); }
.ks-info h4 { margin: 0 0 4px; display: flex; align-items: center; gap: 6px; } .ks-info h4 svg { width: 1.8em; height: 1.8em; }
.ks-info p { margin: 2px 0; font-size: .88em; } .ks-info .need { color: #e8243f; font-weight: 700; }
.ks-info .ks-btn { display: inline-block; margin-top: 6px; }
.ks-hotbar { display: flex; gap: 6px; --slot: calc(var(--cs) * 1.3); }
.ks-hot { cursor: pointer; }
`;
