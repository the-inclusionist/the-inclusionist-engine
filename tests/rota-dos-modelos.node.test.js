// SPDX-License-Identifier: AGPL-3.0-or-later
// THE SERVICE WORKER'S ROUTES ON THE CHECKED CACHE SERVE WHAT THE FETCHER KEPT (ADR-0177, issue #168, #173).
//
// The Cache Storage is not consulted by a `fetch` on its own: without a route, a library's request goes to the network and
// the bytes the fetcher checked sit unread. So the routes name the fetcher's own cache, read it and never write it, reach no
// third party, and stay narrow — one package, never a whole domain. Read from the sources, never from a literal repeated here.
//
// MUTAÇÕES CONFERIDAS (no fim do ficheiro).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CACHE_PESADOS } from '../app/js/platform/pesados.js';

const CONFIG = readFileSync(fileURLToPath(new URL('../vite.config.ts', import.meta.url)), 'utf8');

/**
 * A configuração sem as LINHAS de comentário — e por LINHA, não por delimitador.
 *
 * 🔴 A PRIMEIRA VERSÃO USOU UM TIRA-COMENTÁRIOS DE BLOCO E COMEU 7 KB DOS 13 KB DO FICHEIRO, deixando os
 * cinco casos a medir um resto sem `runtimeCaching` nenhum. A causa é uma linha legítima: o `globPatterns`
 * contém um glob com barra seguida de asterisco, que o varredor leu como ABERTURA de bloco e foi fechar
 * muito mais à frente.
 *
 * ⚠️ É A TERCEIRA VEZ QUE UM TIRA-COMENTÁRIOS ENGANA ESTE REPOSITÓRIO — o `nada-de-cdn-a-mao` já tinha
 * apanhado um que apagava a linha do WebGazer porque toda URL tem duas barras dentro.
 * 📌 E a versão seguinte deste comentário ainda partiu o ficheiro: ele CITAVA o padrão, e a citação continha
 * a sequência que fecha um bloco. Um comentário sobre delimitadores não pode conter os delimitadores.
 * 📌 A forma segura é a que o `nada-vem-de-fora` usa: descartar a LINHA que começa por comentário, e mais
 * nada. Não alcança um comentário no fim de uma linha de código — e não precisa, porque o que se procura
 * aqui são chaves de configuração, que vivem no início da linha.
 */
const CONFIG_LIMPA = CONFIG.split(/\r?\n/).filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');

describe('a rota dos modelos e o código apontam para o mesmo sítio', () => {
  it('🎯 [Vácuo] existe uma `runtimeCaching` no `vite.config` — sem ela nada do resto quer dizer nada', () => {
    // Sem este caso, apagar a rota inteira deixaria os outros dois a medir `undefined` contra `undefined`.
    expect(CONFIG_LIMPA, 'a rota de runtime saiu do vite.config: a Cache Storage volta a não ser consultada')
      .toMatch(/runtimeCaching\s*:/);
  });

  it('🔴 [Zero] a rota usa a MESMA cache que o buscador escreve', () => {
    // ⚠️ Um nome diferente é o defeito mais silencioso dos dois: a rota funciona, guarda numa cache própria,
    // and what the device already held is downloaded again. Nobody sees an error.
    expect(
      CONFIG_LIMPA,
      `a rota não nomeia \`${CACHE_PESADOS}\` — ela cacheia para si própria e ignora o que já desceu.`,
    ).toContain(`cacheName: '${CACHE_PESADOS}'`);
  });

  it('🔴 [Right] every route on the checked cache READS it and never WRITES it (issue #168)', () => {
    // 📏 Measured on 2026-09-13: `CacheFirst` stores a network response on a miss. A library request that came before the
    // fetcher would put unchecked bytes into the same cache, and the fetcher would then see them and say «already had».
    const blocos = CONFIG_LIMPA.split(/urlPattern:/).slice(1).filter((b) => b.includes(`cacheName: '${CACHE_PESADOS}'`));
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
    // `NetworkFirst` iria à rede primeiro e só recuaria para a cache quando a escola estivesse offline — que
    // é exactamente o dia em que já é tarde, e é a metade do pilar 8 que o ADR-0116 deixou de pé.
    // ADR-0177: CacheOnly — the files come from the delivery into the cache; a library request never reaches the upstream host.
    expect(CONFIG_LIMPA, 'a rota pode buscar na rede do terceiro').toMatch(/handler:\s*'CacheOnly'/);
    // Each route on the checked cache, split at its `urlPattern`. A third-party address is `CacheOnly`; only a route that
    // matches this origin alone (the delivery's `pesados/`, issue #173) may fall back to the network — its own origin's.
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
