// Dialog trees, Monkey Island style: the other character says something, Pip picks a line with the
// stick (or mouse), Pip says it, and they answer. Used options stay in the list, greyed.
//
// tree = {
//   id: 'grum',                         // remembers which lines were already used (saved in flags)
//   start: 'main' | (s) => 'main',      // first node
//   nodes: {
//     main: {
//       intro: [['grum', 'key'], ...] | (s) => lines/script,   // said when the node is entered
//       options: [{
//         id: 'real', text: 'key',      // what Pip says (also the choice text)
//         when: (s) => bool,            // only shown when true
//         lines: [['grum', 'key'], (s) => ..., ...],  // the answer (lines or script steps)
//         run: (s) => script,           // extra script after the lines
//         next: 'node' | (s) => 'node' | null,        // default: back to the same node
//         end: true,                    // leaves the dialog
//         silent: true,                 // Pip doesn't repeat the line out loud
//       }],
//     },
//   },
// }

const isIter = (x) => x && typeof x.next === 'function';

function* steps(s, v) {
  const r = typeof v === 'function' ? v(s) : v;
  if (!r) return;
  if (isIter(r)) yield* r;
  else if (Array.isArray(r)) yield* s.lines(r);
  else yield r;
}

export function* runDialog(s, tree) {
  let node = typeof tree.start === 'function' ? tree.start(s) : tree.start;
  let entered = null;
  const usedKey = `dlg.${tree.id}`;
  const used = new Set(s.flag(usedKey) || []);
  while (node) {
    const n = tree.nodes[node];
    if (!n) return;
    if (entered !== node && n.intro) yield* steps(s, n.intro);
    entered = node;
    // The intro may have ended the conversation (or started something else)
    if (s.dialogBreak) { s.dialogBreak = false; return; }
    const opts = (n.options || []).filter((o) => !o.when || o.when(s));
    if (!opts.length) return;
    const i = yield s.choose(opts.map((o) => ({ text: o.text, vars: o.vars, used: used.has(o.id) && !o.end })));
    const o = opts[i];
    if (o.id && !used.has(o.id)) {
      used.add(o.id);
      s.setFlag(usedKey, [...used]);
    }
    if (!o.silent) yield s.say('pip', o.text, o.vars);
    if (o.lines) yield* steps(s, o.lines);
    if (o.run) yield* steps(s, o.run);
    if (o.end || s.dialogBreak) { s.dialogBreak = false; return; }
    node = o.next === undefined ? node : typeof o.next === 'function' ? o.next(s) : o.next;
  }
}

/** Pick one of several line keys at random: pick('adv.duel.smug', 3) -> 'adv.duel.smug.2'. */
export function pick(prefix, n) {
  return `${prefix}.${1 + Math.floor(Math.random() * n)}`;
}
