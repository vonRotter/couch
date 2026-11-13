// The genre passport: video-game genres (a stamp each) and play skills (bronze / silver / gold), per profile.
//
// The aim (owner, development step 3): the game teaches children to play video games. Every game, island
// activity and guest game belongs to one GENRE and trains two or three SKILLS (the table GAMES below; the same
// mapping is written out in GENRES.md).
//
// How things are earned:
//   - a STAMP for a genre the first time you play one of its games properly (a level cleared, a match or a
//     round finished, a first fish caught; a guest game in the Game Hall: launching it, that is all we can see);
//   - BRONZE in every skill of a game you played properly;
//   - SILVER with 3 mastery points in that skill, GOLD with 8 mastery points from at least 2 different games.
//     A mastery point is one thing done well, counted once each (Sky Hop level 2 cleared, a Bean Brigade battle
//     won, a lamp crystal brought back, a new fish species...), so the same easy level never counts twice;
//   - Coach's TRIALS (TRIALS below): a short optional challenge raises its skill straight to silver or gold.
//
// Where the facts come from: games report what happened with report(scene, event, data) (MiniGame.finish()
// reports 'finish' with the scene's passportStats(), assist.js overcame() reports 'overcame', the island reports
// its activities), and syncProgress() reads the profile's saved game progress when the solo island loads (so
// old saves get the stamps they already earned, and games that keep their own save need no hook).
//
// Saved per profile in this browser only (localStorage 'couch-party.passport.<id>'): stamps, games played,
// mastery points, trials, play time per day (the parent page) and the help offers taken. Nothing leaves the
// device. Profiles saved before this existed simply start with an empty passport (plus what syncProgress finds).
// Guests earn nothing; on the shared island every player who joined as a profile is credited.

import { t } from './i18n.js';
import './passport-strings.js';
import { ISLANDS as BREACH_ISLANDS } from '../scenes/breach/levels.js';

const CLOVER_BATTLES = BREACH_ISLANDS[0].battles.length; // Bean Brigade: Clover Isle cleared

export const SKILLS = [
  { id: 'timing', icon: '⏱️' },
  { id: 'aiming', icon: '🎯' },
  { id: 'steering', icon: '🕹️' },
  { id: 'exploring', icon: '🧭' },
  { id: 'puzzles', icon: '🧩' },
  { id: 'planning', icon: '♟️' },
  { id: 'building', icon: '🧱' },
  { id: 'reading', icon: '👀' },
  { id: 'teamwork', icon: '🤝' },
];
export const SKILL_IDS = SKILLS.map((s) => s.id);
export const MEDALS = ['', '🥉', '🥈', '🥇'];
export const LEVEL_NAMES = ['none', 'bronze', 'silver', 'gold'];
export const SILVER_AT = 3, GOLD_AT = 8, GOLD_GAMES = 2;

/** Genres: icon, stamp colour, and the game whose 3D icon is the card's picture (hub-icons.js; null: the emoji). */
export const GENRES = [
  { id: 'platformer', icon: '🦘', css: '#ff9f1c', pic: 'platformer' },
  { id: 'adventure', icon: '🗡️', css: '#3a9a5a', pic: 'lighthouse' },
  { id: 'pointclick', icon: '🔍', css: '#8a5a32', pic: 'adventure' },
  { id: 'puzzle', icon: '🧩', css: '#4cc9f0', pic: 'guides' },
  { id: 'tactics', icon: '♟️', css: '#5a4dc0', pic: 'splash' },
  { id: 'rpg', icon: '🛡️', css: '#b5179e', pic: 'keep' },
  { id: 'roguelite', icon: '💎', css: '#2e8fa8', pic: 'cave' },
  { id: 'shooter', icon: '🎯', css: '#e0457a', pic: 'duckhunt' },
  { id: 'racing', icon: '🏁', css: '#ff5d73', pic: 'kart' },
  { id: 'sports', icon: '⚽', css: '#2fae62', pic: 'football' },
  { id: 'builder', icon: '🧱', css: '#c9772e', pic: 'castle' },
  { id: 'party', icon: '🎉', css: '#9b5de5', pic: 'party' },
  { id: 'life', icon: '🌱', css: '#6aa82a', pic: null },
  { id: 'learning', icon: '📚', css: '#2f7fd0', pic: 'spelling' },
];
export const GENRE_IDS = GENRES.map((g) => g.id);

