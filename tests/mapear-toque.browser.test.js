// SPDX-License-Identifier: AGPL-3.0-or-later
// «MAPEAR TOQUE» IN THE MOTOR PANEL (ADR-0151 §2; issue #182): which function each on-screen pad button carries, among the
// functions THIS game names — offered only for the buttons the pad draws, and the pad redrawn with the choice.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { SEM_ASSUNTO } from './fixtures/respostas-de-acomodacao.js';

let motor, antes;
const declaracao = () => ({
  topology: () => ({ kind: 'hotspots', order: ['q1'] }), holdsAtOnce: () => 1, seguraTeclas: () => false, tick: 'player',
  world: () => ({ kind: 'element', selector: '#game-region' }), roleAt: () => 'goal',
  nameAt: () => ({ text: 'a', gender: 'f', plural: false }), focusOf: () => null,
  objectiveOf: () => ({ name: { text: 'a', gender: 'f', plural: true }, have: 0, need: 1 }), targetsOf: () => [],
});
/** `action2` sits on b0, `action3` on b1, `action4` on b3 by default (`input/touch.TOUCH_DEFAULT`). */
const PRESET = { up: { label: 'Cima' }, down: { label: 'Baixo' }, action2: { label: 'Confirmar' }, action3: { label: 'Voltar' }, action4: { label: 'Menu' } };
const funcaoDoBotao = (n) => (document.querySelector(`#touch-controls .touch-btn[data-btn="${n}"]`)?.getAttribute('aria-label') ?? '').split(', ').slice(1).join(', ');
function abrirMotora() {
  motor.pausa.mostrar(0);
  document.querySelector('#vp-pause-0 .pm-btn[data-act="options"]').click();
  document.querySelector('#vp-pause-0 .pm-btn[data-act="motora"]').click();
}

beforeAll(async () => {
  antes = localStorage.getItem('incl_touchmap');
  localStorage.removeItem('incl_touchmap');
  document.body.innerHTML = '<p id="sr-status" role="status"></p><p id="sr-alert" role="alert"></p>'
    + '<div id="game-region" tabindex="-1"></div><div id="title-icons"></div>';
  const { createGame } = await import('../app/js/boot/create-game.js');
  motor = createGame({ acomodacoes: SEM_ASSUNTO, controleNaTela: true, declaration: declaracao(), host: { doc: document, win: window }, downloadHeavy: false, players: [{ ctrl: 0 }], preset: PRESET });
});
afterAll(() => { if (antes === null) localStorage.removeItem('incl_touchmap'); else localStorage.setItem('incl_touchmap', antes); });

describe('«Mapear toque»', () => {
  it('🔴 [Right] the motor panel has a «Mapear toque» row that opens the touch map', () => {
    abrirMotora();
    const botao = document.querySelector('#motora #opt-toque');
    expect(botao, 'no «Mapear toque» row').not.toBeNull();
    expect(botao.closest('.ctrl-row').hidden, 'the row is hidden in a game with a pad').toBe(false);
    expect(botao.closest('.ctrl-row').querySelector('strong')?.textContent).toBe('Mapear toque');
    botao.click();
    expect(document.querySelector('#touchcfg')?.hidden, 'the touch map did not open').toBe(false);
  });

  it('🔴 [Right] only the buttons the pad draws are offered, each with the game\'s words', () => {
    const visiveis = [...document.querySelectorAll('#touchmap-list select[data-slot]')].filter((s) => !s.closest('.ctrl-row').hidden).map((s) => s.dataset.slot);
    expect(visiveis.sort(), 'a slot the pad does not draw is offered, or a drawn one is missing').toEqual(['b0', 'b1', 'b3', 'down', 'up']);
    const opcoes = [...document.querySelectorAll('#tm-b0 option')].map((o) => o.textContent);
    expect(opcoes, 'the options are not the game\'s words').toEqual(['Cima', 'Baixo', 'Confirmar', 'Voltar', 'Menu']);
  });

  it('🔴 [Right] a choice is stored and the pad button carries it', () => {
    const sel = document.querySelector('#tm-b0');
    sel.value = 'action3';
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    expect(JSON.parse(localStorage.getItem('incl_touchmap') ?? '{}').b0, 'not stored').toBe('action3');
    expect(funcaoDoBotao(0), 'the pad button still carries its old function').toBe('Voltar');
  });

  it('🎯 [Zero] a game with no on-screen pad has nothing to map: the row is not offered', () => {
    for (const ov of document.querySelectorAll('#game-region .overlay')) ov.hidden = true;
    motor.pausa.esconder(0);
    motor.mount(declaracao(), { acomodacoes: SEM_ASSUNTO, players: [{ ctrl: 0 }], preset: PRESET });
    abrirMotora();
    expect(document.querySelector('#motora #opt-toque')?.closest('.ctrl-row')?.hidden, 'a touch map for a game without a pad').toBe(true);
  });
});

// ============================== MUTATIONS CHECKED ==============================
//   T1 no row · T2 the row does not open · T3 undrawn slots offered · T4 pad not redrawn · T5 offered without a pad   🔴 each
