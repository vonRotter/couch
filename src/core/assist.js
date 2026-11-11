// "Help me play": the accessibility settings (assists). Accessible, not easy: the challenge stays, access widens.
//
// Saved per profile (profile.assist, the same in every game), so a child's settings follow them to their own
// island and to the shared island. Guests, the shared island and the start screen use the device default
// (localStorage 'couch-party.assist', editable from the shared island's menu). Everything is off by default;
// profiles saved before this existed simply get the defaults.
//
// Per player (follow the player who plays): forgiving timing, aim help, hold to toggle, button remapping.
// For the whole screen (one shared screen): game speed, text size, outlines, reduce flashing and shake. On a profile's own island that is
// the profile's choice; on the shared island the most help anyone playing asked for (slowest speed, biggest
// text, outlines if anyone wants them), starting from the device default.
//
// Games ask with the helpers below: timingScale(p), aimLevel(p), aimAt(...), homeToward(...), gameSpeed(game)
// and report trouble with struggle(scene, p, kind, part) / overcame(scene, part) (see the offer logic below).

import * as THREE from 'three';
import { listProfiles, setProfileAssist } from './profiles.js';

export const SPEEDS = [1, 0.9, 0.75, 0.6, 0.5];
export const TEXT_SIZES = [1, 1.25, 1.5];
export const AIM_LEVELS = 3; // 0 off, 1 a little, 2 a lot

export const DEFAULTS = Object.freeze({
  speed: 1, // game speed (1 = 100 %)
  timing: false, // forgiving timing: wider windows, longer telegraphs
  aim: 0, // aim help: 0 off, 1 a little, 2 a lot
  aimChosen: false, // aim was picked on purpose (else each game's default: off, the snowball fight "a little")
  toggle: false, // hold to toggle: tap a held button on, tap again off
  text: 0, // text size: index into TEXT_SIZES
  contrast: false, // strong outlines on important things, shapes as well as colours
  calm: false, // reduce flashing and shake: no fast blinking (a soft glow or a slow pulse) and no camera shake
  offers: true, // the game may offer help after repeated tries
  never: [], // offers answered with "don't ask again" ('timing', 'aim', 'speed', 'skip')
  keys: {}, // keyboard remaps per scheme: { kb0: { a: 'Space', b: 'KeyE', c: 'KeyQ' } }
  pad: null, // gamepad remap: { a: 'b', b: 'a', ... } (game button -> the physical button that does it)
});

const DEVICE_KEY = 'couch-party.assist';

function clean(s) {
  const out = { ...DEFAULTS, ...(s || {}) };
  if (!SPEEDS.includes(out.speed)) out.speed = 1;
  out.aim = Math.max(0, Math.min(AIM_LEVELS - 1, out.aim | 0));
  // settings saved before aimChosen existed: a little / a lot was picked on purpose; off was the default
  if (s && s.aimChosen === undefined) out.aimChosen = out.aim > 0;
  out.aimChosen = !!out.aimChosen;
  out.text = Math.max(0, Math.min(TEXT_SIZES.length - 1, out.text | 0));
  out.never = Array.isArray(out.never) ? out.never : [];
  out.keys = out.keys && typeof out.keys === 'object' ? out.keys : {};
  return out;
}

// cache: profile id (or '' for the device default) -> settings. Reading localStorage every frame is slow.
let cache = new Map();
let version = 0; // bumps on every change (main.js re-applies the screen-wide settings)
export const assistVersion = () => version;

/** The device default (guests, the shared island, the start screen). */
export function deviceSettings() {
  if (!cache.has('')) {
    let s = null;
    try { s = JSON.parse(localStorage.getItem(DEVICE_KEY)); } catch { s = null; }
    cache.set('', clean(s));
  }
  return cache.get('');
}

/** A profile's settings (by id); unknown ids get the device default. */
export function profileSettings(id) {
  if (!id) return deviceSettings();
  if (!cache.has(id)) {
    const prof = listProfiles().find((p) => p.id === id);
    if (!prof) return deviceSettings();
    cache.set(id, clean(prof.assist));
  }
  return cache.get(id);
}

