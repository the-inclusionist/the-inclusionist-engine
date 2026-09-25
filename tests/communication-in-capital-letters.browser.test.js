// SPDX-License-Identifier: AGPL-3.0-or-later
// THE COMMUNICATION BUTTON'S FIRST POSITION SHOWS CAPITAL LETTERS (ADR-0149 §1; ADR-0028).
//
// 📏 Reported by the Dev on 2026-09-13: «O botão de comunicação na acessibilidade rápida não está colocando as letras em caixa
// alta na "primeira opção"». Measured: the cycle wrote `letterCase = 'upper'` into the state, and the stylesheet's capital
// rule reads `:root[data-letras="upper"]` — an attribute nothing in the engine wrote. The choice was kept and never shown.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import css from '../app/css/style.css?raw';
import { SEM_ASSUNTO } from './fixtures/accommodation-answers.js';

const esperar = (ms = 60) => new Promise((r) => setTimeout(r, ms));
let createGame;
let state;
let raiz;

const declaracao = () => ({
  topology: () => ({ kind: 'hotspots', order: ['q1'] }),
  holdsAtOnce: () => 1,
  holdsKeys: () => false,
  tick: 'player',
  world: () => ({ kind: 'element', selector: '#game-region' }),
  roleAt: () => 'goal',
  nameAt: () => ({ text: 'pergunta', gender: 'f', plural: false }),
  focusOf: () => ({ id: 'p0', at: { x: 0, y: 0 }, heading: 'none' }),
  objectiveOf: () => ({ name: { text: 'perguntas', gender: 'f', plural: true }, have: 0, need: 3 }),
  targetsOf: () => [{ x: 0, y: 0 }],
});
// Each case opens its own root, and `state` is THAT root's settings store (ADR-0232 D4): the one its bar writes.
const abrir = () => { const motor = createGame({ accommodations: SEM_ASSUNTO, declaration: declaracao(), host: { doc: document, win: window }, downloadHeavy: false }); state = motor.settings; return motor; };
const icone = () => document.querySelector('#title-icons [data-pi="tipografia"]');
/**
 * Presses the communication button as a child does, from the default position (c), until the case turns to capitals:
 * position (a), the only one in capitals (`ui/fonts.typographyCycle`). The face itself is not read — a test page has no
 * font files, and the typography panel refuses a face it cannot show.
 */
async function ateAPrimeiraPosicao() {
  let i = 0;
  do { icone().click(); await esperar(); i++; } while (state.letterCase !== 'upper' && i < 7);
  expect(state.letterCase, 'the cycle never reached the capital-letter position').toBe('upper');
}

beforeAll(async () => {
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
  ({ createGame } = await import('../app/js/boot/create-game.js'));
});

// the letter case and the face are persisted and shared with every other browser test file: kept and put back
const CHAVES = ['incl_lettercase', 'incl_font_k'];
let guardadas;
beforeEach(() => {
  guardadas = CHAVES.map((k) => localStorage.getItem(k));
  raiz = document.createElement('div');
  raiz.innerHTML = '<p id="sr-status" class="sr-only" role="status"></p><p id="sr-alert" class="sr-only" role="alert"></p>'
    + '<div id="stage-wrap" style="width:640px;height:360px;display:flex"><div id="stage"><section id="game-region">'
    + '<p id="texto-do-jogo">Gato</p><div id="title-icons" class="pause-icons"></div></section></div></div>';
  document.body.appendChild(raiz);
});
afterEach(() => {
  raiz.remove();
  document.querySelectorAll('[id^="vp-pause-"]').forEach((c) => c.remove());
  CHAVES.forEach((k, i) => { if (guardadas[i] === null) localStorage.removeItem(k); else localStorage.setItem(k, guardadas[i]); });
  delete document.documentElement.dataset.letras;
  document.documentElement.style.removeProperty('--fonte-escala');
});

describe('the communication button\'s letter case reaches the page', () => {
  // the case as a new child meets it: nothing stored, so the root's store is born with the default (`upper`), the cycle at (c)
  beforeEach(() => { localStorage.removeItem('incl_lettercase'); delete document.documentElement.dataset.letras; });

  it('🔴 [Right] the capital-letter position shows every letter in capitals — the game\'s text and the engine\'s buttons', async () => {
    abrir();
    expect(icone(), 'no communication button in the bar').not.toBeNull();
    await ateAPrimeiraPosicao();
    expect(getComputedStyle(document.getElementById('texto-do-jogo')).textTransform).toBe('uppercase');
    expect(getComputedStyle(icone()).textTransform, 'a button keeps the UA\'s `none`').toBe('uppercase');
  });

  it('🔴 [Right] the capital-letter choice is kept for the next boot', async () => {
    abrir();
    await ateAPrimeiraPosicao();
    expect(localStorage.getItem('incl_lettercase')).toBe('upper');
  });

  it('🔴 [Right] a game opened after capitals were chosen starts in capitals', () => {
    localStorage.setItem('incl_lettercase', 'upper');
    abrir();
    expect(getComputedStyle(document.getElementById('texto-do-jogo')).textTransform).toBe('uppercase');
  });

  it('🎯 [Zero] a new child — nothing chosen — does not get the game in capitals', () => {
    abrir();
    expect(getComputedStyle(document.getElementById('texto-do-jogo')).textTransform).toBe('none');
  });

  it('🔴 [Inverse] the next position gives the natural case back', async () => {
    abrir();
    await ateAPrimeiraPosicao();
    icone().click(); // (b): Andika, natural case
    await esperar();
    expect(getComputedStyle(document.getElementById('texto-do-jogo')).textTransform).toBe('none');
  });
});

// ============================== MUTATIONS CHECKED ==============================
//   K1 no listener on the letter case                  🔴 capitals position
//   K2 no reflection at boot                           🔴 opened after capitals were chosen
//   K3 the state's default written at boot             🔴 [Zero] a new child
//   K4 buttons out of the stylesheet's capital rule    🔴 capitals position (the engine's buttons)
//   K5 capitals written whatever the choice            🔴 natural case back
