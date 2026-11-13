import * as THREE from 'three';
import { t, tFor, addStrings } from '../../core/i18n.js';
import { say as speak } from '../../core/voice.js';
import { toon, COLORS } from '../../core/palette.js';
import { mesh, box, cyl, sph, WOOD, WOOD_DARK } from './models.js';
import { SHELF } from './build.js';

// The trophy shelf in the cottage (playtest round 3). Game trophies and the prizes games send by mail used to
// stand in a "trophy garden" in the yard, right where the greenhouse was built later, and looked messy. Now
// every trophy goes on a tall display shelf against the cottage's back wall (no longer a yard piece): walk up
// to it and press [B] for a close-up of each trophy with its name and where it came from (read aloud as
// help), browsed with the stick or the D-pad. Trophies you have not won yet wait as a "?" on their spot, with
// how to win them. Old saves: trophies in the yard or in storage move onto the shelf (Builder.shelfMigrate),
// with a letter from Aunt Hazel when some stood in the yard.

/** Every trophy, in shelf order (four to a row, top row first). legacy: never handed out any more (shown if owned). */
export const TROPHIES = [
  'lhLamp', 'lhTrophy', 'kite', 'hopTrophy',
  'duckTrophy', 'duckGold', 'banner', 'statue',
  'bugPlush', 'mechStatue', 'pillowFort', 'featherTrophy',
  'fishTrophy', 'derbyTrophy', 'coopPennants', 'coopTrophy',
  'castleTrophy', 'guidesTrophy',
];
const LEGACY = new Set(['castleTrophy', 'guidesTrophy']);
const TROPHY_SET = new Set(TROPHIES);
export const isTrophy = (id) => TROPHY_SET.has(id);
const COLS = 4;
const ROW_Y = [2.06, 1.56, 1.06, 0.56, 0.1]; // the tops of the five boards (top row first)
const SLOT_W = 0.4;

