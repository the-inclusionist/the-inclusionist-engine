// SPDX-License-Identifier: AGPL-3.0-or-later
// A SPOKEN TEXT CARRIES ITS LANGUAGE (ADR-0243), through `createGame`: what a game hands `Engine.tts.narrate` reaches the
// browser's speech as one utterance per part, each with its tag and a voice of its language, and a language switch moves the
// frame to the new language's voice.
//
// 📌 THE ROOT, NOT A FAKE CTX: `tests/a-spoken-text-carries-its-language.node.test.js` drives `platform/tts` with a lent port;
// this file drives the root a game gets, over a lent host whose speech synthesis offers voices of three languages and records
// every utterance. Nothing speaks aloud.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SEM_ASSUNTO } from './fixtures/accommodation-answers.js';

let createGame;

/** The keys a case here writes or reads: the language, and the voice choices a case must not inherit. */
const KEYS = ['incl_lang', 'incl_tts_engine', 'incl_tts_voice', 'incl_tts_voz'];
let kept = {};

const declaration = () => ({
  topology: () => ({ kind: 'hotspots', order: ['q1'] }), holdsAtOnce: () => 1, holdsKeys: () => false, tick: 'player',
  world: () => ({ kind: 'element', selector: '#game-region' }), roleAt: () => 'goal',
  nameAt: () => ({ text: 'pergunta', gender: 'f', plural: false }), focusOf: () => ({ id: 'p0', at: { x: 0, y: 0 }, heading: 'none' }),
  objectiveOf: () => ({ name: { text: 'perguntas', gender: 'f', plural: true }, have: 0, need: 1 }), targetsOf: () => [{ x: 0, y: 0 }],
});

/** The real window, with `own` answering first (the same lent host as `tests/boot-create-game.browser.test.js`). */
const hostWith = (own) => new Proxy(window, {
  get(target, prop) {
    if (Object.hasOwn(own, prop)) return own[prop];
    const v = Reflect.get(target, prop);
    return typeof v === 'function' && !Object.hasOwn(v, 'prototype') ? v.bind(target) : v;
  },
});

class HostUtterance { constructor(text) { this.text = text; this.lang = ''; this.voice = null; this.volume = 0; this.rate = 0; } }
function speakingHost(voices) {
  const spoken = [];
  const synth = { cancel() {}, speak(u) { spoken.push(u); }, getVoices: () => voices, onvoiceschanged: null };
  return { spoken, synth, win: hostWith({ speechSynthesis: synth, SpeechSynthesisUtterance: HostUtterance }) };
}
const LUCIANA = { name: 'Luciana', lang: 'pt-BR' };
const SAMANTHA = { name: 'Samantha', lang: 'en-US' };
const PAULINA = { name: 'Paulina', lang: 'es-MX' };

let raiz;
let motor;
async function open(voices) {
  raiz = document.createElement('div');
  raiz.innerHTML = '<p id="sr-status" role="status"></p><p id="sr-alert" role="alert"></p>'
    + '<div id="game-region" tabindex="-1"></div><div id="title-icons"></div>';
  document.body.appendChild(raiz);
  const host = speakingHost(voices);
  motor = createGame({ accommodations: SEM_ASSUNTO, declaration: declaration(), host: { doc: document, win: host.win }, downloadHeavy: false });
  await motor.localeReady();
  motor.audio.audioCat.tts.on = true; // narration is born off (the mixer's BORN_OFF); the child turned it on
  return host;
}

beforeEach(async () => {
  if (!createGame) ({ createGame } = await import('../app/js/boot/create-game.js'));
  kept = Object.fromEntries(KEYS.map((k) => [k, localStorage.getItem(k)]));
  for (const k of KEYS) localStorage.removeItem(k);
});
afterEach(() => {
  motor?.dispose(); motor = null;
  raiz?.remove(); document.querySelectorAll('[id^="vp-pause-"]').forEach((c) => c.remove());
  for (const k of KEYS) { if (kept[k] === null) localStorage.removeItem(k); else localStorage.setItem(k, kept[k]); }
});

