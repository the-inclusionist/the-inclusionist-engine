// SPDX-License-Identifier: AGPL-3.0-or-later
// THE SPEECH RATE (ADR-0183 §1, issue #179): 150 to 500 words per minute by 35, each engine mapped by MEASURING the voice.
//
// 📏 The record: «The Web Speech API's `rate` is a multiplier, not words per minute: the mapping needs each voice's words per minute
// at rate 1, measured, not assumed.» Measured in the lab on 2026-09-14: `pt_BR-faber-medium` speaks 255 words per minute of speech.
// So the engine measures every utterance it synthesises — words over speech time, silent ends trimmed — and plays it at the ratio.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect } from 'vitest';
import {
  RITMOS_DA_FALA, ritmoDaFalaValido, palavrasFaladas, segundosDeFala, taxaDaFala, TAXA_MINIMA, TAXA_MAXIMA,
} from '../app/js/core/speech-rate.js';

describe('the speech rate steps', () => {
  it('🔴 [Right] are 150 to 500 by 35 — eleven positions', () => {
    expect(RITMOS_DA_FALA).toEqual([150, 185, 220, 255, 290, 325, 360, 395, 430, 465, 500]);
  });

  it('⚠️ [Boundary] a stored or passed rate that is not a step reads as the slowest', () => {
    expect([ritmoDaFalaValido(290), ritmoDaFalaValido(300), ritmoDaFalaValido(NaN), ritmoDaFalaValido(9999)]).toEqual([290, 150, 150, 150]);
  });
});

describe('measuring an utterance', () => {
  it('🔴 [Right] counts the words said — a dash or a number sign is not a word', () => {
    expect(palavrasFaladas('Pule a pedra — e pegue 3 estrelas!')).toBe(6);
    expect(palavrasFaladas('   ')).toBe(0);
  });

  it('🔴 [Right] speech time trims the silent ends and keeps the pauses inside', () => {
    const taxa = 100;
    const onda = new Float32Array(500); // 5 s
    for (let i = 100; i < 200; i++) onda[i] = 0.5; // speech 1–2 s
    for (let i = 300; i < 400; i++) onda[i] = -0.5; // speech 3–4 s, a pause between
    expect(segundosDeFala(onda, taxa)).toBeCloseTo(3, 1);
    expect(segundosDeFala(new Float32Array(300), taxa)).toBe(0);
  });
});

describe('the playback rate of an utterance', () => {
  it('🔴 [Right] is the chosen rate over the voice\'s own, measured on this utterance', () => {
    // 10 words in 2 s of speech = 300 words a minute; the child chose 150 → play at half speed
    expect(taxaDaFala(10, 2, 150, null)).toEqual({ taxa: 0.5, ppmDaVoz: 300 });
    expect(taxaDaFala(10, 2, 500, null).taxa).toBeCloseTo(500 / 300, 5);
  });

  it('⚠️ [Boundary] an utterance too short to measure takes the voice\'s average, or plays as is when there is none yet', () => {
    expect(taxaDaFala(1, 0.4, 150, 250)).toEqual({ taxa: 0.6, ppmDaVoz: null });
    expect(taxaDaFala(2, 0.5, 150, null)).toEqual({ taxa: 1, ppmDaVoz: null });
  });

  it('⚠️ [Boundary] held between the minimum and the maximum, so a wrong measure never stops or garbles the voice', () => {
    expect(taxaDaFala(10, 20, 500, null).taxa).toBe(TAXA_MAXIMA);
    expect(taxaDaFala(40, 2, 150, null).taxa).toBe(TAXA_MINIMA);
  });
});

// ============================== MUTATIONS CHECKED ==============================
//   R1 a step of 30 instead of 35                    🔴 steps
//   R2 no trimming of the silent ends                🔴 speech time
//   R3 the rate inverted (natural over chosen)       🔴 chosen over the voice's
//   R4 no clamp                                      🔴 held
//   R5 short utterance measured anyway               🔴 too short
