// SPDX-License-Identifier: AGPL-3.0-or-later
// THE GAME SPEED (ADR-0180; issue #176): one control slows the whole game — timers, reaction windows and the world's pace.
//
// 📌 The steps are Celeste's Assist Mode, the example the Game Accessibility Guidelines cite: 100% down to 50% in tens. The
// engine stores the choice and applies it where the frame time is handed out (`core/loop.startLoop`, which the shells call —
// ADR-0139 §3), so a game on the loop slows with no line of its own.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeEach } from 'vitest';
import { GAME_SPEEDS, nextGameSpeed, isGameSpeed } from '../app/js/core/game-speed.js';
import * as state from '../app/js/core/state.js';
import { startLoop } from '../app/js/core/loop.js';

function portaFalsa(guardado = {}) {
  const dados = { ...guardado };
  return {
    dados,
    get: (k, f) => (k in dados ? String(dados[k]) : f),
    set: (k, v) => { dados[k] = v; },
    getBool: (k, f = false) => (k in dados ? dados[k] === true || dados[k] === 'true' : f),
    setBool: (k, on) => { dados[k] = on; },
    getNum: (k, f = 0) => (k in dados ? Number(dados[k]) : f),
    KEYS: { letterCase: 'incl_lettercase', captions: 'incl_captions', menuIndex: 'incl_menuindex', cbsafe: 'incl_cbsafe', ownercolors: 'incl_ownercolors', outfg: 'incl_outfg', outbg: 'incl_outbg' },
  };
}

describe('the game speed steps', () => {
  it('📌 [Right] 100% to 50% in steps of 10%, Celeste\'s Assist Mode', () => {
    expect(GAME_SPEEDS).toEqual([1, 0.9, 0.8, 0.7, 0.6, 0.5]);
  });

  it('🔴 [Right] each press moves one step down and wraps back to 100%', () => {
    expect(nextGameSpeed(1)).toBe(0.9);
    expect(nextGameSpeed(0.6)).toBe(0.5);
    expect(nextGameSpeed(0.5), 'the cycle does not wrap').toBe(1);
  });

  it('🎯 [Boundary] a value outside the steps is not a speed — a stored typo lands on 100%, never on zero', () => {
    expect(isGameSpeed(0.75)).toBe(1);
    expect(isGameSpeed(0)).toBe(1);
    expect(isGameSpeed(Number.NaN)).toBe(1);
    expect(isGameSpeed(0.7)).toBe(0.7);
    expect(nextGameSpeed(0.75)).toBe(0.9);
  });
});

describe('the stored choice', () => {
  beforeEach(() => { state.loadState(portaFalsa()); });

  it('🔴 [Right] it is loaded from the child\'s storage and written back', () => {
    const p = portaFalsa({ incl_game_speed: 0.6 });
    state.loadState(p);
    expect(state.gameSpeed).toBe(0.6);
    state.setGameSpeedValue(0.5);
    expect(state.gameSpeed).toBe(0.5);
    expect(p.dados.incl_game_speed).toBe(0.5);
  });

  it('🎯 [Zero] nothing stored is 100%', () => {
    expect(state.gameSpeed).toBe(1);
  });
});

describe('the loop applies it', () => {
  it('🔴 [Right] the frame time `startLoop` hands out is the raw time times the speed', () => {
    state.loadState(portaFalsa({ incl_game_speed: 0.5 }));
    let chamar;
    const ticker = { deltaTime: 1, add: (fn) => { chamar = fn; } };
    const recebidos = [];
    startLoop(ticker, (dt) => recebidos.push(dt));
    chamar();
    state.setGameSpeedValue(0.8);
    chamar();
    expect(recebidos).toEqual([0.5, 0.8]);
  });

  it('📌 [Boundary] the clamp applies to the raw time, before the speed — a long frame is not stretched past maxDt', () => {
    state.loadState(portaFalsa({ incl_game_speed: 0.5 }));
    let chamar;
    startLoop({ deltaTime: 10, add: (fn) => { chamar = fn; } }, (dt) => { expect(dt).toBe(1); }, 2);
    chamar();
  });
});

// ============================== MUTATIONS CHECKED ==============================
//   V1 no wrap at 50%                                     🔴 wraps
//   V2 a stored value outside the steps accepted          🔴 [Boundary]
//   V3 startLoop ignores the speed                        🔴 the loop applies it
//   V4 the speed read once at start, not per frame        🔴 the loop applies it
//   V5 the setter does not write the storage              🔴 stored choice
