import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Round, clock } from './common.js';
import { makeGrumble } from '../../core/critters.js';
import { COLORS, toon, sharedGeo, faceted } from '../../core/palette.js';
import { makeTree, makeMushroom, makeCloud, starGeometry, seeded } from '../../core/world.js';
import { shuffle } from '../../core/edu.js';
import { t, addStrings } from '../../core/i18n.js';

addStrings({
  en: {
    'spot.title': 'Spot the Difference',
    'spot.hint': 'The two pictures are almost the same. Move your ring over the RIGHT picture and press [A] on each difference! Wrong guesses freeze your ring for a moment.',
    'spot.pic': 'Picture {n} of {total}', 'spot.found': 'Found {n} / {total}', 'spot.all': 'All found!',
    'spot.missed': 'Here they were!', 'spot.n': '{n} found',
  },
  no: {
    'spot.title': 'Finn forskjellene',
    'spot.hint': 'De to bildene er nesten like. Flytt ringen din over det HØYRE bildet og trykk [A] på hver forskjell! Feil gjetning fryser ringen litt.',
    'spot.pic': 'Bilde {n} av {total}', 'spot.found': 'Funnet {n} / {total}', 'spot.all': 'Alle funnet!',
    'spot.missed': 'Her var de!', 'spot.n': '{n} funnet',
  },
});

// Spot the Difference: two little dioramas side by side; mark what changed on the right one.
const BW = 7.4; // board width (x)
const BD = 6.4; // board depth (z)
const GAP = 1.4;
const PROP_SCALE = 1.3;
const CX = BW / 2 + GAP / 2; // board centers at ±CX
const PICS = 2;
const PIC_TIME = 22;
const REVEAL = 2.4;
const SPEED = 5.5;
const COOLDOWN = 1;
const CURSOR_R = 0.5;
const CURSOR_Y = 0.45;

// ---------- prop pool: every builder takes (color, rand) so both copies match ----------

const sph = (r, w = 14, h = 10) => sharedGeo(`spot-sph${r}|${w}`, () => new THREE.SphereGeometry(r, w, h));
const box = (w, h, d) => sharedGeo(`spot-box${w}|${h}|${d}`, () => new THREE.BoxGeometry(w, h, d));
const cyl = (rt, rb, h, s = 14) => sharedGeo(`spot-cyl${rt}|${rb}|${h}|${s}`, () => new THREE.CylinderGeometry(rt, rb, h, s));
const cone = (r, h, s = 14) => sharedGeo(`spot-cone${r}|${h}|${s}`, () => new THREE.ConeGeometry(r, h, s));
const tor = (r, tube, arc = Math.PI * 2) => sharedGeo(`spot-tor${r}|${tube}|${arc}`, () => new THREE.TorusGeometry(r, tube, 8, 24, arc));
const ico = (r, d = 1) => sharedGeo(`spot-ico${r}|${d}`, () => faceted(new THREE.IcosahedronGeometry(r, d)));

function m(geo, color, x = 0, y = 0, z = 0, opts) {
  const o = new THREE.Mesh(geo, toon(color, opts));
  o.position.set(x, y, z);
  o.castShadow = true;
  return o;
}

function grp(...kids) {
  const g = new THREE.Group();
  g.add(...kids);
  return g;
}