/**
 * Every game -> { genre, skills, where, name? }. where: 'solo' (a place on the solo island), 'island' (an island
 * activity), 'hall' (a Game Hall guest game: only the launch is seen), 'school', 'coop' (the shared island).
 * name: an i18n key for things that are not a game in GAMES (main.js); else 'game.<key>'.
 * after: what it builds on (suggestions: Coach and the map suggest a game once these are played, never forced).
 * place: the solo island place id or map marker key (suggestions show the way there).
 */
export const GAMES = {
  // the solo island's places
  platformer: { genre: 'platformer', skills: ['timing', 'steering'], where: 'solo', place: 'place:balloon' },
  lighthouse: { genre: 'adventure', skills: ['exploring', 'puzzles', 'reading'], where: 'solo', place: 'place:lighthouse', after: ['platformer'] },
  adventure: { genre: 'pointclick', skills: ['puzzles', 'exploring'], where: 'solo', place: 'place:ship' },
  duckhunt: { genre: 'shooter', skills: ['aiming', 'timing'], where: 'solo', place: 'place:tent' },
  cave: { genre: 'roguelite', skills: ['exploring', 'timing', 'planning'], where: 'solo', place: 'place:mine', after: ['platformer'] },
  guides: { genre: 'puzzle', skills: ['puzzles', 'planning'], where: 'solo', place: 'place:burrow' },
  breach: { genre: 'tactics', skills: ['planning', 'reading'], where: 'solo', place: 'place:garage', after: ['guides'] },
  castle: { genre: 'builder', skills: ['building', 'planning', 'teamwork'], where: 'solo', place: 'place:castle', after: ['guides'] },
  keepsolo: { genre: 'rpg', skills: ['reading', 'planning'], where: 'solo', place: 'place:keep', after: ['lighthouse'] },
  school: { genre: 'learning', skills: ['puzzles'], where: 'school', place: 'place:school', name: 'pp.g.school' },
  // the Game Hall's guest games (other repos: only the launch is seen). Foothold is XCOM-style tactics and Starlite a
  // real-time strategy game (owner); Tachyon and Starhop are a best guess, see GENRES.md
  tachyon: { genre: 'racing', skills: ['steering', 'aiming'], where: 'hall', place: 'place:hall', after: ['platformer'] },
  starlite: { genre: 'tactics', skills: ['planning', 'building'], where: 'hall', place: 'place:hall', after: ['breach'] }, // a real-time strategy game (StarCraft-like)
  foothold: { genre: 'tactics', skills: ['planning', 'reading'], where: 'hall', place: 'place:hall', after: ['breach'] }, // an XCOM-style tactics game
  starhop: { genre: 'adventure', skills: ['exploring', 'steering'], where: 'hall', place: 'place:hall', after: ['lighthouse'] },
  // island activities
  farm: { genre: 'life', skills: ['planning'], where: 'island', place: 'home', name: 'pp.g.farm' },
  fishing: { genre: 'life', skills: ['timing'], where: 'island', place: 'npc:grumbleton', name: 'pp.g.fishing' },
  dive: { genre: 'life', skills: ['exploring'], where: 'island', place: 'place:dive', name: 'pp.g.dive' },
  cafe: { genre: 'life', skills: ['planning', 'timing'], where: 'island', place: 'cafe', name: 'pp.g.cafe' },
  build: { genre: 'builder', skills: ['building'], where: 'island', place: 'home', name: 'pp.g.build' },
  hops: { genre: 'platformer', skills: ['timing', 'steering'], where: 'island', place: 'trail:', name: 'pp.g.hops', after: ['platformer'] },
  stones: { genre: 'party', skills: ['timing'], where: 'island', place: 'game:stones', name: 'pp.g.stones' },
  kite: { genre: 'party', skills: ['steering'], where: 'island', place: 'game:kite', name: 'pp.g.kite' },
  islplay: { genre: 'party', skills: ['exploring', 'aiming'], where: 'island', name: 'pp.g.islplay' }, // tag, hide-and-seek, snowballs with villagers
  // the shared island (co-op; also the learning games there)
  bubble: { genre: 'platformer', skills: ['timing', 'teamwork', 'reading'], where: 'coop' },
  runner: { genre: 'platformer', skills: ['timing', 'steering'], where: 'coop' },
  portal: { genre: 'puzzle', skills: ['puzzles', 'teamwork'], where: 'coop' },
  splash: { genre: 'tactics', skills: ['aiming', 'planning'], where: 'coop' },
  keep: { genre: 'rpg', skills: ['reading', 'teamwork'], where: 'coop' },
  spacefall: { genre: 'shooter', skills: ['aiming', 'steering'], where: 'coop' },
  dogfight: { genre: 'shooter', skills: ['aiming', 'steering'], where: 'coop' },
  snowball: { genre: 'shooter', skills: ['aiming', 'teamwork'], where: 'coop' },
  kart: { genre: 'racing', skills: ['steering', 'timing'], where: 'coop' },
  slalom: { genre: 'racing', skills: ['steering', 'timing'], where: 'coop' },
  space: { genre: 'racing', skills: ['steering'], where: 'coop' },
  football: { genre: 'sports', skills: ['teamwork', 'steering'], where: 'coop' },
  hockey: { genre: 'sports', skills: ['teamwork', 'aiming'], where: 'coop' },
  golf: { genre: 'sports', skills: ['aiming', 'planning'], where: 'coop' },
  party: { genre: 'party', skills: ['timing', 'reading'], where: 'coop' },
  brawl: { genre: 'party', skills: ['reading', 'timing'], where: 'coop' },
  paint: { genre: 'party', skills: ['steering', 'aiming'], where: 'coop' },
  hideseek: { genre: 'party', skills: ['exploring', 'reading'], where: 'coop' },
  cook: { genre: 'party', skills: ['teamwork', 'planning'], where: 'coop' },
  boss0: { genre: 'platformer', skills: ['timing', 'teamwork'], where: 'coop', name: 'pp.g.boss' },
  boss1: { genre: 'shooter', skills: ['aiming', 'teamwork'], where: 'coop', name: 'pp.g.boss' },
  boss2: { genre: 'party', skills: ['teamwork', 'planning'], where: 'coop', name: 'pp.g.boss' },
  boss3: { genre: 'racing', skills: ['steering', 'teamwork'], where: 'coop', name: 'pp.g.boss' },
  spelling: { genre: 'learning', skills: ['puzzles'], where: 'coop' },
  math: { genre: 'learning', skills: ['puzzles'], where: 'coop' },
  learnmix: { genre: 'learning', skills: ['puzzles'], where: 'coop' },
};

