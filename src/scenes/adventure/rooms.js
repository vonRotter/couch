import * as THREE from 'three';
import { t } from '../../core/i18n.js';
import { toon, basic, sharedGeo } from '../../core/palette.js';
import { seeded, makeCloud } from '../../core/world.js';
import {
  mesh, boxG, cylG, coneG, makeBarrel, drawBarrelLabel, makeSeagull, makeGrumbleton, makeShip, makeDuck, makeNote,
  makePinkCloud, makeIsland, makePalm, decalMaterial, drawCanvas, redrawDecal, fitText, WOOD, WOOD_DARK,
} from './props.js';
import { runDialog } from './dialog.js';
import { tickleDuel } from './duel.js';
import { putGullOnHead, animateGull, GRUM_CSS, GULL_CSS } from './shared.js';
import { SCENE2_ROOMS, DOCK2, SELF_ITEMS, isS2 } from './scene2.js';

// The rooms of The Secret of Pudding Island. Each room is data plus little generator scripts:
//
//   build(s, group) -> props        make the diorama (side-on stage, x left/right, z toward camera)
//   camera { viewW, lookY, pitch }  framing; walk: [[x0, z0, x1, z1], ...] (or (s) => rects)
//   entries { start: { x, z, face } }
//   actors(s, props)                speakers: { name, css, voice: { pitch, rate }, head(v), face(dir) }
//   hotspots: [{ id, name, kind: person|item|object|exit, box: [cx, cy, cz, w, h, d], anchor,
//                walk: [x, z] | (s) => [x, z] | null, face, when(s), priority,
//                look / talk / take / use / go: key | lines | script,  useItem: { itemId: ... } }]
//   update(s, dt, props)            idle animation;  relabel(s, props) redraws signs on language change
//
// To add a room: write another entry like `dock`, give a hotspot `kind: 'exit', to: 'roomId',
// entry: 'entryName'` (or yield s.goRoom('roomId', 'entry') from a script), and keep puzzle state
// in s.flag()/s.setFlag() so build() can restore it after a reload.
//
// Scene 2's rooms live in scene2.js; the dock asks DOCK2 (scene2.js) what to do once scene 2 is on
// (the gangway leads aboard, the town is open, Grumbleton has new things to say).

export const START_ROOM = 'dock';

const SEA_Y = -0.35;

// ---------- signs (redrawn when the language changes) ----------

function drawShipSign(g, w, h) {
  g.fillStyle = '#f6e2b8';
  g.fillRect(0, 0, w, h);
  g.strokeStyle = '#8f5f3a';
  g.lineWidth = 14;
  g.strokeRect(7, 7, w - 14, h - 14);
  g.fillStyle = '#5a3f8a';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  fitText(g, t('adv.dock.shipName'), w / 2, h / 2 + 4, w - 60, 86);
}

function drawTownSign(g, w, h) {
  g.fillStyle = '#e8c48e';
  g.beginPath();
  g.moveTo(0, h / 2); g.lineTo(h * 0.45, 0); g.lineTo(w, 0); g.lineTo(w, h); g.lineTo(h * 0.45, h);
  g.closePath();
  g.fill();
  g.fillStyle = '#5a3f2a';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  fitText(g, t('adv.dock.townSign'), w * 0.58, h / 2 + 3, w * 0.7, 80);
}

function drawCrate(g, w, h) {
  g.fillStyle = '#7a4a2e';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  fitText(g, t('adv.dock.crateText'), w / 2, h / 2, w - 30, 60);
}

function barrelLabel(g, w, h) {
  drawBarrelLabel(g, w, h, t('adv.dock.barrelText'), t('adv.dock.barrelBig'));
}

// ---------- scene 1 scripts ----------

/** Grumbleton reacts to a good comeback; the third one sends him into the harbor. */
function* grumHit(s, n) {
  const P = s.room.props;
  const inner = P.grum.userData.inner;
  s.sfx(n === 3 ? 'bigGiggle' : 'giggle');
  s.float(t(n === 3 ? 'adv.fx.haha' : 'adv.fx.hee'), P.grum.position.clone().add(new THREE.Vector3(0.3, 1.9, 0)));
  s.tween(inner, { rz: 0.25 }, 0.12);
  s.tween(inner, { rz: -0.2 }, 0.15, { delay: 0.12 });
  s.tween(inner, { rz: 0 }, 0.15, { delay: 0.27 });
  yield s.say('grum', `adv.duel.hit.${n}`);
  if (n < 3) return;
  // He collapses giggling and rolls off the dock into the harbor.
  P.grum.userData.feather.visible = false;
  s.tween(P.grum, { rz: -1.4, y: 0.35 }, 0.4, { ease: 'out' });
  s.tween(P.grum, { x: 2.0, z: 2.6 }, 0.9, { delay: 0.4, ease: 'in' });
  s.tween(P.grum, { rz: -1.4 - Math.PI * 2 }, 0.9, { delay: 0.4, ease: 'linear' });
  yield s.wait(1.3);
  s.tween(P.grum, { y: SEA_Y - 0.9, z: 3.1 }, 0.35, { ease: 'in' });
  yield s.wait(0.35);
  s.sfx('splash');
  s.host.puffs.burst(new THREE.Vector3(2.0, SEA_Y + 0.1, 3.1), 0xffffff, { count: 30, size: 0.5, life: 0.9, speed: 4 });
  s.setFlag('duelWon');
  placeGrumInWater(P.grum);
  P.grum.position.y = SEA_Y - 1.2;
  s.tween(P.grum, { y: SEA_Y - 0.55 }, 0.6, { ease: 'out' });
  yield s.wait(0.7);
}

