import * as THREE from 'three';
import { MiniGame } from '../core/minigame.js';
import { Character } from '../core/character.js';
import { COLORS, toon, basic, sharedGeo } from '../core/palette.js';
import { addLights } from '../core/world.js';
import { SONGS } from '../core/audio.js';
import { t, tFor } from '../core/i18n.js';
import { esc } from '../core/ui.js';
import { say } from '../core/voice.js';
import { KeepScene } from './keep.js';
import { PR, SPEED, clamp, mesh } from './keep/common.js';
import { FoeMixin } from './keep/foes.js';
import './keepsolo/strings.js';
import './keepsolo/strings2.js';
import { loadKeepSolo, saveKeepSolo } from './keepsolo/save.js';
import { CLASSES, MAX_LEVEL, B_MOVE, xpNeed, heroStats, armorCut, compareItem } from './keepsolo/classes.js';
import { foeHitAt, isDeep, deepDepth, ACT_FLOORS, ACTS, actOf, diffOffset } from './keepsolo/acts.js';
import { WorldMixin, LOOT } from './keepsolo/world.js';
import { TownMixin, TOWN_START, QuestPanel, GatePanel } from './keepsolo/town.js';
import { SkillMixin } from './keepsolo/skills.js';
import { GridPanel } from './keepsolo/inventory.js';
import { Hud, ClassPicker, SkillMenu } from './keepsolo/ui.js';
import { dressHero } from './keepsolo/models.js';
import { ControlMixin } from './keepsolo/control.js';
import { HeroMixin } from './keepsolo/hero.js';
import { LightMixin } from './keepsolo/light.js';
import { MonsterMixin } from './keepsolo/monsters.js';
import { CharPanel, TreePanel } from './keepsolo/tree.js';

// Pillow Keep Solo: a single-player Diablo-like for the solo island (the keep tower on the west
// bank). Pick a hero (Pillow Knight, Feather Archer or Bubble Wizard: one save each), get ready in
// the town of Pillowby (smith, potion shop, stash, quest board, townsfolk), then go through the gate:
// four acts of three random floors (Pillow Fort Cellars, Feather Forest, Bubble Bath Grotto, the
// Dream Keep), each ending with a boss whose attacks are drawn on the floor first, and after the
// last boss the endless Deep Keep. Grumbles poof into fluff and stars; loot comes in four rarities
// with random stats; the bag has 32 cells. Fainting sends you to town and drops your bag (not what
// you wear) where you fainted: go back and walk over it. Faint again first and that older bag is gone.
//
//   stick: walk · [A]: attack (talk in town) · [B]: block / dodge roll / bubble hop
//   tap [C]: the chosen skill (or pick up the item you stand on) · hold [C]: menu (skills, potion,
//   town portal, bag)
//
// The dungeon reuses the co-op Pillow Keep: its floor generator (keep/dungeon.js), grumbles
// (keep/foes.js), telegraphed boss attacks (keep/hazards.js), Big Teddy and the Sleepy Sheep
// (keep/bosses.js), and some world methods of KeepScene, borrowed below.
//
// Code: keepsolo/acts.js (acts, plans, difficulty, quests), classes.js (heroes, skills, stats),
// skills.js (attacks and skills), items.js (gear), world.js (floors and loot), town.js (Pillowby and
// its panels), inventory.js (bag, smith, stash), bosses.js (Honk the Goose, Captain Quack),
// models.js (gear looks), ui.js (HUD and menus), save.js, strings.js.
// Progress: game.roster.progress.keepSolo (per solo profile).

SONGS.keepTown ??= { bpm: 96, root: 60, chords: [0, 5, 9, 7], seed: 812, lead: 'triangle' };
SONGS.keepDeep ??= { bpm: 122, root: 57, chords: [0, 8, 5, 7], seed: 377, lead: 'square' };

const TILT = 1.0;
const HOLD_C = 0.3; // seconds of [C] before the menu opens
const NO_INPUT = { x: 0, y: 0, a: false, b: false, c: false, aPressed: false, bPressed: false, cPressed: false, stepX: 0, stepY: 0 };

// World methods borrowed from the co-op KeepScene (they only use the world fields, see world.js).
const BORROW = ['cx', 'cz', 'tileC', 'tileR', 'cell', 'walkable', 'walkableAt', 'buildTiles', 'buildDoors', 'buildStairs', 'buildDecor', 'makeChest',
  'moveCircle', 'pushOut', 'pushRound', 'inArc', 'swing', 'updateShots', 'doorNear', 'chestNear', 'unlock', 'updateDoorsAndChests', 'addFx',
  'spawnStarFx', 'updateFx', 'floater', 'updateFloaters', 'updateLamps', 'inStairs', 'bossBar'];

