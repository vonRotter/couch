import * as THREE from 'three';
import { COLORS, toon, sharedGeo } from '../../core/palette.js';
import { makeGrumble } from '../../core/critters.js';
import { mesh, sph, boxG, cylG, coneG, WOOD, WOOD_DARK } from './props.js';

// Toon models for scene 2 (Pudding Island town, the Pudding Parlor and the deck of The Soggy Biscuit):
// Granny Grumbleton, Wobbles the pudding, Clawdia the crab, pudding houses, the custard fountain,
// the nervous statue, the famous underpants and the little inventory items.

const CREAM = 0xfff1d6;
const CARAMEL = 0xc77d2a;

// ---------- items ----------

export function makeCoin() {
  const g = new THREE.Group();
  const disc = mesh(cylG(0.32, 0.32, 0.07, 22), toon(COLORS.gold), 0, 0, 0);
  disc.rotation.x = Math.PI / 2;
  const rim = mesh(sharedGeo('adv-coinRim', () => new THREE.TorusGeometry(0.27, 0.025, 6, 22)), toon(0xffb627), 0, 0, 0.04);
  // A tiny embossed spoon (Pudding Island money, of course)
  const handle = mesh(boxG(0.05, 0.28, 0.02), toon(0xffb627), 0, -0.05, 0.045);
  const bowl = mesh(sph(0.07, 10, 8), toon(0xffb627), 0, 0.12, 0.045);
  bowl.scale.set(1, 1.3, 0.3);
  g.add(disc, rim, handle, bowl);
  return g;
}

/** A bowl of Never-Wobble Pudding: grey-beige, stern, with a caramel cap. */
export function makePuddingBowl() {
  const g = new THREE.Group();
  const bowl = mesh(sharedGeo('adv-bowl', () => new THREE.SphereGeometry(0.42, 18, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2)), toon(0x6fa8dc), 0, 0.42, 0);
  const rim = mesh(sharedGeo('adv-bowlRim', () => new THREE.TorusGeometry(0.42, 0.04, 6, 20)), toon(0x5a8fc4), 0, 0.42, 0);
  rim.rotation.x = Math.PI / 2;
  const pud = mesh(cylG(0.26, 0.36, 0.34, 18), toon(0xbfae98), 0, 0.55, 0);
  const cap = mesh(cylG(0.25, 0.27, 0.06, 18), toon(0x9a7a52), 0, 0.73, 0);
  g.add(bowl, rim, pud, cap);
  // Little stern eyebrows: it never wobbles, and it's proud of it
  for (const s of [-1, 1]) {
    const br = mesh(boxG(0.1, 0.025, 0.02), toon(COLORS.ink), s * 0.09, 0.66, 0.31, false);
    br.rotation.z = s * 0.3;
    g.add(br);
  }
  return g;
}

/** The enormous underpants with little yellow ducks. userData.body for flapping. */
export function makeUnderpants() {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const pink = toon(0xffa8c8);
  body.add(mesh(boxG(1.6, 0.18, 0.12), toon(0xffffff), 0, 0.02, 0)); // waistband
  body.add(mesh(boxG(1.5, 0.55, 0.1), pink, 0, -0.33, 0));
  for (const s of [-1, 1]) {
    const leg = mesh(boxG(0.62, 0.55, 0.1), pink, s * 0.44, -0.82, 0);
    leg.rotation.z = s * 0.1;
    body.add(leg);
    body.add(mesh(boxG(0.66, 0.08, 0.12), toon(0xffffff), s * 0.47, -1.1, 0, false).rotateZ(s * 0.1));
  }
  // Little yellow ducks (a dot with a head), front and back
  const yellow = toon(0xffd23f);
  for (const [x, y] of [[-0.5, -0.3], [0.05, -0.45], [0.55, -0.25], [-0.42, -0.85], [0.48, -0.8], [-0.1, -0.2]]) {
    for (const z of [0.06, -0.06]) {
      const d = mesh(sph(0.07, 8, 6), yellow, x, y, z, false);
      d.scale.set(1.3, 0.85, 0.4);
      const h = mesh(sph(0.045, 8, 6), yellow, x + 0.07 * Math.sign(z), y + 0.07, z, false);
      h.scale.z = 0.5;
      body.add(d, h);
    }
  }
  g.userData = { body };
  return g;
}

