// SPDX-License-Identifier: AGPL-3.0-or-later
// consumer-quiz/kokoro-porta — THE QUIZ DEMO FILLS THE KOKORO PORT (ADR-0198 §5 and erratum; issue #181).
//
// The engine names no phonemizer, runtime or model file (`ModuloKokoro`); a game brings them. This demo brings espeak-ng
// (GPL-3.0-or-later) and onnxruntime-web, and asks the model, the tokenizer and the voice tables at `pesados/` on its own origin,
// where the delivery put them (ADR-0177) and the service worker answers from the checked cache. The runtime pieces are injected, so
// this half runs without a browser; `kokoro-carregar` hands in the real ones.
import type { ModuloKokoro, SessaoKokoro } from '../platform/tts.js';
import { URL_DO_MODELO_KOKORO, URL_DO_TOKENIZADOR_KOKORO, urlDaVozKokoro } from '../platform/kokoro.js';
import { caminhoNaEntrega } from '../platform/pesados.js';

/** The file system espeak-ng's Emscripten module exposes — only what the port uses. */
export interface SistemaDeFicheirosDoEspeak {
  readonly writeFile: (caminho: string, texto: string) => void;
  readonly readFile: (caminho: string, opcoes: { encoding: 'utf8' }) => string;
}

/** espeak-ng's module factory: one program run per call, with its arguments and hooks run before `main`. */
export type FabricaEspeak = (opcoes: {
  readonly arguments: readonly string[];
  readonly preRun: readonly ((m: { FS: SistemaDeFicheirosDoEspeak }) => void)[];
}) => Promise<{ FS: SistemaDeFicheirosDoEspeak }>;

interface TensorOnnx { readonly data: unknown }
/** The part of onnxruntime the port uses. */
export interface RuntimeOnnx {
  readonly Tensor: new (tipo: 'int64' | 'float32', dados: BigInt64Array | Float32Array, forma: readonly number[]) => TensorOnnx;
  readonly InferenceSession: {
    create(modelo: Uint8Array, opcoes: { executionProviders: readonly string[] }): Promise<{
      readonly outputNames: readonly string[];
      run(entradas: { readonly [nome: string]: TensorOnnx }): Promise<{ readonly [nome: string]: TensorOnnx }>;
    }>;
  };
}

export interface DependenciasDaPortaKokoro {
  readonly espeak: FabricaEspeak;
  readonly ort: RuntimeOnnx;
  readonly buscar: (url: string) => Promise<Response>;
  /** The page's address `pesados/` is resolved against. */
  readonly base: string;
}

const ENTRADA = 'entrada.txt';
const SAIDA = 'fonemas.txt';

export function criarPortaKokoro(d: DependenciasDaPortaKokoro): ModuloKokoro {
  const daEntrega = async (url: string): Promise<Response> => {
    const caminho = caminhoNaEntrega(url);
    const r = await d.buscar(new URL(caminho, d.base).href);
    if (!r.ok) throw new Error(`Kokoro: HTTP ${r.status} for ${caminho} — the delivery does not carry it (inclusionist-pesados --kokoro)`);
    return r;
  };
  let vocabulario: Promise<Readonly<{ [simbolo: string]: number }>> | null = null;
  // ⚠️ ONE COPY of the 325 MB model for every session: the engine tries WebGPU and may fall back to WASM
  let modelo: Promise<Uint8Array> | null = null;

  return {
    async fonemizar(texto, espeak) {
      // the sentence goes in as a FILE and never as an argument: a line starting with «-» would be read as an option
      const e = await d.espeak({
        arguments: ['-q', '--ipa', '--phonout', SAIDA, '-v', espeak, '-f', ENTRADA],
        preRun: [(m) => m.FS.writeFile(ENTRADA, texto.replace(/\s+/g, ' '))],
      });
      return e.FS.readFile(SAIDA, { encoding: 'utf8' }).trim().replace(/\s*\n\s*/g, ' ');
    },
    vocabulario() {
      vocabulario ??= daEntrega(URL_DO_TOKENIZADOR_KOKORO).then(async (r) => (await r.json() as { model: { vocab: { [s: string]: number } } }).model.vocab);
      return vocabulario;
    },
    async voz(id) {
      return new Float32Array(await (await daEntrega(urlDaVozKokoro(id))).arrayBuffer());
    },
    async sessao(dispositivo) {
      modelo ??= daEntrega(URL_DO_MODELO_KOKORO).then(async (r) => new Uint8Array(await r.arrayBuffer()));
      const s = await d.ort.InferenceSession.create(await modelo, { executionProviders: [dispositivo] });
      const sessao: SessaoKokoro = {
        async sintetizar(ids, estilo) {
          const saida = await s.run({
            input_ids: new d.ort.Tensor('int64', BigInt64Array.from(ids, (id) => BigInt(id)), [1, ids.length]),
            style: new d.ort.Tensor('float32', estilo, [1, estilo.length]),
            speed: new d.ort.Tensor('float32', Float32Array.of(1), [1]), // the pace is the engine's, on playback (ADR-0196)
          });
          return saida[s.outputNames[0]!]!.data as Float32Array;
        },
      };
      return sessao;
    },
  };
}
