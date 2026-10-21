import * as THREE from 'three';
import './spacefall/strings.js';
import { MiniGame } from '../core/minigame.js';
import { t } from '../core/i18n.js';
import { PLAYER_COLORS } from '../core/palette.js';
import { addLights } from '../core/world.js';
import { VotePicker, VOTES } from '../core/vote.js';
import { MAP_IDS } from './spacefall/maps.js';
import { MapVote, worldFor, mapLabel } from './spacefall/picker.js';
import { Match } from './spacefall/match.js';
import { BotBrain } from './spacefall/bots.js';
import { Hud } from './spacefall/hud.js';
import { buildLevel, themeSky } from './spacefall/level.js';
import { STEP, VIEW, COOP } from './spacefall/config.js';

// Spacefall: a TowerFall-style arena shooter with tiny spaceships, for 1-6 players. It merges the
// Spacefall repo (ships, missiles that stick in walls and must be picked up again, a dash with
// invulnerability that catches missiles, stomps in gravity maps, zero-g maps, alien waves, split
// screen on big maps) with Balloon Archers (bean characters, kid-friendly juice, a sunny
// wrap-around arena, timed free-for-all with quick respawns, target-free solo via bots).
//
// Controls: the stick flies and aims, [A] thrusts (gravity) or boosts (zero-g), [B] fires a
// missile, [C] dashes. Popped ships burst into a cartoon explosion and the pilot floats away
// safely in an escape bubble.
// Flow: vote mode -> vote map -> vote rounds/length -> intro -> play -> results.

const MODES = ['versus', 'frenzy', 'coop'];
const GRUMBLE = 0x7b6cf6;

export class SpacefallScene extends MiniGame {
  constructor(game, opts = {}) {
    super(game, opts);
    this.camera.fov = VIEW.fov;
    this.camera.far = 1000;
    this.camera.updateProjectionMatrix();
    this.opts = opts;
    this.mode = MODES.includes(opts.mode) ? opts.mode : null;
    this.mapId = MAP_IDS.includes(opts.map) ? opts.map : null;
    this.rounds = opts.rounds || 0;
    this.length = opts.length || 0;
    this.match = null;
    this.acc = 0;
    this.hud = new Hud(game.ui.labels);
    // A story stage skips the votes: co-op on the Derelict Hub unless the stage says otherwise.
    if (this.campaign) { this.mode ||= 'coop'; this.mapId ||= 'hub'; }
    this.showPreview(this.mapId || 'hub');
    game.audio.playMusic('space');
    this.state = 'vote';
    this.chooseMode();
  }

  retryOptions() {
    return { key: this.key, mode: this.mode, map: this.mapId, rounds: this.rounds || undefined, length: this.length || undefined };
  }

  onLanguage() {
    this.picker?.render();
  }

  // ---------- votes ----------

  chooseMode() {
    if (this.mode) { this.chooseMap(); return; }
    this.picker = new VotePicker(this, {
      title: () => t('game.spacefall'),
      vote: { question: () => t('sf.modeQ'), def: 'versus', options: MODES.map((m) => ({ value: m, label: () => t(`sf.mode.${m}`) })) },
      onDone: (m) => { this.picker = null; this.mode = m; this.chooseMap(); },
    });
  }

  chooseMap() {
    if (this.mapId) { this.chooseLength(); return; }
    this.picker = new MapVote(this, {
      title: () => t('game.spacefall'),
      vote: { question: () => t('sf.mapQ'), def: 'hub', options: MAP_IDS.map((id) => ({ value: id, label: () => mapLabel(id) })) },
      onDone: (id) => { this.picker = null; this.mapId = id; this.showPreview(id); this.chooseLength(); },
    });
  }