// ---------- characters ----------

/** Granny Grumbleton: a small lavender grumble with a bun, glasses, shawl and knitting. */
export function makeGranny() {
  const outer = new THREE.Group();
  const g = makeGrumble(0xb59ce8);
  g.scale.setScalar(1.45);
  outer.add(g);
  // White hair bun
  const hair = toon(0xf4f0ff);
  g.add(mesh(sph(0.2, 12, 10), hair, 0, 0.9, -0.05));
  g.add(mesh(sph(0.13, 10, 8), hair, 0, 1.08, -0.08));
  for (const s of [-1, 1]) g.add(mesh(sph(0.14, 10, 8), hair, s * 0.28, 0.8, -0.05));
  // Hairpin
  g.add(mesh(cylG(0.012, 0.012, 0.34, 5), toon(0xff6fae), 0.02, 1.1, -0.08, false).rotateZ(1.2));
  // Round glasses
  for (const s of [-1, 1]) {
    const rim = mesh(sharedGeo('adv-glass', () => new THREE.TorusGeometry(0.11, 0.018, 6, 16)), toon(0xd4a52a), s * 0.15, 0.55, 0.46, false);
    g.add(rim);
  }
  g.add(mesh(boxG(0.1, 0.02, 0.02), toon(0xd4a52a), 0, 0.57, 0.47, false));
  // Pink shawl over the "shoulders"
  const shawl = mesh(cylG(0.36, 0.47, 0.22, 18), toon(0xff8fb8), 0, 0.3, 0);
  g.add(shawl);
  const knot = mesh(sph(0.07, 8, 6), toon(0xff6fae), 0, 0.26, 0.45);
  g.add(knot);
  // Rosy cheeks
  for (const s of [-1, 1]) {
    const ch = mesh(sph(0.06, 8, 6), toon(0xff9fb0), s * 0.27, 0.43, 0.38, false);
    ch.scale.set(1, 0.6, 0.4);
    g.add(ch);
  }
  // Knitting: two needles and a growing bit of scarf
  const knit = new THREE.Group();
  knit.position.set(0, 0.32, 0.5);
  for (const s of [-1, 1]) {
    const n = mesh(cylG(0.012, 0.012, 0.5, 5), toon(0xc0c6d8), s * 0.1, 0.12, 0, false);
    n.rotation.z = s * 0.7;
    knit.add(n);
  }
  knit.add(mesh(boxG(0.26, 0.16, 0.05), toon(0x7bd389), 0, -0.02, 0, false));
  knit.add(mesh(boxG(0.26, 0.05, 0.055), toon(0xffd84a), 0, -0.06, 0, false));
  g.add(knit);
  // Feather duster for Tickle Fencing (hidden until the duel)
  const duster = new THREE.Group();
  duster.add(mesh(cylG(0.02, 0.02, 0.5, 6), toon(WOOD_DARK), 0, 0.25, 0));
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const f = mesh(sph(0.07, 8, 6), toon(i % 2 ? 0x8fd8ff : 0xffd84a), Math.cos(a) * 0.06, 0.55, Math.sin(a) * 0.06);
    f.scale.set(0.7, 1.8, 0.7);
    duster.add(f);
  }
  duster.position.set(0.5, 0.25, 0.2);
  duster.rotation.z = -0.5;
  duster.visible = false;
  g.add(duster);
  outer.userData = { inner: g, knit, duster };
  return outer;
}

