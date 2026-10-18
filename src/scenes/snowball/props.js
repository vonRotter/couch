import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { COLORS, toon, sharedGeo } from '../../core/palette.js';

// Meshes for Snowball Fort: scenery, targets, flags, gift icons. Everything is built from primitives.

export const BALL_R = 0.17;
export const ballGeo = () => sharedGeo('sbBall', () => new THREE.SphereGeometry(BALL_R, 12, 9));

/** Rounded-rectangle shape centered on the origin. */
export function roundedRect(hx, hz, r) {
  const s = new THREE.Shape();
  s.moveTo(-hx + r, -hz);
  s.lineTo(hx - r, -hz);
  s.absarc(hx - r, -hz + r, r, -Math.PI / 2, 0);
  s.lineTo(hx, hz - r);
  s.absarc(hx - r, hz - r, r, 0, Math.PI / 2);
  s.lineTo(-hx + r, hz);
  s.absarc(-hx + r, hz - r, r, Math.PI / 2, Math.PI);
  s.lineTo(-hx, -hz + r);
  s.absarc(-hx + r, -hz + r, r, Math.PI, Math.PI * 1.5);
  return s;
}

/** A wedge rising from height 0 at x=0 to h at x=len, `w` wide (z from -w/2 to w/2). Flat shaded. */
export function wedgeGeometry(len, w, h) {
  const a = [0, 0, -w / 2], b = [0, 0, w / 2], c = [len, h, w / 2], d = [len, h, -w / 2];
  const e = [len, 0, -w / 2], f = [len, 0, w / 2];
  const tris = [a, b, c, a, c, d, e, d, c, e, c, f, a, d, e, b, f, c, a, e, f, a, f, b];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(tris.flat(), 3));
  geo.computeVertexNormals();
  return geo;
}

/** Snowy pine: stacked cones with white caps. */
export function makePine(rand, scale = 1) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(sharedGeo('sbTrunk', () => new THREE.CylinderGeometry(0.18, 0.24, 0.8, 6)), toon(COLORS.trunk));
  trunk.position.y = 0.4;
  g.add(trunk);
  for (let i = 0; i < 3; i++) {
    const cone = new THREE.Mesh(sharedGeo(`sbPine${i}`, () => new THREE.ConeGeometry(1.1 - i * 0.28, 1.25, 8)), toon(i % 2 ? 0x3fa65a : 0x2f8f4e));
    cone.position.y = 1.0 + i * 0.72;
    cone.castShadow = true;
    const cap = new THREE.Mesh(sharedGeo(`sbPineCap${i}`, () => new THREE.ConeGeometry(0.52 - i * 0.12, 0.5, 8)), toon(COLORS.white));
    cap.position.y = 1.4 + i * 0.72;
    g.add(cone, cap);
  }
  g.scale.setScalar(scale);
  g.rotation.y = rand() * 6;
  return g;
}

/** Crenellated snow wall on the back bank, towers with team roofs and banners. */
export function makeFort(teamColor, HZ) {
  const g = new THREE.Group();
  const brick = sharedGeo('sbFortBrick', () => new RoundedBoxGeometry(0.7, 0.55, 1.0, 2, 0.1));
  for (let z = -HZ + 0.6, k = 0; z <= HZ - 0.5; z += 1.02, k++) {
    for (let row = 0; row < 2; row++) {
      const m = new THREE.Mesh(brick, toon(row ? 0xffffff : 0xe8f3ff));
      m.position.set(0, 0.3 + row * 0.55, z + (row ? 0.25 : 0));
      m.castShadow = m.receiveShadow = true;
      g.add(m);
    }
    if (k % 2 === 0) {
      const cren = new THREE.Mesh(brick, toon(0xffffff));
      cren.position.set(0, 1.4, z);
      cren.scale.set(1, 0.9, 0.6);
      cren.castShadow = true;
      g.add(cren);
    }
  }
  for (const z of [-HZ - 0.2, HZ + 0.2]) {
    const tower = new THREE.Mesh(sharedGeo('sbTower', () => new THREE.CylinderGeometry(0.85, 0.95, 2.4, 14)), toon(0xf4f9ff));
    tower.position.set(0, 1.2, z);
    const roof = new THREE.Mesh(sharedGeo('sbRoof', () => new THREE.ConeGeometry(1.1, 1.2, 14)), toon(teamColor));
    roof.position.set(0, 3.0, z);
    const pole = new THREE.Mesh(sharedGeo('sbBannerPole', () => new THREE.CylinderGeometry(0.04, 0.04, 1.0, 6)), toon(COLORS.ink));
    pole.position.set(0, 4.0, z);
    const banner = new THREE.Mesh(sharedGeo('sbBanner', () => new THREE.BoxGeometry(0.03, 0.4, 0.7)), toon(teamColor));
    banner.position.set(0, 4.25, z + 0.35);
    tower.castShadow = roof.castShadow = true;
    g.add(tower, roof, pole, banner);
  }
  return g;
}