const PROPS = {
  tree: { r: 0.7, tall: true, colors: [0x4cc46a, 0xffa94d, 0xff7eb6, 0xffd23f], make: (c, rand) => makeTree(rand, 0.42, [c]) },
  pine: {
    r: 0.6, tall: true, colors: [0x2f9e5a, 0x8fd8ff, 0xc9a8ff],
    make: (c) => grp(m(cyl(0.08, 0.1, 0.3), COLORS.trunk, 0, 0.15, 0), m(cone(0.5, 0.6), c, 0, 0.55, 0), m(cone(0.38, 0.5), c, 0, 0.9, 0), m(cone(0.25, 0.4), c, 0, 1.2, 0), m(sph(0.07), COLORS.white, 0.1, 1.05, 0.2)),
  },
  palm: {
    r: 0.7, tall: true, colors: [0x4cc46a, 0xffa94d, 0x9b5de5],
    make: (c) => {
      const g = new THREE.Group();
      for (let i = 0; i < 4; i++) g.add(m(cyl(0.09, 0.11, 0.3, 8), i % 2 ? 0xc48a5a : COLORS.trunk, i * 0.04, 0.15 + i * 0.28, 0));
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const leaf = m(sph(0.3, 10, 8), c, 0.16 + Math.cos(a) * 0.32, 1.2, Math.sin(a) * 0.32);
        leaf.scale.set(1.3, 0.25, 0.55);
        leaf.rotation.y = -a;
        g.add(leaf);
      }
      g.add(m(sph(0.08), 0x8a5e3c, 0.12, 1.12, 0.08));
      return g;
    },
  },
  bush: {
    r: 0.6, colors: [0x3fae5a, 0xff9fd0, 0xffd23f],
    make: (c, rand) => {
      const g = new THREE.Group();
      for (let i = 0; i < 3; i++) {
        const b = m(ico(0.3), c, (i - 1) * 0.3, 0.22 + (i === 1 ? 0.1 : 0), (rand() - 0.5) * 0.15, { flat: true });
        b.scale.setScalar(0.85 + rand() * 0.3);
        g.add(b);
      }
      return g;
    },
  },
  flower: {
    r: 0.45, colors: [0xff7eb6, 0xffd23f, 0xffffff, 0xb08bff, 0xff8c42],
    make: (c) => {
      const g = grp(m(cyl(0.035, 0.035, 0.6, 6), COLORS.grassDark, 0, 0.3, 0));
      const leaf = m(sph(0.1, 8, 6), COLORS.leaf, 0.1, 0.25, 0);
      leaf.scale.set(1.4, 0.4, 0.7);
      g.add(leaf);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const p = m(sph(0.12, 10, 8), c, Math.cos(a) * 0.14, 0.64, Math.sin(a) * 0.14);
        p.scale.set(1, 0.5, 1);
        g.add(p);
      }
      g.add(m(sph(0.09), c === 0xffd23f ? 0xff8c42 : 0xffd23f, 0, 0.67, 0));
      return g;
    },
  },
  mushroom: {
    r: 0.5, colors: [0xff5d73, 0x4cc9f0, 0xffc93c, 0x9b5de5],
    make: (c) => { const g = makeMushroom(c); g.scale.setScalar(0.48); return g; },
  },
  rock: {
    r: 0.5, colors: [COLORS.rock],
    make: (c, rand) => { const r = m(ico(0.4, 0), c, 0, 0.18, 0, { flat: true }); r.scale.set(1, 0.7, 0.9); r.rotation.y = rand() * 6; return grp(r); },
  },
  house: {
    r: 0.75, tall: true, colors: [0xff5d73, 0x4cc9f0, 0x3ddc97, 0x9b5de5],
    make: (c) => {
      const roof = m(cone(0.72, 0.55, 4), c, 0, 0.92, 0);
      roof.rotation.y = Math.PI / 4;
      return grp(m(box(0.9, 0.65, 0.8), COLORS.cream, 0, 0.33, 0), roof, m(box(0.24, 0.38, 0.04), 0xa0704a, 0, 0.19, 0.41), m(box(0.2, 0.2, 0.04), 0x8fd8ff, 0.27, 0.42, 0.41));
    },
  },
  ball: {
    r: 0.45, colors: [0xff5d73, 0x4cc9f0, 0xffc93c, 0x3ddc97],
    make: (c) => {
      const band = m(tor(0.29, 0.05), COLORS.white, 0, 0.3, 0);
      band.rotation.x = 0.4;
      return grp(m(sph(0.3, 18, 14), c, 0, 0.3, 0), band);
    },
  },
  duck: {
    r: 0.45, colors: [0xffd23f, 0xffffff, 0xff9fd0],
    make: (c) => {
      const body = m(sph(0.28, 14, 10), c, 0, 0.25, 0);
      body.scale.set(1, 0.8, 1.25);
      const beak = m(cone(0.07, 0.18, 8), 0xff8c42, 0, 0.5, 0.33);
      beak.rotation.x = Math.PI / 2;
      return grp(body, m(sph(0.18), c, 0, 0.5, 0.18), beak, m(sph(0.035, 8, 6), COLORS.ink, 0.09, 0.56, 0.31), m(sph(0.035, 8, 6), COLORS.ink, -0.09, 0.56, 0.31));
    },
  },
  grumble: {
    r: 0.5, colors: [0x7b6cf6, 0xff8c42, 0x3ddc97, 0xff5d73],
    make: (c) => { const g = makeGrumble(c); g.scale.setScalar(0.75); return g; },
  },
  pond: {
    r: 0.8, colors: [COLORS.water],
    make: (c) => {
      const w = m(cyl(0.7, 0.7, 0.06, 24), c, 0, 0.03, 0);
      w.scale.set(1, 1, 0.7);
      w.castShadow = false;
      const rim = m(tor(0.7, 0.07), COLORS.rock, 0, 0.05, 0);
      rim.rotation.x = Math.PI / 2;
      rim.scale.set(1, 0.7, 1);
      const pad = m(cyl(0.16, 0.16, 0.03, 12), COLORS.leaf, 0.25, 0.08, 0.05);
      return grp(w, rim, pad);
    },
  },
  fence: {
    r: 0.65, colors: [0xffffff, 0xc48a5a, 0xff9fd0],
    make: (c) => {
      const g = new THREE.Group();
      for (const x of [-0.45, 0, 0.45]) g.add(m(box(0.1, 0.55, 0.1), c, x, 0.28, 0));
      for (const y of [0.2, 0.42]) g.add(m(box(1.05, 0.08, 0.06), c, 0, y, 0.03));
      return g;
    },
  },
  lamp: {
    r: 0.4, tall: true, colors: [0xffd23f, 0x4cc9f0, 0xff5d73],
    make: (c) => grp(m(cyl(0.05, 0.07, 1.0, 8), COLORS.ink, 0, 0.5, 0), m(cyl(0.16, 0.16, 0.06, 10), COLORS.ink, 0, 0.03, 0), m(sph(0.17), c, 0, 1.1, 0, { emissive: 0x332200 }), m(cone(0.2, 0.14, 10), COLORS.ink, 0, 1.3, 0)),
  },
  snowman: {
    r: 0.5, colors: [0xff5d73, 0x4cc9f0, 0x3ddc97, 0xffc93c],
    make: (c) => {
      const scarf = m(tor(0.17, 0.06), c, 0, 0.55, 0);
      scarf.rotation.x = Math.PI / 2;
      const nose = m(cone(0.04, 0.16, 6), 0xff8c42, 0, 0.72, 0.22);
      nose.rotation.x = Math.PI / 2;
      return grp(m(sph(0.3), COLORS.white, 0, 0.27, 0), m(sph(0.21), COLORS.white, 0, 0.7, 0), scarf, nose,
        m(cyl(0.13, 0.13, 0.18, 12), COLORS.ink, 0, 0.95, 0), m(cyl(0.2, 0.2, 0.03, 12), COLORS.ink, 0, 0.87, 0),
        m(sph(0.03, 6, 5), COLORS.ink, 0.07, 0.77, 0.19), m(sph(0.03, 6, 5), COLORS.ink, -0.07, 0.77, 0.19));
    },
  },
  present: {
    r: 0.5, colors: [0xff5d73, 0x4cc9f0, 0x3ddc97, 0x9b5de5],
    make: (c) => {
      const bow1 = m(tor(0.08, 0.035), COLORS.gold, 0.07, 0.62, 0);
      const bow2 = m(tor(0.08, 0.035), COLORS.gold, -0.07, 0.62, 0);
      return grp(m(box(0.55, 0.52, 0.55), c, 0, 0.26, 0), m(box(0.57, 0.53, 0.1), COLORS.gold, 0, 0.26, 0), m(box(0.1, 0.53, 0.57), COLORS.gold, 0, 0.26, 0), bow1, bow2);
    },
  },
  umbrella: {
    r: 0.75, tall: true, colors: [0xff5d73, 0x4cc9f0, 0xffc93c, 0x9b5de5],
    make: (c) => grp(m(cyl(0.03, 0.03, 1.1, 6), COLORS.white, 0, 0.55, 0), m(cone(0.7, 0.32, 10), c, 0, 1.15, 0), m(cone(0.36, 0.17, 10), COLORS.white, 0, 1.24, 0), m(sph(0.05, 8, 6), COLORS.white, 0, 1.33, 0)),
  },
  crab: {
    r: 0.5, colors: [0xff5d73, 0xff8c42, 0x9b5de5],
    make: (c) => {
      const body = m(sph(0.26, 14, 10), c, 0, 0.18, 0);
      body.scale.set(1.3, 0.6, 1);
      const g = grp(body);
      for (const s of [-1, 1]) {
        g.add(m(sph(0.11, 10, 8), c, s * 0.38, 0.22, 0.14));
        g.add(m(cyl(0.02, 0.02, 0.18, 5), c, s * 0.08, 0.36, 0.12), m(sph(0.05, 8, 6), COLORS.white, s * 0.08, 0.46, 0.12), m(sph(0.025, 6, 5), COLORS.ink, s * 0.08, 0.47, 0.16));
      }
      return g;
    },
  },
  starfish: {
    r: 0.45, colors: [0xff8c42, 0xff7eb6, 0xffd23f],
    make: (c) => {
      const g = new THREE.Group();
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const arm = m(cone(0.1, 0.36, 6), c, Math.sin(a) * 0.16, 0.05, Math.cos(a) * 0.16);
        arm.rotation.order = 'YXZ';
        arm.rotation.set(Math.PI / 2, a, 0);
        g.add(arm);
      }
      g.add(m(sph(0.12, 10, 8), c, 0, 0.06, 0));
      return g;
    },
  },
  bucket: {
    r: 0.4, colors: [0x4cc9f0, 0xff5d73, 0x3ddc97, 0xffc93c],
    make: (c) => {
      const handle = m(tor(0.2, 0.025, Math.PI), COLORS.ink, 0, 0.42, 0);
      return grp(m(cyl(0.24, 0.18, 0.42, 14), c, 0, 0.21, 0), m(cyl(0.22, 0.22, 0.03, 14), COLORS.sand, 0, 0.41, 0), handle);
    },
  },
  lolly: {
    r: 0.4, tall: true, colors: [0xff7eb6, 0x4cc9f0, 0x3ddc97, 0xffc93c],
    make: (c) => {
      const disc = m(cyl(0.32, 0.32, 0.1, 20), c, 0, 0.95, 0);
      disc.rotation.x = Math.PI / 2;
      const swirl = m(tor(0.18, 0.04), COLORS.white, 0, 0.95, 0.06);
      return grp(m(cyl(0.03, 0.03, 0.8, 6), COLORS.white, 0, 0.4, 0), disc, swirl, m(sph(0.06, 8, 6), COLORS.white, 0, 0.95, 0.06));
    },
  },
  cupcake: {
    r: 0.45, colors: [0xfffaf2, 0xff9fd0, 0x8fd8ff, 0xc9a8ff],
    make: (c) => {
      const icing = m(sph(0.27, 16, 10), c, 0, 0.36, 0);
      icing.scale.set(1, 0.75, 1);
      return grp(m(cyl(0.25, 0.18, 0.3, 12), 0xff5d73, 0, 0.15, 0), icing, m(sph(0.08, 10, 8), 0xe0103a, 0, 0.6, 0));
    },
  },
  gumdrop: {
    r: 0.4, colors: [0xff5d73, 0x3ddc97, 0xffc93c, 0x9b5de5],
    make: (c) => { const g = m(sph(0.3, 16, 10), c, 0, 0.15, 0); g.scale.set(1, 1.1, 1); return grp(g, m(cyl(0.3, 0.3, 0.02, 16), c, 0, 0.01, 0)); },
  },
  donut: {
    r: 0.5, colors: [0xff9fd0, 0x8fd8ff, 0xfffaf2, 0x9b5de5],
    make: (c) => {
      const dough = m(tor(0.24, 0.13), 0xe0a060, 0, 0.16, 0);
      dough.rotation.x = Math.PI / 2;
      const icing = m(tor(0.24, 0.11), c, 0, 0.22, 0);
      icing.rotation.x = Math.PI / 2;
      icing.scale.set(1, 1, 0.6);
      return grp(dough, icing);
    },
  },
  star: {
    r: 0.45, colors: [0xffd23f, 0xff7eb6, 0x4cc9f0],
    make: (c) => {
      const s = m(starGeometry(), c, 0, 0.55, 0, { emissive: 0x221100 });
      s.scale.setScalar(0.9);
      return grp(s, m(cyl(0.12, 0.16, 0.12, 10), COLORS.white, 0, 0.06, 0));
    },
  },
  gem: {
    r: 0.4, colors: [0x4cc9f0, 0xff5d73, 0x3ddc97, 0x9b5de5],
    make: (c) => {
      const g = m(sharedGeo('spot-gem', () => new THREE.OctahedronGeometry(0.26, 0)), c, 0, 0.42, 0, { flat: true, emissive: 0x111122 });
      g.scale.y = 1.3;
      return grp(g, m(cyl(0.16, 0.2, 0.1, 8), COLORS.white, 0, 0.05, 0));
    },
  },
};

