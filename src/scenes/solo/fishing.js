import * as THREE from 'three';
import { toon } from '../../core/palette.js';
import { t, tFor } from '../../core/i18n.js';
import { esc } from '../../core/ui.js';
import { say as speak } from '../../core/voice.js';
import { FISH, pickFish } from './sea.js';
import { give } from './save.js';
import { hourOf } from './save.js';
import { mesh, sph, cyl } from './models.js';
import { SEA_Y } from './map.js';

// The fishing minigame. Cast with [A], wait for the bobber to dip, press [A] to hook, then hit [A] when the
// moving marker is inside the green zone (each fish needs a few hits; three misses and it swims away).
// No timers you can lose to while reeling: a kid can take their time. Which fish bites depends on the
// place (river, pier/shore, the dive boat) and the real hour.

const CSS = `
.isl-fish { left: 50%; bottom: calc(1.4vh + clamp(84px, 8vw, 118px)); transform: translateX(-50%); width: min(560px, 80vw); text-align: center; }
.isl-fish .bar { position: relative; height: 34px; border-radius: 999px; background: rgba(43,35,64,.75); border: 4px solid #fff; box-shadow: 0 4px 0 rgba(43,35,64,.25); overflow: hidden; }
.isl-fish .zone { position: absolute; top: 0; bottom: 0; background: #3ddc97; border-radius: 999px; }
.isl-fish .mark { position: absolute; top: -4px; bottom: -4px; width: 8px; margin-left: -4px; background: #ffd84a; border-radius: 4px; box-shadow: 0 0 0 2px #2b2340; }
.isl-fish .bar.miss { animation: isl-shake .3s; }
@keyframes isl-shake { 25% { transform: translateX(-8px); } 75% { transform: translateX(8px); } }
.isl-fish .row { display: flex; justify-content: center; gap: 8px; margin-top: 6px; font-weight: 700; font-size: clamp(14px, 1.4vw, 21px); color: #fff; paint-order: stroke fill; -webkit-text-stroke: .2em #2b2340; }
.isl-fish .dots span { display: inline-block; width: 14px; height: 14px; border-radius: 50%; background: rgba(255,255,255,.5); margin: 0 2px; border: 2px solid #2b2340; }
.isl-fish .dots span.on { background: #3ddc97; }
.isl-fish .dots span.x { background: #ff5d73; }
.isl-catch { left: 50%; top: 42%; transform: translate(-50%, -50%); background: rgba(255,250,240,.98); border-radius: 24px; border: 4px solid #4cc9f0; padding: 12px 28px 14px;
  text-align: center; box-shadow: 0 8px 0 rgba(43,35,64,.25); font-weight: 700; animation: isl-pop .5s; }
.isl-catch img { width: clamp(90px, 10vw, 150px); height: clamp(90px, 10vw, 150px); display: block; margin: 0 auto; }
.isl-catch .nm { font-size: clamp(20px, 2.4vw, 36px); }
.isl-catch .sub { font-size: clamp(13px, 1.2vw, 18px); opacity: .7; }
.isl-catch .new { display: inline-block; background: #ff5d73; color: #fff; border-radius: 999px; padding: 0 12px; font-size: clamp(13px, 1.2vw, 18px); margin-bottom: 4px; }
`;

function injectStyle() {
  if (document.getElementById('isl-fish-style')) return;
  const el = document.createElement('style');
  el.id = 'isl-fish-style';
  el.textContent = CSS;
  document.head.appendChild(el);
}

