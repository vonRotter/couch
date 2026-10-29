import * as THREE from 'three';

// Little pictures of 3D models (fish, sea finds, dishes) for the hotbar, fish log, recipe book and café
// orders: rendered once with the game's renderer into a render target, cached as data URLs.

const SIZE = 192, OUT = 96;
const cache = new Map();
let scene = null, cam = null, rt = null;

const srgb = (v) => {
  const c = v / 255;
  const s = c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  return Math.round(Math.min(1, Math.max(0, s)) * 255);
};

/** Data URL of a model's picture. make() builds the model; pose: { rx, ry, rz }. */
export function thumb(renderer, key, make, pose = {}) {
  if (cache.has(key)) return cache.get(key);
  if (!renderer) return '';
  if (!scene) {
    scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xffffff, 0xb8c8d8, 1.7));
    const sun = new THREE.DirectionalLight(0xffffff, 1.7);
    sun.position.set(-1, 2, 3);
    scene.add(sun);
    cam = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
    rt = new THREE.WebGLRenderTarget(SIZE, SIZE);
  }
  const holder = new THREE.Group();
  const model = make();
  model.rotation.set(pose.rx || 0, pose.ry || 0, pose.rz || 0);
  holder.add(model);
  scene.add(holder);
  const sphere = new THREE.Box3().setFromObject(holder).getBoundingSphere(new THREE.Sphere());
  holder.position.sub(sphere.center);
  const dist = (sphere.radius / Math.sin(THREE.MathUtils.degToRad(15))) * 1.02;
  cam.position.set(0, 0, dist);
  cam.lookAt(0, 0, 0);
  cam.near = dist * 0.1; cam.far = dist * 3;
  cam.updateProjectionMatrix();
  const prevTarget = renderer.getRenderTarget();
  const prevColor = renderer.getClearColor(new THREE.Color());
  const prevAlpha = renderer.getClearAlpha();
  renderer.setRenderTarget(rt);
  renderer.setClearColor(0x000000, 0);
  renderer.clear();
  renderer.render(scene, cam);
  const px = new Uint8Array(SIZE * SIZE * 4);
  renderer.readRenderTargetPixels(rt, 0, 0, SIZE, SIZE, px);
  renderer.setRenderTarget(prevTarget);
  renderer.setClearColor(prevColor, prevAlpha);
  scene.remove(holder);
  const big = document.createElement('canvas');
  big.width = big.height = SIZE;
  const bg = big.getContext('2d');
  const img = bg.createImageData(SIZE, SIZE);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const si = ((SIZE - 1 - y) * SIZE + x) * 4, di = (y * SIZE + x) * 4;
      img.data[di] = srgb(px[si]); img.data[di + 1] = srgb(px[si + 1]); img.data[di + 2] = srgb(px[si + 2]); img.data[di + 3] = px[si + 3];
    }
  }
  bg.putImageData(img, 0, 0);
  const small = document.createElement('canvas');
  small.width = small.height = OUT;
  const sg = small.getContext('2d');
  sg.imageSmoothingQuality = 'high';
  sg.drawImage(big, 0, 0, OUT, OUT);
  const url = small.toDataURL('image/png');
  cache.set(key, url);
  return url;
}
