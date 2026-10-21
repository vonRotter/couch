import { t } from '../../core/i18n.js';
import { esc } from '../../core/ui.js';
import { pick } from './dialog.js';

// Tickle Fencing: kid-friendly insult swordfighting. The opponent boasts, Pip picks a comeback.
// The right comeback makes the opponent giggle (his giggle meter fills); a wrong one makes him
// smug and he tickles Pip a little (Pip's meter fills, and when it's full Pip just shakes it off).
// Nobody loses anything: the boast simply comes again until it is answered.
//
// Comebacks are learned: hearing a boast for the first time teaches Pip its comeback when the
// duel has `learn: true` (scene 1), and they are kept in save.comebacks for later duels, so a
// tournament can ask for comebacks learned elsewhere.

/** Boast -> the comeback that beats it. */
export const BOASTS = {
  cheetah: { boast: 'adv.duel.b.cheetah', comeback: 'adv.duel.c.cheetah' },
  whale: { boast: 'adv.duel.b.whale', comeback: 'adv.duel.c.whale' },
  laugh: { boast: 'adv.duel.b.laugh', comeback: 'adv.duel.c.laugh' },
};

/** Silly comebacks that never work, each with the opponent's smug reply. */
export const WRONG = {
  duck: { line: 'adv.duel.w.duck', retort: 'adv.duel.r.duck' },
  rubber: { line: 'adv.duel.w.rubber', retort: 'adv.duel.r.rubber' },
  snack: { line: 'adv.duel.w.snack', retort: 'adv.duel.r.snack' },
};

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const isIter = (x) => x && typeof x.next === 'function';
function* steps(s, v, ...args) {
  const r = typeof v === 'function' ? v(s, ...args) : v;
  if (!r) return;
  if (isIter(r)) yield* r;
  else if (Array.isArray(r)) yield* s.lines(r);
  else yield r;
}

/**
 * Run a duel. def = {
 *   opponent: 'grum',                 actor id
 *   boasts: ['cheetah', ...],         in order; the last one should be the knockout
 *   wrong: ['duck', ...],             silly comebacks always on offer
 *   learn: true,                      hearing a boast teaches its comeback
 *   intro, onHit(s, n, need), onMiss(s, n), afterWrong: { duck: lines }   optional scripts
 * } Returns true when won (it always ends in a win).
 */
export function* tickleDuel(s, def) {
  const need = def.boasts.length;
  const opp = s.actors[def.opponent];
  const meter = { pip: 0, opp: 0 };
  const show = () => s.ui.setMeters({
    title: t('adv.duel.title'),
    left: { name: t('adv.who.pip'), css: s.actors.pip.css, value: meter.pip, max: need },
    right: { name: t(opp.name), css: opp.css, value: meter.opp, max: need },
  });
  s.duelMeters = show;
  show();
  if (def.intro) yield* steps(s, def.intro);

  let bi = 0;
  while (bi < def.boasts.length) {
    const id = def.boasts[bi];
    const b = BOASTS[id];
    yield s.say(def.opponent, b.boast, null, { hold: true });
    if (def.learn && !s.save.comebacks.includes(id)) {
      s.save.comebacks.push(id);
      s.persist();
      s.hint('adv.duel.learned', 2.5);
      s.sfx('star');
    }
    const known = s.save.comebacks.filter((c) => BOASTS[c]).map((c) => ({ kind: 'right', id: c, line: BOASTS[c].comeback }));
    const wrong = def.wrong.map((w) => ({ kind: 'wrong', id: w, line: WRONG[w].line }));
    const options = shuffle([...known, ...wrong]);
    const head = () => esc(t('adv.duel.help'));
    const i = yield s.choose(options.map((o) => ({ text: o.line })), head);
    const o = options[i];
    yield s.say('pip', o.line);
    if (o.kind === 'right' && o.id === id) {
      meter.opp++;
      show();
      yield* steps(s, def.onHit, meter.opp, need);
      bi++;
    } else {
      yield s.say(def.opponent, o.kind === 'wrong' ? WRONG[o.id].retort : pick('adv.duel.smug', 3));
      if (o.kind === 'wrong' && def.afterWrong?.[o.id]) yield* steps(s, def.afterWrong[o.id]);
      meter.pip++;
      show();
      yield* steps(s, def.onMiss, meter.pip);
      if (meter.pip >= need) {
        // Pip giggled three times: shake it off and carry on (no punishment).
        yield s.say(def.opponent, 'adv.duel.shake');
        meter.pip = 0;
        show();
      }
    }
  }
  s.ui.setMeters(null);
  s.duelMeters = null;
  return true;
}
