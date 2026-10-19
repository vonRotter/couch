import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { MiniGame } from '../core/minigame.js';
import { Character } from '../core/character.js';
import { COLORS, toon, sharedGeo } from '../core/palette.js';
import { addLights, skyTexture, makeTree, makeFlower, makeCloud, seeded } from '../core/world.js';
import { LEVELS, glyphMaterial, fontsReady, speak, chooseLevels, shuffle, pickByAge, nextSeq } from '../core/edu.js';
import { esc } from '../core/ui.js';

// Mattejakt: everyone has their own sum; run to the coin with the answer.
const HW = 13, HD = 8;
const PR = 0.42;
const SPEED = 6.2;
const ROUND_TIME = 120;
const COIN_COLORS = [0xffe47a, 0x9ff0c8, 0x8fd8ff, 0xff9fd0, 0xc9a8ff, 0xffc08a];

const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

/** A problem for the given level: { text, answer, max }. */
export function makeProblem(level) {
  if (level === 'easy') {
    const a = rnd(1, 9), b = rnd(0, 10 - a);
    return { text: `${a} + ${b}`, answer: a + b, max: 10 };
  }
  if (level === 'medium') {
    if (Math.random() < 0.5) {
      const a = rnd(2, 15), b = rnd(1, 20 - a);
      return { text: `${a} + ${b}`, answer: a + b, max: 20 };
    }
    const a = rnd(5, 20), b = rnd(1, a);
    return { text: `${a} − ${b}`, answer: a - b, max: 20 };
  }
  const r = Math.random();
  if (r < 0.6) {
    const a = rnd(2, 10), b = rnd(2, 10);
    return { text: `${a} · ${b}`, answer: a * b, max: 100 };
  }
  if (r < 0.8) {
    const a = rnd(10, 60), b = rnd(5, 100 - a);
    return { text: `${a} + ${b}`, answer: a + b, max: 100 };
  }
  const a = rnd(20, 100), b = rnd(5, a);
  return { text: `${a} − ${b}`, answer: a - b, max: 100 };
}

export class MathScene extends MiniGame {
  constructor(game, opts) {
    super(game, opts);
    this.camera.fov = 38;
    this.scene.background = skyTexture('#9fe0ff', '#fff6dc');
    addLights(this.scene, { size: 20, dir: new THREE.Vector3(-0.4, 1, 0.5) });
    this.timeLeft = ROUND_TIME;
    this.coins = [];
    this.teamScore = 0;
    this.buildWorld();

    this.ents = this.players.map((p, i) => {
      const ch = new Character(p.color, { hat: p.hat });
      this.scene.add(ch.group);
      const a = (i / this.players.length) * Math.PI * 2;
      const tag = this.game.ui.label('label edu-tag');
      tag.style.color = p.css;
      return {
        p, ch, tag, tagPos: new THREE.Vector3(),
        x: Math.cos(a) * 2.5, z: Math.sin(a) * 1.5, vx: 0, vz: 0, dirX: 0, dirZ: 1,
        problem: null, score: 0, wrongCd: 0, doneT: 0, lastText: '',
      };
    });

    this.frame();
    game.audio.playMusic('hub');
    this.state = 'pick';
    fontsReady().then(() => chooseLevels(this, 'Mattejakt')).then(() => {
      if (this.game.current !== this) return;
      // Coins first, then problems picked from answers already lying on the field.
      const n = 10 + this.players.length * 2;
      for (let i = 0; i < n; i++) this.spawnCoin();
      for (const e of shuffle(this.ents)) this.newProblem(e);
      this.ensureAnswers();
      this.intro('Mattejakt', 'Løp til mynten med riktig svar!');
    });
  }

  levelKey(e) {
    return LEVELS[e.p.eduLevel ?? 0].key;
  }

  frame() {
    const tilt = THREE.MathUtils.degToRad(56);
    const d = this.fitDistance(HW * 2 + 3, HD * 2 * Math.sin(tilt) + 7);
    this.camera.position.set(0, Math.sin(tilt) * d, Math.cos(tilt) * d + 0.8);
    this.camera.lookAt(0, 0, 0.8);
    this.confettiOrigin = new THREE.Vector3(0, 3, 0);
  }

  resize(w, h) {
    super.resize(w, h);
    this.frame();
  }

