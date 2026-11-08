import * as THREE from 'three';
import { COLORS, toon } from '../../core/palette.js';
import { t, tFor, addStrings } from '../../core/i18n.js';
import { esc } from '../../core/ui.js';
import { say } from '../../core/voice.js';
import { LEVELS, schoolSave, glyphMaterial } from '../../core/edu.js';
import { mesh, box, cyl, cone, roofGeo, WOOD, WOOD_DARK } from './models.js';

// The school house on a profile's own island: its door opens a small picker of the learning games
// (spelling, maths, the clock, the money shop, rhymes, the learning mix and the quiz with its picture
// mode). Each game's level and progress (times played, best score) are saved per profile in
// progress.school (core/edu.js); the level can be changed right here with left/right, and the game's own
// level picker starts on it. The learning games stay on the shared island too, unchanged.
// Read-aloud: the games read their own words and puzzles (they rely on it); here the highlighted game is
// read when read-aloud is on, as help for children who cannot read yet.

addStrings({
  en: {
    'game.school': 'School House',
    'school.title': 'School House', 'school.sub': 'Learning games: you keep your own level and score here',
    'school.hint': '[A]/[B]: play · left/right: level · [C]: close', 'school.hintPad': 'Stick up/down: game · left/right: level · [OK]: play · [BACK]: close',
    'school.g.spelling': 'Bokstavballonger', 'school.d.spelling': 'Spell words with letter balloons',
    'school.g.math': 'Mattejakt', 'school.d.math': 'Run to the coin with the answer',
    'school.g.klokka': 'Klokka', 'school.d.klokka': 'Read the clock',
    'school.g.penger': 'Pengebutikken', 'school.d.penger': 'Pay the exact price with coins',
    'school.g.rimord': 'Rimord', 'school.d.rimord': 'Find the word that rhymes',
    'school.g.learnmix': 'Læringsmiks', 'school.d.learnmix': 'Clock, money and rhymes in a row',
    'school.g.quiz': 'Quizløpet', 'school.d.quiz': 'Quiz with pictures or questions',
    'school.played': 'played {n}×', 'school.best': 'best {n}', 'school.new': 'new!', 'school.noLevel': 'pick in the game',
    'school.info': '{n} of {m} played', 'school.infoNew': 'learning games',
  },
  no: {
    'game.school': 'Skolehuset',
    'school.title': 'Skolehuset', 'school.sub': 'Læringsspill: her har du ditt eget nivå og dine egne poeng',
    'school.hint': '[A]/[B]: spill · venstre/høyre: nivå · [C]: lukk', 'school.hintPad': 'Pinne opp/ned: spill · venstre/høyre: nivå · [OK]: spill · [BACK]: lukk',
    'school.g.spelling': 'Bokstavballonger', 'school.d.spelling': 'Stav ord med bokstavballonger',
    'school.g.math': 'Mattejakt', 'school.d.math': 'Løp til mynten med svaret',
    'school.g.klokka': 'Klokka', 'school.d.klokka': 'Les klokka',
    'school.g.penger': 'Pengebutikken', 'school.d.penger': 'Betal akkurat riktig med mynter',
    'school.g.rimord': 'Rimord', 'school.d.rimord': 'Finn ordet som rimer',
    'school.g.learnmix': 'Læringsmiks', 'school.d.learnmix': 'Klokka, penger og rim etter hverandre',
    'school.g.quiz': 'Quizløpet', 'school.d.quiz': 'Quiz med bilder eller spørsmål',
    'school.played': 'spilt {n}×', 'school.best': 'beste {n}', 'school.new': 'nytt!', 'school.noLevel': 'velg i spillet',
    'school.info': '{n} av {m} spilt', 'school.infoNew': 'læringsspill',
  },
});

/** The school's games: id (saved per profile), the game key and options it starts with. */
export const SCHOOL_GAMES = [
  { id: 'spelling', key: 'spelling', icon: '🎈' },
  { id: 'math', key: 'math', icon: '➕' },
  { id: 'klokka', key: 'learnmix', opts: { rounds: ['klokka'] }, icon: '🕒' },
  { id: 'penger', key: 'learnmix', opts: { rounds: ['penger'] }, icon: '🪙' },
  { id: 'rimord', key: 'learnmix', opts: { rounds: ['rimord'] }, icon: '🎵' },
  { id: 'learnmix', key: 'learnmix', icon: '🧩' },
  { id: 'quiz', key: 'party', opts: { rounds: ['quiz'], size: 1 }, icon: '❓', noLevel: true },
];
/** Game keys that come back to the school's door. */
export const SCHOOL_KEYS = [...new Set(SCHOOL_GAMES.map((g) => g.key))];