/** Grumbleton tickles Pip after a wrong comeback. Pip giggles; nothing else happens. */
function* pipTickled(s, n) {
  const P = s.room.props;
  const gx = P.grum.position.x;
  s.tween(P.grum, { x: gx - 0.5 }, 0.15, { ease: 'out' });
  s.tween(P.grum, { x: gx }, 0.3, { delay: 0.3 });
  s.sfx('tickle');
  s.pipChar.squash(0.7);
  s.tween(s.pip, { rz: 0.25 }, 0.1, { delay: 0.1 });
  s.tween(s.pip, { rz: -0.2 }, 0.12, { delay: 0.2 });
  s.tween(s.pip, { rz: 0 }, 0.15, { delay: 0.32 });
  s.float(t('adv.fx.heehee'), s.pipHead());
  s.sfx('giggle');
  yield s.say('pip', `adv.duel.pipGiggle.${Math.min(3, n)}`);
}

function placeGrumInWater(grum) {
  grum.position.set(2.0, SEA_Y - 0.55, 3.1);
  grum.rotation.set(0, -0.3, 0.6);
  grum.userData.feather.visible = false;
}

function* duelAndEnding(s) {
  const P = s.room.props;
  yield s.walk(0.35, 0.0);
  s.face('pip', 1);
  s.face('grum', -1);
  P.grum.userData.feather.visible = true;
  s.game.audio.playMusic('party');
  yield* tickleDuel(s, {
    opponent: 'grum',
    boasts: ['cheetah', 'whale', 'laugh'],
    wrong: ['duck', 'rubber', 'snack'],
    learn: true,
    intro: [['grum', 'adv.duel.start1'], ['pip', 'adv.duel.start2'], ['grum', 'adv.duel.start3']],
    onHit: (s2, n) => grumHit(s2, n),
    onMiss: (s2, n) => pipTickled(s2, n),
    afterWrong: { duck: (s2) => (s2.flag('gullOnHead') ? [['gull', 'adv.dock.gull.mine']] : null) },
  });
  s.game.audio.playMusic('adventure');
  yield* ending(s, false);
}

/** "Captain's log, day one." Also replayed when boarding again after scene 1 is done. */
function* ending(s, replay) {
  const P = s.room.props;
  if (!replay) {
    yield s.say('grum', 'adv.end.1');
    s.sfx('gurgle');
    s.tween(P.ship, { y: P.ship.position.y - 0.25, rz: P.ship.rotation.z - 0.04 }, 1.6);
    for (let i = 0; i < 4; i++) s.host.later(i * 0.3, () => s.host.puffs.burst(new THREE.Vector3(5 + Math.random() * 3, SEA_Y + 0.1, -0.7), 0xdff3ff, { count: 6, size: 0.3, life: 0.8, speed: 1.5 }));
    yield s.say('narr', 'adv.end.gurgle');
  }
  // Down the gangway (it goes DOWN to the ship)
  yield s.walk(2.75, -0.35, true);
  s.tween(s.pip, { y: -0.12 }, 0.5);
  yield s.walk(4.3, -0.35, true);
  s.face('pip', 0);
  if (replay) yield s.say('pip', 'adv.end.replay');
  else yield s.say('pip', 'adv.end.2');
  yield s.say('gull', 'adv.dock.gull.mine');
  s.save.done = true;
  s.persist();
  yield s.toBeContinued();
}

