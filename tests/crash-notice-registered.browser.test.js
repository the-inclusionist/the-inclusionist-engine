// SPDX-License-Identifier: AGPL-3.0-or-later
// A GAME'S LOOP THAT THROWS IS ANNOUNCED EVEN WHEN THE GAME PASSED NO `onFailure` (study item D1; ADR-0054).
//
// 📏 Measured on 2026-09-13: `game-soccer` calls `startLoop(ticker, frame)` with no options. Its frame stopping would have
// frozen the screen in silence — the notice existed (`Engine.aoFalhar`) and depended on the game wiring it. `createGame`
// now registers it as the loop's default, and `unmount` withdraws it.
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
  it('🔴 [Right] a loop started with no `onFailure` says it stopped — aloud and on screen', async () => {
    const { createGame } = await import('../app/js/boot/create-game.js');
    const { startLoop } = await import('../app/js/core/loop.js');
    const { t } = await import('../app/js/core/i18n.js');
    document.body.innerHTML = '<p id="sr-status"></p><p id="sr-alert" role="alert"></p><div id="game-region" tabindex="-1"></div>';
    const motor = createGame({ accommodations: SEM_ASSUNTO, declaration: declaracao(), host: { doc: document, win: window }, downloadHeavy: false });
    const erro = console.error;
    console.error = () => {};
    try {
      const tk = ticker();
      startLoop(tk, () => { throw new Error('quadro'); });
      tk.tick();
    } finally { console.error = erro; }
    expect(document.getElementById('sr-alert').textContent, 'the child who listens heard nothing').toBe(t('sr.laco.parou'));
    expect(document.getElementById('incl-parou'), 'nothing on screen says the game stopped').not.toBeNull();

    // 📌 THE PAIR: after `unmount`, the registration is withdrawn — a second cartridge would not inherit this page's notice
    motor.unmount();
    document.getElementById('sr-alert').textContent = '';
    document.getElementById('incl-parou').remove();
    const tk2 = ticker();
    startLoop(tk2, () => { throw new Error('depois'); });
    tk2.tick();
    expect(document.getElementById('sr-alert').textContent, 'the notice outlived the unmount').toBe('');
  });
});

// ============================== MUTATIONS CHECKED ==============================
// (with the three D1 cases in `loop-boundary.node`)
//   R1 `createGame` registers nothing                          🔴 this file
//   R2 `unmount` does not withdraw it                          🔴 this file (the pair)
//   R3 `startLoop` ignores the registered notice               🔴 this file + loop-boundary
//   R4 the registered notice wins over the game's own          🔴 loop-boundary («the engine's is a default»)