  chooseLength() {
    if (this.mode === 'versus' && !this.rounds) {
      this.picker = new VotePicker(this, {
        title: () => t('game.spacefall'),
        vote: { question: () => t('sf.roundsQ'), def: 5, options: [3, 5, 7].map((n) => ({ value: n, label: () => t('sf.firstToN', { n }) })) },
        onDone: (n) => { this.picker = null; this.rounds = n; this.setup(); },
      });
    } else if (this.mode === 'frenzy' && !this.length) {
      this.picker = new VotePicker(this, {
        title: () => t('game.spacefall'),
        vote: VOTES.length(90),
        onDone: (n) => { this.picker = null; this.length = n; this.setup(); },
      });
    } else {
      this.setup();
    }
  }

  // ---------- setup ----------

  /** The chosen map as a still backdrop behind the votes (replaced by the real match later). */
  showPreview(id) {
    this.clearPreview();
    const world = worldFor(id);
    const level = buildLevel(world);
    this.preview = level.group;
    this.scene.add(level.group);
    this.scene.background?.dispose?.();
    this.scene.background = themeSky(level.theme);
    this.previewWorld = world;
    this.framePreview();
    this.setLights(world);
  }

  framePreview() {
    const world = this.previewWorld;
    if (!world) return;
    const d = this.fitDistance(world.w + 1, world.h + 4);
    this.camera.position.set(world.w / 2, world.h / 2 + 0.6, d);
    this.camera.lookAt(world.w / 2, world.h / 2 + 0.6, 0);
  }

  clearPreview() {
    if (!this.preview) return;
    this.scene.remove(this.preview);
    this.preview.traverse((o) => {
      if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose();
      if (o.material && !o.material.userData.shared) o.material.dispose();
    });
    this.preview = null;
  }

  setLights(world) {
    if (this.lights) { this.scene.remove(this.lights.hemi, this.lights.sun, this.lights.sun.target); this.lights.sun.shadow.map?.dispose(); }
    const size = Math.max(world.w, world.h) / 2 + 4;
    this.lights = addLights(this.scene, { size, target: new THREE.Vector3(world.w / 2, world.h / 2, 0), dir: new THREE.Vector3(-0.35, 0.8, 1) });
    if (size > 24) this.lights.sun.shadow.mapSize.set(4096, 4096);
  }

  setup() {
    this.clearPreview();
    const world = worldFor(this.mapId);
    this.world = world;
    this.setLights(world);
    const pilots = this.players.map((p) => ({
      p, bot: false, name: p.name, css: p.css, hex: p.color, hat: p.hat, tip: null, tipT: 0,
      ctl: { x: 0, y: 0, analog: false, aimX: 0, aimY: 0, aimActive: false, thrust: false, fire: false, dash: false },
    }));
    // One or two people get grumble bot pilots to fight in Versus and Frenzy; a solo co-op pilot
    // gets a Grumble Buddy wingman (who also rescues you from your bubble).
    const bots = this.mode === 'coop' ? (pilots.length === 1 ? 1 : 0) : pilots.length === 1 ? 2 : pilots.length === 2 ? 1 : 0;
    const used = new Set(pilots.map((pl) => pl.hex));
    const free = PLAYER_COLORS.filter((c) => !used.has(c.hex));
    for (let i = 0; i < bots; i++) {
      const c = free[i % free.length];
      pilots.push({ p: null, bot: true, name: t(this.mode === 'coop' ? 'sf.bot.buddy' : `sf.bot.${i}`), css: c.css, hex: c.hex, hat: 0, grumble: GRUMBLE, wing: 0x4b3f72, ctl: null });
    }
    this.match = new Match(this, { world, mode: this.mode, settings: { rounds: this.rounds, length: this.length }, pilots, onEnd: (r) => this.end(r) });
    for (const pl of pilots) if (pl.bot) pl.brain = new BotBrain(this.match, pl);
    this.layout();
    this.match.updateViews(0);
    this.confettiOrigin = new THREE.Vector3(world.w / 2, world.h * 0.55, 0);
    this.intro(t('game.spacefall'), t(world.gravity ? 'sf.intro.grav' : 'sf.intro.zero'));
  }