addStrings({
  en: {
    'shelf.name': 'Trophy shelf',
    'shelf.h.look': '[B] look at your trophies',
    'shelf.keys': 'Stick or D-pad: next trophy · [OK]: read it again · [C]: back',
    'shelf.none': 'No trophies yet. Play the games on the island: their prizes come here by mail.',
    'shelf.count': 'Trophy {n} of {m}',
    'shelf.notYet': 'Not won yet',
    'shelf.still': 'Still to win: {how}',
    'shelf.t.new': 'New trophy on your shelf: {item}',
    'isl.mail.shelfMoved': 'Dear {name}, I made you a trophy shelf! All your game trophies and prizes stand on it now, inside your cottage by the back wall, so the yard by the greenhouse is tidy again. Walk up to the shelf and press [B] to look at each one up close. New trophies will go straight onto it.',
    'isl.d.guidesTrophy': 'Grumble Guides trophy',
    'shelf.from.lhLamp': 'Lighthouse Caves, for finding your first crystal.',
    'shelf.from.lhTrophy': 'Lighthouse Caves, for finishing the whole adventure!',
    'shelf.from.kite': 'Sky Hop, for clearing your first level.',
    'shelf.from.hopTrophy': 'Sky Hop, for clearing every level!',
    'shelf.from.duckTrophy': 'Laser Ducks, for your first score.',
    'shelf.from.duckGold': 'Laser Ducks, for reaching round 5.',
    'shelf.from.banner': 'Knights & Builders, for winning a castle battle in the campaign.',
    'shelf.from.statue': 'Grumble Guides, for earning 3 stars.',
    'shelf.from.bugPlush': 'Bean Brigade, for keeping Clover Isle safe.',
    'shelf.from.mechStatue': 'Bean Brigade, for finishing the whole campaign!',
    'shelf.from.pillowFort': 'Pillow Keep Solo, for putting Big Teddy to sleep.',
    'shelf.from.featherTrophy': 'Pillow Keep Solo, for putting the Sleepy Sheep to sleep!',
    'shelf.from.fishTrophy': 'The fishing tournament, for beating Grumbleton.',
    'shelf.from.derbyTrophy': 'The Fishing Derby, for catching 5 fish in one day.',
    'shelf.from.coopPennants': 'Playing together on the Party Island, for 3 badges.',
    'shelf.from.coopTrophy': 'Playing together on the Party Island, for 10 badges!',
    'shelf.from.castleTrophy': 'Knights & Builders, for the Golden Bean.',
    'shelf.from.guidesTrophy': 'Grumble Guides, a prize from Mumble.',
  },
  no: {
    'shelf.name': 'Trofehylle',
    'shelf.h.look': '[B] se på trofeene dine',
    'shelf.keys': 'Pinne eller D-pad: neste trofé · [OK]: les igjen · [C]: tilbake',
    'shelf.none': 'Ingen trofeer ennå. Spill spillene på øya: premiene kommer hit i posten.',
    'shelf.count': 'Trofé {n} av {m}',
    'shelf.notYet': 'Ikke vunnet ennå',
    'shelf.still': 'Ikke vunnet ennå: {how}',
    'shelf.t.new': 'Nytt trofé i hylla di: {item}',
    'isl.mail.shelfMoved': 'Kjære {name}, jeg har laget en trofehylle til deg! Alle trofeene og premiene fra spillene står i den nå, inne i hytta di ved bakveggen, så hagen ved drivhuset er ryddig igjen. Gå bort til hylla og trykk [B] for å se på hvert trofé helt nært. Nye trofeer havner rett i hylla.',
    'isl.d.guidesTrophy': 'Krypefører-pokal',
    'shelf.from.lhLamp': 'Fyrtårnhulene, for å finne din første krystall.',
    'shelf.from.lhTrophy': 'Fyrtårnhulene, for å klare hele eventyret!',
    'shelf.from.kite': 'Skyhopp, for å klare ditt første brett.',
    'shelf.from.hopTrophy': 'Skyhopp, for å klare alle brettene!',
    'shelf.from.duckTrophy': 'Laserender, for dine første poeng.',
    'shelf.from.duckGold': 'Laserender, for å nå runde 5.',
    'shelf.from.banner': 'Riddere og byggere, for å vinne et slag om borgen i kampanjen.',
    'shelf.from.statue': 'Krypeførerne, for å få 3 stjerner.',
    'shelf.from.bugPlush': 'Bønnebrigaden, for å holde Kløverøya trygg.',
    'shelf.from.mechStatue': 'Bønnebrigaden, for å klare hele kampanjen!',
    'shelf.from.pillowFort': 'Puteborgen Solo, for å få Store Bamse til å sove.',
    'shelf.from.featherTrophy': 'Puteborgen Solo, for å få Søvnige Sau til å sove!',
    'shelf.from.fishTrophy': 'Fiskekonkurransen, for å slå Grumbleton.',
    'shelf.from.derbyTrophy': 'Fiskederbyet, for å fange 5 fisker på én dag.',
    'shelf.from.coopPennants': 'Spill sammen på Festøya, for 3 merker.',
    'shelf.from.coopTrophy': 'Spill sammen på Festøya, for 10 merker!',
    'shelf.from.castleTrophy': 'Riddere og byggere, for Gullbønna.',
    'shelf.from.guidesTrophy': 'Krypeførerne, en premie fra Mumle.',
  },
});

