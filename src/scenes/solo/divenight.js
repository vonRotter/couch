import * as THREE from 'three';
import { mesh, sph } from './models.js';

// Night dives (the owner's night dive): the dive follows the island's clock. Evening dives get dim, night dives
// dark. A dark veil hangs between the camera and the sea with a round hole of light around the diver: a small
// free headlight, or the big circle of Rosa's sea lamp. Glowing critters come out only at night (lanternfish
// in the open water, glowing jellies, sparkling plankton, and the two night finds: moon jellies and glow
// shrimp); their glow is drawn after the veil, so they shine in the dark. One veil mesh, one Points cloud
// and a few halos keep it cheap.

/** How dark the sea is at an hour (0 day .. 1 night): dim from 17:00, dark from 21:00 to 4:36, light at 7:30. */
const DARK = [[0, 1], [4.6, 1], [6, 0.5], [7.5, 0], [17, 0], [19, 0.45], [20, 0.8], [21, 1], [24, 1]];
export function diveDark(h) {
  for (let i = 0; i < DARK.length - 1; i++) {
    const [h0, a] = DARK[i], [h1, b] = DARK[i + 1];
    if (h >= h0 && h <= h1) return a + (b - a) * ((h - h0) / (h1 - h0 || 1));
  }
  return 0;
}
/** Night critters are out from 20:00 to 5:00. */
export const isDiveNight = (h) => h >= 20 || h < 5;
/** Evening (dim, before the glow comes out): 17:00 to 20:00. */
export const isDiveEvening = (h) => h >= 17 && h < 20;
/** Radius (world units) of the light around the diver: the free headlight, and the sea lamp. */
export const HEADLIGHT_R = 2.8, LAMP_R = 6.5;
const VEIL_Z = 1.0; // the veil hangs just in front of the diver and the critters
const NIGHT_BG = new THREE.Color(0x030a1c);

const VERT = `varying vec2 vW; void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xy; gl_Position = projectionMatrix * viewMatrix * w; }`;
const FRAG = `uniform vec2 uC; uniform float uR; uniform float uA; uniform vec3 uCol; varying vec2 vW;
void main() { float d = distance(vW, uC); float a = uA * smoothstep(uR * 0.72, uR * 1.08, d); gl_FragColor = vec4(uCol, a); }`;

/** A soft additive halo (and a bright core) that shows through the dark veil. */
export function makeHalo(color, r = 0.6) {
  const g = new THREE.Group();
  const halo = new THREE.Mesh(sph(r, 12, 8), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.32, depthWrite: false, blending: THREE.AdditiveBlending }));
  const core = new THREE.Mesh(sph(r * 0.28, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, depthWrite: false }));
  halo.renderOrder = 20;
  core.renderOrder = 21;
  for (const m of [halo, core]) m.material.userData = {};
  g.add(halo, core);
  g.userData.halo = halo;
  return g;
}

export class DiveNight {
  /** host: the dive scene (scene, camera, save, rand, diver); hour: the island clock at the start of the dive. */
  constructor(host, hour) {
    this.host = host;
    this.hour = hour;
    this.dark = diveDark(hour);
    this.night = isDiveNight(hour);
    this.evening = isDiveEvening(hour);
    this.lamp = !!host.save.sea.seaLamp;
    this.radius = this.lamp ? LAMP_R : HEADLIGHT_R;
    this.halos = [];
    const sc = host.scene;
    // the veil: dark everywhere except a soft circle around the diver
    this.uni = { uC: { value: new THREE.Vector2() }, uR: { value: this.radius }, uA: { value: 0 }, uCol: { value: new THREE.Color(0x020614) } };
    this.veil = new THREE.Mesh(new THREE.PlaneGeometry(70, 44), new THREE.ShaderMaterial({ uniforms: this.uni, vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, depthTest: false }));
    this.veil.renderOrder = 10;
    this.veil.frustumCulled = false;
    sc.add(this.veil);
    // a warm headlight (or the lamp) lights the toon world inside the circle
    this.light = new THREE.PointLight(this.lamp ? 0xfff1c0 : 0xdff4ff, 0, this.radius * 2.2, 1.1);
    sc.add(this.light);
    if (this.night) this.buildPlankton();
  }

