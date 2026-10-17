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
