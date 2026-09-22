// SPDX-License-Identifier: AGPL-3.0-or-later
// SEM BARRA, A FAIXA DO TOPO É ZERO — não há nada para reservar (ADR-0148 §3, issue #160).
//
// 🔴 ACHADO POR SONDA EM 2026-09-22, ao medir o que a suíte segurava de `reservarFaixaDaBarra`: pôr a conta a começar
// em 44 px em vez de 0 deixava o build VERDE. Um jogo sem barra de acessibilidade perdia a primeira linha da tela a
// reservar espaço para uma coisa que não existe — e num aparelho de escola a 640×360 essa linha é 12% da altura.
//
// ⚠️ E ESTE CASO VIVE NUM FICHEIRO PRÓPRIO, que é a segunda metade do achado. Escrevê-lo dentro do
// `boot-create-game.browser.test.js` exigia um SEGUNDO hospedeiro no mesmo documento, e `createGame` procura no
// documento inteiro: dois `#game-region`, dois `#sr-status`, e quatro casos vizinhos passaram a medir o nó errado.
// É a mesma dependência de ordem que o ADR-0220 pagou, a chegar por outro caminho — e a resposta é a mesma que
// aquele registo deu: um documento por raiz.
//
// MUTAÇÃO CONFERIDA: `let sala = 0` → `let sala = 44` ⇒ VERMELHO aqui, e VERDE em toda a suíte sem este ficheiro.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SEM_ASSUNTO } from './fixtures/accommodation-answers.js';

let createGame;
let motor = null;

/** O mínimo que o contrato exige, e nada mais: este caso não é sobre o cartucho. */
const declaracaoValida = () => ({
  topology: () => ({ kind: 'hotspots', order: ['q1'] }),
  holdsAtOnce: () => 1,
  seguraTeclas: () => false,
  tick: 'player',
  world: () => ({ kind: 'element', selector: '#game-region' }),
  roleAt: () => 'goal',
  nameAt: () => ({ text: 'pergunta', gender: 'f', plural: false }),
  focusOf: () => ({ id: 'p0', at: { x: 0, y: 0 }, heading: 'none' }),
  objectiveOf: () => ({ name: { text: 'perguntas', gender: 'f', plural: true }, have: 0, need: 1 }),
  targetsOf: () => [{ x: 0, y: 0 }],
});

beforeEach(async () => {
  ({ createGame } = await import('../app/js/boot/create-game.js'));
  // 📌 SEM `#title-icons`: é a ausência que o caso mede, e ela tem de estar no documento e não num duble.
  document.body.innerHTML = '<p id="sr-status" role="status"></p><p id="sr-alert" role="alert"></p>'
    + '<div id="game-region"></div>';
});

afterEach(() => { motor?.dispose?.(); motor = null; });

describe('a faixa do topo sem barra', () => {
  it('🔴 [Zero] a engine não reserva faixa nenhuma quando não montou barra', () => {
    motor = createGame({ acomodacoes: SEM_ASSUNTO, declaration: declaracaoValida(),
      host: { doc: document, win: window }, downloadHeavy: false });
    const regiao = document.querySelector('#game-region');
    expect(document.querySelector('#title-icons'), 'a barra apareceu — o caso deixou de medir a ausência').toBeNull();
    expect(regiao.style.getPropertyValue('--barra-a11y-h'), 'reservou faixa sem barra nenhuma').toBe('0px');
  });
});
