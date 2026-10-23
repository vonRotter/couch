import * as THREE from 'three';
import { MiniGame } from '../core/minigame.js';
import { t } from '../core/i18n.js';
import { addLights } from '../core/world.js';
import { SONGS } from '../core/audio.js';
import './adventure/strings.js';
import './adventure/strings2.js';
import { AdventureEngine } from './adventure/engine.js';
import { ROOMS, START_ROOM, intro } from './adventure/rooms.js';
import { startScene2 } from './adventure/scene2.js';

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
// Scene 2 ("All Hands on Deck": the ship, the town square and Granny's Pudding Parlor) lives in
// adventure/scene2.js with its text in adventure/strings2.js; Continue after scene 1 starts it.

// A gentle seafaring tune (registered once next to the built-in songs).

export class AdventureScene extends MiniGame {
  constructor(game, opts = {}) {
    super(game, opts);
    this.lights = addLights(this.scene, { size: 14, target: new THREE.Vector3(-1, 0, 0), dir: new THREE.Vector3(0.45, 1, 0.9) });
    this.engine = new AdventureEngine(this, { rooms: ROOMS, start: START_ROOM, intro, scenes: { 2: { start: startScene2 } } });
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

  /** End of a scene: "To be continued..." then the results card and back to the island.
   *  3 stars the first time each scene is finished, 1 on replays. */
  completeScene(n = 1) {
    const e = this.engine;
    const two = n >= 2;
    const starKey = two ? 'starsGiven2' : 'starsGiven';
    const first = !e.save[starKey];
    e.save[starKey] = true;
    if (two) {
      e.save.done2 = true;
      // Pip is far out at sea on the ship: next time, start on deck at the wheel.
      e.save.room = 'deck';
      e.save.pos = [-1.25, -0.6];
      e.writeSave();
    } else {
      e.save.done = true;
      e.persist();
    }
    e.ui.hideTbc();
    this.finish({
      title: t('adv.tbc'),
      subtitle: t(two ? 'adv.tbcSub2' : 'adv.tbcSub'),
      rows: this.players.map((p, i) => ({
        css: p.css, name: i === 0 ? `${p.name} (Pip)` : p.name, value: t(two ? 'adv.resValue2' : 'adv.resValue'), detail: t(two ? 'adv.resDetail2' : 'adv.resDetail'), crown: i === 0,
      })),
      stars: first ? 3 : 1,
    });
  }

  dispose() {
    this.engine.dispose();
    super.dispose();
  }
}
