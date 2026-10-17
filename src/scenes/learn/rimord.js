import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { FieldRound, HD, TILE_COLORS, makeBoard } from './common.js';
import { COLORS, PLAYER_COLORS, toon, sharedGeo } from '../../core/palette.js';
import { speak, glyphMaterial } from '../../core/edu.js';
import { t, addStrings } from '../../core/i18n.js';
import { esc } from '../../core/ui.js';

// Rimord: every player has a word; walk to a word that rhymes with it.

addStrings({
  en: {
    'rimord.title': 'Rimord',
    'rimord.hint': 'Se og hør på ordet ditt. Gå til et ord som rimer på det, som SOL og STOL!',
    'rimord.card': '{name} · {n} rim',
    'rimord.find': 'Finn et ord som rimer',
    'rimord.unit': 'rim',
  },
  no: {
    'rimord.title': 'Rimord',
    'rimord.hint': 'Se og hør på ordet ditt. Gå til et ord som rimer på det, som SOL og STOL!',
    'rimord.card': '{name} · {n} rim',
    'rimord.find': 'Finn et ord som rimer',
    'rimord.unit': 'rim',
  },
});

/**
 * Rhyme groups: every word in a group ends with `end` and rhymes with the others.
 * Words in different groups never rhyme (two groups may share an end across levels:
 * MAT and PIRAT rhyme, so correctness is decided by the end, not by the group).
 */
export const RHYMES = {
  easy: [
    { end: 'OL', words: ['SOL', 'STOL', 'FIOL'] },
    { end: 'ATT', words: ['KATT', 'HATT', 'NATT'] },
    { end: 'US', words: ['MUS', 'HUS', 'BRUS', 'LUS'] },
    { end: 'IL', words: ['BIL', 'PIL', 'SMIL'] },
    { end: 'IS', words: ['IS', 'GRIS', 'RIS', 'PRIS'] },
    { end: 'O', words: ['SKO', 'BRO', 'TO', 'RO'] },
    { end: 'Å', words: ['BLÅ', 'GRÅ', 'TÅ', 'SMÅ'] },
    { end: 'ALL', words: ['BALL', 'STALL', 'HALL'] },
    { end: 'Y', words: ['FLY', 'SKY', 'BY', 'NY'] },
    { end: 'E', words: ['TRE', 'KNE', 'SKE'] },
    { end: 'ÅL', words: ['BÅL', 'MÅL', 'NÅL', 'SKÅL'] },
    { end: 'EGG', words: ['EGG', 'VEGG', 'SKJEGG'] },
    { end: 'OPP', words: ['KOPP', 'TOPP', 'HOPP'] },
    { end: 'EIN', words: ['STEIN', 'BEIN'] },
    { end: 'Ø', words: ['SNØ', 'SJØ', 'FRØ'] },
    { end: 'AT', words: ['MAT', 'FAT'] },
    { end: 'UL', words: ['JUL', 'HJUL', 'GUL'] },
  ],
  medium: [
    { end: 'AKE', words: ['KAKE', 'BAKE', 'SMAKE'] },
    { end: 'UTE', words: ['PUTE', 'UTE', 'RUTE'] },
    { end: 'UE', words: ['LUE', 'DUE', 'STUE', 'BUE'] },
    { end: 'AGE', words: ['HAGE', 'MAGE'] },
    { end: 'OSE', words: ['ROSE', 'POSE'] },
    { end: 'ÅKE', words: ['MÅKE', 'KRÅKE', 'TÅKE'] },
    { end: 'OKK', words: ['SOKK', 'KOKK', 'BLOKK', 'STOKK'] },
    { end: 'EV', words: ['REV', 'BREV', 'SKREV'] },
    { end: 'AL', words: ['HVAL', 'DAL', 'SMAL'] },
    { end: 'EST', words: ['HEST', 'FEST', 'VEST', 'BEST'] },
    { end: 'EIL', words: ['SEIL', 'SPEIL', 'FEIL'] },
    { end: 'ING', words: ['RING', 'TING', 'SVING'] },
    { end: 'ISK', words: ['FISK', 'DISK', 'FRISK'] },
    { end: 'ANN', words: ['VANN', 'MANN', 'TANN', 'SPANN'] },
    { end: 'AM', words: ['LAM', 'DAM', 'KAM'] },
    { end: 'YTTE', words: ['HYTTE', 'LYTTE', 'FLYTTE'] },
    { end: 'ØRN', words: ['BJØRN', 'ØRN'] },
  ],
  hard: [
    { end: 'IN', words: ['KANIN', 'MASKIN', 'PINGVIN', 'DELFIN', 'GARDIN', 'APPELSIN'] },
    { end: 'AT', words: ['PIRAT', 'SALAT', 'TOMAT'] },
    { end: 'ANT', words: ['ELEFANT', 'DIAMANT', 'KANT'] },
    { end: 'ADE', words: ['SJOKOLADE', 'LIMONADE', 'MARMELADE'] },
    { end: 'AN', words: ['BANAN', 'VULKAN', 'PELIKAN'] },
    { end: 'AR', words: ['GITAR', 'FAR', 'PAR'] },
    { end: 'ILLE', words: ['KROKODILLE', 'LILLE', 'STILLE', 'GRILLE'] },
    { end: 'ETT', words: ['RAKETT', 'SKJELETT', 'BALLETT', 'OMELETT'] },
    { end: 'IKK', words: ['BUTIKK', 'MUSIKK', 'FABRIKK', 'TRIKK'] },
    { end: 'ON', words: ['TELEFON', 'MELON', 'MILLION'] },
    { end: 'ELL', words: ['KARUSELL', 'HOTELL', 'KARAMELL', 'FJELL'] },
    { end: 'Y', words: ['PARAPLY', 'FLY', 'SKY'] },
  ],
};

