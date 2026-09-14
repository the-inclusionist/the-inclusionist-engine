// SPDX-License-Identifier: AGPL-3.0-or-later
// KOKORO SPEAKS THROUGH THE GAME'S PORT (ADR-0186, ADR-0198; issue #181): the voices listed after Piper's, marked by quality, and a
// voice picked speaks on WebGPU only where a test synthesis is speech — WASM otherwise.
//
// 📏 Why the test synthesis: on 2026-09-14 WebGPU on an AMD gcn-5 ran Kokoro and returned samples up to 2×10⁷ — noise.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTts } from '../app/js/platform/tts.js';
import { setLocale } from '../app/js/core/i18n.ts';
import { SEM_ASSUNTO } from './fixtures/respostas-de-acomodacao.js';

const tom = (n = 24000) => Float32Array.from({ length: n }, (_, i) => Math.sin(i / 8) * 0.4);
const ruido = () => { const o = tom(2400); o[9] = -20_561_670; return o; };

/** A fake Kokoro port: `gpuFala` says whether WebGPU returns speech; every session and phonemization is recorded. */
function portaFalsa({ gpuFala }) {
  const registo = { sessoes: [], fonemizados: [], vozes: [] };
  const modulo = {
    fonemizar: async (texto, espeak) => { registo.fonemizados.push([texto, espeak]); return 'abc'; },
    vocabulario: async () => ({ a: 1, b: 2, c: 3 }),
    voz: async (id) => { registo.vozes.push(id); return new Float32Array(510 * 256); },
    sessao: async (dispositivo) => {
      registo.sessoes.push(dispositivo);
      return { sintetizar: async () => (dispositivo === 'webgpu' && !gpuFala ? ruido() : tom()) };
    },
  };
  return { registo, carregar: async () => modulo };
}

const tocados = [];
const playOriginal = HTMLMediaElement.prototype.play;
let vozGuardada;

function ttsCom(porta) {
  return createTts({
    srSay: () => {}, srAlert: () => {}, ensureAC: () => new AudioContext(), catNode: () => null, audioOut: () => null,
    getSoundOn: () => true, getVolume: () => 1, getAudioCat: () => ({ tts: { on: true } }),
    carregarKokoro: porta.carregar, getSpeechPpm: () => 254,
  });
}

const declaracaoMinima = () => ({
  topology: () => ({ kind: 'hotspots', order: ['q1'] }), holdsAtOnce: () => 1, seguraTeclas: () => false, tick: 'player',
  world: () => ({ kind: 'element', selector: '#game-region' }), roleAt: () => 'goal',
  nameAt: () => ({ text: 'a', gender: 'f', plural: false }), focusOf: () => null,
  objectiveOf: () => ({ name: { text: 'a', gender: 'f', plural: true }, have: 0, need: 1 }), targetsOf: () => [],
});

async function esperar(cond) { for (let i = 0; i < 200 && !cond(); i++) await new Promise((r) => setTimeout(r, 25)); }

beforeAll(() => {
  vozGuardada = localStorage.getItem('incl_tts_voz');
  HTMLMediaElement.prototype.play = function () { tocados.push(this); return Promise.resolve(); };
});
afterAll(async () => {
  HTMLMediaElement.prototype.play = playOriginal;
  if (vozGuardada === null) localStorage.removeItem('incl_tts_voz'); else localStorage.setItem('incl_tts_voz', vozGuardada);
  await setLocale('pt');
});

describe('the voice list with the Kokoro port', () => {
  it('🔴 [Right] in Portuguese the Piper voice comes first, then the three Kokoro voices (ADR-0198 §2)', () => {
    const tts = ttsCom(portaFalsa({ gpuFala: true }));
    expect(tts.vozes().map((v) => v.voice)).toEqual(['pt_BR-faber-medium', 'pf_dora', 'pm_alex', 'pm_santa']);
  });

  it('🔴 [Zero] without the port no Kokoro voice is listed', () => {
    const tts = createTts({ srSay: () => {}, srAlert: () => {}, ensureAC: () => null, catNode: () => null, audioOut: () => null,
      getSoundOn: () => true, getVolume: () => 1, getAudioCat: () => null });
    expect(tts.vozes().map((v) => v.engine)).toEqual(['piper']);
  });
});

