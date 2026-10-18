import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { MiniGame } from '../core/minigame.js';
import { Character } from '../core/character.js';
import { makeGrumble } from '../core/critters.js';
import { COLORS, PLAYER_COLORS, toon, sharedGeo } from '../core/palette.js';
import { addLights, skyTexture, makeTree, makeCloud, seeded } from '../core/world.js';
import { t } from '../core/i18n.js';
import { TeamPicker, TEAM_COLORS, TEAM_CSS, helpersNeeded } from '../core/teams.js';
import { voteLength } from '../core/vote.js';

// Ice Hockey: slidey skating, a puck that sticks to your stick, two teams.
const HX = 14, HZ = 8; // rink half size
const CR = 3.8; // corner radius
const GX = HX - 2.6; // goal line
const GW = 1.9, GD = 1.3, GH = 1.5; // goal half width, depth, height
const PR = 0.45; // player radius
const PUCK_R = 0.3;
const WALL_T = 0.1;
const MAX_SPEED = 8.5;
const ACCEL = 22;
const DASH = 15;
const MATCH_TIME = 150;
const OVERTIME = 60;

const clamp = THREE.MathUtils.clamp;

/** Rounded-rectangle shape centered on the origin. */
function roundedRect(hx, hz, r) {
  const s = new THREE.Shape();
  s.moveTo(-hx + r, -hz);
  s.lineTo(hx - r, -hz);
  s.absarc(hx - r, -hz + r, r, -Math.PI / 2, 0);
  s.lineTo(hx, hz - r);
  s.absarc(hx - r, hz - r, r, 0, Math.PI / 2);
  s.lineTo(-hx + r, hz);
  s.absarc(-hx + r, hz - r, r, Math.PI / 2, Math.PI);
  s.lineTo(-hx, -hz + r);
  s.absarc(-hx + r, -hz + r, r, Math.PI, Math.PI * 1.5);
  return s;
}

/** Keeps a circle inside the rink; bounces its velocity off the boards. */
function boards(o, r, bounce) {
  const ix = HX - CR, iz = HZ - CR;
  const qx = clamp(o.x, -ix, ix), qz = clamp(o.z, -iz, iz);
  const dx = o.x - qx, dz = o.z - qz;
  const d = Math.hypot(dx, dz);
  const lim = CR - r;
  if (d <= lim || d < 1e-6) return false;
  const nx = dx / d, nz = dz / d;
  o.x = qx + nx * lim;
  o.z = qz + nz * lim;
  const vn = o.vx * nx + o.vz * nz;
  if (vn > 0) { o.vx -= (1 + bounce) * vn * nx; o.vz -= (1 + bounce) * vn * nz; }
  return vn > 4;
}

/** Circle against a thin wall segment. Returns the impact speed. */
function segment(o, r, ax, az, bx, bz, bounce) {
  const ex = bx - ax, ez = bz - az;
  const k = clamp(((o.x - ax) * ex + (o.z - az) * ez) / (ex * ex + ez * ez), 0, 1);
  const cx = ax + ex * k, cz = az + ez * k;
  const dx = o.x - cx, dz = o.z - cz;
  const d = Math.hypot(dx, dz);
  if (d >= r + WALL_T || d < 1e-6) return 0;
  const nx = dx / d, nz = dz / d;
  o.x = cx + nx * (r + WALL_T);
  o.z = cz + nz * (r + WALL_T);
  const vn = o.vx * nx + o.vz * nz;
  if (vn < 0) { o.vx -= (1 + bounce) * vn * nx; o.vz -= (1 + bounce) * vn * nz; }
  return -vn;
}

function goalWalls(side) {
  const a = side * GX, b = side * (GX + GD);
  return [[a, -GW, b, -GW], [a, GW, b, GW], [b, -GW, b, GW]];
}

