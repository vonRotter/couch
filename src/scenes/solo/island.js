import * as THREE from 'three';
import { BaseScene } from '../../core/scene.js';
import { Character } from '../../core/character.js';
import { toon, basic } from '../../core/palette.js';
import { addLights } from '../../core/world.js';
import { t, tFor } from '../../core/i18n.js';
import { esc } from '../../core/ui.js';
import { say as speak } from '../../core/voice.js';
import { ProfilePicker } from '../../core/profiles.js';
import { SKYHOP_LEVELS } from '../skyhop-levels.js';
import './strings.js';
import './strings2.js';
import './strings3.js';
import './strings4.js';
import { Ranch } from './animals.js';
import { Builder } from './build.js';
import { Seasons } from './seasons.js';
import { now, hourOf, since, loadIsland, count, give, take, MIN, HOUR } from './save.js';
import { ITEMS, CROPS, TOOLS, isGift, shopStock, icon, setPictures, inSeason } from './items.js';
import { FISH, FISH_IDS, RECIPES, seaModel, makeDish, hasSeaModel } from './sea.js';
import { thumb } from './thumbs.js';
import { Fishing } from './fishing.js';
import { Cafe } from './cafe.js';
import { DiveScene } from './dive.js';
import { IslandMap, heightAt, riverDist, DIVE_BOAT, CAFE, HOME, FIELD, BIN, MAILBOX, STORE, HALL, BRIDGE, ROCKFALL, BRANCHES, FINDS, PLACES } from './map.js';
import { Farm, tileAt, tileCenter, stageOf, minutesLeft, FIELDS } from './farm.js';
import { NPCS, NPC_IDS, npcState, heartsOf, scheduleNow, taste, canTalkBonus, canGift, makeNpcModel, PTS_PER_HEART, MAX_HEARTS, TALK_PTS, GIFT_PTS } from './npcs.js';
import { IslandHud, heartsHtml } from './hud.js';
import { Life } from './life.js';
import { SEASON_ICON, dayKey, dayRand } from './calendar.js';
import { ToastQueue } from './toasts.js';
import { Greenhouse } from './greenhouse.js';
import { Museum } from './museum.js';
import { Isle2 } from './isle2.js';
import { mesh, box, sph, makeTool, makeDeco, makeBranch, makeSign } from './models.js';

// The solo island: a little farming town that is also the menu to the solo games.
// One player (with the profile's name, color and hat). Games are PLACES you walk to; some open through
// island play (fix the bridge, clear the rockfall, befriend Mumble). Crops grow in real time, the light
// follows the real clock, and the townsfolk keep their own daily routines. Saved per profile in
// roster.progress.island (see save.js). Tests can shift the clock with window.__islandTimeOffset (ms).

const SPEED = 6.2;
const PR = 0.42;
const CAM_UP = 12.5, CAM_BACK = 13; // a bit further than the shared island's closest framing (10.4 / 10.4)
const MODES = ['island', 'story', 'solo'];
const BRIDGE_WOOD = 10;
const FARM_OBJS = ['sprinkler', 'scarecrow'];
const SELLABLE = new Set(['crop', 'fish', 'sea', 'treasure', 'dish', 'produce', 'crystal', 'forage']);
const PARTY = [0xff5d73, 0xffc93c, 0x3ddc97, 0x4cc9f0, 0x9b5de5];
const ROCK_HITS = 5;
const BRANCH_RESPAWN = 15 * MIN;
const NPC_SPEED = 2.6;
const TALK_R = 2.0;
const DOOR_R = 1.9;

// The trophy garden between the farm and the square: 3 rows of 5 spots for decorations.
const DECO_ORDER = ['lhLamp', 'lhTrophy', 'duckTrophy', 'kite', 'hopTrophy', 'banner', 'statue', 'gnome', 'pumpkinLamp', 'bottle', 'lantern', 'spyglass', 'rocket', 'moonrock', 'castleTrophy'];
const DECO_SPOTS = DECO_ORDER.map((id, i) => ({ id, x: -1.6 + (i % 5) * 1.35, z: -4.2 + Math.floor(i / 5) * 1.6 }));
const TROPHY_SIGN = { x: -2.6, z: -0.8 };

// Signs you can read with [B].
const SIGNS = [
  { x: BRIDGE.x + BRIDGE.len / 2 + 1.0, z: BRIDGE.z + 2.0, key: 'isl.sign.bridge', bridge: true },
  { x: -5.2, z: 40.6, key: 'isl.sign.cafe', key2: 'isl.sign.cafe2', when: (S) => S.cafe.repaired },
  { x: -2, z: 42.6, key: 'isl.sign.dive2' },
  { x: -7.6, z: 4.2, key: 'isl.sign.barn', key2: 'isl.sign.barn2', when: (S) => S.unlocks.barn },
  { x: TROPHY_SIGN.x, z: TROPHY_SIGN.z, key: 'isl.sign.trophy' },
];

// Day and night from the real clock: [hour, look].
const NIGHT = { hemi: 0x7a88d8, ground: 0x3a4070, hi: 0.8, sun: 0x9fb4ff, si: 0.5, fog: 0x1c2550, water: 0x3a6aa8, night: 1 };
const DAY = { hemi: 0xffffff, ground: 0x9ad48a, hi: 1.45, sun: 0xfff2dd, si: 1.85, fog: 0xbfeeff, water: 0x56c6f0, night: 0 };
const SKY = [
  [0, NIGHT], [4.6, NIGHT],
  [6, { hemi: 0xffb08a, ground: 0x6a7a8a, hi: 1.0, sun: 0xffa070, si: 1.0, fog: 0xffb89a, water: 0x5aa8d8, night: 0.45 }],
  [8, DAY], [16.5, DAY],
  [18.5, { hemi: 0xffc59a, ground: 0x8a8a7a, hi: 1.2, sun: 0xff9a5a, si: 1.35, fog: 0xffb48a, water: 0x58a8d8, night: 0.2 }],
  [20, { hemi: 0x9a8ad0, ground: 0x4a4070, hi: 0.85, sun: 0xb090ff, si: 0.7, fog: 0x4a3a7a, water: 0x3a6aaa, night: 0.7 }],
  [21.5, NIGHT], [24, NIGHT],
];
const _ca = new THREE.Color(), _cb = new THREE.Color();
function skyAt(h) {
  let i = 0;
  while (i < SKY.length - 2 && SKY[i + 1][0] <= h) i++;
  const [h0, a] = SKY[i], [h1, b] = SKY[i + 1];
  const k = h1 > h0 ? THREE.MathUtils.clamp((h - h0) / (h1 - h0), 0, 1) : 0;
  const col = (key) => _ca.set(a[key]).lerp(_cb.set(b[key]), k).getHex();
  return { hemi: col('hemi'), ground: col('ground'), sun: col('sun'), fog: col('fog'), water: col('water'), hi: a.hi + (b.hi - a.hi) * k, si: a.si + (b.si - a.si) * k, night: a.night + (b.night - a.night) * k };
}

/** Rewards the games send by mail, from the profile's game progress. */
function gameRewards(p) {
  const out = [];
  const lh = p.lighthouse || {};
  if (lh.crystals > 0) out.push({ id: 'lh1', from: 'lh', items: [['pumpkinSeed', 2]], deco: 'lhLamp' });
  if (lh.flags?.finale) out.push({ id: 'lh2', from: 'lh', items: [['starfruitSeed', 1]], deco: 'lhTrophy' });
  if (lh.crystals > 0) out.push({ id: 'lhc1', from: 'lh', items: [['lampCrystal', 1]] }); // milestone B3: for the museum
  const adv = p.adventure || {};
  if (adv.done) out.push({ id: 'adv1', from: 'adv', items: [['strawberrySeed', 3]], deco: 'flag' });
  if (adv.done2) out.push({ id: 'adv2', from: 'adv', items: [['tomatoSeed', 3]], coins: 100 });
  const dh = p.duckhunt || {};
  if (dh.best > 0) out.push({ id: 'duck1', from: 'duck', deco: 'duckTrophy', coins: 20 });
  if (dh.bestRound >= 5) out.push({ id: 'duck2', from: 'duck', deco: 'duckGold' });
  const hop = p.skyhop || 0;
  if (hop >= 1) out.push({ id: 'hop1', from: 'hop', items: [['cornSeed', 2]], deco: 'kite' });
  if (hop >= SKYHOP_LEVELS.length) out.push({ id: 'hop2', from: 'hop', deco: 'hopTrophy' });
  if (p.castleCampaign?.won?.some(Boolean)) out.push({ id: 'castle1', from: 'castle', items: [['pumpkinSeed', 1]], deco: 'banner' });
  const gs = (p.guides?.stars || []).reduce((a, b) => a + (b || 0), 0);
  if (gs >= 3) out.push({ id: 'guides1', from: 'guides', items: [['radishSeed', 5]], deco: 'statue' });
  return out;
}

const itemName = (id) => t(ITEMS[id] ? `isl.i.${id}` : `isl.d.${id}`);

export class SoloIslandScene extends BaseScene {
  constructor(game, { fromGame = null } = {}) {
    super(game);
    this.toasts = new ToastQueue(game.ui); // one or two pop-ups at a time, paused under panels
    this.key = null;
    this.ownMenu = true; // main.js: Esc is our help, not the game pause menu
    this.camera.fov = 45;
    this.camera.far = 320;
    this.camera.updateProjectionMatrix();
    this.save = loadIsland(game.roster);
    const S = this.save;

    // night-aware materials: windows, lamps, the lighthouse beam, arcade screens
    const gm = toon(0xffffff).gradientMap;
    this.M = {
      win: new THREE.MeshToonMaterial({ color: 0x9fdcff, gradientMap: gm }),
      lamp: new THREE.MeshBasicMaterial({ color: 0xf3ead2 }),
      beam: new THREE.MeshBasicMaterial({ color: 0xfff3b0, transparent: true, opacity: 0, depthWrite: false }),
      screen: new THREE.MeshBasicMaterial({ color: 0x5ad6ff }),
    };
    this.scene.background = new THREE.Color(0xbfeeff);
    this.scene.fog = new THREE.Fog(0xbfeeff, 60, 150);
    this.lights = addLights(this.scene, { size: 30 });
    this.lamps = [];
    for (let i = 0; i < 4; i++) {
      const l = new THREE.PointLight(0xffc070, 0, 11, 1.4);
      this.scene.add(l);
      this.lamps.push(l);
    }

    this.map = new IslandMap(this.scene, this.M);
    this.farm = new Farm(this.scene, S);
    this.life = new Life(this, this.map);
    this.hud = new IslandHud(game);
    setPictures((id) => this.picture(id));
    this.fishing = new Fishing(this);
    this.cafe = new Cafe(this);

    this.mode = 'walk';
    this.dlg = null;
    this.modeEl = null;
    this.profilePicker = null;
    this.helpEl = null;
    this.launching = false;
    this.secT = 0;
    this.saveT = 0;
    this.dirty = false;
    this.swing = 0;
    this.camPos = new THREE.Vector3();
    this.camTarget = new THREE.Vector3();

    this.buildDynamic();
    this.ranch = new Ranch(this);
    this.builder = new Builder(this);
    this.greenhouse = new Greenhouse(this);
    this.museum = new Museum(this);
    this.isle2 = new Isle2(this);
    this.farm.objModel = (id) => this.builder.model(id); // sprinklers and scarecrows on the field
    this.seasons = new Seasons(this);
    this.spawnNpcs();
    this.checkRewards();

    // the player
    this.player = null;
    const place = this.map.places.find((p) => p.key === fromGame) || (S.last.place && !since(S.last.at, 6 * HOUR) && this.map.places.find((p) => p.id === S.last.place));
    this.spawnAt = place ? { x: place.door.x, z: place.door.z + (place.cabinet !== undefined ? 1.6 : 1.2) } : { x: HOME.x + 0.8, z: HOME.z + 4.2 };
    if (fromGame === 'dive') this.spawnAt = { x: DIVE_BOAT.x - 1.0, z: DIVE_BOAT.z + 1.0 };
    if (this.players.length) this.spawn(this.players[0]);
    S.last.place = null;
    this.applyUnlocks(true);
    this.applySky(true);
    this.secondTick();
    this.snapCamera();

    if (fromGame === 'dive' && S.sea.haul) {
      const h = S.sea.haul;
      const n = h.items.reduce((a, [, k]) => a + k, 0);
      this.later(0.8, () => this.game.ui.toast(t('isl.t.got', { item: `${n} × ${t('dive.title')}` }), 1800));
      S.sea.haul = null;
    }
    if (fromGame === 'cave') this.caveCrystal();
    if (!S.intro) this.later(0.9, () => this.startIntro());
    else if (S.mail.length) this.later(1.2, () => this.mailToast());
    game.audio.playMusic('hub');
  }