const THEMES = [
  { ground: 0x8ee06a, side: 0x58b947, props: ['tree', 'bush', 'flower', 'mushroom', 'rock', 'house', 'ball', 'duck', 'grumble', 'pond', 'fence', 'flower'] },
  { ground: 0xf7e1a6, side: 0xe0c27e, props: ['palm', 'umbrella', 'ball', 'crab', 'starfish', 'bucket', 'rock', 'duck', 'pond', 'grumble', 'starfish'] },
  { ground: 0xf2f6ff, side: 0xc8d8f0, props: ['pine', 'snowman', 'present', 'rock', 'lamp', 'house', 'ball', 'grumble', 'fence', 'star', 'present'] },
  { ground: 0xc9f2e0, side: 0x9ff0c8, props: ['lolly', 'cupcake', 'gumdrop', 'donut', 'star', 'gem', 'mushroom', 'grumble', 'ball', 'present', 'lolly'] },
];

// 5 x 4 slot grid on a board; jittered so it never looks like a grid.
const COLS = 4, ROWS = 4;
const slotPos = (s) => ({ x: -BW / 2 + 0.95 + (s % COLS) * ((BW - 1.9) / (COLS - 1)), z: -BD / 2 + 0.85 + Math.floor(s / COLS) * ((BD - 1.7) / (ROWS - 1)) });
const pick = (list) => list[Math.floor(Math.random() * list.length)];

