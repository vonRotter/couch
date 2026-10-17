import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { FieldRound, HD, TILE_COLORS, makeBoard, splitPhrase } from './common.js';
import { COLORS, toon, basic, sharedGeo } from '../../core/palette.js';
import { speak } from '../../core/edu.js';
import { t, addStrings } from '../../core/i18n.js';
import { esc } from '../../core/ui.js';

// Klokka: an analog clock floats over every player; walk to the board with the right time.

addStrings({
  en: {
    'klokka.title': 'Klokka',
    'klokka.hint': 'Se på klokka over hodet ditt. Gå til skiltet som viser hva klokka er!',
    'klokka.unit': 'riktige',
    'klokka.card': '{name} · {n} riktige',
  },
  no: {
    'klokka.title': 'Klokka',
    'klokka.hint': 'Se på klokka over hodet ditt. Gå til skiltet som viser hva klokka er!',
    'klokka.unit': 'riktige',
    'klokka.card': '{name} · {n} riktige',
  },
});

const NUM = ['tolv', 'ett', 'to', 'tre', 'fire', 'fem', 'seks', 'sju', 'åtte', 'ni', 'ti', 'elleve', 'tolv'];
const wrap = (h) => ((h - 1 + 120) % 12) + 1;
const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = (list) => list[Math.floor(Math.random() * list.length)];

/** Norwegian clock phrase for h (1–12) and m (multiple of 5): 3:30 -> "halv fire". */
export function timePhrase(h, m) {
  const H = NUM[h], N = NUM[wrap(h + 1)];
  switch (m) {
    case 0: return `kl. ${h}`;
    case 5: return `fem over ${H}`;
    case 10: return `ti over ${H}`;
    case 15: return `kvart over ${H}`;
    case 20: return `ti på halv ${N}`;
    case 25: return `fem på halv ${N}`;
    case 30: return `halv ${N}`;
    case 35: return `fem over halv ${N}`;
    case 40: return `ti over halv ${N}`;
    case 45: return `kvart på ${N}`;
    case 50: return `ti på ${N}`;
    case 55: return `fem på ${N}`;
    default: return `${h}:${String(m).padStart(2, '0')}`;
  }
}

/** What speak() should say ("kl. 3" reads as "klokka tre"). */
export function spokenTime(h, m) {
  return m === 0 ? `klokka ${NUM[h]}` : timePhrase(h, m);
}

const FIVES = [5, 10, 20, 25, 35, 40, 50, 55];

function randomMinute(level) {
  if (level === 'easy') return 0;
  if (level === 'medium') return Math.random() < 0.7 ? 30 : 0;
  return Math.random() < 0.4 ? pick([15, 45]) : pick(FIVES);
}

export function randomTime(level) {
  return { h: rnd(1, 12), m: randomMinute(level) };
}

const keyOf = (h, m) => `${h}:${m}`;
const parse = (key) => key.split(':').map(Number);

/** Inline SVG analog clock for the HTML cards. */
export function clockSVG(h, m, color, size = 'clamp(64px, 7.5vw, 112px)') {
  let marks = '';
  for (let i = 0; i < 60; i++) {
    const big = i % 5 === 0;
    marks += `<line x1="50" y1="${big ? 7 : 6}" x2="50" y2="${big ? 13 : 9}" stroke="#2b2340" stroke-width="${big ? 2.2 : 1}" stroke-linecap="round" transform="rotate(${i * 6} 50 50)"/>`;
  }
  let nums = '';
  for (let n = 1; n <= 12; n++) {
    const a = (n / 12) * Math.PI * 2;
    nums += `<text x="${(50 + Math.sin(a) * 30).toFixed(1)}" y="${(50 - Math.cos(a) * 30 + 4.4).toFixed(1)}" text-anchor="middle" font-size="12.5" font-weight="700" fill="#2b2340">${n}</text>`;
  }
  const ha = ((h % 12) + m / 60) * 30, ma = m * 6;
  return `<svg viewBox="0 0 100 100" style="width:${size};height:${size};display:block;margin:2px auto" aria-label="${esc(timePhrase(h, m))}">
    <circle cx="50" cy="50" r="47" fill="#fff" stroke="${color}" stroke-width="5"/>${marks}${nums}
    <line x1="50" y1="54" x2="50" y2="27" stroke="#2b2340" stroke-width="6" stroke-linecap="round" transform="rotate(${ha} 50 50)"/>
    <line x1="50" y1="56" x2="50" y2="14" stroke="#2b2340" stroke-width="3.2" stroke-linecap="round" transform="rotate(${ma} 50 50)"/>
    <circle cx="50" cy="50" r="4" fill="${color}"/></svg>`;
}

