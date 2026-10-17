import * as THREE from 'three';
import { Round, clock } from './common.js';
import { COLORS, toon, basic, sharedGeo } from '../../core/palette.js';
import { makeTree, makeFlower, makeStar, seeded } from '../../core/world.js';
import { t, addStrings } from '../../core/i18n.js';

addStrings({
  en: {
    'mirror.title': 'Mirror Maze',
    'mirror.hint': 'Race through the hedge maze to the star! Pink mirror floors swap left and right, blue ones swap up and down while you stand on them. Reached the star? Run it again for an extra point.',
    'mirror.lr': 'left ↔ right', 'mirror.ud': 'up ↕ down',
    'mirror.place': '#{n}', 'mirror.again': '+1',
    'mirror.done': '#{p} · {r} extra runs', 'mirror.left': '{n} steps to go',
  },
  no: {
    'mirror.title': 'Speillabyrinten',
    'mirror.hint': 'Løp gjennom hekklabyrinten til stjerna! Rosa speilgulv bytter om venstre og høyre, blå bytter om opp og ned mens du står på dem. Nådd stjerna? Løp igjen for et ekstra poeng.',
    'mirror.lr': 'venstre ↔ høyre', 'mirror.ud': 'opp ↕ ned',
    'mirror.place': 'nr. {n}', 'mirror.again': '+1',
    'mirror.done': 'nr. {p} · {r} ekstra runder', 'mirror.left': '{n} skritt igjen',
  },
});

// Mirror Maze: a symmetric hedge maze; mirror floors flip your controls while you stand on them.
const W = 15; // tiles across (odd, so the star sits on the middle tile)
const H = 11;
const T = 1.5; // tile size in world units
const CX = (W - 1) / 2, CY = (H - 1) / 2;
const TIME = 45;
const SPEED = 4.6;
const PR = 0.34;
const PLACE_PTS = [6, 5, 4, 3, 2, 1];
const FLIP_X = 1, FLIP_Y = 2;
const ZONE = {
  [FLIP_X]: { hex: 0xff6ad5, css: '#e63fb8', arrow: '↔' },
  [FLIP_Y]: { hex: 0x2ec5f0, css: '#1597c9', arrow: '↕' },
};
// Corners first (so up to four players get perfectly fair starts), then the middle of the side edges.
const STARTS = [[1, 1], [W - 2, H - 2], [W - 2, 1], [1, H - 2], [1, CY], [W - 2, CY]];

const idx = (x, y) => y * W + x;
const toWorld = (tx, ty) => [(tx - CX) * T, (ty - CY) * T];

/**
 * Carve one quarter of the maze (a spanning tree plus a few loops), then mirror it both ways.
 * The quarter includes the middle row and column, so all four quarters join up through them.
 */
function carve(rand) {
  const QW = CX + 1, QH = CY + 1; // quarter size in tiles, including the middle row/column
  const q = new Uint8Array(QW * QH);
  const cells = [];
  for (let cy = 1; cy < QH; cy += 2) for (let cx = 1; cx < QW; cx += 2) cells.push([cx, cy]);
  const seen = new Set();
  const stack = [[1, 1]];
  seen.add('1,1');
  q[1 * QW + 1] = 1;
  while (stack.length) {
    const [x, y] = stack[stack.length - 1];
    const opts = [[2, 0], [-2, 0], [0, 2], [0, -2]].filter(([dx, dy]) => {
      const nx = x + dx, ny = y + dy;
      return nx >= 1 && ny >= 1 && nx < QW && ny < QH && !seen.has(`${nx},${ny}`);
    });
    if (!opts.length) { stack.pop(); continue; }
    const [dx, dy] = opts[Math.floor(rand() * opts.length)];
    q[(y + dy / 2) * QW + x + dx / 2] = 1;
    q[(y + dy) * QW + x + dx] = 1;
    seen.add(`${x + dx},${y + dy}`);
    stack.push([x + dx, y + dy]);
  }
  // Braid: knock out some extra walls so there are loops and more than one way through.
  for (const [x, y] of cells) {
    for (const [dx, dy] of [[1, 0], [0, 1]]) {
      if (x + dx * 2 >= QW || y + dy * 2 >= QH) continue;
      const w = (y + dy) * QW + x + dx;
      if (!q[w] && rand() < 0.14) q[w] = 1;
    }
  }
  const floor = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) floor[idx(x, y)] = q[Math.min(y, H - 1 - y) * QW + Math.min(x, W - 1 - x)];
  }
  return floor;
}

