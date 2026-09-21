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
// ⚠️ Written WITHOUT a trailing slash, exactly as the network inventory (`tests/nada-vem-de-fora`) already declares each of
// them: an address that differs by one character reads as a new supplier entering without a decision.
export const MIRROR_FOLDERS: ReadonlyArray<readonly [string, string]> = [
  ['https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main', 'kokoro-82m-v1.0-onnx'],
  ['https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1', 'mediapipe-tasks-vision-1.0.1/tasks-vision@1.0.1'],
  ['https://storage.googleapis.com/mediapipe-models', 'mediapipe-tasks-vision-1.0.1/models'],
];

/** The path a mirror serves this upstream address under, or `null` when no mirror of this project holds it. */
export function mirrorPathOf(url: string): string | null {
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
