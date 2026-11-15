// Tutorials and first-time teaching ("onboarding"), and skipping them.
//
// The rule from the onboarding audit (ONBOARDING.md): one action at a time, a short moment to try it, then
// the next. StepTeacher below does that for a game's controls: each player sees one prompt ("[B]: throw a
// rope"), it moves on when they do it (a short "Nice!" first), and the next one comes. Prompts follow the
// player's device and remapping through the button tokens ([A], [B], [C], ...), and are read aloud (help).
//
// Every tutorial can be skipped and is never forced:
//   - the first card (TutorialCard, a main.js modal like the help offers) asks "Show me how" or
//     "I know how to play" the first time a tutorial would start; every player votes, and the steps go only to
//     those who want them (with nobody answering for 30 s it shows the tutorial);
//   - the pause menu has "Skip the tutorial" while one runs (the solo island's menu: "Skip the farming steps");
//   - "Help me play" has "Tutorials and tips": off skips them all, turning it on again brings every one back.
// Remembered per profile like the other assists (profile.assist.tutorials / tutSeen / tutSkipped, core/assist.js);
// guests and the shared island use the device default. A tutorial done or skipped is not shown again.
// Skipping never holds anything back: whatever a tutorial gives that progress needs is given anyway (each game
// does that in its own skip handler).

import * as THREE from 'three';
import { t, tFor, addStrings } from './i18n.js';
import { esc } from './ui.js';
import { symHtml } from './palette.js';
import { say, voiceOn } from './voice.js';
import { profileSettings, saveSettings } from './assist.js';

addStrings({
  en: {
    'tut.ask': 'First time here? I can show you how to play, one thing at a time.',
    'tut.show': 'Show me how', 'tut.skip': 'I know how to play',
    'tut.hint': 'Stick up/down · [OK]: choose',
    'tut.voteHint': 'Everyone: stick up/down, then [OK] to vote',
    'tut.chipOk': '[OK]', 'tut.startsIn': 'starts in {n} s',
    'tut.only': 'Step by step for {names}',
    'tut.skipped': 'Tutorial skipped. Turn tutorials back on in Help me play.',
    'tut.nice': 'Nice!',
    'pause.skiptut': 'Skip the tutorial',
    'assist.tutorials': 'Tutorials and tips', 'assist.tutorials.d': 'Show how to play the first time, one button at a time, and first-time tips. Off skips them all. Turning it on again shows every tutorial again.',
  },
  no: {
    'tut.ask': 'Første gang her? Jeg kan vise deg hvordan du spiller, én ting om gangen.',
    'tut.show': 'Vis meg hvordan', 'tut.skip': 'Jeg kan spille dette',
    'tut.hint': 'Pinne opp/ned · [OK]: velg',
    'tut.voteHint': 'Alle: pinne opp/ned, så [OK] for å stemme',
    'tut.chipOk': '[OK]', 'tut.startsIn': 'starter om {n} s',
    'tut.only': 'Steg for steg for {names}',
    'tut.skipped': 'Opplæringen er hoppet over. Slå den på igjen i Hjelp meg å spille.',
    'tut.nice': 'Bra!',
    'pause.skiptut': 'Hopp over opplæringen',
    'assist.tutorials': 'Opplæring og tips', 'assist.tutorials.d': 'Vis hvordan du spiller første gang, én knapp om gangen, og tips første gang. Av hopper over alt. Slår du det på igjen, vises all opplæring igjen.',
  },
});

// ---------- whose settings ----------

/** The settings ids for these players: on a profile's own island that profile; else each player's profile, '' for guests. */
function idsFor(game, players) {
  if (game?.solo?.profile) return [game.solo.profile.id];
  const ids = new Set((players || []).filter(Boolean).map((p) => p.profileId || ''));
  if (!ids.size) ids.add('');
  return [...ids];
}

const wantsId = (sid, id) => {
  const s = profileSettings(sid);
  return s.tutorials !== false && !s.tutSeen.includes(id);
};

