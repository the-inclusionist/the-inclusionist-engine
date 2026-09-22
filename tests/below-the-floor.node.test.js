// SPDX-License-Identifier: AGPL-3.0-or-later
// WHAT A CARTRIDGE DRAWS UNDER THE FLOOR IS SAID (ADR-0163 rule 4, second half).
//
// The engine sizes its own text and targets (`texto-nunca-abaixo-de-16`, `pausa-44px`); what a cartridge draws inside the
// region it cannot resize — so it names it in `problems`, the ADR-0148 model. This file pins the DECISION (what counts),
// pure and with the measurements injected; `resolucao-imposta` measures it on a real document.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect } from 'vitest';
import { belowFloor } from '../app/js/ui/layout.js';

const no = (nome, o = {}) => ({ nome, daEngine: false, fontePx: null, alvo: null, ...o });

describe('abaixoDoPiso — text under 8·k and targets under 22·k, the cartridge\'s only', () => {
  it('🔴 [Boundary] at 640×360 (k = 2): 16 px of text and 44 px of target pass, one less does not', () => {
    const r = belowFloor([
      no('p.ok', { fontePx: 16 }), no('p.baixo', { fontePx: 15 }),
      no('button.ok', { alvo: { w: 44, h: 44 } }), no('button.baixo', { alvo: { w: 120, h: 43 } }),
    ], 2);
    expect(r.texto).toEqual(['p.baixo']);
    expect(r.alvos).toEqual(['button.baixo']);
  });

  it('🎯 [Right] the floor grows with the scale — 16 px of text is under it at 1280×720', () => {
    const r = belowFloor([no('p', { fontePx: 16 }), no('button', { alvo: { w: 60, h: 60 } })], 4);
    expect(r.texto).toEqual(['p']);
    expect(r.alvos).toEqual(['button']);
  });

  it('🔴 [Right] a target is measured on its SMALLER side — a wide, short button is still short', () => {
    expect(belowFloor([no('button', { alvo: { w: 300, h: 30 } })], 2).alvos).toEqual(['button']);
    expect(belowFloor([no('button', { alvo: { w: 30, h: 300 } })], 2).alvos).toEqual(['button']);
  });

  it('⚠️ [Zero] the engine\'s own nodes, and nodes with no measure or no area, accuse nothing', () => {
    const r = belowFloor([
      no('span.pi', { daEngine: true, fontePx: 10, alvo: { w: 10, h: 10 } }),
      no('div'),
      no('button.escondido', { alvo: { w: 0, h: 0 } }),
    ], 2);
    expect(r).toEqual({ texto: [], alvos: [] });
  });

  it('⚠️ [Boundary] a k under 2 does not lower the floor — there is no screen under 640×360', () => {
    expect(belowFloor([no('p', { fontePx: 15 })], 1).texto).toEqual(['p']);
  });
});

// ============================== MUTATIONS CHECKED ==============================
//   F3 a target measured on its LARGER side     🔴 [Boundary] [Right] and the browser case
//   F4 the text floor at 6·k                    🔴 [Boundary] ×2 and the browser case
//   F6 the floor does not grow with k           🔴 [Right] the scale case
//   F7 the engine's nodes are not skipped        🔴 [Zero] and the browser case
