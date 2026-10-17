import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { MiniGame } from '../core/minigame.js';
import { Character } from '../core/character.js';
import { makeGrumble } from '../core/critters.js';
import { COLORS, PLAYER_COLORS, toon, sharedGeo } from '../core/palette.js';
import { addLights, skyTexture, makeTree, makeCloud, seeded, soccerBallTexture } from '../core/world.js';
import { t } from '../core/i18n.js';
import { TeamPicker, TEAM_COLORS, TEAM_CSS, helpersNeeded } from '../core/teams.js';

// Mega Ball: beans and a giant ball, two teams, Rocket League spirit.
const HX = 18, HZ = 11; // pitch half size
const GOAL_W = 3.6, GOAL_H = 3.6, GOAL_D = 3;
const R = 1.3; // ball radius
const PR = 0.45;
const SPEED = 7.5;
const DASH = 15;
const MATCH_TIME = 150;
const OVERTIME = 60;

export class FootballScene extends MiniGame {
  constructor(game, opts) {
    super(game, opts);
    this.camera.fov = 40;
    this.scene.background = skyTexture('#7fd0ff', '#e8f8ff');
    addLights(this.scene, { size: 26, dir: new THREE.Vector3(-0.3, 1, 0.45) });
    this.buildPitch();

    this.score = [0, 0];
    this.timeLeft = MATCH_TIME;
    this.overtime = false;
    this.frozen = 0;
    this.lastTouch = null;

    this.ball = { x: 0, y: R, z: 0, vx: 0, vy: 0, vz: 0 };
    this.ballMesh = new THREE.Mesh(new THREE.SphereGeometry(R, 32, 20), new THREE.MeshToonMaterial({ map: soccerBallTexture(), gradientMap: toon(0xffffff).gradientMap }));
    this.ballMesh.castShadow = true;
    this.scene.add(this.ballMesh);
    this.ballMarker = new THREE.Mesh(sharedGeo('ballMark', () => new THREE.RingGeometry(R * 0.85, R, 28)), toon(COLORS.white, { transparent: true, opacity: 0.6 }));
    this.ballMarker.rotation.x = -Math.PI / 2;
    this.scene.add(this.ballMarker);

    this.ents = this.players.map((p, i) => this.makePlayer(p, i % 2));
    this.frame();
    game.audio.playMusic('paint');
    this.state = 'teams';
    this.openTeamPicker();
  }

  makePlayer(p, team) {
    const ch = p ? new Character(p.color, { hat: p.hat }) : { group: makeGrumble(TEAM_COLORS[team]), update() {}, face() {}, squash() {}, yaw: 0 };
    if (!p) ch.group.scale.setScalar(1.35);
    this.scene.add(ch.group);
    const ring = new THREE.Mesh(sharedGeo('teamRing', () => new THREE.RingGeometry(0.55, 0.78, 24)), toon(TEAM_COLORS[team]));
    ring.rotation.x = -Math.PI / 2;
    this.scene.add(ring);
    return {
      p, bot: !p, ch, ring, team,
      x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, dirX: team ? -1 : 1, dirZ: 0,
      grounded: true, kickCd: 0, dashT: 0, dashCd: 0, goals: 0, kicks: 0,
      get name() { return p ? p.name : t('ball.keeper'); },
      css: p ? p.css : TEAM_CSS[team],
    };
  }

  setTeam(e, team) {
    e.team = team;
    e.ring.material = toon(TEAM_COLORS[team]);
  }

  // ---------- team picker ----------

  openTeamPicker() {
    this.picker = new TeamPicker(this, {
      title: () => t('game.football'),
      ents: this.ents,
      setTeam: (e, team) => this.setTeam(e, team),
      onChange: () => this.kickoffPositions(),
      onDone: () => {
        this.picker = null;
        this.addKeepers();
        this.kickoffPositions();
        this.intro(t('game.football'), t('ball.intro'));
      },
    });
    this.kickoffPositions();
  }

  onLanguage() {
    this.picker?.render();
  }

