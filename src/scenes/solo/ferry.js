import * as THREE from 'three';
import { t, tFor, addStrings } from '../../core/i18n.js';
import { esc } from '../../core/ui.js';
import { coopRecord, takeCoopMail, nameList } from '../../core/coop.js';
import { COOP_PADS } from '../hub.js';
import { FERRY } from './map.js';

// The Party Pier: a little jetty off the east side of the pier with the ferry to the shared island, where
// friends join with their own controllers and everyone plays together (Game.goTogether: this child is
// already player 1 there). The notice board on the beach shows the badges for games played together
// (core/coop.js): one per co-op game, in that game's color. Coming back, the ferry lands here.

addStrings({
  en: {
    'ferry.name': 'Party Pier ferry', 'ferry.tag': 'Party Pier', 'ferry.tagSub': 'ferry to play together',
    'ferry.h.board': '[B] take the ferry: play together', 'ferry.h.badges': '[B] read the badge board',
    'ferry.ask': 'Toot toot! This ferry goes to the Party Island, where friends join with their own controllers and you all play together. Go now?',
    'ferry.board': 'Play-together badges', 'ferry.boardSub': 'Finish a game together on the Party Island to get its badge. Coins for every game, once a day.',
    'ferry.none': 'No badges yet: take the ferry and play a game together!', 'ferry.count': '{n} badges',
    'ferry.close': '[B] or [C]: close',
    'isl.mail.coop': 'Ahoy {name}! The ferry brought word from the Party Island: you played {games} together with friends. Here is a little something for your island. Toot toot!',
    'isl.mail.coopB': 'Ahoy {name}! You played {games} together on the Party Island, and you got new badges for the board on the Party Pier: {badges}. Here is a little something for your island too. Toot toot!',
    'isl.mail.coopDeco': 'Ahoy {name}! So many games played together! The Party Island sends this for your yard.',
    'isl.d.coopPennants': 'Party pennants', 'isl.d.coopTrophy': 'Play-together trophy',
  },
  no: {
    'ferry.name': 'Festbrygga-ferja', 'ferry.tag': 'Festbrygga', 'ferry.tagSub': 'ferje for å spille sammen',
    'ferry.h.board': '[B] ta ferja: spill sammen', 'ferry.h.badges': '[B] les merketavla',
    'ferry.ask': 'Tuut tuut! Denne ferja går til Festøya, der venner blir med med sine egne kontroller og dere spiller sammen. Dra nå?',
    'ferry.board': 'Merker for å spille sammen', 'ferry.boardSub': 'Fullfør et spill sammen på Festøya for å få merket. Mynter for hvert spill, én gang om dagen.',
    'ferry.none': 'Ingen merker ennå: ta ferja og spill et spill sammen!', 'ferry.count': '{n} merker',
    'ferry.close': '[B] eller [C]: lukk',
    'isl.mail.coop': 'Ohoi {name}! Ferja kom med hilsen fra Festøya: du spilte {games} sammen med venner. Her er en liten ting til øya di. Tuut tuut!',
    'isl.mail.coopB': 'Ohoi {name}! Du spilte {games} sammen på Festøya, og du fikk nye merker til tavla på Festbrygga: {badges}. Her er en liten ting til øya di også. Tuut tuut!',
    'isl.mail.coopDeco': 'Ohoi {name}! Så mange spill sammen! Festøya sender deg dette til hagen.',
    'isl.d.coopPennants': 'Festvimpler', 'isl.d.coopTrophy': 'Spill-sammen-pokal',
  },
});

const CSS = `
.isl-panel .ferry-sub { text-align: center; margin: -4px 0 10px; opacity: .75; font-size: clamp(12px, 1.15vw, 17px); }
.ferry-badges { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; }
.ferry-badge { display: flex; align-items: center; gap: 6px; background: #fff; border-radius: 999px; padding: 3px 12px 3px 4px; box-shadow: 0 3px 0 rgba(43,35,64,.15); font-size: clamp(12px, 1.2vw, 18px); }
.ferry-badge i { width: 1.5em; height: 1.5em; border-radius: 50%; background: var(--c); box-shadow: inset 0 0 0 3px rgba(255,255,255,.6); }
`;
function injectStyle() {
  if (document.getElementById('isl-ferry-style')) return;
  const el = document.createElement('style');
  el.id = 'isl-ferry-style';
  el.textContent = CSS;
  document.head.appendChild(el);
}

/** The color of a co-op game's badge (its pad color on the shared island). */
export function badgeColor(key) {
  return COOP_PADS.find((p) => p.key === key) || { color: 0xffc93c, css: '#d99a00' };
}

/** Letters from the shared island waiting for this profile (core/coop.js) go into the island's mailbox. */
export function deliverCoopMail(progress, S) {
  let n = 0;
  for (const L of takeCoopMail(progress)) {
    S.mail.push({ id: L.badges.length ? 'coopB' : 'coop', from: 'grumbleton', coins: L.coins || 0, games: L.games, badges: L.badges, deco: L.decos[0] || undefined });
    for (const d of L.decos.slice(1)) S.mail.push({ id: 'coopDeco', from: 'grumbleton', deco: d });
    n++;
  }
  return n;
}

