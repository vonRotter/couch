import * as THREE from 'three';
import '@fontsource/fredoka/400.css';
import '@fontsource/fredoka/600.css';
import '@fontsource/fredoka/700.css';
import './style.css';

import { Input, buttonLabel, setPadLayout, KEYBOARD_SCHEMES } from './core/input.js';
import { PLAYER_COLORS } from './core/palette.js';
import { Roster } from './core/roster.js';
import { AudioEngine } from './core/audio.js';
import { UI } from './core/ui.js';
import { t, tFor, setLang, getLang, setButtonSource } from './core/i18n.js';
import { esc } from './core/ui.js';
import { HubScene } from './scenes/hub.js';
import { SoloIslandScene } from './scenes/solo/island.js';
import './scenes/solo/devtime.js'; // playtest time machine, hidden unless ?dev (F9)
import { BubbleScene } from './scenes/bubble.js';
import { PlatformerScene } from './scenes/platformer.js';
import { PaintScene } from './scenes/paint.js';
import { SpacefallScene } from './scenes/spacefall.js';
import { BrawlScene } from './scenes/brawl.js';
import { KartScene } from './scenes/kart.js';
import { PortalScene } from './scenes/portal.js';
import { SpellingScene } from './scenes/spelling.js';
import { MathScene } from './scenes/math.js';
import { FootballScene } from './scenes/football.js';
import { SlalomScene } from './scenes/slalom.js';
import { HockeyScene } from './scenes/hockey.js';
import { PartyScene } from './scenes/party.js';
import { SpaceScene } from './scenes/space.js';
import { RunnerScene } from './scenes/runner.js';
import { CookScene } from './scenes/cook.js';
import { HideSeekScene } from './scenes/hideseek.js';
import { SnowballScene } from './scenes/snowball.js';
import { LearnMixScene } from './scenes/learnmix.js';
import { GolfScene } from './scenes/golf.js';
import { CastleScene } from './scenes/castle.js';
import { castleEntry } from './scenes/castle-campaign.js';
import { KeepScene } from './scenes/keep.js';
import { GuidesScene } from './scenes/guides.js';
import { SplashScene } from './scenes/splash.js';
import { CaveScene } from './scenes/cave.js';
import { DogfightScene } from './scenes/dogfight.js';
import { DuckHuntScene } from './scenes/duckhunt.js';
import { AdventureScene } from './scenes/adventure.js';
import { LighthouseScene } from './scenes/lighthouse.js';
import { BreachScene } from './scenes/breach.js';
import { KeepSoloScene } from './scenes/keepsolo.js';
import { StoryScene, STORY_GAMES } from './scenes/story.js';
import { activateProfile, updateProfile, soloSaveKey, getProfile } from './core/profiles.js';
import { StartScene } from './scenes/start.js';
import { coopReward, nameList } from './core/coop.js';
import { setVoice, voiceOn, say, setBabble, babbleMode, setVoiceAudio } from './core/voice.js';
import * as assist from './core/assist.js';
import { settingsFor, deviceSettings, screenSettings, assistVersion, TEXT_SIZES, setCalm } from './core/assist.js';
import { AssistMenu, OfferCard, schemeKeys, menuDevices } from './core/assistmenu.js';
import { refreshOutlines } from './core/outline.js';
import * as passport from './core/passport.js';
import { tickPlayTime, flushPlayTime, logAssist } from './core/passport.js';
import { ParentPage, HOLD_SECONDS } from './core/parentpage.js';
import { TutorialCard, wantsTutorial } from './core/tutorial.js';
import './core/devvoices.js'; // dev voice panel, hidden unless ?dev (F10)

// The pause menu in every game (chars is a setting that switches in place). While a tutorial runs
// (scene.tutorialActive()) it also has "Skip the tutorial" (core/tutorial.js).
const PAUSE_ITEMS = ['resume', 'retry', 'assist', 'end', 'chars'];