export class KeepSoloScene extends MiniGame {
  constructor(game, opts = {}) {
    super(game, opts);
    this.state = 'play'; // no countdown: the class picker is the intro
    this.playStart = 0;
    this.data = loadKeepSolo(game.roster);
    this.camera.fov = 40;
    const L = addLights(this.scene, { size: 26, dir: new THREE.Vector3(-0.35, 1, 0.55) });
    this.sun = L.sun;
    this.sunDir = new THREE.Vector3(-0.35, 1, 0.55).normalize().multiplyScalar(40);
    L.hemi.color.set(0xfff4e6);
    L.hemi.groundColor.set(0xffcf9e);
    L.hemi.intensity = 1.35;
    this.sun.intensity = 1.55;
    this.lamps = [];
    for (let i = 0; i < 4; i++) {
      const pl = new THREE.PointLight(0xff9a3c, 0, 10, 1.6);
      this.scene.add(pl);
      this.lamps.push(pl);
    }
    this.lampT = 0;
    this.floaters = [];
    this.toastCd = 0;
    this.camCenter = new THREE.Vector3();
    this.camDist = 20;
    this.cHold = 0;
    this.portalCd = 0;
    this.saveT = 0;
    this.live = null; // the floor waiting behind the town portal: { world, at }
    this.lootRates = LOOT; // keep/foes.js reads the gear drop chances from here
    this.hud = new Hud(this);
    this.initControl();
    this.cls = this.data.last;
    this.hs = this.data.classes[this.cls];
    this.makeHero();
    this.initLight(L);
    this.buildTown();
    this.townWorld = this.snapshotWorld();
    this.placeHero(TOWN_START.x, TOWN_START.z);
    this.mode = 'pick';
    this.hud.show(false);
    this.picker = new ClassPicker(this, (cls) => this.pickClass(cls));
    this.updateCamera(0, true);
    game.audio.playMusic('keepTown');
  }

  get player() { return this.players[0]; }

  /** While a panel or menu is open, Esc closes it (instead of the pause menu). */
  get ownMenu() { return !!(this.panel || this.menu); }

  onLanguage() {
    this.picker?.render?.();
    this.panel?.render?.();
    this.hud.cache = {};
  }

  // ---------------------------------------------------------------- hero

  makeHero() {
    const old = this.hero;
    if (old) {
      for (const o of [old.ch.group, old.ring, old.aimPivot, old.arrow]) this.scene.remove(o);
      old.label.remove();
    }
    const p = this.player;
    const color = p?.color ?? CLASSES[this.cls].color;
    const ch = new Character(color, { hat: p?.hat ?? CLASSES[this.cls].hat });
    this.scene.add(ch.group);
    const hand = new THREE.Group(); hand.position.set(0, 0.5, 0); ch.pivot.add(hand);
    const off = new THREE.Group(); off.position.set(0, 0, 0); ch.pivot.add(off);
    const capeSlot = new THREE.Group(); capeSlot.position.set(0, 0.5, 0); ch.pivot.add(capeSlot);
    // block: a soft cushion dome in front of the knight
    const blockMat = new THREE.MeshToonMaterial({ color: 0xffd0e4, transparent: true, opacity: 0.45, gradientMap: toon(0xffffff).gradientMap, depthWrite: false });
    blockMat.userData = {};
    // the wizard's bubble shield
    const bubMat = new THREE.MeshToonMaterial({ color: 0xbfe9ff, transparent: true, opacity: 0.35, gradientMap: toon(0xffffff).gradientMap, depthWrite: false });
    bubMat.userData = {};
    const bubble = new THREE.Mesh(sharedGeo('ksShieldBub', () => new THREE.SphereGeometry(1.0, 20, 14)), bubMat);
    bubble.position.y = 0.75;
    bubble.visible = false;
    ch.group.add(bubble);
    const block = new THREE.Mesh(sharedGeo('ksBlockDome', () => new THREE.SphereGeometry(0.85, 18, 10, -Math.PI / 2, Math.PI, 0, Math.PI / 2)), blockMat);
    block.rotation.x = -Math.PI / 2;
    block.position.set(0, 0.6, 0.15);
    block.visible = false;
    ch.pivot.add(block);
    const css = p?.css ?? '#ff5d73';
    const ring = mesh(sharedGeo('kPRing', () => new THREE.RingGeometry(0.5, 0.64, 28)), basic(color), 0, 0, 0, false);
    ring.rotation.x = -Math.PI / 2;
    this.scene.add(ring);
    const aim = mesh(sharedGeo('kAim', () => new THREE.ConeGeometry(0.16, 0.38, 3)), basic(color), 0, 0, 0.95, false);
    aim.rotation.x = Math.PI / 2;
    const aimPivot = new THREE.Group();
    aimPivot.add(aim);
    this.scene.add(aimPivot);
    // a golden arrow on the floor that points to the dropped bag
    const arrowM = mesh(sharedGeo('ksBagArrow', () => new THREE.ConeGeometry(0.3, 0.7, 3)), basic(0xffd23f), 0, 0, 1.6, false);
    arrowM.rotation.x = Math.PI / 2;
    const arrow = new THREE.Group();
    arrow.add(arrowM);
    arrow.visible = false;
    this.scene.add(arrow);
    const label = this.game.ui.label('label ks-prompt');
    const e = {
      p, ch, hand, off, capeSlot, block, bubble, ring, aimPivot, arrow, label, labelHtml: '', color, css,
      x: 0, y: 0, z: 0, vx: 0, vz: 0, fx: 0, fz: -1, state: 'walk', hp: 1, inv: 0, cdA: 0, cdB: 0, swingT: 0, swingDir: 1, spinT: 0,
      rollT: 0, rollX: 0, rollZ: 0, rushT: 0, cheerT: 0, castT: 0, potCd: 0, luckyT: 0, hurtT: 0, cd: {}, attackN: 0, hasKey: false,
      nests: 0, fluffed: 0, blocking: false, offKind: null, offMesh: null, mana: 0, gcd: 0, leap: null, leapY: 0, shieldHp: 0, shieldT: 0,
    };
    this.hero = e;
    this.ents = [e];
    this.refreshHero(true);
  }

