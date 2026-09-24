// SPDX-License-Identifier: AGPL-3.0-or-later
// Tests of input/latch — HOLDING BECOMES TOGGLING (node project: pure, no DOM, no PIXI). ZOMBIES + Right-BICEP.
//
// WHY THIS FILE MATTERS MORE THAN THE MODULE'S SIZE SUGGESTS. These few lines are the difference between playing and
// not playing for whoever cannot KEEP a button pressed. The policy is pure so that a test reaches it without building a
// player, a world and a whole physics step.
//
// What is pinned here, and falls out of the order of two `if`s: with both edges in the SAME frame, the result is
// always 1, whatever the previous state.
import { describe, it, expect } from 'vitest';
import { nextLatchedDir, latchedDrive, LATCH_HELD, LATCH_IDLE } from '../app/js/input/latch.js';

describe('nextLatchedDir — o toque que trava a direção', () => {
  it('[Zero] sem borda nenhuma, o sentido travado não muda (é isso que faz o personagem andar sozinho)', () => {
    expect(nextLatchedDir(0, false, false)).toBe(0);
    expect(nextLatchedDir(-1, false, false)).toBe(-1);
    expect(nextLatchedDir(1, false, false)).toBe(1);
  });

  it('[Right] parado: um toque trava naquele sentido', () => {
    expect(nextLatchedDir(0, true, false)).toBe(-1);
    expect(nextLatchedDir(0, false, true)).toBe(1);
  });

  it('[Right] tocar no sentido em que JÁ se anda para — o mesmo botão liga e desliga', () => {
    // There is deliberately no stop button: someone with a single finger would pay twice the reaches for it.
    expect(nextLatchedDir(-1, true, false)).toBe(0);
    expect(nextLatchedDir(1, false, true)).toBe(0);
  });

  it('[Right] tocar no sentido OPOSTO inverte direto, sem passar pelo zero', () => {
    // Whoever taps "left" while walking right wants to go left, not to stop and tap again.
    expect(nextLatchedDir(1, true, false)).toBe(-1);
    expect(nextLatchedDir(-1, false, true)).toBe(1);
  });

  it('[Boundary] as DUAS bordas no mesmo quadro: o resultado é SEMPRE 1, venha de onde vier', () => {
    // It really happens — two fingers, or a badly calibrated dual switch. Because left is evaluated before right, left
    // never leaves `dir` at 1, so right always finds something other than 1 and latches at 1. It is not "right wins" in
    // the loose sense: the previous state stops mattering altogether. (This case was first written expecting `0` from
    // state 1; the code was right and the expectation wrong.)
    expect(nextLatchedDir(0, true, true)).toBe(1);   // left: 0 → -1 · right: -1 ≠ 1 → 1
    expect(nextLatchedDir(1, true, true)).toBe(1);   // left: 1 → -1 · right: -1 ≠ 1 → 1
    expect(nextLatchedDir(-1, true, true)).toBe(1);  // left: -1 → 0 · right: 0 ≠ 1 → 1
  });

  it('[Interface] só devolve -1, 0 ou 1 — nunca um sentido inventado, em nenhuma das 12 combinações', () => {
    for (const cur of [-1, 0, 1]) {
      for (const l of [false, true]) {
        for (const r of [false, true]) {
          expect([-1, 0, 1]).toContain(nextLatchedDir(cur, l, r));
        }
      }
    }
  });

  it('[Inverse] dois toques no mesmo sentido, a partir do zero, voltam ao zero', () => {
    expect(nextLatchedDir(nextLatchedDir(0, true, false), true, false)).toBe(0);
    expect(nextLatchedDir(nextLatchedDir(0, false, true), false, true)).toBe(0);
  });
});

describe('latchedDrive — quanto anda, e para que lado', () => {
  it('[Zero] parado é zero, esteja segurando o que estiver', () => {
    expect(latchedDrive(0, false, false)).toBe(0);
    expect(latchedDrive(0, true, true)).toBe(0);
  });

  it('[Right] travado e SEM segurar: anda sozinho a 1/3 da velocidade, com o sinal do sentido', () => {
    expect(latchedDrive(-1, false, false)).toBeCloseTo(-LATCH_IDLE, 10);
    expect(latchedDrive(1, false, false)).toBeCloseTo(LATCH_IDLE, 10);
  });

  it('[Right] travado E segurando o botão DAQUELE sentido: acelera para 2/3', () => {
    expect(latchedDrive(-1, true, false)).toBeCloseTo(-LATCH_HELD, 10);
    expect(latchedDrive(1, false, true)).toBeCloseTo(LATCH_HELD, 10);
  });

  it('[Boundary] segurar o botão CONTRÁRIO ao sentido travado não acelera nada', () => {
    // Holding "right" while latched to the left is not an intention to speed up to the left.
    expect(latchedDrive(-1, false, true)).toBeCloseTo(-LATCH_IDLE, 10);
    expect(latchedDrive(1, true, false)).toBeCloseTo(LATCH_IDLE, 10);
  });

  it('[Invariant] segurar SEMPRE anda mais que não segurar, nos dois sentidos', () => {
    expect(Math.abs(latchedDrive(1, false, true))).toBeGreaterThan(Math.abs(latchedDrive(1, false, false)));
    expect(Math.abs(latchedDrive(-1, true, false))).toBeGreaterThan(Math.abs(latchedDrive(-1, false, false)));
  });

  it('[Invariant] o sinal é o do sentido travado, nunca o do botão segurado', () => {
    for (const l of [false, true]) for (const r of [false, true]) {
      expect(latchedDrive(-1, l, r)).toBeLessThan(0);
      expect(latchedDrive(1, l, r)).toBeGreaterThan(0);
    }
  });

  it('[Interface] nunca passa da velocidade de caminhada cheia — 2/3 é o teto', () => {
    for (const d of [-1, 0, 1]) for (const l of [false, true]) for (const r of [false, true]) {
      expect(Math.abs(latchedDrive(d, l, r))).toBeLessThanOrEqual(LATCH_HELD);
    }
  });
});
