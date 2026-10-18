// English / Norwegian (bokmål) text. t('key', { vars }) returns the current language.
// The learning games are Norwegian in both modes.

const en = {
  'go': 'GO!',
  'sound.on': 'Sound on',
  'sound.off': 'Sound off',
  'lang.name': 'English',
  'lang.switched': 'Language: English',
  'footer.stars': '+{n} stars for the island',
  'footer.continue': 'press jump to continue',
  'win': '{name} wins!',
  'tie': "It's a tie!",
  'badge.edu': 'LEARNING',

  'color.0': 'Coral', 'color.1': 'Sunny', 'color.2': 'Mint', 'color.3': 'Sky', 'color.4': 'Grape', 'color.5': 'Tangerine',
  'hat.0': 'No hat', 'hat.1': 'Party hat', 'hat.2': 'Flower', 'hat.3': 'Bunny ears', 'hat.4': 'Propeller', 'hat.5': 'Top hat', 'hat.6': 'Crown',
  'device.kb0': 'WASD', 'device.kb1': 'Arrows', 'device.kb2': 'IJKL', 'device.kb3': 'Numpad', 'device.gp': 'Pad {n}',
  'hint.kb0': 'WASD move · Space jump · E use · Q extra', 'hint.kb1': 'Arrows move · Enter jump · R-Shift use · R-Ctrl extra', 'hint.kb2': 'IJKL move · U jump · O use · P extra', 'hint.kb3': 'Num 8456 move · Num 0 jump · Num . use · Num Enter extra',
  'key.space': 'Space', 'key.rshift': 'R-Shift', 'key.rctrl': 'R-Ctrl', 'key.numdec': 'Num .',
  'gamepad': 'Gamepad',
  'akey.kb0': 'Space', 'akey.kb1': 'Enter', 'akey.kb2': 'U', 'akey.kb3': 'Num 0',

  'game.bubble': 'Bubble Buddies', 'game.platformer': 'Sky Hop', 'game.paint': 'Paint Party',
  'game.archers': 'Balloon Archers', 'game.brawl': 'Bonk Brawl', 'game.kart': 'Kart Party',
  'game.portal': 'Portal Pals', 'game.football': 'Mega Ball', 'game.slalom': 'Snow Slalom', 'game.hockey': 'Ice Hockey', 'game.party': 'Party Mix', 'game.space': 'Space Race', 'game.runner': 'Rooftop Rush',
  'game.spelling': 'Bokstavballonger', 'game.math': 'Mattejakt',

  'hub.title': 'Couch Party Island',
  'hub.join': 'Press your jump button to join (up to 6 players)',
  'hub.keys': 'M: sound on/off · N: norsk · Esc: help',
  'hub.hint': 'Stand on a pad together to play · join anytime',
  'hub.nextHat': 'next hat at {n}',
  'hub.padJoin': 'Join to play!',
  'hub.padReady': '{on}/{need} ready',
  'hub.padNeed': '{need} needed',
  'hub.joined': '{name} joined!',
  'hub.newHat': 'New hat: {hat}! Find it on the hat stand',
  'hub.hatStand': 'Hats', 'hub.hatHint': 'stand by it, press [B]',
  'hub.basket': 'Basket! {n} in total', 'hub.baskets': 'Baskets: {n}',
  'hub.strike': 'STRIKE!', 'hub.pins': '{n} pins!',
  'hub.eduOn': 'Learning games: ON',
  'hub.eduOff': 'Learning games: OFF',
  'hub.on': 'ON', 'hub.off': 'OFF',
  'hub.jumpButton': 'jump on the button',
  'hub.langSign': 'English',
  'hub.jumpFlag': 'jump on the flag',
  'hub.taken': 'taken',
  'hub.newColor': '{name} is a new color!',
  'hub.swapTitle': 'Swap colors',
  'hub.swapHint': 'stand on both pads',
  'hub.swapReady': 'both tap [B]!',
  'hub.swapped': '{a} and {b} swapped colors!',
  'help.title': 'How to play',
  'help.1': 'Press your jump button to join. Up to 6 players: 4 gamepads + keyboards.',
  'help.2': 'Walk onto a game pad. When half the group stands on it, the game starts.',
  'help.3': 'Collect stars on the island to unlock hats. Stand by the hat stand and press [B] to try them on. Hold [B] to leave.',
  'help.7': 'Toys: tap [B] next to a ball to pick it up, hold [B] and let go to throw. Shoot hoops, knock down pins, bounce on the trampoline and the mushroom, or ride the swings.',
  'help.4': 'Walk into a paint pot to change color. To trade colors, stand on the two swap pads and both tap [B].',
  'help.5': 'Jump on the book button (or press G) to show or hide the learning games. Jump on the flag (or press N) to change language.',
  'help.6': 'In a game, Esc (or Start on a gamepad) opens the menu: resume, retry or end the game. M toggles sound.',
  'pause.title': 'Paused', 'pause.resume': 'Resume', 'pause.retry': 'Retry', 'pause.end': 'End game',
  'pause.hint': 'Stick up/down · [B] or [A] to choose · Esc or Start to resume',

  'bubble.intro': '[B]: blow bubbles · pop trapped grumbles for fruit',
  'bubble.wave': 'Wave {n}', 'bubble.last': 'Last one!', 'bubble.chain': 'Chain pop!',
  'bubble.allClear': 'All clear!', 'bubble.grab': 'Grab the fruit!', 'bubble.cleared': 'Wave cleared!',
  'bubble.sleepy': 'The grumbles got sleepy...', 'bubble.hudWave': 'Wave {n}/{m}', 'team': 'Team',
  'bubble.title': 'Hooray, all waves cleared!', 'bubble.sub': 'Team score: {n}', 'bubble.detail': '{f} fruit · {r} rescues',

  'sky.intro': 'Reach the flag together · fall and you float back in a bubble',
  'sky.pick': 'Pick a level · stick left/right · jump to start', 'sky.locked': 'Locked',
  'sky.unlock': 'Finish a level to unlock the next one',
  'sky.madeIt': '{name} made it!', 'sky.everyone': 'Everyone to the flag!',
  'sky.allMade': 'Everybody made it!', 'sky.youMade': 'You made it!',
  'sky.sub': '{level} · team gems: {a} / {b}', 'sky.gems': '{n} gems', 'sky.first': 'First to the flag!',
  'sky.stomps': '{n} stomps', 'sky.next': '[A]: next level · [B]: back to the island',
  'sky.hudGems': 'Gems', 'sky.flagCloses': 'Flag closes in',
  'level.0': 'Sunny Meadow', 'level.1': 'Candy Clouds', 'level.2': 'Autumn Woods', 'level.3': 'Sunset Castle',

  'paint.intro': 'Walk to paint · [A]: dash · [B]: throw a paint bomb',
  'paint.mega': '{name} got the Mega Brush!', 'paint.ten': '10 seconds left!',
  'paint.solo': 'What a masterpiece!', 'paint.sub': 'The floor is {n}% painted', 'paint.top': 'Top painter',

  'archers.intro': 'Stick: aim · [B]: shoot · pop balloons, jump on heads, grab your arrows back',
  'archers.soloTitle': '{n} balloons popped!', 'archers.soloSub': 'Target practice complete',
  'archers.sub': 'Most balloons popped', 'archers.pops': '{n} pops', 'archers.popped': 'popped {n} times',

  'brawl.intro': '[B]: punch (hold to charge) · up+[B]: uppercut · down+[B]: spin · knock friends off the stage!',
  'brawl.bot': 'Bonk Bot', 'brawl.ghostToast': '{name} is a bubble ghost now!',
  'brawl.botWins': 'Bonk Bot wins this time!', 'brawl.sub': 'Last one on the island',
  'brawl.left': '{n} left', 'brawl.ghost': 'Ghost', 'brawl.ghostTag': 'ghost', 'brawl.detail': '{k} bonks · {f} falls',

  'kart.intro': 'Steer with the stick · [A]: hop & drift · [B]: use item · 3 laps',
  'kart.item.boost': 'Zoom', 'kart.item.banana': 'Banana', 'kart.item.bubble': 'Bubble',
  'kart.final': '{name}: final lap!', 'kart.winsRace': '{name} wins the race!',
  'kart.lap': 'Lap {a}/{b}', 'kart.finished': 'Finished {ord}!', 'kart.closes': 'Finish closes in',
  'kart.solo': 'Race complete!', 'kart.sub': '{n} laps around Party Park', 'kart.lapShort': 'lap {n}',
  'ord.0': '1st', 'ord.1': '2nd', 'ord.2': '3rd', 'ord.3': '4th', 'ord.4': '5th', 'ord.5': '6th',

  'portal.intro': 'Get everyone to the exit · [A] and [B] shoot your two portals',
  'portal.cleared': 'Room cleared!', 'portal.reset': 'Room reset',
  'portal.hud': 'Room {i}/{n}: {name}', 'portal.left': '{n} to go · hold [A]+[B] to reset', 'portal.out': 'out!',
  'portal.title': 'All rooms cleared!', 'portal.sub': 'Thinking with portals, together',
  'portal.detail': 'portals · {n} box pushes',
  'room.0.name': 'Hello, portals!', 'room.0.hint': '[A] and [B] shoot your two portals. Put one across the gap and one near you.',
  'room.1.name': 'Hold the door', 'room.1.hint': 'Stand on the button to open the door. The last one out can use portals!',
  'room.2.name': 'Special delivery', 'room.2.hint': 'Push the box into a portal so it lands on the button.',
  'room.3.name': 'Team effort', 'room.3.hint': 'Box on the button, portal over the gap, then help each other out.',

  'ball.intro': '[B]: kick (or dash) · [A]: jump to head the ball · score in the other goal!',
  'ball.teams': 'Pick a team · stick left/right · everyone taps jump to start',
  'ball.left': 'Left team', 'ball.right': 'Right team', 'ball.helper': '+ helper bot',
  'ball.team.0': 'Team Sun', 'ball.team.1': 'Team Sea',
  'ball.goal': 'GOAL!', 'ball.scored': '{name} scored for {team}!',
  'ball.winTitle': '{team} wins!', 'ball.draw': "It's a draw!", 'ball.sub': '{a} - {b}',
  'ball.goals': '{n} goals', 'ball.touches': '{n} kicks', 'ball.keeper': 'Keeper Bot',
  'ball.overtime': 'Next goal wins!',

  'slalom.intro': 'Steer through the gates · [A]: jump · [B]: push off · stick up: tuck, down: brake',
  'slalom.toGo': '{n} m to go', 'slalom.finished': '{name} is in the finish!', 'slalom.closes': 'Finish closes in',
  'slalom.title': '{name} wins the slalom!', 'slalom.solo': 'What a run!', 'slalom.sub': '{n} gates on the course',
  'slalom.points': '{n} points', 'slalom.detail': '{place} · {g} gates', 'slalom.dnf': 'not finished', 'slalom.gates': 'gates',

  'hockey.intro': 'Skate to the puck to grab it · [B]: shoot (hold for power) · [A]: dash to steal',
  'hockey.goalie': 'Goalie Bot', 'hockey.shots': '{n} shots', 'hockey.steals': '{n} steals',

  'runner.intro': 'Race over the rooftops! [A]: jump (also off walls) · stick down: slide · [B]: dash · hold [C] near a balloon: swing',
  'runner.sign.run': 'Run!', 'runner.sign.slide': 'Down: slide', 'runner.sign.wall': 'Jump wall to wall', 'runner.sign.hook': 'Hold [C]: swing on the balloon', 'runner.sign.dash': '[B] in the air: dash',
  'runner.finished': '{name} finished {ord}!', 'runner.solo': 'What a run!', 'runner.sub': 'Rooftop speedrun', 'runner.left': '{n} m to go',
  'space.intro': 'Fly through the rings! Stick steers · hold [A]: boost · hold [B]: slide (keep your speed while the nose turns)',
  'space.gate': 'Ring {a}/{b}', 'space.solo': 'What a flight!', 'space.sub': '{n} laps · {g} rings', 'space.gates': '{n} rings',
  'party.round': 'Round {n} of {total}', 'party.ready': 'everyone taps jump when ready',
  'party.points': '{n} points', 'party.next': 'tap jump for the next round', 'party.final': 'tap jump for the final scores',
  'party.sub': '{n} rounds of party games', 'party.total': 'total points', 'party.wins': '{n} round wins',
  'count.title': 'Count the Critters', 'count.hint': 'Grumbles will run past. Count only the {c} ones! Then pick your number with the stick and tap jump.',
  'count.c.0': 'purple', 'count.c.1': 'orange', 'count.c.2': 'green',
  'count.watch': 'Count the {c} grumbles!', 'count.ask': 'How many? Stick up/down, jump to lock in',
  'count.answer': 'There were {n}!', 'count.guessed': 'guessed {g}',
  'statue.title': 'Statue Stop', 'statue.hint': 'Walk to the owl while it looks away. When it turns around, freeze! Anyone who moves hops back a bit.',
  'statue.go': 'GO!', 'statue.freeze': 'FREEZE!', 'statue.made': 'made it!', 'statue.left': '{n} m left',
  'cushions.title': 'Musical Cushions', 'cushions.hint': 'Dance around while the music plays. When it stops, cushions pop up: jump onto one before they are all taken!',
  'cushions.dance': 'Dance!', 'cushions.grab': 'Grab a cushion!', 'cushions.round': 'Song {n} of {total}', 'cushions.n': '{n} cushions',
  'fruit.title': 'Fruit Catch', 'fruit.hint': 'Catch the falling fruit in the basket on your head. Golden fruit is worth 3. Rotten apples make you slow, so dodge them! [A] jumps.',
  'fruit.n': '{n} points of fruit',
  'dance.title': 'Copy Dance', 'dance.hint': 'Watch the teacher dance, then copy the moves with the stick: up, down, left, right. The dances get longer!',
  'dance.watch': 'Watch!', 'dance.go': 'Your turn!', 'dance.level': 'Dance {n} of {total}', 'dance.n': '{n} moves',
  'tug.title': 'Tug of War', 'tug.hint': 'Tap jump as fast as you can to pull the rope. Pull the other team into the paint pool!',
  'tower.title': 'Bean Tower', 'tower.hint': 'Take turns: tap jump to drop your sliding block onto the tower. Neat drops keep the tower wide, perfect drops make it grow back!',
  'tower.turn': "{name}'s turn", 'tower.perfect': 'Perfect!', 'tower.height': 'Tower: {n} blocks', 'tower.n': '{n} blocks',
};

