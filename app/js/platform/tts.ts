// SPDX-License-Identifier: AGPL-3.0-or-later
// platform/tts — spoken narration. The browser's voice speaks first (Web Speech, ADR-0200); the neural fallback is Kokoro, which
// THE ENGINE ITSELF loads from the delivery (ADR-0216 §1) the first time a child picks it — the game only says it wants one. narrate() é o
// ponto de entrada, gated pelo toggle 'Narração (TTS)' do mixer (audioCat.tts.on) — independe das legendas. As funções de
// PAINEL (populateTTSEngines/Voices/reflectTTS) ficam no game.js (→ ui/settings-audio, #38→#54) e usam get/setEngineSel +
// get/setVoiceObj daqui. Injeção por closure. Ver docs/plano-tts-fase-f5.md + docs/5-Refactoring/plano-modularizacao-mapa.md.

import * as store from './storage.js';
import { t, bcp47 } from '../core/i18n.js';
import { createInterruptibleSpeech } from './interruptible-speech.js';
import { voicesForLocale, type NeuralVoice } from './voice-plan.js';
import { spokenWords, speechSeconds, speechPlaybackRate } from '../core/speech-rate.js';
import {
  KOKORO_VOICES, tokenize, sentenceStyle, eFala, wavDe,
  type LoadKokoro, type KokoroModule, type KokoroSession,
} from './kokoro.js';

// They were declared here until ADR-0216 and are answered from the leaf now; re-exported so the name a consumer imports is the same.
export type { LoadKokoro, KokoroModule, KokoroSession };

interface TtsEngine { id: string; speak: (text: string) => void; }

/**
 * THE ENGINE'S OWN LOADER (ADR-0216 §1 and §5) — the Dev, 2026-09-21: «O jogo não deve precisar saber como isso funciona».
 *
 * ⚠️ IMPORTED AT THE FIRST NEURAL UTTERANCE AND NOT BEFORE: `kokoro-runtime` is what names espeak-ng and the ONNX runtime, so a
 * game that never speaks neurally never loads a byte of them — which is the whole reason this is an `import()` and not an import.
 */
const fromDelivery: LoadKokoro = async () => {
  const { loadKokoroRuntime } = await import('./kokoro-runtime.js');
  return loadKokoroRuntime({ base: document.baseURI });
};

export interface TtsCtx {
  srSay: (t: string) => void;
  srAlert: (t: string) => void;
  ensureAC: () => AudioContext | null;
  catNode: (cat: string) => AudioNode | null;
  audioOut: () => AudioNode | null;
  getSoundOn: () => boolean;
  getVolume: () => number;
  getAudioCat: () => Record<string, { on: boolean }> | null; // narrate checa audioCat.tts.on
  /**
   * DOES THIS GAME SPEAK WITH A NEURAL VOICE (ADR-0216 §3)? The game's answer, not a loader: absent, no Kokoro voice is listed, the
   * browser's voice speaks, and the delivery carries neither the model nor the runtime.
   */
  neuralVoice?: boolean;
  /**
   * How that voice is built. Injected so a case can hand in a module without a wasm engine; the default is the engine's own loader,
   * which reads the delivery. A game never passes this — it says `uses: { neuralVoice: true }` and the engine does the rest.
   */
  loadKokoro?: LoadKokoro;
  /** The child's speech rate, words a minute (ADR-0183 §1). Absent = each voice at its own rate. */
  getSpeechPpm?: () => number;
  /**
   * Makes the element a neural utterance plays through. Injected so the rate can be measured; the default is the document's
   * `<audio>`. An element, not an `AudioBufferSourceNode`: only a media element changes speed without changing pitch.
   */
  createAudio?: () => HTMLAudioElement;
}

export interface Tts {
  narrate: (text: string) => void;         // ponto de entrada (gated); usado em todo o game.js + injetado no audio-nav
  ttsSpeak: (text: string) => boolean;
  loadTTS: () => void;
  speakWebSpeech: (text: string) => boolean;
  getEngineSel: () => string;
  setEngineSel: (v: string) => void;
  getEngine: () => TtsEngine | null;
  getVoiceObj: () => SpeechSynthesisVoice | null;
  setVoiceObj: (v: SpeechSynthesisVoice | null) => void;
  readonly loading: boolean;
  readonly failed: boolean;
  readonly narrateCount: number;
  /**
   * DOES THIS GAME ASK FOR A NEURAL ENGINE? (ADR-0216 §3) O painel de áudio pergunta antes de o oferecer: uma opção
   * que não pode funcionar é pior que uma opção a menos — quem a escolhe fica à espera de um download que
   * nunca começa, e quem navega por escuta não tem como ver que não começou.
   */
  readonly neuralAvailable: boolean;
  /** The voices of the current language the child may pick (ADR-0185); empty locks the speech rows and the bar's button. */
  voices: () => readonly NeuralVoice[];
  /** Where the loaded Kokoro voice runs: WebGPU when its test synthesis was speech, else WASM; null before one loads. */
  readonly kokoroDevice: 'webgpu' | 'wasm' | null;
  /** The voice in use: the stored choice when it speaks the language, else the language's first voice, else none. */
  currentVoice: () => NeuralVoice | null;
  /** Stores the choice. A voice that does not speak the current language is refused (`false`). */
  setVoice: (id: string) => boolean;
}