/** Wobbles, a strawberry pudding who would like to be a sailor. userData.body wobbles, mouth talks. */
export function makeWobbles() {
  const outer = new THREE.Group();
  const body = new THREE.Group();
  outer.add(body);
  body.add(mesh(cylG(0.32, 0.42, 0.55, 22), toon(0xff6f91), 0, 0.3, 0));
  // Ridges of the mould
  for (let i = 0; i < 3; i++) {
    const r = mesh(sharedGeo('adv-wobRing', () => new THREE.TorusGeometry(1, 0.035, 6, 22)), toon(0xff8fab), 0, 0.12 + i * 0.17, 0, false);
    r.rotation.x = Math.PI / 2;
    r.scale.setScalar(0.415 - i * 0.03);
    body.add(r);
  }
  body.add(mesh(cylG(0.3, 0.33, 0.08, 22), toon(CARAMEL), 0, 0.6, 0));
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + 0.3;
    const drip = mesh(sph(0.05, 8, 6), toon(CARAMEL), Math.cos(a) * 0.31, 0.53, Math.sin(a) * 0.31, false);
    drip.scale.y = 1.6;
    body.add(drip);
  }
  const cream = mesh(sph(0.14, 12, 8), toon(0xffffff), 0, 0.68, 0);
  cream.scale.y = 0.7;
  body.add(cream, mesh(sph(0.07, 10, 8), toon(0xe0364f), 0, 0.8, 0));
  for (const s of [-1, 1]) {
    const w = mesh(sph(0.075, 10, 8), toon(0xffffff), s * 0.11, 0.38, 0.33);
    w.scale.set(1, 1.2, 0.5);
    body.add(w, mesh(sph(0.04, 8, 6), toon(COLORS.ink), s * 0.11, 0.37, 0.37, false));
  }
  const mouth = mesh(sph(0.05, 8, 6), toon(0x7a1f3a), 0, 0.24, 0.36, false);
  mouth.scale.set(1.4, 0.4, 0.4);
  body.add(mouth);
  outer.userData = { body, mouth };
  return outer;
}

/** A paper pirate hat folded from the note (it still says SHAME ON YOU). */
export function makePaperHat() {
  const g = new THREE.Group();
  const paper = toon(0xfff3d6);
  const hat = mesh(coneG(0.32, 0.34, 3), paper, 0, 0.12, 0);
  hat.scale.set(1, 1, 0.3);
  hat.rotation.y = Math.PI / 2;
  g.add(hat);
  g.add(mesh(boxG(0.5, 0.05, 0.1), paper, 0, -0.03, 0));
  for (let i = 0; i < 3; i++) g.add(mesh(boxG(0.18 - i * 0.03, 0.02, 0.01), toon(0x5a4f7a), -0.02, 0.05 + i * 0.05, 0.06, false));
  g.add(mesh(cylG(0.035, 0.035, 0.015, 10), toon(0xe0364f), 0.12, 0.01, 0.06, false).rotateX(Math.PI / 2));
  return g;
}

/** Clawdia the crab: navigator, Tickle Fencer, crab. Faces +z. userData: claws, eyes, hat, legs. */
export function makeClawdia() {
  const outer = new THREE.Group();
  const g = new THREE.Group();
  outer.add(g);
  const red = toon(0xff6b4a);
  const dark = toon(0xd94a2f);
  const body = mesh(sph(0.3, 16, 12), red, 0, 0.32, 0);
  body.scale.set(1.35, 0.62, 0.95);
  g.add(body);
  // Spots on the shell
  for (const [x, z] of [[-0.18, 0.12], [0.15, 0.18], [0.02, -0.05]]) {
    const spot = mesh(sph(0.045, 8, 6), dark, x, 0.49, z, false);
    spot.scale.set(1, 0.4, 1);
    g.add(spot);
  }
  // Eye stalks
  const eyes = new THREE.Group();
  for (const s of [-1, 1]) {
    eyes.add(mesh(cylG(0.025, 0.03, 0.22, 6), red, s * 0.1, 0.5, 0.18));
    eyes.add(mesh(sph(0.07, 10, 8), toon(0xffffff), s * 0.1, 0.63, 0.19));
    eyes.add(mesh(sph(0.038, 8, 6), toon(COLORS.ink), s * 0.1, 0.63, 0.25, false));
  }
  g.add(eyes);
  // Smile
  const smile = mesh(sharedGeo('adv-smile', () => new THREE.TorusGeometry(0.07, 0.015, 5, 10, Math.PI)), toon(0x7a1f1a), 0, 0.32, 0.28, false);
  smile.rotation.z = Math.PI;
  g.add(smile);
  // Legs: three a side, sticking out sideways
  const legs = [];
  for (const s of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const leg = mesh(cylG(0.025, 0.02, 0.36, 5), dark, s * 0.42, 0.18, -0.12 + i * 0.12);
      leg.rotation.z = s * 1.0;
      g.add(leg);
      legs.push(leg);
    }
  }
  // Claws (pincers), raised for fencing
  const claws = [];
  for (const s of [-1, 1]) {
    const c = new THREE.Group();
    c.position.set(s * 0.36, 0.38, 0.14);
    c.add(mesh(cylG(0.04, 0.045, 0.28, 6), red, 0, 0.12, 0).rotateZ(-s * 0.4));
    const top = mesh(sph(0.11, 10, 8), red, s * 0.07, 0.3, 0);
    top.scale.set(1.1, 1.2, 0.7);
    const nip = mesh(coneG(0.05, 0.16, 6), dark, s * 0.13, 0.42, 0);
    nip.rotation.z = -s * 0.5;
    c.add(top, nip);
    g.add(c);
    claws.push(c);
  }
  const hat = makePaperHat();
  hat.position.set(0, 0.56, -0.02);
  hat.scale.setScalar(0.85);
  hat.visible = false;
  g.add(hat);
  outer.userData = { inner: g, claws, eyes, hat, legs };
  return outer;
}

