import * as THREE from 'three';
import { t } from '../../core/i18n.js';
import { say as speak } from '../../core/voice.js';
import { now, hourOf, count, take } from './save.js';
import { latePlay, dayKey, dayIndex, dayMs, dayRand, festivalOn, surpriseOn, rareEventOn, freeDay, rainyOn, seasonOf, birthdayOf, BIRTHDAYS } from './calendar.js';
import { heightAt } from './map.js';
import { mesh, box, sph, cyl, cone } from './models.js';
import { EVERYDAY } from './strings14.js';
import { rv } from './today.js';
import { SOCIAL, socialTasks, memOf } from './social.js';

// The villagers' own lives (the "livelier island" round, part 2), within the owner's budget:
// - Conversations: one at a time, one to three a day (morning, afternoon, evening slots by date), started near
//   you: one villager walks over to another, they face each other and talk in bubbles. Walk up (7 m) to hear
//   it: the bubbles show the words and each line is said in the speaker's voice. A conversation you heard does
//   not come back for four weeks (S.village.heard): 24 everyday topics plus news topics (the weather, tomorrow's
//   festival or birthday, today's visitor, a rare event, a drama or a project going on).
// - Reactions: what you did (up on the game hall roof, a hop trail record, a crab helped, a trophy, a new fish,
//   a big harvest) is said once, by the first villager you talk to who would know (at most once a week a kind).
// - Running dramas, one at a time with days off between: Pip and Grumbleton's fishing contest (pick a side: your
//   fish count for it), Aunt Hazel's prize pumpkin (water it, once a day), Rosa's secret cake (bring the special
//   thing). A start, a middle two days later and a big moment on the first free day (no festival, surprise or
//   rare event) from the fourth day on, where you see how it ends.
// - Week-long projects, one at a time, in different corners of the island: Bram's gazebo (south-east), Aunt
//   Hazel's garden (west meadow), Pip's star lookout (north-east) and Rosa's bandstand (south-west). Four stages
//   two days apart; the builder works on the site in the early afternoon; 5 wood makes it a day faster.

const HEAR_R = 7;
const CHAT_GAP = 28; // days before a heard topic can come back
const SLOTS = [[9.5, 11.5], [13, 15], [16.5, 18.5]];
const PROJECTS = {
  gazebo: { who: 'bram', x: 30, z: 24 },
  garden: { who: 'hazel', x: -8, z: 12 },
  lookout: { who: 'pip', x: 36, z: -22 },
  bandstand: { who: 'rosa', x: -4, z: 30 },
  // later, slowly (about one every three weeks once the first four are done): the island keeps changing for months
  birdhide: { who: 'hoot', x: -16, z: -24 }, // a bird-watching hut on the hill above your cottage (north-west)
  windmill: { who: 'hazel', x: 22, z: -30 }, // a little windmill under the north cliffs
  course: { who: 'coach', x: 46, z: 18 }, // Coach Bo's obstacle course below the mech garage (east)
  boatshed: { who: 'grumbleton', x: 26, z: 32 }, // a boat shed by the south beach
};
const PROJ_ORDER = ['gazebo', 'garden', 'lookout', 'bandstand', 'birdhide', 'windmill', 'course', 'boatshed'];
const PROJ_GAP = (n) => (n < 4 ? 3 : 21); // days between one project and the next (slowly after the first four)
const STAGE_DAYS = [0, 2, 4, 6];
const ASK_EVERY = 3; // days between a builder's asks for wood after "Not now"
const DRAMAS = {
  rivalry: { cast: ['pip', 'grumbleton'], at: { x: 2.4, z: 41.6 }, icon: '🎣' },
  pumpkin: { cast: ['hazel'], at: { x: 4.6, z: -23.0 }, icon: '🎃' },
  cake: { cast: ['rosa'], at: { x: 15.8, z: -3.4 }, icon: '🎂' },
  // the odd-adventure round's social happenings (social.js): the same one-at-a-time rhythm
  ...Object.fromEntries(Object.entries(SOCIAL).map(([id, d]) => [id, { cast: d.cast, at: d.at, icon: d.icon }])),
};
// the first three, then the social happenings join the turn order (one every week and a half or so)
const DRAMA_ORDER = ['rivalry', 'pumpkin', 'cake', 'fence', 'election', 'club', 'party', 'rumour'];
const DRAMA_GAP = 5;
const REACT = {
  roof: ['pip', 'coach', 'rosa', 'hoot'], hopRecord: ['hazel', 'pip', 'coach', 'bram'], crab: ['shelby', 'grumbleton', 'bram', 'hazel'],
  trophy: ['coach', 'rosa', 'hoot', 'pip'], newFish: ['grumbleton', 'hoot', 'bram'], harvest: ['hazel', 'rosa', 'mumble'],
};

export class Village {
  constructor(host) {
    this.host = host;
    this.chat = null;
    this.t = 0;
    this.props = new Map();
    this.site = null;
    if (!document.getElementById('isl-say-style')) {
      const st = document.createElement('style');
      st.id = 'isl-say-style';
      st.textContent = `.label.isl-say { background: #fff; color: #2b2340; border-radius: 14px; padding: 4px 11px; max-width: min(300px, 40vw); white-space: normal; text-align: center;
        font-weight: 600; font-size: clamp(12px, 1.15vw, 18px); line-height: 1.25; box-shadow: 0 3px 0 rgba(43,35,64,.18); }
        .label.isl-say.far { padding: 2px 8px; font-size: clamp(14px, 1.4vw, 20px); }`;
      document.head.appendChild(st);
    }
    this.bubble = host.game.ui.label('label isl-say');
    this.bubble.style.display = 'none';
  }

  get S() { return this.host.save; }

  /** The save's village state (old saves have none: everything starts quiet). */
  get V() {
    const S = this.S;
    if (!S.village || typeof S.village !== 'object') S.village = {};
    const V = S.village;
    V.heard ||= [];
    V.react ||= { q: [], last: {}, n: {} };
    V.built ||= [];
    if (V.dramaN === undefined) V.dramaN = 0;
    if (V.projN === undefined) V.projN = 0;
    return V;
  }

  // ---------- the days: dramas and projects move on ----------

