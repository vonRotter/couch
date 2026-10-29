import * as THREE from 'three';
import { COLORS, toon, sharedGeo } from '../../core/palette.js';
import { Character } from '../../core/character.js';
import { makeGrumble } from '../../core/critters.js';
import { makeGrumbleton } from '../adventure/props.js';
import { mesh, box, cyl, sph, cone } from './models.js';
import { makeOwl, makeHermit } from './models3.js';
import { SPOTS } from './map.js';
import { hourOf, since, HOUR } from './save.js';
import { festivalOn } from './calendar.js';

// The island's people. Each has a home spot, a real-time daily routine (where they are depends on the
// hour), a voice for read-aloud, gift likes, friendship hearts with two small heart events, and two
// quests. Dialog keys live in strings.js under isl.<id>.*.

export const PTS_PER_HEART = 10;
export const MAX_HEARTS = 10;
export const TALK_PTS = 3;
export const GIFT_PTS = { love: 10, like: 6, neutral: 3, dislike: 0 };

/**
 * sched: [hour, spot, sleep?] sorted by hour; the last entry before the current hour wins.
 * quests: { need: [[item, n]] } or { find: item }, reward: { items: [[id, n]], coins, deco, unlock }.
 * events: at hearts; lines = number of dialog lines (isl.<id>.ev<k>.<i>).
 * game(progress) -> 'game0' | 'game1' | 'game2' | null: a line about the npc's own game.
 */
