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
};

export function makeGameIcon(key) {
  const g = new THREE.Group();
  (ICONS[key] || ICONS.football)(g);
  return g;
}
