import { TYPES, hashUnit } from './voices.js';

// Babble: Animal Crossing-style character voices made with WebAudio, one short syllable per vowel
// group of the line, while the line is on screen. Each voice type has its own timbre (voices.js
// TYPES[type].babble): squeaky sines for tiny creatures, a low sawtooth rumble for gruff sailors,
// square beeps on fixed notes for robots, clicks for crabs. Vowels steer two band-pass "formant"
// filters, so a line sounds a little like "ba-be-bo" speech. Every character also gets its own small
// pitch offset (from its id), so two crabs do not sound exactly alike.

const FORMANTS = { a: [800, 1200], e: [500, 1900], i: [320, 2300], o: [500, 900], u: [350, 800], y: [320, 2000], æ: [700, 1700], ø: [420, 1500], å: [520, 850] };
const MAX_SYL = 36; // long lines babble for a few seconds, not for the whole text
const PENTA = [0, 2, 4, 7, 9, 12, 14]; // robot notes

let current = null; // { out: GainNode, end: seconds (ctx time) }

/** Split text into syllables: [{ v: vowel, pause: seconds after, rise: bool, loud: bool }]. */
export function syllables(text) {
  const s = String(text).toLowerCase().replace(/<[^>]*>/g, ' ');
  const out = [];
  const re = /([aeiouyæøå]+)|([.!?…]+)|([,;:]+)/g;
  let m;
  while ((m = re.exec(s))) {
    if (m[1]) out.push({ v: m[1][0], pause: 0, rise: false, loud: false });
    else if (out.length) {
      const last = out[out.length - 1];
      if (m[2]) { last.pause = 0.16; if (m[2].includes('?')) last.rise = true; if (m[2].includes('!')) last.loud = true; } else last.pause = Math.max(last.pause, 0.08);
    }
  }
  if (out.length > MAX_SYL) {
    // keep the shape: every n-th syllable, plus the last one (its question rise)
    const step = out.length / MAX_SYL;
    const kept = [];
    for (let i = 0; i < MAX_SYL - 1; i++) kept.push(out[Math.floor(i * step)]);
    kept.push(out[out.length - 1]);
    return kept;
  }
  return out;
}

/**
 * Play babble for a line on the given AudioEngine (audio.js). type: a voice type from voices.js,
 * seed: the speaker id. Returns the length in seconds (0 if nothing played).
 */
export function babble(audio, text, type, seed = type) {
  const B = TYPES[type]?.babble;
  if (!B || !audio) return 0;
  audio.ensure?.();
  const ctx = audio.ctx;
  if (!ctx || audio.muted) return 0;
  stopBabble();
  const syl = syllables(text);
  if (!syl.length) syl.push({ v: 'a', pause: 0, rise: false, loud: false });
  const out = ctx.createGain();
  out.gain.value = B.vol ?? 0.5;
  out.connect(audio.sfxBus || ctx.destination);
  const t0 = ctx.currentTime + 0.02;
  const own = 1 + hashUnit(seed, 3) * 0.08; // this character's own pitch
  let t = t0;
  syl.forEach((s, i) => {
    // pitch: a deterministic little melody from the letters and the position in the line
    const k = hashUnit(`${seed}${s.v}${i % 7}`, 4);
    let semis = B.steps ? PENTA[Math.floor((k + 1) * 3.49)] - 4 : k * B.spread;
    if (s.rise) semis += 5;
    if (i === syl.length - 1 && !s.rise) semis -= 2; // statements fall at the end
    const f = B.base * own * 2 ** (semis / 12);
    const dur = B.syl * (0.8 + 0.4 * ((k + 1) / 2));
    if (B.click) click(ctx, out, audio, t, f, dur, s.loud);
    else tone(ctx, out, t, f, dur, B, s);
    t += dur + 0.018 + s.pause;
  });
  current = { out, end: t };
  return t - t0;
}

/** One voiced syllable: an oscillator (through vowel formant filters for most types). */
function tone(ctx, out, t, f, dur, B, s) {
  const o = ctx.createOscillator();
  o.type = B.wave;
  o.frequency.setValueAtTime(f, t);
  if (B.glide && B.glide !== 1) o.frequency.exponentialRampToValueAtTime(f * B.glide, t + dur);
  if (B.detune) o.detune.value = B.detune;
  if (B.vib) {
    const lfo = ctx.createOscillator(), lg = ctx.createGain();
    lfo.frequency.value = 7;
    lg.gain.value = f * B.vib;
    lfo.connect(lg).connect(o.frequency);
    lfo.start(t);
    lfo.stop(t + dur + 0.05);
  }
  const g = ctx.createGain();
  const peak = s.loud ? 0.32 : 0.24;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + 0.012);
  g.gain.setValueAtTime(peak, t + dur * 0.6);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  if (B.formant) {
    const [f1, f2] = FORMANTS[s.v] || FORMANTS.a;
    const mix = ctx.createGain();
    mix.gain.value = 2.2;
    for (const [fq, q, lv] of [[f1, 5, 1], [f2, 7, 0.55]]) {
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = fq;
      bp.Q.value = q;
      const lg = ctx.createGain();
      lg.gain.value = lv;
      o.connect(bp).connect(lg).connect(mix);
    }
    // a little of the raw tone keeps low voices from vanishing on small speakers
    const dry = ctx.createGain();
    dry.gain.value = B.rumble ? 0.35 : 0.15;
    o.connect(dry).connect(mix);
    mix.connect(g);
  } else o.connect(g);
  g.connect(out);
  o.start(t);
  o.stop(t + dur + 0.02);
}

/** A crab syllable: two quick clicks (filtered noise) with a tiny pitched tick. */
function click(ctx, out, audio, t, f, dur, loud) {
  for (const dt of [0, dur * 0.45]) {
    if (audio.noiseBuf) {
      const src = ctx.createBufferSource();
      src.buffer = audio.noiseBuf;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = f * 1.8;
      bp.Q.value = 3;
      const g = ctx.createGain();
      g.gain.setValueAtTime(loud ? 0.9 : 0.6, t + dt);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dt + 0.025);
      src.connect(bp).connect(g).connect(out);
      src.start(t + dt, Math.random() * 0.5, 0.04);
    }
    const o = ctx.createOscillator();
    o.type = 'square';
    o.frequency.value = f;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.08, t + dt);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dt + 0.018);
    o.connect(g).connect(out);
    o.start(t + dt);
    o.stop(t + dt + 0.03);
  }
}

/** Stop the babble that is playing (a new line, or read-aloud switched off). */
export function stopBabble() {
  if (!current) return;
  try { current.out.disconnect(); } catch { /* already gone */ }
  current = null;
}

/** True while babble is still playing (ctx time). */
export function babbling(audio) {
  return !!(current && audio?.ctx && audio.ctx.currentTime < current.end);
}