const GRUM_TREE = {
  id: 'grum',
  start: (s) => (s.flag('hatSeen') ? 'rematch' : s.flag('gullOnHead') ? 'hat' : 'main'),
  nodes: {
    main: {
      intro: (s) => {
        if (s.flag('metGrum')) return [['grum', 'adv.dock.grum.again']];
        return [['grum', 'adv.dock.grum.halt'], (s2) => { s2.setFlag('metGrum'); }];
      },
      options: [
        {
          id: 'real', text: 'adv.dock.o.real',
          lines: (s) => [['grum', s.pipChar.hat.children.length ? 'adv.dock.g.real1hat' : 'adv.dock.g.real1'], ['pip', 'adv.dock.p.real2'], ['grum', 'adv.dock.g.real3']],
        },
        {
          id: 'what', text: 'adv.dock.o.what',
          lines: [
            ['grum', 'adv.dock.g.what1'], ['pip', 'adv.dock.p.what2'], ['grum', 'adv.dock.g.what3'],
            ['pip', 'adv.dock.p.what4'], ['grum', 'adv.dock.g.what5'],
            (s) => {
              s.sfx('giggle');
              s.float(t('adv.fx.giggle3'), new THREE.Vector3(-1.4, -0.1, 2.2));
              s.setFlag('knowRules');
            },
            ['narr', 'adv.dock.giggle'],
          ],
        },
        { id: 'sink', text: 'adv.dock.o.sinking', lines: [['grum', 'adv.dock.g.sink1'], ['pip', 'adv.dock.p.sink2'], ['grum', 'adv.dock.g.sink3']] },
        { id: 'uni', text: 'adv.dock.o.uniform', lines: [['grum', 'adv.dock.g.uni1'], ['pip', 'adv.dock.p.uni2'], ['grum', 'adv.dock.g.uni3']] },
        { id: 'duel', text: 'adv.dock.o.duel', when: (s) => s.flag('knowRules'), lines: [['grum', 'adv.dock.g.duelNo']] },
        { id: 'bye', text: 'adv.dock.o.bye', end: true, lines: [['grum', 'adv.dock.g.bye']] },
      ],
    },
    // Pip comes back with the seagull on the head: hat AND pet.
    hat: {
      intro: function* hat(s) {
        yield* s.lines([
          ['grum', 'adv.dock.g.hat1'], ['pip', 'adv.dock.p.hat2'], ['gull', 'adv.dock.gull.mine'],
          ['grum', 'adv.dock.g.hat3'], ['grum', 'adv.dock.g.hat4'], ['pip', 'adv.dock.p.hat5'], ['grum', 'adv.dock.g.hat6'],
        ]);
        s.setFlag('hatSeen');
        yield* duelAndEnding(s);
        s.dialogBreak = true;
      },
    },
    rematch: {
      intro: function* rematch(s) {
        yield s.say('grum', 'adv.dock.g.rematch');
        yield* duelAndEnding(s);
        s.dialogBreak = true;
      },
    },
  },
};

function talkGrum(s) {
  if (isS2(s)) return DOCK2.talkGrum(s);
  if (s.flag('duelWon')) return [['grum', 'adv.dock.g.water']];
  s.face('grum', -1);
  return runDialog(s, GRUM_TREE);
}

function* boardShip(s) {
  if (isS2(s)) {
    yield* DOCK2.board(s);
    return;
  }
  if (s.flag('duelWon')) {
    yield* ending(s, true);
    return;
  }
  s.face('grum', -1);
  yield s.say('grum', 'adv.dock.g.block');
}

function* openBarrel(s) {
  const P = s.room.props;
  if (s.flag('barrelOpen')) {
    yield s.say('pip', 'adv.dock.barrel.empty');
    return;
  }
  const b = P.barrel.position;
  s.sfx('lid');
  s.tween(P.barrel.userData.lid, { rz: 2.5 }, 0.45, { ease: 'back' });
  // Out pops a rubber duck, then a note
  const duck = makeDuck();
  duck.scale.setScalar(0.9);
  duck.position.set(b.x, 0.8, b.z);
  duck.rotation.y = -0.6;
  const note = makeNote();
  note.scale.setScalar(0.7);
  note.position.set(b.x + 0.1, 0.8, b.z);
  s.room.group.add(duck, note);
  s.tween(duck, { y: 1.9 }, 0.4, { ease: 'out', delay: 0.2 });
  s.tween(note, { y: 1.55, x: b.x + 0.55, rz: -0.3 }, 0.5, { ease: 'out', delay: 0.4 });
  s.host.later(0.3, () => s.sfx('squeak'));
  yield s.wait(0.7);
  yield s.say('narr', 'adv.dock.barrel.open');
  yield s.say('note', 'adv.dock.note');
  // Into Pip's pockets
  const p = s.pip.position;
  s.tween(duck, { x: p.x, y: 0.8, z: p.z, s: 0.2 }, 0.35, { ease: 'in' });
  s.tween(note, { x: p.x, y: 0.8, z: p.z, s: 0.2 }, 0.35, { ease: 'in', delay: 0.1 });
  yield s.wait(0.5);
  s.room.group.remove(duck, note);
  s.give('duck');
  s.give('note');
  s.setFlag('barrelOpen');
  s.pipChar.squash(1.35);
  yield s.say('pip', 'adv.dock.freeDuck');
}

/** Duck on seagull: they look at each other, and she hops onto Pip's head. */
function* duckOnGull(s) {
  const P = s.room.props;
  const gull = P.gull;
  const start = s.time;
  s.drop('duck');
  s.face('pip', 1);
  // Pip holds the duck out
  const duck = makeDuck();
  duck.scale.setScalar(0.7);
  const p = s.pip.position;
  duck.position.set(p.x + 0.55, 0.65, p.z + 0.15);
  duck.rotation.y = 0.2;
  s.room.group.add(duck);
  s.sfx('squeak');
  // The seagull looks at the duck. The duck looks at the seagull.
  s.tween(gull.userData.head, { rz: -0.5 }, 0.5, { delay: 0.6 });
  s.tween(duck, { ry: -0.9, y: 0.75 }, 0.5, { delay: 1.6 });
  s.tween(gull.userData.head, { rz: 0 }, 0.4, { delay: 2.8 });
  // Something passes between them... and she hops onto Pip's head.
  const head = s.pipHead();
  s.tween(gull, { x: (gull.position.x + head.x) / 2, y: head.y + 1.0, z: (gull.position.z + head.z) / 2 }, 0.35, { delay: 3.4, ease: 'out' });
  s.tween(gull, { x: head.x, y: head.y - 0.2, z: head.z }, 0.3, { delay: 3.75, ease: 'in' });
  s.tween(duck, { x: head.x + 0.1, y: head.y - 0.1, z: head.z + 0.1, s: 0.4 }, 0.5, { delay: 3.7 });
  yield s.say('narr', 'adv.dock.duckGull');
  const left = 4.15 - (s.time - start);
  if (left > 0) yield s.wait(left);
  s.room.group.remove(duck);
  putGullOnHead(s, P);
  s.setFlag('gullOnHead');
  s.pipChar.squash(0.75);
  s.sfx('boing');
  yield s.say('gull', 'adv.dock.gull.ours');
  yield s.say('pip', 'adv.dock.p.havePet');
}

