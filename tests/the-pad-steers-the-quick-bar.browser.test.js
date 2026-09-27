// SPDX-License-Identifier: AGPL-3.0-or-later
// THE PAD STEERS THE QUICK BAR (ADR-0155 §1: «the game stops, the quick bar takes the directional»; ADR-0044 item 7).
//
// 📌 START is the quick pause: the game frozen, PAUSED, and the directional on the accessibility bar. The keyboard's direction
// moves the bar's cursor along its ring, its confirm presses the icon under the cursor, its back and START leave. This file holds
// that the screen's first seat's GAMEPAD does the same, through the real root: the d-pad (all four directions, as the keys),
// action 2 on the icon under the cursor, action 3 and START out, and action 4 to the menus — the second door the frozen screen's
// footer names, «Ação 4: menu» (ADR-0155 erratum «Ambos»). And, on a screen two seats share, that seat 1's pad still does nothing
// to it (ADR-0144, erratum of 2026-09-26).
//
// 🔴 MEASURED before the fix (2026-09-26): seat 0's pad down and right left the cursor on the first icon while its key moved it
// (0 → 1). With the quick pause open the root answers `pauseMenu()` true (`menuWithDpad`: the quick pause is a menu with a
// directional), so `input/gamepad` sent the frame to `steerPause` — which knew the dialog on top and the card, not the bar. The bar
// branch lives in `steerGame`, which that frame never reaches.
// 🔴 MEASURED before the second fix (2026-09-26): seat 0's action-4 KEY on the quick pause opened the card at its root and left the
// quick pause; its pad's action 4 left the child on the frozen screen, the card closed — `steerPause` read the six menu intents,
// and action 4 is none of them.
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
const ACAO2 = 0;
const ACAO3 = 1;
const ACAO4 = 3;
/** Seat 0's `action4` key (`KEYBOARD_DUO`): in the quick pause, the menus' second door (ADR-0155 erratum «Ambos»). */
const TECLA_ACAO4_0 = 'KeyI';
/** The standard table's d-pad, and the key of seat 0's scheme (`KEYBOARD_DUO`, WASD) for the same direction. */
const DIRECOES = { up: [12, 'KeyW'], down: [13, 'KeyS'], left: [14, 'KeyA'], right: [15, 'KeyD'] };
const TECLA_START_0 = 'KeyH';
/** A standard controller at `index` with the buttons this frame has pressed. */
const padFalso = (index, pressed) => ({
  index, mapping: 'standard', id: `test standard pad ${index}`,
  buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: pressed.includes(i) })),
  axes: [0, 0, 0, 0],
});

let raiz; let motor; let getGamepadsReal;
/** What each pad has pressed this frame, by the pad's index. */
const botoes = [[], []];
const jogadores = [{ ctrl: 0 }, { ctrl: 0 }];
/** What reached the GAME: every command the cartridge heard. */
const comandos = [];
/** Every phase the root asked of the game — the way to the menus must not resume it on the way. */
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

const icones = () => [...document.querySelectorAll('#title-icons .pi-btn')];
const pausaRapida = () => { const w = document.querySelector('#game-region .pausa-rapida'); return !!w && w.hidden === false; };
/** Where the bar's cursor is: the index of the selected icon, −1 for none. */
const cursor = () => icones().findIndex((b) => b.classList.contains('pi-sel'));
const paineisAbertos = () => [...document.querySelectorAll('#game-region .overlay')].filter((o) => !o.hidden);
const cartao = () => document.getElementById('vp-pause-0');
/** Where the child is: the card open or not, which of its submenus shows, what has the focus, the quick pause, the legend. */
const ondeEsta = () => ({
  cartao: cartao()?.hidden === false,
  submenu: cartao()?.querySelector('.pause-menu:not([hidden])')?.dataset.sub ?? null,
  foco: document.activeElement === document.body ? null : document.activeElement?.textContent?.trim() ?? null,
  pausada: pausaRapida(),
  legenda: document.querySelector('#game-region .pausa-legenda')?.textContent ?? null,
});

