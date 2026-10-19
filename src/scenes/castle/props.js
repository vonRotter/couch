import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Character, makeHat } from '../../core/character.js';
import { makeGrumble } from '../../core/critters.js';
import { COLORS, toon, sharedGeo } from '../../core/palette.js';
import { makeStar } from '../../core/world.js';

// Meshes for the campaign: tents, the Golden Bean flag, cages, levers, gates, pillow catapults,
// bean troopers, the Golden Bean Princess and the Grumble Duke. All toon primitives.

export const GOLD = 0xffd23f;
export const TROOPER_COLOR = 0xfff3dc;
export const GRUMBLE_COLORS = { knight: 0x8a63f0, archer: 0x3fb8a0, builder: 0xff9f43 };
export const FRIEND_COLOR = 0xff9fd0;

export function mesh(geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
}

const shadows = (g) => { g.traverse((o) => { if (o.isMesh) o.castShadow = true; }); return g; };

/** Striped class tent: stand inside and press down to change class. */
export function makeTent(color = 0xff5d73) {
  const g = new THREE.Group();
  const body = mesh(sharedGeo('kcTent', () => new THREE.ConeGeometry(1.5, 2.3, 4, 1, true)), toon(color), 0, 1.15, -0.9);
  body.rotation.y = Math.PI / 4;
  body.scale.set(1, 1, 0.6);
  const stripe = mesh(sharedGeo('kcTentS', () => new THREE.ConeGeometry(1.52, 0.5, 4, 1, true)), toon(COLORS.white), 0, 0.9, -0.9);
  stripe.rotation.y = Math.PI / 4;
  stripe.scale.set(1, 1, 0.6);
  const door = mesh(sharedGeo('kcTentD', () => new THREE.CircleGeometry(0.55, 3)), toon(0x5a3d7a), 0, 0.42, -0.25);
  door.rotation.z = Math.PI / 2;
  const pole = mesh(sharedGeo('kcTentP', () => new THREE.CylinderGeometry(0.04, 0.04, 0.8, 6)), toon(COLORS.trunk), 0, 2.6, -0.9);
  const pen = mesh(sharedGeo('kcTentF', () => new THREE.ConeGeometry(0.14, 0.42, 3)), toon(GOLD), 0.2, 2.85, -0.9);
  pen.rotation.z = -Math.PI / 2;
  g.add(body, stripe, door, pole, pen);
  return shadows(g);
}

/** The Golden Bean banner: troopers march home to it. */
export function makeGoalFlag() {
  const g = new THREE.Group();
  g.add(mesh(sharedGeo('kcGPole', () => new THREE.CylinderGeometry(0.08, 0.08, 4.4, 8)), toon(COLORS.icing), 0, 2.2, -0.5));
  g.add(mesh(sharedGeo('kcGKnob', () => new THREE.SphereGeometry(0.18, 12, 8)), toon(GOLD), 0, 4.5, -0.5));
  const cloth = new THREE.Group();
  cloth.position.set(0, 3.7, -0.5);
  cloth.add(mesh(sharedGeo('kcGCloth', () => new RoundedBoxGeometry(1.7, 1.1, 0.08, 2, 0.04)), toon(GOLD), 0.9, 0, 0));
  // A little bean on the banner.
  const bean = mesh(sharedGeo('kcGBean', () => new THREE.CapsuleGeometry(0.22, 0.2, 6, 12)), toon(COLORS.white), 0.9, 0, 0.06);
  bean.rotation.z = 0.5;
  cloth.add(bean);
  g.add(cloth);
  // Golden arch the troopers walk into.
  const arch = mesh(sharedGeo('kcGArch', () => new THREE.TorusGeometry(1.2, 0.16, 8, 20, Math.PI)), toon(GOLD), 0, 0, -0.9);
  arch.scale.set(1, 1.5, 1);
  g.add(arch);
  g.userData.cloth = cloth;
  return shadows(g);
}

