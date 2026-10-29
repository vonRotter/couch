import * as THREE from 'three';
import { t, tFor } from '../../core/i18n.js';
import { esc } from '../../core/ui.js';
import { say as speak } from '../../core/voice.js';
import { hourOf } from './save.js';
import { PLACES, HOME, FIELD, MUSEUM, PLAZA, HALL, CAFE, PAD, heightAt } from './map.js';
import { STAIRS } from './story.js';

// The lighthouse top (milestone B4), open after the Lamp Festival: climb the stairs door on the tower's
// side. Up on the gallery the view is your own (the island camera is not used): the stick walks you
// around the lamp and looks over the island, with names over the places you see. [A] looks through
// Keeper Bram's telescope: a night sky with eight star pictures to find. Center one in the ring, [A]
// looks closer, and you choose its name (three funny ideas, read aloud). Each one gives a few coins, all
// eight a star globe. In the daytime Pip's star filter on the telescope still shows the stars, so it
// never has to wait for the real night. Saved in save.story.stars ({ id: chosen name 0-2 }).

const LH = PLACES.find((p) => p.id === 'lighthouse');
const TOP_Y = 11.9; // the gallery, just above the rail
const SCOPE = new THREE.Vector3(LH.x, 14.3, LH.z);
const SKY_R = 150;
const NAVY = 0x0b1030;
const DEG = Math.PI / 180;

// star pictures: center (yaw from north, pitch up, in degrees), stars (x right, y up, degrees), lines
export const CONSTELLATIONS = [
  { id: 'pudding', yaw: 10, pitch: 30, stars: [[-4, 0], [4, 0], [3, 3], [0, 4.5], [-3, 3], [0, 6.5]], lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 0], [3, 5]] },
  { id: 'cat', yaw: 55, pitch: 50, stars: [[-4, 0], [0, -1], [4, 0], [5, 3], [4, 5], [6, 5], [-6, 2]], lines: [[6, 0], [0, 1], [1, 2], [2, 3], [3, 4], [3, 5]] },
  { id: 'rocket', yaw: 100, pitch: 32, stars: [[0, 6], [-1.5, 3], [1.5, 3], [-1.5, -1], [1.5, -1], [-3, -3], [3, -3]], lines: [[0, 1], [0, 2], [1, 3], [2, 4], [3, 4], [3, 5], [4, 6]] },
  { id: 'radish', yaw: 145, pitch: 52, stars: [[0, -4], [-2.5, 0], [2.5, 0], [0, 2], [-1.5, 5], [0, 6], [1.5, 5]], lines: [[0, 1], [0, 2], [1, 3], [2, 3], [3, 4], [3, 5], [3, 6]] },
  { id: 'whale', yaw: 195, pitch: 30, stars: [[-6, 0], [-3, 2], [2, 2], [5, 0], [2, -1.5], [-3, -1.5], [7, 2.5], [7, -2]], lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0], [3, 6], [3, 7]] },
  { id: 'crab', yaw: 240, pitch: 48, stars: [[-2, 0], [2, 0], [0, 2], [-4.5, 3], [4.5, 3], [-4, -2], [4, -2]], lines: [[0, 1], [1, 2], [2, 0], [0, 3], [1, 4], [0, 5], [1, 6]] },
  { id: 'owl', yaw: 285, pitch: 32, stars: [[-2, 4], [2, 4], [0, 2], [-3, 0], [3, 0], [0, -3]], lines: [[0, 2], [1, 2], [2, 3], [2, 4], [3, 5], [4, 5]] },
  { id: 'lantern', yaw: 330, pitch: 55, stars: [[0, 6], [-1, 3], [1, 3], [-1.5, -3], [1.5, -3], [-4, 4.5], [4, 4.5]], lines: [[0, 1], [0, 2], [1, 3], [2, 4], [3, 4], [1, 5], [2, 6]] },
];
const FIND_DEG = 7; // how close the ring has to be
const PRIZE = { deco: 'starGlobe', coins: 100 };

/** Unit direction for yaw (0 = north, -z; clockwise toward +x) and pitch (up). */
function dirOf(yaw, pitch, out = new THREE.Vector3()) {
  return out.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
}

function dotTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(16, 16, 1, 16, 16, 15);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.35, 'rgba(255,255,255,0.85)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
}

