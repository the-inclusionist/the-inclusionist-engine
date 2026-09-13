// SPDX-License-Identifier: AGPL-3.0-or-later
// «MAPEAR CONTROLE» IN THE MOTOR PANEL (ADR-0151 §2; issue #182): the engine's own gamepad mapping wizard, asking only the
// positions THIS game names, in its words, and storing the map the game's pad reading uses.
//
// 📌 A fake pad behind `navigator.getGamepads`: the wizard reads a button pressed against the pad at rest.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { SEM_ASSUNTO } from './fixtures/respostas-de-acomodacao.js';

let motor;
const declaracao = () => ({
  topology: () => ({ kind: 'hotspots', order: ['q1'] }), holdsAtOnce: () => 1, seguraTeclas: () => true, tick: 'player',
  world: () => ({ kind: 'element', selector: '#game-region' }), roleAt: () => 'goal',
  nameAt: () => ({ text: 'a', gender: 'f', plural: false }), focusOf: () => null,
  objectiveOf: () => ({ name: { text: 'a', gender: 'f', plural: true }, have: 0, need: 1 }), targetsOf: () => [],
});
const esperar = (ms = 60) => new Promise((r) => setTimeout(r, ms));
/** One fake pad: twelve buttons, two axes, all at rest until a test presses one. */
const pad = { id: 'Controle de teste (Vendor: 0001)', index: 0, mapping: '', buttons: Array.from({ length: 12 }, () => ({ pressed: false })), axes: [0, 0] };
const soltarTudo = () => { for (const b of pad.buttons) b.pressed = false; };
let getGamepadsOriginal;

beforeAll(async () => {
  localStorage.removeItem('incl_padmap_' + pad.id);
  getGamepadsOriginal = Object.getOwnPropertyDescriptor(Navigator.prototype, 'getGamepads');
  Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => [pad] });
  document.body.innerHTML = '<p id="sr-status" role="status"></p><p id="sr-alert" role="alert"></p>'
    + '<div id="game-region" tabindex="-1"></div><div id="title-icons"></div>';
  const { createGame } = await import('../app/js/boot/create-game.js');
  motor = createGame({
    acomodacoes: SEM_ASSUNTO, declaration: declaracao(), host: { doc: document, win: window }, baixarPesados: false,
    players: [{ ctrl: 0 }], preset: { left: { label: 'Esquerda' }, action2: { label: 'Pular' } },
  });
});
afterAll(() => {
  delete navigator.getGamepads;
  if (getGamepadsOriginal) Object.defineProperty(Navigator.prototype, 'getGamepads', getGamepadsOriginal);
  localStorage.removeItem('incl_padmap_' + pad.id);
});
function abrirMotora() {
  motor.pausa.mostrar(0);
  document.querySelector('#vp-pause-0 .pm-btn[data-act="options"]').click();
  document.querySelector('#vp-pause-0 .pm-btn[data-act="motora"]').click();
}

describe('«Mapear controle»', () => {
  it('🔴 [Right] the motor panel has a «Mapear controle» row that opens the wizard', async () => {
    abrirMotora();
    const botao = document.querySelector('#motora #opt-controle');
    expect(botao, 'no «Mapear controle» row').not.toBeNull();
    expect(botao.closest('.ctrl-row').querySelector('strong')?.textContent).toBe('Mapear controle');
    botao.click();
    const painel = document.querySelector('#padwiz');
    expect(painel?.hidden, 'the wizard did not open').toBe(false);
    expect(document.querySelector('#padwiz-prompt')?.textContent).toMatch(/Aperte QUALQUER botão/);
  });

  it('🔴 [Right] it asks only the positions the game names, in its words, and stores the map', async () => {
    pad.buttons[3].pressed = true; // any button: this pad is the one
    await esperar();
    soltarTudo();
    await esperar();
    const prompt = () => document.querySelector('#padwiz-prompt').textContent;
    // left comes before action2 in the wizard's order, and up/down are skipped: the game does not name them
    expect(prompt(), 'the first question is not the game\'s first named position').toMatch(/Esquerda/);
    pad.buttons[7].pressed = true;
    await esperar();
    soltarTudo();
    await esperar();
    expect(prompt(), 'the second question').toMatch(/Pular/);
    pad.buttons[1].pressed = true;
    await esperar();
    soltarTudo();
    await esperar();
    const guardado = JSON.parse(localStorage.getItem('incl_padmap_' + pad.id) ?? 'null');
    expect(guardado, 'the map was not stored').toEqual({ left: { b: 7 }, action2: { b: 1 } });
    expect(document.querySelector('#padwiz').hidden, 'the wizard stayed open after the last named position').toBe(true);
  });

  it('🔴 [Right] «Voltar» cancels: nothing is stored', async () => {
    localStorage.removeItem('incl_padmap_' + pad.id);
    abrirMotora();
    document.querySelector('#motora #opt-controle').click();
    pad.buttons[2].pressed = true;
    await esperar();
    soltarTudo();
    await esperar();
    document.querySelector('#padwiz-close').click();
    await esperar();
    expect(document.querySelector('#padwiz').hidden).toBe(true);
    expect(localStorage.getItem('incl_padmap_' + pad.id), 'a cancelled wizard stored a map').toBeNull();
  });

  it('🎯 [Zero] a game that names no position has nothing to map: the row is not offered', () => {
    motor.mount(declaracao(), { acomodacoes: SEM_ASSUNTO, players: [{ ctrl: 0 }] });
    abrirMotora();
    expect(document.querySelector('#motora #opt-controle')?.closest('.ctrl-row')?.hidden, 'a row with nothing to map').toBe(true);
  });
});

// ============================== MUTATIONS CHECKED ==============================
//   K1 no row · K2 wizard not started · K3 asks every position · K4 «Voltar» not wired · K5 cancel saves
//   K6 row offered with nothing named · K7 closing does not hide the panel                                🔴 each
