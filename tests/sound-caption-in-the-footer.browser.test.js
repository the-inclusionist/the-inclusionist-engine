// SPDX-License-Identifier: AGPL-3.0-or-later
// THE ENGINE HOSTS THE SOUND CAPTION, IN THE FOOTER, ABOVE THE EXPLANATION (study item D3; ADR-0014; ADR-0164 rules 4–5).
//
// 📏 Measured on 2026-09-13: `createAudioEarcons` asks for a `showCaption`, and `createGame` mounts no place for it — the
// platformer writes its own `#caption` with a 1300 ms timer, the soccer game its own with 2600 ms, each positioned by its
// own stylesheet. A cartridge that did not write one had earcons with caption keys and nowhere to show them, and ADR-0164
// rule 4 («the sound caption above, the explanation below it») had nothing to hold.
//
// 📌 `createGame` with a host page and the real stylesheet: order and line count are geometry.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import css from '../app/css/style.css?raw';
import { SEM_ASSUNTO } from './fixtures/accommodation-answers.js';
import { createSettingsStore } from '../app/js/core/state.js';
import { filePort } from './fixtures/file-storage.js';

const esperar = (ms = 80) => new Promise((r) => setTimeout(r, ms));
let motor;
let legendasAntes;

const declaracao = () => ({
  topology: () => ({ kind: 'hotspots', order: ['q1'] }), holdsAtOnce: () => 1, holdsKeys: () => false, tick: 'player',
  world: () => ({ kind: 'element', selector: '#game-region' }), roleAt: () => 'goal',
  nameAt: () => ({ text: 'pergunta', gender: 'f', plural: false }), focusOf: () => ({ id: 'p0', at: { x: 0, y: 0 }, heading: 'none' }),
  objectiveOf: () => ({ name: { text: 'perguntas', gender: 'f', plural: true }, have: 0, need: 1 }), targetsOf: () => [{ x: 0, y: 0 }],
});
const legenda = () => document.querySelector('#game-region .rodape-da-tela .legenda-de-som');

beforeAll(async () => {
  const state = createSettingsStore(filePort); // what the child chose before the root: this file's storage (ADR-0232 D4)
  // ⚠️ the RAW key, absence included: the setting persists in the `localStorage` the browser files share, and a stored
  // `true` turned the deaf-mode icon on in `estado-nao-so-por-cor` (measured)
  legendasAntes = localStorage.getItem('incl_captions');
  state.setCaptionsOnValue(true);
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
  document.body.innerHTML = '<p id="sr-status"></p><div class="stage-wrap" style="width:640px;height:360px;display:flex;flex:none">'
    + '<div id="game-region" tabindex="-1" style="position:relative"><div id="title-icons"></div></div></div>';
  const { createGame } = await import('../app/js/boot/create-game.js');
  motor = createGame({ accommodations: SEM_ASSUNTO, declaration: declaracao(), host: { doc: document, win: window }, downloadHeavy: false });
  await esperar();
});
afterAll(() => {
  if (legendasAntes === null) localStorage.removeItem('incl_captions');
  else localStorage.setItem('incl_captions', legendasAntes);
});

