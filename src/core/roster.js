import { PLAYER_COLORS } from './palette.js';

export const MAX_PLAYERS = 6;

// Hats unlock as the group collects stars. Index matches makeHat() in character.js.
export const HATS = [
  { name: 'No hat', stars: 0 },
  { name: 'Party hat', stars: 0 },
  { name: 'Flower', stars: 3 },
  { name: 'Bunny ears', stars: 8 },
  { name: 'Propeller', stars: 15 },
  { name: 'Top hat', stars: 25 },
  { name: 'Crown', stars: 40 },
];

const STORE_KEY = 'couch-party.v1';

function load() {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY)) || {};
  } catch {
    return {};
  }
}

export class Roster {
  constructor() {
    this.players = [];
    const saved = load();
    this.stars = saved.stars || 0;
    this.progress = saved.progress || {};
  }

  save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ stars: this.stars, progress: this.progress }));
    } catch {
      /* storage unavailable: progress only lasts this session */
    }
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
    const c = PLAYER_COLORS[colorIndex];
    const p = {
      colorIndex,
      color: c.hex,
      css: c.css,
      name: c.name,
      deviceId: device.id,
      deviceLabel: device.label,
      hat: 1,
    };
    this.players.push(p);
    this.players.sort((a, b) => a.colorIndex - b.colorIndex);
    return p;
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
