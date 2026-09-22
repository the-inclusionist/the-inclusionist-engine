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
    await kokoro.fonemizar('as mãos dadas', 'pt-br');
    await kokoro.vocabulario();
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
    await kokoro.fonemizar('uma', 'pt-br');
    await kokoro.fonemizar('duas', 'pt-br');
    await kokoro.fonemizar('três', 'pt-br');
    expect(fetched.filter((u) => u.endsWith('espeak-ng.wasm')), 'the 18 MiB wasm was fetched again for each sentence').toHaveLength(1);
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

  /**
   * 🔴 AND NOBODY MAY IMPORT IT STATICALLY (ADR-0216 §5: «everything heavy loads late»). This module is the one that names
   * espeak-ng and onnxruntime, so a single `import … from './kokoro-runtime.js'` anywhere in the engine puts them in the chunk of
   * every game that merely links it — the very cost the erratum measured away. Nothing in the reading of a `problems` line or a
   * type check would show it: the page would just be 45 MiB heavier for a game that never speaks.
   *
   * ⚠️ It is asserted over the WHOLE tree and not over `platform/tts` alone, because the next module to want the voice would be
   * the one to pay the cost, and it would not be reading this file.
   */
  it('🔴 [Zero] no module imports the runtime statically — it is reached by `import()` or not at all', async () => {
    const { readFileSync, readdirSync } = await import('node:fs');
    const { join } = await import('node:path');
    const ficheiros = [];
    const descer = (dir) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        if (e.isDirectory()) descer(join(dir, e.name));
        else if (e.name.endsWith('.ts')) ficheiros.push(join(dir, e.name));
      }
    };
    descer('app/js');
    expect(ficheiros.length, 'the walk found nothing: a gate over an empty tree approves everything').toBeGreaterThan(100);
    const estaticos = ficheiros.filter((f) => /^\s*import\s[^(]*from\s+'[^']*kokoro-runtime\.js'/m.test(readFileSync(f, 'utf8')));
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
//   · the walk stopped at the top folder (empty tree)             → «the walk found nothing»