  /** Stats and looks from the class, level and worn gear. */
  refreshHero(full = false) {
    const e = this.hero;
    const before = e.st?.maxHp || 1, beforeM = e.st?.maxMana || 1;
    e.st = heroStats(this.cls, this.hs);
    e.hp = full ? e.st.maxHp : Math.min(e.st.maxHp, e.hp * (e.st.maxHp / before));
    e.mana = full ? e.st.maxMana : Math.min(e.st.maxMana, e.mana * (e.st.maxMana / beforeM));
    dressHero(e, this.hs.gear, this.player?.hat ?? CLASSES[this.cls].hat);
  }

  placeHero(x, z, fx = 0, fz = -1) {
    const e = this.hero;
    e.x = x; e.z = z; e.vx = e.vz = 0; e.fx = fx; e.fz = fz;
    e.ch.face(fx, fz);
  }

  /** While choosing: the bean in town shows that hero's gear. */
  previewClass(cls) {
    this.cls = cls;
    this.hs = this.data.classes[cls];
    this.makeHero();
    this.placeHero(TOWN_START.x, TOWN_START.z, 0, 1);
  }

  pickClass(cls) {
    this.picker = null;
    this.cls = cls;
    this.data.last = cls;
    this.hs = this.data.classes[cls];
    this.makeHero();
    this.placeHero(TOWN_START.x, TOWN_START.z);
    this.mode = 'town';
    this.hud.show(true);
    this.updateCamera(0, true);
    const first = !this.hs.started;
    this.hs.started = true;
    this.game.ui.banner(t('ks.townName'), t(first ? 'ks.welcomeNew' : 'ks.welcomeBack', { cls: t(`ks.cls.${cls}`) }), 2400);
    this.say(t(first ? 'ks.welcomeSay' : 'ks.welcomeBack', { cls: t(`ks.cls.${cls}`) }));
    if (first) this.later(2.6, () => this.npcSay('fluff', tFor(this.player, 'ks.npc.fluff.first')));
    this.saveNow();
  }

  say(text) { say(text); }

  /** How much better (positive) an item would make this hero; null if it is for another class. */
  compareItemFor(item) {
    return compareItem(this.cls, this.hs, item, this.D);
  }

  addXp(x) {
    const hs = this.hs;
    if (hs.level >= MAX_LEVEL) return;
    hs.xp += x;
    while (hs.level < MAX_LEVEL && hs.xp >= xpNeed(hs.level)) {
      hs.xp -= xpNeed(hs.level);
      hs.level++;
      this.levelUp();
    }
  }

  levelUp() {
    const e = this.hero, hs = this.hs;
    this.levelUpKit();
    this.refreshHero(true);
    this.game.audio.play('fanfare');
    const at = new THREE.Vector3(e.x, 2.6, e.z);
    this.floater(t('ks.levelUp', { n: hs.level }), at, '#ffb400', 1.8, true);
    this.confetti.burst(new THREE.Vector3(e.x, 0.3, e.z), 0, { count: 30, speed: 3, up: 7, colors: [COLORS.gold, 0xffffff, e.color], life: 1, gravity: -4, size: 0.13 });
    this.addFx('ring', e.x, e.z, { color: COLORS.gold, from: 0.4, to: 2.6, life: 0.6 });
    this.dirty = true;
  }

  /** Grumble touches, thrown pillows and boss attacks land here (the co-op keep calls it a yawn). */
  addYawn(e, amount) {
    if (e.state !== 'walk' || e.inv > 0 || this.kind !== 'dungeon' || this.moving) return false;
    let dmg = amount * foeHitAt(this.D) * (1 - armorCut(e.st.armor, this.D));
    const blocked = e.blocking;
    if (blocked) dmg *= 0.3;
    if (e.shieldHp > 0) {
      // the bubble shield soaks it up first
      const soak = Math.min(e.shieldHp, dmg);
      e.shieldHp -= soak; dmg -= soak;
      if (e.shieldHp <= 0) { e.shieldT = 0; this.puffs.burst(new THREE.Vector3(e.x, 1, e.z), 0xbfe9ff, { count: 10, size: 0.4, life: 0.5, speed: 3 }); this.game.audio.play('pop'); }
    }
    e.hp -= dmg;
    e.inv = 0.5;
    e.hurtT = 0.25;
    e.ch.squash(0.75);
    this.game.audio.play(blocked ? 'boing' : 'bump');
    this.puffs.burst(new THREE.Vector3(e.x, 1.1, e.z), blocked ? 0xffd0e4 : 0xffffff, { count: 4, size: 0.3, life: 0.5, speed: 1.6 });
    if (blocked) this.floater(t('ks.blocked'), new THREE.Vector3(e.x, 2.3, e.z), '#ff6fae', 0.6);
    // Thorny gear bonks grumbles that bump into you.
    if (e.st.powers.has('thorns')) for (const g of [...this.grumbles]) if (!g.dead && Math.hypot(g.x - e.x, g.z - e.z) < 2.2) this.hitGrumble(g, e.st.dmg * 1.5, e);
    if (e.hp <= 0) this.faint();
    return !blocked;
  }

