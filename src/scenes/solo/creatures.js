import * as THREE from 'three';
import { t, tFor, addStrings } from '../../core/i18n.js';
import { esc } from '../../core/ui.js';
import { say as speak } from '../../core/voice.js';
import { timingScale } from '../../core/assist.js';
import { report } from '../../core/passport.js';
import { markA11y } from '../../core/outline.js';
import { now, hourOf } from './save.js';
import { dayKey, dayIndex, dayRand, surpriseOn, setSurpriseSwap } from './calendar.js';
import { heightAt } from './map.js';
import { ITEMS, addIcons } from './items.js';
import { Guest, arrived } from './odd.js';
import { makeCloudWhale, makeTeaStall, makeMossCreature, makeMushroomCart, makeGuestHat } from './models11.js';

// Strange creatures (the odd-adventure round, part 3): rare sightings, never crowds, spread over the map, each one a
// small special moment. They come slowly (each is an arrival of odd.js: a letter or a rumour, on a quiet day).
//   - OLD MOREL, the wandering mushroom merchant (a walking mushroom with a little cart): once he has come, some of
//     Marlo's days are his instead (calendar.setSurpriseSwap: the day keeps exactly ONE surprise, so he never adds a
//     special day). By the fairy ring, 9 to 18: odd seeds and odd things.
//   - The CLOUD WHALE: once it has been seen, some meteor-shower nights are its instead (the same swap): at dusk (18 to
//     20:30) it drifts slowly over the island, singing softly. Stand still a moment to watch it (the view looks up), and
//     take a photo of it with Pip's camera.
//   - The TINY ELEPHANTS' tea stall (south of the pond): a place to visit, 10 to 20. Order a tea and say when: press
//     [B] when the cup is full to the line (forgiving timing widens the line; nothing to fail: a cup a day either way).
//   - The SHY MOSS CREATURE (in the grass by the river, south of the farm): only seen in Sneaky mode. Walk up normally
//     and it hides for the day; tiptoe up and say hello softly. Five visits (one a day) and it is your friend.
// The whale and the merchant never come on the same day (each takes a different surprise; one surprise a day).
// Save: S.odd.cre = { tea: { day, cups, perfect }, moss: { visits: [days], friend, hid }, whale: { seen, photo, watched },
// shroom: { day, bought } }.

export const MOREL = { x: 16.0, z: 18.6, cart: { x: 17.6, z: 19.4 } };
export const TEA = { x: 22.0, z: 30.6, stand: { x: 22.0, z: 32.2 } };
export const MOSS = { x: -19.5, z: 20.0 };
export const WHALE_HOURS = [18, 20.5];
export const TEA_UNTIL = 20; // the tea stall is open 10 to 20 (the owner's decision after the play-test)
export const SHROOM_SHARE = 0.45, WHALE_SHARE = 0.5;
const WARES = [['starfruitSeed', 60], ['mysterySeed', 20], ['puffball', 15], ['sporeLamp', 80]];
const TEAS = ['mint', 'berry', 'honey'];
const MOSS_FRIEND = 5;

ITEMS.puffball = { kind: 'forage', sell: 10 };
for (const k of TEAS) ITEMS[`tea_${k}`] = { kind: 'gift', sell: 12 };
addIcons({
  puffball: '<ellipse cx="12" cy="14" rx="8" ry="6.5" fill="#f3ead2" stroke="#2b2340" stroke-width="1.2"/><circle cx="9" cy="12" r="1.2" fill="#d8c8a0"/><circle cx="14" cy="15" r="1" fill="#d8c8a0"/>',
  tea_mint: '<path d="M5 10 H17 V16 Q17 21 11 21 Q5 21 5 16Z" fill="#ffffff" stroke="#2b2340" stroke-width="1.2"/><path d="M17 12 Q21 12 20 15 Q19 17 17 16" fill="none" stroke="#2b2340" stroke-width="1.2"/><ellipse cx="11" cy="10.5" rx="5.5" ry="1.4" fill="#7ad04a"/>',
  tea_berry: '<path d="M5 10 H17 V16 Q17 21 11 21 Q5 21 5 16Z" fill="#ffffff" stroke="#2b2340" stroke-width="1.2"/><path d="M17 12 Q21 12 20 15 Q19 17 17 16" fill="none" stroke="#2b2340" stroke-width="1.2"/><ellipse cx="11" cy="10.5" rx="5.5" ry="1.4" fill="#c2185b"/>',
  tea_honey: '<path d="M5 10 H17 V16 Q17 21 11 21 Q5 21 5 16Z" fill="#ffffff" stroke="#2b2340" stroke-width="1.2"/><path d="M17 12 Q21 12 20 15 Q19 17 17 16" fill="none" stroke="#2b2340" stroke-width="1.2"/><ellipse cx="11" cy="10.5" rx="5.5" ry="1.4" fill="#ffc93c"/>',
});

