import { t, tFor } from '../../core/i18n.js';
import { esc } from '../../core/ui.js';
import { say as speak } from '../../core/voice.js';
import { NPCS, NPC_IDS, npcState, heartsOf, scheduleNow, makeNpcModel, MAX_HEARTS } from './npcs.js';
import { BIRTHDAYS } from './calendar.js';
import { ITEMS, icon } from './items.js';
import { heartsHtml } from './hud.js';
import { thumb } from './thumbs.js';
import { now } from './save.js';

// The Friends book (milestone C): the hearts moved off the name tags into a little book. One page per
// villager (picture, hearts, birthday, the gifts they love / like / dislike as you learn them, where they
// are right now and what comes next with them), and a last page for the farm animals. F opens it, or the
// start menu ([C]) on a gamepad; the stick (or the arrow keys) flips pages; any button closes. Each page is
// read aloud.
//
// Gift tastes are learned (save.friends.known[id][item] = 'love' | 'like' | 'dislike'): by giving that gift,
// or because the villager mentions a favorite while chatting (one per heart, see tellLine()).

const CSS = `
.isl-fb { display: grid; grid-template-columns: clamp(110px, 15vw, 190px) 1fr; gap: 6px 18px; align-items: start; }
.isl-fb .pic { grid-row: span 2; background: radial-gradient(circle at 50% 40%, #fff 0, #ffe9c2 70%); border-radius: 18px; padding: 6px; box-shadow: inset 0 0 0 3px rgba(138,90,50,.25); }
.isl-fb .pic img { width: 100%; display: block; aspect-ratio: 1; }
.isl-fb .pic .q { aspect-ratio: 1; display: flex; align-items: center; justify-content: center; font-size: clamp(40px, 6vw, 80px); color: #c9b08a; }
.isl-fb .nm { font-size: clamp(20px, 2.3vw, 34px); font-weight: 700; color: #8a5a32; display: flex; flex-wrap: wrap; gap: 4px 12px; align-items: center; }
.isl-fb .hs { display: inline-flex; gap: 2px; }
.isl-fb .hs svg { width: clamp(16px, 1.6vw, 24px); height: clamp(16px, 1.6vw, 24px); }
.isl-fb dl { margin: 0; display: grid; grid-template-columns: auto 1fr; gap: 4px 12px; font-size: clamp(13px, 1.3vw, 19px); }
.isl-fb dt { font-weight: 700; opacity: .7; white-space: nowrap; }
.isl-fb dd { margin: 0; }
.isl-fb .gifts { display: flex; flex-wrap: wrap; gap: 4px 8px; }
.isl-fb .gift { display: inline-flex; align-items: center; gap: 3px; background: #fff; border-radius: 999px; padding: 1px 8px 1px 2px; box-shadow: 0 2px 0 rgba(43,35,64,.12); }
.isl-fb .gift svg, .isl-fb .gift img { width: 1.5em; height: 1.5em; }
.isl-fb .unk { opacity: .55; font-style: italic; }
.isl-fbdots { display: flex; justify-content: center; gap: 6px; margin-top: 10px; }
.isl-fbdots span { width: 10px; height: 10px; border-radius: 50%; background: rgba(138,90,50,.25); }
.isl-fbdots span.on { background: #8a5a32; }
.isl-fbanimals { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(230px, 40vw), 1fr)); gap: 8px; font-size: clamp(13px, 1.3vw, 19px); }
.isl-fbanimals div { background: rgba(138,90,50,.08); border-radius: 12px; padding: 6px 10px; display: flex; justify-content: space-between; align-items: center; gap: 6px; }
.isl-fbanimals .hs svg { width: 1.1em; height: 1.1em; }
`;
function injectStyle() {
  if (document.getElementById('isl-fb-style')) return;
  const el = document.createElement('style');
  el.id = 'isl-fb-style';
  el.textContent = CSS;
  document.head.appendChild(el);
}

// where a schedule spot is, in words (isl.where.*)
const AREA = {
  hazelGarden: 'garden', hazelPorch: 'garden', farmFence: 'farm', plazaBench: 'square', plazaFountain: 'square', plazaEast: 'square',
  storeCounter: 'store', lhDoor: 'lighthouse', beach: 'beach', beachDay: 'beach', shelbyVisit: 'beach', pier: 'pier', pierEnd: 'pier',
  cafe: 'cafe', pad: 'pad', rocket: 'pad', hallFront: 'hall', hillTop: 'hill', meadow: 'meadow', museumDoor: 'museum',
  shelbyHut: 'isle', tidepools: 'isle', isleBeach: 'isle',
};
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

