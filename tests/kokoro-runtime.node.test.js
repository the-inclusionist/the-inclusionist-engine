// SPDX-License-Identifier: AGPL-3.0-or-later
// THE ENGINE LOADS THE NEURAL VOICE ITSELF (ADR-0216 and its erratum; issue #200) — the Dev, 2026-09-21: «O jogo não deve precisar
// saber como isso funciona.»
//
// No network and no wasm engine here: `import()`, `fetch` and the two WebAssembly calls are injected. What is measured is the
// promise this module makes to a school — every byte comes from the delivery on the page's own origin, including the files
// onnxruntime's own threads go looking for, because a worker that asks a CDN finds nothing in a classroom with no network.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect } from 'vitest';
import { loadKokoroRuntime } from '../app/js/platform/kokoro-runtime.js';
import { URL_DO_TOKENIZADOR_KOKORO } from '../app/js/platform/kokoro.js';
import { caminhoNaEntrega } from '../app/js/platform/pesados.js';

const BASE = 'https://escola.exemplo/jogo/';

function build({ espeakExport = 'default', ortBroken = false } = {}) {
  const imported = [], fetched = [];
  const espeakRuns = [];
  const factory = (options) => { espeakRuns.push(options); return Promise.resolve({ FS: { writeFile() {}, readFile: () => 'fonemas' } }); };
  const ort = {
    env: { wasm: {} },
    Tensor: class { constructor(type, data, shape) { Object.assign(this, { type, data, shape }); } },
    InferenceSession: { create: async () => ({ outputNames: ['waveform'], run: async () => ({ waveform: { data: Float32Array.of(1) } }) }) },
  };
  const deps = {
    base: BASE,
    fetch: async (url) => {
      fetched.push(url);
      return { ok: true, status: 200, arrayBuffer: async () => new ArrayBuffer(8), json: async () => ({ model: { vocab: { a: 1 } } }) };
    },
    importModule: async (url) => {
      imported.push(url);
      if (url.includes('espeak')) return espeakExport === 'default' ? { default: factory } : factory;
      return ortBroken ? {} : ort;
    },
    compileWasm: async () => ({ fake: 'module' }),
    instantiateWasm: async () => ({ fake: 'instance' }),
  };
  return { deps, imported, fetched, espeakRuns, ort };
}

const naEntrega = (url) => new URL(caminhoNaEntrega(url), BASE).href;

describe('the neural voice, loaded by the engine', () => {
  it('🔴 [Right] every piece is loaded from the delivery on the page\'s own origin — never from a CDN', async () => {
    const { deps, imported, fetched } = build();
    const kokoro = await loadKokoroRuntime(deps);
    await kokoro.fonemizar('as mãos dadas', 'pt-br');
    await kokoro.vocabulario();
    for (const url of [...imported, ...fetched]) {
      expect(url.startsWith(BASE), `${url} was not asked of the page's own origin`).toBe(true);
      expect(url).toContain('/pesados/');
    }
    expect(fetched).toContain(naEntrega(URL_DO_TOKENIZADOR_KOKORO));
  });

  it('🔴 [Right] onnxruntime\'s threads are pointed at the delivery too, not at a CDN', async () => {
    // ⚠️ Measured in the quiz demo (#181): a worker left to itself imports onnxruntime from its own address and, with no network,
    // never answers — the session never opens and the child hears nothing.
    const { deps, ort } = build();
    await loadKokoroRuntime(deps);
    expect(ort.env.wasm.wasmPaths.mjs.startsWith(BASE), 'the thread glue would come from a CDN').toBe(true);
    expect(ort.env.wasm.wasmPaths.wasm).toContain('/pesados/');
  });

  it('📌 [Boundary] the phonemizer\'s wasm is compiled ONCE, however many sentences are spoken', async () => {
    const { deps, fetched } = build();
    const kokoro = await loadKokoroRuntime(deps);
    await kokoro.fonemizar('uma', 'pt-br');
    await kokoro.fonemizar('duas', 'pt-br');
    await kokoro.fonemizar('três', 'pt-br');
    expect(fetched.filter((u) => u.endsWith('espeak-ng.wasm')), 'the 18 MiB wasm was fetched again for each sentence').toHaveLength(1);
  });

  it('📌 [Right] espeak-ng loads whether it default-exports its factory or is the factory', async () => {
    for (const espeakExport of ['default', 'bare']) {
      const { deps } = build({ espeakExport });
      expect(await (await loadKokoroRuntime(deps)).fonemizar('oi', 'pt-br')).toBe('fonemas');
    }
  });

  it('⚠️ [Error] a delivery without the runtime REFUSES with its name, instead of a voice that never speaks', async () => {
    const { deps } = build({ ortBroken: true });
    await expect(loadKokoroRuntime(deps)).rejects.toThrow(/voz:runtime:onnx/);
    const semEspeak = build().deps;
    await expect(loadKokoroRuntime({ ...semEspeak, importModule: async () => ({}) })).rejects.toThrow(/voz:runtime:fonemas/);
  });

  it('🎯 [Zero] nothing is imported from npm: the module names no bare specifier', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync('app/js/platform/kokoro-runtime.ts', 'utf8');
    const imports = [...src.matchAll(/^import[^;]*from '([^']+)'/gm)].map((m) => m[1]);
    expect(imports.every((s) => s.startsWith('./') || s.startsWith('../')), `a bare import entered: ${imports.join(' ')}`).toBe(true);
  });
});

// MUTATIONS CHECKED (2026-09-21) — `scratchpad/mutar-kokoro-runtime.py`:
//   · a piece loaded from the CDN address instead of the delivery → «every piece is loaded from the delivery»
//   · the threads' paths never set                                → «onnxruntime's threads are pointed at the delivery»
//   · the wasm compiled per sentence                              → «compiled ONCE»
//   · a missing runtime loaded as `undefined` instead of refusing → «REFUSES with its name»
//   · `import 'espeak-ng'` put back                               → «nothing is imported from npm»