/** Does anyone of these players still get tutorial `id` (tutorials on, not done or skipped yet)? */
export function wantsTutorial(game, players, id) {
  return idsFor(game, players).some((sid) => wantsId(sid, id));
}

/** One player (their profile, a guest's device default). */
export function playerWants(game, p, id) {
  return wantsTutorial(game, [p], id);
}

/** First-time tips (short toasts and signs, not a whole tutorial): on unless everyone turned tutorials off. */
export function tipsOn(game, players = game?.roster?.players) {
  return idsFor(game, players).some((sid) => profileSettings(sid).tutorials !== false);
}

/** Tutorial `id` was done (or skipped) by these players: it is not shown to them again. */
export function markTutorial(game, players, id, skipped = false) {
  for (const sid of idsFor(game, players)) {
    const s = profileSettings(sid);
    const seen = s.tutSeen.includes(id) ? s.tutSeen : [...s.tutSeen, id];
    const sk = skipped ? [...new Set([...s.tutSkipped, id])] : s.tutSkipped.filter((x) => x !== id);
    if (seen === s.tutSeen && sk.length === s.tutSkipped.length && sk.every((x, i) => x === s.tutSkipped[i])) continue;
    saveSettings(sid, { ...s, tutSeen: seen, tutSkipped: sk });
  }
}

// ---------- the look ----------

const CSS = `
.teach-tip { position: absolute; left: 0; top: 0; pointer-events: none; z-index: 3; white-space: nowrap; font-weight: 800;
  font-size: clamp(13px, 1.25vw, 19px); color: #2b2340; background: #fffbe8; border: 3px solid var(--c, #8a45e0);
  border-radius: 14px; padding: 3px 12px; box-shadow: 0 3px 0 rgba(43,35,64,.25); line-height: 1.2; will-change: transform; }
.teach-tip.ok { border-color: #2ec27e; color: #1d7a4f; }
.teach-tip b.tt-n { display: inline-block; min-width: 1.4em; padding: 0 6px; margin-right: 6px; border-radius: 999px; background: var(--c, #8a45e0); color: #fff; font-size: .8em; text-align: center; }
.teach-box { position: fixed; left: 50%; top: auto; bottom: 21%; transform: translateX(-50%); pointer-events: none; z-index: 6; white-space: normal;
  max-width: min(720px, 90vw); text-align: center; font-size: clamp(15px, 1.6vw, 24px); padding: 8px 20px; }
.a11y-text .teach-tip { zoom: var(--ts); }
.panel.tut-panel { max-width: min(640px, 92vw); pointer-events: auto; }
.tut-panel .tut-game { font-size: clamp(20px, 2.2vw, 32px); font-weight: 800; }
.tut-panel .pause-item { cursor: pointer; }
.tut-chips { display: flex; flex-wrap: wrap; gap: 4px; justify-content: center; margin-top: 3px; font-size: .62em; }
.tut-chips:empty { display: none; }
.tut-chip small { font-size: .8em; opacity: .75; }
`;
let cssDone = false;
function addCss() {
  if (cssDone || typeof document === 'undefined') return;
  cssDone = true;
  const el = document.createElement('style');
  el.textContent = CSS;
  document.head.appendChild(el);
}

// ---------- one action at a time ----------

const _v = new THREE.Vector3();

/**
 * Teach a game's controls step by step, per player. scene: the game; id: the tutorial id (for skipping);
 * players: who learns (each only if they still want this tutorial); steps(p): that player's steps, each
 * { key, vars?, on: 'a' | 'rope' | ..., time? } where `on` is the event that moves it on (the game calls
 * did(p, on) when the player does it) and `time` makes an info step move on by itself after that many
 * seconds. text: a step's key can also be a function (p) => key, for input that changes while playing.
 * where(p): a world point to show that player's prompt at (above the bean); without it one box at the
 * bottom of the screen (solo games). onDone(p): an optional hook when a player finished. wantAll: teach
 * every player given (the game asked already) instead of only those who still want this tutorial.
 */
