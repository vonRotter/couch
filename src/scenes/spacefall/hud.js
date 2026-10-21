import * as THREE from 'three';
import { t, tFor } from '../../core/i18n.js';
import { SHIP } from './config.js';
import { clamp } from './util.js';

// 2D overlay drawn on a canvas above the 3D view, per viewport: name tags, fuel bars, floating
// texts, arrows to pilots outside your view, a corner card per player in split screen, and the
// tactical overview. The canvas lives in the UI label layer, so it is removed with the scene.
// Styling follows the Couch look: Fredoka, colored text with a chunky white outline, white cards.

const FONT = "'Fredoka', 'Trebuchet MS', system-ui, sans-serif";
const INK = '#2b2340';
const _v = new THREE.Vector3();

export class Hud {
  constructor(parent) {
    this.canvas = document.createElement('canvas');
    this.canvas.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;';
    parent.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    this.resize();
  }

  resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
  }

  clear() {
    const c = this.ctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, this.canvas.width, this.canvas.height);
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  /** Outlined text in the Couch style. */
  text(str, x, y, size, color, align = 'center', weight = 700, base = 'middle') {
    const c = this.ctx;
    c.font = `${weight} ${size}px ${FONT}`;
    c.textAlign = align;
    c.textBaseline = base;
    c.lineJoin = 'round';
    c.lineWidth = Math.max(3, size * 0.32);
    c.strokeStyle = '#fff';
    c.strokeText(str, x, y);
    c.fillStyle = color;
    c.fillText(str, x, y);
  }

  roundRect(x, y, w, h, r, fill, stroke, lw = 3) {
    const c = this.ctx;
    c.beginPath();
    c.roundRect(x, y, w, h, r);
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) { c.lineWidth = lw; c.strokeStyle = stroke; c.stroke(); }
  }

  /** avoid: a screen rect (the top pills) that player cards must not cover. */
  draw(match, playing, avoid = null) {
    this.avoid = avoid;
    this.clear();
    if (!match) return;
    const c = this.ctx;
    for (const v of match.views) {
      c.save();
      c.beginPath();
      c.rect(v.rect.x, v.rect.y, v.rect.w, v.rect.h);
      c.clip();
      if (v.kind === 'overview') this.drawOverview(match, v);
      else {
        this.drawWorldMarks(match, v, playing);
        if (v.kind === 'follow') {
          this.drawOffscreen(match, v);
          this.placeCard(match, v);
          this.drawDeadNotice(match, v);
        }
      }
      c.restore();
    }
    // White gutters between viewports, like Kart Party's split screen.
    if (match.views.length > 1) {
      c.fillStyle = '#fff';
      for (const v of match.views) {
        if (v.rect.x > 0) c.fillRect(v.rect.x - 2, v.rect.y, 4, v.rect.h);
        if (v.rect.y > 0) c.fillRect(v.rect.x, v.rect.y - 2, v.rect.w, 4);
      }
    }
  }

  /** Name tags, fuel bars, rescue bubbles and floating texts. */
  drawWorldMarks(match, v, playing) {
    const scale = clamp(v.rect.h / 520, 0.9, 1.5);
    for (const pl of match.pilots) {
      const s = pl.ship;
      if (s.alive && s.mesh.visible) {
        const p = v.project(s.x, s.y + 1.0, 0, _v);
        if (p && p.inside) {
          this.text(pl.name, p.x, p.y - 2 * scale, 12 * scale, pl.css);
          if (s.fuel < 0.97) {
            const fw = 30 * scale, fy = v.project(s.x, s.y - 0.55, 0, _v).y;
            this.roundRect(p.x - fw / 2 - 2, fy - 2, fw + 4, 7 * scale, 4, '#fff');
            this.roundRect(p.x - fw / 2, fy, Math.max(1, fw * s.fuel), 7 * scale - 4, 3, s.fuel < 0.25 ? '#ff5d73' : '#4cc9f0');
          }
          // Personal tips use tFor so [C] names only this player's own button.
          if (playing && pl.p && pl.tipT > 0) this.text(tFor(pl.p, pl.tip), p.x, p.y - 20 * scale, 13 * scale, INK, 'center', 600);
        }
      } else if (pl.pod && pl.pod.kind === 'rescue') {
        const p = v.project(pl.pod.x, pl.pod.y + 0.95, 0, _v);
        if (p && p.inside) this.text(t('sf.helpMe'), p.x, p.y, 13 * scale, pl.css);
      }
    }
    for (const tx of match.texts) {
      const p = v.project(tx.x, tx.y, 0, _v);
      if (!p || !p.inside) continue;
      this.ctx.globalAlpha = 1 - Math.max(0, (tx.t - tx.life * 0.6) / (tx.life * 0.4));
      this.text(tx.text, p.x, p.y, 15 * scale, tx.color);
      this.ctx.globalAlpha = 1;
    }
  }

  /** Put the card in the view's outer top corner, or at the bottom if the top pills are in the way. */
  placeCard(match, v) {
    const k = clamp(v.rect.h / 520, 0.75, 1.3);
    const w = 190 * k, h = 66 * k, m = 10;
    const left = v.rect.x + v.rect.w / 2 <= this.w / 2;
    const x = left ? v.rect.x + m : v.rect.x + v.rect.w - w - m;
    let y = v.rect.y + m;
    const a = this.avoid;
    if (a && x < a.right && x + w > a.left && y < a.bottom && y + h > a.top) y = v.rect.y + v.rect.h - h - m;
    this.drawCard(match, v.pilot, x, y, k);
  }

  /** Corner card for one player's viewport: name, score, missiles, fuel, lives and power-ups. */
  drawCard(match, pl, x, y, k) {
    const s = pl.ship;
    const w = 190 * k, h = 66 * k;
    this.roundRect(x, y, w, h, 14 * k, 'rgba(255,255,255,0.92)', pl.css, 4 * k);
    const c = this.ctx;
    c.font = `700 ${16 * k}px ${FONT}`;
    c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillStyle = pl.css;
    c.fillText(pl.name, x + 12 * k, y + 17 * k);
    c.textAlign = 'right'; c.fillStyle = INK;
    c.fillText(match.scoreText(pl), x + w - 12 * k, y + 17 * k);
    // Missiles.
    for (let i = 0; i < SHIP.maxAmmo; i++) {
      c.fillStyle = s.alive && i < s.ammo ? pl.css : 'rgba(43,35,64,0.15)';
      const mx = x + 12 * k + i * 12 * k, my = y + 32 * k;
      c.beginPath();
      c.moveTo(mx, my + 14 * k);
      c.lineTo(mx + 8 * k, my + 14 * k);
      c.lineTo(mx + 8 * k, my + 5 * k);
      c.lineTo(mx + 4 * k, my);
      c.lineTo(mx, my + 5 * k);
      c.closePath();
      c.fill();
    }
    // Fuel.
    const fx = x + 104 * k, fw = w - 116 * k;
    this.roundRect(fx, y + 34 * k, fw, 8 * k, 4 * k, 'rgba(43,35,64,0.15)');
    if (s.alive) this.roundRect(fx, y + 34 * k, Math.max(2, fw * s.fuel), 8 * k, 4 * k, s.fuel < 0.25 ? '#ff5d73' : '#4cc9f0');
    let icons = '';
    if (s.alive && s.shield) icons += '◈ ';
    if (s.alive && s.spread > 0) icons += `×3 `;
    if (match.mode === 'coop') icons += '♥'.repeat(Math.max(0, pl.lives));
    if (icons) {
      c.font = `700 ${12 * k}px ${FONT}`;
      c.textAlign = 'left';
      c.fillStyle = '#ff5d73';
      c.fillText(icons.trim(), fx, y + 54 * k);
    }
  }

  drawDeadNotice(match, v) {
    const pl = v.pilot;
    if (pl.ship.alive) return;
    const cx = v.rect.x + v.rect.w / 2, cy = v.rect.y + v.rect.h * 0.7;
    const k = clamp(v.rect.h / 520, 0.8, 1.4);
    let msg, sub = '';
    if (match.mode === 'versus') { msg = t('sf.out'); sub = t('sf.outSub'); }
    else if (match.mode === 'frenzy' || pl.lives > 0) msg = t('sf.respawnIn', { n: Math.max(0, pl.respawnT).toFixed(1) });
    else if (pl.pod && pl.pod.kind === 'rescue') { msg = t('sf.bubbled'); sub = t('sf.bubbledSub'); }
    else msg = t('sf.out');
    this.text(msg, cx, cy, 24 * k, pl.css);
    if (sub) this.text(sub, cx, cy + 28 * k, 14 * k, INK, 'center', 600);
  }

  /** Arrows at the viewport edge pointing to pilots you can't see. */
  drawOffscreen(match, v) {
    const c = this.ctx;
    for (const pl of match.pilots) {
      const s = pl.ship;
      if (!s.alive || pl === v.pilot) continue;
      const p = v.project(s.x, s.y, 0, _v);
      if (!p || p.inside) continue;
      const ang = Math.atan2(-p.ny, p.nx);
      const m = 24;
      const cx = v.rect.x + v.rect.w / 2, cy = v.rect.y + v.rect.h / 2;
      const kx = (v.rect.w / 2 - m) / Math.max(1e-6, Math.abs(Math.cos(ang)));
      const ky = (v.rect.h / 2 - m) / Math.max(1e-6, Math.abs(Math.sin(ang)));
      const k = Math.min(kx, ky);
      const ax = cx + Math.cos(ang) * k, ay = cy + Math.sin(ang) * k;
      c.save();
      c.translate(ax, ay);
      c.rotate(ang);
      c.beginPath();
      c.moveTo(13, 0);
      c.lineTo(-8, -10);
      c.lineTo(-8, 10);
      c.closePath();
      c.lineJoin = 'round';
      c.lineWidth = 5;
      c.strokeStyle = '#fff';
      c.stroke();
      c.fillStyle = pl.css;
      c.fill();
      c.restore();
      this.text(pl.name, ax - Math.cos(ang) * 22, ay - Math.sin(ang) * 22, 11, pl.css);
    }
  }

  /** The spare viewport: the whole map with everyone on it. */
  drawOverview(match, v) {
    this.text(t('sf.overview'), v.rect.x + 14, v.rect.y + 18, 16, '#9b5de5', 'left');
    const c = this.ctx;
    for (const a of match.aliens) {
      const p = v.project(a.x, a.y, 0, _v);
      if (!p) continue;
      c.fillStyle = '#ff5d73';
      c.beginPath();
      c.arc(p.x, p.y, a.boss ? 7 : 3.5, 0, Math.PI * 2);
      c.fill();
    }
    for (const pl of match.pilots) {
      const tg = pl.ship.alive ? pl.ship : pl.pod;
      if (!tg) continue;
      const p = v.project(tg.x, tg.y, 0, _v);
      if (!p) continue;
      c.lineWidth = 5;
      c.strokeStyle = '#fff';
      c.beginPath();
      c.arc(p.x, p.y, 8, 0, Math.PI * 2);
      c.stroke();
      c.lineWidth = 3;
      c.strokeStyle = pl.css;
      c.stroke();
      this.text(pl.name, p.x, p.y + 17, 11, pl.css);
    }
  }
}
