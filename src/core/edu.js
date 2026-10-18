import * as THREE from 'three';
import { esc } from './ui.js';

// Shared pieces for the educational games (Norwegian bokmål).

export const LEVELS = [
  { key: 'easy', name: 'Lett' },
  { key: 'medium', name: 'Middels' },
  { key: 'hard', name: 'Vanskelig' },
];

const texCache = new Map();

/** Big chunky glyph on a transparent canvas, for letters and numbers in 3D. */
export function glyphTexture(text, { fg = '#ffffff', stroke = '#2b2340', size = 256, disc = null } = {}) {
  const key = `${text}|${fg}|${stroke}|${disc}`;
  let tex = texCache.get(key);
  if (tex) return tex;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  if (disc) {
    g.fillStyle = disc;
    g.beginPath();
    g.arc(size / 2, size / 2, size * 0.47, 0, Math.PI * 2);
    g.fill();
  }
  const fs = text.length > 2 ? size * 0.42 : text.length > 1 ? size * 0.52 : size * 0.64;
  g.font = `700 ${fs}px Fredoka, "Trebuchet MS", sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  g.lineWidth = size * 0.07;
  g.strokeStyle = stroke;
  g.strokeText(text, size / 2, size * 0.54);
  g.fillStyle = fg;
  g.fillText(text, size / 2, size * 0.54);
  tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.userData.shared = true;
  texCache.set(key, tex);
  return tex;
}

const matCache = new Map();
/** Shared transparent material showing a glyph; never disposed. */
export function glyphMaterial(text, opts = {}) {
  const key = `${text}|${JSON.stringify(opts)}`;
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ map: glyphTexture(text, opts), transparent: true, depthWrite: false });
    m.userData.shared = true;
    matCache.set(key, m);
  }
  return m;
}

/** Make sure Fredoka is ready before drawing glyphs onto canvases. */
export function fontsReady() {
  if (!document.fonts?.load) return Promise.resolve();
  return document.fonts.load('700 64px Fredoka').catch(() => {});
}

let voice = null;
let voiceChecked = false;
/** Says a word in Norwegian if the device has a Norwegian voice; otherwise stays quiet. */
export function speak(text) {
  const synth = window.speechSynthesis;
  if (!synth) return;
  if (!voiceChecked || !voice) {
    const voices = synth.getVoices();
    voice = voices.find((v) => /^(nb|no|nn)(-|_|$)/i.test(v.lang)) || null;
    voiceChecked = voices.length > 0;
  }
  if (!voice) return;
  const u = new SpeechSynthesisUtterance(text.toLowerCase());
  u.voice = voice;
  u.lang = voice.lang;
  u.rate = 0.9;
  synth.cancel();
  synth.speak(u);
}

/**
 * Per-player difficulty picker. Resolves once every player has confirmed.
 * Each player's choice is remembered on the roster player for the session.
 */
export function chooseLevels(scene, title) {
  const ui = scene.game.ui;
  const players = scene.players;
  const state = new Map(players.map((p) => [p, { level: p.eduLevel ?? 0, done: false }]));
  const el = ui.panel('', 'panel picker');
  const render = () => {
    const cards = players.map((p) => {
      const st = state.get(p);
      const opts = LEVELS.map((lv, i) => `<span class="edu-opt ${i === st.level ? 'on' : ''}">${lv.name}</span>`).join('');
      return `<div class="edu-pick ${st.done ? 'done' : ''}" style="--c:${p.css}">
        <div class="edu-pick-name">${esc(p.name)}${st.done ? ' ✓' : ''}</div><div class="edu-opts">${opts}</div></div>`;
    }).join('');
    el.innerHTML = `<div class="edu-badge">LÆRING</div><div class="results-title">${esc(title)}</div>
      <div class="results-sub">Velg nivå med pinnen · trykk hopp når du er klar</div>
      <div class="edu-pick-row">${cards}</div>`;
  };
  render();
  return new Promise((resolve) => {
    scene.pickLevels = () => {
      let changed = false;
      for (const p of players) {
        const d = scene.input(p);
        const st = state.get(p);
        if (!d) continue;
        const dir = d.stepX;
        if (!st.done && dir) {
          st.level = THREE.MathUtils.clamp(st.level + dir, 0, LEVELS.length - 1);
          scene.game.audio.play('select');
          changed = true;
        }
        if (d.aPressed) {
          st.done = !st.done;
          scene.game.audio.play(st.done ? 'join' : 'select');
          changed = true;
        }
      }
      if (changed) render();
      if ([...state.values()].every((s) => s.done)) {
        scene.pickLevels = null;
        el.remove();
        for (const p of players) p.eduLevel = state.get(p).level;
        resolve();
      }
    };
  });
}

export function shuffle(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const pick = (list) => list[Math.floor(Math.random() * list.length)];

/**
 * Draws gen() until ok(value) holds, at most `tries` times; null if nothing matched.
 * The learning games use it to pick the next task among answers that are already
 * on the field, keeping the task generator's own mix of easy and hard tasks. If they
 * spawned the answer fresh instead, the right item would nearly always be the newest.
 */
export function drawMatching(gen, ok, tries = 400) {
  for (let i = 0; i < tries; i++) {
    const v = gen();
    if (ok(v)) return v;
  }
  return null;
}
