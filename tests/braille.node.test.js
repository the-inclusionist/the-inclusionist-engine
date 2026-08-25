// SPDX-License-Identifier: AGPL-3.0-or-later
// Testes de game/braille — cela braille + fala dos pontos (project node). ZOMBIES + Right-BICEP.
// Ver docs/5-Refactoring/plano-modularizacao-mapa.md (Estágio 4, game/quiz — braille).
import { describe, it, expect } from 'vitest';
import { BRAILLE, brailleText } from '../app/js/game/braille.js';

describe('BRAILLE', () => {
  it('as 26 letras têm cela definida', () => {
    expect(Object.keys(BRAILLE)).toHaveLength(26);
    expect(BRAILLE.a).toEqual([1]);
    expect(BRAILLE.z).toEqual([1, 3, 5, 6]);
  });
});

describe('brailleText', () => {
  it('fala os pontos como números em pt-BR', () => {
    expect(brailleText('a')).toBe('um');
    expect(brailleText('b')).toBe('um dois');
    expect(brailleText('j')).toBe('dois quatro cinco');
  });
  it('é case-insensitive', () => expect(brailleText('C')).toBe('um quatro'));
  it('caractere sem cela → vazio', () => { expect(brailleText('1')).toBe(''); expect(brailleText('ç')).toBe(''); });
});
