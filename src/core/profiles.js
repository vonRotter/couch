import { PLAYER_COLORS } from './palette.js';
import { t, addStrings } from './i18n.js';
import { esc } from './ui.js';

// Solo profiles: one per child, each with its own saves on the solo island and in guest games.
// Stored in this browser only. Guest games (other repos on the same site) read the active profile
// from localStorage 'couch.profile' ({ id, name }) or from the ?profile= link they were opened with,
// and put the id in front of their own save keys.

const LIST_KEY = 'couch-party.profiles';
const ACTIVE_KEY = 'couch-party.activeProfile';
const SHARED_KEY = 'couch.profile';
const MAX_PROFILES = 8;
const NAME_MAX = 12;
const LETTERS = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZÆØÅ', 'del', 'ok'];
const GRID_COLS = 8;

addStrings({
  en: {
    'prof.title': 'Who is playing?', 'prof.new': 'New player', 'prof.hint': 'Stick: choose · [A]: play · [C]: voice on/off · [B]: back',
    'prof.voiceOn': 'voice on', 'prof.voiceOff': 'voice off', 'prof.nameTitle': 'What is your name?',
    'prof.nameHint': 'Stick: letter · [A]: type · [B]: delete · choose OK when done', 'prof.ok': 'OK', 'prof.del': '⌫',
    'prof.colorTitle': 'Pick your color', 'prof.colorHint': 'Stick left/right · [A]: done', 'prof.full': 'There is room for {n} players.',
    'prof.created': 'Welcome, {name}!',
  },
  no: {
    'prof.title': 'Hvem spiller?', 'prof.new': 'Ny spiller', 'prof.hint': 'Pinne: velg · [A]: spill · [C]: stemme av/på · [B]: tilbake',
    'prof.voiceOn': 'stemme på', 'prof.voiceOff': 'stemme av', 'prof.nameTitle': 'Hva heter du?',
    'prof.nameHint': 'Pinne: bokstav · [A]: skriv · [B]: slett · velg OK når du er ferdig', 'prof.ok': 'OK', 'prof.del': '⌫',
    'prof.colorTitle': 'Velg farge', 'prof.colorHint': 'Pinne venstre/høyre · [A]: ferdig', 'prof.full': 'Det er plass til {n} spillere.',
    'prof.created': 'Velkommen, {name}!',
  },
});

