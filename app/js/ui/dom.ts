// SPDX-License-Identifier: GPL-3.0-or-later
// ui/dom.ts — atalhos de seleção do DOM, usados em toda a UI (menus/HUD/pausa/quiz/opções). PURO no import:
// só define as funções (não toca no DOM → importável em node). $ = querySelector; $$ = querySelectorAll
// como Array. Genéricos: $<HTMLInputElement>('#x') já tipa o retorno. (Fase 2.27 / Tier 1)
//
// DEIXOU DE SER FOLHA no item 14, e de propósito: passou a importar `core/i18n` para que `toggleLabel` (o
// texto do botão de alternância) more ao lado do `toggleBtn` (a classe e o `aria-pressed`). A propriedade que
// importa — importável em node, sem I/O no import — continua valendo; o que se perdeu foi a contagem de zero
// dependências, e o que se ganhou está escrito no comentário de `toggleLabel`.
import { t } from '../core/i18n.js';

export const $ = <T extends Element = Element>(s: string): T | null => document.querySelector<T>(s);
export const $$ = <T extends Element = Element>(s: string): T[] => [...document.querySelectorAll<T>(s)];

/**
 * Reflects an on/off state onto a toggle button: the visual class AND `aria-pressed`.
 * Lives here because the two must never drift apart — a button that looks pressed but does not
 * say so is invisible to a screen reader, which is a pillar violation, not a style slip.
 */
export function toggleBtn(b: Element | null, on: boolean): void {
  if (!b) return;
  b.classList.toggle('is-on', on);
  b.setAttribute('aria-pressed', String(on));
}

/**
 * O TEXTO do botão de alternância: '❚❚ Ligado' / '▶ Desligado'.
 *
 * Mora aqui pelo mesmo motivo do `toggleBtn` logo acima — os dois são as duas metades do mesmo gesto, e a
 * nota daquela função diz que elas "não podem se separar". Elas tinham se separado em TREZE cópias, em nove
 * arquivos, e dois deles declaravam um helper que se chamava compartilhado e servia um chamador só
 * (`settings-empathy.toggleLabel` e `settings-motor.onOffLabel`, ambos apagados agora).
 *
 * O custo dessa dispersão não era estético: com o texto em treze lugares, traduzir o jogo exigiria achar os
 * treze, e esquecer um deixaria um botão em português no meio do inglês — sem erro, sem teste vermelho.
 */
export function toggleLabel(on: boolean): string {
  return t(on ? 'ui.toggle.on' : 'ui.toggle.off');
}

/** O `aria-label` da mesma alternância: '{alvo}: ligado'. Separado do rótulo visível porque o leitor de tela
 *  precisa do NOME do alvo junto, e a tela não (o nome já está na linha ao lado do botão). */
export function toggleAria(alvo: string, on: boolean): string {
  return t(on ? 'ui.toggle.ariaOn' : 'ui.toggle.ariaOff', { alvo });
}
