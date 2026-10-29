import * as THREE from 'three';
import { t, tFor, getLang } from '../../core/i18n.js';
import { esc } from '../../core/ui.js';
import { say as speak } from '../../core/voice.js';
import { now, count, give, take } from './save.js';
import { dayKey, dayRand, birthdayOf, festivalOn, rainyOn, monthDays } from './calendar.js';
import { CROP_IDS } from './items.js';
import { NPCS, npcState, heartsOf } from './npcs.js';
import { PLACES, PIER, PLAZA, heightAt } from './map.js';
import { mesh, cone, makeBunting } from './models.js';
import { makeLanternString } from './models2.js';

// Island life by the real calendar (milestone B2): rainy days that water the crops, birthdays with party
// hats, letters from friends, the calendar board in the square, and three festivals: the Fishing Derby at
// the pier, the Harvest Fair in the square, and Lantern Night by the lighthouse. Also Pip's rocket launch.

const CAL_BOARD = { x: 17.8, z: -9.8 };
const LETTER_GIFTS = { hazel: [['carrotSeed', 3], ['lettuceSeed', 3]], rosa: [['bouquet', 1], ['tomatoSeed', 2]], bram: [['pumpkinSeed', 1], ['wood', 3]], grumbleton: [['coins', 40], ['strawberrySeed', 2]], pip: [['starfruitSeed', 1], ['cornSeed', 2]] };