// Word -> rhyme end, and end -> every word with that end (all levels).
const END_OF = new Map();
const BY_END = new Map();
for (const groups of Object.values(RHYMES)) {
  for (const { end, words } of groups) {
    for (const w of words) {
      END_OF.set(w, end);
      if (!BY_END.has(end)) BY_END.set(end, new Set());
      BY_END.get(end).add(w);
    }
  }
}
const ALL_WORDS = [...END_OF.keys()];

export const rhymes = (a, b) => a !== b && END_OF.get(a) === END_OF.get(b);

const pick = (list) => list[Math.floor(Math.random() * list.length)];
const vowelOf = (end) => end.match(/[AEIOUYÆØÅ]/)?.[0];

export class RimordRound extends FieldRound {
  static key = 'rimord';

  constructor(mix) {
    super(mix, { fences: [0x9ff0c8, 0xffc08a, 0xff9fd0, 0x8fd8ff], seed: 47 });
    this.used = new Map(this.ents.map((e) => [e, new Set()]));
    this.decorate();
  }

  get title() { return t('rimord.title'); }
  get hint() { return t('rimord.hint'); }

  howto() {
    return '<div class="edu-word" style="margin:8px 0">SOL – STOL · KATT – HATT</div>';
  }

  decorate() {
    // Letter blocks spelling RIM behind the field.
    ['R', 'I', 'M'].forEach((ch, i) => {
      const box = new THREE.Mesh(sharedGeo('lmRimBlock', () => new RoundedBoxGeometry(1.5, 1.5, 1.5, 2, 0.15)), toon(PLAYER_COLORS[i * 2].hex));
      box.position.set(-3 + i * 3, 0.75, -HD - 2.6);
      box.rotation.y = (i - 1) * 0.2;
      const face = new THREE.Mesh(sharedGeo('lmRimFace', () => new THREE.PlaneGeometry(1.3, 1.3)), glyphMaterial(ch));
      face.position.z = 0.76;
      box.add(face);
      box.castShadow = true;
      this.group.add(box);
    });
  }

  newTask(e) {
    const lv = this.levelKey(e);
    const used = this.used.get(e);
    let pool = RHYMES[lv].flatMap((g) => g.words).filter((w) => !used.has(w) && BY_END.get(END_OF.get(w)).size > 1);
    if (!pool.length) { used.clear(); pool = RHYMES[lv].flatMap((g) => g.words); }
    // Not the same rhyme as the last word.
    const fresh = pool.filter((w) => !e.task || END_OF.get(w) !== END_OF.get(e.task.word));
    const word = pick(fresh.length ? fresh : pool);
    used.add(word);
    // The partner that is guaranteed to be on the field: prefer one from the same level.
    const same = RHYMES[lv].find((g) => g.words.includes(word)).words.filter((w) => w !== word);
    const partner = pick(same.length ? same : [...BY_END.get(END_OF.get(word))].filter((w) => w !== word));
    e.task = { word, partner, found: null };
    speak(word);
  }

  need(e) {
    return e.task.partner;
  }

  isRight(e, tile) {
    return rhymes(e.task.word, tile.value);
  }

  /** Practice words; harder levels get close distractors (same vowel or same last letter). */
  filler() {
    const e = pick(this.ents);
    const lv = this.levelKey(e);
    const own = this.ents.map((o) => o.task?.word);
    const base = e.task?.word;
    let pool;
    if (base && lv !== 'easy' && Math.random() < 0.6) {
      const end = END_OF.get(base);
      pool = ALL_WORDS.filter((w) => END_OF.get(w) !== end && (vowelOf(END_OF.get(w)) === vowelOf(end) || w.at(-1) === base.at(-1)));
    }
    if (!pool?.length) pool = RHYMES[lv].flatMap((g) => g.words);
    pool = pool.filter((w) => !own.includes(w));
    return pick(pool.length ? pool : ALL_WORDS);
  }

  makeTile(value) {
    const color = TILE_COLORS[(value.charCodeAt(0) + value.length) % TILE_COLORS.length];
    const mesh = makeBoard([value], color, { w: 3.4, d: 1.5 });
    // A balloon tied to the board so the words float a little.
    const balloon = new THREE.Mesh(sharedGeo('lmBalloon', () => new THREE.SphereGeometry(0.42, 16, 12)), toon(PLAYER_COLORS[value.length % 6].hex));
    balloon.scale.y = 1.15;
    balloon.position.set(1.8, 1.0, -0.8);
    const string = new THREE.Mesh(sharedGeo('lmString', () => new THREE.CylinderGeometry(0.015, 0.015, 0.6, 4)), toon(COLORS.ink));
    string.position.set(1.8, 0.4, -0.8);
    mesh.add(balloon, string);
    return { mesh, w: 3.4, d: 1.5, y: 0.75 };
  }

  onRight(e, tile) {
    e.task.found = tile.value;
    super.onRight(e, tile);
    e.doneT = 1.6;
    speak(`${e.task.word}, ${tile.value}`);
  }

  tag(e) {
    return e.doneT > 0 ? `${esc(e.task.word)} – ${esc(e.task.found)} ✓` : esc(e.task.word);
  }

  card(e) {
    const done = e.doneT > 0;
    return `<div class="edu-card-head">${esc(t('rimord.card', { name: e.p.name, n: e.score }))}</div>
      <div class="edu-word math">${esc(e.task.word)}${done ? ` – ${esc(e.task.found)}` : ''}</div>
      <div class="edu-clue">${done ? '✓' : esc(t('rimord.find'))}</div>`;
  }

  get unit() { return t('rimord.unit'); }
}
