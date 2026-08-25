// SPDX-License-Identifier: AGPL-3.0-or-later
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

/* ===================== M2 · A CÂMERA COMO OBJETO ===================== */
//
// ========================= POR QUE UM OBJETO, SE AS FUNÇÕES JÁ BASTAVAM =========================
// Bastavam para o que a câmera fazia até aqui: centrar no jogador, todo quadro, do zero. Uma função pura serve
// bem a isso porque não há nada para lembrar — a posição de agora não depende da de antes.
//
// ZONA-MORTA quebra essa propriedade, e é a razão do objeto. "A câmera só se move quando o alvo sai de um
// retângulo no meio da tela" é uma frase sobre ONDE A CÂMERA ESTAVA. Sem memória entre quadros ela não tem
// como ser respondida, e enfiar essa memória em `render/draw` seria devolver ao desenho a decisão que o M1
// tirou de lá.
//
// ========================= AGNÓSTICO DE GÊNERO, DE VERDADE =========================
// Nada aqui sabe de tile, de corpo, de `facing` ou de física. O alvo é um PONTO e a zona é um retângulo em
// pixels de tela. Um top-down segue o mesmo ponto; um jogo de lista não chama `seguir` nenhuma vez. Foi essa
// a condição do M2 no ADR-0030, e é o que separa uma câmera de engine de uma câmera de plataformer.
//
// ========================= O TREMOR NÃO É GUARDADO, E ISSO É A METADE DO DESENHO =========================
// `quadro()` devolve base + tremor e NÃO escreve na base. Se escrevesse, o deslocamento do quadro anterior
// viraria o ponto de partida do próximo e a câmera derivaria sozinha enquanto durasse o tremor — um defeito
// que não aparece num quadro isolado e some quando se vai procurar. A base só muda em `seguir` e `pular`.

/** A zona-morta, em pixels de TELA. `{w:0,h:0}` = sem zona: a câmera cola no alvo, que é o de hoje. */
export interface ZonaMorta { readonly w: number; readonly h: number }

export interface CameraObj {
  /** Onde a câmera está, sem tremor, pré-arredondamento. */
  readonly base: Camera;
  /** Segue o alvo respeitando a zona-morta e prende no mundo. Devolve a base nova. */
  seguir(alvoX: number, alvoY: number): Camera;
  /** Centra no alvo AGORA, ignorando a zona-morta: nascimento, renascimento, troca de fase. */
  pular(alvoX: number, alvoY: number): Camera;
  /** Base + tremor, preso no mundo. NÃO altera a base — ver o cabeçalho. */
  quadro(amp: number, rx: number, ry: number): Camera;
  /** Mundo e/ou tela mudaram (fase nova, viewport dividido). Reprende a base no que passou a valer. */
  redimensionar(mundo?: Tamanho, tela?: Tamanho): Camera;
}

/**
 * Cria uma câmera com alvo, zona-morta, prisão no mundo e tremor.
 *
 * ⚠️ ZONA ZERO É O COMPORTAMENTO DE HOJE, e não por coincidência: com `w = h = 0` a correção de `seguir` vira
 * `alvo - tela/2`, que é `enquadrar` letra por letra. É o que permite trocar o `placeCam` por esta câmera sem
 * mudar um pixel do que a criança vê, e escolher um valor de zona depois, como decisão separada.
 */
export function criarCamera(mundo: Tamanho, tela: Tamanho, zona: ZonaMorta = { w: 0, h: 0 }): CameraObj {
  let m = mundo, t = tela;
  let base: Camera = { camX: 0, camY: 0 };

  /** Quanto a câmera precisa andar num eixo para o alvo voltar para dentro da zona. Zero se já está dentro. */
  const correcao = (alvo: number, cam: number, telaLado: number, zonaLado: number): number => {
    const meia = Math.max(0, zonaLado) / 2;
    const d = alvo - (cam + telaLado / 2); // distância do alvo ao CENTRO da tela
    if (Math.abs(d) <= meia) return 0;
    return d - Math.sign(d) * meia; // anda o mínimo: o alvo pousa na BORDA da zona, não no centro
  };

  return {
    get base() { return base; },

    seguir(alvoX, alvoY) {
      base = prender({
        camX: base.camX + correcao(alvoX, base.camX, t.w, zona.w),
        camY: base.camY + correcao(alvoY, base.camY, t.h, zona.h),
      }, m, t);
      return base;
    },

    pular(alvoX, alvoY) {
      base = enquadrar(alvoX, alvoY, m, t);
      return base;
    },

    quadro(amp, rx, ry) {
      return tremer(base, m, t, amp, rx, ry);
    },

    redimensionar(novoMundo, novaTela) {
      if (novoMundo) m = novoMundo;
      if (novaTela) t = novaTela;
      base = prender(base, m, t);
      return base;
    },
  };
}
