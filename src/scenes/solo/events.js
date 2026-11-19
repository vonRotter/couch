import * as THREE from 'three';
import { t, tFor, addStrings } from '../../core/i18n.js';
import { esc } from '../../core/ui.js';
import { say as speak } from '../../core/voice.js';
import { now, hourOf } from './save.js';
import { dayKey, dayIndex, dayRand, rareEventOn, rareWarned, seasonOf, weekIndex } from './calendar.js';
import { heightAt, cliffZ, SEA_Y, PLACES } from './map.js';
import { mesh, box, sph, cyl, cone } from './models.js';
import { makeShip } from '../adventure/props.js';
import { makeCrab } from './models7.js';
import { makeTreasure, makeDigX } from './models9.js';
import { ITEMS } from './items.js';
import { settingsFor, calmOn } from '../../core/assist.js';

// Rare weather events and the seasonal mystery (the "livelier island" round, part 3).
//
// Rare events (calendar.js rareEventOn: once a week, Tuesday to Saturday, never on a day with a festival or a
// daily surprise, so never two days in a row; the kinds take turns):
// - Storm: it stormed in the night; from 6 the beach has three things washed ashore (pick them up) and two
//   stranded crabs to carry back to the water (they stay friends; they never count as the day's crab job).
// - Fog: thick fog all day; from 20 to midnight a ghost ship lies off the west beach and Captain Wisp, a friendly
//   ghost, waits by the water with a story and a gift.
// - Rainbow: rain until 13, then a rainbow until 19 whose end touches the ground somewhere: dig there.
//
// The seasonal mystery, "The old keeper's chest": in each season's week Curator Hoot finds a torn page (the "!"
// over him). It is a map: dig at its X for an old key; the key's tag points to the old door under the north
// cliffs; its lock wants the pictures from the page in order (two or three: Help me play); behind it a chest with
// the season's gift. Each season's chapter comes back at most every eight weeks (S.mystery).

const BEACH_FINDS = [[-2, 41], [23, 41], [14.5, 40.6]];
const STRANDED = [[9, 40.5], [-8, 40.8]];
// the ghost ship lies close to the west beach, side-on, so the usual view shows it from the sand (about 5 m out);
// Captain Wisp waits at the water's edge in front of it
const SHIP = { x: -19.5, z: 46.2, rot: 0 };
const GLOW = 0.17; // the halo's opacity (it breathes a little around this; steady with "Reduce flashing")
const WISP = { x: -17.6, z: 41.2 };
const RAINBOW_ENDS = [{ x: 46, z: 18 }, { x: -16, z: -24 }, { x: 18, z: 8 }, { x: 2, z: -14 }];
const KEY_SPOTS = [{ x: -16, z: -24, near: 'home' }, { x: 46, z: 18, near: 'garage' }, { x: 2, z: -14, near: 'greenhouse' }, { x: 22, z: -30, near: 'cliff' }];
const DOOR = { x: -12, z: cliffZ(-12) + 0.2 };
const SYMBOLS = ['🐟', '⭐', '🌸', '🐚'];
const GIFTS = { spring: [['starfruitSeed', 2], ['bouquet', 1]], summer: [['pearl', 2]], autumn: [['goldenAcorn', 2]], winter: [['cocoa', 2], ['pearl', 1]] };
const SEASON_GAP = 8; // weeks before a season's chapter comes back

