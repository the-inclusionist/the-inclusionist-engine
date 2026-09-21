// SPDX-License-Identifier: AGPL-3.0-or-later
// THE SPEECH RATE (ADR-0183 §1, ADR-0196; issue #179): 254 to 504 words per minute by 50, the voice's normal speed the minimum,
// each engine mapped by MEASURING the voice.
//
// 📏 The record: «The Web Speech API's `rate` is a multiplier, not words per minute: the mapping needs each voice's words per minute
// at rate 1, measured, not assumed.» Measured in the lab on 2026-09-14: a neural voice spoke 255 words per minute of speech.
// So the engine measures every utterance it synthesises — words over speech time, silent ends trimmed — and plays it at the ratio.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect } from 'vitest';
import {
  SPEECH_RATES, isSpeechRate, spokenWords, speechSeconds, speechPlaybackRate, MIN_PLAYBACK_RATE, MAX_PLAYBACK_RATE,
} from '../app/js/core/speech-rate.js';

describe('the speech rate steps', () => {
  it('🔴 [Right] are 254 to 504 by 50 — six positions (ADR-0196: «velocidade normal é a mínima»)', () => {
    expect(SPEECH_RATES).toEqual([254, 304, 354, 404, 454, 504]);
  });

  it('⚠️ [Boundary] a stored or passed rate that is not a step — the old 150…500 by 35 among them — reads as the normal 254', () => {
    expect([isSpeechRate(354), isSpeechRate(290), isSpeechRate(NaN), isSpeechRate(9999)]).toEqual([354, 254, 254, 254]);
  });
});

describe('measuring an utterance', () => {
  it('🔴 [Right] counts the words said — a dash or a number sign is not a word', () => {
    expect(spokenWords('Pule a pedra — e pegue 3 estrelas!')).toBe(6);
    expect(spokenWords('   ')).toBe(0);
  });

  it('🔴 [Right] speech time trims the silent ends and keeps the pauses inside', () => {
    const taxa = 100;
    const onda = new Float32Array(500); // 5 s
    for (let i = 100; i < 200; i++) onda[i] = 0.5; // speech 1–2 s
    for (let i = 300; i < 400; i++) onda[i] = -0.5; // speech 3–4 s, a pause between
    expect(speechSeconds(onda, taxa)).toBeCloseTo(3, 1);
    expect(speechSeconds(new Float32Array(300), taxa)).toBe(0);
  });
});

describe('the playback rate of an utterance', () => {
  it('🔴 [Right] is the chosen rate over the voice\'s own, measured on this utterance', () => {
    // 10 words in 3 s of speech = 200 words a minute; the child chose 404 → play at 2.02×
    expect(speechPlaybackRate(10, 3, 404, null)).toEqual({ taxa: 2.02, ppmDaVoz: 200 });
    expect(speechPlaybackRate(10, 2, 504, null).taxa).toBeCloseTo(504 / 300, 5);
  });

  it('⚠️ [Boundary] an utterance too short to measure takes the voice\'s average, or plays as is when there is none yet', () => {
    expect(speechPlaybackRate(1, 0.4, 404, 202)).toEqual({ taxa: 2, ppmDaVoz: null });
    expect(speechPlaybackRate(2, 0.5, 404, null)).toEqual({ taxa: 1, ppmDaVoz: null });
  });

  it('🔴 [Right] never under 1: a voice faster than the chosen step plays at its own speed (ADR-0196)', () => {
    // 10 words in 2 s = 300 words a minute; 254 chosen would be 0.85× — the voice is not slowed
    expect(MIN_PLAYBACK_RATE).toBe(1);
    expect(speechPlaybackRate(10, 2, 254, null).taxa).toBe(1);
  });

  it('⚠️ [Boundary] held under the maximum, so a wrong measure never garbles the voice', () => {
    expect(speechPlaybackRate(10, 20, 504, null).taxa).toBe(MAX_PLAYBACK_RATE);
  });
});

// ============================== MUTATIONS CHECKED ==============================
//   R1 a step of 45 instead of 50                    🔴 steps
//   R2 no trimming of the silent ends                🔴 speech time
//   R3 the rate inverted (natural over chosen)       🔴 chosen over the voice's
//   R4 no clamp                                      🔴 never under 1 · held
//   R6 the minimum back to 0.5                       🔴 never under 1
//   R5 short utterance measured anyway               🔴 too short
