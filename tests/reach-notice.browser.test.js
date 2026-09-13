// SPDX-License-Identifier: AGPL-3.0-or-later
// A TELA DO ALCANCE NUM NAVEGADOR (issue #112). O project node afere as FRASES; aqui é o cartão: que ele
// aparece, que uma criança cega o OUVE, que ele é operável por teclado, e — sobretudo — que ele não tranca.
//
// ⚠️ ELE INFORMA E NÃO RECUSA, e isso é a decisão que o resto depende. A detecção de teclado é imprecisa por
// natureza: não há API que diga «há um teclado físico ligado», e um tablet COM teclado responde «toque» ao
// `pointer:coarse && hover:none`. Se este cartão barrasse, esse tablet levaria uma RECUSA FALSA num jogo que
// ele joga. Informando, o erro custa uma frase a mais e nunca uma porta fechada — e é por isso que o caso do
// botão «jogar assim mesmo» é o mais importante deste ficheiro.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mostrarAvisoDeAlcance, REACH_NOTICE_ID } from '../app/js/ui/reach-notice.js';
import { alcance, transportesPadrao } from '../app/js/input/transports.js';
import { focaveisNoDom } from '../app/js/ui/focus-trap.js';
import { ACTIONS } from '../app/js/core/actions.js';
import pt from '../app/js/i18n/pt.js';

const sempre = () => true, nunca = () => false;
/** O caso da issue: só o toque, e ele é curto para as catorze. */
const TABLET = () => alcance(transportesPadrao({ gamepad: nunca, teclado: nunca, toque: sempre, rato: nunca }), ACTIONS);
const DESKTOP = () => alcance(transportesPadrao({ gamepad: nunca, teclado: sempre, toque: nunca, rato: sempre }), ACTIONS);

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
  procurar: (sel) => document.querySelector(sel),
  criar: (tag) => document.createElement(tag),
  t: traduz,
  srAlert: (s) => ditos.push(s),
});
const cartao = () => document.querySelector('#' + REACH_NOTICE_ID);

describe('o cartão aparece — e só quando há o que dizer', () => {
  it('[Right] com o toque curto, o cartão entra no documento com as três frases', () => {
    expect(mostrarAvisoDeAlcance(ctx(), TABLET())).toBe(true);
    const ps = [...cartao().querySelectorAll('p')].map((p) => p.textContent);
    expect(ps).toHaveLength(3);
    expect(ps[0]).toBe('Este jogo usa 14 ações.');
    expect(ps[1]).toContain('13 lugares'); // nove até os ombros do ADR-0160
  });

  it('[Zero] com alcance ok, nada é criado — o caso comum tem de continuar silencioso', () => {
    expect(mostrarAvisoDeAlcance(ctx(), DESKTOP())).toBe(false);
    expect(cartao()).toBe(null);
  });

  it('[Zero] sem a marcação do hospedeiro não lança, e também não inventa onde pôr', () => {
    raiz.innerHTML = ''; // sem `#game-region`
    expect(() => mostrarAvisoDeAlcance(ctx(), TABLET())).not.toThrow();
    expect(cartao()).toBe(null);
  });
});

describe('quem não vê a tela também recebe o aviso', () => {
  it('[Right] ⚠️ o texto inteiro vai por anúncio ASSERTIVO — o cartão não serve a uma criança cega', () => {
    mostrarAvisoDeAlcance(ctx(), TABLET());
    expect(ditos).toHaveLength(1);
    expect(ditos[0]).toContain('Este jogo usa 14 ações.');
    expect(ditos[0]).toContain('Ligue controle ou teclado');
  });

  it('[Right] o foco vai para o CARTÃO, e não para o botão de sair', () => {
    // Se fosse para o botão, o leitor de tela leria «Jogar assim mesmo» primeiro e o MOTIVO ficaria para quem
    // fosse procurar. A criança tem de ouvir por que o aviso existe antes de encontrar a saída dele.
    mostrarAvisoDeAlcance(ctx(), TABLET());
    expect(document.activeElement.matches('.overlay__card')).toBe(true);
  });

  it('[Interface] o cartão declara-se diálogo modal, como os outros desta engine', () => {
    mostrarAvisoDeAlcance(ctx(), TABLET());
    const card = cartao().querySelector('.overlay__card');
    expect(card.getAttribute('role')).toBe('dialog');
    expect(card.getAttribute('aria-modal')).toBe('true');
  });
});

describe('⚠️ e ele NÃO TRANCA — é aviso, não porta fechada', () => {
  it('[Right] o botão «jogar assim mesmo» remove o cartão', () => {
    mostrarAvisoDeAlcance(ctx(), TABLET());
    const botao = cartao().querySelector('button');
    expect(botao.textContent).toBe('Jogar assim mesmo');
    botao.click();
    expect(cartao(), 'a criança ficou presa num aviso').toBe(null);
  });

  it('[Interface] o botão é alcançável por TECLADO — é o pilar 2, e um aviso sem saída é pior que nenhum', () => {
    // A armadilha de foco (#109) prende o Tab dentro deste cartão enquanto ele está aberto. Se o único
    // controle dele não fosse focável, ela prenderia a criança num diálogo sem saída — trocar «descobre no
    // meio que não alcança» por «não consegue sair do aviso» seria piorar.
    mostrarAvisoDeAlcance(ctx(), TABLET());
    const focaveis = focaveisNoDom(cartao());
    expect(focaveis).toHaveLength(1);
    expect(focaveis[0].textContent).toBe('Jogar assim mesmo');
  });
});
