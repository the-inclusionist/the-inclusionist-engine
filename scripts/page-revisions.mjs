// SPDX-License-Identifier: AGPL-3.0-or-later
//
// A PAGE'S PRECACHE REVISION CARRIES ITS HEADERS (issue #186, ADR-0192).
//
// Workbox revises a precached file by its content. A page's response also carries what `_headers` gives it — the
// Content-Security-Policy and, since ADR-0192, cross-origin isolation — and the precache keeps that whole response. A header
// changed without a page changing left an install serving the old response: offline, the page would stay unisolated. The
// pages' revision therefore folds in the hash of `_headers`, so a header change refreshes them; every other file is untouched.

import { createHash } from 'node:crypto';

/** The first 16 hex of the sha256 of `_headers`' text. */
export function hashDosCabecalhos(texto) {
  return createHash('sha256').update(texto).digest('hex').slice(0, 16);
}

/**
 * Workbox `manifestTransforms` entry: each `.html` entry gets `revision` + `-h` + the headers' hash (a `null` revision — a
 * hashed name — gets the hash alone). Returns `{ manifest, warnings }`, as Workbox asks.
 */
export function revisarPaginasPelosCabecalhos(entradas, hash) {
  const manifest = entradas.map((e) => (/\.html$/.test(e.url) ? { ...e, revision: `${e.revision ?? ''}-h${hash}` } : e));
  return { manifest, warnings: [] };
}
