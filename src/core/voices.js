// Who speaks with which voice. One table (SPEAKERS) maps every speaking character in every game to a
// voice TYPE (child, grandma, gruff, ...); TYPES says how each type sounds, both read aloud by the
// browser (a preferred voice gender, pitch and rate) and as babble (WebAudio syllables, see babble.js).
// pickVoices() turns the device's speechSynthesis voices into one voice per type.
//
// Adding a character: put `'<game>.<id>': '<type>'` in SPEAKERS (or { type, pitch, rate, seed } for a
// small nudge; seed makes the same person sound the same in two games) and call
// say(text, '<game>.<id>'). Narration, cards, menus, tutorials, item names and toasts use 'narrator'.

/**
 * Voice types. gender: the voice to prefer ('f', 'm' or 'any'); pitch 0..2 and rate as for
 * SpeechSynthesisUtterance. babble: { wave, base Hz, spread semitones, syl seconds per syllable,
 * glide (pitch ratio over a syllable), formant (vowel filters), vib (vibrato depth), click, steps, vol }.
 */
export const TYPES = {
  narrator: { name: 'Narrator', gender: 'any', pitch: 1, rate: 0.95, sample: 'narrator' },
  child: {
    name: 'Child', gender: 'f', pitch: 1.45, rate: 1.08,
    babble: { wave: 'triangle', base: 430, spread: 6, syl: 0.075, glide: 1.06, formant: true, vol: 0.5 },
  },
  grandma: {
    name: 'Grandma', gender: 'f', pitch: 1.15, rate: 0.85,
    babble: { wave: 'triangle', base: 300, spread: 4, syl: 0.105, glide: 0.97, formant: true, vib: 0.035, vol: 0.5 },
  },
  gruff: {
    name: 'Gruff sailor', gender: 'm', pitch: 0.6, rate: 0.88,
    babble: { wave: 'sawtooth', base: 105, spread: 3, syl: 0.11, glide: 0.94, formant: true, rumble: true, vol: 0.55 },
  },
  cheerful: {
    name: 'Cheerful shopkeeper', gender: 'f', pitch: 1.25, rate: 1.06,
    babble: { wave: 'triangle', base: 350, spread: 7, syl: 0.082, glide: 1.12, formant: true, vol: 0.5 },
  },
  owl: {
    name: 'Owl sage', gender: 'm', pitch: 0.8, rate: 0.82,
    babble: { wave: 'sine', base: 270, spread: 3, syl: 0.15, glide: 0.82, vib: 0.02, vol: 0.6 },
  },
  sleepy: {
    name: 'Sleepy old man', gender: 'm', pitch: 0.7, rate: 0.75,
    babble: { wave: 'sine', base: 150, spread: 2, syl: 0.17, glide: 0.86, formant: true, vol: 0.6 },
  },
  villain: {
    name: 'Villain', gender: 'm', pitch: 0.45, rate: 0.85,
    babble: { wave: 'sawtooth', base: 82, spread: 4, syl: 0.12, glide: 0.92, formant: true, rumble: true, detune: 18, vol: 0.55 },
  },
  tiny: {
    name: 'Tiny creature', gender: 'f', pitch: 1.9, rate: 1.2,
    babble: { wave: 'sine', base: 950, spread: 7, syl: 0.055, glide: 1.25, vol: 0.45 },
  },
  crab: {
    name: 'Crab', gender: 'any', pitch: 1.7, rate: 1.28,
    babble: { wave: 'square', base: 1700, spread: 5, syl: 0.07, glide: 1, click: true, vol: 0.4 },
  },
  bird: {
    name: 'Bird', gender: 'f', pitch: 2, rate: 1.3,
    babble: { wave: 'sine', base: 1500, spread: 6, syl: 0.07, glide: 1.5, vol: 0.4 },
  },
  robot: {
    name: 'Robot', gender: 'm', pitch: 0.5, rate: 1.12,
    babble: { wave: 'square', base: 440, spread: 9, syl: 0.085, glide: 1, steps: true, vol: 0.32 },
  },
  friendly: {
    name: 'Friendly grown-up', gender: 'm', pitch: 1, rate: 1,
    babble: { wave: 'triangle', base: 210, spread: 5, syl: 0.09, glide: 1.02, formant: true, vol: 0.55 },
  },
};

/** The order types pick their voice in (the first ones get the best match when voices are few). */
export const TYPE_ORDER = ['child', 'grandma', 'gruff', 'cheerful', 'owl', 'villain', 'sleepy', 'friendly', 'tiny', 'crab', 'bird', 'robot'];

