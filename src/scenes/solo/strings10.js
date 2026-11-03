import { addStrings } from '../../core/i18n.js';

// The owner's playtest on the solo island (English and Norwegian bokmål): Pip's Zip-Zap (one gadget for
// the field, rocks, grass and trees, with upgrades at Pip's gadget bench), and the bag panel with the
// hotbar, Rosa's bigger backpacks and the storage chest in the cottage.

addStrings({
  en: {
    'isl.i.zipzap': 'Zip-Zap', 'isl.i.backpack1': 'Bigger backpack', 'isl.i.backpack2': 'Huge backpack', 'isl.i.chest': 'Chest',
    // the welcome: Pip gives the Zip-Zap
    'zz.pip.intro': 'Hi hi! I am Pip, astronaut! I built you a gadget from spare rocket parts: the Zip-Zap! Point it at something and press [B]. It knows what to do, and a little picture shows what!',
    'isl.mail.zipzap': 'Hi hi {name}! I took your old hoe, watering can and scythe to my rocket and built them into one gadget: the Zip-Zap! Point it at something and press the use button. It tills, waters, cuts, breaks rocks and chops trees all by itself. Zip zap!',
    // what [B] does with it
    'zz.h.needBuster': 'The Zip-Zap needs a rock buster for this. Ask Keeper Bram!',
    'zz.h.needPower': 'Too big! Pip can power up your Zip-Zap at her gadget bench.',
    'zz.h.big': '[B] zap the big boulder', 'zz.h.chop': '[B] chop the tree',
    'zz.h.holdZipRocks': 'Hold your Zip-Zap to break the rocks ({bag})',
    'zz.h.wetSoil': 'Wet soil: hold seeds to plant ({bag})',
    'zz.h.bench': "[B] Pip's gadget bench",
    'zz.t.big': '+6 stone!', 'zz.t.bigCrystal': '+6 stone, and a crystal inside: {item}!', 'zz.t.wood': '+3 wood (the tree grows back)',
    'zz.t.rockBuster': 'Rock buster on! Your Zip-Zap can break the sparkly ore rocks now.',
    // Pip's gadget bench
    'zz.bench.title': "Pip's gadget bench", 'zz.bench.hello': 'Welcome to my gadget bench! What shall we add to your Zip-Zap?',
    'zz.bench.hint': '[OK] build it · [C] close', 'zz.bench.status': 'Rock buster: {buster} · Beam: {area}',
    'zz.on': 'on', 'zz.off': 'off (Keeper Bram)', 'zz.area0': 'one tile', 'zz.area1': 'three in a row', 'zz.area2': '3 × 3',
    'zz.up.done': 'built!', 'zz.up.first': 'the one above first', 'zz.up.needBuster': 'needs the rock buster',
    'zz.up.speed1': 'Fast Zap', 'zz.up.speed1.sub': 'Quicker beams: rocks, trees and the rockfall need fewer zaps.', 'zz.up.speed1.got': 'Fast Zap! Fewer zaps for rocks and trees.',
    'zz.up.area1': 'Wide Beam', 'zz.up.area1.sub': 'Tills and waters three tiles in a row.', 'zz.up.area1.got': 'Wide Beam! Three tiles at a time.',
    'zz.up.area2': 'Big Beam', 'zz.up.area2.sub': 'Tills and waters nine tiles: a 3 × 3 square.', 'zz.up.area2.got': 'Big Beam! Nine tiles at a time.',
    'zz.up.range1': 'Long Reach', 'zz.up.range1.sub': 'Zaps things two steps away.', 'zz.up.range1.got': 'Long Reach! Your beam goes further.',
    'zz.up.power1': 'Mega Buster', 'zz.up.power1.sub': 'Breaks the big purple boulders (lots of stone, sometimes a crystal).', 'zz.up.power1.got': 'Mega Buster! Big boulders are no problem now.',
    // the bag panel and the chest
    'zb.h.chest': '[B] open the chest', 'zb.chest': 'Chest', 'zb.bag': 'Bag', 'zb.count': '{n} of {m}',
    'zb.sells': 'sells for {n} coins', 'zb.keep': 'keep it', 'zb.tip.zipzap': "Pip's gadget: point and press [B]",
    'zb.hint.kb': 'Drag with the mouse (right click: move across) · WASD or arrows: move · [B] pick up / put down · [A] move across · 1-9 hotbar · [C] or Tab: close',
    'zb.hint.kbChest': 'Drag with the mouse (right click: to the other side) · WASD or arrows: move · [B] pick up / put down · [A] to the other side · [C]: close',
    'zb.hint.pad': 'Stick: move (on the hotbar: hold it) · [B] pick up / put down · [A] move across · [C] close',
    'zb.hint.padChest': 'Stick: move · [B] pick up / put down · [A] to the other side · [C] close',
    'zb.pack.sub': 'room for {n} things', 'zb.t.pack': 'A bigger backpack! Room for {n} things now.',
    'zb.t.toChest1': 'Your bag is full: {item} went to the chest in your cottage.',
    'zb.t.toChest': 'Your bag is full: some things went to the chest in your cottage.',
  },
  no: {
    'isl.i.zipzap': 'Zipp-Zapp', 'isl.i.backpack1': 'Større ryggsekk', 'isl.i.backpack2': 'Kjempestor ryggsekk', 'isl.i.chest': 'Kiste',
    'zz.pip.intro': 'Hei hei! Jeg er Pip, astronaut! Jeg har bygd en dings til deg av ekstra rakettdeler: Zipp-Zappen! Pek den mot noe og trykk [B]. Den vet hva den skal gjøre, og et lite bilde viser hva!',
    'isl.mail.zipzap': 'Hei hei {name}! Jeg tok med hakka, vannkanna og ljåen din til raketten og bygde dem om til én dings: Zipp-Zappen! Pek den mot noe og trykk på bruk-knappen. Den graver, vanner, kutter, knuser stein og hogger trær helt av seg selv. Zipp zapp!',
    'zz.h.needBuster': 'Zipp-Zappen trenger en steinknuser til dette. Spør Fyrvokter Bram!',
    'zz.h.needPower': 'For stor! Pip kan gi Zipp-Zappen mer kraft på dingsbenken sin.',
    'zz.h.big': '[B] zapp den store steinblokka', 'zz.h.chop': '[B] hogg treet',
    'zz.h.holdZipRocks': 'Hold Zipp-Zappen for å knuse steinene ({bag})',
    'zz.h.wetSoil': 'Våt jord: hold frø for å plante ({bag})',
    'zz.h.bench': '[B] Dingsbenken til Pip',
    'zz.t.big': '+6 stein!', 'zz.t.bigCrystal': '+6 stein, og en krystall inni: {item}!', 'zz.t.wood': '+3 ved (treet vokser opp igjen)',
    'zz.t.rockBuster': 'Steinknuseren er på! Zipp-Zappen kan knuse de glitrende malmsteinene nå.',
    'zz.bench.title': 'Dingsbenken til Pip', 'zz.bench.hello': 'Velkommen til dingsbenken min! Hva skal vi bygge inn i Zipp-Zappen din?',
    'zz.bench.hint': '[OK] bygg den · [C] lukk', 'zz.bench.status': 'Steinknuser: {buster} · Stråle: {area}',
    'zz.on': 'på', 'zz.off': 'av (Fyrvokter Bram)', 'zz.area0': 'én rute', 'zz.area1': 'tre på rad', 'zz.area2': '3 × 3',
    'zz.up.done': 'bygd!', 'zz.up.first': 'den over først', 'zz.up.needBuster': 'trenger steinknuseren',
    'zz.up.speed1': 'Lynzapp', 'zz.up.speed1.sub': 'Raskere stråler: steiner, trær og steinraset trenger færre zapp.', 'zz.up.speed1.got': 'Lynzapp! Færre zapp for steiner og trær.',
    'zz.up.area1': 'Bred stråle', 'zz.up.area1.sub': 'Graver og vanner tre ruter på rad.', 'zz.up.area1.got': 'Bred stråle! Tre ruter om gangen.',
    'zz.up.area2': 'Stor stråle', 'zz.up.area2.sub': 'Graver og vanner ni ruter: en firkant på 3 × 3.', 'zz.up.area2.got': 'Stor stråle! Ni ruter om gangen.',
    'zz.up.range1': 'Lang rekkevidde', 'zz.up.range1.sub': 'Zapper ting to skritt unna.', 'zz.up.range1.got': 'Lang rekkevidde! Strålen når lenger.',
    'zz.up.power1': 'Megaknuser', 'zz.up.power1.sub': 'Knuser de store lilla steinblokkene (masse stein, noen ganger en krystall).', 'zz.up.power1.got': 'Megaknuser! Store steinblokker er ikke noe problem nå.',
    'zb.h.chest': '[B] åpne kista', 'zb.chest': 'Kiste', 'zb.bag': 'Sekk', 'zb.count': '{n} av {m}',
    'zb.sells': 'selges for {n} mynter', 'zb.keep': 'ta vare på den', 'zb.tip.zipzap': 'Dingsen til Pip: pek og trykk [B]',
    'zb.hint.kb': 'Dra med musa (høyreklikk: flytt over) · WASD eller piltaster: flytt · [B] ta opp / legg ned · [A] flytt over · 1-9 verktøylinja · [C] eller Tab: lukk',
    'zb.hint.kbChest': 'Dra med musa (høyreklikk: til den andre siden) · WASD eller piltaster: flytt · [B] ta opp / legg ned · [A] til den andre siden · [C]: lukk',
    'zb.hint.pad': 'Pinnen: flytt (på verktøylinja: hold den) · [B] ta opp / legg ned · [A] flytt over · [C] lukk',
    'zb.hint.padChest': 'Pinnen: flytt · [B] ta opp / legg ned · [A] til den andre siden · [C] lukk',
    'zb.pack.sub': 'plass til {n} ting', 'zb.t.pack': 'En større ryggsekk! Plass til {n} ting nå.',
    'zb.t.toChest1': 'Sekken din er full: {item} havnet i kista i hytta di.',
    'zb.t.toChest': 'Sekken din er full: noen ting havnet i kista i hytta di.',
  },
});
