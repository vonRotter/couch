import * as THREE from 'three';
import { t } from '../../core/i18n.js';
import { toon, basic, sharedGeo } from '../../core/palette.js';
import { seeded, makeCloud } from '../../core/world.js';
import {
  mesh, boxG, cylG, coneG, sph, makeGrumbleton, makeIsland, makePalm, decalMaterial, drawCanvas, redrawDecal, fitText, WOOD, WOOD_DARK,
} from './props.js';
import {
  makeGranny, makeWobbles, makeClawdia, makePuddingHouse, makeFountain, makeStatue, makeUnderpants, makeFish, makeWheel,
  makeSock, makePeg, makeTrophy, makeMiniPudding, makePuddingBowl, HOUSE_COLORS,
} from './props2.js';
import { addMine, mineActor, animateGull, putGullOnHead, GRUM_CSS } from './shared.js';
import { runDialog, pick } from './dialog.js';
import { tickleDuel } from './duel.js';

// Scene 2 of The Secret of Pudding Island: "All Hands on Deck".
//
// Pip has a ship (mostly underwater). Grumbleton, still giggling in the harbor, says a captain needs
// three things, and they can be done in any order:
//   1. No holes: beat Granny Grumbleton (Tickle Fencing champion, fifty years) to win a bowl of
//      Never-Wobble Pudding, which sets solid in cold water, and pour it into the leak on deck.
//      Her new boasts are only learned by practising (and losing) against her pupil Clawdia.
//   2. A sail: the giant duck underpants on the town's washing line. Too high for a bean, but Mine
//      the seagull loves ducks. Hoist them up the mast.
//   3. A crew: Wobbles the pudding (order him "to go" with a coin fished out of the custard fountain
//      with the spoon) and Clawdia the crab (she wants a hat: fold the barrel's note into one).
// With all three done the ship sails away. Sideways.
//
// Rooms: deck (the ship), square (the town), parlor (Granny's Pudding Parlor). The dock from
// scene 1 is reused (rooms.js asks DOCK2 below for its scene 2 behaviour).
// Flags: s2.hole, s2.sail, s2.wob, s2.claw (the three things), plus small story flags.

const SEA = -0.14; // sea level next to the sunken deck (just below the planks)
const RISE = 1.0; // how far the ship rises when the hole is plugged (the world moves down instead)
const GRAN_CSS = '#9b7fe0';
const WOB_CSS = '#ff5d84';
const CLAW_CSS = '#f0563a';

export const isS2 = (s) => (s.save.scene || 1) >= 2;
const crewCount = (s) => (s.flag('s2.wob') ? 1 : 0) + (s.flag('s2.claw') ? 1 : 0);
export const allDone = (s) => !!(s.flag('s2.hole') && s.flag('s2.sail') && crewCount(s) === 2);

/** "plug the hole, find a sail and find one more sailor" in the current language. */
function todoList(s) {
  const parts = [];
  if (!s.flag('s2.hole')) parts.push(t('adv.s2.need.hole'));
  if (!s.flag('s2.sail')) parts.push(t('adv.s2.need.sail'));
  const n = crewCount(s);
  if (n < 2) parts.push(t(n === 1 ? 'adv.s2.need.crew1' : 'adv.s2.need.crew2'));
  if (parts.length < 2) return parts.join('');
  return `${parts.slice(0, -1).join(', ')} ${t('adv.s2.and')} ${parts[parts.length - 1]}`;
}

function* todo(s) {
  if (allDone(s)) yield s.say('pip', 'adv.s2.ready');
  else yield s.say('pip', 'adv.s2.todo', { list: () => todoList(s) });
}

/** After one of the three things: sail away if it was the last one. */
function* checkDone(s) {
  if (!allDone(s) || s.save.done2) return;
  if (s.room.id === 'deck') {
    yield* ending(s, false);
  } else {
    yield s.say('pip', 'adv.s2.allDone');
    s.hint('adv.s2.allDoneHint', 6);
  }
}

// ---------- shared bits for every scene 2 room ----------

const MINE_HS = {
  id: 'mine', name: 'adv.dock.mine', kind: 'person', when: (s) => s.flag('gullOnHead') && !s.room.props.gullAway, priority: 1, walk: null,
  anchor: (s) => s.room.props.gull, box: [0, 0.3, 0, 0.7, 0.6, 0.7],
  look: 'adv.dock.mine.look',
  talk: (s) => (s.room.id === 'square' && !s.flag('s2.pants') ? mineFetchPants(s) : [['gull', 'adv.dock.gull.mine'], ['pip', 'adv.dock.mine.talk']]),
  useItem: {
    spoon: [['gull', 'adv.dock.gull.mine'], ['pip', 'adv.dock.gull.spoon1'], ['gull', 'adv.dock.gull.mine'], ['pip', 'adv.dock.gull.spoon2']],
    note: [['gull', 'adv.dock.gull.mine'], ['pip', 'adv.dock.gull.note'], ['gull', 'adv.dock.gull.mine']],
  },
};

/** What Pip says about using things on himself (also used on the dock in scene 2). */
export const SELF_ITEMS = {
  coin: 'adv.s2.self.coin',
  pudding: 'adv.s2.self.pudding',
  pants: 'adv.s2.self.pants',
  gull: [['gull', 'adv.dock.gull.mine'], ['pip', 'adv.s2.self.gull']],
};

const SELF2 = {
  name: 'adv.dock.pip',
  look: todo,
  useItem: {
    spoon: 'adv.dock.pip.spoon',
    note: 'adv.dock.pip.note',
    ...SELF_ITEMS,
  },
};

/** Grumbleton reacts to things in both rooms where he floats (dock and deck). */
export const GRUM2_ITEMS = {
  pants: [['grum', 'adv.g2.pants']],
  pudding: [['grum', 'adv.g2.pudding']],
  coin: [['grum', 'adv.g2.coin']],
  note: [['grum', 'adv.dock.g.note1'], ['grum', 'adv.g2.note']],
  spoon: [['grum', 'adv.g2.spoon']],
  gull: [['gull', 'adv.dock.gull.mine'], ['grum', 'adv.g2.gull']],
};

const GRUM2_TREE = {
  id: 'grum2',
  start: 'main',
  nodes: {
    main: {
      intro: [['grum', 'adv.g2.again']],
      options: [
        { id: 'three', text: 'adv.g2.o.three', lines: [['grum', 'adv.g2.three'], (s) => todo(s)] },
        {
          id: 'hole', text: 'adv.g2.o.hole', when: (s) => !s.flag('s2.hole'),
          lines: [['grum', 'adv.g2.hole1'], ['grum', 'adv.g2.hole2']],
        },
        {
          id: 'sail', text: 'adv.g2.o.sail', when: (s) => !s.flag('s2.sail'),
          lines: [['grum', 'adv.g2.sail1'], ['grum', 'adv.g2.sail2']],
        },
        {
          id: 'crew', text: 'adv.g2.o.crew', when: (s) => crewCount(s) < 2,
          lines: [['grum', 'adv.g2.crew1'], ['pip', 'adv.g2.p.crew2'], ['grum', 'adv.g2.crew3']],
        },
        { id: 'granny', text: 'adv.g2.o.granny', lines: [['grum', 'adv.g2.granny1'], ['grum', 'adv.g2.granny2']] },
        { id: 'join', text: 'adv.g2.o.join', lines: [['grum', 'adv.g2.join1'], ['pip', 'adv.g2.p.join2'], ['grum', 'adv.g2.join3']] },
        { id: 'bye', text: 'adv.dock.o.bye', end: true, lines: (s) => [['grum', s.flag('s2.hole') ? 'adv.g2.byeFixed' : 'adv.g2.bye']] },
      ],
    },
  },
};

export function talkGrum2(s) {
  return runDialog(s, GRUM2_TREE);
}

/** A little giggle wobble for whoever just got a good comeback. */
function giggleShake(s, obj, big) {
  s.sfx(big ? 'bigGiggle' : 'giggle');
  s.float(t(big ? 'adv.fx.haha' : 'adv.fx.hee'), obj.position.clone().add(new THREE.Vector3(0.3, 1.6, 0)));
  s.tween(obj, { rz: 0.22 }, 0.12);
  s.tween(obj, { rz: -0.18 }, 0.15, { delay: 0.12 });
  s.tween(obj, { rz: 0 }, 0.15, { delay: 0.27 });
}

/** Pip gets tickled (wrong comeback): a giggle and a wiggle, nothing else. */
function* pipTickled(s, by, n, dir) {
  const bx = by.position.x;
  s.tween(by, { x: bx - 0.35 * dir }, 0.15, { ease: 'out' });
  s.tween(by, { x: bx }, 0.3, { delay: 0.3 });
  s.sfx('tickle');
  s.pipChar.squash(0.7);
  s.tween(s.pip, { rz: 0.25 }, 0.1, { delay: 0.1 });
  s.tween(s.pip, { rz: -0.2 }, 0.12, { delay: 0.2 });
  s.tween(s.pip, { rz: 0 }, 0.15, { delay: 0.32 });
  s.float(t('adv.fx.heehee'), s.pipHead());
  s.sfx('giggle');
  yield s.say('pip', `adv.duel.pipGiggle.${Math.min(3, n)}`);
}

// ---------- the deck of The Soggy Biscuit ----------

function drawCabinSign(g, w, h) {
  g.fillStyle = '#f6e2b8';
  g.fillRect(0, 0, w, h);
  g.strokeStyle = '#8f5f3a';
  g.lineWidth = 10;
  g.strokeRect(5, 5, w - 10, h - 10);
  g.fillStyle = '#5a3f8a';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  fitText(g, t('adv.deck.cabinSign'), w / 2, h / 2 + 3, w - 40, 64);
}

/** The droopy old sail, used both hanging on the mast (intro) and floating in the sea. */
function makeOldSail() {
  const g = new THREE.Group();
  const cloth = mesh(sharedGeo('adv-oldsail', () => {
    const geo = new THREE.PlaneGeometry(2.2, 1.7, 6, 4);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 2.2) * 0.08 + Math.sin(p.getY(i) * 3) * 0.05);
    geo.computeVertexNormals();
    return geo;
  }), toon(0xe9dcc0), 0, 0, 0, false);
  g.add(cloth);
  const bis = mesh(cylG(0.35, 0.35, 0.03, 18), toon(0xd6a868), 0, 0, 0.06, false);
  bis.rotation.x = Math.PI / 2;
  g.add(bis, mesh(boxG(0.35, 0.3, 0.02), toon(0xff9fd0), -0.6, -0.4, 0.07, false));
  return g;
}

/** Pour the Never-Wobble Pudding into the leak: it sets, the ship rises. */
function* plugHole(s) {
  const P = s.room.props;
  s.face('pip', 1);
  s.drop('pudding');
  // Pip tips the bowl over the leak
  const bowl = makePuddingBowl();
  bowl.scale.setScalar(0.55);
  const p = s.pip.position;
  bowl.position.set(p.x + 0.45, 0.85, p.z + 0.1);
  s.room.group.add(bowl);
  yield s.say('pip', 'adv.deck.pour1');
  s.tween(bowl, { x: 3.0, y: 1.3, rz: -2.3 }, 0.5, { ease: 'out' });
  yield s.wait(0.5);
  const blob = mesh(sph(0.22, 12, 8), toon(0xbfae98), 3.1, 1.2, 0.3);
  s.room.group.add(blob);
  s.tween(blob, { y: 0.12, sy: 0.4 }, 0.35, { ease: 'in' });
  yield s.wait(0.35);
  s.room.group.remove(blob);
  s.sfx('bloop');
  P.jet.visible = false;
  P.plug.visible = true;
  P.plug.scale.setScalar(0.2);
  s.tween(P.plug, { s: 1 }, 0.3, { ease: 'back' });
  s.host.puffs.burst(new THREE.Vector3(3.1, 0.2, 0.3), 0xd8ccb8, { count: 14, size: 0.25, life: 0.6, speed: 2 });
  s.tween(bowl, { y: 0.8, x: p.x + 0.45, rz: 0, s: 0.2 }, 0.4, { delay: 0.2 });
  s.host.later(0.6, () => s.room?.group.remove(bowl));
  yield s.say('narr', 'adv.deck.pour2');
  // The Soggy Biscuit rises (we move the whole world down instead)
  s.sfx('gurgle');
  s.tween(P.world, { y: -RISE }, 2.2, { ease: 'inOut' });
  for (const pd of P.puddles) s.tween(pd, { sx: 0.01, sz: 0.01 }, 1.6, { delay: 0.3 });
  // The fish leave the cabin through the porthole, in a huff
  P.fish.forEach((f, i) => {
    const w = f.getWorldPosition(new THREE.Vector3());
    f.parent.remove(f);
    s.room.group.add(f);
    f.position.copy(w);
    s.tween(f, { x: w.x + 0.8 + i * 0.5, y: w.y + 0.9 }, 0.45, { delay: 0.5 + i * 0.35, ease: 'out' });
    s.tween(f, { x: w.x + 1.6 + i * 0.8, y: SEA - RISE, z: 2.8 }, 0.55, { delay: 0.95 + i * 0.35, ease: 'in' });
    s.host.later(1.5 + i * 0.35, () => { f.visible = false; s.sfx('splash'); });
  });
  P.portholeGlass.material = toon(0x8aa6cf);
  s.pipChar.squash(1.3);
  yield s.wait(2.3);
  s.setFlag('s2.hole');
  yield s.say('pip', 'adv.deck.pour3');
  if (!allDone(s)) yield s.say('grum', 'adv.deck.grumCount', { n: () => countWord(s) });
  yield* checkDone(s);
}

