// SPDX-License-Identifier: AGPL-3.0-or-later
// Testes de render/set-cenario — a ORQUESTRAÇÃO da troca de mundo visual (project node). ZOMBIES + Right-BICEP.
//
// `setCenario` não desenha nada: ela decide QUEM é avisado e EM QUE ORDEM. É por isso que quase todos os casos
// daqui são sobre SEQUÊNCIA e sobre TEMPO, e não sobre valor:
//
//  · `setCenarioValue` (grava + persiste) vem ANTES do trabalho de textura, e continua sendo o primeiro passo.
//  · A GUARDA DE CORRIDA SUMIU DAQUI, e os testes dela sumiram junto (#17). Enquanto os tiles chegavam por
//    `Promise`, trocar de cenário durante o download deixava um tileset atrasado do Campo repintar o chão da
//    Floresta — defeito de um em cem, que somia quando alguém ia olhar. Os tiles agora são DESENHADOS
//    (render/city-tiles), a troca é síncrona e não há "durante". Apagar aqueles casos não é perder cobertura:
//    é parar de testar um comportamento que deixou de existir. Testar uma guarda que não guarda mais nada faria
//    a suíte afirmar, para sempre, que ainda há uma corrida.
//  · O `reapplyVizAll` que sobrou é UM só. Eram dois — o síncrono do tema e o do `.then` da textura — e com a
//    textura vindo no mesmo instante os dois viraram o mesmo momento. No BOOT (`vizReady` falso) o caminho
//    continua sendo o terceiro: pintar `worldSprite` direto.
import { describe, it, expect } from 'vitest';
import pt from '../app/js/i18n/pt.js';
import { SCENERIES } from '../app/js/render/cenario-data.js';
import { createSetScenery } from '../app/js/render/set-cenario.js';

/* ===================== dublês ===================== */

function ambiente(over = {}) {
  const log = [], temasPedidos = [];
  const estado = { cenario: 'cidade', vizReady: over.vizReady ?? false, vidaReady: over.vidaReady ?? false, world: null };
  const worldSprite = over.semWorldSprite ? null : { texture: 'TEX-VELHA' };
  const ctx = {
    setCenarioValue: (t) => { log.push(['setCenarioValue', t]); estado.cenario = t; },
    getCenario: () => estado.cenario,
    // Registra `T.nome` para provar que o TEMA INTEIRO atravessa, não só o id. Desde a Fase 5 `nome` é a
    // CHAVE i18n do cenário (render/cenario-data), então as asserções abaixo passam pelo dicionário — assim
    // continuam afirmando o nome que a criança lê, e não apenas que alguma string chegou.
    aplicarTemaParallax: (theme, T) => log.push(['parallax', theme, T.nome]),
    // Os tiles do tema, síncronos. `semTiles` simula um tema sem arte própria — o caminho dos blocos v3.
    getTiles: (tema) => { temasPedidos.push(tema); return over.semTiles ? null : 'tiles'; },
    worldCanvas: (tiles) => { log.push(['worldCanvas', tiles === null ? null : 'tiles']); return 'CANVAS'; },
    tex: (cv) => 'TEX(' + cv + ')',
    clearWorldTexCache: () => log.push(['clearWorldTexCache']),
    setWorldTextures: (cv, t) => { log.push(['setWorldTextures', cv, t]); estado.world = [cv, t]; },
    isVizReady: () => estado.vizReady,
    reapplyVizAll: () => log.push(['reapplyVizAll']),
    getWorldSprite: () => worldSprite,
    isVidaReady: () => estado.vidaReady,
    applyCenarioVida: () => log.push(['applyCenarioVida']),
  };
  return { ctx, log, temasPedidos, estado, worldSprite, api: createSetScenery(ctx) };
}

/* ===================== carregarTilesDoTema ===================== */

describe('setCenario — validação', () => {
  it('tema conhecido passa inteiro', () => {
    const { api, log } = ambiente();
    api.setCenario('floresta');
    expect(log[0]).toEqual(['setCenarioValue', 'floresta']);
    expect(log[1]).toEqual(['parallax', 'floresta', SCENERIES.floresta.nome]);
    expect(pt[log[1][2]]).toBe('Floresta');
  });

  it('tema DESCONHECIDO cai para a Cidade — e é a Cidade que é persistida e pintada', () => {
    const { api, log, temasPedidos } = ambiente();
    api.setCenario('praia');
    expect(log[0]).toEqual(['setCenarioValue', 'cidade']);
    expect(log[1]).toEqual(['parallax', 'cidade', SCENERIES.cidade.nome]);
    expect(pt[log[1][2]]).toBe('Cidade');
    expect(temasPedidos).toEqual(['cidade']); // os tiles pedidos são os da Cidade, e não os de 'praia'
  });

  it('a chave antiga "noite" NÃO é tema (a migração é do game.js) e cai para a Cidade', () => {
    const { api, log } = ambiente();
    api.setCenario('noite');
    expect(log[0]).toEqual(['setCenarioValue', 'cidade']);
  });
});

