import * as THREE from 'three';
import { t, tFor, addStrings } from '../../core/i18n.js';
import { say as speak } from '../../core/voice.js';
import { now, hourOf } from './save.js';
import { dayKey, dayIndex, dayRand } from './calendar.js';
import { heightAt, SEA_Y } from './map.js';
import { Guest, arrived } from './odd.js';
import { freshLine, waveHello } from './wizard.js';
import { makeWorkshop, makeBooth, makeVendor, makeGuestHat } from './models11.js';

// Tinka the inventor and her odd machines (the odd-adventure round, part 2). Her quests chain slowly: each step is
// one arrival of odd.js (a letter and a Today line, never more than one new thing a day, about a week apart):
//   - she mails the magic ball ahead of her (magicball.js), then moves into a workshop on the east shore (a shed with
//     a big turning gear) and chats with you there (lines that do not come back for four weeks);
//   - three TELEPORT BOOTHS (by her workshop, on the hill by Aunt Hazel's and on the meadow by the café): [B] in a booth
//     picks another booth and pops you there. About one trip in four misfires and lands you somewhere funny instead
//     (the end of the pier, by the fountain, on kite hill...): every funny spot is open ground you can walk away from,
//     never water and never a spot you could be stuck in (tests/lba2 checks each one);
//   - a VENDING ROBOT by her workshop that trades jokes for small things: pick one of three jokes (once a day; a joke
//     you told does not come back for four weeks) and it laughs and drops a little something;
//   - the TALKING LIGHTHOUSE: she gives the lighthouse a voice box; walking by its door it says one short, kind line a
//     day (its own warm voice, never the narrator), no line again within four weeks;
//   - two springs for the magic ball (one more bounce each; magicball.js).
// Save: S.odd.inv = { said, trips, used: [booth ids], jokes: { day, told: [{ k, di }] }, voice: { day, said } }.

export const WORKSHOP = { x: 54, z: 5.5, tinka: { x: 51.6, z: 6.6 } };
export const VENDOR = { x: 51.2, z: 9.0 };
export const BOOTHS = [
  { id: 'east', x: 52.4, z: 11.6 },
  { id: 'hill', x: -16, z: -28 },
  { id: 'beach', x: -14.5, z: 32 },
];
/** Where a misfire can land you: open ground, never water, never boxed in (tests check each). */
export const FUNNY = [
  { id: 'pier', x: 3.4, z: 55.6 }, { id: 'fountain', x: 12, z: -0.6 }, { id: 'kite', x: 9.6, z: -25.0 }, { id: 'cove', x: 33.2, z: 34.2 },
  { id: 'meadow', x: 46.6, z: -11.6 }, { id: 'picnic', x: 9.0, z: 28.6 }, { id: 'school', x: -2.6, z: 21.4 }, { id: 'garden', x: 2.6, z: -22.6 },
];
const MISFIRE = 0.25;
const LH = { x: 44, z: 30.2, say: { x: 44, up: 3.4, z: 28.6 } }; // the bubble shows over the door (the lamp is off screen from down here)
const JOKES = 15, LH_LINES = 14, TINKA_LINES = 10;
const PRIZES = [[['radishSeed', 3]], [['carrotSeed', 2]], [['goldenAcorn', 1]], [['bouquet', 1]], [['oddSock', 1]], [['mysterySeed', 1]], [['apple', 2]], [['wood', 3]]];