// 📌 The only neural engine is Kokoro (ADR-0207): the engine's earlier neural engine left when the licence chain of its voices came
// to light. 📌 And ADR-0094's fear — «a provider named here lands its runtime in every consumer's `node_modules`» — is answered by the
// delivery and not by a port: the runtime is catalogued, fetched by the build and read from `heavy/`, never imported from npm.
/** An engine the child may have stored before it left the engine (ADR-0207): read as no explicit choice, so the voice in use speaks. */
const ENGINES_THAT_LEFT: readonly string[] = ['piper'];
export function createTts(ctx: TtsCtx): Tts {
  let ttsEngine: TtsEngine | null = null, ttsLoading = false, ttsFailed = false, _narrateCount = 0;
  let _ttsVoiceObj: SpeechSynthesisVoice | null = null; // voz do Web Speech selecionada
  // An engine set explicitly (stored, or by the panel) wins; otherwise the engine of the voice in use, which is the browser's when it
  // offers one for the language (ADR-0200) — measured on the device at every call, since the browser lists its voices late.
  const stored: string | null = store.get(store.KEYS.ttsEngine, null) || null; // webspeech | kokoro | kitten | espeak
  let ttsEngineSelExplicito: string | null = stored && !ENGINES_THAT_LEFT.includes(stored) ? stored : null;
  const engineSel = (): string => {
    if (ttsEngineSelExplicito) return ttsEngineSelExplicito;
    const e = voiceInUse()?.engine;
    // a fallback this game did not ask for is not the default: undeclared, the browser's voice (no «not bundled» alert)
    return e === 'kokoro' && ctx.neuralVoice ? e : 'webspeech';
  };
  let kokoroBackend: 'webgpu' | 'wasm' | null = null;
  let loadedVoice: string | null = null; // the voice the loaded engine speaks; another choice reloads it
  // Each voice's words per minute, averaged over the utterances long enough to measure (`core/speech-rate`): what a short
  // utterance («Voltar») is played against. Neural voices by id; browser voices by name.
  const voiceAverage = new Map<string, number>();
  const media = (voiceName: string, ppm: number | null): void => {
    if (!ppm) return;
    const before = voiceAverage.get(voiceName);
    voiceAverage.set(voiceName, before ? before * 0.7 + ppm * 0.3 : ppm);
  };

  /**
   * WEB SPEECH FIRST (ADR-0200; issue #190): the browser's voices for the language lead the list, so where the device already speaks
   * no neural voice is loaded; then Kokoro's where the game declared it speaks neurally (ADR-0216 §3) — the fallback.
   */
  const browserVoices = (): readonly NeuralVoice[] => {
    let lista: readonly SpeechSynthesisVoice[] = [];
    try { lista = window.speechSynthesis?.getVoices() ?? []; } catch { /* no speech synthesis here */ }
    return voicesForLocale(bcp47(), lista.map((v) => ({ locale: v.lang.replace('_', '-'), engine: 'webspeech', voice: 'webspeech:' + v.name })));
  };
  const availableVoices = (): readonly NeuralVoice[] => [...browserVoices(), ...(ctx.neuralVoice ? voicesForLocale(bcp47(), KOKORO_VOICES) : [])];
  /** The browser voice an entry names, or null. */
  const browserVoice = (id: string | undefined): SpeechSynthesisVoice | null => {
    if (!id?.startsWith('webspeech:')) return null;
    try { return window.speechSynthesis?.getVoices().find((v) => 'webspeech:' + v.name === id) ?? null; } catch { return null; }
  };
  function voiceInUse(): NeuralVoice | null {
    const lista = availableVoices();
    const storedVoiceId = store.get(store.KEYS.ttsVoz, null);
    return lista.find((v) => v.voice === storedVoiceId) ?? lista[0] ?? null;
  }
  function chooseVoice(id: string): boolean {
    if (!availableVoices().some((v) => v.voice === id)) return false;
    store.set(store.KEYS.ttsVoz, id);
    ttsEngineSelExplicito = availableVoices().find((v) => v.voice === id)!.engine;
    _ttsVoiceObj = browserVoice(id);
    return true;
  }

  function speakWebSpeech(text: string): boolean {
    try {
      const ss = window.speechSynthesis; if (!ss) return false; ss.cancel();
      // `u.lang` era 'pt-BR' fixo. Com o jogo em inglês ou espanhol isso pedia ao navegador uma voz
      // PORTUGUESA para um texto que não é português — e o resultado não é sotaque, é ininteligível: a
      // fonética errada aplicada às letras erradas. Segue o idioma do jogo.
      const voiceName = _ttsVoiceObj ?? browserVoice(voiceInUse()?.voice);
      const u = new SpeechSynthesisUtterance(text); u.lang = bcp47(); if (voiceName) u.voice = voiceName; u.volume = Math.min(1, ctx.getVolume() * 1.4);
      // ADR-0183 §1: the browser's `rate` is a multiplier. The voice's words a minute at rate 1 is measured on its own utterances
      // (start to end, so the silent ends count — an approximation the neural path does not need); until one is measured, 1.
      const voiceIdOf = 'webspeech:' + (voiceName?.name ?? bcp47());
      const words = spokenWords(text);
      const voiceBase = voiceAverage.get(voiceIdOf) ?? null;
      u.rate = ctx.getSpeechPpm && voiceBase ? speechPlaybackRate(0, 0, ctx.getSpeechPpm(), voiceBase).rate : 1;
      let startAt = 0;
      u.onstart = () => { startAt = performance.now(); };
      u.onend = () => {
        const seconds = startAt ? (performance.now() - startAt) / 1000 : 0;
        const measured = speechPlaybackRate(words, seconds, 150, null).voiceWpm;
        if (measured) media(voiceIdOf, measured / u.rate);
      };
      ss.speak(u); return true;
    } catch (e) { return false; }
  }

  /**
   * A neural voice's utterances, whatever made the WAV (ADR-0183 §1): every utterance is measured — its words over its speech time,
   * silent ends trimmed — and played at the child's rate over the voice's, through a media element that keeps the pitch.
   */
  function speakByWav(voiceId: string, produce: (texto: string) => Promise<ArrayBuffer>): { speak: (texto: string) => void } {
    return createInterruptibleSpeech<{ url: string; rate: number }, HTMLAudioElement>({
      synthesize: async (texto) => {
        const bytes = await produce(texto);
        const ac = ctx.ensureAC();
        if (!ac) throw new Error('AudioContext unavailable'); // o `catch` de lá trata: silêncio deste item, motor vivo
        let speedRatio = 1;
        if (ctx.getSpeechPpm) {
          const buf = await ac.decodeAudioData(bytes.slice(0));
          const measure = speechPlaybackRate(spokenWords(texto), speechSeconds(buf.getChannelData(0), buf.sampleRate), ctx.getSpeechPpm(), voiceAverage.get(voiceId) ?? null);
          media(voiceId, measure.voiceWpm);
          speedRatio = measure.rate;
        }
        return { url: URL.createObjectURL(new Blob([bytes], { type: 'audio/wav' })), rate: speedRatio };
      },
      play: (som, onFinish) => {
        const ac = ctx.ensureAC();
        if (!ac) { URL.revokeObjectURL(som.url); return null; }
        const el = ctx.createAudio ? ctx.createAudio() : document.createElement('audio');
        el.preservesPitch = true;
        el.src = som.url;
        el.playbackRate = som.rate;
        try { ac.createMediaElementSource(el).connect(ctx.catNode('tts') || ctx.audioOut() || ac.destination); } catch { /* already routed */ }
        el.onended = () => { URL.revokeObjectURL(som.url); onFinish(); };
        void el.play().catch(() => { URL.revokeObjectURL(som.url); onFinish(); });
        return el;
      },
      stop: (el) => { el.pause(); URL.revokeObjectURL(el.src); },
    });
  }

  /**
   * KOKORO (ADR-0186, ADR-0216; issues #181, #200): the voice's text becomes espeak-ng phonemes in its language, then the model's
   * ids and a waveform. WebGPU only where a short test synthesis is speech — measured, WebGPU can run and return noise — and WASM
   * with threads otherwise (ADR-0192).
   */
  function loadKokoroEngine(forVoice: NeuralVoice): void {
    const load = ctx.loadKokoro ?? fromDelivery;
    const kv = KOKORO_VOICES.find((v) => v.voice === forVoice.voice);
    if (!kv) { ttsFailed = true; ctx.srAlert(t('sr.tts.neuralNotBundled')); return; }
    ttsLoading = true; loadedVoice = forVoice.voice; const t0 = performance.now(); ctx.srSay(t('sr.tts.downloading'));
    load().then(async (mod) => {
      const [vocabulario, tabela] = await Promise.all([mod.vocabulary(), mod.voice(kv.voice)]);
      const synthesiseWith = async (kokoroSession: KokoroSession, texto: string): Promise<Float32Array> => {
        const ids = tokenize(await mod.phonemize(texto, kv.espeak), vocabulario);
        return kokoroSession.synthesize(ids, sentenceStyle(tabela, ids.length - 2));
      };
      let kokoroSession: KokoroSession | null = null;
      try {
        const gpu = await mod.session('webgpu');
        if (eFala(await synthesiseWith(gpu, t('tts.kokoro.teste')))) { kokoroSession = gpu; kokoroBackend = 'webgpu'; }
      } catch { /* no WebGPU here: WASM below */ }
      if (!kokoroSession) { kokoroSession = await mod.session('wasm'); kokoroBackend = 'wasm'; }
      const used = kokoroSession;
      const fala = speakByWav(kv.voice, async (texto) => wavDe(await synthesiseWith(used, texto)));
      ttsEngine = { id: 'kokoro', speak: (text: string) => { fala.speak(text); } };
      ttsLoading = false;
      try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (e) { /* noop */ }
      narrate(t('sr.tts.ready', { s: ((performance.now() - t0) / 1000).toFixed(0) }));
    }).catch(() => { ttsLoading = false; ttsFailed = true; ctx.srAlert(t('sr.tts.loadFailed')); });
  }

  function loadTTS(): void {
    if (ttsEngine || ttsLoading || ttsFailed) return;
    const sel = engineSel();
    if (sel !== 'kokoro') { // Kitten and eSpeak NG are not built
      if (sel !== 'webspeech') ctx.srAlert(t('sr.tts.engineNoLanguage'));
      return;
    }
    // ESTE JOGO NÃO PEDIU VOZ NEURAL (ADR-0216 §3). Vem ANTES da pergunta do idioma de propósito: sem a
    // declaração, não há voz neural em idioma nenhum — a entrega não traz o modelo —, e dizer «não há voz para
    // o teu idioma» faria a criança pensar que trocar de idioma resolveria. `ttsFailed` para não repetir a cada fala.
    if (!ctx.neuralVoice) { ttsFailed = true; ctx.srAlert(t('sr.tts.neuralNotBundled')); return; }
    // The voice in use for the current language (ADR-0185); a browser voice in use with Kokoro set explicitly gives way to the
    // language's first Kokoro voice. None: another language's voice is NOT fetched — it would read this text with the wrong phonetics.
    const current = voiceInUse();
    const forVoice = current?.engine === 'kokoro' ? current : voicesForLocale(bcp47(), KOKORO_VOICES)[0] ?? null;
    if (!forVoice) { ctx.srAlert(t('sr.tts.noNeuralForLanguage')); return; }
    loadKokoroEngine(forVoice);
  }

  function ttsSpeak(text: string): boolean {
    if (engineSel() !== 'webspeech') {
      // another voice picked, or the language changed, since the engine loaded: load the voice in use
      const inUse = voiceInUse();
      if (ttsEngine && inUse?.engine !== 'webspeech' && loadedVoice !== inUse?.voice) { ttsEngine = null; ttsFailed = false; }
      if (ttsEngine && ttsEngine.speak) { try { ttsEngine.speak(text); } catch (e) { /* noop */ } return true; }
      loadTTS(); // motor neural (baixando/indisponível) → cai no fallback
    }
    return speakWebSpeech(text); // fallback imediato: Web Speech, no idioma do jogo
  }

  function narrate(text: string): void { // gated pelo toggle 'Narração (TTS)' do mixer, independente das legendas
    const cat = ctx.getAudioCat(); if (!ctx.getSoundOn() || !cat || !cat.tts || !cat.tts.on || !text) return;
    if (availableVoices().length === 0) return; // no voice speaks this language: narration is locked (ADR-0185 §4)
    _narrateCount++; ttsSpeak(text);
  }

  return {
    narrate, ttsSpeak, loadTTS, speakWebSpeech,
    getEngineSel: engineSel, setEngineSel: (v) => { ttsEngineSelExplicito = v; },
    getEngine: () => ttsEngine, getVoiceObj: () => _ttsVoiceObj, setVoiceObj: (v) => { _ttsVoiceObj = v; },
    get loading() { return ttsLoading; }, get failed() { return ttsFailed; }, get narrateCount() { return _narrateCount; },
    get neuralAvailable() { return !!ctx.neuralVoice; },
    get kokoroDevice() { return kokoroBackend; },
    voices: availableVoices, currentVoice: voiceInUse, setVoice: chooseVoice,
  };
}