  /** Out of health: the hero curls up, the bag falls, and Pillowby's bed waits. */
  faint() {
    const e = this.hero;
    e.state = 'faint';
    e.hp = 0;
    e.vx = e.vz = 0;
    e.blocking = false;
    this.hs.stats.deaths++;
    this.game.audio.play('dizzy');
    this.puffs.burst(new THREE.Vector3(e.x, 0.8, e.z), 0xc9a8ff, { count: 16, size: 0.5, life: 1, speed: 2 });
    const hasItems = this.hs.bag.length > 0;
    this.game.ui.banner(t('ks.fainted'), t(hasItems ? 'ks.faintedBag' : 'ks.faintedNoBag'), 2600);
    this.say(`${t('ks.fainted')} ${t(hasItems ? 'ks.faintedBag' : 'ks.faintedNoBag')}`);
    this.later(2.4, () => this.afterFaint());
  }

  afterFaint() {
    if (this.kind !== 'dungeon') return;
    const e = this.hero, hs = this.hs;
    // Only the newest bag waits: an older one (here or anywhere) is gone.
    if (hs.drop) {
      for (const it of this.items) if (it.kind === 'bag') this.removeItem(it);
      if (this.live) for (const it of this.live.world.items) if (it.kind === 'bag') { it.taken = true; it.label?.remove(); it.mesh.parent?.remove(it.mesh); }
      if (hs.drop.items.length) this.game.ui.toast(t('ks.oldBagGone'), 2600);
      hs.drop = null;
    }
    const items = hs.bag.map((x) => x.it);
    if (items.length) {
      // the spot must be walkable floor (not a door or stairs) so the bag can be reached
      const drop = { g: this.g, diff: hs.diff, seed: this.floorSeed, x: e.x, z: e.z, items };
      hs.drop = drop;
      hs.bag.length = 0;
      this.spawnBag(drop);
    }
    // the boss (if any) wakes up fresh next time
    const b = this.boss;
    if (b && !b.gone && b.state !== 'asleep') {
      b.hp = b.max; b.phase = 0; b.state = 'idle'; b.act = null; b.next = 2.2; b.y = 0;
      this.hazards.clear();
      this.game.audio.playMusic('keepDeep');
    }
    this.zones.forEach((z) => { z.done = true; });
    this.updateZones(0);
    this.goTown('faint');
  }

  // ---------------------------------------------------------------- moving between worlds

  /** From the gate: start a floor (an old floor behind the town portal is thrown away). */
  enterFloor(g) {
    if (this.moving) return;
    this.moving = true;
    this.game.ui.wipe();
    this.later(0.45, () => {
      if (this.live) { this.disposeWorld(this.live.world); this.live = null; }
      this.leaveTown();
      this.enterFloorNow(g);
      this.later(0.5, () => { this.moving = false; });
    });
  }

  leaveTown() {
    this.townWorld = this.snapshotWorld();
    this.hideWorldLabels(this.townWorld);
    this.scene.remove(this.level);
  }

  seedFor(g) {
    const drop = this.hs.drop;
    if (drop && drop.g === g) return drop.seed;
    return Math.floor(Math.random() * 1e9) >>> 0;
  }

  /** Build floor g right now (the current world must already be put away). */
  enterFloorNow(g, seed = this.seedFor(g)) {
    this.buildFloor(g, seed);
    const hs = this.hs;
    hs.reached = Math.max(hs.reached, g);
    if (isDeep(g)) hs.deepBest = Math.max(hs.deepBest, deepDepth(g));
    this.placeHero(this.start.x, this.start.z);
    this.hero.hasKey = false;
    this.hero.state = 'walk';
    this.mode = 'dungeon';
    this.updateFlow();
    this.updateCamera(0, true);
    this.updateLight(0, true);
    this.game.audio.playMusic(isDeep(g) ? 'keepDeep' : 'bubble');
    this.game.ui.banner(this.placeTitle(), this.placeSub(), 1900);
    this.say(`${this.placeTitle()}. ${this.placeSub()}`);
    if (!hs.tips.dungeon) {
      hs.tips.dungeon = true;
      const tip = this.isPad() ? 'ks.tipDungeonPad' : 'ks.tipDungeon';
      this.later(2.2, () => { this.game.ui.toast(tFor(this.player, tip), 5200); this.say(tFor(this.player, tip)); });
    }
    this.saveNow();
  }

  placeTitle() {
    if (this.kind === 'town') return t('ks.townName');
    if (isDeep(this.g)) return t('ks.deepN', { n: deepDepth(this.g) });
    return t('ks.actFloor', { act: actOf(this.g) + 1, floor: (this.g % ACT_FLOORS) + 1 });
  }

  placeSub() {
    if (this.kind === 'town') return '';
    if (isDeep(this.g)) return t('ks.deepName');
    return t(`ks.actName.${ACTS[actOf(this.g)].id}`);
  }

