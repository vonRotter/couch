import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { COLORS, toon, sharedGeo } from '../../core/palette.js';
import { makeStar } from '../../core/world.js';
import { makeHat } from '../../core/character.js';
import { glyphMaterial, shuffle } from '../../core/edu.js';
import { getLang, addStrings } from '../../core/i18n.js';

// Picture puzzles for Quiz Run's kids mode: no reading needed. Every picture is a small toon model
// (about 1 unit tall, standing on y = 0, facing +z) built from shared primitives, so building one
// per question costs nothing to dispose. The question is read aloud with sayAloud().

// ---------- speech ----------

let voices = [];
function loadVoices() {
  try { voices = window.speechSynthesis?.getVoices() || []; } catch { voices = []; }
}
if (typeof window !== 'undefined' && window.speechSynthesis) {
  loadVoices();
  try { window.speechSynthesis.addEventListener('voiceschanged', loadVoices); } catch { /* old browsers */ }
}

/**
 * Reads text aloud in the current language (English or Norwegian). Picks a matching voice when the
 * device lists one; stays quiet if it only has voices for other languages. Returns true if it spoke.
 */
export function sayAloud(text) {
  const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
  if (!synth || typeof SpeechSynthesisUtterance === 'undefined') return false;
  try {
    if (!voices.length) loadVoices();
    const no = getLang() === 'no';
    const re = no ? /^(nb|no|nn)(-|$)/i : /^en(-|$)/i;
    const list = voices.filter((v) => re.test(String(v.lang).replace('_', '-')));
    const voice = list.find((v) => v.localService) || list[0] || null;
    // Voices are known but none speaks this language: an English voice reading Norwegian is worse than silence.
    if (voices.length && !voice) return false;
    const u = new SpeechSynthesisUtterance(text.replace(/[«»"]/g, ''));
    u.lang = voice ? voice.lang : no ? 'nb-NO' : 'en-US';
    if (voice) u.voice = voice;
    u.rate = 0.9;
    u.pitch = 1.1;
    synth.cancel();
    synth.speak(u);
    return true;
  } catch {
    return false;
  }
}

export function stopSpeaking() {
  try { window.speechSynthesis?.cancel(); } catch { /* nothing to stop */ }
}

// ---------- model helpers ----------

const GEO = {
  sph: () => sharedGeo('qpSph', () => new THREE.SphereGeometry(1, 20, 14)),
  box: () => sharedGeo('qpBox', () => new RoundedBoxGeometry(1, 1, 1, 2, 0.14)),
  cyl: () => sharedGeo('qpCyl', () => new THREE.CylinderGeometry(1, 1, 1, 20)),
  cone: () => sharedGeo('qpCone', () => new THREE.ConeGeometry(1, 1, 20)),
  dome: () => sharedGeo('qpDome', () => new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2)),
  arc: () => sharedGeo('qpArc', () => new THREE.TorusGeometry(1, 0.16, 8, 24, Math.PI)),
  ring: () => sharedGeo('qpRing', () => new THREE.TorusGeometry(1, 0.08, 8, 32)),
  nest: () => sharedGeo('qpNest', () => new THREE.TorusGeometry(0.3, 0.1, 8, 20)),
  banana: () => sharedGeo('qpBanana', () => new THREE.TorusGeometry(0.42, 0.13, 10, 24, Math.PI * 0.75)),
  wedge: () => sharedGeo('qpWedge', () => new THREE.CylinderGeometry(0.6, 0.6, 0.42, 8, 1, false, 0, Math.PI / 2.4)),
  plane: () => sharedGeo('qpPlane', () => new THREE.PlaneGeometry(1, 1)),
  heart: () => sharedGeo('qpHeart', () => {
    const s = new THREE.Shape();
    s.moveTo(0, -0.5);
    s.bezierCurveTo(0.1, -0.35, 0.5, -0.15, 0.5, 0.12);
    s.bezierCurveTo(0.5, 0.38, 0.22, 0.5, 0, 0.3);
    s.bezierCurveTo(-0.22, 0.5, -0.5, 0.38, -0.5, 0.12);
    s.bezierCurveTo(-0.5, -0.15, -0.1, -0.35, 0, -0.5);
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.16, bevelEnabled: true, bevelThickness: 0.07, bevelSize: 0.06, bevelSegments: 3 });
    g.center();
    return g;
  }),
};

/** Adds one primitive: p(group, 'sph', color, [x, y, z], [sx, sy, sz], [rx, ry, rz]). */
function p(g, kind, color, pos, scl = [1, 1, 1], rot = null) {
  const m = new THREE.Mesh(GEO[kind](), typeof color === 'number' ? toon(color) : color);
  m.position.set(...pos);
  if (typeof scl === 'number') m.scale.setScalar(scl); else m.scale.set(...scl);
  if (rot) m.rotation.set(...rot);
  m.castShadow = true;
  g.add(m);
  return m;
}

function eyes(g, dx, y, z, r = 0.055) {
  for (const s of [-1, 1]) {
    p(g, 'sph', COLORS.white, [s * dx, y, z], r);
    p(g, 'sph', COLORS.ink, [s * dx, y - r * 0.1, z + r * 0.62], r * 0.55);
  }
}

const group = () => new THREE.Group();
const PINK_NOSE = 0xff8fa8;

// ---------- animals ----------

