import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { BaseScene } from '../core/scene.js';
import { Character } from '../core/character.js';
import { COLORS, PLAYER_COLORS, toon, basic, sharedGeo } from '../core/palette.js';
import { addLights, makeTree, makeFlower, makeBush, makeMushroom, makeCloud, makeStar, makeRock, seeded } from '../core/world.js';
import { t } from '../core/i18n.js';
import { esc } from '../core/ui.js';
import { makeGameIcon } from './hub-icons.js';
import { CHAPTERS, NODES, MAX_STARS, stageStars, stageValue, nodeTitle } from './story/stages.js';
import { CARDS } from './story/text.js';
import { makeKing, makeStarSack } from './story/king.js';
import { BossMeadowScene } from './story/boss-meadow.js';
import { BossFrostScene } from './story/boss-frost.js';
import { BossKitchenScene } from './story/boss-kitchen.js';
import { BossSpaceScene } from './story/boss-space.js';

// Story campaign map: four floating lands along a path, three game stages and a Grumble King
// boss in each. Beans hop from node to node; A starts the selected stage, stick left/right picks
// any unlocked node, hold B to go back to the island. Progress lives in roster.progress.story.

/** The boss games, registered in main.js GAMES so retry from the pause menu works. */
export const STORY_GAMES = {
  boss0: { Scene: BossMeadowScene },
  boss1: { Scene: BossFrostScene },
  boss2: { Scene: BossKitchenScene },
  boss3: { Scene: BossSpaceScene },
};

const LAND_W = 28;
const LAND_D = 16;
const LAND_STEP = 32;
const NODE_OFFS = [[-10, 2.4], [-3.6, -1.6], [3, 2.2], [9.6, -0.6]];
const NODE_COLORS = [0x58b947, 0x5aa0f0, 0xff7a59, 0x9b5de5];
const NODE_CSS = ['#3f9a32', '#3d84e8', '#e85a35', '#8a45e0'];
const PAD_Y = 0.3;
const HOP_SPEED = 7;
const LEAVE_HOLD = 1.2;

injectStyle();

const landX = (c) => c * LAND_STEP;

export class StoryScene extends BaseScene {
  constructor(game, opts = {}) {
    super(game);
    this.key = 'story';
    this.camera.fov = 40;
    this.camera.far = 400;
    this.camera.updateProjectionMatrix();
    this.bg = new THREE.Color(CHAPTERS[0].sky);
    this.scene.background = this.bg;
    this.lights = addLights(this.scene, { size: 30, dir: new THREE.Vector3(-0.4, 1, 0.6) });

    const roster = game.roster;
    this.prog = roster.progress.story || { stars: {}, seen: {} };
    this.prog.stars ||= {};
    this.prog.seen ||= {};
    roster.progress.story = this.prog;

    this.nodes = NODES.map((n, i) => {
      const [ox, oz] = NODE_OFFS[n.index];
      return { ...n, i, pos: new THREE.Vector3(landX(n.chapter) + ox, PAD_Y, oz) };
    });
    this.segments = [];
    for (let i = 0; i + 1 < this.nodes.length; i++) this.segments.push([this.nodes[i].pos, this.nodes[i + 1].pos]);

    this.buildLands();
    this.buildPath();
    this.buildNodes();

    this.beans = new Map();
    this.state = 'map';
    this.stateT = 0;
    this.walk = null;
    this.cards = null;
    this.panelEl = null;
    this.holdB = new Map();
    this.holdC = new Map();

    // The King, hidden until a story card needs him.
    this.king = makeKing(2.4);
    this.king.group.visible = false;
    this.scene.add(this.king.group);
    this.sack = makeStarSack();
    this.sack.visible = false;
    this.scene.add(this.sack);
    this.flyStars = [];

    // Where the beans stand: the stage just played, or the next stage to play.
    const result = opts.result || null;
    const resultNode = result ? this.nodes.find((n) => n.id === result.id) : null;
    this.selected = resultNode ? resultNode.i : this.currentIndex();
    this.camTarget = this.nodes[this.selected].pos.clone();
    this.camPos = new THREE.Vector3();
    for (const p of this.players) this.spawnBean(p);
    this.updateCamera(1, true);

    this.hintEl = game.ui.label('story-hint');
    this.nodeLabel = game.ui.label('label');
    game.audio.playMusic('hub');
    if (resultNode) this.showResult(resultNode, result);
    else if (!this.prog.seen.ch0) this.later(0.6, () => { if (this.state === 'map') this.playCards('ch0', this.nodes[0], () => {}); });
  }

  // ---------- progress ----------

  starsOf(node) {
    return this.prog.stars[node.id] || 0;
  }

  totalStars() {
    return this.nodes.reduce((s, n) => s + this.starsOf(n), 0);
  }

  /** Highest unlocked node: the first one never finished (or the last). */
  maxUnlocked() {
    const i = this.nodes.findIndex((n) => !this.starsOf(n));
    return i < 0 ? this.nodes.length - 1 : i;
  }

  currentIndex() {
    return this.maxUnlocked();
  }

  save() {
    this.game.roster.progress.story = this.prog;
    this.game.roster.save();
  }

  retryOptions() {
    return { key: 'story' };
  }

  // ---------- world ----------

  nearPath(x, z, d) {
    for (const [a, b] of this.segments) {
      const abx = b.x - a.x, abz = b.z - a.z;
      const l2 = abx * abx + abz * abz;
      const k = THREE.MathUtils.clamp(((x - a.x) * abx + (z - a.z) * abz) / l2, 0, 1);
      if (Math.hypot(x - (a.x + abx * k), z - (a.z + abz * k)) < d) return true;
    }
    return false;
  }

