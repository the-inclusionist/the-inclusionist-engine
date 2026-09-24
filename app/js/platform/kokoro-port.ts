// SPDX-License-Identifier: AGPL-3.0-or-later
// platform/kokoro-port — THE NEURAL VOICE, PUT TOGETHER FROM PIECES THE CALLER HANDS IN (ADR-0216; issues #181, #200).
//
// This was `consumer-quiz/kokoro-porta`, which every game that wanted a neural voice had to copy: the Dev, 2026-09-21, «o jogo não
// deve precisar saber como isso funciona». It moved into the engine unchanged in behaviour and rewritten in English.
//
// The phonemizer and the ONNX runtime are INJECTED, so this half runs with no browser and no wasm: `platform/kokoro-runtime` hands
// in the real ones, loaded from `heavy/` on the page's own origin, where the delivery put them (ADR-0177) and the service worker
// answers from the checked cache.
import type { KokoroModule, KokoroSession } from './kokoro.js';
import type { OnnxRuntime } from './onnx-runtime.js';
import { KOKORO_MODEL_URL, URL_DO_TOKENIZADOR_KOKORO, kokoroVoiceUrl } from './kokoro.js';
import { deliveryPath } from './heavy.js';

/** The file system espeak-ng's Emscripten module exposes — only what this uses. */
export interface EspeakFileSystem {
  readonly writeFile: (path: string, text: string) => void;
  readonly readFile: (path: string, options: { encoding: 'utf8' }) => string;
}

/** espeak-ng's module factory: one program run per call, with its arguments and the hooks run before `main`. */
export type EspeakFactory = (options: {
  readonly arguments: readonly string[];
  readonly preRun: readonly ((m: { FS: EspeakFileSystem }) => void)[];
}) => Promise<{ FS: EspeakFileSystem }>;

export interface KokoroPortDeps {
  readonly espeak: EspeakFactory;
  readonly ort: OnnxRuntime;
  readonly fetch: (url: string) => Promise<Response>;
  /** The page's address `heavy/` is resolved against. */
  readonly base: string;
}

const INPUT = 'entrada.txt';
const OUTPUT = 'fonemas.txt';

export function createKokoroPort(d: KokoroPortDeps): KokoroModule {
  const fromDelivery = async (url: string): Promise<Response> => {
    const path = deliveryPath(url);
    const r = await d.fetch(new URL(path, d.base).href);
    if (!r.ok) throw new Error(`Kokoro: HTTP ${r.status} for ${path} — the delivery does not carry it (inclusionist-heavy --kokoro)`);
    return r;
  };
  let vocabulary: Promise<Readonly<{ [symbol: string]: number }>> | null = null;
  // ⚠️ ONE COPY of the 325 MB model for every session: the engine tries WebGPU and may fall back to WASM
  let model: Promise<Uint8Array> | null = null;

  return {
    async phonemize(text, espeak) {
      // the sentence goes in as a FILE and never as an argument: a line starting with «-» would be read as an option
      const e = await d.espeak({
        arguments: ['-q', '--ipa', '--phonout', OUTPUT, '-v', espeak, '-f', INPUT],
        preRun: [(m) => m.FS.writeFile(INPUT, text.replace(/\s+/g, ' '))],
      });
      return e.FS.readFile(OUTPUT, { encoding: 'utf8' }).trim().replace(/\s*\n\s*/g, ' ');
    },
    vocabulary() {
      vocabulary ??= fromDelivery(URL_DO_TOKENIZADOR_KOKORO)
        .then(async (r) => (await r.json() as { model: { vocab: { [s: string]: number } } }).model.vocab);
      return vocabulary;
    },
    async voice(id) {
      return new Float32Array(await (await fromDelivery(kokoroVoiceUrl(id))).arrayBuffer());
    },
    async session(device) {
      model ??= fromDelivery(KOKORO_MODEL_URL).then(async (r) => new Uint8Array(await r.arrayBuffer()));
      const s = await d.ort.InferenceSession.create(await model, { executionProviders: [device] });
      const session: KokoroSession = {
        async synthesize(ids, style) {
          const out = await s.run({
            input_ids: new d.ort.Tensor('int64', BigInt64Array.from(ids, (id) => BigInt(id)), [1, ids.length]),
            style: new d.ort.Tensor('float32', style, [1, style.length]),
            speed: new d.ort.Tensor('float32', Float32Array.of(1), [1]), // the pace is the engine's, on playback (ADR-0196)
          });
          return out[s.outputNames[0]!]!.data as Float32Array;
        },
      };
      return session;
    },
  };
}
