// SPDX-License-Identifier: AGPL-3.0-or-later
// ON A SHARED SCREEN ONLY THE FIRST PLAYER PAUSES (ADR-0144, erratum of 2026-09-26 — the Dev: «O pause é por tela, não geral, e
// cada jogador tem sua tela. Em jogos onde há dois ou mais jogadores na mesma tela / canvas só o primeiro player controla o pause
// e os menus.»).
//
// 📌 A `createGame` root draws ONE screen — one region, one pause card (`#vp-pause-0`), one quick bar — and every seat it seats
// plays on it. So its pause and menus answer seat 0, and START and SELECT from seat 1 do NOTHING, by every transport that carries
// a seat: the pad, the keyboard scheme of that seat, and a transport pressing the virtual controller (the eyes here, for all of
// them — `start-and-select-from-every-transport.browser` holds each stamp for seat 0). Touch is seat 0's by construction.
// ⚠️ Separate screens are not measured here: one root has one screen, and a player with a screen of her own has a root of her own.
//
// 🔴 MEASURED before the fix (2026-09-26): seat 1's START opened a quick pause of its own (commit 8286e9fb's reading); with seat
// 0's quick pause or card open, seat 1's pad START left that quick pause or closed that card (`steerPause` → the finger's toggle).
//
// 📌 Driven through the REAL root with two fake standard pads behind `navigator.getGamepads`. ⚠️ ONE ROOT for the file: every
// root polls the same `navigator` and hangs its listeners on the window.
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
const SELECT = 8;
const ACAO2 = 0;
/** A standard controller at `index` with the buttons this frame has pressed. */
const padFalso = (index, pressed) => ({
  index, mapping: 'standard', id: `test standard pad ${index}`,
  buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: pressed.includes(i) })),
  axes: [0, 0, 0, 0],
});
/**
 * THE KEYS ARE THE ENGINE'S TWO-PLAYER DEFAULTS (`input/default-bindings` `KEYBOARD_DUO`), because the root seats them: it writes
 * each player's `ctrl` from its own tables at boot (`assignControls`), so a scheme handed in `players` is not what the keys mean.
 * 📏 This file once handed its own and pressed `Numpad0` as seat 1's START and `NumpadDecimal` as its SELECT: they are seat 1's
 * SELECT and nobody's key, so seat 1's START key was never pressed — the keyboard case stayed green with START's question removed.
 * `beforeEach` now checks the keys against the seats.
 */
const TECLAS = [{ start: 'KeyH', select: 'KeyF' }, { start: 'Numpad1', select: 'Numpad0' }];
const [T0, T1] = TECLAS;

let raiz; let motor; let getGamepadsReal;
/** What each pad has pressed this frame, by the pad's index. */
const botoes = [[], []];
const jogadores = [{ ctrl: 0 }, { ctrl: 0 }];
/** The phases the GAME was asked for. */
const fases = [];
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
const pausadoAVista = () => { const w = document.querySelector('#game-region .pausa-rapida'); return !!w && w.hidden === false; };
const cartaoAberto = () => document.getElementById('vp-pause-0')?.hidden === false;
/** Seat 0's directional is on its quick bar: the bar's cursor is drawn. */
const barraDoAssento0 = () => !!document.querySelector('#title-icons .pi-sel');
/** What is on screen: PAUSED, seat 0's bar cursor, the card. */
const tela = () => ({ pausado: pausadoAVista(), barra: barraDoAssento0(), cartao: cartaoAberto() });
const EM_JOGO = { pausado: false, barra: false, cartao: false };

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
    ...keyed({ preset: PRESET }), setPhase: (p) => fases.push(p), players: jogadores, onCommand: () => {},
  });
  window.dispatchEvent(new Event('gamepadconnected'));
  // 📌 EACH PAD TAKES ITS SEAT as a child's does, by order of action: pad 0 first takes seat 0, pad 1 then takes seat 1.
  await apertar(0, ACAO2);
  await apertar(1, ACAO2);
});
afterAll(() => { navigator.getGamepads = getGamepadsReal; motor?.dispose(); raiz?.remove(); });

beforeEach(() => {
  expect(jogadores.map((j) => j.pad), 'the pads did not take one seat each: the cases would measure nothing').toEqual([0, 1]);
  expect(jogadores.map((j) => ({ start: j.ctrl.start[0], select: j.ctrl.select[0] })), 'the seats\' keys are not the ones pressed here')
    .toEqual(TECLAS);
  expect(tela(), 'a case left a menu open').toEqual(EM_JOGO);
  fases.length = 0;
});

