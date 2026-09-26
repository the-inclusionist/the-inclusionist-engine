// SPDX-License-Identifier: AGPL-3.0-or-later
// WHAT THE INTERPRETER HANDS THE PLAYER (ADR-0234, route A — plan item 5b; `ui/libras-glosses`): the gloss the delivery wrote for
// the text on screen, looked up — and today's rule (capitals, accents stripped, fingerspelled) for whatever the file does not
// cover. The glosses below are the real translator's (vlibras-translator 1.3.3, rules, pt_core_news_md 3.8.0), copied from a run
// over the engine's dictionary; the screen texts are shaped as `ui/screen-text` reads them: one sentence per line, joined.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, vi } from 'vitest';
import { glosserOf, loadGlosser, provisionalGloss, LIBRAS_GLOSSES_FILE } from '../app/js/ui/libras-glosses.js';

const FILE = {
  format: 1,
  made: 'vlibras-translator 1.3.3 (rules) · pt_core_news_md 3.8.0 · spaCy 3.8.16',
  glosses: [
    ['(sem vozes do sistema)', 'SEM VOZ SISTEMA'],
    ['Alto contraste: {v}.', 'ALTO CONTRASTE {v} [PONTO]'],
    ['Jogador {n} entrou!', 'JOGADOR {n} ENTRAR [EXCLAMAÇÃO]'],
    ['Modo Print: veja a tela sem menus. Aperte qualquer botão para voltar.',
      'MODO PRINT VER TELA SEM MENU [PONTO] APERTAR QUALQUER BOTAO PARA VOLTAR [PONTO]'],
    ['Olhe aqui', 'OLHE AQUI'],
    ['Você soltou: {o}.', 'VOCE SOLTAR {o} [PONTO]'],
    ['caixa de papelão', 'CAIXA PAPELAO'],
    ['{o} caiu.', '{o} CAIR [PONTO]'],
    ['ligado', 'LIGAR'],
  ],
};

describe('ui/libras-glosses — a known text is looked up', () => {
  it('🔴 [Right] a dictionary string on screen is handed over as its gloss, not as its words spelled', () => {
    expect(glosserOf(FILE)('Ligado.'), 'spelled where the delivery had its gloss').toBe('LIGAR');
  });

  it('🔴 [Right] however the screen wrote it: case, spaces, and the punctuation or icon at its edges do not matter', () => {
    const gloss = glosserOf(FILE);
    expect(gloss('  OLHE   aqui!  ')).toBe('OLHE AQUI');
    expect(gloss('👁 Olhe aqui')).toBe('OLHE AQUI');
    expect(gloss('sem vozes do sistema.')).toBe('SEM VOZ SISTEMA');
  });

  it('🔴 [Right] a string of two sentences, which the screen reader cut in two, is still found — as one gloss', () => {
    expect(glosserOf(FILE)('Modo Print: veja a tela sem menus. Aperte qualquer botão para voltar.'))
      .toBe('MODO PRINT VER TELA SEM MENU [PONTO] APERTAR QUALQUER BOTAO PARA VOLTAR [PONTO]');
  });
});

describe('ui/libras-glosses — a template, and the value in its hole', () => {
  it('🔴 [Right] the value that is itself a known text is put in as ITS gloss', () => {
    expect(glosserOf(FILE)('Você soltou: caixa de papelão.')).toBe('VOCE SOLTAR CAIXA PAPELAO [PONTO]');
    expect(glosserOf(FILE)('Alto contraste: ligado.')).toBe('ALTO CONTRASTE LIGAR [PONTO]');
  });

  it('🔴 [Right] a value with no gloss — a number, a name — is fingerspelled by today\'s rule', () => {
    expect(glosserOf(FILE)('Jogador 2 entrou!')).toBe('JOGADOR 2 ENTRAR [EXCLAMAÇÃO]');
    expect(glosserOf(FILE)('Você soltou: Açaí.')).toBe('VOCE SOLTAR AÇAI [PONTO]');
  });
});

