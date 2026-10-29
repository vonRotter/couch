import * as THREE from 'three';
import { COLORS, toon, basic, sharedGeo } from '../../core/palette.js';
import { mesh, box, cyl, sph, cone, ico, WOOD, WOOD_DARK } from './models.js';

// Bean Brigade on the solo island: the mech garage (the place you walk into, east of the museum on
// the little hill) with its lookout tower and practice board, and the two yard decorations the
// Brigade sends by mail (a bug plushie for Clover Isle, a mech statue for the whole campaign).

const INK = COLORS.ink;
const roofGeo = () => sharedGeo('isl5-hangar', () => new THREE.CylinderGeometry(2.3, 2.3, 4.4, 18, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateY(Math.PI / 2));

/** A small toy mech (bean pilot in a dome), about 1.6 tall. */
function toyMech(color, trim, pilot = 0xffc93c) {
  const g = new THREE.Group();
  for (const s of [-1, 1]) {
    g.add(mesh(cyl(0.16, 0.18, 0.4, 10), 0x5a5470, s * 0.32, 0.3, 0));
    g.add(mesh(box(0.4, 0.2, 0.52), trim, s * 0.32, 0.1, 0.06));
  }
  g.add(mesh(box(1.2, 0.76, 1.0), color, 0, 0.9, 0));
  g.add(mesh(box(1.24, 0.14, 1.04), trim, 0, 0.66, 0));
  for (const s of [-1, 1]) g.add(mesh(sph(0.22, 10, 8), trim, s * 0.68, 1.1, 0));
  g.add(mesh(sph(0.28, 12, 10), 0xff3b54, 0.78, 0.78, 0.36));
  const bean = mesh(sharedGeo('isl5-bean', () => new THREE.CapsuleGeometry(0.2, 0.18, 6, 12)), pilot, 0, 1.52, 0);
  g.add(bean);
  for (const s of [-1, 1]) g.add(mesh(sph(0.06, 8, 6), 0xffffff, s * 0.08, 1.6, 0.17, false), mesh(sph(0.035, 6, 4), INK, s * 0.08, 1.6, 0.21, false));
  const domeMat = new THREE.MeshToonMaterial({ color: 0xbff6ff, transparent: true, opacity: 0.3, gradientMap: toon(0xffffff).gradientMap, depthWrite: false });
  const dome = new THREE.Mesh(sph(0.42, 14, 10), domeMat);
  dome.position.y = 1.55;
  g.add(dome);
  return g;
}

/** A goofy purple bug (beetle), about 0.8 tall. */
function toyBug(color = 0x7b6cf6, s = 1) {
  const g = new THREE.Group();
  const shell = mesh(sph(0.42, 14, 10), color, 0, 0.42, 0);
  shell.scale.set(1, 0.8, 1.1);
  g.add(shell, mesh(sph(0.25, 12, 8), 0xc9a8ff, 0, 0.4, 0.38));
  for (const k of [-1, 1]) {
    g.add(mesh(sph(0.09, 8, 6), 0xffffff, k * 0.12, 0.5, 0.56, false), mesh(sph(0.05, 6, 4), INK, k * 0.12, 0.5, 0.63, false));
    g.add(mesh(box(0.16, 0.03, 0.03), INK, k * 0.12, 0.62, 0.58, false).rotateZ(k * -0.4));
    for (let i = 0; i < 3; i++) g.add(mesh(cyl(0.03, 0.025, 0.24, 5), INK, k * 0.38, 0.16, (i - 1) * 0.2, false).rotateZ(k * 0.9));
  }
  g.scale.setScalar(s);
  return g;
}

/** The mech garage: a round-roofed hangar with a mech inside, a lookout tower and a practice board. */
export function makeGarage(M) {
  const g = new THREE.Group();
  // floor slab and back/side walls
  g.add(mesh(box(5.0, 0.2, 4.6), 0xb9b0a0, 0, 0.1, 0));
  g.add(mesh(box(4.6, 2.3, 0.2), 0xfff3dc, 0, 1.25, -2.1));
  for (const s of [-1, 1]) g.add(mesh(box(0.2, 2.3, 4.2), 0xfff3dc, s * 2.2, 1.25, 0));
  // the round roof in stripes
  const roof = mesh(roofGeo(), 0x4cc9f0, 0, 2.4, 0);
  g.add(roof);
  for (const z of [-1.4, 0, 1.4]) g.add(mesh(sharedGeo('isl5-rib', () => new THREE.TorusGeometry(2.32, 0.08, 6, 18, Math.PI)), 0xffc93c, 0, 2.4, z, false));
  // front: a door frame with a sign, the mech inside
  for (const s of [-1, 1]) g.add(mesh(box(0.5, 2.4, 0.3), 0xff5d73, s * 2.1, 1.3, 2.2));
  g.add(mesh(box(4.6, 0.4, 0.3), 0xff5d73, 0, 2.5, 2.2));
  const sign = new THREE.Group();
  sign.position.set(0, 3.25, 2.25);
  sign.add(mesh(cyl(0.6, 0.6, 0.12, 20), 0xffffff, 0, 0, 0).rotateX(Math.PI / 2));
  sign.add(mesh(sharedGeo('isl5-signbean', () => new THREE.CapsuleGeometry(0.2, 0.16, 6, 12)), 0x3ddc97, 0, 0, 0.08));
  sign.add(mesh(box(0.7, 0.1, 0.06), 0xff5d73, 0, -0.08, 0.12, false));
  g.add(sign);
  const mech = toyMech(0xff5d73, 0xffc93c);
  mech.position.set(-0.6, 0.2, 0.4);
  mech.rotation.y = 0.3;
  g.add(mech);
  const mech2 = toyMech(0x4cc9f0, 0xffffff, 0x9b5de5);
  mech2.scale.setScalar(0.8);
  mech2.position.set(1.2, 0.2, -0.6);
  mech2.rotation.y = -0.4;
  g.add(mech2);
  // workbench with a wrench
  g.add(mesh(box(1.2, 0.6, 0.5), WOOD, -1.5, 0.5, -1.6), mesh(box(0.5, 0.06, 0.1), 0x9a94b2, -1.5, 0.83, -1.55, false));
  // lamps by the door (lit at night)
  for (const s of [-1, 1]) g.add(mesh(sph(0.14, 8, 6), M.lamp, s * 2.1, 2.2, 2.42, false));
  // the lookout tower with a flag and a spinning radar
  const tower = new THREE.Group();
  tower.position.set(3.4, 0, -0.6);
  for (const [x, z] of [[-0.45, -0.45], [0.45, -0.45], [-0.45, 0.45], [0.45, 0.45]]) tower.add(mesh(cyl(0.07, 0.09, 3.2, 6), WOOD_DARK, x, 1.6, z));
  tower.add(mesh(box(1.3, 0.14, 1.3), WOOD, 0, 3.2, 0));
  for (const s of [-1, 1]) tower.add(mesh(box(1.3, 0.4, 0.06), WOOD, 0, 3.45, s * 0.62), mesh(box(0.06, 0.4, 1.3), WOOD, s * 0.62, 3.45, 0));
  tower.add(mesh(cyl(0.03, 0.03, 1.3, 5), WOOD_DARK, 0.5, 4.0, 0.5));
  const flag = mesh(box(0.6, 0.36, 0.03), 0xffc93c, 0.82, 4.45, 0.5);
  tower.add(flag);
  const radar = new THREE.Group();
  radar.position.set(-0.3, 3.65, -0.3);
  radar.add(mesh(cyl(0.04, 0.04, 0.4, 5), 0x9a94b2, 0, 0.1, 0));
  const dish = mesh(sharedGeo('isl5-dish', () => new THREE.SphereGeometry(0.34, 12, 6, 0, Math.PI * 2, 0, Math.PI / 3)), 0xffffff, 0, 0.36, 0.05);
  dish.rotation.x = -1.2;
  radar.add(dish);
  tower.add(radar);
  g.add(tower);
  // the practice board in front: a 3x3 checker with a toy bug
  const board = new THREE.Group();
  board.position.set(-3.3, 0, 1.6);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) board.add(mesh(box(0.56, 0.12, 0.56), (i + j) % 2 ? 0x8ad65a : 0x7cc94f, (i - 1) * 0.6, 0.06, (j - 1) * 0.6, false));
  const bug = toyBug(0x7b6cf6, 0.55);
  bug.position.set(0, 0.12, -0.6);
  board.add(bug);
  const target = mesh(box(0.5, 0.02, 0.5), basic(0xff3b54), 0, 0.13, 0, false);
  board.add(target);
  g.add(board);
  g.userData.radar = radar;
  g.userData.flag = flag;
  g.userData.bug = bug;
  return g;
}

