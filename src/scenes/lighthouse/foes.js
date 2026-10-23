import { makeEnemy as makeEnemy1, makeBoss as makeBoss1 } from './enemies.js';
import { makeEnemy2, makeBoss2 } from './enemies2.js';

// One door to every enemy kind: part 1 (enemies.js) and part 2 (enemies2.js).

export function makeEnemy(eng, kind, x, z) {
  return makeEnemy2(eng, kind, x, z) || makeEnemy1(eng, kind, x, z);
}

export function makeBoss(eng, kind, x, z) {
  return makeBoss2(eng, kind, x, z) || makeBoss1(eng, kind, x, z);
}