  newDay(at) {
    const V = this.V, S = this.S, di = dayIndex(at);
    if (V.nextDrama === undefined) V.nextDrama = di + 2; // (a new island: a quiet first day)
    if (V.nextProj === undefined) V.nextProj = di + 1;
    // a drama that ended, or whose big day you missed
    const D = V.drama;
    if (D && (D.start > di + 30 || di < D.start)) V.drama = null; // (the clock went far backwards)
    else if (D && di > D.climax) {
      if (!D.res) { D.res = this.outcome(D); this.reward(D, false); V.resNews = { id: D.id, res: D.res, di }; }
      V.past = [...(V.past || []), { id: D.id, res: D.res, di: D.climax }].slice(-6);
      V.drama = null;
      V.nextDrama = di + DRAMA_GAP;
      V.dramaN++;
    }
    // a locked event plays late today (lock.js): the big moment waits for the next free day (one special thing a day)
    if (V.drama && V.drama.climax === di && !V.drama.res && latePlay(at)) { let c = di + 1; while (c < di + 30 && !freeDay(dayMs(c))) c++; V.drama.climax = c; }
    if (!V.drama && S.intro && di >= V.nextDrama) {
      const id = DRAMA_ORDER[V.dramaN % DRAMA_ORDER.length];
      let climax = di + 4;
      while (climax < di + 60 && !freeDay(dayMs(climax))) climax++;
      V.drama = { id, start: di, climax, told: {}, side: null, fish: 0, water: [], flavor: null, res: null };
      SOCIAL[id]?.init?.(V.drama);
    }
    // the project
    const P = V.proj;
    if (P && (di < P.start || P.start < di - 30)) V.proj = null;
    if (V.proj) {
      const k = this.stageOf(V.proj, di);
      if (k !== V.proj.stage) { V.proj.stage = k; V.proj.news = di; }
      if (k >= 3) { V.built.push(V.proj.id); V.doneNews = { id: V.proj.id, di }; V.proj = null; V.nextProj = di + PROJ_GAP(V.projN); }
    }
    if (!V.proj && S.intro && di >= V.nextProj && V.projN < PROJ_ORDER.length) {
      V.proj = { id: PROJ_ORDER[V.projN], start: di, stage: 0, help: false, askedDay: null, news: di };
      V.projN++;
    }
    this.refreshProps();
  }

  stageOf(P, di) {
    const eff = di - P.start + (P.help ? 1 : 0);
    return Math.max(0, STAGE_DAYS.filter((d) => eff >= d).length - 1);
  }

  /** The drama's beat today: 'start', 'mid', 'climax' or null. */
  beat(D, di) {
    if (!D) return null;
    if (di === D.start) return 'start';
    if (di === D.start + 2 && D.start + 2 < D.climax) return 'mid';
    if (di === D.climax) return 'climax';
    return null;
  }

  /** The stage of the drama you are in now (for talking): 'start' until the middle, then 'mid'. */
  stageNow(D, di) {
    if (!D || di >= D.climax) return null;
    return di >= D.start + 2 && D.start + 2 < D.climax ? 'mid' : 'start';
  }

  scores(D) {
    const p = 1 + Math.floor(dayRand(`riv:p:${D.start}`) * 3), g = 1 + Math.floor(dayRand(`riv:g:${D.start}`) * 3);
    return { p: p + (D.side === 'pip' ? D.fish : 0), g: g + (D.side === 'grumbleton' ? D.fish : 0) };
  }

  outcome(D) {
    if (SOCIAL[D.id]) return SOCIAL[D.id].outcome(D, this);
    if (D.id === 'rivalry') {
      if (D.side === 'fair') return 'tie';
      const s = this.scores(D);
      return s.p > s.g ? 'pip' : s.g > s.p ? 'grum' : 'tie';
    }
    if (D.id === 'pumpkin') return D.water.length >= 3 ? 'gold' : D.water.length >= 1 ? 'silver' : 'bronze';
    return D.flavor || 'plain';
  }

  /** The Today board's things from the villagers. */
  todayNews(at) {
    const V = this.V, di = dayIndex(at), out = [];
    const D = V.drama;
    const b0 = this.beat(D, di);
    // (the big moment plays 10-18: a first visit after that is not told "today: ..."; the next day's board says how
    // it ended. Play-test: "Today: the pumpkin weighing!" at 18:00, when everyone had gone home)
    const b = b0 === 'climax' && hourOf(at) >= 18 ? null : b0;
    if (b) {
      const at2 = DRAMAS[D.id].at;
      const v = D.id === 'rivalry' && b === 'mid' ? this.scores(D) : SOCIAL[D.id]?.newsVars?.(D, b, this);
      out.push({ kind: b === 'start' ? 'rumor' : 'changed', pri: b === 'climax' ? 9.5 : 6.5, icon: DRAMAS[D.id].icon, keys: [`vd.${D.id}.news.${b === 'mid' ? 'mid' : b}`], v, x: at2.x, z: at2.z });
    }
    if (V.resNews?.di === di) out.push({ kind: 'changed', pri: 7, icon: DRAMAS[V.resNews.id].icon, keys: [`vd.${V.resNews.id}.news.${V.resNews.res}`] });
    const P = V.proj, PD = P && PROJECTS[P.id];
    if (P && P.news === di) out.push({ kind: P.stage === 0 ? 'rumor' : 'changed', pri: 6, icon: '🔨', keys: [`vp.${P.id}.s${P.stage}`], x: PD.x, z: PD.z });
    if (V.doneNews?.di === di) { const Q = PROJECTS[V.doneNews.id]; out.push({ kind: 'changed', pri: 7.5, icon: '🏗️', keys: [`vp.${V.doneNews.id}.s3`], x: Q.x, z: Q.z }); }
    return out;
  }

  /** What tomorrow brings from the villagers (the tomorrow line), or null. */
  tomorrowLine(at = now()) {
    const V = this.V, di = dayIndex(at);
    if (V.drama && V.drama.climax === di + 1) return t(`vd.${V.drama.id}.tm`);
    const P = V.proj;
    if (P && this.stageOf(P, di + 1) > this.stageOf(P, di)) return t('vp.tm', { name: t(`vp.${P.id}.name`) });
    return null;
  }