addStrings({
  en: {
    'map.a.workshop': 'Tinka\'s workshop', 'map.a.booth': 'Teleport booth', 'map.a.vendor': 'The joke vending robot',
    'isl.mail.od.inventor': 'Hello {name}! I am here! My workshop is on the east shore, the shed with the big gear on top. Come and say hello. Did the magic ball bounce well? Tinka',
    'isl.mail.od.booths': 'Dear {name}, I built three teleport booths! One by my workshop, one on the hill by Aunt Hazel\'s and one on the meadow by the café. Step in and choose where to go. They work... mostly. Tinka',
    'isl.mail.od.robot': 'Hi {name}! I built a vending robot. It does not want coins: it wants JOKES. Tell it one a day and see what it gives you. It is by my workshop. Tinka',
    'isl.mail.od.voice': 'Dear {name}, Keeper Bram and I gave the lighthouse a voice box! It is a little shy. Walk by its door and say hello. Tinka',
    'od.td.inventor': 'Smoke puffs from a new shed on the east shore. Someone has moved in!',
    'od.td.booths': 'Three tall pink booths popped up around the island. Teleport booths, says Tinka!',
    'od.td.robot': 'A beeping box on legs stands by Tinka\'s workshop. It wants to hear a joke.',
    'od.td.voice': 'Keeper Bram says the lighthouse said "good morning" to him today. Out loud!',
    'iv.h.talk': '[B] talk to Tinka', 'iv.h.booth': '[B] step into the teleport booth', 'iv.h.vendor': '[B] tell the robot a joke', 'iv.h.vendorDone': 'The robot is still laughing at today\'s joke.',
    'iv.t.hello1': 'You must be {name}! I am Tinka. I invent things. Some of them even work!',
    'iv.t.hello2': 'Your island is perfect for testing. So many walls to bounce off! So much space to teleport into!',
    'iv.chat.1': 'I tried to invent a cloud that rains lemonade. The bees were very interested.',
    'iv.chat.2': 'Every machine needs a name. My toaster is called Gerald.',
    'iv.chat.3': 'Bounce the ball off two walls and it comes back from a direction nobody expects. That is science!',
    'iv.chat.4': 'The big gear on my roof does not do anything. It just looks clever.',
    'iv.chat.5': 'If a booth sends you somewhere funny, just wave. I will hear about it.',
    'iv.chat.6': 'I am working on socks that find their partner. Marlo will be furious.',
    'iv.chat.7': 'An inventor\'s best tool is a pencil. My second best is a very big hammer.',
    'iv.chat.8': 'The gulls keep stealing my screws. I think they are building something.',
    'iv.chat.9': 'Mistakes are just inventions that went for a walk.',
    'iv.chat.10': 'Wendeline and I argue about magic and machines. We both win, every time.',
    'iv.booth.ask': 'Where to?', 'iv.booth.east': 'Tinka\'s workshop (east shore)', 'iv.booth.hill': 'The hill by Aunt Hazel\'s', 'iv.booth.beach': 'The meadow by the café', 'iv.booth.no': 'Stay here',
    'iv.t.zap': 'Zzzap!', 'iv.t.arrive': 'Pop! You are at the booth.',
    'iv.funny.pier': 'Whoops! The booth popped you out at the end of the pier.', 'iv.funny.fountain': 'Whoops! You popped out right next to the fountain. Splish!',
    'iv.funny.kite': 'Whoops! You popped out on top of kite hill. Nice view!', 'iv.funny.cove': 'Whoops! You popped out at Crab Cove. The crabs wave.',
    'iv.funny.meadow': 'Whoops! You popped out on the meadow by the burrow. A grumble giggles.', 'iv.funny.picnic': 'Whoops! You popped out by the picnic blanket. Snack?',
    'iv.funny.school': 'Whoops! You popped out by the School House. Is it a school day?', 'iv.funny.garden': 'Whoops! You popped out in Aunt Hazel\'s garden. She does not mind.',
    'iv.v.ask': 'BEEP. INSERT JOKE.', 'iv.v.laugh': 'HA. HA. HA. ERROR: TOO FUNNY. DISPENSING...', 'iv.v.never': 'Not today',
    'iv.joke.1': 'Why did the cow cross the road? To get to the udder side!',
    'iv.joke.2': 'What do you call a sleeping dinosaur? A dino-snore!',
    'iv.joke.3': 'Why are fish so smart? They live in schools!',
    'iv.joke.4': 'What do you call a bear with no teeth? A gummy bear!',
    'iv.joke.5': 'Why did the cookie go to the doctor? It felt crummy!',
    'iv.joke.6': 'What do clouds wear? Thunderwear!',
    'iv.joke.7': 'Why can\'t a bicycle stand up by itself? It is two tired!',
    'iv.joke.8': 'What do you call cheese that is not yours? Nacho cheese!',
    'iv.joke.9': 'How does the moon cut its hair? Eclipse it!',
    'iv.joke.10': 'What did one wall say to the other? Meet you at the corner!',
    'iv.joke.11': 'Why did the robot go on holiday? To recharge its batteries!',
    'iv.joke.12': 'What do you call a fish with no eyes? A fsh!',
    'iv.joke.13': 'Why do bees have sticky hair? They use honeycombs!',
    'iv.joke.14': 'What kind of tree fits in your hand? A palm tree!',
    'iv.joke.15': 'Why did the scarecrow win a prize? He was outstanding in his field!',
    'iv.lh.1': 'Good day, little bean. The sea says hello.', 'iv.lh.2': 'I see you down there. You are doing just fine.',
    'iv.lh.3': 'The waves are gentle today. A good day for a walk.', 'iv.lh.4': 'Hello, friend. I keep a light on for everyone.',
    'iv.lh.5': 'The gulls told me you were coming. They were right.', 'iv.lh.6': 'Take your time. The island is not going anywhere.',
    'iv.lh.7': 'I like it when you visit. It is quiet up here.', 'iv.lh.8': 'Somewhere a boat is finding its way home, thanks to us.',
    'iv.lh.9': 'Bram polished my lamp this morning. I feel very shiny.', 'iv.lh.10': 'You are brave, you know. Brave and kind.',
    'iv.lh.11': 'The stars will be out tonight. I will wink at them for you.', 'iv.lh.12': 'Welcome back. The sea missed you a little.',
    'iv.lh.13': 'Whatever you do today, do it with a smile.', 'iv.lh.14': 'Rest when you need to. Even lighthouses blink.',
    'iv.task.booths': '📞 Try Tinka\'s teleport booths ({n} of 3)', 'iv.task.robot': '🤖 Tell Tinka\'s robot a joke (by her workshop)',
    'iv.t.allBooths': 'You tried all three booths! Tinka sends you a thank-you: 50 coins.',
  },
  no: {
    'map.a.workshop': 'Verkstedet til Tinka', 'map.a.booth': 'Teleporteringsbu', 'map.a.vendor': 'Vitseautomaten',
    'isl.mail.od.inventor': 'Hallo {name}! Nå er jeg her! Verkstedet mitt ligger på østsiden, skuret med det store tannhjulet på taket. Kom og si hei. Spratt den magiske ballen bra? Tinka',
    'isl.mail.od.booths': 'Kjære {name}, jeg har bygget tre teleporteringsbuer! En ved verkstedet mitt, en på bakken ved tante Hassel og en på enga ved kafeen. Gå inn og velg hvor du vil. De virker... stort sett. Tinka',
    'isl.mail.od.robot': 'Hei {name}! Jeg har bygget en automat. Den vil ikke ha mynter: den vil ha VITSER. Fortell den én om dagen og se hva du får. Den står ved verkstedet mitt. Tinka',
    'isl.mail.od.voice': 'Kjære {name}, fyrvokter Bram og jeg har gitt fyret en stemmeboks! Det er litt sjenert. Gå forbi døra og si hei. Tinka',
    'od.td.inventor': 'Det puffer røyk fra et nytt skur på østsiden. Noen har flyttet inn!',
    'od.td.booths': 'Tre høye rosa buer har dukket opp rundt på øya. Teleporteringsbuer, sier Tinka!',
    'od.td.robot': 'En pipende boks på bein står ved verkstedet til Tinka. Den vil høre en vits.',
    'od.td.voice': 'Fyrvokter Bram sier at fyret sa «god morgen» til ham i dag. Høyt!',
    'iv.h.talk': '[B] snakk med Tinka', 'iv.h.booth': '[B] gå inn i teleporteringsbua', 'iv.h.vendor': '[B] fortell roboten en vits', 'iv.h.vendorDone': 'Roboten ler fortsatt av dagens vits.',
    'iv.t.hello1': 'Du må være {name}! Jeg heter Tinka. Jeg finner opp ting. Noen av dem virker til og med!',
    'iv.t.hello2': 'Øya di er perfekt for å teste ting. Så mange vegger å sprette mot! Så mye plass å teleportere til!',
    'iv.chat.1': 'Jeg prøvde å finne opp en sky som regner saft. Biene var veldig interessert.',
    'iv.chat.2': 'Hver maskin trenger et navn. Brødristeren min heter Gerhard.',
    'iv.chat.3': 'Sprett ballen mot to vegger, så kommer den tilbake fra en kant ingen venter. Det er vitenskap!',
    'iv.chat.4': 'Det store tannhjulet på taket mitt gjør ingenting. Det bare ser lurt ut.',
    'iv.chat.5': 'Hvis en bu sender deg et rart sted, så bare vink. Jeg får høre om det.',
    'iv.chat.6': 'Jeg jobber med sokker som finner makkeren sin. Marlo kommer til å bli rasende.',
    'iv.chat.7': 'En oppfinners beste verktøy er en blyant. Det nest beste er en veldig stor hammer.',
    'iv.chat.8': 'Måkene stjeler skruene mine. Jeg tror de bygger noe.',
    'iv.chat.9': 'Feil er bare oppfinnelser som gikk seg en tur.',
    'iv.chat.10': 'Wendeline og jeg krangler om magi og maskiner. Vi vinner begge to, hver gang.',
    'iv.booth.ask': 'Hvor vil du?', 'iv.booth.east': 'Verkstedet til Tinka (østsiden)', 'iv.booth.hill': 'Bakken ved tante Hassel', 'iv.booth.beach': 'Enga ved kafeen', 'iv.booth.no': 'Bli her',
    'iv.t.zap': 'Zzzapp!', 'iv.t.arrive': 'Plopp! Du er ved bua.',
    'iv.funny.pier': 'Oisann! Bua sendte deg ut på enden av brygga.', 'iv.funny.fountain': 'Oisann! Du dukket opp rett ved fontenen. Plask!',
    'iv.funny.kite': 'Oisann! Du dukket opp på toppen av drageåsen. Fin utsikt!', 'iv.funny.cove': 'Oisann! Du dukket opp i Krabbebukta. Krabbene vinker.',
    'iv.funny.meadow': 'Oisann! Du dukket opp på enga ved hiet. En grumling fniser.', 'iv.funny.picnic': 'Oisann! Du dukket opp ved piknikteppet. Matbit?',
    'iv.funny.school': 'Oisann! Du dukket opp ved Skolehuset. Er det skoledag?', 'iv.funny.garden': 'Oisann! Du dukket opp i hagen til tante Hassel. Hun har ikke noe imot det.',
    'iv.v.ask': 'BIP. SETT INN VITS.', 'iv.v.laugh': 'HA. HA. HA. FEIL: FOR MORSOMT. DELER UT...', 'iv.v.never': 'Ikke i dag',
    'iv.joke.1': 'Hva sa den ene veggen til den andre? Vi møtes på hjørnet!',
    'iv.joke.2': 'Hva kaller du en dinosaur som sover? En dino-snorker!',
    'iv.joke.3': 'Hvorfor er fisker så flinke? De går i stim, og stim er nesten skole!',
    'iv.joke.4': 'Hva kaller du en bjørn uten tenner? En gummibjørn!',
    'iv.joke.5': 'Hvorfor gikk kjeksen til legen? Den følte seg smuldrete!',
    'iv.joke.6': 'Hva har skyer på seg under? Tordenbukser!',
    'iv.joke.7': 'Hvorfor kan ikke en sykkel stå av seg selv? Den er for sliten!',
    'iv.joke.8': 'Hva sa den store skorsteinen til den lille? Du er for ung til å røyke!',
    'iv.joke.9': 'Hvordan klipper månen håret? Den går til en måne-frisør!',
    'iv.joke.10': 'Hva sa havet til stranda? Ingenting, det bare vinket!',
    'iv.joke.11': 'Hvorfor dro roboten på ferie? For å lade batteriene!',
    'iv.joke.12': 'Hva kaller du en fisk uten øyne? En fsk!',
    'iv.joke.13': 'Hvorfor har bier klistrete hår? De bruker honningkam!',
    'iv.joke.14': 'Hvilket tre får plass i hånda di? Et palmetre!',
    'iv.joke.15': 'Hvorfor vant fugleskremselet en premie? Det var helt enestående på åkeren!',
    'iv.lh.1': 'God dag, lille bønne. Havet sier hei.', 'iv.lh.2': 'Jeg ser deg der nede. Du gjør det bare fint.',
    'iv.lh.3': 'Bølgene er rolige i dag. En fin dag for en tur.', 'iv.lh.4': 'Hei, venn. Jeg holder lyset på for alle.',
    'iv.lh.5': 'Måkene sa at du skulle komme. De hadde rett.', 'iv.lh.6': 'Ta den tiden du trenger. Øya går ingen steder.',
    'iv.lh.7': 'Jeg liker det når du kommer innom. Det er stille her oppe.', 'iv.lh.8': 'Et sted finner en båt veien hjem, takket være oss.',
    'iv.lh.9': 'Bram pusset lampen min i morges. Jeg føler meg veldig skinnende.', 'iv.lh.10': 'Du er modig, vet du. Modig og snill.',
    'iv.lh.11': 'Stjernene kommer fram i kveld. Jeg skal blunke til dem for deg.', 'iv.lh.12': 'Velkommen tilbake. Havet savnet deg litt.',
    'iv.lh.13': 'Uansett hva du gjør i dag, gjør det med et smil.', 'iv.lh.14': 'Hvil når du trenger det. Selv fyrtårn blunker.',
    'iv.task.booths': '📞 Prøv teleporteringsbuene til Tinka ({n} av 3)', 'iv.task.robot': '🤖 Fortell roboten til Tinka en vits (ved verkstedet)',
    'iv.t.allBooths': 'Du har prøvd alle tre buene! Tinka sender deg en takk: 50 mynter.',
  },
});

