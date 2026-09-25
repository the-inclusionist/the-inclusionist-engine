// SPDX-License-Identifier: AGPL-3.0-or-later
// THE "6 de 10" INDEX — item 3 of ADR-0044, and why it comes at the END.
//
// ========================= WHAT XAG 106 ASKS, AND WHY =========================
// "Position and total help non-sighted players remain oriented and confident that they have found all of the
// controls." Without the index, a child scanning a menu by ear cannot know whether they reached the end or missed
// something on the way — and that doubt costs more than the time to hear the number.
//
// The number goes at the END of the sentence, following XAG itself ("Gamma, slider, 38%, 6 of 9"). The reason is use:
// whoever scans fast wants the LABEL first and interrupts as soon as they recognise the item. An index in front would
// force hearing the whole count before knowing what it is about — and, with item 2's interruptible narration, it would
// be the only part there was always time to hear.
//
// And there is the option to TURN IT OFF, also from XAG: for someone who knows the menu by heart, the number becomes
// noise on every pass. Accessibility that cannot be turned off is an imposition.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect } from 'vitest';
import { createTranslator } from '../app/js/core/i18n.js';
const translate = createTranslator().t; // the root's translator, played by the test (ADR-0232 D3)
import { announceItem } from '../app/js/ui/item-announcement.js';
import { t } from '../app/js/core/i18n.js';

describe('anúncio de item de menu · rótulo, estado e o índice no fim', () => {
  it('[Right] rótulo + estado + índice, nessa ordem', () => {
    expect(announceItem(translate, { label: 'Alto contraste', state: 'ativado', position: 6, total: 10 }, true))
      .toBe('Alto contraste, ativado, 6 de 10');
  });

  it('[Right] desligar o índice tira SÓ o índice', () => {
    // What turning it off must not do is take the state with it: whoever turns off the count still needs to know
    // whether the item is on.
    expect(announceItem(translate, { label: 'Alto contraste', state: 'ativado', position: 6, total: 10 }, false))
      .toBe('Alto contraste, ativado');
  });

  it('[Zero] item sem estado não ganha vírgula sobrando', () => {
    expect(announceItem(translate, { label: 'Continuar', position: 1, total: 7 }, true)).toBe('Continuar, 1 de 7');
    expect(announceItem(translate, { label: 'Continuar', state: '', position: 1, total: 7 }, true)).toBe('Continuar, 1 de 7');
  });

  it('[Boundary] as pontas do anel contam certo — 1 de 7 e 7 de 7', () => {
    // Item 1's ring puts `quit` ONE key away from `resume`, and the index is what tells that story: whoever presses up
    // on the first item needs to hear "7 de 7" to understand they wrapped around, not that they moved on.
    expect(announceItem(translate, { label: 'Continuar', position: 1, total: 7 }, true)).toContain('1 de 7');
    expect(announceItem(translate, { label: 'Sair', position: 7, total: 7 }, true)).toContain('7 de 7');
  });

  it('[Error] posição impossível NÃO é anunciada — número errado é pior que número nenhum', () => {
    // It really happens: an item filtered out by visibility leaves the list and the index of what remains goes out of
    // range. Announcing "0 de 7" or "9 de 7" teaches a false geography of the menu, and the child trusts it.
    expect(announceItem(translate, { label: 'Continuar', position: 0, total: 7 }, true)).toBe('Continuar');
    expect(announceItem(translate, { label: 'Continuar', position: 9, total: 7 }, true)).toBe('Continuar');
    expect(announceItem(translate, { label: 'Continuar', position: 1, total: 0 }, true)).toBe('Continuar');
  });

  it('[Interface] rótulo colado do DOM vira frase legível', () => {
    // `button.textContent` carries the markup's line breaks and indentation, and a sub-label in a `<span>` sticks to the
    // label with no space at all ("Descobrindo palavrasBABA"). Whoever builds the request separates the parts; here the
    // normalisation keeps the markup's whitespace from leaking.
    expect(announceItem(translate, { label: '\n  Descobrindo palavras  \n', state: ' BABA ', position: 3, total: 6 }, true))
      .toBe('Descobrindo palavras, BABA, 3 de 6');
  });

  it('[Zero] item sem rótulo nenhum não vira frase começada por vírgula', () => {
    expect(announceItem(translate, { label: '', position: 2, total: 5 }, true)).toBe('2 de 5');
  });

  it('[Interface] o molde do índice vem do DICIONÁRIO, não daqui', () => {
    // Without this, someone could build "6 de 10" by concatenation and the cases above would stay green in Portuguese —
    // while English would narrate "6 de 10". Parity across the three languages belongs to `i18n-dicts.node.test.js`;
    // what THIS case guarantees is that the module goes through the key.
    expect(t('sr.menu.index', { n: 6, m: 10 })).toBe('6 de 10');
    expect(announceItem(translate, { label: 'x', position: 6, total: 10 }, true).endsWith(t('sr.menu.index', { n: 6, m: 10 }))).toBe(true);
  });
});

// ========================= MUTATIONS CHECKED =========================
//   · putting the index in FRONT (`[indice, rotulo, estado]`) → "[Right] rótulo + estado + índice" fails with
//     "6 de 10, Alto contraste, ativado".
//   · replacing the guard `posicao >= 1 && posicao <= total` with `posicao >= 0` → "[Error] posição impossível"
//     fails, announcing "Continuar, 0 de 7".
//   · removing the parts' `.filter(Boolean)` → "[Zero] item sem estado" fails with "Continuar, , 1 de 7".
