import * as THREE from 'three';
import { Round, clock } from './common.js';
import { COLORS, PLAYER_COLORS, toon, basic, sharedGeo } from '../../core/palette.js';
import { glyphMaterial } from '../../core/edu.js';
import { t, addStrings } from '../../core/i18n.js';

addStrings({
  en: {
    'drums.title': 'Rhythm Drums',
    'drums.hint': 'Notes slide down your lane. Tap A for A notes and B for B notes just as they reach the line. Hit both for double notes! Keep a streak for bonus points.',
    'drums.perfect': 'Perfect!', 'drums.good': 'Good', 'drums.miss': 'Miss',
    'drums.streak': '{n} in a row', 'drums.n': '{n} hits · streak {s}',
  },
  no: {
    'drums.title': 'Rytmetrommer',
    'drums.hint': 'Notene glir ned i banen din. Trykk A for A-noter og B for B-noter akkurat når de når streken. Trykk begge for doble noter! Hold rekka for bonuspoeng.',
    'drums.perfect': 'Perfekt!', 'drums.good': 'Bra', 'drums.miss': 'Bom',
    'drums.streak': '{n} på rad', 'drums.n': '{n} treff · rekke {s}',
  },
});

// Rhythm Drums: every player gets the same chart in their own lane, scrolling down to a hit line.
const BPM = 120;
const STEP = 60 / BPM / 2; // one eighth note
const LEAD = 4 * (60 / BPM); // one bar of count-in before the first note
const SCROLL = 4.2; // world units per second
const HIT_Y = 2.7;
const TOP_Y = 11.2;
const PERFECT = 0.06;
const GOOD = 0.15;
const FUMBLE = 0.15; // a stray press locks that drum for a moment (stops pure mashing)
const A_CSS = '#ffc93c';
const B_CSS = '#4cc9f0';
const COL_HEX = [0xffc93c, 0x4cc9f0];

// Bar patterns in eighth notes: a = A note, b = B note, x = both, . = rest. Later sections get busier.
const SECTIONS = [
  { bars: 4, pats: ['a.a.a.a.', 'a.a.a.b.', 'a.b.a.b.', 'a...a.b.'] },
  { bars: 5, pats: ['a.b.aab.', 'a.aab.b.', 'aab.a.b.', 'b.a.b.aa', 'a.b.x...'] },
  { bars: 5, pats: ['x.abx.ab', 'aabbaab.', 'x.a.x.bb', 'abab.ax.', 'a.bba.x.'] },
  { bars: 4, pats: ['x.abx.aa', 'abx.abx.', 'aabbx.x.', 'x.x.abab', 'abababx.'] },
];

function makeChart() {
  const notes = [];
  let bar = 0;
  for (const sec of SECTIONS) {
    for (let i = 0; i < sec.bars; i++, bar++) {
      const pat = sec.pats[Math.floor(Math.random() * sec.pats.length)];
      for (let s = 0; s < 8; s++) {
        const c = pat[s];
        const time = LEAD + (bar * 8 + s) * STEP;
        if (c === 'a' || c === 'x') notes.push({ time, col: 0, pair: c === 'x' });
        if (c === 'b' || c === 'x') notes.push({ time, col: 1, pair: c === 'x' });
      }
    }
  }
  return { notes, end: LEAD + bar * 8 * STEP };
}

export class DrumsRound extends Round {
  static key = 'drums';

  constructor(party) {
    super(party);
    const n = this.players.length;
    this.laneW = THREE.MathUtils.clamp(14 / n, 2.6, 5);
    this.width = this.laneW * n;
    this.chart = makeChart();
    this.songT = -1;
    this.step = -1;
    this.over = false;
    this.build();
    this.lanes = this.players.map((p, i) => this.makeLane(p, i));
  }

  get title() { return t('drums.title'); }
  get hint() { return t('drums.hint'); }