export const NPCS = {
  hazel: {
    voice: { pitch: 1.2, rate: 0.9, css: '#4f9a1f' },
    sched: [[0, 'hazelPorch', true], [6, 'hazelGarden'], [11, 'plazaBench'], [14, 'farmFence'], [19, 'hazelPorch'], [22, 'hazelPorch', true]],
    fest: { fair: [9, 18, 'plazaBench'] },
    loves: ['tomato', 'carrotSoup'], likes: ['pumpkin', 'bouquet', 'lettuce'], dislikes: ['wood'],
    quests: [
      { need: [['radish', 1]], reward: { items: [['strawberrySeed', 2], ['tomatoSeed', 2]], coins: 10 } },
      { need: [['carrot', 1], ['lettuce', 1]], minHearts: 1, reward: { items: [['pumpkinSeed', 1]], coins: 50, deco: 'gnome' } },
      { need: [['wood', 15], ['stone', 10]], minHearts: 2, reward: { unlock: 'barn', items: [['hay', 6]] } },
      { need: [['wood', 20], ['stone', 10], ['fiber', 8]], minHearts: 3, reward: { unlock: 'greenhouse', items: [['starfruitSeed', 1]] } }, // milestone B3
    ],
    events: [{ at: 2, lines: 4, reward: { items: [['bouquet', 2], ['lettuceSeed', 3]] } }, { at: 4, lines: 4, reward: { unlock: 'bigCan' } },
      { at: 6, lines: 4, reward: { deco: 'quilt' } }, { at: 8, lines: 4, reward: { deco: 'gardenArch' } }],
    game: (p) => (p.island?.stats?.harvested >= 10 ? 'game2' : p.island?.stats?.harvested >= 1 ? 'game1' : 'game0'),
  },
  rosa: {
    voice: { pitch: 1.4, rate: 1.05, css: '#e0459a' },
    sched: [[0, 'storeHome', true], [7, 'storeCounter'], [18, 'plazaFountain'], [21, 'storeHome', true]],
    fest: { plant: [9, 18, 'plazaFountain'] }, // [from hour, to hour, spot] on festival days
    loves: ['bouquet', 'strawberryShake'], likes: ['lettuce', 'strawberry', 'starfruit'], dislikes: ['corn'],
    quests: [
      { need: [['radish', 3]], reward: { items: [['cornSeed', 2]], coins: 40 } },
      { need: [['pumpkin', 1]], minHearts: 1, reward: { coins: 100, deco: 'pumpkinLamp' } },
    ],
    events: [{ at: 2, lines: 4, reward: { unlock: 'discount' } }, { at: 4, lines: 4, reward: { items: [['tomatoSeed', 5], ['bouquet', 1]] } },
      { at: 6, lines: 4, reward: { unlock: 'rosaHelps' } }, { at: 8, lines: 4, reward: { deco: 'portrait' } }],
    game: (p) => (p.island?.stats?.shipped >= 20 ? 'game2' : p.island?.stats?.shipped >= 1 ? 'game1' : 'game0'),
  },
  bram: {
    voice: { pitch: 0.7, rate: 0.88, css: '#6b7bb0' },
    sched: [[0, 'lhDoor'], [2, 'lhDoor', true], [6, 'beach'], [9, 'lhDoor'], [17, 'plazaEast'], [20, 'lhDoor']],
    loves: ['pumpkin', 'fishStew'], likes: ['carrot', 'corn', 'starfruit'], dislikes: ['radish'],
    quests: [
      { need: [['carrot', 1]], reward: { items: [['pickaxe', 1]] } },
      { find: 'lens', minHearts: 1, reward: { items: [['starfruitSeed', 1]], coins: 60 } },
    ],
    events: [{ at: 2, lines: 4, reward: { items: [['pumpkinSeed', 2]] } }, { at: 4, lines: 4, reward: { deco: 'lantern' } },
      { at: 6, lines: 4, reward: { deco: 'shipWheel' } }, { at: 8, lines: 4, reward: { deco: 'scope' } }],
    game: (p) => (p.lighthouse?.flags?.finale ? 'game2' : p.lighthouse?.crystals > 0 ? 'game1' : 'game0'),
  },
  grumbleton: {
    voice: { pitch: 0.55, rate: 0.9, css: '#5a4dc0' },
    sched: [[0, 'shipDeck', true], [8, 'pier'], [13, 'pierEnd'], [16, 'pier'], [20, 'cafe']],
    loves: ['strawberry', 'sushi'], likes: ['tomato', 'pumpkin', 'corn'], dislikes: ['bouquet'],
    quests: [
      { find: 'feather', reward: { items: [['strawberrySeed', 3]], coins: 30 } },
      { need: [['strawberry', 3]], minHearts: 1, reward: { deco: 'bottle', coins: 40 } },
    ],
    events: [{ at: 2, lines: 4, reward: { coins: 50 } }, { at: 4, lines: 4, reward: { deco: 'spyglass' } },
      { at: 6, lines: 4, reward: { unlock: 'goldRod' } }, { at: 8, lines: 4, reward: { deco: 'anchor' } }],
    game: (p) => (p.adventure?.done2 ? 'game2' : p.adventure?.done ? 'game1' : 'game0'),
  },
  pip: {
    voice: { pitch: 1.6, rate: 1.1, css: '#4a3fc0' },
    sched: [[0, 'rocket', true], [8, 'pad'], [12, 'hallFront'], [15, 'pad'], [19, 'hillTop'], [23, 'rocket', true]],
    fest: { beach: [10, 18, 'beachDay'] },
    loves: ['starfruit', 'tempura'], likes: ['corn', 'strawberry', 'pumpkin'], dislikes: ['lettuce'],
    quests: [
      { find: 'starmap', reward: { items: [['starfruitSeed', 1]], unlock: 'starfruit' } },
      { need: [['corn', 2]], minHearts: 1, reward: { coins: 80, deco: 'rocket' } },
    ],
    events: [{ at: 2, lines: 4, reward: { items: [['starfruitSeed', 1]] } }, { at: 4, lines: 4, reward: { deco: 'moonrock' } },
      { at: 6, lines: 5, fx: 'rocket', reward: { deco: 'starLamp' } }, { at: 8, lines: 4, reward: { deco: 'photo' } }],
    game: (p) => ((p.skyhop || 0) >= 5 ? 'game2' : (p.skyhop || 0) >= 1 ? 'game1' : 'game0'),
  },
  mumble: {
    voice: { pitch: 1.75, rate: 1.0, css: '#3f9a32' },
    sched: [[0, 'meadow', true], [7, 'meadow'], [21, 'meadow', true]],
    wander: 3,
    loves: ['radish', 'radishSalad'], likes: ['carrot', 'strawberry'], dislikes: ['bouquet'],
    quests: [{ need: [['radish', 3]], reward: { unlock: 'burrow' } }],
    events: [],
    game: (p) => ((p.guides?.stars || []).some((s) => s > 0) ? 'game1' : null),
  },
  // milestone B3: the museum's curator, and Shelby from Shell Isle (who visits the beach on weekends)
  hoot: {
    voice: { pitch: 0.95, rate: 0.85, css: '#8a5a32' },
    sched: [[0, 'museumDoor', true], [7, 'museumDoor'], [22, 'museumDoor', true]],
    loves: ['pearl', 'moonfish'], likes: ['seaGlass', 'starfish', 'cocoa', 'pumpkinPie'], dislikes: ['hay'],
    quests: [], events: [],
    game: () => null,
  },
  shelby: {
    voice: { pitch: 1.5, rate: 1.05, css: '#e0557a' },
    sched: [[0, 'shelbyHut', true], [7, 'shelbyHut'], [9, 'tidepools'], [13, 'shelbyHut'], [16, 'isleBeach'], [20, 'shelbyHut', true]],
    wander: 1.6,
    isle: true, // lives on Shell Isle
    // Saturdays and Sundays 10-17, once you have met: a day out on the main island's beach
    visit: (at, save) => { const d = new Date(at), h = hourOf(at); return save?.npcs?.shelby?.met && (d.getDay() === 6 || d.getDay() === 0) && h >= 10 && h < 17 ? 'shelbyVisit' : null; },
    loves: ['coconut', 'seaGlass'], likes: ['wildBerry', 'seaShell', 'blueberry', 'sushi'], dislikes: ['wood'],
    quests: [{ need: [['seaGlass', 2]], reward: { deco: 'shellChime', coins: 40 } }],
    events: [],
    game: () => null,
  },
};
export const NPC_IDS = Object.keys(NPCS);

