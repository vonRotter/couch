import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { FieldRound, HD, textMaterial } from './common.js';
import { COLORS, toon, sharedGeo } from '../../core/palette.js';
import { speak } from '../../core/edu.js';
import { t, addStrings } from '../../core/i18n.js';
import { esc } from '../../core/ui.js';

// Pengebutikken: everyone wants to buy something. Pick up coins until you have paid exactly.

addStrings({
  en: {
    'penger.title': 'Pengebutikken',
    'penger.hint': 'Kjøp tingen over hodet ditt! Gå på myntene til du har betalt akkurat riktig pris.',
    'penger.card': '{name} · {n} kjøpt',
    'penger.paid': 'Betalt: {sum} kr',
    'penger.paidSum': 'Betalt: {sum}',
    'penger.bought': 'Kjøpt! ✓',
    'penger.much': 'For mye!',
    'penger.unit': 'kjøpt',
    'penger.shop': 'BUTIKK',
    'penger.kr': '{n} kr',
  },
  no: {
    'penger.title': 'Pengebutikken',
    'penger.hint': 'Kjøp tingen over hodet ditt! Gå på myntene til du har betalt akkurat riktig pris.',
    'penger.card': '{name} · {n} kjøpt',
    'penger.paid': 'Betalt: {sum} kr',
    'penger.paidSum': 'Betalt: {sum}',
    'penger.bought': 'Kjøpt! ✓',
    'penger.much': 'For mye!',
    'penger.unit': 'kjøpt',
    'penger.shop': 'BUTIKK',
    'penger.kr': '{n} kr',
  },
});

const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = (list) => list[Math.floor(Math.random() * list.length)];

// Coins and price range per level.
const LEVEL = {
  easy: { coins: [1, 5], min: 2, max: 10 },
  medium: { coins: [1, 5, 10], min: 6, max: 20 },
  hard: { coins: [1, 5, 10, 20], min: 15, max: 50 },
};

// Norwegian coins: 1 and 5 kroner are silver, 10 and 20 are gold (and bigger).
const COIN = {
  1: { r: 0.72, color: 0xd9dde8, rim: 0xaab0c2 },
  5: { r: 0.8, color: 0xd9dde8, rim: 0xaab0c2 },
  10: { r: 0.8, color: 0xffd23f, rim: 0xe0a100 },
  20: { r: 0.92, color: 0xffd23f, rim: 0xe0a100 },
};

const ITEMS = ['is', 'eple', 'ball', 'bamse', 'bil', 'bok'];
const ITEM_NAME = { is: 'Is', eple: 'Eple', ball: 'Ball', bamse: 'Bamse', bil: 'Bil', bok: 'Bok' };

/** Small toy models built from primitives (about 1 unit tall). */
export function makeItem(kind) {
  const g = new THREE.Group();
  const m = (geo, color, x = 0, y = 0, z = 0) => {
    const o = new THREE.Mesh(geo, toon(color));
    o.position.set(x, y, z);
    o.castShadow = true;
    g.add(o);
    return o;
  };
  const sph = (r) => sharedGeo(`lmSph${r}`, () => new THREE.SphereGeometry(r, 16, 12));
  const box = (k, w, h, d, r = 0.06) => sharedGeo(`lmBox${k}`, () => new RoundedBoxGeometry(w, h, d, 2, r));
  if (kind === 'is') {
    const cone = m(sharedGeo('lmCone', () => new THREE.ConeGeometry(0.28, 0.7, 12)), 0xe0a060, 0, 0.35, 0);
    cone.rotation.x = Math.PI;
    m(sph(0.3), 0xff9fd0, 0, 0.78, 0);
    m(sph(0.26), 0xfffaf2, 0, 1.08, 0);
    m(sph(0.07), 0xff3b5c, 0, 1.34, 0);
  } else if (kind === 'eple') {
    m(sph(0.45), 0xff3b5c, 0, 0.45, 0).scale.set(1, 0.92, 1);
    m(sharedGeo('lmStem', () => new THREE.CylinderGeometry(0.04, 0.04, 0.25, 6)), COLORS.trunk, 0, 0.95, 0);
    m(sph(0.12), COLORS.leaf, 0.14, 0.98, 0).scale.set(1.4, 0.5, 0.8);
  } else if (kind === 'ball') {
    m(sph(0.48), 0x4cc9f0, 0, 0.48, 0);
    const band = m(sharedGeo('lmBand', () => new THREE.TorusGeometry(0.48, 0.07, 8, 24)), COLORS.white, 0, 0.48, 0);
    band.rotation.y = 0.6;
  } else if (kind === 'bamse') {
    m(sph(0.36), 0xc08a5a, 0, 0.36, 0);
    m(sph(0.28), 0xc08a5a, 0, 0.88, 0);
    m(sph(0.1), 0xc08a5a, -0.22, 1.1, 0);
    m(sph(0.1), 0xc08a5a, 0.22, 1.1, 0);
    m(sph(0.1), 0xf0d0a8, 0, 0.84, 0.22);
    m(sph(0.04), COLORS.ink, -0.1, 0.96, 0.24);
    m(sph(0.04), COLORS.ink, 0.1, 0.96, 0.24);
  } else if (kind === 'bil') {
    m(box('car', 1.0, 0.32, 0.55), 0xff5d73, 0, 0.3, 0);
    m(box('carTop', 0.55, 0.28, 0.5), 0xff5d73, -0.05, 0.58, 0);
    for (const [x, z] of [[-0.32, 0.28], [0.32, 0.28], [-0.32, -0.28], [0.32, -0.28]]) {
      const w = m(sharedGeo('lmWheel', () => new THREE.CylinderGeometry(0.14, 0.14, 0.1, 12)), COLORS.ink, x, 0.14, z);
      w.rotation.x = Math.PI / 2;
    }
  } else {
    m(box('book', 0.8, 0.95, 0.24), 0x9b5de5, 0, 0.48, 0);
    m(box('pages', 0.72, 0.87, 0.26, 0.03), COLORS.icing, 0.05, 0.48, 0);
  }
  return g;
}

