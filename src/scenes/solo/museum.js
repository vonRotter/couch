import * as THREE from 'three';
import { t, tFor } from '../../core/i18n.js';
import { esc } from '../../core/ui.js';
import { say as speak } from '../../core/voice.js';
import { count, take, now } from './save.js';
import { FISH_IDS, SEA, TREASURE, CRYSTALS } from './sea.js';
import { MUSEUM, heightAt } from './map.js';
import { NPCS } from './npcs.js';
import { makeMuseum } from './models3.js';

// The island museum east of the square (milestone B3). Donate fish, sea finds and crystals to Curator Hoot:
// the collection board shows a picture for every piece, empty silhouettes for the missing ones, and a
// "donate" badge for things you carry. Milestones bring coins and decorations. Crystals come from the games
// (letters after Lighthouse Caves and Crystal Caves), the glow cave on the reef and Shell Isle.

export const ROOMS = [
  { id: 'fish', ids: FISH_IDS },
  { id: 'sea', ids: [...Object.keys(SEA), ...Object.keys(TREASURE)] },
  { id: 'crystal', ids: Object.keys(CRYSTALS) },
];
export const ALL_IDS = ROOMS.flatMap((r) => r.ids);
const MILESTONES = [
  { n: 5, reward: { coins: 50 } },
  { n: 10, reward: { deco: 'fishStatue', coins: 50 } },
  { n: 20, reward: { deco: 'crystalLamp', coins: 150 } },
  { n: 30, reward: { deco: 'goldShell', coins: 200 } },
  { n: ALL_IDS.length, reward: { coins: 500 } },
];
const DOOR = { x: MUSEUM.x, z: MUSEUM.z + 3.9 };
const COLS = 8;

export class Museum {
  constructor(host) {
    this.host = host;
    const S = host.save;
    if (!S.museum) S.museum = { got: {}, steps: 0 };
    const map = host.map;
    this.model = map.live(makeMuseum(host.M), MUSEUM.x, MUSEUM.z, 0, heightAt(MUSEUM.x, MUSEUM.z) + 0.02);
    map.boxObs(MUSEUM.x, MUSEUM.z, 3.8, 2.5);
    for (const x of [-2.6, -1.0, 1.0, 2.6]) map.circObs(MUSEUM.x + x, MUSEUM.z + 2.75, 0.28);
    map.lampSpots.push({ x: MUSEUM.x, y: 3.2, z: MUSEUM.z + 3.2 });
    this.tag = host.game.ui.label('label isl-tag');
    this.tagPos = new THREE.Vector3(MUSEUM.x, 5.2, MUSEUM.z + 3.0);
    this.board = null;
  }

  get S() { return this.host.save; }
  get got() { return this.S.museum.got; }
  get total() { return Object.keys(this.got).length; }

  /** [B] at the museum door. */
  interactions(P, out, nm) {
    if (Math.hypot(P.x - DOOR.x, P.z - DOOR.z) < 1.7) out.b = { text: nm('isl.h.museum', { n: this.total, m: ALL_IDS.length }), fn: () => this.open() };
  }

  /** Things in the bag the museum still wants. */
  donatable() {
    return ALL_IDS.filter((id) => !this.got[id] && count(this.S, id) > 0);
  }

  open() {
    const host = this.host;
    host.mode = 'museum';
    const want = this.donatable()[0];
    const room = want ? ROOMS.findIndex((r) => r.ids.includes(want)) : this.board?.room || 0;
    this.board = { room, i: want ? ROOMS[room].ids.indexOf(want) : 0, t: 0 };
    this.render();
    host.game.audio.play('select');
    const n = this.donatable().length;
    speak(n ? t('isl.museum.youHave', { n }) : t('isl.museum.title'));
  }