/** Grumbleton counts the things done so far: "That's one!" */
function countWord(s) {
  const n = (s.flag('s2.hole') ? 1 : 0) + (s.flag('s2.sail') ? 1 : 0) + (crewCount(s) === 2 ? 1 : 0);
  return t(`adv.num.${Math.max(1, n)}`);
}

/** Hoist the underpants up the mast. */
function* hoistSail(s) {
  const P = s.room.props;
  s.face('pip', 1);
  s.drop('pants');
  P.sail.visible = true;
  P.sail.position.set(1.0, 1.0, -0.6);
  P.sail.scale.setScalar(0.45);
  s.sfx('creak');
  s.tween(P.sail, { y: 4.25, s: 1.7 }, 2.0, { ease: 'inOut' });
  s.host.later(0.4, () => s.sfx('creak'));
  yield s.say('narr', 'adv.deck.hoist1');
  yield s.wait(0.6);
  s.sfx('whoosh');
  s.tween(P.sail.userData.body, { sz: 2.2 }, 0.3, { ease: 'out' });
  s.tween(P.sail.userData.body, { sz: 1 }, 0.5, { delay: 0.3, ease: 'back' });
  s.setFlag('s2.sail');
  yield s.say('pip', 'adv.deck.hoist2');
  s.sfx('bigGiggle');
  yield s.say('grum', 'adv.deck.hoistGrum');
  yield s.say('gull', 'adv.dock.gull.mine');
  yield s.say('pip', 'adv.deck.hoist3');
  if (!allDone(s)) yield s.say('grum', 'adv.deck.grumCount', { n: () => countWord(s) });
  yield* checkDone(s);
}

function* toDock(s) {
  yield s.goRoom('dock', 'ship');
}