addStrings({
  en: {
    'td.ev.storm': 'A storm passed in the night! Things washed up on the beach, and a few stranded crabs need a hand.',
    'td.ev.fog': 'Thick fog today. Keeper Bram says a ghost ship sails in on foggy nights...',
    'td.ev.rainbow': 'Rain this morning, sun this afternoon: watch out for a rainbow!',
    'td.ev.r.storm': 'Grumbleton\'s knee aches. He says a storm is coming tonight.',
    'td.ev.r.fog': 'Keeper Bram says the sea smells of fog. Tomorrow, maybe?',
    'td.ev.r.storm.2': 'The gulls are flying low. Grumbleton says: a storm tonight, mark my words!',
    'td.ev.r.fog.2': 'A grey haze sits far out at sea. Bram thinks fog rolls in tomorrow.',
    'td.ev.r.rainbow': 'Aunt Hazel\'s hens are fussing: rain in the morning, sun after. A rainbow tomorrow?',
    'td.ev.r.rainbow.2': 'Pip\'s weather gadget beeps: showers, then sunshine tomorrow. Rainbow weather!',
    'td.ev.mystery.spring': 'Curator Hoot found a torn page in an old book of spring flowers. A map?',
    'td.ev.mystery.summer': 'A torn page fell out of Hoot\'s old sea book. He is flapping with excitement!',
    'td.ev.mystery.autumn': 'Hoot found a torn page tucked in an old book of harvest songs. Mysterious!',
    'td.ev.mystery.winter': 'Curator Hoot found a torn page in an old book by the fire. He wants to show you.',
    'ev.h.find': '[B]: pick it up', 'ev.h.crab': '[B]: carry the crab back to the water', 'ev.h.wisp': '[B]: talk to the ghost captain',
    'ev.h.dig': '[B]: dig at the end of the rainbow', 'ev.h.digKey': '[B]: dig here', 'ev.h.door': '[B]: try the old door', 'ev.h.chest': '[B]: open the chest',
    'ev.h.doorLocked': 'An old door in the cliff. It is locked.',
    'ev.t.crab': 'Back in the water! The crab waves its claw.',
    'ev.t.find': 'Washed ashore: {item}!',
    'ev.t.rainbow': 'Treasure at the end of the rainbow!',
    'ev.t.key': 'An old key! Its tag says: "The door under the north cliffs."',
    'isl.npc.wisp': 'Captain Wisp',
    'ev.wisp.1': 'Oooh... don\'t be scared, little one. I am only Captain Wisp.',
    'ev.wisp.2': 'My ship sails where the fog goes. Tonight it brought me here.',
    'ev.wisp.3': 'Take this, from my old sea chest. Now I must sail on... ooooh!',
    'ev.wisp.again': 'Ooooh... thank you for visiting again. The fog is calling me.',
    'mys.hoot.1': 'Oh! Look what fell out of an old book: a torn page with a map!',
    'mys.hoot.2': 'An X, and some little pictures. The old keeper hid something, I am sure. Take it!',
    'mys.map.title': 'The torn page',
    'mys.map.text': 'Dig at the X ({where}). The pictures: {code}',
    'mys.where.home': 'on the hill above your cottage', 'mys.where.garage': 'below the mech garage', 'mys.where.greenhouse': 'by the greenhouse', 'mys.where.cliff': 'by the woodpile under the cliffs',
    'mys.task.dig': '🗝️ The torn page: dig at the X {where}', 'mys.task.door': '🗝️ Try the old key in the door under the north cliffs', 'mys.task.chest': '🗝️ Open the chest behind the old door',
    'mys.lock.title': 'The old lock', 'mys.lock.text': '{n} pictures, in the order from the torn page ({code}).', 'mys.n.2': 'Two', 'mys.n.3': 'Three',
    'mys.lock.hint': '[OK]: put in the picture · ◀ ▶: choose · [C]: step back',
    'mys.lock.say': 'The old lock wants {n} pictures, in the order from the torn page.',
    'mys.lock.wrong': 'Clunk. Not quite. Look at the torn page again!',
    'mys.lock.open': 'Click! The old door creaks open.',
    'mys.chest': 'The old keeper\'s chest! Something for {season} inside.',
    'map.a.storm': 'Washed ashore by the storm', 'map.a.ghost': 'The ghost ship', 'map.a.rainbow': 'The rainbow\'s end',
  },
  no: {
    'td.ev.storm': 'En storm dro forbi i natt! Ting har skylt i land på stranda, og noen strandede krabber trenger hjelp.',
    'td.ev.fog': 'Tett tåke i dag. Fyrvokter Bram sier at et spøkelsesskip seiler inn på tåkete netter...',
    'td.ev.rainbow': 'Regn i formiddag, sol i ettermiddag: se etter en regnbue!',
    'td.ev.r.storm': 'Grumbleton har vondt i kneet. Han sier at det kommer en storm i natt.',
    'td.ev.r.fog': 'Fyrvokter Bram sier at havet lukter tåke. I morgen, kanskje?',
    'td.ev.r.storm.2': 'Måkene flyr lavt. Grumbleton sier: storm i natt, bare vent!',
    'td.ev.r.fog.2': 'Et grått dis ligger langt ute på havet. Bram tror tåka kommer i morgen.',
    'td.ev.r.rainbow': 'Hønene til tante Hassel er urolige: regn om morgenen, sol etterpå. Regnbue i morgen?',
    'td.ev.r.rainbow.2': 'Værdingsen til Pip piper: byger, så sol i morgen. Regnbuevær!',
    'td.ev.mystery.spring': 'Kurator Hu fant en revet side i en gammel bok om vårblomster. Et kart?',
    'td.ev.mystery.summer': 'En revet side falt ut av den gamle sjøboka til Hu. Han flakser av spenning!',
    'td.ev.mystery.autumn': 'Hu fant en revet side i en gammel bok med høstsanger. Mystisk!',
    'td.ev.mystery.winter': 'Kurator Hu fant en revet side i en gammel bok ved peisen. Han vil vise deg den.',
    'ev.h.find': '[B]: plukk opp', 'ev.h.crab': '[B]: bær krabben tilbake til vannet', 'ev.h.wisp': '[B]: snakk med spøkelseskapteinen',
    'ev.h.dig': '[B]: grav ved enden av regnbuen', 'ev.h.digKey': '[B]: grav her', 'ev.h.door': '[B]: prøv den gamle døra', 'ev.h.chest': '[B]: åpne kista',
    'ev.h.doorLocked': 'En gammel dør i fjellet. Den er låst.',
    'ev.t.crab': 'Tilbake i vannet! Krabben vinker med klørne.',
    'ev.t.find': 'Skylt i land: {item}!',
    'ev.t.rainbow': 'Skatt ved enden av regnbuen!',
    'ev.t.key': 'En gammel nøkkel! Lappen sier: «Døra under nordklippene.»',
    'isl.npc.wisp': 'Kaptein Dis',
    'ev.wisp.1': 'Uuuh... ikke vær redd, lille venn. Jeg er bare kaptein Dis.',
    'ev.wisp.2': 'Skipet mitt seiler dit tåka går. I natt førte den meg hit.',
    'ev.wisp.3': 'Ta denne, fra den gamle sjøkista mi. Nå må jeg seile videre... uuuh!',
    'ev.wisp.again': 'Uuuh... takk for at du besøker meg igjen. Tåka kaller på meg.',
    'mys.hoot.1': 'Å! Se hva som falt ut av en gammel bok: en revet side med et kart!',
    'mys.hoot.2': 'Et kryss, og noen små bilder. Den gamle fyrvokteren gjemte noe, det er jeg sikker på. Ta den!',
    'mys.map.title': 'Den revne siden',
    'mys.map.text': 'Grav ved krysset ({where}). Bildene: {code}',
    'mys.where.home': 'på bakken over huset ditt', 'mys.where.garage': 'nedenfor robotverkstedet', 'mys.where.greenhouse': 'ved drivhuset', 'mys.where.cliff': 'ved vedstabelen under klippene',
    'mys.task.dig': '🗝️ Den revne siden: grav ved krysset {where}', 'mys.task.door': '🗝️ Prøv den gamle nøkkelen i døra under nordklippene', 'mys.task.chest': '🗝️ Åpne kista bak den gamle døra',
    'mys.lock.title': 'Den gamle låsen', 'mys.lock.text': '{n} bilder, i rekkefølgen fra den revne siden ({code}).', 'mys.n.2': 'To', 'mys.n.3': 'Tre',
    'mys.lock.hint': '[OK]: sett inn bildet · ◀ ▶: velg · [C]: gå tilbake',
    'mys.lock.say': 'Den gamle låsen vil ha {n} bilder, i rekkefølgen fra den revne siden.',
    'mys.lock.wrong': 'Klonk. Ikke helt. Se på den revne siden igjen!',
    'mys.lock.open': 'Klikk! Den gamle døra knirker opp.',
    'mys.chest': 'Kista til den gamle fyrvokteren! Noe for {season} ligger oppi.',
    'map.a.storm': 'Skylt i land av stormen', 'map.a.ghost': 'Spøkelsesskipet', 'map.a.rainbow': 'Enden av regnbuen',
  },
});