  onStart() {
    const m = this.match;
    if (!m) return;
    m.begin();
    this.game.ui.toast(t(`sf.goal.${this.mode}`), 3400);
    for (const pl of m.humans()) this.tip(pl, m.world.gravity ? 'sf.tip.thrust' : 'sf.tip.boost', 4);
    this.later(9, () => { for (const pl of m.humans()) this.tip(pl, this.mode === 'coop' ? 'sf.tip.coopDash' : 'sf.tip.dash', 4); });
  }

  /** A short hint floating over one player's ship (drawn with tFor, so it names their own button). */
  tip(pl, key, sec) {
    pl.tip = key;
    pl.tipT = sec;
  }

  layout() {
    if (!this.match) return;
    const W = window.innerWidth, H = window.innerHeight;
    // The shared screen keeps bands free for the top pills and the bottom score chips.
    const top = Math.min(90, Math.max(52, H * 0.085));
    const bottom = Math.min(72, Math.max(46, H * 0.075));
    this.match.layout(W, H, top, bottom);
  }

  resize(w, h) {
    super.resize(w, h);
    this.hud?.resize();
    this.layout();
    if (!this.match) this.framePreview();
  }

  // ---------- input ----------

  /** Copy a player's device into their ship controls. Fire and dash are taps. */
  readControls(pl) {
    const d = this.input(pl.p);
    const c = pl.ctl;
    if (!d) { c.x = c.y = 0; c.thrust = c.fire = c.dash = false; return; }
    c.x = d.x || 0;
    c.y = d.y || 0;
    c.thrust = !!d.a;
    c.fire = c.fire || !!d.bPressed;
    c.dash = c.dash || !!d.cPressed;
    c.analog = d.type === 'gamepad' && !(Math.abs(c.x) === 1 || Math.abs(c.y) === 1);
    c.aimActive = false;
    // Optional free aim with a gamepad's right stick (read straight from the Gamepad API).
    if (d.type === 'gamepad') {
      const gp = navigator.getGamepads?.()[Number(pl.p.deviceId.slice(2))];
      const ax = gp?.axes?.[2] || 0, ay = -(gp?.axes?.[3] || 0);
      if (Math.hypot(ax, ay) > 0.4) { c.aimX = ax; c.aimY = ay; c.aimActive = true; }
    }
  }

  rumble(pl, strength = 0.6, ms = 160) {
    if (!pl.p || !pl.p.deviceId.startsWith('gp')) return;
    try {
      const act = navigator.getGamepads?.()[Number(pl.p.deviceId.slice(2))]?.vibrationActuator;
      act?.playEffect?.('dual-rumble', { duration: ms, strongMagnitude: strength, weakMagnitude: strength * 0.7 })?.catch?.(() => {});
    } catch { /* no rumble on this pad */ }
  }

  /** Sound effects: Couch sounds plus a few synthesized space sounds. */
  sfx(name) {
    const a = this.game.audio;
    const raw = a.ctx && !a.muted;
    switch (name) {
      case 'shoot': if (raw) { a.tone(880, 0.12, { type: 'square', vol: 0.05, slide: 0.3 }); a.noise(0.1, { vol: 0.08, freq: 2600 }); } break;
      case 'stick': if (raw) { a.tone(190, 0.08, { type: 'triangle', vol: 0.12, slide: 0.5 }); a.noise(0.05, { vol: 0.08, freq: 3000 }); } break;
      case 'catch': if (raw) a.tone(520, 0.16, { type: 'sine', vol: 0.15, slide: 3 }); break;
      case 'boom': if (raw) { a.noise(0.45, { vol: 0.28, freq: 700, q: 0.7, type: 'lowpass' }); a.tone(180, 0.35, { type: 'sine', vol: 0.18, slide: 0.25 }); } a.play('pop'); break;
      case 'boomBig': if (raw) { a.noise(0.8, { vol: 0.4, freq: 500, q: 0.7, type: 'lowpass' }); a.tone(140, 0.6, { type: 'sine', vol: 0.22, slide: 0.2 }); } break;
      case 'wave': if (raw) { a.tone(110, 0.5, { type: 'sawtooth', vol: 0.05 }); a.tone(165, 0.5, { type: 'sawtooth', vol: 0.04, delay: 0.25 }); } break;
      case 'pickup': a.play('coin'); break;
      case 'hit': case 'empty': a.play('bump'); break;
      case 'stomp': a.play('boing'); break;
      case 'shield': a.play('bubble'); break;
      case 'shieldBreak': case 'pop': a.play('pop'); break;
      case 'crate': case 'round': a.play('star'); break;
      case 'rift': a.play('trap'); break;
      case 'spit': a.play('splat'); break;
      case 'charge': case 'over': a.play('dizzy'); break;
      default: a.play(name); // dash, rescue, go
    }
  }