  // ---------- building ----------

  buildDynamic() {
    const S = this.save;
    // decorations
    this.decoViews = new Map();
    if (S.deco.flag) this.placeDeco('flag', false); // other decorations are yard pieces (build.js)
    this.put(makeSign(0xc9a8ff), TROPHY_SIGN.x, TROPHY_SIGN.z);
    // hedge around the trophy garden
    for (let i = 0; i < 9; i++) this.put(mesh(sph(0.36, 8, 6), 0x4cc46a, 0, 0.25, 0), -2.4 + i * 0.85, -5.3);
    // branches (wood)
    this.branches = BRANCHES.map(([x, z], i) => {
      const g = makeBranch();
      g.rotation.y = i * 1.7;
      this.put(g, x, z);
      return { i, x, z, g };
    });
    // quest finds
    this.finds = {};
    for (const [id, p] of Object.entries(FINDS)) {
      const g = new THREE.Group();
      if (id === 'feather') { const f = mesh(sph(0.2, 8, 6), 0xff9fd0, 0, 0.3, 0); f.scale.set(0.5, 0.3, 1.6); g.add(f); }
      else if (id === 'starmap') { g.add(mesh(box(0.7, 0.04, 0.5), 0x2e3b6b, 0, 0.1, 0), mesh(sph(0.05, 6, 4), 0xffe14a, 0.1, 0.14, 0.05), mesh(sph(0.05, 6, 4), 0xffe14a, -0.15, 0.14, -0.1)); }
      else g.add(mesh(sph(0.25, 12, 8), toon(0xbff6ff, { emissive: 0x2a5560 }), 0, 0.25, 0));
      const glint = mesh(box(0.08, 0.5, 0.08), basic(0xffffff), 0, 0.9, 0, false);
      g.add(glint);
      g.userData.glint = glint;
      this.put(g, p.x, p.z);
      this.finds[id] = { ...p, g };
    }
    // place labels (game names on their signs)
    this.placeTags = this.map.places.map((pl) => {
      const el = this.game.ui.label('label isl-tag');
      return { pl, el, pos: new THREE.Vector3(pl.door.x, heightAt(pl.door.x, pl.door.z) + (pl.cabinet !== undefined ? 3.8 : 2.6), pl.door.z) };
    });
    this.markEl = this.game.ui.label('label isl-mark');
    this.hallTag = this.game.ui.label('label isl-tag');
    this.hallPos = new THREE.Vector3(HALL.x, 5.6, HALL.z + 2.8);
  }

  /** Picture of a sea thing or dish (rendered once). */
  picture(id) {
    if (!hasSeaModel(id)) return this.builder ? thumb(this.game.renderer, `craft:${id}`, () => this.builder.model(id), { rx: 0.35, ry: -0.6 }) : '';
    return thumb(this.game.renderer, id, () => seaModel(id), FISH[id] ? { ry: -0.35 } : RECIPES[id] ? { rx: 0.85 } : { rx: 0.45 });
  }

  dishModel(id) {
    const m = makeDish(id);
    m.scale.setScalar(0.7);
    return m;
  }

  put(obj, x, z, y = null) {
    obj.position.set(x, y ?? heightAt(x, z), z);
    this.scene.add(obj);
    return obj;
  }

  placeDeco(id, celebrate) {
    if (this.decoViews.has(id)) return;
    let g;
    if (id === 'flag') {
      g = makeDeco('flag', this.M);
      this.put(g, HOME.x - 2.35, HOME.z + 2.15, 2.6); // on the front corner of the house
    } else {
      const spot = DECO_SPOTS.find((s) => s.id === id) || DECO_SPOTS.find((s) => s.id === 'castleTrophy');
      if (id === 'duckGold' && this.decoViews.has('duckTrophy')) { this.decoViews.get('duckTrophy').removeFromParent(); }
      g = makeDeco(id, this.M);
      const s = id === 'duckGold' ? DECO_SPOTS.find((d) => d.id === 'duckTrophy') : spot;
      this.put(g, s.x, s.z);
      g.rotation.y = 0.3;
    }
    this.decoViews.set(id, g);
    if (celebrate) this.confetti.burst(g.position.clone().add(new THREE.Vector3(0, 1.5, 0)), 0, { colors: PARTY, count: 40, speed: 6, up: 4, life: 1.4, gravity: -6 });
  }

  spawnNpcs() {
    this.npcs = NPC_IDS.map((id) => {
      const model = makeNpcModel(id);
      const at = now();
      const s = scheduleNow(id, at, this.save);
      const n = { id, def: NPCS[id], model, x: s.spot.x, z: s.spot.z, y: 0, route: [], spotName: s.name, sleep: s.sleep, moving: false, wanderT: 2, hop: 0 };
      model.group.position.set(n.x, heightAt(n.x, n.z), n.z);
      model.face?.(0, 1);
      this.scene.add(model.group);
      n.tag = this.game.ui.label('label isl-tag');
      n.zzz = this.game.ui.label('label isl-zzz');
      n.zzz.textContent = 'Zzz';
      n.tagPos = new THREE.Vector3();
      return n;
    });
    // Mumble only appears once you know about the meadow... he is always there, just shy.
  }

  npc(id) { return this.npcs.find((n) => n.id === id); }

  // ---------- players ----------

  spawn(p) {
    const ch = new Character(p.color, { hat: p.hat });
    const { x, z } = this.spawnAt;
    ch.group.position.set(x, heightAt(x, z), z);
    this.scene.add(ch.group);
    const hand = new THREE.Group();
    hand.position.set(0.42, 0.42, 0.12);
    ch.pivot.add(hand);
    this.player = { p, ch, x, z, y: heightAt(x, z), fx: 0, fz: 1, hand, toolId: null, toolMesh: null };
    ch.face(0, 1);
    this.puffs.burst(new THREE.Vector3(x, 0.6, z), 0xffffff, { count: 14, speed: 4, size: 0.4 });
  }

  handleJoins() {
    const roster = this.game.roster;
    for (const d of this.game.input.joinRequests()) {
      if (roster.has(d.id)) continue;
      if (roster.players.length) {
        roster.players[0].deviceId = d.id; // one player: a new controller takes over
        this.game.ui.toast(t('solo.takeover'));
        continue;
      }
      const p = roster.join(d);
      if (!p) continue;
      this.game.applyProfile(p);
      this.spawn(p);
      this.game.audio.play('join');
    }
    if (this.player && !this.players.includes(this.player.p)) {
      this.scene.remove(this.player.ch.group);
      this.player = null;
    }
    if (!this.player && this.players.length) this.spawn(this.players[0]);
  }

  // ---------- real time ----------

  secondTick() {
    const at = now();
    this.farm.tick(at);
    // tutorial: a crop became ripe
    if (this.save.tut === 4 && Object.values(this.save.tiles).some((tl) => stageOf(tl) === 3)) this.setTut(5);
    for (const n of this.npcs) this.scheduleNpc(n, at);
    for (const b of this.branches) b.g.visible = since(this.save.branches[b.i], BRANCH_RESPAWN, at);
    for (const [id, f] of Object.entries(this.finds)) f.g.visible = this.findActive(id);
    this.ranch.tick(at);
    this.builder.tickGather(at);
    this.seasons.tick(at);
    this.isle2.tick(at);
    this.applySky(false);
    this.chooseLamps();
  }

  applySky() {
    const h = hourOf();
    this.hour = h;
    const s = this.seasons ? this.seasons.weatherSky(skyAt(h)) : skyAt(h);
    this.night = s.night;
    const L = this.lights;
    L.hemi.color.setHex(s.hemi);
    L.hemi.groundColor.setHex(s.ground);
    L.hemi.intensity = s.hi;
    L.sun.color.setHex(s.sun);
    L.sun.intensity = s.si;
    this.scene.fog.color.setHex(s.fog);
    this.scene.background.setHex(s.fog);
    this.map.water.material.color.setHex(s.water);
    // the sun travels east to west during the day; the moon hangs high in the south-west at night
    const dayK = THREE.MathUtils.clamp((h - 6) / 13, 0, 1);
    this.sunDir = s.night > 0.6 ? new THREE.Vector3(-0.4, 1, 0.5) : new THREE.Vector3(0.9 - dayK * 1.8, 1, 0.55);
    const lit = s.night > 0.3;
    this.M.win.color.setHex(lit ? 0xffd27a : 0x9fdcff);
    this.M.win.emissive.setHex(lit ? 0x9a6a10 : 0x000000);
    this.M.lamp.color.setHex(lit ? 0xffe08a : 0xf3ead2);
    this.M.beam.opacity = lit ? 0.22 : 0;
    this.M.screen.color.setHex(lit ? 0x8ff0ff : 0x5ad6ff);
    for (const l of this.lamps) l.intensity = lit ? 14 * Math.min(1, (s.night - 0.3) * 2 + 0.3) : 0;
  }