export class Inventor {
  constructor(host, odd) {
    this.host = host;
    this.odd = odd;
    const map = host.map;
    this.shop = makeWorkshop(host.M);
    this.shop.position.set(WORKSHOP.x, heightAt(WORKSHOP.x, WORKSHOP.z), WORKSHOP.z);
    this.shop.rotation.y = -Math.PI / 2 + 0.2;
    this.shop.visible = false;
    host.scene.add(this.shop);
    this.shopObs = map.circObs(1e5, WORKSHOP.z, 1.9);
    map.addKeepOut(WORKSHOP.x - 1, WORKSHOP.z + 2, 4, 'workshop');
    this.tinka = new Guest(host, { id: 'tinka', color: 0xffb066, hat: makeGuestHat('goggles'), css: '#c9772e', nameKey: 'od.npc.tinka' });
    this.booths = BOOTHS.map((b) => {
      const g = makeBooth();
      g.position.set(b.x, heightAt(b.x, b.z), b.z);
      g.rotation.y = Math.atan2(-b.x, -b.z) * 0 + (b.id === 'east' ? -Math.PI / 2 : 0);
      g.visible = false;
      host.scene.add(g);
      map.addKeepOut(b.x, b.z, 1.6, 'booth');
      return { ...b, g, obs: map.circObs(1e5, b.z, 0.55) };
    });
    this.vendor = makeVendor();
    this.vendor.position.set(VENDOR.x, heightAt(VENDOR.x, VENDOR.z), VENDOR.z);
    this.vendor.rotation.y = -Math.PI / 2;
    this.vendor.visible = false;
    host.scene.add(this.vendor);
    this.vendorObs = map.circObs(1e5, VENDOR.z, 0.55);
    this.bubble = host.game.ui.label('label isl-say');
    this.bubble.style.display = 'none';
    this.lhT = 0;
    this.tele = null;
    this.t = 0;
  }

