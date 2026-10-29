import * as THREE from 'three';
import { BaseScene } from '../../core/scene.js';
import { Character } from '../../core/character.js';
import { toon, basic } from '../../core/palette.js';
import { seeded } from '../../core/world.js';
import { t, tFor } from '../../core/i18n.js';
import { esc } from '../../core/ui.js';
import { say as speak } from '../../core/voice.js';
import './strings.js';
import './strings2.js';
import { loadIsland, give } from './save.js';
import { ITEMS, setPictures, icon } from './items.js';
import { FISH, seaModel, makeFish, makeSeaThing } from './sea.js';
import { thumb } from './thumbs.js';
import { injectHudStyle } from './hud.js';
import { mesh, box, cyl, sph, cone, ico } from './models.js';

// Diving (a Dave the Diver style loop) from the dive boat. A 2.5D side view: swim with the stick, catch
// gentle sea critters in a bubble net ([A]), pick up seaweed, clams and treasure ([B]). The air meter never
// punishes: when it runs out, Grumbleton pulls you up and you keep everything. Swim up and climb into
// the boat to end early. Deeper zones open with flippers (strong current) and the big air tank.

const SURFACE = 0;
const X_MIN = -46, X_MAX = 62;
const CAVE_X = 46; // the glow cave behind the east reef (needs the sea lamp)
const CURRENT_Y = -10.5, DEEP_Y = -22.5;
function sharedCrystal() { return new THREE.OctahedronGeometry(0.4, 0); }
const sstep = (a, b, x) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };

/** The sea floor height at x: sunny shelf, coral reef slope, deep trench in the middle. */
export function floorY(x) {
  const ax = Math.abs(x);
  let y = -8.5 + Math.sin(x * 0.21) * 0.7 + Math.sin(x * 0.07 + 1) * 1.1;
  y = y + (-20 + Math.sin(x * 0.5) * 0.8 - y) * sstep(18, 12, ax);
  y = y + (-32 + Math.sin(x * 0.9) * 0.4 - y) * sstep(7.5, 4, ax);
  return y;
}
const zoneOf = (y) => (y > -10 ? 1 : y > -22 ? 2 : 3);

// What lives where: [id, count, zone, onFloor]
const CRITTERS = [['shrimp', 5, 1, false], ['crab', 3, 1, true], ['bream', 4, 2, false], ['lobster', 2, 2, true], ['squid', 2, 3, false], ['lanternfish', 2, 3, false], ['octopus', 1, 3, true]];
const CHESTS = [{ x: -30, zone: 1, coins: 20, item: 'oldcoin' }, { x: 9.5, zone: 2, coins: 50, item: 'pearl' }, { x: -1.5, zone: 3, coins: 120, item: 'goldcup' }, { x: 57, zone: 4, coins: 150, item: 'crystalShell' }];

const CSS = `
.dv-air { left: 50%; top: 1.4vh; transform: translateX(-50%); width: min(420px, 50vw); display: flex; align-items: center; gap: 10px; font-weight: 700; color: #fff; paint-order: stroke fill; -webkit-text-stroke: .2em #2b2340; font-size: clamp(14px, 1.4vw, 22px); }
.dv-air .bar { flex: 1; height: 22px; border-radius: 999px; background: rgba(43,35,64,.6); border: 3px solid #fff; overflow: hidden; }
.dv-air .bar i { display: block; height: 100%; background: linear-gradient(#8ff0ff, #3fb8e8); }
.dv-air.low .bar i { background: linear-gradient(#ffb0b0, #ff5d73); animation: isl-blink .6s infinite; }
.dv-haul { right: 1.2vw; top: 1.2vh; display: flex; flex-wrap: wrap; gap: 6px; max-width: 34vw; justify-content: flex-end; }
.dv-haul div { display: flex; align-items: center; gap: 2px; background: rgba(255,255,255,.9); border-radius: 999px; padding: 2px 10px 2px 4px; font-weight: 700; font-size: clamp(13px, 1.2vw, 18px); }
.dv-haul img, .dv-haul svg { width: 1.9em; height: 1.9em; }
`;

export class DiveScene extends BaseScene {
  constructor(game) {
    super(game);
    this.key = 'dive';
    this.ownMenu = true;
    this.save = loadIsland(game.roster);
    const sea = this.save.sea;
    this.airMax = sea.tank ? 100 : 60;
    this.air = this.airMax;
    this.speed = sea.scooter ? 8.8 : sea.flippers ? 6.4 : 4.6;
    this.camera.fov = 45;
    this.camera.updateProjectionMatrix();
    this.rand = seeded(1000 + (sea.dives || 0) * 7919);
    this.haul = new Map();
    this.coins = 0;
    this.ending = null;
    this.surfaceT = 0;
    this.netCd = 0;
    this.bubbles = [];
    this.warnT = 0;
    setPictures((id) => this.picture(id));

    this.scene.background = new THREE.Color(0x4cb8e8);
    this.scene.fog = new THREE.Fog(0x4cb8e8, 14, 46);
    this.hemi = new THREE.HemisphereLight(0xcff4ff, 0x2a4a7a, 1.6);
    this.sun = new THREE.DirectionalLight(0xffffff, 1.4);
    this.sun.position.set(-6, 30, 12);
    this.scene.add(this.hemi, this.sun);

    this.buildSea();
    this.buildCave();
    this.spawnThings();
    this.buildDiver();
    this.buildHud();
    this.camPos = new THREE.Vector3(0, -1, 14);
    game.audio.playMusic('space');
    this.game.ui.toast(t('dive.zone1'), 1800);
  }

