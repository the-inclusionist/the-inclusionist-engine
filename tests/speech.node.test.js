// SPDX-License-Identifier: AGPL-3.0-or-later
// Tests of platform/speech — the LITERACY voice (`gameSay`).
//
// 📏 WHY THIS FILE EXISTS: `platform/speech` has NO internal importer in the engine. It is not dead — `game-platformer`
// consumes `gameSay` through the published surface `./platform/*.js` —, so without a test here it would be **published
// without a gate** (see `tests/published-without-a-gate.node.test.js`).
//
// ⚠️ THIS MODULE DOES NOT RECEIVE `soundOn`/`volume` BY INJECTION — it reads the live bindings of `platform/audio`, unlike
// `platform/tts`, which receives them in its ctx. That is not a defect to fix here: it is why the test drives the module
// through the setters (`setSoundOn`/`setVolume`) instead of through a double.
//
// ⚠️ AND WHAT THIS FILE DOES **NOT** ASSERT, so it does not look decided: the module forces `pt-BR` everywhere, while
// ADR-0065 gives the engine THREE languages. That comes from its original design (it is the voice of a Brazilian
// literacy game) and changing it is behaviour, not coverage. It stays measured and named, not fixed in passing.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { gameSay } from '../app/js/platform/speech.js';
import { setSoundOn, setVolume } from '../app/js/platform/audio.js';

let spoke, cancels, vozes, getVoicesLanca;

/** The voices a school browser may offer, with pt-PT in the middle on purpose. */
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

  // ⚠️ THE TWO-HALF CONTRACT, and it is why the module exists apart from `platform/tts`: the literacy voice IGNORES the
  // mixer's «Narração (TTS)» toggle — a child learning to read hears the words even with menu narration off — but OBEYS
  // the master mute. Without the second half, a game muted in a classroom keeps talking over the teacher.
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

  // ⚠️ Without the `cancel`, each new word enters the QUEUE instead of replacing the previous one: the child presses four
  // pieces quickly and hears all four out of step, long after she has already played.
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

  // 📌 The second step exists because some browsers report `lang: 'pt'` and hide the region in the NAME.
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

  // 🎯 THE CASE THAT GIVES THE MODULE ITS NAME: with pt-PT as the only Portuguese voice installed, the choice is NONE.
  // Speaking European Portuguese to a Brazilian child learning to read teaches the wrong spelling — the system's default
  // voice, which `lang: 'pt-BR'` still steers, is preferable.
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

  // ⚠️ Without the `Math.min`, the master volume at maximum gives 1.4 — and `SpeechSynthesisUtterance.volume` outside
  // [0,1] is an error in the browser: the literacy voice dies exactly for whoever turned the sound all the way up, who is
  // whoever hears least.
  it('[Fronteira] no volume máximo, o valor fica preso em 1', () => {
    setVolume(1);
    gameSay('lata');
    expect(spoke[0].volume).toBe(1);
  });
});
