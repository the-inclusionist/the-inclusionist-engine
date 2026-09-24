// SPDX-License-Identifier: AGPL-3.0-or-later
// THE FOCUS TRAP — the second thread of issue #109.
//
// ⚠️ Every `.overlay__card` carries `aria-modal="true"`, which tells assistive technology the rest of the page is inert.
// Tab must agree. A promise the keyboard contradicts is worse than no promise — a screen-reader user leaves the dialog
// for a game whose state they cannot perceive, with no way back they can perceive.
//
// The RULE is pure and lives here; what needs a browser is only reading who is focused and calling `.focus()`.
import { describe, it, expect } from 'vitest';
import { nextInTrap, initFocusTrap, FOCUSABLE_SELECTOR } from '../app/js/ui/focus-trap.js';

const LISTA = ['a', 'b', 'c'];

describe('proximoNaArmadilha — o ciclo fecha nas BORDAS, e o meio é do navegador', () => {
  it('[Right] do último para a frente volta ao primeiro; do primeiro para trás vai ao último', () => {
    expect(nextInTrap(LISTA, 'c', false)).toBe('a');
    expect(nextInTrap(LISTA, 'a', true)).toBe('c');
  });

  it('[Right] ⚠️ o foco que está FORA do diálogo é trazido de volta', () => {
    // The case the others do not cover, and the likeliest in practice: focus may have escaped before the trap was
    // attached, or through a click on the board, or because the dialog opened without focusing anything. Without this
    // the trap would serve only whoever was already inside — that is, whoever did not need it.
    expect(nextInTrap(LISTA, 'zzz', false)).toBe('a');
    expect(nextInTrap(LISTA, 'zzz', true)).toBe('c');
    expect(nextInTrap(LISTA, null, false)).toBe('a');
  });

  it('[Right] no MEIO devolve null — reimplementar a ordem de tabulação seria errar onde já se acerta', () => {
    // The browser already resolves positive `tabindex`, DOM order and what `contenteditable` makes focusable. A trap
    // that walks the middle can get it wrong; one that only closes the ends does not touch the middle.
    expect(nextInTrap(LISTA, 'b', false)).toBe(null);
    expect(nextInTrap(LISTA, 'b', true)).toBe(null);
  });

  it('[Zero] ⚠️ diálogo SEM nada focável deixa sair, e é deliberado', () => {
    // Holding focus in a mute dialog would leave the child no way out at all. Such a dialog is ITS OWN defect; the trap
    // does not fix that, and locking would trade one defect for a worse one.
    expect(nextInTrap([], 'a', false)).toBe(null);
    expect(nextInTrap([], null, true)).toBe(null);
  });

  it('[Boundary] com UM focável só, o ciclo é ele mesmo nos dois sentidos', () => {
    expect(nextInTrap(['só'], 'só', false)).toBe('só');
    expect(nextInTrap(['só'], 'só', true)).toBe('só');
  });
});

describe('initFocusTrap — quando a tecla é nossa, e quando não é', () => {
  /** A fake keyboard event that records whether it was consumed. */
  function tecla(key, shiftKey = false) {
    return { key, shiftKey, impedido: false, preventDefault() { this.impedido = true; } };
  }

  /** Builds the trap over a list of "elements" that only know how to receive focus. */
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
    // A trap that is always on would hold focus on the title screen, which is no dialog at all.
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
    // In the bubble phase the game would already have seen the Tab. It is the same reason as `menu-nav`'s, and an
    // asymmetry between the two would stay invisible until someone noticed only one of the dialogs holds.
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
    // The classic mistake: `[tabindex]` alone catches the `-1`s, which exist precisely to receive focus by program and
    // NEVER by tabbing. A dialog card with `tabindex="-1"` would enter the cycle, and the child would tab onto a
    // container that does nothing.
    expect(FOCUSABLE_SELECTOR).toContain('[tabindex]:not([tabindex="-1"])');
    expect(FOCUSABLE_SELECTOR).not.toMatch(/(^|,)\s*\[tabindex\]\s*(,|$)/);
  });
});