const deck = {
  name: 'adv.room.deck',
  sky: ['#7cc6f2', '#fff0d0'],
  camera: { viewW: 14.6, viewH: 7.8, lookY: 1.65, pitch: 0.2, fov: 30 },
  entries: {
    start: { x: -1.0, z: 0.6, face: 1 },
    intro: { x: -1.0, z: 0.6, face: 1 },
    gang: { x: -4.2, z: 0.75, face: 1 },
  },
  walk: [[-4.9, -0.15, -2.25, 1.45], [-2.25, -0.85, 5.8, 1.45]],

  lights(s, L) {
    if (!L) return;
    L.hemi.color.set(0xfff6e8);
    L.hemi.groundColor.set(0x8a90b8);
    L.hemi.intensity = 1.5;
    L.sun.color.set(0xfff1d6);
    L.sun.intensity = 1.9;
  },

  build(s, g) {
    const P = {};
    const rand = seeded(21);
    const fixed = s.flag('s2.hole');

    // Sun and clouds (far away: they don't move when the ship rises)
    const sun = new THREE.Mesh(sharedGeo('adv-sun2', () => new THREE.CircleGeometry(4, 40)), basic(0xfff3b0));
    sun.position.set(16, 22, -95);
    const halo = new THREE.Mesh(sharedGeo('adv-halo2', () => new THREE.CircleGeometry(6.5, 40)), basic(0xffffff, { transparent: true, opacity: 0.35 }));
    halo.position.set(16, 22, -96);
    g.add(sun, halo);
    P.clouds = [];
    for (const [x, y, z, sc] of [[-16, 11, -50, 2.2], [4, 13, -60, 2.8], [20, 9, -42, 1.8], [-4, 8.5, -38, 1.3]]) {
      const c = makeCloud(rand, sc);
      c.position.set(x, y, z);
      g.add(c);
      P.clouds.push(c);
    }

    // The world around the ship: sea, dock, islands, Grumbleton. Moves down when the ship rises.
    const W = new THREE.Group();
    W.position.y = fixed ? -RISE : 0;
    g.add(W);
    P.world = W;
    const sea = mesh(sharedGeo('adv-sea', () => new THREE.PlaneGeometry(240, 140)), toon(0x4f9be0), 0, SEA, -50, false);
    sea.rotation.x = -Math.PI / 2;
    sea.receiveShadow = true;
    W.add(sea);
    P.glints = [];
    for (let i = 0; i < 26; i++) {
      const gl = mesh(boxG(1, 0.02, 0.12), basic(i % 3 ? 0xd8f1ff : 0xffffff), 0, SEA + 0.01, 0, false);
      gl.userData = { x: -12 + rand() * 30, z: -40 + rand() * 45, sp: 0.2 + rand() * 0.4, w: 0.5 + rand() * 1.4 };
      W.add(gl);
      P.glints.push(gl);
    }
    for (const [x, z, w, h, c] of [[22, -70, 10, 3.6, 0x7fae9a], [9, -58, 4, 1.6, 0x8fbfa8], [36, -80, 7, 2.6, 0x7fae9a]]) {
      const isl = makeIsland(c, w, h);
      isl.position.set(x, SEA, z);
      W.add(isl);
    }
    const palm = makePalm(0x5f8f7a);
    palm.position.set(22, SEA + 3.2, -69);
    palm.scale.setScalar(1.4);
    W.add(palm);
    // Pudding Island's hill with the town on top, behind the dock
    const hill = makeIsland(0x8fcf8a, 16, 5);
    hill.position.set(-22, SEA, -34);
    W.add(hill);
    HOUSE_COLORS.forEach((c, i) => {
      const hz = makePuddingHouse(c, { w: 1.6, h: 1.8 + (i % 2) * 0.6, door: false, windows: 1 });
      hz.position.set(-28 + i * 2.4, SEA + 3.3 + Math.sin(i * 1.3) * 0.5 - Math.abs(i - 2.5) * 0.35, -36);
      hz.scale.setScalar(1.2);
      W.add(hz);
    });

    // The dock on the left (higher than the sunken deck)
    const plankCols = [0xb07a4a, 0xa36f43, 0xbb8552, 0xa8764a];
    for (let x = -14, i = 0; x < -5.9; x += 0.56, i++) {
      const pl = mesh(boxG(0.52, 0.2, 3.6), toon(plankCols[i % 4]), x, 0.65, 0.1, false);
      pl.receiveShadow = true;
      W.add(pl);
    }
    for (let x = -13; x <= -6; x += 2) {
      W.add(mesh(cylG(0.17, 0.17, 2.6, 10), toon(WOOD_DARK), x, -0.6, 1.95, false));
      W.add(mesh(cylG(0.17, 0.17, 2.6, 10), toon(WOOD_DARK), x, -0.6, -1.7, false));
    }
    W.add(mesh(cylG(0.18, 0.2, 1.0, 12), toon(WOOD), -6.6, 1.25, -1.2));
    // Gangway from the dock edge to the deck (re-angled every frame as the ship rises)
    const gang = new THREE.Group();
    gang.add(mesh(boxG(1, 0.07, 0.85), toon(0xb98a5a), 0.5, 0, 0));
    for (let i = 0; i < 5; i++) gang.add(mesh(boxG(0.05, 0.04, 0.85), toon(WOOD_DARK), 0.1 + i * 0.2, 0.05, 0, false));
    for (const z of [-0.42, 0.42]) gang.add(mesh(boxG(1, 0.03, 0.03), toon(0xe8d5a8), 0.5, 0.5, z, false));
    g.add(gang);
    P.gang = gang;

    // Grumbleton, floating and giggling
    P.grum = makeGrumbleton();
    P.grum.position.set(-3.3, SEA - 0.5, 2.85);
    P.grum.rotation.set(0, 0.3, 0.6);
    P.grum.scale.setScalar(0.85);
    P.grum.userData.feather.visible = false;
    W.add(P.grum);

    // The old sail: drooping on the mast until the intro, then floating in the sea
    P.oldSail = makeOldSail();
    P.oldSail.position.set(4.6, SEA + 0.03, 2.95);
    P.oldSail.rotation.set(-Math.PI / 2, 0, 0.4);
    P.oldSail.scale.setScalar(0.8);
    P.oldSail.visible = !!s.flag('s2.sailGone');
    W.add(P.oldSail);
    P.droop = makeOldSail();
    P.droop.position.set(1.0, 3.4, -0.65);
    P.droop.scale.set(1.15, 1.3, 1);
    P.droop.visible = !s.flag('s2.sailGone');
    g.add(P.droop);

    // ----- the ship -----
    const HULL = 0x9a6440;
    g.add(mesh(boxG(11.2, 2.3, 0.3), toon(HULL), -0.2, -1.1, 1.95));
    g.add(mesh(boxG(11.2, 0.12, 0.34), toon(0xffd84a), -0.2, -0.3, 1.97, false));
    g.add(mesh(boxG(11.2, 2.6, 0.3), toon(HULL), -0.2, -0.95, -1.95));
    g.add(mesh(boxG(0.3, 2.3, 4.2), toon(HULL), -5.8, -1.1, 0));
    const bow = mesh(cylG(2.0, 2.0, 2.3, 24), toon(HULL), 5.4, -1.1, 0);
    bow.scale.x = 0.6;
    g.add(bow);
    const bowDeck = mesh(cylG(1.85, 1.85, 0.1, 24), toon(0xc9955f), 5.4, -0.05, 0, false);
    bowDeck.scale.x = 0.6;
    bowDeck.receiveShadow = true;
    g.add(bowDeck);
    // Bowsprit
    g.add(mesh(cylG(0.07, 0.1, 2.2, 8), toon(WOOD_DARK), 7.2, 0.6, 0, false).rotateZ(-1.1));
    // Portholes on the hull (under water until the ship rises)
    for (const x of [-3.6, -1.2, 1.2, 3.6]) {
      const ph = mesh(cylG(0.17, 0.17, 0.05, 14), toon(0x2e3b6b), x, -0.75, 2.11, false);
      ph.rotation.x = Math.PI / 2;
      const rim = mesh(sharedGeo('adv-rim', () => new THREE.TorusGeometry(0.14, 0.03, 6, 14)), toon(0xffd84a), x, -0.75, 2.13, false);
      rim.scale.setScalar(1.25);
      g.add(ph, rim);
    }
    // Deck planks (lengthwise) and the gunwale
    const deckCols = [0xc9955f, 0xbf8a55, 0xd29e66];
    for (let z = -1.75, i = 0; z < 1.85; z += 0.3, i++) {
      const pl = mesh(boxG(11.2, 0.1, 0.28), toon(deckCols[i % 3]), -0.2, -0.05, z, false);
      pl.receiveShadow = true;
      g.add(pl);
    }
    g.add(mesh(boxG(11.2, 0.2, 0.18), toon(0x7a4a2e), -0.2, 0.08, 1.98, false));
    // Back rail
    for (let x = -5.4; x <= 5.2; x += 1.15) g.add(mesh(cylG(0.05, 0.05, 0.75, 6), toon(WOOD_DARK), x, 0.38, -1.78, false));
    g.add(mesh(boxG(10.8, 0.08, 0.12), toon(0x7a4a2e), -0.1, 0.78, -1.78, false));

    // Puddles on deck
    P.puddles = [];
    for (const [x, z, rx, rz] of [[-0.9, 0.95, 0.95, 0.5], [2.2, 1.15, 0.7, 0.35], [4.4, -0.35, 0.6, 0.35], [-3.6, 1.1, 0.5, 0.3], [0.2, -0.3, 0.45, 0.25]]) {
      const pd = mesh(cylG(1, 1, 0.012, 22), toon(0x8cc8ee), x, 0.012, z, false);
      pd.scale.set(fixed ? 0.01 : rx, 1, fixed ? 0.01 : rz);
      g.add(pd);
      P.puddles.push(pd);
    }

    // Captain's cabin (stern), with a porthole full of fish
    g.add(mesh(boxG(2.6, 1.9, 1.5), toon(0xb07a4a), -4.1, 0.95, -1.05));
    g.add(mesh(boxG(2.9, 0.16, 1.75), toon(0x7a4a2e), -4.1, 1.95, -1.05));
    g.add(mesh(boxG(0.7, 1.25, 0.06), toon(0x7a4a2e), -4.75, 0.62, -0.28, false));
    g.add(mesh(sph(0.05, 8, 6), toon(0xffd84a), -4.5, 0.62, -0.24, false));
    P.portholeGlass = mesh(cylG(0.3, 0.3, 0.04, 18), toon(fixed ? 0x8aa6cf : 0x2e6aa8), -3.4, 1.1, -0.29, false);
    P.portholeGlass.rotation.x = Math.PI / 2;
    g.add(P.portholeGlass);
    g.add(mesh(sharedGeo('adv-portRim', () => new THREE.TorusGeometry(0.31, 0.05, 6, 18)), toon(0xffd84a), -3.4, 1.1, -0.26, false));
    P.fish = [];
    P.fishBox = new THREE.Group();
    P.fishBox.position.set(-3.4, 1.1, -0.24);
    g.add(P.fishBox);
    if (!fixed) {
      for (const c of [0xff9a3c, 0xffd23f]) {
        const f = makeFish(c);
        f.scale.setScalar(0.8);
        P.fishBox.add(f);
        P.fish.push(f);
      }
    }
    P.cabinSign = new THREE.Mesh(sharedGeo('adv-cabinSign', () => new THREE.PlaneGeometry(1.0, 0.3)), decalMaterial(drawCanvas(320, 96, drawCabinSign)));
    P.cabinSign.position.set(-4.75, 1.48, -0.27);
    g.add(P.cabinSign);

    // The ship's wheel
    P.wheel = makeWheel();
    P.wheel.position.set(-1.95, 0, -0.95);
    P.wheel.rotation.y = 0.55;
    g.add(P.wheel);

    // Mast, yard, crow's nest and rigging
    g.add(mesh(cylG(0.13, 0.17, 7, 10), toon(0x7a4a2e), 1.0, 3.5, -0.9));
    g.add(mesh(cylG(0.06, 0.06, 3.4, 8), toon(0x7a4a2e), 1.0, 4.3, -0.85).rotateZ(Math.PI / 2));
    g.add(mesh(cylG(0.42, 0.34, 0.36, 12), toon(0xa0704a), 1.0, 5.75, -0.9));
    const rope = toon(0xe8d5a8);
    for (const [x1, y1, x2, y2] of [[1.0, 5.6, -5.0, 0.8], [1.0, 5.6, 5.3, 0.8], [1.0, 5.0, -2.5, 0.8], [1.0, 5.0, 4.0, 0.8]]) {
      const len = Math.hypot(x2 - x1, y2 - y1);
      const r = mesh(cylG(0.015, 0.015, len, 4), rope, (x1 + x2) / 2, (y1 + y2) / 2, -1.75, false);
      r.rotation.z = Math.atan2(y2 - y1, x2 - x1) - Math.PI / 2;
      g.add(r);
    }
    // The new sail (the underpants), once hoisted
    P.sail = makeUnderpants();
    P.sail.position.set(1.0, 4.25, -0.6);
    P.sail.scale.setScalar(1.7);
    P.sail.visible = !!s.flag('s2.sail');
    g.add(P.sail);

    // The leak: water spouting UP through the deck (or Never-Wobble Pudding, rock solid)
    g.add(mesh(cylG(0.3, 0.3, 0.02, 16), toon(0x1d2b4f), 3.1, 0.005, 0.3, false));
    P.jet = new THREE.Group();
    P.jet.position.set(3.1, 0, 0.3);
    const water = toon(0x9ad8ff);
    P.jet.add(mesh(cylG(0.08, 0.14, 1.5, 10), water, 0, 0.75, 0, false));
    P.jet.add(mesh(sph(0.2, 10, 8), water, 0, 1.52, 0, false));
    for (let i = 0; i < 5; i++) {
      const d = mesh(sph(0.08, 8, 6), water, Math.cos(i * 1.3) * 0.3, 1.3 - (i % 2) * 0.3, Math.sin(i * 1.3) * 0.3, false);
      P.jet.add(d);
    }
    P.jet.visible = !fixed;
    g.add(P.jet);
    P.plug = new THREE.Group();
    P.plug.position.set(3.1, 0, 0.3);
    P.plug.add(mesh(cylG(0.33, 0.36, 0.1, 18), toon(0xbfae98), 0, 0.04, 0));
    P.plug.add(mesh(cylG(0.3, 0.32, 0.04, 18), toon(0x9a7a52), 0, 0.1, 0, false));
    P.plug.visible = fixed;
    g.add(P.plug);

    // A bucket (with a hole, of course)
    const bucket = new THREE.Group();
    bucket.position.set(4.7, 0, -1.15);
    bucket.add(mesh(cylG(0.24, 0.18, 0.42, 14), toon(0x8a9bb8), 0, 0.21, 0));
    bucket.add(mesh(sharedGeo('adv-bucketRim', () => new THREE.TorusGeometry(0.24, 0.025, 6, 16)), toon(0x6d7c99), 0, 0.42, 0, false).rotateX(Math.PI / 2));
    bucket.add(mesh(sharedGeo('adv-bucketHandle', () => new THREE.TorusGeometry(0.22, 0.012, 4, 12, Math.PI)), toon(0x4a4f63), 0, 0.42, 0, false));
    bucket.add(mesh(cylG(0.05, 0.05, 0.02, 8), toon(0x1d2b4f), 0.08, 0.12, 0.2, false).rotateX(Math.PI / 2 - 0.2));
    g.add(bucket);

    // Crew, once recruited
    P.wob = makeWobbles();
    P.wob.position.set(-0.3, 0, -0.75);
    P.wob.scale.setScalar(1.0);
    P.wob.visible = !!s.flag('s2.wob');
    g.add(P.wob);
    P.claw = makeClawdia();
    P.claw.position.set(5.2, 0, 0.9);
    P.claw.rotation.y = -0.4;
    P.claw.userData.hat.visible = true;
    P.claw.visible = !!s.flag('s2.claw');
    g.add(P.claw);

    addMine(s, P);
    P.next.bubble = 1;
    P.next.grumGiggle = 2;
    return P;
  },

  relabel(s, P) {
    redrawDecal(P.cabinSign.material, drawCabinSign);
  },

  actors(s, P) {
    return {
      grum: {
        name: 'adv.who.grum', css: GRUM_CSS, voice: { pitch: 0.5, rate: 0.85 },
        head: (v) => P.grum.localToWorld(v.set(0, 1.0, 0)),
      },
      gull: mineActor(s, P),
      wob: { name: 'adv.who.wob', css: WOB_CSS, voice: { pitch: 0.75, rate: 1.15 }, head: (v) => P.wob.localToWorld(v.set(0, 0.95, 0)) },
      claw: { name: 'adv.who.claw', css: CLAW_CSS, voice: { pitch: 1.7, rate: 1.25 }, sfx: 'clack', head: (v) => P.claw.localToWorld(v.set(0, 0.95, 0)) },
    };
  },

  self: SELF2,

  hotspots: [
    MINE_HS,
    {
      id: 'hole', name: (s) => t(s.flag('s2.hole') ? 'adv.deck.plug' : 'adv.deck.hole'), kind: 'object', box: [3.1, 0.75, 0.3, 0.9, 1.7, 0.8], walk: [2.35, 0.55], face: 1,
      look: (s) => (s.flag('s2.hole') ? 'adv.deck.hole.lookFixed' : 'adv.deck.hole.look'),
      use: (s) => (s.flag('s2.hole') ? 'adv.deck.hole.useFixed' : 'adv.deck.hole.use'),
      take: 'adv.deck.hole.take',
      useItem: {
        pudding: plugHole,
        spoon: (s) => (s.flag('s2.hole') ? 'adv.deck.hole.spoonFixed' : 'adv.deck.hole.spoon'),
        note: 'adv.deck.hole.note',
        coin: 'adv.deck.hole.coin',
        pants: 'adv.deck.hole.pants',
        gull: [['gull', 'adv.dock.gull.mine'], ['pip', 'adv.deck.hole.gull']],
      },
    },
    {
      id: 'sail', name: 'adv.deck.sail', kind: 'object', when: (s) => s.flag('s2.sail'), priority: 1,
      box: [1.0, 3.25, -0.6, 2.8, 2.1, 0.4], walk: [0.35, -0.3], face: 1,
      look: 'adv.deck.sail.look', use: 'adv.deck.sail.use', take: 'adv.deck.sail.use',
      useItem: { gull: [['gull', 'adv.dock.gull.mine'], ['pip', 'adv.deck.sail.gull']] },
    },
    {
      id: 'mast', name: 'adv.deck.mast', kind: 'object', box: [1.0, 2.4, -0.9, 0.7, 4.8, 0.6], walk: [0.35, -0.3], face: 1,
      look: (s) => (s.flag('s2.sail') ? 'adv.deck.sail.look' : 'adv.deck.mast.look'),
      use: (s) => (s.flag('s2.sail') ? 'adv.deck.sail.use' : 'adv.deck.mast.use'),
      useItem: {
        pants: hoistSail,
        spoon: 'adv.deck.mast.spoon',
        note: 'adv.deck.mast.note',
        pudding: 'adv.deck.mast.pudding',
        gull: [['gull', 'adv.dock.gull.mine'], ['pip', 'adv.deck.mast.gull']],
      },
    },
    {
      id: 'wheel', name: 'adv.deck.wheel', kind: 'object', box: [-1.95, 0.85, -0.95, 1.2, 1.5, 0.7], walk: [-1.25, -0.6], face: -1,
      look: 'adv.deck.wheel.look',
      use: function* wheel(s) {
        const P = s.room.props;
        s.tween(P.wheel.userData.wheel, { rz: P.wheel.userData.wheel.rotation.z + 1.2 }, 0.6, { ease: 'out' });
        s.sfx('creak');
        if (allDone(s)) { yield* ending(s, !!s.save.done2); return; }
        yield s.say('pip', 'adv.deck.wheel.notYet');
        yield* todo(s);
      },
      useItem: {
        spoon: 'adv.deck.wheel.spoon',
        gull: [['gull', 'adv.dock.gull.mine'], ['pip', 'adv.deck.wheel.gull']],
      },
    },
    {
      id: 'cabin', name: 'adv.deck.cabin', kind: 'object', box: [-4.1, 1.0, -1.05, 2.6, 2.0, 1.5], walk: [-3.4, -0.05], face: -1,
      look: (s) => (s.flag('s2.hole') ? 'adv.deck.cabin.lookFixed' : 'adv.deck.cabin.look'),
      use: function* knock(s) {
        s.sfx('knock');
        if (s.flag('s2.hole')) { yield s.say('pip', 'adv.deck.cabin.useFixed'); return; }
        const f = s.room.props.fish[0];
        if (f) s.tween(f, { s: 1.2 }, 0.3, { ease: 'back' });
        yield s.say('pip', 'adv.deck.cabin.use');
        if (f) s.tween(f, { s: 0.8 }, 0.3);
      },
      useItem: {
        spoon: 'adv.deck.cabin.spoon',
        gull: [['gull', 'adv.dock.gull.mine'], ['pip', 'adv.deck.cabin.gull']],
      },
    },
    {
      id: 'bucket', name: 'adv.deck.bucket', kind: 'object', box: [4.7, 0.25, -1.15, 0.7, 0.6, 0.7], walk: [4.05, -0.75], face: 1,
      look: 'adv.deck.bucket.look', use: 'adv.deck.bucket.use', take: 'adv.deck.bucket.take',
      useItem: { spoon: 'adv.deck.bucket.spoon', pudding: 'adv.deck.bucket.pudding' },
    },
    {
      id: 'oldsail', name: 'adv.deck.oldsail', kind: 'object', when: (s) => s.flag('s2.sailGone'),
      anchor: (s) => s.room.props.oldSail, box: [0, 0, 0, 2.3, 0.4, 1.8], walk: (s) => s.clampWalk(4.4, 1.45), face: 0,
      look: 'adv.deck.oldsail.look', take: 'adv.deck.oldsail.take', use: 'adv.deck.oldsail.take',
    },
    {
      id: 'grum', name: 'adv.dock.grum', kind: 'person', anchor: (s) => s.room.props.grum, box: [0, 0.5, 0, 1.3, 1.2, 1.0],
      walk: (s) => s.clampWalk(-3.0, 1.45), face: 0,
      look: 'adv.deck.grum.look', talk: talkGrum2, take: 'adv.dock.grum.take',
      useItem: GRUM2_ITEMS,
    },
    {
      id: 'wob', name: 'adv.who.wob', kind: 'person', when: (s) => s.flag('s2.wob'), anchor: (s) => s.room.props.wob,
      box: [0, 0.45, 0, 0.9, 0.9, 0.8], walk: [0.45, -0.55], face: -1,
      look: 'adv.deck.wob.look', talk: (s) => [['wob', allDone(s) ? 'adv.deck.wob.ready' : pick('adv.deck.wob.talk', 3)]],
      take: [['wob', 'adv.deck.wob.take']],
      useItem: { spoon: [['wob', 'adv.wob.spoon']], pudding: [['wob', 'adv.wob.pudding']], gull: [['gull', 'adv.dock.gull.mine'], ['wob', 'adv.wob.gull']] },
    },
    {
      id: 'claw', name: 'adv.who.claw', kind: 'person', when: (s) => s.flag('s2.claw'), anchor: (s) => s.room.props.claw,
      box: [0, 0.45, 0, 1.0, 0.9, 0.8], walk: [4.45, 0.9], face: 1,
      look: 'adv.deck.claw.look', talk: (s) => [['claw', allDone(s) ? 'adv.deck.claw.ready' : pick('adv.deck.claw.talk', 3)]],
      take: [['claw', 'adv.deck.claw.take']],
      useItem: { spoon: [['claw', 'adv.claw.spoon']], gull: [['gull', 'adv.dock.gull.mine'], ['claw', 'adv.claw.gull']] },
    },
    {
      id: 'gangway', name: 'adv.deck.gangway', kind: 'exit', anchor: (s) => s.room.props.gang, box: [0.5, 0.3, 0, 1.6, 0.9, 1.1],
      walk: [-4.6, 0.75], face: -1,
      look: (s) => (s.flag('s2.hole') ? 'adv.deck.gangway.lookFixed' : 'adv.deck.gangway.look'),
      go: toDock,
    },
    {
      id: 'dock', name: 'adv.deck.dock', kind: 'exit', anchor: (s) => s.room.props.world, box: [-8.5, 0.9, 0.2, 5.0, 0.8, 3.4], priority: -1,
      walk: [-4.6, 0.75], face: -1, look: 'adv.deck.dock.look', go: toDock,
    },
    {
      id: 'sea', name: 'adv.deck.sea', kind: 'object', anchor: (s) => s.room.props.world, box: [0, SEA - 0.2, 4.2, 30, 0.6, 4.2], priority: -2,
      walk: (s) => s.clampWalk(s.pip.position.x, 1.45), face: 0,
      look: (s) => (s.flag('s2.hole') ? 'adv.deck.sea.lookFixed' : 'adv.deck.sea.look'), use: 'adv.deck.sea.use',
      useItem: { pudding: 'adv.deck.sea.pudding', spoon: 'adv.dock.harbor.spoon' },
    },
  ],

  update(s, dt, P) {
    const tm = s.room.time;
    for (const gl of P.glints) {
      const u = gl.userData;
      gl.position.set(((u.x + tm * u.sp + 15) % 30) - 15, SEA + 0.01, u.z);
      gl.scale.x = u.w * (0.7 + 0.3 * Math.sin(tm * 2 + u.x));
    }
    for (const c of P.clouds) c.position.x += dt * 0.12;
    // The camera rises a little with the ship, so Grumbleton stays in view
    const camDY = P.world.position.y * 0.45;
    if (Math.abs((s.camDY || 0) - camDY) > 1e-4) { s.camDY = camDY; s.frame(); }
    // Gangway: from the dock edge to the deck, whatever the height difference
    const dockY = 0.77 + P.world.position.y;
    P.gang.position.set(-6.0, dockY, 0.75);
    const dx = 1.55, dy = 0.03 - dockY;
    P.gang.rotation.z = Math.atan2(dy, dx);
    P.gang.scale.x = Math.hypot(dx, dy);
    // The leak spouts; the old sail and Grumbleton bob
    if (P.jet.visible) {
      P.jet.scale.set(1, 0.8 + 0.25 * Math.sin(tm * 9) + 0.1 * Math.sin(tm * 23), 1);
      if ((P.next.bubble -= dt) <= 0) {
        P.next.bubble = 0.35 + Math.random() * 0.4;
        s.host.puffs.burst(new THREE.Vector3(3.1, 1.5, 0.3), 0xcfeeff, { count: 3, size: 0.18, life: 0.5, speed: 1.6 });
      }
    }
    if (P.oldSail.visible) P.oldSail.position.y = SEA + 0.03 + Math.sin(tm * 1.3) * 0.03;
    if (!s.tweens.some((tw) => tw.obj === P.grum)) {
      P.grum.position.y = SEA - 0.5 + Math.sin(tm * 1.8) * 0.06;
      P.grum.rotation.z = 0.6 + Math.sin(tm * 1.1) * 0.12;
    }
    if ((P.next.grumGiggle -= dt) <= 0) {
      P.next.grumGiggle = 3.5 + Math.random() * 3;
      if (s.mode === 'play') s.float(t('adv.fx.heehee'), P.grum.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 1.1, 0)));
    }
    // Fish swim around the flooded cabin
    P.fish.forEach((f, i) => {
      if (f.parent !== P.fishBox) return;
      const a = tm * (0.9 + i * 0.4) + i * 2;
      f.position.set(Math.cos(a) * 0.13, Math.sin(a * 1.3) * 0.08, 0.02 + i * 0.01);
      f.rotation.y = Math.sin(a) > 0 ? Math.PI : 0;
    });
    // The underpants sail billows
    if (P.sail.visible) {
      const b = P.sail.userData.body;
      b.rotation.x = Math.sin(tm * 1.7) * 0.08 - 0.05;
      if (!s.tweens.some((tw) => tw.obj === b)) b.scale.z = 1 + Math.sin(tm * 2.1) * 0.3;
    }
    // Crew idle
    if (P.wob.visible) wobble(s, P.wob, tm);
    if (P.claw.visible) clawIdle(s, P.claw, tm);
    animateGull(s, dt, P);
  },
};