  buildLands() {
    const s = this.scene;
    const looks = [
      { top: COLORS.grass, mid: COLORS.dirt, low: COLORS.dirtDark },
      { top: 0xf4faff, mid: 0xb9d7f2, low: 0x8fb6e0 },
      { top: 0xfff3e3, mid: 0xd8c3ad, low: 0xb8a088 },
      { top: 0x3b2a7a, mid: 0x2c1f63, low: 0x20164d },
    ];
    CHAPTERS.forEach((ch, c) => {
      const L = looks[c];
      const g = new THREE.Group();
      g.position.x = landX(c);
      const top = new THREE.Mesh(sharedGeo('slTop', () => new RoundedBoxGeometry(LAND_W, 1.2, LAND_D, 3, 0.5)), c === 2 ? this.checkerMat() : toon(L.top));
      top.position.y = -0.6;
      top.receiveShadow = true;
      const mid = new THREE.Mesh(sharedGeo('slMid', () => new RoundedBoxGeometry(LAND_W - 2, 2.4, LAND_D - 2, 2, 0.6)), toon(L.mid));
      mid.position.y = -2.2;
      const low = new THREE.Mesh(sharedGeo('slLow', () => new RoundedBoxGeometry(LAND_W - 7, 2.2, LAND_D - 6, 2, 0.6)), toon(L.low));
      low.position.y = -4.1;
      g.add(top, mid, low);
      s.add(g);
      const rand = seeded(100 + c * 17);
      const spots = (count, tries = 400) => {
        const out = [];
        for (let k = 0; k < tries && out.length < count; k++) {
          const x = landX(c) + (rand() - 0.5) * (LAND_W - 2);
          const z = (rand() - 0.5) * (LAND_D - 2);
          if (this.nearPath(x, z, 2.4)) continue;
          // Keep the view clear: nothing tall between a node and the camera (which looks from +z).
          if (this.nodes.some((n) => Math.abs(x - n.pos.x) < 5.5 && z > n.pos.z - 1.2)) continue;
          if (out.some(([ox, oz]) => Math.hypot(ox - x, oz - z) < 1.6)) continue;
          out.push([x, z]);
        }
        return out;
      };
      [this.decorMeadow, this.decorFrost, this.decorCastle, this.decorSpace][c].call(this, c, rand, spots);
    });
    // Clouds drifting below and between the lands.
    const rand = seeded(5);
    this.clouds = [];
    for (let i = 0; i < 16; i++) {
      const cl = makeCloud(rand, 1.6 + rand());
      cl.position.set(-20 + i * 9 + rand() * 4, -6 - rand() * 5, -14 + rand() * 24);
      this.scene.add(cl);
      this.clouds.push(cl);
    }
  }

  checkerMat() {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 64;
    const g = cv.getContext('2d');
    for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) {
      g.fillStyle = (x + y) % 2 ? '#ffd9e6' : '#fff6ea';
      g.fillRect(x * 32, y * 32, 32, 32);
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(4, 4);
    tex.magFilter = THREE.NearestFilter;
    return new THREE.MeshToonMaterial({ map: tex, gradientMap: toon(0xffffff).gradientMap });
  }

  decorMeadow(c, rand, spots) {
    const s = this.scene;
    spots(26).forEach(([x, z], i) => {
      const o = i % 4 === 0 ? makeBush(rand, 1) : i % 7 === 0 ? makeMushroom(i % 2 ? 0xff5d73 : 0xffc93c) : i % 3 === 0 ? makeRock(rand, 0.8) : makeTree(rand, 0.9 + rand() * 0.5);
      o.position.set(x, 0, z);
      s.add(o);
    });
    for (let i = 0; i < 40; i++) {
      const x = landX(c) + (rand() - 0.5) * (LAND_W - 2), z = (rand() - 0.5) * (LAND_D - 2);
      if (this.nearPath(x, z, 1.3)) continue;
      const f = makeFlower(rand);
      f.position.set(x, 0, z);
      s.add(f);
    }
  }

  decorFrost(c, rand, spots) {
    const s = this.scene;
    // Snowy mountains along the back.
    for (let i = 0; i < 5; i++) {
      const h = 3.2 + (i % 2) * 1.4;
      const x = landX(c) - 11 + i * 5.5;
      const m = new THREE.Mesh(sharedGeo(`smt${i % 2}`, () => new THREE.ConeGeometry(2.3 + (i % 2) * 0.4, h, 7)), toon(i % 2 ? 0xa7c8ea : 0xb9d7f2));
      m.position.set(x, h / 2, -6.4);
      const cap = new THREE.Mesh(sharedGeo(`smc${i % 2}`, () => new THREE.ConeGeometry(0.95 + (i % 2) * 0.2, 1.3, 7)), toon(COLORS.white));
      cap.position.set(x, h - 0.6, -6.4);
      s.add(m, cap);
    }
    spots(16).forEach(([x, z], i) => {
      if (z < -4.5) return;
      const o = i % 4 === 0 ? makeSnowman() : makeFir(rand);
      o.position.set(x, 0, z);
      s.add(o);
    });
  }

  decorCastle(c, rand, spots) {
    const s = this.scene;
    // Castle wall and towers along the back.
    const wall = new THREE.Mesh(new THREE.BoxGeometry(LAND_W - 3, 3, 1.2), toon(0xe8d8c8));
    wall.position.set(landX(c), 1.5, -6.6);
    wall.castShadow = true;
    s.add(wall);
    for (let x = -12; x <= 12; x += 2) {
      const cren = new THREE.Mesh(sharedGeo('cren', () => new THREE.BoxGeometry(1, 0.7, 1.2)), toon(0xe8d8c8));
      cren.position.set(landX(c) + x, 3.35, -6.6);
      s.add(cren);
    }
    for (const x of [-12, -4, 4, 12]) {
      const tw = new THREE.Mesh(sharedGeo('ctower', () => new THREE.CylinderGeometry(1.3, 1.4, 5.5, 14)), toon(0xf2e4d6));
      tw.position.set(landX(c) + x, 2.75, -6.6);
      tw.castShadow = true;
      const roof = new THREE.Mesh(sharedGeo('croof', () => new THREE.ConeGeometry(1.6, 2.4, 14)), toon(x % 8 ? 0xff7eb6 : 0x8a63f0));
      roof.position.set(landX(c) + x, 6.7, -6.6);
      const win = new THREE.Mesh(sharedGeo('cwin', () => new RoundedBoxGeometry(0.6, 0.9, 0.2, 2, 0.2)), toon(0xffe47a));
      win.position.set(landX(c) + x, 3.6, -5.3);
      s.add(tw, roof, win);
    }
    // Big cakes and pots around the kitchen courtyard.
    spots(10).forEach(([x, z], i) => {
      if (z < -4.6) return;
      const o = i % 2 ? makeBigCake(i) : makePot();
      o.position.set(x, 0, z);
      s.add(o);
    });
  }

