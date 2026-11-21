import * as THREE from 'three';
import { t, addStrings } from '../../core/i18n.js';
import { report } from '../../core/passport.js';
import { dayIndex, dayRand } from './calendar.js';
import { npcState, heartsOf } from './npcs.js';
import { heightAt } from './map.js';
import { mesh, box, sph, cyl, cone } from './models.js';
import { basic } from '../../core/palette.js';
import { makeDeco11 } from './models11.js';
import './strings15.js';

// Social happenings (the odd-adventure round, part 4). They run as the villagers' dramas do (village.js): one at a
// time, with quiet days between, each with a start, a middle and ONE big moment (on a free day: no festival, surprise
// or rare event), beats at most one a day, and the island remembers how they ended (S.village.mem). They join the
// dramas' turn order after the first three, so the island gets a new kind of happening every week and a half or so.
//   - fence:    Rosa and Coach Bo argue over the fence between her flower bed and his running lane. Pick a side or
//               ask them to share; the fence ends up as you helped (flowers, a lane, or a gate with both).
//   - election: an island vote for the square's new thing: Aunt Hazel's flower clock or Grumbleton's ship's bell.
//               Vote at the ballot box; the villagers' votes come in day by day and are really counted: Aunt
//               Hazel votes clock, Grumbleton bell, the others lean their own way, and villagers who are your friends
//               (3 hearts or more) vote like you. So befriending and helping them matters, and a vote can be lost.
//               The winner stands in the square from then on.
//   - club:     Pip and Mumble's secret club. Clues from three villagers (one a day), or sneak up on the club's sleepy
//               guard (Sneaky mode) to read the note behind him; on club day say the password at the club's log door.
//   - party:    a surprise party for Curator Hoot. Rosa plans it; Hazel, Pip and Grumbleton each give you a thing to
//               bring her, without Hoot noticing (keep away from him while you carry them; Sneaky mode helps).
//   - rumour:   Grumbleton heard that Hoot saw a sea monster... every villager you ask tells it a little bigger. On
//               the big day Hoot tells what he really saw.
// Each drama object: cast, at (the big moment's place), icon, and hooks village.js calls (init, choice, talkOther,
// hasNews, outcome, reward, interactions, props, newsVars).

const CLUB_DOOR = { x: -4, z: 24 }, GUARD = { x: -5.6, z: 25.4 };
const BALLOT = { x: 16.6, z: -7.6 };
// the island vote's voters (and yours); a villager with this many hearts or more votes like you
const VOTERS = ['hazel', 'grumbleton', 'rosa', 'bram', 'pip', 'mumble', 'hoot', 'coach'];
const ELECTION_FRIEND = 3;
const PASSWORDS = [
  { word: 'pancake', clues: { hazel: 1, rosa: 2, bram: 3 } },
  { word: 'snowball', clues: { hazel: 1, rosa: 2, bram: 3 } },
  { word: 'jellyfish', clues: { hazel: 1, rosa: 2, bram: 3 } },
];
const DECOYS = ['pancake', 'snowball', 'jellyfish', 'teapot', 'banana'];
const PARTY_GIVERS = { hazel: 'bunting', pip: 'balloons', grumbleton: 'cake' };
const RUMOUR_MAX = 4;