  /** Back to Pillowby. reason: 'portal' (the floor waits), 'faint' (the floor waits, start at its entrance), 'act' (act cleared). */
  goTown(reason) {
    const keep = reason === 'portal' || reason === 'faint';
    const go = () => {
      if (keep) {
        const at = reason === 'portal' && this.portal ? { x: this.portal.x, z: this.portal.z + 1.6 } : { ...this.start };
        this.live = { world: this.snapshotWorld(), at };
        this.hideWorldLabels(this.live.world);
        this.scene.remove(this.level);
      } else {
        const cur = this.snapshotWorld();
        this.disposeWorld(cur);
      }
      this.useWorld(this.townWorld);
      const e = this.hero;
      this.placeHero(TOWN_START.x, TOWN_START.z + (reason === 'portal' ? 0 : 0));
      e.state = 'walk';
      e.hp = e.st.maxHp;
      e.mana = e.st.maxMana;
      e.hasKey = false;
      e.inv = 1;
      e.ch.pivot.rotation.x = 0;
      this.portalCd = 1.5;
      this.mode = 'town';
      this.D = this.townD();
      this.updateCamera(0, true);
      this.updateLight(0, true);
      this.game.audio.playMusic('keepTown');
      if (reason === 'faint') this.later(0.6, () => this.npcSay('snore', t(this.hs.drop ? 'ks.npc.snore.faint' : 'ks.npc.snore.faint0')));
      if (reason === 'act' && this.lastG !== undefined) this.actCleared();
      this.saveNow();
      this.later(0.5, () => { this.moving = false; });
    };
    this.moving = true;
    this.game.ui.wipe();
    this.later(0.45, go);
  }

  actCleared() {
    const act = actOf(this.lastG);
    const final = act === ACTS.length - 1;
    this.game.ui.banner(t(final ? 'ks.deepOpen' : 'ks.actOpen', { n: act + 2 }), t(final ? 'ks.deepOpenSub' : 'ks.actOpenSub'), 3000);
    this.say(t(final ? 'ks.deepOpenSay' : 'ks.actOpenSay', { n: act + 2 }));
    this.later(3.2, () => this.npcSay('gumdrop', t(`ks.npc.gumdrop.act${act + 1}`)));
  }

  /** Step through the town portal: the floor you left is just as you left it. */
  backToLive() {
    if (!this.live || this.moving) return;
    this.moving = true;
    this.game.audio.play('whoosh');
    this.game.ui.wipe();
    this.later(0.45, () => {
      const live = this.live;
      this.live = null;
      this.leaveTown();
      this.useWorld(live.world);
      if (this.portal) { this.level.remove(this.portal.mesh); this.portal = null; } // the floor's portal closes behind you
      this.placeHero(live.at.x, live.at.z);
      this.pushOut(this.hero, PR);
      this.hero.inv = 1.2;
      this.mode = 'dungeon';
      this.updateFlow();
      this.updateCamera(0, true);
      this.updateLight(0, true);
      this.game.audio.playMusic(isDeep(this.g) ? 'keepDeep' : 'bubble');
      this.game.ui.toast(`${this.placeTitle()} · ${this.placeSub()}`, 2000);
      this.later(0.5, () => { this.moving = false; });
    });
  }

  /** Town Portal scroll: a short spell, then a swirl opens and takes you home. Returns true if it started. */
  castPortal() {
    const e = this.hero;
    if (this.kind !== 'dungeon' || e.state !== 'walk' || e.castT > 0 || this.moving) return false;
    e.castT = 1.0;
    this.ctlCancel();
    this.game.audio.play('trap');
    this.game.ui.toast(t('ks.casting'), 1200);
    return true;
  }

  openFloorPortal() {
    const e = this.hero;
    const m = this.makePortalMesh();
    m.position.set(e.x, 0, e.z - 1.2);
    this.level.add(m);
    this.portal = { x: e.x, z: e.z - 1.2, mesh: m };
    this.game.audio.play('whoosh');
    this.goTown('portal');
  }

  nextFloor() {
    if (this.moving) return;
    this.moving = true;
    this.game.audio.play('fanfare');
    this.confetti.burst(new THREE.Vector3(this.stairs.x, 1.5, this.stairs.z), 0, { count: 50, speed: 8, up: 5, colors: [COLORS.gold, 0xffffff, 0xff5d73, 0x4cc9f0], life: 1.3, size: 0.18 });
    const g = this.g;
    this.lastG = g;
    if (!isDeep(g) && g % ACT_FLOORS === ACT_FLOORS - 1) {
      this.hs.reached = Math.max(this.hs.reached, g + 1);
      this.later(0.9, () => this.goTown('act'));
      return;
    }
    this.game.ui.wipe();
    this.later(0.45, () => {
      this.disposeWorld(this.snapshotWorld());
      this.enterFloorNow(g + 1);
      this.later(0.5, () => { this.moving = false; });
    });
  }

  // ---------------------------------------------------------------- panels

  openPanel(kind) {
    this.closePanel();
    const P = {
      bag: () => new GridPanel(this, 'bag'), smith: () => new GridPanel(this, 'smith'), stash: () => new GridPanel(this, 'stash'), shop: () => new GridPanel(this, 'shop'),
      sage: () => new GridPanel(this, 'sage'), lost: () => new GridPanel(this, 'lost'), char: () => new CharPanel(this), tree: () => new TreePanel(this),
      quests: () => new QuestPanel(this), gate: () => new GatePanel(this),
    }[kind];
    this.ctlCancel();
    this.panel = P();
    this.panelKind = kind;
    this.hero.vx = this.hero.vz = 0;
  }