  decorSpace(c, rand, spots) {
    const s = this.scene;
    this.twinkles = [];
    for (let i = 0; i < 60; i++) {
      const st = new THREE.Mesh(sharedGeo('twk', () => new THREE.OctahedronGeometry(0.12, 0)), basic(i % 3 ? 0xfff6c9 : 0xbfe9ff));
      st.position.set(landX(c) + (rand() - 0.5) * 50, 1 + rand() * 14, -9 - rand() * 14);
      st.userData.phase = rand() * 6;
      s.add(st);
      this.twinkles.push(st);
    }
    const planets = [[-9, 7, -10, 1.6, 0xff9fd0], [10, 9, -11, 2.2, 0x8fd8ff], [2, 11, -14, 1.2, 0xffe47a]];
    for (const [x, y, z, r, col] of planets) {
      const p = new THREE.Mesh(sharedGeo(`spl${r}`, () => new THREE.SphereGeometry(r, 20, 14)), toon(col));
      p.position.set(landX(c) + x, y, z);
      s.add(p);
      if (r > 1.5) {
        const ring = new THREE.Mesh(sharedGeo(`splr${r}`, () => new THREE.TorusGeometry(r * 1.5, r * 0.08, 6, 36)), toon(COLORS.white));
        ring.position.copy(p.position);
        ring.rotation.set(1.2, 0.3, 0);
        s.add(ring);
      }
    }
    spots(14).forEach(([x, z], i) => {
      let o;
      if (i % 3 === 0) o = makeRocketProp(i);
      else if (i % 3 === 1) {
        o = new THREE.Mesh(sharedGeo('crater', () => new THREE.CylinderGeometry(1, 1.2, 0.12, 16)), toon(0x5a46a6));
        o.position.y = 0.02;
      } else {
        o = new THREE.Mesh(sharedGeo('crystal', () => new THREE.OctahedronGeometry(0.5, 0)), toon(i % 2 ? 0x7dffcf : 0xff9fd0, { emissive: 0x221144 }));
        o.scale.y = 1.8;
        o.position.y = 0.8;
      }
      o.position.x = x; o.position.z = z;
      s.add(o);
    });
  }

  buildPath() {
    const s = this.scene;
    const stone = sharedGeo('pathStone', () => new THREE.CylinderGeometry(0.42, 0.48, 0.12, 10));
    const plank = sharedGeo('pathPlank', () => new RoundedBoxGeometry(1.0, 0.16, 1.9, 2, 0.05));
    const looks = [COLORS.sand, 0xdbeefc, 0xe9d6c2, 0x6b58c0];
    for (const [a, b] of this.segments) {
      const len = a.distanceTo(b);
      const steps = Math.floor(len / 1.25);
      for (let k = 1; k < steps; k++) {
        const f = k / steps;
        const x = a.x + (b.x - a.x) * f, z = a.z + (b.z - a.z) * f;
        const c = Math.round(x / LAND_STEP);
        const onLand = Math.abs(x - landX(c)) < LAND_W / 2 - 0.4;
        if (onLand && (Math.hypot(x - a.x, z - a.z) < 1.7 || Math.hypot(x - b.x, z - b.z) < 1.7)) continue;
        const m = new THREE.Mesh(onLand ? stone : plank, toon(onLand ? looks[THREE.MathUtils.clamp(c, 0, 3)] : COLORS.trunk));
        m.position.set(x, onLand ? 0.04 : -0.05, z);
        if (!onLand) m.rotation.y = Math.atan2(b.x - a.x, b.z - a.z);
        m.receiveShadow = true;
        s.add(m);
      }
    }
  }

  buildNodes() {
    const s = this.scene;
    for (const n of this.nodes) {
      const g = new THREE.Group();
      g.position.copy(n.pos).setY(0);
      const r = n.boss ? 1.6 : 1.25;
      const base = new THREE.Mesh(sharedGeo(`nodeBase${r}`, () => new THREE.CylinderGeometry(r, r + 0.15, 0.3, 32)), toon(COLORS.icing));
      base.position.y = 0.15;
      base.castShadow = true;
      base.receiveShadow = true;
      const rim = new THREE.Mesh(sharedGeo(`nodeRim${r}`, () => new THREE.TorusGeometry(r, 0.14, 8, 40)), toon(NODE_COLORS[n.chapter]));
      rim.rotation.x = Math.PI / 2;
      rim.position.y = 0.3;
      g.add(base, rim);
      // Floating icon: the game's island icon, or a mini King for bosses.
      const icon = new THREE.Group();
      if (n.boss) {
        const k = makeKing(0.75);
        icon.add(k.group);
        icon.position.y = 1.9;
        n.miniKing = k;
      } else {
        const gi = makeGameIcon(n.key);
        gi.scale.setScalar(0.5);
        icon.add(gi);
        icon.position.y = 2.3;
      }
      g.add(icon);
      // Padlock for locked nodes.
      const lock = new THREE.Group();
      const body = new THREE.Mesh(sharedGeo('lockBody', () => new RoundedBoxGeometry(0.7, 0.55, 0.3, 2, 0.08)), toon(0xb8b2c8));
      const shackle = new THREE.Mesh(sharedGeo('lockShackle', () => new THREE.TorusGeometry(0.22, 0.07, 8, 16, Math.PI)), toon(0x9a94b2));
      shackle.position.y = 0.27;
      lock.add(body, shackle);
      lock.position.y = 1.4;
      g.add(lock);
      // Three little stars in front of the pad.
      const stars = [-1, 0, 1].map((k) => {
        const st = makeStar(0xd8d2e6);
        st.scale.setScalar(0.55);
        st.position.set(k * 0.62, 0.42 + (k === 0 ? 0.12 : 0), r + 0.55);
        st.rotation.z = -k * 0.25;
        g.add(st);
        return st;
      });
      s.add(g);
      Object.assign(n, { group: g, rim, icon, lock, starMeshes: stars });
    }
    this.refreshNodes();
  }

  refreshNodes() {
    const max = this.maxUnlocked();
    for (const n of this.nodes) {
      const open = n.i <= max;
      const got = this.starsOf(n);
      n.icon.visible = open;
      n.lock.visible = !open;
      n.rim.material = toon(open ? NODE_COLORS[n.chapter] : 0xb8b2c8);
      n.starMeshes.forEach((st, k) => {
        st.visible = got > 0;
        st.material = toon(k < got ? COLORS.gold : 0xd8d2e6, { emissive: k < got ? 0x332200 : 0x000000 });
      });
    }
  }

  // ---------- beans ----------