/** The settings a player plays with: their profile's, or the device default for a guest. */
export function settingsFor(player) {
  return profileSettings(player?.profileId || '');
}

/** Save settings for a profile id ('' = the device default). */
export function saveSettings(id, s) {
  const v = clean(s);
  cache.set(id || '', v);
  version++;
  if (!id) {
    try { localStorage.setItem(DEVICE_KEY, JSON.stringify(v)); } catch { /* storage unavailable */ }
    return v;
  }
  setProfileAssist(id, v);
  return v;
}

/** Forget cached settings (tests, or after profiles change outside this module). */
export function resetAssistCache() { cache = new Map(); version++; }

/**
 * The screen-wide settings for what is on screen now: the solo profile's on its own island, else the device
 * default joined with every joined profile (the most help anyone asked for).
 */
export function screenSettings(game) {
  if (game?.solo?.profile) {
    const s = profileSettings(game.solo.profile.id);
    return { ...s, aim: effectiveAim(s, sceneAimDefault(game)) };
  }
  const list = [deviceSettings(), ...(game?.roster?.players || []).filter((p) => p.profileId).map((p) => settingsFor(p))];
  return {
    speed: Math.min(...list.map((s) => s.speed)),
    text: Math.max(...list.map((s) => s.text)),
    contrast: list.some((s) => s.contrast),
    calm: list.some((s) => s.calm),
    timing: list.some((s) => s.timing),
    aim: Math.max(...list.map((s) => effectiveAim(s, sceneAimDefault(game)))),
  };
}

/** Game speed for the scene on screen (1 = full speed). Menus and banners are not slowed. */
export function gameSpeed(game) {
  return screenSettings(game).speed;
}

// ---------- reduce flashing and shake ----------
//
// Screen-wide (what the screen shows): main.js calls setCalm() from applyScreenSettings. Games blink a
// character at 7-10 Hz while it cannot be hit and blink warnings; with it on, characters glow softly instead
// (invulnBlink) and other blinks slow to a gentle pulse under 3 Hz (blinkOn). Camera shakes multiply by
// shakeScale() (0 with it on).

export const CALM_HZ = 1.25; // the slow pulse (on/off cycles per second) that replaces fast blinking
let calmNow = false;
export function setCalm(on) { calmNow = !!on; }
export function calmOn() { return calmNow; }

/** 0 with "Reduce flashing and shake" on, else 1: multiply a camera shake offset by it. */
export function shakeScale() { return calmNow ? 0 : 1; }

/**
 * A blink that shows hz times a second (Math.floor(time * hz * 2) % 2 === 0, as the games did): true while
 * shown. With reduce flashing on it slows to CALM_HZ.
 */
export function blinkOn(time, hz) {
  const f = calmNow ? Math.min(hz, CALM_HZ) : hz;
  return Math.floor(time * f * 2) % 2 === 0;
}

/**
 * "Can't be hit right now" on a bean (core/character.js Character): returns whether its group shows.
 * Off: the game's fast blink at hz. Reduce flashing on: it stays visible with a soft glow that breathes slowly.
 */
export function invulnBlink(ch, active, time, hz = 7) {
  if (!active || !calmNow) {
    if (ch?.glow) ch.glow.visible = false;
    return !active || Math.floor(time * hz * 2) % 2 === 0;
  }
  if (ch?.body) {
    if (!ch.glow) {
      const m = new THREE.MeshBasicMaterial({ color: 0xfff4b8, transparent: true, opacity: 0.5, side: THREE.BackSide, depthWrite: false });
      ch.glow = new THREE.Mesh(ch.body.geometry, m);
      ch.glow.scale.setScalar(1.25);
      ch.glow.userData.hull = true; // outlines skip it
      ch.glow.renderOrder = -1;
      ch.body.add(ch.glow);
    }
    ch.glow.visible = true;
    ch.glow.material.opacity = 0.5 + 0.2 * Math.sin(time * Math.PI * 2 * 0.9); // breathes under 1 Hz
  }
  return true;
}

