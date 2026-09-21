// SPDX-License-Identifier: AGPL-3.0-or-later
// THE READING LOOP, REPLAYING THE REAL MODELS (ADR-0216 §2; issues #185, #200).
//
// 🎯 THE NUMBERS HERE CAME OUT OF THE REAL GRAPHS. `scratchpad/leitura-de-referencia-3.py` opened Whisper small and the two
// Moonshines with onnxruntime, decoded two recordings and wrote every step down: the ids the decoder was given, the top logits it
// answered and the token it chose. This case replays those logits through the engine's loop and demands the SAME words —
// « Menos Configurações de inclusão Acessibilidade visual Voltar Voltar Voltar ao jogo» for the Portuguese one, «Salta la piedra
// y toma la estrella buen trabajo.» for the Spanish. 📏 Both are what the models really answered, so the recipe — the forced
// opening, the suppressed tokens, the cache threading, the merged branch — is measured and not assumed.
//
// ⚠️ WITHOUT THE REPLAY THIS LOOP IS UNTESTABLE HERE: running it for real means 378 MiB of model and a wasm engine in the suite.
// What the replay CANNOT see is whether the tensors would be accepted by a real session — that is the rodada in `dist`.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { loadReadingRuntime } from '../app/js/platform/reading-runtime.js';
import { READING_MODELS } from '../app/js/platform/reading-model.js';

const trace = JSON.parse(readFileSync('tests/fixtures/reading-trace.json', 'utf8'));
const truth = JSON.parse(readFileSync('tests/fixtures/reading-ground-truth.json', 'utf8'));

/** The files a language's model needs, answered from the fixture instead of from 378 MiB on a school's link. */
function ficheiros(lingua) {
  const caso = trace.languages[lingua];
  const plano = READING_MODELS.find((m) => m.language === lingua);
  const tokenizer = { model: { vocab: {} }, added_tokens: [], decoder: { type: caso.tokenizerDecoder } };
  for (const [id, piece] of Object.entries(caso.pieces)) tokenizer.model.vocab[piece] = Number(id);
  for (const [id, content] of Object.entries(caso.specials ?? {})) tokenizer.added_tokens.push({ id: Number(id), content, special: true });
  return {
    [plano.tokenizer]: tokenizer,
    [plano.generation]: caso.generation,
    [plano.config]: caso.config,
    ...(plano.preprocessor ? { [plano.preprocessor]: { mel_filters: filtros() } } : {}),
  };
}

let filtrosEmCache = null;
const filtros = () => {
  if (!filtrosEmCache) {
    const [bands, bins] = truth.melFilters.shape;
    const flat = new Float32Array(Buffer.from(truth.melFilters.base64, 'base64').buffer.slice(0));
    filtrosEmCache = Array.from({ length: bands }, (_, b) => Array.from(flat.subarray(b * bins, (b + 1) * bins)));
  }
  return filtrosEmCache;
};

/** A logits row rebuilt from the top the trace kept: everything else is −20, which no top token ever is. */
function logitsDe(passo, vocab) {
  const row = new Float32Array(vocab).fill(-20);
  for (const [id, value] of passo.top) row[id] = value;
  return row;
}

/**
 * An onnxruntime that runs nothing: it answers each decoder call with the logits the real one answered at that step, and writes
 * down what it was asked. The caches it returns are named as the real graphs name them, so the threading is exercised.
 */
function ortFalso(lingua, { vocab = 60_000, encoderFrames = 750, steps } = {}) {
  const caso = { ...trace.languages[lingua], ...(steps ? { steps } : {}) };
  const chamadas = [];
  let passo = 0;
  const tensor = (type, data, dims) => ({ type, data, dims });
  const sessao = (nome, outputNames, inputNames) => ({
    inputNames,
    outputNames,
    async run(inputs) {
      chamadas.push({
        graph: nome,
        inputs: Object.keys(inputs),
        ids: inputs.input_ids ? [...inputs.input_ids.data].map(Number) : null,
        cacheBranch: inputs.use_cache_branch ? inputs.use_cache_branch.data[0] : null,
        pastLengths: Object.fromEntries(Object.entries(inputs)
          .filter(([k]) => k.startsWith('past_key_values.'))
          .map(([k, v]) => [k, v.dims[2]])),
      });
      if (nome === 'encoder') return { last_hidden_state: tensor('float32', new Float32Array(4), [1, encoderFrames, 620]) };
      const p = caso.steps[passo++];
      const out = { logits: tensor('float32', logitsDe(p, vocab), [1, 1, vocab]) };
      // the two halves of the cache, as the graphs name them: the self-attention one grows, the cross-attention one does not
      for (let layer = 0; layer < 2; layer++) {
        out[`present.${layer}.decoder.key`] = tensor('float32', new Float32Array(1), [1, 8, passo, 64]);
        out[`present.${layer}.encoder.key`] = tensor('float32', new Float32Array(1), [1, 8, encoderFrames, 64]);
      }
      return out;
    },
  });
  const pastNames = ['past_key_values.0.decoder.key', 'past_key_values.0.encoder.key',
    'past_key_values.1.decoder.key', 'past_key_values.1.encoder.key'];
  const decoderOutputs = ['logits', 'present.0.decoder.key', 'present.0.encoder.key', 'present.1.decoder.key', 'present.1.encoder.key'];
  return {
    chamadas,
    ort: {
      Tensor: function Tensor(type, data, dims) { return tensor(type, data, dims); },
      InferenceSession: {
        create: async (bytes) => {
          const id = new TextDecoder().decode(bytes);
          if (id.includes('encoder')) return sessao('encoder', ['last_hidden_state'], ['input_features']);
          if (id.includes('past')) return sessao('decoderPast', decoderOutputs, ['input_ids', 'encoder_hidden_states', ...pastNames]);
          return sessao('decoder', decoderOutputs, ['input_ids', 'encoder_hidden_states', ...pastNames, 'use_cache_branch']);
        },
      },
    },
  };
}

