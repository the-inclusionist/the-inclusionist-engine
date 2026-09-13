// SPDX-License-Identifier: AGPL-3.0-or-later
// THE VOICE'S PHONEMIZER COMES FROM THE DELIVERY, LIKE EVERY OTHER HEAVY FILE (ADR-0177, issue #173).
//
// 📌 `@mintplex-labs/piper-tts-web` turns text into phonemes with espeak-ng compiled to WebAssembly: `piper_phonemize.wasm`
// and its `piper_phonemize.data` (the pronunciation rules). It fetched both from jsDelivr on every first sentence — a third
// party the child's device contacted, and nothing to speak with offline. 📏 Measured on 2026-09-13: 635 212 and 18 077 249
// bytes, the sha256 equal to jsDelivr's package metadata.
//
// Three halves that fail apart silently: the catalogue carries the provider's own addresses (read from the installed
// library, not repeated here); the engine asks the provider to fetch them at the delivery path; and the service worker
// answers a delivery path from the checked cache, where the fetcher keeps it under the upstream address.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PESADOS, caminhoNaEntrega, chaveDaEntrega } from '../app/js/platform/pesados.js';

const LIB = readFileSync(join(process.cwd(), 'node_modules', '@mintplex-labs', 'piper-tts-web', 'dist', 'piper-tts-web.js'), 'utf8');
const CONFIG = readFileSync(join(process.cwd(), 'vite.config.ts'), 'utf8');
const CONFIG_LIMPA = CONFIG.split(/\r?\n/).filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');

/** The provider's default phonemizer addresses, as its bundle writes them. */
function doFornecedor() {
  const base = LIB.match(/const WASM_BASE = "([^"]+)"/)?.[1];
  const usa = /piperData:\s*`\$\{WASM_BASE\}\.data`/.test(LIB) && /piperWasm:\s*`\$\{WASM_BASE\}\.wasm`/.test(LIB);
  return base && usa ? { piperWasm: `${base}.wasm`, piperData: `${base}.data` } : null;
}

describe('the phonemizer, from the delivery', () => {
  it('🔴 [Right] the catalogue pins both phonemizer files at the provider\'s own addresses, with size and sha256', () => {
    const f = doFornecedor();
    expect(f, 'the installed provider no longer writes its phonemizer addresses this way — measure it again').not.toBeNull();
    for (const url of [f.piperWasm, f.piperData]) {
      const e = PESADOS.find((p) => p.url === url);
      expect(e, `${url} is not in the download catalogue: the voice fetches it from a third party`).toBeTruthy();
      expect(e.sha256, `${e.id} pins no sha256`).toMatch(/^[0-9a-f]{64}$/);
      expect(e.bytes).toBeGreaterThan(0);
    }
  });

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
//   P1 the phonemizer data entry removed from the catalogue     🔴 catalogue
//   P2 the key keeps the delivery path                          🔴 maps back
//   P3 any path gets a key                                      🔴 [Boundary]
//   P4 the route writes the cache                               🔴 route
//   P5 the route without the mapping                            🔴 route
//   P6 the route matches any origin                             🔴 `rota-dos-modelos`: a route that can reach a third party
