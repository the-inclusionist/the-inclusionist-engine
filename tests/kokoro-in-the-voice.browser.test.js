// SPDX-License-Identifier: AGPL-3.0-or-later
// KOKORO SPEAKS, AND THE ENGINE LOADS IT (ADR-0216 §1; issues #181, #200): the voices of the language listed, marked by quality, and a
// voice picked speaks on WebGPU only where a test synthesis is speech — WASM otherwise. The game says only that it wants a neural
// voice; the loader that would read the delivery is replaced here, because this case has no wasm engine.
//
// 📏 Why the test synthesis: on 2026-09-14 WebGPU on an AMD gcn-5 ran Kokoro and returned samples up to 2×10⁷ — noise.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { createTts } from '../app/js/platform/tts.js';
import { createTranslator } from '../app/js/core/i18n.js';
import { createStorage, memoryBackend } from '../app/js/platform/storage.js';
import { SEM_ASSUNTO } from './fixtures/accommodation-answers.js';

const tom = (n = 24000) => Float32Array.from({ length: n }, (_, i) => Math.sin(i / 8) * 0.4);
const ruido = () => { const o = tom(2400); o[9] = -20_561_670; return o; };

// The engine's own loader, for the case that goes through `createGame` and so cannot inject one: `vi.mock` is hoisted above every
// import, so it reads the fake through this binding, set when that case builds the game.
let doCreateGame = null;
vi.mock('../app/js/platform/kokoro-runtime.js', () => ({ loadKokoroRuntime: async (deps) => { doCreateGame.deps = deps; return doCreateGame.carregar(); } }));

/** A fake Kokoro runtime: `gpuFala` says whether WebGPU returns speech; every session and phonemization is recorded. */
function portaFalsa({ gpuFala }) {
  const registo = { sessoes: [], fonemizados: [], voices: [] };
  const modulo = {
    phonemize: async (texto, espeak) => { registo.fonemizados.push([texto, espeak]); return 'abc'; },
    vocabulary: async () => ({ a: 1, b: 2, c: 3 }),
    voice: async (id) => { registo.voices.push(id); return new Float32Array(510 * 256); },
    session: async (dispositivo) => {
      registo.sessoes.push(dispositivo);
      return { synthesize: async () => (dispositivo === 'webgpu' && !gpuFala ? ruido() : tom()) };
    },
  };
  return { registo, carregar: async () => modulo };
}

const tocados = [];
const playOriginal = HTMLMediaElement.prototype.play;
let vozGuardada;

/** The browser's speech, the clock and the `<audio>` maker, lent the way the root lends them (ADR-0232 D4). */
const feitos = []; // every element the lent maker made
const doNavegador = {
  speech: { synth: () => window.speechSynthesis, utterance: (t) => new SpeechSynthesisUtterance(t) },
  now: () => performance.now(),
  createAudio: () => { const el = document.createElement('audio'); feitos.push(el); return el; },
};

function ttsCom(porta) {
  return createTts({
    ...doNavegador,
    store: createStorage(memoryBackend()),
    translator: createTranslator(), // the root's translator, played by the test (ADR-0232 D3)
    srSay: () => {}, srAlert: () => {}, ensureAC: () => new AudioContext(), catNode: () => null, audioOut: () => null,
    getSoundOn: () => true, getVolume: () => 1, getAudioCat: () => ({ tts: { on: true } }),
    neuralVoice: true, loadKokoro: porta.carregar, getSpeechPpm: () => 254,
  });
}

const declaracaoMinima = () => ({
  topology: () => ({ kind: 'hotspots', order: ['q1'] }), holdsAtOnce: () => 1, holdsKeys: () => false, tick: 'player',
  world: () => ({ kind: 'element', selector: '#game-region' }), roleAt: () => 'goal',
  nameAt: () => ({ text: 'a', gender: 'f', plural: false }), focusOf: () => null,
  objectiveOf: () => ({ name: { text: 'a', gender: 'f', plural: true }, have: 0, need: 1 }), targetsOf: () => [],
});

async function esperar(cond) { for (let i = 0; i < 200 && !cond(); i++) await new Promise((r) => setTimeout(r, 25)); }

