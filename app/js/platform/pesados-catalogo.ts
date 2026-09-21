// SPDX-License-Identifier: AGPL-3.0-or-later
// platform/pesados-catalogo.ts — O QUE É PESADO, DE ONDE VEM, E QUANTO PESA.
//
// 📌 SEPARADO DO BUSCADOR de propósito: a lista é DADO e muda por decisão registada; o buscador é regra e
// muda por defeito encontrado. Juntos, cada correcção de uma URL mexeria no ficheiro que decide a ordem das
// descargas, e cada correcção da ordem mexeria na lista que um registo governa.
//
// 📌 Every address is written ONCE, where its module owns it: Kokoro's in `platform/kokoro`, the vision runtime's here.
import {
  VOZES_KOKORO, URL_DO_MODELO_KOKORO, URL_DO_TOKENIZADOR_KOKORO, urlDaVozKokoro, SHA256_DAS_VOZES_KOKORO, BYTES_DA_VOZ_KOKORO,
  SHA256_DO_MODELO_KOKORO, BYTES_DO_MODELO_KOKORO, SHA256_DO_TOKENIZADOR_KOKORO, BYTES_DO_TOKENIZADOR_KOKORO,
} from './kokoro.js';

/** Uma coisa pesada que a engine promete e que não cabe no pacote. */
export interface Pesado {
  readonly id: string;
  /** `null` = decidido que existe, mas ainda não há de onde vir. Ver `porQueNaoTemFonte`. */
  readonly url: string | null;
  /** Medido, não estimado — é o número que uma frase honesta usa antes de começar a descarga. */
  readonly bytes?: number;
  /**
   * The SHA-256 of the bytes, MEASURED (issue #168): what the fetcher compares before keeping anything. A pinned URL is
   * not pinned content — a CDN or a mirror can serve other bytes at the same address, and these run in the child's page.
   */
  readonly sha256?: string;
  /** Obrigatório quando `url` é `null`: uma ausência sem razão escrita vira uma ausência esquecida. */
  readonly porQueNaoTemFonte?: string;
}

/** O nome da Cache Storage. Versionado: mudar o conteúdo do catálogo não deve servir bytes velhos. */
// v2 since issue #168: what v1 kept was never checked against a hash, so it is not trusted — it is fetched again, checked.
export const CACHE_PESADOS = 'incl-pesados-v2';

/**
 * O RUNTIME DE VISÃO — **MediaPipe**, decidido pelo Dev em 2026-09-09 (ADR-0124): «… mediapipe
 * (webgazer não), e LPCP: devem acompanhar a engine». WebGazer, trazido de volta pelo ADR-0132, saiu de novo (ADR-0214).
 *
 * 🔴 ESTA ENTRADA DIZIA «a #129 ainda não escolheu o fornecedor» DEPOIS DE ELE TER ESCOLHIDO, e a linha
 * sobreviveu ao registo que a contradizia. Não era só trabalho em falta: era uma afirmação FALSA a dirigir
 * quem a lesse para uma issue já fechada. O Dev teve de perguntar três vezes.
 *
 * 📏 MEASURED 2026-09-09: the three files answer 200 on jsDelivr with
 * `Access-Control-Allow-Origin: *`, na versão FIXADA — 155 439 + 323 377 + 11 756 954 bytes.
 *
 * ⚠️ CDN FIXADA É PERMITIDA E O ADR-0116 DIZ PORQUÊ: o que o pilar 8 proíbe é depender da rede DEPOIS do
 * primeiro dia. Isto desce na INSTALAÇÃO, com o resto — e é a diferença inteira para o WebGazer de antes, que buscava
 * quando a criança liga o controle por olhar, logo a máquina que nunca o ligou fica sem ele para sempre.
 * 📌 A versão vai na URL, que é o que o `check:precache` exige de qualquer entrada externa: bytes diferentes
 * chegam por endereço diferente, e uma entrada fixada nunca congela.
 *
 * 🎯 SÃO OS TRÊS FICHEIROS E NÃO SÓ O `.wasm`: o `vision_bundle.mjs` é quem o carrega e o
 * `vision_wasm_internal.js` é a cola do Emscripten. The wasm alone is a «downloaded» thing that does not run.
 *
 * ⬜ Still to do is the WIRING (issues #11, #189): these bytes come down and the camera reader does not read them yet.
 */
