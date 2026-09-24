// SPDX-License-Identifier: AGPL-3.0-or-later
// A ARMADILHA DE FOCO — o segundo fio da issue #109, e o único dos três que não existia em lado nenhum.
//
// Os outros dois eram construídos e deixados desligados. Este nunca tinha sido escrito, e
// `ui/settings-panel.ts:17-19` registra a ausência por escrito.
//
// ⚠️ E O DOCUMENTO JÁ PROMETIA O CONTRÁRIO: todo `.overlay__card` do `index.html` tem `aria-modal="true"`, que
// diz à tecnologia assistiva que o resto da página está inerte. O Tab discordava. Uma promessa que o teclado
// desmente é pior do que promessa nenhuma — quem usa leitor de tela sai do diálogo para um jogo cujo estado
// não consegue perceber, e não tem caminho de volta que perceba.
//
// A REGRA é pura e mora aqui; o que precisa de navegador é só ler quem está focado e chamar `.focus()`.
import { describe, it, expect } from 'vitest';
import { nextInTrap, initFocusTrap, FOCUSABLE_SELECTOR } from '../app/js/ui/focus-trap.js';

const LISTA = ['a', 'b', 'c'];

describe('proximoNaArmadilha — o ciclo fecha nas BORDAS, e o meio é do navegador', () => {
  it('[Right] do último para a frente volta ao primeiro; do primeiro para trás vai ao último', () => {
    expect(nextInTrap(LISTA, 'c', false)).toBe('a');
    expect(nextInTrap(LISTA, 'a', true)).toBe('c');
  });

  it('[Right] ⚠️ o foco que está FORA do diálogo é trazido de volta', () => {
    // É o caso que os outros não cobrem, e o mais provável na prática: o foco pode já ter escapado antes de
    // esta armadilha existir, ou por um clique no tabuleiro, ou porque o diálogo abriu sem focar nada. Sem
    // isto a armadilha só serviria a quem já estava dentro — ou seja, a quem não precisava dela.
    expect(nextInTrap(LISTA, 'zzz', false)).toBe('a');
    expect(nextInTrap(LISTA, 'zzz', true)).toBe('c');
    expect(nextInTrap(LISTA, null, false)).toBe('a');
  });

  it('[Right] no MEIO devolve null — reimplementar a ordem de tabulação seria errar onde já se acerta', () => {
    // O navegador já resolve `tabindex` positivo, ordem do DOM e o que fica focável por `contenteditable`.
    // Uma armadilha que caminha pelo meio tem como errar; uma que só fecha as pontas não toca no meio.
    expect(nextInTrap(LISTA, 'b', false)).toBe(null);
    expect(nextInTrap(LISTA, 'b', true)).toBe(null);
  });

  it('[Zero] ⚠️ diálogo SEM nada focável deixa sair, e é deliberado', () => {
    // Prender o foco num diálogo mudo deixaria a criança sem saída nenhuma. Um diálogo assim é defeito DELE;
    // a armadilha não conserta isso, e trancar seria trocar um defeito por um pior.
    expect(nextInTrap([], 'a', false)).toBe(null);
    expect(nextInTrap([], null, true)).toBe(null);
  });

  it('[Boundary] com UM focável só, o ciclo é ele mesmo nos dois sentidos', () => {
    expect(nextInTrap(['só'], 'só', false)).toBe('só');
    expect(nextInTrap(['só'], 'só', true)).toBe('só');
  });
});