export class HockeyScene extends MiniGame {
  constructor(game, opts) {
    super(game, opts);
    this.camera.fov = 40;
    this.scene.background = skyTexture('#9fd8ff', '#f2fbff');
    addLights(this.scene, { size: 26, dir: new THREE.Vector3(-0.3, 1, 0.45) });
    this.buildRink();

    this.score = [0, 0];
    this.timeLeft = MATCH_TIME;
    this.overtime = false;
    this.frozen = 0;
    this.shotId = 0;

    this.puck = { x: 0, z: 0, vx: 0, vz: 0, carrier: null, lastTouch: null };
    const puckMesh = new THREE.Mesh(sharedGeo('hkPuck', () => new THREE.CylinderGeometry(PUCK_R, PUCK_R, 0.16, 20)), toon(COLORS.ink));
    puckMesh.castShadow = true;
    this.puckMesh = puckMesh;
    this.scene.add(puckMesh);
    this.puckRing = new THREE.Mesh(sharedGeo('hkPuckRing', () => new THREE.RingGeometry(0.42, 0.55, 24)), toon(COLORS.gold, { transparent: true, opacity: 0.8 }));
    this.puckRing.rotation.x = -Math.PI / 2;
    this.scene.add(this.puckRing);

    this.ents = this.players.map((p, i) => this.makeSkater(p, i % 2));
    this.frame();
    game.audio.playMusic('paint');
    this.state = 'teams';
    const teams = () => { this.picker = new TeamPicker(this, {
      title: () => t('game.hockey'),
      ents: this.ents,
      setTeam: (e, team) => this.setTeam(e, team),
      onChange: () => this.faceoff(),
      onDone: () => {
        this.picker = null;
        helpersNeeded(this.ents).forEach((need, team) => {
          for (let i = 0; i < need; i++) this.ents.push(this.makeSkater(null, team, i));
        });
        this.faceoff();
        this.intro(t('game.hockey'), t('hockey.intro'));
      },
    }); };
    voteLength(this, opts, () => t('game.hockey'), teams);
    this.faceoff();
  }

  retryOptions() {
    return { key: this.key, length: this.matchTime };
  }

  makeSkater(p, team, slot = 0) {
    const ch = p ? new Character(p.color, { hat: p.hat }) : { group: new THREE.Group(), update() {}, face() {}, squash() {}, yaw: 0 };
    if (!p) {
      const critter = makeGrumble(TEAM_COLORS[team]);
      critter.scale.setScalar(1.3);
      ch.group.add(critter);
    }
    this.scene.add(ch.group);

    // A stick, held on the right and resting on the ice in front.
    const stick = new THREE.Group();
    const shaft = new THREE.Mesh(sharedGeo('hkShaft', () => new RoundedBoxGeometry(0.1, 1.5, 0.1, 2, 0.03)), toon(0xc98b5a));
    shaft.position.set(0, 0.75, 0);
    const blade = new THREE.Mesh(sharedGeo('hkBlade', () => new RoundedBoxGeometry(0.5, 0.12, 0.14, 2, 0.04)), toon(TEAM_COLORS[team]));
    blade.position.set(-0.18, 0.06, 0);
    stick.add(shaft, blade);
    stick.position.set(0.32, 0, 0.72);
    stick.rotation.x = -0.55; // shaft leans back toward the hands
    stick.castShadow = true;
    ch.group.add(stick);

    const ring = new THREE.Mesh(sharedGeo('teamRing', () => new THREE.RingGeometry(0.55, 0.78, 24)), toon(TEAM_COLORS[team]));
    ring.rotation.x = -Math.PI / 2;
    this.scene.add(ring);
    return {
      p, bot: !p, ch, ring, stick, blade, team, slot,
      x: 0, z: 0, vx: 0, vz: 0, dirX: team ? -1 : 1, dirZ: 0,
      charge: -1, dashT: 0, dashCd: 0, grabCd: 0, wobble: 0, hold: 0, safeT: 0,
      goals: 0, shots: 0, steals: 0, seenShot: -1, willSave: true,
      get name() { return p ? p.name : t('hockey.goalie'); },
      css: p ? p.css : TEAM_CSS[team],
    };
  }

  setTeam(e, team) {
    e.team = team;
    e.ring.material = toon(TEAM_COLORS[team]);
    e.blade.material = toon(TEAM_COLORS[team]);
  }

  onLanguage() {
    this.picker?.render();
  }

  // ---------- rink ----------

  frame() {
    const tilt = THREE.MathUtils.degToRad(56);
    const d = this.fitDistance(HX * 2 + 3, HZ * 2 * Math.sin(tilt) + 7);
    this.camBase = new THREE.Vector3(0, Math.sin(tilt) * d, Math.cos(tilt) * d + 1);
    this.camera.position.copy(this.camBase);
    this.camera.lookAt(0, 0, 1);
    this.confettiOrigin = new THREE.Vector3(0, 4, 0);
  }

  resize(w, h) {
    super.resize(w, h);
    this.frame();
  }