function distances(floor) {
  const dist = new Int16Array(W * H).fill(-1);
  const queue = [[CX, CY]];
  dist[idx(CX, CY)] = 0;
  while (queue.length) {
    const [x, y] = queue.shift();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H || !floor[idx(nx, ny)] || dist[idx(nx, ny)] >= 0) continue;
      dist[idx(nx, ny)] = dist[idx(x, y)] + 1;
      queue.push([nx, ny]);
    }
  }
  return dist;
}

/** Try a few mazes and keep one where corner and side starts are about equally far from the star. */
function makeMaze() {
  let best = null;
  for (let tries = 0; tries < 150; tries++) {
    const rand = seeded(Math.floor(Math.random() * 1e9));
    const floor = carve(rand);
    const dist = distances(floor);
    const dc = dist[idx(1, 1)], dm = dist[idx(1, CY)];
    if (dc < 0 || dm < 0) continue;
    const bad = Math.abs(dc - dm) * 2 + Math.max(0, 20 - Math.min(dc, dm));
    if (!best || bad < best.bad) best = { floor, dist, bad, rand };
    if (bad === 0) break;
  }
  return best;
}

/** Mirror floors: in one quarter, one of each kind (one on the shortest path), mirrored to all four. */
function placeZones(floor, dist, rand) {
  const zone = new Uint8Array(W * H);
  const startKeys = new Set(STARTS.map(([x, y]) => idx(x, y)));
  const okTile = (x, y) => x <= CX && y <= CY && floor[idx(x, y)] && !startKeys.has(idx(x, y))
    && dist[idx(x, y)] > 2 && Math.abs(x - 1) + Math.abs(y - 1) > 2 && Math.abs(x - 1) + Math.abs(y - CY) > 2;
  // Walk the shortest path from the top-left corner to the star.
  const path = [];
  let [x, y] = [1, 1];
  while (dist[idx(x, y)] > 0) {
    path.push([x, y]);
    const next = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [x + dx, y + dy])
      .find(([nx, ny]) => nx >= 0 && ny >= 0 && nx < W && ny < H && dist[idx(nx, ny)] === dist[idx(x, y)] - 1);
    [x, y] = next;
  }
  const onPath = path.filter(([px, py]) => okTile(px, py));
  const all = [];
  for (let yy = 0; yy <= CY; yy++) for (let xx = 0; xx <= CX; xx++) if (okTile(xx, yy)) all.push([xx, yy]);
  const pick = (list) => list[Math.floor(rand() * list.length)];
  // A flip only matters along the corridor it sits in: left/right flips go in side-to-side corridors.
  const fl = (x, y) => x >= 0 && y >= 0 && x < W && y < H && floor[idx(x, y)];
  const dirOf = (x, y) => {
    const h = fl(x - 1, y) || fl(x + 1, y), v = fl(x, y - 1) || fl(x, y + 1);
    return h && !v ? FLIP_X : v && !h ? FLIP_Y : 0;
  };
  const quarter = new Map();
  const mark = (tile, kind) => {
    if (!tile) return;
    const [tx, ty] = tile;
    quarter.set(idx(tx, ty), kind);
    // Grow the patch by one neighbouring floor tile so it is easy to see.
    const steps = kind === FLIP_X ? [[1, 0], [-1, 0]] : [[0, 1], [0, -1]];
    const n = steps.map(([dx, dy]) => [tx + dx, ty + dy]).filter(([nx, ny]) => okTile(nx, ny) && !quarter.has(idx(nx, ny)));
    if (n.length) { const [nx, ny] = pick(n); quarter.set(idx(nx, ny), kind); }
  };
  const straight = onPath.filter(([px, py]) => dirOf(px, py));
  const first = pick(straight.length ? straight : onPath.length ? onPath : all);
  const kind0 = (first && dirOf(...first)) || (rand() < 0.5 ? FLIP_X : FLIP_Y);
  const kind1 = kind0 === FLIP_X ? FLIP_Y : FLIP_X;
  mark(first, kind0);
  const far = all.filter(([ax, ay]) => [...quarter.keys()].every((k) => Math.abs((k % W) - ax) + Math.abs(Math.floor(k / W) - ay) > 3));
  const fits = far.filter(([ax, ay]) => dirOf(ax, ay) === kind1);
  mark(pick(fits.length ? fits : far.length ? far : all), kind1);
  for (const [k, kind] of quarter) {
    const qx = k % W, qy = Math.floor(k / W);
    for (const [mx, my] of [[qx, qy], [W - 1 - qx, qy], [qx, H - 1 - qy], [W - 1 - qx, H - 1 - qy]]) zone[idx(mx, my)] = kind;
  }
  return zone;
}

