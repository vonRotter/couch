import * as THREE from 'three';
import { t, addStrings } from '../../core/i18n.js';
import { say as speak } from '../../core/voice.js';
import { GAMES, SKILL_IDS, loadPassport, skillLevel, openTrials } from '../../core/passport.js';
import { ARCADE, ARCADE_KEYS, arcadeDef } from '../arcade/defs.js';
import { bestOf, familyBests } from '../arcade/scores.js';
import { dayRand, dayKey } from './calendar.js';
import '../arcade/strings.js';

// The Game Hall's classic games on the island side (the games themselves: scenes/arcade). The row of nine
// cabinets is built by map.js (HALL_CABS) and models.js (makeHall); this draws the high-score board on the back
// wall over the row (your best at each game, and the best of the other children on this device when it is
// higher), gives each cabinet's sign its "Best" line, and has Coach Bo say one line about a game the first time
// you walk up to its cabinet (his voice; once per game). Coach's talk has "Which arcade game?": he suggests one
// (one you have not played that trains your weakest skill, else one with a trial open) with its line.

addStrings({
  en: {
    'arc.board': 'HIGH SCORES', 'arc.board.yours': 'yours', 'arc.board.new': 'new!', 'arc.info.best': 'Best: {n}', 'arc.info.level': 'Levels cleared: {n}',
    'coach.arc.snake': 'Wiggle Worm teaches reacting in time, and thinking about where your tail will be!',
    'coach.arc.blocks': 'Block Drop is all about shapes: see where a piece fits before it lands.',
    'coach.arc.maze': 'In Tunnel Trek, remember the tunnels you walked. That is how you read a map!',
    'coach.arc.crates': 'Crate Shove: think before you push! And undo is a tool, not a mistake.',
    'coach.arc.simon': 'Echo Bells trains your memory. Listen, watch, then ring it back!',
    'coach.arc.lights': 'Sleepy Lanterns is pure logic: one tap turns five lanterns. Find the right order!',
    'coach.arc.bonk': 'Brick Bonk: where the ball hits your paddle decides where it goes. Try the edges!',
    'coach.arc.pong': 'Paddle Pals: watch the ball and be there first. Bring a friend for a match!',
    'coach.arc.rocks': 'Rock Patrol: your rocket keeps gliding. Turn, push, and let go!',
    'coach.c.arcade': 'Which arcade game?', 'coach.arcSuggest': 'Try {game} in the Game Hall! {line}',
  },
  no: {
    'arc.board': 'REKORDER', 'arc.board.yours': 'din', 'arc.board.new': 'ny!', 'arc.info.best': 'Beste: {n}', 'arc.info.level': 'Brett klart: {n}',
    'coach.arc.snake': 'Vrikkeormen lærer deg å reagere i tide, og å tenke på hvor halen din blir!',
    'coach.arc.blocks': 'Klossregn handler om former: se hvor en brikke passer før den lander.',
    'coach.arc.maze': 'I Tunneltur husker du tunnelene du har gått. Sånn leser du et kart!',
    'coach.arc.crates': 'Kassedytt: tenk før du dytter! Og å angre er et verktøy, ikke en feil.',
    'coach.arc.simon': 'Ekkobjeller trener hukommelsen. Lytt, se, og ring den tilbake!',
    'coach.arc.lights': 'Søvnige lykter er ren logikk: ett trykk snur fem lykter. Finn riktig rekkefølge!',
    'coach.arc.bonk': 'Murbonk: der ballen treffer racketen, bestemmer hvor den går. Prøv kantene!',
    'coach.arc.pong': 'Racketvenner: følg ballen og vær der først. Ta med en venn til en kamp!',
    'coach.arc.rocks': 'Steinpatruljen: raketten glir videre. Snu, dytt, og slipp!',
    'coach.c.arcade': 'Hvilket arkadespill?', 'coach.arcSuggest': 'Prøv {game} i Spillhallen! {line}',
  },
});

export class HallArcade {
  constructor(host) {
    this.host = host;
    const S = host.save;
    if (!S.hall || typeof S.hall !== 'object') S.hall = { told: {} };
    if (!S.hall.told) S.hall.told = {};
    this.drawBoard();
    this.sign = 0;
    this.signT = 0;
    this.drawSign();
  }

  get S() { return this.host.save; }
  get progress() { return this.host.game.roster.progress; }

  /** The line under a cabinet's sign: your best, or "new!". */
  info(key) {
    const best = bestOf(this.progress, key);
    if (!best && !this.progress.arcade?.plays?.[key]) return t('isl.best.new');
    return arcadeDef(key)?.kind === 'levels' ? t('arc.info.level', { n: best }) : t('arc.info.best', { n: best });
  }