export class StepTeacher {
  constructor(scene, { id, players, steps, where = null, onDone = null, first = 0.8, pause = 1.1, wantAll = false }) {
    addCss();
    this.scene = scene;
    this.game = scene.game;
    this.id = id;
    this.where = where;
    this.onDone = onDone;
    this.pause = pause;
    this.readQueue = [];
    this.readT = 0;
    this.readKeys = new Set();
    // wantAll: the game already asked (the card said "Show me how"): teach everyone who has not done it
    // the card's vote (game.tutLearners): only the players who chose "Show me how" (or did not vote)
    const only = this.game.tutLearners?.[id];
    this.list = players.filter((p) => (only ? only.includes(p.deviceId) : wantAll || playerWants(this.game, p, id))).map((p, i) => ({ p, steps: steps(p), i: 0, wait: first + i * 0.15, ok: 0, el: null, html: '' }));
    this.solo = players.length === 1;
  }

  get active() { return this.list.some((s) => s.i < s.steps.length); }

  stateOf(p) { return this.list.find((s) => s.p === p) || null; }

  /** The player's current step (or null). */
  step(p) {
    const s = this.stateOf(p);
    return s && s.i < s.steps.length && s.wait <= 0 && s.ok <= 0 ? s.steps[s.i] : null;
  }

  /** The player did something: returns true when it was what the shown step asked for (it moves on). */
  did(p, ev) {
    const s = this.stateOf(p);
    if (!s || s.i >= s.steps.length || s.wait > 0 || s.ok > 0) return false;
    const st = s.steps[s.i];
    if (st.on !== ev && !(Array.isArray(st.on) && st.on.includes(ev))) return false;
    s.ok = this.pause;
    this.game.audio.play('coin');
    return true;
  }

  /** Everyone skips what is left (the pause menu's "Skip the tutorial"). */
  skip() {
    const left = this.list.filter((s) => s.i < s.steps.length).map((s) => s.p);
    for (const s of this.list) { s.i = s.steps.length; this.hide(s); }
    if (left.length) markTutorial(this.game, left, this.id, true);
  }

  textOf(s, st) {
    const key = typeof st.key === 'function' ? st.key(s.p) : st.key;
    return tFor(s.p, key, st.vars);
  }

  update(dt) {
    for (const s of this.list) {
      if (s.i >= s.steps.length) continue;
      if (s.ok > 0) {
        s.ok -= dt;
        if (s.ok <= 0) {
          s.i++;
          s.wait = 0.25;
          if (s.i >= s.steps.length) { this.hide(s); markTutorial(this.game, [s.p], this.id); this.onDone?.(s.p); continue; }
        }
      } else if (s.wait > 0) {
        s.wait -= dt;
        if (s.wait <= 0) this.shown(s);
      } else {
        const st = s.steps[s.i];
        if (st.time && (s.shownT = (s.shownT || 0) + dt) >= st.time) { s.ok = 0.01; s.shownT = 0; }
      }
      this.render(s);
    }
    // read aloud one prompt at a time (several players learning at once take turns)
    this.readT -= dt;
    if (this.readT <= 0 && this.readQueue.length) {
      const text = this.readQueue.shift();
      say(text, 'narrator');
      this.readT = 2.6;
    }
  }

  /** A new step appears: read it aloud (once per text in a game with several players). */
  shown(s) {
    const st = s.steps[s.i];
    s.shownT = 0;
    const key = typeof st.key === 'function' ? st.key(s.p) : st.key;
    if (!voiceOn()) return;
    if (this.solo) { this.readQueue = [this.textOf(s, st)]; this.readT = 0; return; }
    if (this.readKeys.has(key)) return;
    this.readKeys.add(key);
    this.readQueue.push(t(key, st.vars));
  }

