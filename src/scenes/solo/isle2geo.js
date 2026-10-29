// Shell Isle (milestone B3): the shape and places of the small second island far south of the main one,
// reached by Grumbleton's boat. Pure numbers and functions (no imports), so map.js can fold the isle into
// heightAt() without a circular import; the props and gameplay live in isle2.js.

export const ISLE2 = { x: 0, z: 190, rx: 21, rz: 15 };
export const ISLE2_DOCK = { x: 0, z0: 168.5, z1: 176.8, w: 2.4, y: 0.12 };
export const ISLE2_BOAT = { x: 2.9, z: 170.6 };
export const ISLE2_ARRIVE = { x: 0, z: 177.6 };
export const COVE = { x: -18.5, z: 193.5, r: 4.6 }; // the hidden cove on the west side, behind rocks
export const POOLS = [{ x: 16.2, z: 186.5 }, { x: 17.6, z: 191.6 }, { x: 15.2, z: 196.4 }]; // tide pools on the east beach
export const PALMS = [[-6, 184], [-9.5, 189], [8.5, 196], [-3.5, 199.5], [11, 182.5], [-12, 197]];
export const BERRIES = [[-4, 193.5], [3, 197.5], [-11.5, 183.5]];
export const DIGS = [[12.5, 199.5], [-7.5, 201.5], [4.5, 202.5], [-14.5, 186.5]];
export const HUT = { x: 6.5, z: 187 };
export const ISLE2_SPOTS = {
  shelbyHut: { x: 5.2, z: 189.6 }, tidepools: { x: 14.4, z: 191.5 }, isleBeach: { x: -1.5, z: 201.5 },
  shelbyVisit: { x: 21.2, z: 38.6 }, // on the main island's beach, on visiting days
};

const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** Is (x, z) in Shell Isle's area (for heightAt and the fish spots)? */
export const nearIsle2 = (x, z) => z > 150;

/** Shell Isle's ground height: a gentle hill, sandy shores, the cove and three tide pools. */
export function isle2Height(x, z) {
  const dx = (x - ISLE2.x) / ISLE2.rx, dz = (z - ISLE2.z) / ISLE2.rz;
  const a = Math.atan2(dz, dx);
  const wob = 1 + 0.06 * Math.sin(a * 3 + 1) + 0.04 * Math.sin(a * 7);
  const d = Math.hypot(dx, dz) / wob;
  if (d > 1.35) return -6;
  let h = -1.4 + 1.7 * sstep(1.02, 0.82, d) + 1.1 * sstep(0.55, 0.1, d);
  const cd = Math.hypot(x - COVE.x, z - COVE.z) / COVE.r;
  if (cd < 1.3) h = Math.min(h, -1.7 + 2.0 * sstep(0.7, 1.15, cd));
  for (const p of POOLS) {
    const pd = Math.hypot(x - p.x, z - p.z);
    if (pd < 1.6) h = Math.min(h, -0.95 + 1.2 * sstep(0.7, 1.5, pd));
  }
  return h;
}

/** Is a water point inside the hidden cove? */
export const inCove = (x, z) => Math.hypot(x - COVE.x, z - COVE.z) < COVE.r + 0.5;
