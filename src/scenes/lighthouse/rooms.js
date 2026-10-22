// All rooms of Lighthouse Caves, grouped in areas, plus the shared door table.
// Pure data: also imported by the reachability checker (solver.js) in Node.

import { W, H, DIRS, DOOR_TILES } from './tiles.js';
import { OVER_ROOMS, INSIDE_ROOMS, CAVE_ROOMS } from './rooms-over.js';
import { D1_ROOMS } from './rooms-d1.js';
import { D2_ROOMS } from './rooms-d2.js';

export const AREAS = {
  over: { name: 'lh.area.over', theme: 'over', music: 'lhOver', scroll: true },
  in: { name: 'lh.area.over', theme: 'house', music: 'lhOver' },
  cave: { name: 'lh.area.cave', theme: 'cave', music: 'lhCave', scroll: true },
  d1: { name: 'lh.area.d1', theme: 'cellar', music: 'lhDungeon', scroll: true, dungeon: true, cols: [1, 3], rows: [0, 4] },
  d2: { name: 'lh.area.d2', theme: 'grotto', music: 'lhDungeon', scroll: true, dungeon: true, cols: [0, 3], rows: [0, 4] },
};

export const START = { room: 'h_keeper', at: [8, 4], face: 's' };

export const ROOMS = {};
for (const [area, list] of [['over', OVER_ROOMS], ['in', INSIDE_ROOMS], ['cave', CAVE_ROOMS], ['d1', D1_ROOMS], ['d2', D2_ROOMS]]) {
  for (const [id, def] of Object.entries(list)) ROOMS[id] = { id, area, ...def, theme: def.theme || AREAS[area].theme };
}

// Grid lookup per area: "area:gx,gy" -> room id
const GRID = {};
for (const r of Object.values(ROOMS)) GRID[`${r.area}:${r.gx},${r.gy}`] = r.id;

/** The room next to `id` in direction d (same area), or null. */
export function neighbor(id, d) {
  const r = ROOMS[id];
  const v = DIRS[d];
  return GRID[`${r.area}:${r.gx + v.dx},${r.gy + v.dz}`] || null;
}

/** Shared door id for the wall between two rooms. */
export const doorId = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);

// Doors: each is written in one (or both, identically) of the rooms it joins. DOORS[room][dir] =
// { id, type, owner } where owner is the room whose `solve` opens a 'shut' door.
export const DOORS = {};
export const DOOR_ERRORS = [];
for (const r of Object.values(ROOMS)) {
  for (const [d, type] of Object.entries(r.doors || {})) {
    const nb = neighbor(r.id, d);
    if (!nb) { DOOR_ERRORS.push(`${r.id}.${d}: no room behind the door`); continue; }
    const id = doorId(r.id, nb);
    const entry = { id, type, owner: r.id };
    for (const [room, dir] of [[r.id, d], [nb, DIRS[d].opp]]) {
      DOORS[room] ||= {};
      const prev = DOORS[room][dir];
      if (prev && prev.type !== type) DOOR_ERRORS.push(`${room}.${dir}: door declared twice (${prev.type} / ${type})`);
      if (!prev) DOORS[room][dir] = { ...entry, to: room === r.id ? nb : r.id };
    }
  }
}

/** Basic sanity checks on the map data; returns a list of problems (empty = fine). */
export function validateRooms() {
  const out = [...DOOR_ERRORS];
  for (const r of Object.values(ROOMS)) {
    if (r.map.length !== H) out.push(`${r.id}: ${r.map.length} rows`);
    r.map.forEach((line, i) => { if (line.length !== W) out.push(`${r.id} row ${i}: ${line.length} chars`); });
    for (const line of r.map) for (const ch of line) if (ch >= '0' && ch <= '9' && !r.at?.[ch]) out.push(`${r.id}: digit ${ch} has no entity`);
    for (const [d, [c, rr]] of Object.entries(DOOR_TILES)) {
      const door = DOORS[r.id]?.[d];
      const inner = { n: [c, rr + 1], s: [c, rr - 1], w: [c + 1, rr], e: [c - 1, rr] }[d];
      if (door && r.map[inner[1]][inner[0]] === '#') out.push(`${r.id}.${d}: tile inside the door is a wall`);
    }
    for (const e of Object.values(r.at || {})) {
      if (e.t === 'warp' && !ROOMS[e.to]) out.push(`${r.id}: warp to missing room ${e.to}`);
    }
  }
  return out;
}
