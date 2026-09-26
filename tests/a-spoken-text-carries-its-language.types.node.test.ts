// SPDX-License-Identifier: AGPL-3.0-or-later
// A SPOKEN TEXT CARRIES ITS LANGUAGE (ADR-0243) — the TYPE half, checked by `tsc` (the project's `include` holds `tests`): what a
// game writes compiles, and what the record forbids does not.
//
// 🔴 §4 · `gameSay` WITHOUT A LANGUAGE DOES NOT COMPILE. An optional language would default to one, and that default — pt-BR
// whatever the page said — is the defect the record removed. The `@ts-expect-error` below is the gate: if the parameter became
// optional, the directive would be unused and `tsc` would fail.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect } from 'vitest';
import { gameSay, type GameVoice } from '../app/js/platform/speech.js';
import type { SpokenPart, SpokenText } from '../app/js/platform/tts.js';

const said: { text: string; lang: string }[] = [];
const voice: GameVoice = {
  synth: () => ({ cancel: () => {}, speak: (u: SpeechSynthesisUtterance) => { said.push({ text: u.text, lang: u.lang }); }, getVoices: () => [] }) as unknown as SpeechSynthesis,
  utterance: (text) => ({ text, lang: '', volume: 0, voice: null }) as unknown as SpeechSynthesisUtterance,
  soundOn: () => true,
  volume: () => 1,
};

describe('the types a game writes (ADR-0243)', () => {
  it('🔴 [Right] §4 · `gameSay` takes the language, and without it the call does not compile', () => {
    gameSay(voice, 'lata', 'pt-BR');
    // @ts-expect-error — the language is REQUIRED (ADR-0243 §4)
    gameSay(voice, 'lata');
    expect(said.map((s) => s.lang)[0]).toBe('pt-BR');
  });

  it('🎯 [Right] §1 · a text alone, or parts with and without a language, are what `narrate` takes', () => {
    const frame: SpokenPart = { text: 'Escreva a palavra' };
    const content: SpokenPart = { text: 'apple', language: 'en' };
    const parts: SpokenText = [frame, content];
    const alone: SpokenText = 'Muito bem!';
    // @ts-expect-error — a part is a text with a language, not a bare string inside the list
    const wrong: SpokenText = ['Escreva', 'apple'];
    expect([parts, alone, wrong].length).toBe(3);
  });
});

// ===== MUTATIONS CHECKED (2026-09-26) =====
// `platform/speech.gameSay`'s `language` given a default (`language = 'pt-BR'`) → `tsc` exit 2: «Unused '@ts-expect-error'
// directive» at the call without a language. Applied by a counting script, restored from a copy and checked by SHA-256.
