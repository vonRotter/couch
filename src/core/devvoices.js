import { getLang } from './i18n.js';
import { TYPES, TYPE_ORDER, SPEAKERS, speakerType, voiceGender, voiceQuality } from './voices.js';
import { say, stopVoice, currentVoices, babbleMode } from './voice.js';

// Playtest voice panel (hidden like the time machine: open the site once with ?dev, ?dev=0 turns it
// off). F10 shows the device's speech voices for the current language, which voice the narrator and
// every voice type got, the characters of each type, and buttons to hear each type read aloud or as
// babble. Not for kids, so its text is plain English (sample lines follow the game's language).

const ON_KEY = 'couch.dev';

const SAMPLES = {
  en: {
    narrator: 'Once upon a time, on a little island, the sun came up over the sea.',
    child: 'Wow! Did you see that? Let\'s go again!',
    grandma: 'Oh, hello dear. Would you like a cup of cocoa?',
    gruff: 'Ahoy there. Mind the ropes, the sea is grumpy today.',
    cheerful: 'Welcome, welcome! Fresh seeds today, two for one!',
    owl: 'Hoo. A fine fossil. Older than the hills, I would say.',
    sleepy: 'Mmm... is it morning already? Five more minutes...',
    villain: 'Ha! You will never find my hidden treasure!',
    tiny: 'Eep! Hello! I am very small but very brave!',
    crab: 'Click click! Thank you for the shiny shell!',
    bird: 'Squawk! Mine! That fish is mine!',
    robot: 'Beep boop. Helper online. Try this move.',
    friendly: 'Good evening! One soup, please. Thank you kindly.',
  },
  no: {
    narrator: 'Det var en gang, på en liten øy, at sola sto opp over havet.',
    child: 'Oi! Så du det? Vi tar en gang til!',
    grandma: 'Å, hei, vennen min. Vil du ha en kopp kakao?',
    gruff: 'Ohoi der. Pass deg for tauene, havet er gretten i dag.',
    cheerful: 'Velkommen, velkommen! Ferske frø i dag, to for én!',
    owl: 'Ho. Et flott fossil. Eldre enn åsene, vil jeg tro.',
    sleepy: 'Mmm ... er det morgen allerede? Fem minutter til ...',
    villain: 'Ha! Du finner aldri den hemmelige skatten min!',
    tiny: 'Pip! Hei! Jeg er veldig liten, men veldig modig!',
    crab: 'Klikk klikk! Takk for det skinnende skjellet!',
    bird: 'Skrik! Min! Den fisken er min!',
    robot: 'Bip bop. Hjelper på plass. Prøv dette trekket.',
    friendly: 'God kveld! Én suppe, takk. Tusen takk.',
  },
};

function enabled() {
  try {
    const q = new URLSearchParams(location.search);
    if (q.has('dev')) localStorage.setItem(ON_KEY, q.get('dev') === '0' ? '' : '1');
    return localStorage.getItem(ON_KEY) === '1';
  } catch { return false; }
}

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

function mount() {
  const el = document.createElement('div');
  el.id = 'dev-voices';
  el.style.cssText = 'position:fixed;left:12px;top:60px;z-index:9999;background:#1d1830f2;color:#fff;font:12px/1.35 system-ui,sans-serif;'
    + 'padding:10px 12px;border-radius:12px;width:min(560px,calc(100vw - 48px));max-height:calc(100vh - 90px);overflow:auto;display:none;box-shadow:0 6px 24px #0008';
  document.body.appendChild(el);
  const btn = 'margin:1px 2px;padding:3px 7px;border:0;border-radius:7px;background:#ffd84a;color:#2b2340;font:600 11px system-ui;cursor:pointer';

  function render() {
    const lang = getLang();
    const picked = currentVoices(lang);
    const all = (() => { try { return window.speechSynthesis?.getVoices() || []; } catch { return []; } })();
    const who = (type) => Object.keys(SPEAKERS).filter((id) => speakerType(id) === type && id !== type).join(', ');
    const row = (type) => {
      const T = TYPES[type];
      const v = type === 'narrator' ? picked?.narrator : picked?.types[type];
      const voice = picked ? (v?.voice ? `${esc(v.voice.name)}` : '<i>browser default</i>') : '<i>no voice for this language: silent</i>';
      return `<tr><td><b>${esc(T.name)}</b><div style="opacity:.6;font-size:10px">${esc(type === 'narrator' ? 'cards, narration, menus, toasts' : who(type))}</div></td>
        <td>${voice}${v ? `<div style="opacity:.6">pitch ${v.pitch.toFixed(2)} · rate ${v.rate.toFixed(2)}</div>` : ''}</td>
        <td style="white-space:nowrap"><button style="${btn}" data-say="${type}">Voice</button>${T.babble ? `<button style="${btn}" data-babble="${type}">Babble</button>` : ''}</td></tr>`;
    };
    const list = all.map((v) => `<tr style="opacity:${/^(en|nb|no|nn)/i.test(v.lang) ? 1 : 0.45}"><td>${esc(v.name)}</td><td>${esc(v.lang)}</td>
      <td>${v.localService ? 'local' : 'online'}${v.default ? ' · default' : ''}</td><td>${voiceGender(v) || '?'}</td><td>${voiceQuality(v)}</td></tr>`).join('');
    el.innerHTML = `<b>Voices</b> <span style="opacity:.6">(F10 · language ${lang} · characters ${babbleMode() ? 'babble' : 'speak'}: B)</span>
      <button style="${btn};float:right" data-stop="1">Stop</button>
      <table style="width:100%;margin-top:6px;border-collapse:collapse">${['narrator', ...TYPE_ORDER].map(row).join('')}</table>
      <div style="margin-top:8px;opacity:.7">Device voices (${all.length}; gender guess, quality score):</div>
      <table style="width:100%;border-collapse:collapse;font-size:11px">${list || '<tr><td><i>none listed (yet)</i></td></tr>'}</table>`;
    for (const td of el.querySelectorAll('td')) td.style.cssText += ';padding:3px 4px;border-top:1px solid #ffffff18;vertical-align:top';
  }

  el.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    e.stopPropagation();
    const type = b.dataset.say || b.dataset.babble;
    const lines = SAMPLES[getLang()] || SAMPLES.en;
    if (b.dataset.stop) stopVoice();
    else if (type) say(lines[type], { speaker: type, force: true, babble: !!b.dataset.babble });
    b.blur();
  });
  window.addEventListener('keydown', (e) => {
    if (e.code !== 'F10') return;
    e.preventDefault();
    el.style.display = el.style.display === 'none' ? 'block' : 'none';
    if (el.style.display !== 'none') render();
  });
  try { window.speechSynthesis?.addEventListener('voiceschanged', () => { if (el.style.display !== 'none') render(); }); } catch { /* no speech */ }
  window.__devVoices = { render, el };
}

if (typeof window !== 'undefined' && enabled()) {
  if (document.body) mount(); else window.addEventListener('DOMContentLoaded', mount);
}
