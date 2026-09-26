// SPDX-License-Identifier: AGPL-3.0-or-later
// THE GAMEPAD'S START PAUSES ITS OWN SEAT (ADR-0155 — the quick pause is per seat; ADR-0144 §1 «from any transport» and its
// erratum of 2026-09-26 — START and SELECT reach `systemPress` with the seat that pressed).
//
// 🔴 MEASURED on 2026-09-26: the pad's START in play called the root's `pause()`, which carries no seat, and the root answered
// `enterQuickPause(0)`. A second player's START froze the game on the FIRST player's quick pause and put the FIRST player's
// directional on the bar — the child who did not press anything lost her d-pad to a menu. It is now pressed on the virtual
// controller for the pad's seat, as SELECT is, and the engine answers it as that seat's START key (`startForSeat`).
//
// 📌 Driven through the REAL root with two fake standard pads behind `navigator.getGamepads`, the double
// `the-pad-select-opens-the-menus.browser` uses. ⚠️ ONE ROOT for the file: every root polls the same `navigator`.
// The root mounts the quick bar for seat 0 only (`getA11yBars`), so seat 0's quick pause is the one that puts a cursor on it.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { SEM_ASSUNTO } from './fixtures/accommodation-answers.js';
import { keyed } from './fixtures/declared-words.js';

const PRESET = { up: { label: 'Up' }, down: { label: 'Down' }, action2: { label: 'Confirm' } };
const declaracao = () => ({
  topology: () => ({ kind: 'hotspots', order: ['q1', 'q2'] }), holdsAtOnce: () => 1, holdsKeys: () => false, tick: 'player',
  world: () => ({ kind: 'element', selector: '#game-region' }), roleAt: () => 'goal',
  nameAt: () => ({ text: 'pergunta', gender: 'f', plural: false }), focusOf: () => ({ id: 'p0', at: { x: 0, y: 0 }, heading: 'none' }),
  objectiveOf: () => ({ name: { text: 'perguntas', gender: 'f', plural: true }, have: 0, need: 2 }), targetsOf: () => [{ x: 0, y: 0 }],
});
const START = 9;
const ACAO2 = 0;
/** A standard controller at `index` with the buttons this frame has pressed. */
const padFalso = (index, pressed) => ({
  index, mapping: 'standard', id: `test standard pad ${index}`,
  buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: pressed.includes(i) })),
  axes: [0, 0, 0, 0],
});
const ESQUEMA = (up, down, a2) => ({ up: [up], down: [down], left: null, right: null, action1: null, action2: [a2],
  action3: null, action4: null, leftShoulder: null, leftTrigger: null, rightShoulder: null, rightTrigger: null,
  start: null, select: null });

let raiz; let motor; let getGamepadsReal;
/** What each pad has pressed this frame, by the pad's index. */
const botoes = [[], []];
const jogadores = [{ ctrl: ESQUEMA('KeyW', 'KeyS', 'KeyJ') }, { ctrl: ESQUEMA('ArrowUp', 'ArrowDown', 'Numpad1') }];
/** Two frames: the loop schedules the next one at the end of its own, so one alone does not guarantee a whole poll. */
const quadro = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
/** One tap of a button on pad `pad`: down for a poll, up for a poll. */
const apertar = async (pad, botao) => { botoes[pad] = [botao]; await quadro(); botoes[pad] = []; await quadro(); };
const pausadoAVista = () => { const w = document.querySelector('#game-region .pausa-rapida'); return !!w && w.hidden === false; };
/** Seat 0's directional is on its quick bar: the bar's cursor is drawn. */
const barraDoAssento0 = () => !!document.querySelector('#title-icons .pi-sel');

beforeAll(async () => {
  const { createGame } = await import('../app/js/boot/create-game.js');
  raiz = document.createElement('div');
  raiz.innerHTML = '<p id="sr-status" role="status"></p><p id="sr-alert" role="alert"></p>'
    + '<div id="game-region" tabindex="-1" style="position:relative;width:640px;height:360px"></div><div id="title-icons"></div>';
  document.body.appendChild(raiz);
  getGamepadsReal = navigator.getGamepads;
  navigator.getGamepads = () => [padFalso(0, botoes[0]), padFalso(1, botoes[1])];
  motor = createGame({
    accommodations: SEM_ASSUNTO, declaration: declaracao(), host: { doc: document, win: window }, downloadHeavy: false,
    ...keyed({ preset: PRESET }), setPhase: () => {}, players: jogadores, onCommand: () => {},
  });
  window.dispatchEvent(new Event('gamepadconnected'));
  // 📌 EACH PAD TAKES ITS SEAT as a child's does, by order of action: pad 0 first takes seat 0, pad 1 then takes seat 1.
  await apertar(0, ACAO2);
  await apertar(1, ACAO2);
});
afterAll(() => { navigator.getGamepads = getGamepadsReal; motor?.dispose(); raiz?.remove(); });

beforeEach(() => {
  expect(jogadores.map((j) => j.pad), 'the pads did not take one seat each: the cases would measure nothing').toEqual([0, 1]);
  expect(pausadoAVista(), 'a case left the game paused').toBe(false);
});

describe('the pad\'s START is its own seat\'s', () => {
  it('🔴 [Right] seat 1\'s START opens the quick pause and does NOT take seat 0\'s directional to the bar', async () => {
    await apertar(1, START);
    expect(pausadoAVista(), 'seat 1\'s START did not open the quick pause').toBe(true);
    expect(barraDoAssento0(), 'seat 1\'s START put SEAT 0\'s directional on the bar: it paused the other child').toBe(false);
    // and START again leaves it — the seat whose quick pause it is has its way out (ADR-0044 item 7)
    await apertar(1, START);
    expect(pausadoAVista(), 'seat 1 cannot leave the quick pause it opened').toBe(false);
  });

  it('🔴 [CrossCheck] seat 0\'s START is seat 0\'s quick pause: its directional goes to the bar, and START leaves', async () => {
    // 📌 The control: the oracle above («no cursor on seat 0's bar») must be able to see seat 0's quick pause at all.
    await apertar(0, START);
    expect(pausadoAVista(), 'seat 0\'s START did not open the quick pause').toBe(true);
    expect(barraDoAssento0(), 'seat 0\'s quick pause did not take its directional to the bar').toBe(true);
    await apertar(0, START);
    expect(pausadoAVista(), 'seat 0 cannot leave the quick pause').toBe(false);
    expect(barraDoAssento0()).toBe(false);
  });
});

// ============================== MUTATIONS CHECKED ==============================
// `scratchpad/pad-seat-select/mutate.mjs seat` (exactly one occurrence required, LF checked, restored and checked by SHA-256), 2026-09-26:
//   M1 START in play back to the seatless `pause()` (the defect)   🔴 both cases here (the second as the paused game the first left),
//                                                                     and both START cases in `gamepad.node`
//   M2 START pressed for seat 0 whatever the pad's seat            🔴 both cases here, and the seat-1 case in `gamepad.node`
//   M3 the pause actor not told                                    🔴 in `gamepad.node` only, and GREEN HERE: this root's cartridge
//      declares no `setPauseActor`, so the root's answer is a no-op — the transport's rule is held in node