  buildWorld() {
    const s = this.scene;
    const field = new THREE.Mesh(new RoundedBoxGeometry(HW * 2 + 1, 1, HD * 2 + 1, 3, 0.4), toon(COLORS.grass));
    field.position.y = -0.5;
    field.receiveShadow = true;
    s.add(field);
    const fenceCols = [COLORS.candyPink, COLORS.candyBlue, COLORS.candyYellow, COLORS.candyMint];
    const fence = (x, z, w, d, c) => {
      const m = new THREE.Mesh(new RoundedBoxGeometry(w, 0.6, d, 2, 0.22), toon(c));
      m.position.set(x, 0.25, z);
      m.castShadow = m.receiveShadow = true;
      s.add(m);
    };
    fence(0, -HD - 0.4, HW * 2 + 1.6, 0.7, fenceCols[0]);
    fence(0, HD + 0.4, HW * 2 + 1.6, 0.7, fenceCols[1]);
    fence(-HW - 0.4, 0, 0.7, HD * 2, fenceCols[2]);
    fence(HW + 0.4, 0, 0.7, HD * 2, fenceCols[3]);
    const ground = new THREE.Mesh(new THREE.CircleGeometry(80, 40), toon(COLORS.grassDark));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -1;
    s.add(ground);
    const rand = seeded(19);
    for (let i = 0; i < 22; i++) {
      const a = rand() * Math.PI * 2;
      const x = Math.cos(a) * (20 + rand() * 8), z = Math.sin(a) * (13 + rand() * 6) - 4;
      if (z > 5) continue;
      const t = makeTree(rand, 1 + rand() * 0.5);
      t.position.set(x, -1, z);
      s.add(t);
    }
    for (let i = 0; i < 50; i++) {
      const f = makeFlower(rand);
      f.position.set((rand() - 0.5) * HW * 2, 0, (rand() - 0.5) * HD * 2);
      s.add(f);
    }
    for (let i = 0; i < 6; i++) {
      const c = makeCloud(rand, 2 + rand());
      c.position.set(-40 + i * 16, 10 + rand() * 6, -30);
      s.add(c);
    }
    // Number blocks for decoration.
    ['1', '+', '2', '=', '3'].forEach((ch, i) => {
      const box = new THREE.Mesh(sharedGeo('numBlock', () => new RoundedBoxGeometry(1.5, 1.5, 1.5, 2, 0.15)), toon(COIN_COLORS[i]));
      box.position.set(-6 + i * 3, 0, -HD - 2.6);
      box.position.y = 0.75;
      const face = new THREE.Mesh(sharedGeo('numFace', () => new THREE.PlaneGeometry(1.3, 1.3)), glyphMaterial(ch));
      face.position.z = 0.76;
      box.add(face);
      box.castShadow = true;
      s.add(box);
    });
  }

  // ---------- coins ----------

  freeSpot() {
    let best = null;
    for (let tries = 0; tries < 30; tries++) {
      const x = (Math.random() - 0.5) * (HW * 2 - 2.5), z = (Math.random() - 0.5) * (HD * 2 - 2.5);
      const ok = this.coins.every((c) => Math.hypot(c.x - x, c.z - z) > 2.1) && this.ents.every((e) => Math.hypot(e.x - x, e.z - z) > 1.8);
      best = { x, z };
      if (ok) break;
    }
    return best;
  }

  /** Answers players need right now that aren't on the field. */
  missingAnswers() {
    return this.ents.filter((e) => e.problem && e.doneT <= 0 && !this.coins.some((c) => c.value === e.problem.answer)).map((e) => e.problem.answer);
  }

  /**
   * The next problem for e. Its answer is drawn from coins already on the field (any age),
   * keeping makeProblem's mix of sums. Before this, the answer coin was spawned fresh for every
   * new problem, so the newest coin was nearly always the right one.
   */
  newProblem(e) {
    const lv = this.levelKey(e);
    const taken = new Set(this.ents.filter((o) => o !== e && o.problem && o.doneT <= 0).map((o) => o.problem.answer));
    const last = e.problem?.text;
    // Problems the level can ask, by answer; then a free coin with one of those answers at a random age.
    const byAnswer = new Map();
    for (let i = 0; i < 400; i++) {
      const p = makeProblem(lv);
      if (p.text === last || taken.has(p.answer)) continue;
      if (!byAnswer.has(p.answer)) byAnswer.set(p.answer, []);
      byAnswer.get(p.answer).push(p);
    }
    const coin = pickByAge(this.coins, this.coins.filter((c) => byAnswer.has(c.value)));
    if (coin) { const list = byAnswer.get(coin.value); e.problem = list[Math.floor(Math.random() * list.length)]; }
    else e.problem = makeProblem(lv);
  }

