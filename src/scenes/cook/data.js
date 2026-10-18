import { addStrings } from '../../core/i18n.js';

// Cook-Off data: the ingredient pool, the dish book, and the per-match menu picker.
// A "part" is a prepared ingredient on a plate, written 'kind:state' where state is
// raw (straight from the crate), chopped (board) or fried (pan). Soups are 3 chopped
// pieces of one kind cooked in a pot.

addStrings({
  en: {
    'cook.i.tomato': 'Tomato', 'cook.i.lettuce': 'Lettuce', 'cook.i.mushroom': 'Mushroom', 'cook.i.onion': 'Onion',
    'cook.i.cheese': 'Cheese', 'cook.i.bread': 'Bread', 'cook.i.fish': 'Fish', 'cook.i.carrot': 'Carrot',
    'cook.i.potato': 'Potato', 'cook.i.egg': 'Egg', 'cook.i.berries': 'Berries', 'cook.i.banana': 'Banana',
    'cook.d.soup_tomato': 'Tomato Soup', 'cook.d.soup_mushroom': 'Mushroom Soup', 'cook.d.soup_onion': 'Onion Soup',
    'cook.d.soup_carrot': 'Carrot Soup', 'cook.d.soup_potato': 'Potato Soup',
    'cook.d.greens': 'Green Salad', 'cook.d.sticks': 'Carrot Sticks', 'cook.d.berrybowl': 'Berry Bowl',
    'cook.d.egg': 'Fried Egg', 'cook.d.chips': 'Chips',
    'cook.d.salad': 'Salad', 'cook.d.cheesesand': 'Cheese Sandwich', 'cook.d.tomtoast': 'Tomato Toast',
    'cook.d.eggtoast': 'Egg on Toast', 'cook.d.fishchips': 'Fish & Chips', 'cook.d.fruitbowl': 'Fruit Bowl',
    'cook.d.mushtoast': 'Mushroom Toast', 'cook.d.carrotsalad': 'Carrot Salad', 'cook.d.fishsalad': 'Fish Salad',
    'cook.d.omelette': 'Onion Omelette', 'cook.d.cheesychips': 'Cheesy Chips', 'cook.d.berrytoast': 'Berry Toast',
    'cook.d.pancake': 'Banana Pancake', 'cook.d.fishbites': 'Fish Bites', 'cook.d.onionchips': 'Onion Rings & Chips',
    'cook.d.veggieburger': 'Mushroom Burger', 'cook.d.fishburger': 'Fish Burger', 'cook.d.bigsalad': 'Big Salad',
    'cook.d.rainbow': 'Rainbow Salad', 'cook.d.club': 'Club Sandwich', 'cook.d.breakfast': 'Big Breakfast',
    'cook.d.fishdinner': 'Fish Dinner', 'cook.d.onionburger': 'Onion Burger', 'cook.d.eggmuffin': 'Egg Muffin',
    'cook.d.fruitsalad': 'Fruit Salad', 'cook.d.cheeseboard': 'Cheese Plate',
  },
  no: {
    'cook.i.tomato': 'Tomat', 'cook.i.lettuce': 'Salat', 'cook.i.mushroom': 'Sopp', 'cook.i.onion': 'Løk',
    'cook.i.cheese': 'Ost', 'cook.i.bread': 'Brød', 'cook.i.fish': 'Fisk', 'cook.i.carrot': 'Gulrot',
    'cook.i.potato': 'Potet', 'cook.i.egg': 'Egg', 'cook.i.berries': 'Bær', 'cook.i.banana': 'Banan',
    'cook.d.soup_tomato': 'Tomatsuppe', 'cook.d.soup_mushroom': 'Soppsuppe', 'cook.d.soup_onion': 'Løksuppe',
    'cook.d.soup_carrot': 'Gulrotsuppe', 'cook.d.soup_potato': 'Potetsuppe',
    'cook.d.greens': 'Grønn salat', 'cook.d.sticks': 'Gulrotstaver', 'cook.d.berrybowl': 'Bærskål',
    'cook.d.egg': 'Speilegg', 'cook.d.chips': 'Pommes frites',
    'cook.d.salad': 'Salat', 'cook.d.cheesesand': 'Ostesmørbrød', 'cook.d.tomtoast': 'Tomatskive',
    'cook.d.eggtoast': 'Egg på brød', 'cook.d.fishchips': 'Fish and chips', 'cook.d.fruitbowl': 'Fruktskål',
    'cook.d.mushtoast': 'Sopp på brød', 'cook.d.carrotsalad': 'Gulrotsalat', 'cook.d.fishsalad': 'Fiskesalat',
    'cook.d.omelette': 'Løkomelett', 'cook.d.cheesychips': 'Pommes med ost', 'cook.d.berrytoast': 'Bærbrød',
    'cook.d.pancake': 'Bananpannekake', 'cook.d.fishbites': 'Fiskebiter', 'cook.d.onionchips': 'Løkringer og pommes',
    'cook.d.veggieburger': 'Soppburger', 'cook.d.fishburger': 'Fiskeburger', 'cook.d.bigsalad': 'Stor salat',
    'cook.d.rainbow': 'Regnbuesalat', 'cook.d.club': 'Klubbsmørbrød', 'cook.d.breakfast': 'Stor frokost',
    'cook.d.fishdinner': 'Fiskemiddag', 'cook.d.onionburger': 'Løkburger', 'cook.d.eggmuffin': 'Eggmuffins',
    'cook.d.fruitsalad': 'Fruktsalat', 'cook.d.cheeseboard': 'Osteplate',
  },
});