/** The big scoop pile: snow blobs, a shovel in the team color and a pyramid of ready snowballs. */
export function makePile(teamColor) {
  const pile = new THREE.Group();
  [[0, 0, 1.1, 0.55], [0.7, 0.3, 0.7, 0.4], [-0.6, -0.4, 0.75, 0.38], [0.1, 0.7, 0.6, 0.32]].forEach(([x, z, r, h]) => {
    const m = new THREE.Mesh(sharedGeo('sbPileBlob', () => new THREE.SphereGeometry(1, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2)), toon(COLORS.white));
    m.position.set(x, 0, z);
    m.scale.set(r, h, r);
    m.castShadow = m.receiveShadow = true;
    pile.add(m);
  });
  const shovel = new THREE.Group();
  const stick = new THREE.Mesh(sharedGeo('sbShovelStick', () => new THREE.CylinderGeometry(0.05, 0.05, 1.2, 6)), toon(COLORS.trunk));
  stick.position.y = 0.6;
  const blade = new THREE.Mesh(sharedGeo('sbShovelBlade', () => new RoundedBoxGeometry(0.42, 0.5, 0.06, 2, 0.03)), toon(teamColor));
  blade.position.y = 1.25;
  shovel.add(stick, blade);
  shovel.position.set(0.4, 0.3, -0.5);
  shovel.rotation.set(0.3, 0, -0.4);
  pile.add(shovel);
  [[0, 0], [0.34, 0], [0.17, 0.28], [0.17, 0.1, 1]].forEach(([x, z, up]) => {
    const b = new THREE.Mesh(ballGeo(), toon(COLORS.white));
    b.position.set(-1.0 + x, BALL_R + (up ? 0.26 : 0), 0.9 + z);
    b.scale.setScalar(1.15);
    b.castShadow = true;
    pile.add(b);
  });
  return pile;
}