/** The order Coach suggests things in on the solo island (each after what it builds on; nothing is ever locked by it). */
export const PATH = ['farm', 'platformer', 'fishing', 'duckhunt', 'school', 'stones', 'adventure', 'hops', 'kite', 'guides', 'cave', 'lighthouse',
  'breach', 'build', 'dive', 'cafe', 'castle', 'keepsolo', 'tachyon', 'starlite', 'foothold', 'starhop'];

export const gameName = (key) => t(GAMES[key]?.name || `game.${key}`);
export const genreOf = (key) => GAMES[key]?.genre || null;

/**
 * Coach's trials: { id, skill, level (2 silver, 3 gold), game (where to try it) }. Text: pp.tr.<id>. Each is
 * detected by a game event (report()) or from saved progress (syncProgress()): see the rules below.
 */
export const TRIALS = [
  { id: 'sky.clean', skill: 'timing', level: 2, game: 'platformer' }, // a Sky Hop level cleared without anyone falling
  { id: 'fish.three', skill: 'timing', level: 3, game: 'fishing' }, // 3 fish in a row, every press in the green zone
  { id: 'duck.r3', skill: 'aiming', level: 2, game: 'duckhunt' }, // Laser Ducks: reach round 3
  { id: 'duck.perfect', skill: 'aiming', level: 3, game: 'duckhunt' }, // Laser Ducks: all ten ducks of a round
  { id: 'hop.clean', skill: 'steering', level: 2, game: 'hops' }, // a hop trail without falling off
  { id: 'hop.race', skill: 'steering', level: 3, game: 'hops' }, // win a hop race against a villager
  { id: 'lh.piece', skill: 'exploring', level: 2, game: 'lighthouse' }, // Lighthouse Caves: a heart piece
  { id: 'chests.three', skill: 'exploring', level: 3, game: 'hops' }, // 3 hidden treasure chests on your island
  { id: 'guides.three', skill: 'puzzles', level: 2, game: 'guides' }, // Grumble Guides: 3 stars on a level
  { id: 'adv.noskip', skill: 'puzzles', level: 3, game: 'adventure' }, // Pudding Island: scene 1 without a skipped puzzle
  { id: 'breach.clean', skill: 'planning', level: 2, game: 'breach' }, // Bean Brigade: a battle won without a house hit
  { id: 'breach.isle', skill: 'planning', level: 3, game: 'breach' }, // Bean Brigade: Clover Isle cleared
  { id: 'castle.three', skill: 'building', level: 2, game: 'castle' }, // the Golden Bean: 3 stars on a level
  { id: 'build.ten', skill: 'building', level: 3, game: 'build' }, // 10 things built in your yard
  { id: 'ks.teddy', skill: 'reading', level: 2, game: 'keepsolo' }, // Pillow Keep Solo: Big Teddy asleep (act 1)
  { id: 'lh.crystals', skill: 'reading', level: 3, game: 'lighthouse' }, // Lighthouse Caves: two lamp crystals back
  { id: 'coop.one', skill: 'teamwork', level: 2, game: 'coop' }, // finish a game together on the shared island
  { id: 'coop.five', skill: 'teamwork', level: 3, game: 'coop' }, // finish 5 different games together
];
export const trialById = (id) => TRIALS.find((x) => x.id === id) || null;

