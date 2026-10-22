import { MiniGame } from '../core/minigame.js';
import './lighthouse/strings.js';
import './lighthouse/sfx.js';
import { LighthouseEngine } from './lighthouse/engine.js';

// Lighthouse Caves: a top-down sword-and-lantern adventure (A Link to the Past / Link's Awakening)
// with a metroidvania heart: one connected island where every new item opens paths in old places.
//
//   stick: walk · [A]: sword (hold, then let go: spin attack) · [B]: talk, read, open, lift, throw
//   [C]: use the equipped item (lantern, grapple rope) · hold [C]: items, map and hearts
//
// This delivery: Lighthouse Island (9 screens and a few houses), dungeon 1 the Lantern Cellar
// (13 rooms, the Lantern), the Gloomy Cave and dungeon 2 the Tidepool Grotto (14 rooms, the
// Grapple Rope), ending with two of the three lamp crystals back in the lighthouse.
//
// Code: lighthouse/engine.js (modes, camera, light, enemies, puzzles, saving), world.js (rooms),
// hero.js, story.js (dialog, items, cutscenes), menu.js, hud.js, enemies.js, models.js, build.js,
// rooms-*.js (all the maps), solver.js (reachability / softlock checker) and strings.js.
// Progress: game.roster.progress.lighthouse (per solo profile).

export class LighthouseScene extends MiniGame {
  constructor(game, opts = {}) {
    super(game, opts);
    this.engine = new LighthouseEngine(this);
    // No countdown: the title card (Continue / New game) is the intro.
    this.state = 'play';
    this.playStart = 0;
    game.audio.playMusic('lhOver');
  }

  update(dt) {
    if (this.updateResults(dt)) return;
    this.engine.update(dt);
  }

  resize(w, h) {
    super.resize(w, h);
    this.engine?.reframe();
  }

  onLanguage() {
    this.engine.onLanguage();
  }

  dispose() {
    if (this.engine.mode !== 'title') this.engine.persist();
    this.engine.dispose();
    super.dispose();
  }
}