  pickValue() {
    const missing = this.missingAnswers();
    if (missing.length) return missing[0];
    const e = this.ents[Math.floor(Math.random() * this.ents.length)];
    if (!e.problem) return makeProblem(this.levelKey(e)).answer;
    // Near-misses make good practice.
    const near = e.problem.answer + rnd(-3, 3);
    return Math.random() < 0.6 ? THREE.MathUtils.clamp(near, 0, e.problem.max) : rnd(0, e.problem.max);
  }

  spawnCoin(value = this.pickValue()) {
    const spot = this.freeSpot();
    const g = new THREE.Group();
    const color = COIN_COLORS[Math.floor(Math.random() * COIN_COLORS.length)];
    const coin = new THREE.Mesh(sharedGeo('mCoin', () => new THREE.CylinderGeometry(0.85, 0.85, 0.3, 28)), toon(color));
    coin.castShadow = true;
    const rim = new THREE.Mesh(sharedGeo('mRim', () => new THREE.TorusGeometry(0.85, 0.08, 8, 28)), toon(COLORS.white));
    rim.rotation.x = Math.PI / 2;
    const face = new THREE.Mesh(sharedGeo('mFace', () => new THREE.PlaneGeometry(1.5, 1.5)), glyphMaterial(String(value)));
    face.rotation.x = -Math.PI / 2;
    face.position.y = 0.17;
    g.add(coin, rim, face);
    g.rotation.x = 0.45;
    g.position.set(spot.x, 0.5, spot.z);
    g.scale.setScalar(0.01);
    this.scene.add(g);
    const c = { value, mesh: g, x: spot.x, z: spot.z, hop: 0, phase: Math.random() * 6, seq: nextSeq() };
    this.coins.push(c);
    return c;
  }

  removeCoin(c) {
    this.scene.remove(c.mesh);
    this.coins = this.coins.filter((x) => x !== c);
  }

  /** Rarely needed now (problems come from the field): the answer arrives with two fresh decoys in random order. */
  ensureAnswers() {
    for (const ans of this.missingAnswers()) {
      // Swap coins nobody needs, preferring the ones far from everyone.
      const spare = this.coins.filter((c) => !this.ents.some((e) => e.problem?.answer === c.value));
      const far = (c) => Math.min(...this.ents.map((e) => Math.hypot(e.x - c.x, e.z - c.z))) * (0.6 + Math.random() * 0.8);
      spare.sort((a, b) => far(b) - far(a));
      const batch = spare.slice(0, 3);
      for (const c of batch) this.removeCoin(c);
      const decoys = batch.slice(1).map(() => {
        const e = this.ents[Math.floor(Math.random() * this.ents.length)];
        let v;
        do v = THREE.MathUtils.clamp(ans + rnd(-4, 4), 0, e.problem?.max ?? 10); while (v === ans && ans > 0);
        return v === ans ? ans + 1 : v;
      });
      for (const v of shuffle([ans, ...decoys])) this.spawnCoin(v);
    }
  }

  // ---------- players ----------