  /** The high-score board over the row: one column per game (its name, your best, a higher best of another child). */
  drawBoard() {
    const board = this.host.map.hall?.userData.board;
    if (!board) return;
    const W = 2048, H = 196;
    const c = this.canvas || (this.canvas = document.createElement('canvas'));
    c.width = W; c.height = H;
    const g = c.getContext('2d');
    g.fillStyle = '#2b2340';
    g.fillRect(0, 0, W, H);
    const col = W / ARCADE.length;
    const font = (px, w = 700) => `${w} ${px}px Fredoka, sans-serif`;
    g.textAlign = 'center';
    ARCADE.forEach((d, i) => {
      const x = col * i + col / 2;
      g.fillStyle = `#${d.color.toString(16).padStart(6, '0')}`;
      g.fillRect(col * i + 8, 8, col - 16, 8);
      g.fillStyle = '#fff4b8';
      g.font = font(26);
      g.fillText(t(`game.${d.key}`), x, 48, col - 14);
      const best = bestOf(this.progress, d.key);
      g.fillStyle = best ? '#ffffff' : '#9a94b2';
      g.font = font(64);
      g.fillText(best ? String(best) : '–', x, 120);
      const fam = familyBests(this.host.game, d.key).find((f) => !f.me && f.best > best);
      g.font = font(24, 600);
      g.fillStyle = '#c9b8ff';
      g.fillText(fam ? `🏆 ${fam.name} ${fam.best}` : best ? t('arc.board.yours') : t('arc.board.new'), x, 168, col - 14);
    });
    if (!this.tex) {
      this.tex = new THREE.CanvasTexture(c);
      this.tex.colorSpace = THREE.SRGBColorSpace;
      board.material.map = this.tex;
      board.material.needsUpdate = true;
    } else this.tex.needsUpdate = true;
  }

  /**
   * The hall's front sign: "HIGH SCORES" and one game's best after the other (a new one every few seconds: no
   * blinking, the text just changes).
   */
  drawSign() {
    const m = this.host.map.hall?.userData.marquee;
    if (!m) return;
    const W = 1024, H = 160;
    const c = this.signCanvas || (this.signCanvas = document.createElement('canvas'));
    c.width = W; c.height = H;
    const g = c.getContext('2d');
    g.fillStyle = '#2b2340';
    g.fillRect(0, 0, W, H);
    g.textAlign = 'center';
    const d = ARCADE[this.sign % ARCADE.length];
    const best = bestOf(this.progress, d.key);
    const top = familyBests(this.host.game, d.key)[0];
    g.fillStyle = '#fff4b8';
    g.font = '700 54px Fredoka, sans-serif';
    g.fillText(t('arc.board'), W / 2, 60, W - 40);
    g.fillStyle = `#${d.color.toString(16).padStart(6, '0')}`;
    g.font = '700 62px Fredoka, sans-serif';
    const who = top && top.best > 0 ? ` · ${top.name} ${top.best}` : best ? '' : ` · ${t('arc.board.new')}`;
    g.fillText(`${t(`game.${d.key}`)}${who}`, W / 2, 136, W - 40);
    if (!this.signTex) {
      this.signTex = new THREE.CanvasTexture(c);
      this.signTex.colorSpace = THREE.SRGBColorSpace;
      m.material.map = this.signTex;
      m.material.needsUpdate = true;
    } else this.signTex.needsUpdate = true;
  }

  /** Once a second: the sign turns to the next game now and then; Coach's line at a classic cabinet the first time. */
  tick() {
    if (++this.signT >= 4) { this.signT = 0; this.sign++; this.drawSign(); }
    const host = this.host, P = host.player;
    if (!P || host.mode !== 'walk') return;
    for (const pl of host.map.places) {
      if (!pl.arcade || this.S.hall.told[pl.key]) continue;
      if (Math.hypot(P.x - pl.door.x, P.z - pl.door.z) > 1.0) continue;
      this.S.hall.told[pl.key] = 1;
      host.markDirty();
      const line = t(`coach.arc.${pl.key}`);
      const s = `${t('isl.npc.coach')}: ${line}`;
      host.game.ui.toast(s, Math.max(3200, s.length * 60));
      speak(line, 'isl.coach');
      break;
    }
  }

  /** Coach suggests one classic game: { key, line }. */
  suggestion() {
    const P = loadPassport(this.host.game.solo?.profile?.id);
    if (!P) return { key: ARCADE_KEYS[0] };
    const levels = Object.fromEntries(SKILL_IDS.map((s) => [s, skillLevel(P, s)]));
    const fresh = ARCADE_KEYS.filter((k) => !P.games[k]?.proper);
    if (fresh.length) {
      const score = (k) => Math.min(...GAMES[k].skills.map((s) => levels[s])) * 10 + ARCADE_KEYS.indexOf(k) * 0.1;
      return { key: fresh.sort((a, b) => score(a) - score(b))[0] };
    }
    const tr = openTrials(P, 20).find((x) => ARCADE_KEYS.includes(x.game));
    if (tr) return { key: tr.game, trial: tr.id };
    return { key: ARCADE_KEYS[Math.floor(dayRand(`arc:${dayKey()}`) * ARCADE_KEYS.length)] };
  }
}