function arrowGeometry(vertical) {
  return sharedGeo(`mirrorArrow${vertical ? 'V' : 'H'}`, () => {
    // A flat double-headed arrow, 1 unit long.
    const s = new THREE.Shape();
    const pts = [[-0.5, 0], [-0.28, 0.2], [-0.28, 0.08], [0.28, 0.08], [0.28, 0.2], [0.5, 0], [0.28, -0.2], [0.28, -0.08], [-0.28, -0.08], [-0.28, -0.2]];
    pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
    s.closePath();
    const g = new THREE.ShapeGeometry(s);
    g.rotateX(-Math.PI / 2);
    if (vertical) g.rotateY(Math.PI / 2);
    return g;
  });
}

export class MirrorRound extends Round {
  static key = 'mirror';

  constructor(party) {
    super(party);
    const maze = makeMaze();
    this.floor = maze.floor;
    this.dist = maze.dist;
    this.zone = placeZones(this.floor, this.dist, maze.rand);
    this.t = 0;
    this.finishers = 0;
    this.build();
    this.ents = this.players.map((p, i) => {
      const [sx, sy] = STARTS[i % STARTS.length];
      const [x, z] = toWorld(sx, sy);
      const pad = new THREE.Mesh(sharedGeo('mirrorPad', () => new THREE.CircleGeometry(0.62, 24)), toon(p.color));
      pad.rotation.x = -Math.PI / 2;
      pad.position.set(x, 0.03, z);
      this.group.add(pad);
      const ch = this.bean(p);
      ch.group.position.set(x, 0, z);
      ch.yaw = ch.targetYaw = Math.atan2(-x, -z);
      return {
        p, ch, sx: x, sz: z, x, z, vx: 0, vz: 0, flip: 0, cheer: 0,
        place: 0, runs: 0, points: 0, tag: this.label('label'),
      };
    });
  }

  get title() { return t('mirror.title'); }
  get hint() { return t('mirror.hint'); }

  isWall(tx, ty) {
    return tx < 0 || ty < 0 || tx >= W || ty >= H || !this.floor[idx(tx, ty)];
  }

  tileAt(x, z) {
    return [Math.round(x / T + CX), Math.round(z / T + CY)];
  }