// ---------- town ----------

const HOUSE_COLORS = [0xff8fab, 0xffe6a3, 0xb6e3a1, 0xa9b8ff, 0xffc49b, 0xd9b3ff];

/** A house shaped like a pudding (Never-Wobble Pudding: rock solid). */
export function makePuddingHouse(color, { w = 1.8, h = 2.4, door = true, windows = 2, cherry = true, cap = CARAMEL } = {}) {
  const g = new THREE.Group();
  const r = w / 2;
  const body = mesh(cylG(r * 0.82, r, h, 20), toon(color), 0, h / 2, 0);
  body.receiveShadow = true;
  g.add(body);
  g.add(mesh(cylG(r * 0.8, r * 0.86, 0.26, 20), toon(cap), 0, h + 0.08, 0));
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + 0.2;
    const drip = mesh(sph(0.11, 8, 6), toon(cap), Math.cos(a) * r * 0.85, h - 0.08, Math.sin(a) * r * 0.85, false);
    drip.scale.set(1, 1.5 + (i % 3) * 0.4, 1);
    g.add(drip);
  }
  const cream = mesh(sph(r * 0.5, 12, 8), toon(0xffffff), 0, h + 0.25, 0);
  cream.scale.y = 0.6;
  g.add(cream);
  if (cherry) g.add(mesh(sph(r * 0.2, 10, 8), toon(0xe0364f), 0, h + 0.5, 0));
  if (door) {
    const d = mesh(boxG(0.5, 0.85, 0.1), toon(0x8f5f3a), 0, 0.43, r * 0.93, false);
    g.add(d, mesh(sph(0.04, 8, 6), toon(COLORS.gold), 0.15, 0.43, r * 0.95 + 0.05, false));
    const arch = mesh(cylG(0.25, 0.25, 0.1, 14), toon(0x8f5f3a), 0, 0.85, r * 0.93, false);
    arch.rotation.x = Math.PI / 2;
    g.add(arch);
  }
  for (let i = 0; i < windows; i++) {
    const x = (i - (windows - 1) / 2) * r * 0.9;
    const y = h * 0.66;
    const z = Math.sqrt(Math.max(0, r * r * 0.86 - x * x)) + 0.02;
    const win = mesh(boxG(0.36, 0.36, 0.06), toon(0xfff2b8), x, y, z, false);
    win.rotation.y = Math.atan2(x, z);
    const frame = mesh(boxG(0.44, 0.06, 0.07), toon(0xffffff), x, y, z + 0.01, false);
    frame.rotation.y = win.rotation.y;
    const frame2 = mesh(boxG(0.06, 0.44, 0.07), toon(0xffffff), x, y, z + 0.01, false);
    frame2.rotation.y = win.rotation.y;
    g.add(win, frame, frame2);
  }
  return g;
}
export { HOUSE_COLORS };

