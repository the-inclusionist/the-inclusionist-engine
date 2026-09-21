// SPDX-License-Identifier: AGPL-3.0-or-later
// Constantes puras (imutáveis) do jogo — módulo-folha, ZERO deps. TypeScript (Estágio 3): tipos inferidos dos literais.
// TUNE é objeto mutável (o painel de debug ajusta propriedades), mas NUNCA reatribuído → o import const
// funciona (mutar propriedade é ok; reatribuir é que quebraria). Ver docs/plano-modularizacao.md.

export const LOGICAL_W = 320, LOGICAL_H = 180, TILE = 16;
// ⚠️ `COIN_TARGET` e `TUNE` MUDARAM DE CASA EM 2026-09-07 — foram para `game/tuning.ts` do `game-platformer`
// (issue #63, etapa B, decisão do Dev). Tinham ZERO importadores dentro desta árvore e TODOS do outro lado
// da fronteira do pacote: não eram código morto, eram a superfície pública que o cartucho consumia.
//
// Uma engine que exporta a GRAVIDADE e a META DE MOEDAS está a decidir que todo jogo é uma plataforma de
// coletar coisas. `TUNE` é gravidade, velocidade de nado e curso do trampolim — a física DAQUELE jogo; um
// quiz não tem gravidade. `COIN_TARGET` é o objetivo, que é conteúdo.
//
// A etapa C (o segundo consumidor) é o que autorizou o corte: catorze achados, e nenhum reclama estes dois
// para a engine. O `ui/debug-panel` continua a afinar o `TUNE` ao vivo — ele sempre o recebeu por INJEÇÃO
// (`TUNE: Tune` no ctx), nunca por importação, e é por isso que a mudança não lhe custou nada.
// ⚠️ `JUMP_BASE` SAIU EM 2026-09-07 (issue #63, etapa B, decisão do Dev). Não tinha um único consumidor:
// nem na engine, nem no `game-platformer`, nem nos testes — fora UM, que verificava que
// `JUMP_BASE === jumpVel * sqrt(8/5)`, ou seja **reafirmava a própria definição**. Um teste que não pode
// falhar por motivo que importe, a manter viva uma constante que ninguém usa. A própria issue #63 já o
// nomeava no seu «achado solto».

// E15: cadência de animação (ticks por quadro) — regulável ao vivo no painel ?debug=true. Como TUNE, é objeto
// mutável (o debug ajusta propriedades) mas NUNCA reatribuído → import const funciona. andar 6; correr 8 (~8fps,
// pedido do José); idle 20; swim 24; cling 10; escada 8; flavor ~6s.
export const ANIM = { walkHold: 6, runHold: 8, idleHold: 20, swimHold: 24, clingHold: 10, climbHold: 8, flavorDelay: 360 };

// Modo FÁCIL (acessibilidade motora): multiplicadores que suavizam a física. grav ×2/3, pulo ×8/7, velocidade
// ×0,7, zona-morta do pad ×4, queda lenta ×1,4, trampolim ×3,4. Lido pela física (game.js) e por jumpVel (player).
export const EASY = { grav: 2 / 3, jump: 8 / 7, speed: 0.7, pad: 4, slowFall: 1.4, tramp: 3.4 };

/* ===================== TILE_TYPES: o que cada tipo de tile É =====================
 *
 * ESTA TABELA EXISTIA E QUASE NINGUÉM A USAVA, e a razão era de interface, não de gosto: o tipo dela
 * (`TileType`) era declarado PRIVADO dentro de `core/collision`, e a tabela não tinha anotação nenhuma. Quem
 * quisesse perguntar "este tile machuca?" fora dali teria de redeclarar o tipo e repetir o cast — então
 * ninguém perguntava: comparava número. Medido em 2026-08-25: 72 pontos liam número de tile cru, em 16
 * arquivos, e só TRÊS usavam esta tabela.
 *
 * O preço disso não é estético. `t === 9` só é verdade neste mapa: um segundo jogo com outra numeração
 * herdaria física, alto contraste e sonar apontando para o tile errado — sem erro de tipo, sem teste vermelho.
 */

/** O que um tipo de tile é. Estava privado em `core/collision`; público aqui, que é onde a tabela mora. */
export type TileType = {
  solid?: boolean; bounce?: number; water?: boolean; jump?: boolean;
  ladder?: boolean; tramp?: boolean; hazard?: boolean; gate?: boolean; key?: boolean;
  /** Ar de REGIÃO SECRETA (o tile 0). A propriedade é nova; o significado não — `TILE_NAME[0]` já dizia
   *  "ar escuro/secreto". Estava só na tabela de NOMES, que ninguém consulta para decidir nada. */
  secreto?: boolean;
};

