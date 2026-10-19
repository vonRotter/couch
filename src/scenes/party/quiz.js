import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Round, clock } from './common.js';
import { COLORS, toon, sharedGeo } from '../../core/palette.js';
import { makeTree, makeFlower, makeCloud, seeded } from '../../core/world.js';
import { glyphMaterial, shuffle } from '../../core/edu.js';
import { esc } from '../../core/ui.js';
import { t, addStrings } from '../../core/i18n.js';
import { PICTURE_PUZZLES, buildPuzzle, pickPuzzles, modeIcon, sayAloud, stopSpeaking } from './quiz-pictures.js';

// Question bank. Each entry: [question, correct answer, wrong, wrong, wrong] in both languages.
// The correct answer is always written first here; answers are shuffled when asked.
const KID = [
  { en: ['How many legs does a spider have?', '8', '6', '10', '4'], no: ['Hvor mange bein har en edderkopp?', '8', '6', '10', '4'] },
  { en: ['Mixing blue and yellow paint makes...', 'Green', 'Purple', 'Orange', 'Brown'], no: ['Blå og gul maling blir til ...', 'Grønn', 'Lilla', 'Oransje', 'Brun'] },
  { en: ['Which animal says "moo"?', 'Cow', 'Sheep', 'Pig', 'Horse'], no: ['Hvilket dyr sier «mø»?', 'Ku', 'Sau', 'Gris', 'Hest'] },
  { en: ['How many days are there in a week?', '7', '5', '6', '10'], no: ['Hvor mange dager er det i en uke?', '7', '5', '6', '10'] },
  { en: ['What do we call frozen water?', 'Ice', 'Steam', 'Sand', 'Glass'], no: ['Hva kaller vi frossent vann?', 'Is', 'Damp', 'Sand', 'Glass'] },
  { en: ['Which planet do we live on?', 'Earth', 'Mars', 'Venus', 'Jupiter'], no: ['Hvilken planet bor vi på?', 'Jorda', 'Mars', 'Venus', 'Jupiter'] },
  { en: ['What do bees make?', 'Honey', 'Milk', 'Jam', 'Butter'], no: ['Hva lager biene?', 'Honning', 'Melk', 'Syltetøy', 'Smør'] },
  { en: ['What is the biggest animal in the world?', 'Blue whale', 'Elephant', 'Giraffe', 'Polar bear'], no: ['Hva er verdens største dyr?', 'Blåhval', 'Elefant', 'Sjiraff', 'Isbjørn'] },
  { en: ['How many legs does an insect have?', '6', '8', '4', '10'], no: ['Hvor mange bein har et insekt?', '6', '8', '4', '10'] },
  { en: ['What does a caterpillar turn into?', 'Butterfly', 'Bee', 'Spider', 'Bird'], no: ['Hva blir en sommerfugllarve til?', 'Sommerfugl', 'Bie', 'Edderkopp', 'Fugl'] },
  { en: ['Which season comes after winter?', 'Spring', 'Summer', 'Autumn', 'Winter'], no: ['Hvilken årstid kommer etter vinteren?', 'Våren', 'Sommeren', 'Høsten', 'Vinteren'] },
  { en: ['What color is a ripe banana?', 'Yellow', 'Blue', 'Red', 'Purple'], no: ['Hvilken farge har en moden banan?', 'Gul', 'Blå', 'Rød', 'Lilla'] },
  { en: ['How many wheels does a bicycle have?', '2', '3', '4', '1'], no: ['Hvor mange hjul har en sykkel?', '2', '3', '4', '1'] },
  { en: ['Which animal has a long trunk?', 'Elephant', 'Giraffe', 'Lion', 'Zebra'], no: ['Hvilket dyr har en lang snabel?', 'Elefant', 'Sjiraff', 'Løve', 'Sebra'] },
  { en: ['What is the opposite of hot?', 'Cold', 'Warm', 'Wet', 'Big'], no: ['Hva er det motsatte av varm?', 'Kald', 'Het', 'Våt', 'Stor'] },
  { en: ['Where do polar bears live?', 'The Arctic', 'Antarctica', 'The desert', 'The jungle'], no: ['Hvor bor isbjørnen?', 'I Arktis', 'I Antarktis', 'I ørkenen', 'I jungelen'] },
  { en: ['Which star is closest to Earth?', 'The Sun', 'The North Star', 'Sirius', 'The Moon'], no: ['Hvilken stjerne er nærmest jorda?', 'Sola', 'Nordstjerna', 'Sirius', 'Månen'] },
  { en: ['What is a baby dog called?', 'Puppy', 'Kitten', 'Calf', 'Foal'], no: ['Hva kaller vi en hundebaby?', 'Valp', 'Kattunge', 'Kalv', 'Føll'] },
  { en: ['What is a baby horse called?', 'Foal', 'Puppy', 'Lamb', 'Chick'], no: ['Hva kaller vi en hestebaby?', 'Føll', 'Valp', 'Lam', 'Kylling'] },
  { en: ['Which of these is a vegetable?', 'Carrot', 'Apple', 'Banana', 'Strawberry'], no: ['Hvilken av disse er en grønnsak?', 'Gulrot', 'Eple', 'Banan', 'Jordbær'] },
  { en: ['How many months are there in a year?', '12', '10', '7', '24'], no: ['Hvor mange måneder er det i et år?', '12', '10', '7', '24'] },
  { en: ['Which bird can NOT fly?', 'Penguin', 'Owl', 'Eagle', 'Seagull'], no: ['Hvilken fugl kan IKKE fly?', 'Pingvin', 'Ugle', 'Ørn', 'Måke'] },
  { en: ['Which shape has three sides?', 'Triangle', 'Square', 'Circle', 'Rectangle'], no: ['Hvilken form har tre sider?', 'Trekant', 'Kvadrat', 'Sirkel', 'Rektangel'] },
  { en: ['Which animal gives us wool?', 'Sheep', 'Cow', 'Pig', 'Hen'], no: ['Hvilket dyr gir oss ull?', 'Sau', 'Ku', 'Gris', 'Høne'] },
  { en: ['What is 5 + 3?', '8', '7', '9', '6'], no: ['Hva er 5 + 3?', '8', '7', '9', '6'] },
  { en: ['What is 10 − 4?', '6', '5', '7', '4'], no: ['Hva er 10 − 4?', '6', '5', '7', '4'] },
  { en: ['What is 2 + 2 + 2?', '6', '4', '8', '5'], no: ['Hva er 2 + 2 + 2?', '6', '4', '8', '5'] },
  { en: ['Which big cat has black stripes?', 'Tiger', 'Lion', 'Leopard', 'Cheetah'], no: ['Hvilket kattedyr har svarte striper?', 'Tiger', 'Løve', 'Leopard', 'Gepard'] },
  { en: ['What do fish breathe with?', 'Gills', 'Lungs', 'Noses', 'Fins'], no: ['Hva puster fisker med?', 'Gjeller', 'Lunger', 'Nese', 'Finner'] },
  { en: ['How many hours are there in a day?', '24', '12', '10', '60'], no: ['Hvor mange timer er det i et døgn?', '24', '12', '10', '60'] },
  { en: ['What is the capital of Norway?', 'Oslo', 'Bergen', 'Trondheim', 'Stavanger'], no: ['Hva er hovedstaden i Norge?', 'Oslo', 'Bergen', 'Trondheim', 'Stavanger'] },
  { en: ['Which colors are on the Norwegian flag?', 'Red, white, blue', 'Red and white', 'Blue and yellow', 'Green and white'], no: ['Hvilke farger har det norske flagget?', 'Rødt, hvitt, blått', 'Rødt og hvitt', 'Blått og gult', 'Grønt og hvitt'] },
  { en: ['Which animal hops and carries its baby in a pouch?', 'Kangaroo', 'Rabbit', 'Frog', 'Koala'], no: ['Hvilket dyr hopper og bærer ungen i en pung?', 'Kenguru', 'Kanin', 'Frosk', 'Koala'] },
  { en: ['What falls from the sky in winter and is white?', 'Snow', 'Rain', 'Leaves', 'Sand'], no: ['Hva faller fra himmelen om vinteren og er hvitt?', 'Snø', 'Regn', 'Løv', 'Sand'] },
  { en: ['Which planet is called the Red Planet?', 'Mars', 'Venus', 'Jupiter', 'Saturn'], no: ['Hvilken planet kalles den røde planeten?', 'Mars', 'Venus', 'Jupiter', 'Saturn'] },
  { en: ['What is the fastest animal on land?', 'Cheetah', 'Lion', 'Horse', 'Rabbit'], no: ['Hva er det raskeste dyret på land?', 'Gepard', 'Løve', 'Hest', 'Kanin'] },
  { en: ['How many legs does a bird have?', '2', '4', '6', '3'], no: ['Hvor mange bein har en fugl?', '2', '4', '6', '3'] },
  { en: ['What do we smell with?', 'Nose', 'Ears', 'Eyes', 'Hands'], no: ['Hva lukter vi med?', 'Nesen', 'Ørene', 'Øynene', 'Hendene'] },
  { en: ['Which of these is a mammal?', 'Dolphin', 'Shark', 'Salmon', 'Octopus'], no: ['Hvilket av disse er et pattedyr?', 'Delfin', 'Hai', 'Laks', 'Blekksprut'] },
  { en: ['Which sea animal has eight arms?', 'Octopus', 'Starfish', 'Jellyfish', 'Crab'], no: ['Hvilket havdyr har åtte armer?', 'Blekksprut', 'Sjøstjerne', 'Manet', 'Krabbe'] },
  { en: ["When is Norway's national day?", '17 May', '1 May', '24 December', '6 June'], no: ['Når er Norges nasjonaldag?', '17. mai', '1. mai', '24. desember', '6. juni'] },
  { en: ['What do we get from cows?', 'Milk', 'Eggs', 'Wool', 'Honey'], no: ['Hva får vi fra kua?', 'Melk', 'Egg', 'Ull', 'Honning'] },
  { en: ['How many fingers are on one hand?', '5', '4', '6', '10'], no: ['Hvor mange fingre er det på én hånd?', '5', '4', '6', '10'] },
  { en: ['Mixing red and white paint makes...', 'Pink', 'Green', 'Blue', 'Black'], no: ['Rød og hvit maling blir til ...', 'Rosa', 'Grønn', 'Blå', 'Svart'] },
  { en: ['Which animal sleeps through the winter in a den?', 'Bear', 'Moose', 'Reindeer', 'Fox'], no: ['Hvilket dyr sover gjennom vinteren i et hi?', 'Bjørn', 'Elg', 'Reinsdyr', 'Rev'] },
];