/** Builds one picture spec (left) plus its changed copy (right) and the list of differences. */
function makePuzzle(theme) {
  const free = shuffle([...Array(COLS * ROWS).keys()]);
  const used = free.splice(0, 10 + Math.floor(Math.random() * 2));
  const items = used.map((slot) => {
    const row = Math.floor(slot / COLS);
    let kind = pick(theme.props);
    for (let k = 0; k < 6 && PROPS[kind].tall && row > 1; k++) kind = pick(theme.props); // tall things at the back
    if (PROPS[kind].tall && row > 1) kind = 'flower' in PROPS && theme.props.includes('flower') ? 'flower' : 'ball';
    const p = slotPos(slot);
    return { kind, slot, x: p.x + (Math.random() - 0.5) * 0.5, z: p.z + (Math.random() - 0.5) * 0.35, color: pick(PROPS[kind].colors), scale: 1, seed: Math.floor(Math.random() * 1e6) };
  });
  const left = items.map((it) => ({ ...it }));
  const right = items.map((it) => ({ ...it }));
  const diffs = [];
  const count = 5 + Math.floor(Math.random() * 3);
  const types = shuffle(['missing', 'color', 'size', 'moved', 'extra', 'color', 'missing', 'size', 'extra', 'color']);
  const touched = new Set();
  const farFromDiffs = (x, z) => diffs.every((d) => Math.hypot(d.x - x, d.z - z) > 1.3);
  for (const type of types) {
    if (diffs.length >= count) break;
    if (type === 'extra') {
      const slot = free.find((s) => { const p = slotPos(s); return farFromDiffs(p.x, p.z) && (Math.floor(s / COLS) <= 1 || !theme.props.every((k) => PROPS[k].tall)); });
      if (slot === undefined) continue;
      free.splice(free.indexOf(slot), 1);
      const row = Math.floor(slot / COLS);
      const kinds = theme.props.filter((k) => !PROPS[k].tall || row <= 1);
      const kind = pick(kinds);
      const p = slotPos(slot);
      right.push({ kind, slot, x: p.x, z: p.z, color: pick(PROPS[kind].colors), scale: 1, seed: Math.floor(Math.random() * 1e6) });
      diffs.push({ type, x: p.x, z: p.z, r: PROPS[kind].r * PROP_SCALE + 0.1 });
      continue;
    }
    const cands = shuffle(right.map((_, i) => i).filter((i) => i < items.length && !touched.has(i) && farFromDiffs(items[i].x, items[i].z)));
    let done = false;
    for (const i of cands) {
      const it = right[i];
      const prop = PROPS[it.kind];
      if (type === 'color') {
        if (prop.colors.length < 2) continue;
        it.color = pick(prop.colors.filter((c) => c !== it.color));
      } else if (type === 'size') {
        it.scale = prop.tall ? 0.55 : Math.random() < 0.6 ? 1.45 : 0.55;
      } else if (type === 'missing') {
        it.gone = true;
      } else if (type === 'moved') {
        // Hop to a free neighbouring slot.
        const s0 = it.slot;
        const near = free.filter((s) => {
          const ds = Math.abs((s % COLS) - (s0 % COLS)) + Math.abs(Math.floor(s / COLS) - Math.floor(s0 / COLS));
          return ds === 1 && (!prop.tall || Math.floor(s / COLS) <= 1);
        });
        if (!near.length) continue;
        const s = pick(near);
        const p = slotPos(s);
        if (!farFromDiffs((p.x + it.x) / 2, (p.z + it.z) / 2)) continue;
        free.splice(free.indexOf(s), 1);
        const from = { x: it.x, z: it.z };
        it.x = p.x; it.z = p.z;
        diffs.push({ type, x: (from.x + p.x) / 2, z: (from.z + p.z) / 2, r: Math.hypot(p.x - from.x, p.z - from.z) / 2 + prop.r * PROP_SCALE * 0.8, pts: [from, { x: p.x, z: p.z }], pr: prop.r * PROP_SCALE });
        touched.add(i);
        done = true;
        break;
      }
      diffs.push({ type, x: it.x, z: it.z, r: prop.r * PROP_SCALE * (type === 'size' && it.scale > 1 ? 1.3 : 1) + 0.05 });
      touched.add(i);
      done = true;
      break;
    }
    if (!done) continue;
  }
  return { left, right: right.filter((it) => !it.gone), diffs };
}