  /** Sparkling plankton: one Points cloud over the whole sea, only at night. */
  buildPlankton() {
    const r = this.host.rand, n = 260, pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
    const cols = [new THREE.Color(0x8ff0ff), new THREE.Color(0x9fffb8), new THREE.Color(0xd8b8ff)];
    for (let i = 0; i < n; i++) {
      pos[i * 3] = -46 + r() * 108; pos[i * 3 + 1] = -1.5 - r() * 28; pos[i * 3 + 2] = -3 + r() * 3.6;
      const c = cols[i % 3];
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.plankMat = new THREE.PointsMaterial({ vertexColors: true, size: 0.2, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending });
    this.plankton = new THREE.Points(g, this.plankMat);
    this.plankton.renderOrder = 22;
    this.plankton.frustumCulled = false;
    this.host.scene.add(this.plankton);
  }

  /** Give a critter (its holder group) a glow that shows in the dark. */
  addHalo(holder, color, r = 0.6) {
    const h = makeHalo(color, r);
    holder.add(h);
    this.halos.push(h);
    return h;
  }

  /** How dark it is around x (the glow cave is always dark). */
  darkAt(x, caveX) {
    return Math.max(this.dark, x > caveX - 2 ? 0.88 * Math.min(1, (x - caveX + 2) / 4) : 0);
  }

  /** Every frame: the veil and the light follow the diver; colors and lights dim with the dark. */
  update(dt, t, caveX) {
    const host = this.host, D = host.diver, cam = host.camera;
    const dark = this.darkAt(D.x, caveX);
    this.cur = dark;
    // the veil's hole: the diver's position seen from the camera, on the veil's plane
    const k = (cam.position.z - VEIL_Z) / (cam.position.z - 0.2);
    const cx = cam.position.x + (D.x - cam.position.x) * k, cy = cam.position.y + (D.y - cam.position.y) * k;
    this.veil.position.set(cam.position.x, cam.position.y - 0.6, VEIL_Z);
    this.uni.uC.value.set(cx, cy);
    this.uni.uR.value = this.radius * k;
    this.uni.uA.value = dark * 0.94;
    this.veil.visible = dark > 0.02;
    this.light.position.set(D.x + D.dir * 0.6, D.y + 0.5, 1.6);
    this.light.intensity = dark * (this.lamp ? 26 : 12);
    for (const h of this.halos) h.visible = dark > 0.2;
    if (this.plankton) {
      // a slow twinkle: the whole cloud breathes, and it drifts a little
      this.plankMat.opacity = 0.55 + Math.sin(t * 2.3) * 0.25;
      this.plankton.position.y = Math.sin(t * 0.3) * 0.4;
      this.plankton.visible = dark > 0.2;
    }
  }

  /** Background, fog and lights for the dark (called after the depth colors are set). */
  tint(dark = this.cur ?? this.dark) {
    const sc = this.host.scene;
    if (dark <= 0) return;
    sc.background.lerp(NIGHT_BG, dark * 0.85);
    sc.fog.color.copy(sc.background);
    this.host.hemi.intensity *= 1 - dark * 0.55;
    this.host.sun.intensity *= 1 - dark * 0.9;
  }
}

/** Glowing jellies for night dives (cyan and violet), with halos; returns [{ g, ph, y0 }]. */
export function nightJellies(host, night) {
  const out = [];
  const r = host.rand;
  for (let i = 0; i < 8; i++) {
    const g = new THREE.Group();
    const col = i % 2 ? 0x8ff0ff : 0xc9a8ff;
    g.add(mesh(sph(0.45, 12, 8), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.7, depthWrite: false }), 0, 0, 0, false));
    for (let k = 0; k < 4; k++) g.add(mesh(sph(0.04, 5, 4), col, (k - 1.5) * 0.15, -0.5, 0, false));
    g.children[0].renderOrder = 21;
    g.children[0].material.userData = {};
    night.addHalo(g, col, 0.9);
    const x = i < 3 ? (r() - 0.5) * 9 : (r() < 0.5 ? -1 : 1) * (6 + r() * 30);
    g.position.set(x, i < 3 ? -24 - r() * 5 : -4 - r() * 12, -2.2);
    host.scene.add(g);
    out.push({ g, ph: r() * 6, y0: g.position.y });
  }
  return out;
}