// ---------- the store ----------

const KEY = (id) => `couch-party.passport.${id}`;
const DAYS_KEPT = 60;

export function freshPassport() {
  return {
    v: 1,
    stamps: {}, // genre -> { at, game }
    games: {}, // game key -> { plays, proper, first, last }
    mastery: {}, // skill -> { 'game:what': at }
    trials: {}, // trial id -> at
    coop: {}, // co-op games finished together (2+ players): key -> at
    streak: {}, // running counts for trials (fish in a row)
    days: {}, // 'YYYY-MM-DD' -> { s: seconds, g: { key: seconds } }
    assists: [], // help offers taken: [{ kind, game, at }] (the newest 40)
    coach: { met: false, handed: {}, trial: null, told: {} }, // stamps Coach has handed out, the trial he gave
  };
}

/** Old or partial saves get every field (save compatibility). */
function clean(P) {
  const f = freshPassport();
  const out = P && typeof P === 'object' ? P : f;
  for (const k of Object.keys(f)) if (out[k] === undefined || out[k] === null || typeof out[k] !== typeof f[k] || Array.isArray(out[k]) !== Array.isArray(f[k])) out[k] = f[k];
  for (const k of Object.keys(f.coach)) if (out.coach[k] === undefined || (out.coach[k] === null && k !== 'trial')) out.coach[k] = f.coach[k];
  return out;
}

const cache = new Map();
export function loadPassport(id) {
  if (!id) return null;
  if (!cache.has(id)) {
    let P = null;
    try { P = JSON.parse(localStorage.getItem(KEY(id))); } catch { P = null; }
    cache.set(id, clean(P));
  }
  return cache.get(id);
}
export function savePassport(id, P = loadPassport(id)) {
  if (!id || !P) return;
  try { localStorage.setItem(KEY(id), JSON.stringify(P)); } catch { /* storage unavailable */ }
}
/** Forget cached passports (tests, or after storage changed outside). */
export function resetPassportCache() { cache.clear(); }

// ---------- levels ----------

/** A game played properly counts for its skills; co-op play with friends counts for teamwork. */
function bronze(P, skill) {
  if (skill === 'teamwork' && Object.keys(P.coop).length) return true;
  return Object.entries(P.games).some(([k, g]) => g.proper && GAMES[k]?.skills.includes(skill));
}

/** 0 none, 1 bronze, 2 silver, 3 gold. */
export function skillLevel(P, skill) {
  if (!P) return 0;
  let lv = bronze(P, skill) ? 1 : 0;
  const keys = Object.keys(P.mastery[skill] || {});
  const games = new Set(keys.map((k) => k.split(':')[0]));
  if (lv && keys.length >= SILVER_AT) lv = 2;
  if (lv && keys.length >= GOLD_AT && games.size >= GOLD_GAMES) lv = 3;
  for (const tr of TRIALS) if (tr.skill === skill && P.trials[tr.id]) lv = Math.max(lv, tr.level);
  return lv;
}
export const masteryCount = (P, skill) => Object.keys(P?.mastery?.[skill] || {}).length;