const MP = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1';
const MP_MODELOS = 'https://storage.googleapis.com/mediapipe-models';

/**
 * 🔴 A PRIMEIRA VERSÃO DESTA LISTA TRAZIA O RUNTIME E NENHUM MODELO, e o Dev apanhou-o ao perguntar o que
 * tinha ficado de fora. 11.7 MB of WebAssembly without a `.task` recognise nothing.
 *
 * 📏 MEDIDOS EM 2026-09-09, todos 200 com CORS aberto. `float16` e não `float32`: metade do peso, e a precisão
 * que se perde é irrelevante para dizer onde está um íris num ecrã de 320×180.
 */
const MEDIAPIPE: readonly Pesado[] = Object.freeze([
  { id: 'visao:runtime', url: `${MP}/vision_bundle.mjs`, bytes: 155_439,
    sha256: 'd885630c297c0b20b1fe86096cb06291c4c8080876f27852e724f24ac603713f' },
  { id: 'visao:runtime:cola', url: `${MP}/wasm/vision_wasm_internal.js`, bytes: 323_377,
    sha256: 'e170ee67dd4e16c1a6fcd8840a206687e5a59b22c20e4a902bc445b095454d73' },
  { id: 'visao:runtime:wasm', url: `${MP}/wasm/vision_wasm_internal.wasm`, bytes: 11_756_954,
    sha256: '8da277a733926eacd0474b8704b36742d6ec3231c57a860c5b889dff8f1df886' },
  { id: 'visao:modelo:rosto', url: `${MP_MODELOS}/face_landmarker/face_landmarker/float16/1/face_landmarker.task`, bytes: 3_758_596,
    sha256: '64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff' },
  { id: 'visao:modelo:gestos', url: `${MP_MODELOS}/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task`, bytes: 8_373_440,
    sha256: '97952348cf6a6a4915c2ea1496b4b37ebabc50cbbf80571435643c455f2b0482' },
  { id: 'visao:modelo:maos', url: `${MP_MODELOS}/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`, bytes: 7_819_105,
    sha256: 'fbc2a30080c3c557093b5ddfc334698132eb341044ccee322ccf8bcf3607cde1' },
]);

/**
 * KOKORO (ADR-0186, ADR-0198; the Dev: «Faça»): the fp32 model, its tokenizer vocabulary and a style table per voice of the engine's
 * languages. The phonemizer and the runtime are the game's (ADR-0198 §5), bundled by it. Read by the port the quiz demo fills.
 */
/**
 * THE VOICE RUNTIME (ADR-0216 and its erratum; issue #200): what SPEAKS a neural voice, fetched like the vision runtime and for the
 * same reason — the engine imports nothing from npm at run time, so a game that never asks for this voice carries none of it, and
 * the published package stays free of a bundler-only import.
 *
 * · espeak-ng turns a sentence into phonemes, in every language the project speaks. GPL-3.0-or-later, compatible with the engine's
 *   AGPL-3.0 (LICENSES.md); the source travels beside the mirror (ADR-0203 erratum).
 * · onnxruntime-web runs Kokoro's graph. The `jsep` pair is what its own threads load, which is why both are here: a worker that
 *   cannot find them answers nothing, and the child hears silence (measured in the quiz demo, #181).
 *
 * ⚠️ sha256 MEASURED on the files the dev dependency already put on the build machine, not taken from a page; the first delivery run
 * is what proves jsDelivr serves the same bytes, because it refuses to write anything else.
 */