// ---------- the dock ----------

const dock = {
  name: 'adv.room.dock',
  // Sunset in scene 1; the next morning in scene 2
  sky: (s) => (isS2(s) ? ['#7cc6f2', '#fff0d0'] : ['#6f5fd0', '#ffb877']),
  camera: { viewW: 14.8, viewH: 7.8, lookY: 1.45, pitch: 0.2, fov: 30 },
  entries: {
    start: { x: -2.3, z: 0.4, face: 1 }, intro: { x: -2.3, z: 0.4, face: 1 },
    // Scene 2: back from the ship, back from town, and the ending (Pip rides the ship)
    ship: { x: 2.2, z: -0.25, face: -1 }, town: { x: -5.4, z: 0.8, face: 1 }, sail: { x: 2.2, z: -0.25, face: 1 },
  },
  walk: (s) => {
    const r = [[-5.8, -0.95, 1.35, 1.45]];
    if (s.flag('duelWon')) r.push([1.35, -0.7, 2.8, 0.2]);
    return r;
  },

  lights(s, L) {
    if (!L) return;
    const morning = isS2(s);
    L.hemi.color.set(morning ? 0xfff6e8 : 0xffe2cc);
    L.hemi.groundColor.set(morning ? 0x8a90b8 : 0x7a6aa8);
    L.hemi.intensity = morning ? 1.5 : 1.45;
    L.sun.color.set(morning ? 0xfff1d6 : 0xffd2a6);
    L.sun.intensity = morning ? 1.9 : 1.75;
  },

  build(s, g) {
    const P = {};
    const rand = seeded(7);
    const morning = isS2(s);

    // Sea, sun and far islands
    const sea = mesh(sharedGeo('adv-sea', () => new THREE.PlaneGeometry(240, 140)), toon(morning ? 0x4f9be0 : 0x5b86d6), 0, SEA_Y, -50, false);
    sea.rotation.x = -Math.PI / 2;
    sea.receiveShadow = true;
    g.add(sea);
    const sun = new THREE.Mesh(sharedGeo('adv-sun', () => new THREE.CircleGeometry(5, 40)), basic(morning ? 0xfff3b0 : 0xffd46b));
    const halo = new THREE.Mesh(sharedGeo('adv-halo', () => new THREE.CircleGeometry(7.5, 40)), basic(morning ? 0xffffff : 0xffe6a0, { transparent: true, opacity: 0.35 }));
    if (morning) {
      sun.position.set(16, 22, -95);
      halo.position.set(16, 22, -96);
      sun.scale.setScalar(0.8);
    } else {
      sun.position.set(-6, 1.4, -95);
      halo.position.set(-6, 1.4, -96);
    }
    g.add(sun, halo);
    P.glints = [];
    for (let i = 0; i < 26; i++) {
      const gl = mesh(boxG(1, 0.02, 0.12), basic(i % 3 ? 0xffe9b0 : 0xffffff), 0, SEA_Y + 0.01, 0, false);
      gl.userData = { x: -12 + rand() * 30, z: -40 + rand() * 42, sp: 0.2 + rand() * 0.4, w: 0.5 + rand() * 1.4 };
      gl.scale.x = gl.userData.w;
      g.add(gl);
      P.glints.push(gl);
    }
    for (const [x, z, w, h, c, cm] of [[-24, -70, 9, 3.4, 0x6a5a9a, 0x7fae9a], [-13, -60, 5, 2, 0x7a68aa, 0x8fbfa8], [20, -75, 12, 4.2, 0x6a5a9a, 0x7fae9a], [9, -55, 4, 1.5, 0x8573b5, 0x9fcfb8]]) {
      const isl = makeIsland(morning ? cm : c, w, h);
      isl.position.set(x, SEA_Y, z);
      g.add(isl);
    }
    const palm = makePalm(morning ? 0x5f8f7a : 0x5a4a8a);
    palm.position.set(-22.5, SEA_Y + 2.6, -69);
    palm.scale.setScalar(1.3);
    g.add(palm);
    P.clouds = [];
    for (const [x, y, z, sc] of [[-14, 9.5, -45, 2], [6, 11, -60, 2.6], [18, 8.2, -40, 1.6], [-2, 7.4, -35, 1.2]]) {
      const c = morning ? makeCloud(rand, sc) : makePinkCloud(rand, sc);
      c.position.set(x, y, z);
      g.add(c);
      P.clouds.push(c);
    }

    // The dock: planks running toward the camera, posts into the water
    const plankCols = [0xb07a4a, 0xa36f43, 0xbb8552, 0xa8764a];
    for (let x = -10.2, i = 0; x < 2.95; x += 0.56, i++) {
      const pl = mesh(boxG(0.52, 0.2, 3.85), toon(plankCols[i % 4]), x, -0.1, 0.2, false);
      pl.receiveShadow = true;
      g.add(pl);
    }
    g.add(mesh(boxG(13.4, 0.26, 0.26), toon(WOOD_DARK), -3.6, -0.2, 2.15, false));
    for (let x = -9; x <= 3; x += 2) {
      g.add(mesh(cylG(0.17, 0.17, 1.6, 10), toon(WOOD_DARK), x, -0.85, 2.15, false));
      g.add(mesh(cylG(0.17, 0.17, 1.6, 10), toon(WOOD_DARK), x, -0.85, -1.7, false));
    }
    // Mooring post with the seagull on it
    const post = mesh(cylG(0.18, 0.2, 1.25, 12), toon(WOOD), -0.6, 0.42, 1.85);
    g.add(post, mesh(cylG(0.21, 0.21, 0.08, 12), toon(WOOD_DARK), -0.6, 1.05, 1.85));
    const wrap = mesh(sharedGeo('adv-wrap', () => new THREE.TorusGeometry(0.2, 0.05, 6, 14)), toon(0xe8d5a8), -0.6, 0.55, 1.85);
    wrap.rotation.x = Math.PI / 2;
    g.add(wrap);
    g.add(mesh(cylG(0.16, 0.18, 0.7, 12), toon(WOOD), -4.9, 0.2, 1.85));

    // Barrel
    P.barrel = makeBarrel();
    P.barrel.position.set(-3.9, 0, -0.75);
    P.barrel.rotation.y = 0.15;
    redrawDecal(P.barrel.userData.label.material, barrelLabel);
    if (s.flag('barrelOpen')) P.barrel.userData.lid.rotation.z = 2.5;
    g.add(P.barrel);

    // Crates of soggy ship biscuits
    const crateMat = toon(0xc99a62);
    for (const [x, y, z, r] of [[-5.95, 0.4, -1.15, 0.05], [-5.05, 0.4, -1.25, -0.08], [-5.55, 1.2, -1.2, 0.12]]) {
      const c = mesh(boxG(0.8, 0.8, 0.8), crateMat, x, y, z);
      c.rotation.y = r;
      for (const sy of [-0.36, 0.36]) c.add(mesh(boxG(0.84, 0.08, 0.84), toon(WOOD_DARK), 0, sy, 0, false));
      g.add(c);
    }
    P.crateLabel = new THREE.Mesh(sharedGeo('adv-crateLbl', () => new THREE.PlaneGeometry(0.72, 0.36)), decalMaterial(drawCanvas(256, 128, drawCrate)));
    P.crateLabel.position.set(-5.93, 0.42, -0.74);
    P.crateLabel.rotation.y = 0.05;
    g.add(P.crateLabel);

    // Rope coil
    for (let i = 0; i < 3; i++) {
      const r = mesh(sharedGeo('adv-coil', () => new THREE.TorusGeometry(0.32, 0.07, 6, 18)), toon(0xe2c98e), -2.6, 0.07 + i * 0.12, 1.6);
      r.rotation.x = Math.PI / 2;
      r.scale.setScalar(1 - i * 0.12);
      g.add(r);
    }

    // Lantern post
    g.add(mesh(cylG(0.06, 0.08, 2.5, 8), toon(0x4a3f5a), 0.5, 1.25, -1.45));
    g.add(mesh(boxG(0.5, 0.06, 0.06), toon(0x4a3f5a), 0.72, 2.45, -1.45));
    g.add(mesh(boxG(0.28, 0.36, 0.28), basic(0xffe9a0), 0.92, 2.2, -1.45));
    g.add(mesh(coneG(0.24, 0.18, 4), toon(0x4a3f5a), 0.92, 2.46, -1.45));

    // Town signpost
    g.add(mesh(cylG(0.06, 0.07, 1.7, 8), toon(WOOD_DARK), -6.0, 0.85, 1.0));
    P.townSign = new THREE.Mesh(sharedGeo('adv-townSign', () => new THREE.PlaneGeometry(1.2, 0.42)), decalMaterial(drawCanvas(320, 112, drawTownSign)));
    P.townSign.position.set(-6.2, 1.35, 1.1);
    g.add(P.townSign);

    // The ship's name sign at the end of the dock
    for (const x of [2.4, 4.1]) g.add(mesh(cylG(0.07, 0.08, 2.5, 8), toon(WOOD_DARK), x, 1.0, -1.65));
    P.shipSign = new THREE.Mesh(sharedGeo('adv-shipSign', () => new THREE.PlaneGeometry(1.75, 0.5)), decalMaterial(drawCanvas(560, 160, drawShipSign)));
    P.shipSign.position.set(3.25, 1.95, -1.5);
    g.add(P.shipSign);

    // The Soggy Biscuit, resting her bottom on the sea floor
    P.ship = makeShip();
    P.ship.position.set(6.1, s.save.done ? -1.2 : -0.95, -2.2);
    P.ship.rotation.set(0, -0.06, s.save.done ? 0.01 : 0.05);
    g.add(P.ship);
    // Gangway: it goes DOWN to the ship
    const gang = new THREE.Group();
    gang.position.set(2.85, -0.02, -0.4);
    gang.rotation.z = -0.1;
    gang.add(mesh(boxG(1.9, 0.07, 0.85), toon(0xb98a5a), 0.95, 0, 0));
    for (let i = 0; i < 6; i++) gang.add(mesh(boxG(0.06, 0.04, 0.85), toon(WOOD_DARK), 0.2 + i * 0.3, 0.05, 0, false));
    for (const z of [-0.42, 0.42]) gang.add(mesh(boxG(1.9, 0.03, 0.03), toon(0xe8d5a8), 0.95, 0.5, z, false));
    for (const x of [0.05, 1.85]) for (const z of [-0.42, 0.42]) gang.add(mesh(cylG(0.025, 0.025, 0.5, 5), toon(WOOD_DARK), x, 0.25, z, false));
    g.add(gang);
    P.gang = gang;

    // Harbor Master Grumbleton
    P.grum = makeGrumbleton();
    P.grum.position.set(2.2, 0, -0.1);
    P.grum.rotation.y = -0.5;
    if (s.flag('duelWon')) placeGrumInWater(P.grum);
    g.add(P.grum);

    // The seagull, on her post (or on Pip's head)
    P.gull = makeSeagull();
    P.gull.position.set(-0.6, 1.09, 1.85);
    P.gull.rotation.y = -2.1;
    P.gull.scale.setScalar(1.05);
    if (s.flag('gullOnHead')) putGullOnHead(s, P);
    else g.add(P.gull);

    P.next = { gullLook: 1, giggle: 4, bubble: 1, grumGiggle: 2 };
    if (isS2(s)) DOCK2.build(s, P);
    return P;
  },

  relabel(s, P) {
    redrawDecal(P.barrel.userData.label.material, barrelLabel);
    redrawDecal(P.shipSign.material, drawShipSign);
    redrawDecal(P.townSign.material, drawTownSign);
    redrawDecal(P.crateLabel.material, drawCrate);
  },

  actors(s, P) {
    return {
      grum: {
        name: 'adv.who.grum', css: GRUM_CSS, voice: { pitch: 0.5, rate: 0.85 },
        head: (v) => P.grum.localToWorld(v.set(0, s.flag('duelWon') ? 1.0 : 1.75, 0)),
        face: (dir) => { if (!s.flag('duelWon')) s.tween(P.grum, { ry: dir < 0 ? -0.55 : 0.55 }, 0.2); },
      },
      gull: {
        name: () => (s.flag('gullOnHead') ? 'adv.who.mine' : 'adv.who.gull'), css: GULL_CSS, voice: { pitch: 2, rate: 1.3 }, sfx: 'mine',
        head: (v) => P.gull.localToWorld(v.set(0.2, 0.75, 0)),
      },
      note: {
        name: 'adv.who.note', kind: 'note', css: '#c9a25a', voice: { pitch: 1.15, rate: 0.95 },
        head: (v) => v.set(P.barrel.position.x + 0.5, 1.75, P.barrel.position.z),
      },
    };
  },

  self: {
    name: 'adv.dock.pip',
    look: (s) => (s.flag('gullOnHead') ? 'adv.dock.pip.lookHat' : 'adv.dock.pip.look'),
    useItem: {
      spoon: 'adv.dock.pip.spoon',
      duck: function* duck(s) { s.sfx('squeak'); yield s.say('pip', 'adv.dock.pip.duck'); },
      note: 'adv.dock.pip.note',
      ...SELF_ITEMS,
    },
  },

  hotspots: [
    {
      id: 'barrel', name: 'adv.dock.barrel', kind: 'object', box: [-3.9, 0.6, -0.75, 1.15, 1.3, 1.1], walk: [-2.85, -0.45], face: -1,
      look: (s) => (s.flag('barrelOpen') ? 'adv.dock.barrel.lookOpen' : 'adv.dock.barrel.look'),
      use: openBarrel,
      take: 'adv.dock.barrel.take',
      useItem: {
        spoon: function* spoon(s) {
          s.sfx('knock');
          if (!s.flag('barrelOpen')) s.host.later(0.5, () => s.sfx('squeak'));
          yield s.say('pip', s.flag('barrelOpen') ? 'adv.dock.barrel.spoonOpen' : 'adv.dock.barrel.spoon');
        },
        duck: 'adv.dock.barrel.duck',
        note: 'adv.dock.barrel.note',
      },
    },
    {
      id: 'grum', name: 'adv.dock.grum', kind: 'person', anchor: (s) => s.room.props.grum, box: [0, 0.8, 0, 1.4, 1.7, 1.1],
      walk: (s) => (s.flag('duelWon') ? s.clampWalk(2.0, 1.45) : [0.6, 0.0]), face: 1,
      look: (s) => (s.flag('duelWon') ? 'adv.dock.grum.lookWater' : 'adv.dock.grum.look'),
      talk: talkGrum,
      take: 'adv.dock.grum.take',
      useItem: {
        ...DOCK2.grumItems,
        spoon: (s) => (s.flag('gullOnHead') && !s.flag('duelWon') ? talkGrum(s) : [['grum', isS2(s) ? 'adv.g2.spoon' : 'adv.dock.g.spoon']]),
        duck: [['grum', 'adv.dock.g.duck']],
        note: (s) => [['grum', 'adv.dock.g.note1'], ['grum', isS2(s) ? 'adv.g2.note' : 'adv.dock.g.note2']],
      },
    },
    {
      id: 'gull', name: 'adv.dock.gull', kind: 'person', when: (s) => !s.flag('gullOnHead'),
      anchor: (s) => s.room.props.gull, box: [0, 0.35, 0, 0.85, 0.8, 0.7], walk: [-1.45, 1.2], face: 1,
      look: (s) => (s.has('duck') ? 'adv.dock.gull.lookDuck' : 'adv.dock.gull.look'),
      talk: (s) => (s.has('duck')
        ? [['gull', 'adv.dock.gull.mine'], ['pip', 'adv.dock.p.duckLook'], ['gull', 'adv.dock.gull.soft']]
        : [['gull', 'adv.dock.gull.mine'], ['pip', 'adv.dock.p.pet1'], ['gull', 'adv.dock.gull.mine'], ['pip', 'adv.dock.p.pet2'], ['gull', 'adv.dock.gull.mine']]),
      take: 'adv.dock.gull.take',
      useItem: {
        duck: duckOnGull,
        spoon: [['gull', 'adv.dock.gull.mine'], ['pip', 'adv.dock.gull.spoon1'], ['gull', 'adv.dock.gull.mine'], ['pip', 'adv.dock.gull.spoon2']],
        note: [['gull', 'adv.dock.gull.mine'], ['pip', 'adv.dock.gull.note'], ['gull', 'adv.dock.gull.mine']],
      },
    },
    {
      id: 'mine', name: 'adv.dock.mine', kind: 'person', when: (s) => s.flag('gullOnHead'), priority: 1, walk: null,
      anchor: (s) => s.room.props.gull, box: [0, 0.3, 0, 0.7, 0.6, 0.7],
      look: 'adv.dock.mine.look',
      talk: [['gull', 'adv.dock.gull.mine'], ['pip', 'adv.dock.mine.talk']],
      useItem: {
        spoon: [['gull', 'adv.dock.gull.mine'], ['pip', 'adv.dock.gull.spoon1'], ['gull', 'adv.dock.gull.mine'], ['pip', 'adv.dock.gull.spoon2']],
        note: [['gull', 'adv.dock.gull.mine'], ['pip', 'adv.dock.gull.note'], ['gull', 'adv.dock.gull.mine']],
      },
    },
    {
      id: 'sign', name: 'adv.dock.sign', kind: 'object', box: [3.25, 1.95, -1.5, 1.8, 0.6, 0.3], walk: [0.6, -0.6], face: 1,
      look: 'adv.dock.sign.look', use: 'adv.dock.sign.look',
    },
    {
      id: 'gangway', name: 'adv.dock.gangway', kind: 'object', box: [3.8, -0.05, -0.4, 1.9, 0.55, 1.0],
      walk: (s) => (s.flag('duelWon') ? [2.6, -0.35] : [0.6, -0.3]), face: 1,
      look: 'adv.dock.gangway.look', use: boardShip,
    },
    {
      id: 'ship', name: 'adv.dock.ship', kind: 'object', box: [6.1, 2.0, -2.2, 6.6, 5.0, 2.6], priority: -1,
      walk: (s) => (s.flag('duelWon') ? [2.6, -0.35] : [0.6, -0.3]), face: 1,
      look: (s) => (isS2(s) ? DOCK2.shipLook(s) : s.flag('duelWon') ? 'adv.dock.ship.lookAfter' : 'adv.dock.ship.look'),
      use: boardShip,
      useItem: { duck: 'adv.dock.ship.duck', note: 'adv.dock.ship.note', spoon: 'adv.dock.ship.spoon', ...DOCK2.shipItems },
    },
    {
      id: 'harbor', name: 'adv.dock.harbor', kind: 'object', box: [-1, SEA_Y - 0.3, 3.4, 22, 0.8, 2.2], priority: -1,
      walk: (s) => s.clampWalk(s.pip.position.x, 1.45), face: 0,
      look: 'adv.dock.harbor.look', use: 'adv.dock.harbor.use',
      useItem: { duck: 'adv.dock.harbor.duck', spoon: 'adv.dock.harbor.spoon' },
    },
    {
      id: 'sun', name: 'adv.dock.sun', kind: 'object', box: [-6, 1.4, -95, 15, 15, 2], priority: -2, walk: null,
      look: 'adv.dock.sun.look', use: 'adv.dock.sun.take', take: 'adv.dock.sun.take',
    },
    {
      id: 'crates', name: 'adv.dock.crates', kind: 'object', box: [-5.5, 0.8, -1.2, 1.9, 1.65, 1.0], walk: [-4.7, -0.6], face: -1,
      look: 'adv.dock.crates.look', use: 'adv.dock.crates.use',
    },
    {
      id: 'rope', name: 'adv.dock.rope', kind: 'item', box: [-2.6, 0.18, 1.6, 0.9, 0.45, 0.8], walk: [-1.8, 1.3], face: -1,
      look: 'adv.dock.rope.look', take: 'adv.dock.rope.take',
    },
    {
      id: 'lantern', name: 'adv.dock.lantern', kind: 'object', box: [0.7, 1.4, -1.45, 0.8, 2.6, 0.5], walk: [0.0, -0.75], face: 1,
      look: 'adv.dock.lantern.look', use: 'adv.dock.lantern.use',
    },
    {
      id: 'town', name: 'adv.dock.town', kind: 'exit', box: [-6.1, 1.0, 1.0, 1.3, 2.0, 0.8], walk: [-5.6, 0.8], face: -1,
      look: (s) => (isS2(s) ? DOCK2.townLook : 'adv.dock.town.look'),
      go: (s) => (isS2(s) ? DOCK2.town(s) : 'adv.dock.town.go'),
    },
    {
      id: 'planks', name: 'adv.dock.planks', kind: 'object', box: [-1.4, -0.25, 2.25, 6, 0.4, 0.3], priority: -1,
      walk: (s) => s.clampWalk(s.pip.position.x, 1.45), face: 0,
      look: (s) => (s.flag('knowRules') ? 'adv.dock.planks.lookKnow' : 'adv.dock.planks.look'),
    },
  ],

  update(s, dt, P) {
    const tm = s.room.time;
    for (const gl of P.glints) {
      const u = gl.userData;
      gl.position.set(((u.x + tm * u.sp + 15) % 30) - 15, SEA_Y + 0.01, u.z);
      gl.scale.x = u.w * (0.7 + 0.3 * Math.sin(tm * 2 + u.x));
    }
    for (const c of P.clouds) c.position.x += dt * 0.15;
    // The ship rests (sinks) gently
    if (!s.tweens.some((tw) => tw.obj === P.ship)) P.ship.rotation.x = Math.sin(tm * 0.7) * 0.015;
    if ((P.next.bubble -= dt) <= 0) {
      P.next.bubble = 1.2 + Math.random() * 2;
      s.host.puffs.burst(new THREE.Vector3(5 + Math.random() * 4, SEA_Y + 0.05, -0.8), 0xe6f6ff, { count: 2, size: 0.18, life: 0.7, speed: 0.6 });
    }

    // Grumbleton breathes in his tight uniform (or bobs in the water, giggling)
    const inner = P.grum.userData.inner;
    if (s.flag('duelWon')) {
      if (!s.tweens.some((tw) => tw.obj === P.grum)) {
        P.grum.position.y = SEA_Y - 0.55 + Math.sin(tm * 1.8) * 0.06;
        P.grum.rotation.z = 0.6 + Math.sin(tm * 1.1) * 0.12;
      }
      if ((P.next.grumGiggle -= dt) <= 0) {
        P.next.grumGiggle = 3 + Math.random() * 3;
        if (s.mode === 'play') s.float(t('adv.fx.heehee'), P.grum.position.clone().add(new THREE.Vector3(0, 1.1, 0)));
      }
    } else {
      const talk = s.isTalking('grum') ? Math.abs(Math.sin(tm * 14)) * 0.06 : 0;
      inner.scale.set(1.7 * (1 + Math.sin(tm * 2.2) * 0.02), 1.7 * (1 + Math.sin(tm * 2.2 + 1) * 0.025 + talk), 1.7);
      P.grum.userData.feather.rotation.z = -0.5 + Math.sin(tm * 6) * 0.15;
    }

    // The seagull: beady head jerks, MINE beak, a flap now and then
    animateGull(s, dt, P);
    if (isS2(s)) DOCK2.update(s, dt, P);

    // Faint giggling from under the dock, once you know about it
    if (s.flag('knowRules') && !s.flag('duelWon') && (P.next.giggle -= dt) <= 0) {
      P.next.giggle = 7 + Math.random() * 5;
      if (s.mode === 'play') s.float(t('adv.fx.giggle'), new THREE.Vector3(-2 + Math.random() * 2, -0.1, 2.25));
    }
  },
};

export const ROOMS = { dock, ...SCENE2_ROOMS };

/** New game: Pip walks onto the dock and introduces himself. */
export function* intro(s) {
  s.pip.position.set(-8.2, 0, 0.4);
  s.pipChar.faceSide(1);
  yield s.walk(-2.3, 0.4, true);
  s.face('pip', 0);
  yield s.say('pip', 'adv.intro.1');
  s.pipChar.squash(1.3);
  yield s.say('pip', 'adv.intro.2');
  yield s.say('pip', s.pipChar.hat.children.length ? 'adv.intro.3hat' : 'adv.intro.3');
  s.face('pip', 1);
  s.hint('adv.help', 14);
}
