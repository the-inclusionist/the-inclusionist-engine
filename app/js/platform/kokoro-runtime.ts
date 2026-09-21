// SPDX-License-Identifier: AGPL-3.0-or-later
// platform/kokoro-runtime — THE ENGINE LOADS THE NEURAL VOICE ITSELF (ADR-0216 and its erratum; issue #200).
//
// The Dev, 2026-09-21: «a engine deve oferecer objetos de leitura e TTS. O jogo não deve precisar saber como isso funciona». So the
// phonemizer and the ONNX runtime are no longer a game's dependency: they are catalogued heavy files (`voz:runtime:*`), the build
// puts them in the delivery, and this loads them from `pesados/` on the page's own origin — the same path the vision runtime
// already takes (ADR-0177, `platform/vision`).
//
// ⚠️ NOTHING HERE IS IMPORTED FROM npm, and that is the point: an `import 'espeak-ng'` would put the phonemizer in the bundle of
// every game that merely links the engine, and would need a bundler to resolve it. `import(url)` of an address on our own origin
// needs neither, and it happens only when a child picks a neural voice.
//
// · The wasm of espeak-ng is compiled ONCE and instantiated per sentence: its module runs one program and exits.
// · onnxruntime's threads load their own glue and wasm; they are pointed at `pesados/` too, because a worker that goes looking for
//   them on a CDN finds nothing in a school with no network, and the child hears silence (measured in the quiz demo, #181).

import { createKokoroPort, type EspeakFactory, type OnnxRuntime } from './kokoro-port.js';
import { caminhoNaEntrega } from './pesados.js';
import { PESADOS } from './pesados-catalogo.js';
import type { ModuloKokoro } from './tts.js';

/**
 * ⚠️ THE ADDRESSES ARE NOT WRITTEN HERE. They live once, in the catalogue, with the sha256 that is checked before anything is
 * written into a delivery (ADR-0114, ADR-0177): a second copy in this module would be a version that drifts from the one the
 * build fetched, and the page would ask for a file the delivery does not have.
 */
const urlOf = (id: string): string => {
  const heavy = PESADOS.find((p) => p.id === id);
  if (!heavy?.url) throw new Error(`Kokoro: the catalogue has no address for ${id}`);
  return heavy.url;
};
const ESPEAK_GLUE = 'voz:runtime:fonemas';
const ESPEAK_WASM = 'voz:runtime:fonemas:wasm';
const ORT_ESM = 'voz:runtime:onnx';
const ORT_GLUE = 'voz:runtime:onnx:cola';
const ORT_WASM = 'voz:runtime:onnx:wasm';

export interface KokoroRuntimeDeps {
  /** The page's address, which `pesados/` is resolved against. */
  readonly base: string;
  readonly fetch: (url: string) => Promise<Response>;
  /** `import()`, injected so a case can hand in the two modules without a network or a wasm engine. */
  readonly importModule: (url: string) => Promise<unknown>;
  readonly compileWasm?: (bytes: ArrayBuffer) => Promise<WebAssembly.Module>;
  readonly instantiateWasm?: (module: WebAssembly.Module, imports: WebAssembly.Imports) => Promise<WebAssembly.Instance>;
}

/** What the loaded espeak-ng module looks like: a factory, default-exported or not. */
type EspeakModule = { readonly default?: EspeakFactory } | EspeakFactory;
/** What onnxruntime exports, plus the knob that tells its threads where their own files are. */
type OrtModule = OnnxRuntime & { readonly env?: { readonly wasm?: { wasmPaths?: unknown } } } & { readonly default?: unknown };

const atDelivery = (id: string, base: string): string => new URL(caminhoNaEntrega(urlOf(id)), base).href;

/**
 * Builds the neural voice. Everything it needs is fetched from the delivery, so a device that never had a network day has it all
 * or has none of it — and «none of it» is a refusal the caller reports, not a silence.
 */
export async function loadKokoroRuntime(d: KokoroRuntimeDeps): Promise<ModuloKokoro> {
  const compile = d.compileWasm ?? ((bytes) => WebAssembly.compile(bytes));
  const instantiate = d.instantiateWasm ?? ((module, imports) => WebAssembly.instantiate(module, imports));

  const espeakModule = await d.importModule(atDelivery(ESPEAK_GLUE, d.base)) as EspeakModule;
  const factory = (typeof espeakModule === 'function' ? espeakModule : espeakModule.default) as EspeakFactory | undefined;
  if (typeof factory !== 'function') throw new Error('Kokoro: espeak-ng did not load from the delivery (voz:runtime:fonemas)');

  // by BYTES and not by stream: a server that sends the file without `application/wasm` must not break the voice
  let compiled: Promise<WebAssembly.Module> | null = null;
  const espeak: EspeakFactory = (options) => {
    compiled ??= d.fetch(atDelivery(ESPEAK_WASM, d.base)).then(async (r) => {
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

  const ortModule = await d.importModule(atDelivery(ORT_ESM, d.base)) as OrtModule;
  const ort = ((ortModule as { default?: OrtModule }).default ?? ortModule) as OrtModule;
  if (!ort?.InferenceSession) throw new Error('Kokoro: onnxruntime did not load from the delivery (voz:runtime:onnx)');
  // ⚠️ THE THREADS LOOK FOR THEIR OWN FILES: left alone they ask a CDN, which a school without a network does not have.
  if (ort.env?.wasm) ort.env.wasm.wasmPaths = { mjs: atDelivery(ORT_GLUE, d.base), wasm: atDelivery(ORT_WASM, d.base) };

  return createKokoroPort({ espeak, ort, fetch: d.fetch, base: d.base });
}
