import * as THREE from 'three';
import { calmOn } from '../../core/assist.js';
import { GLOW, markGlow, glowBlend } from '../../core/gfx.js';
import { heightAt } from './map.js';

// The solo island's side of the graphics trial (core/gfx.js has the switches and the post-processing chain).
// Each look is switched on and off here every frame from game.gfx.on, so a change in the settings shows at once.
//
// Glow and colour: the bloom picks up only what carries the glow mark (core/gfx.js markGlow): lamps and lanterns, lit
// windows, the lighthouse lamp and beam, the arcade screens, the greenhouse lamps and fireflies at night; the magic
// ball and its aim dots and the ghost ship's lanterns always. While the island is drawn they are also a little
// brighter (and put back after). The colour grade follows the hour and the season (GRADE below).

// Softer light: the sun's shadows get softer edges (a wider PCF filter: shadow.radius), the beans and villagers a faint
// rim of sky light on their edges (their toon materials swapped for copies with a fresnel term, put back when off),
// and contact shading: a soft dark patch on the ground under each tree, bush, rock, house and lamp (one instanced
// mesh, from the map's footprints) and under the bean and every villager, so things stand on the ground.

// A living world: the trees', bushes' and grass tufts' baked meshes sway a little in the wind (copies of their
// materials with a few vertex lines, one shared wind clock; twice as strong on rainy days, more after a storm), and
// the water gets foam along the shore and slow moving glints further out (the island's own water material, a small
// depth map baked from the ground's height once). The seasons' own particles stay as they are (seasonlook.js:
// petals in spring, falling leaves in autumn, snow and snowy roofs in winter; life.js: fireflies at night): nothing
// is added, the owner's "never too many"; with this look the fireflies glow on and off softly, one by one (steady
// with Reduce flashing), and the autumn leaves and the petals tumble a little more as they fall (seasonlook.js).

// A miniature look: tilt-shift (core/gfx.js), sharp in a band around the bean, softly blurred toward the top and
// the bottom. Only out walking: it fades out in menus, panels and dialogs, inside the Game Hall and the cottage
// (boards and signs with text), and with Strong outlines on (a blurred outline is a weaker one). Name tags and the
// HUD are page text over the picture and are never blurred.

// [hour, [r, g, b] tint, saturation]: warm morning, neutral day, golden evening, cool blue night
const GRADE = [
  [0, [0.9, 0.96, 1.1], 0.95], [4.6, [0.9, 0.96, 1.1], 0.95],
  [6, [1.08, 1.0, 0.9], 1.04], [8.5, [1.05, 1.0, 0.94], 1.04], [10.5, [1, 1, 1], 1.03],
  [16, [1, 1, 1], 1.03], [18.5, [1.08, 1.0, 0.86], 1.06], [20, [1.0, 0.95, 1.05], 1.0],
  [21.5, [0.9, 0.96, 1.1], 0.95], [24, [0.9, 0.96, 1.1], 0.95],
];
// the season on top: winter a little cooler and brighter, autumn a little warmer, spring a little fresher
const SEASON_TINT = { spring: [[1, 1.01, 1], 1.02], summer: [[1, 1, 1], 1], autumn: [[1.03, 1, 0.96], 1.02], winter: [[1.0, 1.03, 1.08], 0.97] };

function gradeAt(h, season) {
  let i = 0;
  while (i < GRADE.length - 2 && GRADE[i + 1][0] <= h) i++;
  const [h0, a, sa] = GRADE[i], [h1, b, sb] = GRADE[i + 1];
  const k = h1 > h0 ? THREE.MathUtils.clamp((h - h0) / (h1 - h0), 0, 1) : 0;
  const [st, ss] = SEASON_TINT[season] || SEASON_TINT.summer;
  return { tint: [0, 1, 2].map((c) => (a[c] + (b[c] - a[c]) * k) * st[c]), sat: (sa + (sb - sa) * k) * ss };
}

const RIM = { uRim: { value: 0 }, uRimColor: { value: new THREE.Color() } };
const rimCopies = new WeakMap();
/** A copy of a toon material with a faint rim of light on its edges (fresnel; RIM.uRim says how much). */
function rimOf(m) {
  let c = rimCopies.get(m);
  if (c) return c;
  c = m.clone();
  c.userData = { rimOf: m, ...(m.userData?.shared ? { shared: true } : {}) }; // (a copy of a shared material is kept like it)
  c.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, RIM);
    sh.fragmentShader = 'uniform float uRim;\nuniform vec3 uRimColor;\n' + sh.fragmentShader.replace('#include <opaque_fragment>',
      'outgoingLight += uRimColor * uRim * pow( 1.0 - clamp( dot( normal, geometryViewDir ), 0.0, 1.0 ), 3.0 );\n#include <opaque_fragment>');
  };
  c.customProgramCacheKey = () => 'rim';
  rimCopies.set(m, c);
  return c;
}

