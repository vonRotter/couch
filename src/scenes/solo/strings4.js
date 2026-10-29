import { addStrings } from '../../core/i18n.js';

// Milestone B3 text (English and Norwegian bokmål): the toast queue, the decorate cursor, seasons, festivals,
// sledding, the museum, the greenhouse, Shell Isle, photos, the fishing tournament, café specials, baby animals.

addStrings({
  en: {
    'isl.t.mailN': 'You have {n} letters in the mailbox!',
    'isl.deco.next': 'hold [B]: next thing',
    'isl.deco.bag': 'keys 1-9 or hold [B] to pick',
    // seasons (one per real week)
    'isl.season.spring': 'spring', 'isl.season.summer': 'summer', 'isl.season.autumn': 'autumn', 'isl.season.winter': 'winter',
    'isl.season.week': '{season} week (next week: {next})', 'isl.or': ' or ',
    'isl.weather.snow': 'snow', 'isl.cal.snow': 'snow', 'isl.t.snow': 'It is snowing! The snow keeps your crops watered today.',
    'isl.h.offSeason': '{item} grows in {list}. Keep the seeds for then!',
    'isl.h.offSeasonGh': '{item} grows in {list}, or any time in the greenhouse!',
    'isl.seasonIn.spring': 'spring', 'isl.seasonIn.summer': 'summer', 'isl.seasonIn.autumn': 'autumn', 'isl.seasonIn.winter': 'winter',
    // new crops
    'isl.i.pea': 'peas', 'isl.i.blueberry': 'blueberries', 'isl.i.beet': 'beet', 'isl.i.sunflower': 'sunflower', 'isl.i.cabbage': 'cabbage', 'isl.i.snowberry': 'snowberries',
    'isl.i.peaSeed': 'pea seeds', 'isl.i.blueberrySeed': 'blueberry seeds', 'isl.i.beetSeed': 'beet seeds', 'isl.i.sunflowerSeed': 'sunflower seeds', 'isl.i.cabbageSeed': 'cabbage seeds', 'isl.i.snowberrySeed': 'snowberry seeds',
    'isl.grow.pea': '6 min, grows back', 'isl.grow.blueberry': '5 min, grows back', 'isl.grow.beet': '5 min', 'isl.grow.sunflower': '40 min', 'isl.grow.cabbage': '20 min', 'isl.grow.snowberry': '6 min, grows back',
    // seasonal fish and sea finds
    'isl.i.rainbowTrout': 'rainbow trout', 'isl.i.flyingfish': 'flying fish', 'isl.i.salmon': 'salmon', 'isl.i.icefish': 'icefish', 'isl.i.parrotfish': 'parrotfish', 'isl.i.rainbowfish': 'rainbowfish',
    'isl.i.seahorse': 'seahorse', 'isl.i.snowCrab': 'snow crab', 'isl.i.starfish': 'starfish', 'isl.i.seaGlass': 'sea glass', 'isl.i.seaShell': 'sea shell', 'isl.i.cocoa': 'hot cocoa',
    'isl.where.cove': 'the hidden cove on Shell Isle', 'isl.log.seasons': 'only in {list}',
    // festivals of the seasons
    'isl.fest.plant': 'Planting Fair', 'isl.fest.beach': 'Beach Day',
    'isl.plant.rules': 'Welcome to the Spring Planting Fair! Plant five seeds today, then come and tell me. Flowers for everyone!',
    'isl.plant.progress': 'You planted {n} of 5 seeds today. Lovely! Keep going!',
    'isl.plant.win': 'Five seeds in the ground! The island will bloom. These are for you!',
    'isl.plant.done': 'Your field looks like springtime itself. Thank you for planting with us!',
    'isl.task.plant': 'Planting Fair: plant 5 seeds today ({n}/5), then talk to Rosa',
    'isl.beach.rules': 'Beach Day! Mission: find four shiny shells on the beach. Report back to me, over!',
    'isl.beach.progress': 'Shell report: {n} of 4 found. Keep scanning the sand!',
    'isl.beach.win': 'Four shells! Mission complete! You get a sandcastle and some coins!',
    'isl.beach.done': 'Mission done. Now we can just splash around. Best day!',
    'isl.beach.found': 'A shiny shell! ({n}/4)',
    'isl.task.beach': 'Beach Day: find 4 shells on the beach ({n}/4), then talk to Pip',
    'isl.d.tulips': 'Tub of tulips', 'isl.d.sandcastle': 'Sandcastle',
    // sledding
    'isl.h.sled': '[A] ride the sled!',
    'isl.sled.ride': 'Wheee! Steer up and down · snowflakes {n}/{m}',
    'isl.sled.done': 'What a ride! You caught {n} of {m} snowflakes.',
    'isl.sled.all': 'Wow! All {m} snowflakes! You are a sled star!',

  },
  no: {
    'isl.t.mailN': 'Du har {n} brev i postkassa!',
    'isl.deco.next': 'hold [B]: neste ting',
    'isl.deco.bag': 'tastene 1-9 eller hold [B] for å velge',
    // årstider (én per ekte uke)
    'isl.season.spring': 'vår', 'isl.season.summer': 'sommer', 'isl.season.autumn': 'høst', 'isl.season.winter': 'vinter',
    'isl.season.week': '{season}uke (neste uke: {next})', 'isl.or': ' eller ',
    'isl.weather.snow': 'snø', 'isl.cal.snow': 'snø', 'isl.t.snow': 'Det snør! Snøen vanner plantene dine i dag.',
    'isl.h.offSeason': '{item} vokser om {list}. Spar frøene til da!',
    'isl.h.offSeasonGh': '{item} vokser om {list}, eller når som helst i drivhuset!',
    'isl.seasonIn.spring': 'våren', 'isl.seasonIn.summer': 'sommeren', 'isl.seasonIn.autumn': 'høsten', 'isl.seasonIn.winter': 'vinteren',
    // nye avlinger
    'isl.i.pea': 'erter', 'isl.i.blueberry': 'blåbær', 'isl.i.beet': 'rødbete', 'isl.i.sunflower': 'solsikke', 'isl.i.cabbage': 'kål', 'isl.i.snowberry': 'snøbær',
    'isl.i.peaSeed': 'ertefrø', 'isl.i.blueberrySeed': 'blåbærfrø', 'isl.i.beetSeed': 'rødbetefrø', 'isl.i.sunflowerSeed': 'solsikkefrø', 'isl.i.cabbageSeed': 'kålfrø', 'isl.i.snowberrySeed': 'snøbærfrø',
    'isl.grow.pea': '6 min, vokser igjen', 'isl.grow.blueberry': '5 min, vokser igjen', 'isl.grow.beet': '5 min', 'isl.grow.sunflower': '40 min', 'isl.grow.cabbage': '20 min', 'isl.grow.snowberry': '6 min, vokser igjen',
    // fisk og funn etter årstid
    'isl.i.rainbowTrout': 'regnbueørret', 'isl.i.flyingfish': 'flygefisk', 'isl.i.salmon': 'laks', 'isl.i.icefish': 'isfisk', 'isl.i.parrotfish': 'papegøyefisk', 'isl.i.rainbowfish': 'regnbuefisk',
    'isl.i.seahorse': 'sjøhest', 'isl.i.snowCrab': 'snøkrabbe', 'isl.i.starfish': 'sjøstjerne', 'isl.i.seaGlass': 'havglass', 'isl.i.seaShell': 'skjell', 'isl.i.cocoa': 'varm kakao',
    'isl.where.cove': 'den skjulte bukta på Skjelløya', 'isl.log.seasons': 'bare om {list}',
    // årstidenes festivaler
    'isl.fest.plant': 'Plantemarked', 'isl.fest.beach': 'Stranddag',
    'isl.plant.rules': 'Velkommen til vårens plantemarked! Plant fem frø i dag, og kom og fortell meg det. Blomster til alle!',
    'isl.plant.progress': 'Du har plantet {n} av 5 frø i dag. Nydelig! Fortsett!',
    'isl.plant.win': 'Fem frø i jorda! Øya kommer til å blomstre. Disse er til deg!',
    'isl.plant.done': 'Åkeren din ser ut som selve våren. Takk for at du planter med oss!',
    'isl.task.plant': 'Plantemarked: plant 5 frø i dag ({n}/5), og snakk med Rosa',
    'isl.beach.rules': 'Stranddag! Oppdrag: finn fire skinnende skjell på stranda. Rapporter tilbake til meg, over!',
    'isl.beach.progress': 'Skjellrapport: {n} av 4 funnet. Fortsett å lete i sanden!',
    'isl.beach.win': 'Fire skjell! Oppdraget er fullført! Du får et sandslott og noen mynter!',
    'isl.beach.done': 'Oppdraget er gjort. Nå kan vi bare plaske rundt. Beste dagen!',
    'isl.beach.found': 'Et skinnende skjell! ({n}/4)',
    'isl.task.beach': 'Stranddag: finn 4 skjell på stranda ({n}/4), og snakk med Pip',
    'isl.d.tulips': 'Tulipankasse', 'isl.d.sandcastle': 'Sandslott',
    // aking
    'isl.h.sled': '[A] ta en aketur!',
    'isl.sled.ride': 'Wiii! Styr opp og ned · snøfnugg {n}/{m}',
    'isl.sled.done': 'For en tur! Du fanget {n} av {m} snøfnugg.',
    'isl.sled.all': 'Wow! Alle {m} snøfnuggene! Du er en akestjerne!',

  },
});
