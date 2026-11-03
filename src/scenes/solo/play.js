import * as THREE from 'three';
import { t } from '../../core/i18n.js';
import { esc } from '../../core/ui.js';
import { say as speak } from '../../core/voice.js';
import { now, hourOf } from './save.js';
import { dayKey, dayRand, rainyOn } from './calendar.js';
import { heightAt } from './map.js';
import { makeLostThing } from './models9.js';
import { npcState, heartsOf } from './npcs.js';

// Villagers play with you (the owner's "More fun" list):
// - They wave when you jump near them (a hop and a 👋).
// - Tag with Pip (she asks when you talk to her; in winter she asks for a snowball fight instead, games.js),
//   and hide-and-seek with Mumble (games.js).
// - Stand still at a view spot (the lookout, the bench on kite hill, the bench by the lighthouse, the end of
//   the pier, the islet) at sunset or on a clear night: a friend comes over to watch the sunset or the stars
//   with you (once a day each).
// - Little fun tasks: each day one villager needs a hand (calendar.js dayRand), and the thing is always
//   somewhere you have to hop to: Hazel's hen on the Stump Hop, Mitten on the Barrel Run, Pip's model rocket
//   on the game hall roof, Grumbleton's hat on Gull Rock, Bram's glass float on the cliff path and Hoot's
//   book on the hollow tree's branch. Pick it up with [B], bring it back and talk to them.

export const TASKS = {
  hazel: { thing: 'hen', x: 48.2, z: -3.7 },
  rosa: { thing: 'cat', x: -7.3, z: 34.3 },
  pip: { thing: 'rocket', x: 24.0, z: -14.3 },
  grumbleton: { thing: 'hat', x: 17.8, z: 45.4 },
  bram: { thing: 'float', x: 17.9, z: -32.9 },
  hoot: { thing: 'book', x: -10.4, z: 24.9 },
};
const TASK_IDS = Object.keys(TASKS);
/** Who needs a hand on a date. */
export const taskOn = (ms = now()) => TASK_IDS[Math.floor(dayRand(`task:${dayKey(ms)}`) * TASK_IDS.length)];

const VIEWS = [{ x: 16.8, z: -36.9, id: 'lookout' }, { x: 4.8, z: -26.5, id: 'hill' }, { x: 48.2, z: 29.6, id: 'lighthouse' }, { x: 3.6, z: 57.6, id: 'pier' }, { x: -15.2, z: 52.4, id: 'islet' }];
const FRIENDS = ['hazel', 'rosa', 'bram', 'grumbleton', 'pip', 'mumble', 'hoot', 'shelby'];

export class Play {
  constructor(host) {
    this.host = host;
    this.emotes = new Map();
    this.thing = null;
    this.carry = null;
    this.tag = null;
    this.stillT = 0;
    this.t = 0;
    if (!document.getElementById('isl-play-style')) {
      const st = document.createElement('style');
      st.id = 'isl-play-style';
      st.textContent = '.label.isl-emote { font-size: clamp(26px, 2.6vw, 40px); line-height: 1; filter: drop-shadow(0 2px 0 rgba(43,35,64,.35)); }';
      document.head.appendChild(st);
    }
    this.el = document.createElement('div');
    this.el.className = 'isl-hop';
    this.el.style.display = 'none';
    host.hud.root.appendChild(this.el);
  }

  get S() { return this.host.save; }

  /** Today's play state in the save. */
  day() {
    const today = dayKey(), S = this.S;
    if (!S.play || S.play.day !== today) S.play = { day: today, task: 0, tag: 0, sun: false, stars: false };
    return S.play;
  }

  // ---------- waves ----------

  /** You jumped: villagers near you who are just standing around wave. */
  onJump() {
    const host = this.host, P = host.player;
    if (!P || host.mode !== 'walk') return;
    for (const n of host.npcs) {
      if (n.sleep || n.inside || n.away || n.busy || n.talking || n.moving || n.doorAnim || n.intro) continue;
      if (Math.hypot(n.x - P.x, n.z - P.z) > 7 || (n.waveAt && this.t - n.waveAt < 3)) continue;
      n.waveAt = this.t;
      n.hop = Math.max(n.hop, 0.5);
      n.model.face(P.x - n.x, P.z - n.z);
      this.emote(n, '👋', 1.4);
    }
  }

  /** A little picture over a villager's head for a moment. */
  emote(n, txt, s) {
    let e = this.emotes.get(n.id);
    if (!e) { e = { el: this.host.game.ui.label('label isl-emote'), t: 0 }; this.emotes.set(n.id, e); }
    e.el.textContent = txt;
    e.t = s;
  }

