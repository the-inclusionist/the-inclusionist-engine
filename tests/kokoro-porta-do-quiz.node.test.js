// SPDX-License-Identifier: AGPL-3.0-or-later
// THE QUIZ DEMO'S KOKORO PORT (ADR-0198 §5 and erratum; issue #181): the files come from the delivery, the sentence reaches espeak-ng
// as a file, one copy of the model serves every session, and the model's three inputs have the shapes Kokoro reads.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect } from 'vitest';
import { criarPortaKokoro } from '../app/js/consumer-quiz/kokoro-porta.ts';
import { URL_DO_MODELO_KOKORO, URL_DO_TOKENIZADOR_KOKORO, urlDaVozKokoro } from '../app/js/platform/kokoro.js';
import { caminhoNaEntrega } from '../app/js/platform/pesados.js';

const BASE = 'https://escola.example/jogo/quiz.html';

function portaFalsa({ status = 200 } = {}) {
  const registo = { pedidos: [], execucoes: [], ficheiros: {}, sessoes: [], entradas: [] };
  const corpos = {
    [URL_DO_TOKENIZADOR_KOKORO]: () => new Response(JSON.stringify({ model: { vocab: { a: 1, b: 2 } } })),
    [URL_DO_MODELO_KOKORO]: () => new Response(new Uint8Array([9, 9, 9])),
    [urlDaVozKokoro('pf_dora')]: () => new Response(new Float32Array([0.5, -0.25]).buffer),
  };
  const buscar = async (url) => {
    registo.pedidos.push(url);
    if (status !== 200) return new Response('', { status });
    const upstream = Object.keys(corpos).find((u) => new URL(caminhoNaEntrega(u), BASE).href === url);
    return upstream ? corpos[upstream]() : new Response('', { status: 404 });
  };
  const espeak = async (opcoes) => {
    const FS = { writeFile: (c, t) => { registo.ficheiros[c] = t; }, readFile: () => 'pˈuli\n a pˈɛdɾɐ\n' };
    for (const f of opcoes.preRun) f({ FS });
    registo.execucoes.push([...opcoes.arguments]);
    return { FS };
  };
  class Tensor { constructor(tipo, dados, forma) { Object.assign(this, { tipo, dados, forma }); } }
  const ort = {
    Tensor,
    InferenceSession: {
      create: async (modelo, opcoes) => {
        registo.sessoes.push([modelo, opcoes.executionProviders]);
        return { outputNames: ['waveform'], run: async (e) => { registo.entradas.push(e); return { waveform: { data: Float32Array.of(0.1, 0.2) } }; } };
      },
    },
  };
  return { registo, porta: criarPortaKokoro({ espeak, ort, buscar, base: BASE }) };
}

describe('the files come from the delivery', () => {
  it('🔴 [Right] the tokenizer, the voice and the model are asked at pesados/ on the page\'s origin', async () => {
    const { registo, porta } = portaFalsa();
    expect(await porta.vocabulario()).toEqual({ a: 1, b: 2 });
    expect([...(await porta.voz('pf_dora'))]).toEqual([0.5, -0.25]);
    await porta.sessao('wasm');
    expect(registo.pedidos).toEqual([URL_DO_TOKENIZADOR_KOKORO, urlDaVozKokoro('pf_dora'), URL_DO_MODELO_KOKORO]
      .map((u) => `https://escola.example/jogo/${caminhoNaEntrega(u)}`));
  });

  it('⚠️ [Boundary] a file the delivery lacks fails naming its path and the flag that puts it there', async () => {
    const { porta } = portaFalsa({ status: 404 });
    await expect(porta.voz('pf_dora')).rejects.toThrow(/HTTP 404 for pesados\/huggingface\.co\/.*pf_dora\.bin.*--kokoro/);
  });

  it('🔴 [Right] one copy of the 325 MB model serves the WebGPU try and the WASM fallback', async () => {
    const { registo, porta } = portaFalsa();
    await porta.sessao('webgpu');
    await porta.sessao('wasm');
    expect(registo.pedidos.filter((u) => u.endsWith('model.onnx')).length, 'the model was fetched twice').toBe(1);
    expect(registo.sessoes.map((s) => s[1])).toEqual([['webgpu'], ['wasm']]);
    expect(registo.sessoes[0][0]).toBe(registo.sessoes[1][0]);
  });
});

describe('espeak-ng reads the sentence from a file', () => {
  it('🎯 [Zero] a sentence that looks like options never becomes an argument', async () => {
    const { registo, porta } = portaFalsa();
    const frase = '-v en --help\nPule';
    const fonemas = await porta.fonemizar(frase, 'pt-br');
    const args = registo.execucoes[0];
    expect(args.some((a) => a.includes('--help') || a.includes('Pule')), 'the sentence reached the command line').toBe(false);
    expect(args.slice(args.indexOf('-v'), args.indexOf('-v') + 2)).toEqual(['-v', 'pt-br']);
    expect(registo.ficheiros[args[args.indexOf('-f') + 1]]).toBe('-v en --help Pule');
    expect(fonemas).toBe('pˈuli a pˈɛdɾɐ');
  });
});

describe('the model\'s inputs', () => {
  it('🔴 [Right] ids as int64 [1, n], the style row as float32 [1, 256], speed 1 — and the first output comes back', async () => {
    const { registo, porta } = portaFalsa();
    const sessao = await porta.sessao('wasm');
    const onda = await sessao.sintetizar([0, 1, 2, 0], new Float32Array(256).fill(0.5));
    const e = registo.entradas[0];
    expect([e.input_ids.tipo, e.input_ids.forma, [...e.input_ids.dados]]).toEqual(['int64', [1, 4], [0n, 1n, 2n, 0n]]);
    expect([e.style.tipo, e.style.forma, e.speed.forma, [...e.speed.dados]]).toEqual(['float32', [1, 256], [1], [1]]);
    expect([...onda].map((x) => +x.toFixed(2))).toEqual([0.1, 0.2]);
  });
});

// ============================== MUTATIONS CHECKED ==============================
//   QK1 the upstream address asked instead of the delivery    🔴 pesados/ on the page's origin
//   QK2 the model fetched per session                          🔴 one copy of the model
//   QK3 the sentence passed as an argument                     🔴 never an argument
//   QK4 the style shaped [256]                                 🔴 the model's inputs
//   QK5 the device ignored (always wasm)                       🔴 one copy of the model (providers)
