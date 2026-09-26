// SPDX-License-Identifier: AGPL-3.0-or-later
// platform/reading-model — WHAT A READING MODEL NEEDS DONE TO SOUND AND TO TOKENS, in its pure half (ADR-0216 §2; issues #185, #200).
//
// The engine hears a child read aloud with one model per language (ADR-0201 erratum): Whisper small for Portuguese, Moonshine
// streaming small for English and Spanish. Around the graphs there is arithmetic that has nothing to do with a browser — turning
// sound into what the encoder eats, and turning the numbers the decoder answers back into words — and it lives here, where it can
// be measured. `platform/reading-runtime` is the half that opens sessions and fetches files.
//
// 🎯 MEASURED AGAINST THE ORIGINALS, not against my idea of them: `tests/fixtures/reading-ground-truth.json` is what
// `WhisperFeatureExtractor` and the three tokenizers answer for one deterministic signal and three phrases, written by
// `scratchpad/verdade-da-leitura.py`. A front end that is subtly wrong still runs and still returns text — the wrong text — so
// «it produced something» is not a check.
//
// · THE MEL FILTERS ARE NOT COMPUTED HERE. Whisper's own `preprocessor_config.json` carries them (80 × 201), which is most of its
//   185 KB, and the catalogue already fetches it: a filterbank rebuilt from a formula is a second opinion about the model's input.
// · Moonshine takes the WAVEFORM. No spectrogram, no padding to 30 s — it is a different front end, not a variant of this one.
//   ⚠️ But the streaming encoder takes it in WHOLE FRAMES of 5 ms (80 samples), and refuses any other length: `inWholeFrames`.

/** What the engine asks of a language: which catalogue files, and what the encoder eats. */
export interface ReadingModelPlan {
  readonly language: string;
  /** Whisper eats a log-mel spectrogram; Moonshine eats the samples. */
  readonly input: 'log-mel' | 'waveform';
  readonly encoder: string;
  readonly decoder: string;
  /** The second decoder graph, where the model has one: the first pass builds the cache, this one uses it. */
  readonly decoderPast?: string;
  readonly tokenizer: string;
  readonly generation: string;
  /** How many heads the caches hold and how wide each is — what a merged decoder needs to be handed empty ones. */
  readonly config: string;
  /** Only the mel front end needs one. */
  readonly preprocessor?: string;
}

/** 16 kHz mono, for every one of them: it is what all three were trained on, and resampling is the caller's job. */
export const READING_RATE = 16_000;
/** Whisper reads a 30 s window at a time, always: shorter is padded with silence, longer is cut. */
export const WHISPER_SAMPLES = 30 * READING_RATE;
export const WHISPER_FRAMES = 3000;
export const WHISPER_BANDS = 80;
const N_FFT = 400;
const HOP = 160;
const HALF = N_FFT / 2;
const BINS = HALF + 1;
/** What a band is when its power is clipped: the original clips at 1e-10 before the log. */
const CLIPPED = Math.log10(1e-10);

export const READING_MODELS: readonly ReadingModelPlan[] = Object.freeze([
  {
    language: 'pt', input: 'log-mel',
    encoder: 'reading:pt:encoder', decoder: 'reading:pt:decoder', decoderPast: 'reading:pt:decoder:past',
    tokenizer: 'reading:pt:tokenizer', generation: 'reading:pt:generation', config: 'reading:pt:config',
    preprocessor: 'reading:pt:preprocessor',
  },
  {
    language: 'en', input: 'waveform',
    encoder: 'reading:en:encoder', decoder: 'reading:en:decoder',
    tokenizer: 'reading:en:tokenizer', generation: 'reading:en:generation', config: 'reading:en:config',
  },
  {
    language: 'es', input: 'waveform',
    encoder: 'reading:es:encoder', decoder: 'reading:es:decoder', decoderPast: 'reading:es:decoder:past',
    tokenizer: 'reading:es:tokenizer', generation: 'reading:es:generation', config: 'reading:es:config',
  },
]);

/** The model of a language tag (`pt-BR` → pt), or `null` where the project has none — which the caller must SAY, not hide. */
export function readingModelFor(language: string): ReadingModelPlan | null {
  const tag = language.split('-')[0]!.toLowerCase();
  return READING_MODELS.find((m) => m.language === tag) ?? null;
}

