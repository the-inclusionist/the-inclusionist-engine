// SPDX-License-Identifier: AGPL-3.0-or-later
// THE KOKORO VOICES, PURE HALF (ADR-0186, ADR-0198; issue #181): the catalogue, the ids, the style row, speech or noise, the WAV.
//
// 📏 Measured in the lab: espeak-ng pt-br phonemes of «Pule a pedra e pegue a estrela. Ótimo trabalho!» gave 53 ids with no symbol
// outside the vocabulary; WebGPU on an AMD gcn-5 returned samples up to 2×10⁷ — the case `eFala` refuses.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect } from 'vitest';
import { KOKORO_VOICES, tokenizar, sentenceStyle, eFala, wavDe, MAX_KOKORO_TOKENS, STYLE_DIMENSION } from '../app/js/platform/kokoro.js';
import { voicesForLocale } from '../app/js/platform/voice-plan.js';
import { HEAVY_FILES } from '../app/js/platform/heavy-catalogue.js';

describe('the Kokoro catalogue', () => {
  it('🔴 [Right] Portuguese and Spanish hold three voices each; English twenty-eight, American and British', () => {
    const por = (tag) => voicesForLocale(tag, KOKORO_VOICES).map((v) => v.voice);
    expect(por('pt-BR')).toEqual(['pf_dora', 'pm_alex', 'pm_santa']);
    expect(por('es-MX')).toEqual(['ef_dora', 'em_alex', 'em_santa']);
    expect(por('en').length).toBe(28);
  });

  it('🔴 [Right] exactly two voices are good: Heart and Bella (ADR-0198 §3)', () => {
    expect(KOKORO_VOICES.filter((v) => v.boa).map((v) => v.voice)).toEqual(['af_heart', 'af_bella']);
  });

  it('⚠️ [Boundary] each voice is phonemized in its own language — British English is not American', () => {
    const espeak = (id) => KOKORO_VOICES.find((v) => v.voice === id).espeak;
    expect([espeak('pf_dora'), espeak('em_alex'), espeak('af_heart'), espeak('bm_george')]).toEqual(['pt-br', 'es-419', 'en-us', 'en-gb']);
  });

  it('[Zero] no voice of a language the engine does not speak', () => {
    expect(KOKORO_VOICES.some((v) => /^[fhijz]/.test(v.voice)), 'French, Hindi, Italian, Japanese or Chinese leaked in').toBe(false);
  });
});

describe('Kokoro in the heavy-file catalogue (ADR-0198 erratum: «Faça»)', () => {
  it('🔴 [Right] the model, the tokenizer and every voice of the catalogue, each with its size and a 64-hex SHA-256', () => {
    const k = HEAVY_FILES.filter((p) => p.id.startsWith('voz:kokoro:'));
    expect(k.length, 'model + tokenizer + 34 voices').toBe(36);
    const semPeso = k.filter((p) => !(p.bytes > 0) || !/^[0-9a-f]{64}$/.test(p.sha256 ?? '')).map((p) => p.id);
    expect(semPeso, 'an entry the fetcher could not check').toEqual([]);
    expect(k.find((p) => p.id === 'voz:kokoro:modelo')).toMatchObject({ bytes: 325_532_232, sha256: '8fbea51ea711f2af382e88c833d9e288c6dc82ce5e98421ea61c058ce21a34cb' });
    expect(new Set(k.map((p) => p.url)).size, 'two entries fetch the same file').toBe(36);
  });
});

describe('the ids and the style row', () => {
  const vocab = { p: 1, u: 2, l: 3, i: 4, ' ': 5, 'ˈ': 6 };

  it('🔴 [Right] each known symbol in order, between two pad tokens; unknown symbols dropped', () => {
    expect(tokenizar('pˈuli?', vocab)).toEqual([0, 1, 6, 2, 3, 4, 0]);
  });

  it('⚠️ [Boundary] a sentence past the model\'s context is cut at 510 ids', () => {
    expect(tokenizar('p'.repeat(600), vocab).length).toBe(MAX_KOKORO_TOKENS + 2);
  });

  it('🔴 [Right] the style row is the token count\'s row of the voice table, held at its last row', () => {
    const tabela = new Float32Array(STYLE_DIMENSION * 3).map((_, i) => Math.floor(i / STYLE_DIMENSION));
    expect([sentenceStyle(tabela, 1)[0], sentenceStyle(tabela, 2)[255], sentenceStyle(tabela, 99)[0]]).toEqual([1, 2, 2]);
    expect(sentenceStyle(tabela, 0).length).toBe(STYLE_DIMENSION);
  });
});

describe('speech or noise', () => {
  const tom = Float32Array.from({ length: 2400 }, (_, i) => Math.sin(i / 10) * 0.5);

  it('🔴 [Right] a waveform within ±1 with energy is speech', () => {
    expect(eFala(tom)).toBe(true);
  });

  it('🔴 [Zero] the WebGPU output measured on 2026-09-14 — samples to 2×10⁷ — is not speech', () => {
    const ruido = Float32Array.from(tom);
    ruido[9] = -20_561_670;
    expect(eFala(ruido)).toBe(false);
  });

  it('⚠️ [Boundary] silence and non-finite samples are not speech; a clipped sample just past 1 is', () => {
    expect(eFala(new Float32Array(2400))).toBe(false);
    const nan = Float32Array.from(tom); nan[5] = NaN;
    expect(eFala(nan)).toBe(false);
    const cortada = Float32Array.from(tom); cortada[5] = 1.1;
    expect(eFala(cortada)).toBe(true);
  });
});

describe('the WAV', () => {
  it('🔴 [Right] 16-bit mono at 24 kHz, samples clipped to ±1', () => {
    const buf = wavDe(Float32Array.from([0, 0.5, -2]));
    const v = new DataView(buf);
    expect([v.getUint32(24, true), v.getUint16(22, true), v.getUint16(34, true), buf.byteLength]).toEqual([24000, 1, 16, 50]);
    expect([v.getInt16(46, true), v.getInt16(48, true)]).toEqual([16384, -32767]);
  });
});

// ============================== MUTATIONS CHECKED ==============================
//   K1 no pad tokens                                   🔴 ids
//   K2 no cut at 510                                   🔴 context
//   K3 the style row not held at the last              🔴 style row
//   K4 `eFala` accepts any finite sample               🔴 WebGPU output
//   K5 a third voice marked good                       🔴 Heart and Bella
//   K6 British voices phonemized as American           🔴 own language
//   K7 a voice without its SHA-256 in the catalogue    🔴 heavy-file catalogue
