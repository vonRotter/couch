import * as THREE from 'three';
import { t, tFor, getLang } from '../../core/i18n.js';
import { esc } from '../../core/ui.js';
import { say as speak } from '../../core/voice.js';
import { now, count, give } from './save.js';
import { dayKey } from './calendar.js';

// Photo mode (milestone B3). Pip sends you an old camera once the tutorial is done. Hold it and press [A]:
// the HUD hides, a frame shows, the stick looks around (the camera keeps its usual distance, it only
// slides), [A] takes the picture and [B] goes back. Every photo becomes a postcard in the mailbox and
// then lives in your album (the album book in the bag, or the mailbox when it is empty). Pictures are small
// JPEG thumbnails, and the album keeps the newest 12, so the save stays small.

const CSS = `
.isl-photo { position: absolute; inset: 0; pointer-events: none; }
.isl-photo .fr { position: absolute; left: 6vw; right: 6vw; top: 8vh; bottom: 12vh; border: 4px solid rgba(255,255,255,.9); border-radius: 18px; box-shadow: 0 0 0 9999px rgba(43,35,64,.25); }
.isl-photo .fr::after { content: ''; position: absolute; left: 50%; top: 50%; width: 26px; height: 26px; margin: -13px; border: 3px solid rgba(255,255,255,.8); border-radius: 50%; }
.isl-photo .hint { position: absolute; left: 50%; bottom: 3vh; transform: translateX(-50%); background: rgba(255,255,255,.92); border-radius: 999px; padding: 4px 18px; font-weight: 700; font-size: clamp(14px, 1.4vw, 22px); white-space: nowrap; }
.isl-photo .flash { position: absolute; inset: 0; background: #fff; opacity: 0; }
.isl-album { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
.isl-album div { border-radius: 10px; padding: 4px; background: rgba(138,90,50,.1); }
.isl-album div.on { background: #ffd84a; box-shadow: 0 3px 0 rgba(43,35,64,.2); }
.isl-album img { width: 100%; aspect-ratio: 16 / 9; display: block; border-radius: 6px; }
.isl-postcard { display: block; width: min(520px, 70vw); aspect-ratio: 16 / 9; margin: 6px auto; border: 6px solid #fff; border-radius: 8px; box-shadow: 0 4px 0 rgba(43,35,64,.2); transform: rotate(-1.5deg); }
`;
const MAX = 12;
const W = 192, H = 108;

function injectStyle() {
  if (document.getElementById('isl-photo-style')) return;
  const el = document.createElement('style');
  el.id = 'isl-photo-style';
  el.textContent = CSS;
  document.head.appendChild(el);
}

export class Photo {
  constructor(host) {
    injectStyle();
    this.host = host;
    const S = host.save;
    if (!S.photos) S.photos = [];
    if (!S.photo) S.photo = { sent: false, next: 1 };
    this.el = null;
    this.off = new THREE.Vector2();
  }

  get S() { return this.host.save; }

  /** Pip's letter with the camera, once the tutorial is done. */
  check() {
    const S = this.S;
    if (S.photo.sent || !S.intro || S.tut < 8) return;
    S.photo.sent = true;
    S.mail.push({ id: 'camera', from: 'pip', items: [['camera', 1]] });
    this.host.mailToast();
    this.host.markDirty();
  }

  start() {
    const host = this.host;
    host.mode = 'photo';
    this.t = 0;
    this.snapT = -1;
    this.off.set(0, 0);
    host.hud.setVisible(false);
    this.el = document.createElement('div');
    this.el.className = 'isl-photo';
    this.el.innerHTML = `<div class="fr"></div><div class="flash"></div><div class="hint">${esc(tFor(host.player?.p, 'isl.photo.hint'))}</div>`;
    host.game.ui.labels.appendChild(this.el);
    host.game.audio.play('select');
  }

  stop() {
    const host = this.host;
    this.el?.remove();
    this.el = null;
    this.off.set(0, 0);
    host.camOffset = null;
    host.hud.setVisible(true);
    host.mode = 'walk';
  }

