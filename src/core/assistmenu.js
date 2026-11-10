// The "Help me play" page (the accessibility settings, core/assist.js) and the gentle offer card.
// Both are main.js modals like the pause menu: the game waits behind them (game time frozen).
// Opened from the pause menu in every game, the solo island's menu and the shared island's menu ([C]).
// Controls as in every menu: stick up/down picks a row, left/right (or [OK]) changes it, [BACK] (Esc / B) closes.
// A gamepad's B never picks. Read aloud: each row is read when the cursor reaches it.

import { t, tFor, keyName, addStrings } from './i18n.js';
import { esc } from './ui.js';
import { say, voiceOn } from './voice.js';
import { SPEEDS, TEXT_SIZES, profileSettings, saveSettings } from './assist.js';
import { KEYBOARD_SCHEMES, PAD_LABELS, REMAP_PAD, RESERVED_KEYS, schemeKeyOwner } from './input.js';
import { deviceLabel } from './roster.js';

addStrings({
  en: {
    'mode.assist': 'Help me play', 'mode.assist.sub': 'Speed, timing, aim help, text, buttons…',
    'assist.title': 'Help me play', 'assist.for': 'Settings for', 'assist.everyone': 'Everyone (guests)',
    'assist.hint': 'Stick up/down: choose · left/right or [OK]: change · [BACK]: done',
    'assist.speed': 'Game speed', 'assist.speed.d': 'Slows the game down. Menus, music and voices stay the same.',
    'assist.timing': 'Forgiving timing', 'assist.timing.d': 'Wider timing: late jumps still work, bigger green zones, longer warnings and more time to answer.',
    'assist.aim': 'Aim help', 'assist.aim.d': 'Shots, throws and spells bend toward what you aim at.',
    'assist.aim.0': 'off', 'assist.aim.1': 'a little', 'assist.aim.2': 'a lot',
    'assist.toggle': 'Hold to toggle', 'assist.toggle.d': 'Things you must hold (charge, boost, end turn...) become: tap to start, tap again to stop.',
    'assist.text': 'Text size', 'assist.text.d': 'Bigger words on the screen.', 'assist.text.0': 'normal', 'assist.text.1': 'big', 'assist.text.2': 'huge',
    'assist.contrast': 'Strong outlines', 'assist.contrast.d': 'Thick outlines on players, enemies and targets, and shapes as well as colours.',
    'assist.offers': 'Offer help when it is hard', 'assist.offers.d': 'After a few tries at the same part, the game asks if you want help. (Turning it on again also brings back every "don\'t ask again".)',
    'assist.buttons': 'Buttons…', 'assist.buttons.d': 'Choose which key or button does what, for the controller you hold.',
    'assist.done': 'Done', 'assist.done.d': 'Back to the game.',
    'assist.on': 'on', 'assist.off': 'off',
    'assist.saved.profile': 'Saved for {name}', 'assist.saved.device': 'Saved for everyone on this device',
    'keys.title': 'Buttons: {dev}', 'keys.hint': 'Stick up/down: choose · [OK]: change it, then press the new one · [BACK]: back',
    'keys.press': 'Press the new key or button for: {what}', 'keys.pressHint': 'Esc or Start: cancel',
    'keys.a': 'Jump · pick', 'keys.b': 'Use', 'keys.c': 'Third button · menu',
    'keys.pad.a': 'Jump · pick', 'keys.pad.b': 'Use · back', 'keys.pad.x': 'Third button (use on your island)', 'keys.pad.y': 'Jump too',
    'keys.pad.lb': 'Third button too', 'keys.pad.rb': 'Use too', 'keys.pad.lt': 'Third button too', 'keys.pad.rt': 'Use too',
    'keys.reset': 'Back to normal', 'keys.back': 'Back',
    'keys.taken': '{key} is used by {dev}', 'keys.reserved': '{key} is a game shortcut', 'keys.set': '{what}: {key}',
    'keys.wrongDevice': 'Press it on {dev}',
    'offer.yes': 'Yes please', 'offer.no': 'No thanks', 'offer.never': "Don't ask again",
    'offer.timing': 'That part is tricky! Want forgiving timing? Late jumps still count and the windows get wider.',
    'offer.aim': 'Want some aim help? Your throws and shots bend toward targets.',
    'offer.speed': 'Want to slow the game down a little? It will play at 75 %.',
    'offer.skip': 'Want to skip this part for now? It is marked as skipped, so you can play it later.',
    'offer.hint': 'Stick up/down · [OK]: choose · [BACK]: no thanks',
    'offer.on': '{what} is on. Change it any time in Help me play.', 'offer.skipped': 'Skipped. You can play it later.',
  },
  no: {
    'mode.assist': 'Hjelp meg å spille', 'mode.assist.sub': 'Fart, timing, siktehjelp, tekst, knapper…',
    'assist.title': 'Hjelp meg å spille', 'assist.for': 'Innstillinger for', 'assist.everyone': 'Alle (gjester)',
    'assist.hint': 'Pinne opp/ned: velg · venstre/høyre eller [OK]: endre · [BACK]: ferdig',
    'assist.speed': 'Spillfart', 'assist.speed.d': 'Gjør spillet saktere. Menyer, musikk og stemmer er som før.',
    'assist.timing': 'Snill timing', 'assist.timing.d': 'Mer tid: sene hopp virker, større grønne felt, lengre varsler og mer tid til å svare.',
    'assist.aim': 'Siktehjelp', 'assist.aim.d': 'Skudd, kast og trylleformler svinger mot det du sikter på.',
    'assist.aim.0': 'av', 'assist.aim.1': 'litt', 'assist.aim.2': 'mye',
    'assist.toggle': 'Trykk i stedet for å holde', 'assist.toggle.d': 'Ting du må holde (lade, turbo, avslutte turen...) blir: trykk for å starte, trykk igjen for å stoppe.',
    'assist.text': 'Tekststørrelse', 'assist.text.d': 'Større ord på skjermen.', 'assist.text.0': 'vanlig', 'assist.text.1': 'stor', 'assist.text.2': 'kjempestor',
    'assist.contrast': 'Tydelige kanter', 'assist.contrast.d': 'Tykke kanter rundt spillere, fiender og mål, og former i tillegg til farger.',
    'assist.offers': 'Tilby hjelp når det er vanskelig', 'assist.offers.d': 'Etter noen forsøk på samme sted spør spillet om du vil ha hjelp. (Slår du det på igjen, kommer alle «ikke spør igjen» tilbake.)',
    'assist.buttons': 'Knapper…', 'assist.buttons.d': 'Velg hvilken tast eller knapp som gjør hva, for kontrollen du holder.',
    'assist.done': 'Ferdig', 'assist.done.d': 'Tilbake til spillet.',
    'assist.on': 'på', 'assist.off': 'av',
    'assist.saved.profile': 'Lagret for {name}', 'assist.saved.device': 'Lagret for alle på denne maskinen',
    'keys.title': 'Knapper: {dev}', 'keys.hint': 'Pinne opp/ned: velg · [OK]: endre, trykk så den nye · [BACK]: tilbake',
    'keys.press': 'Trykk den nye tasten eller knappen for: {what}', 'keys.pressHint': 'Esc eller Start: avbryt',
    'keys.a': 'Hopp · velg', 'keys.b': 'Bruk', 'keys.c': 'Tredje knapp · meny',
    'keys.pad.a': 'Hopp · velg', 'keys.pad.b': 'Bruk · tilbake', 'keys.pad.x': 'Tredje knapp (bruk på øya di)', 'keys.pad.y': 'Hopp også',
    'keys.pad.lb': 'Tredje knapp også', 'keys.pad.rb': 'Bruk også', 'keys.pad.lt': 'Tredje knapp også', 'keys.pad.rt': 'Bruk også',
    'keys.reset': 'Tilbake til vanlig', 'keys.back': 'Tilbake',
    'keys.taken': '{key} brukes av {dev}', 'keys.reserved': '{key} er en snarvei i spillet', 'keys.set': '{what}: {key}',
    'keys.wrongDevice': 'Trykk på {dev}',
    'offer.yes': 'Ja takk', 'offer.no': 'Nei takk', 'offer.never': 'Ikke spør igjen',
    'offer.timing': 'Det der er vrient! Vil du ha snill timing? Sene hopp teller, og du får mer tid.',
    'offer.aim': 'Vil du ha litt siktehjelp? Kast og skudd svinger mot målene.',
    'offer.speed': 'Vil du gjøre spillet litt saktere? Det går da i 75 %.',
    'offer.skip': 'Vil du hoppe over dette stedet nå? Det blir merket som hoppet over, så du kan spille det senere.',
    'offer.hint': 'Pinne opp/ned · [OK]: velg · [BACK]: nei takk',
    'offer.on': '{what} er på. Du kan endre det når som helst i Hjelp meg å spille.', 'offer.skipped': 'Hoppet over. Du kan spille det senere.',
  },
});