  closePanel() {
    if (!this.panel) return;
    this.panel.close?.();
    this.panel = null;
    this.panelKind = null;
  }

  /** What tapping [C] does (gamepad): pick up gear under you, or the skill on [C] (in town: the bag). */
  tapC() {
    if (this.kind === 'town') { this.openPanel('bag'); return; }
    const it = this.gearNear();
    if (it) { this.pickGear(it); return; }
    const sk = this.hs.bar.rmb;
    if (sk && sk !== 'block') this.castSkill(sk, null);
    else this.game.ui.toast(t('ks.noSkillC'), 1600);
  }

  useMenuEntry(x) {
    if (!x || !x.on) { if (x) this.game.audio.play('bump'); return; }
    if (x.kind === 'skill') {
      this.assignSkill('rmb', x.id);
      this.game.ui.toast(t('ks.chosen', { skill: t(`ks.skill.${x.id}`) }), 1400);
      this.castSkill(x.id, null);
    } else if (x.kind === 'use') this.useFirst(x.id);
    else this.openPanel(x.id);
  }

  // ---------------------------------------------------------------- per frame

  update(dt) {
    this.frame(dt);
    this.updateLight(dt);
    this.mouse.endFrame();
  }

  frame(dt) {
    const d = this.player ? this.input(this.player) : null;
    this.toastCd -= dt;
    this.portalCd -= dt;
    if (this.mode === 'pick') {
      this.picker?.update(dt, d);
      this.updateTown(dt);
      this.poseHero(dt);
      this.updateCamera(dt);
      return;
    }
    if ((this.panel || this.menu) && this.game.input.escPressed) {
      // Esc closes what is open
      if (this.menu) { this.menu.close(); this.menu = null; this.cHold = -1; } else { this.closePanel(); this.cHold = -1; }
      this.updateHud();
      return;
    }
    // menus and panels pause the world
    if (this.menu) {
      const r = this.menu.update(dt, d);
      if (r !== null) {
        this.menu.close();
        this.menu = null;
        if (r) this.useMenuEntry(r);
        this.cHold = -1; // wait until [C] is let go
      }
      this.updateHud();
      return;
    }
    if (this.panel) {
      // the same key closes its panel again (I bag, C hero page, T skill tree)
      const again = { bag: 'KeyI', char: 'KeyC', tree: 'KeyT' }[this.panelKind];
      if (again && this.keyPressed(again)) { this.closePanel(); this.cHold = -1; this.updateHud(); return; }
      if (this.panel.update(dt, d)) { this.panel = null; this.panelKind = null; this.cHold = -1; }
      this.updateHud();
      return;
    }
    const active = !this.moving && !this.game.switching;
    const inp = active && d ? d : NO_INPUT;
    // [C]: tap or hold
    if (this.cHold < 0) { if (!inp.c) this.cHold = 0; } else if (inp.cPressed && this.hero.state === 'walk') this.cHold = 0.001;
    else if (this.cHold > 0) {
      if (inp.c) {
        this.cHold += dt;
        if (this.cHold >= HOLD_C) { this.cHold = 0; this.menu = new SkillMenu(this); this.game.audio.play('select'); }
      } else { this.cHold = 0; this.tapC(); }
    }
    if (active) this.updateMouse(dt); else this.ctlCancel();
    this.updateHero(dt, inp, active);
    if (this.kind === 'town') {
      this.updateTown(dt);
      this.updateShots(dt);
      this.updateFx(dt);
    } else {
      this.updateDungeon(dt, active);
    }
    this.updateCamera(dt);
    this.updateLamps(dt);
    this.updatePrompt();
    this.updateFloaters(dt);
    this.updateHoverLook();
    this.updateHud();
    this.saveT -= dt;
    if (this.dirty && this.saveT <= 0) this.saveNow();
  }

  updateDungeon(dt, active) {
    this.flowT = (this.flowT || 0) - dt;
    if (active && this.flowT <= 0) { this.flowT = 0.25; this.updateFlow(); }
    this.updateNests(dt, active);
    this.updateGrumbles(dt, active);
    this.updateMods(dt, active);
    this.updateShots(dt);
    this.updateZones(dt);
    this.updateItems(dt, active);
    this.updateDoorsAndChests(dt, active);
    if (this.boss && !this.boss.gone) this.boss.update(dt, active);
    this.hazards.update(dt, active);
    this.updateFx(dt);
    const e = this.hero;
    if (active && e.state === 'walk') {
      if (this.inStairs(e.x, e.z)) this.nextFloor();
      // a locked door says what it needs
      if (!e.hasKey && this.toastCd <= 0 && this.doorNear(e, PR + 0.25)) { this.toastCd = 3; this.game.ui.toast(t('ks.needKey'), 1600); this.game.audio.play('bump'); }
      if (this.portal && this.portalCd <= 0 && Math.hypot(e.x - this.portal.x, e.z - this.portal.z) < 1.0) this.goTown('portal');
    }
    if (this.portal) this.portal.mesh.userData.spin.rotation.z += dt * 3;
    if (this.stairsArrow) {
      this.stairsArrow.visible = !this.fog;
      this.stairsArrow.position.y = 3 + Math.sin(this.time * 3) * 0.3;
      this.stairsArrow.rotation.y += dt * 1.5;
    }
  }