function read(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function write(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
}

export function listProfiles() {
  return read(LIST_KEY, []);
}

export function getProfile(id) {
  return listProfiles().find((p) => p.id === id) || null;
}

export function activeProfileId() {
  return read(ACTIVE_KEY, null);
}

/** Save changes to a profile (name, colorIndex, hat, voice). */
export function updateProfile(profile) {
  const list = listProfiles();
  const i = list.findIndex((p) => p.id === profile.id);
  if (i >= 0) list[i] = { ...list[i], ...profile };
  write(LIST_KEY, list);
}

export function createProfile({ name, colorIndex }) {
  const list = listProfiles();
  const id = `${name.toLowerCase().replace(/[^a-zæøå0-9]+/g, '') || 'p'}-${Date.now().toString(36)}`;
  const profile = { id, name, colorIndex, hat: 1, voice: true };
  list.push(profile);
  write(LIST_KEY, list);
  return profile;
}

/** Mark the profile as the one playing, for this site and for guest games. */
export function activateProfile(profile) {
  write(ACTIVE_KEY, profile ? profile.id : null);
  write(SHARED_KEY, profile ? { id: profile.id, name: profile.name } : null);
}

/** The save slot of a profile's solo progress. */
export const soloSaveKey = (id) => `couch-party.solo.${id}`;

/**
 * Pick or create a profile with the stick and buttons (no typing needed).
 * Any joined player can steer it. onDone(profile) or onCancel().
 */
export class ProfilePicker {
  constructor(scene, { onDone, onCancel }) {
    this.scene = scene;
    this.onDone = onDone;
    this.onCancel = onCancel;
    this.profiles = listProfiles();
    const last = this.profiles.findIndex((p) => p.id === activeProfileId());
    this.index = Math.max(0, last);
    this.mode = this.profiles.length ? 'list' : 'name';
    this.name = '';
    this.cursor = 0;
    this.color = 0;
    this.time = 0;
    this.el = scene.game.ui.panel('', 'panel picker prof-panel');
    this.render();
  }

  get inputs() {
    return this.scene.players.map((p) => ({ d: this.scene.input(p), id: p.deviceId })).filter((x) => x.d);
  }

  render() {
    if (this.mode === 'list') {
      const cards = this.profiles.map((p, i) => {
        const c = PLAYER_COLORS[p.colorIndex] || PLAYER_COLORS[0];
        return `<div class="prof-card ${i === this.index ? 'on' : ''}" style="--c:${c.css}">
          <div class="prof-bean"></div><b>${esc(p.name)}</b><small>${p.voice ? '🔊' : '🔇'} ${t(p.voice ? 'prof.voiceOn' : 'prof.voiceOff')}</small></div>`;
      });
      if (this.profiles.length < MAX_PROFILES) {
        cards.push(`<div class="prof-card new ${this.index === this.profiles.length ? 'on' : ''}"><div class="prof-plus">+</div><b>${t('prof.new')}</b></div>`);
      }
      this.el.innerHTML = `<div class="results-title">${t('prof.title')}</div>
        <div class="prof-row">${cards.join('')}</div>
        <div class="results-footer">${t('prof.hint')}</div>`;
    } else if (this.mode === 'name') {
      const keys = LETTERS.map((ch, i) => `<div class="kbd-key ${i === this.cursor ? 'on' : ''} ${ch.length > 1 ? 'wide' : ''}">${ch === 'del' ? t('prof.del') : ch === 'ok' ? t('prof.ok') : ch}</div>`).join('');
      this.el.innerHTML = `<div class="results-title">${t('prof.nameTitle')}</div>
        <div class="prof-name">${esc(this.name) || '&nbsp;'}<span class="blink">_</span></div>
        <div class="kbd-grid" style="--cols:${GRID_COLS}">${keys}</div>
        <div class="results-footer">${t('prof.nameHint')}</div>`;
    } else {
      const swatches = PLAYER_COLORS.map((c, i) => `<div class="prof-swatch ${i === this.color ? 'on' : ''}" style="--c:${c.css}"></div>`).join('');
      this.el.innerHTML = `<div class="results-title">${t('prof.colorTitle')}</div>
        <div class="prof-name">${esc(this.name)}</div>
        <div class="prof-row">${swatches}</div>
        <div class="results-footer">${t('prof.colorHint')}</div>`;
    }
  }

  update(dt) {
    this.time += dt;
    if (this.time < 0.25) return;
    for (const { d, id } of this.inputs) {
      this.lastId = id;
      if (this.mode === 'list') this.updateList(d);
      else if (this.mode === 'name') this.updateName(d);
      else this.updateColor(d);
      if (!this.el) return;
    }
  }

  updateList(d) {
    const n = this.profiles.length + (this.profiles.length < MAX_PROFILES ? 1 : 0);
    const step = d.stepX || -d.stepY;
    if (step) { this.index = (this.index + step + n) % n; this.scene.game.audio.play('select'); this.render(); }
    const p = this.profiles[this.index];
    if (d.cPressed && p) {
      p.voice = !p.voice;
      updateProfile(p);
      this.scene.game.audio.play(p.voice ? 'join' : 'leave');
      this.render();
    } else if (d.aPressed) {
      if (p) this.done(p);
      else { this.mode = 'name'; this.name = ''; this.cursor = 0; this.scene.game.audio.play('join'); this.render(); }
    } else if (d.bPressed) {
      this.close();
      this.onCancel?.();
    }
  }

  updateName(d) {
    const n = LETTERS.length;
    if (d.stepX || d.stepY) {
      let c = this.cursor + d.stepX - d.stepY * GRID_COLS;
      c = Math.max(0, Math.min(n - 1, c));
      if (c !== this.cursor) { this.cursor = c; this.scene.game.audio.play('select'); this.render(); }
    }
    if (d.aPressed) {
      const ch = LETTERS[this.cursor];
      if (ch === 'del') this.name = this.name.slice(0, -1);
      else if (ch === 'ok') {
        if (!this.name) { this.scene.game.audio.play('bump'); return; }
        const used = new Set(this.profiles.map((p) => p.colorIndex));
        this.color = Math.max(0, PLAYER_COLORS.findIndex((_, i) => !used.has(i)));
        this.mode = 'color';
      } else if (this.name.length < NAME_MAX) {
        // Capitalize like a name: first letter big, the rest small.
        this.name += this.name ? ch.toLowerCase() : ch;
      }
      this.scene.game.audio.play('select');
      this.render();
    } else if (d.bPressed) {
      if (this.name) { this.name = this.name.slice(0, -1); this.render(); } else if (this.profiles.length) { this.mode = 'list'; this.render(); } else { this.close(); this.onCancel?.(); }
    }
  }

  updateColor(d) {
    const n = PLAYER_COLORS.length;
    if (d.stepX) { this.color = (this.color + d.stepX + n) % n; this.scene.game.audio.play('select'); this.render(); }
    if (d.aPressed) {
      const p = createProfile({ name: this.name, colorIndex: this.color });
      this.scene.game.ui.toast(t('prof.created', { name: p.name }));
      this.done(p);
    } else if (d.bPressed) {
      this.mode = 'name';
      this.render();
    }
  }

  done(profile) {
    this.scene.game.audio.play('fanfare');
    this.close();
    this.onDone(profile, this.lastId);
  }

  close() {
    this.el?.remove();
    this.el = null;
  }
}