const ROWS = ['speed', 'timing', 'aim', 'toggle', 'text', 'contrast', 'offers', 'buttons', 'done'];

/** The devices that steer a shared menu: the joined players', or every device when nobody has joined. */
export function menuDevices(game) {
  const ds = game.roster.players.map((p) => game.input.get(p.deviceId)).filter(Boolean);
  if (ds.length) return ds;
  return [...KEYBOARD_SCHEMES.map((s) => game.input.get(s.id)), ...[0, 1, 2, 3].map((i) => game.input.get(`gp${i}`)).filter((d) => d.connected)];
}

/** The keyboard keys a settings object gives a scheme: { a: [code], b: [code], c: [code] }. */
export function schemeKeys(s, scheme) {
  const k = s.keys?.[scheme.id];
  return { a: [k?.a || scheme.a[0]], b: [k?.b || scheme.b[0]], c: [k?.c || scheme.c[0]] };
}

const padNames = (d) => PAD_LABELS[d?.kind] || PAD_LABELS.xbox;

export class AssistMenu {
  /**
   * targets: [{ id, name }] whose settings can be changed (id '' = the device default); the first is shown.
   * onClose(): called after it closes (main.js reopens the menu it came from).
   */
  constructor(game, { targets, onClose = null }) {
    this.game = game;
    this.targets = targets;
    this.ti = 0;
    this.rows = targets.length > 1 ? ['who', ...ROWS] : ROWS;
    this.index = targets.length > 1 ? 1 : 0;
    this.onClose = onClose;
    this.page = 'main'; // 'main' | 'keys' | 'capture'
    this.t = 0;
    this.el = game.ui.panel('', 'panel pause assist-panel');
    this.render();
    this.readRow();
  }