/** Every speaking character -> its voice type. Ids are '<game>.<character>'. */
export const SPEAKERS = {
  narrator: 'narrator',
  // Solo island villagers (src/scenes/solo/npcs.js) and guests
  'isl.hazel': { type: 'grandma', pitch: 0.05 },
  'isl.rosa': 'cheerful',
  'isl.bram': { type: 'gruff', seed: 'bram' },
  'isl.grumbleton': { type: 'gruff', seed: 'grumbleton' },
  'isl.pip': 'child',
  'isl.mumble': 'tiny',
  'isl.hoot': 'owl',
  'isl.shelby': 'crab',
  'isl.coach': { type: 'friendly', pitch: 0.12, rate: 0.08, seed: 'coach' }, // Coach Bo in the Game Hall (solo/coach.js)
  'isl.visitor': 'friendly', // café guests who are not villagers
  'isl.merchant': { type: 'sleepy', pitch: 0.2, rate: 0.12, seed: 'marlo' }, // Marlo, the traveling merchant (surprise.js)
  'isl.skye': { type: 'cheerful', pitch: -0.15, seed: 'skye' }, // Skye, the balloon explorer (surprise.js)
  // Pudding Island (src/scenes/adventure*)
  'adv.pip': { type: 'child', pitch: -0.1 },
  'adv.grum': { type: 'gruff', seed: 'grumbleton' },
  'adv.gull': 'bird', // Mine the seagull
  'adv.granny': 'grandma',
  'adv.wob': { type: 'child', pitch: -0.25, rate: 0.05 }, // Wobbles the pudding
  'adv.claw': 'crab', // Clawdia
  // Lighthouse Caves (src/scenes/lighthouse*)
  'lh.keeper': { type: 'gruff', seed: 'bram' },
  'lh.olga': 'grandma',
  'lh.tobi': 'child',
  'lh.mira': 'cheerful',
  'lh.pell': { type: 'gruff', pitch: 0.15 },
  'lh.mitten': 'tiny', // the cat
  'lh.sela': { type: 'cheerful', pitch: 0.1 }, // the seal
  'lh.murky': 'tiny',
  'lh.murk': 'villain', // the Gloom
  'lh.sign': 'narrator',
  'lh.you': 'narrator', // the player's own thoughts
  // Pillow Keep Solo townsfolk (src/scenes/keepsolo/town.js) and bosses
  'ks.smith': 'gruff',
  'ks.fizz': 'cheerful',
  'ks.fluff': { type: 'friendly', pitch: -0.1 }, // Sir Fluffington
  'ks.snore': 'sleepy', // Old Snorewell
  'ks.tilly': 'child',
  'ks.gumdrop': 'grandma',
  'ks.teddy': 'villain',
  'ks.goose': 'bird',
  'ks.duck': 'gruff',
  'ks.sheep': 'sleepy',
  // Story mode (src/scenes/story*) and the Pillow Keep campaign (src/scenes/castle)
  'story.king': 'villain', // the Grumble King
  'kc.duke': { type: 'villain', pitch: 0.1 },
  'kc.princess': 'cheerful',
  'kc.captain': 'gruff',
  // Bean Brigade (src/scenes/breach*)
  'breach.helper': 'robot', // the helper bean on the radio
};

/** { type, pitch, rate, seed } for a speaker id ('narrator' for unknown ids and no id). */
export function speakerInfo(id) {
  const e = SPEAKERS[id];
  if (!e) return { id: id || 'narrator', type: id && TYPES[id] ? id : 'narrator', pitch: 0, rate: 0, seed: id || 'narrator', known: false };
  const o = typeof e === 'string' ? { type: e } : e;
  return { id, type: o.type, pitch: o.pitch || 0, rate: o.rate || 0, seed: o.seed || id, known: true };
}

export const speakerType = (id) => speakerInfo(id).type;

