import { PLAYER_COLORS } from './palette.js';
import { t } from './i18n.js';

export const MAX_PLAYERS = 6;

// Hats unlock as the group collects stars. Index matches makeHat() in character.js.
export const hatName = (i) => t(`hat.${i}`);
export const deviceLabel = (id) => (id.startsWith('gp') ? t('device.gp', { n: Number(id.slice(2)) + 1 }) : t(`device.${id}`));
export const HATS = [
  { stars: 0 },
  { stars: 0 },
  { stars: 3 },
  { stars: 8 },
  { stars: 15 },
  { stars: 25 },
  { stars: 40 },
];

const STORE_KEY = 'couch-party.v1';

function load(key = STORE_KEY) {
  try {
    return JSON.parse(localStorage.getItem(key)) || {};
  } catch {
    return {};
  }
}

export class Roster {
  constructor() {
    this.players = [];
    this.storeKey = STORE_KEY;
    const saved = load();
    this.stars = saved.stars || 0;
    this.progress = saved.progress || {};
  }

  save() {
    try {
      localStorage.setItem(this.storeKey, JSON.stringify({ stars: this.stars, progress: this.progress }));
    } catch {
      /* storage unavailable: progress only lasts this session */
    }
  }

  /**
   * Switch to another save slot (a solo profile's, or back to the shared island's with no key).
   * Stars, hats and every game's progress follow the slot; the language choice carries over.
   */
  useSave(key = STORE_KEY) {
    if (key === this.storeKey) return;
    this.save();
    const lang = this.progress.lang;
    this.storeKey = key;
    const saved = load(key);
    this.stars = saved.stars || 0;
    this.progress = saved.progress || {};
    if (lang) this.progress.lang = lang;
  }

  addStars(n) {
    this.stars += n;
    this.save();
  }

  unlockedHats() {
    return HATS.map((h, i) => (this.stars >= h.stars ? i : -1)).filter((i) => i >= 0);
  }

  nextHatGoal() {
    return HATS.find((h) => h.stars > this.stars) || null;
  }

  has(deviceId) {
    return this.players.some((p) => p.deviceId === deviceId);
  }

  join(device) {
    if (this.players.length >= MAX_PLAYERS || this.has(device.id)) return null;
    const used = new Set(this.players.map((p) => p.colorIndex));
    const colorIndex = PLAYER_COLORS.findIndex((_, i) => !used.has(i));
    const p = {
      colorIndex: 0,
      deviceId: device.id,
      hat: 1,
      // A solo profile's name wins over the color name.
      get name() { return this.profileName || t(`color.${this.colorIndex}`); },
      get deviceLabel() { return deviceLabel(this.deviceId); },
    };
    this.applyColor(p, colorIndex);
    this.players.push(p);
    this.players.sort((a, b) => a.colorIndex - b.colorIndex);
    return p;
  }

  applyColor(p, colorIndex) {
    const c = PLAYER_COLORS[colorIndex];
    p.colorIndex = colorIndex;
    p.color = c.hex;
    p.css = c.css;
  }

  colorOwner(colorIndex) {
    return this.players.find((p) => p.colorIndex === colorIndex) || null;
  }

  /** Switch to a free color. Returns false if someone else has it. */
  setColor(p, colorIndex) {
    const owner = this.colorOwner(colorIndex);
    if (owner && owner !== p) return false;
    this.applyColor(p, colorIndex);
    this.players.sort((a, b) => a.colorIndex - b.colorIndex);
    return true;
  }

  swapColors(a, b) {
    const ca = a.colorIndex;
    this.applyColor(a, b.colorIndex);
    this.applyColor(b, ca);
    this.players.sort((x, y) => x.colorIndex - y.colorIndex);
  }

  leave(player) {
    this.players = this.players.filter((p) => p !== player);
  }

  cycleHat(player) {
    const list = this.unlockedHats();
    const i = list.indexOf(player.hat);
    player.hat = list[(i + 1) % list.length];
    return player.hat;
  }
}
