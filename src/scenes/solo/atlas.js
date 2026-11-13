import * as THREE from 'three';
import { t, tFor, addStrings } from '../../core/i18n.js';
import { esc } from '../../core/ui.js';
import { say as speak } from '../../core/voice.js';
import { dayKey, weekIndex } from './calendar.js';
import { heightAt, groundColor, inUpperWater, SEA_Y, HOME, STORE, CAFE, MUSEUM, HALL, MAILBOX, PIER, PLAZA, FERRY, DIVE_BOAT, CRAB_COVE, FIELD, GREEN, GREENHOUSE, HOME_DOORS, HAZEL_HOME, DEN, BRIDGE } from './map.js';
import { ISLE2, ISLE2_DOCK, HUT, POOLS, PALMS, BERRIES, DIGS, COVE, isle2Height } from './isle2geo.js';
import { TRAILS } from './hopdata.js';
import { PILE, KITE, LEAF_PILES } from './games.js';
import { MAIN_BOARD } from './isle2.js';
import { PADDOCK } from './animals.js';
import { npcState, heartsOf } from './npcs.js';
import { todaysCrab } from './crabdata.js';
import { stageOf, tileCenter, parseKey } from './farm.js';

// The island map (the owner's map decisions): the journal's first tab, also on its own button (M on a
// keyboard, View / Create / − on a gamepad). It shows you (where you are and which way you face), every place
// (games, with a sparkle on the ones you have not tried yet; shops, homes, the museum, the school house, the
// ferry), where each villager is right now ("!" for those who want to talk or have a quest, asleep villagers at
// their home) and today's activities (festivals, the day's surprise, crabs that need a hand, ripe crops,
// animals to tend, the island's mini-games, letters). On Shell Isle it is Shell Isle's own map.
// Secrets are never on it: the hidden areas, their chests (a refilled chest is only a line in the "Today" list,
// without a place), Shell Isle's cove, the burrow until Mumble shows it, lost things you are looking for.
// No mini-map: pick a place, a villager or an activity ([OK]) and a small arrow at the edge of the screen
// points the way (over the thing itself once it is on screen) until you get there; [OK] on it again turns it
// off. The stick (or the mouse) moves a cursor; the name under it is read aloud when it rests there (the map
// is help, so reading names is fine).

addStrings({
  en: {
    'isl.jn.map': 'Map',
    'map.hint': 'Stick: move · [OK]: show the way · [MAP] or [C]: close',
    'map.hintKb': 'Stick or mouse: move · [OK] or click: show the way · [MAP] or [C]: close',
    'map.idle': 'Move the circle onto a picture', 'map.main': 'Your island', 'map.isle': 'Shell Isle',
    'map.pick': '[OK]: show the way there', 'map.unpick': '[OK]: arrow off', 'map.isTarget': 'The arrow points here',
    'map.lg.you': 'You', 'map.lg.game': 'Games', 'map.lg.new': 'Not tried yet', 'map.lg.suggest': 'Coach suggests', 'map.lg.place': 'Shops and homes',
    'map.lg.npc': 'Friends', 'map.lg.talk': 'Wants to talk', 'map.lg.sleep': 'Asleep at home', 'map.lg.today': 'Today', 'map.lg.target': 'The arrow points here',
    'map.today': 'Today', 'map.nothing': 'A quiet day. Walk around and say hello!',
    'map.home': 'Your home', 'map.store': "Rosa's store", 'map.cafe': 'Driftwood Café', 'map.cafeClosed': 'needs fixing',
    'map.museum': 'Museum', 'map.barn': 'Barn and animals', 'map.greenhouse': 'Greenhouse', 'map.mailbox': 'Mailbox',
    'map.ferry': 'Party Pier ferry', 'map.ferrySub': 'play together', 'map.boat': 'Boat to Shell Isle', 'map.boatHome': 'Boat home',
    'map.dive': 'Diving boat', 'map.stones': 'Skipping stones', 'map.kite': 'Kite stand', 'map.trail': 'Hop trail: {name}',
    'map.home.hazel': "Aunt Hazel's cottage", 'map.home.pip': "Pip's rocket", 'map.home.mumble': "Mumble's den", 'map.home.shelby': "Shelby's shell house",
    'map.new': 'not tried yet', 'map.talk': 'wants to talk to you', 'map.asleep': 'asleep at home', 'map.atHome': 'at home',
    'map.a.fest': 'Today: {name}', 'map.a.merchant': 'Marlo the merchant is here', 'map.a.balloon': "Skye's balloon landed",
    'map.a.bottle': 'A bottle on the beach', 'map.a.dig': 'Dig for the treasure here', 'map.a.crab': 'A crab needs a hand',
    'map.a.dance': 'Crab dance at Crab Cove', 'map.a.leaves': 'A leaf pile to jump in', 'map.a.crops': 'Ripe crops: {n}',
    'map.a.animals': 'The animals are waiting for you', 'map.a.mail': 'Letters for you', 'map.a.meteor': 'Falling stars tonight! Catch them anywhere',
    'map.a.chests': 'A treasure chest you found has filled up again', 'map.a.palm': 'Coconuts to shake down', 'map.a.berries': 'Berries to pick',
    'map.a.pool': 'Something in the tide pool', 'map.a.digIsle': 'Treasure spot: dig with the Zip-Zap',
    'map.set': 'The arrow shows the way to {name}', 'map.off': 'Arrow off', 'map.there': 'You are there: {name}!', 'map.viaBoat': 'by boat',
  },
  no: {
    'isl.jn.map': 'Kart',
    'map.hint': 'Pinne: flytt · [OK]: vis veien · [MAP] eller [C]: lukk',
    'map.hintKb': 'Pinne eller mus: flytt · [OK] eller klikk: vis veien · [MAP] eller [C]: lukk',
    'map.idle': 'Flytt ringen til et bilde', 'map.main': 'Øya di', 'map.isle': 'Skjelløya',
    'map.pick': '[OK]: vis veien dit', 'map.unpick': '[OK]: pila av', 'map.isTarget': 'Pila peker hit',
    'map.lg.you': 'Deg', 'map.lg.game': 'Spill', 'map.lg.new': 'Ikke prøvd ennå', 'map.lg.suggest': 'Treneren foreslår', 'map.lg.place': 'Butikker og hjem',
    'map.lg.npc': 'Venner', 'map.lg.talk': 'Vil snakke med deg', 'map.lg.sleep': 'Sover hjemme', 'map.lg.today': 'I dag', 'map.lg.target': 'Pila peker hit',
    'map.today': 'I dag', 'map.nothing': 'En rolig dag. Gå rundt og si hei!',
    'map.home': 'Hjemmet ditt', 'map.store': 'Butikken til Rosa', 'map.cafe': 'Drivvedkafeen', 'map.cafeClosed': 'må fikses',
    'map.museum': 'Museet', 'map.barn': 'Låven og dyrene', 'map.greenhouse': 'Drivhuset', 'map.mailbox': 'Postkassa',
    'map.ferry': 'Festbrygga-ferja', 'map.ferrySub': 'spill sammen', 'map.boat': 'Båten til Skjelløya', 'map.boatHome': 'Båten hjem',
    'map.dive': 'Dykkerbåten', 'map.stones': 'Kast smutt', 'map.kite': 'Dragestativet', 'map.trail': 'Hoppeløype: {name}',
    'map.home.hazel': 'Huset til tante Hazel', 'map.home.pip': 'Raketten til Pip', 'map.home.mumble': 'Hiet til Mumle', 'map.home.shelby': 'Skjellhuset til Shelby',
    'map.new': 'ikke prøvd ennå', 'map.talk': 'vil snakke med deg', 'map.asleep': 'sover hjemme', 'map.atHome': 'er hjemme',
    'map.a.fest': 'I dag: {name}', 'map.a.merchant': 'Kjøpmann Marlo er her', 'map.a.balloon': 'Ballongen til Skye har landet',
    'map.a.bottle': 'En flaske på stranda', 'map.a.dig': 'Grav etter skatten her', 'map.a.crab': 'En krabbe trenger hjelp',
    'map.a.dance': 'Krabbedans i Krabbevika', 'map.a.leaves': 'En løvhaug å hoppe i', 'map.a.crops': 'Modne planter: {n}',
    'map.a.animals': 'Dyrene venter på deg', 'map.a.mail': 'Brev til deg', 'map.a.meteor': 'Stjerneskudd i kveld! Fang dem hvor som helst',
    'map.a.chests': 'En skattekiste du har funnet, er full igjen', 'map.a.palm': 'Kokosnøtter å riste ned', 'map.a.berries': 'Bær å plukke',
    'map.a.pool': 'Noe i fjærepytten', 'map.a.digIsle': 'Skattested: grav med Zipp-Zappen',
    'map.set': 'Pila viser veien til {name}', 'map.off': 'Pila er av', 'map.there': 'Du er fremme: {name}!', 'map.viaBoat': 'med båt',
  },
});

