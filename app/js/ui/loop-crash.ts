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

/** O id da caixa do aviso. Estável porque a folha de estilo e o teste a procuram. */
const CRASH_NOTICE_ID = 'incl-parou';

export interface CrashNoticeCtx {
  /** `querySelector` do documento deste jogo. Injetado: a engine recebe o dela, `main.ts` passa o `$` global. */
  find: (sel: string) => HTMLElement | null;
  /** `document.createElement` — a caixa do aviso é um elemento de verdade, não um pseudo-elemento. */
  create: (tag: string) => HTMLElement;
  /** A narração falada, quando o jogo tiver uma. Ausente = o aviso escrito basta. */
  narrate?: (texto: string) => void;
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
export function createCrashNotice(ctx: CrashNoticeCtx): (erro: unknown) => void {
  return (erro: unknown): void => {
    try { console.error('[inclusionist] the frame threw; the loop stopped.', erro); } catch { /* noop */ }

    const msg = t('sr.laco.parou');

    // O leitor de tela: assertivo, porque interromper é justamente o ponto.
    const alert = ctx.find('#sr-alert');
    if (alert) alert.textContent = msg;

    try { ctx.narrate?.(msg); } catch { /* noop: a narração falhou; o aviso escrito já saiu */ }

    // O VISÍVEL, e é um ELEMENTO DE VERDADE — não um pseudo-elemento.
    //
    // ⚠️ ERA `::after` COM `content: attr(data-incl-parou)`, E NUNCA TERIA APARECIDO. Medido no arranque real
    // em 2026-09-06: `.game-region.crt-scan-1::after` é o efeito de scanline do CRT, ligado por padrão, e um
    // elemento tem UM `::after` só — as duas regras não se empilham, a do CRT vem depois e vence. O
    // `::before` está igualmente tomado, pela vinheta. O aviso disputava um lugar já ocupado.
    //
    // ⚠️ E O PSEUDO-ELEMENTO ERA ERRADO POR UMA SEGUNDA RAZÃO, que a primeira escondia: texto de `content`
    // não entra de forma confiável na árvore de acessibilidade. O aviso de que o jogo morreu é exatamente o
    // que não pode depender disso.
    //
    // O raciocínio que continua de pé é o da TRADUÇÃO: a frase vem de `t()` e entra por `textContent`, então
    // ela chega traduzida e escapada. O que muda é o recipiente.
    const region = ctx.find('#game-region');
    if (!region) return;
    const anterior = ctx.find('#' + CRASH_NOTICE_ID);
    const caixa = anterior ?? ctx.create('div');
    caixa.id = CRASH_NOTICE_ID;
    caixa.setAttribute('role', 'alert');
    caixa.textContent = msg;
    if (!anterior) region.appendChild(caixa);
  };
}
