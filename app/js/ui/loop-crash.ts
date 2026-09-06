// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/loop-crash.ts — O ANÚNCIO DE QUE O LAÇO PAROU. A outra metade do ADR-0054.
//
// `core/loop.startLoop` já PARA quando um quadro lança, e já chama `aoFalhar`. O que faltava era alguém que
// passasse um `aoFalhar` — e a `confirmation` do ADR-0054 diz isso por escrito: *"a raiz de composição ainda
// não liga o `aoFalhar`, então hoje o laço para em silêncio... enquanto isto não existir este registro é só
// metade verdadeiro."*
//
// ⚠️ E A METADE QUE FALTAVA É A QUE IMPORTA. Tela congelada é sintoma VISUAL. No modo cego, um jogo parado e
// um jogo pensando produzem a mesma coisa: silêncio. A criança fica a esperar por um jogo que já morreu, sem
// nada que lhe diga para recarregar — e o único aviso que existia era um erro no console, que ela não lê.
//
// ⚠️ POR QUE UM MÓDULO E NÃO UMA LINHA DENTRO DE `createGame`. Porque o jogo de plataforma NÃO PASSA POR
// `createGame` — `main.ts` monta a engine à mão, e é ele quem chama `startLoop`. Uma solução que vivesse só
// na raiz de composição da engine deixaria de fora exatamente o jogo que existe. As duas raízes importam
// daqui.
//
// ⚠️ E NÃO USA `srAlert` DE `core/a11y-sr`, o que é uma escolha e não um esquecimento:
//
//   · `srAlert` limpa, espera um `requestAnimationFrame` e só então escreve. Essa dança existe para forçar o
//     leitor a REANUNCIAR texto repetido; uma queda é anunciada uma vez e nunca se repete, então não compra
//     nada aqui — e faz o aviso depender de um quadro futuro, no instante em que os quadros pararam.
//   · `srAlert` busca no documento GLOBAL. Quem recebe o documento por injeção (a engine, um teste, um
//     segundo jogo na mesma página) perderia o aviso. O anúncio de que tudo parou é o último lugar que
//     deveria depender de uma busca global.
import { t } from '../core/i18n.js';

export interface AvisoDeQuedaCtx {
  /** `querySelector` do documento deste jogo. Injetado: a engine recebe o dela, `main.ts` passa o `$` global. */
  procurar: (sel: string) => HTMLElement | null;
  /** A narração falada, quando o jogo tiver uma. Ausente = o aviso escrito basta. */
  narrar?: (texto: string) => void;
}

/**
 * Monta o `aoFalhar` para entrar em `startLoop(ticker, quadro, maxDt, { aoFalhar })`.
 *
 * A ORDEM DOS CANAIS É DELIBERADA e vale escrever: o console PRIMEIRO, porque quem depura não pode perder o
 * erro se o DOM estiver quebrado — e um DOM quebrado é um dos motivos plausíveis para o quadro ter lançado.
 * Depois o leitor de tela, que é quem não tem outra pista nenhuma. O visível por último, porque quem o vê já
 * viu a tela parar.
 *
 * Cada canal é isolado do seguinte: se a narração lançar, o aviso escrito já saiu. Um aviso que falha pela
 * metade tem de entregar a outra metade — é a mesma regra que o `startLoop` aplica a este próprio callback.
 */
export function criarAvisoDeQueda(ctx: AvisoDeQuedaCtx): (erro: unknown) => void {
  return (erro: unknown): void => {
    try { console.error('[inclusionist] the frame threw; the loop stopped.', erro); } catch { /* noop */ }

    const msg = t('sr.laco.parou');

    // O leitor de tela: assertivo, porque interromper é justamente o ponto.
    const alerta = ctx.procurar('#sr-alert');
    if (alerta) alerta.textContent = msg;

    try { ctx.narrar?.(msg); } catch { /* noop: a narração falhou; o aviso escrito já saiu */ }

    // O VISÍVEL. O texto entra no ATRIBUTO e a folha de estilo o mostra com `content: attr(...)` — é o que
    // mantém a frase LOCALIZADA. Um aviso cravado no CSS estaria em inglês para uma criança brasileira, que
    // é o defeito que o pilar 3 existe para impedir.
    const regiao = ctx.procurar('#game-region');
    if (regiao) regiao.setAttribute('data-incl-parou', msg);
  };
}