/**
 * WHAT WHISPER'S ENCODER EATS: a log-mel spectrogram of 80 bands by 3000 frames, from a 30 s window at 16 kHz.
 *
 * The steps are `WhisperFeatureExtractor`'s, in its order, and each one matters: the window is a PERIODIC Hann (a symmetric one
 * moves every value); the signal is reflected at both ends by half a window, so frame 0 is centred on sample 0; the power
 * spectrum is the magnitude SQUARED; the last frame is dropped, which is why 480 000 samples give 3000 and not 3001; the floor is
 * eight decades below the LOUDEST point of this window, not a constant; and the scale ends in (x + 4) / 4.
 */
export function logMel(samples: Float32Array, melFilters: readonly (readonly number[])[]): Float32Array {
  const audio = new Float32Array(WHISPER_SAMPLES);
  audio.set(samples.subarray(0, WHISPER_SAMPLES));
  // the reflected padding, written once: `at(i)` is the padded signal, so no copy of 480 000 samples is made
  const at = (i: number): number => {
    const j = i - HALF;
    if (j < 0) return audio[-j]!;
    if (j >= WHISPER_SAMPLES) return audio[2 * WHISPER_SAMPLES - j - 2]!;
    return audio[j]!;
  };
  const turns = dftTurns();

  const out = new Float32Array(WHISPER_BANDS * WHISPER_FRAMES);
  const power = new Float64Array(BINS);
  let loudest = -Infinity;
  for (let frame = 0; frame < WHISPER_FRAMES; frame++) {
    const start = frame * HOP;
    // 🎯 A WINDOW OF PURE SILENCE IS ANSWERED, NOT COMPUTED, and it is EXACT: every bin of a window of zeros is zero, so every
    // band is the clipped value. A child reads for a few seconds into a 30 s window, so most frames are this one. It never
    // raises the loudest point: no computed band is ever below the clip, and an all-silent window floors at −∞.
    let quiet = true;
    for (let n = 0; n < N_FFT && quiet; n++) quiet = at(start + n) === 0;
    if (quiet) {
      for (let band = 0; band < WHISPER_BANDS; band++) out[band * WHISPER_FRAMES + frame] = CLIPPED;
      continue;
    }
    powerOf(at, start, turns, power);
    loudest = Math.max(loudest, melOf(power, melFilters, out, frame));
  }
  // the floor is eight decades below the LOUDEST point of this window, not a constant, and the scale ends in (x + 4) / 4
  const floor = loudest - 8;
  for (let i = 0; i < out.length; i++) out[i] = (Math.max(out[i]!, floor) + 4) / 4;
  return out;
}

/** The part of a `config.json` that says how a streaming encoder cuts the wave. */
export interface WaveFrameConfig {
  readonly encoder_config?: { readonly frame_ms?: number; readonly sample_rate?: number };
}

/**
 * THE FRAME A STREAMING ENCODER CUTS THE WAVE INTO, in samples: `frame_ms` at `sample_rate`, from the model's own `config.json`
 * — 5 ms at 16 kHz, 80, for both Moonshines. 1 where the config names no frame: a model without one takes any length.
 */
export function waveFrameOf(config: WaveFrameConfig): number {
  const { frame_ms: ms, sample_rate: rate } = config.encoder_config ?? {};
  return ms && rate ? Math.round((ms * rate) / 1000) : 1;
}

/**
 * WHAT MOONSHINE STREAMING'S ENCODER EATS: the wave in WHOLE FRAMES. Its first node reshapes the samples to `[1, -1, 80]`, and
 * onnxruntime refuses a length that is not a multiple of 80 — 📏 measured on both graphs (issue #185): a microphone hands over
 * blocks of 4096, which make whole frames only five at a time, so most readings failed. The model's own processor pads with
 * zeros on the right to a multiple of 80 (`preprocessor_config.json`: `pad_to_multiple_of`, `padding_side`, `padding_value`),
 * and this is that step: under 5 ms of silence after the child finished, and her wave untouched. An empty recording becomes one
 * frame of silence, because a graph handed nothing does not run; a wave already in whole frames is handed on as it came.
 */
