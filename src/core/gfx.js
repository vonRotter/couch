import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// The graphics trial (tests/graphics/LOG.md): four looks, each with its own switch, on the solo island first.
//   glow  - glow and colour: a soft bloom on bright, lit things only (lamps, lanterns, windows at night, the
//           lighthouse beam, the magic ball...) and a gentle colour grade by time of day and season
//   life  - a living world: trees, bushes and grass sway in the wind, shoreline foam and moving highlights
//   light - softer light: softer shadow edges, a faint rim light on the beans and villagers, contact shading
//   mini  - a miniature look: tilt-shift, the top and bottom of the screen a little blurred
// "Simple graphics" turns every one off. Where they are set (first that applies):
//   1. the address: ?gfx=glow,life,light,mini (any of them), ?gfx=all, ?gfx=none (the trial; never saved)
//   2. this device's choice in Help me play > Graphics (localStorage 'couch.gfx': { simple, glow, life, light, mini })
//   3. DEFAULT_LOOK below (what a device starts with), unless the first seconds on the island ran slowly: then
//      the device steps down to simple graphics by itself (once; saved, with a toast; the setting changes it back).
// A scene opts in by drawing through game.gfx.render(scene, camera, look); other scenes draw as before. Only glow
// and mini need the post-processing chain (EffectComposer); life and light are material and scene changes the
// scene's own look module makes (solo/gfxlook.js), and with glow and mini off the island draws straight to the
// screen as before.

export const EFFECTS = ['glow', 'life', 'light', 'mini'];
// What a device starts with before anyone chooses (the owner's choice after the trial: tests/graphics/LOG.md).
export const DEFAULT_LOOK = Object.freeze({ glow: false, life: false, light: false, mini: false });
const KEY = 'couch.gfx';
// the automatic step-down: after WARM seconds on an opted-in scene, FRAMES frames; a median slower than SLOW_MS
const WARM = 2.5, FRAMES = 90, SLOW_MS = 40;

const COPY_VERT = 'varying vec2 vUv;\nvoid main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }';

// The colour grade (linear light, before the output pass): a tint, a little saturation, never a lift of the blacks
// (dark outlines stay as dark as they were).
const GradeShader = {
  name: 'GradeShader',
  uniforms: { tDiffuse: { value: null }, uTint: { value: new THREE.Vector3(1, 1, 1) }, uSat: { value: 1 } },
  vertexShader: COPY_VERT,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform vec3 uTint; uniform float uSat; varying vec2 vUv;
    void main() {
      vec4 c = texture2D( tDiffuse, vUv );
      vec3 col = c.rgb * uTint;
      float l = dot( col, vec3( 0.2126, 0.7152, 0.0722 ) );
      gl_FragColor = vec4( max( mix( vec3( l ), col, uSat ), 0.0 ), c.a );
    }`,
};

// Tilt-shift, one direction per pass (horizontal, then vertical): sharp in a band around uCenter (the bean's height
// on screen), a soft blur growing toward the top and the bottom. 9 taps on linear filtering (a 17-tap Gaussian).
const TiltShader = {
  name: 'TiltShader',
  uniforms: { tDiffuse: { value: null }, uDir: { value: new THREE.Vector2(1, 0) }, uAmount: { value: 0 }, uCenter: { value: 0.5 }, uBand: { value: 0.16 } },
  vertexShader: COPY_VERT,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform vec2 uDir; uniform float uAmount; uniform float uCenter; uniform float uBand; varying vec2 vUv;
    void main() {
      float d = abs( vUv.y - uCenter );
      float k = smoothstep( uBand, uBand + 0.32, d ) * uAmount;
      vec4 c = texture2D( tDiffuse, vUv );
      if ( k < 0.002 ) { gl_FragColor = c; return; }
      vec2 s = uDir * k;
      vec4 sum = c * 0.2270270270;
      sum += ( texture2D( tDiffuse, vUv + s * 1.3846153846 ) + texture2D( tDiffuse, vUv - s * 1.3846153846 ) ) * 0.3162162162;
      sum += ( texture2D( tDiffuse, vUv + s * 3.2307692308 ) + texture2D( tDiffuse, vUv - s * 3.2307692308 ) ) * 0.0702702703;
      gl_FragColor = sum;
    }`,
};

function readSaved() {
  try { const v = JSON.parse(localStorage.getItem(KEY)); return v && typeof v === 'object' ? v : null; } catch { return null; }
}

/** The address's ?gfx= list: null when there is none, else { glow, life, light, mini }. */
export function urlLook(search = location.search) {
  const q = new URLSearchParams(search).get('gfx');
  if (q === null) return null;
  const list = q.toLowerCase().split(/[\s,+]+/).filter(Boolean);
  const all = list.includes('all') || list.includes('on');
  return Object.fromEntries(EFFECTS.map((k) => [k, all || list.includes(k)]));
}

export class Gfx {
  constructor(game) {
    this.game = game;
    this.renderer = game.renderer;
    this.url = urlLook();
    this.defaults = { ...DEFAULT_LOOK };
    this.composer = null;
    this.stats = { ms: 0, frames: 0 }; // the last composer frame's cost (tests and the trial log)
    this.watch = null; // the automatic step-down's measurement
    this.version = 0; // goes up with every change (scenes refresh their materials)
  }

  /** The saved choice for this device (null: never chosen). */
  get saved() { return readSaved(); }

  /** What is on now: { glow, life, light, mini } (all false with simple graphics). */
  get on() {
    if (this.url) return this.url;
    const s = this.saved;
    if (s?.simple) return { glow: false, life: false, light: false, mini: false };
    return Object.fromEntries(EFFECTS.map((k) => [k, s && typeof s[k] === 'boolean' ? s[k] : !!this.defaults[k]]));
  }