const ADULT = [
  { en: ['What is the chemical symbol for gold?', 'Au', 'Ag', 'Go', 'Gd'], no: ['Hva er det kjemiske symbolet for gull?', 'Au', 'Ag', 'Go', 'Gd'] },
  { en: ['How many bones does an adult human have?', '206', '180', '230', '260'], no: ['Hvor mange knokler har et voksent menneske?', '206', '180', '230', '260'] },
  { en: ['Which is the largest planet in our solar system?', 'Jupiter', 'Saturn', 'Neptune', 'Earth'], no: ['Hvilken planet er størst i solsystemet?', 'Jupiter', 'Saturn', 'Neptun', 'Jorda'] },
  { en: ["Which is Norway's longest river?", 'Glomma', 'Tana', 'Otra', 'Drammenselva'], no: ['Hva er Norges lengste elv?', 'Glomma', 'Tana', 'Otra', 'Drammenselva'] },
  { en: ["Which is Norway's highest mountain?", 'Galdhøpiggen', 'Glittertind', 'Snøhetta', 'Store Skagastølstind'], no: ['Hva er Norges høyeste fjell?', 'Galdhøpiggen', 'Glittertind', 'Snøhetta', 'Store Skagastølstind'] },
  { en: ['In which year did people first land on the Moon?', '1969', '1959', '1972', '1965'], no: ['Hvilket år landet mennesker på månen for første gang?', '1969', '1959', '1972', '1965'] },
  { en: ['What is the capital of Australia?', 'Canberra', 'Sydney', 'Melbourne', 'Perth'], no: ['Hva er hovedstaden i Australia?', 'Canberra', 'Sydney', 'Melbourne', 'Perth'] },
  { en: ['Which gas do plants take in for photosynthesis?', 'Carbon dioxide', 'Oxygen', 'Nitrogen', 'Helium'], no: ['Hvilken gass tar plantene opp i fotosyntesen?', 'Karbondioksid', 'Oksygen', 'Nitrogen', 'Helium'] },
  { en: ['How many minutes are there in a day?', '1440', '1240', '1400', '1600'], no: ['Hvor mange minutter er det i et døgn?', '1440', '1240', '1400', '1600'] },
  { en: ['Who painted "The Scream"?', 'Edvard Munch', 'Claude Monet', 'Vincent van Gogh', 'Pablo Picasso'], no: ['Hvem malte «Skrik»?', 'Edvard Munch', 'Claude Monet', 'Vincent van Gogh', 'Pablo Picasso'] },
  { en: ['Which is the largest ocean?', 'Pacific', 'Atlantic', 'Indian', 'Arctic'], no: ['Hvilket hav er størst?', 'Stillehavet', 'Atlanterhavet', 'Indiahavet', 'Polhavet'] },
  { en: ['Roughly how fast does light travel?', '300,000 km/s', '30,000 km/s', '3,000 km/s', '3 million km/s'], no: ['Omtrent hvor fort går lyset?', '300 000 km/s', '30 000 km/s', '3000 km/s', '3 millioner km/s'] },
  { en: ['Which planet is closest to the Sun?', 'Mercury', 'Venus', 'Mars', 'Earth'], no: ['Hvilken planet er nærmest sola?', 'Merkur', 'Venus', 'Mars', 'Jorda'] },
  { en: ['What is the hardest natural material?', 'Diamond', 'Granite', 'Iron', 'Quartz'], no: ['Hva er det hardeste naturlige stoffet?', 'Diamant', 'Granitt', 'Jern', 'Kvarts'] },
  { en: ['What is the smallest prime number?', '2', '1', '3', '0'], no: ['Hva er det minste primtallet?', '2', '1', '3', '0'] },
  { en: ['Which blood type is the universal donor?', 'O negative', 'AB positive', 'A positive', 'B negative'], no: ['Hvilken blodtype er universalgiver?', 'O negativ', 'AB positiv', 'A positiv', 'B negativ'] },
  { en: ['In which city is the Nobel Peace Prize awarded?', 'Oslo', 'Stockholm', 'Geneva', 'Copenhagen'], no: ['I hvilken by deles Nobels fredspris ut?', 'Oslo', 'Stockholm', 'Genève', 'København'] },
  { en: ['What is the chemical symbol for iron?', 'Fe', 'Ir', 'In', 'I'], no: ['Hva er det kjemiske symbolet for jern?', 'Fe', 'Ir', 'In', 'I'] },
  { en: ['How many players does a football team have on the pitch?', '11', '10', '9', '12'], no: ['Hvor mange spillere har et fotballag på banen?', '11', '10', '9', '12'] },
  { en: ['Who wrote "Peer Gynt"?', 'Henrik Ibsen', 'Knut Hamsun', 'Bjørnstjerne Bjørnson', 'Sigrid Undset'], no: ['Hvem skrev «Peer Gynt»?', 'Henrik Ibsen', 'Knut Hamsun', 'Bjørnstjerne Bjørnson', 'Sigrid Undset'] },
  { en: ['At what temperature does water freeze in Fahrenheit?', '32 °F', '0 °F', '100 °F', '212 °F'], no: ['Ved hvilken temperatur fryser vann i Fahrenheit?', '32 °F', '0 °F', '100 °F', '212 °F'] },
  { en: ['How many hearts does an octopus have?', '3', '1', '2', '8'], no: ['Hvor mange hjerter har en åttearmet blekksprut?', '3', '1', '2', '8'] },
  { en: ['What is the largest hot desert in the world?', 'Sahara', 'Gobi', 'Kalahari', 'Atacama'], no: ['Hva er verdens største varme ørken?', 'Sahara', 'Gobi', 'Kalahari', 'Atacama'] },
  { en: ['How long does sunlight take to reach Earth?', 'About 8 minutes', 'About 8 seconds', 'About 8 hours', 'About 8 days'], no: ['Hvor lang tid bruker sollyset til jorda?', 'Ca. 8 minutter', 'Ca. 8 sekunder', 'Ca. 8 timer', 'Ca. 8 dager'] },
  { en: ['What is the capital of Canada?', 'Ottawa', 'Toronto', 'Vancouver', 'Montreal'], no: ['Hva er hovedstaden i Canada?', 'Ottawa', 'Toronto', 'Vancouver', 'Montréal'] },
  { en: ['In which year was the union of Norway and Sweden dissolved?', '1905', '1814', '1945', '1884'], no: ['Hvilket år ble unionen mellom Norge og Sverige oppløst?', '1905', '1814', '1945', '1884'] },
  { en: ['Who was first to reach the South Pole?', 'Roald Amundsen', 'Fridtjof Nansen', 'Robert F. Scott', 'Thor Heyerdahl'], no: ['Hvem kom først til Sydpolen?', 'Roald Amundsen', 'Fridtjof Nansen', 'Robert F. Scott', 'Thor Heyerdahl'] },
  { en: ['What is the largest organ of the human body?', 'Skin', 'Liver', 'Brain', 'Lungs'], no: ['Hva er menneskekroppens største organ?', 'Huden', 'Leveren', 'Hjernen', 'Lungene'] },
  { en: ['How many sides does a hexagon have?', '6', '5', '7', '8'], no: ['Hvor mange sider har en heksagon?', '6', '5', '7', '8'] },
  { en: ['What is the main ingredient in guacamole?', 'Avocado', 'Peas', 'Cucumber', 'Spinach'], no: ['Hva er hovedingrediensen i guacamole?', 'Avokado', 'Erter', 'Agurk', 'Spinat'] },
  { en: ['Which planet has the most visible rings?', 'Saturn', 'Jupiter', 'Mars', 'Venus'], no: ['Hvilken planet har de mest synlige ringene?', 'Saturn', 'Jupiter', 'Mars', 'Venus'] },
  { en: ['What is the square root of 144?', '12', '14', '11', '16'], no: ['Hva er kvadratroten av 144?', '12', '14', '11', '16'] },
  { en: ['Who came up with the theory of relativity?', 'Albert Einstein', 'Isaac Newton', 'Niels Bohr', 'Galileo Galilei'], no: ['Hvem kom opp med relativitetsteorien?', 'Albert Einstein', 'Isaac Newton', 'Niels Bohr', 'Galileo Galilei'] },
  { en: ['What is the currency of Japan?', 'Yen', 'Won', 'Yuan', 'Baht'], no: ['Hva heter valutaen i Japan?', 'Yen', 'Won', 'Yuan', 'Baht'] },
  { en: ['Which bird is the fastest in a dive?', 'Peregrine falcon', 'Golden eagle', 'Swift', 'Albatross'], no: ['Hvilken fugl er raskest i stup?', 'Vandrefalk', 'Kongeørn', 'Tårnseiler', 'Albatross'] },
  { en: ["What is Norway's largest lake?", 'Mjøsa', 'Femunden', 'Tyrifjorden', 'Randsfjorden'], no: ['Hva er Norges største innsjø?', 'Mjøsa', 'Femunden', 'Tyrifjorden', 'Randsfjorden'] },
  { en: ['How many symphonies did Beethoven complete?', '9', '5', '7', '12'], no: ['Hvor mange symfonier fullførte Beethoven?', '9', '5', '7', '12'] },
  { en: ['Which vitamin does your skin make from sunlight?', 'Vitamin D', 'Vitamin C', 'Vitamin A', 'Vitamin B12'], no: ['Hvilket vitamin lager huden ved hjelp av sollys?', 'D-vitamin', 'C-vitamin', 'A-vitamin', 'B12-vitamin'] },
  { en: ['What is the capital of Iceland?', 'Reykjavík', 'Akureyri', 'Tórshavn', 'Nuuk'], no: ['Hva er hovedstaden på Island?', 'Reykjavík', 'Akureyri', 'Tórshavn', 'Nuuk'] },
  { en: ['Which country gave the Statue of Liberty to the USA?', 'France', 'United Kingdom', 'Spain', 'Italy'], no: ['Hvilket land ga Frihetsgudinnen til USA?', 'Frankrike', 'Storbritannia', 'Spania', 'Italia'] },
  { en: ['What is the highest mountain above sea level?', 'Mount Everest', 'K2', 'Kilimanjaro', 'Mont Blanc'], no: ['Hva er verdens høyeste fjell over havet?', 'Mount Everest', 'K2', 'Kilimanjaro', 'Mont Blanc'] },
  { en: ['Who composed "In the Hall of the Mountain King"?', 'Edvard Grieg', 'Johan Svendsen', 'Ole Bull', 'Jean Sibelius'], no: ['Hvem komponerte «I Dovregubbens hall»?', 'Edvard Grieg', 'Johan Svendsen', 'Ole Bull', 'Jean Sibelius'] },
  { en: ['Which is the largest country by area?', 'Russia', 'Canada', 'China', 'USA'], no: ['Hvilket land er størst i areal?', 'Russland', 'Canada', 'Kina', 'USA'] },
  { en: ['How many teeth does an adult have, wisdom teeth included?', '32', '28', '30', '36'], no: ['Hvor mange tenner har en voksen, med visdomstenner?', '32', '28', '30', '36'] },
  { en: ['Which metal is liquid at room temperature?', 'Mercury', 'Lead', 'Tin', 'Aluminium'], no: ['Hvilket metall er flytende ved romtemperatur?', 'Kvikksølv', 'Bly', 'Tinn', 'Aluminium'] },
  { en: ['Which planet is often called the "Morning Star"?', 'Venus', 'Mars', 'Jupiter', 'Mercury'], no: ['Hvilken planet kalles ofte «morgenstjernen»?', 'Venus', 'Mars', 'Jupiter', 'Merkur'] },
];

