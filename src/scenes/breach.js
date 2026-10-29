import * as THREE from 'three';
import { MiniGame } from '../core/minigame.js';
import { t, tFor } from '../core/i18n.js';
import { say } from '../core/voice.js';
import { addLights, skyTexture } from '../core/world.js';
import { SONGS } from '../core/audio.js';
import { PLAYER_COLORS } from '../core/palette.js';
import './breach/strings.js';
import * as R from './breach/rules.js';
import { ISLANDS, ORDER, BATTLE_COUNT, UPGRADES, POWER_MAX, ISLAND_POWER } from './breach/levels.js';
import { BoardView } from './breach/view.js';
import { BreachHud, esc } from './breach/ui.js';
import { loadBreach, saveBreach, newRun } from './breach/save.js';
import { bestFor } from './breach/auto.js';
import { THEMES } from './breach/models.js';

// Bean Brigade: an Into the Breach-style tactics game on the solo island. Three toy bean mechs
// defend island villages from big goofy bug-grumbles on an 8x8 board. Bugs move first and show
// exactly where they will attack; the player's turn comes before the attacks, so pushing a bug
// away, into water or into another bug, blocking its goo or standing on its spawn mound saves the
// houses (every hit house costs grid power, shared over the whole campaign).
//
//   stick: cursor · [A]: pick a mech, walk, aim and confirm · [B]: back / undo a move
//   tap [C]: battle menu (rewind, hint, tips) · hold [C]: end the turn
//
// Campaign: pick Easy or Hard and one of three squads, then Clover Isle, Sandy Isle and Frosty Isle
// (3-4 battles each) and the finale at the Grumble Hive. Stars from battles and bonus objectives buy
// upgrades between islands. Easy: all intents shown, unlimited move undo, one rewind per battle,
// a lost battle is retried. Hard: one undo per turn, no rewind, an empty grid restarts the campaign.
//
// Code: breach/rules.js (the pure rules and bug AI), levels.js (islands, maps, upgrades),
// view.js (board, models and animations), models.js, ui.js (HTML overlay), auto.js (helper hints),
// save.js and strings.js. Progress: game.roster.progress.breach (per solo profile).

SONGS.breachMap ??= { bpm: 104, root: 60, chords: [0, 5, 9, 7], seed: 515, lead: 'triangle' };
SONGS.breach ??= { bpm: 118, root: 57, chords: [0, 8, 3, 10], seed: 733, lead: 'square' };

const NOTE = (m) => 440 * Math.pow(2, (m - 69) / 12);
const HOLD_END = 0.75; // seconds to hold [C] for "end turn"
const BOARD_LOOK = new THREE.Vector3(0, -0.15, 0.3);

export class BreachScene extends MiniGame {
  constructor(game, opts = {}) {
    super(game, opts);
    this.state = 'play'; // no countdown: the title card is the intro
    this.playStart = 0;
    this.save = loadBreach(game.roster);
    this.camera.fov = 34;
    this.scene.background = skyTexture('#7fd3ff', '#fff1d6');
    const L = addLights(this.scene, { size: 9, dir: new THREE.Vector3(-0.45, 1, 0.55) });
    this.sun = L.sun;
    this.view = new BoardView(this);
    this.hud = new BreachHud(game.ui);
    this.cursor = [3, 5];
    this.rep = { dx: 0, dy: 0, t: 0 };
    this.holdC = 0;
    this.side = false;
    this.mode = 'title';
    this.showTitle();
    game.audio.playMusic('breachMap');
  }

  // ---------- camera, input, sound ----------

  resize(w, h) {
    super.resize(w, h);
    this.frameCamera();
  }

  frameCamera() {
    const w = window.innerWidth, h = window.innerHeight;
    this.camera.aspect = w / h;
    // the board plus room for the side panels (on wide screens the height decides anyway)
    let needW = 14.6, shift = 0;
    if (this.side) {
      const pf = Math.min(480, 0.38 * w) / w + 0.04; // the map card on the left
      needW = 9.2 / (1 - pf);
      shift = pf / 2;
    }
    const dist = this.fitDistance(needW, 9.6) * 0.98;
    const dir = new THREE.Vector3(0, 1.2, 1).normalize();
    this.camera.position.copy(BOARD_LOOK).addScaledVector(dir, dist);
    this.camera.lookAt(BOARD_LOOK);
    if (this.side) this.camera.setViewOffset(w, h, -w * shift, 0, w, h);
    else this.camera.clearViewOffset();
    this.camera.updateProjectionMatrix();
  }

  setSide(on) {
    if (this.side === on) return;
    this.side = on;
    this.frameCamera();
  }

  get player() {
    return this.players[0];
  }

  /** One controller: taps for menus plus a repeating cursor step when the stick is held. */
  readInput(dt) {
    const d = this.player ? this.input(this.player) : null;
    if (!d) return { dx: 0, dy: 0 };
    const hx = d.x > 0.5 ? 1 : d.x < -0.5 ? -1 : 0;
    const hy = d.y > 0.5 ? -1 : d.y < -0.5 ? 1 : 0; // grid y grows toward the camera
    let dx = d.stepX || 0, dy = -(d.stepY || 0);
    if (hx || hy) {
      if (hx !== this.rep.dx || hy !== this.rep.dy) { this.rep = { dx: hx, dy: hy, t: 0 }; }
      else {
        this.rep.t += dt;
        if (this.rep.t > 0.34) { this.rep.t -= 0.11; dx = hx; dy = hy; }
      }
    } else this.rep = { dx: 0, dy: 0, t: 0 };
    if (dx && dy) dy = 0; // one axis at a time on the grid
    return { dx, dy, a: d.aPressed, b: d.bPressed, c: d.cPressed, aHeld: d.a, cHeld: d.c };
  }

