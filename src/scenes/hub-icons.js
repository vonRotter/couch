import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { COLORS, toon, basic, sharedGeo } from '../core/palette.js';
import { makeGrumble } from '../core/critters.js';
import { soccerBallTexture } from '../core/world.js';
import { glyphMaterial } from '../core/edu.js';

// Small floating 3D icons, one per game, shown above each pad on the island.

const box = (key, w, h, d, r = 0.08) => sharedGeo(`icon-${key}`, () => new RoundedBoxGeometry(w, h, d, 2, r));
const sph = (r) => sharedGeo(`icon-sph${r}`, () => new THREE.SphereGeometry(r, 18, 12));
const cyl = (key, rt, rb, h, seg = 18) => sharedGeo(`icon-${key}`, () => new THREE.CylinderGeometry(rt, rb, h, seg));

function mesh(geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

const ICONS = {
  bubble(g) {
    const critter = makeGrumble(0x7b6cf6);
    critter.scale.setScalar(1.1);
    critter.position.y = -0.5;
    g.add(critter);
    g.add(mesh(sph(0.95), toon(0xbfe9ff, { transparent: true, opacity: 0.4 })));
    g.add(mesh(sph(0.16), toon(COLORS.white), -0.4, 0.45, 0.65));
  },
  platformer(g) {
    g.add(mesh(box('dirt', 1.2, 0.9, 1.2), toon(COLORS.dirt), 0, -0.3, 0));
    g.add(mesh(box('grass', 1.3, 0.35, 1.3), toon(COLORS.grass), 0, 0.25, 0));
    g.add(mesh(cyl('pole', 0.05, 0.05, 1.4, 8), toon(COLORS.white), 0.35, 1.1, 0));
    const flag = mesh(sharedGeo('icon-flag', () => new THREE.ConeGeometry(0.3, 0.6, 3)), toon(0xff5d73), 0.62, 1.6, 0);
    flag.rotation.z = -Math.PI / 2;
    g.add(flag);
  },
  paint(g) {
    g.add(mesh(cyl('bucket', 0.6, 0.5, 0.9), toon(COLORS.icing), 0, -0.2, 0));
    g.add(mesh(cyl('bucketTop', 0.56, 0.56, 0.08), toon(0xff5d73), 0, 0.27, 0));
    const drip = mesh(sph(0.14), toon(0x4cc9f0), 0.55, 0.05, 0.1);
    drip.scale.set(0.7, 1.5, 0.7);
    g.add(drip);
    const brush = new THREE.Group();
    brush.add(mesh(cyl('brushStick', 0.06, 0.06, 1.1, 8), toon(COLORS.trunk), 0, 0.55, 0));
    brush.add(mesh(box('bristle', 0.35, 0.3, 0.15, 0.05), toon(0xffc93c), 0, 1.2, 0));
    brush.position.set(-0.2, 0.2, 0);
    brush.rotation.z = 0.5;
    g.add(brush);
  },
  archers(g) {
    [[0.85, 0xff5d73], [0.62, 0xffffff], [0.4, 0x4cc9f0], [0.18, 0xffc93c]].forEach(([r, c], i) => {
      const d = mesh(cyl(`tgt${r}`, r, r, 0.12, 24), toon(c), 0, 0, 0.02 + i * 0.03);
      d.rotation.x = Math.PI / 2;
      g.add(d);
    });
    const arrow = new THREE.Group();
    const shaft = mesh(cyl('shaft', 0.04, 0.04, 1.2, 6), toon(COLORS.icing));
    shaft.rotation.x = Math.PI / 2;
    shaft.position.z = 0.6;
    const fl = mesh(sharedGeo('icon-fletch', () => new THREE.ConeGeometry(0.12, 0.25, 3)), toon(0xff5d73), 0, 0, 1.15);
    fl.rotation.x = Math.PI / 2;
    arrow.add(shaft, fl);
    arrow.position.set(0.15, 0.1, 0);
    arrow.rotation.set(0.25, 0.3, 0);
    g.add(arrow);
  },
  brawl(g) {
    const fist = mesh(sph(0.6), toon(0xff3b5c));
    fist.scale.set(1.15, 0.95, 1.1);
    g.add(fist);
    g.add(mesh(sph(0.24), toon(0xff3b5c), -0.55, 0, 0.3));
    const cuff = mesh(cyl('cuff', 0.36, 0.4, 0.4), toon(COLORS.white), 0, -0.7, 0);
    g.add(cuff);
  },
  kart(g) {
    g.add(mesh(box('kartBody', 1.0, 0.35, 1.5, 0.14), toon(0x3ddc97), 0, 0, 0));
    g.add(mesh(box('kartNose', 0.9, 0.22, 0.35, 0.08), toon(COLORS.white), 0, -0.02, 0.85));
    for (const [x, z] of [[-0.55, 0.5], [0.55, 0.5], [-0.55, -0.5], [0.55, -0.5]]) {
      const w = mesh(cyl('wheel', 0.22, 0.22, 0.2, 12), toon(COLORS.ink), x, -0.15, z);
      w.rotation.z = Math.PI / 2;
      g.add(w);
    }
    g.add(mesh(box('spoiler', 1.1, 0.07, 0.25, 0.03), toon(0x3ddc97), 0, 0.35, -0.75));
    g.add(mesh(sph(0.25), toon(0xffc93c), 0, 0.35, -0.1));
  },
  portal(g) {
    [[-0.55, 0x4cc9f0], [0.55, 0xff8c42]].forEach(([x, c]) => {
      const ring = mesh(sharedGeo('icon-ring', () => new THREE.TorusGeometry(0.5, 0.11, 10, 28)), toon(c, { emissive: 0x111111 }), x, 0, 0);
      ring.scale.y = 1.4;
      const fill = mesh(sharedGeo('icon-ringFill', () => new THREE.CircleGeometry(0.46, 24)), basic(c, { transparent: true, opacity: 0.5 }), x, 0, 0);
      fill.scale.y = 1.4;
      g.add(ring, fill);
    });
  },
  football(g) {
    const ball = new THREE.Mesh(sph(0.85), new THREE.MeshToonMaterial({ map: soccerBallTexture(), gradientMap: toon(0xffffff).gradientMap }));
    ball.castShadow = true;
    g.add(ball);
  },
  hockey(g) {
    const stick = new THREE.Group();
    stick.add(mesh(box('stickShaft', 0.14, 1.8, 0.14, 0.04), toon(0xc98b5a), 0, 0.3, 0));
    stick.add(mesh(box('stickBlade', 0.6, 0.18, 0.16, 0.05), toon(COLORS.ink), 0.24, -0.55, 0));
    stick.rotation.z = -0.35;
    g.add(stick);
    g.add(mesh(cyl('puck', 0.32, 0.32, 0.16, 20), toon(COLORS.ink), 0.55, -0.62, 0.25));
  },
  slalom(g) {
    g.add(mesh(sharedGeo('icon-snow', () => new THREE.ConeGeometry(0.9, 1.0, 9)), toon(COLORS.white), 0, -0.45, 0));
    [[-0.45, 0xff5d73], [0.45, 0x4c9bf0]].forEach(([x, c]) => {
      g.add(mesh(cyl('gatePole', 0.04, 0.04, 1.3, 6), toon(c), x, 0.3, 0.35));
      g.add(mesh(box('gateFlag', 0.4, 0.28, 0.03, 0.01), toon(c), x + (x < 0 ? 0.2 : -0.2), 0.75, 0.35));
    });
  },
  space(g) {
    const rocket = new THREE.Group();
    rocket.add(mesh(sharedGeo('icon-rkBody', () => new THREE.CapsuleGeometry(0.4, 0.9, 6, 14)), toon(0x6a4fd8)));
    rocket.add(mesh(sharedGeo('icon-rkNose', () => new THREE.ConeGeometry(0.34, 0.55, 14)), toon(COLORS.white), 0, 0.95, 0));
    rocket.add(mesh(sharedGeo('icon-rkWin', () => new THREE.SphereGeometry(0.17, 12, 10)), toon(0xbfe9ff), 0, 0.25, 0.33));
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const fin = mesh(box('rkFin', 0.06, 0.45, 0.4, 0.02), toon(0xff5d73), Math.sin(a) * 0.42, -0.55, Math.cos(a) * 0.42);
      fin.rotation.y = a;
      rocket.add(fin);
    }
    const flame = mesh(sharedGeo('icon-rkFlame', () => new THREE.ConeGeometry(0.25, 0.6, 10)), basic(0xffc93c), 0, -1.05, 0);
    flame.rotation.x = Math.PI;
    rocket.add(flame);
    rocket.rotation.z = -0.5;
    g.add(rocket);
    const ring = mesh(sharedGeo('icon-spRing', () => new THREE.TorusGeometry(1.0, 0.07, 8, 32)), toon(COLORS.gold));
    ring.rotation.x = 1.2;
    g.add(ring);
  },
  runner(g) {
    // A stopwatch with a lightning bolt.
    const body = mesh(cyl('watch', 0.8, 0.8, 0.3, 28), toon(0xff7a5c));
    body.rotation.x = Math.PI / 2;
    g.add(body);
    const face = mesh(cyl('watchFace', 0.64, 0.64, 0.32, 28), toon(COLORS.white), 0, 0, 0.02);
    face.rotation.x = Math.PI / 2;
    g.add(face);
    g.add(mesh(cyl('watchKnob', 0.12, 0.12, 0.25, 10), toon(0xff7a5c), 0, 0.95, 0));
    const hand = mesh(box('watchHand', 0.07, 0.5, 0.05, 0.02), toon(COLORS.ink), 0.12, 0.18, 0.2);
    hand.rotation.z = -0.6;
    g.add(hand);
    g.add(mesh(sph(0.07), toon(COLORS.ink), 0, 0, 0.2));
    [[-0.95, 0.2], [-1.15, -0.15], [-0.95, -0.5]].forEach(([x, y]) => g.add(mesh(box('speedLine', 0.45, 0.07, 0.07, 0.03), toon(0x4cc9f0), x, y, 0)));
  },
  cook(g) {
    g.add(mesh(cyl('cookPot', 0.62, 0.52, 0.7), toon(0xb9c3d6), 0, -0.2, 0));
    g.add(mesh(cyl('cookSoup', 0.56, 0.56, 0.08), toon(0xff6a3d), 0, 0.12, 0));
    for (const s of [-1, 1]) g.add(mesh(box('cookHandle', 0.25, 0.1, 0.2, 0.04), toon(COLORS.ink), s * 0.72, 0, 0));
    g.add(mesh(sph(0.22), toon(0xff4f4f), 0.25, 0.3, 0.15));
    g.add(mesh(sph(0.16), toon(0x6cc94a), -0.25, 0.28, -0.1));
    for (let i = 0; i < 3; i++) g.add(mesh(sph(0.12 + i * 0.03), toon(COLORS.white), -0.1 + i * 0.12, 0.55 + i * 0.28, 0));
  },
  hideseek(g) {
    // A garden gnome with a magnifying glass.
    g.add(mesh(cyl('hsBoots', 0.36, 0.36, 0.12), toon(0x6b4a32), 0, -0.75, 0));
    g.add(mesh(cyl('hsCoat', 0.3, 0.42, 0.6), toon(0x3a86ff), 0, -0.4, 0));
    g.add(mesh(sph(0.26), toon(0xffd2b0), 0, 0.02, 0));
    const beard = mesh(sharedGeo('icon-hsBeard', () => new THREE.ConeGeometry(0.26, 0.45, 14)), toon(COLORS.white), 0, -0.15, 0.13);
    beard.rotation.x = Math.PI;
    g.add(beard);
    g.add(mesh(sph(0.08), toon(COLORS.blush), 0, 0.0, 0.26));
    g.add(mesh(sharedGeo('icon-hsHat', () => new THREE.ConeGeometry(0.28, 0.7, 14)), toon(0xff4d5e), 0, 0.5, 0));
    const glass = new THREE.Group();
    glass.add(mesh(cyl('hsHandle', 0.06, 0.07, 0.6, 8), toon(COLORS.trunk), 0, -0.45, 0));
    glass.add(mesh(sharedGeo('icon-hsRing', () => new THREE.TorusGeometry(0.3, 0.07, 8, 24)), toon(COLORS.gold)));
    const lens = mesh(cyl('hsLens', 0.27, 0.27, 0.04, 20), toon(0xbfe9ff, { transparent: true, opacity: 0.55 }));
    lens.rotation.x = Math.PI / 2;
    glass.add(lens);
    glass.position.set(0.6, 0.1, 0.4);
    glass.rotation.z = -0.5;
    g.add(glass);
  },
  snowball(g) {
    g.add(mesh(sharedGeo('icon-sbMound', () => new THREE.SphereGeometry(0.85, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2)), toon(COLORS.white), 0, -0.75, 0));
    [[-0.38, -0.55], [0.38, -0.55], [0, -0.17]].forEach(([x, y]) => g.add(mesh(box('sbBrick', 0.72, 0.36, 0.42, 0.08), toon(0xe6f2ff), x, y, 0.35)));
    g.add(mesh(sph(0.42), toon(COLORS.white), 0.15, 0.45, 0.2));
    g.add(mesh(cyl('sbPole', 0.04, 0.04, 1.2, 6), toon(COLORS.ink), -0.6, 0.35, -0.2));
    const flag = mesh(sharedGeo('icon-sbFlag', () => new THREE.ConeGeometry(0.22, 0.5, 3)), toon(0x4cc9f0), -0.37, 0.75, -0.2);
    flag.rotation.z = -Math.PI / 2;
    g.add(flag);
  },
  learnmix(g) {
    // A clock at "halv fire" with a krone coin.
    const rim = mesh(cyl('lmClock', 0.85, 0.85, 0.22, 32), toon(0x8ac926));
    rim.rotation.x = Math.PI / 2;
    g.add(rim);
    const face = mesh(cyl('lmClockFace', 0.7, 0.7, 0.24, 32), toon(COLORS.white), 0, 0, 0.01);
    face.rotation.x = Math.PI / 2;
    g.add(face);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const tick = mesh(box(i % 3 ? 'lmTick' : 'lmTickBig', 0.05, i % 3 ? 0.08 : 0.16, 0.04, 0.01), toon(COLORS.ink), Math.sin(a) * 0.58, Math.cos(a) * 0.58, 0.14);
      tick.rotation.z = -a;
      g.add(tick);
    }
    const ha = (3.5 / 12) * Math.PI * 2;
    const hour = mesh(box('lmHour', 0.09, 0.36, 0.05, 0.02), toon(COLORS.ink), Math.sin(ha) * 0.18, Math.cos(ha) * 0.18, 0.16);
    hour.rotation.z = -ha;
    const minute = mesh(box('lmMin', 0.06, 0.52, 0.05, 0.02), toon(COLORS.ink), 0, -0.26, 0.17);
    g.add(hour, minute, mesh(sph(0.07), toon(COLORS.ink), 0, 0, 0.19));
    const coin = mesh(cyl('lmCoin', 0.42, 0.42, 0.12, 24), toon(COLORS.gold), 0.72, -0.62, 0.35);
    coin.rotation.x = Math.PI / 2;
    g.add(coin);
    const kr = new THREE.Mesh(sharedGeo('icon-lmCoinFace', () => new THREE.PlaneGeometry(0.62, 0.62)), glyphMaterial('kr'));
    kr.position.set(0.72, -0.62, 0.42);
    g.add(kr);
  },
  golf(g) {
    g.add(mesh(cyl('golfGreen', 0.9, 0.9, 0.18, 24), toon(0x6fd86a), 0, -0.55, 0));
    g.add(mesh(cyl('golfHole', 0.2, 0.2, 0.02, 16), toon(COLORS.ink), 0.3, -0.45, 0.1));
    g.add(mesh(cyl('golfPole', 0.04, 0.04, 1.5, 8), toon(COLORS.white), 0.3, 0.3, 0.1));
    const flag = mesh(sharedGeo('icon-golfFlag', () => new THREE.ConeGeometry(0.28, 0.6, 3)), toon(0xff5d73), 0.58, 0.85, 0.1);
    flag.rotation.z = -Math.PI / 2;
    g.add(flag);
    g.add(mesh(sph(0.2), toon(COLORS.white), -0.35, -0.26, 0.35));
  },
  castle(g) {
    g.add(mesh(box('ktTower', 0.9, 1.3, 0.9), toon(0xd6cfe6), 0, -0.25, 0));
    for (const [x, z] of [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]]) g.add(mesh(box('ktMerlon', 0.26, 0.26, 0.26, 0.04), toon(0xd6cfe6), x, 0.53, z));
    g.add(mesh(box('ktDoor', 0.36, 0.5, 0.06, 0.04), toon(0xffc93c), 0, -0.65, 0.46));
    g.add(mesh(cyl('ktPole', 0.035, 0.035, 0.9, 6), toon(COLORS.icing), 0, 1.0, 0));
    g.add(mesh(box('ktFlag', 0.45, 0.28, 0.04, 0.02), toon(0x4cc9f0), 0.24, 1.3, 0));
    const sword = new THREE.Group();
    sword.add(mesh(box('ktBlade', 0.14, 0.95, 0.09, 0.05), toon(0xffe47a), 0, 0.45, 0));
    sword.add(mesh(box('ktGuard', 0.4, 0.08, 0.12, 0.03), toon(0xff5d73), 0, -0.05, 0));
    sword.add(mesh(cyl('ktGrip', 0.04, 0.04, 0.24, 6), toon(COLORS.trunk), 0, -0.2, 0));
    sword.position.set(0.7, -0.3, 0.35);
    sword.rotation.z = -0.5;
    g.add(sword);
  },
  keep(g) {
    // Castle gate with two towers, a pillow on top and a golden key.
    g.add(mesh(box('keepWall', 1.0, 1.0, 0.45), toon(0xb79fd6), 0, -0.25, 0));
    g.add(mesh(box('keepGate', 0.5, 0.65, 0.12, 0.05), toon(0xb07848), 0, -0.42, 0.22));
    for (const s of [-1, 1]) {
      g.add(mesh(cyl('keepTower', 0.28, 0.3, 1.4), toon(0xc9b5e6), s * 0.62, -0.05, 0));
      g.add(mesh(cyl('keepRoof', 0.0, 0.38, 0.5), toon(0xff5d73), s * 0.62, 0.9, 0));
    }
    const pillow = mesh(box('keepPillow', 0.85, 0.28, 0.6, 0.13), toon(0xfff3f8), 0, 0.42, 0.05);
    pillow.rotation.set(0.15, 0.4, -0.12);
    g.add(pillow);
    const key = new THREE.Group();
    key.add(mesh(sharedGeo('icon-keyRing', () => new THREE.TorusGeometry(0.16, 0.06, 8, 16)), toon(COLORS.gold), 0, 0.22, 0));
    key.add(mesh(box('keyShaft', 0.08, 0.45, 0.08, 0.02), toon(COLORS.gold), 0, -0.1, 0));
    key.add(mesh(box('keyTooth', 0.16, 0.07, 0.08, 0.02), toon(COLORS.gold), 0.09, -0.27, 0));
    key.position.set(0.45, -0.2, 0.4);
    key.rotation.z = -0.5;
    g.add(key);
  },
  guides(g) {
    // A grumble in a yellow hard hat marching home to a little house.
    g.add(mesh(box('gdHouse', 0.85, 0.7, 0.6, 0.06), toon(COLORS.cream), 0.45, -0.4, -0.25));
    const roof = mesh(sharedGeo('icon-gdRoof', () => new THREE.ConeGeometry(0.7, 0.5, 4)), toon(0xff7a7a), 0.45, 0.2, -0.25);
    roof.rotation.y = Math.PI / 4;
    roof.scale.z = 0.75;
    g.add(roof);
    g.add(mesh(box('gdDoor', 0.24, 0.38, 0.06, 0.03), toon(0x8a5a32), 0.45, -0.56, 0.07));
    g.add(mesh(box('gdWin', 0.18, 0.18, 0.06, 0.02), toon(0xffe47a, { emissive: 0x553300 }), 0.72, -0.28, 0.07));
    const critter = makeGrumble(0x7b6cf6);
    critter.scale.setScalar(0.95);
    critter.position.set(-0.5, -0.75, 0.25);
    critter.rotation.y = 0.6;
    critter.add(mesh(sharedGeo('icon-gdHat', () => new THREE.SphereGeometry(0.34, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2)), toon(0xffc93c), 0, 0.74, 0));
    critter.add(mesh(cyl('gdBrim', 0.44, 0.44, 0.05), toon(0xffc93c), 0, 0.76, 0.04));
    g.add(critter);
  },
  splash(g) {
    g.add(mesh(cyl('spCookie', 0.85, 0.9, 0.35, 24), toon(0xb87a48), 0, -0.75, 0));
    g.add(mesh(cyl('spFrost', 0.8, 0.86, 0.12, 24), toon(COLORS.candyPink), 0, -0.53, 0));
    const balloon = mesh(sph(0.55), toon(0x4cc9f0), 0, 0.25, 0);
    balloon.scale.set(1, 1.18, 1);
    g.add(balloon);
    g.add(mesh(sharedGeo('icon-spKnot', () => new THREE.ConeGeometry(0.12, 0.2, 8)), toon(0x4cc9f0), 0, -0.47, 0));
    g.add(mesh(sph(0.13), toon(COLORS.white), -0.22, 0.5, 0.42));
    [[-0.78, 0.05], [0.78, 0.15], [-0.6, -0.3], [0.62, -0.25], [0.05, 1.05]].forEach(([x, y], i) => {
      const d = mesh(sph(0.11), toon(i % 2 ? 0xbfe9ff : 0x8fd8ff), x, y, 0.15);
      d.scale.set(0.8, 1.3, 0.8);
      g.add(d);
    });
  },
  cave(g) {
    g.add(mesh(box('caveRock', 1.4, 0.4, 1.0, 0.16), toon(0x9a94b2), 0, -0.62, 0));
    [[0, 1.3, 0.26, 0x4cc9f0, 0], [-0.4, 0.85, 0.2, 0xff7eb6, 0.35], [0.36, 0.95, 0.2, 0x9ff0c8, -0.3], [0.1, 0.55, 0.15, 0xffd23f, -0.5]].forEach(([x, h, r, c, tilt], i) => {
      const cr = mesh(cyl(`caveCry${i}`, 0, r, h, 6), toon(c, { emissive: 0x111133 }), x, -0.42 + h / 2, i === 3 ? 0.32 : 0);
      cr.rotation.z = tilt;
      g.add(cr);
    });
    const coil = mesh(sharedGeo('icon-caveCoil', () => new THREE.TorusGeometry(0.22, 0.07, 8, 18)), toon(0xe8c07a), 0.58, -0.28, 0.36);
    coil.rotation.y = 0.6;
    g.add(coil);
    g.add(mesh(cyl('caveRope', 0.04, 0.04, 0.6, 6), toon(0xe8c07a), 0.78, -0.55, 0.36));
  },
  dogfight(g) {
    // A little red biplane with a paint splat.
    const p = new THREE.Group();
    const fus = mesh(cyl('dfFus', 0.34, 0.18, 1.5, 14), toon(0xe0262f));
    fus.rotation.z = -Math.PI / 2;
    const cowl = mesh(cyl('dfCowl', 0.36, 0.38, 0.22, 14), toon(COLORS.cream), 0.82, 0, 0);
    cowl.rotation.z = -Math.PI / 2;
    p.add(fus, cowl);
    for (const y of [-0.28, 0.5]) p.add(mesh(box('dfWing', 0.6, 0.08, 1.9, 0.03), toon(0xff7b7b), 0.15, y, 0));
    for (const z of [-0.65, 0.65]) p.add(mesh(cyl('dfStrut', 0.03, 0.03, 0.78, 6), toon(COLORS.ink), 0.15, 0.11, z));
    p.add(mesh(box('dfFin', 0.38, 0.42, 0.06, 0.02), toon(0xff7b7b), -0.85, 0.25, 0));
    p.add(mesh(box('dfStab', 0.34, 0.06, 0.8, 0.02), toon(0xff7b7b), -0.85, 0.02, 0));
    for (const s of [-1, 1]) p.add(mesh(box('dfBlade', 0.04, 0.5, 0.1, 0.02), toon(0xa0704a), 1.0, s * 0.25, 0));
    const splat = mesh(sph(0.16), toon(0x4cc9f0), -0.3, 0.05, 0.3);
    splat.scale.set(1.4, 1, 0.4);
    p.add(splat);
    p.rotation.set(0.35, -0.5, 0.25);
    g.add(p);
  },
  tachyon(g) {
    // A sleek starfighter.
    const ship = new THREE.Group();
    const body = mesh(sharedGeo('icon-tyBody', () => new THREE.ConeGeometry(0.32, 1.6, 6)), toon(0x3b4fbf));
    body.rotation.z = -Math.PI / 2;
    ship.add(body);
    ship.add(mesh(box('tyWing', 0.7, 0.06, 1.7, 0.03), toon(0x8fa2ff), -0.2, 0, 0));
    ship.add(mesh(sph(0.16), toon(0x9ff0ff, { emissive: 0x224466 }), 0.2, 0.18, 0));
    for (const z of [-0.25, 0.25]) ship.add(mesh(cyl('tyFlame', 0.0, 0.12, 0.4, 8), toon(0xffb347, { emissive: 0x663300 }), -0.95, 0, z));
    ship.children[ship.children.length - 1].rotation.z = Math.PI / 2;
    ship.children[ship.children.length - 2].rotation.z = Math.PI / 2;
    ship.rotation.set(0.3, -0.6, 0.2);
    g.add(ship);
  },
  starlite(g) {
    // A glossy crystal on a paint splat.
    g.add(mesh(cyl('slSplat', 0.95, 0.95, 0.08, 10), toon(0xff6fb5), 0, -0.7, 0));
    const cr = mesh(sharedGeo('icon-slCrystal', () => new THREE.OctahedronGeometry(0.6, 0)), toon(0x4cc9f0, { emissive: 0x112244 }), 0, 0.05, 0);
    cr.scale.set(0.8, 1.4, 0.8);
    g.add(cr);
    g.add(mesh(sph(0.16), toon(0xffe47a), 0.6, -0.5, 0.3));
  },
  foothold(g) {
    // A colony dome with a flag.
    g.add(mesh(cyl('fhBase', 0.95, 1.0, 0.2, 18), toon(0x8a7a5a), 0, -0.7, 0));
    g.add(mesh(sharedGeo('icon-fhDome', () => new THREE.SphereGeometry(0.7, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2)), toon(0xd8e8f0), 0, -0.6, 0));
    g.add(mesh(box('fhDoor', 0.26, 0.32, 0.08, 0.03), toon(0x5a7d2a), 0, -0.44, 0.66));
    g.add(mesh(cyl('fhPole', 0.03, 0.03, 0.9, 6), toon(COLORS.ink), 0.5, 0.2, 0));
    g.add(mesh(box('fhFlag', 0.4, 0.24, 0.03, 0.02), toon(0xffc93c), 0.72, 0.5, 0));
  },
  party(g) {
    g.add(mesh(box('gift', 1.2, 1.0, 1.2, 0.1), toon(0xb5179e), 0, -0.2, 0));
    g.add(mesh(box('giftLid', 1.34, 0.26, 1.34, 0.08), toon(0xd94cc0), 0, 0.38, 0));
    g.add(mesh(box('ribbonX', 0.22, 1.32, 1.36, 0.04), toon(COLORS.gold), 0, -0.04, 0));
    g.add(mesh(box('ribbonZ', 1.36, 1.32, 0.22, 0.04), toon(COLORS.gold), 0, -0.04, 0));
    for (const s of [-1, 1]) {
      const loop = mesh(sharedGeo('icon-bow', () => new THREE.TorusGeometry(0.22, 0.07, 8, 16)), toon(COLORS.gold), s * 0.22, 0.68, 0);
      loop.rotation.set(0, Math.PI / 2, s * 0.6);
      g.add(loop);
    }
    [[0xff5d73, -0.75, 0.9, 0.2], [0x4cc9f0, 0.8, 0.75, -0.1], [0x3ddc97, 0.5, 1.15, 0.3], [0xffc93c, -0.45, 1.25, -0.2]].forEach(([c, x, y, z], i) => {
      const bit = mesh(box('confetti', 0.16, 0.16, 0.05, 0.02), toon(c), x, y, z);
      bit.rotation.set(i, i * 0.7, i * 1.3);
      g.add(bit);
    });
  },
  spelling(g) {
    const cube = mesh(box('abc', 1.2, 1.2, 1.2, 0.14), toon(0xff9fd0));
    const faces = [['A', 0, 0, 0.61, 0], ['B', 0.61, 0, 0, Math.PI / 2], ['C', -0.61, 0, 0, -Math.PI / 2], ['Æ', 0, 0, -0.61, Math.PI]];
    for (const [ch, x, y, z, ry] of faces) {
      const f = new THREE.Mesh(sharedGeo('icon-face', () => new THREE.PlaneGeometry(1.0, 1.0)), glyphMaterial(ch));
      f.position.set(x, y, z);
      f.rotation.y = ry;
      cube.add(f);
    }
    g.add(cube);
  },
  math(g) {
    const cube = mesh(box('num', 1.2, 1.2, 1.2, 0.14), toon(0xffe47a));
    const faces = [['1', 0, 0, 0.61, 0], ['+', 0.61, 0, 0, Math.PI / 2], ['2', -0.61, 0, 0, -Math.PI / 2], ['=', 0, 0, -0.61, Math.PI]];
    for (const [ch, x, y, z, ry] of faces) {
      const f = new THREE.Mesh(sharedGeo('icon-face', () => new THREE.PlaneGeometry(1.0, 1.0)), glyphMaterial(ch));
      f.position.set(x, y, z);
      f.rotation.y = ry;
      cube.add(f);
    }
    g.add(cube);
  },
  story(g) {
    // A big Party Star wearing the Grumble King's crown.
    const shape = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? 0.85 : 0.4;
      const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
      if (i === 0) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r); else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    shape.closePath();
    const star = mesh(sharedGeo('icon-storyStar', () => new THREE.ExtrudeGeometry(shape, { depth: 0.25, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.07, bevelSegments: 2 }).center()), toon(COLORS.gold));
    g.add(star);
    for (const s of [-1, 1]) g.add(mesh(sph(0.09), toon(COLORS.ink), s * 0.2, 0.05, 0.22));
    const crown = new THREE.Group();
    crown.add(mesh(cyl('storyCrown', 0.36, 0.32, 0.22, 16), toon(0x8a63f0)));
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      crown.add(mesh(sharedGeo('icon-storySpike', () => new THREE.ConeGeometry(0.09, 0.22, 8)), toon(0x8a63f0), Math.cos(a) * 0.3, 0.2, Math.sin(a) * 0.3));
    }
    crown.position.y = 0.95;
    crown.rotation.z = 0.15;
    g.add(crown);
  },
};

export function makeGameIcon(key) {
  const g = new THREE.Group();
  (ICONS[key] || ICONS.football)(g);
  return g;
}