export class TrophyShelf {
  constructor(host) {
    this.host = host;
    const map = host.map;
    // a tall wooden cabinet with five boards, a gold star on top
    const g = new THREE.Group();
    const W = SHELF.w, D = SHELF.d, H = 2.6;
    g.add(mesh(box(W, H, 0.06), WOOD_DARK, 0, H / 2, -D / 2 + 0.03));
    for (const s of [-1, 1]) g.add(mesh(box(0.08, H, D), WOOD, s * (W / 2 - 0.04), H / 2, 0));
    for (const y of ROW_Y) g.add(mesh(box(W - 0.08, 0.06, D), WOOD, 0, y - 0.03, 0));
    g.add(mesh(box(W + 0.1, 0.1, D + 0.06), WOOD, 0, H, 0));
    const star = mesh(sph(0.16, 5, 2), COLORS.gold, 0, H + 0.22, 0);
    star.scale.set(1, 1, 0.35);
    g.add(star, mesh(cyl(0.05, 0.05, 0.14, 6), COLORS.gold, 0, H + 0.08, 0));
    g.position.set(SHELF.x, 0.05, SHELF.z);
    host.scene.add(g);
    this.model = g;
    map.boxObs(SHELF.x, SHELF.z, W / 2, D / 2 + 0.05);
    this.items = new THREE.Group();
    g.add(this.items);
    // the glow under the trophy you look at
    this.ring = mesh(cyl(0.19, 0.19, 0.02, 16), toon(0xfff2a8, { emissive: 0x806020 }), 0, 0, 0, false);
    this.ring.visible = false;
    g.add(this.ring);
    this.views = new Map();
    this.sel = 0;
    this.refresh();
  }

  get S() { return this.host.save; }

  owned(id) { return !!this.S.deco[id]; }

  /** The trophies with a spot on the shelf: every trophy you can win, and old ones you already have. */
  slots() { return TROPHIES.filter((id) => !LEGACY.has(id) || this.owned(id)); }

  slotPos(i) { return { x: -SHELF.w / 2 + 0.25 + (i % COLS) * ((SHELF.w - 0.5) / (COLS - 1)), y: ROW_Y[Math.floor(i / COLS)] ?? 0.1 }; }

  /** (Re)build the little trophies: a small copy of each one you own, a "?" for the ones still to win. */
  refresh() {
    const list = this.slots();
    for (const [id, v] of this.views) if (!list.includes(id) || v.userData.has !== this.owned(id)) { v.removeFromParent(); this.views.delete(id); }
    list.forEach((id, i) => {
      let v = this.views.get(id);
      if (!v) {
        v = this.owned(id) ? this.mini(id) : this.mystery();
        v.userData.has = this.owned(id);
        this.items.add(v);
        this.views.set(id, v);
      }
      const p = this.slotPos(i);
      v.position.set(p.x, p.y, 0.02);
      v.userData.home = p;
    });
  }

  /** A trophy shrunk to fit its spot on the board. */
  mini(id) {
    const m = this.host.builder.model(id);
    m.rotation.y = 0.3;
    const b = new THREE.Box3().setFromObject(m), size = b.getSize(new THREE.Vector3());
    const k = Math.min(SLOT_W / Math.max(size.x, size.z, 0.01), 0.42 / Math.max(size.y, 0.01), 0.6);
    const g = new THREE.Group();
    m.scale.multiplyScalar(k);
    m.position.y = -b.min.y * k;
    g.add(m);
    g.userData.inner = m;
    return g;
  }

  /** A trophy still to win: an empty little stand with a "?". */
  mystery() {
    const g = new THREE.Group();
    g.add(mesh(cyl(0.12, 0.14, 0.08, 10), 0x9a94b2, 0, 0.04, 0, false));
    const q = new THREE.Group();
    const arc = mesh(new THREE.TorusGeometry(0.06, 0.022, 6, 12, Math.PI * 1.4), 0xc9c3d6, 0, 0.27, 0, false);
    arc.rotation.z = -Math.PI * 0.45;
    q.add(arc, mesh(box(0.04, 0.07, 0.04), 0xc9c3d6, 0, 0.17, 0, false), mesh(sph(0.025, 6, 4), 0xc9c3d6, 0, 0.11, 0, false));
    g.add(q);
    return g;
  }