  iceTexture() {
    const c = document.createElement('canvas');
    c.width = 1024; c.height = 576;
    const g = c.getContext('2d');
    const grd = g.createLinearGradient(0, 0, 0, 576);
    grd.addColorStop(0, '#eaf7ff');
    grd.addColorStop(1, '#d6efff');
    g.fillStyle = grd;
    g.fillRect(0, 0, 1024, 576);
    const sx = 1024 / (HX * 2), sz = 576 / (HZ * 2);
    const X = (x) => (x + HX) * sx, Z = (z) => (z + HZ) * sz;
    // Faint skate scratches.
    const rand = seeded(5);
    g.strokeStyle = 'rgba(255,255,255,0.7)';
    g.lineWidth = 2;
    for (let i = 0; i < 70; i++) {
      const x = rand() * 1024, y = rand() * 576, a = rand() * Math.PI;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * 60, y + Math.sin(a) * 20); g.stroke();
    }
    // Lines.
    g.fillStyle = '#ff5d73';
    g.fillRect(X(0) - 6, 0, 12, 576);
    g.fillStyle = '#4c9bf0';
    for (const x of [-4.5, 4.5]) g.fillRect(X(x) - 7, 0, 14, 576);
    g.fillStyle = '#ff5d73';
    for (const x of [-GX, GX]) g.fillRect(X(x) - 3, 0, 6, 576);
    g.lineWidth = 6;
    g.strokeStyle = '#4c9bf0';
    g.beginPath(); g.arc(X(0), Z(0), 2.5 * sx, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#4c9bf0';
    g.beginPath(); g.arc(X(0), Z(0), 10, 0, Math.PI * 2); g.fill();
    // Face-off circles and creases.
    g.strokeStyle = '#ff5d73';
    for (const x of [-GX + 4, GX - 4]) {
      for (const z of [-3.4, 3.4]) {
        g.beginPath(); g.arc(X(x), Z(z), 1.8 * sx, 0, Math.PI * 2); g.stroke();
        g.fillStyle = '#ff5d73';
        g.beginPath(); g.arc(X(x), Z(z), 8, 0, Math.PI * 2); g.fill();
      }
    }
    for (const side of [-1, 1]) {
      g.fillStyle = 'rgba(76,155,240,0.35)';
      g.beginPath();
      g.arc(X(side * GX), Z(0), 1.9 * sx, side < 0 ? -Math.PI / 2 : Math.PI / 2, side < 0 ? Math.PI / 2 : Math.PI * 1.5);
      g.fill();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  }

  buildRink() {
    const s = this.scene;
    // Ice, with UVs stretched over the rink bounds.
    const iceGeo = new THREE.ShapeGeometry(roundedRect(HX, HZ, CR), 12);
    const pos = iceGeo.attributes.position, uv = iceGeo.attributes.uv;
    for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + HX) / (HX * 2), (pos.getY(i) + HZ) / (HZ * 2));
    const ice = new THREE.Mesh(iceGeo, new THREE.MeshToonMaterial({ map: this.iceTexture(), gradientMap: toon(0xffffff).gradientMap }));
    ice.rotation.x = -Math.PI / 2;
    ice.receiveShadow = true;
    s.add(ice);

