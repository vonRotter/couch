import * as THREE from 'three';
import { Round, clock } from './common.js';
import { makeGrumble } from '../../core/critters.js';
import { COLORS, PLAYER_COLORS, toon, basic } from '../../core/palette.js';
import { t } from '../../core/i18n.js';

// Copy Dance: watch the teacher's moves, then repeat them with the stick.
const DIRS = ['up', 'right', 'down', 'left'];
const ARROW = { up: '↑', right: '→', down: '↓', left: '←' };
const LEVELS = [3, 4, 5, 6];

const DIR_COLOR = { up: 0xffc93c, right: 0x4cc9f0, down: 0x3ddc97, left: 0xff7eb6 };
const DIR_ROT = { up: 0, right: -Math.PI / 2, down: Math.PI, left: Math.PI / 2 };

function pose(target, dir, k = 1) {
  // Lean the dancer: left/right tilt, up stretches, down squats.
  if (dir === 'left') target.rotation.z = 0.45 * k;
  if (dir === 'right') target.rotation.z = -0.45 * k;
  if (dir === 'up') target.position.y = 0.5 * k;
  if (dir === 'down') target.scale.y = 1 - 0.35 * k;
}

/** The teacher's moves are big and obvious: a hop sideways, a jump, or a deep squat. */
function teacherPose(target, dir) {
  if (dir === 'left') { target.rotation.z = 0.5; target.position.x = -1.1; }
  if (dir === 'right') { target.rotation.z = -0.5; target.position.x = 1.1; }
  if (dir === 'up') target.position.y = 1.4;
  if (dir === 'down') target.scale.y = 0.5;
}

export class DanceRound extends Round {
  static key = 'dance';

  constructor(party) {
    super(party);
    this.build();
    this.level = -1;
    this.phase = 'idle';
    this.ents = this.players.map((p, i) => {
      const ch = this.bean(p);
      const n = this.players.length;
      const x = (i - (n - 1) / 2) * 2.1;
      ch.group.position.set(x, 0.4, 1.5);
      return { p, ch, x, step: 0, failed: false, points: 0, moves: 0, poseT: 0, tag: this.label('label party-num') };
    });
  }

  get title() { return t('dance.title'); }
  get hint() { return t('dance.hint'); }

