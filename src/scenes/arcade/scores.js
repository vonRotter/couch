import { listProfiles, soloSaveKey } from '../../core/profiles.js';

// High scores of the Game Hall's classic games, per child: saved in the profile's own solo save
// (roster.progress.arcade = { best: { key: n }, plays: { key: n }, at: { key: ms } }), so every child has their own
// board. familyBests() reads the other profiles' saves on this device for the board in the hall and the game-over
// card ("Mia: 42"). Saves made before this round simply have no arcade field (it is made on the first game).

export function arcadeOf(progress) {
  const A = (progress.arcade && typeof progress.arcade === 'object') ? progress.arcade : (progress.arcade = {});
  for (const k of ['best', 'plays', 'at']) if (!A[k] || typeof A[k] !== 'object') A[k] = {};
  return A;
}

export function bestOf(progress, key) {
  return progress?.arcade?.best?.[key] || 0;
}

/** A game finished with this score (levels games: levels cleared): { best, old, isNew }. Saved at once. */
export function recordScore(game, key, score) {
  const A = arcadeOf(game.roster.progress);
  const old = A.best[key] || 0;
  A.plays[key] = (A.plays[key] || 0) + 1;
  const isNew = score > old;
  if (isNew) { A.best[key] = score; A.at[key] = Date.now(); }
  game.roster.save();
  return { best: Math.max(old, score), old, isNew: isNew && score > 0 };
}

/** Every child's best at this game on this device (the one playing first), best first: [{ name, best, me }]. */
export function familyBests(game, key) {
  const me = game.solo?.profile?.id || null;
  const out = [];
  for (const prof of listProfiles()) {
    let best = 0;
    if (prof.id === me) best = bestOf(game.roster.progress, key);
    else {
      try { best = JSON.parse(localStorage.getItem(soloSaveKey(prof.id)))?.progress?.arcade?.best?.[key] || 0; } catch { best = 0; }
    }
    if (best > 0 || prof.id === me) out.push({ name: prof.name, best, me: prof.id === me });
  }
  return out.sort((a, b) => b.best - a.best || (b.me ? 1 : 0) - (a.me ? 1 : 0));
}