  mapItems() {
    const V = this.V, di = dayIndex(), out = [];
    if (V.proj) { const P = PROJECTS[V.proj.id]; out.push({ key: 'proj', icon: '🔨', name: t('map.a.proj', { name: t(`vp.${V.proj.id}.name`) }), x: P.x, z: P.z }); }
    const D = V.drama;
    if (D && (D.id === 'pumpkin' || di === D.climax || (SOCIAL[D.id]?.mapAlways && di < D.climax))) out.push({ key: 'drama', icon: DRAMAS[D.id].icon, name: t(`map.a.${D.id}`), x: DRAMAS[D.id].at.x, z: DRAMAS[D.id].at.z });
    return out;
  }

  // ---------- schedules: the big moment and the building site ----------

  /** A schedule override for a villager now ({ spot, name, sleep, inside }), or null. */
  schedule(id, at) {
    const V = this.S.village;
    if (!V || this.host.isle2?.here()) return null;
    const di = dayIndex(at), h = hourOf(at);
    const D = V.drama;
    if (D && di === D.climax && !D.res && h >= 10 && h < 18) {
      const i = DRAMAS[D.id].cast.indexOf(id);
      if (i >= 0) { const a = DRAMAS[D.id].at; return { spot: { x: a.x + (i ? 1.6 : -1.4), z: a.z + 1.2 }, name: `v:drama:${i}`, sleep: false, inside: false }; }
    }
    const P = V.proj;
    if (P && PROJECTS[P.id].who === id && h >= 13 && h < 15 && !festivalOn(at)) {
      const Q = PROJECTS[P.id];
      return { spot: { x: Q.x + 2.2, z: Q.z + 1.4 }, name: 'v:proj', sleep: false, inside: false };
    }
    return null;
  }

  // ---------- talking ----------

  /** Something new to say about a drama or a project (the "!"). */
  hasNews(id) {
    const V = this.S.village, di = dayIndex();
    if (!V) return false;
    const D = V.drama, st = this.stageNow(D, di);
    if (st && DRAMAS[D.id].cast.includes(id) && !D.told[`${id}:${st}`] && this.dramaLines(D, id, st)) return true;
    if (st && SOCIAL[D.id]?.hasNews?.(D, id, this)) return true; // a clue, a party thing, a version of the rumour (social.js)
    return false;
  }

  dramaLines(D, id, st) {
    const has = (k) => t(k) !== k;
    const out = [];
    for (let i = 1; i <= 3; i++) { const k = `vd.${D.id}.${id}.${st}.${i}`; if (has(k)) out.push(k); }
    return out.length ? out : null;
  }

  /** Before the usual talk (island.talkTo): a drama's news or a project's ask. True: handled. */
  talk(n, done) {
    const V = this.V, D = V.drama, di = dayIndex(), host = this.host, id = n.id;
    const st = this.stageNow(D, di);
    if (D && st && SOCIAL[D.id]?.talkFirst?.(D, n) && SOCIAL[D.id].talkOther(D, n, this, done)) return true;
    const keys = st && DRAMAS[D.id].cast.includes(id) && !D.told[`${id}:${st}`] ? this.dramaLines(D, id, st) : null;
    if (keys) {
      D.told[`${id}:${st}`] = true;
      const lines = keys.map((key) => ({ who: id, key }));
      const last = lines[lines.length - 1];
      if (D.id === 'rivalry' && st === 'start' && !D.side) {
        last.choices = [`vd.rivalry.side.${id}`, 'vd.rivalry.side.fair'];
        last.onChoice = (i) => { D.side = i === 0 ? id : 'fair'; host.say([{ who: id, key: i === 0 ? 'vd.rivalry.picked' : 'vd.rivalry.fair' }], done); host.markDirty(); };
      } else if (SOCIAL[D.id]?.choice) SOCIAL[D.id].choice(D, id, st, last, this, done);
      else if (D.id === 'cake' && st === 'start' && !D.flavor) {
        last.choices = ['vd.cake.pick.strawberry', 'vd.cake.pick.carrot', 'vd.cake.pick.plain'];
        last.onChoice = (i) => {
          const f = ['strawberry', 'carrot', 'plain'][i];
          if (f === 'plain') { D.flavor = 'plain'; host.say([{ who: id, key: 'vd.cake.plain' }], done); return; }
          if (take(this.S, f, 1)) { D.flavor = f; host.addPts(id, 4); host.say([{ who: id, key: 'vd.cake.got' }], done); } else { D.told[`${id}:${st}`] = false; host.say([{ who: id, key: 'vd.cake.need' }], done); }
          host.markDirty();
        };
      }
      host.say(lines, last.choices ? undefined : done);
      return true;
    }
    // the social happenings: a clue, a party thing, a version of the rumour from someone who is not in the cast
    if (D && st && SOCIAL[D.id]?.talkOther?.(D, n, this, done)) return true;
    // the builder asks for wood
    const P = V.proj;
    // (while it runs and nobody helped yet; after "Not now" they ask again every third day, not daily)
    if (P && PROJECTS[P.id].who === id && !P.help && (P.askedDay == null || di - P.askedDay >= ASK_EVERY) && P.stage < 3 && P.stage >= 0) {
      P.askedDay = di;
      host.say([{ who: id, key: 'vp.ask', vars: { thing: t(`vp.thing.${P.id}`) }, choices: ['vp.give', 'vp.later'], onChoice: (i) => {
        if (i !== 0) { host.say([{ who: id, key: 'vp.ok' }], done); return; }
        if (!take(this.S, 'wood', 5)) { host.say([{ who: id, key: 'vp.noWood' }], done); return; }
        P.help = true;
        host.addPts(id, 6);
        host.say([{ who: id, key: 'vp.thanks' }], done);
        host.markDirty();
      } }]);
      return true;
    }
    return false;
  }

  // ---------- reactions to what you did ----------

  /** Remember something you did, for one villager to mention (a kind at most once a week). */
  note(kind, v = {}) {
    if (!REACT[kind] || !this.S.intro) return;
    const R = this.V.react, di = dayIndex();
    if (di - (R.last[kind] ?? -99) < 7) return;
    R.last[kind] = di;
    R.q = [...R.q.filter((x) => di - x.di <= 5), { kind, v, di }].slice(-3);
    this.host.markDirty();
  }

