// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * THE SPEECH RATE (ADR-0183 §1, ADR-0196; issue #179): the child's words per minute, 254 to 504 by 50 — «velocidade normal é a
 * mínima» (the Dev): no voice is played slower than it speaks — mapped onto each engine by MEASURING
 * the voice rather than assuming it — the record: «the mapping needs each voice's words per minute at rate 1, measured, not
 * assumed.» Measured in the lab on 2026-09-14, a neural voice spoke 255 words per minute of speech; another voice or
 * sentence differs, so every synthesised utterance is measured (its words over its speech time) and played at the ratio.
 *
 * Pure: no I/O, no audio — the engine hands in the samples it synthesised.
 */
export const SPEECH_RATES = [254, 304, 354, 404, 454, 504] as const;
export type SpeechRate = (typeof SPEECH_RATES)[number];

/** The playback-rate bounds: never under the voice's own speed (ADR-0196), and a measurement error never garbles it. */
export const MIN_PLAYBACK_RATE = 1;
export const MAX_PLAYBACK_RATE = 3;

/** Below this an utterance is too short to measure («Voltar»): its silent ends and one stressed syllable dominate. */
const WORDS_TO_MEASURE = 3;
const SECONDS_TO_MEASURE = 0.8;

/** A stored or passed rate that is not a step — the old 150…500 by 35 among them — reads as the normal speed, the first step. */
export function isSpeechRate(ppm: number): SpeechRate {
  return (SPEECH_RATES as readonly number[]).includes(ppm) ? (ppm as SpeechRate) : SPEECH_RATES[0];
}

/** The words a voice says: tokens holding a letter; a dash, a number or a sign alone is not counted. */
export function spokenWords(texto: string): number {
  return texto.split(/\s+/).filter((w) => /\p{L}/u.test(w)).length;
}

/** Seconds from the first to the last sample above the silence threshold — the pauses inside stay, the silent ends go. */
export function speechSeconds(samples: ArrayLike<number>, sampleRate: number, silenceThreshold = 0.01): number {
  let a = 0, b = samples.length - 1;
  while (a <= b && Math.abs(samples[a]!) < silenceThreshold) a++;
  while (b >= a && Math.abs(samples[b]!) < silenceThreshold) b--;
  return b >= a ? (b - a + 1) / sampleRate : 0;
}

/**
 * The rate to play an utterance at, and the voice's words per minute measured on it (`null` when it was too short to measure).
 * Too short, it takes the voice's running average; with none yet, it plays as synthesised.
 */
export function speechPlaybackRate(
  words: number,
  seconds: number,
  ppm: number,
  voiceAverage: number | null,
): { readonly rate: number; readonly voiceWpm: number | null } {
  const alvo = isSpeechRate(ppm);
  const clampInside = (x: number): number => Math.min(MAX_PLAYBACK_RATE, Math.max(MIN_PLAYBACK_RATE, +x.toFixed(6)));
  if (words >= WORDS_TO_MEASURE && seconds >= SECONDS_TO_MEASURE) {
    const measuredWpm = (words / seconds) * 60;
    return { rate: clampInside(alvo / measuredWpm), voiceWpm: measuredWpm };
  }
  return { rate: voiceAverage ? clampInside(alvo / voiceAverage) : 1, voiceWpm: null };
}
