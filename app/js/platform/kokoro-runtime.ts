// SPDX-License-Identifier: AGPL-3.0-or-later
// platform/kokoro-runtime — THE ENGINE LOADS THE NEURAL VOICE ITSELF (ADR-0216 and its erratum; issue #200).
//
// The Dev, 2026-09-21: «a engine deve oferecer objetos de leitura e TTS. O jogo não deve precisar saber como isso funciona». So the
// phonemizer and the ONNX runtime are no longer a game's dependency: they are catalogued heavy files (`voz:runtime:*`), the build
// puts them in the delivery, and this loads them from `heavy/` on the page's own origin — the same path the vision runtime
// already takes (ADR-0177, `platform/vision`).
//
// ⚠️ NOTHING HERE IS IMPORTED FROM npm, and that is the point: an `import 'espeak-ng'` would put the phonemizer in the bundle of
// every game that merely links the engine, and would need a bundler to resolve it. `import(url)` of an address on our own origin
// needs neither, and it happens only when a child picks a neural voice.
//
// · The wasm of espeak-ng is compiled ONCE and instantiated per sentence: its module runs one program and exits.
// · onnxruntime's threads load their own glue and wasm; they are pointed at `heavy/` too, because a worker that goes looking for
//   them on a CDN finds nothing in a school with no network, and the child hears silence (measured in the quiz demo, #181).

import { createKokoroPort, type EspeakFactory } from './kokoro-port.js';
import { atDelivery, loadOnnxRuntime } from './onnx-runtime.js';
import type { KokoroModule } from './kokoro.js';

// The addresses are the catalogue's, reached by id through `platform/onnx-runtime` — never written twice (ADR-0114, ADR-0177).
const ESPEAK_GLUE = 'voz:runtime:fonemas';
const ESPEAK_WASM = 'voz:runtime:fonemas:wasm';

export interface KokoroRuntimeDeps {
  /** The page's address, which `heavy/` is resolved against. */
  readonly base: string;
  /** Injected so a case can answer without a network; the default is the page's own `fetch`. */
  readonly fetch?: (url: string) => Promise<Response>;
  /** `import()`, injected so a case can hand in the two modules without a network or a wasm engine. */
  readonly importModule?: (url: string) => Promise<unknown>;
  readonly compileWasm?: (bytes: ArrayBuffer) => Promise<WebAssembly.Module>;
  readonly instantiateWasm?: (module: WebAssembly.Module, imports: WebAssembly.Imports) => Promise<WebAssembly.Instance>;
}

/** What the loaded espeak-ng module looks like: a factory, default-exported or not. */
type EspeakModule = { readonly default?: EspeakFactory } | EspeakFactory;

/**
 * Builds the neural voice. Everything it needs is fetched from the delivery, so a device that never had a network day has it all
 * or has none of it — and «none of it» is a refusal the caller reports, not a silence.
 */
export async function loadKokoroRuntime(d: KokoroRuntimeDeps): Promise<KokoroModule> {
  const compile = d.compileWasm ?? ((bytes) => WebAssembly.compile(bytes));
  const instantiate = d.instantiateWasm ?? ((module, imports) => WebAssembly.instantiate(module, imports));
  const get = d.fetch ?? ((url: string) => fetch(url));
  const loadModule = d.importModule ?? ((url: string) => import(/* @vite-ignore */ url) as Promise<unknown>);

  const espeakModule = await loadModule(atDelivery(ESPEAK_GLUE, d.base)) as EspeakModule;
  const factory = (typeof espeakModule === 'function' ? espeakModule : espeakModule.default) as EspeakFactory | undefined;
  if (typeof factory !== 'function') throw new Error('Kokoro: espeak-ng did not load from the delivery (voz:runtime:fonemas)');

  // by BYTES and not by stream: a server that sends the file without `application/wasm` must not break the voice
  let compiled: Promise<WebAssembly.Module> | null = null;
  const espeak: EspeakFactory = (options) => {
    compiled ??= get(atDelivery(ESPEAK_WASM, d.base)).then(async (r) => {
      if (!r.ok) throw new Error(`Kokoro: HTTP ${r.status} for espeak-ng's wasm — the delivery does not carry it`);
      return compile(await r.arrayBuffer());
    });
    const module = compiled;
    return factory({
      ...options,
      instantiateWasm: (imports: WebAssembly.Imports, ready: (i: WebAssembly.Instance, m: WebAssembly.Module) => void) => {
        void module.then(async (m) => ready(await instantiate(m, imports), m));
        return {};
      },
    } as Parameters<EspeakFactory>[0]);
  };

  // the runtime, and the rule about its threads, are `platform/onnx-runtime`'s — the reading loads the same one the same way
  const ort = await loadOnnxRuntime({ base: d.base, importModule: loadModule });

  return createKokoroPort({ espeak, ort, fetch: get, base: d.base });
}
