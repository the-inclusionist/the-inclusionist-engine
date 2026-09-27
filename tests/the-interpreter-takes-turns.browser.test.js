// SPDX-License-Identifier: AGPL-3.0-or-later
// THE INTERPRETER TAKES TURNS, through the real root (ADR-0234, errata 2026-09-26 — asked whether, in deaf mode, another
// player's sign request should wait its turn like the sonar, the Dev: «Sim»; asked whether a queued reading keeps the screen
// as it was at the press: «Sim.»).
//
// 📌 `tests/vlibras.node.test.js` holds the rule in `ui/vlibras`; this file holds the WIRING: that the sonar in play hands deaf
// mode the seat that pressed, so a second player's request waits for the first to be signed. The host lends the interpreter
// (`EngineHost.interpreter`, which always wins): a double that signs until the case says it ended.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { SEM_ASSUNTO } from './fixtures/accommodation-answers.js';

const declaration = () => ({
  topology: () => ({ kind: 'hotspots', order: ['q1'] }), holdsAtOnce: () => 1, holdsKeys: () => false, tick: 'player',
  world: () => ({ kind: 'element', selector: '#world' }), roleAt: () => 'goal',
  nameAt: () => ({ text: 'pergunta', gender: 'f', plural: false }), focusOf: () => ({ id: 'p0', at: { x: 0, y: 0 }, heading: 'none' }),
  objectiveOf: () => ({ name: { text: 'perguntas', gender: 'f', plural: true }, have: 0, need: 1 }), targetsOf: () => [{ x: 0, y: 0 }],
});

const settle = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };

/** A lent interpreter that signs until the case ends a request, as the free player answers when its last sign ended. */
const asked = [], answers = [];
const interpreter = {
  sign: (text) => { asked.push(text); return new Promise((resolve) => { answers.push(resolve); }); },
  hide: () => {},
  dispose: () => {},
};

let raiz, motor;
beforeAll(async () => {
  const { createGame } = await import('../app/js/boot/create-game.js');
  raiz = document.createElement('div');
  raiz.innerHTML = '<p id="sr-status" role="status"></p><p id="sr-alert" role="alert"></p>'
    + '<div id="game-region" tabindex="-1"><div id="world"></div></div><div id="title-icons"></div>';
  document.body.appendChild(raiz);
  motor = createGame({
    accommodations: SEM_ASSUNTO, declaration: declaration(), downloadHeavy: false,
    host: { doc: document, win: window, interpreter },
    players: [{ ctrl: 0 }, { ctrl: 0 }], onCommand: () => {}, setPhase: () => {},
  });
  await motor.localeReady();
  if (!motor.deafMode.isOn()) motor.deafMode.toggle();
});
afterAll(() => {
  if (motor?.deafMode.isOn()) motor.deafMode.toggle(); // the choice is stored: leave the origin as it was found
  motor?.dispose(); raiz?.remove();
  document.querySelectorAll('[id^="vp-pause-"]').forEach((c) => c.remove());
});

describe('in play, deaf mode hands the interpreter each seat\'s sonar in turn', () => {
  it('🔴 [Right] seat 0 then seat 1: the second is signed after the first ends, with the text of its own press', async () => {
    const world = document.getElementById('world');
    world.textContent = 'Quanto é 2 mais 3?';
    motor.sonar.sonar({ i: 0, x: 0, y: 0 });
    motor.sonar.sonar({ i: 1, x: 0, y: 0 });
    await settle();
    expect(asked, 'seat 1\'s request cut seat 0\'s signing — the root did not hand deaf mode the seat').toHaveLength(1);
    world.textContent = 'Outra tela';
    answers[0]({ signed: true });
    await settle();
    expect(asked, 'seat 1\'s request was never signed').toHaveLength(2);
    expect(asked[1], 'the waiting request read the screen at its turn, not at its press').toBe(asked[0]);
    answers[1]({ signed: true });
    await settle();
  });
});

// ========================= MUTATIONS CHECKED =========================
// (2026-09-26, scripted, each applied to the source and restored from a copy)
//   W1 the in-play sonar narrating without the seat (`ctx.narrate(onScreen)`)   🔴 «seat 0 then seat 1»
//   W2 deaf mode's sonar ignoring the seat (`seatSigning` never set)            🔴 «seat 0 then seat 1»