  slot(i, n) {
    // One row for up to three beans, two rows for more.
    const row = n <= 3 ? 0 : i < Math.ceil(n / 2) ? 0 : 1;
    const inRow = n <= 3 ? n : row === 0 ? Math.ceil(n / 2) : Math.floor(n / 2);
    const k = n <= 3 ? i : row === 0 ? i : i - Math.ceil(n / 2);
    return { x: (k - (inRow - 1) / 2) * 0.72, z: n <= 3 ? 0.15 : row === 0 ? -0.35 : 0.45 };
  }

  spawnBean(p) {
    const ch = new Character(p.color, { hat: p.hat });
    this.scene.add(ch.group);
    const b = { p, ch, pos: new THREE.Vector3(), target: null, hopT: 0 };
    this.beans.set(p, b);
    this.placeBeansAt(this.selected, true);
    this.puffs.burst(b.ch.group.position.clone().setY(0.8), 0xffffff, { count: 12, speed: 4, size: 0.4 });
    return b;
  }

  removeBean(p) {
    const b = this.beans.get(p);
    if (!b) return;
    this.puffs.burst(b.ch.group.position.clone().setY(0.8), 0xffffff, { count: 12, speed: 4, size: 0.4 });
    this.scene.remove(b.ch.group);
    this.beans.delete(p);
    this.holdB.delete(p);
    this.holdC.delete(p);
  }

  placeBeansAt(index, snap = false) {
    const list = [...this.beans.values()];
    const c = this.nodes[index].pos;
    list.forEach((b, i) => {
      const o = this.slot(i, list.length);
      b.target = new THREE.Vector3(c.x + o.x, PAD_Y, c.z + o.z);
      if (snap) { b.pos.copy(b.target); b.ch.group.position.copy(b.pos); }
    });
  }

  /** Hop the beans along the path from the selected node to node `to`. */
  walkTo(to) {
    const from = this.selected;
    if (to === from) return;
    const pts = [];
    const dir = Math.sign(to - from);
    for (let i = from; i !== to + dir; i += dir) pts.push(this.nodes[i].pos.clone());
    const lens = [];
    let total = 0;
    for (let i = 1; i < pts.length; i++) { const l = pts[i].distanceTo(pts[i - 1]); lens.push(l); total += l; }
    this.walk = { pts, lens, total, t: 0 };
    this.selected = to;
    this.game.audio.play('select');
  }

  pointAt(dist) {
    const w = this.walk;
    let d = THREE.MathUtils.clamp(dist, 0, w.total);
    for (let i = 0; i < w.lens.length; i++) {
      if (d <= w.lens[i] || i === w.lens.length - 1) {
        const f = w.lens[i] ? Math.min(1, d / w.lens[i]) : 1;
        return w.pts[i].clone().lerp(w.pts[i + 1], f);
      }
      d -= w.lens[i];
    }
    return w.pts[w.pts.length - 1].clone();
  }

  updateBeans(dt) {
    const list = [...this.beans.values()];
    const w = this.walk;
    if (w) {
      w.t += dt;
      const lastDelay = (list.length - 1) * 0.12;
      list.forEach((b, i) => {
        const dist = Math.max(0, w.t - i * 0.12) * HOP_SPEED;
        const p = this.pointAt(dist);
        const o = this.slot(i, list.length);
        const f = Math.min(1, dist / w.total);
        p.x += o.x * f; p.z += o.z * f;
        const hop = dist < w.total ? Math.abs(Math.sin((dist / 1.3) * Math.PI)) * 0.55 : 0;
        const prev = b.pos.clone();
        b.pos.set(p.x, PAD_Y + hop, p.z);
        b.ch.face(b.pos.x - prev.x, b.pos.z - prev.z);
        b.ch.group.position.copy(b.pos);
        b.ch.update(dt, { moving: dist < w.total ? 1 : 0, grounded: hop < 0.05, vy: hop > 0.3 ? 4 : -4 });
      });
      if (w.t * HOP_SPEED > w.total + lastDelay * HOP_SPEED + 0.1) {
        this.walk = null;
        this.placeBeansAt(this.selected);
      }
      return;
    }
    // Ease toward targets (slots on the pad, or diorama poses).
    list.forEach((b, i) => {
      if (!b.target) return;
      const d = b.target.clone().sub(b.pos);
      const len = Math.hypot(d.x, d.z);
      if (len > 0.03) {
        const step = Math.min(len, dt * 5);
        b.pos.x += (d.x / len) * step;
        b.pos.z += (d.z / len) * step;
        b.ch.face(d.x, d.z);
      } else if (b.look) b.ch.face(b.look.x, b.look.z);
      else b.ch.face(0, 1);
      let y = b.target.y;
      if (b.bounce) y += Math.abs(Math.sin(this.time * b.bounce + i * 1.3)) * 0.35;
      b.pos.y = y;
      b.ch.group.position.copy(b.pos);
      b.ch.update(dt, { moving: len > 0.03 ? 1 : 0 });
    });
  }

  // ---------- camera ----------

