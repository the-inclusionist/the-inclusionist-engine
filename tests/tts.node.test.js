// SPDX-License-Identifier: AGPL-3.0-or-later
// Testes de platform/tts (project NODE: window.speechSynthesis + SpeechSynthesisUtterance stubados). Contratos:
// narrate é gated por soundOn + audioCat.tts.on + texto não-vazio; o fallback Web Speech fala NO IDIOMA DO JOGO;
// loadTTS avisa em motor que não fala o idioma. Ver docs/5-Refactoring/plano-modularizacao-mapa.md (#38).
//
// ⚠️ O CABEÇALHO DIZIA «NÃO exercito o caminho Piper, que faz import() de CDN», E DEIXOU DE SER VERDADE com o
// ADR-0094: o motor neural chega por PORTA (`ctx.carregarVozNeural`), então o caminho inteiro se exercita com um
// falso, sem rede e sem fornecedor instalado. É o ganho de teste da inversão, e não um efeito colateral dela — o
// caminho que carrega a voz era o único do módulo que ninguém conseguia percorrer.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import pt from '../app/js/i18n/pt.js';
import { createTts } from '../app/js/platform/tts.js';

let spoke, cancels;
beforeEach(() => {
  spoke = []; cancels = 0;
  globalThis.window = { speechSynthesis: { cancel: () => { cancels++; }, speak: (u) => spoke.push(u) } };
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
  if (over.carregarVozNeural) ctx.carregarVozNeural = over.carregarVozNeural;
  return { tts: createTts(ctx), said, alerted };
}

/** Um fornecedor de voz neural que não existe: as DUAS chamadas que a engine faz, e nada mais. */
function fornecedorFalso(registro) {
  return () => Promise.resolve({
    TtsSession: {
      create: (o) => { registro.voiceId = o.voiceId; return Promise.resolve({ predict: () => Promise.reject(new Error('sem áudio no node')) }); },
    },
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
    tts.setEngineSel('piper');
    expect(tts.getEngineSel()).toBe('piper');
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
    tts.setEngineSel('kokoro');
    tts.loadTTS();
    expect(alerted).toContain(pt['sr.tts.engineNoLanguage']);
    expect(tts.loading).toBe(false);
  });
});

// ===================================================================================================
// A PORTA DA VOZ NEURAL (ADR-0094)
// ===================================================================================================
// A engine não nomeia o fornecedor: quem o nomeia é o jogo, por `ctx.carregarVozNeural`. O motivo é medido —
// o fornecedor traz `onnxruntime-web` como peer NÃO-opcional (135,4 MB), e declará-lo em `devDependencies`
// publicou uma engine que não compilava (ADR-0093). Estes casos prendem as duas metades: sem porta a criança
// é AVISADA e a narração continua pela voz do navegador; com porta o caminho neural corre inteiro.
describe('platform/tts — a porta da voz neural', () => {
  it('[Zero] sem porta: avisa, marca falha e NÃO diz que o problema é o idioma', () => {
    const { tts, alerted } = setup();
    tts.setEngineSel('piper');
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
    // O que a issue #112 chama de recusa falsa, aqui: faltar o motor neural não pode calar o produto.
    const { tts } = setup();
    tts.setEngineSel('piper');
    tts.narrate('bom dia');
    expect(spoke.length).toBe(1);
    expect(spoke[0].text).toBe('bom dia');
    expect(spoke[0].lang).toBe('pt-BR');
  });

  it('[Happy] com porta o caminho neural corre inteiro e o motor fica de pé', async () => {
    const registro = {};
    const { tts } = setup({ carregarVozNeural: fornecedorFalso(registro) });
    expect(tts.neuralDisponivel).toBe(true);
    tts.setEngineSel('piper');
    tts.loadTTS();
    expect(tts.loading, 'o carregamento começa de imediato').toBe(true);
    await assentar();
    expect(registro.voiceId, 'a voz pedida vem de TTS_SOURCES, não do ponto de uso').toBe('pt_BR-faber-medium');
    expect(tts.getEngine()?.id).toBe('piper');
    expect(tts.loading).toBe(false);
    expect(tts.failed).toBe(false);
  });

  it('[Boundary] porta que rejeita não derruba o jogo: falha marcada e voz do navegador segue', async () => {
    const { tts, alerted } = setup({ carregarVozNeural: () => Promise.reject(new Error('offline')) });
    tts.setEngineSel('piper');
    tts.loadTTS();
    await assentar();
    expect(alerted).toContain(pt['sr.tts.loadFailed']);
    expect(tts.failed).toBe(true);
    expect(tts.loading).toBe(false);
    tts.narrate('segue');
    expect(spoke.length).toBe(1);
  });
});
