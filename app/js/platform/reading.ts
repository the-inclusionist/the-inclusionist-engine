// SPDX-License-Identifier: AGPL-3.0-or-later
// platform/reading — THE CHILD READS ALOUD, AND THE GAME RECEIVES TEXT (ADR-0216, issue #200).
//
// The Dev, 2026-09-21: «a engine deve oferecer objetos de leitura e TTS. O jogo não deve precisar saber como isso funciona, apenas
// deve pedir para ouvir e receber o texto.» So this module answers ONE question — what did the child say — and keeps the rest:
// which recogniser heard it, in which language, and whether it may run at all.
//
// · ON THE DEVICE OR NOT AT ALL (ADR-0200 erratum). The browser's recogniser is used only where it says it recognises on the device
//   AND the language is installed there (`platform/speech-recognition`). Anything else waits for the models the project carries
//   (Whisper for pt, Moonshine for en and es — ADR-0201), which arrive through `engine` below and are not built yet: until then a
//   request is REFUSED with its reason, never answered by a recogniser that would send a child's voice to a server.
// · A reading ends when the child stops talking (`silenceMs`) or when the time runs out (`maxMs`), whichever comes first, and what
//   was heard so far is what the game gets — a child who stops mid-sentence is not an error.
// · Asking twice does not open two microphones: the second caller waits on the same reading.

import { rotaDoReconhecimento, criarReconhecimentoLocal, type ApiDeReconhecimento, type EstadoLocal, type InstanciaDeReconhecimento } from './speech-recognition.js';

/** The browser's recognition object, with the parts a reading uses. Assigned handlers, as the API has them. */
export interface ListeningSession extends InstanciaDeReconhecimento {
  start(): void;
  stop(): void;
  onresult: ((ev: { readonly results: ArrayLike<ArrayLike<{ readonly transcript: string }> & { readonly isFinal: boolean }> }) => void) | null;
  onerror: ((ev: { readonly error?: string }) => void) | null;
  onend: (() => void) | null;
}

/** What a reading gives back. `route` is which recogniser heard it — for `problems` and for a lab, never for the game's logic. */
export interface Heard {
  readonly text: string;
  readonly route: 'webspeech-local' | 'model';
  /** The reading stopped because the child went quiet, because the time ran out, or because someone asked it to stop. */
  readonly ended: 'silence' | 'timeout' | 'asked';
}

export interface ReadingDeps {
  /** The BCP-47 tag of the child's language (`core/i18n.bcp47`). */
  readonly language: () => string;
  /** The browser's `SpeechRecognition` constructor, or nothing where there is none. */
  readonly api?: ApiDeReconhecimento | null;
  readonly now: () => number;
  readonly every: (fn: () => void, ms: number) => unknown;
  readonly stopEvery: (h: unknown) => void;
  /** A line for `problems`, written once per reason (ADR-0169). */
  readonly report: (line: string) => void;
  /**
   * The engine's own recogniser, when there is one to load — the models of ADR-0201, lazily (`platform/reading-runtime`).
   * Absent: the refusal below.
   */
  readonly model?: (language: string) => Promise<{ transcribe(samples: Float32Array): Promise<string> }>;
  /**
   * The microphone, as 16 kHz mono samples. The model route needs sound, and the browser route does not: the browser's own
   * recogniser opens the microphone itself. ⚠️ Absent with a model present is a reading that REFUSES and says which half is
   * missing — never one that answers an empty sentence, which a game would show a child as «you read nothing».
   */
  readonly record?: (options: ListenOptions) => Promise<Float32Array>;
  readonly route?: typeof rotaDoReconhecimento;
  readonly createSession?: (api: ApiDeReconhecimento, language: string) => ListeningSession;
}

export interface ListenOptions {
  /** How long a silence ends the reading. Default 1.5 s: shorter cuts a child who is thinking between words. */
  readonly silenceMs?: number;
  /** The ceiling, so a forgotten microphone does not listen for ever. Default 30 s, the window Whisper reads at once. */
  readonly maxMs?: number;
}

export interface Reading {
  /** Listens until the child goes quiet, and answers with what was read. */
  listen(options?: ListenOptions): Promise<Heard>;
  /** Gives the microphone back now; the reading in hand answers with what it has. */
  stop(): void;
  /** Can this device serve the child's language at all? Answers with the reason when it cannot. */
  ready(): Promise<{ readonly can: boolean; readonly why: EstadoLocal | 'sem-api' | 'sem-processamento-local' | 'no-model' }>;
}

