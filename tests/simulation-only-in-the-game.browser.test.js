// SPDX-License-Identifier: AGPL-3.0-or-later
// A DISABILITY SIMULATION RUNS IN THE GAME, NEVER IN A MENU (issue #182; the Dev, 2026-09-13: «Simulação de deficiência não
// pode funcionar no menu! Só no jogo! Senão fica impossível desabilitar em certos casos.»).
//
// 📌 The world here is the whole region, as in the quiz: the menus live INSIDE it. A CSS filter on an element reaches every
// descendant, and clearing it on a child does not undo it — so the simulation must never be put on an ancestor of a menu,
// and it is suspended while a menu is open.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { SEM_ASSUNTO } from './fixtures/accommodation-answers.js';

let motor;
const declaracao = () => ({
  topology: () => ({ kind: 'hotspots', order: ['q1'] }), holdsAtOnce: () => 1, holdsKeys: () => false, tick: 'player',
  world: () => ({ kind: 'element', selector: '#game-region' }), roleAt: () => 'goal',
  nameAt: () => ({ text: 'a', gender: 'f', plural: false }), focusOf: () => null,
  objectiveOf: () => ({ name: { text: 'a', gender: 'f', plural: true }, have: 0, need: 1 }), targetsOf: () => [],
});
const esperar = (ms = 40) => new Promise((r) => setTimeout(r, ms));
const regiao = () => document.getElementById('game-region');
const conteudo = () => document.getElementById('conteudo-do-jogo');
/** Every element whose own filter (or an ancestor's, up to the body) would darken it. */
const filtrado = (el) => { for (let n = el; n && n !== document.body; n = n.parentElement) if (n.style.filter) return true; return false; };
async function simular(chave) {
  motor.pause.show(0);
  document.querySelector('#vp-pause-0 .pm-btn[data-act="options"]').click();
  document.querySelector('#vp-pause-0 .pm-btn[data-act="empatia"]').click();
  const sel = document.querySelector('#empathy #opt-simulacao');
  sel.value = chave;
  sel.dispatchEvent(new Event('change', { bubbles: true }));
  await esperar();
}
async function voltarAoJogo() {
  for (const ov of document.querySelectorAll('#game-region .overlay')) ov.hidden = true;
  motor.pause.hide(0);
  await esperar();
}

beforeAll(async () => {
  document.body.innerHTML = '<p id="sr-status" role="status"></p><p id="sr-alert" role="alert"></p>'
    // 📌 `#caixa-com-porta` IS A CHILD THAT CONTAINS A MENU, and it exists so the RECURSION has a subject: without it this
    // test's world only had children that either were menus or contained none, and the branch that goes one level down
    // never ran. 📏 Measured by a probe on 2026-09-22: filtering a child that contains a menu instead of walking it passed
    // with the suite green — and it is literally ADR-0187's defect, the simulation erasing the door where it is turned off.
    + '<div id="game-region" tabindex="-1"><div id="conteudo-do-jogo">a pergunta</div>'
    + '<div id="caixa-com-porta"><span id="texto-ao-lado-da-porta">ao lado</span><button id="porta-aninhada" data-incl-menu>Ajustes</button></div>'
    + '<button id="porta-do-cartucho" data-incl-menu>Menu</button><div id="title-icons"></div></div>';
  const { createGame } = await import('../app/js/boot/create-game.js');
  motor = createGame({ accommodations: SEM_ASSUNTO, declaration: declaracao(), host: { doc: document, win: window }, downloadHeavy: false, players: [{ ctrl: 0 }] });
});
afterEach(async () => { await simular('normal'); await voltarAoJogo(); });

