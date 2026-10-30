import { addStrings } from '../../core/i18n.js';

// Pillow Keep Solo text for the Diablo-style controls and systems (mouse, mana, hotbar, belt, grid
// bag, stats, skill tree, identify, champions, difficulty tiers). English and Norwegian bokmål.
// Buttons are written [A]/[B]/[C]; mouse buttons and keys are plain words (they never change).

const en = {
  // things under the mouse pointer
  'ks.foe.basic': 'Grumble', 'ks.foe.charger': 'Charger Grumble', 'ks.foe.thrower': 'Pillow Thrower', 'ks.foe.shield': 'Shield Grumble',
  'ks.h.nest': 'Grumble nest', 'ks.h.chest': 'Treasure chest', 'ks.h.door': 'Locked door (find the key)', 'ks.h.doorKey': 'Locked door: click to open',
  'ks.h.portal': 'Town portal', 'ks.h.potion': 'Potion', 'ks.h.key': 'Key', 'ks.h.bag': 'Your bag!', 'ks.h.scroll': 'Scroll', 'ks.h.coin': 'Coins',
};

const no = {
  'ks.foe.basic': 'Grumling', 'ks.foe.charger': 'Stangegrumling', 'ks.foe.thrower': 'Putekaster', 'ks.foe.shield': 'Skjoldgrumling',
  'ks.h.nest': 'Grumlereir', 'ks.h.chest': 'Skattekiste', 'ks.h.door': 'Låst dør (finn nøkkelen)', 'ks.h.doorKey': 'Låst dør: klikk for å åpne',
  'ks.h.portal': 'Byportal', 'ks.h.potion': 'Drikk', 'ks.h.key': 'Nøkkel', 'ks.h.bag': 'Sekken din!', 'ks.h.scroll': 'Rull', 'ks.h.coin': 'Mynter',
};

addStrings({ en, no });
