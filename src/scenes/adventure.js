import * as THREE from 'three';
import { MiniGame } from '../core/minigame.js';
import { t } from '../core/i18n.js';
import { addLights } from '../core/world.js';
import { SONGS } from '../core/audio.js';
import './adventure/strings.js';
import { AdventureEngine } from './adventure/engine.js';
import { ROOMS, START_ROOM, intro } from './adventure/rooms.js';

// The Secret of Pudding Island: a Monkey Island style point-and-click adventure.
// Pip, a small bean with a wooden spoon and a lot of confidence, wants to be a pirate.
//
// Point with the stick (any player) or the mouse. [A] / left click does the smart action on what
// is under the pointer (talk to people, pick up loose things, use objects, walk on empty ground),
// [B] / right click looks, [C] opens the inventory: pick an item, then [A] on something uses it there.
//
// The engine lives in adventure/engine.js, rooms and puzzles in adventure/rooms.js, dialog trees in
// adventure/dialog.js, Tickle Fencing in adventure/duel.js, items in adventure/items.js and all
// text in adventure/strings.js. Progress: game.roster.progress.adventure (per solo profile).

// A gentle seafaring tune (registered once next to the built-in songs).

export class AdventureScene extends MiniGame {
  constructor(game, opts = {}) {
    super(game, opts);
    this.lights = addLights(this.scene, { size: 14, target: new THREE.Vector3(-1, 0, 0), dir: new THREE.Vector3(0.45, 1, 0.9) });
    this.engine = new AdventureEngine(this, { rooms: ROOMS, start: START_ROOM, intro });
    // No countdown: the title card (Continue / New game) is the intro.
    this.state = 'play';
    this.playStart = 0;
    game.audio.playMusic('adventure');
  }

  update(dt) {
    if (this.updateResults(dt)) return;
    this.engine.update(dt);
  }

  resize(w, h) {
    super.resize(w, h);
    this.engine?.frame();
  }

  onLanguage() {
    this.engine.onLanguage();
  }

  /** End of scene 1: "To be continued..." then the results card and back to the island. */
  completeScene() {
    const e = this.engine;
    const first = !e.save.starsGiven;
    e.save.starsGiven = true;
    e.save.done = true;
    e.persist();
    e.ui.hideTbc();
    this.finish({
      title: t('adv.tbc'),
      subtitle: t('adv.tbcSub'),
      rows: this.players.map((p, i) => ({ css: p.css, name: i === 0 ? `${p.name} (Pip)` : p.name, value: t('adv.resValue'), detail: t('adv.resDetail'), crown: i === 0 })),
      stars: first ? 3 : 1,
    });
  }

  dispose() {
    this.engine.dispose();
    super.dispose();
  }
}
