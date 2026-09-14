// SPDX-License-Identifier: AGPL-3.0-or-later
// THE PAGE IS CROSS-ORIGIN ISOLATED (ADR-0192, issue #186).
//
// 📏 Measured in the lab on 2026-09-13: onnxruntime-web's WASM said a 3 s Kokoro sentence in 8.7 s on one thread and in 2.7 s
// with threads, which need `SharedArrayBuffer`, which needs the page isolated. The Dev: «Sim». The price is that a cross-origin
// subresource without CORS or CORP is refused — so the pages the engine ships must not pull one.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const HEADERS = readFileSync(join(process.cwd(), 'app', 'public', '_headers'), 'utf8');

/** Each rule of `_headers` (Cloudflare Pages syntax): its path and its headers, lower-cased names. */
function regras() {
  const lista = [];
  let atual = null;
  for (const linha of HEADERS.split(/\r?\n/)) {
    if (!linha.trim() || linha.trim().startsWith('#')) continue;
    if (!/^\s/.test(linha)) { atual = { caminho: linha.trim(), cabecalhos: new Map() }; lista.push(atual); continue; }
    if (!atual) continue;
    // `! Name` detaches a header and carries no colon
    const solta = linha.trim().match(/^!\s*([^:\s]+)\s*$/);
    if (solta) { atual.cabecalhos.set(`! ${solta[1].toLowerCase()}`, ''); continue; }
    const m = linha.trim().match(/^([^:]+):\s*(.*)$/);
    if (m) atual.cabecalhos.set(m[1].trim().toLowerCase(), m[2].trim());
  }
  return lista;
}
const REGRAS = regras();
const TODAS = REGRAS.find((r) => r.caminho === '/*');

describe('cross-origin isolation (ADR-0192)', () => {
  it('🔴 [Right] every page is sent COOP same-origin and COEP require-corp', () => {
    expect(TODAS, 'no `/*` rule in _headers').toBeTruthy();
    expect(TODAS.cabecalhos.get('cross-origin-opener-policy')).toBe('same-origin');
    expect(TODAS.cabecalhos.get('cross-origin-embedder-policy')).toBe('require-corp');
  });

  it('⚠️ [Boundary] no narrower rule sends another value or takes them off', () => {
    // Cloudflare Pages combines the rules that match a path, and `! Name` detaches a header: a narrower rule could undo
    // the isolation for exactly the page that needs it.
    for (const r of REGRAS.filter((x) => x !== TODAS)) {
      for (const nome of ['cross-origin-opener-policy', 'cross-origin-embedder-policy']) {
        expect(r.cabecalhos.has(nome), `${r.caminho} sets ${nome} again`).toBe(false);
        expect(r.cabecalhos.has(`! ${nome}`), `${r.caminho} detaches ${nome}`).toBe(false);
      }
    }
  });

  it('🔴 [Zero] no page the engine ships pulls a subresource from another origin by src or href', () => {
    // Under COEP require-corp such a subresource is refused unless its server opts in; the engine's pages carry their own.
    const paginas = readdirSync(join(process.cwd(), 'app')).filter((f) => f.endsWith('.html'));
    expect(paginas.length, 'no page found — the case would measure nothing').toBeGreaterThan(0);
    const achados = [];
    for (const p of paginas) {
      const html = readFileSync(join(process.cwd(), 'app', p), 'utf8').replace(/<!--[\s\S]*?-->/g, '');
      for (const m of html.matchAll(/<(script|link|img|iframe|audio|video|source)\b[^>]*\b(src|href)\s*=\s*["'](https?:)?\/\/[^"']+/gi)) {
        achados.push(`${p}: ${m[0].slice(0, 90)}`);
      }
    }
    expect(achados).toEqual([]);
  });
});

// ============================== MUTATIONS CHECKED ==============================
//   I1 COOP removed from `/*`                                  🔴 [Right]
//   I2 COEP `credentialless` instead of `require-corp`         🔴 [Right]
//   I3 a narrower rule (`/sw.js`) detaches COEP                🔴 [Boundary]
//   I4 a Google Fonts <link> in quiz.html                      🔴 [Zero]
