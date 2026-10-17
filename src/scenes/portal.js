import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { MiniGame } from '../core/minigame.js';
import { t } from '../core/i18n.js';
import { Character } from '../core/character.js';
import { COLORS, toon, basic, sharedGeo } from '../core/palette.js';
import { addLights, skyTexture, makeCloud, seeded } from '../core/world.js';

// Top-down co-op portal rooms.
// #  wall        W  white wall (portals stick here)   .  floor     (space) gap
// S  start       E  exit                              X  box
// a-d  button    A-D  door opened by the matching button(s)
const ROOMS = [
  {
    map: [
      '#################',
      '#.....     .....W',
      '#.....     .....W',
      '#.S...     .....W',
      '#.S...     ..E..W',
      '#.S...     .....W',
      '#.....     .....W',
      '#.....     .....W',
      '#WWWWW#####WWWWW#',
    ],
  },
  {
    map: [
      '###################',
      '#.......#.........#',
      '#.S.....#.........#',
      '#.S.....#.....E...#',
      '#.S.....#.........#',
      'W..a....A.........W',
      '#.......#.........#',
      '###################',
    ],
  },
  {
    map: [
      '##################',
      '#.....    .......#',
      '#.S...    ......aW',
      '#.S.X.    .......#',
      'W.S...    .......W',
      '#.....    ###A####',
      '#.....    #..E...#',
      '#.....    #......#',
      '###W##############',
    ],
  },
  {
    map: [
      '###############W####',
      '#......#..   ......#',
      '#.S....#..   ......W',
      '#.S.X..#..   ......#',
      '#.S....A..   ..b...#',
      '#......#..   ......#',
      '#......#..   ##B####',
      '#...a..#..   #.....#',
      '#......#..   #..E..#',
      '########W######W####',
    ],
  },
];

