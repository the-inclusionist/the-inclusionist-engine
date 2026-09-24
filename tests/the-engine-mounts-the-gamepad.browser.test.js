// SPDX-License-Identifier: AGPL-3.0-or-later
// THE ENGINE MOUNTS THE GAMEPAD (ADR-0224; ADR-0223 for the door it presses; issue #197).
//
// 🔴 The gamepad was the only one of the six transports assembled from OUTSIDE — the cartridge called `initGamepad` —
// and that is what nearly left it without the single door, because the virtual controller is a local of `createGame`.
// Now the root mounts it, and what only a cartridge can know arrives in one optional field whose every absence has a
// written meaning. This file holds the first confirmation the record asks for: a cartridge that declares NOTHING about
// controllers still has one, and it reaches the game.
//
// ⚠️ ONE ROOT PER FILE, AND THAT IS THE POINT OF THE FILE EXISTING. 📏 Measured while writing it: `padCur`/`padPrevAct`
// are module state in `input/state`, so two roots on one page poll the SAME controller and the first one to run eats
// the edge — the second sees a button that was already down. In production there is one root; in a test file with
// several there is no controller worth measuring. Same family as ADR-0142, one floor down.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { SEM_ASSUNTO } from './fixtures/accommodation-answers.js';

const PLATAFORMA = {
  up: { label: 'Up' }, down: { label: 'Down' }, left: { label: 'Left' }, right: { label: 'Right' },
  action1: { label: 'Run' }, action2: { label: 'Jump' },
};
const declaracao = () => ({
  topology: () => ({ kind: 'hotspots', order: ['q1', 'q2'] }),
  holdsAtOnce: () => 1,
  holdsKeys: () => true,
  tick: 'player',
  world: () => ({ kind: 'element', selector: '#game-region' }),
  roleAt: () => 'goal',
  nameAt: () => ({ text: 'pergunta', gender: 'f', plural: false }),
  focusOf: () => ({ id: 'p0', at: { x: 0, y: 0 }, heading: 'none' }),
  objectiveOf: () => ({ name: { text: 'perguntas', gender: 'f', plural: true }, have: 0, need: 2 }),
  targetsOf: () => [{ x: 0, y: 0 }],
});

/** A standard controller with the buttons this frame has pressed. */
const padFalso = (pressed) => ({
  index: 0, mapping: 'standard', id: 'test standard pad',
  buttons: Array.from({ length: 16 }, (_, i) => ({ pressed: pressed.includes(i) })),
  axes: [0, 0, 0, 0],
});

const ESQUEMA = { up: ['KeyW'], down: ['KeyS'], left: ['KeyA'], right: ['KeyD'], action1: ['KeyK'], action2: ['KeyJ'],
  action3: null, action4: null, leftShoulder: null, leftTrigger: null, rightShoulder: null, rightTrigger: null,
  start: ['Enter'], select: ['Tab'] };

let raiz; let motor; let recebidos; let botoes; let getGamepadsReal; let jogadores;
/** Two frames: the loop schedules the next one at the end of its own, so one alone does not guarantee a whole poll. */
const quadro = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

beforeAll(async () => {
  const { createGame } = await import('../app/js/boot/create-game.js');
  raiz = document.createElement('div');
  raiz.innerHTML = '<p id="sr-status" role="status"></p><p id="sr-alert" role="alert"></p>'
    + '<div id="game-region" tabindex="-1"></div><div id="title-icons"></div>';
  document.body.appendChild(raiz);
  recebidos = [];
  botoes = [];
  getGamepadsReal = navigator.getGamepads;
  navigator.getGamepads = () => [padFalso(botoes)];
  // 📌 The players are declared AS A CARTRIDGE DECLARES THEM — `{ ctrl }` and nothing more. The seat and the edges are
  // the engine's, and half of this file's assertion is that it seeds them into these objects.
  jogadores = [{ ctrl: ESQUEMA }];
  motor = createGame({
    accommodations: SEM_ASSUNTO, declaration: declaracao(), host: { doc: document, win: window },
    downloadHeavy: false, preset: PLATAFORMA, setPhase: () => {}, players: jogadores,
    onCommand: (c) => recebidos.push(c),
    // 📌 AND NOTHING ABOUT CONTROLLERS: that is what this file measures.
  });
  window.dispatchEvent(new Event('gamepadconnected'));
});

afterAll(() => {
  navigator.getGamepads = getGamepadsReal;
  motor?.dispose();
  raiz?.remove();
});

describe('a cartridge that declares nothing still has a controller', () => {
  it('🔴 [Right] a button reaches `onCommand` as its POSITION, with the source and the seat', async () => {
    // 1st: a controller with no seat TAKES one — the assignment rule by order of action, and it comes before the game.
    botoes = [0]; await quadro();
    botoes = []; await quadro();
    recebidos.length = 0;
    // 2nd: with a seat, the same press is play, and it has to go through the single door.
    botoes = [0]; await quadro();
    expect(recebidos.map((c) => `${c.action}:${c.pressed}:${c.source}:${c.player}`),
      'the engine mounted no controller, or what it mounted does not reach the cartridge')
      .toEqual(['action2:true:gamepad:0']);
  });

  it('🔴 [Right] and the button coming up is released — the game is not left believing it is down', async () => {
    botoes = []; await quadro();
    expect(recebidos.at(-1), 'the release never arrived')
      .toEqual({ action: 'action2', pressed: false, source: 'gamepad', player: 0 });
  });

  it('🔴 [Right] the edge the physics reads is raised too — the door did not REPLACE it', async () => {
    // 📌 Item 4 of ADR-0223: edges keep being raised, they stop being the ONLY output. A cartridge whose physics
    // consumes `jumpEdge` keeps working while one that listens to commands starts working — both, not either.
    jogadores[0].jumpEdge = false;
    botoes = [0]; await quadro();
    expect(jogadores[0].jumpEdge, 'the physics lost the edge when the position gained a door').toBe(true);
    botoes = []; await quadro();
  });

  it('🔴 [Right] the SEAT is the engine\'s to seed — a cartridge declares players, not seats', async () => {
    // 📏 Measured: a cartridge declares `{ ctrl, audioSink? }`, and this transport needs to know whose each
    // controller is. The engine seeds `pad`, `waiting` and `quit` on the very objects the cartridge passed, because
    // the identity is what carries the seat — copying would lose it on the next frame.
    expect(jogadores[0].pad, 'the controller took no seat, so nothing it does is anybody\'s').toBe(0);
    expect(jogadores[0].waiting).toBe(false);
    expect(jogadores[0].quit).toBe(false);
  });

  it('🔴 [Zero] with NO controller connected the engine does not poll — a loop that never sleeps costs battery', async () => {
    // ⚠️ Pilar 1: a máquina de escola. 📏 The frame loop only exists while a pad is connected; `gamepaddisconnected`
    // with nothing left stops it, and a press after that reaches nobody.
    navigator.getGamepads = () => [];
    window.dispatchEvent(new Event('gamepaddisconnected'));
    await quadro();
    recebidos.length = 0;
    navigator.getGamepads = () => [padFalso([0])];
    await quadro();
    expect(recebidos, 'the engine kept polling after the last controller left').toEqual([]);
    navigator.getGamepads = () => [padFalso(botoes)];
  });
});

// MUTATIONS CHECKED — see `scratchpad/mutate-the-engine-mounts-the-gamepad.mjs`.