addStrings({
  en: {
    // the fence
    'map.a.fence': 'Rosa and Coach Bo\'s fence', 'vd.fence.tm': 'Rosa and Coach Bo sort out their fence. Go and see!',
    'vd.fence.news.start': 'Rosa and Coach Bo are arguing over the fence behind the store. Flowers or a running lane?',
    'vd.fence.news.mid': 'Someone hung a sign on the fence behind the store: "PLEASE DO NOT JOG ON THE TULIPS".',
    'vd.fence.news.climax': 'Today Rosa and Coach Bo sort out their fence, behind the store.',
    'vd.fence.news.peace': 'Rosa and Coach Bo share the fence now: a gate, flowers on one side, a lane on the other.',
    'vd.fence.news.rosa': 'Rosa\'s flowers won the fence. Coach Bo jogs around them now.',
    'vd.fence.news.coach': 'Coach Bo\'s lane won the fence. Rosa\'s flowers moved into pots.',
    'vd.fence.rosa.start.1': 'Hmph! Coach Bo wants to run right through my new flower bed. Behind the store, by the fence!',
    'vd.fence.rosa.start.2': 'Flowers need peace and quiet. Don\'t you think?',
    'vd.fence.coach.start.1': 'Rosa wants flowers where my running lane goes! The fence behind the store, you know it?',
    'vd.fence.coach.start.2': 'A lane is for everyone! Whose side are you on?',
    'vd.fence.rosa.mid.1': 'I put up a sign. A polite one. Mostly polite.',
    'vd.fence.coach.mid.1': 'She put up a sign! I have never jogged on a tulip in my life. Well. Once.',
    'vd.fence.side.rosa': 'The flowers should stay', 'vd.fence.side.coach': 'The lane is a good idea', 'vd.fence.side.peace': 'Could you share it?',
    'vd.fence.picked': 'You think so too? Thank you!', 'vd.fence.sharing': 'Share it...? Hmm. I will think about that.',
    'vd.fence.end.1': 'Right. About this fence...',
    'vd.fence.end.peace': 'A gate! Flowers on Rosa\'s side, a lane on mine. Why did nobody think of that before?',
    'vd.fence.end.rosa': 'Fine, fine. The flowers stay. I will jog around them. It is extra training!',
    'vd.fence.end.coach': 'The lane it is! Rosa\'s flowers moved into pots. They look very happy there!',
    // the election
    'map.a.election': 'The ballot box in the square', 'vd.election.tm': 'Tomorrow the island\'s vote is counted in the square!',
    'vd.election.news.start': 'An island vote! What should the square get: Aunt Hazel\'s flower clock or Grumbleton\'s ship\'s bell?',
    'vd.election.news.mid': 'The vote so far: flower clock {clock}, ship\'s bell {bell}. The ballot box is in the square.',
    'vd.election.news.climax': 'Today the island\'s vote is counted, in the square!',
    'vd.election.news.clock': 'The vote is in: the square got a flower clock!', 'vd.election.news.bell': 'The vote is in: the square got a ship\'s bell!',
    'vd.election.hazel.start.1': 'Have you heard? We are voting for something new for the square!',
    'vd.election.hazel.start.2': 'I would love a flower clock: a clock made of flowers! Vote at the ballot box by the square.',
    'vd.election.grumbleton.start.1': 'A vote, har! I say: a proper ship\'s bell in the square. Ding ding!',
    'vd.election.grumbleton.start.2': 'The ballot box stands by the square. Every vote counts, matey!',
    'vd.election.hazel.mid.1': 'It is very close. Every single vote counts!',
    'vd.election.grumbleton.mid.1': 'Close race! I have been practising my ding-ding.',
    'el.h.vote': '[B] vote at the ballot box', 'el.h.voted': 'You voted. The votes are counted on the big day.', 'el.ask': 'What should the square get?',
    'el.clock': 'A flower clock (Aunt Hazel)', 'el.bell': 'A ship\'s bell (Grumbleton)', 'el.no': 'Not yet',
    'el.t.voted': 'Your vote is in the box! Your friends on the island may vote like you.', 'el.board': 'Flower clock {clock} · Ship\'s bell {bell}',
    'vd.election.end.1': 'The votes are counted! It was so close...',
    'vd.election.end.clock': 'The flower clock wins! Tick-tock and petals. Thank you all!',
    'vd.election.end.bell': 'The ship\'s bell wins! Ding ding! Well done, everyone, well done.',
    // the club
    'map.a.club': 'The secret club\'s door', 'vd.club.tm': 'Tomorrow the secret club meets. Do you know the password?',
    'vd.club.news.start': 'Pip and Mumble whisper about a secret club. Nobody knows the password...',
    'vd.club.news.mid': 'There is a tiny door in a log south of the School House. A sleepy guard sits by it.',
    'vd.club.news.climax': 'The secret club meets today at the log door south of the School House!',
    'vd.club.news.member': 'Pip says the secret club has a new member. Who could it be?', 'vd.club.news.later': 'The secret club met without you. Maybe next time!',
    'vd.club.pip.start.1': 'Psst! Mumble and I started a club. A SECRET club. I cannot tell you the password!',
    'vd.club.pip.start.2': 'But some friends know clues... and our guard has a note. He is very sleepy.',
    'vd.club.mumble.start.1': 'shhh. club. secret. password. mm-hm.',
    'vd.club.pip.mid.1': 'Have you found the clues? Hazel, Rosa and Keeper Bram each know one!',
    'vd.club.mumble.mid.1': 'guard is sleepy. tiptoe. shhh.',
    'cl.clue': 'A clue for the secret club? Hmm, all right: {clue}', 'cl.clue.pancake.1': 'it is something you eat.', 'cl.clue.pancake.2': 'it is round and flat.', 'cl.clue.pancake.3': 'you flip it in a pan!',
    'cl.clue.snowball.1': 'it is very cold.', 'cl.clue.snowball.2': 'it is round, and you make it with your hands.', 'cl.clue.snowball.3': 'you throw it in winter!',
    'cl.clue.jellyfish.1': 'it lives in the sea.', 'cl.clue.jellyfish.2': 'it wobbles.', 'cl.clue.jellyfish.3': 'it is a fish that is not a fish, and wobbly like jelly!',
    'cl.h.guard': '[B] look at the note behind the guard', 'cl.h.door': '[B] knock on the club door', 'cl.h.member': 'The secret club. You are a member!',
    'cl.guard.wake': 'Hmm? Wha? Who is there? No peeking! Come back on club day.', 'cl.guard.zzz': 'Zzz... (he is fast asleep)',
    'cl.note': 'The note says: "The password is {word}." Shhh!', 'cl.guard.ask': 'Halt! What is the password?', 'cl.guard.wrong': 'Nope! Think about the clues...',
    'cl.guard.right': 'Correct! Welcome to the club!', 'cl.guard.closed': 'The club meets on club day. Shhh.',
    'cl.word.pancake': 'Pancake', 'cl.word.snowball': 'Snowball', 'cl.word.jellyfish': 'Jellyfish', 'cl.word.teapot': 'Teapot', 'cl.word.banana': 'Banana',
    'vd.club.end.1': 'You found it! The secret club welcomes you!', 'vd.club.end.member': 'shhh! member! here is your pin. secret.', 'vd.club.end.later': 'Maybe next time!',
    'cl.task': '🤫 The secret club: find the password ({n} of 3 clues)',
    // the party
    'map.a.party': 'The surprise party (the museum)', 'vd.party.tm': 'Tomorrow is Hoot\'s surprise party! Shhh!',
    'vd.party.news.start': 'Shhh! Rosa is planning a surprise party for Curator Hoot. Don\'t tell him!',
    'vd.party.news.mid': 'Rosa is collecting party things for Hoot. Has anyone told him? Hopefully not!',
    'vd.party.news.climax': 'Today is Hoot\'s surprise party, by the museum! Shhh!',
    'vd.party.news.surprised': 'Hoot\'s surprise party was a total surprise. He is still smiling.', 'vd.party.news.almost': 'Hoot\'s party was almost a surprise. He pretended very well!',
    'vd.party.news.guessed': 'Hoot had guessed the party, but he loved it anyway.', 'vd.party.news.small': 'Hoot\'s party was small and sweet. Rosa baked a tiny cake.',
    'vd.party.rosa.start.1': 'Shhh! Curator Hoot\'s hatch-day is soon. Let\'s throw him a surprise party!',
    'vd.party.rosa.start.2': 'Aunt Hazel has bunting, Pip has balloons and Grumbleton has a cake. Fetch one a day and bring them to me, and don\'t let Hoot see!',
    'vd.party.rosa.mid.1': 'How is it going? Remember: keep the things away from Hoot!',
    'pt.give.hazel': 'For the party? Here, my old bunting. Shhh!', 'pt.give.pip': 'Balloons! I blew them up myself. Hide them!', 'pt.give.grumbleton': 'A cake, har! My famous seaweed sponge. Do not let the owl smell it.',
    'pt.noticed': 'Hoot: "Ooh, what is that you are carrying?" ...You hide it behind your back.', 'pt.deliver': 'Perfect! Now we wait for the big day. Shhh!',
    'pt.item.bunting': 'bunting', 'pt.item.balloons': 'balloons', 'pt.item.cake': 'a cake',
    'vd.party.end.1': 'SURPRISE! Happy hatch-day, Hoot!',
    'vd.party.end.surprised': 'Hoo! A party? For me? I had no idea! Thank you, thank you!', 'vd.party.end.almost': 'Hoo-hoo! I thought I saw balloons... but I never guessed this!',
    'vd.party.end.guessed': 'Hoo, I may have guessed. But it is even better than I hoped!', 'vd.party.end.small': 'A little party! How lovely. Thank you, Rosa.',
    'pt.task': '🎉 Hoot\'s surprise party: bring Rosa the things ({n} of 3), don\'t let Hoot see',
    // the rumour
    'map.a.rumour': 'Where the sea monster was seen', 'vd.rumour.tm': 'Tomorrow Hoot tells what he really saw at sea!',
    'vd.rumour.news.start': 'Grumbleton says Curator Hoot saw a sea monster! Or did he?',
    'vd.rumour.news.mid': 'Now everyone says the sea monster wears a hat. And sings!',
    'vd.rumour.news.climax': 'Today Hoot tells what he really saw at sea, on the beach by Crab Cove.',
    'vd.rumour.news.duck': 'The "sea monster" was Grumbleton\'s runaway rubber duck. The whole island is giggling.',
    'vd.rumour.grumbleton.start.1': 'Have you heard? Curator Hoot saw a SEA MONSTER! Out past the cove!',
    'vd.rumour.grumbleton.start.2': 'Ask around. Everyone has heard something!',
    'vd.rumour.hoot.start.1': 'A monster? Did I say that? I said I saw... oh, never mind. Wait for the big day.',
    'vd.rumour.grumbleton.mid.1': 'The monster gets bigger every time someone tells it. Har!',
    'rm.v.1': 'The sea monster? I heard it was as big as the lighthouse!', 'rm.v.2': 'I heard the sea monster wears a little hat!',
    'rm.v.3': 'They say the sea monster sings! Wearing its little hat!', 'rm.v.4': 'I heard it sings AND does cartwheels on the waves. In a hat!',
    'vd.rumour.end.1': 'So... about the "sea monster"...', 'vd.rumour.end.duck': 'It was a giant yellow rubber duck! Grumbleton\'s! It floated away in the storm. Hoo-hoo!',
    'rm.task': '👂 The sea monster rumour: ask around ({n} told it)',
    // keepsakes and memory lines
    'od.mem.fence.peace': 'Rosa and Coach Bo wave at each other over their gate now.',
  },
  no: {
    'map.a.fence': 'Gjerdet til Rosa og trener Bo', 'vd.fence.tm': 'Rosa og trener Bo ordner opp i gjerdet sitt. Gå og se!',
    'vd.fence.news.start': 'Rosa og trener Bo krangler om gjerdet bak butikken. Blomster eller løpebane?',
    'vd.fence.news.mid': 'Noen har hengt et skilt på gjerdet bak butikken: «IKKE JOGG PÅ TULIPANENE, TAKK».',
    'vd.fence.news.climax': 'I dag ordner Rosa og trener Bo opp i gjerdet sitt, bak butikken.',
    'vd.fence.news.peace': 'Rosa og trener Bo deler gjerdet nå: en grind, blomster på den ene siden, en bane på den andre.',
    'vd.fence.news.rosa': 'Blomstene til Rosa vant gjerdet. Trener Bo jogger rundt dem nå.',
    'vd.fence.news.coach': 'Løpebanen til trener Bo vant gjerdet. Blomstene til Rosa flyttet inn i potter.',
    'vd.fence.rosa.start.1': 'Hmf! Trener Bo vil løpe rett gjennom det nye blomsterbedet mitt. Bak butikken, ved gjerdet!',
    'vd.fence.rosa.start.2': 'Blomster trenger fred og ro. Synes ikke du?',
    'vd.fence.coach.start.1': 'Rosa vil ha blomster der løpebanen min skal gå! Gjerdet bak butikken, vet du hvor?',
    'vd.fence.coach.start.2': 'En bane er for alle! Hvem holder du med?',
    'vd.fence.rosa.mid.1': 'Jeg har satt opp et skilt. Et høflig et. Nesten høflig.',
    'vd.fence.coach.mid.1': 'Hun har satt opp et skilt! Jeg har aldri jogget på en tulipan i hele mitt liv. Vel. Én gang.',
    'vd.fence.side.rosa': 'Blomstene bør bli', 'vd.fence.side.coach': 'Banen er en god idé', 'vd.fence.side.peace': 'Kan dere dele?',
    'vd.fence.picked': 'Synes du også det? Takk!', 'vd.fence.sharing': 'Dele...? Hmm. Det skal jeg tenke på.',
    'vd.fence.end.1': 'Ja vel. Om dette gjerdet...',
    'vd.fence.end.peace': 'En grind! Blomster på Rosas side, en bane på min. Hvorfor tenkte ingen på det før?',
    'vd.fence.end.rosa': 'Greit, greit. Blomstene blir. Jeg jogger rundt dem. Det er ekstra trening!',
    'vd.fence.end.coach': 'Det blir banen! Blomstene til Rosa flyttet inn i potter. De ser veldig glade ut der!',
    'map.a.election': 'Valgurna på torget', 'vd.election.tm': 'I morgen telles stemmene på torget!',
    'vd.election.news.start': 'Avstemning på øya! Hva skal torget få: tante Hassels blomsterklokke eller Grumbletons skipsklokke?',
    'vd.election.news.mid': 'Stemmene så langt: blomsterklokke {clock}, skipsklokke {bell}. Valgurna står på torget.',
    'vd.election.news.climax': 'I dag telles stemmene på torget!',
    'vd.election.news.clock': 'Stemmene er talt: torget fikk en blomsterklokke!', 'vd.election.news.bell': 'Stemmene er talt: torget fikk en skipsklokke!',
    'vd.election.hazel.start.1': 'Har du hørt det? Vi skal stemme over noe nytt til torget!',
    'vd.election.hazel.start.2': 'Jeg hadde elsket en blomsterklokke: en klokke av blomster! Stem ved valgurna på torget.',
    'vd.election.grumbleton.start.1': 'En avstemning, har! Jeg sier: en skikkelig skipsklokke på torget. Ding ding!',
    'vd.election.grumbleton.start.2': 'Valgurna står ved torget. Hver stemme teller, kompis!',
    'vd.election.hazel.mid.1': 'Det er veldig jevnt. Hver eneste stemme teller!',
    'vd.election.grumbleton.mid.1': 'Jevnt løp! Jeg har øvd på ding-dingen min.',
    'el.h.vote': '[B] stem ved valgurna', 'el.h.voted': 'Du har stemt. Stemmene telles på den store dagen.', 'el.ask': 'Hva skal torget få?',
    'el.clock': 'En blomsterklokke (tante Hassel)', 'el.bell': 'En skipsklokke (Grumbleton)', 'el.no': 'Ikke ennå',
    'el.t.voted': 'Stemmen din ligger i urna! Vennene dine på øya stemmer kanskje som deg.', 'el.board': 'Blomsterklokke {clock} · Skipsklokke {bell}',
    'vd.election.end.1': 'Stemmene er talt! Det var så jevnt...',
    'vd.election.end.clock': 'Blomsterklokka vinner! Tikk-takk og kronblader. Takk alle sammen!',
    'vd.election.end.bell': 'Skipsklokka vinner! Ding ding! Godt gjort, alle sammen, godt gjort.',
    'map.a.club': 'Døra til den hemmelige klubben', 'vd.club.tm': 'I morgen møtes den hemmelige klubben. Kan du passordet?',
    'vd.club.news.start': 'Pip og Mumle hvisker om en hemmelig klubb. Ingen vet passordet...',
    'vd.club.news.mid': 'Det er en bitteliten dør i en stokk sør for Skolehuset. En søvnig vakt sitter ved den.',
    'vd.club.news.climax': 'Den hemmelige klubben møtes i dag ved stokkdøra sør for Skolehuset!',
    'vd.club.news.member': 'Pip sier at den hemmelige klubben har fått et nytt medlem. Hvem kan det være?', 'vd.club.news.later': 'Den hemmelige klubben møttes uten deg. Kanskje neste gang!',
    'vd.club.pip.start.1': 'Psst! Mumle og jeg har startet en klubb. En HEMMELIG klubb. Jeg kan ikke si passordet!',
    'vd.club.pip.start.2': 'Men noen venner vet hint... og vakten vår har en lapp. Han er veldig søvnig.',
    'vd.club.mumble.start.1': 'hysj. klubb. hemmelig. passord. mm-hm.',
    'vd.club.pip.mid.1': 'Har du funnet hintene? Hassel, Rosa og fyrvokter Bram vet ett hver!',
    'vd.club.mumble.mid.1': 'vakten er søvnig. på tærne. hysj.',
    'cl.clue': 'Et hint til den hemmelige klubben? Hmm, greit da: {clue}', 'cl.clue.pancake.1': 'det er noe du spiser.', 'cl.clue.pancake.2': 'det er rundt og flatt.', 'cl.clue.pancake.3': 'du snur det i en stekepanne!',
    'cl.clue.snowball.1': 'det er veldig kaldt.', 'cl.clue.snowball.2': 'det er rundt, og du lager det med hendene.', 'cl.clue.snowball.3': 'du kaster det om vinteren!',
    'cl.clue.jellyfish.1': 'den bor i havet.', 'cl.clue.jellyfish.2': 'den dirrer.', 'cl.clue.jellyfish.3': 'den heter fisk, men er ikke en fisk, og den er geleaktig!',
    'cl.h.guard': '[B] se på lappen bak vakten', 'cl.h.door': '[B] bank på klubbdøra', 'cl.h.member': 'Den hemmelige klubben. Du er medlem!',
    'cl.guard.wake': 'Hm? Hva? Hvem der? Ingen titting! Kom tilbake på klubbdagen.', 'cl.guard.zzz': 'Zzz... (han sover tungt)',
    'cl.note': 'Lappen sier: «Passordet er {word}.» Hysj!', 'cl.guard.ask': 'Stopp! Hva er passordet?', 'cl.guard.wrong': 'Nei! Tenk på hintene...',
    'cl.guard.right': 'Riktig! Velkommen i klubben!', 'cl.guard.closed': 'Klubben møtes på klubbdagen. Hysj.',
    'cl.word.pancake': 'Pannekake', 'cl.word.snowball': 'Snøball', 'cl.word.jellyfish': 'Manet', 'cl.word.teapot': 'Tekanne', 'cl.word.banana': 'Banan',
    'vd.club.end.1': 'Du fant det! Den hemmelige klubben ønsker deg velkommen!', 'vd.club.end.member': 'hysj! medlem! her er merket ditt. hemmelig.', 'vd.club.end.later': 'Kanskje neste gang!',
    'cl.task': '🤫 Den hemmelige klubben: finn passordet ({n} av 3 hint)',
    'map.a.party': 'Overraskelsesselskapet (museet)', 'vd.party.tm': 'I morgen er det overraskelsesselskap for Hu! Hysj!',
    'vd.party.news.start': 'Hysj! Rosa planlegger et overraskelsesselskap for kurator Hu. Ikke si det til ham!',
    'vd.party.news.mid': 'Rosa samler selskapsting til Hu. Har noen sagt det til ham? Forhåpentligvis ikke!',
    'vd.party.news.climax': 'I dag er det overraskelsesselskap for Hu, ved museet! Hysj!',
    'vd.party.news.surprised': 'Overraskelsesselskapet for Hu var en ekte overraskelse. Han smiler fortsatt.', 'vd.party.news.almost': 'Selskapet for Hu var nesten en overraskelse. Han lot som veldig godt!',
    'vd.party.news.guessed': 'Hu hadde gjettet selskapet, men han elsket det likevel.', 'vd.party.news.small': 'Selskapet for Hu var lite og søtt. Rosa bakte en bitteliten kake.',
    'vd.party.rosa.start.1': 'Hysj! Kurator Hu har klekkedag snart. La oss holde et overraskelsesselskap for ham!',
    'vd.party.rosa.start.2': 'Tante Hassel har flaggband, Pip har ballonger og Grumbleton har en kake. Hent én om dagen og ta dem med til meg, og ikke la Hu se!',
    'vd.party.rosa.mid.1': 'Hvordan går det? Husk: hold tingene unna Hu!',
    'pt.give.hazel': 'Til selskapet? Her, det gamle flaggbandet mitt. Hysj!', 'pt.give.pip': 'Ballonger! Jeg blåste dem opp selv. Gjem dem!', 'pt.give.grumbleton': 'En kake, har! Min berømte tangsukkerbrød. Ikke la ugla lukte den.',
    'pt.noticed': 'Hu: «Å, hva er det du bærer på?» ...Du gjemmer det bak ryggen.', 'pt.deliver': 'Perfekt! Nå venter vi på den store dagen. Hysj!',
    'pt.item.bunting': 'flaggband', 'pt.item.balloons': 'ballonger', 'pt.item.cake': 'en kake',
    'vd.party.end.1': 'OVERRASKELSE! Gratulerer med klekkedagen, Hu!',
    'vd.party.end.surprised': 'Hu! Et selskap? For meg? Jeg ante ingenting! Takk, takk!', 'vd.party.end.almost': 'Hu-hu! Jeg syntes jeg så ballonger... men dette gjettet jeg aldri!',
    'vd.party.end.guessed': 'Hu, kanskje jeg gjettet det. Men det er enda bedre enn jeg håpet!', 'vd.party.end.small': 'Et lite selskap! Så hyggelig. Takk, Rosa.',
    'pt.task': '🎉 Overraskelsesselskapet for Hu: ta med tingene til Rosa ({n} av 3), ikke la Hu se',
    'map.a.rumour': 'Der sjøuhyret ble sett', 'vd.rumour.tm': 'I morgen forteller Hu hva han egentlig så på havet!',
    'vd.rumour.news.start': 'Grumbleton sier at kurator Hu så et sjøuhyre! Eller gjorde han det?',
    'vd.rumour.news.mid': 'Nå sier alle at sjøuhyret har hatt på seg. Og synger!',
    'vd.rumour.news.climax': 'I dag forteller Hu hva han egentlig så på havet, på stranda ved Krabbebukta.',
    'vd.rumour.news.duck': '«Sjøuhyret» var Grumbletons bortløpne badeand. Hele øya fniser.',
    'vd.rumour.grumbleton.start.1': 'Har du hørt det? Kurator Hu så et SJØUHYRE! Langt ute bak bukta!',
    'vd.rumour.grumbleton.start.2': 'Spør rundt. Alle har hørt noe!',
    'vd.rumour.hoot.start.1': 'Et uhyre? Sa jeg det? Jeg sa at jeg så... å, glem det. Vent til den store dagen.',
    'vd.rumour.grumbleton.mid.1': 'Uhyret blir større hver gang noen forteller om det. Har!',
    'rm.v.1': 'Sjøuhyret? Jeg hørte at det var like stort som fyret!', 'rm.v.2': 'Jeg hørte at sjøuhyret har en liten hatt!',
    'rm.v.3': 'De sier at sjøuhyret synger! Med den lille hatten sin!', 'rm.v.4': 'Jeg hørte at det synger OG slår hjul på bølgene. Med hatt!',
    'vd.rumour.end.1': 'Så... om dette «sjøuhyret»...', 'vd.rumour.end.duck': 'Det var en kjempestor gul badeand! Grumbletons! Den drev vekk i stormen. Hu-hu!',
    'rm.task': '👂 Ryktet om sjøuhyret: spør rundt ({n} har fortalt det)',
    'od.mem.fence.peace': 'Rosa og trener Bo vinker til hverandre over grinda nå.',
  },
});