const ESPEAK = 'https://cdn.jsdelivr.net/npm/espeak-ng@1.0.2';
const ORT = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.27.0';
const VOICE_RUNTIME: readonly Pesado[] = Object.freeze([
  { id: 'voz:runtime:fonemas', url: `${ESPEAK}/dist/espeak-ng.js`, bytes: 178_386,
    sha256: '406c6655a6cacf34d84fc69dc4478c81b71518809080ce2d05df1b706d76429d' },
  { id: 'voz:runtime:fonemas:wasm', url: `${ESPEAK}/dist/espeak-ng.wasm`, bytes: 18_485_010,
    sha256: '10d24bb7e4124e983aa9cd8cd96c52c8ea4b607d81956ec70846684e2827d532' },
  { id: 'voz:runtime:onnx', url: `${ORT}/dist/ort.webgpu.bundle.min.mjs`, bytes: 113_035,
    sha256: '3a18c7f261e05d44a15b2eef18a28e5f53c044d5d140bcea6066baf1f09c8b53' },
  { id: 'voz:runtime:onnx:cola', url: `${ORT}/dist/ort-wasm-simd-threaded.jsep.mjs`, bytes: 46_614,
    sha256: '3ee381d20a80f51a788a1c4a5872f6f1d047538dd4342f4af00062de5f9ea4c6' },
  { id: 'voz:runtime:onnx:wasm', url: `${ORT}/dist/ort-wasm-simd-threaded.jsep.wasm`, bytes: 26_827_543,
    sha256: '78feeeb3d08f6bcee94d938ed322f69073bb8076b5f9d34697a574ffba8deb48' },
]);
/**
 * THE READING MODELS (ADR-0201 erratum, ADR-0203; issues #185, #200): what hears a child read aloud, ONE MODEL PER LANGUAGE —
 * Whisper small for Portuguese, Moonshine streaming small for English and Spanish, the three the lab measured (pt 7.7 % WER,
 * en 19.3 %, es 7.2 %).
 *
 * 🎯 THE ADDRESS IS THE PROJECT'S OWN, and it has to be: these two exports do not exist anywhere else. The Whisper one was made
 * here (`scripts/models/export-whisper-small.py`) because the ready-made export states no licence, and the Spanish Moonshine was
 * exported here from weights that ship no ONNX. The project mirrors them under ADR-0203 — «hospedar na Cloudflare do projeto» —
 * with the licence of each beside it in `the-inclusionist-lfs`.
 *
 * ⚠️ AND THEY ARE BIG: 378 MiB for pt, 162 for en, 310 for es. Nobody downloads all three — the start asks only for the child's
 * language (`pesadosDoArranque`), and a game that does not declare `uses: { reading: true }` asks for none of them.
 *
 * 📌 The ids are in English while their neighbours are not: what is here stays until the renaming of the whole catalogue (the
 * English plan, phase 2, a single BREAKING release), and nothing new arrives in Portuguese meanwhile.
 *
 * ⚠️ sha256 MEASURED on the mirror's own files, each checked against the `SHA256SUMS` its folder publishes.
 */
