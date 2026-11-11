import { addStrings } from '../../core/i18n.js';
import { struggle, overcame, markSkipped } from '../../core/assist.js';
import { isS2 } from './scene2.js';

// Help me play: skip a puzzle in The Secret of Pudding Island.
//
// Tries: a thing used where it does nothing (the generic "I don't think the duck wants to go there") and a
// wrong comeback in a Tickle Fencing duel. After many (the same offer logic as everywhere, core/assist.js) the
// game offers to skip:
//   a puzzle: Pip has a brilliant idea and does the right thing on his own (the real solution plays: the
//     barrel opens, the duck meets the seagull, the pudding plugs the hole...). If he needs an item for it
//     that he does not carry yet, he finds it in a pocket, so whatever gates the story is still given.
//   a duel: the opponent giggles until she gives up (duel.js), and Pip wins as if he had answered.
// Skipped puzzles are marked in progress.skipped.adventure; a New game plays them again.

addStrings({
  en: {
    'adv.skip.idea': 'Then Pip has a brilliant idea...',
    'adv.skip.pocket': 'Oh! What was in my pocket all along?',
    'adv.duel.giveUp': 'Hee hee hee... stop, stop! I can\'t stop giggling. I give up!',
  },
  no: {
    'adv.skip.idea': 'Da får Pip en strålende idé ...',
    'adv.skip.pocket': 'Oi! Hva har jeg hatt i lomma hele tiden?',
    'adv.duel.giveUp': 'Hi hi hi ... stopp, stopp! Jeg klarer ikke slutte å fnise. Jeg gir meg!',
  },
});

/**
 * The puzzles in story order: the first one that is ready (and not done) is "the" puzzle you are stuck on.
 * room / hs: where it is solved; item: used on the hotspot (else verb); duel: the solution starts a duel.
 */
export const PUZZLES = [
  { id: 'barrel', room: 'dock', hs: 'barrel', verb: 'use', ready: (s) => !isS2(s) && !s.flag('barrelOpen') },
  { id: 'gull', room: 'dock', hs: 'gull', item: 'duck', ready: (s) => !isS2(s) && s.flag('barrelOpen') && !s.flag('gullOnHead') },
  { id: 'grum', room: 'dock', hs: 'grum', verb: 'talk', duel: true, ready: (s) => !isS2(s) && s.flag('gullOnHead') && !s.flag('duelWon') },
  { id: 'pants', room: 'square', hs: 'pants', item: 'gull', ready: (s) => isS2(s) && s.flag('s2.townOpen') && !s.flag('s2.pants') },
  { id: 'sail', room: 'deck', hs: 'mast', item: 'pants', ready: (s) => isS2(s) && s.flag('s2.pants') && !s.flag('s2.sail') },
  { id: 'coin', room: 'square', hs: 'fountain', item: 'spoon', ready: (s) => isS2(s) && s.flag('s2.townOpen') && !s.flag('sq.coin') },
  { id: 'wob', room: 'parlor', hs: 'granny', item: 'coin', ready: (s) => isS2(s) && s.flag('sq.coin') && !s.flag('s2.wob') },
  { id: 'claw', room: 'square', hs: 'claw', item: 'note', ready: (s) => isS2(s) && s.flag('claw.won') && s.flag('claw.wantsHat') && !s.flag('s2.claw') },
  { id: 'hole', room: 'deck', hs: 'hole', item: 'pudding', ready: (s) => isS2(s) && s.has('pudding') && !s.flag('s2.hole') },
];

/** The puzzle Pip is stuck on (the first ready one), or null. */
export function currentPuzzle(s) {
  return PUZZLES.find((p) => { try { return p.ready(s); } catch { return false; } }) || null;
}

/** A thing used where it does nothing: a try at the current puzzle. s: the engine. */
export function triedPuzzle(s) {
  const pz = currentPuzzle(s);
  if (!pz || s.mode === 'title') return;
  struggle(s.host, s.host.players[0], 'any', `adv.${pz.id}`, { skip: () => skipPuzzle(s, pz), speed: false });
}

/** A wrong comeback in a duel: a try; a skip makes the opponent give up (duel.js reads s.duelGiveUp). */
export function triedDuel(s, opponent) {
  struggle(s.host, s.host.players[0], 'any', `adv.duel.${opponent}`, {
    skip: () => { s.duelGiveUp = true; markSkipped(s.game.roster.progress, 'adventure', `duel.${opponent}`); s.game.roster.save(); },
    speed: false,
  });
}

/** The skip: Pip goes there and solves it himself (the real solution script). */
export function skipPuzzle(s, pz) {
  if (!pz.ready(s)) return;
  markSkipped(s.game.roster.progress, 'adventure', pz.id);
  s.game.roster.save();
  overcame(s.host, `adv.${pz.id}`);
  if (pz.duel) s.duelGiveUp = true; // the duel that follows ends with the opponent giving up
  s.run(function* solveItself(e) {
    yield e.say('narr', 'adv.skip.idea');
    if (e.room.id !== pz.room) yield e.goRoom(pz.room, 'start');
    if (pz.item && !e.has(pz.item)) { e.give(pz.item); yield e.say('pip', 'adv.skip.pocket'); }
    const w = e.walkTo(pz.hs);
    if (w) yield w;
    const h = e.hotspots().find((x) => x.id === pz.hs);
    if (!h) return;
    e.faceHotspot?.(h);
    const verb = pz.item ? 'useOn' : pz.verb;
    const it = e.toIter(e.handlerFor(h, verb, pz.item), { hs: h, verb, item: pz.item });
    if (it) yield* it;
  });
}
