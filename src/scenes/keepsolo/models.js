import * as THREE from 'three';
import { COLORS, toon, sharedGeo } from '../../core/palette.js';
import { makeStar } from '../../core/world.js';
import { darken } from '../../core/character.js';
import { mesh, sph, rbox, bx, cyl, cone } from '../keep/common.js';
import { buildWeapon, buildHat, buildCape } from '../keep/loot.js';
import { RARITY_HEX } from './items.js';

// Looks of Pillow Keep Solo gear: what the hero wears (pillow, bow or wand in the hand, a shield,
// quiver or bubble orb, hat, cape-armor and slippers) and the little models of drops on the floor.
// The co-op Pillow Keep's pillow, wand, hat and cape models (keep/loot.js) are reused.

const look = (item) => ({ ...item, rarity: Math.min(2, item.rarity), cls: item.cls });
const main = (item) => toon(item.rarity === 0 ? 0xfff3e6 : RARITY_HEX[item.rarity], { emissive: item.rarity >= 2 ? 0x3a2600 : 0 });
const acc = (item) => toon([0xff9fd0, 0xbfe0ff, 0xff8c42, 0xffe27a][item.rarity]);

/** The Feather Archer's bow. */
export function buildBow(item) {
  const g = new THREE.Group();
  const s = 1 + item.tier * 0.12;
  const arc = mesh(sharedGeo('ksBowArc', () => new THREE.TorusGeometry(0.42, 0.045, 6, 18, Math.PI)), main(item), 0, 0, 0);
  arc.rotation.set(0, Math.PI / 2, Math.PI / 2);
  const string = mesh(cyl('ksBowString', 0.012, 0.012, 0.84, 4), toon(0xffffff), 0, 0, 0, false);
  string.rotation.x = Math.PI / 2;
  const grip = mesh(cyl('ksBowGrip', 0.06, 0.06, 0.16, 8), toon(0x8a5a3a), 0, 0.42, 0, false);
  grip.position.set(0, 0, 0.42);
  const bow = new THREE.Group();
  bow.add(arc, string);
  bow.position.set(0.45, 0.05, 0.05);
  bow.rotation.y = Math.PI / 2;
  g.add(bow);
  // feathers on the tips (more and fancier with better bows)
  for (const sz of [-1, 1]) {
    const f = mesh(cone('ksBowFeather', 0.07, 0.3, 6), acc(item), 0.45 + 0.05, 0.05, 0.05 + sz * 0.42, false);
    f.rotation.x = sz * Math.PI / 2;
    f.scale.z = 0.4;
    g.add(f);
  }
  if (item.tier >= 2) g.add(mesh(sph(0.07), toon(COLORS.gold, { emissive: 0x4a3000 }), 0.38, 0.05, 0.05, false));
  g.scale.setScalar(s);
  return g;
}

export function buildMainHand(item) {
  if (item.cls === 'archer') return buildBow(item);
  return buildWeapon(look(item));
}

/** Off-hand: a cushion shield (knight), a quiver (archer) or a floating bubble orb (wizard). */
export function buildOffhand(item) {
  const g = new THREE.Group();
  if (item.cls === 'knight') {
    const pad = mesh(sharedGeo('ksShield', () => new THREE.CylinderGeometry(0.42, 0.42, 0.14, 20)), main(item), 0, 0, 0);
    pad.rotation.z = Math.PI / 2;
    const rim = mesh(sharedGeo('ksShieldRim', () => new THREE.TorusGeometry(0.42, 0.05, 6, 20)), acc(item), 0, 0, 0, false);
    rim.rotation.y = Math.PI / 2;
    const btn = mesh(sph(0.08), toon(COLORS.cream), -0.09, 0, 0, false);
    g.add(pad, rim, btn);
    if (item.tier >= 1) for (const a of [0, 1, 2, 3]) g.add(mesh(sph(0.045, 6, 4), acc(item), -0.08, Math.cos(a * 1.57) * 0.26, Math.sin(a * 1.57) * 0.26, false));
    if (item.rarity >= 2) { const st = makeStar(COLORS.gold); st.scale.setScalar(0.16); st.position.set(-0.1, 0, 0); st.rotation.y = -Math.PI / 2; g.add(st); }
    g.userData.kind = 'shield';
  } else if (item.cls === 'archer') {
    const tube = mesh(cyl('ksQuiver', 0.13, 0.11, 0.6, 12), main(item), 0, 0, 0);
    tube.rotation.x = 0.35;
    g.add(tube);
    for (let i = 0; i < 3; i++) {
      const f = mesh(cone('ksQuivF', 0.06, 0.24, 5), acc(item), (i - 1) * 0.06, 0.38, -0.1 + i * 0.02, false);
      f.rotation.x = 0.35;
      g.add(f);
    }
    g.userData.kind = 'quiver';
  } else {
    const orb = mesh(sph(0.2, 16, 12), toon(item.rarity ? RARITY_HEX[item.rarity] : 0xbfe9ff, { transparent: true, opacity: 0.7 }), 0, 0, 0, false);
    orb.add(mesh(sph(0.05), toon(0xffffff), -0.07, 0.07, 0.12, false));
    if (item.tier >= 1) { const ring = mesh(sharedGeo('ksOrbRing', () => new THREE.TorusGeometry(0.28, 0.025, 6, 20)), acc(item), 0, 0, 0, false); ring.rotation.x = 1.2; orb.add(ring); }
    g.add(orb);
    g.userData.kind = 'orb';
    g.userData.orb = orb;
  }
  return g;
}

