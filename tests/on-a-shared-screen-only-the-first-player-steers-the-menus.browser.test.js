// SPDX-License-Identifier: AGPL-3.0-or-later
// ON A SHARED SCREEN ONLY THE FIRST PLAYER STEERS THE MENUS (ADR-0144, erratum of 2026-09-26 — the Dev: «Em jogos onde há dois ou
// mais jogadores na mesma tela / canvas só o primeiro player controla o pause e os menus.»).
//
// 📌 The half `on-a-shared-screen-only-the-first-player-pauses.browser` does not hold: START and SELECT open and leave; this file
// holds what happens INSIDE a menu once it is open. A `createGame` root draws one screen, so with a panel, the card or the quick
// pause in front, seat 1's direction, confirm and back do NOTHING to it — no cursor moves, nothing is activated, nothing closes —,
// by every transport that carries a seat: the pad, the keyboard scheme of that seat, and a transport pressing the virtual
// controller (the eyes). And none of it reaches the game either: the menu owns the screen. Seat 0 steers as before (the control).
// Touch is seat 0's by construction (the on-screen pad is drawn for one player only, `padAllowed`).
//
// 🔴 MEASURED before the fix (2026-09-26): with a panel open, seat 1's pad d-pad and its arrow keys moved the panel's focus, its
// confirm pressed the control under it and its back closed the panel — `input/gamepad` `steerPause` and `ui/menu-nav`
// `menuUnderKeys` handed the dialog on top to any seat. On the card and the quick bar seat 1 already moved nothing (it has no card
// of its own and is never on the bar); those cases pin that the fix keeps it so.
//
// 📌 Driven through the REAL root with two fake standard pads behind `navigator.getGamepads`. ⚠️ ONE ROOT for the file: every
// root polls the same `navigator` and hangs its listeners on the window.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from 'vitest';
import { SEM_ASSUNTO } from './fixtures/accommodation-answers.js';
import { keyed } from './fixtures/declared-words.js';

const PRESET = { up: { label: 'Up' }, down: { label: 'Down' }, action2: { label: 'Confirm' }, action3: { label: 'Back' } };
const declaracao = () => ({
  topology: () => ({ kind: 'hotspots', order: ['q1', 'q2'] }), holdsAtOnce: () => 1, holdsKeys: () => false, tick: 'player',
  world: () => ({ kind: 'element', selector: '#game-region' }), roleAt: () => 'goal',
  nameAt: () => ({ text: 'pergunta', gender: 'f', plural: false }), focusOf: () => ({ id: 'p0', at: { x: 0, y: 0 }, heading: 'none' }),
  objectiveOf: () => ({ name: { text: 'perguntas', gender: 'f', plural: true }, have: 0, need: 2 }), targetsOf: () => [{ x: 0, y: 0 }],
});
const START = 9;
const SELECT = 8;
const ACAO2 = 0;
const ACAO3 = 1;
const CIMA = 12;
const BAIXO = 13;
/** A standard controller at `index` with the buttons this frame has pressed. */
const padFalso = (index, pressed) => ({
  index, mapping: 'standard', id: `test standard pad ${index}`,
  buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: pressed.includes(i) })),
  axes: [0, 0, 0, 0],
});
/**
 * THE KEYS ARE THE ENGINE'S TWO-PLAYER DEFAULTS (`input/default-bindings` `KEYBOARD_DUO`), because the root seats them: it writes
 * each player's `ctrl` from its own tables at boot (`assignControls`), so a scheme handed in `players` is not what the keys mean.
 * Seat 0 on WASD with J confirm, K back, H START; seat 1 on the arrows with keypad 5 confirm, keypad 6 back. `beforeEach` checks it.
 */
const TECLAS = [
  { down: 'KeyS', confirm: 'KeyJ', back: 'KeyK', start: 'KeyH' },
  { up: 'ArrowUp', down: 'ArrowDown', confirm: 'Numpad5', back: 'Numpad6' },
];
const [T0, T1] = TECLAS;