  /** The smaller team gets helper keepers so sides feel even. */
  addKeepers() {
    helpersNeeded(this.ents).forEach((need, team) => {
      for (let i = 0; i < need; i++) this.ents.push(this.makePlayer(null, team));
    });
  }

  // ---------- pitch ----------

  frame() {
    const tilt = THREE.MathUtils.degToRad(54);
    const d = this.fitDistance(HX * 2 + GOAL_D * 2 + 3, HZ * 2 * Math.sin(tilt) + 8);
    this.camBase = new THREE.Vector3(0, Math.sin(tilt) * d, Math.cos(tilt) * d + 1);
    this.camera.position.copy(this.camBase);
    this.camera.lookAt(0, 0, 1);
    this.confettiOrigin = new THREE.Vector3(0, 4, 0);
  }

  resize(w, h) {
    super.resize(w, h);
    this.frame();
  }

  buildPitch() {
    const s = this.scene;
    // Striped grass with lines, drawn on a canvas.
    const c = document.createElement('canvas');
    c.width = 1024; c.height = 640;
    const g = c.getContext('2d');
    for (let i = 0; i < 12; i++) {
      g.fillStyle = i % 2 ? '#6fcf55' : '#7ad65a';
      g.fillRect((i * 1024) / 12, 0, 1024 / 12 + 1, 640);
    }
    g.strokeStyle = 'rgba(255,255,255,0.9)';
    g.lineWidth = 8;
    const sx = 1024 / (HX * 2), sz = 640 / (HZ * 2);
    g.strokeRect(6, 6, 1012, 628);
    g.beginPath(); g.moveTo(512, 0); g.lineTo(512, 640); g.stroke();
    g.beginPath(); g.arc(512, 320, 4 * sx, 0, Math.PI * 2); g.stroke();
    for (const side of [0, 1]) {
      const x = side ? 1024 - 5 * sx : 0;
      g.strokeRect(x, 320 - 6 * sz, 5 * sx, 12 * sz);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    const pitch = new THREE.Mesh(new THREE.PlaneGeometry(HX * 2, HZ * 2), new THREE.MeshToonMaterial({ map: tex, gradientMap: toon(0xffffff).gradientMap }));
    pitch.rotation.x = -Math.PI / 2;
    pitch.receiveShadow = true;
    s.add(pitch);
    const base = new THREE.Mesh(new RoundedBoxGeometry(HX * 2 + GOAL_D * 2 + 3, 1, HZ * 2 + 3, 3, 0.4), toon(COLORS.candyLilac));
    base.position.y = -0.52;
    base.receiveShadow = true;
    s.add(base);

    // Boards around the pitch, with gaps for the goals.
    const board = (x, z, w, d, color) => {
      const m = new THREE.Mesh(new RoundedBoxGeometry(w, 1.1, d, 2, 0.3), toon(color));
      m.position.set(x, 0.45, z);
      m.castShadow = m.receiveShadow = true;
      s.add(m);
    };
    board(0, -HZ - 0.5, HX * 2 + 1, 1, COLORS.candyPink);
    board(0, HZ + 0.5, HX * 2 + 1, 1, COLORS.candyBlue);
    const endLen = HZ - GOAL_W;
    for (const sx2 of [-1, 1]) {
      for (const sz2 of [-1, 1]) board(sx2 * (HX + 0.5), sz2 * (GOAL_W + endLen / 2), 1, endLen, sx2 < 0 ? COLORS.candyYellow : COLORS.candyMint);
    }

    // Goals.
    for (const side of [-1, 1]) {
      const team = side < 0 ? 0 : 1;
      const g2 = new THREE.Group();
      g2.position.set(side * HX, 0, 0);
      const post = sharedGeo('fbPost', () => new THREE.CylinderGeometry(0.18, 0.18, GOAL_H, 12));
      for (const z of [-GOAL_W, GOAL_W]) {
        const m = new THREE.Mesh(post, toon(COLORS.white));
        m.position.set(0, GOAL_H / 2, z);
        m.castShadow = true;
        g2.add(m);
      }
      const bar = new THREE.Mesh(sharedGeo('fbBar', () => new THREE.CylinderGeometry(0.18, 0.18, GOAL_W * 2, 12)), toon(COLORS.white));
      bar.rotation.x = Math.PI / 2;
      bar.position.y = GOAL_H;
      const net = new THREE.Mesh(sharedGeo('fbNet', () => new THREE.BoxGeometry(GOAL_D, GOAL_H, GOAL_W * 2)), toon(TEAM_COLORS[team], { transparent: true, opacity: 0.28 }));
      net.position.set(side * GOAL_D / 2, GOAL_H / 2, 0);
      const floor = new THREE.Mesh(sharedGeo('fbGoalFloor', () => new THREE.PlaneGeometry(GOAL_D, GOAL_W * 2)), toon(TEAM_COLORS[team]));
      floor.rotation.x = -Math.PI / 2;
      floor.position.set(side * GOAL_D / 2, 0.01, 0);
      g2.add(bar, net, floor);
      s.add(g2);
    }

    // Stands with cheering beans.
    this.fans = [];
    const rand = seeded(13);
    const fanGeo = sharedGeo('fan', () => new THREE.CapsuleGeometry(0.32, 0.3, 4, 10));
    for (const side of [-1, 1]) {
      const stand = new THREE.Mesh(new RoundedBoxGeometry(HX * 2 + 4, 1.4, 3.4, 2, 0.3), toon(0xe9e2ff));
      stand.position.set(0, 0.2, side * (HZ + 3.4));
      s.add(stand);
      if (side > 0) continue; // the near stand would block the view; keep it empty
      for (let i = 0; i < 34; i++) {
        const fan = new THREE.Mesh(fanGeo, toon(PLAYER_COLORS[Math.floor(rand() * 6)].hex));
        fan.position.set(-HX - 1 + rand() * (HX * 2 + 2), 1.3, side * (HZ + 2.6 + rand() * 1.4));
        fan.userData.phase = rand() * 6;
        s.add(fan);
        this.fans.push(fan);
      }
    }
    const ground = new THREE.Mesh(new THREE.CircleGeometry(90, 40), toon(COLORS.grassDark));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -1;
    s.add(ground);
    for (let i = 0; i < 20; i++) {
      const a = rand() * Math.PI * 2;
      const x = Math.cos(a) * (30 + rand() * 10), z = Math.sin(a) * (20 + rand() * 8) - 6;
      if (z > 8) continue;
      const tr = makeTree(rand, 1.3 + rand() * 0.6);
      tr.position.set(x, -1, z);
      s.add(tr);
    }
    for (let i = 0; i < 6; i++) {
      const cl = makeCloud(rand, 2.5 + rand());
      cl.position.set(-45 + i * 18, 14 + rand() * 6, -35);
      s.add(cl);
    }
  }

  kickoffPositions() {
    for (const team of [0, 1]) {
      const members = this.ents.filter((e) => e.team === team);
      const side = team ? 1 : -1;
      members.forEach((e, i) => {
        if (e.bot) {
          e.x = side * (HX - 2);
          e.z = 0;
        } else {
          const n = members.filter((m) => !m.bot).length;
          const k = members.filter((m) => !m.bot).indexOf(e);
          e.x = side * (5 + (k % 2) * 4);
          e.z = n === 1 ? 0 : -6 + (k * 12) / Math.max(1, n - 1);
        }
        e.y = 0; e.vx = e.vz = e.vy = 0;
        e.dirX = -side; e.dirZ = 0;
        e.ch.face(e.dirX, 0);
        e.ch.yaw = e.ch.targetYaw ?? 0;
        e.ch.group.position.set(e.x, 0, e.z);
        e.ring.position.set(e.x, 0.03, e.z);
      });
    }
    Object.assign(this.ball, { x: 0, y: R + 2, z: 0, vx: 0, vy: 0, vz: 0 });
    this.lastTouch = null;
  }

  // ---------- simulation ----------

  kick(e) {
    const b = this.ball;
    const dx = b.x - e.x, dz = b.z - e.z;
    const d = Math.hypot(dx, dz);
    const near = d < R + 1.4 && b.y - R < e.y + 2.2 && b.y + R > e.y - 0.2;
    if (near && e.kickCd <= 0) {
      e.kickCd = 0.35;
      let kx = dx / (d || 1) + e.dirX * 0.8, kz = dz / (d || 1) + e.dirZ * 0.8;
      const kl = Math.hypot(kx, kz) || 1;
      kx /= kl; kz /= kl;
      const power = e.bot ? 17 : 21;
      b.vx = kx * power + e.vx * 0.3;
      b.vz = kz * power + e.vz * 0.3;
      b.vy = e.grounded ? 6 : 8;
      e.kicks++;
      this.lastTouch = e;
      e.ch.squash(1.3);
      this.game.audio.play('boing');
      this.puffs.burst(new THREE.Vector3(b.x, b.y, b.z), 0xffffff, { count: 8, size: 0.35, life: 0.4 });
      return true;
    }
    return false;
  }

  updatePlayer(e, dt) {
    const playing = this.state === 'play' && this.frozen <= 0;
    let ix = 0, iz = 0, aPressed = false, bPressed = false;
    if (e.bot) {
      ({ ix, iz, aPressed, bPressed } = this.keeperBrain(e));
    } else {
      const d = this.input(e.p) || { x: 0, y: 0 };
      ix = d.x; iz = -d.y; aPressed = d.aPressed; bPressed = d.bPressed;
    }
    if (!playing) { ix = iz = 0; aPressed = bPressed = false; }
    e.kickCd -= dt; e.dashCd -= dt;
    if (Math.hypot(ix, iz) > 0.2) {
      const l = Math.hypot(ix, iz);
      e.dirX = ix / l; e.dirZ = iz / l;
    }
    if (e.dashT > 0) {
      e.dashT -= dt;
    } else {
      const acc = (e.grounded ? 45 : 22) * dt;
      const sp = e.bot ? SPEED * 0.85 : SPEED;
      e.vx += THREE.MathUtils.clamp(ix * sp - e.vx, -acc, acc);
      e.vz += THREE.MathUtils.clamp(iz * sp - e.vz, -acc, acc);
    }
    if (aPressed && e.grounded) {
      e.vy = 10.5;
      e.grounded = false;
      e.ch.squash(1.3);
      this.game.audio.play('jump');
    }
    if (bPressed && !this.kick(e) && e.dashCd <= 0) {
      e.dashT = 0.2;
      e.dashCd = 0.8;
      e.vx = e.dirX * DASH;
      e.vz = e.dirZ * DASH;
      e.ch.squash(0.8);
      this.game.audio.play('dash');
    }
    e.x += e.vx * dt;
    e.z += e.vz * dt;
    e.vy -= 28 * dt;
    e.y += e.vy * dt;
    if (e.y <= 0) {
      if (!e.grounded && e.vy < -4) e.ch.squash(0.75);
      e.y = 0; e.vy = 0; e.grounded = true;
    }
    e.x = THREE.MathUtils.clamp(e.x, -HX + PR, HX - PR);
    e.z = THREE.MathUtils.clamp(e.z, -HZ + PR, HZ - PR);

    e.ch.face(e.dirX, e.dirZ);
    e.ch.group.position.set(e.x, e.y, e.z);
    if (e.bot) e.ch.group.rotation.y = Math.atan2(e.dirX, e.dirZ);
    e.ch.update(dt, { moving: Math.min(1, Math.hypot(e.vx, e.vz) / SPEED), grounded: e.grounded, vy: e.vy });
    e.ring.position.set(e.x, 0.03, e.z);
  }

  /** Helper keeper: guard the goal mouth, clear the ball when it comes close. */
  keeperBrain(e) {
    const side = e.team ? 1 : -1;
    const b = this.ball;
    const homeX = side * (HX - 2.2);
    const threat = Math.sign(b.x) === side && Math.abs(b.x) > HX - 9;
    const tx = threat ? THREE.MathUtils.clamp(b.x, side > 0 ? HX - 6 : -HX + 1.2, side > 0 ? HX - 1.2 : -HX + 6) : homeX;
    const tz = THREE.MathUtils.clamp(b.z, -GOAL_W - 0.5, GOAL_W + 0.5);
    const dx = tx - e.x, dz = tz - e.z;
    const d = Math.hypot(dx, dz);
    const near = Math.hypot(b.x - e.x, b.z - e.z) < R + 1.5;
    if (near) { e.dirX = -side; e.dirZ = (b.z - e.z) * 0.2; }
    return {
      ix: d > 0.3 ? dx / Math.max(d, 1) : 0,
      iz: d > 0.3 ? dz / Math.max(d, 1) : 0,
      aPressed: near && b.y > 2.6 && Math.random() < 0.2,
      bPressed: near && Math.random() < 0.25,
    };
  }

  updateBall(dt) {
    const b = this.ball;
    const steps = 3;
    const h = dt / steps;
    for (let s = 0; s < steps; s++) {
      b.vy -= 20 * h;
      b.x += b.vx * h; b.y += b.vy * h; b.z += b.vz * h;
      if (b.y < R) {
        b.y = R;
        if (b.vy < -3) this.game.audio.play('land');
        b.vy = Math.abs(b.vy) > 2 ? -b.vy * 0.6 : 0;
      }
      if (b.y <= R + 0.01) {
        const f = Math.max(0, 1 - 0.7 * h);
        b.vx *= f; b.vz *= f;
      }
      if (b.y > 10 - R) { b.y = 10 - R; b.vy = -Math.abs(b.vy) * 0.6; }
      if (Math.abs(b.z) > HZ - R) { b.z = Math.sign(b.z) * (HZ - R); b.vz = -b.vz * 0.8; this.wallSound(b.vz); }
      const inMouth = Math.abs(b.z) < GOAL_W - R * 0.4 && b.y < GOAL_H - R * 0.3;
      if (Math.abs(b.x) > HX - R) {
        if (!inMouth && Math.abs(b.x) < HX + 0.5) {
          b.x = Math.sign(b.x) * (HX - R);
          b.vx = -b.vx * 0.8;
          this.wallSound(b.vx);
        } else if (Math.abs(b.x) >= HX) {
          // Inside the goal box.
          if (Math.abs(b.z) > GOAL_W - R) { b.z = Math.sign(b.z) * (GOAL_W - R); b.vz = -b.vz * 0.6; }
          if (b.y > GOAL_H - R) { b.y = GOAL_H - R; b.vy = -Math.abs(b.vy) * 0.5; }
          if (Math.abs(b.x) > HX + GOAL_D - R) { b.x = Math.sign(b.x) * (HX + GOAL_D - R); b.vx = -b.vx * 0.3; }
        }
      }
    }

    // Players push the ball (and get a little push back).
    for (const e of this.ents) {
      const dx = b.x - e.x, dz = b.z - e.z;
      const d = Math.hypot(dx, dz);
      const minD = R + PR;
      const overlapY = b.y - R < e.y + 1.25 && b.y + R > e.y;
      if (d >= minD || !overlapY || d < 1e-4) continue;
      const nx = dx / d, nz = dz / d;
      b.x = e.x + nx * minD;
      b.z = e.z + nz * minD;
      const rel = (e.vx - b.vx) * nx + (e.vz - b.vz) * nz;
      if (rel > 0) {
        b.vx += nx * rel * 1.5;
        b.vz += nz * rel * 1.5;
      }
      b.vx += nx * 1.2; b.vz += nz * 1.2;
      if (!e.grounded && e.vy > 0 && b.y > e.y + 1) b.vy = Math.max(b.vy, 7);
      e.vx -= nx * 1.5; e.vz -= nz * 1.5;
      this.lastTouch = e;
    }

    // Goals.
    if (this.state === 'play' && this.frozen <= 0) {
      if (b.x < -HX - R * 0.6) this.goal(1);
      else if (b.x > HX + R * 0.6) this.goal(0);
    }

    this.ballMesh.position.set(b.x, b.y, b.z);
    const sp = Math.hypot(b.vx, b.vz);
    if (sp > 0.05) {
      const axis = new THREE.Vector3(b.vz, 0, -b.vx).normalize();
      this.ballMesh.rotateOnWorldAxis(axis, (sp * dt) / R);
    }
    this.ballMarker.position.set(b.x, 0.04, b.z);
    this.ballMarker.scale.setScalar(Math.max(0.4, 1 - (b.y - R) / 8));
  }

  wallSound(v) {
    if (Math.abs(v) > 4) this.game.audio.play('bump');
  }

  goal(team) {
    this.score[team]++;
    const scorer = this.lastTouch && !this.lastTouch.bot && this.lastTouch.team === team ? this.lastTouch : null;
    if (scorer) scorer.goals++;
    this.frozen = 2.6;
    this.game.audio.play('fanfare');
    const side = team ? -1 : 1;
    const pos = new THREE.Vector3(side * -1 * (HX + 1), 2, 0);
    pos.x = this.ball.x;
    this.confetti.burst(pos, 0, { count: 70, speed: 10, up: 6, colors: [TEAM_COLORS[team], COLORS.white, COLORS.gold], life: 1.6 });
    this.game.ui.banner(t('ball.goal'), scorer ? t('ball.scored', { name: scorer.name, team: t(`ball.team.${team}`) }) : t(`ball.team.${team}`), 2200);
    this.shake = 0.4;
    this.later(2.6, () => {
      if (this.state !== 'play') return;
      if (this.overtime) { this.end(); return; }
      this.kickoffPositions();
      this.game.audio.play('go');
    });
  }

  end() {
    if (this.state === 'results') return;
    const [a, b] = this.score;
    const winner = a === b ? -1 : a > b ? 0 : 1;
    const ranked = this.ents.filter((e) => !e.bot).sort((x, y) => (y.team === winner) - (x.team === winner) || y.goals - x.goals || y.kicks - x.kicks);
    this.confettiOrigin = new THREE.Vector3(0, 4, 0);
    this.finish({
      title: winner < 0 ? t('ball.draw') : t('ball.winTitle', { team: t(`ball.team.${winner}`) }),
      subtitle: `${t('ball.team.0')} ${t('ball.sub', { a, b })} ${t('ball.team.1')}`,
      rows: ranked.map((e) => ({
        css: e.css, name: e.name, value: t('ball.goals', { n: e.goals }),
        detail: `${t(`ball.team.${e.team}`)} · ${t('ball.touches', { n: e.kicks })}`, crown: e.team === winner,
      })),
      stars: 2,
    });
  }

  update(dt) {
    if (this.state === 'teams') {
      this.picker?.update();
      for (const e of this.ents) { e.ch.update(dt, {}); e.ring.position.set(e.x, 0.03, e.z); }
      this.updateBall(dt);
      return;
    }
    for (const e of this.ents) this.updatePlayer(e, dt);
    // Bumping players apart.
    for (let i = 0; i < this.ents.length; i++) {
      for (let j = i + 1; j < this.ents.length; j++) {
        const a = this.ents[i], c = this.ents[j];
        const dx = c.x - a.x, dz = c.z - a.z, d = Math.hypot(dx, dz);
        if (d < PR * 2 && d > 1e-4 && Math.abs(a.y - c.y) < 1) {
          const push = (PR * 2 - d) / 2;
          a.x -= (dx / d) * push; a.z -= (dz / d) * push;
          c.x += (dx / d) * push; c.z += (dz / d) * push;
        }
      }
    }
    this.updateBall(dt);
    for (const f of this.fans) f.position.y = 1.3 + Math.abs(Math.sin(this.time * (this.frozen > 0 ? 12 : 3) + f.userData.phase)) * (this.frozen > 0 ? 0.6 : 0.15);

    // Camera drifts a little toward the ball.
    const target = this.camBase.clone();
    target.x += this.ball.x * 0.12;
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