const CELL = 1.6;
const PR = 0.42;
const SPEED = 5.2;
const BOLT_SPEED = 24;
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export class PortalScene extends MiniGame {
  constructor(game, opts) {
    super(game, opts);
    this.camera.fov = 40;
    this.scene.background = skyTexture('#b9a7ff', '#ffe6f4');
    addLights(this.scene, { size: 22, dir: new THREE.Vector3(-0.4, 1, 0.5) });
    this.buildSky();

    this.roomIndex = 0;
    this.levelGroup = null;
    this.bolts = [];
    this.portals = new Map(); // face key -> portal
    this.resetHold = 0;

    this.ents = this.players.map((p, i) => {
      const ch = new Character(p.color, { hat: p.hat });
      this.scene.add(ch.group);
      const aim = new THREE.Mesh(sharedGeo('pAim', () => new THREE.ConeGeometry(0.2, 0.45, 3)), toon(p.color));
      aim.rotation.x = -Math.PI / 2;
      this.scene.add(aim);
      return {
        p, ch, aim, index: i, x: 0, z: 0, vx: 0, vz: 0, dc: 0, dr: 1,
        slots: [null, null], tpCd: 0, pushT: 0, exited: false, exitT: 0,
        placed: 0, pushes: 0,
      };
    });

    this.loadRoom(0);
    game.audio.playMusic('hub');
    this.intro(t('game.portal'), t('portal.intro'));
  }

  buildSky() {
    const rand = seeded(88);
    const sea = new THREE.Mesh(new THREE.CircleGeometry(120, 40), toon(0xd8ccff));
    sea.rotation.x = -Math.PI / 2;
    sea.position.y = -9;
    this.scene.add(sea);
    for (let i = 0; i < 16; i++) {
      const c = makeCloud(rand, 2 + rand() * 2);
      c.position.set((rand() - 0.5) * 70, -7 + rand() * 2, (rand() - 0.5) * 50);
      this.scene.add(c);
    }
  }

  // ---------- room building ----------

  loadRoom(index) {
    if (this.levelGroup) {
      this.scene.remove(this.levelGroup);
      this.levelGroup.traverse((o) => { if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose(); });
    }
    for (const b of this.bolts) this.scene.remove(b.mesh);
    this.bolts = [];
    this.portals.clear();
    for (const e of this.ents) e.slots = [null, null];

    this.roomIndex = index;
    this.room = ROOMS[index];
    const map = this.room.map;
    this.H = map.length;
    this.W = map[0].length;
    this.levelGroup = new THREE.Group();
    this.scene.add(this.levelGroup);
    const g = this.levelGroup;

    this.grid = [];
    this.boxes = [];
    this.doors = [];
    this.plates = [];
    this.spawnCells = [];
    const floorTiles = [], wallTiles = [], pwallTiles = [];
    for (let r = 0; r < this.H; r++) {
      const row = [];
      for (let c = 0; c < this.W; c++) {
        const ch = map[r][c];
        let cell;
        if (ch === '#') cell = { t: 'wall' };
        else if (ch === 'W') cell = { t: 'pwall' };
        else if (ch === ' ') cell = { t: 'pit' };
        else if (ch === 'E') cell = { t: 'exit' };
        else if (ch >= 'a' && ch <= 'd') cell = { t: 'plate', letter: ch.toUpperCase() };
        else if (ch >= 'A' && ch <= 'D') cell = { t: 'door', letter: ch };
        else cell = { t: 'floor' };
        if (ch === 'S') this.spawnCells.push([c, r]);
        if (ch === 'X') this.boxes.push({ c, r, home: [c, r] });
        row.push(cell);
        if (cell.t === 'wall') wallTiles.push([c, r]);
        else if (cell.t === 'pwall') pwallTiles.push([c, r]);
        else if (cell.t !== 'pit') floorTiles.push([c, r]);
      }
      this.grid.push(row);
    }

    // Floor slabs.
    const m = new THREE.Matrix4();
    const col = new THREE.Color();
    const floor = new THREE.InstancedMesh(sharedGeo('pFloor', () => new RoundedBoxGeometry(CELL * 0.98, 0.5, CELL * 0.98, 2, 0.08)), toon(0xffffff), floorTiles.length);
    floorTiles.forEach(([c, r], i) => {
      const p = this.cellPos(c, r);
      m.makeTranslation(p.x, -0.25, p.z);
      floor.setMatrixAt(i, m);
      floor.setColorAt(i, col.set((c + r) % 2 ? 0xf3ecff : 0xe6dcff));
    });
    floor.receiveShadow = true;
    g.add(floor);

    const wallH = (r) => (r === this.H - 1 ? 0.5 : 1.8);
    const addWalls = (tiles, color, geoKey) => {
      for (const [c, r] of tiles) {
        const h = wallH(r);
        const p = this.cellPos(c, r);
        const w = new THREE.Mesh(sharedGeo(`${geoKey}${h}`, () => new RoundedBoxGeometry(CELL, h, CELL, 2, 0.1)), toon(color));
        w.position.set(p.x, h / 2 - 0.05, p.z);
        w.castShadow = w.receiveShadow = true;
        g.add(w);
      }
    };
    addWalls(wallTiles, 0x8a7bc4, 'pWall');
    addWalls(pwallTiles, 0xffffff, 'pPwall');
    // Thin colored trim on white walls so they read as "portal-friendly".
    for (const [c, r] of pwallTiles) {
      const p = this.cellPos(c, r);
      const trim = new THREE.Mesh(sharedGeo('pTrim', () => new THREE.BoxGeometry(CELL * 1.01, 0.12, CELL * 1.01)), toon(0x4cc9f0));
      trim.position.set(p.x, wallH(r) - 0.02, p.z);
      g.add(trim);
    }

    for (let r = 0; r < this.H; r++) {
      for (let c = 0; c < this.W; c++) {
        const cell = this.grid[r][c];
        const p = this.cellPos(c, r);
        if (cell.t === 'exit') {
          const pad = new THREE.Mesh(sharedGeo('pExit', () => new THREE.CylinderGeometry(CELL * 0.42, CELL * 0.45, 0.12, 24)), toon(COLORS.gold, { emissive: 0x443300 }));
          pad.position.set(p.x, 0.06, p.z);
          const star = new THREE.Mesh(sharedGeo('pExitStar', () => new THREE.OctahedronGeometry(0.3)), toon(COLORS.gold, { emissive: 0x443300 }));
          star.position.set(p.x, 1.2, p.z);
          g.add(pad, star);
          this.exitStar = star;
        } else if (cell.t === 'plate') {
          const plate = new THREE.Mesh(sharedGeo('pPlate', () => new THREE.CylinderGeometry(CELL * 0.36, CELL * 0.4, 0.16, 24)), toon(0xff5d73));
          plate.position.set(p.x, 0.08, p.z);
          g.add(plate);
          this.plates.push({ c, r, letter: cell.letter, mesh: plate, pressed: false });
        } else if (cell.t === 'door') {
          const door = new THREE.Mesh(sharedGeo('pDoor', () => new RoundedBoxGeometry(CELL * 0.96, 1.7, CELL * 0.96, 2, 0.12)), toon(0xff8fa8));
          door.position.set(p.x, 0.85, p.z);
          door.castShadow = true;
          const stripe = new THREE.Mesh(sharedGeo('pDoorStripe', () => new THREE.BoxGeometry(CELL * 0.98, 0.2, CELL * 0.98)), toon(0xff5d73));
          stripe.position.y = 0.3;
          door.add(stripe);
          g.add(door);
          cell.door = { c, r, letter: cell.letter, mesh: door, open: false, y: 0.85 };
          this.doors.push(cell.door);
        }
      }
    }

    for (const b of this.boxes) {
      b.mesh = new THREE.Group();
      const crate = new THREE.Mesh(sharedGeo('pBox', () => new RoundedBoxGeometry(CELL * 0.8, CELL * 0.8, CELL * 0.8, 2, 0.12)), toon(0xffb347));
      crate.castShadow = true;
      const band = new THREE.Mesh(sharedGeo('pBoxBand', () => new THREE.BoxGeometry(CELL * 0.82, 0.16, CELL * 0.82)), toon(0xc98b5a));
      crate.add(band);
      b.mesh.add(crate);
      g.add(b.mesh);
      this.placeBox(b, b.c, b.r);
    }

    // Spawn players.
    this.ents.forEach((e, i) => {
      const [c, r] = this.spawnCells[i % this.spawnCells.length];
      const p = this.cellPos(c, r);
      const extra = Math.floor(i / this.spawnCells.length);
      e.x = p.x + extra * 0.7;
      e.z = p.z;
      e.vx = e.vz = 0;
      e.dc = 1; e.dr = 0;
      e.exited = false;
      e.exitT = 0;
      e.ch.group.visible = true;
      e.ch.group.scale.setScalar(1);
    });

    this.frame();
    this.roomDone = false;
  }

  placeBox(b, c, r) {
    b.c = c; b.r = r;
    const p = this.cellPos(c, r);
    b.mesh.position.set(p.x, CELL * 0.4, p.z);
    b.anim = null;
  }

  cellPos(c, r) {
    return { x: (c - (this.W - 1) / 2) * CELL, z: (r - (this.H - 1) / 2) * CELL };
  }

  toCell(x, z) {
    return [Math.round(x / CELL + (this.W - 1) / 2), Math.round(z / CELL + (this.H - 1) / 2)];
  }

  cellAt(c, r) {
    if (r < 0 || r >= this.H || c < 0 || c >= this.W) return { t: 'wall' };
    return this.grid[r][c];
  }

  boxAt(c, r) {
    return this.boxes.find((b) => b.c === c && b.r === r && !b.falling);
  }

  /** Can a player stand here? */
  walkable(c, r) {
    const cell = this.cellAt(c, r);
    if (cell.t === 'wall' || cell.t === 'pwall' || cell.t === 'pit') return false;
    if (cell.t === 'door' && !cell.door.open) return false;
    return !this.boxAt(c, r);
  }

  frame() {
    const tilt = THREE.MathUtils.degToRad(58);
    const d = this.fitDistance(this.W * CELL + 2, this.H * CELL * Math.sin(tilt) + 4);
    this.camera.position.set(0, Math.sin(tilt) * d, Math.cos(tilt) * d + 0.8);
    this.camera.lookAt(0, 0, 0.8);
    this.confettiOrigin = new THREE.Vector3(0, 3, 0);
  }

  resize(w, h) {
    super.resize(w, h);
    if (this.grid) this.frame();
  }

  // ---------- portals ----------

  faceKey(c, r, dc, dr) {
    return `${c},${r},${dc},${dr}`;
  }

  shootBolt(e, slot) {
    const mesh = new THREE.Mesh(sharedGeo('pBolt', () => new THREE.SphereGeometry(0.2, 10, 8)), slot === 0 ? toon(e.p.color, { emissive: 0x222222 }) : toon(COLORS.white, { emissive: 0x222222 }));
    mesh.position.set(e.x, 0.9, e.z);
    this.scene.add(mesh);
    this.bolts.push({ e, slot, mesh, x: e.x + e.dc * 0.3, z: e.z + e.dr * 0.3, dc: e.dc, dr: e.dr, t: 0 });
    this.game.audio.play('bubble');
  }

  updateBolts(dt) {
    for (const b of this.bolts) {
      b.t += dt;
      const steps = 4;
      for (let s = 0; s < steps && !b.dead; s++) {
        b.x += b.dc * BOLT_SPEED * (dt / steps);
        b.z += b.dr * BOLT_SPEED * (dt / steps);
        const [c, r] = this.toCell(b.x, b.z);
        const cell = this.cellAt(c, r);
        if (cell.t === 'pwall') {
          this.placePortal(b.e, b.slot, c, r, -b.dc, -b.dr);
          b.dead = true;
        } else if (cell.t === 'wall' || (cell.t === 'door' && !cell.door.open) || b.t > 3) {
          this.fizzle(b);
        }
      }
      b.mesh.position.set(b.x, 0.9, b.z);
    }
    for (const b of this.bolts) if (b.dead) this.scene.remove(b.mesh);
    this.bolts = this.bolts.filter((b) => !b.dead);
  }

  fizzle(b) {
    b.dead = true;
    this.puffs.burst(new THREE.Vector3(b.x, 0.9, b.z), 0xffffff, { count: 6, size: 0.25, life: 0.35, gravity: 0 });
    this.game.audio.play('bump');
  }

  placePortal(e, slot, c, r, dc, dr) {
    const key = this.faceKey(c, r, dc, dr);
    const exit = this.cellAt(c + dc, r + dr);
    const taken = this.portals.get(key);
    if (exit.t === 'wall' || exit.t === 'pwall' || exit.t === 'pit' || (taken && taken.owner !== e)) {
      this.fizzle({ x: this.cellPos(c, r).x + dc * CELL * 0.5, z: this.cellPos(c, r).z + dr * CELL * 0.5 });
      return;
    }
    if (taken) this.removePortal(taken);
    if (e.slots[slot]) this.removePortal(e.slots[slot]);

    const p = this.cellPos(c, r);
    const low = r === this.H - 1;
    const mesh = new THREE.Group();
    const ring = new THREE.Mesh(sharedGeo('pRing', () => new THREE.TorusGeometry(0.62, 0.1, 10, 28)), toon(e.p.color, { emissive: 0x111111 }));
    ring.scale.y = 1.35;
    const fill = new THREE.Mesh(sharedGeo('pFill', () => new THREE.CircleGeometry(0.58, 28)), basic(slot === 0 ? e.p.color : 0xffffff, { transparent: true, opacity: 0.75 }));
    fill.scale.y = 1.35;
    fill.position.z = -0.01;
    const glow = new THREE.Mesh(sharedGeo('pGlow', () => new THREE.CircleGeometry(0.55, 20)), basic(e.p.color, { transparent: true, opacity: 0.45 }));
    glow.rotation.x = -Math.PI / 2;
    glow.position.set(0, -(low ? 0.5 : 0.9) + 0.03, 0.55);
    mesh.add(ring, fill, glow);
    mesh.position.set(p.x + dc * (CELL / 2 + 0.03), low ? 0.55 : 0.95, p.z + dr * (CELL / 2 + 0.03));
    mesh.rotation.y = Math.atan2(dc, dr);
    if (low) mesh.scale.setScalar(0.7);
    this.scene.add(mesh);
    const portal = { owner: e, slot, c, r, dc, dr, key, mesh, born: this.time };
    this.portals.set(key, portal);
    e.slots[slot] = portal;
    e.placed++;
    this.game.audio.play('trap');
    this.confetti.burst(mesh.position, e.p.color, { count: 10, speed: 3, size: 0.12, life: 0.5 });
  }

  removePortal(portal) {
    this.scene.remove(portal.mesh);
    this.portals.delete(portal.key);
    if (portal.owner.slots[portal.slot] === portal) portal.owner.slots[portal.slot] = null;
  }

  pairOf(portal) {
    return portal.owner.slots[1 - portal.slot];
  }

  /** Free cell near the portal's exit, so nobody pops out inside a box. */
  exitCell(portal) {
    const c = portal.c + portal.dc, r = portal.r + portal.dr;
    if (this.walkable(c, r)) return [c, r];
    for (const [dc, dr] of DIRS) if (this.walkable(c + dc, r + dr)) return [c + dc, r + dr];
    return null;
  }

  // ---------- players ----------

  updatePlayer(e, dt) {
    if (e.exited) return;
    const inp = this.input(e.p) || { x: 0, y: 0, a: false, b: false, aPressed: false, bPressed: false };
    const playing = this.state === 'play' && !this.roomDone;
    e.tpCd -= dt;
    const ix = playing ? inp.x : 0, iz = playing ? -inp.y : 0;
    if (Math.abs(ix) > 0.3 || Math.abs(iz) > 0.3) {
      if (Math.abs(ix) > Math.abs(iz)) { e.dc = Math.sign(ix); e.dr = 0; } else { e.dc = 0; e.dr = Math.sign(iz); }
    }
    const acc = 40 * dt;
    e.vx += THREE.MathUtils.clamp(ix * SPEED - e.vx, -acc, acc);
    e.vz += THREE.MathUtils.clamp(iz * SPEED - e.vz, -acc, acc);
    e.x += e.vx * dt;
    e.z += e.vz * dt;

    if (playing && inp.aPressed) this.shootBolt(e, 0);
    if (playing && inp.bPressed) this.shootBolt(e, 1);

    // Collide with blocked cells; walking into a portal teleports.
    const [pc, pr] = this.toCell(e.x, e.z);
    let pushing = false;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const c = pc + dc, r = pr + dr;
        const cell = this.cellAt(c, r);
        const box = this.boxAt(c, r);
        const blocked = cell.t === 'wall' || cell.t === 'pwall' || cell.t === 'pit' || (cell.t === 'door' && !cell.door.open) || box;
        if (!blocked) continue;
        const cp = this.cellPos(c, r);
        const half = cell.t === 'pit' ? CELL / 2 - 0.25 : CELL / 2;
        const qx = THREE.MathUtils.clamp(e.x, cp.x - half, cp.x + half);
        const qz = THREE.MathUtils.clamp(e.z, cp.z - half, cp.z + half);
        const dx = e.x - qx, dz = e.z - qz;
        const d = Math.hypot(dx, dz);
        if (d >= PR || d < 1e-6) continue;
        const nx = dx / d, nz = dz / d;
        e.x = qx + nx * PR;
        e.z = qz + nz * PR;
        const axisX = Math.abs(nx) > Math.abs(nz);
        const fdc = axisX ? Math.sign(nx) : 0, fdr = axisX ? 0 : Math.sign(nz);
        // Use the stick as well as velocity: contact zeroes velocity, but holding toward a wall still means "go in".
        const into = Math.max(-(e.vx * fdc + e.vz * fdr), -(ix * fdc + iz * fdr) * SPEED);
        if (cell.t === 'pwall' && e.tpCd <= 0 && into > 1) {
          const portal = this.portals.get(this.faceKey(c, r, fdc, fdr));
          const pair = portal && this.pairOf(portal);
          if (pair && this.teleport(e, pair)) return;
        }
        if (box && into > 1 && playing) {
          pushing = true;
          e.pushT += dt;
          if (e.pushT > 0.15) {
            e.pushT = 0;
            this.pushBox(box, -fdc, -fdr, e);
          }
        }
        const vn = e.vx * nx + e.vz * nz;
        if (vn < 0) { e.vx -= vn * nx; e.vz -= vn * nz; }
      }
    }
    if (!pushing) e.pushT = 0;

    // Exit.
    const [ec, er] = this.toCell(e.x, e.z);
    if (this.cellAt(ec, er).t === 'exit' && !this.roomDone) {
      e.exitT += dt;
      if (e.exitT > 0.3) {
        e.exited = true;
        e.ch.group.visible = false;
        e.aim.visible = false;
        this.game.audio.play('star');
        this.confetti.burst(new THREE.Vector3(e.x, 1, e.z), 0, { count: 24, speed: 5, colors: [e.p.color, COLORS.gold, COLORS.white] });
        return;
      }
    } else {
      e.exitT = 0;
    }

    const sp = Math.hypot(e.vx, e.vz);
    e.ch.face(e.dc, e.dr);
    e.ch.group.position.set(e.x, 0, e.z);
    e.ch.update(dt, { moving: Math.min(1, sp / SPEED), grounded: true });
    e.aim.visible = playing;
    e.aim.position.set(e.x + e.dc * 0.85, 0.08, e.z + e.dr * 0.85);
    e.aim.rotation.z = -Math.atan2(e.dc, -e.dr);
  }

  teleport(e, dest) {
    const cell = this.exitCell(dest);
    if (!cell) return false;
    const p = this.cellPos(cell[0], cell[1]);
    this.puffs.burst(new THREE.Vector3(e.x, 0.8, e.z), e.p.color, { count: 8, size: 0.25, gravity: 0, life: 0.4 });
    e.x = p.x - dest.dc * 0.2;
    e.z = p.z - dest.dr * 0.2;
    const sp = Math.max(3, Math.hypot(e.vx, e.vz));
    e.vx = dest.dc * sp;
    e.vz = dest.dr * sp;
    e.dc = dest.dc; e.dr = dest.dr;
    e.ch.yaw = Math.atan2(dest.dc, dest.dr);
    e.ch.squash(1.3);
    e.tpCd = 0.35;
    this.game.audio.play('whoosh');
    this.puffs.burst(new THREE.Vector3(e.x, 0.8, e.z), e.p.color, { count: 8, size: 0.25, gravity: 0, life: 0.4 });
    return true;
  }

  pushBox(box, dc, dr, by) {
    if (box.anim) return;
    const tc = box.c + dc, tr = box.r + dr;
    const target = this.cellAt(tc, tr);
    if (target.t === 'pwall') {
      const portal = this.portals.get(this.faceKey(tc, tr, -dc, -dr));
      const pair = portal && this.pairOf(portal);
      if (!pair) return;
      const c = pair.c + pair.dc, r = pair.r + pair.dr;
      if (!this.walkable(c, r)) return;
      this.puffs.burst(box.mesh.position, 0xffb347, { count: 8, size: 0.3, gravity: 0, life: 0.4 });
      this.placeBox(box, c, r);
      box.mesh.scale.setScalar(0.3);
      this.game.audio.play('whoosh');
      by.pushes++;
      return;
    }
    if (target.t === 'wall' || (target.t === 'door' && !target.door.open) || this.boxAt(tc, tr)) return;
    const from = box.mesh.position.clone();
    box.c = tc; box.r = tr;
    const to = this.cellPos(tc, tr);
    box.anim = { from, to: new THREE.Vector3(to.x, CELL * 0.4, to.z), t: 0 };
    if (target.t === 'pit') box.falling = true;
    by.pushes++;
    this.game.audio.play('land');
  }

  updateBoxes(dt) {
    for (const b of this.boxes) {
      b.mesh.scale.lerp(new THREE.Vector3(1, 1, 1), Math.min(1, dt * 8));
      if (!b.anim) continue;
      b.anim.t += dt / 0.18;
      const k = Math.min(1, b.anim.t);
      b.mesh.position.lerpVectors(b.anim.from, b.anim.to, k);
      if (k >= 1 && !b.falling) b.anim = null;
      if (b.falling && k >= 1) {
        b.mesh.position.y -= dt * 12 * (b.anim.t - 0.8);
        if (b.mesh.position.y < -8) {
          // Lost boxes come back home so the room can't get stuck.
          b.falling = false;
          const [hc, hr] = b.home;
          if (this.walkable(hc, hr)) {
            this.placeBox(b, hc, hr);
            b.mesh.scale.setScalar(0.2);
            this.puffs.burst(b.mesh.position, 0xffffff, { count: 10, size: 0.35 });
          } else {
            b.falling = true;
          }
        }
      }
    }
  }

  updateSwitches(dt) {
    for (const pl of this.plates) {
      const pos = this.cellPos(pl.c, pl.r);
      pl.pressed = !!this.boxAt(pl.c, pl.r) || this.ents.some((e) => !e.exited && Math.abs(e.x - pos.x) < CELL * 0.5 && Math.abs(e.z - pos.z) < CELL * 0.5);
      pl.mesh.position.y = pl.pressed ? 0.02 : 0.08;
      pl.mesh.material = toon(pl.pressed ? 0x3ddc97 : 0xff5d73);
    }
    for (const d of this.doors) {
      const plates = this.plates.filter((p) => p.letter === d.letter);
      const open = plates.length > 0 && plates.every((p) => p.pressed);
      if (open !== d.open) {
        d.open = open;
        this.game.audio.play(open ? 'select' : 'bump');
        if (!open) this.clearDoorway(d);
      }
      d.y = THREE.MathUtils.lerp(d.y, open ? -0.9 : 0.85, Math.min(1, dt * 10));
      d.mesh.position.y = d.y;
    }
  }

  /** Nudge anyone standing in a closing door to a free neighbor cell. */
  clearDoorway(d) {
    const p = this.cellPos(d.c, d.r);
    for (const e of this.ents) {
      if (e.exited || Math.abs(e.x - p.x) > CELL * 0.6 || Math.abs(e.z - p.z) > CELL * 0.6) continue;
      for (const [dc, dr] of DIRS) {
        if (this.walkable(d.c + dc, d.r + dr)) {
          const q = this.cellPos(d.c + dc, d.r + dr);
          e.x = q.x; e.z = q.z;
          break;
        }
      }
    }
  }

  separatePlayers() {
    const list = this.ents.filter((e) => !e.exited);
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i], b = list[j];
        const dx = b.x - a.x, dz = b.z - a.z;
        const d = Math.hypot(dx, dz);
        if (d < PR * 1.8 && d > 1e-4) {
          const push = (PR * 1.8 - d) / 2;
          a.x -= (dx / d) * push; a.z -= (dz / d) * push;
          b.x += (dx / d) * push; b.z += (dz / d) * push;
        }
      }
    }
  }

  checkReset(dt) {
    const holding = this.players.some((p) => {
      const d = this.input(p);
      return d && d.a && d.b;
    });
    this.resetHold = holding ? this.resetHold + dt : 0;
    if (this.resetHold > 1.3) {
      this.resetHold = 0;
      this.game.audio.play('whoosh');
      this.game.ui.toast(t('portal.reset'));
      this.loadRoom(this.roomIndex);
    }
  }

  roomCleared() {
    this.roomDone = true;
    this.game.audio.play('fanfare');
    if (this.roomIndex + 1 < ROOMS.length) {
      this.game.ui.banner(t('portal.cleared'), t(`room.${this.roomIndex + 1}.name`), 1800);
      this.later(2.2, () => {
        this.game.ui.wipe(() => {
          this.loadRoom(this.roomIndex + 1);
          this.game.ui.toast(t(`room.${this.roomIndex}.hint`), 4000);
        });
      });
    } else {
      this.later(1.2, () => this.end());
    }
  }

  end() {
    const ranked = [...this.ents].sort((a, b) => b.placed - a.placed);
    this.finish({
      title: t('portal.title'),
      subtitle: t('portal.sub'),
      rows: ranked.map((e) => ({ css: e.p.css, name: e.p.name, value: `${e.placed}`, detail: t('portal.detail', { n: e.pushes }) })),
      stars: 3,
    });
  }

  onStart() {
    this.game.ui.toast(t(`room.${this.roomIndex}.hint`), 4500);
  }

  update(dt) {
    for (const e of this.ents) this.updatePlayer(e, dt);
    this.separatePlayers();
    if (this.updateResults(dt)) return;
    this.updateBolts(dt);
    this.updateBoxes(dt);
    this.updateSwitches(dt);
    if (this.exitStar) {
      this.exitStar.rotation.y += dt * 2;
      this.exitStar.position.y = 1.2 + Math.sin(this.time * 3) * 0.15;
    }
    for (const portal of this.portals.values()) {
      const s = (portal.r === this.H - 1 ? 0.7 : 1) * (1 + Math.sin(this.time * 4 + portal.c) * 0.04);
      portal.mesh.scale.setScalar(Math.min(s, (this.time - portal.born) * 6));
    }
    if (this.state === 'play' && !this.roomDone) {
      this.checkReset(dt);
      if (this.ents.every((e) => e.exited)) this.roomCleared();
    }
    if (this.state !== 'intro') {
      const left = this.ents.filter((e) => !e.exited).length;
      this.game.ui.setTop(`<div class="pill hud-title">${t('portal.hud', { i: this.roomIndex + 1, n: ROOMS.length, name: t(`room.${this.roomIndex}.name`) })}</div><div class="pill">${t('portal.left', { n: left })}</div>`);
    }
    this.game.ui.bar(this.players, (p) => (this.ents.find((e) => e.p === p)?.exited ? t('portal.out') : ''));
  }
}

