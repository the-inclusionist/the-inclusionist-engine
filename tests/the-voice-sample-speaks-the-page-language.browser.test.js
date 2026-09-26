// SPDX-License-Identifier: AGPL-3.0-or-later
// THE «TEST VOICE» SAMPLE SPEAKS THE PAGE'S LANGUAGE (ADR-0185; the frontier of CLAUDE.md: the interface's language is the
// child's language).
//
// 🔴 The root's `speech.speakSample` port — what the hearing panel's «test voice» button (`#opt-tts-test`, `ui/voice-settings`)
// speaks through when the browser's synthesiser is the engine — set `u.lang = 'pt-BR'` whatever the page's language. The sample's
// TEXT comes from the page's dictionary, so on an English page the browser was asked for a PORTUGUESE voice to read English
// words, and with no voice chosen that is what it picked: the wrong phonetics on the wrong letters, the one sentence whose whole
// job is to let the child judge the voice.
//
// 📌 THE ROOT'S PORT, DRIVEN THROUGH `createGame`: `tests/voice-settings.browser.test.js` fakes the ports, so it cannot see what
// the root puts in the utterance. The engine's own panel does not build `#opt-tts-test` (the SAIRAM list of
// `tests/panel-widgets.browser.test.js`); a page that carries it, as this host does, gets it wired by the root.
//
// ⚠️ `gameSay` (platform/speech) is NOT this: it is the LITERACY voice, in the language the game says its word is in (ADR-0243 §4).
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SEM_ASSUNTO } from './fixtures/accommodation-answers.js';
import { bcp47 } from '../app/js/core/i18n.js';

let createGame;

/** The keys a case here writes or reads: the language, and the three voice choices a case must not inherit. */
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

/*
 * THE VOICES ARE THE CASE'S, NEVER THE MACHINE'S: headless Chromium on Windows lists two pt-BR voices, GitHub's Linux runner
 * none. And nothing speaks aloud: `speak` RECORDS the utterance, which is all a case here asks of it.
 */
class HostUtterance { constructor(text) { this.text = text; this.lang = ''; this.voice = null; this.volume = 0; this.rate = 0; } }
function speakingHost(voices) {
  const spoken = [];
  const synth = { cancel() {}, speak(u) { spoken.push(u); }, getVoices: () => voices, onvoiceschanged: null };
  return { spoken, synth, win: hostWith({ speechSynthesis: synth, SpeechSynthesisUtterance: HostUtterance }) };
}
const LUCIANA = { name: 'Luciana', lang: 'pt-BR' };
const SAMANTHA = { name: 'Samantha', lang: 'en-US' };