export class Fishing {
  constructor(host) {
    injectStyle();
    this.host = host;
    this.state = null;
    this.el = document.createElement('div');
    this.el.className = 'isl-fish';
    this.el.style.display = 'none';
    host.hud.root.appendChild(this.el);
    this.card = document.createElement('div');
    this.card.className = 'isl-catch';
    this.card.style.display = 'none';
    host.hud.root.appendChild(this.card);
    this.bobber = new THREE.Group();
    this.bobber.add(mesh(sph(0.14, 10, 8), 0xffffff, 0, 0.05, 0, false), mesh(sph(0.145, 10, 8, 0), 0xff5d73, 0, 0.12, 0, false), mesh(cyl(0.015, 0.015, 0.2, 4), 0x2b2340, 0, 0.28, 0, false));
    this.bobber.visible = false;
    host.scene.add(this.bobber);
    const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    this.line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffffff }));
    this.line.frustumCulled = false;
    this.line.visible = false;
    host.scene.add(this.line);
    this.tip = new THREE.Vector3();
  }

  get active() { return !!this.state; }

  /** Cast toward a water point. where: river, pier or boat. */
  start(where, x, z) {
    const P = this.host.player;
    this.where = where;
    this.state = 'cast';
    this.t = 0;
    this.from = new THREE.Vector3(P.x, P.y + 1.6, P.z);
    this.to = new THREE.Vector3(x, SEA_Y + 0.02, z);
    this.bobber.visible = true;
    this.line.visible = true;
    this.host.swingTool();
    this.host.game.audio.play('whoosh');
  }

  stop() {
    this.state = null;
    this.bobber.visible = false;
    this.line.visible = false;
    this.el.style.display = 'none';
    this.host.hud.setPrompt('');
  }

  prompt(text) {
    this.el.style.display = 'none';
    this.host.hud.setPrompt(text);
  }

  renderMeter(miss = false) {
    const R = this.reel;
    const dots = [...Array(R.need)].map((_, i) => `<span class="${i < R.hits ? 'on' : ''}"></span>`).join('') + ' ' + [...Array(3)].map((_, i) => `<span class="${i < R.misses ? 'x' : ''}"></span>`).join('');
    this.el.style.display = '';
    this.el.innerHTML = `<div class="bar ${miss ? 'miss' : ''}"><div class="zone" style="left:${((R.zc - R.w / 2) * 100).toFixed(1)}%;width:${(R.w * 100).toFixed(1)}%"></div><div class="mark"></div></div>
      <div class="row"><span class="dots">${dots}</span></div><div class="row">${esc(tFor(this.host.player?.p, 'isl.fish.reel'))}</div>`;
    this.markEl = this.el.querySelector('.mark');
  }

  update(inp, dt) {
    if (!this.state) return false;
    const host = this.host, P = host.player;
    this.t += dt;
    // fishing line from the rod tip to the bobber
    P.hand.getWorldPosition(this.tip);
    this.tip.y += 0.7;
    const pos = this.line.geometry.attributes.position;
    pos.setXYZ(0, this.tip.x, this.tip.y, this.tip.z);
    pos.setXYZ(1, this.bobber.position.x, this.bobber.position.y + 0.3, this.bobber.position.z);
    pos.needsUpdate = true;
    const nm = (k, v) => tFor(P.p, k, v);
    switch (this.state) {
      case 'cast': {
        const k = Math.min(1, this.t / 0.45);
        this.bobber.position.lerpVectors(this.from, this.to, k);
        this.bobber.position.y += Math.sin(k * Math.PI) * 2;
        if (k >= 1) {
          this.state = 'wait';
          this.t = 0;
          this.wait = 1.5 + Math.random() * 3;
          host.puffs.burst(this.to.clone(), 0xffffff, { count: 8, speed: 2, up: 1.5, size: 0.25, life: 0.5 });
          host.game.audio.play('bubble');
        }
        break;
      }
      case 'wait':
        this.bobber.position.y = this.to.y + Math.sin(this.t * 3) * 0.04;
        this.prompt(nm('isl.fish.wait'));
        if (this.t > this.wait) {
          this.state = 'bite';
          this.t = 0;
          this.fish = pickFish(this.where, hourOf());
          host.game.audio.play('beep');
          host.puffs.burst(this.to.clone(), 0xffffff, { count: 12, speed: 3, up: 2, size: 0.3, life: 0.6 });
        } else if (inp.aPressed || inp.bPressed) { this.stop(); return true; }
        break;
      case 'bite':
        this.bobber.position.y = this.to.y - 0.18 + Math.sin(this.t * 30) * 0.06;
        this.prompt(`❗ ${nm('isl.fish.bite')}`);
        if (inp.aPressed) {
          const f = FISH[this.fish];
          this.reel = { p: 0, dir: 1, zc: 0.3 + Math.random() * 0.4, w: f.zone, speed: f.speed * 0.8, need: f.hits, hits: 0, misses: 0 };
          this.state = 'reel';
          this.t = 0;
          host.game.audio.play('dash');
          this.renderMeter();
          host.hud.setPrompt('');
        } else if (this.t > 1.1) this.result(false, 'isl.fish.late');
        break;
      case 'reel': {
        const R = this.reel;
        R.p += R.dir * R.speed * dt;
        if (R.p > 1) { R.p = 2 - R.p; R.dir = -1; }
        if (R.p < 0) { R.p = -R.p; R.dir = 1; }
        if (this.markEl) this.markEl.style.left = `${(R.p * 100).toFixed(1)}%`;
        this.bobber.position.x = this.to.x + Math.sin(this.t * 7) * 0.15;
        if (inp.aPressed) {
          if (Math.abs(R.p - R.zc) <= R.w / 2 + 0.02) {
            R.hits++;
            host.game.audio.play('pop');
            host.puffs.burst(this.bobber.position.clone(), 0xffffff, { count: 10, speed: 3, up: 2, size: 0.3, life: 0.5 });
            if (R.hits >= R.need) { this.result(true); break; }
            R.zc = R.w / 2 + Math.random() * (1 - R.w);
            this.renderMeter();
          } else {
            R.misses++;
            host.game.audio.play('bump');
            if (R.misses >= 3) { this.result(false, 'isl.fish.escaped'); break; }
            this.renderMeter(true);
          }
        } else if (inp.bPressed) this.result(false, 'isl.fish.letGo');
        break;
      }
      case 'result':
        this.bobber.visible = false;
        this.line.visible = false;
        if (this.t > 0.4 && (inp.aPressed || inp.bPressed || this.t > 3.2)) {
          this.card.style.display = 'none';
          this.stop();
          this.host.afterFish?.(this.caught ? this.fish : null);
        }
        break;
    }
    return true;
  }

  result(ok, why) {
    const host = this.host, S = host.save;
    this.state = 'result';
    this.t = 0;
    this.el.style.display = 'none';
    this.caught = ok;
    if (!ok) {
      host.hud.setPrompt('');
      const txt = t(why);
      host.game.ui.toast(txt, 1600);
      speak(txt);
      host.game.audio.play('splat');
      this.t = 2.6; // short pause, then fish again
      return;
    }
    const id = this.fish;
    const isNew = !S.sea.log[id];
    S.sea.log[id] = (S.sea.log[id] || 0) + 1;
    S.sea.caught++;
    give(S, id, 1);
    host.markDirty();
    host.game.audio.play(isNew ? 'fanfare' : 'star');
    host.confetti.burst(this.bobber.position.clone().add(new THREE.Vector3(0, 1, 0)), 0, { count: 26, speed: 4, up: 4, life: 1, gravity: -9, colors: [FISH[id].color, FISH[id].color2, 0xffffff] });
    const name = t(`isl.i.${id}`);
    this.card.innerHTML = `${isNew ? `<div class="new">${esc(t('isl.fish.new'))}</div>` : ''}<img src="${host.picture(id)}" alt=""><div class="nm">${esc(name)}</div><div class="sub">${esc(t(`isl.where.${FISH[id].where}`))}</div>`;
    this.card.style.display = '';
    speak(t('isl.fish.caught', { item: name }));
  }

  dispose() {
    this.line.geometry.dispose();
    this.line.material.dispose();
  }
}