const WIND = { uWindT: { value: 0 }, uWind: { value: 0 } };
const swayCopies = new WeakMap();
/** A copy of a (baked, world-space) leaf or grass material that sways in the wind. */
function swayOf(m) {
  let c = swayCopies.get(m);
  if (c) return c;
  c = m.clone();
  c.userData = { swayOf: m, ...(m.userData?.shared ? { shared: true } : {}) };
  c.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, WIND);
    sh.vertexShader = 'uniform float uWindT;\nuniform float uWind;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      {
        vec3 wp = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;
        float ph = uWindT * 1.7 + wp.x * 0.31 + wp.z * 0.23;
        float s = sin( ph ) * 0.7 + sin( ph * 2.3 + wp.y * 1.7 ) * 0.3;
        float f = sin( uWindT * 5.1 + wp.x * 2.1 + wp.y * 3.3 + wp.z * 1.7 ); // a little flutter, leaf by leaf
        transformed += vec3( 0.9, 0.0, 0.45 ) * s * uWind + vec3( 0.3, 0.25, -0.3 ) * f * uWind * 0.35;
      }`);
  };
  c.customProgramCacheKey = () => 'sway';
  swayCopies.set(m, c);
  return c;
}

const WATER = { uFoam: { value: 0 }, uWaterT: { value: 0 }, uFoamColor: { value: new THREE.Color(1, 1, 1) }, uShore: { value: null }, uShoreMin: { value: new THREE.Vector2() }, uShoreSize: { value: new THREE.Vector2(1, 1) } };

/** A soft round dark patch (the contact shading), white in the middle fading out: used as alpha. */
function blobTexture() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const g = cv.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.45, 'rgba(255,255,255,0.75)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(cv);
}

const _v = new THREE.Vector3();

export class IslandLook {
  constructor(host) {
    this.host = host;
    this.gfx = host.game.gfx;
    this.t = 0;
    this.pulse = 0; // the bloom's slow breath now (0 with "Reduce flashing")
    this.saved = [];
    this.ownBall();
    this.rimmed = []; // [mesh, its own material] while the rim light is on
    this.sweepT = 0;
    this.blobs = null;
  }

  // ---------- a living world ----------

  /** The water's depth near the shore, as a small texture: 0 at the waterline, 1 a metre and more below it. */
  shoreMap() {
    const H = this.host, N = 192;
    const x0 = -85, z0 = -74, W = 170, D = 160;
    const data = new Uint8Array(N * N);
    const sea = H.map.water.position.y;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const h = heightAt(x0 + (i + 0.5) / N * W, z0 + (j + 0.5) / N * D);
      data[j * N + i] = Math.round(THREE.MathUtils.clamp((sea - h) / 1.2, 0, 1) * 255);
    }
    for (let k = 0; k < N; k++) data[k] = data[(N - 1) * N + k] = data[k * N] = data[k * N + N - 1] = 255; // the open sea round it
    const tex = new THREE.DataTexture(data, N, N, THREE.RedFormat);
    tex.magFilter = tex.minFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    WATER.uShore.value = tex;
    WATER.uShoreMin.value.set(x0, z0);
    WATER.uShoreSize.value.set(W, D);
    this.shoreTex = tex;
  }

  /** The foam and glints, added to the island's own water material once (off while uFoam is 0). */
  patchWater() {
    const m = this.host.map.water.material;
    if (this.waterPatched) return;
    this.waterPatched = true;
    this.shoreMap();
    const prev = m.onBeforeCompile, prevKey = m.customProgramCacheKey;
    m.onBeforeCompile = (sh, r) => {
      if (prev && prev !== THREE.Material.prototype.onBeforeCompile) prev.call(m, sh, r);
      Object.assign(sh.uniforms, WATER);
      sh.vertexShader = 'varying vec2 vWaterXZ;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vWaterXZ = ( modelMatrix * vec4( transformed, 1.0 ) ).xz;');
      sh.fragmentShader = 'varying vec2 vWaterXZ;\nuniform float uFoam;\nuniform float uWaterT;\nuniform vec3 uFoamColor;\nuniform sampler2D uShore;\nuniform vec2 uShoreMin;\nuniform vec2 uShoreSize;\n'
        + sh.fragmentShader.replace('#include <opaque_fragment>', `
        if ( uFoam > 0.0 ) {
          float depth = texture2D( uShore, ( vWaterXZ - uShoreMin ) / uShoreSize ).r;
          float wob = sin( uWaterT * 1.1 + vWaterXZ.x * 0.45 + vWaterXZ.y * 0.3 ) * 0.035;
          float edge = 1.0 - smoothstep( 0.05, 0.13 + wob, depth );
          float ring = fract( uWaterT * 0.09 + vWaterXZ.x * 0.004 );
          float line = ( 1.0 - smoothstep( 0.0, 0.025, abs( depth - 0.1 - ring * 0.25 ) ) ) * ( 1.0 - ring ) * 0.6;
          float foam = clamp( max( edge, line ), 0.0, 1.0 ) * uFoam;
          float g = sin( vWaterXZ.x * 0.8 + uWaterT * 0.7 + sin( vWaterXZ.y * 0.35 ) * 1.5 ) * sin( vWaterXZ.y * 0.62 - uWaterT * 0.5 );
          float glint = smoothstep( 0.93, 0.995, g ) * smoothstep( 0.3, 0.6, depth ) * uFoam;
          outgoingLight = mix( outgoingLight, uFoamColor, foam * 0.8 ) + uFoamColor * glint * 0.13;
          diffuseColor.a = mix( diffuseColor.a, 1.0, foam * 0.8 );
        }
        #include <opaque_fragment>`);
    };
    m.customProgramCacheKey = () => (prevKey && prevKey !== THREE.Material.prototype.customProgramCacheKey ? prevKey.call(m) : '') + '|foam';
    m.needsUpdate = true;
  }

  /** The baked meshes that sway: the leaves (seasonlook.js keeps them) and the grass tufts. */
  swayMeshes() {
    if (this.sways) return this.sways;
    const H = this.host;
    const leaves = (H.seasons?.look?.leaves || []).map((L) => L.m);
    const tufts = (H.map.baked?.children || []).filter((m) => (m.material?.userData?.swayOf || m.material)?.color?.getHex?.() === 0x6fbf4a);
    this.sways = [...new Set([...leaves, ...tufts])];
    return this.sways;
  }

  updateLife(dt, on) {
    const H = this.host;
    // the wind: a breeze, twice as strong on a rainy day, three times after a storm (events.js)
    const want = !on ? 0 : 0.045 * (H.events?.kind === 'storm' ? 3 : H.seasons?.rainy ? 2 : 1);
    this.wind = (this.wind ?? want) + (want - (this.wind ?? want)) * Math.min(1, dt * 0.5);
    WIND.uWind.value = this.wind;
    WIND.uWindT.value = this.t;
    for (const m of this.swayMeshes()) {
      const cur = m.material;
      if (on && !cur.userData?.swayOf) m.material = swayOf(cur);
      else if (!on && cur.userData?.swayOf) m.material = cur.userData.swayOf;
    }
    if (on) this.patchWater();
    WATER.uFoam.value = on ? 1 : 0;
    WATER.uWaterT.value = this.t;
    const n = H.night || 0;
    WATER.uFoamColor.value.setRGB(1 - 0.55 * n, 1 - 0.5 * n, 1 - 0.4 * n);
    // fireflies: each glows on and off slowly (life.js draws them; steady with "Reduce flashing")
    H.life && (H.life.twinkle = on && !calmOn());
    H.seasons?.look && (H.seasons.look.tumble = on);
  }

  // ---------- softer light ----------

  /** The contact shading: one instanced mesh for the map's footprints, one small patch per bean and villager. */
  makeBlobs() {
    const H = this.host;
    this.blobTex = blobTexture();
    const mat = new THREE.MeshBasicMaterial({ color: 0x000000, alphaMap: this.blobTex, transparent: true, opacity: 0.32, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    mat.userData = { noCut: true }; // (the see-through around the bean leaves it alone: seethrough.js)
    const geo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    const F = H.map.footprints || [];
    const inst = new THREE.InstancedMesh(geo, mat, Math.max(1, F.length));
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), n = new THREE.Vector3(), p = new THREE.Vector3(), sc = new THREE.Vector3();
    const hAt = (x, z) => H.map.floorAt(x, z, true);
    F.forEach((f, i) => {
      const e = 0.4;
      n.set(hAt(f.x - e, f.z) - hAt(f.x + e, f.z), 2 * e, hAt(f.x, f.z - e) - hAt(f.x, f.z + e)).normalize();
      q.setFromUnitVectors(up, n);
      p.set(f.x, hAt(f.x, f.z) + 0.04, f.z);
      sc.set(f.w * 1.25 + 0.3, 1, f.d * 1.25 + 0.3);
      inst.setMatrixAt(i, m4.compose(p, q, sc));
    });
    inst.count = F.length;
    inst.frustumCulled = false;
    inst.renderOrder = -2;
    inst.raycast = () => {};
    this.blobs = inst;
    H.scene.add(inst);
    // the beans and villagers: a patch each, moved every frame
    this.feetMat = mat.clone();
    this.feetMat.opacity = 0.38;
    this.feetMat.userData = { noCut: true };
    this.feet = new THREE.Group();
    H.scene.add(this.feet);
  }

  /** Every frame with the softer light on: the patches under the beans and villagers follow them. */
  updateFeet() {
    const H = this.host;
    const who = [H.player && { x: H.player.x, z: H.player.z, y: H.player.y, vis: H.player.ch.group.visible, air: (H.player.jy || 0) + (H.player.air ? 0.5 : 0) },
      ...(H.npcs || []).map((n) => ({ x: n.x, z: n.z, y: n.y, vis: n.model.group.visible, air: 0 }))].filter(Boolean);
    while (this.feet.children.length < who.length) {
      const m = new THREE.Mesh(this.blobs.geometry, this.feetMat);
      m.renderOrder = -2;
      m.scale.set(1.15, 1, 1.15);
      this.feet.add(m);
    }
    this.feet.children.forEach((m, i) => {
      const w = who[i];
      m.visible = !!w && w.vis;
      if (!m.visible) return;
      const g = H.map.floorAt(w.x, w.z, H.save.unlocks.bridge);
      m.position.set(w.x, Math.min(w.y ?? g, g + 10) + 0.03, w.z);
      const k = Math.max(0.4, 1 - w.air * 0.6); // smaller in the air
      m.scale.set(1.15 * k, 1, 1.15 * k);
    });
  }

  /** The meshes that get the rim light: the bean's and every villager's (not their outline hulls, not tiny ones). */
  rimMeshes() {
    const H = this.host, out = [];
    const take = (g) => g?.traverse((o) => {
      if (!o.isMesh || o.userData.hull || !o.material || Array.isArray(o.material)) return;
      const m = o.material.userData?.rimOf || o.material;
      if (!m.isMeshToonMaterial || m.transparent) return;
      if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
      if (o.geometry.boundingSphere.radius * Math.max(o.scale.x, o.scale.y) < 0.12) return; // (eyes, buttons)
      out.push(o);
    });
    take(H.player?.ch.group);
    for (const n of H.npcs || []) take(n.model.group);
    return out;
  }

  setRim(on) {
    if (!on) {
      for (const [o, m] of this.rimmed) if (o.material?.userData?.rimOf) o.material = m;
      this.rimmed = [];
      return;
    }
    for (const o of this.rimMeshes()) {
      const mat = o.material;
      if (mat.userData?.rimOf) continue;
      this.rimmed.push([o, mat]);
      o.material = rimOf(mat);
    }
  }

  updateLight(dt, on) {
    const H = this.host;
    const sun = H.lights?.sun;
    if (sun) sun.shadow.radius = on ? 4 : 1;
    if (on && !this.blobs) this.makeBlobs();
    if (this.blobs) { this.blobs.visible = on; this.feet.visible = on; }
    if (on) this.updateFeet();
    // the rim: the sky's colour, faint, fainter at night
    RIM.uRim.value = on ? 0.28 * (1 - 0.5 * (H.night || 0)) : 0;
    if (H.lights) RIM.uRimColor.value.copy(H.lights.hemi.color);
    this.sweepT -= dt;
    if (on !== this.rimOn || (on && this.sweepT <= 0)) { this.sweepT = 1; this.rimOn = on; this.setRim(on); }
  }

  /** The magic ball's little stars share a material with other things: give the ball its own, so only it glows. */
  ownBall() {
    const B = this.host.odd?.ball;
    this.ballMats = new Set();
    for (const g of [B?.ball, B?.handBall]) {
      g?.traverse((o) => {
        if (!o.isMesh || !o.material?.isMeshBasicMaterial) return;
        o.material = o.material.clone();
        o.material.userData = {};
        this.ballMats.add(o.material);
      });
    }
    if (B?.dots?.children[0]) this.ballMats.add(B.dots.children[0].material);
  }

  /** The glowing materials: { night: [opaque], always: [opaque], blend: [see-through] }. */
  glowMats() {
    const H = this.host, M = H.M;
    return {
      night: [M.lamp, M.win, M.screen, H.story?.lampMat, H.greenhouse?.lampMat, ...Object.values(M.home || {})].filter(Boolean),
      always: [...this.ballMats].filter((m) => !m.transparent).concat((H.events?.lanterns || []).map((l) => l.material)),
      blend: [M.beam, H.life?.flyMat, ...[...this.ballMats].filter((m) => m.transparent)].filter(Boolean),
    };
  }

  /** [material, 'color' | 'emissive', factor]: a little brighter while drawn with the glow (at night). */
  boostList() {
    const H = this.host, M = H.M;
    const lit = this.lit;
    const out = [];
    const add = (m, prop, k) => { if (m && k > 1.001) out.push([m, prop, k]); };
    add(M.lamp, 'color', 1 + 0.5 * lit);
    add(H.story?.lampMat, 'color', 1 + 0.5 * lit);
    add(H.greenhouse?.lampMat, 'color', 1 + 0.3 * lit);
    add(M.win, 'emissive', 1 + 1.2 * lit);
    for (const m of Object.values(M.home || {})) add(m, 'emissive', 1 + 1.2 * lit);
    add(M.beam, 'color', 1 + 0.2 * lit);
    return out;
  }

  /** How lit the lamps are (0 by day, 1 at night: island.js applySky). */
  get lit() {
    const n = this.host.night || 0;
    return n > 0.3 ? Math.min(1, (n - 0.3) * 2 + 0.3) : 0;
  }

  update(dt) {
    this.t += dt;
    const on = this.gfx.on;
    this.updateLight(dt, on.light);
    this.updateLife(dt, on.life);
    // the miniature look: eased in and out (0.3 s)
    const H = this.host;
    const want = on.mini && H.mode === 'walk' && !H.indoors && (H.hallCam || 0) < 0.5 && !H.game.contrastOn ? 1 : 0;
    this.tilt = dt ? (this.tilt ?? want) + (want - (this.tilt ?? want)) * Math.min(1, dt * 6) : want;
    if (!on.mini) this.tilt = 0; // (switched off: at once)
    // the slow breath of the glow (0.2 Hz, a few percent): none with "Reduce flashing"
    this.pulse = calmOn() ? 0 : Math.sin(this.t * Math.PI * 0.4) * 0.08;
  }

  /** What the post-processing needs this frame (core/gfx.js render()). */
  frameLook() {
    const H = this.host;
    const g = gradeAt(H.hour ?? 12, H.seasons?.season);
    const P = H.player;
    let focus = 0.5;
    if (P) { _v.set(P.x, P.y + (P.jy || 0) + 0.6, P.z).project(H.camera); focus = THREE.MathUtils.clamp((_v.y + 1) / 2, 0.2, 0.8); }
    return { tint: g.tint, sat: g.sat, bloom: 1 + this.pulse, tilt: this.tilt ?? 0, focus };
  }

  render(renderer) {
    const H = this.host;
    const on = this.gfx.on;
    let G = null;
    if (on.glow) {
      G = this.glowMats();
      if (!this.marked) { this.marked = true; for (const m of G.night) markGlow(m, 'night'); for (const m of G.always) markGlow(m, 'always'); }
      for (const m of G.always) markGlow(m, 'always'); // (the ghost ship's lanterns come with a rare event)
      for (const m of G.blend) glowBlend(m, true);
      GLOW.night.value = this.lit > 0 ? 1 + this.lit : 0;
      GLOW.always.value = 2;
      this.saved = this.boostList();
      for (const s of this.saved) { const c = s[0][s[1]]; s.push(c.r, c.g, c.b); c.multiplyScalar(s[2]); }
    }
    try {
      this.gfx.render(H.scene, H.camera, this.frameLook());
    } finally {
      for (const [m, prop, , r, g, b] of this.saved) m[prop].setRGB(r, g, b);
      this.saved = [];
      GLOW.night.value = GLOW.always.value = 0;
      if (G) for (const m of G.blend) glowBlend(m, false);
    }
  }

  dispose() {
    this.setRim(false);
    WATER.uFoam.value = 0;
    WIND.uWind.value = 0;
    this.shoreTex?.dispose();
    this.blobTex?.dispose();
    this.feetMat?.dispose();
  }
}
