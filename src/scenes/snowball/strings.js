import { addStrings } from '../../core/i18n.js';

// All Snowball Fort text (English + bokmål). Button names are written [A]/[B]/[C]; t() swaps in
// what the current players press.
addStrings({
  en: {
    'game.snowball': 'Snowball Fort',
    'snowball.intro': 'Tap [B]: throw · hold [B]: scoop snow · [A]: snow wall · [C]: use a gift',
    'snowball.controls': 'Tap [B]: throw · hold [B]: scoop snow · [A]: snow wall (3 snow) · [C]: use a gift',
    'snowball.bot': 'Snow Bot',
    'snowball.hits': '{n} hits', 'snowball.hit1': '1 hit',
    'snowball.walls': '{n} walls', 'snowball.wall1': '1 wall',
    'snowball.throws': '{n} throws', 'snowball.throw1': '1 throw',
    'snowball.splats': '{n} splats', 'snowball.splat1': '1 splat',
    'snowball.caps': '{n} flags home', 'snowball.cap1': '1 flag home',
    'snowball.hillSecs': '{n} s on the hill',
    'snowball.saves': '{n} flag saves', 'snowball.save1': '1 flag save',
    'snowball.need': 'Hold [B] for snow!',
    'snowball.splat': 'Splat!',
    'snowball.noRoom': 'No room to throw in here!',
    'snowball.notHere': 'Not here!',
    'snowball.carrying': 'Not while carrying the flag!',

    // votes
    'snowball.voteMode': 'What do we play?',
    'snowball.voteMap': 'Which map?',
    'snowball.mode.targets': 'Snow Targets',
    'snowball.mode.koth': 'King of the Hill',
    'snowball.mode.ctf': 'Capture the Flag',
    'snowball.map.meadow': 'Fort Meadow',
    'snowball.map.creek': 'Frosty Creek',
    'snowball.map.peaks': 'Glacier Peaks',

    // intro card: one clear line per mode
    'snowball.goal.targets': "Hit the other team's targets! Gold ones give 3.",
    'snowball.goal.koth': 'Stand inside the ring to score. Snowballs push you out!',
    'snowball.goal.ctf': 'Carry their flag to yours. A snowball makes the carrier drop it!',

    // gifts (power-ups)
    'snowball.pw.giant': 'Giant snowball', 'snowball.pw.triple': 'Triple throw', 'snowball.pw.boots': 'Speed boots',
    'snowball.pw.fort': 'Instant fort', 'snowball.pw.freeze': 'Freeze bomb',
    'snowball.pwGot': '{x}! Press [C]',

    // capture the flag
    'snowball.grab': 'Run home!',
    'snowball.dropped': 'Dropped it!',
    'snowball.returned': 'Flag back home!',
    'snowball.captured': '{team} brings a flag home!',
    'snowball.firstTo': 'first to {n}',

    // king of the hill
    'snowball.hill': 'Hill',
    'snowball.hillFree': 'free',
    'snowball.hillContest': 'contested!',
    'snowball.hillMoves': 'The hill moves!',
    'snowball.gold': 'Gold target!',

    // tips that show up during the match
    'snowball.tip.dodge': 'Tip: snowballs fly in an arc. Keep moving and they miss!',
    'snowball.tip.wall': 'Tip: snow walls block snowballs. Build one with [A]!',
    'snowball.tip.gift': 'Tip: grab the gift in the middle, then press [C]!',
    'snowball.tip.high': 'Tip: from high ground your snowballs fly further.',
    'snowball.tip.tunnel': 'Tip: in the ice tunnel nobody can hit you, but you cannot throw.',
    'snowball.tip.ramps': 'Tip: the peak is high ground. Climb up the ramps at the front and back!',
    'snowball.tip.ice': 'Tip: ice is slippery. Speed boots keep you steady!',
    'snowball.tip.ctf': 'Tip: some go for their flag, some guard yours!',
    'snowball.tip.koth': 'Tip: a wall in the ring keeps the other team away.',
  },
  no: {
    'game.snowball': 'Snøballfestningen',
    'snowball.intro': 'Trykk [B]: kast · hold [B]: samle snø · [A]: snømur · [C]: bruk en gave',
    'snowball.controls': 'Trykk [B]: kast · hold [B]: samle snø · [A]: snømur (3 snø) · [C]: bruk en gave',
    'snowball.bot': 'Snøbot',
    'snowball.hits': '{n} treff', 'snowball.hit1': '1 treff',
    'snowball.walls': '{n} murer', 'snowball.wall1': '1 mur',
    'snowball.throws': '{n} kast', 'snowball.throw1': '1 kast',
    'snowball.splats': '{n} snøtreff', 'snowball.splat1': '1 snøtreff',
    'snowball.caps': '{n} flagg hjem', 'snowball.cap1': '1 flagg hjem',
    'snowball.hillSecs': '{n} s på haugen',
    'snowball.saves': '{n} flagg reddet', 'snowball.save1': '1 flagg reddet',
    'snowball.need': 'Hold [B] for snø!',
    'snowball.splat': 'Splæsj!',
    'snowball.noRoom': 'Ikke plass til å kaste her inne!',
    'snowball.notHere': 'Ikke her!',
    'snowball.carrying': 'Ikke mens du bærer flagget!',

    'snowball.voteMode': 'Hva skal vi spille?',
    'snowball.voteMap': 'Hvilket kart?',
    'snowball.mode.targets': 'Snøblinker',
    'snowball.mode.koth': 'Kongen på haugen',
    'snowball.mode.ctf': 'Fang flagget',
    'snowball.map.meadow': 'Festningsengen',
    'snowball.map.creek': 'Frostbekken',
    'snowball.map.peaks': 'Isbretoppene',

    'snowball.goal.targets': 'Treff det andre lagets blinker! Gull gir 3.',
    'snowball.goal.koth': 'Stå inni ringen for å få poeng. Snøballer dytter deg ut!',
    'snowball.goal.ctf': 'Bær flagget deres hjem til ditt. En snøball får bæreren til å miste det!',

    'snowball.pw.giant': 'Kjempesnøball', 'snowball.pw.triple': 'Trippelkast', 'snowball.pw.boots': 'Fartsstøvler',
    'snowball.pw.fort': 'Lynfestning', 'snowball.pw.freeze': 'Frysebombe',
    'snowball.pwGot': '{x}! Trykk [C]',

    'snowball.grab': 'Løp hjem!',
    'snowball.dropped': 'Mistet det!',
    'snowball.returned': 'Flagget er hjemme!',
    'snowball.captured': '{team} får et flagg hjem!',
    'snowball.firstTo': 'først til {n}',

    'snowball.hill': 'Haugen',
    'snowball.hillFree': 'ledig',
    'snowball.hillContest': 'kamp!',
    'snowball.hillMoves': 'Haugen flytter seg!',
    'snowball.gold': 'Gullblink!',

    'snowball.tip.dodge': 'Tips: snøballer flyr i en bue. Fortsett å gå, så bommer de!',
    'snowball.tip.wall': 'Tips: snømurer stopper snøballer. Bygg en med [A]!',
    'snowball.tip.gift': 'Tips: ta gaven i midten, og trykk [C]!',
    'snowball.tip.high': 'Tips: høyt oppe flyr snøballene dine lenger.',
    'snowball.tip.tunnel': 'Tips: i istunnelen kan ingen treffe deg, men du kan ikke kaste.',
    'snowball.tip.ramps': 'Tips: toppen er høyt oppe. Gå opp bakkene foran og bak!',
    'snowball.tip.ice': 'Tips: isen er glatt. Fartsstøvler holder deg stødig!',
    'snowball.tip.ctf': 'Tips: noen henter flagget deres, noen vokter ditt!',
    'snowball.tip.koth': 'Tips: en mur i ringen holder det andre laget unna.',
  },
});
