import * as THREE from 'three';
import { COLORS, toon, basic } from '../../core/palette.js';
import { makeTree, makeRock as makeWorldRock, makeCloud, seeded } from '../../core/world.js';
import { t } from '../../core/i18n.js';
import { W, H, DIRS, MECHS, tileAt, unitAt, intentTiles, attackers, solid } from './rules.js';
import { makeMech, makeBug, makeRock, makeTile, makeMound, makeArrow, THEMES, mesh, geo, glassMat } from './models.js';

// Bean Brigade board view: builds the 8x8 board on its little island, keeps one model per unit, plays
// the rules' event lists as animations (walks, shots, pushes, bumps, poofs, splashes) and draws the
// overlays: cursor, move range, targets, bug intents (red marks and arrows), spawn mounds and the
// weapon preview (damage numbers, push arrows, what pops).

const SPEED = { move: 0.11, push: 0.15, shot: 0.26, hurt: 0.12, die: 0.32, spawn: 0.4, attack: 0.3 };
const RED = 0xff3b54;

export const tileWorld = (x, y, out = new THREE.Vector3()) => out.set(x - (W - 1) / 2, 0, y - (H - 1) / 2);
const dirAngle = (d) => Math.atan2(DIRS[d][0], DIRS[d][1]);

function overlayMat(color, opacity) {
  const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
  m.userData = {};
  return m;
}