const no = {
  'go': 'KJØR!',
  'sound.on': 'Lyd på',
  'sound.off': 'Lyd av',
  'lang.name': 'Norsk',
  'lang.switched': 'Språk: norsk',
  'footer.stars': '+{n} stjerner til øya',
  'footer.continue': 'trykk hopp for å fortsette',
  'win': '{name} vinner!',
  'tie': 'Uavgjort!',
  'badge.edu': 'LÆRING',

  'color.0': 'Korall', 'color.1': 'Solgul', 'color.2': 'Mynte', 'color.3': 'Himmel', 'color.4': 'Drue', 'color.5': 'Mandarin',
  'hat.0': 'Ingen hatt', 'hat.1': 'Festhatt', 'hat.2': 'Blomst', 'hat.3': 'Kaninører', 'hat.4': 'Propell', 'hat.5': 'Flosshatt', 'hat.6': 'Krone',
  'device.kb0': 'WASD', 'device.kb1': 'Piler', 'device.kb2': 'IJKL', 'device.kb3': 'Talltastatur', 'device.gp': 'Kontroll {n}',
  'hint.kb0': 'WASD gå · Mellomrom hopp · E bruk · Q ekstra', 'hint.kb1': 'Piler gå · Enter hopp · H-Shift bruk · H-Ctrl ekstra', 'hint.kb2': 'IJKL gå · U hopp · O bruk · P ekstra', 'hint.kb3': 'Num 8456 gå · Num 0 hopp · Num , bruk · Num Enter ekstra',
  'key.space': 'Mellomrom', 'key.rshift': 'H-Shift', 'key.rctrl': 'H-Ctrl', 'key.numdec': 'Num ,',
  'gamepad': 'Spillkontroll',
  'akey.kb0': 'Mellomrom', 'akey.kb1': 'Enter', 'akey.kb2': 'U', 'akey.kb3': 'Num 0',

  'game.bubble': 'Boblevenner', 'game.platformer': 'Skyhopp', 'game.paint': 'Malefest',
  'game.archers': 'Ballongskyttere', 'game.brawl': 'Dunkekamp', 'game.kart': 'Gokartfest',
  'game.portal': 'Portalvenner', 'game.football': 'Megaball', 'game.slalom': 'Snøslalåm', 'game.hockey': 'Ishockey', 'game.party': 'Festmiks', 'game.space': 'Romkappløp', 'game.runner': 'Takløpet',
  'game.spelling': 'Bokstavballonger', 'game.math': 'Mattejakt',

  'hub.title': 'Sofafest-øya',
  'hub.join': 'Trykk på hoppknappen for å bli med (opptil 6 spillere)',
  'hub.keys': 'M: lyd av/på · N: English · Esc: hjelp',
  'hub.hint': 'Stå på en plattform sammen for å spille · bli med når som helst',
  'hub.nextHat': 'neste hatt ved {n}',
  'hub.padJoin': 'Bli med for å spille!',
  'hub.padReady': '{on}/{need} klare',
  'hub.padNeed': '{need} trengs',
  'hub.joined': '{name} er med!',
  'hub.newHat': 'Ny hatt: {hat}! Finn den på hattestativet',
  'hub.hatStand': 'Hatter', 'hub.hatHint': 'stå ved det, trykk [B]',
  'hub.basket': 'Kurv! {n} totalt', 'hub.baskets': 'Kurver: {n}',
  'hub.strike': 'STRIKE!', 'hub.pins': '{n} kjegler!',
  'hub.eduOn': 'Læringsspill: PÅ',
  'hub.eduOff': 'Læringsspill: AV',
  'hub.on': 'PÅ', 'hub.off': 'AV',
  'hub.jumpButton': 'hopp på knappen',
  'hub.langSign': 'Norsk',
  'hub.jumpFlag': 'hopp på flagget',
  'hub.taken': 'opptatt',
  'hub.newColor': '{name} har fått ny farge!',
  'hub.swapTitle': 'Bytt farge',
  'hub.swapHint': 'stå på begge plattene',
  'hub.swapReady': 'begge trykker [B]!',
  'hub.swapped': '{a} og {b} byttet farge!',
  'help.title': 'Slik spiller du',
  'help.1': 'Trykk på hoppknappen for å bli med. Opptil 6 spillere: 4 spillkontroller + tastatur.',
  'help.2': 'Gå inn på en spillplattform. Når halve gruppen står der, starter spillet.',
  'help.3': 'Samle stjerner på øya for å låse opp hatter. Stå ved hattestativet og trykk [B] for å prøve dem. Hold [B] for å gå ut.',
  'help.7': 'Leker: trykk [B] ved en ball for å plukke den opp, hold [B] og slipp for å kaste. Kast på kurven, velt kjeglene, hopp på trampolinen og soppen, eller ta en tur på husken.',
  'help.4': 'Gå inn i en malingsbøtte for å bytte farge. For å bytte farge med noen: stå på de to bytteplatene og trykk [B] begge to.',
  'help.5': 'Hopp på bokknappen (eller trykk G) for å vise eller skjule læringsspillene. Hopp på flagget (eller trykk N) for å bytte språk.',
  'help.6': 'I et spill åpner Esc (eller Start på spillkontrollen) menyen: fortsett, prøv igjen eller avslutt. M slår lyden av og på.',
  'pause.title': 'Pause', 'pause.resume': 'Fortsett', 'pause.retry': 'Prøv igjen', 'pause.end': 'Avslutt spillet',
  'pause.hint': 'Pinne opp/ned · [B] eller [A] for å velge · Esc eller Start for å fortsette',

  'bubble.intro': '[B]: blås bobler · sprekk boblene med grumlinger for frukt',
  'bubble.wave': 'Bølge {n}', 'bubble.last': 'Den siste!', 'bubble.chain': 'Kjedesprekk!',
  'bubble.allClear': 'Alt ryddet!', 'bubble.grab': 'Ta frukten!', 'bubble.cleared': 'Bølgen er ryddet!',
  'bubble.sleepy': 'Grumlingene ble søvnige ...', 'bubble.hudWave': 'Bølge {n}/{m}', 'team': 'Lag',
  'bubble.title': 'Hurra, alle bølgene er ryddet!', 'bubble.sub': 'Lagpoeng: {n}', 'bubble.detail': '{f} frukt · {r} redninger',

  'sky.intro': 'Kom til flagget sammen · faller du, flyter du tilbake i en boble',
  'sky.pick': 'Velg bane · pinnen venstre/høyre · hopp for å starte', 'sky.locked': 'Låst',
  'sky.unlock': 'Fullfør en bane for å låse opp den neste',
  'sky.madeIt': '{name} klarte det!', 'sky.everyone': 'Alle til flagget!',
  'sky.allMade': 'Alle klarte det!', 'sky.youMade': 'Dere klarte det!',
  'sky.sub': '{level} · lagets steiner: {a} / {b}', 'sky.gems': '{n} steiner', 'sky.first': 'Først til flagget!',
  'sky.stomps': '{n} hopp på hodet', 'sky.next': '[A]: neste bane · [B]: tilbake til øya',
  'sky.hudGems': 'Steiner', 'sky.flagCloses': 'Flagget stenger om',
  'level.0': 'Solskinnsenga', 'level.1': 'Godteriskyene', 'level.2': 'Høstskogen', 'level.3': 'Solnedgangsslottet',

  'paint.intro': 'Gå for å male · [A]: spurt · [B]: kast en malingsbombe',
  'paint.mega': '{name} fikk megapenselen!', 'paint.ten': '10 sekunder igjen!',
  'paint.solo': 'For et mesterverk!', 'paint.sub': 'Gulvet er {n} % malt', 'paint.top': 'Beste maler',

  'archers.intro': 'Pinne: sikt · [B]: skyt · sprekk ballonger, hopp på hoder, plukk opp pilene igjen',
  'archers.soloTitle': '{n} ballonger sprukket!', 'archers.soloSub': 'Blinkskytingen er ferdig',
  'archers.sub': 'Flest ballonger sprukket', 'archers.pops': '{n} treff', 'archers.popped': 'sprukket {n} ganger',

  'brawl.intro': '[B]: slag (hold for å lade) · opp+[B]: oppstøt · ned+[B]: snurr · dunk vennene av øya!',
  'brawl.bot': 'Dunkebot', 'brawl.ghostToast': '{name} er et boblespøkelse nå!',
  'brawl.botWins': 'Dunkebot vant denne gangen!', 'brawl.sub': 'Sist igjen på øya',
  'brawl.left': '{n} igjen', 'brawl.ghost': 'Spøkelse', 'brawl.ghostTag': 'spøkelse', 'brawl.detail': '{k} dunk · {f} fall',

  'kart.intro': 'Styr med pinnen · [A]: hopp og drift · [B]: bruk ting · 3 runder',
  'kart.item.boost': 'Turbo', 'kart.item.banana': 'Banan', 'kart.item.bubble': 'Boble',
  'kart.final': '{name}: siste runde!', 'kart.winsRace': '{name} vinner løpet!',
  'kart.lap': 'Runde {a}/{b}', 'kart.finished': 'I mål som nr. {ord}!', 'kart.closes': 'Målet stenger om',
  'kart.solo': 'Løpet er ferdig!', 'kart.sub': '{n} runder rundt Festparken', 'kart.lapShort': 'runde {n}',
  'ord.0': '1.', 'ord.1': '2.', 'ord.2': '3.', 'ord.3': '4.', 'ord.4': '5.', 'ord.5': '6.',

  'portal.intro': 'Få alle til utgangen · [A] og [B] skyter de to portalene dine',
  'portal.cleared': 'Rommet er klart!', 'portal.reset': 'Rommet starter på nytt',
  'portal.hud': 'Rom {i}/{n}: {name}', 'portal.left': '{n} igjen · hold [A]+[B] for å starte rommet på nytt', 'portal.out': 'ute!',
  'portal.title': 'Alle rommene er klare!', 'portal.sub': 'Portaltenking, sammen',
  'portal.detail': 'portaler · {n} boksdytt',
  'room.0.name': 'Hei, portaler!', 'room.0.hint': '[A] og [B] skyter de to portalene dine. Sett én over kløfta og én ved deg.',
  'room.1.name': 'Hold døra', 'room.1.hint': 'Stå på knappen for å åpne døra. Den siste kan bruke portaler!',
  'room.2.name': 'Spesiallevering', 'room.2.hint': 'Dytt boksen inn i en portal så den lander på knappen.',
  'room.3.name': 'Lagarbeid', 'room.3.hint': 'Boks på knappen, portal over kløfta, og så hjelper dere hverandre ut.',

  'ball.intro': '[B]: spark (eller spurt) · [A]: hopp for å heade · scor i det andre målet!',
  'ball.teams': 'Velg lag · pinnen venstre/høyre · alle trykker hopp for å starte',
  'ball.left': 'Venstre lag', 'ball.right': 'Høyre lag', 'ball.helper': '+ hjelpebot',
  'ball.team.0': 'Lag Sol', 'ball.team.1': 'Lag Hav',
  'ball.goal': 'MÅL!', 'ball.scored': '{name} scoret for {team}!',
  'ball.winTitle': '{team} vinner!', 'ball.draw': 'Uavgjort!', 'ball.sub': '{a} - {b}',
  'ball.goals': '{n} mål', 'ball.touches': '{n} spark', 'ball.keeper': 'Keeperbot',
  'ball.overtime': 'Neste mål vinner!',

  'slalom.intro': 'Styr gjennom portene · [A]: hopp · [B]: stavtak · pinne opp: fart, ned: brems',
  'slalom.toGo': '{n} m igjen', 'slalom.finished': '{name} er i mål!', 'slalom.closes': 'Målet stenger om',
  'slalom.title': '{name} vinner slalåmen!', 'slalom.solo': 'For et renn!', 'slalom.sub': '{n} porter i løypa',
  'slalom.points': '{n} poeng', 'slalom.detail': '{place} · {g} porter', 'slalom.dnf': 'ikke i mål', 'slalom.gates': 'porter',

  'hockey.intro': 'Skøyt til pucken for å ta den · [B]: skudd (hold for kraft) · [A]: spurt for å stjele',
  'hockey.goalie': 'Målvaktbot', 'hockey.shots': '{n} skudd', 'hockey.steals': '{n} taklinger',

  'runner.intro': 'Løp over takene! [A]: hopp (også fra vegger) · pinne ned: skli · [B]: spurt · hold [C] ved en ballong: sving',
  'runner.sign.run': 'Løp!', 'runner.sign.slide': 'Ned: skli', 'runner.sign.wall': 'Hopp fra vegg til vegg', 'runner.sign.hook': 'Hold [C]: sving i ballongen', 'runner.sign.dash': '[B] i lufta: spurt',
  'runner.finished': '{name} kom på {ord} plass!', 'runner.solo': 'For et løp!', 'runner.sub': 'Speedrun over takene', 'runner.left': '{n} m igjen',
  'space.intro': 'Fly gjennom ringene! Pinnen styrer · hold [A]: turbo · hold [B]: skli (behold farten mens nesen svinger)',
  'space.gate': 'Ring {a}/{b}', 'space.solo': 'For en tur!', 'space.sub': '{n} runder · {g} ringer', 'space.gates': '{n} ringer',
  'party.round': 'Runde {n} av {total}', 'party.ready': 'alle trykker hopp når de er klare',
  'party.points': '{n} poeng', 'party.next': 'trykk hopp for neste runde', 'party.final': 'trykk hopp for sluttresultatet',
  'party.sub': '{n} runder med festleker', 'party.total': 'totalpoeng', 'party.wins': '{n} rundeseire',
  'count.title': 'Tell krypene', 'count.hint': 'Krypene løper forbi. Tell bare de {c}! Velg tallet ditt med pinnen og trykk hopp.',
  'count.c.0': 'lilla', 'count.c.1': 'oransje', 'count.c.2': 'grønne',
  'count.watch': 'Tell de {c} krypene!', 'count.ask': 'Hvor mange? Pinne opp/ned, hopp for å låse',
  'count.answer': 'Det var {n}!', 'count.guessed': 'gjettet {g}',
  'statue.title': 'Frys!', 'statue.hint': 'Gå mot ugla når den ser bort. Når den snur seg: stå helt stille! Den som rører seg, hopper litt tilbake.',
  'statue.go': 'GÅ!', 'statue.freeze': 'FRYS!', 'statue.made': 'kom fram!', 'statue.left': '{n} m igjen',
  'cushions.title': 'Puteleken', 'cushions.hint': 'Dans rundt mens musikken spiller. Når den stopper, dukker det opp puter: hopp på en før alle er tatt!',
  'cushions.dance': 'Dans!', 'cushions.grab': 'Ta en pute!', 'cushions.round': 'Sang {n} av {total}', 'cushions.n': '{n} puter',
  'fruit.title': 'Fruktfangst', 'fruit.hint': 'Fang frukten i kurven på hodet. Gullfrukt gir 3 poeng. Råtne epler gjør deg treg, så unngå dem! [A] hopper.',
  'fruit.n': '{n} fruktpoeng',
  'dance.title': 'Hermedans', 'dance.hint': 'Se på læreren som danser, og herm etter med pinnen: opp, ned, venstre, høyre. Dansene blir lengre og lengre!',
  'dance.watch': 'Se nøye!', 'dance.go': 'Din tur!', 'dance.level': 'Dans {n} av {total}', 'dance.n': '{n} trinn',
  'tug.title': 'Tautrekking', 'tug.hint': 'Trykk hopp så fort du kan for å dra i tauet. Dra det andre laget uti malingsdammen!',
  'tower.title': 'Bønnetårnet', 'tower.hint': 'Bytt på: trykk hopp for å slippe klossen din på tårnet. Pene slipp holder tårnet bredt, perfekte slipp gjør det bredere igjen!',
  'tower.turn': '{name} sin tur', 'tower.perfect': 'Perfekt!', 'tower.height': 'Tårn: {n} klosser', 'tower.n': '{n} klosser',
};

