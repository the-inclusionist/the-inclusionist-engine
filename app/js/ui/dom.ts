// SPDX-License-Identifier: GPL-3.0-or-later
// ui/dom.ts — atalhos de seleção do DOM, usados em toda a UI (menus/HUD/pausa/quiz/opções). Módulo-folha PURO:
// só define as funções (não toca no DOM no import → importável em node). $ = querySelector; $$ = querySelectorAll
// como Array. Genéricos: $<HTMLInputElement>('#x') já tipa o retorno. (Fase 2.27 / Tier 1)
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
