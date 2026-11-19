// The missing-string check: every text key the code uses has English and Norwegian, and the two languages have the
// same keys. Reads the source for keys written out in full (t('x.y'), tFor(p, 'x.y'), key: 'x.y', keys/choices
// lists), then asks the running game (window.game.stringKeys(): every string registered, built in or with
// addStrings) which keys each language has. Keys built at run time (`isl.npc.${id}`) are covered by the second part
// (both languages have the same keys) and by the island tests' scans for raw keys on screen. (window.game.stringKeys
// is core/i18n.js stringKeys.)
// Run: node tests/strings.mjs (the dev server running, see tests/README.md). Exits with 1 if anything is missing.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { open, close, test, assert, done } from './lively/helper.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');
const files = [];
(function walk(d) { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) walk(p); else if (f.name.endsWith('.js')) files.push(p); } })(root);

const KEY = /^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z0-9_]+)+$/;
// written like a key but not a text key: id -> the text keys it stands for (checked instead)
const NOT_TEXT = { 'rivalry.start': ['vc.rivalry.start.1', 'vc.rivalry.start.2', 'vc.rivalry.start.3'] }; // village.js: a conversation topic
const used = new Map(); // key -> first place it is used
const add = (k, where) => { if (NOT_TEXT[k]) { for (const x of NOT_TEXT[k]) add(x, where); return; } if (KEY.test(k) && !used.has(k)) used.set(k, where); };
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  const rel = path.relative(path.join(root, '..'), f);
  src.split('\n').forEach((line, i) => {
    const where = `${rel}:${i + 1}`;
    for (const m of line.matchAll(/\bt\(\s*'([^'\\]+)'/g)) add(m[1], where);
    for (const m of line.matchAll(/\btFor\([^,()]+(?:\([^()]*\))?,\s*'([^'\\]+)'/g)) add(m[1], where);
    for (const m of line.matchAll(/\bkey:\s*'([^'\\]+)'/g)) add(m[1], where);
    for (const m of line.matchAll(/\b(?:keys|choices):\s*\[([^\]]*)\]/g)) for (const q of m[1].matchAll(/'([^'\\]+)'/g)) add(q[1], where);
  });
}

const page = await open();
const dict = await page.evaluate(() => window.game.stringKeys()); // (the game's own module: a fresh import can be another copy after a hot update)
const en = new Set(dict.en), no = new Set(dict.no);

await test(`every key written out in the code (${used.size}) has English and Norwegian`, async () => {
  const missEn = [...used].filter(([k]) => !en.has(k)).map(([k, w]) => `${k} (${w})`);
  const missNo = [...used].filter(([k]) => en.has(k) && !no.has(k)).map(([k, w]) => `${k} (${w})`);
  assert(!missEn.length && !missNo.length, `no English: ${missEn.length}\n  ${missEn.join('\n  ')}\nno Norwegian: ${missNo.length}\n  ${missNo.join('\n  ')}`);
});

await test(`English and Norwegian have the same keys (${en.size} / ${no.size})`, async () => {
  const onlyEn = [...en].filter((k) => !no.has(k));
  const onlyNo = [...no].filter((k) => !en.has(k));
  assert(!onlyEn.length && !onlyNo.length, `only English: ${onlyEn.length}\n  ${onlyEn.join('\n  ')}\nonly Norwegian: ${onlyNo.length}\n  ${onlyNo.join('\n  ')}`);
});

await test('no console errors', async () => { assert(!page.errors.length, page.errors.join('\n')); });
await close(page);
done();
