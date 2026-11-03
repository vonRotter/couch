import { t, tFor, addStrings } from '../../core/i18n.js';
import { esc } from '../../core/ui.js';
import { say as speak } from '../../core/voice.js';

// The journal: one book with tabs for Friends (villagers, crab friends, the farm animals: friends.js), Tasks,
// the Calendar (seasons.js), the Fish log (island.js) and the Museum list (museum.js, to look at; donating
// stays at Curator Hoot's board). F or the D-pad down opens it; LB/RB on a gamepad or 1-5 (also [ and ])
// on a keyboard switch tabs; [C] (Q / gamepad B) closes it (F and Tab too; on a keyboard Space and E as
// before). The calendar board and the fish log book open it at their tab.
// Read-aloud: the Friends pages (a book you open) and the Tasks (help) are read; the lists are not.

export const TABS = ['friends', 'tasks', 'cal', 'fish', 'museum'];
const ICONS = { friends: '💛', tasks: '📝', cal: '📅', fish: '🐟', museum: '🏛️' };

addStrings({
  en: {
    'isl.jn.friends': 'Friends', 'isl.jn.tasks': 'Tasks', 'isl.jn.cal': 'Calendar', 'isl.jn.fish': 'Fish log', 'isl.jn.museum': 'Museum',
    'isl.jn.hint': '[TABS]: tab · [C]: close',
    'isl.jn.tasksTitle': 'Things to do', 'isl.jn.noTasks': 'Nothing on the list right now. Go and say hello to someone!',
    'isl.jn.tasksSay': 'Things to do.',
    'isl.museum.donateAt': 'You have one: bring your {item} to Curator Hoot!',
  },
  no: {
    'isl.jn.friends': 'Venner', 'isl.jn.tasks': 'Oppgaver', 'isl.jn.cal': 'Kalender', 'isl.jn.fish': 'Fiskeloggen', 'isl.jn.museum': 'Museet',
    'isl.jn.hint': '[TABS]: fane · [C]: lukk',
    'isl.jn.tasksTitle': 'Ting å gjøre', 'isl.jn.noTasks': 'Ingenting på lista akkurat nå. Gå og si hei til noen!',
    'isl.jn.tasksSay': 'Ting å gjøre.',
    'isl.museum.donateAt': 'Du har en: ta med {item} til kurator Hu!',
  },
});

const CSS = `
.isl-jtabs { display: flex; justify-content: center; flex-wrap: wrap; gap: 6px; margin: -4px 0 8px; }
.isl-jtabs span { padding: 2px 14px; border-radius: 999px; background: rgba(138,90,50,.13); font-weight: 700; font-size: clamp(13px, 1.3vw, 19px); color: #8a5a32; cursor: pointer; }
.isl-jtabs span.on { background: #ffd84a; color: #2b2340; box-shadow: 0 3px 0 rgba(43,35,64,.2); }
.isl-jtasks { margin: 0; padding: 0 0 0 1.2em; font-size: clamp(15px, 1.5vw, 22px); line-height: 1.45; }
.isl-jtasks li { margin: 2px 0; }
`;
function injectStyle() {
  if (document.getElementById('isl-jn-style')) return;
  const el = document.createElement('style');
  el.id = 'isl-jn-style';
  el.textContent = CSS;
  document.head.appendChild(el);
}

export class Journal {
  constructor(host) {
    this.host = host;
    this.tab = 'friends';
    this.t = 0;
    injectStyle();
    // the mouse can pick a tab too
    this.onClick = (e) => {
      const el = e.target.closest?.('.isl-jtabs span[data-tab]');
      if (el && this.host.mode === 'journal') this.setTab(el.dataset.tab);
    };
    host.hud.panel.addEventListener('click', this.onClick);
  }

  /** Open at a tab (default: the last one). */
  open(tab = null) {
    const host = this.host;
    if (tab && TABS.includes(tab)) this.tab = tab;
    host.mode = 'journal';
    this.t = 0;
    this.show(true);
    host.game.audio.play('select');
  }

  close() {
    const hud = this.host.hud;
    hud.panelPrefix = hud.panelSuffix = '';
    hud.setPanel(null);
    this.host.mode = 'walk';
  }

  setTab(tab) {
    if (tab === this.tab || !TABS.includes(tab)) return;
    this.tab = tab;
    this.host.game.audio.play('select');
    this.show(true);
  }

  /** Draw the current tab (read: read it aloud when it is a page that is read). */
  show(read = false) {
    const host = this.host, hud = host.hud;
    const num = (i) => (host.onPad ? '' : `<small style="opacity:.5"> ${i + 1}</small>`); // the keys 1-5 on a keyboard
    hud.panelPrefix = `<div class="isl-jtabs">${TABS.map((k, i) => `<span data-tab="${k}" class="${k === this.tab ? 'on' : ''}">${ICONS[k]} ${esc(t(`isl.jn.${k}`))}${num(i)}</span>`).join('')}</div>`;
    hud.panelSuffix = `<div class="isl-foot">${esc(tFor(host.player?.p, 'isl.jn.hint'))}</div>`;
    hud.cache.panel = null;
    switch (this.tab) {
      case 'friends': host.friends.render(read); break;
      case 'tasks': this.renderTasks(read); break;
      case 'cal': host.seasons.renderCalendar(); break;
      case 'fish': host.log ||= { i: 0, t: 0 }; host.renderLog(); break;
      case 'museum': host.museum.renderList(); break;
    }
  }

  renderTasks(read) {
    const host = this.host;
    const list = host.allTasks();
    host.hud.setPanel(`<h2>${esc(t('isl.jn.tasksTitle'))}</h2>
      ${list.length ? `<ul class="isl-jtasks">${list.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>` : `<div class="isl-foot" style="opacity:1">${esc(t('isl.jn.noTasks'))}</div>`}`);
    if (read) speak(list.length ? [t('isl.jn.tasksSay'), ...list].join(' ') : t('isl.jn.noTasks'), 'narrator');
  }

  update(inp, dt) {
    const host = this.host;
    this.t += dt;
    const keys = host.game.input.pressed;
    const dev = host.playerDevice;
    const P = dev?.btnPressed || {};
    // tabs: LB/RB, [ and ], or 1-5
    let step = (P.rb || keys.has('BracketRight') ? 1 : 0) - (P.lb || keys.has('BracketLeft') ? 1 : 0);
    for (let k = 1; k <= TABS.length; k++) if (keys.has(`Digit${k}`)) { this.setTab(TABS[k - 1]); step = 0; }
    if (step) this.setTab(TABS[(TABS.indexOf(this.tab) + step + TABS.length) % TABS.length]);
    // close: [C] (Q / gamepad B), F, Tab; on a keyboard Space and E close as before (a gamepad's A and X do nothing)
    const kb = !host.onPad;
    if (this.t > 0.25 && (inp.cPressed || keys.has('KeyF') || keys.has('Tab') || (kb && (inp.aPressed || inp.bPressed)))) { this.close(); return; }
    // the page itself: turn pages, look through the lists
    switch (this.tab) {
      case 'friends': host.friends.flip(inp); break;
      case 'fish': host.logStep(inp); break;
      case 'museum': host.museum.listStep(inp); break;
    }
  }

  dispose() {
    this.host.hud.panel.removeEventListener('click', this.onClick);
  }
}
