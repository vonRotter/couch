import { POWER_START, ORDER } from './levels.js';
import { SQUADS, SQUAD_IDS } from './rules.js';

// Bean Brigade progress, per solo profile in roster.progress.breach:
//   tutorial: the first-battle tips were finished       medals: { bonk: n, ... } campaigns won per squad
//   bestBattles: most battles won in one run             done: won the whole campaign at least once
//   run: the campaign in progress or null:
//     { diff, squad, step (index in ORDER), power, stars (to spend), starsTotal, won, seed, tries (Easy retries of this battle),
//       mechs: [{ type, hp, move, pow, ups: ['hp1', ...] }], shop (upgrade screen due) }

export function loadBreach(roster) {
  const p = roster.progress.breach || {};
  const medals = {};
  for (const id of SQUAD_IDS) medals[id] = Math.max(0, p.medals?.[id] | 0);
  return {
    v: 1,
    tutorial: !!p.tutorial,
    medals,
    bestBattles: Math.min(ORDER.length, p.bestBattles | 0),
    done: !!p.done,
    restarts: p.restarts | 0,
    run: p.run && SQUADS[p.run.squad] ? fixRun(p.run) : null,
  };
}

function fixRun(r) {
  return {
    diff: r.diff === 'hard' ? 'hard' : 'easy',
    squad: r.squad,
    step: Math.max(0, Math.min(ORDER.length - 1, r.step | 0)),
    power: Math.max(1, Math.min(8, r.power ?? POWER_START)),
    stars: Math.max(0, r.stars | 0),
    starsTotal: Math.max(0, r.starsTotal | 0),
    won: Math.max(0, r.won | 0),
    seed: r.seed | 0 || 1,
    tries: Math.max(0, r.tries | 0),
    shop: !!r.shop,
    mechs: SQUADS[r.squad].map((type, i) => {
      const m = r.mechs?.[i] || {};
      return { type, hp: m.hp | 0, move: m.move | 0, pow: m.pow | 0, ups: Array.isArray(m.ups) ? m.ups.slice() : [] };
    }),
  };
}

export function newRun(diff, squad, seed = Math.floor(Math.random() * 1e9)) {
  return fixRun({ diff, squad, step: 0, power: POWER_START, stars: 0, seed, mechs: [] });
}

export function saveBreach(roster, data) {
  roster.progress.breach = JSON.parse(JSON.stringify(data));
  roster.save();
}
