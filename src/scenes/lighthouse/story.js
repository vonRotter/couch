import { t } from '../../core/i18n.js';
import { say as speak } from '../../core/voice.js';
import { makeItem } from './models.js';
import { tileX, tileZ, colOf, rowOf } from './tiles.js';
import { QUESTS, GOLD_SHELLS } from './rooms.js';

// Dialog, townsfolk, chests, items, the shop, beacon stones, the great lamp and the little cutscenes.
// Mixed into LighthouseEngine. Every line on screen is also read aloud (if voice is on).

export const VOICES = {
  keeper: { pitch: 0.7, rate: 0.88, css: '#6b7bb0' },
  olga: { pitch: 1.25, rate: 0.85, css: '#9b5de5' },
  tobi: { pitch: 1.65, rate: 1.1, css: '#e0a400' },
  mira: { pitch: 1.3, rate: 1.0, css: '#16b874' },
  pell: { pitch: 0.85, rate: 0.92, css: '#f26b1d' },
  mitten: { pitch: 1.8, rate: 1.1, css: '#ff9f2e' },
  sela: { pitch: 1.35, rate: 1.05, css: '#5f7f9e' },
  murky: { pitch: 1.55, rate: 0.95, css: '#5a4d7a' },
  murk: { pitch: 0.55, rate: 0.85, css: '#2b2340' },
  sign: { pitch: 1.0, rate: 0.95, css: '#8a5a32' },
  you: { pitch: 1.1, rate: 1.0, css: '#2b2340' },
};

const MAJOR = new Set(['sword', 'lantern', 'grapple', 'key', 'bigkey', 'map', 'compass', 'heartpiece', 'container', 'crystal', 'potion', 'shells20', 'shells50',
  'glove', 'bombs', 'fins', 'bow', 'gshell']);
const TOOLS = ['sword', 'lantern', 'grapple', 'glove', 'bombs', 'fins', 'bow'];
const EQUIP = new Set(['lantern', 'grapple', 'bombs', 'bow']);