// ---------- 3D clock ----------

let faceTex = null;
function clockFaceMaterial() {
  if (faceTex) return faceTex;
  const s = 512;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.arc(s / 2, s / 2, s / 2, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#2b2340';
  g.lineCap = 'round';
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2, big = i % 5 === 0;
    const r0 = s * (big ? 0.4 : 0.43), r1 = s * 0.47;
    g.lineWidth = big ? 9 : 4;
    g.beginPath();
    g.moveTo(s / 2 + Math.sin(a) * r0, s / 2 - Math.cos(a) * r0);
    g.lineTo(s / 2 + Math.sin(a) * r1, s / 2 - Math.cos(a) * r1);
    g.stroke();
  }
  g.fillStyle = '#2b2340';
  g.font = '700 74px Fredoka, "Trebuchet MS", sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  for (let n = 1; n <= 12; n++) {
    const a = (n / 12) * Math.PI * 2;
    g.fillText(String(n), s / 2 + Math.sin(a) * s * 0.31, s / 2 - Math.cos(a) * s * 0.31 + 4);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.userData.shared = true;
  faceTex = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
  faceTex.userData.shared = true;
  return faceTex;
}

function handGeo(key, w, len) {
  return sharedGeo(key, () => {
    const geo = new THREE.BoxGeometry(w, len, 0.04);
    geo.translate(0, len / 2 - 0.08, 0);
    return geo;
  });
}

/** Analog clock with a rim in the player's color; returns { group, set(h, m) }. */
export function makeClock(color) {
  const group = new THREE.Group();
  const back = new THREE.Mesh(sharedGeo('lmClockBack', () => new THREE.CylinderGeometry(1.12, 1.12, 0.16, 40)), toon(color));
  back.rotation.x = Math.PI / 2;
  back.position.z = -0.1;
  const face = new THREE.Mesh(sharedGeo('lmClockFace', () => new THREE.CircleGeometry(1, 48)), clockFaceMaterial());
  face.position.z = 0;
  const rim = new THREE.Mesh(sharedGeo('lmClockRim', () => new THREE.TorusGeometry(1.04, 0.09, 8, 40)), toon(color));
  const hour = new THREE.Mesh(handGeo('lmHourHand', 0.13, 0.58), basic(COLORS.ink));
  hour.position.z = 0.03;
  const minute = new THREE.Mesh(handGeo('lmMinHand', 0.08, 0.86), basic(COLORS.ink));
  minute.position.z = 0.05;
  const cap = new THREE.Mesh(sharedGeo('lmClockCap', () => new THREE.CircleGeometry(0.08, 16)), basic(color));
  cap.position.z = 0.07;
  group.add(back, face, rim, hour, minute, cap);
  return {
    group,
    set(h, m) {
      hour.rotation.z = -(((h % 12) + m / 60) / 12) * Math.PI * 2;
      minute.rotation.z = -(m / 60) * Math.PI * 2;
    },
  };
}

// ---------- the round ----------

export class KlokkaRound extends FieldRound {
  static key = 'klokka';

  constructor(mix) {
    super(mix, { fences: [0xc9a8ff, 0x8fd8ff, 0xffe47a, 0xff9fd0], seed: 23 });
    for (const e of this.ents) {
      e.clock = makeClock(e.p.color);
      e.clock.group.scale.setScalar(0.95);
      e.clock.group.visible = false;
      this.group.add(e.clock.group);
    }
    this.decorate();
  }