function wobble(s, wob, tm) {
  const b = wob.userData.body;
  const talk = s.isTalking('wob');
  const k = talk ? 0.09 : 0.035;
  b.scale.set(1 + Math.sin(tm * 7) * k, 1 - Math.sin(tm * 7) * k, 1 + Math.sin(tm * 7) * k);
  b.rotation.z = Math.sin(tm * 3.5) * (talk ? 0.08 : 0.03);
  wob.userData.mouth.scale.y = talk ? 0.4 + Math.abs(Math.sin(tm * 14)) * 1.2 : 0.4;
}

function clawIdle(s, claw, tm) {
  const u = claw.userData;
  const talk = s.isTalking('claw');
  u.claws.forEach((c, i) => { c.rotation.z = (i ? -1 : 1) * (0.15 + Math.sin(tm * (talk ? 14 : 3) + i) * (talk ? 0.25 : 0.1)); });
  u.eyes.position.y = Math.sin(tm * 2.3) * 0.02;
  u.inner.position.y = Math.abs(Math.sin(tm * 5)) * (talk ? 0.04 : 0.01);
}

// ---------- the town square ----------

function drawParlorSign(g, w, h) {
  g.fillStyle = '#fff4e6';
  g.beginPath();
  g.roundRect(4, 4, w - 8, h - 8, 40);
  g.fill();
  g.strokeStyle = '#ff6fae';
  g.lineWidth = 10;
  g.stroke();
  g.fillStyle = '#7a3f6a';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  fitText(g, t('adv.sq.parlorSign'), w / 2, h / 2 + 4, w - 70, 76);
}

function drawDockSign(g, w, h) {
  g.fillStyle = '#e8c48e';
  g.beginPath();
  g.moveTo(0, h / 2); g.lineTo(h * 0.45, 0); g.lineTo(w, 0); g.lineTo(w, h); g.lineTo(h * 0.45, h);
  g.closePath();
  g.fill();
  g.fillStyle = '#5a3f2a';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  fitText(g, t('adv.sq.dockSign'), w * 0.58, h / 2 + 3, w * 0.7, 80);
}

/** Into Granny's Pudding Parlor (she says hello the first time). */
function* goParlor(s) {
  yield s.goRoom('parlor', 'door');
  if (!s.flag('par.seen')) {
    s.setFlag('par.seen');
    yield s.walk(-3.6, 0.2);
    s.face('granny', -1);
    yield s.say('granny', 'adv.gran.welcome1');
    yield s.say('granny', 'adv.gran.welcome2');
  }
}

/** Mine spots the ducks, fetches the underpants and drops them on Pip. */
function* mineFetchPants(s) {
  const P = s.room.props;
  if (s.flag('s2.pants')) { yield s.say('pip', 'adv.sq.pants.gone'); return; }
  const stand = [1.25, -0.65];
  if (Math.hypot(s.pip.position.x - stand[0], s.pip.position.z - stand[1]) > 0.2) yield s.walk(stand[0], stand[1]);
  s.face('pip', 1);
  yield s.say('pip', 'adv.sq.fetch1');
  yield s.say('gull', 'adv.dock.gull.soft');
  yield s.say('pip', 'adv.sq.fetch2');
  // Off she goes
  const gull = P.gull;
  const from = gull.getWorldPosition(new THREE.Vector3());
  gull.parent.remove(gull);
  s.room.group.add(gull);
  gull.position.copy(from);
  gull.rotation.set(0, 0, 0);
  gull.scale.setScalar(0.85);
  P.gullAway = true;
  P.flying = true;
  s.sfx('flap');
  const pt = P.pants.position;
  s.tween(gull, { x: (from.x + pt.x) / 2, y: pt.y + 1.0, z: (from.z + pt.z) / 2 }, 0.6, { ease: 'out' });
  s.tween(gull, { x: pt.x - 0.3, y: pt.y + 0.2, z: pt.z + 0.15 }, 0.5, { delay: 0.6, ease: 'in' });
  yield s.wait(1.15);
  s.sfx('mine');
  yield s.say('gull', 'adv.dock.gull.mine');
  // She pulls them off the line and flies down, dropping them right on Pip
  const head = s.pipHead();
  s.sfx('flap');
  P.socks.forEach((sk, i) => s.tween(sk, { rz: (i ? 0.6 : -0.6) }, 0.3, { ease: 'back' }));
  s.tween(gull, { x: head.x + 0.2, y: head.y + 1.5, z: head.z }, 0.9, { ease: 'inOut' });
  s.tween(P.pants, { x: head.x, y: head.y + 1.0, z: head.z + 0.05 }, 0.9, { ease: 'inOut' });
  yield s.wait(0.95);
  s.tween(P.pants, { y: s.pip.position.y + 1.35, s: 0.95 }, 0.25, { ease: 'in' });
  yield s.wait(0.25);
  s.sfx('boing');
  s.pipChar.squash(0.6);
  yield s.say('pip', 'adv.sq.fetch3');
  s.tween(P.pants, { s: 0.2, y: s.pip.position.y + 0.8 }, 0.35, { ease: 'in' });
  yield s.wait(0.35);
  P.pants.visible = false;
  s.give('pants');
  s.setFlag('s2.pants');
  // Back on the head she goes
  s.tween(gull, { x: head.x, y: head.y, z: head.z }, 0.3, { ease: 'in' });
  yield s.wait(0.3);
  putGullOnHead(s, P);
  P.gullAway = false;
  P.flying = false;
  s.pipChar.squash(0.8);
  yield s.say('gull', 'adv.dock.gull.ours');
  yield s.say('pip', 'adv.sq.fetch4');
}

/** Fish the coin out of the custard fountain with the (pirate) spoon. */
function* fishCoin(s) {
  const P = s.room.props;
  if (s.flag('sq.coin')) { yield s.say('pip', 'adv.sq.fountain.spoonEmpty'); return; }
  s.face('pip', -1);
  yield s.say('pip', 'adv.sq.fish1');
  const sp = s.pipSpoon;
  s.tween(sp, { rz: -1.9, y: 0.25 }, 0.4, { ease: 'out' });
  s.tween(sp, { rz: -0.35, y: 0.42 }, 0.4, { delay: 0.9, ease: 'back' });
  s.sfx('splash');
  const coin = P.fountain.userData.coin;
  const w = coin.getWorldPosition(new THREE.Vector3());
  coin.parent.remove(coin);
  s.room.group.add(coin);
  coin.position.copy(w);
  s.tween(coin, { y: w.y + 1.4, x: w.x + 0.3, rx: 6 }, 0.6, { delay: 0.8, ease: 'out' });
  s.tween(coin, { x: s.pip.position.x, y: 0.9, z: s.pip.position.z, s: 0.3 }, 0.4, { delay: 1.4, ease: 'in' });
  yield s.wait(1.8);
  coin.visible = false;
  s.give('coin');
  s.setFlag('sq.coin');
  s.pipChar.squash(1.3);
  yield s.say('pip', 'adv.sq.fish2');
  yield s.say('gull', 'adv.dock.gull.mine');
  yield s.say('pip', 'adv.sq.fish3');
}

// ----- Clawdia -----

const CLAW_X = 1.5; // she shuffles left and right around here while practising

/** Clawdia stops practising and turns to Pip. */
function* clawStill(s) {
  const c = s.room.props.claw;
  s.face('pip', 1);
  s.face('claw', -1);
  if (Math.abs(c.position.x - CLAW_X) > 0.02) {
    s.tween(c, { x: CLAW_X }, 0.25);
    yield s.wait(0.25);
  }
}

/** Practice Tickle Fencing: every miss teaches Pip the comeback (Clawdia can't help telling). */
function* practiceDuel(s) {
  const P = s.room.props;
  const c = P.claw;
  yield s.walk(CLAW_X - 1.15, 0.35);
  yield* clawStill(s);
  s.game.audio.playMusic('party');
  const won = yield* tickleDuel(s, {
    opponent: 'claw',
    boasts: ['statue', 'knees', 'shiver'],
    wrong: ['duck', 'rubber', 'grandma'],
    practice: true,
    smug: 'adv.claw.smug',
    retorts: { duck: 'adv.claw.r.duck', grandma: 'adv.claw.r.grandma' },
    intro: [['claw', 'adv.claw.d.start1'], ['pip', 'adv.claw.d.start2'], ['claw', 'adv.claw.d.start3']],
    teach: function* teach(s2, id, comeback) {
      yield s2.say('claw', pick('adv.claw.reveal', 2));
      yield s2.say('claw', comeback);
    },
    onHit: function* hit(s2, n) {
      giggleShake(s2, c, n === 3);
      yield s2.say('claw', `adv.claw.hit.${n}`);
    },
    onMiss: (s2, n) => pipTickled(s2, c, n, 1),
  });
  s.game.audio.playMusic('adventure');
  if (won) {
    s.setFlag('claw.won');
    yield* s.lines([['claw', 'adv.claw.d.won1'], ['claw', 'adv.claw.d.won2']]);
  } else {
    yield* s.lines([['claw', 'adv.claw.d.lost1'], ['claw', 'adv.claw.d.lost2']]);
  }
}

/** The note folded into a paper hat: Clawdia joins the crew. */
function* hatForClaw(s) {
  const P = s.room.props;
  const c = P.claw;
  yield* clawStill(s);
  s.drop('note');
  yield s.say('narr', 'adv.claw.hat1');
  s.sfx('pop');
  c.userData.hat.visible = true;
  c.userData.hat.scale.setScalar(0.2);
  s.tween(c.userData.hat, { s: 0.85 }, 0.35, { ease: 'back' });
  s.host.confetti.burst(c.position.clone().add(new THREE.Vector3(0, 0.9, 0)), 0, { count: 24, speed: 4, up: 3, life: 1.2, gravity: -6, size: 0.12 });
  yield s.say('claw', 'adv.claw.hat2');
  yield s.say('claw', 'adv.claw.hat3');
  yield s.say('pip', 'adv.claw.hat4');
  yield s.say('claw', 'adv.claw.hat5');
  // Off to the ship, sideways
  s.sfx('clack');
  s.tween(c, { x: -7.8 }, 2.4, { ease: 'in' });
  yield s.wait(0.8);
  s.setFlag('s2.claw');
  yield s.say('gull', 'adv.dock.gull.mine');
  yield s.say('pip', 'adv.claw.hat6');
  c.visible = false;
  yield* checkDone(s);
}

