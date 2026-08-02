// SPDX-License-Identifier: GPL-3.0-or-later
// game/literacy-distractors — letter names + the pre-syllabic distractor generator for the literacy
// activities (Estágio 4). `ferreiroDistractors` builds plausible wrong answers that attack the common
// pre-syllabic hypotheses (Ferreiro & Teberosky): (a) a symbol/emoji → refutes the ICONIC hypothesis;
// (b) 4–8 repeated letters → lack of internal VARIETY; (c) emoji in the middle; (d) too few/too many
// letters per syllable → refutes SIZE=object. Pure (rng injected via core/rng). Domain content (pt-BR).
// See docs/5-Refactoring/plano-modularizacao-mapa.md.

import { rnd, randInt } from '../core/rng.js';

/** Spoken name of each letter (pt-BR). */
export const LETTER_NAME: Record<string, string> = {
  a: 'á', b: 'bê', c: 'cê', d: 'dê', e: 'é', f: 'éfe', g: 'gê', h: 'agá', i: 'i', j: 'jota', k: 'cá', l: 'éle', m: 'ême',
  n: 'êne', o: 'ó', p: 'pê', q: 'quê', r: 'érre', s: 'ésse', t: 'tê', u: 'u', v: 'vê', w: 'dáblio', x: 'xis', y: 'ípsilon', z: 'zê',
};

/** Spell a word out by letter names ("gato" → "gê, á, tê, ó"). */
export const soletra = (w: string): string =>
  String(w).split('').map((c) => LETTER_NAME[c] || c).join(', ');

const _FER_SYM = ['★', '◆', '#', '@', '%', '&', '✦', '◇', '■', '●'];
const _FER_EMO = ['🐱', '🍎', '🌟', '🚗', '🐶', '🎈', '🐸', '🍌', '⭐', '🎲', '🌙', '🔥'];
const pick = <T>(a: readonly T[]): T => a[randInt(0, a.length - 1)]!;

/** Four pre-syllabic distractors for a word item (each attacks a common wrong hypothesis; see header). */
export function ferreiroDistractors(item: { w: string; s: string[] }): [string, string, string, string] {
  const w = item.w, n = item.s.length, L = w.length, mid = Math.max(1, Math.floor(L / 2));
  const a = (): string => (rnd() < 0.5 ? pick(_FER_SYM) + w : w.slice(0, mid) + pick(_FER_SYM) + w.slice(mid)); // (a) símbolo
  const b = (): string => w.charAt(randInt(0, w.length - 1)).repeat(randInt(4, 8)); // (b) letra repetida 4-8×
  const c = (): string => w.slice(0, mid) + pick(_FER_EMO) + w.slice(mid); // (c) emoji no meio
  const d = (): string =>
    rnd() < 0.5
      ? w.slice(0, Math.max(1, n - 1)) // (d-) ≤1 letra/sílaba
      : w.split('').map((ch) => ch + ch + ch + ch).join('').slice(0, Math.max(n * 4, 8)); // (d+) 4+ letras/sílaba
  return [a(), b(), c(), d()];
}