  get target() { return this.targets[this.ti]; }
  get s() { return profileSettings(this.target.id); }

  set(patch) {
    saveSettings(this.target.id, { ...this.s, ...patch });
  }

  value(k) {
    const s = this.s;
    switch (k) {
      case 'who': return esc(this.target.name);
      case 'speed': return `${Math.round(s.speed * 100)} %`;
      case 'aim': return t(`assist.aim.${s.aim}`);
      case 'text': return t(`assist.text.${s.text}`);
      case 'timing': case 'toggle': case 'contrast': case 'offers': return t(s[k] ? 'assist.on' : 'assist.off');
      default: return '';
    }
  }

  label(k) {
    return k === 'who' ? t('assist.for') : t(`assist.${k}`);
  }

  render() {
    if (!this.el) return;
    if (this.page !== 'main') { this.renderKeys(); return; }
    const items = this.rows.map((k, i) => {
      const v = this.value(k);
      const on = i === this.index ? 'on' : '';
      const val = v ? `<span class="assist-val">${k === 'buttons' || k === 'done' ? '' : '◀ '}${v}${k === 'buttons' || k === 'done' ? '' : ' ▶'}</span>` : '';
      return `<div class="pause-item assist-row ${on} ${k}"><span>${esc(this.label(k))}</span>${val}</div>`;
    }).join('');
    const k = this.rows[this.index];
    const desc = k === 'who' ? '' : t(`assist.${k}.d`);
    this.el.innerHTML = `<div class="results-title">${esc(t('assist.title'))}</div>
      <div class="pause-list assist-list">${items}</div>
      <div class="assist-desc">${esc(desc)}</div>
      <div class="results-footer">${esc(t('assist.hint'))}</div>`;
  }

