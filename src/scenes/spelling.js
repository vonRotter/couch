import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { MiniGame } from '../core/minigame.js';
import { Character } from '../core/character.js';
import { COLORS, PLAYER_COLORS, toon, sharedGeo } from '../core/palette.js';
import { addLights, skyTexture, makeCloud, makeTree, makeFlower, seeded } from '../core/world.js';
import { moveBody, platformerControl } from '../core/physics2d.js';
import { LEVELS, glyphMaterial, fontsReady, speak, chooseLevels, shuffle } from '../core/edu.js';
import { WORDS, ALPHABET } from './edu-words.js';
import { esc } from '../core/ui.js';

// Bokstavballonger: letter balloons drift slowly across the sky in lanes, coming in from the
// sides, so every letter can be read long before anyone reaches it. Jump up to the balloon with
// the next letter your word needs. The lowest lane is above head height, so nothing pops by accident.
const HALF_W = 13;
const TOP = 14;
const ROUND_TIME = 120;
const MAX_BALLOONS = 16;
const LANES = [2.7, 4.9, 7.3, 9.9]; // reachable from the ground, low clouds, middle cloud, high clouds
// Each lane drifts one way at one speed, so balloons never overtake or cover each other.
const LANE_VX = [1.3, -1.1, 1.2, -1.0];
const GAP = 2.6; // minimum spacing between balloons in a lane
const BALLOON_COLORS = PLAYER_COLORS.map((c) => c.hex).concat(0xffffff);

const PHYS = {
  speed: 7, accel: 60, airAccel: 40, jump: 15, jump2: 12, doubleJump: true,
  gravity: 34, fallMul: 1.4, coyote: 0.14, buffer: 0.16, maxFall: -16,
};

export class SpellingScene extends MiniGame {
  constructor(game, opts) {
    super(game, opts);
    this.scene.background = skyTexture('#8fd8ff', '#fff4d6');
    addLights(this.scene, { size: 20, target: new THREE.Vector3(0, 6, 0), dir: new THREE.Vector3(-0.4, 0.8, 1) });
    this.solids = [];
    this.balloons = [];
    this.timeLeft = ROUND_TIME;
    this.spawnT = 0;
    this.ensureT = 0;
    this.teamWords = 0;
    this.buildWorld();

    this.ents = this.players.map((p, i) => {
      const ch = new Character(p.color, { hat: p.hat });
      this.scene.add(ch.group);
      const x = -9 + (i * 18) / Math.max(1, this.players.length - 1 || 1);
      return {
        p, ch, body: { x: this.players.length === 1 ? 0 : x, y: 0, w: 0.7, h: 1.1, vx: 0, vy: 0, grounded: true },
        facing: 1, words: 0, word: null, used: new Set(), doneT: 0,
      };
    });

    this.frame();
    game.audio.playMusic('hub');
    this.state = 'pick';
    fontsReady().then(() => chooseLevels(this, 'Bokstavballonger')).then(() => {
      if (this.game.current !== this) return;
      for (const e of this.ents) this.nextWord(e);
      this.intro('Bokstavballonger', 'Ballongene svever forbi. Hopp opp til ballongen med neste bokstav i ordet ditt!');
    });
  }

  frame() {
    const d = this.fitDistance(HALF_W * 2 + 2, TOP + 5);
    this.camera.position.set(0, TOP / 2 - 1.2, d);
    this.camera.lookAt(0, TOP / 2 - 1.2, 0);
    this.confettiOrigin = new THREE.Vector3(0, 8, 0);
  }

  resize(w, h) {
    super.resize(w, h);
    this.frame();
  }