  updateCamera(dt, snap = false) {
    let look, offset;
    if (this.cards) {
      look = this.cards.focus;
      offset = new THREE.Vector3(0, 3.1, 8.6);
    } else {
      const n = this.nodes[this.selected];
      look = new THREE.Vector3(n.pos.x + 2, 0.4, n.pos.z * 0.25);
      offset = new THREE.Vector3(0, 13.5, 16.5);
    }
    const k = snap ? 1 : Math.min(1, dt * 2.5);
    this.camTarget.lerp(look, k);
    this.camPos.lerp(look.clone().add(offset), k);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camTarget);
    // Sky color follows the land in view.
    const f = THREE.MathUtils.clamp(this.camTarget.x / LAND_STEP, 0, 3);
    const a = Math.floor(f), b = Math.min(3, a + 1);
    this.bg.setHex(CHAPTERS[a].sky).lerp(new THREE.Color(CHAPTERS[b].sky), THREE.MathUtils.smoothstep(f - a, 0.2, 0.8));
    const sun = this.lights.sun;
    sun.position.set(this.camTarget.x - 18, 40, 24);
    sun.target.position.set(this.camTarget.x, 0, 0);
  }

  // ---------- story cards ----------

  playCards(id, node, done) {
    const seq = CARDS[id];
    if (!seq) { done(); return; }
    this.prog.seen[id] = true;
    this.save();
    this.state = 'card';
    this.stateT = 0;
    const focus = node.pos.clone().add(new THREE.Vector3(0.3, 1.6, -1.1));
    this.cards = { id, seq, i: 0, node, done, focus };
    this.nodeLabel.style.display = 'none';
    this.king.group.visible = true;
    this.puffs.burst(node.pos.clone().add(new THREE.Vector3(0, 1.5, -2.4)), 0xffffff, { count: 24, speed: 5, size: 0.6 });
    this.game.audio.play('whoosh');
    this.showCard();
  }

  showCard() {
    const C = this.cards;
    const page = C.seq[C.i];
    this.pose(page.pose, C.node);
    const last = C.i === C.seq.length - 1;
    const dots = C.seq.length > 1 ? `<span class="dots">${C.seq.map((_, i) => `<i class="${i === C.i ? 'on' : ''}"></i>`).join('')}</span>` : '';
    const lines = page.lines.map((k) => {
      const s = t(k);
      const say = /^["«“]/.test(s);
      const tip = page.speaker === 'king' && !say;
      return `<div class="line ${say ? 'say' : ''} ${tip ? 'tip' : ''}">${esc(s)}</div>`;
    }).join('');
    const html = `${page.speaker === 'king' ? `<div class="speaker">${esc(t('story.speaker.king'))}</div>` : ''}${lines}
      <div class="foot">${dots}<span class="blink">${esc(t(last ? 'story.cardLast' : 'story.cardHint'))}</span></div>`;
    if (!this.cardEl) this.cardEl = this.game.ui.label('story-card');
    this.cardEl.innerHTML = html;
    this.cardEl.classList.remove('story-anim');
    void this.cardEl.offsetWidth; // restart the slide-in animation
    this.cardEl.classList.add('story-anim');
  }

  /** Set up the little diorama around `node` for a story page. */
  pose(name, node) {
    const P = node.pos;
    const K = this.king;
    const kpos = new THREE.Vector3(P.x, PAD_Y, P.z - 2.4);
    K.group.rotation.set(0, 0, 0);
    K.setMood('grumpy');
    this.sack.visible = false;
    this.kingHop = 0;
    this.kingWalk = null;
    this.partyT = name === 'party' ? 0 : null;
    let beanZ = P.z + 0.9;
    let look = 'king';
    let bounce = 0;
    switch (name) {
      case 'steal':
        this.sack.visible = true;
        this.kingHop = 9;
        bounce = 6;
        break;
      case 'brave':
        kpos.set(P.x + 2.8, PAD_Y, P.z - 4.2);
        K.group.rotation.y = Math.PI * 0.72; // stomping away
        this.sack.visible = true;
        this.kingWalk = 0.25;
        look = 'camera';
        bounce = 4;
        break;
      case 'land':
        kpos.set(P.x + 3.4, PAD_Y, P.z - 3.2);
        K.group.rotation.y = -0.5;
        look = 'around';
        break;
      case 'boss':
        this.kingHop = 11;
        bounce = 3;
        break;
      case 'lonely':
        K.setMood('sad');
        beanZ = P.z + 1.4;
        break;
      case 'invite':
        K.setMood('hopeful');
        beanZ = P.z + 0.6;
        bounce = 5;
        break;
      case 'party':
        K.setMood('laugh');
        this.kingHop = 10;
        this.sack.visible = true;
        bounce = 7;
        look = 'camera';
        break;
      default:
        break;
    }
    K.group.position.copy(kpos);
    this.kingBase = kpos.clone();
    this.sack.position.set(kpos.x + 1.7, PAD_Y, kpos.z + 0.4);
    const list = [...this.beans.values()];
    const n = list.length;
    list.forEach((b, i) => {
      const spread = Math.min(1.3, 5 / Math.max(1, n));
      const x = P.x + (i - (n - 1) / 2) * spread;
      const z = beanZ + Math.abs(i - (n - 1) / 2) * 0.25;
      b.target = new THREE.Vector3(x, PAD_Y, z);
      b.bounce = bounce;
      if (look === 'king') b.look = { x: (kpos.x - x) * 0.6, z: (kpos.z - z) * 0.4 + 0.6 };
      else if (look === 'around') b.look = { x: i % 2 ? 1 : -1, z: 0.6 };
      else b.look = { x: 0, z: 1 };
    });
  }

  updateCards(dt) {
    const C = this.cards;
    const K = this.king;
    if (this.kingWalk) {
      K.group.position.x += Math.sin(K.group.rotation.y) * this.kingWalk * dt;
      K.group.position.z += Math.cos(K.group.rotation.y) * this.kingWalk * dt;
    }
    K.update(dt, { hop: this.kingHop });
    if (this.sack.visible) {
      this.sack.position.x = K.group.position.x + 1.7;
      this.sack.position.z = K.group.position.z + 0.4;
      this.sack.position.y = PAD_Y + K.inner.position.y * K.size;
    }
    if (this.partyT !== null) {
      this.partyT -= dt;
      if (this.partyT <= 0) {
        this.partyT = 0.5;
        const p = C.node.pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 6, 3.5, -1 + Math.random()));
        this.confetti.burst(p, 0, { count: 30, speed: 7, colors: PLAYER_COLORS.map((c) => c.hex).concat(COLORS.gold), life: 1.6 });
        // A Party Star flies home out of the sack.
        const st = makeStar();
        st.scale.setScalar(0.6);
        st.position.copy(this.sack.position).add(new THREE.Vector3(0, 1.2, 0));
        this.scene.add(st);
        this.flyStars.push({ m: st, t: 0, vx: -2 - Math.random() * 3, vz: (Math.random() - 0.5) * 2 });
      }
    }
    const d = this.anyPressed('aPressed');
    this.stateT += dt;
    if (d && this.stateT > 0.35) {
      this.stateT = 0;
      this.game.audio.play('select');
      if (C.i + 1 < C.seq.length) {
        C.i++;
        this.showCard();
      } else {
        this.endCards();
      }
    }
  }

  endCards() {
    const C = this.cards;
    this.cards = null;
    this.cardEl?.remove();
    this.cardEl = null;
    this.puffs.burst(this.king.group.position.clone().setY(1.5), 0xffffff, { count: 24, speed: 5, size: 0.6 });
    this.king.group.visible = false;
    this.sack.visible = false;
    this.partyT = null;
    for (const b of this.beans.values()) { b.bounce = 0; b.look = null; }
    this.placeBeansAt(this.selected);
    this.state = 'map';
    this.stateT = 0;
    C.done();
  }

  updateFlyStars(dt) {
    for (const f of this.flyStars) {
      f.t += dt;
      f.m.position.x += f.vx * dt;
      f.m.position.z += f.vz * dt;
      f.m.position.y += (4 - f.t) * dt * 1.5;
      f.m.rotation.y += dt * 6;
      if (f.t > 3) { this.scene.remove(f.m); f.done = true; }
    }
    this.flyStars = this.flyStars.filter((f) => !f.done);
  }

  // ---------- goal and result cards ----------

  starRow(n, animate = false) {
    return `<div class="story-stars">${[0, 1, 2].map((i) => `<span class="${i < n ? 'on' : ''}" style="${animate ? `animation-delay:${0.3 + i * 0.25}s` : 'animation:none'}">★</span>`).join('')}</div>`;
  }

  openNode(node) {
    const seq = [];
    if (node.index === 0 && !this.prog.seen[`ch${node.chapter}`]) seq.push(`ch${node.chapter}`);
    if (node.boss) seq.push(`boss${node.chapter}`);
    const next = () => {
      const id = seq.shift();
      if (id) this.playCards(id, node, next);
      else this.showGoal(node);
    };
    next();
  }

  showGoal(node) {
    this.state = 'goal';
    this.stateT = 0;
    this.goalNode = node;
    this.renderGoal();
    this.game.audio.play('select');
  }

  renderGoal() {
    const node = this.goalNode;
    const g = node.goal(Math.max(1, this.players.length));
    const best = this.starsOf(node);
    const html = `<div class="story-kicker" style="--c:${NODE_CSS[node.chapter]}">${esc(nodeTitle(node))}</div>
      <div class="results-title">${esc(t('story.goalTitle'))}</div>
      <div class="goal-main">${esc(g.main)}</div>
      <div class="story-tiers">
        <div><span class="st">★</span>${esc(t('story.tier.play'))}</div>
        <div><span class="st">★★</span>${esc(g.two)}</div>
        <div><span class="st">★★★</span>${esc(g.three)}</div>
      </div>
      ${best ? `<div class="results-sub">${esc(t('story.result.best', { n: best }))}</div>` : ''}
      <div class="results-footer blink" style="margin-top:12px">${esc(t('story.startHint'))}</div>`;
    this.setPanel(html, 'panel story-goal');
  }

  setPanel(html, cls) {
    if (!this.panelEl) this.panelEl = this.game.ui.panel(html, cls);
    else { this.panelEl.className = cls; this.panelEl.innerHTML = html; }
  }

  closePanel() {
    this.panelEl?.remove();
    this.panelEl = null;
  }

  updateGoal(dt) {
    this.stateT += dt;
    if (this.stateT < 0.3) return;
    if (this.anyPressed('aPressed')) {
      this.closePanel();
      this.state = 'leaving';
      const n = this.goalNode;
      this.game.audio.play('join');
      this.game.startStage({ id: n.id, key: n.key, opts: n.opts });
    } else if (this.anyPressed('bPressed')) {
      this.closePanel();
      this.state = 'map';
      this.stateT = 0;
      this.game.audio.play('select');
    }
  }

  /** Save a finished stage and show how it went. */
  showResult(node, result) {
    const stars = stageStars(node, result);
    const before = this.starsOf(node);
    const wasMax = this.maxUnlocked();
    this.prog.stars[node.id] = Math.max(before, stars);
    this.save();
    this.refreshNodes();
    const unlocked = this.maxUnlocked() > wasMax && this.maxUnlocked() > node.i;
    this.resultInfo = { node, result, stars, before, unlocked };
    this.state = 'result';
    this.stateT = 0;
    this.renderResult();
    this.game.audio.play(result.quit ? 'select' : 'fanfare');
    if (!result.quit) {
      for (let i = 0; i < stars; i++) this.later(0.35 + i * 0.25, () => this.game.audio.play('star'));
      this.later(0.4, () => this.confetti.burst(node.pos.clone().setY(2.5), 0, { count: 50, speed: 8, colors: PLAYER_COLORS.map((c) => c.hex).concat(COLORS.gold) }));
    }
  }

  renderResult() {
    const { node, result, stars, before, unlocked } = this.resultInfo;
    const quit = result.quit;
    const g = node.goal(Math.max(1, result.stats?.n || this.players.length));
    const total = this.totalStars();
    const value = stageValue(node, result);
    const title = quit ? t('story.result.skip') : stars === 3 ? t('story.result.great') : t('story.result.title');
    const best = stars > before && before > 0 ? t('story.result.new') : t('story.result.best', { n: Math.max(before, stars) });
    const html = `<div class="story-kicker" style="--c:${NODE_CSS[node.chapter]}">${esc(nodeTitle(node))}</div>
      <div class="results-title">${esc(title)}</div>
      <div class="results-sub">${esc(t('story.result.goal', { goal: g.main }))}</div>
      ${value ? `<div class="goal-main">${esc(value)}</div>` : ''}
      ${quit ? `<div class="results-sub">${esc(t('story.result.skipSub'))}</div>` : ''}
      ${this.starRow(stars, true)}
      <div class="results-sub">${esc(best)} · <span class="star-icon"></span> ${esc(t('story.result.total', { n: total, max: MAX_STARS }))}</div>
      ${unlocked ? `<div class="results-sub" style="color:#3f9a32">${esc(t('story.result.unlocked'))}</div>` : ''}
      ${total === MAX_STARS && stars > before ? `<div class="results-sub" style="color:#e85a35">${esc(t('story.allStars', { n: MAX_STARS }))}</div>` : ''}
      <div class="results-footer blink" style="margin-top:10px">${esc(t('story.result.hint'))}</div>`;
    this.setPanel(html, 'panel story-result');
  }

  updateResult(dt) {
    this.stateT += dt;
    if (this.stateT < 1 || !this.anyPressed('aPressed')) return;
    this.closePanel();
    const { node, unlocked } = this.resultInfo;
    this.state = 'map';
    this.stateT = 0;
    const last = node.i === this.nodes.length - 1;
    if (last && !this.prog.seen.end) {
      this.playCards('end', node, () => {});
      return;
    }
    if (unlocked) this.later(0.3, () => { if (this.state === 'map' && !this.walk) this.walkTo(this.maxUnlocked()); });
  }

  // ---------- input ----------

  anyPressed(btn) {
    return this.players.some((p) => this.input(p)?.[btn]);
  }

  handleJoins(dt) {
    const roster = this.game.roster;
    for (const d of this.game.input.joinRequests()) {
      if (roster.has(d.id)) continue;
      const p = roster.join(d);
      if (!p) continue;
      this.spawnBean(p);
      this.game.audio.play('join');
      this.game.ui.toast(t('hub.joined', { name: p.name }));
    }
    // Hold C to leave the party (C also counts as B, so check it first).
    for (const p of [...this.players]) {
      const inp = this.input(p);
      if (!inp) continue;
      const hc = inp.c ? (this.holdC.get(p) || 0) + dt : 0;
      this.holdC.set(p, hc);
      if (hc > 1.3) {
        this.removeBean(p);
        this.game.roster.leave(p);
        this.game.audio.play('leave');
        this.placeBeansAt(this.selected);
      }
    }
    if (this.players.length === 0) this.leave();
  }

  leave() {
    if (this.state === 'leaving') return;
    this.state = 'leaving';
    this.closePanel();
    this.game.ui.toast(t('story.leaving'));
    this.game.goHub('story');
  }

  updateMap(dt) {
    this.stateT += dt;
    const max = this.maxUnlocked();
    for (const p of this.players) {
      const inp = this.input(p);
      if (!inp) continue;
      if (inp.stepX && !this.walk) {
        const to = THREE.MathUtils.clamp(this.selected + inp.stepX, 0, max);
        if (to !== this.selected) this.walkTo(to);
        else this.game.audio.play('bump');
      }
      // Hold B (without C) to go back to the island.
      const hb = inp.b && !inp.c ? (this.holdB.get(p) || 0) + dt : 0;
      this.holdB.set(p, hb);
      if (hb > LEAVE_HOLD) { this.leave(); return; }
      if (inp.aPressed && !this.walk && this.stateT > 0.3) {
        this.openNode(this.nodes[this.selected]);
        return;
      }
    }
  }

  // ---------- frame ----------

  updateLabels() {
    const n = this.nodes[this.selected];
    const showNode = this.state === 'map';
    this.nodeLabel.style.display = showNode ? '' : 'none';
    if (showNode) {
      const got = this.starsOf(n);
      const stars = got ? ` ${'★'.repeat(got)}${'☆'.repeat(3 - got)}` : '';
      const html = `${esc(nodeTitle(n))}<small>${esc(n.goal(Math.max(1, this.players.length)).main)}${stars}</small>`;
      if (this.nodeLabel.innerHTML !== html) this.nodeLabel.innerHTML = html;
      this.nodeLabel.style.color = NODE_CSS[n.chapter];
      this.game.ui.place(this.nodeLabel, n.pos.clone().setY(n.boss ? 4.4 : 4.1), this.camera);
    }
    const total = this.totalStars();
    const land = Math.round(THREE.MathUtils.clamp(this.camTarget.x / LAND_STEP, 0, 3));
    this.game.ui.setTop(`<div class="pill hud-title">${esc(t('story.title'))}</div><div class="pill" style="color:${NODE_CSS[land]}"><b>${esc(t(`story.land.${land}`))}</b></div><div class="pill"><span class="star-icon"></span>${esc(t('story.stars'))} <b>${total}</b> / ${MAX_STARS}</div>`);
    const hint = this.state === 'map' ? `${esc(t('story.hint'))}<br><small>${esc(t('story.joinHint'))}</small>` : '';
    if (this.hintEl.innerHTML !== hint) this.hintEl.innerHTML = hint;
    this.game.ui.bar(this.players, () => '');
  }

  idle(dt) {
    this.updateBeans(dt);
    this.updateCamera(dt);
  }

  onLanguage() {
    if (this.state === 'goal') this.renderGoal();
    if (this.state === 'result') this.renderResult();
    if (this.cards) this.showCard();
  }

  update(dt) {
    // Gentle life on the map: bobbing icons, pulsing selected node, drifting clouds.
    for (const n of this.nodes) {
      n.icon.visible = !this.cards && n.i <= this.maxUnlocked();
      n.icon.rotation.y += dt * (n.i === this.selected ? 2 : 0.6);
      n.icon.position.y = (n.boss ? 1.9 : 2.3) + Math.sin(this.time * 2 + n.i) * 0.15;
      const s = n.i === this.selected && !this.cards ? 1 + Math.sin(this.time * 6) * 0.06 : 1;
      n.rim.scale.set(s, s, 1);
      if (n.miniKing) n.miniKing.update(dt, { hop: 6 });
    }
    for (const tw of this.twinkles || []) tw.scale.setScalar(0.6 + Math.abs(Math.sin(this.time * 2 + tw.userData.phase)) * 0.8);
    for (const c of this.clouds) { c.position.x += dt * 0.4; if (c.position.x > 125) c.position.x = -25; }
    this.updateFlyStars(dt);
    this.updateBeans(dt);
    this.updateCamera(dt);

    if (this.state !== 'leaving') this.handleJoins(dt);
    if (this.state === 'map') this.updateMap(dt);
    else if (this.state === 'card') this.updateCards(dt);
    else if (this.state === 'goal') this.updateGoal(dt);
    else if (this.state === 'result') this.updateResult(dt);
    this.updateLabels();
  }

  dispose() {
    this.cardEl?.remove();
    super.dispose();
  }
}

