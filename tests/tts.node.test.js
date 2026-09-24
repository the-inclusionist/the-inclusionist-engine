// SPDX-License-Identifier: AGPL-3.0-or-later
// Tests of platform/tts (NODE project: window.speechSynthesis + SpeechSynthesisUtterance stubbed). Contracts: narrate is
// gated by soundOn + audioCat.tts.on + non-empty text; the Web Speech fallback speaks IN THE GAME'S LANGUAGE; loadTTS
// warns on an engine that does not speak the language. See docs/5-Refactoring/plan-modularization-map.md (#38).
//
// The neural engine is the ENGINE's since ADR-0216: the game only declares `uses: { neuralVoice: true }`, which arrives here as
// `ctx.neuralVoice`. The loader stays injectable so the whole path runs with a fake — no network, no wasm engine. The fake browser
// offers one Portuguese voice: with none, narration is locked (ADR-0185 §4).
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import pt from '../app/js/i18n/pt.js';
import { createTts } from '../app/js/platform/tts.js';

let spoke, cancels;
beforeEach(() => {
  spoke = []; cancels = 0;
  globalThis.window = { speechSynthesis: { cancel: () => { cancels++; }, speak: (u) => spoke.push(u), getVoices: () => [{ name: 'Luciana', lang: 'pt-BR' }] } };
  globalThis.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; this.lang = ''; this.rate = 0; this.volume = 0; this.voice = null; } };
});
afterEach(() => { delete globalThis.window; delete globalThis.SpeechSynthesisUtterance; });

function setup(over = {}) {
  const said = [], alerted = [];
  const ctx = {
    srSay: (t) => said.push(t), srAlert: (t) => alerted.push(t),
    ensureAC: () => null, catNode: () => null, audioOut: () => null,
    getSoundOn: () => over.soundOn === undefined ? true : over.soundOn,
    getVolume: () => over.volume === undefined ? 0.6 : over.volume,
    getAudioCat: () => over.audioCat === undefined ? { tts: { on: true } } : over.audioCat,
  };
  // The declaration and the loader are two things since ADR-0216: a game answers the first and never the second.
  if (over.neuralVoice || over.loadKokoro) ctx.neuralVoice = true;
  if (over.loadKokoro) ctx.loadKokoro = over.loadKokoro;
  return { tts: createTts(ctx), said, alerted };
}

/** A Kokoro runtime that does not exist: the four calls the engine makes, and nothing more. WebGPU returns speech. */
function fakeKokoroPort(registro) {
  const tom = Float32Array.from({ length: 2400 }, (_, i) => Math.sin(i / 8) * 0.4);
  return () => Promise.resolve({
    phonemize: async () => 'a', vocabulary: async () => ({ a: 1 }),
    voice: async (id) => { registro.voice = id; return new Float32Array(256); },
    session: async (dispositivo) => { registro.dispositivo = dispositivo; return { synthesize: async () => tom }; },
  });
}

/** Lets the microtasks of `loadTTS`'s chained `then` run without tying the test to a number of ticks. */
async function assentar() { for (let i = 0; i < 12; i++) await Promise.resolve(); }

describe('platform/tts', () => {
  it('[Gate] narrate não fala com soundOn=false', () => {
    const { tts } = setup({ soundOn: false });
    tts.narrate('oi');
    expect(spoke.length).toBe(0);
    expect(tts.narrateCount).toBe(0);
  });

  it('[Gate] narrate não fala com o toggle TTS (audioCat.tts.on) desligado', () => {
    const { tts } = setup({ audioCat: { tts: { on: false } } });
    tts.narrate('oi');
    expect(spoke.length).toBe(0);
  });

  it('[Zero] narrate ignora texto vazio', () => {
    const { tts } = setup();
    tts.narrate('');
    expect(spoke.length).toBe(0);
    expect(tts.narrateCount).toBe(0);
  });

  it('[Happy] narrate (webspeech, tudo ligado) fala e conta', () => {
    const { tts } = setup();
    tts.narrate('bom dia');
    expect(spoke.length).toBe(1);
    expect(spoke[0].text).toBe('bom dia');
    expect(spoke[0].lang).toBe('pt-BR');
    expect(tts.narrateCount).toBe(1);
  });

  it('[Interface] volume do Web Speech = min(1, volume×1.4)', () => {
    const { tts } = setup({ volume: 0.5 });
    tts.narrate('x');
    expect(spoke[0].volume).toBeCloseTo(0.7); // 0.5 × 1.4
  });

  it('[Boundary] speakWebSpeech sem speechSynthesis retorna false', () => {
    globalThis.window = {}; // sem speechSynthesis
    const { tts } = setup();
    expect(tts.speakWebSpeech('x')).toBe(false);
  });

  it('[State] getEngineSel default webspeech; setEngineSel reflete', () => {
    const { tts } = setup();
    expect(tts.getEngineSel()).toBe('webspeech');
    tts.setEngineSel('kokoro');
    expect(tts.getEngineSel()).toBe('kokoro');
  });

  it('[State] set/getVoiceObj roundtrip', () => {
    const { tts } = setup();
    const v = { name: 'Luciana', lang: 'pt-BR' };
    tts.setVoiceObj(v);
    expect(tts.getVoiceObj()).toBe(v);
  });

  it('[Interface] loadTTS num motor que não fala o idioma avisa e não carrega', () => {
    // The engine does not speak the GAME's language, whatever it is — so the assertion goes through the dictionary
    // instead of repeating a sentence that names one language: it still proves the person was warned, without freezing
    // the wording.
    const { tts, alerted } = setup();
    tts.setEngineSel('kitten'); // Kokoro speaks since ADR-0198; Kitten has not entered
    tts.loadTTS();
    expect(alerted).toContain(pt['sr.tts.engineNoLanguage']);
    expect(tts.loading).toBe(false);
  });
});