const DICTS = { en, no };
let lang = 'en';

export function setLang(l) {
  lang = DICTS[l] ? l : 'en';
  document.documentElement.lang = lang === 'no' ? 'nb' : 'en';
}

export function getLang() {
  return lang;
}

export function t(key, vars) {
  let s = DICTS[lang][key] ?? en[key] ?? key;
  if (vars) s = s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? `{${k}}`));
  if (s.includes('[')) s = s.replace(/\[([ABC])\]/g, (_, b) => buttonText(b.toLowerCase()));
  return s;
}

// Button names in text: strings write [A], [B] or [C], and t() swaps in what the current players
// actually press ("E", "R-Shift", "B", "○"...). main.js supplies the list for the joined players.
let buttonSource = null;
export function setButtonSource(fn) { buttonSource = fn; }

const KEY_NAMES = { Space: 'key.space', ShiftRight: 'key.rshift', ControlRight: 'key.rctrl', NumpadDecimal: 'key.numdec' };
/** A keyboard code as players know it: KeyE -> "E", Numpad0 -> "Num 0", Space -> "Space"/"Mellomrom". */
export function keyName(code) {
  if (KEY_NAMES[code]) return t(KEY_NAMES[code]);
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Numpad')) return `Num ${code.slice(6)}`;
  return code;
}

/** "E / B": the names of one button for everyone playing. */
export function buttonText(btn) {
  const list = buttonSource?.(btn);
  return list?.length ? list.join(' / ') : btn.toUpperCase();
}

/**
 * Lets a game module bring its own text: call once at module top level.
 * addStrings({ en: { 'golf.title': 'Bean Golf' }, no: { 'golf.title': 'Bønnegolf' } })
 */
export function addStrings({ en: e = {}, no: n = {} }) {
  Object.assign(en, e);
  Object.assign(no, n);
}
