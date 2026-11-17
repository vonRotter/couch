import { MiniGame } from '../../core/minigame.js';
import { ArcadeRunner } from './runner.js';
import { arcadeDef } from './defs.js';

// A Game Hall cabinet's game as a scene of its own (main.js GAMES: snake, blocks, maze, crates, simon, lights,
// bonk, pong, rocks). The runner (runner.js) does the work; back from it goes to the island by that cabinet.
export class ArcadeScene extends MiniGame {
  constructor(game, opts = {}) {
    super(game, opts);
    this.def = arcadeDef(opts.key);
    this.state = 'play';
    this.runner = new ArcadeRunner(this, {
      key: opts.key, scene: this.scene, camera: this.camera, seed: opts.seed,
      onExit: () => this.game.goHub(this.key),
    });
    game.audio.playMusic('arcade');
    this.runner.start();
  }

  get padLayout() { return 'arcade'; }
  get holdButtons() { return this.def?.holds || []; }
  tutorialActive() { return this.runner.tutorialActive; }
  skipTutorial() { this.runner.skipTutorial(); }

  resize(w, h) {
    super.resize(w, h);
    this.runner?.fit();
  }

  update(dt) { this.runner.update(dt); }

  dispose() {
    this.runner.dispose();
    super.dispose();
  }
}
