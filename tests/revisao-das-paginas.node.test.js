// SPDX-License-Identifier: AGPL-3.0-or-later
// A PAGE'S PRECACHE REVISION CARRIES ITS HEADERS (issue #186, ADR-0192).
//
// 📏 Measured on 2026-09-13 in the engine's dist: the precached `quiz.html` keeps the response's COOP, COEP and CSP — so a header
// changed in `_headers`, with the page's content unchanged, left the old response in an install (the revision hashes the file).
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { hashDosCabecalhos, revisarPaginasPelosCabecalhos } from '../scripts/page-revisions.mjs';

const ENTRADAS = [
  { url: 'quiz.html', revision: 'abc' },
  { url: 'assets/quiz-CxRZQlKp.css', revision: null },
  { url: 'vendor/fonts.css', revision: 'def' },
];

describe('the pages\' precache revision', () => {
  it('🔴 [Right] a header change changes every page\'s revision', () => {
    const a = revisarPaginasPelosCabecalhos(ENTRADAS, hashDosCabecalhos('/*\n  Content-Security-Policy: x\n')).manifest;
    const b = revisarPaginasPelosCabecalhos(ENTRADAS, hashDosCabecalhos('/*\n  Content-Security-Policy: x\n  Cross-Origin-Opener-Policy: same-origin\n')).manifest;
    expect(a[0].revision).not.toBe(b[0].revision);
    expect(a[0].revision.startsWith('abc'), 'the content half of the revision was lost').toBe(true);
  });

  it('🔴 [Zero] no other file is touched — a hashed name keeps `null`, a stylesheet keeps its revision', () => {
    const m = revisarPaginasPelosCabecalhos(ENTRADAS, 'h').manifest;
    expect([m[1].revision, m[2].revision]).toEqual([null, 'def']);
    expect(m.length).toBe(ENTRADAS.length);
  });

  it('⚠️ [Boundary] the same headers give the same revision — a rebuild does not refresh every install', () => {
    const t = readFileSync(join(process.cwd(), 'app', 'public', '_headers'), 'utf8');
    expect(hashDosCabecalhos(t)).toBe(hashDosCabecalhos(t));
    expect(revisarPaginasPelosCabecalhos(ENTRADAS, hashDosCabecalhos(t)).manifest[0].revision)
      .toBe(revisarPaginasPelosCabecalhos(ENTRADAS, hashDosCabecalhos(t)).manifest[0].revision);
  });

  it('🔴 [Right] the service worker build uses it, over the real `_headers`', () => {
    const config = readFileSync(join(process.cwd(), 'vite.config.ts'), 'utf8')
      .split(/\r?\n/).filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
    expect(config).toMatch(/manifestTransforms:\s*\[[^\]]*revisarPaginasPelosCabecalhos/);
    expect(config).toMatch(/hashDosCabecalhos\(readFileSync\([^)]*'_headers'/);
  });
});

// ============================== MUTATIONS CHECKED ==============================
//   V1 the hash not folded in (revision unchanged)        🔴 header change
//   V2 every entry revised, not only pages                🔴 [Zero]
//   V3 `manifestTransforms` removed from vite.config      🔴 build uses it
