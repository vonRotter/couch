import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Character } from '../../core/character.js';
import { makeGrumble } from '../../core/critters.js';
import { COLORS, PLAYER_COLORS, toon, sharedGeo } from '../../core/palette.js';
import { addLights, skyTexture, makeTree, makeCloud, makeBush, makeFlower, seeded } from '../../core/world.js';
import { t } from '../../core/i18n.js';
import { esc } from '../../core/ui.js';
import { LEVELS, parseLevel, troopersNeeded } from './levels.js';
import { makePrincess, makeDuke, makeTrooper, makeTent, mesh, GOLD } from './props.js';
import { CARDS } from './text.js';
import { say } from '../../core/voice.js';

// The campaign map: a storybook road with seven castles from the bean camp to Castle Grumblegrump.
// Stick left/right walks to any unlocked castle, [A] opens its goal card, [A] again starts it.
// Hold [B] to go back to the island. Story cards play the first time they are reached.
// Progress: roster.progress.castleCampaign = { stars: [..], won: [..], seen: { cardId: true } }.

const STEP = 10;
const HOP_SPEED = 8;
const LEAVE_HOLD = 1.2;

export function loadProgress(game) {
  const p = game.roster.progress.castleCampaign || {};
  p.stars ||= [];
  p.won ||= [];
  p.seen ||= {};
  game.roster.progress.castleCampaign = p;
  return p;
}

export function saveProgress(game, p) {
  game.roster.progress.castleCampaign = p;
  game.roster.save();
}

/** What a level asks for, with the numbers for this many players. */
export function levelGoals(index, players) {
  const lv = LEVELS[index];
  const grid = parseLevel(lv);
  const cats = grid.markers.filter((m) => m.ch === 'K').length;
  const { need, total } = troopersNeeded(lv, index, players);
  return lv.goals.map((k) => {
    if (k === 'home') return t('kc.goal.home', { n: need, total });
    if (k === 'cages') return t('kc.goal.cages', { n: lv.cages.length });
    if (k === 'gate') return t('kc.goal.gate');
    if (k === 'catapults') return t('kc.goal.catapults', { n: cats });
    return t('kc.goal.princess');
  });
}

export class CampaignMap {
  constructor(scene, opts, start) {
    this.s = scene;
    this.game = scene.game;
    this.start = start;
    this.prog = scene.prog;
    const S = scene.scene;
    S.background = skyTexture('#8fd8ff', '#fff3d9');
    this.lights = addLights(S, { size: 40, target: new THREE.Vector3(30, 0, 0), dir: new THREE.Vector3(-0.4, 1, 0.6) });
    this.nodes = LEVELS.map((lv, i) => ({ i, lv, pos: new THREE.Vector3(i * STEP, 0.3, i % 2 ? -1.2 : 1.2) }));
    this.buildWorld();
    this.beans = new Map();
    for (const p of scene.players) this.spawnBean(p);
    this.holdB = new Map();
    this.state = 'map';
    this.stateT = 0;
    this.walk = null;
    const res = opts.result || null;
    this.selected = res ? res.level : this.maxUnlocked();
    this.camX = this.nodes[this.selected].pos.x;
    this.placeBeans(this.selected, true);
    this.nodeLabel = this.game.ui.label('label kc-node');
    this.hintEl = this.game.ui.label('story-hint kc-maphint');
    this.game.audio.playMusic('hub');
    this.frame();
    if (res) this.showResult(res);
    else this.later(0.5, () => this.maybeCards(this.selected));
  }

  later(s, fn) { this.s.later(s, fn); }

  unlocked(i) { return i === 0 || !!this.prog.won[i - 1]; }

  maxUnlocked() {
    let i = 0;
    while (i + 1 < LEVELS.length && this.unlocked(i + 1)) i++;
    return i;
  }

  totalStars() { return LEVELS.reduce((s, _, i) => s + (this.prog.stars[i] || 0), 0); }

  // ---------- world ----------

