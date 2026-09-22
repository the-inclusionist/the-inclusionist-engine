// SPDX-License-Identifier: AGPL-3.0-or-later
// THE THREE FIELD-OF-VISION SIMULATIONS OF THE EMPATHY PANEL (ADR-0151 §2 item 2; issue #182): tunnel vision, a central
// scotoma and scattered scotomas are DRAWN over the declared world — a colour filter cannot make them — and the drawing
// leaves the menus reachable.
//
// 📌 `createGame` with a real page. What is measured is the drawing's alpha at points of the 320×180 layer: the place the
// simulation darkens and the place it leaves clear, for each of the three.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { SEM_ASSUNTO } from './fixtures/accommodation-answers.js';

let motor;
const declaracao = () => ({
  topology: () => ({ kind: 'hotspots', order: ['q1'] }), holdsAtOnce: () => 1, seguraTeclas: () => false, tick: 'player',
  world: () => ({ kind: 'element', selector: '#mundo' }), roleAt: () => 'goal',
  nameAt: () => ({ text: 'a', gender: 'f', plural: false }), focusOf: () => null,
  objectiveOf: () => ({ name: { text: 'a', gender: 'f', plural: true }, have: 0, need: 1 }), targetsOf: () => [],
});
async function escolher(chave) {
  motor.pausa.mostrar(0);
  document.querySelector('#vp-pause-0 .pm-btn[data-act="options"]').click();
  document.querySelector('#vp-pause-0 .pm-btn[data-act="empatia"]').click();
  const sel = document.querySelector('#empathy #opt-simulacao');
  sel.value = chave;
  sel.dispatchEvent(new Event('change', { bubbles: true }));
  for (const ov of document.querySelectorAll('#game-region .overlay')) ov.hidden = true;
  motor.pausa.esconder(0);
  await new Promise((r) => setTimeout(r, 30)); // a simulation comes back with the game once the menus close (issue #182)
}
const camada = () => document.querySelector('#viz-overlay');
/** The drawing's opacity (0–255) at a point given as a fraction of the 320×180 layer. */
function opacidade(fx, fy) {
  const c = camada();
  const [x, y] = [Math.round(fx * c.width), Math.round(fy * c.height)];
  return c.getContext('2d').getImageData(x, y, 1, 1).data[3];
}

let antes;
beforeAll(async () => {
  antes = localStorage.getItem('incl_viz');
  document.body.innerHTML = '<p id="sr-status" role="status"></p><p id="sr-alert" role="alert"></p>'
    + '<div id="game-region" tabindex="-1"><div id="mundo" style="position:relative;width:640px;height:360px"></div></div><div id="title-icons"></div>';
  const { createGame } = await import('../app/js/boot/create-game.js');
  motor = createGame({ acomodacoes: SEM_ASSUNTO, declaration: declaracao(), host: { doc: document, win: window }, downloadHeavy: false, players: [{ ctrl: 0 }] });
});
afterAll(() => { if (antes === null) localStorage.removeItem('incl_viz'); else localStorage.setItem('incl_viz', antes); });

describe('the field-of-vision simulations', () => {
  it('🔴 [Right] the empathy list offers tunnel vision, a central scotoma and scattered scotomas', () => {
    motor.pausa.mostrar(0);
    document.querySelector('#vp-pause-0 .pm-btn[data-act="options"]').click();
    document.querySelector('#vp-pause-0 .pm-btn[data-act="empatia"]').click();
    const valores = [...document.querySelectorAll('#empathy #opt-simulacao option')].map((o) => o.value);
    for (const chave of ['lv-tunnel', 'lv-macular', 'lv-diabetic']) expect(valores, chave).toContain(chave);
    for (const ov of document.querySelectorAll('#game-region .overlay')) ov.hidden = true;
    motor.pausa.esconder(0);
  });

  it('🔴 [Right] tunnel vision darkens the edge and leaves the centre clear, over the world, taking no click', async () => {
    await escolher('lv-tunnel');
    const c = camada();
    expect(c, 'nothing drawn over the world').not.toBeNull();
    expect(c.hidden).toBe(false);
    expect(document.querySelector('#mundo').contains(c), 'the drawing is not on the declared world').toBe(true);
    expect(getComputedStyle(c).pointerEvents, 'the drawing takes the clicks meant for the game').toBe('none');
    expect(opacidade(0.02, 0.05), 'the edge is not dark').toBeGreaterThan(200);
    expect(opacidade(0.5, 0.5), 'the centre is not clear').toBeLessThan(20);
  });

  it('🔴 [Right] a central scotoma darkens the centre and leaves the edge clear', async () => {
    await escolher('lv-macular');
    expect(opacidade(0.5, 0.5), 'the centre is not dark').toBeGreaterThan(200);
    expect(opacidade(0.02, 0.05), 'the edge is not clear').toBeLessThan(20);
  });

  it('🔴 [Right] scattered scotomas darken spots and leave a corner clear', async () => {
    await escolher('lv-diabetic');
    expect(opacidade(0.22, 0.3), 'no spot where the drawing puts one').toBeGreaterThan(200);
    expect(opacidade(0.98, 0.05), 'the corner is not clear').toBeLessThan(20);
  });

  it('🎯 [Zero] back to normal, nothing is drawn over the world', async () => {
    await escolher('normal');
    expect(camada()?.hidden ?? true, 'the drawing stayed after the simulation ended').toBe(true);
  });

  it('🎯 [Zero] a simulation made by a filter draws nothing', async () => {
    await escolher('lv-blur');
    expect(camada()?.hidden ?? true).toBe(true);
    await escolher('normal');
  });
});

// ============================== MUTATIONS CHECKED ==============================
//   L1 nothing drawn · L2 not offered · L3 stays after «normal» · L4 a filter simulation drawn · L5 takes clicks
//   L6 laid outside the world · L7 tunnel / L8 central / L9 scattered not drawn                           🔴 each