addStrings({
  en: {
    'od.npc.shroom': 'Old Morel', 'isl.i.puffball': 'puffball', 'isl.i.tea_mint': 'cup of mint tea', 'isl.i.tea_berry': 'cup of berry tea', 'isl.i.tea_honey': 'cup of honey tea',
    'isl.mail.od.tea': 'Hello {name}! Have you heard? Three TINY elephants opened a tea stall south of the pond. They are very polite. Go and have a cup! Rosa',
    'isl.mail.od.moss': 'psst... {name}... in the grass by the river, south of the farm, lives a moss creature. Very shy. Only tiptoe! Then maybe it says hello. Mumble',
    'isl.mail.od.mushroom': 'Greetings, little one. I am Old Morel. I wander from island to island with spores and sprouts. Some days, when the wind smells of rain, I may stop by your fairy ring. Morel',
    'isl.mail.od.whale': 'Dear {name}, this time of year the cloud whale passes our island. On some evenings, instead of falling stars, look up at dusk! It is very gentle. Curator Hoot',
    'od.td.tea': 'Rosa says three tiny elephants opened a tea stall south of the pond. Tiny!',
    'od.td.moss': 'Mumble whispers about a shy moss creature by the river. Tiptoe!',
    'od.td.mushroom': 'A note on a leaf in your mailbox, from someone called Old Morel...',
    'od.td.whale': 'Curator Hoot says the cloud whale is passing the island this season.',
    'cr.td.shroom.1': 'Old Morel, the mushroom merchant, is by the fairy ring today with odd seeds.',
    'cr.td.shroom.2': 'A little cart full of mushrooms stands by the fairy ring. Old Morel is in town!',
    'cr.td.shroom.3': 'The fairy ring smells of rain and spores: Old Morel came by.',
    'cr.td.whale.1': 'The air feels soft and cloudy. Hoot says: look up at dusk tonight!',
    'cr.td.whale.2': 'Grumbleton heard a low, happy song far out at sea. The cloud whale?',
    'cr.td.whale.3': 'The gulls are restless. Something big and gentle comes this evening.',
    'map.a.shroom': 'Old Morel, the mushroom merchant', 'map.a.tea': 'The tiny elephants\' tea stall', 'map.a.whale': 'The cloud whale (at dusk)',
    'cr.h.shroom': '[B] talk to Old Morel', 'cr.s.hello': 'Spores and sprouts, little one. Spores and sprouts. What catches your eye?',
    'cr.s.ware': '{item} ({n} coins)', 'cr.s.no': 'Just looking', 'cr.s.bought': 'A fine choice. It will grow on you.', 'cr.s.poor': 'Ah, not enough coins. Next time, little one.',
    'cr.s.bye': 'The wind is turning. I wander on at six.',
    'cr.h.tea': '[B] order a cup of tea', 'cr.h.teaDone': 'The elephants bow. One cup a day, they say. Come back tomorrow!', 'cr.h.teaClosed': 'The tea stall is closed. Open 10 to 20.',
    'cr.e.ask': 'Toot! Welcome, welcome. Which tea would you like?', 'cr.e.mint': 'Mint', 'cr.e.berry': 'Berry', 'cr.e.honey': 'Honey', 'cr.e.no': 'Not now',
    'cr.tea.title': 'Say when!', 'cr.tea.hint': 'Press [B] when the tea is between the lines. [C]: stop',
    'cr.tea.perfect': 'Just right! The elephants trumpet softly. Toot toot!', 'cr.tea.low': 'A little low, but lovely. The elephants nod.', 'cr.tea.high': 'Oops, a tiny puddle! They giggle and wipe it up.',
    'cr.tea.set': 'For a perfect pour, the elephants give you a tiny tea set!',
    'cr.w.see': 'Look up! The cloud whale is drifting over the island.', 'cr.w.watch': 'Stand still to watch it...', 'cr.w.first': 'The cloud whale! Hoot sends you a little whale kite.',
    'cr.w.photo': 'You took a picture of the cloud whale! Hoot will want a copy: 30 coins.',
    'cr.m.hello': '[B] say hello softly', 'cr.m.hid': 'Something small and green darted into the moss. Too loud!',
    'cr.m.visit': 'The moss creature blinks at you. "mrrp." ({n} of {m})', 'cr.m.friend': 'The moss creature is your friend now! It gives you a little moss charm.',
    'cr.m.again': 'The moss creature already said hello today. "mrrp."', 'cr.m.visitFriend': 'Your moss friend wiggles happily. "mrrp!"',
    'cr.task.moss': '🌿 Tiptoe up to the shy moss creature (by the river; Sneaky mode)', 'cr.task.tea': '🫖 Visit the tiny elephants\' tea stall (south of the pond)',
  },
  no: {
    'od.npc.shroom': 'Gamle Morkel', 'isl.i.puffball': 'røyksopp', 'isl.i.tea_mint': 'kopp myntete', 'isl.i.tea_berry': 'kopp bærte', 'isl.i.tea_honey': 'kopp honningte',
    'isl.mail.od.tea': 'Hei {name}! Har du hørt det? Tre BITTESMÅ elefanter har åpnet en tebod sør for dammen. De er veldig høflige. Gå og ta en kopp! Rosa',
    'isl.mail.od.moss': 'psst... {name}... i gresset ved elva, sør for åkeren, bor et mosedyr. Veldig sjenert. Bare på tærne! Da sier det kanskje hei. Mumle',
    'isl.mail.od.mushroom': 'Hilsen, lille venn. Jeg er gamle Morkel. Jeg vandrer fra øy til øy med sporer og spirer. Noen dager, når vinden lukter regn, stikker jeg kanskje innom alvesirkelen din. Morkel',
    'isl.mail.od.whale': 'Kjære {name}, på denne tiden av året svømmer skyhvalen forbi øya vår. Noen kvelder, i stedet for stjerneskudd, se opp i skumringen! Den er veldig rolig. Kurator Hu',
    'od.td.tea': 'Rosa sier at tre bittesmå elefanter har åpnet en tebod sør for dammen. Bittesmå!',
    'od.td.moss': 'Mumle hvisker om et sjenert mosedyr ved elva. Gå på tærne!',
    'od.td.mushroom': 'En lapp på et blad i postkassa di, fra en som heter gamle Morkel...',
    'od.td.whale': 'Kurator Hu sier at skyhvalen svømmer forbi øya denne årstiden.',
    'cr.td.shroom.1': 'Gamle Morkel, sopphandleren, står ved alvesirkelen i dag med rare frø.',
    'cr.td.shroom.2': 'En liten vogn full av sopp står ved alvesirkelen. Gamle Morkel er i byen!',
    'cr.td.shroom.3': 'Alvesirkelen lukter regn og sporer: gamle Morkel har kommet innom.',
    'cr.td.whale.1': 'Lufta føles myk og skyet. Hu sier: se opp i skumringen i kveld!',
    'cr.td.whale.2': 'Grumbleton hørte en dyp, glad sang langt ute på havet. Skyhvalen?',
    'cr.td.whale.3': 'Måkene er urolige. Noe stort og rolig kommer i kveld.',
    'map.a.shroom': 'Gamle Morkel, sopphandleren', 'map.a.tea': 'Teboden til de bittesmå elefantene', 'map.a.whale': 'Skyhvalen (i skumringen)',
    'cr.h.shroom': '[B] snakk med gamle Morkel', 'cr.s.hello': 'Sporer og spirer, lille venn. Sporer og spirer. Hva fanger blikket ditt?',
    'cr.s.ware': '{item} ({n} mynter)', 'cr.s.no': 'Bare ser', 'cr.s.bought': 'Et godt valg. Det vokser på deg.', 'cr.s.poor': 'Å, ikke nok mynter. Neste gang, lille venn.',
    'cr.s.bye': 'Vinden snur. Jeg vandrer videre klokka seks.',
    'cr.h.tea': '[B] bestill en kopp te', 'cr.h.teaDone': 'Elefantene bukker. Én kopp om dagen, sier de. Kom tilbake i morgen!', 'cr.h.teaClosed': 'Teboden er stengt. Åpen 10 til 20.',
    'cr.e.ask': 'Tuut! Velkommen, velkommen. Hvilken te vil du ha?', 'cr.e.mint': 'Mynte', 'cr.e.berry': 'Bær', 'cr.e.honey': 'Honning', 'cr.e.no': 'Ikke nå',
    'cr.tea.title': 'Si stopp!', 'cr.tea.hint': 'Trykk [B] når teen er mellom strekene. [C]: stopp',
    'cr.tea.perfect': 'Akkurat passe! Elefantene trompeterer lavt. Tuut tuut!', 'cr.tea.low': 'Litt lite, men deilig. Elefantene nikker.', 'cr.tea.high': 'Oi, en bitteliten dam! De fniser og tørker opp.',
    'cr.tea.set': 'For en perfekt skjenking gir elefantene deg et bitteliten teservise!',
    'cr.w.see': 'Se opp! Skyhvalen svever over øya.', 'cr.w.watch': 'Stå stille og se på den...', 'cr.w.first': 'Skyhvalen! Hu sender deg en liten skyhvaldrage.',
    'cr.w.photo': 'Du tok et bilde av skyhvalen! Hu vil gjerne ha en kopi: 30 mynter.',
    'cr.m.hello': '[B] si hei forsiktig', 'cr.m.hid': 'Noe lite og grønt pilte inn i mosen. For mye bråk!',
    'cr.m.visit': 'Mosedyret blunker til deg. «mrrp.» ({n} av {m})', 'cr.m.friend': 'Mosedyret er vennen din nå! Det gir deg en liten mosemaskot.',
    'cr.m.again': 'Mosedyret har allerede sagt hei i dag. «mrrp.»', 'cr.m.visitFriend': 'Mosevennen din vrikker glad. «mrrp!»',
    'cr.task.moss': '🌿 List deg bort til det sjenerte mosedyret (ved elva; snikemodus)', 'cr.task.tea': '🫖 Besøk teboden til de bittesmå elefantene (sør for dammen)',
  },
});