  updateHero(dt, inp, active) {
    const e = this.hero;
    for (const k of ['cdA', 'cdB', 'inv', 'swingT', 'spinT', 'rollT', 'rushT', 'cheerT', 'potCd', 'luckyT', 'hurtT']) e[k] -= dt;
    for (const k in e.cd) e.cd[k] -= dt;
    let moving = 0;
    e.blocking = false;
    const holdBlock = this.updateKit(dt, inp, active);
    if (e.state === 'faint') {
      e.ch.pivot.rotation.x += (-1.35 - e.ch.pivot.rotation.x) * Math.min(1, dt * 6);
    } else if (e.castT > 0) {
      e.castT -= dt;
      e.vx = e.vz = 0;
      if (Math.random() < dt * 20) this.puffs.burst(new THREE.Vector3(e.x + (Math.random() - 0.5), 0.3, e.z + (Math.random() - 0.5)), 0x8fd8ff, { count: 1, size: 0.3, life: 0.6, speed: 0.5, up: 3 });
      if (e.castT <= 0) this.openFloorPortal();
    } else if (e.leap) {
      this.updateLeap(e, dt);
      moving = 1;
    } else if (e.rushT > 0) {
      this.updateRush(e, dt);
      moving = 1;
    } else if (e.rollT > 0) {
      this.moveCircle(e, e.rollX * 15 * dt, e.rollZ * 15 * dt, PR);
      moving = 1;
    } else {
      // the stick / keys walk directly; without them a mouse click goal steers (control.js)
      let mx = inp.x, mz = -inp.y;
      if (Math.hypot(mx, mz) > 0.25) this.ctlCancel();
      else if (active) { const v = this.steer(dt); if (v) { mx = v.x; mz = v.z; } }
      const len = Math.hypot(mx, mz);
      if (len > 1) { mx /= len; mz /= len; }
      if (len > 0.25) { const l = Math.hypot(mx, mz); e.fx = mx / l; e.fz = mz / l; }
      e.blocking = this.cls === 'knight' && (inp.b || holdBlock) && this.kind === 'dungeon';
      if (e.blocking && this.ground && (holdBlock && !inp.b)) { const dx = this.ground.x - e.x, dz = this.ground.z - e.z, d = Math.hypot(dx, dz); if (d > 0.2) { e.fx = dx / d; e.fz = dz / d; } }
      const sp = SPEED * e.st.speed * (e.blocking ? 0.45 : 1) * (this.kind === 'town' ? 1.1 : 1);
      e.vx += (mx * sp - e.vx) * Math.min(1, dt * 14);
      e.vz += (mz * sp - e.vz) * Math.min(1, dt * 14);
      this.moveCircle(e, e.vx * dt, e.vz * dt, PR);
      moving = clamp(Math.hypot(e.vx, e.vz) / SPEED, 0, 1);
      if (active) {
        if (inp.bPressed && this.cls !== 'knight' && this.kind === 'dungeon') this.bMove(e, inp);
        if (this.kind === 'town') { if (inp.aPressed) this.useTown(); }
        else if (inp.a && e.cdA <= 0 && !e.blocking) this.attack(e);
      }
    }
    e.moving = moving;
    this.poseHero(dt);
  }

  poseHero(dt) {
    const e = this.hero, ch = e.ch;
    if (e.state !== 'faint' && Math.abs(e.fx) + Math.abs(e.fz) > 0.01) ch.face(e.fx, e.fz);
    let y = 0;
    if (this.stairs && this.inStairs(e.x, e.z)) {
      const k = clamp(Math.floor((this.stairs.z1 - e.z) / ((this.stairs.z1 - this.stairs.z0) / 4)), 0, 3);
      y = -0.2 * (k + 1);
    }
    e.y += (y - e.y) * Math.min(1, dt * 12);
    ch.group.position.set(e.x, e.y + (e.leapY || 0) + (e.castT > 0 ? 0.25 + Math.sin(this.time * 10) * 0.05 : 0), e.z);
    e.bubble.visible = e.shieldHp > 0;
    if (e.bubble.visible) e.bubble.scale.setScalar(1 + Math.sin(this.time * 5) * 0.04);
    if (e.state !== 'faint') ch.pivot.rotation.x += (0 - ch.pivot.rotation.x) * Math.min(1, dt * 8);
    ch.spin = e.spinT > 0 ? (1 - e.spinT / 0.4) * Math.PI * 2 : e.rollT > 0 ? (1 - e.rollT / 0.3) * Math.PI * 2 : 0;
    e.hand.rotation.y = e.swingT > 0 ? e.swingDir * Math.sin((e.swingT / 0.22) * Math.PI) * 1.3 : 0;
    e.block.visible = e.blocking;
    if (e.offMesh && e.offKind === 'shield') e.offMesh.position.set(e.blocking ? -0.1 : -0.5, 0.45, e.blocking ? 0.55 : 0.15);
    if (e.offMesh && e.offKind === 'orb') e.offMesh.position.y = 0.75 + Math.sin(this.time * 3) * 0.08;
    ch.group.visible = !(e.inv > 0 && e.hurtT > -0.25 && e.state === 'walk' && this.kind === 'dungeon' && Math.floor(this.time * 14) % 2 === 0);
    ch.update(dt, { moving: e.moving || 0 });
    e.ring.position.set(e.x, 0.05 + Math.min(0, e.y), e.z);
    e.aimPivot.position.set(e.x, 0.12 + Math.min(0, e.y), e.z);
    e.aimPivot.rotation.y = Math.atan2(e.fx, e.fz);
    e.aimPivot.visible = e.state === 'walk' && this.kind === 'dungeon' && this.mode === 'dungeon';
    // the bag arrow
    const bag = this.kind === 'dungeon' ? this.items.find((it) => it.kind === 'bag') : null;
    e.arrow.visible = !!bag && Math.hypot(bag.x - e.x, bag.z - e.z) > 5;
    if (e.arrow.visible) {
      e.arrow.position.set(e.x, 0.15, e.z);
      e.arrow.rotation.y = Math.atan2(bag.x - e.x, bag.z - e.z);
      e.arrow.children[0].scale.setScalar(1 + Math.sin(this.time * 6) * 0.12);
    }
  }