function cow() {
  const g = group();
  p(g, 'box', COLORS.white, [0, 0.48, -0.05], [0.9, 0.5, 0.62]);
  for (const [x, y, z, sx, sy, sz] of [[-0.2, 0.735, -0.1, 0.18, 0.025, 0.16], [0.22, 0.735, -0.2, 0.14, 0.025, 0.12], [0.45, 0.5, -0.1, 0.02, 0.13, 0.14], [-0.45, 0.45, -0.15, 0.02, 0.12, 0.15]]) {
    p(g, 'sph', COLORS.ink, [x, y, z], [sx, sy, sz]);
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) p(g, 'cyl', COLORS.white, [sx * 0.3, 0.13, -0.05 + sz * 0.2], [0.08, 0.26, 0.08]);
  p(g, 'sph', COLORS.white, [0, 0.78, 0.33], [0.3, 0.28, 0.27]);
  p(g, 'sph', 0xffb3c1, [0, 0.67, 0.56], [0.24, 0.15, 0.13]);
  for (const s of [-1, 1]) {
    p(g, 'sph', COLORS.ink, [s * 0.08, 0.69, 0.68], 0.03);
    p(g, 'cone', COLORS.cream, [s * 0.17, 1.08, 0.3], [0.05, 0.16, 0.05], [0, 0, -s * 0.4]);
    p(g, 'sph', COLORS.white, [s * 0.31, 0.88, 0.3], [0.13, 0.06, 0.06]);
  }
  eyes(g, 0.12, 0.86, 0.55);
  return g;
}

function pig() {
  const g = group();
  const pink = 0xffa6c1;
  p(g, 'sph', pink, [0, 0.42, -0.05], [0.48, 0.4, 0.48]);
  p(g, 'sph', pink, [0, 0.6, 0.28], 0.3);
  p(g, 'cyl', 0xff7fa5, [0, 0.55, 0.57], [0.14, 0.08, 0.11], [Math.PI / 2, 0, 0]);
  for (const s of [-1, 1]) {
    p(g, 'sph', 0xc2406a, [s * 0.05, 0.56, 0.615], 0.028);
    p(g, 'cone', pink, [s * 0.19, 0.88, 0.25], [0.09, 0.16, 0.06], [0.3, 0, -s * 0.5]);
    for (const sz of [-1, 1]) p(g, 'cyl', pink, [s * 0.22, 0.09, -0.05 + sz * 0.22], [0.07, 0.18, 0.07]);
  }
  eyes(g, 0.11, 0.7, 0.52, 0.05);
  return g;
}

function sheep() {
  const g = group();
  const wool = 0xf7f4ee, face = 0x3a3346;
  for (const [x, y, z, r] of [[0, 0.58, -0.05, 0.38], [0.26, 0.52, 0.08, 0.25], [-0.26, 0.52, 0.08, 0.25], [0.26, 0.52, -0.2, 0.25], [-0.26, 0.52, -0.2, 0.25], [0, 0.82, -0.05, 0.26], [0, 0.55, -0.32, 0.26]]) {
    p(g, 'sph', wool, [x, y, z], r);
  }
  p(g, 'sph', face, [0, 0.6, 0.36], [0.2, 0.24, 0.2]);
  p(g, 'sph', wool, [0, 0.84, 0.32], 0.15);
  for (const s of [-1, 1]) {
    p(g, 'sph', face, [s * 0.21, 0.66, 0.33], [0.11, 0.045, 0.05]);
    for (const sz of [-1, 1]) p(g, 'cyl', face, [s * 0.18, 0.12, -0.08 + sz * 0.16], [0.055, 0.25, 0.055]);
  }
  eyes(g, 0.08, 0.65, 0.5, 0.05);
  return g;
}

function duck() {
  const g = group();
  const yel = 0xffd84a, org = 0xff8c2a;
  p(g, 'sph', yel, [0, 0.32, 0], [0.42, 0.3, 0.45]);
  p(g, 'sph', yel, [0, 0.42, -0.38], [0.15, 0.1, 0.13], [0.5, 0, 0]);
  p(g, 'sph', yel, [0, 0.72, 0.16], 0.24);
  p(g, 'sph', org, [0, 0.66, 0.4], [0.16, 0.05, 0.13]);
  for (const s of [-1, 1]) {
    p(g, 'sph', 0xf2c230, [s * 0.38, 0.36, -0.02], [0.08, 0.17, 0.28]);
    p(g, 'sph', org, [s * 0.14, 0.02, 0.2], [0.1, 0.025, 0.13]);
  }
  eyes(g, 0.1, 0.78, 0.35, 0.05);
  return g;
}

function cat() {
  const g = group();
  const fur = 0xffa24a, dark = 0xe07a24;
  p(g, 'sph', fur, [0, 0.32, 0], [0.33, 0.33, 0.3]);
  p(g, 'sph', fur, [0, 0.72, 0.08], [0.3, 0.26, 0.27]);
  p(g, 'arc', dark, [0.3, 0.3, -0.1], [0.2, 0.2, 0.3], [0, Math.PI / 2, 0]);
  for (const s of [-1, 1]) {
    p(g, 'cone', fur, [s * 0.17, 0.98, 0.06], [0.1, 0.17, 0.07], [0, 0, -s * 0.25]);
    p(g, 'cone', 0xffc2d0, [s * 0.17, 0.96, 0.1], [0.05, 0.1, 0.03], [0, 0, -s * 0.25]);
    p(g, 'sph', fur, [s * 0.13, 0.06, 0.22], 0.08);
    p(g, 'cyl', COLORS.ink, [s * 0.19, 0.66, 0.31], [0.008, 0.24, 0.008], [0, 0, Math.PI / 2 + s * 0.15]);
  }
  p(g, 'sph', dark, [0, 0.93, 0.18], [0.05, 0.03, 0.08]);
  p(g, 'sph', PINK_NOSE, [0, 0.68, 0.34], 0.035);
  eyes(g, 0.1, 0.76, 0.3);
  return g;
}