/** Does a creature take this surprise day (pure for a save; calendar.setSurpriseSwap)? */
export function creatureSwap(S, di, kind) {
  const got = S?.odd?.got || {};
  if (kind === 'merchant' && got.mushroom !== undefined && di > got.mushroom && dayRand(`shroom:${di}`) < SHROOM_SHARE) {
    // never a day Marlo promised in a letter (today.js hooks)
    const H = S.hook, D = S.hookDone;
    if ((H?.kind === 'letter' && H.due === di && H.who === 'merchant') || (D?.kind === 'letter' && D.di === di && D.who === 'merchant')) return kind;
    return 'mushroom';
  }
  if (kind === 'meteor' && got.whale !== undefined && di > got.whale && dayRand(`whale:${di}`) < WHALE_SHARE) return 'whale';
  return kind;
}

export class Creatures {
  constructor(host, odd) {
    this.host = host;
    this.odd = odd;
    setSurpriseSwap((di, kind) => creatureSwap(host.save, di, kind));
    const map = host.map;
    // Old Morel and his cart
    this.morel = new Guest(host, { id: 'shroom', color: 0xf3ead2, hat: makeGuestHat('mushroom'), css: '#d9583a', nameKey: 'od.npc.shroom' });
    this.cart = makeMushroomCart();
    this.cart.position.set(MOREL.cart.x, heightAt(MOREL.cart.x, MOREL.cart.z), MOREL.cart.z);
    this.cart.visible = false;
    host.scene.add(this.cart);
    this.cartObs = map.circObs(1e5, MOREL.cart.z, 0.7);
    map.addKeepOut(MOREL.x, MOREL.z, 1.8, 'mushroom merchant');
    // the tea stall
    this.stall = makeTeaStall();
    this.stall.position.set(TEA.x, heightAt(TEA.x, TEA.z), TEA.z);
    this.stall.visible = false;
    host.scene.add(this.stall);
    this.stallObs = map.boxObs(1e5, TEA.z, 1.0, 0.5);
    map.addKeepOut(TEA.x, TEA.z, 2.6, 'tea stall');
    // the moss creature
    this.moss = makeMossCreature();
    markA11y(this.moss, 'item');
    this.moss.position.set(MOSS.x, heightAt(MOSS.x, MOSS.z), MOSS.z);
    this.moss.visible = false;
    host.scene.add(this.moss);
    map.addKeepOut(MOSS.x, MOSS.z, 1.6, 'moss creature');
    this.mossSeen = 0;
    // the cloud whale
    this.whale = makeCloudWhale();
    this.whale.scale.setScalar(1.2);
    this.whale.visible = false;
    host.scene.add(this.whale);
    this.watch = null;
    this.tea = null;
    this.t = 0;
    this.stillT = 0;
  }

