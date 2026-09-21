// SPDX-License-Identifier: AGPL-3.0-or-later
// platform/vosk-runtime — THE RECOGNISER THAT HEARS COMMANDS, FROM THE GAME'S OWN ORIGIN (ADR-0189, ADR-0193; issue #184).
//
// The same shape as `platform/vision`, and for the same reasons: the runtime and the model are the files the install already
// fetched and checked by sha256 (`platform/pesados`), they are asked for at `pesados/<host><path>` beside the page, and a file
// that is not in the checked cache is never loaded — the loader answers WHICH ones are missing, so the child hears why speaking
// does not work instead of meeting a button that does nothing.
//
// 🎯 AND THIS RUNTIME EXISTS BECAUSE NO PUBLISHED ONE COULD BE USED: every `vosk-browser` build evaluates text as code, which
// this engine's policy refuses (ADR-0193 — never `'unsafe-eval'`, never a patch). It was rebuilt with `-s DYNAMIC_EXECUTION=0`
// and runs under the policy as it is (`docs/6-DevOps-SRE/models.md`).
//
// 🔴 IT IS AN ES MODULE THAT RESOLVES ITS OWN FILES THROUGH US, and this was MEASURED in a browser on 2026-09-21 after the
// first version of this loader assumed the opposite. The real bundle of `vosk-browser-dynamic-execution-0` ends in
// `export { createModel, Model, … }` and asks for the other two files by logical name:
//     new Worker(resolver("npm/vosk/vosk.worker.js"), { type: "module" })   ·   wasmUrl: this.resolver("npm/vosk/vosk.wasm")
// So it is loaded with `import()` (the same way `platform/vision` loads `tasks-vision`), and the resolver answers with the
// DELIVERY path of each file — which is how the service worker gets to serve all three from the checked cache.
//
// ⚠️ THE LESSON IS ABOUT THE GATE AND NOT ABOUT THE FILE: the old shape («a classic script that defines a global and finds its
// neighbours by itself») had seven red mutations against a double built in the image of that belief. A double can only measure
// the contract you think you have; the one that exists was three lines of the served file away.

import { PESADOS, CACHE_PESADOS, caminhoNaEntrega } from './pesados.js';
import { commandsLanguageOf } from './pesados-catalogo.js';

/** The three files of the runtime. The model is chosen by language, below. */
export const VOICE_RUNTIME_FILES = ['commands:runtime', 'commands:runtime:worker', 'commands:runtime:wasm'] as const;

/** The catalogue id of the model that hears THIS language, or `null` where the project has none. */
export function commandModelId(language: string): string | null {
  const wanted = language.split('-')[0]!.toLowerCase();
  const found = PESADOS.find((p) => commandsLanguageOf(p.id) === wanted);
  return found ? found.id : null;
}

/** What the recogniser answers with. `partial` grows during one utterance; `text` is the sentence once it ends. */
export interface VoskHeard { readonly result: { readonly partial?: string; readonly text?: string } }

export interface VoskRecognizer {
  on(event: 'partialresult' | 'result', cb: (heard: VoskHeard) => void): void;
  /** One block of sound, as the audio graph delivers it. */
  acceptWaveform(buffer: AudioBuffer): void;
  remove(): void;
}

export interface VoskModel {
  KaldiRecognizer: new (sampleRate: number, grammar: string) => VoskRecognizer;
  terminate?(): void;
}

/**
 * What the bundle exports. `resolve` is how it asks US for the two files it needs beside the model — the worker it spawns and
 * the wasm that worker loads — so nothing is ever guessed from the bundle's own address.
 */
export interface VoskApi {
  createModel(url: string, resolve: (logicalPath: string) => string, logLevel?: number): Promise<VoskModel>;
}

export interface VoskDeps {
  /** The page's address, to make the delivery paths absolute. */
  readonly base: string;
  /** The child's language (`core/i18n.bcp47`): it chooses the model. */
  readonly language: string;
  /** Whether a catalogue file (by its upstream address) is in the checked cache. */
  readonly hasFile?: (upstreamUrl: string) => Promise<boolean>;
  /** Imports the bundle and answers with what it exports. Injected so a gate never imports 3 MiB of wasm loader. */
  readonly loadBundle?: (absoluteUrl: string) => Promise<VoskApi>;
}

