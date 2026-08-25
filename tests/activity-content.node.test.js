// SPDX-License-Identifier: AGPL-3.0-or-later
// Testes de game/activity-content — dados das atividades (project node). ZOMBIES + Right-BICEP.
// Ver docs/5-Refactoring/plano-modularizacao-mapa.md (Estágio 4, conteúdo das atividades).
import { describe, it, expect } from 'vitest';
import { SOMASUB_SHAPES, somaSubName, SILABAS_WORDS, SILABA_POOL, WORD_INITIALS } from '../app/js/game/activity-content.js';

describe('SOMASUB_SHAPES / somaSubName', () => {
  it('tem 10 formas com id+nome', () => {
    expect(SOMASUB_SHAPES).toHaveLength(10);
    expect(SOMASUB_SHAPES.every((s) => s.id && s.nome)).toBe(true);
  });
  it('somaSubName traduz o id (fallback = o próprio id)', () => {
    expect(somaSubName('triangulo')).toBe('triângulo');
    expect(somaSubName('__x__')).toBe('__x__');
  });
});

describe('SILABAS_WORDS', () => {
  it('cada palavra = w + emoji + sílabas cujo join reconstrói a palavra', () => {
    expect(SILABAS_WORDS.length).toBeGreaterThan(0);
    for (const it of SILABAS_WORDS) {
      expect(it.e.length).toBeGreaterThan(0);
      expect(it.s.join('')).toBe(it.w); // sílabas remontam a palavra
    }
  });
});

describe('SILABA_POOL', () => {
  it('são 14 consoantes × 5 vogais = 70 sílabas cv únicas', () => {
    expect(SILABA_POOL).toHaveLength(70);
    expect(new Set(SILABA_POOL).size).toBe(70); // sem repetição
    expect(SILABA_POOL).toContain('ba');
    expect(SILABA_POOL).toContain('vu');
  });
});

describe('WORD_INITIALS', () => {
  it('são as iniciais DISTINTAS das palavras de sílaba', () => {
    expect(new Set(WORD_INITIALS).size).toBe(WORD_INITIALS.length); // distintas
    for (const w of SILABAS_WORDS) expect(WORD_INITIALS).toContain(w.w.charAt(0));
  });
});
