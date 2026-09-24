// SPDX-License-Identifier: AGPL-3.0-or-later
// THE READING'S ARITHMETIC, MEASURED AGAINST THE ORIGINALS (ADR-0216 §2; issues #185, #200).
//
// 🎯 THIS FILE EXISTS BECAUSE A WRONG FRONT END STILL WORKS. A Hann window built symmetric instead of periodic, a power spectrum
// left as magnitude, a mel matrix read transposed — each of those returns a spectrogram of the right shape, the encoder accepts
// it, the decoder answers words, and the words are wrong. Nothing crashes. So the case does not ask «did it produce something»:
// it compares with what `WhisperFeatureExtractor` and the three tokenizers themselves answer, written to
// `fixtures/reading-ground-truth.json` by `scratchpad/verdade-da-leitura.py` (transformers 5.5.4, torch 2.14).
//
// ⚠️ THE FIXTURE CARRIES THE MEL FILTERS AND THE PIECES IT NAMES, so this runs where the Dev's staging tree is not — which is
// everywhere but their machine. A case that skips when a folder is missing measures NOTHING and says so to nobody; it is how 36
// gates of this repository once went quiet at the same time. What the tree does add is the case at the end: the copy here and
// the file the catalogue fetches must still be the same bytes.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  READING_MODELS, READING_RATE, WHISPER_BANDS, WHISPER_FRAMES, WHISPER_SAMPLES,
  logMel, nextToken, readingModelFor, readingTextOf, suppressedTokens,
} from '../app/js/platform/reading-model.js';
import { HEAVY_FILES } from '../app/js/platform/heavy-catalogue.js';

/*
 * ⚠️ THIS FILE'S TIME CEILING IS CHOSEN, and the distinction matters because raising a ceiling is usually the fix that
 * postpones the error. 📏 Measured on 2026-09-23: this file takes 3.73 s of test on an IDLE machine — the log-mel of 30 s of
 * audio checked point by point against `WhisperFeatureExtractor` is the work, not waste —, against Vitest's default of
 * 5 s, which nobody chose for it. Under the load of the whole suite the CPU is shared and it crossed that default in about
 * one run in five, failing for no reason and taking any measurement beside it down too.
 * 📌 The silence window is already ANSWERED instead of computed (otherwise it would be 250 billion multiplications); what
 * is left is the real cost of the measurement.
 */
vi.setConfig({ testTimeout: 20_000 });

const truth = JSON.parse(readFileSync('tests/fixtures/reading-ground-truth.json', 'utf8'));

/** The 80 × 201 mel filterbank the fixture carries, as the module wants it: a row per band. */
const FILTROS = (() => {
  const [bands, bins] = truth.melFilters.shape;
  const flat = new Float32Array(Buffer.from(truth.melFilters.base64, 'base64').buffer.slice(0));
  return Array.from({ length: bands }, (_, b) => Array.from(flat.subarray(b * bins, (b + 1) * bins)));
})();

/** A tokenizer file with only what a case names — the same shape `platform/reading-model` reads from the real one. */
const tokenizadorDe = (lingua) => {
  const caso = truth.tokenizers[lingua];
  const vocab = {};
  for (const [id, piece] of Object.entries(caso.pieces)) vocab[piece] = Number(id);
  return {
    model: { vocab },
    added_tokens: caso.specials,
    decoder: { type: caso.decoderType },
  };
};

/** The same signal the fixture was written from: two tones, one second, 16 kHz. */
function sinal() {
  const { seconds, rate, tones, amplitudes } = truth.audio;
  const out = new Float32Array(seconds * rate);
  for (let n = 0; n < out.length; n++) {
    let x = 0;
    for (let t = 0; t < tones.length; t++) x += amplitudes[t] * Math.sin((2 * Math.PI * tones[t] * n) / rate);
    out[n] = x;
  }
  return out;
}

/** The same two tones filling the whole 30 s window: no frame of it is silent. */
function sinalCheio() {
  const { tones, amplitudes, rate } = truth.audio;
  const out = new Float32Array(WHISPER_SAMPLES);
  for (let n = 0; n < out.length; n++) {
    let x = 0;
    for (let t = 0; t < tones.length; t++) x += amplitudes[t] * Math.sin((2 * Math.PI * tones[t] * n) / rate);
    out[n] = x;
  }
  return out;
}

