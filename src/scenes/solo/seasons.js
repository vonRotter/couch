import * as THREE from 'three';
import { t, tFor, getLang } from '../../core/i18n.js';
import { esc } from '../../core/ui.js';
import { say as speak } from '../../core/voice.js';
import { now, count, give, take } from './save.js';
import { dayKey, dayRand, birthdayOf, festivalOn, rainyOn, monthDays, seasonOf, weekIndex, SEASONS, SEASON_ICON, SEASON_FEST } from './calendar.js';
import { CROP_IDS, CROPS, inSeason, isHardy } from './items.js';
import { NPCS, npcState, heartsOf } from './npcs.js';
import { PLACES, PIER, PLAZA, heightAt } from './map.js';
import { mesh, cone, makeBunting } from './models.js';
import { makeLanternString } from './models2.js';
import { makePlantFair, makeBeachDay, makeBeachShell } from './models3.js';
import { SeasonLook } from './seasonlook.js';
import { Sled } from './sled.js';

// Island life by the real calendar (milestone B2): rainy days that water the crops, birthdays with party
// hats, letters from friends, the calendar board in the square, festivals, and Pip's rocket launch.
// Milestone B3: one season per real week (see calendar.js) with its own look (seasonlook.js), crops,
// fish, sledding in winter (sled.js) and festival: the Spring Planting Fair (Rosa, plant 5 seeds), the
// Summer Beach Day (Pip, find 4 shells), the Harvest Fair (Hazel) and Lantern Night (Bram). The Fishing
// Derby (Grumbleton) stays on the first weekend of every month. On winter days "rain" falls as snow.

const CAL_BOARD = { x: 17.8, z: -9.8 };
const SHELLS = [[12, 41.2], [16.5, 42.4], [20.5, 38.6], [25, 41.6], [29.5, 40.2], [31.5, 37.8]];
export const SEASON_CSS = { spring: '#ffd6e8', summer: '#fff1a8', autumn: '#ffd2a8', winter: '#d6ecff' };
const LETTER_GIFTS = { hazel: [['carrotSeed', 3], ['lettuceSeed', 3]], rosa: [['bouquet', 1], ['tomatoSeed', 2]], bram: [['pumpkinSeed', 1], ['wood', 3]], grumbleton: [['coins', 40], ['strawberrySeed', 2]], pip: [['starfruitSeed', 1], ['cornSeed', 2]] };

export class Seasons {
  constructor(host) {
    this.host = host;
    const S = host.save;
    if (!S.fest) S.fest = { derby: {}, derbyWon: {}, fairWon: {}, lantern: false, letterDay: '', bday: {} };
    for (const k of ['planted', 'plantWon', 'shells', 'beachWon']) if (!S.fest[k]) S.fest[k] = {};
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
    // spring planting fair around the fountain, summer beach day on the beach
    this.plantDeco = makePlantFair();
    this.plantDeco.position.set(PLAZA.x, 0.08, PLAZA.z);
    host.scene.add(this.plantDeco);
    this.beachDeco = makeBeachDay();
    this.beachDeco.position.set(14, heightAt(14, 38), 37.5);
    host.scene.add(this.beachDeco);
    this.shells = SHELLS.map(([x, z], i) => {
      const g = makeBeachShell();
      g.position.set(x, heightAt(x, z) + 0.02, z);
      g.rotation.y = i * 1.3;
      const glint = mesh(cone(0.05, 0.5, 4), 0xffffff, 0, 0.7, 0, false);
      g.add(glint);
      g.userData.glint = glint;
      host.scene.add(g);
      return { i, x, z, g };
    });
    this.look = new SeasonLook(host);
    this.sled = new Sled(host);
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
    this.season = seasonOf(at);
    this.derbyDeco.visible = this.festival === 'derby';
    this.fairDeco.visible = this.festival === 'fair';
    this.lanternDeco.visible = this.festival === 'lanterns';
    this.plantDeco.visible = this.festival === 'plant';
    this.beachDeco.visible = this.festival === 'beach';
    this.look.apply(this.season);
    this.sled.setWinter(this.season === 'winter');
    this.refreshShells();
  }

  refreshShells() {
    const got = this.S.fest.shells[dayKey()] || [];
    for (const sh of this.shells) sh.g.visible = this.festival === 'beach' && !got.includes(sh.i);
  }