  sfx(name) {
    const a = this.game.audio;
    if (!a?.ctx || a.muted) return;
    const r = 1 + (Math.random() - 0.5) * 0.1;
    switch (name) {
      case 'tick': a.tone(NOTE(84), 0.03, { type: 'triangle', vol: 0.04 }); break;
      case 'step': a.tone(180 * r, 0.06, { type: 'square', vol: 0.04, slide: 0.7 }); break;
      case 'dash': a.noise(0.2, { vol: 0.12, freq: 1600, q: 0.6 }); break;
      case 'push': a.noise(0.16, { vol: 0.1, freq: 380, q: 0.7, type: 'lowpass' }); break;
      case 'swap': a.tone(500, 0.25, { type: 'sine', vol: 0.08, slide: 2.2 }); a.tone(1000, 0.25, { type: 'sine', vol: 0.05, slide: 0.5, delay: 0.1 }); break;
      case 'swing': a.noise(0.1, { vol: 0.12, freq: 2200 * r, q: 0.8 }); break;
      case 'shoot': a.tone(380 * r, 0.12, { type: 'square', vol: 0.07, slide: 0.5 }); a.noise(0.08, { vol: 0.1, freq: 900 }); break;
      case 'laser': a.tone(1400, 0.3, { type: 'sawtooth', vol: 0.04, slide: 0.4 }); break;
      case 'lob': a.tone(300, 0.35, { type: 'triangle', vol: 0.08, slide: 2 }); break;
      case 'hook': a.tone(900, 0.1, { type: 'square', vol: 0.05 }); a.tone(600, 0.2, { type: 'triangle', vol: 0.05, slide: 0.6, delay: 0.08 }); break;
      case 'spit': a.noise(0.18, { vol: 0.12, freq: 700, q: 0.5, type: 'lowpass' }); a.tone(260, 0.15, { type: 'sine', vol: 0.08, slide: 0.5 }); break;
      case 'hit': a.tone(220 * r, 0.08, { type: 'square', vol: 0.09, slide: 0.5 }); a.noise(0.06, { vol: 0.12, freq: 900 }); break;
      case 'poof': a.play('pop'); a.noise(0.25, { vol: 0.12, freq: 600, q: 0.6, type: 'lowpass' }); break;
      case 'splash': a.play('splat'); a.noise(0.35, { vol: 0.12, freq: 1500, q: 0.4 }); break;
      case 'ko': a.play('dizzy'); break;
      case 'dig': a.noise(0.35, { vol: 0.12, freq: 300, q: 0.5, type: 'lowpass' }); break;
      case 'boom': a.noise(0.4, { vol: 0.2, freq: 260, q: 0.5, type: 'lowpass' }); a.tone(90, 0.3, { type: 'sine', vol: 0.2, slide: 0.5 }); break;
      case 'flame': a.noise(0.3, { vol: 0.1, freq: 1200, q: 0.4 }); break;
      case 'bugAttack': a.tone(160 * r, 0.14, { type: 'sawtooth', vol: 0.06, slide: 0.7 }); break;
      case 'bubble': a.play('bubble'); break;
      case 'powerDown': a.tone(NOTE(76), 0.1, { type: 'square', vol: 0.06 }); a.tone(NOTE(70), 0.2, { type: 'square', vol: 0.06, delay: 0.1 }); break;
      case 'egg': a.tone(NOTE(79), 0.1, { type: 'sine', vol: 0.08 }); break;
      case 'error': a.tone(150, 0.12, { type: 'square', vol: 0.06 }); break;
      case 'select': a.play('select'); break;
      case 'endTurn': [0, -3, -7].forEach((n, i) => a.tone(NOTE(76 + n), 0.12, { type: 'triangle', vol: 0.09, delay: i * 0.08 })); break;
      case 'yourTurn': [0, 4, 7].forEach((n, i) => a.tone(NOTE(72 + n), 0.12, { type: 'triangle', vol: 0.1, delay: i * 0.07 })); break;
      default: a.play(name);
    }
  }

  speak(text) {
    say(text);
  }

  persist() {
    saveBreach(this.game.roster, this.save);
  }

  pilots() {
    const p = this.player;
    const ci = p?.colorIndex ?? 0;
    return [
      { color: p?.color ?? PLAYER_COLORS[0].hex, hat: p?.hat ?? 1 },
      { color: PLAYER_COLORS[(ci + 2) % 6].hex, hat: 2 },
      { color: PLAYER_COLORS[(ci + 4) % 6].hex, hat: 3 },
    ];
  }

  // ---------- backdrop boards ----------

  /** Show a battle board behind the menus (nothing is played on it). */
  showBackdrop(step = 0, squad = 'bonk') {
    const o = ORDER[step];
    const run = this.save.run;
    const team = run && run.squad === squad ? run.mechs : R.SQUADS[squad].map((type) => ({ type }));
    const s = R.makeBattle(o.def, { mechs: team, power: run?.power ?? 7, seed: (run?.seed ?? 1) + step * 7919 });
    this.backdrop = s;
    this.buildBoard(s, o);
    this.view.setIntents(s, { all: true });
    this.view.setCursor(0, 0, false);
    this.view.setHighlights([]);
    this.view.labelsOn = false;
  }

  buildBoard(s, o) {
    const isl = ISLANDS[o.island];
    const th = THEMES[isl.theme];
    if (this.scene.background) this.scene.background.dispose();
    this.scene.background = skyTexture(th.sky[0], th.sky[1]);
    const prot = o.def.objectives.find((ob) => ob.kind === 'protect');
    this.view.build(s, isl.theme, prot?.what || 'windmill', this.pilots());
  }

  // ---------- title, difficulty, squads ----------

  showTitle() {
    this.mode = 'title';
    this.setSide(false);
    this.hud.hideBattle();
    if (!this.backdrop || this.view.units.size === 0) this.showBackdrop(this.save.run?.step ?? 0, this.save.run?.squad ?? 'bonk');
    const opts = [];
    if (this.save.run) opts.push('continue');
    opts.push('new', 'leave');
    this.menuSel = { opts, i: 0 };
    this.speak(`${t('game.breach')}. ${t('breach.sub')}`);
    this.renderTitle();
  }

  renderTitle() {
    const { opts, i } = this.menuSel;
    const run = this.save.run;
    const medals = Object.values(this.save.medals).reduce((a, b) => a + b, 0);
    const info = run ? t('breach.progress', { n: run.step + 1, m: BATTLE_COUNT, diff: t(`breach.diff.${run.diff}`), squad: t(`breach.sq.${run.squad}`) }) : t('breach.sub');
    const rows = opts.map((o, k) => {
      const text = t(o === 'continue' ? 'breach.continue' : o === 'new' ? 'breach.new' : 'breach.leave');
      const sub = o === 'new' && run ? t('breach.newSub') : '';
      return `<div class="opt ${k === i ? 'on' : ''}">${esc(text)}${sub ? `<small>${esc(sub)}</small>` : ''}</div>`;
    }).join('');
    this.hud.setCard(`<div class="logo">${esc(t('game.breach'))}</div><div class="sub">${esc(info)}${medals ? ` · ${esc(t('breach.medals', { n: medals }))}` : ''}</div>${rows}
      <div class="foot">${esc(tFor(this.player, 'breach.titleHint'))}</div>`);
  }

  updateTitle(inp) {
    const M = this.menuSel;
    if (inp.dy) { M.i = (M.i + inp.dy + M.opts.length) % M.opts.length; this.sfx('select'); this.renderTitle(); this.speakOpt(); }
    if (!inp.a) return;
    const o = M.opts[M.i];
    this.sfx('select');
    if (o === 'continue') this.showMap();
    else if (o === 'new') this.showDiff();
    else this.leave();
  }

  speakOpt() {
    const el = this.hud.card.querySelector('.opt.on, .br-squad.on, .up.on');
    if (el) this.speak(el.textContent);
  }

