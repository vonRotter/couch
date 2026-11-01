import * as THREE from 'three';
import { t } from '../../core/i18n.js';
import { toon } from '../../core/palette.js';
import { mesh, box, cyl, sph, WOOD_DARK } from './models.js';
import { heightAt, HAZEL_HOME, STORE, MUSEUM, PAD, PLACES, HOME_DOORS, DEN } from './map.js';
import { HUT } from './isle2geo.js';
import { wakeHour } from './npcs.js';

// Everyone has a home (milestone C). At bedtime a villager walks to their doorstep, the door swings open,
// they step in and it closes; in the morning they come out the same way. Each home has its own window
// material: lit after dark while they are up, dark (with a "zzz" over the roof) while they sleep. A sleeping
// villager's door is locked: [B] knocks and they mumble a sleepy answer through the door (no hearts lost).
// Knocking while they are home but still awake brings them to the door for a chat. Rosa's store and Hoot's
// museum hang a "closed" sign on the door while their owner is at home.
//
// Homes: Hazel her cottage on the hill, Rosa upstairs in the store, Bram the keeper's door on the lighthouse,
// Grumbleton the cabin hatch on his ship, Pip the rocket, Mumble a little den at the meadow (new), Hoot the
// museum, Shelby her shell house on Shell Isle.

const DAY_WIN = 0x9fdcff, LIT_WIN = 0xffd27a, LIT_EMI = 0x9a6a10, DARK_WIN = 0x2c3460;
const OPEN_T = 0.35, WALK_T = 0.55, CLOSE_T = 0.35; // door animation: open, step through, close
const KNOCK_R = 1.6;
const LH = PLACES.find((p) => p.id === 'lighthouse');
const BRAM_YAW = -0.75; // the keeper's door looks south-west, away from the game's front door

/** One window material per home (made before the map is built, so baked houses can use them). */
export function makeHomeMats() {
  const gm = toon(0xffffff).gradientMap;
  return Object.fromEntries(Object.keys(HOME_DOORS).map((id) => [id, new THREE.MeshToonMaterial({ color: DAY_WIN, gradientMap: gm })]));
}

/** A door that swings open on its left hinge, over a dark doorway. Origin: bottom center of the door. */
function makeDoorRig(w, h, color) {
  const g = new THREE.Group();
  g.add(mesh(box(w * 0.98, h * 0.98, 0.02), 0x2b2340, 0, h / 2, 0, false));
  const pivot = new THREE.Group();
  pivot.position.set(-w / 2, 0, 0.04);
  pivot.add(mesh(box(w, h, 0.06), color, w / 2, h / 2, 0, false));
  pivot.add(mesh(sph(0.05, 6, 4), 0xffd23f, w - 0.13, h * 0.48, 0.05, false));
  g.add(pivot);
  g.userData.pivot = pivot;
  g.userData.w = w;
  g.userData.h = h;
  return g;
}

/** "Closed": a little white board with a red rim and a sleepy moon, hung on a shop's door. */
function makeClosedSign() {
  const g = new THREE.Group();
  g.add(mesh(box(0.56, 0.36, 0.03), 0xff5d73, 0, 0, 0, false), mesh(box(0.48, 0.28, 0.04), 0xffffff, 0, 0, 0.005, false));
  g.add(mesh(sph(0.1, 10, 8), 0xffd23f, -0.12, 0, 0.03, false), mesh(sph(0.085, 10, 8), 0xffffff, -0.08, 0.03, 0.045, false));
  for (let i = 0; i < 3; i++) g.add(mesh(box(0.06 + i * 0.02, 0.025, 0.02), 0x5a4d7a, 0.06 + i * 0.07, -0.06 + i * 0.06, 0.04, false));
  g.add(mesh(cyl(0.008, 0.008, 0.3, 4), 0x2b2340, -0.12, 0.26, 0, false).rotateZ(0.6), mesh(cyl(0.008, 0.008, 0.3, 4), 0x2b2340, 0.12, 0.26, 0, false).rotateZ(-0.6));
  return g;
}

