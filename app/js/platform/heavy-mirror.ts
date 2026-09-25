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
  // The Libras player (ADR-0234, route A): the path a base serves it under, the short commit in the folder name for the same
  // reason as a version. ⚠️ THE PROJECT'S BUCKET DOES NOT HOLD IT: it carries Unity's closed runtime, whose redistribution terms
  // nobody has determined, so nothing was uploaded — a remote base answers 404 for these four files and the delivery fails by
  // name. A FOLDER on the build machine laid out this way works, and needs no network.
  ['https://raw.githubusercontent.com/spbgovbr-vlibras/vlibras-web-browsers/9d093f259ac732d755a19e80cd03c8233c70435d/public/unity',
    'vlibras-web-browsers-9d093f2/public/unity'],
];

/**
 * Addresses the project does NOT mirror, each with why — they go on being fetched upstream even when a base is set.
 *
 * 🔴 AND THE ENTRY BELOW CAME BACK THE SAME DAY IT LEFT, which is worth writing rather than hiding. The Dev decided to mirror
 * both of the last two third-party addresses («Ok, vamos espelhar»), so this list was emptied — and 📏 measuring the bucket
 * after the upload showed `espeak-ng` answering **404** while the three `onnxruntime-web` files answer 200 with exactly the
 * catalogued byte counts. Nothing failed: the staging folder is marked «🔴 ON HOLD» and `upload-to-r2.ps1` skips it, because
 * espeak-ng is GPL-3.0-or-later and serving the binary obliges publishing the matching SOURCE beside it (ADR-0203 erratum,
 * issue #192). Emptying the list without checking what the bucket serves would have pointed every school at a 404.
 *
 * ⚠️ So it stays upstream until `espeak-ng-1.0.2/source/` exists. The decision to mirror it is unchanged; what is missing is
 * the obligation that decision carries, and a mirror is distribution.
 */
export const NOT_MIRRORED: ReadonlyArray<readonly [string, string]> = [
  ['https://cdn.jsdelivr.net/npm/espeak-ng@1.0.2',
    'GPL: the mirror folder is ON HOLD until the matching source is published beside the build (issue #192)'],
];

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
