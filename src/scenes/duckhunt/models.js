import * as THREE from 'three';
import { COLORS, toon, basic, sharedGeo, faceted } from '../../core/palette.js';
import { makeTree, makeBush, makeCloud, makeRock, seeded } from '../../core/world.js';

// Models for Laser Ducks (scenes/duckhunt.js): the classic duck hunt staging, the ducks, the
// hound, clay discs, crosshairs and laser beams. Everything is built from primitives.

const sph = (r, w = 16, h = 12) => sharedGeo(`dh-sph${r}|${w}|${h}`, () => new THREE.SphereGeometry(r, w, h));
const cyl = (key, rt, rb, h, seg = 12) => sharedGeo(`dh-${key}`, () => new THREE.CylinderGeometry(rt, rb, h, seg));
const boxG = (key, w, h, d) => sharedGeo(`dh-${key}`, () => new THREE.BoxGeometry(w, h, d));

function mesh(geo, mat, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.scale.set(sx, sy, sz);
  return m;
}

// ---------- ducks ----------

/** Classic three ducks: slow dark ducks, medium blue ducks and fast red ducks. */
export const DUCK_TYPES = {
  black: { body: 0x40385c, wing: 0x5f5487, belly: 0x8e86ad, speed: 5.4, pts: 500 },
  blue: { body: 0x3f7be6, wing: 0x2a59bd, belly: 0xa9d2ff, speed: 7, pts: 1000 },
  red: { body: 0xe4553f, wing: 0xb63a29, belly: 0xffc2a6, speed: 8.8, pts: 1500 },
};
const HEAD = 0x2fae62;
const BEAK = 0xffa630;

/** A side-view duck facing +x. userData: wings (two pivots), parts (meshes for the zap flicker). */
export function makeDuck(type) {
  const g = new THREE.Group();
  const body = mesh(sph(0.5), toon(type.body), 0, 0, 0, 1.35, 0.82, 0.85);
  const belly = mesh(sph(0.42), toon(type.belly), 0.08, -0.12, 0, 1.15, 0.6, 0.78);
  const tail = mesh(sharedGeo('dh-tail', () => new THREE.ConeGeometry(0.2, 0.45, 6)), toon(type.wing), -0.72, 0.12, 0);
  tail.rotation.z = Math.PI / 2 + 0.35;
  const head = new THREE.Group();
  head.position.set(0.58, 0.42, 0);
  const skull = mesh(sph(0.3), toon(HEAD));
  const ring = mesh(sph(0.27), toon(COLORS.white), -0.08, -0.2, 0, 1, 0.45, 1);
  const beak = mesh(sph(0.16), toon(BEAK), 0.3, -0.06, 0, 1.6, 0.5, 1.05);
  head.add(ring, skull, beak);
  for (const s of [-1, 1]) {
    const eye = mesh(sph(0.085, 10, 8), toon(COLORS.white), 0.12, 0.08, s * 0.24, 1, 1.1, 0.6);
    const pupil = mesh(sph(0.045, 8, 6), toon(COLORS.ink), 0.15, 0.08, s * 0.29);
    head.add(eye, pupil);
  }
  const wings = [];
  for (const s of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(-0.05, 0.22, s * 0.28);
    const wing = mesh(sph(0.4), toon(type.wing), -0.08, 0, s * 0.32, 1.05, 0.16, 0.8);
    pivot.add(wing);
    pivot.userData.side = s;
    wings.push(pivot);
    g.add(pivot);
  }
  for (const s of [-1, 1]) g.add(mesh(sph(0.1, 8, 6), toon(BEAK), -0.35, -0.38, s * 0.14, 1.4, 0.6, 1));
  g.add(body, belly, tail, head);
  const parts = [];
  g.traverse((o) => { if (o.isMesh) { o.userData.mat = o.material; parts.push(o); } });
  g.userData = { wings, parts, head };
  return g;
}