  updatePrompt() {
    const e = this.hero;
    let html = '';
    if (e.state === 'walk' && !this.moving) {
      if (this.kind === 'town') html = esc(this.townPrompt());
      else {
        const it = this.gearNear();
        if (it) html = esc(tFor(this.player, 'ks.p.pick'));
        else if (e.castT > 0) html = esc(t('ks.casting'));
      }
    }
    if (html !== e.labelHtml) { e.label.innerHTML = html; e.labelHtml = html; }
    if (!html) { e.label.style.display = 'none'; return; }
    this.game.ui.place(e.label, new THREE.Vector3(e.x, 2.2, e.z), this.camera);
  }

  updateCamera(dt, snap = false) {
    const e = this.hero;
    let cx = e.x, cz = e.z, d = (this.kind === 'town' ? 24 : 20);
    const b = this.boss;
    if (this.kind === 'dungeon' && b?.awake) {
      cx = (e.x * 2 + b.x) / 3; cz = (e.z * 2 + b.z) / 3;
      d = clamp(this.fitDistance(Math.abs(b.x - e.x) + 12, (Math.abs(b.z - e.z) + 9) * Math.sin(TILT)), 20, 30);
    }
    if (this.kind === 'town') { cx = clamp(cx, -7, 7); cz = clamp(cz, -7, 4); }
    d *= this.zoom || 1; // the mouse wheel only zooms out (never closer than the normal view)
    const k = snap ? 1 : Math.min(1, dt * 4);
    this.camCenter.x += (cx - this.camCenter.x) * k;
    this.camCenter.z += (cz - this.camCenter.z) * k;
    this.camDist += (d - this.camDist) * k;
    const c = this.camCenter;
    this.camera.position.set(c.x, Math.sin(TILT) * this.camDist, c.z + Math.cos(TILT) * this.camDist);
    this.camera.lookAt(c.x, 0, c.z - 0.6);
    this.sun.target.position.set(c.x, 0, c.z);
    this.sun.position.copy(this.sun.target.position).add(this.sunDir);
  }

  goalText() {
    const e = this.hero;
    if (this.kind === 'town') return t(this.live ? 'ks.goal.portal' : 'ks.goal.town');
    if (this.items.some((it) => it.kind === 'bag')) return t('ks.goal.bag');
    const closed = this.doors.some((dr) => !dr.open);
    if (closed) return t(e.hasKey ? 'ks.goal.door' : 'ks.goal.key');
    if (this.fog) return t('ks.goal.boss');
    return t('ks.goal.stairs');
  }

  updateHud() {
    if (this.mode === 'pick') { this.game.ui.setTop(''); return; }
    const b = this.boss;
    const goal = this.kind === 'dungeon' && b && b.state !== 'idle' && !b.gone ? this.bossBar() : `<div class="pill">${esc(this.goalText())}</div>`;
    const sub = this.placeSub();
    this.game.ui.setTop(`<div class="pill"><b>${esc(this.placeTitle())}</b>${sub ? ` · ${esc(sub)}` : ''}</div>${goal}`);
    this.hud.update();
  }

  // ---------------------------------------------------------------- saving

  saveNow() {
    this.dirty = false;
    this.saveT = 4;
    saveKeepSolo(this.game.roster, this.data);
  }

  /** Difficulty number in town (shop prices, mystery boxes): the deepest floor reached on this difficulty. */
  townD() {
    return Math.max(0, this.hs.reached) + diffOffset(this.hs.diff);
  }

  /** Test helper: put the hero next to the boss door with a key, or anywhere. */
  debugToBoss() {
    if (this.kind !== 'dungeon' || !this.boss) return false;
    for (const dr of this.doors) dr.open = true;
    this.updateFlow();
    const b = this.boss;
    this.placeHero(b.x, b.z + 7);
    this.pushOut(this.hero, PR);
    this.updateCamera(0, true);
    return true;
  }

  dispose() {
    this.saveNow();
    const cur = this.level;
    for (const w of [this.townWorld, this.live?.world]) if (w && w.level !== cur) this.disposeWorld(w);
    this.hud.dispose();
    this.disposeControl();
    super.dispose();
  }
}

Object.assign(KeepSoloScene.prototype, FoeMixin, WorldMixin, TownMixin, SkillMixin, ControlMixin, HeroMixin, LightMixin, MonsterMixin);
for (const k of BORROW) Object.defineProperty(KeepSoloScene.prototype, k, Object.getOwnPropertyDescriptor(KeepScene.prototype, k));
