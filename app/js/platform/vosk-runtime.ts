// SPDX-License-Identifier: AGPL-3.0-or-later
// platform/vosk-runtime — THE RECOGNISER THAT HEARS COMMANDS, FROM THE GAME'S OWN ORIGIN (ADR-0189, ADR-0193; issue #184).
//
// The same shape as `platform/vision`, and for the same reasons: the runtime and the model are the files the install already
// fetched and checked by sha256 (`platform/heavy`), they are asked for at `heavy/<host><path>` beside the page, and a file
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

import { HEAVY_FILES, deliveryPath } from './heavy.js';
import { commandsLanguageOf } from './heavy-catalogue.js';
import { readModelVocabulary } from './vosk-vocabulary.js';

/** The three files of the runtime. The model is chosen by language, below. */
export const VOICE_RUNTIME_FILES = ['commands:runtime', 'commands:runtime:worker', 'commands:runtime:wasm'] as const;

/** The catalogue id of the model that hears THIS language, or `null` where the project has none. */
export function commandModelId(language: string): string | null {
  const wanted = language.split('-')[0]!.toLowerCase();
  const found = HEAVY_FILES.find((p) => commandsLanguageOf(p.id) === wanted);
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
  /**
   * Whether a catalogue file (by its upstream address) is in the checked cache — `platform/heavy`'s `checkedCacheHas`, over the
   * host's `caches`. REQUIRED (ADR-0232 D4): the root lends the cache; this module reaches none.
   */
  readonly hasFile: (upstreamUrl: string) => Promise<boolean>;
  /**
   * Imports the bundle and answers with what it exports — `createBundleLoader` below, built ONCE by the root, so the bundle is
   * put in the page once per address. REQUIRED, and injected so a gate never imports 3 MiB of wasm loader.
   */
  readonly loadBundle: (absoluteUrl: string) => Promise<VoskApi>;
  /**
   * The host's `fetch`, lent by the root, to read the MODEL'S VOCABULARY from the archive the recogniser opens
   * (`platform/vosk-vocabulary`, ADR-0194 §4): the runtime keeps it inside its worker and tells the page nothing. Optional; without
   * it the load carries no `vocabulary`, and a name with a word the model lacks goes unreported.
   */
  readonly fetch?: (absoluteUrl: string) => Promise<{ readonly ok: boolean; readonly body: ReadableStream<BufferSource> | null }>;
}

export type VoskLoad =
  | {
    readonly ok: true;
    readonly model: VoskModel;
    /**
     * The words the loaded model knows, read from its archive once asked — `null` when they cannot be read. Present only when the
     * deps lent a `fetch`.
     */
    readonly vocabulary?: () => Promise<ReadonlySet<string> | null>;
  }
  /** The catalogue ids that are not in the checked cache — `language` when the project has no model for it. */
  | { readonly ok: false; readonly missing: readonly string[] };

const urlOf = (id: string): string | null => HEAVY_FILES.find((x) => x.id === id)?.url ?? null;

/**
 * PUTS THE BUNDLE IN THE PAGE ONCE PER ADDRESS, and answers with what it exports. A second call answers the same one: the
 * bundle registers a worker and a wasm module, and loading it twice would pay for both again on a machine that has little of
 * either. A rejection is forgotten, so a load that failed on a bad minute can be retried.
 *
 * 🔴 THE MEMO IS THE LOADER'S, AND THE LOADER IS BUILT ONCE BY THE ROOT (ADR-0232 D4), which hands it to every start of the
 * recogniser. A memo built inside `loadVoskRuntime` was a new memo every call, so «once» only ever held within one call; a
 * memo at module level was one per PAGE, shared by roots that share nothing else. `load` is the root's `import(url)`.
 */
export function createBundleLoader(load: (absoluteUrl: string) => Promise<unknown>): (absoluteUrl: string) => Promise<VoskApi> {
  const asked = new Map<string, Promise<VoskApi>>();
  return (absoluteUrl) => {
    const already = asked.get(absoluteUrl);
    if (already) return already;
    const pending = load(absoluteUrl) as Promise<VoskApi>;
    asked.set(absoluteUrl, pending);
    pending.catch(() => { asked.delete(absoluteUrl); });
    return pending;
  };
}

/**
 * ONE MODEL PER LANGUAGE, LOADED ONCE AND KEPT (ADR-0256): the 👄 and a choice by voice ask the same `load`, and a listener that
 * stops no longer ends the model — the one handed out has a `terminate` that does nothing; the real one is ended when it is
 * pushed out (more than `keep` languages, the oldest first) or by `closeAll()`, the root's end.
 * 📏 Why: every start used to spawn a worker and unpack ~40 MiB of model, and every choice started two — the Dev's machine froze
 * on 2026-09-27. A load that failed is forgotten, so a model that comes down later is found.
 */
export function keepVoskModels(load: (d: VoskDeps) => Promise<VoskLoad>, keep = 2): { load(d: VoskDeps): Promise<VoskLoad>; closeAll(): void } {
  /** Per language: the load as it came (whose model is the one to end) and the one handed out. */
  const kept = new Map<string, { readonly real: Promise<VoskLoad>; readonly lent: Promise<VoskLoad> }>();
  const end = (entry: { readonly real: Promise<VoskLoad> }): void => {
    void entry.real.then((l) => { if (l.ok) l.model.terminate?.(); }, () => {});
  };
  return {
    load(d) {
      const key = d.language.split('-')[0]!.toLowerCase();
      const found = kept.get(key);
      if (found) { kept.delete(key); kept.set(key, found); return found.lent; } // the most recent last
      const real = load(d);
      const lent = real.then((l): VoskLoad => (l.ok ? { ...l, model: { get KaldiRecognizer() { return l.model.KaldiRecognizer; }, terminate: () => {} } } : l));
      const entry = { real, lent };
      kept.set(key, entry);
      const forget = (): void => { if (kept.get(key) === entry) kept.delete(key); };
      real.then((l) => { if (!l.ok) forget(); }, forget);
      while (kept.size > keep) { const [oldest, q] = kept.entries().next().value!; kept.delete(oldest); end(q); }
      return lent;
    },
    closeAll() { for (const entry of kept.values()) end(entry); kept.clear(); },
  };
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
  const missing: string[] = [];
  for (const id of [...VOICE_RUNTIME_FILES, modelId]) {
    const url = urlOf(id);
    if (!url || !(await d.hasFile(url))) missing.push(id);
  }
  if (missing.length) return { ok: false, missing };

  const at = (id: string): string => new URL(deliveryPath(urlOf(id)!), d.base).href;
  const api = await d.loadBundle(at('commands:runtime'));
  // the loader answers whatever the address held; a file that is not the recogniser says so here, not as a TypeError below
  if (typeof api?.createModel !== 'function') {
    throw new Error('vosk-runtime: the bundle exported no `createModel` — the delivery has the wrong file');
  }
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
  const model = await api.createModel(at(modelId), beside, -1);
  const { fetch } = d;
  if (!fetch) return { ok: true, model };
  // the SAME address the worker was given: the service worker answers both from the checked cache, and the words read are the
  // words of the model that was loaded, never another language's
  const vocabulary = async (): Promise<ReadonlySet<string> | null> => {
    try {
      const r = await fetch(at(modelId));
      return r.ok && r.body ? await readModelVocabulary(r.body) : null;
    } catch {
      return null;
    }
  };
  return { ok: true, model, vocabulary };
}