  leave() {
    if (this.leaving) return;
    this.leaving = true;
    this.persist();
    this.game.goHub(this.key);
  }

  showDiff() {
    this.mode = 'diff';
    this.menuSel = { opts: ['easy', 'hard'], i: this.save.run?.diff === 'hard' ? 1 : 0 };
    this.renderDiff();
    this.speak(`${t('breach.diff.title')} ${t('breach.diff.easy')}: ${t('breach.diff.easySub')}`);
  }

  renderDiff() {
    const { opts, i } = this.menuSel;
    this.hud.setCard(`<h2>${esc(t('breach.diff.title'))}</h2>${opts.map((o, k) => `<div class="opt ${k === i ? 'on' : ''}">${esc(t(`breach.diff.${o}`))}<small>${esc(t(`breach.diff.${o}Sub`))}</small></div>`).join('')}
      <div class="foot">${esc(tFor(this.player, 'breach.diffHint'))}</div>`);
  }

  updateDiff(inp) {
    const M = this.menuSel;
    if (inp.dy) { M.i = (M.i + inp.dy + 2) % 2; this.sfx('select'); this.renderDiff(); this.speakOpt(); }
    if (inp.b) { this.sfx('select'); this.showTitle(); return; }
    if (inp.a) { this.sfx('select'); this.pickDiff = M.opts[M.i]; this.showSquads(); }
  }

  showSquads() {
    this.mode = 'squad';
    this.menuSel = { opts: R.SQUAD_IDS, i: 0 };
    this.renderSquads(true);
  }

  renderSquads(rebuild) {
    const { opts, i } = this.menuSel;
    const cols = opts.map((id, k) => {
      const medal = this.save.medals[id] ? ` <span class="medal">★ ${this.save.medals[id]} ${esc(t('breach.medal'))}</span>` : '';
      const mechs = R.SQUADS[id].map((m) => `<div class="m" style="--c:#${R.MECHS[m].color.toString(16).padStart(6, '0')}"><i></i><div>${esc(t(`breach.m.${m}`))}<small>${esc(t(`breach.d.${m}`))}</small></div></div>`).join('');
      return `<div class="br-squad ${k === i ? 'on' : ''}"><h3>${esc(t(`breach.sq.${id}`))}${medal}</h3><p>${esc(t(`breach.sq.${id}Sub`))}</p>${mechs}</div>`;
    }).join('');
    this.hud.setCard(`<h2>${esc(t('breach.squad.title'))}</h2><div class="br-squads">${cols}</div><div class="foot">${esc(tFor(this.player, 'breach.squadHint'))}</div>`);
    const id = opts[i];
    if (rebuild) this.showBackdrop(0, id);
    this.speak(`${t(`breach.sq.${id}`)}. ${t(`breach.sq.${id}Sub`)}`);
  }

  updateSquads(inp) {
    const M = this.menuSel;
    const d = inp.dx || inp.dy;
    if (d) { M.i = (M.i + d + M.opts.length) % M.opts.length; this.sfx('select'); this.renderSquads(true); }
    if (inp.b) { this.sfx('select'); this.showDiff(); return; }
    if (inp.a) {
      this.sfx('fanfare');
      this.newCampaign(this.pickDiff || 'easy', M.opts[M.i]);
    }
  }

  /** Start a new campaign (tests call this directly too). */
  newCampaign(diff, squad, seed) {
    this.save.run = newRun(diff, squad, seed);
    this.persist();
    this.showMap();
  }

  // ---------- the campaign map ----------

  showMap() {
    const run = this.save.run;
    if (!run) { this.showTitle(); return; }
    if (run.shop) { this.showShop(); return; }
    this.mode = 'map';
    this.hud.hideBattle();
    this.setSide(true);
    this.showBackdrop(run.step, run.squad);
    this.game.audio.playMusic('breachMap');
    this.renderMap();
    const o = ORDER[run.step];
    this.speak(`${t(`breach.isl.${ISLANDS[o.island].id}`)}. ${t('breach.map.next', { name: t(`breach.bt.${o.def.id}`) })}. ${t(`breach.bi.${o.def.id}`)}`);
  }

  canShop() {
    const run = this.save.run;
    return !!run && ORDER[run.step].battle === 0 && run.step > 0;
  }

  renderMap() {
    const run = this.save.run;
    const o = ORDER[run.step];
    const isles = ISLANDS.map((isl, i) => {
      const steps = ORDER.map((x, k) => ({ ...x, k })).filter((x) => x.island === i);
      const dots = steps.map((x) => `<i class="${x.k < run.step ? 'done' : x.k === run.step ? 'now' : ''}"></i>`).join('');
      const cls = i === o.island ? 'on' : steps.every((x) => x.k < run.step) ? 'done' : '';
      return `<div class="br-isle ${cls}">${esc(t(`breach.isl.${isl.id}`))}<div class="dots">${dots}</div></div>`;
    }).join('');
    const bar = Array.from({ length: POWER_MAX }, (_, i) => `<i class="${i < run.power ? 'on' : ''}"></i>`).join('');
    const hints = [tFor(this.player, 'breach.map.go'), this.canShop() ? tFor(this.player, 'breach.map.shop') : null, tFor(this.player, 'breach.map.leave')].filter(Boolean);
    this.hud.setCard(`<h2>${esc(t(`breach.isl.${ISLANDS[o.island].id}`))}</h2>
      <div class="br-isles">${isles}</div>
      <div class="br-row"><span>${esc(t('breach.map.battle', { n: run.step + 1, m: BATTLE_COUNT }))}: ${esc(t(`breach.bt.${o.def.id}`))}</span></div>
      <div class="sub">${esc(t(`breach.bi.${o.def.id}`))}</div>
      <div class="br-row"><span class="br-power"><span class="bolt">⚡</span><span class="bar">${bar}</span></span><span>★ <b>${run.stars}</b></span></div>
      <div class="foot">${hints.map(esc).join(' · ')}</div>`, true);
  }

  updateMap(inp) {
    if (inp.a) { this.sfx('select'); this.startBattle(); return; }
    if (inp.c && this.canShop()) { this.sfx('select'); this.showShop(); return; }
    if (inp.b) { this.sfx('select'); this.leave(); }
  }

  // ---------- upgrades ----------

  showShop() {
    this.mode = 'shop';
    this.setSide(false);
    this.hud.hideBattle();
    this.shop = { col: 0, row: 0 };
    this.renderShop();
    this.speak(`${t('breach.shop.title')}. ${t('breach.shop.stars', { n: this.save.run.stars })}`);
  }

  upState(m, up) {
    if (m.ups.includes(up.id)) return 'got';
    if (up.need && !m.ups.includes(up.need)) return 'lock';
    if (this.save.run.stars < up.cost) return 'poor';
    return 'ok';
  }