const CSS = `
.ltop-ui { position: absolute; inset: 0; pointer-events: none; font-weight: 700; }
.ltop-ui .ttl { position: absolute; left: 50%; top: 2vh; transform: translateX(-50%); background: rgba(255,250,240,.93); border-radius: 999px; padding: 4px 22px;
  font-size: clamp(16px, 1.7vw, 26px); color: #8a5a32; box-shadow: 0 3px 0 rgba(43,35,64,.2); white-space: nowrap; }
.ltop-ui .ttl small { font-weight: 600; opacity: .75; margin-left: 10px; font-size: .78em; color: #2b2340; }
.ltop-ui .hint { position: absolute; left: 50%; bottom: 3vh; transform: translateX(-50%); background: rgba(255,255,255,.93); border-radius: 999px; padding: 4px 18px;
  font-size: clamp(14px, 1.4vw, 22px); white-space: nowrap; box-shadow: 0 3px 0 rgba(43,35,64,.2); }
.ltop-ui .say { position: absolute; left: 50%; bottom: 10vh; transform: translateX(-50%); background: #ffd84a; border-radius: 999px; padding: 4px 18px;
  font-size: clamp(14px, 1.4vw, 22px); white-space: nowrap; box-shadow: 0 3px 0 rgba(43,35,64,.2); }
.ltop-ui .vig { position: absolute; inset: 0; background: radial-gradient(circle at 50% 48%, rgba(0,0,0,0) 0 39vh, rgba(8,10,28,.98) 41vh); }
.ltop-ui .ring { position: absolute; left: 50%; top: 48%; width: 9vh; height: 9vh; margin: -4.5vh 0 0 -4.5vh; border-radius: 50%; border: 3px solid rgba(255,255,255,.85);
  box-shadow: 0 0 12px rgba(255,255,255,.3); transition: border-color .3s, box-shadow .3s; }
.ltop-ui .ring.warm { border-color: #ffb347; box-shadow: 0 0 16px rgba(255,179,71,.6); }
.ltop-ui .ring.hot { border-color: #ffe14a; box-shadow: 0 0 26px rgba(255,225,74,.95); }
.label.isl-star { color: #ffe9a8; font-weight: 700; font-size: clamp(13px, 1.3vw, 20px); paint-order: stroke fill; -webkit-text-stroke: .2em #0b1030; white-space: nowrap; }
`;
function injectStyle() {
  if (document.getElementById('isl-top-style')) return;
  const el = document.createElement('style');
  el.id = 'isl-top-style';
  el.textContent = CSS;
  document.head.appendChild(el);
}

export class LightTop {
  constructor(host) {
    injectStyle();
    this.host = host;
    this.mode = null; // 'top' | 'scope' while up there
    this.yaw = 0;
    this.pitch = -0.2;
    this.sky = { yaw: 0, pitch: 0.6 };
    this.el = null;
    this.ready = false; // input is taken once the fade is over
    this.up = false; // the view is ours once the screen is dark
    // places to name in the view from the top
    const P = Object.fromEntries(PLACES.map((p) => [p.id, p]));
    const poi = (key, x, z, y = 3, far = false) => ({ key, pos: new THREE.Vector3(x, heightAt(x, z) + y, z), far });
    this.pois = [
      poi('story.poi.home', HOME.x, HOME.z, 4.5), poi('story.poi.farm', FIELD.x0 + 5, FIELD.z0 + 3.7, 1.5), poi('isl.museum.title', MUSEUM.x, MUSEUM.z, 5.5),
      poi('story.poi.square', PLAZA.x, PLAZA.z, 3), poi('isl.hall', HALL.x, HALL.z, 6), poi('story.poi.cafe', CAFE.x, CAFE.z, 4), poi('story.poi.pad', PAD.x, PAD.z, 4),
      poi('game.adventure', P.ship.x, P.ship.z, 7), poi('game.duckhunt', P.tent.x, P.tent.z, 6), poi('game.platformer', P.balloon.x, P.balloon.z, 8),
      poi('game.castle', P.castle.x, P.castle.z, 8), poi('game.breach', P.garage.x, P.garage.z, 6), poi('game.keep', P.keep.x, P.keep.z, 9), poi('game.cave', P.mine.x, P.mine.z, 5), poi('story.poi.meadow', 47, -11, 2),
      poi('story.poi.isle', 0, 190, 3, true),
    ].map((p) => ({ ...p, el: host.game.ui.label('label isl-tag') }));
    for (const p of this.pois) p.el.style.display = 'none';
    this.buildSky();
  }