let raiz; let motor; let getGamepadsReal;
/** What each pad has pressed this frame, by the pad's index. */
const botoes = [[], []];
const jogadores = [{ ctrl: 0 }, { ctrl: 0 }];
/** What reached the GAME: every command the cartridge heard. */
const comandos = [];
/** Two frames: the loop schedules the next one at the end of its own, so one alone does not guarantee a whole poll. */
const quadro = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
/** One tap of a button on pad `pad`: down for a poll, up for a poll. */
const apertar = async (pad, botao) => { botoes[pad] = [botao]; await quadro(); botoes[pad] = []; await quadro(); };
/** A real key, as the child gives it: born on the game region and rising. */
const tecla = (code) => {
  const region = document.getElementById('game-region');
  region.dispatchEvent(new KeyboardEvent('keydown', { code, key: code, bubbles: true, cancelable: true }));
  region.dispatchEvent(new KeyboardEvent('keyup', { code, key: code, bubbles: true, cancelable: true }));
};
/** A tap on the virtual controller, the way the eyes, the face, the hands, the voice and the scan press it. */
const tocar = (action, seat) => { motor.controller.press(action, 'olhos', seat); motor.controller.release(action, 'olhos', seat); };

const paineisAbertos = () => [...document.querySelectorAll('#game-region .overlay')].filter((o) => !o.hidden);
const cartao = () => document.getElementById('vp-pause-0');
const pausaRapida = () => { const w = document.querySelector('#game-region .pausa-rapida'); return !!w && w.hidden === false; };
/** Everything a step, a confirm or a back could change in a panel: whether it is open, where focus is, and every value in it. */
const estadoDoPainel = (painel) => ({
  aberto: !painel.hidden,
  foco: [...painel.querySelectorAll('*')].indexOf(document.activeElement),
  values: [...painel.querySelectorAll('input, select')].map((c) => (c.type === 'checkbox' ? c.checked : c.value)),
  html: painel.innerHTML,
});
/** The card: open, which item the cursor is on, which list shows. */
const estadoDoCartao = () => ({
  aberto: cartao().hidden === false,
  cursor: [...cartao().querySelectorAll('.pm-btn')].findIndex((b) => b.classList.contains('pm-sel')),
  html: cartao().innerHTML,
});
/** The quick pause: shown, and where its bar's cursor is. */
const estadoDaBarra = () => ({
  pausada: pausaRapida(),
  cursor: [...document.querySelectorAll('#title-icons *')].findIndex((b) => b.classList.contains('pi-sel')),
});

/** A panel open, as a child opens one: the card, «options», the visual panel. Answers the panel. */
function abrirPainel() {
  motor.pause.show(0);
  document.querySelector('#vp-pause-0 .pm-btn[data-act="options"]').click();
  document.querySelector('#vp-pause-0 .pm-btn[data-act="visual"]').click();
  const abertos = paineisAbertos();
  expect(abertos, 'no panel opened: the case would measure nothing').toHaveLength(1);
  return abertos[0];
}
function fecharTudo() {
  for (const ov of document.querySelectorAll('#game-region .overlay')) ov.hidden = true;
  motor.pause.hide(0);
  if (pausaRapida()) tecla(T0.start); // seat 0's START key leaves the quick pause
}

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
    ...keyed({ preset: PRESET }), setPhase: () => {}, players: jogadores, onCommand: (c) => comandos.push(c),
  });
  window.dispatchEvent(new Event('gamepadconnected'));
  // 📌 EACH PAD TAKES ITS SEAT as a child's does, by order of action: pad 0 first takes seat 0, pad 1 then takes seat 1.
  await apertar(0, ACAO2);
  await apertar(1, ACAO2);
});
afterAll(() => { navigator.getGamepads = getGamepadsReal; motor?.dispose(); raiz?.remove(); });