export class BoardView {
  constructor(host) {
    this.host = host; // the BreachScene: scene, game.ui, confetti, puffs, camera
    this.root = new THREE.Group();
    host.scene.add(this.root);
    this.units = new Map();
    this.queue = [];
    this.speed = 1;
    this.labels = [];
    this.pvLabels = [];
    this.time = 0;
    this.mats = {
      move: overlayMat(0x3a9cff, 0.55), moveHi: overlayMat(0xbff6ff, 0.85), target: overlayMat(0xff8c1a, 0.55), targetHi: overlayMat(0xffe14a, 0.8),
      area: overlayMat(0xffe14a, 0.55), danger: overlayMat(RED, 0.5), dangerTop: overlayMat(RED, 0.3), line: overlayMat(0xffa630, 0.22),
      path: overlayMat(0x2b8fd8, 0.85), sel: overlayMat(0xffffff, 0.9), zone: overlayMat(0xffffff, 0.5),
      beam: new THREE.MeshBasicMaterial({ color: RED }), beamEdge: new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.BackSide }),
    };
    for (const m of Object.values(this.mats)) m.userData.overlay = true; // reused: never freed with a mesh
  }

  // ---------- building ----------

  /** Build the board for a battle state. theme: THEMES key. objWhat: what the star building is. */
  build(state, theme, objWhat, pilots) {
    this.clear();
    this.theme = THEMES[theme] || THEMES.meadow;
    this.themeName = theme;
    this.objWhat = objWhat;
    this.pilots = pilots;
    this.buildIsland();
    this.tileGroups = [];
    this.tileRoot = new THREE.Group();
    this.root.add(this.tileRoot);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) this.setTile(x, y, tileAt(state, x, y));
    // overlay planes: one per tile for ranges, one for danger, plus rings on tall tiles
    const pg = new THREE.PlaneGeometry(0.92, 0.92).rotateX(-Math.PI / 2);
    this.hl = []; this.dz = []; this.dzTop = [];
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const p = tileWorld(x, y);
        const a = new THREE.Mesh(pg, this.mats.move); a.position.set(p.x, 0.012, p.z); a.visible = false; a.renderOrder = 2;
        const d = new THREE.Mesh(pg, this.mats.danger); d.position.set(p.x, 0.02, p.z); d.visible = false; d.renderOrder = 3;
        const top = new THREE.Mesh(geo.box(1, 1, 1), this.mats.dangerTop); top.position.set(p.x, 0.5, p.z); top.visible = false; top.renderOrder = 4;
        this.root.add(a, d, top);
        this.hl.push(a); this.dz.push(d); this.dzTop.push(top);
      }
    }
    this.cursor = this.makeCursor();
    this.root.add(this.cursor);
    this.selRing = new THREE.Mesh(geo.tor(0.4, 0.04), this.mats.sel);
    this.selRing.rotation.x = -Math.PI / 2;
    this.selRing.visible = false;
    this.root.add(this.selRing);
    this.intentGroup = new THREE.Group();
    this.previewGroup = new THREE.Group();
    this.pathGroup = new THREE.Group();
    this.moundGroup = new THREE.Group();
    this.fxGroup = new THREE.Group();
    this.root.add(this.intentGroup, this.previewGroup, this.pathGroup, this.moundGroup, this.fxGroup);
    this.sync(state);
  }

  buildIsland() {
    const th = this.theme;
    const g = new THREE.Group();
    const rnd = seeded(this.themeName.length * 97 + 3);
    // the cliff block under the board and a wider grassy shelf around it
    g.add(mesh(geo.box(8.4, 1.4, 8.4), th.cliff, 0, -0.97, 0, false));
    const shelf = mesh(geo.box(12.6, 0.9, 10.6), th.side, 0, -1.25, 0.2, false);
    shelf.receiveShadow = true;
    g.add(shelf);
    const rim = mesh(geo.box(12.6, 0.1, 10.6), th.ground[1], 0, -0.76, 0.2, false);
    rim.receiveShadow = true;
    g.add(rim);
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(120, 120).rotateX(-Math.PI / 2), toon(th.sea));
    sea.position.y = -1.6;
    sea.receiveShadow = true;
    g.add(sea);
    this.sea = sea;
    // trees and rocks on the shelf (never on the board)
    for (let i = 0; i < 26; i++) {
      const side = i % 4;
      const along = (rnd() - 0.5) * 11;
      let x, z;
      if (side === 0) { x = -5.4 - rnd() * 0.8; z = along * 0.85; } else if (side === 1) { x = 5.4 + rnd() * 0.8; z = along * 0.85; } else if (side === 2) { x = along; z = -4.8 - rnd() * 0.3; } else { x = along; z = 4.9 + rnd() * 0.4; }
      if (side === 3 && Math.abs(x) < 4.6) continue; // keep the front edge clear
      const obj = rnd() < 0.7 ? makeTree(rnd, 0.55 + rnd() * 0.25, th.leaf) : makeWorldRock(rnd, 0.5 + rnd() * 0.3);
      if (th.snow && obj.children.length > 1) obj.add(mesh(geo.cone(0.4, 0.3, 7), 0xffffff, 0, 1.75, 0, false));
      obj.position.set(x, -0.72, z);
      g.add(obj);
    }
    for (let i = 0; i < 5; i++) {
      const c = makeCloud(rnd, 0.8 + rnd() * 0.6);
      c.position.set(-16 + i * 8 + rnd() * 3, 4 + rnd() * 2, -14 - rnd() * 6);
      g.add(c);
    }
    this.island = g;
    this.root.add(g);
  }

  setTile(x, y, tile) {
    const i = y * W + x;
    const old = this.tileGroups[i];
    if (old) { old.removeFromParent(); disposeTree(old); }
    const g = makeTile(tile, x, y, this.theme, tile.battery ? 'battery' : this.objWhat);
    tileWorld(x, y, g.position);
    this.tileRoot.add(g);
    this.tileGroups[i] = g;
    g.userData.tall = solid(tile) ? (tile.t === 'building' ? 1.05 : 0.85) : 0;
  }

  makeCursor() {
    const g = new THREE.Group();
    const m = overlayMat(0xffd84a, 0.95);
    for (const [x, z, w, d] of [[0, -0.46, 1.0, 0.08], [0, 0.46, 1.0, 0.08], [-0.46, 0, 0.08, 1.0], [0.46, 0, 0.08, 1.0]]) {
      const b = new THREE.Mesh(geo.box(w, 0.05, d), m);
      b.position.set(x, 0.04, z);
      b.renderOrder = 6;
      g.add(b);
    }
    const arrow = new THREE.Mesh(geo.cone(0.12, 0.24, 4), basic(0xffd84a));
    arrow.rotation.x = Math.PI;
    arrow.position.y = 1.5;
    g.add(arrow);
    g.userData.arrow = arrow;
    return g;
  }

  // ---------- units ----------

  makeUnitView(u) {
    let g;
    if (u.side === 'mech') g = makeMech(u.type, MECHS[u.type], this.pilots[u.slot] || { color: 0xffffff });
    else if (u.side === 'bug') g = makeBug(u.type, u.alpha);
    else g = makeRock();
    const v = { id: u.id, side: u.side, type: u.type, g, pos: new THREE.Vector3(), hp: u.hp, maxHp: u.maxHp, label: this.host.game.ui.label('label br-hp'), bob: Math.random() * 6, ko: false, state: {} };
    tileWorld(u.x, u.y, v.pos);
    g.position.copy(v.pos);
    this.root.add(g);
    this.units.set(u.id, v);
    return v;
  }

  removeUnitView(id) {
    const v = this.units.get(id);
    if (!v) return;
    v.g.removeFromParent();
    disposeTree(v.g);
    v.label.remove();
    this.units.delete(id);
  }

  /** Bring every model in line with the state (after animations, rewinds and undos). */
  sync(state) {
    this.state = state;
    const alive = new Set();
    for (const u of state.units) {
      alive.add(u.id);
      let v = this.units.get(u.id);
      if (!v || v.type !== u.type) { if (v) this.removeUnitView(u.id); v = this.makeUnitView(u); }
      tileWorld(u.x, u.y, v.pos);
      v.g.position.copy(v.pos);
      v.g.scale.setScalar(1);
      v.hp = u.hp; v.maxHp = u.maxHp;
      v.u = u;
      // deploying: a mech off the board is hidden (or hangs under the cursor); landing drops it in
      const off = u.x < 0;
      if (v.off && !off) v.drop = 0.28;
      v.off = off;
      v.g.visible = !off;
      this.setStatus(v, u);
    }
    for (const id of [...this.units.keys()]) if (!alive.has(id)) this.removeUnitView(id);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const tl = tileAt(state, x, y);
      const key = JSON.stringify(tl);
      if (this.tileGroups[y * W + x].userData.key !== key) { this.setTile(x, y, tl); this.tileGroups[y * W + x].userData.key = key; }
    }
    this.syncMounds(state);
  }

  syncMounds(state) {
    for (const c of [...this.moundGroup.children]) { c.removeFromParent(); disposeTree(c); }
    for (const sp of state.spawns) {
      const m = makeMound(sp.egg);
      tileWorld(sp.x, sp.y, m.position);
      m.userData.sp = sp;
      this.moundGroup.add(m);
    }
  }

  /** Shield bubble, flames, KO tilt and floaties on a unit model. */
  setStatus(v, u) {
    const st = v.state;
    const want = { shield: !!u.shield, fire: !!u.fire, ko: !!u.ko, wet: !!u.wet };
    if (want.shield !== !!st.shield) {
      if (st.shield) { st.shield.removeFromParent(); disposeTree(st.shield); st.shield = null; }
      if (want.shield) { st.shield = new THREE.Mesh(geo.sph(0.55, 16, 12), glassMat(0x8fd8ff, 0.32)); st.shield.position.y = 0.45; v.g.add(st.shield); }
    }
    if (want.fire !== !!st.fire) {
      if (st.fire) { st.fire.removeFromParent(); st.fire = null; }
      if (want.fire) {
        st.fire = new THREE.Group();
        for (let i = 0; i < 3; i++) st.fire.add(mesh(geo.cone(0.08, 0.24, 6), basic(i % 2 ? 0xff8c42 : 0xffd23f), (i - 1) * 0.16, 0.9, 0.1, false));
        v.g.add(st.fire);
      }
    }
    if (want.wet !== !!st.wet) {
      if (st.wet) { st.wet.removeFromParent(); st.wet = null; }
      if (want.wet) { st.wet = mesh(geo.tor(0.38, 0.09), 0xff9f1c, 0, 0.12, 0); st.wet.rotation.x = Math.PI / 2; v.g.add(st.wet); }
    }
    if (want.ko !== !!st.ko) {
      if (st.ko) { st.ko.removeFromParent(); st.ko = null; }
      if (want.ko) {
        st.ko = new THREE.Group();
        for (let i = 0; i < 3; i++) st.ko.add(mesh(geo.ico(0.07, 0), basic(COLORS.gold), Math.cos(i * 2.1) * 0.25, 1.15, Math.sin(i * 2.1) * 0.25, false));
        v.g.add(st.ko);
      }
    }
    st.koOn = want.ko;
    if (v.g.userData.body) v.g.userData.body.rotation.z = want.ko ? 0.35 : 0;
  }

  // ---------- overlays ----------

  /** Deploying: the mech with this id hangs over tile (x, y), ready to land (null: none). */
  setHover(id, x, y) {
    this.hover = id ? { id, x, y } : null;
  }

  setCursor(x, y, show = true) {
    this.cursor.visible = show;
    tileWorld(x, y, this.cursor.position);
    this.cursorTile = [x, y];
  }

  setSelected(id) {
    const v = id ? this.units.get(id) : null;
    this.selId = id;
    this.selRing.visible = !!v;
  }

  /** tiles: [[x, y, kind]] with kind move | moveHi | target | targetHi | area | line | zone (landing). */
  setHighlights(tiles) {
    for (const m of this.hl) m.visible = false;
    for (const [x, y, kind] of tiles) {
      const m = this.hl[y * W + x];
      m.material = this.mats[kind] || this.mats.move;
      m.visible = true;
    }
  }

  setPath(path) {
    clearGroup(this.pathGroup);
    if (!path) return;
    for (let i = 0; i < path.length; i++) {
      const p = tileWorld(path[i][0], path[i][1]);
      const dot = new THREE.Mesh(geo.sph(i === path.length - 1 ? 0.12 : 0.07, 8, 6), this.mats.path);
      dot.position.set(p.x, 0.08, p.z);
      this.pathGroup.add(dot);
    }
  }

  /**
   * Bug intents from a state: red tiles always; arrows (and numbers) for all bugs or only for
   * the bug with id focus. Returns the label data for the HUD.
   */
  setIntents(state, { all = true, focus = null, hide = false } = {}) {
    clearGroup(this.intentGroup);
    for (const m of this.dz) m.visible = false;
    for (const m of this.dzTop) m.visible = false;
    this.intentInfo = [];
    if (hide) return;
    const list = attackers(state);
    list.forEach((b, order) => {
      const tiles = intentTiles(state, b);
      const show = all || focus === b.id || tiles.some((h) => focus === `t${h.x},${h.y}`);
      for (const h of tiles) {
        if (h.n <= 0 && !h.fire) continue;
        const i = h.y * W + h.x;
        this.dz[i].visible = true;
        const tall = this.tileGroups[i].userData.tall || (unitAt(state, h.x, h.y) ? 0.95 : 0);
        if (tall) { const b = this.dzTop[i]; b.visible = true; b.scale.set(0.96, tall, 0.96); b.position.y = tall / 2; }
      }
      this.intentInfo.push({ id: b.id, order: order + 1, show, tiles });
      if (!show || !tiles.length) return;
      this.drawIntentArrow(state, b, tiles);
    });
  }

  drawIntentArrow(state, b, tiles) {
    const from = tileWorld(b.x, b.y);
    const kind = { beetle: 'melee', spitter: 'spit', burrower: 'sweep', firefly: 'flame', boomer: 'boom', queen: 'royal' }[b.type];
    if (kind === 'boom') {
      for (const h of tiles) this.beam(this.intentGroup, from, tileWorld(h.x, h.y), RED, 0.3, 0.12, 0.35);
      return;
    }
    const main = tiles[0];
    const to = tileWorld(main.x, main.y);
    if (kind === 'royal') {
      this.arc(this.intentGroup, from, to, RED);
      for (const h of tiles.slice(1)) this.flatArrow(this.intentGroup, to, tileWorld(h.x, h.y), 0xffffff, 0.3, 0.75, 0.6);
      return;
    }
    this.beam(this.intentGroup, from, to, RED, 0.3, 0.1, kind === 'spit' ? 0.5 : 0.42);
    if (kind === 'sweep') for (const h of tiles.slice(1)) this.beam(this.intentGroup, from, tileWorld(h.x, h.y), RED, 0.36, 0.2, 0.3);
  }

  /** A raised 3D arrow (shaft and head) from a to b, easy to see over the board. */
  beam(group, a, b, color, trimA, trimB, y) {
    const dx = b.x - a.x, dz = b.z - a.z;
    const L = Math.hypot(dx, dz);
    if (L < 0.01) return;
    const ux = dx / L, uz = dz / L;
    const len = Math.max(0.2, L - trimA - trimB);
    const mat = this.mats.beam;
    const g = new THREE.Group();
    const shaftLen = Math.max(0.05, len - 0.22);
    const shaft = new THREE.Mesh(geo.cyl(0.05, 0.05, 1, 8), mat);
    shaft.scale.y = shaftLen;
    shaft.rotation.x = Math.PI / 2;
    shaft.position.z = shaftLen / 2;
    const head = new THREE.Mesh(geo.cone(0.13, 0.24, 10), mat);
    head.rotation.x = Math.PI / 2;
    head.position.z = shaftLen + 0.11;
    const ring = new THREE.Mesh(geo.cyl(0.075, 0.075, 1, 8), this.mats.beamEdge);
    ring.scale.y = shaftLen;
    ring.rotation.x = Math.PI / 2;
    ring.position.z = shaftLen / 2;
    g.add(ring, shaft, head);
    g.position.set(a.x + ux * trimA, y, a.z + uz * trimA);
    g.rotation.y = Math.atan2(ux, uz);
    for (const m of g.children) m.renderOrder = 7;
    group.add(g);
  }

  /** A flat arrow from a to b (world positions); start/end trimmed so it sits between tile centers. */
  flatArrow(group, a, b, color, trimA = 0.2, trimB = 0.1, opacity = 0.92) {
    const dx = b.x - a.x, dz = b.z - a.z;
    const L = Math.hypot(dx, dz);
    if (L < 0.01) return null;
    const len = Math.max(0.3, L - trimA - trimB);
    const arr = makeArrow(color, len, { opacity });
    arr.position.set(a.x + (dx / L) * trimA, 0.07, a.z + (dz / L) * trimA);
    arr.rotation.y = Math.atan2(-dx, -dz);
    group.add(arr);
    return arr;
  }

  arc(group, a, b, color) {
    const mid = a.clone().lerp(b, 0.5);
    mid.y = 1.6 + a.distanceTo(b) * 0.25;
    const curve = new THREE.QuadraticBezierCurve3(a.clone().setY(0.6), mid, b.clone().setY(0.1));
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 20, 0.05, 6, false), overlayMat(color, 0.85));
    tube.renderOrder = 5;
    group.add(tube);
    const head = new THREE.Mesh(geo.cone(0.12, 0.26, 8), overlayMat(color, 0.9));
    head.position.copy(b).setY(0.25);
    head.rotation.x = Math.PI;
    group.add(head);
  }

  /** Show a weapon preview: diff (rules.diffStates), its events, and the state after. */
  setPreview(pv) {
    clearGroup(this.previewGroup);
    for (const l of this.pvLabels) l.style.display = 'none';
    this.pvHp = new Map();
    this.pvUsed = 0;
    if (!pv) return;
    const { diff, ev, after } = pv;
    const hitTiles = new Map();
    for (const e of ev) if (e.k === 'hit') hitTiles.set(`${e.x},${e.y}`, true);
    for (const u of diff.units) {
      const at = tileWorld(u.x, u.y);
      if (u.to) {
        const to = tileWorld(u.to[0], u.to[1]);
        this.flatArrow(this.previewGroup, at, to, 0xffffff, 0.12, 0.08, 0.95);
      }
      const end = u.to ? tileWorld(u.to[0], u.to[1]) : at;
      if (u.gone) {
        const wet = ev.some((e) => e.k === 'die' && e.id === u.id && e.how === 'drown');
        const v = this.units.get(u.id);
        this.pvLabel(wet ? t('breach.p.sink') : v?.side === 'rock' ? t('breach.p.pop') : t('breach.p.poof'), ev.find((e) => e.k === 'die' && e.id === u.id) || u, 'pv-poof');
        this.pvHp.set(u.id, 0);
      } else if (u.ko) { this.pvLabel(t('breach.p.ko'), { x: u.to?.[0] ?? u.x, y: u.to?.[1] ?? u.y }, 'pv-bad'); this.pvHp.set(u.id, 0); }
      else if (u.dmg > 0) { this.pvLabel(`-${u.dmg}`, { x: u.to?.[0] ?? u.x, y: u.to?.[1] ?? u.y }, 'pv-dmg'); this.pvHp.set(u.id, u.hp); }
      else if (u.dmg < 0) { this.pvLabel(t('breach.p.heal'), { x: u.x, y: u.y }, 'pv-good'); this.pvHp.set(u.id, u.hp); }
      if (u.shield === true) this.pvLabel(t('breach.p.shield'), { x: u.x, y: u.y }, 'pv-good');
      if (u.fire) this.pvLabel(t('breach.p.fire'), { x: u.to?.[0] ?? u.x, y: u.to?.[1] ?? u.y }, 'pv-bad', 0.35);
      void end;
    }
    for (const e of ev) {
      if (e.k !== 'bump') continue;
      this.pvLabel(t('breach.p.bonk'), { x: e.x, y: e.y }, 'pv-bonk', 0.3);
      // a stubby arrow: it gets pushed, but bonks into whatever is in the way
      const u = diff.units.find((d) => d.id === e.id) || after.units.find((d) => d.id === e.id);
      if (u) { const a = tileWorld(u.to?.[0] ?? u.x, u.to?.[1] ?? u.y), b = tileWorld(e.x, e.y); this.flatArrow(this.previewGroup, a, a.clone().lerp(b, 0.62), 0xffd84a, 0.1, 0, 0.95); }
    }
    for (const b of diff.born) if (b.side === 'rock') this.pvLabel(t('breach.p.rock'), b, 'pv-good');
    for (const tl of diff.tiles) {
      if (tl.power > 0) this.pvLabel(t('breach.p.power', { n: tl.power }), tl, 'pv-power', 0.9);
      else if (tl.to.shield && !tl.from.shield) this.pvLabel(t('breach.p.shield'), tl, 'pv-good', 0.9);
      else if (tl.to.smoke && !tl.from.smoke) this.pvLabel(t('breach.p.smoke'), tl, 'pv-info', 0.1);
      else if (tl.to.fire && !tl.from.fire) this.pvLabel(t('breach.p.fire'), tl, 'pv-bad', 0.1);
    }
    this.setHighlightsExtra([...hitTiles.keys()].map((k) => k.split(',').map(Number)));
    // where the bugs will attack after this
    this.setIntents(after, { all: this.intentsAll, focus: null });
  }

  /** Yellow flashes on the tiles an attack touches (on top of the target range). */
  setHighlightsExtra(tiles) {
    for (const [x, y] of tiles) {
      const m = this.hl[y * W + x];
      m.material = this.mats.area;
      m.visible = true;
    }
  }

  pvLabel(text, at, cls, up = 0.6) {
    let el = this.pvLabels[this.pvUsed];
    if (!el) { el = this.host.game.ui.label('label br-pv'); this.pvLabels.push(el); }
    this.pvUsed++;
    el.className = `label br-pv ${cls}`;
    el.textContent = text;
    el.style.display = '';
    el.userData = { x: at.x, y: at.y, up: up + 0.25 * (this.pvLabels.slice(0, this.pvUsed - 1).filter((o) => o.style.display !== 'none' && o.userData?.x === at.x && o.userData?.y === at.y).length) };
  }

  // ---------- events → animations ----------

  get busy() {
    return this.queue.length > 0;
  }

  /** Animate a list of rules events, then sync to state and call done. */
  play(events, state, done) {
    for (const e of events) this.queue.push({ e, t: 0, started: false, dur: this.durOf(e) });
    this.after = { state, done };
    if (!this.queue.length) this.finishQueue();
  }

  durOf(e) {
    switch (e.k) {
      case 'move': return SPEED.move * (e.path.length - 1) + 0.05;
      case 'jump': case 'dash': return 0.26;
      case 'push': case 'pull': return SPEED.push;
      case 'swap': return 0.4;
      case 'bump': return 0.2;
      case 'shot': return e.style === 'lob' || e.style === 'boulder' || e.style === 'bubble' ? 0.42 : e.style === 'laser' ? 0.3 : SPEED.shot;
      case 'swing': return 0.16;
      case 'attack': return SPEED.attack;
      case 'hurt': return SPEED.hurt;
      case 'die': return SPEED.die;
      case 'ko': return 0.3;
      case 'spawn': return SPEED.spawn;
      case 'blocked': return 0.3;
      case 'rock': return 0.25;
      case 'power': return 0.18;
      case 'boom': return 0.25;
      case 'fizzle': return 0.3;
      case 'burnTick': return 0.15;
      case 'repair': return 0.3;
      case 'egg': return 0.2;
      case 'crate': return 0.25;
      case 'phase': return e.phase === 'enemy' ? 0.3 : 0.05;
      default: return 0.02;
    }
  }

  finishQueue() {
    const a = this.after;
    this.after = null;
    this.fxClear();
    if (a?.state) this.sync(a.state);
    a?.done?.();
  }

  fxClear() {
    clearGroup(this.fxGroup);
  }

  startEvent(q) {
    const e = q.e;
    const v = e.id ? this.units.get(e.id) : null;
    const audio = this.host.game.audio;
    const sfx = (n) => this.host.sfx?.(n);
    q.v = v;
    switch (e.k) {
      case 'move': case 'jump': case 'dash':
        q.path = e.path.map(([x, y]) => tileWorld(x, y));
        sfx(e.k === 'move' ? 'step' : 'dash');
        break;
      case 'push': case 'pull':
        if (v) { q.from = v.pos.clone(); q.to = tileWorld(e.x, e.y); }
        sfx('push');
        break;
      case 'swap': {
        q.a = tileWorld(...e.a); q.b = tileWorld(...e.b);
        q.o = e.other ? this.units.get(e.other) : null;
        sfx('swap');
        break;
      }
      case 'bump': if (v) { q.from = v.pos.clone(); q.to = tileWorld(e.x, e.y); } break;
      case 'shot': this.startShot(q); break;
      case 'swing': if (v) { q.from = v.pos.clone(); q.to = tileWorld(e.x, e.y); this.faceTo(v, q.to); } sfx('swing'); break;
      case 'attack': {
        if (v) { const p = e.tiles[0] ? tileWorld(...e.tiles[0]) : v.pos; q.from = v.pos.clone(); q.to = p; this.faceTo(v, p); }
        if (e.kind === 'spit' && e.tiles[0]) this.startShot({ ...q, e: { style: 'goo', from: null, to: e.tiles[0] }, v }, q);
        if (e.kind === 'royal' && e.tiles[0]) this.startShot({ ...q, e: { style: 'royal', to: e.tiles[0] }, v }, q);
        sfx(e.kind === 'boom' ? 'boom' : e.kind === 'flame' ? 'flame' : 'bugAttack');
        break;
      }
      case 'hurt':
        if (v) { v.hp = e.hp; v.flash = 0.25; this.floatText(`-${e.n}`, v.pos, 'fx-dmg'); }
        sfx('hit');
        break;
      case 'hit':
        if (e.n > 0) { const p = tileWorld(e.x, e.y); this.host.puffs.burst(p.clone().setY(0.4), 0xffffff, { count: 6, size: 0.35, life: 0.4, speed: 2 }); }
        break;
      case 'die': {
        const p = tileWorld(e.x, e.y);
        if (e.how === 'drown') { this.host.puffs.burst(p.clone().setY(0.1), 0x8fd8ff, { count: 16, size: 0.4, life: 0.7, speed: 3 }); sfx('splash'); this.floatText(t('breach.p.sink'), p, 'fx-poof'); }
        else {
          this.host.puffs.burst(p.clone().setY(0.4), 0xffffff, { count: 18, size: 0.5, life: 0.6, speed: 4 });
          this.host.confetti.burst(p.clone().setY(0.6), 0, { count: 22, speed: 5, up: 4, life: 0.9, gravity: -9, size: 0.12, colors: [0xffd23f, 0xff9fd0, 0x9ff0c8, 0xffffff] });
          sfx('poof');
          if (v?.side === 'bug') this.floatText(t('breach.p.poof'), p, 'fx-poof');
        }
        break;
      }
      case 'ko': if (v) { this.floatText(t('breach.p.ko'), v.pos, 'fx-bad'); v.hp = 0; } sfx('ko'); break;
      case 'spawn': {
        this.removeMoundAt(e.x, e.y);
        const nv = this.makeUnitView({ id: e.id, side: 'bug', type: e.type, alpha: e.alpha, x: e.x, y: e.y, hp: 1, maxHp: 1 });
        nv.rising = 0;
        nv.g.position.y = -0.8;
        q.v = nv;
        const p = tileWorld(e.x, e.y);
        this.host.puffs.burst(p.clone().setY(0.2), 0x8a5a32, { count: 12, size: 0.35, life: 0.6, speed: 3 });
        sfx('dig');
        break;
      }
      case 'blocked': {
        const p = tileWorld(e.x, e.y);
        this.removeMoundAt(e.x, e.y);
        this.host.puffs.burst(p.clone().setY(0.2), 0x8a5a32, { count: 10, size: 0.3, life: 0.5, speed: 3 });
        this.floatText(t('breach.p.bonk'), p, 'fx-bonk');
        sfx('bump');
        break;
      }
      case 'rock': {
        if (!this.units.get(e.id)) {
          const nv = this.makeUnitView({ id: e.id, side: 'rock', type: 'rock', x: e.x, y: e.y, hp: e.hp, maxHp: e.hp });
          nv.g.position.y = 2;
          q.v = nv;
        }
        break;
      }
      case 'tile': {
        this.setTile(e.x, e.y, e.tile);
        this.tileGroups[e.y * W + e.x].userData.key = JSON.stringify(e.tile);
        break;
      }
      case 'power': {
        const p = tileWorld(e.x, e.y);
        this.floatText(t('breach.p.power', { n: e.n }), p.clone().setY(0.6), 'fx-power');
        this.host.puffs.burst(p.clone().setY(0.6), 0xffe14a, { count: 10, size: 0.3, life: 0.5, speed: 3 });
        this.host.onPower?.(e.power);
        sfx('powerDown');
        break;
      }
      case 'shield': if (v) this.setStatus(v, { ...v.u, shield: true }); sfx('bubble'); break;
      case 'shieldPop': if (v) this.setStatus(v, { ...v.u, shield: false }); audio.play('pop'); break;
      case 'burn': if (v) this.setStatus(v, { ...v.u, fire: true, shield: false }); sfx('flame'); break;
      case 'douse': if (v) this.setStatus(v, { ...v.u, fire: false }); break;
      case 'splash': if (v) { this.setStatus(v, { ...v.u, wet: true }); this.host.puffs.burst(v.pos.clone(), 0x8fd8ff, { count: 12, size: 0.35, life: 0.5, speed: 3 }); } sfx('splash'); break;
      case 'crate': this.host.confetti.burst(tileWorld(e.x, e.y).setY(0.8), 0, { count: 30, speed: 5, up: 5, life: 1, gravity: -8, size: 0.12, colors: [0xffd23f, 0xffffff] }); audio.play('star'); break;
      case 'boom': { const p = tileWorld(e.x, e.y); this.host.puffs.burst(p.clone().setY(0.4), 0xb7ff6a, { count: 24, size: 0.55, life: 0.7, speed: 5 }); sfx('boom'); break; }
      case 'fizzle': if (v) { this.host.puffs.burst(v.pos.clone().setY(0.6), 0xdddddd, { count: 8, size: 0.3, life: 0.5, speed: 2 }); this.floatText('?', v.pos, 'fx-info'); } break;
      case 'burnTick': if (v) this.host.puffs.burst(v.pos.clone().setY(0.6), 0xff8c42, { count: 8, size: 0.3, life: 0.4, speed: 2 }); break;
      case 'repair': if (v) { v.hp = e.hp; this.floatText(t('breach.p.heal'), v.pos, 'fx-good'); this.setStatus(v, { ...v.u, fire: false }); } audio.play('rescue'); break;
      case 'egg': sfx('egg'); break;
      case 'phase': this.host.onPhase?.(e); break;
      default:
    }
  }

  removeMoundAt(x, y) {
    for (const m of [...this.moundGroup.children]) if (m.userData.sp.x === x && m.userData.sp.y === y) { m.removeFromParent(); disposeTree(m); }
  }

  faceTo(v, p) {
    const dx = p.x - v.pos.x, dz = p.z - v.pos.z;
    if (Math.abs(dx) + Math.abs(dz) < 0.01) return;
    v.g.rotation.y = Math.atan2(dx, dz);
  }

  startShot(q, parent = null) {
    const e = q.e;
    const v = q.v;
    const from = (v ? v.pos.clone() : tileWorld(...e.from)).setY(0.55);
    const to = tileWorld(...e.to).setY(0.4);
    if (v) this.faceTo(v, to);
    let obj;
    const style = e.style;
    if (style === 'laser') {
      const L = from.distanceTo(to);
      obj = new THREE.Mesh(geo.cyl(0.07, 0.07, 1, 8), basic(0xff9fd0));
      obj.scale.set(1, L, 1);
      obj.position.copy(from).lerp(to, 0.5);
      obj.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize());
    } else if (style === 'hook') {
      obj = new THREE.Group();
      obj.add(mesh(geo.tor(0.1, 0.03, Math.PI * 1.3), 0xd0d0e0, 0, 0, 0, false));
    } else if (style === 'boulder') obj = mesh(geo.ico(0.22, 0), 0xa9a4bf, 0, 0, 0, false);
    else if (style === 'bubble') obj = new THREE.Mesh(geo.sph(0.18, 12, 10), glassMat(0x8fd8ff, 0.6));
    else if (style === 'goo' || style === 'royal') obj = mesh(geo.sph(style === 'royal' ? 0.2 : 0.12, 10, 8), toon(0xb7ff6a, { emissive: 0x224400 }), 0, 0, 0, false);
    else obj = mesh(geo.sph(0.11, 10, 8), 0x2b2340, 0, 0, 0, false);
    this.fxGroup.add(obj);
    const shot = { obj, from, to, style, arc: style === 'lob' || style === 'boulder' || style === 'bubble' || style === 'royal' };
    (parent || q).shot = shot;
    this.host.sfx?.(style === 'laser' ? 'laser' : shot.arc ? 'lob' : style === 'hook' ? 'hook' : style === 'goo' ? 'spit' : 'shoot');
  }

  stepEvent(q, k, dt) {
    const e = q.e;
    const v = q.v;
    switch (e.k) {
      case 'move': case 'jump': case 'dash': {
        if (!v || !q.path) break;
        const n = q.path.length - 1;
        if (e.k === 'move') {
          const f = Math.min(n, k * n);
          const i = Math.min(n - 1, Math.floor(f));
          const a = q.path[i], b = q.path[i + 1] || a;
          v.pos.lerpVectors(a, b, f - i);
          this.faceTo(v, b);
          v.g.position.copy(v.pos);
          v.g.position.y = Math.abs(Math.sin(f * Math.PI)) * 0.12;
        } else {
          const a = q.path[0], b = q.path[n];
          v.pos.lerpVectors(a, b, k);
          this.faceTo(v, b);
          v.g.position.copy(v.pos);
          v.g.position.y = Math.sin(k * Math.PI) * (e.k === 'jump' ? 0.8 : 0.35);
        }
        break;
      }
      case 'push': case 'pull':
        if (v && q.from) { v.pos.lerpVectors(q.from, q.to, k); v.g.position.copy(v.pos); }
        break;
      case 'swap': {
        const s = k < 0.5 ? 1 - k * 2 : (k - 0.5) * 2;
        if (k >= 0.5 && !q.swapped) {
          q.swapped = true;
          if (v) v.pos.copy(q.b);
          if (q.o) q.o.pos.copy(q.a);
          this.host.puffs.burst(q.a.clone().setY(0.4), 0xc9a8ff, { count: 8, size: 0.3, life: 0.4, speed: 2 });
          this.host.puffs.burst(q.b.clone().setY(0.4), 0xc9a8ff, { count: 8, size: 0.3, life: 0.4, speed: 2 });
        }
        for (const u of [v, q.o]) if (u) { u.g.position.copy(u.pos); u.g.scale.setScalar(Math.max(0.05, s)); }
        break;
      }
      case 'bump':
        if (v && q.from) {
          const f = Math.sin(k * Math.PI) * 0.3;
          v.g.position.lerpVectors(q.from, q.to, f);
          if (k > 0.5 && !q.bonked) {
            q.bonked = true;
            const mid = q.from.clone().lerp(q.to, 0.5).setY(0.5);
            this.host.confetti.burst(mid, 0, { count: 10, speed: 4, up: 2, life: 0.5, gravity: -8, size: 0.1, colors: [0xffd23f, 0xffffff] });
            this.floatText(t('breach.p.bonk'), mid, 'fx-bonk');
            this.host.game.audio.play('bump');
          }
        }
        break;
      case 'swing':
        if (v && q.from) v.g.position.lerpVectors(q.from, q.to, Math.sin(k * Math.PI) * 0.35);
        break;
      case 'attack':
        if (v && q.from) {
          if (e.kind === 'boom') v.g.scale.setScalar(1 + k * 0.6);
          else v.g.position.lerpVectors(q.from, q.to, Math.sin(k * Math.PI) * 0.3);
        }
        break;
      case 'spawn':
        if (v) v.g.position.y = -0.8 + 0.8 * k;
        break;
      case 'rock':
        if (v) v.g.position.y = 2 * (1 - k * k);
        break;
      case 'die':
        if (v) {
          if (e.how === 'drown') v.g.position.y = -k * 0.8;
          else v.g.scale.setScalar(Math.max(0.01, 1 - k));
        }
        break;
      case 'ko':
        if (v?.g.userData.body) v.g.userData.body.rotation.z = 0.35 * k;
        break;
      default:
    }
    if (q.shot) this.stepShot(q.shot, Math.min(1, k * 1.15));
    void dt;
  }

  stepShot(s, k) {
    if (s.style === 'laser') { s.obj.material = basic(k < 0.8 ? 0xff9fd0 : 0xffffff); s.obj.scale.x = s.obj.scale.z = 1 - k * 0.7; return; }
    s.obj.position.lerpVectors(s.from, s.to, k);
    if (s.arc) s.obj.position.y += Math.sin(k * Math.PI) * (1.4 + s.from.distanceTo(s.to) * 0.18);
    if (s.style === 'hook') s.obj.rotation.y += 0.4;
  }

  endEvent(q) {
    const e = q.e;
    const v = q.v;
    if (q.shot) { q.shot.obj.removeFromParent(); disposeTree(q.shot.obj); q.shot = null; }
    switch (e.k) {
      case 'move': case 'jump': case 'dash': if (v) { const [x, y] = e.path[e.path.length - 1]; tileWorld(x, y, v.pos); v.g.position.copy(v.pos); } break;
      case 'push': case 'pull': if (v) { v.pos.copy(q.to); v.g.position.copy(v.pos); } break;
      case 'bump': case 'swing': case 'attack': if (v) { v.g.position.copy(v.pos); if (e.kind !== 'boom') v.g.scale.setScalar(v.g.userData.baseScale || 1); } break;
      case 'swap': for (const u of [v, q.o]) if (u) { u.g.position.copy(u.pos); u.g.scale.setScalar(1); } break;
      case 'spawn': case 'rock': if (v) v.g.position.y = 0; break;
      case 'die': this.removeUnitView(e.id); break;
      default:
    }
  }

  floatText(text, pos, cls) {
    const el = this.host.game.ui.label(`label br-fx ${cls}`);
    el.textContent = text;
    this.labels.push({ el, pos: pos.clone().setY((pos.y || 0) + 1.1), t: 0 });
  }

  // ---------- per frame ----------

  update(dt, camera) {
    this.time += dt;
    // events
    let budget = dt * this.speed;
    while (this.queue.length && budget > 0) {
      const q = this.queue[0];
      if (!q.started) { q.started = true; this.startEvent(q); }
      const use = Math.min(budget, q.dur - q.t);
      q.t += use;
      budget -= use;
      this.stepEvent(q, q.dur > 0 ? q.t / q.dur : 1, use);
      if (q.t >= q.dur - 1e-6) {
        this.endEvent(q);
        this.queue.shift();
        if (!this.queue.length) this.finishQueue();
        if (use <= 0) break;
      } else break;
    }
    // idle life
    const T = this.time;
    for (const v of this.units.values()) {
      const ud = v.g.userData;
      if (v.side === 'mech') {
        ud.pilot?.update(dt, {});
        if (!v.state.koOn && ud.body) ud.body.position.y = Math.sin(T * 2.2 + v.bob) * 0.025 + (MECHS[v.type].flying ? 0.18 + Math.sin(T * 3 + v.bob) * 0.05 : 0);
        if (ud.spin) ud.spin.rotation.y += dt * (v.type === 'puff' ? 14 : 3);
        if (v.state.ko) v.state.ko.rotation.y += dt * 3;
      } else if (v.side === 'bug') {
        if (ud.body) {
          ud.body.position.y = ud.hover ? 0.12 + Math.sin(T * 4 + v.bob) * 0.06 : Math.abs(Math.sin(T * 3 + v.bob)) * 0.03;
          ud.body.rotation.z = Math.sin(T * 2.4 + v.bob) * 0.05;
        }
        if (ud.wings) ud.wings.forEach((w, i) => { w.rotation.x = Math.sin(T * 30 + i) * 0.5; });
        if (ud.drill) ud.drill.rotation.y += dt * 8;
        if (ud.spark) ud.spark.scale.setScalar(0.7 + Math.abs(Math.sin(T * 12)) * 0.6);
        if (ud.sac) ud.sac.scale.setScalar(1 + Math.sin(T * 3 + v.bob) * 0.06);
        const b = this.state?.units.find((u) => u.id === v.id);
        if (b?.intent && !this.busy) v.g.rotation.y += (dirAngle(b.intent.d) - v.g.rotation.y) * Math.min(1, dt * 8);
      }
      if (v.off) { // waiting to land: hangs over the cursor like a claw-machine toy, else hidden
        const hv = this.hover?.id === v.id ? this.hover : null;
        v.g.visible = !!hv;
        if (hv) { tileWorld(hv.x, hv.y, v.g.position); v.g.position.y = 0.32 + Math.sin(T * 3) * 0.06; }
      } else if (v.drop > 0) {
        v.drop -= dt;
        v.g.position.y = Math.max(0, v.drop) / 0.28 * 0.32;
        if (v.drop <= 0) { v.g.position.y = 0; this.host.puffs?.burst(v.g.position.clone().setY(0.15), 0xffffff, { count: 10, size: 0.35, life: 0.45, speed: 2.4 }); }
      }
      if (v.flash > 0) { v.flash -= dt; v.g.scale.setScalar(1 + Math.sin(v.flash * 40) * 0.06); if (v.flash <= 0) v.g.scale.setScalar(1); }
    }
    for (const g of this.tileGroups || []) {
      for (const a of g.userData.anim) {
        if (a.kind === 'wave') a.obj.position.y = -0.2 + Math.sin(T * 1.5 + a.ph) * 0.02;
        else if (a.kind === 'blades') a.obj.rotation.z += dt * 1.2;
        else if (a.kind === 'orb') a.obj.scale.setScalar(1 + Math.sin(T * 3) * 0.08);
        else if (a.kind === 'flame') a.obj.scale.set(1, 0.8 + Math.abs(Math.sin(T * 9 + a.ph)) * 0.5, 1);
        else if (a.kind === 'puff') a.obj.position.y = a.y + Math.sin(T * 1.6 + a.ph) * 0.05;
        else if (a.kind === 'spin') a.obj.rotation.y += dt * 2;
        else if (a.kind === 'bubble') a.obj.scale.setScalar(1 + Math.sin(T * 2.5) * 0.03);
      }
    }
    for (const m of this.moundGroup?.children || []) m.scale.set(1 + Math.sin(T * 6 + m.position.x) * 0.06, 1 + Math.sin(T * 6 + m.position.x + 1) * 0.1, 1);
    this.mats.danger.opacity = 0.42 + Math.sin(T * 5) * 0.14;
    this.mats.zone.opacity = 0.42 + Math.sin(T * 2.5) * 0.12;
    this.mats.dangerTop.opacity = 0.26 + Math.sin(T * 5) * 0.1;
    if (this.cursor) {
      this.cursor.userData.arrow.position.y = 1.45 + Math.sin(T * 5) * 0.1;
      this.cursor.userData.arrow.visible = !this.cursorHideArrow;
      const s = 1 + Math.sin(T * 6) * 0.03;
      this.cursor.scale.set(s, 1, s);
    }
    if (this.selRing?.visible) {
      const v = this.units.get(this.selId);
      if (v) this.selRing.position.set(v.g.position.x, 0.06, v.g.position.z);
      this.selRing.rotation.z += dt;
    }
    this.updateLabels(camera, dt);
  }

  updateLabels(camera, dt) {
    const ui = this.host.game.ui;
    const _p = new THREE.Vector3();
    for (const v of this.units.values()) {
      if (!this.labelsOn || v.off) { v.label.style.display = 'none'; continue; }
      const info = this.intentInfo?.find((i) => i.id === v.id);
      const pv = this.pvHp?.get(v.id);
      const max = Math.max(v.maxHp, v.hp);
      let pips = '';
      for (let i = 0; i < max; i++) {
        const on = i < v.hp;
        const lose = pv !== undefined && on && i >= pv;
        const gain = pv !== undefined && !on && i < pv;
        pips += `<i class="${lose ? 'lose' : gain ? 'gain' : on ? 'on' : ''}"></i>`;
      }
      const order = info && info.show && this.intentsAll !== false ? `<b>${info.order}</b>` : '';
      const html = `${order}<span class="${v.side}">${pips}</span>`;
      if (v.labelHtml !== html) { v.label.innerHTML = html; v.labelHtml = html; }
      if (v.side === 'rock' && v.hp <= 1 && pv === undefined) { v.label.style.display = 'none'; continue; }
      _p.copy(v.g.position).setY(v.g.position.y + (v.type === 'queen' ? 1.75 : v.side === 'rock' ? 0.85 : 1.15));
      ui.place(v.label, _p, camera);
    }
    for (const el of this.pvLabels) {
      if (el.style.display === 'none' || !el.userData) continue;
      tileWorld(el.userData.x, el.userData.y, _p).setY(el.userData.up + 0.6);
      ui.place(el, _p, camera);
    }
    this.labels = this.labels.filter((l) => {
      l.t += dt;
      if (l.t > 1.1) { l.el.remove(); return false; }
      _p.copy(l.pos).setY(l.pos.y + l.t * 0.7);
      ui.place(l.el, _p, camera);
      l.el.style.opacity = String(Math.min(1, (1.1 - l.t) * 3));
      return true;
    });
  }

  clear() {
    for (const id of [...this.units.keys()]) this.removeUnitView(id);
    for (const l of this.labels) l.el.remove();
    for (const l of this.pvLabels) l.remove();
    this.labels = [];
    this.pvLabels = [];
    this.queue = [];
    for (const c of [...this.root.children]) { c.removeFromParent(); disposeTree(c); }
    this.tileGroups = [];
  }

  dispose() {
    this.clear();
    for (const m of Object.values(this.mats)) m.dispose();
    this.root.removeFromParent();
    this.host.scene.remove(this.root);
  }
}

function clearGroup(g) {
  for (const c of [...g.children]) { c.removeFromParent(); disposeTree(c); }
}

/** Free geometry/materials that are not shared (arrows, glass, tubes). */
function disposeTree(o) {
  o.traverse((n) => {
    if (n.geometry && !n.geometry.userData.shared) n.geometry.dispose();
    const mats = Array.isArray(n.material) ? n.material : n.material ? [n.material] : [];
    for (const m of mats) if (!m.userData?.shared && !m.userData?.overlay) m.dispose();
  });
}
