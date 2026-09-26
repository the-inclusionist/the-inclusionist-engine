// SPDX-License-Identifier: AGPL-3.0-or-later
// VOICES THAT ARRIVE LATE, MOUNTED (ADR-0185 §4 and its erratum of 2026-09-26): in a real `createGame`, the lock of the speech
// rows and of the bar's 🗣 follows the DEVICE's voices, both ways, while the child is looking.
//
// 📏 A device may list its voices a moment after load: `speechSynthesis.getVoices()` answers `[]` first, then fills and fires
// `voiceschanged`. Headless Chromium on Windows measured this way, and so do some Chromebooks. Before the erratum a hearing panel
// opened in that moment kept its speech rows locked until it was drawn again, and the 🗣 stayed greyed out until the bar's next
// sync: a child whose device HAS a voice was told narration was unavailable.
//
// 📌 A plain object and not the real `speechSynthesis`, as in `boot-create-game.browser`: the case decides when the voices
// arrive and when they leave, and nothing speaks aloud.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SEM_ASSUNTO } from './fixtures/accommodation-answers.js';
import { createTranslator } from '../app/js/core/i18n.js';

const { t } = createTranslator(); // pt, the suite's language

let createGame;
const openRoots = [];

const declaration = () => ({
  topology: () => ({ kind: 'hotspots', order: ['q1'] }), holdsAtOnce: () => 1, holdsKeys: () => false, tick: 'player',
  world: () => ({ kind: 'element', selector: '#game-region' }), roleAt: () => 'goal',
  nameAt: () => ({ text: 'a', gender: 'f', plural: false }), focusOf: () => null,
  objectiveOf: () => ({ name: { text: 'a', gender: 'f', plural: true }, have: 0, need: 1 }), targetsOf: () => [],
});

class HostUtterance { constructor(text) { this.text = text; this.lang = ''; this.voice = null; this.volume = 0; this.rate = 0; } }

/** A speech engine whose voice list the case fills and empties, firing `voiceschanged` as a browser does. */
function lateSpeech(initial = []) {
  let voices = initial;
  const synth = { cancel() {}, speak() {}, getVoices: () => voices, onvoiceschanged: null };
  return {
    synth,
    arrive(list) { voices = list; synth.onvoiceschanged?.(new Event('voiceschanged')); },
  };
}

/** The real window, with the speech engine answering first; every other method bound to the window. */
const hostWith = (own) => new Proxy(window, {
  get(target, prop) {
    if (Object.hasOwn(own, prop)) return own[prop];
    const v = Reflect.get(target, prop);
    return typeof v === 'function' && !Object.hasOwn(v, 'prototype') ? v.bind(target) : v;
  },
});

const MARIA = { name: 'Microsoft Maria - Portuguese (Brazil)', lang: 'pt-BR' };
const DANIEL = { name: 'Microsoft Daniel - Portuguese (Brazil)', lang: 'pt-BR' };
const SPEECH_ROWS = ['#opt-tts', '#tts-vol', '#tts-ppm', '#opt-menuindex', '#tts-voz'];

function mount(initial = []) {
  const speech = lateSpeech(initial);
  const motor = createGame({
    accommodations: SEM_ASSUNTO, declaration: declaration(), downloadHeavy: false, players: [{ ctrl: 0 }],
    host: { doc: document, win: hostWith({ speechSynthesis: speech.synth, SpeechSynthesisUtterance: HostUtterance }) },
  });
  openRoots.push(motor);
  return { motor, speech };
}

/** Opens the hearing panel the way a child does: pause, «Opções», «Acessibilidade auditiva». */
function openHearingPanel(motor) {
  motor.pause.show(0);
  document.querySelector('#vp-pause-0 .pm-btn[data-act="options"]').click();
  document.querySelector('#vp-pause-0 .pm-btn[data-act="audio"]').click();
}

const row = (id) => document.querySelector('#audio ' + id);
const footer = () => document.querySelector('#audio .opt-explain');
const barTts = () => document.querySelector('#title-icons .pi-btn[data-pi="tts"]');
const frame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));

/** Everything written into the two screen-reader regions from now on (the announcer empties, then writes on the next frame). */
function listen() {
  const said = [];
  const obs = new MutationObserver(() => {
    for (const id of ['sr-status', 'sr-alert']) {
      const text = document.getElementById(id).textContent;
      if (text) said.push(text);
    }
  });
  for (const id of ['sr-status', 'sr-alert']) obs.observe(document.getElementById(id), { childList: true, characterData: true, subtree: true });
  return { said, stop: () => obs.disconnect() };
}

