import * as THREE from 'three';
import '@fontsource/fredoka/400.css';
import '@fontsource/fredoka/600.css';
import '@fontsource/fredoka/700.css';
import './style.css';

import { Input, buttonLabel } from './core/input.js';
import { Roster } from './core/roster.js';
import { AudioEngine } from './core/audio.js';
import { UI } from './core/ui.js';
import { t, setLang, getLang, setButtonSource } from './core/i18n.js';
import { HubScene } from './scenes/hub.js';
import { BubbleScene } from './scenes/bubble.js';
import { PlatformerScene } from './scenes/platformer.js';
import { PaintScene } from './scenes/paint.js';
import { ArchersScene } from './scenes/archers.js';
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
import { KeepScene } from './scenes/keep.js';
import { GuidesScene } from './scenes/guides.js';
import { SplashScene } from './scenes/splash.js';
import { CaveScene } from './scenes/cave.js';
import { DogfightScene } from './scenes/dogfight.js';
import { StoryScene, STORY_GAMES } from './scenes/story.js';

export const GAMES = {
  bubble: { Scene: BubbleScene },
  platformer: { Scene: PlatformerScene },
  paint: { Scene: PaintScene },
  archers: { Scene: ArchersScene },
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
  castle: { Scene: CastleScene },
  keep: { Scene: KeepScene },
  guides: { Scene: GuidesScene },
  splash: { Scene: SplashScene },
  cave: { Scene: CaveScene },
  dogfight: { Scene: DogfightScene },
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
    setButtonSource((b) => {
      let devs = this.roster.players.map((p) => this.input.get(p.deviceId)).filter(Boolean);
      if (!devs.length) devs = [this.input.get('kb0'), ...[0, 1, 2, 3].map((i) => this.input.get(`gp${i}`)).filter((d) => d.connected)];
      return [...new Set(devs.map((d) => buttonLabel(d, b)))];
    });
    this.audio = new AudioEngine();
    this.ui = new UI(document.getElementById('ui'));
    this.input.onActivity = () => this.audio.ensure();

    this.current = null;
    this.switching = false;
    // Story campaign: the stage being played ({ id, opts, stats }), or null in free play.
    this.campaign = null;
    this.last = performance.now();

    window.addEventListener('resize', () => this.resize());
    this.goHub();
    this.loop();
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.current?.resize(w, h);
  }

  setScene(make) {
    if (this.current) this.current.dispose();
    this.ui.clear();
    this.current = make();
    this.current.resize(window.innerWidth, window.innerHeight);
  }

  /** Switch scenes behind the circle wipe. */
  transition(make) {
    if (this.switching) return;
    this.switching = true;
    this.audio.play('whoosh');
    this.ui.wipe(() => this.setScene(make)).then(() => { this.switching = false; });
  }

  goHub(fromGame = null) {
    if (this.campaign) { this.backToStory(); return; }
    // Leaving the story goes back to the start menu (Island or Story).
    const make = () => new HubScene(this, { fromGame: fromGame === 'story' ? null : fromGame, chooseMode: fromGame === 'story' });
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

  renderPause() {
    const items = ['resume', 'retry', 'end'];
    const html = `<div class="results-title">${t('pause.title')}</div>
      <div class="pause-list">${items.map((k, i) => `<div class="pause-item ${i === this.pause.index ? 'on' : ''}">${t(`pause.${k}`)}</div>`).join('')}</div>
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
    for (const p of this.roster.players) {
      const d = this.input.get(p.deviceId);
      if (!d) continue;
      const dir = -d.stepY;
      if (dir) {
        P.index = (P.index + dir + 3) % 3;
        this.audio.play('select');
        this.renderPause();
      }
      if (d.aPressed || d.bPressed) {
        const choice = P.index;
        this.closePause();
        if (choice === 1) {
          let opts = this.current.retryOptions();
          // A story stage retries with its own settings (no votes) and stays in the campaign.
          if (this.campaign) {
            opts = { ...opts, ...this.campaign.opts };
            this.campaign.stats = null;
          }
          const def = GAMES[opts.key];
          this.transition(() => new def.Scene(this, opts));
        } else if (choice === 2) {
          this.goHub(this.current.key);
        }
        return;
      }
    }
  }

  startGame(key) {
    const def = GAMES[key];
    if (!def || this.roster.players.length === 0) return;
    this.transition(() => new def.Scene(this, { key }));
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

  tick(dt) {
    this.input.update();
    if (this.input.mutePressed) this.ui.toast(this.audio.toggleMute() ? t('sound.off') : t('sound.on'));
    if (this.input.pressed.has('KeyN')) this.toggleLanguage();
    if (this.input.menuPressed && !this.switching && this.current && !(this.current instanceof HubScene)) {
      if (this.pause) this.closePause();
      else this.openPause();
    }
    if (this.pause) {
      this.updatePause();
      this.input.endFrame();
      return;
    }
    if (this.current) {
      this.current.baseUpdate(dt);
      if (!this.switching) this.current.update(dt);
      else this.current.idle?.(dt);
    }
    this.input.endFrame();
  }

  /** Test hook: advance the game by fixed steps without rendering. */
  simulate(seconds, dt = 1 / 60) {
    for (let t = 0; t < seconds; t += dt) this.tick(dt);
  }
}

window.game = new Game();