export const TILE_TYPES: Record<number, TileType> = {
  0:{solid:false,secreto:true}, 1:{solid:false}, 2:{solid:true,bounce:0.28}, 3:{solid:false,water:true,jump:true},
  4:{solid:false,ladder:true}, 5:{solid:true,bounce:1.1,tramp:true}, 6:{solid:true,bounce:0},
  7:{solid:false}, 8:{solid:false}, 9:{solid:false,hazard:true}, 10:{solid:true,gate:true},
  11:{solid:false,key:true}, 12:{solid:false}, 13:{solid:false}, 14:{solid:false},
};
/* ===================== QUEM PODE IMPORTAR ESTAS PERGUNTAS =====================
 *
 * Nem todo módulo que lê tile pode ler a TABELA. Quatro de engine — `render/scene-sky`, `render/scene-city`,
 * `platform/audio-ambient` e `platform/audio-nav` — recebem `tileAt` por INJEÇÃO, de propósito: é o que os
 * deixa rodar no project `node` com um mundo de mentira, e é o que os faz não conhecer a numeração DESTE mapa.
 * Importar a tabela neles trocaria um número mágico por uma dependência nova, o que é pior.
 *
 * Eles ficam com as comparações que têm até a decisão do eixo (#64): sob contrato declarado, quem recebe
 * `tileAt` por injeção deve receber TAMBÉM a semântica, e a forma dessa entrega ainda não tem evidência que a
 * escolha. Acrescentar campos de ctx agora seria chutar a forma da pergunta — o erro que o `menu-nav` ensinou
 * a não cometer (`getPhase()` contra `isNavigable()`).
 *
 * Regra prática: importe daqui se o módulo já importa `core/collision`; se ele recebe `tileAt` por ctx, não.
 */

/* ===================== as perguntas, com nome =====================
 * Uma função por propriedade, e não `TILE_TYPES[t]?.hazard` espalhado: o nome é o que torna a intenção legível
 * no ponto de uso (`isHazard(t)` contra `t === 9`) e é o que dá UM lugar para mudar no dia em que a resposta
 * deixar de vir de uma tabela global. Todas devolvem `false` para tipo desconhecido — um tile que ninguém
 * declarou não machuca, não é água e não se escala; inventar semântica para o desconhecido é pior que negá-la.
 */
const prop = (t: number, k: keyof TileType): boolean => !!TILE_TYPES[t]?.[k];
/** Machuca ao encostar (lava). */
export const isHazard = (t: number): boolean => prop(t, 'hazard');
/** Trampolim: arremessa para cima. */
export const isTrampoline = (t: number): boolean => prop(t, 'tramp');

// ⚠️ `ehAgua`, `ehEscada`, `ehPortao` e `ehSecreto` MUDARAM DE CASA EM 2026-09-07 — foram para
// `game/tile-flags.ts` do `game-platformer` (issue #63, etapa B). Tinham zero importadores aqui dentro.
//
// E as duas que ficaram — `isHazard` e `isTrampoline` — ficaram por um motivo MEDIDO, não por simetria: a
// engine lê-as, e não por geometria. O `isSolidType` de `core/collision` torna perigo e trampolim SÓLIDOS
// no modo cadeira de rodas, e perigo sólido no modo cego. É uma regra de ACESSIBILIDADE — a criança em
// cadeira de rodas não cai no fosso — e essa é da engine.
//
//     A engine precisa de saber que um tile é PERIGO; não precisa de saber que ele é ESCADA.
//
// ⚠️ O QUE FICA POR DECIDIR, e está registado na #63: a `TILE_TYPES` acima continua a carregar as bandeiras
// `water`, `ladder`, `gate`, `key` e `secreto`, que **nenhum módulo desta árvore lê**. Enquanto elas aqui
// estiverem, o jogo faz perguntas sobre uma tabela que a engine publica. O fim honesto é a tabela mudar de
// casa e o jogo declarar os papéis pelo `core/contract` (`roleOf`) — que é o mecanismo que já existe para
// isso. Não é execução: é a fronteira seguinte, e ela é decisão do Dev.
// ⚠️ `ehChave` SAIU EM 2026-09-07, pelo mesmo motivo e no mesmo passo que a `JUMP_BASE`: zero consumidores
// em lado nenhum — engine, testes e cartucho. Os outros predicados de tile ficam por enquanto porque o
// `game-platformer` os importa; estes dois não eram fronteira mal cortada, eram peso morto.


export const TILE_COLOR = {
  0:'#0a0a14',1:'#241f38',2:'#6b6480',3:'#2f6fae',4:'#8a5a2b',5:'#34e29b',6:'#3a3a46',
  7:'#7fdcff',8:'#ffd23f',9:'#ff5b3a',10:'#9a8a6f',11:'#ffe06a',12:'#3a86ff',13:'#8a5cff',14:'#ff6fae',
};