  get simple() { return !EFFECTS.some((k) => this.on[k]); }

  /** Change this device's choice: set({ simple }) or set({ glow: true }) and so on (saved; the address wins). */
  set(patch) {
    const s = this.saved || {};
    const per = Object.fromEntries(EFFECTS.map((k) => [k, typeof s[k] === 'boolean' ? s[k] : !!this.defaults[k]]));
    const next = { simple: !!s.simple, ...per, ...patch, auto: false };
    if (EFFECTS.some((k) => patch[k] === true)) next.simple = false; // one look on: not simple any more
    // simple graphics off: back to the looks this device had (every look if it had none)
    if (patch.simple === false && !EFFECTS.some((k) => next[k])) for (const k of EFFECTS) next[k] = true;
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* private mode: for this visit only */ }
    this.url = null; // a choice made here wins over the address from now on
    this.version++;
  }

  /** Tests and the comparison: exactly these effects for this page (not saved): ['glow', 'mini'], [] ... */
  trial(list) {
    this.url = Object.fromEntries(EFFECTS.map((k) => [k, list.includes(k)]));
    this.version++;
  }

  ensureComposer() {
    if (this.composer) return;
    const r = this.renderer;
    const size = r.getDrawingBufferSize(new THREE.Vector2());
    const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 4 });
    const C = new EffectComposer(r, rt);
    C.setPixelRatio(r.getPixelRatio());
    C.setSize(window.innerWidth, window.innerHeight);
    this.renderPass = new RenderPass(new THREE.Scene(), new THREE.PerspectiveCamera());
    C.addPass(this.renderPass);
    // bloom on what is brighter than plain white only: the glowing things are drawn brighter than 1 (gfxlook.js)
    this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.55, 0.45, 1.02);
    const bs = this.bloom.setSize.bind(this.bloom);
    this.bloom.setSize = (w, h) => bs(Math.max(2, w / 2), Math.max(2, h / 2)); // a quarter-size first mip: cheap, and just as soft
    this.bloom.setSize(size.x, size.y);
    C.addPass(this.bloom);
    this.grade = new ShaderPass(GradeShader);
    C.addPass(this.grade);
    this.tiltH = new ShaderPass(TiltShader);
    this.tiltV = new ShaderPass(TiltShader);
    C.addPass(this.tiltH);
    C.addPass(this.tiltV);
    C.addPass(new OutputPass());
    this.composer = C;
  }

  resize(w, h) {
    if (!this.composer) return;
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(w, h);
  }

  /**
   * Draw a scene with the looks that are on. look (from the scene, every frame):
   *   tint [r, g, b], sat: the colour grade (glow); bloom: 0..1 how strongly lit things glow now (0 by day)
   *   tilt: 0..1 the miniature look now (0 in menus, dialogs and near text); focus: 0..1 the sharp band's height
   */
  render(scene, camera, look = {}) {
    const on = this.on;
    this.measure(on);
    const tilt = on.mini ? (look.tilt ?? 1) : 0;
    const glow = on.glow;
    if (!glow && tilt < 0.01) { this.renderer.render(scene, camera); return; }
    const t0 = performance.now();
    this.ensureComposer();
    this.renderPass.scene = scene;
    this.renderPass.camera = camera;
    this.bloom.enabled = glow && (look.bloom ?? 1) > 0.01;
    this.bloom.strength = 0.55 * (look.bloom ?? 1);
    const tint = glow ? look.tint || [1, 1, 1] : [1, 1, 1];
    const sat = (glow ? look.sat ?? 1 : 1) * (1 + 0.07 * tilt); // miniatures look a touch more saturated
    this.grade.enabled = glow || tilt > 0.01;
    this.grade.uniforms.uTint.value.set(tint[0], tint[1], tint[2]);
    this.grade.uniforms.uSat.value = sat;
    const size = this.renderer.getDrawingBufferSize(_size);
    const px = 2.4 * this.renderer.getPixelRatio(); // the widest step in drawing-buffer pixels
    for (const [p, dir] of [[this.tiltH, [px / size.x, 0]], [this.tiltV, [0, px / size.y]]]) {
      p.enabled = tilt > 0.01;
      p.uniforms.uDir.value.set(dir[0], dir[1]);
      p.uniforms.uAmount.value = tilt;
      p.uniforms.uCenter.value = look.focus ?? 0.5;
    }
    this.composer.render();
    this.stats.ms = performance.now() - t0;
    this.stats.frames++;
  }

  /**
   * The automatic step-down: only while some look is on because of the defaults (never after a choice in the
   * settings or with ?gfx=), measured once per page on the first opted-in scene. Real frame times from the loop.
   */
  measure(on) {
    if (this.watch?.done) return;
    if (this.url || this.saved || !EFFECTS.some((k) => on[k])) return;
    const now = performance.now();
    const W = (this.watch ||= { t0: now, last: now, times: [] });
    const dt = now - W.last;
    W.last = now;
    if (now - W.t0 < WARM * 1000) return;
    W.times.push(dt);
    if (W.times.length < FRAMES) return;
    this.judge(W.times);
  }

  /** Decide from frame times (ms): slower than SLOW_MS in the median steps down to simple graphics. */
  judge(times) {
    const W = (this.watch ||= {});
    W.done = true;
    const sorted = [...times].sort((a, b) => a - b);
    W.median = sorted[Math.floor(sorted.length / 2)] || 0;
    if (W.median <= SLOW_MS) return false;
    try { localStorage.setItem(KEY, JSON.stringify({ simple: true, auto: true })); } catch { /* for this visit */ }
    this.version++;
    this.game.onGfxStepDown?.();
    return true;
  }

  dispose() {
    this.composer?.dispose?.();
    this.composer = null;
  }
}
const _size = new THREE.Vector2();
