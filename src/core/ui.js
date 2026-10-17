import * as THREE from 'three';
import { t } from './i18n.js';

const _v = new THREE.Vector3();

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** HTML overlay shared by every scene: banners, HUD chips, labels, results. */
export class UI {
  constructor(root) {
    this.root = root;
    root.innerHTML = `
      <div class="ui-labels"></div>
      <div class="ui-top"></div>
      <div class="ui-corner"></div>
      <div class="ui-center"></div>
      <div class="ui-bar"></div>
      <div class="ui-toast"></div>
      <div class="ui-wipe"></div>`;
    this.labels = root.querySelector('.ui-labels');
    this.top = root.querySelector('.ui-top');
    this.corner = root.querySelector('.ui-corner');
    this.center = root.querySelector('.ui-center');
    this.barEl = root.querySelector('.ui-bar');
    this.toastEl = root.querySelector('.ui-toast');
    this.wipeEl = root.querySelector('.ui-wipe');
    this.barCache = '';
  }

  clear() {
    this.labels.innerHTML = '';
    this.top.innerHTML = '';
    this.corner.innerHTML = '';
    this.center.innerHTML = '';
    this.barEl.innerHTML = '';
    this.toastEl.innerHTML = '';
    this.barCache = '';
  }

  setTop(html) {
    if (this.top.innerHTML !== html) this.top.innerHTML = html;
  }

  setCorner(html) {
    if (this.corner.innerHTML !== html) this.corner.innerHTML = html;
  }

  toast(text, ms = 1600) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = text;
    this.toastEl.appendChild(el);
    setTimeout(() => el.remove(), ms);
  }

  banner(title, sub = '', ms = 1700) {
    const el = document.createElement('div');
    el.className = 'banner';
    el.innerHTML = `<div class="banner-title">${esc(title)}</div>${sub ? `<div class="banner-sub">${esc(sub)}</div>` : ''}`;
    this.center.appendChild(el);
    return new Promise((res) => setTimeout(() => { el.remove(); res(); }, ms));
  }

  async countdown(audio) {
    for (const n of ['3', '2', '1']) {
      audio.play('beep');
      await this.banner(n, '', 600);
    }
    audio.play('go');
    this.banner(t('go'), '', 700);
  }

  /** Bottom chips, one per player. fmt(p) returns the value text. */
  bar(players, fmt = () => '') {
    const html = players
      .map((p) => `<div class="chip" style="--c:${p.css}"><span class="dot"></span><span class="chip-name">${esc(p.name)}</span><span class="chip-val">${fmt(p)}</span></div>`)
      .join('');
    if (html !== this.barCache) {
      this.barEl.innerHTML = html;
      this.barCache = html;
    }
  }

  label(className = 'label') {
    const el = document.createElement('div');
    el.className = className;
    this.labels.appendChild(el);
    return el;
  }

  place(el, pos, camera) {
    _v.copy(pos).project(camera);
    if (_v.z > 1 || Math.abs(_v.x) > 1.3 || Math.abs(_v.y) > 1.3) {
      el.style.display = 'none';
      return;
    }
    el.style.display = '';
    const x = ((_v.x + 1) / 2) * window.innerWidth;
    const y = ((1 - _v.y) / 2) * window.innerHeight;
    el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`;
  }

  panel(html, className = 'panel') {
    const el = document.createElement('div');
    el.className = className;
    el.innerHTML = html;
    this.center.appendChild(el);
    return el;
  }

  /**
   * rows: [{ css, name, value, detail, crown }]
   */
  results({ title, subtitle = '', rows = [], footer = '' }) {
    const cards = rows
      .map((r, i) => `
        <div class="result-card" style="--c:${r.css}; animation-delay:${0.15 + i * 0.12}s">
          ${r.crown ? '<div class="crown-badge">★</div>' : ''}
          <div class="bean"><span class="eye"></span><span class="eye"></span></div>
          <div class="result-name">${esc(r.name)}</div>
          <div class="result-value">${esc(r.value)}</div>
          ${r.detail ? `<div class="result-detail">${esc(r.detail)}</div>` : ''}
        </div>`)
      .join('');
    return this.panel(`
      <div class="results-title">${esc(title)}</div>
      ${subtitle ? `<div class="results-sub">${esc(subtitle)}</div>` : ''}
      <div class="results-row">${cards}</div>
      ${footer ? `<div class="results-footer">${footer}</div>` : ''}`, 'panel results');
  }

  /** Colorful circle wipe; calls mid() while the screen is covered. */
  wipe(mid) {
    return new Promise((res) => {
      this.wipeEl.classList.remove('out');
      this.wipeEl.classList.add('in');
      setTimeout(() => {
        mid?.();
        this.wipeEl.classList.remove('in');
        this.wipeEl.classList.add('out');
        setTimeout(() => {
          this.wipeEl.classList.remove('out');
          res();
        }, 450);
      }, 450);
    });
  }
}

export { esc };