  /** Once a second: a new day brings weather, festivals, letters; rain waters the crops. */
  tick(at) {
    const today = dayKey(at);
    if (today !== this.today) {
      const first = !this.today;
      this.today = today;
      this.refresh();
      this.sendLetters(today);
      // the day's news merge into one toast (see toasts.js)
      const news = [];
      if (this.festival) news.push(t('isl.fest.today', { name: t(`isl.fest.${this.festival}`) }));
      else if (this.rainy) news.push(t(this.season === 'winter' ? 'isl.t.snow' : 'isl.t.rain'));
      const bday = Object.keys(NPCS).find((id) => birthdayOf(id, at));
      if (bday) news.push(t('isl.t.bday', { name: t(`isl.npc.${bday}`) }));
      if (news.length) this.host.later(first ? 2.2 : 0.2, () => { for (const s of news) this.host.dayToast(s); });
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
    if (S.mail.filter((m) => m.id.startsWith('f.')).length >= 3) return; // unread letters wait first
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
    if (sent) { this.host.later(1.5, () => this.host.mailToast()); this.host.markDirty(); }
  }

  /** Sky tweaks for rain (grayer, darker) and a cooler light in winter. */
  weatherSky(s) {
    const away = this.host.indoors || this.host.isle2?.here(); // indoors, or on warm Shell Isle
    if (this.season === 'winter' && !away) {
      const cool = (c, k) => new THREE.Color(c).lerp(new THREE.Color(0xdfeeff), k).getHex();
      s = { ...s, hemi: cool(s.hemi, 0.25), fog: cool(s.fog, 0.35), water: new THREE.Color(s.water).lerp(new THREE.Color(0x8fb8d8), 0.35).getHex() };
    } else if (this.season === 'autumn' && !away) {
      s = { ...s, sun: new THREE.Color(s.sun).lerp(new THREE.Color(0xffc890), 0.25).getHex() };
    }
    if (!this.rainy || this.host.indoors) return s;
    const gray = (c, k) => new THREE.Color(c).lerp(new THREE.Color(0x8a94a8), k).getHex();
    return { ...s, hemi: gray(s.hemi, 0.4), sun: gray(s.sun, 0.5), fog: gray(s.fog, 0.6), water: gray(s.water, 0.35), hi: s.hi * 0.8, si: s.si * 0.45 };
  }

  update(dt) {
    const host = this.host;
    const show = this.rainy && !host.indoors && this.season !== 'winter'; // winter: snow instead
    this.look.update(dt, { indoors: host.indoors || host.isle2?.here(), heavy: this.rainy }); // Shell Isle is always warm
    this.sled.animate(dt, host.time);
    for (const sh of this.shells) if (sh.g.visible) { sh.g.userData.glint.rotation.y += dt * 3; sh.g.userData.glint.scale.y = 0.6 + Math.sin(host.time * 5 + sh.i) * 0.4; }
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
    if (f === 'plant' && n.id === 'rosa') {
      if (S.fest.plantWon[today]) return { lines: [L('isl.plant.done')] };
      const c = S.fest.planted[today] || 0;
      if (c >= 5) {
        return { lines: [L('isl.plant.win', () => this.host.celebrate(n))], after: () => {
          S.fest.plantWon[today] = true;
          if (!S.deco.tulips) this.host.addDeco('tulips');
          const seeds = CROP_IDS.filter((id) => inSeason(id, 'spring') && !isHardy(id));
          this.host.grant({ items: [[`${seeds[Math.floor(dayRand(`plant:${today}`) * seeds.length)]}Seed`, 4]], coins: 30 });
        } };
      }
      return { lines: [c ? { ...L('isl.plant.progress'), vars: { n: c } } : L('isl.plant.rules')] };
    }
    if (f === 'beach' && n.id === 'pip') {
      if (S.fest.beachWon[today]) return { lines: [L('isl.beach.done')] };
      const c = (S.fest.shells[today] || []).length;
      if (c >= 4) {
        return { lines: [L('isl.beach.win', () => this.host.celebrate(n))], after: () => {
          S.fest.beachWon[today] = true;
          if (!S.deco.sandcastle) this.host.addDeco('sandcastle');
          this.host.grant({ coins: 60 });
        } };
      }
      return { lines: [c ? { ...L('isl.beach.progress'), vars: { n: c } } : L('isl.beach.rules')] };
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

  /** A seed went into the ground (counts for the Planting Fair). */
  onPlant() {
    if (this.festival !== 'plant') return;
    const today = dayKey();
    this.S.fest.planted[today] = (this.S.fest.planted[today] || 0) + 1;
  }

  /** [B] near a glinting shell on Beach Day. */
  shellAction(P, out, nm) {
    if (this.festival !== 'beach') return;
    for (const sh of this.shells) {
      if (!sh.g.visible || Math.hypot(P.x - sh.x, P.z - sh.z) > 1.4) continue;
      out.b = { text: nm('isl.h.pick', { item: t('isl.i.seaShell') }), fn: () => this.pickShell(sh) };
      return;
    }
  }

  pickShell(sh) {
    const S = this.S, today = dayKey();
    const got = S.fest.shells[today] || (S.fest.shells[today] = []);
    if (got.includes(sh.i)) return;
    got.push(sh.i);
    give(S, 'seaShell', 1);
    this.refreshShells();
    this.host.confetti.burst(new THREE.Vector3(sh.x, 1, sh.z), 0, { count: 16, speed: 3, up: 3, colors: [0xffd8c8, 0xffffff, 0x8ff0ff], life: 0.9, gravity: -6 });
    this.host.game.audio.play('star');
    this.host.game.ui.toast(t('isl.beach.found', { n: Math.min(4, got.length) }), 1600);
    this.host.markDirty();
  }

  tasks() {
    const S = this.S, today = dayKey(), out = [];
    if (this.festival === 'plant' && !S.fest.plantWon[today]) out.push(t('isl.task.plant', { n: Math.min(5, S.fest.planted[today] || 0) }));
    if (this.festival === 'beach' && !S.fest.beachWon[today]) out.push(t('isl.task.beach', { n: Math.min(4, (S.fest.shells[today] || []).length) }));
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
      const marks = [d.festival ? `<i class="f">${esc(t(`isl.fest.${d.festival}`))}</i>` : '', d.bday ? `<i class="b">🎂 ${esc(t(`isl.npc.${d.bday}`))}</i>` : '', d.rain ? `<i class="r">${d.season === 'winter' ? '❄' : '☂'}</i>` : ''].join('');
      // every week has its season: the days get its color, Mondays its icon
      const dow = (md.first + d.day - 1) % 7;
      return `<div class="isl-cald ${d.today ? 'on' : ''}" style="background:${SEASON_CSS[d.season]}"><b>${d.day}${dow === 0 || d.day === 1 ? ` <small>${SEASON_ICON[d.season]}</small>` : ''}</b>${marks}</div>`;
    }).join('');
    const today = md.days.find((d) => d.today);
    const sub = [this.seasonText(), today.festival ? t(`isl.fest.${today.festival}`) : '', today.bday ? t('isl.cal.bday', { name: t(`isl.npc.${today.bday}`) }) : '', today.rain ? t(today.season === 'winter' ? 'isl.cal.snow' : 'isl.cal.rain') : ''].filter(Boolean).join(' · ');
    const legend = SEASONS.map((sn) => `<span style="background:${SEASON_CSS[sn]};border-radius:999px;padding:1px 10px;margin:0 3px">${SEASON_ICON[sn]} ${esc(t(`isl.season.${sn}`))} · ${esc(t(`isl.fest.${SEASON_FEST[sn]}`))}</span>`).join('');
    host.hud.setPanel(`<h2>${esc(t('isl.cal.title'))} <small style="font-size:.5em;opacity:.7">${esc(title)}</small></h2>
      <div class="isl-cal">${head}${blanks}${cells}</div>
      <div class="isl-foot" style="opacity:1;font-size:clamp(11px,1vw,15px);margin-top:6px">${legend}</div>
      <div class="isl-foot" style="opacity:1;font-size:clamp(14px,1.4vw,20px);margin-top:6px">${esc(t('isl.cal.today'))}: ${esc(sub || '—')}</div>
      <div class="isl-foot">${esc(tFor(host.player?.p, 'isl.cal.hint'))}</div>`);
    if (sub) speak(`${t('isl.cal.today')}: ${sub}`);
    host.game.audio.play('select');
  }

  /** "Autumn week" and what comes next. */
  seasonText() {
    const next = seasonOf(now() + 7 * 24 * 3600 * 1000);
    return t('isl.season.week', { season: `${SEASON_ICON[this.season]} ${t(`isl.season.${this.season}`)}`, next: t(`isl.season.${next}`) });
  }

  updateCalendar(inp, dt) {
    this.calT += dt;
    if (this.calT > 0.25 && (inp.aPressed || inp.bPressed)) { this.host.hud.setPanel(null); this.host.mode = 'walk'; }
  }
}
