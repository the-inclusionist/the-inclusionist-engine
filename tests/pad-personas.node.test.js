// SPDX-License-Identifier: AGPL-3.0-or-later
// THE FOUR PAD SIZES, one per persona (ADR-0151 erratum) — and the measurements they are derived from.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect } from 'vitest';
import { PERSONAS_DO_PAD, closestPersona } from '../app/js/input/touch.js';
import pt from '../app/js/i18n/pt.js';
import en from '../app/js/i18n/en.js';
import es from '../app/js/i18n/es.js';

describe('PERSONAS_DO_PAD', () => {
  it('🎯 [Right] FOUR, in the Dev\'s order: small child, older child, small adult, large hands', () => {
    expect(PERSONAS_DO_PAD.map((p) => p.key)).toEqual(['crianca-pequena', 'crianca-grande', 'adulto-pequeno', 'adulto-maos-grandes']);
  });

  it('🔴 [Right] every button clears the adult floor the sources measured (Parhi 2006: 9.2–9.6 mm)', () => {
    for (const p of PERSONAS_DO_PAD) expect(p.mm.btn, `${p.key} is below the measured floor`).toBeGreaterThanOrEqual(9.6);
  });

  it('🔴 [Right] the small child has the LARGEST button — imprecision, not hand size, is the constraint (Vatavu 2015)', () => {
    const maior = Math.max(...PERSONAS_DO_PAD.map((p) => p.mm.btn));
    expect(PERSONAS_DO_PAD[0].mm.btn).toBe(maior);
    // and the older child is above 9 mm, which is still missed once in six until 17 (Anthony 2013)
    expect(PERSONAS_DO_PAD[1].mm.btn).toBeGreaterThan(12.7);
  });

  it('[Interface] the rest of the pad grows WITH the button — no persona with big buttons and a tiny stick', () => {
    for (const p of PERSONAS_DO_PAD) {
      const k = p.mm.btn / 12.5;
      expect(p.mm.stick).toBeCloseTo(18 * k, 0);
      expect(p.mm.dpad).toBeCloseTo(12 * k, 0);
    }
  });

  it('[Interface] each persona has its name in pt, en and es — the step control never shows a key', () => {
    for (const [nome, dic] of [['pt', pt], ['en', en], ['es', es]]) {
      for (const p of PERSONAS_DO_PAD) expect(dic[p.label], `${nome}: ${p.label} missing`).toBeTruthy();
      expect(dic['motora.pad'], `${nome}: motora.pad missing`).toBeTruthy();
    }
  });
});

describe('closestPersona', () => {
  it('🎯 [Right] each persona\'s own size answers itself', () => {
    PERSONAS_DO_PAD.forEach((p, i) => expect(closestPersona(p.mm.btn)).toBe(i));
  });

  it('[Boundary] the factory pad (12.5 mm), sized before the personas, reads as «small adult»', () => {
    expect(PERSONAS_DO_PAD[closestPersona(12.5)].key).toBe('adulto-pequeno');
  });

  it('[Boundary] a tie goes to the LARGER button — when in doubt, the easier target', () => {
    // 15.5 is 0.5 from 15 (large hands) and 0.5 from 16 (small child)
    expect(PERSONAS_DO_PAD[closestPersona(15.5)].key).toBe('crianca-pequena');
  });
});

// ============================== MUTATIONS CHECKED ==============================
//   R1 the small child gets 11 mm                        🔴 below the floor / not the largest
//   R2 the tie goes to the smaller button                🔴 the tie case
//   R3 the stick stops following the button              🔴 proportion
