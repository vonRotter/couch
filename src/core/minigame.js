import { BaseScene } from './scene.js';
import { PLAYER_COLORS, COLORS } from './palette.js';

/** Shared flow for every game: intro -> countdown -> play -> results -> back to the island. */
export class MiniGame extends BaseScene {
  constructor(game, { key }) {
    super(game);
    this.key = key;
    this.state = 'intro';
    this.resultsDelay = 0;
  }

  async intro(title, sub) {
    this.state = 'intro';
    await this.game.ui.banner(title, sub, 2300);
    if (this.game.current !== this) return;
    await this.game.ui.countdown(this.game.audio);
    if (this.game.current !== this) return;
    this.state = 'play';
    this.onStart?.();
  }

  finish({ title, subtitle, rows, stars = 2 }) {
    if (this.state === 'results') return;
    this.state = 'results';
    this.resultsDelay = 1.6;
    this.game.roster.addStars(stars);
    this.game.audio.playMusic('results');
    this.game.audio.play('fanfare');
    this.game.ui.setTop('');
    this.game.ui.results({
      title,
      subtitle,
      rows,
      footer: `<span class="star-icon"></span> +${stars} stars for the island · <span class="blink">press jump to continue</span>`,
    });
    this.celebrate();
  }

  celebrate() {
    const colors = PLAYER_COLORS.map((c) => c.hex).concat(COLORS.gold);
    this.confettiOrigin = this.confettiOrigin || this.camera.position.clone().setZ(0);
    for (let i = 0; i < 4; i++) {
      this.later(i * 0.35, () => {
        const o = this.confettiOrigin.clone();
        o.x += (Math.random() - 0.5) * 16;
        o.y += 4;
        this.confetti.burst(o, 0, { count: 50, speed: 9, up: 4, colors, life: 2, gravity: -6, size: 0.22 });
      });
    }
  }

  /** Call from update(); returns true while the results screen is up. */
  updateResults(dt) {
    if (this.state !== 'results') return false;
    this.resultsDelay -= dt;
    if (this.resultsDelay <= 0 && this.game.input.anyAPressed(this.players.map((p) => p.deviceId))) {
      this.game.goHub(this.key);
    }
    return true;
  }
}
