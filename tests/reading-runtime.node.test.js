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
import { atDelivery } from '../app/js/platform/onnx-runtime.js';
import { READING_MODELS, logMel, WHISPER_BANDS, WHISPER_FRAMES } from '../app/js/platform/reading-model.js';

const trace = JSON.parse(readFileSync('tests/fixtures/reading-trace.json', 'utf8'));
const truth = JSON.parse(readFileSync('tests/fixtures/reading-ground-truth.json', 'utf8'));

/** The files a language's model needs, answered from the fixture instead of from 378 MiB on a school's link. */
function ficheiros(lingua, { config, generation } = {}) {
  const caso = trace.languages[lingua];
  const plano = READING_MODELS.find((m) => m.language === lingua);
  const tokenizer = { model: { vocab: {} }, added_tokens: [], decoder: { type: caso.tokenizerDecoder } };
  for (const [id, piece] of Object.entries(caso.pieces)) tokenizer.model.vocab[piece] = Number(id);
  for (const [id, content] of Object.entries(caso.specials ?? {})) tokenizer.added_tokens.push({ id: Number(id), content, special: true });
  return {
    [plano.tokenizer]: tokenizer,
    [plano.generation]: generation ?? caso.generation,
    [plano.config]: config ?? caso.config,
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
  // a graph that broke numerically answers NaN everywhere, and NaN is never bigger than anything: no token can be chosen
  if (passo.broken) return new Float32Array(vocab).fill(NaN);
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
        declared: inputNames,
        inputs: Object.keys(inputs),
        // what the encoder is handed, whole: the name, the shape and the numbers are all the model has of the sound
        sound: nome === 'encoder'
          ? Object.values(inputs).map((t) => ({ type: t.type, dims: [...t.dims], data: t.data }))[0]
          : null,
        ids: inputs.input_ids ? [...inputs.input_ids.data].map(Number) : null,
        cacheBranch: inputs.use_cache_branch ? inputs.use_cache_branch.data[0] : null,
        pastLengths: Object.fromEntries(Object.entries(inputs)
          .filter(([k]) => k.startsWith('past_key_values.'))
          .map(([k, v]) => [k, v.dims[2]])),
        pastDims: Object.fromEntries(Object.entries(inputs)
          .filter(([k]) => k.startsWith('past_key_values.'))
          .map(([k, v]) => [k, [...v.dims]])),
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
          // the two families' encoders take different things, named as the real graphs name them (the trace read them)
          if (id.includes('encoder')) {
            return sessao('encoder', ['last_hidden_state'], [lingua === 'pt' ? 'input_features' : 'input_values']);
          }
          if (id.includes('past')) return sessao('decoderPast', decoderOutputs, ['input_ids', 'encoder_hidden_states', ...pastNames]);
          return sessao('decoder', decoderOutputs, ['input_ids', 'encoder_hidden_states', ...pastNames, 'use_cache_branch']);
        },
      },
    },
  };
}

/**
 * The delivery: a JSON file answers from the fixture, a model file answers with its own id, so the fake session knows which it is.
 * ⚠️ BY THE WHOLE ADDRESS. Matched by a piece of the name, `…/preprocessor_config.json` contains `config` and was answered with the
 * model's `config.json` — so the engine got no mel filters, and the replay's silent second could not notice.
 */
function entregaDe(lingua, base, trocas) {
  const porEndereco = new Map(Object.entries(ficheiros(lingua, trocas)).map(([id, corpo]) => [atDelivery(id, base), corpo]));
  const pedidos = [];
  return {
    pedidos,
    fetch: async (url) => {
      pedidos.push(url);
      if (porEndereco.has(url)) return { ok: true, status: 200, json: async () => porEndereco.get(url) };
      return { ok: true, status: 200, arrayBuffer: async () => new TextEncoder().encode(url).buffer };
    },
  };
}