describe('a simulation runs in the game, never in a menu', () => {
  it('🔴 [Right] in play, the game is simulated and the quick bar is not', async () => {
    await simular('blind');
    await voltarAoJogo();
    expect(filtrado(conteudo()), 'the game is not simulated').toBe(true);
    expect(filtrado(document.querySelector('#title-icons')), 'the quick bar is darkened with the game').toBe(false);
    // the cartridge's own door to the menus (the quiz's «Menu» button): hidden by the simulation, a touch child could not turn it off
    expect(document.querySelector('#porta-do-cartucho'), 'the case would measure nothing').not.toBeNull();
    expect(filtrado(document.querySelector('#porta-do-cartucho')), 'the cartridge\'s door to the menus is darkened').toBe(false);
  });

  it('🔴 [Right] a child that CONTAINS a door is walked INTO, not darkened with the game', async () => {
    /*
     * 🔴 THIS IS ADR-0187's DEFECT ITSELF, and until this case it had a rule and no gate: «a simulated blindness blacked
     * out the empathy panel where it is turned off». A filter reaches every descendant and clearing it on the child does
     * not undo it, so a box that HOLDS a door must be descended into — its ordinary contents darken, the door does not.
     * 📏 Measured by probe on 2026-09-22: filtering such a box instead of walking into it passed with the suite green,
     * because this fixture had no child that held a menu for the branch to run on.
     */
    await simular('blind');
    await voltarAoJogo();
    expect(filtrado(document.getElementById('texto-ao-lado-da-porta')),
      'what sits beside the door is not simulated: the child gets no simulation at all there').toBe(true);
    expect(filtrado(document.getElementById('porta-aninhada')),
      'a door INSIDE the game was darkened with it — the child cannot see the control that turns this off').toBe(false);
  });

  it('🔴 [Right] with the pause card open, nothing is simulated — and back in play it returns', async () => {
    await simular('blind');
    await voltarAoJogo();
    motor.pause.show(0);
    await esperar();
    expect(filtrado(conteudo()), 'the simulation runs behind the open pause card').toBe(false);
    expect(filtrado(document.querySelector('#vp-pause-0')), 'the pause card is simulated').toBe(false);
    motor.pause.hide(0);
    await esperar();
    expect(filtrado(conteudo()), 'the simulation did not come back with the game').toBe(true);
  });

  it('🔴 [Right] with a settings panel open — where the simulation is turned off — nothing is simulated', async () => {
    await simular('blind');
    expect(document.querySelector('#empathy').hidden).toBe(false);
    expect(filtrado(document.querySelector('#empathy')), 'the empathy panel is black: the child cannot turn it off').toBe(false);
    expect(filtrado(conteudo()), 'the simulation runs under the open panel').toBe(false);
  });

  it('🔴 [Right] the quick pause is a menu too: the simulation stops, and leaving it brings it back', async () => {
    await simular('blind');
    await voltarAoJogo();
    const start = () => regiao().dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyH', key: 'h', bubbles: true, cancelable: true }));
    regiao().focus();
    start();
    await esperar();
    expect(document.querySelector('#game-region .pausa-rapida:not([hidden])'), 'the quick pause did not open — the case would measure nothing').not.toBeNull();
    expect(filtrado(conteudo()), 'the simulation runs in the quick pause').toBe(false);
    // START again leaves it — by H, the solo START that is not also «confirm» (an Enter there confirms the icon under the cursor)
    start();
    await esperar();
    expect(document.querySelector('#game-region .pausa-rapida:not([hidden])'), 'START did not leave the quick pause').toBeNull();
    expect(filtrado(conteudo()), 'the simulation did not come back after the quick pause').toBe(true);
  });

  it('🔴 [Right] a drawn simulation is hidden while a menu is open, and sits under the quick bar in play', async () => {
    await simular('lv-tunnel');
    expect(document.querySelector('#viz-overlay')?.hidden ?? true, 'the tunnel is drawn over the open panel').toBe(true);
    await voltarAoJogo();
    const camada = document.querySelector('#viz-overlay');
    expect(camada.hidden, 'the tunnel did not come back in play').toBe(false);
    expect(Number(camada.style.zIndex), 'the drawing covers the quick bar (z 5)').toBeLessThan(5);
  });
});

// ============================== MUTATIONS CHECKED ==============================
//   S1 never suspended · S2 menus closing do not recompose · S3 filter on a world that holds menus · S4 menus not skipped
//   S5 drawing over the bar · S6 the quick pause does not suspend · S8 old parts keep the simulation           🔴 each
//   S9 the cartridge's `data-incl-menu` door simulated                                                          🔴
//   S7 leaving the quick pause did not recompose — SURVIVED, and the call was inert: leaving writes the card's `hidden` and
//      the region's observer recomposes. Removed, not kept as a second path.
