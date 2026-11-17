// Tiny synthesizer: every sound is generated, so there are no audio files to license.

const NOTE = (m) => 440 * Math.pow(2, (m - 69) / 12);

// Major pentatonic offsets keep random melodies cheerful.
const PENTA = [0, 2, 4, 7, 9, 12, 14, 16];

export const SONGS = {
  hub: { bpm: 104, root: 60, chords: [0, 5, 7, 5], seed: 3, lead: 'triangle' },
  bubble: { bpm: 128, root: 62, chords: [0, 7, 9, 5], seed: 11, lead: 'square' },
  platformer: { bpm: 140, root: 64, chords: [0, 5, 0, 7], seed: 7, lead: 'triangle' },
  paint: { bpm: 150, root: 57, chords: [0, 3, 5, 7], seed: 21, lead: 'square' },
  space: { bpm: 118, root: 62, chords: [0, 9, 5, 7], seed: 41, lead: 'sine' },
  adventure: { bpm: 92, root: 57, chords: [0, 5, 7, 3], seed: 64, lead: 'triangle' },
  party: { bpm: 132, root: 65, chords: [0, 5, 9, 7], seed: 33, lead: 'square' },
  results: { bpm: 96, root: 60, chords: [0, 5, 9, 7], seed: 5, lead: 'triangle' },
  arcade: { bpm: 120, root: 62, chords: [0, 7, 5, 9], seed: 88, lead: 'square' }, // the Game Hall's classic games
};

// Calm island tracks (the solo island, src/scenes/solo/soundscape.js picks one): one per time of day, and a
// winter version of each (slower, higher, with soft bells). calm: no hi-hats, half-note bass, sparse melody.
const ISLAND_TRACKS = {
  morning: { bpm: 84, root: 62, chords: [0, 5, 7, 5], seed: 101, lead: 'triangle' },
  day: { bpm: 92, root: 60, chords: [0, 9, 5, 7], seed: 113, lead: 'triangle' },
  evening: { bpm: 74, root: 57, chords: [0, 5, 3, 7], seed: 127, lead: 'sine' },
  night: { bpm: 62, root: 55, chords: [0, 8, 5, 7], seed: 139, lead: 'sine' },
};
for (const [k, v] of Object.entries(ISLAND_TRACKS)) {
  SONGS[`isl.${k}`] = { ...v, calm: true };
  SONGS[`isl.${k}.winter`] = { ...v, bpm: Math.round(v.bpm * 0.88), root: v.root + 5, seed: v.seed + 7, lead: 'sine', calm: true, bells: true };
}