  // ---------- talking: tasks and invitations ----------

  /** Before the usual talk (island.talkTo): bring back a fetched thing. True: handled. */
  talk(n) {
    const host = this.host, D = this.day();
    if (n.id !== taskOn() || n.sleep) return false;
    if (D.task === 2 && this.carry) {
      D.task = 3;
      this.dropCarry();
      n.talking = true;
      host.say([{ who: n.id, key: `play.task.${n.id}.thanks` }], () => { n.talking = false; host.addPts(n.id, 8); host.grant({ coins: 30 }); host.markDirty(); });
      host.celebrate(n);
      return true;
    }
    return false;
  }

  /** Today's task, asked at the end of a chat (when there is no quest or story news to tell first). */
  askLine(n) {
    const D = this.day();
    if (n.id !== taskOn() || n.sleep || D.task !== 0 || !this.S.intro) return null;
    return { who: n.id, key: `play.task.${n.id}.ask`, fx: () => { if (D.task === 0) { D.task = 1; this.placeThing(); this.host.markDirty(); } } };
  }

  /** Something new to say (the "!" over their head): today's task, or the thing you are bringing back. */
  hasNews(id) {
    const D = this.S.play?.day === dayKey() ? this.S.play : null;
    if (id !== taskOn() || !this.S.intro) return false;
    return !D || D.task === 0 || (D.task === 2 && !!this.carry);
  }

  /** A play invitation in a chat (island.talkTo): tag with Pip, snowballs in winter, hide-and-seek with Mumble. */
  offer(n) {
    const host = this.host, games = host.games, D = this.day();
    // close friends play with you (four hearts and up), once a day each: an invitation at the end of a chat
    if (heartsOf(npcState(this.S, n.id)) < 4 || D.offered?.includes(n.id)) return null;
    const yes = (fn) => ({ choices: ['isl.yes', 'isl.no'], onChoice: (i) => { if (i === 0) fn(); else n.talking = false; } });
    let line = null;
    if (n.id === 'mumble' && games.canHide()) line = { who: 'mumble', key: 'play.hide.ask', ...yes(() => { n.talking = false; games.startHide(); }) };
    else if (n.id === 'pip' && games.canSnow()) line = { who: 'pip', key: 'play.snow.ask', ...yes(() => { n.talking = false; games.startSnow(); }) };
    else if (n.id === 'pip' && this.canTag() && D.tag < 2) line = { who: 'pip', key: 'play.tag.ask', ...yes(() => { n.talking = false; this.startTag(n); }) };
    if (line) D.offered = [...(D.offered || []), n.id];
    return line;
  }

  // ---------- the fun task ----------

  thingAt() {
    const T = TASKS[taskOn()];
    return { x: T.x, z: T.z, y: this.host.map.supportAt(T.x, T.z, 99, this.host.walkState).y };
  }

  placeThing() {
    const T = TASKS[taskOn()];
    if (this.thing) this.thing.removeFromParent();
    this.thing = makeLostThing(T.thing);
    const at = this.thingAt();
    this.thing.position.set(at.x, at.y, at.z);
    this.host.scene.add(this.thing);
  }

  pickThing() {
    const host = this.host, P = host.player, D = this.day();
    D.task = 2;
    this.carry = this.thing;
    this.thing = null;
    this.carry.userData.glint.visible = false;
    this.carry.position.set(0, 1.55, 0);
    this.carry.rotation.set(0, 0, 0);
    P.ch.group.add(this.carry);
    host.game.audio.play('star');
    const s = t(`play.task.${taskOn()}.got`);
    host.game.ui.toast(s, 2400);
    host.markDirty();
  }

  dropCarry() {
    if (this.carry) this.carry.removeFromParent();
    this.carry = null;
  }

  interactions(P, out, nm) {
    if (this.thing && this.thing.visible) {
      const at = this.thingAt();
      if (Math.hypot(P.x - at.x, P.z - at.z) < 1.3 && Math.abs(P.fy - at.y) < 0.9) { out.b = { text: nm(`play.h.${TASKS[taskOn()].thing}`), fn: () => this.pickThing() }; return true; }
    }
    return false;
  }

  // ---------- tag with Pip ----------

