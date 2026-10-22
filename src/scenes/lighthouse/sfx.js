import { SONGS } from '../../core/audio.js';

// Songs and a few extra sound effects for Lighthouse Caves, built on the shared synthesizer
// (AudioEngine.tone / noise). Songs are added to SONGS once, next to the built-in ones.

SONGS.lhOver ??= { bpm: 112, root: 62, chords: [0, 5, 7, 5], seed: 77, lead: 'triangle' };
SONGS.lhCave ??= { bpm: 84, root: 57, chords: [0, 3, 5, 3], seed: 91, lead: 'sine' };
SONGS.lhDungeon ??= { bpm: 96, root: 55, chords: [0, 3, 8, 7], seed: 123, lead: 'square' };
SONGS.lhBoss ??= { bpm: 150, root: 52, chords: [0, 1, 0, 6], seed: 201, lead: 'square' };

const NOTE = (m) => 440 * Math.pow(2, (m - 69) / 12);

/** Play a Lighthouse sound: built-in names pass through to audio.play(). */
export function sfx(audio, name) {
  if (!audio?.ctx || audio.muted) return;
  const r = 1 + (Math.random() - 0.5) * 0.1;
  switch (name) {
    case 'swing': audio.noise(0.12, { vol: 0.12, freq: 2400 * r, q: 0.8 }); break;
    case 'spin': audio.noise(0.35, { vol: 0.16, freq: 1600, q: 0.6 }); audio.tone(500, 0.3, { type: 'triangle', vol: 0.06, slide: 2 }); break;
    case 'charged': audio.tone(NOTE(84), 0.1, { type: 'sine', vol: 0.1 }); audio.tone(NOTE(91), 0.12, { type: 'sine', vol: 0.08, delay: 0.06 }); break;
    case 'hit': audio.tone(220 * r, 0.08, { type: 'square', vol: 0.1, slide: 0.5 }); audio.noise(0.06, { vol: 0.12, freq: 900 }); break;
    case 'clang': audio.tone(1400 * r, 0.12, { type: 'square', vol: 0.06, slide: 0.9 }); audio.tone(2100 * r, 0.1, { type: 'sine', vol: 0.05 }); break;
    case 'hurt': audio.tone(300, 0.2, { type: 'square', vol: 0.1, slide: 0.4 }); break;
    case 'poof': audio.noise(0.25, { vol: 0.16, freq: 600, q: 0.6, type: 'lowpass' }); audio.tone(500 * r, 0.15, { type: 'sine', vol: 0.08, slide: 0.3 }); break;
    case 'cut': audio.noise(0.1, { vol: 0.12, freq: 3200, q: 1.2 }); break;
    case 'lift': audio.tone(260, 0.1, { type: 'triangle', vol: 0.1, slide: 1.5 }); break;
    case 'shatter': audio.noise(0.2, { vol: 0.18, freq: 2500, q: 0.5 }); audio.tone(900 * r, 0.06, { type: 'square', vol: 0.05, slide: 0.5 }); break;
    case 'push': audio.noise(0.25, { vol: 0.1, freq: 300, q: 0.7, type: 'lowpass' }); break;
    case 'flame': audio.noise(0.3, { vol: 0.12, freq: 1200, q: 0.4 }); audio.tone(180, 0.25, { type: 'sawtooth', vol: 0.03, slide: 1.6 }); break;
    case 'torch': audio.noise(0.4, { vol: 0.12, freq: 800, q: 0.4 }); audio.tone(NOTE(76), 0.15, { type: 'triangle', vol: 0.06, delay: 0.1 }); break;
    case 'rope': audio.tone(700, 0.18, { type: 'triangle', vol: 0.06, slide: 1.8 }); audio.noise(0.15, { vol: 0.06, freq: 2600 }); break;
    case 'hook': audio.tone(1200, 0.08, { type: 'square', vol: 0.06 }); audio.tone(800, 0.1, { type: 'square', vol: 0.05, delay: 0.05 }); break;
    case 'switch': audio.tone(NOTE(81), 0.1, { type: 'square', vol: 0.06 }); audio.tone(NOTE(76), 0.12, { type: 'square', vol: 0.06, delay: 0.08 }); break;
    case 'door': audio.noise(0.35, { vol: 0.14, freq: 260, q: 0.5, type: 'lowpass' }); audio.tone(110, 0.3, { type: 'triangle', vol: 0.12, slide: 0.8 }); break;
    case 'unlock': audio.tone(NOTE(72), 0.08, { type: 'square', vol: 0.06 }); audio.tone(NOTE(79), 0.14, { type: 'square', vol: 0.06, delay: 0.08 }); audio.noise(0.2, { vol: 0.1, freq: 400, delay: 0.1 }); break;
    case 'chest': [0, 4, 7, 11, 12].forEach((n, i) => audio.tone(NOTE(67 + n), 0.12, { type: 'triangle', vol: 0.09, delay: i * 0.07 })); break;
    case 'secret': [0, 5, 9, 12, 17, 21].forEach((n, i) => audio.tone(NOTE(70 + n), 0.16, { type: 'triangle', vol: 0.09, delay: i * 0.09 })); break;
    case 'item': [[0, 0], [4, 0.14], [7, 0.28], [12, 0.42], [7, 0.62], [16, 0.76]].forEach(([n, d]) => audio.tone(NOTE(72 + n), d > 0.7 ? 0.6 : 0.16, { type: 'square', vol: 0.06, delay: d })); break;
    case 'heart': audio.tone(NOTE(84), 0.08, { type: 'sine', vol: 0.12 }); audio.tone(NOTE(88), 0.12, { type: 'sine', vol: 0.1, delay: 0.07 }); break;
    case 'lowhp': audio.tone(NOTE(88), 0.06, { type: 'square', vol: 0.04 }); break;
    case 'fall': audio.tone(800, 0.6, { type: 'triangle', vol: 0.1, slide: 0.2 }); break;
    case 'shoot': audio.tone(420 * r, 0.1, { type: 'square', vol: 0.06, slide: 0.6 }); break;
    case 'roar': audio.tone(120, 0.6, { type: 'sawtooth', vol: 0.08, slide: 0.6 }); audio.noise(0.5, { vol: 0.1, freq: 300, type: 'lowpass' }); break;
    case 'slam': audio.noise(0.3, { vol: 0.22, freq: 200, q: 0.5, type: 'lowpass' }); audio.tone(70, 0.3, { type: 'sine', vol: 0.2, slide: 0.6 }); break;
    case 'save': [0, 7, 12, 16].forEach((n, i) => audio.tone(NOTE(72 + n), 0.2, { type: 'sine', vol: 0.09, delay: i * 0.1 })); break;
    case 'text': audio.tone(NOTE(79), 0.04, { type: 'square', vol: 0.03 }); break;
    case 'menu': audio.tone(NOTE(76), 0.06, { type: 'triangle', vol: 0.1 }); break;
    default: audio.play(name); break;
  }
}