  /** Put the few real point lights on the lamps closest to the player. */
  chooseLamps() {
    const p = this.player || { x: HOME.x, z: HOME.z };
    const spots = [...this.map.lampSpots].sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z));
    this.lamps.forEach((l, i) => { const s = spots[i]; if (s) l.position.set(s.x, s.y - 0.4, s.z); });
  }

  phaseName(h) {
    return t(h < 5 || h >= 21 ? 'isl.night' : h < 11 ? 'isl.morning' : h < 17 ? 'isl.day' : 'isl.evening');
  }

  // ---------- NPC life ----------

  scheduleNpc(n, at) {
    if (n.talking || n.intro || n.busy) return;
    const s = scheduleNow(n.id, at, this.save);
    n.sleep = s.sleep;
    let tx = s.spot.x, tz = s.spot.z;
    // between the islands (Shelby's weekend visits): hop over instead of walking on the sea
    if (Math.hypot(tx - n.x, tz - n.z) > 60) {
      n.x = tx; n.z = tz; n.route = []; n.wanderAt = null; n.spotName = s.name;
      this.puffs.burst(new THREE.Vector3(n.x, 0.8, n.z), 0xffffff, { count: 10, speed: 3, size: 0.35 });
      return;
    }
    if (n.def.wander && !n.sleep) {
      n.wanderT -= 1;
      if (n.wanderT <= 0 || !n.wanderAt) {
        n.wanderT = 3 + Math.random() * 4;
        const a = Math.random() * Math.PI * 2;
        n.wanderAt = { x: tx + Math.cos(a) * n.def.wander, z: tz + Math.sin(a) * n.def.wander * 0.7 };
        if (!n.route.length) n.route = [n.wanderAt];
      }
      return;
    }
    if (s.name !== n.spotName) {
      n.spotName = s.name;
      n.route = this.map.route(n.x, n.z, tx, tz);
    }
  }

  updateNpcs(dt) {
    for (const n of this.npcs) {
      let moving = false;
      if (n.route.length && !n.talking) {
        const w = n.route[0];
        const dx = w.x - n.x, dz = w.z - n.z, d = Math.hypot(dx, dz);
        if (d < 0.15) n.route.shift();
        else {
          const sp = Math.min(d, NPC_SPEED * dt);
          n.x += (dx / d) * sp;
          n.z += (dz / d) * sp;
          n.model.face(dx, dz);
          moving = true;
        }
      } else if (!n.talking && !moving) {
        // idle: face the player when close, else look toward the camera
        const P = this.player;
        if (P && Math.hypot(P.x - n.x, P.z - n.z) < 5) n.model.face(P.x - n.x, P.z - n.z);
      }
      n.moving = moving;
      n.hop = Math.max(0, n.hop - dt * 2.5);
      n.y = (n.yOverride ?? this.map.floorAt(n.x, n.z, this.save.unlocks.bridge)) + Math.sin(n.hop * Math.PI) * 0.8;
      n.model.group.position.set(n.x, n.y, n.z);
      n.model.update(dt, { moving: moving ? 0.5 : 0, grounded: true, vy: 0 });
      if (n.sleep && !moving) {
        if (n.model.eyes) n.model.eyes.scale.y = 0.12;
        n.model.pivot.scale.y *= 0.94;
      }
    }
  }

  // ---------- dialog ----------

  /** Show lines one by one: [{ who, key, vars, text, choices, onChoice(i), fx() }]. done() at the end. */
  say(lines, done) {
    this.dlg = { lines, i: 0, t: 0, done, choice: 0 };
    this.mode = 'dialog';
    this.showLine();
  }

  lineVoice(L) {
    if (L.who && NPCS[L.who]) return NPCS[L.who].voice;
    return { pitch: 1, rate: 0.95, css: '#8a5a32' };
  }

  showLine() {
    const d = this.dlg;
    const L = d.lines[d.i];
    const v = this.lineVoice(L);
    const text = L.text ?? t(L.key, { name: this.playerName, ...L.vars });
    d.t = 0;
    d.choice = 0;
    const st = L.who && NPCS[L.who] ? npcState(this.save, L.who) : null;
    this.renderLine(L, text, v, st);
    speak(text, { pitch: v.pitch, rate: v.rate });
    this.game.audio.play('select');
    L.fx?.();
  }

  renderLine(L, text, v, st) {
    this.hud.setDialog({ who: L.who ? t(`isl.npc.${L.who}`) : '', text, css: v.css, hearts: st && L.who !== 'mumble' ? heartsOf(st) : undefined, choices: L.choices?.map((k) => t(k)), index: this.dlg.choice });
  }

  updateDialog(inp, dt) {
    const d = this.dlg;
    const L = d.lines[d.i];
    d.t += dt;
    if (L.choices) {
      const step = inp.stepX || -inp.stepY;
      if (step) {
        d.choice = (d.choice + step + L.choices.length) % L.choices.length;
        this.game.audio.play('select');
        this.renderLine(L, L.text ?? t(L.key, { name: this.playerName, ...L.vars }), this.lineVoice(L), L.who && NPCS[L.who] ? npcState(this.save, L.who) : null);
      }
    }
    if (d.t < 0.25 || !(inp.aPressed || inp.bPressed)) return;
    d.i++;
    if (L.choices) {
      const pick = inp.bPressed && !inp.aPressed ? L.choices.length - 1 : d.choice;
      this.hud.setDialog(null);
      this.mode = 'walk';
      this.dlg = null;
      L.onChoice?.(pick);
      if (!this.dlg) d.done?.();
      return;
    }
    if (d.i < d.lines.length) { this.showLine(); return; }
    this.hud.setDialog(null);
    this.mode = 'walk';
    this.dlg = null;
    d.done?.();
  }

  get playerName() {
    return this.game.solo?.profile?.name || this.player?.p.name || '';
  }

  // ---------- intro and tutorial ----------

  startIntro() {
    const hz = this.npc('hazel');
    const P = this.player;
    if (!P) { this.later(0.5, () => this.startIntro()); return; }
    hz.intro = true;
    hz.route = [];
    hz.x = P.x + 1.6;
    hz.z = P.z + 1.2;
    hz.sleep = false;
    this.puffs.burst(new THREE.Vector3(hz.x, 0.6, hz.z), 0xffffff, { count: 10, speed: 3, size: 0.35 });
    hz.model.face(P.x - hz.x, P.z - hz.z);
    P.ch.face(hz.x - P.x, hz.z - P.z);
    const L = (k, fx) => ({ who: 'hazel', key: `isl.hazel.${k}`, fx });
    this.say([L('intro1'), L('intro2', () => this.giveItems([['hoe', 1], ['can', 1], ['scythe', 1]], true)), L('intro3', () => this.giveItems([['radishSeed', 6], ['carrotSeed', 3]], true)), L('intro4'), L('q1.ask')], () => {
      const S = this.save;
      S.intro = true;
      npcState(S, 'hazel').met = true;
      S.quests.hazel = { n: 0 };
      S.sel = 0;
      this.setTut(1);
      hz.intro = false;
      hz.spotName = null;
      this.markDirty();
      this.game.ui.toast(t('isl.t.quest'));
    });
  }

  setTut(n) {
    if (this.save.tut >= n && n !== 0) return;
    this.save.tut = n;
    const S = this.save;
    const pick = (id) => { const i = S.inv.findIndex((it) => it.id === id); if (i >= 0) S.sel = i; };
    if (n === 2) pick('radishSeed');
    if (n === 3) pick('can');
    this.markDirty();
  }

  tasks() {
    const S = this.save;
    const out = [];
    if (S.intro && S.tut >= 1 && S.tut <= 7) out.push(t(`isl.tut.${S.tut}`));
    if (S.mail.length) out.push(t('isl.task.mail'));
    for (const [id, q] of Object.entries(S.quests)) out.push(this.questText(id, q.n));
    if (S.intro && !S.unlocks.bridge && S.tut >= 5) out.push(t('isl.task.bridge', { n: S.unlocks.bridgeWood, m: BRIDGE_WOOD }));
    if (count(S, 'pickaxe') && !S.unlocks.mine) out.push(t('isl.task.mine'));
    if (S.sea.quest === 1) out.push(t('isl.task.fish', { n: Math.min(3, S.sea.caught - (S.sea.questBase || 0)) }));
    if (S.sea.suit && !S.sea.dives) out.push(t('isl.task.dive'));
    if (S.sea.suit && S.sea.dives && !S.cafe.repaired) out.push(t('isl.task.cafe', { w: Math.min(10, count(S, 'wood')) }));
    if (S.cafe.repaired && !S.cafe.cooked) out.push(t('isl.task.cook'));
    if (S.cafe.repaired && S.cafe.cooked && !S.cafe.nights) out.push(t('isl.task.serve'));
    if (S.unlocks.barn && S.ranch.animals.length && S.ranch.trough <= 0) out.push(t('isl.task.hay'));
    if ((S.quests.hazel?.n === 2) && !count(S, 'stone')) out.push(t('isl.task.bench'));
    out.unshift(...this.seasons.tasks());
    if (this.isle2.here()) out.unshift(t('isl.task.isle'));
    if (count(S, 'seaChart') && !S.isle2.chart) out.unshift(t('isl.task.chart'));
    return out.slice(0, 5);
  }

  questText(id, n) {
    const q = NPCS[id].quests[n];
    const name = t(`isl.npc.${id}`);
    if (q.find) return `${t('isl.q.find', { item: t(`isl.i.${q.find}`), name })} ${t('isl.q.where', { where: t(`isl.where.${q.find}`) })}`;
    const list = q.need.map(([it, k]) => `${k} ${t(`isl.i.${it}`)} (${Math.min(k, count(this.save, it))}/${k})`).join(', ');
    return t('isl.q.bring', { name, list });
  }

  findActive(id) {
    const S = this.save;
    if (S.found[id] || count(S, id)) return false;
    return Object.entries(S.quests).some(([npc, q]) => NPCS[npc].quests[q.n]?.find === id);
  }

  // ---------- inventory and rewards ----------

  giveItems(list, quiet = false) {
    for (const [id, n] of list) {
      give(this.save, id, n);
      if (!quiet) this.gotToast(n > 1 ? `${n} ${itemName(id)}` : itemName(id));
    }
    this.game.audio.play('star');
    this.markDirty();
  }

  /** Hand out a reward: { items, coins, deco, unlock }. */
  grant(r) {
    if (!r) return;
    if (r.items) this.giveItems(r.items);
    if (r.coins) { this.save.coins += r.coins; this.game.audio.play('coin'); this.coinToast(r.coins); }
    if (r.deco) this.addDeco(r.deco);
    if (r.unlock) this.unlock(r.unlock);
    this.markDirty();
  }

  // ---------- toasts that merge (see toasts.js) ----------

  /** "You got: a, b, c" (several gifts at once become one toast). */
  gotToast(item, ms = 1800) {
    this.game.ui.toast('', ms, { group: 'got', add: item, fmt: (v) => t('isl.t.got', { item: v.join(', ') }) });
  }

  /** "+n coins" (coins that arrive together are added up). */
  coinToast(n) {
    this.game.ui.toast('', 1600, { group: 'coins', add: n, fmt: (v) => t('isl.t.coins', { n: v.reduce((a, b) => a + b, 0) }) });
  }

  /** "A letter in the mailbox" / "3 letters in the mailbox". */
  mailToast() {
    const n = this.save.mail.length;
    if (!n) return;
    this.game.ui.toast('', 2600, { group: 'mail', add: n, fmt: (v) => (v[v.length - 1] > 1 ? t('isl.t.mailN', { n: v[v.length - 1] }) : t('isl.t.mail')) });
  }

  /** News of the day (festival, rain, birthday) in one toast. */
  dayToast(text) {
    this.game.ui.toast('', 2800, { group: 'day', add: text, fmt: (v) => v.join(' · ') });
  }

  /** True while a full panel (or the bag) covers the screen: the toast queue waits. */
  get panelOpen() {
    return this.hud.panel.style.display !== 'none' || ['bag', 'shop', 'letter', 'cook', 'log', 'bench', 'cal', 'menu', 'photo', 'album', 'museum', 'sail', 'board'].includes(this.mode) || !!this.helpEl;
  }

  /** The usual spot of a decoration (the trophy garden), or null. */
  decoSpot(id) {
    const sid = id === 'duckGold' ? 'duckTrophy' : id;
    return DECO_SPOTS.find((s) => s.id === sid) || null;
  }

  picture3d(key, make) {
    return thumb(this.game.renderer, key, make, { rx: 0.35, ry: -0.6 });
  }

  addDeco(id) {
    this.save.deco[id] = true;
    if (id === 'flag') this.placeDeco(id, true);
    else this.builder.addDecoration(id, true);
    this.game.ui.toast(t('isl.t.deco', { item: t(`isl.d.${id}`) }), 2200);
  }

  unlock(key) {
    const S = this.save;
    if (S.unlocks[key]) return;
    S.unlocks[key] = true;
    const msg = { bridge: 'isl.t.bridge', mine: 'isl.t.mine', burrow: 'isl.t.burrow', bigCan: 'isl.t.bigCan', discount: 'isl.t.discount', starfruit: 'isl.t.starfruit', barn: 'isl.t.barn', rosaHelps: 'isl.t.rosaHelps', goldRod: 'isl.t.goldRod', greenhouse: 'isl.t.greenhouse' }[key];
    if (key === 'greenhouse') this.greenhouse.fix();
    if (key === 'barn') { this.ranch.addAnimal('chicken'); this.ranch.addAnimal('chicken'); this.ranch.refresh(); }
    if (msg) { this.game.ui.toast(t(msg), 3000); speak(t(msg)); }
    this.game.audio.play('fanfare');
    this.applyUnlocks(false);
    this.markDirty();
  }

  /** Show the world as the unlocks say (bridge fixed, rocks gone, burrow up). */
  applyUnlocks(first) {
    const U = this.save.unlocks;
    const m = this.map;
    m.bridgeBroken.visible = !U.bridge;
    m.bridgeFixed.visible = !!U.bridge;
    m.rockfall.visible = !U.mine;
    m.burrow.visible = !!U.burrow;
    if (!first) {
      const burst = (x, y, z) => this.confetti.burst(new THREE.Vector3(x, y, z), 0, { colors: PARTY, count: 60, speed: 8, up: 5, life: 1.6, gravity: -7 });
      if (U.bridge && !this.shownBridge) burst(BRIDGE.x, 1.5, BRIDGE.z);
      if (U.mine && !this.shownMine) { burst(ROCKFALL.x, 1.5, ROCKFALL.z); this.puffs.burst(new THREE.Vector3(ROCKFALL.x, 1, ROCKFALL.z), 0xbdb8cf, { count: 30, speed: 5, size: 0.8, life: 1.2 }); }
      if (U.burrow && !this.shownBurrow) { const b = m.places.find((p) => p.id === 'burrow'); burst(b.x, 2, b.z); }
    }
    this.shownBridge = U.bridge;
    this.shownMine = U.mine;
    this.shownBurrow = U.burrow;
  }

  /** True while the player is inside the cottage. */
  get indoors() {
    return !!(this.player && this.builder?.inside(this.player));
  }

  get walkState() {
    const U = this.save.unlocks;
    return { bridge: U.bridge, mine: U.mine, burrow: U.burrow, cafe: this.save.cafe.repaired };
  }

  checkRewards() {
    const S = this.save;
    for (const r of gameRewards(this.game.roster.progress)) {
      if (S.rewards[r.id]) continue;
      S.rewards[r.id] = true;
      S.mail.push(r);
    }
    this.markDirty();
  }

  /** Back from Crystal Caves: once a day, Keeper Bram sends a crystal you found (new kinds first). */
  caveCrystal() {
    const S = this.save, today = dayKey();
    if (!S.museum) S.museum = { got: {}, steps: 0 };
    if (S.museum.caveDay === today) return;
    S.museum.caveDay = today;
    const kinds = ['roseQuartz', 'skyTopaz', 'sunCitrine'];
    const id = kinds.find((k) => !S.museum.got[k] && !count(S, k) && !S.mail.some((m) => m.items?.[0]?.[0] === k)) || kinds[Math.floor(dayRand(`cave:${today}`) * 3)];
    S.mail.push({ id: 'cave', from: 'cave', items: [[id, 1]] });
    this.markDirty();
  }

  markDirty() { this.dirty = true; }

  flush() {
    if (!this.dirty) return;
    this.dirty = false;
    this.game.roster.save();
  }

  // ---------- friendship ----------

  addPts(id, n) {
    if (n <= 0) return;
    const st = npcState(this.save, id);
    const before = heartsOf(st);
    st.pts = Math.min(MAX_HEARTS * PTS_PER_HEART, st.pts + n);
    if (heartsOf(st) > before) {
      const npc = this.npc(id);
      this.game.ui.toast(t('isl.t.heart', { name: t(`isl.npc.${id}`) }), 2000);
      this.confetti.burst(new THREE.Vector3(npc.x, 2.2, npc.z), 0, { count: 24, speed: 4, up: 4, colors: [0xff5d73, 0xff9fd0, 0xffffff], life: 1.2, gravity: -5 });
      this.game.audio.play('rescue');
    }
    this.markDirty();
  }

  questReady(id, n) {
    const q = NPCS[id].quests[n];
    if (!q) return false;
    if (q.find) return count(this.save, q.find) > 0;
    return q.need.every(([it, k]) => count(this.save, it) >= k);
  }

  /** Something new to say: an event, a quest to give or a quest to finish. */
  hasNews(id) {
    const S = this.save;
    const st = npcState(S, id);
    const def = NPCS[id];
    if (!st.met && S.intro) return true;
    if (id === 'grumbleton' && S.intro && (!S.sea.rod || (S.sea.quest === 1 && S.sea.caught - (S.sea.questBase || 0) >= 3) || (count(S, 'seaChart') && !S.isle2?.chart))) return true;
    const ev = def.events[st.ev];
    if (ev && heartsOf(st) >= ev.at) return true;
    const q = S.quests[id];
    if (q) return this.questReady(id, q.n);
    return st.q < def.quests.length && heartsOf(st) >= (def.quests[st.q].minHearts || 0) && S.intro;
  }

  talkTo(n) {
    const S = this.save;
    const id = n.id, def = n.def, st = npcState(S, id), at = now();
    const P = this.player;
    n.model.face(P.x - n.x, P.z - n.z);
    P.ch.face(n.x - P.x, n.z - P.z);
    if (n.sleep) {
      this.say([{ who: id, key: 'isl.sleep', vars: { name: t(`isl.npc.${id}`) } }]);
      return;
    }
    n.talking = true;
    const L = (k, vars, fx) => ({ who: id, key: `isl.${id}.${k}`, vars, fx });
    const lines = [];
    let after = null;
    const bday = this.seasons.birthdayLine(n);
    const sea = (id === 'grumbleton' ? this.seaTalk(n, L) : null) || this.seasons.festTalk(n);
    if (sea && bday) sea.lines.unshift(bday);
    if (sea) {
      if (!st.met) { st.met = true; sea.lines.unshift(L('meet')); }
      if (canTalkBonus(st, at)) { st.talkAt = at; this.addPts(id, TALK_PTS); }
      this.say(sea.lines, () => { sea.after?.(); this.markDirty(); this.afterTalk(n); });
      return;
    }
    if (!st.met) { st.met = true; lines.push(L('meet')); }
    if (bday) lines.push(bday);
    const ev = def.events[st.ev];
    const q = S.quests[id];
    if (ev && heartsOf(st) >= ev.at) {
      const k = st.ev + 1;
      for (let i = 1; i <= ev.lines; i++) lines.push(L(`ev${k}.${i}`, null, i === 1 ? () => { n.hop = 1; } : ev.fx === 'rocket' && i === 3 ? () => this.seasons.launchRocket() : i === ev.lines ? () => this.celebrate(n) : null));
      after = () => { st.ev++; this.grant(ev.reward); };
    } else if (q) {
      if (this.questReady(id, q.n)) {
        lines.push(L(`q${q.n + 1}.done`, null, () => this.celebrate(n)));
        after = () => this.completeQuest(id, q.n);
      } else lines.push(L(`q${q.n + 1}.wait`));
    } else if (st.q < def.quests.length && heartsOf(st) >= (def.quests[st.q].minHearts || 0) && lines.length < 2) {
      const qn = st.q;
      lines.push(L(`q${qn + 1}.ask`));
      after = () => { S.quests[id] = { n: qn }; this.game.ui.toast(t('isl.t.quest')); this.game.audio.play('beep'); };
    } else if (!lines.length) {
      if (id === 'grumbleton' && S.sea.quest === 1) lines.push(L('fishWait', { n: S.sea.caught - (S.sea.questBase || 0) }));
      else lines.push(this.chatLine(n, st));
    }
    if (canTalkBonus(st, at)) { st.talkAt = at; this.addPts(id, TALK_PTS); }
    this.say(lines, () => {
      after?.();
      this.markDirty();
      this.afterTalk(n);
    });
  }

  chatLine(n, st) {
    const id = n.id;
    const p = this.game.roster.progress;
    const gk = n.def.game?.(p);
    const L = (k, vars) => ({ who: id, key: `isl.${id}.${k}`, vars });
    n.chatI = (n.chatI || 0) + 1;
    if (gk && n.chatI % 2 === 1) return L(gk, { n: id === 'bram' ? p.lighthouse?.crystals || 0 : p.skyhop || 0 });
    const pool = heartsOf(st) >= 2 ? [1, 2, 3, 4, 5] : [1, 2, 3];
    return L(`chat${pool[(n.chatI + st.pts) % pool.length]}`);
  }

  /** After talking: offer the held gift, then (Rosa) open the shop. */
  afterTalk(n) {
    const S = this.save;
    const held = S.inv[S.sel];
    const st = npcState(S, n.id);
    const shop = () => { n.talking = false; if (n.id === 'rosa') this.openShop(); if (n.id === 'hoot' && !n.sleep) this.museum.open(); };
    if (held && isGift(held.id)) {
      this.say([{ who: n.id, key: 'isl.giftAsk', vars: { name: t(`isl.npc.${n.id}`), item: itemName(held.id) }, choices: ['isl.yes', 'isl.no'], onChoice: (i) => {
        if (i !== 0) { shop(); return; }
        if (!canGift(st, now())) { this.say([{ who: n.id, key: 'isl.giftLater' }], shop); return; }
        take(S, held.id, 1);
        st.giftAt = now();
        const ts = taste(n.id, held.id);
        const bd = this.seasons.isBirthday(n.id);
        this.addPts(n.id, GIFT_PTS[ts] * (bd ? 2 : 1) + (bd ? 4 : 0));
        if (ts === 'love' || ts === 'like') n.hop = 1;
        this.game.audio.play(ts === 'dislike' ? 'bump' : 'star');
        this.say([{ who: n.id, key: bd && ts !== 'dislike' ? 'isl.bday.thanks' : `isl.${n.id}.${ts}` }], shop);
      } }]);
      return;
    }
    shop();
  }

  celebrate(n) {
    n.hop = 1;
    this.confetti.burst(new THREE.Vector3(n.x, 2, n.z), 0, { colors: PARTY, count: 40, speed: 6, up: 4, life: 1.4, gravity: -6 });
    this.game.audio.play('fanfare');
  }

  completeQuest(id, qn) {
    const S = this.save;
    const q = NPCS[id].quests[qn];
    if (q.find) take(S, q.find, 1);
    else for (const [it, k] of q.need) take(S, it, k);
    delete S.quests[id];
    const st = npcState(S, id);
    st.q = qn + 1;
    this.addPts(id, 10);
    this.game.ui.toast(t('isl.t.questDone'));
    this.grant(q.reward);
    if (id === 'hazel' && qn === 0) this.setTut(7);
  }

  // ---------- places ----------

  placeInfo(pl) {
    const p = this.game.roster.progress;
    if (pl.guest) return t('isl.guest');
    switch (pl.key) {
      case 'lighthouse': return p.lighthouse?.flags?.finale ? t('isl.best.lhDone') : p.lighthouse ? t('isl.best.lh', { n: p.lighthouse.crystals || 0 }) : t('isl.best.new');
      case 'adventure': return p.adventure?.done2 ? t('isl.best.adv2') : p.adventure?.done ? t('isl.best.adv1') : p.adventure ? t('isl.best.adv', { n: p.adventure.scene || 1 }) : t('isl.best.new');
      case 'duckhunt': return p.duckhunt?.best ? t('isl.best.duck', { n: p.duckhunt.best }) : t('isl.best.new');
      case 'platformer': return p.skyhop ? t('isl.best.hop', { n: p.skyhop, m: SKYHOP_LEVELS.length }) : t('isl.best.new');
      case 'castle': { const w = (p.castleCampaign?.won || []).filter(Boolean).length; return w ? t('isl.best.castle', { n: w }) : t('isl.best.new'); }
      case 'guides': { const s = (p.guides?.stars || []).reduce((a, b) => a + (b || 0), 0); return s ? t('isl.best.guides', { n: s }) : t('isl.best.new'); }
      default: return S_VISITED(this.save, pl.id) ? '' : t('isl.best.new');
    }
  }

  placeOpen(pl) {
    return !pl.lock || !!this.save.unlocks[pl.lock];
  }

  enterPlace(pl) {
    if (this.launching) return;
    this.launching = true;
    const S = this.save;
    S.last = { place: pl.id, at: now() };
    S.visited = { ...(S.visited || {}), [pl.id]: true };
    this.dirty = true;
    this.flush();
    if (pl.guest) this.game.launchGuest(pl.guest);
    else this.game.startGame(pl.key, pl.opts || {});
  }

  // ---------- the player's actions ----------

  /** What [A] and [B] would do right now: { a: { text, fn }, b: { text, fn }, tile }. */
  interactions() {
    const P = this.player;
    const S = this.save;
    const out = { a: null, b: null, tile: null, hl: null };
    if (!P) return out;
    const fx = P.x + P.fx * 0.95, fz = P.z + P.fz * 0.95;
    const held = S.inv[S.sel];
    const nm = (k, v) => tFor(P.p, k, v);
    if (this.indoors) {
      this.builder.interactions(P, out, nm);
      if (!out.b) out.b = { text: '', fn: () => this.openBag() };
      if (!out.a) out.a = { text: '', fn: () => this.doTool(held?.id, null) };
      return out;
    }
    // game places
    for (const pl of this.map.places) {
      if (pl.id === 'burrow' && !S.unlocks.burrow) continue;
      if (Math.hypot(P.x - pl.door.x, P.z - pl.door.z) > DOOR_R) continue;
      if (pl.lock === 'mine' && !S.unlocks.mine) continue; // the rockfall below says what to do
      if (this.placeOpen(pl)) {
        const fn = () => this.enterPlace(pl);
        out.a = { text: `${nm('isl.enter')} · ${t(`game.${pl.key}`)}`, fn };
        out.b = { text: '', fn };
      } else out.a = { text: t(`isl.locked.${pl.lock}`), fn: () => this.game.audio.play('bump') };
      return out;
    }
    // townsfolk
    let best = null, bd = TALK_R;
    for (const n of this.npcs) {
      if (n.away) continue;
      const d = Math.hypot(P.x - n.x, P.z - n.z);
      if (d < bd) { bd = d; best = n; }
    }
    if (best) {
      const name = t(`isl.npc.${best.id}`);
      out.b = { text: best.sleep ? t('isl.h.asleep', { name }) : nm('isl.h.talk', { name }), fn: () => this.talkTo(best) };
    }
    const near = (x, z, r = 1.7) => Math.hypot(fx - x, fz - z) < r || Math.hypot(P.x - x, P.z - z) < r;
    if (!out.b && near(MAILBOX.x, MAILBOX.z)) out.b = S.mail.length ? { text: nm('isl.h.mail'), fn: () => this.openLetter() } : { text: t('isl.h.mailNone'), fn: () => this.game.audio.play('bump') };
    if (!out.b && near(BIN.x, BIN.z, 1.9)) {
      out.b = held && SELLABLE.has(ITEMS[held.id]?.kind) ? { text: nm('isl.h.ship', { item: itemName(held.id) }), fn: () => this.ship(held.id) } : { text: nm('isl.h.shipNone'), fn: () => this.game.audio.play('bump') };
    }
    if (!out.b && near(STORE.x, STORE.z + 3.2, 1.8)) {
      const rosa = this.npc('rosa');
      out.b = rosa.sleep ? { text: t('isl.h.asleep', { name: t('isl.npc.rosa') }), fn: () => this.talkTo(rosa) } : { text: nm('isl.h.shop'), fn: () => this.talkTo(rosa) };
    }
    // the barn, the workbench, the cottage door, the calendar board
    if (!out.b) this.ranch.interactions(P, out, nm);
    if (!out.b) this.builder.interactions(P, out, nm);
    if (!out.b) this.greenhouse.interactions(P, out, nm);
    if (!out.b) this.museum.interactions(P, out, nm);
    if (!out.b) this.seasons.interactions(P, out, nm);
    if (!out.b) this.seasons.shellAction(P, out, nm);
    // Shell Isle: the boat trip, and the palms, pools and treasure there
    if (!out.b) this.isle2.boatAction(P, out, nm);
    this.isle2.interactions(P, out, nm);
    // the dive boat's ladder
    if (!out.b && Math.hypot(P.x - (DIVE_BOAT.x - 1.0), P.z - (DIVE_BOAT.z + 1.1)) < 1.4) {
      out.b = S.sea.suit ? { text: nm('isl.h.dive'), fn: () => this.startDive() } : { text: t('isl.h.diveNeed'), fn: () => this.game.audio.play('bump') };
    }
    // the café (repair, stove, counter)
    if (!out.b) this.cafe.interactions(P, out, nm);
    // the bridge
    const bx = BRIDGE.x + BRIDGE.len / 2 + 0.4;
    if (!out.b && !S.unlocks.bridge && Math.hypot(P.x - bx, P.z - BRIDGE.z) < 2.4) {
      out.b = count(S, 'wood') ? { text: nm('isl.h.bridge', { n: S.unlocks.bridgeWood, m: BRIDGE_WOOD }), fn: () => this.giveWood() } : { text: t('isl.h.bridgeNeed', { n: S.unlocks.bridgeWood, m: BRIDGE_WOOD }), fn: () => this.readSign(SIGNS[0]) };
    }
    // pickups
    if (!out.b) {
      for (const b of this.branches) {
        if (b.g.visible && near(b.x, b.z, 1.4)) { out.b = { text: nm('isl.h.pick', { item: t('isl.i.wood') }), fn: () => this.pickBranch(b) }; break; }
      }
    }
    if (!out.b) {
      for (const [id, f] of Object.entries(this.finds)) {
        if (f.g.visible && near(f.x, f.z, 1.5)) { out.b = { text: nm('isl.h.pick', { item: t(`isl.i.${id}`) }), fn: () => this.pickFind(id) }; break; }
      }
    }
    if (!out.b) {
      for (const s of SIGNS) if (near(s.x, s.z, 1.3)) { out.b = { text: nm('isl.h.sign'), fn: () => this.readSign(s) }; break; }
    }
    // the rockfall
    if (!S.unlocks.mine && Math.hypot(P.x - ROCKFALL.x, P.z - ROCKFALL.z) < 3.4) {
      out.a = held?.id === 'pickaxe' ? { text: nm('isl.h.rocks'), fn: () => this.hitRocks() } : { text: t('isl.h.rocksNeed'), fn: () => this.game.audio.play('bump') };
    }
    // rock piles and tall grass, the winter sled
    if (!out.a) out.a = this.builder.gatherAction(P, held?.id, nm);
    this.seasons.sled.interactions(P, out, nm);
    // fishing, and the books
    if (!out.a && held?.id === 'rod') {
      const spot = this.fishSpot();
      if (spot) out.a = { text: nm('isl.h.cast'), fn: () => { this.mode = 'fish'; this.fishing.start(spot.where, spot.x, spot.z); } };
    }
    if (!out.a && held?.id === 'fishlog') out.a = { text: nm('isl.h.log'), fn: () => this.openLog() };
    if (!out.a && held?.id === 'recipes') out.a = { text: nm('isl.h.book'), fn: () => this.cafe.openCook(true) };
    // the field
    const tile = tileAt(fx, fz, !!S.unlocks.greenhouse);
    if (tile && !out.a) {
      out.tile = tile;
      const tl0 = this.farm.tile(tile.c, tile.r, tile.f);
      const tl = tl0 && !tl0.grass ? tl0 : null; // grass under a sprinkler counts as untilled
      const weed = this.farm.hasWeed(tile.c, tile.r, tile.f);
      const stage = tl ? stageOf(tl) : -1;
      const id = held?.id;
      const it = ITEMS[id];
      if (stage === 3) out.a = { text: nm('isl.h.harvest'), fn: () => this.doHarvest(tile), ok: true };
      else if (tl0?.obj) out.a = { text: nm('isl.h.takeObj', { item: itemName(tl0.obj) }), fn: () => this.takeFarmObj(tile), ok: true };
      else if (FARM_OBJS.includes(id) && !weed && !tl?.crop) out.a = { text: nm('isl.h.placeObj', { item: itemName(id) }), fn: () => this.placeFarmObj(tile, id), ok: true };
      else if (weed) out.a = id === 'scythe' ? { text: nm('isl.h.cut'), fn: () => this.doTool('scythe', tile), ok: true } : { text: t('isl.h.weed'), fn: () => this.doTool(id, tile), bad: true };
      else if (id === 'hoe') out.a = !tl ? { text: nm('isl.h.till'), fn: () => this.doTool('hoe', tile), ok: true } : { text: '', fn: () => this.doTool('hoe', tile) };
      else if (id === 'can') out.a = tl ? { text: nm('isl.h.water'), fn: () => this.doTool('can', tile), ok: true } : { text: '', fn: () => this.doTool('can', tile) };
      else if (it?.kind === 'seed' && tl && !tl.crop && !this.canPlantHere(tile, it.crop)) out.a = { text: this.offSeasonText(it.crop), fn: () => this.offSeason(it.crop), bad: true };
      else if (it?.kind === 'seed') out.a = tl && !tl.crop ? { text: nm('isl.h.plant', { item: itemName(id) }), fn: () => this.doPlant(tile, id), ok: true } : !tl ? { text: t('isl.t.tillFirst'), fn: () => this.game.audio.play('bump'), bad: true } : null;
      else if (!tl) out.a = { text: t('isl.h.pickTool'), fn: () => this.game.audio.play('bump') };
      if (tl?.crop && stage < 3) {
        const crop = itemName(tl.crop);
        const info = tl.wetUntil > now() ? t('isl.h.growing', { item: crop, m: minutesLeft(tl) }) : t('isl.h.dry', { item: crop });
        out.a = out.a?.ok ? { ...out.a, text: `${out.a.text} · ${info}` } : { text: info, fn: out.a?.fn || (() => this.doTool(id, tile)) };
      }
      out.hl = out.a?.ok ? 0x9ff07a : out.a?.bad ? 0xff8fa8 : 0xffffff;
    }
    if (!out.b) out.b = { text: '', fn: () => this.openBag() };
    if (!out.a) out.a = { text: '', fn: () => this.doTool(held?.id, null) };
    return out;
  }

  swingTool() {
    this.swing = 1;
    this.player.ch.squash(0.85);
  }

  doTool(id, tile) {
    const S = this.save, at = now();
    if (!TOOLS.includes(id)) return;
    this.swingTool();
    if (!tile) { this.game.audio.play('dash'); return; }
    const { x, z } = tileCenter(tile.c, tile.r, tile.f);
    const pos = new THREE.Vector3(x, heightAt(x, z) + 0.3, z);
    if (id === 'hoe') {
      const r = this.farm.till(tile.c, tile.r, at, tile.f);
      if (r === 'tilled') { this.puffs.burst(pos, 0xa8703f, { count: 10, speed: 3, size: 0.3, life: 0.6 }); this.game.audio.play('land'); if (S.tut === 1) this.setTut(2); }
      else if (r === 'weedFirst') { this.game.ui.toast(t('isl.t.weedFirst')); this.game.audio.play('bump'); }
    } else if (id === 'can') {
      const list = [tile];
      if (S.unlocks.bigCan) {
        const side = Math.abs(this.player.fx) > Math.abs(this.player.fz) ? [[0, -1], [0, 1]] : [[-1, 0], [1, 0]];
        for (const [dc, dr] of side) list.push({ c: tile.c + dc, r: tile.r + dr, f: tile.f });
      }
      let any = false;
      for (const tl of list) {
        const F = FIELDS[tl.f || 0];
        if (tl.c < 0 || tl.r < 0 || tl.c >= F.cols || tl.r >= F.rows) continue;
        if (this.farm.water(tl.c, tl.r, at, tl.f)) {
          any = true;
          const c = tileCenter(tl.c, tl.r, tl.f);
          this.puffs.burst(new THREE.Vector3(c.x, heightAt(c.x, c.z) + 0.6, c.z), 0x6fd0ff, { count: 10, speed: 2, up: 1, size: 0.18, life: 0.6, gravity: -12 });
        }
      }
      this.game.audio.play(any ? 'bubble' : 'dash');
      if (any && S.tut === 3 && Object.values(S.tiles).some((tl) => tl.crop && tl.wetUntil > at)) this.setTut(4);
    } else if (id === 'scythe') {
      if (this.farm.cut(tile.c, tile.r, at)) {
        this.puffs.burst(pos, 0x6fbf4a, { count: 12, speed: 3, size: 0.25, life: 0.6 });
        this.game.audio.play('pop');
        if (Math.random() < 0.35) {
          const seed = Math.random() < 0.6 ? 'radishSeed' : 'carrotSeed';
          give(S, seed, 1);
          this.game.ui.toast(t('isl.t.drop', { item: itemName(seed) }));
        }
      } else this.game.audio.play('dash');
    } else this.game.audio.play('dash');
    this.markDirty();
  }

  placeFarmObj(tile, id) {
    if (!this.farm.placeObj(tile.c, tile.r, id, now(), tile.f)) { this.game.audio.play('bump'); return; }
    take(this.save, id, 1);
    this.swingTool();
    const { x, z } = tileCenter(tile.c, tile.r, tile.f);
    this.puffs.burst(new THREE.Vector3(x, heightAt(x, z) + 0.4, z), 0xffffff, { count: 10, speed: 3, size: 0.3 });
    this.game.audio.play('land');
    if (id === 'sprinkler') this.game.ui.toast(t('isl.t.sprinkler'), 2400);
    this.markDirty();
  }

  takeFarmObj(tile) {
    const id = this.farm.takeObj(tile.c, tile.r, now(), tile.f);
    if (!id) return;
    give(this.save, id, 1);
    this.game.audio.play('pop');
    this.markDirty();
  }

  /** Outside, seeds only go in during their season (radishes and carrots grow all year). */
  canPlantHere(tile, crop) {
    return !!tile.f || inSeason(crop, this.seasons.season);
  }

  offSeasonText(crop) {
    const list = CROPS[crop].seasons.map((sn) => t(`isl.seasonIn.${sn}`)).join(t('isl.or'));
    return t(this.save.unlocks.greenhouse ? 'isl.h.offSeasonGh' : 'isl.h.offSeason', { item: itemName(crop), list });
  }

  offSeason(crop) {
    const txt = this.offSeasonText(crop);
    this.game.ui.toast(txt, 2600);
    speak(txt);
    this.game.audio.play('bump');
  }

  doPlant(tile, seedId) {
    const S = this.save;
    const crop = ITEMS[seedId].crop;
    if (this.farm.plant(tile.c, tile.r, crop, now(), tile.f) !== 'planted') return;
    take(S, seedId, 1);
    this.seasons.onPlant();
    this.swingTool();
    const { x, z } = tileCenter(tile.c, tile.r, tile.f);
    this.puffs.burst(new THREE.Vector3(x, heightAt(x, z) + 0.3, z), 0x7a4a2e, { count: 6, speed: 2, size: 0.2, life: 0.5 });
    this.game.audio.play('pop');
    if (S.tut === 2) this.setTut(3);
    if (!count(S, seedId)) this.game.ui.toast(t('isl.t.noSeeds'));
    this.markDirty();
  }

  doHarvest(tile) {
    const S = this.save;
    const crop = this.farm.harvest(tile.c, tile.r, now(), tile.f);
    if (!crop) return;
    give(S, crop, 1);
    S.stats.harvested++;
    this.swingTool();
    const { x, z } = tileCenter(tile.c, tile.r, tile.f);
    // a scarecrow nearby sometimes finds one more
    if (this.farm.nearScarecrow(tile.c, tile.r, tile.f) && Math.random() < 0.3) {
      give(S, crop, 1);
      S.stats.harvested++;
      this.later(0.5, () => this.game.ui.toast(t('isl.t.scarecrow', { item: itemName(crop) }), 2000));
    }
    this.confetti.burst(new THREE.Vector3(x, heightAt(x, z) + 0.8, z), 0, { count: 18, speed: 4, up: 4, colors: [CROPS[crop].color, 0xffffff, 0x9be05a], life: 0.9, gravity: -10 });
    this.game.audio.play('star');
    this.game.ui.toast(t('isl.t.harvest', { item: itemName(crop) }));
    if (S.tut <= 5 && S.tut >= 4) this.setTut(6);
    // select what was just picked, so it is easy to ship or show
    const i = S.inv.findIndex((it) => it.id === crop);
    if (S.tut === 6 && i >= 0) S.sel = i;
    this.markDirty();
  }

  ship(id) {
    const S = this.save;
    const n = count(S, id);
    if (!n) return;
    take(S, id, n);
    const coins = n * ITEMS[id].sell;
    S.coins += coins;
    S.stats.shipped += n;
    S.stats.earned += coins;
    const lid = this.map.bin.userData.lid;
    lid.rotation.x = -0.8;
    this.later(0.4, () => { lid.rotation.x = 0; });
    this.confetti.burst(new THREE.Vector3(BIN.x, 1.4, BIN.z), 0, { count: 20, speed: 4, up: 4, colors: [0xffd23f, 0xffe47a], life: 1, gravity: -9 });
    this.game.audio.play('coin');
    this.game.ui.toast(t('isl.t.shipped', { n, item: itemName(id), coins }), 2200);
    if (S.tut === 6) this.setTut(7);
    this.markDirty();
  }

  pickBranch(b) {
    this.save.branches[b.i] = now();
    b.g.visible = false;
    give(this.save, 'wood', 1);
    this.puffs.burst(new THREE.Vector3(b.x, 0.4, b.z), 0xc68a52, { count: 8, speed: 3, size: 0.25 });
    this.game.audio.play('pop');
    this.game.ui.toast(t('isl.t.wood'));
    this.markDirty();
  }

  pickFind(id) {
    this.save.found[id] = true;
    give(this.save, id, 1);
    const f = this.finds[id];
    f.g.visible = false;
    this.confetti.burst(new THREE.Vector3(f.x, 1, f.z), 0, { colors: PARTY, count: 30, speed: 5, up: 4, life: 1.2, gravity: -6 });
    this.game.audio.play('star');
    const txt = t('isl.t.found', { item: t(`isl.i.${id}`) });
    this.game.ui.toast(txt, 2200);
    speak(txt);
    this.markDirty();
  }

  giveWood() {
    const S = this.save;
    const n = Math.min(count(S, 'wood'), BRIDGE_WOOD - S.unlocks.bridgeWood);
    if (n <= 0) return;
    take(S, 'wood', n);
    S.unlocks.bridgeWood += n;
    this.game.audio.play('land');
    this.puffs.burst(new THREE.Vector3(BRIDGE.x, 0.8, BRIDGE.z), 0xc68a52, { count: 16, speed: 4, size: 0.35 });
    if (S.unlocks.bridgeWood >= BRIDGE_WOOD) this.unlock('bridge');
    else this.game.ui.toast(t('isl.h.bridgeNeed', { n: S.unlocks.bridgeWood, m: BRIDGE_WOOD }));
    this.markDirty();
  }

  hitRocks() {
    const S = this.save;
    this.swingTool();
    S.unlocks.mineHits++;
    this.puffs.burst(new THREE.Vector3(ROCKFALL.x, 1, ROCKFALL.z), 0xbdb8cf, { count: 10, speed: 4, size: 0.4 });
    this.game.audio.play('bump');
    const k = 1 - S.unlocks.mineHits / ROCK_HITS;
    this.map.rockfall.scale.set(1, Math.max(0.2, k), 1);
    if (S.unlocks.mineHits >= ROCK_HITS) this.unlock('mine');
    else this.game.ui.toast(t('isl.t.rock', { n: ROCK_HITS - S.unlocks.mineHits }));
    this.markDirty();
  }

  readSign(s) {
    this.say([{ key: s.when?.(this.save) ? s.key2 : s.key, vars: { m: BRIDGE_WOOD } }]);
  }

  // ---------- bag, shop and mail ----------

  openBag() {
    if (!this.save.inv.length) return;
    this.mode = 'bag';
    this.bagT = 0;
    this.game.audio.play('select');
  }

  updateBag(inp, dt) {
    const S = this.save;
    this.bagT += dt;
    if (inp.stepX) {
      S.sel = (S.sel + inp.stepX + S.inv.length) % S.inv.length;
      this.game.audio.play('select');
    }
    if (this.bagT > 0.2 && (inp.aPressed || inp.bPressed)) { this.mode = 'walk'; this.markDirty(); }
  }

  openShop() {
    this.mode = 'shop';
    this.shop = { tab: 0, i: 0, t: 0 };
    this.renderShop();
  }

  shopRows() {
    const S = this.save;
    if (this.shop.tab === 0) {
      return shopStock(S).map((id) => ({ id, price: Math.max(1, Math.round(ITEMS[id].buy * (S.unlocks.discount ? 0.8 : 1))), sub: ITEMS[id].kind === 'seed' ? t(`isl.grow.${ITEMS[id].crop}`) : '' }));
    }
    return S.inv.filter((it) => ITEMS[it.id]?.sell && ITEMS[it.id].kind !== 'tool').map((it) => ({ id: it.id, price: ITEMS[it.id].sell, sub: '' }));
  }

  renderShop() {
    const S = this.save, sh = this.shop;
    const rows = this.shopRows();
    sh.i = Math.min(sh.i, Math.max(0, rows.length - 1));
    const start = Math.max(0, Math.min(sh.i - 4, rows.length - 8));
    const list = rows.slice(start, start + 8).map((r, k) => `<div class="isl-row ${start + k === sh.i ? 'on' : ''}">${icon(r.id)}<div>${esc(itemName(r.id))} ${r.sub ? `<small>${esc(r.sub)}</small>` : ''}</div>
      <small>${esc(t('isl.shop.owned', { n: count(S, r.id) }))}</small><div class="p">${icon('coin')}${r.price}</div></div>`).join('');
    this.hud.setPanel(`<h2>${esc(t('isl.shop.title'))}</h2>
      <div class="isl-tabs"><span class="${sh.tab === 0 ? 'on' : ''}">${esc(t('isl.shop.buy'))}</span><span class="${sh.tab === 1 ? 'on' : ''}">${esc(t('isl.shop.sell'))}</span>
      <span>${icon('coin').replace('isl-ico', 'isl-ico" style="width:1.2em;height:1.2em;display:inline-block;vertical-align:-3px')} ${S.coins}</span></div>
      <div class="isl-rows">${list || `<div class="isl-foot">${esc(t('isl.shop.empty'))}</div>`}</div>
      <div class="isl-foot">${esc(tFor(this.player?.p, 'isl.shop.hint'))}</div>`);
  }

  updateShop(inp, dt) {
    const sh = this.shop, S = this.save;
    sh.t += dt;
    if (inp.stepX) { sh.tab = inp.stepX > 0 ? 1 : 0; sh.i = 0; this.game.audio.play('select'); this.renderShop(); }
    if (inp.stepY) { const rows = this.shopRows(); sh.i = THREE.MathUtils.clamp(sh.i - inp.stepY, 0, Math.max(0, rows.length - 1)); this.game.audio.play('select'); this.renderShop(); }
    if (sh.t < 0.25) return;
    if (inp.bPressed) { this.mode = 'walk'; this.hud.setPanel(null); this.npc('rosa').talking = false; if (S.tut === 7) this.setTut(8); this.markDirty(); return; }
    if (inp.aPressed) {
      const r = this.shopRows()[sh.i];
      if (!r) return;
      if (sh.tab === 0) {
        if (S.coins < r.price) { this.game.ui.toast(t('isl.t.noCoins')); this.game.audio.play('bump'); return; }
        S.coins -= r.price;
        if (ITEMS[r.id].kind === 'gear') S.sea[r.id] = true;
        else if (ITEMS[r.id].kind === 'animal') this.ranch.addAnimal(r.id);
        else give(S, r.id, 1);
        this.game.ui.toast(t('isl.t.bought', { item: itemName(r.id) }), 900);
      } else {
        take(S, r.id, 1);
        S.coins += r.price;
        S.stats.shipped++;
        S.stats.earned += r.price;
        this.game.ui.toast(t('isl.t.sold', { item: itemName(r.id), coins: r.price }), 900);
      }
      if (S.tut === 7) this.setTut(8);
      this.game.audio.play('coin');
      this.markDirty();
      this.renderShop();
    }
  }

  openLetter() {
    const S = this.save;
    const r = S.mail[0];
    if (!r) return;
    this.mode = 'letter';
    this.letterT = 0;
    const gifts = [...(r.items || []).map(([id, n]) => `<div>${icon(id)}${n > 1 ? `${n} ` : ''}${esc(itemName(id))}</div>`),
      ...(r.deco ? [`<div>${icon('deco')}${esc(t(`isl.d.${r.deco}`))}</div>`] : []), ...(r.coins ? [`<div>${icon('coin')}${r.coins}</div>`] : [])].join('');
    const body = t(`isl.mail.${r.id}`, { name: this.playerName });
    this.hud.setPanel(`<h2>${esc(t('isl.mail.title', { name: this.playerName }))}</h2>
      <div class="isl-letter">${esc(body)}<div class="from">${esc(t('isl.mail.from', { name: t(`isl.from.${r.from}`) }))}</div></div>
      <div class="isl-gifts">${gifts}</div><div class="isl-foot">${esc(tFor(this.player?.p, 'isl.mail.hint'))}</div>`);
    const v = r.from === 'lh' || r.from === 'cave' ? NPCS.bram.voice : r.from === 'adv' ? NPCS.grumbleton.voice : r.from === 'hop' ? NPCS.pip.voice : { pitch: 1, rate: 0.95 };
    speak(body, v);
    this.game.audio.play('select');
    const mb = this.map.mailbox.userData;
    mb.letter.visible = false;
  }

  updateLetter(inp, dt) {
    this.letterT += dt;
    if (this.letterT < 0.35 || !(inp.aPressed || inp.bPressed)) return;
    const r = this.save.mail.shift();
    this.hud.setPanel(null);
    this.mode = 'walk';
    this.grant({ items: r.items, coins: r.coins, deco: r.deco });
    if (this.save.mail.length) this.later(0.4, () => this.openLetter());
  }

  // ---------- the sea: fishing, diving, the fish log ----------

  /** Water in front of the player to fish in: { where, x, z } or null. */
  fishSpot() {
    const P = this.player;
    const st = this.walkState;
    const deck = this.map.deckAt(P.x, P.z, st.bridge);
    for (const d of [3.2, 4.4, 2.2, 1.4]) {
      const x = P.x + P.fx * d, z = P.z + P.fz * d;
      if (heightAt(x, z) > -0.55 || this.map.deckAt(x, z, st.bridge)) continue;
      const where = z > 150 ? this.isle2.fishWhere(x, z) : deck?.boat ? 'boat' : riverDist(x, z) < 4 && z < 34 ? 'river' : 'pier';
      return { where, x, z };
    }
    return null;
  }

  /** Called by the fishing game when it ends (id = the fish, or null). */
  afterFish(id) {
    if (id) this.seasons.onFish();
    this.markDirty();
  }

  /** Grumbleton's fishing lines: the rod, then the dive suit for three fish. */
  seaTalk(n, L) {
    const S = this.save;
    if (!S.intro) return null;
    if (count(S, 'seaChart') && !S.isle2.chart) {
      return {
        lines: [L('chart1', null, () => this.celebrate(n)), L('chart2'), L('chart3')],
        after: () => { this.isle2.learnChart(); this.game.ui.toast(t('isl.t.chart'), 2800); },
      };
    }
    if (!S.sea.rod) {
      return {
        lines: [L('rod1', null, () => { n.hop = 1; }), L('rod2'), L('rod3')],
        after: () => {
          S.sea.rod = true;
          S.sea.quest = 1;
          S.sea.questBase = S.sea.caught;
          this.giveItems([['rod', 1], ['fishlog', 1]]);
          const i = S.inv.findIndex((it) => it.id === 'rod');
          if (i >= 0) S.sel = i;
          this.game.ui.toast(t('isl.t.quest'));
        },
      };
    }
    if (S.sea.quest === 1 && S.sea.caught - (S.sea.questBase || 0) >= 3) {
      return {
        lines: [L('fishDone1', null, () => this.celebrate(n)), L('fishDone2'), L('fishDone3')],
        after: () => {
          S.sea.quest = 2;
          S.sea.suit = true;
          this.addPts('grumbleton', 10);
          this.grant({ coins: 50 });
          this.game.ui.toast(t('isl.t.got', { item: t('isl.i.suit') }), 2200);
        },
      };
    }
    return null;
  }

  startDive() {
    if (this.launching) return;
    this.launching = true;
    this.save.last = { place: null, at: now() };
    this.dirty = true;
    this.flush();
    this.game.transition(() => new DiveScene(this.game));
  }

  openLog() {
    this.mode = 'log';
    this.log = { i: this.log?.i || 0, t: 0 };
    this.renderLog();
    this.game.audio.play('select');
  }

  renderLog() {
    const L = this.save.sea.log;
    const n = FISH_IDS.filter((id) => L[id]).length;
    const cells = FISH_IDS.map((id, i) => {
      const got = !!L[id];
      const img = got ? `<img src="${this.picture(id)}" alt="">` : `<img src="${this.picture(id)}" alt="" style="filter:brightness(0) opacity(.35)">`;
      const sea = FISH[id].seasons ? `<i style="position:absolute;right:4px;top:2px;font-style:normal">${FISH[id].seasons.map((sn) => SEASON_ICON[sn]).join('')}</i>` : '';
      return `<div class="isl-logcell ${i === this.log.i ? 'on' : ''}" style="position:relative">${sea}${img}<span>${esc(got ? t(`isl.i.${id}`) : t('isl.log.unknown'))}</span></div>`;
    }).join('');
    const id = FISH_IDS[this.log.i], f = FISH[id], got = !!L[id];
    const when = f.hours[0] === 0 && f.hours[1] === 24 ? t('isl.when.any') : t('isl.when.hours', { a: f.hours[0], b: f.hours[1] });
    const seasons = f.seasons ? ` · ${f.seasons.map((sn) => SEASON_ICON[sn]).join('')} ${esc(t('isl.log.seasons', { list: f.seasons.map((sn) => t(`isl.seasonIn.${sn}`)).join(t('isl.or')) }))}` : '';
    const info = `${got ? esc(t(`isl.i.${id}`)) : esc(t('isl.log.unknown'))} · ${esc(t(`isl.where.${f.where}`))} · ${esc(when)}${seasons}${got ? ` · ${esc(t('isl.log.caughtN', { n: L[id] }))}` : ''}${f.rare === 2 ? ' · ★' : ''}`;
    this.hud.setPanel(`<h2>${esc(t('isl.log.title'))} <small style="font-size:.5em;opacity:.7">${esc(t('isl.log.count', { n, m: FISH_IDS.length }))}</small></h2>
      <div class="isl-loggrid">${cells}</div><div class="isl-foot" style="font-size:clamp(14px,1.4vw,20px);opacity:1">${info}</div>
      <div class="isl-foot">${esc(tFor(this.player?.p, 'isl.log.hint'))}</div>`);
  }

  updateLog(inp, dt) {
    this.log.t += dt;
    const step = inp.stepX + -inp.stepY * 8;
    if (step) { this.log.i = (this.log.i + step + FISH_IDS.length) % FISH_IDS.length; this.game.audio.play('select'); this.renderLog(); }
    if (this.log.t > 0.25 && (inp.bPressed || inp.aPressed)) { this.hud.setPanel(null); this.mode = 'walk'; }
  }

  // ---------- start menu (Island, Story or Solo), same as the shared island's ----------

  openMode(index = 0) {
    if (this.helpEl) this.toggleHelp();
    this.mode = 'menu';
    this.modeIndex = index;
    this.modeT = 0;
    this.modeEl = this.game.ui.panel('', 'panel picker');
    this.renderMode();
    this.game.audio.play('select');
  }

  renderMode() {
    const icons = { island: '🏝️', story: '📖', solo: '🗺️' };
    const opts = MODES.map((k, i) => `<div class="vote-opt mode-opt ${i === this.modeIndex ? 'on' : ''}">
      <div class="mode-icon">${icons[k]}</div><b>${t(`mode.${k}`)}</b><small>${t(`mode.${k}.sub`)}</small></div>`).join('');
    this.modeEl.innerHTML = `<div class="results-title">${t('mode.title')}</div><div class="vote-row">${opts}</div><div class="results-footer">${t('mode.hint')}</div>`;
  }

  updateMode(inp, dt) {
    if (this.profilePicker) { this.profilePicker.update(dt); return; }
    this.modeT += dt;
    const to = THREE.MathUtils.clamp(this.modeIndex + inp.stepX, 0, MODES.length - 1);
    if (inp.stepX && to !== this.modeIndex) { this.modeIndex = to; this.game.audio.play('select'); this.renderMode(); }
    if (inp.cPressed && this.modeT > 0.25) { this.closeMode(); return; }
    if ((inp.aPressed || inp.bPressed) && this.modeT > 0.25) {
      this.modeEl.remove();
      this.modeEl = null;
      this.game.audio.play('join');
      const mode = MODES[this.modeIndex];
      this.flush();
      if (mode === 'solo') {
        this.profilePicker = new ProfilePicker(this, {
          onDone: (profile, deviceId) => { this.profilePicker = null; this.launching = true; this.game.enterSolo(profile, deviceId); },
          onCancel: () => { this.profilePicker = null; this.openMode(MODES.indexOf('solo')); },
        });
      } else { this.launching = true; this.game.leaveSolo(mode); }
    }
  }

  closeMode() {
    this.modeEl?.remove();
    this.modeEl = null;
    this.mode = 'walk';
  }

  toggleHelp() {
    if (this.helpEl) { this.helpEl.remove(); this.helpEl = null; return; }
    const P = this.player?.p;
    this.helpEl = this.game.ui.panel(`<div class="help-panel"><h2>${esc(t('isl.help.title'))}</h2>
      <ul>${[1, 2, 3, 4, 5, 6].map((i) => `<li>${esc(tFor(P, `isl.help.${i}`))}</li>`).join('')}</ul></div>`);
  }

  onLanguage() {
    if (this.helpEl) { this.toggleHelp(); this.toggleHelp(); }
    if (this.modeEl) this.renderMode();
    if (this.mode === 'shop') this.renderShop();
    if (this.mode === 'cook') this.cafe.renderCook();
    if (this.mode === 'log') this.renderLog();
    if (this.mode === 'dialog' && this.dlg) this.showLine();
  }

  // ---------- frame ----------

  movePlayer(inp, dt) {
    const P = this.player;
    let mx = inp.x, mz = -inp.y;
    const len = Math.hypot(mx, mz);
    if (len > 1) { mx /= len; mz /= len; }
    const st = this.walkState;
    if (len > 0.15) {
      const dx = mx * SPEED * dt, dz = mz * SPEED * dt;
      if (this.map.walkable(P.x + dx, P.z, PR, st)) P.x += dx;
      if (this.map.walkable(P.x, P.z + dz, PR, st)) P.z += dz;
      P.fx = mx / Math.max(len, 1e-3);
      P.fz = mz / Math.max(len, 1e-3);
      P.ch.face(mx, mz);
    }
    // never get stuck (e.g. after an unlock changes the map): nudge toward home
    if (!this.indoors && !this.map.walkable(P.x, P.z, PR * 0.5, st)) this.unstick(P, st);
    if (this.indoors) this.builder.clampInside(P);
    P.y = this.map.floorAt(P.x, P.z, st.bridge);
    P.moving = Math.min(1, len);
  }

  /** Step out of anything we ended up inside (an unlock or a teleport): the nearest free spot. */
  unstick(P, st) {
    for (let r = 0.3; r < 6; r += 0.3) {
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI * 2;
        const x = P.x + Math.cos(a) * r, z = P.z + Math.sin(a) * r;
        if (this.map.walkable(x, z, PR, st)) { P.x = x; P.z = z; return; }
      }
    }
  }

  updatePlayerLook(dt) {
    const P = this.player;
    if (!P) return;
    const held = this.save.inv[this.save.sel];
    const tool = held && TOOLS.includes(held.id) ? held.id : null;
    if (tool !== P.toolId) {
      if (P.toolMesh) P.hand.remove(P.toolMesh);
      P.toolMesh = tool ? makeTool(tool) : null;
      if (P.toolMesh) { P.toolMesh.scale.setScalar(0.7); P.hand.add(P.toolMesh); }
      P.toolId = tool;
    }
    this.swing = Math.max(0, this.swing - dt * 3.5);
    P.hand.rotation.x = this.swing > 0 ? -Math.sin(this.swing * Math.PI) * 1.6 + 0.3 : 0.3;
    P.ch.group.position.set(P.x, P.y, P.z);
    P.ch.update(dt, { moving: this.mode === 'walk' ? P.moving : 0, grounded: true, vy: 0 });
  }

  snapCamera() {
    const P = this.player || { x: HOME.x, y: 0, z: HOME.z + 4 };
    this.camTarget.set(P.x, P.y || 0, P.z);
    this.camPos.set(P.x, (P.y || 0) + CAM_UP, P.z + CAM_BACK);
    this.updateCamera(0);
  }

  updateCamera(dt) {
    const P = this.player;
    if (P) {
      const k = dt ? Math.min(1, dt * 4) : 1;
      this.camTarget.lerp(new THREE.Vector3(P.x, P.y, P.z), k);
      this.camPos.lerp(new THREE.Vector3(P.x, P.y + CAM_UP, P.z + CAM_BACK), k);
    }
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camTarget.x, this.camTarget.y + 0.6, this.camTarget.z);
    const sun = this.lights.sun;
    const d = this.sunDir || new THREE.Vector3(-0.5, 1, 0.6);
    sun.position.copy(this.camTarget).add(d.clone().normalize().multiplyScalar(40));
    sun.target.position.copy(this.camTarget);
  }

  updateLabels() {
    const P = this.mode === 'walk' || this.mode === 'bag' ? this.player : null; // no tags over panels
    const S = this.save;
    const cam = this.camera;
    // arcade cabinets: only the nearest one gets a label, else the hall's own name
    let cab = null, cd = 3.2;
    for (const tg of this.placeTags) if (tg.pl.cabinet !== undefined && P) { const d = Math.hypot(P.x - tg.pl.door.x, P.z - tg.pl.door.z); if (d < cd) { cd = d; cab = tg; } }
    const hallVis = P && !cab && Math.hypot(P.x - HALL.x, P.z - HALL.z) < 12;
    if (hallVis) {
      const html = esc(t('isl.hall'));
      if (this.hallTag.innerHTML !== html) this.hallTag.innerHTML = html;
      this.game.ui.place(this.hallTag, this.hallPos, cam);
    } else this.hallTag.style.display = 'none';
    for (const tg of this.placeTags) {
      const pl = tg.pl;
      const vis = P && (pl.id !== 'burrow' || S.unlocks.burrow) && Math.hypot(P.x - pl.door.x, P.z - pl.door.z) < 11 && (pl.cabinet === undefined || tg === cab);
      if (!vis) { tg.el.style.display = 'none'; continue; }
      const sub = this.placeOpen(pl) ? this.placeInfo(pl) : t(`isl.locked.${pl.lock}`);
      const html = `${esc(t(`game.${pl.key}`))}${sub ? `<small>${esc(sub)}</small>` : ''}`;
      if (tg.el.innerHTML !== html) tg.el.innerHTML = html;
      this.game.ui.place(tg.el, tg.pos, cam);
    }
    let markShown = false;
    for (const n of this.npcs) {
      const d = P ? Math.hypot(P.x - n.x, P.z - n.z) : 99;
      const h = (n.model.group.scale.y || 1) * (n.id === 'grumbleton' ? 1.8 : 1.55);
      n.tagPos.set(n.x, n.y + h + 0.55, n.z);
      if (d < 8) {
        const st = npcState(S, n.id);
        const html = `${esc(t(`isl.npc.${n.id}`))}${n.id !== 'mumble' ? heartsHtml(heartsOf(st)) : ''}`;
        if (n.tag.innerHTML !== html) n.tag.innerHTML = html;
        this.game.ui.place(n.tag, n.tagPos, cam);
      } else n.tag.style.display = 'none';
      if (n.sleep && d < 14) this.game.ui.place(n.zzz, n.tagPos.clone().add(new THREE.Vector3(0.6, 0.4, 0)), cam);
      else n.zzz.style.display = 'none';
      if (!markShown && !n.sleep && d < 16 && this.hasNews(n.id) && !n.talking) {
        markShown = true;
        this.markEl.textContent = '!';
        this.game.ui.place(this.markEl, n.tagPos.clone().add(new THREE.Vector3(0, 0.9, 0)), cam);
      }
    }
    if (!markShown) this.markEl.style.display = 'none';
    this.museum.updateLabel(P);
  }

  updateHud(ia) {
    const S = this.save;
    const h = this.hour ?? hourOf();
    const hh = Math.floor(h), mm = Math.floor((h - hh) * 60);
    const sea = this.seasons;
    const weather = sea.festival ? t(`isl.fest.${sea.festival}`) : sea.rainy ? (sea.season === 'winter' ? `❄ ${t('isl.weather.snow')}` : `☂ ${t('isl.weather.rain')}`) : '';
    this.hud.setTop({ time: `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`, night: this.night > 0.5, coins: S.coins, phase: [this.phaseName(h), `${SEASON_ICON[sea.season]} ${t(`isl.season.${sea.season}`)}`, weather].filter(Boolean).join(' · ') });
    this.hud.setTasks(this.mode === 'walk' || this.mode === 'bag' ? this.tasks() : []);
    const items = S.inv.map((it) => ({ ...it, kind: ITEMS[it.id]?.kind, name: itemName(it.id) }));
    if (this.mode !== 'service' && this.mode !== 'deco') this.hud.setHotbar(items, S.sel, this.mode === 'bag');
    this.hud.setKeys(tFor(this.player?.p, this.mode === 'service' ? 'isl.serve.keys' : 'isl.keys'));
    let prompt = '';
    if (this.mode === 'walk' && ia) {
      const parts = [ia.a?.text, ia.b?.text].filter(Boolean);
      prompt = parts.join(' · ');
    }
    if (!['fish', 'deco', 'sled'].includes(this.mode)) this.hud.setPrompt(prompt);
    const mb = this.map.mailbox.userData;
    mb.flag.rotation.z = S.mail.length ? 0 : -Math.PI / 2;
    mb.letter.visible = S.mail.length > 0 && this.mode !== 'letter';
    if (mb.letter.visible) { mb.letter.position.y = 2.1 + Math.sin(this.time * 3) * 0.12; mb.letter.rotation.y += 0.02; }
  }

  update(dt) {
    this.handleJoins();
    if (this.game.input.escPressed && !this.profilePicker) this.toggleHelp();
    this.toasts.update(dt, this.panelOpen);
    this.secT -= dt;
    if (this.secT <= 0) { this.secT = 1; this.secondTick(); }
    this.saveT -= dt;
    if (this.saveT <= 0) { this.saveT = 2; this.flush(); }

    const P = this.player;
    const inp = P ? this.input(P.p) : null;
    let ia = null;
    if (inp && !this.launching) {
      // hotbar keys work any time you walk
      for (let k = 1; k <= 9; k++) if (this.game.input.pressed.has(`Digit${k}`) && this.save.inv[k - 1] && this.mode === 'walk') { this.save.sel = k - 1; this.game.audio.play('select'); }
      switch (this.mode) {
        case 'dialog': this.updateDialog(inp, dt); break;
        case 'bag': this.updateBag(inp, dt); break;
        case 'shop': this.updateShop(inp, dt); break;
        case 'letter': this.updateLetter(inp, dt); break;
        case 'menu': this.updateMode(inp, dt); break;
        case 'fish': this.fishing.update(inp, dt); if (!this.fishing.active) this.mode = 'walk'; break;
        case 'cook': this.cafe.updateCook(inp, dt); break;
        case 'service': this.cafe.updateService(inp, dt); break;
        case 'log': this.updateLog(inp, dt); break;
        case 'bench': this.builder.updateBench(inp, dt); break;
        case 'deco': this.builder.updateDecorate(inp, dt); break;
        case 'cal': this.seasons.updateCalendar(inp, dt); break;
        case 'sled': this.seasons.sled.update(inp, dt); break;
        case 'museum': this.museum.update(inp, dt); break;
        case 'sail': this.isle2.updateSail(inp, dt); break;
        default: {
          this.movePlayer(inp, dt);
          ia = this.interactions();
          this.farm.showHighlight(ia.tile, ia.hl ?? 0xffffff);
          if (inp.cPressed) { this.openMode(0); break; }
          if (inp.aPressed) ia.a?.fn();
          else if (inp.bPressed) ia.b?.fn();
        }
      }
      if (this.mode !== 'walk') this.farm.showHighlight(null);
    }
    this.updateNpcs(dt);
    this.ranch.update(dt);
    this.seasons.update(dt);
    this.isle2.update(dt, this.time);
    this.updatePlayerLook(dt);
    this.farm.animate(dt, this.time);
    this.life.update(dt, this.night || 0, P || { x: 0, z: 0 });
    for (const f of Object.values(this.finds)) if (f.g.visible) { f.g.userData.glint.rotation.y += dt * 3; f.g.userData.glint.scale.y = 0.6 + Math.sin(this.time * 5) * 0.4; }
    this.updateCamera(dt);
    this.updateLabels();
    this.updateHud(ia);
  }

  idle(dt) {
    this.toasts.update(dt, this.panelOpen);
    this.updateNpcs(dt);
    this.updatePlayerLook(dt);
    this.life.update(dt, this.night || 0, this.player || { x: 0, z: 0 });
  }

  dispose() {
    this.toasts.dispose();
    this.cafe?.dispose();
    this.fishing?.dispose();
    setPictures(null);
    this.flush();
    this.game.roster.save();
    super.dispose();
  }
}

function S_VISITED(save, id) {
  return !!save.visited?.[id];
}
