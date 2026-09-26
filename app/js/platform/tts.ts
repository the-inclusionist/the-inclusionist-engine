// SPDX-License-Identifier: AGPL-3.0-or-later
// platform/tts — spoken narration. The browser's voice speaks first (Web Speech, ADR-0200); the neural fallback is Kokoro, which
// THE ENGINE ITSELF loads from the delivery (ADR-0216 §1) the first time a child picks it — the game only says it wants one; the
// loader, the browser's speech, the clock and the `<audio>` maker are the root's, received here (ADR-0232 D4). narrate()
// is the entry point, gated by the mixer's narration toggle (audioCat.tts.on) — independent of captions. The PANEL's side (the
// engine and voice lists) lives in `ui/voice-settings` and reads and writes the choice through this module. Injection by closure.
//
// A SPOKEN TEXT CARRIES ITS LANGUAGE (ADR-0243): `narrate` takes a text, in the interface's language, or parts spoken in order —
// the frame in the interface's voice, the content in a voice of its own language (`voice-plan.voiceOfLanguage`).

import type { Store } from './storage.js';
import { KEYS } from './storage-keys.js';
import type { Translator } from '../core/i18n.js';
import { createInterruptibleSpeech, type InterruptibleSpeech } from './interruptible-speech.js';
import { voicesForLocale, voiceOfLanguage, speaksLanguageOf, languageName, type NeuralVoice } from './voice-plan.js';
import { spokenWords, speechSeconds, speechPlaybackRate } from '../core/speech-rate.js';
import {
  KOKORO_VOICES, tokenize, sentenceStyle, eFala, wavDe,
  type LoadKokoro, type KokoroSession, type KokoroVoice,
} from './kokoro.js';

import type { SpeechPort } from './speech.js';

// Declared here until ADR-0216 and answered from the leaf now; `LoadKokoro` is re-exported because the engine imports it
// from here (issue #204).
export type { LoadKokoro };

/**
 * A PART OF A SPOKEN TEXT (ADR-0243 §1). Without `language` it is FRAME, read by the interface's voice; with a BCP-47 `language`
 * it is CONTENT, read by a voice of that language and never by a voice of another one (§2) — an English word in a Portuguese
 * activity is read by an English voice. A game already keeps the frame in keys and the content in `{params}`; this says which is which.
 */
export interface SpokenPart {
  readonly text: string;
  readonly language?: string;
}
/** What narration speaks: a text in the interface's language, or parts spoken in order, each in its own language. */
export type SpokenText = string | readonly SpokenPart[];

/** `finished` is called once the utterance is over, however it ends: what lets parts be spoken in order. */
interface TtsEngine { id: string; speak: (text: string, finished?: () => void) => void; }
/** One neural utterance: its text and the Kokoro voice that reads it. */
interface NeuralRequest { readonly text: string; readonly voice: KokoroVoice; }
/** One part, ready: an utterance for the browser's own queue, or a neural utterance that says when it is over. */
type Segment = { readonly browser: () => SpeechSynthesisUtterance } | { readonly neural: (finished: () => void) => void };

