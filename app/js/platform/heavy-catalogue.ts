// SPDX-License-Identifier: AGPL-3.0-or-later
// platform/heavy-catalogue.ts — WHAT IS HEAVY, WHERE IT COMES FROM, AND HOW MUCH IT WEIGHS.
//
// 📌 APART FROM THE FETCHER on purpose: the list is DATA and changes by recorded decision; the fetcher is a rule and
// changes by defect found. Together, every URL fix would touch the file that decides the download order, and every
// order fix would touch the list a record governs.
//
// 📌 Every address is written ONCE, where its module owns it: Kokoro's in `platform/kokoro`, the vision runtime's here.
import {
  KOKORO_VOICES, KOKORO_MODEL_URL, URL_DO_TOKENIZADOR_KOKORO, kokoroVoiceUrl, KOKORO_VOICES_SHA256, KOKORO_VOICE_BYTES,
  KOKORO_MODEL_SHA256, KOKORO_MODEL_BYTES, SHA256_DO_TOKENIZADOR_KOKORO, BYTES_DO_TOKENIZADOR_KOKORO,
} from './kokoro.js';

/** A heavy thing the engine promises that does not fit in the package. */
export interface HeavyFile {
  readonly id: string;
  /** `null` = decided that it exists, but there is nowhere to fetch it from yet. See `whyNoSource`. */
  readonly url: string | null;
  /** Measured, not estimated — the number an honest sentence uses before the download starts. */
  readonly bytes?: number;
  /**
   * The SHA-256 of the bytes, MEASURED (issue #168): what the fetcher compares before keeping anything. A pinned URL is
   * not pinned content — a CDN or a mirror can serve other bytes at the same address, and these run in the child's page.
   */
  readonly sha256?: string;
  /** Required when `url` is `null`: an absence without a written reason becomes a forgotten absence. */
  readonly whyNoSource?: string;
  /**
   * The id of the entry the DELIVERY makes this file from, when the build never fetches it: it writes it beside that entry's
   * file, and `url` is then only the address the device keeps it under — nothing is served there upstream. `sha256` is still
   * the pin of the bytes the device may keep (ADR-0234: the patched VLibras framework).
   */
  readonly madeFrom?: string;
}

/** The Cache Storage name. Versioned: changing the catalogue's content must not serve old bytes. */
// v2 since issue #168: what v1 kept was never checked against a hash, so it is not trusted — it is fetched again, checked.
export const CACHE_HEAVY = 'incl-pesados-v2';

/**
 * THE VISION RUNTIME — **MediaPipe**, decided by the Dev (ADR-0124): «… mediapipe (webgazer não), e LPCP: devem
 * acompanhar a engine». WebGazer, brought back by ADR-0132, left again (ADR-0214).
 *
 * 📏 MEASURED 2026-09-09: the three files answer 200 on jsDelivr with `Access-Control-Allow-Origin: *`, at the PINNED
 * version — 155 439 + 323 377 + 11 756 954 bytes.
 *
 * ⚠️ A PINNED CDN IS ALLOWED AND ADR-0116 SAYS WHY: what pillar 8 forbids is depending on the network AFTER the first day.
 * This comes down at INSTALL, with the rest. 📌 The version goes in the URL, which is what `check:precache` requires of
 * any external entry: different bytes arrive by a different address, and a pinned entry never freezes.
 *
 * 🎯 IT IS THE THREE FILES AND NOT ONLY THE `.wasm`: `vision_bundle.mjs` is what loads it and `vision_wasm_internal.js` is
 * the Emscripten glue. The wasm alone is a «downloaded» thing that does not run.
 */
const MP = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1';
const MP_MODELS = 'https://storage.googleapis.com/mediapipe-models';

/**
 * 🔴 THE MODELS, without which the runtime recognises nothing: 11.7 MB of WebAssembly without a `.task` is a download
 * that does no work. The Dev caught the first version of this list, which carried the runtime and no model.
 *
 * 📏 MEASURED, all 200 with open CORS. `float16` and not `float32`: half the weight, and the precision lost is irrelevant
 * to saying where an iris is on a 320×180 screen.
 */