  build() {
    const g = this.group;
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(120, 60), toon(0x2b2340));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.42;
    g.add(ground);
    const stageW = Math.max(this.width + 6, 26);
    const stage = new THREE.Mesh(new THREE.BoxGeometry(stageW, 0.4, 5), toon(0x6b4fa8));
    stage.position.set(0, -0.2, 1.6);
    stage.receiveShadow = true;
    g.add(stage);
    const lip = new THREE.Mesh(new THREE.BoxGeometry(stageW, 0.12, 0.2), toon(COLORS.gold));
    lip.position.set(0, 0.02, 4.05);
    g.add(lip);
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(stageW + 20, 24), toon(0x3b2d6b));
    wall.position.set(0, 10, -0.6);
    g.add(wall);
    // Curtains: rows of soft vertical folds on both sides.
    for (const side of [-1, 1]) {
      for (let k = 0; k < 6; k++) {
        const fold = new THREE.Mesh(sharedGeo('drumFold', () => new THREE.CylinderGeometry(0.45, 0.45, 16, 10)), toon(k % 2 ? 0xd94a6a : 0xff5d73));
        fold.position.set(side * (this.width / 2 + 1.6 + k * 0.75), 8, -0.2 + (k % 2) * 0.15);
        g.add(fold);
      }
    }
    const valance = new THREE.Mesh(new THREE.BoxGeometry(stageW + 20, 1.2, 0.6), toon(0xff5d73));
    valance.position.set(0, TOP_Y + 1.4, 0);
    g.add(valance);
    // Party bulbs along the top.
    this.bulbs = [];
    const nb = Math.round((this.width + 4) / 1.1);
    for (let i = 0; i <= nb; i++) {
      const x = -this.width / 2 - 2 + (i * (this.width + 4)) / nb;
      const bulb = new THREE.Mesh(sharedGeo('drumBulb', () => new THREE.SphereGeometry(0.16, 10, 8)), toon(PLAYER_COLORS[i % 6].hex, { emissive: 0x333333 }));
      bulb.position.set(x, TOP_Y + 0.65, 0.35);
      g.add(bulb);
      this.bulbs.push(bulb);
    }
    // Speakers at the sides of the stage.
    for (const side of [-1, 1]) {
      const box = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.6, 1.2), toon(COLORS.ink));
      box.position.set(side * (this.width / 2 + 2.2), 1.3, 2.4);
      box.castShadow = true;
      g.add(box);
      for (const [y, r] of [[1.9, 0.38], [0.8, 0.55]]) {
        const cone = new THREE.Mesh(new THREE.CircleGeometry(r, 20), toon(0x6b6688));
        cone.position.set(side * (this.width / 2 + 2.2), y, 3.01);
        const dot = new THREE.Mesh(new THREE.CircleGeometry(r * 0.35, 14), toon(0x9a94b2));
        dot.position.set(side * (this.width / 2 + 2.2), y, 3.02);
        g.add(cone, dot);
      }
    }
  }

  makeLane(p, i) {
    const g = this.group;
    const lw = this.laneW;
    const cx = -this.width / 2 + lw * (i + 0.5);
    const h = TOP_Y - 0.9;
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(lw - 0.2, h), toon(i % 2 ? 0x4a3a80 : 0x54448e));
    strip.position.set(cx, 0.9 + h / 2, -0.3);
    g.add(strip);
    for (const s of [-1, 1]) {
      const edge = new THREE.Mesh(new THREE.BoxGeometry(0.09, h, 0.05), toon(p.color));
      edge.position.set(cx + s * (lw / 2 - 0.12), 0.9 + h / 2, -0.25);
      g.add(edge);
    }
    const r = Math.min(0.55, lw * 0.2);
    const cols = [cx - lw * 0.22, cx + lw * 0.22];
    // Faint column guides and the bright hit line.
    for (const x of cols) {
      const guide = new THREE.Mesh(new THREE.PlaneGeometry(0.06, h - 0.4), basic(0x6b5ca8));
      guide.position.set(x, 0.9 + h / 2, -0.28);
      g.add(guide);
    }
    const line = new THREE.Mesh(new THREE.PlaneGeometry(lw - 0.3, 0.12), basic(COLORS.white));
    line.position.set(cx, HIT_Y, -0.2);
    g.add(line);
    const targets = cols.map((x, c) => {
      const ring = new THREE.Mesh(sharedGeo(`drumRing${r}`, () => new THREE.RingGeometry(r * 0.82, r * 1.05, 28)), basic(COL_HEX[c]));
      ring.position.set(x, HIT_Y, -0.15);
      const fill = new THREE.Mesh(sharedGeo(`drumFill${r}`, () => new THREE.CircleGeometry(r * 0.82, 28)), basic(0x2b2340, { transparent: true, opacity: 0.6 }));
      fill.position.set(x, HIT_Y, -0.17);
      const letter = new THREE.Mesh(sharedGeo(`drumTLetter${r}`, () => new THREE.PlaneGeometry(r * 1.4, r * 1.4)), glyphMaterial(c ? 'B' : 'A', { fg: c ? B_CSS : A_CSS, stroke: '#2b2340' }));
      letter.position.set(x, HIT_Y, -0.14);
      g.add(ring, fill, letter);
      return { ring, flash: 0 };
    });
    // The drummer: a bean behind a little drum.
    const ch = this.bean(p);
    ch.group.position.set(cx, 0, 1.3);
    const drum = new THREE.Group();
    const shell = new THREE.Mesh(sharedGeo('drumShell', () => new THREE.CylinderGeometry(0.6, 0.6, 0.55, 22)), toon(p.color));
    shell.position.y = 0.28;
    shell.castShadow = true;
    const head = new THREE.Mesh(sharedGeo('drumHead', () => new THREE.CylinderGeometry(0.58, 0.58, 0.04, 22)), toon(COLORS.cream));
    head.position.y = 0.57;
    for (const y of [0.04, 0.52]) {
      const hoop = new THREE.Mesh(sharedGeo('drumHoop', () => new THREE.TorusGeometry(0.61, 0.04, 6, 24)), toon(COLORS.gold));
      hoop.rotation.x = Math.PI / 2;
      hoop.position.y = y;
      drum.add(hoop);
    }
    drum.add(shell, head);
    drum.position.set(cx, 0, 2.1);
    g.add(drum);
    const sticks = [-1, 1].map((s) => {
      const stick = new THREE.Mesh(sharedGeo('drumStick', () => new THREE.CylinderGeometry(0.03, 0.04, 0.7, 6)), toon(0xe8c690));
      const pivot = new THREE.Group();
      pivot.position.set(s * 0.32, 0.75, 0.25);
      stick.position.set(0, 0, 0.32);
      stick.rotation.x = Math.PI / 2;
      pivot.add(stick);
      ch.pivot.add(pivot);
      return { pivot, hit: 0 };
    });
    return {
      p, ch, drum, head, sticks, cx, cols, r, targets,
      state: new Uint8Array(this.chart.notes.length), // 0 waiting, 1 hit, 2 missed
      meshes: new Map(), next: 0, fumble: [0, 0],
      points: 0, hits: 0, streak: 0, best: 0,
      judge: { el: this.label('label'), t: 9, text: '', color: '' },
      tag: this.label('label'),
    };
  }

  frame() {
    // Leave room under the drums for the player bar at the bottom of the screen.
    const d = this.party.fitDistance(Math.max(this.width + 3, 13), TOP_Y + 4.6);
    this.camera.position.set(0, 5.8, d + 2);
    this.camera.lookAt(0, 5.3, 0);
  }

  start() {
    this.songT = 0;
    this.game.audio.stopMusic();
  }

  // ---------- sound ----------

  drum(col, vol = 1) {
    const a = this.game.audio;
    if (!a.ctx) return;
    if (col === 0) {
      a.tone(150, 0.22, { type: 'sine', vol: 0.32 * vol, slide: 0.45 });
      a.noise(0.06, { vol: 0.12 * vol, freq: 500, type: 'lowpass' });
    } else {
      a.noise(0.13, { vol: 0.2 * vol, freq: 1900, q: 0.8 });
      a.tone(300, 0.1, { type: 'triangle', vol: 0.14 * vol, slide: 0.7 });
    }
  }

  /** Backing groove, triggered on game-time eighth notes so it stays in step with the chart. */
  groove(step) {
    const a = this.game.audio;
    if (!a.ctx) return;
    const bus = a.musicBus;
    const inBar = step % 8;
    if (this.songT < LEAD) {
      // Count-in: four wood-block clicks.
      if (inBar % 2 === 0) a.tone(inBar === 0 ? 1320 : 990, 0.05, { type: 'square', vol: 0.06 });
      return;
    }
    if (inBar === 0 || inBar === 4) a.tone(110, 0.18, { type: 'sine', vol: 0.5, slide: 0.5, bus });
    if (inBar === 2 || inBar === 6) a.noise(0.08, { vol: 0.05, freq: 2500, q: 0.6 });
    const roots = [45, 41, 43, 40];
    const bar = Math.floor(step / 8) % 4;
    const note = 440 * Math.pow(2, (roots[bar] + (inBar % 4 === 3 ? 12 : 0) - 69) / 12);
    if (inBar % 2 === 0 || inBar === 3) a.tone(note, 0.16, { type: 'triangle', vol: 0.35, bus });
    if (inBar % 2 === 1) a.tone(note * 6, 0.05, { type: 'sine', vol: 0.05, bus });
  }

  // ---------- play ----------

  noteY(note) {
    return HIT_Y + (note.time - Math.max(0, this.songT)) * SCROLL;
  }

  press(lane, col) {
    if (lane.fumble[col] > 0) return;
    const notes = this.chart.notes;
    let best = -1, bd = GOOD;
    for (let i = lane.next; i < notes.length && notes[i].time < this.songT + GOOD + 0.01; i++) {
      if (notes[i].col !== col || lane.state[i]) continue;
      const d = Math.abs(notes[i].time - this.songT);
      if (d <= bd) { bd = d; best = i; }
    }
    lane.sticks[col].hit = 1;
    lane.ch.squash(0.82);
    if (best < 0) {
      // Stray hit: a soft thump, the streak resets and the drum is busy for a blink.
      lane.fumble[col] = FUMBLE;
      if (lane.streak >= 3) this.judge(lane, t('drums.miss'), '#9a94b2');
      lane.streak = 0;
      this.pending.add(col + 2);
      return;
    }
    lane.state[best] = 1;
    const perfect = bd <= PERFECT;
    lane.streak++;
    lane.best = Math.max(lane.best, lane.streak);
    lane.hits++;
    lane.points += (perfect ? 2 : 1) + Math.min(2, Math.floor(lane.streak / 10));
    lane.targets[col].flash = 1;
    this.pending.add(col);
    this.judge(lane, perfect ? t('drums.perfect') : t('drums.good'), perfect ? '#f0a020' : '#16b874');
    const m = lane.meshes.get(best);
    if (m) { this.group.remove(m); lane.meshes.delete(best); }
    const pos = new THREE.Vector3(lane.cols[col], HIT_Y, 0.3);
    this.party.confetti.burst(pos, 0, { count: perfect ? 10 : 5, speed: 3.5, up: 2, size: 0.12, life: 0.5, colors: [COL_HEX[col], lane.p.color, COLORS.white] });
  }

  judge(lane, text, color) {
    lane.judge.text = text;
    lane.judge.color = color;
    lane.judge.t = 0;
  }

  update(dt, playing) {
    this.time += dt;
    this.pending = new Set();
    const live = playing && !this.over;
    if (live) {
      this.songT += dt;
      const step = Math.floor(this.songT / STEP);
      while (this.step < step) { this.step++; this.groove(this.step); }
    }
    const beat = this.songT >= 0 ? (this.songT / (STEP * 2)) % 1 : 0;
    this.bulbs.forEach((b, i) => { b.position.y = TOP_Y + 0.65 + (live && i % 2 === Math.floor(this.songT / (STEP * 2)) % 2 ? 0.12 : 0); });
    for (const lane of this.lanes) this.updateLane(lane, dt, live, beat);
    // One drum sound per kind per frame keeps six drummers from getting too loud.
    for (const k of this.pending) this.drum(k % 2, k >= 2 ? 0.35 : 1);
    if (live && this.songT > this.chart.end + 1.2) {
      this.over = true;
      this.game.audio.play('fanfare');
      this.later(1.4, () => { this.done = true; });
    }
  }

  updateLane(lane, dt, live, beat) {
    const notes = this.chart.notes;
    if (live) {
      lane.fumble[0] -= dt; lane.fumble[1] -= dt;
      const d = this.input(lane.p);
      if (d.aPressed) this.press(lane, 0);
      if (d.bPressed) this.press(lane, 1);
      // Notes that slid past the window count as misses.
      while (lane.next < notes.length && notes[lane.next].time < this.songT - GOOD) {
        if (!lane.state[lane.next]) {
          lane.state[lane.next] = 2;
          if (lane.streak >= 3) this.judge(lane, t('drums.miss'), '#9a94b2');
          lane.streak = 0;
        }
        lane.next++;
      }
    }
    // Spawn, move and retire note meshes.
    for (let i = Math.max(0, lane.next - 6); i < notes.length; i++) {
      const note = notes[i];
      const y = this.noteY(note);
      if (y > TOP_Y + 0.6) break;
      let m = lane.meshes.get(i);
      if (y < HIT_Y - 1.6 || lane.state[i] === 1) {
        if (m) { this.group.remove(m); lane.meshes.delete(i); }
        continue;
      }
      if (!m) { m = this.noteMesh(lane, note); lane.meshes.set(i, m); }
      m.position.y = y;
      if (lane.state[i] === 2) m.scale.setScalar(Math.max(0.01, m.scale.x - dt * 2.5));
    }
    for (const tg of lane.targets) {
      tg.flash = Math.max(0, tg.flash - dt * 4);
      tg.ring.scale.setScalar(1 + tg.flash * 0.35);
    }
    for (const s of lane.sticks) {
      s.hit = Math.max(0, s.hit - dt * 7);
      s.pivot.rotation.x = 0.5 - s.hit * 1.1;
    }
    const hitAny = Math.max(lane.targets[0].flash, lane.targets[1].flash);
    lane.drum.scale.set(1 + hitAny * 0.08, 1 - hitAny * 0.1, 1 + hitAny * 0.08);
    lane.ch.group.position.y = live ? Math.abs(Math.sin(beat * Math.PI)) * 0.06 : 0;
    lane.ch.update(dt, {});
    // Score + streak above the drummer; judgement pops above the hit line.
    const streak = lane.streak >= 3 ? `<small>${t('drums.streak', { n: lane.streak })}</small>` : '';
    this.setLabel(lane.tag, `${lane.points}${streak}`, new THREE.Vector3(lane.cx, 1.75, 1.3), lane.p.css);
    const j = lane.judge;
    j.t += dt;
    if (j.t < 0.6 && j.text) {
      j.el.style.opacity = String(Math.min(1, (0.6 - j.t) * 4));
      this.setLabel(j.el, j.text, new THREE.Vector3(lane.cx, HIT_Y + 1 + j.t * 0.8, 0.3), j.color);
    } else j.el.style.display = 'none';
  }

  noteMesh(lane, note) {
    const r = lane.r;
    const g = new THREE.Group();
    const back = new THREE.Mesh(sharedGeo(`drumNoteBack${r}`, () => new THREE.CircleGeometry(r * 1.02, 28)), basic(COLORS.ink));
    const face = new THREE.Mesh(sharedGeo(`drumNote${r}`, () => new THREE.PlaneGeometry(r * 2.06, r * 2.06)), glyphMaterial(note.col ? 'B' : 'A', { disc: note.col ? B_CSS : A_CSS, fg: '#ffffff', stroke: '#2b2340' }));
    face.position.z = 0.01;
    g.add(back, face);
    if (note.pair && note.col === 0) {
      // Double notes are tied together by a bar so they read as one chord.
      const bar = new THREE.Mesh(sharedGeo(`drumPair${lane.laneW}`, () => new THREE.PlaneGeometry(this.laneW * 0.44, 0.16)), basic(COLORS.white));
      bar.position.set(this.laneW * 0.22, 0, -0.02);
      g.add(bar);
    }
    g.position.set(lane.cols[note.col], 0, note.col === 0 ? 0 : 0.03);
    this.group.add(g);
    return g;
  }

  hud() {
    return clock(this.chart.end + 1.2 - Math.max(0, this.songT));
  }

  score(p) {
    return this.lanes.find((l) => l.p === p).points;
  }

  detail(p) {
    const l = this.lanes.find((x) => x.p === p);
    return t('drums.n', { n: l.hits, s: l.best });
  }

  dispose() {
    this.game.audio.playMusic('party');
    super.dispose();
  }
}