/** The delivery: a JSON file answers from the fixture, a model file answers with its own id, so the fake session knows which it is. */
function entregaDe(lingua) {
  const json = ficheiros(lingua);
  const pedidos = [];
  return {
    pedidos,
    fetch: async (url) => {
      pedidos.push(url);
      const id = Object.keys(json).find((k) => url.includes(k.split(':').slice(1).join('/')) || url.includes(nomeDoFicheiro(k)));
      if (id) return { ok: true, status: 200, json: async () => json[id] };
      return { ok: true, status: 200, arrayBuffer: async () => new TextEncoder().encode(url).buffer };
    },
  };
}
const nomeDoFicheiro = (id) => id.split(':').pop();

async function ouvir(lingua, opcoes = {}) {
  const { ort, chamadas } = ortFalso(lingua, opcoes);
  const { fetch, pedidos } = entregaDe(lingua);
  const runtime = await loadReadingRuntime({ base: 'https://escola.exemplo/jogo/', language: lingua, fetch, ort, ...opcoes });
  const texto = await runtime.transcribe(new Float32Array(16_000));
  return { texto, chamadas, pedidos };
}

describe('the reading loop, on the real models\' numbers', () => {
  for (const lingua of ['pt', 'es', 'en']) {
    it(`🔴 [Right] ${lingua}: the same words the model itself answered`, async () => {
      const { texto } = await ouvir(lingua);
      expect(texto).toBe(trace.languages[lingua].text.trim());
    });
  }

  it('🔴 [Right] Whisper is TOLD what to do: transcribe, in the child\'s language, without timestamps', async () => {
    // ⚠️ Without this opening the model answers in a language of its choosing, and with `<|translate|>` it answers in English:
    // a child reading Portuguese would be corrected against an English transcript.
    const { chamadas } = await ouvir('pt');
    const primeira = chamadas.find((c) => c.graph !== 'encoder');
    expect(primeira.ids, 'the opening is not the one the reference measured').toEqual(trace.languages.pt.start);
    expect(primeira.ids.length, 'Moonshine opens with one token; Whisper with four').toBe(4);
  });

  it('🔴 [Right] and the other two open with the one token their own config names', async () => {
    for (const lingua of ['es', 'en']) {
      const { chamadas } = await ouvir(lingua);
      expect(chamadas.find((c) => c.graph !== 'encoder').ids, lingua).toEqual(trace.languages[lingua].start);
    }
  });

  it('🔴 [Right] the sound is encoded ONCE, and every later step gives the decoder one token', async () => {
    const { chamadas } = await ouvir('pt');
    expect(chamadas.filter((c) => c.graph === 'encoder'), 'the encoder ran more than once: 30 s of sound, every token').toHaveLength(1);
    const depois = chamadas.filter((c) => c.graph === 'decoderPast');
    expect(depois.length).toBeGreaterThan(3);
    for (const c of depois) expect(c.ids.length, 'a step gave the decoder more than the newest token').toBe(1);
  });

  it('🔴 [Right] the self-attention cache GROWS and the cross-attention one does not', async () => {
    // 📌 The cross-attention cache is the sound, and the sound does not change. Feeding the new one back each step makes the
    // loop slower with every token and moves what it answers.
    const { chamadas } = await ouvir('pt');
    const comPassado = chamadas.filter((c) => c.graph === 'decoderPast');
    const proprias = comPassado.map((c) => c.pastLengths['past_key_values.0.decoder.key']);
    const doSom = comPassado.map((c) => c.pastLengths['past_key_values.0.encoder.key']);
    expect(proprias, 'the decoder\'s own cache did not grow by one per step').toEqual(proprias.map((_, i) => i + 1));
    expect(new Set(doSom).size, 'the cross-attention cache changed, and the sound did not').toBe(1);
  });

  it('🔴 [Right] a merged decoder is told which pass it is on, and gets empty caches on the first', async () => {
    // The English model has ONE decoder graph for both passes: `use_cache_branch` is how it knows, and the caches must be
    // there and empty — a graph that is handed nothing simply fails to run, in a school, at the child.
    const { chamadas } = await ouvir('en');
    const passes = chamadas.filter((c) => c.graph === 'decoder');
    expect(passes[0].cacheBranch, 'the first pass said it had a cache').toBe(0);
    expect(passes[1].cacheBranch, 'the second pass said it had none').toBe(1);
    expect(passes[0].pastLengths['past_key_values.0.decoder.key'], 'the first pass was given a cache that is not empty').toBe(0);
    expect(passes[0].pastLengths['past_key_values.0.encoder.key'], 'the sound\'s cache must be the sound\'s length').toBe(750);
  });

  /**
   * 🔴 THE 88 TOKENS WHISPER REFUSES. Its `generation_config` lists what is not speech, and two more that must never OPEN an
   * answer — a lone space and the end-of-text, which is how it answers «.» to a child who read a whole sentence.
   *
   * ⚠️ The recording in the trace never needed them: at every one of its 22 steps the model's own best token was already an
   * allowed one, so the replay alone cannot tell a loop that suppresses from one that does not. These two steps are made here,
   * with a refused token on top, because that is the case the recording does not contain.
   */
  it('🔴 [Right] a refused token never becomes a word, at the first step or at any other', async () => {
    const caso = trace.languages.pt;
    const [idDaPeça, peça] = Object.entries(caso.pieces)[0];
    const doComeço = caso.generation.begin_suppress_tokens[0];
    const sempre = caso.generation.suppress_tokens[0];
    const { texto } = await ouvir('pt', {
      steps: [
        { top: [[doComeço, 9], [Number(idDaPeça), 8]] },   // the model's best is refused AT THE START
        { top: [[sempre, 9], [caso.eos, 8]] },             // and here one that is refused always
      ],
    });
    expect(texto, `the refused token ${doComeço} or ${sempre} reached the child`).toBe(peça.replaceAll('Ġ', ' ').trim());
  });

  it('🔴 [Zero] a language the project has no model for is REFUSED by name, never half-answered', async () => {
    await expect(loadReadingRuntime({ base: 'https://escola.exemplo/', language: 'fr-FR' })).rejects.toThrow(/fr-FR/);
  });

  it('⚠️ [Error] a delivery without this language says WHICH file is missing', async () => {
    const { ort } = ortFalso('pt');
    const semFicheiro = async () => ({ ok: false, status: 404 });
    await expect(loadReadingRuntime({ base: 'https://escola.exemplo/', language: 'pt', fetch: semFicheiro, ort }))
      .rejects.toThrow(/reading:pt:/);
  });

  it('📌 [Boundary] a model that never stops is cut, and what it said so far is what the child gets', async () => {
    const { texto } = await ouvir('es', { maxTokens: 3 });
    expect(texto.length, 'the ceiling answered nothing at all').toBeGreaterThan(0);
    expect(texto.length).toBeLessThan(trace.languages.es.text.trim().length);
  });
});

