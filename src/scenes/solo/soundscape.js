import { addStrings } from '../../core/i18n.js';
import { heightAt, SEA_Y, CAFE } from './map.js';

// Calm music and ambience on the solo island (the "livelier island" round, part 4).
// Music: a calm track for the time of day (morning 5-11, day 11-17, evening 17-21, night), a winter version of
// each in winter weeks (core/audio.js SONGS 'isl.<phase>' and 'isl.<phase>.winter'); a change crossfades softly.
// Ambience by place, time and season: waves near the shore, wind up on the hills (and more in winter), birds by
// day (not in rain or winter), crickets on warm nights, rain or a soft snow hush, the café's murmur and clinks;
// indoors only a little of it comes through. The dive has its own underwater hum (dive.js). Both have a switch in
// the island's menu, saved per profile (S.sound); the master sound switch silences everything as before.

addStrings({
  en: { 'isl.mn.music': 'Island music', 'isl.mn.amb': 'Island sounds (waves, birds, rain)' },
  no: { 'isl.mn.music': 'Musikk på øya', 'isl.mn.amb': 'Lyder på øya (bølger, fugler, regn)' },
});

/** The time of day's track phase. */
export function phaseOf(h) {
  return h >= 5 && h < 11 ? 'morning' : h >= 11 && h < 17 ? 'day' : h >= 17 && h < 21 ? 'evening' : 'night';
}

/** The island track for an hour and a season (core/audio.js SONGS). */
export function musicFor(h, season) {
  return `isl.${phaseOf(h)}${season === 'winter' ? '.winter' : ''}`;
}

/** How near the sea (x, z) is: 1 at the water's edge, 0 from about 16 m inland. */
export function shoreness(x, z) {
  if (heightAt(x, z) < SEA_Y + 0.15) return 1;
  for (const r of [3, 6, 10, 16]) {
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      if (heightAt(x + Math.cos(a) * r, z + Math.sin(a) * r) < SEA_Y) return 1 - r / 18;
    }
  }
  return 0;
}

/**
 * The ambience levels (0..1) for where you are: { x, z, y (feet), h (hour), season, rainy, indoors, isle, dive }.
 */
export function ambienceFor({ x, z, y = 0, h, season, rainy = false, indoors = false, isle = false }) {
  const winter = season === 'winter';
  const day = h >= 6 && h < 19.5, night = h >= 20.5 || h < 5;
  const out = {};
  out.waves = isle ? Math.max(0.5, shoreness(x, z)) : shoreness(x, z);
  const hill = Math.max(0, Math.min(1, (Math.max(y, heightAt(x, z)) - 0.6) / 2.5)); // kite hill, the cliff tops
  out.wind = Math.min(1, 0.12 + hill * 0.75 + (winter ? 0.25 : 0) + (rainy ? 0.15 : 0));
  out.birds = day && !rainy ? (winter ? 0.25 : 0.8) * (1 - out.waves * 0.5) : 0;
  out.crickets = night && !rainy && !winter && !isle ? 0.8 : 0;
  out.rain = rainy && !winter && !isle ? 1 : 0;
  out.snow = rainy && winter && !isle ? 1 : 0;
  out.cafe = !isle && Math.hypot(x - CAFE.x, z - CAFE.z) < 6 ? 1 - Math.hypot(x - CAFE.x, z - CAFE.z) / 7 : 0;
  if (indoors) for (const k of Object.keys(out)) out[k] *= 0.25;
  return out;
}
