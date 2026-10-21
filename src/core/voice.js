import { getLang } from './i18n.js';

// Read-aloud for game text (intro cards, how-to cards, story cards), using the browser's own voices.
// Off by default on the shared island, on by default for new solo profiles; V toggles it.
// Stays quiet when the device has no voice for the current language: an English voice reading
// Norwegian is worse than silence.

let enabled = false;
let voices = [];

function loadVoices() {
  try { voices = window.speechSynthesis?.getVoices() || []; } catch { voices = []; }
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

/**
 * Speak a piece of text (replacing whatever is being said). Returns true if it spoke.
 * Optional pitch (0..2, default 1) and rate (default 0.95) give characters their own voices.
 */
export function say(text, { force = false, pitch = 1, rate = 0.95 } = {}) {
  if ((!enabled && !force) || !text) return false;
  const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
  if (!synth || typeof SpeechSynthesisUtterance === 'undefined') return false;
  try {
    if (!voices.length) loadVoices();
    const no = getLang() === 'no';
    const re = no ? /^(nb|no|nn)(-|$)/i : /^en(-|$)/i;
    const list = voices.filter((v) => re.test(String(v.lang).replace('_', '-')));
    const voice = list.find((v) => v.localService) || list[0] || null;
    if (voices.length && !voice) return false;
    const u = new SpeechSynthesisUtterance(clean(text, no));
    u.lang = voice ? voice.lang : no ? 'nb-NO' : 'en-US';
    if (voice) u.voice = voice;
    u.rate = rate;
    u.pitch = pitch;
    synth.cancel();
    synth.speak(u);
    return true;
  } catch {
    return false;
  }
}

/** True while the browser is still reading something aloud. */
export function isSpeaking() {
  try { return !!window.speechSynthesis?.speaking; } catch { return false; }
}

export function stopVoice() {
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
