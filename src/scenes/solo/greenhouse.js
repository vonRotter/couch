import * as THREE from 'three';
import { toon } from '../../core/palette.js';
import { GREENHOUSE, GREEN, heightAt } from './map.js';
import { tileKey } from './farm.js';
import { now } from './save.js';
import { mesh, box, cyl, roofGeo, makeSign } from './models.js';

// The greenhouse east of the farm (milestone B3). At first it is an empty old frame; Aunt Hazel's fourth
// quest (wood, stone and fiber) fixes it: glass walls and roof and two rows of beds (a second small field,
// see farm.js). Any crop can be planted in the beds in any season. You walk in through the door in front.

const G = GREENHOUSE;

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
    this.glass.position.copy(this.frame.position);
    host.scene.add(this.glass);
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

  refresh() {
    this.glass.visible = this.open;
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

  /** [B] at the broken greenhouse's sign. */
  interactions(P, out, nm) {
    if (!this.open && Math.hypot(P.x - this.signSpot.x, P.z - this.signSpot.z) < 1.5) out.b = { text: nm('isl.h.sign'), fn: () => this.host.say([{ key: 'isl.sign.greenhouse' }]) };
  }
}