  get S() { return this.host.save; }
  get C() {
    const O = this.odd.O;
    if (!O.cre || typeof O.cre !== 'object') O.cre = {};
    const C = O.cre;
    C.tea ||= { day: '', cups: 0, perfect: false };
    C.moss ||= { visits: [], friend: false, hid: '' };
    C.whale ||= { seen: 0, photo: false, watched: '', day: '' };
    C.shroom ||= { day: '', bought: [] };
    return C;
  }
  has(id) { return arrived(this.S, id); }

  /** Today's surprise kind for creatures: 'mushroom' or 'whale' (or null). */
  get kind() { const k = surpriseOn(now()); return k === 'mushroom' || k === 'whale' ? k : null; }

  // ---------- the days ----------

  todayNews(at) {
    const k = surpriseOn(at);
    if (k === 'mushroom') return [{ kind: 'visitor', pri: 8, icon: '🍄', keys: [1, 2, 3].map((i) => `cr.td.shroom.${i}`), x: MOREL.x, z: MOREL.z }];
    if (k === 'whale') return [{ kind: 'rumor', pri: 7, icon: '🐋', keys: [1, 2, 3].map((i) => `cr.td.whale.${i}`) }];
    return [];
  }

  tick() {
    const host = this.host, h = host.forceHour ?? hourOf(), main = !host.isle2?.here();
    // Old Morel, 9 to 18 on his days
    const morel = this.kind === 'mushroom' && main && h >= 9 && h < 18;
    this.morel.place(MOREL.x, MOREL.z, morel, { x: -0.3, z: 1 });
    this.cart.visible = morel;
    this.cartObs.x = morel ? MOREL.cart.x : 1e5;
    // the tea stall: there once it came (the elephants only 10 to 20: until 17 before the owner's decision, so an
    // evening child never had tea)
    const stall = this.has('tea') && main;
    this.stall.visible = stall;
    this.stallObs.x = stall ? TEA.x : 1e5;
    for (const e of this.stall.userData.elephants) e.visible = stall && h >= 10 && h < TEA_UNTIL;
  }