const has = (k) => t(k) !== k;

/** The drama's memory on the island (old saves: none). */
export const memOf = (V) => (V.mem ||= {});

export const SOCIAL = {
  fence: {
    cast: ['rosa', 'coach'], at: { x: 18.4, z: -21.0 }, icon: '🌷',
    init(D) { D.side = null; },
    choice(D, id, st, last, V, done) {
      if (st !== 'start' || D.side) return;
      last.choices = [`vd.fence.side.${id}`, `vd.fence.side.${id === 'rosa' ? 'coach' : 'rosa'}`, 'vd.fence.side.peace'];
      last.onChoice = (i) => {
        D.side = i === 0 ? id : i === 1 ? (id === 'rosa' ? 'coach' : 'rosa') : 'peace';
        V.host.say([{ who: id, key: D.side === 'peace' ? 'vd.fence.sharing' : 'vd.fence.picked' }], done);
        V.host.markDirty();
      };
    },
    outcome: (D) => D.side || 'peace',
    part: (D) => !!D.side,
    reward(D, seen, V) { if (seen) V.host.grant({ coins: 30 }); memOf(V.V).fence = D.res; },
    props(V, Vs) {
      const res = memOf(Vs).fence, D = Vs.drama, on = D?.id === 'fence' || res;
      let g = V.props.get('s:fence');
      if (!on) { if (g) g.visible = false; return; }
      if (!g) { g = makeFence(); const a = SOCIAL.fence.at; g.position.set(a.x, heightAt(a.x, a.z), a.z); V.host.scene.add(g); V.props.set('s:fence', g); V.host.map.boxObs(a.x, a.z, 1.7, 0.12); }
      g.visible = true;
      const look = D?.id === 'fence' && !D.res ? (dayIndex() >= D.start + 2 ? 'sign' : 'plain') : (D?.res || res || 'plain');
      for (const [k, part] of Object.entries(g.userData.parts)) part.visible = k === look || (k === 'sign' && look === 'sign');
    },
  },
  election: {
    cast: ['hazel', 'grumbleton'], at: { x: 13.6, z: -8.6 }, icon: '🗳️', mapAlways: true,
    // (until the count the map and the Today board point at the ballot box, where you vote: play-test, the marker stood
    // 3 m off it, where nothing answered [B])
    mapAt: (D, di) => (di < D.climax ? BALLOT : null),
    init(D) { D.vote = null; },
    /** A villager's vote: Hazel and Grumbleton for their own idea, a friend of yours (3 hearts+) like you, the others their own lean. */
    voteOf(D, id, S) {
      if (id === 'hazel') return 'clock';
      if (id === 'grumbleton') return 'bell';
      if (D.vote && S && heartsOf(npcState(S, id)) >= ELECTION_FRIEND) return D.vote;
      return dayRand(`lean:${D.start}:${id}`) < 0.5 ? 'clock' : 'bell';
    },
    tally(D, di = dayIndex(), S = null) {
      // the villagers' votes come in day by day (all of them by the big day), and yours
      const days = Math.max(0, Math.min(D.climax, di) - D.start + 1), n = Math.min(VOTERS.length, Math.round((days / Math.max(1, D.climax - D.start + 1)) * VOTERS.length));
      const order = [...VOTERS].sort((a, b) => dayRand(`vord:${D.start}:${a}`) - dayRand(`vord:${D.start}:${b}`));
      let clock = 0, bell = 0;
      for (let i = 0; i < n; i++) if (SOCIAL.election.voteOf(D, order[i], S) === 'clock') clock++; else bell++;
      if (D.vote === 'clock') clock++;
      if (D.vote === 'bell') bell++;
      return { clock, bell };
    },
    newsVars: (D, b, V) => (b === 'mid' ? SOCIAL.election.tally(D, dayIndex(), V?.S) : undefined),
    outcome(D, V) { const T = SOCIAL.election.tally(D, D.climax, V?.S); return T.clock > T.bell ? 'clock' : T.bell > T.clock ? 'bell' : dayRand(`vtie:${D.start}`) < 0.5 ? 'clock' : 'bell'; },
    part: (D) => !!D.vote,
    reward(D, seen, V) { memOf(V.V).election = D.res; if (seen) V.host.grant({ coins: 20 }); },
    interactions(P, out, nm, D, V) {
      if (Math.hypot(P.x - BALLOT.x, P.z - BALLOT.z) > 1.4 || dayIndex() >= D.climax) return false;
      out.b = D.vote ? { text: t('el.h.voted'), fn: () => V.host.game.audio.play('select') } : { text: nm('el.h.vote'), fn: () => SOCIAL.election.vote(D, V) };
      return true;
    },
    vote(D, V) {
      V.host.say([{ name: t('map.a.election'), css: '#4a6fd8', key: 'el.ask', choices: ['el.clock', 'el.bell', 'el.no'], onChoice: (i) => {
        if (i > 1) return;
        D.vote = i === 0 ? 'clock' : 'bell';
        V.host.game.ui.toast(t('el.t.voted'), 3200);
        V.host.game.audio.play('coin');
        V.host.markDirty();
      } }]);
    },
    props(V, Vs) {
      const D = Vs.drama, res = memOf(Vs).election;
      let box = V.props.get('s:ballot');
      const boxOn = D?.id === 'election' && !D.res;
      if (boxOn && !box) { box = makeDeco11('ballotBox'); box.scale.setScalar(1.6); box.position.set(BALLOT.x, heightAt(BALLOT.x, BALLOT.z), BALLOT.z); V.host.scene.add(box); V.props.set('s:ballot', box); }
      if (box) box.visible = boxOn;
      let g = V.props.get('s:square');
      if (res && !g) { g = res === 'clock' ? makeFlowerClock() : makeShipBell(); const a = { x: 15.9, z: -1.2 }; g.position.set(a.x, heightAt(a.x, a.z), a.z); V.host.scene.add(g); V.props.set('s:square', g); }
    },
  },
  club: {
    cast: ['pip', 'mumble'], at: { x: -3.0, z: 25.6 }, icon: '🤫', mapAlways: true,
    init(D) { D.pw = Math.floor(dayRand(`pw:${D.start}`) * PASSWORDS.length); D.clues = []; D.member = false; D.note = false; D.woke = null; },
    word: (D) => PASSWORDS[D.pw || 0].word,
    talkOther(D, n, V, done) {
      const i = { hazel: 1, rosa: 2, bram: 3 }[n.id], di = dayIndex();
      if (!i || di >= D.climax || D.clues.includes(i) || D.clueDay === di) return false;
      D.clues.push(i);
      D.clueDay = di;
      V.host.say([{ who: n.id, key: 'cl.clue', vars: { clue: t(`cl.clue.${SOCIAL.club.word(D)}.${i}`) } }], done);
      V.host.markDirty();
      return true;
    },
    hasNews: (D, id) => ({ hazel: 1, rosa: 2, bram: 3 }[id] && !D.clues.includes({ hazel: 1, rosa: 2, bram: 3 }[id]) && D.clueDay !== dayIndex() && dayIndex() < D.climax),
    outcome: (D) => (D.member ? 'member' : 'later'),
    waitClimax: (D) => !D.member, // (the big moment plays once you said the password at the door; at 18 it ends without you)
    part: (D) => D.member,
    reward(D, seen, V) { if (D.member) { memOf(V.V).club = true; V.host.grant({ coins: 25, deco: 'clubPin' }); } },
    interactions(P, out, nm, D, V) {
      const di = dayIndex(), host = V.host;
      // the sleepy guard: tiptoe up in Sneaky mode to read the note behind him (any noise wakes him: no peeking today)
      if (Math.hypot(P.x - GUARD.x, P.z - GUARD.z) < 1.6 && di < D.climax) {
        out.b = D.woke === di ? { text: t('cl.guard.wake'), fn: () => host.game.audio.play('bump') } : { text: nm('cl.h.guard'), fn: () => SOCIAL.club.peek(D, V) };
        return true;
      }
      if (Math.hypot(P.x - CLUB_DOOR.x, P.z - (CLUB_DOOR.z + 1.2)) < 1.5) {
        out.b = D.member ? { text: t('cl.h.member'), fn: () => host.game.audio.play('select') } : { text: nm('cl.h.door'), fn: () => SOCIAL.club.knock(D, V) };
        return true;
      }
      return false;
    },
    /** Every second: noise near the guard wakes him (Normal or Sporty mode within 3 m). */
    tick(D, V) {
      const P = V.host.player, di = dayIndex();
      if (!P || D.woke === di || di >= D.climax || V.host.mode !== 'walk') return;
      const noise = V.host.odd?.modes?.noise ?? 1;
      if (Math.hypot(P.x - GUARD.x, P.z - GUARD.z) < 3.2 * noise) { D.woke = di; V.host.game.ui.toast(t('cl.guard.wake'), 2600); V.host.markDirty(); }
    },
    peek(D, V) {
      const host = V.host;
      if ((host.odd?.modes?.mode || 'normal') !== 'sneaky') { D.woke = dayIndex(); host.game.ui.toast(t('cl.guard.wake'), 2600); host.markDirty(); return; }
      D.note = true;
      report(host, 'island', { key: 'sneak', what: 'guard' });
      host.say([{ name: t('map.a.club'), css: '#2e3b6b', key: 'cl.note', vars: { word: t(`cl.word.${SOCIAL.club.word(D)}`) } }]);
      host.markDirty();
    },
    knock(D, V) {
      const host = V.host, di = dayIndex();
      const guard = (key, extra = {}) => ({ name: t('cl.guardName'), css: '#2e3b6b', speaker: 'isl.guard', key, ...extra });
      if (di !== D.climax) { host.say([guard('cl.guard.closed')]); return; }
      const right = SOCIAL.club.word(D);
      const words = [right, ...DECOYS.filter((w) => w !== right).sort((a, b) => dayRand(`dec:${D.start}:${a}`) - dayRand(`dec:${D.start}:${b}`)).slice(0, 3)];
      words.sort((a, b) => dayRand(`ord:${D.start}:${a}`) - dayRand(`ord:${D.start}:${b}`));
      host.say([guard('cl.guard.ask', { choices: words.map((w) => `cl.word.${w}`), onChoice: (i) => {
        if (words[i] !== right) { host.say([guard('cl.guard.wrong')]); return; }
        D.member = true;
        host.say([guard('cl.guard.right')], () => host.village.updateClimax(true));
        host.markDirty();
      } })]);
    },
    props(V, Vs) {
      const D = Vs.drama, on = D?.id === 'club' && !D.res;
      let g = V.props.get('s:club');
      if (on && !g) { g = makeClubLog(); g.position.set(CLUB_DOOR.x, heightAt(CLUB_DOOR.x, CLUB_DOOR.z), CLUB_DOOR.z); V.host.scene.add(g); V.props.set('s:club', g); g.userData.obs = V.host.map.boxObs(CLUB_DOOR.x, CLUB_DOOR.z, 1.3, 0.45); g.userData.gobs = V.host.map.circObs(GUARD.x, GUARD.z, 0.45); }
      if (g) { g.visible = on; g.userData.obs.x = on ? CLUB_DOOR.x : 1e5; g.userData.gobs.x = on ? GUARD.x : 1e5; g.userData.zzz.visible = on && D.woke !== dayIndex(); }
    },
  },
  party: {
    cast: ['rosa', 'hoot'], at: { x: 23.0, z: 4.4 }, icon: '🎉',
    init(D) { D.got = []; D.delivered = false; D.noticed = 0; D.noticedDay = null; },
    talkOther(D, n, V, done) {
      const thing = PARTY_GIVERS[n.id], di = dayIndex();
      if (thing && di < D.climax && !D.got.includes(thing) && !D.delivered && D.gotDay !== di) { // (one thing a day: one beat a day)
        D.got.push(thing);
        D.gotDay = di;
        V.host.say([{ who: n.id, key: `pt.give.${n.id}` }], done);
        V.host.markDirty();
        return true;
      }
      if (n.id === 'rosa' && di < D.climax && D.got.length >= 3 && !D.delivered) {
        D.delivered = true;
        V.host.say([{ who: 'rosa', key: 'pt.deliver' }], done);
        V.host.markDirty();
        return true;
      }
      return false;
    },
    talkFirst: (D, n) => n.id === 'rosa' && D.got.length >= 3 && !D.delivered, // (bringing the things wins over her other news)
    hasNews: (D, id) => dayIndex() < D.climax && ((PARTY_GIVERS[id] && !D.got.includes(PARTY_GIVERS[id]) && !D.delivered && D.gotDay !== dayIndex()) || (id === 'rosa' && D.got.length >= 3 && !D.delivered)),
    /** Carrying party things near Hoot: he notices (once a day). Sneaky mode: he only notices you right next to him. */
    tick(D, V) {
      const host = V.host, P = host.player, di = dayIndex(), hoot = host.npc('hoot');
      if (!P || !hoot || hoot.sleep || hoot.inside || !D.got.length || D.delivered || di >= D.climax || D.noticedDay === di || host.mode !== 'walk') return;
      const r = 4.5 * (host.odd?.modes?.noise ?? 1);
      if (Math.hypot(P.x - hoot.x, P.z - hoot.z) < Math.max(1.4, r)) { D.noticed++; D.noticedDay = di; host.game.ui.toast(t('pt.noticed'), 3000); host.markDirty(); }
    },
    outcome: (D) => (!D.delivered ? 'small' : D.noticed === 0 ? 'surprised' : D.noticed === 1 ? 'almost' : 'guessed'),
    part: (D) => D.delivered,
    reward(D, seen, V) { if (D.delivered && seen) V.host.grant({ coins: D.noticed === 0 ? 50 : 30 }); if (D.delivered && D.noticed === 0) report(V.host, 'island', { key: 'sneak', what: 'party' }); },
    props(V, Vs) {
      const D = Vs.drama, on = D?.id === 'party' && D.climax === dayIndex();
      let g = V.props.get('s:party');
      if (on && !g) { g = makePartyDeco(); const a = SOCIAL.party.at; g.position.set(a.x, heightAt(a.x, a.z), a.z); V.host.scene.add(g); V.props.set('s:party', g); }
      if (g) g.visible = on;
    },
  },
  rumour: {
    cast: ['grumbleton', 'hoot'], at: { x: 31.0, z: 36.0 }, icon: '👂',
    init(D) { D.tellers = []; }, // (who told you a version; D.told is the drama's own "lines said" record)
    talkOther(D, n, V, done) {
      const di = dayIndex();
      D.tellers ||= [];
      if (di >= D.climax || D.tellers.includes(n.id) || D.tellers.length >= RUMOUR_MAX || ['grumbleton', 'hoot', 'shelby'].includes(n.id) || D.toldDay === di) return false;
      D.tellers.push(n.id);
      D.toldDay = di;
      V.host.say([{ who: n.id, key: `rm.v.${D.tellers.length}` }], done);
      V.host.markDirty();
      return true;
    },
    outcome: () => 'duck',
    part: (D) => (D.tellers || []).length >= 2,
    reward(D, seen, V) { if (seen && (D.tellers || []).length >= 2) V.host.grant({ coins: 25, items: [['rubberDuck', 1]] }); },
  },
};
export const SOCIAL_IDS = Object.keys(SOCIAL);