/** What the passport shows: stamps, levels, trials (a snapshot to compare before/after). */
function snapshot(P) {
  return { stamps: new Set(Object.keys(P.stamps)), levels: Object.fromEntries(SKILL_IDS.map((s) => [s, skillLevel(P, s)])), trials: new Set(Object.keys(P.trials)) };
}
function news(before, P) {
  const out = [];
  for (const g of Object.keys(P.stamps)) if (!before.stamps.has(g)) out.push({ kind: 'stamp', genre: g });
  for (const id of Object.keys(P.trials)) if (!before.trials.has(id)) out.push({ kind: 'trial', id });
  for (const s of SKILL_IDS) { const lv = skillLevel(P, s); if (lv > before.levels[s]) out.push({ kind: 'skill', skill: s, level: lv }); }
  return out;
}

// ---------- recording ----------

const now = () => Date.now();

/** A game was played (properly or not). */
function played(P, key, proper = true) {
  const G = GAMES[key];
  if (!G) return;
  const g = (P.games[key] ||= { plays: 0, proper: 0, first: 0, last: 0 });
  g.plays++;
  g.last = now();
  if (!proper) return;
  g.proper++;
  if (!g.first) g.first = now();
  if (!P.stamps[G.genre]) P.stamps[G.genre] = { at: now(), game: key };
}
/** A properly-played mark from saved progress (no extra play counted when it is already there). */
function playedOnce(P, key) {
  if (P.games[key]?.proper) return;
  played(P, key, true);
}
function master(P, key, what, skills = GAMES[key]?.skills || []) {
  for (const s of skills) {
    const m = (P.mastery[s] ||= {});
    const k = `${key}:${what}`;
    if (!m[k]) m[k] = now();
  }
}
function trial(P, id) {
  if (!P.trials[id] && trialById(id)) P.trials[id] = now();
}

/**
 * What one event means for a passport (pure, for tests too). ev: 'finish' (MiniGame results: d.key, d.n players,
 * the scene's passportStats()), 'overcame' (d.part), 'fish' (d.ok, d.clean), 'hop' (d.id, d.falls, d.won),
 * 'breach.win' (d.clean, d.step), 'launch' (d.key: a guest game), 'island' (d.key: an island activity done,
 * d.what: a mastery point, optional).
 */
export function apply(P, ev, d = {}) {
  switch (ev) {
    case 'finish': {
      const key = d.key;
      if (!GAMES[key]) return;
      const proper = d.proper !== false; // a game can say a finish did not count (lost the first level)
      played(P, key, proper);
      if (proper && d.n >= 2 && d.shared) {
        if (!P.coop[key]) P.coop[key] = now();
        master(P, 'coop', key, ['teamwork']);
        trial(P, 'coop.one');
        if (Object.keys(P.coop).length >= 5) trial(P, 'coop.five');
      }
      for (const w of d.mastery || []) master(P, key, w);
      if (key === 'platformer' && d.cleared && d.falls === 0) trial(P, 'sky.clean');
      if (key === 'duckhunt' && d.round >= 3) trial(P, 'duck.r3');
      if (key === 'duckhunt' && d.perfects > 0) trial(P, 'duck.perfect');
      if (key === 'guides' && d.stars >= 3) trial(P, 'guides.three');
      if (key === 'castle' && d.stars >= 3) trial(P, 'castle.three');
      return;
    }
    case 'overcame': {
      const part = String(d.part || '');
      if (part.startsWith('sky.')) { playedOnce(P, 'platformer'); master(P, 'platformer', `lv${part.slice(4)}`); }
      else if (part === 'skipstones') { playedOnce(P, 'stones'); }
      else if (part.startsWith('ks.')) playedOnce(P, 'keepsolo');
      return;
    }
    case 'fish': {
      if (d.ok) {
        played(P, 'fishing', true);
        if (d.species) master(P, 'fishing', `sp.${d.species}`);
        P.streak.fish = d.clean ? (P.streak.fish || 0) + 1 : 0;
        if (P.streak.fish >= 3) trial(P, 'fish.three');
      } else P.streak.fish = 0;
      return;
    }
    case 'hop': {
      played(P, 'hops', true);
      master(P, 'hops', `trail.${d.id}`);
      if (d.falls === 0) { trial(P, 'hop.clean'); master(P, 'hops', `clean.${d.id}`); }
      if (d.won) trial(P, 'hop.race');
      return;
    }
    case 'breach.win': {
      playedOnce(P, 'breach');
      if (d.clean) trial(P, 'breach.clean');
      return;
    }
    case 'launch': played(P, d.key, true); return;
    case 'island': {
      if (!GAMES[d.key]) return;
      played(P, d.key, true);
      if (d.what) master(P, d.key, d.what);
      return;
    }
  }
}