  updatePlayers(dt) {
    const playing = this.state === 'play';
    for (const e of this.ents) {
      const inp = this.input(e.p) || { x: 0, y: 0 };
      e.wrongCd -= dt;
      const ix = playing ? inp.x : 0, iz = playing ? -inp.y : 0;
      if (Math.hypot(ix, iz) > 0.2) { e.dirX = ix; e.dirZ = iz; }
      const acc = 45 * dt;
      e.vx += THREE.MathUtils.clamp(ix * SPEED - e.vx, -acc, acc);
      e.vz += THREE.MathUtils.clamp(iz * SPEED - e.vz, -acc, acc);
      e.x = THREE.MathUtils.clamp(e.x + e.vx * dt, -HW + PR, HW - PR);
      e.z = THREE.MathUtils.clamp(e.z + e.vz * dt, -HD + PR, HD - PR);

      if (e.doneT > 0) {
        e.doneT -= dt;
        if (e.doneT <= 0) {
          this.newProblem(e);
          this.ensureAnswers();
        }
      } else if (playing && e.problem) {
        for (const c of this.coins) {
          if (Math.hypot(e.x - c.x, e.z - c.z) > 1.05) continue;
          if (c.value === e.problem.answer) {
            e.score++;
            this.teamScore++;
            e.doneT = 1.1;
            this.game.audio.play('coin');
            this.game.audio.play('star');
            speak(String(c.value));
            this.confetti.burst(new THREE.Vector3(c.x, 1, c.z), 0, { count: 26, speed: 6, colors: [e.p.color, COLORS.gold, COLORS.white] });
            e.ch.squash(1.35);
            this.removeCoin(c);
            this.later(0.6, () => this.state === 'play' && this.spawnCoin());
            break;
          } else if (e.wrongCd <= 0) {
            // Not that one: the coin hops and nudges you away. No penalty.
            e.wrongCd = 0.7;
            c.hop = 1;
            const dx = e.x - c.x, dz = e.z - c.z, d = Math.hypot(dx, dz) || 1;
            e.vx = (dx / d) * 5;
            e.vz = (dz / d) * 5;
            this.game.audio.play('bump');
          }
        }
      }

      e.ch.face(e.dirX, e.dirZ);
      e.ch.group.position.set(e.x, 0, e.z);
      e.ch.update(dt, { moving: Math.min(1, Math.hypot(e.vx, e.vz) / SPEED), grounded: true });
      const text = !e.problem ? '' : e.doneT > 0 ? `${e.problem.text} = ${e.problem.answer} ✓` : `${e.problem.text} = ?`;
      if (text !== e.lastText) { e.tag.textContent = text; e.lastText = text; }
      e.tagPos.set(e.x, 2.1, e.z);
      this.game.ui.place(e.tag, e.tagPos, this.camera);
      e.tag.style.display = this.state === 'results' || !e.problem ? 'none' : '';
    }
    for (let i = 0; i < this.ents.length; i++) {
      for (let j = i + 1; j < this.ents.length; j++) {
        const a = this.ents[i], b = this.ents[j];
        const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
        if (d < PR * 2 && d > 1e-4) {
          const push = (PR * 2 - d) / 2;
          a.x -= (dx / d) * push; a.z -= (dz / d) * push;
          b.x += (dx / d) * push; b.z += (dz / d) * push;
        }
      }
    }
  }

  updateCoins(dt) {
    for (const c of this.coins) {
      c.hop = Math.max(0, c.hop - dt * 2.5);
      c.mesh.position.y = 0.5 + Math.sin(this.time * 2 + c.phase) * 0.08 + Math.sin(c.hop * Math.PI) * 0.9;
      c.mesh.scale.lerp(new THREE.Vector3(1, 1, 1), Math.min(1, dt * 6));
    }
  }

  renderCards() {
    const html = this.ents.map((e) => {
      if (!e.problem) return '';
      const done = e.doneT > 0;
      return `<div class="edu-card ${done ? 'win' : ''}" style="--c:${e.p.css}">
        <div class="edu-card-head">${esc(e.p.name)} · ${e.score} riktige</div>
        <div class="edu-word math">${esc(e.problem.text)} = ${done ? e.problem.answer : '?'}</div>
        <div class="edu-clue">${LEVELS[e.p.eduLevel ?? 0].name}</div></div>`;
    }).join('');
    if (html !== this.cardCache) {
      this.game.ui.barEl.innerHTML = html;
      this.cardCache = html;
      this.game.ui.barCache = '';
    }
  }

  end() {
    const ranked = [...this.ents].sort((a, b) => b.score - a.score);
    this.game.ui.barEl.innerHTML = '';
    this.finish({
      title: 'Supert regnet!',
      subtitle: `Dere fant ${this.teamScore} riktige svar til sammen`,
      rows: ranked.map((e, i) => ({
        css: e.p.css, name: e.p.name, value: `${e.score} riktige`,
        detail: LEVELS[e.p.eduLevel ?? 0].name, crown: i === 0 && e.score > 0,
      })),
      stars: 3,
      action: 'trykk hopp for å fortsette',
    });
  }

  update(dt) {
    if (this.state === 'pick') {
      this.pickLevels?.();
      for (const e of this.ents) { e.ch.group.position.set(e.x, 0, e.z); e.ch.update(dt, {}); }
      return;
    }
    this.updatePlayers(dt);
    if (this.updateResults(dt)) return;
    this.updateCoins(dt);
    if (this.state === 'play') {
      this.timeLeft -= dt;
      if (this.timeLeft <= 0) { this.timeLeft = 0; this.end(); return; }
    }
    if (this.state !== 'intro') {
      this.game.ui.setTop(`<div class="pill"><span class="big-num">${Math.ceil(this.timeLeft)}</span></div><div class="pill hud-title">Mattejakt</div>`);
    }
    this.renderCards();
  }
}
