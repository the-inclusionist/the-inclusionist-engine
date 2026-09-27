// SPDX-License-Identifier: AGPL-3.0-or-later
// THE WIZARD THAT OPENED BY ITSELF CLOSES BY THE PANEL'S WAYS OUT (ADR-0151 §2; ADR-0044 §2 — a menu you cannot leave is a trap).
//
// A DirectInput pad with no stored map opens the gamepad transport's own wizard (`input/gamepad`, `wizardTookOver`) in the
// motor panel's `#padwiz` overlay. That overlay's two ways out are Escape and «Voltar», and both must cancel the wizard that is
// MAPPING: nothing stored, the game as it was before the wizard, the focus back where it was.
//
// 🔴 MEASURED on 2026-09-26: both ways out went through the panel's closer, which asked only about the PANEL's wizard. With
// that one idle it just hid the overlay, and the transport's wizard went on mapping unseen — the game paused, the pad read by
// nobody else, and the next four presses stored as the pad's map.
//
// 📌 Driven through the REAL root with fake pads behind `navigator.getGamepads`. ⚠️ ONE ROOT for the file: every root polls
// the same `navigator`. Each case uses its own pad id: a cancelled wizard sets its pad aside for the session (`maps.skip`).
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { SEM_ASSUNTO } from './fixtures/accommodation-answers.js';
import { keyed } from './fixtures/declared-words.js';
import { createTranslator } from '../app/js/core/i18n.js';
import { PADWIZ_ORDER } from '../app/js/input/pad-wizard.js';

const t = createTranslator().t;
const declaracao = () => ({
  topology: () => ({ kind: 'hotspots', order: ['q1'] }), holdsAtOnce: () => 1, holdsKeys: () => true, tick: 'player',
  world: () => ({ kind: 'element', selector: '#game-region' }), roleAt: () => 'goal',
  nameAt: () => ({ text: 'a', gender: 'f', plural: false }), focusOf: () => null,
  objectiveOf: () => ({ name: { text: 'a', gender: 'f', plural: true }, have: 0, need: 1 }), targetsOf: () => [],
});
const ESC = 'Generic USB pad (Vendor: 0079 Product: 0021)';
const BACK = 'Generic USB pad (Vendor: 0079 Product: 0022)';
const CARD = 'Generic USB pad (Vendor: 0079 Product: 0023)';
let padId = ESC;
let botoes = [];
const padFalso = () => ({
  index: 0, mapping: '', id: padId, axes: [0, 0, 0, 0],
  buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: botoes.includes(i) })),
});

let raiz; let motor; let getGamepadsReal;
/** Two frames: the root's poll schedules the next one at the end of its own. */
const quadro = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
/** The wizard ticks on its own clock (30 ms): long enough for two of its frames. */
const esperar = (ms = 90) => new Promise((r) => setTimeout(r, ms));
const apertar = async (botao) => { botoes = [botao]; await quadro(); await esperar(); botoes = []; await quadro(); await esperar(); };
const guardado = (id) => JSON.parse(localStorage.getItem('incl_padmap_' + id) ?? 'null');
const assistenteAberto = () => document.querySelector('#padwiz')?.hidden === false;
const pausado = () => document.querySelector('#game-region .pausa-rapida');
const pausadoAVista = () => !!pausado() && pausado().hidden === false;
const escape = () => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', key: 'Escape', bubbles: true }));
const voltar = () => document.getElementById('padwiz-close').click();

beforeAll(async () => {
  for (const id of [ESC, BACK, CARD]) localStorage.removeItem('incl_padmap_' + id);
  const { createGame } = await import('../app/js/boot/create-game.js');
  raiz = document.createElement('div');
  raiz.innerHTML = '<p id="sr-status" role="status"></p><p id="sr-alert" role="alert"></p>'
    + '<div id="game-region" tabindex="-1" style="position:relative;width:640px;height:360px"></div><div id="title-icons"></div>';
  document.body.appendChild(raiz);
  getGamepadsReal = navigator.getGamepads;
  navigator.getGamepads = () => [padFalso()];
  motor = createGame({
    accommodations: SEM_ASSUNTO, declaration: declaracao(), host: { doc: document, win: window }, downloadHeavy: false,
    players: [{ ctrl: 0 }], ...keyed({ preset: { left: { label: 'Esquerda' }, action2: { label: 'Pular' } } }),
    setPhase: () => {}, onCommand: () => {},
  });
  window.dispatchEvent(new Event('gamepadconnected'));
  await quadro();
});
afterAll(() => {
  navigator.getGamepads = getGamepadsReal;
  motor?.dispose(); raiz?.remove();
  for (const id of [ESC, BACK, CARD]) localStorage.removeItem('incl_padmap_' + id);
});