const MEDIAPIPE: readonly HeavyFile[] = Object.freeze([
  { id: 'visao:runtime', url: `${MP}/vision_bundle.mjs`, bytes: 155_439,
    sha256: 'd885630c297c0b20b1fe86096cb06291c4c8080876f27852e724f24ac603713f' },
  { id: 'visao:runtime:cola', url: `${MP}/wasm/vision_wasm_internal.js`, bytes: 323_377,
    sha256: 'e170ee67dd4e16c1a6fcd8840a206687e5a59b22c20e4a902bc445b095454d73' },
  { id: 'visao:runtime:wasm', url: `${MP}/wasm/vision_wasm_internal.wasm`, bytes: 11_756_954,
    sha256: '8da277a733926eacd0474b8704b36742d6ec3231c57a860c5b889dff8f1df886' },
  { id: 'visao:modelo:rosto', url: `${MP_MODELS}/face_landmarker/face_landmarker/float16/1/face_landmarker.task`, bytes: 3_758_596,
    sha256: '64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff' },
  { id: 'visao:modelo:gestos', url: `${MP_MODELS}/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task`, bytes: 8_373_440,
    sha256: '97952348cf6a6a4915c2ea1496b4b37ebabc50cbbf80571435643c455f2b0482' },
  { id: 'visao:modelo:maos', url: `${MP_MODELS}/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`, bytes: 7_819_105,
    sha256: 'fbc2a30080c3c557093b5ddfc334698132eb341044ccee322ccf8bcf3607cde1' },
]);

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
const VOICE_RUNTIME: readonly HeavyFile[] = Object.freeze([
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
 * language (`heavyAtBoot`), and a game that does not declare `uses: { reading: true }` asks for none of them.
 *
 * 📌 The ids are in English while their neighbours are not: what is here stays until the renaming of the whole catalogue (the
 * English plan, phase 2, a single BREAKING release), and nothing new arrives in Portuguese meanwhile.
 *
 * ⚠️ sha256 MEASURED on the mirror's own files, each checked against the `SHA256SUMS` its folder publishes.
 */
const READING_MIRROR = 'https://lfs-oinclusionista.jrocha.dev.br';
const READING: readonly HeavyFile[] = Object.freeze([
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

/**
 * THE COMMAND MODELS (ADR-0189, ADR-0193, ADR-0194; issue #184): what hears a child SAY A WORD OF THE GAME. Not the same job as
 * the reading above, and not the same tool: a command is heard against a CLOSED GRAMMAR — the names the menu is showing right
 * now — which is why 32 MiB answer in 0.25 s what 378 MiB of Whisper answered in seconds and, on single words, wrongly (📏 lab:
 * Vosk 7/7 commands, Whisper base 1/7).
 *
 * 🎯 THE RUNTIME IS THE PROJECT'S OWN BUILD, and that is the whole reason it exists: every published `vosk-browser` evaluates
 * text as code, which this engine's Content-Security-Policy refuses (ADR-0193 — never `'unsafe-eval'`, never a patch). It was
 * rebuilt from lichess-org/vosk-browser with `-s DYNAMIC_EXECUTION=0` and runs under the policy as it is (`models.md`).
 * The models are alphacephei's small ones, repacked deterministically as the `.tar.gz` that build loads.
 *
 * ⚠️ ONE MODEL PER LANGUAGE, like the reading: pt 30.9 MiB, en 39.2, es 37.9. Unlike the reading, a delivery carries the three
 * unless `inclusionist-heavy --commands` narrows it, and the start asks for every language the page can switch to, the child's
 * first (ADR-0225 erratum: a language changed mid-game must find its model). 📌 And NO GAME DECLARES THIS: a
 * child who speaks instead of pressing is using a transport, and a cartridge does not get to deny her one (ADR-0111).
 *
 * ⚠️ sha256 MEASURED on the mirror's own files (2026-09-21), each checked against the `SHA256SUMS` its folder publishes.
 */
const COMMANDS: readonly HeavyFile[] = Object.freeze([
  { id: 'commands:runtime', url: `${READING_MIRROR}/vosk-browser-dynamic-execution-0/vosk.wasm.js`, bytes: 10_288,
    sha256: 'a7ab48dcf72660ec79a493c37b9fd1d0b3c09c46968c6a1ebd06adb4d9a35ca6' },
  { id: 'commands:runtime:worker', url: `${READING_MIRROR}/vosk-browser-dynamic-execution-0/vosk.worker.js`, bytes: 194_710,
    sha256: 'cf84a33820a1634d6a8d11194f2bd04f871901bf630ba1423c24f6be13086b6a' },
  { id: 'commands:runtime:wasm', url: `${READING_MIRROR}/vosk-browser-dynamic-execution-0/vosk.wasm`, bytes: 2_992_690,
    sha256: 'e2a33196eacd6cd7d863392f877b9360664d7614ce97cddf9de5b5e637e2ccf9' },
  { id: 'commands:model:pt', url: `${READING_MIRROR}/vosk-models/vosk-model-small-pt-0.3.tar.gz`, bytes: 32_358_733,
    sha256: '4885a09d9cd3063bf991e2ae280f24eeee789410aaa05277a2e082cff0cf837d' },
  { id: 'commands:model:en', url: `${READING_MIRROR}/vosk-models/vosk-model-small-en-us-0.15.tar.gz`, bytes: 41_116_539,
    sha256: '61cf40721d255cccb9fe29bb059c6b3376b164c31f449d8143455ffbb86018cc' },
  { id: 'commands:model:es', url: `${READING_MIRROR}/vosk-models/vosk-model-small-es-0.42.tar.gz`, bytes: 39_748_927,
    sha256: '4ed16b681698db764ecb11996b1b4f74dd68f602213b36c17806a1398b26b162' },
]);

/**
 * The language a command MODEL serves, or `null` for anything else — including the runtime, which serves every language.
 * ⚠️ The middle word is read on purpose: `id.split(':')[1]` would call the runtime a language of its own and leave the three
 * models behind it out of the start of every delivery.
 */
export function commandsLanguageOf(id: string): string | null {
  const parts = id.split(':');
  return parts[0] === 'commands' && parts[1] === 'model' && parts[2] ? parts[2] : null;
}

/**
 * THE LIBRAS PLAYER (ADR-0234, route A — the Dev: «Então coloque no plano a rota A seguida pela B.»): the avatar that signs, the
 * VLibras Unity 2018 WebGL build, served from the delivery's own origin and driven through its `postMessage` API
 * (`ui/vlibras-player`).
 *
 * 🎯 THE ADDRESS IS THE REPOSITORY'S, AT A PINNED COMMIT: `spbgovbr-vlibras/vlibras-web-browsers`, `public/unity/`, at `9d093f2`
 * («feat: update unity build (28-08-26)», the last commit that touched the folder). 📏 Each file's git blob id there was read
 * with `gh api` and matches the local copy the measurement of route A downloaded; the sha256 and the sizes are measured on that
 * copy (2026-09-25).
 *
 * ⚠️ WHAT THESE FILES ARE, said where they enter: the repository is LGPL-3.0, but the build is Unity's — the wasm, the data file
 * and the framework JavaScript carry Unity Technologies' closed runtime, with no corresponding source and redistribution terms
 * nobody has determined (ADR-0234; `docs/LICENSES.md`, `docs/CREDITS.md`). Route B, a free player, replaces them.
 *
 * 🔴 THE FRAMEWORK IS NOT RUN AS PUBLISHED: Unity 2018 answers the player's calls to the page with `eval`, which the delivery's
 * policy refuses. The delivery rewrites that one `eval(str)` into a parser of plain calls (`scripts/vlibras-player.mjs`), after
 * checking this file's sha256 — a declared, temporary exception that ends with route B, and never an `unsafe-eval`.
 *
 * 🔴 AND THE PATCHED FILE IS WHAT RUNS, so it is pinned here too (`madeFrom`): the loader still reads the published framework, but
 * the page runs `playerweb.framework.noeval.js`, which the delivery writes beside it. Unpinned, the device ran it unchecked and
 * kept no copy, so the player could not start offline; pinned, it is fetched, checked and kept like the other four, and the
 * delivery refuses to write any other bytes under that name. 📏 Its sha256 is the patch of the pinned input: the bytes that ran
 * under the delivery's policy with zero violations in route A's measurement (2026-09-25).
 *
 * 📌 A DELIVERY CARRIES THESE ONLY WHEN IT IS BUILT WITH `--libras` (`inclusionist-heavy`), and a device fetches them at boot only
 * while deaf mode is on (`heavyAtBoot`): 19.7 MiB that a child who never asks for signing never pays.
 */
const VLIBRAS_UNITY = 'https://raw.githubusercontent.com/spbgovbr-vlibras/vlibras-web-browsers/9d093f259ac732d755a19e80cd03c8233c70435d/public/unity';
const LIBRAS_PLAYER: readonly HeavyFile[] = Object.freeze([
  { id: 'libras:player:loader', url: `${VLIBRAS_UNITY}/unity-loader.js`, bytes: 150_016,
    sha256: 'c1845b1e35a2784f237391802e36009872d9ae587a94c2ee5a66546696af4a88' },
  { id: 'libras:player:framework', url: `${VLIBRAS_UNITY}/playerweb.wasm.framework.unityweb`, bytes: 76_883,
    sha256: '7177d7748ffd7715e1150e202924f3d502df7531b672ccf6a39291cf8ccba3fb' },
  { id: 'libras:player:code', url: `${VLIBRAS_UNITY}/playerweb.wasm.code.unityweb`, bytes: 2_996_753,
    sha256: '4005cfe27f5252c8dafaccbca4c1338de9491c5076a62da8df2bfd036d6eeb4e' },
  { id: 'libras:player:data', url: `${VLIBRAS_UNITY}/playerweb.data.unityweb`, bytes: 16_992_528,
    sha256: '0c9897ea830739a09a8a2d132e219761d7017b22feae5ec9b2feb4ed075b1256' },
  { id: 'libras:player:framework:noeval', url: `${VLIBRAS_UNITY}/playerweb.framework.noeval.js`, bytes: 478_335,
    sha256: '4621a32c6d2abd1d0e00a2114405514c9623db59d608aabfb3bf6fefa93911af', madeFrom: 'libras:player:framework' },
]);

/**
 * WHERE THE DELIVERY PUTS THE PLAYER'S PAGE, beside the game's page: the engine's own small page, glue and CSP shim, which load
 * the files above from `heavy/`. Written by `inclusionist-heavy --libras`; the interpreter opens it and nothing else.
 */
export const LIBRAS_PLAYER_FOLDER = 'libras/player/';
/**
 * Where the player is told to fetch sign bundles (`setBaseUrl`), on the page's own origin. The delivery puts here the signs the
 * build-time glosses use that `scripts/libras-signs.json` pins; a word with no sign here 404s and the player fingerspells it with
 * the letters it carries.
 */
export const LIBRAS_SIGNS_FOLDER = 'libras/signs/';
/**
 * Where the delivery puts the FREE player's avatar, clips and manifest, beside the game's page (ADR-0234, route B;
 * `inclusionist-heavy --libras-avatar`). Written here, below the player that reads it (`ui/libras-avatar-plan` re-exports it),
 * because the delivery's list of those files names it too.
 */
export const LIBRAS_AVATAR_FOLDER = 'libras/avatar/';
/**
 * THE START OF THE FREE PLAYER'S STAGE CHUNK, under the page: `ui/libras-avatar-stage` and the three.js it carries, which the
 * bundler emits as `assets/libras-avatar-stage-<content hash>.js`. The precache leaves it out on purpose (three.js is only a
 * deaf-mode child's download), so the delivery finds the hashed name after the build and lists it; a NAME's start and not a
 * folder, because the rest of `assets/` belongs to the precache.
 */
export const LIBRAS_AVATAR_STAGE_CHUNK = 'assets/libras-avatar-stage-';

/**
 * A LIST THE DELIVERY WRITES OF ITS OWN FILES, each with its sha256 — for what no catalogue entry can pin because each delivery
 * makes it: the Libras player's page (its sign-set revision), the glosses of the game's texts, and the signs those glosses use
 * (ADR-0234, route A; pillar 8). The device reads the list and keeps each file only if its bytes are the listed ones, in the
 * checked cache, under the file's own address, where the service worker answers the player from offline.
 *
 * ⚠️ WHAT THE LIST PROVES, AND WHAT IT DOES NOT: it comes from the page's own origin, like the page's code, so it is exactly as
 * trusted as the page — it is not a pin. What it guarantees is that what is kept is what this delivery wrote: never a truncated
 * body, a fallback page served for a missing file, or a file of the previous delivery. The signs' hashes in it are the ones
 * `scripts/libras-signs.json` pins, checked when the delivery wrote them.
 */
export interface DeliveryList {
  readonly id: string;
  /** Where the delivery writes the list, relative to the page. */
  readonly path: string;
  /**
   * The only places the list may name, relative to the page: a listed file outside them is refused, never kept. Each is a
   * folder (ending in `/`) or, for a file whose name the build hashes, the start of that name (`LIBRAS_AVATAR_STAGE_CHUNK`).
   */
  readonly folders: readonly string[];
}

/**
 * The lists a device may read, each asked for with deaf mode (`heavyAtBoot`) — ONE PER DELIVERY STEP, so each step writes its own
 * and a delivery that ran one of them keeps exactly what it carries:
 * · `libras:delivery`, route A's page, glosses and signs, written by `--libras`;
 * · `libras:avatar:delivery`, route B's avatar, clips and manifest and the stage chunk with three.js, written by `--libras-avatar`
 *   (ADR-0234, phase B3). A delivery without that step has no such list: the same quiet 404 as a delivery without `--libras`.
 * 📌 THE RULE IS «WHAT THE DELIVERY CARRIES, DEAF MODE KEEPS»: a device keeps both players' files when its delivery carries both,
 * whichever interpreter the host lends.
 */
export const DELIVERY_LISTS: readonly DeliveryList[] = Object.freeze([
  Object.freeze({ id: 'libras:delivery', path: 'libras/offline.json', folders: Object.freeze([LIBRAS_PLAYER_FOLDER, LIBRAS_SIGNS_FOLDER]) }),
  Object.freeze({ id: 'libras:avatar:delivery', path: 'libras/offline-avatar.json',
    folders: Object.freeze([LIBRAS_AVATAR_FOLDER, LIBRAS_AVATAR_STAGE_CHUNK]) }),
]);

/**
 * KOKORO (ADR-0186, ADR-0198; the Dev: «Faça»): the fp32 model, its tokenizer vocabulary and a style table per voice of the engine's
 * languages. The engine loads them itself when a game declares `uses.neuralVoice` (ADR-0216); the phonemizer and the runtime that
 * speak them are `VOICE_RUNTIME`, above.
 */
const KOKORO: readonly HeavyFile[] = Object.freeze([
  { id: 'voz:kokoro:modelo', url: KOKORO_MODEL_URL, bytes: KOKORO_MODEL_BYTES, sha256: KOKORO_MODEL_SHA256 },
  { id: 'voz:kokoro:tokenizador', url: URL_DO_TOKENIZADOR_KOKORO, bytes: BYTES_DO_TOKENIZADOR_KOKORO, sha256: SHA256_DO_TOKENIZADOR_KOKORO },
  ...KOKORO_VOICES.map((v) => ({ id: `voz:kokoro:${v.voice}`, url: kokoroVoiceUrl(v.voice), bytes: KOKORO_VOICE_BYTES, sha256: KOKORO_VOICES_SHA256[v.voice] })),
]);

/**
 * 📌 Every entry with an address needs its licence group in `scripts/licences/third-party.mjs`: the delivery writes that group's
 * `LICENSE` and `NOTICE` beside the file, and refuses a file whose licence nobody recorded (ADR-0177).
 */
export const HEAVY_FILES: readonly HeavyFile[] = Object.freeze([
  ...VOICE_RUNTIME,
  ...KOKORO,

  // what hears a child read aloud, one model per language (ADR-0216 §2); the runtime that runs them is the voice's, above
  ...READING,

  // what hears a child SAY a word of the game, one model per language, with a runtime of its own (issue #184)
  ...COMMANDS,

  // the vision runtime and its models: eye control reads the face (ADR-0213); WebGazer left (ADR-0214)
  ...MEDIAPIPE,

  // the Libras player deaf mode's interpreter drives (ADR-0234, route A), only in a delivery built with `--libras`
  ...LIBRAS_PLAYER,

  /*
   * 🔴 THE ART COLLECTION — the fourth heavy thing of ADR-0119, and the only one WITHOUT A SOURCE. Measured: `art/` has
   * TWO files — a README and a 40-byte `ATTRIBUTION.csv`, the header only. No art.
   *
   * 📌 The reason is simple: no collection has been chosen. Art enters under CC0, CC BY 3.0, CC BY 4.0 or OGA-BY, with a
   * ledger line per asset and its source URL — and none of that is one URL a fetcher can ask for. (The Liberated Pixel
   * Cup was refused by ADR-0133: both its arms are share-alike or GPL, outside the closed list of four licences.) This
   * line's source is the day there is a collection.
   */
  {
    id: 'arte:acervo',
    url: null,
    whyNoSource: 'não há acervo escolhido: `art/` tem só README e cabeçalho do CSV. O ADR-0133 fechou '
      + 'a lista em CC0, CC BY 3.0/4.0 e OGA-BY, e a arte entra recurso a recurso com autoria e URL de '
      + 'origem — não por uma URL solta que este buscador possa pedir.',
  },
]);