function fecharTudo() {
  for (const ov of document.querySelectorAll('#game-region .overlay')) ov.hidden = true;
  motor.pause.hide(0);
  if (pausaRapida()) tecla(TECLA_START_0); // seat 0's START key leaves the quick pause
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
    ...keyed({ preset: PRESET }), setPhase: (p) => fases.push(p), players: jogadores, onCommand: (c) => comandos.push(c),
  });
  window.dispatchEvent(new Event('gamepadconnected'));
  // 📌 EACH PAD TAKES ITS SEAT as a child's does, by order of action: pad 0 first takes seat 0, pad 1 then takes seat 1.
  await apertar(0, ACAO2);
  await apertar(1, ACAO2);
});
afterAll(() => { navigator.getGamepads = getGamepadsReal; motor?.dispose(); raiz?.remove(); });

beforeEach(() => {
  expect(jogadores.map((j) => j.pad), 'the pads did not take one seat each: the cases would measure nothing').toEqual([0, 1]);
  expect(Object.values(DIRECOES).map(([, k]) => k), 'seat 0\'s direction keys are not the ones pressed here')
    .toEqual(['up', 'down', 'left', 'right'].map((d) => jogadores[0].ctrl[d][0]));
  expect(jogadores[0].ctrl.start[0]).toBe(TECLA_START_0);
  expect(icones().length, 'the bar has too few icons for a step to show').toBeGreaterThan(2);
  expect(paineisAbertos(), 'a case left a panel open').toEqual([]);
  expect(pausaRapida(), 'a case left the quick pause open').toBe(false);
  expect(cartao()?.hidden, 'a case left the pause card open').toBe(true);
  comandos.length = 0;
  fases.length = 0;
});
// 📌 A red case must not take the next ones with it: what it opened is closed here, whatever it asserted.
afterEach(fecharTudo);

/** Enters seat 0's quick pause by its pad's START and answers where the cursor starts. */
async function entrar() {
  await apertar(0, START);
  expect(pausaRapida(), 'seat 0\'s pad START did not open the quick pause: the case would measure nothing').toBe(true);
  return cursor();
}

describe('in the QUICK PAUSE, seat 0\'s pad steers the bar as its keys do', () => {
  it('🔴 [Right] the d-pad moves the cursor along the ring — down and right forward, up and left back', async () => {
    const n = icones().length;
    const inicio = await entrar();
    expect(inicio, 'the quick pause put the cursor on no icon').toBe(0);
    const vistos = [];
    for (const d of ['down', 'right', 'up', 'left', 'left']) { await apertar(0, DIRECOES[d][0]); vistos.push(cursor()); }
    expect(vistos, 'seat 0\'s d-pad did not move the quick bar\'s cursor').toEqual([1, 2, 1, 0, n - 1]);
    expect(pausaRapida(), 'a direction left the quick pause').toBe(true);
    expect(comandos, 'the d-pad on the bar reached the game under it').toEqual([]);
  });

  it('🔴 [CrossCheck] the same steps by seat 0\'s KEYS land on the same icons', async () => {
    // 📌 «as the keyboard does» measured, not assumed: the key path is `ui/menu-nav` → the bar, a road the pad does not take.
    const passos = ['down', 'right', 'up', 'left', 'left'];
    await entrar();
    const pelaTecla = [];
    for (const d of passos) { tecla(DIRECOES[d][1]); pelaTecla.push(cursor()); }
    await apertar(0, START);
    await entrar();
    const peloPad = [];
    for (const d of passos) { await apertar(0, DIRECOES[d][0]); peloPad.push(cursor()); }
    expect(peloPad, 'the pad and the keys move the bar differently').toEqual(pelaTecla);
  });

  it('🔴 [Right] action 2 presses the icon under the cursor, and the quick pause stays', async () => {
    await entrar();
    await apertar(0, DIRECOES.down[0]);
    const alvo = icones()[cursor()];
    expect(cursor(), 'the d-pad did not move the cursor off the first icon: the press would not show whose it is').toBe(1);
    const cliques = [];
    for (const [i, b] of icones().entries()) b.addEventListener('click', () => cliques.push(i), { once: true });
    await apertar(0, ACAO2);
    expect(cliques, 'action 2 did not press the icon under the cursor — or pressed another').toEqual([1]);
    expect(icones()[cursor()], 'pressing the icon moved the cursor').toBe(alvo);
    expect(pausaRapida(), 'action 2 LEFT the quick pause instead of pressing the icon').toBe(true);
    expect(comandos, 'action 2 on the bar reached the game under it').toEqual([]);
  });

  it('🔴 [Right] START again leaves the quick pause, and so does action 3 (back)', async () => {
    await entrar();
    await apertar(0, START);
    expect(pausaRapida(), 'the pad\'s START did not leave the quick pause').toBe(false);
    await entrar();
    await apertar(0, ACAO3);
    expect(pausaRapida(), 'the pad\'s back did not leave the quick pause').toBe(false);
    expect(comandos).toEqual([]);
  });

  it('🔴 [CrossCheck] action 4 opens the menus as seat 0\'s action-4 key does — the same card, in the same place (ADR-0155 erratum «Ambos»)', async () => {
    // 📌 The frozen screen's footer says «Ação 4: menu». The key is measured first, so the pad is held to what the child is told.
    expect(jogadores[0].ctrl.action4[0], 'seat 0\'s action-4 key is not the one pressed here').toBe(TECLA_ACAO4_0);
    await entrar();
    fases.length = 0;
    tecla(TECLA_ACAO4_0);
    const pelaTecla = { ...ondeEsta(), fases: [...fases] };
    expect(pelaTecla.cartao, 'the action-4 KEY did not open the menus: the cross-check would measure nothing').toBe(true);
    motor.pause.hide(0);
    await entrar();
    fases.length = 0;
    await apertar(0, ACAO4);
    expect({ ...ondeEsta(), fases: [...fases] }, 'the pad\'s action 4 in the quick pause did not do what the key does').toEqual(pelaTecla);
    expect(comandos, 'action 4 on the quick pause reached the game under it').toEqual([]);
  });

  it('🔴 [Right] seat 1\'s pad on the shared screen moves, presses and leaves nothing (ADR-0144 erratum)', async () => {
    await entrar();
    await apertar(0, DIRECOES.down[0]); // seat 0 steps, so a step of seat 1 would show from here
    const antes = { pausada: pausaRapida(), cursor: cursor() };
    for (const b of [...Object.values(DIRECOES).map(([p]) => p), ACAO2, ACAO3, ACAO4, START]) await apertar(1, b);
    expect({ pausada: pausaRapida(), cursor: cursor() }, 'seat 1\'s pad steered or left seat 0\'s quick pause').toEqual(antes);
    expect(paineisAbertos(), 'seat 1\'s pad pressed an icon of seat 0\'s bar').toEqual([]);
    expect(cartao()?.hidden, 'seat 1\'s action 4 opened seat 0\'s menus').toBe(true);
    expect(comandos, 'seat 1\'s pad reached the game under the quick pause').toEqual([]);
  });
});