/** An unmapped DirectInput pad presses a button: its wizard opens by itself, adopts it and asks the game's first position. */
async function oPadAbreOAssistente(id) {
  padId = id;
  await apertar(3);
  expect(assistenteAberto(), 'the premise: the transport\'s own wizard opened').toBe(true);
  expect(document.querySelector('#padwiz-prompt').textContent, 'the premise: the wizard is mapping this pad')
    .toBe(t('pad.wiz.step', { n: PADWIZ_ORDER.indexOf('left') + 1, total: PADWIZ_ORDER.length, acao: 'Esquerda' }));
}
/** What would have been the wizard's four answers (Esquerda, Pular, START, SELECT): a wizard still mapping, hidden, stores them. */
async function asQuatroRespostas() { for (const b of [7, 1, 5, 6]) await apertar(b); }

describe('the wizard the pad opened by itself, in play, leaves by the panel\'s ways out', () => {
  for (const [caminho, id, sair] of [['Escape', ESC, escape], ['«Voltar»', BACK, voltar]]) {
    it(`🔴 [Right] ${caminho} cancels it: nothing stored, the pad is the game's again, the game back in play, the focus on it`, async () => {
      const regiao = document.getElementById('game-region');
      regiao.focus();
      expect(pausadoAVista(), 'the premise: the game is in play').toBe(false);
      await oPadAbreOAssistente(id);
      expect(pausadoAVista(), 'the premise: the wizard paused the game').toBe(true);
      sair();
      await quadro(); await esperar();
      expect(assistenteAberto(), 'the way out did not hide the wizard').toBe(false);
      const lidoAntes = motor.input.padCur[0];
      await asQuatroRespostas();
      expect(guardado(id), 'the wizard went on mapping hidden, and stored the answers').toBeNull();
      expect(motor.input.padCur[0], 'the pad stayed muted: the wizard still owns it').not.toBe(lidoAntes);
      expect(pausadoAVista(), 'the game stayed paused under a wizard nobody sees').toBe(false);
      expect(document.activeElement, 'the focus did not come back to the game').toBe(regiao);
    });
  }
});

describe('and over the pause card, the card is the child\'s again', () => {
  it('🔴 [Right] Escape cancels it: the card open and reachable, the focus back on the item it was on, nothing stored', async () => {
    motor.pause.show(0);
    const item = document.querySelector('#vp-pause-0 .pm-btn');
    item.focus();
    expect(document.activeElement, 'the premise: the focus is on the card').toBe(item);
    await oPadAbreOAssistente(CARD);
    expect(document.activeElement, 'the premise: the card went inert under the wizard, and the focus with it').not.toBe(item);
    escape();
    await quadro(); await esperar();
    expect(assistenteAberto(), 'Escape did not hide the wizard').toBe(false);
    expect(document.getElementById('vp-pause-0').hidden, 'the card closed').toBe(false);
    expect(document.getElementById('vp-pause-0').inert, 'the card stayed inert under a hidden wizard').toBe(false);
    expect(document.activeElement, 'the focus did not come back to the card\'s item').toBe(item);
    await asQuatroRespostas();
    expect(guardado(CARD), 'the wizard went on mapping hidden, and stored the answers').toBeNull();
    motor.pause.hide(0);
  });
});

// ============================== MUTATIONS CHECKED ==============================
// `scratchpad/wizard-close/mutate.mjs` on `boot/create-game` (exactly one occurrence required, LF checked, restored and checked
// by SHA-256), 2026-09-26:
//   M1 the closer asks only about the panel's wizard (the defect)        🔴 all three: the hidden wizard stored the answers
//   M2 the transport's wizard cancelled, and the closer returns at once  🔴 the card's case: the focus stayed on <body>. The two
//      in play stay green, as they should: there the focus never left the game.
// 📏 Red before the fix: all three on «the wizard went on mapping hidden, and stored the answers».
// 📌 Since ADR-0248 the closer DOES return at once after cancelling the transport's wizard (M2's shape): the focus now comes back
// through `GamepadCtx.wizardClosed`, so the card's case here is red again if the transport does not call it or the root does not
// answer it — measured in `the-pad-wizard-gives-the-focus-back.browser.test.js`.