function dog() {
  const g = group();
  const fur = 0xd9a066, ear = 0x8a5a33;
  p(g, 'sph', fur, [0, 0.32, -0.05], [0.32, 0.3, 0.36]);
  p(g, 'sph', fur, [0, 0.7, 0.12], 0.27);
  p(g, 'sph', 0xf1d1a8, [0, 0.62, 0.36], [0.15, 0.11, 0.12]);
  p(g, 'sph', COLORS.ink, [0, 0.67, 0.47], 0.05);
  p(g, 'sph', 0xff6f91, [0, 0.53, 0.42], [0.05, 0.07, 0.02]);
  p(g, 'cone', fur, [0, 0.5, -0.4], [0.05, 0.25, 0.05], [-0.7, 0, 0]);
  for (const s of [-1, 1]) {
    p(g, 'sph', ear, [s * 0.27, 0.65, 0.1], [0.08, 0.2, 0.12], [0, 0, s * 0.2]);
    p(g, 'sph', fur, [s * 0.14, 0.05, 0.2], 0.08);
  }
  eyes(g, 0.1, 0.78, 0.33, 0.05);
  return g;
}

function frog() {
  const g = group();
  const green = 0x5ccf4a;
  p(g, 'sph', green, [0, 0.28, 0], [0.45, 0.28, 0.4]);
  p(g, 'sph', 0xb8f08a, [0, 0.22, 0.2], [0.3, 0.16, 0.2]);
  p(g, 'arc', COLORS.ink, [0, 0.36, 0.38], [0.2, 0.15, 0.15], [0, 0, Math.PI]);
  for (const s of [-1, 1]) {
    p(g, 'sph', green, [s * 0.18, 0.54, 0.15], 0.15);
    p(g, 'sph', green, [s * 0.38, 0.1, 0.12], [0.15, 0.1, 0.22]);
    p(g, 'sph', COLORS.blush, [s * 0.3, 0.32, 0.3], [0.06, 0.04, 0.03]);
  }
  eyes(g, 0.18, 0.58, 0.25, 0.09);
  return g;
}

function lion() {
  const g = group();
  const fur = 0xf2b84b, mane = 0xc8742e;
  p(g, 'sph', fur, [0, 0.28, -0.15], [0.3, 0.27, 0.35]);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    p(g, 'sph', mane, [Math.cos(a) * 0.3, 0.68 + Math.sin(a) * 0.3, 0.02], 0.15);
  }
  p(g, 'sph', fur, [0, 0.66, 0.13], 0.27);
  p(g, 'sph', 0xffe3a8, [0, 0.58, 0.36], [0.14, 0.1, 0.08]);
  p(g, 'sph', COLORS.ink, [0, 0.63, 0.42], [0.05, 0.035, 0.03]);
  for (const s of [-1, 1]) {
    p(g, 'sph', fur, [s * 0.2, 0.9, 0.12], 0.07);
    p(g, 'sph', fur, [s * 0.14, 0.05, 0.12], 0.08);
  }
  eyes(g, 0.1, 0.73, 0.35, 0.05);
  return g;
}

function bee() {
  const g = group();
  // Side view: body along x.
  p(g, 'sph', 0xffd23f, [0, 0.5, 0], [0.42, 0.32, 0.32]);
  p(g, 'sph', COLORS.ink, [0.12, 0.5, 0], [0.05, 0.31, 0.31]);
  p(g, 'sph', COLORS.ink, [-0.1, 0.5, 0], [0.05, 0.316, 0.316]);
  p(g, 'sph', COLORS.ink, [0.44, 0.52, 0], 0.18);
  p(g, 'cone', COLORS.ink, [-0.47, 0.5, 0], [0.06, 0.14, 0.06], [0, 0, Math.PI / 2]);
  p(g, 'sph', 0xe8f6ff, [0.02, 0.88, 0.04], [0.12, 0.22, 0.03], [0, 0, 0.35]);
  p(g, 'sph', 0xe8f6ff, [-0.14, 0.86, -0.04], [0.12, 0.2, 0.03], [0, 0, 0.6]);
  for (const s of [-1, 1]) p(g, 'cyl', COLORS.ink, [0.5 + s * 0.04, 0.76, s * 0.04], [0.012, 0.18, 0.012], [0, 0, -0.4]);
  p(g, 'sph', COLORS.white, [0.5, 0.56, 0.14], 0.055);
  p(g, 'sph', COLORS.ink, [0.52, 0.56, 0.18], 0.03);
  return g;
}

function rabbit() {
  const g = group();
  const fur = 0xece6f4;
  p(g, 'sph', fur, [0, 0.3, 0], [0.32, 0.3, 0.3]);
  p(g, 'sph', fur, [0, 0.62, 0.1], 0.24);
  p(g, 'sph', COLORS.white, [0, 0.25, -0.3], 0.1);
  p(g, 'sph', PINK_NOSE, [0, 0.6, 0.33], 0.035);
  p(g, 'box', COLORS.white, [0, 0.52, 0.32], [0.07, 0.06, 0.02]);
  for (const s of [-1, 1]) {
    p(g, 'sph', fur, [s * 0.09, 1.0, 0.05], [0.07, 0.25, 0.05], [0, 0, -s * 0.1]);
    p(g, 'sph', 0xffc2d0, [s * 0.09, 1.0, 0.09], [0.04, 0.19, 0.02], [0, 0, -s * 0.1]);
    p(g, 'sph', fur, [s * 0.15, 0.05, 0.18], [0.09, 0.06, 0.14]);
  }
  eyes(g, 0.09, 0.68, 0.29, 0.05);
  return g;
}

