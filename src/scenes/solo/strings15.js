import { addStrings } from '../../core/i18n.js';

// Strings for the odd-adventure round's social happenings (social.js): what the other villagers say about them to each
// other (village.js conversations: three lines, A, B, A; heard once, then not again for four weeks).

const EN = {
  'fence.start': ['Rosa and Coach Bo are cross about a fence.', 'Flowers or running? Tricky!', 'Why not both? A fence has two sides.'],
  'fence.mid': ['There is a sign on that fence now.', 'A polite sign?', 'Mostly polite. It has a frowny tulip on it.'],
  'election.start': ['We get to vote! For the square!', 'A flower clock or a ship\'s bell?', 'I cannot decide. They both go ding. Well, one of them.'],
  'election.mid': ['Have you voted yet?', 'I put my paper in the box. Secretly!', 'Me too. I will not tell. Ding.'],
  'club.start': ['Pip and Mumble have a secret club.', 'What is the password?', 'If I knew, it would not be a secret!'],
  'club.mid': ['Their club guard falls asleep all the time.', 'Then how does he guard?', 'Very quietly. Zzz.'],
  'party.start': ['Shhh... a party for you-know-who.', 'For who?', 'You KNOW who. Feathers. Big eyes. Shhh!'],
  'party.mid': ['I hid the balloons under my bed.', 'Did he see them?', 'I hope not. They keep floating up.'],
  'rumour.start': ['Did you hear about the sea monster?', 'Hoot saw it! Or Grumbleton did.', 'Or someone heard someone see it.'],
  'rumour.mid': ['The sea monster wears a hat now.', 'Since when?', 'Since this morning. It grows every time.'],
};
const NO = {
  'fence.start': ['Rosa og trener Bo er sinte på hverandre på grunn av et gjerde.', 'Blomster eller løping? Vanskelig!', 'Hvorfor ikke begge deler? Et gjerde har to sider.'],
  'fence.mid': ['Det henger et skilt på det gjerdet nå.', 'Et høflig skilt?', 'Nesten høflig. Det er en sur tulipan på det.'],
  'election.start': ['Vi får stemme! Om torget!', 'En blomsterklokke eller en skipsklokke?', 'Jeg klarer ikke bestemme meg. Begge sier ding. Vel, den ene.'],
  'election.mid': ['Har du stemt ennå?', 'Jeg puttet lappen min i urna. I hemmelighet!', 'Jeg også. Jeg sier ingenting. Ding.'],
  'club.start': ['Pip og Mumle har en hemmelig klubb.', 'Hva er passordet?', 'Hvis jeg visste det, var det ikke hemmelig!'],
  'club.mid': ['Klubbvakten deres sovner hele tiden.', 'Hvordan vokter han da?', 'Veldig stille. Zzz.'],
  'party.start': ['Hysj... et selskap for du-vet-hvem.', 'For hvem?', 'Du VET hvem. Fjær. Store øyne. Hysj!'],
  'party.mid': ['Jeg gjemte ballongene under senga.', 'Så han dem?', 'Jeg håper ikke. De flyter opp hele tiden.'],
  'rumour.start': ['Har du hørt om sjøuhyret?', 'Hu så det! Eller Grumbleton gjorde.', 'Eller noen hørte at noen så det.'],
  'rumour.mid': ['Sjøuhyret har hatt nå.', 'Siden når?', 'Siden i morges. Det vokser hver gang.'],
};
const lines = (src) => Object.fromEntries(Object.entries(src).flatMap(([k, ls]) => ls.map((s, i) => [`vc.${k}.${i + 1}`, s])));
addStrings({ en: lines(EN), no: lines(NO) });