export class Seasons {
  constructor(host) {
    this.host = host;
    const S = host.save;
    if (!S.fest) S.fest = { derby: {}, derbyWon: {}, fairWon: {}, lantern: false, letterDay: '', bday: {} };
    // rain: streaks that follow the camera
    const n = 500, pos = new Float32Array(n * 6);
    this.rainGeo = new THREE.BufferGeometry();
    this.rainGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.drops = [...Array(n)].map(() => ({ x: (Math.random() - 0.5) * 50, y: Math.random() * 18, z: (Math.random() - 0.5) * 40 }));
    this.rain = new THREE.LineSegments(this.rainGeo, new THREE.LineBasicMaterial({ color: 0xcfe8ff, transparent: true, opacity: 0.55 }));
    this.rain.frustumCulled = false;
    this.rain.visible = false;
    host.scene.add(this.rain);
    // festival decorations (shown on their days)
    const map = host.map;
    this.derbyDeco = new THREE.Group();
    this.derbyDeco.add(makeBunting({ x: PIER.x - 1.5, y: 2.6, z: PIER.z0 }, { x: PIER.x - 1.5, y: 2.6, z: PIER.z0 + 14 }), makeBunting({ x: PIER.x + 1.5, y: 2.6, z: PIER.z0 }, { x: PIER.x + 1.5, y: 2.6, z: PIER.z0 + 14 }));
    for (const z of [PIER.z0, PIER.z0 + 14]) for (const x of [PIER.x - 1.5, PIER.x + 1.5]) this.derbyDeco.add(mesh(cone(0.05, 2.6, 4), 0xffffff, x, 1.3, z, false));
    host.scene.add(this.derbyDeco);
    this.fairDeco = new THREE.Group();
    for (const [x, z, c] of [[PLAZA.x - 4, PLAZA.z + 4, 0xff5d73], [PLAZA.x + 4, PLAZA.z + 4, 0xffc93c]]) {
      const st = new THREE.Group();
      st.add(mesh(cone(1.5, 1.0, 4), c, 0, 2.6, 0).rotateY(Math.PI / 4));
      for (const sx of [-1, 1]) st.add(mesh(cone(0.06, 2.2, 4), 0xffffff, sx * 0.9, 1.1, 0.6, false));
      for (let i = 0; i < 6; i++) st.add(mesh(cone(0.18, 0.3, 6), [0xff9f1c, 0xff4f6d, 0x9be05a][i % 3], -0.6 + (i % 3) * 0.6, 1.0, Math.floor(i / 3) * 0.3, false));
      st.position.set(x, 0, z);
      this.fairDeco.add(st);
    }
    host.scene.add(this.fairDeco);
    const lh = PLACES.find((p) => p.id === 'lighthouse');
    this.lanternDeco = new THREE.Group();
    const pts = [[34, 15.6], [40, 20], [43, 26], [lh.door.x - 3, lh.door.z + 2], [lh.door.x + 3, lh.door.z + 2]];
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
      this.lanternDeco.add(makeLanternString({ x: ax, y: heightAt(ax, az) + 2.6, z: az }, { x: bx, y: heightAt(bx, bz) + 2.6, z: bz }));
    }
    host.scene.add(this.lanternDeco);
    this.calBoard = CAL_BOARD;
    this.rocket = null;
    this.today = '';
    this.refresh();
  }

  get S() { return this.host.save; }

  refresh() {
    const at = now();
    this.festival = festivalOn(at);
    this.rainy = rainyOn(at);
    this.derbyDeco.visible = this.festival === 'derby';
    this.fairDeco.visible = this.festival === 'fair';
    this.lanternDeco.visible = this.festival === 'lanterns';
  }

  /** Once a second: a new day brings weather, festivals, letters; rain waters the crops. */
  tick(at) {
    const today = dayKey(at);
    if (today !== this.today) {
      const first = !this.today;
      this.today = today;
      this.refresh();
      this.sendLetters(today);
      if (this.festival) this.host.later(first ? 2.2 : 0.2, () => this.host.game.ui.toast(t('isl.fest.today', { name: t(`isl.fest.${this.festival}`) }), 2600));
      else if (this.rainy) this.host.later(first ? 2.2 : 0.2, () => this.host.game.ui.toast(t('isl.t.rain'), 2400));
      const bday = Object.keys(NPCS).find((id) => birthdayOf(id, at));
      if (bday) this.host.later(first ? 3.4 : 0.4, () => this.host.game.ui.toast(t('isl.t.bday', { name: t(`isl.npc.${bday}`) }), 2400));
    }
    if (this.rainy) {
      // rain keeps every planted tile wet until the end of the day
      const end = new Date(at); end.setHours(23, 59, 59, 0);
      for (const tl of Object.values(this.S.tiles)) if (tl.crop && (tl.wetUntil || 0) < end.getTime()) tl.wetUntil = end.getTime();
    }
    // party hats on birthdays
    for (const n of this.host.npcs) {
      const want = birthdayOf(n.id, at);
      if (want && !n.partyHat) {
        n.partyHat = mesh(cone(0.18, 0.45, 10), 0xff5d73, 0, n.id === 'grumbleton' ? 1.75 : 1.5, 0, false);
        n.partyHat.add(mesh(cone(0.06, 0.1, 6), 0xffd23f, 0, 0.27, 0, false));
        n.model.group.add(n.partyHat);
      } else if (!want && n.partyHat) { n.partyHat.removeFromParent(); n.partyHat = null; }
    }
  }

  /** Friends with 3+ hearts sometimes write (at most two letters a day, decided by the date). */
  sendLetters(today) {
    const S = this.S;
    if (S.fest.letterDay === today || !S.intro) return;
    S.fest.letterDay = today;
    let sent = 0;
    for (const id of ['hazel', 'rosa', 'bram', 'grumbleton', 'pip']) {
      if (sent >= 2 || heartsOf(npcState(S, id)) < 3) continue;
      if (dayRand(`letter:${today}:${id}`) > 0.35) continue;
      const k = dayRand(`letterk:${today}:${id}`) < 0.5 ? 1 : 2;
      const [gid, n] = LETTER_GIFTS[id][k - 1];
      S.mail.push({ id: `f.${id}.${k}`, from: id, items: gid === 'coins' ? [] : [[gid, n]], coins: gid === 'coins' ? n : 0 });
      sent++;
    }
    if (sent) { this.host.later(1.5, () => this.host.game.ui.toast(t('isl.t.mail'), 2400)); this.host.markDirty(); }
  }

  /** Sky tweaks for rain (grayer, darker). */
  weatherSky(s) {
    if (!this.rainy || this.host.indoors) return s;
    const gray = (c, k) => new THREE.Color(c).lerp(new THREE.Color(0x8a94a8), k).getHex();
    return { ...s, hemi: gray(s.hemi, 0.4), sun: gray(s.sun, 0.5), fog: gray(s.fog, 0.6), water: gray(s.water, 0.35), hi: s.hi * 0.8, si: s.si * 0.45 };
  }

  update(dt) {
    const host = this.host;
    const show = this.rainy && !host.indoors;
    this.rain.visible = show;
    if (show) {
      const c = host.camTarget;
      const a = this.rainGeo.attributes.position.array;
      this.drops.forEach((d, i) => {
        d.y -= dt * 22;
        if (d.y < 0) { d.y = 16 + Math.random() * 4; d.x = (Math.random() - 0.5) * 50; d.z = (Math.random() - 0.5) * 40; }
        const x = c.x + d.x, z = c.z + d.z;
        a.set([x, d.y, z, x - 0.1, d.y + 0.7, z], i * 6);
      });
      this.rainGeo.attributes.position.needsUpdate = true;
    }
    if (this.rocket) {
      const r = this.rocket;
      r.t += dt;
      const pad = host.map.pad.userData.rocket;
      const up = r.t < 3 ? Math.pow(r.t, 2) * 3 : r.t < 4 ? 27 : Math.max(0, 27 - (r.t - 4) * 9);
      pad.position.y = 0.3 + up;
      if (r.t < 3.5 || (r.t > 4 && up > 0)) host.puffs.burst(new THREE.Vector3(host.map.pad.position.x, pad.position.y + 0.5, host.map.pad.position.z), r.t < 3.5 ? 0xffc070 : 0xffffff, { count: 3, speed: 2, up: -3, size: 0.6, life: 0.8, gravity: 0 });
      if (r.t > 7.5) { pad.position.y = 0.3; this.rocket = null; }
    }
  }

  launchRocket() {
    this.rocket = { t: 0 };
    this.host.game.audio.play('whoosh');
  }

  // ---------- festivals and birthdays in conversations ----------

  /** Lines for a festival host (Grumbleton at the Derby, Hazel at the Fair, Bram on Lantern Night), or null. */
  festTalk(n) {
    const S = this.S, f = this.festival, today = dayKey();
    const L = (key, fx) => ({ who: n.id, key, fx });
    if (f === 'derby' && n.id === 'grumbleton') {
      if (S.fest.derbyWon[today]) return { lines: [L('isl.derby.done')] };
      const c = S.fest.derby[today] || 0;
      if (c >= 5) {
        return { lines: [L('isl.derby.win', () => this.host.celebrate(n))], after: () => {
          S.fest.derbyWon[today] = true;
          if (!S.deco.derbyTrophy) this.host.addDeco('derbyTrophy');
          this.host.grant({ coins: 100 });
        } };
      }
      return { lines: [c ? { ...L('isl.derby.progress'), vars: { n: c } } : L('isl.derby.rules')] };
    }
    if (f === 'fair' && n.id === 'hazel') {
      if (S.fest.fairWon[today]) return { lines: [L('isl.fair.done')] };
      const crops = CROP_IDS.filter((c) => count(S, c) > 0);
      if (crops.length >= 3) {
        return { lines: [L('isl.fair.win', () => this.host.celebrate(n))], after: () => {
          for (const c of crops.slice(0, 3)) take(S, c, 1);
          S.fest.fairWon[today] = true;
          if (!S.deco.ribbon) this.host.addDeco('ribbon');
          this.host.grant({ items: [['pumpkinSeed', 2], ['strawberrySeed', 2]] });
        } };
      }
      return { lines: [L('isl.fair.rules')] };
    }
    if (f === 'lanterns' && n.id === 'bram') {
      if (S.fest.lantern) return { lines: [L('isl.lantern.done')] };
      return { lines: [L('isl.lantern.talk', () => this.host.celebrate(n))], after: () => { S.fest.lantern = true; this.host.addDeco('paperLantern'); } };
    }
    return null;
  }

  /** "It's my birthday!" once a day; gifts on birthdays count double. */
  birthdayLine(n) {
    const S = this.S, today = dayKey();
    if (!birthdayOf(n.id) || S.fest.bday[n.id] === today) return null;
    S.fest.bday[n.id] = today;
    return { who: n.id, key: 'isl.bday.today', fx: () => { n.hop = 1; } };
  }

  isBirthday(id) { return birthdayOf(id); }

  /** A caught fish counts for today's Derby. */
  onFish() {
    if (this.festival !== 'derby') return;
    const today = dayKey();
    this.S.fest.derby[today] = (this.S.fest.derby[today] || 0) + 1;
  }

  tasks() {
    const S = this.S, today = dayKey(), out = [];
    if (this.festival === 'derby' && !S.fest.derbyWon[today] && S.sea.rod) out.push(t('isl.task.derby', { n: Math.min(5, S.fest.derby[today] || 0) }));
    if (this.festival === 'fair' && !S.fest.fairWon[today]) out.push(t('isl.task.fair'));
    return out;
  }

  // ---------- the calendar board ----------

  interactions(P, out, nm) {
    if (Math.hypot(P.x - CAL_BOARD.x, P.z - CAL_BOARD.z) < 1.9) out.b = { text: nm('isl.h.calendar'), fn: () => this.openCalendar() };
  }

  openCalendar() {
    const host = this.host;
    host.mode = 'cal';
    this.calT = 0;
    const md = monthDays();
    const loc = getLang() === 'no' ? 'nb-NO' : 'en-GB';
    const title = new Date(md.year, md.month, 1).toLocaleString(loc, { month: 'long', year: 'numeric' });
    const head = t('isl.cal.days').split(',').map((d) => `<div class="isl-calh">${esc(d)}</div>`).join('');
    const blanks = '<div></div>'.repeat(md.first);
    const cells = md.days.map((d) => {
      const marks = [d.festival ? `<i class="f">${esc(t(`isl.fest.${d.festival}`))}</i>` : '', d.bday ? `<i class="b">🎂 ${esc(t(`isl.npc.${d.bday}`))}</i>` : '', d.rain ? '<i class="r">☂</i>' : ''].join('');
      return `<div class="isl-cald ${d.today ? 'on' : ''}"><b>${d.day}</b>${marks}</div>`;
    }).join('');
    const today = md.days.find((d) => d.today);
    const sub = [today.festival ? t(`isl.fest.${today.festival}`) : '', today.bday ? t('isl.cal.bday', { name: t(`isl.npc.${today.bday}`) }) : '', today.rain ? t('isl.cal.rain') : ''].filter(Boolean).join(' · ');
    host.hud.setPanel(`<h2>${esc(t('isl.cal.title'))} <small style="font-size:.5em;opacity:.7">${esc(title)}</small></h2>
      <div class="isl-cal">${head}${blanks}${cells}</div>
      <div class="isl-foot" style="opacity:1;font-size:clamp(14px,1.4vw,20px)">${esc(t('isl.cal.today'))}: ${esc(sub || '—')}</div>
      <div class="isl-foot">${esc(tFor(host.player?.p, 'isl.cal.hint'))}</div>`);
    if (sub) speak(`${t('isl.cal.today')}: ${sub}`);
    host.game.audio.play('select');
  }

  updateCalendar(inp, dt) {
    this.calT += dt;
    if (this.calT > 0.25 && (inp.aPressed || inp.bPressed)) { this.host.hud.setPanel(null); this.host.mode = 'walk'; }
  }
}