function mouse() {
  const g = group();
  const fur = 0xa9a3b8;
  p(g, 'sph', fur, [0, 0.3, -0.05], [0.32, 0.28, 0.38]);
  p(g, 'sph', fur, [0, 0.5, 0.25], [0.22, 0.2, 0.26]);
  p(g, 'arc', 0xffb3c1, [0.15, 0.1, -0.42], [0.18, 0.18, 0.1], [Math.PI / 2, 0, 0]);
  p(g, 'sph', PINK_NOSE, [0, 0.5, 0.5], 0.04);
  for (const s of [-1, 1]) {
    p(g, 'sph', fur, [s * 0.2, 0.72, 0.2], [0.15, 0.15, 0.04]);
    p(g, 'sph', 0xffc2d0, [s * 0.2, 0.72, 0.23], [0.1, 0.1, 0.02]);
    p(g, 'cyl', COLORS.ink, [s * 0.12, 0.48, 0.46], [0.006, 0.2, 0.006], [0, 0, Math.PI / 2 + s * 0.15]);
  }
  eyes(g, 0.08, 0.57, 0.42, 0.04);
  return g;
}

function hen() {
  const g = group();
  const red = 0xff4b4b;
  p(g, 'sph', COLORS.white, [0, 0.38, -0.05], [0.36, 0.33, 0.4]);
  p(g, 'sph', COLORS.white, [0, 0.56, -0.38], [0.13, 0.2, 0.08], [-0.5, 0, 0]);
  p(g, 'sph', COLORS.white, [0, 0.75, 0.16], 0.2);
  for (const [y, z] of [[0.97, 0.08], [1.0, 0.17], [0.96, 0.26]]) p(g, 'sph', red, [0, y, z], 0.065);
  p(g, 'cone', 0xffa22a, [0, 0.72, 0.4], [0.06, 0.12, 0.06], [Math.PI / 2, 0, 0]);
  p(g, 'sph', red, [0, 0.62, 0.32], [0.04, 0.07, 0.04]);
  for (const s of [-1, 1]) p(g, 'cyl', 0xffa22a, [s * 0.12, 0.05, 0], [0.03, 0.12, 0.03]);
  eyes(g, 0.09, 0.79, 0.3, 0.04);
  return g;
}

function fish(color = 0xff8c2a) {
  const g = group();
  // Side view: swims toward +x.
  p(g, 'sph', color, [0, 0.45, 0], [0.42, 0.3, 0.14]);
  p(g, 'sph', COLORS.white, [-0.05, 0.45, 0], [0.05, 0.28, 0.145]);
  p(g, 'cone', color, [-0.55, 0.45, 0], [0.24, 0.3, 0.05], [0, 0, -Math.PI / 2]);
  p(g, 'cone', color, [-0.02, 0.76, 0], [0.14, 0.16, 0.04], [0, 0, 0.2]);
  p(g, 'sph', COLORS.white, [0.24, 0.52, 0.11], 0.07);
  p(g, 'sph', COLORS.ink, [0.26, 0.52, 0.16], 0.04);
  return g;
}

// ---------- things ----------

function apple(scale = 1) {
  const g = group();
  p(g, 'sph', 0xff4b4b, [0, 0.38, 0], [0.38, 0.35, 0.38]);
  p(g, 'cyl', COLORS.trunk, [0, 0.78, 0], [0.025, 0.14, 0.025]);
  p(g, 'sph', COLORS.leaf, [0.1, 0.8, 0], [0.1, 0.04, 0.06], [0, 0, 0.5]);
  g.scale.setScalar(scale);
  return g;
}

function banana() {
  const g = group();
  // A smile-shaped arc facing the camera.
  const b = p(g, 'banana', 0xffe14a, [0, 0.58, 0], 1, [0, 0, Math.PI + Math.PI * 0.125]);
  b.scale.set(1, 1, 1);
  p(g, 'sph', 0x8a5a33, [-0.39, 0.42, 0], 0.07);
  p(g, 'sph', 0x8a5a33, [0.39, 0.42, 0], 0.05);
  return g;
}

function pear() {
  const g = group();
  const c = 0xc6dd4a;
  p(g, 'sph', c, [0, 0.3, 0], 0.3);
  p(g, 'sph', c, [0, 0.6, 0], [0.18, 0.22, 0.18]);
  p(g, 'cyl', COLORS.trunk, [0, 0.86, 0], [0.025, 0.12, 0.025]);
  return g;
}

function carrot() {
  const g = group();
  const c = group();
  p(c, 'cone', 0xff8c2a, [0, -0.1, 0], [0.16, 0.8, 0.16], [Math.PI, 0, 0]);
  for (const a of [-0.45, 0, 0.45]) p(c, 'cone', COLORS.leaf, [Math.sin(a) * 0.08, 0.42, 0], [0.05, 0.28, 0.05], [0, 0, -a]);
  c.position.set(0, 0.5, 0);
  c.rotation.z = 0.8;
  g.add(c);
  return g;
}

function bone() {
  const g = group();
  const c = 0xfff7e6;
  p(g, 'cyl', c, [0, 0.4, 0], [0.09, 0.66, 0.09], [0, 0, Math.PI / 2]);
  for (const s of [-1, 1]) for (const t of [-1, 1]) p(g, 'sph', c, [s * 0.35, 0.4 + t * 0.08, 0], 0.12);
  return g;
}

function cheese() {
  const g = group();
  const c = group();
  p(c, 'wedge', 0xffcf3a, [0, 0.21, 0]);
  // Holes on the top face.
  for (const [a, r, s] of [[0.3, 0.25, 0.06], [0.8, 0.42, 0.05], [0.55, 0.15, 0.04], [1.0, 0.25, 0.045]]) {
    p(c, 'sph', 0xe0a820, [Math.sin(a) * r, 0.42, Math.cos(a) * r], [s, 0.012, s]);
  }
  // Point the tip at the card and the round rind at the camera.
  c.rotation.y = -Math.PI / 4.8;
  c.position.set(0, 0, -0.3);
  g.add(c);
  return g;
}