const CLAW_TREE = {
  id: 'claw',
  start: 'main',
  nodes: {
    main: {
      intro: (s) => {
        if (!s.flag('claw.met')) return [['claw', 'adv.claw.hello1'], ['claw', 'adv.claw.hello2'], (s2) => { s2.setFlag('claw.met'); }];
        return [['claw', s.flag('claw.won') ? 'adv.claw.againWon' : 'adv.claw.again']];
      },
      options: [
        { id: 'who', text: 'adv.claw.o.who', lines: [['claw', 'adv.claw.who1'], ['pip', 'adv.claw.p.who2'], ['claw', 'adv.claw.who3']] },
        {
          id: 'crew', text: 'adv.claw.o.crew',
          lines: (s) => (s.flag('claw.wantsHat')
            ? [['claw', 'adv.claw.crewAgain']]
            : [['claw', 'adv.claw.crew1'], ['claw', 'adv.claw.crew2'], ['claw', 'adv.claw.crew3'], ['pip', 'adv.claw.p.crew4'],
              ['claw', 'adv.claw.crew5'], ['claw', 'adv.claw.crew6'], (s2) => { s2.setFlag('claw.wantsHat'); }]),
        },
        {
          id: 'practice', text: 'adv.claw.o.practice',
          lines: [['claw', 'adv.claw.practice1'], ['claw', 'adv.claw.practice2'], ['claw', 'adv.claw.practice3'], (s) => { s.setFlag('claw.knowPractice'); }],
        },
        { id: 'spar', text: 'adv.claw.o.spar', when: (s) => s.flag('claw.knowPractice'), end: true, run: practiceDuel },
        { id: 'side', text: 'adv.claw.o.side', lines: [['claw', 'adv.claw.side']] },
        { id: 'bye', text: 'adv.dock.o.bye', end: true, lines: [['claw', 'adv.claw.bye']] },
      ],
    },
  },
};

const square = {
  name: 'adv.room.square',
  sky: ['#86cdf5', '#fff3d6'],
  camera: { viewW: 15.4, viewH: 8, lookY: 1.75, pitch: 0.18, fov: 30 },
  entries: {
    start: { x: -6.2, z: 0.9, face: 1 },
    dock: { x: -6.2, z: 0.9, face: 1 },
    parlor: { x: 6.1, z: -0.5, face: -1 },
  },
  walk: [[-6.9, -0.9, -3.0, 1.6], [-3.0, 0.2, -0.8, 1.6], [-0.8, -0.9, 6.7, 1.6]],

  lights(s, L) {
    if (!L) return;
    L.hemi.color.set(0xfff6e8);
    L.hemi.groundColor.set(0x9a90b8);
    L.hemi.intensity = 1.5;
    L.sun.color.set(0xfff1d6);
    L.sun.intensity = 1.85;
  },

  build(s, g) {
    const P = {};
    const rand = seeded(33);

    // Ground: a sandy square with cobbles
    const ground = mesh(boxG(40, 0.2, 24), toon(0xf1dcae), 0, -0.1, -1, false);
    ground.receiveShadow = true;
    g.add(ground);
    for (let i = 0; i < 70; i++) {
      const cb = mesh(cylG(1, 1, 0.012, 10), toon(i % 3 ? 0xe6cb94 : 0xead3a2), -9 + rand() * 18, 0.006, -3 + rand() * 5.5, false);
      cb.scale.set(0.18 + rand() * 0.15, 1, 0.12 + rand() * 0.08);
      cb.receiveShadow = true;
      g.add(cb);
    }

    // Far hills and the sea glimpsed between houses
    for (const [x, z, w, h, c] of [[-18, -26, 12, 5, 0x9fd49a], [14, -30, 16, 6, 0x8fcf8a], [0, -40, 22, 8, 0xa8dca0]]) {
      const hl = makeIsland(c, w, h);
      hl.position.set(x, -0.2, z);
      g.add(hl);
    }
    P.clouds = [];
    for (const [x, y, z, sc] of [[-12, 9, -40, 2], [8, 10.5, -48, 2.4], [18, 8, -36, 1.5]]) {
      const c = makeCloud(rand, sc);
      c.position.set(x, y, z);
      g.add(c);
      P.clouds.push(c);
    }
    // Distant pudding houses on the hills
    for (let i = 0; i < 9; i++) {
      const hz = makePuddingHouse(HOUSE_COLORS[i % HOUSE_COLORS.length], { w: 1.4, h: 1.6 + (i % 3) * 0.4, door: false, windows: 1 });
      hz.position.set(-16 + i * 4, 1.4 + Math.sin(i * 1.7) * 0.8, -20 - (i % 2) * 3);
      g.add(hz);
    }

    // Houses around the square (Never-Wobble Pudding: they never wobble)
    for (const [x, z, c, w, h] of [[-7.6, -3.6, 0xff8fab, 2.4, 2.8], [-4.6, -4.4, 0xffe6a3, 2.6, 3.4], [-1.4, -4.2, 0xb6e3a1, 2.2, 3.8], [2.6, -4.3, 0xa9b8ff, 2.4, 3.2]]) {
      const hz = makePuddingHouse(c, { w, h, windows: 2 });
      hz.position.set(x, 0, z);
      g.add(hz);
    }
    // Granny's Pudding Parlor: the biggest, pinkest pudding of all
    const parlor = makePuddingHouse(0xffc0d6, { w: 3.2, h: 3.4, windows: 2, cap: 0x8a4a2a });
    parlor.position.set(6.4, 0, -2.9);
    g.add(parlor);
    P.parlorSign = new THREE.Mesh(sharedGeo('adv-parlorSign', () => new THREE.PlaneGeometry(2.6, 0.62)), decalMaterial(drawCanvas(640, 152, drawParlorSign)));
    P.parlorSign.position.set(6.4, 1.55, -1.3);
    g.add(P.parlorSign);
    // Striped awning over the door
    for (let i = 0; i < 5; i++) {
      const aw = mesh(boxG(0.3, 0.08, 0.6), toon(i % 2 ? 0xffffff : 0xff6fae), 5.8 + i * 0.3, 1.15, -1.25, false);
      aw.rotation.x = 0.4;
      g.add(aw);
    }

    // Bunting between the houses
    for (let i = 0; i < 16; i++) {
      const fl = mesh(coneG(0.13, 0.28, 3), toon([0xff6fae, 0xffd84a, 0x4cc9f0, 0x7bd389][i % 4]), -7.5 + i * 0.6, 3.95 - Math.sin((i / 15) * Math.PI) * 0.4, -3.0, false);
      fl.rotation.z = Math.PI;
      fl.scale.z = 0.3;
      g.add(fl);
    }

    // Statue of Admiral Custard
    P.statue = makeStatue();
    P.statue.position.set(-4.8, 0, -1.75);
    g.add(P.statue);

    // The Custard Fountain
    P.fountain = makeFountain();
    P.fountain.position.set(-1.9, 0, -1.0);
    if (s.flag('sq.coin')) P.fountain.userData.coin.visible = false;
    g.add(P.fountain);

    // Washing line with the underpants (and two normal-sized socks)
    for (const x of [-0.2, 3.6]) {
      g.add(mesh(cylG(0.07, 0.09, 4.0, 8), toon(WOOD_DARK), x, 2.0, -2.0));
      g.add(mesh(sph(0.1, 8, 6), toon(WOOD), x, 4.02, -2.0));
    }
    const line = mesh(cylG(0.012, 0.012, 3.8, 4), toon(0xffffff), 1.7, 3.78, -2.0, false);
    line.rotation.z = Math.PI / 2;
    g.add(line);
    P.socks = [];
    for (const [x, c] of [[0.45, 0x4cc9f0], [3.0, 0x7bd389]]) {
      const sk = makeSock(c);
      sk.position.set(x, 3.78, -2.0);
      sk.add(makePeg());
      g.add(sk);
      P.socks.push(sk);
    }
    P.pants = makeUnderpants();
    P.pants.position.set(1.7, 3.8, -2.0);
    for (const x of [-0.6, 0.6]) {
      const pg = makePeg();
      pg.position.set(x, 0.04, 0.06);
      P.pants.add(pg);
    }
    P.pants.visible = !s.flag('s2.pants');
    g.add(P.pants);

    // Notice board
    for (const x of [3.95, 5.05]) g.add(mesh(cylG(0.06, 0.07, 1.9, 8), toon(WOOD_DARK), x, 0.95, -1.35));
    g.add(mesh(boxG(1.35, 0.95, 0.08), toon(WOOD), 4.5, 1.35, -1.3));
    for (const [x, y, w, h, c, r] of [[4.2, 1.45, 0.5, 0.55, 0xfff3d6, 0.05], [4.78, 1.5, 0.42, 0.4, 0xffd0e0, -0.08], [4.75, 1.08, 0.48, 0.3, 0xd6f0ff, 0.04]]) {
      const n = mesh(boxG(w, h, 0.02), toon(c), x, y, -1.25, false);
      n.rotation.z = r;
      g.add(n);
      for (let k = 0; k < 3; k++) g.add(mesh(boxG(w * 0.6, 0.02, 0.01), toon(0x6a5f8a), x, y + h * 0.25 - k * h * 0.2, -1.235, false));
    }

    // Signpost back to the dock
    g.add(mesh(cylG(0.06, 0.07, 1.7, 8), toon(WOOD_DARK), -6.4, 0.85, 1.05));
    P.dockSign = new THREE.Mesh(sharedGeo('adv-dockSign', () => new THREE.PlaneGeometry(1.2, 0.42)), decalMaterial(drawCanvas(320, 112, drawDockSign)));
    P.dockSign.position.set(-6.6, 1.4, 1.1);
    g.add(P.dockSign);

    // A few potted puddings and flowers for cheer
    for (const [x, z, c] of [[-3.4, -2.6, 0xff9fd0], [0.6, -2.7, 0xffd84a], [5.0, -2.2, 0x9be38f]]) {
      g.add(mesh(cylG(0.22, 0.17, 0.32, 10), toon(0xd9825a), x, 0.16, z));
      g.add(mesh(sph(0.28, 10, 8), toon(c), x, 0.45, z));
    }

    // Clawdia, practising Tickle Fencing in the middle of the square
    P.claw = makeClawdia();
    P.claw.position.set(1.5, 0, 0.35);
    P.claw.visible = !s.flag('s2.claw');
    g.add(P.claw);

    addMine(s, P);
    P.next.clack = 2;
    return P;
  },

  relabel(s, P) {
    redrawDecal(P.parlorSign.material, drawParlorSign);
    redrawDecal(P.dockSign.material, drawDockSign);
  },

  actors(s, P) {
    return {
      gull: mineActor(s, P),
      claw: { name: 'adv.who.claw', css: CLAW_CSS, voice: { pitch: 1.7, rate: 1.25 }, sfx: 'clack', head: (v) => P.claw.localToWorld(v.set(0, 0.95, 0)), face: (dir) => s.tween(P.claw, { ry: dir < 0 ? -0.5 : 0.5 }, 0.2) },
      board: { name: '', kind: 'note', css: '#c9a25a', voice: { pitch: 1.0, rate: 0.95 }, head: (v) => v.set(4.5, 1.95, -1.3) },
    };
  },

  self: SELF2,

  hotspots: [
    MINE_HS,
    {
      id: 'dockpath', name: 'adv.sq.dockpath', kind: 'exit', box: [-6.6, 1.0, 1.0, 1.3, 2.0, 0.9], walk: [-6.5, 0.9], face: -1,
      look: 'adv.sq.dockpath.look', go: (s) => s.goRoom('dock', 'town'),
    },
    {
      id: 'parlor', name: 'adv.sq.parlor', kind: 'exit', box: [6.4, 1.2, -1.4, 2.8, 2.4, 0.6], walk: [6.2, -0.75], face: 1,
      look: 'adv.sq.parlor.look', go: goParlor,
      useItem: { gull: [['gull', 'adv.dock.gull.mine'], ['pip', 'adv.sq.parlor.gull']] },
    },
    {
      id: 'pants', name: 'adv.sq.pants', kind: 'object', when: (s) => !s.flag('s2.pants'),
      box: [1.7, 3.2, -2.0, 1.8, 1.3, 0.4], walk: [1.25, -0.65], face: 1,
      look: [['pip', 'adv.sq.pants.look'], ['gull', 'adv.dock.gull.soft']],
      use: 'adv.sq.pants.take', take: 'adv.sq.pants.take', talk: 'adv.sq.pants.talk',
      useItem: {
        gull: mineFetchPants,
        spoon: 'adv.sq.pants.spoon',
        note: 'adv.sq.pants.note',
        coin: 'adv.sq.pants.coin',
        pudding: 'adv.sq.pants.pudding',
      },
    },
    {
      id: 'washing', name: 'adv.sq.washing', kind: 'object', box: [1.7, 3.6, -2.0, 4.0, 0.7, 0.4], priority: -1, walk: [1.25, -0.65], face: 1,
      look: (s) => (s.flag('s2.pants') ? 'adv.sq.washing.lookGone' : 'adv.sq.washing.look'), take: 'adv.sq.washing.take',
    },
    {
      id: 'fountain', name: 'adv.sq.fountain', kind: 'object', box: [-1.9, 0.9, -1.0, 2.3, 1.9, 2.2], walk: [-0.55, -0.5], face: -1,
      look: (s) => (s.flag('sq.coin') ? 'adv.sq.fountain.lookEmpty' : 'adv.sq.fountain.look'),
      use: 'adv.sq.fountain.use',
      take: (s) => (s.flag('sq.coin') ? 'adv.sq.fountain.takeEmpty' : 'adv.sq.fountain.take'),
      useItem: {
        spoon: fishCoin,
        coin: 'adv.sq.fountain.coin',
        note: 'adv.sq.fountain.note',
        pudding: 'adv.sq.fountain.pudding',
        pants: 'adv.sq.fountain.pants',
        gull: [['gull', 'adv.dock.gull.mine'], ['pip', 'adv.sq.fountain.gull']],
      },
    },
    {
      id: 'statue', name: 'adv.sq.statue', kind: 'object', box: [-4.8, 1.7, -1.75, 1.4, 3.4, 1.2], walk: [-3.9, -0.8], face: -1,
      look: 'adv.sq.statue.look', use: 'adv.sq.statue.use', take: 'adv.sq.statue.take', talk: 'adv.sq.statue.talk',
      useItem: {
        spoon: 'adv.sq.statue.spoon',
        pants: 'adv.sq.statue.pants',
        gull: [['gull', 'adv.dock.gull.mine'], ['pip', 'adv.sq.statue.gull']],
      },
    },
    {
      id: 'board', name: 'adv.sq.board', kind: 'object', box: [4.5, 1.35, -1.3, 1.4, 1.05, 0.4], walk: [4.0, -0.8], face: 1,
      look: [['board', 'adv.sq.board.n1'], ['pip', 'adv.sq.board.p1'], ['board', 'adv.sq.board.n2'], ['pip', 'adv.sq.board.p2']],
      use: [['board', 'adv.sq.board.n1'], ['pip', 'adv.sq.board.p1'], ['board', 'adv.sq.board.n2'], ['pip', 'adv.sq.board.p2']],
      take: 'adv.sq.board.take',
      useItem: { note: 'adv.sq.board.note' },
    },
    {
      id: 'claw', name: 'adv.who.claw', kind: 'person', when: (s) => !s.flag('s2.claw'), anchor: (s) => s.room.props.claw,
      box: [0, 0.45, 0, 1.1, 0.9, 0.8], walk: [CLAW_X - 1.15, 0.35], face: 1,
      look: (s) => (s.flag('claw.wantsHat') ? 'adv.claw.lookHat' : 'adv.claw.look'),
      talk: function* talkClaw(s) {
        yield* clawStill(s);
        yield* runDialog(s, CLAW_TREE);
      },
      take: [['claw', 'adv.claw.take']],
      useItem: {
        note: hatForClaw,
        spoon: [['claw', 'adv.claw.spoon']],
        coin: [['claw', 'adv.claw.coin']],
        pants: [['claw', 'adv.claw.pants']],
        pudding: [['claw', 'adv.claw.pudding']],
        gull: [['gull', 'adv.dock.gull.mine'], ['claw', 'adv.claw.gull']],
      },
    },
    {
      id: 'houses', name: 'adv.sq.houses', kind: 'object', box: [-2.5, 1.8, -4.2, 13, 3.6, 1.6], priority: -2,
      walk: (s) => s.clampWalk(s.pip.position.x, -0.9), face: 0,
      look: 'adv.sq.houses.look', use: 'adv.sq.houses.use', take: 'adv.sq.houses.take',
      useItem: { spoon: 'adv.sq.houses.spoon', pudding: 'adv.sq.houses.pudding' },
    },
  ],

  update(s, dt, P) {
    const tm = s.room.time;
    for (const c of P.clouds) c.position.x += dt * 0.12;
    const f = P.fountain.userData;
    f.jet.scale.set(1, 0.85 + Math.sin(tm * 6) * 0.15, 1);
    f.pool.scale.setScalar(1 + Math.sin(tm * 3) * 0.004);
    if (P.pants.visible && !s.tweens.some((tw) => tw.obj === P.pants)) {
      P.pants.rotation.x = Math.sin(tm * 1.4) * 0.12;
      P.pants.rotation.z = Math.sin(tm * 0.9) * 0.04;
    }
    P.statue.userData.drop.position.y = 1.08 - ((tm * 0.25) % 0.3);
    // Clawdia practises: shuffles sideways and jabs at the air
    if (P.claw.visible) {
      clawIdle(s, P.claw, tm);
      const busy = s.mode === 'play' && !s.flag('claw.met');
      // Shuffle only while nobody is talking to her (and not while Pip walks over)
      const coming = s.pending?.hs?.id === 'claw';
      if (!s.tweens.some((tw) => tw.obj === P.claw) && s.mode === 'play' && !coming) P.claw.position.x = CLAW_X + Math.sin(tm * 0.8) * 0.35;
      if (busy && (P.next.clack -= dt) <= 0) {
        P.next.clack = 2.5 + Math.random() * 2;
        s.float(t('adv.fx.tickle'), P.claw.position.clone().add(new THREE.Vector3(0, 1.0, 0)));
      }
    }
    if (P.flying) {
      const gu = P.gull.userData;
      gu.wings[0].rotation.x = Math.sin(tm * 30) * 0.7;
      gu.wings[1].rotation.x = -Math.sin(tm * 30) * 0.7;
    } else {
      animateGull(s, dt, P);
    }
  },
};