function mitten(item) {
  const g = new THREE.Group();
  for (const s of [-1, 1]) {
    const m = mesh(sph(0.17, 12, 10), main(item), s * 0.22, 0, 0);
    m.scale.set(0.9, 1.15, 0.6);
    const thumb = mesh(sph(0.07, 8, 6), main(item), s * 0.22 + s * 0.13, -0.04, 0.02, false);
    const cuff = mesh(cyl('ksCuff', 0.13, 0.13, 0.08, 10), acc(item), s * 0.22, -0.18, 0, false);
    g.add(m, thumb, cuff);
  }
  return g;
}

function slippers(item) {
  const g = new THREE.Group();
  for (const s of [-1, 1]) {
    const f = mesh(sph(0.16), main(item), s * 0.2, 0, 0);
    f.scale.set(1, 0.6, 1.4);
    g.add(f);
    if (item.tier === 1) { const ear = mesh(sph(0.05, 8, 6), acc(item), s * 0.2, 0.15, 0.1, false); ear.scale.set(0.8, 3, 0.6); g.add(ear); }
    if (item.tier === 2) g.add(mesh(sph(0.09, 8, 6), toon(COLORS.white), s * 0.2, 0.08, -0.16, false));
  }
  return g;
}

function charm(item) {
  const g = new THREE.Group();
  if (item.tier === 0) {
    const b = mesh(cyl('ksButton', 0.2, 0.2, 0.06, 18), main(item), 0, 0, 0);
    b.rotation.x = Math.PI / 2;
    g.add(b);
    for (const [x, y] of [[-0.05, 0.05], [0.05, 0.05], [-0.05, -0.05], [0.05, -0.05]]) g.add(mesh(sph(0.025, 6, 4), toon(COLORS.ink), x, y, 0.04, false));
  } else if (item.tier === 1) {
    const f = mesh(cone('ksCharmFeather', 0.12, 0.6, 8), main(item), 0, 0, 0);
    f.scale.z = 0.3;
    g.add(f, mesh(cyl('ksCharmQuill', 0.015, 0.015, 0.3, 4), toon(0xd8c4a8), 0, -0.4, 0, false));
  } else {
    const st = makeStar(item.rarity ? RARITY_HEX[item.rarity] : COLORS.gold);
    st.scale.setScalar(0.4);
    g.add(st);
  }
  return g;
}

/** The little model of a drop lying on the floor. */
export function itemModel(item) {
  const w = new THREE.Group();
  let g;
  switch (item.slot) {
    case 'weapon': g = buildMainHand(item); g.position.set(-0.3, -0.1, -0.35); w.scale.setScalar(1.3); break;
    case 'offhand': g = buildOffhand(item); g.scale.setScalar(1.2); break;
    case 'helmet': g = buildHat(look(item)); break;
    case 'armor': g = buildCape(look(item)); g.position.set(0, -0.2, 0.42); break;
    case 'gloves': g = mitten(item); break;
    case 'boots': g = slippers(item); break;
    default: g = charm(item);
  }
  w.add(g);
  return w;
}

/**
 * Dress the hero (e = the hero record from keepsolo.js) in its worn gear.
 * e.hand: the right hand, e.off: the left side, e.capeSlot: the back.
 */
export function dressHero(e, gear, baseHat) {
  e.hand.clear();
  e.hand.add(buildMainHand(gear.weapon));
  e.off.clear();
  e.offKind = null;
  if (gear.offhand) {
    const o = buildOffhand(gear.offhand);
    e.offKind = o.userData.kind;
    if (e.offKind === 'shield') o.position.set(-0.5, 0.15, 0.15);
    else if (e.offKind === 'quiver') { o.position.set(0.15, 0.35, -0.42); o.rotation.z = -0.4; }
    else o.position.set(-0.6, 0.75, 0);
    e.off.add(o);
    e.offMesh = o;
  }
  e.capeSlot.clear();
  if (gear.armor) e.capeSlot.add(buildCape(look(gear.armor)));
  const ch = e.ch;
  ch.hatSlot.clear();
  if (gear.helmet) {
    ch.hat = buildHat(look(gear.helmet));
    ch.hatSlot.add(ch.hat);
  } else ch.setHat(baseHat);
  for (const f of ch.feet) f.material = gear.boots ? main(gear.boots) : toon(darken(e.color, 0.65));
}

/** A pillow-shaped bonk wave for skills (shared ring geometry). */
export function featherRing() {
  return sharedGeo('ksFeatherRing', () => new THREE.RingGeometry(0.85, 1, 40));
}

export { rbox, bx };
