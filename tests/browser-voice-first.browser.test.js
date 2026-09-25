// SPDX-License-Identifier: AGPL-3.0-or-later
// WEB SPEECH FIRST (ADR-0200; issue #190): where the browser offers a voice for the language it leads the list and speaks, and no
// neural voice loads; Kokoro's voices stay in the list as the fallback (ADR-0207), and a browser with no voice for the language falls back.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTts } from '../app/js/platform/tts.js';
import { createTranslator } from '../app/js/core/i18n.js';
import { createStorage, memoryBackend } from '../app/js/platform/storage.js';

const ss = window.speechSynthesis;
const originais = { getVoices: ss.getVoices, speak: ss.speak, cancel: ss.cancel };
const UtteranceOriginal = window.SpeechSynthesisUtterance;
// a fake voice cannot be set on a real utterance (it must be a SpeechSynthesisVoice): the utterance is faked too
class UtteranceFalsa { constructor(text) { this.text = text; this.voice = null; } }
let faladas, portaChamada;
const vozFalsa = (name, lang) => ({ name, lang, localService: true, default: false, voiceURI: name });

function montar({ vozesDoNavegador, comPorta = true }) {
  ss.getVoices = () => vozesDoNavegador;
  return createTts({
    store: createStorage(memoryBackend()), // each boot its own store (ADR-0232): no stored voice is inherited
    translator: createTranslator(), // the root's translator, played by the test (ADR-0232 D3)
    srSay: () => {}, srAlert: () => {}, ensureAC: () => new AudioContext(), catNode: () => null, audioOut: () => null,
    getSoundOn: () => true, getVolume: () => 1, getAudioCat: () => ({ tts: { on: true } }),
    // the browser's speech, lent the way the root lends it (ADR-0232 D4) — read at each utterance, so the fakes below count
    speech: { synth: () => window.speechSynthesis, utterance: (t) => new window.SpeechSynthesisUtterance(t) },
    now: () => performance.now(), createAudio: () => document.createElement('audio'),
    loadKokoro: () => { portaChamada++; return new Promise(() => {}); },
    // `comPorta` is now the GAME'S ANSWER (ADR-0216 §3): declared, the neural voice is listed and loadable — and the loader is
    // replaced by one that never settles, so a case can measure that the browser's voice spoke without it.
    ...(comPorta ? { neuralVoice: true } : {}),
  });
}

beforeEach(async () => {
  // every case builds a fresh translator, born in pt: `core/i18n` holds no language to reset (ADR-0232 D3)
  faladas = []; portaChamada = 0;
  ss.speak = (u) => { faladas.push(u); };
  ss.cancel = () => {};
  window.SpeechSynthesisUtterance = UtteranceFalsa;
});
afterEach(() => { Object.assign(ss, originais); window.SpeechSynthesisUtterance = UtteranceOriginal; });

describe('the browser speaks first where it offers a voice for the language', () => {
  it('🔴 [Right] the browser\'s Portuguese voice leads the list, then Kokoro\'s; the English one is not listed', () => {
    const tts = montar({ vozesDoNavegador: [vozFalsa('Samantha', 'en-US'), vozFalsa('Luciana', 'pt-BR')] });
    expect(tts.voices().map((v) => v.voice)).toEqual(['webspeech:Luciana', 'pf_dora', 'pm_alex', 'pm_santa']);
    expect([tts.currentVoice()?.voice, tts.getEngineSel()]).toEqual(['webspeech:Luciana', 'webspeech']);
  });

  it('🎯 [Zero] it speaks with that voice, and no neural voice is loaded', () => {
    const tts = montar({ vozesDoNavegador: [vozFalsa('Luciana', 'pt-BR')] });
    tts.ttsSpeak('Pule a pedra.');
    expect(faladas.map((u) => u.voice?.name)).toEqual(['Luciana']);
    expect(portaChamada, 'a neural voice loaded where the browser speaks').toBe(0);
  });

  it('⚠️ [Boundary] a browser with no voice for the language falls back to the neural voice', () => {
    const tts = montar({ vozesDoNavegador: [vozFalsa('Samantha', 'en-US')] });
    expect([tts.currentVoice()?.voice, tts.getEngineSel()]).toEqual(['pf_dora', 'kokoro']);
    tts.ttsSpeak('Pule a pedra.');
    expect(portaChamada).toBe(1);
  });

  it('🔴 [Right] the fallback stays pickable: choosing Dora loads it, choosing the browser voice again speaks through it', () => {
    const tts = montar({ vozesDoNavegador: [vozFalsa('Luciana', 'pt-BR')] });
    expect(tts.setVoice('pf_dora')).toBe(true);
    tts.ttsSpeak('Olá.');
    expect([tts.getEngineSel(), portaChamada]).toEqual(['kokoro', 1]);
    expect(tts.setVoice('webspeech:Luciana')).toBe(true);
    tts.ttsSpeak('Olá.');
    expect([tts.getEngineSel(), faladas.at(-1)?.voice?.name]).toEqual(['webspeech', 'Luciana']);
  });

  it('⚠️ [Boundary] without the neural port and without a browser voice, the default is still the browser path — no «not bundled» on the first word', () => {
    const tts = montar({ vozesDoNavegador: [], comPorta: false });
    expect(tts.getEngineSel()).toBe('webspeech');
  });
});

// ============================== MUTATIONS CHECKED ==============================
//   W1 browser voices not listed                                🔴 leads the list · speaks with that voice
//   W2 browser voices listed after Kokoro's                     🔴 leads the list
//   W3 the voice of another language listed                     🔴 leads the list
//   W4 the utterance without the chosen browser voice            🔴 speaks with that voice · pickable
//   W5 a neural voice the default without the port              🔴 no «not bundled»