const MUSIC_VOL = 0.28;
// Ambience layers (setAmbience): looping noise through a filter, plus little scheduled sounds (birds, crickets,
// a café clink, bubbles). max: the loudest a layer gets (kept low: the ambience stays under everything).
const AMB = {
  waves: { type: 'lowpass', freq: 520, q: 0.7, max: 0.16 },
  wind: { type: 'bandpass', freq: 600, q: 0.9, max: 0.1 },
  rain: { type: 'highpass', freq: 2400, q: 0.5, max: 0.08 },
  snow: { type: 'bandpass', freq: 1400, q: 0.6, max: 0.035 },
  cafe: { type: 'bandpass', freq: 320, q: 2.2, max: 0.09 },
  under: { type: 'lowpass', freq: 260, q: 1.0, max: 0.18 },
  birds: { max: 0.05 },
  crickets: { max: 0.025 },
};
export const AMB_LAYERS = Object.keys(AMB);

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.song = null;
    this.step = 0;
    this.nextTime = 0;
    this.timer = null;
    this.musicLevel = 1; // the island's music setting (playMusic level)
    this.ambLevels = {}; // the ambience now (setAmbience), for tests
    this.amb = null;
  }

  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.55;
      this.master.connect(this.ctx.destination);
      this.sfxBus = this.ctx.createGain();
      this.sfxBus.gain.value = 0.9;
      this.sfxBus.connect(this.master);
      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = MUSIC_VOL * this.musicLevel;
      this.musicBus.connect(this.master);
      const len = this.ctx.sampleRate;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return true;
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.55;
    return this.muted;
  }

  tone(freq, dur, { type = 'square', vol = 0.15, slide = 1, delay = 0, bus = this.sfxBus, attack = 0.005 } = {}) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide !== 1) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(bus);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  noise(dur, { vol = 0.2, freq = 1200, q = 1, delay = 0, type = 'bandpass' } = {}) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.sfxBus);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }

  play(name) {
    if (!this.ctx || this.muted) return;
    const r = 1 + (Math.random() - 0.5) * 0.08;
    switch (name) {
      case 'jump': this.tone(330 * r, 0.16, { type: 'square', vol: 0.06, slide: 2 }); break;
      case 'doubleJump': this.tone(520 * r, 0.14, { type: 'square', vol: 0.05, slide: 1.8 }); break;
      case 'land': this.noise(0.06, { vol: 0.08, freq: 400 }); break;
      case 'bubble': this.tone(500 * r, 0.12, { type: 'sine', vol: 0.12, slide: 1.9 }); break;
      case 'trap': this.tone(300, 0.25, { type: 'triangle', vol: 0.15, slide: 2.5 }); this.tone(900, 0.15, { type: 'sine', vol: 0.06, delay: 0.08 }); break;
      case 'pop': this.tone(900 * r, 0.08, { type: 'sine', vol: 0.18, slide: 0.4 }); this.noise(0.05, { vol: 0.1, freq: 3000 }); break;
      case 'coin': this.tone(988 * r, 0.07, { type: 'square', vol: 0.06 }); this.tone(1319 * r, 0.16, { type: 'square', vol: 0.06, delay: 0.07 }); break;
      case 'star': [0, 4, 7, 12].forEach((n, i) => this.tone(NOTE(76 + n), 0.18, { type: 'triangle', vol: 0.12, delay: i * 0.06 })); break;
      case 'bump': this.tone(160 * r, 0.12, { type: 'triangle', vol: 0.18, slide: 0.6 }); break;
      case 'boing': this.tone(180, 0.35, { type: 'sine', vol: 0.2, slide: 3.2 }); break;
      case 'dizzy': this.tone(700, 0.4, { type: 'triangle', vol: 0.1, slide: 0.5 }); break;
      case 'rescue': [0, 7, 12].forEach((n, i) => this.tone(NOTE(72 + n), 0.12, { type: 'square', vol: 0.06, delay: i * 0.05 })); break;
      case 'splat': this.noise(0.18, { vol: 0.22, freq: 700, q: 0.7, type: 'lowpass' }); this.tone(140 * r, 0.12, { type: 'sine', vol: 0.15, slide: 0.5 }); break;
      case 'dash': this.noise(0.15, { vol: 0.1, freq: 1800, q: 0.6 }); break;
      case 'whoosh': this.noise(0.45, { vol: 0.16, freq: 900, q: 0.5 }); break;
      case 'beep': this.tone(660, 0.12, { type: 'square', vol: 0.08 }); break;
      case 'go': this.tone(990, 0.3, { type: 'square', vol: 0.08 }); break;
      case 'join': [0, 4, 7].forEach((n, i) => this.tone(NOTE(67 + n), 0.12, { type: 'triangle', vol: 0.14, delay: i * 0.05 })); break;
      case 'leave': [7, 4, 0].forEach((n, i) => this.tone(NOTE(67 + n), 0.12, { type: 'triangle', vol: 0.12, delay: i * 0.05 })); break;
      case 'select': this.tone(NOTE(79), 0.08, { type: 'triangle', vol: 0.12 }); break;
      // emotes (core/emotes.js): soft and short, so a few players at once stay friendly
      case 'emoteHeart': [0, 4, 9].forEach((n, i) => this.tone(NOTE(79 + n), 0.22, { type: 'sine', vol: 0.1, delay: i * 0.09, attack: 0.02 })); break;
      case 'emoteWave': this.tone(NOTE(76) * r, 0.1, { type: 'triangle', vol: 0.11, slide: 1.25 }); this.tone(NOTE(81) * r, 0.16, { type: 'triangle', vol: 0.1, delay: 0.12, slide: 0.9 }); break;
      case 'emoteDance': [0, 7, 4, 12, 7].forEach((n, i) => this.tone(NOTE(72 + n), 0.09, { type: 'square', vol: 0.045, delay: i * 0.11 })); break;
      case 'emoteLaugh': [0, 1, 2].forEach((i) => this.tone((620 - i * 50) * r, 0.08, { type: 'triangle', vol: 0.1, delay: i * 0.13, slide: 0.75 })); break;
      case 'fanfare':
        [[0, 0], [4, 0.12], [7, 0.24], [12, 0.36], [7, 0.52], [12, 0.64]].forEach(([n, d]) =>
          this.tone(NOTE(72 + n), d > 0.6 ? 0.5 : 0.14, { type: 'square', vol: 0.07, delay: d }));
        break;
      default: break;
    }
  }

  /**
   * Play a song by name. opts.fade: seconds of a soft crossfade from the song playing now (out, then in);
   * opts.level: 0..1 (the island's music setting; other scenes leave it at 1).
   */
  playMusic(name, { fade = 0, level = 1 } = {}) {
    if (level !== this.musicLevel) {
      this.musicLevel = level;
      if (this.musicBus && !this.fading) this.musicBus.gain.setTargetAtTime(MUSIC_VOL * level, this.ctx.currentTime, 0.3);
    }
    this.songName = name;
    if (this.song === SONGS[name] && !this.fading) return;
    if (fade > 0 && this.song && this.ctx && this.musicBus) {
      if (this.fading?.name === name) return;
      clearTimeout(this.fading?.timer);
      const g = this.musicBus.gain, t0 = this.ctx.currentTime;
      g.cancelScheduledValues(t0);
      g.setValueAtTime(g.value, t0);
      g.linearRampToValueAtTime(0.0001, t0 + fade / 2);
      this.fading = { name, timer: setTimeout(() => {
        this.fading = null;
        this.startSong(name);
        const t1 = this.ctx.currentTime;
        g.cancelScheduledValues(t1);
        g.setValueAtTime(0.0001, t1);
        g.linearRampToValueAtTime(MUSIC_VOL * this.musicLevel, t1 + fade / 2);
      }, (fade / 2) * 1000) };
      return;
    }
    if (this.fading) { clearTimeout(this.fading.timer); this.fading = null; if (this.musicBus) this.musicBus.gain.setTargetAtTime(MUSIC_VOL * this.musicLevel, this.ctx.currentTime, 0.1); }
    this.startSong(name);
  }

  startSong(name) {
    if (this.song === SONGS[name]) return;
    this.song = SONGS[name] || null;
    this.step = 0;
    if (!this.song) return;
    const rand = rng(this.song.seed);
    // A fixed 2-bar melody per song, built once from the seed.
    this.melody = [];
    let idx = 2;
    for (let i = 0; i < 32; i++) {
      if (rand() < 0.35) { this.melody.push(null); continue; }
      idx = Math.max(0, Math.min(PENTA.length - 1, idx + Math.floor(rand() * 5) - 2));
      this.melody.push(PENTA[idx]);
    }
    if (!this.timer) this.timer = setInterval(() => this.schedule(), 40);
  }

  stopMusic() {
    this.song = null;
  }

  /**
   * Ambience: levels { waves, wind, rain, snow, cafe, under, birds, crickets } from 0 to 1 (missing: 0), times
   * opts.level (the island's ambience setting). Call it a few times a second; layers glide to their level.
   * The master mute silences it with everything else.
   */
  setAmbience(levels = {}, { level = 1 } = {}) {
    const L = {};
    for (const k of AMB_LAYERS) L[k] = Math.max(0, Math.min(1, levels[k] || 0)) * level;
    this.ambLevels = L;
    if (!this.ctx) return;
    if (!this.amb) {
      if (!Object.values(L).some((v) => v > 0)) return;
      this.amb = { bus: this.ctx.createGain(), layers: {}, next: {} };
      this.amb.bus.gain.value = 1;
      this.amb.bus.connect(this.master);
    }
    const now = this.ctx.currentTime;
    for (const [k, def] of Object.entries(AMB)) {
      if (!def.type) continue;
      let lay = this.amb.layers[k];
      if (!lay && L[k] > 0) {
        const src = this.ctx.createBufferSource();
        src.buffer = this.noiseBuf;
        src.loop = true;
        const f = this.ctx.createBiquadFilter();
        f.type = def.type; f.frequency.value = def.freq; f.Q.value = def.q;
        const g = this.ctx.createGain();
        g.gain.value = 0;
        src.connect(f).connect(g).connect(this.amb.bus);
        src.start(now, Math.random());
        lay = this.amb.layers[k] = { src, f, g };
      }
      if (!lay) continue;
      // waves swell and fall, the wind gusts (slow, gentle)
      let v = L[k] * def.max;
      if (k === 'waves') v *= 0.55 + 0.45 * Math.sin(now * 0.55) ** 2;
      if (k === 'wind') { v *= 0.6 + 0.4 * Math.sin(now * 0.31 + 1); lay.f.frequency.setTargetAtTime(450 + 300 * Math.sin(now * 0.23), now, 0.5); }
      lay.g.gain.setTargetAtTime(v, now, 0.6);
    }
    // little sounds now and then
    const nx = this.amb.next;
    const due = (k, gap) => { if ((nx[k] ?? 0) > now) return false; nx[k] = now + gap * (0.6 + Math.random() * 0.8); return true; };
    const bus = this.amb.bus;
    if (L.birds > 0.05 && due('birds', 3.2 / L.birds)) {
      const f = 2200 + Math.random() * 1600, n = 2 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) this.tone(f * (1 + (i % 2) * 0.12), 0.08, { type: 'sine', vol: AMB.birds.max * L.birds, slide: 1.25, delay: i * 0.11, bus, attack: 0.01 });
    }
    if (L.crickets > 0.05 && due('crickets', 1.4 / L.crickets)) {
      for (let i = 0; i < 3; i++) this.tone(4400 + Math.random() * 200, 0.035, { type: 'square', vol: AMB.crickets.max * L.crickets, delay: i * 0.07, bus, attack: 0.003 });
    }
    if (L.cafe > 0.05 && due('clink', 5 / L.cafe)) this.tone(1900 + Math.random() * 900, 0.12, { type: 'sine', vol: 0.025 * L.cafe, slide: 1.02, bus });
    if (L.under > 0.05 && due('bubble', 1.6 / L.under)) this.tone(300 + Math.random() * 300, 0.18, { type: 'sine', vol: 0.05 * L.under, slide: 2.4, bus });
  }

  /** No ambience (leaving the island or the dive). */
  stopAmbience() {
    this.setAmbience({});
    if (!this.amb) return;
    const A = this.amb;
    this.amb = null;
    const t0 = this.ctx.currentTime;
    A.bus.gain.setTargetAtTime(0.0001, t0, 0.3);
    setTimeout(() => { for (const l of Object.values(A.layers)) { try { l.src.stop(); } catch { /* stopped */ } } A.bus.disconnect(); }, 2000);
  }

  schedule() {
    if (!this.ctx || !this.song) return;
    const spb = 60 / this.song.bpm / 4; // 16th notes
    if (this.nextTime < this.ctx.currentTime) this.nextTime = this.ctx.currentTime + 0.05;
    while (this.nextTime < this.ctx.currentTime + 0.15) {
      this.note(this.step, this.nextTime - this.ctx.currentTime);
      this.step++;
      this.nextTime += spb;
    }
  }

  note(step, delay) {
    const s = this.song;
    const bar = Math.floor(step / 16) % s.chords.length;
    const root = s.root + s.chords[bar];
    const i16 = step % 16;
    const bus = this.musicBus;
    if (s.calm) { this.calmNote(step, delay, root, s); return; }
    if (i16 % 4 === 0) this.tone(NOTE(root - 24), 0.22, { type: 'triangle', vol: 0.35, delay, bus });
    if (i16 % 2 === 0) {
      const arp = [0, 4, 7, 12][(i16 / 2) % 4];
      this.tone(NOTE(root + arp), 0.1, { type: 'sine', vol: 0.08, delay, bus });
    }
    if (i16 % 4 === 2) this.noiseHat(delay);
    const m = this.melody[step % 32];
    if (m !== null && i16 % 2 === 0) this.tone(NOTE(root + 12 + m), 0.16, { type: s.lead, vol: 0.06, delay, bus });
  }

  /** A calm island step: a soft half-note bass, a slow arpeggio, a sparse melody (bells in winter). */
  calmNote(step, delay, root, s) {
    const i16 = step % 16, bus = this.musicBus;
    if (i16 % 8 === 0) this.tone(NOTE(root - 24), 0.9, { type: 'sine', vol: 0.3, delay, bus, attack: 0.04 });
    if (i16 % 4 === 2) this.tone(NOTE(root + [0, 4, 7, 12][(i16 / 4 | 0) % 4]), 0.35, { type: 'sine', vol: 0.05, delay, bus, attack: 0.03 });
    const m = this.melody[step % 32];
    if (m !== null && i16 % 4 === 0) {
      this.tone(NOTE(root + 12 + m), 0.55, { type: s.lead, vol: 0.05, delay, bus, attack: 0.04 });
      if (s.bells) this.tone(NOTE(root + 24 + m), 0.7, { type: 'sine', vol: 0.025, delay: delay + 0.02, bus, attack: 0.005 });
    }
  }

  noiseHat(delay) {
    const t = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 7000;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.12, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
    src.connect(f).connect(g).connect(this.musicBus);
    src.start(t, Math.random() * 0.5);
    src.stop(t + 0.06);
  }
}