beforeEach(() => {
  expect(jogadores.map((j) => j.pad), 'the pads did not take one seat each: the cases would measure nothing').toEqual([0, 1]);
  expect(jogadores.map((j) => [j.ctrl.down[0], j.ctrl.action2[0], j.ctrl.action3[0]]), 'the seats\' keys are not the ones pressed here')
    .toEqual([[T0.down, T0.confirm, T0.back], [T1.down, T1.confirm, T1.back]]);
  expect([jogadores[0].ctrl.start[0], jogadores[1].ctrl.up[0]]).toEqual([T0.start, T1.up]);
  expect(paineisAbertos(), 'a case left a panel open').toEqual([]);
  expect(cartao().hidden, 'a case left the card open').toBe(true);
  expect(pausaRapida(), 'a case left the quick pause open').toBe(false);
  comandos.length = 0;
});
// 📌 A red case must not take the next ones with it: what it opened is closed here, whatever it asserted.
afterEach(fecharTudo);

describe('with a PANEL open, seat 1 steers nothing and plays nothing', () => {
  it('🔴 [Right] from seat 1\'s PAD: down, up, confirm and back leave the panel as it was', async () => {
    const painel = abrirPainel();
    const antes = estadoDoPainel(painel);
    for (const b of [BAIXO, CIMA, BAIXO, ACAO2, ACAO3]) await apertar(1, b);
    expect(estadoDoPainel(painel), 'seat 1\'s pad steered the panel on seat 0\'s screen').toEqual(antes);
    expect(comandos, 'seat 1\'s pad reached the game under the panel').toEqual([]);
  });

  it('🔴 [Right] from seat 1\'s KEYBOARD scheme: the same', () => {
    const painel = abrirPainel();
    const antes = estadoDoPainel(painel);
    for (const k of [T1.down, T1.up, T1.down, T1.confirm, T1.back]) tecla(k);
    expect(estadoDoPainel(painel), 'seat 1\'s keys steered the panel on seat 0\'s screen').toEqual(antes);
    expect(comandos, 'seat 1\'s keys reached the game under the panel').toEqual([]);
  });

  it('🔴 [Right] from a transport pressing the virtual controller for seat 1: the same', () => {
    const painel = abrirPainel();
    const antes = estadoDoPainel(painel);
    for (const a of ['down', 'up', 'down', 'action2', 'action3']) tocar(a, 1);
    expect(estadoDoPainel(painel), 'seat 1\'s presses through the controller steered the panel').toEqual(antes);
    expect(comandos, 'seat 1\'s presses reached the game under the panel').toEqual([]);
  });

  it('🔴 [CrossCheck] seat 0 steers it: its pad and its keys move the focus, and its back closes the panel', async () => {
    // 📌 The control of every «nothing» above: the oracle sees a step, and the transports reach the panel at all.
    const painel = abrirPainel();
    let antes = estadoDoPainel(painel).foco;
    await apertar(0, BAIXO);
    expect(estadoDoPainel(painel).foco, 'seat 0\'s pad did not move the panel\'s focus').not.toBe(antes);
    antes = estadoDoPainel(painel).foco;
    tecla(T0.down);
    expect(estadoDoPainel(painel).foco, 'seat 0\'s key did not move the panel\'s focus').not.toBe(antes);
    antes = estadoDoPainel(painel).foco;
    tocar('down', 0);
    expect(estadoDoPainel(painel).foco, 'seat 0\'s controller press did not move the panel\'s focus').not.toBe(antes);
    await apertar(0, ACAO3);
    expect(painel.hidden, 'seat 0\'s back did not close the panel').toBe(true);
    expect(comandos).toEqual([]);
  });
});