export function inWholeFrames(samples: Float32Array, frame: number): Float32Array {
  const whole = Math.max(1, Math.ceil(samples.length / frame)) * frame;
  if (whole === samples.length) return samples;
  const out = new Float32Array(whole);
  out.set(samples);
  return out;
}

/** A PERIODIC Hann window: a symmetric one moves every value. 400 numbers, computed once. */
const HANN = Float64Array.from({ length: N_FFT }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N_FFT));

/** The cosines and sines of a 400-point real DFT, a row of 400 per bin. */
interface DftTurns { readonly cos: Float64Array; readonly sin: Float64Array }

/**
 * ⚠️ THE TURNS ARE COMPUTED ONCE. A 400-point real DFT for 201 bins is 80 400 sines and cosines per frame, and there are 3000
 * frames: asking `Math.cos` for them each time is a quarter of a billion calls, which on a school machine is not «slower», it is
 * a child waiting half a minute to be told what they read.
 */
function dftTurns(): DftTurns {
  const cos = new Float64Array(BINS * N_FFT);
  const sin = new Float64Array(BINS * N_FFT);
  for (let k = 0; k < BINS; k++) {
    for (let n = 0; n < N_FFT; n++) {
      const angle = (-2 * Math.PI * k * n) / N_FFT;
      cos[k * N_FFT + n] = Math.cos(angle);
      sin[k * N_FFT + n] = Math.sin(angle);
    }
  }
  return { cos, sin };
}

/** One frame's power spectrum: the windowed DFT's magnitude SQUARED, one value per bin. */
function powerOf(at: (i: number) => number, start: number, turns: DftTurns, power: Float64Array): void {
  for (let k = 0; k < BINS; k++) {
    let re = 0, im = 0;
    const row = k * N_FFT;
    for (let n = 0; n < N_FFT; n++) {
      const x = at(start + n) * HANN[n]!;
      re += x * turns.cos[row + n]!;
      im += x * turns.sin[row + n]!;
    }
    power[k] = re * re + im * im;
  }
}

/** One frame's 80 bands, each the power through its mel filter, clipped at 1e-10 BEFORE the log. Answers the frame's loudest. */
function melOf(power: Float64Array, melFilters: readonly (readonly number[])[], out: Float32Array, frame: number): number {
  let loudest = -Infinity;
  for (let band = 0; band < WHISPER_BANDS; band++) {
    const filter = melFilters[band]!;
    let sum = 0;
    for (let k = 0; k < BINS; k++) sum += power[k]! * filter[k]!;
    const value = Math.log10(Math.max(sum, 1e-10));
    out[band * WHISPER_FRAMES + frame] = value;
    if (value > loudest) loudest = value;
  }
  return loudest;
}

/** A `tokenizer.json`, in the parts a reading reads: the vocabulary, the added tokens, and which decoder undoes them. */
export interface TokenizerFile {
  readonly model?: { readonly vocab?: Readonly<Record<string, number>> };
  readonly added_tokens?: readonly { readonly id: number; readonly content: string; readonly special?: boolean }[];
  readonly decoder?: { readonly type?: string };
}

/** id → the piece of text that token stands for, with the special ones (`<|pt|>`, `</s>`…) marked so they never reach a child. */
function piecesOf(tokenizer: TokenizerFile): { readonly text: Map<number, string>; readonly special: ReadonlySet<number> } {
  const text = new Map<number, string>();
  for (const [piece, id] of Object.entries(tokenizer.model?.vocab ?? {})) text.set(id, piece);
  const special = new Set<number>();
  for (const added of tokenizer.added_tokens ?? []) {
    text.set(added.id, added.content);
    // ⚠️ `special` is absent on some files and the mark is what keeps `<|startoftranscript|>` out of a child's sentence, so the
    // shape of the content decides when the flag does not: every one of them is bracketed.
    if (added.special ?? /^<.*>$/.test(added.content)) special.add(added.id);
  }
  return { text, special };
}