/** A grumble cage, 2 tiles wide and 2 tall, origin at its bottom-left corner. */
export function makeCage(golden = false) {
  const g = new THREE.Group();
  const col = golden ? GOLD : 0x8a7fa8;
  g.add(mesh(sharedGeo('kcCageB', () => new RoundedBoxGeometry(1.9, 0.18, 1.1, 2, 0.06)), toon(col), 1, 0.09, -0.2));
  g.add(mesh(sharedGeo('kcCageT', () => new THREE.ConeGeometry(1.15, 0.5, 4)), toon(golden ? 0xffb703 : 0x6f6789), 1, 2.05, -0.2));
  g.children[1].rotation.y = Math.PI / 4;
  g.children[1].scale.set(1, 1, 0.6);
  const bars = new THREE.Group();
  for (let i = 0; i < 6; i++) bars.add(mesh(sharedGeo('kcCageBar', () => new THREE.CylinderGeometry(0.045, 0.045, 1.7, 6)), toon(col), 0.15 + i * 0.34, 0.98, 0.32));
  bars.add(mesh(sharedGeo('kcCageRing', () => new THREE.BoxGeometry(1.8, 0.08, 0.1)), toon(col), 1, 1.75, 0.32));
  g.add(bars);
  const lock = mesh(sharedGeo('kcLock', () => new RoundedBoxGeometry(0.3, 0.3, 0.12, 2, 0.05)), toon(GOLD), 1, 0.9, 0.42);
  g.add(lock);
  g.userData.bars = bars;
  return shadows(g);
}

/** A wall lever. userData.stick flips from left (closed) to right (open). */
export function makeLever() {
  const g = new THREE.Group();
  g.add(mesh(sharedGeo('kcLevPlate', () => new RoundedBoxGeometry(0.7, 0.7, 0.12, 2, 0.06)), toon(0x6f6789), 0, 0, -0.7));
  const stick = new THREE.Group();
  stick.position.set(0, -0.1, -0.6);
  stick.add(mesh(sharedGeo('kcLevStick', () => new THREE.CylinderGeometry(0.06, 0.06, 0.65, 6)), toon(COLORS.trunk), 0, 0.32, 0));
  stick.add(mesh(sharedGeo('kcLevKnob', () => new THREE.SphereGeometry(0.15, 10, 8)), toon(0xff5d73), 0, 0.66, 0));
  stick.rotation.z = 0.7;
  g.add(stick);
  // A pulsing ring so players spot it.
  const ring = mesh(sharedGeo('kcLevRing', () => new THREE.TorusGeometry(0.55, 0.04, 6, 24)), toon(GOLD), 0, 0.05, -0.5);
  g.add(ring);
  g.userData.stick = stick;
  g.userData.ring = ring;
  return shadows(g);
}

/** Portcullis for a gate `h` tiles tall. Origin at the bottom center of the gate cell. */
export function makePortcullis(h) {
  const g = new THREE.Group();
  const mat = toon(0x7a5a3a);
  for (let i = 0; i < 4; i++) g.add(mesh(new THREE.BoxGeometry(0.1, h, 0.14), mat, -0.36 + i * 0.24, h / 2, 0));
  for (let j = 0; j < h * 2; j++) g.add(mesh(sharedGeo('kcPortH', () => new THREE.BoxGeometry(0.95, 0.09, 0.16)), mat, 0, 0.3 + j * 0.5, 0));
  for (let i = 0; i < 4; i++) {
    const spike = mesh(sharedGeo('kcPortS', () => new THREE.ConeGeometry(0.07, 0.2, 6)), toon(0xb8b4cc), -0.36 + i * 0.24, -0.08, 0);
    spike.rotation.z = Math.PI;
    g.add(spike);
  }
  return shadows(g);
}

/** Pillow catapult, facing left. userData.arm swings up when it throws. */
export function makeCatapult() {
  const g = new THREE.Group();
  const wood = toon(0xb07a4a);
  g.add(mesh(sharedGeo('kcCatBase', () => new RoundedBoxGeometry(1.5, 0.3, 0.9, 2, 0.08)), wood, 0, 0.35, 0));
  for (const x of [-0.5, 0.5]) {
    const wheel = mesh(sharedGeo('kcCatWheel', () => new THREE.CylinderGeometry(0.26, 0.26, 0.12, 14)), toon(0x7a5a3a), x, 0.26, 0.48);
    wheel.rotation.x = Math.PI / 2;
    g.add(wheel);
  }
  g.add(mesh(sharedGeo('kcCatPost', () => new THREE.BoxGeometry(0.14, 0.7, 0.6)), wood, 0.2, 0.8, 0));
  const arm = new THREE.Group();
  arm.position.set(0.2, 1.05, 0);
  arm.add(mesh(sharedGeo('kcCatArm', () => new THREE.BoxGeometry(1.3, 0.1, 0.12)), wood, -0.55, 0, 0));
  const cup = mesh(sharedGeo('kcCatCup', () => new THREE.SphereGeometry(0.24, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2)), wood, -1.15, 0.05, 0);
  arm.add(cup);
  const pillow = makePillow();
  pillow.position.set(-1.15, 0.22, 0);
  pillow.scale.setScalar(0.8);
  arm.add(pillow);
  arm.rotation.z = -0.35;
  g.add(arm);
  g.userData.arm = arm;
  g.userData.loaded = pillow;
  return shadows(g);
}