describe('with the CARD or the QUICK PAUSE open, seat 1 steers nothing and plays nothing', () => {
  it('🔴 [Right] the card: seat 1\'s pad, keys and controller neither move its cursor nor press nor close it', async () => {
    motor.pause.show(0);
    await apertar(0, BAIXO); // the cursor off the first item, so a step back would show
    const antes = estadoDoCartao();
    expect(antes.cursor, 'seat 0\'s pad did not move the card\'s cursor: the case would measure nothing').toBeGreaterThan(0);
    for (const b of [BAIXO, CIMA, ACAO2, ACAO3]) await apertar(1, b);
    for (const k of [T1.down, T1.up, T1.confirm, T1.back]) tecla(k);
    for (const a of ['down', 'up', 'action2', 'action3']) tocar(a, 1);
    expect(estadoDoCartao(), 'seat 1 steered seat 0\'s card').toEqual(antes);
    expect(paineisAbertos(), 'seat 1 opened a panel from seat 0\'s card').toEqual([]);
    expect(comandos, 'seat 1 reached the game under the card').toEqual([]);
  });

  it('🔴 [Right] the quick pause: seat 1\'s pad, keys and controller neither move its bar nor leave it', async () => {
    await apertar(0, START);
    tecla(T0.down); // seat 0 steps the bar, so the cursor is somewhere a step of seat 1 would move it from
    const antes = estadoDaBarra();
    expect(antes.pausada, 'seat 0\'s START did not open the quick pause: the case would measure nothing').toBe(true);
    for (const b of [BAIXO, CIMA, ACAO2, ACAO3]) await apertar(1, b);
    for (const k of [T1.down, T1.up, T1.confirm, T1.back]) tecla(k);
    for (const a of ['down', 'up', 'action2', 'action3']) tocar(a, 1);
    expect(estadoDaBarra(), 'seat 1 steered or left seat 0\'s quick pause').toEqual(antes);
    expect(paineisAbertos(), 'seat 1 opened a panel from seat 0\'s quick bar').toEqual([]);
    expect(comandos, 'seat 1 reached the game under the quick pause').toEqual([]);
    await apertar(0, START);
    expect(pausaRapida()).toBe(false);
  });

  it('🔴 [CrossCheck] seat 1 still plays when no menu is open', async () => {
    // 📌 The control of every «plays nothing» above: seat 1's pad, key and controller do reach the game in play.
    await apertar(1, ACAO2);
    tecla(T1.confirm);
    tocar('action2', 1);
    expect(comandos.filter((c) => c.pressed).map((c) => [c.action, c.player, c.source]), 'seat 1 does not reach the game in play: the «nothing» above would be true of any seat')
      .toEqual([['action2', 1, 'gamepad'], ['action2', 1, undefined], ['action2', 1, 'olhos']]);
  });
});

// ============================== MUTATIONS CHECKED ==============================
// `scratchpad/menus-first-seat/mutate.mjs` (exactly one occurrence required, LF checked, restored and checked by SHA-256), 2026-09-26,
// against this file, `menu-nav.browser`, `on-a-shared-screen-only-the-first-player-pauses.browser` and `gamepad.node`:
//   M1 `ui/menu-nav` `menuUnderKeys` without the question          🔴 seat 1's keys · the controller · the case in `menu-nav.browser`
//   M2 `input/gamepad` `steerPause` without the question           🔴 seat 1's pad · the seat-1 case in `gamepad.node`
//   M3 the root does not hand the question to `ui/menu-nav`         🔴 seat 1's keys · the controller
//   M4 the root does not hand the question to `input/gamepad`       🔴 seat 1's pad
//   M5 every seat leads the screen                                  🔴 the three panel cases here, and seven in the START file
//   M6 the gamepad's absent question read as «nobody leads»         🔴 the absence case and the own-card case in `gamepad.node`
//   M7 the menus' absent question read as «nobody leads»            🔴 fourteen cases across `menu-nav.browser`
// The card and quick-bar cases here stay green under all seven: seat 1 has no card of its own on this root and never enters the
// bar, so they pin that the fix keeps it so, and are not the fix's gate.