/** Mumble's den: a grassy mound with a round little door, a skylight and a leaf on top (faces +z). */
function makeDen(mat) {
  const g = new THREE.Group();
  const mound = mesh(sph(1.2, 16, 10), 0x6fbf4a, 0, 0, 0);
  mound.scale.set(1.25, 0.78, 1.05);
  g.add(mound);
  g.add(mesh(cyl(0.48, 0.48, 0.1, 16), 0x8a6a44, 0, 0.5, 1.16, false).rotateX(Math.PI / 2)); // the door frame
  const win = mesh(cyl(0.16, 0.16, 0.06, 12), mat, 0.62, 0.62, 0.86, false);
  win.rotation.set(Math.PI / 2 - 0.5, 0, -0.5);
  g.add(win, mesh(cyl(0.04, 0.04, 0.4, 5), 0x5a8a3a, -0.2, 1.05, 0.1, false));
  const leaf = mesh(sph(0.16, 8, 6), 0x3f9a32, -0.2, 1.28, 0.1, false);
  leaf.scale.set(1.4, 0.35, 0.7);
  g.add(leaf);
  return g;
}

/** Grumbleton's cabin hatch on the deck of his ship, with a porthole (faces +z; the ship turns it west). */
function makeHatch(mat) {
  const g = new THREE.Group();
  g.add(mesh(box(1.1, 1.55, 0.9), 0x7a4a2e, 0, 0.78, 0), mesh(box(1.26, 0.12, 1.06), 0x4a2e1e, 0, 1.6, 0));
  const port = mesh(cyl(0.17, 0.17, 0.06, 12), mat, 0.57, 1.05, 0, false);
  port.rotation.z = Math.PI / 2;
  g.add(port, mesh(sharedRing(), 0xffd23f, 0.6, 1.05, 0, false).rotateY(Math.PI / 2));
  return g;
}
function sharedRing() { return new THREE.TorusGeometry(0.18, 0.035, 6, 14); }

export class Homes {
  constructor(host) {
    this.host = host;
    const map = host.map, M = host.M;
    this.list = {};
    const world = (o) => { o.updateWorldMatrix(true, false); return new THREE.Vector3().setFromMatrixPosition(o.matrixWorld); };
    const add = (id, rig, opts = {}) => {
      const spot = HOME_DOORS[id].spot;
      const h = { id, rig, spot, open: 0, wiggle: 0, mat: M.home[id], ...opts };
      if (opts.closed) { h.sign = makeClosedSign(); h.sign.position.set(rig.userData.w / 2, rig.userData.h * 0.62, 0.06); rig.userData.pivot.add(h.sign); }
      h.door = world(rig); // the point where they vanish
      this.list[id] = h;
      return h;
    };
    const placeRig = (rig, parent, x, y, z, ry = 0) => { rig.position.set(x, y, z); rig.rotation.y = ry; parent.add(rig); return rig; };
    const scene = host.scene;
    // Hazel: her cottage (door on the front, +z)
    const hy = heightAt(HAZEL_HOME.x, HAZEL_HOME.z);
    add('hazel', placeRig(makeDoorRig(0.95, 1.6, 0x4c8bd6), scene, HAZEL_HOME.x, hy + 0.35, HAZEL_HOME.z + 1.86), { zzz: new THREE.Vector3(HAZEL_HOME.x, hy + 5.2, HAZEL_HOME.z) });
    // Rosa: upstairs in the store (the shop door)
    const sy = heightAt(STORE.x, STORE.z);
    add('rosa', placeRig(makeDoorRig(0.95, 1.6, 0x9a6440), scene, STORE.x, sy + 0.35, STORE.z + 2.36), { zzz: new THREE.Vector3(STORE.x, sy + 6.0, STORE.z), closed: 'isl.home.store' });
    // Bram: a keeper's door on the lighthouse tower, plus its two windows
    const lh = map.lighthouse;
    lh.traverse((o) => { if (o.isMesh && o.material === M.win) o.material = M.home.bram; });
    const bx = Math.sin(BRAM_YAW) * 2.0, bz = Math.cos(BRAM_YAW) * 2.0;
    const frame = mesh(box(0.98, 1.52, 0.08), WOOD_DARK, bx, 0.8 + 0.74, bz);
    frame.rotation.y = BRAM_YAW;
    lh.add(frame, mesh(box(1.1, 0.12, 0.3), 0x2b2340, bx * 1.04, 2.34, bz * 1.04).rotateY(BRAM_YAW));
    add('bram', placeRig(makeDoorRig(0.8, 1.4, 0x2e5a8f), lh, bx * 1.03, 0.8, bz * 1.03, BRAM_YAW), { zzz: new THREE.Vector3(LH.x + 0.7, 5.6, LH.z + 1.6) });
    // Grumbleton: the cabin hatch on the ship's deck at the top of the gangplank
    const ship = map.ship;
    const hatch = makeHatch(M.home.grumbleton);
    hatch.scale.setScalar(1 / ship.scale.x);
    hatch.position.set(0.05, 1.06, -0.75);
    hatch.rotation.y = Math.PI;
    ship.add(hatch);
    add('grumbleton', placeRig(makeDoorRig(0.7, 1.25, 0x9a6440), hatch, 0, 0.02, 0.46), { zzz: new THREE.Vector3(10.4, 3.4, 54) });
    // Pip: the rocket on the launch pad (a hatch at its foot, the porthole is the window)
    const rocket = map.pad.userData.rocket;
    rocket.userData.porthole.material = M.home.pip;
    add('pip', placeRig(makeDoorRig(0.5, 0.85, 0x9a94b2), rocket, 0, 0.45, 0.79), { zzz: new THREE.Vector3(PAD.x + 0.5, 5.6, PAD.z) });
    // Mumble: a little den at the meadow
    const den = makeDen(M.home.mumble);
    den.position.set(DEN.x, heightAt(DEN.x, DEN.z), DEN.z);
    scene.add(den);
    map.circObs(DEN.x, DEN.z, 1.35);
    this.den = den;
    add('mumble', placeRig(makeDoorRig(0.62, 0.78, 0x8a5a32), den, 0, 0.1, 1.22), { zzz: new THREE.Vector3(DEN.x + 0.4, 2.4, DEN.z) });
    // Hoot: the museum (its door and display windows)
    const mus = host.museum.model;
    mus.traverse((o) => { if (o.isMesh && o.material === M.win) o.material = M.home.hoot; });
    add('hoot', placeRig(makeDoorRig(1.3, 2.0, 0x8a5a32), mus, 0, 0.3, 2.28), { zzz: new THREE.Vector3(MUSEUM.x, 6.2, MUSEUM.z), closed: 'isl.home.museum' });
    // Shelby: her shell house on Shell Isle
    const hut = host.isle2.hut;
    hut.add(mesh(box(0.5, 0.4, 0.07), M.home.shelby, 0.95, 1.0, 1.14, false));
    add('shelby', placeRig(makeDoorRig(0.8, 1.1, 0x8a5a32), hut, 0, 0, 1.48), { zzz: new THREE.Vector3(HUT.x, 3.4, HUT.z) });
  }