export function makePillow() {
  const g = new THREE.Group();
  const p = mesh(sharedGeo('kcPillow', () => new RoundedBoxGeometry(0.6, 0.32, 0.45, 3, 0.14)), toon(0xfff0f6));
  const band = mesh(sharedGeo('kcPillowB', () => new THREE.BoxGeometry(0.12, 0.34, 0.47)), toon(0xff9fd0));
  g.add(p, band);
  return g;
}

/** Pulsing ring on the ground where a pillow will land. */
export function makeTargetRing() {
  const m = mesh(sharedGeo('kcTarget', () => new THREE.TorusGeometry(0.9, 0.08, 6, 28)), toon(0xff5d73));
  m.rotation.x = Math.PI / 2;
  return m;
}

/** Translucent hint ghost: "build a block / ladder here". */
export function makeHintGhost(ladder, mat) {
  const g = new THREE.Group();
  if (ladder) {
    g.add(mesh(sharedGeo('kcHL1', () => new THREE.BoxGeometry(0.08, 0.9, 0.1)), mat, -0.28, 0, 0.85));
    g.add(mesh(sharedGeo('kcHL1', () => new THREE.BoxGeometry(0.08, 0.9, 0.1)), mat, 0.28, 0, 0.85));
    g.add(mesh(sharedGeo('kcHL2', () => new THREE.BoxGeometry(0.6, 0.08, 0.1)), mat, 0, 0.2, 0.85));
    g.add(mesh(sharedGeo('kcHL2', () => new THREE.BoxGeometry(0.6, 0.08, 0.1)), mat, 0, -0.2, 0.85));
  } else {
    g.add(mesh(sharedGeo('kcHB', () => new THREE.BoxGeometry(0.86, 0.86, 1.2)), mat));
  }
  return g;
}

/** A bean trooper: cream bean with a silver helmet and a golden plume. */
export function makeTrooper(i = 0) {
  const ch = new Character(TROOPER_COLOR, { hat: 0 });
  const helmet = new THREE.Group();
  helmet.add(mesh(sharedGeo('kcHelm', () => new THREE.SphereGeometry(0.36, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2)), toon(0xb8c2e0), 0, -0.1, 0));
  helmet.add(mesh(sharedGeo('kcHelmRim', () => new THREE.TorusGeometry(0.36, 0.04, 6, 18)), toon(0x9aa6c8), 0, -0.1, 0));
  helmet.children[1].rotation.x = Math.PI / 2;
  const plume = mesh(sharedGeo('kcPlume', () => new THREE.SphereGeometry(0.1, 8, 6)), toon([GOLD, 0xff5d73, 0x4cc9f0][i % 3]), 0, 0.3, -0.05);
  plume.scale.set(0.8, 1.6, 1.3);
  helmet.add(plume);
  ch.hatSlot.add(helmet);
  // A tiny parachute leaf, shown on long falls.
  const leaf = new THREE.Group();
  const canopy = mesh(sharedGeo('kcLeaf', () => new THREE.SphereGeometry(0.75, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2.6)), toon(0x7ad65a));
  canopy.position.y = 2.1;
  canopy.scale.set(1, 0.5, 0.8);
  leaf.add(canopy);
  for (const x of [-0.5, 0.5]) {
    const str = mesh(sharedGeo('kcLeafS', () => new THREE.CylinderGeometry(0.015, 0.015, 1.1, 4)), toon(COLORS.icing), x * 0.8, 1.55, 0);
    str.rotation.z = x * 0.6;
    leaf.add(str);
  }
  leaf.visible = false;
  ch.group.add(leaf);
  ch.leaf = leaf;
  ch.group.scale.setScalar(0.88);
  shadows(ch.group);
  return ch;
}