/** The Custard Fountain. userData: jet (scaled for splashing), pool, coin. */
export function makeFountain() {
  const g = new THREE.Group();
  const stone = toon(0xe8dcc8);
  const basin = mesh(cylG(1.05, 1.15, 0.55, 28), stone, 0, 0.27, 0);
  basin.receiveShadow = true;
  g.add(basin);
  g.add(mesh(sharedGeo('adv-fRim', () => new THREE.TorusGeometry(1.06, 0.09, 8, 28)), toon(0xf4ead8), 0, 0.55, 0).rotateX(Math.PI / 2));
  const pool = mesh(cylG(0.98, 0.98, 0.04, 28), toon(0xffd66b), 0, 0.5, 0, false);
  g.add(pool);
  g.add(mesh(cylG(0.16, 0.22, 1.2, 12), stone, 0, 0.9, 0));
  const top = mesh(sharedGeo('adv-fTop', () => new THREE.SphereGeometry(0.5, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2)), stone, 0, 1.55, 0);
  g.add(top);
  g.add(mesh(cylG(0.45, 0.45, 0.04, 18), toon(0xffd66b), 0, 1.53, 0, false));
  const jet = new THREE.Group();
  jet.position.y = 1.55;
  jet.add(mesh(cylG(0.06, 0.1, 0.6, 8), toon(0xffe08a), 0, 0.3, 0, false));
  jet.add(mesh(sph(0.13, 10, 8), toon(0xffe08a), 0, 0.62, 0, false));
  g.add(jet);
  // Drips falling from the top bowl
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const d = mesh(cylG(0.03, 0.03, 0.85, 5), toon(0xffe08a), Math.cos(a) * 0.46, 1.1, Math.sin(a) * 0.46, false);
    g.add(d);
  }
  // The coin glinting at the bottom of the custard
  const coin = mesh(cylG(0.12, 0.12, 0.03, 14), toon(COLORS.gold), 0.45, 0.53, 0.55, false);
  g.add(coin);
  g.userData = { jet, pool, coin };
  return g;
}

/** Admiral Custard, who founded Pudding Island by sitting on it. He looks nervous. */
export function makeStatue() {
  const g = new THREE.Group();
  const stone = toon(0xd8cfc0);
  const dark = toon(0xa79e90);
  g.add(mesh(boxG(1.1, 1.0, 1.0), dark, 0, 0.5, 0));
  g.add(mesh(boxG(1.25, 0.12, 1.15), stone, 0, 1.04, 0));
  const fig = new THREE.Group();
  fig.position.y = 1.1;
  g.add(fig);
  const body = mesh(sharedGeo('adv-statueBody', () => new THREE.CapsuleGeometry(0.42, 0.42, 6, 14)), stone, 0, 0.66, 0);
  fig.add(body);
  // Tricorn hat
  const hat = mesh(coneG(0.5, 0.36, 3), dark, 0, 1.36, 0);
  hat.scale.set(1, 1, 0.65);
  fig.add(hat);
  // Big nervous eyes and a sweat drop
  for (const s of [-1, 1]) {
    const w = mesh(sph(0.13, 10, 8), toon(0xf6f1e8), s * 0.15, 0.95, 0.33);
    w.scale.set(1, 1.25, 0.6);
    fig.add(w, mesh(sph(0.04, 8, 6), toon(0x6d665c), s * 0.15, 0.97, 0.41, false));
    const brow = mesh(boxG(0.14, 0.03, 0.03), dark, s * 0.15, 1.15, 0.36, false);
    brow.rotation.z = s * 0.35;
    fig.add(brow);
  }
  const mouth = mesh(sharedGeo('adv-wavy', () => new THREE.TorusGeometry(0.08, 0.018, 5, 10, Math.PI)), dark, 0, 0.72, 0.4, false);
  fig.add(mouth);
  const drop = mesh(sph(0.06, 8, 6), toon(0x8fd8ff), 0.36, 1.08, 0.3, false);
  drop.scale.set(0.8, 1.3, 0.6);
  fig.add(drop);
  // A heroic spoon, raised
  const spoon = new THREE.Group();
  spoon.position.set(0.42, 0.85, 0.05);
  spoon.rotation.z = -0.5;
  spoon.add(mesh(cylG(0.04, 0.05, 0.9, 8), stone, 0, 0.45, 0));
  const bowl = mesh(sph(0.16, 10, 8), stone, 0, 0.98, 0);
  bowl.scale.set(0.95, 1.3, 0.45);
  spoon.add(bowl);
  fig.add(spoon);
  g.userData = { drop };
  return g;
}

