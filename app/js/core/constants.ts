// SPDX-License-Identifier: GPL-3.0-or-later
// Constantes puras (imutáveis) do jogo — módulo-folha, ZERO deps. TypeScript (Estágio 3): tipos inferidos dos literais.
// TUNE é objeto mutável (o painel de debug ajusta propriedades), mas NUNCA reatribuído → o import const
// funciona (mutar propriedade é ok; reatribuir é que quebraria). Ver docs/plano-modularizacao.md.

export const LOGICAL_W = 320, LOGICAL_H = 180, TILE = 16;
export const COIN_TARGET = 10;
export const TUNE = {
  jumpVel: 3.5, waterJump: 3.5, waterJumpRun: 4, waterStrokeFrames: 30,
  trampBase: 5, trampMax: 8, gravity: 0.15, hWalk: 2, hRun: 3, climbSpeed: 1.5,
  maxFall: 7, waterMaxFall: 3, hTurbo: 4.5, ultraJumpVel: 10, // E12: power-ups (valores do José)
};
export const JUMP_BASE = TUNE.jumpVel * Math.sqrt(8 / 5); // ~4.43 (altura confortável)

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
/* ===================== as perguntas, com nome =====================
 * Uma função por propriedade, e não `TILE_TYPES[t]?.hazard` espalhado: o nome é o que torna a intenção legível
 * no ponto de uso (`ehPerigo(t)` contra `t === 9`) e é o que dá UM lugar para mudar no dia em que a resposta
 * deixar de vir de uma tabela global. Todas devolvem `false` para tipo desconhecido — um tile que ninguém
 * declarou não machuca, não é água e não se escala; inventar semântica para o desconhecido é pior que negá-la.
 */
const prop = (t: number, k: keyof TileType): boolean => !!TILE_TYPES[t]?.[k];
/** Machuca ao encostar (lava). */
export const ehPerigo = (t: number): boolean => prop(t, 'hazard');
/** Água: nada-se dentro, e o pulo funciona lá. */
export const ehAgua = (t: number): boolean => prop(t, 'water');
/** Escada: sobe e desce. */
export const ehEscada = (t: number): boolean => prop(t, 'ladder');
/** Trampolim: arremessa para cima. */
export const ehTrampolim = (t: number): boolean => prop(t, 'tramp');
/** Portão: barra até a chave abrir. */
export const ehPortao = (t: number): boolean => prop(t, 'gate');
/** A chave que abre o portão. */
export const ehChave = (t: number): boolean => prop(t, 'key');
/** Ar de região secreta: o que a escuridão cobre até alguém entrar. */
export const ehSecreto = (t: number): boolean => prop(t, 'secreto');

export const TILE_COLOR = {
  0:'#0a0a14',1:'#241f38',2:'#6b6480',3:'#2f6fae',4:'#8a5a2b',5:'#34e29b',6:'#3a3a46',
  7:'#7fdcff',8:'#ffd23f',9:'#ff5b3a',10:'#9a8a6f',11:'#ffe06a',12:'#3a86ff',13:'#8a5cff',14:'#ff6fae',
};