const READING_MIRROR = 'https://lfs-oinclusionista.jrocha.dev.br';
const READING: readonly Pesado[] = Object.freeze([
  // pt — Whisper small, exported and quantized by this project
  { id: 'reading:pt:encoder', url: `${READING_MIRROR}/whisper-small-onnx/onnx/encoder_model_quantized.onnx`, bytes: 95_131_296,
    sha256: '25eae0fce49960d460d800c53a9df788afdf54baceee16ab6a6333869e2fc78f' },
  { id: 'reading:pt:decoder', url: `${READING_MIRROR}/whisper-small-onnx/onnx/decoder_model_quantized.onnx`, bytes: 156_551_161,
    sha256: '63e48cd0bef0f3367f4611728f38bf8f123af545212a2e744fe2ec28e0e887a3' },
  { id: 'reading:pt:decoder:past', url: `${READING_MIRROR}/whisper-small-onnx/onnx/decoder_with_past_model_quantized.onnx`, bytes: 142_305_767,
    sha256: '670b3e8b846f4e86dd3c26930bb671dec2df476b81c138c1864db37aa8bc92c0' },
  { id: 'reading:pt:tokenizer', url: `${READING_MIRROR}/whisper-small-onnx/tokenizer.json`, bytes: 2_480_466,
    sha256: '27fc476bfe7f17299480be2273fc0608e4d5a99aba2ab5dec5374b4482d1a566' },
  { id: 'reading:pt:config', url: `${READING_MIRROR}/whisper-small-onnx/config.json`, bytes: 1_967,
    sha256: 'e6a2b489da1b5aed65a8eb8d1e7466fa867ad5643a8bc138ba708bd56b2875c4' },
  // what the reading must NOT invent: the tokens Whisper suppresses, and the mel filterbank its features are built with
  { id: 'reading:pt:generation', url: `${READING_MIRROR}/whisper-small-onnx/generation_config.json`, bytes: 3_868,
    sha256: '71565b8ef50d0bf7a1193ed4bbed195b94e70c18894d81bba2f1233dcec3ab53' },
  { id: 'reading:pt:preprocessor', url: `${READING_MIRROR}/whisper-small-onnx/preprocessor_config.json`, bytes: 184_990,
    sha256: '9b5cd03a36fbb8a627c64d98a5b5b126ead95a77720723944487311f0110b666' },

  // en — Moonshine streaming small, the Workmind ONNX export, copied unchanged (MIT)
  { id: 'reading:en:encoder', url: `${READING_MIRROR}/moonshine-streaming-small-onnx/onnx/encoder_model_quantized.onnx`, bytes: 74_923_158,
    sha256: '69c786908794eb9e2e50d7137c4e755abdde7b4bdebffd68fe0c292eee5ffc55' },
  { id: 'reading:en:decoder', url: `${READING_MIRROR}/moonshine-streaming-small-onnx/onnx/decoder_model_merged_quantized.onnx`, bytes: 90_830_447,
    sha256: '3bd2e7a7e94c608b1988fa035be1f1b1f2acdbe059f7fe5cc70d85201c2835f5' },
  { id: 'reading:en:tokenizer', url: `${READING_MIRROR}/moonshine-streaming-small-onnx/tokenizer.json`, bytes: 3_761_754,
    sha256: '7b913404bdd039af4756783218af4440bc07fb7d6d8258d677e34f95b3ec416f' },
  { id: 'reading:en:config', url: `${READING_MIRROR}/moonshine-streaming-small-onnx/config.json`, bytes: 1_745,
    sha256: '849ca79b5af5603b1e7b8eeebf67265f931c70117434446fca6f35a26fc03df1' },
  { id: 'reading:en:generation', url: `${READING_MIRROR}/moonshine-streaming-small-onnx/generation_config.json`, bytes: 163,
    sha256: 'fd54ad15ad0a14f68db3c58a8d8e5e8f3791ef95e1ea92ee46cd71b4a5d7528c' },

  // es — Moonshine streaming small, exported here from the upstream weights. ⚠️ Its encoder is fp32 and the biggest file of the
  // three: quantized to q8 it drifted in the lab, and a reading that mis-hears a child is worse than a bigger download.
  { id: 'reading:es:encoder', url: `${READING_MIRROR}/moonshine-streaming-small-es-onnx/onnx/encoder_model.onnx`, bytes: 205_951_994,
    sha256: 'e675a5cf070ed40da516f1648bea62eb21f77421f1c490cedfe0d16bdc77a090' },
  { id: 'reading:es:decoder', url: `${READING_MIRROR}/moonshine-streaming-small-es-onnx/onnx/decoder_model_quantized.onnx`, bytes: 63_639_862,
    sha256: '6775c2b74f429ae202e5a11cc0db7e291a0e593641364ddf416613d130528fcf' },
  { id: 'reading:es:decoder:past', url: `${READING_MIRROR}/moonshine-streaming-small-es-onnx/onnx/decoder_with_past_model_quantized.onnx`, bytes: 55_504_894,
    sha256: '9cddfa057c8b5d65d3e5057b748b6f6b58753306846dd0fa4d0e8639cb22bfd9' },
  { id: 'reading:es:tokenizer', url: `${READING_MIRROR}/moonshine-streaming-small-es-onnx/tokenizer.json`, bytes: 476_245,
    sha256: 'e8dae7af9c2b6e5a1f413819db1eb70837ff4cf53b5a482a37f2ffc608b8b977' },
  { id: 'reading:es:config', url: `${READING_MIRROR}/moonshine-streaming-small-es-onnx/config.json`, bytes: 1_653,
    sha256: 'bfd932c804df9cde662468a8f933763cd5174bfed2c043b2440b4daaa702efbd' },
  { id: 'reading:es:generation', url: `${READING_MIRROR}/moonshine-streaming-small-es-onnx/generation_config.json`, bytes: 246,
    sha256: '3e5f0aa2b32615a4023d0a08cccb7c1ec292aba9a8d8f6f4886df2a769af31b0' },
]);