/** A target in the team color (Snow Targets mode). `part` is the bit that pops when hit. */
export function makeTarget(team, teamColor, type, x, z) {
  const s = team ? 1 : -1;
  const col = teamColor;
  const g = new THREE.Group();
  const part = new THREE.Group();
  let hy = 1.4, hx = 0;
  if (type === 'flag') {
    const mound = new THREE.Mesh(sharedGeo('sbMound', () => new THREE.SphereGeometry(0.42, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2)), toon(COLORS.white));
    const pole = new THREE.Mesh(sharedGeo('sbFlagPole', () => new THREE.CylinderGeometry(0.05, 0.05, 2.0, 8)), toon(COLORS.icing));
    pole.position.y = 1.0;
    const knob = new THREE.Mesh(sharedGeo('sbKnob', () => new THREE.SphereGeometry(0.09, 10, 8)), toon(COLORS.gold));
    knob.position.y = 2.02;
    pole.castShadow = true;
    g.add(mound, pole, knob);
    const flag = new THREE.Mesh(sharedGeo('sbFlag', () => new RoundedBoxGeometry(0.85, 0.6, 0.06, 2, 0.03)), toon(col));
    flag.position.set(-s * 0.45, 0, 0);
    const star = new THREE.Mesh(sharedGeo('sbFlagDot', () => new THREE.CylinderGeometry(0.13, 0.13, 0.08, 14)), toon(COLORS.white));
    star.rotation.x = Math.PI / 2;
    star.position.set(-s * 0.45, 0, 0.02);
    part.add(flag, star);
    part.position.y = 1.6;
    hy = 1.55; hx = -s * 0.4;
  } else if (type === 'bell') {
    for (const dz of [-0.6, 0.6]) {
      const post = new THREE.Mesh(sharedGeo('sbBellPost', () => new THREE.CylinderGeometry(0.07, 0.08, 2.1, 8)), toon(COLORS.trunk));
      post.position.set(0, 1.05, dz);
      post.castShadow = true;
      g.add(post);
    }
    const bar = new THREE.Mesh(sharedGeo('sbBellBar', () => new THREE.CylinderGeometry(0.07, 0.07, 1.45, 8)), toon(COLORS.trunk));
    bar.rotation.x = Math.PI / 2;
    bar.position.y = 2.05;
    const snowTop = new THREE.Mesh(sharedGeo('sbBellSnow', () => new RoundedBoxGeometry(0.22, 0.12, 1.5, 2, 0.05)), toon(COLORS.white));
    snowTop.position.y = 2.14;
    g.add(bar, snowTop);
    const bell = new THREE.Mesh(sharedGeo('sbBell', () => {
      const pts = [[0.02, 0.5], [0.16, 0.48], [0.24, 0.38], [0.27, 0.15], [0.33, 0.02], [0.4, -0.05], [0, -0.05]].map(([a, b]) => new THREE.Vector2(a, b));
      return new THREE.LatheGeometry(pts, 18);
    }), toon(col));
    bell.position.y = -0.5;
    bell.castShadow = true;
    const clapper = new THREE.Mesh(sharedGeo('sbClapper', () => new THREE.SphereGeometry(0.1, 10, 8)), toon(COLORS.gold));
    clapper.position.y = -0.55;
    const rope = new THREE.Mesh(sharedGeo('sbRope', () => new THREE.CylinderGeometry(0.025, 0.025, 0.3, 5)), toon(COLORS.ink));
    rope.position.y = -0.12;
    part.add(bell, clapper, rope);
    part.position.y = 2.0;
    hy = 1.6;
  } else {
    // Snowman: the body stays, the team-hatted head pops.
    const base = new THREE.Mesh(sharedGeo('sbSnowBase', () => new THREE.SphereGeometry(0.52, 16, 12)), toon(COLORS.white));
    base.position.y = 0.45;
    const mid = new THREE.Mesh(sharedGeo('sbSnowMid', () => new THREE.SphereGeometry(0.38, 16, 12)), toon(COLORS.white));
    mid.position.y = 1.08;
    const scarf = new THREE.Mesh(sharedGeo('sbScarf', () => new THREE.TorusGeometry(0.28, 0.08, 6, 16)), toon(col));
    scarf.rotation.x = Math.PI / 2;
    scarf.position.y = 1.36;
    for (const by of [0.95, 1.12]) {
      const btn = new THREE.Mesh(sharedGeo('sbButton', () => new THREE.SphereGeometry(0.05, 8, 6)), toon(COLORS.ink));
      btn.position.set(-s * 0.36, by, 0);
      g.add(btn);
    }
    base.castShadow = mid.castShadow = true;
    g.add(base, mid, scarf);
    const head = new THREE.Mesh(sharedGeo('sbSnowHead', () => new THREE.SphereGeometry(0.3, 14, 10)), toon(COLORS.white));
    head.castShadow = true;
    const nose = new THREE.Mesh(sharedGeo('sbNose', () => new THREE.ConeGeometry(0.06, 0.3, 8)), toon(0xff8c42));
    nose.rotation.z = s * Math.PI / 2;
    nose.position.set(-s * 0.38, 0, 0);
    const hat = new THREE.Mesh(sharedGeo('sbHat', () => new THREE.CylinderGeometry(0.2, 0.22, 0.3, 12)), toon(col));
    hat.position.y = 0.34;
    const brim = new THREE.Mesh(sharedGeo('sbBrim', () => new THREE.CylinderGeometry(0.32, 0.32, 0.05, 14)), toon(col));
    brim.position.y = 0.2;
    part.add(head, nose, hat, brim);
    for (const ez of [-0.11, 0.11]) {
      const eye = new THREE.Mesh(sharedGeo('sbEye', () => new THREE.SphereGeometry(0.045, 8, 6)), toon(COLORS.ink));
      eye.position.set(-s * 0.26, 0.08, ez);
      part.add(eye);
    }
    part.position.y = 1.62;
    hy = 1.65;
  }
  g.add(part);
  // A spinning gold coin above a target while it is worth 3.
  const coin = new THREE.Mesh(sharedGeo('sbCoin', () => new THREE.CylinderGeometry(0.26, 0.26, 0.07, 18)), toon(COLORS.gold, { emissive: 0x6a4a00 }));
  coin.rotation.x = Math.PI / 2;
  coin.position.set(hx, hy + 0.85, 0);
  coin.visible = false;
  g.add(coin);
  g.position.set(x, 0, z);
  return { team, type, x, z, hx: x + hx, hy, hz: z, group: g, part, coin, alive: true, respawn: 0, pop: 0, gold: 0, phase: Math.random() * 6 };
}

