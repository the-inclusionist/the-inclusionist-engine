// SPDX-License-Identifier: AGPL-3.0-or-later
// platform/heavy-mirror — WHERE A HEAVY FILE IS FETCHED FROM, WHEN IT IS NOT FETCHED FROM UPSTREAM.
//
// The Dev, 2026-09-21: «Precisamos de um .env que aponte para local quando estivermos testando em local e em
// <a conta R2> quando estivermos usando estes recursos na minha conta. Isso facilitaria quando tivermos que hospedar em
// outros servidores.»
//
// The catalogue pins an upstream address AND the sha256 of the bytes (ADR-0177, issue #168). A mirror serves those same
// bytes somewhere else — the project's Cloudflare, a school's own server, a folder on the build machine — so the only thing
// that changes is the BASE. Everything else, including the check, stays: a base that serves other bytes fails the sha256 and
// nothing is written. That is what makes pointing elsewhere safe, and it is why this module does not need to be trusted.
//
// The staging tree (`the-inclusionist-lfs`) lays each artefact out as its future Hugging Face repository, so the path under
// the base is NOT the upstream host and path — it is the folder the mirror uses. That mapping is here, once.

/** Upstream prefix → the path the mirror serves it under. Measured against the staging tree on 2026-09-21. */
// ⚠️ Written WITHOUT a trailing slash, exactly as the network inventory (`tests/nothing-comes-from-outside`) already declares each of
// them: an address that differs by one character reads as a new supplier entering without a decision.
export const MIRROR_FOLDERS: ReadonlyArray<readonly [string, string]> = [
  ['https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main', 'kokoro-82m-v1.0-onnx'],
  ['https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1', 'mediapipe-tasks-vision-1.0.1/tasks-vision@1.0.1'],
  ['https://storage.googleapis.com/mediapipe-models', 'mediapipe-tasks-vision-1.0.1/models'],
  // 📌 The reading models have NO upstream: both exports were made by this project (ADR-0201 erratum, ADR-0203), so the address
  // the catalogue pins is already the mirror's. They are listed all the same, and that is what lets a build read them from the
  // staging tree on disk — 850 MiB that nobody should download twice.
  ['https://lfs-oinclusionista.jrocha.dev.br/whisper-small-onnx', 'whisper-small-onnx'],
  ['https://lfs-oinclusionista.jrocha.dev.br/moonshine-streaming-small-onnx', 'moonshine-streaming-small-onnx'],
  ['https://lfs-oinclusionista.jrocha.dev.br/moonshine-streaming-small-es-onnx', 'moonshine-streaming-small-es-onnx'],
  // The command models and the runtime that loads them (issue #184). The runtime has no upstream either — every published
  // `vosk-browser` evaluates text as code, so this one was rebuilt with `-s DYNAMIC_EXECUTION=0` to run under the policy.
  ['https://lfs-oinclusionista.jrocha.dev.br/vosk-browser-dynamic-execution-0', 'vosk-browser-dynamic-execution-0'],
  ['https://lfs-oinclusionista.jrocha.dev.br/vosk-models', 'vosk-models'],
  // The neural voice's phonemizer and the graph runtime it shares with the reading models (issue #192, the Dev on 2026-09-22).
  // ⚠️ espeak-ng is GPL-3.0-or-later: the folder must carry the matching SOURCE beside the binary, and `docs/CREDITS.md` says
  // where. The version is in the folder name on purpose — a mirror that drops it cannot serve two versions during an upgrade.
  ['https://cdn.jsdelivr.net/npm/espeak-ng@1.0.2', 'espeak-ng-1.0.2'],
  ['https://cdn.jsdelivr.net/npm/onnxruntime-web@1.27.0', 'onnxruntime-web-1.27.0'],
];

/**
 * Addresses the project does NOT mirror, each with why — they go on being fetched upstream even when a base is set.
 *
 * ✅ EMPTY since 2026-09-22, and that is the Dev's decision («Ok, vamos espelhar»): the two that were here — the neural
 * voice's phonemizer and the graph runtime it and the reading models share — were the last files a school still fetched from
 * a third party. 📏 They are five files: `espeak-ng.js` + `espeak-ng.wasm` (18.7 MiB) and the three of `onnxruntime-web`.
 *
 * ⚠️ AND ONE OF THEM CARRIES AN OBLIGATION, which is why it waited for a decision instead of following a convenience:
 * espeak-ng is GPL-3.0-or-later, so mirroring the binary obliges this project to publish the matching SOURCE beside it
 * (ADR-0203 erratum, issue #192). onnxruntime-web is MIT and obliges nothing. The list stays here, empty, because an empty
 * list with a reason is a decision a reader can find; a deleted one is a question nobody knows was asked.
 */
export const NOT_MIRRORED: ReadonlyArray<readonly [string, string]> = [];

/** The path a mirror serves this upstream address under, or `null` when no mirror of this project holds it. */
export function mirrorPathOf(url: string): string | null {
  if (NOT_MIRRORED.some(([prefix]) => url.startsWith(prefix))) return null;
  for (const [upstream, folder] of MIRROR_FOLDERS) if (url.startsWith(`${upstream}/`)) return folder + url.slice(upstream.length);
  return null;
}

/**
 * Where to fetch this file from: the base's copy when there is a base and the file is mirrored, upstream otherwise.
 * A base may be an address (`https://…`) or a folder on this machine — the caller knows how to open each.
 */
export function heavySourceOf(url: string, base?: string | null): string {
  const path = base ? mirrorPathOf(url) : null;
  if (!path) return url;
  return `${base!.replace(/[/\\]+$/, '')}/${path}`;
}

/** Is this base an address, or a folder on the machine running the build? */
// ⚠️ `\/{2}` and not `\/\/`: a gate reads the tree as text, and two slashes in a row are how a line comment starts.
export const baseIsRemote = (base: string): boolean => /^https?:\/{2}/i.test(base);