  upName(m, up) {
    return up.field === 'pow' ? t(`breach.${up.id}.${m.type}`) : t(`breach.up.${up.id}`);
  }

  renderShop() {
    const run = this.save.run;
    const S = this.shop;
    const cols = run.mechs.map((m, c) => {
      const rows = UPGRADES.map((up, r) => {
        const st = this.upState(m, up);
        const on = c === S.col && r === S.row;
        return `<div class="up ${on ? 'on' : ''} ${st === 'got' ? 'got' : st === 'lock' ? 'lock' : ''}"><span>${esc(this.upName(m, up))}</span><b>${st === 'got' ? '✓' : `${up.cost} ★`}</b></div>`;
      }).join('');
      const hp = R.MECHS[m.type].hp + m.hp, mv = R.MECHS[m.type].move + m.move;
      return `<div class="col"><h3 style="--c:#${R.MECHS[m.type].color.toString(16).padStart(6, '0')}"><i></i>${esc(t(`breach.m.${m.type}`))}</h3>
        <div class="br-row"><small>♥ ${hp} · ${esc(t('breach.moveN', { n: mv }))}</small></div>${rows}</div>`;
    }).join('');
    const m = run.mechs[S.col], up = UPGRADES[S.row];
    const st = this.upState(m, up);
    const why = st === 'got' ? t('breach.shop.got') : st === 'lock' ? t('breach.shop.need') : st === 'poor' ? t('breach.shop.poor') : `${up.cost} ★`;
    this.hud.setCard(`<h2>${esc(t('breach.shop.title'))}</h2><div class="br-stars">★ <b>${run.stars}</b> · ${esc(t('breach.shop.stars', { n: run.stars }))}</div>
      <div class="br-shop">${cols}<div class="desc">${esc(t(`breach.m.${m.type}`))}: ${esc(this.upName(m, up))} · ${esc(why)}</div></div>
      <div class="foot">${esc(tFor(this.player, 'breach.shop.hint'))}</div>`);
  }

  /** Buy an upgrade (tests call this too). Returns true if bought. */
  buy(col, upId) {
    const run = this.save.run;
    const m = run.mechs[col];
    const up = UPGRADES.find((u) => u.id === upId);
    if (!m || !up || this.upState(m, up) !== 'ok') return false;
    run.stars -= up.cost;
    m.ups.push(up.id);
    m[up.field] = (m[up.field] || 0) + 1;
    this.persist();
    return true;
  }

  updateShop(inp) {
    const S = this.shop;
    if (inp.dx) { S.col = (S.col + inp.dx + 3) % 3; this.sfx('tick'); this.renderShop(); this.speakShop(); }
    if (inp.dy) { S.row = (S.row + inp.dy + UPGRADES.length) % UPGRADES.length; this.sfx('tick'); this.renderShop(); this.speakShop(); }
    if (inp.a) {
      const m = this.save.run.mechs[S.col], up = UPGRADES[S.row];
      if (this.buy(S.col, up.id)) {
        this.sfx('coin');
        const msg = t('breach.shop.bought', { mech: t(`breach.m.${m.type}`), up: this.upName(m, up) });
        this.hud.banner(msg, '', 1400);
        this.speak(msg);
      } else { this.sfx('error'); this.speakShop(); }
      this.renderShop();
    }
    if (inp.b || inp.c) {
      this.sfx('select');
      this.save.run.shop = false;
      this.persist();
      this.showMap();
    }
  }

  speakShop() {
    const el = this.hud.card.querySelector('.desc');
    if (el) this.speak(el.textContent);
  }

  // ---------- battles ----------

  /** Start the battle the run is at. */
  startBattle() {
    const run = this.save.run;
    const o = ORDER[run.step];
    this.def = o.def;
    this.isl = ISLANDS[o.island];
    this.bs = R.makeBattle(o.def, { mechs: run.mechs, power: run.power, diff: run.diff, seed: run.seed + run.step * 7919 + run.tries * 131 }); // a retry brings other bugs
    this.backdrop = null;
    this.mode = 'battle';
    this.setSide(false);
    this.hud.setCard(null);
    this.buildBoard(this.bs, o);
    this.view.labelsOn = true;
    this.easy = run.diff === 'easy';
    this.sel = null;
    this.selMode = null;
    this.undo = [];
    this.undoLeft = this.easy ? Infinity : 1;
    this.rewindLeft = this.easy ? 1 : 0;
    this.turnSnap = structuredClone(this.bs);
    this.menu = null;
    this.hint = null;
    this.holdC = 0;
    this.cHeldFromBefore = true;
    this.view.intentsAll = this.easy;
    const first = R.mechs(this.bs)[0];
    this.cursor = [first.x, first.y];
    this.tut = o.def.tutorial && !this.save.tutorial ? { step: 0 } : null;
    this.game.audio.playMusic('breach');
    const name = t(`breach.bt.${o.def.id}`);
    this.hud.banner(name, t(`breach.isl.${this.isl.id}`), 1800);
    const goals = [t('breach.obj.survive', { n: o.def.turns }), ...o.def.objectives.map((ob) => this.objText(ob))].join('. ');
    this.speak(`${name}. ${t(`breach.bi.${o.def.id}`)} ${goals}.`);
    if (this.tut) this.later(0.6, () => this.showTip());
    this.refresh();
  }

  get busy() {
    return this.view.busy;
  }

  canSelect(u) {
    return u && u.side === 'mech' && !u.ko && !u.acted;
  }

  updateBattle(inp, dt) {
    if (this.busy) {
      this.view.speed = inp.aHeld ? 3 : 1.25;
      return;
    }
    if (this.tut?.modal) {
      if (inp.a) this.nextTip();
      return;
    }
    if (this.menu) { this.updateMenu(inp); return; }
    // [C]: tap for the menu, hold to end the turn
    if (inp.cHeld && !this.cHeldFromBefore) {
      this.holdC += dt;
      if (this.holdC >= HOLD_END) { this.holdC = 0; this.cHeldFromBefore = true; this.endTurn(); return; }
      this.renderHints();
    } else if (!inp.cHeld) {
      if (this.holdC > 0 && this.holdC < 0.3) { this.holdC = 0; this.openMenu(); return; }
      this.holdC = 0;
      this.cHeldFromBefore = false;
    }
    if (inp.dx || inp.dy) {
      const nx = Math.max(0, Math.min(R.W - 1, this.cursor[0] + inp.dx));
      const ny = Math.max(0, Math.min(R.H - 1, this.cursor[1] + inp.dy));
      if (nx !== this.cursor[0] || ny !== this.cursor[1]) { this.cursor = [nx, ny]; this.sfx('tick'); this.dwell = 0; this.refresh(); }
    }
    if (inp.a) this.pressA();
    else if (inp.b) this.pressB();
    // read the tile under the cursor aloud after a moment
    this.dwell = (this.dwell || 0) + dt;
    if (this.dwell > 1.1 && this.spokenAt !== this.cursor.join()) {
      this.spokenAt = this.cursor.join();
      const el = this.hud.info;
      if (el.style.display !== 'none') this.speak(el.textContent);
    }
  }

