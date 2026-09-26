// SPDX-License-Identifier: AGPL-3.0-or-later
// ONE WIZARD OWNS THE PAD (ADR-0151 §2; issue #182). A root has two ways into the mapping wizard: the motor panel's «Mapear
// controle» row, and the one `input/gamepad` opens by itself when a DirectInput pad with no stored map presses a button. Each
// builds its own `input/pad-wizard`, and they share the root's one cache of maps (ADR-0232 D4).
//
// 🔴 MEASURED on 2026-09-26: while the panel's wizard was open the root's pad reading (`pollPads`) went on, asking only about
// its OWN wizard. An unmapped DirectInput pad then opened the second wizard too — two wizards on one pad, writing the same
// `#padwiz-prompt` — and a standard pad's presses reached the menus underneath, while the child was answering the wizard.
// The root holds both wizards, so the root keeps them apart (`boot/create-game`): the pad's poll stands aside while the panel's
// maps, and the panel's row does not open while the transport's own maps.
//
// 📌 Driven through the REAL root with fake pads behind `navigator.getGamepads`. ⚠️ ONE ROOT for the file: every root polls
// the same `navigator`.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { SEM_ASSUNTO } from './fixtures/accommodation-answers.js';
import { keyed } from './fixtures/declared-words.js';
import { createTranslator } from '../app/js/core/i18n.js';

const t = createTranslator().t;
const declaracao = () => ({
  topology: () => ({ kind: 'hotspots', order: ['q1'] }), holdsAtOnce: () => 1, holdsKeys: () => true, tick: 'player',
  world: () => ({ kind: 'element', selector: '#game-region' }), roleAt: () => 'goal',
  nameAt: () => ({ text: 'a', gender: 'f', plural: false }), focusOf: () => null,
  objectiveOf: () => ({ name: { text: 'a', gender: 'f', plural: true }, have: 0, need: 1 }), targetsOf: () => [],
});
const DI = 'Generic USB pad (Vendor: 0079 Product: 0011)';
const STD = 'Standard pad under the panel (ADR-0232 D4)';
const DI2 = 'Generic USB pad (Vendor: 0079 Product: 0012)';
/** The pad in the child's hand: which one, and which buttons are down. */
let pad = { id: DI, mapping: '' };
let botoes = [];
const padFalso = () => ({
  index: 0, mapping: pad.mapping, id: pad.id, axes: [0, 0, 0, 0],
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
function abrirOAssistenteDoPainel() {
  motor.pause.show(0);
  document.querySelector('#vp-pause-0 .pm-btn[data-act="options"]').click();
  document.querySelector('#vp-pause-0 .pm-btn[data-act="motora"]').click();
  document.querySelector('#motora #opt-controle').click();
}

beforeAll(async () => {
  for (const id of [DI, STD, DI2]) localStorage.removeItem('incl_padmap_' + id);
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
  });
  window.dispatchEvent(new Event('gamepadconnected'));
  await quadro();
});
afterAll(() => {
  navigator.getGamepads = getGamepadsReal;
  motor?.dispose(); raiz?.remove();
  for (const id of [DI, STD, DI2]) localStorage.removeItem('incl_padmap_' + id);
});