  get S() { return this.host.save; }
  get I() {
    const O = this.odd.O;
    if (!O.inv || typeof O.inv !== 'object') O.inv = {};
    const I = O.inv;
    I.said ||= []; I.used ||= []; I.trips ||= 0;
    if (!I.jokes) I.jokes = { day: '', told: [] };
    if (!I.voice) I.voice = { day: '', said: [] };
    return I;
  }
  has(id) { return arrived(this.S, id); }

  tick() {
    const host = this.host, h = hourOf(), main = !host.isle2?.here();
    const shop = this.has('inventor') && main;
    this.shop.visible = shop;
    this.shopObs.x = shop ? WORKSHOP.x : 1e5;
    this.tinka.place(WORKSHOP.tinka.x, WORKSHOP.tinka.z, shop && h >= 8 && h < 19, { x: -1, z: 0.3 });
    const booths = this.has('booths') && main;
    for (const b of this.booths) { b.g.visible = booths; b.obs.x = booths ? b.x : 1e5; }
    const robot = this.has('robot') && main;
    this.vendor.visible = robot;
    this.vendorObs.x = robot ? VENDOR.x : 1e5;
  }

  // ---------- [B] ----------

  interactions(P, out, nm) {
    if (this.tinka.near(P, 1.9)) { out.b = { text: nm('iv.h.talk'), fn: () => this.talkTinka() }; return true; }
    if (this.vendor.visible && Math.hypot(P.x - VENDOR.x, P.z - VENDOR.z) < 1.5) {
      out.b = this.I.jokes.day === dayKey() ? { text: t('iv.h.vendorDone'), fn: () => this.host.game.audio.play('beep') } : { text: nm('iv.h.vendor'), fn: () => this.jokeTime() };
      return true;
    }
    for (const b of this.booths) {
      if (!b.g.visible || Math.hypot(P.x - b.x, P.z - b.z) > 1.4) continue;
      out.b = { text: nm('iv.h.booth'), fn: () => this.boothAsk(b) };
      return true;
    }
    return false;
  }