  /** A line about what you did, if this villager would know (it is then said, and gone). */
  reactLine(n) {
    const R = this.V.react, di = dayIndex();
    R.q = R.q.filter((x) => di - x.di <= 5 && di >= x.di);
    const i = R.q.findIndex((x) => REACT[x.kind].includes(n.id));
    if (i < 0) return null;
    const r = R.q.splice(i, 1)[0];
    const k = (R.n[r.kind] || 0) % 4;
    R.n[r.kind] = (R.n[r.kind] || 0) + 1;
    (R.said ||= []).push({ key: `vr.${r.kind}.${k + 1}`, v: r.v, di, who: n.id });
    R.said = R.said.slice(-40);
    this.host.markDirty();
    return { who: n.id, key: `vr.${r.kind}.${k + 1}`, vars: rv(r.v) };
  }

  onFish(id) {
    const D = this.V.drama;
    if (id && D?.id === 'rivalry' && D.side && D.side !== 'fair' && dayIndex() < D.climax) D.fish++;
    if (id && this.S.sea?.log?.[id] === 1) this.note('newFish', { fish: `@isl.i.${id}` });
  }

  onHarvest() {
    const V = this.V, day = dayKey();
    if (V.harv?.day !== day) V.harv = { day, n: 0 };
    if (++V.harv.n === 10) this.note('harvest');
  }

  // ---------- the pumpkin ----------

  interactions(P, out, nm) {
    const D = this.S.village?.drama;
    if (D && !D.res && SOCIAL[D.id]?.interactions?.(P, out, nm, D, this)) return true; // the ballot box, the club's door and guard (social.js)
    if (!D || D.id !== 'pumpkin' || dayIndex() >= D.climax) return false;
    const a = DRAMAS.pumpkin.at;
    if (Math.hypot(P.x - a.x, P.z - a.z) > 1.6) return false;
    const today = dayIndex();
    out.b = D.water.includes(today) ? { text: t('vd.pumpkin.h.wet'), fn: () => this.host.game.audio.play('bump') } : { text: nm('vd.pumpkin.h.water'), fn: () => this.waterPumpkin() };
    return true;
  }

  waterPumpkin() {
    const D = this.V.drama, host = this.host, a = DRAMAS.pumpkin.at;
    D.water.push(dayIndex());
    host.puffs.burst(new THREE.Vector3(a.x, heightAt(a.x, a.z) + 0.6, a.z), 0x6fd0ff, { count: 14, speed: 2, up: 1, size: 0.2, life: 0.6, gravity: -12 });
    host.game.audio.play('splat');
    host.game.ui.toast(t('vd.pumpkin.t.water'), 1800);
    this.refreshProps();
    host.markDirty();
  }

  // ---------- the big moment ----------

  /** On the drama's big day you walk up to it: it plays out. */
  updateClimax(force = false) {
    const D = this.S.village?.drama, host = this.host, P = host.player, di = dayIndex();
    if (!D || di !== D.climax || D.res || (host.mode !== 'walk' && !force) || !P) return;
    const h = hourOf();
    if (h >= 18) { D.res = this.outcome(D); this.reward(D, false); this.V.resNews = { id: D.id, res: D.res, di: di + 1 }; return; }
    if (h < 10) return;
    const a = DRAMAS[D.id].at;
    if (!force && (Math.hypot(P.x - a.x, P.z - a.z) > 4.5 || SOCIAL[D.id]?.waitClimax?.(D))) return;
    D.res = this.outcome(D);
    const who = DRAMAS[D.id].cast[0], who2 = DRAMAS[D.id].cast[1] || who;
    const lines = [{ who: D.id === 'rivalry' ? 'grumbleton' : who, key: `vd.${D.id}.end.1` }, { who: D.id === 'rivalry' ? who : who2, key: `vd.${D.id}.end.${D.res}`, fx: () => this.cheer(D) }];
    if (D.id === 'rivalry' && D.side) lines.push({ who: D.side === 'fair' ? 'pip' : D.side, key: 'vd.rivalry.end.thanks' });
    for (const id of DRAMAS[D.id].cast) { const n = host.npc(id); if (n) { n.talking = true; n.model.face(P.x - n.x, P.z - n.z); } }
    host.say(lines, () => { for (const id of DRAMAS[D.id].cast) { const n = host.npc(id); if (n) { n.talking = false; n.spotName = null; } } this.reward(D, true); });
    this.refreshProps();
    host.markDirty();
  }

  cheer(D) {
    const host = this.host, a = DRAMAS[D.id].at;
    host.confetti.burst(new THREE.Vector3(a.x, heightAt(a.x, a.z) + 1.5, a.z), 0, { count: 40, speed: 6, up: 4, life: 1.4, gravity: -6, colors: [0xff5d73, 0xffc93c, 0x3ddc97, 0x4cc9f0] });
    host.game.audio.play('fanfare');
    for (const id of DRAMAS[D.id].cast) { const n = host.npc(id); if (n) n.hop = 1; }
  }

  /** Rewards: more when you took part (and were there to see it). */
  reward(D, seen) {
    const host = this.host;
    if (D.rewarded) return;
    D.rewarded = true;
    const H = SOCIAL[D.id];
    if (H) { if (H.part(D)) host.addPts(DRAMAS[D.id].cast[0], seen ? 8 : 4); H.reward(D, seen, this); return; }
    const part = D.id === 'rivalry' ? !!D.side : D.id === 'pumpkin' ? D.water.length > 0 : !!D.flavor && D.flavor !== 'plain';
    if (!part) return;
    const who = D.id === 'rivalry' ? (D.side === 'fair' ? 'pip' : D.side) : DRAMAS[D.id].cast[0];
    host.addPts(who, seen ? 8 : 4);
    if (!seen) return;
    if (D.id === 'rivalry') host.grant({ coins: 40 });
    else if (D.id === 'pumpkin') host.grant({ coins: D.res === 'gold' ? 60 : 30, items: [['pumpkinSeed', 2]] });
    else host.grant({ coins: 30, items: [['bouquet', 1]] });
  }