describe('the reading models, and what the engine asks of each', () => {
  it('🔴 [Right] every file a model needs is in the catalogue, by id', () => {
    const noCatalogo = new Set(HEAVY_FILES.map((p) => p.id));
    const faltam = [];
    for (const m of READING_MODELS) {
      for (const campo of ['encoder', 'decoder', 'decoderPast', 'tokenizer', 'generation', 'preprocessor']) {
        if (m[campo] && !noCatalogo.has(m[campo])) faltam.push(`${m.language}.${campo} → ${m[campo]}`);
      }
    }
    expect(faltam, 'a model names a file the build never fetches: the reading would fail at the child, not here').toEqual([]);
    expect(READING_MODELS.map((m) => m.language)).toEqual(['pt', 'en', 'es']);
  });

  it('📌 [Boundary] the region is not the language, and a language nobody has is `null`', () => {
    expect(readingModelFor('pt-BR')?.language).toBe('pt');
    expect(readingModelFor('es-MX')?.input, 'Moonshine eats the waveform, not a spectrogram').toBe('waveform');
    expect(readingModelFor('pt')?.input).toBe('log-mel');
    expect(readingModelFor('fr-FR'), 'a language the project has no model for must be NULL, so the caller says so').toBeNull();
  });
});

describe('what Whisper\'s encoder eats (measured against WhisperFeatureExtractor)', () => {
  it('🔴 [Right] the spectrogram matches the original, point by point', () => {
    const mel = logMel(sinal(), FILTROS);
    expect([WHISPER_BANDS, WHISPER_FRAMES], 'the fixture measures another shape').toEqual(truth.mel.shape);
    expect(mel.length).toBe(WHISPER_BANDS * WHISPER_FRAMES);
    for (const { band, frame, value } of truth.mel.probes) {
      expect(mel[band * WHISPER_FRAMES + frame], `band ${band}, frame ${frame}`).toBeCloseTo(value, 4);
    }
  });

  it('🔴 [Right] and band by band, which no single point can prove', () => {
    // ⚠️ A probe at a frame is blind to a spectrogram shifted in time — the sums are not.
    const mel = logMel(sinal(), FILTROS);
    const bandas = [0, 7, 40, 79];
    for (let i = 0; i < bandas.length; i++) {
      let soma = 0;
      for (let f = 0; f < WHISPER_FRAMES; f++) soma += mel[bandas[i] * WHISPER_FRAMES + f];
      expect(soma, `band ${bandas[i]}`).toBeCloseTo(truth.mel.bandSums[i], 1);
    }
  });

  it('🔴 [Right] a reading that fills the window is REFLECTED at its end too, as the original pads it', () => {
    // ⚠️ The one-second signal above ends in 29 s of zeros, and at a silent end reflecting and repeating the last sample are
    // the same thing — so the right-hand padding had no case. Here the two tones fill all 30 s, and the last frame reaches 40
    // samples past the end. 📏 `mel.full` in the fixture is `WhisperFeatureExtractor` on this very signal.
    const mel = logMel(sinalCheio(), FILTROS);
    for (const { band, frame, value } of truth.mel.full.probes) {
      expect(mel[band * WHISPER_FRAMES + frame], `band ${band}, frame ${frame}`).toBeCloseTo(value, 4);
    }
  });

  it('🔴 [Boundary] a whisper is clipped where the original clips it: at 1e-10, BEFORE the log', () => {
    // A tone at 1e-5 is so quiet that far from it the power falls under 1e-10, and the floor eight decades below the loudest
    // point is lower still — so there the original's clip is the answer, not the floor. 📏 `mel.quiet` is the extractor's
    // own sums: 239 571 of its 240 000 values sit at −1.5.
    const { tone, amplitude, seconds } = truth.mel.quiet;
    const baixo = Float32Array.from({ length: seconds * READING_RATE },
      (_, n) => amplitude * Math.sin((2 * Math.PI * tone * n) / READING_RATE));
    const mel = logMel(baixo, FILTROS);
    truth.mel.quiet.bandSums.forEach((esperada, band) => {
      let soma = 0;
      for (let f = 0; f < WHISPER_FRAMES; f++) soma += mel[band * WHISPER_FRAMES + f];
      expect(soma, `band ${band}`).toBeCloseTo(esperada, 1);
    });
  });

  it('🔴 [Zero] a window with no sound at all is every value at −1.5, which is what the original answers', () => {
    // 📏 Measured with `WhisperFeatureExtractor` on 16 000 zeros: min −1.5, max −1.5, one value in the whole spectrogram.
    // ⚠️ It is the case that holds the shortcut honest: silence is ANSWERED and not computed, so the constant it is answered
    // with has to be the one the arithmetic would have reached — `log10(1e-10)`, and not a round number that looks like it.
    const mel = logMel(new Float32Array(WHISPER_SAMPLES), FILTROS);
    let menor = Infinity, maior = -Infinity;
    for (const v of mel) { if (v < menor) menor = v; if (v > maior) maior = v; }
    expect(menor).toBeCloseTo(-1.5, 6);
    expect(maior).toBeCloseTo(-1.5, 6);
  });

  it('📌 [Boundary] a reading longer than the window is CUT, and a shorter one padded — never refused', () => {
    const curto = logMel(new Float32Array(READING_RATE), FILTROS);                   // one second of silence
    const longo = logMel(new Float32Array(WHISPER_SAMPLES * 2).fill(0.1), FILTROS);  // a minute of tone
    expect(curto.length).toBe(WHISPER_BANDS * WHISPER_FRAMES);
    expect(longo.length).toBe(WHISPER_BANDS * WHISPER_FRAMES);
  });

  it('📏 [Right] silence is answered and not computed — the same 30 s window, at a school\'s speed', () => {
    // A child reads for a few seconds into a 30 s window: most frames are zeros, and every bin of a window of zeros is zero, so
    // the answer is exact and not an approximation. Without it the same call is a quarter of a billion multiplications.
    const começou = performance.now();
    logMel(sinal(), FILTROS);
    const ms = performance.now() - começou;
    expect(ms, `a 30 s window took ${ms.toFixed(0)} ms — a child would wait for it`).toBeLessThan(4000);
    // ⚠️ The ceiling above cannot see the shortcut: 📏 measured 58 ms with it and 818–847 ms without, both far under 4 s on
    // this machine. A lower ceiling would fail under the suite's load (the instability this plan already records), so the
    // shortcut is held by a RATIO measured back to back, which load moves on both sides alike: a window that is one second of
    // sound must cost far less than one that is thirty.
    const antes = performance.now();
    logMel(sinalCheio(), FILTROS);
    const cheio = performance.now() - antes;
    expect(ms, `one second of sound cost ${ms.toFixed(0)} ms against ${cheio.toFixed(0)} ms for thirty: silence was computed`)
      .toBeLessThan(cheio / 3);
  });
});