let raiz;
let motor;
/** A page that carries the sample button and the system-voice list, and a root over the lent host. */
async function open(voices) {
  raiz = document.createElement('div');
  raiz.innerHTML = '<p id="sr-status" role="status"></p><p id="sr-alert" role="alert"></p>'
    + '<div id="game-region" tabindex="-1"></div><div id="title-icons"></div>'
    + '<select id="tts-voice"></select><button id="opt-tts-test" type="button"></button>';
  document.body.appendChild(raiz);
  const host = speakingHost(voices);
  motor = createGame({ accommodations: SEM_ASSUNTO, declaration: declaration(), host: { doc: document, win: host.win }, downloadHeavy: false });
  await motor.localeReady();
  // the device's voice list arriving — the path by which a page's system-voice list picks its voice (`populateTtsVoices`)
  host.synth.onvoiceschanged?.();
  return host;
}
/** Presses «test voice» and returns the one utterance it sent to the browser. */
function sample(host) {
  const before = host.spoken.length;
  document.getElementById('opt-tts-test').click();
  expect(host.spoken.length - before, 'the button sent no utterance — the case would measure nothing').toBe(1);
  return host.spoken.at(-1);
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

describe('the «test voice» sample speaks the page\'s language', () => {
  it('🔴 [Right] on an English page the sample is English text asked for in English — not in pt-BR', async () => {
    localStorage.setItem('incl_lang', 'en');
    const host = await open([LUCIANA, SAMANTHA]);
    expect(motor.locale(), 'the en chunk did not load; the case would measure nothing').toBe('en');
    const u = sample(host);
    expect(u.text).toBe(motor.t('audio.voiceSample'));
    expect(u.lang, 'English words asked of the browser in another language').toBe(bcp47('en'));
  });

  it('🔴 [Right] after a language switch the NEXT sample follows the new language, both ways', async () => {
    const host = await open([LUCIANA, SAMANTHA]);
    expect(motor.locale()).toBe('pt');
    expect(sample(host).lang).toBe(bcp47('pt'));
    await motor.setLocale('es');
    const es = sample(host);
    expect(es.text).toBe(motor.t('audio.voiceSample'));
    expect(es.lang, 'the sample stayed in the language it was wired in').toBe(bcp47('es'));
    await motor.setLocale('en');
    const en = sample(host);
    expect(en.lang).toBe(bcp47('en'));
    // the voice picked while the page was Portuguese does not read the English sample
    expect(en.voice?.lang ?? '', 'a Portuguese voice was handed the English sample').not.toMatch(/^pt/i);
    await motor.setLocale('pt');
  });

  it('🔴 [Right] a voice of ANOTHER language is neither offered nor asked for — the button locks with the speech rows', async () => {
    // The device speaks only Portuguese; the page is English. The page's system-voice list offers only the page's language
    // (`pickVoicesFor`, ADR-0185 — it used to fall back to every voice and CHOOSE Luciana), and with no voice of the language the
    // «test voice» button locks like the speech rows (ADR-0185 §4): a press says why and asks the browser for nothing, where it
    // used to send the English sample for the browser to read with whatever voice it had. The root's own guard, the last place
    // that can refuse a voice of another language, is held by the language-switch case above.
    localStorage.setItem('incl_lang', 'en');
    const host = await open([LUCIANA]);
    const offered = [...document.getElementById('tts-voice').options].map((o) => o.value);
    expect(offered, 'a Portuguese voice was offered to read English').not.toContain('Luciana');
    const button = document.getElementById('opt-tts-test');
    expect(button.getAttribute('aria-disabled'), 'the sample button was left unlocked').toBe('true');
    button.click();
    expect(host.spoken, 'an English sample was asked of a device with no English voice').toEqual([]);
  });

  it('🔴 [Right] a chosen voice of the page\'s language IS handed to the sample — the fix does not drop every voice', async () => {
    localStorage.setItem('incl_lang', 'en');
    const host = await open([LUCIANA, SAMANTHA]);
    expect(document.getElementById('tts-voice').value).toBe('Samantha');
    expect(sample(host).voice).toBe(SAMANTHA);
  });

  it('🔴 [Boundary] an Android-style tag (`en_US`) is the same language as `en-US`', async () => {
    const android = { name: 'English (United States)', lang: 'en_US' };
    localStorage.setItem('incl_lang', 'en');
    const host = await open([LUCIANA, android]);
    expect(document.getElementById('tts-voice').value).toBe(android.name);
    expect(sample(host).voice).toBe(android);
  });
});

// ===== MUTATIONS CHECKED (2026-09-26) =====
// Applied one at a time (1–4 to the root's `speakSample` in `boot/create-game.ts`, 5 to `platform/tts.ts`), each restored and
// verified by hash:
// 1. `u.lang = 'pt-BR'` (the defect)                              → red: the English page, the switch, the other-language voice
// 2. the chosen voice handed over with no language guard          → red: the switch (the voice picked in pt outlives it), the
//                                                                    other-language voice
// 3. the guard refusing every voice                               → red: the same-language voice, the `en_US` voice
// 4. the language read once, at the first press                   → red: the switch
// 5. the engine's voice list reading tags without `_` → `-`       → red: the `en_US` voice
// After `pickVoicesFor` stopped falling back to every voice (ADR-0185, 2026-09-26), measured again the same way:
// 2. again                                                         → red: the switch (now the only path to that guard)
// 6. `pickVoicesFor`'s fallback to the whole list restored        → red: the other-language voice
// 7. `#opt-tts-test` left out of the locked rows (`ui/voice-settings`) → red: the other-language voice
