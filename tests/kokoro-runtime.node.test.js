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
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { canNameSpecifierContaining, specifiersOfFile } from './fixtures/parsed-sources.js';
import { loadKokoroRuntime } from '../app/js/platform/kokoro-runtime.js';
import { URL_DO_TOKENIZADOR_KOKORO } from '../app/js/platform/kokoro.js';
import { deliveryPath } from '../app/js/platform/heavy.js';

const BASE = 'https://escola.exemplo/jogo/';

function build({ espeakExport = 'default', ortExport = 'bare', ortBroken = false } = {}) {
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
      if (ortBroken) return {};
      // ⚠️ A bundle may hand its API back as the namespace or under `default`, and which one is not ours to choose: both are
      // shapes a real `import()` of an ESM build returns.
      return ortExport === 'default' ? { default: ort } : ort;
    },
    compileWasm: async () => ({ fake: 'module' }),
    instantiateWasm: async () => ({ fake: 'instance' }),
  };
  return { deps, imported, fetched, espeakRuns, ort };
}

const naEntrega = (url) => new URL(deliveryPath(url), BASE).href;

describe('the neural voice, loaded by the engine', () => {
  it('🔴 [Right] every piece is loaded from the delivery on the page\'s own origin — never from a CDN', async () => {
    const { deps, imported, fetched } = build();
    const kokoro = await loadKokoroRuntime(deps);
    await kokoro.phonemize('as mãos dadas', 'pt-br');
    await kokoro.vocabulary();
    for (const url of [...imported, ...fetched]) {
      expect(url.startsWith(BASE), `${url} was not asked of the page's own origin`).toBe(true);
      expect(url).toContain('/heavy/');
    }
    expect(fetched).toContain(naEntrega(URL_DO_TOKENIZADOR_KOKORO));
  });

  it('🔴 [Right] onnxruntime\'s threads are pointed at the delivery too, not at a CDN', async () => {
    // ⚠️ Measured in the quiz demo (#181): a worker left to itself imports onnxruntime from its own address and, with no network,
    // never answers — the session never opens and the child hears nothing.
    const { deps, ort } = build();
    await loadKokoroRuntime(deps);
    expect(ort.env.wasm.wasmPaths.mjs.startsWith(BASE), 'the thread glue would come from a CDN').toBe(true);
    expect(ort.env.wasm.wasmPaths.wasm).toContain('/heavy/');
  });

  it('📌 [Boundary] the phonemizer\'s wasm is compiled ONCE, however many sentences are spoken', async () => {
    const { deps, fetched } = build();
    const kokoro = await loadKokoroRuntime(deps);
    await kokoro.phonemize('uma', 'pt-br');
    await kokoro.phonemize('duas', 'pt-br');
    await kokoro.phonemize('três', 'pt-br');
    expect(fetched.filter((u) => u.endsWith('espeak-ng.wasm')), 'the phonemizer wasm was fetched again for each sentence').toHaveLength(1);
  });

  it('🔴 [Right] espeak-ng is instantiated through the injected `instantiateWasm`, with its own imports (ADR-0232 D4)', async () => {
    // The host's WebAssembly is lent by the root; a runtime that reached the page's global instead would never call this.
    const { deps, espeakRuns } = build();
    const instanciados = [];
    deps.instantiateWasm = async (module, imports) => { instanciados.push([module, imports]); return { fake: 'instance' }; };
    const kokoro = await loadKokoroRuntime(deps);
    await kokoro.phonemize('oi', 'pt-br');
    const pronto = new Promise((resolve) => { espeakRuns[0].instantiateWasm({ env: 'imports' }, (i, m) => resolve([i, m])); });
    expect(await pronto).toEqual([{ fake: 'instance' }, { fake: 'module' }]);
    expect(instanciados).toEqual([[{ fake: 'module' }, { env: 'imports' }]]);
  });

  it('📌 [Right] onnxruntime loads whether the module default-exports its API or IS the API', async () => {
    for (const ortExport of ['default', 'bare']) {
      const { deps, ort } = build({ ortExport });
      await loadKokoroRuntime(deps);
      expect(ort.env.wasm.wasmPaths?.wasm, `as ${ortExport}: the runtime was not found, so its threads were never pointed`)
        .toContain('/heavy/');
    }
  });

  it('📌 [Right] espeak-ng loads whether it default-exports its factory or is the factory', async () => {
    for (const espeakExport of ['default', 'bare']) {
      const { deps } = build({ espeakExport });
      expect(await (await loadKokoroRuntime(deps)).phonemize('oi', 'pt-br')).toBe('fonemas');
    }
  });

  it('⚠️ [Error] a delivery without the runtime REFUSES with its name, instead of a voice that never speaks', async () => {
    const { deps } = build({ ortBroken: true });
    await expect(loadKokoroRuntime(deps)).rejects.toThrow(/voz:runtime:onnx/);
    const semEspeak = build().deps;
    await expect(loadKokoroRuntime({ ...semEspeak, importModule: async () => ({}) })).rejects.toThrow(/voz:runtime:fonemas/);
  });

  it('🎯 [Zero] nothing is imported from npm: the module names no bare specifier', () => {
    const src = readFileSync('app/js/platform/kokoro-runtime.ts', 'utf8');
    const imports = [...src.matchAll(/^import[^;]*from '([^']+)'/gm)].map((m) => m[1]);
    expect(imports.every((s) => s.startsWith('./') || s.startsWith('../')), `a bare import entered: ${imports.join(' ')}`).toBe(true);
  });

  /**
   * 🔴 AND NOBODY MAY IMPORT IT STATICALLY (ADR-0216 §5: «everything heavy loads late»). This module is the one that names
   * espeak-ng and onnxruntime, so a single `import … from './kokoro-runtime.js'` anywhere in the engine puts them in the chunk of
   * every game that merely links it — the very cost the erratum measured away. Nothing in the reading of a `problems` line or a
   * type check would show it: the page would just be 28 MiB heavier for a game that never speaks.
   *
   * ⚠️ It is asserted over the WHOLE tree and not over `platform/tts` alone, because the next module to want the voice would be
   * the one to pay the cost, and it would not be reading this file.
   */
  it('🔴 [Zero] no module imports the runtime statically — it is reached by `import()` or not at all', () => {
    const ficheiros = [];
    const descer = (dir) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        if (e.isDirectory()) descer(join(dir, e.name));
        else if (e.name.endsWith('.ts')) ficheiros.push(join(dir, e.name));
      }
    };
    descer('app/js');
    expect(ficheiros.length, 'the walk found nothing: a gate over an empty tree approves everything').toBeGreaterThan(100);
    // Read by the TypeScript parser (`scripts/lib/module-specifiers.mjs`): a side-effect `import`, an `export … from` and an
    // `export * from` put the runtime in the chunk exactly like `import … from`, and a pattern over `import … from '…'`
    // let all three through. What stays allowed is the literal `import()` — the late load this case exists to demand —
    // and a type-only import, which the build erases and so bundles nothing.
    //
    // ⚠️ AND ONLY A FILE THAT CAN NAME THE RUNTIME IS PARSED. Parsing all ~180 modules to ask about one specifier was the
    // work that took this case past the 5 s ceiling under the load of several suites at once; a file whose text holds
    // neither `kokoro-runtime` nor a backslash cannot yield it, and `canNameSpecifierContaining` says why that is exact
    // (📏 2026-09-25: 29 of 184 files, ~0.6 of ~2.1 MB, are parsed). The parser, and the compiler behind it, are imported
    // at the top of the file: loading ~9 MB of compiler inside the case billed it to this case's 5 s.
    const referencias = ficheiros.filter((f) => canNameSpecifierContaining(f, 'kokoro-runtime'))
      .flatMap((f) => specifiersOfFile(f).filter((s) => /(^|\/)kokoro-runtime\.js$/.test(s.spec ?? ''))
        .map((s) => ({ ...s, f })));
    // 🎯 The late load the case demands IS found — without it, a filter that parsed nothing would pass this case empty.
    expect(referencias.some((s) => s.kind === 'dynamic'), 'not even the late `import()` was seen: the reading is broken')
      .toBe(true);
    const estaticos = referencias.filter((s) => s.kind !== 'dynamic' && !s.typeOnly).map((s) => `${s.f}:${s.line} ${s.kind}`);
    expect(estaticos, 'a static import would bundle espeak-ng and onnxruntime into every game').toEqual([]);
  });
});

// MUTATIONS CHECKED (2026-09-21) — `scratchpad/mutar-kokoro-runtime.py`:
//   · a piece loaded from the CDN address instead of the delivery → «every piece is loaded from the delivery»
//   · the threads' paths never set                                → «onnxruntime's threads are pointed at the delivery»
//   · the wasm compiled per sentence                              → «compiled ONCE»
//   · a missing runtime loaded as `undefined` instead of refusing → «REFUSES with its name»
//   · `import 'espeak-ng'` put back                               → «nothing is imported from npm»
//   · `platform/tts` importing this module statically             → «no module imports the runtime statically»
//   · the same by side effect, `export … from`, `export * from`
//     and a double-quoted specifier, each alone                   → «no module imports the runtime statically»
//   · an `import type` of it                                       → stays green: erased, nothing bundled
//   · the walk stopped at the top folder (empty tree)             → «the walk found nothing»
// (2026-09-25, when only the files that can name the runtime began to be parsed):
//   · the static import re-run, and the re-export                 → «no module imports the runtime statically»
//   · the specifier spelled with an escape, `'./kokoro-runtime.js'`
//     — the one form whose text lacks the name                    → «no module imports the runtime statically»
//   · the filter answering «cannot» for every file                → «not even the late `import()` was seen»
