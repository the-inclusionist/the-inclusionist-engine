// SPDX-License-Identifier: GPL-3.0-or-later
// input/latch — SEGURAR VIRA ALTERNAR. Passo 2 do ADR-0027, metade da "entrada como dado".
//
// O QUE É. Quem não consegue MANTER um botão pressionado — espasticidade, tremor, fadiga, um único dedo, um
// switch de sopro — não perde o jogo: um TOQUE trava a direção, e o personagem segue andando sozinho. Tocar de
// novo no mesmo sentido para; tocar no sentido oposto inverte. Segurar, para quem consegue, acelera.
//
// POR QUE SAIU DA FÍSICA. A política morava dentro de `game/physics.ts`, no meio do cálculo do movimento
// horizontal. Três consequências, todas ruins:
//   1. Uma decisão de ENTRADA estava escrita como se fosse uma regra do jogo, num arquivo que ninguém abre
//      para mexer em acessibilidade motora.
//   2. Só o movimento horizontal tinha caminho de alternância. Pulo, corrida e troca de poder não têm — e não
//      por decisão, por acidente de onde o código foi parar. Este módulo é onde essa lacuna se fecha quando
//      for fechada; NÃO a fecho agora, porque cada ação precisa da sua própria resposta de desenho (o que
//      significa "pulo travado"?) e inventar isso sem o Dev seria pior que a lacuna.
//   3. A engine não podia oferecer a alternância a OUTRO jogo sem levar a física do plataforma junto.
//
// DE QUE LADO DA LINHA ISTO CAI. O ADR-0027 separa PRESENTAÇÃO (como o estado vira pixel e som), OPERAÇÃO
// (como a intenção vira entrada) e REGRA (o que é alcançável). O critério objetivo: uma adaptação cruza a
// linha quando altera o CONJUNTO DE ESTADOS ALCANÇÁVEIS ou a PROBABILIDADE de alcançá-los. A alternância não
// altera nem um nem outro — o jogador chega exatamente aos mesmos lugares, gastando menos motricidade. É
// OPERAÇÃO, e por isso a engine a oferece e o jogo não pode recusar. (O modo Fácil, no mesmo botão hoje, é
// REGRA: hitbox de +4px, proteção de beirada e gravidade 2/3 mudam o que é alcançável. Não estão aqui.)
//
// PURO DE PROPÓSITO: sem `document`, sem PIXI, sem `TUNE`. Recebe números e devolve números, roda no project
// `node` do Vitest, e não sabe que existe um plataforma do outro lado.

/** Sentido travado: -1 esquerda, 0 parado, 1 direita. */
export type LatchDir = -1 | 0 | 1;

/** Fração da velocidade de caminhada quando o jogador SEGURA o botão no sentido travado. */
export const LATCH_HELD = 2 / 3;
/** Fração quando a direção está travada mas nenhum botão está pressionado — o "andar sozinho". */
export const LATCH_IDLE = 1 / 3;

/**
 * O próximo sentido travado, dado o atual e as bordas de toque deste quadro.
 *
 * Um toque no sentido em que já se anda PARA (é o mesmo botão que liga e desliga — não há botão de parar, e
 * inventar um custaria a quem tem um dedo só o dobro de alcances). Um toque no sentido oposto inverte
 * direto, sem passar pelo zero: quem toca "esquerda" andando para a direita quer ir para a esquerda, não
 * quer parar e tocar de novo.
 *
 * As duas bordas no MESMO quadro são possíveis (dois dedos, ou um switch duplo mal calibrado) e a ordem
 * importa: esquerda é avaliada primeiro e direita depois, então direita vence. É o comportamento que a
 * física sempre teve — duas linhas `if` em sequência —, preservado aqui de propósito e agora com um teste que
 * o fixa, em vez de ser um efeito não intencional da ordem em que alguém escreveu dois `if`.
 */
export function nextLatchedDir(current: LatchDir, leftEdge: boolean, rightEdge: boolean): LatchDir {
  let dir = current;
  if (leftEdge) dir = dir === -1 ? 0 : -1;
  if (rightEdge) dir = dir === 1 ? 0 : 1;
  return dir;
}

/**
 * O multiplicador da velocidade de caminhada, COM sinal: o sentido travado vezes a fração que corresponde a
 * estar ou não segurando o botão daquele sentido.
 *
 * Devolve o produto (e não só a fração) porque parado é 0 e nenhuma fração precisa opinar sobre isso —
 * exatamente como a física fazia ao multiplicar por `dir`. Quem chama multiplica por `TUNE.hWalk`; a
 * constante de ajuste do jogo não entra neste módulo.
 */
export function latchedDrive(dir: LatchDir, holdingLeft: boolean, holdingRight: boolean): number {
  const holding = (dir === -1 && holdingLeft) || (dir === 1 && holdingRight);
  return dir * (holding ? LATCH_HELD : LATCH_IDLE);
}
