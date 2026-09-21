// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * THE GAME SPEED STEPS (ADR-0180): 100% down to 50% in steps of 10%, Celeste's Assist Mode, the example the Game Accessibility
 * Guidelines cite for «Include an option to adjust the game speed» (Basic). One control slows timers, reaction windows and the
 * world's pace at once.
 */
export const GAME_SPEEDS: readonly number[] = Object.freeze([1, 0.9, 0.8, 0.7, 0.6, 0.5]);

/** A value outside the steps is not a speed: a stored typo lands on 100%, never on zero or on a speed nobody chose. */
export function isGameSpeed(v: number): number {
  return GAME_SPEEDS.includes(v) ? v : 1;
}

/** One press: the next step down, wrapping from 50% back to 100%. */
export function nextGameSpeed(v: number): number {
  const i = GAME_SPEEDS.indexOf(isGameSpeed(v));
  return GAME_SPEEDS[(i + 1) % GAME_SPEEDS.length]!;
}
