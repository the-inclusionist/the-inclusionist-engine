// SPDX-License-Identifier: AGPL-3.0-or-later
// consumer-quiz/kokoro-carregar — the real pieces behind the quiz's Kokoro port (ADR-0198; issue #181), loaded only when a child picks
// a Kokoro voice: espeak-ng's WASM (GPL-3.0-or-later, compiled once and instantiated per sentence) and onnxruntime-web, whose own
// WASM the build emits beside the page.
import ESpeakNg from 'espeak-ng';
import urlDoEspeakWasm from 'espeak-ng/dist/espeak-ng.wasm?url';
import * as ort from 'onnxruntime-web';
import urlDoOrtMjs from 'onnxruntime-web/ort-wasm-simd-threaded.jsep.mjs?url';
import urlDoOrtWasm from 'onnxruntime-web/ort-wasm-simd-threaded.jsep.wasm?url';
import { criarPortaKokoro, type FabricaEspeak, type RuntimeOnnx } from './kokoro-porta.js';

// THE THREAD WORKERS LOAD ONNXRUNTIME'S OWN SCRIPT: left to itself, a worker imports the module that holds onnxruntime — this
// chunk, which imports the quiz's — and the game booting in a worker with no `document` never answers, so a session never opens.
ort.env.wasm.wasmPaths = { mjs: urlDoOrtMjs, wasm: urlDoOrtWasm };

let compilado: Promise<WebAssembly.Module> | null = null;

const espeak: FabricaEspeak = (opcoes) => {
  // by bytes, not by stream: a server that sends the file without `application/wasm` must not break the voice
  compilado ??= fetch(urlDoEspeakWasm).then((r) => r.arrayBuffer()).then((b) => WebAssembly.compile(b));
  const modulo = compilado;
  return ESpeakNg({
    ...opcoes,
    instantiateWasm: (importacoes: WebAssembly.Imports, pronto: (i: WebAssembly.Instance, m: WebAssembly.Module) => void) => {
      void modulo.then(async (m) => pronto(await WebAssembly.instantiate(m, importacoes), m));
      return {};
    },
  });
};

export const moduloKokoro = criarPortaKokoro({
  espeak,
  ort: ort as unknown as RuntimeOnnx,
  buscar: (url) => fetch(url),
  base: document.baseURI,
});