/** The Golden Bean Princess: a shiny golden bean with a crown. */
export function makePrincess() {
  const ch = new Character(GOLD, { hat: 6 });
  ch.body.material = toon(GOLD, { emissive: 0x4a3a00 });
  // A little cape.
  const cape = mesh(sharedGeo('kcCape', () => new THREE.ConeGeometry(0.5, 0.9, 12, 1, true, Math.PI * 0.6, Math.PI * 0.8)), toon(0xff7eb6), 0, 0.5, -0.05);
  ch.pivot.add(cape);
  const glow = makeStar(COLORS.white);
  glow.scale.setScalar(0.28);
  glow.position.set(0.35, 1.45, 0.2);
  ch.pivot.add(glow);
  ch.group.scale.setScalar(1.15);
  shadows(ch.group);
  return ch;
}

/** The Grumble Duke: a big grumble with a crown and a cape. */
export function makeDuke(size = 2.2) {
  const group = new THREE.Group();
  const pivot = new THREE.Group();
  group.add(pivot);
  const g = makeGrumble(0x6a4fd0);
  pivot.add(g);
  const crown = makeHat(6);
  crown.position.set(0, 0.86, 0);
  crown.scale.setScalar(1.2);
  pivot.add(crown);
  const cape = mesh(sharedGeo('kcDukeCape', () => new THREE.ConeGeometry(0.55, 0.8, 12, 1, true, Math.PI * 0.6, Math.PI * 0.8)), toon(0xe63950), 0, 0.42, -0.05);
  pivot.add(cape);
  group.scale.setScalar(size);
  shadows(group);
  const brows = g.children.filter((o) => o.geometry === sharedGeo('gBrow', () => new THREE.BoxGeometry(0.16, 0.04, 0.04)));
  return {
    group, pivot, body: g.userData.body,
    /** happy: brows relax and the body turns pink. */
    setHappy(on) {
      brows.forEach((b, i) => { b.rotation.z = (i ? 1 : -1) * (on ? -0.35 : 0.35) * (b.position.x < 0 ? -1 : 1); });
      g.userData.body.material = toon(on ? 0xb48cff : 0x6a4fd0, { flat: true });
    },
  };
}

/** Grumble gear: foam sword (knights), bow (archers) or hammer + hard hat (builders). */
export function makeGrumbleGear(type) {
  const g = new THREE.Group();
  if (type === 'knight') {
    const sword = new THREE.Group();
    sword.position.set(0.4, 0.45, 0.2);
    sword.add(mesh(sharedGeo('kcGBlade', () => new RoundedBoxGeometry(0.15, 0.8, 0.09, 2, 0.06)), toon(0xff9fd0), 0, 0.55, 0));
    sword.add(mesh(sharedGeo('kcGGuard', () => new RoundedBoxGeometry(0.36, 0.08, 0.12, 2, 0.03)), toon(0x6a4fd0), 0, 0.14, 0));
    g.add(sword);
    g.userData.sword = sword;
  } else if (type === 'archer') {
    const bow = mesh(sharedGeo('kcGBow', () => new THREE.TorusGeometry(0.34, 0.04, 6, 14, Math.PI)), toon(0xc98b5a), 0.42, 0.55, 0.2);
    bow.rotation.z = -Math.PI / 2;
    g.add(bow);
    g.userData.bow = bow;
  } else {
    const hammer = new THREE.Group();
    hammer.position.set(0.4, 0.4, 0.2);
    hammer.add(mesh(sharedGeo('kcGHandle', () => new THREE.CylinderGeometry(0.04, 0.04, 0.5, 6)), toon(COLORS.trunk), 0, 0.25, 0));
    hammer.add(mesh(sharedGeo('kcGHead', () => new RoundedBoxGeometry(0.3, 0.16, 0.16, 2, 0.04)), toon(0xb8b4cc), 0, 0.52, 0));
    g.add(hammer);
    const hat = mesh(sharedGeo('kcHardHat', () => new THREE.SphereGeometry(0.3, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2)), toon(GOLD), 0, 0.82, 0);
    g.add(hat);
    g.userData.hammer = hammer;
  }
  return shadows(g);
}