/** Capture-the-flag banner: a pole with a big team flag. The returned group's origin is at the pole's foot. */
export function makeCtfFlag(teamColor, dir) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(sharedGeo('sbCtfPole', () => new THREE.CylinderGeometry(0.06, 0.06, 2.2, 8)), toon(COLORS.icing));
  pole.position.y = 1.1;
  pole.castShadow = true;
  const knob = new THREE.Mesh(sharedGeo('sbCtfKnob', () => new THREE.SphereGeometry(0.12, 10, 8)), toon(COLORS.gold));
  knob.position.y = 2.25;
  const cloth = new THREE.Mesh(sharedGeo('sbCtfCloth', () => new RoundedBoxGeometry(1.0, 0.7, 0.07, 2, 0.03)), toon(teamColor));
  cloth.position.set(dir * 0.52, 1.8, 0);
  cloth.castShadow = true;
  const dot = new THREE.Mesh(sharedGeo('sbCtfDot', () => new THREE.CylinderGeometry(0.16, 0.16, 0.09, 16)), toon(COLORS.white));
  dot.rotation.x = Math.PI / 2;
  dot.position.set(dir * 0.52, 1.8, 0.02);
  g.add(pole, knob, cloth, dot);
  g.userData.cloth = cloth;
  return g;
}

/** Small 3D icon for each gift type. */
export function powerIcon(type) {
  const g = new THREE.Group();
  const sph = (r, color, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(sharedGeo(`sbPw${r}`, () => new THREE.SphereGeometry(r, 14, 10)), toon(color));
    m.position.set(x, y, z);
    g.add(m);
    return m;
  };
  if (type === 'giant') {
    sph(0.32, COLORS.white);
    const band = new THREE.Mesh(sharedGeo('sbPwBand', () => new THREE.TorusGeometry(0.33, 0.05, 6, 20)), toon(0xff5d73));
    band.rotation.x = 1.2;
    g.add(band);
  } else if (type === 'triple') {
    sph(0.15, COLORS.white, -0.18, -0.1, 0);
    sph(0.15, COLORS.white, 0.18, -0.1, 0);
    sph(0.15, COLORS.white, 0, 0.18, 0);
    sph(0.06, COLORS.gold, 0, 0.02, 0.15);
  } else if (type === 'boots') {
    for (const s of [-1, 1]) {
      const leg = new THREE.Mesh(sharedGeo('sbBootLeg', () => new RoundedBoxGeometry(0.18, 0.3, 0.18, 2, 0.05)), toon(0xff5d73));
      leg.position.set(s * 0.13, 0.05, 0);
      const toe = new THREE.Mesh(sharedGeo('sbBootToe', () => new RoundedBoxGeometry(0.18, 0.13, 0.3, 2, 0.05)), toon(0xff5d73));
      toe.position.set(s * 0.13, -0.08, 0.08);
      const cuff = new THREE.Mesh(sharedGeo('sbBootCuff', () => new RoundedBoxGeometry(0.21, 0.08, 0.21, 2, 0.03)), toon(COLORS.white));
      cuff.position.set(s * 0.13, 0.22, 0);
      g.add(leg, toe, cuff);
    }
  } else if (type === 'fort') {
    const brick = sharedGeo('sbPwBrick', () => new RoundedBoxGeometry(0.26, 0.17, 0.12, 2, 0.03));
    [[-0.16, -0.1, 0], [0.16, -0.1, 0], [0, 0.08, 0], [-0.27, -0.1, 0.18], [0.27, -0.1, 0.18]].forEach(([x, y, z], i) => {
      const m = new THREE.Mesh(brick, toon(i % 2 ? 0xe6f2ff : COLORS.white));
      m.position.set(x, y, z);
      if (i > 2) m.rotation.y = Math.PI / 2;
      g.add(m);
    });
    const flag = new THREE.Mesh(sharedGeo('sbPennant', () => new THREE.ConeGeometry(0.14, 0.4, 3)), toon(COLORS.gold));
    flag.rotation.z = Math.PI / 2;
    flag.position.set(0.12, 0.32, 0);
    g.add(flag);
  } else {
    const gem = new THREE.Mesh(sharedGeo('sbPwGem', () => new THREE.OctahedronGeometry(0.28, 0)), toon(0x7fd6ff, { emissive: 0x1a4a66 }));
    gem.scale.y = 1.3;
    g.add(gem);
    sph(0.06, COLORS.white, 0.1, 0.12, 0.18);
  }
  return g;
}