describe('ui/libras-glosses — what the file does not cover falls back, alone', () => {
  it('🔴 [Right] a sentence nothing matches gets today\'s rule, and the sentences around it keep their glosses', () => {
    expect(glosserOf(FILE)('Olhe aqui. Qual é a capital do Piauí? Jogador 1 entrou!'))
      .toBe('OLHE AQUI QUAL E A CAPITAL DO PIAUI JOGADOR 1 ENTRAR [EXCLAMAÇÃO]');
  });

  it('🔴 [Right] no file, a fallback page, another format: every text gets today\'s rule — the signing does not stop', () => {
    const other = [null, undefined, '<!doctype html>', { format: 2, glosses: [['Olhe aqui', 'BOOM']] },
      { format: 1, glosses: [['Olhe aqui', 1]] }, { format: 1, glosses: 'Olhe aqui' }];
    for (const data of other) expect(glosserOf(data)('Olhe aqui, Avião!'), JSON.stringify(data)).toBe('OLHE AQUI AVIAO');
    for (const data of other) expect(glosserOf(data)('Olhe aqui'), JSON.stringify(data)).toBe('OLHE AQUI');
  });

  it('🔴 [Right] a hole never swallows the sentence before it: a template that starts with a hole matches its own sentence', () => {
    expect(glosserOf(FILE)('Olhe aqui. Caixa de papelão caiu.')).toBe('OLHE AQUI CAIXA PAPELAO CAIR [PONTO]');
  });

  it('🎯 [Zero] a template that is all holes matches nothing — it would have swallowed every screen', () => {
    const gloss = glosserOf({ ...FILE, glosses: [['{a}', '{a} BOOM'], ['{a}: {b}', 'X']] });
    expect(gloss('Olhe aqui')).toBe('OLHE AQUI');
  });

  it('📌 [Boundary] today\'s rule: capitals, accents stripped, anything not a letter or digit a separator', () => {
    expect(provisionalGloss('Avião, casa! 3')).toBe('AVIAO CASA 3');
    expect(provisionalGloss(' … !')).toBe('');
    expect(provisionalGloss('ÁÉÍÓÚ âêô ãõ ü à'), 'an accented vowel kept its mark: the player has no clip for it').toBe('AEIOU AEO AO U A');
  });

  it('🔴 [Right] today\'s rule keeps Ç — «caça», «espaço» are spelled CAÇA, ESPAÇO: a letter of the manual alphabet both routes sign', () => {
    expect(provisionalGloss('A caça no espaço!'), 'Ç was spelled as C').toBe('A CAÇA NO ESPAÇO');
    expect(provisionalGloss('Ação'), 'Ç was spelled as C, or Ã kept').toBe('AÇAO');
    expect(provisionalGloss('ça'), 'a Ç written as C and a combining cedilla was spelled as C').toBe('ÇA');
  });
});

describe('ui/libras-glosses — reading the delivered file', () => {
  it('🔴 [Right] read through the fetch it is given, at the address it is given', async () => {
    const fetchFile = vi.fn(async () => ({ ok: true, json: async () => FILE }));
    const gloss = await loadGlosser(fetchFile, 'https://x.example/libras/player/glosses.json');
    expect(fetchFile).toHaveBeenCalledWith('https://x.example/libras/player/glosses.json');
    expect(gloss('Olhe aqui')).toBe('OLHE AQUI');
    expect(LIBRAS_GLOSSES_FILE).toBe('glosses.json');
  });

  it('🔴 [Right] no fetch, a 404, a network error, a body that is not JSON: today\'s rule, and never a rejection', async () => {
    const fallbacks = [
      await loadGlosser(undefined, 'x'),
      await loadGlosser(async () => ({ ok: false, json: async () => FILE }), 'x'),
      await loadGlosser(async () => { throw new TypeError('offline'); }, 'x'),
      await loadGlosser(async () => ({ ok: true, json: async () => { throw new SyntaxError('html'); } }), 'x'),
    ];
    for (const gloss of fallbacks) expect(gloss('Jogador 2 entrou!')).toBe('JOGADOR 2 ENTROU');
  });
});

// ============================== MUTATIONS CHECKED ==============================
// (each run on `app/js/ui/libras-glosses.ts` and restored; the red is the case that caught it)
//   L1 the known texts never looked up                    🔴 a dictionary string is handed over as its gloss · however the screen wrote it
//   L2 one sentence at a time (no longer runs)            🔴 a string of two sentences · the value that is a known text · a value fingerspelled
//   L3 a hole's value may cross a sentence's end          🔴 a hole never swallows the sentence before it
//   L4 a hole's value never looked up                     🔴 the value that is itself a known text
//   L5 the edges not stripped                             🔴 however the screen wrote it
//   L6 the file's format not checked                      🔴 no file, a fallback page, another format
//   L7 a template of holes only kept                      🎯 a template that is all holes matches nothing
//   L8 a 404's body read as glosses                       🔴 no fetch, a 404, a network error, a body that is not JSON
// (2026-09-25, Ç spelled as written: scripted, restored from a copy and checked by sha256)
//   L9 today's rule strips Ç's cedilla                    🔴 today's rule keeps Ç · a value fingerspelled
//   L10 today's rule keeps every mark                     🔴 today's rule: capitals, accents stripped · today's rule keeps Ç and 3 more