  render(s) {
    const st = s.steps[s.i];
    const visible = st && (s.wait <= 0 || s.ok > 0) && this.scene.state !== 'results' && !this.hidden; // (hidden: the game has a panel open)
    if (!visible) { if (s.el) s.el.style.display = 'none'; return; }
    if (!s.el) {
      s.el = document.createElement('div');
      s.el.className = this.where ? 'teach-tip' : 'teach-tip teach-box';
      s.el.style.setProperty('--c', s.p?.css || '#8a45e0');
      (this.where ? this.game.ui.labels : this.game.ui.root).appendChild(s.el);
    }
    const ok = s.ok > 0;
    const n = this.list.length > 1 || s.steps.length < 2 ? '' : `<b class="tt-n">${s.i + 1}/${s.steps.length}</b>`;
    const html = ok ? `✓ ${esc(t('tut.nice'))}` : `${n}${esc(this.textOf(s, st))}`;
    if (html !== s.html) { s.el.innerHTML = html; s.html = html; s.el.classList.toggle('ok', ok); }
    if (this.where) {
      const pos = this.where(s.p);
      if (!pos) { s.el.style.display = 'none'; s.pos = null; return; }
      // beans standing together: their prompts stack instead of covering each other
      let rank = 0;
      for (const o of this.list) {
        if (o === s) break;
        if (o.pos && o.el?.style.display !== 'none' && Math.abs(o.pos.x - pos.x) < 4 && Math.abs(o.pos.y - pos.y) < 1.2 && Math.abs(o.pos.z - pos.z) < 3) rank = Math.max(rank, (o.rank || 0) + 1);
      }
      s.rank = rank;
      s.pos = pos.clone();
      this.game.ui.place(s.el, _v.copy(pos).setY(pos.y + rank * 0.75), this.scene.camera);
    } else s.el.style.display = '';
  }

  hide(s) {
    s.el?.remove();
    s.el = null;
    s.html = '';
  }

  dispose() {
    for (const s of this.list) this.hide(s);
  }
}

// ---------- the first card ----------

/**
 * "Show me how" or "I know how to play", the first time a tutorial would start. A main.js modal (the game waits
 * behind it, game.askTutorial()). Read aloud. Every player who still needs this tutorial votes with their own
 * device (stick up/down, [OK]; a gamepad's B never picks; a click votes for the first player still to vote; [OK]
 * again takes a vote back); a mark with their colour and symbol shows each choice. The card closes once everyone
 * has voted, or after AUTO seconds (who has not voted counts as "Show me how"). If anyone wants it, it plays:
 * the players who chose "I know how to play" get no steps (marked skipped: their profile, or the device default
 * when no guest wants it), the others do (game.tutLearners[id], read by StepTeacher).
 */
export const AUTO = 30;
export class TutorialCard {
  constructor(game, { id, title, players, onAnswer }) {
    addCss();
    this.game = game;
    this.id = id;
    this.title = title;
    this.players = players;
    this.onAnswer = onAnswer;
    this.t = 0;
    this.items = ['show', 'skip'];
    // who votes: the players who still need it and have a controller (at least one)
    const need = players.filter((p) => playerWants(game, p, id));
    this.voters = (need.length ? need : players).map((p) => ({ p, sel: 0, vote: null }));
    this.el = game.ui.panel('', 'panel pause offer-panel tut-panel');
    this.el.addEventListener('click', (ev) => {
      const i = [...this.el.querySelectorAll('.pause-item')].indexOf(ev.target.closest('.pause-item'));
      const v = this.voters.find((x) => !x.vote);
      if (i >= 0 && v && this.t > 0.4) { v.sel = i; this.vote(v); }
    });
    this.render();
    game.audio.play('select');
    if (voiceOn()) say(`${title}. ${t('tut.ask')} ${t('tut.show')}? ${t('tut.skip')}?`, 'narrator');
  }

  get solo() { return this.voters.length === 1; }

