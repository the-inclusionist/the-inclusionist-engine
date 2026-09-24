// SPDX-License-Identifier: AGPL-3.0-or-later
// The `accessibility` MODE — item 7 of ADR-0044, and the TRAP the record itself noted.
//
// ========================= WHY THIS FILE STARTS WITH THE WAY OUT =========================
// ADR-0044 listed this item among the NEGATIVE CONSEQUENCES of the decision: the `accessibility` item brings in a second
// INPUT MODE (the directional drives the HUD bar, not the player); a mode one enters and cannot leave is the very trap
// that record is about, so its way out (START or BACK) is part of the decision, not an implementation detail.
//
// A child who cannot see enters the mode, presses a direction, and the character does not move. If she does not know
// how to leave, the game is over for her — and nothing on the screen will say what happened, because the screen is not
// her channel. That is why the WAY-OUT cases come first here, and why there are more of them than entry cases.
//
// ========================= WHAT IS PURE, AND WHAT IS NOT =========================
// The part testable without a screen is the one that decides WHAT AN INTENT MEANS inside the mode. It is little, and it
// is exactly where the trap lives: `sair` has only to stop matching one of the two inputs for the way out to vanish with
// nothing else breaking. The routing (who calls this, and when) belongs to the browser test.
//
// MUTATIONS CHECKED (at the end of the file).
import { describe, it, expect } from 'vitest';
import { barAction } from '../app/js/ui/pause-icons.js';

/** A single intent, as the keyboard and gamepad translators build it. */
const so = (...ks) => Object.fromEntries(ks.map((k) => [k, true]));

describe('modo acessibilidade · o que cada intenção significa dentro da barra', () => {
  it('[Right] VOLTAR sai do modo', () => {
    // The project's `no`: Escape on the keyboard, and the back button on the gamepad (X on PlayStation, B on Xbox, A on
    // Nintendo). It is the way out someone who knows the game tries first, because it is the way out of everything.
    expect(barAction(so('no'), false)).toBe('sair');
  });

  it('[Right] START também sai — DUAS saídas, e é de propósito', () => {
    // The second way out is not redundancy: START is the button that OPENS the pause, and the pause is where the mode was
    // entered from. Whoever is lost tries to go back the way they came. Having only one of the two would trust the child to
    // guess WHICH of the two the game chose.
    expect(barAction({}, true)).toBe('sair');
    expect(barAction(so('up'), true), 'START vence a direção — sair nunca fica atrás de andar').toBe('sair');
  });

  it('[Right] as quatro direções ANDAM na barra', () => {
    for (const d of ['up', 'down', 'left', 'right']) expect(barAction(so(d), false), d).toBe('andar');
  });

  it('[Right] confirmar ATIVA o ícone sob o cursor', () => {
    expect(barAction(so('yes'), false)).toBe('ativar');
  });

  it('[Boundary] SAIR vence tudo, inclusive confirmar', () => {
    // The order of precedence is the decision. If `yes` came first, a gamepad that registered both in the same frame (it
    // happens: fingers press together) would toggle a setting instead of giving the game back.
    expect(barAction(so('no', 'yes'), false)).toBe('sair');
    expect(barAction(so('yes'), true)).toBe('sair');
  });

  it('[Zero] quadro sem intenção nenhuma não faz nada', () => {
    // The gamepad is read EVERY FRAME. Without this, a mode that does something on an idle frame would become sixty
    // actions a second.
    expect(barAction({}, false)).toBe('nada');
  });
});

// ========================= MUTATIONS CHECKED =========================
//   · removing the START branch (`hasStart`) → the [Right] START-also-leaves case fails, and the real effect would be the child
//     pressing the button that brought her there and nothing happening.
//   · putting `yes` before `no` in the order → the [Boundary] leaving-beats-everything case fails.
//   · making a direction return 'andar' before checking START → the START-also-leaves case fails on its second
//     assertion, the one that stages a finger pressing both together.
