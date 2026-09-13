// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * HOW LONG A SOUND CAPTION STAYS ON SCREEN (plan phase 5c; ADR-0164 rule 4).
 *
 * A child's reading rate, not a fixed time: 500 ms a word is 120 words a minute, the low end of the BBC subtitle guidelines'
 * rate for children's programmes (120–140; 160–180 for adults), which the Game Accessibility Guidelines list as a resource.
 * The floor is the 2600 ms the games had measured in play, so a one-word caption keeps its time.
 */
export const MS_POR_PALAVRA = 500;
export const LEGENDA_MINIMA_MS = 2600;

export function duracaoDaLegenda(texto: string): number {
  const palavras = texto.split(/\s+/).filter(Boolean).length;
  return Math.max(LEGENDA_MINIMA_MS, palavras * MS_POR_PALAVRA);
}
