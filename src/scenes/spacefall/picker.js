import { t } from '../../core/i18n.js';
import { esc } from '../../core/ui.js';
import { VotePicker } from '../../core/vote.js';
import { MAPS } from './maps.js';
import { World, SOLID, PLATFORM } from './world.js';

// The map vote: a VotePicker whose columns show a little picture of each map with its tags
// (one screen or split screen, gravity or zero-g), like Spacefall's lobby preview.

const PREVIEW = {
  station: { bg: '#3b2a7a', wall: '#b7aee8', plat: '#ffc93c' },
  asteroid: { bg: '#2c4f8a', wall: '#d8d4e6', plat: '#8fd8ff' },
  hive: { bg: '#5a1f5a', wall: '#ff8fc4', plat: '#9ff0c8' },
  grove: { bg: '#ffe2b8', wall: '#d99a62', plat: '#7ad65a' },
};

const worlds = new Map();
const images = new Map();

/** Shared World instances (map rows are deterministic, so one per map is enough). */
export function worldFor(id) {
  if (!worlds.has(id)) worlds.set(id, new World(MAPS.find((m) => m.id === id)));
  return worlds.get(id);
}

/** A small picture of the map as a data URL (cached). */
function preview(id) {
  if (images.has(id)) return images.get(id);
  const w = worldFor(id);
  const col = PREVIEW[w.def.theme];
  const s = Math.max(2, Math.floor(Math.min(150 / w.w, 90 / w.h)));
  const c = document.createElement('canvas');
  c.width = w.w * s; c.height = w.h * s;
  const g = c.getContext('2d');
  g.fillStyle = col.bg;
  g.fillRect(0, 0, c.width, c.height);
  for (let y = 0; y < w.h; y++) {
    for (let x = 0; x < w.w; x++) {
      const tile = w.tile(x, y);
      if (tile === SOLID) { g.fillStyle = col.wall; g.fillRect(x * s, (w.h - 1 - y) * s, s, s); }
      else if (tile === PLATFORM) { g.fillStyle = col.plat; g.fillRect(x * s, (w.h - 1 - y) * s, s, Math.max(1, s / 3)); }
    }
  }
  g.fillStyle = '#ff5d73';
  for (const p of w.spawns) { g.beginPath(); g.arc(p.x * s, (w.h - p.y) * s, Math.max(1.5, s * 0.6), 0, Math.PI * 2); g.fill(); }
  const url = c.toDataURL();
  images.set(id, url);
  return url;
}

export function mapLabel(id) { return t(`sf.map.${id}`); }

export function mapTags(id) {
  const w = worldFor(id);
  const shared = w.w <= 36 && w.h <= 22;
  return `${t(shared ? 'sf.tag.shared' : 'sf.tag.split')} · ${t(w.gravity ? 'sf.tag.grav' : 'sf.tag.zero')}`;
}

export class MapVote extends VotePicker {
  render() {
    const cols = this.options.map((o, i) => {
      const chips = this.scene.players.filter((p) => this.choice.get(p).i === i).map((p) => {
        const c = this.choice.get(p);
        return `<div class="ball-pick ${c.locked ? 'done' : ''}" style="--c:${p.css}">${esc(p.name)}${c.locked ? ' ✓' : ''}</div>`;
      }).join('');
      const pic = o.value === 'random'
        ? '<div style="height:64px;display:flex;align-items:center;justify-content:center;font-size:40px;font-weight:700;color:#9b5de5">?</div>'
        : `<img src="${preview(o.value)}" alt="" style="display:block;width:100%;height:64px;object-fit:contain;border-radius:10px;background:#2b2340">`;
      const tags = o.value === 'random' ? '' : `<div style="font-size:clamp(10px,0.9vw,14px);text-align:center;opacity:0.75">${esc(mapTags(o.value))}</div>`;
      return `<div class="vote-opt" style="min-width:clamp(96px,10.5vw,150px);max-width:170px">${pic}<div class="vote-label" style="font-size:clamp(12px,1.15vw,18px);margin:0">${esc(o.label())}</div>${tags}${chips}</div>`;
    }).join('');
    this.el.innerHTML = `<div class="results-title">${esc(this.title())}</div>
      <div class="results-sub">${esc(this.question())}</div>
      <div class="vote-row">${cols}</div>
      <div class="results-footer">${t('vote.hint')}</div>`;
  }
}
