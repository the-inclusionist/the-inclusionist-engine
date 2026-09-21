// SPDX-License-Identifier: AGPL-3.0-or-later
// platform/reading-runtime — THE READING, RUN (ADR-0216 §2; issues #185, #200): sound in, the child's words out.
//
// The model of the child's language is opened from the delivery (`pesados/` on the page's own origin, ADR-0177) and run here:
// the encoder once, then the decoder token by token until it says it is done. What each graph is called, what it takes and what
// comes back is not guessed — `scratchpad/leitura-de-referencia-3.py` ran the real files and its trace is what
// `tests/reading-runtime.node.test.js` replays.
//
// THREE FAMILIES, and they differ in ways that matter:
// · Whisper (pt) eats a log-mel spectrogram and opens with four tokens — «transcribe, in Portuguese, without timestamps» — and
//   refuses 88 tokens that are not speech. Without that opening it answers in whatever language it feels like.
// · Moonshine (es) eats the waveform and opens with one token, in two decoder graphs like Whisper's.
// · Moonshine (en) is the same model with ONE MERGED decoder graph, told which pass it is on by `use_cache_branch` and fed empty
//   caches on the first. It is the shape most easily written wrong from a guess, which is why it is traced too.
//
// ⚠️ THE CROSS-ATTENTION CACHE IS COMPUTED ONCE AND NEVER AGAIN. The first pass answers a `present.*.encoder.*` per layer that
// depends only on the sound; feeding back the new one each step is how a loop gets slower with every token AND drifts.

import { atDelivery, loadOnnxRuntime, type OnnxRuntime, type OnnxSession, type OnnxTensor } from './onnx-runtime.js';
import {
  logMel, nextToken, readingModelFor, readingTextOf, suppressedTokens, tokenIdOf, WHISPER_BANDS, WHISPER_FRAMES,
  type GenerationConfig, type ReadingModelPlan, type TokenizerFile,
} from './reading-model.js';

/** What the engine gets back: something that turns samples into words. */
export interface ReadingTranscriber {
  /** 16 kHz mono samples in, the child's words out. Empty when the model answered nothing. */
  transcribe(samples: Float32Array): Promise<string>;
}

export interface ReadingRuntimeDeps {
  /** The page's address, which `pesados/` is resolved against. */
  readonly base: string;
  /** The child's language tag (`pt-BR`). A language the project has no model for is refused BY NAME. */
  readonly language: string;
  readonly fetch?: (url: string) => Promise<Response>;
  /** Injected so a case can replay a real model's numbers without its 378 MiB; the default is the delivery's runtime. */
  readonly ort?: OnnxRuntime;
  readonly importModule?: (url: string) => Promise<unknown>;
  /** A ceiling on the answer, so a model that loops does not hold the microphone for ever. */
  readonly maxTokens?: number;
}

/** What `config.json` says about the caches: how many heads they hold and how wide each one is. */
interface ModelConfig {
  readonly num_key_value_heads?: number;
  readonly num_attention_heads?: number;
  readonly hidden_size?: number;
  readonly decoder_layers?: number;
  readonly num_hidden_layers?: number;
}

const MAX_TOKENS = 200;