  home(id) { return this.list[id] || null; }

  // ---------- going in and coming out ----------

  /** Start walking in through the door (the villager is on the doorstep). */
  goIn(n) {
    const h = this.list[n.id];
    if (!h) { n.inside = true; return; }
    n.route = [];
    n.doorAnim = { kind: 'in', t: 0, fx: n.x, fz: n.z };
    this.sound('open', h);
  }

  /** Come out of the door onto the doorstep (morning, a knock, or a scene that needs them). */
  comeOut(n) {
    const h = this.list[n.id];
    n.inside = false;
    if (!h) return;
    n.x = h.door.x; n.z = h.door.z;
    n.route = [];
    n.doorAnim = { kind: 'out', t: 0 };
    this.sound('open', h);
  }

  /** Put someone inside at once (loading at night, or arriving home from another island). */
  putInside(n) {
    const h = this.list[n.id];
    n.inside = true;
    n.doorAnim = null;
    if (h) { n.x = h.spot.x; n.z = h.spot.z; }
  }

  /** Step the door animation of one villager; positions them. Returns false once it is over. */
  animate(n, dt) {
    const A = n.doorAnim, h = this.list[n.id];
    if (!A || !h) { n.doorAnim = null; return false; }
    A.t += dt;
    const k = A.t;
    h.open = k < OPEN_T ? k / OPEN_T : k < OPEN_T + WALK_T ? 1 : Math.max(0, 1 - (k - OPEN_T - WALK_T) / CLOSE_T);
    const w = THREE.MathUtils.clamp((k - OPEN_T) / WALK_T, 0, 1);
    const from = A.kind === 'in' ? { x: A.fx, z: A.fz } : h.door, to = A.kind === 'in' ? h.door : h.spot;
    n.x = from.x + (to.x - from.x) * w;
    n.z = from.z + (to.z - from.z) * w;
    // up the step to the door (or the ship's deck): from the doorstep's floor to the door's sill
    const sy = this.host.map.floorAt(h.spot.x, h.spot.z, true), dy = h.door.y;
    A.y = A.kind === 'in' ? sy + (dy - sy) * w : dy + (sy - dy) * w;
    if (w > 0 && w < 1) n.model.face(to.x - from.x, to.z - from.z);
    if (A.kind === 'in' && w >= 1 && !n.inside) { n.inside = true; this.sound('close', h); }
    if (A.kind === 'out' && k >= OPEN_T + WALK_T && !A.closed) { A.closed = true; this.sound('close', h); }
    if (k >= OPEN_T + WALK_T + CLOSE_T) {
      h.open = 0;
      n.doorAnim = null;
      if (A.kind === 'out') n.spotName = null; // walk on to wherever the day says
      return false;
    }
    return true;
  }