// ---------- forgiving timing ----------

/**
 * How much wider timing windows are for this player (1 = as designed). Coyote time, jump buffers, green zones,
 * telegraphs and reaction windows multiply by it. Without a player: anyone on screen who asked.
 */
export function timingScale(p = null, game = null) {
  const on = p ? settingsFor(p).timing : screenSettings(game || window.game).timing;
  return on ? 1.75 : 1;
}

// ---------- aim help ----------

/**
 * The aim help a settings object gives in a game whose default is def (a scene's aimDefault): the level the
 * player picked, or the game's default when they never picked one (the snowball fight: "a little").
 */
export function effectiveAim(s, def = 0) {
  return s.aimChosen ? s.aim : Math.max(s.aim, def);
}

/** The aim default of the scene on screen (scene.aimDefault; 0 for most games). */
export function sceneAimDefault(game = null) {
  return (game || window.game)?.current?.aimDefault || 0;
}

/** 0 off, 1 a little, 2 a lot. Without a player: the most anyone on screen asked for. */
export function aimLevel(p = null, game = null) {
  return p ? effectiveAim(settingsFor(p), sceneAimDefault(game)) : screenSettings(game || window.game).aim;
}

// how far (radians) aim help looks for a target around where you aim, and how much of the way it turns
const AIM_CONE = [0, 0.32, 0.6];
const AIM_PULL = [0, 0.55, 0.9];

/**
 * Bend an aim direction toward the best target near it (2D, on the x/z plane or any two axes).
 * from {x, y}, dir {x, y} (any length), targets [{x, y}]. Returns a new {x, y} with dir's length.
 * level: aimLevel(p). maxDist: ignore targets farther than this.
 */
export function aimAt(from, dir, targets, level, { maxDist = Infinity } = {}) {
  const len = Math.hypot(dir.x, dir.y);
  if (!level || !len || !targets?.length) return { x: dir.x, y: dir.y };
  const a0 = Math.atan2(dir.y, dir.x);
  let best = null, bestScore = Infinity;
  for (const t of targets) {
    const dx = t.x - from.x, dy = t.y - from.y;
    const d = Math.hypot(dx, dy);
    if (d < 1e-3 || d > maxDist) continue;
    let da = Math.atan2(dy, dx) - a0;
    da = Math.atan2(Math.sin(da), Math.cos(da));
    if (Math.abs(da) > AIM_CONE[level]) continue;
    const score = Math.abs(da) * 4 + d * 0.02;
    if (score < bestScore) { bestScore = score; best = da; }
  }
  if (best === null) return { x: dir.x, y: dir.y };
  const a = a0 + best * AIM_PULL[level];
  return { x: Math.cos(a) * len, y: Math.sin(a) * len };
}

/**
 * Curve a flying shot toward the nearest target in front of it (call every frame).
 * vel {x, y} is changed in place (speed kept). Returns true if it steered.
 */
export function homeToward(pos, vel, targets, level, dt, { range = 8 } = {}) {
  if (!level || !targets?.length) return false;
  const sp = Math.hypot(vel.x, vel.y);
  if (!sp) return false;
  let best = null, bd = range;
  for (const t of targets) {
    const dx = t.x - pos.x, dy = t.y - pos.y;
    const d = Math.hypot(dx, dy);
    if (d > bd || d < 1e-3) continue;
    if ((dx * vel.x + dy * vel.y) / (d * sp) < 0.35) continue; // only targets ahead
    bd = d; best = { dx, dy, d };
  }
  if (!best) return false;
  const turn = (level === 2 ? 5 : 2.2) * dt;
  const a0 = Math.atan2(vel.y, vel.x);
  let da = Math.atan2(best.dy, best.dx) - a0;
  da = Math.atan2(Math.sin(da), Math.cos(da));
  const a = a0 + Math.max(-turn, Math.min(turn, da));
  vel.x = Math.cos(a) * sp;
  vel.y = Math.sin(a) * sp;
  return true;
}