export interface TtsCtx {
  /**
   * Where the chosen engine and voice are kept: the page's store, built by the root (ADR-0232, issue #207). Required — a
   * voice choice read from nowhere would speak with the first voice of the list at every visit, and the child who picked
   * one would lose it in silence.
   */
  store: Pick<Store, 'get' | 'set'>;
  /**
   * The root's translator, narrowed to what narration needs (ADR-0232 D3): `t` for what it announces, and `bcp47()` — the
   * PAGE's language tag, read at every utterance and every voice list — because narration speaks the language of now.
   * REQUIRED: a voice that did not know the page's language would read English words with Portuguese phonetics.
   */
  translator: Pick<Translator, 't' | 'bcp47'>;
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
   * How that voice is built (ADR-0216 §1 and §5). REQUIRED (ADR-0232 D4): the root's loader reads the delivery with the host's
   * `fetch` and WebAssembly — `import('platform/kokoro-runtime')` at the FIRST neural utterance and not before, so a game that never
   * speaks neurally never loads a byte of espeak-ng or the ONNX runtime. A game under `createGame` never passes this — it says
   * `uses: { neuralVoice: true }` and the engine does the rest; a case hands in a module without a wasm engine.
   */
  loadKokoro: LoadKokoro;
  /** The child's speech rate, words a minute (ADR-0183 §1). Absent = each voice at its own rate. */
  getSpeechPpm?: () => number;
  /**
   * Makes the element a neural utterance plays through: the root's `<audio>`, in its document. REQUIRED (ADR-0232 D4). An element,
   * not an `AudioBufferSourceNode`: only a media element changes speed without changing pitch.
   */
  createAudio: () => HTMLAudioElement;
  /** The browser's speech (`platform/speech`'s port), lent by the root from `host.win`. REQUIRED (ADR-0232 D4). */
  speech: SpeechPort;
  /** The clock a browser utterance and a neural load are timed with: the root's `performance.now`. REQUIRED (ADR-0232 D4). */
  now: () => number;
  /**
   * Where a line of `problems` goes (ADR-0169): the root's list. Written once per language a part asked for and the device has no
   * voice for (ADR-0243 §3). Absent, nothing is reported — a `tts` built outside a root has no `problems` to write to.
   */
  report?: (line: string) => void;
}

export interface Tts {
  /** The entry point, gated by the mixer: a text in the interface's language, or parts in order (ADR-0243 §1). */
  narrate: (text: SpokenText) => void;
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
   * DOES THIS GAME ASK FOR A NEURAL ENGINE? (ADR-0216 §3) The audio panel asks before offering it: an option that cannot
   * work is worse than one option fewer — whoever picks it waits for a download that never starts, and whoever navigates
   * by ear has no way to see that it did not start.
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
  const { t, bcp47 } = ctx.translator;
  let ttsEngine: TtsEngine | null = null, ttsLoading = false, ttsFailed = false, _narrateCount = 0;
  let _ttsVoiceObj: SpeechSynthesisVoice | null = null; // the selected Web Speech voice
  // An engine set explicitly (stored, or by the panel) wins; otherwise the engine of the voice in use, which is the browser's when it
  // offers one for the language (ADR-0200) — measured on the device at every call, since the browser lists its voices late.
  const stored: string | null = ctx.store.get(KEYS.ttsEngine, null) || null; // webspeech | kokoro | kitten | espeak
  let ttsEngineSelExplicito: string | null = stored && !ENGINES_THAT_LEFT.includes(stored) ? stored : null;
  const engineSel = (): string => {
    if (ttsEngineSelExplicito) return ttsEngineSelExplicito;
    const e = voiceInUse()?.engine;
    // a fallback this game did not ask for is not the default: undeclared, the browser's voice (no «not bundled» alert)
    return e === 'kokoro' && ctx.neuralVoice ? e : 'webspeech';
  };
  let kokoroBackend: 'webgpu' | 'wasm' | null = null;
  let loadedVoice: string | null = null; // the voice the loaded engine speaks; another choice reloads it
  /** The loaded Kokoro model's speaker, any of its voices; null until the model loads. */
  let neural: InterruptibleSpeech<NeuralRequest> | null = null;
  /** A narration's number: a newer one ends the parts an older one has still to speak (ADR-0243 §1). */
  let narrationTurn = 0;
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
  /** Every voice the browser lists, in every language: what a part in another language is matched against (ADR-0243 §2). */
  const deviceVoices = (): readonly NeuralVoice[] => {
    let list: readonly SpeechSynthesisVoice[] = [];
    try { list = ctx.speech.synth()?.getVoices() ?? []; } catch { /* no speech synthesis here */ }
    return list.map((v) => ({ locale: v.lang.replace('_', '-'), engine: 'webspeech', voice: 'webspeech:' + v.name }));
  };
  const availableVoices = (): readonly NeuralVoice[] => [...voicesForLocale(bcp47(), deviceVoices()), ...(ctx.neuralVoice ? voicesForLocale(bcp47(), KOKORO_VOICES) : [])];
  /** The browser voice an entry names, or null. */
  const browserVoice = (id: string | undefined): SpeechSynthesisVoice | null => {
    if (!id?.startsWith('webspeech:')) return null;
    try { return ctx.speech.synth()?.getVoices().find((v) => 'webspeech:' + v.name === id) ?? null; } catch { return null; }
  };
  /** The interface's voice (ADR-0243 §2 over the language of now): the stored choice, else the exact tag, else the language. */
  function voiceInUse(): NeuralVoice | null {
    return voiceOfLanguage(bcp47(), availableVoices(), [ctx.store.get(KEYS.ttsVoz, null)]);
  }
  function chooseVoice(id: string): boolean {
    if (!availableVoices().some((v) => v.voice === id)) return false;
    ctx.store.set(KEYS.ttsVoz, id);
    ttsEngineSelExplicito = availableVoices().find((v) => v.voice === id)!.engine;
    _ttsVoiceObj = browserVoice(id);
    return true;
  }