  picture(id) {
    return thumb(this.game.renderer, id, () => seaModel(id), FISH[id] ? { ry: -0.35 } : { rx: 0.45 });
  }

  // ---------- world ----------

  buildSea() {
    const sc = this.scene;
    // the seabed: a profile extruded back into the screen
    const shape = new THREE.Shape();
    shape.moveTo(X_MIN - 20, -50);
    for (let x = X_MIN - 20; x <= X_MAX + 20; x += 0.8) shape.lineTo(x, floorY(x));
    shape.lineTo(X_MAX + 20, -50);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 22, bevelEnabled: false, steps: 1 });
    geo.translate(0, 0, -16);
    const sand = new THREE.Mesh(geo, toon(0xe8d49a));
    sand.receiveShadow = true;
    sc.add(sand);
    // a darker rock wall far behind, and the surface seen from below
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(200, 80), toon(0x2f6f9f));
    wall.position.set(0, -20, -16);
    sc.add(wall);
    const surf = new THREE.Mesh(new THREE.PlaneGeometry(200, 60), new THREE.MeshBasicMaterial({ color: 0xbff6ff, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }));
    surf.rotation.x = Math.PI / 2;
    surf.position.y = SURFACE;
    sc.add(surf);
    // the dive boat's hull at the surface
    const boat = new THREE.Group();
    boat.add(mesh(box(5.2, 0.9, 3.6), 0xff7a59, 0, 0, 0), mesh(box(5.4, 0.12, 3.8), 0xffffff, 0, 0.42, 0));
    for (const z of [-0.35, 0.35]) boat.add(mesh(box(0.08, 1.8, 0.08), 0xbdb8cf, -2.7, -0.4, z));
    boat.position.set(0, 0.1, -1);
    sc.add(boat);
    this.boat = boat;
    // light rays from the surface
    const rayMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.08, depthWrite: false, side: THREE.DoubleSide });
    this.rays = [];
    for (let i = 0; i < 14; i++) {
      const r = new THREE.Mesh(new THREE.PlaneGeometry(1.6 + this.rand() * 2, 26), rayMat);
      r.position.set(X_MIN + (i + this.rand()) * ((X_MAX - X_MIN) / 14), -12, -4 - this.rand() * 6);
      r.rotation.z = 0.25;
      sc.add(r);
      this.rays.push(r);
    }
    // rocks, corals, anemones and starfish along the floor
    const coralCols = [0xff7eb6, 0xff8c42, 0xffd23f, 0xb08bff, 0xff5d73, 0x3ddc97];
    for (let x = X_MIN; x < X_MAX; x += 1.4 + this.rand() * 1.6) {
      const y = floorY(x);
      const z = -2 - this.rand() * 9;
      const k = this.rand();
      const deep = zoneOf(y) === 3;
      if (k < 0.3) {
        const r = mesh(ico(0.6 + this.rand() * 1.2, 0), deep ? 0x3a4a6a : 0x7a8aa8, x, y + 0.2, z);
        r.rotation.set(this.rand(), this.rand() * 3, 0);
        sc.add(r);
      } else if (k < 0.75 || zoneOf(y) === 2) {
        const g = new THREE.Group();
        const col = coralCols[Math.floor(this.rand() * coralCols.length)];
        if (this.rand() < 0.5) {
          for (let i = 0; i < 4; i++) { const b = mesh(cyl(0.07, 0.11, 0.6 + this.rand() * 0.8, 6), col, (i - 1.5) * 0.25, 0.4, 0); b.rotation.z = (i - 1.5) * 0.3; g.add(b); }
        } else {
          for (let i = 0; i < 5; i++) g.add(mesh(sph(0.22 + this.rand() * 0.2, 8, 6), col, (this.rand() - 0.5) * 0.8, 0.2 + this.rand() * 0.4, (this.rand() - 0.5) * 0.5));
        }
        g.position.set(x, y, z);
        g.scale.setScalar(deep ? 0.8 : 1 + this.rand() * 0.6);
        sc.add(g);
      } else {
        const s = new THREE.Group();
        for (let i = 0; i < 5; i++) { const a = mesh(cone(0.07, 0.3, 4), 0xff8c42, Math.cos(i * 1.256) * 0.12, 0.05, Math.sin(i * 1.256) * 0.12, false); a.rotation.set(Math.PI / 2, 0, -i * 1.256 + Math.PI / 2); s.add(a); }
        s.position.set(x, y + 0.05, -1 - this.rand() * 2);
        sc.add(s);
      }
    }
    // kelp forests (seaweed to pick)
    this.kelps = [];
    for (let i = 0; i < 16; i++) {
      const x = i < 10 ? (this.rand() < 0.5 ? -1 : 1) * (19 + this.rand() * 25) : (this.rand() < 0.5 ? -1 : 1) * (8 + this.rand() * 8);
      const y = floorY(x);
      const g = new THREE.Group();
      const n = 6 + Math.floor(this.rand() * 4);
      for (let k = 0; k < n; k++) {
        const leaf = mesh(box(0.35, 0.8, 0.06), k % 2 ? 0x3fae6a : 0x58c47a, 0, 0.4 + k * 0.7, 0);
        leaf.rotation.z = (k % 2 ? 0.25 : -0.25);
        g.add(leaf);
      }
      g.position.set(x, y, -0.4 - this.rand() * 0.8);
      sc.add(g);
      this.kelps.push({ g, x, y, top: y + n * 0.7, picked: false, ph: this.rand() * 6 });
    }
    // bubble curtains where the deeper zones start (until you have the gear)
    this.curtains = [];
    for (const [y, need, half] of [[CURRENT_Y, 'flippers', 13], [DEEP_Y, 'tank', 6.5]]) {
      if (this.save.sea[need]) continue;
      const n = 90, pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { pos[i * 3] = (this.rand() * 2 - 1) * half; pos[i * 3 + 1] = y + this.rand() * 1.5; pos[i * 3 + 2] = -1 + this.rand() * 2; }
      const gm = new THREE.BufferGeometry();
      gm.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const pts = new THREE.Points(gm, new THREE.PointsMaterial({ color: 0xffffff, size: 0.18, transparent: true, opacity: 0.8, depthWrite: false }));
      sc.add(pts);
      this.curtains.push({ pts, y, half });
    }
  }

  /** The glow cave: a rocky roof east of the shallows, dark unless you carry the sea lamp. */
  buildCave() {
    const sc = this.scene;
    const roof = new THREE.Group();
    for (let x = CAVE_X; x <= X_MAX + 4; x += 1.6) {
      const r = mesh(ico(1.6 + this.rand() * 0.8, 0), 0x3a3a5a, x, -2.2 - this.rand() * 0.8, -1 - this.rand() * 3);
      r.scale.y = 0.7;
      roof.add(r);
    }
    for (let i = 0; i < 10; i++) {
      const x = CAVE_X + 2 + this.rand() * 14;
      const c = mesh(sharedCrystal(), toon([0x8ff0ff, 0xc9a8ff, 0xff9fd0][i % 3], { emissive: 0x334455 }), x, floorY(x) + 0.3, -1.5 - this.rand() * 4, false);
      c.scale.set(0.6, 1.4 + this.rand(), 0.6);
      c.rotation.z = (this.rand() - 0.5) * 0.6;
      roof.add(c);
    }
    sc.add(roof);
    // the dark doorway (until you have the sea lamp)
    this.caveDark = mesh(box(1.2, 10, 8), new THREE.MeshBasicMaterial({ color: 0x050a18, transparent: true, opacity: 0.85, depthWrite: false }), CAVE_X - 0.2, -6, -1, false);
    this.caveDark.visible = !this.save.sea.seaLamp;
    sc.add(this.caveDark);
    if (this.save.sea.seaLamp) {
      this.lampLight = new THREE.PointLight(0xfff1c0, 0, 12, 1.2);
      sc.add(this.lampLight);
    }
  }

  spawnThings() {
    const sc = this.scene, r = this.rand;
    const xIn = (zone) => (zone === 1 ? (r() < 0.5 ? -1 : 1) * (19 + r() * 25) : zone === 2 ? (r() < 0.5 ? -1 : 1) * (8 + r() * 8) : (r() - 0.5) * 6);
    // clams on the floor
    this.clams = [];
    for (const [zone, n] of [[1, 5], [2, 3], [3, 2]]) {
      for (let i = 0; i < n; i++) {
        const x = xIn(zone), y = floorY(x);
        const g = makeSeaThing('clam');
        g.position.set(x, y + 0.05, 0);
        sc.add(g);
        this.clams.push({ g, x, y: y + 0.3, picked: false, pearl: r() < 0.25 });
      }
    }
    for (const x of [50, 54, 59]) {
      const y = floorY(x);
      const g = makeSeaThing('clam');
      g.position.set(x, y + 0.05, 0);
      sc.add(g);
      this.clams.push({ g, x, y: y + 0.3, picked: false, pearl: true });
    }
    // treasure chests
    this.chests = CHESTS.map((c) => {
      const y = floorY(c.x);
      const g = new THREE.Group();
      g.add(mesh(box(1.2, 0.7, 0.8), 0x9a6440, 0, 0.35, 0), mesh(box(1.25, 0.1, 0.85), 0xffd23f, 0, 0.5, 0, false));
      const lid = new THREE.Group();
      lid.add(mesh(cyl(0.42, 0.42, 1.2, 10, 1), 0x8a5a32, 0, 0, 0).rotateZ(Math.PI / 2));
      lid.position.set(0, 0.7, -0.05);
      g.add(lid, mesh(box(0.2, 0.25, 0.05), 0xffd23f, 0, 0.6, 0.42, false));
      g.position.set(c.x, y, 0.2);
      sc.add(g);
      return { ...c, g, lid, y: y + 0.5, open: false };
    });
    // critters
    this.critters = [];
    for (const [id, n, zone, floor] of CRITTERS) {
      for (let i = 0; i < n; i++) {
        const x = xIn(zone);
        const fy = floorY(x);
        const model = FISH[id] ? makeFish(id) : makeSeaThing(id);
        model.scale.multiplyScalar(id === 'shrimp' ? 1.3 : 1);
        const y = floor ? fy + 0.05 : Math.min(zone === 1 ? -1.5 : zone === 2 ? CURRENT_Y - 1 : DEEP_Y - 1, fy + 1.2 + r() * 3);
        const holder = new THREE.Group();
        holder.add(model);
        holder.position.set(x, y, 0);
        sc.add(holder);
        this.critters.push({ id, g: holder, model, x, y, hx: x, hy: y, zone, floor, tx: x, ty: y, wait: r() * 2, dir: 1, ph: r() * 6, state: 'free' });
      }
    }
    for (const x of [51, 58]) {
      const model = makeFish('lanternfish');
      const holder = new THREE.Group();
      holder.add(model);
      const y = floorY(x) + 2;
      holder.position.set(x, y, 0);
      sc.add(holder);
      this.critters.push({ id: 'lanternfish', g: holder, model, x, y, hx: x, hy: y, zone: 4, floor: false, tx: x, ty: y, wait: 1, dir: 1, ph: 0, state: 'free' });
    }
    // ambient life: a turtle, a school of little fish, jellyfish
    this.turtle = new THREE.Group();
    const shell = mesh(sph(0.8, 12, 8), 0x3f8a5a, 0, 0, 0);
    shell.scale.set(1.2, 0.5, 0.9);
    this.turtle.add(shell, mesh(sph(0.3, 10, 8), 0x8ac97a, 1.0, 0.05, 0));
    for (const [x, z] of [[0.5, 0.7], [0.5, -0.7], [-0.6, 0.6], [-0.6, -0.6]]) { const f = mesh(sph(0.25, 8, 6), 0x8ac97a, x, -0.05, z); f.scale.set(1.4, 0.3, 0.6); this.turtle.add(f); }
    this.turtle.position.set(-30, -5, -3);
    sc.add(this.turtle);
    this.school = new THREE.Group();
    for (let i = 0; i < 18; i++) {
      const f = mesh(sph(0.12, 6, 5), 0xffd23f, (r() - 0.5) * 3, (r() - 0.5) * 1.5, (r() - 0.5) * 2, false);
      f.scale.set(1.8, 0.8, 0.5);
      this.school.add(f);
    }
    this.school.position.set(20, -4, -4);
    sc.add(this.school);
    this.jellies = [];
    for (let i = 0; i < 5; i++) {
      const g = new THREE.Group();
      const deep = i >= 3;
      g.add(mesh(sph(0.45, 12, 8, 0), toon(deep ? 0x8ff0ff : 0xff9fd0, { transparent: true, opacity: 0.75, emissive: deep ? 0x226677 : 0x000000 }), 0, 0, 0, false));
      for (let k = 0; k < 4; k++) g.add(mesh(cyl(0.02, 0.02, 0.9, 4), deep ? 0x8ff0ff : 0xff9fd0, (k - 1.5) * 0.15, -0.6, 0, false));
      const x = deep ? (r() - 0.5) * 8 : (r() < 0.5 ? -1 : 1) * (6 + r() * 10);
      g.position.set(x, deep ? -26 - r() * 3 : -13 - r() * 5, -2.5);
      sc.add(g);
      this.jellies.push({ g, ph: r() * 6, y0: g.position.y });
    }
  }

  buildDiver() {
    const p = this.players[0];
    const ch = new Character(p?.color ?? 0x4cc9f0, { hat: 0 });
    // mask, air tank and (if bought) flippers
    ch.pivot.add(mesh(box(0.58, 0.3, 0.12), toon(0xbff6ff, { transparent: true, opacity: 0.6 }), 0, 0.84, 0.38, false));
    ch.pivot.add(mesh(box(0.62, 0.06, 0.08), 0x2b2340, 0, 0.84, 0.36, false));
    ch.pivot.add(mesh(cyl(0.16, 0.16, 0.7, 10), this.save.sea.tank ? 0xff8c42 : 0xffc93c, 0, 0.65, -0.45));
    if (this.save.sea.scooter) {
      const sc = new THREE.Group();
      const body = mesh(sph(0.35, 12, 8), 0xffc93c, 0, 0, 0);
      body.scale.set(1.6, 0.8, 0.8);
      sc.add(body, mesh(cyl(0.22, 0.22, 0.12, 12), 0x9a94b2, 0.55, 0, 0).rotateZ(Math.PI / 2));
      sc.position.set(0, 0.55, 0.55);
      sc.rotation.y = Math.PI / 2;
      ch.pivot.add(sc);
    }
    if (this.save.sea.flippers) for (const f of ch.feet) f.add(mesh(box(0.3, 0.05, 0.6), 0x3ddc97, 0, 0, 0.3, false));
    this.scene.add(ch.group);
    this.diver = { ch, x: 0, y: -1.6, vx: 0, vy: 0, dir: 1, tilt: 0 };
  }

  // ---------- hud ----------

  buildHud() {
    injectHudStyle();
    if (!document.getElementById('dv-style')) {
      const el = document.createElement('style');
      el.id = 'dv-style';
      el.textContent = CSS;
      document.head.appendChild(el);
    }
    const root = document.createElement('div');
    root.className = 'isl-layer';
    this.game.ui.labels.appendChild(root);
    const div = (cls) => { const e = document.createElement('div'); e.className = cls; root.appendChild(e); return e; };
    this.hud = { root, air: div('dv-air'), depth: div('isl-top'), haul: div('dv-haul'), keys: div('isl-keys'), prompt: div('isl-prompt'), panel: div('isl-panel') };
    this.hud.panel.style.display = 'none';
    this.cache = {};
  }

  set(name, html) {
    if (this.cache[name] === html) return;
    this.cache[name] = html;
    this.hud[name].innerHTML = html;
  }

  updateHud() {
    const P = this.players[0];
    const k = this.air / this.airMax;
    this.hud.air.classList.toggle('low', k < 0.25);
    this.set('air', `<span>${esc(t('dive.air'))}</span><div class="bar"><i style="width:${(k * 100).toFixed(1)}%"></i></div>`);
    const depth = Math.max(0, Math.round(-this.diver.y));
    this.set('depth', `<div class="isl-pill">${esc(t('dive.depth', { n: depth }))}<small>${esc(t(this.diver.x > CAVE_X ? 'dive.zone4' : `dive.zone${zoneOf(this.diver.y)}`))}</small></div><div class="isl-pill"><span class="i">${icon('coin')}</span>${this.coins}</div>`);
    this.set('haul', [...this.haul.entries()].map(([id, n]) => `<div>${icon(id)}${n}</div>`).join(''));
    this.set('keys', esc(tFor(P, 'dive.keys')));
  }

  // ---------- frame ----------

  bag(id, n = 1) {
    this.haul.set(id, (this.haul.get(id) || 0) + n);
  }

  update(dt) {
    const P = this.players[0];
    const inp = P ? this.input(P) : null;
    if (this.ending === 'summary') {
      this.updateSummary(inp);
      this.animate(dt);
      return;
    }
    const D = this.diver;
    if (this.game.input.escPressed || inp?.cPressed) { if (!this.ending) this.ascend('early'); }
    // air
    if (!this.ending) {
      this.air = Math.max(0, this.air - dt);
      if (this.air < this.airMax * 0.25 && !this.lowWarned) { this.lowWarned = true; this.game.ui.toast(t('dive.lowAir'), 2000); speak(t('dive.lowAir')); this.game.audio.play('beep'); }
      if (this.air <= 0) this.ascend('air');
    }
    let prompt = '';
    if (this.ending === 'ascend') {
      // floating up to the boat (out of air, or [C])
      D.vy = 7; D.vx += (0 - D.x) * dt * 0.8;
      if (D.y > -0.9) this.endDive();
    } else if (inp) {
      let mx = inp.x, my = inp.y;
      const len = Math.hypot(mx, my);
      if (len > 1) { mx /= len; my /= len; }
      const acc = Math.min(1, dt * 5);
      D.vx += (mx * this.speed - D.vx) * acc;
      D.vy += (my * this.speed - D.vy) * acc + 0.25 * dt; // a little buoyancy
      if (Math.abs(mx) > 0.2) D.dir = Math.sign(mx);
      if (inp.aPressed) this.bubbleNet();
      const near = this.nearest();
      if (near) prompt = near.text;
      if (inp.bPressed && near) near.fn();
      if (D.y > -1.6 && this.time > 1.5) {
        prompt = tFor(P, 'dive.surface');
        if (inp.bPressed) this.endDive();
      }
    }
    D.x += D.vx * dt;
    D.y += D.vy * dt;
    D.x = THREE.MathUtils.clamp(D.x, X_MIN, X_MAX);
    D.y = Math.min(D.y, -0.7);
    const fy = floorY(D.x) + 0.6;
    if (D.y < fy) { D.y = fy; D.vy = Math.max(0, D.vy); }
    // gear gates: a strong current and the deep cold water push you back up
    for (const [y, need, half, key] of [[CURRENT_Y, 'flippers', 13, 'dive.current'], [DEEP_Y, 'tank', 6.5, 'dive.deep']]) {
      if (this.save.sea[need] || Math.abs(D.x) > half + 1) continue;
      if (D.y < y) {
        D.y = y; D.vy = Math.max(D.vy, 2.5);
        if (this.warnT <= 0) { this.warnT = 4; this.game.ui.toast(t(key), 2400); speak(t(key)); this.game.audio.play('bump'); }
      }
    }
    if (!this.save.sea.seaLamp && D.x > CAVE_X - 0.8) {
      D.x = CAVE_X - 0.8; D.vx = Math.min(D.vx, -1);
      if (this.warnT <= 0) { this.warnT = 4; this.game.ui.toast(t('dive.dark'), 2400); speak(t('dive.dark')); this.game.audio.play('bump'); }
    }
    if (this.lampLight) { this.lampLight.position.set(D.x + D.dir * 0.8, D.y + 0.4, 1.5); this.lampLight.intensity = D.x > CAVE_X - 4 ? 30 : 6; }
    this.warnT -= dt;
    this.netCd -= dt;
    this.updateDiverLook(dt);
    this.updateBubbles(dt);
    this.updateCritters(dt);
    this.animate(dt);
    this.updateCamera(dt);
    this.set('prompt', esc(prompt));
    this.hud.prompt.style.display = prompt ? '' : 'none';
    this.updateHud();
  }

  updateDiverLook(dt) {
    const D = this.diver;
    const sp = Math.hypot(D.vx, D.vy);
    D.ch.faceSide(D.dir);
    D.ch.update(dt, { moving: Math.min(1, sp / this.speed), grounded: true, vy: 0 });
    // swim lying down when moving sideways, upright when still
    const want = sp > 1 ? -D.dir * (Math.PI / 2) * 0.8 + Math.atan2(D.vy, Math.abs(D.vx) + 0.01) * D.dir * 0.5 : -D.dir * 0.2;
    D.tilt += (want - D.tilt) * Math.min(1, dt * 6);
    D.ch.group.position.set(D.x, D.y - 0.6, 0);
    D.ch.group.rotation.z = D.tilt;
    // breathing bubbles
    this.breathT = (this.breathT || 0) - dt;
    if (this.breathT <= 0) {
      this.breathT = 0.9;
      this.puffs.burst(new THREE.Vector3(D.x + D.dir * 0.3, D.y + 0.4, 0.3), 0xffffff, { count: 3, speed: 0.6, up: 2.5, size: 0.14, life: 1.4, gravity: 2 });
    }
  }

  /** The closest thing to pick up: { text, fn }. */
  nearest() {
    const D = this.diver, P = this.players[0];
    const d = (x, y) => Math.hypot(D.x - x, D.y - y);
    for (const c of this.chests) if (!c.open && d(c.x, c.y) < 1.8) return { text: tFor(P, 'dive.open'), fn: () => this.openChest(c) };
    for (const c of this.clams) if (!c.picked && d(c.x, c.y) < 1.5) return { text: tFor(P, 'dive.pick', { item: t('isl.i.clam') }), fn: () => this.pickClam(c) };
    for (const k of this.kelps) if (!k.picked && Math.abs(D.x - k.x) < 1.2 && D.y < k.top + 0.5 && D.y > k.y - 0.5) return { text: tFor(P, 'dive.pick', { item: t('isl.i.seaweed') }), fn: () => this.pickKelp(k) };
    return null;
  }

  pickClam(c) {
    c.picked = true;
    c.g.visible = false;
    this.bag('clam');
    if (c.pearl) this.bag('pearl');
    this.game.audio.play(c.pearl ? 'star' : 'pop');
    this.game.ui.toast(t('dive.caught', { item: t(c.pearl ? 'isl.i.pearl' : 'isl.i.clam') }), 900);
  }

  pickKelp(k) {
    k.picked = true;
    k.g.scale.y = 0.35;
    this.bag('seaweed');
    this.puffs.burst(new THREE.Vector3(k.x, this.diver.y, 0.2), 0x58c47a, { count: 8, speed: 2, size: 0.25, life: 0.8, gravity: 0 });
    this.game.audio.play('pop');
    this.game.ui.toast(t('dive.caught', { item: t('isl.i.seaweed') }), 900);
  }

  openChest(c) {
    c.open = true;
    c.lid.rotation.x = -1.2;
    this.coins += c.coins;
    this.bag(c.item);
    this.confetti.burst(new THREE.Vector3(c.x, c.y + 0.8, 0.5), 0, { count: 40, speed: 5, up: 4, life: 1.4, gravity: -3, colors: [0xffd23f, 0xffe47a, 0xffffff] });
    this.game.audio.play('fanfare');
    const txt = t('dive.chest', { n: c.coins, item: t(`isl.i.${c.item}`) });
    this.game.ui.toast(txt, 2200);
    speak(txt);
  }

  bubbleNet() {
    if (this.netCd > 0) return;
    this.netCd = 0.45;
    const D = this.diver;
    let dx = D.vx, dy = D.vy;
    const L = Math.hypot(dx, dy);
    if (L < 0.8) { dx = D.dir; dy = 0; } else { dx /= L; dy /= L; }
    const m = mesh(sph(0.35, 12, 8), toon(0xbff6ff, { transparent: true, opacity: 0.55 }), D.x, D.y, 0.3, false);
    this.scene.add(m);
    this.bubbles.push({ m, x: D.x + dx * 0.6, y: D.y + dy * 0.6, vx: dx * 11, vy: dy * 11, life: 0.5 });
    this.game.audio.play('bubble');
  }

  updateBubbles(dt) {
    for (const b of [...this.bubbles]) {
      b.life -= dt;
      b.x += b.vx * dt; b.y += b.vy * dt;
      b.m.position.set(b.x, b.y, 0.3);
      b.m.scale.setScalar(1 + (0.5 - b.life) * 1.6);
      let hit = null;
      for (const c of this.critters) if (c.state === 'free' && Math.hypot(c.x - b.x, c.y - b.y) < 1.0 + c.model.scale.x * 0.3) { hit = c; break; }
      if (hit) {
        hit.state = 'caught';
        hit.t = 0;
        hit.bubble = b.m;
        this.bubbles.splice(this.bubbles.indexOf(b), 1);
        this.game.audio.play('pop');
        continue;
      }
      if (b.life <= 0) {
        b.m.removeFromParent();
        this.bubbles.splice(this.bubbles.indexOf(b), 1);
        this.puffs.burst(new THREE.Vector3(b.x, b.y, 0.3), 0xffffff, { count: 5, speed: 1.5, size: 0.15, life: 0.5, gravity: 2 });
      }
    }
  }

  updateCritters(dt) {
    const D = this.diver;
    for (const c of this.critters) {
      if (c.state === 'gone') continue;
      if (c.state === 'caught') {
        // float in the bubble to the diver, then into the bag
        c.t += dt;
        c.x += (D.x - c.x) * Math.min(1, dt * 4);
        c.y += (D.y - c.y) * Math.min(1, dt * 4) + dt * 0.5;
        c.bubble.position.set(c.x, c.y, 0.3);
        c.bubble.scale.setScalar(1.6);
        c.g.position.set(c.x, c.y, 0.3);
        if (c.t > 0.6) {
          c.state = 'gone';
          c.g.removeFromParent();
          c.bubble.removeFromParent();
          this.bag(c.id);
          this.game.audio.play('star');
          this.game.ui.toast(t('dive.caught', { item: t(`isl.i.${c.id}`) }), 900);
        }
        continue;
      }
      c.ph += dt;
      const fd = Math.hypot(D.x - c.x, D.y - c.y);
      if (fd < 2.6) {
        // gently swim away from the diver (slower than you)
        const ax = (c.x - D.x) / (fd || 1), ay = c.floor ? 0 : (c.y - D.y) / (fd || 1);
        c.tx = c.x + ax * 3; c.ty = c.y + ay * 2;
        c.wait = 0.8;
      } else {
        c.wait -= dt;
        if (c.wait <= 0) {
          c.wait = 1.5 + Math.random() * 2.5;
          c.tx = c.hx + (Math.random() - 0.5) * (c.zone === 4 ? 4 : 8);
          c.ty = c.floor ? c.hy : c.hy + (Math.random() - 0.5) * 3;
        }
      }
      const sp = fd < 2.6 ? 2.2 : 1.0;
      const dx = c.tx - c.x, dy = c.ty - c.y, d = Math.hypot(dx, dy);
      if (d > 0.05) { c.x += (dx / d) * Math.min(d, sp * dt); c.y += (dy / d) * Math.min(d, sp * dt); if (Math.abs(dx) > 0.05) c.dir = Math.sign(dx); }
      c.x = THREE.MathUtils.clamp(c.x, X_MIN + 1, X_MAX - 1);
      const fl = floorY(c.x);
      c.y = c.floor ? fl + 0.05 : THREE.MathUtils.clamp(c.y, fl + 0.6, -1.2);
      c.g.position.set(c.x, c.y + (c.floor ? 0 : Math.sin(c.ph * 2) * 0.1), 0);
      c.g.rotation.y = c.dir > 0 ? 0 : Math.PI;
      c.model.rotation.z = c.floor ? 0 : Math.sin(c.ph * 6) * 0.08;
    }
  }

  animate(dt) {
    const tm = this.time;
    for (const k of this.kelps) k.g.children.forEach((l, i) => { l.rotation.z = (i % 2 ? 0.25 : -0.25) + Math.sin(tm * 1.2 + k.ph + i * 0.4) * 0.12; });
    this.turtle.position.x += dt * 1.2;
    if (this.turtle.position.x > 46) this.turtle.position.x = -46;
    this.turtle.position.y = -5 + Math.sin(tm * 0.4) * 1.2;
    this.turtle.children.slice(2).forEach((f, i) => { f.rotation.z = Math.sin(tm * 3 + i) * 0.4; });
    this.school.position.x = 20 + Math.sin(tm * 0.2) * 14;
    this.school.position.y = -4 + Math.sin(tm * 0.5) * 1.5;
    this.school.rotation.y = Math.cos(tm * 0.2) > 0 ? 0 : Math.PI;
    for (const j of this.jellies) { j.g.position.y = j.y0 + Math.sin(tm * 0.8 + j.ph) * 0.8; j.g.scale.y = 1 + Math.sin(tm * 3 + j.ph) * 0.1; }
    for (const r of this.rays) r.material.opacity = 0.06;
    for (const c of this.curtains) {
      const a = c.pts.geometry.attributes.position;
      for (let i = 0; i < a.count; i++) { let y = a.getY(i) + dt * 1.6; if (y > c.y + 1.8) y = c.y; a.setY(i, y); }
      a.needsUpdate = true;
    }
    this.boat.rotation.z = Math.sin(tm * 0.8) * 0.03;
  }

  updateCamera(dt) {
    const D = this.diver;
    const cy = Math.min(1.2, D.y + 0.8);
    this.camPos.lerp(new THREE.Vector3(D.x, cy, 14), Math.min(1, dt * 3));
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camPos.x, this.camPos.y - 0.6, 0);
    // deeper water is darker and bluer
    const k = Math.max(THREE.MathUtils.clamp(-D.y / 34, 0, 1), D.x > CAVE_X ? 0.85 : 0);
    const col = new THREE.Color(0x4cb8e8).lerp(new THREE.Color(0x0b1d45), k);
    if (this.camPos.y > 0.2) col.set(0x9fdcff);
    this.scene.background.copy(col);
    this.scene.fog.color.copy(col);
    this.scene.fog.far = 46 - k * 18;
    this.hemi.intensity = 1.6 - k * 0.9;
    this.sun.intensity = 1.4 - k * 1.1;
  }

  // ---------- ending ----------

  ascend(why) {
    this.ending = 'ascend';
    this.why = why;
    if (why === 'air') { this.game.ui.toast(t('dive.noAir'), 2600); speak(t('dive.noAir')); }
    this.game.audio.play('whoosh');
  }

  /** Bring the haul home: into the island save, then show it. */
  endDive() {
    if (this.ending === 'summary') return;
    this.ending = 'summary';
    const S = this.save;
    const items = [...this.haul.entries()];
    for (const [id, n] of items) {
      give(S, id, n);
      if (FISH[id]) { S.sea.log[id] = (S.sea.log[id] || 0) + n; S.sea.caught += n; }
    }
    S.coins += this.coins;
    S.sea.dives++;
    S.sea.haul = { items, coins: this.coins, why: this.why || 'early' };
    this.game.roster.save();
    const gifts = items.map(([id, n]) => `<div>${icon(id)}${n > 1 ? `${n} ` : ''}${esc(t(`isl.i.${id}`))}</div>`).join('');
    const coins = this.coins ? `<div>${icon('coin')}${esc(t('dive.coins', { n: this.coins }))}</div>` : '';
    this.hud.panel.style.display = '';
    this.hud.panel.innerHTML = `<h2>${esc(t('dive.haul'))}</h2>${gifts || coins ? `<div class="isl-gifts">${gifts}${coins}</div>` : `<div class="isl-letter">${esc(t('dive.haulNone'))}</div>`}
      <div class="isl-foot">${esc(tFor(this.players[0], 'dive.hint'))}</div>`;
    this.sumT = 0;
    this.game.audio.play(items.length ? 'fanfare' : 'leave');
  }

  updateSummary(inp) {
    this.sumT += 1 / 60;
    if (this.sumT > 0.4 && inp && (inp.aPressed || inp.bPressed) && !this.leaving) {
      this.leaving = true;
      this.game.goHub('dive');
    }
  }

  idle(dt) { this.animate(dt); }

  dispose() {
    setPictures(null);
    super.dispose();
  }
}
