// SPDX-License-Identifier: AGPL-3.0-or-later
// A LANGUAGE NO VOICE SPEAKS, MOUNTED (ADR-0185 §4; issue #180): in a real `createGame`, the four speech rows of the hearing
// panel and the narration button of the quick bar are locked with the reason, never hidden.
//
// 📌 THE VOICES ARE THE DEVICE'S (ADR-0200): the engine lists the browser's voices for the page's language, and Kokoro's only
// where the game declares a neural voice. So «a language no voice speaks» is a device that lists none for it — GitHub's Linux
// runner lists none at all, headless Chromium on Windows two for pt-BR — and the case lends a host whose speech engine lists
// none, instead of reading the machine's. Voices that arrive or leave while the panel is open are
// `voices-that-arrive-late.browser`; the narration's side of the lock is in `voice-per-language.node`.
import { describe, it, expect, beforeAll } from 'vitest';
import { SEM_ASSUNTO } from './fixtures/accommodation-answers.js';

class HostUtterance { constructor(text) { this.text = text; this.lang = ''; this.voice = null; this.volume = 0; this.rate = 0; } }
/** The real window, with a speech engine that lists no voice answering first; every other method bound to the window. */
const voicelessHost = () => {
  const own = { speechSynthesis: { cancel() {}, speak() {}, getVoices: () => [], onvoiceschanged: null }, SpeechSynthesisUtterance: HostUtterance };
  return new Proxy(window, {
    get(target, prop) {
      if (Object.hasOwn(own, prop)) return own[prop];
      const v = Reflect.get(target, prop);
      return typeof v === 'function' && !Object.hasOwn(v, 'prototype') ? v.bind(target) : v;
    },
  });
};

let motor;
const declaracao = () => ({
  topology: () => ({ kind: 'hotspots', order: ['q1'] }), holdsAtOnce: () => 1, holdsKeys: () => false, tick: 'player',
  world: () => ({ kind: 'element', selector: '#game-region' }), roleAt: () => 'goal',
  nameAt: () => ({ text: 'a', gender: 'f', plural: false }), focusOf: () => null,
  objectiveOf: () => ({ name: { text: 'a', gender: 'f', plural: true }, have: 0, need: 1 }), targetsOf: () => [],
});
const esperar = (ms = 30) => new Promise((r) => setTimeout(r, ms));

beforeAll(async () => {
  document.body.innerHTML = '<p id="sr-status" role="status"></p><p id="sr-alert" role="alert"></p>'
    + '<div id="game-region" tabindex="-1"></div><div id="title-icons"></div>';
  const { createGame } = await import('../app/js/boot/create-game.js');
  motor = createGame({ accommodations: SEM_ASSUNTO, declaration: declaracao(), host: { doc: document, win: voicelessHost() }, downloadHeavy: false, players: [{ ctrl: 0 }] });
});

describe('a language no voice speaks', () => {
  it('🔴 [Right] the four speech rows are locked with the reason, and still shown', () => {
    motor.pause.show(0);
    document.querySelector('#vp-pause-0 .pm-btn[data-act="options"]').click();
    document.querySelector('#vp-pause-0 .pm-btn[data-act="audio"]').click();
    for (const id of ['#opt-tts', '#tts-vol', '#opt-menuindex', '#tts-voz']) {
      const el = document.querySelector('#audio ' + id);
      expect(el, id + ' missing').not.toBeNull();
      expect(el.getAttribute('aria-disabled'), id + ' not locked').toBe('true');
      expect(el.dataset.motivo ?? '', id + ' without its reason').not.toBe('');
      expect(el.closest('[hidden]'), id + ' hidden instead of locked').toBeNull();
    }
  });

  it('🔴 [Right] the quick bar\'s narration button is locked, and pressing it says why', async () => {
    const botao = document.querySelector('#title-icons .pi-btn[data-pi="tts"]');
    expect(botao, 'no narration button on the bar').not.toBeNull();
    expect(botao.getAttribute('aria-disabled'), 'the bar\'s button is not locked').toBe('true');
    botao.click();
    await esperar();
    const dito = document.getElementById('sr-alert').textContent + document.getElementById('sr-status').textContent;
    expect(dito, 'refused in silence').toMatch(/Não há voz/);
  });
});

// ============================== MUTATIONS CHECKED ==============================
// With the voiceless host lent instead of the engine's `tts` patched (2026-09-26), each case still goes red on its own: the
// panel's `noVoice` answering `false` reddens the rows, the root's `noVoice` for the bar answering `false` reddens the button.