  /**
   * NARRATION FOLLOWS THE LANGUAGE OF NOW (ADR-0243 §5): the page's voice object when it speaks the language of now; one picked in
   * another language is dropped at the first utterance after the switch, and the voice in use for the new language speaks instead.
   */
  function voiceObjectOfNow(): SpeechSynthesisVoice | null {
    if (_ttsVoiceObj && !speaksLanguageOf(_ttsVoiceObj.lang.replace('_', '-'), bcp47())) _ttsVoiceObj = null;
    return _ttsVoiceObj;
  }

  /**
   * One browser utterance: `lang` is the tag the text is in and `voice` a voice of it, or null for the browser to choose by the tag.
   * ADR-0183 §1: the browser's `rate` is a multiplier. The voice's words a minute at rate 1 is measured on its own utterances (start
   * to end, so the silent ends count — an approximation the neural path does not need); until one is measured, 1.
   */
  function browserUtterance(text: string, lang: string, voice: SpeechSynthesisVoice | null): SpeechSynthesisUtterance {
    const u = ctx.speech.utterance(text); u.lang = lang; if (voice) u.voice = voice; u.volume = Math.min(1, ctx.getVolume() * 1.4);
    const voiceIdOf = 'webspeech:' + (voice?.name ?? lang);
    const words = spokenWords(text);
    const voiceBase = voiceAverage.get(voiceIdOf) ?? null;
    u.rate = ctx.getSpeechPpm && voiceBase ? speechPlaybackRate(0, 0, ctx.getSpeechPpm(), voiceBase).rate : 1;
    let startAt = 0;
    u.onstart = () => { startAt = ctx.now(); };
    u.onend = () => {
      const seconds = startAt ? (ctx.now() - startAt) / 1000 : 0;
      const measured = speechPlaybackRate(words, seconds, 150, null).voiceWpm;
      if (measured) media(voiceIdOf, measured / u.rate);
    };
    return u;
  }

  /**
   * An utterance in the interface's language. `u.lang` follows the game's language: fixed at pt-BR, a game in English or Spanish
   * would ask the browser for a PORTUGUESE voice for a text that is not Portuguese — and the result is not an accent, it is
   * unintelligible: the wrong phonetics applied to the wrong letters.
   */
  const interfaceUtterance = (text: string): SpeechSynthesisUtterance =>
    browserUtterance(text, bcp47(), voiceObjectOfNow() ?? browserVoice(voiceInUse()?.voice));

  function speakWebSpeech(text: string): boolean {
    try {
      const ss = ctx.speech.synth(); if (!ss) return false; ss.cancel();
      ss.speak(interfaceUtterance(text)); return true;
    } catch (e) { return false; }
  }