/**
 * Read a profile's saved progress (roster.progress of its solo save): stamps, mastery and trials the games'
 * own saves already show. Idempotent; old saves get credit for what they have done.
 */
export function syncProgress(P, p = {}) {
  const isl = p.island || {};
  // (a part skipped with "Help me play" opens the next one but is not counted as done)
  const sky = p.skyhop || 0, skySkip = new Set(p.skipped?.skyhop || []);
  for (let i = 0; i < sky; i++) if (!skySkip.has(i)) { playedOnce(P, 'platformer'); master(P, 'platformer', `lv${i}`); }
  const lh = p.lighthouse;
  if (lh && (lh.crystals > 0 || Object.keys(lh.items || {}).length || Object.keys(lh.solved || {}).length)) {
    playedOnce(P, 'lighthouse');
    for (let i = 0; i < (lh.crystals || 0); i++) master(P, 'lighthouse', `crystal${i}`);
    for (const id of Object.keys(lh.bosses || {})) master(P, 'lighthouse', `boss.${id}`, ['reading']);
    for (let i = 0; i < Math.floor((lh.pieces || 0) / 2); i++) master(P, 'lighthouse', `pieces${i}`, ['exploring']);
    if (lh.pieces >= 1) trial(P, 'lh.piece');
    if (lh.crystals >= 2) trial(P, 'lh.crystals');
  }
  const adv = p.adventure;
  if (adv?.done) {
    playedOnce(P, 'adventure');
    master(P, 'adventure', 'scene1');
    if (!(p.skipped?.adventure || []).length) trial(P, 'adv.noskip');
  }
  if (adv?.done2) master(P, 'adventure', 'scene2');
  const dh = p.duckhunt;
  if (dh?.best > 0) playedOnce(P, 'duckhunt');
  for (const r of [2, 4, 6, 8]) if ((dh?.bestRound || 0) >= r) master(P, 'duckhunt', `round${r}`);
  if ((dh?.bestRound || 0) >= 3) trial(P, 'duck.r3');
  const gs = p.guides?.stars || [];
  if (gs.some((s) => s > 0)) playedOnce(P, 'guides');
  gs.forEach((s, i) => { if (s >= 2) master(P, 'guides', `lv${i}`); });
  if (gs.some((s) => s >= 3)) trial(P, 'guides.three');
  const cc = p.castleCampaign;
  if (cc?.won?.some(Boolean)) playedOnce(P, 'castle');
  (cc?.won || []).forEach((w, i) => { if (w) master(P, 'castle', `lv${i}`); });
  if ((cc?.stars || []).some((s) => s >= 3)) trial(P, 'castle.three');
  const br = p.breach;
  if (br?.bestBattles > 0) playedOnce(P, 'breach');
  for (let i = 1; i <= (br?.bestBattles || 0); i++) master(P, 'breach', `battle${i}`);
  if ((br?.bestBattles || 0) >= CLOVER_BATTLES) trial(P, 'breach.isle');
  const ks = p.keepSolo?.summary;
  if (ks && (ks.best > 1 || ks.acts > 0)) playedOnce(P, 'keepsolo');
  const ksSkip = p.skipped?.keepsolo || [];
  for (let i = 0; i < (ks?.acts || 0) - ksSkip.length; i++) master(P, 'keepsolo', `act${i}`);
  for (const lv of [5, 10, 15]) if ((ks?.best || 0) >= lv) master(P, 'keepsolo', `hero${lv}`, ['planning']);
  if (ks?.act1 && !ksSkip.includes('act0')) trial(P, 'ks.teddy'); // (acts count from 0 in the skip marks)
  const sc = p.school;
  if (sc && Object.values(sc.plays || {}).some((n) => n > 0)) playedOnce(P, 'school');
  for (const [id, n] of Object.entries(sc?.plays || {})) if (n > 0 && (sc.levels?.[id] || 0) >= 1) master(P, 'school', id);
  // the island itself
  if (isl.stats?.harvested >= 1) playedOnce(P, 'farm');
  for (const n of [10, 50, 200]) if ((isl.stats?.harvested || 0) >= n) master(P, 'farm', `harvest${n}`);
  if (isl.sea?.caught > 0) playedOnce(P, 'fishing');
  for (const id of Object.keys(isl.sea?.log || {})) master(P, 'fishing', `sp.${id}`);
  const yard = Array.isArray(isl.yard) ? isl.yard.length : 0;
  if (yard >= 1) playedOnce(P, 'build');
  for (const n of [3, 6, 10, 15]) if (yard >= n) master(P, 'build', `yard${n}`);
  if (yard >= 10) trial(P, 'build.ten');
  const H = isl.hops || {};
  for (const id of Object.keys(H.best || {})) { playedOnce(P, 'hops'); master(P, 'hops', `trail.${id}`); }
  if (Object.values(H.wins || {}).some((n) => n > 0)) trial(P, 'hop.race');
  const chests = Object.keys(H.chests || {}).length;
  for (let i = 0; i < chests; i++) master(P, 'hops', `chest${i}`, ['exploring']);
  if (chests >= 3) trial(P, 'chests.three');
  if (isl.cafe?.served > 0) playedOnce(P, 'cafe');
  if (isl.sea?.dives > 0) playedOnce(P, 'dive');
  for (const n of [5, 20]) if ((isl.sea?.dives || 0) >= n) master(P, 'dive', `dives${n}`);
  for (const n of [10, 50]) if ((isl.cafe?.served || 0) >= n) master(P, 'cafe', `served${n}`);
}