// The two maps: the area each one shows (world x and z; north, -z, is up).
const REGIONS = {
  main: { x0: -64, x1: 64, z0: -50, z1: 62, res: 1.6 },
  isle: { x0: -30, x1: 30, z0: 164, z1: 212, res: 3.2 },
};
const isIsle = (z) => z > 150;
const CURSOR_SPEED = 0.55; // of the map's width per second
const SNAP = 4.2; // world units: the cursor picks the nearest marker this close
const READ_AFTER = 0.45; // seconds the cursor rests on a marker before its name is read

const PLACE_ICON = { lighthouse: '🗼', ship: '🏴‍☠️', tent: '🎪', balloon: '🎈', mine: '⛏️', keep: '🏰', castle: '🏯', burrow: '🕳️', garage: '🤖', school: '🏫' };
const NPC_FACE = { hazel: '👵', rosa: '🌸', bram: '🧔', grumbleton: '🏴‍☠️', pip: '🔧', mumble: '🐾', hoot: '🦉', shelby: '🐚', coach: '📣' };

const CSS = `
.isl-panel.isl-map-wide { width: min(1120px, 96vw); max-height: 96vh; padding: 12px 18px 10px; }
.isl-map { display: flex; gap: 14px; align-items: flex-start; }
.isl-map-box { position: relative; height: min(73vh, 640px); flex: none; border-radius: 16px; overflow: hidden; background: #4aa6d6;
  box-shadow: inset 0 0 0 3px rgba(138,90,50,.55); pointer-events: auto; cursor: crosshair; }
.isl-map-box canvas { position: absolute; inset: 0; width: 100%; height: 100%; }
.isl-map-box svg.lines { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
.isl-mk { position: absolute; transform: translate(-50%, -50%); font-size: clamp(19px, 3vh, 30px); line-height: 1; pointer-events: none;
  filter: drop-shadow(0 1px 0 #fff) drop-shadow(0 2px 2px rgba(43,35,64,.35)); transition: transform .12s; }
.isl-mk.on { transform: translate(-50%, -50%) scale(1.45); z-index: 3; }
.isl-mk.dim { opacity: .55; filter: grayscale(.7) drop-shadow(0 1px 0 #fff); }
.isl-mk i { position: absolute; font-style: normal; font-size: .62em; }
.isl-mk i.nw { right: -.55em; top: -.55em; }
.isl-mk i.sg { left: -.6em; top: -.6em; }
.isl-mk i.lk { right: -.5em; bottom: -.4em; }
.isl-mk i.ex { right: -.45em; top: -.75em; background: #ff4f6d; color: #fff; border-radius: 999px; padding: 1px 5px; font-weight: 800; font-size: .6em; }
.isl-mk i.zz { right: -.6em; top: -.6em; }
.isl-mk.npc b { display: grid; place-items: center; width: 1.35em; height: 1.35em; border-radius: 50%; background: #fff; border: 3px solid var(--c); font-size: .8em; }
.isl-mk.today { font-size: clamp(16px, 2.5vh, 25px); }
.isl-mk.today::after, .isl-map-legend .tdy::after { content: ''; position: absolute; inset: -6px; border-radius: 50%; background: radial-gradient(rgba(255,216,74,.95) 35%, rgba(255,216,74,0) 70%); z-index: -1; }
.isl-map-legend .tdy { position: relative; isolation: isolate; }
.isl-mk.tgt::before { content: '🎯'; position: absolute; left: 50%; top: -1.1em; transform: translateX(-50%); font-size: .8em; }
.isl-mk.you { z-index: 4; }
.isl-mk.you svg { width: 1.5em; height: 1.5em; display: block; }
.isl-map-cur { position: absolute; width: 34px; height: 34px; margin: -17px 0 0 -17px; border-radius: 50%; border: 4px solid #fff; box-shadow: 0 0 0 3px #2b2340, inset 0 0 0 2px #2b2340; pointer-events: none; z-index: 5; }
.isl-map-cur.hit { border-color: #ffd84a; }
.isl-map-side { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 8px; font-size: clamp(12px, 1.2vw, 17px); }
.isl-map-cap { background: #fff; border-radius: 14px; padding: 8px 12px; min-height: 3.6em; box-shadow: 0 3px 0 rgba(43,35,64,.12); }
.isl-map-cap .nm { display: flex; align-items: center; gap: 8px; font-size: 1.35em; font-weight: 800; }
.isl-map-cap .nm span { font-size: 1.2em; }
.isl-map-cap small { display: block; opacity: .7; margin-top: 2px; }
.isl-map-cap .k { display: inline-block; margin-top: 4px; background: #ffd84a; border-radius: 999px; padding: 1px 10px; font-size: .85em; }
.isl-map-legend { display: grid; grid-template-columns: 1fr 1fr; gap: 2px 10px; }
.isl-map-legend div { display: flex; align-items: center; gap: 6px; white-space: nowrap; overflow: hidden; }
.isl-map-legend span { width: 1.5em; text-align: center; font-size: 1.15em; }
.isl-map-legend .lgf { display: inline-grid; place-items: center; width: 1.25em; height: 1.25em; border-radius: 50%; background: #fff; border: 2px solid #4f9a1f; font-size: .8em; }
.isl-map-legend .lgx { display: inline-block; background: #ff4f6d; color: #fff; border-radius: 999px; padding: 0 6px; font-size: .8em; }
.isl-map-today b { color: #8a5a32; display: block; margin-bottom: 2px; }
.isl-map-today div { display: flex; gap: 6px; align-items: baseline; line-height: 1.25; margin: 2px 0; }
.isl-compass { left: 0; top: 0; display: none; width: 0; height: 0; z-index: 4; }
.isl-compass .ar { position: absolute; left: -26px; top: -26px; width: 52px; height: 52px; border-radius: 50%; background: rgba(255,250,240,.95);
  box-shadow: 0 3px 0 rgba(43,35,64,.25), 0 0 0 3px #ff4f6d; display: grid; place-items: center; }
.isl-compass .ar svg { width: 36px; height: 36px; }
.isl-compass .ic { position: absolute; left: -17px; top: 20px; width: 34px; height: 34px; line-height: 34px; border-radius: 50%; background: rgba(255,250,240,.92); text-align: center; font-size: 24px; box-shadow: 0 2px 0 rgba(43,35,64,.2); }
`;
function injectStyle() {
  if (document.getElementById('isl-map-style')) return;
  const el = document.createElement('style');
  el.id = 'isl-map-style';
  el.textContent = CSS;
  document.head.appendChild(el);
}

