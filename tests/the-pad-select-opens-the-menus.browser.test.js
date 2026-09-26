// SPDX-License-Identifier: AGPL-3.0-or-later
// THE GAMEPAD'S SELECT OPENS THE MENUS (ADR-0155; ADR-0144 §1 «from any transport» and its erratum of 2026-09-26).
//
// 🔴 MEASURED on 2026-09-26: `input/pad-reading` reads the SELECT button (button 8 in the standard table) and `input/gamepad` never
// acted on it. The keyboard's F opened the card, in play and from the quick pause; the pad's SELECT did nothing anywhere. It is
// now pressed on the virtual controller, which hands the position to the engine — the same answer F gets.
//
// 📌 Driven through the REAL root with a fake standard pad behind `navigator.getGamepads`, the double
// `the-engine-mounts-the-gamepad.browser` uses. ⚠️ ONE ROOT for the file: every root polls the same `navigator`.
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
const SELECT = 8;
const START = 9;
/** A standard controller with the buttons this frame has pressed. */
const padFalso = (pressed) => ({
  index: 0, mapping: 'standard', id: 'test standard pad',
  buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: pressed.includes(i) })),
  axes: [0, 0, 0, 0],
});

let raiz; let motor; let botoes = []; let getGamepadsReal;
const fases = [];
const ouvidos = [];
/** Two frames: the loop schedules the next one at the end of its own, so one alone does not guarantee a whole poll. */
const quadro = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
/** One tap of a button: down for a poll, up for a poll. */
const apertar = async (botao) => { botoes = [botao]; await quadro(); botoes = []; await quadro(); };
const cartaoAberto = () => document.getElementById('vp-pause-0')?.hidden === false;
const pausado = () => document.querySelector('#game-region .pausa-rapida');
const pausadoAVista = () => !!pausado() && pausado().hidden === false;

beforeAll(async () => {
  const { createGame } = await import('../app/js/boot/create-game.js');
  raiz = document.createElement('div');
  raiz.innerHTML = '<p id="sr-status" role="status"></p><p id="sr-alert" role="alert"></p>'
    + '<div id="game-region" tabindex="-1" style="position:relative;width:640px;height:360px"></div><div id="title-icons"></div>';
  document.body.appendChild(raiz);
  getGamepadsReal = navigator.getGamepads;
  navigator.getGamepads = () => [padFalso(botoes)];
  motor = createGame({
    accommodations: SEM_ASSUNTO, declaration: declaracao(), host: { doc: document, win: window }, downloadHeavy: false,
    ...keyed({ preset: PRESET }), setPhase: (p) => fases.push(p), onCommand: (c) => ouvidos.push(c),
  });
  window.dispatchEvent(new Event('gamepadconnected'));
  // 📌 THE PAD TAKES ITS SEAT FIRST, as a child's does: its first button seats it (the rule by order of action), and until then
  // the pad's START seats rather than pauses. SELECT does not seat — a pad nobody seated presses it for seat 0.
  await apertar(0);
});
afterAll(() => { navigator.getGamepads = getGamepadsReal; motor?.dispose(); raiz?.remove(); });

beforeEach(async () => {
  motor.pause.hide(0);
  if (pausadoAVista()) await apertar(START);
  fases.length = 0;
  ouvidos.length = 0;
});

describe('the pad\'s SELECT, as the keyboard\'s F', () => {
  it('🔴 [Right] in play, SELECT opens the card and asks the game to pause, once', async () => {
    expect(cartaoAberto(), 'the card was already open: the case would measure nothing').toBe(false);
    await apertar(SELECT);
    expect(cartaoAberto(), 'the pad\'s SELECT did not open the menus').toBe(true);
    expect(fases).toEqual(['paused']);
    expect(ouvidos.filter((c) => c.action === 'select'), 'the game heard SELECT').toEqual([]);
  });

  it('🔴 [Right] in the QUICK PAUSE, SELECT goes on to the card without unfreezing the game', async () => {
    await apertar(START);
    expect(pausadoAVista(), 'the pad\'s START did not open the quick pause: the case would measure nothing').toBe(true);
    await apertar(SELECT);
    expect(cartaoAberto(), 'SELECT in the quick pause did not open the menus').toBe(true);
    expect(pausadoAVista(), 'PAUSED stayed over the card').toBe(false);
    expect(fases, 'the game was unfrozen on the way from the quick pause to the card').toEqual(['paused']);
  });

  it('🔴 [Boundary] with the card already open, SELECT asks nothing more — the card is closed by «Voltar ao jogo» and Escape', async () => {
    await apertar(SELECT);
    fases.length = 0;
    await apertar(SELECT);
    expect(cartaoAberto(), 'SELECT closed the card').toBe(true);
    expect(fases).toEqual([]);
  });

  it('🔴 [Zero] a SELECT held down is ONE press: letting go and holding opens nothing twice', async () => {
    botoes = [SELECT]; await quadro(); await quadro(); await quadro();
    expect(cartaoAberto()).toBe(true);
    expect(fases, 'a held SELECT pressed at every frame').toEqual(['paused']);
    botoes = []; await quadro();
  });
});

// ============================== MUTATIONS CHECKED ==============================
// `scratchpad/scan-doors/mutate.mjs` (CRLF normalised, exactly one occurrence required, restored and checked by SHA-256), 2026-09-26:
//   P1 the SELECT edge never pressed (the line removed)          🔴 the four cases here, and the three SELECT cases in `gamepad.node`
//   P2 the edge read as the state (`cur.select` alone)           🔴 in `gamepad.node` (the two «once» cases) and GREEN HERE: in the
//      real root a SELECT pressed again with the card open is refused by the card, so «held down is ONE press» cannot see the
//      repeats — it holds what the child sees, and the transport's own rule is held in node
//   P3 SELECT pressed as START                                    🔴 the four cases here
//   P4 the seat not forwarded (always 0)                          🔴 in `gamepad.node` (the pad on seat 1)