/** Tasks for the drama going on (village.js asks). */
export function socialTasks(D) {
  if (!D || D.res || dayIndex() > D.climax) return [];
  if (D.id === 'club' && !D.member && !D.note) return [t('cl.task', { n: D.clues.length })];
  if (D.id === 'party' && !D.delivered && dayIndex() < D.climax) return [t('pt.task', { n: D.got.length })];
  if (D.id === 'rumour' && dayIndex() < D.climax) return [t('rm.task', { n: (D.tellers || []).length })];
  return [];
}

addStrings({ en: { 'cl.guardName': 'Sleepy guard' }, no: { 'cl.guardName': 'Søvnig vakt' } });

// ---------- models ----------

function makeFence() {
  const g = new THREE.Group();
  for (let i = 0; i < 6; i++) g.add(mesh(box(0.1, 0.9, 0.1), 0xffffff, -1.5 + i * 0.6, 0.45, 0));
  g.add(mesh(box(3.3, 0.08, 0.06), 0xffffff, 0, 0.7, 0), mesh(box(3.3, 0.08, 0.06), 0xffffff, 0, 0.35, 0));
  const parts = { plain: new THREE.Group(), sign: new THREE.Group(), peace: new THREE.Group(), rosa: new THREE.Group(), coach: new THREE.Group() };
  parts.sign.add(mesh(box(0.8, 0.45, 0.04), 0xfff0d0, 0.3, 0.85, 0.08));
  for (let i = 0; i < 5; i++) parts.rosa.add(mesh(sph(0.12, 8, 6), [0xff7eb6, 0xffd23f, 0xc9a8ff][i % 3], -1.4 + i * 0.7, 0.2, 0.5, false));
  parts.coach.add(mesh(box(3.2, 0.02, 0.5), 0xd9583a, 0, 0.02, 0.55, false), mesh(box(3.2, 0.03, 0.05), 0xffffff, 0, 0.03, 0.55, false));
  parts.peace.add(mesh(box(0.7, 0.7, 0.06), 0xffc93c, 0, 0.45, 0.05));
  for (let i = 0; i < 3; i++) parts.peace.add(mesh(sph(0.11, 8, 6), [0xff7eb6, 0xffd23f, 0xc9a8ff][i], -1.3 + i * 0.4, 0.2, -0.45, false));
  parts.peace.add(mesh(box(1.4, 0.02, 0.4), 0xd9583a, 1.0, 0.02, 0.45, false));
  for (const p of Object.values(parts)) g.add(p);
  g.userData.parts = parts;
  return g;
}

