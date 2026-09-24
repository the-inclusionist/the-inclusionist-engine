// SPDX-License-Identifier: AGPL-3.0-or-later
// THE SERVICE WORKER'S ROUTES ON THE CHECKED CACHE SERVE WHAT THE FETCHER KEPT (ADR-0177, issue #168, #173).
//
// The Cache Storage is not consulted by a `fetch` on its own: without a route, a library's request goes to the network and
// the bytes the fetcher checked sit unread. So the routes name the fetcher's own cache, read it and never write it, reach no
// third party, and stay narrow — one package, never a whole domain. Read from the sources, never from a literal repeated here.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CACHE_HEAVY } from '../app/js/platform/heavy.js';

const CONFIG = readFileSync(fileURLToPath(new URL('../vite.config.ts', import.meta.url)), 'utf8');

/**
 * The configuration without its comment LINES — by LINE, not by delimiter.
 *
 * 🔴 A block comment-stripper ate 7 KB of the file's 13 KB and left the cases measuring a remainder with no
 * `runtimeCaching` at all. The cause is a legitimate line: `globPatterns` holds a glob with a slash followed by an
 * asterisk, which the scanner read as a block OPENING and closed much further on.
 * ⚠️ Comment-strippers have fooled this repository before — one erased every URL line, since a URL holds two slashes.
 * 📌 And a comment about delimiters cannot contain the delimiters: quoting the pattern here once broke this file.
 * 📌 The safe form is the one nothing-comes-from-outside.node.test.js uses: drop the LINE that starts as a comment, and
 * nothing else. It does not reach a comment at the end of a code line — and need not, because what is sought here are
 * configuration keys, which live at the start of the line.
 */
const CONFIG_LIMPA = CONFIG.split(/\r?\n/).filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');

describe('a rota dos modelos e o código apontam para o mesmo sítio', () => {
  it('🎯 [Vácuo] existe uma `runtimeCaching` no `vite.config` — sem ela nada do resto quer dizer nada', () => {
    // Without this case, deleting the whole route would leave the other cases measuring nothing.
    expect(CONFIG_LIMPA, 'a rota de runtime saiu do vite.config: a Cache Storage volta a não ser consultada')
      .toMatch(/runtimeCaching\s*:/);
  });

  it('🔴 [Zero] a rota usa a MESMA cache que o buscador escreve', () => {
    // ⚠️ A different name is the quietest defect of all: the route works, keeps to a cache of its own,
    // and what the device already held is downloaded again. Nobody sees an error.
    expect(
      CONFIG_LIMPA,
      `a rota não nomeia \`${CACHE_HEAVY}\` — ela cacheia para si própria e ignora o que já desceu.`,
    ).toContain(`cacheName: '${CACHE_HEAVY}'`);
  });

  it('🔴 [Right] every route on the checked cache READS it and never WRITES it (issue #168)', () => {
    // 📏 Measured on 2026-09-13: `CacheFirst` stores a network response on a miss. A library request that came before the
    // fetcher would put unchecked bytes into the same cache, and the fetcher would then see them and say «already had».
    const blocos = CONFIG_LIMPA.split(/urlPattern:/).slice(1).filter((b) => b.includes(`cacheName: '${CACHE_HEAVY}'`));
    expect(blocos.length, 'no route on the checked cache — the case would measure nothing').toBeGreaterThanOrEqual(2);
    for (const b of blocos) {
      expect(b, 'a route on the checked cache can write to it').toMatch(/cacheWillUpdate:\s*async\s*\(\)\s*=>\s*null/);
    }
  });

  it('📌 [Boundary] the reach is NARROW — a third-party route opens one PACKAGE, never a whole domain', () => {
    // 🎯 The wide door is the defect #119 already closed elsewhere: a route over a whole domain would keep whatever anyone later
    // fetched from it, with nobody deciding. `matchAll` and not `match`: a wide route added second would otherwise walk past a case that reads only the first.
    const rotas = [...CONFIG_LIMPA.matchAll(/urlPattern:\s*\/([^\n]*?)\/,/g)].map((m) => m[1]);
    expect(rotas.length, 'no route patterns found').toBeGreaterThanOrEqual(1);
    for (const rota of rotas) {
      expect(rota, `route too wide — it opened a whole domain: ${rota}`).toMatch(/@mediapipe\\\/tasks-vision@/);
    }
  });

  it('⚠️ [Right] é `CacheOnly` — nunca a rede do terceiro (ADR-0177), e o pilar 8 continua servido pela cache', () => {
    // `NetworkFirst` would go to the network first and fall back to the cache only when the school is offline — which is
    // exactly the day it is too late, and the half of pillar 8 that ADR-0116 left standing.
    // ADR-0177: CacheOnly — the files come from the delivery into the cache; a library request never reaches the upstream host.
    expect(CONFIG_LIMPA, 'a rota pode buscar na rede do terceiro').toMatch(/handler:\s*'CacheOnly'/);
    // Each route on the checked cache, split at its `urlPattern`. A third-party address is `CacheOnly`; only a route that
    // matches this origin alone (the delivery's `heavy/`, issue #173) may fall back to the network — its own origin's.
    const rotas = CONFIG_LIMPA.split(/(?=urlPattern:)/).slice(1).map((r) => r.slice(0, r.indexOf('cacheName')));
    expect(rotas.length, 'no route was split out — the case would measure nothing').toBeGreaterThan(1);
    for (const r of rotas) {
      if (/handler:\s*'CacheOnly'/.test(r)) continue;
      expect(r, 'a route that can reach the network is not limited to this origin').toMatch(/urlPattern:\s*\(\{\s*sameOrigin[^)]*\}\)\s*=>\s*sameOrigin\s*&&/);
    }
  });
});

// ================================ MUTATIONS CHECKED ================================
// 1. 🎯 `cacheName` renamed → the cache [Zero] fails: the route still WORKS, keeps for itself, and what the device held comes down
//    again.
// 3. the route widened to the whole domain → the [Boundary] fails.
// 4. `CacheOnly` → `NetworkFirst` → the [Right] fails, and the defect is the second day offline.
// #168 (2026-09-13): one route without the read-only plugin → 🔴 the read-only case.
