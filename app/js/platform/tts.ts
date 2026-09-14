// SPDX-License-Identifier: AGPL-3.0-or-later
// platform/tts — spoken narration. The browser's voice speaks first (Web Speech, ADR-0200); the neural fallback is Kokoro, loaded
// lazily through the port the game fills (ADR-0198) — and without the port nothing goes silent, the browser's voice speaks. narrate() é o
// ponto de entrada, gated pelo toggle 'Narração (TTS)' do mixer (audioCat.tts.on) — independe das legendas. As funções de
// PAINEL (populateTTSEngines/Voices/reflectTTS) ficam no game.js (→ ui/settings-audio, #38→#54) e usam get/setEngineSel +
// get/setVoiceObj daqui. Injeção por closure. Ver docs/plano-tts-fase-f5.md + docs/5-Refactoring/plano-modularizacao-mapa.md.

import * as store from './storage.js';
import { t, bcp47 } from '../core/i18n.js';
import { criarFalaInterrompivel } from './interruptible-speech.js';
import { vozesDoIdioma, type VozNeural } from './voice-plan.js';
import { palavrasFaladas, segundosDeFala, taxaDaFala } from '../core/speech-rate.js';
import { VOZES_KOKORO, tokenizar, estiloDaFrase, eFala, wavDe } from './kokoro.js';

interface TtsEngine { id: string; speak: (text: string) => void; }

/** A Kokoro inference session on one device: token ids and a style row in, a 24 kHz waveform out. */
export interface SessaoKokoro {
  readonly sintetizar: (ids: readonly number[], estilo: Float32Array) => Promise<Float32Array>;
}
/**
 * WHAT THE ENGINE NEEDS FROM KOKORO (ADR-0198 §5) — the game fills it; the engine names no phonemizer, runtime or model file.
 * `fonemizar` is espeak-ng in the voice's language (`pt-br`, `es-419`, `en-us`, `en-gb`); `vocabulario` the model tokenizer's symbols;
 * `voz` a voice's style table; `sessao` a session on WebGPU or WASM.
 */
export interface ModuloKokoro {
  readonly fonemizar: (texto: string, espeak: string) => Promise<string>;
  readonly vocabulario: () => Promise<Readonly<{ [simbolo: string]: number }>>;
  readonly voz: (id: string) => Promise<Float32Array>;
  readonly sessao: (dispositivo: 'webgpu' | 'wasm') => Promise<SessaoKokoro>;
}
/** The Kokoro port (ADR-0198): one line on the game's side, loading its own phonemizer, runtime and model. */
export type CarregarKokoro = () => Promise<ModuloKokoro>;

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
   * How the Kokoro voices load (ADR-0198), filled by the game, absent by default: the engine names no phonemizer, runtime or model
   * file, so a game that never speaks neurally carries none of them. Absent = no Kokoro voice is listed; the browser's voice speaks.
   */
  carregarKokoro?: CarregarKokoro;
  /** The child's speech rate, words a minute (ADR-0183 §1). Absent = each voice at its own rate. */
  getSpeechPpm?: () => number;
  /**
   * Makes the element a neural utterance plays through. Injected so the rate can be measured; the default is the document's
   * `<audio>`. An element, not an `AudioBufferSourceNode`: only a media element changes speed without changing pitch.
   */
  criarAudio?: () => HTMLAudioElement;
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
   * DOES THIS ASSEMBLY HAVE A NEURAL ENGINE? (ADR-0094, the Kokoro port) O painel de áudio pergunta antes de o oferecer: uma opção
   * que não pode funcionar é pior que uma opção a menos — quem a escolhe fica à espera de um download que
   * nunca começa, e quem navega por escuta não tem como ver que não começou.
   */
  readonly neuralDisponivel: boolean;
  /** The voices of the current language the child may pick (ADR-0185); empty locks the speech rows and the bar's button. */
  vozes: () => readonly VozNeural[];
  /** Where the loaded Kokoro voice runs: WebGPU when its test synthesis was speech, else WASM; null before one loads. */
  readonly kokoroDispositivo: 'webgpu' | 'wasm' | null;
  /** The voice in use: the stored choice when it speaks the language, else the language's first voice, else none. */
  vozAtual: () => VozNeural | null;
  /** Stores the choice. A voice that does not speak the current language is refused (`false`). */
  setVoz: (id: string) => boolean;
}