  pressA() {
    const s = this.bs;
    const [x, y] = this.cursor;
    const u = R.unitAt(s, x, y);
    if (this.sel) {
      const m = R.unitById(s, this.sel);
      if (this.selMode === 'move') {
        if (u === m) { this.selMode = 'aim'; this.sfx('select'); this.refresh(); this.explainAim(m); return; }
        if (R.reach(s, m).get(R.idx(x, y))) { this.doMove(m, x, y); return; }
      } else if (this.selMode === 'aim') {
        if (R.targetAt(s, m, x, y)) { this.doAct(m, x, y); return; }
      }
      if (this.canSelect(u) && u !== m) { this.select(u); return; }
      this.sfx('error');
      return;
    }
    if (u && u.side === 'mech') {
      if (this.canSelect(u)) this.select(u);
      else { this.sfx('error'); this.speak(this.hud.info.textContent); }
      return;
    }
    this.sfx('tick');
    this.speak(this.hud.info.textContent);
  }

  pressB() {
    if (this.sel) {
      const m = R.unitById(this.bs, this.sel);
      if (this.selMode === 'aim' && m && !m.moved) this.selMode = 'move';
      else { this.sel = null; this.selMode = null; }
      this.sfx('select');
      this.refresh();
      return;
    }
    this.undoMove();
  }

  select(u) {
    this.sel = u.id;
    this.selMode = u.moved ? 'aim' : 'move';
    this.sfx('select');
    this.refresh();
    const w = R.MECHS[u.type].weapon;
    this.speak(`${t(`breach.m.${u.type}`)}. ${t(`breach.d.${w}`)}`);
    if (u.moved) this.explainAim(u);
    this.tutEvent('select');
  }

  explainAim(m) {
    const why = R.cantAct(this.bs, m);
    if (why === 'smoke') { this.hud.banner(t('breach.cantSmoke'), '', 1600); this.speak(t('breach.cantSmoke')); }
    else if (m.wet) { this.hud.banner(t('breach.cantWet'), '', 1600); this.speak(t('breach.cantWet')); }
  }

  doMove(m, x, y) {
    this.undo.push(structuredClone(this.bs));
    const ev = R.mechMove(this.bs, m.id, x, y);
    if (!ev) { this.undo.pop(); this.sfx('error'); return; }
    this.selMode = 'aim';
    this.view.setPreview(null);
    this.view.setHighlights([]);
    this.view.setPath(null);
    this.view.play(ev, this.bs, () => { this.refresh(); this.explainAim(R.unitById(this.bs, m.id)); });
    this.tutEvent('move');
  }

  doAct(m, x, y) {
    const ev = R.mechAct(this.bs, m.id, x, y);
    if (!ev) { this.sfx('error'); return; }
    this.undo = []; // no undo across an attack
    this.sel = null;
    this.selMode = null;
    this.hint = null;
    this.view.setPreview(null);
    this.view.setHighlights([]);
    this.view.setIntents(this.bs, { hide: true });
    this.view.play(ev, this.bs, () => {
      if (this.bs.phase === 'won') { this.battleWon(); return; }
      if (this.bs.phase === 'lost') { this.battleLost(); return; }
      this.refresh();
      if (R.mechs(this.bs).every((u) => u.ko || u.acted) && !this.tut) { this.hud.banner(t('breach.allDone'), '', 1800); this.speak(t('breach.allDone')); }
    });
    this.tutEvent('act');
  }

  undoMove() {
    if (!this.undo.length) { this.sfx('error'); return; }
    if (this.undoLeft <= 0) { this.sfx('error'); this.hud.banner(t('breach.noUndo'), '', 1400); this.speak(t('breach.noUndo')); return; }
    this.bs = this.undo.pop();
    this.undoLeft--;
    this.view.sync(this.bs);
    this.sel = null;
    this.selMode = null;
    this.sfx('whoosh');
    this.hud.banner(t('breach.undone'), '', 1000);
    this.refresh();
  }

  rewind() {
    if (this.rewindLeft <= 0) { this.sfx('error'); this.hud.banner(t('breach.noRewind'), '', 1400); return false; }
    this.rewindLeft--;
    this.bs = structuredClone(this.turnSnap);
    this.undo = [];
    this.sel = null;
    this.selMode = null;
    this.view.sync(this.bs);
    this.sfx('whoosh');
    this.hud.banner(t('breach.rewound'), '', 1400);
    this.speak(t('breach.rewound'));
    this.refresh();
    return true;
  }

  endTurn() {
    if (this.mode !== 'battle' || this.busy || this.bs.phase !== 'player') return;
    this.sel = null;
    this.selMode = null;
    this.hint = null;
    this.menu = null;
    this.hud.setCard(null);
    this.sfx('endTurn');
    this.tutEvent('end');
    const ev = R.endTurn(this.bs);
    this.view.setPreview(null);
    this.view.setHighlights([]);
    this.view.setPath(null);
    this.view.setIntents(this.bs, { hide: true });
    this.view.setSelected(null);
    this.view.setCursor(...this.cursor, false);
    this.renderHints();
    this.view.play(ev, this.bs, () => this.afterEnemy());
  }

  onPhase(e) {
    if (e.phase === 'enemy') { this.hud.banner(t('breach.bugTurn'), '', 1000); this.speak(t('breach.bugTurn')); }
  }

  onPower() {
    this.renderTop();
    this.hud.flashPower();
  }

  afterEnemy() {
    const s = this.bs;
    if (s.phase === 'won') { this.battleWon(); return; }
    if (s.phase === 'lost') { this.battleLost(); return; }
    this.turnSnap = structuredClone(s);
    this.undo = [];
    this.undoLeft = this.easy ? Infinity : 1;
    const last = s.turn >= s.maxTurns;
    this.hud.banner(last ? t('breach.lastTurn') : t('breach.yourTurn'), t('breach.turn', { n: s.turn, m: s.maxTurns }), 1300);
    this.speak(last ? t('breach.lastTurn') : t('breach.yourTurn'));
    this.sfx('yourTurn');
    const first = R.mechs(s).find((m) => !m.ko);
    if (first) this.cursor = [first.x, first.y];
    this.refresh();
    if (this.tut && this.tut.step === 8) this.showTip();
  }

  // ---------- battle menu ([C] tap) ----------

  openMenu() {
    const items = ['end'];
    if (this.easy) items.push('rewind');
    items.push('hint', 'tips');
    if (this.easy) items.push('giveup');
    items.push('close');
    this.menu = { items, i: 0 };
    this.sfx('select');
    this.renderMenu();
    this.speakOpt();
  }