  // ---------- loop ----------

  update(dt) {
    if (this.state === 'vote') this.picker?.update(dt);
    const m = this.match;
    if (m && this.state === 'play') {
      for (const pl of m.humans()) this.readControls(pl);
      this.acc = Math.min(this.acc + dt, STEP * 4);
      while (this.acc >= STEP - 1e-6) {
        for (const pl of m.pilots) {
          if (pl.bot) pl.ctl = pl.brain.control(STEP);
          else if (pl.tipT > 0) pl.tipT -= STEP;
        }
        m.step(STEP);
        // Taps count once, on the first step that sees them.
        for (const pl of m.humans()) { pl.ctl.fire = false; pl.ctl.dash = false; }
        this.acc -= STEP;
        if (this.state !== 'play') break;
      }
      for (const pl of m.humans()) {
        if (pl.ship.alive && pl.ship.ammo === 0 && !pl.toldEmpty && !m.controlsLocked) { pl.toldEmpty = true; this.tip(pl, 'sf.tip.empty', 3.5); }
      }
    }
    if (m) {
      m.updateViews(this.state === 'play' ? dt : 0);
      this.updateTop();
    }
    if (this.updateResults(dt)) return;
  }

  updateTop() {
    const m = this.match;
    if (this.state === 'intro' || this.state === 'results') return;
    let html = `<div class="pill hud-title">${t('game.spacefall')}</div>`;
    if (this.mode === 'versus') {
      html = `<div class="pill"><b>${t('sf.hudRound', { n: Math.max(1, m.round) })}</b></div>${html}<div class="pill"><b>${t('sf.hudFirst', { n: this.rounds })}</b></div>`;
    } else if (this.mode === 'frenzy') {
      html = `<div class="pill"><span class="big-num">${Math.ceil(m.timeLeft)}</span></div>${html}`;
    } else {
      const left = (m.queue ? m.queue.length : 0) + m.aliens.length + m.rifts.length;
      const boss = m.aliens.find((a) => a.boss);
      const wave = t('sf.hudWave', { n: Math.max(1, m.wave), m: COOP.waves });
      const extra = boss ? `<div class="pill"><b>${t('sf.hudQueen')}</b> ${'♥'.repeat(Math.ceil((boss.hp / boss.maxHp) * 10))}</div>` : `<div class="pill">${t('sf.hudLeft', { n: left })}</div>`;
      html = `<div class="pill"><b>${wave}</b></div>${html}${extra}`;
    }
    if (html !== this.topHtml) { this.topHtml = html; this.pillT = 0; }
    this.game.ui.setTop(html);
    if (m.shared) this.game.ui.bar(m.pilots, (pl) => m.scoreText(pl));
  }

