// SPDX-License-Identifier: AGPL-3.0-or-later
// A GAME'S LOOP THAT THROWS IS ANNOUNCED THROUGH THE NOTICE THE GAME PASSES (study item D1; ADR-0054; ADR-0232 D4).
//
// 📏 Measured on 2026-09-13: `game-soccer` called `startLoop(ticker, frame)` with no options, so its frame stopping would
// have frozen the screen in silence. The first answer was a REGISTRATION — `createGame` put its notice in `core/loop` as a
// default — and ADR-0232 D4 removed it: a registration a root fills is module state, and a second root overwrote the
// first root's notice. The answer now is the type: `onFailure` is REQUIRED, and a game beside `createGame` passes
// `engine.onFailure`.
//
// 📌 The file keeps its name from the registration it once tested: `scripts/rename-map.json` records it, and renaming
// it would leave that record pointing at nothing.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect } from 'vitest';
import { SEM_ASSUNTO } from './fixtures/accommodation-answers.js';

const declaracao = () => ({
  topology: () => ({ kind: 'hotspots', order: ['q1'] }), holdsAtOnce: () => 1, holdsKeys: () => false, tick: 'player',
  world: () => ({ kind: 'element', selector: '#game-region' }), roleAt: () => 'goal',
  nameAt: () => ({ text: 'pergunta', gender: 'f', plural: false }), focusOf: () => ({ id: 'p0', at: { x: 0, y: 0 }, heading: 'none' }),
  objectiveOf: () => ({ name: { text: 'perguntas', gender: 'f', plural: true }, have: 0, need: 1 }), targetsOf: () => [{ x: 0, y: 0 }],
});
function ticker() {
  const fns = [];
  return { deltaTime: 1, add: (f) => fns.push(f), remove: (f) => fns.splice(fns.indexOf(f), 1), tick: () => [...fns].forEach((f) => f()) };
}

describe('the loop notice under createGame', () => {
  it('🔴 [Right] a loop given `engine.onFailure` says it stopped — aloud and on screen', async () => {
    const { createGame } = await import('../app/js/boot/create-game.js');
    const { startLoop } = await import('../app/js/core/loop.js');
    document.body.innerHTML = '<p id="sr-status"></p><p id="sr-alert" role="alert"></p><div id="game-region" tabindex="-1"></div>';
    const motor = createGame({ accommodations: SEM_ASSUNTO, declaration: declaracao(), host: { doc: document, win: window }, downloadHeavy: false });
    const erro = console.error;
    console.error = () => {};
    try {
      const tk = ticker();
      startLoop(tk, () => { throw new Error('quadro'); }, 2, { speed: motor.gameSpeed, onFailure: motor.onFailure });
      tk.tick();
    } finally { console.error = erro; }
    expect(document.getElementById('sr-alert').textContent, 'the child who listens heard nothing').toBe(motor.t('sr.laco.parou'));
    expect(document.getElementById('incl-parou'), 'nothing on screen says the game stopped').not.toBeNull();
    motor.dispose();
  });

  it('🎯 [Zero] the root registers nothing: a loop that does not pass the notice gets none of the root\'s', async () => {
    // The pair of the case above, and the proof the registration is gone rather than merely unused: with a live root on the
    // page, a loop that omits `onFailure` (a plain-JavaScript caller the type cannot reach) stops in its own silence.
    const { createGame } = await import('../app/js/boot/create-game.js');
    const { startLoop } = await import('../app/js/core/loop.js');
    document.body.innerHTML = '<p id="sr-status"></p><p id="sr-alert" role="alert"></p><div id="game-region" tabindex="-1"></div>';
    const motor = createGame({ accommodations: SEM_ASSUNTO, declaration: declaracao(), host: { doc: document, win: window }, downloadHeavy: false });
    const tk = ticker();
    startLoop(tk, () => { throw new Error('sem aviso'); }, 2, { speed: motor.gameSpeed });
    tk.tick();
    expect(document.getElementById('sr-alert').textContent, 'a root notice reached a loop that was not given it').toBe('');
    expect(document.getElementById('incl-parou')).toBeNull();
    motor.dispose();
  });
});

// ============================== MUTATIONS CHECKED ==============================
// (with the two D4 cases in `loop-boundary.node`)
//   R1 `Engine.onFailure` announces nothing (its `srAlert` dropped from `ui/loop-crash`)   🔴 the [Right] case
//   R2 a default notice put back in `core/loop` and registered by `createGame`            🔴 the [Zero] case + loop-boundary
