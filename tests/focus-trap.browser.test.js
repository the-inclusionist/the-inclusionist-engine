// SPDX-License-Identifier: AGPL-3.0-or-later
// A ARMADILHA DE FOCO NO NAVEGADOR — a linha da issue #109 que só um navegador pode responder:
// *"Tab não pode alcançar o jogo enquanto um overlay está aberto, aferido num teste de navegador."*
//
// O project node afere a REGRA (`nextInTrap`) sem DOM nenhum. O que precisa de navegador é o resto, e
// é onde as armadilhas de foco costumam falhar: quem está focado de verdade, o que conta como visível, e se o
// `preventDefault` chega a tempo.
//
// ⚠️ E ESTE FICHEIRO JÁ REPROVOU UMA JUSTIFICATIVA MINHA, o que vale mais registrar do que apagar. Ele dizia
// aqui que `offsetParent` devolve `null` para «qualquer elemento em `position: fixed`». Não devolve — é `null`
// para o elemento FIXO em si, e os descendentes dele devolvem o próprio contêiner. Escrevi a asserção, ela
// ficou vermelha, e a explicação é que estava errada, não o código.
//
// O que ficou no lugar é a propriedade que interessa e que não depende de saber onde `offsetParent` tem
// buracos: um diálogo que não desenha nada não pode oferecer foco a nada. Trocar «o foco escapa» por «o foco
// desapareceu num botão invisível» seria piorar.
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
/** ⚠️ As armadilhas instaladas por cada caso, para SAIR no fim dele. Ver o `[Zero]` lá em baixo: sem isto, a
 *  armadilha de um caso continuava a prender o foco no caso seguinte, e o vermelho aparecia no lugar errado. */
let instaladas = [];
beforeEach(() => {
  raiz = document.createElement('div');
  raiz.innerHTML = MARCACAO;
  document.body.appendChild(raiz);
  document.querySelector('#dlg').style.cssText = 'position:fixed;inset:0'; // os diálogos reais são posicionados
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
    // Os três por motivos diferentes, e o terceiro é o mais fácil de errar: o card do diálogo tem
    // `tabindex="-1"` para receber foco POR PROGRAMA. Se entrasse no ciclo, a criança tabularia para um
    // contêiner que não faz nada e pareceria que o Tab tinha parado de funcionar.
    const nomes = focusablesInDom($('#dlg')).map((el) => el.id);
    expect(nomes).not.toContain('d-tres');   // disabled
    expect(nomes).not.toContain('d-quatro'); // hidden
    expect(focusablesInDom($('#dlg')).some((el) => el.matches('.overlay__card'))).toBe(false);
  });

  it('[Boundary] ⚠️ um diálogo ESCONDIDO não oferece foco nenhum — e é assim que o Tab volta a ser do jogo', () => {
    // A propriedade que a visibilidade tem de ter: um diálogo que existe no DOM e não desenha nada não pode
    // dar foco a nada. Se desse, a armadilha prenderia o Tab em botões que a criança não vê nem alcança —
    // trocar «o foco escapa» por «o foco desapareceu» seria piorar.
    //
    // ⚠️ E É AQUI QUE UMA JUSTIFICATIVA MINHA CAIU. Este caso dizia antes que `offsetParent` é `null` para
    // tudo em `position: fixed`. Não é: é `null` para o elemento FIXO, e os descendentes devolvem o próprio
    // contêiner. O teste reprovou a afirmação em vez de a acompanhar, que é o serviço que ele presta.
    expect(getComputedStyle($('#dlg')).position).toBe('fixed'); // o diálogo é posicionado, como os reais
    expect(focusablesInDom($('#dlg')).length, 'visível, oferece os três').toBe(3);

    $('#dlg').style.display = 'none';
    expect(focusablesInDom($('#dlg')), 'escondido, não oferece nenhum').toEqual([]);
  });
});

describe('o Tab NÃO alcança o jogo enquanto o diálogo está aberto', () => {
  /** Monta a armadilha, INSTALA e regista para o `afterEach` a desinstalar. */
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

  /** Um Tab de verdade, na fase de captura, como o navegador o entrega. */
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
    // O caso realista: o diálogo abriu e o foco ficou onde estava, ou a criança clicou no tabuleiro. Sem
    // isto, a armadilha só serviria a quem já estava dentro dela.
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
    expect(document.activeElement.id).toBe('jogo-1'); // ninguém moveu; quem moveria é o navegador
  });
});