// The neural path, measured on a browser that offers no voice: where it offers one, it speaks first (ADR-0200)
const getVoicesOriginal = window.speechSynthesis.getVoices;
beforeAll(() => {
  window.speechSynthesis.getVoices = () => [];
  vozGuardada = localStorage.getItem('incl_tts_voz');
  HTMLMediaElement.prototype.play = function () { tocados.push(this); return Promise.resolve(); };
});
afterAll(async () => {
  window.speechSynthesis.getVoices = getVoicesOriginal;
  HTMLMediaElement.prototype.play = playOriginal;
  if (vozGuardada === null) localStorage.removeItem('incl_tts_voz'); else localStorage.setItem('incl_tts_voz', vozGuardada);
  localStorage.removeItem('incl_lang');
});

describe('the voice list with the Kokoro port', () => {
  it('🔴 [Right] in Portuguese the three Kokoro voices, in the catalogue\'s order', () => {
    const tts = ttsCom(portaFalsa({ gpuFala: true }));
    expect(tts.voices().map((v) => v.voice)).toEqual(['pf_dora', 'pm_alex', 'pm_santa']);
  });

  it('🔴 [Zero] without the port no Kokoro voice is listed', () => {
    const tts = createTts({ store: createStorage(memoryBackend()), translator: createTranslator(), srSay: () => {}, srAlert: () => {}, ensureAC: () => null, catNode: () => null, audioOut: () => null,
      getSoundOn: () => true, getVolume: () => 1, getAudioCat: () => null, ...doNavegador,
      loadKokoro: () => { throw new Error('a game without the declaration never loads the voice'); } });
    expect(tts.voices(), 'a browser offering no voice and no port: nothing to list').toEqual([]);
  });
});

describe('a Kokoro voice speaks', () => {
  it('🔴 [Right] WebGPU returning noise falls back to WASM, and the utterance plays', async () => {
    const porta = portaFalsa({ gpuFala: false });
    const tts = ttsCom(porta);
    expect(tts.setVoice('pf_dora')).toBe(true);
    const antes = tocados.length;
    tts.ttsSpeak('Pule a pedra e pegue a estrela agora mesmo.');
    await esperar(() => tts.getEngine());
    expect(tts.kokoroDevice, 'the noise was taken for speech').toBe('wasm');
    expect(porta.registo.sessoes).toEqual(['webgpu', 'wasm']);
    tts.ttsSpeak('Pule a pedra e pegue a estrela agora mesmo.');
    await esperar(() => tocados.length > antes);
    expect(tocados.length, 'nothing played').toBeGreaterThan(antes);
    expect(feitos, 'the utterance did not play through the element the root lent').toContain(tocados.at(-1));
    expect(porta.registo.fonemizados.at(-1), 'the Portuguese voice was phonemized in another language').toEqual(['Pule a pedra e pegue a estrela agora mesmo.', 'pt-br']);
    expect(porta.registo.voices).toEqual(['pf_dora']);
  });

  it('⚠️ [Boundary] WebGPU returning speech is kept, and WASM is never asked for', async () => {
    const porta = portaFalsa({ gpuFala: true });
    const tts = ttsCom(porta);
    tts.setVoice('pm_alex');
    tts.ttsSpeak('Olá');
    await esperar(() => tts.getEngine());
    expect([tts.kokoroDevice, porta.registo.sessoes]).toEqual(['webgpu', ['webgpu']]);
  });
});