const CSS = `
.isl-panel .school-sub { text-align: center; margin: -4px 0 10px; opacity: .75; font-size: clamp(12px, 1.15vw, 17px); }
.isl-row.school { grid-template-columns: clamp(34px, 3.2vw, 46px) 1fr auto; }
.isl-row.school .ic { font-size: 1.5em; text-align: center; }
.isl-row.school .lv { display: flex; gap: 4px; }
.isl-row.school .lv span { border-radius: 999px; padding: 1px 9px; font-size: .78em; background: rgba(138,90,50,.12); opacity: .6; }
.isl-row.school .lv span.on { background: #3ddc97; color: #fff; opacity: 1; }
.isl-row.school .st { display: block; font-size: .75em; opacity: .7; text-align: right; margin-top: 2px; }
`;
function injectStyle() {
  if (document.getElementById('isl-school-style')) return;
  const el = document.createElement('style');
  el.id = 'isl-school-style';
  el.textContent = CSS;
  document.head.appendChild(el);
}

/** The school house: a white clapboard house with a red roof, a bell tower and a chalkboard. Door at +z. */
export function makeSchool(M) {
  const g = new THREE.Group();
  const w = 6.0, d = 4.2, h = 2.7;
  g.add(mesh(box(w + 0.3, 0.35, d + 0.3), 0x9a94b2, 0, 0.17, 0));
  g.add(mesh(box(w, h, d), 0xfffaf0, 0, 0.35 + h / 2, 0));
  for (let i = 0; i < 5; i++) g.add(mesh(box(w + 0.04, 0.05, d + 0.04), 0xe8dcc8, 0, 0.7 + i * 0.5, 0, false)); // clapboards
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(mesh(box(0.22, h, 0.22), 0x4c8bd6, sx * (w / 2 - 0.05), 0.35 + h / 2, sz * (d / 2 - 0.05)));
  g.add(mesh(box(w + 0.1, 0.18, d + 0.1), 0x4c8bd6, 0, 0.35 + h, 0));
  g.add(mesh(roofGeo(w + 0.7, d + 0.9, 2.0), 0xd94a4a, 0, 0.35 + h + 0.05, 0));
  // the bell tower on the ridge
  const top = 0.35 + h + 2.0;
  g.add(mesh(box(1.1, 1.0, 1.1), 0xfffaf0, 0, top + 0.2, 0));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(mesh(box(0.12, 0.8, 0.12), 0x4c8bd6, sx * 0.5, top + 1.05, sz * 0.5));
  g.add(mesh(cone(0.95, 1.1, 4), 0xd94a4a, 0, top + 2.0, 0).rotateY(Math.PI / 4));
  const bell = new THREE.Group();
  bell.add(mesh(cone(0.3, 0.42, 12), COLORS.gold, 0, 0, 0), mesh(cyl(0.06, 0.06, 0.1, 8), COLORS.gold, 0, -0.24, 0, false));
  bell.position.set(0, top + 1.05, 0);
  g.add(bell);
  g.userData.bell = bell;
  // door, steps and windows
  const dz = d / 2 + 0.03;
  g.add(mesh(box(1.1, 1.8, 0.1), 0x4c8bd6, 0, 0.35 + 0.9, dz));
  g.add(mesh(cyl(0.06, 0.06, 0.05, 8), COLORS.gold, 0.35, 1.2, dz + 0.07, false).rotateX(Math.PI / 2));
  g.add(mesh(box(1.8, 0.14, 0.9), WOOD, 0, 0.07, dz + 0.5));
  for (const x of [-1.9, 1.9]) {
    const win = new THREE.Group();
    win.add(mesh(box(1.06, 0.96, 0.08), 0xffffff, 0, 0, 0, false), mesh(box(0.9, 0.8, 0.1), M.win, 0, 0, 0.02, false));
    win.add(mesh(box(0.06, 0.8, 0.12), 0xffffff, 0, 0, 0.04, false), mesh(box(0.9, 0.06, 0.12), 0xffffff, 0, 0, 0.04, false));
    win.position.set(x, 0.35 + h * 0.56, dz);
    g.add(win);
  }
  // a chalkboard easel by the door: A B C over 1 2 3
  const board = new THREE.Group();
  board.add(mesh(box(1.3, 1.0, 0.08), WOOD_DARK, 0, 0, 0), mesh(box(1.16, 0.86, 0.1), 0x2f5d50, 0, 0, 0.01, false));
  ['A', 'B', 'C', '1', '2', '3'].forEach((ch, i) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.34), glyphMaterial(ch, { fg: i < 3 ? '#ffffff' : '#ffe14a', stroke: '#2f5d50' }));
    m.position.set(-0.36 + (i % 3) * 0.36, i < 3 ? 0.19 : -0.19, 0.07);
    board.add(m);
  });
  for (const sx of [-0.5, 0.5]) board.add(mesh(box(0.07, 1.5, 0.07), WOOD, sx, -0.35, -0.04));
  board.add(mesh(box(0.07, 1.4, 0.07), WOOD, 0, -0.4, -0.35).rotateX(0.45));
  board.position.set(2.1, 1.1, dz + 0.9);
  board.rotation.x = -0.28;
  g.add(board);
  // a little apple on the step and a flag pole to the side
  g.add(mesh(cyl(0.05, 0.05, 3.6, 6), 0xffffff, w / 2 + 0.8, 1.8, dz - 0.3));
  const flag = mesh(box(0.8, 0.5, 0.03), 0x3ddc97, w / 2 + 1.22, 3.3, dz - 0.3);
  g.add(flag);
  g.userData.flag = flag;
  g.add(mesh(new THREE.SphereGeometry(0.16, 10, 8), toon(0xff4f6d), -0.6, 0.3, dz + 0.55));
  return g;
}