  build() {
    const g = this.group;
    const floor = new THREE.Mesh(new THREE.BoxGeometry(18, 0.4, 7), toon(0x6b4fa8));
    floor.position.set(0, 0.2, 1);
    floor.receiveShadow = true;
    g.add(floor);
    this.tiles = [];
    for (let i = 0; i < 9; i++) {
      for (let j = 0; j < 3; j++) {
        const tile = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.05, 2.2), toon(PLAYER_COLORS[(i + j) % 6].hex));
        tile.position.set(-8 + i * 2, 0.42, -1.3 + j * 2.3);
        g.add(tile);
        this.tiles.push(tile);
      }
    }
    const back = new THREE.Mesh(new THREE.BoxGeometry(18, 7, 0.4), toon(0x3b2d6b));
    back.position.set(0, 3.5, -3.6);
    g.add(back);
    const stage = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.8, 2, 24), toon(COLORS.candyPink));
    stage.position.set(0, 1.2, -2.6);
    g.add(stage);
    this.teacher = new THREE.Group();
    this.teacherBody = makeGrumble(0xffc93c);
    this.teacherBody.scale.setScalar(1.8);
    this.teacher.add(this.teacherBody);
    this.teacher.position.set(0, 2.2, -2.6);
    g.add(this.teacher);
    // A big colored arrow above the teacher shows each move while it is danced.
    this.signs = {};
    for (const dir of Object.keys(DIR_COLOR)) {
      const sign = new THREE.Group();
      const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.45, 1.1, 0.2), basic(DIR_COLOR[dir]));
      shaft.position.y = -0.35;
      const head = new THREE.Mesh(new THREE.ConeGeometry(0.75, 0.9, 3), basic(DIR_COLOR[dir]));
      head.position.y = 0.6;
      const outline = new THREE.Mesh(new THREE.CircleGeometry(1.35, 32), basic(COLORS.white));
      outline.position.z = -0.12;
      sign.add(outline, shaft, head);
      sign.rotation.z = DIR_ROT[dir];
      sign.visible = false;
      // One on each side of the teacher, so it never hides behind the top bar or the teacher.
      const twin = sign.clone();
      sign.position.set(-3.6, 3.4, -2.4);
      twin.position.set(3.6, 3.4, -2.4);
      g.add(sign, twin);
      this.signs[dir] = [sign, twin];
    }
    this.signT = 0;
    // Spotlights (just cones of soft light).
    for (const x of [-6, 6]) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(1.8, 6, 20, 1, true), toon(0xfff3b0, { transparent: true, opacity: 0.18 }));
      cone.position.set(x, 3.4, 0);
      g.add(cone);
    }
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 40), toon(0x2b2340));
    ground.rotation.x = -Math.PI / 2;
    g.add(ground);
  }

  frame() {
    const d = this.party.fitDistance(Math.max(12, this.players.length * 2.1 + 4), 8);
    this.camera.position.set(0, 5.2, d + 1.5);
    this.camera.lookAt(0, 2, 0);
  }

  start() {
    this.nextLevel();
  }

  nextLevel() {
    this.level++;
    if (this.level >= LEVELS.length) { this.phase = 'over'; this.done = true; return; }
    const len = LEVELS[this.level];
    this.seq = Array.from({ length: len }, () => DIRS[Math.floor(Math.random() * 4)]);
    this.phase = 'show';
    this.showI = -1;
    this.phaseT = 0.6;
    for (const e of this.ents) { e.step = 0; e.failed = false; }
  }

  tone(dir) {
    const notes = { up: 'select', right: 'coin', down: 'land', left: 'bubble' };
    this.game.audio.play(notes[dir]);
  }

  update(dt, playing) {
    this.time += dt;
    // Relax every dancer back to neutral.
    const relax = (o) => {
      o.rotation.z *= Math.max(0, 1 - dt * 8);
      o.position.y += (0 - o.position.y) * Math.min(1, dt * 8);
      o.scale.y += (1 - o.scale.y) * Math.min(1, dt * 8);
    };
    relax(this.teacherBody);
    this.teacherBody.position.x *= Math.max(0, 1 - dt * 6);
    this.signT -= dt;
    for (const [dir, pair] of Object.entries(this.signs)) {
      for (const sign of pair) {
        sign.visible = this.signT > 0 && this.signDir === dir;
        sign.scale.setScalar(sign.visible ? 1 + Math.max(0, this.signT - 0.25) * 0.8 : 1);
      }
    }
    this.tiles.forEach((tile, i) => { tile.position.y = 0.42 + (Math.sin(this.time * 4 + i) > 0.7 ? 0.04 : 0); });
    for (const e of this.ents) {
      e.ch.pivot.rotation.z *= Math.max(0, 1 - dt * 8);
      e.ch.update(dt, {});
    }
    if (!playing) return;
    this.phaseT -= dt;
    const speed = Math.max(0.55, 0.9 - this.level * 0.1);

    if (this.phase === 'show' && this.phaseT <= 0) {
      this.showI++;
      if (this.showI < this.seq.length) {
        const dir = this.seq[this.showI];
        teacherPose(this.teacherBody, dir);
        this.signDir = dir;
        this.signT = speed * 0.85;
        this.tone(dir);
        this.phaseT = speed;
      } else {
        this.phase = 'copy';
        this.phaseT = this.seq.length * 1.0 + 3;
        this.game.audio.play('go');
      }
    } else if (this.phase === 'copy') {
      for (const e of this.ents) {
        if (e.failed || e.step >= this.seq.length) continue;
        const d = this.input(e.p);
        let dir = null;
        if (d.stepX) dir = d.stepX > 0 ? 'right' : 'left';
        else if (d.stepY) dir = d.stepY > 0 ? 'up' : 'down';
        if (!dir) continue;
        // Beans lean left/right and stretch or squat via the squash spring.
        if (dir === 'left' || dir === 'right') pose(e.ch.pivot, dir);
        else e.ch.squash(dir === 'up' ? 1.45 : 0.6);
        if (dir === this.seq[e.step]) {
          e.step++;
          this.tone(dir);
          if (e.step === this.seq.length) {
            e.points += this.seq.length;
            e.moves += this.seq.length;
            this.party.confetti.burst(e.ch.group.position.clone().setY(2.2), 0, { count: 18, speed: 5, colors: [e.p.color, COLORS.gold] });
            this.game.audio.play('rescue');
          }
        } else {
          e.failed = true;
          e.moves += e.step;
          this.game.audio.play('dizzy');
          this.party.puffs.burst(e.ch.group.position.clone().setY(1.6), 0xffffff, { count: 8, size: 0.3, life: 0.5 });
        }
      }
      const allDone = this.ents.every((e) => e.failed || e.step >= this.seq.length);
      if (allDone || this.phaseT <= 0) {
        for (const e of this.ents) if (!e.failed && e.step < this.seq.length) { e.failed = true; e.moves += e.step; }
        this.phase = 'pause';
        this.phaseT = 1.2;
      }
    } else if (this.phase === 'pause' && this.phaseT <= 0) {
      this.nextLevel();
    }

    for (const e of this.ents) {
      e.ch.spin = e.failed ? this.time * 8 : 0;
      let text = '';
      if (this.phase === 'copy' || this.phase === 'pause') {
        text = e.step >= this.seq.length ? '✓' : e.failed ? '✗' : '●'.repeat(e.step) + '○'.repeat(this.seq.length - e.step);
      }
      e.tag.style.display = text ? '' : 'none';
      if (text) this.setLabel(e.tag, text, e.ch.group.position.clone().setY(2.4), e.p.css);
    }
  }

  hud() {
    if (!this.seq) return '';
    const arrows = this.seq.map((d, i) => {
      const lit = this.phase === 'show' && i === this.showI;
      const hidden = this.phase === 'show' && i > this.showI;
      return `<span class="${lit ? 'on' : ''}">${hidden ? '·' : ARROW[d]}</span>`;
    }).join(' ');
    const what = this.phase === 'show' ? t('dance.watch') : this.phase === 'copy' ? t('dance.go') : '';
    const showArrows = this.phase === 'show';
    return `<div class="pill">${t('dance.level', { n: this.level + 1, total: LEVELS.length })}</div>${what ? `<div class="pill"><b>${what}</b></div>` : ''}${showArrows ? `<div class="pill party-arrows">${arrows}</div>` : ''}${this.phase === 'copy' ? clock(this.phaseT) : ''}`;
  }

  score(p) {
    return this.ents.find((x) => x.p === p).points;
  }

  detail(p) {
    return t('dance.n', { n: this.ents.find((x) => x.p === p).moves });
  }
}
