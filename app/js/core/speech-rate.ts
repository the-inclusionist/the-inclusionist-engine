// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * THE SPEECH RATE (ADR-0183 §1, ADR-0196; issue #179): the child's words per minute, 254 to 504 by 50 — «velocidade normal é a
 * mínima» (the Dev): no voice is played slower than it speaks — mapped onto each engine by MEASURING
 * the voice rather than assuming it — the record: «the mapping needs each voice's words per minute at rate 1, measured, not
 * assumed.» Measured in the lab on 2026-09-14, a neural voice spoke 255 words per minute of speech; another voice or
 * sentence differs, so every synthesised utterance is measured (its words over its speech time) and played at the ratio.
 *
 * Pure: no I/O, no audio — the engine hands in the samples it synthesised.
 */
export const RITMOS_DA_FALA = [254, 304, 354, 404, 454, 504] as const;
export type RitmoDaFala = (typeof RITMOS_DA_FALA)[number];

/** The playback-rate bounds: never under the voice's own speed (ADR-0196), and a measurement error never garbles it. */
export const TAXA_MINIMA = 1;
export const TAXA_MAXIMA = 3;

/** Below this an utterance is too short to measure («Voltar»): its silent ends and one stressed syllable dominate. */
const PALAVRAS_PARA_MEDIR = 3;
const SEGUNDOS_PARA_MEDIR = 0.8;

/** A stored or passed rate that is not a step — the old 150…500 by 35 among them — reads as the normal speed, the first step. */
export function ritmoDaFalaValido(ppm: number): RitmoDaFala {
  return (RITMOS_DA_FALA as readonly number[]).includes(ppm) ? (ppm as RitmoDaFala) : RITMOS_DA_FALA[0];
}

/** The words a voice says: tokens holding a letter; a dash, a number or a sign alone is not counted. */
export function palavrasFaladas(texto: string): number {
  return texto.split(/\s+/).filter((w) => /\p{L}/u.test(w)).length;
}

/** Seconds from the first to the last sample above the silence threshold — the pauses inside stay, the silent ends go. */
export function segundosDeFala(amostras: ArrayLike<number>, taxa: number, limiar = 0.01): number {
  let a = 0, b = amostras.length - 1;
  while (a <= b && Math.abs(amostras[a]!) < limiar) a++;
  while (b >= a && Math.abs(amostras[b]!) < limiar) b--;
  return b >= a ? (b - a + 1) / taxa : 0;
}

/**
 * The rate to play an utterance at, and the voice's words per minute measured on it (`null` when it was too short to measure).
 * Too short, it takes the voice's running average; with none yet, it plays as synthesised.
 */
export function taxaDaFala(
  palavras: number,
  segundos: number,
  ppm: number,
  mediaDaVoz: number | null,
): { readonly taxa: number; readonly ppmDaVoz: number | null } {
  const alvo = ritmoDaFalaValido(ppm);
  const prender = (x: number): number => Math.min(TAXA_MAXIMA, Math.max(TAXA_MINIMA, +x.toFixed(6)));
  if (palavras >= PALAVRAS_PARA_MEDIR && segundos >= SEGUNDOS_PARA_MEDIR) {
    const ppmDaVoz = (palavras / segundos) * 60;
    return { taxa: prender(alvo / ppmDaVoz), ppmDaVoz };
  }
  return { taxa: mediaDaVoz ? prender(alvo / mediaDaVoz) : 1, ppmDaVoz: null };
}