function flower(color = 0xff7eb6) {
  const g = group();
  p(g, 'cyl', COLORS.grassDark, [0, 0.3, 0], [0.035, 0.6, 0.035]);
  for (const s of [-1, 1]) p(g, 'sph', COLORS.leaf, [s * 0.11, 0.28, 0], [0.12, 0.045, 0.06], [0, 0, s * 0.4]);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    p(g, 'sph', color, [Math.cos(a) * 0.17, 0.76 + Math.sin(a) * 0.17, 0.02], [0.12, 0.12, 0.05]);
  }
  p(g, 'sph', 0xffd23f, [0, 0.76, 0.06], [0.1, 0.1, 0.06]);
  return g;
}

function egg() {
  const g = group();
  p(g, 'nest', 0xa0704a, [0, 0.1, 0], 1, [Math.PI / 2, 0, 0]);
  p(g, 'sph', 0xfff3dc, [0, 0.4, 0], [0.26, 0.34, 0.26]);
  return g;
}

function umbrella() {
  const g = group();
  const u = group();
  p(u, 'dome', 0xff5d73, [0, 0.62, 0], [0.5, 0.3, 0.5]);
  p(u, 'sph', 0xffd23f, [0, 0.93, 0], 0.04);
  p(u, 'cyl', COLORS.ink, [0, 0.33, 0], [0.025, 0.6, 0.025]);
  p(u, 'arc', COLORS.ink, [0.07, 0.04, 0], [0.07, 0.07, 0.15], [0, 0, Math.PI]);
  u.rotation.z = -0.2;
  g.add(u);
  return g;
}

function rainCloud() {
  const g = group();
  for (const [x, y, r] of [[-0.25, 0.74, 0.2], [0, 0.82, 0.27], [0.25, 0.74, 0.2], [0, 0.68, 0.2]]) p(g, 'sph', 0xdfe6f2, [x, y, 0], r);
  for (const [x, y] of [[-0.22, 0.38], [0, 0.28], [0.22, 0.4], [-0.1, 0.1], [0.12, 0.12]]) p(g, 'sph', 0x3aa6e0, [x, y, 0.05], [0.045, 0.075, 0.045]);
  return g;
}

function ball(color = 0x3d7bff, scale = 1) {
  const g = group();
  p(g, 'sph', color, [0, 0.4, 0], 0.4);
  p(g, 'ring', COLORS.white, [0, 0.4, 0], [0.405, 0.405, 0.6], [0, Math.PI / 2, 0]);
  p(g, 'ring', COLORS.white, [0, 0.4, 0], [0.405, 0.405, 0.6], [Math.PI / 2, 0, 0]);
  g.scale.setScalar(scale);
  return g;
}

function star(color = COLORS.gold) {
  const g = group();
  const s = makeStar(color);
  s.position.y = 0.5;
  s.scale.setScalar(1.2);
  g.add(s);
  return g;
}

function heart(color = 0xff5d9e) {
  const g = group();
  p(g, 'heart', color, [0, 0.45, 0], 0.95);
  return g;
}

function block(color = 0x3d7bff) {
  const g = group();
  p(g, 'box', color, [0, 0.35, 0], 0.7);
  return g;
}

function sphere(color = 0x3d7bff) {
  const g = group();
  p(g, 'sph', color, [0, 0.38, 0], 0.38);
  return g;
}

function car(color = 0x3d7bff) {
  const g = group();
  // Side view: drives toward +x.
  p(g, 'box', color, [0, 0.3, 0], [0.95, 0.3, 0.5]);
  p(g, 'box', color, [-0.06, 0.53, 0], [0.52, 0.26, 0.46]);
  p(g, 'box', 0xbfe9ff, [-0.06, 0.55, 0], [0.42, 0.18, 0.48]);
  p(g, 'sph', 0xffe47a, [0.47, 0.32, 0.16], 0.05);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    p(g, 'cyl', COLORS.ink, [sx * 0.3, 0.15, sz * 0.24], [0.15, 0.08, 0.15], [Math.PI / 2, 0, 0]);
    p(g, 'cyl', COLORS.white, [sx * 0.3, 0.15, sz * 0.285], [0.06, 0.01, 0.06], [Math.PI / 2, 0, 0]);
  }
  return g;
}

function balloon(color = 0x9b5de5) {
  const g = group();
  p(g, 'sph', color, [0, 0.66, 0], [0.28, 0.34, 0.28]);
  p(g, 'cone', color, [0, 0.3, 0], [0.05, 0.07, 0.05]);
  p(g, 'cyl', COLORS.ink, [0, 0.13, 0], [0.008, 0.26, 0.008]);
  return g;
}

function tower(n) {
  const g = group();
  const cols = [0xff5d73, 0x4cc9f0, 0xffc93c, 0x3ddc97, 0x9b5de5, 0xff8c42];
  for (let i = 0; i < n; i++) p(g, 'box', cols[i % cols.length], [0, 0.21 + i * 0.42, 0], 0.4);
  return g;
}

function snake(len) {
  const g = group();
  const span = (len - 1) * 0.2;
  for (let i = 0; i < len; i++) {
    p(g, 'sph', i % 2 ? 0x3ccf5a : 0x7be35e, [-span / 2 + i * 0.2, 0.14 + Math.sin(i * 1.3) * 0.05, 0], 0.13);
  }
  const hx = span / 2 + 0.2;
  p(g, 'sph', 0x3ccf5a, [hx, 0.2, 0], [0.17, 0.15, 0.15]);
  p(g, 'cyl', 0xff4b4b, [hx + 0.2, 0.18, 0], [0.012, 0.12, 0.012], [0, 0, Math.PI / 2]);
  p(g, 'sph', COLORS.white, [hx + 0.05, 0.28, 0.1], 0.05);
  p(g, 'sph', COLORS.ink, [hx + 0.06, 0.28, 0.14], 0.028);
  return g;
}