/** The bytes GPT-2 writes as themselves: its three printable ranges, inclusive (`bytes_to_unicode`, openai/gpt-2 `encoder.py`). */
const PRINTABLE_RANGES: readonly (readonly [number, number])[] = [[33, 126], [161, 172], [174, 255]];

// GPT-2's byte alphabet: the printable character each byte is written as, so a tokenizer file stays text. Whisper's decoder is
// this one (`ByteLevel`), and reversing it is the whole of it.
const byteOfChar = (() => {
  const map = new Map<string, number>();
  const printable: number[] = [];
  for (const [lo, hi] of PRINTABLE_RANGES) for (let b = lo; b <= hi; b++) printable.push(b);
  for (const b of printable) map.set(String.fromCharCode(b), b);
  let next = 0;
  for (let b = 0; b < 256; b++) {
    if (printable.includes(b)) continue;
    map.set(String.fromCharCode(256 + next), b);
    next++;
  }
  return map;
})();

const BYTE_FALLBACK = /^<0x([0-9A-Fa-f]{2})>$/;

/**
 * WHAT THE CHILD ACTUALLY SAID, from the ids the decoder answered.
 *
 * The two families undo themselves differently and the file says which: Whisper writes every byte as a printable character
 * (`ByteLevel`), Moonshine writes a space as `▁` and a rare byte as `<0x..>` (`Replace` + `ByteFallback` + `Fuse` + `Strip`).
 * Both end in ONE decode of UTF-8, which is what keeps an accent that spans two tokens from becoming two broken characters.
 */
export function readingTextOf(tokenizer: TokenizerFile, ids: readonly number[]): string {
  const { text, special } = piecesOf(tokenizer);
  const byteLevel = tokenizer.decoder?.type === 'ByteLevel';
  const bytes: number[] = [];
  for (const id of ids) {
    if (special.has(id)) continue;
    const piece = text.get(id);
    if (piece === undefined) continue; // an id the vocabulary does not have is not a character: it is dropped, never guessed
    if (byteLevel) {
      for (const ch of piece) bytes.push(byteOfChar.get(ch) ?? ch.charCodeAt(0));
      continue;
    }
    const fallback = BYTE_FALLBACK.exec(piece);
    if (fallback) { bytes.push(parseInt(fallback[1]!, 16)); continue; }
    for (const b of new TextEncoder().encode(piece.replaceAll('▁', ' '))) bytes.push(b);
  }
  const whole = new TextDecoder().decode(Uint8Array.from(bytes));
  return byteLevel ? whole : whole.replace(/^ /, '');
}

/** What a `generation_config.json` says must never be answered — Whisper's list of tokens that are not speech. */
export interface GenerationConfig {
  readonly suppress_tokens?: readonly number[];
  readonly begin_suppress_tokens?: readonly number[];
  readonly eos_token_id?: number;
  readonly decoder_start_token_id?: number;
}

/**
 * The tokens refused at this step. `atStart` is the first answered token, where Whisper also refuses the ones that would make it
 * open with a silence or a punctuation mark — without this it answers «.» to a child who read a whole sentence.
 */
export function suppressedTokens(config: GenerationConfig, atStart: boolean): ReadonlySet<number> {
  const out = new Set<number>(config.suppress_tokens ?? []);
  if (atStart) for (const id of config.begin_suppress_tokens ?? []) out.add(id);
  return out;
}

/** The id of a named token (`<|pt|>`, `<|transcribe|>`), or `null` — a model that does not have it must be SAID, not guessed. */
export function tokenIdOf(tokenizer: TokenizerFile, content: string): number | null {
  for (const added of tokenizer.added_tokens ?? []) if (added.content === content) return added.id;
  const fromVocab = tokenizer.model?.vocab?.[content];
  return fromVocab ?? null;
}

/** The next token: the biggest logit that is not refused. Greedy, because a child reading a known text needs no imagination. */
export function nextToken(logits: ArrayLike<number>, suppressed?: ReadonlySet<number>): number {
  let best = -1, bestValue = -Infinity;
  for (let id = 0; id < logits.length; id++) {
    if (suppressed?.has(id)) continue;
    const value = logits[id]!;
    if (value > bestValue) { bestValue = value; best = id; }
  }
  return best;
}
