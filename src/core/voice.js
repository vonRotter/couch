import { getLang } from './i18n.js';
import { pickVoices, voiceFor, speakerInfo } from './voices.js';
import { babble, stopBabble, babbling } from './babble.js';

// Read-aloud for game text, using the browser's own voices. Off by default on the shared island, on
// by default for new solo profiles; V toggles it. Stays quiet when the device has no voice for the
// current language: an English voice reading Norwegian is worse than silence.
//
// One calm narrator voice (the device's best voice) reads cards, narration, menus, tutorials and
// toasts. Characters speak with a voice type (voices.js: child, grandma, gruff sailor, ...), built
// from the device's other voices plus pitch and rate. B switches characters to babble (babble.js:
// Animal Crossing-style syllables made with WebAudio) while the narrator keeps reading.
//
//   say(text)                         the narrator ('narrator' is the default)
//   say(text, 'isl.hazel')            a character (ids in voices.js SPEAKERS)
//   say(text, { speaker, mood: 'sleepy', force, pitch, rate, lang })
//   say([[line, 'narrator'], [line, 'story.king']])   several parts, one after the other
// Old calls with only { pitch, rate } still work: a character in the friendly voice at that pitch.

let enabled = false;
let babbleOn = false;
let audio = null; // the game's AudioEngine (babble plays on its sfx bus)
let voices = [];
let cache = null; // { key, picked }
let chain = 0; // bumps on every new say(): stale queued parts stop
let chainBusy = false;

/** The last things said (newest last): { text, speaker, type, mode: 'tts' | 'babble' | 'silent', voice, pitch, rate }. */
export const voiceLog = [];

function loadVoices() {
  try { voices = window.speechSynthesis?.getVoices() || []; } catch { voices = []; }
  cache = null;
}
if (typeof window !== 'undefined' && window.speechSynthesis) {
  loadVoices();
  try { window.speechSynthesis.addEventListener('voiceschanged', loadVoices); } catch { /* old browsers */ }
}

export function setVoice(on) {
  enabled = !!on;
  if (!enabled) stopVoice();
}

export function voiceOn() {
  return enabled;
}

/** Characters babble (true) or speak with their voice type (false). The narrator always reads. */
export function setBabble(on) {
  babbleOn = !!on;
}

export function babbleMode() {
  return babbleOn;
}

/** Babble needs the game's audio engine (main.js passes it once). */
export function setVoiceAudio(engine) {
  audio = engine;
}

/** The narrator's and every type's voice for a language ('en' / 'no'), or null if the device has none. */
export function currentVoices(lang = getLang()) {
  if (!voices.length) loadVoices();
  const prefer = typeof navigator !== 'undefined' ? navigator.language || '' : '';
  const key = `${lang}|${voices.length}|${prefer}`;
  if (!cache || cache.key !== key) cache = { key, picked: pickVoices(voices, lang, prefer) };
  return cache.picked;
}

/**
 * Speak (replacing whatever is being said). Returns true if it spoke or babbled.
 * opts: a speaker id string, or { speaker, mood, force, pitch, rate, lang }.
 */
export function say(text, opts = {}) {
  if (typeof opts === 'string') opts = { speaker: opts };
  if ((!enabled && !opts.force) || !text) return false;
  const legacy = opts.speaker == null && (opts.pitch != null || opts.rate != null);
  const parts = (Array.isArray(text) ? text : [[text, opts.speaker]])
    .map((p) => (Array.isArray(p) ? { text: p[0], speaker: p[1] } : typeof p === 'string' ? { text: p } : p))
    .map((p) => ({ ...p, text: String(p.text ?? ''), speaker: p.speaker || opts.speaker || (legacy ? 'legacy' : 'narrator') }))
    .filter((p) => p.text.trim());
  if (!parts.length) return false;
  stopVoice();
  const run = ++chain;
  const lang = opts.lang || getLang();
  const steps = parts.map((p) => plan(p, opts, lang));
  if (!steps.some((s) => s.mode !== 'silent')) return false;
  if (steps.every((s) => s.mode !== 'babble')) {
    // only reading: the browser queues the utterances in order by itself
    for (const s of steps) if (s.mode === 'tts') speakNow(s);
    return true;
  }
  // babble in between: one part after the other
  chainBusy = true;
  const next = (i) => {
    if (run !== chain) return;
    if (i >= steps.length) { chainBusy = false; return; }
    const s = steps[i];
    if (s.mode === 'babble') {
      const secs = babble(audio, s.text, s.type, s.seed);
      setTimeout(() => next(i + 1), secs * 1000 + 120);
    } else if (s.mode === 'tts') {
      // after the last chunk ends (or a guess at its length if the browser never says so)
      let done = false;
      const go = () => { if (!done) { done = true; next(i + 1); } };
      speakNow(s, go);
      setTimeout(go, (s.text.length * 0.085) / s.rate * 1000 + 2500);
    } else next(i + 1);
  };
  next(0);
  return true;
}