  buildWorld() {
    const s = this.scene;
    this.solids.push({ x: -HALF_W - 1, y: -1, w: HALF_W * 2 + 2, h: 1 });
    this.solids.push({ x: -HALF_W - 2, y: -1, w: 1, h: 20 });
    this.solids.push({ x: HALF_W + 1, y: -1, w: 1, h: 20 });
    const ground = new THREE.Mesh(new RoundedBoxGeometry(HALF_W * 2 + 2, 1, 4, 2, 0.2), toon(COLORS.dirt));
    ground.position.set(0, -0.5, 0);
    ground.receiveShadow = true;
    const grass = new THREE.Mesh(new RoundedBoxGeometry(HALF_W * 2 + 2.2, 0.3, 4.2, 2, 0.12), toon(COLORS.grass));
    grass.position.set(0, -0.08, 0);
    grass.receiveShadow = true;
    s.add(ground, grass);

    const cloudPlat = (x0, x1, top) => {
      this.solids.push({ x: x0, y: top - 0.4, w: x1 - x0, h: 0.4, oneWay: true });
      for (let x = x0; x <= x1; x += 0.5) {
        const puff = new THREE.Mesh(sharedGeo('cpuff', () => new THREE.SphereGeometry(0.5, 14, 10)), toon(COLORS.cloud));
        puff.position.set(x, top - 0.3, (Math.round(x * 2) % 2) * 0.3 - 0.15);
        puff.scale.set(1, 0.6, 1.4);
        puff.castShadow = true;
        s.add(puff);
      }
    };
    cloudPlat(-11, -6, 3.2);
    cloudPlat(6, 11, 3.2);
    cloudPlat(-3, 3, 5.8);
    cloudPlat(-10, -5.5, 8.4);
    cloudPlat(5.5, 10, 8.4);

    const rand = seeded(41);
    for (let i = 0; i < 9; i++) {
      const t = makeTree(rand, 1.1 + rand() * 0.6);
      t.position.set(-16 + i * 4 + rand(), 0, -4 - rand() * 3);
      s.add(t);
    }
    for (let i = 0; i < 30; i++) {
      const f = makeFlower(rand);
      f.position.set(-HALF_W + rand() * HALF_W * 2, 0.05, 1 + rand() * 0.8);
      s.add(f);
    }
    for (let i = 0; i < 7; i++) {
      const c = makeCloud(rand, 1.5 + rand());
      c.position.set(-30 + i * 10, 14 + rand() * 5, -12);
      s.add(c);
    }
    // Giant alphabet blocks for decoration.
    ['A', 'B', 'C', 'Æ', 'Ø', 'Å'].forEach((ch, i) => {
      const box = new THREE.Mesh(sharedGeo('abcBlock', () => new RoundedBoxGeometry(1.4, 1.4, 1.4, 2, 0.15)), toon(BALLOON_COLORS[i]));
      const x = i < 3 ? -14.5 + (i % 3) * 0.2 : 14.5 - (i % 3) * 0.2;
      box.position.set(x, 0.7 + (i % 3) * 1.4, -1.6);
      box.rotation.y = (i % 2 ? 0.2 : -0.2);
      const face = new THREE.Mesh(sharedGeo('abcFace', () => new THREE.PlaneGeometry(1.2, 1.2)), glyphMaterial(ch));
      face.position.z = 0.71;
      box.add(face);
      box.castShadow = true;
      s.add(box);
    });
  }

  // ---------- words ----------

  levelKey(e) {
    return LEVELS[e.p.eduLevel ?? 0].key;
  }

  nextWord(e) {
    const lv = this.levelKey(e);
    let pool = WORDS[lv].filter(([w]) => !e.used.has(w));
    if (!pool.length) { e.used.clear(); pool = WORDS[lv]; }
    const [word, clue] = pool[Math.floor(Math.random() * pool.length)];
    e.used.add(word);
    const letters = word.split('');
    let hidden;
    if (lv === 'easy') hidden = [Math.floor(Math.random() * letters.length)];
    else if (lv === 'medium') hidden = shuffle(letters.map((_, i) => i)).slice(0, 2);
    else hidden = letters.map((_, i) => i).slice(1);
    e.word = { word, clue, letters, open: new Set(hidden) };
    e.doneT = 0;
  }

  needed(e) {
    if (!e.word || e.doneT > 0) return null;
    const i = [...e.word.open].sort((a, b) => a - b)[0];
    return i === undefined ? null : e.word.letters[i];
  }

  fill(e) {
    const i = [...e.word.open].sort((a, b) => a - b)[0];
    e.word.open.delete(i);
    if (e.word.open.size === 0) {
      e.words++;
      this.teamWords++;
      e.doneT = 1.6;
      this.game.audio.play('star');
      speak(e.word.word);
      this.confetti.burst(new THREE.Vector3(e.body.x, e.body.y + 1.5, 0.5), 0, { count: 30, speed: 6, colors: [e.p.color, COLORS.gold, COLORS.white] });
    }
  }