/** Zap flicker: swap every part to a bright material (or back with on = false). */
export function zapTint(model, on, color = 0xffffff) {
  for (const m of model.userData.parts) m.material = on ? basic(color) : m.userData.mat;
}

// ---------- clay discs ----------

export function makeClay() {
  const g = new THREE.Group();
  const disc = mesh(cyl('clay', 0.6, 0.48, 0.2, 18), toon(0xff8c42));
  const top = mesh(cyl('clayTop', 0.36, 0.36, 0.06, 16), toon(0xffd166), 0, 0.12, 0);
  const rim = mesh(sharedGeo('dh-clayRim', () => new THREE.TorusGeometry(0.58, 0.05, 6, 20)), toon(0xd9622b), 0, 0.02, 0);
  rim.rotation.x = Math.PI / 2;
  g.add(disc, top, rim);
  return g;
}

// ---------- the hound ----------

const DOG = 0xd18d4f;
const DOG_DARK = 0x7a4a2b;
const DOG_CREAM = 0xfff0d6;

function dogEye(g, x, y, z, s = 1) {
  g.add(mesh(sph(0.09 * s, 10, 8), toon(COLORS.white), x, y, z, 1, 1.15, 0.7));
  const pupil = mesh(sph(0.05 * s, 8, 6), toon(COLORS.ink), x, y - 0.01 * s, z + 0.05 * s);
  g.add(pupil);
  return pupil;
}

/**
 * Walking hound in side view, facing +x, standing on y = 0 (about 1.7 tall).
 * userData: legs (4 pivots), head, tail, bang (the "!" mark shown when it spots ducks).
 */
export function makeDog() {
  const g = new THREE.Group();
  g.add(mesh(sph(0.5), toon(DOG), 0, 0.9, 0, 1.55, 0.85, 0.8));
  g.add(mesh(sph(0.4), toon(DOG_CREAM), 0.12, 0.72, 0, 1.3, 0.55, 0.72));
  g.add(mesh(sph(0.36), toon(DOG_DARK), -0.12, 1.18, 0, 1.25, 0.5, 0.85));
  const legs = [];
  for (const [x, z] of [[0.5, 0.22], [0.5, -0.22], [-0.48, 0.22], [-0.48, -0.22]]) {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0.75, z);
    pivot.add(mesh(cyl('dogLeg', 0.1, 0.09, 0.62, 8), toon(DOG), 0, -0.33, 0));
    pivot.add(mesh(sph(0.13, 10, 8), toon(DOG_CREAM), 0.05, -0.66, 0, 1.3, 0.7, 1));
    legs.push(pivot);
    g.add(pivot);
  }
  const head = new THREE.Group();
  head.position.set(0.78, 1.32, 0);
  head.add(mesh(sph(0.38), toon(DOG)));
  head.add(mesh(sph(0.24), toon(DOG_CREAM), 0.33, -0.1, 0, 1.45, 0.82, 0.95));
  head.add(mesh(sph(0.1, 10, 8), toon(COLORS.ink), 0.66, -0.03, 0));
  for (const s of [-1, 1]) {
    dogEye(head, 0.2, 0.14, s * 0.25);
    const ear = mesh(sph(0.22), toon(DOG_DARK), -0.06, -0.18, s * 0.34, 0.6, 1.5, 0.3);
    ear.rotation.z = 0.2;
    head.add(ear);
  }
  g.add(head);
  const tail = new THREE.Group();
  tail.position.set(-0.72, 1.08, 0);
  const stick = mesh(cyl('dogTail', 0.05, 0.09, 0.6, 8), toon(DOG), 0, 0.28, 0);
  tail.add(stick, mesh(sph(0.08, 8, 6), toon(COLORS.white), 0, 0.6, 0));
  tail.rotation.z = 0.6;
  g.add(tail);
  // "!" above the head when the dog spots the ducks.
  const bang = new THREE.Group();
  bang.add(mesh(boxG('bang', 0.14, 0.42, 0.14), basic(0xff3b5c), 0, 0.3, 0));
  bang.add(mesh(sph(0.08, 8, 6), basic(0xff3b5c), 0, 0, 0));
  bang.position.set(0.8, 2.15, 0);
  bang.visible = false;
  g.add(bang);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  g.userData = { legs, head, tail, bang };
  return g;
}