/** The words a co-op letter needs (in the language of the moment): the games and the new badges. */
export function coopMailVars(r) {
  const names = (list) => nameList((list || []).map((k) => t(`game.${k}`)));
  return { games: names(r.games), badges: names(r.badges) };
}

/** The new badges in a letter's gifts row. */
export function coopBadgeGifts(r) {
  return (r.badges || []).map((k) => `<div class="ferry-badge" style="--c:${badgeColor(k).css}"><i></i>${esc(t(`game.${k}`))}</div>`).join('');
}

export class Ferry {
  constructor(host) {
    this.host = host;
    this.boat = host.map.ferry;
    this.boardView = host.map.ferryBoard;
    this.tag = host.game.ui.label('label isl-tag');
    this.tagPos = new THREE.Vector3(FERRY.jetty.x1 - 0.6, 2.6, FERRY.jetty.z);
    this.shown = -1;
    injectStyle();
    this.refreshBoard();
  }

  get badges() {
    return Object.keys(coopRecord(this.host.game.roster.progress).badges);
  }

  /** The board's colored discs: one per badge, in the game's color (up to 28). */
  refreshBoard() {
    const list = this.badges;
    if (list.length === this.shown || !this.boardView) return;
    this.shown = list.length;
    const discs = this.boardView.userData.discs;
    discs.forEach((m, i) => {
      const k = list[i];
      m.visible = !!k;
      if (k) m.material = this.boardView.userData.mat(badgeColor(k).color);
    });
  }

  /** On the jetty (or right by the boat): the ferry. By the board: the badges. */
  interactions(P, out, nm) {
    const J = FERRY.jetty;
    const onJetty = P.x > J.x0 + 0.6 && P.x < J.x1 + 0.8 && Math.abs(P.z - J.z) < J.hw + 0.7;
    if (onJetty) { out.b = { text: nm('ferry.h.board'), fn: () => this.ask() }; return true; }
    if (Math.hypot(P.x - FERRY.board.x, P.z - (FERRY.board.z + 0.9)) < 1.6) { out.b = { text: nm('ferry.h.badges'), fn: () => this.openBoard() }; return true; }
    return false;
  }

  ask() {
    const host = this.host;
    host.game.audio.play('boing');
    host.say([{ name: t('ferry.name'), css: '#e0364f', key: 'ferry.ask', choices: ['isl.yes', 'isl.no'], onChoice: (i) => { if (i === 0) this.depart(); } }]);
  }

  depart() {
    const host = this.host;
    if (host.launching) return;
    host.launching = true;
    host.save.last = { place: null };
    host.markDirty();
    host.flush();
    host.game.audio.play('whoosh');
    host.game.goTogether();
  }

  openBoard() {
    const host = this.host;
    host.mode = 'pier';
    this.boardT = 0;
    const list = this.badges;
    const items = list.map((k) => `<div class="ferry-badge" style="--c:${badgeColor(k).css}"><i></i>${esc(t(`game.${k}`))}</div>`).join('');
    host.hud.setPanel(`<h2>${esc(t('ferry.board'))}</h2><div class="ferry-sub">${esc(t('ferry.boardSub'))}</div>
      <div class="ferry-badges">${items || `<div class="isl-foot">${esc(t('ferry.none'))}</div>`}</div>
      <div class="isl-foot">${esc(list.length ? `${t('ferry.count', { n: list.length })} · ` : '')}${esc(tFor(host.player?.p, 'ferry.close'))}</div>`);
    host.game.audio.play('select');
  }

  /** The badge board panel: any button closes it. */
  updateBoard(inp, dt) {
    this.boardT += dt;
    if (this.boardT < 0.3 || !(inp.aPressed || inp.bPressed || inp.cPressed)) return;
    this.host.hud.setPanel(null);
    this.host.mode = 'walk';
  }

  update(dt) {
    const host = this.host, time = host.time;
    if (this.boat) {
      this.boat.position.y = FERRY.y + Math.sin(time * 1.6) * 0.06;
      this.boat.rotation.z = Math.sin(time * 1.1) * 0.03;
      this.boat.userData.star.rotation.y += dt * 2;
    }
    this.refreshBoard();
    const P = host.player;
    const near = P && Math.hypot(P.x - this.tagPos.x, P.z - this.tagPos.z) < 12 && !host.isle2?.here?.();
    if (!near) { this.tag.style.display = 'none'; return; }
    const html = `${esc(t('ferry.tag'))}<small>${esc(t('ferry.tagSub'))}</small>`;
    if (this.tag.innerHTML !== html) this.tag.innerHTML = html;
    host.game.ui.place(this.tag, this.tagPos, host.camera);
  }
}