describe('what the child said, from the ids (measured against the tokenizers)', () => {
  for (const lingua of ['pt', 'en', 'es']) {
    it(`🔴 [Right] ${lingua}: accents, digits and punctuation come back as they went in`, () => {
      const caso = truth.tokenizers[lingua];
      expect(readingTextOf(tokenizadorDe(lingua), caso.ids)).toBe(caso.text);
    });
  }

  it('🔴 [Boundary] Whisper\'s byte alphabet is GPT-2\'s at its edges — a control byte, a no-break space, a soft hyphen', () => {
    // Found by the probe of 2026-09-24: the three phrases above only carry common bytes, and every edge of the alphabet was
    // free to move with them green. The pairs are GPT-2's published `bytes_to_unicode` (openai/gpt-2 `encoder.py`): the
    // printable ranges stand for themselves, every other byte for U+0100 onwards, in order — space is `Ġ`, DEL is `ġ`,
    // the no-break space is `ł`, the soft hyphen is `Ń`. A shifted range sends the next one to the wrong byte.
    const cases = [
      ['a b', ['a', 'Ġ', 'b']],
      ['a\u007Fb', ['a', 'ġ', 'b']],
      ['a b', ['a', 'Â', 'ł', 'b']],
      ['a­b', ['a', 'Â', 'Ń', 'b']],
      ['~¬®', ['~', 'Â', '¬', 'Â', '®']],
    ];
    for (const [said, pieces] of cases) {
      const vocab = Object.fromEntries(pieces.map((p, i) => [p, i]));
      const ids = pieces.map((p) => vocab[p]);
      expect(readingTextOf({ model: { vocab }, decoder: { type: 'ByteLevel' } }, ids), JSON.stringify(said)).toBe(said);
    }
  });

  it('🔴 [Zero] a special token never reaches the child', () => {
    const caso = truth.tokenizers.pt;
    const especiais = caso.specials.map((s) => s.id);
    expect(especiais.length, 'the fixture has no special tokens to leave out').toBeGreaterThan(0);
    expect(readingTextOf(tokenizadorDe('pt'), [...especiais, ...caso.ids, especiais[0]])).toBe(caso.text);
  });

  it('📌 [Zero] an id the vocabulary does not have is dropped, never guessed', () => {
    const caso = truth.tokenizers.es;
    expect(readingTextOf(tokenizadorDe('es'), [...caso.ids, 999_999])).toBe(caso.text);
    expect(readingTextOf(tokenizadorDe('es'), [])).toBe('');
  });
});

describe('which token comes next', () => {
  it('🔴 [Right] the biggest logit wins, and a refused token never does', () => {
    const logits = [0.1, 9.0, 0.5, 8.0];
    expect(nextToken(logits)).toBe(1);
    expect(nextToken(logits, new Set([1]))).toBe(3);
    expect(nextToken(logits, new Set([1, 3])), 'two refused, and the third-best wins').toBe(2);
  });

  it('🔴 [Right] the first token refuses MORE: Whisper opens with a full stop otherwise', () => {
    const config = { suppress_tokens: [1, 2], begin_suppress_tokens: [220, 50257] };
    expect([...suppressedTokens(config, false)].sort((a, b) => a - b)).toEqual([1, 2]);
    expect([...suppressedTokens(config, true)].sort((a, b) => a - b)).toEqual([1, 2, 220, 50257]);
    expect([...suppressedTokens({}, true)], 'a config without lists must refuse nothing, not crash').toEqual([]);
  });

  it('📌 [Boundary] every token refused answers −1, which is a stop and not a token', () => {
    expect(nextToken([1, 2], new Set([0, 1]))).toBe(-1);
  });
});

