import * as THREE from 'three';
import { COLORS, toon, basic, sharedGeo, faceted } from '../../core/palette.js';
import { makeGrumble } from '../../core/critters.js';

// Toon models for the adventure: characters, props and the little inventory items.
// Everything is built from primitives with the shared toon() materials.

export const sph = (r, w = 16, h = 12) => sharedGeo(`adv-sph${r}|${w}|${h}`, () => new THREE.SphereGeometry(r, w, h));
export const boxG = (w, h, d) => sharedGeo(`adv-box${w}|${h}|${d}`, () => new THREE.BoxGeometry(w, h, d));
export const cylG = (rt, rb, h, seg = 14) => sharedGeo(`adv-cyl${rt}|${rb}|${h}|${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg));
export const coneG = (r, h, seg = 12) => sharedGeo(`adv-cone${r}|${h}|${seg}`, () => new THREE.ConeGeometry(r, h, seg));

export function mesh(geo, mat, x = 0, y = 0, z = 0, shadow = true) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = shadow;
  return m;
}

export const WOOD = 0xc68a52;
export const WOOD_DARK = 0x8f5f3a;
const NAVY = 0x2f4b8f;

/** A material with a canvas texture on it (not shared: disposed with the scene). */
export function decalMaterial(canvas) {
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;
  return new THREE.MeshToonMaterial({ map, transparent: true, gradientMap: toon(0xffffff).gradientMap });
}

/** Draw on a fresh canvas: draw(ctx, w, h). */
export function drawCanvas(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  return c;
}

/** Redraw a decal material's canvas (language switch). */
export function redrawDecal(mat, draw) {
  const c = mat.map.image;
  const g = c.getContext('2d');
  g.clearRect(0, 0, c.width, c.height);
  draw(g, c.width, c.height);
  mat.map.needsUpdate = true;
}

/** Text that fits a width: shrinks the font until it does. */
export function fitText(g, text, x, y, maxW, size, weight = 700) {
  let s = size;
  do { g.font = `${weight} ${s}px Fredoka, 'Trebuchet MS', sans-serif`; s -= 2; } while (g.measureText(text).width > maxW && s > 8);
  g.fillText(text, x, y);
}

// ---------- items ----------

export function makeSpoon() {
  const g = new THREE.Group();
  g.add(mesh(cylG(0.035, 0.045, 0.7, 8), toon(0xd9a066), 0, 0, 0));
  const bowl = mesh(sph(0.13), toon(0xd9a066), 0, 0.44, 0);
  bowl.scale.set(0.95, 1.3, 0.45);
  g.add(bowl);
  // "It's a soup spoon. I can see the soup."
  const soup = mesh(sph(0.09), toon(0xff9a3c), 0, 0.45, 0.035);
  soup.scale.set(0.9, 1.1, 0.3);
  g.add(soup);
  return g;
}

export function makeDuck() {
  const g = new THREE.Group();
  const yellow = toon(0xffd23f);
  const body = mesh(sph(0.22), yellow, 0, 0.18, 0);
  body.scale.set(1.3, 0.85, 1);
  const tail = mesh(coneG(0.08, 0.18, 8), yellow, -0.27, 0.27, 0);
  tail.rotation.z = 0.9;
  const head = mesh(sph(0.15), yellow, 0.16, 0.42, 0);
  const beak = mesh(sph(0.08), toon(0xff8c2a), 0.31, 0.39, 0);
  beak.scale.set(1.3, 0.45, 0.9);
  g.add(body, tail, head, beak);
  for (const s of [-1, 1]) {
    g.add(mesh(sph(0.032, 8, 6), toon(COLORS.ink), 0.24, 0.47, s * 0.1));
    const wing = mesh(sph(0.1), toon(0xffc21a), -0.02, 0.2, s * 0.19);
    wing.scale.set(1.4, 0.7, 0.4);
    g.add(wing);
  }
  return g;
}

export function makeNote() {
  const g = new THREE.Group();
  const paper = mesh(boxG(0.5, 0.62, 0.02), toon(0xfff3d6), 0, 0, 0);
  g.add(paper);
  for (let i = 0; i < 5; i++) {
    const w = i === 4 ? 0.2 : 0.34 - (i % 2) * 0.06;
    g.add(mesh(boxG(w, 0.025, 0.01), toon(0x5a4f7a), -0.04 + (0.34 - w) * -0.5 + 0.03, 0.2 - i * 0.1, 0.015, false));
  }
  // A little red seal
  g.add(mesh(cylG(0.06, 0.06, 0.02, 12), toon(0xe0455f), 0.15, -0.22, 0.015).rotateX(Math.PI / 2));
  g.rotation.z = 0.08;
  return g;
}

// ---------- props ----------

/** The barrel that says DO NOT OPEN (tiny) and OPEN (huge). userData.lid opens; userData.label is the decal. */
export function makeBarrel() {
  const g = new THREE.Group();
  const pts = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    pts.push(new THREE.Vector2(0.42 + Math.sin(t * Math.PI) * 0.08, t * 1.1));
  }
  const body = mesh(sharedGeo('adv-barrel', () => new THREE.LatheGeometry(pts, 20)), toon(WOOD), 0, 0, 0);
  body.receiveShadow = true;
  g.add(body);
  for (const y of [0.14, 0.96]) {
    const band = mesh(sharedGeo('adv-band', () => new THREE.TorusGeometry(0.47, 0.03, 6, 24)), toon(0x6b5a7a), 0, y, 0);
    band.rotation.x = Math.PI / 2;
    g.add(band);
  }
  // Staves: thin dark lines
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.2;
    if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a)) - Math.PI / 2) < 0.8) continue; // keep the label area clean
    const st = mesh(boxG(0.02, 1.0, 0.02), toon(WOOD_DARK), Math.cos(a) * 0.49, 0.55, Math.sin(a) * 0.49, false);
    g.add(st);
  }
  const lidPivot = new THREE.Group();
  lidPivot.position.set(-0.42, 1.1, 0);
  const lid = mesh(cylG(0.43, 0.43, 0.07, 20), toon(WOOD_DARK), 0.42, 0.03, 0);
  lidPivot.add(lid);
  g.add(lidPivot);
  // Dark inside, seen once the lid is off
  g.add(mesh(cylG(0.4, 0.4, 0.02, 18), toon(0x4a3326), 0, 1.06, 0, false));
  const label = new THREE.Mesh(
    sharedGeo('adv-barrelLabel', () => new THREE.CylinderGeometry(0.51, 0.51, 0.62, 16, 1, true, -0.7, 1.4)),
    decalMaterial(drawCanvas(512, 400, () => {})),
  );
  label.position.y = 0.55;
  g.add(label);
  g.userData = { lid: lidPivot, label };
  return g;
}

export function drawBarrelLabel(g, w, h, small, big) {
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = '#3b2a3f';
  fitText(g, small, w / 2, h * 0.15, w * 0.5, 40, 600);
  g.lineJoin = 'round';
  g.strokeStyle = '#fff4dc';
  g.lineWidth = 18;
  g.font = `700 ${Math.round(h * 0.5)}px Fredoka, 'Trebuchet MS', sans-serif`;
  let size = h * 0.5;
  while (g.measureText(big).width > w * 0.9 && size > 20) { size -= 4; g.font = `700 ${Math.round(size)}px Fredoka, sans-serif`; }
  g.strokeText(big, w / 2, h * 0.6);
  g.fillStyle = '#e0364f';
  g.fillText(big, w / 2, h * 0.6);
}

/** The seagull. Faces +x. userData: head, beak (lower jaw), wings. */
export function makeSeagull() {
  const g = new THREE.Group();
  const white = toon(0xffffff);
  const grey = toon(0xaab3c6);
  const body = mesh(sph(0.22), white, 0, 0.3, 0);
  body.scale.set(1.45, 1, 1);
  const tail = mesh(coneG(0.13, 0.3, 4), grey, -0.36, 0.34, 0);
  tail.rotation.z = Math.PI / 2 + 0.3;
  tail.scale.set(1, 1, 0.4);
  g.add(body, tail);
  const wings = [];
  for (const s of [-1, 1]) {
    const w = new THREE.Group();
    w.position.set(-0.04, 0.36, s * 0.2);
    const wing = mesh(sph(0.2), grey, -0.05, 0, 0);
    wing.scale.set(1.35, 0.5, 0.25);
    const tip = mesh(sph(0.09), toon(COLORS.ink), -0.3, -0.02, 0);
    tip.scale.set(1.3, 0.45, 0.25);
    w.add(wing, tip);
    g.add(w);
    wings.push(w);
  }
  const head = new THREE.Group();
  head.position.set(0.26, 0.52, 0);
  head.add(mesh(sph(0.15), white, 0, 0, 0));
  const beakTop = mesh(coneG(0.055, 0.22, 8), toon(0xffc93c), 0.2, -0.01, 0);
  beakTop.rotation.z = -Math.PI / 2;
  beakTop.scale.set(1, 1, 0.8);
  const dot = mesh(sph(0.025, 8, 6), toon(0xe0364f), 0.2, -0.04, 0);
  const jaw = new THREE.Group();
  jaw.position.set(0.1, -0.05, 0);
  const low = mesh(coneG(0.04, 0.16, 8), toon(0xffb020), 0.08, 0, 0);
  low.rotation.z = -Math.PI / 2;
  jaw.add(low);
  head.add(beakTop, dot, jaw);
  for (const s of [-1, 1]) {
    head.add(mesh(sph(0.045, 10, 8), white, 0.07, 0.04, s * 0.12));
    head.add(mesh(sph(0.028, 8, 6), toon(COLORS.ink), 0.1, 0.04, s * 0.135));
    // Stern brow: she knows what she wants
    const brow = mesh(boxG(0.1, 0.025, 0.03), toon(0x6b6f85), 0.08, 0.1, s * 0.13);
    brow.rotation.z = -0.45;
    head.add(brow);
  }
  g.add(head);
  for (const s of [-1, 1]) {
    g.add(mesh(cylG(0.018, 0.018, 0.16, 6), toon(0xff8c42), 0.02, 0.08, s * 0.08));
    const foot = mesh(sph(0.05, 8, 6), toon(0xff8c42), 0.06, 0.01, s * 0.08);
    foot.scale.set(1.6, 0.35, 1);
    g.add(foot);
  }
  g.userData = { head, jaw, wings, body };
  return g;
}

/** Harbor Master Grumbleton: a grumble in a uniform two sizes too small. userData: body, feather, cap. */
export function makeGrumbleton() {
  const outer = new THREE.Group();
  const g = makeGrumble(0x8c7ae6);
  g.scale.setScalar(1.7);
  outer.add(g);
  // The jacket: a tight navy band that only just covers the lower half
  const jacket = mesh(cylG(0.455, 0.33, 0.27, 18), toon(NAVY), 0, 0.24, 0);
  g.add(jacket);
  const belt = mesh(cylG(0.335, 0.31, 0.04, 18), toon(COLORS.gold), 0, 0.12, 0);
  g.add(belt);
  // Straining brass buttons, one of them hanging on by a thread
  for (let i = 0; i < 3; i++) {
    const b = mesh(sph(0.03, 8, 6), toon(COLORS.gold), (i === 1 ? 0.03 : 0), 0.18 + i * 0.07, 0.395 - i * 0.03);
    g.add(b);
  }
  const loose = mesh(sph(0.03, 8, 6), toon(COLORS.gold), 0.09, 0.08, 0.36);
  g.add(loose);
  g.add(mesh(cylG(0.004, 0.004, 0.08, 4), toon(COLORS.ink), 0.085, 0.12, 0.36, false));
  // Epaulettes perched on the "shoulders"
  for (const s of [-1, 1]) {
    const ep = mesh(boxG(0.14, 0.04, 0.12), toon(COLORS.gold), s * 0.4, 0.52, 0.02);
    ep.rotation.z = -s * 0.6;
    g.add(ep);
  }
  // A medal for "Most Grumbled"
  g.add(mesh(cylG(0.04, 0.04, 0.015, 10), toon(0xff5d73), -0.18, 0.3, 0.36).rotateX(Math.PI / 2 - 0.4));
  // A splendid mustache
  for (const s of [-1, 1]) {
    const m = mesh(sph(0.08, 10, 8), toon(0x3b2f55), s * 0.08, 0.43, 0.42);
    m.scale.set(1.4, 0.5, 0.6);
    m.rotation.z = s * 0.35;
    g.add(m);
  }
  // A captain's cap far too small, on the very top
  const cap = new THREE.Group();
  cap.position.set(0.04, 0.88, 0);
  cap.rotation.z = -0.15;
  cap.add(mesh(cylG(0.12, 0.12, 0.09, 14), toon(0xffffff), 0, 0.05, 0));
  cap.add(mesh(cylG(0.125, 0.125, 0.035, 14), toon(NAVY), 0, 0.015, 0));
  const brim = mesh(cylG(0.09, 0.09, 0.015, 12, 1), toon(COLORS.ink), 0, 0, 0.09);
  brim.scale.set(1, 1, 0.6);
  cap.add(brim, mesh(sph(0.025, 8, 6), toon(COLORS.gold), 0, 0.05, 0.12));
  g.add(cap);
  // Tickle feather, shown during the duel
  const feather = new THREE.Group();
  feather.add(mesh(cylG(0.012, 0.012, 0.5, 5), toon(0xffffff), 0, 0.25, 0));
  for (let i = 0; i < 5; i++) {
    const p = mesh(sph(0.06, 8, 6), toon(i % 2 ? 0xff9fd0 : 0xff6fae), 0, 0.3 + i * 0.07, 0);
    p.scale.set(1.6 - i * 0.2, 0.7, 0.4);
    feather.add(p);
  }
  feather.position.set(0.5, 0.25, 0.15);
  feather.rotation.z = -0.5;
  feather.visible = false;
  g.add(feather);
  outer.userData = { body: g.userData.body, feather, cap, inner: g };
  return outer;
}

/** The Soggy Biscuit: a very tired ship. */
export function makeShip() {
  const g = new THREE.Group();
  const shape = new THREE.Shape();
  shape.moveTo(-3.0, 1.0);
  shape.lineTo(2.7, 1.0);
  shape.quadraticCurveTo(3.4, 1.2, 3.3, 1.5);
  shape.quadraticCurveTo(2.9, -0.4, 2.0, -0.6);
  shape.lineTo(-2.4, -0.6);
  shape.quadraticCurveTo(-3.1, -0.3, -3.0, 1.0);
  const hullGeo = sharedGeo('adv-hull', () => {
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 1.8, bevelEnabled: true, bevelThickness: 0.2, bevelSize: 0.15, bevelSegments: 2, curveSegments: 10 });
    geo.translate(0, 0, -0.9);
    return geo;
  });
  const hull = mesh(hullGeo, toon(0x9a6440), 0, 0, 0);
  hull.receiveShadow = true;
  g.add(hull);
  g.add(mesh(boxG(5.9, 0.12, 2.1), toon(0xf3d9a4), -0.1, 0.62, 0.02));
  // Deck and portholes
  g.add(mesh(boxG(5.7, 0.08, 1.9), toon(0xc9955f), -0.15, 1.02, 0));
  for (let i = 0; i < 4; i++) {
    const ph = mesh(cylG(0.13, 0.13, 0.05, 14), toon(0x2e3b6b), -1.9 + i * 1.2, 0.3, 1.12, false);
    ph.rotation.x = Math.PI / 2;
    const rim = mesh(sharedGeo('adv-rim', () => new THREE.TorusGeometry(0.14, 0.03, 6, 14)), toon(COLORS.gold), -1.9 + i * 1.2, 0.3, 1.14, false);
    g.add(ph, rim);
  }
  // A patch on the hull, and another patch on the patch
  g.add(mesh(boxG(0.5, 0.4, 0.04), toon(0xb98a5a), 1.4, 0.1, 1.13, false));
  g.add(mesh(boxG(0.22, 0.2, 0.04), toon(0x7a8fb8), 1.5, 0.14, 1.16, false));
  // Stern cabin
  g.add(mesh(boxG(1.2, 0.9, 1.5), toon(0xb07a4a), -2.2, 1.5, 0));
  g.add(mesh(boxG(1.4, 0.12, 1.7), toon(0x7a4a2e), -2.2, 2.0, 0));
  g.add(mesh(boxG(0.36, 0.3, 0.04), toon(0xffe08a), -2.2, 1.55, 0.77, false));
  // Mast, sail and flag
  g.add(mesh(cylG(0.09, 0.12, 4.6, 10), toon(0x7a4a2e), 0.4, 3.2, 0));
  g.add(mesh(cylG(0.04, 0.04, 2.6, 6), toon(0x7a4a2e), 0.4, 4.6, 0).rotateZ(Math.PI / 2));
  const sail = mesh(sharedGeo('adv-sail', () => {
    const geo = new THREE.PlaneGeometry(2.4, 2.3, 6, 6);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin((p.getY(i) + 1.15) / 2.3 * Math.PI) * 0.25 + Math.sin(p.getX(i) * 2) * 0.05);
    geo.computeVertexNormals();
    return geo;
  }), toon(0xfff1d6).clone(), 0.4, 3.4, 0.15);
  sail.material.side = THREE.DoubleSide;
  sail.material.userData = {};
  g.add(sail);
  // Patches and a biscuit emblem on the sail
  g.add(mesh(boxG(0.4, 0.35, 0.02), toon(0xff9fd0), -0.3, 2.7, 0.33, false));
  g.add(mesh(boxG(0.3, 0.3, 0.02), toon(0x8fd8ff), 1.15, 4.1, 0.3, false));
  const biscuit = mesh(cylG(0.45, 0.45, 0.04, 20), toon(0xe2b06a), 0.4, 3.5, 0.42, false);
  biscuit.rotation.x = Math.PI / 2;
  g.add(biscuit);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    g.add(mesh(sph(0.04, 6, 4), toon(0x9a6440), 0.4 + Math.cos(a) * 0.24, 3.5 + Math.sin(a) * 0.24, 0.45, false));
  }
  const flag = mesh(coneG(0.25, 0.7, 3), toon(0xff5d73), 0.75, 5.55, 0);
  flag.rotation.z = -Math.PI / 2;
  flag.scale.set(1, 1, 0.2);
  g.add(flag);
  // Crow's nest
  g.add(mesh(cylG(0.32, 0.26, 0.3, 12), toon(0xa0704a), 0.4, 5.15, 0));
  // Rigging
  const rope = toon(0xe8d5a8);
  for (const [x1, y1, x2, y2] of [[0.4, 5.0, 2.9, 1.2], [0.4, 5.0, -2.7, 2.0]]) {
    const len = Math.hypot(x2 - x1, y2 - y1);
    const r = mesh(cylG(0.015, 0.015, len, 4), rope, (x1 + x2) / 2, (y1 + y2) / 2, 0.05, false);
    r.rotation.z = Math.atan2(y2 - y1, x2 - x1) - Math.PI / 2;
    g.add(r);
  }
  return g;
}

/** A soft pink sunset cloud. */
export function makePinkCloud(rand, scale = 1) {
  const g = new THREE.Group();
  const n = 4 + Math.floor(rand() * 3);
  for (let i = 0; i < n; i++) {
    const p = mesh(sph(0.8 + rand() * 0.6, 12, 8), toon(i % 2 ? 0xffc0d0 : 0xffd6c8), (i - n / 2) * 0.9, rand() * 0.5, rand() * 0.4, false);
    p.scale.y = 0.6;
    g.add(p);
  }
  g.scale.setScalar(scale);
  return g;
}

export function makeIsland(color, w, h) {
  const g = new THREE.Group();
  const hill = mesh(sharedGeo('adv-hill', () => faceted(new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2))), toon(color), 0, 0, 0, false);
  hill.scale.set(w, h, w * 0.4);
  g.add(hill);
  return g;
}

export function makePalm(color = 0x4a3f7a) {
  const g = new THREE.Group();
  const trunk = mesh(cylG(0.08, 0.12, 2.2, 6), toon(color), 0.2, 1.1, 0, false);
  trunk.rotation.z = -0.2;
  g.add(trunk);
  for (let i = 0; i < 5; i++) {
    const leaf = mesh(sph(0.5, 8, 6), toon(color), 0.4 + Math.cos(i * 1.3) * 0.5, 2.2 + Math.sin(i * 2.1) * 0.1, 0, false);
    leaf.scale.set(1.4, 0.18, 0.4);
    leaf.rotation.z = Math.cos(i * 1.3) * 0.6;
    g.add(leaf);
  }
  return g;
}

export { basic };