  // ---------- conversations ----------

  /** Today's conversation slots: [{ i, from, to }] (one to three, by date). */
  slots(day) {
    const n = 1 + Math.floor(dayRand(`chats:${day}`) * 3);
    let idx = [0, 1, 2];
    if (n === 2) idx.splice(Math.floor(dayRand(`chatdrop:${day}`) * 3), 1);
    if (n === 1) idx = [Math.floor(dayRand(`chatone:${day}`) * 3)];
    return idx.map((i) => ({ i, from: SLOTS[i][0] + dayRand(`chatat:${day}:${i}`), to: SLOTS[i][1] }));
  }

  available(n) {
    return !n.sleep && !n.inside && !n.away && !n.busy && !n.talking && !n.intro && !n.doorAnim && !n.playMove && n.model.group.visible && n.z < 120 && !n.wantIn;
  }

  /** News topics that fit today: [{ id, key, vars, only: [a, b] (fixed roles), not: [...] }]. */
  newsTopics(at) {
    const di = dayIndex(at), out = [];
    const D = this.V.drama, st = this.stageNow(D, di);
    if (D && st) {
      const cast = DRAMAS[D.id].cast;
      if (D.id === 'rivalry' && st === 'start') out.push({ id: `drama:${D.start}:start`, key: 'rivalry.start', only: ['pip', 'grumbleton'] });
      else out.push({ id: `drama:${D.start}:${st}`, key: `${D.id}.${st}`, not: cast });
    }
    const P = this.V.proj;
    if (P && P.stage < 3) out.push({ id: `proj:${P.id}`, key: `proj.${P.id}`, not: [PROJECTS[P.id].who] });
    const rare = rareEventOn(at);
    if (rare) out.push({ id: `rare:${rare}`, key: rare });
    const sur = surpriseOn(at);
    if (sur === 'merchant' || sur === 'balloon') out.push({ id: sur, key: sur });
    if (rainyOn(at) && !rare) out.push(seasonOf(at) === 'winter' ? { id: 'snow', key: 'snow' } : { id: 'rain', key: 'rain' });
    const tm = at + 86400000, f = festivalOn(tm);
    if (f && f !== festivalOn(at)) out.push({ id: `fest:${f}`, key: 'fest', vars: { fest: `@isl.fest.${f}` } });
    const b = Object.keys(BIRTHDAYS).find((x) => birthdayOf(x, tm));
    if (b) out.push({ id: `bday:${b}`, key: 'bday', vars: { who: `@isl.npc.${b}` }, not: [b] });
    return out;
  }

  /** Pick a topic and a pair near you (or null). */
  plan(at) {
    const host = this.host, P = host.player, V = this.V, di = dayIndex(at), day = dayKey(at);
    const free = host.npcs.filter((n) => this.available(n) && Math.hypot(n.x - P.x, n.z - P.z) < 30);
    if (free.length < 2) return null;
    const recent = new Set(V.heard.filter((h) => di - h.di < CHAT_GAP).flatMap((h) => [h.id, `k:${h.key || h.id}`])); // (a topic's words, whatever the festival or the pair)
    const every = EVERYDAY.map((k) => ({ id: k, key: k, r: dayRand(`topic:${day}:${k}`) })).sort((a, b) => a.r - b.r);
    for (const tp of [...this.newsTopics(at), ...every]) {
      if (recent.has(tp.id) || recent.has(`k:${tp.key}`)) continue;
      let best = null;
      for (const a of free) for (const b of free) {
        if (a === b) continue;
        if (tp.only && (a.id !== tp.only[0] || b.id !== tp.only[1])) continue;
        if (tp.not && (tp.not.includes(a.id) || tp.not.includes(b.id))) continue;
        const dab = Math.hypot(a.x - b.x, a.z - b.z);
        if (dab > 30) continue;
        const score = Math.hypot(a.x - P.x, a.z - P.z) + dab * 0.5;
        if (!best || score < best.score) best = { a, b, score };
      }
      if (best) return { tp, a: best.a, b: best.b };
    }
    return null;
  }

  tickChats(at) {
    const host = this.host, V = this.V, day = dayKey(at), h = hourOf(at);
    if (this.chat || !host.player || !this.S.intro || host.isle2?.here() || host.mode !== 'walk' || festivalOn(at)) return;
    if (V.chat?.day !== day) V.chat = { day, done: [] };
    const slot = this.slots(day).find((s) => h >= s.from && h < s.to && !V.chat.done.includes(s.i));
    if (!slot) return;
    const p = this.plan(at);
    if (!p) return;
    V.chat.done.push(slot.i);
    this.startChat(p);
  }

