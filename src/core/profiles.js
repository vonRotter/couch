import { PLAYER_COLORS } from './palette.js';
import { t, tFor, addStrings } from './i18n.js';
import { esc } from './ui.js';
import { deviceLabel } from './roster.js';

const deviceName = (d) => deviceLabel(d.id);

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
    'prof.title': 'Who is playing?', 'prof.new': 'New player', 'prof.hint': 'Stick: choose · [A]: play · [C]: voice on, babble or off · [B]: back',
    'prof.voiceOn': 'voice on', 'prof.voiceOff': 'voice off', 'prof.voiceBabble': 'voice on, characters babble', 'prof.nameTitle': 'What is your name?',
    'prof.nameHint': 'Stick: letter · [A]: type · [B]: delete · choose OK when done', 'prof.ok': 'OK', 'prof.del': '⌫',
    'prof.colorTitle': 'Pick your color', 'prof.colorHint': 'Stick left/right · [A]: done', 'prof.full': 'There is room for {n} players.',
    'prof.created': 'Welcome, {name}!',
    'prof.hintStart': 'Stick: choose · [A]: play · [C]: voice on, babble or off',
    'prof.together': 'Play together', 'prof.togetherSub': 'the Party Island: everyone joins',
    'join.title': 'Who are you?', 'join.guest': 'Guest', 'join.guestSub': 'just play', 'join.playing': 'playing',
    'join.hint': '[A]: pick · [B]: back', 'join.taken': '{name} is already playing',
  },
  no: {
    'prof.title': 'Hvem spiller?', 'prof.new': 'Ny spiller', 'prof.hint': 'Pinne: velg · [A]: spill · [C]: stemme på, babling eller av · [B]: tilbake',
    'prof.voiceOn': 'stemme på', 'prof.voiceOff': 'stemme av', 'prof.voiceBabble': 'stemme på, figurene babler', 'prof.nameTitle': 'Hva heter du?',
    'prof.nameHint': 'Pinne: bokstav · [A]: skriv · [B]: slett · velg OK når du er ferdig', 'prof.ok': 'OK', 'prof.del': '⌫',
    'prof.colorTitle': 'Velg farge', 'prof.colorHint': 'Pinne venstre/høyre · [A]: ferdig', 'prof.full': 'Det er plass til {n} spillere.',
    'prof.created': 'Velkommen, {name}!',
    'prof.hintStart': 'Pinne: velg · [A]: spill · [C]: stemme på, babling eller av',
    'prof.together': 'Spill sammen', 'prof.togetherSub': 'Festøya: alle blir med',
    'join.title': 'Hvem er du?', 'join.guest': 'Gjest', 'join.guestSub': 'bare spill', 'join.playing': 'spiller',
    'join.hint': '[A]: velg · [B]: tilbake', 'join.taken': '{name} spiller allerede',
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

/** Save changes to a profile (name, colorIndex, hat, voice, babble). Its "Help me play" settings are kept. */
export function updateProfile(profile) {
  const list = listProfiles();
  const i = list.findIndex((p) => p.id === profile.id);
  if (i >= 0) list[i] = { ...list[i], ...profile, assist: list[i].assist };
  write(LIST_KEY, list);
}

/** Save a profile's "Help me play" settings (core/assist.js). Older profiles have none: defaults. */
export function setProfileAssist(id, assist) {
  const list = listProfiles();
  const i = list.findIndex((p) => p.id === id);
  if (i < 0) return;
  list[i] = { ...list[i], assist };
  write(LIST_KEY, list);
}

export function createProfile({ name, colorIndex }) {
  const list = listProfiles();
  const id = `${name.toLowerCase().replace(/[^a-zæøå0-9]+/g, '') || 'p'}-${Date.now().toString(36)}`;
  const profile = { id, name, colorIndex, hat: 1, voice: true, babble: false };
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
 * Any joined player can steer it (or every device: opts.inputs). onDone(profile, deviceId) or onCancel().
 * opts.onTogether(deviceId) adds a "Play together" card (the start screen); opts.header goes above the title.
 * Without onCancel, [B] on the list does nothing (there is nowhere to go back to).
 */
export class ProfilePicker {
  constructor(scene, { onDone, onCancel = null, onTogether = null, inputs = null, header = '', className = '' }) {
    this.scene = scene;
    this.onDone = onDone;
    this.onCancel = onCancel;
    this.onTogether = onTogether;
    this.inputFn = inputs;
    this.header = header;
    this.profiles = listProfiles();
    const last = this.profiles.findIndex((p) => p.id === activeProfileId());
    this.index = Math.max(0, last);
    this.mode = this.profiles.length || onTogether ? 'list' : 'name';
    this.name = '';
    this.cursor = 0;
    this.color = 0;
    this.time = 0;
    this.el = scene.game.ui.panel('', `panel picker prof-panel ${className}`);
    this.render();
  }

  get inputs() {
    if (this.inputFn) return this.inputFn();
    return this.scene.players.map((p) => ({ d: this.scene.input(p), id: p.deviceId })).filter((x) => x.d);
  }

  /** The list's cards: the profiles, "New player" (while there is room) and "Play together". */
  get cards() {
    const list = this.profiles.map((p) => ({ prof: p }));
    if (this.profiles.length < MAX_PROFILES) list.push({ isNew: true });
    if (this.onTogether) list.push({ together: true });
    return list;
  }

  render() {
    if (this.mode === 'list') {
      const cards = this.cards.map((c, i) => {
        const on = i === this.index ? 'on' : '';
        if (c.isNew) return `<div class="prof-card new ${on}"><div class="prof-plus">+</div><b>${t('prof.new')}</b></div>`;
        if (c.together) {
          const beans = [0, 2, 4].map((k) => `<i style="--c:${PLAYER_COLORS[k].css}"></i>`).join('');
          return `<div class="prof-card together ${on}"><div class="prof-group">${beans}</div><b>${t('prof.together')}</b><small>${t('prof.togetherSub')}</small></div>`;
        }
        const p = c.prof;
        const col = PLAYER_COLORS[p.colorIndex] || PLAYER_COLORS[0];
        return `<div class="prof-card ${on}" style="--c:${col.css}">
          <div class="prof-bean"></div><b>${esc(p.name)}</b><small>${p.voice ? (p.babble ? '💬' : '🔊') : '🔇'} ${t(p.voice ? (p.babble ? 'prof.voiceBabble' : 'prof.voiceOn') : 'prof.voiceOff')}</small></div>`;
      });
      this.el.innerHTML = `${this.header}<div class="results-title">${t('prof.title')}</div>
        <div class="prof-row">${cards.join('')}</div>
        <div class="results-footer">${t(this.onCancel ? 'prof.hint' : 'prof.hintStart')}</div>`;
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

  /** The card under the cursor ({ prof } | { isNew } | { together }), for the start screen's beans. */
  get current() {
    return this.mode === 'list' ? this.cards[this.index] || null : null;
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
    const cards = this.cards;
    const n = cards.length;
    const step = d.stepX || -d.stepY;
    if (step) { this.index = (this.index + step + n) % n; this.scene.game.audio.play('select'); this.render(); }
    const c = cards[this.index];
    const p = c?.prof;
    if (d.cPressed && p) {
      // read-aloud on (character voices) -> on, characters babble -> off -> on
      if (p.voice && !p.babble) p.babble = true;
      else if (p.voice) { p.voice = false; p.babble = false; } else p.voice = true;
      updateProfile(p);
      this.scene.game.audio.play(p.voice ? 'join' : 'leave');
      this.render();
    } else if (d.aPressed) {
      if (p) this.done(p);
      else if (c?.together) { this.scene.game.audio.play('fanfare'); this.close(); this.onTogether(this.lastId); }
      else { this.mode = 'name'; this.name = ''; this.cursor = 0; this.scene.game.audio.play('join'); this.render(); }
    } else if (d.bPressed && this.onCancel) {
      this.close();
      this.onCancel();
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
      if (this.name) { this.name = this.name.slice(0, -1); this.render(); } else if (this.profiles.length || this.onTogether) { this.mode = 'list'; this.render(); } else { this.close(); this.onCancel?.(); }
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

/**
 * Joining on the shared island: a small card for one device (several can be open side by side in a tray).
 * The list is the profiles and "Guest"; a profile that is already playing cannot be picked. [A] picks
 * (onDone(profile or null for a guest)), [B] goes back (onCancel). taken() is the set of profile ids playing.
 */
export class JoinPicker {
  constructor(scene, device, { tray, taken, onDone, onCancel }) {
    this.scene = scene;
    this.device = device;
    this.taken = taken;
    this.onDone = onDone;
    this.onCancel = onCancel;
    this.items = [...listProfiles().map((p) => ({ prof: p })), { guest: true }];
    const busy = taken();
    this.index = Math.max(0, this.items.findIndex((it) => it.guest || !busy.has(it.prof.id)));
    this.t = 0;
    this.el = document.createElement('div');
    this.el.className = 'join-card';
    tray.appendChild(this.el);
    this.render();
  }

  isTaken(it, busy = this.taken()) {
    return !!it.prof && busy.has(it.prof.id);
  }

  render() {
    const busy = this.taken();
    this.sig = [...busy].join(',');
    const rows = this.items.map((it, i) => {
      const on = i === this.index ? 'on' : '';
      if (it.guest) return `<div class="join-opt guest ${on}"><span class="dot"></span><b>${t('join.guest')}</b><small>${t('join.guestSub')}</small></div>`;
      const col = PLAYER_COLORS[it.prof.colorIndex] || PLAYER_COLORS[0];
      const taken = this.isTaken(it, busy);
      return `<div class="join-opt ${on} ${taken ? 'taken' : ''}" style="--c:${col.css}"><span class="dot"></span><b>${esc(it.prof.name)}</b>${taken ? `<small>${t('join.playing')}</small>` : ''}</div>`;
    }).join('');
    this.el.innerHTML = `<div class="join-title">${t('join.title')}<small>${esc(deviceName(this.device))}</small></div>
      <div class="join-list">${rows}</div><div class="join-hint">${tFor({ deviceId: this.device.id }, 'join.hint')}</div>`;
  }

  update(dt) {
    this.t += dt;
    const d = this.device;
    if (!d.connected) { this.cancel(); return; }
    const busy = this.taken();
    if ([...busy].join(',') !== this.sig) this.render();
    const step = d.stepY ? -d.stepY : d.stepX;
    if (step) {
      const n = this.items.length;
      this.index = (this.index + step + n) % n;
      this.scene.game.audio.play('select');
      this.render();
    }
    if (this.t < 0.25) return;
    if (d.bPressed || d.backPressed) { this.cancel(); return; }
    if (d.aPressed) {
      const it = this.items[this.index];
      if (this.isTaken(it, busy)) {
        this.scene.game.audio.play('bump');
        this.scene.game.ui.toast(t('join.taken', { name: it.prof.name }));
        return;
      }
      this.close();
      this.onDone(it.prof || null);
    }
  }

  cancel() {
    this.scene.game.audio.play('leave');
    this.close();
    this.onCancel?.();
  }

  close() {
    this.el?.remove();
    this.el = null;
  }
}