function makeFlowerClock() {
  const g = new THREE.Group();
  g.add(mesh(cyl(1.0, 1.1, 0.25, 20), 0x7ac943, 0, 0.12, 0));
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; g.add(mesh(sph(0.12, 8, 6), [0xff7eb6, 0xffd23f, 0xffffff][i % 3], Math.cos(a) * 0.8, 0.3, Math.sin(a) * 0.8, false)); }
  const hand = mesh(box(0.06, 0.04, 0.7), 0x2b2340, 0, 0.3, -0.3, false);
  g.add(hand, mesh(box(0.06, 0.04, 0.45), 0x2b2340, 0.2, 0.31, 0, false));
  g.userData.hand = hand;
  return g;
}

function makeShipBell() {
  const g = new THREE.Group();
  g.add(mesh(box(0.12, 1.8, 0.12), 0x8a5a32, -0.5, 0.9, 0), mesh(box(0.12, 1.8, 0.12), 0x8a5a32, 0.5, 0.9, 0), mesh(box(1.2, 0.12, 0.14), 0x8a5a32, 0, 1.8, 0));
  g.add(mesh(cone(0.32, 0.5, 14), 0xffc93c, 0, 1.45, 0), mesh(sph(0.06, 6, 4), 0xb8860b, 0, 1.18, 0));
  return g;
}

