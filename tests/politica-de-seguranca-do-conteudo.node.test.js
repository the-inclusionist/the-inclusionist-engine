// SPDX-License-Identifier: AGPL-3.0-or-later
// THE CONTENT-SECURITY-POLICY NAMES ONLY WHAT THE ENGINE FETCHES (issue #170; STRIDE client pass).
//
// 📏 Measured on 2026-09-13: `app/public/_headers` set cache headers and nothing else — no page limited which hosts may run
// script. With the policy on, served by a local server that applies `_headers` to the dist: the quiz loaded, the service
// worker controlled it, the card and a panel opened, voices downloaded from Hugging Face (redirected to `*.hf.co`) into
// the checked cache; a jsDelivr runtime imported, WebAssembly compiled, a `blob:` script ran — and a script from unpkg and
// an inline script were BLOCKED, each with its violation.
//
// 📌 The hosts are read from the catalogue of what the engine downloads (`platform/pesados`), not written again here.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PESADOS } from '../app/js/platform/pesados.js';

const HEADERS = readFileSync(join(process.cwd(), 'app', 'public', '_headers'), 'utf8');

/** The policy of the `/*` rule, as directive → sources. */
function politica() {
  const linhas = HEADERS.split(/\r?\n/);
  const i = linhas.findIndex((l) => l.trim() === '/*');
  if (i < 0) return null;
  const csp = linhas.slice(i + 1).find((l) => /^\s+Content-Security-Policy:/.test(l));
  if (!csp) return null;
  return Object.fromEntries(csp.replace(/^\s+Content-Security-Policy:\s*/, '').split(';').map((d) => d.trim()).filter(Boolean)
    .map((d) => { const [nome, ...fontes] = d.split(/\s+/); return [nome, fontes]; }));
}
const P = politica();
const hostsDe = (fontes) => fontes.filter((f) => /^https:\/\//.test(f)).map((f) => new URL(f.replace('*.', 'wildcard.')).host.replace('wildcard.', '*.'));
/** Where Hugging Face redirects a model — measured: `us.aws.cdn.hf.co/xet-bridge-us/…`, the region part varying. */
const REDIRECIONAMENTO_DECLARADO = '*.hf.co';

describe('the Content-Security-Policy (issue #170)', () => {
  it('🔴 [Right] every page gets a policy', () => {
    expect(P, 'no Content-Security-Policy on the `/*` rule of _headers').not.toBeNull();
  });

  it('🔴 [Right] script runs only from this origin, the checked blob: and the pinned runtimes — never inline or eval', () => {
    const s = P['script-src'];
    expect(s).toEqual(expect.arrayContaining(["'self'", 'blob:', "'wasm-unsafe-eval'"]));
    expect(s, 'inline script or eval would undo the policy').not.toEqual(expect.arrayContaining(["'unsafe-inline'"]));
    expect(s).not.toEqual(expect.arrayContaining(["'unsafe-eval'"]));
    const hostsDeScript = new Set(PESADOS.filter((p) => p.url && /\.m?js$/.test(p.url) && !p.url.includes('webgazer')).map((p) => new URL(p.url).host));
    expect(new Set(hostsDe(s)), 'script-src names a host no pinned runtime lives on, or misses one').toEqual(hostsDeScript);
  });

  it('🔴 [Right] connect-src names exactly the hosts the engine downloads from, and the declared redirect', () => {
    const doCatalogo = new Set(PESADOS.filter((p) => p.url).map((p) => new URL(p.url).host));
    const naPolitica = new Set(hostsDe(P['connect-src']).filter((h) => h !== REDIRECIONAMENTO_DECLARADO));
    expect(naPolitica, 'connect-src and the download catalogue disagree').toEqual(doCatalogo);
    expect(P['connect-src']).toContain(`https://${REDIRECIONAMENTO_DECLARADO}`);
  });

  it('🎯 [Zero] the doors nothing here uses are closed', () => {
    expect(P['object-src']).toEqual(["'none'"]);
    expect(P['base-uri']).toEqual(["'self'"]);
    expect(P['default-src']).toEqual(["'self'"]);
    expect(P['frame-ancestors']).toBeTruthy();
  });
});

// ============================== MUTATIONS CHECKED ==============================
//   C0 no policy                                   🔴 all four
//   C1 `'unsafe-inline'` in script-src             🔴 script
//   C2 a script host no runtime lives on (unpkg)   🔴 script
//   C3 a download host missing from connect-src    🔴 connect
//   C4 `blob:` removed (WebGazer from the cache)   🔴 script
//   C5 `object-src` removed                        🔴 [Zero]
