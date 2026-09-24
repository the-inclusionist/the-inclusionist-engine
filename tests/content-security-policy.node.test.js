// SPDX-License-Identifier: AGPL-3.0-or-later
// THE CONTENT-SECURITY-POLICY NAMES ONLY WHAT A PAGE REQUESTS (issue #170; narrowed by ADR-0177, issue #173).
//
// 📌 Since ADR-0177 the heavy files come from the delivery's own origin: the download catalogue's hosts are contacted by the
// BUILD, and a page never asks them for a download. What a page can still request from a third-party address is what a
// library writes on its own — each host below names its requester. A catalogue host no page requests stays out.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { HEAVY_FILES } from '../app/js/platform/heavy.js';

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

/**
 * The hosts a library on the page requests by itself, each with its requester. None since ADR-0207: the voice provider that
 * hardcoded its models' host left the engine, and every heavy file is asked at the delivery's own `heavy/`.
 */
const PEDIDOS_PELAS_BIBLIOTECAS = new Map();

describe('the Content-Security-Policy (issues #170, #173)', () => {
  it('🔴 [Right] every page gets a policy', () => {
    expect(P, 'no Content-Security-Policy on the `/*` rule of _headers').not.toBeNull();
  });

  it('🔴 [Right] script runs only from this origin — never a blob:, inline, eval or a third-party host', () => {
    const s = P['script-src'];
    expect(s).toEqual(expect.arrayContaining(["'self'", "'wasm-unsafe-eval'"]));
    // `blob:` served WebGazer from the checked cache (#169); it left with WebGazer (ADR-0214), and no script runs from a blob now
    expect(s, 'a script from a blob: URL').not.toEqual(expect.arrayContaining(['blob:']));
    expect(s, 'inline script or eval would undo the policy').not.toEqual(expect.arrayContaining(["'unsafe-inline'"]));
    expect(s).not.toEqual(expect.arrayContaining(["'unsafe-eval'"]));
    expect(hostsDe(s), 'a runtime from a third-party host: the delivery carries its runtimes (ADR-0177)').toEqual([]);
  });

  it('🔴 [Right] connect-src names exactly the hosts a library requests by itself', () => {
    expect(new Set(hostsDe(P['connect-src'])), 'connect-src and the named requesters disagree').toEqual(new Set(PEDIDOS_PELAS_BIBLIOTECAS.keys()));
  });

  it('🔴 [Right] a host only the build contacts is not in the policy', () => {
    const naPolitica = new Set(Object.values(P).flatMap(hostsDe));
    const soDoBuild = [...new Set(HEAVY_FILES.filter((p) => p.url).map((p) => new URL(p.url).host))].filter((h) => !PEDIDOS_PELAS_BIBLIOTECAS.has(h));
    expect(soDoBuild.length, 'the catalogue has hosts only the build contacts — the case below would be vacuous').toBeGreaterThan(0);
    for (const h of soDoBuild) expect(naPolitica.has(h), `${h} is contacted by the build only, and the policy still admits it`).toBe(false);
    expect([...naPolitica].some((h) => h.startsWith('*.')), 'a wildcard admits a redirect the service worker never follows').toBe(false);
  });

  it('🎯 [Zero] the doors nothing here uses are closed', () => {
    expect(P['object-src']).toEqual(["'none'"]);
    expect(P['base-uri']).toEqual(["'self'"]);
    expect(P['default-src']).toEqual(["'self'"]);
    expect(P['frame-ancestors']).toBeTruthy();
  });
});

// ============================== MUTATIONS CHECKED ==============================
//   C0 no policy                                          🔴 all five
//   C1 `'unsafe-inline'` in script-src                    🔴 script
//   C2 a script host (jsDelivr) back in script-src        🔴 script
//   C3 a third-party host back in connect-src (ADR-0207)  🔴 connect
//   C4 `blob:` back in script-src (WebGazer left, ADR-0214) 🔴 script
//   C5 `object-src` removed                               🔴 [Zero]
//   C6 storage.googleapis.com back in connect-src         🔴 connect, build only
//   C7 `*.hf.co` back in connect-src                      🔴 connect, build only
//   C8 jsDelivr back in connect-src (the phonemizer)      🔴 connect, build only
