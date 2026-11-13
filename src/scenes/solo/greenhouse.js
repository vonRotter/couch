import * as THREE from 'three';
import { toon } from '../../core/palette.js';
import { GREENHOUSE, GREEN, heightAt } from './map.js';
import { tileKey } from './farm.js';
import { now, count } from './save.js';
import { mesh, box, cyl, sph, cone, roofGeo, makeSign } from './models.js';
import { t, addStrings } from '../../core/i18n.js';
import { NPCS, npcState, heartsOf } from './npcs.js';

// The greenhouse east of the farm (milestone B3). At first it is an empty old frame; Aunt Hazel's fourth
// quest (wood, stone and fiber) fixes it: glass walls and roof and two rows of beds (a second small field,
// see farm.js). Any crop can be planted in the beds in any season. You walk in through the door in front.
// Milestone C: outdoor crops nearly sleep at night, but the greenhouse has grow lamps and keeps going.

const G = GREENHOUSE;
/** Aunt Hazel's quest that fixes it (npcs.js: her fourth). */
const GH_Q = NPCS.hazel.quests.findIndex((q) => q.reward?.unlock === 'greenhouse');
const NEED = NPCS.hazel.quests[GH_Q];

// Playtest round 3: what it takes to fix the greenhouse is said up front (its sign, a task and the map), not only
// once Aunt Hazel asks for it.
addStrings({
  en: {
    'gh.sign.hearts': 'The old greenhouse. The glass is gone! Aunt Hazel can fix it once you are good friends (3 hearts: you have {h}). Then she asks for {list}. Talk to her, bring her gifts and help with her jobs!',
    'gh.sign.jobs': 'The old greenhouse. The glass is gone! Aunt Hazel can fix it after her other jobs ({n} of {m} done). Then she asks for {list}.',
    'gh.sign.ask': 'The old greenhouse. Aunt Hazel can fix it now: talk to her! She will ask for {list}.',
    'gh.sign.quest': 'The old greenhouse. Bring Aunt Hazel {list} and she fixes it: glass, beds and grow lamps!',
    'gh.task.ask': '🌱 Aunt Hazel can fix the greenhouse now: talk to her',
    'gh.task.jobs': '🌱 Greenhouse: finish Aunt Hazel\'s other jobs first ({n} of {m} done)',
    'gh.task.quest': '🌱 Greenhouse: {text}',
    'gh.map.broken': 'Broken. Aunt Hazel can fix it',
    'gh.map.need': 'Broken. Aunt Hazel fixes it for {list}',
  },
  no: {
    'gh.sign.hearts': 'Det gamle drivhuset. Glasset er borte! Tante Hassel kan fikse det når dere er gode venner (3 hjerter: du har {h}). Da ber hun om {list}. Snakk med henne, gi henne gaver og hjelp henne med oppdragene!',
    'gh.sign.jobs': 'Det gamle drivhuset. Glasset er borte! Tante Hassel kan fikse det etter de andre oppdragene hennes ({n} av {m} klart). Da ber hun om {list}.',
    'gh.sign.ask': 'Det gamle drivhuset. Tante Hassel kan fikse det nå: snakk med henne! Hun ber om {list}.',
    'gh.sign.quest': 'Det gamle drivhuset. Gi tante Hassel {list}, så fikser hun det: glass, bed og vekstlamper!',
    'gh.task.ask': '🌱 Tante Hassel kan fikse drivhuset nå: snakk med henne',
    'gh.task.jobs': '🌱 Drivhuset: gjør ferdig de andre oppdragene til tante Hassel først ({n} av {m} klart)',
    'gh.task.quest': '🌱 Drivhuset: {text}',
    'gh.map.broken': 'Ødelagt. Tante Hassel kan fikse det',
    'gh.map.need': 'Ødelagt. Tante Hassel fikser det for {list}',
  },
});