// ---------- noticing repeated trouble (the gentle offers) ----------
//
// Games call struggle(scene, player, kind, part) when a try fails: kind 'timing' (a fall, a missed jump or
// window), 'aim' (a missed shot or throw), 'any' (a lost try that is neither). part names the level / puzzle /
// boss ('sky.2', 'hop.reef'...). overcame(scene, part) clears the count when it is done.
// The offers (main.js shows them as a small card, read aloud, one tap to accept, "don't ask again"):
//   OFFER_AT.assist tries in a row at one part: the matching assist (timing / aim) if it is off;
//   OFFER_AT.speed tries: a slower game (75 %) if it is still at full speed;
//   OFFER_AT.skip tries (only where the game can skip that part, opts.skip): skip it (marked as skipped).
// At least OFFER_AT.gap tries between two offers. Each offer comes once per game visit (a skip once per part);
// "No thanks" waits for the next threshold, "Don't ask again" is saved in the settings.

export const OFFER_AT = { assist: 3, speed: 5, skip: 7, gap: 2 };

/** The tries of this game visit: kept on the game, so a level that restarts as a new scene keeps counting. */
function struggles(scene) {
  const game = scene.game;
  const key = scene.key || scene.constructor?.name || 'scene';
  if (!game._struggle || game._struggle.key !== key) game._struggle = { key, counts: {}, offered: new Set(), last: 0 };
  return game._struggle;
}

/**
 * at: thresholds for this game ({ assist, speed, skip, gap }), for parts that take long to try (a whole level).
 * speed: false where a slower game does not help (turn-based games).
 */
export function struggle(scene, player, kind, part = 'all', { skip = null, at = null, speed = true } = {}) {
  const game = scene?.game;
  if (!game) return null;
  const st = struggles(scene);
  const n = (st.counts[part] = (st.counts[part] || 0) + 1);
  const s = player ? settingsFor(player) : deviceSettings();
  if (!s.offers) return null;
  const A = { ...OFFER_AT, ...(at || {}) };
  if (st.last && n - st.last < A.gap) return null;
  const can = (k) => !s.never.includes(k) && !st.offered.has(`${k}:${part}`) && !st.offered.has(k);
  let offer = null;
  if (n >= A.skip && skip && can('skip')) offer = 'skip';
  else if (speed && n >= A.speed && can('speed') && screenSettings(game).speed === 1) offer = 'speed';
  else if (n >= A.assist && kind === 'timing' && can('timing') && !s.timing) offer = 'timing';
  else if (n >= A.assist && kind === 'aim' && can('aim') && effectiveAim(s, scene.aimDefault || 0) < 2) offer = 'aim';
  if (!offer) return null;
  // skip can come again at another part; an assist is offered once per visit
  if (game.offerAssist?.({ kind: offer, player, part, skip, scene }) === false) return null; // a menu is up: later
  st.offered.add(offer === 'skip' ? `skip:${part}` : offer);
  st.last = n;
  return offer;
}

/** The part was done: the count starts again (a later struggle there offers again only past new thresholds). */
export function overcame(scene, part = 'all') {
  if (!scene?.game) return;
  const st = struggles(scene);
  delete st.counts[part];
  st.last = 0;
}

/** How many tries in a row at this part (tests, or a game's own hint). */
export function tries(scene, part = 'all') {
  return scene?.game ? struggles(scene).counts[part] || 0 : 0;
}

// ---------- skipped parts ----------

/** Mark a level/puzzle as skipped (playable later; shown as skipped). progress: the roster's progress. */
export function markSkipped(progress, game, part) {
  const all = (progress.skipped ||= {});
  const list = (all[game] ||= []);
  if (!list.includes(part)) list.push(part);
}
export function isSkipped(progress, game, part) {
  return !!progress?.skipped?.[game]?.includes(part);
}
export function clearSkipped(progress, game, part) {
  const list = progress?.skipped?.[game];
  if (list) progress.skipped[game] = list.filter((x) => x !== part);
}