beforeEach(async () => {
  if (!createGame) ({ createGame } = await import('../app/js/boot/create-game.js'));
  document.body.innerHTML = '<p id="sr-status" role="status"></p><p id="sr-alert" role="alert"></p>'
    + '<div id="game-region" tabindex="-1"></div><div id="title-icons"></div>';
});

afterEach(() => {
  for (const motor of openRoots.splice(0)) motor.dispose();
  document.querySelectorAll('[id^="vp-pause-"]').forEach((c) => c.remove());
});

describe('voices that arrive after the hearing panel opened', () => {
  it('🔴 [Right] the speech rows unlock IN PLACE: the same nodes, and the focus where it was', () => {
    const { motor, speech } = mount();
    openHearingPanel(motor);
    const before = SPEECH_ROWS.map(row);
    for (const [k, el] of before.entries()) expect(el?.getAttribute('aria-disabled'), SPEECH_ROWS[k] + ' not locked before the voices').toBe('true');
    row('#opt-tts').focus();

    speech.arrive([MARIA]);

    for (const [k, id] of SPEECH_ROWS.entries()) {
      const el = row(id);
      expect(el, id + ' was drawn again instead of unlocked').toBe(before[k]);
      expect(el.getAttribute('aria-disabled'), id + ' still locked with a voice on the device').toBeNull();
      expect(el.dataset.motivo, id + ' still carries the reason').toBeUndefined();
    }
    expect(document.activeElement, 'the focus left the row the child was on').toBe(before[0]);
    expect([...row('#tts-voz').options].map((o) => o.value), 'the «Voz» list still says there is none').toEqual(['webspeech:' + MARIA.name]);
  });

  it('🔴 [Right] the bar\'s 🗣 stops being greyed out when the voices arrive, without the bar being synced by anything else', () => {
    const { speech } = mount();
    expect(barTts().getAttribute('aria-disabled'), 'the 🗣 not locked before the voices').toBe('true');
    speech.arrive([MARIA]);
    expect(barTts().classList.contains('pi-dis'), 'the 🗣 still LOOKS locked').toBe(false);
    expect(barTts().getAttribute('aria-disabled'), 'the 🗣 still SAYS it is locked').toBeNull();
  });

  it('🔴 [Right] voices that LEAVE lock the rows again, with the reason, and grey the 🗣 — the focus where it was', () => {
    const { motor, speech } = mount([MARIA]);
    openHearingPanel(motor);
    const vol = row('#tts-vol');
    vol.focus();
    expect(vol.getAttribute('aria-disabled'), 'locked with a voice on the device').toBeNull();

    speech.arrive([]);

    for (const id of SPEECH_ROWS) {
      expect(row(id).getAttribute('aria-disabled'), id + ' not locked when the voices left').toBe('true');
      expect(row(id).dataset.motivo, id + ' locked without its reason').toBe(t('audio.semVoz'));
    }
    expect(document.activeElement).toBe(vol);
    expect(footer().textContent, 'the row under the cursor locked and its footer did not say why').toBe(t('audio.semVoz'));
    expect(barTts().getAttribute('aria-disabled'), 'the 🗣 not locked when the voices left').toBe('true');
    expect(barTts().classList.contains('pi-dis')).toBe(true);
  });
});

