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



/* ===================== O QUE UM TILE É NÃO MORA AQUI =====================
 *
 * 🔴 A `TILE_TYPES`, o `TileType`, o `isHazard` e o `isTrampoline` SAÍRAM EM 2026-09-23, para o
 * `game-platformer` (ADR-0228, issue #63). O fim estava escrito neste ficheiro desde 07/09 — «o fim honesto é
 * a tabela mudar de casa e o jogo declarar os papéis pelo `core/contract`» — e o que a segurava era UMA regra:
 * o `isSolidType` de `core/collision`, que torna perigo e trampolim sólidos no modo cadeira de rodas e perigo
 * sólido no modo cego. Essa regra foi com a geometria que a consulta, e a tabela ficou sem leitor nenhum aqui.
 *
 * 📌 A ENGINE NÃO DEIXOU DE SABER O QUE É PERIGO: ela pergunta ao CONTRATO, pelo `roleOf`. O que ela deixou de
 * ter é uma tabela de NÚMEROS de tile, que só é verdade num mapa — `t === 9` num segundo jogo com outra
 * numeração herdaria física, alto contraste e sonar a apontar para o tile errado, sem erro e sem vermelho.
 *
 * ⚠️ `ehAgua`, `ehEscada`, `ehPortao` e `ehSecreto` tinham saído em 07/09 pelo mesmo caminho, e `ehChave` no
 * mesmo passo por não ter consumidor nenhum. Esta é a última leva.
 */


