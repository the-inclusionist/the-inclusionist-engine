// SPDX-License-Identifier: AGPL-3.0-or-later
// THE CAPTIONS SWITCH IN THE VISUAL PANEL (ADR-0151 §2; issue #182): the Dev listed «legendas» there, and `state.captionsOn`
// was stored and read by the sound captions with no row to change it.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { SEM_ASSUNTO } from './fixtures/accommodation-answers.js';

let motor, state, antes;
const declaracao = () => ({
  topology: () => ({ kind: 'hotspots', order: ['q1'] }), holdsAtOnce: () => 1, holdsKeys: () => false, tick: 'player',
  world: () => ({ kind: 'element', selector: '#game-region' }), roleAt: () => 'goal',
  nameAt: () => ({ text: 'a', gender: 'f', plural: false }), focusOf: () => null,
  objectiveOf: () => ({ name: { text: 'a', gender: 'f', plural: true }, have: 0, need: 1 }), targetsOf: () => [],
});
const esperar = (ms = 40) => new Promise((r) => setTimeout(r, ms));
function abrirVisual() {
  motor.pausa.mostrar(0);
  document.querySelector('#vp-pause-0 .pm-btn[data-act="options"]').click();
  document.querySelector('#vp-pause-0 .pm-btn[data-act="visual"]').click();
}
const legendaVisivel = () => [...document.querySelectorAll('.legenda-de-som')].some((l) => !l.hidden && l.textContent);

beforeAll(async () => {
  antes = localStorage.getItem('incl_captions');
  localStorage.removeItem('incl_captions');
  document.body.innerHTML = '<p id="sr-status" role="status"></p><p id="sr-alert" role="alert"></p>'
    + '<div id="game-region" tabindex="-1"></div><div id="title-icons"></div>';
  state = await import('../app/js/core/state.js');
  const { createGame } = await import('../app/js/boot/create-game.js');
  motor = createGame({ acomodacoes: SEM_ASSUNTO, declaration: declaracao(), host: { doc: document, win: window }, downloadHeavy: false, players: [{ ctrl: 0 }] });
});
afterAll(() => {
  state.setCaptionsOnValue(true);
  if (antes === null) localStorage.removeItem('incl_captions'); else localStorage.setItem('incl_captions', antes);
});

describe('the captions switch', () => {
  it('🔴 [Right] the visual panel has a «Legendas» switch showing the stored state', () => {
    abrirVisual();
    const b = document.querySelector('#visual #opt-captions');
    expect(b, 'no captions row in the visual panel').not.toBeNull();
    expect(b.closest('.ctrl-row').querySelector('strong')?.textContent).toBe('Legendas');
    expect(b.getAttribute('aria-pressed'), 'the switch does not show that captions are on').toBe('true');
  });

  it('🔴 [Right] turning it off stores it, says it, and a sound caption no longer shows', async () => {
    abrirVisual();
    document.querySelector('#visual #opt-captions').click();
    expect(state.captionsOn).toBe(false);
    expect(localStorage.getItem('incl_captions'), 'not stored').toBe('0'); // `platform/storage` writes a boolean as 1/0
    expect(document.querySelector('#visual #opt-captions').getAttribute('aria-pressed')).toBe('false');
    await esperar(80);
    expect(document.getElementById('sr-status').textContent, 'the change was silent').toMatch(/Legendas/);
    motor.legendarSom('um sino');
    expect(legendaVisivel(), 'a caption showed with captions off').toBe(false);
  });

  it('🔴 [Right] turning it back on shows captions again', () => {
    abrirVisual();
    document.querySelector('#visual #opt-captions').click();
    expect(state.captionsOn).toBe(true);
    motor.legendarSom('um sino');
    expect(legendaVisivel(), 'no caption with captions on').toBe(true);
  });
});

// ============================== MUTATIONS CHECKED ==============================
//   C1 row not in the panel · C2 click does not write · C3 not reflected after the click · C4 silent
//   C5 not reflected at opening                                                                          🔴 each