export class PengerRound extends FieldRound {
  static key = 'penger';

  constructor(mix) {
    super(mix, { field: 0xf7e1a6, fences: [0xff9fd0, 0x8fd8ff, 0xffc08a, 0x9ff0c8], seed: 31, flowers: 0 });
    for (const e of this.ents) {
      e.itemHolder = new THREE.Group();
      this.group.add(e.itemHolder);
    }
    this.decorate();
  }

  get title() { return t('penger.title'); }
  get hint() { return t('penger.hint'); }

  howto() {
    const coin = (v) => `<span style="display:inline-block;border-radius:50%;width:1.9em;height:1.9em;line-height:1.9em;text-align:center;font-weight:700;background:${v >= 10 ? '#ffd23f' : '#d9dde8'};border:3px solid ${v >= 10 ? '#e0a100' : '#aab0c2'};margin:0 2px">${v}</span>`;
    return `<div class="edu-word" style="margin:8px 0">${coin(5)} + ${coin(1)} + ${coin(1)} = 7 kr</div>`;
  }

  decorate() {
    // A little shop stall on each side behind the field (clear of the HUD), with toys on the counter.
    const shelf = (x0, items) => {
      const counter = new THREE.Mesh(sharedGeo('lmCounter', () => new RoundedBoxGeometry(6.6, 1.1, 1.4, 2, 0.15)), toon(0xd99a62));
      counter.position.set(x0, 0.2, -HD - 2.4);
      counter.castShadow = true;
      const top = new THREE.Mesh(sharedGeo('lmCounterTop', () => new RoundedBoxGeometry(6.9, 0.18, 1.6, 2, 0.08)), toon(COLORS.icing));
      top.position.set(x0, 0.82, -HD - 2.4);
      this.group.add(counter, top);
      items.forEach((k, i) => {
        const it = makeItem(k);
        it.position.set(x0 - 2.1 + i * 2.1, 0.9, -HD - 2.4);
        it.scale.setScalar(0.85);
        this.group.add(it);
      });
      // Striped awning.
      for (let i = 0; i < 7; i++) {
        const s = new THREE.Mesh(sharedGeo('lmAwning', () => new RoundedBoxGeometry(0.96, 0.2, 1.2, 2, 0.06)), toon(i % 2 ? COLORS.white : 0xff5d73));
        s.position.set(x0 - 2.88 + i * 0.96, 2.2, -HD - 2.9);
        s.rotation.x = 0.35;
        this.group.add(s);
      }
      for (const sx of [-3.1, 3.1]) {
        const pole = new THREE.Mesh(sharedGeo('lmPole', () => new THREE.CylinderGeometry(0.08, 0.08, 2.2, 8)), toon(COLORS.white));
        pole.position.set(x0 + sx, 1.1, -HD - 3);
        this.group.add(pole);
      }
    };
    shelf(-9.6, ['is', 'eple', 'ball']);
    shelf(9.6, ['bamse', 'bil', 'bok']);
  }

  // ---------- tasks ----------

  newTask(e) {
    const lv = LEVEL[this.levelKey(e)];
    let item;
    do item = pick(ITEMS); while (e.task && item === e.task.item);
    e.task = { item, price: rnd(lv.min, lv.max), paid: [], sum: 0 };
    e.itemHolder.clear();
    e.itemHolder.add(makeItem(item));
  }

