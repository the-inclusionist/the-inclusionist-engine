// SPDX-License-Identifier: AGPL-3.0-or-later
// A ROTA DO SERVICE WORKER APONTA PARA O QUE O CÓDIGO REALMENTE USA — senão os 241 MB descem para ninguém.
//
// ========================= O DEFEITO QUE ISTO GUARDA, E ELE JÁ ACONTECEU =========================
// 🔴 Em 2026-09-09 o `platform/pesados` passou a descer os quatro modelos de voz no primeiro carregamento, e
// **ninguém os lia**. Duas causas, medidas: a engine buscava num espelho (`rhasspy`) e o único leitor lia
// noutro (`diffusionstudio`), e — mesmo com a URL igual — a Cache Storage **não é consultada sozinha** por um
// `fetch`. Sem uma rota do service worker o pedido vai direto à rede. Até 482 MB num link de escola por UMA voz.
//
// 🎯 O CONSERTO TEM DUAS METADES E NENHUMA BASTA SOZINHA: o `HOST_DOS_MODELOS` passou a apontar para onde o
// leitor lê, e a `runtimeCaching` do `vite.config` serve esse host a partir da MESMA cache que o buscador
// escreve. ⚠️ E é por serem duas metades em ficheiros diferentes que este crivo existe: mudar uma sem a outra
// não dá erro em lado nenhum — dá uma rota que existe e não serve nada, ou uma cache que ninguém consulta.
//
// 📌 É a forma do `teste que lê pela ligação não falha`: os dois lados têm de ser lidos das suas FONTES
// (o módulo e o ficheiro de configuração), nunca de um literal repetido aqui.
//
// MUTAÇÕES CONFERIDAS (no fim do ficheiro).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { HOST_DOS_MODELOS } from '../app/js/platform/voice-plan.js';
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

  it('🔴 [Zero] a rota cobre o HOST que o código busca — lido do módulo, não de um literal', () => {
    // `HOST_DOS_MODELOS` acaba em `/resolve/main/`; a rota escreve-o escapado numa RegExp. Compara-se o dono
    // do repositório, que é a parte que muda quando alguém troca de espelho — e é a que já trocou uma vez.
    const dono = HOST_DOS_MODELOS.match(/huggingface\.co\/([^/]+)\//)?.[1];
    expect(dono, 'o host dos modelos deixou de ser um endereço do Hugging Face').toBeTruthy();
    expect(
      CONFIG_LIMPA,
      `a rota do service worker não cobre «${dono}» — o buscador desce os modelos e a biblioteca volta a `
      + 'descarregá-los, porque a Cache Storage não é consultada sozinha por um `fetch`.',
    ).toContain(`huggingface\\.co\\/${dono}\\/`);
  });

  it('🔴 [Zero] a rota usa a MESMA cache que o buscador escreve', () => {
    // ⚠️ Um nome diferente é o defeito mais silencioso dos dois: a rota funciona, guarda numa cache própria,
    // e os 241 MB que já estavam no aparelho continuam a ser descarregados outra vez. Ninguém vê erro.
    expect(
      CONFIG_LIMPA,
      `a rota não nomeia \`${CACHE_PESADOS}\` — ela cacheia para si própria e ignora o que já desceu.`,
    ).toContain(`cacheName: '${CACHE_PESADOS}'`);
  });

  it('📌 [Boundary] o alcance é ESTREITO — a rota não abre `huggingface.co` inteiro', () => {
    // 🎯 A porta larga é a forma de defeito que a #119 já fechou noutro ponto: uma rota sobre o domínio
    // inteiro passaria a guardar qualquer coisa que alguém viesse a buscar de lá, sem ninguém decidir.
    const rota = CONFIG_LIMPA.match(/urlPattern:\s*\/([^\n]*?)\/,/)?.[1] ?? '';
    expect(rota, 'não achei o padrão da rota').toBeTruthy();
    expect(rota, 'a rota abriu o domínio inteiro em vez do repositório dos modelos').toMatch(/piper-voices/);
  });

  it('⚠️ [Right] é `CacheFirst` e não `NetworkFirst` — o pilar 8 decide isto, não o gosto', () => {
    // `NetworkFirst` iria à rede primeiro e só recuaria para a cache quando a escola estivesse offline — que
    // é exactamente o dia em que já é tarde, e é a metade do pilar 8 que o ADR-0116 deixou de pé.
    expect(CONFIG_LIMPA, 'a rota deixou de servir da cache primeiro').toMatch(/handler:\s*'CacheFirst'/);
  });
});

// ================================ MUTAÇÕES CONFERIDAS ================================
// 1. 🎯 `cacheName` mudado para outro nome → o [Zero] da cache reprova. É a mutação que mais importa: a rota
//    continua a FUNCIONAR, guarda para si própria, e os 241 MB que já estavam no aparelho descem outra vez.
//    Nada em produção dá erro; o que se perde é a razão inteira do buscador existir.
// 2. `HOST_DOS_MODELOS` a voltar para `rhasspy` sem a rota mudar → o [Zero] do host reprova. É o par: as duas
//    metades vivem em ficheiros diferentes e mover uma sozinha não acusa em lado nenhum.
// 3. a rota alargada para `/^https:\/\/huggingface\.co\//` → o [Boundary] reprova. Uma porta larga entra a
//    resolver um caso e fica a guardar tudo o que alguém buscar daquele domínio.
// 4. `CacheFirst` → `NetworkFirst` → o [Right] reprova, e o defeito é o segundo dia sem rede.