  talkTinka() {
    const host = this.host, I = this.I, g = this.tinka, P = host.player, di = dayIndex();
    g.faceTo(P);
    P.ch.face(g.x - P.x, g.z - P.z);
    if (!I.met) { I.met = true; host.say([g.line('iv.t.hello1'), g.line('iv.t.hello2')]); host.markDirty(); return; }
    // one chat a day, never one heard in the last four weeks; else she just waves
    const k = I.said.some((x) => x.di === di) ? null : freshLine('iv.chat', TINKA_LINES, I.said, di, 7.7);
    if (!k) { waveHello(host, g); return; }
    I.said = [...I.said.filter((x) => di - x.di < 60), { k, di }];
    g.hop = 1;
    host.say([g.line(k)]);
    host.markDirty();
  }

  // ---------- teleport booths ----------

  boothAsk(from) {
    const host = this.host, others = this.booths.filter((b) => b !== from);
    host.say([{ name: t('map.a.booth'), css: '#ff5d73', key: 'iv.booth.ask', choices: [...others.map((b) => `iv.booth.${b.id}`), 'iv.booth.no'],
      onChoice: (i) => { if (i < others.length) this.teleport(from, others[i]); } }]);
  }

  /** Where a trip lands: the booth, or (a misfire, about one in four, by the day and the trip count) a funny spot. */
  landing(to, trip = this.I.trips, day = dayKey()) {
    if (dayRand(`misfire:${day}:${trip}`) >= MISFIRE) return { x: to.x - 1.3, z: to.z + 0.4, funny: null };
    const f = FUNNY[Math.floor(dayRand(`funny:${day}:${trip}`) * FUNNY.length)];
    return { x: f.x, z: f.z, funny: f.id };
  }

