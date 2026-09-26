// SPDX-License-Identifier: AGPL-3.0-or-later
// A PAD THE CHILD MAPPED HAS START AND SELECT (ADR-0122 — the pause cannot be declined; ADR-0144 §1 — START and SELECT from every
// transport; ADR-0155 — START is the quick pause, SELECT the card).
//
// 🔴 MEASURED on 2026-09-26: the mapping wizard asked only the positions the game's preset names, and a preset may not name
// `start` or `select` (ADR-0144 §4, ADR-0155 §4, refused at boot). A DirectInput pad whose wizard opened by itself came out of it
// with no START and no SELECT: the child finished mapping and had no quick pause and no menus on the pad in her hand. The wizard
// now asks them last, always, in the engine's words; the saved map's reading (`input/pad-reading`) already reads both.
//
// 📌 Driven through the REAL root with one fake NON-STANDARD pad behind `navigator.getGamepads`: its first button, with no map
// stored, opens the root's own wizard (`input/gamepad`, «opened by itself»). `map-the-gamepad.browser` holds the motor panel's.
// ⚠️ ONE ROOT for the file: every root polls the same `navigator`.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { SEM_ASSUNTO } from './fixtures/accommodation-answers.js';
import { keyed } from './fixtures/declared-words.js';
import { createTranslator } from '../app/js/core/i18n.js';
import { PADWIZ_ORDER } from '../app/js/input/pad-wizard.js';

const t = createTranslator().t;
const PRESET = { up: { label: 'Up' }, down: { label: 'Down' }, action2: { label: 'Confirm' } };
const declaracao = () => ({
  topology: () => ({ kind: 'hotspots', order: ['q1', 'q2'] }), holdsAtOnce: () => 1, holdsKeys: () => false, tick: 'player',
  world: () => ({ kind: 'element', selector: '#game-region' }), roleAt: () => 'goal',
  nameAt: () => ({ text: 'pergunta', gender: 'f', plural: false }), focusOf: () => ({ id: 'p0', at: { x: 0, y: 0 }, heading: 'none' }),
  objectiveOf: () => ({ name: { text: 'perguntas', gender: 'f', plural: true }, have: 0, need: 2 }), targetsOf: () => [{ x: 0, y: 0 }],
});
const ID = 'Generic USB pad (Vendor: 0079 Product: 0006)';
/** The buttons the child chooses, in the order the wizard asks: up, down, Confirm, START, SELECT. */
const B = { up: 0, down: 1, action2: 2, start: 3, select: 4 };
let botoes = [];
const padFalso = () => ({
  index: 0, mapping: '', id: ID,
  buttons: Array.from({ length: 10 }, (_, i) => ({ pressed: botoes.includes(i) })),
  axes: [0, 0],
});

let raiz; let motor; let getGamepadsReal;
/** Two frames: the loop schedules the next one at the end of its own, so one alone does not guarantee a whole poll. */
const quadro = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
/** The wizard ticks on its own clock (30 ms): long enough for two of its frames. */
const esperar = (ms = 90) => new Promise((r) => setTimeout(r, ms));
/** One tap of a button: down, then up, each held long enough for the poll and for the wizard. */
const apertar = async (botao) => { botoes = [botao]; await quadro(); await esperar(); botoes = []; await quadro(); await esperar(); };
const prompt = () => document.querySelector('#padwiz-prompt')?.textContent ?? '';
const assistenteAberto = () => document.querySelector('#padwiz')?.hidden === false;
const cartaoAberto = () => document.getElementById('vp-pause-0')?.hidden === false;
const pausado = () => document.querySelector('#game-region .pausa-rapida');
const pausadoAVista = () => !!pausado() && pausado().hidden === false;
const perguntas = [];

beforeAll(async () => {
  localStorage.removeItem('incl_padmap_' + ID);
  const { createGame } = await import('../app/js/boot/create-game.js');
  raiz = document.createElement('div');
  raiz.innerHTML = '<p id="sr-status" role="status"></p><p id="sr-alert" role="alert"></p>'
    + '<div id="game-region" tabindex="-1" style="position:relative;width:640px;height:360px"></div><div id="title-icons"></div>';
  document.body.appendChild(raiz);
  getGamepadsReal = navigator.getGamepads;
  navigator.getGamepads = () => [padFalso()];
  motor = createGame({
    accommodations: SEM_ASSUNTO, declaration: declaracao(), host: { doc: document, win: window }, downloadHeavy: false,
    ...keyed({ preset: PRESET }), setPhase: () => {}, onCommand: () => {},
  });
  window.dispatchEvent(new Event('gamepadconnected'));
  // THE CHILD MAPS HER PAD: its first button, with no map stored, opens the wizard by itself; then one button per question.
  botoes = [7]; await quadro(); await esperar(); botoes = []; await quadro(); await esperar();
  for (const passo of ['up', 'down', 'action2', 'start', 'select']) {
    perguntas.push(prompt());
    await apertar(B[passo]);
  }
});
afterAll(() => { navigator.getGamepads = getGamepadsReal; motor?.dispose(); raiz?.remove(); localStorage.removeItem('incl_padmap_' + ID); });

describe('the wizard that opened by itself asks START and SELECT', () => {
  it('🔴 [Right] after the game\'s positions it asks START, then SELECT, in the engine\'s words, and stores them', () => {
    const total = PADWIZ_ORDER.length;
    expect(perguntas.slice(3), 'the last two questions were not START then SELECT, in the engine\'s words').toEqual([
      t('pad.wiz.stepStart', { n: PADWIZ_ORDER.indexOf('start') + 1, total }),
      t('pad.wiz.stepSelect', { n: PADWIZ_ORDER.indexOf('select') + 1, total }),
    ]);
    expect(assistenteAberto(), 'the wizard stayed open').toBe(false);
    expect(JSON.parse(localStorage.getItem('incl_padmap_' + ID) ?? 'null'), 'the stored map').toEqual({
      up: { b: B.up }, down: { b: B.down }, action2: { b: B.action2 }, start: { b: B.start }, select: { b: B.select },
    });
  });
});

describe('and afterwards, that pad has a pause', () => {
  it('🔴 [Right] its START opens its seat\'s quick pause, and START again leaves it', async () => {
    await apertar(B.action2); // the pad takes its seat, as a child's does, by its first button in play
    expect(pausadoAVista(), 'the premise: the game is in play').toBe(false);
    await apertar(B.start);
    expect(pausadoAVista(), 'the mapped pad\'s START did not open the quick pause').toBe(true);
    await apertar(B.start);
    expect(pausadoAVista(), 'the mapped pad\'s START did not leave the quick pause').toBe(false);
  });

  it('🔴 [Right] its SELECT opens the pause card', async () => {
    expect(cartaoAberto(), 'the premise: the card is closed').toBe(false);
    await apertar(B.select);
    expect(cartaoAberto(), 'the mapped pad\'s SELECT did not open the menus').toBe(true);
    motor.pause.hide(0);
  });
});

// ============================== MUTATIONS CHECKED ==============================
// `scratchpad/wizard-start-select/mutate.mjs` (exactly one occurrence required, LF checked, restored and checked by SHA-256),
// 2026-09-26, on `input/pad-wizard`:
//   W1 the START step dropped                                    🔴 all three cases here
//   W2 the SELECT step dropped                                   🔴 the order and SELECT cases; START's stays green, as it should
//   W3 START and SELECT asked from the host's labeller (the preset) 🔴 all three: the preset cannot name them, so the steps vanish