/** A small fish for the flooded cabin. Faces +x. */
export function makeFish(color = 0xff9a3c) {
  const g = new THREE.Group();
  const b = mesh(sph(0.12, 10, 8), toon(color), 0, 0, 0, false);
  b.scale.set(1.4, 0.9, 0.5);
  const tail = mesh(coneG(0.09, 0.14, 4), toon(color), -0.2, 0, 0, false);
  tail.rotation.z = Math.PI / 2;
  tail.scale.z = 0.4;
  g.add(b, tail, mesh(sph(0.025, 6, 4), toon(COLORS.ink), 0.1, 0.03, 0.05, false));
  return g;
}

/** The ship's wheel. Faces +z. userData.wheel spins. */
export function makeWheel() {
  const g = new THREE.Group();
  g.add(mesh(boxG(0.3, 0.9, 0.3), toon(WOOD_DARK), 0, 0.45, -0.1));
  const wheel = new THREE.Group();
  wheel.position.y = 1.0;
  wheel.add(mesh(sharedGeo('adv-wheel', () => new THREE.TorusGeometry(0.42, 0.05, 8, 24)), toon(WOOD), 0, 0, 0));
  wheel.add(mesh(cylG(0.09, 0.09, 0.12, 10), toon(COLORS.gold), 0, 0, 0).rotateX(Math.PI / 2));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const sp = mesh(cylG(0.025, 0.025, 1.05, 5), toon(WOOD), Math.cos(a) * 0.27, Math.sin(a) * 0.27, 0, false);
    sp.rotation.z = a - Math.PI / 2;
    wheel.add(sp);
    wheel.add(mesh(sph(0.05, 8, 6), toon(WOOD_DARK), Math.cos(a) * 0.56, Math.sin(a) * 0.56, 0, false));
  }
  g.add(wheel);
  g.userData = { wheel };
  return g;
}

/** A cut-off bit of washing: a sock. */
export function makeSock(color) {
  const g = new THREE.Group();
  g.add(mesh(boxG(0.16, 0.42, 0.06), toon(color), 0, -0.21, 0));
  g.add(mesh(boxG(0.26, 0.14, 0.06), toon(color), 0.05, -0.4, 0));
  g.add(mesh(boxG(0.17, 0.06, 0.07), toon(0xffffff), 0, -0.02, 0, false));
  return g;
}

/** A peg on the washing line. */
export function makePeg() {
  return mesh(boxG(0.05, 0.14, 0.05), toon(WOOD), 0, -0.04, 0, false);
}

/** Gold trophy cup. */
export function makeTrophy(h = 0.5) {
  const g = new THREE.Group();
  const gold = toon(COLORS.gold);
  g.add(mesh(boxG(0.22, 0.08, 0.16), toon(WOOD_DARK), 0, 0.04, 0));
  g.add(mesh(cylG(0.03, 0.05, h * 0.35, 8), gold, 0, 0.08 + h * 0.17, 0));
  const cup = mesh(cylG(0.14, 0.06, h * 0.45, 12), gold, 0, 0.08 + h * 0.35 + h * 0.22, 0);
  g.add(cup);
  for (const s of [-1, 1]) {
    const handle = mesh(sharedGeo('adv-handle', () => new THREE.TorusGeometry(0.06, 0.015, 5, 10, Math.PI)), gold, s * 0.15, 0.08 + h * 0.6, 0, false);
    handle.rotation.z = s > 0 ? -Math.PI / 2 : Math.PI / 2;
    g.add(handle);
  }
  return g;
}

/** A little pudding for shelves and tables. */
export function makeMiniPudding(color, cap = CARAMEL) {
  const g = new THREE.Group();
  g.add(mesh(cylG(0.12, 0.16, 0.2, 14), toon(color), 0, 0.1, 0));
  g.add(mesh(cylG(0.115, 0.125, 0.04, 14), toon(cap), 0, 0.21, 0, false));
  g.add(mesh(sph(0.04, 8, 6), toon(0xe0364f), 0, 0.26, 0, false));
  return g;
}

export { CREAM, CARAMEL };