/** "20 wood, 10 stone and 8 fiber" (with what you have when have is true). */
function needList(S, have = false) {
  const parts = NEED.need.map(([id, n]) => `${n} ${t(`isl.i.${id}`)}${have ? ` (${Math.min(n, count(S, id))}/${n})` : ''}`);
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} ${t('gh.and')} ${parts[parts.length - 1]}` : parts[0];
}
addStrings({ en: { 'gh.and': 'and' }, no: { 'gh.and': 'og' } });

/**
 * Where you are with fixing it: 'open' (fixed), 'quest' (Hazel asked: bring the things), 'ask' (she can ask
 * now: talk to her), 'jobs' (3 hearts, her earlier jobs first) or 'hearts' (not 3 hearts yet).
 */
export function greenhouseStep(S) {
  if (S.unlocks.greenhouse) return { step: 'open' };
  const st = npcState(S, 'hazel'), h = heartsOf(st);
  if (S.quests.hazel?.n === GH_Q) return { step: 'quest', h };
  if (h < (NEED.minHearts || 0)) return { step: 'hearts', h };
  if (st.q >= GH_Q && !S.quests.hazel) return { step: 'ask', h };
  return { step: 'jobs', h, n: Math.min(st.q, GH_Q), m: GH_Q };
}

/** A task line about the greenhouse (from 3 hearts with Aunt Hazel until it is fixed), or null. */
export function greenhouseTask(S) {
  const g = greenhouseStep(S);
  if (g.step === 'ask') return t('gh.task.ask');
  if (g.step === 'jobs' && !S.quests.hazel) return t('gh.task.jobs', { n: g.n, m: g.m });
  return null;
}

export class Greenhouse {
  constructor(host) {
    this.host = host;
    const map = host.map;
    const x0 = G.x - G.w / 2, x1 = G.x + G.w / 2, z0 = G.z - G.d / 2, z1 = G.z + G.d / 2;
    this.bounds = { x0, x1, z0, z1 };
    const y = heightAt(G.x, G.z);
    // the white frame (always there)
    this.frame = new THREE.Group();
    const post = (x, z, h = 2.2) => this.frame.add(mesh(box(0.14, h, 0.14), 0xffffff, x - G.x, h / 2, z - G.z));
    for (const x of [x0, G.x - 0.8, G.x + 0.8, x1]) { post(x, z0); post(x, z1); }
    for (const z of [z0, G.z, z1]) { post(x0, z); post(x1, z); }
    for (const z of [z0, z1]) this.frame.add(mesh(box(G.w + 0.14, 0.12, 0.14), 0xffffff, 0, 2.2, z - G.z));
    for (const x of [x0, x1]) this.frame.add(mesh(box(0.14, 0.12, G.d + 0.14), 0xffffff, x - G.x, 2.2, 0));
    this.frame.add(mesh(box(G.w + 0.2, 0.12, 0.14), 0xffffff, 0, 3.6, 0)); // the ridge
    for (const x of [x0, G.x, x1]) for (const s of [-1, 1]) {
      const r = mesh(box(0.1, 0.1, G.d / 2 + 0.4), 0xffffff, x - G.x, 2.9, s * G.d / 4);
      r.rotation.x = s * 0.55;
      this.frame.add(r);
    }
    this.frame.position.set(G.x, y, G.z);
    host.scene.add(this.frame);
    // glass and beds (once fixed)
    this.glass = new THREE.Group();
    const glassMat = new THREE.MeshToonMaterial({ color: 0xcff4ff, gradientMap: toon(0xffffff).gradientMap, transparent: true, opacity: 0.22, depthWrite: false });
    const pane = (w, h, x, yy, z, ry = 0) => { const m = mesh(box(w, h, 0.04), glassMat, x, yy, z, false); m.rotation.y = ry; this.glass.add(m); };
    pane(G.w, 2.1, 0, 1.1, -G.d / 2);
    pane(G.d, 2.1, -G.w / 2, 1.1, 0, Math.PI / 2);
    pane(G.d, 2.1, G.w / 2, 1.1, 0, Math.PI / 2);
    for (const s of [-1, 1]) pane((G.w - 1.6) / 2, 2.1, s * (0.8 + (G.w - 1.6) / 4), 1.1, G.d / 2);
    pane(1.6, 0.5, 0, 1.95, G.d / 2);
    const roof = mesh(roofGeo(G.w + 0.1, G.d + 0.5, 1.4), glassMat, 0, 2.22, 0, false);
    this.glass.add(roof);
    // bed borders
    const bx = GREEN.x0 + (GREEN.cols * GREEN.size) / 2 - G.x, bz = GREEN.z0 + (GREEN.rows * GREEN.size) / 2 - G.z;
    this.glass.add(mesh(box(GREEN.cols * GREEN.size + 0.3, 0.16, GREEN.rows * GREEN.size + 0.3), 0x8a5a32, bx, 0.06, bz));
    for (let i = 0; i < 3; i++) this.glass.add(mesh(cyl(0.2, 0.15, 0.3, 8), 0xd9776a, x1 - G.x - 0.45, 0.15, z0 - G.z + 0.5 + i * 0.6), mesh(cyl(0.15, 0.15, 0.25, 6), 0x3fae4a, x1 - G.x - 0.45, 0.4, z0 - G.z + 0.5 + i * 0.6, false));
    // grow lamps under the ridge: the greenhouse keeps growing at full speed at night (farm.js), and they glow
    this.lampMat = new THREE.MeshBasicMaterial({ color: 0xd8d8cc });
    this.haloMat = new THREE.MeshBasicMaterial({ color: 0xffc860, transparent: true, opacity: 0, depthWrite: false });
    for (const dx of [-1.9, 0, 1.9]) {
      this.glass.add(mesh(cyl(0.015, 0.015, 0.8, 4), 0x2b2340, dx, 3.15, 0, false), mesh(cone(0.26, 0.22, 10), 0x3fae4a, dx, 2.7, 0, false));
      this.glass.add(mesh(sph(0.12, 10, 8), this.lampMat, dx, 2.55, 0, false), mesh(sph(0.5, 12, 8), this.haloMat, dx, 2.45, 0, false));
    }
    this.glass.position.copy(this.frame.position);
    host.scene.add(this.glass);
    this.lampSpot = { x: G.x, y: y + 2.4, z: G.z };
    this.mapRef = map;
    // a sign while it is broken
    this.sign = makeSign(0x8ac926);
    this.sign.position.set(G.x + 1.6, heightAt(G.x + 1.6, z1 + 0.9), z1 + 0.9);
    host.scene.add(this.sign);
    this.signSpot = { x: G.x + 1.6, z: z1 + 0.9 };
    // walls: back, sides, and the front with the door in the middle
    map.segObs({ x: x0, z: z0 }, { x: x1, z: z0 }, 0.15);
    map.segObs({ x: x0, z: z0 }, { x: x0, z: z1 }, 0.15);
    map.segObs({ x: x1, z: z0 }, { x: x1, z: z1 }, 0.15);
    map.segObs({ x: x0, z: z1 }, { x: G.x - 0.8, z: z1 }, 0.15);
    map.segObs({ x: G.x + 0.8, z: z1 }, { x: x1, z: z1 }, 0.15);
    map.circObs(x1 - 0.45, z0 + 1.1, 0.5);
    this.signObs = map.circObs(this.signSpot.x, this.signSpot.z, 0.3);
    this.refresh();
  }

  get open() { return !!this.host.save.unlocks.greenhouse; }

  /** The grow lamps glow after dark (island.applySky). */
  lights(lit) {
    this.lampMat.color.setHex(lit ? 0xfff0b0 : 0xd8d8cc);
    this.haloMat.opacity = lit ? 0.32 : 0;
  }

  refresh() {
    this.glass.visible = this.open;
    // a real lamp light joins the island's lamps once the greenhouse works
    const spots = this.mapRef.lampSpots, has = spots.includes(this.lampSpot);
    if (this.open && !has) spots.push(this.lampSpot);
    this.sign.visible = !this.open;
    this.signObs.x = this.open ? 1e5 : this.signSpot.x;
  }

  /** Fixed by Aunt Hazel's quest: the beds become tilled soil. */
  fix() {
    const S = this.host.save, at = now();
    for (let c = 0; c < GREEN.cols; c++) for (let r = 0; r < GREEN.rows; r++) {
      const k = tileKey(c, r, 1);
      if (!S.tiles[k]) S.tiles[k] = { crop: null, growth: 0, wetUntil: 0, last: at };
    }
    this.refresh();
    this.host.farm.tick(at);
    this.host.confetti.burst(new THREE.Vector3(G.x, 3.5, G.z), 0, { count: 70, speed: 7, up: 5, life: 1.6, gravity: -7, colors: [0x3ddc97, 0xffffff, 0xbff6ff, 0xffc93c] });
  }

  /** [B] at the broken greenhouse's sign: what it takes to fix it, and from whom. */
  interactions(P, out, nm) {
    if (!this.open && Math.hypot(P.x - this.signSpot.x, P.z - this.signSpot.z) < 1.5) out.b = { text: nm('isl.h.sign'), fn: () => this.host.say([{ text: this.signText() }]) };
  }

  signText() {
    const S = this.host.save, g = greenhouseStep(S);
    return t(`gh.sign.${g.step === 'open' ? 'ask' : g.step}`, { h: g.h, n: g.n, m: g.m, list: needList(S, g.step === 'quest') });
  }

  /** The map's marker for the broken greenhouse (atlas.js): a short hint. */
  mapHint() {
    const g = greenhouseStep(this.host.save);
    return g.step === 'quest' || g.step === 'ask' ? t('gh.map.need', { list: needList(this.host.save) }) : t('gh.map.broken');
  }
}
