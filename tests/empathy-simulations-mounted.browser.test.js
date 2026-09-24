// SPDX-License-Identifier: AGPL-3.0-or-later
// THE MOTOR EMPATHY SIMULATIONS, MOUNTED (ADR-0181; issue #177): two rows in the empathy panel, applied to game keys before
// any cartridge hears them, and refused over the accommodation that would undo them (ADR-0076).
//
// 📌 `createGame` with a real page; the «game» is a listener on the document, which is where a cartridge hears keys.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { SEM_ASSUNTO } from './fixtures/accommodation-answers.js';

let motor, state;
const antes = {};
const CHAVES = ['incl_onebtn', 'incl_sem_forca'];
const declaracao = () => ({
  topology: () => ({ kind: 'hotspots', order: ['q1'] }), holdsAtOnce: () => 2, holdsKeys: () => true, tick: 'clock',
  world: () => ({ kind: 'element', selector: '#game-region' }), roleAt: () => 'goal',
  nameAt: () => ({ text: 'a', gender: 'f', plural: false }), focusOf: () => null,
  objectiveOf: () => ({ name: { text: 'a', gender: 'f', plural: true }, have: 0, need: 1 }), targetsOf: () => [],
});
const jogo = [];
const tecla = (tipo, code, repeat = false) => document.getElementById('game-region')
  .dispatchEvent(new KeyboardEvent(tipo, { code, key: code, repeat, bubbles: true, cancelable: true }));
const esperar = (ms = 30) => new Promise((r) => setTimeout(r, ms));
function abrirEmpatia() {
  motor.pausa.mostrar(0);
  document.querySelector('#vp-pause-0 .pm-btn[data-act="options"]').click();
  document.querySelector('#vp-pause-0 .pm-btn[data-act="empatia"]').click();
}
function fecharTudo() {
  for (const ov of document.querySelectorAll('#game-region .overlay')) ov.hidden = true;
  motor.pausa.esconder(0);
}

beforeAll(async () => {
  for (const k of CHAVES) { antes[k] = localStorage.getItem(k); localStorage.removeItem(k); }
  document.body.innerHTML = '<p id="sr-status" role="status"></p><p id="sr-alert" role="alert"></p>'
    + '<div id="game-region" tabindex="-1"></div><div id="title-icons"></div>';
  document.addEventListener('keydown', (e) => jogo.push(`down:${e.code}`));
  document.addEventListener('keyup', (e) => jogo.push(`up:${e.code}`));
  state = await import('../app/js/core/state.js');
  const { createGame } = await import('../app/js/boot/create-game.js');
  motor = createGame({ acomodacoes: SEM_ASSUNTO, declaration: declaracao(), host: { doc: document, win: window }, downloadHeavy: false, players: [{ ctrl: 0 }] });
});
afterAll(() => {
  for (const k of CHAVES) { if (antes[k] === null) localStorage.removeItem(k); else localStorage.setItem(k, antes[k]); }
});
beforeEach(() => { jogo.length = 0; });

describe('the motor empathy simulations', () => {
  it('🎯 [Zero] off, two game keys together both reach the game', () => {
    tecla('keydown', 'KeyD'); tecla('keydown', 'KeyA'); tecla('keyup', 'KeyA'); tecla('keyup', 'KeyD');
    expect(jogo).toEqual(['down:KeyD', 'down:KeyA', 'up:KeyA', 'up:KeyD']);
  });

  it('🔴 [Right] both rows are in the empathy panel', () => {
    abrirEmpatia();
    expect(document.querySelector('#empathy #opt-onebtn'), 'no «um botão por vez» row').not.toBeNull();
    expect(document.querySelector('#empathy #opt-semforca'), 'no «sem força para segurar» row').not.toBeNull();
    fecharTudo();
  });

  it('🔴 [Right] «um botão por vez» on: a second game key held with the first never reaches the game', async () => {
    abrirEmpatia();
    document.querySelector('#empathy #opt-onebtn').click();
    fecharTudo();
    expect(state.oneButton).toBe(true);
    expect(localStorage.getItem('incl_onebtn'), 'the simulation was not stored').toBe('1'); // `platform/storage` writes a boolean as 1
    jogo.length = 0;
    tecla('keydown', 'KeyD'); tecla('keydown', 'KeyA'); tecla('keyup', 'KeyA'); tecla('keyup', 'KeyD');
    expect(jogo, 'the second button got through').toEqual(['down:KeyD', 'up:KeyD']);
    state.setOneButtonValue(false);
  });

  it('🔴 [Right] «sem força para segurar» on: a held key reaches the game as one tap', async () => {
    abrirEmpatia();
    document.querySelector('#empathy #opt-semforca').click();
    fecharTudo();
    expect(state.noGripStrength).toBe(true);
    jogo.length = 0;
    tecla('keydown', 'KeyD'); tecla('keydown', 'KeyD', true); tecla('keydown', 'KeyD', true);
    await esperar();
    // released AT ONCE, while the key is still physically down — otherwise the game still sees it held
    expect(jogo, 'the tap was not released while the key is still held').toEqual(['down:KeyD', 'up:KeyD']);
    tecla('keyup', 'KeyD');
    expect(jogo, 'holding kept pressing, or the release came twice').toEqual(['down:KeyD', 'up:KeyD']);
    state.setNoGripStrengthValue(false);
  });

  it('🔴 [Right] with toggle keys on, «sem força para segurar» is refused and says why (ADR-0076)', async () => {
    motor.mount(declaracao(), { acomodacoes: SEM_ASSUNTO, players: [{ ctrl: 0, toggleMove: true }] });
    abrirEmpatia();
    document.querySelector('#empathy #opt-semforca').click();
    await esperar();
    expect(state.noGripStrength, 'the simulation ran over the accommodation that undoes it').toBe(false);
    expect((document.getElementById('sr-status').textContent + document.getElementById('sr-alert').textContent), 'refused in silence').toMatch(/altern/i);
    fecharTudo();
    motor.mount(declaracao(), { acomodacoes: SEM_ASSUNTO, players: [{ ctrl: 0 }] });
  });
});
// 📌 No case «inside a menu»: `ui/menu-nav` consumes a menu key in the window's capture before this filter hears it, so a
// guard for menus here would be inert code — measured when a first version of this file asserted it.

// ============================== MUTATIONS CHECKED ==============================
//   R1 no filter listener                                  🔴 one at a time, one tap
//   R2 the rows not mounted                                🔴 rows, and the three that click them
//   R3 no refusal over toggle keys                         🔴 refused
//   R4 the synthetic release filtered as a real one         🔴 one tap — FIRST SURVIVED: the case checked the events only after
//                                                             the real release, when a late release looks the same