// MUTATIONS CHECKED (2026-09-21) — `scratchpad/mutar-reading-runtime.py`:
//   · the opening reduced to the start token         → «Whisper is TOLD what to do»
//   · `<|translate|>` in place of `<|transcribe|>`    → same
//   · the suppressed tokens ignored                   → «a refused token never becomes a word» (the replay alone SURVIVED it:
//                                                       the recording never needed them, which is why that case is made by hand)
//   · the self-attention cache NOT fed back           → «the self-attention cache GROWS…»
//   · the cross-attention cache fed back each step    → 📏 EQUIVALENT, and measured rather than assumed
//                                                       (`scratchpad/cache-cruzado-muda.py`): the with-past graph answers with
//                                                       all 24 cross-attention caches BYTE-IDENTICAL to the ones it was handed,
//                                                       while all 24 self-attention ones grow. So feeding the new ones back
//                                                       changes no word — it only copies ~110 MB per token on a school machine,
//                                                       which is why the line stays and why no case is invented to «catch» it.
//   · the whole sequence given to the decoder again   → «every later step gives the decoder one token»
//   · the encoder run per token                       → «the sound is encoded ONCE»
//   · `use_cache_branch` always true                  → «a merged decoder is told which pass it is on»
//   · the empty caches given the sound's length       → same
//   · the ceiling ignored                             → «a model that never stops is cut»
//   · a missing file read as an empty one             → «a delivery without this language says WHICH file is missing»