export const StoryMixin = {
  // ---------- dialog ----------

  /** Show lines one by one: [{ who, key, vars, choices: [key, key], onChoice(i) }]. Calls done() at the end. */
  say(lines, done) {
    this.dlg = { lines, i: 0, t: 0, back: this.mode === 'dialog' ? this.dlg?.back : this.mode, done, choice: 0 };
    this.mode = 'dialog';
    this.showLine();
  },

  showLine() {
    const d = this.dlg;
    const L = d.lines[d.i];
    const v = VOICES[L.who] || VOICES.you;
    const text = t(L.key, L.vars);
    d.t = 0;
    d.choice = 0;
    const who = L.who === 'you' ? '' : t(`lh.who.${L.who}`);
    this.hud.setDialog({ who, text, css: L.who === 'you' ? this.host.players[0]?.css : v.css, choices: L.choices?.map((k) => t(k)), index: 0 });
    speak(text, { pitch: v.pitch, rate: v.rate });
    this.sfx('text');
  },

  updateDialog(inp, dt = 1 / 60) {
    const d = this.dlg;
    const L = d.lines[d.i];
    d.t += dt;
    if (L.choices) {
      const step = inp.sx || -inp.sy;
      if (step) {
        d.choice = (d.choice + step + L.choices.length) % L.choices.length;
        this.sfx('menu');
        this.hud.setDialog({ who: L.who === 'you' ? '' : t(`lh.who.${L.who}`), text: t(L.key, L.vars), css: (VOICES[L.who] || VOICES.you).css, choices: L.choices.map((k) => t(k)), index: d.choice });
      }
    }
    if (d.t < 0.25) return;
    if (inp.a || inp.b) {
      const pick = L.choices ? (inp.b ? L.choices.length - 1 : d.choice) : -1;
      d.i++;
      if (L.onChoice) {
        this.hud.setDialog(null);
        this.mode = d.back;
        L.onChoice(pick);
        return;
      }
      if (d.i < d.lines.length) { this.showLine(); return; }
      this.hud.setDialog(null);
      this.mode = d.back;
      this.dlg = null;
      d.done?.();
    }
  },

  /** A short note that does not stop the game (bumping a locked door...). */
  notice(key) {
    if (this.noticeCool > 0 && this.noticeKey === key) return;
    this.noticeCool = 2.2;
    this.noticeKey = key;
    this.game.ui.toast(t(key), 1800);
    speak(t(key));
  },

  hintOnce(key) {
    this.save.flags.hints ||= {};
    if (this.save.flags.hints[key]) return;
    this.save.flags.hints[key] = true;
    this.notice(key);
  },

  // ---------- townsfolk ----------

  /** The keeper's advice: where to go next (works for any order of dungeons). */
  nextHint() {
    const s = this.save;
    if (!s.items.sword) return 'lh.k.sword';
    if (s.flags.beaten) return 'lh.k.after';
    if ((s.placed || 0) >= 3) return 'lh.k.hint.top';
    if (!s.bosses.d1_boss) return s.items.lantern ? 'lh.k.go2' : 'lh.k.go1';
    if (!s.bosses.d2_boss) return 'lh.k.one';
    if (!s.bosses.d3_boss) {
      if (!s.items.glove) return 'lh.k.hint.well';
      if (!s.items.bombs) return 'lh.k.hint.pell';
      return 'lh.k.hint.storm';
    }
    return 'lh.k.done';
  },

  npcLines(id) {
    const s = this.save;
    const L = (...keys) => keys.map((key) => ({ who: id, key }));
    const it = s.items;
    if (id === 'keeper') {
      if ((s.placed || 0) === 2 && !s.bosses.d3_boss && it.sword) return L('lh.k.two', this.nextHint());
      return L(this.nextHint());
    }
    if (id === 'olga') {
      if (s.flags.catFound && !s.got['q.fins']) return L('lh.olga.fins1', 'lh.olga.fins2');
      if (s.got['q.fins']) return L('lh.olga.after');
      if (it.bombs) return L('lh.olga.cat1', 'lh.olga.cat2');
      if (it.glove) return L('lh.olga.glove');
      if (it.lantern && it.grapple) return L('lh.olga.well1', 'lh.olga.well2');
      return it.lantern ? L('lh.olga3') : L('lh.olga1', 'lh.olga2');
    }
    if (id === 'tobi') {
      const n = s.gshells || 0;
      const quest = QUESTS.find((q) => q.npc === 'tobi' && !s.got[q.id] && n >= q.need.gshells);
      if (quest) return L(quest.need.gshells >= GOLD_SHELLS.length ? 'lh.tobi.gs10' : 'lh.tobi.gs5');
      if (n > 0) return [{ who: id, key: 'lh.tobi.gsN', vars: { n, m: GOLD_SHELLS.length } }];
      if ((s.placed || 0) >= 2 || it.glove) return L('lh.tobi.gs0');
      const k = (s.talk.tobi = ((s.talk.tobi || 0) + 1) % 3);
      return L(['lh.tobi1', 'lh.tobi2', 'lh.tobi3'][k]);
    }
    if (id === 'mira') return L('lh.mira1');
    if (id === 'pell') {
      if (it.fins) return L('lh.pell.seal');
      if (it.bombs) return L('lh.pell.bombs');
      if (it.glove) return L('lh.pell.lift');
      return L('lh.pell1', 'lh.pell2');
    }
    if (id === 'mitten') return L('lh.cat1', 'lh.cat2');
    if (id === 'sela') return L('lh.seal1', 'lh.seal2');
    if (id === 'murky') return L(s.flags.beaten ? 'lh.murky1' : 'lh.murky0');
    return [];
  },

  talkTo(e) {
    // turn to face the hero
    const h = this.hero;
    e.char?.face(h.x - e.x, h.z - e.z);
    if (e.id === 'mitten') this.sfx('meow');
    if (e.id === 'sela') this.sfx('ark');
    this.say(this.npcLines(e.id), () => this.afterTalk(e));
  },

  /** Quests: a found cat, swim fins from Olga, Tobi's golden shell rewards. */
  afterTalk(e) {
    const s = this.save;
    for (const q of QUESTS) {
      if (q.npc !== e.id) continue;
      if (q.flag && !s.flags[q.flag]) {
        s.flags[q.flag] = true;
        this.persist();
        if (e.id === 'mitten') {
          // she dashes home
          this.poof(e.x, e.z, 0.2);
          this.room.occ.delete(`${e.c},${e.r}`);
          this.room.ents = this.room.ents.filter((x) => x !== e);
          e.mesh.parent?.remove(e.mesh);
        }
        return;
      }
      if (!q.item || s.got[q.id]) continue;
      if (q.need?.flag && !s.flags[q.need.flag]) continue;
      if (q.need?.gshells && (s.gshells || 0) < q.need.gshells) continue;
      this.giveItem(q.item, { id: q.id });
      return;
    }
  },

  // ---------- items ----------

  openChest(e) {
    if (e.opened) return;
    e.opened = true;
    this.save.got[e.id] = true;
    this.sfx('chest');
    const lid = e.mesh.userData.lid;
    this.room.anim.push({ m: lid, t: 0, dur: 0.3, kind: 'lid' });
    this.later(0.3, () => { lid.rotation.x = -1.9; });
    this.giveItem(e.item, { id: e.id });
  },

  /** Apply an item and show the "you got it" moment for important ones. */
  giveItem(item, { id = null, quiet = false } = {}) {
    const s = this.save;
    const area = this.room.area;
    if (id) s.got[id] = true;
    let key = `lh.get.${item}`;
    let vars;
    switch (item) {
      case 'shell': s.shells += 1; break;
      case 'shell5': s.shells += 5; break;
      case 'shells20': s.shells += 20; key = 'lh.get.shells'; vars = { n: 20 }; break;
      case 'shells50': s.shells += 50; key = 'lh.get.shells'; vars = { n: 50 }; break;
      case 'heart': s.hp = Math.min(s.maxHp, s.hp + 2); break;
      case 'sword': case 'lantern': case 'grapple': case 'glove': case 'bombs': case 'fins': case 'bow':
        s.items[item] = true;
        if (EQUIP.has(item)) s.equip = item;
        break;
      case 'gshell': s.gshells = (s.gshells || 0) + 1; vars = { n: s.gshells, m: GOLD_SHELLS.length }; break;
      case 'key': s.keys[area] = (s.keys[area] || 0) + 1; break;
      case 'bigkey': s.big[area] = true; break;
      case 'map': s.maps[area] = true; break;
      case 'compass': s.compass[area] = true; break;
      case 'heartpiece':
        s.pieces++;
        vars = { n: s.pieces % 4 || 4 };
        if (s.pieces % 4 === 0) { s.maxHp += 2; s.hp = s.maxHp; key = 'lh.get.heartfull'; }
        break;
      case 'container': s.maxHp += 2; s.hp = s.maxHp; break;
      case 'crystal': s.crystals++; break;
      case 'potion': s.potion = 1; break;
      default: break;
    }
    this.persist();
    if (!MAJOR.has(item) || quiet) {
      this.sfx(item === 'heart' ? 'heart' : 'coin');
      return;
    }
    // hold it up high
    const h = this.hero;
    h.mode = 'get';
    h.t = 0;
    h.face = 's';
    this.heroChar.targetYaw = 0;
    const m = makeItem(item);
    m.scale.multiplyScalar(1.3);
    m.position.set(h.x, 1.35, h.z);
    this.room.group.add(m);
    this.sfx([...TOOLS, 'crystal', 'container', 'bigkey'].includes(item) ? 'item' : 'chest');
    this.hud.flash();
    this.later(0.55, () => {
      this.say([{ who: 'you', key, vars }], () => {
        m.parent?.remove(m);
        h.mode = 'walk';
        if (item === 'crystal') this.afterCrystal();
        this.checkFull();
      });
    });
  },

  /** Every heart piece and golden shell found: a little bonus, once per profile. */
  checkFull() {
    const s = this.save;
    if (s.fullRewarded || !this.allFound()) return;
    s.fullRewarded = true;
    this.giveStars(3);
    this.persist();
    this.later(0.5, () => this.notice('lh.allFound'));
  },

  // ---------- the shop ----------

  buy(e) {
    const s = this.save;
    if (e.id && s.got[e.id]) { this.say([{ who: 'mira', key: 'lh.shop.sold' }]); return; }
    if (e.item === 'potion' && s.potion) { this.say([{ who: 'mira', key: 'lh.shop.max' }]); return; }
    const name = t(`lh.item.${e.item}`);
    this.say([{
      who: 'mira', key: 'lh.shop.ask', vars: { item: name, n: e.price }, choices: ['lh.yes', 'lh.no'],
      onChoice: (i) => {
        if (i !== 0) return;
        if (s.shells < e.price) { this.say([{ who: 'mira', key: 'lh.shop.poor', vars: { n: e.price } }]); return; }
        s.shells -= e.price;
        if (e.id) e.mesh.userData.item.visible = false;
        this.giveItem(e.item, { id: e.id });
      },
    }]);
  },

  // ---------- saving ----------

  useSavePoint(e) {
    const s = this.save;
    s.hp = s.maxHp;
    const h = this.hero;
    s.savePoint = { room: this.room.id, at: [colOf(h.x), rowOf(h.z)], face: h.face };
    this.persist();
    this.sfx('save');
    this.puffAt(e.x, e.z, 0xffe27a, 14, 1.2);
    if (e.t === 'lamp') this.say([{ who: 'sign', key: 'lh.lamp', vars: { n: s.placed || 0 } }]);
    else this.say([{ who: 'sign', key: 'lh.saved' }]);
  },

  // ---------- cutscenes ----------

  /** Run a generator cutscene: yield seconds to wait, or { lines } to show dialog. */
  cutscene(fn) {
    this.cut = { it: fn.call(this), wait: 0 };
    this.mode = 'cut';
  },

  updateCut(dt) {
    const c = this.cut;
    if (!c) { this.mode = 'play'; return; }
    if (c.wait > 0) { c.wait -= dt; return; }
    const step = c.it.next();
    if (step.done) { this.cut = null; if (this.mode === 'cut') this.mode = 'play'; return; }
    const v = step.value;
    if (typeof v === 'number') c.wait = v;
    else if (v && v.lines) this.say(v.lines);
  },

  *introScene() {
    yield 0.6;
    const L = (k) => ({ who: 'keeper', key: k });
    yield { lines: ['lh.k.intro1', 'lh.k.intro2', 'lh.k.intro3', 'lh.k.intro4', 'lh.k.intro5', 'lh.k.intro6'].map(L) };
    // the keeper walks out of the door and heads for the lighthouse
    const k = this.room.ents.find((e) => e.t === 'npc' && e.id === 'keeper');
    this.save.flags.intro = true;
    this.persist();
    if (k) {
      this.room.occ.delete(`${k.c},${k.r}`);
      const path = [[tileX(8), tileZ(5)], [tileX(8), tileZ(7.2)]];
      for (const [x, z] of path) {
        while (Math.hypot(k.mesh.position.x - x, k.mesh.position.z - z) > 0.05) {
          const dx = x - k.mesh.position.x, dz = z - k.mesh.position.z;
          const d = Math.hypot(dx, dz);
          const st = Math.min(d, 3 / 60);
          k.mesh.position.x += (dx / d) * st;
          k.mesh.position.z += (dz / d) * st;
          k.char.face(dx, dz);
          k.char.update(1 / 60, { moving: 1 });
          yield 0;
        }
      }
      this.sfx('door');
      k.mesh.visible = false;
      this.room.ents = this.room.ents.filter((e) => e !== k);
    }
  },

  /** Picked up a crystal in a boss room: off to the lighthouse. */
  afterCrystal() {
    const v = this.room.def.victory;
    if (!v) return;
    this.startWarp(v.warp.to, v.warp.at, v.warp.face);
  },

  /** In the lighthouse with crystals to place. */
  *placeScene() {
    yield 0.5;
    const s = this.save;
    const lamp = this.room.ents.find((e) => e.t === 'lamp');
    while ((s.placed || 0) < s.crystals) {
      s.placed = (s.placed || 0) + 1;
      if (lamp) {
        this.syncLamp(lamp);
        this.puffAt(lamp.x, lamp.z, 0x8ff0ff, 20, 1.4);
      }
      this.sfx('secret');
      this.hud.flash();
      this.persist();
      yield { lines: [{ who: 'you', key: 'lh.place' }] };
      // stars for the island only the first time this profile brings a crystal home
      if (s.placed > (s.rewarded || 0)) { s.rewarded = s.placed; this.giveStars(2); this.persist(); }
    }
    s.hp = s.maxHp;
    s.savePoint = { room: 'h_light', at: [8, 5], face: 'n' };
    this.persist();
    const keeper = this.room.ents.find((e) => e.t === 'npc' && e.id === 'keeper');
    if (keeper) keeper.char.face(this.hero.x - keeper.x, this.hero.z - keeper.z);
    if (s.placed === 2 && !s.bosses.d3_boss) {
      // the act 2 story: the thief fled to the Stormcliffs
      yield { lines: [{ who: 'keeper', key: 'lh.k.two' }] };
      yield* this.act2Scene(true);
      return;
    }
    if (s.placed >= 3) {
      yield* this.finaleCall();
      return;
    }
    yield { lines: [{ who: 'keeper', key: this.nextHint() }] };
  },

  /** Part 2 begins: the keeper saw where the gloom went (also for part 1 saves). */
  *act2Scene(skipWait = false) {
    if (!skipWait) yield 0.5;
    const s = this.save;
    const keeper = this.room.ents.find((e) => e.t === 'npc' && e.id === 'keeper');
    if (keeper) keeper.char.face(this.hero.x - keeper.x, this.hero.z - keeper.z);
    const L = (k) => ({ who: 'keeper', key: k });
    yield { lines: [L('lh.k.act2a'), L('lh.k.act2b'), L(this.nextHint())] };
    s.flags.act2 = true;
    // the part 1 ending stars, for saves that never saw them
    if (!s.tbcRewarded) { s.tbcRewarded = true; this.giveStars(3); }
    this.persist();
  },

  giveStars(n) {
    this.game.roster.addStars(n);
    this.game.ui.toast(t('lh.stars', { n }), 2200);
  },
};