export const GAMES = {
  bubble: { Scene: BubbleScene },
  platformer: { Scene: PlatformerScene },
  paint: { Scene: PaintScene },
  spacefall: { Scene: SpacefallScene },
  brawl: { Scene: BrawlScene },
  kart: { Scene: KartScene },
  portal: { Scene: PortalScene },
  football: { Scene: FootballScene },
  slalom: { Scene: SlalomScene },
  hockey: { Scene: HockeyScene },
  party: { Scene: PartyScene },
  space: { Scene: SpaceScene },
  runner: { Scene: RunnerScene },
  cook: { Scene: CookScene },
  hideseek: { Scene: HideSeekScene },
  snowball: { Scene: SnowballScene },
  golf: { Scene: GolfScene },
  castle: { Scene: castleEntry(CastleScene) }, // Versus, or the Golden Bean campaign with opts.mode 'campaign'
  keep: { Scene: KeepScene },
  guides: { Scene: GuidesScene },
  splash: { Scene: SplashScene },
  cave: { Scene: CaveScene },
  dogfight: { Scene: DogfightScene },
  duckhunt: { Scene: DuckHuntScene },
  adventure: { Scene: AdventureScene },
  lighthouse: { Scene: LighthouseScene },
  breach: { Scene: BreachScene }, // Bean Brigade (solo island only)
  keepsolo: { Scene: KeepSoloScene }, // Pillow Keep Solo (solo island only; the co-op Pillow Keep is 'keep')
  story: { Scene: StoryScene },
  ...STORY_GAMES, // the four Grumble King boss games (only reachable from the story map)
  spelling: { Scene: SpellingScene, edu: true },
  math: { Scene: MathScene, edu: true },
  learnmix: { Scene: LearnMixScene, edu: true },
};

class Game {
  constructor() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    document.getElementById('app').appendChild(this.renderer.domElement);

    this.input = new Input();
    this.roster = new Roster();
    setLang(this.roster.progress.lang || 'en');
    setVoice(this.roster.progress.voice === true);
    setBabble(this.roster.progress.babble === true);
    // Solo island state: { profile } while a profile plays on its own island, else null.
    this.solo = null;
    // Deep links: #solo (guest games link back with it: the player picker, that profile chosen) and
    // #together (straight to the shared island, "Play together").
    const hash = location.hash;
    if (hash === '#solo' || hash === '#together') history.replaceState(null, '', location.pathname + location.search);
    setButtonSource((b, only) => {
      let devs = only ? [this.input.get(only)].filter(Boolean) : this.roster.players.map((p) => this.input.get(p.deviceId)).filter(Boolean);
      if (!devs.length) devs = [this.input.get('kb0'), ...[0, 1, 2, 3].map((i) => this.input.get(`gp${i}`)).filter((d) => d.connected)];
      return [...new Set(devs.map((d) => buttonLabel(d, b)))];
    });
    this.audio = new AudioEngine();
    setVoiceAudio(this.audio); // babble plays on the game's sound bus
    this.ui = new UI(document.getElementById('ui'));
    this.lastActivity = performance.now();
    this.input.onActivity = () => { this.audio.ensure(); this.lastActivity = performance.now(); };
    // play time per profile per day (core/passport.js, the parent page): written now and then and when leaving
    this.passport = passport; // also for tests
    window.addEventListener('pagehide', () => flushPlayTime());
    document.addEventListener('visibilitychange', () => { if (document.hidden) flushPlayTime(); });

    this.assist = assist; // "Help me play" settings (core/assist.js), also for tests
    this.current = null;
    this.switching = false;
    // Story campaign: the stage being played ({ id, opts, stats }), or null in free play.
    this.campaign = null;
    this.last = performance.now();