// The ghost ship and Captain Wisp glow softly (safety round: they used to be half see-through and faded into the
// fog at night): solid pale colours that light themselves (emissive) and shine through the fog, with the soft halo
// around the ship. opacity < 1 keeps a hint of the ghost (still solid enough to read).
const ghostMat = (c, opacity = 1) => new THREE.MeshToonMaterial({ color: new THREE.Color(c).lerp(new THREE.Color(0xe6fff4), 0.35), emissive: new THREE.Color(c).lerp(new THREE.Color(0x58d6b0), 0.7), emissiveIntensity: 0.55, fog: false, transparent: opacity < 1, opacity, depthWrite: true });

export class IslandEvents {
  constructor(host) {
    this.host = host;
    this.group = new THREE.Group();
    host.scene.add(this.group);
    this.kind = null;
    this.today = '';
    this.t = 0;
    // storm finds and stranded crabs
    this.finds = BEACH_FINDS.map(([x, z], i) => { const q = host.map.findSpot(x, z, 0.5); const g = makeTreasure(0x8a7a5a); g.scale.setScalar(0.55); g.rotation.y = i * 1.3; g.position.set(q.x, Math.max(heightAt(q.x, q.z), SEA_Y) + 0.02, q.z); g.visible = false; this.group.add(g); return { g, x: q.x, z: q.z, i }; });
    this.crabs = STRANDED.map(([x, z], i) => { const g = makeCrab(i ? 'blue' : 'red'); g.position.set(x, Math.max(heightAt(x, z), SEA_Y) + 0.02, z); g.rotation.y = i * 2; g.visible = false; this.group.add(g); return { g, x, z, i, go: 0 }; });
    // the ghost ship and Captain Wisp
    this.ship = makeShip();
    this.ship.traverse((m) => { if (m.isMesh) { const c = !Array.isArray(m.material) && m.material?.color ? m.material.color.getHex() : 0xcfe8ff; m.material = ghostMat(new THREE.Color(c).lerp(new THREE.Color(0xbfe8ff), 0.6).getHex()); m.castShadow = false; } });
    this.ship.scale.setScalar(1.2);
    this.ship.position.set(SHIP.x, SEA_Y - 0.1, SHIP.z);
    this.ship.rotation.y = SHIP.rot;
    this.wisp = makeWisp();
    this.wisp.position.set(WISP.x, heightAt(WISP.x, WISP.z) + 0.1, WISP.z);
    // a soft glow around it, seen from far away at night and through the fog (it breathes slowly; steady with
    // "Reduce flashing")
    this.glow = new THREE.Mesh(new THREE.SphereGeometry(3.4, 20, 14), new THREE.MeshBasicMaterial({ color: 0x9fffe0, transparent: true, opacity: GLOW, depthWrite: false, fog: false }));
    this.glow.scale.set(1.35, 0.7, 0.55);
    this.glow.position.set(SHIP.x, 1.6, SHIP.z);
    this.lanterns = [-2.2, 0.4, 2.6].map((x, i) => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), new THREE.MeshBasicMaterial({ color: 0xb8ffd8, fog: false })); m.position.set(SHIP.x + x, 2.2 + (i % 2) * 1.2, SHIP.z); return m; });
    this.ship.visible = this.wisp.visible = this.glow.visible = false;
    this.group.add(this.ship, this.wisp, this.glow, ...this.lanterns);
    for (const l of this.lanterns) l.visible = false;
    // the rainbow and its end
    this.rainbow = makeRainbow();
    this.rainbow.visible = false;
    this.group.add(this.rainbow);
    this.dig = makeDigX();
    this.dig.visible = false;
    this.group.add(this.dig);
    // the mystery: a mound for the key, the old door, the chest behind it
    this.mound = makeDigX();
    this.mound.visible = false;
    this.group.add(this.mound);
    this.door = makeDoor();
    this.door.position.set(DOOR.x, heightAt(DOOR.x, DOOR.z + 1.2), DOOR.z);
    this.group.add(this.door);
    host.map.boxObs(DOOR.x, DOOR.z, 0.9, 0.3);
    this.chest = makeTreasure(0x8a5a32);
    this.chest.scale.setScalar(0.8);
    this.chest.position.set(DOOR.x, heightAt(DOOR.x, DOOR.z + 1.2) + 0.02, DOOR.z + 0.6);
    this.chest.visible = false;
    this.group.add(this.chest);
    this.fogK = 0;
  }

  get S() { return this.host.save; }

  /** Today's event state (a new day starts fresh). */
  day() {
    const S = this.S, day = dayKey();
    if (!S.events || S.events.day !== day) S.events = { day, finds: [], crabs: [], dug: false, wisp: false };
    return S.events;
  }

  /** The mystery's state (old saves have none). */
  get M() {
    const S = this.S;
    if (!S.mystery || typeof S.mystery !== 'object') S.mystery = { week: null, step: 0, done: {} };
    S.mystery.done ||= {};
    return S.mystery;
  }

  newDay() {}

  tick(at) {
    const today = dayKey(at);
    if (today !== this.today) {
      this.today = today;
      this.kind = rareEventOn(at);
      this.digAt = this.host.map.findSpot(...Object.values(RAINBOW_ENDS[Math.floor(dayRand(`rbend:${today}`) * RAINBOW_ENDS.length)]), 0.6);
    }
    const D = this.day(), h = this.host.forceHour ?? hourOf(at), away = !!this.host.isle2?.here();
    const storm = this.kind === 'storm' && h >= 6 && !away;
    this.finds.forEach((f) => { f.g.visible = storm && !D.finds.includes(f.i); });
    this.crabs.forEach((c) => { if (!c.go) c.g.visible = storm && !D.crabs.includes(c.i); });
    const ghost = this.kind === 'fog' && h >= 20 && !away;
    this.ship.visible = this.wisp.visible = this.glow.visible = ghost;
    for (const l of this.lanterns) l.visible = ghost;
    const rb = this.kind === 'rainbow' && h >= 13 && h < 19 && !away;
    this.rainbow.visible = rb;
    this.dig.visible = rb && !D.dug;
    if (rb) {
      const e = this.digAt;
      this.dig.position.set(e.x, heightAt(e.x, e.z) + 0.02, e.z);
      // the arc stands up from the dig spot toward the sea
      this.rainbow.position.set(e.x - 26, heightAt(e.x, e.z) - 0.6, e.z);
    }
    this.tickMystery(at);
  }

  // ---------- the Today board, the map ----------

  todayNews(at) {
    const out = [], k = rareEventOn(at), day = dayKey(at);
    if (k === 'storm') out.push({ kind: 'changed', pri: 9, icon: '🌊', keys: ['td.ev.storm'], x: 14, z: 40.5 });
    if (k === 'fog') out.push({ kind: 'visitor', pri: 9, icon: '👻', keys: ['td.ev.fog'], x: WISP.x, z: WISP.z });
    if (k === 'rainbow') out.push({ kind: 'rumor', pri: 9, icon: '🌈', keys: ['td.ev.rainbow'] });
    const tk = rareEventOn(at + 86400000);
    // a warning the day before (then it can be saved for later: lock.js)
    if (tk && rareWarned(at + 86400000)) out.push({ kind: 'rumor', pri: 8.5, icon: { storm: '⛈️', fog: '🌫️', rainbow: '🌦️' }[tk], keys: [`td.ev.r.${tk}`, `td.ev.r.${tk}.2`] });
    const M = this.M;
    if (this.chapterOpen(at) && M.step === 0 && M.toldW !== weekIndex(at) && this.S.intro) { M.toldW = weekIndex(at); out.push({ kind: 'rumor', pri: 4.5, icon: '📜', keys: [`td.ev.mystery.${seasonOf(at)}`] }); }
    void day;
    return out;
  }

  mapItems() {
    const out = [];
    if (this.finds.some((f) => f.g.visible)) out.push({ key: 'ev:storm', icon: '🌊', name: t('map.a.storm'), x: 14, z: 40.5, r: 6 });
    if (this.wisp.visible) out.push({ key: 'ev:ghost', icon: '👻', name: t('map.a.ghost'), x: WISP.x, z: WISP.z });
    if (this.dig.visible) out.push({ key: 'ev:rainbow', icon: '🌈', name: t('map.a.rainbow'), x: this.digAt.x, z: this.digAt.z });
    return out;
  }

  // ---------- [B] ----------

  interactions(P, out, nm) {
    const near = (x, z, r) => Math.hypot(P.x - x, P.z - z) < r;
    for (const f of this.finds) if (f.g.visible && near(f.x, f.z, 1.3)) { out.b = { text: nm('ev.h.find'), fn: () => this.pickFind(f) }; return true; }
    for (const c of this.crabs) if (c.g.visible && !c.go && near(c.x, c.z, 1.3)) { out.b = { text: nm('ev.h.crab'), fn: () => this.carryCrab(c) }; return true; }
    if (this.wisp.visible && near(WISP.x, WISP.z, 2.2)) { out.b = { text: nm('ev.h.wisp'), fn: () => this.talkWisp() }; return true; }
    if (this.dig.visible && near(this.digAt.x, this.digAt.z, 1.4)) { out.b = { text: nm('ev.h.dig'), fn: () => this.digRainbow() }; return true; }
    const M = this.M;
    if (this.mound.visible && near(this.keyAt.x, this.keyAt.z, 1.4)) { out.b = { text: nm('ev.h.digKey'), fn: () => this.digKey() }; return true; }
    if (near(DOOR.x, DOOR.z + 1.2, 1.7)) {
      if (M.step === 3 && this.chest.visible) out.b = { text: nm('ev.h.chest'), fn: () => this.openChest() };
      else if (M.step === 2) out.b = { text: nm('ev.h.door'), fn: () => this.openLock() };
      else if (M.step < 3) out.b = { text: t('ev.h.doorLocked'), fn: () => this.host.game.audio.play('bump') };
      if (out.b) return true;
    }
    return false;
  }

  pickFind(f) {
    const host = this.host, D = this.day();
    D.finds.push(f.i);
    f.g.visible = false;
    const r = dayRand(`stormfind:${this.today}:${f.i}`);
    const item = [['oldcoin', 1], ['seaGlass', 1], ['wood', 3], ['pearl', 1], ['starfish', 1]][Math.floor(r * 5)];
    host.puffs.burst(new THREE.Vector3(f.x, 0.4, f.z), 0xc9a06a, { count: 10, speed: 2.5, size: 0.3, life: 0.6 });
    host.game.audio.play('star');
    host.giveItems([item], true);
    host.game.ui.toast(t('ev.t.find', { item: t(ITEMS[item[0]] ? `isl.i.${item[0]}` : `isl.d.${item[0]}`) }), 2200);
    host.markDirty();
  }

  carryCrab(c) {
    const host = this.host, D = this.day();
    D.crabs.push(c.i);
    c.go = 1.6; // it scuttles off toward the water
    host.game.audio.play('rescue');
    host.game.ui.toast(t('ev.t.crab'), 2200);
    host.confetti.burst(new THREE.Vector3(c.x, 1.0, c.z), 0, { count: 14, speed: 3, up: 3, life: 0.9, gravity: -5, colors: [0xff5d73, 0xffffff, 0x9fe4ff] });
    host.markDirty();
  }

  talkWisp() {
    const host = this.host, D = this.day();
    const L = (key) => ({ key, speaker: 'isl.wisp', css: '#7fb8d8', name: t('isl.npc.wisp') });
    if (D.wisp) { host.say([L('ev.wisp.again')]); return; }
    D.wisp = true;
    host.camView = { pos: new THREE.Vector3(WISP.x + 3.5, 4.2, WISP.z - 4.5), look: new THREE.Vector3(SHIP.x, 1.6, SHIP.z), fov: 50 };
    host.say([L('ev.wisp.1'), L('ev.wisp.2'), L('ev.wisp.3')], () => {
      host.camView = null;
      host.grant({ coins: 40, items: [['pearl', 1]] });
      this.wispFade = 1.5;
    });
    host.markDirty();
  }

  digRainbow() {
    const host = this.host, D = this.day(), e = this.digAt;
    D.dug = true;
    this.dig.visible = false;
    host.puffs.burst(new THREE.Vector3(e.x, heightAt(e.x, e.z) + 0.4, e.z), 0xc9a06a, { count: 16, speed: 3.5, size: 0.35, life: 0.7 });
    host.confetti.burst(new THREE.Vector3(e.x, heightAt(e.x, e.z) + 1, e.z), 0, { count: 50, speed: 5, up: 5, life: 1.4, gravity: -6, colors: [0xff5d73, 0xff9f40, 0xffd23f, 0x3ddc97, 0x4cc9f0, 0x9b5de5] });
    host.game.audio.play('fanfare');
    host.game.ui.toast(t('ev.t.rainbow'), 2400);
    host.grant({ coins: 70, items: [['goldenAcorn', 1], ['starfruitSeed', 1]] });
    host.markDirty();
  }

  // ---------- the seasonal mystery ----------

  /**
   * How many pictures the lock wants (this profile's Help me play): two with forgiving timing on (or a "skips"
   * setting, should Help me play get one: there is none yet), else three.
   */
  lockLen() {
    const p = this.host.player?.p;
    const s = p ? settingsFor(p) : null;
    return s?.timing || s?.skips === true ? 2 : 3;
  }

  /** The pictures on this week's page, in order. */
  get code() { return (this.code3 || []).slice(0, this.lockLen()); }

  /** Is this week's chapter open (a season whose chapter was not done in the last eight weeks)? */
  chapterOpen(at = now()) {
    const M = this.M, w = weekIndex(at), s = seasonOf(at);
    if (M.week === w) return M.step < 4;
    return M.done[s] === undefined || w - M.done[s] >= SEASON_GAP;
  }

  tickMystery(at) {
    const M = this.M, w = weekIndex(at);
    if (M.week !== w && M.week !== null && M.step > 0) { M.week = null; M.step = 0; } // a week ends: a half-done chapter is gone
    if (M.week === w || M.week === null) {
      const k = Math.floor(dayRand(`mkey:${w}`) * KEY_SPOTS.length);
      if (!this.keyAt || this.keyW !== w) { this.keyW = w; this.keyAt = { ...this.host.map.findSpot(KEY_SPOTS[k].x, KEY_SPOTS[k].z, 0.5), near: KEY_SPOTS[k].near }; }
      this.code3 = [0, 1, 2].map((i) => SYMBOLS[Math.floor(dayRand(`mcode:${w}:${i}`) * SYMBOLS.length)]);
    }
    this.mound.visible = M.week === w && M.step === 1 && !this.host.isle2?.here();
    if (this.mound.visible) this.mound.position.set(this.keyAt.x, heightAt(this.keyAt.x, this.keyAt.z) + 0.02, this.keyAt.z);
    const open = M.week === w && M.step >= 3;
    this.door.userData.leaf.rotation.y = open ? -1.6 : 0;
    this.chest.visible = M.week === w && M.step === 3;
  }

  /** Curator Hoot has the torn page this week (his "!"). */
  hasNews(id) {
    return id === 'hoot' && !!this.S.intro && this.M.step === 0 && this.chapterOpen() && !this.host.isle2?.here();
  }

  /** Talking to Hoot: he gives the torn page. True: handled. */
  talk(n, done) {
    if (!this.hasNews(n.id)) return false;
    const M = this.M;
    M.week = weekIndex();
    M.step = 1;
    this.tickMystery(now());
    this.host.say([{ who: 'hoot', key: 'mys.hoot.1', fx: () => { n.hop = 1; } }, { who: 'hoot', key: 'mys.hoot.2' }], () => { done(); this.showPage(); });
    this.host.markDirty();
    return true;
  }

  /** The torn page: the island with an X and the three pictures (a panel, read aloud). */
  showPage() {
    const host = this.host, K = this.keyAt;
    const sx = (x) => ((x + 62) / 124) * 300, sz = (z) => ((z + 48) / 96) * 200;
    const svg = `<svg viewBox="0 0 300 200" style="width:100%;max-height:46vh;background:#efd9a8;border-radius:14px">
      <path d="M0 0 L300 0 L300 170 L270 188 L240 172 L200 196 L160 176 L120 194 L80 174 L40 192 L0 176 Z" fill="#f6e6bf" stroke="#c99a5e" stroke-width="3"/>
      <ellipse cx="150" cy="100" rx="138" ry="88" fill="none" stroke="#a87a4a" stroke-width="3" stroke-dasharray="6 5"/>
      <text x="${sx(-12)}" y="${sz(-14)}" font-size="13" text-anchor="middle">🏠</text><text x="${sx(12)}" y="${sz(-4)}" font-size="13" text-anchor="middle">⛲</text><text x="${sx(44)}" y="${sz(27)}" font-size="13" text-anchor="middle">🗼</text>
      <path d="M${sx(K.x) - 9} ${sz(K.z) - 9} L${sx(K.x) + 9} ${sz(K.z) + 9} M${sx(K.x) + 9} ${sz(K.z) - 9} L${sx(K.x) - 9} ${sz(K.z) + 9}" stroke="#d9583a" stroke-width="5" stroke-linecap="round"/>
      <text x="150" y="${sz(36)}" font-size="26" text-anchor="middle">${this.code.join(' ')}</text></svg>`;
    const text = t('mys.map.text', { where: t(`mys.where.${K.near}`), code: this.code.join(' ') });
    host.mode = 'mystery';
    this.panel = { kind: 'page', t: 0 };
    host.hud.setPanel(`<h2>${esc(t('mys.map.title'))}</h2>${svg}<div class="isl-letter" style="margin-top:8px">${esc(text)}</div><div class="isl-foot">${esc(tFor(host.player?.p, 'isl.ok'))}</div>`);
    speak(t('mys.map.text', { where: t(`mys.where.${K.near}`), code: '' }), 'narrator');
  }

  digKey() {
    const host = this.host, M = this.M, K = this.keyAt;
    M.step = 2;
    this.mound.visible = false;
    host.puffs.burst(new THREE.Vector3(K.x, heightAt(K.x, K.z) + 0.4, K.z), 0xc9a06a, { count: 16, speed: 3.5, size: 0.35, life: 0.7 });
    host.game.audio.play('star');
    host.game.ui.toast(t('ev.t.key'), 3400);
    host.markDirty();
  }

  /** The lock: put in three pictures in the page's order (◀ ▶ choose, [OK] puts one in, [C] steps back). */
  openLock() {
    this.host.mode = 'mystery';
    this.panel = { kind: 'lock', t: 0, pick: 0, got: [] };
    this.renderLock();
    speak(t('mys.lock.say', { n: t(`mys.n.${this.code.length}`).toLowerCase() }), 'narrator');
  }

  renderLock() {
    const host = this.host, L = this.panel;
    const slots = this.code.map((_, i) => `<span style="display:inline-block;width:2.2em;height:2.2em;line-height:2.2em;margin:4px;border-radius:12px;background:#5a3a24;font-size:1.6em">${L.got[i] || ''}</span>`).join('');
    const opts = SYMBOLS.map((s, i) => `<span style="display:inline-block;padding:4px 12px;margin:4px;border-radius:12px;font-size:1.8em;${i === L.pick ? 'background:#ffd84a;box-shadow:0 3px 0 rgba(43,35,64,.2)' : 'background:rgba(138,90,50,.13)'}">${s}</span>`).join('');
    host.hud.setPanel(`<h2>${esc(t('mys.lock.title'))}</h2><div style="text-align:center">${slots}</div><div style="text-align:center;margin:8px 0">${opts}</div>
      <div class="isl-letter">${esc(t('mys.lock.text', { n: t(`mys.n.${this.code.length}`), code: L.wrong ? this.code.join(' ') : '…' }))}</div><div class="isl-foot">${esc(tFor(host.player?.p, 'mys.lock.hint'))}</div>`);
  }

  /** The mystery's panels (island.js mode 'mystery'): inp is the panel input ([OK] as aPressed, [C] as bPressed). */
  updatePanel(inp, dt) {
    const host = this.host, L = this.panel;
    if (!L) { host.mode = 'walk'; host.hud.setPanel(null); return; }
    L.t += dt;
    if (L.kind === 'page') {
      if (L.t > 0.4 && (inp.aPressed || inp.bPressed)) { host.hud.setPanel(null); host.mode = 'walk'; this.panel = null; }
      return;
    }
    if (inp.stepX) { L.pick = (L.pick + inp.stepX + SYMBOLS.length) % SYMBOLS.length; host.game.audio.play('select'); this.renderLock(); }
    if (L.t < 0.3) return;
    if (inp.bPressed) {
      if (L.got.length) { L.got.pop(); this.renderLock(); return; }
      host.hud.setPanel(null); host.mode = 'walk'; this.panel = null; return;
    }
    if (!inp.aPressed) return;
    L.got.push(SYMBOLS[L.pick]);
    host.game.audio.play('pop');
    if (L.got.length < this.code.length) { this.renderLock(); return; }
    if (L.got.join() === this.code.join()) {
      this.M.step = 3;
      host.hud.setPanel(null); host.mode = 'walk'; this.panel = null;
      host.game.audio.play('fanfare');
      host.game.ui.toast(t('mys.lock.open'), 2600);
      this.tickMystery(now());
      host.markDirty();
    } else {
      L.got = []; L.wrong = true;
      host.game.audio.play('bump');
      host.game.ui.toast(t('mys.lock.wrong'), 2400);
      this.renderLock();
    }
  }

  openChest() {
    const host = this.host, M = this.M, s = seasonOf();
    M.step = 4;
    M.done[s] = weekIndex();
    M.n = (M.n || 0) + 1;
    this.chest.visible = false;
    const pos = this.chest.position.clone().add(new THREE.Vector3(0, 0.8, 0));
    host.confetti.burst(pos, 0, { count: 50, speed: 5, up: 5, life: 1.4, gravity: -6, colors: [0xffd23f, 0xffffff, 0xff9fc0, 0x9ff0ff] });
    host.game.audio.play('fanfare');
    host.game.ui.toast(t('mys.chest', { season: t(`isl.season.${s}`) }), 3000);
    host.grant({ coins: 80, items: GIFTS[s] });
    host.markDirty();
  }

  tasks() {
    const M = this.M, w = weekIndex();
    if (M.week !== w) return [];
    if (M.step === 1) return [t('mys.task.dig', { where: t(`mys.where.${this.keyAt?.near || 'home'}`) })];
    if (M.step === 2) return [t('mys.task.door')];
    if (M.step === 3) return [t('mys.task.chest')];
    return [];
  }

  // ---------- every frame ----------

  update(dt) {
    this.t += dt;
    const host = this.host;
    // fog: the view closes in (indoors and on Shell Isle it is clear)
    const want = this.kind === 'fog' && !host.indoors && !host.isle2?.here() && !host.odd?.wizard?.sunny ? 1 : 0; // (the sun spell lifts it for an hour: wizard.js)
    this.fogK += (want - this.fogK) * Math.min(1, dt * 1.5);
    const f = host.scene.fog;
    if (f) { f.near = 60 - this.fogK * 50; f.far = 150 - this.fogK * 105; }
    for (const c of this.crabs) {
      if (!c.go) { if (c.g.visible) c.g.rotation.y = c.i * 2 + Math.sin(this.t * 2 + c.i) * 0.3; continue; }
      c.go -= dt;
      c.z += dt * 2.2;
      c.g.position.set(c.x, Math.max(heightAt(c.x, c.z), SEA_Y) + 0.02, c.z);
      if (c.go <= 0) { c.go = 0; c.g.visible = false; }
    }
    if (this.wisp.visible) {
      this.wisp.position.y = heightAt(WISP.x, WISP.z) + 0.25 + Math.sin(this.t * 1.6) * 0.12;
      const P = host.player;
      if (P) this.wisp.rotation.y = Math.atan2(P.x - WISP.x, P.z - WISP.z);
      this.ship.position.y = SEA_Y - 0.1 + Math.sin(this.t * 0.8) * 0.08;
      this.glow.material.opacity = calmOn() ? GLOW : GLOW + Math.sin(this.t * 0.7) * 0.03; // a slow breath (0.1 Hz), never a flash
    }
    if (this.dig.visible) this.dig.rotation.y += dt * 0.5;
    if (this.mound.visible) this.mound.rotation.y += dt * 0.5;
  }
}