// 📌 The only neural engine is Kokoro (ADR-0207): the engine's earlier neural engine left when the licence chain of its voices came
// to light. The engine names no provider — the game fills the Kokoro port (ADR-0094's reason: a provider named here lands its runtime in every
// consumer's `node_modules`).
/** An engine the child may have stored before it left the engine (ADR-0207): read as no explicit choice, so the voice in use speaks. */
const MOTORES_QUE_SAIRAM: readonly string[] = ['piper'];
export function createTts(ctx: TtsCtx): Tts {
  let ttsEngine: TtsEngine | null = null, ttsLoading = false, ttsFailed = false, _narrateCount = 0;
  let _ttsVoiceObj: SpeechSynthesisVoice | null = null; // voz do Web Speech selecionada
  // An engine set explicitly (stored, or by the panel) wins; otherwise the engine of the voice in use, which is the browser's when it
  // offers one for the language (ADR-0200) — measured on the device at every call, since the browser lists its voices late.
  const guardado: string | null = store.get(store.KEYS.ttsEngine, null) || null; // webspeech | kokoro | kitten | espeak
  let ttsEngineSelExplicito: string | null = guardado && !MOTORES_QUE_SAIRAM.includes(guardado) ? guardado : null;
  const motorSel = (): string => {
    if (ttsEngineSelExplicito) return ttsEngineSelExplicito;
    const e = vozAtual()?.engine;
    // a fallback the game does not bundle is not the default: without its port, the browser's voice (no «not bundled» alert)
    return e === 'kokoro' && ctx.carregarKokoro ? e : 'webspeech';
  };
  let kokoroDispositivo: 'webgpu' | 'wasm' | null = null;
  let vozCarregada: string | null = null; // the voice the loaded engine speaks; another choice reloads it
  // Each voice's words per minute, averaged over the utterances long enough to measure (`core/speech-rate`): what a short
  // utterance («Voltar») is played against. Neural voices by id; browser voices by name.
  const mediaDaVoz = new Map<string, number>();
  const media = (voz: string, ppm: number | null): void => {
    if (!ppm) return;
    const antes = mediaDaVoz.get(voz);
    mediaDaVoz.set(voz, antes ? antes * 0.7 + ppm * 0.3 : ppm);
  };

  /**
   * WEB SPEECH FIRST (ADR-0200; issue #190): the browser's voices for the language lead the list, so where the device already speaks
   * no neural voice is loaded; then Kokoro's where the game hands in the Kokoro port (ADR-0198 §1–2) — the fallback.
   */
  const vozesDoNavegador = (): readonly VozNeural[] => {
    let lista: readonly SpeechSynthesisVoice[] = [];
    try { lista = window.speechSynthesis?.getVoices() ?? []; } catch { /* no speech synthesis here */ }
    return vozesDoIdioma(bcp47(), lista.map((v) => ({ locale: v.lang.replace('_', '-'), engine: 'webspeech', voice: 'webspeech:' + v.name })));
  };
  const vozes = (): readonly VozNeural[] => [...vozesDoNavegador(), ...(ctx.carregarKokoro ? vozesDoIdioma(bcp47(), VOZES_KOKORO) : [])];
  /** The browser voice an entry names, or null. */
  const vozDoNavegador = (id: string | undefined): SpeechSynthesisVoice | null => {
    if (!id?.startsWith('webspeech:')) return null;
    try { return window.speechSynthesis?.getVoices().find((v) => 'webspeech:' + v.name === id) ?? null; } catch { return null; }
  };
  function vozAtual(): VozNeural | null {
    const lista = vozes();
    const guardada = store.get(store.KEYS.ttsVoz, null);
    return lista.find((v) => v.voice === guardada) ?? lista[0] ?? null;
  }
  function setVoz(id: string): boolean {
    if (!vozes().some((v) => v.voice === id)) return false;
    store.set(store.KEYS.ttsVoz, id);
    ttsEngineSelExplicito = vozes().find((v) => v.voice === id)!.engine;
    _ttsVoiceObj = vozDoNavegador(id);
    return true;
  }

  function speakWebSpeech(text: string): boolean {
    try {
      const ss = window.speechSynthesis; if (!ss) return false; ss.cancel();
      // `u.lang` era 'pt-BR' fixo. Com o jogo em inglês ou espanhol isso pedia ao navegador uma voz
      // PORTUGUESA para um texto que não é português — e o resultado não é sotaque, é ininteligível: a
      // fonética errada aplicada às letras erradas. Segue o idioma do jogo.
      const voz = _ttsVoiceObj ?? vozDoNavegador(vozAtual()?.voice);
      const u = new SpeechSynthesisUtterance(text); u.lang = bcp47(); if (voz) u.voice = voz; u.volume = Math.min(1, ctx.getVolume() * 1.4);
      // ADR-0183 §1: the browser's `rate` is a multiplier. The voice's words a minute at rate 1 is measured on its own utterances
      // (start to end, so the silent ends count — an approximation the neural path does not need); until one is measured, 1.
      const idDaVoz = 'webspeech:' + (voz?.name ?? bcp47());
      const palavras = palavrasFaladas(text);
      const baseDaVoz = mediaDaVoz.get(idDaVoz) ?? null;
      u.rate = ctx.getSpeechPpm && baseDaVoz ? taxaDaFala(0, 0, ctx.getSpeechPpm(), baseDaVoz).taxa : 1;
      let inicio = 0;
      u.onstart = () => { inicio = performance.now(); };
      u.onend = () => {
        const segundos = inicio ? (performance.now() - inicio) / 1000 : 0;
        const medido = taxaDaFala(palavras, segundos, 150, null).ppmDaVoz;
        if (medido) media(idDaVoz, medido / u.rate);
      };
      ss.speak(u); return true;
    } catch (e) { return false; }
  }

  /**
   * A neural voice's utterances, whatever made the WAV (ADR-0183 §1): every utterance is measured — its words over its speech time,
   * silent ends trimmed — and played at the child's rate over the voice's, through a media element that keeps the pitch.
   */
  function falaPorWav(vozId: string, produzir: (texto: string) => Promise<ArrayBuffer>): { falar: (texto: string) => void } {
    return criarFalaInterrompivel<{ url: string; taxa: number }, HTMLAudioElement>({
      sintetizar: async (texto) => {
        const bytes = await produzir(texto);
        const ac = ctx.ensureAC();
        if (!ac) throw new Error('AudioContext unavailable'); // o `catch` de lá trata: silêncio deste item, motor vivo
        let taxa = 1;
        if (ctx.getSpeechPpm) {
          const buf = await ac.decodeAudioData(bytes.slice(0));
          const medida = taxaDaFala(palavrasFaladas(texto), segundosDeFala(buf.getChannelData(0), buf.sampleRate), ctx.getSpeechPpm(), mediaDaVoz.get(vozId) ?? null);
          media(vozId, medida.ppmDaVoz);
          taxa = medida.taxa;
        }
        return { url: URL.createObjectURL(new Blob([bytes], { type: 'audio/wav' })), taxa };
      },
      tocar: (som, aoTerminar) => {
        const ac = ctx.ensureAC();
        if (!ac) { URL.revokeObjectURL(som.url); return null; }
        const el = ctx.criarAudio ? ctx.criarAudio() : document.createElement('audio');
        el.preservesPitch = true;
        el.src = som.url;
        el.playbackRate = som.taxa;
        try { ac.createMediaElementSource(el).connect(ctx.catNode('tts') || ctx.audioOut() || ac.destination); } catch { /* already routed */ }
        el.onended = () => { URL.revokeObjectURL(som.url); aoTerminar(); };
        void el.play().catch(() => { URL.revokeObjectURL(som.url); aoTerminar(); });
        return el;
      },
      parar: (el) => { el.pause(); URL.revokeObjectURL(el.src); },
    });
  }

  /**
   * KOKORO (ADR-0186, ADR-0198; issue #181): through the game's port, the voice's text becomes espeak-ng phonemes in its language,
   * then the model's ids and a waveform. WebGPU only where a short test synthesis is speech — measured, WebGPU can run and return
   * noise — and WASM with threads otherwise (ADR-0192).
   */
  function carregarMotorKokoro(fonte: VozNeural): void {
    const carregar = ctx.carregarKokoro;
    const kv = VOZES_KOKORO.find((v) => v.voice === fonte.voice);
    if (!carregar || !kv) { ttsFailed = true; ctx.srAlert(t('sr.tts.neuralNotBundled')); return; }
    ttsLoading = true; vozCarregada = fonte.voice; const t0 = performance.now(); ctx.srSay(t('sr.tts.downloading'));
    carregar().then(async (mod) => {
      const [vocabulario, tabela] = await Promise.all([mod.vocabulario(), mod.voz(kv.voice)]);
      const sintetizarCom = async (sessao: SessaoKokoro, texto: string): Promise<Float32Array> => {
        const ids = tokenizar(await mod.fonemizar(texto, kv.espeak), vocabulario);
        return sessao.sintetizar(ids, estiloDaFrase(tabela, ids.length - 2));
      };
      let sessao: SessaoKokoro | null = null;
      try {
        const gpu = await mod.sessao('webgpu');
        if (eFala(await sintetizarCom(gpu, t('tts.kokoro.teste')))) { sessao = gpu; kokoroDispositivo = 'webgpu'; }
      } catch { /* no WebGPU here: WASM below */ }
      if (!sessao) { sessao = await mod.sessao('wasm'); kokoroDispositivo = 'wasm'; }
      const usada = sessao;
      const fala = falaPorWav(kv.voice, async (texto) => wavDe(await sintetizarCom(usada, texto)));
      ttsEngine = { id: 'kokoro', speak: (text: string) => { fala.falar(text); } };
      ttsLoading = false;
      try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (e) { /* noop */ }
      narrate(t('sr.tts.ready', { s: ((performance.now() - t0) / 1000).toFixed(0) }));
    }).catch(() => { ttsLoading = false; ttsFailed = true; ctx.srAlert(t('sr.tts.loadFailed')); });
  }

  function loadTTS(): void {
    if (ttsEngine || ttsLoading || ttsFailed) return;
    const sel = motorSel();
    if (sel !== 'kokoro') { // Kitten and eSpeak NG are not built
      if (sel !== 'webspeech') ctx.srAlert(t('sr.tts.engineNoLanguage'));
      return;
    }
    // ESTA MONTAGEM NÃO TRAZ MOTOR NEURAL (ADR-0094). Vem ANTES da pergunta do idioma de propósito: sem
    // porta, não há voz neural em idioma nenhum, e dizer «não há voz para o teu idioma» faria a criança
    // pensar que trocar de idioma resolveria. `ttsFailed` para não repetir a pergunta a cada fala.
    if (!ctx.carregarKokoro) { ttsFailed = true; ctx.srAlert(t('sr.tts.neuralNotBundled')); return; }
    // The voice in use for the current language (ADR-0185); a browser voice in use with Kokoro set explicitly gives way to the
    // language's first Kokoro voice. None: another language's voice is NOT fetched — it would read this text with the wrong phonetics.
    const atual = vozAtual();
    const fonte = atual?.engine === 'kokoro' ? atual : vozesDoIdioma(bcp47(), VOZES_KOKORO)[0] ?? null;
    if (!fonte) { ctx.srAlert(t('sr.tts.noNeuralForLanguage')); return; }
    carregarMotorKokoro(fonte);
  }

  function ttsSpeak(text: string): boolean {
    if (motorSel() !== 'webspeech') {
      // another voice picked, or the language changed, since the engine loaded: load the voice in use
      const emUso = vozAtual();
      if (ttsEngine && emUso?.engine !== 'webspeech' && vozCarregada !== emUso?.voice) { ttsEngine = null; ttsFailed = false; }
      if (ttsEngine && ttsEngine.speak) { try { ttsEngine.speak(text); } catch (e) { /* noop */ } return true; }
      loadTTS(); // motor neural (baixando/indisponível) → cai no fallback
    }
    return speakWebSpeech(text); // fallback imediato: Web Speech, no idioma do jogo
  }

  function narrate(text: string): void { // gated pelo toggle 'Narração (TTS)' do mixer, independente das legendas
    const cat = ctx.getAudioCat(); if (!ctx.getSoundOn() || !cat || !cat.tts || !cat.tts.on || !text) return;
    if (vozes().length === 0) return; // no voice speaks this language: narration is locked (ADR-0185 §4)
    _narrateCount++; ttsSpeak(text);
  }

  return {
    narrate, ttsSpeak, loadTTS, speakWebSpeech,
    getEngineSel: motorSel, setEngineSel: (v) => { ttsEngineSelExplicito = v; },
    getEngine: () => ttsEngine, getVoiceObj: () => _ttsVoiceObj, setVoiceObj: (v) => { _ttsVoiceObj = v; },
    get loading() { return ttsLoading; }, get failed() { return ttsFailed; }, get narrateCount() { return _narrateCount; },
    get neuralDisponivel() { return !!ctx.carregarKokoro; },
    get kokoroDispositivo() { return kokoroDispositivo; },
    vozes, vozAtual, setVoz,
  };
}