/**
 * The dog popping up out of the grass, facing the camera (+z): a bust with two arms.
 * userData: head, arms (pivots), mouth, tongue, eyes, hands (where held ducks hang).
 */
export function makePopDog() {
  const g = new THREE.Group();
  g.add(mesh(sph(0.6), toon(DOG), 0, 0.8, 0, 1, 1.3, 0.8));
  // A long lower body so no bottom ever shows above the grass.
  g.add(mesh(cyl('dogLower', 0.6, 0.6, 2.4, 14), toon(DOG), 0, -0.6, 0, 1, 1, 0.8));
  g.add(mesh(sph(0.42), toon(DOG_CREAM), 0, 0.85, 0.3, 0.95, 1.2, 0.5));
  const head = new THREE.Group();
  head.position.set(0, 1.95, 0.05);
  head.add(mesh(sph(0.52), toon(DOG)));
  head.add(mesh(sph(0.3), toon(DOG_CREAM), 0, -0.17, 0.38, 1.25, 0.85, 1));
  head.add(mesh(sph(0.12, 10, 8), toon(COLORS.ink), 0, -0.02, 0.7, 1.2, 0.85, 1));
  const eyes = new THREE.Group();
  for (const s of [-1, 1]) {
    dogEye(eyes, s * 0.19, 0.17, 0.42, 1.3);
    const brow = mesh(boxG('dogBrow', 0.18, 0.04, 0.04), toon(DOG_DARK), s * 0.19, 0.34, 0.45);
    brow.rotation.z = -s * 0.2;
    eyes.add(brow);
    const ear = mesh(sph(0.25), toon(DOG_DARK), s * 0.5, -0.12, -0.02, 0.45, 1.45, 0.32);
    ear.rotation.z = s * 0.25;
    head.add(ear);
  }
  head.add(eyes);
  const mouth = mesh(sph(0.15, 12, 8), toon(COLORS.ink), 0, -0.36, 0.55, 1.3, 0.35, 0.6);
  const tongue = mesh(sph(0.09, 10, 8), toon(0xff7a9a), 0, -0.42, 0.62, 1.2, 0.6, 0.6);
  head.add(mouth, tongue);
  g.add(head);
  const arms = [];
  const hands = [];
  for (const s of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(s * 0.52, 1.25, 0.1);
    pivot.add(mesh(cyl('dogArm', 0.12, 0.13, 0.75, 8), toon(DOG), 0, 0.36, 0));
    const hand = new THREE.Group();
    hand.position.y = 0.78;
    hand.add(mesh(sph(0.16, 10, 8), toon(DOG_CREAM)));
    pivot.add(hand);
    pivot.userData.side = s;
    arms.push(pivot);
    hands.push(hand);
    g.add(pivot);
  }
  g.userData = { head, arms, hands, mouth, tongue, eyes };
  return g;
}

// ---------- crosshairs and lasers ----------