export type VoskLoad =
  | { readonly ok: true; readonly model: VoskModel }
  /** The catalogue ids that are not in the checked cache — `language` when the project has no model for it. */
  | { readonly ok: false; readonly missing: readonly string[] };

const urlOf = (id: string): string | null => PESADOS.find((x) => x.id === id)?.url ?? null;

const defaultHasFile = async (url: string): Promise<boolean> =>
  typeof caches !== 'undefined' && !!(await (await caches.open(CACHE_PESADOS)).match(url));

/**
 * Puts the bundle in the page ONCE and answers with its global. A second call answers the same one: the bundle registers a
 * worker and a wasm module, and loading it twice would pay for both again on a machine that has little of either.
 */
// 🔴 THE MEMO IS THE MODULE'S, not one per call, and a case is why: built inside `loadVoskRuntime` it was a new memo every
// time, so «once» only ever held within a single call and a second one put the bundle in the page again. It is keyed by the
// address, which is what identifies the bundle; a rejection is forgotten, so a load that failed on a bad minute can be retried.
const loadedBundles = new Map<string, Promise<VoskApi>>();

// ⚠️ THE ADDRESS IS ABSOLUTE AND THE BUNDLER MUST NOT FOLLOW IT: these bytes are not ours, they arrive with the delivery at
// runtime. The same `@vite-ignore` the vision runtime carries, for the same reason.
const moduleLoader = async (absoluteUrl: string): Promise<VoskApi> =>
  (await import(/* @vite-ignore */ absoluteUrl)) as VoskApi;

/**
 * ONCE PER ADDRESS, whoever the loader is — and it wraps the INJECTED loader too, because «once» is a promise of this runtime
 * and not a detail of one way of loading. A gate that could only reach it through the default loader would be measuring the
 * default loader; this way the rule is the same one the page runs.
 */
function bundleOnce(load: (url: string) => Promise<VoskApi>, absoluteUrl: string): Promise<VoskApi> {
  const alreadyAsked = loadedBundles.get(absoluteUrl);
  if (alreadyAsked) return alreadyAsked;
  const pending = (async (): Promise<VoskApi> => {
    const api = await load(absoluteUrl);
    if (typeof api?.createModel !== 'function') {
      throw new Error('vosk-runtime: the bundle exported no `createModel` — the delivery has the wrong file');
    }
    return api;
  })();
  loadedBundles.set(absoluteUrl, pending);
  pending.catch(() => { loadedBundles.delete(absoluteUrl); });
  return pending;
}

/**
 * Opens the recogniser for the child's language, or says what is missing.
 *
 * ⚠️ THE MODEL IS A `.tar.gz` THE BUNDLE FETCHES ITSELF, so what it is given is the DELIVERY path: the service worker answers it
 * from the checked cache, and a school with no network after the first day still hears the child (pillar 8).
 */
export async function loadVoskRuntime(d: VoskDeps): Promise<VoskLoad> {
  const modelId = commandModelId(d.language);
  if (!modelId) return { ok: false, missing: ['language'] };
  const hasFile = d.hasFile ?? defaultHasFile;
  const missing: string[] = [];
  for (const id of [...VOICE_RUNTIME_FILES, modelId]) {
    const url = urlOf(id);
    if (!url || !(await hasFile(url))) missing.push(id);
  }
  if (missing.length) return { ok: false, missing };

  const at = (id: string): string => new URL(caminhoNaEntrega(urlOf(id)!), d.base).href;
  const api = await bundleOnce(d.loadBundle ?? moduleLoader, at('commands:runtime'));
  /*
   * WHERE THE BUNDLE'S TWO NEIGHBOURS LIVE, answered by us and never guessed. The logical names are the bundle's own
   * (`npm/vosk/…`), and an unknown one THROWS instead of falling back to a file that happens to be handy: a worker fed the
   * wasm, or the other way round, fails deep inside a thread with no way back to the child.
   */
  const beside = (logicalPath: string): string => {
    if (logicalPath.endsWith('.worker.js')) return at('commands:runtime:worker');
    if (logicalPath.endsWith('.wasm')) return at('commands:runtime:wasm');
    throw new Error(`vosk-runtime: the bundle asked for a file this delivery does not carry: ${logicalPath}`);
  };
  // 📌 `-1` is the bundle's «say nothing»: a recogniser that logs every frame fills a school machine's console with noise.
  return { ok: true, model: await api.createModel(at(modelId), beside, -1) };
}