  // ---------- [B] ----------

  interactions(P, out, nm) {
    if (this.morel.near(P, 1.9)) { out.b = { text: nm('cr.h.shroom'), fn: () => this.shroomTalk() }; return true; }
    if (this.stall.visible && Math.hypot(P.x - TEA.stand.x, P.z - TEA.stand.z) < 1.4) {
      const h = hourOf(), C = this.C;
      out.b = h < 10 || h >= TEA_UNTIL ? { text: t('cr.h.teaClosed'), fn: () => this.host.game.audio.play('bump') }
        : C.tea.day === dayKey() ? { text: t('cr.h.teaDone'), fn: () => this.host.game.audio.play('bump') }
          : { text: nm('cr.h.tea'), fn: () => this.teaAsk() };
      return true;
    }
    if (this.moss.visible && Math.hypot(P.x - MOSS.x, P.z - MOSS.z) < 1.7) { out.b = { text: nm('cr.m.hello'), fn: () => this.mossHello() }; return true; }
    return false;
  }

  // ---------- Old Morel ----------

  shroomTalk() {
    const host = this.host, g = this.morel, C = this.C, day = dayKey();
    if (C.shroom.day !== day) C.shroom = { day, bought: [] };
    const wares = WARES.filter(([id]) => !C.shroom.bought.includes(id));
    g.faceTo(host.player);
    const names = wares.map(([id, n]) => ({ id, n, label: t('cr.s.ware', { item: t(ITEMS[id] ? `isl.i.${id}` : `isl.d.${id}`), n }) }));
    if (!names.length) { host.say([g.line('cr.s.bye')]); return; }
    host.say([g.line('cr.s.hello', null, { choices: [...names.map((w) => w.label), 'cr.s.no'], rawChoices: true, onChoice: (i) => {
      const w = names[i];
      if (!w) return;
      if (this.S.coins < w.n) { host.say([g.line('cr.s.poor')]); return; }
      this.S.coins -= w.n;
      C.shroom.bought.push(w.id);
      if (ITEMS[w.id]) host.giveItems([[w.id, 1]]); else host.grant({ deco: w.id });
      host.game.audio.play('coin');
      host.say([g.line('cr.s.bought')]);
      host.markDirty();
    } })]);
  }