  update(inp, dt) {
    const host = this.host;
    this.t += dt;
    if (this.snapT >= 0) {
      // the white flash, then back to walking
      this.snapT += dt;
      const fl = this.el.querySelector('.flash');
      fl.style.opacity = String(Math.max(0, 0.9 - this.snapT * 2));
      if (this.snapT > 0.7) this.stop();
      return;
    }
    // slide the view around the bean (never closer or farther)
    this.off.x = THREE.MathUtils.clamp(this.off.x + inp.x * 7 * dt, -9, 9);
    this.off.y = THREE.MathUtils.clamp(this.off.y - inp.y * 7 * dt, -7, 7);
    host.camOffset = { x: this.off.x, z: this.off.y };
    if (this.t < 0.3) return;
    if (inp.bPressed || inp.cPressed) { this.stop(); return; }
    if (inp.aPressed) this.snap();
  }

  /** Take the picture: a small JPEG from the canvas, kept in the album and sent as a postcard. */
  snap() {
    const host = this.host, S = this.S, r = host.game.renderer;
    host.updateCamera(0);
    r.render(host.scene, host.camera);
    const src = r.domElement;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');
    const sw = src.width, sh = src.height;
    let cw = sw, ch = (sw * H) / W;
    if (ch > sh) { ch = sh; cw = (sh * W) / H; }
    g.drawImage(src, (sw - cw) / 2, (sh - ch) / 2, cw, ch, 0, 0, W, H);
    const img = c.toDataURL('image/jpeg', 0.6);
    const u = S.photo.next++;
    S.photos.push({ u, at: now(), img, day: dayKey() });
    let full = false;
    while (S.photos.length > MAX) { S.photos.shift(); full = true; }
    S.mail.push({ id: 'postcard', from: 'photo', pc: u });
    if (!count(S, 'album')) give(S, 'album', 1);
    this.snapT = 0;
    host.game.audio.play('pop');
    const txt = t(full ? 'isl.photo.sentFull' : 'isl.photo.sent', { n: MAX });
    host.later(0.8, () => { host.game.ui.toast(txt, 2600); speak(txt); });
    host.markDirty();
  }

  photoOf(u) { return this.S.photos.find((p) => p.u === u) || null; }

  /** The postcard letter (see island.openLetter). */
  letterHtml(r) {
    const p = this.photoOf(r.pc);
    if (!p) return `<div class="isl-letter">${esc(t('isl.photo.gone'))}</div>`;
    const date = new Date(p.at).toLocaleDateString(getLang() === 'no' ? 'nb-NO' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    return `<img class="isl-postcard" src="${p.img}" alt=""><div class="isl-foot" style="opacity:1">${esc(t('isl.photo.card', { date }))}</div>`;
  }

  // ---------- the album ----------

  openAlbum() {
    const host = this.host;
    if (!this.S.photos.length) { host.game.ui.toast(t('isl.photo.none'), 2000); return; }
    host.mode = 'album';
    this.album = { i: this.S.photos.length - 1, t: 0 };
    this.renderAlbum();
    host.game.audio.play('select');
  }

  renderAlbum() {
    const host = this.host, A = this.album, list = this.S.photos;
    const cells = list.map((p, i) => `<div class="${i === A.i ? 'on' : ''}"><img src="${p.img}" alt=""></div>`).join('');
    const cur = list[A.i];
    host.hud.setPanel(`<h2>${esc(t('isl.photo.album'))} <small style="font-size:.5em;opacity:.7">${list.length}/${MAX}</small></h2>
      ${cur ? `<img class="isl-postcard" style="width:min(360px,50vw)" src="${cur.img}" alt="">` : ''}
      <div class="isl-album">${cells}</div>
      <div class="isl-foot">${esc(tFor(host.player?.p, 'isl.photo.albumHint'))}</div>`);
  }

  updateAlbum(inp, dt) {
    const A = this.album, n = this.S.photos.length;
    A.t += dt;
    const step = inp.stepX - inp.stepY * 4;
    if (step && n) { A.i = (A.i + step + n * 4) % n; this.host.game.audio.play('select'); this.renderAlbum(); }
    if (A.t > 0.25 && (inp.aPressed || inp.bPressed)) { this.host.hud.setPanel(null); this.host.mode = 'walk'; }
  }
}