describe('in play, seat 1\'s START and SELECT do nothing', () => {
  it('🔴 [Right] from seat 1\'s PAD: no quick pause, no card, and the game is not asked to pause', async () => {
    await apertar(1, START);
    expect(tela(), 'seat 1\'s START opened a pause on seat 0\'s screen').toEqual(EM_JOGO);
    await apertar(1, SELECT);
    expect(tela(), 'seat 1\'s SELECT opened the menus').toEqual(EM_JOGO);
    expect(fases).toEqual([]);
  });

  it('🔴 [Right] from seat 1\'s KEYBOARD scheme: the same', () => {
    tecla(T1.start);
    expect(tela(), 'seat 1\'s START key opened a pause').toEqual(EM_JOGO);
    tecla(T1.select);
    expect(tela(), 'seat 1\'s SELECT key opened the menus').toEqual(EM_JOGO);
    expect(fases).toEqual([]);
  });

  it('🔴 [Right] from a transport pressing the virtual controller for seat 1: the same', () => {
    tocar('start', 1);
    expect(tela(), 'seat 1\'s START through the controller opened a pause').toEqual(EM_JOGO);
    tocar('select', 1);
    expect(tela(), 'seat 1\'s SELECT through the controller opened the menus').toEqual(EM_JOGO);
    expect(fases).toEqual([]);
  });
});

describe('with seat 0\'s pause open, seat 1\'s START and SELECT do nothing', () => {
  it('🔴 [Right] the QUICK PAUSE stays — seat 1 neither leaves it nor turns it into the card, by pad, key or controller', async () => {
    await apertar(0, START);
    const aberta = { pausado: true, barra: true, cartao: false };
    expect(tela(), 'seat 0\'s START did not open the quick pause: the case would measure nothing').toEqual(aberta);
    await apertar(1, START);
    expect(tela(), 'seat 1\'s PAD START left seat 0\'s quick pause').toEqual(aberta);
    tecla(T1.start);
    tocar('start', 1);
    expect(tela(), 'seat 1\'s START key or controller left seat 0\'s quick pause').toEqual(aberta);
    await apertar(1, SELECT);
    tecla(T1.select);
    tocar('select', 1);
    expect(tela(), 'seat 1\'s SELECT turned seat 0\'s quick pause into the card').toEqual(aberta);
    expect(fases).toEqual(['paused']);
    // 🎯 the control: seat 0's START leaves it
    await apertar(0, START);
    expect(tela()).toEqual(EM_JOGO);
  });

  it('🔴 [Right] the CARD stays open — seat 1\'s START does not close it, by pad, key or controller', async () => {
    await apertar(0, SELECT);
    const aberto = { pausado: false, barra: false, cartao: true };
    expect(tela(), 'seat 0\'s SELECT did not open the card: the case would measure nothing').toEqual(aberto);
    await apertar(1, START);
    expect(tela(), 'seat 1\'s PAD START closed seat 0\'s card').toEqual(aberto);
    tecla(T1.start);
    tocar('start', 1);
    await apertar(1, SELECT);
    expect(tela(), 'seat 1\'s START key, controller or SELECT changed seat 0\'s card').toEqual(aberto);
    expect(fases).toEqual(['paused']);
    // 🎯 the control: seat 0's pad START closes it, as the finger's does
    await apertar(0, START);
    expect(tela()).toEqual(EM_JOGO);
  });
});

describe('seat 0 is the screen\'s first player', () => {
  it('🔴 [CrossCheck] seat 0\'s START opens the quick pause with its directional on the bar, and START again leaves', async () => {
    // 📌 The control of every «nothing» above: the oracle can see seat 0's quick pause at all.
    await apertar(0, START);
    expect(tela()).toEqual({ pausado: true, barra: true, cartao: false });
    await apertar(0, START);
    expect(tela()).toEqual(EM_JOGO);
    tecla(T0.start);
    expect(tela(), 'seat 0\'s START key did not open the quick pause').toEqual({ pausado: true, barra: true, cartao: false });
    tecla(T0.start);
    expect(fases).toEqual(['paused', 'playing', 'paused', 'playing']);
  });

  it('🔴 [CrossCheck] seat 0\'s SELECT opens the card, by key and by the controller', () => {
    tecla(T0.select);
    expect(tela().cartao, 'seat 0\'s SELECT key did not open the card').toBe(true);
    motor.pause.hide(0);
    tocar('select', 0);
    expect(tela().cartao, 'seat 0\'s SELECT through the controller did not open the card').toBe(true);
    motor.pause.hide(0);
  });
});

// ============================== MUTATIONS CHECKED ==============================
// `scratchpad/dev-answers/mutate.mjs` (exactly one occurrence required, LF checked, restored and checked by SHA-256), 2026-09-26:
//   P1 every seat leads the screen (commit 8286e9fb's reading)     🔴 the first case, and the six after it as the paused game it left
//   P2 START's question removed from `startForSeat`                🔴 the same
//   P3 the pad's `resume` on an open menu without the question     🔴 the quick pause stays · the card stays open
//   P4 the pad's START on an open menu named as seat 0              🔴 the same two, and the seat case in `gamepad.node`
//   P2 again, the KEYBOARD case run alone (`scratchpad/menus-first-seat/mutate.mjs M8 keyboard-alone`) 🔴 — it was green with the
//      keys this file used to press, which were not seat 1's START

// SELECT has no question of its own: `openSeatMenus` opens the seat's own card, and this root mounts seat 0's only — a guard there
// was measured inert (green under its removal) and was not kept.
