// SPDX-License-Identifier: AGPL-3.0-or-later
// Tests of platform/speech — the LITERACY voice (`gameSay`).
//
// 📏 WHY THIS FILE EXISTS: `platform/speech` has NO internal importer in the engine. It is not dead — `game-platformer`
// consumes `gameSay` through the published surface `./platform/*.js` —, so without a test here it would be **published
// without a gate** (see `tests/published-without-a-gate.node.test.js`).
//
// 📌 THE VOICE ARRIVES AS A PARAMETER (ADR-0232 D4): the browser's speech (`synth`, `utterance`) and the master sound it obeys
// (`soundOn`, `volume`). The module reads no window and no `platform/audio` binding, so each case builds the voice it speaks
// through — nothing is left on `globalThis` for the next file.
//
// 📌 THE LANGUAGE IS THE GAME'S, AND REQUIRED (ADR-0243 §4): the module forced `pt-BR` whatever the page said; now the game
// says which language its word is in, and the voice is chosen by the rule narration's parts use (§2). That `gameSay` without
// a language does not COMPILE is held by `tests/a-spoken-text-carries-its-language.types.node.test.ts`.
import { describe, it, expect, beforeEach } from 'vitest';
import { gameSay as sayWith } from '../app/js/platform/speech.js';

let spoke, cancels, vozes, getVoicesLanca, som, volume, synth;

/** The voices a school browser may offer, with pt-PT in the middle on purpose. */
const PT_BR = { lang: 'pt-BR', name: 'Microsoft Daniel' };
const PT_PT = { lang: 'pt-PT', name: 'Microsoft Helia' };
const PT_SEM_REGIAO_BR = { lang: 'pt', name: 'Google português do Brasil' };
const PT_SEM_REGIAO = { lang: 'pt', name: 'Voz genérica' };
const EN = { lang: 'en-US', name: 'Microsoft Zira' };

class FakeUtterance {
  constructor(t) { this.text = t; this.lang = ''; this.volume = 0; this.voice = null; }
}

/** The voice every case speaks through: the fake speech, and the master sound the case sets. */
const voice = {
  synth: () => synth,
  utterance: (t) => new FakeUtterance(t),
  soundOn: () => som,
  volume: () => volume,
};
/** The platformer's literacy words are Brazilian Portuguese: the language it passes. */
const gameSay = (text, language = 'pt-BR') => sayWith(voice, text, language);
const setSoundOn = (v) => { som = v; };
const setVolume = (v) => { volume = v; };

beforeEach(() => {
  spoke = []; cancels = 0; vozes = []; getVoicesLanca = false; som = true; volume = 0.6;
  synth = {
    cancel: () => { cancels++; },
    speak: (u) => spoke.push(u),
    getVoices: () => { if (getVoicesLanca) throw new Error('sem vozes carregadas'); return vozes; },
  };
});
describe('platform/speech · gameSay só fala quando há o que dizer e o som está ligado', () => {
  it('[Feliz] fala o texto, na língua que o jogo disse', () => {
    gameSay('lata é metal');
    expect(spoke).toHaveLength(1);
    expect(spoke[0].text).toBe('lata é metal');
    expect(spoke[0].lang).toBe('pt-BR');
  });

  it('🔴 [Right] an English word is asked of the browser in English, with the English voice — not the forced pt-BR', () => {
    vozes = [PT_BR, EN];
    gameSay('apple', 'en-US');
    expect(spoke[0].lang).toBe('en-US');
    expect(spoke[0].voice).toBe(EN);
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
    synth = null;
    expect(() => gameSay('lata')).not.toThrow();
    expect(spoke).toHaveLength(0);
  });
});

// ADR-0243 §2 is the rule, and it supersedes this module's own ladder (pt-BR, then a `pt` voice whose NAME says Brasil, then a
// region-less `pt`, never pt-PT): the exact tag first, then the FIRST voice of the same language, and never another language.
describe('platform/speech · the voice of the language (ADR-0243 §2)', () => {
  it('[Feliz] pt-BR exacto ganha de tudo', () => {
    vozes = [EN, PT_PT, PT_SEM_REGIAO_BR, PT_BR];
    gameSay('lata');
    expect(spoke[0].voice).toBe(PT_BR);
  });

  it('🔴 [Right] with no exact tag, the first voice of the language reads it — pt-PT when it comes first', () => {
    vozes = [EN, PT_PT, PT_SEM_REGIAO_BR, PT_SEM_REGIAO];
    gameSay('lata');
    expect(spoke[0].voice).toBe(PT_PT);
  });

  it('🔴 [Right] with pt-PT the only Portuguese voice installed, it reads the Portuguese word — not the system default', () => {
    vozes = [EN, PT_PT];
    gameSay('lata');
    expect(spoke).toHaveLength(1);
    expect(spoke[0].voice).toBe(PT_PT);
    expect(spoke[0].lang).toBe('pt-BR');
  });

  it('🔴 [Right] §3 · a device that lists voices and none of the language says nothing — no voice of another language', () => {
    vozes = [EN];
    gameSay('lata');
    expect(spoke, 'a Portuguese word read by an English voice').toEqual([]);
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

// ===== MUTATIONS CHECKED (ADR-0243 §4, 2026-09-26) =====
// Applied one at a time to `platform/speech.ts` by a script that counts the occurrences, restored from a copy, checked by SHA-256:
// 1. `u.lang = 'pt-BR'` again (the forced tag)                 → red: the English word
// 2. the §3 guard removed (a device with voices, none of the language) → red: §3
// 3. the guard applied to a device that lists no voice yet       → red: seven cases, the empty list and the throwing one among them
// 4. the chosen voice never set on the utterance                 → red: the English word, pt-BR exact, the two pt-PT cases
// (A default language in the signature is red in `tsc`: `tests/a-spoken-text-carries-its-language.types.node.test.ts`.)