  buildWorld() {
    const S = this.s.scene;
    const rand = seeded(77);
    const len = (LEVELS.length - 1) * STEP;
    const land = mesh(new RoundedBoxGeometry(len + 30, 1.4, 16, 3, 0.6), toon(COLORS.grass), len / 2, -0.7, 0);
    land.receiveShadow = true;
    const under = mesh(new RoundedBoxGeometry(len + 26, 3, 13, 2, 0.8), toon(COLORS.dirt), len / 2, -2.6, 0);
    S.add(land, under);
    // The road between the castles.
    for (let i = 0; i + 1 < this.nodes.length; i++) {
      const a = this.nodes[i].pos, b = this.nodes[i + 1].pos;
      for (let k = 0; k <= 8; k++) {
        const p = a.clone().lerp(b, k / 8);
        const st = mesh(sharedGeo('kmStone', () => new THREE.CylinderGeometry(0.45, 0.5, 0.12, 10)), toon(COLORS.sand), p.x, 0.04, p.z);
        st.receiveShadow = true;
        S.add(st);
      }
    }
    this.nodes.forEach((n) => {
      const pad = mesh(sharedGeo('kmPad', () => new THREE.CylinderGeometry(1.6, 1.8, 0.3, 24)), toon(n.lv.finale ? GOLD : 0xc9c0dd), n.pos.x, 0.15, n.pos.z);
      pad.receiveShadow = true;
      S.add(pad);
      const castle = this.makeCastle(n.i);
      castle.position.set(n.pos.x, 0.3, n.pos.z - 3.2);
      S.add(castle);
      n.castle = castle;
      const lock = new THREE.Group();
      lock.add(mesh(sharedGeo('kmLockB', () => new RoundedBoxGeometry(0.9, 0.75, 0.4, 2, 0.12)), toon(0x9a94b2), 0, 0, 0));
      const sh = mesh(sharedGeo('kmLockS', () => new THREE.TorusGeometry(0.28, 0.08, 8, 16, Math.PI)), toon(0x9a94b2), 0, 0.38, 0);
      lock.add(sh);
      lock.position.set(n.pos.x, 2.2, n.pos.z);
      S.add(lock);
      n.lock = lock;
    });
    // The bean camp at the start and a princess on the last castle.
    const tent = makeTent();
    tent.position.set(-6, 0, 1.5);
    S.add(tent);
    this.topPrincess = makePrincess();
    const last = this.nodes[this.nodes.length - 1];
    this.topPrincess.group.position.set(last.pos.x, 7.1, last.pos.z - 3.2);
    this.topPrincess.group.scale.setScalar(0.9);
    S.add(this.topPrincess.group);
    // Decor away from the road.
    for (let k = 0; k < 60; k++) {
      const x = -12 + rand() * (len + 24), z = (rand() - 0.5) * 14;
      if (this.nodes.some((n) => Math.abs(n.pos.x - x) < 4.5 && z > n.pos.z - 5.5)) continue;
      if (Math.abs(z - (Math.floor(x / STEP) % 2 ? -1.2 : 1.2)) < 1.4) continue;
      const r = rand();
      const o = r < 0.35 ? makeTree(rand, 0.7 + rand() * 0.4) : r < 0.65 ? makeBush(rand, 0.6 + rand() * 0.3) : makeFlower(rand);
      o.position.set(x, 0, z);
      S.add(o);
    }
    this.clouds = [];
    for (let k = 0; k < 10; k++) {
      const cl = makeCloud(rand, 1.4 + rand());
      cl.position.set(-15 + k * 9 + rand() * 4, 9 + rand() * 4, -14 - rand() * 6);
      S.add(cl);
      this.clouds.push(cl);
    }
    // Story actors, hidden until a card needs them.
    this.princess = makePrincess();
    this.duke = makeDuke(1.8);
    this.duke.setHappy(false);
    this.princess.group.visible = false;
    this.duke.group.visible = false;
    S.add(this.princess.group, this.duke.group);
    this.extras = [];
  }

