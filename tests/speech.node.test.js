// SPDX-License-Identifier: AGPL-3.0-or-later
// Testes de platform/speech — a voz do LETRAMENTO (`gameSay`).
//
// 📏 POR QUE ESTE FICHEIRO EXISTE, e a medição que o pediu: `platform/speech` é um dos DOIS módulos da engine
// que não têm importador interno NENHUM **e** não são importados por teste nenhum daqui. Ele não é morto — o
// `game-platformer` consome `gameSay` (`main.ts:135`) pela superfície publicada `./platform/*.js` —, é
// **publicado sem gate**. O outro é `render/recycling-tex`, e esse tem o seu único teste no repositório do
// CARTUCHO, que a CI da engine nunca corre: é o padrão do canário outra vez, num terceiro sítio.
//
// ⚠️ ESTE MÓDULO NÃO RECEBE `soundOn`/`volume` POR INJEÇÃO — lê os bindings vivos de `platform/audio`, ao
// contrário do `platform/tts`, que os recebe no ctx. Não é defeito a consertar aqui: é a razão de o teste
// conduzir o módulo pelos setters (`setSoundOn`/`setVolume`) em vez de por um duplo.
//
// ⚠️ E O QUE ESTE FICHEIRO **NÃO** AFIRMA, para não parecer decidido: o módulo força `pt-BR` em toda parte,
// enquanto o ADR-0065 dá TRÊS idiomas à engine. Isso é do desenho de origem (é a voz de um jogo de letramento
// brasileiro) e mudá-lo é comportamento, não cobertura. Fica medido e nomeado, não corrigido de passagem.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { gameSay } from '../app/js/platform/speech.js';
import { setSoundOn, setVolume } from '../app/js/platform/audio.js';

let spoke, cancels, vozes, getVoicesLanca;

/** As vozes que um navegador de escola pode oferecer, com pt-PT no meio de propósito. */
const PT_BR = { lang: 'pt-BR', name: 'Microsoft Daniel' };
const PT_PT = { lang: 'pt-PT', name: 'Microsoft Helia' };
const PT_SEM_REGIAO_BR = { lang: 'pt', name: 'Google português do Brasil' };
const PT_SEM_REGIAO = { lang: 'pt', name: 'Voz genérica' };
const EN = { lang: 'en-US', name: 'Microsoft Zira' };

beforeEach(() => {
  spoke = []; cancels = 0; vozes = []; getVoicesLanca = false;
  globalThis.window = {
    speechSynthesis: {
      cancel: () => { cancels++; },
      speak: (u) => spoke.push(u),
      getVoices: () => { if (getVoicesLanca) throw new Error('sem vozes carregadas'); return vozes; },
    },
  };
  globalThis.SpeechSynthesisUtterance = class {
    constructor(t) { this.text = t; this.lang = ''; this.volume = 0; this.voice = null; }
  };
  setSoundOn(true); setVolume(0.6);
});
afterEach(() => {
  delete globalThis.window; delete globalThis.SpeechSynthesisUtterance;
  setSoundOn(true); setVolume(0.6);
});

describe('platform/speech · gameSay só fala quando há o que dizer e o som está ligado', () => {
  it('[Feliz] fala o texto, forçando pt-BR', () => {
    gameSay('lata é metal');
    expect(spoke).toHaveLength(1);
    expect(spoke[0].text).toBe('lata é metal');
    expect(spoke[0].lang).toBe('pt-BR');
  });

  it('[Fronteira] texto vazio não fala', () => {
    gameSay('');
    expect(spoke).toHaveLength(0);
  });

  // ⚠️ O CONTRATO DE DUAS METADES, e é a razão de o módulo existir separado do `platform/tts`: a voz do
  // letramento IGNORA o toggle «Narração (TTS)» do mixer — uma criança que está a aprender a ler ouve as
  // palavras mesmo com a narração de menu desligada — mas OBEDECE ao mudo mestre. Sem a segunda metade, um
  // jogo silenciado numa sala de aula continua a falar por cima da professora.
  it('[Fronteira] com o som mestre desligado, cala-se', () => {
    setSoundOn(false);
    gameSay('lata é metal');
    expect(spoke).toHaveLength(0);
  });

  it('[Feliz] o mudo mestre é a ÚNICA porta: sem nenhum toggle de TTS por perto, fala', () => {
    setSoundOn(true);
    gameSay('papel');
    expect(spoke).toHaveLength(1);
  });

  // ⚠️ Sem o `cancel`, cada palavra nova entra na FILA em vez de substituir a anterior: a criança carrega em
  // quatro peças depressa e ouve as quatro a destempo, muito depois de já ter jogado.
  it('[Fronteira] cancela a fala anterior antes de falar', () => {
    gameSay('um'); gameSay('dois');
    expect(cancels).toBe(2);
    expect(spoke).toHaveLength(2);
  });

  it('[Fronteira] sem speechSynthesis no navegador, não rebenta e não fala', () => {
    globalThis.window = {};
    expect(() => gameSay('lata')).not.toThrow();
    expect(spoke).toHaveLength(0);
  });
});