  /** Hidden from view: inside, or still behind the door while it opens to let them out. */
  hidden(n) {
    return !!n.inside || (n.doorAnim?.kind === 'out' && n.doorAnim.t < OPEN_T);
  }

  // ---------- knocking ----------

  /** [B] on the doorstep of someone who is at home: knock. True if it filled out.b. */
  interactions(P, out, nm) {
    for (const h of Object.values(this.list)) {
      const n = this.host.npc(h.id);
      if (!n?.inside || n.doorAnim || Math.hypot(P.x - h.spot.x, P.z - h.spot.z) > KNOCK_R) continue;
      const name = t(`isl.npc.${h.id}`);
      const knock = nm('isl.h.knock', { name });
      out.b = { text: h.closed ? `${t('isl.h.closed', { place: t(h.closed) })} · ${knock}` : knock, fn: () => this.knock(n) };
      return true;
    }
    return false;
  }

  /** Knock knock: a sleepy answer through the door, or (still up) they come out to talk. */
  knock(n) {
    const host = this.host, h = this.list[n.id];
    host.mode = 'knock';
    host.hud.setPrompt('');
    h.wiggle = 1;
    this.sound('knock', h);
    host.player.ch.face(h.door.x - host.player.x, h.door.z - host.player.z);
    host.later(0.75, () => {
      if (n.sleep || !n.inside) {
        h.knocks = (h.knocks || 0) + 1;
        host.mode = 'walk';
        host.say([{ who: n.id, key: `isl.knock.${n.id}.${((h.knocks - 1) % 2) + 1}`, vars: { name: host.playerName } }]);
        return;
      }
      this.comeOut(n);
      n.talking = true; // stay on the doorstep while the door opens
      host.later(OPEN_T + WALK_T + 0.05, () => {
        host.mode = 'walk';
        n.talking = false;
        if (n.doorAnim) { n.x = h.spot.x; n.z = h.spot.z; n.doorAnim = null; h.open = 0; }
        host.talkTo(n);
      });
    });
  }

  /** "asleep until 7:00" for task lines, or '' if this villager is up. */
  awayNote(id, at) {
    const n = this.host.npc(id);
    if (!n || !(n.inside || n.sleep)) return '';
    const hr = wakeHour(id, at);
    const hh = Math.floor(hr), mm = Math.round((hr - hh) * 60);
    return t(n.sleep ? 'isl.task.asleep' : 'isl.task.home', { time: `${hh}:${String(mm).padStart(2, '0')}` });
  }

  // ---------- looks ----------

  update(dt) {
    const host = this.host, lit = (host.night || 0) > 0.3;
    for (const h of Object.values(this.list)) {
      const n = host.npc(h.id);
      const asleep = !!(n?.inside && n.sleep);
      const col = !lit ? DAY_WIN : asleep ? DARK_WIN : LIT_WIN;
      if (h.mat.color.getHex() !== col) { h.mat.color.setHex(col); h.mat.emissive.setHex(lit && !asleep ? LIT_EMI : 0); }
      h.wiggle = Math.max(0, h.wiggle - dt * 2.5);
      const pv = h.rig.userData.pivot;
      pv.rotation.y = -1.55 * h.open + Math.sin(h.wiggle * 28) * 0.05 * h.wiggle;
      if (h.sign) h.sign.visible = !!n?.inside;
    }
  }

  /** Little door sounds (only when the player is near enough to hear). */
  sound(kind, h) {
    const host = this.host, a = host.game.audio, P = host.player;
    if (!a.ctx || a.muted || !P || Math.hypot(P.x - h.door.x, P.z - h.door.z) > 16) return;
    if (kind === 'open') a.tone(240, 0.22, { type: 'triangle', vol: 0.05, slide: 1.5 });
    else if (kind === 'close') { a.noise(0.07, { vol: 0.12, freq: 260, type: 'lowpass' }); a.tone(120, 0.08, { type: 'triangle', vol: 0.1, slide: 0.7 }); }
    else for (let i = 0; i < 3; i++) { a.noise(0.05, { vol: 0.2, freq: 320, type: 'lowpass', delay: i * 0.17 }); a.tone(150, 0.05, { type: 'triangle', vol: 0.12, slide: 0.6, delay: i * 0.17 }); }
  }
}