  /** A new trophy arrived (island.addDeco): onto the shelf with a sparkle if you are inside. */
  add(id) {
    this.refresh();
    const v = this.views.get(id);
    if (v && this.host.indoors) this.host.confetti.burst(v.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.4, 0.3)), 0, { count: 30, speed: 4, up: 3, life: 1.2, gravity: -6, colors: [0xffd23f, 0xffffff, 0xff9fc0] });
  }

  get front() { return { x: SHELF.x, z: SHELF.z + SHELF.d / 2 + 0.7 }; }

  interactions(P, out, nm) {
    if (Math.hypot(P.x - this.front.x, P.z - this.front.z) < 1.25) out.b = { text: nm('shelf.h.look'), fn: () => this.open() };
  }

  // ---------- the close-up view ----------

  open() {
    const host = this.host;
    const list = this.slots();
    const first = list.findIndex((id) => this.owned(id));
    this.sel = Math.max(0, Math.min(this.sel, list.length - 1));
    if (!this.owned(list[this.sel]) && first >= 0) this.sel = first;
    host.mode = 'shelf';
    host.hud.setCinema(true);
    if (host.player) host.player.ch.group.visible = false; // (the bean would stand between the camera and the shelf)
    host.hud.setPrompt('');
    this.t = 0;
    this.cam = null;
    this.show(true);
    host.game.audio.play('select');
  }

  close() {
    const host = this.host;
    for (const v of this.views.values()) { v.rotation.y = 0; v.scale.setScalar(1); }
    this.ring.visible = false;
    host.camView = null;
    if (host.player) host.player.ch.group.visible = true;
    host.hud.setCinema(false);
    host.hud.setDialog(null);
    host.hud.setPrompt('');
    host.mode = 'walk';
    host.snapCamera();
    host.game.audio.play('select');
  }

  /** The caption under the close-up: the trophy's name and where it came from (read aloud as help). */
  show(read) {
    const host = this.host, list = this.slots(), id = list[this.sel];
    const has = this.owned(id);
    const owned = list.filter((x) => this.owned(x));
    const name = has ? t(`isl.d.${id}`) : t('shelf.notYet');
    const from = has ? t(`shelf.from.${id}`) : t('shelf.still', { how: t(`shelf.from.${id}`) });
    const text = has ? `${from} (${t('shelf.count', { n: owned.indexOf(id) + 1, m: owned.length })})` : owned.length ? from : `${from} ${t('shelf.none')}`;
    host.hud.setDialog({ who: `🏆 ${name}`, text, css: has ? '#c08a10' : '#7a7490' });
    host.hud.setPrompt(tFor(host.player?.p, 'shelf.keys'));
    if (read) speak(`${name}. ${text}`, 'narrator');
  }

  update(inp, dt) {
    const host = this.host, list = this.slots();
    this.t += dt;
    let step = 0;
    if (inp.stepX) step = inp.stepX;
    if (inp.stepY) step = -inp.stepY * COLS;
    if (step) {
      const next = this.sel + step;
      if (next >= 0 && next < list.length) { this.sel = next; host.game.audio.play('select'); this.show(true); } else host.game.audio.play('bump');
    }
    if (this.t > 0.25 && inp.bPressed) { this.close(); return; }
    if (this.t > 0.25 && inp.aPressed) this.show(true);
    // the trophy you look at turns slowly on a glowing ring; the others stand still
    const id = list[this.sel];
    for (const [k, v] of this.views) {
      const on = k === id;
      v.rotation.y = on ? v.rotation.y + dt * 1.2 : 0;
      v.scale.setScalar(on ? 1.15 : 1);
    }
    const p = this.slotPos(this.sel);
    this.ring.visible = true;
    this.ring.position.set(p.x, p.y + 0.012, 0.02);
    // the close-up camera glides to the spot (world coordinates of the slot)
    const at = new THREE.Vector3(SHELF.x + p.x, 0.05 + p.y + 0.2, SHELF.z);
    const pos = at.clone().add(new THREE.Vector3(0, 0.4, 2.1));
    if (!this.cam) this.cam = { pos: pos.clone(), look: at.clone(), fov: 40 };
    const k = Math.min(1, dt * 6);
    this.cam.pos.lerp(pos, k);
    this.cam.look.lerp(at, k);
    host.camView = this.cam;
  }
}
