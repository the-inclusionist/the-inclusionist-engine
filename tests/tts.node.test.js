// SPDX-License-Identifier: AGPL-3.0-or-later
// Testes de platform/tts (project NODE: window.speechSynthesis + SpeechSynthesisUtterance stubados). Contratos:
// narrate é gated por soundOn + audioCat.tts.on + texto não-vazio; o fallback Web Speech fala NO IDIOMA DO JOGO;
// loadTTS avisa em motor que não fala o idioma. Ver docs/5-Refactoring/plano-modularizacao-mapa.md (#38).
//
// The neural engine arrives through the game's Kokoro port (ADR-0198, ADR-0207), so its whole path runs with a fake — no network,
// no provider installed. The fake browser offers one Portuguese voice: with none, narration is locked (ADR-0185 §4).
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import pt from '../app/js/i18n/pt.js';
import { createTts } from '../app/js/platform/tts.js';

let spoke, cancels;
beforeEach(() => {
  spoke = []; cancels = 0;
  globalThis.window = { speechSynthesis: { cancel: () => { cancels++; }, speak: (u) => spoke.push(u), getVoices: () => [{ name: 'Luciana', lang: 'pt-BR' }] } };
  globalThis.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; this.lang = ''; this.rate = 0; this.volume = 0; this.voice = null; } };
});
afterEach(() => { delete globalThis.window; delete globalThis.SpeechSynthesisUtterance; });

function setup(over = {}) {
  const said = [], alerted = [];
  const ctx = {
    srSay: (t) => said.push(t), srAlert: (t) => alerted.push(t),
    ensureAC: () => null, catNode: () => null, audioOut: () => null,
    getSoundOn: () => over.soundOn === undefined ? true : over.soundOn,
    getVolume: () => over.volume === undefined ? 0.6 : over.volume,
    getAudioCat: () => over.audioCat === undefined ? { tts: { on: true } } : over.audioCat,
  };
  if (over.carregarKokoro) ctx.carregarKokoro = over.carregarKokoro;
  return { tts: createTts(ctx), said, alerted };
}

/** A Kokoro port that does not exist: the four calls the engine makes, and nothing more. WebGPU returns speech. */
function fakeKokoroPort(registro) {
  const tom = Float32Array.from({ length: 2400 }, (_, i) => Math.sin(i / 8) * 0.4);
  return () => Promise.resolve({
    fonemizar: async () => 'a', vocabulario: async () => ({ a: 1 }),
    voz: async (id) => { registro.voz = id; return new Float32Array(256); },
    sessao: async (dispositivo) => { registro.dispositivo = dispositivo; return { sintetizar: async () => tom }; },
  });
}

/** Deixa correr as microtasks do `then` encadeado do `loadTTS` sem prender o teste a um número de ticks. */
async function assentar() { for (let i = 0; i < 12; i++) await Promise.resolve(); }