  teleport(from, to) {
    const host = this.host, I = this.I;
    const land = this.landing(to);
    I.trips++;
    if (!I.used.includes(from.id)) I.used.push(from.id);
    host.mode = 'teleport';
    this.tele = { t: 0, from, to, land, moved: false };
    host.game.audio.play('whoosh');
    host.game.ui.toast(t('iv.t.zap'), 900);
    host.markDirty();
  }

  /** In 'teleport' mode: the bean spins small, pops to the landing spot, grows back. */
  updateTele(dt) {
    const T = this.tele, host = this.host, P = host.player;
    if (!T || !P) { host.mode = 'walk'; return; }
    T.t += dt;
    const k = T.t < 0.6 ? 1 - T.t / 0.6 : T.t < 0.8 ? 0.02 : Math.min(1, (T.t - 0.8) / 0.4);
    P.ch.group.scale.setScalar(Math.max(0.02, k));
    P.ch.spin = T.t * 14;
    if (!T.moved && T.t >= 0.6) {
      T.moved = true;
      P.x = T.land.x; P.z = T.land.z; P.lx = undefined; P.vx = 0; P.vz = 0;
      host.groundCheck(P, host.walkState);
      host.snapCamera();
      host.puffs?.burst(new THREE.Vector3(P.x, P.y + 0.6, P.z), 0x8ff0ff, { count: 16, speed: 3, size: 0.3, life: 0.6 });
      host.game.audio.play('pop');
    }
    if (T.t >= 1.25) {
      P.ch.group.scale.setScalar(1);
      P.ch.spin = 0;
      this.tele = null;
      host.mode = 'walk';
      host.game.ui.toast(T.land.funny ? t(`iv.funny.${T.land.funny}`) : t('iv.t.arrive'), 2600);
      const I = this.I;
      if (!I.used.includes(T.to.id) && !T.land.funny) I.used.push(T.to.id);
      if (I.used.length >= 3 && !I.allBooths) { I.allBooths = true; host.later(1, () => { host.game.ui.toast(t('iv.t.allBooths'), 3000); host.grant({ coins: 50 }); }); }
      host.markDirty();
    }
  }