  // ---------- the tiny elephants' tea ----------

  teaAsk() {
    const host = this.host;
    const L = (key, extra = {}) => ({ name: t('map.a.tea'), css: '#9a94b2', speaker: 'isl.elephant', key, ...extra });
    host.say([L('cr.e.ask', { choices: [...TEAS.map((k) => `cr.e.${k}`), 'cr.e.no'], onChoice: (i) => { if (i < TEAS.length) this.startTea(TEAS[i]); } })]);
  }

  /** The tea game: the cup fills; [B] says when (the line is wider with forgiving timing). */
  startTea(kind) {
    const host = this.host, k = timingScale(host.player?.p);
    const mid = 0.79, half = 0.07 * k;
    this.tea = { kind, fill: 0, t: 0, lo: mid - half, hi: mid + half, done: false };
    host.mode = 'tea';
    this.renderTea(true);
  }

  renderTea(read = false) {
    const T = this.tea, host = this.host;
    const lvl = Math.round(T.fill * 100), lo = Math.round(T.lo * 100), hi = Math.round(T.hi * 100);
    const col = { mint: '#7ad04a', berry: '#c2185b', honey: '#ffc93c' }[T.kind];
    host.hud.setPanel(`<h2>🫖 ${esc(t('cr.tea.title'))}</h2>
      <div style="position:relative;width:120px;height:150px;margin:8px auto;border:5px solid #2b2340;border-top:none;border-radius:0 0 40px 40px;background:#fff;overflow:hidden">
        <div style="position:absolute;left:0;right:0;bottom:0;height:${lvl}%;background:${col}"></div>
        <div style="position:absolute;left:-4px;right:-4px;bottom:${lo}%;height:${hi - lo}%;border-top:3px dashed #2b2340;border-bottom:3px dashed #2b2340;background:rgba(255,255,255,.25)"></div>
      </div><div class="isl-foot" style="opacity:1">${esc(tFor(host.player?.p, 'cr.tea.hint'))}</div>`);
    if (read) speak(tFor(host.player?.p, 'cr.tea.hint'), 'narrator');
  }

  /** In 'tea' mode (panel buttons: [B] is aPressed, [C] is bPressed). */
  updateMode(mode, inp, panel, dt) {
    if (mode === 'watch') { this.updateWatch(inp, dt); return; }
    if (mode !== 'tea') return;
    const T = this.tea, host = this.host;
    if (!T) { host.mode = 'walk'; return; }
    T.t += dt;
    if (panel.bPressed && T.t > 0.3) { this.tea = null; host.hud.setPanel(null); host.mode = 'walk'; return; }
    T.fill = Math.min(1.05, T.t / 2.6);
    if ((panel.aPressed && T.t > 0.3) || T.fill >= 1.05) { this.pour(T.fill); return; }
    this.renderTea();
  }