/** Small deterministic number in -1..1 from a string (per-character pitch/rate offsets). */
export function hashUnit(s, salt = 0) {
  let h = 2166136261 ^ salt;
  for (const ch of String(s)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  h ^= h >>> 13;
  h = Math.imul(h, 0x5bd1e995);
  h ^= h >>> 15;
  return ((h >>> 0) % 2001) / 1000 - 1;
}

// ---------- the device's voices ----------

const NOVELTY = /\b(albert|bad news|bahh|bells|boing|bubbles|cellos|deranged|good news|hysterical|jester|organ|pipe organ|superstar|trinoids|whisper|wobble|zarvox)\b/i;
const ROBOTIC = /\b(zarvox|trinoids|fred)\b/i;
const FEMALE_NAMES = /\b(female|woman|girl|zira|samantha|karen|moira|tessa|victoria|fiona|serena|susan|hazel|heera|catherine|allison|ava|kate|veena|aria|jenny|sonia|libby|natasha|clara|emma|michelle|ana|jane|nancy|sara|linda|kathy|agnes|vicki|princess|iselin|pernille|nora|hulda|ellen|ingrid|anna|amelie|sofie|ida|google us english)\b/i;
const MALE_NAMES = /\b(male|man|boy|david|mark|george|alex|daniel|fred|tom|oliver|arthur|guy|ryan|christopher|eric|brian|rishi|aaron|gordon|lee|thomas|ralph|junior|bruce|james|richard|sean|william|jon|finn|henrik|magnus|lars|ole)\b/i;

/** 'f', 'm' or '' from a voice's name (Female/Male in the name, or a known voice name). */
export function voiceGender(v) {
  const n = String(v?.name || '');
  if (/\bfemale\b/i.test(n)) return 'f';
  if (/\bmale\b/i.test(n)) return 'm';
  if (FEMALE_NAMES.test(n)) return 'f';
  if (MALE_NAMES.test(n)) return 'm';
  return '';
}

/** Rough quality score: natural/neural/online voices first, eSpeak-style robots and novelty voices last. */
export function voiceQuality(v, prefer = '') {
  const n = String(v?.name || '');
  let q = 0;
  if (/natural/i.test(n)) q += 50;
  if (/neural|wavenet|premium|enhanced|siri/i.test(n)) q += 40;
  if (/google/i.test(n)) q += 30;
  if (/online/i.test(n)) q += 15;
  if (/microsoft/i.test(n)) q += 5;
  if (/espeak|mbrola|pico/i.test(n)) q -= 30;
  if (NOVELTY.test(n) || ROBOTIC.test(n)) q -= 100;
  if (v?.default) q += 3;
  if (v?.localService) q += 2; // works offline: a small tie-breaker only
  const lang = String(v?.lang || '').replace('_', '-').toLowerCase();
  if (prefer && lang === prefer.toLowerCase()) q += 4;
  if (/^en-(us|gb)$/.test(lang)) q += 2;
  return q;
}

export const langRe = (lang) => (lang === 'no' ? /^(nb|no|nn)(-|$)/i : /^en(-|$)/i);

/**
 * Choose a voice for the narrator and for every type from the device's voices (pure: easy to test).
 * Returns { narrator: { voice, pitch, rate }, types: { type: { voice, pitch, rate, gender } }, list }
 * or null when the device has voices but none for the language (stay silent). With no voices at all
 * (some browsers load them late) every entry has voice null and the browser picks by lang.
 */
export function pickVoices(all, lang = 'en', prefer = '') {
  const re = langRe(lang);
  const list = (all || []).filter((v) => re.test(String(v.lang).replace('_', '-')));
  if ((all || []).length && !list.length) return null;
  const score = new Map(list.map((v) => [v, voiceQuality(v, prefer)]));
  const byName = (a, b) => String(a.name).localeCompare(String(b.name));
  const sorted = [...list].sort((a, b) => score.get(b) - score.get(a) || byName(a, b));
  const normal = sorted.filter((v) => !NOVELTY.test(v.name) && !ROBOTIC.test(v.name));
  // characters share the good voices; poor ones (eSpeak and friends) only when nothing better exists
  const best = normal.length ? score.get(normal[0]) : 0;
  let pool = normal.filter((v) => score.get(v) >= Math.min(best, 10) - 40).slice(0, 8);
  if (!pool.length) pool = normal.slice(0, 8);
  const narratorVoice = normal[0] || sorted[0] || null;
  const uses = new Map(pool.map((v) => [v, 0]));
  if (narratorVoice) uses.set(narratorVoice, 1); // characters move off the narrator's voice when they can
  const out = { narrator: { voice: narratorVoice, pitch: TYPES.narrator.pitch, rate: TYPES.narrator.rate }, types: {}, list: sorted };
  for (const type of TYPE_ORDER) {
    const T = TYPES[type];
    let voice = null;
    // macOS has real robot voices (Zarvox and Trinoids first, then Fred)
    if (type === 'robot') voice = [/zarvox/i, /trinoids/i, /\bfred\b/i].map((re) => sorted.find((v) => re.test(v.name))).find(Boolean) || null;
    if (!voice && pool.length) {
      let top = -Infinity;
      for (const v of pool) {
        const g = voiceGender(v);
        const fit = T.gender === 'any' ? 0 : g === T.gender ? 20 : g ? -15 : 4;
        const s = fit + score.get(v) * 0.2 - uses.get(v) * 12;
        if (s > top) { top = s; voice = v; }
      }
      uses.set(voice, uses.get(voice) + 1);
    }
    voice ||= narratorVoice;
    // a man's voice for a woman's part (or the other way round) is nudged up or down
    const g = voice ? voiceGender(voice) : '';
    let pitch = T.pitch;
    if (T.gender === 'm' && g === 'f') pitch *= 0.8;
    else if (T.gender === 'f' && g === 'm') pitch *= 1.2;
    out.types[type] = { voice, pitch: clamp(pitch, 0.1, 2), rate: T.rate, gender: g };
  }
  return out;
}

export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

/** Final { voice, pitch, rate } for one speaker (type voice + the speaker's own small offsets). */
export function voiceFor(picked, id, { mood } = {}) {
  const info = speakerInfo(id);
  const base = info.type === 'narrator' ? picked.narrator : picked.types[info.type] || picked.narrator;
  let pitch = base.pitch, rate = base.rate;
  if (info.type !== 'narrator') {
    pitch += info.pitch + hashUnit(info.seed, 1) * 0.08;
    rate += info.rate + hashUnit(info.seed, 2) * 0.05;
  }
  if (mood === 'sleepy') { pitch *= 0.92; rate *= 0.8; }
  return { voice: base.voice, pitch: clamp(pitch, 0.1, 2), rate: clamp(rate, 0.5, 1.6), type: info.type };
}
