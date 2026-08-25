// SPDX-License-Identifier: AGPL-3.0-or-later
// Testes de game/literacy-distractors — nomes de letra + distratores Ferreiro (project node). ZOMBIES + Right-BICEP.
// ferreiroDistractors usa rng → semeamos p/ determinismo. Ver docs/5-Refactoring/plano-modularizacao-mapa.md.
import { describe, it, expect, beforeEach } from 'vitest';
import { LETTER_NAME, soletra, ferreiroDistractors } from '../app/js/game/literacy-distractors.js';
import { reseed } from '../app/js/core/rng.js';

describe('LETTER_NAME / soletra', () => {
  it('tem as 26 letras', () => expect(Object.keys(LETTER_NAME)).toHaveLength(26));
  it('soletra usa os nomes das letras', () => {
    expect(soletra('gato')).toBe('gê, á, tê, ó');
  });
  it('caractere sem nome passa direto (robustez)', () => expect(soletra('a1')).toBe('á, 1'));
});

describe('ferreiroDistractors', () => {
  beforeEach(() => reseed(12345));
  const item = { w: 'gato', s: ['ga', 'to'] };

  it('devolve 4 distratores, todos strings não-vazias', () => {
    const d = ferreiroDistractors(item);
    expect(d).toHaveLength(4);
    for (const x of d) expect(typeof x === 'string' && x.length > 0).toBe(true);
  });
  it('o distrator (b) é UMA letra da palavra repetida 4–8× (falta de variedade)', () => {
    const b = ferreiroDistractors(item)[1];
    expect(b).toMatch(/^(.)\1{3,7}$/); // mesmo caractere, 4 a 8 vezes
    expect(item.w).toContain(b[0]); // a letra vem da própria palavra
  });
  it('o distrator (c) insere um emoji no meio da palavra', () => {
    const c = ferreiroDistractors(item)[2];
    expect(c.length).toBeGreaterThan(item.w.length); // palavra + 1 emoji
    expect(c.startsWith('ga')).toBe(true); // começa com o início da palavra (mid=2)
  });
});