/*
 * 🔴 AND THE COPY HAS TO STAY A COPY. The fixture holds the filters and the pieces so the arithmetic above runs anywhere; the
 * price of that is a second copy of bytes the catalogue already pins, and a copy that drifts is worse than no copy — it would
 * keep this file green while the model reads something else. Where the staging tree is on the machine, this says so.
 */
const LFS = 'C:/Users/candi/Claude/the-inclusionist-lfs';
const lerDaArvore = (p) => JSON.parse(readFileSync(`${LFS}/${p}`, 'utf8'));
const TEM_ARVORE = (() => { try { lerDaArvore('whisper-small-onnx/preprocessor_config.json'); return true; } catch { return false; } })();

describe.skipIf(!TEM_ARVORE)('the fixture against the files the catalogue fetches', () => {
  it('🔴 [Right] the mel filters are the model\'s own, to the last value', () => {
    const doModelo = lerDaArvore('whisper-small-onnx/preprocessor_config.json').mel_filters;
    expect([doModelo.length, doModelo[0].length]).toEqual(truth.melFilters.shape);
    for (let b = 0; b < doModelo.length; b++) {
      for (let k = 0; k < doModelo[b].length; k++) expect(FILTROS[b][k]).toBeCloseTo(doModelo[b][k], 6);
    }
  });

  it('🔴 [Right] every piece the fixture carries is the piece that model\'s vocabulary has', () => {
    for (const lingua of ['pt', 'en', 'es']) {
      const caso = truth.tokenizers[lingua];
      const real = lerDaArvore(`${caso.folder}/tokenizer.json`);
      const porId = new Map(Object.entries(real.model.vocab).map(([piece, id]) => [id, piece]));
      for (const [id, piece] of Object.entries(caso.pieces)) {
        expect(porId.get(Number(id)), `${lingua}, id ${id}`).toBe(piece);
      }
      expect(real.decoder?.type, `${lingua}: the decoder changed and the fixture did not`).toBe(caso.decoderType);
    }
  });

  it('🔴 [Right] and the WHOLE tokenizer answers the same as the fixture\'s slice of it', () => {
    // The slice could be right and the decoding still wrong for what the slice leaves out: this runs the real file.
    for (const lingua of ['pt', 'en', 'es']) {
      const caso = truth.tokenizers[lingua];
      expect(readingTextOf(lerDaArvore(`${caso.folder}/tokenizer.json`), caso.ids), lingua).toBe(caso.text);
    }
  });
});

// MUTATIONS CHECKED (2026-09-21) — `scratchpad/mutar-reading-model.py`:
//   · a symmetric Hann window instead of periodic        → «matches the original, point by point»
//   · magnitude instead of magnitude squared             → same
//   · the mel matrix read transposed                     → same
//   · the reflected padding dropped                      → same
//   · the floor as a constant instead of loudest − 8     → same
//   · silence answered with the wrong constant           → «band by band»
//   · the byte alphabet off by one                       → «pt: accents, digits and punctuation»
//   · `▁` left as itself                                 → «en» and «es»
//   · the leading space kept                             → same
//   · special tokens let through                         → «a special token never reaches the child»
//   · `begin_suppress_tokens` ignored                    → «the first token refuses MORE»
//   · a model naming a file the catalogue has not        → «every file a model needs is in the catalogue»
//
// PROBED AGAIN (2026-09-23), sixteen decisions of `logMel` disabled one at a time — `scratchpad/sonda-mel.py`. Five were green:
//   · the right-hand reflection replaced by the edge   → «a reading that fills the window is REFLECTED at its end too» (the
//                                                        one-second signal ends in silence, where the two are the same)
//   · the clip at 1e-10 before the log dropped          → «a whisper is clipped where the original clips it»
//   · the silence shortcut dropped                      → the RATIO in «silence is answered and not computed» (58 ms with it,
//                                                        818–847 ms without — both under the absolute ceiling)
//   · 📏 EQUIVALENT: the scan for silence not stopping at the first sound — it reads 400 more samples in a frame that already
//     costs 80 400 multiply-adds, and answers the same.
//   · 📏 EQUIVALENT, and the line is gone: a silent frame raising the loudest point to `log10(1e-10)`. A computed value is
//     `log10(max(sum, 1e-10))`, never below it, and an all-silent window floors at −∞, which leaves every value where it is.