export class FriendsBook {
  constructor(host) {
    this.host = host;
    this.page = 0;
    injectStyle();
    const S = host.save;
    if (!S.friends) S.friends = { known: {}, told: {} };
  }

  get S() { return this.host.save; }
  get known() { return this.S.friends.known; }

  /** Villager pages first, then the animals (once the barn has some). */
  pages() {
    const out = NPC_IDS.slice();
    if (this.S.ranch?.animals?.length) out.push('animals');
    return out;
  }

  /** Remember what a villager thinks of a gift. True if it is new to the book. */
  learn(id, item, taste) {
    if (taste === 'neutral' || !NPCS[id]) return false;
    const k = (this.known[id] ||= {});
    if (k[item] === taste) return false;
    k[item] = taste;
    this.host.markDirty();
    return true;
  }

  /** A line where a villager mentions a favorite gift (one per heart), or null. Learned when said. */
  tellLine(n) {
    const id = n.id, def = NPCS[id], st = npcState(this.S, id);
    const told = this.S.friends.told;
    const k = this.known[id] || {};
    if ((told[id] || 0) >= heartsOf(st)) return null;
    const love = def.loves.find((it) => !k[it]);
    const like = !love && def.likes.find((it) => !k[it]);
    const item = love || like;
    if (!item) return null;
    return { who: id, key: love ? 'isl.fb.tellLove' : 'isl.fb.tellLike', vars: { item: t(`isl.i.${item}`) }, fx: () => {
      told[id] = (told[id] || 0) + 1;
      if (this.learn(id, item, love ? 'love' : 'like')) this.host.game.ui.toast(t('isl.fb.learned', { name: t(`isl.npc.${id}`) }), 1800);
    } };
  }

  // ---------- the panel ----------

  open(page = null) {
    const host = this.host;
    host.mode = 'friends';
    this.t = 0;
    const list = this.pages();
    if (page !== null) this.page = page;
    this.page = Math.min(this.page, list.length - 1);
    this.render(true);
    host.game.audio.play('select');
  }

  close() {
    this.host.hud.setPanel(null);
    this.host.mode = 'walk';
  }

  update(inp, dt) {
    this.t += dt;
    const list = this.pages();
    const keys = this.host.game.input.pressed;
    const step = inp.stepX || -inp.stepY || (keys.has('ArrowRight') || keys.has('ArrowDown') ? 1 : keys.has('ArrowLeft') || keys.has('ArrowUp') ? -1 : 0);
    if (step) {
      this.page = (this.page + step + list.length) % list.length;
      this.host.game.audio.play('select');
      this.render(true);
    }
    if (this.t > 0.25 && (inp.aPressed || inp.bPressed || inp.cPressed || keys.has('KeyF') || keys.has('Tab'))) this.close();
  }

  /** Where a villager is right now, in words. */
  whereNow(n) {
    if (n.inside) return t(n.sleep ? 'isl.fb.asleepHome' : 'isl.fb.atHome');
    if (n.away) return t('isl.fb.where.cafeGuest');
    if (n.sleep) return t('isl.fb.goingHome');
    const s = scheduleNow(n.id, now(), this.S);
    if (s.inside) return t('isl.fb.goingHome');
    const a = AREA[s.name];
    return a ? t(`isl.fb.where.${a}`) : t('isl.fb.where.about');
  }

  /** What comes next with this friend: a quest, a story step, a heart event or a new request. */
  nextUp(id) {
    const host = this.host, S = this.S, def = NPCS[id], st = npcState(S, id), h = heartsOf(st);
    const q = S.quests[id];
    if (q) return `${t('isl.fb.quest')} ${host.questText(id, q.n)}`;
    if (host.story?.hasNews(id)) return t('isl.fb.story');
    const ev = def.events[st.ev];
    if (ev) return h >= ev.at ? t('isl.fb.eventNow') : t('isl.fb.event', { n: ev.at });
    const nq = def.quests[st.q];
    if (nq) return h >= (nq.minHearts || 0) ? t('isl.fb.askNow') : t('isl.fb.ask', { n: nq.minHearts || 0 });
    return h >= MAX_HEARTS ? t('isl.fb.best') : t('isl.fb.nothing');
  }

