// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * HOW LONG A SOUND CAPTION STAYS ON SCREEN (plan phase 5c; ADR-0164 rule 4; ADR-0183 §4).
 *
 * The child's reading rate, not a fixed time: the Dev's three — «125 WPM (leitor iniciante), 145WPM (confortável na década de
 * 90 segundo pesquisa), 175WPM (confortável hoje segundo pesquisa)». 145 is Jensema's measured comfortable rate (1998); 125 sits
 * between Burnham's 120 for children and the DCMP's 130; 175 is the Dev's choice, not a measured comfort (ADR-0183).
 * The floor is the 2600 ms the games had measured in play, so a one-word caption keeps its time.
 */
export const RITMOS_DA_LEGENDA = [125, 145, 175] as const;
export type RitmoDaLegenda = (typeof RITMOS_DA_LEGENDA)[number];
export const LEGENDA_MINIMA_MS = 2600;

/** A stored or passed rate that is not one of the three reads as the slowest: a typo must never make a caption flash by. */
export function ritmoDaLegendaValido(ppm: number): RitmoDaLegenda {
  return (RITMOS_DA_LEGENDA as readonly number[]).includes(ppm) ? (ppm as RitmoDaLegenda) : RITMOS_DA_LEGENDA[0];
}

export function duracaoDaLegenda(texto: string, ppm: number): number {
  const palavras = texto.split(/\s+/).filter(Boolean).length;
  return Math.max(LEGENDA_MINIMA_MS, Math.round((palavras * 60_000) / ritmoDaLegendaValido(ppm)));
}
