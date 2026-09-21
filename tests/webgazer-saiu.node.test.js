// SPDX-License-Identifier: AGPL-3.0-or-later
// WEBGAZER LEFT THE ENGINE (ADR-0214; issue #198). Eye control is MediaPipe's relative reading (ADR-0213) and needs no gaze point on the
// screen; WebGazer was 1.9 MB of GPL research code fetched at install on every device, reaching games by synthetic keys.
//
// Comments may still NAME it — they record why it left — so the sieve reads code, not prose.
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HEAVY_FILES } from '../app/js/platform/pesados-catalogo.js';

const RAIZ = fileURLToPath(new URL('../app/js/', import.meta.url));
const ficheiros = (dir = RAIZ) => readdirSync(dir).flatMap((n) => {
  const p = join(dir, n);
  return statSync(p).isDirectory() ? ficheiros(p) : n.endsWith('.ts') ? [p] : [];
});
const semComentarios = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').split(/\r?\n/).map((l) => l.replace(/(^|[^:])\/\/.*$/, '$1')).join('\n');

describe('WebGazer left', () => {
  it('no code in the engine names it', () => {
    const ficam = ficheiros().filter((p) => /webgazer/i.test(semComentarios(readFileSync(p, 'utf8'))));
    expect(ficheiros().length, 'the sweep found no module').toBeGreaterThan(50);
    expect(ficam.map((p) => p.slice(RAIZ.length)), 'code still names WebGazer').toEqual([]);
  });
  it('the heavy-file catalogue has no WebGazer entry, and ui/webcam is gone', () => {
    expect(HEAVY_FILES.filter((p) => p.id === 'visao:olhar' || /webgazer/i.test(p.url ?? ''))).toEqual([]);
    expect(existsSync(join(RAIZ, 'ui', 'webcam.ts'))).toBe(false);
  });
});

// MUTATIONS CHECKED (2026-09-16):
//   · the `visao:olhar` entry put back in the catalogue          → «no WebGazer entry» and «no code names it»
//   · a code line `const WG = 'webgazer'` in a module             → «no code names it»