// ---------- who gets the credit ----------

/** The profiles an event counts for: the solo profile, the given player's profile, or everyone who joined as one. */
export function creditIds(game, player = null) {
  if (!game) return [];
  if (game.solo?.profile) return [game.solo.profile.id];
  if (player) return player.profileId ? [player.profileId] : [];
  return [...new Set((game.roster?.players || []).filter((p) => p.profileId).map((p) => p.profileId))];
}

/**
 * Games report what happened. scene: a scene, the island host or the Game (anything with .game, or the game).
 * Returns the news (new stamps, levels, trials) for the first credited profile; toasts them (game.ui) unless quiet.
 */
export function report(scene, ev, data = {}, { player = null, quiet = false } = {}) {
  const game = scene?.game || scene;
  if (ev === 'overcame' && !/^(sky\.|skipstones$|ks\.)/.test(String(data.part || ''))) return []; // (a hit, a try: nothing to note)
  const ids = creditIds(game, player);
  let first = null;
  for (const id of ids) {
    const P = loadPassport(id);
    const before = snapshot(P);
    apply(P, ev, { ...data, shared: !game.solo });
    const got = news(before, P);
    savePassport(id, P);
    if (!first) first = got;
  }
  if (first?.length && !quiet) announce(game, first);
  return first || [];
}

/** Read the solo profile's saved progress into its passport (the island calls it when it loads). */
export function syncProfile(game, { quiet = true } = {}) {
  const id = game?.solo?.profile?.id;
  if (!id) return [];
  const P = loadPassport(id);
  const before = snapshot(P);
  syncProgress(P, game.roster.progress);
  const got = news(before, P);
  savePassport(id, P);
  if (got.length && !quiet) announce(game, got);
  return got;
}

/** A short toast per piece of news (stamps first). */
export function announce(game, list) {
  if (!game?.ui) return;
  const order = { stamp: 0, trial: 1, skill: 2 };
  const msgs = [...list].sort((a, b) => order[a.kind] - order[b.kind]).map(newsText);
  game.ui.toast(msgs.slice(0, 3).join(' · '), 3600);
  game.audio?.play?.('star');
}
export function newsText(n) {
  if (n.kind === 'stamp') return `${GENRES.find((g) => g.id === n.genre)?.icon || '📘'} ${t('pp.t.stamp', { genre: t(`pp.genre.${n.genre}`) })}`;
  if (n.kind === 'trial') return `🏆 ${t('pp.t.trial', { trial: t(`pp.tr.${n.id}`) })}`;
  return `${MEDALS[n.level]} ${t('pp.t.skill', { skill: t(`pp.skill.${n.skill}`), level: t(`pp.lv.${LEVEL_NAMES[n.level]}`) })}`;
}

// ---------- help offers taken (the parent page) ----------

export function logAssist(id, kind, gameKey) {
  if (!id) return;
  const P = loadPassport(id);
  P.assists.push({ kind, game: gameKey || '', at: now() });
  if (P.assists.length > 40) P.assists.splice(0, P.assists.length - 40);
  savePassport(id, P);
}

// ---------- play time per profile per day ----------