export function npcState(save, id) {
  if (!save.npcs[id]) save.npcs[id] = { pts: 0, talkAt: 0, giftAt: 0, ev: 0, q: 0, met: false };
  return save.npcs[id];
}

export const heartsOf = (st) => Math.min(MAX_HEARTS, Math.floor(st.pts / PTS_PER_HEART));

/** Where the npc should be now: { spot, sleep }. Festival hosts stand at their festival during the day. */
export function scheduleNow(id, at, save = null) {
  const h = hourOf(at);
  const v = NPCS[id].visit?.(at, save);
  if (v) return { spot: SPOTS[v], sleep: false, name: v };
  const f = NPCS[id].fest?.[festivalOn(at)];
  if (f && h >= f[0] && h < f[1]) return { spot: SPOTS[f[2]], sleep: false, name: f[2] };
  let cur = NPCS[id].sched[0];
  for (const e of NPCS[id].sched) if (h >= e[0]) cur = e;
  return { spot: SPOTS[cur[1]], sleep: !!cur[2], name: cur[1] };
}

/** How the npc feels about a gift. */
export function taste(id, item) {
  const n = NPCS[id];
  if (n.loves.includes(item)) return 'love';
  if (n.likes.includes(item)) return 'like';
  if (n.dislikes.includes(item)) return 'dislike';
  return 'neutral';
}

export const canTalkBonus = (st, at) => since(st.talkAt, HOUR, at);
export const canGift = (st, at) => since(st.giftAt, HOUR, at);

// ---------- looks ----------

function bean(color, hat, extras) {
  const ch = new Character(color, { hat });
  extras?.(ch.pivot);
  return ch;
}

/** A little wrapper with the Character API (face, update) for non-bean npcs. */
class Puppet {
  constructor(model, bob = 0.05) {
    this.group = new THREE.Group();
    this.pivot = new THREE.Group();
    this.group.add(this.pivot);
    this.pivot.add(model);
    this.model = model;
    this.yaw = 0;
    this.targetYaw = 0;
    this.t = Math.random() * 6;
    this.bob = bob;
  }
  face(dx, dz) { if (Math.abs(dx) + Math.abs(dz) > 0.01) this.targetYaw = Math.atan2(dx, dz); }
  squash() {}
  update(dt, { moving = 0 } = {}) {
    this.t += dt;
    let d = this.targetYaw - this.yaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.yaw += d * Math.min(1, dt * 10);
    this.group.rotation.y = this.yaw;
    this.pivot.position.y = moving ? Math.abs(Math.sin(this.t * 12)) * 0.1 : Math.sin(this.t * 2) * 0.02;
    this.pivot.scale.y = 1 + Math.sin(this.t * 2.4) * this.bob * 0.5;
  }
}