describe('a Kokoro voice speaks', () => {
  it('🔴 [Right] WebGPU returning noise falls back to WASM, and the utterance plays', async () => {
    const porta = portaFalsa({ gpuFala: false });
    const tts = ttsCom(porta);
    expect(tts.setVoz('pf_dora')).toBe(true);
    const antes = tocados.length;
    tts.ttsSpeak('Pule a pedra e pegue a estrela agora mesmo.');
    await esperar(() => tts.getEngine());
    expect(tts.kokoroDispositivo, 'the noise was taken for speech').toBe('wasm');
    expect(porta.registo.sessoes).toEqual(['webgpu', 'wasm']);
    tts.ttsSpeak('Pule a pedra e pegue a estrela agora mesmo.');
    await esperar(() => tocados.length > antes);
    expect(tocados.length, 'nothing played').toBeGreaterThan(antes);
    expect(porta.registo.fonemizados.at(-1), 'the Portuguese voice was phonemized in another language').toEqual(['Pule a pedra e pegue a estrela agora mesmo.', 'pt-br']);
    expect(porta.registo.vozes).toEqual(['pf_dora']);
  });

  it('⚠️ [Boundary] WebGPU returning speech is kept, and WASM is never asked for', async () => {
    const porta = portaFalsa({ gpuFala: true });
    const tts = ttsCom(porta);
    tts.setVoz('pm_alex');
    tts.ttsSpeak('Olá');
    await esperar(() => tts.getEngine());
    expect([tts.kokoroDispositivo, porta.registo.sessoes]).toEqual(['webgpu', ['webgpu']]);
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
      const { pesadosDoArranque, PESADOS } = await import('../app/js/platform/pesados.js');
      createGame({ acomodacoes: SEM_ASSUNTO, declaration: declaracaoMinima(), host: { doc: document, win: window }, players: [{ ctrl: 0 }] });
      const esperados = pesadosDoArranque({ kokoro: false }).filter((id) => PESADOS.find((p) => p.id === id).url).length; // an entry without a source is reported, not asked for
      for (let i = 0; i < 400 && pedidos.filter((u) => u.includes('/pesados/')).length < esperados; i++) await new Promise((r) => setTimeout(r, 25));
      const daEntrega = pedidos.filter((u) => u.includes('/pesados/'));
      expect(daEntrega.length, 'the start did not ask for the catalogue').toBe(esperados);
      expect(daEntrega.filter((u) => u.includes('Kokoro-82M'))).toEqual([]);
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
    motor = createGame({ acomodacoes: SEM_ASSUNTO, declaration: declaracaoMinima(), host: { doc: document, win: window }, baixarPesados: false,
      players: [{ ctrl: 0 }], carregarKokoro: portaFalsa({ gpuFala: true }).carregar });
    motor.pausa.mostrar(0);
    document.querySelector('#vp-pause-0 .pm-btn[data-act="options"]').click();
    document.querySelector('#vp-pause-0 .pm-btn[data-act="audio"]').click();
  });

  const rotulos = () => [...document.querySelectorAll('#audio #tts-voz option')].map((o) => o.textContent);

  it('🔴 [Right] in Portuguese: the feather on Faber, no mark on the Kokoro voices', () => {
    expect(rotulos()).toEqual(['🪶 Faber', 'Dora', 'Alex', 'Santa']);
  });

  it('🔴 [Right] in English: the feather on the Piper voices and a heart on Heart and Bella only', async () => {
    await setLocale('en');
    document.querySelector('#audio .overlay__back')?.click();
    document.querySelector('#vp-pause-0 .pm-btn[data-act="audio"]')?.click();
    const r = rotulos();
    expect(r.slice(0, 4), 'Amy first (ADR-0198 erratum), then Ryan, then Heart and Bella').toEqual(['🪶 Amy', '🪶 Ryan', '❤️ Heart', '❤️ Bella']);
    expect(r.filter((x) => x.startsWith('❤️')).length).toBe(2);
    expect(r.length).toBe(30);
  });
});

// ============================== MUTATIONS CHECKED ==============================
//   KV1 Kokoro voices listed without the port              🔴 without the port
//   KV2 Kokoro before Piper                                🔴 Piper first · marks
//   KV3 WebGPU kept without the test synthesis             🔴 noise falls back
//   KV4 the voice phonemized with a fixed language         🔴 own language
//   KV5 the heart on every Kokoro voice                    🔴 marks in English/Portuguese
//   KV6 the start fetches the whole catalogue              🔴 without the port