describe('platform/speech · a escolha da voz evita pt-PT, e a ORDEM é a regra', () => {
  it('[Feliz] pt-BR exacto ganha de tudo', () => {
    vozes = [EN, PT_PT, PT_SEM_REGIAO_BR, PT_BR];
    gameSay('lata');
    expect(spoke[0].voice).toBe(PT_BR);
  });

  // 📌 O segundo degrau existe porque há navegadores que reportam `lang: 'pt'` e escondem a região no NOME.
  it('[Fronteira] sem pt-BR, aceita pt cujo NOME diz Brasil', () => {
    vozes = [EN, PT_PT, PT_SEM_REGIAO_BR, PT_SEM_REGIAO];
    gameSay('lata');
    expect(spoke[0].voice).toBe(PT_SEM_REGIAO_BR);
  });

  it('[Fronteira] no último degrau, um pt sem região serve — pt-PT nunca', () => {
    vozes = [EN, PT_PT, PT_SEM_REGIAO];
    gameSay('lata');
    expect(spoke[0].voice).toBe(PT_SEM_REGIAO);
  });

  // 🎯 O CASO QUE DÁ NOME AO MÓDULO: com pt-PT como a única voz portuguesa instalada, a escolha é NENHUMA.
  // Falar em português europeu a uma criança brasileira em fase de alfabetização ensina a grafia errada — é
  // preferível a voz padrão do sistema, que o `lang: 'pt-BR'` ainda orienta.
  it('[Fronteira] com só pt-PT instalada, não escolhe voz nenhuma — mas fala', () => {
    vozes = [EN, PT_PT];
    gameSay('lata');
    expect(spoke).toHaveLength(1);
    expect(spoke[0].voice).toBeNull();
    expect(spoke[0].lang).toBe('pt-BR');
  });

  it('[Fronteira] lista de vozes vazia: fala na mesma, sem voz escolhida', () => {
    vozes = [];
    gameSay('lata');
    expect(spoke).toHaveLength(1);
    expect(spoke[0].voice).toBeNull();
  });

  it('[Fronteira] getVoices que lança não impede a fala', () => {
    getVoicesLanca = true;
    expect(() => gameSay('lata')).not.toThrow();
    expect(spoke).toHaveLength(1);
    expect(spoke[0].voice).toBeNull();
  });
});

describe('platform/speech · o volume sobe acima dos efeitos, mas com tecto', () => {
  it('[Feliz] a fala sai 1,4× acima do volume mestre', () => {
    setVolume(0.5);
    gameSay('lata');
    expect(spoke[0].volume).toBeCloseTo(0.7, 5);
  });

  // ⚠️ Sem o `Math.min`, o volume mestre no máximo dá 1,4 — e `SpeechSynthesisUtterance.volume` fora de [0,1]
  // é erro no navegador: a fala do letramento morre exactamente para quem pôs o som no máximo, que é quem
  // menos ouve.
  it('[Fronteira] no volume máximo, o valor fica preso em 1', () => {
    setVolume(1);
    gameSay('lata');
    expect(spoke[0].volume).toBe(1);
  });
});
