// Tiny synthesizer: every sound is generated, so there are no audio files to license.

const NOTE = (m) => 440 * Math.pow(2, (m - 69) / 12);

// Major pentatonic offsets keep random melodies cheerful.
const PENTA = [0, 2, 4, 7, 9, 12, 14, 16];

export const SONGS = {
  hub: { bpm: 104, root: 60, chords: [0, 5, 7, 5], seed: 3, lead: 'triangle' },
  bubble: { bpm: 128, root: 62, chords: [0, 7, 9, 5], seed: 11, lead: 'square' },
  platformer: { bpm: 140, root: 64, chords: [0, 5, 0, 7], seed: 7, lead: 'triangle' },
  paint: { bpm: 150, root: 57, chords: [0, 3, 5, 7], seed: 21, lead: 'square' },
  results: { bpm: 96, root: 60, chords: [0, 5, 9, 7], seed: 5, lead: 'triangle' },
};

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
      this.musicBus.gain.value = 0.28;
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
      case 'fanfare':
        [[0, 0], [4, 0.12], [7, 0.24], [12, 0.36], [7, 0.52], [12, 0.64]].forEach(([n, d]) =>
          this.tone(NOTE(72 + n), d > 0.6 ? 0.5 : 0.14, { type: 'square', vol: 0.07, delay: d }));
        break;
      default: break;
    }
  }

  playMusic(name) {
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
    if (i16 % 4 === 0) this.tone(NOTE(root - 24), 0.22, { type: 'triangle', vol: 0.35, delay, bus });
    if (i16 % 2 === 0) {
      const arp = [0, 4, 7, 12][(i16 / 2) % 4];
      this.tone(NOTE(root + arp), 0.1, { type: 'sine', vol: 0.08, delay, bus });
    }
    if (i16 % 4 === 2) this.noiseHat(delay);
    const m = this.melody[step % 32];
    if (m !== null && i16 % 2 === 0) this.tone(NOTE(root + 12 + m), 0.16, { type: s.lead, vol: 0.06, delay, bus });
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