  renderMenu() {
    const { items, i } = this.menu;
    const label = (k) => (k === 'rewind' ? (this.rewindLeft > 0 ? t('breach.menu.rewind', { n: this.rewindLeft }) : t('breach.menu.noRewind')) : t(`breach.menu.${k}`));
    this.hud.setCard(`<h2>${esc(t('breach.menu.title'))}</h2>${items.map((k, n) => `<div class="opt ${n === i ? 'on' : ''}">${esc(label(k))}</div>`).join('')}
      <div class="foot">${esc(tFor(this.player, 'breach.menuHint'))}</div>`);
  }

  updateMenu(inp) {
    const M = this.menu;
    if (inp.dy) { M.i = (M.i + inp.dy + M.items.length) % M.items.length; this.sfx('select'); this.renderMenu(); this.speakOpt(); }
    if (inp.b || inp.c) { this.closeMenu(); return; }
    if (!inp.a) return;
    const k = M.items[M.i];
    this.closeMenu();
    if (k === 'end') this.endTurn();
    else if (k === 'rewind') this.rewind();
    else if (k === 'hint') this.showHint();
    else if (k === 'tips') { this.tut = { step: 2 }; this.showTip(); }
    else if (k === 'giveup') this.startBattle();
  }

  closeMenu() {
    this.menu = null;
    this.hud.setCard(null);
    this.cHeldFromBefore = true;
    this.refresh();
  }

  /** The helper bean: the best move for the selected (or first ready) mech. */
  showHint() {
    const s = this.bs;
    const m = (this.sel && R.unitById(s, this.sel)) || R.mechs(s).find((u) => this.canSelect(u));
    const h = m ? bestFor(s, m.id, this.def.objectives) : null;
    if (!h || (!h.move && !h.act)) { this.hud.banner(t('breach.noHelp'), '', 1800); this.speak(t('breach.noHelp')); return; }
    this.sel = m.id;
    this.selMode = h.move ? 'move' : 'aim';
    this.hint = { id: m.id, move: h.move, act: h.act };
    this.cursor = h.move ? [...h.move] : [...h.act];
    this.hud.banner(t('breach.helper'), '', 1600);
    this.speak(t('breach.helper'));
    this.refresh();
  }

  // ---------- tutorial ----------

  showTip() {
    if (!this.tut || this.mode !== 'battle') return;
    const st = this.tut.step;
    const modal = st === 0 || st === 1 || st === 8;
    this.tut.modal = modal;
    const text = t(`breach.tut.${st}`);
    this.hud.setTip(text, modal ? tFor(this.player, 'breach.tutOk') : '');
    this.speak(text);
  }

  nextTip() {
    if (!this.tut) return;
    const st = this.tut.step;
    this.sfx('select');
    if (st === 8) { this.tut = null; this.hud.setTip(null); this.save.tutorial = true; this.persist(); return; }
    this.tut.step++;
    this.tut.modal = false;
    this.showTip();
  }

  /** Tutorial steps move on when the player does the thing they explain. */
  tutEvent(what) {
    const T = this.tut;
    if (!T || T.modal) return;
    if (what === 'end') { if (T.step < 8) { T.step = 8; this.hud.setTip(null); } return; }
    // [step]: { event: next step } (doing a later thing early skips ahead)
    const next = { 2: { select: 3, act: 5 }, 3: { move: 4, act: 5 }, 4: { act: 5 }, 5: { act: 6 }, 6: { act: 7, select: 7 } }[T.step]?.[what];
    if (next) { T.step = next; this.later(0.5, () => this.showTip()); }
  }

  // ---------- refresh: highlights, preview, HUD ----------

  refresh() {
    if (this.mode !== 'battle') return;
    const s = this.bs;
    const [cx, cy] = this.cursor;
    const v = this.view;
    v.setCursor(cx, cy, s.phase === 'player');
    const m = this.sel ? R.unitById(s, this.sel) : null;
    v.setSelected(m ? m.id : null);
    let hl = [];
    let pv = null;
    let path = null;
    if (m && this.selMode === 'move') {
      const reach = R.reach(s, m);
      for (const k of reach.keys()) hl.push([k % R.W, Math.floor(k / R.W), 'move']);
      const p = reach.get(R.idx(cx, cy));
      if (p) { path = [[m.x, m.y], ...p]; hl.push([cx, cy, 'moveHi']); }
      if (this.hint?.id === m.id && this.hint.move) hl.push([...this.hint.move, 'area']);
    } else if (m && this.selMode === 'aim') {
      const tgs = R.mechTargets(s, m);
      const line = R.WEAPONS[R.MECHS[m.type].weapon].line;
      for (const tg of tgs) hl.push([tg.x, tg.y, line && !tg.repair ? 'line' : 'target']);
      const tg = tgs.find((g) => g.x === cx && g.y === cy);
      if (tg) {
        pv = R.preview(s, (c) => R.mechAct(c, m.id, cx, cy));
        hl.push([cx, cy, 'targetHi']);
      }
      if (this.hint?.id === m.id && this.hint.act && !(cx === this.hint.act[0] && cy === this.hint.act[1])) hl.push([...this.hint.act, 'area']);
    }
    v.setHighlights(hl);
    v.setPath(path);
    // intents: Easy shows every bug's plan; Hard shows red marks and the plan of the bug under the cursor
    const hov = R.unitAt(s, cx, cy);
    v.setIntents(s, { all: this.easy, focus: hov?.side === 'bug' ? hov.id : `t${cx},${cy}` });
    v.setPreview(pv);
    this.pv = pv;
    this.renderTop();
    this.renderRoster();
    this.renderInfo();
    this.renderHints();
  }

  objText(o) {
    if (o.kind === 'protect') return t(`breach.obj.protect.${o.what}`);
    if (o.kind === 'boss' && this.def.finale) return t('breach.obj.queen');
    return t(`breach.obj.${o.kind}`, { n: o.n });
  }

  renderTop() {
    const s = this.bs;
    if (!s) return;
    const lose = this.pv ? Math.max(0, this.pv.diff.power) : 0;
    const bar = Array.from({ length: s.powerMax }, (_, i) => `<i class="${i < s.power - lose ? 'on' : i < s.power ? 'lose' : ''}"></i>`).join('');
    const last = s.turn >= s.maxTurns;
    const objs = [`<div class="main">${esc(t('breach.obj.survive', { n: s.maxTurns }))}</div>`, ...this.def.objectives.map((o) => {
      const st = R.objectiveStatus(s, o);
      const prog = st.of ? ` (${st.n}/${st.of})` : '';
      return `<div class="${st.failed ? 'fail' : st.done ? 'done' : ''} ${o.kind === 'battery' ? 'power' : ''}">${esc(this.objText(o))}${prog}</div>`;
    })].join('');
    this.hud.set('top', `<div class="br-pill br-power"><span class="bolt">⚡</span><span><small>${esc(t('breach.power'))}</small><span class="bar">${bar}</span></span></div>
      <div class="br-pill br-turn ${last ? 'last' : ''}">${esc(last ? t('breach.lastTurnPill') : t('breach.turn', { n: s.turn, m: s.maxTurns }))}<small>${esc(t(`breach.bt.${this.def.id}`))} · ${esc(t(`breach.isl.${this.isl.id}`))}</small></div>
      <div class="br-pill br-objs">${objs}</div>`);
  }