  left(e) {
    return e.task.price - e.task.sum;
  }

  /** The biggest coin that still fits (greedy) is always on the field. */
  need(e) {
    const coins = LEVEL[this.levelKey(e)].coins;
    return [...coins].reverse().find((c) => c <= this.left(e));
  }

  counts(e, tile) {
    return tile.value === this.need(e);
  }

  isRight(e, tile) {
    return tile.value <= this.left(e);
  }

  filler() {
    const e = pick(this.ents);
    const coins = LEVEL[this.levelKey(e)].coins;
    // Small coins are useful most often, so there are a few more of them.
    return Math.random() < 0.35 ? coins[0] : pick(coins);
  }

  spawnTile(value) {
    // Coins may repeat; skip the duplicate check from the base class.
    return super.spawnTile(value === undefined ? this.filler() : value);
  }

  makeTile(value) {
    const c = COIN[value];
    const g = new THREE.Group();
    const body = new THREE.Mesh(sharedGeo(`lmCoin${c.r}`, () => new THREE.CylinderGeometry(c.r, c.r, 0.28, 32)), toon(c.color));
    body.castShadow = true;
    const rim = new THREE.Mesh(sharedGeo(`lmCoinRim${c.r}`, () => new THREE.TorusGeometry(c.r, 0.08, 8, 32)), toon(c.rim));
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.1;
    const face = new THREE.Mesh(sharedGeo(`lmCoinFace${c.r}`, () => new THREE.PlaneGeometry(c.r * 1.7, c.r * 1.7)),
      textMaterial([[String(value), 1], ['kr', 0.42]], { w: 256, h: 256 }));
    face.rotation.x = -Math.PI / 2;
    face.position.y = 0.15;
    g.add(body, rim, face);
    g.rotation.x = 0.45;
    return { mesh: g, w: c.r * 2, d: c.r * 2 };
  }

  onRight(e, tile) {
    const task = e.task;
    task.paid.push(tile.value);
    task.sum += tile.value;
    this.game.audio.play('coin');
    e.ch.squash(1.2);
    this.party.puffs.burst(new THREE.Vector3(tile.x, 0.8, tile.z), COLORS.gold, { count: 8, size: 0.3, life: 0.5, speed: 2 });
    this.removeTile(tile);
    this.later(0.5, () => { if (!this.done && this.tiles.length < this.tileCount) this.spawnTile(); });
    if (task.sum === task.price) {
      e.score++;
      e.doneT = 1.5;
      this.game.audio.play('star');
      speak(`${ITEM_NAME[task.item]}, ${task.price} kroner`);
      this.party.confetti.burst(new THREE.Vector3(e.x, 2, e.z), 0, { count: 30, speed: 6, colors: [e.p.color, COLORS.gold, COLORS.white] });
      e.ch.squash(1.4);
    }
    this.ensure();
  }

  onWrong(e, tile) {
    super.onWrong(e, tile);
    this.say(e, t('penger.much'));
  }

  tag(e) {
    if (e.doneT > 0) return t('penger.bought');
    return `${esc(t('penger.kr', { n: e.task.price }))}<small>${esc(t('penger.paid', { sum: e.task.sum }))}</small>`;
  }

  tagHeight() {
    return 3.25;
  }

  card(e) {
    const task = e.task;
    // Show the sum as coins while it is short (5 + 1 + 1 = 7 kr), then just the total.
    const paid = task.paid.length > 1 && task.paid.length <= 3 ? `${task.paid.join(' + ')} = ${task.sum} kr` : `${task.sum} kr`;
    return `<div class="edu-card-head">${esc(t('penger.card', { name: e.p.name, n: e.score }))}</div>
      <div class="edu-word math" style="font-size:clamp(18px, 2vw, 34px)">${esc(ITEM_NAME[task.item])} ${task.price} kr</div>
      <div class="edu-clue" style="font-weight:700;max-width:none;white-space:nowrap">${e.doneT > 0 ? esc(t('penger.bought')) : `${esc(t('penger.paidSum', { sum: paid }))}`}</div>`;
  }

  get unit() { return t('penger.unit'); }

  update(dt, playing) {
    super.update(dt, playing);
    for (const e of this.ents) {
      const h = e.itemHolder;
      const pop = e.doneT > 0 ? 1.3 : 1;
      h.position.set(e.x, 1.75 + Math.sin(this.time * 2.5 + e.i) * 0.06 + (e.doneT > 0 ? 0.3 : 0), e.z);
      h.rotation.y = Math.sin(this.time * 1.5 + e.i) * 0.6;
      h.scale.setScalar(THREE.MathUtils.lerp(h.scale.x || 0.6, 0.6 * pop, Math.min(1, dt * 8)));
      h.visible = !!e.task;
    }
  }
}
