// SPDX-License-Identifier: AGPL-3.0-or-later
// WITH NO BAR, THE TOP BAND IS ZERO — there is nothing to reserve (ADR-0148 §3, issue #160).
//
// 🔴 FOUND BY A PROBE ON 2026-09-22, measuring what the suite held of the top-band reservation (today `reserveTopBand`, in
// `ui/top-band`): making the sum start at 44 px instead of 0 left the build GREEN. A game with no accessibility bar
// would lose the screen's first line reserving room for something that does not exist — and on a school device at
// 640×360 that line is 12% of the height.
//
// ⚠️ AND THIS CASE LIVES IN A FILE OF ITS OWN, which is the second half of the finding. Writing it inside
// `boot-create-game.browser.test.js` needed a SECOND host in the same document, and `createGame` searches the whole
// document: two `#game-region`, two `#sr-status`, and four neighbouring cases started measuring the wrong node. It is the
// same order dependency ADR-0220 paid for, arriving by another path — and the answer is the one that record gave: one
// document per root.
//
// MUTATION CHECKED: `let sala = 0` → `let sala = 44` ⇒ RED here, and GREEN in the whole suite without this file.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SEM_ASSUNTO } from './fixtures/accommodation-answers.js';

let createGame;
let motor = null;

/** The minimum the contract requires, and nothing more: this case is not about the cartridge. */
const declaracaoValida = () => ({
  topology: () => ({ kind: 'hotspots', order: ['q1'] }),
  holdsAtOnce: () => 1,
  holdsKeys: () => false,
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
  // 📌 NO `#title-icons`: the absence is what the case measures, and it has to be in the document and not in a double.
  document.body.innerHTML = '<p id="sr-status" role="status"></p><p id="sr-alert" role="alert"></p>'
    + '<div id="game-region"></div>';
});

afterEach(() => { motor?.dispose?.(); motor = null; });

describe('a faixa do topo sem barra', () => {
  it('🔴 [Zero] a engine não reserva faixa nenhuma quando não montou barra', () => {
    motor = createGame({ accommodations: SEM_ASSUNTO, declaration: declaracaoValida(),
      host: { doc: document, win: window }, downloadHeavy: false });
    const regiao = document.querySelector('#game-region');
    expect(document.querySelector('#title-icons'), 'a barra apareceu — o caso deixou de medir a ausência').toBeNull();
    expect(regiao.style.getPropertyValue('--barra-a11y-h'), 'reservou faixa sem barra nenhuma').toBe('0px');
  });
});
