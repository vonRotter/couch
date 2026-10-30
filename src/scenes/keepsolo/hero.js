import * as THREE from 'three';
import { COLORS } from '../../core/palette.js';
import { t, tFor } from '../../core/i18n.js';
import { BAG_W, BAG_H, STASH_W, STASH_H, useItem, meetsReq, reqOf, itemName, RARITY_CSS } from './items.js';
import { Grid } from './grid.js';
import { TREE, B_MOVE, STAT_IDS, STAT_POINTS, SKILL_POINTS, skillDef, canRaise } from './classes.js';
import { BELT_SLOTS } from './save.js';

// The hero's Diablo-style kit (mixed into the scene): mana, the hotbar (right mouse button and
// keys 1-4 cast at the mouse pointer), the belt (keys 5-8 use the potion or scroll at the bottom of
// that column; a worn belt adds a second row), potions and scrolls (red heals, blue fills mana,
// Town Portal opens a portal home, Identify shows an item's stats), stat points and skill ranks,
// and the sage's identify and reset.
//
// Keys (mouse and keyboard):  1-4 skills · 5-8 belt · I bag · C hero page · T skill tree ·
//   Alt item names · Esc closes a panel. The keyboard player's own walk keys still walk.

const SKILL_KEYS = ['Digit1', 'Digit2', 'Digit3', 'Digit4'];
const BELT_KEYS = ['Digit5', 'Digit6', 'Digit7', 'Digit8'];
const PANEL_KEYS = { KeyI: 'bag', KeyC: 'char', KeyT: 'tree' };