export function makeNpcModel(id) {
  switch (id) {
    case 'hazel': return bean(0x8ac926, 0, (p) => {
      // straw sun hat, round glasses and a flowery apron
      const hat = new THREE.Group();
      hat.add(mesh(cyl(0.48, 0.48, 0.05, 18), 0xf3d9a4, 0, 0, 0), mesh(cyl(0.26, 0.3, 0.22, 14), 0xf3d9a4, 0, 0.12, 0), mesh(cyl(0.305, 0.305, 0.07, 14), 0xff7eb6, 0, 0.06, 0, false));
      hat.position.set(0, 1.2, -0.08);
      hat.rotation.x = -0.35;
      p.add(hat);
      for (const s of [-1, 1]) p.add(mesh(sharedRing(), COLORS.ink, s * 0.15, 0.83, 0.39, false));
      p.add(mesh(box(0.5, 0.42, 0.06), 0xfff3dc, 0, 0.42, 0.39, false));
      p.add(mesh(sph(0.05, 6, 5), 0xff7eb6, -0.1, 0.48, 0.43, false), mesh(sph(0.05, 6, 5), 0xffd23f, 0.12, 0.38, 0.43, false));
    });
    case 'rosa': return bean(0xff9fd0, 0, (p) => {
      // hair bun with a ribbon, striped apron
      p.add(mesh(sph(0.2, 10, 8), 0x8a4a3a, 0, 1.25, -0.08), mesh(sph(0.3, 12, 8), 0x8a4a3a, 0, 1.05, -0.12));
      p.add(mesh(box(0.25, 0.08, 0.06), 0x4cc9f0, 0, 1.25, 0.08, false));
      p.add(mesh(box(0.52, 0.5, 0.06), 0xffffff, 0, 0.42, 0.39, false));
      for (let i = 0; i < 3; i++) p.add(mesh(box(0.08, 0.5, 0.07), 0x4cc9f0, -0.16 + i * 0.16, 0.42, 0.4, false));
    });
    case 'bram': return bean(0x9aa7c7, 0, (p) => {
      // white beard and brows, a knitted keeper's beanie, a little lantern
      const beard = mesh(sph(0.26), COLORS.white, 0, 0.55, 0.28);
      beard.scale.set(1.1, 0.9, 0.6);
      p.add(beard, mesh(box(0.4, 0.06, 0.06), COLORS.white, 0, 0.98, 0.34, false));
      p.add(mesh(sharedGeo('isl-beanie', () => new THREE.SphereGeometry(0.4, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2)), 0x2e5a8f, 0, 1.08, 0), mesh(sph(0.1, 8, 6), 0xffffff, 0, 1.48, 0));
      p.add(mesh(cyl(0.41, 0.41, 0.1, 16), 0x24487a, 0, 1.1, 0, false));
      const lan = new THREE.Group();
      lan.add(mesh(box(0.18, 0.24, 0.18), toon(0xfff1a8, { emissive: 0x664400 }), 0, 0, 0, false), mesh(cone(0.14, 0.12, 4), COLORS.ink, 0, 0.17, 0, false));
      lan.position.set(0.48, 0.45, 0.15);
      p.add(lan);
    });
    case 'grumbleton': {
      const pup = new Puppet(makeGrumbleton(), 0.08);
      pup.model.scale.setScalar(0.75);
      return pup;
    }
    case 'pip': return bean(0xffffff, 0, (p) => {
      // astronaut: glass helmet, antenna, backpack and a star patch
      const helm = mesh(sph(0.56, 16, 12), toon(0xbff6ff, { transparent: true, opacity: 0.35 }), 0, 0.85, 0.02, false);
      p.add(helm, mesh(cyl(0.5, 0.5, 0.1, 16), 0x9a94b2, 0, 0.42, 0, false));
      p.add(mesh(box(0.55, 0.6, 0.3), 0x9a94b2, 0, 0.6, -0.42), mesh(cyl(0.015, 0.015, 0.4, 4), COLORS.ink, 0.2, 1.5, 0, false), mesh(sph(0.06, 8, 6), 0xff5d73, 0.2, 1.72, 0, false));
      p.add(mesh(sph(0.08, 8, 6), 0xffc93c, -0.2, 0.5, 0.4, false));
    });
    case 'hoot': {
      const pup = new Puppet(makeOwl(), 0.06);
      pup.model.scale.setScalar(0.95);
      return pup;
    }
    case 'shelby': {
      const pup = new Puppet(makeHermit(), 0.05);
      pup.model.scale.setScalar(0.85);
      return pup;
    }
    case 'mumble': {
      const g = makeGrumble(0x6fbf73);
      const leaf = mesh(sph(0.12, 8, 6), 0x3f9a32, 0.05, 0.98, 0, false);
      leaf.scale.set(1, 0.3, 0.6);
      g.add(leaf);
      const pup = new Puppet(g, 0.1);
      pup.model.scale.setScalar(0.9);
      return pup;
    }
  }
  return bean(0xffc93c, 1);
}

function sharedRing() {
  return sharedGeo('isl-glass', () => new THREE.TorusGeometry(0.09, 0.015, 6, 14));
}
