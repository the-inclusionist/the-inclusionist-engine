// SPDX-License-Identifier: AGPL-3.0-or-later
// input/latch — HOLDING BECOMES TOGGLING. Step 2 of ADR-0027, half of "input as data".
//
// WHAT IT IS. Whoever cannot KEEP a button pressed — spasticity, tremor, fatigue, a single finger, a sip-and-puff switch —
// does not lose the game: a TAP latches the direction, and the character keeps walking alone. Tapping the same way again
// stops; tapping the opposite way reverses. Holding, for whoever can, speeds up.
//
// WHY IT IS NOT IN THE PHYSICS. The policy used to live inside a game's physics, in the middle of the horizontal
// movement. An INPUT decision was written as if it were a game rule, in a file nobody opens to work on motor
// accessibility — and the engine could not offer the toggle to ANOTHER game without taking the platformer's physics
// along. Jumping and swapping still have no toggle path: each needs its own design answer (what does "a latched jump"
// mean?), and inventing it without the Dev would be worse than the gap.
//
// WHICH SIDE OF THE LINE THIS FALLS ON. ADR-0027 separates PRESENTATION (how state becomes pixel and sound), OPERATION
// (how intent becomes input) and RULE (what is reachable). The objective test: an adaptation crosses the line when it
// changes the SET OF REACHABLE STATES or the PROBABILITY of reaching them. The toggle changes neither — the player reaches
// exactly the same places, spending less motor effort. It is OPERATION, so the engine offers it and a game may not refuse
// it. (Easy mode is RULE: a bigger hitbox, edge protection and lower gravity change what is reachable. They are not here.)
//
// PURE ON PURPOSE: no `document`, no PIXI, no game tuning. It takes numbers and returns numbers, runs in the Vitest
// `node` project, and does not know there is a platformer on the other side.

/** The latched direction: -1 left, 0 stopped, 1 right. */
export type LatchDir = -1 | 0 | 1;

/** The fraction of walking speed when the player HOLDS the button in the latched direction. */
export const LATCH_HELD = 2 / 3;
/** The fraction when the direction is latched but no button is pressed — "walking alone". */
export const LATCH_IDLE = 1 / 3;

/**
 * The next latched direction, given the current one and this frame's tap edges.
 *
 * A tap in the direction already walked STOPS (the same button turns it on and off — there is no stop button, and
 * inventing one would cost a one-finger player twice the reach). A tap in the opposite direction reverses straight away,
 * without passing through zero: whoever taps "left" while walking right wants to go left, not stop and tap again.
 *
 * Both edges in the SAME frame are possible (two fingers, or a badly calibrated double switch) and the order matters:
 * left is evaluated first and right after, so right wins. It is the behaviour the physics always had, kept on purpose and
 * pinned by a test instead of being an accident of the order two `if`s were written in.
 */
export function nextLatchedDir(current: LatchDir, leftEdge: boolean, rightEdge: boolean): LatchDir {
  let dir = current;
  if (leftEdge) dir = dir === -1 ? 0 : -1;
  if (rightEdge) dir = dir === 1 ? 0 : 1;
  return dir;
}

/**
 * The walking-speed multiplier, WITH sign: the latched direction times the fraction for holding or not holding that
 * direction's button.
 *
 * It returns the product (not only the fraction) because stopped is 0 and no fraction needs an opinion on that. The
 * caller multiplies by its own walking speed; the game's tuning constant does not enter this module.
 */
export function latchedDrive(dir: LatchDir, holdingLeft: boolean, holdingRight: boolean): number {
  const holding = (dir === -1 && holdingLeft) || (dir === 1 && holdingRight);
  return dir * (holding ? LATCH_HELD : LATCH_IDLE);
}
