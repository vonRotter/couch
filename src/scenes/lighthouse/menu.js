import { t, tFor } from '../../core/i18n.js';
import { say as speak } from '../../core/voice.js';
import { ROOMS, AREAS, DOORS, HEART_PIECES, GOLD_SHELLS } from './rooms.js';

// Title card, the item + map screen (hold [C]), "fainted" and "to be continued". Mixed into
// LighthouseEngine.

const SELECTABLE = ['lantern', 'grapple', 'bombs', 'bow'];
const PASSIVE = ['glove', 'fins'];

export const MenuMixin = {
  // ---------- title ----------

  showTitle() {
    this.mode = 'title';
    const opts = [];
    if (this.hasSave) opts.push({ id: 'continue', text: 'lh.continue' });
    opts.push({ id: 'new', text: 'lh.new', sub: this.hasSave ? 'lh.newSub' : '' });
    this.title = { options: opts, index: 0, t: 0 };
    speak(`${t('game.lighthouse')}. ${t('lh.sub')}`);
    this.renderTitle();
  },

  renderTitle() {
    const c = this.title;
    const s = this.save;
    const sub = !this.hasSave ? t('lh.sub')
      : s.flags.beaten ? t('lh.progressDone', { p: this.heartPiecesFound(), pm: this.heartPiecesTotal(), g: this.gshellsFound(), gm: this.gshellsTotal() })
        : t('lh.progress', { c: s.placed || 0, h: s.maxHp / 2 });
    this.hud.setTitle({
      logo: t('game.lighthouse'),
      sub,
      options: c.options.map((o) => ({ text: t(o.text), sub: o.sub ? t(o.sub) : '' })),
      index: c.index,
      foot: tFor(this.host.players[0], 'lh.titleHint'),
    });
  },

  updateTitle(inp, dt) {
    const c = this.title;
    c.t += dt;
    const n = c.options.length;
    if (inp.sy) { c.index = (c.index - inp.sy + n) % n; this.sfx('menu'); this.renderTitle(); }
    if (!inp.a || c.t < 0.35) return;
    this.hud.setTitle(null);
    this.sfx('fanfare');
    if (c.options[c.index].id === 'continue') this.continueGame();
    else this.newGame();
  },

  // ---------- item + map screen ----------

  openMenu() {
    this.mode = 'menu';
    const items = this.menuItems();
    const eq = items.findIndex((it) => it.id === this.save.equip);
    this.menuState = { sel: Math.max(0, eq), restart: false, t: 0 };
    this.sfx('menu');
    this.renderMenu();
  },

  closeMenu() {
    this.mode = 'play';
    this.hud.setMenu(null);
    this.sfx('menu');
  },

  menuItems() {
    const s = this.save;
    const out = [];
    if (s.items.sword) out.push({ id: 'sword', name: t('lh.item.sword') });
    for (const id of SELECTABLE) if (s.items[id]) out.push({ id, name: t(`lh.item.${id}`), equipped: s.equip === id, pick: true });
    for (const id of PASSIVE) if (s.items[id]) out.push({ id, name: t(`lh.item.${id}`) });
    if (s.potion) out.push({ id: 'potion', name: t('lh.item.potion') });
    return out;
  },

  // ---------- 100% counters ----------

  heartPiecesFound() { return HEART_PIECES.filter((id) => this.save.got[id]).length; },
  heartPiecesTotal() { return HEART_PIECES.length; },
  gshellsFound() { return GOLD_SHELLS.filter((id) => this.save.got[id]).length; },
  gshellsTotal() { return GOLD_SHELLS.length; },
  allFound() { return this.heartPiecesFound() === HEART_PIECES.length && this.gshellsFound() === GOLD_SHELLS.length; },

  updateMenu(inp, dt) {
    const M = this.menuState;
    M.t += dt;
    const items = this.menuItems();
    if (inp.sx && !M.restart && items.length) { M.sel = (M.sel + inp.sx + items.length) % items.length; this.sfx('menu'); this.renderMenu(); }
    if (inp.sy) { M.restart = inp.sy < 0; this.sfx('menu'); this.renderMenu(); }
    if (M.t < 0.2) return;
    if (inp.a) {
      if (M.restart) { this.closeMenu(); this.restartRoom(); return; }
      const it = items[M.sel];
      if (it?.pick) { this.save.equip = it.id; this.persist(); this.sfx('select'); this.renderMenu(); }
      return;
    }
    if (inp.b || inp.cPress) this.closeMenu();
  },

  renderMenu() {
    const M = this.menuState;
    const s = this.save;
    const items = this.menuItems();
    const area = this.room.area;
    const stats = [
      ['piece', t('lh.menu.pieces2', { n: s.pieces % 4, f: this.heartPiecesFound(), m: this.heartPiecesTotal() })],
      ['crystal', t('lh.menu.crystals', { n: s.placed || 0 })],
      ['shell', `${s.shells}`],
    ];
    if (this.gshellsFound() || s.flags.act2 || s.flags.beaten) stats.push(['gshell', t('lh.menu.gshells', { n: this.gshellsFound(), m: this.gshellsTotal() })]);
    if (AREAS[area].dungeon) {
      stats.push(['key', `${s.keys[area] || 0}`]);
      if (s.big[area]) stats.push(['bigkey', t('lh.item.bigkey')]);
      if (s.maps[area]) stats.push(['map', t('lh.item.map')]);
      if (s.compass[area]) stats.push(['compass', t('lh.item.compass')]);
    }
    this.hud.setMenu({
      items, sel: M.sel, restartSel: M.restart, stats,
      eqLabel: tFor(this.host.players[0], 'lh.menu.equipped'),
      map: this.mapData(),
      foot: `${tFor(this.host.players[0], 'lh.menu.equip')} · ${tFor(this.host.players[0], 'lh.menu.close')}`,
    });
  },

  /** Grid of rooms for the map panel. */
  mapData() {
    const s = this.save;
    let area = this.room.area;
    let here = this.room.id;
    if (!AREAS[area].dungeon && area !== 'over') {
      // inside a house, a cave or the well: show the island, marking where you went in
      // (two steps for the lamp room: lamp room -> lighthouse -> Lighthouse Point)
      for (let i = 0; i < 2 && here && ROOMS[here].area !== 'over'; i++) {
        const a = ROOMS[here].area;
        const goesIn = (e) => (e.t === 'warp' || e.t === 'well') && (e.to === here || (a !== 'in' && ROOMS[e.to]?.area === a));
        const host = Object.values(ROOMS).find((r) => r.id !== here && Object.values(r.at || {}).some(goesIn));
        here = host ? host.id : null;
      }
      area = 'over';
    }
    const rooms = Object.values(ROOMS).filter((r) => r.area === area);
    const xs = rooms.map((r) => r.gx), ys = rooms.map((r) => r.gy);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const dungeon = AREAS[area].dungeon;
    const hasMap = dungeon && s.maps[area];
    const compass = dungeon && s.compass[area];
    const cells = [];
    for (const r of rooms) {
      const seen = !!s.visited[r.id];
      if (!seen && !hasMap && dungeon) continue;
      const cls = r.id === here ? 'here' : seen ? 'seen' : dungeon ? 'room' : '';
      const chest = compass && this.roomHasTreasure(r);
      cells.push({
        col: r.gx - minX + 1, row: r.gy - minY + 1, cls,
        label: !dungeon && (seen || r.id === here) ? t(r.name) : '',
        dot: chest, boss: compass && r.boss && !s.bosses[r.id],
        doors: dungeon ? Object.keys(DOORS[r.id] || {}) : [],
      });
    }
    const cols = maxX - minX + 1, rows = maxY - minY + 1;
    const cellW = dungeon ? 58 : 108, cellH = dungeon ? 42 : 62;
    return { cols, rows, cells, cellW, cellH, title: t(AREAS[area].name), note: dungeon && !hasMap ? t('lh.menu.noMap') : '' };
  },

  roomHasTreasure(def) {
    const s = this.save;
    for (const e of Object.values(def.at || {})) if (e.t === 'chest' && !e.future && !s.got[e.id]) return true;
    if (def.reward && !s.got[def.reward.id]) return true;
    return false;
  },

  // ---------- fainted / to be continued ----------

  showTbc() {
    this.mode = 'tbc';
    this.tbcT = 0;
    this.game.audio.playMusic('results');
    this.hud.setBig({ t1: t('lh.tbc'), t2: t('lh.tbcSub'), t3: tFor(this.host.players[0], 'lh.tbcHint') });
    speak(`${t('lh.tbc')} ${t('lh.tbcSub')}`);
    this.sfx('fanfare');
    for (let i = 0; i < 4; i++) this.later(i * 0.4, () => this.confettiAt(this.hero.x + (Math.random() - 0.5) * 6, this.hero.z - 1));
  },

  updateTbc(inp, dt) {
    this.tbcT += dt;
    if (this.tbcT > 1.5 && (inp.a || inp.b)) {
      this.hud.setBig(null);
      this.mode = 'play';
      this.playAreaMusic();
    }
  },
};