  startChat({ tp, a, b }) {
    const host = this.host;
    for (const n of [a, b]) { n.busy = true; n.route = []; }
    // b walks over to a (to a spot a step in front of a)
    const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz) || 1;
    const tx = a.x + (dx / d) * 1.5, tz = a.z + (dz / d) * 1.5;
    b.route = d > 2 ? host.map.route(b.x, b.z, tx, tz) : [];
    if (b.route.length) b.route[b.route.length - 1] = { x: tx, z: tz }; else if (d > 2) b.route = [{ x: tx, z: tz }];
    const who = [a.id, b.id, a.id];
    const lines = [1, 2, 3].map((i, k) => ({ who: who[k], key: `vc.${tp.key}.${i}`, vars: tp.vars }));
    this.chat = { tp, a, b, lines, i: -1, t: 0, phase: 'walk', heard: 0, texts: [], start: now() };
    this.chats = (this.chats || 0) + 1;
  }

  endChat(abort = false) {
    const C = this.chat;
    if (!C) return;
    for (const n of [C.a, C.b]) { n.busy = false; n.spotName = null; }
    if (!abort && C.heard >= 2) {
      const V = this.V, di = dayIndex();
      V.heard = [...V.heard.filter((h) => di - h.di < 60), { id: C.tp.id, key: C.tp.key, di, pair: `${C.a.id}+${C.b.id}`, texts: C.texts }];
      this.host.markDirty();
    }
    this.lastChat = { ...C, abort };
    this.chat = null;
    this.bubble.style.display = 'none';
  }

  updateChat(dt) {
    const C = this.chat, host = this.host, P = host.player;
    if (!C) { this.bubble.style.display = 'none'; return; }
    C.t += dt;
    if (C.a.talking || C.b.talking || C.a.sleep || C.b.sleep || C.a.wantIn || C.b.wantIn || !P) { this.endChat(true); return; }
    if (C.phase === 'walk') {
      const d = Math.hypot(C.a.x - C.b.x, C.a.z - C.b.z);
      if (!C.b.route.length && d < 2.6) { C.phase = 'talk'; C.t = 0; C.i = -1; }
      else if (C.t > 30) { this.endChat(true); return; }
    }
    if (C.phase === 'talk') {
      C.a.model.face(C.b.x - C.a.x, C.b.z - C.a.z);
      C.b.model.face(C.a.x - C.b.x, C.a.z - C.b.z);
      const L = C.lines[C.i];
      const dur = L ? 1.6 + t(L.key, rv(L.vars)).length * 0.05 : 0;
      if (C.i < 0 || C.t > dur) {
        C.i++;
        C.t = 0;
        if (C.i >= C.lines.length) { this.endChat(false); return; }
        const L2 = C.lines[C.i];
        const text = t(L2.key, rv(L2.vars));
        if (this.near(C)) {
          C.heard++;
          C.texts.push(text);
          if (host.mode === 'walk') speak(text, { speaker: `isl.${L2.who}` });
        }
        const n = L2.who === C.a.id ? C.a : C.b;
        n.hop = Math.max(n.hop, 0.25);
      }
    }
    this.placeBubble();
  }

  near(C) {
    const P = this.host.player;
    return !!P && Math.hypot(P.x - (C.a.x + C.b.x) / 2, P.z - (C.a.z + C.b.z) / 2) < HEAR_R;
  }

  placeBubble() {
    const C = this.chat, host = this.host;
    const L = C.phase === 'talk' ? C.lines[C.i] : null;
    if (!L || host.mode !== 'walk' || !C.a.model.group.visible) { this.bubble.style.display = 'none'; return; }
    const n = L.who === C.a.id ? C.a : C.b;
    const near = this.near(C);
    const html = near ? t(L.key, rv(L.vars)) : '💬';
    if (this.bubble.textContent !== html) this.bubble.textContent = html;
    this.bubble.classList.toggle('far', !near);
    const h = (n.model.group.scale.y || 1) * (n.id === 'grumbleton' ? 1.8 : 1.55);
    host.game.ui.place(this.bubble, new THREE.Vector3(n.x, n.y + h + 1.0, n.z), host.camera);
  }

  // ---------- props: the project site, the pumpkin, the chalk board ----------

  refreshProps() {
    const V = this.V, host = this.host;
    // built projects stay; the one being built shows its stage
    for (const id of PROJ_ORDER) {
      const want = V.built.includes(id) ? 3 : V.proj?.id === id ? V.proj.stage : -1;
      let g = this.props.get(id);
      if (want < 0) { if (g) g.visible = false; continue; }
      if (!g) {
        g = makeProject(id);
        const Q = PROJECTS[id];
        g.position.set(Q.x, heightAt(Q.x, Q.z), Q.z);
        host.scene.add(g);
        this.props.set(id, g);
      }
      g.visible = true;
      g.userData.stages.forEach((s, k) => { s.visible = k <= want; });
      g.userData.pile.visible = want < 3;
      if (want >= 1 && !g.userData.obs) { g.userData.obs = host.map.circObs(PROJECTS[id].x, PROJECTS[id].z, id === 'garden' ? 1.2 : 1.6); }
    }
    // drama props
    const D = V.drama;
    const pumpkin = D?.id === 'pumpkin' && !(D.res && dayIndex() > D.climax);
    let pk = this.props.get('pumpkin');
    if (pumpkin && !pk) { pk = makePumpkin(); const a = DRAMAS.pumpkin.at; pk.position.set(a.x, heightAt(a.x, a.z), a.z); host.scene.add(pk); this.props.set('pumpkin', pk); }
    if (pk) {
      pk.visible = pumpkin;
      if (pumpkin) { const s = 0.5 + Math.min(4, dayIndex() - D.start) * 0.18 + D.water.length * 0.12; pk.userData.body.scale.setScalar(s); pk.userData.ribbon.visible = !!D.res; }
    }
    const board = D?.id === 'rivalry';
    let bd = this.props.get('board');
    if (board && !bd) { bd = makeChalkBoard(); const a = DRAMAS.rivalry.at; bd.position.set(a.x - 1.8, heightAt(a.x - 1.8, a.z - 0.4), a.z - 0.4); host.scene.add(bd); this.props.set('board', bd); }
    if (bd) bd.visible = board;
    for (const H of Object.values(SOCIAL)) H.props?.(this, V); // the social happenings' things (social.js); what the island remembers stays
  }

  // ---------- every frame / second ----------

  /** Tasks for the drama going on (a social happening's clues or things to bring: social.js). */
  tasks() { return socialTasks(this.S.village?.drama); }

  tick(at) {
    this.tickChats(at);
    const D = this.S.village?.drama;
    if (D && !D.res) SOCIAL[D.id]?.tick?.(D, this);
    // the builder's hammering on site (soft, only when you are close)
    this.refreshProps();
  }

  update(dt) {
    this.t += dt;
    this.updateChat(dt);
    this.updateClimax();
    const V = this.S.village, P = this.host.player;
    const mill = this.props.get('windmill');
    if (mill?.visible && mill.userData.sails) mill.userData.sails.rotation.z += dt * 0.6;
    if (V?.proj && P) {
      const Q = PROJECTS[V.proj.id], n = this.host.npc(Q.who);
      if (n && n.spotName === 'v:proj' && !n.route.length && !n.talking && Math.hypot(n.x - Q.x - 2.2, n.z - Q.z - 1.4) < 0.5) {
        n.model.face(Q.x - n.x, Q.z - n.z);
        if ((this.hammer = (this.hammer || 0) - dt) <= 0) {
          this.hammer = 0.7 + Math.random() * 0.5;
          n.hop = Math.max(n.hop, 0.2);
          if (Math.hypot(P.x - n.x, P.z - n.z) < 9) this.host.game.audio.play('land');
        }
      }
    }
  }

  dispose() {
    this.bubble?.remove();
  }
}