  pour(fill) {
    const T = this.tea, host = this.host, C = this.C;
    this.tea = null;
    host.hud.setPanel(null);
    host.mode = 'walk';
    const res = fill < T.lo ? 'low' : fill > T.hi ? 'high' : 'perfect';
    C.tea.day = dayKey();
    C.tea.cups++;
    host.giveItems([[`tea_${T.kind}`, 1]]);
    host.game.ui.toast(t(`cr.tea.${res}`), 2600);
    for (const e of this.stall.userData.elephants) e.userData.hop = 1;
    if (res === 'perfect') {
      const A = host.game.audio;
      if (A.ctx && !A.muted) { A.tone(392, 0.25, { type: 'triangle', vol: 0.08 }); A.tone(523, 0.3, { type: 'triangle', vol: 0.08, delay: 0.2 }); }
      if (!C.tea.perfect) { C.tea.perfect = true; host.later(1.2, () => { host.game.ui.toast(t('cr.tea.set'), 2800); host.grant({ deco: 'teaSet' }); }); }
    }
    host.markDirty();
  }

  // ---------- the shy moss creature ----------

  /** Only seen in Sneaky mode; noise nearby (Normal or Sporty within 5 m) makes it hide for the day. */
  updateMoss(dt) {
    const host = this.host, P = host.player, C = this.C, day = dayKey(), h = hourOf();
    let show = false;
    if (P && this.has('moss') && !host.isle2?.here() && h >= 7 && h < 20 && C.moss.hid !== day) {
      const d = Math.hypot(P.x - MOSS.x, P.z - MOSS.z);
      const sneaky = this.odd.modes.mode === 'sneaky';
      if (!sneaky && d < 5 && host.mode === 'walk') {
        if (this.mossSeen > 0) host.game.ui.toast(t('cr.m.hid'), 2400);
        if (!C.moss.friend) { C.moss.hid = day; host.markDirty(); }
      }
      show = (sneaky || C.moss.friend) && d < 14 && C.moss.hid !== day;
    }
    this.mossSeen = show ? 3 : Math.max(0, this.mossSeen - dt);
    this.moss.visible = show;
    if (show) { const me = this.moss.userData.me; me.position.y = Math.abs(Math.sin(this.t * 2)) * 0.05; me.rotation.y = Math.sin(this.t * 0.7) * 0.4; }
  }

  mossHello() {
    const host = this.host, C = this.C, M = C.moss, di = dayIndex();
    const A = host.game.audio;
    if (A.ctx && !A.muted) A.tone(880, 0.12, { type: 'sine', vol: 0.08, slide: 1.4 });
    if (M.visits.includes(di)) { host.game.ui.toast(t(M.friend ? 'cr.m.visitFriend' : 'cr.m.again'), 2000); return; }
    M.visits = [...M.visits, di].slice(-20);
    const first = M.visits.length === 1;
    report(host, 'island', { key: 'sneak', what: 'moss' });
    if (first) report(host, 'trial', { id: 'sneak.moss' });
    const n = new Set(M.visits).size;
    if (!M.friend && n >= MOSS_FRIEND) { M.friend = true; host.game.ui.toast(t('cr.m.friend'), 3000); host.grant({ deco: 'mossCharm' }); }
    else host.game.ui.toast(t(M.friend ? 'cr.m.visitFriend' : 'cr.m.visit', { n, m: MOSS_FRIEND }), 2400);
    speak(t('cr.m.voice'), { speaker: 'isl.moss' });
    host.markDirty();
  }

  // ---------- the cloud whale ----------

  /** Where the whale is now (0..1 across its evening), or null when it is not up. */
  whaleK() {
    if (this.kind !== 'whale' || this.host.isle2?.here()) return null;
    const h = this.host.forceHour ?? hourOf();
    if (h < WHALE_HOURS[0] || h >= WHALE_HOURS[1]) return null;
    return (h - WHALE_HOURS[0]) / (WHALE_HOURS[1] - WHALE_HOURS[0]);
  }

  updateWhale(dt) {
    const host = this.host, P = host.player, C = this.C, k = this.whaleK();
    this.whale.visible = k !== null && !host.indoors;
    if (k === null) return;
    const x = -95 + k * 200, z = -14 + Math.sin(k * 3) * 6, y = 17 + Math.sin(this.t * 0.4) * 0.6; // (over the north of the island: seen from the side)
    this.whale.position.set(x, y, z);
    this.whale.rotation.y = 0.05 * Math.sin(this.t * 0.3);
    this.whale.userData.tail.rotation.z = Math.sin(this.t * 1.2) * 0.25;
    if (!P || host.indoors) return;
    const day = dayKey();
    if (C.whale.day !== day && Math.abs(x - P.x) < 60) {
      C.whale.day = day;
      C.whale.seen++;
      host.game.ui.toast(t('cr.w.see'), 3200);
      this.song();
      if (C.whale.seen === 1) host.later(3.5, () => { host.game.ui.toast(t('cr.w.first'), 3000); host.grant({ deco: 'whaleKite' }); });
      host.markDirty();
    }
    // stand still a moment while it is over the island: the view looks up at it (once a whale day)
    const still = host.mode === 'walk' && (P.moving || 0) < 0.05 && !P.air && Math.abs(x - P.x) < 40 && !host.camView;
    this.stillT = still ? this.stillT + dt : 0;
    if (this.stillT > 2.2 && C.whale.watched !== day) { C.whale.watched = day; this.startWatch(); }
  }