  readRow() {
    if (!voiceOn()) return;
    const k = this.page === 'main' ? this.rows[this.index] : null;
    if (!k) return;
    const v = this.value(k).replace(/<[^>]+>/g, '');
    say(`${this.label(k)}${v ? `: ${v}` : ''}. ${k === 'who' ? '' : t(`assist.${k}.d`)}`, 'narrator');
  }

  /** Change a row's value by dir (+1 / -1). */
  change(k, dir) {
    const s = this.s;
    const cyc = (list, v) => list[(list.indexOf(v) + dir + list.length) % list.length];
    if (k === 'who') { this.ti = (this.ti + dir + this.targets.length) % this.targets.length; return; }
    if (k === 'speed') this.set({ speed: cyc(SPEEDS, s.speed) });
    else if (k === 'aim') this.set({ aim: (s.aim + dir + 3) % 3 });
    else if (k === 'text') this.set({ text: (s.text + dir + TEXT_SIZES.length) % TEXT_SIZES.length });
    else if (k === 'offers') this.set({ offers: !s.offers, never: !s.offers ? [] : s.never });
    else if (['timing', 'toggle', 'contrast'].includes(k)) this.set({ [k]: !s[k] });
    else return;
    this.game.applyScreenSettings?.();
  }

  update(dt) {
    this.t += dt;
    if (this.page === 'capture') { this.updateCapture(); return; }
    for (const d of menuDevices(this.game)) {
      const back = d.backPressed || this.game.input.escPressed || (d.type === 'keyboard' && d.cPressed);
      if (this.page === 'keys') { if (this.updateKeys(d, back)) return; continue; }
      const n = this.rows.length;
      if (d.stepY) { this.index = (this.index - d.stepY + n) % n; this.game.audio.play('select'); this.render(); this.readRow(); }
      if (this.t < 0.2) continue;
      const k = this.rows[this.index];
      if (back) { this.close(); return; }
      if (d.stepX && k !== 'buttons' && k !== 'done') { this.change(k, d.stepX); this.game.audio.play('select'); this.render(); this.readRow(); continue; }
      if (!d.okPressed) continue;
      this.game.audio.play('select');
      if (k === 'done') { this.close(); return; }
      if (k === 'buttons') { this.openKeys(d); return; }
      this.change(k, 1);
      this.render();
      this.readRow();
    }
  }

  // ---------- the buttons page (remapping, for the device that opened it) ----------

  openKeys(d) {
    this.dev = d;
    this.page = 'keys';
    this.kIndex = 0;
    this.t = 0;
    this.render();
  }

  keyRows() {
    return [...(this.dev.type === 'keyboard' ? ['a', 'b', 'c'] : REMAP_PAD.slice(0, 6)), 'reset', 'back'];
  }

  /** What a row shows now: the key / the physical pad button that does it. */
  keyValue(k) {
    const s = this.s;
    if (this.dev.type === 'keyboard') return keyName(schemeKeys(s, this.dev.scheme)[k][0]);
    return padNames(this.dev)[s.pad?.[k] || k];
  }

  keyLabel(k) {
    if (k === 'reset' || k === 'back') return t(`keys.${k}`);
    if (this.dev.type === 'keyboard') return t(`keys.${k}`);
    return `${padNames(this.dev)[k]}: ${t(`keys.pad.${k}`)}`;
  }