// ---------- props ----------

function makeFir(rand) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(sharedGeo('stFirTrunk', () => new THREE.CylinderGeometry(0.16, 0.2, 0.7, 6)), toon(COLORS.trunk));
  trunk.position.y = 0.35;
  g.add(trunk);
  for (let i = 0; i < 3; i++) {
    const cone = new THREE.Mesh(sharedGeo(`stFirCone${i}`, () => new THREE.ConeGeometry(1 - i * 0.25, 1.1, 7)), toon(i % 2 ? 0x3fa65a : 0x2f8f4e));
    cone.position.y = 0.9 + i * 0.62;
    cone.castShadow = true;
    const cap = new THREE.Mesh(sharedGeo(`stFirCap${i}`, () => new THREE.ConeGeometry(0.45 - i * 0.1, 0.4, 7)), toon(COLORS.white));
    cap.position.y = 1.32 + i * 0.62;
    g.add(cone, cap);
  }
  g.scale.setScalar(0.9 + rand() * 0.5);
  return g;
}

function makeSnowman() {
  const g = new THREE.Group();
  const ball = (r, y) => {
    const m = new THREE.Mesh(sharedGeo(`snb${r}`, () => new THREE.SphereGeometry(r, 14, 10)), toon(COLORS.white));
    m.position.y = y;
    m.castShadow = true;
    g.add(m);
  };
  ball(0.55, 0.5); ball(0.4, 1.25); ball(0.3, 1.8);
  const nose = new THREE.Mesh(sharedGeo('snNose', () => new THREE.ConeGeometry(0.07, 0.3, 8)), toon(0xff8c42));
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, 1.8, 0.35);
  const scarf = new THREE.Mesh(sharedGeo('snScarf', () => new THREE.TorusGeometry(0.33, 0.08, 6, 16)), toon(0xff5d73));
  scarf.rotation.x = Math.PI / 2;
  scarf.position.y = 1.52;
  g.add(nose, scarf);
  return g;
}