// ---------- Granny's Pudding Parlor ----------

function drawMenu(g, w, h) {
  g.fillStyle = '#2f3a36';
  g.fillRect(0, 0, w, h);
  g.strokeStyle = '#a0704a';
  g.lineWidth = 22;
  g.strokeRect(11, 11, w - 22, h - 22);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = '#ffffff';
  fitText(g, t('adv.par.menuTitle'), w / 2, h * 0.17, w - 80, 58);
  g.fillStyle = '#ffd6e4';
  fitText(g, t('adv.par.menu1'), w / 2, h * 0.37, w - 90, 44, 600);
  g.fillStyle = '#d8f0ff';
  fitText(g, t('adv.par.menu2'), w / 2, h * 0.55, w - 90, 44, 600);
  g.fillStyle = '#ff8a8a';
  fitText(g, t('adv.par.menu2b'), w / 2, h * 0.68, w - 90, 44, 700);
  g.fillStyle = '#ffe48a';
  fitText(g, t('adv.par.menu3'), w / 2, h * 0.85, w - 90, 30, 600);
}

function drawPotLabel(g, w, h) {
  g.fillStyle = '#fff4dc';
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#5a3f2a';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  fitText(g, t('adv.par.potLabel'), w / 2, h / 2 + 2, w - 24, 44);
}