const SILENCE_MS = 1500;
const MAX_MS = 30_000;

export function createReading(d: ReadingDeps): Reading {
  const routeOf = d.route ?? rotaDoReconhecimento;
  const make = d.createSession ?? ((api, language) => criarReconhecimentoLocal(api, language) as ListeningSession);
  const said = new Set<string>();
  const once = (key: string, line: string): void => { if (!said.has(key)) { said.add(key); d.report(line); } };

  let inFlight: Promise<Heard> | null = null;
  let askToStop: ((why: 'asked') => void) | null = null;

  async function ready(): Promise<{ can: boolean; why: EstadoLocal | 'sem-api' | 'sem-processamento-local' | 'no-model' }> {
    const { rota: route, estado: state } = await routeOf(d.language(), d.api);
    if (route === 'webspeech-local') return { can: true, why: state };
    return { can: !!d.model, why: d.model ? state : 'no-model' };
  }

  function byBrowser(api: ApiDeReconhecimento, options: ListenOptions): Promise<Heard> {
    const silenceMs = options.silenceMs ?? SILENCE_MS;
    const maxMs = options.maxMs ?? MAX_MS;
    return new Promise<Heard>((resolve, reject) => {
      let session: ListeningSession;
      try { session = make(api, d.language()); } catch (e) { reject(e instanceof Error ? e : new Error(String(e))); return; }
      let text = '', lastSound = d.now(), done = false;
      const ticker = d.every(() => {
        if (done) return;
        const quietFor = d.now() - lastSound;
        if (quietFor >= silenceMs && text) finish('silence');
        else if (d.now() - startedAt >= maxMs) finish('timeout');
      }, 100);
      const startedAt = d.now();
      const finish = (ended: Heard['ended']): void => {
        if (done) return;
        done = true;
        d.stopEvery(ticker);
        askToStop = null;
        try { session.stop(); } catch { /* a session that already ended is not a failure */ }
        resolve({ text: text.trim(), route: 'webspeech-local', ended });
      };
      askToStop = () => finish('asked');
      session.onresult = (ev) => {
        let together = '';
        for (let i = 0; i < ev.results.length; i++) together += `${ev.results[i]![0]!.transcript} `;
        text = together;
        lastSound = d.now();
      };
      session.onerror = (ev) => {
        // ⚠️ A refusal is not a silence: a child waiting to be heard must not wait for ever, and the adult must read why.
        once('error', `reading: the browser's recogniser stopped (${ev.error ?? 'unknown'}) — the child reads and nothing is heard; `
          + 'allow the microphone for this page, or install the language on the device');
        if (!done) { done = true; d.stopEvery(ticker); askToStop = null; reject(new Error(ev.error ?? 'recognition failed')); }
      };
      session.onend = () => { if (!done) finish(text ? 'silence' : 'asked'); };
      session.start();
    });
  }

  return {
    ready,
    stop() { askToStop?.('asked'); },
    async listen(options = {}) {
      if (inFlight) return inFlight;                       // one microphone, one reading: the second caller waits on the first
      const { rota: route, estado: state } = await routeOf(d.language(), d.api);
      if (route !== 'webspeech-local') {
        if (!d.model) {
          once('sem-route', `reading: nothing on this device can hear ${d.language()} (${state}) — the child's reading is not assessed; `
            + 'install the language in the browser, or build a delivery that carries the reading model for this language');
          throw new Error(`reading is not available here: ${state}`);
        }
        if (!d.record) {
          once('sem-microfone', `reading: the model for ${d.language()} is here and nothing captures the child's voice — `
            + 'the reading cannot run; pass `record`, the 16 kHz samples the model reads');
          throw new Error('reading has no microphone here');
        }
        const capture = d.record;
        inFlight = (async () => {
          const [transcriber, samples] = await Promise.all([d.model!(d.language()), capture(options)]);
          return { text: (await transcriber.transcribe(samples)).trim(), route: 'model' as const, ended: 'silence' as const };
        })();
      } else {
        inFlight = byBrowser(d.api!, options);
      }
      try { return await inFlight; } finally { inFlight = null; }
    },
  };
}