describe('platform/tts', () => {
  it('[Gate] narrate não fala com soundOn=false', () => {
    const { tts } = setup({ soundOn: false });
    tts.narrate('oi');
    expect(spoke.length).toBe(0);
    expect(tts.narrateCount).toBe(0);
  });

  it('[Gate] narrate não fala com o toggle TTS (audioCat.tts.on) desligado', () => {
    const { tts } = setup({ audioCat: { tts: { on: false } } });
    tts.narrate('oi');
    expect(spoke.length).toBe(0);
  });

  it('[Zero] narrate ignora texto vazio', () => {
    const { tts } = setup();
    tts.narrate('');
    expect(spoke.length).toBe(0);
    expect(tts.narrateCount).toBe(0);
  });

  it('[Happy] narrate (webspeech, tudo ligado) fala e conta', () => {
    const { tts } = setup();
    tts.narrate('bom dia');
    expect(spoke.length).toBe(1);
    expect(spoke[0].text).toBe('bom dia');
    expect(spoke[0].lang).toBe('pt-BR');
    expect(tts.narrateCount).toBe(1);
  });

  it('[Interface] volume do Web Speech = min(1, volume×1.4)', () => {
    const { tts } = setup({ volume: 0.5 });
    tts.narrate('x');
    expect(spoke[0].volume).toBeCloseTo(0.7); // 0.5 × 1.4
  });

  it('[Boundary] speakWebSpeech sem speechSynthesis retorna false', () => {
    globalThis.window = {}; // sem speechSynthesis
    const { tts } = setup();
    expect(tts.speakWebSpeech('x')).toBe(false);
  });

  it('[State] getEngineSel default webspeech; setEngineSel reflete', () => {
    const { tts } = setup();
    expect(tts.getEngineSel()).toBe('webspeech');
    tts.setEngineSel('kokoro');
    expect(tts.getEngineSel()).toBe('kokoro');
  });

  it('[State] set/getVoiceObj roundtrip', () => {
    const { tts } = setup();
    const v = { name: 'Luciana', lang: 'pt-BR' };
    tts.setVoiceObj(v);
    expect(tts.getVoiceObj()).toBe(v);
  });

  it('[Interface] loadTTS num motor que não fala o idioma avisa e não carrega', () => {
    // A frase dizia "ainda não fala PORTUGUÊS", e o teste aferia esse literal. Num jogo em inglês a mensagem
    // estaria errada — o motor não fala o idioma DO JOGO, seja ele qual for. A asserção passa pelo dicionário
    // em vez de repetir o texto: continua provando que a pessoa foi avisada, sem congelar a redação.
    const { tts, alerted } = setup();
    tts.setEngineSel('kitten'); // Kokoro speaks since ADR-0198; Kitten has not entered
    tts.loadTTS();
    expect(alerted).toContain(pt['sr.tts.engineNoLanguage']);
    expect(tts.loading).toBe(false);
  });
});

// ===================================================================================================
// A PORTA DA VOZ NEURAL (ADR-0094, ADR-0198)
// ===================================================================================================
// The engine names no provider: the game does, through the Kokoro port. These cases hold both halves: without the port the child is
// TOLD and narration goes on in the browser's voice; with the port the neural path runs whole.
describe('platform/tts — a porta da voz neural', () => {
  it('[Zero] sem porta: avisa, marca falha e NÃO diz que o problema é o idioma', () => {
    const { tts, alerted } = setup();
    tts.setEngineSel('kokoro');
    tts.loadTTS();
    expect(alerted).toContain(pt['sr.tts.neuralNotBundled']);
    // ⚠️ A DISTINÇÃO É O PONTO, e não um detalhe de redação: «não há voz para este idioma» mandaria a criança
    // trocar de idioma à procura do que não está lá em idioma nenhum.
    expect(alerted).not.toContain(pt['sr.tts.noNeuralForLanguage']);
    expect(tts.loading).toBe(false);
    expect(tts.failed).toBe(true);
    expect(tts.neuralDisponivel).toBe(false);
  });

  it('[Right] sem porta a narração NÃO emudece — cai na voz do navegador', () => {
    const { tts } = setup();
    tts.setEngineSel('kokoro');
    tts.narrate('bom dia');
    expect(spoke.length).toBe(1);
    expect(spoke[0].text).toBe('bom dia');
    expect(spoke[0].lang).toBe('pt-BR');
  });

  it('[Happy] com porta o caminho neural corre inteiro e o motor fica de pé', async () => {
    const registro = {};
    const { tts } = setup({ carregarKokoro: fakeKokoroPort(registro) });
    expect(tts.neuralDisponivel).toBe(true);
    tts.setEngineSel('kokoro');
    tts.loadTTS();
    expect(tts.loading, 'o carregamento começa de imediato').toBe(true);
    await assentar();
    expect(registro.voz, 'the first Kokoro voice of the language loads').toBe('pf_dora');
    expect(tts.getEngine()?.id).toBe('kokoro');
    expect(tts.loading).toBe(false);
    expect(tts.failed).toBe(false);
  });

  it('[Boundary] porta que rejeita não derruba o jogo: falha marcada e voz do navegador segue', async () => {
    const { tts, alerted } = setup({ carregarKokoro: () => Promise.reject(new Error('offline')) });
    tts.setEngineSel('kokoro');
    tts.loadTTS();
    await assentar();
    expect(alerted).toContain(pt['sr.tts.loadFailed']);
    expect(tts.failed).toBe(true);
    expect(tts.loading).toBe(false);
    tts.narrate('segue');
    expect(spoke.length).toBe(1);
  });
});