export class School {
  constructor(host) {
    this.host = host;
    this.panel = null;
    this.place = host.map.places.find((p) => p.id === 'school');
    this.view = host.map.school || null;
    injectStyle();
  }

  get save() { return schoolSave(this.host.game.roster); }

  /** The place sign's second line: how many of the games this profile has played. */
  info() {
    const plays = this.save.plays;
    const n = SCHOOL_GAMES.filter((g) => plays[g.id]).length;
    return n ? t('school.info', { n, m: SCHOOL_GAMES.length }) : t('school.infoNew');
  }

  open() {
    const host = this.host;
    host.mode = 'school';
    this.panel = { i: Math.max(0, SCHOOL_GAMES.findIndex((g) => g.id === this.save.last)), t: 0 };
    host.game.audio.play('select');
    this.render();
    this.readCurrent();
  }

  render() {
    const host = this.host, S = this.save, Pn = this.panel;
    const rows = SCHOOL_GAMES.map((g, i) => {
      const lv = S.levels[g.id] ?? 0;
      const levels = g.noLevel ? `<small>${esc(t('school.noLevel'))}</small>` : `<div class="lv">${LEVELS.map((L, k) => `<span class="${k === lv ? 'on' : ''}">${esc(L.name)}</span>`).join('')}</div>`;
      const plays = S.plays[g.id] || 0;
      const stat = plays ? `${t('school.played', { n: plays })}${S.best[g.id] !== undefined ? ` · ${t('school.best', { n: S.best[g.id] })}` : ''}` : t('school.new');
      return `<div class="isl-row school ${i === Pn.i ? 'on' : ''}"><div class="ic">${g.icon}</div>
        <div>${esc(t(`school.g.${g.id}`))} <small>${esc(t(`school.d.${g.id}`))}</small></div>
        <div>${levels}<span class="st">${esc(stat)}</span></div></div>`;
    }).join('');
    host.hud.setPanel(`<h2>${esc(t('school.title'))}</h2><div class="school-sub">${esc(t('school.sub'))}</div>
      <div class="isl-rows">${rows}</div><div class="isl-foot">${esc(tFor(host.player?.p, host.onPad ? 'school.hintPad' : 'school.hint'))}</div>`);
  }

  readCurrent() {
    const g = SCHOOL_GAMES[this.panel.i];
    say(`${t(`school.g.${g.id}`)}. ${t(`school.d.${g.id}`)}`, 'narrator');
  }

  /** panel: the island's panel input ([OK] picks as aPressed, back as bPressed). */
  update(inp, dt) {
    const host = this.host, Pn = this.panel;
    if (!Pn) { host.mode = 'walk'; return; }
    Pn.t += dt;
    const n = SCHOOL_GAMES.length;
    if (inp.stepY) { Pn.i = (Pn.i - inp.stepY + n) % n; host.game.audio.play('select'); this.render(); this.readCurrent(); }
    const g = SCHOOL_GAMES[Pn.i];
    if (inp.stepX && !g.noLevel) {
      const S = this.save;
      S.levels[g.id] = THREE.MathUtils.clamp((S.levels[g.id] ?? 0) + inp.stepX, 0, LEVELS.length - 1);
      host.game.roster.save();
      host.game.audio.play('select');
      this.render();
    }
    if (Pn.t < 0.25) return;
    if (inp.bPressed) { this.close(); return; }
    if (inp.aPressed) this.start(g);
  }

  close() {
    this.panel = null;
    this.host.hud.setPanel(null);
    this.host.mode = 'walk';
    this.host.game.audio.play('select');
  }

  start(g) {
    const host = this.host;
    this.save.last = g.id;
    host.hud.setPanel(null);
    this.panel = null;
    host.mode = 'walk';
    host.enterPlace(this.place, { key: g.key, opts: { ...(g.opts || {}), school: g.id } });
  }

  update3d(dt) {
    const v = this.view;
    if (!v) return;
    v.userData.bell.rotation.z = Math.sin(this.host.time * 1.3) * 0.12;
    v.userData.flag.rotation.y = Math.sin(this.host.time * 2.1) * 0.2;
  }
}
