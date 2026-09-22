// SPDX-License-Identifier: AGPL-3.0-or-later
// input/pointer-space.ts — O ÚNICO LUGAR QUE CONVERTE UM PONTO DE TELA. Módulo-folha: só aritmética.
//
// ========================= O QUE A MEDIÇÃO DA ISSUE #105 ENCONTROU =========================
// A issue manda LER antes de escrever — *"estabeleça quanto de um ponteiro já existe dentro de
// `input/touch.ts`; se a resposta for «quase tudo», isto vira uma extração e não um subsistema novo"*. A
// resposta medida é mais interessante do que «quase tudo» ou «quase nada»:
//
//   · A CAPTURA já existe INTEIRA, em `touch-bindings.wirePointerPad`: `pointerdown`/`move`/`up`/`cancel`,
//     `setPointerCapture` com recuo gracioso, `lostpointercapture` como rede, `contextmenu` suprimido, e um
//     ponteiro de cada vez. Nada disso precisa de ser escrito outra vez.
//   · O PONTO, ao contrário, é RECEBIDO E DEITADO FORA — e em quatro lugares, com duas convenções:
//       `crossDirsAt`, `stickDirsAt` e `stickKnobOffset` reduzem-no a `dx,dy` do CENTRO e devolvem direções;
//       o `ui/webcam.onGaze` de então reduzia o olhar a uma FRAÇÃO do elemento e a três limiares (saiu: ADR-0214).
//
// ⚠️ E É O MESMO DEFEITO NOS DOIS SÍTIOS: uma posição contínua chega, é comprimida em «esquerda/direita/cima»
// antes de qualquer outro consumidor a ver, e não sobra nada para quem precisasse dela. O ponteiro não é
// fundação nova — é a fundação que o OLHAR já precisava e nunca teve.
//
// ⚠️ E O QUE NÃO EXISTE EM LADO NENHUM: hover (posição sem aperto), botões (`PointerLike` não tem `button`),
// roda (zero ocorrências) e — o que a `definition of done` da #105 pede em primeiro lugar — UM lugar que
// converta tela→jogo. Este ficheiro é esse lugar; o resto continua aberto na issue.

/** Retângulo do elemento (o que `getBoundingClientRect()` entrega, reduzido ao que a conta usa). */
export interface RectLike { left: number; top: number; width: number; height: number }

/** Um ponto em px, relativo ao CENTRO do elemento. É a forma que um direcional lê. */
export interface FromCentre { dx: number; dy: number }

/** Um ponto em FRAÇÃO do elemento: `0,0` é o canto superior esquerdo e `1,1` o inferior direito. */
export interface AsFraction { fx: number; fy: number }

/**
 * O ponto relativo ao CENTRO, em px do elemento.
 *
 * As três funções de direcional de `touch-bindings` abriam com estas mesmas duas linhas. Repetição de duas
 * linhas não costuma pagar uma extração — esta paga por outra razão: enquanto a conta do centro estava
 * escrita dentro de cada uma, não havia como um consumidor NOVO (um ponteiro, um olhar) obter o ponto sem
 * passar por uma função que já o transformou em direções.
 */
export function fromCentre(px: number, py: number, rect: RectLike): FromCentre {
  return { dx: px - (rect.left + rect.width / 2), dy: py - (rect.top + rect.height / 2) };
}

/**
 * O ponto como FRAÇÃO do elemento.
 *
 * ⚠️ NÃO SATURA EM 0..1 de propósito. Um ponteiro capturado sai do elemento e continua a valer — é isso que
 * `setPointerCapture` existe para permitir, e saturar aqui apagaria a diferença entre «na borda» e «muito
 * para lá da borda», que é justamente o que um arrasto precisa de saber. Quem quiser saturar, satura; quem
 * saturasse aqui não teria como voltar atrás.
 *
 * ⚠️ E LARGURA ZERO DEVOLVE ZERO em vez de `Infinity`. Um elemento ainda não medido (display:none, primeiro
 * quadro) dá `width: 0`, e um `NaN`/`Infinity` a partir daqui viajaria para dentro da física antes de alguém
 * o ver. O `onGaze` já se protegia disso com um `if (!r.width) return`; a proteção passa a ser da conta.
 */
export function asFraction(px: number, py: number, rect: RectLike): AsFraction {
  return {
    fx: rect.width ? (px - rect.left) / rect.width : 0,
    fy: rect.height ? (py - rect.top) / rect.height : 0,
  };
}