/** Flat crosshair facing the camera, drawn on top of everything. Materials are its own. */
export function makeCrosshair(color) {
  const g = new THREE.Group();
  const mk = (c) => new THREE.MeshBasicMaterial({ color: c, transparent: true, depthTest: false, depthWrite: false });
  const ink = mk(COLORS.ink);
  const col = mk(color);
  const white = mk(0xffffff);
  const ringOut = mesh(sharedGeo('dh-ringOut', () => new THREE.RingGeometry(0.42, 0.72, 32)), ink);
  const ring = mesh(sharedGeo('dh-ring', () => new THREE.RingGeometry(0.47, 0.66, 32)), col);
  g.add(ringOut, ring);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const tickOut = mesh(sharedGeo('dh-tickOut', () => new THREE.PlaneGeometry(0.18, 0.46)), ink, Math.sin(a) * 0.62, Math.cos(a) * 0.62, 0);
    const tick = mesh(sharedGeo('dh-tick', () => new THREE.PlaneGeometry(0.09, 0.36)), white, Math.sin(a) * 0.62, Math.cos(a) * 0.62, 0);
    tickOut.rotation.z = tick.rotation.z = -a;
    g.add(tickOut, tick);
  }
  g.add(mesh(sharedGeo('dh-dotOut', () => new THREE.CircleGeometry(0.13, 16)), ink));
  g.add(mesh(sharedGeo('dh-dot', () => new THREE.CircleGeometry(0.08, 16)), col));
  let order = 30;
  g.traverse((o) => { if (o.isMesh) { o.renderOrder = order++; o.frustumCulled = false; } });
  g.userData.mats = [ink, col, white];
  return g;
}

/** A laser beam: colored glow around a white core, from a to b. Call aim(a, b) then fade opacity. */
export function makeBeam(color) {
  const g = new THREE.Group();
  const glow = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, depthWrite: false });
  const core = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false });
  const unit = sharedGeo('dh-beam', () => new THREE.CylinderGeometry(1, 1, 1, 10, 1, true));
  const outer = mesh(unit, glow);
  const inner = mesh(unit, core);
  outer.renderOrder = 25;
  inner.renderOrder = 26;
  g.add(outer, inner);
  // Zap flash at the far end.
  const flashMat = new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false, depthTest: false });
  const flash = mesh(sph(0.5, 14, 10), flashMat);
  flash.renderOrder = 27;
  const flashCore = mesh(sph(0.3, 12, 8), core);
  flashCore.renderOrder = 28;
  const flashGroup = new THREE.Group();
  flashGroup.add(flash, flashCore);
  g.visible = false;
  flashGroup.visible = false;
  const up = new THREE.Vector3(0, 1, 0);
  const dir = new THREE.Vector3();
  return {
    group: g,
    flash: flashGroup,
    aim(a, b, width = 0.09) {
      dir.subVectors(b, a);
      const len = dir.length();
      g.position.copy(a).addScaledVector(dir, 0.5);
      g.quaternion.setFromUnitVectors(up, dir.normalize());
      outer.scale.set(width * 2.4, len, width * 2.4);
      inner.scale.set(width, len, width);
      flashGroup.position.copy(b);
    },
    set(alpha, flashScale) {
      g.visible = alpha > 0.01;
      glow.opacity = 0.85 * Math.min(1, alpha * 1.5);
      core.opacity = alpha;
      flashGroup.visible = flashScale > 0;
      flashGroup.scale.setScalar(Math.max(0.001, flashScale));
      flashMat.opacity = Math.min(1, alpha * 1.4);
    },
  };
}

// ---------- the stage ----------

/**
 * Builds the classic staging: sky, far hills and trees, a meadow, the big tree, a bush, tall
 * grass the ducks fly out of and a dirt strip in front where the dog walks. Returns { clouds }.
 */
