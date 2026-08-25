// SPDX-License-Identifier: AGPL-3.0-or-later
// game/braille — the Braille cell per letter (dot numbers 1..6) + speaking those dots in pt-BR, for the
// "escritor cego" literacy activity. Pure data + one pure helper (verbatim from game.js).
// See docs/5-Refactoring/plano-modularizacao-mapa.md (Estágio 4, game/quiz — braille).

/** Braille dot numbers (1..6) for each lowercase letter. */
export const BRAILLE: Record<string, number[]> = {
  a: [1], b: [1, 2], c: [1, 4], d: [1, 4, 5], e: [1, 5], f: [1, 2, 4], g: [1, 2, 4, 5], h: [1, 2, 5], i: [2, 4], j: [2, 4, 5],
  k: [1, 3], l: [1, 2, 3], m: [1, 3, 4], n: [1, 3, 4, 5], o: [1, 3, 5], p: [1, 2, 3, 4], q: [1, 2, 3, 4, 5], r: [1, 2, 3, 5], s: [2, 3, 4], t: [2, 3, 4, 5],
  u: [1, 3, 6], v: [1, 2, 3, 6], w: [2, 4, 5, 6], x: [1, 3, 4, 6], y: [1, 3, 4, 5, 6], z: [1, 3, 5, 6],
};

const NUMW: Record<number, string> = { 1: 'um', 2: 'dois', 3: 'três', 4: 'quatro', 5: 'cinco', 6: 'seis' };

/** Speak a letter's Braille cell as its dot numbers ("a" → "um", "b" → "um dois"); unknown → ''. */
export const brailleText = (ch: string): string => {
  const d = BRAILLE[String(ch).toLowerCase()];
  return d ? d.map((n) => NUMW[n] ?? '').join(' ') : '';
};