  // ---------- the joke robot ----------

  /** Today's three jokes (none told in the last four weeks). */
  jokesToday(day = dayKey(), di = dayIndex()) {
    const recent = new Set(this.I.jokes.told.filter((x) => di - x.di < 28).map((x) => x.k));
    const all = Array.from({ length: JOKES }, (_, i) => `iv.joke.${i + 1}`).filter((k) => !recent.has(k));
    all.sort((a, b) => dayRand(`joke:${day}:${a}`) - dayRand(`joke:${day}:${b}`));
    return all.slice(0, 3);
  }

  jokeTime() {
    const host = this.host, I = this.I, jokes = this.jokesToday();
    const line = (key, extra = {}) => ({ name: t('map.a.vendor'), css: '#2f7fd0', speaker: 'isl.vendor', key, ...extra });
    host.say([line('iv.v.ask', { choices: [...jokes, 'iv.v.never'], onChoice: (i) => {
      if (i >= jokes.length) return;
      const day = dayKey(), di = dayIndex();
      I.jokes.day = day;
      I.jokes.told = [...I.jokes.told.filter((x) => di - x.di < 60), { k: jokes[i], di }];
      const prize = PRIZES[Math.floor(dayRand(`vend:${day}`) * PRIZES.length)];
      host.say([line('iv.v.laugh', { fx: () => { for (const e of this.vendor.userData.eyes) e.scale.setScalar(1.8); } })], () => {
        for (const e of this.vendor.userData.eyes) e.scale.setScalar(1);
        host.giveItems(prize);
        host.markDirty();
      });
    } })]);
  }

