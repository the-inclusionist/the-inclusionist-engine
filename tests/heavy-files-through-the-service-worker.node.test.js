// SPDX-License-Identifier: AGPL-3.0-or-later
// A HEAVY FILE IS SERVED FROM THE DELIVERY'S OWN `pesados/` (ADR-0177, issue #173): a delivery path maps back to the upstream
// address the fetcher keeps it under, and the service worker answers that path from the checked cache without writing it.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PESADOS, caminhoNaEntrega, chaveDaEntrega } from '../app/js/platform/pesados.js';

const CONFIG = readFileSync(join(process.cwd(), 'vite.config.ts'), 'utf8');
const CONFIG_LIMPA = CONFIG.split(/\r?\n/).filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');

describe('heavy files, from the delivery', () => {
  it('🔴 [Right] a delivery path maps back to the upstream address the fetcher keeps it under', () => {
    for (const p of PESADOS.filter((x) => x.url)) {
      expect(chaveDaEntrega(`https://escola.example/jogo/${caminhoNaEntrega(p.url)}`)).toBe(p.url);
    }
  });

  it('📌 [Boundary] an address outside `pesados/` has no key — the route leaves it alone', () => {
    expect(chaveDaEntrega('https://escola.example/jogo/assets/index.js')).toBeNull();
    expect(chaveDaEntrega('https://escola.example/pesadosx/cdn.jsdelivr.net/a.wasm')).toBeNull();
  });

  it('🔴 [Right] the service worker answers `pesados/` from the checked cache, through that mapping, and never writes it', () => {
    const rota = CONFIG_LIMPA.match(/\{[^{}]*urlPattern:[^\n]*pesados[\s\S]*?cacheKeyWillBeUsed[\s\S]*?\n\s{10}\},/)?.[0];
    expect(rota, 'no service worker route for the delivery\'s `pesados/`').toBeTruthy();
    expect(rota).toMatch(/handler:\s*'CacheFirst'/);
    expect(rota).toMatch(/cacheName:\s*'incl-pesados-v2'/);
    expect(rota).toMatch(/cacheKeyWillBeUsed:[^\n]*chaveDaEntrega/);
    expect(rota, 'the route would cache an unchecked body').toMatch(/cacheWillUpdate:\s*async \(\) => null/);
  });
});

// ============================== MUTATIONS CHECKED ==============================
//   P2 the key keeps the delivery path                          🔴 maps back
//   P3 any path gets a key                                      🔴 [Boundary]
//   P4 the route writes the cache                               🔴 route
//   P5 the route without the mapping                            🔴 route
//   P6 the route matches any origin                             🔴 `rota-dos-modelos`: a route that can reach a third party