  canTag() {
    const n = this.host.npc('pip'), h = hourOf();
    return !!n && !n.sleep && !n.inside && !this.tag && !this.host.games.hide && !this.host.games.snow && h >= 8 && h < 19 && !this.host.hops.run && !this.host.isle2?.here();
  }

  startTag(n) {
    const host = this.host, P = host.player;
    n.busy = true; n.route = []; n.talking = false;
    this.tag = { n, phase: 'chase', t: 20, cx: n.x, cz: n.z, mine: 0, theirs: 0, pause: 0.8, high: false };
    this.day().tag++;
    host.game.audio.play('go');
    this.npcSay('pip', 'play.tag.go');
    // a step away from you to start
    const dx = n.x - P.x, dz = n.z - P.z, d = Math.hypot(dx, dz) || 1;
    if (d < 3) { n.x += (dx / d) * 2; n.z += (dz / d) * 2; }
  }

  updateTag(dt) {
    const g = this.tag, host = this.host, P = host.player, n = g.n, map = host.map, st = host.walkState;
    if (host.mode !== 'walk' || !P) { n.playMove = false; return; }
    g.t -= dt;
    g.pause -= dt;
    const dx = n.x - P.x, dz = n.z - P.z, d = Math.hypot(dx, dz) || 1;
    const onGround = P.fy < map.floorAt(P.x, P.z, st.bridge) + 0.4 && !P.air;
    let want = null, speed = 0;
    if (g.phase === 'chase') {
      // she runs away from you (a bit slower than you), staying near where the game started
      speed = 4.7;
      const away = Math.atan2(dz, dx);
      for (const off of [0, 0.5, -0.5, 1.0, -1.0, 1.6, -1.6, 2.4, -2.4]) {
        const a = away + off, x = n.x + Math.cos(a) * 0.6, z = n.z + Math.sin(a) * 0.6;
        if (Math.hypot(x - g.cx, z - g.cz) > 9 && Math.hypot(x - g.cx, z - g.cz) > Math.hypot(n.x - g.cx, n.z - g.cz)) continue;
        if (map.walkable(x, z, 0.45, st)) { want = a; break; }
      }
      if (d < 0.95 && g.pause <= 0) {
        g.mine++;
        g.phase = 'flee'; g.t = Math.max(g.t, 0) + 15; g.pause = 1.2;
        n.hop = 1;
        host.game.audio.play('star');
        this.npcSay('pip', 'play.tag.gotMe');
        this.emote(n, '😆', 1.2);
      }
    } else {
      // now she is it: she chases you; up on a stump or a crate she cannot reach you
      speed = 4.4;
      want = Math.atan2(-dz, -dx);
      const x = n.x + Math.cos(want) * 0.6, z = n.z + Math.sin(want) * 0.6;
      if (!map.walkable(x, z, 0.45, st)) want = null;
      if (!onGround && d < 2.2 && !g.high) { g.high = true; this.npcSay('pip', 'play.tag.high'); }
      if (d < 0.85 && onGround && g.pause <= 0) {
        g.theirs++;
        g.phase = 'chase'; g.pause = 1.2;
        P.ch.squash(0.7);
        host.game.audio.play('boing');
        this.npcSay('pip', 'play.tag.gotYou');
      }
    }
    // (after you tag her she waits a moment before she chases you; after she tags you she runs off at once)
    if (want != null && (g.pause <= 0 || g.phase === 'chase')) {
      n.x += Math.cos(want) * speed * dt;
      n.z += Math.sin(want) * speed * dt;
      n.model.face(Math.cos(want), Math.sin(want));
      n.playMove = true;
    } else n.playMove = false;
    if (g.t <= 0 && g.pause <= 0) this.endTag();
  }

  endTag() {
    const host = this.host, g = this.tag;
    g.n.busy = false; g.n.playMove = false; g.n.spotName = null;
    this.tag = null;
    this.npcSay('pip', g.mine ? 'play.tag.end' : 'play.tag.end0', { n: g.mine });
    host.addPts('pip', 4 + g.mine);
    host.grant({ coins: 10 + g.mine * 10 });
    host.markDirty();
  }

  // ---------- sunsets and stars ----------