describe('what the child hears when the lock changes', () => {
  it('🔴 [Right] a row that unlocks UNDER the cursor says so, once — and its footer stops giving the reason', async () => {
    const { motor, speech } = mount();
    openHearingPanel(motor);
    row('#opt-tts').focus();
    expect(footer().textContent, 'precondition: the locked row\'s footer gives the reason').toBe(t('audio.semVoz'));
    await frame();
    const heard = listen();

    speech.arrive([MARIA]);
    await frame();
    heard.stop();

    expect(heard.said, 'the unlock under the cursor was silent').toEqual([t('audio.comVoz')]);
    expect(footer().textContent, 'the footer still says there is no voice, under a row that works').not.toBe(t('audio.semVoz'));
  });

  it('🔴 [Boundary] a lock that changes AWAY from the cursor says nothing: the child hears the row when she reaches it', async () => {
    const { motor, speech } = mount();
    openHearingPanel(motor);
    document.querySelector('#audio #opt-modocego').focus();
    await frame();
    const heard = listen();

    speech.arrive([MARIA]);
    await frame();
    heard.stop();

    expect(heard.said).toEqual([]);
  });

  it('🔴 [Boundary] voices that change WITHOUT changing the lock announce nothing and touch no row', async () => {
    const { motor, speech } = mount([MARIA]);
    openHearingPanel(motor);
    const tts = row('#opt-tts');
    tts.focus();
    footer().textContent = 'what the footer said';
    await frame();
    const heard = listen();

    speech.arrive([MARIA, DANIEL]); // a second voice: still unlocked
    const options = [...row('#tts-voz').options];
    speech.arrive([MARIA, DANIEL]); // the same list again
    await frame();
    heard.stop();

    expect(heard.said, 'a list that did not change the lock was announced').toEqual([]);
    expect(footer().textContent, 'a list that did not change the lock rewrote the footer').toBe('what the footer said');
    expect(document.activeElement).toBe(tts);
    expect(options.map((o) => o.value), 'the second voice is not offered').toEqual(['webspeech:' + MARIA.name, 'webspeech:' + DANIEL.name]);
    // the same voices draw nothing: the options the child may be reading stay the same nodes
    expect([...row('#tts-voz').options], 'the same voices drew the «Voz» list again').toEqual(options);
    expect(row('#tts-voz').options[0], 'the same voices drew the «Voz» list again').toBe(options[0]);
  });

  it('🔴 [Right] a row that locks under the cursor gives its reason ONCE — through the footer, not a second time aloud', async () => {
    const { motor, speech } = mount([MARIA]);
    openHearingPanel(motor);
    row('#opt-tts').focus();
    await frame();
    const heard = listen();

    speech.arrive([]);
    await frame();
    heard.stop();

    expect(footer().textContent).toBe(t('audio.semVoz'));
    expect(heard.said, 'the reason was said twice: by the footer and by the announcer').toEqual([]);
  });
});

describe('the page\'s one `onvoiceschanged` slot', () => {
  it('🔴 [Right] an ended root empties the slot it holds', () => {
    const { motor, speech } = mount();
    expect(speech.synth.onvoiceschanged, 'the root never listened for the voices').toBeTypeOf('function');
    motor.dispose();
    expect(speech.synth.onvoiceschanged).toBeNull();
  });

  it('🔴 [Boundary] an ended root leaves the slot to the root that took it after, and that root still follows the voices', () => {
    const speech = lateSpeech();
    const host = { doc: document, win: hostWith({ speechSynthesis: speech.synth, SpeechSynthesisUtterance: HostUtterance }) };
    const first = createGame({ accommodations: SEM_ASSUNTO, declaration: declaration(), downloadHeavy: false, players: [{ ctrl: 0 }], host });
    const second = createGame({ accommodations: SEM_ASSUNTO, declaration: declaration(), downloadHeavy: false, players: [{ ctrl: 0 }], host });
    openRoots.push(second);
    first.dispose();
    expect(speech.synth.onvoiceschanged, 'the ended root took the live root\'s slot with it').toBeTypeOf('function');
    speech.arrive([MARIA]);
    expect(barTts().getAttribute('aria-disabled'), 'the live root no longer follows the voices').toBeNull();
  });
});

// ============================== MUTATIONS CHECKED ==============================
// Applied one at a time by a script, each required to match exactly once, reverted from a copy and checked by hash:
//   · `voicesChanged` without `lockSpeechRows()`: the rows keep the lock of the first render (Right, both ways).
//   · the speech rows replaced by clones before the lock is drawn (a redraw): the nodes and the focus change.
//   · the lock drawn only when voices ARRIVE (`if (!noVoice())`): voices that leave leave the rows open.
//   · the root without its 🗣 subscription: the bar keeps the look of the boot.
//   · the flip test dropped (`if (true)`): a list that changes no lock rewrites the footer and speaks.
//   · the cursor test dropped (the first speech row, focused or not): a lock that changes away from the cursor speaks.
//   · no `audio.comVoz`: the unlock under the cursor is silent.
//   · no footer write on unlock: the footer goes on saying «no voice» under a row that works.
//   · no footer write on lock: the locked row under the cursor does not say why.
//   · the reason said aloud as well on lock: heard twice.
//   · the voice list never drawn on a change: the «Voz» list keeps saying there is none.
//   · the voice list drawn on every change: the same voices replace the options.
//   · the fan-out calling only its first listener: the panel no longer follows the voices.
//   · the release emptying the slot unconditionally: the live root loses it.
//   · the release never emptying the slot: an ended root goes on listening.