function disposeTree(obj) {
  obj.traverse((o) => {
    if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose();
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const mt of mats) if (!mt.userData.shared) mt.dispose();
  });
}

export class SpotRound extends Round {
  static key = 'spot';

  constructor(party) {
    super(party);
    this.build();
    this.pic = 0;
    this.phase = 'idle';
    this.phaseT = 0;
    this.t = 0;
    this.themes = shuffle([...THEMES.keys()]);
    this.ringGeo = new THREE.TorusGeometry(CURSOR_R, 0.06, 8, 32);
    this.dotGeo = new THREE.CircleGeometry(0.09, 12);
    this.tickGeo = new THREE.PlaneGeometry(0.07, 0.26);
    this.ents = this.players.map((p, i) => {
      const n = this.players.length;
      const mk = (opacity) => new THREE.MeshBasicMaterial({ color: p.color, transparent: true, opacity, depthTest: false });
      const matOn = mk(1), matGhost = mk(0.55), matOff = new THREE.MeshBasicMaterial({ color: 0x9a94b2, transparent: true, opacity: 0.8, depthTest: false });
      const ring = this.cursorMesh(matOn);
      const ghost = this.cursorMesh(matGhost);
      this.right.add(ring);
      this.left.add(ghost);
      const x = n === 1 ? 0 : -BW / 2 + 1 + (i / (n - 1)) * (BW - 2);
      return { p, ring, ghost, matOn, matOff, x, z: BD / 2 - 0.9, cool: 0, found: 0, wobble: 0 };
    });
    this.newPicture();
  }

