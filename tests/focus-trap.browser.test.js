// SPDX-License-Identifier: AGPL-3.0-or-later
// THE FOCUS TRAP IN THE BROWSER — the line of issue #109 only a browser can answer: Tab cannot reach the game while an
// overlay is open, measured in a browser test.
//
// The node project measures the RULE (`nextInTrap`) with no DOM at all. What needs a browser is the rest, and it is
// where focus traps usually fail: who is really focused, what counts as visible, and whether `preventDefault` arrives
// in time.
//
// ⚠️ `offsetParent` is `null` for the FIXED element itself, not for its descendants, which return that container. So
// what is asserted is the property that matters and does not depend on where `offsetParent` has holes: a dialog that
// draws nothing cannot offer focus to anything. Trading «o foco escapa» for «o foco desapareceu num botão invisível»
// would make things worse.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initFocusTrap, focusablesInDom } from '../app/js/ui/focus-trap.js';

const MARCACAO = `
  <div id="game-region">
    <button id="jogo-1" type="button">botão do tabuleiro</button>
    <div id="dlg" class="overlay">
      <div class="overlay__card" role="dialog" aria-modal="true" tabindex="-1">
        <button id="d-um" type="button">um</button>
        <select id="d-dois"><option>a</option></select>
        <button id="d-tres" type="button" disabled>desativado</button>
        <button id="d-quatro" type="button" hidden>escondido</button>
        <button id="d-cinco" type="button">cinco</button>
      </div>
    </div>
    <button id="jogo-2" type="button">outro botão do tabuleiro</button>
  </div>`;

let raiz;
/** ⚠️ The traps each case installs, to DETACH at its end. See the `[Zero]` further down: without this, one case's trap
 *  kept holding focus in the next case, and the red showed up in the wrong place. */
let instaladas = [];
beforeEach(() => {
  raiz = document.createElement('div');
  raiz.innerHTML = MARCACAO;
  document.body.appendChild(raiz);
  document.querySelector('#dlg').style.cssText = 'position:fixed;inset:0'; // the real dialogs are positioned
  instaladas = [];
});
afterEach(() => { instaladas.forEach((a) => a.detach()); raiz.remove(); });

const $ = (s) => document.querySelector(s);

describe('focaveisNoDom — quem entra no ciclo, num documento de verdade', () => {
  it('[Right] pega os habilitados e visíveis, na ordem do documento', () => {
    const nomes = focusablesInDom($('#dlg')).map((el) => el.id);
    expect(nomes).toEqual(['d-um', 'd-dois', 'd-cinco']);
  });

  it('[Zero] ⚠️ o `disabled`, o `hidden` e o `tabindex="-1"` ficam de fora', () => {
    // All three for different reasons, and the third is the easiest to get wrong: the dialog card has `tabindex="-1"`
    // to receive focus BY PROGRAM. If it entered the cycle, the child would tab onto a container that does nothing and
    // Tab would seem to have stopped working.
    const nomes = focusablesInDom($('#dlg')).map((el) => el.id);
    expect(nomes).not.toContain('d-tres');   // disabled
    expect(nomes).not.toContain('d-quatro'); // hidden
    expect(focusablesInDom($('#dlg')).some((el) => el.matches('.overlay__card'))).toBe(false);
  });

  it('[Boundary] ⚠️ um diálogo ESCONDIDO não oferece foco nenhum — e é assim que o Tab volta a ser do jogo', () => {
    // The property visibility must have: a dialog that exists in the DOM and draws nothing cannot give focus to
    // anything. If it did, the trap would hold Tab on buttons the child neither sees nor reaches — trading
    // «o foco escapa» for «o foco desapareceu» would make things worse.
    //
    // ⚠️ `offsetParent` is `null` for the FIXED element, not for everything under `position: fixed`: its descendants
    // return that container.
    expect(getComputedStyle($('#dlg')).position).toBe('fixed'); // the dialog is positioned, like the real ones
    expect(focusablesInDom($('#dlg')).length, 'visível, oferece os três').toBe(3);

    $('#dlg').style.display = 'none';
    expect(focusablesInDom($('#dlg')), 'escondido, não oferece nenhum').toEqual([]);
  });
});

describe('o Tab NÃO alcança o jogo enquanto o diálogo está aberto', () => {
  /** Builds the trap, ATTACHES it and records it for the `afterEach` to detach. */
  function armar(temDialogo = true) {
    const api = initFocusTrap({
      topOverlay: () => (temDialogo ? $('#dlg') : null),
      currentFocus: () => document.activeElement,
      focusablesIn: focusablesInDom,
      win: window,
    });
    api.attach();
    instaladas.push(api);
    return api;
  }

  /** A real Tab, dispatched on the focused element as the browser delivers it. */
  function tabular({ shift = false } = {}) {
    const e = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: shift, bubbles: true, cancelable: true });
    document.activeElement.dispatchEvent(e);
    return e;
  }

  it('[Right] do ÚLTIMO controle do diálogo o Tab volta ao primeiro, e não ao botão do tabuleiro', () => {
    const api = armar();
    $('#d-cinco').focus();
    const e = tabular();
    expect(e.defaultPrevented).toBe(true);
    expect(document.activeElement.id).toBe('d-um');
  });

  it('[Right] Shift+Tab do primeiro vai ao último, também sem sair', () => {
    armar();
    $('#d-um').focus();
    tabular({ shift: true });
    expect(document.activeElement.id).toBe('d-cinco');
  });

  it('[Right] ⚠️ o foco que JÁ ESTAVA no tabuleiro é trazido para dentro do diálogo', () => {
    // The realistic case: the dialog opened and focus stayed where it was, or the child clicked the board. Without
    // this, the trap would serve only whoever was already inside it.
    armar();
    $('#jogo-1').focus();
    expect(document.activeElement.id).toBe('jogo-1');
    tabular();
    expect(document.activeElement.id).toBe('d-um');
  });

  it('[Zero] com o diálogo FECHADO o Tab é do jogo, e a armadilha não toca nele', () => {
    armar(false);
    $('#jogo-1').focus();
    const e = tabular();
    expect(e.defaultPrevented, 'a armadilha prendeu o foco sem haver diálogo aberto').toBe(false);
    expect(document.activeElement.id).toBe('jogo-1'); // nobody moved it; the browser would be the one to
  });
});