// ============================== MUTATIONS CHECKED ==============================
// `scratchpad/pad-quick-bar/mutate.mjs` (exactly one occurrence of each needle required, LF checked, restored and checked by
// SHA-256), 2026-09-26, against this file, `gamepad.node` and `on-a-shared-screen-only-the-first-player-steers-the-menus.browser`:
//   M1 `steerPause` knows no bar (the defect back)                  🔴 the four seat-0 cases here · the quick-pause case in `gamepad.node`
//   M2 the bar asked after the card                                  🔴 the quick-pause case in `gamepad.node` (an open card under the bar)
//   M3 the bar asked before the screen's question                   🔴 the seat-1 case in `gamepad.node`
//   M4 action 2 read as the START exit (`startEdge` counts it)       🔴 the action-2 case here · the quick-pause case in `gamepad.node`
// The seat-1 case here stays green under all four: on this root seat 1 is never on the bar, so it pins that the fix keeps it so,
// and M2 and M3 are held by the node cases, where a card under the bar and a second seat on a bar can be staged.
// `scratchpad/pad-action4/mutate.mjs` (same discipline), 2026-09-26, against this file and `gamepad.node`:
//   A1 the action-4 press removed (the defect back)                 🔴 the action-4 case here · the action-4 case in `gamepad.node`
//   A2 the press asked before the screen's question                 🔴 the seat-1 action-4 case in `gamepad.node`
//   A3 no return after the press (the frame steers on)              🔴 the action-4 case in `gamepad.node` (action 2 in the same frame)
//   A4 pressed as SELECT instead of the position                    🔴 the action-4 case in `gamepad.node`
// A2–A4 stay green here: this root's seat 1 is in no quick pause for its key to open, and SELECT on the quick pause opens the same
// card — the node case holds that the pad presses the POSITION and leaves its meaning to the root.
