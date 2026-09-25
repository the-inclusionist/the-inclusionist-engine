// SPDX-License-Identifier: AGPL-3.0-or-later
// Tests of platform/tts that only the BROWSER proves: that narration speaks in the GAME'S LANGUAGE.
//
// WHY NOT IN THE node project. Switching language goes through `setLocale`, which reapplies the DOM (`applyDom`), writes
// `<html lang>` and fires a CustomEvent — three things that do not exist in node. The node test checks `spoke[0].lang`,
// but against the literal 'pt-BR': it would pass identically with a HARD-CODED value, because the default language is
// Portuguese. A case that cannot fail for the reason it declares is what these files exist not to have.
//
// THE DEFECT THIS PINS. A fixed `u.lang = 'pt-BR'` would, with the game in English, ask the browser for a PORTUGUESE voice
// for a text that is not Portuguese — and the result is not an accent, it is unintelligible: one language's phonetics
// applied to another's spelling. For whoever depends on narration to play, it is the same as having no narration at all.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTts } from '../app/js/platform/tts.js';
import { createTranslator } from '../app/js/core/i18n.js';
import { createStorage, memoryBackend } from '../app/js/platform/storage.js';
import { setLocale, getLocale, bcp47 } from '../app/js/core/i18n.js';

let spoke;
const ORIGINAL = { utter: globalThis.SpeechSynthesisUtterance, synth: window.speechSynthesis };

beforeEach(() => {
  spoke = [];
  // Chromium's real SpeechSynthesis does not speak in CI and does not expose the utterance; both are replaced by the
  // minimum `speakWebSpeech` touches, so what was asked of the browser can be READ.
  Object.defineProperty(window, 'speechSynthesis', {
    configurable: true,
    // one browser voice per language: a language with no voice at all has narration locked (ADR-0185 §4, ADR-0207)
    value: { cancel: () => {}, speak: (u) => spoke.push(u), getVoices: () => [{ name: 'A', lang: 'pt-BR' }, { name: 'B', lang: 'en-US' }, { name: 'C', lang: 'es-ES' }] },
  });
  globalThis.SpeechSynthesisUtterance = class {
    constructor(t) { this.text = t; this.lang = ''; this.rate = 0; this.volume = 0; this.voice = null; }
  };
});

afterEach(async () => {
  globalThis.SpeechSynthesisUtterance = ORIGINAL.utter;
  Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: ORIGINAL.synth });
  await setLocale('pt'); // the language is MODULE state: without this, the next file inherits the last locale
});

function tts() {
  return createTts({
    store: createStorage(memoryBackend()),
    translator: createTranslator(), // the root's translator, played by the test (ADR-0232 D3)
    srSay: () => {}, srAlert: () => {},
    ensureAC: () => null, catNode: () => null, audioOut: () => null,
    getSoundOn: () => true, getVolume: () => 0.6,
    getAudioCat: () => ({ tts: { on: true, vol: 1 } }),
    // the browser's speech, lent the way the root lends it (ADR-0232 D4) — read at each utterance, so the replacements above count
    speech: { synth: () => window.speechSynthesis, utterance: (t) => new globalThis.SpeechSynthesisUtterance(t) },
    now: () => performance.now(), createAudio: () => document.createElement('audio'),
    loadKokoro: () => new Promise(() => {}), // required; this file declares no neural voice
  });
}

describe('platform/tts — a narração fala o idioma do jogo', () => {
  it('[Right] o idioma da fala SEGUE o locale: pt-BR · en-US · es-MX', async () => {
    for (const [loc, esperado] of [['pt', 'pt-BR'], ['en', 'en-US'], ['es', 'es-MX']]) {
      await setLocale(loc);
      spoke.length = 0;
      tts().narrate('teste');
      expect(spoke.length, `nada foi falado em ${loc}`).toBe(1);
      expect(spoke[0].lang, `idioma da fala em ${loc}`).toBe(esperado);
    }
  });

  it('[Invariant] a etiqueta pedida ao navegador é SEMPRE a de core/i18n, nunca uma cópia', () => {
    // What prevents the regression: if someone hard-codes 'pt-BR' again, this case goes red in en and es — and the
    // assertion does not repeat the tag, it fetches it from the single source.
    tts().narrate('x');
    expect(spoke[0].lang).toBe(bcp47(getLocale()));
  });

  it('[Boundary] cada idioma leva a região da sua bandeira: pt-BR, en-US, es-MX', async () => {
    // English and Spanish went without a region, for the browser to pick the variant. The language button names a place
    // (the Dev, 2026-09-16: «Cada bandeira indica a localização para qual o app está configurado»), so the tag says it too.
    expect(bcp47('pt')).toBe('pt-BR');
    expect(bcp47('en')).toBe('en-US');
    expect(bcp47('es')).toBe('es-MX');
  });

  it('[Interface] `<html lang>` e a fala usam a MESMA etiqueta — uma regra, dois consumidores', async () => {
    await setLocale('es');
    tts().narrate('x');
    expect(document.documentElement.lang).toBe('es-MX');
    expect(spoke[0].lang).toBe(document.documentElement.lang);
  });
});