  mechStatus(u) {
    if (u.ko) return t('breach.st.ko');
    if (u.acted) return t('breach.st.done');
    const bits = [];
    if (u.wet) bits.push(t('breach.st.wet'));
    else if (this.bs.tiles[R.idx(u.x, u.y)].smoke) bits.push(t('breach.st.smoke'));
    if (u.fire) bits.push(t('breach.st.fire'));
    if (u.shield) bits.push(t('breach.st.shield'));
    bits.unshift(u.moved ? t('breach.st.moved') : t('breach.st.ready'));
    return bits.join(' · ');
  }

  renderRoster() {
    const s = this.bs;
    const html = R.mechs(s).map((u) => {
      const pips = Array.from({ length: u.maxHp }, (_, i) => `<i class="${i < u.hp ? 'on' : ''}"></i>`).join('');
      const col = `#${R.MECHS[u.type].color.toString(16).padStart(6, '0')}`;
      return `<div class="br-mech ${u.id === this.sel ? 'on' : ''} ${u.acted || u.ko ? 'done' : ''}" style="--c:${col}"><div class="nm"><i></i>${esc(t(`breach.m.${u.type}`))}<span class="br-pips">${pips}</span></div><small>${esc(this.mechStatus(u))}</small></div>`;
    }).join('');
    this.hud.set('roster', html);
  }

  /** What is under the cursor, as a little card (also what gets read aloud). */
  renderInfo() {
    const s = this.bs;
    const [x, y] = this.cursor;
    const u = R.unitAt(s, x, y);
    const tl = R.tileAt(s, x, y);
    const parts = [];
    if (u) {
      if (u.side === 'mech') {
        const w = R.MECHS[u.type].weapon;
        parts.push(`<h4>${esc(t(`breach.m.${u.type}`))} <small>${esc(t('breach.hp', { n: u.hp, m: u.maxHp }))} · ${esc(t('breach.moveN', { n: u.move }))}</small></h4>`);
        parts.push(`<p><b>${esc(t(`breach.w.${w}`))}:</b> ${esc(t(`breach.d.${w}`))}</p>`);
        parts.push(`<p>${esc(this.mechStatus(u))}</p>`);
      } else if (u.side === 'bug') {
        const name = t(`breach.b.${u.type}`);
        const order = R.attackers(s).findIndex((b) => b.id === u.id) + 1;
        parts.push(`<h4>${esc(u.alpha ? t('breach.big', { name }) : name)} <small>${esc(t('breach.hp', { n: u.hp, m: u.maxHp }))}</small></h4>`);
        parts.push(`<p>${esc(t(`breach.bd.${u.type}`))}${u.alpha ? ` ${esc(t('breach.bigd'))}` : ''}${order ? ` ${esc(t('breach.attackN', { n: order }))}` : ''}</p>`);
        if (u.fire) parts.push(`<p>${esc(t('breach.st.fire'))}</p>`);
      } else {
        parts.push(`<h4>${esc(t('breach.b.rock'))}</h4><p>${esc(t('breach.bd.rock'))}</p>`);
      }
    }
    const sp = s.spawns.find((p) => p.x === x && p.y === y);
    const tileKey = tl.t === 'building' ? (tl.battery ? 'battery' : tl.obj ? 'obj' : 'building') : tl.t;
    const tileBits = [];
    if (tl.t !== 'ground') tileBits.push(t(`breach.t.${tileKey}`));
    if (tl.t === 'building' && tl.obj && !tl.battery) tileBits.push(t('breach.t.building'));
    if (tl.fire) tileBits.push(t('breach.t.fire'));
    if (tl.smoke) tileBits.push(t('breach.t.smoke'));
    if (tl.shield) tileBits.push(t('breach.t.shield'));
    if (tl.crate) tileBits.push(t('breach.t.crate'));
    if (sp) tileBits.push(t(sp.egg ? 'breach.t.egg' : 'breach.t.spawn'));
    if (tileBits.length) parts.push(`<p>${tileBits.map(esc).join(' ')}</p>`);
    else if (!u) parts.push(`<p>${esc(t('breach.t.ground'))}</p>`);
    // the preview, in words
    if (this.pv?.diff.won) parts.push(`<p><b>${esc(t('breach.p.win'))}</b></p>`);
    if (this.pv?.diff.lost) parts.push(`<p><b>${esc(t('breach.p.lose'))}</b></p>`);
    if (this.pv && !this.pv.diff.units.length && !this.pv.diff.tiles.length && !this.pv.diff.born.length) parts.push(`<p>${esc(t('breach.p.nothing'))}</p>`);
    this.hud.set('info', parts.join(''));
  }

  renderHints() {
    if (this.mode !== 'battle') return;
    const P = this.player;
    const nm = (k, v) => tFor(P, k, v);
    if (this.busy) { this.hud.setHints([nm('breach.h.wait'), nm('breach.h.fast')]); return; }
    const s = this.bs;
    const [x, y] = this.cursor;
    const u = R.unitAt(s, x, y);
    const list = [];
    const m = this.sel ? R.unitById(s, this.sel) : null;
    if (m && this.selMode === 'move') {
      if (u === m) list.push(nm('breach.h.stay'));
      else if (R.reach(s, m).get(R.idx(x, y))) list.push(nm('breach.h.move'));
      list.push(nm('breach.h.back'));
    } else if (m && this.selMode === 'aim') {
      list.push(R.targetAt(s, m, x, y) ? nm('breach.h.aim') : nm('breach.h.pickTarget'));
      list.push(nm('breach.h.back'));
    } else {
      list.push(this.canSelect(u) ? nm('breach.h.select') : nm('breach.h.info'));
      if (this.undo.length && this.undoLeft > 0) list.push(this.easy ? nm('breach.h.undo') : nm('breach.h.undoN', { n: this.undoLeft }));
    }
    list.push(nm('breach.h.menu'));
    const allDone = R.mechs(s).every((q) => q.ko || q.acted);
    list.push({ text: nm('breach.h.end'), hold: this.holdC / HOLD_END, cls: `hold ${allDone ? 'warn' : ''}` });
    this.hud.setHints(list);
  }

  // ---------- battle results ----------