export async function loadReadingRuntime(d: ReadingRuntimeDeps): Promise<ReadingTranscriber> {
  const plan = readingModelFor(d.language);
  if (!plan) throw new Error(`reading: the project has no model for ${d.language}`);
  const get = d.fetch ?? ((url: string) => fetch(url));
  const ort = d.ort ?? await loadOnnxRuntime({ base: d.base, importModule: d.importModule });

  const asJson = async <T>(id: string): Promise<T> => {
    const r = await get(atDelivery(id, d.base));
    if (!r.ok) throw new Error(`reading: HTTP ${r.status} for ${id} — the delivery does not carry this language's model`);
    return await r.json() as T;
  };
  const asSession = async (id: string): Promise<OnnxSession> => {
    const r = await get(atDelivery(id, d.base));
    if (!r.ok) throw new Error(`reading: HTTP ${r.status} for ${id} — the delivery does not carry this language's model`);
    return ort.InferenceSession.create(new Uint8Array(await r.arrayBuffer()), { executionProviders: ['wasm'] });
  };

  const [tokenizer, generation, config] = await Promise.all([
    asJson<TokenizerFile>(plan.tokenizer),
    asJson<GenerationConfig>(plan.generation),
    asJson<ModelConfig>(plan.config),
  ]);
  const melFilters = plan.input === 'log-mel' && plan.preprocessor
    ? (await asJson<{ mel_filters: number[][] }>(plan.preprocessor)).mel_filters
    : null;

  const [encoder, decoder, decoderPast] = await Promise.all([
    asSession(plan.encoder),
    asSession(plan.decoder),
    plan.decoderPast ? asSession(plan.decoderPast) : Promise.resolve(null),
  ]);

  const start = openingOf(plan, tokenizer, generation);
  const eos = generation.eos_token_id ?? -1;
  const heads = config.num_key_value_heads ?? config.num_attention_heads ?? 0;
  const width = config.hidden_size && config.num_attention_heads ? config.hidden_size / config.num_attention_heads : 64;
  const ceiling = d.maxTokens ?? MAX_TOKENS;

  return {
    async transcribe(samples: Float32Array): Promise<string> {
      const input: { [name: string]: OnnxTensor } = plan.input === 'log-mel'
        ? { input_features: new ort.Tensor('float32', logMel(samples, melFilters ?? []), [1, WHISPER_BANDS, WHISPER_FRAMES]) }
        : { input_values: new ort.Tensor('float32', samples, [1, samples.length]) };
      const encoded = await encoder.run(input);
      const hidden = encoded[encoder.outputNames[0]!]!;
      const frames = (hidden as { dims?: readonly number[] }).dims?.[1] ?? 0;

      // the merged graph wants the caches present and EMPTY on the first pass, and the flag that says which pass this is
      const merged = !decoderPast;
      const past: Record<string, unknown> = {};
      const ids: number[] = [];
      let answered: Record<string, unknown> = {};
      for (let step = 0; step < ceiling; step++) {
        const first = step === 0;
        const session = first || merged ? decoder : decoderPast!;
        const inputIds = first ? start : [ids[ids.length - 1]!];
        const inputs: Record<string, unknown> = {
          input_ids: new ort.Tensor('int64', BigInt64Array.from(inputIds, BigInt), [1, inputIds.length]),
          encoder_hidden_states: hidden,
          ...(first && merged ? emptyCaches(ort, session, heads, width, frames) : past),
        };
        if (merged) inputs.use_cache_branch = new ort.Tensor('bool', Uint8Array.of(first ? 0 : 1), [1]);
        answered = await session.run(inputs as never) as Record<string, unknown>;

        for (const name of session.outputNames) {
          if (!name.startsWith('present.')) continue;
          const key = name.replace('present.', 'past_key_values.');
          // ⚠️ ONLY the self-attention half grows. The cross-attention half is the sound, and the sound does not change.
          if (first || name.includes('.decoder.')) past[key] = answered[name];
        }

        const logits = lastLogits(answered[session.outputNames[0]!]);
        const chosen = nextToken(logits, suppressedTokens(generation, first));
        if (chosen < 0 || chosen === eos) break;
        ids.push(chosen);
      }
      return readingTextOf(tokenizer, ids).trim();
    },
  };
}

/**
 * HOW THE DECODER IS TOLD WHAT TO DO. Moonshine opens with one token and reads what it hears. Whisper opens with four, and they
 * are an instruction: transcribe (not translate), in THIS language, without timestamps. 📏 Measured: without them it answers in
 * whatever language it decides, and with `<|translate|>` it answers in English — a child reading Portuguese would be corrected
 * against an English transcript.
 */
function openingOf(plan: ReadingModelPlan, tokenizer: TokenizerFile, generation: GenerationConfig): readonly number[] {
  const first = generation.decoder_start_token_id ?? 0;
  if (plan.input !== 'log-mel') return [first];
  const named = [`<|${plan.language}|>`, '<|transcribe|>', '<|notimestamps|>'].map((c) => tokenIdOf(tokenizer, c));
  if (named.some((id) => id === null)) throw new Error(`reading: this model has no token for ${plan.language} transcription`);
  return [first, ...named as number[]];
}

/** The caches a merged decoder wants on its first pass: the self-attention halves empty, the cross-attention ones the sound's. */
function emptyCaches(ort: OnnxRuntime, session: OnnxSession, heads: number, width: number, frames: number): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const name of session.inputNames ?? []) {
    if (!name.startsWith('past_key_values.')) continue;
    const length = name.includes('.decoder.') ? 0 : frames;
    out[name] = new ort.Tensor('float32', new Float32Array(heads * length * width), [1, heads, length, width]);
  }
  return out;
}

/** The logits of the LAST position: the decoder answers one row per token it was given, and only the newest one is a choice. */
function lastLogits(tensor: unknown): Float32Array {
  const t = tensor as { data: Float32Array; dims?: readonly number[] };
  const vocab = t.dims?.[2] ?? t.data.length;
  return t.data.subarray(t.data.length - vocab) as Float32Array;
}