// ---------- models ----------

function makeProject(id) {
  const g = new THREE.Group();
  const stages = [new THREE.Group(), new THREE.Group(), new THREE.Group(), new THREE.Group()];
  const pile = new THREE.Group();
  for (let i = 0; i < 4; i++) pile.add(mesh(box(1.6, 0.12, 0.25), 0xc68a52, 2.0, 0.08 + i * 0.12, -1.2 + (i % 2) * 0.1));
  pile.add(mesh(box(0.08, 0.9, 0.08), 0x8a5a32, 2.9, 0.45, -0.4), mesh(box(0.6, 0.4, 0.05), 0xfff0d0, 2.9, 0.85, -0.37));
  g.add(pile);
  if (id !== 'garden') stages[0].add(mesh(box(0.06, 0.02, 0.6), 0xffffff, -1.5, 0.02, 1.3, false), mesh(box(0.6, 0.02, 0.06), 0xffffff, -1.2, 0.02, 1.6, false)); // a chalk corner on the grass
  if (id === 'gazebo' || id === 'bandstand') {
    const col = id === 'gazebo' ? 0xf3ead2 : 0xffffff;
    stages[1].add(mesh(cyl(1.6, 1.6, 0.2, 8), id === 'gazebo' ? 0xc68a52 : 0xd8c8b0, 0, 0.1, 0));
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; stages[id === 'gazebo' ? 1 : 2].add(mesh(cyl(0.07, 0.07, 1.9, 6), col, Math.cos(a) * 1.4, 1.15, Math.sin(a) * 1.4)); }
    if (id === 'gazebo') for (let i = 0; i < 5; i++) { const a = (i / 6) * Math.PI * 2 + Math.PI / 6; const m = mesh(box(1.35, 0.08, 0.06), col, Math.cos(a) * 1.25, 0.6, Math.sin(a) * 1.25); m.rotation.y = -a + Math.PI / 2; stages[2].add(m); }
    else stages[1].add(mesh(cyl(1.7, 1.7, 0.12, 16), 0xb0a090, 0, 0.26, 0));
    const roof = mesh(id === 'gazebo' ? cone(1.9, 1.0, 8) : cone(1.9, 0.9, 16), id === 'gazebo' ? 0x5a8a3a : 0xff7eb6, 0, 2.55, 0);
    stages[3].add(roof);
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; stages[3].add(mesh(sph(0.1, 6, 4), [0xff5d73, 0xffc93c, 0x3ddc97][i % 3], Math.cos(a) * 1.5, 2.05, Math.sin(a) * 1.5, false)); }
  } else if (id === 'garden') {
    stages[0].add(mesh(box(2.6, 0.06, 2.0), 0x7a4a2e, 0, 0.03, 0));
    for (const [x, z, w, d] of [[0, -1.1, 2.9, 0.06], [0, 1.1, 2.9, 0.06], [-1.45, 0, 0.06, 2.2], [1.45, 0.6, 0.06, 1.0]]) stages[1].add(mesh(box(w, 0.45, d), 0xffffff, x, 0.25, z));
    for (let i = 0; i < 10; i++) { const x = -1.0 + (i % 5) * 0.5, z = -0.5 + Math.floor(i / 5) * 0.9; stages[2].add(mesh(cyl(0.02, 0.02, 0.3, 4), 0x5aa02c, x, 0.18, z, false), mesh(sph(0.07, 6, 4), 0x7ac943, x, 0.34, z, false)); }
    for (let i = 0; i < 10; i++) { const x = -1.0 + (i % 5) * 0.5, z = -0.5 + Math.floor(i / 5) * 0.9; stages[3].add(mesh(sph(0.14, 8, 6), [0xff7eb6, 0xffd23f, 0xc9a8ff, 0xff9f40][i % 4], x, 0.42, z, false)); }
    stages[3].add(mesh(box(1.0, 0.1, 0.35), 0xc68a52, 2.0, 0.45, 1.6), mesh(box(0.08, 1.4, 0.08), 0x8a5a32, -2.0, 0.7, -1.6), mesh(box(0.35, 0.35, 0.35), 0xff9f40, -2.0, 1.5, -1.6));
  } else if (id === 'birdhide') {
    for (const [x, z] of [[-0.7, -0.6], [0.7, -0.6], [-0.7, 0.6], [0.7, 0.6]]) stages[1].add(mesh(box(0.12, 1.0, 0.12), 0x8a5a32, x, 0.5, z));
    stages[2].add(mesh(box(1.7, 0.1, 1.5), 0xc68a52, 0, 1.05, 0), mesh(box(1.7, 0.9, 0.08), 0x7a8a4a, 0, 1.55, -0.72), mesh(box(0.08, 0.9, 1.5), 0x7a8a4a, -0.82, 1.55, 0), mesh(box(0.08, 0.9, 1.5), 0x7a8a4a, 0.82, 1.55, 0), mesh(box(1.7, 0.45, 0.08), 0x7a8a4a, 0, 1.33, 0.72));
    const roof = mesh(box(2.0, 0.08, 1.8), 0x5a7a2a, 0, 2.1, 0);
    roof.rotation.x = -0.15;
    stages[3].add(roof, mesh(box(0.08, 0.6, 0.08), 0x8a5a32, 1.1, 1.3, 0.8), mesh(box(0.3, 0.3, 0.3), 0xffd23f, 1.1, 1.75, 0.8));
    for (let i = 0; i < 4; i++) stages[3].add(mesh(box(0.1, 0.1 + i * 0.03, 0.4), 0xc68a52, -1.0 + i * 0.12, 0.05 + i * 0.25, 1.1)); // a little ladder
  } else if (id === 'windmill') {
    stages[1].add(mesh(cyl(0.95, 1.05, 0.6, 12), 0xc9c3d6, 0, 0.3, 0));
    stages[2].add(mesh(cyl(0.7, 0.95, 2.4, 12), 0xf3ead2, 0, 1.8, 0), mesh(box(0.5, 0.8, 0.06), 0x8a5a32, 0, 0.75, 0.93));
    const cap = mesh(cone(0.85, 0.9, 12), 0xd9583a, 0, 3.45, 0);
    const sails = new THREE.Group();
    sails.position.set(0, 3.0, 0.82);
    for (let i = 0; i < 4; i++) { const arm = new THREE.Group(); arm.rotation.z = (i / 4) * Math.PI * 2; arm.add(mesh(box(0.08, 1.6, 0.04), 0x8a5a32, 0, 0.8, 0, false), mesh(box(0.42, 1.2, 0.02), 0xfff6e0, 0.24, 0.95, 0, false)); sails.add(arm); }
    stages[3].add(cap, sails);
    g.userData.sails = sails;
  } else if (id === 'course') {
    const beam = mesh(box(2.4, 0.12, 0.25), 0xc68a52, 0, 0.45, -0.9);
    stages[1].add(beam, mesh(box(0.12, 0.4, 0.12), 0x8a5a32, -1.0, 0.2, -0.9), mesh(box(0.12, 0.4, 0.12), 0x8a5a32, 1.0, 0.2, -0.9));
    for (const x of [-0.9, 0, 0.9]) stages[2].add(mesh(box(0.08, 0.5, 0.08), 0xffffff, x - 0.3, 0.25, 0.2), mesh(box(0.08, 0.5, 0.08), 0xffffff, x + 0.3, 0.25, 0.2), mesh(box(0.7, 0.08, 0.06), 0xff5d73, x, 0.48, 0.2));
    for (const x of [-0.7, 0, 0.7]) { const tire = mesh(cyl(0.3, 0.3, 0.16, 12), 0x2b2340, x, 0.08, 1.1); stages[3].add(tire); }
    stages[3].add(mesh(box(0.05, 1.4, 0.05), 0x5a5a6a, 1.5, 0.7, 1.1), mesh(box(0.4, 0.26, 0.03), 0xe07a10, 1.7, 1.25, 1.1), mesh(box(2.6, 0.02, 0.1), 0xffffff, 0, 0.02, 1.6, false));
  } else if (id === 'boatshed') {
    for (const [x, z] of [[-1.1, -0.8], [1.1, -0.8], [-1.1, 0.8], [1.1, 0.8]]) stages[1].add(mesh(box(0.14, 1.8, 0.14), 0x8a5a32, x, 0.9, z));
    stages[2].add(mesh(box(2.3, 1.5, 0.08), 0x6b9ac4, 0, 0.9, -0.85), mesh(box(0.08, 1.5, 1.7), 0x6b9ac4, -1.15, 0.9, 0), mesh(box(0.08, 1.5, 1.7), 0x6b9ac4, 1.15, 0.9, 0));
    const r1 = mesh(box(2.5, 0.08, 1.1), 0xd9583a, 0, 2.05, -0.45), r2 = mesh(box(2.5, 0.08, 1.1), 0xd9583a, 0, 2.05, 0.45);
    r1.rotation.x = 0.45; r2.rotation.x = -0.45;
    const boat = mesh(box(1.6, 0.3, 0.6), 0xffffff, 0, 0.2, 0.4);
    stages[3].add(r1, r2, boat, mesh(box(0.05, 0.05, 1.2), 0xc68a52, 0.9, 0.5, 1.1, false));
  } else {
    for (const [x, z] of [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]]) stages[1].add(mesh(box(0.14, 2.4, 0.14), 0x9a94b2, x, 1.2, z));
    stages[2].add(mesh(box(2.0, 0.14, 2.0), 0xc68a52, 0, 2.45, 0));
    for (const [x, z, w, d] of [[0, -1, 2, 0.05], [0, 1, 2, 0.05], [-1, 0, 0.05, 2], [1, 0, 0.05, 2]]) stages[2].add(mesh(box(w, 0.4, d), 0xffffff, x, 2.7, z));
    stages[3].add(mesh(cone(1.5, 0.9, 4), 0x4a3fc0, 0, 3.75, 0), mesh(box(0.04, 0.9, 0.04), 0x2b2340, 0, 4.4, 0), mesh(box(0.45, 0.28, 0.03), 0xffd23f, 0.24, 4.7, 0));
    const scope = mesh(cyl(0.08, 0.12, 0.8, 8), 0xdfe6f0, 0.5, 3.0, 0.3);
    scope.rotation.z = 1.0;
    stages[3].add(scope);
  }
  for (const s of stages) g.add(s);
  g.userData.stages = stages;
  g.userData.pile = pile;
  return g;
}