  /** Castles grow along the road; the last one is golden. */
  makeCastle(i) {
    const g = new THREE.Group();
    const fin = LEVELS[i].finale;
    const wall = toon(fin ? 0xffe9a8 : 0xc9c0dd);
    const roof = toon(fin ? 0xff7eb6 : [0x8a63f0, 0x4cc9f0, 0xff7a59][i % 3]);
    const w = 2 + Math.min(i, 4) * 0.35;
    if (i === 0) {
      // Level 1 is open meadow: a bridge over a little river.
      g.add(mesh(new THREE.BoxGeometry(4, 0.1, 1.6), toon(COLORS.water), 0, 0.05, 0));
      g.add(mesh(sharedGeo('kmBridge', () => new RoundedBoxGeometry(1.6, 0.25, 1.9, 2, 0.08)), toon(0xe2a96b), 0, 0.35, 0));
      return g;
    }
    if (i === 1) {
      g.add(mesh(new RoundedBoxGeometry(3, 2.4, 2, 2, 0.3), toon(COLORS.dirt), 0, 1.2, 0));
      g.add(mesh(new THREE.BoxGeometry(3.05, 0.25, 2.05), toon(COLORS.grass), 0, 2.45, 0));
      const lad = mesh(new THREE.BoxGeometry(0.6, 2.4, 0.1), toon(0xc98b5a), -0.6, 1.2, 1.05);
      g.add(lad);
      return g;
    }
    g.add(mesh(new THREE.BoxGeometry(w, 1.8, 1.4), wall, 0, 0.9, 0));
    const towerH = 2.4 + i * 0.25 + (fin ? 1.5 : 0);
    for (const sx of [-1, 1]) {
      g.add(mesh(new THREE.CylinderGeometry(0.45, 0.5, towerH, 10), wall, sx * w / 2, towerH / 2, 0));
      g.add(mesh(new THREE.ConeGeometry(0.62, 0.9, 10), roof, sx * w / 2, towerH + 0.45, 0));
    }
    if (fin) {
      g.add(mesh(new THREE.CylinderGeometry(0.7, 0.8, 5, 12), wall, 0, 2.5, -0.3));
      g.add(mesh(new THREE.ConeGeometry(0.95, 1.2, 12), roof, 0, 5.6, -0.3));
    }
    g.add(mesh(new THREE.BoxGeometry(0.7, 1, 0.1), toon(0x7a5a3a), 0, 0.5, 0.72));
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    return g;
  }

  spawnBean(p) {
    const ch = new Character(p.color, { hat: p.hat });
    this.s.scene.add(ch.group);
    this.beans.set(p, { ch, pos: new THREE.Vector3(), target: new THREE.Vector3(), hop: 0 });
    if (this.nodes) this.placeBeans(this.selected ?? 0, true);
  }

  placeBeans(i, snap = false) {
    const n = this.nodes[i];
    const list = [...this.beans.values()];
    list.forEach((b, k) => {
      const x = n.pos.x + (k - (list.length - 1) / 2) * 0.9;
      b.target.set(x, 0.3, n.pos.z + 1.1 + (k % 2) * 0.3);
      if (snap) b.pos.copy(b.target);
    });
  }

  walkTo(i) {
    this.selected = i;
    this.placeBeans(i);
    this.walk = true;
    this.game.audio.play('jump');
  }

  // ---------- story cards ----------

  /** Cards that belong before a level, the first time it is reached. */
  maybeCards(i, after = () => {}) {
    const id = i === 0 ? 'intro' : i === 3 ? 'mid' : i === LEVELS.length - 1 ? 'finale' : null;
    if (id && !this.prog.seen[id]) this.playCards(id, after);
    else after();
  }

  playCards(id, done) {
    this.prog.seen[id] = true;
    saveProgress(this.game, this.prog);
    this.state = 'card';
    this.stateT = 0;
    this.cards = { id, seq: CARDS[id], i: 0, done };
    this.showCard();
    this.game.audio.play('whoosh');
  }

