import * as THREE from 'three';
import { t, tFor } from '../../core/i18n.js';
import { esc } from '../../core/ui.js';
import { say as speak } from '../../core/voice.js';
import { hourOf } from './save.js';
import { dayKey, festivalOn } from './calendar.js';
import { FISH, pickFish } from './sea.js';
import { NPCS, npcState, heartsOf } from './npcs.js';
import { SPOTS } from './map.js';

// The fishing tournament against Grumbleton (milestone B3). On Wednesdays, or any day once he likes you
// (5 hearts), Grumbleton asks for a contest: three minutes, most fish wins. He fishes at the end of the
// pier and calls out his catches; you fish anywhere. Beat his total for the golden fish trophy (the first
// time) and coins. A draw or a loss still gets a few coins and a friendly word: nothing is ever lost.

const LENGTH = 180;
const CSS = `.isl-tour { left: 50%; top: 1.2vh; transform: translateX(-50%); background: rgba(255,250,240,.95); border: 3px solid #5a4dc0; border-radius: 999px; padding: 4px 18px;
  font-weight: 700; font-size: clamp(15px, 1.5vw, 24px); white-space: nowrap; box-shadow: 0 3px 0 rgba(43,35,64,.2); }`;

export class Tournament {
  constructor(host) {
    this.host = host;
    const S = host.save;
    if (!S.tour) S.tour = { day: '', asked: '', wins: 0, played: 0 };
    if (!document.getElementById('isl-tour-style')) {
      const el = document.createElement('style');
      el.id = 'isl-tour-style';
      el.textContent = CSS;
      document.head.appendChild(el);
    }
    this.el = document.createElement('div');
    this.el.className = 'isl-tour';
    this.el.style.display = 'none';
    host.hud.root.appendChild(this.el);
    this.run = null;
  }

  get S() { return this.host.save; }

  /** Can Grumbleton offer a contest today? */
  available(at) {
    const S = this.S, d = new Date(at), today = dayKey(at);
    if (!S.sea.rod || S.sea.quest < 2 || this.run || S.tour.day === today || S.tour.asked === today || this.host.isle2?.here()) return false;
    if (festivalOn(at) === 'derby') return false; // the Derby is the big contest that day
    const h = hourOf(at);
    if (h < 8 || h >= 20) return false;
    return d.getDay() === 3 || heartsOf(npcState(S, 'grumbleton')) >= 5;
  }

  /** Grumbleton's question (a line with a yes/no choice). */
  offer(n, at) {
    if (!this.available(at)) return null;
    return {
      lines: [{ who: 'grumbleton', key: 'isl.tour.ask', fx: () => { n.hop = 1; }, choices: ['isl.yes', 'isl.no'], onChoice: (i) => {
        if (i === 0) this.start();
        else { this.S.tour.asked = dayKey(at); this.host.say([{ who: 'grumbleton', key: 'isl.tour.later' }], () => { n.talking = false; }); }
      } }],
    };
  }

  start() {
    const host = this.host, S = this.S;
    S.tour.day = dayKey();
    S.tour.played++;
    this.run = { t: LENGTH, me: 0, him: 0, next: 18 + Math.random() * 14, grace: 0, done: false };
    // Grumbleton walks to the end of the pier to fish
    const g = host.npc('grumbleton');
    g.busy = true;
    g.talking = false;
    g.route = host.map.route(g.x, g.z, SPOTS.pierEnd.x, SPOTS.pierEnd.z);
    host.game.audio.play('go');
    const txt = t('isl.tour.go');
    host.game.ui.toast(txt, 2400);
    speak(txt, NPCS.grumbleton.voice);
    host.markDirty();
  }

  /** A fish you caught (from island.afterFish). */
  onFish(id) {
    if (!this.run || this.run.done) return;
    this.run.me++;
    this.host.game.ui.toast(t('isl.tour.you', { n: this.run.me, m: this.run.him }), 1600, { group: 'tour' });
  }

  update(dt) {
    const r = this.run, host = this.host;
    if (!r) { this.el.style.display = 'none'; return; }
    if (!r.done) {
      r.t -= dt;
      r.next -= dt;
      if (r.next <= 0 && r.t > 0) {
        r.next = 22 + Math.random() * 16;
        r.him++;
        const f = pickFish('pier', hourOf()) || 'mackerel';
        host.game.ui.toast(t('isl.tour.him', { item: t(`isl.i.${f}`), n: r.him }), 1800, { group: 'tour' });
        const g = host.npc('grumbleton');
        g.hop = 1;
        host.puffs.burst(new THREE.Vector3(g.x, 1.5, g.z + 1.2), FISH[f]?.color || 0xffffff, { count: 8, speed: 3, size: 0.25, life: 0.6 });
      }
      // time is up: a fish on the line may still be landed
      if (r.t <= 0) {
        r.grace += dt;
        if (host.mode !== 'fish' || r.grace > 20) this.finish();
      }
    }
    const show = r && ['walk', 'fish', 'bag'].includes(host.mode);
    this.el.style.display = show ? '' : 'none';
    if (show) {
      const s = Math.max(0, Math.ceil(r.t));
      const html = `🎣 ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} · ${esc(t('isl.tour.score', { n: r.me, m: r.him }))}`;
      if (this.el.innerHTML !== html) this.el.innerHTML = html;
    }
  }

  finish() {
    const host = this.host, r = this.run, S = this.S;
    r.done = true;
    const g = host.npc('grumbleton');
    g.busy = false;
    g.spotName = null;
    const res = r.me > r.him ? 'win' : r.me === r.him ? 'draw' : 'lose';
    const line = t(`isl.tour.${res}`, { n: r.me, m: r.him });
    host.mode = 'tourEnd';
    this.endT = 0;
    host.hud.setPanel(`<h2>${esc(t('isl.tour.title'))}</h2><div class="isl-letter" style="text-align:center">${esc(t('isl.tour.final', { n: r.me, m: r.him }))}<br>${esc(line)}</div><div class="isl-foot">${esc(tFor(host.player?.p, 'isl.ok'))}</div>`);
    speak(line, NPCS.grumbleton.voice);
    host.game.audio.play(res === 'win' ? 'fanfare' : 'star');
    this.result = res;
  }

  /** The result card; closing it hands out the prize. */
  updateEnd(inp, dt) {
    const host = this.host, S = this.S;
    this.endT += dt;
    if (this.endT < 0.4 || !(inp.aPressed || inp.bPressed)) return;
    host.hud.setPanel(null);
    host.mode = 'walk';
    const res = this.result;
    this.run = null;
    host.addPts('grumbleton', res === 'win' ? 6 : 4);
    if (res === 'win') {
      S.tour.wins++;
      if (!S.deco.fishTrophy) host.addDeco('fishTrophy');
      host.grant({ coins: 100 });
    } else host.grant({ coins: res === 'draw' ? 40 : 15 });
    host.markDirty();
  }

  tasks() {
    return this.run && !this.run.done ? [t('isl.task.tour', { n: this.run.me, m: this.run.him })] : [];
  }
}