describe('setCenario — a ordem dos passos', () => {
  it('persiste ANTES de mexer em textura', () => {
    const { api, log } = ambiente();
    api.setCenario('campo');
    const iValor = log.findIndex((l) => l[0] === 'setCenarioValue');
    const iParallax = log.findIndex((l) => l[0] === 'parallax');
    expect(iValor).toBe(0);
    expect(iParallax).toBeGreaterThan(iValor);
  });

  it('a textura do mundo entra ANTES da vida ambiente — era depois, quando ela era prometida', () => {
    // A ordem MUDOU com o #17, e é a mudança que este caso existe para prender. Com os tiles chegando por
    // `Promise`, `applyCenarioVida` corria primeiro e a textura entrava numa microtarefa depois. Agora tudo
    // acontece na mesma chamada, e a textura vem antes.
    const { api, log } = ambiente({ vidaReady: true, vizReady: true });
    api.setCenario('campo');
    expect(log.map((l) => l[0])).toEqual([
      'setCenarioValue', 'parallax', 'worldCanvas', 'setWorldTextures', 'clearWorldTexCache',
      'reapplyVizAll', 'applyCenarioVida', 'reapplyVizAll',
    ]);
  });

  it('BOOT: vida e recolor ainda não prontos → nenhum dos dois é chamado (e nada estoura)', () => {
    const { api, log } = ambiente({ vidaReady: false, vizReady: false });
    expect(() => api.setCenario('campo')).not.toThrow();
    expect(log.map((l) => l[0])).toEqual(['setCenarioValue', 'parallax', 'worldCanvas', 'setWorldTextures', 'clearWorldTexCache']);
  });

  it('vida pronta e recolor não: só a vida é avisada', () => {
    const { api, log } = ambiente({ vidaReady: true, vizReady: false });
    api.setCenario('campo');
    expect(log.map((l) => l[0])).toContain('applyCenarioVida');
    expect(log.map((l) => l[0])).not.toContain('reapplyVizAll');
  });
});

/* ===================== setCenario: a textura do mundo (SÍNCRONA desde o #17) ===================== */

describe('setCenario — os tiles do tema', () => {
  it('[Right] com tiles: refaz a canvas, grava a dupla canvas/textura e invalida o cache', () => {
    const { api, log, estado } = ambiente();
    api.setCenario('campo');
    expect(log).toContainEqual(['worldCanvas', 'tiles']);
    expect(estado.world).toEqual(['CANVAS', 'TEX(CANVAS)']);
    expect(log.map((l) => l[0])).toContain('clearWorldTexCache');
  });

  it('[Zero] tema SEM arte própria: worldCanvas recebe null e o mundo cai no desenho da v3', () => {
    // Era o caminho do PNG ausente (404). Continua sendo um caminho NORMAL, não um erro: quatro dos cinco
    // temas nunca tiveram tileset. O que mudou é que agora ele custa zero pedido de rede.
    const { api, log } = ambiente({ semTiles: true });
    api.setCenario('campo');
    expect(log).toContainEqual(['worldCanvas', null]);
  });

  it('[Interface] grava a textura ANTES de invalidar o cache (o cache tem de ver o valor novo)', () => {
    const { api, log } = ambiente();
    api.setCenario('campo');
    expect(log.findIndex((l) => l[0] === 'setWorldTextures'))
      .toBeLessThan(log.findIndex((l) => l[0] === 'clearWorldTexCache'));
  });

  it('[Boundary] BOOT (vizReady falso): pinta o worldSprite DIRETO e não chama o recolor', () => {
    const { api, log, worldSprite } = ambiente({ vizReady: false });
    api.setCenario('campo');
    expect(worldSprite.texture).toBe('TEX(CANVAS)');
    expect(log.map((l) => l[0])).not.toContain('reapplyVizAll');
  });

  it('[Boundary] pós-boot (vizReady): reaplica o recolor e NÃO carimba o sprite por fora', () => {
    const { api, log, worldSprite } = ambiente({ vizReady: true });
    api.setCenario('campo');
    expect(log.filter((l) => l[0] === 'reapplyVizAll')).toHaveLength(2); // o da textura + o do tema
    expect(worldSprite.texture).toBe('TEX-VELHA'); // quem pinta é o recolor
  });

  it('[Zero/Error] BOOT extremo: worldSprite ainda não existe → nada estoura', () => {
    const { api } = ambiente({ vizReady: false, semWorldSprite: true });
    expect(() => api.setCenario('campo')).not.toThrow();
  });

  it('[Interface] a troca inteira acontece na CHAMADA — nada fica pendurado em microtarefa', async () => {
    // É o que substitui os casos da guarda de corrida. Enquanto os tiles vinham por `Promise`, o trabalho de
    // textura acontecia DEPOIS do retorno, e trocar de cenário no meio era possível. Este caso afirma o
    // contrário: ao retornar, já acabou — e é por isso que não há mais o que guardar.
    const { api, estado } = ambiente();
    api.setCenario('campo');
    expect(estado.world).toEqual(['CANVAS', 'TEX(CANVAS)']); // já gravado, sem `await` nenhum
    const antes = JSON.stringify(estado.world);
    await Promise.resolve(); await Promise.resolve();
    expect(JSON.stringify(estado.world)).toBe(antes); // e nada mais chega depois
  });
});