const ARROW = '<svg viewBox="0 0 24 24"><path d="M12 2 L21 21 L12 16 L3 21 Z" fill="#ff4f6d" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
const youArrow = (css) => `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="#fff"/><path d="M12 3 L19 19 L12 15 L5 19 Z" fill="${css}" stroke="#2b2340" stroke-width="1.4" stroke-linejoin="round"/></svg>`;

// The ground of each map, drawn once (a canvas; heightAt for the land, the sea and the river, the island's
// ground colors, a little hill shading, and the paths, the pier and the docks on top).
const terrain = {};
function drawTerrain(region, map) {
  if (terrain[region]) return terrain[region];
  const R = REGIONS[region];
  const W = Math.round((R.x1 - R.x0) * R.res), H = Math.round((R.z1 - R.z0) * R.res);
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const img = g.createImageData(W, H);
  const col = new THREE.Color(), sea = new THREE.Color(), deep = new THREE.Color(0x3f9fc9), shallow = new THREE.Color(0x8fd6e3);
  const sand = new THREE.Color(0xf7e1a6), grass = new THREE.Color(0x9ede5c);
  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) {
      const x = R.x0 + (i + 0.5) / R.res, z = R.z0 + (j + 0.5) / R.res;
      let h = region === 'isle' ? isle2Height(x, z) : heightAt(x, z);
      // Shell Isle's hidden cove is a secret: the map draws the beach over it
      if (region === 'isle' && Math.hypot(x - COVE.x, z - COVE.z) < COVE.r + 1.8 && Math.hypot((x - ISLE2.x) / ISLE2.rx, (z - ISLE2.z) / ISLE2.rz) < 1.0) h = Math.max(h, 0.1);
      if (h < SEA_Y || (region === 'main' && inUpperWater(x, z))) col.copy(sea.copy(shallow).lerp(deep, Math.min(1, (SEA_Y - h) / 2.2)));
      else if (region === 'isle') col.copy(h < 0.15 ? sand : sand.clone().lerp(grass, Math.min(1, (h - 0.15) * 3)));
      else {
        groundColor(x, z, col);
        // light from the north-west: slopes facing it are lighter, cliffs facing away darker
        const hs = heightAt(x - 0.5, z - 0.5) - h;
        col.multiplyScalar(THREE.MathUtils.clamp(1 - hs * 0.22, 0.62, 1.12));
      }
      const k = (j * W + i) * 4;
      img.data[k] = Math.min(255, col.r * 255); img.data[k + 1] = Math.min(255, col.g * 255); img.data[k + 2] = Math.min(255, col.b * 255); img.data[k + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const px = (x) => (x - R.x0) * R.res, pz = (z) => (z - R.z0) * R.res;
  // paths
  if (region === 'main') {
    g.strokeStyle = 'rgba(214,180,120,.85)';
    g.lineWidth = 1.5 * R.res;
    g.lineCap = g.lineJoin = 'round';
    for (const pts of map.pathPts || []) {
      g.beginPath();
      pts.forEach((p, i) => (i ? g.lineTo(px(p.x), pz(p.z)) : g.moveTo(px(p.x), pz(p.z))));
      g.stroke();
    }
  }
  // the pier, the jetty and the docks (not the bridge: it is drawn when it is fixed, see render())
  g.fillStyle = '#c68a52';
  for (const d of map.decks || []) {
    if (d.bridge || isIsle(d.z0) !== (region === 'isle')) continue;
    g.fillRect(px(d.x0), pz(d.z0), (d.x1 - d.x0) * R.res, (d.z1 - d.z0) * R.res);
  }
  terrain[region] = c;
  return c;
}

export class IslandAtlas {
  constructor(host) {
    this.host = host;
    injectStyle();
    this.cur = null; // the cursor on the map (world x, z)
    this.hover = null;
    this.hoverT = 0;
    this.read = null;
    this.list = [];
    this.target = null; // { key, name, icon, x, z, r }
    this.refreshT = 0;
    // the arrow at the screen's edge
    this.compass = document.createElement('div');
    this.compass.className = 'isl-compass';
    this.compass.innerHTML = `<div class="ar">${ARROW}</div><div class="ic"></div>`;
    host.hud.root.appendChild(this.compass);
    this.arEl = this.compass.firstElementChild;
    this.icEl = this.compass.lastElementChild;
    // the mouse: move the cursor over the map and click to pick
    this.onMove = (e) => {
      const box = e.target.closest?.('.isl-map-box');
      if (!box || !this.box) return;
      const r = box.getBoundingClientRect(), R = REGIONS[this.region];
      this.cur = { x: R.x0 + ((e.clientX - r.left) / r.width) * (R.x1 - R.x0), z: R.z0 + ((e.clientY - r.top) / r.height) * (R.z1 - R.z0) };
      this.mouse = true;
    };
    this.onClick = (e) => { if (e.target.closest?.('.isl-map-box') && this.box) { this.onMove(e); this.findHover(); this.pick(); } };
    host.hud.panel.addEventListener('mousemove', this.onMove);
    host.hud.panel.addEventListener('click', this.onClick);
  }

  get S() { return this.host.save; }

  /** Which map: Shell Isle's while you are there. */
  get region() { return this.host.isle2?.here() ? 'isle' : 'main'; }

  // ---------- what is on the map ----------

  /**
   * Everything on the map right now: { key, kind: 'place'|'game'|'npc'|'today', icon, name, sub, x, z (where it is drawn),
   * tx, tz (where the arrow leads: a door), r (close enough), isNew, locked, talk, asleep, css }.
   */
  markers(region = this.region) {
    const host = this.host, S = this.S, out = [];
    const add = (m) => { if (isIsle(m.z) === (region === 'isle')) out.push({ tx: m.x, tz: m.z, r: 3, ...m }); };
    const visited = (id) => !!S.visited?.[id];
    if (region === 'main') {
      // the games
      for (const pl of host.map.places) {
        if (pl.cabinet !== undefined) continue;
        if (pl.id === 'burrow' && !S.unlocks.burrow) continue; // hidden until Mumble shows it
        const open = host.placeOpen(pl);
        add({ key: `place:${pl.id}`, kind: 'game', icon: PLACE_ICON[pl.id] || '🎮', name: t(`game.${pl.key}`), x: pl.x, z: pl.z, tx: pl.door.x, tz: pl.door.z,
          isNew: open && !visited(pl.id), locked: !open, sub: !open ? t(`isl.locked.${pl.lock}`) : !visited(pl.id) ? t('map.new') : host.placeInfo(pl) });
      }
      const cabs = host.map.places.filter((p) => p.cabinet !== undefined);
      add({ key: 'place:hall', kind: 'game', icon: '🕹️', name: t('isl.hall'), x: HALL.x, z: HALL.z, tx: HALL.x, tz: HALL.z + 1.6, isNew: cabs.some((p) => !visited(p.id)),
        sub: cabs.map((p) => t(`game.${p.key}`)).join(', ') });
      // the island's mini-games and the hop trails
      add({ key: 'game:stones', kind: 'game', icon: '🪨', name: t('map.stones'), x: PILE.x, z: PILE.z });
      add({ key: 'game:kite', kind: 'game', icon: '🪁', name: t('map.kite'), x: KITE.x, z: KITE.z + 0.6 });
      for (const [id, tr] of Object.entries(TRAILS)) add({ key: `trail:${id}`, kind: 'game', icon: '🏁', name: t('map.trail', { name: t(`hop.trail.${id}`) }), x: tr.start.x, z: tr.start.z });
      if (S.sea?.suit) add({ key: 'place:dive', kind: 'game', icon: '🤿', name: t('map.dive'), x: DIVE_BOAT.x, z: DIVE_BOAT.z - 1.5 });
      // shops, homes and the other places
      add({ key: 'home', kind: 'place', icon: '🏠', name: t('map.home'), x: HOME.x, z: HOME.z, tx: HOME.x, tz: HOME.z + 2.9 });
      add({ key: 'store', kind: 'place', icon: '🛒', name: t('map.store'), x: STORE.x, z: STORE.z, tx: STORE.x, tz: STORE.z + 3.4 });
      add({ key: 'museum', kind: 'place', icon: '🏛️', name: t('map.museum'), x: MUSEUM.x, z: MUSEUM.z, tx: 26, tz: 1.4 });
      add({ key: 'cafe', kind: 'place', icon: '☕', name: t('map.cafe'), x: CAFE.x, z: CAFE.z, tx: -7.1, tz: 42.8, sub: S.cafe?.repaired ? '' : t('map.cafeClosed') });
      add({ key: 'ferry', kind: 'place', icon: '⛴️', name: t('map.ferry'), sub: t('map.ferrySub'), x: FERRY.x, z: FERRY.z, tx: FERRY.jetty.x1 - 0.8, tz: FERRY.jetty.z });
      if (S.isle2?.chart) add({ key: 'boat', kind: 'place', icon: '⛵', name: t('map.boat'), x: PIER.x, z: PIER.z0 + PIER.len + 1.5, tx: MAIN_BOARD.x, tz: MAIN_BOARD.z });
      if (S.unlocks.barn) add({ key: 'barn', kind: 'place', icon: '🐄', name: t('map.barn'), x: -14, z: 12.6, tx: (PADDOCK.x0 + PADDOCK.x1) / 2, tz: PADDOCK.z1 + 0.6 });
      if (S.unlocks.greenhouse) add({ key: 'greenhouse', kind: 'place', icon: '🌿', name: t('map.greenhouse'), x: GREENHOUSE.x, z: GREENHOUSE.z, tz: GREENHOUSE.z + GREENHOUSE.d / 2 + 0.6 });
      // the broken greenhouse, from 3 hearts with Aunt Hazel: what it takes (greenhouse.js)
      else if (heartsOf(npcState(S, 'hazel')) >= 3 && host.greenhouse) add({ key: 'greenhouse', kind: 'place', icon: '🌱', name: t('map.greenhouse'), sub: host.greenhouse.mapHint(), x: GREENHOUSE.x, z: GREENHOUSE.z, tz: GREENHOUSE.z + GREENHOUSE.d / 2 + 0.6 });
      add({ key: 'home:hazel', kind: 'place', icon: '🏡', name: t('map.home.hazel'), x: HAZEL_HOME.x, z: HAZEL_HOME.z, tx: HOME_DOORS.hazel.spot.x, tz: HOME_DOORS.hazel.spot.z });
      add({ key: 'home:pip', kind: 'place', icon: '🚀', name: t('map.home.pip'), x: 40, z: -16, tx: HOME_DOORS.pip.spot.x, tz: HOME_DOORS.pip.spot.z });
      if (npcState(S, 'mumble').met) add({ key: 'home:mumble', kind: 'place', icon: '🪵', name: t('map.home.mumble'), x: DEN.x, z: DEN.z, tx: HOME_DOORS.mumble.spot.x, tz: HOME_DOORS.mumble.spot.z });
    } else {
      add({ key: 'boat', kind: 'place', icon: '⛵', name: t('map.boatHome'), x: ISLE2_DOCK.x, z: ISLE2_DOCK.z0 + 2, tx: ISLE2_DOCK.x, tz: ISLE2_DOCK.z0 + 2 });
      add({ key: 'home:shelby', kind: 'place', icon: '🐚', name: t('map.home.shelby'), x: HUT.x, z: HUT.z, tx: HOME_DOORS.shelby.spot.x, tz: HOME_DOORS.shelby.spot.z });
    }
    // the villagers: where they are now ("!" wants to talk; asleep or in: at their home)
    for (const n of host.npcs || []) {
      if (n.away) continue;
      const home = HOME_DOORS[n.id]?.spot;
      const at = n.inside && home ? home : n;
      const talk = !n.sleep && !n.inside && host.hasNews(n.id);
      const name = t(`isl.npc.${n.id}`);
      add({ key: `npc:${n.id}`, kind: 'npc', icon: NPC_FACE[n.id] || '🙂', name, x: at.x, z: at.z, r: 2.4, css: n.def?.voice?.css || '#2b2340', talk, asleep: !!n.sleep && !!n.inside, live: !n.inside,
        sub: n.sleep && n.inside ? t('map.asleep') : n.inside ? t('map.atHome') : talk ? t('map.talk') : '' });
    }
    // today's activities
    for (const a of this.today(region)) if (a.x !== undefined) add({ kind: 'today', r: 2.6, ...a });
    // what Coach suggests trying next (a star; never a lock: everything stays open)
    const sug = host.coach?.suggestion?.();
    const sm = sug?.marker && out.find((m) => m.key === sug.marker || (sug.marker === 'trail:' && m.key.startsWith('trail:')));
    if (sm) { sm.suggest = true; sm.sub = [t('pp.map.suggest'), sm.sub].filter(Boolean).join(' · '); }
    return out;
  }

  /** Today's activities: { key, icon, name, x?, z? } (without a place they are only listed). */
  today(region = this.region) {
    const host = this.host, S = this.S, out = [];
    const today = dayKey();
    if (region === 'main') {
      const f = host.seasons?.festival;
      const FEST = { derby: { x: PIER.x, z: PIER.z0 + 6 }, fair: PLAZA, plant: PLAZA, lanterns: { x: 40, z: 20 }, beach: { x: 14, z: 37.5 } };
      if (f && FEST[f]) out.push({ key: `fest:${f}`, icon: '🎉', name: t('map.a.fest', { name: t(`isl.fest.${f}`) }), x: FEST[f].x, z: FEST[f].z });
      const sur = host.surprise;
      if (sur) {
        if (sur.cart?.visible) out.push({ key: 'sur:merchant', icon: '🛍️', name: t('map.a.merchant'), x: sur.merchant.position.x, z: sur.merchant.position.z });
        if (sur.skye?.visible) out.push({ key: 'sur:balloon', icon: '🎈', name: t('map.a.balloon'), x: sur.skye.position.x, z: sur.skye.position.z });
        if (sur.bottle?.visible) out.push({ key: 'sur:bottle', icon: '🍾', name: t('map.a.bottle'), x: sur.bottle.position.x, z: sur.bottle.position.z });
        if (sur.digX?.visible) out.push({ key: 'sur:dig', icon: '❌', name: t('map.a.dig'), x: sur.digX.position.x, z: sur.digX.position.z });
        if (sur.meteor) out.push({ key: 'sur:meteor', icon: '🌠', name: t('map.a.meteor') });
      }
      if (host.crabs?.danceNow?.()) out.push({ key: 'crabdance', icon: '💃', name: t('map.a.dance'), x: CRAB_COVE.x, z: CRAB_COVE.z });
      // ripe crops (on the field and in the greenhouse), the animals, letters
      for (const [f, F] of [[0, FIELD], [1, GREEN]]) {
        let n = 0;
        for (const [k, tile] of Object.entries(S.tiles || {})) if (parseKey(k).f === f && stageOf(tile) === 3) n++;
        if (n) { const c = tileCenter((F.cols - 1) / 2, (F.rows - 1) / 2, f); out.push({ key: `crops:${f}`, icon: '🌾', name: t('map.a.crops', { n }), x: c.x, z: c.z, r: 4.5 }); }
      }
      const R = S.ranch;
      if (S.unlocks.barn && R?.animals?.length && (R.nest > 0 || R.trough <= 0 || R.animals.some((a) => a.ready || a.petDay !== today))) {
        out.push({ key: 'animals', icon: '🐔', name: t('map.a.animals'), x: (PADDOCK.x0 + PADDOCK.x1) / 2, z: (PADDOCK.z0 + PADDOCK.z1) / 2, r: 5 });
      }
      if (S.mail?.length) out.push({ key: 'mail', icon: '📫', name: t('map.a.mail'), x: MAILBOX.x, z: MAILBOX.z });
      // leaf piles in autumn
      const G = S.games;
      if (host.games?.season === 'autumn' && G?.leaves) LEAF_PILES.forEach(([x, z], i) => { if (!(G.leaves.day === today && G.leaves.done.includes(i))) out.push({ key: `leaves:${i}`, icon: '🍂', name: t('map.a.leaves'), x, z }); });
      // a chest you found filled up again: only a line (the hidden areas stay hidden)
      if (host.hops && Object.keys(S.hops?.chests || {}).some((id) => host.hops.chestFull(id))) out.push({ key: 'chests', icon: '🎁', name: t('map.a.chests') });
    } else {
      const I = S.isle2 || {}, week = weekIndex();
      PALMS.forEach(([x, z], i) => { if (I.palms?.[i] !== today) out.push({ key: `palm:${i}`, icon: '🥥', name: t('map.a.palm'), x, z }); });
      BERRIES.forEach(([x, z], i) => { if (I.berries?.[i] !== today) out.push({ key: `berries:${i}`, icon: '🫐', name: t('map.a.berries'), x, z }); });
      POOLS.forEach((p, i) => { if (I.pools?.[i] !== today) out.push({ key: `pool:${i}`, icon: '🫧', name: t('map.a.pool'), x: p.x, z: p.z }); });
      DIGS.forEach(([x, z], i) => { if (I.digs?.[i] !== week) out.push({ key: `dig:${i}`, icon: '💰', name: t('map.a.digIsle'), x, z }); });
    }
    // today's crab: on the map where you are (not the hidden cove's), else only in the list (the other island, the dive)
    const crabs = host.crabs?.waiting?.(region) || [];
    for (const o of crabs) out.push({ key: `crab:${o.id}`, icon: '🦀', name: t('map.a.crab'), x: o.x, z: o.z });
    const T = host.crabs && S.intro ? todaysCrab(S) : null;
    if (T && !T.helped && !crabs.length && T.area !== region) out.push({ key: 'crab:away', icon: '🦀', name: t('map.a.crabAway', { where: t(`crab.where.${T.area}`) }) });
    return out;
  }

  // ---------- the map tab (journal.js) ----------

  /** Draw the map (the journal's Map tab). read: read the place you are on (when read-aloud is on). */
  render() {
    const host = this.host, hud = host.hud, region = this.region, R = REGIONS[region];
    const P = host.player;
    this.list = this.markers(region);
    // the cursor starts where you are (and again on the other island's map)
    if (!this.cur || this.curRegion !== region) this.cur = P ? { x: P.x, z: P.z } : { x: (R.x0 + R.x1) / 2, z: (R.z0 + R.z1) / 2 };
    this.curRegion = region;
    this.cur.x = THREE.MathUtils.clamp(this.cur.x, R.x0, R.x1);
    this.cur.z = THREE.MathUtils.clamp(this.cur.z, R.z0, R.z1);
    const pos = (x, z) => `left:${(((x - R.x0) / (R.x1 - R.x0)) * 100).toFixed(2)}%;top:${(((z - R.z0) / (R.z1 - R.z0)) * 100).toFixed(2)}%`;
    const tk = this.target?.key;
    const mk = this.list.map((m, i) => {
      const cls = ['isl-mk', m.kind, m.locked ? 'dim' : '', m.key === tk ? 'tgt' : ''].join(' ');
      const badge = (m.suggest ? '<i class="sg">⭐</i>' : '') + (m.isNew ? '<i class="nw">✨</i>' : '') + (m.locked ? '<i class="lk">🔒</i>' : '') + (m.talk ? '<i class="ex">!</i>' : '') + (m.asleep ? '<i class="zz">💤</i>' : '');
      const body = m.kind === 'npc' ? `<b style="--c:${m.css}">${m.icon}</b>` : m.icon;
      return `<div class="${cls}" data-i="${i}" style="${pos(m.x, m.z)}">${body}${badge}</div>`;
    }).join('');
    // the bridge once it is fixed
    const S = this.S;
    const bridge = region === 'main' && S.unlocks.bridge
      ? `<svg class="lines" viewBox="0 0 ${R.x1 - R.x0} ${R.z1 - R.z0}" preserveAspectRatio="none"><path d="M${BRIDGE.x - BRIDGE.len / 2 - R.x0} ${BRIDGE.z - R.z0} H${BRIDGE.x + BRIDGE.len / 2 - R.x0}" stroke="#a06a3a" stroke-width="2.2"/></svg>` : '';
    const you = P ? `<div class="isl-mk you" style="${pos(P.x, P.z)}">${youArrow(P.p?.css || '#4cc9f0')}</div>` : '';
    // the legend shows each kind of marker as it looks on the map
    const legend = [['you', `<span style="display:inline-block;width:1.2em">${youArrow(P?.p?.css || '#4cc9f0')}</span>`], ['game', '🎪'], ['new', '✨'], ['suggest', '⭐'], ['place', '🏠'],
      ['npc', '<b class="lgf">🙂</b>'], ['talk', '<b class="lgx">!</b>'], ['sleep', '💤'], ['today', '<span class="tdy">🌾</span>'], ['target', '🎯']]
      .map(([k, ic]) => `<div><span>${ic}</span>${esc(t(`map.lg.${k}`))}</div>`).join('');
    const today = this.today(region);
    const todayHtml = today.length ? today.filter((a, i, all) => all.findIndex((b) => b.name === a.name) === i).slice(0, 7).map((a) => `<div><span>${a.icon}</span>${esc(a.name)}</div>`).join('') : `<div>${esc(t('map.nothing'))}</div>`;
    hud.setPanel(`<div class="isl-map">
      <div class="isl-map-box" style="aspect-ratio:${R.x1 - R.x0}/${R.z1 - R.z0}">${bridge}${mk}${you}<div class="isl-map-cur"></div></div>
      <div class="isl-map-side"><div class="isl-map-cap"></div><div class="isl-map-legend">${legend}</div>
        <div class="isl-map-today"><b>${esc(t('map.today'))}</b>${todayHtml}</div></div></div>`);
    const box = hud.panel.querySelector('.isl-map-box');
    this.box = box;
    if (box) box.prepend(drawTerrain(region, host.map));
    this.capEl = hud.panel.querySelector('.isl-map-cap');
    this.curEl = hud.panel.querySelector('.isl-map-cur');
    this.youEl = hud.panel.querySelector('.isl-mk.you');
    this.mkEls = [...hud.panel.querySelectorAll('.isl-mk[data-i]')];
    this.hover = null;
    this.capKey = undefined;
    this.drawnRegion = region;
    this.liveT = 0;
    this.placeCursor();
    this.findHover();
  }

  placeCursor() {
    if (!this.curEl) return;
    const R = REGIONS[this.region];
    this.curEl.style.left = `${((this.cur.x - R.x0) / (R.x1 - R.x0)) * 100}%`;
    this.curEl.style.top = `${((this.cur.z - R.z0) / (R.z1 - R.z0)) * 100}%`;
  }

  /** The marker under the cursor (the nearest one in reach), highlighted, with its name in the caption. */
  findHover() {
    let best = null, bd = SNAP;
    for (const m of this.list) {
      const d = Math.hypot(m.x - this.cur.x, m.z - this.cur.z);
      if (d < bd) { bd = d; best = m; }
    }
    if (best !== this.hover) {
      this.hover = best;
      this.hoverT = 0;
      this.mkEls?.forEach((el) => el.classList.toggle('on', this.list[+el.dataset.i] === best));
      this.curEl?.classList.toggle('hit', !!best);
    }
    this.caption();
  }

  caption() {
    const m = this.hover, tk = this.target?.key;
    const key = `${m?.key}|${tk}|${m?.sub}`;
    if (!this.capEl || key === this.capKey) return;
    this.capKey = key;
    const P = this.host.player?.p;
    if (!m) { this.capEl.innerHTML = `<div class="nm">${esc(t(this.region === 'isle' ? 'map.isle' : 'map.main'))}</div><small>${esc(t('map.idle'))}</small>`; return; }
    const on = m.key === tk;
    this.capEl.innerHTML = `<div class="nm"><span>${m.icon}</span>${esc(m.name)}</div>${m.sub ? `<small>${esc(m.sub)}</small>` : ''}
      ${on ? `<small>🎯 ${esc(t('map.isTarget'))}</small>` : ''}<span class="k">${esc(tFor(P, on ? 'map.unpick' : 'map.pick'))}</span>`;
  }

  /** Every frame on the Map tab: the cursor, picking, the moving markers. */
  update(inp, dt) {
    const host = this.host, R = REGIONS[this.region];
    if (this.drawnRegion !== this.region) { this.render(); return; }
    // the stick (or a gamepad's D-pad) moves the cursor
    const dev = host.playerDevice, B = dev?.btn || {};
    let mx = inp.x || 0, my = inp.y || 0;
    if (B.left) mx = -1; if (B.right) mx = 1; if (B.up) my = 1; if (B.down) my = -1;
    if (Math.hypot(mx, my) > 0.2) {
      const sp = CURSOR_SPEED * (R.x1 - R.x0) * dt;
      this.cur.x = THREE.MathUtils.clamp(this.cur.x + mx * sp, R.x0, R.x1);
      this.cur.z = THREE.MathUtils.clamp(this.cur.z - my * sp, R.z0, R.z1);
      this.mouse = false;
    }
    this.placeCursor();
    // things that move: you and the villagers (a few times a second)
    this.liveT -= dt;
    if (this.liveT <= 0) {
      this.liveT = 0.25;
      const fresh = this.markers();
      for (const el of this.mkEls) {
        const m = this.list[+el.dataset.i];
        if (!m?.live) continue;
        const f = fresh.find((x) => x.key === m.key);
        if (!f) continue;
        m.x = f.x; m.z = f.z; m.tx = f.tx; m.tz = f.tz;
        el.style.left = `${((m.x - R.x0) / (R.x1 - R.x0)) * 100}%`;
        el.style.top = `${((m.z - R.z0) / (R.z1 - R.z0)) * 100}%`;
      }
    }
    const P = host.player;
    if (P && this.youEl) {
      this.youEl.style.left = `${((P.x - R.x0) / (R.x1 - R.x0)) * 100}%`;
      this.youEl.style.top = `${((P.z - R.z0) / (R.z1 - R.z0)) * 100}%`;
      this.youEl.style.transform = `translate(-50%, -50%) rotate(${Math.atan2(P.fx, -P.fz)}rad)`;
    }
    this.findHover();
    // the name under the cursor is read aloud once it rests there
    this.hoverT += dt;
    if (this.hover && this.hoverT > READ_AFTER && this.read !== this.hover.key) {
      this.read = this.hover.key;
      speak(this.hover.sub ? `${this.hover.name}. ${this.hover.sub}.` : this.hover.name, 'narrator');
    }
    if (!this.hover) this.read = null;
    // [OK] (A on a gamepad; Space or E on a keyboard) picks
    if (inp.aPressed || (!host.onPad && inp.bPressed)) this.pick();
  }

  /** [OK] on the map: the arrow points to the marker under the cursor (or, on the one it points to, turns off). */
  pick() {
    const host = this.host, m = this.hover;
    if (!m) { host.game.audio.play('bump'); return; }
    if (this.target?.key === m.key) {
      this.setTarget(null);
      host.game.ui.toast(t('map.off'), 1400);
      this.capKey = undefined;
      this.render();
      return;
    }
    this.setTarget(m);
    host.game.audio.play('star');
    host.journal.close();
    host.game.ui.toast(t('map.set', { name: m.name }), 2200);
  }

  setTarget(m) {
    this.target = m ? { key: m.key, name: m.name, icon: m.icon, x: m.tx ?? m.x, z: m.tz ?? m.z, r: m.r ?? 3, live: !!m.live } : null;
    this.S.mapTarget = m ? m.key : null;
    this.host.markDirty?.();
  }

  // ---------- the arrow ----------

  /** Every frame: the arrow that points the way, and arriving. */
  updateCompass(dt) {
    const host = this.host, P = host.player, el = this.compass;
    // a target saved from before (back from a game): find it again
    if (!this.target && this.S.mapTarget && P) {
      const m = this.markers(isIsle(P.z) ? 'main' : 'isle').concat(this.markers(isIsle(P.z) ? 'isle' : 'main')).find((x) => x.key === this.S.mapTarget);
      if (m) this.setTarget(m); else this.S.mapTarget = null;
    }
    const T = this.target;
    if (!T || !P || host.mode !== 'walk' || host.hud.cinemaOn || host.camView || host.launching) { el.style.display = 'none'; return; }
    // things that move (villagers, crabs) are followed
    this.refreshT -= dt;
    if (this.refreshT <= 0 && T.live !== false) {
      this.refreshT = 0.5;
      const m = this.markers(isIsle(T.z) ? 'isle' : 'main').find((x) => x.key === T.key);
      if (m) { T.x = m.tx ?? m.x; T.z = m.tz ?? m.z; }
    }
    // on the other island: the boat first
    const here = isIsle(P.z), there = isIsle(T.z);
    const goal = here === there ? T : here ? { x: ISLE2_DOCK.x, z: ISLE2_DOCK.z0 + 2 } : MAIN_BOARD;
    if (here === there && Math.hypot(P.x - T.x, P.z - T.z) < T.r) {
      host.game.audio.play('fanfare');
      host.game.ui.toast(t('map.there', { name: T.name }), 2200);
      this.setTarget(null);
      el.style.display = 'none';
      return;
    }
    const cam = host.camera, W = window.innerWidth, H = window.innerHeight;
    // (aimed over the place's sign and a villager's name tag)
    _v.set(goal.x, Math.max(SEA_Y, heightAt(goal.x, goal.z)) + 4.4, goal.z).project(cam);
    const sx = ((_v.x + 1) / 2) * W, sy = ((1 - _v.y) / 2) * H;
    const ML = 60, MR = 60, MT = 96, MB = 150; // keep off the clock, the tasks and the hotbar
    let x, y, ang;
    if (_v.z < 1 && sx > ML && sx < W - MR && sy > MT && sy < H - MB) {
      // on screen: just above it, pointing down (and bobbing)
      x = sx; y = sy - 10 - Math.abs(Math.sin(host.time * 4)) * 10; ang = Math.PI;
    } else {
      // off screen: on the edge, toward it
      _p.set(P.x, (P.y || 0) + 0.6, P.z).project(cam);
      const px = ((_p.x + 1) / 2) * W, py = ((1 - _p.y) / 2) * H;
      let dx, dy;
      if (_v.z < 1) { dx = sx - px; dy = sy - py; } else { dx = goal.x - P.x; dy = goal.z - P.z; }
      const len = Math.hypot(dx, dy) || 1;
      dx /= len; dy /= len;
      const cx = (ML + W - MR) / 2, cy = (MT + H - MB) / 2, hw = (W - MR - ML) / 2, hh = (H - MB - MT) / 2;
      const k = Math.min(hw / Math.max(1e-3, Math.abs(dx)), hh / Math.max(1e-3, Math.abs(dy)));
      x = cx + dx * k; y = cy + dy * k;
      ang = Math.atan2(dx, -dy);
    }
    el.style.display = 'block';
    el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    this.arEl.style.transform = `rotate(${ang.toFixed(3)}rad)`;
    this.icEl.style.top = ang === Math.PI ? '-56px' : '20px'; // over the target: its picture above the arrow, not on the sign
    const ic = here === there ? T.icon : `⛵`;
    if (this.icEl.textContent !== ic) this.icEl.textContent = ic;
    this.compassAt = { x, y, ang, onScreen: ang === Math.PI };
  }

  dispose() {
    this.host.hud.panel.removeEventListener('mousemove', this.onMove);
    this.host.hud.panel.removeEventListener('click', this.onClick);
    this.compass.remove();
  }
}

const _v = new THREE.Vector3(), _p = new THREE.Vector3();
