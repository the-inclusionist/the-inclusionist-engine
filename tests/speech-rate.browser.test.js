// SPDX-License-Identifier: AGPL-3.0-or-later
// THE SPEECH RATE, MOUNTED (ADR-0183 §1; issue #179): a list in the hearing panel, stored, and a neural utterance played at the
// child's rate over the voice's own — measured on the utterance — through a media element that keeps the pitch.
//
// MUTATIONS CHECKED — at the end of the file (the measuring itself is `ritmo-da-fala.node`).
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { SEM_ASSUNTO } from './fixtures/accommodation-answers.js';

// The game declares `uses: { neuralVoice: true }` and the ENGINE loads the voice (ADR-0216 §1), so what a case replaces is the
// loader and not a port. ten words in 2 s of speech between 0.5 s silent ends: the voice says 300 words a minute.
vi.mock('../app/js/platform/kokoro-runtime.js', () => ({
  loadKokoroRuntime: async () => ({
    phonemize: async () => 'a', vocabulary: async () => ({ a: 1 }), voice: async () => new Float32Array(256),
    session: async () => ({ synthesize: async () => waveform(0.5, 2, 0.5) }),
  }),
}));

let motor;
const guardados = {};
const CHAVES = ['incl_speech_ppm', 'incl_tts_voz', 'incl_tts_engine'];
const tocados = [];
const playOriginal = HTMLMediaElement.prototype.play;

/** A Kokoro waveform at 24 kHz: `antes` s of silence, `fala` s of a tone, `depois` s of silence. */
function waveform(before, speech, after, rate = 24000) {
  const n = Math.round((before + speech + after) * rate);
  return Float32Array.from({ length: n }, (_, i) => { const t = i / rate; return t >= before && t < before + speech ? Math.sin(2 * Math.PI * 220 * t) * 0.5 : 0; });
}

const declaracao = () => ({
  topology: () => ({ kind: 'hotspots', order: ['q1'] }), holdsAtOnce: () => 1, holdsKeys: () => false, tick: 'player',
  world: () => ({ kind: 'element', selector: '#game-region' }), roleAt: () => 'goal',
  nameAt: () => ({ text: 'a', gender: 'f', plural: false }), focusOf: () => null,
  objectiveOf: () => ({ name: { text: 'a', gender: 'f', plural: true }, have: 0, need: 1 }), targetsOf: () => [],
});

// The neural path, measured on a browser that offers no voice: where it offers one, it speaks first (ADR-0200)
const getVoicesOriginal = window.speechSynthesis.getVoices;
beforeAll(async () => {
  window.speechSynthesis.getVoices = () => [];
  for (const k of CHAVES) { guardados[k] = localStorage.getItem(k); localStorage.removeItem(k); }
  HTMLMediaElement.prototype.play = function () { tocados.push(this); return Promise.resolve(); };
  document.body.innerHTML = '<p id="sr-status" role="status"></p><p id="sr-alert" role="alert"></p>'
    + '<div id="game-region" tabindex="-1"></div><div id="title-icons"></div>';
  const { createGame } = await import('../app/js/boot/create-game.js');
  motor = createGame({
    accommodations: SEM_ASSUNTO, declaration: declaracao(), host: { doc: document, win: window }, downloadHeavy: false, players: [{ ctrl: 0 }],
    uses: { neuralVoice: true },
  });
});
afterAll(() => {
  window.speechSynthesis.getVoices = getVoicesOriginal;
  HTMLMediaElement.prototype.play = playOriginal;
  for (const k of CHAVES) { if (guardados[k] === null) localStorage.removeItem(k); else localStorage.setItem(k, guardados[k]); }
});

describe('the speech rate in the hearing panel', () => {
  it('🔴 [Right] is a list of the six steps, «N PPM», starting at the normal 254 (ADR-0196)', () => {
    const sel = document.querySelector('#audio #tts-ppm');
    expect(sel, 'no «Ritmo da fala» row in the hearing panel').not.toBeNull();
    motor.pause.show(0);
    document.querySelector('#vp-pause-0 .pm-btn[data-act="options"]').click();
    document.querySelector('#vp-pause-0 .pm-btn[data-act="audio"]').click();
    expect(sel.tagName).toBe('SELECT');
    expect([...sel.options].map((o) => o.value)).toEqual(['254', '304', '354', '404', '454', '504']);
    expect(sel.options[0].textContent).toMatch(/254 PPM/);
    expect(sel.value).toBe('254');
  });

  it('🔴 [Right] a choice is stored', () => {
    const sel = document.querySelector('#audio #tts-ppm');
    sel.value = '404';
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    expect(localStorage.getItem('incl_speech_ppm')).toBe('404');
    sel.value = '254';
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    expect(localStorage.getItem('incl_speech_ppm')).toBe('254');
  });

  it('🎯 [Zero] the language has a voice: the rate row is not locked', () => {
    expect(document.querySelector('#tts-ppm').getAttribute('aria-disabled')).toBeNull();
  });
});

describe('a neural utterance at the child\'s rate', () => {
  it('🔴 [Right] ten words in 2 s of speech (300 PPM) at the normal 254 play at the voice\'s own speed, never slowed, the pitch kept', async () => {
    motor.tts.ttsSpeak('um dois três quatro cinco seis sete oito nove dez'); // starts loading the voice
    for (let i = 0; i < 80 && !motor.tts.getEngine(); i++) await new Promise((r) => setTimeout(r, 25));
    expect(motor.tts.getEngine(), 'the fake neural voice did not load').toBeTruthy();
    const antes = tocados.length;
    motor.tts.ttsSpeak('um dois três quatro cinco seis sete oito nove dez');
    for (let i = 0; i < 80 && tocados.length === antes; i++) await new Promise((r) => setTimeout(r, 25));
    const el = tocados.at(-1);
    expect(el, 'nothing played').toBeTruthy();
    expect([el.playbackRate, el.preservesPitch]).toEqual([1, true]);
  });

  it('🔴 [Right] the rate follows the choice: at 504 PPM the same utterance plays faster than the voice', async () => {
    const sel = document.querySelector('#audio #tts-ppm');
    sel.value = '504';
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    const antes = tocados.length;
    motor.tts.ttsSpeak('um dois três quatro cinco seis sete oito nove dez');
    for (let i = 0; i < 80 && tocados.length === antes; i++) await new Promise((r) => setTimeout(r, 25));
    expect(tocados.at(-1).playbackRate).toBeCloseTo(504 / 300, 4);
  });

  it('⚠️ [Boundary] a one-word utterance takes the voice\'s measured average instead of its own silent ends', async () => {
    const antes = tocados.length;
    motor.tts.ttsSpeak('voltar');
    // generous: under the whole suite's load a synthesis took over 2 s
    for (let i = 0; i < 400 && tocados.length === antes; i++) await new Promise((r) => setTimeout(r, 25));
    // measured on the ten-word utterances: 300 PPM; one word over 2 s of tone would read as 30 PPM and hit the maximum
    expect(tocados.at(-1).playbackRate).toBeCloseTo(504 / 300, 4);
  });
});

// ============================== MUTATIONS CHECKED ==============================
//   F1 the rate row removed from the panel               🔴 list · stored · not locked
//   F2 `preservesPitch` not set                          🟢 SURVIVES: the HTML spec defaults it to true, so the line states what
//                                                         Chromium already does; kept so the intent reaches every engine
//   F3 the rate never applied (always 1)                 🔴 follows · short
//   F4 `getSpeechPpm` not passed by the root             🔴 follows · short
//   F5 the short utterance measured on itself            🔴 one word