function makeWisp() {
  const g = new THREE.Group();
  const body = mesh(sph(0.45, 14, 10), ghostMat(0xeaf6ff, 0.9), 0, 0.7, 0, false);
  body.scale.set(1, 1.25, 1);
  const tail = mesh(cone(0.42, 0.6, 12), ghostMat(0xeaf6ff, 0.9), 0, 0.15, 0, false);
  tail.rotation.x = Math.PI;
  g.add(body, tail);
  g.add(mesh(sph(0.07, 8, 6), 0x2b2340, -0.15, 0.85, 0.38, false), mesh(sph(0.07, 8, 6), 0x2b2340, 0.15, 0.85, 0.38, false));
  g.add(mesh(cyl(0.34, 0.38, 0.12, 14), 0x2b3b5a, 0, 1.25, 0, false), mesh(box(0.5, 0.18, 0.5), 0x2b3b5a, 0, 1.36, 0, false));
  const lamp = mesh(sph(0.12, 8, 6), new THREE.MeshBasicMaterial({ color: 0x9fffc8 }), 0.5, 0.6, 0.1, false);
  g.add(lamp);
  return g;
}

function makeRainbow() {
  const g = new THREE.Group();
  const cols = [0xff5d73, 0xff9f40, 0xffd23f, 0x3ddc97, 0x4cc9f0, 0x9b5de5];
  cols.forEach((c, i) => {
    const m = new THREE.Mesh(new THREE.TorusGeometry(26 - i * 0.9, 0.45, 6, 48, Math.PI), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.55, depthWrite: false, fog: false }));
    g.add(m);
  });
  return g;
}

function makeDoor() {
  const g = new THREE.Group();
  g.add(mesh(box(2.0, 2.4, 0.4), 0x8a8494, 0, 1.2, -0.15)); // the stone frame
  g.add(mesh(box(1.4, 1.9, 0.1), 0x241a14, 0, 0.95, 0.06, false)); // the dark inside
  const leaf = new THREE.Group();
  leaf.position.set(-0.68, 0, 0.12);
  leaf.add(mesh(box(1.36, 1.9, 0.1), 0x7a4a2e, 0.68, 0.95, 0));
  for (const y of [0.5, 1.4]) leaf.add(mesh(box(1.38, 0.1, 0.12), 0x4a4a5a, 0.68, y, 0.01, false));
  leaf.add(mesh(sph(0.07, 6, 4), 0xffd23f, 1.2, 0.95, 0.08, false));
  g.add(leaf);
  g.userData.leaf = leaf;
  return g;
}