  // ---------- balloons ----------

  spawnBalloon(letter, lane = null) {
    const g = new THREE.Group();
    const color = BALLOON_COLORS[Math.floor(Math.random() * BALLOON_COLORS.length)];
    const ball = new THREE.Mesh(sharedGeo('lBalloon', () => new THREE.SphereGeometry(0.62, 18, 14)), toon(color));
    ball.scale.y = 1.15;
    ball.castShadow = true;
    const knot = new THREE.Mesh(sharedGeo('lKnot', () => new THREE.ConeGeometry(0.1, 0.14, 6)), toon(color));
    knot.position.y = -0.75;
    const string = new THREE.Mesh(sharedGeo('lString', () => new THREE.CylinderGeometry(0.012, 0.012, 0.9, 4)), toon(COLORS.ink));
    string.position.y = -1.25;
    const face = new THREE.Mesh(sharedGeo('lFace', () => new THREE.PlaneGeometry(1.0, 1.0)), glyphMaterial(letter));
    face.position.z = 0.66;
    g.add(ball, knot, string, face);
    this.scene.add(g);
    // Enter from the lane's upwind edge, only where there is room.
    const free = (li) => !this.balloons.some((o) => o.lane === li && Math.abs(o.x - this.entryX(li)) < GAP);
    const order = lane === null ? shuffle([0, 1, 2, 3]) : [lane, ...[0, 1, 2, 3].filter((l) => l !== lane)];
    const li = order.find(free);
    if (li === undefined) { this.scene.remove(g); return null; }
    const b = {
      letter, mesh: g, lane: li,
      x: this.entryX(li), y: LANES[li], vx: LANE_VX[li],
      phase: Math.random() * 6, bumpCd: new Map(), bumpY: 0,
    };
    this.balloons.push(b);
    return b;
  }

  entryX(lane) {
    return -Math.sign(LANE_VX[lane]) * (HALF_W + 1);
  }

  updateBalloons(dt) {
    const needs = this.ents.map((e) => this.needed(e)).filter(Boolean);
    this.spawnT -= dt;
    if (this.spawnT <= 0 && this.balloons.length < MAX_BALLOONS) {
      this.spawnT = 0.9;
      const letter = needs.length && Math.random() < 0.55 ? needs[Math.floor(Math.random() * needs.length)] : ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
      this.spawnBalloon(letter);
    }
    // Make sure every player's next letter is always somewhere reachable.
    this.ensureT -= dt;
    if (this.ensureT <= 0) {
      this.ensureT = 0.5;
      for (const e of this.ents) {
        const need = this.needed(e);
        if (!need) continue;
        // Count only balloons still on their way across, in a lane this player can reach.
        const has = this.balloons.some((b) => b.letter === need && b.lane <= 2 && Math.abs(b.x) < HALF_W - 1);
        if (!has) this.spawnBalloon(need, Math.random() < 0.6 ? 0 : 1);
      }
    }

    for (const b of this.balloons) {
      b.x += b.vx * dt;
      b.bumpY *= Math.max(0, 1 - 4 * dt);
      b.y = LANES[b.lane] + Math.sin(this.time * 1.6 + b.phase) * 0.22 + b.bumpY;
      for (const [k, v] of b.bumpCd) b.bumpCd.set(k, v - dt);

      if (this.state === 'play') {
        for (const e of this.ents) {
          const dx = b.x - e.body.x, dy = b.y - (e.body.y + 0.65);
          if (Math.hypot(dx, dy) > 1.15) continue;
          if (this.needed(e) === b.letter) {
            b.popped = true;
            this.fill(e);
            this.game.audio.play('pop');
            this.game.audio.play('coin');
            this.confetti.burst(new THREE.Vector3(b.x, b.y, 0.5), 0, { count: 16, speed: 5, colors: [e.p.color, COLORS.white] });
            e.ch.squash(1.3);
            break;
          } else if ((b.bumpCd.get(e) ?? 0) <= 0) {
            // Wrong letter: a little bounce, and it keeps drifting.
            b.bumpCd.set(e, 0.6);
            b.bumpY = dy >= 0 ? 0.6 : -0.6;
            this.game.audio.play('bump');
          }
        }
      }
      b.mesh.position.set(b.x, b.y, 0.9); // in front of the cloud platforms
      b.mesh.rotation.z = Math.sin(this.time * 2 + b.phase) * 0.08 - b.vx * 0.05;
      if (Math.abs(b.x) > HALF_W + 1.5) b.popped = true; // drifted out the other side
      if (b.popped) this.scene.remove(b.mesh);
    }
    this.balloons = this.balloons.filter((b) => !b.popped);
  }