  // ---------- the talking lighthouse ----------

  /** Once a day, walking by the lighthouse door: one short, kind line in its own voice (a bubble up by the lamp). */
  updateLighthouse(dt) {
    const host = this.host, P = host.player, V = this.I.voice, day = dayKey();
    if (this.lhSay) {
      this.lhT += dt;
      const pos = new THREE.Vector3(LH.say.x, heightAt(LH.say.x, LH.say.z) + LH.say.up, LH.say.z);
      if (this.lhT > 6 || host.mode !== 'walk') {
        // cut off at once (the Today board of a new day, a letter...): the day's line was not really heard, so it is
        // given back and comes the next time you walk by
        if (this.lhT < 2 && host.mode !== 'walk' && this.lhKey) { V.day = null; V.said = V.said.filter((x) => !(x.k === this.lhKey && x.di === dayIndex())); }
        this.lhSay = null; this.lhKey = null; this.bubble.style.display = 'none'; return;
      }
      if (this.bubble.textContent !== this.lhSay) this.bubble.textContent = this.lhSay;
      host.game.ui.place(this.bubble, pos, host.camera);
      return;
    }
    if (!this.has('voice') || !P || host.mode !== 'walk' || V.day === day || host.isle2?.here()) return;
    if (Math.hypot(P.x - LH.x, P.z - LH.z) > 6) return;
    const di = dayIndex();
    const k = freshLine('iv.lh', LH_LINES, V.said, di, 5.3);
    if (!k) return;
    V.day = day;
    V.said = [...V.said.filter((x) => di - x.di < 60), { k, di }];
    this.lhSay = t(k);
    this.lhKey = k;
    this.lhT = 0;
    speak(this.lhSay, { speaker: 'isl.lighthouse' });
    host.markDirty();
  }

  // ---------- the rest ----------

  tasks() {
    const out = [], I = this.I;
    if (this.has('booths') && !I.allBooths) out.push(t('iv.task.booths', { n: Math.min(3, I.used.length) }));
    if (this.has('robot') && !I.jokes.told.length) out.push(t('iv.task.robot'));
    return out;
  }

  markers() {
    const out = [];
    if (this.has('inventor')) out.push({ key: 'odd:workshop', kind: 'place', icon: '🔧', name: t('map.a.workshop'), x: WORKSHOP.x, z: WORKSHOP.z, tx: WORKSHOP.tinka.x - 1, tz: WORKSHOP.tinka.z });
    if (this.has('booths')) for (const b of this.booths) out.push({ key: `odd:booth:${b.id}`, kind: 'place', icon: '📞', name: t('map.a.booth'), sub: t(`iv.booth.${b.id}`), x: b.x, z: b.z, tx: b.x - 1.2, tz: b.z + 0.4 });
    if (this.has('robot')) out.push({ key: 'odd:vendor', kind: 'place', icon: '🤖', name: t('map.a.vendor'), x: VENDOR.x, z: VENDOR.z, tx: VENDOR.x - 1.2, tz: VENDOR.z });
    return out;
  }

  update(dt) {
    this.t += dt;
    this.tinka.update(dt);
    if (this.shop.visible) this.shop.userData.gear.rotation.z += dt * 0.5;
    for (const b of this.booths) if (b.g.visible) b.g.userData.swirl.rotation.y += dt * 2;
    this.updateLighthouse(dt);
  }

  dispose() { this.tinka.dispose(); this.bubble?.remove(); }
}

export { tFor, SEA_Y, now };