/**
 * Ingredient pool. chop: can be chopped on a board. fry: goes in a pan ('raw' straight from
 * the crate, 'chopped' after the board). soup: 3 chopped make a soup in a pot.
 * color/css: the main color; soup: soup color.
 */
export const ING = {
  tomato: { color: 0xff4f4f, css: '#ff4f4f', chop: true, soup: 0xff6a3d },
  lettuce: { color: 0x6cc94a, css: '#6cc94a', chop: true },
  mushroom: { color: 0xc8865a, css: '#c8865a', chop: true, fry: 'chopped', soup: 0xdcae7c },
  onion: { color: 0xb36ad6, css: '#b36ad6', chop: true, fry: 'chopped', soup: 0xf0dc9a },
  cheese: { color: 0xffd23f, css: '#ffc61a', chop: true },
  bread: { color: 0xe0a560, css: '#e0a560', chop: true },
  fish: { color: 0x5fa8e8, css: '#5fa8e8', chop: true, fry: 'chopped' },
  carrot: { color: 0xff8a2a, css: '#ff8a2a', chop: true, soup: 0xffa040 },
  potato: { color: 0xd9b26a, css: '#c99d4f', chop: true, fry: 'chopped', soup: 0xf3e2b0 },
  egg: { color: 0xfff1d8, css: '#f2e3c4', fry: 'raw' },
  berries: { color: 0x5a6cf0, css: '#5a6cf0' },
  banana: { color: 0xffe14d, css: '#f5d230', chop: true },
};
export const POOL = Object.keys(ING);

const P = (...parts) => ({ parts });
/** The dish book. A dish appears on a menu only when all its ingredients are in today's crates. */
export const DISHES = {
  // Soups: 3 chopped of one kind in a pot.
  soup_tomato: { soup: 'tomato' },
  soup_mushroom: { soup: 'mushroom' },
  soup_onion: { soup: 'onion' },
  soup_carrot: { soup: 'carrot' },
  soup_potato: { soup: 'potato' },
  // Starters: one part.
  greens: P('lettuce:chopped'),
  sticks: P('carrot:chopped'),
  berrybowl: P('berries:raw'),
  egg: P('egg:fried'),
  chips: P('potato:fried'),
  cheeseboard: P('cheese:chopped'),
  // Two parts.
  salad: P('lettuce:chopped', 'tomato:chopped'),
  cheesesand: P('bread:chopped', 'cheese:chopped'),
  tomtoast: P('bread:chopped', 'tomato:chopped'),
  eggtoast: P('bread:chopped', 'egg:fried'),
  fishchips: P('fish:fried', 'potato:fried'),
  fruitbowl: P('berries:raw', 'banana:chopped'),
  mushtoast: P('bread:chopped', 'mushroom:fried'),
  carrotsalad: P('lettuce:chopped', 'carrot:chopped'),
  fishsalad: P('fish:fried', 'lettuce:chopped'),
  omelette: P('egg:fried', 'onion:fried'),
  cheesychips: P('potato:fried', 'cheese:chopped'),
  berrytoast: P('bread:chopped', 'berries:raw'),
  pancake: P('egg:fried', 'banana:chopped'),
  fishbites: P('fish:fried', 'tomato:chopped'),
  onionchips: P('onion:fried', 'potato:fried'),
  // Three parts.
  veggieburger: P('bread:chopped', 'mushroom:fried', 'lettuce:chopped'),
  fishburger: P('bread:chopped', 'fish:fried', 'lettuce:chopped'),
  bigsalad: P('lettuce:chopped', 'tomato:chopped', 'cheese:chopped'),
  rainbow: P('lettuce:chopped', 'tomato:chopped', 'carrot:chopped'),
  club: P('bread:chopped', 'cheese:chopped', 'tomato:chopped'),
  breakfast: P('egg:fried', 'bread:chopped', 'mushroom:fried'),
  fishdinner: P('fish:fried', 'potato:fried', 'carrot:chopped'),
  onionburger: P('bread:chopped', 'onion:fried', 'cheese:chopped'),
  eggmuffin: P('bread:chopped', 'egg:fried', 'cheese:chopped'),
  fruitsalad: P('berries:raw', 'banana:chopped', 'cheese:chopped'),
};

