import * as THREE from 'three';

// One palette for every scene keeps the games looking like one world.
export const PLAYER_COLORS = [
  { name: 'Coral', hex: 0xff5d73, css: '#ff5d73' },
  { name: 'Sunny', hex: 0xffc93c, css: '#ffc93c' },
  { name: 'Mint', hex: 0x3ddc97, css: '#3ddc97' },
  { name: 'Sky', hex: 0x4cc9f0, css: '#4cc9f0' },
  { name: 'Grape', hex: 0x9b5de5, css: '#9b5de5' },
  { name: 'Tangerine', hex: 0xff8c42, css: '#ff8c42' },
];

export const COLORS = {
  grass: 0x7ad65a,
  grassDark: 0x58b947,
  dirt: 0xd99a62,
  dirtDark: 0xb87a48,
  sand: 0xf7e1a6,
  water: 0x56c6f0,
  waterDeep: 0x3aa6e0,
  cloud: 0xffffff,
  trunk: 0xa0704a,
  leaf: 0x4cc46a,
  leafLight: 0x86e070,
  rock: 0xbdb8cf,
  rockDark: 0x9a94b2,
  candyPink: 0xff9fd0,
  candyBlue: 0x8fd8ff,
  candyYellow: 0xffe47a,
  candyMint: 0x9ff0c8,
  candyLilac: 0xc9a8ff,
  icing: 0xfffaf2,
  gold: 0xffd23f,
  white: 0xffffff,
  ink: 0x2b2340,
  blush: 0xff8fa8,
  cream: 0xfff3dc,
};

let gradientMap = null;
function getGradientMap() {
  if (!gradientMap) {
    // Three soft bands: shadow, mid, lit.
    const data = new Uint8Array([150, 150, 150, 255, 205, 205, 205, 255, 255, 255, 255, 255]);
    gradientMap = new THREE.DataTexture(data, 3, 1);
    gradientMap.minFilter = THREE.NearestFilter;
    gradientMap.magFilter = THREE.NearestFilter;
    gradientMap.needsUpdate = true;
  }
  return gradientMap;
}

const cache = new Map();

/**
 * Shared toon material. Materials are cached and never disposed.
 * `flat` is kept as a cache key only: toon materials can't flat-shade, so use faceted() geometry for that look.
 */
export function toon(color, { flat = false, transparent = false, opacity = 1, emissive = 0x000000 } = {}) {
  const key = `${color}|${flat}|${transparent}|${opacity}|${emissive}`;
  let m = cache.get(key);
  if (!m) {
    m = new THREE.MeshToonMaterial({
      color,
      gradientMap: getGradientMap(),
      transparent,
      opacity,
      emissive,
    });
    m.userData.shared = true;
    cache.set(key, m);
  }
  return m;
}

export function basic(color, opts = {}) {
  const key = `basic|${color}|${opts.transparent}|${opts.opacity}`;
  let m = cache.get(key);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ color, ...opts });
    m.userData.shared = true;
    cache.set(key, m);
  }
  return m;
}

const geoCache = new Map();

/** Recomputes normals per face so toon shading reads as low-poly facets. */
export function faceted(geo) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  g.computeVertexNormals();
  return g;
}

/** Shared geometry; created once, flagged so scene disposal skips it. */
export function sharedGeo(key, make) {
  let g = geoCache.get(key);
  if (!g) {
    g = make();
    g.userData.shared = true;
    geoCache.set(key, g);
  }
  return g;
}