  render() {
    const host = this.host, B = this.board, room = ROOMS[B.room];
    const tabs = ROOMS.map((r, i) => {
      const got = r.ids.filter((id) => this.got[id]).length;
      return `<span class="${i === B.room ? 'on' : ''}">${esc(t(`isl.museum.${r.id}`))} ${got}/${r.ids.length}</span>`;
    }).join('');
    const cells = room.ids.map((id, i) => {
      const have = !!this.got[id], carry = !have && count(this.S, id) > 0;
      const img = `<img src="${host.picture(id)}" alt="" style="${have ? '' : `filter:brightness(0) opacity(${carry ? 0.55 : 0.25})`}">`;
      const badge = carry ? '<i style="position:absolute;right:2px;top:2px;background:#ff5d73;color:#fff;border-radius:999px;padding:0 6px;font-style:normal;font-size:.85em">+</i>' : '';
      return `<div class="isl-logcell ${i === B.i ? 'on' : ''}" style="position:relative">${badge}${img}<span>${esc(have || carry ? t(`isl.i.${id}`) : '?')}</span></div>`;
    }).join('');
    const id = room.ids[B.i];
    const have = !!this.got[id], carry = !have && count(this.S, id) > 0;
    const info = have ? t('isl.museum.shown', { item: t(`isl.i.${id}`) }) : carry ? tFor(host.player?.p, 'isl.museum.donate', { item: t(`isl.i.${id}`) }) : t('isl.museum.missing');
    const next = MILESTONES.find((m) => m.n > this.total);
    const goal = next ? t('isl.museum.next', { n: next.n - this.total }) : t('isl.museum.complete');
    host.hud.setPanel(`<h2>${esc(t('isl.museum.title'))} <small style="font-size:.5em;opacity:.7">${this.total}/${ALL_IDS.length}</small></h2>
      <div class="isl-tabs">${tabs}</div>
      <div class="isl-loggrid" style="grid-template-columns:repeat(${COLS},1fr)">${cells}</div>
      <div class="isl-foot" style="font-size:clamp(14px,1.4vw,20px);opacity:1">${esc(info)}</div>
      <div class="isl-foot">${esc(goal)} · ${esc(tFor(host.player?.p, 'isl.museum.hint'))}</div>`);
  }

  update(inp, dt) {
    const host = this.host, B = this.board;
    B.t += dt;
    const n = ROOMS[B.room].ids.length;
    if (inp.stepX) {
      // walking off the end of a room goes to the next room
      const i = B.i + inp.stepX;
      if (i < 0) { B.room = (B.room + ROOMS.length - 1) % ROOMS.length; B.i = ROOMS[B.room].ids.length - 1; }
      else if (i >= n) { B.room = (B.room + 1) % ROOMS.length; B.i = 0; }
      else B.i = i;
      host.game.audio.play('select');
      this.render();
    }
    if (inp.stepY) {
      const i = B.i - inp.stepY * COLS;
      if (i >= 0 && i < n) { B.i = i; host.game.audio.play('select'); this.render(); }
    }
    if (B.t < 0.25) return;
    if (inp.bPressed) { this.close(); return; }
    if (inp.aPressed) {
      const id = ROOMS[B.room].ids[B.i];
      if (!this.got[id] && count(this.S, id) > 0) this.donate(id);
      else host.game.audio.play('bump');
    }
  }

  close() {
    this.host.hud.setPanel(null);
    this.host.mode = 'walk';
    const hoot = this.host.npc('hoot');
    if (hoot) hoot.talking = false;
  }

  donate(id) {
    const host = this.host, S = this.S;
    if (!take(S, id, 1)) return;
    this.got[id] = now();
    host.addPts('hoot', 2);
    host.confetti.burst(new THREE.Vector3(MUSEUM.x, 4, MUSEUM.z + 3), 0, { count: 30, speed: 5, up: 4, life: 1.2, gravity: -6, colors: [0xffd23f, 0x8ff0ff, 0xff9fd0, 0xffffff] });
    host.game.audio.play('star');
    const txt = t('isl.museum.thanks', { item: t(`isl.i.${id}`), n: this.total });
    speak(txt, NPCS.hoot.voice);
    host.game.ui.toast(txt, 2200);
    // milestones
    for (const m of MILESTONES) {
      if (this.total >= m.n && (S.museum.steps || 0) < m.n) {
        S.museum.steps = m.n;
        host.later(0.6, () => {
          const msg = t('isl.museum.milestone', { n: m.n });
          host.game.ui.toast(msg, 2600);
          speak(msg, NPCS.hoot.voice);
          host.grant(m.reward);
          host.game.audio.play('fanfare');
        });
      }
    }
    host.markDirty();
    this.render();
  }

  /** The museum's name and count over the door when you are close. */
  updateLabel(P) {
    const d = P ? Math.hypot(P.x - MUSEUM.x, P.z - MUSEUM.z) : 99;
    if (d > 12 || this.host.mode !== 'walk') { this.tag.style.display = 'none'; return; }
    const html = `${esc(t('isl.museum.title'))}<small>${esc(t('isl.museum.count', { n: this.total, m: ALL_IDS.length }))}</small>`;
    if (this.tag.innerHTML !== html) this.tag.innerHTML = html;
    this.host.game.ui.place(this.tag, this.tagPos, this.host.camera);
  }
}