/** Work needed for one part (used for coins, order time and the learning curve). */
export function partCost(part) {
  const [kind, state] = part.split(':');
  if (state === 'raw') return 0.5;
  if (state === 'chopped') return 1;
  return ING[kind].fry === 'raw' ? 1.5 : 2;
}

// Fill in derived info: ingredients, cost, coins and how long the customer waits.
for (const [id, d] of Object.entries(DISHES)) {
  d.id = id;
  d.ings = d.soup ? [d.soup] : [...new Set(d.parts.map((p) => p.split(':')[0]))];
  // Plating several parts is extra work too.
  d.cost = d.soup ? 3.5 : d.parts.reduce((s, p) => s + partCost(p), 0) + (d.parts.length - 1) * 0.5;
  d.coins = Math.max(10, Math.round((6 + d.cost * 4) / 5) * 5);
  d.time = 40 + d.cost * 13;
  d.stations = new Set(d.soup ? ['board', 'pot'] : d.parts.flatMap((p) => {
    const [k, s] = p.split(':');
    if (s === 'fried') return ING[k].fry === 'raw' ? ['pan'] : ['board', 'pan'];
    return s === 'chopped' ? ['board'] : [];
  }));
}

function sample(arr, k, rand) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, k);
}

function subsets(arr, k, start = 0, cur = [], out = []) {
  if (cur.length === k) { out.push([...cur]); return out; }
  for (let i = start; i < arr.length; i++) { cur.push(arr[i]); subsets(arr, k, i + 1, cur, out); cur.pop(); }
  return out;
}

/** Is this set of dishes a fun, fair menu? */
function goodMenu(menu, ings, { n, campaign }) {
  const covered = new Set(menu.flatMap((d) => d.ings));
  if (!ings.every((k) => covered.has(k))) return false;           // every crate gets used
  if (!menu.some((d) => d.cost <= 2.5)) return false;              // an easy starter to learn on
  if (menu.filter((d) => d.soup).length > (menu.length >= 4 ? 2 : 1)) return false; // mostly plated dishes
  const singles = menu.filter((d) => !d.soup && d.parts.length === 1).length;
  if (singles > 1) return false;                                   // not too trivial
  if (!menu.some((d) => d.soup || d.parts.length >= 2)) return false;
  const hard = menu.filter((d) => d.cost >= 4).length;
  if (n >= 3 && !campaign && hard < 1) return false;               // bigger teams get a real challenge
  if (campaign && hard > 1) return false;                          // story stage stays fair
  return true;
}

/**
 * Pick today's crates (3–4 ingredients) and a menu of 2–4 dishes from them.
 * Returns { ings, menu } with menu sorted from easiest to hardest.
 */
export function pickMenu(rand, { n = 1, campaign = false } = {}) {
  const size = n <= 1 ? 2 + (rand() < 0.5 ? 1 : 0) : n <= 4 ? 3 : 4;
  for (let attempt = 0; attempt < 400; attempt++) {
    const k = rand() < (n >= 3 ? 0.65 : 0.4) ? 4 : 3;
    const ings = sample(POOL, k, rand);
    const cands = Object.values(DISHES).filter((d) => d.ings.every((i) => ings.includes(i)));
    if (cands.length < size) continue;
    const ok = subsets(cands, size).filter((m) => goodMenu(m, ings, { n, campaign }));
    if (!ok.length) continue;
    const menu = ok[Math.floor(rand() * ok.length)].sort((a, b) => a.cost - b.cost);
    return { ings, menu };
  }
  // Fallback that is always valid.
  return { ings: ['lettuce', 'tomato', 'mushroom'], menu: [DISHES.salad, DISHES.soup_tomato, DISHES.soup_mushroom] };
}