/** 'YYYY-MM-DD' in local time. */
export function dayOf(ms = now()) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const pending = new Map(); // profile id -> { s, g: { key: s } } not written yet
let flushT = 0;
export const IDLE_AFTER = 180; // seconds without a button press: not counted as playing

/**
 * main.js calls this every frame with real seconds: time counts for the profiles playing (the solo profile, or
 * every profile joined on the shared island), by what is on screen (scene key; the solo island is 'island').
 * Written to storage every 20 seconds and on flushPlayTime().
 */
export function tickPlayTime(game, dt, { key = null, idle = 0 } = {}) {
  if (dt <= 0 || idle > IDLE_AFTER) return;
  const ids = creditIds(game);
  for (const id of ids) {
    const e = pending.get(id) || { s: 0, g: {} };
    e.s += dt;
    if (key) e.g[key] = (e.g[key] || 0) + dt;
    pending.set(id, e);
  }
  flushT += dt;
  if (flushT >= 20) flushPlayTime();
}
export function flushPlayTime(at = now()) {
  flushT = 0;
  const day = dayOf(at);
  for (const [id, e] of pending) {
    const P = loadPassport(id);
    const D = (P.days[day] ||= { s: 0, g: {} });
    D.s = Math.round((D.s + e.s) * 10) / 10;
    for (const [k, s] of Object.entries(e.g)) D.g[k] = Math.round(((D.g[k] || 0) + s) * 10) / 10;
    // keep the last DAYS_KEPT days
    const keys = Object.keys(P.days).sort();
    while (keys.length > DAYS_KEPT) delete P.days[keys.shift()];
    savePassport(id, P);
  }
  pending.clear();
}

/** The last n days (oldest first): [{ day, s, g }]. */
export function lastDays(P, n = 14, at = now()) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(at);
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const k = dayOf(d.getTime());
    out.push({ day: k, date: d, s: P?.days?.[k]?.s || 0, g: P?.days?.[k]?.g || {} });
  }
  return out;
}

// ---------- suggestions ----------

/**
 * What to try next on the solo island (Coach and the map): the first thing on PATH not played properly yet whose
 * "after" games are played, preferring open ones (avail(key) -> { open, why }) and ones that train the weakest skill.
 * Returns { key, from, skill, open, why } (from: a game you played that shares a skill) or { trial } when
 * everything has been played, or null.
 */
export function suggestNext(P, avail = () => ({ open: true })) {
  if (!P) return null;
  const done = (k) => !!P.games[k]?.proper;
  const levels = Object.fromEntries(SKILL_IDS.map((s) => [s, skillLevel(P, s)]));
  let best = null, bestScore = Infinity;
  PATH.forEach((key, i) => {
    if (done(key)) return;
    const G = GAMES[key];
    const a = avail(key) || { open: true };
    if (a.hidden) return;
    const ready = (G.after || []).every(done);
    const weakest = Math.min(...G.skills.map((s) => levels[s]));
    const score = (ready ? 0 : 100) + (a.open ? 0 : 50) + i - (weakest === 0 ? 3 : 0);
    if (score < bestScore) { bestScore = score; best = { key, open: !!a.open, why: a.why || '' }; }
  });
  if (best) {
    const G = GAMES[best.key];
    // what it builds on: a game you played properly that trains one of the same skills (its "after" first)
    const prior = [...(G.after || []), ...Object.keys(P.games)].filter((k) => done(k) && k !== best.key);
    for (const k of prior) {
      const s = GAMES[k]?.skills.find((x) => G.skills.includes(x));
      if (s) { best.from = k; best.skill = s; break; }
    }
    return best;
  }
  // everything played: the next trial (the weakest skill first), at a game you can reach
  const open = TRIALS.filter((tr) => !P.trials[tr.id] && (avail(tr.game)?.open ?? true) && levels[tr.skill] < tr.level);
  open.sort((a, b) => levels[a.skill] - levels[b.skill] || a.level - b.level);
  return open.length ? { trial: open[0].id } : null;
}

/** Trials worth trying now: not done, raising a skill (weakest skills first), at most n. */
export function openTrials(P, n = 3, avail = () => ({ open: true })) {
  const levels = Object.fromEntries(SKILL_IDS.map((s) => [s, skillLevel(P, s)]));
  return TRIALS.filter((tr) => !P.trials[tr.id] && levels[tr.skill] < tr.level && (avail(tr.game)?.open ?? true))
    .sort((a, b) => a.level - b.level || levels[a.skill] - levels[b.skill]).slice(0, n);
}
