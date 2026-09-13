// SPDX-License-Identifier: AGPL-3.0-or-later
// A SOUND CAPTION STAYS LONG ENOUGH TO BE READ BY A CHILD (plan phase 5c; ADR-0164 rule 4; GAG Hearing).
//
// 📏 Measured on 2026-09-13: `legendarSom` hid every caption after 2600 ms, whatever its length. The BBC's subtitle
// guidelines (a resource the Game Accessibility Guidelines list) set 160–180 words per minute for adults and 120–140 for
// children's programmes. At 120 words per minute a word takes 500 ms, so an eight-word caption needs 4 s and was gone at 2.6.
// 2600 ms stays the floor: a one-word caption («Sino») keeps the time the games had measured in play.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect } from 'vitest';
import { duracaoDaLegenda, LEGENDA_MINIMA_MS, MS_POR_PALAVRA } from '../app/js/core/caption-duration.js';

describe('how long a sound caption stays', () => {
  it('📌 [Right] the numbers are the sources\': 500 ms a word is 120 words a minute, and the floor is the games\' 2600 ms', () => {
    expect(60_000 / MS_POR_PALAVRA).toBe(120);
    expect(LEGENDA_MINIMA_MS).toBe(2600);
  });

  it('🔴 [Right] a long caption stays for its words, at a child\'s reading rate', () => {
    expect(duracaoDaLegenda('Uma porta de madeira velha rangendo bem devagar')).toBe(8 * 500);
  });

  it('🎯 [Boundary] a short caption keeps the floor', () => {
    expect(duracaoDaLegenda('Sino')).toBe(2600);
    expect(duracaoDaLegenda('Porta rangendo devagar lá fora')).toBe(2600); // 5 words = 2500 ms, under the floor
  });

  it('🎯 [Zero] spaces are not words', () => {
    expect(duracaoDaLegenda('  Gol   do   time  ')).toBe(2600);
    expect(duracaoDaLegenda('')).toBe(2600);
  });
});

// ============================== MUTATIONS CHECKED ==============================
//   D1 a fixed 2600 ms again                               🔴 long caption
//   D2 no floor                                            🔴 short caption
//   D3 empty strings counted as words                      🔴 spaces
//   D4 the adult rate (0.33 s a word)                      🔴 the numbers, long caption