describe('while the motor panel\'s wizard is open, it alone owns the pad', () => {
  it('🔴 [Right] an unmapped DirectInput pad does not open the root\'s other wizard over it', async () => {
    pad = { id: DI, mapping: '' };
    abrirOAssistenteDoPainel();
    expect(assistenteAberto(), 'the premise: the panel\'s wizard is open').toBe(true);
    // every sentence the child is shown, as it is written: two wizards on one `#padwiz-prompt` overwrite each other
    const frases = [];
    const observador = new MutationObserver(() => frases.push(document.querySelector('#padwiz-prompt')?.textContent ?? ''));
    observador.observe(document.querySelector('#padwiz-prompt'), { childList: true, characterData: true, subtree: true });
    try {
      await apertar(3); // any button: this pad is the one
      for (const b of [7, 1, 5, 6]) await apertar(b); // Esquerda, Pular, START, SELECT
    } finally { observador.disconnect(); }
    expect(frases, 'the root\'s own wizard opened on the same pad, under the panel\'s')
      .not.toContain(t('pad.wiz.detected', { id: DI }));
    expect(guardado(DI), 'the panel\'s wizard did not store the map').toEqual({ left: { b: 7 }, action2: { b: 1 }, start: { b: 5 }, select: { b: 6 } });
    expect(assistenteAberto(), 'a wizard stayed open after SELECT').toBe(false);
  });

  it('🔴 [Right] a standard pad\'s presses go to the wizard only: the pad is not read, and the card underneath is not steered', async () => {
    pad = { id: STD, mapping: 'standard' };
    await quadro(); await esperar();
    motor.pause.hide(0);
    abrirOAssistenteDoPainel();
    const lidoAntes = motor.input.padCur[0];
    expect(lidoAntes, 'the premise: the root reads this pad').toBeTruthy();
    // A is the menus' «yes», the d-pad moves through them, START leaves the pause: each is only the child's answer here
    for (const b of [0, 14, 0, 9]) {
      await apertar(b);
      expect(motor.input.padCur[0], `button ${b} was read by the root under the wizard`).toBe(lidoAntes);
    }
    // SELECT is the last answer: the wizard closes on it, and from its release on the pad is the root's again
    await apertar(8);
    expect(guardado(STD), 'the wizard was not the one the answers reached').toEqual({ left: { b: 14 }, action2: { b: 0 }, start: { b: 9 }, select: { b: 8 } });
    expect(document.getElementById('vp-pause-0')?.hidden, 'a press under the wizard closed the pause card').toBe(false);
    motor.pause.hide(0);
  });

  it('🎯 [Right] and once it closes, the pad is the game\'s again: the root reads it on the next frames', async () => {
    const lidoAntes = motor.input.padCur[0];
    await apertar(14);
    expect(motor.input.padCur[0], 'the pad stayed muted after the wizard closed').not.toBe(lidoAntes);
  });
});

describe('and while the transport\'s own wizard is open, the panel\'s does not open over it', () => {
  it('🔴 [Right] «Mapear controle» does not start a second wizard on the pad already being mapped', async () => {
    pad = { id: DI2, mapping: '' };
    await apertar(2); // no map stored: the transport's own wizard opens by itself on this pad
    expect(assistenteAberto(), 'the premise: the transport\'s own wizard opened').toBe(true);
    // 📌 Clicked by the script: the row sits under the wizard's overlay, and what is held here is the rule, not the reach
    document.querySelector('#motora #opt-controle').click();
    expect(document.querySelector('#padwiz-prompt').textContent, 'the panel\'s wizard started over the one mapping the pad')
      .not.toBe(t('pad.wiz.pressAny'));
    for (const b of [7, 1, 5, 6]) await apertar(b); // Esquerda, Pular, START, SELECT
    expect(guardado(DI2), 'the map of the wizard that was mapping').toEqual({ left: { b: 7 }, action2: { b: 1 }, start: { b: 5 }, select: { b: 6 } });
    expect(assistenteAberto(), 'a wizard stayed open after SELECT').toBe(false);
  });
});

// ============================== MUTATIONS CHECKED ==============================
// `scratchpad/wizard-words-single/mutate.mjs` + `mutations3.json` on `boot/create-game` (exactly one occurrence required, LF
// checked, restored and checked by SHA-256), 2026-09-26:
//   R1 the pad's poll runs under the panel's wizard        🔴 the DirectInput case and the standard pad's
//   R2 the panel's row opens over the transport's wizard   🔴 «does not start a second wizard»
// 📏 Red before the fix: the DirectInput case (the transport's own wizard said «Controle novo detectado» on the panel's line),
// the standard pad's (button 0 was read by the root under the wizard) and the row's (the panel's «Aperte QUALQUER botão» over
// the wizard mapping the pad).
