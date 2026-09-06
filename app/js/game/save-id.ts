// SPDX-License-Identifier: AGPL-3.0-or-later
// game/save-id.ts — o id deste jogo dentro do catálogo. Módulo-folha, uma linha, e sem importar nada.
//
// Ele estava em `platform/storage.ts` como `JOGO_ID = 'inclusionist'`, e era um dos quatro achados do
// ADR-0080: coisa que varia de jogo para jogo, guardada pela engine. O teste que o denuncia é uma pergunta —
// *um segundo jogo quereria um valor diferente aqui?* — e a resposta custava progresso real: dois jogos no
// mesmo perfil de navegador escreviam em `incl.inclusionist.activity` os dois, e um apagava o outro.
//
// ⚠️ POR QUE UM MÓDULO SÓ PARA UMA CONSTANTE, e não um campo da declaração. `game/state` lê o armazenamento
// no IMPORT — o nível, o cenário e a atividade nascem já restaurados —, e o import corre antes de qualquer
// `createGame()`. Um id vindo da declaração chegaria tarde, e as três chaves teriam sido resolvidas contra
// vazio sem nada ficar vermelho. Uma constante do próprio jogo está disponível no instante em que qualquer
// módulo dele é avaliado, que é a única garantia que serve aqui.
//
// ⚠️ E É FOLHA DE PROPÓSITO: `state` e `attract` importam daqui, e daqui não se importa nada. Um ciclo entre
// o id e o estado que ele nomeia seria resolvido pelo empacotador com um `undefined` a meio do caminho.
//
// Quando o cartucho sair para `game-platformer` (issue #111), esta linha sai com ele — que é exatamente o
// sentido de ela existir.

/** Id deste jogo. Prefixa tudo que pertence a ESTA partida (`incl.<jogo>.<nome>`); nada do que pertence à
 *  criança passa por aqui. */
export const JOGO = 'inclusionist';
