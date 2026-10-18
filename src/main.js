import * as THREE from 'three';
import '@fontsource/fredoka/400.css';
import '@fontsource/fredoka/600.css';
import '@fontsource/fredoka/700.css';
import './style.css';

import { Input } from './core/input.js';
import { Roster } from './core/roster.js';
import { AudioEngine } from './core/audio.js';
import { UI } from './core/ui.js';
import { t, setLang, getLang } from './core/i18n.js';
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
    this.audio = new AudioEngine();
    this.ui = new UI(document.getElementById('ui'));
    this.input.onActivity = () => this.audio.ensure();

    this.current = null;
    this.switching = false;
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
    const make = () => new HubScene(this, { fromGame });
    if (!this.current) this.setScene(make);
    else this.transition(make);
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
      if (d.bPressed) { this.closePause(); return; }
      if (d.aPressed) {
        const choice = P.index;
        this.closePause();
        if (choice === 1) {
          const opts = this.current.retryOptions();
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