describe('initFocusTrap — quando a tecla é nossa, e quando não é', () => {
  /** Um evento de teclado de mentira que registra se foi consumido. */
  function tecla(key, shiftKey = false) {
    return { key, shiftKey, impedido: false, preventDefault() { this.impedido = true; } };
  }

  /** Monta a armadilha sobre uma lista de "elementos" que só sabem receber foco. */
  function armar({ dialogo = {}, focaveis = null, foco = null } = {}) {
    const focados = [];
    const el = (n) => ({ n, focus() { focados.push(n); } });
    const lista = (focaveis ?? ['um', 'dois']).map(el);
    let atual = foco === null ? null : lista.find((e) => e.n === foco) ?? { n: foco, focus() {} };
    const api = initFocusTrap({
      topOverlay: () => dialogo,
      currentFocus: () => atual,
      focusablesIn: () => lista,
      win: { addEventListener: () => {} },
    });
    return { api, focados, lista, trocar: (n) => { atual = lista.find((e) => e.n === n) ?? null; } };
  }

  it('[Right] Tab na última opção volta à primeira, e CONSOME a tecla', () => {
    const { api, focados } = armar({ foco: 'dois' });
    const e = tecla('Tab');
    api.onKeydown(e);
    expect(focados).toEqual(['um']);
    expect(e.impedido, 'sem preventDefault o navegador move o foco a seguir e a armadilha não serve').toBe(true);
  });

  it('[Right] Shift+Tab na primeira vai à última', () => {
    const { api, focados } = armar({ foco: 'um' });
    api.onKeydown(tecla('Tab', true));
    expect(focados).toEqual(['dois']);
  });

  it('[Zero] ⚠️ SEM diálogo aberto a armadilha não faz nada — o Tab é do jogo', () => {
    // Uma armadilha sempre ligada prenderia o foco na tela de título, que não é diálogo nenhum.
    const { api, focados } = armar({ dialogo: null, foco: 'dois' });
    const e = tecla('Tab');
    api.onKeydown(e);
    expect(focados).toEqual([]);
    expect(e.impedido).toBe(false);
  });

  it('[Zero] outra tecla qualquer passa intacta', () => {
    const { api, focados } = armar({ foco: 'dois' });
    for (const k of ['Escape', 'ArrowDown', 'Enter', ' ']) {
      const e = tecla(k);
      api.onKeydown(e);
      expect(e.impedido, k).toBe(false);
    }
    expect(focados).toEqual([]);
  });

  it('[Interface] no MEIO do diálogo a tecla NÃO é consumida — o navegador caminha', () => {
    const { api, focados } = armar({ focaveis: ['um', 'dois', 'tres'], foco: 'dois' });
    const e = tecla('Tab');
    api.onKeydown(e);
    expect(e.impedido).toBe(false);
    expect(focados).toEqual([]);
  });

  it('[Interface] instala na fase de CAPTURA — antes de quem está por baixo', () => {
    // Na fase de bolha o jogo já teria visto o Tab. É a mesma razão do `menu-nav`, e a assimetria entre os
    // dois seria invisível até alguém reparar que só um dos diálogos prende.
    const ouvintes = [];
    initFocusTrap({
      topOverlay: () => null, currentFocus: () => null, focusablesIn: () => [],
      win: { addEventListener: (tipo, fn, captura) => ouvintes.push({ type: tipo, captura }) },
    }).attach();
    expect(ouvintes).toEqual([{ type: 'keydown', captura: true }]);
  });
});

describe('o SELETOR do que é focável', () => {
  it('[Right] cobre os controles que os diálogos desta engine usam', () => {
    for (const parte of ['button:not([disabled])', 'select:not([disabled])', 'input:not([disabled])']) {
      expect(FOCUSABLE_SELECTOR, parte).toContain(parte);
    }
  });

  it('[Zero] ⚠️ `tabindex="-1"` NÃO é focável por Tab, e o seletor tem de o excluir', () => {
    // É o erro clássico: `[tabindex]` sozinho apanha os `-1`, que existem justamente para receber foco por
    // programa e NUNCA por tabulação. Um card de diálogo com `tabindex="-1"` entraria no ciclo, e a criança
    // tabularia para um contêiner que não faz nada.
    expect(FOCUSABLE_SELECTOR).toContain('[tabindex]:not([tabindex="-1"])');
    expect(FOCUSABLE_SELECTOR).not.toMatch(/(^|,)\s*\[tabindex\]\s*(,|$)/);
  });
});