function face(happy) {
  const g = group();
  p(g, 'cyl', 0xffd23f, [0, 0.45, 0], [0.42, 0.1, 0.42], [Math.PI / 2, 0, 0]);
  for (const s of [-1, 1]) p(g, 'sph', COLORS.ink, [s * 0.14, 0.55, 0.055], [0.05, 0.075, 0.02]);
  // Smile = lower half of an arc; frown = upper half.
  p(g, 'arc', COLORS.ink, [0, happy ? 0.43 : 0.25, 0.055], [0.19, 0.19, 0.12], [0, 0, happy ? Math.PI : 0]);
  return g;
}

function dice(n) {
  const g = group();
  p(g, 'box', COLORS.white, [0, 0.38, 0], 0.76);
  const o = 0.2;
  const spots = {
    1: [[0, 0]], 2: [[-o, o], [o, -o]], 3: [[-o, o], [0, 0], [o, -o]],
    4: [[-o, o], [o, o], [-o, -o], [o, -o]], 5: [[-o, o], [o, o], [0, 0], [-o, -o], [o, -o]],
    6: [[-o, o], [o, o], [-o, 0], [o, 0], [-o, -o], [o, -o]],
  }[n];
  for (const [x, y] of spots) p(g, 'sph', COLORS.ink, [x, 0.38 + y, 0.385], [0.075, 0.075, 0.02]);
  return g;
}

function speaker() {
  const g = group();
  const c = 0x6b4fd8;
  p(g, 'box', c, [-0.28, 0.5, 0], [0.2, 0.28, 0.24]);
  p(g, 'cone', c, [-0.1, 0.5, 0], [0.28, 0.32, 0.22], [0, 0, Math.PI / 2]);
  for (const r of [0.22, 0.38]) p(g, 'arc', c, [0.02, 0.5, 0], [r, r, 0.2], [0, 0, -Math.PI / 2]);
  return g;
}

function paintBlob(color) {
  const g = group();
  p(g, 'sph', color, [0, 0.45, 0], [0.42, 0.36, 0.1]);
  for (const [x, y, r] of [[0.45, 0.72, 0.09], [-0.48, 0.3, 0.1], [0.38, 0.12, 0.07], [-0.3, 0.82, 0.07]]) p(g, 'sph', color, [x, y, 0], [r, r, 0.06]);
  return g;
}

function qmark() {
  const g = group();
  const m = new THREE.Mesh(GEO.plane(), glyphMaterial('?', { fg: '#ffffff', stroke: '#6b4fd8' }));
  m.position.set(0, 0.5, 0.05);
  m.scale.setScalar(1.05);
  g.add(m);
  return g;
}

/** A gold arrow above a picture, pointing down at it. */
function pointAt(obj, height = 1.15) {
  p(obj, 'cone', toon(COLORS.gold, { emissive: 0x332200 }), [0, height / obj.scale.y, 0], [0.16, 0.26, 0.16].map((v) => v / obj.scale.y), [Math.PI, 0, 0]);
  return obj;
}

const scaled = (obj, s) => { obj.scale.multiplyScalar(s); return obj; };

// ---------- puzzle helpers ----------

const COLORS7 = { red: 0xff3b3b, blue: 0x3d7bff, yellow: 0xffd23f, green: 0x3ccf5a, purple: 0x9b5de5, orange: 0xff8c1a, pink: 0xff8fd0 };
/** Three different numbers from 1..6 other than n. */
function otherCounts(n) { return shuffle([1, 2, 3, 4, 5, 6].filter((k) => k !== n)).slice(0, 3); }
function otherColors(name) { return shuffle(Object.keys(COLORS7).filter((k) => k !== name)).slice(0, 3).map((k) => COLORS7[k]); }

const ANIMALS = { cow, pig, sheep, duck, cat, dog, frog, lion, mouse, hen, rabbit };
function otherAnimals(name) { return shuffle(Object.keys(ANIMALS).filter((k) => k !== name)).slice(0, 3).map((k) => ANIMALS[k]()); }

// Partners for "what goes with this"; each partner belongs to one prompt only.
const PARTNERS = { dog: bone, cat: () => fish(), mouse: cheese, bee: () => flower(), rabbit: carrot, hen: egg, rain: umbrella };
const AVOID = { rabbit: ['bee'], cat: [], dog: [] };
function goes(key) {
  return () => {
    const others = shuffle(Object.keys(PARTNERS).filter((k) => k !== key && !(AVOID[key] || []).includes(k))).slice(0, 3);
    return [PARTNERS[key](), ...others.map((k) => PARTNERS[k]())];
  };
}

/** Count puzzle: n copies of a picture on the board, dice faces as answers. */
function count(make, lo, hi) {
  return () => {
    const n = lo + Math.floor(Math.random() * (hi - lo + 1));
    return {
      prompt: Array.from({ length: n }, (_, i) => make(i)),
      answers: [dice(n), ...otherCounts(n).map(dice)],
    };
  };
}

/** Size puzzle: same picture at four sizes; the board shows a small and a big one with an arrow at the target. */
function sized(make, biggest) {
  return () => {
    const sizes = biggest ? [1.3, 0.55, 0.78, 1.0] : [0.5, 0.78, 1.0, 1.25];
    const small = scaled(make(), 0.55), big = scaled(make(), 1.05);
    pointAt(biggest ? big : small, biggest ? 1.25 : 0.85);
    return { prompt: [small, big], answers: sizes.map((s) => scaled(make(), s)) };
  };
}