function makeClubLog() {
  const g = new THREE.Group();
  const log = mesh(cyl(0.55, 0.6, 2.6, 12), 0x8a5a32, 0, 0.55, 0);
  log.rotation.z = Math.PI / 2;
  g.add(log, mesh(box(0.5, 0.6, 0.05), 0x5a3a24, 0, 0.45, 0.58), mesh(sph(0.04, 6, 4), 0xffd23f, 0.15, 0.45, 0.62, false));
  // the sleepy guard: a round bean in a big scarf, nodding off on a stool
  const guard = new THREE.Group();
  guard.position.set(GUARD.x - CLUB_DOOR.x, 0, GUARD.z - CLUB_DOOR.z);
  guard.add(mesh(cyl(0.22, 0.22, 0.35, 10), 0xc68a52, 0, 0.17, 0), mesh(sph(0.42, 14, 10), 0x6a8ad8, 0, 0.75, 0), mesh(cyl(0.38, 0.4, 0.14, 14), 0xff9f40, 0, 0.95, 0));
  guard.add(mesh(box(0.3, 0.22, 0.02), 0xfff6e0, 0, 0.7, -0.42)); // the note behind him
  const zzz = mesh(sph(0.1, 6, 4), basic(0xffffff), 0.3, 1.4, 0, false);
  guard.add(zzz);
  g.add(guard);
  g.userData.zzz = zzz;
  return g;
}

function makePartyDeco() {
  const g = new THREE.Group();
  for (const [x, c] of [[-1.2, 0xff5d73], [-0.8, 0x4cc9f0], [1.0, 0xffd23f], [1.4, 0x9b5de5]]) g.add(mesh(cyl(0.01, 0.01, 1.6, 4), 0xffffff, x, 0.8, 0), mesh(sph(0.25, 10, 8), c, x, 1.7, 0));
  g.add(mesh(cyl(0.35, 0.4, 0.35, 14), 0xfff0e0, 0, 0.5, 0.4), mesh(box(0.06, 0.6, 0.06), 0x8a5a32, 0, 0.3, 0.4), mesh(sph(0.06, 6, 4), 0xff5d73, 0, 0.75, 0.4, false));
  return g;
}

export { has };