  render() {
    if (!this.el) return;
    const items = this.items.map((k, i) => {
      const chips = this.voters.filter((v) => (v.vote ? this.items.indexOf(v.vote) : v.sel) === i).map((v) => {
        const p = v.p;
        const mark = v.vote ? ' ✓' : ` <small>${esc(tFor(p, 'tut.chipOk'))}</small>`;
        return `<span class="ball-pick tut-chip ${v.vote ? 'done' : ''}" style="--c:${p.css || '#8a45e0'}">${symHtml(p)}${esc(p.name || '')}${mark}</span>`;
      }).join('');
      const on = this.solo ? this.voters[0].sel === i : this.voters.some((v) => !v.vote && v.sel === i);
      return `<div class="pause-item ${on ? 'on' : ''}">${esc(t(`tut.${k}`))}${this.solo ? '' : `<div class="tut-chips">${chips}</div>`}</div>`;
    }).join('');
    const left = Math.ceil(AUTO - this.t);
    const foot = `${esc(t(this.solo ? 'tut.hint' : 'tut.voteHint'))}${left <= 10 ? ` · ${esc(t('tut.startsIn', { n: left }))}` : ''}`;
    this.el.innerHTML = `<div class="offer-icon">👋</div><div class="tut-game">${esc(this.title)}</div><div class="offer-q">${esc(t('tut.ask'))}</div>
      <div class="pause-list">${items}</div><div class="results-footer">${foot}</div>`;
  }

  /** A player locks in (or takes back) their vote. */
  vote(v) {
    v.vote = v.vote ? null : this.items[v.sel];
    this.game.audio.play(v.vote ? 'join' : 'select');
    this.render();
    if (this.voters.every((x) => x.vote)) this.doneT = 0.35; // (everyone has voted: close after a moment, so the last ✓ shows)
  }

  update(dt) {
    this.t += dt;
    if (this.doneT !== undefined) { this.doneT -= dt; if (this.doneT <= 0) this.close(); return; }
    let changed = false;
    for (const v of this.voters) {
      const d = this.game.input.get(v.p.deviceId);
      if (!d) continue;
      if (d.stepY && !v.vote) {
        v.sel = (v.sel - d.stepY + 2) % 2;
        changed = true;
        this.game.audio.play('select');
        if (voiceOn()) say(this.solo ? t(`tut.${this.items[v.sel]}`) : `${v.p.name}: ${t(`tut.${this.items[v.sel]}`)}`, 'narrator');
      }
      if (this.t >= 0.6 && d.okPressed) { this.vote(v); if (this.doneT !== undefined) return; }
    }
    if (this.t > AUTO) { this.close(); return; }
    const sec = Math.ceil(AUTO - this.t);
    if (changed || (sec <= 10 && sec !== this.lastSec)) { this.lastSec = sec; this.render(); }
  }

  /** Count the votes (nobody's vote: "Show me how"), mark the skippers and answer the game. */
  close() {
    if (!this.el) return;
    this.el.remove();
    this.el = null;
    const learners = this.voters.filter((v) => v.vote !== 'skip').map((v) => v.p);
    const skippers = this.voters.filter((v) => v.vote === 'skip').map((v) => v.p);
    // a guest who skips marks the device default only when no guest wants it (guests share it)
    const guestLearns = learners.some((p) => !p.profileId) && !this.game.solo?.profile;
    const mark = skippers.filter((p) => p.profileId || this.game.solo?.profile || !guestLearns);
    if (mark.length) markTutorial(this.game, mark, this.id, true);
    (this.game.tutLearners ||= {})[this.id] = learners.map((p) => p.deviceId);
    const k = learners.length ? 'show' : 'skip';
    if (k === 'skip') this.game.ui.toast(t('tut.skipped'), 2600);
    else if (skippers.length) this.game.ui.toast(t('tut.only', { names: learners.map((p) => p.name).join(', ') }), 2600);
    this.onAnswer?.(k);
  }

  /** (tests, old callers) everyone answers the same. */
  answer(k) {
    for (const v of this.voters) { v.vote = k; v.sel = this.items.indexOf(k); }
    this.close();
  }
}
