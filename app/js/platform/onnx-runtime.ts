// SPDX-License-Identifier: AGPL-3.0-or-later
// platform/onnx-runtime — THE ONE GRAPH RUNNER, LOADED FROM THE DELIVERY (ADR-0216 and its erratum; issues #185, #200).
//
// Two things of the engine run an ONNX graph: the neural voice (`platform/kokoro-runtime`) and the reading
// (`platform/reading-runtime`). They load the same runtime the same way, and that way has one rule nobody may forget, so it is
// written here once and not in each of them.
//
// ⚠️ THE THREADS LOOK FOR THEIR OWN FILES. Left alone, onnxruntime's workers import their glue and their wasm from the address
// the library was published at — a CDN — and in a school with no network they find nothing, never answer, and the page waits for
// a session that never opens. Measured in the quiz demo (#181). So the paths are pointed at `heavy/` on the page's own origin.
//
// ⚠️ NOTHING HERE IS IMPORTED FROM npm: `import(url)` of an address on our own origin needs no bundler and puts no megabyte in
// the chunk of a game that runs no graph at all.

import { deliveryPath } from './pesados.js';
import { HEAVY_FILES } from './pesados-catalogo.js';

export interface OnnxTensor { readonly data: unknown; readonly dims?: readonly number[] }
/** An open graph: the names it answers with, and one run. */
export interface OnnxSession {
  readonly inputNames?: readonly string[];
  readonly outputNames: readonly string[];
  run(inputs: { readonly [name: string]: OnnxTensor }): Promise<{ readonly [name: string]: OnnxTensor }>;
}
/** The part of onnxruntime the engine uses — small on purpose: what is not named here cannot be depended on. */
export interface OnnxRuntime {
  // `bool` is here for one input of one graph: the flag a MERGED decoder is told which pass it is on by (`use_cache_branch`).
  readonly Tensor: new (
    type: 'int64' | 'float32' | 'bool',
    data: BigInt64Array | Float32Array | Uint8Array,
    shape: readonly number[],
  ) => OnnxTensor;
  readonly InferenceSession: {
    create(model: Uint8Array, options: { executionProviders: readonly string[] }): Promise<OnnxSession>;
  };
}
/** …plus the knob that tells its threads where their own files are, which is why this module exists. */
type OrtModule = OnnxRuntime & { readonly env?: { readonly wasm?: { wasmPaths?: unknown } } } & { readonly default?: unknown };

const ORT_ESM = 'voz:runtime:onnx';
const ORT_GLUE = 'voz:runtime:onnx:cola';
const ORT_WASM = 'voz:runtime:onnx:wasm';

/**
 * ⚠️ THE ADDRESSES ARE NOT WRITTEN HERE. They live once, in the catalogue, with the sha256 that is checked before anything is
 * written into a delivery (ADR-0114, ADR-0177): a second copy in a module would be a version that drifts from the one the build
 * fetched, and the page would ask for a file the delivery does not have.
 */
function heavyUrlOf(id: string): string {
  const heavy = HEAVY_FILES.find((p) => p.id === id);
  if (!heavy?.url) throw new Error(`the heavy catalogue has no address for ${id}`);
  return heavy.url;
}

/** Where the delivery serves a catalogued file, from the page's own address. */
export const atDelivery = (id: string, base: string): string => new URL(deliveryPath(heavyUrlOf(id)), base).href;

export interface OnnxRuntimeDeps {
  /** The page's address, which `heavy/` is resolved against. */
  readonly base: string;
  /** `import()`, injected so a case can hand in a module without a network or a wasm engine. */
  readonly importModule?: (url: string) => Promise<unknown>;
}

/** The runtime, from the delivery, with its threads pointed at the delivery too. Refuses by NAME when it is not there. */
export async function loadOnnxRuntime(d: OnnxRuntimeDeps): Promise<OnnxRuntime> {
  const loadModule = d.importModule ?? ((url: string) => import(/* @vite-ignore */ url) as Promise<unknown>);
  const module = await loadModule(atDelivery(ORT_ESM, d.base)) as OrtModule;
  const ort = ((module as { default?: OrtModule }).default ?? module) as OrtModule;
  if (!ort?.InferenceSession) throw new Error(`onnxruntime did not load from the delivery (${ORT_ESM})`);
  if (ort.env?.wasm) ort.env.wasm.wasmPaths = { mjs: atDelivery(ORT_GLUE, d.base), wasm: atDelivery(ORT_WASM, d.base) };
  return ort;
}