  picture(id) {
    return thumb(this.host.game.renderer, `npc:${id}`, () => makeNpcModel(id).group, { ry: -0.35 });
  }

  giftList(id, taste) {
    const k = this.known[id] || {};
    const all = { love: NPCS[id].loves, like: NPCS[id].likes, dislike: NPCS[id].dislikes }[taste];
    const got = all.filter((it) => k[it] === taste);
    const items = got.map((it) => `<span class="gift">${ITEMS[it] ? icon(it) : ''}${esc(t(`isl.i.${it}`))}</span>`).join('');
    const rest = all.length - got.length;
    return `<div class="gifts">${items}${rest ? `<span class="unk">${esc(t(got.length ? 'isl.fb.more' : 'isl.fb.unknown', { n: rest }))}</span>` : ''}</div>`;
  }

  render(read = false) {
    const host = this.host, list = this.pages(), id = list[this.page];
    const dots = `<div class="isl-fbdots">${list.map((_, i) => `<span class="${i === this.page ? 'on' : ''}"></span>`).join('')}</div>`;
    const foot = `<div class="isl-foot">${esc(tFor(host.player?.p, 'isl.fb.hint'))}</div>`;
    if (id === 'animals') {
      const rows = this.S.ranch.animals.map((a) => `<div><b>${esc(a.name)}</b> <small>${esc(t(`isl.fb.kind.${a.kind}`))}${a.baby !== undefined && a.baby !== null ? ' 🍼' : ''}</small>
        ${heartsHtml(a.hearts || 0, 5)}</div>`).join('');
      host.hud.setPanel(`<h2>${esc(t('isl.fb.title'))}</h2><div class="nm" style="text-align:center;font-weight:700;color:#8a5a32;margin-bottom:6px">${esc(t('isl.fb.animals'))}</div>
        <div class="isl-fbanimals">${rows}</div><div class="isl-foot" style="opacity:1">${esc(t('isl.fb.animalsTip'))}</div>${dots}${foot}`);
      if (read) speak(`${t('isl.fb.animals')}. ${this.S.ranch.animals.map((a) => t('isl.fb.animalSay', { name: a.name, n: a.hearts || 0 })).join(' ')}`);
      return;
    }
    const n = host.npc(id), st = npcState(this.S, id), def = NPCS[id];
    const name = t(`isl.npc.${id}`);
    const met = st.met || st.pts > 0;
    const b = BIRTHDAYS[id];
    const bday = b ? t('isl.fb.bday', { d: b[1], m: t(`isl.fb.m.${MONTHS[b[0] - 1]}`) }) : t('isl.fb.noBday');
    const h = heartsOf(st);
    const pic = met ? `<img src="${this.picture(id)}" alt="">` : '<div class="q">?</div>';
    const rows = met ? [
      [t('isl.fb.bdayLabel'), esc(bday)],
      [t('isl.fb.loves'), this.giftList(id, 'love')],
      [t('isl.fb.likes'), this.giftList(id, 'like')],
      [t('isl.fb.dislikes'), this.giftList(id, 'dislike')],
      [t('isl.fb.now'), esc(n ? this.whereNow(n) : '')],
      [t('isl.fb.next'), esc(this.nextUp(id))],
    ] : [[t('isl.fb.now'), esc(t('isl.fb.notMet'))]];
    host.hud.setPanel(`<h2>${esc(t('isl.fb.title'))}</h2>
      <div class="isl-fb"><div class="pic">${pic}</div>
        <div class="nm">${esc(met ? name : '???')}${met && id !== 'mumble' ? heartsHtml(h) : ''}${met && id === 'mumble' ? `<small style="font-size:.55em;opacity:.7">${esc(t('isl.fb.mumble'))}</small>` : ''}</div>
        <dl>${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join('')}</dl></div>${dots}${foot}`);
    if (!read) return;
    if (!met) { speak(t('isl.fb.notMet')); return; }
    const k = this.known[id] || {};
    const loves = def.loves.filter((it) => k[it] === 'love').map((it) => t(`isl.i.${it}`));
    speak([t('isl.fb.say', { name, n: h }), bday, loves.length ? t('isl.fb.sayLoves', { list: loves.join(t('isl.or')) }) : '', n ? this.whereNow(n) : '', this.nextUp(id)].filter(Boolean).join('. '), def.voice);
  }
}