// ---------- decorations ----------

export const DECO5 = new Set(['mechStatue', 'bugPlush']);

export function makeDeco5(id) {
  const g = new THREE.Group();
  if (id === 'mechStatue') { // finishing Bean Brigade: a golden-trimmed mech on a plinth
    g.add(mesh(box(1.1, 0.4, 1.1), 0xc9c3d6, 0, 0.2, 0), mesh(box(1.16, 0.08, 1.16), COLORS.gold, 0, 0.42, 0));
    const m = toyMech(0xff5d73, COLORS.gold);
    m.scale.setScalar(0.62);
    m.position.y = 0.46;
    g.add(m);
    const star = mesh(ico(0.12, 0), toon(COLORS.gold, { emissive: 0x443300 }), 0, 1.75, 0, false);
    g.add(star);
    g.userData.spin = star;
  } else { // clearing Clover Isle: a cuddly bug plushie on a cushion
    const c = mesh(cyl(0.45, 0.5, 0.18, 14), 0xff9fd0, 0, 0.09, 0);
    g.add(c);
    const b = toyBug(0x9b5de5, 0.75);
    b.position.y = 0.16;
    g.add(b);
    g.add(mesh(cyl(0.02, 0.02, 0.2, 5), INK, -0.1, 0.78, 0.2, false).rotateZ(0.3), mesh(cyl(0.02, 0.02, 0.2, 5), INK, 0.1, 0.78, 0.2, false).rotateZ(-0.3));
  }
  return g;
}