function colored(make, name) {
  return () => ({ prompt: [paintBlob(COLORS7[name])], answers: [make(COLORS7[name]), ...otherColors(name).map((c) => make(c))] });
}

function sound(name) {
  return () => ({ prompt: [speaker()], answers: [ANIMALS[name](), ...otherAnimals(name)] });
}

const ODD_SAY = ['Which one is different?', 'Hvilken er annerledes?'];
const odd = (same, diff) => () => ({ answers: [diff(), same(0), same(1), same(2)] });

// ---------- the puzzles ----------
// Each: { type, say: [en, no], make() -> { prompt?: Object3D[], answers: Object3D[4] } }, answers[0] is right.
// Answers are placed in random zones by the round; prompts sit on a board behind the stage.

const R = COLORS7;
export const PICTURE_PUZZLES = [
  // Which one is different?
  { type: 'odd', say: ODD_SAY, make: odd(() => apple(), banana) },
  { type: 'odd', say: ODD_SAY, make: odd(duck, pig) },
  { type: 'odd', say: ODD_SAY, make: odd(() => ball(R.blue), () => ball(R.red)) },
  { type: 'odd', say: ODD_SAY, make: odd(() => star(COLORS.gold), () => heart(COLORS.gold)) },
  { type: 'odd', say: ODD_SAY, make: odd(() => block(R.blue), () => sphere(R.blue)) },
  { type: 'odd', say: ODD_SAY, make: odd(() => face(true), () => face(false)) },
  { type: 'odd', say: ['Which one can you NOT eat?', 'Hvilken kan du IKKE spise?'], make: odd((i) => [apple, pear, banana][i](), () => car(R.red)) },
  { type: 'odd', say: ['Which one is NOT an animal?', 'Hvilken er IKKE et dyr?'], make: odd((i) => [cat, dog, cow][i](), () => ball(R.orange)) },
  // How many?
  { type: 'count', say: ['How many ducks can you see?', 'Hvor mange ender ser du?'], make: count(duck, 2, 4) },
  { type: 'count', say: ['How many apples can you see?', 'Hvor mange epler ser du?'], make: count(() => apple(), 3, 6) },
  { type: 'count', say: ['How many stars can you see?', 'Hvor mange stjerner ser du?'], make: count(() => star(), 2, 5) },
  { type: 'count', say: ['How many fish can you see?', 'Hvor mange fisker ser du?'], make: count(() => fish(), 1, 4) },
  { type: 'count', say: ['How many balloons can you see?', 'Hvor mange ballonger ser du?'], make: count((i) => balloon(Object.values(R)[i % 7]), 3, 6) },
  { type: 'count', say: ['How many frogs can you see?', 'Hvor mange frosker ser du?'], make: count(frog, 1, 5) },
  // What goes with this?
  { type: 'goes', say: ['What goes with the dog?', 'Hva hører sammen med hunden?'], prompt: dog, make: goes('dog') },
  { type: 'goes', say: ['What goes with the cat?', 'Hva hører sammen med katten?'], prompt: cat, make: goes('cat') },
  { type: 'goes', say: ['What goes with the mouse?', 'Hva hører sammen med musa?'], prompt: mouse, make: goes('mouse') },
  { type: 'goes', say: ['What goes with the bee?', 'Hva hører sammen med bia?'], prompt: bee, make: goes('bee') },
  { type: 'goes', say: ['What goes with the rabbit?', 'Hva hører sammen med kaninen?'], prompt: rabbit, make: goes('rabbit') },
  { type: 'goes', say: ['What goes with the hen?', 'Hva hører sammen med høna?'], prompt: hen, make: goes('hen') },
  { type: 'goes', say: ['What do you need when it rains?', 'Hva trenger du når det regner?'], prompt: rainCloud, make: goes('rain') },
  // Bigger / smaller
  { type: 'size', say: ['Which ball is the biggest?', 'Hvilken ball er størst?'], make: sized(() => ball(R.red), true) },
  { type: 'size', say: ['Which apple is the smallest?', 'Hvilket eple er minst?'], make: sized(() => apple(), false) },
  { type: 'size', say: ['Which fish is the biggest?', 'Hvilken fisk er størst?'], make: sized(() => fish(0x4cc9f0), true) },
  { type: 'size', say: ['Which duck is the smallest?', 'Hvilken and er minst?'], make: sized(duck, false) },
  {
    type: 'size', say: ['Which tower is the tallest?', 'Hvilket tårn er høyest?'],
    make: () => ({ prompt: [tower(1), pointAt(tower(3), 1.55)], answers: [tower(4), tower(1), tower(2), tower(3)] }),
  },
  {
    type: 'size', say: ['Which snake is the shortest?', 'Hvilken slange er kortest?'],
    make: () => ({ prompt: [pointAt(snake(2), 0.75), snake(6)], answers: [snake(2), snake(4), snake(5), snake(7)] }),
  },
  // Which color?
  { type: 'color', say: ['Where is the red ball?', 'Hvor er den røde ballen?'], make: colored(ball, 'red') },
  { type: 'color', say: ['Where is the blue car?', 'Hvor er den blå bilen?'], make: colored(car, 'blue') },
  { type: 'color', say: ['Where is the yellow star?', 'Hvor er den gule stjerna?'], make: colored(star, 'yellow') },
  { type: 'color', say: ['Where is the purple balloon?', 'Hvor er den lilla ballongen?'], make: colored(balloon, 'purple') },
  { type: 'color', say: ['Where is the orange fish?', 'Hvor er den oransje fisken?'], make: colored(fish, 'orange') },
  { type: 'color', say: ['Where is the pink heart?', 'Hvor er det rosa hjertet?'], make: colored(heart, 'pink') },
  { type: 'color', say: ['Where is the green block?', 'Hvor er den grønne klossen?'], make: colored(block, 'green') },
  // What comes next?
  {
    type: 'pattern', say: ['What comes next?', 'Hva kommer etterpå?'],
    make: () => ({ prompt: [ball(R.red), ball(R.blue), ball(R.red), ball(R.blue), qmark()], answers: [ball(R.red), ball(R.blue), ball(R.green), ball(R.yellow)] }),
  },
  {
    type: 'pattern', say: ['What comes next?', 'Hva kommer etterpå?'],
    make: () => ({ prompt: [star(), heart(), star(), heart(), qmark()], answers: [star(), heart(), ball(R.orange), block(R.purple)] }),
  },
  {
    type: 'pattern', say: ['What comes next?', 'Hva kommer etterpå?'],
    make: () => ({ prompt: [duck(), cat(), duck(), cat(), duck(), qmark()], answers: [cat(), duck(), pig(), dog()] }),
  },
  {
    type: 'pattern', say: ['What comes next?', 'Hva kommer etterpå?'],
    make: () => ({ prompt: [apple(1.15), apple(0.6), apple(1.15), apple(0.6), qmark()], answers: [apple(1.2), apple(0.6), banana(), pear()] }),
  },
  {
    type: 'pattern', say: ['What comes next?', 'Hva kommer etterpå?'],
    make: () => ({ prompt: [tower(1), tower(2), tower(3), qmark()], answers: [tower(4), tower(1), tower(2), tower(3)] }),
  },
  {
    type: 'pattern', say: ['What comes next?', 'Hva kommer etterpå?'],
    make: () => ({ prompt: [ball(R.red), ball(R.red), ball(R.blue), ball(R.red), ball(R.red), qmark()], answers: [ball(R.blue), ball(R.red), ball(R.green), ball(R.yellow)] }),
  },
  {
    type: 'pattern', say: ['What comes next?', 'Hva kommer etterpå?'],
    make: () => ({ prompt: [apple(), banana(), pear(), apple(), banana(), qmark()], answers: [pear(), apple(), banana(), carrot()] }),
  },
  // Which animal says this?
  { type: 'sound', say: ['Which animal says "moo"?', 'Hvilket dyr sier «mø»?'], make: sound('cow') },
  { type: 'sound', say: ['Which animal says "oink oink"?', 'Hvilket dyr sier «nøff nøff»?'], make: sound('pig') },
  { type: 'sound', say: ['Which animal says "baa"?', 'Hvilket dyr sier «bæ»?'], make: sound('sheep') },
  { type: 'sound', say: ['Which animal says "quack quack"?', 'Hvilket dyr sier «rapp rapp»?'], make: sound('duck') },
  { type: 'sound', say: ['Which animal says "meow"?', 'Hvilket dyr sier «mjau»?'], make: sound('cat') },
  { type: 'sound', say: ['Which animal says "woof woof"?', 'Hvilket dyr sier «voff voff»?'], make: sound('dog') },
  { type: 'sound', say: ['Which animal says "ribbit"?', 'Hvilket dyr sier «kvekk kvekk»?'], make: sound('frog') },
  { type: 'sound', say: ['Which animal goes "roar"?', 'Hvilket dyr brøler «rooaarr»?'], make: sound('lion') },
];