    // Boards: a rounded ring extruded upward, with a colored rail on top.
    const ring = (outer, inner, h, color, y) => {
      const shape = roundedRect(HX + outer, HZ + outer, CR + outer);
      shape.holes.push(roundedRect(HX + inner, HZ + inner, CR + inner));
      const geo = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false, curveSegments: 14 });
      const m = new THREE.Mesh(geo, toon(color));
      m.rotation.x = -Math.PI / 2;
      m.position.y = y;
      m.castShadow = m.receiveShadow = true;
      s.add(m);
    };
    ring(0.45, 0, 0.75, COLORS.white, 0);
    ring(0.55, -0.05, 0.16, COLORS.candyPink, 0.75);
    const base = new THREE.Mesh(new RoundedBoxGeometry(HX * 2 + 3, 1, HZ * 2 + 3, 3, 0.4), toon(COLORS.candyLilac));
    base.position.y = -0.52;
    s.add(base);

    // Goals: red frame, team-colored net.
    for (const side of [-1, 1]) {
      const team = side < 0 ? 0 : 1;
      const g = new THREE.Group();
      g.position.set(side * GX, 0, 0);
      const post = sharedGeo('hkPost', () => new THREE.CylinderGeometry(0.1, 0.1, GH, 10));
      for (const z of [-GW, GW]) {
        const m = new THREE.Mesh(post, toon(0xff3b5c));
        m.position.set(0, GH / 2, z);
        m.castShadow = true;
        g.add(m);
      }
      const bar = new THREE.Mesh(sharedGeo('hkBar', () => new THREE.CylinderGeometry(0.1, 0.1, GW * 2, 10)), toon(0xff3b5c));
      bar.rotation.x = Math.PI / 2;
      bar.position.y = GH;
      const net = new THREE.Mesh(sharedGeo('hkNet', () => new THREE.BoxGeometry(GD, GH, GW * 2)), toon(TEAM_COLORS[team], { transparent: true, opacity: 0.3 }));
      net.position.set(side * GD / 2, GH / 2, 0);
      g.add(bar, net);
      s.add(g);
    }

    // Stands with cheering beans on the far side.
    this.fans = [];
    const rand = seeded(21);
    const fanGeo = sharedGeo('fan', () => new THREE.CapsuleGeometry(0.32, 0.3, 4, 10));
    const stand = new THREE.Mesh(new RoundedBoxGeometry(HX * 2 + 2, 1.4, 3.4, 2, 0.3), toon(0xe9e2ff));
    stand.position.set(0, 0.2, -HZ - 2.6);
    s.add(stand);
    for (let i = 0; i < 34; i++) {
      const fan = new THREE.Mesh(fanGeo, toon(PLAYER_COLORS[Math.floor(rand() * 6)].hex));
      fan.position.set(-HX + rand() * HX * 2, 1.3, -HZ - 1.8 - rand() * 1.4);
      fan.userData.phase = rand() * 6;
      s.add(fan);
      this.fans.push(fan);
    }

    const ground = new THREE.Mesh(new THREE.CircleGeometry(90, 40), toon(0xf4f9ff));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -1;
    s.add(ground);
    for (let i = 0; i < 22; i++) {
      const a = rand() * Math.PI * 2;
      const x = Math.cos(a) * (28 + rand() * 10), z = Math.sin(a) * (18 + rand() * 8) - 6;
      if (z > 8) continue;
      const tr = makeTree(rand, 1.2 + rand() * 0.6, [0x5fb37a, 0xeaf6ff]);
      tr.position.set(x, -1, z);
      s.add(tr);
    }
    for (let i = 0; i < 6; i++) {
      const cl = makeCloud(rand, 2.5 + rand());
      cl.position.set(-45 + i * 18, 14 + rand() * 6, -35);
      s.add(cl);
    }

    // Gentle snowfall.
    const n = 400;
    const flakes = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      flakes[i * 3] = (rand() - 0.5) * 60;
      flakes[i * 3 + 1] = rand() * 20;
      flakes[i * 3 + 2] = (rand() - 0.5) * 40 - 4;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(flakes, 3));
    this.snow = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.18, transparent: true, opacity: 0.85 }));
    s.add(this.snow);
  }

  faceoff() {
    for (const team of [0, 1]) {
      const side = team ? 1 : -1;
      const skaters = this.ents.filter((e) => e.team === team && !e.bot);
      skaters.forEach((e, k) => {
        const n = skaters.length;
        e.x = side * (2.5 + (k % 2) * 3);
        e.z = n === 1 ? 0 : -4.5 + (k * 9) / (n - 1);
      });
      this.ents.filter((e) => e.team === team && e.bot).forEach((e) => {
        e.x = side * (GX - 1.2 - e.slot * 2.6);
        e.z = e.slot ? 2 : 0;
      });
      for (const e of this.ents.filter((m) => m.team === team)) {
        e.vx = e.vz = 0;
        e.dirX = -side; e.dirZ = 0;
        e.charge = -1; e.dashT = 0; e.wobble = 0; e.hold = 0;
        e.ch.face(e.dirX, 0);
        e.ch.yaw = e.ch.targetYaw ?? 0;
        if (e.bot) e.ch.group.rotation.y = Math.atan2(e.dirX, e.dirZ);
        e.ch.group.position.set(e.x, 0, e.z);
        e.ring.position.set(e.x, 0.03, e.z);
      }
    }
    Object.assign(this.puck, { x: 0, z: 0, vx: 0, vz: 0, carrier: null, lastTouch: null });
  }

  // ---------- puck ----------

  bladePos(e) {
    return { x: e.x + e.dirX * 0.85, z: e.z + e.dirZ * 0.85 };
  }

  grab(e) {
    const pk = this.puck;
    if (pk.carrier === e) return;
    const prev = pk.carrier;
    pk.carrier = e;
    pk.lastTouch = e;
    e.hold = 0;
    e.safeT = 0.5;
    if (prev && prev.team !== e.team) {
      e.steals++;
      prev.grabCd = 0.6;
      prev.wobble = 0.6;
      this.game.audio.play('pop');
      this.puffs.burst(new THREE.Vector3(pk.x, 0.3, pk.z), 0xffffff, { count: 8, size: 0.3, life: 0.4 });
    } else {
      this.game.audio.play('select');
    }
  }

  shoot(e, power) {
    const pk = this.puck;
    if (pk.carrier !== e) return;
    let ax = e.dirX, az = e.dirZ;
    // Aim assist: nudge shots that point roughly at the other goal.
    const side = e.team ? -1 : 1;
    const gx = side * (GX + 0.4) - e.x, gz = clamp(e.z * 0.3, -GW + 0.6, GW - 0.6) - e.z;
    const gl = Math.hypot(gx, gz) || 1;
    const dot = (ax * gx + az * gz) / gl;
    if (dot > 0.8) {
      ax = ax * 0.5 + (gx / gl) * 0.5; az = az * 0.5 + (gz / gl) * 0.5;
      const l = Math.hypot(ax, az);
      ax /= l; az /= l;
    }
    const speed = (e.bot ? 13 : 12) + power * 16;
    pk.carrier = null;
    pk.vx = ax * speed + e.vx * 0.3;
    pk.vz = az * speed + e.vz * 0.3;
    pk.lastTouch = e;
    e.grabCd = 0.35;
    e.shots++;
    this.shotId++;
    e.ch.squash(1.25);
    this.game.audio.play(power > 0.6 ? 'whoosh' : 'dash');
    this.puffs.burst(new THREE.Vector3(pk.x, 0.2, pk.z), 0xdff4ff, { count: 6 + Math.round(power * 8), size: 0.3, life: 0.4 });
  }

  updatePuck(dt) {
    const pk = this.puck;
    if (pk.carrier) {
      const e = pk.carrier;
      const b = this.bladePos(e);
      const k = Math.min(1, dt * 20);
      pk.x += (b.x - pk.x) * k;
      pk.z += (b.z - pk.z) * k;
      pk.vx = e.vx; pk.vz = e.vz;
      const o = { x: pk.x, z: pk.z, vx: 0, vz: 0 };
      boards(o, PUCK_R, 0);
      for (const side of [-1, 1]) for (const w of goalWalls(side)) segment(o, PUCK_R, ...w, 0);
      pk.x = o.x; pk.z = o.z;
      // Never carry the puck into your own net.
      const own = e.team ? 1 : -1;
      if (Math.abs(pk.z) < GW + PUCK_R && own * pk.x > GX - PUCK_R && own * pk.x < GX + GD) pk.x = own * (GX - PUCK_R);
    } else {
      const steps = 4, h = dt / steps;
      for (let i = 0; i < steps; i++) {
        pk.x += pk.vx * h;
        pk.z += pk.vz * h;
        if (boards(pk, PUCK_R, 0.8)) this.game.audio.play('bump');
        for (const side of [-1, 1]) {
          for (const w of goalWalls(side)) if (segment(pk, PUCK_R, ...w, 0.5) > 4) this.game.audio.play('bump');
        }
      }
      const f = Math.max(0, 1 - 0.35 * dt);
      pk.vx *= f; pk.vz *= f;
      const sp = Math.hypot(pk.vx, pk.vz);
      if (sp < 0.15) { pk.vx = pk.vz = 0; }

      // Skaters pick up a loose puck with their stick.
      if (this.state === 'play' && this.frozen <= 0) {
        let best = null, bestD = Infinity;
        for (const e of this.ents) {
          if (e.grabCd > 0 || e.wobble > 0) continue;
          const b = this.bladePos(e);
          const d = Math.min(Math.hypot(pk.x - b.x, pk.z - b.z), Math.hypot(pk.x - e.x, pk.z - e.z) - 0.1);
          let reach = e.bot ? 1.0 : 0.85;
          if (e.bot && sp > 9) {
            if (e.seenShot !== this.shotId) { e.seenShot = this.shotId; e.willSave = Math.random() < 0.5; }
            if (!e.willSave) continue;
            reach = 1.25;
          }
          if (d < reach && d < bestD) { best = e; bestD = d; }
        }
        if (best) this.grab(best);
      }
    }

    // Goal: the puck slides over the line between the posts.
    if (this.state === 'play' && this.frozen <= 0 && Math.abs(pk.z) < GW) {
      if (pk.x < -GX - PUCK_R * 0.8 && pk.x > -GX - GD) this.goal(1);
      else if (pk.x > GX + PUCK_R * 0.8 && pk.x < GX + GD) this.goal(0);
    }

    this.puckMesh.position.set(pk.x, 0.08, pk.z);
    this.puckRing.position.set(pk.x, 0.02, pk.z);
    this.puckRing.visible = !pk.carrier;
    this.puckRing.scale.setScalar(1 + Math.sin(this.time * 6) * 0.12);
  }

  // ---------- skaters ----------

  updateSkater(e, dt) {
    const playing = this.state === 'play' && this.frozen <= 0;
    const pk = this.puck;
    let ix = 0, iz = 0, aPressed = false, bDown = false;
    if (e.bot) {
      ({ ix, iz, aPressed, bDown } = this.goalieBrain(e, dt));
    } else {
      const d = this.input(e.p) || { x: 0, y: 0 };
      ix = d.x; iz = -d.y; aPressed = d.aPressed; bDown = d.b;
    }
    if (!playing || e.wobble > 0) { ix = iz = 0; aPressed = false; bDown = false; }
    e.grabCd -= dt; e.dashCd -= dt; e.wobble -= dt; e.safeT -= dt;

    const il = Math.hypot(ix, iz);
    if (il > 0.2 && !e.bot) {
      // Turn quickly toward the stick direction, but keep the slide.
      const tx = ix / il, tz = iz / il;
      const k = Math.min(1, dt * (e.charge >= 0 ? 6 : 14));
      e.dirX += (tx - e.dirX) * k; e.dirZ += (tz - e.dirZ) * k;
      const l = Math.hypot(e.dirX, e.dirZ) || 1;
      e.dirX /= l; e.dirZ /= l;
    }
    if (e.dashT > 0) {
      e.dashT -= dt;
    } else {
      const sp = (e.bot ? 0.6 : 1) * MAX_SPEED * (pk.carrier === e ? 0.9 : 1) * (e.charge >= 0 ? 0.6 : 1);
      e.vx += ix * ACCEL * dt;
      e.vz += iz * ACCEL * dt;
      const drag = il > 0.2 ? 1.2 : 2.2;
      const f = Math.max(0, 1 - drag * dt);
      e.vx *= f; e.vz *= f;
      const v = Math.hypot(e.vx, e.vz);
      if (v > sp) { e.vx *= sp / v; e.vz *= sp / v; }
    }

    // A: dash. Dashing into the puck carrier steals the puck.
    if (aPressed && e.dashCd <= 0) {
      e.dashT = 0.22;
      e.dashCd = 0.9;
      e.vx = e.dirX * DASH;
      e.vz = e.dirZ * DASH;
      e.ch.squash(0.8);
      this.game.audio.play('dash');
      this.puffs.burst(new THREE.Vector3(e.x, 0.2, e.z), 0xffffff, { count: 6, size: 0.3, life: 0.35 });
    }
    if (e.dashT > 0 && pk.carrier && pk.carrier.team !== e.team && pk.carrier.safeT <= 0 && e.wobble <= 0) {
      const c = pk.carrier;
      if (Math.hypot(c.x - e.x, c.z - e.z) < 1.3 || Math.hypot(pk.x - e.x, pk.z - e.z) < 1.2) this.grab(e);
    }

    // B: hold to wind up, release to shoot. Without the puck, B pokes for it.
    if (bDown) {
      if (pk.carrier === e) e.charge = Math.min(1, Math.max(0, e.charge) + dt * 1.3);
      else if (e.charge < 0 && pk.carrier && pk.carrier.team !== e.team && pk.carrier.safeT <= 0 && Math.hypot(pk.x - e.x, pk.z - e.z) < 1.5 && e.grabCd <= 0) {
        e.grabCd = 0.3;
        this.grab(e);
        e.charge = -2; // ignore the rest of this press
      }
    } else {
      if (e.charge >= 0 && pk.carrier === e) this.shoot(e, e.charge);
      e.charge = -1;
    }
    if (pk.carrier !== e && e.charge >= 0) e.charge = -1;

    e.x += e.vx * dt;
    e.z += e.vz * dt;
    if (boards(e, PR, 0.4)) e.ch.squash(0.85);
    this.blockGoals(e);

    e.ch.face(e.dirX, e.dirZ);
    if (e.bot) e.ch.group.rotation.y = Math.atan2(e.dirX, e.dirZ);
    e.ch.group.position.set(e.x, 0, e.z);
    e.ch.group.rotation.z = e.wobble > 0 ? Math.sin(e.wobble * 30) * 0.15 : 0;
    const speed = Math.hypot(e.vx, e.vz);
    e.ch.update(dt, { moving: Math.min(1, speed / MAX_SPEED) * 0.6, grounded: true, vy: 0 });
    // Wind the stick back while charging.
    const c = Math.max(0, e.charge);
    e.stick.rotation.y = c * 1.1;
    e.stick.position.y = c * 0.35;
    e.ring.position.set(e.x, 0.03, e.z);
    e.ring.scale.setScalar(this.puck.carrier === e ? 1.25 + Math.sin(this.time * 8) * 0.08 : 1);
  }

  /** Skaters cannot skate through the goal cages. */
  blockGoals(e) {
    for (const side of [-1, 1]) {
      const x0 = Math.min(side * GX, side * (GX + GD)) - 0.12 - PR, x1 = Math.max(side * GX, side * (GX + GD)) + 0.12 + PR;
      const z0 = -GW - 0.12 - PR, z1 = GW + 0.12 + PR;
      if (e.x <= x0 || e.x >= x1 || e.z <= z0 || e.z >= z1) continue;
      const pens = [[e.x - x0, -1, 0], [x1 - e.x, 1, 0], [e.z - z0, 0, -1], [z1 - e.z, 0, 1]];
      pens.sort((a, b) => a[0] - b[0]);
      const [d, nx, nz] = pens[0];
      e.x += nx * d; e.z += nz * d;
      const vn = e.vx * nx + e.vz * nz;
      if (vn < 0) { e.vx -= vn * nx; e.vz -= vn * nz; }
    }
  }

  /** Helper goalie: guard the crease, save about half the hard shots, then pass it on. */
  goalieBrain(e, dt) {
    const side = e.team ? 1 : -1;
    const pk = this.puck;
    const out = { ix: 0, iz: 0, aPressed: false, bDown: false };
    if (pk.carrier === e) {
      e.hold += dt;
      const mates = this.ents.filter((m) => m.team === e.team && m !== e && !m.bot);
      const mate = mates.sort((a, b) => Math.hypot(a.x - e.x, a.z - e.z) - Math.hypot(b.x - e.x, b.z - e.z))[0];
      const tx = mate ? mate.x - e.x : -side, tz = mate ? mate.z - e.z : (e.z > 0 ? -0.5 : 0.5);
      const l = Math.hypot(tx, tz) || 1;
      e.dirX = tx / l; e.dirZ = tz / l;
      out.bDown = e.hold < 0.7;
      return out;
    }
    const homeX = side * (GX - 1.1 - e.slot * 2.4);
    const loose = !pk.carrier;
    const near = Math.hypot(pk.x - e.x, pk.z - e.z);
    let tx = homeX, tz = clamp(pk.z * 0.5, -GW + 0.3, GW - 0.3) + e.slot * (pk.z > 0 ? -1.4 : 1.4);
    // Chase a slow loose puck that drifts into the zone.
    if (loose && Math.hypot(pk.vx, pk.vz) < 6 && side * pk.x > GX - 6 && near < 5) { tx = pk.x; tz = pk.z; }
    const dx = tx - e.x, dz = tz - e.z, d = Math.hypot(dx, dz);
    if (d > 0.2) { out.ix = dx / Math.max(d, 0.8); out.iz = dz / Math.max(d, 0.8); }
    // Face the puck.
    const fx = pk.x - e.x, fz = pk.z - e.z, fl = Math.hypot(fx, fz) || 1;
    e.dirX = fx / fl; e.dirZ = fz / fl;
    return out;
  }

  goal(team) {
    this.score[team]++;
    const lt = this.puck.lastTouch;
    const scorer = lt && !lt.bot && lt.team === team ? lt : null;
    if (scorer) scorer.goals++;
    this.puck.carrier = null;
    this.puck.vx *= 0.2; this.puck.vz *= 0.2;
    this.frozen = 2.6;
    this.game.audio.play('fanfare');
    this.confetti.burst(new THREE.Vector3(this.puck.x, 2, this.puck.z), 0, { count: 70, speed: 10, up: 6, colors: [TEAM_COLORS[team], COLORS.white, COLORS.gold], life: 1.6 });
    this.game.ui.banner(t('ball.goal'), scorer ? t('ball.scored', { name: scorer.name, team: t(`ball.team.${team}`) }) : t(`ball.team.${team}`), 2200);
    this.shake = 0.4;
    this.later(2.6, () => {
      if (this.state !== 'play') return;
      if (this.overtime) { this.end(); return; }
      this.faceoff();
      this.game.audio.play('go');
    });
  }

  end() {
    if (this.state === 'results') return;
    const [a, b] = this.score;
    const winner = a === b ? -1 : a > b ? 0 : 1;
    const ranked = this.ents.filter((e) => !e.bot).sort((x, y) => (y.team === winner) - (x.team === winner) || y.goals - x.goals || y.shots - x.shots);
    this.finish({
      title: winner < 0 ? t('ball.draw') : t('ball.winTitle', { team: t(`ball.team.${winner}`) }),
      subtitle: `${t('ball.team.0')} ${t('ball.sub', { a, b })} ${t('ball.team.1')}`,
      rows: ranked.map((e) => ({
        css: e.css, name: e.name, value: t('ball.goals', { n: e.goals }),
        detail: `${t(`ball.team.${e.team}`)} · ${t('hockey.shots', { n: e.shots })} · ${t('hockey.steals', { n: e.steals })}`, crown: e.team === winner,
      })),
      stars: 2,
    });
  }

  separate() {
    for (let i = 0; i < this.ents.length; i++) {
      for (let j = i + 1; j < this.ents.length; j++) {
        const a = this.ents[i], c = this.ents[j];
        const dx = c.x - a.x, dz = c.z - a.z, d = Math.hypot(dx, dz);
        if (d < PR * 2 && d > 1e-4) {
          const nx = dx / d, nz = dz / d;
          const push = (PR * 2 - d) / 2;
          a.x -= nx * push; a.z -= nz * push;
          c.x += nx * push; c.z += nz * push;
          // Soft bump: trade some velocity along the contact.
          const rel = (a.vx - c.vx) * nx + (a.vz - c.vz) * nz;
          if (rel > 0) {
            a.vx -= nx * rel * 0.5; a.vz -= nz * rel * 0.5;
            c.vx += nx * rel * 0.5; c.vz += nz * rel * 0.5;
          }
        }
      }
    }
  }

  update(dt) {
    const pos = this.snow.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      let y = pos.getY(i) - dt * 1.2;
      if (y < -1) y += 20;
      pos.setY(i, y);
      pos.setX(i, pos.getX(i) + Math.sin(this.time + i) * dt * 0.3);
    }
    pos.needsUpdate = true;

    if (this.state === 'teams') {
      this.picker?.update();
      for (const e of this.ents) { e.ch.update(dt, {}); e.ring.position.set(e.x, 0.03, e.z); }
      this.updatePuck(dt);
      return;
    }
    for (const e of this.ents) this.updateSkater(e, dt);
    this.separate();
    this.updatePuck(dt);
    for (const f of this.fans) f.position.y = 1.3 + Math.abs(Math.sin(this.time * (this.frozen > 0 ? 12 : 3) + f.userData.phase)) * (this.frozen > 0 ? 0.6 : 0.15);

    const target = this.camBase.clone();
    target.x += this.puck.x * 0.12;
    this.camera.position.lerp(target, Math.min(1, dt * 2));
    if (this.shake > 0) {
      this.shake -= dt;
      this.camera.position.x += (Math.random() - 0.5) * this.shake;
      this.camera.position.y += (Math.random() - 0.5) * this.shake;
    }
    this.camera.lookAt(this.camera.position.x - this.camBase.x, 0, 1);

    if (this.updateResults(dt)) return;
    if (this.frozen > 0) this.frozen -= dt;
    if (this.state === 'play' && this.frozen <= 0) {
      this.timeLeft -= dt;
      if (this.timeLeft <= 0) {
        if (!this.overtime && this.score[0] === this.score[1]) {
          this.overtime = true;
          this.timeLeft = OVERTIME;
          this.game.ui.banner(t('ball.overtime'), '', 1800);
        } else {
          this.timeLeft = 0;
          this.end();
          return;
        }
      }
    }
    if (this.state !== 'intro' && this.state !== 'results') {
      const secs = Math.max(0, Math.ceil(this.timeLeft));
      const clock = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
      this.game.ui.setTop(`<div class="pill ball-score"><span style="color:${TEAM_CSS[0]}">${t('ball.team.0')}</span><span class="big-num">${this.score[0]} - ${this.score[1]}</span><span style="color:${TEAM_CSS[1]}">${t('ball.team.1')}</span></div><div class="pill"><b>${clock}</b>${this.overtime ? ' +' : ''}</div>`);
    }
    this.game.ui.bar(this.players, (p) => {
      const e = this.ents.find((x) => x.p === p);
      return e ? `<span style="color:${TEAM_CSS[e.team]}">●</span> ${e.goals}` : '';
    });
  }
}
