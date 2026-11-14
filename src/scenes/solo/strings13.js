import { addStrings } from '../../core/i18n.js';

// Strings for the owner's "fewer crabs" round: one crab needs a hand a day, somewhere (crabdata.js todaysCrab).
addStrings({
  en: {
    'crab.task.today': "🦀 Today's crab: {what} {where}",
    'crab.what.flip': 'a crab on its back', 'crab.what.free': 'a crab tangled in seaweed or a net',
    'crab.what.freeLobster': 'a lobster caught in an old net', 'crab.what.home': 'lost baby crabs',
    'crab.what.shell': 'a hermit crab who needs a bigger shell',
    'crab.where.main': 'on the beach', 'crab.where.isle': 'on Shell Isle', 'crab.where.dive': 'in the dive',
    'crab.today.done': "Today's crab is happy again. Another one may need a hand tomorrow!",
    'isl.fb.crabToday': 'Today',
    'map.a.crabAway': 'A crab needs a hand {where}',
  },
  no: {
    'crab.task.today': '🦀 Dagens krabbe: {what} {where}',
    'crab.what.flip': 'en krabbe på ryggen', 'crab.what.free': 'en krabbe som sitter fast i tang eller garn',
    'crab.what.freeLobster': 'en hummer fast i et gammelt garn', 'crab.what.home': 'bortkomne krabbeunger',
    'crab.what.shell': 'en eremittkreps som trenger et større skjell',
    'crab.where.main': 'på stranda', 'crab.where.isle': 'på Skjelløya', 'crab.where.dive': 'under vannet (dykking)',
    'crab.today.done': 'Dagens krabbe er glad igjen. Kanskje en annen trenger hjelp i morgen!',
    'isl.fb.crabToday': 'I dag',
    'map.a.crabAway': 'En krabbe trenger hjelp {where}',
  },
});

// The farming tutorial can be skipped (core/tutorial.js): Aunt Hazel asks after her welcome, and the menu has
// "Skip the farming steps" while they run.
addStrings({
  en: {
    'isl.hazel.tutAsk': 'Shall I show you how to farm, one step at a time?',
    'isl.tut.yes': 'Yes please', 'isl.tut.no': 'I know how to play',
    'isl.hazel.tutSkip': 'Off you go then! Your tasks are on the list, and Help in the menu has the buttons.',
    'isl.mn.skiptut': 'Skip the farming steps',
  },
  no: {
    'isl.hazel.tutAsk': 'Skal jeg vise deg hvordan du dyrker, ett steg om gangen?',
    'isl.tut.yes': 'Ja takk', 'isl.tut.no': 'Jeg kan spille dette',
    'isl.hazel.tutSkip': 'Da kan du bare sette i gang! Oppgavene står på lista, og Hjelp i menyen har knappene.',
    'isl.mn.skiptut': 'Hopp over gårdsstegene',
  },
});