  battleWon() {
    const run = this.save.run;
    const s = this.bs;
    const def = this.def;
    this.mode = 'result';
    this.hud.hideBattle();
    this.view.labelsOn = false;
    this.view.setIntents(s, { hide: true });
    this.view.setHighlights([]);
    this.view.setCursor(0, 0, false);
    this.view.setSelected(null);
    let stars = 1;
    let power = this.easy ? 2 : 1;
    const rows = [`<div class="br-row"><span>${esc(t('breach.res.win'))}</span><b>${esc(t('breach.res.star'))} · ${esc(t('breach.res.power', { n: power }))}</b></div>`];
    for (const o of def.objectives) {
      const st = R.objectiveStatus(s, o);
      const reward = o.kind === 'battery' ? t('breach.res.power', { n: 1 }) : t('breach.res.star');
      if (st.done) { if (o.kind === 'battery') power += 1; else stars += 1; }
      rows.push(`<div class="br-row ${st.done ? '' : 'miss'}"><span>${esc(this.objText(o))}</span><b>${esc(st.done ? reward : t('breach.res.miss'))}</b></div>`);
    }
    const cur = ORDER[run.step];
    const next = ORDER[run.step + 1];
    run.power = Math.min(POWER_MAX, s.power + power);
    run.stars += stars;
    run.starsTotal += stars;
    run.won++;
    run.tries = 0;
    this.save.bestBattles = Math.max(this.save.bestBattles, run.won);
    if (def.tutorial) this.save.tutorial = true;
    this.tut = null;
    this.hud.setTip(null);
    let islandLine = '';
    if (next && next.island !== cur.island) {
      run.power = Math.min(POWER_MAX, run.power + ISLAND_POWER);
      run.shop = true;
      islandLine = t('breach.res.island', { island: t(`breach.isl.${ISLANDS[cur.island].id}`), n: ISLAND_POWER });
      rows.push(`<div class="br-row"><span>${esc(islandLine)}</span></div>`);
    }
    this.campaignDone = !next;
    if (next) run.step++;
    this.persist();
    const title = s.queenDead ? t('breach.wonQueen') : t('breach.wonSub');
    this.hud.setCard(`<h2>${esc(t('breach.res.title'))}</h2><div class="sub">${esc(title)}</div>${rows.join('')}
      <div class="br-stars">★ <b>${run.stars}</b> · ⚡ <b>${run.power}</b></div><div class="foot">${esc(tFor(this.player, 'breach.res.next'))}</div>`);
    this.resultT = 0;
    this.game.audio.play('fanfare');
    this.celebrateBoard();
    this.speak(`${t('breach.res.title')} ${title} ${islandLine}`);
  }

  celebrateBoard() {
    const colors = [...PLAYER_COLORS.map((c) => c.hex), 0xffd23f];
    for (let i = 0; i < 3; i++) this.later(i * 0.3, () => this.confetti.burst(new THREE.Vector3((Math.random() - 0.5) * 6, 2, (Math.random() - 0.5) * 4), 0, { count: 40, speed: 7, up: 5, life: 1.6, gravity: -8, size: 0.16, colors }));
  }

  battleLost() {
    const s = this.bs;
    this.mode = 'lost';
    this.hud.hideBattle();
    this.view.labelsOn = false;
    this.view.setIntents(s, { hide: true });
    this.view.setCursor(0, 0, false);
    const why = s.power <= 0 ? t('breach.lostPower') : t('breach.lostMechs');
    this.resultT = 0;
    if (this.easy) {
      this.hud.setCard(`<h2>${esc(t('breach.lost'))}</h2><div class="sub">${esc(why)}</div><div class="foot">${esc(tFor(this.player, 'breach.retry'))}</div>`);
      this.speak(`${t('breach.lost')} ${why}`);
    } else {
      // Hard: the campaign is over; the medals stay
      this.save.run = null;
      this.save.restarts++;
      this.persist();
      this.hud.setCard(`<h2>${esc(t('breach.lost'))}</h2><div class="sub">${esc(why)}</div><div class="sub">${esc(t('breach.hardOver'))}</div><div class="foot">${esc(tFor(this.player, 'breach.hardOk'))}</div>`);
      this.speak(`${t('breach.lost')} ${why} ${t('breach.hardOver')}`);
    }
    this.game.audio.play('leave');
  }

  updateResult(inp, dt) {
    this.resultT += dt;
    if (!inp.a || this.resultT < 0.5) return;
    this.sfx('select');
    if (this.mode === 'lost') {
      if (this.save.run) {
        this.save.run.power = Math.max(this.save.run.power, 3); // Easy: a fresh try with some power
        this.save.run.tries++;
        this.persist();
        this.startBattle();
      } else { this.backdrop = null; this.showDiff(); }
      return;
    }
    if (this.campaignDone) this.showEnding();
    else this.showMap();
  }

  // ---------- the end ----------

  showEnding() {
    const run = this.save.run;
    this.mode = 'ending';
    this.save.done = true;
    this.save.medals[run.squad] = (this.save.medals[run.squad] || 0) + 1;
    this.save.bestBattles = BATTLE_COUNT;
    this.save.run = null;
    this.persist();
    this.hud.setCard(null);
    const p = this.player;
    this.later(0.4, () => this.finish({
      title: t('breach.end.title'),
      subtitle: t('breach.end.sub'),
      rows: [{ css: p?.css || '#ff5d73', name: t(`breach.sq.${run.squad}`), value: `${run.won}/${BATTLE_COUNT}`, detail: `${t('breach.end.battles')} · ★ ${run.starsTotal} · ⚡ ${run.power}`, crown: true }],
      stars: 5,
    }));
    this.speak(`${t('breach.end.title')} ${t('breach.end.sub')}`);
  }

  // ---------- frame ----------

  update(dt) {
    this.hud.update(dt);
    if (this.updateResults(dt)) { this.view.update(dt, this.camera); return; }
    const inp = this.readInput(dt);
    switch (this.mode) {
      case 'title': this.updateTitle(inp); break;
      case 'diff': this.updateDiff(inp); break;
      case 'squad': this.updateSquads(inp); break;
      case 'map': this.updateMap(inp); break;
      case 'shop': this.updateShop(inp); break;
      case 'battle': this.updateBattle(inp, dt); if (!this.busy && this.wasBusy) this.renderHints(); break;
      case 'result': case 'lost': this.updateResult(inp, dt); break;
      default:
    }
    this.wasBusy = this.busy;
    this.view.update(dt, this.camera);
  }

  onLanguage() {
    switch (this.mode) {
      case 'title': this.renderTitle(); break;
      case 'diff': this.renderDiff(); break;
      case 'squad': this.renderSquads(false); break;
      case 'map': this.renderMap(); break;
      case 'shop': this.renderShop(); break;
      case 'battle': if (this.menu) this.renderMenu(); if (this.tut) this.showTip(); this.refresh(); break;
      default:
    }
  }

  dispose() {
    this.view.dispose();
    this.hud.dispose();
    super.dispose();
  }
}