async function ouvir(lingua, opcoes = {}) {
  const { ort, chamadas } = ortFalso(lingua, opcoes);
  const base = 'https://escola.exemplo/jogo/';
  const { fetch, pedidos } = entregaDe(lingua, base, { config: opcoes.config, generation: opcoes.generation });
  const runtime = await loadReadingRuntime({ base, language: lingua, fetch, ort, ...opcoes });
  const texto = await runtime.transcribe(opcoes.samples ?? new Float32Array(16_000));
  return { texto, chamadas, pedidos };
}

/** One second of a 440 Hz tone: not silence, so the mel filters change what the encoder sees (silence answers the same always). */
const tom = () => Float32Array.from({ length: 16_000 }, (_, i) => 0.3 * Math.sin((2 * Math.PI * 440 * i) / 16_000));

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

  /**
   * 🔴 WHAT THE ENCODER HEARS. Whisper eats a log-mel picture of 30 s (80 bands × 3000 frames), Moonshine eats the wave itself.
   * The replay above cannot see this: its encoder answers the same hidden states whatever it is handed, so a Whisper fed the raw
   * wave, or a Moonshine fed one sample short, would still «transcribe» the recording. A real session refuses a name it does not
   * declare, and a real model hears a different sound — in a school, at the child.
   */
  it('🔴 [Right] Whisper hears the log-mel picture, 80 bands by 3000 frames', async () => {
    const { chamadas } = await ouvir('pt');
    const som = chamadas.find((c) => c.graph === 'encoder');
    expect(som.inputs, 'Whisper was not handed a spectrogram').toEqual(['input_features']);
    expect(som.sound.dims).toEqual([1, WHISPER_BANDS, WHISPER_FRAMES]);
  });

  it('🔴 [Right] Moonshine hears the wave itself, every sample of it', async () => {
    const samples = tom();
    for (const lingua of ['es', 'en']) {
      const { chamadas } = await ouvir(lingua, { samples });
      const som = chamadas.find((c) => c.graph === 'encoder');
      expect(som.inputs, `${lingua}: Moonshine was not handed the wave`).toEqual(['input_values']);
      expect(som.sound.dims, lingua).toEqual([1, 16_000]);
      expect([...som.sound.data], `${lingua}: the wave reached the encoder changed`).toEqual([...samples]);
    }
  });

  it('🔴 [Right] and Whisper\'s picture is drawn with the mel filters the model ships, not with none', async () => {
    // 📌 The filters come from `preprocessor_config.json` and are the model's own ear. A TONE and not silence, because silence is
    // answered without reading the filters at all (every bin of zeros is zero) — the replay's silent second could not tell.
    const samples = tom();
    const esperado = logMel(samples, filtros());
    expect(esperado.some((v) => v !== esperado[0]), 'the tone drew a flat picture: the case measures nothing').toBe(true);
    const { chamadas } = await ouvir('pt', { samples });
    const visto = chamadas.find((c) => c.graph === 'encoder').sound.data;
    let diferentes = 0;
    for (let i = 0; i < esperado.length; i++) if (visto[i] !== esperado[i]) diferentes++;
    expect(diferentes, 'the encoder saw a picture the model\'s own filters do not draw').toBe(0);
  });

  it('🔴 [Right] every graph is handed only the names it declares — the answer\'s logits never come back as a cache', async () => {
    // A decoder answers `logits` beside its `present.*` caches; only the caches are fed back, renamed. Anything else handed to
    // a real session is refused by name, and the child's reading stops at the second token.
    for (const lingua of ['pt', 'es', 'en']) {
      const { chamadas } = await ouvir(lingua);
      for (const c of chamadas) {
        const alheios = c.inputs.filter((n) => !c.declared.includes(n));
        expect(alheios, `${lingua}: ${c.graph} was handed names it does not take`).toEqual([]);
      }
    }
  });

  it('🔴 [Zero] a step that can choose NOTHING ends the answer, and nothing after it is heard', async () => {
    // A graph that breaks numerically answers NaN, and NaN is never the biggest logit: no token is chosen. Pushing that «no
    // token» as if it were one would ask the decoder again with an id the vocabulary does not have.
    // the words the model really chose at its first two steps, so the text is one the tokenizer knows
    const caso = trace.languages.es;
    const [primeira, segunda] = caso.steps.map((s) => s.chosen);
    const peça = caso.pieces[primeira];
    const { texto, chamadas } = await ouvir('es', {
      steps: [
        { top: [[primeira, 9]] },
        { broken: true },
        { top: [[segunda, 9]] },
      ],
    });
    expect(chamadas.filter((c) => c.graph !== 'encoder'), 'the decoder was asked again after choosing nothing').toHaveLength(2);
    expect(texto).toBe(peça.replaceAll('▁', ' ').trim());
  });

  /**
   * 🔴 THE SIZE OF THE CACHES A MERGED DECODER IS HANDED EMPTY. They are `[1, heads, length, width]`, where the heads are the
   * KEY-VALUE heads (a model with grouped attention keeps fewer than it attends with) and the width is `hidden_size / heads`.
   * ⚠️ The traced English config (8 heads, 512 wide) gives a width of 64, which is also the fallback — so the real numbers could
   * not tell the rule from its default. These configs are made here for that reason; a real session refuses a wrong shape.
   */
  it('🔴 [Right] a merged decoder\'s empty caches have the shape its config names: key-value heads, hidden ÷ heads', async () => {
    const { chamadas } = await ouvir('en', { config: { num_key_value_heads: 2, num_attention_heads: 8, hidden_size: 320 } });
    const primeira = chamadas.find((c) => c.graph === 'decoder');
    expect(primeira.pastDims['past_key_values.0.decoder.key'], 'the self-attention cache').toEqual([1, 2, 0, 40]);
    expect(primeira.pastDims['past_key_values.0.encoder.key'], 'the sound\'s cache').toEqual([1, 2, 750, 40]);
  });

  it('📌 [Boundary] a config that names no key-value heads and no width: the attention heads, and 64 wide', async () => {
    const { chamadas } = await ouvir('en', { config: { num_attention_heads: 4 } });
    const primeira = chamadas.find((c) => c.graph === 'decoder');
    expect(primeira.pastDims['past_key_values.0.encoder.key']).toEqual([1, 4, 750, 64]);
  });

  it('📌 [Boundary] a generation config that names no end has no end token: id 0 is a word like any other', async () => {
    const caso = trace.languages.es;
    const primeira = caso.steps[0].chosen;
    const { chamadas } = await ouvir('es', {
      generation: { decoder_start_token_id: caso.generation.decoder_start_token_id },
      steps: [{ top: [[0, 9]] }, { top: [[primeira, 9]] }, { broken: true }],
    });
    expect(chamadas.filter((c) => c.graph !== 'encoder'), 'the answer ended at a token no config called the end').toHaveLength(3);
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
//
// PROBED AGAIN (2026-09-23), seventeen decisions of `transcribe` disabled one at a time — `scratchpad/sonda-reading.py`. Five
// were green, and all five were about what the replay could not see:
//   · Whisper handed the wave instead of the spectrogram → «Whisper hears the log-mel picture» (and «every graph is handed only
//                                                          the names it declares»: the fake encoders now declare their real input)
//   · Moonshine handed the wave one sample short       → «Moonshine hears the wave itself, every sample of it»
//   · the mel filters dropped                          → «…drawn with the mel filters the model ships». 🔴 The fixture had never
//                                                          delivered them: its fetch matched addresses by a PIECE of the name,
//                                                          and `preprocessor_config.json` contains `config`. The silent second hid
//                                                          it, because silence is answered without reading any filter.
//   · the decoder's `logits` fed back as a cache       → «every graph is handed only the names it declares»
//   · a step that chooses nothing pushed as a token    → «a step that can choose NOTHING ends the answer»
// 17 of 17 red with them.
//
// And the loader's own ten — `scratchpad/sonda-reading-carga.py`. Five were green, three of them the cache size of a merged
// decoder (the traced config's width, 64, is also the fallback) and one the missing end token; 8 of 10 red with the cases above.
// The other two are EQUIVALENT BY THE CATALOGUE, and declared rather than caught: the mel filters are fetched when the model eats
// log-mel AND ships a preprocessor, and dropping either half changes nothing today — the one log-mel model ships one, and the
// two that eat the wave ship none.
