// SPDX-License-Identifier: AGPL-3.0-or-later
// THE REACH SCREEN IN A BROWSER (issue #112). The node project checks the SENTENCES; here it is the card: that it
// appears, that a blind child HEARS it, that it is keyboard-operable, and — above all — that it does not lock.
//
// ⚠️ IT INFORMS AND DOES NOT REFUSE, and that is the decision the rest depends on. Keyboard detection is imprecise by
// nature: no API says «há um teclado físico ligado», and a tablet WITH a keyboard answers «toque» to
// `pointer:coarse && hover:none`. If this card blocked, that tablet would get a FALSE REFUSAL in a game it plays.
// Informing, the error costs one sentence more and never a closed door — and that is why the case of the
// «jogar assim mesmo» button is the most important one in this file.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { showReachNotice, REACH_NOTICE_ID } from '../app/js/ui/reach-notice.js';
import { reach, defaultTransports } from '../app/js/input/transports.js';
import { focusablesInDom } from '../app/js/ui/focus-trap.js';
import { ACTIONS } from '../app/js/core/actions.js';
import pt from '../app/js/i18n/pt.js';

const sempre = () => true, nunca = () => false;
/** The issue's case: touch only, and it is short for the fourteen. */
const TABLET = () => reach(defaultTransports({ gamepad: nunca, keyboard: nunca, touch: sempre, mouse: nunca }), ACTIONS);
const DESKTOP = () => reach(defaultTransports({ gamepad: nunca, keyboard: sempre, touch: nunca, mouse: sempre }), ACTIONS);

const traduz = (k, p) => {
  let s = pt[k] ?? k;
  for (const [a, b] of Object.entries(p ?? {})) s = s.split(`{${a}}`).join(String(b));
  return s;
};

let raiz, ditos;
beforeEach(() => {
  raiz = document.createElement('div');
  raiz.innerHTML = '<div id="game-region"><button id="do-jogo" type="button">um botão do jogo</button></div>';
  document.body.appendChild(raiz);
  ditos = [];
});
afterEach(() => { raiz.remove(); });

const ctx = () => ({
  find: (sel) => document.querySelector(sel),
  create: (tag) => document.createElement(tag),
  t: traduz,
  srAlert: (s) => ditos.push(s),
});
const cartao = () => document.querySelector('#' + REACH_NOTICE_ID);

describe('o cartão aparece — e só quando há o que dizer', () => {
  it('[Right] com o toque curto, o cartão entra no documento com as três frases', () => {
    expect(showReachNotice(ctx(), TABLET())).toBe(true);
    const ps = [...cartao().querySelectorAll('p')].map((p) => p.textContent);
    expect(ps).toHaveLength(3);
    expect(ps[0]).toBe('Este jogo usa 14 ações.');
    expect(ps[1]).toContain('13 lugares'); // nine up to ADR-0160's shoulders
  });

  it('[Zero] com alcance ok, nada é criado — o caso comum tem de continuar silencioso', () => {
    expect(showReachNotice(ctx(), DESKTOP())).toBe(false);
    expect(cartao()).toBe(null);
  });

  it('[Zero] sem a marcação do hospedeiro não lança, e também não inventa onde pôr', () => {
    raiz.innerHTML = ''; // sem `#game-region`
    expect(() => showReachNotice(ctx(), TABLET())).not.toThrow();
    expect(cartao()).toBe(null);
  });
});

describe('quem não vê a tela também recebe o aviso', () => {
  it('[Right] ⚠️ o texto inteiro vai por anúncio ASSERTIVO — o cartão não serve a uma criança cega', () => {
    showReachNotice(ctx(), TABLET());
    expect(ditos).toHaveLength(1);
    expect(ditos[0]).toContain('Este jogo usa 14 ações.');
    expect(ditos[0]).toContain('Ligue controle ou teclado');
  });

  it('[Right] o foco vai para o CARTÃO, e não para o botão de sair', () => {
    // If it went to the button, the screen reader would read «Jogar assim mesmo» first and the REASON would be left for
    // whoever went looking. The child has to hear why the notice exists before finding its way out.
    showReachNotice(ctx(), TABLET());
    expect(document.activeElement.matches('.overlay__card')).toBe(true);
  });

  it('[Interface] o cartão declara-se diálogo modal, como os outros desta engine', () => {
    showReachNotice(ctx(), TABLET());
    const card = cartao().querySelector('.overlay__card');
    expect(card.getAttribute('role')).toBe('dialog');
    expect(card.getAttribute('aria-modal')).toBe('true');
  });
});

describe('⚠️ e ele NÃO TRANCA — é aviso, não porta fechada', () => {
  it('[Right] o botão «jogar assim mesmo» remove o cartão', () => {
    showReachNotice(ctx(), TABLET());
    const botao = cartao().querySelector('button');
    expect(botao.textContent).toBe('Jogar assim mesmo');
    botao.click();
    expect(cartao(), 'a criança ficou presa num aviso').toBe(null);
  });

  it('[Interface] o botão é alcançável por TECLADO — é o pilar 2, e um aviso sem saída é pior que nenhum', () => {
    // The focus trap (#109) keeps Tab inside this card while it is open. If its only control were not focusable, the
    // trap would lock the child in a dialog with no exit — trading «descobre no meio que não alcança» for «não consegue
    // sair do aviso» would be making it worse.
    showReachNotice(ctx(), TABLET());
    const focaveis = focusablesInDom(cartao());
    expect(focaveis).toHaveLength(1);
    expect(focaveis[0].textContent).toBe('Jogar assim mesmo');
  });
});