describe('Engine.tts.narrate speaks parts, each in its own language', () => {
  it('🔴 [Right] an English word in a Portuguese activity is read by the English voice, between frames in Portuguese', async () => {
    const host = await open([LUCIANA, SAMANTHA, PAULINA]);
    expect(motor.locale()).toBe('pt');
    motor.tts.narrate([{ text: 'Escreva a palavra' }, { text: 'apple', language: 'en' }, { text: 'agora' }]);
    expect(host.spoken.map((u) => u.text)).toEqual(['Escreva a palavra', 'apple', 'agora']);
    expect(host.spoken.map((u) => u.voice)).toEqual([LUCIANA, SAMANTHA, LUCIANA]);
    expect(host.spoken[1].lang, 'the content part asked the browser for the wrong language').toBe('en');
  });

  it('🔴 [Right] a Portuguese literacy word inside an English interface keeps a Portuguese voice', async () => {
    localStorage.setItem('incl_lang', 'en');
    const host = await open([LUCIANA, SAMANTHA, PAULINA]);
    expect(motor.locale(), 'the en chunk did not load; the case would measure nothing').toBe('en');
    motor.tts.narrate([{ text: 'Spell the word' }, { text: 'lata', language: 'pt-BR' }]);
    expect(host.spoken.map((u) => u.voice)).toEqual([SAMANTHA, LUCIANA]);
  });

  it('🔴 [Right] §5 · after a language switch the frame is read by the new language\'s voice, not the one picked before', async () => {
    const host = await open([LUCIANA, SAMANTHA, PAULINA]);
    expect(motor.tts.setVoice('webspeech:Luciana'), 'the Portuguese voice was not chosen').toBe(true);
    await motor.setLocale('en');
    motor.tts.narrate('Hello');
    expect(host.spoken.at(-1).lang).toBe('en-US');
    expect(host.spoken.at(-1).voice, 'English narration came out of the pt-BR voice').toBe(SAMANTHA);
    await motor.setLocale('pt');
    motor.tts.narrate('Olá');
    expect(host.spoken.at(-1).voice, 'the stored choice was lost on the way back').toBe(LUCIANA);
  });
});

describe('§3 · a language the device has no voice for', () => {
  const noVoiceLines = () => motor.problems.filter((l) => /lacks a voice for/.test(l));

  it('🔴 [Right] the part is not spoken, the interface says so in its language and voice, and `problems` gets ONE line', async () => {
    const host = await open([LUCIANA, SAMANTHA]); // no Spanish voice
    motor.tts.narrate([{ text: 'Leia' }, { text: 'manzana', language: 'es' }]);
    expect(host.spoken.map((u) => u.text)).toEqual(['Leia', motor.t('sr.tts.noVoiceForLanguage', { language: 'espanhol' })]);
    expect(host.spoken[1].voice).toBe(LUCIANA);
    expect(noVoiceLines(), 'the root did not write the line').toHaveLength(1);
    expect(noVoiceLines()[0]).toMatch(/Spanish \(es\).*install a voice for Spanish on the device/);
    motor.tts.narrate([{ text: 'pera', language: 'es-MX' }]);
    expect(host.spoken).toHaveLength(2);
    expect(noVoiceLines(), 'the line was written twice').toHaveLength(1);
  });

  it('🔴 [Right] in an English interface the notice is English, naming the language in English', async () => {
    localStorage.setItem('incl_lang', 'en');
    const host = await open([LUCIANA, SAMANTHA]);
    expect(motor.locale()).toBe('en');
    motor.tts.narrate([{ text: 'manzana', language: 'es' }]);
    expect(host.spoken.map((u) => u.text)).toEqual([motor.t('sr.tts.noVoiceForLanguage', { language: 'Spanish' })]);
    expect(host.spoken[0].text).toMatch(/Spanish/);
    expect(host.spoken[0].voice).toBe(SAMANTHA);
  });
});

// ===== MUTATIONS CHECKED (2026-09-26) =====
// Applied one at a time by a script that counts the occurrences before replacing, each restored from a copy and checked by SHA-256:
// 1. every part read as frame (`platform/tts.ts`)                      → red: the English word, the Portuguese literacy word
// 2. the stale voice object kept after a switch (the §5 defect)        → red: the switch
// 3. `voiceOfLanguage` without the language filter                     → red: the English word
// §3: 4. the line not reported · 5. the root not wiring `report` (`boot/create-game.ts`) · 6. said and written at every part
//     → red: the ONE line. 7. the notice not said · 8. a part with no voice read by the interface's voice → red: both §3 cases.
//     9. the language named in English whatever the interface → red: the Portuguese notice.