function makeBigCake(i) {
  const g = new THREE.Group();
  const cols = [[0xffd1e0, 0xff8fb8], [0xfff2b0, 0xffe066], [0xcfe0ff, 0x7aa7ff]][i % 3];
  [[0.9, 0.6, 0.3], [0.62, 0.5, 0.85], [0.38, 0.4, 1.3]].forEach(([r, h, y], k) => {
    const m = new THREE.Mesh(sharedGeo(`bc${k}`, () => new THREE.CylinderGeometry(r, r, h, 20)), toon(cols[k % 2]));
    m.position.y = y;
    m.castShadow = true;
    g.add(m);
  });
  const cherry = new THREE.Mesh(sharedGeo('bcCherry', () => new THREE.SphereGeometry(0.14, 10, 8)), toon(0xe63950));
  cherry.position.y = 1.62;
  g.add(cherry);
  return g;
}

function makePot() {
  const g = new THREE.Group();
  const pot = new THREE.Mesh(sharedGeo('stPot', () => new THREE.CylinderGeometry(0.6, 0.5, 0.8, 16)), toon(0x8a94b2));
  pot.position.y = 0.4;
  pot.castShadow = true;
  const soup = new THREE.Mesh(sharedGeo('stSoup', () => new THREE.CylinderGeometry(0.55, 0.55, 0.05, 16)), toon(0xff7a59));
  soup.position.y = 0.78;
  g.add(pot, soup);
  return g;
}