/** Work out how one part is said: { mode, text, voice, pitch, rate, type, seed }. */
function plan(p, opts, lang) {
  const no = lang === 'no';
  const legacy = p.speaker === 'legacy';
  const info = legacy ? { type: 'friendly', seed: 'legacy' } : speakerInfo(p.speaker);
  const entry = { text: p.text, speaker: p.speaker, type: info.type, seed: info.seed };
  if (info.type !== 'narrator' && babbleOn && audio) {
    log({ ...entry, mode: 'babble' });
    return { ...entry, mode: 'babble' };
  }
  const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
  const picked = synth && typeof SpeechSynthesisUtterance !== 'undefined' ? currentVoices(lang) : null;
  if (!picked) {
    log({ ...entry, mode: 'silent' });
    return { ...entry, mode: 'silent' };
  }
  const v = voiceFor(picked, legacy ? 'narrator' : p.speaker, { mood: p.mood || opts.mood });
  if (legacy) { v.voice = picked.types.friendly?.voice || v.voice; v.type = 'friendly'; }
  // explicit pitch/rate (old callers, the quiz host) win over the type's
  const pitch = opts.pitch ?? v.pitch, rate = opts.rate ?? v.rate;
  const out = { ...entry, mode: 'tts', text: clean(p.text, no), voice: v.voice, pitch, rate, no };
  log({ ...entry, mode: 'tts', voice: v.voice?.name || '', pitch, rate });
  return out;
}

/** Queue the utterances of one part (long texts in sentence chunks: some online voices stop after ~15 s). */
function speakNow(s, onDone) {
  try {
    const synth = window.speechSynthesis;
    const chunks = chunk(s.text);
    chunks.forEach((c, i) => {
      const u = new SpeechSynthesisUtterance(c);
      u.lang = s.voice ? s.voice.lang : s.no ? 'nb-NO' : 'en-US';
      if (s.voice) u.voice = s.voice;
      u.rate = s.rate;
      u.pitch = s.pitch;
      if (onDone && i === chunks.length - 1) { u.onend = onDone; u.onerror = onDone; }
      synth.speak(u);
    });
  } catch {
    onDone?.();
  }
}

function chunk(text, max = 180) {
  const sentences = text.match(/[^.!?…]+[.!?…]*\s*/g) || [text];
  const out = [];
  for (const s of sentences) {
    if (out.length && (out[out.length - 1] + s).length <= max) out[out.length - 1] += s;
    else out.push(s);
  }
  return out.map((s) => s.trim()).filter(Boolean);
}

function log(e) {
  voiceLog.push(e);
  if (voiceLog.length > 60) voiceLog.shift();
}

/** True while the browser is still reading something aloud (or a character still babbles). */
export function isSpeaking() {
  try { if (window.speechSynthesis?.speaking) return true; } catch { /* no speech */ }
  return chainBusy || babbling(audio);
}

export function stopVoice() {
  chain++;
  chainBusy = false;
  stopBabble();
  try { window.speechSynthesis?.cancel(); } catch { /* nothing to stop */ }
}

/** Make on-screen text sound right: "E / ○" -> "E or ○", drop decorative symbols. */
function clean(text, no) {
  return String(text)
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s\/\s/g, no ? ' eller ' : ' or ')
    .replace(/\s·\s/g, '. ')
    .replace(/[«»"“”◀▶▲▼⚒⚔➶★✓]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
