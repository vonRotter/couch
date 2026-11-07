import * as THREE from 'three';

// See-through (the owner's playtest: "I can't see behind it"): anything tall between the camera and the bean
// (a balloon, a house, a tree, the lighthouse, the waterfall) turns see-through around the bean while it hides
// it. Every material on the island gets a few lines in its fragment shader: a fragment that is clearly nearer
// to the camera than the bean, above the bean's knees and inside a soft circle around the bean on screen is
// thinned out with an ordered dither (so it reads as faded, and opaque things need no sorting). Nothing
// changes when nothing is in front of the bean. The ground and the water are left alone.
//
// The uniforms are shared by every patched material; `on` is 0 outside the solo island, so a shared material
// that another scene also uses draws exactly as before there.

const U = {
  uCutOn: { value: 0 },
  uCutScreen: { value: new THREE.Vector2() }, // the bean on screen (drawing buffer pixels, origin bottom left)
  uCutR: { value: 120 }, // the circle's radius in pixels
  uCutCam: { value: new THREE.Vector3() },
  uCutDist: { value: 10 }, // camera to bean
  uCutFeet: { value: 0 },
};
const KINDS = new Set(['MeshToonMaterial', 'MeshBasicMaterial', 'MeshLambertMaterial', 'MeshStandardMaterial', 'MeshPhongMaterial']);
const patched = new WeakSet();

const VERT_HEAD = 'varying vec3 vCutW;\n';
const VERT_BODY = `
  vec4 cutWP = vec4( transformed, 1.0 );
  #ifdef USE_INSTANCING
    cutWP = instanceMatrix * cutWP;
  #endif
  vCutW = ( modelMatrix * cutWP ).xyz;
`;
const FRAG_HEAD = `
varying vec3 vCutW;
uniform float uCutOn;
uniform vec2 uCutScreen;
uniform float uCutR;
uniform vec3 uCutCam;
uniform float uCutDist;
uniform float uCutFeet;
float cutB2( vec2 a ) { a = floor( a ); return fract( dot( a, vec2( 0.5, a.y * 0.75 ) ) ); }
float cutBayer( vec2 a ) { return cutB2( 0.5 * a ) * 0.25 + cutB2( a ) + 0.03125; } // a 4x4 ordered dither (0..1)
`;
const FRAG_BODY = `
  if ( uCutOn > 0.0 && vCutW.y > uCutFeet + 0.45 && distance( vCutW, uCutCam ) < uCutDist - 0.9 ) {
    float k = ( 1.0 - smoothstep( uCutR * 0.55, uCutR, distance( gl_FragCoord.xy, uCutScreen ) ) ) * uCutOn;
    if ( k * 0.78 > cutBayer( gl_FragCoord.xy ) ) discard;
  }
`;

/** Add the see-through lines to a material (once). */
function patch(m) {
  if (patched.has(m) || !KINDS.has(m.type) || m.userData?.noCut) return;
  patched.add(m);
  const prev = m.onBeforeCompile;
  const prevKey = m.customProgramCacheKey;
  m.onBeforeCompile = (sh, r) => {
    if (prev && prev !== THREE.Material.prototype.onBeforeCompile) prev.call(m, sh, r);
    Object.assign(sh.uniforms, U);
    sh.vertexShader = VERT_HEAD + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>' + VERT_BODY);
    sh.fragmentShader = FRAG_HEAD + sh.fragmentShader.replace(/void main\(\) \{/, (s) => s + FRAG_BODY);
  };
  m.customProgramCacheKey = () => (prevKey && prevKey !== THREE.Material.prototype.customProgramCacheKey ? prevKey.call(m) : '') + '|seethrough';
  m.needsUpdate = true;
}

export class SeeThrough {
  /** skip: objects (and their children) to leave alone, like the ground and the water. */
  constructor(scene, renderer, skip = []) {
    this.scene = scene;
    this.renderer = renderer;
    this.skip = new Set(skip);
    this.t = 0;
    this.k = 0;
    this.sweep();
  }

  /** Patch every material in the scene (again every couple of seconds for things added later). */
  sweep() {
    const walk = (o) => {
      if (this.skip.has(o)) return;
      if (o.isMesh) for (const m of Array.isArray(o.material) ? o.material : [o.material]) if (m) patch(m);
      for (const c of o.children) walk(c);
    };
    walk(this.scene);
  }

  /** Every frame: where the bean is (world, its middle) and its feet; on = false switches the effect off. */
  update(dt, camera, bean, feet, on = true) {
    this.t -= dt;
    if (this.t <= 0) { this.t = 2; this.sweep(); }
    this.k += ((on ? 1 : 0) - this.k) * Math.min(1, dt * 6);
    U.uCutOn.value = this.k < 0.01 ? 0 : this.k;
    if (!U.uCutOn.value) return;
    const size = this.renderer.getDrawingBufferSize(_size);
    _v.copy(bean).project(camera);
    U.uCutScreen.value.set((_v.x + 1) / 2 * size.x, (_v.y + 1) / 2 * size.y);
    U.uCutR.value = size.y * 0.15;
    U.uCutCam.value.copy(camera.position);
    U.uCutDist.value = camera.position.distanceTo(bean);
    U.uCutFeet.value = feet;
  }

  dispose() {
    U.uCutOn.value = 0;
  }
}
const _v = new THREE.Vector3();
const _size = new THREE.Vector2();