  showCard() {
    const C = this.cards;
    const page = C.seq[C.i];
    const n = this.nodes[this.selected];
    // Actors: princess and duke stand behind the beans.
    const who = page.who || [];
    const P = this.princess, D = this.duke;
    P.group.visible = who.includes('princess');
    D.group.visible = who.includes('duke');
    P.group.position.set(n.pos.x - 1.6, 0.3, n.pos.z - 0.6);
    D.group.position.set(n.pos.x + 1.8, 0.3, n.pos.z - 0.8);
    D.setHappy(!!page.happy);
    for (const ex of this.extras) this.s.scene.remove(ex.group);
    this.extras = [];
    if (page.party) {
      // Friendly grumbles and troopers join the party.
      for (let k = 0; k < 6; k++) {
        const isG = k % 2 === 0;
        const g = isG ? makeGrumble(0xff9fd0) : makeTrooper(k).group;
        const group = new THREE.Group();
        group.add(g);
        group.position.set(n.pos.x - 4 + k * 1.6, 0.3, n.pos.z - 2.2);
        this.s.scene.add(group);
        this.extras.push({ group, phase: k });
      }
    }
    this.partyT = page.party ? 0 : null;
    const last = C.i === C.seq.length - 1;
    const dots = C.seq.length > 1 ? `<span class="dots">${C.seq.map((_, i) => `<i class="${i === C.i ? 'on' : ''}"></i>`).join('')}</span>` : '';
    const speaker = page.speaker ? `<div class="speaker" style="background:${page.speaker === 'duke' ? '#6a4fd0' : page.speaker === 'princess' ? '#e0a100' : '#3d84e8'}">${esc(t(`kc.speaker.${page.speaker}`))}</div>` : '';
    const lines = page.lines.map((k) => {
      const s = t(k);
      return `<div class="line ${/^["«“]/.test(s) ? 'say' : ''}">${esc(s)}</div>`;
    }).join('');
    say(page.lines.map((k) => t(k)).join(' '));
    const html = `${speaker}${lines}<div class="foot">${dots}<span class="blink">${esc(t(last ? 'kc.cardLast' : 'kc.cardNext'))}</span></div>`;
    if (!this.cardEl) this.cardEl = this.game.ui.label('story-card kc-card');
    this.cardEl.innerHTML = html;
    this.cardEl.classList.remove('story-anim');
    void this.cardEl.offsetWidth;
    this.cardEl.classList.add('story-anim');
  }