  get title() { return t('spot.title'); }
  get hint() { return t('spot.hint'); }

  cursorMesh(mat) {
    const g = new THREE.Group();
    const ring = new THREE.Mesh(this.ringGeo, mat);
    ring.rotation.x = -Math.PI / 2;
    const dot = new THREE.Mesh(this.dotGeo, mat);
    dot.rotation.x = -Math.PI / 2;
    g.add(ring, dot);
    // Crosshair ticks so the cursor never looks like a found-circle.
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const tick = new THREE.Mesh(this.tickGeo, mat);
      tick.rotation.set(-Math.PI / 2, 0, a);
      tick.position.set(Math.sin(a) * (CURSOR_R + 0.12), 0, Math.cos(a) * (CURSOR_R + 0.12));
      g.add(tick);
    }
    g.children.forEach((c) => { c.renderOrder = 20; });
    g.position.y = CURSOR_Y;
    return g;
  }

  build() {
    const g = this.group;
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(120, 80), toon(COLORS.grassDark));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.62;
    ground.receiveShadow = true;
    g.add(ground);
    // A big picnic table both pictures sit on.
    const table = new THREE.Mesh(new RoundedBoxGeometry(BW * 2 + GAP + 2.4, 0.5, BD + 2.6, 3, 0.2), toon(0xe0a96d));
    table.position.y = -0.55;
    table.receiveShadow = true;
    g.add(table);
    for (let i = -4; i <= 4; i++) {
      const plank = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.02, BD + 2.6), toon(0xc48a5a));
      plank.position.set(i * 2.25, -0.3, 0);
      g.add(plank);
    }
    this.left = new THREE.Group();
    this.right = new THREE.Group();
    this.left.position.x = -CX;
    this.right.position.x = CX;
    for (const side of [this.left, this.right]) {
      const frame = new THREE.Mesh(new RoundedBoxGeometry(BW + 0.7, 0.4, BD + 0.7, 3, 0.15), toon(side === this.right ? 0xff7eb6 : 0x4cc9f0));
      frame.position.y = -0.26;
      frame.receiveShadow = true;
      side.add(frame);
      g.add(side);
    }
    const rand = seeded(12);
    for (let i = 0; i < 5; i++) {
      const c = makeCloud(rand, 2.2);
      c.position.set(-24 + i * 12, 9 + rand() * 3, -22);
      g.add(c);
    }
    for (let i = 0; i < 14; i++) {
      const tr = makeTree(rand, 1.4 + rand() * 0.5);
      tr.position.set(-26 + i * 4 + rand() * 2, -0.6, -11 - rand() * 4);
      g.add(tr);
    }
  }

  frame() {
    const w = BW * 2 + GAP + 1.4;
    const d = this.party.fitDistance(w * 1.16, BD + 3.4);
    this.camera.position.set(0, d * 0.8, d * 0.6);
    this.camera.lookAt(0, 0, 0.2);
  }

  /** Clears the old dioramas and builds a fresh puzzle. */
  newPicture() {
    for (const k of ['picL', 'picR', 'marks']) {
      if (this[k]) { this[k].parent.remove(this[k]); disposeTree(this[k]); }
    }
    const theme = THEMES[this.themes[this.pic % THEMES.length]];
    const puzzle = makePuzzle(theme);
    this.diffs = puzzle.diffs.map((d) => ({ ...d, found: null }));
    this.picL = this.makeDiorama(theme, puzzle.left);
    this.picR = this.makeDiorama(theme, puzzle.right);
    this.left.add(this.picL);
    this.right.add(this.picR);
    this.marks = new THREE.Group();
    this.group.add(this.marks);
    this.pop = 0;
  }

  makeDiorama(theme, items) {
    const g = new THREE.Group();
    const top = new THREE.Mesh(sharedGeo(`spot-top`, () => new RoundedBoxGeometry(BW, 0.3, BD, 2, 0.1)), toon(theme.ground));
    top.position.y = -0.13;
    top.receiveShadow = true;
    g.add(top);
    const props = new THREE.Group();
    for (const it of items) {
      const o = PROPS[it.kind].make(it.color, seeded(it.seed));
      const wrap = new THREE.Group();
      wrap.add(o);
      wrap.position.set(it.x, 0, it.z);
      wrap.scale.setScalar(it.scale * PROP_SCALE);
      props.add(wrap);
    }
    g.add(props);
    g.userData.props = props;
    return g;
  }

  /** Circle drawn over the picture (always visible on top of props). */
  ring(d, side, color, blink = false) {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, depthTest: false });
    const mesh = new THREE.Mesh(new THREE.TorusGeometry(d.r, 0.14, 8, 40), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(side.position.x + d.x, 0.3, d.z);
    mesh.renderOrder = 15;
    mesh.userData.blink = blink;
    this.marks.add(mesh);
    return mesh;
  }

  start() {
    this.phase = 'look';
    this.phaseT = PIC_TIME;
  }

  mark(e) {
    let best = null, bd = Infinity;
    for (const d of this.diffs) {
      if (d.found) continue;
      let dist = Math.hypot(d.x - e.x, d.z - e.z);
      if (d.pts) {
        const near = Math.min(...d.pts.map((q) => Math.hypot(q.x - e.x, q.z - e.z)));
        if (near < d.pr * 0.6 + 0.18) dist = Math.min(dist, 0);
      }
      if (dist < (d.pts ? d.r * 0.8 : d.r * 0.6 + 0.18) && dist < bd) { best = d; bd = dist; }
    }
    if (!best) {
      // Gentle miss: the ring freezes for a moment.
      e.cool = COOLDOWN;
      e.wobble = 0.4;
      this.game.audio.play('bump');
      this.party.puffs.burst(new THREE.Vector3(CX + e.x, 0.5, e.z), 0xffffff, { count: 6, size: 0.25, life: 0.35 });
      return;
    }
    best.found = e;
    e.found++;
    this.game.audio.play('coin');
    for (const side of [this.left, this.right]) {
      const r = this.ring(best, side, e.p.color);
      r.scale.setScalar(1.6);
      this.party.confetti.burst(new THREE.Vector3(side.position.x + best.x, 0.8, best.z), 0, { count: 14, speed: 4, colors: [e.p.color, COLORS.white], life: 0.7 });
    }
    if (this.diffs.every((d) => d.found)) {
      this.phase = 'clear';
      this.phaseT = 1.8;
      this.game.audio.play('star');
      this.game.ui.banner(t('spot.all'), '', 1400);
    }
  }

  revealMissed() {
    let any = false;
    for (const d of this.diffs) {
      if (d.found) continue;
      any = true;
      for (const side of [this.left, this.right]) this.ring(d, side, 0xffffff, true);
    }
    if (any) this.game.ui.banner(t('spot.missed'), '', 1500);
  }

  update(dt, playing) {
    this.time += dt;
    // Props pop in when a new picture appears.
    this.pop = Math.min(1, this.pop + dt * 2.5);
    const s = this.pop < 1 ? 1 + Math.sin(this.pop * Math.PI) * 0.15 : 1;
    for (const pic of [this.picL, this.picR]) pic.userData.props.scale.set(1, Math.max(0.01, Math.min(1, this.pop * 1.4)) * s, 1);
    for (const r of this.marks.children) {
      r.scale.setScalar(Math.max(1, r.scale.x - dt * 3));
      if (r.userData.blink) r.visible = Math.sin(this.time * 12) > -0.3;
    }

    if (playing) {
      this.t += dt;
      this.phaseT -= dt;
      if (this.phase === 'look' && this.phaseT <= 0) {
        this.phase = 'reveal';
        this.phaseT = REVEAL;
        this.game.audio.play('beep');
        this.revealMissed();
      } else if ((this.phase === 'reveal' || this.phase === 'clear') && this.phaseT <= 0) {
        this.pic++;
        if (this.pic >= PICS) { this.phase = 'over'; this.done = true; }
        else {
          this.newPicture();
          this.phase = 'look';
          this.phaseT = PIC_TIME;
          this.game.audio.play('whoosh');
        }
      }
    }

    const looking = playing && this.phase === 'look';
    for (const e of this.ents) {
      e.cool -= dt;
      e.wobble = Math.max(0, e.wobble - dt);
      const d = looking && e.cool <= 0 ? this.input(e.p) : { x: 0, y: 0, aPressed: false };
      const ix = Math.abs(d.x) > 0.15 ? d.x : 0, iz = Math.abs(d.y) > 0.15 ? -d.y : 0;
      e.x = THREE.MathUtils.clamp(e.x + ix * SPEED * dt, -BW / 2 + 0.2, BW / 2 - 0.2);
      e.z = THREE.MathUtils.clamp(e.z + iz * SPEED * dt, -BD / 2 + 0.2, BD / 2 - 0.2);
      if (looking && d.aPressed && e.cool <= 0) this.mark(e);
      const shake = e.wobble > 0 ? Math.sin(this.time * 50) * 0.12 : 0;
      const mat = e.cool > 0 ? e.matOff : e.matOn;
      e.ring.children.forEach((c) => { c.material = mat; });
      const pulse = 1 + Math.sin(this.time * 5 + e.x) * 0.05;
      e.ring.position.set(e.x + shake, CURSOR_Y, e.z);
      e.ring.scale.setScalar(pulse);
      e.ghost.position.set(e.x, CURSOR_Y, e.z);
      e.ring.visible = e.ghost.visible = this.phase !== 'over';
    }
  }

  hud() {
    const found = this.diffs.filter((d) => d.found).length;
    return `<div class="pill">${t('spot.pic', { n: Math.min(PICS, this.pic + 1), total: PICS })}</div>`
      + `<div class="pill"><b>${t('spot.found', { n: found, total: this.diffs.length })}</b></div>`
      + clock(this.phase === 'look' ? this.phaseT : this.phase === 'idle' ? PIC_TIME : 0);
  }

  score(p) {
    return this.ents.find((x) => x.p === p).found;
  }

  detail(p) {
    return t('spot.n', { n: this.score(p) });
  }

  dispose() {
    this.ringGeo.dispose();
    this.dotGeo.dispose();
    this.tickGeo.dispose();
    for (const e of this.ents) { e.matOff.dispose(); e.matOn.dispose(); }
    super.dispose();
  }
}
