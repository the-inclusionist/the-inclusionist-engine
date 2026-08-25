// SPDX-License-Identifier: AGPL-3.0-or-later
// game/activity-content — pure DATA for the learning activities (Estágio 4): the soma/subtração shapes and
// the syllable words (glyph/emoji, zero binary images), + their derivations. Verbatim from game.js.
// Domain content (pt-BR, read by educators). See docs/5-Refactoring/plano-modularizacao-mapa.md.

/** Shapes for the soma/subtração (add/subtract) activity. */
export interface ShapeDef { id: string; nome: string }
export const SOMASUB_SHAPES: readonly ShapeDef[] = [
  { id: 'circulo', nome: 'círculo' }, { id: 'triangulo', nome: 'triângulo' }, { id: 'quadrado', nome: 'quadrado' },
  { id: 'retangulo', nome: 'retângulo' }, { id: 'losango', nome: 'losango' }, { id: 'paralelogramo', nome: 'paralelogramo' },
  { id: 'trapezio', nome: 'trapézio' }, { id: 'pentagono', nome: 'pentágono' }, { id: 'hexagono', nome: 'hexágono' }, { id: 'oval', nome: 'oval' },
];

/** Human name of a shape id (falls back to the id). */
export const somaSubName = (id: string): string => {
  const x = SOMASUB_SHAPES.find((z) => z.id === id);
  return x ? x.nome : id;
};

/** Syllable activity: 2-syllable words + emoji (Unicode glyph = zero binary images). */
export interface SyllableWord { w: string; e: string; s: string[] }
export const SILABAS_WORDS: readonly SyllableWord[] = [
  { w: 'gato', e: '🐱', s: ['ga', 'to'] }, { w: 'bola', e: '⚽', s: ['bo', 'la'] }, { w: 'casa', e: '🏠', s: ['ca', 'sa'] },
  { w: 'pato', e: '🦆', s: ['pa', 'to'] }, { w: 'sapo', e: '🐸', s: ['sa', 'po'] }, { w: 'vaca', e: '🐄', s: ['va', 'ca'] },
  { w: 'rato', e: '🐀', s: ['ra', 'to'] }, { w: 'lua', e: '🌙', s: ['lu', 'a'] }, { w: 'uva', e: '🍇', s: ['u', 'va'] },
  { w: 'dado', e: '🎲', s: ['da', 'do'] }, { w: 'fogo', e: '🔥', s: ['fo', 'go'] }, { w: 'bolo', e: '🎂', s: ['bo', 'lo'] },
  { w: 'ovo', e: '🥚', s: ['o', 'vo'] }, { w: 'gelo', e: '🧊', s: ['ge', 'lo'] }, { w: 'rosa', e: '🌹', s: ['ro', 'sa'] },
];

/** All consonant+vowel syllables (14 × 5 = 70), for the syllable pool. */
export const SILABA_POOL: readonly string[] = (() => {
  const cons = 'bcdfgjlmnprstv'.split(''), vow = 'aeiou'.split(''), o: string[] = [];
  for (const c of cons) for (const v of vow) o.push(c + v);
  return o;
})();

/** Distinct first letters of the syllable words (activity coin pool). */
export const WORD_INITIALS: readonly string[] = [...new Set(SILABAS_WORDS.map((w) => w.w.charAt(0)))];