// Every question goes through t(): one key per question, fields joined with '|'.
const bank = { en: {}, no: {} };
for (const [set, list] of [['k', KID], ['g', ADULT]]) {
  list.forEach((q, i) => {
    bank.en[`quiz.${set}${i}`] = q.en.join('|');
    bank.no[`quiz.${set}${i}`] = q.no.join('|');
  });
}
addStrings({
  en: {
    ...bank.en,
    'quiz.title': 'Quiz Run',
    'quiz.hint': 'First walk to the quiz you want and press [A]. Then run to the zone with the right answer before time runs out! Picture puzzles are read aloud: press [B] to hear one again.',
    'quiz.kid': "Kids' question", 'quiz.grown': 'Grown-up question', 'quiz.pic': 'Picture puzzle', 'quiz.q': 'Question {n} of {total}',
    'quiz.again': '[B] hear it again', 'quiz.answer': 'Answer: {a}', 'quiz.n': '{n} correct',
    'quiz.vote': 'Which quiz? Walk to one!',
    'quiz.voteSay': 'Which quiz do you want? Pictures, mixed, classic or grown-up?',
    'quiz.mode.pics': 'Pictures', 'quiz.mode.picsSub': 'no reading needed',
    'quiz.mode.mixed': 'Mixed', 'quiz.mode.mixedSub': 'pictures + questions',
    'quiz.mode.classic': 'Classic', 'quiz.mode.classicSub': 'kids + grown-ups',
    'quiz.mode.grown': 'Grown-up', 'quiz.mode.grownSub': 'hard questions',
    'quiz.picked': "Let's play: {x}!",
  },
  no: {
    ...bank.no,
    'quiz.title': 'Quizløpet',
    'quiz.hint': 'Gå først til quizen du vil ha og trykk [A]. Løp så til feltet med riktig svar før tiden er ute! Bildeoppgaver blir lest opp: trykk [B] for å høre igjen.',
    'quiz.kid': 'Barnespørsmål', 'quiz.grown': 'Voksenspørsmål', 'quiz.pic': 'Bildeoppgave', 'quiz.q': 'Spørsmål {n} av {total}',
    'quiz.again': '[B] hør igjen', 'quiz.answer': 'Svar: {a}', 'quiz.n': '{n} riktige',
    'quiz.vote': 'Hvilken quiz? Gå til en!',
    'quiz.voteSay': 'Hvilken quiz vil dere ha? Bilder, blandet, klassisk eller voksen?',
    'quiz.mode.pics': 'Bilder', 'quiz.mode.picsSub': 'ingen lesing',
    'quiz.mode.mixed': 'Blandet', 'quiz.mode.mixedSub': 'bilder + spørsmål',
    'quiz.mode.classic': 'Klassisk', 'quiz.mode.classicSub': 'barn + voksne',
    'quiz.mode.grown': 'Voksen', 'quiz.mode.grownSub': 'vanskelige spørsmål',
    'quiz.picked': 'Vi spiller: {x}!',
  },
});