/** The language a reading id serves, or `null` where the id is not a reading model's. */
export function readingLanguageOf(id: string): string | null {
  const parts = id.split(':');
  return parts[0] === 'reading' && parts[1] ? parts[1] : null;
}

const KOKORO: readonly Pesado[] = Object.freeze([
  { id: 'voz:kokoro:modelo', url: URL_DO_MODELO_KOKORO, bytes: BYTES_DO_MODELO_KOKORO, sha256: SHA256_DO_MODELO_KOKORO },
  { id: 'voz:kokoro:tokenizador', url: URL_DO_TOKENIZADOR_KOKORO, bytes: BYTES_DO_TOKENIZADOR_KOKORO, sha256: SHA256_DO_TOKENIZADOR_KOKORO },
  ...VOZES_KOKORO.map((v) => ({ id: `voz:kokoro:${v.voice}`, url: urlDaVozKokoro(v.voice), bytes: BYTES_DA_VOZ_KOKORO, sha256: SHA256_DAS_VOZES_KOKORO[v.voice] })),
]);

export const PESADOS: readonly Pesado[] = Object.freeze([
  ...VOICE_RUNTIME,
  ...KOKORO,

  // what hears a child read aloud, one model per language (ADR-0216 §2); the runtime that runs them is the voice's, above
  ...READING,

  // the vision runtime and its models: eye control reads the face (ADR-0213); WebGazer left (ADR-0214)
  ...MEDIAPIPE,

  /*
   * 🔴 O ACERVO DE ARTE — a quarta coisa pesada do ADR-0119, e a única SEM FONTE. Medido: `art/` tem DOIS
   * ficheiros — um README e um `ATTRIBUTION.csv` de 40 bytes, só o cabeçalho. Zero arte.
   *
   * ⚠️ ATÉ 2026-09-09 ESTA LINHA CULPAVA A COISA ERRADA. Dizia que a quarentena estava vazia e que a arte
   * era CC BY-SA 3.0 com autoria por recurso — descrevendo o Liberated Pixel Cup, que o ADR-0133 recusou:
   * os dois braços dele são share-alike ou GPL, e nenhum está na lista fechada de quatro licenças.
   *
   * 📌 A razão de continuar sem fonte MUDOU e é mais simples: não há acervo escolhido. A arte entra sob
   * CC0, CC BY 3.0, CC BY 4.0 ou OGA-BY, com uma linha de livro por recurso e a URL da origem — e nada
   * disso é uma URL única que um buscador possa pedir. A fonte desta linha é o dia em que houver acervo.
   */
  {
    id: 'arte:acervo',
    url: null,
    porQueNaoTemFonte: 'não há acervo escolhido: `art/` tem só README e cabeçalho do CSV. O ADR-0133 fechou '
      + 'a lista em CC0, CC BY 3.0/4.0 e OGA-BY, e a arte entra recurso a recurso com autoria e URL de '
      + 'origem — não por uma URL solta que este buscador possa pedir.',
  },
]);
