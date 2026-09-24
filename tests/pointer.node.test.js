// SPDX-License-Identifier: AGPL-3.0-or-later
// THE POINTER SAMPLE (ADR-0112), the pure half — issue #105.
//
// ⚠️ WHAT THIS FILE GUARDS IS NOT ARITHMETIC. Clamping a number between 0 and 1 would need no test; what does is the
// DECISION beside it — that `isInside` can be asked AFTER clamping. Two things downstream want opposite halves of the
// same fact: drawing wants the position pinned to the screen, and eyes mode 3 of ADR-0104 wants to know the child
// looked OUT of it, because that is the gesture that opens her list of actions.
//
// Clamping without keeping the answer would kill the second, in silence, and the owner of that mode is a child with
// severe ALS who has no other way.
//
// MUTATIONS CHECKED (at the end of the file).
import { describe, it, expect } from 'vitest';
import {
  DEFAULT_POINTER, isInside, clampInside, pressEdge, switchedTransport,
} from '../app/js/input/pointer.js';

const amostra = (over = {}) => ({ ...DEFAULT_POINTER, ...over });

describe('onde o ponteiro está', () => {
  it('[Right] dentro da região é dentro, nas bordas inclusive', () => {
    expect(isInside({ fx: 0.5, fy: 0.5 })).toBe(true);
    // ⚠️ The edges COUNT. A stroke starting exactly at the margin is a legitimate stroke, and a `<`/`>` here would
    // make the child lose the first line of the drawing without a word.
    expect(isInside({ fx: 0, fy: 0 })).toBe(true);
    expect(isInside({ fx: 1, fy: 1 })).toBe(true);
  });

  it('⚠️ [Boundary] fora é fora, nos quatro lados', () => {
    expect(isInside({ fx: -0.01, fy: 0.5 })).toBe(false);
    expect(isInside({ fx: 1.01, fy: 0.5 })).toBe(false);
    expect(isInside({ fx: 0.5, fy: -0.01 })).toBe(false);
    expect(isInside({ fx: 0.5, fy: 1.01 })).toBe(false);
  });

  it('[Right] prender satura nos dois eixos e nos dois sentidos', () => {
    expect(clampInside({ fx: -2, fy: 3 })).toEqual({ fx: 0, fy: 1 });
    expect(clampInside({ fx: 1.5, fy: -0.5 })).toEqual({ fx: 1, fy: 0 });
  });

  it('📌 [Right] quem já está dentro volta como o MESMO objecto, sem alocar', () => {
    // The pointer is sampled every frame; a copy per frame on a school device is the cost pillar 1 refuses. And it
    // is observable, so it is a case and not a comment.
    const f = { fx: 0.25, fy: 0.75 };
    expect(clampInside(f)).toBe(f);
  });

  it('🎯 [Zero] PRENDER NÃO APAGA O FACTO DE TER SAÍDO — é a decisão inteira deste módulo', () => {
    // ⚠️ The case this file exists to pin. If `clampInside` were the only path and `isInside` were asked AFTER it, the
    // answer would always be `true` and eyes mode 3 of ADR-0104 would lose its only gesture — «olhar para fora» —
    // with no error and nothing on screen to say so.
    const olhouParaCima = { fx: 0.5, fy: -0.4 };
    expect(isInside(olhouParaCima), 'o gesto do modo olhos 3').toBe(false);
    const paraDesenhar = clampInside(olhouParaCima);
    expect(paraDesenhar).toEqual({ fx: 0.5, fy: 0 });          // the stroke stays on screen
    expect(isInside(olhouParaCima), 'a pergunta continua respondível').toBe(false); // and the gesture survives
  });
});

describe('o que o ponteiro está a fazer', () => {
  it('[Right] a borda do aperto é a descida e a subida, e nada entre elas', () => {
    const solto = amostra({ pressed: false });
    const preso = amostra({ pressed: true });
    expect(pressEdge(solto, preso)).toBe('desceu');
    expect(pressEdge(preso, solto)).toBe('subiu');
  });

  it('⚠️ [Zero] segurar não é uma borda — senão o jogo desenharia o mesmo ponto 60 vezes', () => {
    const preso = amostra({ pressed: true });
    expect(pressEdge(preso, amostra({ pressed: true, fx: 0.9 }))).toBeNull();
    expect(pressEdge(amostra(), amostra({ fx: 0.1 }))).toBeNull();
  });

  it('⚠️ [Right] a TROCA DE APARELHO é perguntável — a criança larga o rato e olha para a tela', () => {
    // Without this, a transport switch would only be noticed at the next KEY, and the rules of ADR-0109 (the latch
    // follows the device in use) would keep answering about a device nobody is using.
    expect(switchedTransport(amostra({ source: 'teclado' }), amostra({ source: 'olhos' }))).toBe(true);
    expect(switchedTransport(amostra({ source: 'olhos' }), amostra({ source: 'olhos', fx: 0.9 }))).toBe(false);
  });

  it('[Interface] o padrão é o repouso, e é congelado', () => {
    expect(DEFAULT_POINTER).toEqual({ fx: 0.5, fy: 0.5, source: 'teclado', pressed: false });
    expect(Object.isFrozen(DEFAULT_POINTER)).toBe(true);
  });
});

// ========================= MUTATIONS CHECKED =========================
// Six, by script and with occurrence counts, all killed.
//
//   1. the edges out of `isInside` (`>=` becomes `>`) -> fails the [Boundary]. A stroke starting exactly at the
//      margin is a legitimate stroke, and the child would lose the first line without a word.
//   2. `clampInside` always allocating -> fails the identity case. The pointer is sampled every frame.
//   3. 🎯 `clampInside` CLAMPING IN PLACE (`Object.assign(f, ...)`) -> fails the decisive case. It is the mutation that
//      matters in this file: it breaks no arithmetic — the drawing stays right, the numbers stay right — and it erases
//      the only gesture of ADR-0104's EYES MODE 3. A child with severe ALS opens the list of actions by looking OUT of
//      the screen; clamping in place makes `isInside` answer `true` forever, and the mode dies in silence. No other
//      case in this file fails with it applied.
//   4. holding turning into an edge -> fails the [Zero]. Sixty drawings of the same point per second.
//   5. `switchedTransport` always false -> fails its case. The switch would only be noticed at the next KEY, and
//      the rules of ADR-0109 would answer about a device nobody is using.
//   6. `DEFAULT_POINTER` not frozen -> fails the [Interface]. A shared default someone mutates is a default that
//      stops existing for everyone else.