// Quiz Run: four answer zones on the floor; stand in the right one when time runs out.
// The round opens with a vote (stand in a zone): picture puzzles for small children, mixed, classic or grown-up.
const MODES = ['pics', 'mixed', 'classic', 'grown'];
const VOTE_TIME = 9;
const CHOSEN = 1.6;
const KID_TIME = 6;
const GROWN_TIME = 7;
const PIC_TIME = 8;
const REVEAL = 1.6;
const ZW = 6.2;
const ZD = 4.2;
const GAP = 1.2;
const SPEED = 5.8;
const PR = 0.42;
const HALF_X = ZW + GAP / 2;
const HALF_Z = ZD + GAP / 2;
const ZONES = [
  { letter: 'A', color: 0xff6b8b, sx: -1, sz: -1 },
  { letter: 'B', color: 0x5aa9ff, sx: 1, sz: -1 },
  { letter: 'C', color: 0xffc23d, sx: -1, sz: 1 },
  { letter: 'D', color: 0x45d18a, sx: 1, sz: 1 },
];
// Picture cards lean back toward the camera so the models read like pictures.
const TILT = -0.6;
const CARD_W = 3.3;
const CARD_H = 2.4;
const CARD_SCALE = 1.6;
const BOARD_SCALE = 1.15;
const BOARD_Z = -HALF_Z - 1.1;