describe('the sound caption', () => {
  it('🔴 [Right] `captionSound` writes the caption in the screen footer, ABOVE the explanation', async () => {
    expect(typeof motor.captionSound, 'the engine offers no caption host').toBe('function');
    const icone = document.querySelector('#title-icons .pi-btn');
    icone.focus(); // the explanation of the pointed icon, the footer's lowest line
    await esperar();
    motor.captionSound('Porta rangendo');
    await esperar();
    const caixa = legenda();
    expect(caixa?.textContent, 'no caption in the footer').toBe('Porta rangendo');
    expect(caixa.hidden).toBe(false);
    const explicacao = document.querySelector('#game-region .rodape-da-tela .barra-explicacao:not([hidden])');
    expect(explicacao, 'no explanation showing — the case would not measure the order').not.toBeNull();
    expect(caixa.getBoundingClientRect().bottom, 'the caption is not above the explanation').toBeLessThanOrEqual(explicacao.getBoundingClientRect().top + 0.5);
    const regiao = document.getElementById('game-region').getBoundingClientRect();
    expect(explicacao.getBoundingClientRect().bottom, 'the explanation left the lowest edge').toBeCloseTo(regiao.bottom, 0);
    expect(caixa.getAttribute('aria-hidden'), 'a caption is for the eyes: the ear already heard the sound').toBe('true');
    icone.blur();
  });

  it('🔴 [Boundary] a long caption takes at most two lines', async () => {
    motor.captionSound('Uma porta de madeira muito velha rangendo devagar enquanto o vento sopra forte lá fora e a chuva bate na janela da casa');
    await esperar();
    const caixa = legenda();
    const cs = getComputedStyle(caixa);
    const linhas = (caixa.getBoundingClientRect().height - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)) / parseFloat(cs.lineHeight);
    expect(Math.round(linhas), 'the caption grows upward into the workspace').toBeLessThanOrEqual(2);
  });

  it('🎯 [Boundary] with the explanation showing too, each takes ONE line — the footer does not climb twice as high', async () => {
    const icone = document.querySelector('#title-icons .pi-btn');
    icone.focus();
    motor.captionSound('Uma porta de madeira muito velha rangendo devagar enquanto o vento sopra forte lá fora e a chuva bate na janela da casa');
    await esperar();
    for (const el of [legenda(), document.querySelector('#game-region .rodape-da-tela .barra-explicacao:not([hidden])')]) {
      const cs = getComputedStyle(el);
      // the box less its padding AND borders: the band's edge margin is a transparent border, and while a long explanation
      // scrolls (ADR-0245) the 4 px over its words is one too — neither is a line of text
      const linhas = (el.getBoundingClientRect().height - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)
        - parseFloat(cs.borderTopWidth) - parseFloat(cs.borderBottomWidth)) / parseFloat(cs.lineHeight);
      expect(Math.round(linhas), `${el.className} takes more than one line beside another`).toBe(1);
    }
    icone.blur();
  });

  it('🔴 [Right] it leaves on its own', async () => {
    motor.captionSound('Sino');
    await esperar(2900);
    expect(legenda().hidden, 'the caption stayed over the game').toBe(true);
  });

  it('🔴 [Right] a long caption stays for its words — eight words are still there after the 2600 ms floor (plan phase 5c)', async () => {
    motor.captionSound('Uma porta de madeira velha rangendo bem devagar');
    await esperar(2900);
    expect(legenda().hidden, 'the long caption left before a child could read it').toBe(false);
    await esperar(1300); // 4000 ms at 500 ms a word
    expect(legenda().hidden, 'the long caption did not leave after its own time').toBe(true);
  });

  it('🎯 [Right] a new caption gets its own time — it does not leave with the previous one\'s', async () => {
    motor.captionSound('Sino');
    await esperar(2000);
    motor.captionSound('Pulo');
    await esperar(900); // past the first caption's end, well inside the second's
    expect(legenda().hidden, 'the second caption left with the first one\'s timer').toBe(false);
    expect(legenda().textContent).toBe('Pulo');
  });

  it('🎯 [Zero] with captions turned off, nothing is written', async () => {
    const state = motor.settings; // the ROOT's store: the one its caption reads (ADR-0232 D4)
    state.setCaptionsOnValue(false);
    motor.captionSound('Vento');
    await esperar();
    expect(legenda().textContent, 'a caption was written with captions off').not.toBe('Vento');
    state.setCaptionsOnValue(true);
  });
});

// ============================== MUTATIONS CHECKED ==============================
// (with `barra-legenda-e-rodape`)
//   L1 the caption below the explanation                   🔴 order
//   L2 no two-line cap                                     🔴 long caption, and beside the explanation
//   L3 it never leaves                                     🔴 leaves on its own
//   L4 the captions setting ignored                        🔴 captions off
//   L5 the caption is spoken too (no aria-hidden)          🔴 order case
//   L6 the one-line rule for legend + explanation only     🔴 beside the explanation
//   L7 written in the region, not the footer               🔴 five
//   L8 a new caption keeps the old one's timer             🔴 own time — FIRST SURVIVED: no case gave two captions in a row
//   B1 a fixed 2600 ms again (plan phase 5c)                🔴 a long caption stays for its words