function makePumpkin() {
  const g = new THREE.Group();
  const body = new THREE.Group();
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; const s = mesh(sph(0.42, 10, 8), 0xff8c1a, Math.cos(a) * 0.18, 0.4, Math.sin(a) * 0.18); s.scale.set(0.75, 0.9, 0.75); body.add(s); }
  body.add(mesh(cyl(0.05, 0.07, 0.25, 6), 0x5a7a2a, 0, 0.85, 0));
  g.add(body);
  g.add(mesh(box(0.06, 0.6, 0.06), 0x8a5a32, 0.9, 0.3, 0.4), mesh(box(0.5, 0.3, 0.04), 0xfff0d0, 0.9, 0.6, 0.42));
  const ribbon = mesh(cyl(0.18, 0.18, 0.04, 12), 0xffd23f, 0.9, 0.62, 0.46);
  ribbon.rotation.x = Math.PI / 2;
  g.add(ribbon);
  g.userData.body = body;
  g.userData.ribbon = ribbon;
  return g;
}

function makeChalkBoard() {
  const g = new THREE.Group();
  g.add(mesh(box(0.08, 1.3, 0.08), 0x8a5a32, -0.55, 0.65, 0), mesh(box(0.08, 1.3, 0.08), 0x8a5a32, 0.55, 0.65, 0), mesh(box(1.3, 0.8, 0.06), 0x2e3b2e, 0, 1.05, 0.02));
  g.add(mesh(box(0.5, 0.05, 0.01), 0xffffff, -0.3, 1.2, 0.06, false), mesh(box(0.5, 0.05, 0.01), 0xffffff, 0.3, 1.2, 0.06, false));
  return g;
}
