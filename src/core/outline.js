import * as THREE from 'three';

// "Strong outlines" ("Help me play", core/assist.js): thick outlines on what matters, drawn as an inverted hull
// (a slightly bigger copy of the mesh, back faces only). Models say what they are with markA11y(obj, kind);
// main.js adds or removes the hulls in the scene on screen (refreshOutlines) when the setting changes and,
// while it is on, now and then for things spawned since. Never colour alone: an enemy's or target's
// outline is thick and dark, a player's thinner and white, an interactable's a white dashed-looking double ring.
//
// kinds: 'player' (the beans), 'enemy' (grumbles, aliens, monsters), 'target' (what you shoot or throw at),
// 'item' (things to pick up or use), 'edge' (ledges and platforms you must land on).

const STYLE = {
  player: { color: 0xffffff, grow: 0.07 },
  enemy: { color: 0x14101f, grow: 0.12 },
  target: { color: 0x14101f, grow: 0.14 },
  item: { color: 0xffffff, grow: 0.1 },
  edge: { color: 0x14101f, grow: 0.04 },
};
const mats = {};
function hullMat(kind) {
  if (!mats[kind]) {
    mats[kind] = new THREE.MeshBasicMaterial({ color: STYLE[kind].color, side: THREE.BackSide });
    mats[kind].userData.shared = true; // BaseScene.dispose() leaves it alone
  }
  return mats[kind];
}

/** Say what a model is, so "Strong outlines" can outline it. meshes: which meshes (default: the biggest few). */
export function markA11y(obj, kind, meshes = null) {
  obj.userData.a11y = kind;
  if (meshes) obj.userData.a11yMeshes = meshes;
  return obj;
}

function pickMeshes(obj) {
  if (obj.userData.a11yMeshes) return obj.userData.a11yMeshes;
  if (obj.userData.body?.isMesh) return [obj.userData.body];
  if (obj.isMesh) return [obj];
  const list = [];
  obj.traverse((o) => {
    if (!o.isMesh || o.userData.hull || !o.geometry) return;
    if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
    list.push(o);
  });
  list.sort((a, b) => b.geometry.boundingSphere.radius * b.scale.x - a.geometry.boundingSphere.radius * a.scale.x);
  return list.slice(0, 3);
}

/** Add (on) or remove (off) the outline hulls of every marked model under root. Cheap when nothing changes. */
export function refreshOutlines(root, on) {
  if (!root) return;
  const marked = [];
  root.traverse((o) => { if (o.userData.a11y) marked.push(o); });
  for (const o of marked) {
    if (on && !o.userData.hulls) {
      const st = STYLE[o.userData.a11y] || STYLE.item;
      o.userData.hulls = pickMeshes(o).map((m) => {
        if (!m.geometry.boundingSphere) m.geometry.computeBoundingSphere();
        const h = new THREE.Mesh(m.geometry, hullMat(o.userData.a11y));
        h.userData.hull = true;
        h.scale.setScalar(1 + st.grow / Math.max(0.2, (m.geometry.boundingSphere?.radius || 0.5)) * 0.5);
        h.castShadow = false;
        h.receiveShadow = false;
        h.renderOrder = -1;
        m.add(h);
        return h;
      });
    } else if (!on && o.userData.hulls) {
      for (const h of o.userData.hulls) h.removeFromParent();
      o.userData.hulls = null;
    }
  }
}
