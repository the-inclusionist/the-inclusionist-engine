// SPDX-License-Identifier: AGPL-3.0-or-later
// THE HOURGLASS ON THE QUICK BAR, MOUNTED (ADR-0180; issue #176), AND THE BAR ON THE SCREEN'S TOP EDGE (interface log).
//
// 📌 `createGame` with a real page: the icon is mounted from the cartridge's `tick`, a press moves the stored speed one step,
// the engine publishes the same value for a game that runs its own frames, and the bar gives its 10 px back to the game.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import css from '../app/css/style.css?raw';
import { SEM_ASSUNTO } from './fixtures/respostas-de-acomodacao.js';

let motor;
let guardadoAntes;
const declaracao = (tick) => ({
  topology: () => ({ kind: 'hotspots', order: ['q1'] }), holdsAtOnce: () => 1, seguraTeclas: () => false, tick,
  world: () => ({ kind: 'element', selector: '#game-region' }), roleAt: () => 'goal',
  nameAt: () => ({ text: 'a', gender: 'f', plural: false }), focusOf: () => null,
  objectiveOf: () => ({ name: { text: 'a', gender: 'f', plural: true }, have: 0, need: 1 }), targetsOf: () => [],
});
const ampulheta = () => document.querySelector('#title-icons .pi-btn[data-pi="velocidade"]');

beforeAll(async () => {
  guardadoAntes = localStorage.getItem('incl_game_speed');
  localStorage.removeItem('incl_game_speed');
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
  document.body.innerHTML = '<p id="sr-status"></p><div class="stage-wrap" style="width:1280px;height:720px;display:flex;flex:none">'
    + '<div id="game-region" tabindex="-1" style="position:relative"><div id="title-icons"></div></div></div>';
  const { createGame } = await import('../app/js/boot/create-game.js');
  motor = createGame({ acomodacoes: SEM_ASSUNTO, declaration: declaracao('clock'), host: { doc: document, win: window }, baixarPesados: false });
  await new Promise((r) => setTimeout(r, 80));
});
afterAll(() => {
  if (guardadoAntes === null) localStorage.removeItem('incl_game_speed');
  else localStorage.setItem('incl_game_speed', guardadoAntes);
});

describe('the hourglass on the quick bar', () => {
  it('🔴 [Right] a game whose time runs by itself gets the hourglass, beside and apart from the other icons', () => {
    expect(ampulheta(), 'no hourglass in a clock game').not.toBeNull();
    expect(ampulheta().textContent).toContain('⏳');
    expect(motor.velocidadeDoJogo(), 'the engine publishes no speed').toBe(1);
  });

  it('🔴 [Right] a press moves one step down, is stored, said in the name, and published', async () => {
    ampulheta().click();
    await new Promise((r) => setTimeout(r, 30));
    expect(motor.velocidadeDoJogo()).toBe(0.9);
    expect(localStorage.getItem('incl_game_speed'), 'the choice was not stored').toBe('0.9');
    expect(ampulheta().getAttribute('aria-label') ?? '', 'the name does not say the speed').toMatch(/90\s?%/);
  });

  it('🔴 [Zero] a turn game mounted after it gets no hourglass', async () => {
    motor.mount(declaracao('player'), { acomodacoes: SEM_ASSUNTO });
    await new Promise((r) => setTimeout(r, 30));
    // hidden, which takes it out of sight, the tab order and the accessibility tree (ADR-0113 clause 3: «not offered»)
    expect(ampulheta()?.hidden ?? true, 'an hourglass in a game with nothing to slow').toBe(true);
    motor.mount(declaracao('clock'), { acomodacoes: SEM_ASSUNTO });
    await new Promise((r) => setTimeout(r, 30));
    expect(ampulheta()?.hidden, 'the hourglass did not come back with a clock game').toBe(false);
  });

  it('🔴 [Right] the quick bar sits on the screen\'s top edge (the Dev: «eleve este painel para que compartilhe a borda com a tela»)', () => {
    const regiao = document.getElementById('game-region').getBoundingClientRect();
    const barra = document.getElementById('title-icons').getBoundingClientRect();
    expect(Math.round(barra.top - regiao.top), 'the bar keeps a gap above it').toBe(0);
  });
});

// ============================== MUTATIONS CHECKED ==============================
//   B1 createGame answers no clock (no `relogio`)         🔴 hourglass mounted, and after a turn game
//   B2 the press does not store                           🔴 a press
//   B3 the engine publishes a constant                    🔴 a press
//   B4 the bar keeps its 10 px                            🔴 top edge
//   B5 `mount` does not reflect the bar                   🔴 a turn game mounted after it