/** Baby Grumbleton in a tiny uniform (two sizes too small, even then). */
function drawPortrait(g, w, h) {
  g.fillStyle = '#ffe9c8';
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#8c7ae6';
  g.beginPath(); g.arc(w / 2, h * 0.56, w * 0.3, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#2f4b8f';
  g.fillRect(w * 0.26, h * 0.66, w * 0.48, h * 0.13);
  g.fillStyle = '#ffd84a';
  g.fillRect(w * 0.48, h * 0.68, w * 0.04, h * 0.09);
  g.fillStyle = '#fff';
  for (const s of [-1, 1]) { g.beginPath(); g.arc(w / 2 + s * w * 0.1, h * 0.5, w * 0.07, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = '#2b2340';
  for (const s of [-1, 1]) { g.beginPath(); g.arc(w / 2 + s * w * 0.1, h * 0.52, w * 0.035, 0, Math.PI * 2); g.fill(); }
  g.lineWidth = 6;
  g.strokeStyle = '#2b2340';
  for (const s of [-1, 1]) { g.beginPath(); g.moveTo(w / 2 + s * w * 0.04, h * 0.41); g.lineTo(w / 2 + s * w * 0.16, h * 0.38); g.stroke(); }
  g.fillStyle = '#ffffff';
  g.fillRect(w * 0.44, h * 0.2, w * 0.12, h * 0.07);
}

function* grannyHit(s, n) {
  const P = s.room.props;
  const G = P.granny;
  giggleShake(s, G, n === 4);
  yield s.say('granny', `adv.gran.hit.${n}`);
  if (n < 4) return;
  // Fifty years without a giggle, all at once: the knitting goes flying
  const k = G.userData.knit;
  s.tween(k, { y: 1.6, rz: 6 }, 0.7, { ease: 'out' });
  s.tween(k, { y: 0.32, rz: 12.56 }, 0.6, { delay: 0.7, ease: 'in' });
  s.tween(G, { y: G.position.y + 0.3 }, 0.25, { ease: 'out' });
  s.tween(G, { y: G.position.y }, 0.3, { delay: 0.25, ease: 'in' });
  for (let i = 0; i < 3; i++) s.host.later(i * 0.4, () => s.float(t('adv.fx.haha'), G.position.clone().add(new THREE.Vector3(-0.4 + i * 0.4, 2.2, 0))));
  yield s.wait(1.3);
}

function* grannyDuel(s) {
  const P = s.room.props;
  const G = P.granny;
  yield s.walk(3.0, -0.2);
  s.face('pip', 1);
  G.userData.duster.visible = true;
  s.tween(G, { z: -1.45 }, 0.3);
  s.game.audio.playMusic('party');
  const won = yield* tickleDuel(s, {
    opponent: 'granny',
    boasts: ['knees', 'cheetah', 'statue', 'shiver'],
    wrong: ['grandma', 'duck'],
    canLose: true,
    loseAt: 3,
    smug: 'adv.gran.smug',
    retorts: { duck: 'adv.gran.r.duck', grandma: 'adv.gran.r.grandma' },
    intro: [['granny', 'adv.gran.d.start1'], ['granny', 'adv.gran.d.start2'], ['pip', 'adv.gran.d.start3'], ['granny', 'adv.gran.d.start4']],
    onHit: (s2, n) => grannyHit(s2, n),
    onMiss: (s2, n) => pipTickled(s2, G, n, 1),
  });
  s.game.audio.playMusic('adventure');
  G.userData.duster.visible = false;
  s.tween(G, { z: -1.75 }, 0.3);
  if (won) {
    s.setFlag('gran.beaten');
    yield* s.lines([['granny', 'adv.gran.won1'], ['granny', 'adv.gran.won2']]);
    // A bowl of Never-Wobble Pudding slides across the counter
    const bowl = makePuddingBowl();
    bowl.scale.setScalar(0.55);
    bowl.position.set(4.9, 1.07, -0.95);
    s.room.group.add(bowl);
    s.sfx('whoosh');
    s.tween(bowl, { x: 3.3 }, 0.6, { ease: 'out' });
    yield s.wait(0.7);
    s.tween(bowl, { x: s.pip.position.x, y: 0.8, z: s.pip.position.z, s: 0.2 }, 0.35, { ease: 'in' });
    yield s.wait(0.4);
    s.room.group.remove(bowl);
    s.give('pudding');
    yield* s.lines([['granny', 'adv.gran.won3'], ['pip', 'adv.gran.won4'], ['granny', 'adv.gran.won5']]);
  } else {
    s.setFlag('gran.lost');
    s.setFlag('claw.knowPractice');
    const knowsAll = ['knees', 'statue', 'shiver'].every((b) => s.save.comebacks.includes(b));
    yield* s.lines([['granny', 'adv.gran.lost1'], ['granny', 'adv.gran.lost2'],
      ['granny', knowsAll ? 'adv.gran.lost3know' : 'adv.gran.lost3'], ['pip', knowsAll ? 'adv.gran.lost4know' : 'adv.gran.lost4']]);
  }
}

/** Order Wobbles "to go": he finally gets off the menu. */
function* orderWobbles(s) {
  const P = s.room.props;
  if (!s.has('coin')) {
    yield* s.lines([['pip', 'adv.gran.o.order'], ['granny', 'adv.gran.order1'], ['pip', 'adv.gran.p.order2'], ['granny', 'adv.gran.order3']]);
    return;
  }
  if (Math.hypot(s.pip.position.x - 3.0, s.pip.position.z + 0.2) > 0.3) yield s.walk(3.0, -0.2);
  s.face('pip', 1);
  yield s.say('pip', 'adv.gran.o.orderCoin');
  s.drop('coin');
  s.sfx('coin');
  yield s.say('granny', 'adv.gran.toGo1');
  // Up goes the dome
  s.sfx('lid');
  s.tween(P.dome, { y: P.dome.position.y + 1.1 }, 0.5, { ease: 'out' });
  yield s.wait(0.5);
  yield s.say('wob', 'adv.wob.free1');
  yield s.say('wob', 'adv.wob.free2');
  yield s.say('pip', 'adv.wob.free3');
  yield s.say('wob', 'adv.wob.free4');
  // Wobbles bounces off the counter and wobbles out of the door
  const W = P.wob;
  s.sfx('boing');
  s.tween(W, { x: 1.0, y: 1.6, z: -0.2 }, 0.35, { ease: 'out' });
  s.tween(W, { y: 0, x: 0.4 }, 0.35, { delay: 0.35, ease: 'in' });
  s.host.later(0.7, () => s.sfx('boing'));
  s.tween(W, { x: -2.0, z: 0.2 }, 0.9, { delay: 0.75 });
  s.tween(W, { x: -5.0, z: -1.6 }, 0.9, { delay: 1.65 });
  yield s.wait(1.2);
  s.setFlag('s2.wob');
  yield s.say('granny', 'adv.gran.toGo2');
  W.visible = false;
  s.tween(P.dome, { y: P.dome.position.y - 1.1 }, 0.4, { ease: 'in' });
  yield* checkDone(s);
}

const GRAN_TREE = {
  id: 'granny',
  start: 'main',
  nodes: {
    main: {
      intro: (s) => {
        if (!s.flag('gran.met')) return [['granny', 'adv.gran.hello'], (s2) => { s2.setFlag('gran.met'); }];
        return [['granny', s.flag('gran.beaten') ? 'adv.gran.againChamp' : 'adv.gran.again']];
      },
      options: [
        {
          id: 'who', text: 'adv.gran.o.who',
          lines: [['granny', 'adv.gran.who1'], ['pip', 'adv.gran.p.who2'], ['granny', 'adv.gran.who3'], ['granny', 'adv.gran.who4'], ['pip', 'adv.gran.p.who5']],
        },
        {
          id: 'hole', text: 'adv.gran.o.hole', when: (s) => !s.flag('gran.beaten'),
          lines: [['granny', 'adv.gran.hole1'], ['pip', 'adv.gran.p.hole2'], ['granny', 'adv.gran.hole3'], ['granny', 'adv.gran.hole4'], (s) => { s.setFlag('gran.knowDuel'); }],
        },
        { id: 'duel', text: 'adv.gran.o.duel', when: (s) => s.flag('gran.knowDuel') && !s.flag('gran.beaten'), end: true, run: grannyDuel },
        { id: 'order', text: 'adv.gran.o.order', when: (s) => !s.flag('s2.wob'), silent: true, run: orderWobbles },
        { id: 'sail', text: 'adv.gran.o.sail', when: (s) => !s.flag('s2.sail'), lines: [['granny', 'adv.gran.sail1'], ['granny', 'adv.gran.sail2']] },
        { id: 'scarf', text: 'adv.gran.o.scarf', lines: [['granny', 'adv.gran.scarf1'], ['pip', 'adv.gran.p.scarf2'], ['granny', 'adv.gran.scarf3']] },
        {
          id: 'crew', text: 'adv.gran.o.crew',
          lines: (s) => (s.flag('gran.beaten') ? [['granny', 'adv.gran.crewChamp']] : [['granny', 'adv.gran.crew1'], ['granny', 'adv.gran.crew2']]),
        },
        { id: 'bye', text: 'adv.dock.o.bye', end: true, lines: [['granny', 'adv.gran.bye']] },
      ],
    },
  },
};

const WOB_TREE = {
  id: 'wob',
  start: 'main',
  nodes: {
    main: {
      intro: (s) => {
        if (!s.flag('wob.met')) return [['wob', 'adv.wob.hello1'], ['pip', 'adv.wob.p.hello2'], ['wob', 'adv.wob.hello3'], (s2) => { s2.setFlag('wob.met'); }];
        return [['wob', 'adv.wob.again']];
      },
      options: [
        { id: 'what', text: 'adv.wob.o.what', lines: [['wob', 'adv.wob.what1'], ['wob', 'adv.wob.what2']] },
        { id: 'name', text: 'adv.wob.o.name', lines: [['wob', 'adv.wob.name1'], ['wob', 'adv.wob.name2']] },
        {
          id: 'crew', text: 'adv.wob.o.crew',
          lines: [['wob', 'adv.wob.crew1'], ['wob', 'adv.wob.crew2'], ['pip', 'adv.wob.p.crew3'], ['wob', 'adv.wob.crew4'], (s) => { s.setFlag('wob.toGo'); }],
        },
        { id: 'dome', text: 'adv.wob.o.dome', lines: [['wob', 'adv.wob.dome']] },
        { id: 'bye', text: 'adv.dock.o.bye', end: true, lines: [['wob', 'adv.wob.bye']] },
      ],
    },
  },
};

const parlor = {
  name: 'adv.room.parlor',
  sky: ['#86cdf5', '#fff3d6'],
  camera: { viewW: 13.4, viewH: 7.4, lookY: 1.75, pitch: 0.12, fov: 30 },
  entries: {
    start: { x: -4.9, z: -0.7, face: 1 },
    door: { x: -4.9, z: -0.7, face: 1 },
  },
  walk: [[-5.6, -1.15, 0.6, 1.5], [0.6, -0.25, 6.0, 1.5]],

  lights(s, L) {
    if (!L) return;
    L.hemi.color.set(0xfff0e0);
    L.hemi.groundColor.set(0xb89a9a);
    L.hemi.intensity = 1.45;
    L.sun.color.set(0xffe6c8);
    L.sun.intensity = 1.5;
  },

  build(s, g) {
    const P = {};
    // Back wall: striped wallpaper over wood panelling
    for (let i = 0; i < 30; i++) {
      g.add(mesh(boxG(0.6, 5.6, 0.1), toon(i % 2 ? 0xffd2e2 : 0xfff1e6), -11.7 + i * 0.6 + 0.3, 3.85, -2.35, false));
    }
    g.add(mesh(boxG(18, 1.1, 0.16), toon(0xc68a52), 0, 0.55, -2.3, false));
    g.add(mesh(boxG(18, 0.1, 0.22), toon(0x8f5f3a), 0, 1.12, -2.27, false));
    // Checkered floor
    for (let x = -9; x < 9; x++) {
      for (let z = -2; z < 7; z++) {
        const tile = mesh(boxG(1, 0.1, 1), toon((x + z) % 2 ? 0xf6e3c6 : 0xe7c39a), x + 0.5, -0.05, z + 0.5 - 0.3, false);
        tile.receiveShadow = true;
        g.add(tile);
      }
    }
    // The door out to the square (open, bright outside)
    g.add(mesh(boxG(1.5, 2.5, 0.12), toon(0x8f5f3a), -5.0, 1.25, -2.26, false));
    g.add(mesh(boxG(1.2, 2.25, 0.1), basic(0xd9f2ff), -5.0, 1.13, -2.2, false));
    const door = mesh(boxG(0.12, 2.2, 1.1), toon(0xa0704a), -5.55, 1.1, -1.7);
    door.rotation.y = 0.35;
    g.add(door);
    // A window with the sky
    g.add(mesh(boxG(1.4, 1.2, 0.1), toon(0xffffff), 6.3, 2.6, -2.26, false));
    g.add(mesh(boxG(1.2, 1.0, 0.1), basic(0xbfe6ff), 6.3, 2.6, -2.2, false));

    // Trophy shelves: fifty years of Tickle Fencing
    for (const y of [1.75, 2.65]) g.add(mesh(boxG(2.3, 0.08, 0.4), toon(0x8f5f3a), -2.9, y, -2.1));
    for (let i = 0; i < 10; i++) {
      const tr = makeTrophy(0.4 + (i % 3) * 0.12);
      tr.position.set(-3.85 + (i % 5) * 0.47, i < 5 ? 1.79 : 2.69, -2.05);
      g.add(tr);
    }
    // The very first trophy: a spoon with a ribbon
    g.add(mesh(cylG(0.03, 0.03, 0.5, 6), toon(0xd9a066), -1.95, 2.94, -2.05));
    const fb = mesh(sph(0.08, 8, 6), toon(0xd9a066), -1.95, 3.25, -2.05);
    fb.scale.set(1, 1.3, 0.5);
    g.add(fb, mesh(boxG(0.14, 0.14, 0.03), toon(0xff5d73), -1.95, 2.85, -2.0, false));

    // Portrait of baby Grumbleton
    g.add(mesh(boxG(1.05, 1.25, 0.08), toon(0xd4a52a), -0.55, 2.75, -2.24));
    P.portrait = new THREE.Mesh(sharedGeo('adv-portrait', () => new THREE.PlaneGeometry(0.85, 1.05)), decalMaterial(drawCanvas(256, 320, drawPortrait)));
    P.portrait.position.set(-0.55, 2.75, -2.19);
    g.add(P.portrait);

    // Menu chalkboard
    P.menu = new THREE.Mesh(sharedGeo('adv-menu', () => new THREE.PlaneGeometry(2.3, 1.6)), decalMaterial(drawCanvas(640, 448, drawMenu)));
    P.menu.position.set(1.45, 2.65, -2.22);
    g.add(P.menu);

    // Pudding shelf behind the counter
    for (const y of [2.15, 2.95]) g.add(mesh(boxG(2.4, 0.08, 0.4), toon(0x8f5f3a), 4.3, y, -2.1));
    const pudCols = [0xff6f91, 0xffe6a3, 0x8a5a3a, 0xb6e3a1, 0xa9b8ff, 0xffc49b, 0x6a4a8a, 0xff9fd0];
    pudCols.forEach((c, i) => {
      const mp = makeMiniPudding(c, i === 6 ? 0x2b2340 : undefined);
      mp.position.set(3.4 + (i % 4) * 0.6, i < 4 ? 2.19 : 2.99, -2.05);
      g.add(mp);
    });

    // The counter
    g.add(mesh(boxG(5.2, 1.0, 0.85), toon(0xffc0d6), 3.3, 0.5, -1.0));
    g.add(mesh(boxG(5.4, 0.1, 1.0), toon(0xfff1e6), 3.3, 1.03, -1.0));
    for (let i = 0; i < 9; i++) g.add(mesh(boxG(0.08, 0.9, 0.04), toon(0xffffff), 1.0 + i * 0.57, 0.5, -0.56, false));

    // Granny Grumbleton, on a step behind the counter
    P.granny = makeGranny();
    P.granny.position.set(4.0, 0.8, -1.75);
    g.add(mesh(cylG(0.45, 0.5, 0.8, 14), toon(0x8f5f3a), 4.0, 0.4, -1.8, false));
    g.add(P.granny);

    // Wobbles under his glass dome (until ordered to go)
    g.add(mesh(cylG(0.55, 0.5, 0.05, 20), toon(0xffffff), 1.65, 1.1, -0.95));
    P.wob = makeWobbles();
    P.wob.position.set(1.65, 1.12, -0.95);
    P.wob.visible = !s.flag('s2.wob');
    g.add(P.wob);
    P.dome = new THREE.Group();
    P.dome.position.set(1.65, 1.12, -0.95);
    P.dome.add(mesh(sharedGeo('adv-dome', () => new THREE.SphereGeometry(0.58, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2)), toon(0xdff6ff, { transparent: true, opacity: 0.3 }), 0, 0, 0, false));
    P.dome.add(mesh(sph(0.07, 8, 6), toon(0xd4a52a), 0, 0.6, 0, false));
    P.dome.add(mesh(boxG(0.05, 0.35, 0.02), basic(0xffffff), -0.3, 0.32, 0.45, false).rotateZ(0.5));
    g.add(P.dome);
    // Price tag
    const tag = mesh(boxG(0.28, 0.18, 0.02), toon(0xffffff), 2.15, 1.18, -0.5, false);
    tag.rotation.x = -0.3;
    g.add(tag, mesh(sph(0.04, 8, 6), toon(0xffd84a), 2.15, 1.18, -0.48, false));

    // The big pot of Never-Wobble Pudding
    const pot = new THREE.Group();
    pot.position.set(5.2, 1.08, -1.0);
    pot.add(mesh(cylG(0.45, 0.4, 0.6, 18), toon(0x5a5f78), 0, 0.3, 0));
    pot.add(mesh(cylG(0.42, 0.42, 0.04, 18), toon(0xbfae98), 0, 0.58, 0, false));
    for (const sx of [-1, 1]) pot.add(mesh(boxG(0.16, 0.06, 0.1), toon(0x3e4256), sx * 0.5, 0.45, 0));
    g.add(pot);
    P.potLabel = new THREE.Mesh(sharedGeo('adv-potLabel', () => new THREE.PlaneGeometry(0.7, 0.2)), decalMaterial(drawCanvas(320, 92, drawPotLabel)));
    P.potLabel.position.set(5.2, 1.4, -0.53);
    g.add(P.potLabel);

    // Granny's scarf: from her knitting, over the counter, across the floor and out of the door
    const path = new THREE.CatmullRomCurve3([
      new THREE.Vector3(3.7, 1.15, -0.55), new THREE.Vector3(3.3, 0.6, -0.45), new THREE.Vector3(2.8, 0.05, -0.15),
      new THREE.Vector3(1.0, 0.05, 0.25), new THREE.Vector3(-1.5, 0.05, 0.55), new THREE.Vector3(-3.4, 0.05, 0.1),
      new THREE.Vector3(-4.6, 0.05, -1.3), new THREE.Vector3(-5.0, 0.05, -2.3),
    ]);
    const stripes = [toon(0x7bd389), toon(0xffd84a), toon(0xff6fae)];
    for (let i = 0; i <= 90; i++) {
      const p = path.getPoint(i / 90);
      const bit = mesh(sph(0.13, 8, 6), stripes[Math.floor(i / 3) % 3], p.x, p.y + 0.03, p.z, false);
      bit.scale.set(1, 0.45, 1);
      g.add(bit);
    }

    addMine(s, P);
    P.next.steam = 0.5;
    return P;
  },

  relabel(s, P) {
    redrawDecal(P.menu.material, drawMenu);
    redrawDecal(P.potLabel.material, drawPotLabel);
  },

  actors(s, P) {
    return {
      gull: mineActor(s, P),
      granny: {
        name: 'adv.who.granny', css: GRAN_CSS, voice: { pitch: 1.25, rate: 0.82 },
        head: (v) => P.granny.localToWorld(v.set(0, 1.55, 0)),
        face: (dir) => s.tween(P.granny, { ry: dir < 0 ? -0.4 : 0.4 }, 0.2),
      },
      wob: { name: 'adv.who.wob', css: WOB_CSS, voice: { pitch: 0.75, rate: 1.15 }, head: (v) => P.wob.localToWorld(v.set(0, 0.95, 0)) },
      menu: { name: '', kind: 'note', css: '#c9a25a', voice: { pitch: 1.0, rate: 0.95 }, head: (v) => v.set(1.45, 3.4, -2.2) },
    };
  },

  self: SELF2,

  hotspots: [
    MINE_HS,
    {
      id: 'door', name: 'adv.par.door', kind: 'exit', box: [-5.0, 1.15, -2.2, 1.4, 2.4, 0.4], walk: [-5.0, -1.1], face: 0,
      look: 'adv.par.door.look', go: (s) => s.goRoom('square', 'parlor'),
    },
    {
      id: 'granny', name: 'adv.who.granny', kind: 'person', anchor: (s) => s.room.props.granny, box: [0, 1.0, 0, 1.4, 1.7, 1.0],
      walk: [3.0, -0.2], face: 1,
      look: 'adv.gran.look', talk: (s) => { s.face('granny', -1); return runDialog(s, GRAN_TREE); },
      take: 'adv.gran.take',
      useItem: {
        coin: orderWobbles,
        spoon: [['granny', 'adv.gran.spoon']],
        note: [['granny', 'adv.gran.note1'], ['granny', 'adv.gran.note2']],
        pants: [['granny', 'adv.gran.pants']],
        pudding: [['granny', 'adv.gran.pudding']],
        gull: [['gull', 'adv.dock.gull.mine'], ['granny', 'adv.gran.gull']],
      },
    },
    {
      id: 'wob', name: 'adv.par.wob', kind: 'person', when: (s) => !s.flag('s2.wob'), box: [1.65, 1.45, -0.95, 1.2, 0.9, 1.0],
      walk: [1.2, -0.2], face: 1,
      look: 'adv.wob.look', talk: (s) => runDialog(s, WOB_TREE),
      take: [['pip', 'adv.wob.take'], ['granny', 'adv.gran.ahem']],
      useItem: {
        coin: [['wob', 'adv.wob.coin']],
        spoon: [['wob', 'adv.wob.spoon']],
        pudding: [['wob', 'adv.wob.pudding']],
        note: [['wob', 'adv.wob.note']],
        pants: [['wob', 'adv.wob.pants']],
        gull: [['gull', 'adv.dock.gull.mine'], ['wob', 'adv.wob.gull']],
      },
    },
    {
      id: 'menu', name: 'adv.par.menu', kind: 'object', box: [1.45, 2.65, -2.2, 2.3, 1.6, 0.3], walk: [0.3, -0.9], face: 1,
      look: [['menu', 'adv.par.menu.n'], ['pip', 'adv.par.menu.p']], use: [['menu', 'adv.par.menu.n'], ['pip', 'adv.par.menu.p']],
      useItem: { coin: 'adv.par.menu.coin' },
    },
    {
      id: 'pot', name: 'adv.par.pot', kind: 'object', box: [5.2, 1.4, -1.0, 1.1, 0.9, 1.0], walk: [4.75, -0.2], face: 1,
      look: 'adv.par.pot.look',
      use: (s) => [['granny', s.flag('gran.beaten') ? 'adv.gran.potChamp' : 'adv.gran.potNo']],
      take: (s) => [['granny', s.flag('gran.beaten') ? 'adv.gran.potChamp' : 'adv.gran.potNo']],
      useItem: { spoon: (s) => [['granny', s.flag('gran.beaten') ? 'adv.gran.potChamp' : 'adv.gran.potNo']] },
    },
    {
      id: 'trophies', name: 'adv.par.trophies', kind: 'object', box: [-2.9, 2.3, -2.1, 2.4, 1.5, 0.5], walk: [-2.9, -1.1], face: 0,
      look: [['pip', 'adv.par.trophies.look'], ['pip', 'adv.par.trophies.look2']], take: [['granny', 'adv.gran.trophyNo']],
    },
    {
      id: 'portrait', name: 'adv.par.portrait', kind: 'object', box: [-0.55, 2.75, -2.2, 1.1, 1.3, 0.3], walk: [-0.55, -1.1], face: 0,
      look: 'adv.par.portrait.look', take: [['granny', 'adv.gran.portraitNo']],
    },
    {
      id: 'shelf', name: 'adv.par.shelf', kind: 'object', box: [4.3, 2.6, -2.1, 2.5, 1.2, 0.5], walk: [4.3, -0.2], face: 0,
      look: 'adv.par.shelf.look', take: 'adv.par.shelf.take',
    },
    {
      id: 'scarf', name: 'adv.par.scarf', kind: 'object', box: [-1.2, 0.08, 0.35, 5.5, 0.3, 0.7], priority: -1,
      walk: (s) => s.clampWalk(s.pip.position.x, 0.9), face: 0,
      look: 'adv.par.scarf.look', take: 'adv.par.scarf.take', use: 'adv.par.scarf.take',
    },
  ],

  update(s, dt, P) {
    const tm = s.room.time;
    const G = P.granny;
    const talk = s.isTalking('granny');
    if (!s.tweens.some((tw) => tw.obj === G)) G.rotation.z = Math.sin(tm * 1.5) * 0.02;
    const inner = G.userData.inner;
    inner.scale.set(1.45, 1.45 * (1 + (talk ? Math.abs(Math.sin(tm * 14)) * 0.05 : Math.sin(tm * 2) * 0.015)), 1.45);
    // Knitting needles click
    const k = G.userData.knit;
    if (!s.tweens.some((tw) => tw.obj === k)) k.rotation.z = Math.sin(tm * 9) * 0.12;
    if (P.wob.visible) wobble(s, P.wob, tm);
    if ((P.next.steam -= dt) <= 0) {
      P.next.steam = 0.9 + Math.random() * 0.8;
      s.host.puffs.burst(new THREE.Vector3(5.2 + (Math.random() - 0.5) * 0.4, 1.8, -1.0), 0xfff6ee, { count: 2, size: 0.22, life: 1.0, speed: 0.8 });
    }
    animateGull(s, dt, P);
  },
};

export const SCENE2_ROOMS = { deck, square, parlor };

// ---------- the dock in scene 2 (rooms.js calls these) ----------

/** Underpants instead of the old sail, crew on board, risen once the hole is plugged. */
function dockBuild(s, P) {
  const ship = P.ship;
  if (s.flag('s2.hole')) {
    ship.position.y = -0.35;
    ship.rotation.z = 0;
    P.gang.rotation.z = 0.32;
  }
  if (s.flag('s2.sailGone')) for (const o of ship.userData.sailParts) o.visible = false;
  if (s.flag('s2.sail')) {
    const pants = makeUnderpants();
    pants.position.set(0.4, 4.55, 0.25);
    pants.scale.setScalar(1.55);
    ship.add(pants);
    P.shipPants = pants;
  }
  if (s.flag('s2.wob')) {
    const w = makeWobbles();
    w.position.set(1.0, 1.06, 0.45);
    ship.add(w);
    P.shipWob = w;
  }
  if (s.flag('s2.claw')) {
    const c = makeClawdia();
    c.position.set(2.0, 1.06, 0.5);
    c.userData.hat.visible = true;
    ship.add(c);
    P.shipClaw = c;
  }
  if (s.sailing) {
    // The ending: Pip rides on deck, and the ship is still tied to the dock
    P.riding = new THREE.Vector3(-1.0, 1.08, 0.4);
    P.moor = mesh(cylG(0.03, 0.03, 1, 5), toon(0xe2c98e), 0, 0, 0, false);
    s.room.group.add(P.moor);
  }
}

function dockUpdate(s, dt, P) {
  const tm = s.room.time;
  if (P.shipPants) {
    const b = P.shipPants.userData.body;
    b.rotation.x = Math.sin(tm * 1.7) * 0.08;
    b.scale.z = 1 + Math.sin(tm * 2.1) * 0.3;
  }
  if (P.shipWob) wobble(s, P.shipWob, tm);
  if (P.shipClaw) clawIdle(s, P.shipClaw, tm);
  if (P.riding) {
    s.pip.position.copy(P.ship.localToWorld(P.riding.clone()));
    if (P.moor?.visible) {
      const a = new THREE.Vector3(2.4, 0.55, -1.6);
      const b = P.ship.localToWorld(new THREE.Vector3(-2.9, 1.1, 0.95));
      const d = b.clone().sub(a);
      P.moor.position.copy(a).add(b).multiplyScalar(0.5);
      P.moor.scale.set(1, d.length(), 1);
      P.moor.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    }
  }
}

function* dockBoard(s) {
  yield s.walk(2.6, -0.35);
  yield s.goRoom('deck', 'gang');
  if (allDone(s) && !s.save.done2) yield* ending(s, false);
}

function* dockTown(s) {
  if (!s.flag('s2.townOpen')) {
    s.setFlag('s2.townOpen');
    yield s.say('pip', 'adv.s2.townOpen');
  }
  yield s.goRoom('square', 'dock');
  if (!s.flag('sq.seen')) {
    s.setFlag('sq.seen');
    yield s.walk(-4.6, 0.9);
    yield s.say('pip', 'adv.sq.arrive1');
    yield s.say('pip', 'adv.sq.arrive2');
  }
}

export const DOCK2 = {
  build: dockBuild,
  update: dockUpdate,
  board: dockBoard,
  town: dockTown,
  talkGrum: talkGrum2,
  grumItems: GRUM2_ITEMS,
  shipLook: (s) => (s.flag('s2.hole') ? 'adv.s2.dockShipFixed' : 'adv.dock.ship.lookAfter'),
  shipItems: { pudding: 'adv.s2.dockShipPudding', pants: 'adv.s2.dockShipPants' },
  townLook: 'adv.s2.townLook',
};

// ---------- start of scene 2 ----------

/** Captain's log, day two (also what Continue does after scene 1). */
function* intro2(s) {
  const P = s.room.props;
  s.face('pip', 0);
  yield s.wait(0.6);
  yield s.say('narr', 'adv.s2.intro1');
  yield s.say('pip', 'adv.s2.intro2');
  // The soggy sail gives up and slides into the sea like a tired noodle
  s.sfx('creak');
  s.tween(P.droop, { y: 2.0, sy: 1.6, rz: 0.2 }, 0.9, { ease: 'in' });
  s.tween(P.droop, { x: 4.4, y: 0.4, z: 2.6, rx: -1.2, rz: 0.4 }, 0.8, { delay: 0.9, ease: 'in' });
  yield s.wait(1.7);
  s.sfx('splash');
  s.host.puffs.burst(new THREE.Vector3(4.6, SEA + 0.1, 2.95), 0xffffff, { count: 24, size: 0.45, life: 0.8, speed: 3.5 });
  P.droop.visible = false;
  P.oldSail.visible = true;
  s.setFlag('s2.sailGone');
  s.face('pip', 1);
  yield s.say('narr', 'adv.s2.intro3');
  yield s.say('pip', 'adv.s2.intro4');
  yield s.say('grum', 'adv.s2.intro5');
  s.face('pip', -1);
  yield* s.lines([
    ['pip', 'adv.s2.intro6'], ['grum', 'adv.s2.intro7'], ['grum', 'adv.s2.intro8'], ['pip', 'adv.s2.intro9'],
    ['grum', 'adv.s2.intro10'], ['grum', 'adv.s2.intro11'], ['pip', 'adv.s2.intro12'], ['gull', 'adv.dock.gull.mine'], ['pip', 'adv.s2.intro13'],
  ]);
  s.hint('adv.s2.goal', 12);
}

/** Continue after scene 1: move the save on to scene 2 and play the intro. */
export function startScene2(s) {
  const sv = s.save;
  sv.scene = 2;
  Object.assign(sv.flags, { barrelOpen: true, gullOnHead: true, hatSeen: true, duelWon: true, knowRules: true, metGrum: true });
  for (const c of ['cheetah', 'whale', 'laugh']) if (!sv.comebacks.includes(c)) sv.comebacks.push(c);
  sv.inventory = ['spoon', 'note', 'gull'];
  sv.pos = null;
  s.loadRoom('deck', 'intro');
  s.persist();
  s.run(intro2);
}

// ---------- the ending ----------

function* ending(s, replay) {
  const P = s.room.props;
  if (Math.hypot(s.pip.position.x + 1.25, s.pip.position.z + 0.6) > 0.2) yield s.walk(-1.25, -0.6);
  s.face('pip', -1);
  if (!replay) yield s.say('grum', 'adv.end2.grum');
  yield s.say('pip', 'adv.end2.p1');
  yield s.say('wob', 'adv.end2.w1');
  yield s.say('claw', 'adv.end2.c1');
  yield s.say('pip', 'adv.end2.p2');
  yield s.say('claw', 'adv.end2.c2');
  yield s.say('pip', 'adv.end2.p3');
  yield s.say('claw', 'adv.end2.c3');
  s.pipChar.squash(1.3);
  yield s.say('pip', 'adv.end2.p4');
  s.sfx('creak');
  s.tween(P.wheel.userData.wheel, { rz: P.wheel.userData.wheel.rotation.z - 6 }, 1.4, { ease: 'out' });
  yield s.say('gull', 'adv.dock.gull.mine');
  // Cut to the dock: watch The Soggy Biscuit leave
  s.sailing = true;
  yield s.goRoom('dock', 'sail');
  s.sailing = false;
  const D = s.room.props;
  s.face('pip', 1);
  s.game.audio.playMusic('party');
  yield s.wait(0.5);
  yield s.say('grum', 'adv.end2.g1');
  // Off she goes... and stops with a BOING: still tied to the dock
  s.tween(D.ship, { z: -3.1 }, 0.55, { ease: 'in' });
  yield s.wait(0.55);
  s.sfx('boing');
  s.tween(D.ship, { z: -2.2 }, 0.5, { ease: 'back' });
  s.pipChar.squash(0.6);
  yield s.wait(0.5);
  yield s.say('narr', 'adv.end2.tied');
  yield s.say('claw', 'adv.end2.c4');
  s.sfx('snip');
  D.moor.visible = false;
  s.host.puffs.burst(new THREE.Vector3(3.2, 0.8, -1.4), 0xffffff, { count: 8, size: 0.2, life: 0.5, speed: 1.5 });
  // Sideways, slowly, in underpants
  const sailStart = s.time;
  s.tween(D.ship, { z: -16, x: 5.0, ry: -0.2 }, 7, { ease: 'inOut' });
  yield s.wait(1.0);
  yield s.say('grum', 'adv.end2.g2');
  yield s.say('pip', 'adv.end2.log');
  yield s.say('gull', 'adv.dock.gull.mine');
  const left = 6 - (s.time - sailStart);
  if (left > 0) yield s.wait(left);
  s.game.audio.playMusic('adventure');
  yield s.toBeContinued();
}
