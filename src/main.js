import * as THREE from 'three';
import '@fontsource/fredoka/400.css';
import '@fontsource/fredoka/600.css';
import '@fontsource/fredoka/700.css';
import './style.css';

import { Input } from './core/input.js';
import { Roster } from './core/roster.js';
import { AudioEngine } from './core/audio.js';
import { UI } from './core/ui.js';
import { HubScene } from './scenes/hub.js';
import { BubbleScene } from './scenes/bubble.js';
import { PlatformerScene } from './scenes/platformer.js';
import { PaintScene } from './scenes/paint.js';
import { ArchersScene } from './scenes/archers.js';
import { BrawlScene } from './scenes/brawl.js';
import { KartScene } from './scenes/kart.js';
import { PortalScene } from './scenes/portal.js';

export const GAMES = {
  bubble: { title: 'Bubble Buddies', blurb: 'Trap the grumbles in bubbles!', Scene: BubbleScene },
  platformer: { title: 'Sky Hop', blurb: 'Hop to the flag together!', Scene: PlatformerScene },
  paint: { title: 'Paint Party', blurb: 'Paint the most floor!', Scene: PaintScene },
  archers: { title: 'Balloon Archers', blurb: 'Pop everyone else\'s balloon!', Scene: ArchersScene },
  brawl: { title: 'Bonk Brawl', blurb: 'Bonk friends off the island!', Scene: BrawlScene },
  kart: { title: 'Kart Party', blurb: 'Race three laps!', Scene: KartScene },
  portal: { title: 'Portal Pals', blurb: 'Portal everyone to the exit!', Scene: PortalScene },
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
    if (this.input.mutePressed) this.ui.toast(this.audio.toggleMute() ? 'Sound off' : 'Sound on');
    if (this.input.escPressed && !this.switching && !(this.current instanceof HubScene)) {
      this.goHub(this.current?.key ?? null);
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
