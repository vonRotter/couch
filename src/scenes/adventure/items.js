import * as THREE from 'three';
import { makeSpoon, makeDuck, makeNote } from './props.js';

// Inventory items: a name, a 3D toon model (also used for the bar icon), what Pip says when
// looking at it, and item-on-item combinations. Item-on-hotspot uses live with the hotspot
// (rooms.js, `useItem`), so each room decides what an item does there.
//
//   look:    a string key Pip says, or a generator script (s) => ...
//   combine: { otherItemId: key or script }   (either order works)
//   pose:    rotation/scale for the icon camera

export const ITEMS = {
  spoon: {
    name: 'adv.item.spoon',
    model: makeSpoon,
    look: 'adv.item.spoon.look',
    combine: { duck: 'adv.item.spoonDuck', note: 'adv.item.spoonNote' },
    pose: { rx: 0.2, ry: 0.3, rz: -0.7 },
  },
  duck: {
    name: 'adv.item.duck',
    model: makeDuck,
    look: function* look(s) {
      s.sfx('squeak');
      yield s.say('pip', 'adv.item.duck.look');
    },
    combine: { note: 'adv.item.duckNote' },
    pose: { rx: 0.25, ry: -0.6, rz: 0 },
  },
  note: {
    name: 'adv.item.note',
    model: makeNote,
    look: function* look(s) {
      yield s.say('note', 'adv.dock.note');
      yield s.say('pip', 'adv.item.note.look');
    },
    pose: { rx: -0.1, ry: 0.25, rz: 0.1 },
  },
};

/** Item-on-item response (either order), or null for the generic one. */
export function combineResponse(a, b) {
  return ITEMS[a]?.combine?.[b] || ITEMS[b]?.combine?.[a] || null;
}

// ---------- icons: the 3D model rendered once into a small picture ----------

const icons = new Map();
let iconScene = null;
let iconCam = null;
let rt = null;
const SIZE = 192;
const OUT = 96;

function srgb(c) {
  const v = c / 255;
  const s = v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
  return Math.round(Math.min(1, Math.max(0, s)) * 255);
}

/** Data URL of an item's icon, rendered with the game's renderer (cached). */
export function itemIcon(renderer, id) {
  if (icons.has(id)) return icons.get(id);
  const def = ITEMS[id];
  if (!def || !renderer) return '';
  if (!iconScene) {
    iconScene = new THREE.Scene();
    iconScene.add(new THREE.HemisphereLight(0xffffff, 0xb8a8d8, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 1.8);
    sun.position.set(-1, 2, 3);
    iconScene.add(sun);
    iconCam = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
    rt = new THREE.WebGLRenderTarget(SIZE, SIZE);
  }
  const model = def.model();
  const p = def.pose || {};
  model.rotation.set(p.rx || 0, p.ry || 0, p.rz || 0);
  const holder = new THREE.Group();
  holder.add(model);
  iconScene.add(holder);
  // Center and fit the model
  const box = new THREE.Box3().setFromObject(holder);
  const sphere = box.getBoundingSphere(new THREE.Sphere());
  holder.position.sub(sphere.center);
  const dist = sphere.radius / Math.sin(THREE.MathUtils.degToRad(15)) * 1.02;
  iconCam.position.set(0, 0, dist);
  iconCam.lookAt(0, 0, 0);
  iconCam.near = dist * 0.1; iconCam.far = dist * 3;
  iconCam.updateProjectionMatrix();

  const prevTarget = renderer.getRenderTarget();
  const prevColor = renderer.getClearColor(new THREE.Color());
  const prevAlpha = renderer.getClearAlpha();
  const prevAuto = renderer.shadowMap.autoUpdate;
  renderer.setRenderTarget(rt);
  renderer.setClearColor(0x000000, 0);
  renderer.clear();
  renderer.render(iconScene, iconCam);
  const px = new Uint8Array(SIZE * SIZE * 4);
  renderer.readRenderTargetPixels(rt, 0, 0, SIZE, SIZE, px);
  renderer.setRenderTarget(prevTarget);
  renderer.setClearColor(prevColor, prevAlpha);
  renderer.shadowMap.autoUpdate = prevAuto;
  iconScene.remove(holder);

  // Flip, convert to sRGB, then scale down for smooth edges.
  const big = document.createElement('canvas');
  big.width = big.height = SIZE;
  const bg = big.getContext('2d');
  const img = bg.createImageData(SIZE, SIZE);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const si = ((SIZE - 1 - y) * SIZE + x) * 4;
      const di = (y * SIZE + x) * 4;
      img.data[di] = srgb(px[si]);
      img.data[di + 1] = srgb(px[si + 1]);
      img.data[di + 2] = srgb(px[si + 2]);
      img.data[di + 3] = px[si + 3];
    }
  }
  bg.putImageData(img, 0, 0);
  const small = document.createElement('canvas');
  small.width = small.height = OUT;
  const sg = small.getContext('2d');
  sg.imageSmoothingQuality = 'high';
  sg.drawImage(big, 0, 0, OUT, OUT);
  const url = small.toDataURL('image/png');
  icons.set(id, url);
  return url;
}
