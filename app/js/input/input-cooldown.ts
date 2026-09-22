// SPDX-License-Identifier: AGPL-3.0-or-later
// input/input-cooldown — A TREMOR IS NOT A SECOND PRESS (ADR-0217; GAG Advanced/Motor, issue #182).
//
// A hand that shakes, a spasm, a finger that bounces off a key: the same press arrives twice, the game hears two, and the child
// who could not avoid the second one loses the turn. After a key is accepted, this refuses a press that STARTS for as long as
// the cool-down runs.
//
// ⚠️ IT IS AN ACCOMMODATION AND NOT A SIMULATION, which is why it is not in `input/empathy-filter`: that module's first
// paragraph draws the line — a simulation makes play harder on purpose, to show an adult what a disability costs — and a rule
// that HELPS living beside them would blur it for whoever reads either one.
//
// WHAT IT NEVER REFUSES, and each one is a way a child would lose the game instead of being helped:
//   · A RELEASE. A key refused on the way down is still held by a hand; if its release were refused too, a character would walk
//     on after the child let go, and she would have no way to stop.
//   · THE REPEAT OF A KEY SHE IS HOLDING. Holding is one input, however many times the system says so.
//   · A PRESS ONCE THE TIME HAS PASSED — and the time is counted from the last press ACCEPTED, not from the last one seen, or a
//     tremor of ten bounces would push the window forward ten times and the child would never be heard again.
//
// Pure: it is told the time, it answers a decision. No clock, no document, no keyboard.

/** What the root does with the press: let it through, or drop it as an accident. */
export type CooldownDecision = 'accept' | 'refuse';

export interface InputCooldown {
  /**
   * A game key goes down. `held` is whether this same key is already down — the auto-repeat of a hand that is holding, which is
   * one input and not a second.
   */
  keydown(code: string, now: number, ms: number, held: boolean): CooldownDecision;
  /** A game key comes up. Always accepted, and it does not start a new wait. */
  keyup(code: string): CooldownDecision;
  /** Forgets the wait. The root calls it when the child turns the setting off, so the next press is not refused by an old one. */
  reset(): void;
}

/** The GAG's number, and the only one offered until somebody measures another on a real hand (ADR-0217 §3). */
export const COOLDOWN_MS = 500;

export function createInputCooldown(): InputCooldown {
  let lastAccepted: number | null = null;

  return {
    keydown(_code, now, ms, held) {
      if (held) return 'accept';               // the system repeating a key the hand never let go of
      // 📌 «Off» needs no line of its own: with `ms` at 0 no elapsed time is ever less than it, so the comparison below answers
      // «accept» for every press. A guard saying the same thing was here and was removed — a mutation proved it changed nothing,
      // which is the definition of a line that only looks like a decision.
      if (lastAccepted !== null && now - lastAccepted < ms) return 'refuse';
      lastAccepted = now;
      return 'accept';
    },
    keyup() { return 'accept'; },
    reset() { lastAccepted = null; },
  };
}