  /**
   * A neural voice's utterances, whatever made the WAV (ADR-0183 §1): every utterance is measured — its words over its speech time,
   * silent ends trimmed — and played at the child's rate over the voice's, through a media element that keeps the pitch. Each
   * request names its voice, so one loaded model reads the parts of every language it has a voice for (ADR-0243 §2).
   */
  function speakByWav(produce: (request: NeuralRequest) => Promise<ArrayBuffer>): InterruptibleSpeech<NeuralRequest> {
    return createInterruptibleSpeech<{ url: string; rate: number }, HTMLAudioElement, NeuralRequest>({
      synthesize: async (request) => {
        const { text } = request, voiceId = request.voice.voice;
        const bytes = await produce(request);
        const ac = ctx.ensureAC();
        if (!ac) throw new Error('AudioContext unavailable'); // the `catch` there handles it: this item is silent, the engine lives
        let speedRatio = 1;
        if (ctx.getSpeechPpm) {
          const buf = await ac.decodeAudioData(bytes.slice(0));
          const measure = speechPlaybackRate(spokenWords(text), speechSeconds(buf.getChannelData(0), buf.sampleRate), ctx.getSpeechPpm(), voiceAverage.get(voiceId) ?? null);
          media(voiceId, measure.voiceWpm);
          speedRatio = measure.rate;
        }
        return { url: URL.createObjectURL(new Blob([bytes], { type: 'audio/wav' })), rate: speedRatio };
      },
      play: (sound, onFinish) => {
        const ac = ctx.ensureAC();
        if (!ac) { URL.revokeObjectURL(sound.url); return null; }
        const el = ctx.createAudio();
        el.preservesPitch = true;
        el.src = sound.url;
        el.playbackRate = sound.rate;
        try { ac.createMediaElementSource(el).connect(ctx.catNode('tts') || ctx.audioOut() || ac.destination); } catch { /* already routed */ }
        el.onended = () => { URL.revokeObjectURL(sound.url); onFinish(); };
        void el.play().catch(() => { URL.revokeObjectURL(sound.url); onFinish(); });
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
    const load = ctx.loadKokoro;
    const kv = KOKORO_VOICES.find((v) => v.voice === forVoice.voice);
    if (!kv) { ttsFailed = true; ctx.srAlert(t('sr.tts.neuralNotBundled')); return; }
    ttsLoading = true; loadedVoice = forVoice.voice; const t0 = ctx.now(); ctx.srSay(t('sr.tts.downloading'));
    load().then(async (mod) => {
      const [symbolIds, table] = await Promise.all([mod.vocabulary(), mod.voice(kv.voice)]);
      // Each voice's style table, fetched the first time an utterance asks for that voice; a failed fetch is tried again.
      const tables = new Map<string, Promise<Float32Array>>([[kv.voice, Promise.resolve(table)]]);
      const tableOf = (voice: KokoroVoice): Promise<Float32Array> => {
        let styles = tables.get(voice.voice);
        if (!styles) { styles = mod.voice(voice.voice); tables.set(voice.voice, styles); styles.catch(() => tables.delete(voice.voice)); }
        return styles;
      };
      const synthesiseWith = async (kokoroSession: KokoroSession, text: string, voice: KokoroVoice): Promise<Float32Array> => {
        const ids = tokenize(await mod.phonemize(text, voice.espeak), symbolIds);
        return kokoroSession.synthesize(ids, sentenceStyle(await tableOf(voice), ids.length - 2));
      };
      let kokoroSession: KokoroSession | null = null;
      try {
        const gpu = await mod.session('webgpu');
        if (eFala(await synthesiseWith(gpu, t('tts.kokoro.teste'), kv))) { kokoroSession = gpu; kokoroBackend = 'webgpu'; }
      } catch { /* no WebGPU here: WASM below */ }
      if (!kokoroSession) { kokoroSession = await mod.session('wasm'); kokoroBackend = 'wasm'; }
      const used = kokoroSession;
      const speaker = speakByWav(async (request) => wavDe(await synthesiseWith(used, request.text, request.voice)));
      neural = speaker;
      ttsEngine = { id: 'kokoro', speak: (text, finished) => { speaker.speak({ text, voice: kv }, finished); } };
      ttsLoading = false;
      try { ctx.speech.synth()?.cancel(); } catch (e) { /* noop */ }
      narrate(t('sr.tts.ready', { s: ((ctx.now() - t0) / 1000).toFixed(0) }));
    }).catch(() => { ttsLoading = false; ttsFailed = true; ctx.srAlert(t('sr.tts.loadFailed')); });
  }

  function loadTTS(): void {
    if (ttsEngine || ttsLoading || ttsFailed) return;
    const sel = engineSel();
    if (sel !== 'kokoro') { // Kitten and eSpeak NG are not built
      if (sel !== 'webspeech') ctx.srAlert(t('sr.tts.engineNoLanguage'));
      return;
    }
    // THIS GAME DID NOT ASK FOR A NEURAL VOICE (ADR-0216 §3). It comes BEFORE the language question on purpose: without
    // the declaration there is no neural voice in any language — the delivery does not carry the model — and saying "there
    // is no voice for your language" would make the child think switching language would fix it. `ttsFailed` so it is not
    // repeated on every utterance.
    if (!ctx.neuralVoice) { ttsFailed = true; ctx.srAlert(t('sr.tts.neuralNotBundled')); return; }
    // The voice in use for the current language (ADR-0185); a browser voice in use with Kokoro set explicitly gives way to the
    // language's first Kokoro voice. None: another language's voice is NOT fetched — it would read this text with the wrong phonetics.
    const current = voiceInUse();
    const forVoice = current?.engine === 'kokoro' ? current : voicesForLocale(bcp47(), KOKORO_VOICES)[0] ?? null;
    if (!forVoice) { ctx.srAlert(t('sr.tts.noNeuralForLanguage')); return; }
    loadKokoroEngine(forVoice);
  }

  /** The loaded neural engine when the interface speaks neurally; else it starts loading, and the browser speaks meanwhile. */
  function interfaceEngine(): TtsEngine | null {
    if (engineSel() === 'webspeech') return null;
    // another voice picked, or the language changed, since the engine loaded: load the voice in use
    const inUse = voiceInUse();
    if (ttsEngine && inUse?.engine !== 'webspeech' && loadedVoice !== inUse?.voice) { ttsEngine = null; ttsFailed = false; }
    if (!ttsEngine) loadTTS(); // the neural engine is downloading or unavailable → falls back
    return ttsEngine;
  }

  function ttsSpeak(text: string): boolean {
    const engine = interfaceEngine();
    if (engine) { try { engine.speak(text); } catch (e) { /* noop */ } return true; }
    neural?.silence(); // a neural part still speaking gives way: the latest narration is the one that counts
    return speakWebSpeech(text); // immediate fallback: Web Speech, in the game's language
  }

  /** A FRAME part (ADR-0243 §1): the interface's voice, as a text narrated alone; none while narration is locked (ADR-0185 §4). */
  function frameSegment(text: string): Segment | null {
    if (availableVoices().length === 0) return null;
    const engine = interfaceEngine();
    if (engine) return { neural: (finished) => { engine.speak(text, finished); } };
    return { browser: () => interfaceUtterance(text) };
  }

  /**
   * A CONTENT part (ADR-0243 §2): a voice of its language — the browser's first, then the neural ones this game asked for, which
   * read only once the model is loaded; while it loads, the part starts the load and a browser voice of the language reads it if
   * the device has one. `null`: the device has no voice for the language, and no voice of another language reads it instead.
   */
  function contentSegment(text: string, language: string): Segment | null {
    const chosen = chosenVoices();
    const neuralVoices = ctx.neuralVoice && !ttsFailed ? KOKORO_VOICES : [];
    const best = voiceOfLanguage(language, [...deviceVoices(), ...neuralVoices], chosen);
    if (!best) return noVoiceSegment(language);
    const kokoro = KOKORO_VOICES.find((v) => v.voice === best.voice);
    return kokoro ? neuralSegment(text, language, kokoro, chosen) : browserSegment(text, language, best);
  }

  /** The languages this root has already said it has no voice for, by primary language (ADR-0243 §3). */
  const toldNoVoice = new Set<string>();
  /**
   * NO VOICE FOR IT, NO WRONG VOICE (ADR-0243 §3): the part is not spoken — the text stays on the screen. Once per language, the
   * interface's voice says so in its place, and `problems` gets one line naming the language and the fix.
   */
  function noVoiceSegment(language: string): Segment | null {
    const english = languageName(language, 'en');
    const code = language.split('-')[0]!.toLowerCase();
    if (toldNoVoice.has(code)) return null;
    toldNoVoice.add(code);
    ctx.report?.(`narration: the device lacks a voice for ${english} (${code}), so a part a game gave in ${english} is not read aloud `
      + `and a child who listens does not hear it (the text stays on the screen) — install a voice for ${english} on the device, `
      + `in its text-to-speech settings`);
    return frameSegment(t('sr.tts.noVoiceForLanguage', { language: languageName(language, bcp47()) }));
  }

  /** The voices the child chose, in order of precedence: the page's voice object, then the stored choice (ADR-0243 §2). */
  const chosenVoices = (): readonly (string | null)[] =>
    [_ttsVoiceObj ? 'webspeech:' + _ttsVoiceObj.name : null, ctx.store.get(KEYS.ttsVoz, null)];

  const browserSegment = (text: string, language: string, voice: NeuralVoice): Segment =>
    ({ browser: () => browserUtterance(text, language, browserVoice(voice.voice)) });

  /** A part a Kokoro voice reads; while the model loads, a browser voice of the language reads it if the device has one. */
  function neuralSegment(text: string, language: string, voice: KokoroVoice, chosen: readonly (string | null)[]): Segment | null {
    const speaker = neural;
    if (speaker) return { neural: (finished) => { speaker.speak({ text, voice }, finished); } };
    if (!ttsLoading) loadKokoroEngine(voice);
    const meanwhile = voiceOfLanguage(language, deviceVoices(), chosen);
    return meanwhile ? browserSegment(text, language, meanwhile) : null;
  }

  /** Resolves when an utterance is over, however it ends — set before it is queued. */
  const utteranceOver = (u: SpeechSynthesisUtterance): Promise<void> => new Promise((over) => {
    const measure = u.onend;
    u.onend = function (this: SpeechSynthesisUtterance, e: SpeechSynthesisEvent) { measure?.call(this, e); over(); };
    u.onerror = () => { over(); };
  });

  /** Queues the browser parts from `from` on at once; `over` resolves when the last is over, when a part follows them. */
  function queueBrowserParts(ss: SpeechSynthesis | null, segments: readonly Segment[], from: number): { next: number; over: Promise<void> | null } {
    const queued: SpeechSynthesisUtterance[] = [];
    let i = from;
    for (let s = segments[i]; s && 'browser' in s; s = segments[++i]) queued.push(s.browser());
    const last = queued.at(-1);
    const over = ss && last && i < segments.length ? utteranceOver(last) : null;
    try { for (const u of queued) ss?.speak(u); } catch (e) { /* the device refused to speak: the rest goes on */ }
    return { next: i, over };
  }

  /**
   * THE PARTS, IN ORDER (ADR-0243 §1). Browser utterances go into the browser's own queue at once, each with its tag and voice; a
   * neural part waits for what is before it to end, and what follows waits for it. A newer narration ends the rest.
   */
  async function speakInOrder(segments: readonly Segment[], turn: number): Promise<void> {
    const ss = ctx.speech.synth();
    try { ss?.cancel(); } catch (e) { /* noop */ }
    neural?.silence();
    let i = 0;
    while (i < segments.length && turn === narrationTurn) {
      const first = segments[i]!;
      if ('neural' in first) { await new Promise<void>((over) => { first.neural(over); }); i++; continue; }
      const queuedParts = queueBrowserParts(ss, segments, i);
      i = queuedParts.next;
      if (queuedParts.over) await queuedParts.over;
    }
  }

  function narrate(text: SpokenText): void { // gated by the mixer's narration toggle, independent of captions
    const cat = ctx.getAudioCat(); if (!ctx.getSoundOn() || !cat || !cat.tts || !cat.tts.on) return;
    if (typeof text !== 'string') { narrateParts(text); return; }
    if (!text) return;
    if (availableVoices().length === 0) return; // no voice speaks this language: narration is locked (ADR-0185 §4)
    narrationTurn++; _narrateCount++; ttsSpeak(text);
  }

  function narrateParts(parts: readonly SpokenPart[]): void {
    const segments = parts.filter((p) => p.text)
      .map((p) => (p.language ? contentSegment(p.text, p.language) : frameSegment(p.text)))
      .filter((s): s is Segment => s !== null);
    if (!segments.length) return;
    _narrateCount++;
    void speakInOrder(segments, ++narrationTurn);
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