  build() {
    const g = this.group;
    const rand = seeded(61);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(90, 70), toon(COLORS.grassDark));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.01;
    ground.receiveShadow = true;
    g.add(ground);
    const yard = new THREE.Mesh(new THREE.PlaneGeometry(W * T, H * T), toon(0xf3e2b8));
    yard.rotation.x = -Math.PI / 2;
    yard.receiveShadow = true;
    g.add(yard);
    // Hedges: two instanced meshes (body + lighter top) instead of one mesh per wall tile.
    const walls = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (!this.floor[idx(x, y)]) walls.push(toWorld(x, y));
    const body = new THREE.InstancedMesh(new THREE.BoxGeometry(T, 1, T), toon(COLORS.leaf), walls.length);
    const top = new THREE.InstancedMesh(new THREE.BoxGeometry(T * 0.86, 0.22, T * 0.86), toon(COLORS.leafLight), walls.length);
    const m = new THREE.Matrix4();
    walls.forEach(([x, z], i) => {
      body.setMatrixAt(i, m.makeTranslation(x, 0.5, z));
      top.setMatrixAt(i, m.makeTranslation(x, 1.08, z));
    });
    body.castShadow = true;
    body.receiveShadow = true;
    g.add(body, top);
    // Mirror floors: their own material per kind so the shimmer can pulse.
    this.zoneMats = {};
    for (const kind of [FLIP_X, FLIP_Y]) {
      this.zoneMats[kind] = new THREE.MeshToonMaterial({ color: ZONE[kind].hex, gradientMap: toon(0xffffff).gradientMap, emissive: ZONE[kind].hex, emissiveIntensity: 0.2 });
    }
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const kind = this.zone[idx(x, y)];
        if (!kind) continue;
        const [wx, wz] = toWorld(x, y);
        const tile = new THREE.Mesh(sharedGeo('mirrorTile', () => new THREE.BoxGeometry(T - 0.06, 0.05, T - 0.06)), this.zoneMats[kind]);
        tile.position.set(wx, 0.025, wz);
        tile.receiveShadow = true;
        const shine = new THREE.Mesh(sharedGeo('mirrorShine', () => new THREE.PlaneGeometry(0.16, T * 1.1)), basic(COLORS.white, { transparent: true, opacity: 0.45 }));
        shine.rotation.set(-Math.PI / 2, 0, Math.PI / 4);
        shine.position.set(wx - 0.35, 0.06, wz - 0.1);
        const arrow = new THREE.Mesh(arrowGeometry(kind === FLIP_Y), basic(COLORS.white));
        arrow.position.set(wx + 0.05, 0.065, wz + 0.05);
        g.add(tile, shine, arrow);
      }
    }
    // The goal: a big spinning star on a golden plate.
    const [gx, gz] = toWorld(CX, CY);
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.72, 0.1, 28), toon(COLORS.gold));
    plate.position.set(gx, 0.05, gz);
    g.add(plate);
    // Tilted back toward the camera and spun like a pinwheel, so it reads as a star from above.
    this.starHolder = new THREE.Group();
    this.starHolder.position.set(gx, 1.5, gz);
    this.starHolder.rotation.x = -0.95;
    this.star = makeStar();
    this.star.scale.setScalar(1.5);
    this.starHolder.add(this.star);
    g.add(this.starHolder);
    // Garden dressing around the maze.
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * Math.PI * 2;
      const rx = (W * T) / 2 + 3 + rand() * 4, rz = (H * T) / 2 + 3 + rand() * 4;
      const tr = makeTree(rand, 1 + rand() * 0.5);
      tr.position.set(Math.sin(a) * rx, 0, Math.cos(a) * rz);
      if (tr.position.z > (H * T) / 2 + 1) continue; // keep the front edge clear for the camera
      g.add(tr);
    }
    for (let i = 0; i < 40; i++) {
      const f = makeFlower(rand);
      const side = rand() < 0.5 ? -1 : 1;
      f.position.set(side * ((W * T) / 2 + 0.6 + rand() * 4), 0, (rand() - 0.5) * (H * T + 4));
      g.add(f);
    }
  }

  frame() {
    const d = this.party.fitDistance(W * T + 2, H * T * 0.88 + 3);
    this.camera.position.set(0, d * 0.92, d * 0.42);
    this.camera.lookAt(0, 0, 0.5);
  }

  /** Push a circle out of nearby hedge tiles. */
  collide(e) {
    const [tx, ty] = this.tileAt(e.x, e.z);
    for (let y = ty - 1; y <= ty + 1; y++) {
      for (let x = tx - 1; x <= tx + 1; x++) {
        if (!this.isWall(x, y)) continue;
        const [wx, wz] = toWorld(x, y);
        const cx = THREE.MathUtils.clamp(e.x, wx - T / 2, wx + T / 2);
        const cz = THREE.MathUtils.clamp(e.z, wz - T / 2, wz + T / 2);
        const dx = e.x - cx, dz = e.z - cz, d = Math.hypot(dx, dz);
        if (d < PR && d > 1e-5) { e.x = cx + (dx / d) * PR; e.z = cz + (dz / d) * PR; }
      }
    }
  }

  update(dt, playing) {
    this.time += dt;
    if (playing && !this.done) this.t += dt;
    const live = playing && this.t < TIME;
    this.star.rotation.z += dt * 2;
    this.starHolder.position.y = 1.5 + Math.sin(this.time * 3) * 0.15;
    const pulse = 0.18 + Math.abs(Math.sin(this.time * 3)) * 0.25;
    this.zoneMats[FLIP_X].emissiveIntensity = pulse;
    this.zoneMats[FLIP_Y].emissiveIntensity = pulse;
    const [gx, gz] = toWorld(CX, CY);
    for (const e of this.ents) {
      const [tx, ty] = this.tileAt(e.x, e.z);
      const kind = this.isWall(tx, ty) ? 0 : this.zone[idx(tx, ty)];
      if (kind !== e.flip) {
        if (kind && live) {
          this.game.audio.play('whoosh');
          this.party.puffs.burst(new THREE.Vector3(e.x, 0.4, e.z), ZONE[kind].hex, { count: 8, size: 0.3, life: 0.4 });
        }
        e.flip = kind;
      }
      let ix = 0, iz = 0;
      if (e.cheer > 0) {
        e.cheer -= dt;
        if (e.cheer <= 0) this.respawn(e);
      } else if (live) {
        const d = this.input(e.p);
        ix = d.x; iz = -d.y;
        if (e.flip === FLIP_X) ix = -ix;
        if (e.flip === FLIP_Y) iz = -iz;
        const len = Math.hypot(ix, iz);
        if (len > 1) { ix /= len; iz /= len; }
      }
      e.vx += (ix * SPEED - e.vx) * Math.min(1, dt * 14);
      e.vz += (iz * SPEED - e.vz) * Math.min(1, dt * 14);
      e.x += e.vx * dt;
      e.z += e.vz * dt;
      this.assist(e, ix, iz, dt);
      this.collide(e);
      e.ch.face(e.vx, e.vz);
      if (live && e.cheer <= 0 && Math.hypot(e.x - gx, e.z - gz) < 0.7) this.reachStar(e);
      const sp = Math.hypot(e.vx, e.vz) / SPEED;
      e.ch.spin = e.cheer > 0 ? this.time * 10 : 0;
      e.ch.group.position.set(e.x, e.cheer > 0 ? Math.abs(Math.sin(this.time * 9)) * 0.5 : 0, e.z);
      e.ch.update(dt, { moving: sp });
      // While standing on a mirror floor, a big arrow over your head says which way is flipped.
      if (e.flip && e.cheer <= 0) {
        this.setLabel(e.tag, ZONE[e.flip].arrow, e.ch.group.position.clone().setY(2), ZONE[e.flip].css);
      } else e.tag.style.display = 'none';
    }
    if (playing && this.t >= TIME && !this.done) this.done = true;
  }

  /** Cornering help: gently centre in the corridor you are running along, so you never snag on hedge corners. */
  assist(e, ix, iz, dt) {
    const [tx, ty] = this.tileAt(e.x, e.z);
    const [wx, wz] = toWorld(tx, ty);
    const k = Math.min(1, dt * 7);
    if (Math.abs(ix) > Math.abs(iz) + 0.2 && !this.isWall(tx + Math.sign(ix), ty)) e.z += (wz - e.z) * k;
    else if (Math.abs(iz) > Math.abs(ix) + 0.2 && !this.isWall(tx, ty + Math.sign(iz))) e.x += (wx - e.x) * k;
  }

  reachStar(e) {
    let gain;
    if (!e.place) { e.place = ++this.finishers; gain = PLACE_PTS[Math.min(e.place, PLACE_PTS.length) - 1]; }
    else { e.runs++; gain = 1; }
    e.points += gain;
    e.cheer = 1.1;
    e.vx = e.vz = 0;
    this.game.audio.play('star');
    this.party.confetti.burst(new THREE.Vector3(e.x, 1.8, e.z), 0, { count: 30, speed: 6, colors: [e.p.color, COLORS.gold, COLORS.white] });
    const el = this.label('label party-num');
    const text = e.runs ? t('mirror.again') : `${t('mirror.place', { n: e.place })} <small>+${gain}</small>`;
    const pos = new THREE.Vector3(e.x, 2.6, e.z);
    const show = (age) => {
      if (this.disposed) return;
      el.style.opacity = String(Math.min(1, (1.2 - age) * 3));
      this.setLabel(el, text, pos.clone().setY(2.6 + age), e.p.css);
    };
    show(0);
    // Animate the label on game time, then drop it.
    for (let i = 1; i <= 12; i++) this.later(i * 0.1, () => (i === 12 ? (el.remove(), this.labels = this.labels.filter((l) => l !== el)) : show(i * 0.1)));
  }

  respawn(e) {
    this.party.puffs.burst(new THREE.Vector3(e.x, 0.6, e.z), 0xffffff, { count: 10, size: 0.35, life: 0.4 });
    e.x = e.sx; e.z = e.sz;
    e.vx = e.vz = 0;
    e.ch.squash(1.3);
    this.game.audio.play('whoosh');
    this.party.puffs.burst(new THREE.Vector3(e.x, 0.6, e.z), e.p.color, { count: 10, size: 0.35, life: 0.4 });
  }

  hud() {
    const chip = (kind, text) => `<div class="pill"><b style="color:${ZONE[kind].css}">■</b> ${text}</div>`;
    return `${clock(TIME - this.t)}${chip(FLIP_X, t('mirror.lr'))}${chip(FLIP_Y, t('mirror.ud'))}`;
  }

  stepsLeft(e) {
    const [tx, ty] = this.tileAt(e.x, e.z);
    const d = this.isWall(tx, ty) ? -1 : this.dist[idx(tx, ty)];
    return d < 0 ? 99 : d;
  }

  score(p) {
    const e = this.ents.find((x) => x.p === p);
    // Finishers by points (earlier place breaks ties); everyone else by how close they got.
    return e.place ? e.points + (10 - e.place) * 0.01 : -this.stepsLeft(e);
  }

  detail(p) {
    const e = this.ents.find((x) => x.p === p);
    return e.place ? t('mirror.done', { p: e.place, r: e.runs }) : t('mirror.left', { n: this.stepsLeft(e) });
  }

  dispose() {
    for (const m of Object.values(this.zoneMats)) m.dispose();
    super.dispose();
  }
}