export function buildStage(scene, { stripZ = 3.6, stripTop = 2 } = {}) {
  const rand = seeded(1984);
  // Meadow and far hills.
  const ground = mesh(boxG('ground', 160, 1, 120), toon(COLORS.grass), 0, -0.5, -55);
  ground.receiveShadow = true;
  scene.add(ground);
  const hillCols = [0x5cc35a, 0x4fae52, 0x68cf63];
  for (let i = 0; i < 9; i++) {
    const r = 8 + rand() * 6;
    const h = mesh(sharedGeo('dh-hill', () => faceted(new THREE.IcosahedronGeometry(1, 2))), toon(hillCols[i % 3], { flat: true }),
      -64 + i * 16 + rand() * 6, -r * 0.45, -58 - rand() * 14, r * 1.5, r * 0.7, r);
    scene.add(h);
  }
  // A far tree line.
  for (let i = 0; i < 16; i++) {
    const tr = makeTree(rand, 1.8 + rand() * 1.2, [0x3fae5a, 0x2f9a4e, 0x57c063]);
    tr.position.set(-60 + i * 8 + rand() * 4, 0, -34 - rand() * 8);
    scene.add(tr);
  }
  for (let i = 0; i < 10; i++) {
    const b = makeBush(rand, 1.6 + rand() * 1.2);
    b.position.set(-50 + i * 11 + rand() * 5, 0, -16 - rand() * 8);
    scene.add(b);
  }
  // The big tree on the left and the bush on the right (the duck hunt landmarks).
  const tree = makeTree(() => 0.3, 3.6, [0x45b85e, 0x6dd36b]);
  tree.position.set(-12.5, 0, -6);
  tree.rotation.y = 0.4;
  scene.add(tree);
  const bush = makeBush(() => 0.5, 3.2);
  bush.position.set(10.5, 0, -1);
  scene.add(bush);
  for (const [x, z, s] of [[6, -6, 1.1], [-4, -9, 0.9], [14, -10, 1.2]]) {
    const r = makeRock(rand, s);
    r.position.set(x, 0.2, z);
    scene.add(r);
  }
  // Tall foreground grass: a solid back plus a row of blades in two greens.
  const back = mesh(boxG('grassBack', 160, 3.1, 0.9), toon(0x49a843), 0, 1.55, 2.75);
  scene.add(back);
  const blade = sharedGeo('dh-blade', () => faceted(new THREE.ConeGeometry(0.42, 1, 4)));
  const counts = 2;
  const per = 300;
  const dummy = new THREE.Object3D();
  for (let c = 0; c < counts; c++) {
    const inst = new THREE.InstancedMesh(blade, toon(c ? 0x5cc84e : 0x3f9c3c, { flat: true }), per);
    for (let i = 0; i < per; i++) {
      const x = -80 + (i / per) * 160 + rand() * 0.6;
      const h = 3.2 + rand() * 1.4 + (c ? -0.3 : 0.25);
      dummy.position.set(x, h / 2, 2.4 + rand() * 0.8 + c * 0.3);
      dummy.scale.set(0.8 + rand() * 0.5, h, 0.8);
      dummy.rotation.set((rand() - 0.5) * 0.1, rand() * 3, (rand() - 0.5) * 0.25);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
    }
    scene.add(inst);
  }
  // Dirt strip in front where the dog walks, with a grassy lip and a few pebbles.
  const strip = mesh(boxG('strip', 160, 8, 12), toon(COLORS.dirt), 0, stripTop - 4, stripZ + 6);
  strip.receiveShadow = true;
  scene.add(strip);
  scene.add(mesh(boxG('stripLip', 160, 0.25, 0.5), toon(COLORS.grassDark), 0, stripTop + 0.05, stripZ + 0.2));
  for (let i = 0; i < 26; i++) {
    const p = mesh(sph(0.2, 8, 6), toon(rand() < 0.5 ? COLORS.dirtDark : 0xe8b27c), -40 + rand() * 80, stripTop, stripZ + 1 + rand() * 6, 1.4, 0.4, 1);
    scene.add(p);
  }
  const clouds = [];
  for (let i = 0; i < 6; i++) {
    const c = makeCloud(rand, 1.6 + rand() * 1.4);
    c.position.set(-40 + i * 15 + rand() * 6, 12 + rand() * 9, -40 - rand() * 10);
    c.userData.speed = 0.3 + rand() * 0.4;
    scene.add(c);
    clouds.push(c);
  }
  return { clouds };
}