describe('what the start fetches (ADR-0198 §5)', () => {
  it('🔴 [Zero] a game without the Kokoro port asks for no Kokoro file', async () => {
    const pedidos = [];
    const fetchOriginal = window.fetch;
    window.fetch = async (u) => { pedidos.push(String(u)); return new Response('', { status: 404 }); };
    try {
      document.body.innerHTML = '<p id="sr-status" role="status"></p><p id="sr-alert" role="alert"></p><div id="game-region" tabindex="-1"></div>';
      const { createGame } = await import('../app/js/boot/create-game.js');
      const { heavyAtBoot, HEAVY_FILES } = await import('../app/js/platform/heavy.js');
      const { bcp47 } = await import('../app/js/core/i18n.js');
      const motor = createGame({ accommodations: SEM_ASSUNTO, declaration: declaracaoMinima(), host: { doc: document, win: window }, players: [{ ctrl: 0 }] });
      // ⚠️ The command models are asked for WITHOUT the game declaring anything (issue #184), one per language of the page
      // (ADR-0225 erratum), so the expected list is that question with the three languages NAMED — a number written here by hand
      // would have to be rewritten every time the catalogue grows.
      const esperados = heavyAtBoot({ kokoro: false, commands: [bcp47(motor.locale()), 'pt', 'en', 'es'] }).filter((id) => HEAVY_FILES.find((p) => p.id === id).url).length; // an entry without a source is reported, not asked for
      for (let i = 0; i < 400 && pedidos.filter((u) => u.includes('/heavy/')).length < esperados; i++) await new Promise((r) => setTimeout(r, 25));
      const daEntrega = pedidos.filter((u) => u.includes('/heavy/'));
      expect(daEntrega.length, 'the start did not ask for the catalogue').toBe(esperados);
      expect(daEntrega.filter((u) => u.includes('Kokoro-82M'))).toEqual([]);
    } finally {
      window.fetch = fetchOriginal;
    }
  });

  /**
   * 🔴 THE START ASKS FOR THE COMMAND MODEL OF EVERY LANGUAGE THE PAGE CAN SWITCH TO, THE CHILD'S FIRST (ADR-0225 erratum; the
   * Dev: «A entrega leva as três línguas.»). Asking for the boot language alone was the defect: a child who switched to Spanish
   * offline the next day found a model the install had never fetched, although the delivery carried it. And the child's own
   * comes FIRST, because the download is one file at a time: a Spanish child does not wait behind 70 MiB of the other two.
   */
  it('🔴 [Right] the start asks for the pt, en and es command models, the boot language\'s first', async () => {
    const pedidos = [];
    const fetchOriginal = window.fetch;
    window.fetch = async (u) => { pedidos.push(String(u)); return new Response('', { status: 404 }); };
    try {
      document.body.innerHTML = '<p id="sr-status" role="status"></p><p id="sr-alert" role="alert"></p><div id="game-region" tabindex="-1"></div>';
      const { createGame } = await import('../app/js/boot/create-game.js');
      const { HEAVY_FILES, deliveryPath } = await import('../app/js/platform/heavy.js');
      const { bcp47 } = await import('../app/js/core/i18n.js');
      const motor = createGame({ accommodations: SEM_ASSUNTO, declaration: declaracaoMinima(), host: { doc: document, win: window }, players: [{ ctrl: 0 }] });
      const modelo = (lingua) => deliveryPath(HEAVY_FILES.find((p) => p.id === `commands:model:${lingua}`).url);
      const pediu = (lingua) => pedidos.some((u) => u.endsWith(modelo(lingua)));
      for (let i = 0; i < 400 && !['pt', 'en', 'es'].every(pediu); i++) await new Promise((r) => setTimeout(r, 25));
      for (const lingua of ['pt', 'en', 'es']) {
        expect(pediu(lingua), `the start did not ask for the ${lingua} command model: a switch to ${lingua} would find none kept`).toBe(true);
      }
      const ordem = pedidos.filter((u) => /\/vosk-models\//.test(u));
      const doArranque = bcp47(motor.locale()).split('-')[0];
      expect(ordem[0]?.endsWith(modelo(doArranque)), `the child's own model (${doArranque}) waited behind another language's: ${ordem[0]}`).toBe(true);
      expect(ordem, 'a command model was asked for twice').toHaveLength(3);
    } finally {
      window.fetch = fetchOriginal;
    }
  });
});

describe('the marks in the hearing panel (ADR-0198 §3)', () => {
  let motor;
  beforeAll(async () => {
    localStorage.removeItem('incl_tts_voz');
    document.body.innerHTML = '<p id="sr-status" role="status"></p><p id="sr-alert" role="alert"></p>'
      + '<div id="game-region" tabindex="-1"></div><div id="title-icons"></div>';
    const { createGame } = await import('../app/js/boot/create-game.js');
    doCreateGame = portaFalsa({ gpuFala: true }); // what the engine's loader answers in this case
    motor = createGame({ accommodations: SEM_ASSUNTO, declaration: declaracaoMinima(), host: { doc: document, win: window }, downloadHeavy: false,
      players: [{ ctrl: 0 }], uses: { neuralVoice: true } });
    motor.pause.show(0);
    document.querySelector('#vp-pause-0 .pm-btn[data-act="options"]').click();
    document.querySelector('#vp-pause-0 .pm-btn[data-act="audio"]').click();
  });

  const rotulos = () => [...document.querySelectorAll('#audio #tts-voz option')].map((o) => o.textContent);

  it('🔴 [Right] in Portuguese: no mark on the Kokoro voices', () => {
    expect(rotulos()).toEqual(['Dora', 'Alex', 'Santa']);
  });

  it('🔴 [Right] in English: a heart on Heart and Bella only, and they come first', async () => {
    await motor.setLocale('en');
    document.querySelector('#audio .overlay__back')?.click();
    document.querySelector('#vp-pause-0 .pm-btn[data-act="audio"]')?.click();
    const r = rotulos();
    expect(r.slice(0, 2)).toEqual(['❤️ Heart', '❤️ Bella']);
    expect(r.filter((x) => x.startsWith('❤️')).length).toBe(2);
    expect(r.length).toBe(28);
  });
});

describe('the root\'s Kokoro loader reads the delivery with the HOST\'s fetch and WebAssembly (ADR-0232 D4)', () => {
  // `platform/tts` no longer imports the runtime: the root does, at the first neural utterance, and lends it the page's address
  // and the host window's `fetch` and WebAssembly. The host here is the real window with those three answered by spies, so a
  // root that reached the globals instead would be seen.
  it('🔴 [Right] the runtime is asked with the page\'s address, and its fetch and wasm calls reach the host', async () => {
    const pedidos = [], compilados = [], instanciados = [];
    const wasmDoHospedeiro = {
      compile: (bytes) => { compilados.push(bytes); return WebAssembly.compile(bytes); },
      instantiate: (module, imports) => { instanciados.push(module); return WebAssembly.instantiate(module, imports); },
    };
    const proprios = {
      fetch: async (u) => { pedidos.push(String(u)); return new Response('', { status: 404 }); },
      WebAssembly: wasmDoHospedeiro,
    };
    const hospedeiro = new Proxy(window, {
      get(t, p) {
        if (Object.hasOwn(proprios, p)) return proprios[p];
        const v = Reflect.get(t, p);
        return typeof v === 'function' && !Object.hasOwn(v, 'prototype') ? v.bind(t) : v;
      },
    });
    // the block above KEPT English in this file's storage, where `pf_dora` is not a voice of the language: this root boots in pt
    localStorage.setItem('incl_lang', 'pt');
    document.body.innerHTML = '<p id="sr-status" role="status"></p><p id="sr-alert" role="alert"></p>'
      + '<div id="game-region" tabindex="-1"></div><div id="title-icons"></div>';
    const { createGame } = await import('../app/js/boot/create-game.js');
    doCreateGame = portaFalsa({ gpuFala: true });
    const motor = createGame({ accommodations: SEM_ASSUNTO, declaration: declaracaoMinima(), host: { doc: document, win: hospedeiro },
      downloadHeavy: false, players: [{ ctrl: 0 }], uses: { neuralVoice: true } });
    try {
      expect(motor.tts.setVoice('pf_dora')).toBe(true);
      motor.tts.ttsSpeak('Olá');
      await esperar(() => motor.tts.getEngine());
      const deps = doCreateGame.deps;
      expect(deps?.base, 'the runtime was not asked with the page\'s address').toBe(document.baseURI);
      await deps.fetch('heavy/x.bin');
      expect(pedidos, 'the runtime\'s fetch did not reach the host').toEqual(['heavy/x.bin']);
      const vazio = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0]).buffer; // the smallest valid wasm module
      const modulo = await deps.compileWasm(vazio);
      await deps.instantiateWasm(modulo, {});
      expect([compilados.length, instanciados.length], 'the runtime\'s wasm did not go through the host').toEqual([1, 1]);
    } finally {
      motor.dispose();
    }
  });
});

// ============================== MUTATIONS CHECKED ==============================
//   KV1 Kokoro voices listed without the port              🔴 without the port
//   KV3 WebGPU kept without the test synthesis             🔴 noise falls back
//   KV4 the voice phonemized with a fixed language         🔴 own language
//   KV5 the heart on every Kokoro voice                    🔴 marks in English/Portuguese
//   KV6 the start fetches the whole catalogue              🔴 without the port