  renderKeys() {
    const rows = this.keyRows();
    const dev = deviceLabel(this.dev.id);
    if (this.page === 'capture') {
      this.el.innerHTML = `<div class="results-title">${esc(t('keys.title', { dev }))}</div>
        <div class="assist-capture blink">${esc(t('keys.press', { what: this.keyLabel(this.capture) }))}</div>
        <div class="results-footer">${esc(this.msg || t('keys.pressHint'))}</div>`;
      return;
    }
    const items = rows.map((k, i) => `<div class="pause-item assist-row ${i === this.kIndex ? 'on' : ''}"><span>${esc(this.keyLabel(k))}</span>${k === 'reset' || k === 'back' ? '' : `<span class="assist-val key">${esc(this.keyValue(k))}</span>`}</div>`).join('');
    this.el.innerHTML = `<div class="results-title">${esc(t('keys.title', { dev }))}</div>
      <div class="pause-list assist-list">${items}</div>
      <div class="assist-desc">${esc(this.msg || '')}</div>
      <div class="results-footer">${esc(tFor({ deviceId: this.dev.id }, 'keys.hint'))}</div>`;
  }

  /** Returns true when it handled this frame for every device. */
  updateKeys(d, back) {
    if (d !== this.dev) return false;
    const rows = this.keyRows();
    const n = rows.length;
    if (d.stepY) { this.kIndex = (this.kIndex - d.stepY + n) % n; this.msg = ''; this.game.audio.play('select'); this.render(); if (voiceOn()) say(this.keyLabel(rows[this.kIndex]), 'narrator'); }
    if (this.t < 0.2) return true;
    if (back) { this.page = 'main'; this.msg = ''; this.t = 0; this.render(); return true; }
    if (!d.okPressed) return true;
    const k = rows[this.kIndex];
    this.game.audio.play('select');
    if (k === 'back') { this.page = 'main'; this.msg = ''; this.t = 0; this.render(); return true; }
    if (k === 'reset') {
      const s = this.s;
      if (d.type === 'keyboard') { const keys = { ...s.keys }; delete keys[d.scheme.id]; this.set({ keys }); } else this.set({ pad: null });
      this.game.applyDeviceSettings?.(true);
      this.msg = '';
      this.render();
      return true;
    }
    this.capture = k;
    this.page = 'capture';
    this.msg = '';
    this.wait = true; // wait until the button that chose the row is let go
    this.render();
    if (voiceOn()) say(t('keys.press', { what: this.keyLabel(k) }), 'narrator');
    return true;
  }

  updateCapture() {
    const d = this.dev;
    const input = this.game.input;
    const done = (msg = '') => { this.page = 'keys'; this.msg = msg; this.t = 0; this.render(); };
    if (d.type === 'keyboard') {
      if (input.escPressed) { done(); return; }
      if (this.wait) { this.wait = false; return; }
      const code = [...input.pressed][0];
      if (!code) return;
      this.assignKey(code, done);
      return;
    }
    if (!d.connected || d.rawPressed.start) { done(); return; }
    if (this.wait) { if (!REMAP_PAD.some((b) => d.raw[b])) this.wait = false; return; }
    const phys = REMAP_PAD.find((b) => d.rawPressed[b]);
    if (phys) this.assignPad(phys, done);
  }

  assignKey(code, done) {
    const scheme = this.dev.scheme;
    const what = this.capture;
    const cur = schemeKeys(this.s, scheme);
    const name = keyName(code);
    if (RESERVED_KEYS.has(code)) { this.game.audio.play('bump'); done(t('keys.reserved', { key: name })); return; }
    const owner = schemeKeyOwner(code);
    const mine = ['a', 'b', 'c'].find((b) => cur[b][0] === code);
    if (!mine && owner && (owner.id !== scheme.id || ['up', 'down', 'left', 'right'].includes(owner.k))) {
      // another scheme's key (or this scheme's stick), unless this scheme moved that button away already
      this.game.audio.play('bump');
      done(t('keys.taken', { key: name, dev: deviceLabel(owner.id) }));
      return;
    }
    const next = { a: cur.a[0], b: cur.b[0], c: cur.c[0] };
    if (mine) next[mine] = next[what]; // swap with the button that had it
    next[what] = code;
    this.set({ keys: { ...this.s.keys, [scheme.id]: next } });
    this.game.applyDeviceSettings?.(true);
    this.game.audio.play('join');
    done(t('keys.set', { what: this.keyLabel(what), key: name }));
  }