function makeRocketProp(i) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(sharedGeo('rkBody', () => new THREE.CylinderGeometry(0.45, 0.5, 1.8, 14)), toon(COLORS.icing));
  body.position.y = 1.1;
  body.castShadow = true;
  const nose = new THREE.Mesh(sharedGeo('rkNose', () => new THREE.ConeGeometry(0.45, 0.8, 14)), toon(i % 2 ? 0xff5d73 : 0x4cc9f0));
  nose.position.y = 2.4;
  const win = new THREE.Mesh(sharedGeo('rkWin', () => new THREE.CircleGeometry(0.2, 14)), toon(0x8fd8ff));
  win.position.set(0, 1.4, 0.48);
  g.add(body, nose, win);
  for (let k = 0; k < 3; k++) {
    const fin = new THREE.Mesh(sharedGeo('rkFin', () => new THREE.BoxGeometry(0.08, 0.6, 0.5)), toon(i % 2 ? 0xff5d73 : 0x4cc9f0));
    const a = (k / 3) * Math.PI * 2;
    fin.position.set(Math.sin(a) * 0.5, 0.45, Math.cos(a) * 0.5);
    fin.rotation.y = a;
    g.add(fin);
  }
  return g;
}

function injectStyle() {
  if (typeof document === 'undefined' || document.getElementById('story-style')) return;
  const el = document.createElement('style');
  el.id = 'story-style';
  el.textContent = `
.story-card { position: absolute; left: 50%; bottom: 3vh; transform: translateX(-50%); width: min(860px, 92vw);
  background: rgba(255,255,255,0.95); border-radius: 28px; padding: 16px 28px 12px; box-shadow: 0 8px 0 rgba(43,35,64,0.2);
  font-size: clamp(16px, 1.9vw, 30px); font-weight: 600; line-height: 1.3; text-align: left; white-space: normal; }
.story-card.story-anim { animation: story-up 0.35s ease; }
.story-card .speaker { display: inline-block; background: #8a63f0; color: #fff; border-radius: 999px; padding: 2px 14px; font-size: 0.7em; font-weight: 700; margin-bottom: 6px; }
.story-card .line { margin: 2px 0; }
.story-card .line.say { font-weight: 700; color: #5a3fd0; }
.story-card .line.tip { font-size: 0.8em; color: #6b6385; margin-top: 6px; }
.story-card .foot { display: flex; justify-content: space-between; align-items: center; font-size: 0.68em; opacity: 0.85; margin-top: 6px; }
.story-card .dots { display: flex; gap: 6px; }
.story-card .dots i { width: 10px; height: 10px; border-radius: 50%; background: #e4dff0; display: inline-block; }
.story-card .dots i.on { background: #ff6fae; }
.story-card .foot .blink { margin-left: auto; }
@keyframes story-up { from { transform: translate(-50%, 30px); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }
.story-hint { position: absolute; left: 0; right: 0; bottom: 64px; text-align: center; font-weight: 700; line-height: 1.25;
  font-size: clamp(12px, 1.35vw, 21px); paint-order: stroke fill; -webkit-text-stroke: 0.25em #fff; }
.story-hint small { font-size: 0.82em; opacity: 0.85; }
.story-kicker { font-weight: 700; color: var(--c, #8a45e0); font-size: clamp(13px, 1.3vw, 20px); text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 4px; }
.story-goal, .story-result { min-width: min(640px, 92vw); }
.panel .goal-main { font-size: clamp(20px, 2.5vw, 38px); font-weight: 700; color: var(--pink); margin: 10px auto 14px; max-width: 30ch; line-height: 1.15; }
.story-tiers { display: flex; flex-direction: column; gap: 6px; align-items: flex-start; width: fit-content; margin: 0 auto 8px; font-size: clamp(14px, 1.5vw, 24px); font-weight: 600; text-align: left; }
.story-tiers .st { color: #ffc93c; display: inline-block; min-width: 3.6em; text-align: right; margin-right: 0.5em; paint-order: stroke fill; -webkit-text-stroke: 0.1em #c98f00; }
.story-stars { font-size: clamp(50px, 7vw, 110px); letter-spacing: 0.05em; line-height: 1; margin: 6px 0 8px; }
.story-stars span { display: inline-block; color: #e4dff0; }
.story-stars span.on { color: #ffc93c; animation: story-star 0.5s cubic-bezier(.2,1.6,.4,1) both; paint-order: stroke fill; -webkit-text-stroke: 0.04em #c98f00; }
@keyframes story-star { from { transform: scale(0) rotate(-90deg); } to { transform: none; } }
`;
  document.head.appendChild(el);
}
