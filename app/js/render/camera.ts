// SPDX-License-Identifier: GPL-3.0-or-later
// render/camera — ONDE A CÂMERA FICA. Item 22 (ADR-0027 passo 7), opção M1: a conta sai de dentro do efeito.
//
// ========================= POR QUE ISTO É UM MÓDULO, E POR QUE SÓ AGORA =========================
// `placeCam` morava dentro de `render/draw.ts`, e o comentário do main.js registrava o motivo com honestidade:
// "placeCam NÃO ganha envólucro: fora do próprio draw ele não tinha chamador nenhum". Era verdade — e deixou
// de ser no dia em que o item 22 pediu uma câmera. O que muda não é o número de chamadores: é que a posição da
// câmera passou a ser uma coisa que se DECIDE (zona-morta? uma por viewport? quem ela segue?), e uma decisão
// enterrada dentro de uma função de 300 linhas de desenho não pode ser discutida nem aferida.
//
// Aqui não há decisão nova nenhuma. As fórmulas são as do `placeCam`, VERBATIM, na mesma ordem — enquadra,
// prende, treme, prende de novo. É de propósito: M1 é o PREFIXO COMUM de todas as alternativas de câmera que
// estão na mesa (extrair · zona-morta · uma por viewport), e nenhuma delas o dispensa. Extrair sem mudar é o
// que torna a extração reversível e o que deixa a escolha inteira nas mãos do Dev.
//
// ========================= O QUE A EXTRAÇÃO TIRA DE CIMA DA MESA =========================
// Duas coisas que `placeCam` sabia e não devia:
//
//  1. `BOX.h / 2` — a metade da CAIXA DE COLISÃO do jogador de plataforma, usada para converter "o y do pé"
//     em "o y do meio do corpo". É conhecimento de gênero: um top-down não ancora no pé, um quiz não tem
//     corpo. Agora quem chama passa o PONTO a enquadrar, e a conversão fica onde o corpo existe.
//  2. `LOGICAL_W`/`LOGICAL_H` — o tamanho da tela lido de uma constante de módulo. O multiplayer já desenha N
//     viewports; no dia em que cada um tiver a sua câmera, o tamanho tem de ENTRAR, não ser lido de fora.
//
// ========================= SEM I/O, SEM PIXI, SEM ALEATÓRIO =========================
// Nenhuma função daqui toca sprite, container ou `Math.random`. O tremor recebe os dois deslocamentos JÁ
// SORTEADOS (`rx`, `ry`), e é isso que o torna testável: a mesma entrada dá a mesma câmera, sempre. Quem
// sorteia é `render/draw`, com o `rnd` compartilhado de core/rng — a semente continua sendo uma só.

/** Um tamanho em pixels de mundo ou de tela. Só isto: a câmera não precisa saber de mais nada. */
export interface Tamanho { w: number; h: number }

/** Onde a câmera está, ANTES de arredondar. O arredondamento é do desenho, não da conta — ver `prender`. */
export interface Camera { camX: number; camY: number }

/**
 * Prende a câmera dentro do mundo.
 *
 * ⚠️ MUNDO MENOR QUE A TELA: `mundo.w - tela.w` fica NEGATIVO, o `min` devolve esse negativo e o `max(0, …)`
 * o zera — a câmera encosta no canto superior esquerdo e sobra vazio à direita e abaixo. É o comportamento
 * que já existia e está preservado de propósito; o mapa de hoje (896×992 contra 320×180) nunca chega lá, mas
 * uma fase pequena chegaria, e é melhor que o caso esteja escrito do que descoberto.
 */
export function prender(cam: Camera, mundo: Tamanho, tela: Tamanho): Camera {
  return {
    camX: Math.max(0, Math.min(cam.camX, mundo.w - tela.w)),
    camY: Math.max(0, Math.min(cam.camY, mundo.h - tela.h)),
  };
}

/** Põe `(alvoX, alvoY)` no CENTRO da tela e prende no mundo. O alvo é um ponto — quem tem corpo o converte. */
export function enquadrar(alvoX: number, alvoY: number, mundo: Tamanho, tela: Tamanho): Camera {
  return prender({ camX: alvoX - tela.w / 2, camY: alvoY - tela.h / 2 }, mundo, tela);
}

/**
 * Aplica o tremor (JUICE) e PRENDE DE NOVO.
 *
 * A segunda prisão não é zelo: sem ela o tremor empurra a câmera para fora do mundo na beirada da fase e a
 * criança vê o vazio atrás do cenário — justamente no momento em que alguma coisa explodiu e ela está olhando.
 *
 * @param amp amplitude em px (0 = sem tremor; `render/fx.shakeAmp`, que decai linearmente)
 * @param rx deslocamento horizontal já sorteado, em [-1, 1]
 * @param ry idem, vertical
 */
export function tremer(cam: Camera, mundo: Tamanho, tela: Tamanho, amp: number, rx: number, ry: number): Camera {
  if (!(amp > 0)) return cam;
  return prender({ camX: cam.camX + rx * amp, camY: cam.camY + ry * amp }, mundo, tela);
}