export const HeroMixin = {
  /** Gamepad player who has not touched the mouse: show [A] / [B] / [C] on the HUD. */
  isPad() {
    return !!this.player?.deviceId?.startsWith('gp') && !this.mouse?.used;
  },

  /** Is this key free (not one of the keyboard player's own walk / button keys)? */
  freeKey(code) {
    const sc = this.game.input.get(this.player?.deviceId)?.scheme;
    if (!sc) return true;
    return ![...sc.up, ...sc.down, ...sc.left, ...sc.right, ...sc.a, ...sc.b, ...sc.c].includes(code);
  },

  keyPressed(code) { return this.game.input.pressed.has(code) && this.freeKey(code); },
  keyDown(code) { return this.game.input.down.has(code) && this.freeKey(code); },

  // ---------------------------------------------------------------- per frame (world)

  /**
   * Hotbar, belt and panel keys, the right mouse button and HUD clicks. Returns true when the hero
   * holds a block (knight).
   */
  updateKit(dt, inp, active) {
    const e = this.hero, hs = this.hs, m = this.mouse;
    e.gcd -= dt;
    e.mpCd = (e.mpCd || 0) - dt;
    e.mana = Math.min(e.st.maxMana, e.mana + e.st.regen * dt);
    if (e.shieldT > 0) { e.shieldT -= dt; if (e.shieldT <= 0) e.shieldHp = 0; }
    if (!active) return false;
    for (const [code, kind] of Object.entries(PANEL_KEYS)) if (this.keyPressed(code)) { this.openPanel(kind); return false; }
    // HUD clicks: unspent points, the hotbar (opens the skill tree), the belt
    if (m.leftPressed && !m.virtual) {
      const el = m.element();
      const open = el?.closest?.('[data-open]');
      if (open) { this.openPanel(open.dataset.open); return false; }
      const bk = el?.closest?.('[data-beltkey]');
      if (bk) { this.useBelt(+bk.dataset.beltkey); return false; }
      if (el?.closest?.('[data-hot]')) { this.openPanel('tree'); return false; }
    }
    for (let i = 0; i < 4; i++) if (this.keyPressed(BELT_KEYS[i])) this.useBelt(i);
    if (this.kind !== 'dungeon' || e.state !== 'walk') return false;
    const at = this.ground && this.mouse.used ? this.ground : null;
    let block = false;
    const tryCast = (id, pressed) => {
      if (!id) return;
      if (id === 'block') { block = true; return; }
      this.ctlCancel();
      this.castSkill(id, at, !pressed);
    };
    // right mouse button: the chosen skill (held: again when ready)
    if ((m.rightPressed || m.right) && !m.virtual && !this.pointerOnUi()) tryCast(hs.bar.rmb, m.rightPressed);
    for (let i = 0; i < 4; i++) if (this.keyDown(SKILL_KEYS[i]) || this.keyPressed(SKILL_KEYS[i])) tryCast(hs.bar.k[i], this.keyPressed(SKILL_KEYS[i]));
    return block;
  },

  // ---------------------------------------------------------------- belt

  beltCap() {
    const b = this.hs.gear.belt;
    return b && meetsReq(b, this.hero?.st?.attrs || {}) ? BELT_SLOTS : 4;
  },

  /** Potions drop down in their column; a lost second row goes into the bag. */
  settleBelt() {
    const belt = this.hs.belt, cap = this.beltCap();
    for (let c = 0; c < 4; c++) if (!belt[c] && belt[4 + c]) { belt[c] = belt[4 + c]; belt[4 + c] = null; }
    if (cap === 4) {
      for (let c = 4; c < 8; c++) {
        if (!belt[c]) continue;
        const it = belt[c];
        belt[c] = null;
        if (!this.bagGrid().add(it)) this.data.lost.push(it);
      }
    }
  },

  /** A potion or scroll onto the belt: on top of the same kind, else an empty column. */
  beltAdd(it) {
    if (it.slot !== 'use') return false;
    const belt = this.hs.belt, cap = this.beltCap();
    if (cap > 4) for (let c = 0; c < 4; c++) if (belt[c]?.use === it.use && !belt[4 + c]) { belt[4 + c] = it; return true; }
    for (let c = 0; c < 4; c++) if (!belt[c]) { belt[c] = it; return true; }
    if (cap > 4) for (let c = 0; c < 4; c++) if (!belt[4 + c]) { belt[4 + c] = it; return true; }
    return false;
  },

  bagGrid() { return new Grid(this.hs.bag, BAG_W, BAG_H); },
  stashGrid() { return new Grid(this.data.stash, STASH_W, STASH_H); },

  newUse(use) { return useItem(use); },

  countUse(use) {
    return this.hs.belt.filter((x) => x?.use === use).length + this.hs.bag.filter((e) => e.it.use === use).length;
  },

  /** Key 5-8 (or a click on the belt): use the bottom potion or scroll of that column. */
  useBelt(col) {
    const it = this.hs.belt[col];
    if (!it) { this.game.audio.play('bump'); return false; }
    const r = this.useConsumable(it);
    if (r === true) { this.consume(it); }
    return !!r;
  },

  /** The first potion / scroll of a kind (belt first, then bag): the gamepad menu uses it. */
  useFirst(use) {
    const i = this.hs.belt.findIndex((x) => x?.use === use);
    if (i >= 0) { const it = this.hs.belt[i]; if (this.useConsumable(it) === true) this.consume(it); return; }
    const e = this.hs.bag.find((x) => x.it.use === use);
    if (e) { if (this.useConsumable(e.it) === true) this.consume(e.it); return; }
    this.game.ui.toast(t('ks.noneLeft', { what: t(`ks.use.${use}`) }), 1400);
    this.game.audio.play('bump');
  },

  /** Take a used potion / scroll out of the belt or the bag. */
  consume(it) {
    const hs = this.hs;
    const i = hs.belt.indexOf(it);
    if (i >= 0) { hs.belt[i] = null; this.settleBelt(); }
    const e = hs.bag.find((x) => x.it === it);
    if (e) this.bagGrid().remove(e);
    this.dirty = true;
  },

  /**
   * Drink or read a potion / scroll. Returns true (used up), 'keep' (an Identify scroll waiting for
   * an item) or false (not now: full health, not in the dungeon...).
   */
  useConsumable(it, panel = null) {
    const e = this.hero;
    if (e.state !== 'walk') return false;
    switch (it.use) {
      case 'hp': {
        if (e.potCd > 0) return false;
        if (e.hp >= e.st.maxHp - 0.5) { this.game.ui.toast(t('ks.fullHp'), 1200); return false; }
        e.potCd = 0.3;
        e.hp = Math.min(e.st.maxHp, e.hp + e.st.maxHp * 0.45 * (e.st.powers.has('potion') ? 2 : 1));
        this.game.audio.play('star');
        this.puffs.burst(new THREE.Vector3(e.x, 1, e.z), 0xff8fa8, { count: 10, size: 0.35, life: 0.6 });
        this.floater(t('ks.gulp'), new THREE.Vector3(e.x, 2.3, e.z), '#ff3b6b', 0.9, true);
        return true;
      }
      case 'mp': {
        if (e.mpCd > 0) return false;
        if (e.mana >= e.st.maxMana - 0.5) { this.game.ui.toast(t('ks.fullMana'), 1200); return false; }
        e.mpCd = 0.3;
        e.mana = Math.min(e.st.maxMana, e.mana + e.st.maxMana * 0.6 * (e.st.powers.has('potion') ? 1.6 : 1));
        this.game.audio.play('star');
        this.puffs.burst(new THREE.Vector3(e.x, 1, e.z), 0x8fb8ff, { count: 10, size: 0.35, life: 0.6 });
        this.floater(t('ks.gulp'), new THREE.Vector3(e.x, 2.3, e.z), '#2f6fe0', 0.9, true);
        return true;
      }
      case 'tp':
        if (this.kind !== 'dungeon') { this.game.ui.toast(t('ks.tpTown'), 1400); this.game.audio.play('bump'); return false; }
        if (panel) { this.closePanel(); }
        return this.castPortal();
      case 'id': {
        const any = [...this.hs.bag.map((x) => x.it), ...Object.values(this.hs.gear)].some((x) => x.unid);
        if (!any) { this.game.ui.toast(t('ks.idNothing'), 1600); this.game.audio.play('bump'); return false; }
        // the scroll waits on the pointer: click an unidentified item in the bag
        if (!panel || panel.mode !== 'bag') { this.openPanel('bag'); panel = this.panel; }
        panel.identifying = it;
        panel.note(t('ks.idPick'), true, true);
        return 'keep';
      }
      default: return false;
    }
  },

  /** Show an item's stats. */
  identify(it) {
    if (!it.unid) return;
    delete it.unid;
    this.refreshHero();
    this.game.audio.play(it.rarity >= 3 ? 'fanfare' : 'star');
    this.dirty = true;
  },

  // ---------------------------------------------------------------- stats and skills

  reqText(it) {
    return Object.entries(reqOf(it)).map(([k, v]) => t('ks.needs', { n: v, stat: t(`ks.attr.${k}`) })).join(', ');
  },

  /** One stat point into Strength, Dexterity, Magic or Vitality. */
  raiseStat(k, n = 1) {
    const hs = this.hs;
    n = Math.min(n, hs.statPts);
    if (n <= 0 || !STAT_IDS.includes(k)) return false;
    hs.statPts -= n;
    hs.attrs[k] += n;
    this.refreshHero();
    this.game.audio.play('select');
    this.dirty = true;
    return true;
  },

  /** One skill point into a skill (a new skill lands on the first free hotbar slot). */
  raiseSkill(id) {
    const hs = this.hs;
    const why = canRaise(this.cls, hs, id);
    if (why) return why;
    hs.skillPts--;
    const first = !hs.ranks[id];
    hs.ranks[id] = (hs.ranks[id] || 0) + 1;
    const def = skillDef(this.cls, id);
    if (first && def.kind !== 'passive') {
      const bar = hs.bar;
      if (!bar.rmb && def.kind === 'active') bar.rmb = id;
      else if (!bar.k.includes(id) && bar.rmb !== id) { const i = bar.k.indexOf(null); if (i >= 0) bar.k[i] = id; }
    }
    this.refreshHero();
    this.game.audio.play('star');
    this.dirty = true;
    return '';
  },

  /** Put a skill on a hotbar slot ('rmb' or 0-3); it leaves any other slot. */
  assignSkill(slot, id) {
    const bar = this.hs.bar;
    if (id && !this.hs.ranks[id]) return false;
    if (id && skillDef(this.cls, id)?.kind === 'passive') return false;
    if (bar.rmb === id) bar.rmb = null;
    bar.k = bar.k.map((x) => (x === id ? null : x));
    if (slot === 'rmb') bar.rmb = id; else bar.k[slot] = id;
    this.game.audio.play('select');
    this.dirty = true;
    return true;
  },

  resetCost() {
    return 50 + this.hs.level * 25;
  },

  /** The sage's reset: every stat and skill point back, for coins. */
  resetPoints(panel) {
    const hs = this.hs, c = this.resetCost();
    if (hs.coins < c) { panel?.note(t('ks.poor'), false); return false; }
    hs.coins -= c;
    const bm = B_MOVE[this.cls];
    hs.attrs = { str: 0, dex: 0, mag: 0, vit: 0 };
    hs.statPts = STAT_POINTS * (hs.level - 1);
    hs.ranks = { [bm]: 1 };
    hs.skillPts = SKILL_POINTS * hs.level;
    hs.bar = { rmb: null, k: [bm, null, null, null] };
    this.refreshHero();
    this.settleBelt();
    panel?.note(t('ks.resetDone'), true, true);
    this.npcSay('snore', t('ks.npc.snore.reset'));
    this.saveNow();
    return true;
  },

  /** Level up: 5 stat points and a skill point, and a banner telling where to spend them. */
  levelUpKit() {
    const hs = this.hs;
    hs.statPts += STAT_POINTS;
    hs.skillPts += SKILL_POINTS;
    const opens = TREE[this.cls].filter((s) => s.lv === hs.level).map((s) => t(`ks.skill.${s.id}`));
    const sub = tFor(this.player, this.isPad() ? 'ks.levelPtsPad' : 'ks.levelPts', { n: STAT_POINTS });
    this.game.ui.banner(t('ks.levelUp', { n: hs.level }), sub, 2200);
    this.say(`${t('ks.levelUp', { n: hs.level })} ${sub}${opens.length ? ` ${t('ks.newSkills', { list: opens.join(', ') })}` : ''}`);
  },

  /** A floating name for a picked-up item, in its rarity color. */
  pickFloater(it, better) {
    this.floater(t(better ? 'ks.pickedBetter' : 'ks.picked', { name: itemName(it) }), new THREE.Vector3(this.hero.x, 2.6, this.hero.z), RARITY_CSS[it.rarity], 1.6, true);
  },

  /** Confetti for spending points (the panels call it). */
  pointFx() {
    const e = this.hero;
    this.confetti.burst(new THREE.Vector3(e.x, 1.2, e.z), 0, { count: 12, speed: 3, up: 4, colors: [COLORS.gold, 0xffffff], life: 0.7, size: 0.1 });
  },
};