  get title() { return t('klokka.title'); }
  get hint() { return t('klokka.hint'); }

  howto() {
    return `<div style="display:flex;gap:18px;justify-content:center;align-items:center;margin:8px 0">
      <div style="width:96px">${clockSVG(3, 30, '#9b5de5', '96px')}</div><div class="edu-word">= halv fire</div></div>`;
  }

  decorate() {
    // Two big clocks behind the field, ticking on their own (left and right of the HUD).
    this.deco = [[-10.5, 0x4cc9f0], [10.5, 0xff8c42]].map(([x, c], i) => {
      const clk = makeClock(c);
      clk.group.position.set(x, 1.3, -HD - 2.4);
      clk.group.scale.setScalar(1.05);
      const post = new THREE.Mesh(sharedGeo('lmClockPost', () => new RoundedBoxGeometry(0.4, 1.6, 0.4, 2, 0.1)), toon(COLORS.trunk));
      post.position.set(x, -0.2, -HD - 2.6);
      this.group.add(clk.group, post);
      return { clk, h: 3 + i * 6, m: i * 20 };
    });
  }

  newTask(e) {
    const lv = this.levelKey(e);
    let tm;
    do tm = randomTime(lv); while (e.task && keyOf(tm.h, tm.m) === e.task.key);
    e.task = { ...tm, key: keyOf(tm.h, tm.m), phrase: timePhrase(tm.h, tm.m) };
    e.clock.set(tm.h, tm.m);
    e.clock.group.visible = true;
  }

  need(e) {
    return e.task.key;
  }

  isRight(e, tile) {
    return tile.value === e.task.key;
  }

  /** A near miss for one of the players, so the field is good practice. */
  filler() {
    const e = pick(this.ents);
    const lv = this.levelKey(e);
    if (!e.task) return keyOf(...Object.values(randomTime(lv)));
    const { h, m } = e.task;
    const r = Math.random();
    if (r < 0.3) return keyOf(wrap(h + 1), m); // the classic "halv fire" vs "halv fem" mix-up
    if (r < 0.5) return keyOf(wrap(h - 1), m);
    if (r < 0.75 && lv !== 'easy') return keyOf(h, randomMinute(lv));
    const tm = randomTime(lv);
    return keyOf(tm.h, tm.m);
  }

  makeTile(value) {
    const [h, m] = parse(value);
    const color = TILE_COLORS[(h + m) % TILE_COLORS.length];
    return { mesh: makeBoard(splitPhrase(timePhrase(h, m)), color), w: 3.4, d: 1.7 };
  }

  onRight(e, tile) {
    super.onRight(e, tile);
    e.doneT = 1.6;
    speak(spokenTime(e.task.h, e.task.m));
  }

  tag() {
    return '';
  }

  tagHeight() {
    return 3.9;
  }

  card(e) {
    const done = e.doneT > 0;
    return `<div class="edu-card-head">${esc(t('klokka.card', { name: e.p.name, n: e.score }))}</div>
      ${clockSVG(e.task.h, e.task.m, e.p.css)}
      <div class="edu-clue" style="font-weight:700;opacity:${done ? 1 : 0.75}">${done ? `✓ ${esc(e.task.phrase)}` : esc(this.levelName(e))}</div>`;
  }

  get unit() { return t('klokka.unit'); }

  update(dt, playing) {
    super.update(dt, playing);
    for (const e of this.ents) {
      const c = e.clock.group;
      const pop = e.doneT > 0 ? 1 + Math.sin(Math.min(1, (1.6 - e.doneT) * 3) * Math.PI) * 0.2 : 1;
      c.position.set(e.x, 2.65 + Math.sin(this.time * 2.4 + e.i) * 0.06, e.z);
      c.quaternion.copy(this.camera.quaternion);
      c.scale.setScalar(0.95 * pop);
    }
    for (const d of this.deco) {
      d.m = (d.m + dt * 2) % 60;
      d.clk.set(d.h, d.m);
    }
  }
}