function dim(hex) {
  return new THREE.Color(hex).lerp(new THREE.Color(0xb9b4c8), 0.65).getHex();
}

/** Zone order for a text question: order[zone] = answer index, with the right answer (0) in zone `right`. */
function orderFor(right) {
  const rest = shuffle([1, 2, 3]);
  return [0, 1, 2, 3].map((z) => (z === right ? 0 : rest.pop()));
}

const easeBack = (x) => { const c = 1.7; return 1 + (c + 1) * (x - 1) ** 3 + c * (x - 1) ** 2; };

export class QuizRound extends Round {
  static key = 'quiz';

  constructor(party) {
    super(party);
    this.build();
    this.pics = new THREE.Group();
    this.group.add(this.pics);
    this.questions = [];
    this.mode = null;
    this.qi = -1;
    this.phase = 'idle';
    this.phaseT = 0;
    this.sayT = -9;
    this.said = 0;
    this.card = this.label('');
    this.card.style.cssText = 'position:absolute;left:50%;top:clamp(56px,9vh,84px);transform:translateX(-50%);width:min(980px,90vw);text-align:center;'
      + 'background:rgba(255,255,255,0.95);border-radius:22px;padding:8px 22px 12px;box-shadow:0 5px 0 rgba(43,35,64,0.18);font-weight:700;'
      + 'font-size:clamp(17px,2.2vw,34px);line-height:1.15;color:#2b2340;display:none;';
    this.ents = this.players.map((p, i) => {
      const ch = this.bean(p);
      const n = this.players.length;
      const a = (i / n) * Math.PI * 2 + 0.4;
      const r = n === 1 ? 0 : 0.9;
      return { p, ch, x: Math.sin(a) * r, z: Math.cos(a) * r, vx: 0, vz: 0, locked: false, correct: 0, tag: this.label('label'), plus: 0 };
    });
  }

  get title() { return t('quiz.title'); }
  get hint() { return t('quiz.hint'); }