  song() {
    const A = this.host.game.audio;
    if (!A.ctx || A.muted) return;
    A.tone(196, 1.6, { type: 'sine', vol: 0.06, slide: 1.25 });
    A.tone(147, 2.0, { type: 'sine', vol: 0.05, slide: 0.8, delay: 1.2 });
  }

  startWatch() {
    const host = this.host;
    host.mode = 'watch';
    this.watch = { t: 0 };
    host.hud.setCinema(true);
    this.song();
  }

  updateWatch(inp, dt) {
    const host = this.host, W = this.watch, P = host.player;
    if (!W || !P) { this.endWatch(); return; }
    W.t += dt;
    const w = this.whale.position;
    host.camView = { pos: new THREE.Vector3(P.x, P.y + 2.0, P.z + 9), look: new THREE.Vector3(w.x, w.y - 1, w.z), fov: 60 };
    if (W.t > 6 || (W.t > 0.8 && (inp.aPressed || inp.bPressed || inp.cPressed))) this.endWatch();
  }

  endWatch() {
    const host = this.host;
    this.watch = null;
    host.camView = null;
    host.hud.setCinema(false);
    if (host.mode === 'watch') host.mode = 'walk';
    host.snapCamera?.();
  }

  /** A photo (photo.js): the whale in the picture? */
  onPhoto() {
    const host = this.host, C = this.C;
    if (!this.whale.visible) return;
    const v = this.whale.position.clone().project(host.camera);
    if (Math.abs(v.x) > 1.1 || Math.abs(v.y) > 1.1 || v.z > 1) return;
    if (!C.whale.photo) { C.whale.photo = true; host.later(1.4, () => { host.game.ui.toast(t('cr.w.photo'), 3000); host.grant({ coins: 30 }); }); }
  }

  // ---------- the rest ----------

  tasks() {
    const out = [], C = this.C;
    if (this.has('tea') && !C.tea.cups) out.push(t('cr.task.tea'));
    if (this.has('moss') && !C.moss.visits.length) out.push(t('cr.task.moss'));
    return out;
  }

  markers() {
    const out = [];
    if (this.has('tea')) out.push({ key: 'odd:tea', kind: 'place', icon: '🫖', name: t('map.a.tea'), x: TEA.x, z: TEA.z, tx: TEA.stand.x, tz: TEA.stand.z + 0.6 });
    return out; // (the moss creature is a secret: never on the map)
  }

  mapItems() {
    const out = [];
    if (this.morel.shown) out.push({ key: 'odd:shroom', icon: '🍄', name: t('map.a.shroom'), x: MOREL.x, z: MOREL.z });
    if (this.kind === 'whale') out.push({ key: 'odd:whale', icon: '🐋', name: t('map.a.whale') });
    return out;
  }

  update(dt) {
    this.t += dt;
    this.morel.update(dt);
    this.updateMoss(dt);
    this.updateWhale(dt);
    for (const e of this.stall.userData.elephants) {
      e.userData.hop = Math.max(0, (e.userData.hop || 0) - dt * 2);
      e.position.y = Math.sin((e.userData.hop || 0) * Math.PI) * 0.25;
      e.userData.trunk.rotation.x = 0.6 + Math.sin(this.t * 2 + e.position.x) * 0.15;
    }
  }

  dispose() {
    setSurpriseSwap(null);
    this.morel.dispose();
    if (this.watch) this.endWatch();
  }
}

addStrings({ en: { 'cr.m.voice': 'mrrp.' }, no: { 'cr.m.voice': 'mrrp.' } });