  get S() { return this.host.save.story; }
  get found() { return CONSTELLATIONS.filter((c) => this.S.stars[c.id] !== undefined).length; }

  // ---------- the night sky ----------

  buildSky() {
    this.sky3 = new THREE.Group();
    this.sky3.position.copy(SCOPE);
    this.sky3.visible = false;
    this.tex = dotTexture();
    const rand = (() => { let a = 99; return () => { a = (a * 16807) % 2147483647; return a / 2147483647; }; })();
    // background stars: the upper half of the sky
    const bg = [];
    const v = new THREE.Vector3();
    for (let i = 0; i < 700; i++) { dirOf(rand() * Math.PI * 2, Math.asin(0.05 + rand() * 0.95), v); bg.push(v.x * SKY_R, v.y * SKY_R, v.z * SKY_R); }
    const pm = (size, color) => new THREE.PointsMaterial({ size, color, map: this.tex, transparent: true, depthWrite: false, fog: false });
    const bgGeo = new THREE.BufferGeometry();
    bgGeo.setAttribute('position', new THREE.Float32BufferAttribute(bg, 3));
    this.sky3.add(new THREE.Points(bgGeo, pm(1.5, 0xdfe6ff)));
    // the star pictures
    this.cons = CONSTELLATIONS.map((c) => {
      const pts = c.stars.map(([dx, dy]) => {
        const pitch = (c.pitch + dy) * DEG, yaw = c.yaw * DEG + (dx * DEG) / Math.cos(c.pitch * DEG);
        return dirOf(yaw, pitch).multiplyScalar(SKY_R);
      });
      const g = new THREE.BufferGeometry().setFromPoints(pts);
      const stars = new THREE.Points(g, pm(3.4, 0xfff6d8));
      const seg = [];
      for (const [a, b] of c.lines) seg.push(pts[a], pts[b]);
      const lm = new THREE.LineBasicMaterial({ color: 0xffd36a, transparent: true, opacity: 0, fog: false, depthWrite: false });
      const lines = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(seg), lm);
      this.sky3.add(stars, lines);
      const center = dirOf(c.yaw * DEG, c.pitch * DEG);
      const label = this.host.game.ui.label('label isl-star');
      label.style.display = 'none';
      return { c, lines, center, label, labelPos: center.clone().multiplyScalar(SKY_R).add(SCOPE).add(new THREE.Vector3(0, -9, 0)), glow: 0 };
    });
    this.host.scene.add(this.sky3);
  }

  // ---------- going up and down ----------

  enter() {
    const host = this.host, S = this.S;
    if (this.mode) return;
    this.mode = 'top';
    this.ready = false;
    host.mode = 'top';
    host.hud.setPrompt('');
    host.game.audio.play('whoosh');
    host.story.fadeTo(1, 0.45, '', () => {
      this.up = true;
      S.topVisits = (S.topVisits || 0) + 1;
      // face the town
      this.yaw = Math.atan2(PLAZA.z - LH.z, PLAZA.x - LH.x);
      this.pitch = -0.2;
      host.player.ch.group.visible = false;
      host.map.lighthouse.userData.beam.visible = false; // the beam would sweep through our eyes
      host.hud.setCinema(true); // the dialog box stays for the talking up here
      this.showOverlay();
      this.place();
      host.story.fadeTo(0, 0.45, '', () => {
        this.ready = true;
        if (S.topVisits === 1) host.say([{ key: 'story.top.first' }], () => { host.mode = 'top'; });
      });
    });
  }

  exit() {
    const host = this.host;
    this.ready = false;
    host.game.audio.play('whoosh');
    host.story.fadeTo(1, 0.45, '', () => {
      this.up = false;
      this.leaveScope();
      this.mode = null;
      this.el?.remove();
      this.el = null;
      for (const p of this.pois) p.el.style.display = 'none';
      const P = host.player;
      const a = Math.atan2(STAIRS.z - LH.z, STAIRS.x - LH.x);
      P.x = STAIRS.x + Math.cos(a) * 0.3; P.z = STAIRS.z + Math.sin(a) * 0.3; P.fx = Math.cos(a); P.fz = Math.sin(a);
      P.ch.face(P.fx, P.fz);
      P.ch.group.visible = true;
      host.map.lighthouse.userData.beam.visible = true;
      host.hud.setCinema(false);
      host.camView = null;
      host.mode = 'walk';
      host.snapCamera();
      host.story.fadeTo(0, 0.45, '', null);
    });
  }

  enterScope() {
    const host = this.host, S = this.S;
    this.mode = 'scope';
    host.mode = 'scope';
    this.sky3.visible = true;
    for (const p of this.pois) p.el.style.display = 'none';
    this.afterSky();
    this.showOverlay();
    host.game.audio.play('select');
    const h = hourOf();
    if (!S.filterTold && h >= 6 && h < 20) {
      S.filterTold = true;
      host.say([{ key: 'story.scope.filter' }], () => { host.mode = 'scope'; });
    } else if (this.found === 0) host.say([{ key: 'story.scope.first' }], () => { host.mode = 'scope'; });
    host.markDirty();
  }

  leaveScope() {
    if (this.mode !== 'scope') return;
    this.mode = 'top';
    this.host.mode = 'top';
    this.sky3.visible = false;
    for (const k of this.cons) k.label.style.display = 'none';
    this.host.applySky(); // the island's own sky again
    this.showOverlay();
  }

  /** Called after the island sets its sky: through the telescope it is always night. */
  afterSky() {
    if (this.mode !== 'scope') return;
    const sc = this.host.scene;
    sc.background.setHex(NAVY);
    sc.fog.color.setHex(NAVY);
  }

  // ---------- overlay ----------

  showOverlay() {
    const host = this.host, P = host.player?.p;
    if (!this.el) { this.el = document.createElement('div'); this.el.className = 'ltop-ui'; host.game.ui.labels.insertBefore(this.el, host.hud.root); } // under the dialog box
    const scope = this.mode === 'scope';
    const count = t('story.top.count', { n: this.found, m: CONSTELLATIONS.length });
    this.el.innerHTML = `${scope ? '<div class="vig"></div><div class="ring"></div>' : ''}
      <div class="ttl">${esc(t(scope ? 'story.scope.title' : 'story.top.title'))}<small>${esc(count)}</small></div>
      <div class="say" style="display:none"></div>
      <div class="hint">${esc(tFor(P, scope ? 'story.scope.hint' : 'story.top.hint'))}</div>`;
    this.ring = this.el.querySelector('.ring');
    this.sayEl = this.el.querySelector('.say');
  }

  setSay(text) {
    if (!this.sayEl) return;
    if (this.sayText === text) return;
    this.sayText = text;
    this.sayEl.style.display = text ? '' : 'none';
    this.sayEl.textContent = text;
  }

  onLanguage() { if (this.el) this.showOverlay(); this.sayText = null; }

  // ---------- frame ----------

  /** The camera on the gallery (top) or at the telescope (scope). */
  place() {
    const host = this.host;
    if (this.mode === 'scope') {
      const d = dirOf(this.sky.yaw, this.sky.pitch);
      host.camView = { pos: SCOPE.clone(), look: SCOPE.clone().add(d.multiplyScalar(10)), fov: 32 };
    } else {
      const cx = Math.cos(this.yaw), cz = Math.sin(this.yaw);
      const pos = new THREE.Vector3(LH.x + cx * 1.3, TOP_Y, LH.z + cz * 1.3);
      host.camView = { pos, look: pos.clone().add(new THREE.Vector3(cx * 20, Math.tan(this.pitch) * 20, cz * 20)), fov: 55 };
    }
    host.camTarget.set(LH.x, 0, LH.z);
  }

  update(inp, dt) {
    if (!this.up) return;
    if (this.mode === 'scope') this.updateScope(inp, dt);
    else {
      if (this.ready) {
        this.yaw += inp.x * 1.3 * dt;
        this.pitch = THREE.MathUtils.clamp(this.pitch + inp.y * 0.6 * dt, -0.5, 0.15);
        if (inp.aPressed) { this.enterScope(); return; }
        if (inp.bPressed || inp.cPressed) { this.exit(); return; }
      }
      this.place();
      this.labelPois();
    }
  }

  /** Names over the places in view (not too far off to the side). */
  labelPois() {
    const host = this.host, cam = host.camera;
    const look = new THREE.Vector3(Math.cos(this.yaw), 0, Math.sin(this.yaw));
    for (const p of this.pois) {
      const to = p.pos.clone().sub(cam.position);
      const d = to.length();
      to.y = 0;
      to.normalize();
      if (!this.ready || to.dot(look) < Math.cos(38 * DEG) || (d > 110 && !p.far)) { p.el.style.display = 'none'; continue; }
      const html = esc(t(p.key));
      if (p.el.innerHTML !== html) p.el.innerHTML = html;
      host.game.ui.place(p.el, p.pos, cam);
    }
  }

  updateScope(inp, dt) {
    const host = this.host, S = this.S;
    if (this.ready) {
      this.sky.yaw += inp.x * 0.9 * dt;
      this.sky.pitch = THREE.MathUtils.clamp(this.sky.pitch + inp.y * 0.7 * dt, 0.22, 1.3);
    }
    this.place();
    // the nearest star picture not found yet: the ring glows warmer when you are close
    const view = dirOf(this.sky.yaw, this.sky.pitch);
    let best = null, bd = 999;
    for (const k of this.cons) {
      const ang = Math.acos(THREE.MathUtils.clamp(view.dot(k.center), -1, 1)) / DEG;
      const got = S.stars[k.c.id] !== undefined;
      // found ones: lines drawn in, name below
      k.glow = Math.min(1, k.glow + dt * (got ? 1.5 : -3));
      k.lines.material.opacity = 0.9 * Math.max(0, k.glow);
      if (got && ang < 12) { // only inside the telescope's circle
        const html = esc(this.nameOf(k.c.id));
        if (k.label.innerHTML !== html) k.label.innerHTML = html;
        host.game.ui.place(k.label, k.labelPos, host.camera);
      } else k.label.style.display = 'none';
      if (!got && ang < bd) { bd = ang; best = k; }
    }
    if (this.ring) this.ring.className = `ring ${bd < FIND_DEG ? 'hot' : bd < 18 ? 'warm' : ''}`;
    const P = host.player?.p;
    this.setSay(!best ? t('story.scope.all') : bd < FIND_DEG ? tFor(P, 'story.scope.close') : bd < 18 ? t('story.scope.warm') : '');
    if (!this.ready) return;
    if (inp.aPressed && best && bd < FIND_DEG) { this.discover(best); return; }
    if (inp.aPressed) host.game.audio.play('bump');
    if (inp.bPressed || inp.cPressed) this.leaveScope();
  }

  nameOf(id) {
    const i = this.S.stars[id];
    return i === undefined ? '' : t(`story.star.${id}.n${i + 1}`);
  }

  /** A star picture found: its lines appear, and you choose its name. */
  discover(k) {
    const host = this.host, S = this.S, id = k.c.id;
    host.game.audio.play('star');
    this.setSay('');
    k.glow = 0;
    S.stars[id] = 0; // drawn in while you choose (the name is set below)
    host.say([{ key: `story.star.${id}.look`, choices: [1, 2, 3].map((i) => `story.star.${id}.n${i}`), onChoice: (i) => {
      S.stars[id] = i;
      host.mode = 'scope';
      const name = this.nameOf(id);
      const txt = t('story.star.named', { name });
      host.game.ui.toast(txt, 2600);
      speak(txt);
      host.confetti.burst(SCOPE.clone().add(dirOf(this.sky.yaw, this.sky.pitch).multiplyScalar(8)), 0, { count: 26, speed: 3, up: 1, life: 1, gravity: 0, colors: [0xffe14a, 0xffffff, 0x8ff0ff] });
      host.grant({ coins: 15 });
      if (this.found === CONSTELLATIONS.length) {
        host.later(1.2, () => {
          const msg = t('story.star.allFound');
          host.game.ui.toast(msg, 3200);
          speak(msg);
          host.grant(PRIZE);
          host.game.audio.play('fanfare');
        });
      }
      this.showOverlay();
      host.markDirty();
    } }]);
  }

  dispose() {
    this.el?.remove();
    this.tex?.dispose();
  }
}