  updateCards(dt) {
    this.stateT += dt;
    if (this.partyT !== null) {
      this.partyT -= dt;
      if (this.partyT <= 0) {
        this.partyT = 0.5;
        const n = this.nodes[this.selected];
        this.s.confetti.burst(n.pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 6, 3.5, -1)), 0, { count: 30, speed: 7, colors: PLAYER_COLORS.map((c) => c.hex).concat(GOLD), life: 1.6 });
      }
    }
    for (const ex of this.extras) ex.group.position.y = 0.3 + Math.abs(Math.sin(this.s.time * 6 + ex.phase)) * 0.5;
    if (this.stateT > 0.35 && this.anyPressed('aPressed')) {
      this.stateT = 0;
      this.game.audio.play('select');
      const C = this.cards;
      if (C.i + 1 < C.seq.length) { C.i++; this.showCard(); return; }
      this.cards = null;
      this.cardEl?.remove();
      this.cardEl = null;
      this.princess.group.visible = this.duke.group.visible = false;
      for (const ex of this.extras) this.s.scene.remove(ex.group);
      this.extras = [];
      this.partyT = null;
      this.state = 'map';
      this.stateT = 0;
      C.done();
    }
  }

  // ---------- goal card ----------

  openGoal(i) {
    this.state = 'goal';
    this.stateT = 0;
    this.goalIndex = i;
    this.renderGoal();
    this.game.audio.play('select');
  }

  renderGoal() {
    const i = this.goalIndex;
    const lv = LEVELS[i];
    const goals = levelGoals(i, Math.max(1, this.s.players.length));
    const best = this.prog.stars[i] || 0;
    const par = `${Math.floor(lv.par / 60)}:${String(lv.par % 60).padStart(2, '0')}`;
    const html = `<div class="story-kicker">${esc(t('kc.levelN', { n: i + 1 }))} · ${esc(t(`kc.mech.${lv.mech}`))}</div>
      <div class="results-title">${esc(t(`kc.level.${lv.id}`))}</div>
      <div class="results-sub" style="max-width:40ch;margin:0 auto 8px">${esc(t(`kc.story.${lv.id}`))}</div>
      <div class="kc-goals">${goals.map((g) => `<div>⚑ ${esc(g)}</div>`).join('')}</div>
      <div class="kc-tiers on">
        <span class="on">★ ${esc(t('kc.tier.goal'))}</span><span class="on">★ ${esc(t('kc.tier.all'))}</span><span class="on">★ ${esc(t('kc.tier.fast', { t: par }))}</span>
      </div>
      <div class="results-sub">${esc(t(`kc.tip.${lv.mech}`))}</div>
      ${best ? `<div class="results-sub">${esc(t('kc.best'))} ${'★'.repeat(best)}${'☆'.repeat(3 - best)}</div>` : ''}
      <div class="results-footer blink" style="margin-top:10px">${esc(t('kc.goalHint'))}</div>`;
    say(`${t(`kc.level.${lv.id}`)}. ${t(`kc.story.${lv.id}`)} ${goals.join('. ')}.`);
    if (!this.panelEl) this.panelEl = this.game.ui.panel(html, 'panel kc-goal');
    else this.panelEl.innerHTML = html;
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
      this.game.audio.play('join');
      this.start(this.goalIndex);
    } else if (this.players().some((p) => { const d = this.s.input(p); return d?.bPressed; })) {
      this.closePanel();
      this.state = 'map';
      this.stateT = 0;
      this.game.audio.play('select');
    }
  }

  // ---------- coming back from a level ----------

  showResult(res) {
    const i = res.level;
    if (!res.won) return;
    this.game.audio.play('fanfare');
    const n = this.nodes[i];
    for (let k = 0; k < res.stars; k++) this.later(0.3 + k * 0.25, () => this.game.audio.play('star'));
    this.later(0.4, () => this.s.confetti.burst(n.pos.clone().setY(2.5), 0, { count: 50, speed: 8, colors: PLAYER_COLORS.map((c) => c.hex).concat(GOLD) }));
    const next = i + 1;
    if (i === LEVELS.length - 1 && !this.prog.seen.end) {
      this.later(1.2, () => { if (this.state === 'map') this.playCards('end', () => {}); });
    } else if (next < LEVELS.length && this.unlocked(next) && !(this.prog.stars[next] > 0)) {
      this.later(0.9, () => {
        if (this.state !== 'map') return;
        this.game.ui.toast(t('kc.unlocked'), 2000);
        this.walkTo(next);
      });
    }
  }

  // ---------- input and frame ----------

  players() { return this.s.players; }

  anyPressed(btn) {
    return this.players().some((p) => this.s.input(p)?.[btn]);
  }

  handleJoins() {
    const roster = this.game.roster;
    for (const d of this.game.input.joinRequests()) {
      if (roster.has(d.id)) continue;
      const p = roster.join(d);
      if (!p) continue;
      this.spawnBean(p);
      this.game.audio.play('join');
      this.game.ui.toast(t('hub.joined', { name: p.name }));
      if (this.state === 'goal') this.renderGoal();
    }
  }

  updateMap(dt) {
    this.stateT += dt;
    const max = this.maxUnlocked();
    for (const p of this.players()) {
      const inp = this.s.input(p);
      if (!inp) continue;
      if (inp.stepX && !this.walk) {
        const to = THREE.MathUtils.clamp(this.selected + inp.stepX, 0, max);
        if (to !== this.selected) this.walkTo(to);
        else this.game.audio.play('bump');
      }
      const hb = inp.b ? (this.holdB.get(p) || 0) + dt : 0;
      this.holdB.set(p, hb);
      if (hb > LEAVE_HOLD) {
        this.state = 'leaving';
        this.game.goHub('castle');
        return;
      }
      if (inp.aPressed && !this.walk && this.stateT > 0.3) {
        const i = this.selected;
        this.maybeCards(i, () => this.openGoal(i));
        return;
      }
    }
  }

  updateBeans(dt) {
    let moving = false;
    for (const b of this.beans.values()) {
      const d = b.target.clone().sub(b.pos);
      const dist = Math.hypot(d.x, d.z);
      const step = Math.min(dist, HOP_SPEED * dt);
      if (dist > 0.02) {
        b.pos.addScaledVector(d.setY(0).normalize(), step);
        b.ch.face(d.x, d.z);
        moving = true;
        b.hop += dt * 12;
      } else {
        b.ch.face(0, 1);
        b.hop = 0;
      }
      const y = dist > 0.02 ? Math.abs(Math.sin(b.hop)) * 0.4 : 0;
      b.ch.group.position.set(b.pos.x, b.pos.y + y, b.pos.z);
      b.ch.update(dt, { moving: dist > 0.02 ? 1 : 0, grounded: true });
    }
    if (this.walk && !moving) {
      this.walk = null;
      this.game.audio.play('land');
      this.stateT = 0;
    }
  }

  frame() {
    const cam = this.s.camera;
    const d = Math.max(17, this.s.fitDistance(24, 11) * 0.9);
    this.camOff = new THREE.Vector3(0, d * 0.45, d);
    cam.position.set(this.camX, this.camOff.y, this.camOff.z);
    cam.lookAt(this.camX, 1.2, -1);
  }

  updateCamera(dt) {
    const tx = this.nodes[this.selected].pos.x;
    this.camX += (tx - this.camX) * Math.min(1, dt * 3);
    const cam = this.s.camera;
    cam.position.set(this.camX, this.camOff.y, this.camOff.z);
    cam.lookAt(this.camX, 1.2, -1);
    this.s.confettiOrigin = new THREE.Vector3(this.camX, 4, 0);
    const sun = this.lights.sun;
    sun.position.set(this.camX - 16, 40, 24);
    sun.target.position.set(this.camX, 0, 0);
  }

  updateLabels() {
    const n = this.nodes[this.selected];
    const show = this.state === 'map';
    this.nodeLabel.style.display = show ? '' : 'none';
    if (show) {
      const got = this.prog.stars[n.i] || 0;
      const html = `${esc(t('kc.levelN', { n: n.i + 1 }))}: ${esc(t(`kc.level.${n.lv.id}`))}<small>${'★'.repeat(got)}${'☆'.repeat(3 - got)}</small>`;
      if (this.nodeLabel.innerHTML !== html) this.nodeLabel.innerHTML = html;
      this.game.ui.place(this.nodeLabel, n.pos.clone().setY(n.lv.finale ? 8.6 : 5.2).setZ(n.pos.z - 3), this.s.camera);
    }
    const max = LEVELS.length * 3;
    this.game.ui.setTop(`<div class="pill hud-title">${esc(t('kc.title'))}</div><div class="pill"><span class="star-icon"></span> <b>${this.totalStars()}</b> / ${max}</div>`);
    const hint = this.state === 'map' ? `${esc(t('kc.mapHint'))}<br><small>${esc(t('kc.mapJoin'))}</small>` : '';
    if (this.hintEl.innerHTML !== hint) this.hintEl.innerHTML = hint;
    this.game.ui.bar(this.players(), () => '');
  }

  onLanguage() {
    if (this.state === 'goal') this.renderGoal();
    if (this.cards) this.showCard();
  }

  idle(dt) {
    this.updateBeans(dt);
    this.updateCamera(dt);
  }

  update(dt) {
    for (const n of this.nodes) {
      const open = this.unlocked(n.i);
      n.lock.visible = !open && this.state !== 'card';
      n.lock.rotation.y += dt;
      n.castle.scale.setScalar(n.i === this.selected && this.state === 'map' ? 1 + Math.sin(this.s.time * 4) * 0.02 : 1);
    }
    for (const c of this.clouds) { c.position.x += dt * 0.4; if (c.position.x > 85) c.position.x = -20; }
    this.topPrincess.group.visible = !this.prog.won[LEVELS.length - 1];
    this.topPrincess.update(dt, { moving: 0 });
    this.topPrincess.faceSide(Math.sin(this.s.time) > 0 ? 1 : -1);
    if (this.princess.group.visible) { this.princess.update(dt, { moving: 0 }); this.princess.face(0.4, 1); }
    if (this.duke.group.visible) this.duke.pivot.position.y = Math.abs(Math.sin(this.s.time * 5)) * 0.15;
    this.updateBeans(dt);
    this.updateCamera(dt);
    if (this.state === 'map') this.updateMap(dt);
    else if (this.state === 'card') this.updateCards(dt);
    else if (this.state === 'goal') this.updateGoal(dt);
    if (this.state !== 'leaving') this.handleJoins();
    if (this.players().length === 0 && this.state !== 'leaving') { this.state = 'leaving'; this.game.goHub('castle'); }
    this.updateLabels();
  }

  dispose() {
    this.cardEl?.remove();
  }
}