const strings = { en: {}, no: {} };
PICTURE_PUZZLES.forEach((q, i) => {
  q.key = `quiz.p${i}`;
  strings.en[q.key] = q.say[0];
  strings.no[q.key] = q.say[1];
});
addStrings(strings);

/** Builds a puzzle's pictures: { prompt: Object3D[] | null, answers: Object3D[4] } with answers[0] right. */
export function buildPuzzle(q) {
  const out = q.make();
  if (Array.isArray(out)) return { prompt: q.prompt ? [q.prompt(), qmark()] : null, answers: out };
  return { prompt: out.prompt || null, answers: out.answers };
}

/**
 * Picks n picture puzzles: as many different types as possible, never the same type twice in a row,
 * in random order.
 */
export function pickPuzzles(n) {
  const byType = new Map();
  for (const q of shuffle(PICTURE_PUZZLES)) {
    if (!byType.has(q.type)) byType.set(q.type, []);
    byType.get(q.type).push(q);
  }
  const out = [];
  let last = null;
  while (out.length < n) {
    // Fill rounds of distinct types; the first type of a new round must differ from the last one used.
    const types = shuffle([...byType.keys()].filter((k) => byType.get(k).length));
    if (!types.length) break;
    if (types.length > 1 && types[0] === last) types.push(types.shift());
    for (const k of types) {
      if (out.length >= n) break;
      out.push(byType.get(k).pop());
      last = k;
    }
  }
  return out;
}

/** Picture for the mode vote zones. */
export function modeIcon(mode) {
  if (mode === 'pics') {
    const g = group();
    const d = duck(); d.position.x = -0.32; d.scale.setScalar(0.85);
    const a = apple(0.75); a.position.x = 0.42;
    g.add(d, a);
    return g;
  }
  if (mode === 'mixed') {
    const g = group();
    const d = duck(); d.position.x = -0.38; d.scale.setScalar(0.8);
    const q = qmark(); q.position.x = 0.4; q.scale.setScalar(0.8);
    g.add(d, q);
    return g;
  }
  if (mode === 'classic') return qmark();
  const g = group();
  const hat = makeHat(5);
  hat.scale.setScalar(2.2);
  hat.position.y = 0.1;
  g.add(hat);
  return g;
}