  updatePlayers(dt) {
    for (const e of this.ents) {
      const inp = this.input(e.p) || { x: 0, y: 0, a: false, aPressed: false };
      const b = e.body;
      const ctrl = this.state === 'play' ? inp : { x: 0, y: 0, a: false, aPressed: false };
      const j = platformerControl(b, ctrl, dt, PHYS);
      if (j) { e.ch.squash(1.3); this.game.audio.play(j === 2 ? 'doubleJump' : 'jump'); }
      if (Math.abs(ctrl.x) > 0.2) e.facing = Math.sign(ctrl.x);
      moveBody(b, dt, this.solids);
      if (b.justLanded) e.ch.squash(0.75);
      if (e.doneT > 0) {
        e.doneT -= dt;
        if (e.doneT <= 0) this.nextWord(e);
      }
      e.ch.faceSide(e.facing);
      e.ch.group.position.set(b.x, b.y, 0);
      e.ch.update(dt, { moving: Math.min(1, Math.abs(b.vx) / PHYS.speed), grounded: b.grounded, vy: b.vy });
    }
  }

  renderCards() {
    const html = this.ents.map((e) => {
      if (!e.word) return '';
      const next = [...e.word.open].sort((a, b) => a - b)[0];
      const slots = e.word.letters.map((ch, i) => {
        const open = e.word.open.has(i);
        return `<span class="slot ${open ? 'open' : ''} ${i === next ? 'next' : ''}">${open ? '' : ch}</span>`;
      }).join('');
      return `<div class="edu-card ${e.doneT > 0 ? 'win' : ''}" style="--c:${e.p.css}">
        <div class="edu-card-head">${esc(e.p.name)} · ${e.words} ord</div>
        <div class="edu-word">${slots}</div>
        <div class="edu-clue">${esc(e.word.clue)}</div></div>`;
    }).join('');
    if (html !== this.cardCache) {
      this.game.ui.barEl.innerHTML = html;
      this.cardCache = html;
      this.game.ui.barCache = '';
    }
  }

  end() {
    const ranked = [...this.ents].sort((a, b) => b.words - a.words);
    for (const b of this.balloons) this.scene.remove(b.mesh);
    this.balloons = [];
    this.game.ui.barEl.innerHTML = '';
    this.finish({
      title: 'Så flinke dere er!',
      subtitle: `Dere stavet ${this.teamWords} ord til sammen`,
      rows: ranked.map((e, i) => ({
        css: e.p.css, name: e.p.name, value: `${e.words} ord`,
        detail: LEVELS[e.p.eduLevel ?? 0].name, crown: i === 0 && e.words > 0,
      })),
      stars: 3,
      action: 'trykk hopp for å fortsette',
    });
  }

  update(dt) {
    if (this.state === 'pick') {
      this.pickLevels?.();
      for (const e of this.ents) { e.ch.group.position.set(e.body.x, e.body.y, 0); e.ch.update(dt, {}); }
      return;
    }
    this.updatePlayers(dt);
    if (this.updateResults(dt)) return;
    this.updateBalloons(dt);
    if (this.state === 'play') {
      this.timeLeft -= dt;
      if (this.timeLeft <= 0) { this.timeLeft = 0; this.end(); return; }
    }
    if (this.state !== 'intro') {
      this.game.ui.setTop(`<div class="pill"><span class="big-num">${Math.ceil(this.timeLeft)}</span></div><div class="pill hud-title">Bokstavballonger</div>`);
    }
    this.renderCards();
  }
}