// ===================================================================================================
// A PORTA DA VOZ NEURAL (ADR-0094, ADR-0198)
// ===================================================================================================
// The engine names no provider: the game does, through the Kokoro port. These cases hold both halves: without the port the child is
// TOLD and narration goes on in the browser's voice; with the port the neural path runs whole.
describe('platform/tts — a declaração da voz neural', () => {
  it('[Zero] jogo que não a declarou: avisa, marca falha e NÃO diz que o problema é o idioma', () => {
    const { tts, alerted } = setup();
    tts.setEngineSel('kokoro');
    tts.loadTTS();
    expect(alerted).toContain(pt['sr.tts.neuralNotBundled']);
    // ⚠️ THE DISTINCTION IS THE POINT, not a wording detail: «não há voz para este idioma» would send the child to switch
    // language looking for what is not there in any language.
    expect(alerted).not.toContain(pt['sr.tts.noNeuralForLanguage']);
    expect(tts.loading).toBe(false);
    expect(tts.failed).toBe(true);
    expect(tts.neuralAvailable).toBe(false);
  });

  it('[Right] sem a declaração a narração NÃO emudece — cai na voz do navegador', () => {
    const { tts } = setup();
    tts.setEngineSel('kokoro');
    tts.narrate('bom dia');
    expect(spoke.length).toBe(1);
    expect(spoke[0].text).toBe('bom dia');
    expect(spoke[0].lang).toBe('pt-BR');
  });

  // 🎯 WHAT ADR-0216 §1 CHANGED: the game declares, and the engine loads. With no injected loader `tts` has to fetch the
  // engine's own (`platform/kokoro-runtime`, through `import()`) — here, in node, that blows up for lack of `document`, and
  // that very failure proves it TRIED: a `tts` that went back to requiring the game's port would say «esta montagem não
  // traz motor neural» without trying anything. The distinction between the two alerts is the assertion.
  it('🔴 [Right] declarada e sem carregador injetado, a engine carrega a voz ELA MESMA — não diz «não vem no pacote»', async () => {
    const { tts, alerted } = setup({ neuralVoice: true });
    expect(tts.neuralAvailable, 'quem responde é a declaração, não um carregador').toBe(true);
    expect(tts.voices().some((v) => v.engine === 'kokoro'), 'as vozes do idioma entram na lista').toBe(true);
    tts.setEngineSel('kokoro');
    tts.loadTTS();
    expect(alerted, 'recusou sem sequer tentar o carregador da engine').not.toContain(pt['sr.tts.neuralNotBundled']);
    // ⚠️ These are not microtasks: the engine's loader IMPORTS a module, which is real work — waiting a fixed number of
    // ticks would measure the loading's clock and not the decision. The outcome is waited for, with a ceiling.
    for (let i = 0; i < 200 && !tts.failed; i++) await new Promise((r) => setTimeout(r, 5));
    expect(alerted, 'o carregador da engine correu e a falha dele é que foi dita').toContain(pt['sr.tts.loadFailed']);
  });

  it('[Happy] com carregador o caminho neural corre inteiro e o motor fica de pé', async () => {
    const registro = {};
    const { tts } = setup({ loadKokoro: fakeKokoroPort(registro) });
    expect(tts.neuralAvailable).toBe(true);
    tts.setEngineSel('kokoro');
    tts.loadTTS();
    expect(tts.loading, 'o carregamento começa de imediato').toBe(true);
    await assentar();
    expect(registro.voice, 'the first Kokoro voice of the language loads').toBe('pf_dora');
    expect(tts.getEngine()?.id).toBe('kokoro');
    expect(tts.loading).toBe(false);
    expect(tts.failed).toBe(false);
  });

  it('[Boundary] carregador que rejeita não derruba o jogo: falha marcada e voz do navegador segue', async () => {
    const { tts, alerted } = setup({ loadKokoro: () => Promise.reject(new Error('offline')) });
    tts.setEngineSel('kokoro');
    tts.loadTTS();
    await assentar();
    expect(alerted).toContain(pt['sr.tts.loadFailed']);
    expect(tts.failed).toBe(true);
    expect(tts.loading).toBe(false);
    tts.narrate('segue');
    expect(spoke.length).toBe(1);
  });
});