  assignPad(phys, done) {
    const what = this.capture;
    const map = Object.fromEntries(REMAP_PAD.map((b) => [b, this.s.pad?.[b] || b]));
    const other = REMAP_PAD.find((b) => map[b] === phys);
    map[other] = map[what]; // swap
    map[what] = phys;
    const identity = REMAP_PAD.every((b) => map[b] === b);
    this.set({ pad: identity ? null : map });
    this.game.applyDeviceSettings?.(true);
    this.game.audio.play('join');
    done(t('keys.set', { what: this.keyLabel(what), key: padNames(this.dev)[phys] }));
  }

  close() {
    this.el?.remove();
    this.el = null;
    const tg = this.target;
    this.game.ui.toast(tg.id ? t('assist.saved.profile', { name: tg.name }) : t('assist.saved.device'), 2000);
    this.game.applyScreenSettings?.();
    this.onClose?.();
  }
}

/**
 * The gentle offer after repeated tries (core/assist.js struggle()): a small card, read aloud.
 * "Yes please" turns the assist on (or skips the part), "No thanks" closes it, "Don't ask again" saves that.
 * It waits a moment before it listens, so a child still pressing jump does not answer by accident.
 */
export class OfferCard {
  constructor(game, { kind, player, skip = null, onClose = null }) {
    this.game = game;
    this.kind = kind;
    this.player = player;
    this.skip = skip;
    this.onClose = onClose;
    this.index = 0;
    this.t = 0;
    this.items = ['yes', 'no', 'never'];
    this.el = game.ui.panel('', 'panel pause offer-panel');
    this.render();
    game.audio.play('select');
    if (voiceOn()) say(`${t(`offer.${kind}`)} ${t('offer.yes')}? ${t('offer.no')}? ${t('offer.never')}?`, 'narrator');
  }

  get targetId() { return this.player?.profileId || ''; }

  render() {
    const items = this.items.map((k, i) => `<div class="pause-item ${i === this.index ? 'on' : ''}">${esc(t(`offer.${k}`))}</div>`).join('');
    this.el.innerHTML = `<div class="offer-icon">🙌</div><div class="offer-q">${esc(t(`offer.${this.kind}`))}</div>
      <div class="pause-list">${items}</div><div class="results-footer">${esc(t('offer.hint'))}</div>`;
  }

  update(dt) {
    this.t += dt;
    for (const d of menuDevices(this.game)) {
      if (d.stepY) { this.index = (this.index - d.stepY + 3) % 3; this.game.audio.play('select'); this.render(); if (voiceOn()) say(t(`offer.${this.items[this.index]}`), 'narrator'); }
      if (this.t < 0.9) continue;
      if (d.backPressed || this.game.input.escPressed) { this.answer('no'); return; }
      if (d.okPressed) { this.answer(this.items[this.index]); return; }
    }
  }

  answer(k) {
    const s = profileSettings(this.targetId);
    const names = { timing: 'assist.timing', aim: 'assist.aim', speed: 'assist.speed' };
    this.el?.remove();
    this.el = null;
    if (k === 'yes') {
      this.game.audio.play('join');
      if (this.kind === 'skip') {
        this.game.ui.toast(t('offer.skipped'), 2400);
        this.skip?.();
      } else {
        const patch = this.kind === 'timing' ? { timing: true } : this.kind === 'aim' ? { aim: Math.min(2, s.aim + 1) } : { speed: 0.75 };
        saveSettings(this.targetId, { ...s, ...patch });
        this.game.applyScreenSettings?.();
        const msg = t('offer.on', { what: t(names[this.kind]) });
        this.game.ui.toast(msg, 3200);
        if (voiceOn()) say(msg, 'narrator');
      }
    } else if (k === 'never') {
      saveSettings(this.targetId, { ...s, never: [...new Set([...s.never, this.kind])] });
    }
    this.onClose?.();
  }
}