    window.addEventListener('resize', () => this.resize());
    // The game starts with the player picker (the last player chosen), then that player's own island.
    this.setScene(() => (hash === '#together' ? new HubScene(this, {}) : new StartScene(this)));
    this.loop();
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.current?.resize(w, h);
  }

  setScene(make) {
    flushPlayTime();
    if (this.current) this.current.dispose();
    this.ui.clear();
    this.tutorialCard = null; // (a card for the old scene went with it)
    this.input.clearLatches(); // hold to toggle: every hold starts off in a new scene
    this.sceneAt = performance.now();
    this.current = make();
    this.current.resize(window.innerWidth, window.innerHeight);
    this.applyScreenSettings();
  }

  // ---------- "Help me play" (core/assist.js) ----------

  /**
   * Give every device its player's settings: keyboard and pad remaps, hold to toggle and the scene's hold
   * buttons. A device nobody plays with (the start screen, joining) uses the device default.
   */
  applyDeviceSettings(force = false) {
    const sig = `${assistVersion()}|${this.roster.players.map((p) => `${p.deviceId}:${p.profileId || ''}`).join(',')}`;
    const holds = this.current?.holdButtons || [];
    const tapHolds = this.current?.tapHoldButtons || []; // tapped and held: a double tap holds (input.js)
    if (force || sig !== this.deviceSig) {
      this.deviceSig = sig;
      const extra = new Set();
      for (const d of this.input.devices.values()) {
        const p = this.roster.players.find((q) => q.deviceId === d.id);
        const s = p ? settingsFor(p) : deviceSettings();
        d.toggle = !!s.toggle;
        if (!p) { d.latch = {}; d.tapLatch = {}; } // a player who left (held [B] or [C] to leave) holds nothing
        if (d.type === 'keyboard') {
          const k = schemeKeys(s, d.scheme);
          const same = ['a', 'b', 'c'].every((b) => k[b][0] === d.scheme[b][0]);
          d.keys = same ? null : k;
          if (d.keys) for (const b of ['a', 'b', 'c']) extra.add(d.keys[b][0]);
        } else d.padMap = s.pad || null;
      }
      this.input.extraCodes = extra;
      this.applyScreenSettings(); // someone joined or left, or settings changed: text size and outlines follow
    }
    for (const d of this.input.devices.values()) { d.holdKeys = holds; d.tapHoldKeys = tapHolds; }
  }

  /** Hold to toggle: a small chip per held button ("Coral: E held · tap to let go"), so a latched hold is never a surprise. */
  updateHoldChips() {
    if (!this.holdEl) {
      this.holdEl = document.createElement('div');
      this.holdEl.className = 'ui-holds';
      this.ui.root.appendChild(this.holdEl);
    }
    let html = '';
    if (!this.pause && (this.current?.holdButtons || this.current?.tapHoldButtons)) {
      const fresh = this.current.tapHoldHint !== false && performance.now() - (this.sceneAt || 0) < 9000; // the double-tap hint, for a while after a game starts
      for (const p of this.roster.players) {
        const d = this.input.get(p.deviceId);
        if (!d?.toggle) continue;
        const chip = (key, vars) => `<div class="hold-chip" style="--c:${p.css}">🔒 ${esc(tFor(p, key, vars))}</div>`;
        for (const k of d.holdKeys) if (d.latch[k]) html += chip('assist.held', { name: p.name, b: `[${k.toUpperCase()}]` });
        for (const k of d.tapHoldKeys || []) {
          if (d.tapLatch[k]) html += chip('assist.held', { name: p.name, b: `[${k.toUpperCase()}]` });
          else if (fresh) html += `<div class="hold-chip hint" style="--c:${p.css}">👆👆 ${esc(tFor(p, 'assist.tapHold', { name: p.name, b: `[${k.toUpperCase()}]` }))}</div>`;
        }
      }
    }
    if (html !== this.holdHtml) { this.holdHtml = html; this.holdEl.innerHTML = html; }
  }

  /** Text size and outlines for what is on screen (the solo profile's, or the most anyone playing asked for). */
  applyScreenSettings() {
    const s = screenSettings(this);
    const root = document.documentElement;
    root.style.setProperty('--ts', String(TEXT_SIZES[s.text] || 1));
    root.classList.toggle('a11y-text', s.text > 0);
    root.classList.toggle('a11y-contrast', !!s.contrast);
    root.classList.toggle('a11y-calm', !!s.calm); // reduce flashing and shake (fast CSS blinks slow down)
    setCalm(s.calm);
    this.ui.textScale = TEXT_SIZES[s.text] || 1;
    if (this.contrastOn !== !!s.contrast || this.outlinedScene !== this.current) {
      this.contrastOn = !!s.contrast;
      this.outlinedScene = this.current;
      refreshOutlines(this.current?.scene, this.contrastOn);
      this.current?.onContrast?.(this.contrastOn);
    }
  }

  /**
   * The "Help me play" page. On a profile's own island: that profile's settings. Elsewhere: the device default
   * (guests and the shared island) and every profile playing. onClose: where to go back to.
   */
  openAssist(onClose = null) {
    if (this.assistMenu) return;
    const targets = this.solo?.profile
      ? [{ id: this.solo.profile.id, name: this.solo.profile.name }]
      : [{ id: '', name: t('assist.everyone') }, ...this.roster.players.filter((p) => p.profileId).map((p) => ({ id: p.profileId, name: p.name }))];
    this.audio.play('select');
    this.assistMenu = new AssistMenu(this, { targets, onClose: () => { this.assistMenu = null; this.applyDeviceSettings(true); onClose?.(); } });
  }

  /** A game noticed repeated tries (assist.js struggle()): offer the matching help, unless a menu is up. */
  offerAssist({ kind, player, skip = null }) {
    if (this.offer || this.assistMenu || this.pause || this.switching || this.parentPage) return false;
    this.offer = new OfferCard(this, { kind, player, skip, onClose: () => { this.offer = null; } });
    return true;
  }

  /**
   * The first card of a tutorial (core/tutorial.js): "Show me how" or "I know how to play", the first time
   * tutorial `id` would start for these players. Resolves 'show', 'skip' (remembered per profile) or 'seen'
   * (nobody here needs it: done, skipped before, or tutorials are off). The game waits behind the card.
   */
  askTutorial({ id, title, players = this.roster.players }) {
    if (!wantsTutorial(this, players, id)) return Promise.resolve('seen');
    // (a card left behind by a scene switch is never answered: setScene drops it; the game checks it is still on)
    return new Promise((resolve) => {
      const card = new TutorialCard(this, {
        id, title, players,
        onAnswer: (k) => { if (this.tutorialCard === card) this.tutorialCard = null; resolve(k); },
      });
      this.tutorialCard = card;
    });
  }

  /** Switch scenes behind the circle wipe. */
  transition(make) {
    if (this.switching) return;
    this.switching = true;
    this.audio.play('whoosh');
    this.ui.wipe(() => this.setScene(make)).then(() => { this.switching = false; });
  }

  /** Back from a game: to the player's own island (solo) or to the shared island (the story is a place there). */
  goHub(fromGame = null) {
    if (this.campaign) { this.backToStory(); return; }
    const make = this.solo
      ? () => new SoloIslandScene(this, { fromGame })
      : () => new HubScene(this, { fromGame });
    if (!this.current) this.setScene(make);
    else this.transition(make);
  }

  // ---------- story campaign ----------

  /** Start a story stage: { id, key, opts }. Results and the pause menu lead back to the map. */
  startStage(stage) {
    const def = GAMES[stage.key];
    if (!def || this.switching || this.roster.players.length === 0) return;
    this.campaign = { id: stage.id, opts: { ...stage.opts, campaign: true }, stats: null };
    this.transition(() => new def.Scene(this, { key: stage.key, ...this.campaign.opts }));
  }

  /** Called by MiniGame.finish() during a campaign stage. */
  reportStage(scene) {
    if (!this.campaign || this.campaign.stats) return;
    this.campaign.stats = { time: scene.playTime, ...(scene.campaignStats?.() || {}), n: scene.players.length };
  }

  /** Back to the story map with the stage result (no stats = ended early from the pause menu). */
  backToStory() {
    if (this.switching) return;
    const c = this.campaign;
    this.campaign = null;
    const result = { id: c.id, stats: c.stats, quit: !c.stats };
    this.transition(() => new StoryScene(this, { key: 'story', result }));
  }

  // ---------- solo island, the start screen and playing together ----------

  /**
   * Play on a profile's own island: one player (the device that chose it, joined if needed), the profile's
   * own saves. opts.fromGame: where to appear ('ferry': at the Party Pier, back from the shared island).
   */
  enterSolo(profile, deviceId, { fromGame = null } = {}) {
    let keep = this.roster.players.find((p) => p.deviceId === deviceId) || null;
    if (!keep && !deviceId) keep = this.roster.players.find((p) => p.profileId === profile.id) || this.roster.players[0] || null;
    for (const p of [...this.roster.players]) if (p !== keep) this.roster.leave(p);
    const dev = deviceId && this.input.get(deviceId);
    if (!keep && dev) keep = this.roster.join(dev);
    activateProfile(profile);
    this.roster.useSave(soloSaveKey(profile.id));
    this.solo = { profile };
    if (keep) this.applyProfile(keep, profile);
    setVoice(profile.voice);
    setBabble(profile.babble === true);
    if (profile.voice) say(t('solo.welcome', { name: profile.name }), 'narrator');
    this.transition(() => new SoloIslandScene(this, { fromGame }));
  }

  /**
   * Give a player a profile's name, color and hat (default: the solo profile). On the shared island
   * (shared = true) the profile's color is used only if nobody else has it (else the free color stays).
   */
  applyProfile(player, prof = this.solo?.profile, { shared = false } = {}) {
    if (!prof) return;
    player.profileName = prof.name;
    player.profileId = prof.id;
    if (!shared) this.roster.applyColor(player, prof.colorIndex);
    else if (PLAYER_COLORS[prof.colorIndex]) this.roster.setColor(player, prof.colorIndex);
    player.hat = prof.hat ?? 1;
  }

  /**
   * "Play together": from a profile's island (the Party Pier ferry or the menu) to the shared island, with
   * that player already joined as player 1. The shared island uses the shared saves.
   */
  goTogether() {
    const prof = this.solo?.profile || null;
    this.leaveSolo('ferry', prof);
  }

  /** The start screen's "Play together": the shared island, and the device that chose it picks who it is. */
  openTogether(deviceId = null) {
    for (const p of [...this.roster.players]) this.roster.leave(p);
    this.solo = null;
    this.roster.useSave();
    setVoice(this.roster.progress.voice === true);
    setBabble(this.roster.progress.babble === true);
    this.transition(() => new HubScene(this, { joinDevice: deviceId }));
  }

  /**
   * Back to the shared island (mode 'island', or 'ferry': arriving by the ferry; 'story' starts the story),
   * with the shared saves. Players who keep a profile (prof) stay that profile there.
   */
  leaveSolo(mode = 'island', prof = null) {
    this.solo = null;
    this.roster.useSave();
    for (const p of this.roster.players) {
      if (prof && p.profileId === prof.id) continue;
      delete p.profileName;
      delete p.profileId;
    }
    setVoice(this.roster.progress.voice === true);
    setBabble(this.roster.progress.babble === true);
    if (mode === 'story') this.startGame('story');
    else this.transition(() => new HubScene(this, { fromGame: mode === 'ferry' ? 'ferry' : null }));
  }

  /** The shared island's ferry home: player 1's own island, or the player picker if player 1 is a guest. */
  goHome() {
    const first = this.roster.first();
    const prof = first?.profileId ? getProfile(first.profileId) : null;
    if (prof) this.enterSolo(prof, first.deviceId, { fromGame: 'ferry' });
    else this.openStart();
  }

  /** The player picker (the start screen). */
  openStart() {
    for (const p of [...this.roster.players]) this.roster.leave(p);
    this.solo = null;
    this.roster.useSave();
    this.transition(() => new StartScene(this));
  }

  /**
   * A co-op game on the shared island was finished (MiniGame.finish): every player who joined as a profile
   * gets coins and maybe a badge on their own island (core/coop.js). Games on a profile's island do not count.
   */
  coopFinished(scene) {
    if (this.solo || !scene.key) return;
    const key = this.campaign ? 'story' : scene.key; // the story's stages and bosses count as the Story
    const got = [];
    for (const p of this.roster.players) {
      if (!p.profileId || !getProfile(p.profileId)) continue;
      if (coopReward(this.roster, p.profileId, key)) got.push(p.name);
    }
    if (got.length) this.ui.toast(t('coop.toast', { names: nameList(got) }), 3200);
  }

  /** Keep the solo profile in step with the player's hat and color. */
  syncProfile(player) {
    if (!this.solo) return;
    const prof = this.solo.profile;
    prof.hat = player.hat;
    prof.colorIndex = player.colorIndex;
    updateProfile(prof);
  }

  /**
   * Open a guest game (its own repo on the same site) for the solo profile. It reads the profile
   * from the link (or localStorage 'couch.profile') and returns to the solo island via #solo.
   */
  launchGuest(name) {
    const prof = this.solo?.profile;
    if (!prof) return;
    this.roster.save();
    passport.report(this, 'launch', { key: name }, { quiet: true }); // a guest game: the launch is all we see (the passport)
    flushPlayTime();
    const base = location.hostname.endsWith('github.io') ? location.origin : 'https://vonrotter.github.io';
    const back = location.origin + location.pathname + '#solo';
    const q = new URLSearchParams({ profile: prof.id, name: prof.name, return: back, lang: getLang() });
    this.audio.play('whoosh');
    this.ui.wipe(() => { location.href = `${base}/${name}/?${q}`; });
  }

  toggleVoice() {
    const on = !voiceOn();
    setVoice(on);
    if (this.solo) { this.solo.profile.voice = on; updateProfile(this.solo.profile); } else { this.roster.progress.voice = on; this.roster.save(); }
    this.ui.toast(t(on ? 'voice.on' : 'voice.off'));
    if (on) say(t('voice.on'), 'narrator');
  }

  /** B: characters babble (WebAudio syllables) or speak with their voice types; the narrator always reads. */
  toggleBabble() {
    const on = !babbleMode();
    setBabble(on);
    if (this.solo) { this.solo.profile.babble = on; updateProfile(this.solo.profile); } else { this.roster.progress.babble = on; this.roster.save(); }
    this.audio.play('select');
    this.ui.toast(voiceOn() ? t(on ? 'voice.babbleOn' : 'voice.babbleOff') : `${t(on ? 'voice.babbleOn' : 'voice.babbleOff')} · ${t('voice.babbleNeedsVoice')}`, 2600);
    // the narrator says what changed, then a character shows how it sounds now
    if (voiceOn()) say([[t(on ? 'voice.babbleOn' : 'voice.babbleOff'), 'narrator'], [t('voice.sample'), 'isl.pip']]);
  }

  toggleLanguage() {
    setLang(getLang() === 'en' ? 'no' : 'en');
    this.roster.progress.lang = getLang();
    this.roster.save();
    this.ui.toast(t('lang.switched'));
    this.current?.onLanguage?.();
  }

  // ---------- pause menu ----------

  openPause() {
    this.pause = { index: 0, el: null };
    this.audio.play('select');
    this.renderPause();
  }

  /** The pause menu's items now ("Skip the tutorial" only while one runs). */
  pauseItems() {
    if (!this.current?.tutorialActive?.()) return PAUSE_ITEMS;
    const items = [...PAUSE_ITEMS];
    items.splice(items.indexOf('end'), 0, 'skiptut');
    return items;
  }

  renderPause() {
    const items = this.pauseItems();
    const label = (k) => (k === 'chars' ? `${t('pause.chars')}: ${t(babbleMode() ? 'pause.charsBabble' : 'pause.charsVoices')}` : k === 'assist' ? t('assist.title') : t(`pause.${k}`));
    const html = `<div class="results-title">${t('pause.title')}</div>
      <div class="pause-list">${items.map((k, i) => `<div class="pause-item ${i === this.pause.index ? 'on' : ''}">${label(k)}</div>`).join('')}</div>
      <div class="results-footer">${t('pause.hint')}</div>`;
    if (!this.pause.el) this.pause.el = this.ui.panel(html, 'panel pause');
    else this.pause.el.innerHTML = html;
  }

  closePause() {
    this.pause?.el?.remove();
    this.pause = null;
  }

  updatePause() {
    const P = this.pause;
    const items = this.pauseItems();
    for (const p of this.roster.players) {
      const d = this.input.get(p.deviceId);
      if (!d) continue;
      const dir = -d.stepY;
      const n = items.length;
      if (dir) {
        P.index = (P.index + dir + n) % n;
        this.audio.play('select');
        this.renderPause();
      }
      // a gamepad's B goes back (resumes); it never picks (keyboards pick with Space or E, Esc resumes)
      if (d.backPressed) { this.closePause(); this.audio.play('select'); return; }
      const k = items[P.index];
      // the last item is a setting: pick or left/right switches it, the menu stays open
      if (k === 'chars' && (d.okPressed || d.stepX)) { this.toggleBabble(); this.renderPause(); continue; }
      // Help me play: its page, then back to this menu
      if (k === 'assist' && d.okPressed) {
        this.closePause();
        this.openAssist(() => { this.openPause(); this.pause.index = this.pauseItems().indexOf('assist'); this.renderPause(); });
        return;
      }
      if (k === 'skiptut' && d.okPressed) {
        this.closePause();
        this.current.skipTutorial?.();
        this.ui.toast(t('tut.skipped'), 2600);
        return;
      }
      if (d.okPressed) {
        const choice = ['resume', 'retry', 'end'].indexOf(k);
        this.closePause();
        if (choice === 1) {
          let opts = this.current.retryOptions();
          // A story stage retries with its own settings (no votes) and stays in the campaign.
          if (this.campaign) {
            opts = { ...opts, ...this.campaign.opts };
            this.campaign.stats = null;
          }
          const def = GAMES[opts.key];
          this.transition(() => new def.Scene(this, { ...opts, retry: true })); // retry: a quick intro (MiniGame)
        } else if (choice === 2) {
          this.goHub(this.current.key);
        }
        return;
      }
    }
  }

  startGame(key, opts = {}) {
    const def = GAMES[key];
    if (!def || this.roster.players.length === 0) return;
    this.transition(() => new def.Scene(this, { key, ...opts }));
  }

  loop() {
    requestAnimationFrame(() => this.loop());
    const now = performance.now();
    const dt = Math.min((now - this.last) / 1000, 1 / 30);
    this.last = now;
    this.tick(dt);
    if (!this.current) return;
    if (this.current.render) this.current.render(this.renderer);
    else this.renderer.render(this.current.scene, this.current.camera);
  }

  /** What a profile is playing now, for the play-time log (the scene's key; the solo island is 'island'). */
  get playKey() {
    const cur = this.current;
    if (!cur) return null;
    if (cur.schoolId) return 'school';
    if (this.campaign) return 'story';
    return cur.key || (cur.mapKey ? 'island' : cur instanceof HubScene ? 'hub' : null);
  }

  /** A help offer was taken (assistmenu.js OfferCard): the parent page lists them. */
  passportAssist(profileId, kind) {
    logAssist(profileId, kind, this.playKey);
  }

  // ---------- the parent page (core/parentpage.js) ----------

  /** A menu is up: the start screen (player picker), the solo island's menu, or a game's pause menu. */
  get inMenu() {
    return !!this.pause || this.current instanceof StartScene || this.current?.mode === 'menu';
  }

  /**
   * Hold View + Start on a gamepad or H on a keyboard for 3 seconds, starting in a menu: the parent page. A small
   * ring fills while held (so a grown-up knows to keep holding); letting go early does nothing.
   */
  updateParentHold(dt) {
    const pad = [...this.input.devices.values()].some((d) => d.type !== 'keyboard' && d.connected && d.btn?.view && d.btn?.start);
    const held = pad || this.input.down.has('KeyH');
    if (!held || this.parentPage || this.assistMenu) {
      if (this.parentHold) { this.parentHold.el?.remove(); this.parentHold = null; }
      if (!held) this.parentHoldDone = false;
      return;
    }
    if (this.parentHoldDone) return;
    if (!this.parentHold) {
      if (!this.inMenu) return;
      this.parentHold = { t: 0, el: document.createElement('div') };
      this.parentHold.el.className = 'parent-hold';
      this.ui.root.appendChild(this.parentHold.el);
    }
    const H = this.parentHold;
    H.t += dt;
    const k = Math.min(1, H.t / HOLD_SECONDS);
    H.el.innerHTML = `<i style="--p:${(k * 100).toFixed(0)}%"></i><span>${esc(t('pg.hold'))}</span>`;
    if (k >= 1) {
      H.el.remove();
      this.parentHold = null;
      this.parentHoldDone = true; // let go before it can open again
      this.openParentPage();
    }
  }

  openParentPage() {
    if (this.parentPage) return;
    this.parentPage = new ParentPage(this, { onClose: () => { this.parentPage = null; } });
  }

  tick(dt) {
    // play time (real seconds; not while idle for a few minutes, nor on the start screen where nobody plays)
    if (!this.parentPage) tickPlayTime(this, dt, { key: this.playKey, idle: (performance.now() - this.lastActivity) / 1000 });
    // the solo island and its dive have their own gamepad layout (A jump, X use, B back; input.js)
    setPadLayout(this.current?.padLayout || 'default');
    this.applyDeviceSettings();
    this.input.update();
    this.updateHoldChips();
    // strong outlines: now and then outline what spawned since (cheap: only marked models get hulls)
    if (this.contrastOn && (this.outlineT = (this.outlineT || 0) + dt) > 0.5) { this.outlineT = 0; refreshOutlines(this.current?.scene, true); }
    // the parent page (a hold in a menu) waits in front of everything too
    this.updateParentHold(dt);
    if (this.parentPage) {
      this.parentPage.update(dt);
      this.input.endFrame();
      return;
    }
    // "Help me play" and its offers wait in front of everything (the game is frozen behind them)
    if (this.assistMenu || this.offer) {
      (this.assistMenu || this.offer).update(dt);
      this.input.endFrame();
      return;
    }
    // so does a tutorial's first card ("Show me how" / "I know how to play", core/tutorial.js)
    if (this.tutorialCard && !this.switching) {
      this.tutorialCard.update(dt, menuDevices(this));
      this.input.endFrame();
      return;
    }
    // M switches the sound (on the solo island it opens the map: its menu has Sound)
    if (this.input.mutePressed && !this.current?.mapKey) this.ui.toast(this.audio.toggleMute() ? t('sound.off') : t('sound.on'));
    if (this.input.pressed.has('KeyN')) this.toggleLanguage();
    if (this.input.pressed.has('KeyV')) this.toggleVoice();
    if (this.input.pressed.has('KeyB')) this.toggleBabble();
    if (this.input.menuPressed && !this.switching && this.current && !(this.current instanceof HubScene) && !this.current.ownMenu) {
      if (this.pause) this.closePause();
      else this.openPause();
    }
    if (this.pause) {
      this.updatePause();
      this.input.endFrame();
      return;
    }
    if (this.current) {
      // game speed ("Help me play"): game time runs slower in games and the island's activities, not in menus
      const sp = this.current.speedable ? screenSettings(this).speed : 1;
      const gdt = dt * sp;
      this.current.baseUpdate(gdt);
      if (!this.switching) this.current.update(gdt);
      else this.current.idle?.(gdt);
    }
    this.input.endFrame();
  }

  /** Test hook: advance the game by fixed steps without rendering. */
  simulate(seconds, dt = 1 / 60) {
    for (let t = 0; t < seconds; t += dt) this.tick(dt);
  }
}

window.game = new Game();