  /** Standing still at a view spot at sunset or on a clear night: a friend comes over to watch with you. */
  updateView(dt) {
    const host = this.host, P = host.player;
    if (!P || host.mode !== 'walk' || P.moving > 0.1 || P.air || this.watch) { this.stillT = 0; return; }
    this.stillT += dt;
    if (this.stillT < 3) return;
    const v = VIEWS.find((s) => Math.hypot(P.x - s.x, P.z - s.z) < 2.6);
    if (!v) return;
    const h = host.forceHour ?? hourOf(), D = this.day();
    const kind = h >= 17.5 && h < 20.5 ? 'sun' : (h >= 20.5 || h < 4.5) && !rainyOn() && host.night > 0.5 ? 'stars' : null;
    if (!kind || D[kind]) return;
    let best = null, bd = 95;
    for (const n of host.npcs) {
      if (!FRIENDS.includes(n.id) || n.sleep || n.inside || n.wantIn || n.away || n.busy || n.talking || n.doorAnim || n.intro || Math.abs(n.z - P.z) > 80) continue;
      const d = Math.hypot(n.x - P.x, n.z - P.z);
      if (d < bd) { bd = d; best = n; }
    }
    if (!best) return;
    D[kind] = true;
    this.stillT = 0;
    const n = best;
    n.busy = true; n.route = [];
    host.puffs.burst(new THREE.Vector3(n.x, n.y + 0.6, n.z), 0xffffff, { count: 10, speed: 3, size: 0.35 });
    // beside you, looking out the same way
    const sx = P.x + (P.fx >= 0 ? -1.1 : 1.1), sz = P.z + 0.2;
    n.x = sx; n.z = sz;
    n.yOverride = P.fy;
    n.model.face(P.fx, P.fz);
    host.puffs.burst(new THREE.Vector3(n.x, P.fy + 0.6, n.z), 0xffffff, { count: 10, speed: 3, size: 0.35 });
    this.watch = { n, kind, t: 0 };
    this.emote(n, kind === 'sun' ? '🌅' : '✨', 3);
    host.say([{ who: n.id, key: `play.${kind}.${n.id}` }, { key: `play.${kind}.end`, vars: { name: t(`isl.npc.${n.id}`) } }], () => {
      host.addPts(n.id, 5);
      this.later(4, () => { n.busy = false; n.yOverride = null; n.spotName = null; this.watch = null; });
      host.markDirty();
    });
  }

  later(s, fn) { this.host.later(s, fn); }

  npcSay(id, key, vars = {}) {
    const s = t(key, vars);
    this.host.game.ui.toast(`${t(`isl.npc.${id}`)}: ${s}`, Math.max(2000, s.length * 55), { group: `play-${id}` });
    speak(s, `isl.${id}`);
  }

  // ---------- every frame ----------

  tick() {
    const D = this.day();
    // the task's thing waits where it is while the task is on (also after a reload)
    if (D.task === 1 && !this.thing) this.placeThing();
    if (D.task !== 1 && this.thing) { this.thing.removeFromParent(); this.thing = null; }
    if (D.task === 2 && !this.carry) { D.task = 1; this.placeThing(); } // (a reload: it went back where it was)
  }

  update(dt) {
    const host = this.host;
    this.t += dt;
    if (this.tag) this.updateTag(dt);
    this.updateView(dt);
    if (this.thing) { this.thing.rotation.y += dt; this.thing.userData.glint.scale.y = 0.6 + Math.sin(this.t * 5) * 0.4; }
    if (this.carry) this.carry.position.y = 1.55 + Math.abs(Math.sin(this.t * 6)) * 0.06;
    for (const [id, e] of this.emotes) {
      if (e.t <= 0) { e.el.style.display = 'none'; continue; }
      e.t -= dt;
      const n = host.npc(id);
      if (!n || !n.model.group.visible) { e.el.style.display = 'none'; continue; }
      const p = n.tagPos.clone().add(new THREE.Vector3(0, 1.0, 0));
      host.game.ui.place(e.el, p, host.camera);
    }
    const g = this.tag;
    const html = g ? `🏃 ${esc(t(g.phase === 'chase' ? 'play.tag.pillChase' : 'play.tag.pillFlee', { s: Math.max(0, Math.ceil(g.t)), n: g.mine, m: g.theirs }))}` : '';
    this.el.style.display = html ? '' : 'none';
    if (html && this.el.innerHTML !== html) this.el.innerHTML = html;
  }

  tasks() {
    const D = this.S.play?.day === dayKey() ? this.S.play : null;
    const id = taskOn();
    if (!D || !this.S.intro) return [];
    if (D.task === 1) return [t(`play.task.${id}.todo`)];
    if (D.task === 2) return [t('play.task.back', { name: t(`isl.npc.${id}`) })];
    return [];
  }

  dispose() {
    this.el.remove();
    for (const e of this.emotes.values()) e.el.remove();
  }
}
