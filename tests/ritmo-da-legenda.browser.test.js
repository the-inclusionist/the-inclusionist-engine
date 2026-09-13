// SPDX-License-Identifier: AGPL-3.0-or-later
// THE CAPTION RATE IN THE VISUAL PANEL (ADR-0183 §4; issue #179): the child picks 125, 145 or 175 words a minute, and a sound
// caption stays for its words at that rate.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { SEM_ASSUNTO } from './fixtures/respostas-de-acomodacao.js';

let motor, state, antes;
const declaracao = () => ({
  topology: () => ({ kind: 'hotspots', order: ['q1'] }), holdsAtOnce: () => 1, seguraTeclas: () => false, tick: 'player',
  world: () => ({ kind: 'element', selector: '#game-region' }), roleAt: () => 'goal',
  nameAt: () => ({ text: 'a', gender: 'f', plural: false }), focusOf: () => null,
  objectiveOf: () => ({ name: { text: 'a', gender: 'f', plural: true }, have: 0, need: 1 }), targetsOf: () => [],
});
const OITO = 'Uma porta de madeira velha rangendo bem devagar';
function abrirVisual() {
  motor.pausa.mostrar(0);
  document.querySelector('#vp-pause-0 .pm-btn[data-act="options"]').click();
  document.querySelector('#vp-pause-0 .pm-btn[data-act="visual"]').click();
}
function fecharTudo() {
  for (const ov of document.querySelectorAll('#game-region .overlay')) ov.hidden = true;
  motor.pausa.esconder(0);
}
/** The delay the caption was given: `legendarSom` schedules its own hiding. */
function atrasoDaLegenda(texto) {
  const original = window.setTimeout;
  const atrasos = [];
  window.setTimeout = (fn, ms, ...r) => { atrasos.push(ms); return original(fn, ms, ...r); };
  try { motor.legendarSom(texto); } finally { window.setTimeout = original; }
  return atrasos.at(-1);
}

beforeAll(async () => {
  antes = localStorage.getItem('incl_caption_ppm');
  localStorage.removeItem('incl_caption_ppm');
  document.body.innerHTML = '<p id="sr-status" role="status"></p><p id="sr-alert" role="alert"></p>'
    + '<div id="game-region" tabindex="-1"></div><div id="title-icons"></div>';
  state = await import('../app/js/core/state.js');
  const { createGame } = await import('../app/js/boot/create-game.js');
  motor = createGame({ acomodacoes: SEM_ASSUNTO, declaration: declaracao(), host: { doc: document, win: window }, baixarPesados: false, players: [{ ctrl: 0 }] });
});
afterAll(() => {
  state.setCaptionPpmValue(125);
  if (antes === null) localStorage.removeItem('incl_caption_ppm'); else localStorage.setItem('incl_caption_ppm', antes);
});

describe('the caption rate', () => {
  it('🔴 [Right] the visual panel has a caption rate step row, on the stored rate', () => {
    abrirVisual();
    const passos = document.querySelector('#visual #opt-legenda-ppm');
    expect(passos, 'no caption rate row').not.toBeNull();
    expect(passos.getAttribute('aria-label')).toBe('Ritmo das legendas');
    expect(passos.getAttribute('aria-valuetext')).toBe('125 palavras por minuto');
    fecharTudo();
  });

  it('🔴 [Right] a step writes the rate, and a caption then stays for its words at it', () => {
    expect(atrasoDaLegenda(OITO), 'at 125').toBe(3840);
    abrirVisual();
    const passos = document.querySelector('#visual #opt-legenda-ppm');
    passos.dispatchEvent(new CustomEvent('passo', { detail: 1, bubbles: true }));
    passos.dispatchEvent(new CustomEvent('passo', { detail: 1, bubbles: true }));
    expect(state.captionPpm).toBe(175);
    expect(localStorage.getItem('incl_caption_ppm')).toBe('175');
    expect(passos.getAttribute('aria-valuetext')).toBe('175 palavras por minuto');
    fecharTudo();
    expect(atrasoDaLegenda(OITO), 'the caption kept the old rate').toBe(2743);
  });
});

// ============================== MUTATIONS CHECKED ==============================
//   R6 the root passes a fixed rate · R7 row not in the panel · R8 step does not write   🔴 each (R1–R5 in `duracao-da-legenda.node`)