  build() {
    const g = this.group;
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(120, 80), toon(COLORS.grass));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.02;
    ground.receiveShadow = true;
    g.add(ground);
    const stage = new THREE.Mesh(new RoundedBoxGeometry(HALF_X * 2 + 1.2, 0.3, HALF_Z * 2 + 1.2, 3, 0.14), toon(COLORS.cream));
    stage.position.y = -0.13;
    stage.receiveShadow = true;
    g.add(stage);
    this.zones = ZONES.map((z) => {
      const mesh = new THREE.Mesh(sharedGeo('quizZone', () => new RoundedBoxGeometry(ZW, 0.2, ZD, 3, 0.1)), toon(z.color));
      const x = z.sx * (ZW / 2 + GAP / 2), zz = z.sz * (ZD / 2 + GAP / 2);
      mesh.position.set(x, 0.1, zz);
      mesh.receiveShadow = true;
      g.add(mesh);
      const decal = new THREE.Mesh(sharedGeo('quizLetter', () => new THREE.PlaneGeometry(1.7, 1.7)), glyphMaterial(z.letter));
      decal.rotation.x = -Math.PI / 2;
      decal.position.set(x + z.sx * (ZW / 2 - 1.05), 0.22, zz + z.sz * (ZD / 2 - 1.0));
      g.add(decal);
      const label = this.label('label');
      label.style.fontSize = 'clamp(16px, 2.1vw, 34px)';
      return { ...z, x, z: zz, mesh, decal, label };
    });
    const rand = seeded(88);
    for (let i = 0; i < 16; i++) {
      const tr = makeTree(rand, 1.4 + rand() * 0.6);
      const side = i % 2 ? 1 : -1;
      tr.position.set(side * (HALF_X + 3 + rand() * 6), 0, -HALF_Z - 2 + rand() * (HALF_Z * 2 + 2));
      g.add(tr);
    }
    for (let i = 0; i < 40; i++) {
      const f = makeFlower(rand);
      const side = rand() < 0.5 ? -1 : 1;
      f.position.set(side * (HALF_X + 1.2 + rand() * 3), 0, -HALF_Z + rand() * HALF_Z * 2.4);
      g.add(f);
    }
    for (let i = 0; i < 4; i++) {
      const c = makeCloud(rand, 2);
      c.position.set(-18 + i * 12, 10 + rand() * 3, -22);
      g.add(c);
    }
  }

  frame() {
    // Leave room at the top for the question card / picture board.
    const d = this.party.fitDistance(HALF_X * 2 + 2, HALF_Z * 2 + 5.5);
    this.camera.position.set(0, d * 0.86, d * 0.52);
    this.camera.lookAt(0, 0, -1.1);
  }

  get q() { return this.questions[this.qi]; }

  /** Question text, answers in zone order (null for pictures) and the right zone, in the current language. */
  parts() {
    const q = this.q;
    if (q.kind === 'pic') return { text: t(q.puzzle.key), answers: null, right: q.right };
    const f = t(q.key).split('|');
    return { text: f[0], answers: q.order.map((k) => f[1 + k]), right: q.right };
  }

  /** Reads text aloud (if the device can) and remembers it for tests. */
  say(text) {
    this.sayT = this.time;
    this.said++;
    this.lastSaid = text;
    sayAloud(text);
  }

  // ---------- mode vote ----------

  start() {
    this.phase = 'vote';
    this.phaseT = VOTE_TIME;
    this.askT = 0;
    this.clearPictures();
    this.zones.forEach((z, i) => this.showCard(i, modeIcon(MODES[i])));
    this.say(t('quiz.voteSay'));
    this.game.audio.play('select');
  }

  endVote() {
    const counts = [0, 0, 0, 0];
    for (const e of this.ents) {
      const i = this.zoneAt(e.x, e.z);
      if (i >= 0) counts[i]++;
    }
    const best = Math.max(...counts);
    // Nobody voted: mixed. Tie: random among the tied modes.
    const top = best === 0 ? [1] : [0, 1, 2, 3].filter((i) => counts[i] === best);
    const win = top[Math.floor(Math.random() * top.length)];
    this.mode = MODES[win];
    this.phase = 'chosen';
    this.phaseT = CHOSEN;
    this.zones.forEach((z, i) => { z.mesh.material = i === win ? toon(z.color, { emissive: 0x555555 }) : toon(dim(z.color)); });
    for (const h of this.pics.children) h.userData.state = h.userData.zone === win ? 'right' : 'wrong';
    for (const e of this.ents) e.locked = true;
    const name = t(`quiz.mode.${this.mode}`);
    this.game.ui.toast(t('quiz.picked', { x: name }), 1800);
    this.say(t('quiz.picked', { x: name }));
    this.game.audio.play('star');
    this.buildQuestions(this.mode);
  }

  /** Lays out the question list for a mode. The right zone is random but never the same three times running. */
  buildQuestions(mode) {
    const kinds = {
      pics: ['pic', 'pic', 'pic', 'pic', 'pic', 'pic', 'pic'],
      mixed: ['pic', 'kid', 'pic', 'grown', 'pic', 'kid', 'pic', 'grown'],
      classic: ['kid', 'grown', 'kid', 'grown', 'kid', 'grown', 'kid', 'grown'],
      grown: ['grown', 'grown', 'grown', 'grown', 'grown', 'grown', 'grown', 'grown'],
    }[mode];
    const kids = shuffle(KID.map((_, i) => `quiz.k${i}`));
    const grown = shuffle(ADULT.map((_, i) => `quiz.g${i}`));
    const pics = pickPuzzles(kinds.filter((k) => k === 'pic').length);
    const rights = [];
    this.questions = kinds.map((kind) => {
      let right;
      do right = Math.floor(Math.random() * 4);
      while (rights.length >= 2 && rights.at(-1) === right && rights.at(-2) === right);
      rights.push(right);
      if (kind === 'pic') return { kind, puzzle: pics.pop(), right };
      return { kind, key: kind === 'kid' ? kids.pop() : grown.pop(), right, order: orderFor(right) };
    });
  }

  // ---------- pictures ----------

  clearPictures() {
    // Everything in a picture is shared geometry/material, so removing is enough.
    for (const h of [...this.pics.children]) this.pics.remove(h);
  }

  /** A tilted white card with a picture on it, popping up from the floor. */
  card3d(obj, x, z, w, h) {
    const holder = new THREE.Group();
    holder.position.set(x, 0.2, z);
    holder.rotation.x = TILT;
    const card = new THREE.Mesh(sharedGeo(`quizCard${w}x${h}`, () => new RoundedBoxGeometry(w, h, 0.16, 3, 0.07)), toon(COLORS.white));
    card.position.set(0, h / 2, -0.1);
    card.castShadow = true;
    card.receiveShadow = true;
    holder.add(card, obj);
    holder.scale.setScalar(0.01);
    holder.userData = { pop: 0, state: 'show' };
    this.pics.add(holder);
    return holder;
  }

  showCard(zone, obj) {
    const zn = this.zones[zone];
    obj.scale.multiplyScalar(CARD_SCALE);
    obj.position.y += 0.22;
    obj.position.z += 0.1;
    const h = this.card3d(obj, zn.x, zn.z - 0.3, CARD_W, CARD_H);
    h.userData.zone = zone;
    return h;
  }

  showBoard(items) {
    const step = 1.25 * BOARD_SCALE;
    const w = Math.round(items.length * step + 0.8);
    const holder = new THREE.Group();
    items.forEach((obj, i) => {
      obj.scale.multiplyScalar(BOARD_SCALE);
      obj.position.x += (i - (items.length - 1) / 2) * step;
      obj.position.y += 0.15;
      obj.position.z += 0.1;
      holder.add(obj);
    });
    const b = this.card3d(holder, 0, BOARD_Z, w, 2.1);
    b.userData.zone = -1;
  }

  showPictures() {
    const q = this.q;
    const { prompt, answers } = buildPuzzle(q.puzzle);
    const wrong = shuffle(answers.slice(1));
    for (let i = 0; i < 4; i++) this.showCard(i, i === q.right ? answers[0] : wrong.pop());
    if (prompt) this.showBoard(prompt);
  }

  // ---------- questions ----------

  nextQuestion() {
    this.qi++;
    this.clearPictures();
    if (this.qi >= this.questions.length) {
      this.phase = 'over';
      this.done = true;
      stopSpeaking();
      return;
    }
    this.phase = 'ask';
    this.phaseT = { pic: PIC_TIME, kid: KID_TIME, grown: GROWN_TIME }[this.q.kind];
    this.askT = 0;
    for (const z of this.zones) { z.mesh.material = toon(z.color); z.mesh.scale.y = 1; }
    for (const e of this.ents) e.locked = false;
    if (this.q.kind === 'pic') {
      this.showPictures();
      this.say(this.parts().text);
    } else stopSpeaking();
    this.game.audio.play('select');
  }

  zoneAt(x, z) {
    for (let i = 0; i < 4; i++) {
      const zn = this.zones[i];
      if (Math.abs(x - zn.x) < ZW / 2 && Math.abs(z - zn.z) < ZD / 2) return i;
    }
    return -1;
  }

  reveal() {
    this.phase = 'reveal';
    this.phaseT = REVEAL;
    const { right } = this.parts();
    this.zones.forEach((z, i) => {
      z.mesh.material = i === right ? toon(z.color, { emissive: 0x555555 }) : toon(dim(z.color));
    });
    for (const h of this.pics.children) if (h.userData.zone >= 0) h.userData.state = h.userData.zone === right ? 'right' : 'wrong';
    let any = false;
    for (const e of this.ents) {
      e.locked = true;
      if (this.zoneAt(e.x, e.z) === right) {
        e.correct++;
        e.plus = 1.4;
        e.ch.squash(1.4);
        any = true;
        this.party.confetti.burst(new THREE.Vector3(e.x, 1.6, e.z), 0, { count: 18, speed: 5, colors: [e.p.color, COLORS.gold] });
      }
    }
    this.game.audio.play(any ? 'star' : 'bump');
  }

  update(dt, playing) {
    this.time += dt;
    if (playing && this.phase !== 'over' && this.phase !== 'idle') {
      this.phaseT -= dt;
      if (this.phase === 'ask' || this.phase === 'vote') {
        this.askT += dt;
        // Everyone locked in: skip ahead.
        if (this.askT > 0.6 && this.ents.every((e) => e.locked)) this.phaseT = Math.min(this.phaseT, 0.3);
        if (this.phaseT <= 0) { if (this.phase === 'vote') this.endVote(); else this.reveal(); }
      } else if ((this.phase === 'reveal' || this.phase === 'chosen') && this.phaseT <= 0) this.nextQuestion();
    }

    const asking = playing && (this.phase === 'ask' || this.phase === 'vote');
    const voting = this.phase === 'vote' || this.phase === 'chosen';
    const show = this.qi >= 0 && this.phase !== 'over' && !voting;
    const parts = show ? this.parts() : null;
    const pic = show && this.q.kind === 'pic';

    // [B]: hear the question again.
    if (asking && this.time - this.sayT > 0.8 && this.ents.some((e) => this.input(e.p).bPressed)) {
      this.say(voting ? t('quiz.voteSay') : parts.text);
    }

    this.updateCard(show, parts, pic, voting);
    this.zones.forEach((z, i) => {
      if (voting) {
        const key = `quiz.mode.${MODES[i]}`;
        const dimmed = this.phase === 'chosen' && MODES[i] !== this.mode;
        z.label.style.display = '';
        this.setLabel(z.label, `${esc(t(key))}<small>${esc(t(`${key}Sub`))}</small>`, new THREE.Vector3(z.x, 0.3, z.z + 1.25), dimmed ? '#9a94b2' : '#2b2340');
        return;
      }
      z.label.style.display = show && !pic ? '' : 'none';
      if (!show) return;
      const right = this.phase === 'reveal' && i === parts.right;
      if (right) z.mesh.scale.y = 1 + Math.abs(Math.sin(this.time * 8)) * 0.8;
      if (pic) return;
      const text = `<span style="font-size:0.8em;opacity:0.75">${z.letter}</span> ${esc(parts.answers[i])}${right ? ' ✓' : ''}`;
      this.setLabel(z.label, text, new THREE.Vector3(z.x, 0.3, z.z + 0.5), this.phase === 'reveal' && !right ? '#9a94b2' : '#2b2340');
    });
    if (this.phase === 'chosen') {
      const z = this.zones[MODES.indexOf(this.mode)];
      z.mesh.scale.y = 1 + Math.abs(Math.sin(this.time * 8)) * 0.8;
    }
    this.animatePictures(dt);

    for (const e of this.ents) {
      const d = asking ? this.input(e.p) : { x: 0, y: 0 };
      if (asking && d.aPressed) {
        if (e.locked) { e.locked = false; this.game.audio.play('select'); }
        else if (this.zoneAt(e.x, e.z) >= 0) { e.locked = true; e.ch.squash(1.25); this.game.audio.play('join'); }
      }
      const free = asking && !e.locked;
      const ix = free && Math.abs(d.x) > 0.15 ? d.x : 0, iz = free && Math.abs(d.y) > 0.15 ? -d.y : 0;
      e.vx += (ix * SPEED - e.vx) * Math.min(1, dt * 12);
      e.vz += (iz * SPEED - e.vz) * Math.min(1, dt * 12);
      e.x = THREE.MathUtils.clamp(e.x + e.vx * dt, -HALF_X + 0.3, HALF_X - 0.3);
      e.z = THREE.MathUtils.clamp(e.z + e.vz * dt, -HALF_Z + 0.3, HALF_Z - 0.3);
      const sp = Math.hypot(e.vx, e.vz) / SPEED;
      if (sp > 0.05) e.ch.face(e.vx, e.vz);
      else if (!asking) e.ch.face(0, 1);
      e.plus = Math.max(0, e.plus - dt);
      const hop = e.plus > 0 ? Math.abs(Math.sin(this.time * 10)) * 0.4 : 0;
      e.ch.group.position.set(e.x, 0.2 + hop, e.z);
      e.ch.update(dt, { moving: sp });
      const tag = e.plus > 0 ? '+1' : asking && e.locked ? '✓' : '';
      e.tag.style.display = tag ? '' : 'none';
      if (tag) this.setLabel(e.tag, tag, new THREE.Vector3(e.x, 2.1 + hop, e.z), e.p.css);
    }
    // Bump apart.
    for (let i = 0; i < this.ents.length; i++) {
      for (let j = i + 1; j < this.ents.length; j++) {
        const a = this.ents[i], b = this.ents[j];
        const dx = b.x - a.x, dz = b.z - a.z, dd = Math.hypot(dx, dz);
        if (dd < PR * 2 && dd > 1e-4) {
          const push = (PR * 2 - dd) / 2;
          if (!a.locked) { a.x -= (dx / dd) * push; a.z -= (dz / dd) * push; }
          if (!b.locked) { b.x += (dx / dd) * push; b.z += (dz / dd) * push; }
        }
      }
    }
  }

  /** The HTML question card: big text for text questions, a slim strip for picture puzzles. */
  updateCard(show, parts, pic, voting) {
    let html = '';
    if (voting) {
      html = `<div>${esc(t('quiz.vote'))}</div>`;
    } else if (show) {
      const kind = this.q.kind;
      const color = { kid: '#ff4f9a', grown: '#6b4fd8', pic: '#14a865' }[kind];
      const badge = `<span style="color:${color}">${t(`quiz.${kind}`)}</span> · ${t('quiz.q', { n: this.qi + 1, total: this.questions.length })}`;
      if (pic) {
        const done = this.phase === 'reveal' ? ' <span style="color:#14a865">✓</span>' : '';
        html = `<div style="font-size:0.5em;letter-spacing:0.04em;text-transform:uppercase;opacity:0.9">${badge} · ${esc(t('quiz.again'))}</div>`
          + `<div style="font-size:0.72em">🔊 ${esc(parts.text)}${done}</div>`;
      } else {
        const ans = this.phase === 'reveal' ? `<div style="color:#14a865;margin-top:2px">✓ ${esc(t('quiz.answer', { a: parts.answers[parts.right] }))}</div>` : '';
        html = `<div style="font-size:0.55em;letter-spacing:0.04em;text-transform:uppercase;opacity:0.9">${badge}</div><div>${esc(parts.text)}</div>${ans}`;
      }
    }
    this.card.style.display = html ? '' : 'none';
    this.card.style.padding = pic ? '4px 18px 6px' : '8px 22px 12px';
    if (html && this.card.dataset.html !== html) { this.card.innerHTML = html; this.card.dataset.html = html; }
  }

  /** Cards pop up, the right one bounces at the reveal, the others shrink back. */
  animatePictures(dt) {
    for (const h of this.pics.children) {
      const u = h.userData;
      u.pop += dt;
      let s = easeBack(Math.min(1, u.pop / 0.35));
      if (u.state === 'right') s *= 1 + Math.abs(Math.sin(this.time * 7)) * 0.12;
      if (u.state === 'wrong') { u.fade = Math.min(1, (u.fade || 0) + dt * 4); s *= 1 - u.fade * 0.3; }
      h.scale.setScalar(Math.max(0.01, s));
    }
  }

  hud() {
    const tt = this.phase === 'ask' || this.phase === 'vote' ? this.phaseT : this.phase === 'idle' ? VOTE_TIME : 0;
    return clock(tt);
  }

  score(p) {
    return this.ents.find((x) => x.p === p).correct;
  }

  detail(p) {
    return t('quiz.n', { n: this.score(p) });
  }

  dispose() {
    stopSpeaking();
    super.dispose();
  }
}

// Exposed for checks: how many questions of each kind the bank holds.
export const QUIZ_BANK_SIZE = { kid: KID.length, grown: ADULT.length, pictures: PICTURE_PUZZLES.length };
