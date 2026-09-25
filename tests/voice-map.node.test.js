// SPDX-License-Identifier: AGPL-3.0-or-later
// PLAYING BY VOICE: THE WORDS AND WHEN THEY PRESS (ADR-0204 erratum; issues #184, #190).
//
// The vocabulary is the Dev's, checked by the Dev against what games use and then run in the lab's bar protocol in three languages
// (pt 23/23, es 24/24, en 24/24 detected, all «ok»). What is measured here is that the table SAYS what he decided, that the
// closed grammar is built from it, and the rule that decides when a growing partial becomes a press — which is where a child
// either gets her command in a quarter of a second or loses it.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect } from 'vitest';
import { voiceWordsFor, voiceGrammar, createVoiceCommands } from '../app/js/input/voice-map.js';

describe('the vocabulary is the one the Dev decided', () => {
  it('🔴 [Right] every position of the controller has a word, in each of the three languages', () => {
    // 📌 The whole controller, which is the point of ADR-0204: a child who plays by voice reaches what a child on a pad reaches.
    const POSICOES = ['up', 'down', 'left', 'right', 'start', 'select', 'action1', 'action2', 'action3', 'action4',
      'leftShoulder', 'leftTrigger', 'rightShoulder', 'rightTrigger'];
    for (const lingua of ['pt', 'es', 'en']) {
      const tabela = voiceWordsFor(lingua);
      const semPalavra = POSICOES.filter((p) => !(tabela[p] && tabela[p].length));
      expect(semPalavra, `${lingua}: posições sem palavra nenhuma`).toEqual([]);
    }
  });

  it('🔴 [Right] e são as palavras dele, não outras parecidas', () => {
    // Literals: a table compared with itself measures nothing, and these words were chosen ONE by ONE against the games'
    // use (racing R2 accelerates / L2 brakes; shooting L2 aims / R2 fires) — changing them is a decision, not a detail.
    expect(voiceWordsFor('pt').leftShoulder).toEqual(['bombordo']);
    expect(voiceWordsFor('pt').rightTrigger).toEqual(['gatilho', 'acelera']);
    expect(voiceWordsFor('es').rightShoulder).toEqual(['estribor']);
    expect(voiceWordsFor('en').action2).toContain('pick up');
  });

  /*
   * 🔴 THIS CASE WAS WRITTEN BY A REAL MODEL, on 2026-09-21: with `acao` in the table, the pt Vosk answered «Ignoring word
   * missing in vocabulary: 'acao'» in the console and the first position went MUTE — the child said the word and nothing
   * happened, with no error anywhere. The recogniser's vocabulary keeps the word as the language writes it.
   *
   * ⚠️ AND THE OTHER HALF IS WHAT MAKES THIS SAFE: what COMPARES ignores accents (`wordsOf` strips them on both sides), so
   * writing correctly in the table cannot break recognition by a recogniser that writes without accents.
   */
  it('🔴 [Right] a mesa escreve a palavra como a LÍNGUA a escreve, e o acento não decide o disparo', () => {
    expect(voiceWordsFor('pt').action1, 'sem o cedilho o modelo pt ignora a palavra').toEqual(['ação']);
    expect(voiceWordsFor('es').action1).toEqual(['acción']);
    expect(voiceGrammar('pt'), 'a gramática pede ao modelo uma palavra que ele não tem').toContain('ação');
    const comAcento = createVoiceCommands('pt');
    expect(comAcento.partial('ação')).toBe('action1');
    const semAcento = createVoiceCommands('pt');
    expect(semAcento.partial('acao'), 'um reconhecedor que escreva sem acento deixou de ser entendido').toBe('action1');
  });

  it('📌 [Boundary] a região não é a língua, e uma etiqueta desconhecida cai no português (pilar 3)', () => {
    expect(voiceWordsFor('pt-BR').up).toEqual(['acima']);
    expect(voiceWordsFor('es-MX').up).toEqual(['arriba']);
    expect(voiceWordsFor('de-DE').up, 'uma língua que o projeto não fala ficaria sem comando nenhum').toEqual(['acima']);
  });
});

describe('a gramática fechada é o que o reconhecedor pode devolver', () => {
  it('🔴 [Right] traz todas as palavras da língua, e só uma vez cada', () => {
    const g = voiceGrammar('pt');
    expect(g).toContain('acima');
    expect(g).toContain('bombordo');
    expect(g.filter((p) => p === 'start').length, 'uma palavra repetida engorda a gramática sem acrescentar nada').toBe(1);
    expect(g).not.toContain('arriba');
  });

  it('🔴 [Right] e os nomes do MENU entram enquanto ele está aberto (ADR-0194)', () => {
    const g = voiceGrammar('pt', ['Voltar ao jogo', 'Configurações de inclusão']);
    expect(g, 'dizer o nome de um item não o alcançaria').toContain('voltar ao jogo');
    expect(g).toContain('configuracoes de inclusao');
  });

  it('[Zero] um nome vazio não entra — uma cadeia vazia casaria com tudo', () => {
    expect(voiceGrammar('pt', ['', '   ', '!!'])).toEqual(voiceGrammar('pt'));
  });
});

describe('quando uma palavra ouvida vira uma pressão', () => {
  it('🔴 [Right] o parcial cresce e SÓ O QUE É NOVO dispara', () => {
    const v = createVoiceCommands('pt');
    expect(v.partial('acima')).toBe('up');
    // 🔴 The second word is a second command, and not the first again: without this the child who says two things moves once.
    expect(v.partial('acima abaixo')).toBe('down');
    expect(v.partial('acima abaixo'), 'o mesmo parcial disparou duas vezes').toBeNull();
  });

  it('🔴 [Right] uma posição que responde a uma FRASE é lida inteira', () => {
    const v = createVoiceCommands('en');
    expect(v.partial('pick up'), 'ler só a última palavra deixaria «pick up» sem resposta').toBe('action2');
  });

  it('[Zero] uma palavra que não é comando não dispara nada', () => {
    const v = createVoiceCommands('pt');
    expect(v.partial('elefante')).toBeNull();
    // and it does not stay owing: the next word does fire
    expect(v.partial('elefante acima')).toBe('up');
  });

  it('🔴 [Right] acento e maiúscula são do reconhecedor, não da criança', () => {
    expect(createVoiceCommands('pt').partial('AÇÃO')).toBe('action1');
    expect(createVoiceCommands('pt').partial('acao'), 'um reconhecedor que escreve sem acento deixaria a criança sem o botão').toBe('action1');
  });

  it('🔴 [Right] uma frase nova começa do zero — pelo `reset` e por um parcial que ENCOLHEU', () => {
    const v = createVoiceCommands('pt');
    expect(v.partial('acima abaixo')).toBe('down');
    v.reset();
    expect(v.partial('acima'), 'depois do fim da frase, a mesma palavra é um comando novo').toBe('up');
    // ⚠️ And without `reset`: a recogniser that restarts by itself returns a SHORTER partial, and what was already answered no
    // longer counts.
    expect(v.partial('abaixo')).toBe('down');
  });
});

// MUTATIONS CHECKED (2026-09-21) — `scratchpad/mutar-voz-em-comando.py`.