  render(renderer) {
    const m = this.match;
    if (!m) {
      renderer.render(this.scene, this.camera);
      this.hud.clear();
      return;
    }
    const H = window.innerHeight;
    const pr = renderer.getPixelRatio();
    // Shadows are drawn once per frame, not once per viewport.
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = true;
    renderer.setScissorTest(true);
    for (const v of m.views) {
      const r = v.rect;
      renderer.setViewport(r.x, H - r.y - r.h, r.w, r.h);
      renderer.setScissor(r.x, H - r.y - r.h, r.w, r.h);
      m.sparks.setViewportHeight(r.h * pr, VIEW.fov);
      renderer.render(this.scene, v.camera);
    }
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, window.innerWidth, H);
    // Where the top pills are, so split-screen player cards can stay clear of them.
    if (!this.pillT || --this.pillT <= 0) {
      this.pillT = 15;
      const kids = [...this.game.ui.top.children].map((e) => e.getBoundingClientRect());
      this.pillRect = kids.length ? {
        left: Math.min(...kids.map((r) => r.left)) - 8, right: Math.max(...kids.map((r) => r.right)) + 8,
        top: Math.min(...kids.map((r) => r.top)) - 8, bottom: Math.max(...kids.map((r) => r.bottom)) + 8,
      } : null;
    }
    this.hud.draw(m, this.state === 'play', this.pillRect);
  }

  // ---------- results ----------

  end(r) {
    if (this.state === 'results') return;
    // Ended from outside (tests, campaign tools) before the match decided: use the standings so far.
    if (!r) {
      if (!this.match) return;
      r = { mode: this.match.mode, pilots: this.match.pilots, wave: this.match.wave };
    }
    const pilots = r.pilots;
    let title, subtitle, rows, stars = 2;
    const pops = (n) => (n === 1 ? t('sf.pop1') : t('sf.popsN', { n }));
    if (r.mode === 'versus') {
      const ranked = [...pilots].sort((a, b) => b.wins - a.wins || b.pops - a.pops || a.deaths - b.deaths);
      const top = ranked[0];
      title = t('win', { name: top.name });
      subtitle = t('sf.versusSub', { n: this.rounds });
      rows = ranked.map((pl) => ({ css: pl.css, name: pl.name, value: t('sf.winsN', { n: pl.wins }), detail: t('sf.detail', { k: pl.pops, d: pl.deaths }), crown: pl === top }));
    } else if (r.mode === 'frenzy') {
      const ranked = [...pilots].sort((a, b) => b.pops - a.pops || a.deaths - b.deaths);
      const top = ranked[0];
      const tie = ranked.length > 1 && ranked[1].pops === top.pops && ranked[1].deaths === top.deaths;
      title = tie ? t('tie') : t('win', { name: top.name });
      subtitle = t('sf.frenzySub');
      rows = ranked.map((pl) => ({ css: pl.css, name: pl.name, value: pops(pl.pops), detail: t('sf.poppedN', { d: pl.deaths }), crown: pl.pops === top.pops && pl.deaths === top.deaths && pl.pops > 0 }));
    } else {
      const ranked = [...pilots].sort((a, b) => b.score - a.score);
      const cleared = r.won ? COOP.waves : Math.max(0, r.wave - 1);
      title = r.won ? t('sf.coopWin') : t('sf.coopLose', { n: r.wave });
      subtitle = t('sf.coopSub', { n: cleared, m: COOP.waves });
      rows = ranked.map((pl, i) => ({ css: pl.css, name: pl.name, value: t('sf.points', { n: pl.score }), detail: t('sf.coopDetail', { k: pl.kills, r: pl.rescues }), crown: i === 0 && pl.score > 0 }));
      if (r.won) stars = 3;
    }
    this.result = r;
    this.match.texts.length = 0;
    this.game.ui.bar([]);
    this.finish({ title, subtitle, rows, stars });
  }

  /** Story campaign hook: how the stage went. */
  campaignStats() {
    const r = this.result;
    return r ? { won: r.mode === 'coop' ? !!r.won : true, wave: r.wave } : {};
  }

  dispose() {
    super.dispose();
    this.game.renderer.shadowMap.autoUpdate = true;
  }
}
